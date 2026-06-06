// commit-dedup — `GithubActivity[]` → dedup 된 `GithubActivity[]` 순수 함수
// (ADR-0029 Decision §4, collection slice (ii)). 부수효과 0 / 외부 의존 0.
//
// REQ-009(Fork/Rebase/Meld 시간적 중복 제거, earlier date 우선) + REQ-031(재수집
// 중복 방지)을 application-layer pre-persistence dedup 으로 보존한다. DB unique
// constraint 와는 별개의 in-memory 연산이다(ADR-0029 Decision §4).
//
// 정책:
//   - commit(`kind === "commit"`): `externalId`(=commit SHA) 기준 중복 제거. 같은 SHA
//     가 여러 repo/instance 에서 수집되면 **earliest `timestamp` 1 개만 유지**(시간적
//     중복 시 earlier date 우선). 동일 timestamp tie 면 **먼저 등장한 항목 유지**(입력
//     순서 보존 — 안정적·결정적 tie-break).
//   - pr / issue: SHA 가 아닌 `(kind, repoRef, externalId)` 합성 키로 중복 제거(같은
//     repo 의 동일 PR/issue 번호가 재수집으로 중복될 때 1 개만). commit 과 달리
//     earliest-wins 시간 의미는 commit SHA 의 Fork/Rebase/Meld 에 한정되므로(ADR §4 가
//     commit dedup 만 명시), pr/issue 는 첫 등장 1 개를 유지하는 단순 dedup 으로 둔다.
//     근거: pr/issue 번호는 repo 내 단조 증가 식별자라 동일 (repo, number)는 동일
//     활동이며 timestamp 가 갈릴 이유가 없다(재수집 시 동일값). 그래도 방어적으로 commit
//     과 같은 earliest-wins tie-break 를 적용해 비결정성을 제거한다.

import { GithubActivity } from "./activity";

// isEarlier — a 의 timestamp 가 b 보다 더 이른지(엄격히 작은지) 판정한다. ISO-8601
// 문자열은 사전식 비교가 시간 순서와 일치하지만(동일 timezone Z 가정), 방어적으로
// Date.parse 수치 비교를 우선하고 파싱 불가(NaN) 시 문자열 비교로 fallback 한다.
function isEarlier(a: string, b: string): boolean {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isNaN(ta) || Number.isNaN(tb)) {
    // 비-파싱 timestamp 는 사전식 문자열 비교로 결정적 순서를 유지한다.
    return a < b;
  }
  return ta < tb;
}

// dedupKey — 활동의 dedup 식별 키를 만든다. commit 은 SHA(=externalId)만으로 cross-
// repo/instance 중복을 잡아야 하므로(Fork/Rebase/Meld) `commit:<sha>` 단일 키. pr/issue
// 는 repo 경계 안의 번호이므로 `<kind>:<repoRef>:<externalId>` 합성 키로 repo 간 동일
// 번호 충돌을 피한다.
function dedupKey(activity: GithubActivity): string {
  if (activity.kind === "commit") {
    return `commit:${activity.externalId}`;
  }
  return `${activity.kind}:${activity.repoRef}:${activity.externalId}`;
}

// dedupGithubActivities — 중복 활동을 제거한 새 배열을 반환한다(입력 배열 비변형).
// 같은 dedup 키의 활동이 여럿이면 earliest `timestamp` 1 개만 유지하고, timestamp 가
// 동일하면 먼저 등장한 항목을 유지한다(입력 순서 보존). 반환 순서는 각 키의 *유지된*
// 항목이 최초 등장한 위치 기준으로 안정적이다.
export function dedupGithubActivities(
  activities: GithubActivity[],
): GithubActivity[] {
  // key → 유지 중인 활동. earlier timestamp 가 등장하면 교체한다.
  const winners = new Map<string, GithubActivity>();
  // key → 최초 등장 순번(반환 순서 안정화용).
  const firstSeenOrder = new Map<string, number>();

  activities.forEach((activity, index) => {
    const key = dedupKey(activity);
    const current = winners.get(key);

    if (current === undefined) {
      // 첫 등장 — 그대로 채택하고 등장 순번을 기록한다.
      winners.set(key, activity);
      firstSeenOrder.set(key, index);
      return;
    }

    // 이미 같은 키가 있으면 earlier timestamp 가 승리한다(earliest-wins). 동일/이후
    // timestamp 면 기존 항목(먼저 등장)을 유지한다(tie-break = 입력 순서 보존).
    if (isEarlier(activity.timestamp, current.timestamp)) {
      winners.set(key, activity);
      // firstSeenOrder 는 유지(반환 위치는 최초 등장 키 기준 안정).
    }
  });

  // 최초 등장 순서대로 유지 항목을 직렬화한다 — 결정적 반환 순서.
  return [...winners.keys()]
    .sort((a, b) => (firstSeenOrder.get(a) ?? 0) - (firstSeenOrder.get(b) ?? 0))
    .map((key) => winners.get(key) as GithubActivity);
}
