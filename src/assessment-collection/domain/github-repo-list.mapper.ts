// github-repo-list.mapper — raw `unknown`(GitHub `orgs/{org}/repos` list item) → repo
// 이름(string) 추출 순수 함수 (ADR-0030 §1 mode A enumerate, collection slice ii-b1).
// `GithubInstanceClient.requestAllPagesForInstance("orgs/{org}/repos")` 가 반환하는
// `unknown[]` 의 단일 항목에서 repo 이름만 안전 추출한다 — 부수효과 0 / 외부 의존 0.
//
// 방어성: adapter 가 raw `unknown[]` 을 주므로 모든 필드 접근은 type-guard 를 거친다.
// repo 이름(`name`, fallback `full_name` 의 마지막 segment)이 누락/형식 오류면 매핑
// 불가로 판단해 `null` 을 반환한다(throw 0 — 한 malformed item 이 enumerate loop 를
// 깨지 않도록, skip 책임은 호출처). github-activity.mapper 의 null-skip 규약 mirror.

// isRecord — 값이 non-null 의 plain 객체(배열 아님)인지 판정하는 순수 type-guard.
// `typeof null === "object"` 비대칭 + 배열 제외를 한 곳에서 처리한다.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// readString — 객체에서 string 필드를 안전하게 읽는다. 비-string / 빈(공백) 문자열은
// `undefined`(누락 취급). github-activity.mapper 의 readString 와 동형.
function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

// mapRepoName — raw `unknown`(단일 repo list item) → repo 이름(string) | null.
// `name`(repo 단순 이름) 우선, 부재 시 `full_name`("org/repo")의 마지막 `/` segment 를
// fallback 으로 사용한다. 둘 다 부재/형식오류면 `null`(매핑 불가 → 호출처 skip, throw 0).
export function mapRepoName(raw: unknown): string | null {
  // (1) 비-객체 raw(null / primitive / 배열) → 매핑 불가.
  if (!isRecord(raw)) {
    return null;
  }
  // (2) name 우선 — GitHub repo list item 의 단순 repo 이름.
  const name = readString(raw.name);
  if (name !== undefined) {
    return name;
  }
  // (3) full_name fallback — "org/repo" 형식의 마지막 segment 를 repo 이름으로.
  const fullName = readString(raw.full_name);
  if (fullName !== undefined) {
    const repo = readString(fullName.split("/").pop());
    if (repo !== undefined) {
      return repo;
    }
  }
  return null;
}
