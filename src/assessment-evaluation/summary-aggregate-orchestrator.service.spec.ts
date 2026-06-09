// SummaryAggregateOrchestratorService spec — T-0310, ADR-0035 §Follow-ups orchestrator
// slice. R-112 4 종(happy / error / branch / negative 충분 cover, CLAUDE.md §3.2) 검증.
// SummaryPersistService 는 mock { persistSummary: jest.fn() } 으로 주입 — 실 LLM 호출
// 0 / 실 DB write 0 / live credential 0. `isPeriodEvaluable` 는 real 순수 함수를 그대로
// 쓴다(periodStart / now 를 주입받는 결정적 함수라 mocked 불요 — 게이트 분기를 실제
// 시점 산술로 검증). 본 orchestrator 는 thin compose(시점 게이트 → persistSummary 위임
// → typed surface 반환)라, 게이트 함수의 시점 산술은 period-evaluable.spec.ts 가 검증하고
// 본 spec 은 compose 의 정합(게이트 분기 → persist 호출 여부·인자·횟수 → error 전파 →
// mode 전달 → 빈 묶음 경계)을 cover 한다.
import { ConflictException } from "@nestjs/common";

import type { EvaluationResult } from "./domain/evaluation-result";
import type { SummaryBatchContext } from "./domain/summary-batch-prompt";
import type { PersistMode } from "./evaluation-result-persist.service";
import { SummaryAggregateOrchestratorService } from "./summary-aggregate-orchestrator.service";
import {
  SummaryPersistService,
  type SummaryPersistOptions,
  type SummaryPersistResult,
} from "./summary-persist.service";

// SummaryBatchContext fixture — period / periodStart override 로 시점 게이트 분기를
// 구성한다. periodStart 는 UTC 월초/주초/일초 자정으로 둔다(period-evaluable 계약 정합).
function context(
  overrides: Partial<SummaryBatchContext> = {},
): SummaryBatchContext {
  return {
    personId: "person-1",
    period: "day",
    periodStart: new Date("2026-06-01T00:00:00Z"),
    ...overrides,
  };
}

// EvaluationResult fixture — orchestrator 는 results 를 그대로 persistSummary 에 흘려
// 보내므로(자체 변형 0), 내용보다 "전달 정합"이 검증 대상이다.
function resultFor(unitId: string): EvaluationResult {
  return {
    unitId,
    narrative: `narrative for ${unitId}`,
    difficulty: "medium",
    contribution: "medium",
    volume: 0,
  };
}

const OPTIONS: SummaryPersistOptions = { modelId: "gpt-4o-deploy" };

// mock persist 응답 — orchestrator 는 이 결과를 evaluated:true 와 함께 그대로 반환한다.
function persistResult(
  overrides: Partial<SummaryPersistResult> = {},
): SummaryPersistResult {
  return { summaryId: "summary-1", created: true, ...overrides };
}

// mock SummaryPersistService factory — persistSummary 는 jest.fn 으로 주입(실 호출 0).
// 기본은 persistResult() 를 resolve 한다. 각 테스트가 mockRejectedValueOnce 등으로 override.
function makePersistService(): { persistSummary: jest.Mock } {
  return {
    persistSummary: jest.fn().mockResolvedValue(persistResult()),
  };
}

// orchestrator + mock persist service 직접 생성(new Service(mock)) — sibling
// service spec(EvaluationOrchestratorService)의 direct-construction idiom mirror
// (생성자 의존이 summaryPersistService 단일이라 Test.createTestingModule 불요).
function makeOrchestrator(persistService: {
  persistSummary: jest.Mock;
}): SummaryAggregateOrchestratorService {
  return new SummaryAggregateOrchestratorService(
    persistService as unknown as SummaryPersistService,
  );
}

describe("SummaryAggregateOrchestratorService", () => {
  describe("happy-path — 평가 가능 구간 → persistSummary 위임 → evaluated:true", () => {
    it("now ≥ periodEnd(day) 면 persistSummary 1 회 호출 + 결과를 evaluated:true 와 반환", async () => {
      const persist = makePersistService();
      const expected = persistResult({ summaryId: "s-happy", created: true });
      persist.persistSummary.mockResolvedValueOnce(expected);
      const orchestrator = makeOrchestrator(persist);
      const ctx = context({
        period: "day",
        periodStart: new Date("2026-06-01T00:00:00Z"),
      });
      const results = [resultFor("u-1")];
      // periodEnd = 2026-06-02T00:00:00Z. now = 그 이후 → 평가 가능.
      const now = new Date("2026-06-02T00:00:00Z");

      const outcome = await orchestrator.evaluateAndPersist(
        ctx,
        results,
        "fill",
        OPTIONS,
        now,
      );

      expect(outcome.evaluated).toBe(true);
      expect(outcome.result).toBe(expected);
      expect(persist.persistSummary).toHaveBeenCalledTimes(1);
    });

    it("persistSummary 에 (context, results, mode, options) 가 그대로 전달된다", async () => {
      const persist = makePersistService();
      const orchestrator = makeOrchestrator(persist);
      const ctx = context({
        period: "week",
        periodStart: new Date("2026-06-01T00:00:00Z"),
      });
      const results = [resultFor("u-a"), resultFor("u-b")];
      // periodEnd(week) = 2026-06-08T00:00:00Z → now 그 이후.
      const now = new Date("2026-06-09T00:00:00Z");

      await orchestrator.evaluateAndPersist(
        ctx,
        results,
        "reeval",
        OPTIONS,
        now,
      );

      expect(persist.persistSummary).toHaveBeenCalledWith(
        ctx,
        results,
        "reeval",
        OPTIONS,
      );
      // 인자 동일성(참조 그대로) — orchestrator 가 사본을 만들지 않는다.
      const [ctxArg, resultsArg, , optionsArg] =
        persist.persistSummary.mock.calls[0];
      expect(ctxArg).toBe(ctx);
      expect(resultsArg).toBe(results);
      expect(optionsArg).toBe(OPTIONS);
    });
  });

  describe("시점 게이트 분기 1 — 미평가(now < periodEnd) → persist 미호출 + evaluated:false", () => {
    it.each([
      ["day", "2026-06-01T00:00:00Z", "2026-06-01T23:59:59Z"],
      ["week", "2026-06-01T00:00:00Z", "2026-06-07T23:59:59Z"],
      ["month", "2026-06-01T00:00:00Z", "2026-06-30T23:59:59Z"],
    ])(
      "%s 진행 중 구간(now < periodEnd) 이면 persistSummary 호출 0, evaluated:false",
      async (period, periodStart, now) => {
        const persist = makePersistService();
        const orchestrator = makeOrchestrator(persist);

        const outcome = await orchestrator.evaluateAndPersist(
          context({ period, periodStart: new Date(periodStart) }),
          [resultFor("u-1")],
          "fill",
          OPTIONS,
          new Date(now),
        );

        expect(outcome.evaluated).toBe(false);
        expect(outcome.result).toBeUndefined();
        expect(persist.persistSummary).not.toHaveBeenCalled();
      },
    );
  });

  describe("시점 게이트 분기 2 — 평가 가능(now ≥ periodEnd, 경계 포함) → persist 위임", () => {
    it.each([
      // 종료 직후(now == periodEnd) 부터 평가 가능(반열림 [start, end) 경계 포함).
      ["day", "2026-06-01T00:00:00Z", "2026-06-02T00:00:00Z"],
      ["week", "2026-06-01T00:00:00Z", "2026-06-08T00:00:00Z"],
      ["month", "2026-06-01T00:00:00Z", "2026-07-01T00:00:00Z"],
    ])(
      "%s 종료 직후(now == periodEnd) 이면 persistSummary 위임 + evaluated:true",
      async (period, periodStart, now) => {
        const persist = makePersistService();
        const orchestrator = makeOrchestrator(persist);

        const outcome = await orchestrator.evaluateAndPersist(
          context({ period, periodStart: new Date(periodStart) }),
          [resultFor("u-1")],
          "reeval",
          OPTIONS,
          new Date(now),
        );

        expect(outcome.evaluated).toBe(true);
        expect(persist.persistSummary).toHaveBeenCalledTimes(1);
      },
    );
  });

  describe("fill / reeval mode 전달 정합 — 받은 mode 를 그대로 위임", () => {
    it.each<PersistMode>(["fill", "reeval"])(
      "mode=%s 가 persistSummary 에 그대로 전달된다",
      async (mode) => {
        const persist = makePersistService();
        const orchestrator = makeOrchestrator(persist);
        // periodEnd(day) = 2026-06-02T00:00:00Z 이후 → 평가 가능.
        await orchestrator.evaluateAndPersist(
          context({ period: "day" }),
          [resultFor("u-1")],
          mode,
          OPTIONS,
          new Date("2026-06-03T00:00:00Z"),
        );

        expect(persist.persistSummary).toHaveBeenCalledTimes(1);
        expect(persist.persistSummary.mock.calls[0][2]).toBe(mode);
      },
    );
  });

  describe("error path 1 — persistSummary reject 시 전파(swallow 0, 실패 격리)", () => {
    it("persistSummary 가 ConflictException 으로 reject 하면 orchestrator 가 그대로 throw", async () => {
      const persist = makePersistService();
      const boom = new ConflictException("요약 평가가 이미 존재한다");
      persist.persistSummary.mockRejectedValueOnce(boom);
      const orchestrator = makeOrchestrator(persist);
      // periodEnd(day) 이후 → 게이트 통과 후 persist 위임에서 reject.
      await expect(
        orchestrator.evaluateAndPersist(
          context({ period: "day" }),
          [resultFor("u-1")],
          "reeval",
          OPTIONS,
          new Date("2026-06-02T00:00:00Z"),
        ),
      ).rejects.toThrow(boom);
      expect(persist.persistSummary).toHaveBeenCalledTimes(1);
    });

    it("persistSummary 가 일반 Error 로 reject 해도 그대로 전파(부분 성공 위장 0)", async () => {
      const persist = makePersistService();
      persist.persistSummary.mockRejectedValueOnce(
        new Error("LLM narrative 생성 실패 (status: 503)"),
      );
      const orchestrator = makeOrchestrator(persist);

      await expect(
        orchestrator.evaluateAndPersist(
          context({ period: "day" }),
          [resultFor("u-1")],
          "fill",
          OPTIONS,
          new Date("2026-06-02T00:00:00Z"),
        ),
      ).rejects.toThrow("LLM narrative 생성 실패 (status: 503)");
    });
  });

  describe("error path 2(negative) — 알 수 없는 period → 게이트 throw 전파 + persist 미호출", () => {
    it("period 가 VALID_PERIODS 밖(year) 이면 isPeriodEvaluable → computePeriodEnd 가 throw", async () => {
      const persist = makePersistService();
      const orchestrator = makeOrchestrator(persist);

      await expect(
        orchestrator.evaluateAndPersist(
          context({ period: "year" }),
          [resultFor("u-1")],
          "fill",
          OPTIONS,
          new Date("2027-01-01T00:00:00Z"),
        ),
      ).rejects.toThrow(/알 수 없는 period/);
      // 게이트가 먼저 throw → persist 미호출(게이트 우선).
      expect(persist.persistSummary).not.toHaveBeenCalled();
    });

    it.each(["", "hour", "quarter"])(
      "알 수 없는 period(%j) 도 throw 전파 + persist 미호출",
      async (period) => {
        const persist = makePersistService();
        const orchestrator = makeOrchestrator(persist);

        await expect(
          orchestrator.evaluateAndPersist(
            context({ period }),
            [resultFor("u-1")],
            "reeval",
            OPTIONS,
            new Date("2027-01-01T00:00:00Z"),
          ),
        ).rejects.toThrow();
        expect(persist.persistSummary).not.toHaveBeenCalled();
      },
    );
  });

  describe("negative — 빈 묶음 / 위임 횟수 정합", () => {
    it("results 가 빈 배열이어도 게이트 통과 시 persistSummary 위임(빈 묶음 reject 0)", async () => {
      const persist = makePersistService();
      const orchestrator = makeOrchestrator(persist);
      const empty: EvaluationResult[] = [];
      // periodEnd(month) 이후 → 평가 가능.
      const outcome = await orchestrator.evaluateAndPersist(
        context({ period: "month" }),
        empty,
        "fill",
        OPTIONS,
        new Date("2026-07-01T00:00:00Z"),
      );

      expect(outcome.evaluated).toBe(true);
      expect(persist.persistSummary).toHaveBeenCalledTimes(1);
      // 빈 배열이 그대로 전달된다(orchestrator 가 빈 묶음을 거르지 않는다).
      expect(persist.persistSummary.mock.calls[0][1]).toBe(empty);
    });

    it("빈 묶음 + 미평가 구간이면 persist 호출 0, evaluated:false(게이트 우선)", async () => {
      const persist = makePersistService();
      const orchestrator = makeOrchestrator(persist);

      const outcome = await orchestrator.evaluateAndPersist(
        context({ period: "day" }),
        [],
        "fill",
        OPTIONS,
        // periodEnd(day) = 2026-06-02T00:00:00Z 이전 → 미평가.
        new Date("2026-06-01T12:00:00Z"),
      );

      expect(outcome.evaluated).toBe(false);
      expect(persist.persistSummary).not.toHaveBeenCalled();
    });

    it("평가 가능 구간에서 persistSummary 가 정확히 1 회만 호출된다(중복 위임 0)", async () => {
      const persist = makePersistService();
      const orchestrator = makeOrchestrator(persist);

      await orchestrator.evaluateAndPersist(
        context({ period: "day" }),
        [resultFor("u-1"), resultFor("u-2")],
        "reeval",
        OPTIONS,
        new Date("2026-06-02T00:00:00Z"),
      );

      expect(persist.persistSummary).toHaveBeenCalledTimes(1);
    });
  });
});
