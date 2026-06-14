// EvaluationResultPersistService spec — T-0300, ADR-0033 §Follow-ups 3 (write service).
// R-112 4 종 (happy / error / branch / negative 충분 cover, CLAUDE.md §3.2) + coverage
// line/function ≥ 80% 검증.
//
// PrismaService 를 Jest mock 으로 대체해 PostgreSQL container 없이 isolated 실행
// (assessment.service.spec.ts mock 패턴 mirror). `$transaction` mock 은 콜백을 즉시
// 실행하는 stub 으로, 콜백 내부의 tx delegate 에 전달되는 create/delete/findUnique 인자
// 정합성을 검증한다 (task Required Reading test/helpers/prisma-mock.ts 의 `$transaction`
// 즉시 실행 stub 의도 정합). 검증 포인트:
//   - persist (fill / reeval × 존재/부재 4 분기) + resetByPeriod 의 happy path.
//   - P2002 → ConflictException 변환 / reeval delete 경합 loser 의 P2025 → 409 변환
//     (T-0407) / 변환 범위 밖 error (P2003, create-side P2025) 는 그대로 propagate.
//   - NIT(a) — 알 수 없는 difficulty aggregate → 명시적 throw (매퍼 silent skip 비대칭 닫기).
//   - NIT(b) — Decimal 소수 2 자리 round 정책 (1/3 류 무한소수 경계값).
//   - negative: 빈 results[] (Assessment 1 + Contribution 0) / 트랜잭션 중단 시 propagate.
import { ConflictException } from "@nestjs/common";

import type { EvaluationResult } from "./domain/evaluation-result";
import type { EvaluationPersistContext } from "./domain/evaluation-result.persist.mapper";
import { EvaluationResultPersistService } from "./evaluation-result-persist.service";

// 유효 context 4-tuple — negative test 가 override 로 개별 축을 깬다.
function buildContext(
  overrides: Partial<EvaluationPersistContext> = {},
): EvaluationPersistContext {
  return {
    personId: "person-1",
    period: "week",
    scope: "commit",
    periodStart: new Date("2026-06-01T00:00:00.000Z"),
    ...overrides,
  };
}

// EvaluationResult fixture — commit prefix unitId (sourceType "commit" 도출),
// difficulty/contribution/volume 정상값. overrides 로 분기 구성.
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

// Prisma known error helper — duck typing `code` 식별 (prisma-mock.ts buildPrismaError
// 패턴 mirror, 실 PrismaClientKnownRequestError 생성 cost 회피).
function buildPrismaError(code: string, message = "prisma-error"): Error {
  return Object.assign(new Error(message), { code });
}

// tx delegate mock — $transaction 콜백이 받는 assessment delegate.
interface TxMock {
  assessment: {
    findUnique: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
  };
}

// PrismaService mock factory — `$transaction` 는 콜백을 즉시 tx mock 으로 실행하는
// stub, `assessment.deleteMany` 는 resetByPeriod 용. service 생성자가 PrismaService 만
// 주입받으므로 본 mock 을 `as unknown as` 로 캐스팅해 주입.
function buildPrismaMock(): {
  service: EvaluationResultPersistService;
  prisma: {
    $transaction: jest.Mock;
    assessment: { deleteMany: jest.Mock };
  };
  tx: TxMock;
} {
  const tx: TxMock = {
    assessment: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  };
  const prisma = {
    // 콜백을 즉시 tx mock 으로 실행 — 트랜잭션 경계 안의 호출 인자를 검증 가능.
    $transaction: jest.fn((cb: (t: TxMock) => unknown): unknown => cb(tx)),
    assessment: { deleteMany: jest.fn() },
  };
  const service = new EvaluationResultPersistService(
    prisma as unknown as ConstructorParameters<
      typeof EvaluationResultPersistService
    >[0],
  );
  return { service, prisma, tx };
}

describe("EvaluationResultPersistService", () => {
  // ---------------------------------------------------------------------------
  // persist — fill 모드
  // ---------------------------------------------------------------------------
  describe("persist (fill 모드)", () => {
    // Happy / branch: 동일 key Assessment 부재 → create.
    it("부재 시 Assessment+Contribution 을 nested create 한다", async () => {
      const { service, prisma, tx } = buildPrismaMock();
      tx.assessment.findUnique.mockResolvedValue(null);
      tx.assessment.create.mockResolvedValue({ id: "assess-1" });

      const result = await service.persist(
        buildContext(),
        [buildResult(), buildResult({ unitId: "commit:com/sec:def456" })],
        "fill",
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.assessment.delete).not.toHaveBeenCalled();
      expect(tx.assessment.create).toHaveBeenCalledTimes(1);
      const createArg = tx.assessment.create.mock.calls[0][0];
      // nested contributions.create 로 N 건 주입 (assessmentId 는 nested write 가 연결).
      expect(createArg.data.contributions.create).toHaveLength(2);
      expect(result).toEqual({
        assessmentId: "assess-1",
        contributionCount: 2,
      });
    });

    // Branch: 동일 key 존재 → no-op (create/delete 모두 호출 안 됨, 기존 보존).
    it("존재 시 no-op (기존 보존, contributionCount 0)", async () => {
      const { service, prisma, tx } = buildPrismaMock();
      tx.assessment.findUnique.mockResolvedValue({ id: "assess-existing" });

      const result = await service.persist(
        buildContext(),
        [buildResult()],
        "fill",
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.assessment.create).not.toHaveBeenCalled();
      expect(tx.assessment.delete).not.toHaveBeenCalled();
      expect(result).toEqual({
        assessmentId: "assess-existing",
        contributionCount: 0,
      });
    });
  });

  // ---------------------------------------------------------------------------
  // persist — reeval 모드
  // ---------------------------------------------------------------------------
  describe("persist (reeval 모드)", () => {
    // Branch: 존재 → delete (cascade) + create (reset-and-recreate).
    it("존재 시 delete 후 create (reset-and-recreate)", async () => {
      const { service, tx } = buildPrismaMock();
      tx.assessment.findUnique.mockResolvedValue({ id: "assess-old" });
      tx.assessment.create.mockResolvedValue({ id: "assess-new" });

      const result = await service.persist(
        buildContext(),
        [buildResult()],
        "reeval",
      );

      expect(tx.assessment.delete).toHaveBeenCalledWith({
        where: { id: "assess-old" },
      });
      expect(tx.assessment.create).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        assessmentId: "assess-new",
        contributionCount: 1,
      });
    });

    // Branch: 부재 → create only (delete 호출 안 됨).
    it("부재 시 delete 없이 create", async () => {
      const { service, tx } = buildPrismaMock();
      tx.assessment.findUnique.mockResolvedValue(null);
      tx.assessment.create.mockResolvedValue({ id: "assess-fresh" });

      const result = await service.persist(
        buildContext(),
        [buildResult()],
        "reeval",
      );

      expect(tx.assessment.delete).not.toHaveBeenCalled();
      expect(result.assessmentId).toBe("assess-fresh");
    });

    // findUnique 가 idempotency key 4-tuple 로 호출됨을 검증.
    it("idempotency key 4-tuple 로 findUnique 한다", async () => {
      const { service, tx } = buildPrismaMock();
      tx.assessment.findUnique.mockResolvedValue(null);
      tx.assessment.create.mockResolvedValue({ id: "x" });

      await service.persist(buildContext(), [buildResult()], "reeval");

      const arg = tx.assessment.findUnique.mock.calls[0][0];
      expect(arg.where.personId_period_scope_periodStart).toEqual({
        personId: "person-1",
        period: "week",
        scope: "commit",
        periodStart: new Date("2026-06-01T00:00:00.000Z"),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // NIT(b) — Decimal precision/rounding 정책
  // ---------------------------------------------------------------------------
  describe("Decimal round 정책 (NIT b)", () => {
    // 무한소수 평균 (high=3, low=1, zero=0 → 평균 4/3 = 1.333…) → 소수 2 자리 round.
    it("contributionScore 평균을 소수 2 자리로 round 한다", async () => {
      const { service, tx } = buildPrismaMock();
      tx.assessment.findUnique.mockResolvedValue(null);
      tx.assessment.create.mockResolvedValue({ id: "x" });

      await service.persist(
        buildContext(),
        [
          buildResult({ contribution: "high", unitId: "commit:i:1" }),
          buildResult({ contribution: "low", unitId: "commit:i:2" }),
          buildResult({ contribution: "zero", unitId: "commit:i:3" }),
        ],
        "reeval",
      );

      const data = tx.assessment.create.mock.calls[0][0].data;
      // (3+1+0)/3 = 1.3333… → 1.33.
      expect(data.contributionScore).toBe(1.33);
    });

    // 각 component Contribution 의 score 도 round (정수 score 는 round 후에도 정수 유지).
    it("component Contribution score 도 정책 round 를 거친다", async () => {
      const { service, tx } = buildPrismaMock();
      tx.assessment.findUnique.mockResolvedValue(null);
      tx.assessment.create.mockResolvedValue({ id: "x" });

      await service.persist(
        buildContext(),
        [buildResult({ contribution: "medium" })],
        "reeval",
      );

      const contributions =
        tx.assessment.create.mock.calls[0][0].data.contributions.create;
      // medium → 2 (round(2)=2).
      expect(contributions[0].contributionScore).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // NIT(a) — difficulty unknown 값 정책 + error path
  // ---------------------------------------------------------------------------
  describe("aggregate 검증 정책 (NIT a) + error path", () => {
    // Negative: 알 수 없는 difficulty (타입 우회) aggregate → 명시적 throw (매퍼의 silent
    // skip 비대칭을 service 진입에서 닫는다). create 는 호출 안 됨.
    it("알 수 없는 difficulty aggregate 면 throw 하고 영속화하지 않는다", async () => {
      const { service, prisma } = buildPrismaMock();
      const bad = buildResult({
        difficulty: "impossible" as EvaluationResult["difficulty"],
      });

      await expect(
        service.persist(buildContext(), [bad], "reeval"),
      ).rejects.toThrow(/알 수 없는 difficulty/);
      // 검증이 트랜잭션 진입 전이라 $transaction 자체가 호출되지 않는다.
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    // Negative: 알 수 없는 scope context → throw.
    it("알 수 없는 scope 면 throw 한다", async () => {
      const { service } = buildPrismaMock();
      await expect(
        service.persist(
          buildContext({ scope: "bogus" }),
          [buildResult()],
          "fill",
        ),
      ).rejects.toThrow(/알 수 없는 scope/);
    });

    // Error: P2002 (`@@unique` 위반) → ConflictException 변환.
    it("P2002 발생 시 ConflictException 으로 변환한다", async () => {
      const { service, tx } = buildPrismaMock();
      tx.assessment.findUnique.mockResolvedValue(null);
      tx.assessment.create.mockRejectedValue(buildPrismaError("P2002"));

      await expect(
        service.persist(buildContext(), [buildResult()], "reeval"),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    // Negative: 변환 대상이 아닌 Prisma error (P2003 FK 위반) 는 그대로 propagate
    // (잘못 삼키지 않음). P2002 / reeval-race P2025 외의 모든 코드는 전파 의도 보존.
    it("변환 대상이 아닌 Prisma error (P2003) 는 그대로 propagate 한다", async () => {
      const { service, tx } = buildPrismaMock();
      tx.assessment.findUnique.mockResolvedValue(null);
      tx.assessment.create.mockRejectedValue(buildPrismaError("P2003"));

      await expect(
        service.persist(buildContext(), [buildResult()], "reeval"),
      ).rejects.toMatchObject({ code: "P2003" });
    });

    // Negative: create-side(reeval delete 경로 밖)의 P2025 는 그대로 propagate — P2025
    // 변환은 reeval delete 경합에 국소화돼 있으므로, delete 가 호출되지 않는 부재 경로의
    // create reject 는 무차별 삼키지 않는다 (변환 범위가 좁음을 실증, AC "예기치 못한
    // error 무차별 삼킴 0").
    it("reeval delete 경로 밖의 P2025 (create reject) 는 그대로 propagate 한다", async () => {
      const { service, tx } = buildPrismaMock();
      // 좌표 부재 → delete 미호출 → create 가 P2025 reject.
      tx.assessment.findUnique.mockResolvedValue(null);
      tx.assessment.create.mockRejectedValue(buildPrismaError("P2025"));

      await expect(
        service.persist(buildContext(), [buildResult()], "reeval"),
      ).rejects.toMatchObject({ code: "P2025" });
      expect(tx.assessment.delete).not.toHaveBeenCalled();
    });

    // Regression (T-0407, R-112 patch 룰): 동시 reevaluate delete 경합 시 loser 의 delete
    // 가 P2025 ("No record found for a delete") 를 던지면 ConflictException(409) 으로
    // 변환된다. winner 가 row 를 먼저 삭제한 race 의 정상 수렴 — 결함 (P2025 → 500 누수)
    // 이 재발하면 이 test 가 fail 한다. P2025 → 409.
    it("동시 reevaluate delete 경합 시 loser 의 P2025 를 ConflictException(409) 으로 변환한다", async () => {
      const { service, tx } = buildPrismaMock();
      // 좌표 존재 → reeval delete 진입, 그러나 winner 가 먼저 삭제 → delete 가 P2025 reject.
      tx.assessment.findUnique.mockResolvedValue({ id: "assess-raced" });
      tx.assessment.delete.mockRejectedValue(buildPrismaError("P2025"));

      await expect(
        service.persist(buildContext(), [buildResult()], "reeval"),
      ).rejects.toBeInstanceOf(ConflictException);
      // delete 가 P2025 로 중단 → create 는 호출되지 않는다 (loser 는 영속화 0, winner 보존).
      expect(tx.assessment.create).not.toHaveBeenCalled();
    });

    // Negative: 트랜잭션 중단 (delete 실패) 시 error propagate — 이전 데이터 보존
    // (create 가 호출 안 됨). atomicity 보장의 R-112 negative case.
    it("트랜잭션 중단 시 throw propagate (create 미호출 — 이전 데이터 보존)", async () => {
      const { service, tx } = buildPrismaMock();
      tx.assessment.findUnique.mockResolvedValue({ id: "old" });
      tx.assessment.delete.mockRejectedValue(new Error("transaction aborted"));

      await expect(
        service.persist(buildContext(), [buildResult()], "reeval"),
      ).rejects.toThrow(/transaction aborted/);
      expect(tx.assessment.create).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // persist — 빈 입력 negative case
  // ---------------------------------------------------------------------------
  describe("빈 results[] negative case", () => {
    // 빈 입력 → Assessment 1 (difficulty 기본 "easy" / score 0) + Contribution 0 의
    // 결정적 처리. difficulty "easy" 는 유효 집합 멤버라 throw 안 됨.
    it("빈 results 면 Assessment 1 + Contribution 0 으로 create", async () => {
      const { service, tx } = buildPrismaMock();
      tx.assessment.findUnique.mockResolvedValue(null);
      tx.assessment.create.mockResolvedValue({ id: "empty-assess" });

      const result = await service.persist(buildContext(), [], "reeval");

      const data = tx.assessment.create.mock.calls[0][0].data;
      expect(data.difficulty).toBe("easy");
      expect(data.contributionScore).toBe(0);
      expect(data.contributions.create).toHaveLength(0);
      expect(result).toEqual({
        assessmentId: "empty-assess",
        contributionCount: 0,
      });
    });
  });

  // ---------------------------------------------------------------------------
  // resetByPeriod — partial-reset
  // ---------------------------------------------------------------------------
  describe("resetByPeriod (partial-reset)", () => {
    // Happy: deleteMany where { personId, period } 로 부분 삭제, count 반환.
    it("한 person 의 한 period Assessment 만 일괄 삭제하고 count 를 반환한다", async () => {
      const { service, prisma } = buildPrismaMock();
      prisma.assessment.deleteMany.mockResolvedValue({ count: 3 });

      const count = await service.resetByPeriod("person-1", "month");

      expect(prisma.assessment.deleteMany).toHaveBeenCalledWith({
        where: { personId: "person-1", period: "month" },
      });
      expect(count).toBe(3);
    });

    // Negative: 알 수 없는 period → throw (deleteMany 미호출, 오삭제 방지).
    it("알 수 없는 period 면 throw 하고 삭제하지 않는다", async () => {
      const { service, prisma } = buildPrismaMock();

      await expect(service.resetByPeriod("person-1", "year")).rejects.toThrow(
        /알 수 없는 period/,
      );
      expect(prisma.assessment.deleteMany).not.toHaveBeenCalled();
    });

    // Branch: 매칭 row 0 → count 0 (정상, throw 아님).
    it("매칭 row 0 이면 count 0 을 반환한다", async () => {
      const { service, prisma } = buildPrismaMock();
      prisma.assessment.deleteMany.mockResolvedValue({ count: 0 });

      const count = await service.resetByPeriod("person-x", "day");
      expect(count).toBe(0);
    });
  });
});
