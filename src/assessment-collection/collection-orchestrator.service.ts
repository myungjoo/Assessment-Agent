// CollectionOrchestratorService — 한 수집 단위에 대해 GitHub 측
// (`GithubCollectionService`)과 Confluence 측(`ConfluenceCollectionService`)을 함께
// 호출해 결과를 단일 `Activity[]` 로 aggregate 하는 orchestrator(ADR-0029 Decision §3,
// collection slice (v-b), REQ-005~008/REQ-015/REQ-031). 두 collection service(T-0249/
// T-0250)와 module 배선(T-0251)은 머지됐으나 두 service 를 함께 호출해 단일 `Activity[]`
// 로 모으는 caller 가 아직 0 이었다 — 본 service 가 그 backbone 진입점이다.
//
// 흐름: collectActivities(spec)
//   (1) spec.github(`GithubCollectionSpec`)로 GithubCollectionService 를 호출 →
//       `GithubActivity[]` 획득(독립 try/catch — 실패 시 빈 배열로 흡수).
//   (2) spec.confluence(`ConfluenceCollectionSpec`)로 ConfluenceCollectionService 를
//       호출 → `ConfluenceActivity[]` 획득(독립 try/catch — 실패 시 빈 배열로 흡수).
//   (3) 두 결과를 GitHub→Confluence 순서로 concat 한 단일 `Activity[]` 반환(결정론적
//       순서). `GithubActivity` / `ConfluenceActivity` 는 `Activity` 의 변형이므로 concat
//       결과 타입이 `Activity[]` 로 좁혀진다.
//
// per-source 독립성(ADR-0029 Decision §3 부분 가용성 우선): GitHub 수집과 Confluence
// 수집을 **각각 독립 try/catch** 로 감싸 한쪽 collection service 가 throw 해도 다른 쪽
// 결과는 보존하고(skip-and-continue) 실패한 source 는 빈 배열로 흡수한다. orchestrator
// 자체는 절대 throw 하지 않는다. 두 collection service 는 이미 내부적으로 source(instance/
// repo) 단위 skip 을 수행하므로(github-collection.service.ts / confluence-collection.
// service.ts) 본 orchestrator 의 try/catch 는 그 아래 layer 가 흘려보내는 **예상 외
// service 레벨 throw**(전체 실패)를 흡수하는 것이 목적이다 — 본 service 는 새 permission-
// denied emit 경로를 만들지 않는다.
//
// 책임 경계(Out of Scope — task §Out of Scope): 본 orchestrator 는 **이미 산출된
// `CollectionSpec` 을 입력으로 받는다**. Person enumerate(ServiceIdentity 별 instance×
// org×repo / Confluence instance 를 `CollectionSpec` 으로 산출)는 slice (v-b2/enumerate),
// Contribution 영속화(v-a 매퍼 `mapActivityToContribution` 호출 + `ContributionService.
// create`)는 slice (v-c), incremental since 도출은 slice (vi)로 분리된다. 본 service 는
// 매퍼를 호출하지 않고 `Activity[]` aggregate 까지만 책임진다. live/credentialed 수집은
// Q-0025 대로 deferred — 본 service 는 mock 주입 collection service 위에서만 unit-test 된다.
import { Injectable } from "@nestjs/common";

import {
  ConfluenceCollectionService,
  ConfluenceCollectionSpec,
} from "./confluence-collection.service";
import { Activity } from "./domain/activity";
import {
  GithubCollectionService,
  GithubCollectionSpec,
} from "./github-collection.service";

// CollectionSpec — 한 수집 단위(한 Person)의 두 source 수집 입력을 묶은 orchestrator
// 입력. enumerate 책임은 상위 slice (v-b2) — 본 orchestrator 는 산출된 spec 을 받아
// 두 collection service 에 그대로 pass-through 한다(검증·enumerate 0).
export interface CollectionSpec {
  // GitHub 수집 enumerate 입력(instance×org×repo flatten source 배열).
  github: GithubCollectionSpec;
  // Confluence 수집 enumerate 입력(활성 instance config 배열).
  confluence: ConfluenceCollectionSpec;
}

@Injectable()
export class CollectionOrchestratorService {
  constructor(
    private readonly github: GithubCollectionService,
    private readonly confluence: ConfluenceCollectionService,
  ) {}

  // collectActivities — spec.github / spec.confluence 로 두 collection service 를
  // 호출하고 결과를 GitHub→Confluence 순서로 concat 한 단일 `Activity[]` 를 반환한다.
  // 각 호출은 독립 try/catch(아래 collectSafely)로 감싸 한쪽이 throw 해도 다른 쪽
  // 결과는 보존된다(부분 가용성 우선, ADR-0029 Decision §3). 두 source 모두 throw 하면
  // 빈 `Activity[]` 를 반환하며 orchestrator 는 전체 throw 하지 않는다.
  async collectActivities(spec: CollectionSpec): Promise<Activity[]> {
    const githubActivities = await this.collectSafely(() =>
      this.github.collectGithubActivities(spec.github),
    );
    const confluenceActivities = await this.collectSafely(() =>
      this.confluence.collectConfluenceActivities(spec.confluence),
    );

    // GitHub→Confluence 순서 concat(결정론적). 두 변형 모두 `Activity` 이므로 결과
    // 타입은 `Activity[]` 로 좁혀진다.
    return [...githubActivities, ...confluenceActivities];
  }

  // collectSafely — 한 source 의 collection 호출을 독립 try/catch 로 감싸, throw 시
  // 빈 배열로 흡수한다(skip-and-continue). 한 source 의 service 레벨 throw 가 다른
  // source 결과 보존을 막지 않게 하는 부분 가용성 backbone 이다(ADR-0029 Decision §3).
  private async collectSafely<T>(collect: () => Promise<T[]>): Promise<T[]> {
    try {
      return await collect();
    } catch {
      // service 레벨 throw 흡수 — 새 emit 경로 0, 이 source 만 빈 배열로 건너뛴다.
      return [];
    }
  }
}
