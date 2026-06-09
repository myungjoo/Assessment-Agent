// SummaryPersistService spec — T-0309, ADR-0035 §Decision 1/4 (aggregate 평가 write
// service). R-112 4 종 (happy / error / branch / negative 충분 cover, CLAUDE.md §3.2) +
// coverage line/function ≥ 80% 검증.
//
// PrismaService + SummaryNarrativeService 를 Jest mock 으로 대체해 PostgreSQL container /
// 실 LLM 호출 0 으로 isolated 실행 (evaluation-result-persist.service.spec.ts mock 패턴
// mirror). `$transaction` mock 은 콜백을 즉시 tx mock 으로 실행하는 stub 으로, 콜백
// 내부의 tx.summary delegate 에 전달되는 findUnique/create/delete 인자 정합성 + 호출
// 순서 (delete→create) 를 검증한다. 검증 포인트:
//   - persistSummary (fill / reeval × 존재/부재 4 분기) + resetByPeriod 의 happy path.
//   - narrative=mock narrative, metricScore=aggregateMetricScore 출력 정합 결합.
//   - narrative service reject 전파 / $transaction·create reject 전파.
//   - P2002 → ConflictException 변환 / P2002 외 error 는 그대로 propagate.
//   - reset-and-recreate 가 실제로 delete 후 create (ordering) 함을 검증.
//   - negative: 빈 results[] (metricScore 0 + narrative 위임) / invalid period (partial-
//     reset) throw / 매칭 row 0 count 0.
import { ConflictException } from "@nestjs/common";

import type { EvaluationResult } from "./domain/evaluation-result";
import { aggregateMetricScore } from "./domain/summary-aggregate";
import type { SummaryBatchContext } from "./domain/summary-batch-prompt";
import type { SummaryNarrativeService } from "./summary-narrative.service";
import { SummaryPersistService } from "./summary-persist.service";

// 유효 좌표 context — negative test 가 override 로 개별 축을 깬다.
function buildContext(
  overrides: Partial<SummaryBatchContext> = {},
): SummaryBatchContext {
  return {
    personId: "person-1",
    period: "week",
    periodStart: new Date("2026-06-01T00:00:00.000Z"),
    ...overrides,
  };
}

// EvaluationResult fixture — difficulty/contribution/volume 정상값. overrides 로 구성.
function buildResult(
  overrides: Partial<EvaluationResult> = {},
): EvaluationResult {
  return {
    unitId: "commit:com/sec:abc123",
    narrative: "정상 기여 평가문",
    difficulty: "medium",
    contribution: "high",
    volume: 10,
    ...overrides,
  };
}

// Prisma known error helper — duck typing `code` 식별 (실 PrismaClientKnownRequestError
// 생성 cost 회피, evaluation-result-persist.service.spec.ts mirror).
function buildPrismaError(code: string, message = "prisma-error"): Error {
  return Object.assign(new Error(message), { code });
}

// tx delegate mock — $transaction 콜백이 받는 summary delegate.
interface TxMock {
  summary: {
    findUnique: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
  };
}

const MOCK_NARRATIVE = "이번 주 요약 평가문 (mock)";
const MODEL_ID = "gpt-mock";

// service + mock 묶음 factory. narrative service 는 generateBatchNarrative jest.fn 만
// 가진 최소 stub. PrismaService 는 `$transaction` 즉시 실행 stub + summary.deleteMany.
function buildHarness(): {
  service: SummaryPersistService;
  prisma: {
    $transaction: jest.Mock;
    summary: { deleteMany: jest.Mock };
  };
  tx: TxMock;
  narrativeService: { generateBatchNarrative: jest.Mock };
} {
  const tx: TxMock = {
    summary: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  };
  const prisma = {
    // 콜백을 즉시 tx mock 으로 실행 — 트랜잭션 경계 안의 호출 인자/순서를 검증 가능.
    $transaction: jest.fn((cb: (t: TxMock) => unknown): unknown => cb(tx)),
    summary: { deleteMany: jest.fn() },
  };
  const narrativeService = {
    generateBatchNarrative: jest.fn().mockResolvedValue(MOCK_NARRATIVE),
  };
  const service = new SummaryPersistService(
    prisma as unknown as ConstructorParameters<typeof SummaryPersistService>[0],
    narrativeService as unknown as SummaryNarrativeService,
  );
  return { service, prisma, tx, narrativeService };
}

describe("SummaryPersistService", () => {
  // ---------------------------------------------------------------------------
  // persistSummary — fill 모드
  // ---------------------------------------------------------------------------
  describe("persistSummary (fill 모드)", () => {
    // Happy / branch: 동일 좌표 Summary 부재 → narrative+metricScore 결합 create.
    it("부재 시 narrative+metricScore 를 결합해 Summary 를 create 한다", async () => {
      const { service, prisma, tx, narrativeService } = buildHarness();
      tx.summary.findUnique.mockResolvedValue(null);
      tx.summary.create.mockResolvedValue({ id: "summary-1" });

      const results = [buildResult(), buildResult({ unitId: "commit:c:2" })];
      const result = await service.persistSummary(
        buildContext(),
        results,
        "fill",
        { modelId: MODEL_ID },
      );

      // narrative service 는 좌표당 정확히 1 회 호출 (modelId 전달).
      expect(narrativeService.generateBatchNarrative).toHaveBeenCalledTimes(1);
      expect(narrativeService.generateBatchNarrative).toHaveBeenCalledWith(
        buildContext(),
        results,
        { modelId: MODEL_ID },
      );
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.summary.delete).not.toHaveBeenCalled();

      const data = tx.summary.create.mock.calls[0][0].data;
      // narrative = mock narrative, metricScore = aggregateMetricScore 출력 정합.
      expect(data.narrative).toBe(MOCK_NARRATIVE);
      expect(data.metricScore).toBe(aggregateMetricScore(results));
      expect(data.personId).toBe("person-1");
      expect(data.period).toBe("week");
      expect(data.periodStart).toEqual(new Date("2026-06-01T00:00:00.000Z"));
      expect(result).toEqual({ summaryId: "summary-1", created: true });
    });

    // Happy + value-flow: deterministic aggregateMetricScore 의 **non-zero** 출력이
    // 실제로 create data.metricScore 로 흘러드는지 명시 검증 (T-0309 round-2 NIT).
    // 위 happy-path 는 `aggregateMetricScore(results)` 와의 equality 만 보므로 둘 다
    // 0 이어도 통과 — 본 it 은 non-empty 묶음의 산출값이 0 이 아님을 pin 해 "값이
    // 실제로 결합돼 영속된다" 를 외부 사실로 박제한다 (narrative 동반 검증).
    it("non-empty 묶음의 non-zero metricScore 가 create data 로 흘러든다", async () => {
      const { service, tx } = buildHarness();
      tx.summary.findUnique.mockResolvedValue(null);
      tx.summary.create.mockResolvedValue({ id: "summary-nz" });

      const results = [buildResult(), buildResult({ unitId: "commit:c:2" })];
      const expectedScore = aggregateMetricScore(results);
      // 가드: fixture 가 우연히 0 을 내면 본 검증이 무의미해지므로 사전 차단.
      expect(expectedScore).toBeGreaterThan(0);

      await service.persistSummary(buildContext(), results, "fill", {
        modelId: MODEL_ID,
      });

      const data = tx.summary.create.mock.calls[0][0].data;
      // deterministic non-zero metricScore + narrative 가 정확히 결합돼 create 됨.
      expect(data.metricScore).toBe(expectedScore);
      expect(data.metricScore).toBeGreaterThan(0);
      expect(data.narrative).toBe(MOCK_NARRATIVE);
    });

    // Branch: 동일 좌표 존재 → no-op (create/delete 모두 호출 안 됨, 기존 보존).
    it("존재 시 no-op (기존 보존, create 0)", async () => {
      const { service, tx } = buildHarness();
      tx.summary.findUnique.mockResolvedValue({ id: "summary-existing" });

      const result = await service.persistSummary(
        buildContext(),
        [buildResult()],
        "fill",
        { modelId: MODEL_ID },
      );

      expect(tx.summary.create).not.toHaveBeenCalled();
      expect(tx.summary.delete).not.toHaveBeenCalled();
      expect(result).toEqual({
        summaryId: "summary-existing",
        created: false,
      });
    });
  });

  // ---------------------------------------------------------------------------
  // persistSummary — reeval 모드
  // ---------------------------------------------------------------------------
  describe("persistSummary (reeval 모드)", () => {
    // Branch + reset-and-recreate ordering: 존재 → delete 후 create.
    it("존재 시 delete 후 create (reset-and-recreate, ordering 검증)", async () => {
      const { service, tx } = buildHarness();
      tx.summary.findUnique.mockResolvedValue({ id: "summary-old" });
      const callOrder: string[] = [];
      tx.summary.delete.mockImplementation(() => {
        callOrder.push("delete");
        return Promise.resolve({ id: "summary-old" });
      });
      tx.summary.create.mockImplementation(() => {
        callOrder.push("create");
        return Promise.resolve({ id: "summary-new" });
      });

      const result = await service.persistSummary(
        buildContext(),
        [buildResult()],
        "reeval",
        { modelId: MODEL_ID },
      );

      expect(tx.summary.delete).toHaveBeenCalledWith({
        where: { id: "summary-old" },
      });
      expect(tx.summary.create).toHaveBeenCalledTimes(1);
      // delete 가 create 보다 먼저 — atomic reset-and-recreate.
      expect(callOrder).toEqual(["delete", "create"]);
      expect(result).toEqual({ summaryId: "summary-new", created: true });
    });

    // Branch: 부재 → create only (delete 호출 안 됨).
    it("부재 시 delete 없이 create", async () => {
      const { service, tx } = buildHarness();
      tx.summary.findUnique.mockResolvedValue(null);
      tx.summary.create.mockResolvedValue({ id: "summary-fresh" });

      const result = await service.persistSummary(
        buildContext(),
        [buildResult()],
        "reeval",
        { modelId: MODEL_ID },
      );

      expect(tx.summary.delete).not.toHaveBeenCalled();
      expect(result.summaryId).toBe("summary-fresh");
      expect(result.created).toBe(true);
    });

    // findUnique 가 idempotency key 3-tuple 로 호출됨을 검증.
    it("idempotency key (personId, period, periodStart) 로 findUnique 한다", async () => {
      const { service, tx } = buildHarness();
      tx.summary.findUnique.mockResolvedValue(null);
      tx.summary.create.mockResolvedValue({ id: "x" });

      await service.persistSummary(buildContext(), [buildResult()], "reeval", {
        modelId: MODEL_ID,
      });

      const arg = tx.summary.findUnique.mock.calls[0][0];
      expect(arg.where.personId_period_periodStart).toEqual({
        personId: "person-1",
        period: "week",
        periodStart: new Date("2026-06-01T00:00:00.000Z"),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // error path
  // ---------------------------------------------------------------------------
  describe("error path", () => {
    // Error: narrative service reject → 전파 (swallow 0, write 진입 안 함).
    it("narrative service 가 reject 하면 전파하고 write 하지 않는다", async () => {
      const { service, prisma, narrativeService } = buildHarness();
      narrativeService.generateBatchNarrative.mockRejectedValue(
        new Error("LLM gateway 실패"),
      );

      await expect(
        service.persistSummary(buildContext(), [buildResult()], "reeval", {
          modelId: MODEL_ID,
        }),
      ).rejects.toThrow(/LLM gateway 실패/);
      // narrative 실패가 write 진입 전이라 $transaction 자체가 호출되지 않는다.
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    // Error: $transaction / create reject → 전파.
    it("create 가 reject 하면 그대로 전파한다", async () => {
      const { service, tx } = buildHarness();
      tx.summary.findUnique.mockResolvedValue(null);
      tx.summary.create.mockRejectedValue(new Error("db write 실패"));

      await expect(
        service.persistSummary(buildContext(), [buildResult()], "reeval", {
          modelId: MODEL_ID,
        }),
      ).rejects.toThrow(/db write 실패/);
    });

    // Error: P2002 (`@@unique` 위반 — reset-and-recreate 경합) → ConflictException 변환.
    it("P2002 발생 시 ConflictException 으로 변환한다", async () => {
      const { service, tx } = buildHarness();
      tx.summary.findUnique.mockResolvedValue(null);
      tx.summary.create.mockRejectedValue(buildPrismaError("P2002"));

      await expect(
        service.persistSummary(buildContext(), [buildResult()], "reeval", {
          modelId: MODEL_ID,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    // Negative: P2002 외 Prisma error (P2025) 는 그대로 propagate (잘못 삼키지 않음).
    it("P2002 외 Prisma error 는 그대로 propagate 한다", async () => {
      const { service, tx } = buildHarness();
      tx.summary.findUnique.mockResolvedValue(null);
      tx.summary.create.mockRejectedValue(buildPrismaError("P2025"));

      await expect(
        service.persistSummary(buildContext(), [buildResult()], "reeval", {
          modelId: MODEL_ID,
        }),
      ).rejects.toMatchObject({ code: "P2025" });
    });

    // Negative: code 필드 없는 일반 error 도 그대로 propagate (getPrismaErrorCode
    // undefined 분기 — ConflictException 으로 위장하지 않음).
    it("code 없는 일반 error 는 그대로 propagate 한다", async () => {
      const { service, tx } = buildHarness();
      tx.summary.findUnique.mockResolvedValue({ id: "old" });
      tx.summary.delete.mockRejectedValue(new Error("transaction aborted"));

      await expect(
        service.persistSummary(buildContext(), [buildResult()], "reeval", {
          modelId: MODEL_ID,
        }),
      ).rejects.toThrow(/transaction aborted/);
      // delete 실패로 트랜잭션 중단 — create 미호출 (이전 데이터 보존).
      expect(tx.summary.create).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // 빈 입력 negative case
  // ---------------------------------------------------------------------------
  describe("빈 results[] negative case", () => {
    // 빈 입력 → metricScore 0 (aggregateMetricScore 빈 입력 정합) + narrative 는 service
    // 위임. write 자체는 정상 진행 (시점 게이트는 caller 책임 — 본 service 는 무조건 write).
    it("빈 results 면 metricScore 0 + narrative 위임으로 create 한다", async () => {
      const { service, tx, narrativeService } = buildHarness();
      tx.summary.findUnique.mockResolvedValue(null);
      tx.summary.create.mockResolvedValue({ id: "empty-summary" });

      const result = await service.persistSummary(
        buildContext(),
        [],
        "reeval",
        {
          modelId: MODEL_ID,
        },
      );

      // narrative service 는 빈 묶음이어도 정확히 1 회 위임 호출.
      expect(narrativeService.generateBatchNarrative).toHaveBeenCalledTimes(1);
      const data = tx.summary.create.mock.calls[0][0].data;
      expect(data.metricScore).toBe(0);
      expect(data.narrative).toBe(MOCK_NARRATIVE);
      expect(result).toEqual({ summaryId: "empty-summary", created: true });
    });
  });

  // ---------------------------------------------------------------------------
  // resetByPeriod — partial-reset
  // ---------------------------------------------------------------------------
  describe("resetByPeriod (partial-reset)", () => {
    // Happy: deleteMany where { personId, period } 로 부분 삭제, count 반환.
    it("한 person 의 한 period Summary 만 일괄 삭제하고 count 를 반환한다", async () => {
      const { service, prisma } = buildHarness();
      prisma.summary.deleteMany.mockResolvedValue({ count: 4 });

      const count = await service.resetByPeriod("person-1", "month");

      expect(prisma.summary.deleteMany).toHaveBeenCalledWith({
        where: { personId: "person-1", period: "month" },
      });
      expect(count).toBe(4);
    });

    // Negative: 알 수 없는 period → throw (deleteMany 미호출, 오삭제 방지).
    it("알 수 없는 period 면 throw 하고 삭제하지 않는다", async () => {
      const { service, prisma } = buildHarness();

      await expect(service.resetByPeriod("person-1", "year")).rejects.toThrow(
        /알 수 없는 period/,
      );
      expect(prisma.summary.deleteMany).not.toHaveBeenCalled();
    });

    // Branch: 매칭 row 0 → count 0 (정상, throw 아님).
    it("매칭 row 0 이면 count 0 을 반환한다", async () => {
      const { service, prisma } = buildHarness();
      prisma.summary.deleteMany.mockResolvedValue({ count: 0 });

      const count = await service.resetByPeriod("person-x", "day");
      expect(count).toBe(0);
    });
  });
});
