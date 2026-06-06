// page-dedup — `ConfluenceActivity[]` → dedup 된 `ConfluenceActivity[]` 순수 함수
// (ADR-0029 Decision §4, collection slice (iii)). 부수효과 0 / 외부 의존 0.
//
// REQ-010(구조적/시간적 중복 제거) + REQ-031(재수집 중복 방지)을 application-layer
// pre-persistence dedup 으로 보존한다. Confluence 는 한 page-id 의 여러 version 이
// 수집될 수 있으므로(편집 이력 / 재수집), 같은 page-id 의 여러 version 중 **latest
// version 1개만** 유지한다(ADR §4 latest-wins). DB unique constraint 와는 별개의
// in-memory 연산이다(GitHub 측 commit-dedup.ts 의 earliest-wins 와 대칭 — Confluence
// page 는 최신 version 이 가장 정확한 활동 상태라 latest 를 유지).
//
// 정책:
//   - `externalId`(=page-id) 기준 그룹핑. 같은 page-id 가 여러 version 으로 수집되면
//     **최대 `version` number 1개만 유지**(latest-version-wins). 서로 다른 page-id 는
//     모두 보존된다.
//   - 동일 page-id + 동일 version tie-break: **먼저 등장한 항목 유지**(입력 순서 보존
//     — 안정적·결정적 tie-break). version 이 같으면 같은 page snapshot 이므로 어느
//     쪽을 골라도 동등하지만, 비결정성을 제거하기 위해 첫 등장분을 채택한다.
//   - instanceKey / spaceRef 는 dedup 키에 포함하지 않는다 — page-id 는 한 Confluence
//     instance 안에서 전역 고유 식별자이므로(ADR-0013 §2 (page, version) 정합), 같은
//     page-id 면 같은 page 로 본다. (단일 Person 의 단일 instance 수집 맥락 — cross-
//     instance page-id 충돌은 본 slice 범위 밖이며, 발생 시 latest version 으로 수렴.)

import { ConfluenceActivity } from "./activity";

// dedupConfluenceActivities — 중복 활동을 제거한 새 배열을 반환한다(입력 배열 비변형).
// 같은 page-id(externalId)의 활동이 여럿이면 latest `version` 1개만 유지하고, version 이
// 동일하면 먼저 등장한 항목을 유지한다(입력 순서 보존). 반환 순서는 각 page-id 의
// *유지된* 항목이 최초 등장한 위치 기준으로 안정적이다.
export function dedupConfluenceActivities(
  activities: ConfluenceActivity[],
): ConfluenceActivity[] {
  // page-id → { 유지 중인 활동, 최초 등장 순번 }. 더 높은 version 이 등장하면 활동만
  // 교체하고 order(반환 순서 안정화용 최초 등장 위치)는 유지한다. order 를 winner 와
  // 한 Map 에 묶어 둠으로써 정렬 시 별도 fallback(`?? 0`) 분기 없이 항상 정의된 값을
  // 읽는다(unreachable 방어 분기 제거 — branch coverage 정합).
  const winners = new Map<
    string,
    { activity: ConfluenceActivity; order: number }
  >();

  activities.forEach((activity, index) => {
    const key = activity.externalId;
    const current = winners.get(key);

    if (current === undefined) {
      // 첫 등장 — 그대로 채택하고 등장 순번을 기록한다.
      winners.set(key, { activity, order: index });
      return;
    }

    // 이미 같은 page-id 가 있으면 higher version 이 승리한다(latest-wins). 동일/낮은
    // version 이면 기존 항목(먼저 등장)을 유지한다(tie-break = 입력 순서 보존). order 는
    // 최초 등장 위치 그대로 유지한다(반환 위치 안정).
    if (activity.version > current.activity.version) {
      winners.set(key, { activity, order: current.order });
    }
  });

  // 최초 등장 순서대로 유지 항목을 직렬화한다 — 결정적 반환 순서.
  return [...winners.values()]
    .sort((a, b) => a.order - b.order)
    .map((entry) => entry.activity);
}
