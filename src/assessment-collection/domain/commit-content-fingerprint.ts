// commit-content-fingerprint — rebase / meld 로 commit SHA 가 갈렸지만 "내용물" 은
// 같은 기여를 잡기 위한 **내용 지문 산출 순수 helper**(ADR-0063 § Decision 1·2·4,
// README `21 행` R-21 축 (ii)). 부수효과 0 / I/O 0 / 외부 의존은 Node 내장 `crypto`
// 뿐이라 **새 외부 dependency 0** 이다(export-dump-checksum.ts `22 행` 선례 동형).
//
// 본 파일은 정규화 규칙만 책임진다 — raw shape parse 는 소비처인 github-activity.
// mapper 가 하고(§ Decision 1 "mapper 는 helper 를 호출만 한다"), dedup 키 합성
// (`content:<author>:<digest>`)은 § Follow-ups (b) slice 의 책임이다. 반환값은 비가역
// sha256 hex digest 라 원문 복원이 불가능하므로 raw quote 가 아니라 `titleLength` 와
// 같은 계열의 파생 typed 보조값이다(REQ-032, § Decision 3).
import { createHash } from "crypto";

// CONTENT_FINGERPRINT_MIN_LENGTH — 정규화 후 문자열의 최소 길이 하한(ADR-0063
// § Decision 4). "fix typo"(8) · "Merge branch 'main'"(19) 같은 상투구가 서로 다른
// 기여를 접는 것을 막는 안전장치이며, 의도적으로 미탐(중복이 남음) 쪽으로 편향시킨
// 선택이다 — 오탐 1 건은 평가 입력에서 기여 1 건이 사라지는 비대칭 비용이기 때문.
export const CONTENT_FINGERPRINT_MIN_LENGTH = 20;

// 제거 대상 trailer prefix(대소문자 무시, 행 단위) — rebase / cherry-pick / gerrit
// meld 가 **삽입하거나 지우는** metadata 행들이다(ADR-0063 § Decision 2 규칙 2).
// `Co-authored-by:` 는 기여자 구성이라 내용의 일부이므로 **여기에 넣지 않는다**.
const TRAILER_PREFIXES = [
  "signed-off-by:",
  "change-id:",
  "reviewed-on:",
] as const;

// cherry-pick 삽입 행 — `(cherry picked from commit <sha>)` 전체 매칭(대소문자 무시).
const CHERRY_PICK_LINE = /^\(cherry picked from commit\s+[0-9a-f]+\)$/i;

// isTrailerLine — 한 행이 제거 대상 trailer 인지 판정한다. 앞뒤 공백을 걷어낸 뒤
// 판정하므로 들여쓰기된 trailer 도 잡힌다. 빈 행은 trailer 가 아니다(규칙 3 이 처리).
function isTrailerLine(line: string): boolean {
  const probe = line.trim();
  if (probe.length === 0) {
    return false;
  }
  const lowered = probe.toLowerCase();
  if (TRAILER_PREFIXES.some((prefix) => lowered.startsWith(prefix))) {
    return true;
  }
  return CHERRY_PICK_LINE.test(probe);
}

// normalizeCommitMessage — ADR-0063 § Decision 2 의 5 규칙을 **표에 적힌 순서 그대로**
// 적용한다. (1) 개행 통일 → (2) trailer 행 제거 → (3) 행 내 연속 공백·연속 빈 행 축약
// → (4) 전체·행 단위 trim → (5) 대소문자 보존(lowercase 하지 않음 — 오탐만 늘리고
// 재현율 이득이 없다). 공개 표면은 digest 함수 1 개뿐이라 export 하지 않는다.
function normalizeCommitMessage(message: string): string {
  // (1) `\r\n` · `\r` → `\n`.
  const unifiedNewlines = message.replace(/\r\n?/g, "\n");
  // (2) trailer 행 제거(행 단위 · 대소문자 무시).
  const withoutTrailers = unifiedNewlines
    .split("\n")
    .filter((line) => !isTrailerLine(line));
  // (3)+(4) 행 내 연속 공백(space · tab) → 단일 space, 행 앞뒤 공백 제거.
  const collapsedLines = withoutTrailers.map((line) =>
    line.replace(/[ \t]+/g, " ").trim(),
  );
  // (3) 연속 빈 행 → 단일 `\n`, (4) 문자열 전체 trim.
  return collapsedLines
    .join("\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

// computeCommitContentFingerprint — commit message 를 정규화한 뒤 sha256 hex digest
// **64 자 전량**(절단 0 — 절단은 충돌 확률만 올리고 얻는 것이 문자 수뿐)을 돌려준다.
// 산출하지 않는 경우는 둘 — (a) 비-string 입력(mapper 가 raw `unknown` 을 주므로
// 방어적으로 흡수하며 **throw 하지 않는다**), (b) 정규화 결과가 비었거나 하한 미만.
// 둘 다 `undefined` 이며 소비처는 그때 키 자체를 담지 않는다(§ Decision 4).
export function computeCommitContentFingerprint(
  message: unknown,
): string | undefined {
  if (typeof message !== "string") {
    return undefined;
  }
  const normalized = normalizeCommitMessage(message);
  if (normalized.length < CONTENT_FINGERPRINT_MIN_LENGTH) {
    return undefined;
  }
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}
