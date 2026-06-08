// evaluation-input.mapper — 수집된 typed `Activity` → `EvaluationInput` 정규화
// 순수 함수(ADR-0032 Decision §1, evaluation slice 첫 impl). 부수효과 0 / 외부
// 의존 0 — NestJS `@Injectable` 미사용, Prisma / repository / LLM gateway import 0.
// [src/assessment-collection/domain/activity-contribution.mapper.ts](../../assessment-collection/domain/activity-contribution.mapper.ts)
// 의 순수-함수 패턴을 mirror 한다. 평가 layer 의 후속 slice(scoring service /
// dedup, Follow-ups §2·§3)가 본 함수의 출력 위에서 동작한다.
//
// contributionKind 매핑(ADR-0032 §1 박제 — L82/R-30 계약):
//   - GithubActivity.kind === "commit" → "code"
//   - GithubActivity.kind === "pr"     → "code"
//   - GithubActivity.kind === "issue"  → "document"
//     (R-30 — GitHub Issue 를 문서 기여로 평가. 출처(GitHub)와 category(document)
//      가 어긋나는 케이스를 본 정규화가 박제. ADR-0032 Alternatives A 미채택.)
//   - ConfluenceActivity                → "document"
//
// unitId 합성(ADR-0032 §1 — 평가-side dedup key 와 정합):
//   `<sourceType>:<instanceKey>:<externalId>` 형식. 수집-side dedup(commit SHA
//   earliest-wins / page-id+version latest-wins)이 외부 식별자 단독 키로 동작하는
//   것과 별도로, 평가-side 는 instance namespace 분리(GitHub 3 instance) +
//   sourceType 구분까지 키에 포함해 cross-instance / cross-source 충돌을 차단한다.
//
// REQ-032 raw-not-stored 보존: `Activity` 가 이미 raw 본문 필드를 schema 차원에서
// 보유하지 않으므로(activity.ts 참조) 본 매퍼는 `Activity` 의 typed surface 만
// 전사한다. raw 본문 입력 / 출력 0.

import type {
  Activity,
  GithubActivity,
} from "../../assessment-collection/domain/activity";

import type { ContributionKind, EvaluationInput } from "./evaluation-input";

// resolveGithubContributionKind — GithubActivity.kind 를 ContributionKind 로
// 정규화한다. commit/pr → "code", issue → "document"(R-30 — Issue 는 문서 기여).
function resolveGithubContributionKind(
  activity: GithubActivity,
): ContributionKind {
  return activity.kind === "issue" ? "document" : "code";
}

// buildUnitId — 평가 단위 고유 식별자 합성(ADR-0032 §1). `<sourceType>:<instance
// Key>:<externalId>` 형식. 모든 필드는 `Activity` 의 string 필수 필드 — 입력
// invariant 차원에서 빈 문자열 시나리오는 발생하지 않는다(activity.ts ActivityBase
// 참조). 본 매퍼는 검증 없이 합성만 수행 — 입력 invariant 보장은 호출처(수집
// orchestrator) 책임.
function buildUnitId(activity: Activity): string {
  return `${activity.sourceType}:${activity.instanceKey}:${activity.externalId}`;
}

// mapActivityToEvaluationInput — typed `Activity` 1 건을 `EvaluationInput` 으로
// 변환한다(순수 함수, throw 0, 부수효과 0). discriminator(sourceType)로 GitHub /
// Confluence 분기 후 contributionKind 정규화 + unitId 합성 + typed 필드 전사만
// 수행한다. metadata 는 reference 그대로 전달 — 본 매퍼는 deep copy 0(호출처가
// 필요 시 freeze / clone).
export function mapActivityToEvaluationInput(
  activity: Activity,
): EvaluationInput {
  // discriminator(sourceType) 분기 — GitHub 변형은 kind 별 contributionKind 분기
  // 필요, Confluence 는 항상 "document".
  const contributionKind: ContributionKind =
    activity.sourceType === "github"
      ? resolveGithubContributionKind(activity)
      : "document";

  return {
    unitId: buildUnitId(activity),
    contributionKind,
    sourceType: activity.sourceType,
    instanceKey: activity.instanceKey,
    author: activity.author,
    timestamp: activity.timestamp,
    // metadata 는 Activity 에서 그대로 전달(REQ-032 — scalar only 정책 그대로
    // 승계, 새 raw 필드 0).
    metadata: activity.metadata,
  };
}
