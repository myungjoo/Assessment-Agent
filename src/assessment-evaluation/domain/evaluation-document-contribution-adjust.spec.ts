// evaluation-document-contribution-adjust.ts 의 colocated unit test (CLAUDE.md §3.2
// R-112 — happy / error / branch / negative cases 충분 cover).
// `applyDocumentContributionUplift` / `applyDocumentContributionAnnotation` 순수
// 함수의 README 39 행 / REQ-020 문서 축 상향
// 동작(notable author 전 단위 상향 + 비대상 passthrough + zero 하한 우선 + enum 외
// 보수 무변경 + 빈 입력 흡수 + 멱등 + 입력 비변형 + 필드 직교)을 검증한다.
// mirror 원형: evaluation-notable-contribution-adjust.spec.ts 의
// `describe("applyNotableContributionUplift")`(T-1921 코드 축) — 소비 신호만 문서
// 축(DocumentContributionSignal)으로 바꾼 동형 mirror 다.

import {
  applyDocumentContributionAnnotation,
  applyDocumentContributionUplift,
  DOCUMENT_CONTRIBUTION_NARRATIVE_MARKER,
  DOCUMENT_CONTRIBUTION_UPLIFT_LEVEL,
  type DocumentContributionAdjustEntry,
} from "./evaluation-document-contribution-adjust";
import type {
  DocumentContributionEntry,
  DocumentContributionSignal,
} from "./evaluation-document-contribution-signal";
import { NOTABLE_CONTRIBUTION_NARRATIVE_MARKER } from "./evaluation-notable-contribution-adjust";
import type { EvaluationResult } from "./evaluation-result";

// EvaluationResult stub 빌더. 본 helper 는 contribution 만 검토 / 조정하므로 나머지
// 필드는 고정 — overrides 로 필요한 필드만 변경한다.
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

// DocumentContributionEntry stub 빌더.
function makeAuthorEntry(
  overrides: Partial<DocumentContributionEntry> = {},
): DocumentContributionEntry {
  return {
    author: "writer",
    documentUnitCount: 12,
    notable: true,
    ...overrides,
  };
}

// DocumentContributionSignal stub 빌더.
function makeSignal(
  byAuthor: DocumentContributionEntry[],
  meanDocumentUnitCount = 4,
): DocumentContributionSignal {
  return {
    totalAuthorCount: byAuthor.length,
    meanDocumentUnitCount,
    byAuthor,
    notableDetected: byAuthor.some((entry) => entry.notable),
  };
}

describe("applyDocumentContributionUplift", () => {
  // notable=true 인 writer 1 명만 담은 baseline 신호 + notable=false normal 혼합.
  const notableSignal = makeSignal([makeAuthorEntry({ author: "writer" })]);
  const mixedSignal = makeSignal([
    makeAuthorEntry({ author: "writer" }),
    makeAuthorEntry({ author: "normal", notable: false }),
  ]);

  it("(happy) 상향 목표 등급 상수는 high 다", () => {
    expect(DOCUMENT_CONTRIBUTION_UPLIFT_LEVEL).toBe("high");
  });

  it("(happy) 문서 축 notable author 의 모든 단위를 high 로 상향한다", () => {
    const entries: DocumentContributionAdjustEntry[] = [
      {
        author: "writer",
        result: makeResult({ unitId: "u1", contribution: "low" }),
      },
      {
        author: "writer",
        result: makeResult({ unitId: "u2", contribution: "medium" }),
      },
    ];

    const out = applyDocumentContributionUplift(entries, notableSignal);

    // author-level 전파 — 같은 author 의 모든 단위가 대상. 길이·순서 보존.
    expect(out).toHaveLength(entries.length);
    expect(out.map((e) => e.author)).toEqual(["writer", "writer"]);
    expect(out.map((e) => e.result.unitId)).toEqual(["u1", "u2"]);
    expect(out.map((e) => e.result.contribution)).toEqual([
      DOCUMENT_CONTRIBUTION_UPLIFT_LEVEL,
      "high",
    ]);
  });

  it.each([null, undefined])(
    "(error) entries 가 %p 면 한국어 TypeError",
    (bad) => {
      const call = (): unknown =>
        applyDocumentContributionUplift(
          bad as unknown as DocumentContributionAdjustEntry[],
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
        applyDocumentContributionUplift(
          [],
          bad as unknown as DocumentContributionSignal,
        );
      expect(call).toThrow(TypeError);
      expect(call).toThrow("signal 은 null 또는 undefined 일 수 없습니다.");
    },
  );

  // 설계 규칙 1~6 분기 + negative(무변경) 케이스를 한 표로 cover 한다.
  it.each([
    ["(1) signal 미매칭 author → 무변경", "ghost", "low", "low"],
    ["(2) notable=false author → 무변경", "normal", "medium", "medium"],
    ["(3) zero 는 상향하지 않는다(하한 우선)", "writer", "zero", "zero"],
    ["(4a) low → high 상향", "writer", "low", "high"],
    ["(4b) medium → high 상향", "writer", "medium", "high"],
    ["(5) 이미 high 면 값 동일(멱등)", "writer", "high", "high"],
    ["(6) enum 외 값은 보수적 무변경", "writer", "bogus", "bogus"],
  ])("%s", (_label, author, contribution, expected) => {
    const entries: DocumentContributionAdjustEntry[] = [
      {
        author,
        result: makeResult({
          contribution: contribution as EvaluationResult["contribution"],
        }),
      },
    ];

    const out = applyDocumentContributionUplift(entries, mixedSignal);

    expect(out[0].result.contribution).toBe(expected);
    // 어떤 분기든 항상 새 객체로 복제한다(입력 비변형 보장).
    expect(out[0].result).not.toBe(entries[0].result);
  });

  it("(negative) 빈 entries → 빈 배열, 빈 byAuthor → 전 단위 무변경 복제", () => {
    expect(applyDocumentContributionUplift([], makeSignal([]))).toEqual([]);

    const entries: DocumentContributionAdjustEntry[] = [
      { author: "writer", result: makeResult({ contribution: "low" }) },
    ];
    const out = applyDocumentContributionUplift(entries, makeSignal([]));

    expect(out[0].result.contribution).toBe("low");
    expect(out[0].result).not.toBe(entries[0].result);
  });

  it("(negative) contribution 외 필드는 상향 시에도 그대로 전사된다", () => {
    const entries: DocumentContributionAdjustEntry[] = [
      {
        author: "writer",
        result: makeResult({
          unitId: "confluence:hq:p9",
          narrative: "문서 기여 평가문",
          difficulty: "hard",
          volume: 777,
          contribution: "low",
        }),
      },
    ];

    const out = applyDocumentContributionUplift(entries, notableSignal);

    expect(out[0].result).toEqual({
      unitId: "confluence:hq:p9",
      narrative: "문서 기여 평가문",
      difficulty: "hard",
      volume: 777,
      contribution: "high",
    });
  });

  it("(negative) 입력 entries / result / signal 을 변형하지 않는다", () => {
    const entries = Object.freeze([
      Object.freeze({
        author: "writer",
        result: Object.freeze(makeResult({ contribution: "medium" })),
      }),
    ]) as unknown as DocumentContributionAdjustEntry[];
    const snapshot = JSON.parse(JSON.stringify(entries));
    const signalSnapshot = JSON.parse(JSON.stringify(notableSignal));

    const out = applyDocumentContributionUplift(entries, notableSignal);

    expect(out[0].result.contribution).toBe("high");
    expect(entries).toEqual(snapshot);
    expect(notableSignal).toEqual(signalSnapshot);
  });

  it("(멱등) 2 회 연속 적용 결과가 1 회 적용 결과와 같다", () => {
    const entries: DocumentContributionAdjustEntry[] = [
      {
        author: "writer",
        result: makeResult({ unitId: "u1", contribution: "low" }),
      },
      {
        author: "writer",
        result: makeResult({ unitId: "u2", contribution: "zero" }),
      },
    ];

    const once = applyDocumentContributionUplift(entries, notableSignal);
    const twice = applyDocumentContributionUplift(once, notableSignal);

    expect(twice).toEqual(once);
    expect(once.map((e) => e.result.contribution)).toEqual(["high", "zero"]);
  });
});

describe("applyDocumentContributionAnnotation", () => {
  const MARKER = DOCUMENT_CONTRIBUTION_NARRATIVE_MARKER;
  // notable=true 인 writer 1 명 + notable=false normal 혼합 baseline 신호.
  const annotationSignal = makeSignal([
    makeAuthorEntry({ author: "writer" }),
    makeAuthorEntry({ author: "normal", notable: false }),
  ]);

  describe("happy path", () => {
    it("(happy) 문서 축 marker 상수는 코드 축과 대칭인 한국어 marker 다", () => {
      expect(DOCUMENT_CONTRIBUTION_NARRATIVE_MARKER).toBe("[문서기여] ");
    });

    it("(happy) notable=true author 의 모든 단위 narrative 에 marker 를 접두한다", () => {
      const entries: DocumentContributionAdjustEntry[] = [
        {
          author: "writer",
          result: makeResult({ unitId: "u1", narrative: "문서 A" }),
        },
        {
          author: "writer",
          result: makeResult({ unitId: "u2", narrative: "문서 B" }),
        },
      ];

      const out = applyDocumentContributionAnnotation(
        entries,
        annotationSignal,
      );

      expect(out).toHaveLength(2);
      expect(out[0].result.narrative).toBe(`${MARKER}문서 A`);
      expect(out[1].result.narrative).toBe(`${MARKER}문서 B`);
    });
  });

  describe("error path (명시적 계약 위반만 throw)", () => {
    it.each([null, undefined])(
      "(error) entries 가 %p 이면 한국어 TypeError",
      (bad) => {
        const call = () =>
          applyDocumentContributionAnnotation(
            bad as unknown as DocumentContributionAdjustEntry[],
            annotationSignal,
          );

        expect(call).toThrow(TypeError);
        expect(call).toThrow("entries 는 null 또는 undefined 일 수 없습니다.");
      },
    );

    it.each([null, undefined])(
      "(error) signal 이 %p 이면 한국어 TypeError",
      (bad) => {
        const call = () =>
          applyDocumentContributionAnnotation(
            [],
            bad as unknown as DocumentContributionSignal,
          );

        expect(call).toThrow(TypeError);
        expect(call).toThrow("signal 은 null 또는 undefined 일 수 없습니다.");
      },
    );
  });

  describe("분기 · 흡수", () => {
    it.each([
      ["(분기 a) 신호에 없는 author", "unknown", "미매칭"],
      ["(분기 b) notable=false author", "normal", "정상"],
    ])("%s 단위는 narrative 를 전사한다", (_label, author, narrative) => {
      const out = applyDocumentContributionAnnotation(
        [{ author, result: makeResult({ narrative }) }],
        annotationSignal,
      );

      expect(out[0].result.narrative).toBe(narrative);
    });

    it("(분기 c·d) 최초 접두 후 재적용해도 중복 접두하지 않는다(멱등)", () => {
      const entries: DocumentContributionAdjustEntry[] = [
        { author: "writer", result: makeResult({ narrative: "본문" }) },
      ];

      const once = applyDocumentContributionAnnotation(
        entries,
        annotationSignal,
      );
      const twice = applyDocumentContributionAnnotation(once, annotationSignal);

      expect(once[0].result.narrative).toBe(`${MARKER}본문`);
      expect(twice).toEqual(once);
      expect(twice[0].result.narrative).toBe(`${MARKER}본문`);
    });

    it("(분기 e) 빈 entries 는 빈 배열로 흡수한다", () => {
      expect(applyDocumentContributionAnnotation([], annotationSignal)).toEqual(
        [],
      );
    });

    it("(분기 f) 빈 byAuthor 는 전 단위 무변경 복제로 흡수한다", () => {
      const entries: DocumentContributionAdjustEntry[] = [
        { author: "writer", result: makeResult({ narrative: "본문" }) },
      ];

      const out = applyDocumentContributionAnnotation(entries, makeSignal([]));

      expect(out[0].result.narrative).toBe("본문");
      expect(out[0].result).not.toBe(entries[0].result);
    });
  });

  describe("negative · 비변형", () => {
    it("(negative) 비대상 author 의 narrative 는 marker 로 오염되지 않는다", () => {
      const out = applyDocumentContributionAnnotation(
        [
          { author: "writer", result: makeResult({ narrative: "대상" }) },
          { author: "normal", result: makeResult({ narrative: "비대상" }) },
          { author: "unknown", result: makeResult({ narrative: "미매칭" }) },
        ],
        annotationSignal,
      );

      expect(out[1].result.narrative).not.toContain(MARKER);
      expect(out[2].result.narrative).not.toContain(MARKER);
    });

    it("(negative) narrative 외 필드는 변경하지 않는다(필드 직교)", () => {
      const out = applyDocumentContributionAnnotation(
        [
          {
            author: "writer",
            result: makeResult({
              unitId: "u9",
              contribution: "low",
              difficulty: "hard",
              volume: 777,
            }),
          },
        ],
        annotationSignal,
      );

      expect(out[0].result).toMatchObject({
        unitId: "u9",
        contribution: "low",
        difficulty: "hard",
        volume: 777,
      });
    });

    it("(negative) 입력 entries / result / signal 을 변형하지 않는다", () => {
      const entries = Object.freeze([
        Object.freeze({
          author: "writer",
          result: Object.freeze(makeResult({ narrative: "본문" })),
        }),
      ]) as unknown as DocumentContributionAdjustEntry[];
      const snapshot = JSON.parse(JSON.stringify(entries));
      const signalSnapshot = JSON.parse(JSON.stringify(annotationSignal));

      const out = applyDocumentContributionAnnotation(
        entries,
        annotationSignal,
      );

      expect(out[0].result.narrative).toBe(`${MARKER}본문`);
      expect(entries).toEqual(snapshot);
      expect(annotationSignal).toEqual(signalSnapshot);
    });

    it("(negative) 출력 길이 · 순서를 보존한다", () => {
      const entries: DocumentContributionAdjustEntry[] = [
        { author: "unknown", result: makeResult({ unitId: "u1" }) },
        { author: "writer", result: makeResult({ unitId: "u2" }) },
        { author: "normal", result: makeResult({ unitId: "u3" }) },
      ];

      const out = applyDocumentContributionAnnotation(
        entries,
        annotationSignal,
      );

      expect(out.map((e) => e.result.unitId)).toEqual(["u1", "u2", "u3"]);
      expect(out.map((e) => e.author)).toEqual(["unknown", "writer", "normal"]);
    });

    it("(negative) 코드 축 marker 와 문자열 충돌하지 않는다", () => {
      expect(DOCUMENT_CONTRIBUTION_NARRATIVE_MARKER).not.toBe(
        NOTABLE_CONTRIBUTION_NARRATIVE_MARKER,
      );
      expect(
        DOCUMENT_CONTRIBUTION_NARRATIVE_MARKER.startsWith(
          NOTABLE_CONTRIBUTION_NARRATIVE_MARKER,
        ),
      ).toBe(false);

      // 코드 축 marker 가 이미 붙은 narrative 에도 문서 축 marker 를 접두하며,
      // 코드 축 marker 본문은 손상되지 않는다.
      const out = applyDocumentContributionAnnotation(
        [
          {
            author: "writer",
            result: makeResult({
              narrative: `${NOTABLE_CONTRIBUTION_NARRATIVE_MARKER}본문`,
            }),
          },
        ],
        annotationSignal,
      );

      expect(out[0].result.narrative).toBe(
        `${MARKER}${NOTABLE_CONTRIBUTION_NARRATIVE_MARKER}본문`,
      );
    });
  });
});
