// evaluation-unevaluated-fill-batch-plan.spec — buildUnevaluatedFillBatchPlan 순수 함수
// 단위 테스트(R-112: happy / error / flow-branch / negative 충분 cover).
// person 별 그룹핑의 결정성·순서 보존(firstSeenOrder + 등장 순서)·exact match·
// 비변형·방어적 입력 처리·dedup 안 함 정책·불변식(totalGapCount 합 일치)을 검증한다.

import type { EvaluationPersistContext } from "./evaluation-result.persist.mapper";
import { buildUnevaluatedFillBatchPlan } from "./evaluation-unevaluated-fill-batch-plan";

// 좌표 factory — 테스트 가독성용. periodStart 는 ISO 문자열 또는 Date 를 받는다.
function coord(
  personId: string,
  period: string,
  scope: string,
  periodStart: string | Date,
): EvaluationPersistContext {
  return {
    personId,
    period,
    scope,
    periodStart:
      periodStart instanceof Date ? periodStart : new Date(periodStart),
  };
}

const ISO_A = "2026-01-01T00:00:00.000Z";
const ISO_B = "2026-02-01T00:00:00.000Z";
const ISO_C = "2026-03-01T00:00:00.000Z";

describe("buildUnevaluatedFillBatchPlan", () => {
  describe("happy path", () => {
    it("여러 person 의 gap 을 person 별 묶음으로 그룹핑하고 person 최초 등장 순서 / 묶음 내부 등장 순서를 둘 다 보존한다", () => {
      const a1 = coord("p1", "2026-Q1", "team", ISO_A);
      const a2 = coord("p1", "2026-Q1", "team", ISO_B);
      const b1 = coord("p2", "2026-Q1", "team", ISO_A);
      const c1 = coord("p3", "2026-Q1", "team", ISO_C);
      // 입력 순서: p1, p2, p1(재등장), p3 — person 묶음 순서는 [p1, p2, p3]
      // (firstSeenOrder), p1 묶음 내부는 [a1, a2] 등장 순서 그대로.
      const gaps = [a1, b1, a2, c1];

      const plan = buildUnevaluatedFillBatchPlan(gaps);

      expect(plan.batches).toHaveLength(3);
      expect(plan.batches[0].personId).toBe("p1");
      expect(plan.batches[0].periods).toEqual([a1, a2]);
      expect(plan.batches[0].periods[0]).toBe(a1);
      expect(plan.batches[0].periods[1]).toBe(a2);
      expect(plan.batches[1].personId).toBe("p2");
      expect(plan.batches[1].periods).toEqual([b1]);
      expect(plan.batches[2].personId).toBe("p3");
      expect(plan.batches[2].periods).toEqual([c1]);
    });

    it("단일 person 의 다수 좌표는 한 묶음으로 합쳐지고 totalGapCount/personCount 가 정확하다", () => {
      const a1 = coord("p1", "2026-Q1", "team", ISO_A);
      const a2 = coord("p1", "2026-Q1", "team", ISO_B);
      const a3 = coord("p1", "2026-Q1", "team", ISO_C);

      const plan = buildUnevaluatedFillBatchPlan([a1, a2, a3]);

      expect(plan.batches).toHaveLength(1);
      expect(plan.personCount).toBe(1);
      expect(plan.totalGapCount).toBe(3);
      expect(plan.batches[0].periods).toEqual([a1, a2, a3]);
      // 불변식: totalGapCount = Σ batches[i].periods.length
      expect(plan.totalGapCount).toBe(
        plan.batches.reduce((s, b) => s + b.periods.length, 0),
      );
    });

    it("다수 person 의 단일 좌표는 각 person 마다 한 묶음씩 만들어진다", () => {
      const a = coord("p1", "2026-Q1", "team", ISO_A);
      const b = coord("p2", "2026-Q1", "team", ISO_A);
      const c = coord("p3", "2026-Q1", "team", ISO_A);

      const plan = buildUnevaluatedFillBatchPlan([a, b, c]);

      expect(plan.batches).toHaveLength(3);
      expect(plan.personCount).toBe(3);
      expect(plan.totalGapCount).toBe(3);
      expect(plan.batches.map((b) => b.personId)).toEqual(["p1", "p2", "p3"]);
      expect(plan.batches.map((b) => b.periods.length)).toEqual([1, 1, 1]);
    });
  });

  describe("error path", () => {
    it("gaps 가 null 이면 한국어 메시지 TypeError 를 던진다", () => {
      expect(() =>
        buildUnevaluatedFillBatchPlan(
          null as unknown as EvaluationPersistContext[],
        ),
      ).toThrow(TypeError);
      expect(() =>
        buildUnevaluatedFillBatchPlan(
          null as unknown as EvaluationPersistContext[],
        ),
      ).toThrow(/null\/undefined/);
    });

    it("gaps 가 undefined 이면 한국어 메시지 TypeError 를 던진다", () => {
      expect(() =>
        buildUnevaluatedFillBatchPlan(
          undefined as unknown as EvaluationPersistContext[],
        ),
      ).toThrow(TypeError);
      expect(() =>
        buildUnevaluatedFillBatchPlan(
          undefined as unknown as EvaluationPersistContext[],
        ),
      ).toThrow(/null\/undefined/);
    });

    it("원소가 null 이면 한국어 메시지 TypeError 를 던진다", () => {
      const a = coord("p1", "2026-Q1", "team", ISO_A);
      expect(() =>
        buildUnevaluatedFillBatchPlan([
          a,
          null as unknown as EvaluationPersistContext,
        ]),
      ).toThrow(/gaps\[1\].*null\/undefined/);
    });

    it("원소가 undefined 이면 한국어 메시지 TypeError 를 던진다", () => {
      expect(() =>
        buildUnevaluatedFillBatchPlan([
          undefined as unknown as EvaluationPersistContext,
        ]),
      ).toThrow(/gaps\[0\].*null\/undefined/);
    });

    it("원소의 personId 가 누락(undefined)되면 TypeError", () => {
      const bad = {
        period: "2026-Q1",
        scope: "team",
        periodStart: new Date(ISO_A),
      } as unknown as EvaluationPersistContext;
      expect(() => buildUnevaluatedFillBatchPlan([bad])).toThrow(
        /personId 는 string/,
      );
    });

    it("원소의 personId 가 non-string(number) 이면 TypeError", () => {
      const bad = {
        personId: 42 as unknown as string,
        period: "2026-Q1",
        scope: "team",
        periodStart: new Date(ISO_A),
      } as EvaluationPersistContext;
      expect(() => buildUnevaluatedFillBatchPlan([bad])).toThrow(
        /personId 는 string/,
      );
    });
  });

  describe("flow / branch coverage", () => {
    it("(a) gap 비어있음 — batches []·totalGapCount 0·personCount 0", () => {
      const plan = buildUnevaluatedFillBatchPlan([]);
      expect(plan.batches).toEqual([]);
      expect(plan.totalGapCount).toBe(0);
      expect(plan.personCount).toBe(0);
    });

    it("(b) 단일 person 분기 — 묶음 1 개", () => {
      const a = coord("solo", "2026-Q1", "team", ISO_A);
      const plan = buildUnevaluatedFillBatchPlan([a]);
      expect(plan.batches).toHaveLength(1);
      expect(plan.batches[0].personId).toBe("solo");
      expect(plan.batches[0].periods).toEqual([a]);
    });

    it("(c) 다수 person 분기 — 묶음 N 개", () => {
      const gaps = [
        coord("p1", "2026-Q1", "team", ISO_A),
        coord("p2", "2026-Q1", "team", ISO_A),
      ];
      const plan = buildUnevaluatedFillBatchPlan(gaps);
      expect(plan.batches).toHaveLength(2);
      expect(plan.personCount).toBe(2);
    });

    it("(d) 같은 person 좌표가 비연속 등장(중간에 다른 person 끼어듦) — 같은 묶음으로 흡수, person 묶음 순서는 최초 등장 기준", () => {
      const p1a = coord("p1", "2026-Q1", "team", ISO_A);
      const p2a = coord("p2", "2026-Q1", "team", ISO_A);
      const p1b = coord("p1", "2026-Q1", "team", ISO_B);
      const p2b = coord("p2", "2026-Q1", "team", ISO_B);
      const p1c = coord("p1", "2026-Q1", "team", ISO_C);
      // 입력: p1, p2, p1, p2, p1 — p1 묶음 = [p1a, p1b, p1c], p2 묶음 = [p2a, p2b].
      // person 최초 등장 순서 = [p1, p2].
      const plan = buildUnevaluatedFillBatchPlan([p1a, p2a, p1b, p2b, p1c]);

      expect(plan.batches.map((b) => b.personId)).toEqual(["p1", "p2"]);
      expect(plan.batches[0].periods).toEqual([p1a, p1b, p1c]);
      expect(plan.batches[1].periods).toEqual([p2a, p2b]);
      expect(plan.totalGapCount).toBe(5);
      expect(plan.personCount).toBe(2);
    });

    it("(e) 같은 좌표 중복 등장 — dedup 안 함, 묶음 내 중복 그대로 보존", () => {
      const a = coord("p1", "2026-Q1", "team", ISO_A);
      // 동일 참조 a 가 두 번 등장 — dedup 안 하므로 묶음에 두 번 들어간다.
      const plan = buildUnevaluatedFillBatchPlan([a, a]);

      expect(plan.batches).toHaveLength(1);
      expect(plan.batches[0].periods).toHaveLength(2);
      expect(plan.batches[0].periods[0]).toBe(a);
      expect(plan.batches[0].periods[1]).toBe(a);
      expect(plan.totalGapCount).toBe(2);
      // 다른 인스턴스이지만 좌표값이 같은 경우에도 dedup 0(차집합 멤버십은 T-0536 책임).
      const a2 = coord("p1", "2026-Q1", "team", ISO_A);
      const plan2 = buildUnevaluatedFillBatchPlan([a, a2]);
      expect(plan2.batches[0].periods).toHaveLength(2);
      expect(plan2.totalGapCount).toBe(2);
    });
  });

  describe("negative cases — 충분 cover", () => {
    it("personId 빈 문자열은 유효 person key 로 허용(정규화 안 함, 경계)", () => {
      const empty = coord("", "2026-Q1", "team", ISO_A);
      const other = coord("p1", "2026-Q1", "team", ISO_A);
      const plan = buildUnevaluatedFillBatchPlan([empty, other]);

      expect(plan.batches).toHaveLength(2);
      expect(plan.batches[0].personId).toBe("");
      expect(plan.batches[0].periods).toEqual([empty]);
      expect(plan.batches[1].personId).toBe("p1");
    });

    it("personId 대소문자 차이는 별도 person 묶음으로 취급(exact match, 정규화 안 함)", () => {
      const lower = coord("alice", "2026-Q1", "team", ISO_A);
      const upper = coord("ALICE", "2026-Q1", "team", ISO_A);
      const plan = buildUnevaluatedFillBatchPlan([lower, upper]);

      expect(plan.batches).toHaveLength(2);
      expect(plan.batches[0].personId).toBe("alice");
      expect(plan.batches[1].personId).toBe("ALICE");
    });

    it("personId 공백 차이는 별도 person 묶음으로 취급(exact match, 정규화 안 함)", () => {
      const noSpace = coord("p1", "2026-Q1", "team", ISO_A);
      const trailingSpace = coord("p1 ", "2026-Q1", "team", ISO_A);
      const plan = buildUnevaluatedFillBatchPlan([noSpace, trailingSpace]);

      expect(plan.batches).toHaveLength(2);
      expect(plan.batches[0].personId).toBe("p1");
      expect(plan.batches[1].personId).toBe("p1 ");
    });

    it("입력 배열을 외부에서 mutate 해도 반환 plan 의 batches/periods 는 영향받지 않는다(비변형 격리)", () => {
      const a = coord("p1", "2026-Q1", "team", ISO_A);
      const b = coord("p2", "2026-Q1", "team", ISO_A);
      const gaps = [a, b];

      const plan = buildUnevaluatedFillBatchPlan(gaps);
      // 입력 배열을 외부에서 mutate.
      gaps.push(coord("p3", "2026-Q1", "team", ISO_A));
      gaps.pop();
      gaps.pop();

      // 반환 plan 의 batches 배열은 새 인스턴스이므로 영향 0.
      expect(plan.batches).toHaveLength(2);
      expect(plan.batches[0].personId).toBe("p1");
      expect(plan.batches[1].personId).toBe("p2");
      expect(plan.totalGapCount).toBe(2);
    });

    it("입력 원소를 mutate 하지 않는다(원소 mutation 0)", () => {
      const a = coord("p1", "2026-Q1", "team", ISO_A);
      const before = { ...a, periodStart: new Date(a.periodStart.getTime()) };

      buildUnevaluatedFillBatchPlan([a]);

      expect(a.personId).toBe(before.personId);
      expect(a.period).toBe(before.period);
      expect(a.scope).toBe(before.scope);
      expect(a.periodStart.getTime()).toBe(before.periodStart.getTime());
    });

    it("반환 plan 의 batches 를 mutate 해도 입력 gaps 배열은 영향받지 않는다(비변형 격리, 반대 방향)", () => {
      const a = coord("p1", "2026-Q1", "team", ISO_A);
      const b = coord("p2", "2026-Q1", "team", ISO_A);
      const gaps = [a, b];

      const plan = buildUnevaluatedFillBatchPlan(gaps);
      // 반환 plan 의 batches 를 mutate (이 행위는 본 helper 의 책임은 아니지만, 반환
      // 배열이 입력과 다른 인스턴스인지의 직접 검증 — 입력 배열은 그대로 유지된다).
      plan.batches.pop();
      plan.batches[0].periods.push(b);

      expect(gaps).toHaveLength(2);
      expect(gaps[0]).toBe(a);
      expect(gaps[1]).toBe(b);
    });

    it("불변식: totalGapCount === gaps.length === Σ batches[i].periods.length", () => {
      const gaps = [
        coord("p1", "2026-Q1", "team", ISO_A),
        coord("p1", "2026-Q1", "team", ISO_B),
        coord("p2", "2026-Q1", "team", ISO_A),
        coord("p3", "2026-Q1", "team", ISO_A),
        coord("p1", "2026-Q1", "team", ISO_C),
      ];
      const plan = buildUnevaluatedFillBatchPlan(gaps);

      expect(plan.totalGapCount).toBe(gaps.length);
      expect(plan.totalGapCount).toBe(
        plan.batches.reduce((s, b) => s + b.periods.length, 0),
      );
      expect(plan.personCount).toBe(plan.batches.length);
    });
  });
});
