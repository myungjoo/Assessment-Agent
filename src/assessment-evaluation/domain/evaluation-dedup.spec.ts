// evaluation-dedup.ts 의 colocated unit test (CLAUDE.md §3.2 R-112 — happy / error /
// branch / negative cases 충분 cover). 평가-side dedup 순수 함수 2 종
// (dedupTemporalDuplicates = 시간적 중복 earlier-date 우선 R-21,
//  excludeSelfFollowUps = self-follow-up 제외 R-30)의 결정적 동작을 검증한다.
// 모든 분기(earlier 교체 / tie 유지 / NaN fallback / document vs code /
//  author 동일성 same vs different)를 cover + 입력 비변형 + 결정성 + compose 정합.

import type {
  ActivityMetadata,
  ActivitySourceType,
} from "../../assessment-collection/domain/activity";

import {
  dedupTemporalDuplicates,
  excludeSelfFollowUps,
} from "./evaluation-dedup";
import type { ContributionKind, EvaluationInput } from "./evaluation-input";

// makeInput — 테스트용 EvaluationInput 팩토리. 핵심 dedup 필드(unitId / timestamp /
// author / contributionKind)만 인자로 받고 나머지는 고정 stub.
function makeInput(
  overrides: Partial<EvaluationInput> & {
    unitId: string;
    timestamp: string;
  },
): EvaluationInput {
  const metadata: ActivityMetadata = overrides.metadata ?? {};
  return {
    unitId: overrides.unitId,
    contributionKind: overrides.contributionKind ?? "document",
    sourceType: (overrides.sourceType ?? "github") as ActivitySourceType,
    instanceKey: overrides.instanceKey ?? "sec",
    author: overrides.author ?? "gildong",
    timestamp: overrides.timestamp,
    metadata,
  };
}

// 자주 쓰는 timestamp 상수(2 월 < 3 월 — earlier-date 우선 검증용).
const FEB = "2026-02-15T09:00:00Z";
const MAR = "2026-03-15T09:00:00Z";
const APR = "2026-04-15T09:00:00Z";

describe("dedupTemporalDuplicates (시간적 중복 earlier-date 우선, R-21)", () => {
  describe("happy-path (R-112-1)", () => {
    it("같은 unitId 가 2 건(2 월 / 3 월)이면 earlier(2 월) 1 건만 반환한다", () => {
      const inputs = [
        makeInput({ unitId: "github:sec:42", timestamp: MAR }),
        makeInput({ unitId: "github:sec:42", timestamp: FEB }),
      ];
      const result = dedupTemporalDuplicates(inputs);
      expect(result).toHaveLength(1);
      expect(result[0].timestamp).toBe(FEB);
    });

    it("입력 순서가 2 월 먼저여도 earlier(2 월) 1 건만 유지한다", () => {
      const inputs = [
        makeInput({ unitId: "github:sec:42", timestamp: FEB }),
        makeInput({ unitId: "github:sec:42", timestamp: MAR }),
      ];
      const result = dedupTemporalDuplicates(inputs);
      expect(result).toHaveLength(1);
      expect(result[0].timestamp).toBe(FEB);
    });

    it("서로 다른 unitId 는 모두 보존하고 입력 순서를 유지한다", () => {
      const inputs = [
        makeInput({ unitId: "github:sec:1", timestamp: FEB }),
        makeInput({ unitId: "github:sec:2", timestamp: MAR }),
        makeInput({ unitId: "github:sec:3", timestamp: APR }),
      ];
      const result = dedupTemporalDuplicates(inputs);
      expect(result.map((r) => r.unitId)).toEqual([
        "github:sec:1",
        "github:sec:2",
        "github:sec:3",
      ]);
    });
  });

  describe("error / negative (R-112-2 충분 cover)", () => {
    it("빈 배열 → 빈 배열", () => {
      expect(dedupTemporalDuplicates([])).toEqual([]);
    });

    it("중복 0(모두 고유 unitId) → 입력 그대로(순서 보존)", () => {
      const inputs = [
        makeInput({ unitId: "github:sec:1", timestamp: FEB }),
        makeInput({ unitId: "github:sec:2", timestamp: MAR }),
      ];
      const result = dedupTemporalDuplicates(inputs);
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.unitId)).toEqual([
        "github:sec:1",
        "github:sec:2",
      ]);
    });

    it("동일 timestamp tie → 먼저 등장한 항목 유지(입력 순서 보존)", () => {
      const inputs = [
        makeInput({ unitId: "github:sec:42", timestamp: FEB, author: "first" }),
        makeInput({
          unitId: "github:sec:42",
          timestamp: FEB,
          author: "second",
        }),
      ];
      const result = dedupTemporalDuplicates(inputs);
      expect(result).toHaveLength(1);
      expect(result[0].author).toBe("first");
    });

    it("파싱 불가 timestamp 2 건 → 사전식 fallback 으로 결정적 순서(더 작은 문자열 유지)", () => {
      const inputs = [
        makeInput({ unitId: "github:sec:42", timestamp: "zzz-not-a-date" }),
        makeInput({ unitId: "github:sec:42", timestamp: "aaa-not-a-date" }),
      ];
      const result = dedupTemporalDuplicates(inputs);
      expect(result).toHaveLength(1);
      // "aaa..." < "zzz..." 사전식 — earlier 로 간주되어 유지.
      expect(result[0].timestamp).toBe("aaa-not-a-date");
    });

    it("한쪽만 파싱 불가 timestamp → NaN fallback 분기(사전식)로 결정적, 1 건만", () => {
      const inputs = [
        makeInput({ unitId: "github:sec:42", timestamp: FEB }),
        makeInput({ unitId: "github:sec:42", timestamp: "not-a-date" }),
      ];
      const result = dedupTemporalDuplicates(inputs);
      // 두 번째가 NaN 이라 isEarlier 가 false(사전식 "not..." < FEB 비교 결과 무관)면
      // 먼저 등장한 FEB 유지. 어느 쪽이든 1 건이고 결정적이어야 한다.
      expect(result).toHaveLength(1);
    });

    it("3+ 항목 동일 unitId → earliest(2 월) 1 건만", () => {
      const inputs = [
        makeInput({ unitId: "github:sec:42", timestamp: APR }),
        makeInput({ unitId: "github:sec:42", timestamp: FEB }),
        makeInput({ unitId: "github:sec:42", timestamp: MAR }),
      ];
      const result = dedupTemporalDuplicates(inputs);
      expect(result).toHaveLength(1);
      expect(result[0].timestamp).toBe(FEB);
    });
  });

  describe("branch cover — isEarlier 3 분기 (R-112-3)", () => {
    it("earlier 교체 분기: 나중에 더 이른 timestamp 등장 → winner 교체", () => {
      const inputs = [
        makeInput({ unitId: "u", timestamp: MAR }),
        makeInput({ unitId: "u", timestamp: FEB }),
      ];
      expect(dedupTemporalDuplicates(inputs)[0].timestamp).toBe(FEB);
    });

    it("tie/이후 유지 분기: 나중에 더 늦은 timestamp 등장 → 기존 유지", () => {
      const inputs = [
        makeInput({ unitId: "u", timestamp: FEB }),
        makeInput({ unitId: "u", timestamp: MAR }),
      ];
      expect(dedupTemporalDuplicates(inputs)[0].timestamp).toBe(FEB);
    });

    it("NaN fallback 분기: 양쪽 모두 비-파싱 timestamp 사전식 비교", () => {
      const inputs = [
        makeInput({ unitId: "u", timestamp: "b-bad" }),
        makeInput({ unitId: "u", timestamp: "a-bad" }),
      ];
      expect(dedupTemporalDuplicates(inputs)[0].timestamp).toBe("a-bad");
    });
  });

  describe("immutability / determinism (R-112-2)", () => {
    it("입력 배열을 변형하지 않는다(원본 length / 내용 보존)", () => {
      const inputs = [
        makeInput({ unitId: "u", timestamp: MAR }),
        makeInput({ unitId: "u", timestamp: FEB }),
      ];
      const before = [...inputs];
      dedupTemporalDuplicates(inputs);
      expect(inputs).toHaveLength(2);
      expect(inputs).toEqual(before);
    });

    it("새 배열을 반환한다(입력 배열과 다른 참조)", () => {
      const inputs = [makeInput({ unitId: "u", timestamp: FEB })];
      expect(dedupTemporalDuplicates(inputs)).not.toBe(inputs);
    });

    it("동일 입력 2 회 호출이 동일 출력이다(LLM 의존 0)", () => {
      const inputs = [
        makeInput({ unitId: "github:sec:1", timestamp: MAR }),
        makeInput({ unitId: "github:sec:1", timestamp: FEB }),
        makeInput({ unitId: "github:sec:2", timestamp: APR }),
      ];
      expect(dedupTemporalDuplicates(inputs)).toEqual(
        dedupTemporalDuplicates(inputs),
      );
    });
  });
});

describe("excludeSelfFollowUps (self-follow-up 제외, R-30)", () => {
  describe("happy-path (R-112-1)", () => {
    it("동일 (unitId, author) document 2 건(생성 + 동일-author 후속) → earliest 1 건만", () => {
      const inputs = [
        makeInput({
          unitId: "github:sec:99",
          author: "gildong",
          contributionKind: "document",
          timestamp: MAR,
        }),
        makeInput({
          unitId: "github:sec:99",
          author: "gildong",
          contributionKind: "document",
          timestamp: FEB,
        }),
      ];
      const result = excludeSelfFollowUps(inputs);
      expect(result).toHaveLength(1);
      // earliest(2 월 = 최초 기여)만 유지.
      expect(result[0].timestamp).toBe(FEB);
    });
  });

  describe("branch / negative (R-112-2/3 충분 cover)", () => {
    it("code 기여는 동일 키여도 제외하지 않는다(self-follow-up 부적용 분기 — 모두 보존)", () => {
      const inputs = [
        makeInput({
          unitId: "github:sec:1",
          author: "gildong",
          contributionKind: "code",
          timestamp: FEB,
        }),
        makeInput({
          unitId: "github:sec:1",
          author: "gildong",
          contributionKind: "code",
          timestamp: MAR,
        }),
      ];
      const result = excludeSelfFollowUps(inputs);
      expect(result).toHaveLength(2);
    });

    it("다른 author 의 동일 unitId document → 둘 다 보존(author 동일성 false 분기)", () => {
      const inputs = [
        makeInput({
          unitId: "github:sec:99",
          author: "gildong",
          contributionKind: "document",
          timestamp: FEB,
        }),
        makeInput({
          unitId: "github:sec:99",
          author: "younghee",
          contributionKind: "document",
          timestamp: MAR,
        }),
      ];
      const result = excludeSelfFollowUps(inputs);
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.author)).toEqual(["gildong", "younghee"]);
    });

    it("동일 author, 다른 unitId document → 둘 다 보존(별개 단위)", () => {
      const inputs = [
        makeInput({
          unitId: "github:sec:1",
          author: "gildong",
          contributionKind: "document",
          timestamp: FEB,
        }),
        makeInput({
          unitId: "github:sec:2",
          author: "gildong",
          contributionKind: "document",
          timestamp: MAR,
        }),
      ];
      expect(excludeSelfFollowUps(inputs)).toHaveLength(2);
    });

    it("code 와 document 가 섞여도 code 는 보존하고 document self-follow-up 만 제외한다", () => {
      const inputs = [
        makeInput({
          unitId: "github:sec:1",
          author: "gildong",
          contributionKind: "code",
          timestamp: FEB,
        }),
        makeInput({
          unitId: "github:sec:99",
          author: "gildong",
          contributionKind: "document",
          timestamp: FEB,
        }),
        makeInput({
          unitId: "github:sec:99",
          author: "gildong",
          contributionKind: "document",
          timestamp: MAR,
        }),
      ];
      const result = excludeSelfFollowUps(inputs);
      // code 1 건 + document earliest 1 건 = 2 건. document 후속(MAR) 제외.
      expect(result).toHaveLength(2);
      expect(result[0].contributionKind).toBe("code");
      expect(result[1].timestamp).toBe(FEB);
    });

    it("빈 배열 → 빈 배열", () => {
      expect(excludeSelfFollowUps([])).toEqual([]);
    });

    it("self-follow-up 0(모든 document 가 고유 키) → 입력 그대로(순서 보존)", () => {
      const inputs = [
        makeInput({
          unitId: "github:sec:1",
          author: "gildong",
          contributionKind: "document",
          timestamp: FEB,
        }),
        makeInput({
          unitId: "github:sec:2",
          author: "younghee",
          contributionKind: "document",
          timestamp: MAR,
        }),
      ];
      const result = excludeSelfFollowUps(inputs);
      expect(result.map((r) => r.unitId)).toEqual([
        "github:sec:1",
        "github:sec:2",
      ]);
    });

    it("3+ 동일-author document 후속 → 최초(earliest) 1 건만, 나머지 전부 제외", () => {
      const inputs = [
        makeInput({
          unitId: "github:sec:99",
          author: "gildong",
          contributionKind: "document",
          timestamp: APR,
        }),
        makeInput({
          unitId: "github:sec:99",
          author: "gildong",
          contributionKind: "document",
          timestamp: FEB,
        }),
        makeInput({
          unitId: "github:sec:99",
          author: "gildong",
          contributionKind: "document",
          timestamp: MAR,
        }),
      ];
      const result = excludeSelfFollowUps(inputs);
      expect(result).toHaveLength(1);
      expect(result[0].timestamp).toBe(FEB);
    });

    it("document tie timestamp → 먼저 등장한 항목 유지(결정적 tie-break)", () => {
      const inputs = [
        makeInput({
          unitId: "github:sec:99",
          author: "gildong",
          contributionKind: "document",
          timestamp: FEB,
          instanceKey: "first",
        }),
        makeInput({
          unitId: "github:sec:99",
          author: "gildong",
          contributionKind: "document",
          timestamp: FEB,
          instanceKey: "second",
        }),
      ];
      const result = excludeSelfFollowUps(inputs);
      expect(result).toHaveLength(1);
      expect(result[0].instanceKey).toBe("first");
    });
  });

  describe("immutability / determinism (R-112-2)", () => {
    it("입력 배열을 변형하지 않는다", () => {
      const inputs = [
        makeInput({
          unitId: "github:sec:99",
          author: "gildong",
          contributionKind: "document",
          timestamp: MAR,
        }),
        makeInput({
          unitId: "github:sec:99",
          author: "gildong",
          contributionKind: "document",
          timestamp: FEB,
        }),
      ];
      const before = [...inputs];
      excludeSelfFollowUps(inputs);
      expect(inputs).toHaveLength(2);
      expect(inputs).toEqual(before);
    });

    it("새 배열을 반환한다(입력과 다른 참조)", () => {
      const inputs = [
        makeInput({
          unitId: "github:sec:1",
          contributionKind: "document",
          timestamp: FEB,
        }),
      ];
      expect(excludeSelfFollowUps(inputs)).not.toBe(inputs);
    });

    it("동일 입력 2 회 호출이 동일 출력이다(LLM 의존 0)", () => {
      const inputs = [
        makeInput({
          unitId: "github:sec:99",
          author: "gildong",
          contributionKind: "document",
          timestamp: MAR,
        }),
        makeInput({
          unitId: "github:sec:99",
          author: "gildong",
          contributionKind: "document",
          timestamp: FEB,
        }),
      ];
      expect(excludeSelfFollowUps(inputs)).toEqual(
        excludeSelfFollowUps(inputs),
      );
    });
  });
});

describe("compose 정합 — 두 함수 독립 합성 (선택, ADR-0032 §4 직교)", () => {
  it("excludeSelfFollowUps(dedupTemporalDuplicates(inputs)) 가 두 정책을 모두 적용한다", () => {
    const inputs: EvaluationInput[] = [
      // 시간적 중복: 같은 code unitId 가 3 월 / 2 월 — earlier(2 월) 1 건만.
      makeInput({
        unitId: "github:sec:commit-1",
        author: "gildong",
        contributionKind: "code",
        timestamp: MAR,
      }),
      makeInput({
        unitId: "github:sec:commit-1",
        author: "gildong",
        contributionKind: "code",
        timestamp: FEB,
      }),
      // self-follow-up: 같은 document (unitId, author) 가 2 건 — earliest 1 건만.
      makeInput({
        unitId: "github:sec:issue-99",
        author: "gildong",
        contributionKind: "document",
        timestamp: MAR,
      }),
      makeInput({
        unitId: "github:sec:issue-99",
        author: "gildong",
        contributionKind: "document",
        timestamp: FEB,
      }),
    ];

    const composed = excludeSelfFollowUps(dedupTemporalDuplicates(inputs));
    // code 1 건(2 월) + document 1 건(2 월) = 2 건.
    expect(composed).toHaveLength(2);
    expect(composed.every((r) => r.timestamp === FEB)).toBe(true);

    // 역순 합성도 동일 결과(독립 합성 가능 — 직교).
    const composedReverse = dedupTemporalDuplicates(
      excludeSelfFollowUps(inputs),
    );
    expect(composedReverse).toHaveLength(2);
    expect(composedReverse.every((r) => r.timestamp === FEB)).toBe(true);
  });

  it("ContributionKind 타입은 code | document 2 종으로 좁혀진다(type-level 정합)", () => {
    const kinds: ContributionKind[] = ["code", "document"];
    expect(kinds).toHaveLength(2);
  });
});
