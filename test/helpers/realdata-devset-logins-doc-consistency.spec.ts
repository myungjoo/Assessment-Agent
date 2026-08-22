// realdata-devset-logins-doc-consistency.spec.ts — T-1649 colocated unit spec.
//
// R-112 cover 구조: happy-path(실제 정본 문서 ↔ 실제 fixture 일치 = 본 drift guard 실효 자체,
// a 33 · b 100 · 합집합 133 · 교집합 0, 파일 로더 동일 결과) / error path(markdown 비-문자열
// null · 숫자 · 객체, `## A.` 부재, `## B.` 부재, 표가 비어 login 0 개) / 분기(§A 만 drift ·
// §B 만 drift · 양쪽 정상 3 분기, 셀 padding 유무 trim) / negative 충분 cover(문서 전용 login ·
// fixture 전용 login · 순서만 다름 · 대소문자만 다름 · 값 1 개 다름 · §B 뒤 코드블록 오인 파싱).
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseDevsetLogins } from "./realdata-devset-logins";
import {
  assertDevsetLoginsFixtureMatchesDoc,
  loadRealdataDevsetLoginsDoc,
  parseDevsetLoginsDoc,
} from "./realdata-devset-logins-doc-consistency";

const REAL_DOC = readFileSync(
  join(__dirname, "..", "..", "docs", "ops", "realdata-scale-devset.md"),
  "utf8",
);
const REAL_FIXTURE_RAW: unknown = JSON.parse(
  readFileSync(
    join(__dirname, "..", "load", "realdata-devset-logins.json"),
    "utf8",
  ),
);

// fixture 원본을 매번 새 객체로 복제해 test 간 간섭을 막는다.
function fixtureCopy(): { a: string[]; b: string[] } {
  const parsed = parseDevsetLogins(REAL_FIXTURE_RAW);
  return { a: [...parsed.a], b: [...parsed.b] };
}

// 구조만 갖춘 최소 문서를 합성한다(§B 뒤 코드블록까지 실제 문서 구조 mirror).
function synthDoc(aRows: string[], bRows: string[]): string {
  return [
    "# 제목",
    "",
    "## A. 그룹",
    "| github login | 수 |",
    "|---|---:|",
    ...aRows,
    "",
    "## B. 그룹",
    "| github login | 수 |",
    "|---|---:|",
    ...bRows,
    "",
    "## 재생성(refresh) 명령",
    "```bash",
    "gh search prs --owner Samsung | sort -u",
    "| grep -viE 'bot$'",
    "```",
  ].join("\n");
}

describe("parseDevsetLoginsDoc / loadRealdataDevsetLoginsDoc — happy path", () => {
  it("실제 정본 문서에서 a 33 · b 100 · 합집합 133 · 교집합 0 을 읽는다", () => {
    const doc = parseDevsetLoginsDoc(REAL_DOC);
    expect(doc.a).toHaveLength(33);
    expect(doc.b).toHaveLength(100);
    expect(new Set([...doc.a, ...doc.b]).size).toBe(133);
    expect(doc.a.filter((login) => doc.b.includes(login))).toEqual([]);
  });
  it("파일 로더가 문자열 파싱과 같은 결과를 돌려주고 배열 참조는 분리된다", () => {
    const fromFile = loadRealdataDevsetLoginsDoc();
    expect(fromFile).toEqual(parseDevsetLoginsDoc(REAL_DOC));
    expect(fromFile.a).not.toBe(loadRealdataDevsetLoginsDoc().a);
  });
  it("실제 문서 ↔ 실제 fixture 가 정확히 일치해 throw 하지 않는다", () => {
    expect(() =>
      assertDevsetLoginsFixtureMatchesDoc(REAL_DOC, REAL_FIXTURE_RAW),
    ).not.toThrow();
  });
  it("§B 표 첫 열의 공백 padding 이 trim 되어 fixture 값과 같아진다", () => {
    expect(parseDevsetLoginsDoc(REAL_DOC).b[0]).toBe("mhs4670go");
  });
});

describe("parseDevsetLoginsDoc — error path", () => {
  it.each([
    ["null", null],
    ["숫자", 42],
    ["객체", { a: [] }],
  ])("markdown 이 문자열이 아니면(%s) TypeError", (_label, input) => {
    const call = () => parseDevsetLoginsDoc(input as unknown as string);
    expect(call).toThrow(TypeError);
    expect(call).toThrow(/markdown 이 문자열이 아니다/);
  });
  it("'## A.' 소제목이 없으면 TypeError", () => {
    const doc = synthDoc(["| foo | 1 |"], ["| bar | 1 |"]).replace(
      "## A. 그룹",
      "## 다른 소제목",
    );
    expect(() => parseDevsetLoginsDoc(doc)).toThrow(/'## A\.' 소제목/);
  });
  it("'## B.' 소제목이 없으면 TypeError", () => {
    const doc = synthDoc(["| foo | 1 |"], ["| bar | 1 |"]).replace(
      "## B. 그룹",
      "## 또 다른 소제목",
    );
    expect(() => parseDevsetLoginsDoc(doc)).toThrow(/'## B\.' 소제목/);
  });
  it("표가 비어 login 이 0 개면 TypeError", () => {
    expect(() => parseDevsetLoginsDoc(synthDoc([], ["| bar | 1 |"]))).toThrow(
      /login 을 하나도 읽지 못했다/,
    );
  });
});

describe("parseDevsetLoginsDoc — 분기 cover", () => {
  it("셀 padding 이 있는 행과 없는 행이 같은 값으로 trim 된다", () => {
    const doc = parseDevsetLoginsDoc(
      synthDoc(["| foo    | 4 |", "|bar| 3 |"], ["|   baz   | 2 |"]),
    );
    expect(doc.a).toEqual(["foo", "bar"]);
    expect(doc.b).toEqual(["baz"]);
  });
  it("§B 뒤 '## 재생성' 절의 코드블록 라인을 표로 오인 파싱하지 않는다", () => {
    const md = synthDoc(["| foo | 1 |"], ["| bar | 1 |"]);
    expect(parseDevsetLoginsDoc(md).b).toEqual(["bar"]);
  });
});

describe("assertDevsetLoginsFixtureMatchesDoc — 3 분기 + negative cases", () => {
  // 위반 시 throw 를 기대하는 호출을 한 줄로 감싼다.
  const check = (markdown: string, fixtureRaw: unknown) =>
    expect(() => assertDevsetLoginsFixtureMatchesDoc(markdown, fixtureRaw));
  it("양쪽 모두 정상이면 void 로 통과한다", () => {
    expect(
      assertDevsetLoginsFixtureMatchesDoc(REAL_DOC, fixtureCopy()),
    ).toBeUndefined();
  });
  it("§A 만 drift(문서에만 있는 login 1 행 추가) 면 그룹 a index 로 RangeError", () => {
    const doc = REAL_DOC.replace(
      "| jijoongmoon | 0 | 117 | 117 |",
      "| jijoongmoon | 0 | 117 | 117 |\n| newcomer-dev | 0 | 1 | 1 |",
    );
    check(doc, fixtureCopy()).toThrow(RangeError);
    check(doc, fixtureCopy()).toThrow(/그룹 'a' index 1 불일치/);
  });
  it("§B 만 drift(문서 값 1 개만 다름) 면 그룹 b index 로 RangeError", () => {
    const doc = REAL_DOC.replace(
      "| hseok-oh                 | 249 |",
      "| hseok-oh-renamed         | 249 |",
    );
    check(doc, fixtureCopy()).toThrow(
      /그룹 'b' index 1 불일치 — 문서 'hseok-oh-renamed'/,
    );
  });
  it("fixture 에만 있는 login(문서 표 1 행 삭제) 이면 '(없음)' 을 담아 RangeError", () => {
    const doc = REAL_DOC.replace("| DonghakPark | 0 | 1 | 1 |\n", "");
    check(doc, fixtureCopy()).toThrow(
      /그룹 'a' index 32 불일치 — 문서 '\(없음\)'/,
    );
  });
  it("같은 집합이지만 순서만 다르면 RangeError", () => {
    const fixture = fixtureCopy();
    [fixture.a[0], fixture.a[1]] = [fixture.a[1], fixture.a[0]];
    check(REAL_DOC, fixture).toThrow(/그룹 'a' index 0 불일치/);
  });
  it("대소문자만 다르면 불일치로 판정한다", () => {
    const fixture = fixtureCopy();
    fixture.a[2] = fixture.a[2].toUpperCase();
    check(REAL_DOC, fixture).toThrow(/그룹 'a' index 2 불일치/);
  });
  it("개수는 같은데 fixture 값 1 개가 다르면 그룹 b 로 RangeError", () => {
    const fixture = fixtureCopy();
    fixture.b[5] = "unexpected-login";
    check(REAL_DOC, fixture).toThrow(
      /그룹 'b' index 5 불일치 — 문서 .* vs fixture 'unexpected-login'/,
    );
  });
  it("fixture 구조가 깨졌으면 T-1648 로더의 Error 가 그대로 전파된다", () => {
    check(REAL_DOC, null).toThrow(/최상위가 객체가 아니다/);
  });
});
