// evaluation-unevaluated-fill-requests spec — 순수 함수 `buildUnevaluatedFillRequests`
// 를 직접 호출해 검증(plainToInstance 불요 — 요청 intent 는 plain interface).
// unevaluated-fill-plan-response.mapper spec 의 평탄화 사촌 짝. R-112: happy / error /
// branch / negative 충분 cover(예외 분기마다 1+).
import {
  formatKstIso,
  parseKstPeriodInput,
} from "../../common/period-boundary";

import type { EvaluationPersistContext } from "./evaluation-result.persist.mapper";
import type { UnevaluatedFillBatchPlan } from "./evaluation-unevaluated-fill-batch-plan";
import { buildUnevaluatedFillRequests } from "./evaluation-unevaluated-fill-requests";

// 좌표 원소 factory — 한 period 의 4 축을 빠르게 구성. periodStart 는 Date instance.
function coord(
  personId: string,
  periodStart: Date,
  period = "week",
  scope = "commit",
): EvaluationPersistContext {
  return { personId, period, scope, periodStart };
}

// 정상 plan base 의 periodStart — 2026-06-10T06:00:00Z = ...T15:00:00+09:00(KST offset).
const ps1 = new Date("2026-06-10T06:00:00Z");
const ps2 = new Date("2026-06-11T06:00:00Z");
const ps3 = new Date("2026-06-12T06:00:00Z");

// 단일 batch plan factory — branch/negative 변형용. totalGapCount = periods.length.
function singleBatchPlan(
  periods: EvaluationPersistContext[],
): UnevaluatedFillBatchPlan {
  return {
    batches: [{ personId: "p", periods }],
    totalGapCount: periods.length,
    personCount: 1,
  };
}

// 정상 다중-person plan — person-1(좌표 2개) + person-2(좌표 1개), totalGapCount=3,
// personCount=2(불변식 충족 — Σ periods.length === totalGapCount).
function buildValidPlan(): UnevaluatedFillBatchPlan {
  return {
    batches: [
      {
        personId: "person-1",
        periods: [coord("person-1", ps1), coord("person-1", ps2)],
      },
      { personId: "person-2", periods: [coord("person-2", ps3)] },
    ],
    totalGapCount: 3,
    personCount: 2,
  };
}

describe("buildUnevaluatedFillRequests — 미평가 fill batch plan → per-좌표 요청 intent 평탄화", () => {
  describe("happy-path — 정상 plan 평탄화", () => {
    it("다중 person plan 을 평탄화하면 길이가 plan.totalGapCount 와 같다", () => {
      const plan = buildValidPlan();
      const requests = buildUnevaluatedFillRequests(plan);
      expect(requests).toHaveLength(plan.totalGapCount);
      expect(requests).toHaveLength(3);
    });

    it("person 묶음 순서 → 묶음 내부 좌표 순서를 그대로 보존해 평탄화한다(stable flatten)", () => {
      const requests = buildUnevaluatedFillRequests(buildValidPlan());
      // person-1 의 2 좌표(ps1, ps2) → person-2 의 1 좌표(ps3) 순서.
      expect(requests.map((r) => r.personId)).toEqual([
        "person-1",
        "person-1",
        "person-2",
      ]);
      expect(requests.map((r) => r.periodStart)).toEqual([
        formatKstIso(ps1),
        formatKstIso(ps2),
        formatKstIso(ps3),
      ]);
    });

    it("periodStart 만 formatKstIso 경유 offset-명시 ISO string(+09:00)으로 변환하고 3 축은 passthrough 한다", () => {
      const requests = buildUnevaluatedFillRequests(buildValidPlan());
      const first = requests[0];
      expect(first.personId).toBe("person-1");
      expect(first.period).toBe("week");
      expect(first.scope).toBe("commit");
      expect(first.periodStart).toBe("2026-06-10T15:00:00+09:00");
      expect(first.periodStart).toMatch(/\+09:00$/);
    });

    it("periodStart 는 round-trip(parseKstPeriodInput) 시 원 instant 를 보존한다", () => {
      const requests = buildUnevaluatedFillRequests(buildValidPlan());
      expect(parseKstPeriodInput(requests[0].periodStart).getTime()).toBe(
        ps1.getTime(),
      );
    });
  });

  describe("flow / branch coverage — 분기마다 분리", () => {
    it("(a) 빈 plan(batches: [], totalGapCount 0) → 빈 배열 반환", () => {
      const plan: UnevaluatedFillBatchPlan = {
        batches: [],
        totalGapCount: 0,
        personCount: 0,
      };
      expect(buildUnevaluatedFillRequests(plan)).toEqual([]);
    });

    it("(b) 단일 person 단일 좌표 → 요청 1개", () => {
      const requests = buildUnevaluatedFillRequests(
        singleBatchPlan([coord("solo", ps1)]),
      );
      expect(requests).toEqual([
        {
          personId: "solo",
          period: "week",
          scope: "commit",
          periodStart: "2026-06-10T15:00:00+09:00",
        },
      ]);
    });

    it("(c) 다중 person 다중 좌표 → 순서 보존 평탄화", () => {
      const requests = buildUnevaluatedFillRequests(buildValidPlan());
      expect(requests).toHaveLength(3);
      expect(requests[2].personId).toBe("person-2");
    });

    it("(d) 동일 좌표가 묶음 내 중복 등장하면 dedup 하지 않고 중복 그대로 보존한다", () => {
      const dup = coord("dup", ps1);
      const requests = buildUnevaluatedFillRequests(
        singleBatchPlan([dup, dup, coord("dup", ps2)]),
      );
      expect(requests).toHaveLength(3);
      expect(requests.map((r) => r.periodStart)).toEqual([
        formatKstIso(ps1),
        formatKstIso(ps1),
        formatKstIso(ps2),
      ]);
    });

    it('빈 personId("")는 유효 key 로 허용한다(정규화 안 함 — 경계값)', () => {
      const requests = buildUnevaluatedFillRequests(
        singleBatchPlan([coord("", ps1)]),
      );
      expect(requests[0].personId).toBe("");
    });
  });

  describe("error path / negative cases — 예외 상황 각 1+", () => {
    it("plan 이 null 이면 한국어 메시지 TypeError 로 fail-fast", () => {
      expect(() =>
        buildUnevaluatedFillRequests(
          null as unknown as UnevaluatedFillBatchPlan,
        ),
      ).toThrow(TypeError);
      expect(() =>
        buildUnevaluatedFillRequests(
          null as unknown as UnevaluatedFillBatchPlan,
        ),
      ).toThrow("plan 이 null/undefined 일 수 없다");
    });

    it("plan 이 undefined 이면 한국어 메시지 TypeError 로 fail-fast", () => {
      expect(() =>
        buildUnevaluatedFillRequests(
          undefined as unknown as UnevaluatedFillBatchPlan,
        ),
      ).toThrow(TypeError);
    });

    it("plan.batches 가 null 이면 한국어 메시지 TypeError", () => {
      const plan = { batches: null, totalGapCount: 0, personCount: 0 };
      expect(() =>
        buildUnevaluatedFillRequests(
          plan as unknown as UnevaluatedFillBatchPlan,
        ),
      ).toThrow("plan.batches 는 배열이어야 한다");
    });

    it("plan.batches 가 undefined 이면 TypeError", () => {
      const plan = { totalGapCount: 0, personCount: 0 };
      expect(() =>
        buildUnevaluatedFillRequests(
          plan as unknown as UnevaluatedFillBatchPlan,
        ),
      ).toThrow(TypeError);
    });

    it("plan.batches 가 non-array(객체)이면 TypeError", () => {
      const plan = { batches: {}, totalGapCount: 0, personCount: 0 };
      expect(() =>
        buildUnevaluatedFillRequests(
          plan as unknown as UnevaluatedFillBatchPlan,
        ),
      ).toThrow("plan.batches 는 배열이어야 한다");
    });

    it("person 묶음 원소가 null 이면 한국어 메시지 TypeError", () => {
      const plan = {
        batches: [null],
        totalGapCount: 0,
        personCount: 1,
      };
      expect(() =>
        buildUnevaluatedFillRequests(
          plan as unknown as UnevaluatedFillBatchPlan,
        ),
      ).toThrow("person 묶음이 null/undefined 일 수 없다");
    });

    it("묶음의 periods 가 null 이면 한국어 메시지 TypeError", () => {
      const plan = {
        batches: [{ personId: "p", periods: null }],
        totalGapCount: 0,
        personCount: 1,
      };
      expect(() =>
        buildUnevaluatedFillRequests(
          plan as unknown as UnevaluatedFillBatchPlan,
        ),
      ).toThrow("periods 는 배열이어야 한다");
    });

    it("묶음의 periods 가 non-array 이면 TypeError", () => {
      const plan = {
        batches: [{ personId: "p", periods: "nope" }],
        totalGapCount: 0,
        personCount: 1,
      };
      expect(() =>
        buildUnevaluatedFillRequests(
          plan as unknown as UnevaluatedFillBatchPlan,
        ),
      ).toThrow("periods 는 배열이어야 한다");
    });

    it("좌표 원소가 null 이면 한국어 메시지 TypeError", () => {
      const plan = {
        batches: [{ personId: "p", periods: [null] }],
        totalGapCount: 1,
        personCount: 1,
      };
      expect(() =>
        buildUnevaluatedFillRequests(
          plan as unknown as UnevaluatedFillBatchPlan,
        ),
      ).toThrow("좌표 원소가 null/undefined 일 수 없다");
    });

    it("좌표 periodStart 가 비-Date(string)이면 formatKstIso 의 TypeError 자연 전파", () => {
      const plan = singleBatchPlan([
        {
          personId: "p",
          period: "week",
          scope: "commit",
          periodStart: "nope" as unknown as Date,
        },
      ]);
      expect(() => buildUnevaluatedFillRequests(plan)).toThrow(TypeError);
      expect(() => buildUnevaluatedFillRequests(plan)).toThrow(
        "유효한 Date instance 가 필요합니다",
      );
    });

    it("좌표 periodStart 가 Invalid Date 이면 formatKstIso 의 TypeError 자연 전파", () => {
      const plan = singleBatchPlan([coord("p", new Date("invalid-date"))]);
      expect(() => buildUnevaluatedFillRequests(plan)).toThrow(TypeError);
    });
  });

  describe("비변형 — 입력 plan/batches/periods/좌표 mutate 0", () => {
    it("입력 좌표 객체와 plan 구조를 mutate 하지 않고 새 배열/새 객체를 반환한다", () => {
      const original = coord("p", ps1);
      const snapshot = { ...original };
      const plan = singleBatchPlan([original]);
      const batchesRef = plan.batches;
      const periodsRef = plan.batches[0].periods;

      const requests = buildUnevaluatedFillRequests(plan);

      // 입력 좌표 비변형 — 4 축 그대로.
      expect(original).toEqual(snapshot);
      // 입력 배열 참조 동일성 유지(새 배열로 교체 안 함) + 내용 길이 보존.
      expect(plan.batches).toBe(batchesRef);
      expect(plan.batches[0].periods).toBe(periodsRef);
      expect(plan.batches[0].periods).toHaveLength(1);
      // 반환은 새 배열 / 새 객체 — 입력 좌표 참조와 동일하지 않다.
      expect(requests[0]).not.toBe(original);
    });
  });
});
