// Activity 도메인 모델 — Assessment collection orchestrator 의 typed 활동 단위
// (ADR-0029 Decision §2, collection slice (i)). raw `unknown`(GitHub commit/PR/
// issue 1 건, Confluence page 1 건)을 mapper layer 가 변환해 산출하는 typed 표현으로,
// 후속 수집 service(slice (ii)/(iii))가 본 타입을 다루고 dedup/since 연산(slice (iv)~
// (vi))이 이 위에서 동작한다. 본 파일은 의존성 0 의 순수 타입 정의만 둔다(@Injectable·
// import 0).
//
// REQ-032 raw-not-stored 불변(data-model.md §4): 본 타입은 commit message 전문 /
// diff / page 본문 HTML 같은 raw 본문을 **필드로 보유하지 않는다**. 외부 식별자(SHA /
// page-id 등) · author · timestamp 같은 typed 참조 필드와, raw 본문이 아닌 typed 보조
// 메타(`metadata`)만 담는다. 영속화 시 `Contribution` 의 참조 식별 필드(sourceRef /
// sourceUrl)로만 흘러가며(ADR-0029 Decision §6), raw 본문 컬럼은 schema 차원에 부재.

// sourceType — Activity 의 출처를 구분하는 discriminator. `Activity` 를 두 변형
// (`GithubActivity` / `ConfluenceActivity`)으로 가르는 discriminated union 의 tag 다.
export type ActivitySourceType = "github" | "confluence";

// ACTIVITY_SOURCE_TYPES — ActivitySourceType union 의 전 멤버를 배열로 노출하는
// single source(llm/difficulty.ts 의 DIFFICULTIES 패턴 mirror). mapper / orchestrator
// 가 sourceType 값 멤버십을 런타임 검증할 때 기준이 된다. `satisfies` 로 union 과 배열의
// 동기성(멤버 누락 / 오타)을 compile-time 강제한다.
export const ACTIVITY_SOURCE_TYPES = [
  "github",
  "confluence",
] as const satisfies readonly ActivitySourceType[];

// isActivitySourceType — 임의 string 이 허용 sourceType 집합의 멤버인지 판정하는 순수
// type-guard. orchestrator 가 외부/저장 값의 sourceType 유효성을 좁힐 때 사용한다.
export function isActivitySourceType(
  value: string,
): value is ActivitySourceType {
  return (ACTIVITY_SOURCE_TYPES as readonly string[]).includes(value);
}

// GithubActivity 의 활동 종류 — commit / PR / issue 중 하나(ADR-0029 Decision §2).
export type GithubActivityKind = "commit" | "pr" | "issue";

// ActivityMetadata — raw 본문이 아닌 typed 보조 메타값(평가 입력 후보). 예: PR title
// 길이 · 변경 파일 수 등 수치/짧은 식별 정보만 담는다. raw quote(commit message 전문 /
// page 본문 HTML 등) 금지 — REQ-032. value 는 평가 파이프라인이 다룰 수 있는 원시
// scalar(string | number | boolean | null)로 한정해 raw 객체 그래프 유입을 막는다.
export type ActivityMetadataValue = string | number | boolean | null;
export type ActivityMetadata = Record<string, ActivityMetadataValue>;

// Activity(base) — 두 출처 공통 필드. discriminated union 의 공통 멤버이며, 구체
// 변형은 `sourceType` tag 로 좁혀진다.
export interface ActivityBase {
  // source 고유 식별자 — GitHub 은 commit SHA / PR·issue number 문자열, Confluence 는
  // page-id. dedup(ADR-0029 Decision §4)과 재수집 dedup key(REQ-031)의 backbone.
  externalId: string;
  // 출처 구분 discriminator.
  sourceType: ActivitySourceType;
  // 활동이 속한 instance key(GitHub: com / sec / ecode, Confluence: instance key).
  instanceKey: string;
  // 활동 주체의 외부 service ID(예: GitHub login, Confluence accountId/username).
  author: string;
  // 활동 발생 시각(ISO-8601 문자열). since 도출(slice (vi)) · 시간적 dedup(earliest-
  // wins, ADR-0029 Decision §4)의 기준값.
  timestamp: string;
  // typed 보조 메타(raw 본문 아님). 없으면 빈 객체.
  metadata: ActivityMetadata;
}

// GithubActivity — GitHub 출처 변형. base + repo 참조 + 활동 종류.
export interface GithubActivity extends ActivityBase {
  sourceType: "github";
  // org/repo 참조(예: "octo-org/octo-repo"). raw 본문 아님 — 참조 식별자.
  repoRef: string;
  // commit / pr / issue.
  kind: GithubActivityKind;
}

// ConfluenceActivity — Confluence 출처 변형. base + SPACE 참조 + page version.
export interface ConfluenceActivity extends ActivityBase {
  sourceType: "confluence";
  // SPACE key 참조(예: "ENG").
  spaceRef: string;
  // page version number — page-id + version dedup(latest-wins, ADR-0029 Decision §4).
  version: number;
}

// Activity — 두 변형의 discriminated union. `sourceType` 로 좁혀 사용한다.
export type Activity = GithubActivity | ConfluenceActivity;
