// summary-batch-run.spec — runSummaryBatchPlan(plan, evaluator, now) 순수 async
// helper 의 R-112 단위 검증(happy / error / branch·flow / negative 충분 cover /
// 결정성·비변형 invariant). 실 LLM/DB/service 0 — evaluator 는 jest mock 또는 spy
// 부착 async function. SummaryBatchPlanEntry 는 최소 stub(필드 형태만 충족).

import type { SummaryAggregateResult } from "../summary-aggregate-orchestrator.service";

import type { SummaryBatchPlanEntry } from "./summary-batch-plan";
import {
  runSummaryBatchPlan,
  type SummaryBatchEvaluator,
} from "./summary-batch-run";

// 고정 Date instance — 모든 좌표가 같은 판정 기준을 공유함을 검증할 기준 시각.
const NOW = new Date("2026-06-24T00:00:00.000Z");

// makeEntry — plan entry 최소 stub. context/results/mode/options 필드 형태만 충족
// (periodStart 는 고정 Date instance). 실 좌표/results 도출 0 — helper 는 entry 를
// evaluator 에 그대로 흘리기만 하므로 내용물의 의미는 검증에 무관(period 만 식별 축).
function makeEntry(period: string): SummaryBatchPlanEntry {
  return {
    context: {
      personId: `p-${period}`,
      period,
      periodStart: new Date("2026-06-01T00:00:00.000Z"),
    },
    results: [],
    mode: "fill",
    options: { modelId: "test-model" },
  };
}

// makeResult — SummaryAggregateResult stub helper. evaluated/created 분기 cover 용.
function makeResult(
  evaluated: boolean,
  created?: boolean,
): SummaryAggregateResult {
  if (!evaluated) {
    return { evaluated: false };
  }
  return {
    evaluated: true,
    result: { summaryId: `s-${String(created)}`, created: created ?? true },
  };
}

describe("runSummaryBatchPlan", () => {
  describe("happy path", () => {
    it("plan 3 개(day/week/month) 를 등장 순서대로 순차 평가해 index 1:1 outcomes 반환 + evaluator 인자/호출횟수 정합", async () => {
      const plan = [makeEntry("day"), makeEntry("week"), makeEntry("month")];
      // period 에 따라 결정적으로 다른 result 를 반환하는 mock evaluator.
      const evaluator = jest.fn<
        Promise<SummaryAggregateResult>,
        [SummaryBatchPlanEntry, Date]
      >(async (entry) => {
        if (entry.context.period === "day") return makeResult(true, true);
        if (entry.context.period === "week") return makeResult(true, false);
        return makeResult(false);
      });

      const outcomes = await runSummaryBatchPlan(plan, evaluator, NOW);

      // 길이·순서 1:1 정합.
      expect(outcomes).toHaveLength(plan.length);
      expect(outcomes[0]).toEqual(makeResult(true, true));
      expect(outcomes[1]).toEqual(makeResult(true, false));
      expect(outcomes[2]).toEqual(makeResult(false));

      // 호출 횟수 === plan.length, 각 호출 인자 === (plan[i], NOW).
      expect(evaluator).toHaveBeenCalledTimes(plan.length);
      plan.forEach((entry, i) => {
        expect(evaluator).toHaveBeenNthCalledWith(i + 1, entry, NOW);
      });
    });

    it("loop 동안 모든 좌표에 동일 now instance 를 그대로 전달한다(같은 batch fire 동일 판정 기준)", async () => {
      const plan = [makeEntry("day"), makeEntry("week")];
      const seenNows: Date[] = [];
      const evaluator: SummaryBatchEvaluator = async (_entry, now) => {
        seenNows.push(now);
        return makeResult(true, true);
      };

      await runSummaryBatchPlan(plan, evaluator, NOW);

      // 같은 reference — helper 가 재계산/복제 없이 동일 instance 를 흘린다.
      expect(seenNows).toHaveLength(2);
      expect(seenNows[0]).toBe(NOW);
      expect(seenNows[1]).toBe(NOW);
    });
  });

  describe("error path — fail-fast 입력 검증(한국어 TypeError)", () => {
    const okEvaluator: SummaryBatchEvaluator = async () => makeResult(true);

    it("plan 이 null 이면 한국어 TypeError (evaluator 호출 0)", async () => {
      const evaluator = jest.fn(okEvaluator);
      await expect(
        runSummaryBatchPlan(null as never, evaluator, NOW),
      ).rejects.toThrow(TypeError);
      await expect(
        runSummaryBatchPlan(null as never, evaluator, NOW),
      ).rejects.toThrow("plan 배열이 null/undefined 일 수 없다.");
      expect(evaluator).not.toHaveBeenCalled();
    });

    it("plan 이 undefined 이면 한국어 TypeError", async () => {
      await expect(
        runSummaryBatchPlan(undefined as never, okEvaluator, NOW),
      ).rejects.toThrow("plan 배열이 null/undefined 일 수 없다.");
    });

    it("evaluator 가 null 이면 한국어 TypeError", async () => {
      await expect(
        runSummaryBatchPlan([makeEntry("day")], null as never, NOW),
      ).rejects.toThrow("evaluator 는 함수여야 한다.");
    });

    it("evaluator 가 undefined 이면 한국어 TypeError", async () => {
      await expect(
        runSummaryBatchPlan([makeEntry("day")], undefined as never, NOW),
      ).rejects.toThrow("evaluator 는 함수여야 한다.");
    });

    it.each([
      ["빈 객체", {}],
      ["숫자 0", 0],
      ["문자열", "x"],
    ])(
      "evaluator 가 함수가 아닌 값(%s)이면 한국어 TypeError",
      async (_label, bad) => {
        await expect(
          runSummaryBatchPlan([makeEntry("day")], bad as never, NOW),
        ).rejects.toThrow("evaluator 는 함수여야 한다.");
      },
    );

    it("now 가 null 이면 한국어 TypeError", async () => {
      await expect(
        runSummaryBatchPlan([makeEntry("day")], okEvaluator, null as never),
      ).rejects.toThrow("now 는 Date 여야 한다.");
    });

    it.each([
      ["undefined", undefined],
      ["문자열", "2026-06-24"],
      ["epoch number", 1_700_000_000_000],
    ])(
      "now 가 Date 가 아닌 값(%s)이면 한국어 TypeError (evaluator 호출 0)",
      async (_label, bad) => {
        const evaluator = jest.fn(okEvaluator);
        await expect(
          runSummaryBatchPlan([makeEntry("day")], evaluator, bad as never),
        ).rejects.toThrow("now 는 Date 여야 한다.");
        expect(evaluator).not.toHaveBeenCalled();
      },
    );
  });

  describe("flow / branch 분기 cover", () => {
    it("(a) plan 빈 배열 → 빈 outcomes 반환 + evaluator 호출 0 (throw 0)", async () => {
      const evaluator = jest.fn(
        async () => makeResult(true) as SummaryAggregateResult,
      );
      const outcomes = await runSummaryBatchPlan([], evaluator, NOW);
      expect(outcomes).toEqual([]);
      expect(evaluator).not.toHaveBeenCalled();
    });

    it("(b) evaluator 가 모두 evaluated=true → outcomes 전부 evaluated=true", async () => {
      const plan = [makeEntry("day"), makeEntry("week")];
      const evaluator: SummaryBatchEvaluator = async () =>
        makeResult(true, true);
      const outcomes = await runSummaryBatchPlan(plan, evaluator, NOW);
      expect(outcomes).toHaveLength(2);
      expect(outcomes.every((o) => o.evaluated === true)).toBe(true);
    });

    it("(c) evaluator 가 모두 evaluated=false → outcomes 전부 evaluated=false", async () => {
      const plan = [makeEntry("day"), makeEntry("week")];
      const evaluator: SummaryBatchEvaluator = async () => makeResult(false);
      const outcomes = await runSummaryBatchPlan(plan, evaluator, NOW);
      expect(outcomes).toHaveLength(2);
      expect(outcomes.every((o) => o.evaluated === false)).toBe(true);
    });

    it("(d) evaluator 가 중간(index 1)에서 reject → error 전파 + outcomes 미반환 + 이후 호출 0(순차 중단)", async () => {
      const plan = [makeEntry("day"), makeEntry("week"), makeEntry("month")];
      const boom = new Error("좌표 평가 실패");
      const evaluator = jest.fn<
        Promise<SummaryAggregateResult>,
        [SummaryBatchPlanEntry, Date]
      >(async (entry) => {
        if (entry.context.period === "week") throw boom;
        return makeResult(true, true);
      });

      await expect(runSummaryBatchPlan(plan, evaluator, NOW)).rejects.toBe(
        boom,
      );
      // index 0(day) + index 1(week, reject) 만 호출 — index 2(month) 호출 0.
      expect(evaluator).toHaveBeenCalledTimes(2);
      expect(evaluator).toHaveBeenNthCalledWith(2, plan[1], NOW);
    });
  });

  describe("negative cases 충분 cover", () => {
    it("(1) evaluator 가 동기적으로 throw(Promise.reject 아님) → 그 error 전파 + 이후 호출 0", async () => {
      const plan = [makeEntry("day"), makeEntry("week")];
      const boom = new Error("동기 throw");
      // async 가 아닌 동기 throw 콜백 — runtime 에서 reject 로 흡수되어 전파.
      const evaluator = jest.fn<
        Promise<SummaryAggregateResult>,
        [SummaryBatchPlanEntry, Date]
      >(() => {
        throw boom;
      });

      await expect(runSummaryBatchPlan(plan, evaluator, NOW)).rejects.toBe(
        boom,
      );
      // 첫 entry 에서 즉시 throw — 두 번째 호출 0.
      expect(evaluator).toHaveBeenCalledTimes(1);
    });

    it("(2) plan 배열 비변형 — 호출 후 length / 각 원소 reference 가 호출 전과 동일", async () => {
      const plan = [makeEntry("day"), makeEntry("week")];
      const snapshotLen = plan.length;
      const e0 = plan[0];
      const e1 = plan[1];
      const evaluator: SummaryBatchEvaluator = async () =>
        makeResult(true, true);

      await runSummaryBatchPlan(plan, evaluator, NOW);

      expect(plan).toHaveLength(snapshotLen);
      expect(plan[0]).toBe(e0);
      expect(plan[1]).toBe(e1);
    });

    it("(3) now 가 helper 안에서 mutate 되지 않음 — 호출 후 getTime() 동일", async () => {
      const plan = [makeEntry("day")];
      const before = NOW.getTime();
      const evaluator: SummaryBatchEvaluator = async () =>
        makeResult(true, true);

      await runSummaryBatchPlan(plan, evaluator, NOW);

      expect(NOW.getTime()).toBe(before);
    });

    it("(4) 한 entry 당 정확히 1 번만 evaluator 를 호출(중복 호출 0) — spy count === plan.length", async () => {
      const plan = [makeEntry("day"), makeEntry("week"), makeEntry("month")];
      const evaluator = jest.fn(
        async () => makeResult(true, true) as SummaryAggregateResult,
      );
      await runSummaryBatchPlan(plan, evaluator, NOW);
      expect(evaluator).toHaveBeenCalledTimes(plan.length);
    });

    it("(5) evaluator 호출 인자 sequence 가 plan 과 1:1 일치(중복/누락/순서뒤바뀜 0)", async () => {
      const plan = [makeEntry("day"), makeEntry("week"), makeEntry("month")];
      const calledEntries: SummaryBatchPlanEntry[] = [];
      const evaluator: SummaryBatchEvaluator = async (entry) => {
        calledEntries.push(entry);
        return makeResult(true, true);
      };

      await runSummaryBatchPlan(plan, evaluator, NOW);

      // reference 단위로 plan 과 동일 sequence.
      expect(calledEntries).toHaveLength(plan.length);
      calledEntries.forEach((entry, i) => {
        expect(entry).toBe(plan[i]);
      });
    });
  });

  describe("결정성 / 비변형 invariant", () => {
    it("같은 plan + 같은 결정적 evaluator + 같은 now 로 2 회 호출 → 두 outcomes 깊은 값 동일(새 배열 반환)", async () => {
      const plan = [makeEntry("day"), makeEntry("week"), makeEntry("month")];
      const evaluator: SummaryBatchEvaluator = async (entry) =>
        entry.context.period === "month"
          ? makeResult(false)
          : makeResult(true, true);

      const first = await runSummaryBatchPlan(plan, evaluator, NOW);
      const second = await runSummaryBatchPlan(plan, evaluator, NOW);

      // 깊은 값 동일.
      expect(first).toEqual(second);
      // 새 배열 — reference 동일 아님.
      expect(first).not.toBe(second);
    });
  });
});
