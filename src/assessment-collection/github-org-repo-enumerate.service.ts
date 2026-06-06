// GithubOrgEnumerateService — mode A(빈 `_REPOS` allowlist) instance 의 org 전체 repo 를
// `GithubInstanceClient` 로 런타임 enumerate 해 `GithubRepoSource[]` 로 산출하는 service
// (ADR-0030 §1 mode A fallback, collection enumerate slice ii-b1). T-0258 의
// `resolveGithubRepoSources` 가 노출한 `GithubOrgEnumerateTarget[]` 를 입력으로 받아, 각
// (instanceKey, org) 에 대해 `orgs/{org}/repos` list 를 호출하고 repo 이름을 추출해
// `{instanceKey, org, repo, since}` source 로 변환한다.
//
// per-target skip-and-continue(ADR-0030 §1): 각 target 호출을 독립 try/catch 로 감싼다.
// 한 target 의 throw(권한 부족 4xx 등 client/adapter domain error)가 다른 target
// enumerate 를 막지 않도록 skip 하고 계속한다(부분 가용성 우선). 본 service 는 새
// permission-denied emit 경로를 만들지 않는다 — 기존 GithubAdapter emit 은 wrapper 내부
// 에서 이미 발생하며, 본 service 는 wrapper 가 throw 한 error 를 swallow(skip)할 뿐이다.
//
// 책임 경계(Out of Scope): mode B allowlist 매칭(T-0258), 전체 buildCollectionSpec
// 조립(slice ii-b2), collectForPerson 진입·영속화·author 필터(slice iii), since 도출
// (slice vi)은 본 service 밖. since 는 target 의 값 그대로 pass-through(도출 0).
// live/credentialed enumerate 는 Q-0025 대로 deferred — mock 주입 client 위에서만 unit-test.
import { Injectable } from "@nestjs/common";

import { GithubInstanceClient } from "../github/github-instance-client.service";

import { mapRepoName } from "./domain/github-repo-list.mapper";
import { GithubOrgEnumerateTarget } from "./domain/github-repo-source";
import { GithubRepoSource } from "./github-collection.service";

@Injectable()
export class GithubOrgEnumerateService {
  constructor(private readonly client: GithubInstanceClient) {}

  // enumerateRepoSources — 각 mode A target 의 org 전체 repo 를 enumerate 해
  // `GithubRepoSource[]` 로 평탄화 반환한다. 빈 targets 면 빈 배열(client 호출 0).
  // 한 target 이 throw 해도 전체는 throw 하지 않고 그 target 만 skip 한다.
  async enumerateRepoSources(
    targets: GithubOrgEnumerateTarget[],
  ): Promise<GithubRepoSource[]> {
    const sources: GithubRepoSource[] = [];

    for (const target of targets) {
      const path = `orgs/${target.org}/repos`;
      // per-target 독립 try/catch — 한 호출의 throw(권한 부족 등)가 다른 target
      // enumerate 를 막지 않도록 skip-and-continue.
      try {
        const rawItems = await this.client.requestAllPagesForInstance(
          target.instanceKey,
          path,
        );
        for (const raw of rawItems) {
          const repo = mapRepoName(raw);
          // malformed(repo 이름 추출 불가) item 은 skip(throw 0).
          if (repo !== null) {
            sources.push({
              instanceKey: target.instanceKey,
              org: target.org,
              repo,
              since: target.since,
            });
          }
        }
      } catch {
        // skip-and-continue — 기존 emit 은 wrapper 내부에서 이미 발생. 본 service 는
        // 새 emit 경로를 만들지 않고 이 target 만 건너뛴다(부분 가용성 우선).
        continue;
      }
    }

    return sources;
  }
}
