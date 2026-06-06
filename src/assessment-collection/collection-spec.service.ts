// CollectionSpecService — 한 Person 으로부터 전체 수집 입력 `CollectionSpec { github,
// confluence }` 을 조립하는 thin orchestration service (ADR-0030 §3 Confluence enumerate +
// §5 buildCollectionSpec 전체 조립, collection enumerate slice ii-b2b). GitHub 쪽은
// GithubCollectionSpecService(T-0260)에 위임하고, Confluence 쪽은 resolveConfluenceInstances
// (기존 함수)로 활성 instance 전체를 채운다 — 두 산출을 CollectionSpec 으로 결합만 한다.
//
// 책임 경계(Out of Scope): GitHub mode B+A 결합은 T-0260(위임만), Confluence instance
// resolve 는 resolveConfluenceInstances(재구현 0, 호출만). collectForPerson 진입·영속화·
// author 필터는 slice iii, since 도출은 slice vi. since 는 GitHub service 에 pass-through
// 만(도출 0); 현 ConfluenceCollectionSpec 에는 since 필드가 없어 Confluence since 통합도
// slice vi/iii 로 둔다. ADR-0030 §3: Confluence enumerate 는 Person→instance 매핑 없이
// 활성 instance 전체 대상(GitHub 과 달리 instance 매핑이 약함) — author 매칭은 slice iii.
// live/credentialed 는 Q-0025 deferred — mock 주입 GithubCollectionSpecService + 임의 env
// map(Confluence resolve) 위에서만 unit-test(실 fetch 0 / 실 token 0).
import { Injectable, Optional } from "@nestjs/common";

import { resolveConfluenceInstances } from "../confluence/confluence-instance-config";

import { CollectionSpec } from "./collection-orchestrator.service";
import {
  GithubCollectionSpecInput,
  GithubCollectionSpecService,
} from "./github-collection-spec.service";

@Injectable()
export class CollectionSpecService {
  constructor(
    private readonly githubSpecService: GithubCollectionSpecService,
    // env 는 Confluence instance resolve 용 — mock-injectable(T-0260 @Optional env 패턴).
    // GitHub 쪽 env 는 GithubCollectionSpecService 가 자체 보유하므로 본 service 는
    // Confluence resolve 용 env 만 주입받는다.
    @Optional() private readonly env: NodeJS.ProcessEnv = process.env,
  ) {}

  // buildCollectionSpec — Person 의 GitHub 수집 spec(T-0260 위임)과 Confluence 활성
  // instance(resolveConfluenceInstances)를 결합한 `CollectionSpec` 을 반환한다. since 는
  // GitHub service 에 pass-through 만(도출 0 — slice vi). GitHub service 가 내부적으로 실패를
  // 흡수하므로 그 throw 는 예외적 — 본 service 는 흡수하지 않고 전파한다(fail-fast).
  async buildCollectionSpec(
    person: GithubCollectionSpecInput,
    since?: string,
  ): Promise<CollectionSpec> {
    // (a) GitHub 쪽 — mode B+A 결합은 GithubCollectionSpecService(T-0260)에 위임.
    const github = await this.githubSpecService.buildGithubCollectionSpec(
      person,
      since,
    );

    // (b) Confluence 쪽 — 활성 instance 전체(ADR-0030 §3). rejected 진단은 사용 안 함.
    // SPACE scope / since 는 enumerate 밖(traversal service / slice vi).
    const { instances } = resolveConfluenceInstances(this.env);

    // (c) 두 산출을 CollectionSpec 으로 결합만 한다.
    return { github, confluence: { instances } };
  }
}
