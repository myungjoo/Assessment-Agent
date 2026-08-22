// realdata-devset-logins-doc-consistency.ts — R-91 실데이터 규모 검증 dataset(133 명)의
// **이중 정본 drift 차단 가드** (T-1649 박제).
//
// 책임: T-1648 이 정본 문서 `docs/ops/realdata-scale-devset.md` 의 §A(33 명) · §B(100 명)
//   markdown 표를 fixture `test/load/realdata-devset-logins.json` 으로 옮겨 담으면서 같은
//   데이터의 정본이 둘이 됐다. 한쪽만 갱신되면 부하 테스트가 조용히 옛 집합을 쓴다. 본 가드는
//   사람이 읽는 markdown 표를 파싱해 fixture 와 **길이 · 원소 · 순서**가 정확히 일치하는지
//   확인한다. fixture 쪽 해석은 T-1648 로더(`parseDevsetLogins`)에 위임한다 — 재구현 0.
//
// 에러 정책(`*-consistency` 가드 계열 관례): 구조 결손 = TypeError / 값 정합 위반 = RangeError,
// 한국어 메시지, fail-fast(가장 먼저 위반한 지점에서 throw), silent 통과 0.
// 🔥 결정론·무공유: 입력 외 상태(시각·난수·전역 env) 의존 0, 매 호출 새 배열 반환.
// 🔥 외부 의존 0 — Node 내장 `node:fs` · `node:path` 와 기존 helper import 만 사용.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseDevsetLogins } from "./realdata-devset-logins";

// 정본 markdown 문서 경로(본 helper 기준 상대 해석)와 두 그룹 표를 여는 소제목 접두.
const DOC_SEGMENTS = ["..", "..", "docs", "ops", "realdata-scale-devset.md"];
const DOC_PATH = join(__dirname, ...DOC_SEGMENTS);
const SECTION_A_PREFIX = "## A.";
const SECTION_B_PREFIX = "## B.";

type DevsetLoginsDoc = { a: string[]; b: string[] };

// `|---|` 같은 markdown 표 구분자 행인지 판정한다(정렬 표기 `:--:` 포함).
function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-{1,}:?$/.test(cell));
}

// `| a | b |` 한 줄을 trim 된 셀 배열로 쪼갠다(양끝 파이프가 만드는 빈 셀 제거).
function splitRow(line: string): string[] {
  const cells = line.split("|").map((cell) => cell.trim());
  if (cells.length > 0 && cells[0] === "") cells.shift();
  if (cells.length > 0 && cells[cells.length - 1] === "") cells.pop();
  return cells;
}

// 소제목 뒤 ~ 다음 `## ` 소제목 앞까지를 잘라 그 안 표의 첫 열(github login)만 뽑는다.
function extractSectionFirstColumn(
  lines: string[],
  prefix: string,
  group: string,
): string[] {
  const start = lines.findIndex((line) => line.startsWith(prefix));
  if (start < 0) {
    throw new TypeError(
      `realdata devset doc: '${prefix}' 소제목을 찾지 못했다 (그룹 ${group})`,
    );
  }
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("## "));
  const rows = (end < 0 ? rest : rest.slice(0, end))
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"))
    .map(splitRow);
  const logins: string[] = [];
  rows.forEach((cells, index) => {
    // 구분자 행과, 그 바로 앞의 헤더 행은 데이터가 아니다.
    const next = rows[index + 1];
    if (isSeparatorRow(cells) || (next !== undefined && isSeparatorRow(next))) {
      return;
    }
    if (cells.length > 0 && cells[0] !== "") logins.push(cells[0]);
  });
  if (logins.length === 0) {
    throw new TypeError(
      `realdata devset doc: '${prefix}' 표에서 login 을 하나도 읽지 못했다 (그룹 ${group})`,
    );
  }
  return logins;
}

// 정본 markdown 본문에서 §A · §B 표의 github login 첫 열만 추출한다.
export function parseDevsetLoginsDoc(markdown: string): DevsetLoginsDoc {
  if (typeof markdown !== "string") {
    throw new TypeError(
      `realdata devset doc: markdown 이 문자열이 아니다 (${String(markdown)})`,
    );
  }
  const lines = markdown.split(/\r?\n/);
  return {
    a: extractSectionFirstColumn(lines, SECTION_A_PREFIX, "a"),
    b: extractSectionFirstColumn(lines, SECTION_B_PREFIX, "b"),
  };
}

// 정본 markdown 파일을 읽어 위 파서에 통과시킨 결과를 반환한다.
export function loadRealdataDevsetLoginsDoc(): DevsetLoginsDoc {
  return parseDevsetLoginsDoc(readFileSync(DOC_PATH, "utf8"));
}

// 한 그룹의 문서 측 · fixture 측 login 목록이 길이 · 원소 · 순서까지 같은지 확인한다.
function assertGroupMatches(
  group: "a" | "b",
  fromDoc: string[],
  fromFixture: string[],
): void {
  const max = Math.max(fromDoc.length, fromFixture.length);
  for (let index = 0; index < max; index += 1) {
    const docValue = fromDoc[index] ?? "(없음)";
    const fixtureValue = fromFixture[index] ?? "(없음)";
    if (docValue !== fixtureValue) {
      throw new RangeError(
        `realdata devset drift: 그룹 '${group}' index ${index} 불일치 — 문서 '${docValue}' vs fixture '${fixtureValue}' (문서 ${fromDoc.length} 개 / fixture ${fromFixture.length} 개)`,
      );
    }
  }
}

// 정본 markdown 표와 fixture 가 정확히 같은 집합·순서인지 검증한다(위반 시 RangeError).
export function assertDevsetLoginsFixtureMatchesDoc(
  markdown: string,
  fixtureRaw: unknown,
): void {
  const fromDoc = parseDevsetLoginsDoc(markdown);
  const fromFixture = parseDevsetLogins(fixtureRaw);
  assertGroupMatches("a", fromDoc.a, fromFixture.a);
  assertGroupMatches("b", fromDoc.b, fromFixture.b);
}
