// EvaluationInput 도메인 타입 — P5 평가(scoring) 파이프라인의 공통 입력 단위
// (ADR-0032 Decision §1, evaluation slice 첫 impl). 수집 산출물 `Activity`
// (GithubActivity(commit/pr/issue) | ConfluenceActivity)를 평가 layer 가 단일
// shape 로 정규화한 결과 타입이다. 본 파일은 의존성 0 의 순수 타입 정의만 둔다 —
// NestJS `@Injectable` / Prisma / LLM gateway import 0. 후속 scoring service slice
// (Follow-ups §2)와 dedup slice(§3)가 본 타입 위에서 동작한다.
//
// REQ-032 raw-not-stored 불변(data-model.md §4): 본 타입은 commit message 전문 /
// diff / page 본문 HTML / issue body 같은 raw 본문을 **필드로 보유하지 않는다**.
// 외부 식별자(`unitId` = sourceType:instanceKey:externalId 합성) + author /
// timestamp / typed `metadata`(scalar only — Activity 와 동일 정책)만 담는다.
// 평가 prompt 조립(ADR-0032 §2)도 본 typed surface 위에서만 이루어지므로 raw 본문
// 누출이 구조적으로 불가능하다(`Activity` schema-level 부재 → `EvaluationInput`
// schema-level 부재).
//
// 정규화 축(ADR-0032 §1):
//   - `Activity` 의 discriminator(sourceType=github/confluence + kind=
//     commit/pr/issue)는 **수집 출처** 축이다.
//   - 본 타입의 `contributionKind`(code/document)는 **기여 category** 축이다.
//   - 두 축을 분리해, 평가 routing 이 출처 분기로 오염되는 것을 차단한다.
//
// [src/assessment-collection/domain/activity.ts](../../assessment-collection/domain/activity.ts)
// 의 `DIFFICULTIES`/`ACTIVITY_SOURCE_TYPES` 패턴 mirror — union + const 배열 +
// `satisfies` compile-time 동기성 강제 + type-guard 순수 함수.

import type {
  ActivityMetadata,
  ActivitySourceType,
} from "../../assessment-collection/domain/activity";

// ContributionKind — 평가 category discriminator(ADR-0032 §1).
// `"code"` : GitHub commit / PR(코드 기여).
// `"document"` : GitHub issue + Confluence page(문서 기여 — L82/R-30 계약 박제).
export type ContributionKind = "code" | "document";

// CONTRIBUTION_KINDS — ContributionKind union 의 전 멤버를 배열로 노출하는 single
// source. mapper / scoring service 가 contributionKind 값 멤버십을 런타임 검증할
// 때 기준이 된다. `satisfies` 로 union 과 배열의 동기성(멤버 누락 / 오타)을
// compile-time 강제한다(`activity.ts` ACTIVITY_SOURCE_TYPES 패턴 mirror).
export const CONTRIBUTION_KINDS = [
  "code",
  "document",
] as const satisfies readonly ContributionKind[];

// isContributionKind — 임의 string 이 허용 contributionKind 집합의 멤버인지
// 판정하는 순수 type-guard(`isActivitySourceType` 패턴 mirror). 외부 / 저장 값의
// 유효성을 좁힐 때 사용한다.
export function isContributionKind(value: string): value is ContributionKind {
  return (CONTRIBUTION_KINDS as readonly string[]).includes(value);
}

// EvaluationInput — 평가 단위 1 건의 정규화된 입력(ADR-0032 §1).
// 필드 7 종 모두 typed surface 위에 정의되며 raw 본문 키 부재가 type-level 로 보장
// 된다(REQ-032). 후속 scoring service 가 본 shape 의 typed 필드만으로 prompt 를
// 조립한다(§2).
export interface EvaluationInput {
  // 평가 단위 고유 식별자. `<sourceType>:<instanceKey>:<externalId>` 합성 —
  // 평가-side dedup key(§3)와 정합. 수집-side dedup(commit SHA / page-id+version)
  // 와는 별도 layer.
  unitId: string;
  // 기여 category(code/document). 평가 routing 의 1 차 분기 축.
  contributionKind: ContributionKind;
  // 수집 출처(github/confluence). `Activity` 에서 그대로 전사 — 출처 보존.
  sourceType: ActivitySourceType;
  // 활동이 속한 instance key(GitHub: com/sec/ecode, Confluence: instance key).
  instanceKey: string;
  // 활동 주체의 외부 service ID. 귀속 / self-follow-up 검출(§4) backbone.
  author: string;
  // 활동 발생 시각(ISO-8601). 시간적 dedup(R-21) / 평가 기간 경계 판정 기준값.
  timestamp: string;
  // typed 보조 메타(scalar only — REQ-032). 평가 입력의 정량 신호(title 길이 등)
  // source. Activity.metadata 를 그대로 전달한다 — 본 타입은 raw 본문을 새로
  // 도입하지 않는다.
  metadata: ActivityMetadata;
}
