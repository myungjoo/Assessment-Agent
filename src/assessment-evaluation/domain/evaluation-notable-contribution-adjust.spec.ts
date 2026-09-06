// evaluation-notable-contribution-adjust.ts 의 colocated unit test (CLAUDE.md §3.2
// R-112 — happy / error / branch / negative cases 충분 cover).
// `applyNotableContributionAnnotation` 순수 함수의 R-25 / REQ-011 중요기여 annotation
// 동작(notable=true author 의 전 단위 narrative marker 접두 + 비대상 passthrough +
// author 미매칭 + 빈 입력 + 멱등 + 입력 비변형 + 결정성) 을 검증한다.
// 신규 파일 100% coverage 지향 — 모든 분기를 cover 한다.
//
// mirror 원형: evaluation-underperformer-adjust.spec.ts(T-0531) — 본 spec 은 그
// 대칭 inverse(저성과 → 중요기여, 단조 하한 → 단조 상향) 구조 그대로.
//
// 형제 소비 helper(T-0522/T-0525/T-0528)와의 결정적 차이:
//   - 본 helper 는 `volume` / `contribution` 을 만지지 않는다 — `narrative` 에
//     marker 만 접두한다(중요기여 사실 외화).
//   - 신호 차원이 **author-level**(unitId 목록 없음)이므로, notable=true author 의
//     **모든** 단위가 일관 annotation 된다(author-level 전파).

import {
  applyNotableContributionAnnotation,
  applyNotableContributionUplift,
  NOTABLE_CONTRIBUTION_NARRATIVE_MARKER,
  NOTABLE_CONTRIBUTION_UPLIFT_LEVEL,
  type NotableContributionAdjustEntry,
} from "./evaluation-notable-contribution-adjust";
import type {
  NotableContributionEntry,
  NotableContributionSignal,
} from "./evaluation-notable-contribution-signal";
import type { EvaluationResult } from "./evaluation-result";

// EvaluationResult stub 빌더. 본 helper 는 narrative 만 검토 / 조정하므로 나머지
// 필드는 고정 — overrides 로 unitId 와 narrative 만 변경한다.
function makeResult(
  overrides: Partial<EvaluationResult> = {},
): EvaluationResult {
  return {
    unitId: "confluence:hq:p1",
    narrative: "정상 기여 평가문",
    difficulty: "medium",
    contribution: "medium",
    volume: 100,
    ...overrides,
  };
}

// NotableContributionEntry stub 빌더.
function makeAuthorEntry(
  overrides: Partial<NotableContributionEntry> = {},
): NotableContributionEntry {
  return {
    author: "achiever",
    codeUnitCount: 10,
    notable: true,
    ...overrides,
  };
}

// NotableContributionSignal stub 빌더.
function makeSignal(
  byAuthor: NotableContributionEntry[],
  meanCodeUnitCount = 5,
): NotableContributionSignal {
  return {
    totalAuthorCount: byAuthor.length,
    meanCodeUnitCount,
    byAuthor,
    notableDetected: byAuthor.some((entry) => entry.notable),
  };
}

describe("applyNotableContributionAnnotation", () => {
  describe("happy path", () => {
    it("notable=true author 의 모든 단위 narrative 에 marker 를 접두한다", () => {
      const entries: NotableContributionAdjustEntry[] = [
        {
          author: "achiever",
          result: makeResult({ unitId: "u1", narrative: "A" }),
        },
        {
          author: "achiever",
          result: makeResult({ unitId: "u2", narrative: "B" }),
        },
      ];
      const signal = makeSignal([makeAuthorEntry({ author: "achiever" })]);

      const out = applyNotableContributionAnnotation(entries, signal);

      expect(out).toHaveLength(2);
      expect(out[0].result.narrative).toBe(
        `${NOTABLE_CONTRIBUTION_NARRATIVE_MARKER}A`,
      );
      expect(out[1].result.narrative).toBe(
        `${NOTABLE_CONTRIBUTION_NARRATIVE_MARKER}B`,
      );
      // narrative 외 필드 전사 확인.
      expect(out[0].result.unitId).toBe("u1");
      expect(out[0].result.volume).toBe(100);
      expect(out[0].result.contribution).toBe("medium");
    });

    it("notable=false author / 미매칭 author 단위는 narrative 를 그대로 전사한다", () => {
      const entries: NotableContributionAdjustEntry[] = [
        { author: "normal", result: makeResult({ narrative: "정상" }) },
        { author: "unknown", result: makeResult({ narrative: "미매칭" }) },
      ];
      const signal = makeSignal([
        makeAuthorEntry({ author: "normal", notable: false }),
      ]);

      const out = applyNotableContributionAnnotation(entries, signal);

      expect(out[0].result.narrative).toBe("정상");
      expect(out[1].result.narrative).toBe("미매칭");
    });
  });

  describe("error path (명시적 계약 위반만 throw)", () => {
    const signal = makeSignal([makeAuthorEntry()]);

    it("entries 가 null 이면 한국어 TypeError", () => {
      expect(() =>
        applyNotableContributionAnnotation(
          null as unknown as NotableContributionAdjustEntry[],
          signal,
        ),
      ).toThrow(TypeError);
      expect(() =>
        applyNotableContributionAnnotation(
          null as unknown as NotableContributionAdjustEntry[],
          signal,
        ),
      ).toThrow("entries 는 null 또는 undefined 일 수 없습니다.");
    });

    it("entries 가 undefined 이면 한국어 TypeError", () => {
      expect(() =>
        applyNotableContributionAnnotation(
          undefined as unknown as NotableContributionAdjustEntry[],
          signal,
        ),
      ).toThrow("entries 는 null 또는 undefined 일 수 없습니다.");
    });

    it("signal 이 null 이면 한국어 TypeError", () => {
      expect(() =>
        applyNotableContributionAnnotation(
          [],
          null as unknown as NotableContributionSignal,
        ),
      ).toThrow("signal 은 null 또는 undefined 일 수 없습니다.");
    });

    it("signal 이 undefined 이면 한국어 TypeError", () => {
      expect(() =>
        applyNotableContributionAnnotation(
          [],
          undefined as unknown as NotableContributionSignal,
        ),
      ).toThrow("signal 은 null 또는 undefined 일 수 없습니다.");
    });

    it("빈 entries / 빈 byAuthor / author 미매칭 / 이미 marker 접두는 throw 없이 흡수된다", () => {
      // 빈 entries.
      expect(() =>
        applyNotableContributionAnnotation([], makeSignal([])),
      ).not.toThrow();
      // 빈 byAuthor + 단위 존재.
      expect(() =>
        applyNotableContributionAnnotation(
          [{ author: "x", result: makeResult() }],
          makeSignal([]),
        ),
      ).not.toThrow();
      // 이미 marker 접두 단위.
      expect(() =>
        applyNotableContributionAnnotation(
          [
            {
              author: "achiever",
              result: makeResult({
                narrative: `${NOTABLE_CONTRIBUTION_NARRATIVE_MARKER}이미`,
              }),
            },
          ],
          makeSignal([makeAuthorEntry({ author: "achiever" })]),
        ),
      ).not.toThrow();
    });
  });

  describe("flow / branch coverage", () => {
    it("(a) author 존재 + notable=true → marker 접두 분기", () => {
      const out = applyNotableContributionAnnotation(
        [{ author: "achiever", result: makeResult({ narrative: "본문" }) }],
        makeSignal([makeAuthorEntry({ author: "achiever", notable: true })]),
      );
      expect(out[0].result.narrative).toBe(
        `${NOTABLE_CONTRIBUTION_NARRATIVE_MARKER}본문`,
      );
    });

    it("(b) author 존재하나 notable=false → 무변경", () => {
      const out = applyNotableContributionAnnotation(
        [{ author: "ok", result: makeResult({ narrative: "본문" }) }],
        makeSignal([makeAuthorEntry({ author: "ok", notable: false })]),
      );
      expect(out[0].result.narrative).toBe("본문");
    });

    it("(c) author 미매칭 → 무변경", () => {
      const out = applyNotableContributionAnnotation(
        [{ author: "ghost", result: makeResult({ narrative: "본문" }) }],
        makeSignal([makeAuthorEntry({ author: "achiever" })]),
      );
      expect(out[0].result.narrative).toBe("본문");
    });

    it("(d) notable 대상이지만 이미 marker 접두 → 멱등(중복 접두 없음)", () => {
      const pre = `${NOTABLE_CONTRIBUTION_NARRATIVE_MARKER}본문`;
      const out = applyNotableContributionAnnotation(
        [{ author: "achiever", result: makeResult({ narrative: pre }) }],
        makeSignal([makeAuthorEntry({ author: "achiever" })]),
      );
      expect(out[0].result.narrative).toBe(pre);
      // marker 가 정확히 한 번만 등장.
      const occurrences =
        out[0].result.narrative.split(NOTABLE_CONTRIBUTION_NARRATIVE_MARKER)
          .length - 1;
      expect(occurrences).toBe(1);
    });
  });

  describe("negative cases 충분 cover", () => {
    it("(i) 빈 entries 배열 → 빈 배열 반환", () => {
      expect(
        applyNotableContributionAnnotation([], makeSignal([makeAuthorEntry()])),
      ).toEqual([]);
    });

    it("(ii) signal.byAuthor 빈 배열 → 전 단위 무변경 복제", () => {
      const entries: NotableContributionAdjustEntry[] = [
        { author: "a", result: makeResult({ narrative: "X" }) },
        { author: "b", result: makeResult({ narrative: "Y" }) },
      ];
      const out = applyNotableContributionAnnotation(entries, makeSignal([]));
      expect(out[0].result.narrative).toBe("X");
      expect(out[1].result.narrative).toBe("Y");
      // 새 객체 복제 — 참조 비동일.
      expect(out[0].result).not.toBe(entries[0].result);
    });

    it("(iii) author 미매칭 단위는 무변경 복제", () => {
      const entries: NotableContributionAdjustEntry[] = [
        { author: "nomatch", result: makeResult({ narrative: "Z" }) },
      ];
      const out = applyNotableContributionAnnotation(
        entries,
        makeSignal([makeAuthorEntry({ author: "other" })]),
      );
      expect(out[0].result.narrative).toBe("Z");
      expect(out[0].result).not.toBe(entries[0].result);
    });

    it("(iv) notable=true author 의 다수 단위 전부 일관 marker 접두(author-level 전파)", () => {
      const entries: NotableContributionAdjustEntry[] = [
        {
          author: "achiever",
          result: makeResult({ unitId: "u1", narrative: "1" }),
        },
        {
          author: "achiever",
          result: makeResult({ unitId: "u2", narrative: "2" }),
        },
        {
          author: "achiever",
          result: makeResult({ unitId: "u3", narrative: "3" }),
        },
      ];
      const out = applyNotableContributionAnnotation(
        entries,
        makeSignal([
          makeAuthorEntry({ author: "achiever", codeUnitCount: 20 }),
        ]),
      );
      for (const [i, entry] of out.entries()) {
        expect(entry.result.narrative).toBe(
          `${NOTABLE_CONTRIBUTION_NARRATIVE_MARKER}${i + 1}`,
        );
      }
    });

    it("(v) 다수 author 혼합 entries(중요기여/정상 혼재) — 독립 처리 · 순서 보존", () => {
      const entries: NotableContributionAdjustEntry[] = [
        { author: "achiever", result: makeResult({ narrative: "A1" }) },
        { author: "normal", result: makeResult({ narrative: "N1" }) },
        { author: "achiever", result: makeResult({ narrative: "A2" }) },
        { author: "ghost", result: makeResult({ narrative: "G1" }) },
      ];
      const signal = makeSignal([
        makeAuthorEntry({ author: "achiever", notable: true }),
        makeAuthorEntry({ author: "normal", notable: false }),
      ]);

      const out = applyNotableContributionAnnotation(entries, signal);

      expect(out.map((e) => e.result.narrative)).toEqual([
        `${NOTABLE_CONTRIBUTION_NARRATIVE_MARKER}A1`,
        "N1",
        `${NOTABLE_CONTRIBUTION_NARRATIVE_MARKER}A2`,
        "G1",
      ]);
      // author 순서 보존.
      expect(out.map((e) => e.author)).toEqual([
        "achiever",
        "normal",
        "achiever",
        "ghost",
      ]);
    });

    it("(vi) 빈 narrative('') 단위가 중요기여 대상일 때도 marker 만 접두(본문 손상 없음)", () => {
      const out = applyNotableContributionAnnotation(
        [{ author: "achiever", result: makeResult({ narrative: "" }) }],
        makeSignal([makeAuthorEntry({ author: "achiever" })]),
      );
      expect(out[0].result.narrative).toBe(
        NOTABLE_CONTRIBUTION_NARRATIVE_MARKER,
      );
    });
  });

  describe("결정성 · 비변형", () => {
    it("동일 입력 2회 호출이 toEqual 동일 출력(멱등 — 2회 적용도 marker 1회만)", () => {
      const entries: NotableContributionAdjustEntry[] = [
        { author: "achiever", result: makeResult({ narrative: "본문" }) },
        { author: "normal", result: makeResult({ narrative: "정상" }) },
      ];
      const signal = makeSignal([
        makeAuthorEntry({ author: "achiever", notable: true }),
        makeAuthorEntry({ author: "normal", notable: false }),
      ]);

      const first = applyNotableContributionAnnotation(entries, signal);
      const second = applyNotableContributionAnnotation(entries, signal);
      expect(first).toEqual(second);

      // 1회 출력을 재입력해도(2회 적용) marker 가 한 번만 — 멱등.
      const reapplied = applyNotableContributionAnnotation(first, signal);
      expect(reapplied).toEqual(first);
    });

    it("입력 entries / 원소 / result / signal 가 변경되지 않는다(Object.freeze 통과)", () => {
      const result = Object.freeze(makeResult({ narrative: "원본" }));
      const authorEntry = Object.freeze(
        makeAuthorEntry({ author: "achiever", notable: true }),
      );
      const entries = Object.freeze([
        Object.freeze({ author: "achiever", result }),
      ]) as unknown as NotableContributionAdjustEntry[];
      const signal = Object.freeze(
        makeSignal([authorEntry as NotableContributionEntry]),
      ) as NotableContributionSignal;

      expect(() =>
        applyNotableContributionAnnotation(entries, signal),
      ).not.toThrow();

      const out = applyNotableContributionAnnotation(entries, signal);
      // 입력 원본 비변형.
      expect(result.narrative).toBe("원본");
      // 출력은 새 객체.
      expect(out[0].result).not.toBe(result);
      expect(out[0].result.narrative).toBe(
        `${NOTABLE_CONTRIBUTION_NARRATIVE_MARKER}원본`,
      );
    });
  });
});

// ── T-1921: applyNotableContributionUplift — 중요기여 author 등급 상향(REQ-011).
describe("applyNotableContributionUplift", () => {
  // notable=true 인 achiever 1 명만 담은 baseline 신호 + notable=false normal 혼합.
  const notableSignal = makeSignal([makeAuthorEntry({ author: "achiever" })]);
  const mixedSignal = makeSignal([
    makeAuthorEntry({ author: "achiever" }),
    makeAuthorEntry({ author: "normal", notable: false }),
  ]);

  it("(happy) notable=true author 의 모든 단위를 high 로 상향한다", () => {
    const entries: NotableContributionAdjustEntry[] = [
      {
        author: "achiever",
        result: makeResult({ unitId: "u1", contribution: "low" }),
      },
      {
        author: "achiever",
        result: makeResult({
          unitId: "u2",
          narrative: "본문",
          difficulty: "hard",
          volume: 42,
          contribution: "medium",
        }),
      },
    ];

    const out = applyNotableContributionUplift(entries, notableSignal);

    // author-level 전파 — 같은 author 의 모든 단위가 대상. 길이·순서 보존.
    expect(out.map((e) => e.result.contribution)).toEqual([
      NOTABLE_CONTRIBUTION_UPLIFT_LEVEL,
      "high",
    ]);
    // contribution 외 필드(unitId / narrative / difficulty / volume)는 전사.
    expect(out[1].result).toEqual({
      unitId: "u2",
      narrative: "본문",
      difficulty: "hard",
      volume: 42,
      contribution: "high",
    });
  });

  it.each([null, undefined])(
    "(error) entries 가 %p 면 한국어 TypeError",
    (bad) => {
      const call = (): unknown =>
        applyNotableContributionUplift(
          bad as unknown as NotableContributionAdjustEntry[],
          notableSignal,
        );
      expect(call).toThrow(TypeError);
      expect(call).toThrow("entries 는 null 또는 undefined 일 수 없습니다.");
    },
  );

  it.each([null, undefined])(
    "(error) signal 이 %p 면 한국어 TypeError",
    (bad) => {
      const call = (): unknown =>
        applyNotableContributionUplift(
          [],
          bad as unknown as NotableContributionSignal,
        );
      expect(call).toThrow(TypeError);
      expect(call).toThrow("signal 은 null 또는 undefined 일 수 없습니다.");
    },
  );

  // 설계 규칙 1~6 분기 + negative(무변경) 케이스를 한 표로 cover 한다.
  it.each([
    ["(1) signal 미매칭 author → 무변경", "ghost", "low", "low"],
    ["(2) notable=false author → 무변경", "normal", "medium", "medium"],
    ["(3) zero 는 상향하지 않는다(하한 우선)", "achiever", "zero", "zero"],
    ["(4a) low → high 상향", "achiever", "low", "high"],
    ["(4b) medium → high 상향", "achiever", "medium", "high"],
    ["(5) 이미 high 면 값 동일(멱등)", "achiever", "high", "high"],
    ["(6) enum 외 값은 보수적 무변경", "achiever", "bogus", "bogus"],
  ])("%s", (_label, author, contribution, expected) => {
    const entries: NotableContributionAdjustEntry[] = [
      {
        author,
        result: makeResult({
          contribution: contribution as EvaluationResult["contribution"],
        }),
      },
    ];

    const out = applyNotableContributionUplift(entries, mixedSignal);

    expect(out[0].result.contribution).toBe(expected);
    // 어떤 분기든 항상 새 객체로 복제한다(입력 비변형 보장).
    expect(out[0].result).not.toBe(entries[0].result);
  });

  it("(negative) 빈 entries → 빈 배열, 빈 byAuthor → 전 단위 무변경", () => {
    expect(applyNotableContributionUplift([], makeSignal([]))).toEqual([]);
    const entries: NotableContributionAdjustEntry[] = [
      { author: "achiever", result: makeResult({ contribution: "low" }) },
    ];
    expect(
      applyNotableContributionUplift(entries, makeSignal([]))[0].result
        .contribution,
    ).toBe("low");
  });

  it("(negative) 입력 entries / result / signal 을 변형하지 않는다", () => {
    const entries = Object.freeze([
      Object.freeze({
        author: "achiever",
        result: Object.freeze(makeResult({ contribution: "medium" })),
      }),
    ]) as unknown as NotableContributionAdjustEntry[];
    const snapshot = JSON.parse(JSON.stringify(entries));
    const signalSnapshot = JSON.parse(JSON.stringify(notableSignal));

    const out = applyNotableContributionUplift(entries, notableSignal);

    expect(out[0].result.contribution).toBe("high");
    expect(entries).toEqual(snapshot);
    expect(notableSignal).toEqual(signalSnapshot);
  });

  it("(멱등) 2 회 연속 적용 결과가 1 회 적용 결과와 같다", () => {
    const entries: NotableContributionAdjustEntry[] = [
      {
        author: "achiever",
        result: makeResult({ unitId: "u1", contribution: "low" }),
      },
      {
        author: "achiever",
        result: makeResult({ unitId: "u2", contribution: "zero" }),
      },
    ];

    const once = applyNotableContributionUplift(entries, notableSignal);
    const twice = applyNotableContributionUplift(once, notableSignal);

    expect(twice).toEqual(once);
    expect(once.map((e) => e.result.contribution)).toEqual(["high", "zero"]);
  });
});
