// summary-relative-comparison.ts 의 colocated unit test (CLAUDE.md §3.2 R-112 —
// happy / error / branch / negative cases 충분 cover).
// `computeRelativeComparison` 순수 함수의 결정적 상대 비교 산출(정규화 0 절하 +
// 내림차순 competition ranking + 백분위 + cohort 평균 + 동점 최초 등장 순서 보존 +
// 결정성 + 비변형 + 계약 위반 throw 2 종)을 검증한다. 신규 파일 100% 지향 — 모든
// 분기를 cover 한다.

import {
  computeRelativeComparison,
  type PersonRelativeStanding,
  type RelativeComparisonEntry,
  type RelativeComparisonResult,
} from "./summary-relative-comparison";

// RelativeComparisonEntry stub 빌더. 좌표 안의 person 1 명 입력.
function makeEntry(
  personId: string,
  metricScore: number,
): RelativeComparisonEntry {
  return { personId, metricScore };
}

// byPerson 을 (personId, rank) 쌍으로 축약해 순서·순위를 한 번에 단언한다.
function rankPairs(result: RelativeComparisonResult): [string, number][] {
  return result.byPerson.map((standing) => [standing.personId, standing.rank]);
}

describe("computeRelativeComparison", () => {
  // --- Happy path (public symbol 4 개 전부 사용) ---
  describe("happy path", () => {
    it("서로 다른 점수 4 명의 cohortSize · mean · rank · percentile 을 손계산과 일치시킨다", () => {
      // gildong 9, younghee 6, chulsoo 3, minsu 1 → 합 19, 평균 19/4 = 4.75.
      // rank 는 1,2,3,4 이고 percentile 은 자신보다 낮은 인원 수/4 × 100 =
      // 75 / 50 / 25 / 0.
      const result: RelativeComparisonResult = computeRelativeComparison([
        makeEntry("gildong", 9),
        makeEntry("younghee", 6),
        makeEntry("chulsoo", 3),
        makeEntry("minsu", 1),
      ]);

      expect(result.cohortSize).toBe(4);
      expect(result.mean).toBe(4.75);
      expect(result.byPerson).toEqual([
        { personId: "gildong", metricScore: 9, rank: 1, percentile: 75 },
        { personId: "younghee", metricScore: 6, rank: 2, percentile: 50 },
        { personId: "chulsoo", metricScore: 3, rank: 3, percentile: 25 },
        { personId: "minsu", metricScore: 1, rank: 4, percentile: 0 },
      ]);
    });

    it("반환 객체와 원소가 선언된 타입 shape 를 그대로 노출한다", () => {
      // 타입 3 종(RelativeComparisonEntry / PersonRelativeStanding /
      // RelativeComparisonResult)을 필드 shape 단언으로 cover 한다.
      const entries: RelativeComparisonEntry[] = [
        makeEntry("gildong", 2.5),
        makeEntry("younghee", 1.25),
      ];
      const result: RelativeComparisonResult =
        computeRelativeComparison(entries);

      expect(Object.keys(result).sort()).toEqual([
        "byPerson",
        "cohortSize",
        "mean",
      ]);
      const top: PersonRelativeStanding = result.byPerson[0];
      expect(Object.keys(top).sort()).toEqual([
        "metricScore",
        "percentile",
        "personId",
        "rank",
      ]);
      expect(typeof top.personId).toBe("string");
      expect(typeof top.metricScore).toBe("number");
      expect(typeof top.rank).toBe("number");
      expect(typeof top.percentile).toBe("number");
      expect(result.mean).toBe(1.875);
    });

    it("정밀도 6 자리에서 mean 과 percentile 을 결정적으로 round 한다", () => {
      // 합 13/3 = 4.3333333... → 4.333333, percentile 1/3 × 100 → 33.333333.
      const result = computeRelativeComparison([
        makeEntry("gildong", 5),
        makeEntry("younghee", 5),
        makeEntry("chulsoo", 3),
      ]);

      expect(result.mean).toBe(4.333333);
      expect(result.byPerson[0].percentile).toBe(33.333333);
    });
  });

  // --- Error path (throw 경로 2 종) ---
  describe("error path", () => {
    it("entries 가 null 이면 함수명을 포함한 한국어 TypeError 를 던진다", () => {
      expect(() =>
        computeRelativeComparison(null as unknown as RelativeComparisonEntry[]),
      ).toThrow(TypeError);
      expect(() =>
        computeRelativeComparison(null as unknown as RelativeComparisonEntry[]),
      ).toThrow(
        "computeRelativeComparison: entries 는 null/undefined 일 수 없습니다",
      );
    });

    it("entries 가 undefined 이면 함수명을 포함한 한국어 TypeError 를 던진다", () => {
      expect(() =>
        computeRelativeComparison(
          undefined as unknown as RelativeComparisonEntry[],
        ),
      ).toThrow(
        "computeRelativeComparison: entries 는 null/undefined 일 수 없습니다",
      );
    });

    it("같은 personId 가 2 회 등장하면 좌표 계약 위반 한국어 TypeError 를 던진다", () => {
      expect(() =>
        computeRelativeComparison([
          makeEntry("gildong", 5),
          makeEntry("younghee", 3),
          makeEntry("gildong", 1),
        ]),
      ).toThrow(TypeError);
      expect(() =>
        computeRelativeComparison([
          makeEntry("gildong", 5),
          makeEntry("gildong", 1),
        ]),
      ).toThrow(
        "computeRelativeComparison: personId 가 중복되었습니다(좌표당 person 1 행 계약 위반): gildong",
      );
    });
  });

  // --- 분기별 cover ---
  describe("분기", () => {
    it("빈 배열은 throw 없이 결정적 0 산출을 반환한다", () => {
      expect(computeRelativeComparison([])).toEqual({
        cohortSize: 0,
        mean: 0,
        byPerson: [],
      });
    });

    it("cohortSize 1 은 rank 1 · percentile 0 · mean = 그 점수다", () => {
      const result = computeRelativeComparison([makeEntry("gildong", 7)]);

      expect(result.cohortSize).toBe(1);
      expect(result.mean).toBe(7);
      expect(result.byPerson).toEqual([
        { personId: "gildong", metricScore: 7, rank: 1, percentile: 0 },
      ]);
    });

    it("동점이 있으면 같은 rank 를 부여한다", () => {
      const result = computeRelativeComparison([
        makeEntry("gildong", 4),
        makeEntry("younghee", 4),
        makeEntry("chulsoo", 1),
      ]);

      expect(rankPairs(result)).toEqual([
        ["gildong", 1],
        ["younghee", 1],
        ["chulsoo", 3],
      ]);
    });

    it("동점이 없으면 rank 가 1 씩 증가한다", () => {
      const result = computeRelativeComparison([
        makeEntry("gildong", 4),
        makeEntry("younghee", 3),
        makeEntry("chulsoo", 2),
      ]);

      expect(rankPairs(result)).toEqual([
        ["gildong", 1],
        ["younghee", 2],
        ["chulsoo", 3],
      ]);
    });

    it("비-number metricScore(문자열 · null · 부재)는 throw 없이 0 으로 절하한다", () => {
      const result = computeRelativeComparison([
        makeEntry("gildong", 6),
        { personId: "younghee", metricScore: "3" as unknown as number },
        { personId: "chulsoo", metricScore: null as unknown as number },
        { personId: "minsu", metricScore: undefined as unknown as number },
      ]);

      // 절하된 0 이 byPerson 에도 그대로 실린다(은폐 없음). 평균 = 6/4 = 1.5.
      expect(result.mean).toBe(1.5);
      expect(result.byPerson.map((s) => s.metricScore)).toEqual([6, 0, 0, 0]);
      expect(rankPairs(result)).toEqual([
        ["gildong", 1],
        ["younghee", 2],
        ["chulsoo", 2],
        ["minsu", 2],
      ]);
    });

    it("비유한수(NaN · Infinity · -Infinity)는 throw 없이 0 으로 절하한다", () => {
      const result = computeRelativeComparison([
        makeEntry("gildong", Number.NaN),
        makeEntry("younghee", Number.POSITIVE_INFINITY),
        makeEntry("chulsoo", Number.NEGATIVE_INFINITY),
        makeEntry("minsu", 2),
      ]);

      expect(result.mean).toBe(0.5);
      expect(result.byPerson).toEqual([
        { personId: "minsu", metricScore: 2, rank: 1, percentile: 75 },
        { personId: "gildong", metricScore: 0, rank: 2, percentile: 0 },
        { personId: "younghee", metricScore: 0, rank: 2, percentile: 0 },
        { personId: "chulsoo", metricScore: 0, rank: 2, percentile: 0 },
      ]);
    });
  });

  // --- Negative cases (예외 분기마다 1+) ---
  describe("negative cases", () => {
    it("① 동점 뒤 rank 가 동점 인원 수만큼 건너뛴다(1,1,3)", () => {
      const result = computeRelativeComparison([
        makeEntry("gildong", 8),
        makeEntry("younghee", 8),
        makeEntry("chulsoo", 5),
        makeEntry("minsu", 2),
      ]);

      // 2 를 건너뛴 3 이어야 한다 — dense ranking(1,1,2) 이 아니다.
      expect(result.byPerson.map((s) => s.rank)).toEqual([1, 1, 3, 4]);
    });

    it("② 최하위의 percentile 은 0 이다", () => {
      const result = computeRelativeComparison([
        makeEntry("gildong", 10),
        makeEntry("younghee", 5),
        makeEntry("chulsoo", 0),
      ]);

      expect(result.byPerson[result.byPerson.length - 1]).toEqual({
        personId: "chulsoo",
        metricScore: 0,
        rank: 3,
        percentile: 0,
      });
    });

    it("③ 동점자의 percentile 은 서로 같다", () => {
      const result = computeRelativeComparison([
        makeEntry("gildong", 7),
        makeEntry("younghee", 7),
        makeEntry("chulsoo", 1),
        makeEntry("minsu", 0),
      ]);

      const [first, second] = result.byPerson;
      // 자신보다 낮은 인원 2 명 / 4 × 100 = 50.
      expect(first.percentile).toBe(50);
      expect(second.percentile).toBe(50);
    });

    it("④ 입력 배열과 원소를 변형하지 않는다", () => {
      const entries = [
        makeEntry("gildong", 3),
        makeEntry("younghee", 9),
        { personId: "chulsoo", metricScore: Number.NaN },
      ];
      const snapshot = entries.map((entry) => ({ ...entry }));

      computeRelativeComparison(entries);

      expect(entries).toHaveLength(3);
      expect(entries[0]).toEqual(snapshot[0]);
      expect(entries[1]).toEqual(snapshot[1]);
      // NaN 원소는 toEqual 로 비교되지 않으므로 필드별로 확인한다.
      expect(entries[2].personId).toBe("chulsoo");
      expect(Number.isNaN(entries[2].metricScore)).toBe(true);
    });

    it("⑤ 같은 입력을 2 회 호출하면 deep-equal 결과가 나온다(결정성)", () => {
      const entries = [
        makeEntry("gildong", 4.123456789),
        makeEntry("younghee", 4.123456789),
        makeEntry("chulsoo", 1),
      ];

      expect(computeRelativeComparison(entries)).toEqual(
        computeRelativeComparison(entries),
      );
    });

    it("⑥ 입력 순서를 뒤섞어도 rank · percentile 은 불변이고 동점 내부만 최초 등장 순서를 따른다", () => {
      const forward = computeRelativeComparison([
        makeEntry("gildong", 5),
        makeEntry("younghee", 5),
        makeEntry("chulsoo", 9),
      ]);
      const shuffled = computeRelativeComparison([
        makeEntry("younghee", 5),
        makeEntry("chulsoo", 9),
        makeEntry("gildong", 5),
      ]);

      expect(forward.cohortSize).toBe(shuffled.cohortSize);
      expect(forward.mean).toBe(shuffled.mean);
      // rank · percentile 수열은 순서 무관하게 동일하다.
      expect(forward.byPerson.map((s) => s.rank)).toEqual([1, 2, 2]);
      expect(shuffled.byPerson.map((s) => s.rank)).toEqual([1, 2, 2]);
      expect(forward.byPerson.map((s) => s.percentile)).toEqual([
        66.666667, 0, 0,
      ]);
      expect(shuffled.byPerson.map((s) => s.percentile)).toEqual([
        66.666667, 0, 0,
      ]);
      // 동점 내부 순서만 입력 최초 등장 순서를 따라 뒤바뀐다.
      expect(forward.byPerson.map((s) => s.personId)).toEqual([
        "chulsoo",
        "gildong",
        "younghee",
      ]);
      expect(shuffled.byPerson.map((s) => s.personId)).toEqual([
        "chulsoo",
        "younghee",
        "gildong",
      ]);
    });
  });
});
