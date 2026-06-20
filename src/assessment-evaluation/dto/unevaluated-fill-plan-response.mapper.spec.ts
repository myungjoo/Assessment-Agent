// unevaluated-fill-plan-response.mapper spec — 순수 함수 `toUnevaluatedFillPlanResponse`
// 를 직접 호출해 검증(plainToInstance 불요 — 응답 shape 은 plain interface). request mapper
// spec 의 대칭 짝. R-112: happy / error / branch / negative 충분 cover(예외 분기마다 1+).
import {
  formatKstIso,
  parseKstPeriodInput,
} from "../../common/period-boundary";
import type { EvaluationPersistContext } from "../domain/evaluation-result.persist.mapper";
import type { UnevaluatedFillBatchPlan } from "../domain/evaluation-unevaluated-fill-batch-plan";

import { toUnevaluatedFillPlanResponse } from "./unevaluated-fill-plan-response.mapper";

// 좌표 원소 factory — 한 period 의 4 축을 빠르게 구성. periodStart 는 Date instance.
function coord(
  personId: string,
  periodStart: Date,
  period = "week",
  scope = "commit",
): EvaluationPersistContext {
  return { personId, period, scope, periodStart };
}

// 정상 plan base — batches 2 묶음(person-1: 2 좌표, person-2: 1 좌표), totalGapCount=3,
// personCount=2(불변식 충족). periodStart 는 2026-06-10T06:00:00Z = ...T15:00:00+09:00.
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

function buildValidPlan(): UnevaluatedFillBatchPlan {
  return {
    batches: [
      {
        personId: "person-1",
        periods: [coord("person-1", ps1), coord("person-1", ps2)],
      },
      {
        personId: "person-2",
        periods: [coord("person-2", ps3, "month", "document")],
      },
    ],
    totalGapCount: 3,
    personCount: 2,
  };
}

describe("toUnevaluatedFillPlanResponse", () => {
  // happy (R-112 #1): 유효 plan → 5 축 정확 전사 + periodStart string(formatKstIso, +09:00
  // offset 명시) + person 묶음/좌표 순서 보존(재정렬 0).
  it("유효 plan 을 응답 shape 으로 직렬화한다 (happy)", () => {
    const result = toUnevaluatedFillPlanResponse(buildValidPlan());

    // 집계 축 전사 + person 묶음 순서 보존(firstSeenOrder).
    expect(result.totalGapCount).toBe(3);
    expect(result.personCount).toBe(2);
    expect(result.batches.map((b) => b.personId)).toEqual([
      "person-1",
      "person-2",
    ]);

    // person-1 묶음 — 2 좌표, 좌표 순서 보존 + 3 축 전사.
    const b1 = result.batches[0];
    expect(b1.periods).toHaveLength(2);
    expect(b1.periods[0].personId).toBe("person-1");
    expect(b1.periods[0].period).toBe("week");
    expect(b1.periods[0].scope).toBe("commit");

    // periodStart 가 string 이고 formatKstIso 산출과 일치(+09:00 offset 명시 포함).
    expect(typeof b1.periods[0].periodStart).toBe("string");
    expect(b1.periods[0].periodStart).toBe(formatKstIso(ps1));
    expect(b1.periods[0].periodStart).toContain("+09:00");
    expect(b1.periods[1].periodStart).toBe(formatKstIso(ps2));

    // person-2 묶음 — period/scope 도 정확 전사(passthrough).
    const b2 = result.batches[1];
    expect(b2.periods[0].period).toBe("month");
    expect(b2.periods[0].scope).toBe("document");
    expect(b2.periods[0].periodStart).toBe(formatKstIso(ps3));
  });

  it("periodStart 직렬화에 raw .toISOString 이 아닌 formatKstIso 를 경유한다 (happy/single-source)", () => {
    // raw .toISOString() 은 "...Z" 형태라 "+09:00" 을 포함하지 않는다 — single-source 검증.
    const r = toUnevaluatedFillPlanResponse(buildValidPlan());
    expect(r.batches[0].periods[0].periodStart).not.toBe(ps1.toISOString());
    expect(r.batches[0].periods[0].periodStart).toBe(formatKstIso(ps1));
  });

  // flow / branch (R-112 #3).
  it("batches 빈 배열은 빈 배열로 전사하고 집계 축은 passthrough 한다 (branch — 빈 batches)", () => {
    const plan: UnevaluatedFillBatchPlan = {
      batches: [],
      totalGapCount: 0,
      personCount: 0,
    };
    const result = toUnevaluatedFillPlanResponse(plan);
    expect(result.batches).toEqual([]);
    expect(result.totalGapCount).toBe(0);
    expect(result.personCount).toBe(0);
  });

  it("한 batch 의 periods 빈 배열은 빈 periods 배열로 전사한다 (branch — 빈 periods)", () => {
    const result = toUnevaluatedFillPlanResponse(singleBatchPlan([]));
    expect(result.batches).toHaveLength(1);
    expect(result.batches[0].personId).toBe("p");
    expect(result.batches[0].periods).toEqual([]);
  });

  it("KST 자정 instant 는 +09:00 offset ISO 로 직렬화된다 (branch — formatKstIso offset)", () => {
    // 2026-06-09T15:00:00Z = 2026-06-10T00:00:00+09:00 (KST 자정).
    const result = toUnevaluatedFillPlanResponse(
      singleBatchPlan([coord("p", new Date("2026-06-09T15:00:00Z"))]),
    );
    expect(result.batches[0].periods[0].periodStart).toBe(
      "2026-06-10T00:00:00+09:00",
    );
  });

  it("반환 periodStart 는 parseKstPeriodInput round-trip 시 원 instant 와 동등하다 (branch — round-trip)", () => {
    const result = toUnevaluatedFillPlanResponse(buildValidPlan());
    const roundTripped = parseKstPeriodInput(
      result.batches[0].periods[0].periodStart,
    );
    expect(roundTripped.getTime()).toBe(ps1.getTime());
  });

  // error path (R-112 #2) + negative 충분 cover (R-112 #4): 예외 분기마다 1+.
  it("plan 이 null 이면 TypeError 로 fail-fast (negative #1)", () => {
    expect(() =>
      toUnevaluatedFillPlanResponse(
        null as unknown as UnevaluatedFillBatchPlan,
      ),
    ).toThrow(TypeError);
  });

  it("plan 이 undefined 이면 TypeError 로 fail-fast (negative #2)", () => {
    expect(() =>
      toUnevaluatedFillPlanResponse(
        undefined as unknown as UnevaluatedFillBatchPlan,
      ),
    ).toThrow(TypeError);
  });

  it("periodStart 가 Invalid Date 면 formatKstIso 의 TypeError 가 전파된다 (negative #3)", () => {
    const plan = singleBatchPlan([coord("p", new Date("invalid"))]);
    expect(() => toUnevaluatedFillPlanResponse(plan)).toThrow(TypeError);
  });

  it("periodStart 가 Date 아닌 값(string)이면 formatKstIso 의 TypeError 가 전파된다 (negative #4)", () => {
    // periodStart 만 비-Date(string)로 둔 좌표 — formatKstIso 가 TypeError 를 던진다.
    const badPeriod = {
      personId: "p",
      period: "week",
      scope: "commit",
      periodStart: "2026-06-10T15:00:00+09:00",
    } as unknown as EvaluationPersistContext;
    expect(() =>
      toUnevaluatedFillPlanResponse(singleBatchPlan([badPeriod])),
    ).toThrow(TypeError);
  });

  // negative #5: 입력 plan.batches 비변형 — 반환 batches 가 다른 배열 참조 + 입력 mutate 0.
  it("입력 plan.batches 를 변형하지 않고 새 배열로 map 한다 (negative #5 — batches 비변형)", () => {
    const plan = buildValidPlan();
    const inputBatches = plan.batches;
    const result = toUnevaluatedFillPlanResponse(plan);

    // 다른 배열 참조(새 map 산출) + 반환 mutate 가 입력에 영향 0(격리).
    expect(result.batches).not.toBe(inputBatches);
    result.batches.push({ personId: "x", periods: [] });
    expect(plan.batches).toHaveLength(2);
    expect(plan.batches.map((b) => b.personId)).toEqual([
      "person-1",
      "person-2",
    ]);
  });

  // negative #6: 입력 plan.batches[*].periods 비변형 — 반환 periods 가 다른 배열 참조.
  it("입력 plan.batches[*].periods 를 변형하지 않고 새 배열로 map 한다 (negative #6 — periods 비변형)", () => {
    const plan = buildValidPlan();
    const inputPeriods = plan.batches[0].periods;
    const result = toUnevaluatedFillPlanResponse(plan);

    // 다른 배열 참조(새 map 산출) + 반환 mutate 격리 + 입력 periodStart Date 그대로.
    expect(result.batches[0].periods).not.toBe(inputPeriods);
    result.batches[0].periods.pop();
    expect(plan.batches[0].periods).toHaveLength(2);
    expect(plan.batches[0].periods[0].periodStart).toBeInstanceOf(Date);
  });
});
