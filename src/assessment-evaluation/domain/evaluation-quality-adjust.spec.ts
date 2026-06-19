// evaluation-quality-adjust.ts 의 colocated unit test (CLAUDE.md §3.2 R-112 —
// happy / error / branch / negative cases 충분 cover).
// `applyContributionQualityFloor` 순수 함수의 R-37 / R-38 floor 강등 동작
// (zero-contribution 후보 author/unit 식별 + contribution `"zero"` 강제 + 비대상
// passthrough + author 미매칭 + 빈 입력 + 멱등 + 입력 비변형 + 결정성) 을 검증한다.
// 신규 파일 100% coverage 지향 — 모든 분기를 cover 한다.
//
// abuse 감점(T-0522) / update-count 중립(T-0525)과의 결정적 차이:
//   - 본 helper 는 `volume` 을 만지지 않는다. R-37/R-38 은 `contribution`(품질
//     등급 enum) 의 **하한(floor) 강등** 이다.
//   - 신호 대상은 contribution 을 `"zero"` 로 강제하되, 비대상은 입력 등급 그대로
//     전사한다(단조 비상향 — 본 helper 는 절대 contribution 을 올리지 않는다).

import {
  applyContributionQualityFloor,
  CONTRIBUTION_QUALITY_FLOOR_LEVEL,
  type ContributionQualityAdjustEntry,
} from "./evaluation-quality-adjust";
import type {
  ContributionQualityEntry,
  ContributionQualitySignal,
} from "./evaluation-quality-signal";
import type { ContributionLevel, EvaluationResult } from "./evaluation-result";

// EvaluationResult stub 빌더. 본 helper 는 contribution 만 검토 / 조정하므로
// 나머지 필드는 고정 — overrides 로 unitId 와 contribution 만 변경한다.
function makeResult(
  overrides: Partial<EvaluationResult> = {},
): EvaluationResult {
  return {
    unitId: "confluence:hq:p1",
    narrative: "정상 기여",
    difficulty: "medium",
    contribution: "medium",
    volume: 100,
    ...overrides,
  };
}

// ContributionQualityEntry stub 빌더.
function makeAuthorEntry(
  overrides: Partial<ContributionQualityEntry> = {},
): ContributionQualityEntry {
  const zeroContributionUnitIds = overrides.zeroContributionUnitIds ?? [
    "confluence:hq:p1",
  ];
  return {
    author: "mechanic",
    zeroContributionCount: zeroContributionUnitIds.length,
    zeroContributionUnitIds,
    zeroContribution: zeroContributionUnitIds.length >= 1,
    ...overrides,
  };
}

// ContributionQualitySignal stub 빌더.
function makeSignal(
  byAuthor: ContributionQualityEntry[],
  totalUnitCount = 0,
): ContributionQualitySignal {
  const totalZeroContributionCount = byAuthor.reduce(
    (sum, entry) => sum + entry.zeroContributionCount,
    0,
  );
  return {
    totalUnitCount: totalUnitCount || byAuthor.length,
    totalZeroContributionCount,
    byAuthor,
    zeroContributionDetected: byAuthor.some((entry) => entry.zeroContribution),
  };
}

describe("applyContributionQualityFloor", () => {
  describe("happy path (R-37/R-38 floor 강등)", () => {
    it("zero-contribution 후보로 식별된 author/unit 의 contribution 을 'zero' 로 강등한다", () => {
      const entries: ContributionQualityAdjustEntry[] = [
        {
          author: "mechanic",
          // LLM 정성 평가가 'high' 로 매겼더라도 floor 강등 대상이라면 zero 로
          // 강제 — R-37/R-38 결정적 하한.
          result: makeResult({
            unitId: "confluence:hq:p1",
            contribution: "high",
          }),
        },
      ];
      const signal = makeSignal([
        makeAuthorEntry({
          author: "mechanic",
          zeroContributionUnitIds: ["confluence:hq:p1"],
        }),
      ]);

      const out = applyContributionQualityFloor(entries, signal);

      // R-37/R-38 핵심: LLM 산출이 'high' 여도 신호 대상은 'zero' 로 강등.
      expect(out[0].result.contribution).toBe("zero");
      // author 와 나머지 필드는 전사(volume 등 본 helper 책임 밖 필드 무변경).
      expect(out[0].author).toBe("mechanic");
      expect(out[0].result.unitId).toBe("confluence:hq:p1");
      expect(out[0].result.narrative).toBe("정상 기여");
      expect(out[0].result.difficulty).toBe("medium");
      expect(out[0].result.volume).toBe(100);
    });

    it("미대상(zero-contribution 후보 아님) unit 은 contribution 그대로 passthrough", () => {
      const entries: ContributionQualityAdjustEntry[] = [
        {
          author: "gildong",
          result: makeResult({
            unitId: "confluence:hq:p99",
            contribution: "high",
          }),
        },
      ];
      const signal = makeSignal([
        makeAuthorEntry({
          author: "gildong",
          zeroContributionUnitIds: [],
          // zeroContribution=false (빈 ids 로 자동 계산).
        }),
      ]);

      const out = applyContributionQualityFloor(entries, signal);

      // 비대상 — 입력 등급 그대로 전사(상향도 강등도 없음).
      expect(out[0].result.contribution).toBe("high");
    });

    it("강등 대상 / 비대상 / 미매칭 혼합 batch 를 각각 규칙대로 처리한다", () => {
      const entries: ContributionQualityAdjustEntry[] = [
        {
          author: "mechanic",
          result: makeResult({
            unitId: "confluence:hq:p1",
            contribution: "high",
          }),
        },
        {
          author: "gildong",
          result: makeResult({
            unitId: "confluence:hq:p2",
            contribution: "medium",
          }),
        },
        {
          author: "unknown",
          result: makeResult({
            unitId: "github:sec:c1",
            contribution: "low",
          }),
        },
      ];
      const signal = makeSignal([
        makeAuthorEntry({
          author: "mechanic",
          zeroContributionUnitIds: ["confluence:hq:p1"],
        }),
        makeAuthorEntry({
          author: "gildong",
          zeroContributionUnitIds: [],
        }),
      ]);

      const out = applyContributionQualityFloor(entries, signal);

      // 강등 대상.
      expect(out[0].result.contribution).toBe("zero");
      // 비대상(같은 author 의 다른 단위가 후보지만 본 단위는 아님 — 이 case 는
      // zeroContribution=false). 입력 등급 'medium' 그대로 전사.
      expect(out[1].result.contribution).toBe("medium");
      // author 미매칭 — 입력 등급 'low' 그대로 전사.
      expect(out[2].result.contribution).toBe("low");
      // 순서와 길이 보존(caller 매핑 재사용 보장).
      expect(out).toHaveLength(3);
      expect(out.map((e) => e.author)).toEqual([
        "mechanic",
        "gildong",
        "unknown",
      ]);
    });
  });

  describe("error path (명시적 입력 계약 위반)", () => {
    it("entries 가 null 이면 한국어 TypeError throw", () => {
      const signal = makeSignal([]);
      expect(() =>
        applyContributionQualityFloor(
          null as unknown as ContributionQualityAdjustEntry[],
          signal,
        ),
      ).toThrow(TypeError);
      expect(() =>
        applyContributionQualityFloor(
          null as unknown as ContributionQualityAdjustEntry[],
          signal,
        ),
      ).toThrow("entries 는 null 또는 undefined 일 수 없습니다.");
    });

    it("entries 가 undefined 이면 한국어 TypeError throw", () => {
      const signal = makeSignal([]);
      expect(() =>
        applyContributionQualityFloor(
          undefined as unknown as ContributionQualityAdjustEntry[],
          signal,
        ),
      ).toThrow("entries 는 null 또는 undefined 일 수 없습니다.");
    });

    it("signal 이 null 이면 한국어 TypeError throw", () => {
      expect(() =>
        applyContributionQualityFloor(
          [],
          null as unknown as ContributionQualitySignal,
        ),
      ).toThrow(TypeError);
      expect(() =>
        applyContributionQualityFloor(
          [],
          null as unknown as ContributionQualitySignal,
        ),
      ).toThrow("signal 은 null 또는 undefined 일 수 없습니다.");
    });

    it("signal 이 undefined 이면 한국어 TypeError throw", () => {
      expect(() =>
        applyContributionQualityFloor(
          [],
          undefined as unknown as ContributionQualitySignal,
        ),
      ).toThrow("signal 은 null 또는 undefined 일 수 없습니다.");
    });
  });

  describe("branch coverage (각 분기 1+)", () => {
    it("(a) author 신호 존재 + unit 이 zeroContributionUnitIds 대상 → 'zero' 강등", () => {
      const entries: ContributionQualityAdjustEntry[] = [
        {
          author: "mechanic",
          result: makeResult({
            unitId: "confluence:hq:p1",
            contribution: "medium",
          }),
        },
      ];
      const signal = makeSignal([
        makeAuthorEntry({
          author: "mechanic",
          zeroContributionUnitIds: ["confluence:hq:p1"],
        }),
      ]);

      const out = applyContributionQualityFloor(entries, signal);

      expect(out[0].result.contribution).toBe("zero");
    });

    it("(b) author 신호 존재하나 unit 이 zeroContributionUnitIds 에 없음 → 무변경", () => {
      // 같은 author 의 다른 단위가 후보지만 본 단위는 아님(부분 적용 정합).
      const entries: ContributionQualityAdjustEntry[] = [
        {
          author: "mechanic",
          result: makeResult({
            unitId: "confluence:hq:p99",
            contribution: "high",
          }),
        },
      ];
      const signal = makeSignal([
        makeAuthorEntry({
          author: "mechanic",
          zeroContributionUnitIds: ["confluence:hq:p1"],
        }),
      ]);

      const out = applyContributionQualityFloor(entries, signal);

      expect(out[0].result.contribution).toBe("high");
    });

    it("(c) author 미매칭(신호에 author 자체가 없음) → 무변경", () => {
      const entries: ContributionQualityAdjustEntry[] = [
        {
          author: "stranger",
          result: makeResult({
            unitId: "confluence:hq:p1",
            contribution: "medium",
          }),
        },
      ];
      const signal = makeSignal([
        makeAuthorEntry({
          author: "mechanic",
          zeroContributionUnitIds: ["confluence:hq:p1"],
        }),
      ]);

      const out = applyContributionQualityFloor(entries, signal);

      expect(out[0].result.contribution).toBe("medium");
    });

    it("(d) 대상 단위의 contribution 이 이미 'zero' → 멱등(값 동일 + 새 객체 복제)", () => {
      const inputResult = makeResult({
        unitId: "confluence:hq:p1",
        contribution: "zero",
      });
      const entries: ContributionQualityAdjustEntry[] = [
        { author: "mechanic", result: inputResult },
      ];
      const signal = makeSignal([
        makeAuthorEntry({
          author: "mechanic",
          zeroContributionUnitIds: ["confluence:hq:p1"],
        }),
      ]);

      const out = applyContributionQualityFloor(entries, signal);

      // 멱등: 값은 같음.
      expect(out[0].result.contribution).toBe("zero");
      // 그러나 새 객체로 복제(입력 비변형 보장).
      expect(out[0].result).not.toBe(inputResult);
    });

    it("author 신호 존재하나 zeroContribution=false → 무변경(빈 ids 보호)", () => {
      const entries: ContributionQualityAdjustEntry[] = [
        {
          author: "mechanic",
          result: makeResult({
            unitId: "confluence:hq:p1",
            contribution: "high",
          }),
        },
      ];
      // zeroContributionUnitIds 가 비어 있으면 zeroContribution=false → 분기의
      // short-circuit 가지(authorSignal.zeroContribution === false) 를 cover.
      const signal = makeSignal([
        makeAuthorEntry({
          author: "mechanic",
          zeroContributionUnitIds: [],
        }),
      ]);

      const out = applyContributionQualityFloor(entries, signal);

      expect(out[0].result.contribution).toBe("high");
    });
  });

  describe("negative cases (예외 분기마다 충분 cover)", () => {
    it("(i) 빈 entries 배열 → 빈 배열 반환", () => {
      const out = applyContributionQualityFloor([], makeSignal([]));
      expect(out).toEqual([]);
    });

    it("(ii) 빈 signal.byAuthor → 전 단위 무변경 복제", () => {
      const entries: ContributionQualityAdjustEntry[] = [
        {
          author: "a1",
          result: makeResult({ unitId: "u1", contribution: "high" }),
        },
        {
          author: "a2",
          result: makeResult({ unitId: "u2", contribution: "medium" }),
        },
      ];

      const out = applyContributionQualityFloor(entries, makeSignal([]));

      expect(out[0].result.contribution).toBe("high");
      expect(out[1].result.contribution).toBe("medium");
      // 새 객체 복제 확인.
      expect(out[0].result).not.toBe(entries[0].result);
      expect(out[1].result).not.toBe(entries[1].result);
    });

    it("(iii) author 미매칭 단위 — 무변경 passthrough(여러 author 혼합 안전)", () => {
      const entries: ContributionQualityAdjustEntry[] = [
        {
          author: "phantom",
          result: makeResult({
            unitId: "confluence:hq:p1",
            contribution: "low",
          }),
        },
      ];
      const signal = makeSignal([
        makeAuthorEntry({
          author: "mechanic",
          zeroContributionUnitIds: ["confluence:hq:p1"],
        }),
      ]);

      const out = applyContributionQualityFloor(entries, signal);

      expect(out[0].result.contribution).toBe("low");
    });

    it("(iv) 동일 author 다수 단위 중 일부만 unitId 가 zero-contribution 대상 → 부분 적용 정합", () => {
      const entries: ContributionQualityAdjustEntry[] = [
        {
          author: "mechanic",
          result: makeResult({
            unitId: "confluence:hq:p1",
            contribution: "high",
          }),
        },
        {
          author: "mechanic",
          result: makeResult({
            unitId: "confluence:hq:p2",
            contribution: "medium",
          }),
        },
        {
          author: "mechanic",
          result: makeResult({
            unitId: "confluence:hq:p3",
            contribution: "low",
          }),
        },
      ];
      // p1, p3 만 zero-contribution 대상 — p2 는 같은 author 이지만 대상 아님.
      const signal = makeSignal([
        makeAuthorEntry({
          author: "mechanic",
          zeroContributionUnitIds: ["confluence:hq:p1", "confluence:hq:p3"],
        }),
      ]);

      const out = applyContributionQualityFloor(entries, signal);

      expect(out[0].result.contribution).toBe("zero"); // 강등 대상.
      expect(out[1].result.contribution).toBe("medium"); // 같은 author 이지만 대상 아님 — 무변경.
      expect(out[2].result.contribution).toBe("zero"); // 강등 대상.
    });

    it("(v) 다수 author 혼합 entries — 독립 처리 + 순서 보존", () => {
      const entries: ContributionQualityAdjustEntry[] = [
        {
          author: "alpha",
          result: makeResult({ unitId: "u-a1", contribution: "high" }),
        },
        {
          author: "beta",
          result: makeResult({ unitId: "u-b1", contribution: "medium" }),
        },
        {
          author: "alpha",
          result: makeResult({ unitId: "u-a2", contribution: "low" }),
        },
        {
          author: "gamma",
          result: makeResult({ unitId: "u-g1", contribution: "high" }),
        },
      ];
      const signal = makeSignal([
        makeAuthorEntry({
          author: "alpha",
          zeroContributionUnitIds: ["u-a2"],
        }),
        makeAuthorEntry({
          author: "beta",
          zeroContributionUnitIds: ["u-b1"],
        }),
        // gamma 는 신호에 없음(미매칭).
      ]);

      const out = applyContributionQualityFloor(entries, signal);

      expect(out).toHaveLength(4);
      expect(out[0].result.contribution).toBe("high"); // alpha/u-a1 대상 아님.
      expect(out[1].result.contribution).toBe("zero"); // beta/u-b1 강등 대상.
      expect(out[2].result.contribution).toBe("zero"); // alpha/u-a2 강등 대상.
      expect(out[3].result.contribution).toBe("high"); // gamma 미매칭 — 무변경.
      // 순서 보존.
      expect(out.map((e) => e.author)).toEqual([
        "alpha",
        "beta",
        "alpha",
        "gamma",
      ]);
    });

    it("(vi) 동일 unitId 가 다수 entries 에 등장 시 각각 일관 강등(결정적 처리)", () => {
      // 동일 unitId 가 같은 batch 에 중복 등장(예: 동일 author 가 같은 단위에
      // 대해 다수 평가) — 본 helper 는 각 entry 를 독립적으로 처리해 결정성을
      // 보장한다.
      const entries: ContributionQualityAdjustEntry[] = [
        {
          author: "mechanic",
          result: makeResult({
            unitId: "confluence:hq:p1",
            contribution: "high",
          }),
        },
        {
          author: "mechanic",
          result: makeResult({
            unitId: "confluence:hq:p1",
            contribution: "medium",
          }),
        },
      ];
      const signal = makeSignal([
        makeAuthorEntry({
          author: "mechanic",
          zeroContributionUnitIds: ["confluence:hq:p1"],
        }),
      ]);

      const out = applyContributionQualityFloor(entries, signal);

      // 두 entry 모두 동일하게 'zero' 로 강등됨.
      expect(out[0].result.contribution).toBe("zero");
      expect(out[1].result.contribution).toBe("zero");
      // 각각 새 객체로 복제됨(서로 다른 인스턴스).
      expect(out[0].result).not.toBe(out[1].result);
    });

    it("contribution enum 외 값(layer 경계 침입, 강등 대상) → 'zero' 로 강제(단조 하한)", () => {
      const entries: ContributionQualityAdjustEntry[] = [
        {
          author: "mechanic",
          result: makeResult({
            unitId: "confluence:hq:p1",
            // 의도적으로 enum 외 값 — type 우회.
            contribution: "unknown" as unknown as ContributionLevel,
          }),
        },
      ];
      const signal = makeSignal([
        makeAuthorEntry({
          author: "mechanic",
          zeroContributionUnitIds: ["confluence:hq:p1"],
        }),
      ]);

      const out = applyContributionQualityFloor(entries, signal);

      // 강등 분기는 enum 외 입력에도 floor 를 강제(invariant 보호).
      expect(out[0].result.contribution).toBe("zero");
    });

    it("contribution enum 외 값(layer 경계 침입, 비대상) → 입력값 그대로 전사(caller 책임)", () => {
      const entries: ContributionQualityAdjustEntry[] = [
        {
          author: "gildong",
          result: makeResult({
            unitId: "u1",
            contribution: "unknown" as unknown as ContributionLevel,
          }),
        },
      ];
      const signal = makeSignal([]);

      const out = applyContributionQualityFloor(entries, signal);

      // 비대상 분기는 입력 등급 신뢰(정규화 책임 없음).
      expect(out[0].result.contribution).toBe("unknown");
    });
  });

  describe("입력 비변형 + 결정성", () => {
    it("입력 entries / result / signal 을 변형하지 않는다(deep-equal 보존)", () => {
      const entries: ContributionQualityAdjustEntry[] = [
        {
          author: "mechanic",
          result: makeResult({
            unitId: "confluence:hq:p1",
            contribution: "high",
          }),
        },
      ];
      const signal = makeSignal([
        makeAuthorEntry({
          author: "mechanic",
          zeroContributionUnitIds: ["confluence:hq:p1"],
        }),
      ]);
      const entriesSnapshot = JSON.parse(JSON.stringify(entries));
      const signalSnapshot = JSON.parse(JSON.stringify(signal));

      applyContributionQualityFloor(entries, signal);

      expect(entries).toEqual(entriesSnapshot);
      expect(signal).toEqual(signalSnapshot);
    });

    it("Object.freeze 된 입력으로 호출해도 throw 없이 통과(비변형 증명)", () => {
      const result = Object.freeze(
        makeResult({ unitId: "confluence:hq:p1", contribution: "high" }),
      );
      const entry = Object.freeze({ author: "mechanic", result });
      const entries = Object.freeze([
        entry,
      ]) as unknown as ContributionQualityAdjustEntry[];
      const authorEntry = Object.freeze(
        makeAuthorEntry({
          author: "mechanic",
          zeroContributionUnitIds: Object.freeze([
            "confluence:hq:p1",
          ]) as unknown as string[],
        }),
      );
      const signal = Object.freeze(makeSignal([authorEntry]));

      const out = applyContributionQualityFloor(entries, signal);

      // 강등 대상 — 'zero' 강제.
      expect(out[0].result.contribution).toBe("zero");
      // 출력은 입력과 다른 새 객체.
      expect(out[0].result).not.toBe(result);
      expect(out[0]).not.toBe(entry);
    });

    it("동일 입력 2회 호출이 동일 출력(결정성)", () => {
      const entries: ContributionQualityAdjustEntry[] = [
        {
          author: "mechanic",
          result: makeResult({
            unitId: "confluence:hq:p1",
            contribution: "high",
          }),
        },
        {
          author: "gildong",
          result: makeResult({
            unitId: "confluence:hq:p2",
            contribution: "medium",
          }),
        },
      ];
      const signal = makeSignal([
        makeAuthorEntry({
          author: "mechanic",
          zeroContributionUnitIds: ["confluence:hq:p1"],
        }),
        makeAuthorEntry({
          author: "gildong",
          zeroContributionUnitIds: [],
        }),
      ]);

      const first = applyContributionQualityFloor(entries, signal);
      const second = applyContributionQualityFloor(entries, signal);

      expect(first).toEqual(second);
    });
  });

  describe("상수 export", () => {
    it("CONTRIBUTION_QUALITY_FLOOR_LEVEL v1 baseline = 'zero'", () => {
      expect(CONTRIBUTION_QUALITY_FLOOR_LEVEL).toBe("zero");
    });
  });
});
