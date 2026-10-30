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

import {
  CONFLUENCE_INSTANCES_ENV,
  resolveConfluenceInstances,
} from "../confluence/confluence-instance-config";
import {
  GITHUB_INSTANCES_ENV,
  resolveGithubInstances,
} from "../github/github-instance-config";

import { CollectionSpec } from "./collection-orchestrator.service";
import { resolveGithubRepoSources } from "./domain/github-repo-source";
import {
  GithubCollectionSpecInput,
  GithubCollectionSpecService,
} from "./github-collection-spec.service";
import type { CollectionCallTally } from "./github-collection.service";

/** 저장 전 판정용 수집 범위 판정 결과. */
export interface CollectionCoverage {
  /** 인원의 식별자가 가리키는 수집 대상을 모두 수집할 수 있는가. */
  complete: boolean;
  /** 설정에 올라 있으나 수집할 수 없는 instance key. */
  unavailableKeys: string[];
}

const normalizeKey = (key: string): string => key.trim().toUpperCase();

const listedKeys = (raw: string | undefined): Set<string> =>
  new Set(
    (raw ?? "")
      .split(/[\s,]+/)
      .filter((key) => key.length > 0)
      .map(normalizeKey),
  );

/**
 * 인원의 식별자 기준으로 수집 범위를 판정한다. 이 판정이 false 면 활동 유무와 무관하게
 * 좌표를 저장하지 않는다 (T-2051 규칙 정본).
 *
 * - 운영자가 `GITHUB_INSTANCES` · `CONFLUENCE_INSTANCES` 어디에도 올린 적 없는 key 의
 *   식별자는 실패가 아니다. 수집 대상이 아니라고 보고 무시한다.
 * - 목록에 올랐는데 쓸 수 없는 instance (필수 env 부재 · repo / org / SPACE 대상 0) 에
 *   식별자가 있으면 실패다. 수집되지 않았으니 활동 유무를 알 수 없다.
 * - 수집 가능한 식별자가 하나도 없으면 실패다.
 * - 목록에 없는 key 가 있고 쓸 수 있는 GitHub instance 가 하나도 없으면 실패다.
 *   GitHub 설정 전체 유실과 구분되지 않기 때문이다 (T-2042 의 githubMissing).
 */
export function assessCollectionCoverage(
  identities: GithubCollectionSpecInput["serviceIdentities"],
  env: NodeJS.ProcessEnv,
): CollectionCoverage {
  const githubListed = listedKeys(env[GITHUB_INSTANCES_ENV]);
  const confluenceListed = listedKeys(env[CONFLUENCE_INSTANCES_ENV]);
  const github = resolveGithubInstances(env).instances;
  const confluence = resolveConfluenceInstances(env).instances;

  const unavailableKeys: string[] = [];
  let usable = 0;
  let githubUsable = false;
  let unlisted = 0;
  for (const key of new Set(identities.map((i) => normalizeKey(i.service)))) {
    const inGithub = githubListed.has(key);
    const inConfluence = confluenceListed.has(key);
    if (!inGithub && !inConfluence) {
      unlisted += 1;
      continue;
    }
    const { sources, orgEnumerateTargets } = resolveGithubRepoSources(
      github.filter((c) => normalizeKey(c.key) === key),
      [{ service: key }],
    );
    const githubOk = sources.length + orgEnumerateTargets.length > 0;
    const confluenceOk = confluence.some(
      (c) => normalizeKey(c.key) === key && c.spaceAllowlist.length > 0,
    );
    if ((inGithub && !githubOk) || (inConfluence && !confluenceOk)) {
      unavailableKeys.push(key);
      continue;
    }
    usable += 1;
    githubUsable ||= inGithub;
  }
  return {
    complete:
      unavailableKeys.length === 0 &&
      usable > 0 &&
      (unlisted === 0 || githubUsable),
    unavailableKeys,
  };
}

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

  /**
   * 저장 전 판정용 spec 조립. org 열거 실패도 범위 미달로 치고, Confluence 는 인원의 식별자가
   * 있는 instance 만 남긴다 — 귀속이 instance 단위라 다른 instance 의 장애는 이 인원의 결과에
   * 영향이 없다.
   */
  async buildCollectionSpecWithCoverage(
    person: GithubCollectionSpecInput,
    since?: string,
  ): Promise<{ spec: CollectionSpec; coverage: CollectionCoverage }> {
    const tally: CollectionCallTally = { succeeded: 0, failed: 0 };
    const github = await this.githubSpecService.buildGithubCollectionSpec(
      person,
      since,
      tally,
    );
    const keys = new Set(
      person.serviceIdentities.map((i) => normalizeKey(i.service)),
    );
    const instances = resolveConfluenceInstances(this.env).instances.filter(
      (c) => keys.has(normalizeKey(c.key)),
    );
    const coverage = assessCollectionCoverage(
      person.serviceIdentities,
      this.env,
    );
    return {
      spec: { github, confluence: { instances } },
      coverage: {
        ...coverage,
        complete: coverage.complete && tally.failed === 0,
      },
    };
  }
}
