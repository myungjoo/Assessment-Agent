// activity-contribution.mapper — 수집된 typed `Activity` → `ContributionCreateInput`
// 변환 순수 함수(ADR-0029 Decision §6 Activity → Contribution 영속화 매핑, collection
// slice (v-a)). 부수효과 0 / 외부 의존 0 — NestJS `@Injectable` 미사용, Prisma /
// repository import 0. github-activity.mapper / confluence-activity.mapper(domain/)의
// 순수-함수 패턴을 mirror 한다. orchestrator(slice (v-b/v-c))가 본 함수를 호출만 하고
// 영속화는 별도 layer(ContributionService)가 담당한다(SRP).
//
// sourceType 매핑(ADR-0029 §6 정합 + 기존 VALID_SOURCE_TYPES 정합):
//   ADR-0029 §6 의 illustrative literal `"github:commit"` 은 기존
//   `ContributionService.VALID_SOURCE_TYPES`(commit / pr / document) validator 와
//   충돌하므로 채택하지 않는다. 본 매퍼는 ContributionService.create 가
//   BadRequestException 없이 통과하도록 기존 허용 집합 멤버로만 산출한다:
//     - GithubActivity.kind === "commit" → "commit"
//     - GithubActivity.kind === "pr"     → "pr"
//     - GithubActivity.kind === "issue"  → "pr"
//       (issue 는 기존 VALID_SOURCE_TYPES 에 별도 literal 부재 — PR 흐름의 변종으로
//        보아 "pr" 로 흡수. ADR-0029 §6 의 출처-구분 의도는 sourceUrl/sourceRef 가
//        보존한다.)
//     - ConfluenceActivity                → "document"
//   산출 sourceType 은 반드시 VALID_SOURCE_TYPES(commit / pr / document) 멤버다.
//
// REQ-032 raw-not-stored 보존: sourceRef / sourceUrl 은 외부 본문을 가리키는 참조
// 식별자(pointer)일 뿐이다. raw 본문(commit message 전문 / page HTML)을 입력으로 받지
// 않고(Activity 자체가 이미 raw 미보유, activity.ts 참조) 산출하지도 않는다.
//
// 평가 필드 placeholder(ADR-0029 §6 + §Consequences negative 1): difficulty /
// contributionScore / volume 은 수집 시점에는 미정이다. P5 평가 파이프라인이 채우기
// 전까지 placeholder 상수로 채운다 — difficulty 는 VALID_DIFFICULTIES 멤버인 "easy",
// contributionScore = 0, volume = 0. 이 값들은 transient 이며 평가 단계에서 갱신된다.

import type { ContributionCreateInput } from "../../user/contribution.repository";

import type { Activity, GithubActivity } from "./activity";

// 평가 필드 placeholder 상수(ADR-0029 §6 + §Consequences negative 1). 수집 시점에는
// 난이도/기여도/양을 산정할 수 없으므로, P5 평가가 채우기 전까지의 transient 기본값.
// PLACEHOLDER_DIFFICULTY 는 반드시 VALID_DIFFICULTIES("easy"/"medium"/"hard") 멤버여야
// ContributionService.create 의 assertValidDifficulty 를 통과한다.
export const PLACEHOLDER_DIFFICULTY = "easy";
export const PLACEHOLDER_CONTRIBUTION_SCORE = 0;
export const PLACEHOLDER_VOLUME = 0;

// resolveGithubSourceType — GithubActivity.kind 를 기존 VALID_SOURCE_TYPES 멤버로
// 정규화한다. commit → "commit", pr → "pr", issue → "pr"(별도 literal 부재로 흡수).
// 산출은 항상 "commit" 또는 "pr" — 둘 다 VALID_SOURCE_TYPES 멤버다.
function resolveGithubSourceType(activity: GithubActivity): "commit" | "pr" {
  return activity.kind === "commit" ? "commit" : "pr";
}

// buildGithubRef — GitHub 활동의 sourceRef / sourceUrl 을 참조 식별자만으로 합성한다
// (REQ-032 — raw 본문 0). sourceRef 는 externalId(commit SHA / PR·issue number),
// sourceUrl 은 repoRef + externalId 기반 참조 pointer 다.
function buildGithubRef(activity: GithubActivity): {
  sourceRef: string;
  sourceUrl: string;
} {
  return {
    sourceRef: activity.externalId,
    // repo 참조 + 식별자만으로 구성된 pointer(raw 본문 아님).
    sourceUrl: `${activity.repoRef}#${activity.externalId}`,
  };
}

// mapActivityToContribution — typed `Activity` 1 건을 `ContributionCreateInput` 으로
// 변환한다(순수 함수, throw 0). assessmentId 는 호출처(orchestrator)가 주입하며 본
// 매퍼는 검증 없이 pass-through 한다 — assessmentId 유효성(FK 존재 등)은 service-layer
// 책임이다(contribution.service.ts). sourceType / difficulty 는 반드시 기존 허용
// 집합(VALID_SOURCE_TYPES / VALID_DIFFICULTIES) 멤버로만 산출된다.
export function mapActivityToContribution(
  activity: Activity,
  assessmentId: string,
): ContributionCreateInput {
  // discriminator(sourceType)로 GitHub / Confluence 분기.
  if (activity.sourceType === "github") {
    const { sourceRef, sourceUrl } = buildGithubRef(activity);
    return {
      assessmentId,
      sourceType: resolveGithubSourceType(activity),
      sourceUrl,
      sourceRef,
      difficulty: PLACEHOLDER_DIFFICULTY,
      contributionScore: PLACEHOLDER_CONTRIBUTION_SCORE,
      volume: PLACEHOLDER_VOLUME,
    };
  }

  // ConfluenceActivity — sourceType 은 항상 "document". sourceRef 는 page-id 와
  // version 을 합성(`${externalId}@${version}`)해 page-id+version dedup(ADR-0029 §4
  // latest-wins)과 정합한 참조 식별자를 만든다. sourceUrl 은 SPACE 참조 + page-id
  // 기반 pointer(raw page HTML 아님).
  return {
    assessmentId,
    sourceType: "document",
    sourceUrl: `${activity.spaceRef}#${activity.externalId}`,
    sourceRef: `${activity.externalId}@${activity.version}`,
    difficulty: PLACEHOLDER_DIFFICULTY,
    contributionScore: PLACEHOLDER_CONTRIBUTION_SCORE,
    volume: PLACEHOLDER_VOLUME,
  };
}
