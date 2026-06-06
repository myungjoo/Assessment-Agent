// author-filter — 수집된 Activity[] 중 한 Person 에 귀속되는 활동만 남기는 부수효과 0
// 순수 함수 모듈 (ADR-0030 §2/§3 author 귀속, collection slice iii-a). DI/DB/네트워크 0
// (github-repo-source.ts / commit-dedup.ts 의 도메인 순수 함수 패턴 mirror).
//
// 귀속 규칙(ADR-0030 §2 "다중 identity 는 instance 별 externalId 로 독립 매칭"): 한 활동은
//   ∃ identity. normalizeKey(identity.service) === normalizeKey(activity.instanceKey)
//                && identity.externalId === activity.author
// 일 때만 그 Person 에 귀속된다. 즉 활동의 instance(instanceKey)와 동일 instance 의
// ServiceIdentity(service)의 externalId 가 활동 author 와 일치해야 한다.
//   - instanceKey ↔ service 매칭은 수집 파이프라인 전체가 쓰는 동일 key namespace
//     (resolveGithubInstances/resolveConfluenceInstances 의 key, T-0258 github-repo-
//     source 의 service↔key 매칭)에 기반한다 — AC 가 허용한 "instanceKey 대조" 규칙.
//   - source-type-aware: GitHub instance key 와 Confluence instance key 는 분리된
//     namespace(GITHUB_INSTANCES vs CONFLUENCE_INSTANCES)이므로 GitHub 활동은 GitHub
//     계열 identity 와만, Confluence 활동은 Confluence 계열 identity 와만 매칭된다 —
//     cross-source 동명(Confluence accountId == GitHub login) false-match 방지(ADR §3).
//   - isPrimary 는 매칭에 무관(ADR-0030 §2) — 본 함수는 isPrimary 를 읽지 않는다.
//   - 다중 identity(여러 instance / GitHub+Confluence 혼합)는 각 (service, externalId)
//     쌍이 그 instance 활동을 독립적으로 귀속한다.
//
// 가정/한계(Follow-up): GitHub instance key 와 Confluence instance key 가 서로 겹치지
// 않는다고 가정한다(운영상 분리 namespace). 두 source 가 동일 key 를 쓰게 되면
// ServiceIdentity 에 sourceType 명시를 추가해 disambiguate 해야 한다(후속 slice).
//
// 책임 경계: collectForPerson 진입·영속화 결선은 slice iii-b. 본 함수는 Activity[] →
// 귀속 Activity[] 변환까지만(입력 미변형, 순서 보존). since / API-side author 필터는 무관.

import type { ServiceIdentity } from "@prisma/client";

import { Activity } from "./activity";

// normalizeKey — instance key / service 매칭용 정규화(trim + 대문자). github-repo-
// source.ts 의 normalizeKey 와 동형(github-instance-config dedupe 정규화 정합).
function normalizeKey(value: string): string {
  return value.trim().toUpperCase();
}

// filterActivitiesByAuthor — activities 중 serviceIdentities 로 귀속되는 활동만 남긴 새
// 배열을 반환한다(입력 순서 보존, 부수효과 0, 입력 배열 미변형). 매칭 규칙은 파일 head
// 주석 참조: (service, externalId) 쌍이 활동의 (instanceKey, author)와 일치하면 보존.
export function filterActivitiesByAuthor(
  activities: Activity[],
  serviceIdentities: Pick<ServiceIdentity, "service" | "externalId">[],
): Activity[] {
  // (instance 정규화 key) → 그 instance 의 귀속 externalId 집합. 같은 instance 에 여러
  // identity 가 있으면 set 으로 합집합. 빈 serviceIdentities 면 빈 map → 귀속 0.
  const externalIdsByInstance = new Map<string, Set<string>>();
  for (const identity of serviceIdentities) {
    const key = normalizeKey(identity.service);
    let set = externalIdsByInstance.get(key);
    if (set === undefined) {
      set = new Set<string>();
      externalIdsByInstance.set(key, set);
    }
    set.add(identity.externalId);
  }

  // 활동의 instance 에 해당하는 externalId 집합에 author 가 있으면 귀속(보존).
  return activities.filter((activity) => {
    const set = externalIdsByInstance.get(normalizeKey(activity.instanceKey));
    return set !== undefined && set.has(activity.author);
  });
}
