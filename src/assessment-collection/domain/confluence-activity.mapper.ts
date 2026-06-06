// confluence-activity.mapper — raw `unknown`(단일 Confluence page list item) →
// `ConfluenceActivity` 변환 순수 함수(ADR-0029 Decision §2 mapper 경계, collection
// slice (i)). `ConfluenceSpaceTraversalService.traverseInstance` 가 반환하는
// `SpaceTraversalResult.pages`(= `unknown[]`)의 단일 항목을 받아 typed 식별 필드만
// 추출한다 — 부수효과 0 / 외부 의존 0(순수 함수). orchestrator(slice (iii))는 본 mapper
// 를 호출만 하고 raw shape 를 직접 parse 하지 않는다(SRP).
//
// REQ-032 raw-not-stored(data-model.md §4, ADR-0029 Decision §2): page 본문 HTML
// (`body.storage.value` 등)은 **추출하지 않는다**. page-id · author · timestamp ·
// version number · SPACE 참조 같은 typed 식별 필드만 뽑고, raw page body 는 매핑 직후
// 폐기된다(반환 객체에 본문 미포함).
//
// 방어성: traversal service 가 raw `unknown[]` 을 주므로 모든 필드 접근은 type-guard 를
// 거친다. 필수 식별 필드(externalId(page-id) / author / timestamp / version)가 누락/
// 형식 오류면 매핑 불가로 판단해 `null` 을 반환한다(throw 0 — 한 malformed page 가
// 전체 수집을 깨지 않도록). 호출처가 `null` 항목을 걸러 `ConfluenceActivity[]` 를 만든다.

import { ActivityMetadata, ConfluenceActivity } from "./activity";

// isRecord — 값이 non-null 의 plain 객체(배열 아님)인지 판정하는 순수 type-guard.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// readString — 객체 필드를 안전하게 string 으로 읽는다. 비-string / 빈(공백) 문자열은
// `undefined`(누락 취급).
function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

// resolveExternalId — Confluence page 의 식별자는 최상위 `id`. Confluence 응답은 id 를
// 문자열로 주지만(REST v1) number 로 오는 변형도 방어적으로 수용해 문자열로 정규화한다.
// 부재/형식 오류면 `undefined`(매핑 불가).
function resolveExternalId(raw: Record<string, unknown>): string | undefined {
  const id = readString(raw.id);
  if (id !== undefined) {
    return id;
  }
  // number id 변형 — finite 정수만 문자열화(방어적).
  if (typeof raw.id === "number" && Number.isFinite(raw.id)) {
    return String(raw.id);
  }
  return undefined;
}

// resolveVersion — page version number 는 `version.number`(정수). page-id + version
// dedup(latest-wins, ADR-0029 Decision §4)의 backbone. version 객체/number 부재 또는
// 비-finite 면 `undefined`(매핑 불가 — dedup 기준 없음).
function resolveVersion(raw: Record<string, unknown>): number | undefined {
  if (!isRecord(raw.version)) {
    return undefined;
  }
  const num = raw.version.number;
  if (typeof num === "number" && Number.isFinite(num)) {
    return num;
  }
  return undefined;
}

// resolveAuthor — 마지막 수정자 식별자를 추출한다. Confluence 는 `version.by.
// accountId`(Cloud) 또는 `version.by.username`(Server) 에 둔다. accountId 우선, 없으면
// username. 둘 다 부재면 `undefined`(매핑 불가).
function resolveAuthor(raw: Record<string, unknown>): string | undefined {
  if (!isRecord(raw.version) || !isRecord(raw.version.by)) {
    return undefined;
  }
  const by = raw.version.by;
  const accountId = readString(by.accountId);
  if (accountId !== undefined) {
    return accountId;
  }
  const username = readString(by.username);
  if (username !== undefined) {
    return username;
  }
  return undefined;
}

// resolveTimestamp — 활동 발생 시각은 `version.when`(마지막 수정 시각, ISO-8601).
// since/dedup 기준값. 부재/비-string 이면 `undefined`(매핑 불가).
function resolveTimestamp(raw: Record<string, unknown>): string | undefined {
  if (!isRecord(raw.version)) {
    return undefined;
  }
  return readString(raw.version.when);
}

// buildMetadata — raw 본문이 아닌 typed 보조 메타만 담는다(REQ-032). 현 slice 는 page
// title 길이(`titleLength`)만 추출한다 — title **문자열 자체가 아니라 길이(number)** 만
// 담아 raw quote 를 피한다. page 본문 HTML(`body.storage.value`)은 절대 담지 않는다.
function buildMetadata(raw: Record<string, unknown>): ActivityMetadata {
  const metadata: ActivityMetadata = {};
  const title = readString(raw.title);
  if (title !== undefined) {
    metadata.titleLength = title.length;
  }
  return metadata;
}

// mapConfluenceActivity — raw `unknown`(단일 Confluence page) → `ConfluenceActivity |
// null`. instanceKey / spaceRef 는 raw 가 아니라 호출처(orchestrator 의 instance×SPACE
// loop)가 주입한다 — page item 자체에 항상 SPACE context 가 들어있지 않기 때문(ADR-0029
// Decision §3 loop 가 그 context 를 보유). 매핑 불가(비-객체 raw / 필수 식별 필드 누락)
// 면 `null` 을 반환해 호출처가 skip 한다(throw 0).
export function mapConfluenceActivity(
  raw: unknown,
  instanceKey: string,
  spaceRef: string,
): ConfluenceActivity | null {
  // (1) 비-객체 raw(null / primitive / 배열) → 매핑 불가.
  if (!isRecord(raw)) {
    return null;
  }

  // (2) 필수 식별 필드 추출 — 하나라도 누락이면 매핑 불가(null).
  const externalId = resolveExternalId(raw);
  const version = resolveVersion(raw);
  const author = resolveAuthor(raw);
  const timestamp = resolveTimestamp(raw);
  if (
    externalId === undefined ||
    version === undefined ||
    author === undefined ||
    timestamp === undefined
  ) {
    return null;
  }

  // (3) typed 식별 필드 + 보조 메타만으로 ConfluenceActivity 조립 — page 본문 미포함.
  return {
    externalId,
    sourceType: "confluence",
    instanceKey,
    author,
    timestamp,
    spaceRef,
    version,
    metadata: buildMetadata(raw),
  };
}
