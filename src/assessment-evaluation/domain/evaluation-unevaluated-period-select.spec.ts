// evaluation-unevaluated-period-select.spec — selectUnevaluatedPeriods 순수 함수
// 단위 테스트(R-112: happy / error / flow-branch / negative 충분 cover).
// 좌표 차집합(intended \ persisted) 의 결정성·순서 보존·instant 매칭·exact match·
// 비변형·방어적 입력 처리를 검증한다.

import type { EvaluationPersistContext } from "./evaluation-result.persist.mapper";
import { selectUnevaluatedPeriods } from "./evaluation-unevaluated-period-select";

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

describe("selectUnevaluatedPeriods", () => {
  describe("happy path", () => {
    it("intended 일부가 persisted 와 겹치면 gap subset 만 등장 순서 보존으로 반환한다", () => {
      const a = coord("p1", "2026-Q1", "team", ISO_A);
      const b = coord("p1", "2026-Q1", "team", ISO_B);
      const c = coord("p1", "2026-Q1", "team", ISO_C);
      const intended = [a, b, c];
      const persisted = [coord("p1", "2026-Q1", "team", ISO_B)];

      const result = selectUnevaluatedPeriods(intended, persisted);

      // b 는 persisted 에 있으므로 제외, a·c 만 입력 순서대로.
      expect(result).toEqual([a, c]);
      expect(result[0]).toBe(a);
      expect(result[1]).toBe(c);
    });

    it("persisted 가 빈 배열이면 intended 전체를 반환한다", () => {
      const intended = [
        coord("p1", "2026-Q1", "team", ISO_A),
        coord("p2", "2026-Q1", "team", ISO_B),
      ];

      const result = selectUnevaluatedPeriods(intended, []);

      expect(result).toEqual(intended);
      expect(result).toHaveLength(2);
    });

    it("persisted 가 intended 를 전부 cover 하면 빈 배열을 반환한다", () => {
      const intended = [
        coord("p1", "2026-Q1", "team", ISO_A),
        coord("p1", "2026-Q1", "team", ISO_B),
      ];
      const persisted = [
        coord("p1", "2026-Q1", "team", ISO_A),
        coord("p1", "2026-Q1", "team", ISO_B),
      ];

      expect(selectUnevaluatedPeriods(intended, persisted)).toEqual([]);
    });
  });

  describe("flow / branch coverage", () => {
    it("(a) gap 존재 — 미평가 좌표만 선별", () => {
      const gap = coord("p1", "2026-Q1", "team", ISO_C);
      const intended = [coord("p1", "2026-Q1", "team", ISO_A), gap];
      const persisted = [coord("p1", "2026-Q1", "team", ISO_A)];

      expect(selectUnevaluatedPeriods(intended, persisted)).toEqual([gap]);
    });

    it("(b) gap 부재 — 전부 cover 시 빈 배열", () => {
      const intended = [coord("p1", "2026-Q1", "team", ISO_A)];
      const persisted = [coord("p1", "2026-Q1", "team", ISO_A)];

      expect(selectUnevaluatedPeriods(intended, persisted)).toEqual([]);
    });

    it("(c) persisted 빈 배열 — intended 전체 gap", () => {
      const intended = [coord("p1", "2026-Q1", "team", ISO_A)];

      expect(selectUnevaluatedPeriods(intended, [])).toEqual(intended);
    });

    it("(d) intended 빈 배열 — 빈 배열 반환", () => {
      const persisted = [coord("p1", "2026-Q1", "team", ISO_A)];

      expect(selectUnevaluatedPeriods([], persisted)).toEqual([]);
    });

    it("(e) periodStart 동일 instant 다른 Date 객체가 매칭된다(시각 동일성)", () => {
      // 같은 instant 를 서로 다른 표현(Z vs +09:00 offset)으로 만든 별개 Date 객체.
      const intended = [coord("p1", "2026-Q1", "team", new Date(ISO_A))];
      const persisted = [
        coord(
          "p1",
          "2026-Q1",
          "team",
          new Date("2026-01-01T09:00:00.000+09:00"),
        ),
      ];

      // 객체 참조는 다르지만 getTime() 이 동일 → 매칭되어 gap 0.
      expect(selectUnevaluatedPeriods(intended, persisted)).toEqual([]);
    });

    it("(f) 4-tuple 중 1개만 달라도 별도 좌표로 gap 유지", () => {
      const base = coord("p1", "2026-Q1", "team", ISO_A);
      const intended = [
        base,
        coord("p2", "2026-Q1", "team", ISO_A), // personId 만 다름
        coord("p1", "2026-Q2", "team", ISO_A), // period 만 다름
        coord("p1", "2026-Q1", "org", ISO_A), // scope 만 다름
        coord("p1", "2026-Q1", "team", ISO_B), // periodStart 만 다름
      ];
      const persisted = [base];

      // base 만 cover, 나머지 4개는 각각 다른 좌표라 gap 유지.
      const result = selectUnevaluatedPeriods(intended, persisted);
      expect(result).toHaveLength(4);
      expect(result).not.toContain(base);
    });
  });

  describe("error path", () => {
    it("intended 가 null 이면 한국어 메시지 TypeError", () => {
      expect(() =>
        selectUnevaluatedPeriods(
          null as unknown as EvaluationPersistContext[],
          [],
        ),
      ).toThrow(TypeError);
      expect(() =>
        selectUnevaluatedPeriods(
          null as unknown as EvaluationPersistContext[],
          [],
        ),
      ).toThrow("intended 배열이 null/undefined 일 수 없다.");
    });

    it("intended 가 undefined 이면 TypeError", () => {
      expect(() =>
        selectUnevaluatedPeriods(
          undefined as unknown as EvaluationPersistContext[],
          [],
        ),
      ).toThrow(TypeError);
    });

    it("persisted 가 null 이면 한국어 메시지 TypeError", () => {
      expect(() =>
        selectUnevaluatedPeriods(
          [],
          null as unknown as EvaluationPersistContext[],
        ),
      ).toThrow("persisted 배열이 null/undefined 일 수 없다.");
    });

    it("persisted 가 undefined 이면 TypeError", () => {
      expect(() =>
        selectUnevaluatedPeriods(
          [],
          undefined as unknown as EvaluationPersistContext[],
        ),
      ).toThrow(TypeError);
    });

    it("원소가 null 이면 TypeError(좌표 무결성 위반 조기 노출)", () => {
      const intended = [null as unknown as EvaluationPersistContext];
      expect(() => selectUnevaluatedPeriods(intended, [])).toThrow(TypeError);
      expect(() => selectUnevaluatedPeriods(intended, [])).toThrow(
        "intended 좌표 원소가 null/undefined 일 수 없다.",
      );
    });

    it("persisted 원소가 undefined 이면 TypeError", () => {
      const persisted = [undefined as unknown as EvaluationPersistContext];
      expect(() => selectUnevaluatedPeriods([], persisted)).toThrow(
        "persisted 좌표 원소가 null/undefined 일 수 없다.",
      );
    });

    it("personId 가 string 이 아니면 TypeError", () => {
      const bad = {
        personId: 123 as unknown as string,
        period: "2026-Q1",
        scope: "team",
        periodStart: new Date(ISO_A),
      };
      expect(() => selectUnevaluatedPeriods([bad], [])).toThrow(
        "intended 좌표의 personId 는 string 이어야 한다",
      );
    });

    it("period 가 누락(undefined)이면 TypeError", () => {
      const bad = {
        personId: "p1",
        period: undefined as unknown as string,
        scope: "team",
        periodStart: new Date(ISO_A),
      };
      expect(() => selectUnevaluatedPeriods([bad], [])).toThrow(
        "intended 좌표의 period 는 string 이어야 한다",
      );
    });

    it("scope 가 string 이 아니면 TypeError", () => {
      const bad = {
        personId: "p1",
        period: "2026-Q1",
        scope: {} as unknown as string,
        periodStart: new Date(ISO_A),
      };
      expect(() => selectUnevaluatedPeriods([bad], [])).toThrow(
        "intended 좌표의 scope 는 string 이어야 한다",
      );
    });

    it("periodStart 가 Date 가 아니면 TypeError", () => {
      const bad = {
        personId: "p1",
        period: "2026-Q1",
        scope: "team",
        periodStart: ISO_A as unknown as Date,
      };
      expect(() => selectUnevaluatedPeriods([bad], [])).toThrow(
        "intended 좌표의 periodStart 는 Date 여야 한다",
      );
    });
  });

  describe("negative cases", () => {
    it("② intended 내부 중복 gap 좌표는 dedup 하지 않고 모두 반환한다", () => {
      const dup1 = coord("p1", "2026-Q1", "team", ISO_A);
      const dup2 = coord("p1", "2026-Q1", "team", ISO_A); // 동일 좌표 키
      const result = selectUnevaluatedPeriods([dup1, dup2], []);

      // 차집합 멤버십만 판정 — 중복 gap 은 등장 횟수만큼 모두 유지.
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(dup1);
      expect(result[1]).toBe(dup2);
    });

    it("② intended 내부 중복이 persisted 에 있으면 중복 전부 제외", () => {
      const dup1 = coord("p1", "2026-Q1", "team", ISO_A);
      const dup2 = coord("p1", "2026-Q1", "team", ISO_A);
      const persisted = [coord("p1", "2026-Q1", "team", ISO_A)];

      expect(selectUnevaluatedPeriods([dup1, dup2], persisted)).toEqual([]);
    });

    it("③ persisted 에만 있고 intended 에 없는 좌표는 반환에 누출되지 않는다", () => {
      const a = coord("p1", "2026-Q1", "team", ISO_A);
      const onlyPersisted = coord("pX", "2026-Q9", "ghost", ISO_C);
      const intended = [a];
      const persisted = [onlyPersisted];

      const result = selectUnevaluatedPeriods(intended, persisted);
      expect(result).toEqual([a]);
      expect(result).not.toContain(onlyPersisted);
    });

    it("④ periodStart 가 Invalid Date 면 결정적 sentinel 로 한 좌표로 묶인다", () => {
      const invalid1 = coord("p1", "2026-Q1", "team", new Date("nonsense"));
      const invalid2 = coord("p1", "2026-Q1", "team", new Date(NaN));
      // 둘 다 Invalid Date → 동일 좌표 키 → persisted 의 invalid 가 intended 의 invalid 를 cover.
      expect(selectUnevaluatedPeriods([invalid1], [invalid2])).toEqual([]);
    });

    it("④ Invalid Date 좌표는 valid Date 좌표와 다른 키(매칭 안 됨)", () => {
      const invalid = coord("p1", "2026-Q1", "team", new Date("nonsense"));
      const valid = coord("p1", "2026-Q1", "team", ISO_A);

      // persisted 의 valid 가 intended 의 invalid 를 cover 하지 않음 → gap 유지.
      expect(selectUnevaluatedPeriods([invalid], [valid])).toEqual([invalid]);
    });

    it("⑤ 빈 문자열 personId/period/scope 는 유효 경계값으로 exact match 된다", () => {
      const empty = coord("", "", "", ISO_A);
      const intended = [empty];
      const persisted = [coord("", "", "", ISO_A)];

      // 빈 문자열도 정상 좌표 — persisted 와 정확히 일치하므로 gap 0.
      expect(selectUnevaluatedPeriods(intended, persisted)).toEqual([]);
    });

    it("⑤ 빈 문자열 좌표가 persisted 에 없으면 gap 으로 반환", () => {
      const empty = coord("", "", "", ISO_A);
      expect(selectUnevaluatedPeriods([empty], [])).toEqual([empty]);
    });

    it("⑥ 대소문자 차이는 별도 좌표로 취급된다(정규화 안 함)", () => {
      const lower = coord("p1", "2026-q1", "team", ISO_A);
      const persisted = [coord("p1", "2026-Q1", "team", ISO_A)]; // Q 대문자

      // 대소문자 다르면 별도 좌표 → cover 안 됨 → gap 유지.
      expect(selectUnevaluatedPeriods([lower], persisted)).toEqual([lower]);
    });

    it("⑥ 공백 차이는 별도 좌표로 취급되며 키 경계 충돌이 없다", () => {
      // ("a","b",...) 과 ("a b","",...) 가 구분자 충돌로 같은 키가 되면 안 됨.
      const x = coord("a", "b", "team", ISO_A);
      const y = coord("a b", "", "team", ISO_A);
      const persisted = [x];

      // y 는 x 와 다른 좌표라 cover 안 됨 → gap 유지(키 collision 방지 검증).
      expect(selectUnevaluatedPeriods([x, y], persisted)).toEqual([y]);
    });
  });

  describe("비변형(부수효과 0)", () => {
    it("입력 배열·원소를 mutate 하지 않는다", () => {
      const a = coord("p1", "2026-Q1", "team", ISO_A);
      const b = coord("p1", "2026-Q1", "team", ISO_B);
      const intended = [a, b];
      const persisted = [coord("p1", "2026-Q1", "team", ISO_A)];
      const intendedSnapshot = [...intended];
      const persistedSnapshot = [...persisted];

      selectUnevaluatedPeriods(intended, persisted);

      expect(intended).toEqual(intendedSnapshot);
      expect(persisted).toEqual(persistedSnapshot);
      // 원소 객체도 동일 참조 유지.
      expect(intended[0]).toBe(a);
      expect(intended[1]).toBe(b);
    });
  });
});
