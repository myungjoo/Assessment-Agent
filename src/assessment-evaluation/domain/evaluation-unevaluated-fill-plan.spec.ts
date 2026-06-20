// evaluation-unevaluated-fill-plan.spec — composeUnevaluatedFillPlan 순수 compose
// helper 의 colocated 단위 테스트. R-112 4 종(happy / error path / flow·branch /
// negative cases 충분 cover — 각 예외 분기 ≥1)을 모두 cover 하며, 신규 도메인 파일
// 100%(line/branch/function/stmt) 목표. 패턴 mirror:
// evaluation-persisted-period-coordinates.spec.ts / evaluation-unevaluated-period-
// select.spec.ts (순수 함수 end-to-end 사슬·결정성·비변형·방어 입력 검증).

import { enumerateIntendedPeriodCoordinates } from "./evaluation-intended-period-coordinates";
import type { IntendedPeriodCoordinatesInput } from "./evaluation-intended-period-coordinates";
import type { PersistedAssessmentRecord } from "./evaluation-persisted-period-coordinates";
import { composeUnevaluatedFillPlan } from "./evaluation-unevaluated-fill-plan";
import type { UnevaluatedFillPlanInput } from "./evaluation-unevaluated-fill-plan";

// 테스트 fixture — 정상 intended 입력 wrapper. month period 로 2026-01~2026-03 의 3 개
// 월 anchor × 2 person 데카르트 곱 좌표(=6 좌표)를 펼친다. UTC 구간을 넉넉히 잡아
// KST month anchor snap 이후에도 3 개월이 모두 포함되게 한다.
function makeIntended(
  overrides: Partial<IntendedPeriodCoordinatesInput> = {},
): IntendedPeriodCoordinatesInput {
  return {
    personIds: ["alice", "bob"],
    period: "month",
    scope: "engineering",
    rangeStart: new Date("2026-01-05T00:00:00.000Z"),
    rangeEnd: new Date("2026-03-20T00:00:00.000Z"),
    ...overrides,
  };
}

// makePersistedFromIntended — intended 좌표 일부를 영속 레코드로 변환한다. 동일 좌표가
// 차집합에서 제외되는지(이미 평가됨) 검증하기 위해, enumerate 가 실제로 산출한 좌표를
// 그대로 persisted 입력으로 되돌린다(KST anchor instant 정확 매칭 보장). 추가 컬럼을
// 섞어 좌표 4-field 만 투영되는지도 함께 확인한다.
function makePersistedFromIntended(
  intendedInput: IntendedPeriodCoordinatesInput,
  pickIndices: number[],
): PersistedAssessmentRecord[] {
  const coords = enumerateIntendedPeriodCoordinates(intendedInput);
  return pickIndices.map((i) => ({
    personId: coords[i].personId,
    period: coords[i].period,
    scope: coords[i].scope,
    periodStart: coords[i].periodStart,
    // 추가 컬럼 — 좌표 투영에서 무시되어야 함.
    id: `assessment-${i}`,
    narrative: "이미 평가됨",
  }));
}

// sortCoords — 좌표 집합 동일성을 순서 비독립적으로 비교하기 위한 정렬 helper. batch-plan
// 조각은 좌표를 person 별(firstSeenOrder)로 재그룹핑하므로 flatGaps 의 순서는 intended
// 등장 순서와 다를 수 있다(같은 좌표 집합인지가 본질). 4-tuple 키로 안정 정렬한다.
function sortCoords<T extends { personId: string; periodStart: Date }>(
  coords: T[],
): T[] {
  return [...coords].sort((a, b) =>
    `${a.personId} ${a.periodStart.getTime()}`.localeCompare(
      `${b.personId} ${b.periodStart.getTime()}`,
    ),
  );
}

describe("composeUnevaluatedFillPlan", () => {
  describe("happy path", () => {
    it("intended(다수 person × 다수 anchor) + 일부 겹치는 persisted → gap 만 person 별 batch 로 요약", () => {
      const intended = makeIntended();
      const allCoords = enumerateIntendedPeriodCoordinates(intended);
      // 총 6 좌표(3 anchor × 2 person). 그중 2 개(index 0,3)를 이미 평가됨으로 persisted.
      const persisted = makePersistedFromIntended(intended, [0, 3]);

      const plan = composeUnevaluatedFillPlan({ intended, persisted });

      // 6 - 2 = 4 좌표가 gap 으로 남는다.
      expect(plan.totalGapCount).toBe(4);
      // 불변식 — totalGapCount === Σ batches[i].periods.length.
      const summed = plan.batches.reduce((s, b) => s + b.periods.length, 0);
      expect(summed).toBe(plan.totalGapCount);
      // gap 좌표는 persisted 로 제외된 2 개를 빼고 나머지 4 개와 정확히 일치한다.
      const persistedKeys = new Set([0, 3]);
      const expectedGaps = allCoords.filter((_, i) => !persistedKeys.has(i));
      const flatGaps = plan.batches.flatMap((b) => b.periods);
      // 좌표 집합 동일성 비교(순서는 person 별 재그룹핑으로 달라질 수 있음).
      expect(sortCoords(flatGaps)).toEqual(sortCoords(expectedGaps));
      // person 별 그룹핑 — 두 person 모두 batch 보유(personCount=2).
      expect(plan.personCount).toBe(2);
    });

    it("persisted 빈 배열이면 intended 전체가 gap 으로 plan 에 포함된다", () => {
      const intended = makeIntended();
      const allCoords = enumerateIntendedPeriodCoordinates(intended);

      const plan = composeUnevaluatedFillPlan({ intended, persisted: [] });

      expect(plan.totalGapCount).toBe(allCoords.length);
      expect(plan.totalGapCount).toBe(6);
      const flatGaps = plan.batches.flatMap((b) => b.periods);
      expect(sortCoords(flatGaps)).toEqual(sortCoords(allCoords));
    });
  });

  describe("flow / branch coverage", () => {
    it("(a) gap 존재(intended ⊋ persisted) → 비어있지 않은 plan", () => {
      const intended = makeIntended();
      const persisted = makePersistedFromIntended(intended, [0]);

      const plan = composeUnevaluatedFillPlan({ intended, persisted });

      expect(plan.totalGapCount).toBe(5);
      expect(plan.batches.length).toBeGreaterThan(0);
    });

    it("(b) gap 부재(persisted 가 intended 전부 cover) → 빈 batch plan", () => {
      const intended = makeIntended();
      // intended 좌표 6 개 전부를 persisted 로 cover.
      const persisted = makePersistedFromIntended(intended, [0, 1, 2, 3, 4, 5]);

      const plan = composeUnevaluatedFillPlan({ intended, persisted });

      expect(plan).toEqual({ batches: [], totalGapCount: 0, personCount: 0 });
    });

    it("(c) persisted 빈 배열 → intended 전체가 gap", () => {
      const intended = makeIntended();
      const plan = composeUnevaluatedFillPlan({ intended, persisted: [] });
      expect(plan.totalGapCount).toBe(6);
    });

    it("(d) intended.personIds 빈 배열 → intended 좌표 0 → 빈 plan", () => {
      const intended = makeIntended({ personIds: [] });
      const persisted: PersistedAssessmentRecord[] = [];

      const plan = composeUnevaluatedFillPlan({ intended, persisted });

      expect(plan).toEqual({ batches: [], totalGapCount: 0, personCount: 0 });
    });

    it("(e) input null → 방어 분기 TypeError", () => {
      expect(() =>
        composeUnevaluatedFillPlan(null as unknown as UnevaluatedFillPlanInput),
      ).toThrow(TypeError);
    });

    it("(f) input.intended 누락 → 방어 분기 TypeError", () => {
      expect(() =>
        composeUnevaluatedFillPlan({
          persisted: [],
        } as unknown as UnevaluatedFillPlanInput),
      ).toThrow(TypeError);
    });

    it("(f) input.persisted 누락 → 방어 분기 TypeError", () => {
      expect(() =>
        composeUnevaluatedFillPlan({
          intended: makeIntended(),
        } as unknown as UnevaluatedFillPlanInput),
      ).toThrow(TypeError);
    });
  });

  describe("error path / negative cases", () => {
    it("① input 이 null → TypeError", () => {
      expect(() =>
        composeUnevaluatedFillPlan(null as unknown as UnevaluatedFillPlanInput),
      ).toThrow("input 이 null/undefined 일 수 없다.");
    });

    it("② input 이 undefined → TypeError", () => {
      expect(() =>
        composeUnevaluatedFillPlan(
          undefined as unknown as UnevaluatedFillPlanInput,
        ),
      ).toThrow("input 이 null/undefined 일 수 없다.");
    });

    it("③ input.intended 누락(undefined) → TypeError", () => {
      expect(() =>
        composeUnevaluatedFillPlan({
          intended: undefined,
          persisted: [],
        } as unknown as UnevaluatedFillPlanInput),
      ).toThrow("input.intended 가 null/undefined 일 수 없다.");
    });

    it("④ input.persisted 누락(undefined) → TypeError", () => {
      expect(() =>
        composeUnevaluatedFillPlan({
          intended: makeIntended(),
          persisted: undefined,
        } as unknown as UnevaluatedFillPlanInput),
      ).toThrow("input.persisted 가 null/undefined 일 수 없다.");
    });

    it("⑤ 조각 내부 방어 전파 — input.persisted 원소 personId non-string → TypeError 전파", () => {
      const intended = makeIntended();
      const persisted = [
        {
          personId: 123 as unknown as string,
          period: "month",
          scope: "engineering",
          periodStart: new Date("2026-01-31T15:00:00.000Z"),
        },
      ] as PersistedAssessmentRecord[];

      expect(() => composeUnevaluatedFillPlan({ intended, persisted })).toThrow(
        TypeError,
      );
    });

    it("⑥ 조각 내부 방어 전파 — input.intended.rangeStart 가 Invalid Date → TypeError 전파", () => {
      const intended = makeIntended({ rangeStart: new Date("invalid") });

      expect(() =>
        composeUnevaluatedFillPlan({ intended, persisted: [] }),
      ).toThrow(TypeError);
    });

    it("⑥-b 조각 내부 방어 전파 — input.intended.period 미지원 → RangeError 전파", () => {
      const intended = makeIntended({ period: "fortnight" });

      expect(() =>
        composeUnevaluatedFillPlan({ intended, persisted: [] }),
      ).toThrow(RangeError);
    });

    it("⑦ 비변형 격리 — 입력 배열을 호출 후 mutate 해도 반환 plan 불변 + 동일 입력 2 회 동일 plan", () => {
      const intended = makeIntended();
      const persisted = makePersistedFromIntended(intended, [0]);

      const plan1 = composeUnevaluatedFillPlan({ intended, persisted });
      const before = plan1.totalGapCount;
      // 호출 후 외부에서 입력 배열을 mutate.
      persisted.push({
        personId: "alice",
        period: "month",
        scope: "engineering",
        periodStart: new Date("2026-02-28T15:00:00.000Z"),
      });
      intended.personIds.push("carol");
      // 이미 반환된 plan 은 영향받지 않는다(반환 배열은 새 인스턴스).
      expect(plan1.totalGapCount).toBe(before);

      // 결정성 — mutate 전 동일했던 입력 스냅샷으로 2 회 호출 시 동일 plan.
      const freshIntended = makeIntended();
      const freshPersisted = makePersistedFromIntended(freshIntended, [0]);
      const a = composeUnevaluatedFillPlan({
        intended: freshIntended,
        persisted: freshPersisted,
      });
      const b = composeUnevaluatedFillPlan({
        intended: makeIntended(),
        persisted: makePersistedFromIntended(makeIntended(), [0]),
      });
      expect(a).toEqual(b);
    });

    it("⑧ persisted 가 intended 와 무관한 좌표만 보유 → 차집합 누출 0, intended 전체가 gap", () => {
      const intended = makeIntended();
      const allCoords = enumerateIntendedPeriodCoordinates(intended);
      // intended 와 겹치지 않는 좌표(다른 person/scope/instant)만 persisted.
      const persisted: PersistedAssessmentRecord[] = [
        {
          personId: "stranger",
          period: "month",
          scope: "marketing",
          periodStart: new Date("2025-06-30T15:00:00.000Z"),
        },
      ];

      const plan = composeUnevaluatedFillPlan({ intended, persisted });

      // 무관 좌표는 차집합에 영향 0 → intended 전체가 gap, persisted 좌표 누출 0.
      expect(plan.totalGapCount).toBe(allCoords.length);
      const flatGaps = plan.batches.flatMap((b) => b.periods);
      expect(sortCoords(flatGaps)).toEqual(sortCoords(allCoords));
    });
  });
});
