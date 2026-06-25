// realdata-e2e-result-issue-search-json-fields.spec.ts — T-0657 신설 순수 가드의
// 모든 분기(정합·누락·잉여·구조 결손·의미 위반)와 negative cases 충분 cover 박제.
//
// 본 spec 의 진실의 원천:
//   - 가드 함수 `assertRealDataResultIssueSearchJsonFieldsMatchParseShape` —
//     `./realdata-e2e-result-issue-search-json-fields`
//   - 본 가드가 박제한 정규 키 목록 상수 `REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS`
//     — 동일 모듈
//   - 실제 argv 빌더가 합성하는 요청 필드 상수 `REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS`
//     — `./realdata-e2e-result-issue-search-argv`(import 만, 빌더 함수 호출 안 함)
//
// 본 spec 의 첫 번째 happy-path 는 위 두 production 상수가 현재 정합임을 회귀 봉인한다.
// 두 상수가 미래에 한쪽이 drift 하면(예: argv 가 `body` 요청 빠뜨림 / parser 가
// `labels` 필드 추가) 이 spec 이 즉시 fail 한다.

import { REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS } from "./realdata-e2e-result-issue-search-argv";
import {
  REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS,
  assertRealDataResultIssueSearchJsonFieldsMatchParseShape,
} from "./realdata-e2e-result-issue-search-json-fields";

describe("REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS", () => {
  it("정규 키 목록은 ['number','title','body'] — RealDataResultIssueSearchHit 멤버와 동일", () => {
    expect(REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS).toEqual([
      "number",
      "title",
      "body",
    ]);
  });

  it("readonly tuple 로 박제됨 — 매직 배열 대신 named constant 단일 source", () => {
    // 정규 키 목록은 3개 — number/title/body 만(RealDataResultIssueSearchHit 멤버).
    expect(REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS.length).toBe(3);
    // 모든 원소가 string 인지 확인(매직 배열 끼어들기 차단).
    for (const key of REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS) {
      expect(typeof key).toBe("string");
    }
  });
});

describe("assertRealDataResultIssueSearchJsonFieldsMatchParseShape — happy path (production 상수 정합 회귀 봉인)", () => {
  it("실제 argv 상수(REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS) ↔ 실제 shape 상수 → throw 없이 통과", () => {
    // 본 단언은 두 production 상수가 미래에 drift 하면 즉시 fail 하도록 회귀 봉인한다.
    expect(() =>
      assertRealDataResultIssueSearchJsonFieldsMatchParseShape(
        REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS,
        REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS,
      ),
    ).not.toThrow();
  });

  it("정합 케이스 직접 입력 — 'number,title,body' / ['number','title','body'] → 통과", () => {
    expect(() =>
      assertRealDataResultIssueSearchJsonFieldsMatchParseShape(
        "number,title,body",
        ["number", "title", "body"],
      ),
    ).not.toThrow();
  });
});

describe("assertRealDataResultIssueSearchJsonFieldsMatchParseShape — 누락(J4) 분기", () => {
  it("requestedFields='number,title' (body 누락) → body 누락 명시한 RangeError", () => {
    expect(() =>
      assertRealDataResultIssueSearchJsonFieldsMatchParseShape("number,title", [
        "number",
        "title",
        "body",
      ]),
    ).toThrow(/J4|누락/);
    expect(() =>
      assertRealDataResultIssueSearchJsonFieldsMatchParseShape("number,title", [
        "number",
        "title",
        "body",
      ]),
    ).toThrow(/'body'/);
  });

  it("requestedFields='number' (title,body 누락) → 두 필드 모두 누락 메시지에 포함", () => {
    let err: unknown;
    try {
      assertRealDataResultIssueSearchJsonFieldsMatchParseShape("number", [
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

describe("assertRealDataResultIssueSearchJsonFieldsMatchParseShape — 잉여(J5) 분기", () => {
  it("requestedFields='number,title,body,labels' (잉여 labels) → labels 잉여 명시한 RangeError", () => {
    expect(() =>
      assertRealDataResultIssueSearchJsonFieldsMatchParseShape(
        "number,title,body,labels",
        ["number", "title", "body"],
      ),
    ).toThrow(/J5|잉여/);
    expect(() =>
      assertRealDataResultIssueSearchJsonFieldsMatchParseShape(
        "number,title,body,labels",
        ["number", "title", "body"],
      ),
    ).toThrow(/'labels'/);
  });
});

describe("assertRealDataResultIssueSearchJsonFieldsMatchParseShape — 동일 개수 필드명 mismatch 분기", () => {
  it("requestedFields='number,title,summary' (body↔summary 교체) → 누락(body)이 먼저 fail-fast", () => {
    // J4 (누락) 검사가 J5 (잉여) 보다 먼저 — 누락 검출만 검증(잉여는 별도 케이스).
    expect(() =>
      assertRealDataResultIssueSearchJsonFieldsMatchParseShape(
        "number,title,summary",
        ["number", "title", "body"],
      ),
    ).toThrow(/'body'/);
  });
});

describe("assertRealDataResultIssueSearchJsonFieldsMatchParseShape — 순서 무관·집합 비교(J3 정규화)", () => {
  it("requestedFields='body,number,title' (순서만 다른 동일 집합) → 통과", () => {
    expect(() =>
      assertRealDataResultIssueSearchJsonFieldsMatchParseShape(
        "body,number,title",
        ["number", "title", "body"],
      ),
    ).not.toThrow();
  });

  it("parseShapeKeys 순서도 무관 — ['body','title','number'] 도 정합 통과", () => {
    expect(() =>
      assertRealDataResultIssueSearchJsonFieldsMatchParseShape(
        "number,title,body",
        ["body", "title", "number"],
      ),
    ).not.toThrow();
  });
});

describe("assertRealDataResultIssueSearchJsonFieldsMatchParseShape — 콤마 주변 공백 trim", () => {
  it("requestedFields='number, title , body' → trim 후 정합 통과", () => {
    expect(() =>
      assertRealDataResultIssueSearchJsonFieldsMatchParseShape(
        "number, title , body",
        ["number", "title", "body"],
      ),
    ).not.toThrow();
  });

  it("선행/후행 공백 포함 — '  number,title,body  ' → trim 후 정합 통과", () => {
    expect(() =>
      assertRealDataResultIssueSearchJsonFieldsMatchParseShape(
        "  number,title,body  ",
        ["number", "title", "body"],
      ),
    ).not.toThrow();
  });
});

describe("assertRealDataResultIssueSearchJsonFieldsMatchParseShape — 빈 토큰 거부(J3)", () => {
  it("requestedFields='number,,title' (가운데 빈 토큰) → 빈 필드 토큰 RangeError", () => {
    expect(() =>
      assertRealDataResultIssueSearchJsonFieldsMatchParseShape(
        "number,,title",
        ["number", "title", "body"],
      ),
    ).toThrow(RangeError);
    expect(() =>
      assertRealDataResultIssueSearchJsonFieldsMatchParseShape(
        "number,,title",
        ["number", "title", "body"],
      ),
    ).toThrow(/빈|공백/);
  });

  it("requestedFields='number, ,title' (가운데 공백-only 토큰) → 빈 필드 토큰 RangeError", () => {
    expect(() =>
      assertRealDataResultIssueSearchJsonFieldsMatchParseShape(
        "number, ,title",
        ["number", "title", "body"],
      ),
    ).toThrow(RangeError);
  });

  it("requestedFields=',number,title,body' (선행 빈 토큰) → 빈 필드 토큰 RangeError", () => {
    expect(() =>
      assertRealDataResultIssueSearchJsonFieldsMatchParseShape(
        ",number,title,body",
        ["number", "title", "body"],
      ),
    ).toThrow(RangeError);
  });
});

describe("assertRealDataResultIssueSearchJsonFieldsMatchParseShape — 중복 토큰 거부(J3)", () => {
  it("requestedFields='number,number,title,body' (중복 number) → 중복 명시한 RangeError", () => {
    expect(() =>
      assertRealDataResultIssueSearchJsonFieldsMatchParseShape(
        "number,number,title,body",
        ["number", "title", "body"],
      ),
    ).toThrow(/중복/);
    expect(() =>
      assertRealDataResultIssueSearchJsonFieldsMatchParseShape(
        "number,number,title,body",
        ["number", "title", "body"],
      ),
    ).toThrow(/'number'/);
  });

  it("trim 후 중복(' number,number  ,title,body') → 중복 RangeError", () => {
    expect(() =>
      assertRealDataResultIssueSearchJsonFieldsMatchParseShape(
        " number,number  ,title,body",
        ["number", "title", "body"],
      ),
    ).toThrow(/중복/);
  });
});

describe("assertRealDataResultIssueSearchJsonFieldsMatchParseShape — 빈 requestedFields 거부(J2)", () => {
  it("requestedFields='' (빈 문자열) → RangeError(전체 누락)", () => {
    expect(() =>
      assertRealDataResultIssueSearchJsonFieldsMatchParseShape("", [
        "number",
        "title",
        "body",
      ]),
    ).toThrow(RangeError);
    expect(() =>
      assertRealDataResultIssueSearchJsonFieldsMatchParseShape("", [
        "number",
        "title",
        "body",
      ]),
    ).toThrow(/빈|공백|누락/);
  });

  it("requestedFields='   ' (공백-only) → RangeError(전체 누락)", () => {
    expect(() =>
      assertRealDataResultIssueSearchJsonFieldsMatchParseShape("   ", [
        "number",
        "title",
        "body",
      ]),
    ).toThrow(RangeError);
  });
});

describe("assertRealDataResultIssueSearchJsonFieldsMatchParseShape — 빈 parseShapeKeys 거부(J1)", () => {
  it("parseShapeKeys=[] (빈 배열) → RangeError(추출 shape 부재)", () => {
    expect(() =>
      assertRealDataResultIssueSearchJsonFieldsMatchParseShape(
        "number,title,body",
        [],
      ),
    ).toThrow(RangeError);
    expect(() =>
      assertRealDataResultIssueSearchJsonFieldsMatchParseShape(
        "number,title,body",
        [],
      ),
    ).toThrow(/빈|부재|shape/);
  });
});

describe("assertRealDataResultIssueSearchJsonFieldsMatchParseShape — 구조 결손(J0) → TypeError", () => {
  it("requestedFields=null → TypeError", () => {
    expect(() =>
      assertRealDataResultIssueSearchJsonFieldsMatchParseShape(
        null as unknown as string,
        ["number", "title", "body"],
      ),
    ).toThrow(TypeError);
  });

  it("requestedFields=undefined → TypeError", () => {
    expect(() =>
      assertRealDataResultIssueSearchJsonFieldsMatchParseShape(
        undefined as unknown as string,
        ["number", "title", "body"],
      ),
    ).toThrow(TypeError);
  });

  it("requestedFields=number → TypeError", () => {
    expect(() =>
      assertRealDataResultIssueSearchJsonFieldsMatchParseShape(
        123 as unknown as string,
        ["number", "title", "body"],
      ),
    ).toThrow(TypeError);
  });

  it("parseShapeKeys=null → TypeError", () => {
    expect(() =>
      assertRealDataResultIssueSearchJsonFieldsMatchParseShape(
        "number,title,body",
        null as unknown as readonly string[],
      ),
    ).toThrow(TypeError);
  });

  it("parseShapeKeys=undefined → TypeError", () => {
    expect(() =>
      assertRealDataResultIssueSearchJsonFieldsMatchParseShape(
        "number,title,body",
        undefined as unknown as readonly string[],
      ),
    ).toThrow(TypeError);
  });

  it("parseShapeKeys=비배열 → TypeError", () => {
    expect(() =>
      assertRealDataResultIssueSearchJsonFieldsMatchParseShape(
        "number,title,body",
        "number,title,body" as unknown as readonly string[],
      ),
    ).toThrow(TypeError);
  });

  it("parseShapeKeys 원소가 비-string → TypeError", () => {
    expect(() =>
      assertRealDataResultIssueSearchJsonFieldsMatchParseShape(
        "number,title,body",
        ["number", 42 as unknown as string, "body"],
      ),
    ).toThrow(TypeError);
  });
});

describe("assertRealDataResultIssueSearchJsonFieldsMatchParseShape — 순수성·결정론·무공유", () => {
  it("동일 입력으로 두 번 호출해도 동일 동작(정상 케이스: 두 번 다 void)", () => {
    const requested = "number,title,body";
    const shape: readonly string[] = ["number", "title", "body"];
    expect(() =>
      assertRealDataResultIssueSearchJsonFieldsMatchParseShape(
        requested,
        shape,
      ),
    ).not.toThrow();
    expect(() =>
      assertRealDataResultIssueSearchJsonFieldsMatchParseShape(
        requested,
        shape,
      ),
    ).not.toThrow();
  });

  it("입력 parseShapeKeys 를 mutate 하지 않는다 — 호출 후 배열 원본 보존", () => {
    const shape = ["number", "title", "body"];
    const before = [...shape];
    assertRealDataResultIssueSearchJsonFieldsMatchParseShape(
      "number,title,body",
      shape,
    );
    expect(shape).toEqual(before);
  });

  it("requestedFields 가 가진 인젝션 토큰(예: ';rm -rf') 도 단순 set-equal 비교 — 동일 집합이면 통과", () => {
    expect(() =>
      assertRealDataResultIssueSearchJsonFieldsMatchParseShape(
        "weird;rm -rf,number",
        ["weird;rm -rf", "number"],
      ),
    ).not.toThrow();
  });
});
