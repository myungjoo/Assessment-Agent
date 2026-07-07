// evaluation-overwrite-reeval-plan.spec — computeOverwriteReevalPlan 순수 helper 의
// colocated 단위 테스트. R-112 4 종(happy / error path / flow·branch / negative cases
// 충분 cover)을 모두 cover 하며 신규 도메인 파일 100%(line/branch/function/stmt) 목표.
// 패턴 mirror: evaluation-persisted-period-coordinates.spec.ts (순수 함수 결정성·비변형·
// 방어 입력 검증). ADR-0053 §Decision 1/2/3/4 semantics 를 spec 로 강제한다.

import {
  computeOverwriteReevalPlan,
  REEVAL_MODES,
} from "./evaluation-overwrite-reeval-plan";
import type { EvaluationPersistContext } from "./evaluation-result.persist.mapper";

// 테스트 fixture — 좌표 4-tuple 을 만든다. periodStart 는 기본 고정 instant.
function coord(
  overrides: Partial<EvaluationPersistContext> = {},
): EvaluationPersistContext {
  return {
    personId: "p1",
    period: "month",
    scope: "engineering",
    periodStart: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// key 비교 헬퍼 — plan 배열에서 personId 목록을 뽑아 순서 비교를 간결하게.
function persons(list: EvaluationPersistContext[]): string[] {
  return list.map((c) => c.personId);
}

describe("computeOverwriteReevalPlan", () => {
  describe("happy path", () => {
    it("(1) reeval mode + target 이 persisted 에 존재 → toReset 포함·toCreate 빈 배열", () => {
      const c = coord({ personId: "alice" });
      const plan = computeOverwriteReevalPlan(
        "reeval",
        [c],
        [coord({ personId: "alice" })],
      );

      expect(persons(plan.toReset)).toEqual(["alice"]);
      expect(plan.toCreate).toEqual([]);
      expect(plan.preserved).toEqual([]);
    });

    it("(2) reeval mode + target 이 persisted 에 부재 → toCreate 포함·toReset 빈 배열", () => {
      const plan = computeOverwriteReevalPlan(
        "reeval",
        [coord({ personId: "bob" })],
        [],
      );

      expect(plan.toReset).toEqual([]);
      expect(persons(plan.toCreate)).toEqual(["bob"]);
      expect(plan.preserved).toEqual([]);
    });

    it("(3) 무플래그(undefined) + target 존재 → preserved·toReset 빈 배열", () => {
      const plan = computeOverwriteReevalPlan(
        undefined,
        [coord({ personId: "carol" })],
        [coord({ personId: "carol" })],
      );

      expect(plan.toReset).toEqual([]);
      expect(plan.toCreate).toEqual([]);
      expect(persons(plan.preserved)).toEqual(["carol"]);
    });

    it("overwrite mode 도 reeval 과 동일하게 reset 경로", () => {
      const plan = computeOverwriteReevalPlan(
        "overwrite",
        [coord({ personId: "dave" })],
        [coord({ personId: "dave" })],
      );
      expect(persons(plan.toReset)).toEqual(["dave"]);
    });

    it("REEVAL_MODES 상수는 reeval/overwrite 두 값을 노출한다", () => {
      expect([...REEVAL_MODES]).toEqual(["reeval", "overwrite"]);
    });
  });

  describe("error path — 방어적 입력 처리", () => {
    it("targets 가 null 이면 TypeError", () => {
      expect(() =>
        computeOverwriteReevalPlan(
          "reeval",
          null as unknown as EvaluationPersistContext[],
          [],
        ),
      ).toThrow(/targets 배열이 null\/undefined/);
    });

    it("targets 가 undefined 이면 TypeError", () => {
      expect(() =>
        computeOverwriteReevalPlan(
          "reeval",
          undefined as unknown as EvaluationPersistContext[],
          [],
        ),
      ).toThrow(TypeError);
    });

    it("targets 가 배열이 아니면 TypeError", () => {
      expect(() =>
        computeOverwriteReevalPlan(
          "reeval",
          "nope" as unknown as EvaluationPersistContext[],
          [],
        ),
      ).toThrow(/targets 는 배열이어야 한다/);
    });

    it("persisted 가 null 이면 TypeError", () => {
      expect(() =>
        computeOverwriteReevalPlan(
          "reeval",
          [],
          null as unknown as EvaluationPersistContext[],
        ),
      ).toThrow(/persisted 배열이 null\/undefined/);
    });

    it("persisted 가 배열이 아니면 TypeError", () => {
      expect(() =>
        computeOverwriteReevalPlan(
          "reeval",
          [],
          123 as unknown as EvaluationPersistContext[],
        ),
      ).toThrow(/persisted 는 배열이어야 한다/);
    });

    it("targets 원소가 null 이면 TypeError", () => {
      expect(() =>
        computeOverwriteReevalPlan(
          "reeval",
          [null as unknown as EvaluationPersistContext],
          [],
        ),
      ).toThrow(/targets 원소가 null\/undefined/);
    });

    it("persisted 원소가 undefined 이면 TypeError", () => {
      expect(() =>
        computeOverwriteReevalPlan(
          "reeval",
          [],
          [undefined as unknown as EvaluationPersistContext],
        ),
      ).toThrow(/persisted 원소가 null\/undefined/);
    });

    it("personId 누락이면 TypeError", () => {
      const bad = coord();
      delete (bad as { personId?: string }).personId;
      expect(() => computeOverwriteReevalPlan("reeval", [bad], [])).toThrow(
        /personId 는 string/,
      );
    });

    it("period 가 non-string 이면 TypeError", () => {
      expect(() =>
        computeOverwriteReevalPlan(
          "reeval",
          [coord({ period: 123 as unknown as string })],
          [],
        ),
      ).toThrow(/period 는 string/);
    });

    it("scope 누락이면 TypeError (persisted 축)", () => {
      const bad = coord();
      delete (bad as { scope?: string }).scope;
      expect(() => computeOverwriteReevalPlan("reeval", [], [bad])).toThrow(
        /scope 는 string/,
      );
    });

    it("periodStart 가 Date 가 아니면 TypeError", () => {
      expect(() =>
        computeOverwriteReevalPlan(
          "reeval",
          [coord({ periodStart: "2026-01-01" as unknown as Date })],
          [],
        ),
      ).toThrow(/periodStart 는 유효한 Date/);
    });

    it("periodStart 가 Invalid Date 이면 TypeError", () => {
      expect(() =>
        computeOverwriteReevalPlan(
          "reeval",
          [coord({ periodStart: new Date("invalid") })],
          [],
        ),
      ).toThrow(/periodStart 는 유효한 Date/);
    });
  });

  describe("flow / branch coverage — mode 분기", () => {
    it("reeval → reset 경로 (존재 좌표 toReset)", () => {
      const plan = computeOverwriteReevalPlan("reeval", [coord()], [coord()]);
      expect(plan.toReset).toHaveLength(1);
    });

    it("fill → default 경로 (존재 좌표 preserved, toReset 빈 배열)", () => {
      const plan = computeOverwriteReevalPlan("fill", [coord()], [coord()]);
      expect(plan.toReset).toEqual([]);
      expect(plan.preserved).toHaveLength(1);
    });

    it("undefined → default 경로", () => {
      const plan = computeOverwriteReevalPlan(undefined, [coord()], [coord()]);
      expect(plan.toReset).toEqual([]);
      expect(plan.preserved).toHaveLength(1);
    });

    it("좌표 존재 분기 → 명시 mode 는 toReset", () => {
      const plan = computeOverwriteReevalPlan("reeval", [coord()], [coord()]);
      expect(plan.toReset).toHaveLength(1);
      expect(plan.toCreate).toEqual([]);
    });

    it("좌표 부재 분기 → toCreate", () => {
      const plan = computeOverwriteReevalPlan("reeval", [coord()], []);
      expect(plan.toCreate).toHaveLength(1);
      expect(plan.toReset).toEqual([]);
    });

    it("partial subset 분기 → target 아닌 persisted 좌표 preserved", () => {
      const target = coord({ personId: "a", period: "2026-01" });
      const other = coord({ personId: "a", period: "2026-02" });
      const plan = computeOverwriteReevalPlan(
        "reeval",
        [target],
        [target, other],
      );
      // target(2026-01)만 reset, 다른 period(2026-02)는 preserved.
      expect(persons(plan.toReset)).toEqual(["a"]);
      expect(plan.toReset).toHaveLength(1);
      expect(plan.toReset[0].period).toBe("2026-01");
      expect(plan.preserved).toHaveLength(1);
      expect(plan.preserved[0].period).toBe("2026-02");
    });
  });

  describe("negative cases 충분 cover", () => {
    it("(a) unknown mode → overwrite 미발생 (toReset 빈 배열, default 경로)", () => {
      const plan = computeOverwriteReevalPlan("delete", [coord()], [coord()]);
      expect(plan.toReset).toEqual([]);
      expect(plan.preserved).toHaveLength(1);
    });

    it("(a') 대소문자 불일치 REEVAL → fail-closed default (overwrite 미발생)", () => {
      const plan = computeOverwriteReevalPlan("REEVAL", [coord()], [coord()]);
      expect(plan.toReset).toEqual([]);
      expect(plan.preserved).toHaveLength(1);
    });

    it("(a'') 임의 문자열 mode → default 경로", () => {
      const plan = computeOverwriteReevalPlan(
        "garbage-xyz",
        [coord()],
        [coord()],
      );
      expect(plan.toReset).toEqual([]);
    });

    it("(b) 빈 mode 문자열 → default 경로 (toReset 빈 배열)", () => {
      const plan = computeOverwriteReevalPlan("", [coord()], [coord()]);
      expect(plan.toReset).toEqual([]);
      expect(plan.preserved).toHaveLength(1);
    });

    it("(c) target 이 persisted 부분집합 → 다른 좌표 preserved(delete 대상 미포함)", () => {
      const t = coord({ personId: "a", scope: "eng" });
      const otherScope = coord({ personId: "a", scope: "design" });
      const otherPerson = coord({ personId: "b", scope: "eng" });
      const plan = computeOverwriteReevalPlan(
        "reeval",
        [t],
        [t, otherScope, otherPerson],
      );
      expect(plan.toReset).toHaveLength(1);
      expect(plan.toReset[0].scope).toBe("eng");
      // 다른 scope·다른 person 은 preserved (wiping others 미발생).
      expect(plan.preserved).toHaveLength(2);
      // toReset 은 (targets ∩ persisted) 의 부분집합.
      expect(plan.toReset[0].personId).toBe("a");
    });

    it("(d) empty targets → 빈 plan (persisted 전부 preserved)", () => {
      const plan = computeOverwriteReevalPlan(
        "reeval",
        [],
        [coord(), coord({ personId: "z" })],
      );
      expect(plan.toReset).toEqual([]);
      expect(plan.toCreate).toEqual([]);
      expect(plan.preserved).toHaveLength(2);
    });

    it("(d') empty targets + empty persisted → 완전 빈 plan", () => {
      const plan = computeOverwriteReevalPlan("reeval", [], []);
      expect(plan.toReset).toEqual([]);
      expect(plan.toCreate).toEqual([]);
      expect(plan.preserved).toEqual([]);
    });

    it("(e) empty persisted + reeval → 모두 toCreate (reset 대상 0)", () => {
      const plan = computeOverwriteReevalPlan(
        "reeval",
        [coord({ personId: "a" }), coord({ personId: "b" })],
        [],
      );
      expect(plan.toReset).toEqual([]);
      expect(persons(plan.toCreate)).toEqual(["a", "b"]);
      expect(plan.preserved).toEqual([]);
    });

    it("(f) 같은 좌표 중복 target → reset 1 회 수렴 (dedup)", () => {
      const c = coord({ personId: "dup" });
      const plan = computeOverwriteReevalPlan(
        "reeval",
        [c, coord({ personId: "dup" }), coord({ personId: "dup" })],
        [coord({ personId: "dup" })],
      );
      expect(plan.toReset).toHaveLength(1);
      expect(persons(plan.toReset)).toEqual(["dup"]);
    });

    it("(f') 같은 좌표 중복 target (부재) → create 1 회 수렴", () => {
      const plan = computeOverwriteReevalPlan(
        "reeval",
        [coord({ personId: "new" }), coord({ personId: "new" })],
        [],
      );
      expect(plan.toCreate).toHaveLength(1);
    });

    it("(g) periodStart 만 다른 두 좌표는 서로 다른 좌표 (instant exact match)", () => {
      const startA = new Date("2026-01-01T00:00:00.000Z");
      const startB = new Date("2026-02-01T00:00:00.000Z");
      const tA = coord({ personId: "a", periodStart: startA });
      const tB = coord({ personId: "a", periodStart: startB });
      // persisted 에 A 만 존재 → A 는 reset, B 는 create (다른 좌표로 취급).
      const plan = computeOverwriteReevalPlan("reeval", [tA, tB], [tA]);
      expect(plan.toReset).toHaveLength(1);
      expect(plan.toReset[0].periodStart.getTime()).toBe(startA.getTime());
      expect(plan.toCreate).toHaveLength(1);
      expect(plan.toCreate[0].periodStart.getTime()).toBe(startB.getTime());
    });

    it("(g') 같은 instant 의 서로 다른 Date 객체 → 동일 좌표로 취급 (병합)", () => {
      const dateA = new Date("2026-03-01T00:00:00.000Z");
      const dateB = new Date("2026-03-01T00:00:00.000Z");
      expect(dateA).not.toBe(dateB);
      const tA = coord({ personId: "same", periodStart: dateA });
      const persistedSame = coord({ personId: "same", periodStart: dateB });
      // instant 동일 → 존재로 판정 → reeval 시 reset.
      const plan = computeOverwriteReevalPlan("reeval", [tA], [persistedSame]);
      expect(plan.toReset).toHaveLength(1);
      expect(plan.toCreate).toEqual([]);
    });

    it("빈 문자열 좌표 축 허용 (정규화 안 함, exact match)", () => {
      const plan = computeOverwriteReevalPlan(
        "reeval",
        [coord({ personId: "", scope: "" })],
        [],
      );
      expect(plan.toCreate).toHaveLength(1);
      expect(plan.toCreate[0].personId).toBe("");
      expect(plan.toCreate[0].scope).toBe("");
    });
  });

  describe("idempotency / 결정론 (§Decision 2)", () => {
    it("같은 입력 재호출 → 동일 plan (결정론)", () => {
      const targets = [coord({ personId: "a" }), coord({ personId: "b" })];
      const persisted = [coord({ personId: "a" })];
      const first = computeOverwriteReevalPlan("reeval", targets, persisted);
      const second = computeOverwriteReevalPlan("reeval", targets, persisted);
      expect(first).toEqual(second);
    });

    it("세 집합은 서로소 (한 좌표는 한 집합에만)", () => {
      const t1 = coord({ personId: "exist" });
      const t2 = coord({ personId: "fresh" });
      const other = coord({ personId: "keep" });
      const plan = computeOverwriteReevalPlan(
        "reeval",
        [t1, t2],
        [coord({ personId: "exist" }), other],
      );
      expect(persons(plan.toReset)).toEqual(["exist"]);
      expect(persons(plan.toCreate)).toEqual(["fresh"]);
      expect(persons(plan.preserved)).toEqual(["keep"]);
    });
  });

  describe("입력 비변형 검증 (부수효과 0)", () => {
    it("호출 후 targets/persisted 배열과 원소 좌표가 mutate 되지 않는다", () => {
      const t = coord({ personId: "orig" });
      const p = coord({ personId: "orig" });
      const targets = [t];
      const persisted = [p];

      const plan = computeOverwriteReevalPlan("reeval", targets, persisted);

      // 반환 plan 의 좌표를 mutate 해도 입력 좌표는 불변(새 객체).
      plan.toReset[0].personId = "mutated";
      expect(t.personId).toBe("orig");
      expect(p.personId).toBe("orig");
      // 입력 배열 자체도 비변형(길이·원소 참조 그대로).
      expect(targets).toHaveLength(1);
      expect(targets[0]).toBe(t);
      expect(persisted).toHaveLength(1);
      expect(persisted[0]).toBe(p);
    });

    it("반환 좌표는 입력과 다른 객체 (참조 분리) 이나 periodStart 는 참조 공유", () => {
      const start = new Date("2026-07-01T00:00:00.000Z");
      const t = coord({ personId: "x", periodStart: start });
      const plan = computeOverwriteReevalPlan("reeval", [t], []);
      expect(plan.toCreate[0]).not.toBe(t);
      // periodStart 는 방어 복제 안 함 — 읽기 전용 식별 축, 참조 그대로.
      expect(plan.toCreate[0].periodStart).toBe(start);
    });
  });
});
