// github-activity.mapper — raw `unknown`(단일 GitHub commit/PR/issue list item) →
// `GithubActivity` 변환 순수 함수(ADR-0029 Decision §2 mapper 경계, collection slice
// (i)). `GithubInstanceClient.requestAllPagesForInstance` / `GithubAdapter.
// requestAllPages` 가 반환하는 `unknown[]` 의 단일 항목을 받아 typed 식별 필드만
// 추출한다 — 부수효과 0 / 외부 의존 0(순수 함수). orchestrator(slice (ii))는 본 mapper
// 를 호출만 하고 raw shape 를 직접 parse 하지 않는다(SRP).
//
// REQ-032 raw-not-stored(data-model.md §4, ADR-0029 Decision §2): commit message 전문 /
// diff / patch 같은 raw 본문은 **추출하지 않는다**. SHA · author login · timestamp ·
// repo 참조 같은 typed 식별 필드만 뽑고, raw 객체는 매핑 직후 폐기된다(반환 객체에 raw
// body 미포함).
//
// 방어성: adapter 가 raw `unknown[]` 을 주므로 모든 필드 접근은 type-guard 를 거친다.
// 필수 식별 필드(externalId / author / timestamp)가 누락/형식 오류면 매핑 불가로
// 판단해 `null` 을 반환한다(throw 0 — 한 malformed item 이 전체 수집 loop 를 깨지
// 않도록, skip 책임은 호출처). 호출처는 `null` 항목을 걸러 `GithubActivity[]` 를 만든다.

import {
  ActivityMetadata,
  GithubActivity,
  GithubActivityKind,
} from "./activity";

// isRecord — 값이 non-null 의 plain 객체(배열 아님)인지 판정하는 순수 type-guard.
// `typeof null === "object"` 비대칭 + 배열 제외를 한 곳에서 처리해 이후 필드 접근을
// 안전하게 한다.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// readString — 객체에서 string 필드를 안전하게 읽는다. 값이 비-string 이거나 빈(공백)
// 문자열이면 `undefined`(누락 취급). 필수 식별 필드의 존재/타입 검사를 단일 분기로 모음.
function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

// resolveExternalId — GitHub 의 commit / PR / issue 는 식별자 위치가 다르다. commit 은
// 최상위 `sha`, PR/issue list item 은 `number`(정수)다. 둘 중 하나를 우선순위(sha →
// number)로 골라 문자열 externalId 로 정규화한다. 둘 다 부재면 `undefined`(매핑 불가).
function resolveExternalId(raw: Record<string, unknown>): string | undefined {
  // commit: 최상위 sha.
  const sha = readString(raw.sha);
  if (sha !== undefined) {
    return sha;
  }
  // PR / issue: number(정수). NaN / 비-finite 는 제외(방어적).
  const num = raw.number;
  if (typeof num === "number" && Number.isFinite(num)) {
    return String(num);
  }
  return undefined;
}

// resolveKind — 활동 종류를 raw shape 로 판정한다. (a) `sha` 가 있으면 commit,
// (b) `pull_request` 키가 있거나 명시 kind 가 "pr" 이면 pr, (c) 그 외 number 가 있으면
// issue 로 본다. 판정 불가(어느 분기에도 안 걸림)면 `undefined`(매핑 불가).
function resolveKind(
  raw: Record<string, unknown>,
): GithubActivityKind | undefined {
  // (a) commit — 최상위 sha 존재.
  if (readString(raw.sha) !== undefined) {
    return "commit";
  }
  // (b) PR — GitHub issue/PR 공용 list 에서 PR 은 `pull_request` 하위 객체를 가진다.
  if (isRecord(raw.pull_request)) {
    return "pr";
  }
  // (c) issue — number 만 있고 pull_request 부재.
  if (typeof raw.number === "number" && Number.isFinite(raw.number)) {
    return "issue";
  }
  return undefined;
}

// resolveAuthor — author login 을 추출한다. commit 은 `author.login`(또는 commit.
// author.name fallback 없이 login 우선), PR/issue 는 `user.login`. 둘 다 부재면
// `undefined`(매핑 불가 — 활동 주체 식별 불능).
function resolveAuthor(raw: Record<string, unknown>): string | undefined {
  // commit: 최상위 author 객체의 login(REST commit list 의 author 는 GitHub user).
  if (isRecord(raw.author)) {
    const login = readString(raw.author.login);
    if (login !== undefined) {
      return login;
    }
  }
  // PR / issue: user.login.
  if (isRecord(raw.user)) {
    const login = readString(raw.user.login);
    if (login !== undefined) {
      return login;
    }
  }
  return undefined;
}

// resolveTimestamp — 활동 발생 시각을 추출한다. commit 은 `commit.author.date`,
// PR/issue 는 최상위 `created_at`. 둘 다 부재/비-string 이면 `undefined`(매핑 불가 —
// since/dedup 기준값 없음).
function resolveTimestamp(raw: Record<string, unknown>): string | undefined {
  // commit: commit.author.date(중첩 commit 객체 안의 author.date).
  if (isRecord(raw.commit) && isRecord(raw.commit.author)) {
    const date = readString(raw.commit.author.date);
    if (date !== undefined) {
      return date;
    }
  }
  // PR / issue: created_at.
  const createdAt = readString(raw.created_at);
  if (createdAt !== undefined) {
    return createdAt;
  }
  return undefined;
}

// buildMetadata — raw 본문이 아닌 typed 보조 메타만 골라 담는다(REQ-032). 현 slice 는
// PR/issue 의 title 길이(`titleLength`)만 메타로 추출한다 — title **문자열 자체가 아니라
// 길이(number)** 만 담아 raw quote 를 피한다. title 부재/비-string 이면 메타 미포함.
// commit message 전문 · diff · body 는 절대 담지 않는다.
function buildMetadata(raw: Record<string, unknown>): ActivityMetadata {
  const metadata: ActivityMetadata = {};
  const title = readString(raw.title);
  if (title !== undefined) {
    // raw title 문자열을 싣지 않고 길이만 — 평가 입력 후보 메타(raw quote 0).
    metadata.titleLength = title.length;
  }
  return metadata;
}

// mapGithubActivity — raw `unknown`(단일 GitHub item) → `GithubActivity | null`.
// instanceKey / repoRef 는 raw 가 아니라 호출처(orchestrator 의 instance×repo loop)가
// 주입한다 — raw item 자체에는 수집 context(어느 instance/repo 에서 왔는지)가 항상
// 들어있지 않기 때문(ADR-0029 Decision §3 loop 가 그 context 를 보유). 매핑 불가
// (비-객체 raw / 필수 식별 필드 누락)면 `null` 을 반환해 호출처가 skip 한다(throw 0).
export function mapGithubActivity(
  raw: unknown,
  instanceKey: string,
  repoRef: string,
): GithubActivity | null {
  // (1) 비-객체 raw(null / primitive / 배열) → 매핑 불가.
  if (!isRecord(raw)) {
    return null;
  }

  // (2) 필수 식별 필드 추출 — 하나라도 누락이면 매핑 불가(null).
  const externalId = resolveExternalId(raw);
  const kind = resolveKind(raw);
  const author = resolveAuthor(raw);
  const timestamp = resolveTimestamp(raw);
  if (
    externalId === undefined ||
    kind === undefined ||
    author === undefined ||
    timestamp === undefined
  ) {
    return null;
  }

  // (3) typed 식별 필드 + 보조 메타만으로 GithubActivity 조립 — raw 본문 미포함.
  return {
    externalId,
    sourceType: "github",
    instanceKey,
    author,
    timestamp,
    repoRef,
    kind,
    metadata: buildMetadata(raw),
  };
}
