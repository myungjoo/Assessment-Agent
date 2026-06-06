// GithubCollectionService — `GithubInstanceClient` 위에서 한 Person 의 GitHub instance
// (com / sec / ecode) × org × repo 를 enumerate 하며 commit / PR / issue 활동을 수집하는
// service(ADR-0029 Decision §3 GitHub loop + §4 commit dedup, collection slice (ii)).
// 이제껏 caller 0 였던 `GithubInstanceClient.requestAllPagesForInstance` 의 첫
// production caller 다.
//
// 흐름: collectGithubActivities(spec)
//   (1) spec.instances 의 각 (instanceKey, org, repo, since?) source 를 enumerate.
//   (2) source 마다 commits / PRs / issues list endpoint 를 requestAllPagesForInstance
//       로 호출 → raw `unknown[]` 획득.
//   (3) raw item 마다 `mapGithubActivity(raw, instanceKey, repoRef)` 호출 → null(=
//       malformed) skip → `GithubActivity[]` 누적.
//   (4) 전 source 누적 후 `dedupGithubActivities` 로 SHA earliest-wins dedup → 반환.
//
// per-source skip-and-continue(ADR-0029 Decision §3): 각 instance/org/repo/endpoint
// 호출을 **독립 try/catch** 로 감싼다. 한 source 의 throw(권한 부족 4xx 등
// `GithubInstanceClient`/adapter 가 throw 하는 domain error)가 다른 source 수집을 막지
// 않도록 skip 하고 계속한다(부분 가용성 우선). 본 service 는 새 permission-denied emit
// 경로를 만들지 않는다 — 기존 `GithubAdapter` emit 은 wrapper 내부에서 이미 발생하며,
// 본 service 는 wrapper 가 throw 한 error 를 swallow(skip)할 뿐이다.
//
// 책임 경계(Out of Scope — task §Out of Scope): since 도출 로직(직전 Assessment →
// since 계산)은 slice (vi) — 본 service 는 spec 의 `since?` 를 query 로 pass-through 만
// 한다. Confluence 수집은 slice (iii), module 배선은 (iv), orchestrator entry + 영속화는
// (v). live/credentialed 수집은 Q-0025 대로 deferred — 본 service 는 mock 주입
// `GithubInstanceClient` 위에서만 unit-test 된다.
import { Injectable } from "@nestjs/common";

import { GithubInstanceClient } from "../github/github-instance-client.service";

import { GithubActivity } from "./domain/activity";
import { dedupGithubActivities } from "./domain/commit-dedup";
import { mapGithubActivity } from "./domain/github-activity.mapper";

// GithubActivityEndpoint — 한 repo 에서 수집하는 활동 endpoint 종류. list endpoint
// path 와 결과 활동의 raw shape 가 mapper 의 commit / pr / issue 판정으로 흘러간다.
export type GithubActivityEndpoint = "commits" | "pulls" | "issues";

// COLLECT_ENDPOINTS — 한 repo 에서 수집할 endpoint 와 그 GitHub REST list path suffix.
// path 는 `repos/{org}/{repo}/{suffix}` 로 조립된다(GitHub REST v3 convention).
const COLLECT_ENDPOINTS: ReadonlyArray<{
  endpoint: GithubActivityEndpoint;
  suffix: string;
}> = [
  { endpoint: "commits", suffix: "commits" },
  { endpoint: "pulls", suffix: "pulls" },
  { endpoint: "issues", suffix: "issues" },
];

// GithubRepoSource — 단일 (instance, org, repo) 수집 단위. 한 Person 의 ServiceIdentity
// 별 GitHub 수집 대상을 표현한다. since 는 adapter query 로 pass-through 만 된다(도출 0).
export interface GithubRepoSource {
  // instance key(com / sec / ecode) — `GithubInstanceClient` config 해석 키.
  instanceKey: string;
  // org/owner 이름.
  org: string;
  // repo 이름.
  repo: string;
  // incremental 수집 경계(ISO-8601). 미지정 시 full collection. 도출은 slice (vi).
  since?: string;
}

// GithubCollectionSpec — 한 Person 의 GitHub 수집 enumerate 입력. instance×org×repo 를
// flatten 한 source 배열을 받는다(enumerate 책임은 상위 orchestrator slice (v)).
export interface GithubCollectionSpec {
  sources: GithubRepoSource[];
}

@Injectable()
export class GithubCollectionService {
  constructor(private readonly client: GithubInstanceClient) {}

  // collectGithubActivities — spec 의 각 source × endpoint 를 수집해 dedup 된
  // `GithubActivity[]` 를 반환한다. 빈 source 입력이면 빈 배열을 반환한다(throw 0).
  // 어떤 source/endpoint 가 throw 해도 전체는 throw 하지 않고 그 source 만 skip 한다.
  async collectGithubActivities(
    spec: GithubCollectionSpec,
  ): Promise<GithubActivity[]> {
    const collected: GithubActivity[] = [];

    for (const source of spec.sources) {
      const repoRef = `${source.org}/${source.repo}`;
      for (const { suffix } of COLLECT_ENDPOINTS) {
        const path = `repos/${source.org}/${source.repo}/${suffix}`;
        // per-source(endpoint 단위) 독립 try/catch — 한 호출의 throw(권한 부족 등)가
        // 다른 source/endpoint 수집을 막지 않도록 skip-and-continue.
        try {
          const query =
            source.since === undefined ? undefined : { since: source.since };
          const rawItems = await this.client.requestAllPagesForInstance(
            source.instanceKey,
            path,
            query,
          );
          // raw item → mapper → null(malformed) skip → 누적.
          for (const raw of rawItems) {
            const activity = mapGithubActivity(
              raw,
              source.instanceKey,
              repoRef,
            );
            if (activity !== null) {
              collected.push(activity);
            }
          }
        } catch {
          // skip-and-continue — 기존 emit 은 wrapper 내부에서 이미 발생. 본 service 는
          // 새 emit 경로를 만들지 않고 이 source/endpoint 만 건너뛴다(부분 가용성 우선).
          continue;
        }
      }
    }

    // 전 source 누적 후 SHA earliest-wins dedup(ADR-0029 Decision §4) 적용.
    return dedupGithubActivities(collected);
  }
}
