// evaluation-persisted-period-coordinates.spec — projectPersistedPeriodCoordinates
// 순수 helper 의 colocated 단위 테스트. R-112 4 종(happy / error path / flow·branch /
// negative cases 충분 cover)을 모두 cover 하며, 신규 도메인 파일 100%(line/branch/
// function/stmt) 목표. 패턴 mirror: evaluation-intended-period-coordinates.spec.ts /
// evaluation-unevaluated-period-select.spec.ts (순수 함수 결정성·비변형·방어 입력 검증).

import { projectPersistedPeriodCoordinates } from "./evaluation-persisted-period-coordinates";
import type { PersistedAssessmentRecord } from "./evaluation-persisted-period-coordinates";

// 테스트 fixture — 영속 레코드(좌표 4-field + 추가 컬럼 혼재)를 만든다. 추가 컬럼은
// 좌표 투영에서 무시되어야 한다(출력 누출 0 검증용).
function makeRecord(
  overrides: Partial<PersistedAssessmentRecord> = {},
): PersistedAssessmentRecord {
  return {
    personId: "p1",
    period: "month",
    scope: "engineering",
    periodStart: new Date("2026-01-01T00:00:00.000Z"),
    // 추가 컬럼 — 투영 시 무시되어야 함.
    id: "assessment-1",
    difficulty: "HARD",
    contributionScore: 42,
    volume: 7,
    narrative: "임팩트 있는 기여",
    ...overrides,
  };
}

describe("projectPersistedPeriodCoordinates", () => {
  describe("happy path", () => {
    it("단일 레코드를 좌표 4-field 로만 투영한다(추가 컬럼 누출 0)", () => {
      const periodStart = new Date("2026-02-01T00:00:00.000Z");
      const result = projectPersistedPeriodCoordinates([
        makeRecord({ personId: "alice", periodStart }),
      ]);

      expect(result).toHaveLength(1);
      // 좌표 4-field 만 정확히 존재 — 추가 컬럼(id/difficulty/narrative 등) 누출 0.
      expect(Object.keys(result[0]).sort()).toEqual([
        "period",
        "periodStart",
        "personId",
        "scope",
      ]);
      expect(result[0]).toEqual({
        personId: "alice",
        period: "month",
        scope: "engineering",
        periodStart,
      });
      expect(result[0]).not.toHaveProperty("difficulty");
      expect(result[0]).not.toHaveProperty("narrative");
      expect(result[0]).not.toHaveProperty("id");
    });

    it("다수 레코드를 입력 등장 순서 보존으로 투영한다", () => {
      const records = [
        makeRecord({ personId: "a" }),
        makeRecord({ personId: "b" }),
        makeRecord({ personId: "c" }),
      ];
      const result = projectPersistedPeriodCoordinates(records);

      expect(result.map((c) => c.personId)).toEqual(["a", "b", "c"]);
    });
  });

  describe("error path — 방어적 입력 처리", () => {
    it("records 가 null 이면 TypeError", () => {
      expect(() =>
        projectPersistedPeriodCoordinates(
          null as unknown as PersistedAssessmentRecord[],
        ),
      ).toThrow(TypeError);
    });

    it("records 가 undefined 이면 TypeError", () => {
      expect(() =>
        projectPersistedPeriodCoordinates(
          undefined as unknown as PersistedAssessmentRecord[],
        ),
      ).toThrow(TypeError);
    });

    it("records 가 배열이 아니면 TypeError", () => {
      expect(() =>
        projectPersistedPeriodCoordinates(
          "not-array" as unknown as PersistedAssessmentRecord[],
        ),
      ).toThrow(/배열이어야 한다/);
    });

    it("원소가 null 이면 TypeError", () => {
      expect(() =>
        projectPersistedPeriodCoordinates([
          null as unknown as PersistedAssessmentRecord,
        ]),
      ).toThrow(/null\/undefined/);
    });

    it("원소가 undefined 이면 TypeError", () => {
      expect(() =>
        projectPersistedPeriodCoordinates([
          undefined as unknown as PersistedAssessmentRecord,
        ]),
      ).toThrow(TypeError);
    });

    it("personId 누락이면 TypeError", () => {
      const bad = makeRecord();
      delete (bad as { personId?: string }).personId;
      expect(() => projectPersistedPeriodCoordinates([bad])).toThrow(
        /personId 는 string/,
      );
    });

    it("period 가 non-string 이면 TypeError", () => {
      expect(() =>
        projectPersistedPeriodCoordinates([
          makeRecord({ period: 123 as unknown as string }),
        ]),
      ).toThrow(/period 는 string/);
    });

    it("scope 누락이면 TypeError", () => {
      const bad = makeRecord();
      delete (bad as { scope?: string }).scope;
      expect(() => projectPersistedPeriodCoordinates([bad])).toThrow(
        /scope 는 string/,
      );
    });

    it("periodStart 가 Date 가 아니면 TypeError", () => {
      expect(() =>
        projectPersistedPeriodCoordinates([
          makeRecord({
            periodStart: "2026-01-01" as unknown as Date,
          }),
        ]),
      ).toThrow(/periodStart 는 유효한 Date/);
    });

    it("periodStart 가 Invalid Date 이면 TypeError", () => {
      expect(() =>
        projectPersistedPeriodCoordinates([
          makeRecord({ periodStart: new Date("invalid") }),
        ]),
      ).toThrow(/periodStart 는 유효한 Date/);
    });
  });

  describe("flow / branch coverage", () => {
    it("(a) 빈 records → 빈 배열", () => {
      expect(projectPersistedPeriodCoordinates([])).toEqual([]);
    });

    it("(b) 단일 레코드", () => {
      const result = projectPersistedPeriodCoordinates([makeRecord()]);
      expect(result).toHaveLength(1);
    });

    it("(c) 다수 레코드 — 순서 보존", () => {
      const result = projectPersistedPeriodCoordinates([
        makeRecord({ scope: "s1" }),
        makeRecord({ scope: "s2" }),
      ]);
      expect(result.map((c) => c.scope)).toEqual(["s1", "s2"]);
    });

    it("(d) 추가 컬럼 포함 레코드 → 좌표 4-field 만 투영, 추가 컬럼 누출 0", () => {
      const result = projectPersistedPeriodCoordinates([makeRecord()]);
      expect(Object.keys(result[0])).toHaveLength(4);
    });

    it("(e) 같은 좌표 중복 등장 → dedup 안 함(중복 보존)", () => {
      const result = projectPersistedPeriodCoordinates([
        makeRecord({ personId: "dup" }),
        makeRecord({ personId: "dup" }),
      ]);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(result[1]);
    });

    it("(f) 동일 instant 의 서로 다른 Date 객체 두 레코드 → 각각 독립 투영(병합 안 함)", () => {
      const dateA = new Date("2026-03-01T00:00:00.000Z");
      const dateB = new Date("2026-03-01T00:00:00.000Z");
      expect(dateA).not.toBe(dateB);
      expect(dateA.getTime()).toBe(dateB.getTime());

      const result = projectPersistedPeriodCoordinates([
        makeRecord({ periodStart: dateA }),
        makeRecord({ periodStart: dateB }),
      ]);
      expect(result).toHaveLength(2);
      // 병합/정규화 0 — 입력 Date 참조 그대로 보존.
      expect(result[0].periodStart).toBe(dateA);
      expect(result[1].periodStart).toBe(dateB);
    });
  });

  describe("negative cases 충분 cover", () => {
    it("① personId 가 number 면 TypeError", () => {
      expect(() =>
        projectPersistedPeriodCoordinates([
          makeRecord({ personId: 7 as unknown as string }),
        ]),
      ).toThrow(/personId 는 string/);
    });

    it("② personId 빈 문자열 허용(정규화 안 함, exact match)", () => {
      const result = projectPersistedPeriodCoordinates([
        makeRecord({ personId: "" }),
      ]);
      expect(result[0].personId).toBe("");
    });

    it("③ scope / period 빈 문자열 허용(exact match)", () => {
      const result = projectPersistedPeriodCoordinates([
        makeRecord({ scope: "", period: "" }),
      ]);
      expect(result[0].scope).toBe("");
      expect(result[0].period).toBe("");
    });

    it("④ 입력 배열·레코드 비변형 — 반환 좌표 mutate 시 입력 레코드 불변", () => {
      const record = makeRecord({ personId: "orig" });
      const records = [record];
      const result = projectPersistedPeriodCoordinates(records);

      // 반환 좌표를 mutate 해도 입력 레코드는 영향받지 않는다(새 객체).
      result[0].personId = "mutated";
      expect(record.personId).toBe("orig");
      // 입력 배열 자체도 비변형(길이·원소 그대로).
      expect(records).toHaveLength(1);
      expect(records[0]).toBe(record);
    });

    it("⑤ 출력 좌표 periodStart.getTime() 이 입력 instant 와 정확히 일치(투영 충실성)", () => {
      const periodStart = new Date("2026-04-15T09:30:00.000Z");
      const result = projectPersistedPeriodCoordinates([
        makeRecord({ periodStart }),
      ]);
      expect(result[0].periodStart.getTime()).toBe(periodStart.getTime());
      expect(result[0].periodStart).toBe(periodStart);
    });

    it("⑥ 입력 내부 중복 좌표(동일 4-tuple 2 건) → 출력도 2 건(dedup 안 함)", () => {
      const periodStart = new Date("2026-05-01T00:00:00.000Z");
      const result = projectPersistedPeriodCoordinates([
        makeRecord({ personId: "x", periodStart }),
        makeRecord({ personId: "x", periodStart }),
      ]);
      expect(result).toHaveLength(2);
    });

    it("⑦ 추가 컬럼만 다르고 좌표 4-field 동일한 두 레코드 → 출력 좌표 2 건 동일", () => {
      const periodStart = new Date("2026-06-01T00:00:00.000Z");
      const result = projectPersistedPeriodCoordinates([
        makeRecord({ personId: "y", periodStart, difficulty: "EASY" }),
        makeRecord({ personId: "y", periodStart, difficulty: "HARD" }),
      ]);
      expect(result).toHaveLength(2);
      // 좌표 4-field 만 보면 동일(추가 컬럼 difficulty 무시 확인).
      expect(result[0]).toEqual(result[1]);
    });
  });
});
