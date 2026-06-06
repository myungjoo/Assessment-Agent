// ConfluenceCollectionService — `ConfluenceSpaceTraversalService` 위에서 한 Person 의
// Confluence instance 를 enumerate 하며 SPACE 문서 활동을 수집하는 service(ADR-0029
// Decision §3 Confluence loop + §4 page dedup, collection slice (iii)). 이제껏
// production caller 0 였던 `ConfluenceSpaceTraversalService.traverseInstance` 의 첫
// production caller 다. T-0249 GitHub 측(github-collection.service.ts) 구조를 mirror 한다.
//
// 흐름: collectConfluenceActivities(spec)
//   (1) spec.instances 의 각 instance(ConfluenceInstanceConfig + key)를 enumerate.
//   (2) instance 마다 `traverseInstance(config)` 호출 → `SpaceTraversalResult[]` 획득
//       (SPACE allowlist 순회 + SPACE 단위 4xx skip+emit 은 traversal service 내부
//       책임 — 본 service 는 새 emit 경로를 만들지 않는다).
//   (3) 각 SpaceTraversalResult 의 raw `pages: unknown[]` 항목마다
//       `mapConfluenceActivity(raw, instanceKey, spaceKey)` 호출 → null(malformed)
//       skip → `ConfluenceActivity[]` 누적. SPACE 식별은 `SpaceTraversalResult.
//       spaceKey` 를 spaceRef 로 주입한다(mapper 추출이 아니라 loop context 가 보유 —
//       page item 에 SPACE context 가 항상 들어있지 않으므로, mapper 시그니처가 이미
//       instanceKey/spaceRef 를 주입받는 설계 정합).
//   (4) 전 instance 누적 후 `dedupConfluenceActivities` 로 (page-id, version) latest-
//       wins dedup(ADR-0029 Decision §4) → 반환.
//
// per-source skip-and-continue(ADR-0029 Decision §3): 각 instance 의 traverseInstance
// 호출을 **독립 try/catch** 로 감싼다. 한 instance 의 throw(token 복호 실패 등
// traversal service 가 전파하는 instance 레벨 오류)가 다른 instance 수집을 막지 않도록
// skip 하고 계속한다(부분 가용성 우선). SPACE 단위 4xx skip+emit 은 traversal service
// 내부에서 이미 처리되므로 본 service 는 그것을 통과시키고 instance 레벨 throw 만
// 흡수한다 — 새 permission-denied emit 경로를 만들지 않는다.
//
// 책임 경계(Out of Scope — task §Out of Scope): since/lastModified 도출 로직은
// slice (vi) — 본 service 는 spec 의 config 를 traversal 에 그대로 pass-through 만
// 한다(도출 0). instance enumerate(resolveConfluenceInstances 결과)는 상위 orchestrator
// slice (v) — 본 service 는 enumerate 된 config 배열을 입력으로 받는다. module 배선은
// slice (iv). live/credentialed 수집은 Q-0025 대로 deferred — 본 service 는 mock 주입
// `ConfluenceSpaceTraversalService` 위에서만 unit-test 된다.
import { Injectable } from "@nestjs/common";

import { ConfluenceInstanceConfig } from "../confluence/confluence-instance-config";
import { ConfluenceSpaceTraversalService } from "../confluence/confluence-space-traversal.service";

import { ConfluenceActivity } from "./domain/activity";
import { mapConfluenceActivity } from "./domain/confluence-activity.mapper";
import { dedupConfluenceActivities } from "./domain/page-dedup";

// ConfluenceCollectionSpec — 한 Person 의 Confluence 수집 enumerate 입력. enumerate 된
// instance config 배열을 받는다(enumerate 책임은 상위 orchestrator slice (v) — 본
// service 는 단일 Person 의 활성 instance config 들을 그대로 받아 instance loop 만
// 추가한다). SPACE allowlist 순회는 traversal service 내부 책임이므로 본 spec 에
// SPACE 필드는 없다. since/lastModified 도출도 본 slice 밖(slice (vi)).
export interface ConfluenceCollectionSpec {
  instances: ConfluenceInstanceConfig[];
}

@Injectable()
export class ConfluenceCollectionService {
  constructor(private readonly traversal: ConfluenceSpaceTraversalService) {}

  // collectConfluenceActivities — spec 의 각 instance 를 수집해 (page-id, version)
  // latest-wins dedup 된 `ConfluenceActivity[]` 를 반환한다. 빈 instance 입력이면
  // 빈 배열을 반환한다(throw 0). 어떤 instance 가 throw 해도 전체는 throw 하지 않고
  // 그 instance 만 skip 한다.
  async collectConfluenceActivities(
    spec: ConfluenceCollectionSpec,
  ): Promise<ConfluenceActivity[]> {
    const collected: ConfluenceActivity[] = [];

    for (const config of spec.instances) {
      // per-instance 독립 try/catch — 한 instance 의 throw(token 복호 실패 등
      // traversal service 가 전파하는 instance 레벨 오류)가 다른 instance 수집을
      // 막지 않도록 skip-and-continue.
      try {
        const results = await this.traversal.traverseInstance(config);
        for (const { spaceKey, pages } of results) {
          // raw page item → mapper(instanceKey / spaceKey 주입) → null(malformed)
          // skip → 누적. SPACE 식별은 traversal loop context 가 보유한 spaceKey.
          for (const raw of pages) {
            const activity = mapConfluenceActivity(raw, config.key, spaceKey);
            if (activity !== null) {
              collected.push(activity);
            }
          }
        }
      } catch {
        // skip-and-continue — SPACE 단위 4xx skip+emit 은 traversal service 내부에서
        // 이미 처리되므로 본 service 는 새 emit 경로를 만들지 않고 이 instance 만
        // 건너뛴다(부분 가용성 우선).
        continue;
      }
    }

    // 전 instance 누적 후 (page-id, version) latest-wins dedup(ADR-0029 Decision §4).
    return dedupConfluenceActivities(collected);
  }
}
