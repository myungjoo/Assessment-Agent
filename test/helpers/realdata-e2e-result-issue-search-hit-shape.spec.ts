// realdata-e2e-result-issue-search-hit-shape.spec.ts — T-0659 신설 순수 가드의 모든
// 분기(정합·누락·잉여·구조 결손·의미 위반)와 negative cases 충분 cover 박제.
//
// 본 spec 의 진실의 원천:
//   - 가드 함수 `assertRealDataResultIssueSearchHitMatchesParseShape` —
//     `./realdata-e2e-result-issue-search-hit-shape`
//   - 정규 parse-shape 키 목록 상수 `REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS`
//     — 동일 모듈에서 re-export(정의는 `./realdata-e2e-result-issue-search-json-fields`)
//   - 실제 파서 `parseRealDataResultIssueSearchOutput` — `./realdata-e2e-result-issue-
//     search-parse`(import 만, 정상 stdout 으로 호출해 실 산출 hit 를 얻어 가드에 통과)
//
// 본 spec 의 회귀 봉인 happy-path 는 파서가 실제로 산출하는 hit 의 키 집합이 선언된
// parse-shape 상수와 정합임을 박제한다. 한쪽이 미래에 drift 하면(예: 상수에 `author`
// 추가 / 파서가 새 필드 추출) 이 spec 이 즉시 fail 한다.

import type { RealDataResultIssueSearchHit } from "./realdata-e2e-result-issue-action";
import {
  REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS,
  assertRealDataResultIssueSearchHitMatchesParseShape,
} from "./realdata-e2e-result-issue-search-hit-shape";
import { parseRealDataResultIssueSearchOutput } from "./realdata-e2e-result-issue-search-parse";

// 정합 hit fixture — 파서가 산출하는 `{number, title, body}` 정규 shape.
const validHit: RealDataResultIssueSearchHit = {
  number: 42,
  title: "t",
  body: "b",
};

describe("REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS (re-export)", () => {
  it("정규 키 목록은 ['number','title','body'] — RealDataResultIssueSearchHit 멤버와 동일", () => {
    expect(REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS).toEqual([
      "number",
      "title",
      "body",
    ]);
  });
});

describe("assertRealDataResultIssueSearchHitMatchesParseShape — happy path (상수↔파서 산출 정합 회귀 봉인)", () => {
  it("정상 hit({number:42,title:'t',body:'b'}) + 상수 → throw 없이 통과", () => {
    expect(() =>
      assertRealDataResultIssueSearchHitMatchesParseShape(
        validHit,
        REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS,
      ),
    ).not.toThrow();
  });

  it("파서 실 산출 hit ↔ 상수 정합 회귀 봉인 — parseRealDataResultIssueSearchOutput 결과를 가드 통과", () => {
    // 파서를 정상 stdout 으로 호출해 얻은 실 hit 를 본 가드에 통과시켜 상수↔파서 산출
    // 정합을 박제한다. 한쪽이 drift 하면 이 단언이 즉시 fail.
    const hits = parseRealDataResultIssueSearchOutput(
      JSON.stringify([{ number: 7, title: "real", body: "marker" }]),
    );
    expect(hits).toHaveLength(1);
    expect(() =>
      assertRealDataResultIssueSearchHitMatchesParseShape(
        hits[0],
        REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS,
      ),
    ).not.toThrow();
  });

  it("정합 케이스 직접 입력 — {number,title,body} / ['number','title','body'] → 통과", () => {
    expect(() =>
      assertRealDataResultIssueSearchHitMatchesParseShape(
        { number: 1, title: "x", body: "y" },
        ["number", "title", "body"],
      ),
    ).not.toThrow();
  });
});

describe("assertRealDataResultIssueSearchHitMatchesParseShape — 누락(H4) 분기", () => {
  it("hit={number,title} (body 누락) → body 누락 명시한 RangeError", () => {
    const hit = {
      number: 1,
      title: "x",
    } as unknown as RealDataResultIssueSearchHit;
    expect(() =>
      assertRealDataResultIssueSearchHitMatchesParseShape(hit, [
        "number",
        "title",
        "body",
      ]),
    ).toThrow(/H4|누락/);
    expect(() =>
      assertRealDataResultIssueSearchHitMatchesParseShape(hit, [
        "number",
        "title",
        "body",
      ]),
    ).toThrow(/'body'/);
  });

  it("hit={number} (title,body 누락) → 두 키 모두 누락 메시지에 포함", () => {
    const hit = { number: 1 } as unknown as RealDataResultIssueSearchHit;
    let err: unknown;
    try {
      assertRealDataResultIssueSearchHitMatchesParseShape(hit, [
        "number",
        "title",
        "body",
      ]);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(RangeError);
    expect((err as RangeError).message).toMatch(/'title'/);
    expect((err as RangeError).message).toMatch(/'body'/);
  });
});

describe("assertRealDataResultIssueSearchHitMatchesParseShape — 잉여(H5) 분기", () => {
  it("hit={number,title,body,author} (잉여 author) → author 잉여 명시한 RangeError", () => {
    const hit = {
      number: 1,
      title: "x",
      body: "y",
      author: "z",
    } as unknown as RealDataResultIssueSearchHit;
    expect(() =>
      assertRealDataResultIssueSearchHitMatchesParseShape(hit, [
        "number",
        "title",
        "body",
      ]),
    ).toThrow(/H5|잉여/);
    expect(() =>
      assertRealDataResultIssueSearchHitMatchesParseShape(hit, [
        "number",
        "title",
        "body",
      ]),
    ).toThrow(/'author'/);
  });
});

describe("assertRealDataResultIssueSearchHitMatchesParseShape — 누락·잉여 동시(부분 교집합)", () => {
  it("hit={number,title,summary} vs shape ['number','title','body'] → 누락(body)이 먼저 fail-fast", () => {
    // H4(누락) 검사가 H5(잉여)보다 먼저 — body 누락이 먼저 보고된다(summary 는 잉여).
    const hit = {
      number: 1,
      title: "x",
      summary: "s",
    } as unknown as RealDataResultIssueSearchHit;
    expect(() =>
      assertRealDataResultIssueSearchHitMatchesParseShape(hit, [
        "number",
        "title",
        "body",
      ]),
    ).toThrow(/'body'/);
    expect(() =>
      assertRealDataResultIssueSearchHitMatchesParseShape(hit, [
        "number",
        "title",
        "body",
      ]),
    ).toThrow(RangeError);
  });
});

describe("assertRealDataResultIssueSearchHitMatchesParseShape — 순서 무관·집합 비교", () => {
  it("parseShapeKeys 순서만 다른 동일 집합 — ['body','number','title'] → 통과", () => {
    expect(() =>
      assertRealDataResultIssueSearchHitMatchesParseShape(validHit, [
        "body",
        "number",
        "title",
      ]),
    ).not.toThrow();
  });

  it("hit 키 삽입 순서 무관 — {body,title,number} 도 정합 통과", () => {
    const hit = { body: "b", title: "t", number: 42 };
    expect(() =>
      assertRealDataResultIssueSearchHitMatchesParseShape(
        hit,
        REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS,
      ),
    ).not.toThrow();
  });
});

describe("assertRealDataResultIssueSearchHitMatchesParseShape — 대소문자 민감", () => {
  it("hit 키가 'Number'(대문자) → 'number' 와 불일치 거부(case-sensitive)", () => {
    const hit = {
      Number: 1,
      title: "x",
      body: "y",
    } as unknown as RealDataResultIssueSearchHit;
    // 'number' 누락 + 'Number' 잉여 — 누락(H4)이 먼저 fail-fast.
    expect(() =>
      assertRealDataResultIssueSearchHitMatchesParseShape(hit, [
        "number",
        "title",
        "body",
      ]),
    ).toThrow(RangeError);
    expect(() =>
      assertRealDataResultIssueSearchHitMatchesParseShape(hit, [
        "number",
        "title",
        "body",
      ]),
    ).toThrow(/'number'/);
  });
});

describe("assertRealDataResultIssueSearchHitMatchesParseShape — parseShapeKeys 중복 키 거부(H2)", () => {
  it("parseShapeKeys=['number','number','title','body'] (중복 number) → 중복 명시한 RangeError", () => {
    expect(() =>
      assertRealDataResultIssueSearchHitMatchesParseShape(validHit, [
        "number",
        "number",
        "title",
        "body",
      ]),
    ).toThrow(/중복/);
    expect(() =>
      assertRealDataResultIssueSearchHitMatchesParseShape(validHit, [
        "number",
        "number",
        "title",
        "body",
      ]),
    ).toThrow(/'number'/);
  });
});

describe("assertRealDataResultIssueSearchHitMatchesParseShape — parseShapeKeys 빈·공백 키 거부(H2)", () => {
  it("parseShapeKeys=['number','','body'] (빈 키) → 빈 키 RangeError", () => {
    expect(() =>
      assertRealDataResultIssueSearchHitMatchesParseShape(validHit, [
        "number",
        "",
        "body",
      ]),
    ).toThrow(RangeError);
    expect(() =>
      assertRealDataResultIssueSearchHitMatchesParseShape(validHit, [
        "number",
        "",
        "body",
      ]),
    ).toThrow(/빈|공백/);
  });

  it("parseShapeKeys=['number','  ','body'] (공백-only 키) → 빈 키 RangeError", () => {
    expect(() =>
      assertRealDataResultIssueSearchHitMatchesParseShape(validHit, [
        "number",
        "  ",
        "body",
      ]),
    ).toThrow(RangeError);
  });
});

describe("assertRealDataResultIssueSearchHitMatchesParseShape — hit 빈·공백 키 거부(H3)", () => {
  it("hit 가 빈 문자열 키를 포함 → 빈 키 RangeError", () => {
    const hit = {
      number: 1,
      title: "x",
      body: "y",
      "": "empty-key",
    } as unknown as RealDataResultIssueSearchHit;
    expect(() =>
      assertRealDataResultIssueSearchHitMatchesParseShape(hit, [
        "number",
        "title",
        "body",
      ]),
    ).toThrow(RangeError);
    expect(() =>
      assertRealDataResultIssueSearchHitMatchesParseShape(hit, [
        "number",
        "title",
        "body",
      ]),
    ).toThrow(/빈|공백/);
  });

  it("hit 가 공백-only 키를 포함 → 빈 키 RangeError", () => {
    const hit = {
      number: 1,
      title: "x",
      body: "y",
      "  ": "ws-key",
    } as unknown as RealDataResultIssueSearchHit;
    expect(() =>
      assertRealDataResultIssueSearchHitMatchesParseShape(hit, [
        "number",
        "title",
        "body",
      ]),
    ).toThrow(RangeError);
  });
});

describe("assertRealDataResultIssueSearchHitMatchesParseShape — 빈 parseShapeKeys 거부(H1)", () => {
  it("parseShapeKeys=[] (빈 배열) → RangeError(parse-shape 부재)", () => {
    expect(() =>
      assertRealDataResultIssueSearchHitMatchesParseShape(validHit, []),
    ).toThrow(RangeError);
    expect(() =>
      assertRealDataResultIssueSearchHitMatchesParseShape(validHit, []),
    ).toThrow(/빈|부재|shape/);
  });
});

describe("assertRealDataResultIssueSearchHitMatchesParseShape — 구조 결손(H0) → TypeError", () => {
  it("hit=null → TypeError", () => {
    expect(() =>
      assertRealDataResultIssueSearchHitMatchesParseShape(
        null as unknown as RealDataResultIssueSearchHit,
        ["number", "title", "body"],
      ),
    ).toThrow(TypeError);
  });

  it("hit=undefined → TypeError", () => {
    expect(() =>
      assertRealDataResultIssueSearchHitMatchesParseShape(
        undefined as unknown as RealDataResultIssueSearchHit,
        ["number", "title", "body"],
      ),
    ).toThrow(TypeError);
  });

  it("hit=숫자(비객체) → TypeError", () => {
    expect(() =>
      assertRealDataResultIssueSearchHitMatchesParseShape(
        123 as unknown as RealDataResultIssueSearchHit,
        ["number", "title", "body"],
      ),
    ).toThrow(TypeError);
  });

  it("hit=문자열(비객체) → TypeError", () => {
    expect(() =>
      assertRealDataResultIssueSearchHitMatchesParseShape(
        "not-an-object" as unknown as RealDataResultIssueSearchHit,
        ["number", "title", "body"],
      ),
    ).toThrow(TypeError);
  });

  it("hit=배열 → TypeError(배열은 hit 객체가 아니다)", () => {
    expect(() =>
      assertRealDataResultIssueSearchHitMatchesParseShape(
        ["number", "title", "body"] as unknown as RealDataResultIssueSearchHit,
        ["number", "title", "body"],
      ),
    ).toThrow(TypeError);
  });

  it("parseShapeKeys=null → TypeError", () => {
    expect(() =>
      assertRealDataResultIssueSearchHitMatchesParseShape(
        validHit,
        null as unknown as readonly string[],
      ),
    ).toThrow(TypeError);
  });

  it("parseShapeKeys=undefined → TypeError", () => {
    expect(() =>
      assertRealDataResultIssueSearchHitMatchesParseShape(
        validHit,
        undefined as unknown as readonly string[],
      ),
    ).toThrow(TypeError);
  });

  it("parseShapeKeys=비배열(string) → TypeError", () => {
    expect(() =>
      assertRealDataResultIssueSearchHitMatchesParseShape(
        validHit,
        "number,title,body" as unknown as readonly string[],
      ),
    ).toThrow(TypeError);
  });

  it("parseShapeKeys 원소가 비-string → TypeError", () => {
    expect(() =>
      assertRealDataResultIssueSearchHitMatchesParseShape(validHit, [
        "number",
        42 as unknown as string,
        "body",
      ]),
    ).toThrow(TypeError);
  });
});

describe("assertRealDataResultIssueSearchHitMatchesParseShape — 순수성·결정론·무공유", () => {
  it("동일 입력으로 두 번 호출해도 동일 동작(정상 케이스: 두 번 다 void)", () => {
    expect(() =>
      assertRealDataResultIssueSearchHitMatchesParseShape(
        validHit,
        REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS,
      ),
    ).not.toThrow();
    expect(() =>
      assertRealDataResultIssueSearchHitMatchesParseShape(
        validHit,
        REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS,
      ),
    ).not.toThrow();
  });

  it("입력 hit 을 mutate 하지 않는다 — 호출 후 own 키/값 보존", () => {
    const hit = { number: 42, title: "t", body: "b" };
    const before = { ...hit };
    const keysBefore = Object.keys(hit);
    assertRealDataResultIssueSearchHitMatchesParseShape(
      hit,
      REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS,
    );
    expect(hit).toEqual(before);
    expect(Object.keys(hit)).toEqual(keysBefore);
  });

  it("입력 parseShapeKeys 를 mutate 하지 않는다 — 호출 후 배열 원본 보존", () => {
    const shape = ["number", "title", "body"];
    const before = [...shape];
    assertRealDataResultIssueSearchHitMatchesParseShape(validHit, shape);
    expect(shape).toEqual(before);
  });
});
