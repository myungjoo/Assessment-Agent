// evaluation-unevaluated-fill-bridge-requests spec — 순수 compose helper
// `composeUnevaluatedFillBridgeRequests` 를 직접 호출해 검증(plainToInstance 불요 —
// `PeriodBridgeDto` plain 객체만 다룬다). T-0540 `composeUnevaluatedFillPlan` spec 의
// 입력-side 실행 대칭 짝. R-112: happy / error / branch / negative 충분 cover
// (예외 분기마다 1+ test). 본 helper 자체는 분기 0(compose-only) — 아래 "branch coverage"
// 블록은 helper 자체 분기가 아니라 *compose 경로의 대표 case 분리*(빈/중복/무중복 plan).
import { formatKstIso } from "../../common/period-boundary";
import { dedupePeriodBridgeRequests } from "../dto/dedupe-period-bridge-requests";
import { PeriodBridgeDto } from "../dto/period-bridge.dto";

import type { EvaluationPersistContext } from "./evaluation-result.persist.mapper";
import type { UnevaluatedFillBatchPlan } from "./evaluation-unevaluated-fill-batch-plan";
import { composeUnevaluatedFillBridgeRequests } from "./evaluation-unevaluated-fill-bridge-requests";

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

// 정상 다중-person plan — person-1(좌표 2개) + person-2(좌표 1개), 중복 0.
// totalGapCount=3, personCount=2(불변식 충족 — Σ periods.length === totalGapCount).
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

describe("composeUnevaluatedFillBridgeRequests — 미평가 fill plan → 중복 제거 PeriodBridgeDto[] compose", () => {
  describe("happy-path — 정상 plan compose", () => {
    it("중복 없는 다중 person plan → 길이가 totalGapCount 와 같다(dedup 무손실)", () => {
      const plan = buildValidPlan();
      const result = composeUnevaluatedFillBridgeRequests(plan);
      expect(result).toHaveLength(plan.totalGapCount);
      expect(result).toHaveLength(3);
    });

    it("4 축이 plan 좌표와 일치하고 reevaluate 는 undefined 다(fill = first-write-wins)", () => {
      const result = composeUnevaluatedFillBridgeRequests(buildValidPlan());
      const first = result[0];
      expect(first.personId).toBe("person-1");
      expect(first.period).toBe("week");
      expect(first.scope).toBe("commit");
      // periodStart 는 formatKstIso 경유 offset-명시 ISO string(+09:00).
      expect(first.periodStart).toBe("2026-06-10T15:00:00+09:00");
      expect(first.reevaluate).toBeUndefined();
    });

    it("순서가 first-wins·등장 순서로 보존된다(평탄화 순서 그대로)", () => {
      const result = composeUnevaluatedFillBridgeRequests(buildValidPlan());
      expect(result.map((r) => r.personId)).toEqual([
        "person-1",
        "person-1",
        "person-2",
      ]);
      expect(result.map((r) => r.periodStart)).toEqual([
        formatKstIso(ps1),
        formatKstIso(ps2),
        formatKstIso(ps3),
      ]);
    });

    it("반환이 dedupePeriodBridgeRequests 결과와 동일하다(= 3 조각 순서 정확)", () => {
      const plan = buildValidPlan();
      const result = composeUnevaluatedFillBridgeRequests(plan);
      // 동일 plan 좌표로 직접 bridge-map → dedup 까지 손으로 엮은 기대값과 구조 동등해야
      // 한다(compose 가 (2)→(3) 순서를 정확히 합성했는지 검증).
      const bridge = [
        coord("person-1", ps1),
        coord("person-1", ps2),
        coord("person-2", ps3),
      ].map((c) => {
        const dto = new PeriodBridgeDto();
        dto.personId = c.personId;
        dto.period = c.period;
        dto.scope = c.scope;
        dto.periodStart = formatKstIso(c.periodStart);
        return dto;
      });
      const expected = dedupePeriodBridgeRequests(bridge);
      expect(result).toEqual(expected);
    });

    it("반환 원소는 PeriodBridgeDto 인스턴스다(toPeriodBridgeRequests 경유)", () => {
      const result = composeUnevaluatedFillBridgeRequests(buildValidPlan());
      // class instance 여부 — class-validator decorator 가 붙는 실제 DTO class.
      expect(result[0].constructor.name).toBe("PeriodBridgeDto");
    });
  });

  describe("dedup 합성 — 중복 좌표 plan 의 first-wins 제거(3 조각 순서 회귀 검출)", () => {
    it("동일 좌표가 묶음 내 중복 등장하면 dedup 으로 길이가 감소한다", () => {
      const dup = coord("dup", ps1);
      // dup(ps1) ×2 + ps2 → dedup 후 2 개(ps1 first-wins + ps2).
      const result = composeUnevaluatedFillBridgeRequests(
        singleBatchPlan([dup, coord("dup", ps1), coord("dup", ps2)]),
      );
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.periodStart)).toEqual([
        formatKstIso(ps1),
        formatKstIso(ps2),
      ]);
    });

    it("비인접 중복(사이에 다른 좌표)도 전역으로 제거한다(first-wins 순서 보존)", () => {
      const result = composeUnevaluatedFillBridgeRequests(
        singleBatchPlan([
          coord("x", ps1),
          coord("x", ps2),
          coord("x", ps1), // ps1 비인접 중복.
        ]),
      );
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.periodStart)).toEqual([
        formatKstIso(ps1),
        formatKstIso(ps2),
      ]);
    });

    it("좌표 4-tuple 중 한 축만 달라도 별개 좌표로 보존한다(false-merge 0)", () => {
      const result = composeUnevaluatedFillBridgeRequests(
        singleBatchPlan([
          coord("a", ps1, "week", "commit"),
          coord("a", ps1, "week", "document"), // scope 만 다름 → 별개.
        ]),
      );
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.scope)).toEqual(["commit", "document"]);
    });
  });

  describe("flow / branch coverage — compose 경로 대표 case 분리(helper 자체 분기 0)", () => {
    it("(a) 빈 plan(batches: []) → 빈 배열 반환", () => {
      const plan: UnevaluatedFillBatchPlan = {
        batches: [],
        totalGapCount: 0,
        personCount: 0,
      };
      expect(composeUnevaluatedFillBridgeRequests(plan)).toEqual([]);
    });

    it("(a') 묶음은 있으나 periods 가 빈 배열이면 빈 배열 반환", () => {
      const plan: UnevaluatedFillBatchPlan = {
        batches: [{ personId: "p", periods: [] }],
        totalGapCount: 0,
        personCount: 1,
      };
      expect(composeUnevaluatedFillBridgeRequests(plan)).toEqual([]);
    });

    it("(b) 중복 좌표 포함 plan → dedup 으로 길이 감소", () => {
      const result = composeUnevaluatedFillBridgeRequests(
        singleBatchPlan([coord("d", ps1), coord("d", ps1)]),
      );
      expect(result).toHaveLength(1);
    });

    it("(c) 중복 없는 plan → 길이 보존(totalGapCount 와 동일)", () => {
      const result = composeUnevaluatedFillBridgeRequests(
        singleBatchPlan([coord("u", ps1), coord("u", ps2), coord("u", ps3)]),
      );
      expect(result).toHaveLength(3);
    });
  });

  describe("error path / negative cases — 예외 상황 각 1+(조각 방어 자연 전파)", () => {
    it("plan 이 null 이면 첫 조각 buildUnevaluatedFillRequests 의 한국어 TypeError 전파", () => {
      expect(() =>
        composeUnevaluatedFillBridgeRequests(
          null as unknown as UnevaluatedFillBatchPlan,
        ),
      ).toThrow(TypeError);
      // 함수명 prefix 로 어느 조각에서 전파됐는지 단언 → 합성 순서 회귀 검출.
      expect(() =>
        composeUnevaluatedFillBridgeRequests(
          null as unknown as UnevaluatedFillBatchPlan,
        ),
      ).toThrow(
        "buildUnevaluatedFillRequests: plan 이 null/undefined 일 수 없다",
      );
    });

    it("plan 이 undefined 이면 첫 조각의 한국어 TypeError 전파", () => {
      expect(() =>
        composeUnevaluatedFillBridgeRequests(
          undefined as unknown as UnevaluatedFillBatchPlan,
        ),
      ).toThrow(TypeError);
    });

    it("plan 이 non-object(숫자)면 첫 조각 batches 접근 단계에서 TypeError 전파", () => {
      expect(() =>
        composeUnevaluatedFillBridgeRequests(
          42 as unknown as UnevaluatedFillBatchPlan,
        ),
      ).toThrow(
        "buildUnevaluatedFillRequests: plan.batches 는 배열이어야 한다",
      );
    });

    it("plan.batches 가 null 이면 첫 조각의 한국어 TypeError 전파", () => {
      const plan = { batches: null, totalGapCount: 0, personCount: 0 };
      expect(() =>
        composeUnevaluatedFillBridgeRequests(
          plan as unknown as UnevaluatedFillBatchPlan,
        ),
      ).toThrow(
        "buildUnevaluatedFillRequests: plan.batches 는 배열이어야 한다",
      );
    });

    it("plan.batches 가 non-array(string)이면 첫 조각의 한국어 TypeError 전파", () => {
      const plan = { batches: "nope", totalGapCount: 0, personCount: 0 };
      expect(() =>
        composeUnevaluatedFillBridgeRequests(
          plan as unknown as UnevaluatedFillBatchPlan,
        ),
      ).toThrow("plan.batches 는 배열이어야 한다");
    });

    it("묶음 원소가 null 이면 첫 조각 assertBatchElement 의 한국어 TypeError 전파", () => {
      const plan = {
        batches: [null],
        totalGapCount: 0,
        personCount: 1,
      };
      expect(() =>
        composeUnevaluatedFillBridgeRequests(
          plan as unknown as UnevaluatedFillBatchPlan,
        ),
      ).toThrow("person 묶음이 null/undefined 일 수 없다");
    });

    it("묶음의 periods 가 non-array 면 첫 조각의 한국어 TypeError 전파", () => {
      const plan = {
        batches: [{ personId: "p", periods: "nope" }],
        totalGapCount: 0,
        personCount: 1,
      };
      expect(() =>
        composeUnevaluatedFillBridgeRequests(
          plan as unknown as UnevaluatedFillBatchPlan,
        ),
      ).toThrow("periods 는 배열이어야 한다");
    });

    it("좌표 원소가 null 이면 첫 조각의 한국어 TypeError 전파", () => {
      const plan = {
        batches: [{ personId: "p", periods: [null] }],
        totalGapCount: 1,
        personCount: 1,
      };
      expect(() =>
        composeUnevaluatedFillBridgeRequests(
          plan as unknown as UnevaluatedFillBatchPlan,
        ),
      ).toThrow("좌표 원소가 null/undefined 일 수 없다");
    });

    it("좌표 periodStart 가 Invalid Date 면 formatKstIso 의 TypeError 자연 전파", () => {
      const plan = singleBatchPlan([coord("p", new Date("nonsense-date"))]);
      expect(() => composeUnevaluatedFillBridgeRequests(plan)).toThrow(
        TypeError,
      );
    });

    it("좌표 periodStart 가 비-Date(string)면 formatKstIso 의 TypeError 자연 전파", () => {
      const plan = singleBatchPlan([
        {
          personId: "p",
          period: "week",
          scope: "commit",
          periodStart: "2026-06-10" as unknown as Date,
        },
      ]);
      expect(() => composeUnevaluatedFillBridgeRequests(plan)).toThrow(
        TypeError,
      );
    });
  });

  describe("비변형 · 합성 순서 단언", () => {
    it("입력 plan 은 compose 호출 후 구조 동등하게 그대로다(mutate 0)", () => {
      const plan = buildValidPlan();
      const snapshot = JSON.parse(
        JSON.stringify(plan),
      ) as UnevaluatedFillBatchPlan;
      composeUnevaluatedFillBridgeRequests(plan);
      expect(JSON.parse(JSON.stringify(plan))).toEqual(snapshot);
    });

    it("반환이 중복 제거된 배열임을 happy/중복 양쪽에서 단언(조각 순서 뒤바뀜 회귀 차단)", () => {
      // 중복 있는 plan: dedup 이 bridge-map 뒤에 와야만 정상 제거된다.
      const dupResult = composeUnevaluatedFillBridgeRequests(
        singleBatchPlan([coord("z", ps1), coord("z", ps1)]),
      );
      expect(dupResult).toHaveLength(1);
      // 중복 없는 plan: dedup 무손실 → totalGapCount 보존.
      const cleanResult =
        composeUnevaluatedFillBridgeRequests(buildValidPlan());
      expect(cleanResult).toHaveLength(3);
    });
  });
});
