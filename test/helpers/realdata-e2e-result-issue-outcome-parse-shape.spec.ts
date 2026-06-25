// realdata-e2e-result-issue-outcome-parse-shape.spec.ts — T-0661 신설 순수 가드의
// 모든 분기(정합·누락·잉여·구조 결손·의미 위반)와 negative cases 충분 cover 박제.
//
// 본 spec 의 진실의 원천:
//   - 가드 함수 `assertRealDataResultIssueOutcomeMatchesParseShape` —
//     `./realdata-e2e-result-issue-outcome-parse-shape`
//   - 정규 parse-shape 키 목록 상수 `REAL_DATA_RESULT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS`
//     — 동일 모듈에서 신규 정의·export (본 task 가 진실의 원천을 만든다)
//   - 실제 파서 `parseRealDataResultIssueCreateEditOutput` — `./realdata-e2e-result-
//     issue-output-parse`(import 만, 정상 stdout 으로 호출해 실 산출 outcome 을 얻어
//     가드에 통과)
//
// 본 spec 의 회귀 봉인 happy-path 는 파서가 실제로 산출하는 outcome 의 키 집합이 선언된
// parse-shape 상수와 정합임을 박제한다. 한쪽이 미래에 drift 하면(예: 상수에 `htmlUrl`
// 추가 / 파서가 새 필드 추출) 이 spec 이 즉시 fail 한다.

import {
  REAL_DATA_RESULT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS,
  assertRealDataResultIssueOutcomeMatchesParseShape,
} from "./realdata-e2e-result-issue-outcome-parse-shape";
import {
  parseRealDataResultIssueCreateEditOutput,
  type RealDataResultIssueOutcome,
} from "./realdata-e2e-result-issue-output-parse";

// 정합 outcome fixture — 파서가 산출하는 `{issueNumber, url}` 정규 shape.
const validOutcome: RealDataResultIssueOutcome = {
  issueNumber: 42,
  url: "https://github.com/o/r/issues/42",
};

describe("REAL_DATA_RESULT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS (single-source)", () => {
  it("정규 키 목록은 ['issueNumber','url'] — RealDataResultIssueOutcome 멤버와 동일", () => {
    expect(REAL_DATA_RESULT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS).toEqual([
      "issueNumber",
      "url",
    ]);
  });
});

describe("assertRealDataResultIssueOutcomeMatchesParseShape — happy path (상수↔파서 산출 정합 회귀 봉인)", () => {
  it("정상 outcome({issueNumber:42, url:'...'}) + 상수 → throw 없이 통과", () => {
    expect(() =>
      assertRealDataResultIssueOutcomeMatchesParseShape(
        validOutcome,
        REAL_DATA_RESULT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS,
      ),
    ).not.toThrow();
  });

  it("파서 실 산출 outcome ↔ 상수 정합 회귀 봉인 — parseRealDataResultIssueCreateEditOutput 결과를 가드 통과", () => {
    // 파서를 정상 stdout 으로 호출해 얻은 실 outcome 을 본 가드에 통과시켜 상수↔파서
    // 산출 정합을 박제한다. 한쪽이 drift 하면 이 단언이 즉시 fail.
    const outcome = parseRealDataResultIssueCreateEditOutput(
      "https://github.com/owner/repo/issues/7\n",
    );
    expect(outcome.issueNumber).toBe(7);
    expect(outcome.url).toBe("https://github.com/owner/repo/issues/7");
    expect(() =>
      assertRealDataResultIssueOutcomeMatchesParseShape(
        outcome,
        REAL_DATA_RESULT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS,
      ),
    ).not.toThrow();
  });

  it("정합 케이스 직접 입력 — {issueNumber,url} / ['issueNumber','url'] → 통과", () => {
    expect(() =>
      assertRealDataResultIssueOutcomeMatchesParseShape(
        { issueNumber: 1, url: "https://github.com/o/r/issues/1" },
        ["issueNumber", "url"],
      ),
    ).not.toThrow();
  });
});

describe("assertRealDataResultIssueOutcomeMatchesParseShape — 누락(O4) 분기", () => {
  it("outcome={issueNumber} (url 누락) → url 누락 명시한 RangeError", () => {
    const outcome = {
      issueNumber: 1,
    } as unknown as RealDataResultIssueOutcome;
    expect(() =>
      assertRealDataResultIssueOutcomeMatchesParseShape(outcome, [
        "issueNumber",
        "url",
      ]),
    ).toThrow(/O4|누락/);
    expect(() =>
      assertRealDataResultIssueOutcomeMatchesParseShape(outcome, [
        "issueNumber",
        "url",
      ]),
    ).toThrow(/'url'/);
  });

  it("outcome={url} (issueNumber 누락) → issueNumber 누락 명시한 RangeError", () => {
    const outcome = {
      url: "https://github.com/o/r/issues/1",
    } as unknown as RealDataResultIssueOutcome;
    let err: unknown;
    try {
      assertRealDataResultIssueOutcomeMatchesParseShape(outcome, [
        "issueNumber",
        "url",
      ]);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(RangeError);
    expect((err as RangeError).message).toMatch(/'issueNumber'/);
  });
});

describe("assertRealDataResultIssueOutcomeMatchesParseShape — 잉여(O5) 분기", () => {
  it("outcome={issueNumber,url,htmlUrl} (잉여 htmlUrl) → htmlUrl 잉여 명시한 RangeError", () => {
    const outcome = {
      issueNumber: 1,
      url: "https://github.com/o/r/issues/1",
      htmlUrl: "https://github.com/o/r/issues/1",
    } as unknown as RealDataResultIssueOutcome;
    expect(() =>
      assertRealDataResultIssueOutcomeMatchesParseShape(outcome, [
        "issueNumber",
        "url",
      ]),
    ).toThrow(/O5|잉여/);
    expect(() =>
      assertRealDataResultIssueOutcomeMatchesParseShape(outcome, [
        "issueNumber",
        "url",
      ]),
    ).toThrow(/'htmlUrl'/);
  });
});

describe("assertRealDataResultIssueOutcomeMatchesParseShape — 누락·잉여 동시(부분 교집합)", () => {
  it("outcome={issueNumber,htmlUrl} vs shape ['issueNumber','url'] → 누락(url)이 먼저 fail-fast", () => {
    // O4(누락) 검사가 O5(잉여)보다 먼저 — url 누락이 먼저 보고된다(htmlUrl 은 잉여).
    const outcome = {
      issueNumber: 1,
      htmlUrl: "https://github.com/o/r/issues/1",
    } as unknown as RealDataResultIssueOutcome;
    expect(() =>
      assertRealDataResultIssueOutcomeMatchesParseShape(outcome, [
        "issueNumber",
        "url",
      ]),
    ).toThrow(/'url'/);
    expect(() =>
      assertRealDataResultIssueOutcomeMatchesParseShape(outcome, [
        "issueNumber",
        "url",
      ]),
    ).toThrow(RangeError);
  });
});

describe("assertRealDataResultIssueOutcomeMatchesParseShape — 순서 무관·집합 비교", () => {
  it("parseShapeKeys 순서만 다른 동일 집합 — ['url','issueNumber'] → 통과", () => {
    expect(() =>
      assertRealDataResultIssueOutcomeMatchesParseShape(validOutcome, [
        "url",
        "issueNumber",
      ]),
    ).not.toThrow();
  });

  it("outcome 키 삽입 순서 무관 — {url,issueNumber} 도 정합 통과", () => {
    const outcome = {
      url: "https://github.com/o/r/issues/42",
      issueNumber: 42,
    };
    expect(() =>
      assertRealDataResultIssueOutcomeMatchesParseShape(
        outcome,
        REAL_DATA_RESULT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS,
      ),
    ).not.toThrow();
  });
});

describe("assertRealDataResultIssueOutcomeMatchesParseShape — 대소문자 민감", () => {
  it("outcome 키가 'IssueNumber'(대문자 시작) → 'issueNumber' 와 불일치 거부(case-sensitive)", () => {
    const outcome = {
      IssueNumber: 1,
      url: "https://github.com/o/r/issues/1",
    } as unknown as RealDataResultIssueOutcome;
    // 'issueNumber' 누락 + 'IssueNumber' 잉여 — 누락(O4)이 먼저 fail-fast.
    expect(() =>
      assertRealDataResultIssueOutcomeMatchesParseShape(outcome, [
        "issueNumber",
        "url",
      ]),
    ).toThrow(RangeError);
    expect(() =>
      assertRealDataResultIssueOutcomeMatchesParseShape(outcome, [
        "issueNumber",
        "url",
      ]),
    ).toThrow(/'issueNumber'/);
  });
});

describe("assertRealDataResultIssueOutcomeMatchesParseShape — parseShapeKeys 중복 키 거부(O2)", () => {
  it("parseShapeKeys=['issueNumber','issueNumber','url'] (중복 issueNumber) → 중복 명시한 RangeError", () => {
    expect(() =>
      assertRealDataResultIssueOutcomeMatchesParseShape(validOutcome, [
        "issueNumber",
        "issueNumber",
        "url",
      ]),
    ).toThrow(/중복/);
    expect(() =>
      assertRealDataResultIssueOutcomeMatchesParseShape(validOutcome, [
        "issueNumber",
        "issueNumber",
        "url",
      ]),
    ).toThrow(/'issueNumber'/);
  });
});

describe("assertRealDataResultIssueOutcomeMatchesParseShape — parseShapeKeys 빈·공백 키 거부(O2)", () => {
  it("parseShapeKeys=['issueNumber','','url'] (빈 키) → 빈 키 RangeError", () => {
    expect(() =>
      assertRealDataResultIssueOutcomeMatchesParseShape(validOutcome, [
        "issueNumber",
        "",
        "url",
      ]),
    ).toThrow(RangeError);
    expect(() =>
      assertRealDataResultIssueOutcomeMatchesParseShape(validOutcome, [
        "issueNumber",
        "",
        "url",
      ]),
    ).toThrow(/빈|공백/);
  });

  it("parseShapeKeys=['issueNumber','  ','url'] (공백-only 키) → 빈 키 RangeError", () => {
    expect(() =>
      assertRealDataResultIssueOutcomeMatchesParseShape(validOutcome, [
        "issueNumber",
        "  ",
        "url",
      ]),
    ).toThrow(RangeError);
  });
});

describe("assertRealDataResultIssueOutcomeMatchesParseShape — outcome 빈·공백 키 거부(O3)", () => {
  it("outcome 이 빈 문자열 키를 포함 → 빈 키 RangeError", () => {
    const outcome = {
      issueNumber: 1,
      url: "https://github.com/o/r/issues/1",
      "": "empty-key",
    } as unknown as RealDataResultIssueOutcome;
    expect(() =>
      assertRealDataResultIssueOutcomeMatchesParseShape(outcome, [
        "issueNumber",
        "url",
      ]),
    ).toThrow(RangeError);
    expect(() =>
      assertRealDataResultIssueOutcomeMatchesParseShape(outcome, [
        "issueNumber",
        "url",
      ]),
    ).toThrow(/빈|공백/);
  });

  it("outcome 이 공백-only 키를 포함 → 빈 키 RangeError", () => {
    const outcome = {
      issueNumber: 1,
      url: "https://github.com/o/r/issues/1",
      "  ": "ws-key",
    } as unknown as RealDataResultIssueOutcome;
    expect(() =>
      assertRealDataResultIssueOutcomeMatchesParseShape(outcome, [
        "issueNumber",
        "url",
      ]),
    ).toThrow(RangeError);
  });
});

describe("assertRealDataResultIssueOutcomeMatchesParseShape — 빈 parseShapeKeys 거부(O1)", () => {
  it("parseShapeKeys=[] (빈 배열) → RangeError(parse-shape 부재)", () => {
    expect(() =>
      assertRealDataResultIssueOutcomeMatchesParseShape(validOutcome, []),
    ).toThrow(RangeError);
    expect(() =>
      assertRealDataResultIssueOutcomeMatchesParseShape(validOutcome, []),
    ).toThrow(/빈|부재|shape/);
  });
});

describe("assertRealDataResultIssueOutcomeMatchesParseShape — 구조 결손(O0) → TypeError", () => {
  it("outcome=null → TypeError", () => {
    expect(() =>
      assertRealDataResultIssueOutcomeMatchesParseShape(
        null as unknown as RealDataResultIssueOutcome,
        ["issueNumber", "url"],
      ),
    ).toThrow(TypeError);
  });

  it("outcome=undefined → TypeError", () => {
    expect(() =>
      assertRealDataResultIssueOutcomeMatchesParseShape(
        undefined as unknown as RealDataResultIssueOutcome,
        ["issueNumber", "url"],
      ),
    ).toThrow(TypeError);
  });

  it("outcome=숫자(비객체) → TypeError", () => {
    expect(() =>
      assertRealDataResultIssueOutcomeMatchesParseShape(
        123 as unknown as RealDataResultIssueOutcome,
        ["issueNumber", "url"],
      ),
    ).toThrow(TypeError);
  });

  it("outcome=문자열(비객체) → TypeError", () => {
    expect(() =>
      assertRealDataResultIssueOutcomeMatchesParseShape(
        "not-an-object" as unknown as RealDataResultIssueOutcome,
        ["issueNumber", "url"],
      ),
    ).toThrow(TypeError);
  });

  it("outcome=배열 → TypeError(배열은 outcome 객체가 아니다)", () => {
    expect(() =>
      assertRealDataResultIssueOutcomeMatchesParseShape(
        ["issueNumber", "url"] as unknown as RealDataResultIssueOutcome,
        ["issueNumber", "url"],
      ),
    ).toThrow(TypeError);
  });

  it("parseShapeKeys=null → TypeError", () => {
    expect(() =>
      assertRealDataResultIssueOutcomeMatchesParseShape(
        validOutcome,
        null as unknown as readonly string[],
      ),
    ).toThrow(TypeError);
  });

  it("parseShapeKeys=undefined → TypeError", () => {
    expect(() =>
      assertRealDataResultIssueOutcomeMatchesParseShape(
        validOutcome,
        undefined as unknown as readonly string[],
      ),
    ).toThrow(TypeError);
  });

  it("parseShapeKeys=비배열(string) → TypeError", () => {
    expect(() =>
      assertRealDataResultIssueOutcomeMatchesParseShape(
        validOutcome,
        "issueNumber,url" as unknown as readonly string[],
      ),
    ).toThrow(TypeError);
  });

  it("parseShapeKeys 원소가 비-string → TypeError", () => {
    expect(() =>
      assertRealDataResultIssueOutcomeMatchesParseShape(validOutcome, [
        "issueNumber",
        42 as unknown as string,
      ]),
    ).toThrow(TypeError);
  });
});

describe("assertRealDataResultIssueOutcomeMatchesParseShape — 순수성·결정론·무공유", () => {
  it("동일 입력으로 두 번 호출해도 동일 동작(정상 케이스: 두 번 다 void)", () => {
    expect(() =>
      assertRealDataResultIssueOutcomeMatchesParseShape(
        validOutcome,
        REAL_DATA_RESULT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS,
      ),
    ).not.toThrow();
    expect(() =>
      assertRealDataResultIssueOutcomeMatchesParseShape(
        validOutcome,
        REAL_DATA_RESULT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS,
      ),
    ).not.toThrow();
  });

  it("입력 outcome 을 mutate 하지 않는다 — 호출 후 own 키/값 보존", () => {
    const outcome = {
      issueNumber: 42,
      url: "https://github.com/o/r/issues/42",
    };
    const before = { ...outcome };
    const keysBefore = Object.keys(outcome);
    assertRealDataResultIssueOutcomeMatchesParseShape(
      outcome,
      REAL_DATA_RESULT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS,
    );
    expect(outcome).toEqual(before);
    expect(Object.keys(outcome)).toEqual(keysBefore);
  });

  it("입력 parseShapeKeys 를 mutate 하지 않는다 — 호출 후 배열 원본 보존", () => {
    const shape = ["issueNumber", "url"];
    const before = [...shape];
    assertRealDataResultIssueOutcomeMatchesParseShape(validOutcome, shape);
    expect(shape).toEqual(before);
  });
});
