// github-repo-source — 한 Person 의 GitHub ServiceIdentity 를 활성 GithubInstanceConfig
// 에 매칭하고, 매칭된 instance 중 모드 B(non-empty `_REPOS` allowlist)인 것의 allowlist
// 토큰을 GithubRepoSource[] 로 산출하는 부수효과 0 순수·동기 함수 모듈(ADR-0030 §1 repo
// source 정책 / §2 Person→instance 매핑, collection enumerate slice ii-a).
//
// 책임 경계:
//   - resolveGithubRepoSources: instances + identities (+ since?) 를 받아
//     { sources, orgEnumerateTargets } 를 산출하는 순수 함수. client 호출 0 /
//     부수효과 0 / async 아님 / 실 네트워크·credential 0.
//   - 모드 B(allowlist) source 산출만 본 함수 책임. 모드 A(빈 allowlist → org 전체
//     런타임 enumerate)는 산출하지 않고 `orgEnumerateTargets` 로 식별·노출만 한다
//     (실 enumerate = slice ii-b 의 async `requestAllPagesForInstance` 책임).
//   - since 는 주입받아 pass-through 만(도출 0 — ADR-0030 §4, slice vi).
//   - author 귀속/필터(`Activity.author === externalId`)는 본 함수 밖(slice iii).
//   - 외부 의존 0(Node 내장 타입만), 새 dependency 0.

import type { ServiceIdentity } from "@prisma/client";

import type { GithubInstanceConfig } from "../../github/github-instance-config";
import type { GithubRepoSource } from "../github-collection.service";

// GithubOrgEnumerateTarget — 모드 A(빈 allowlist) 매칭 instance 의 (instanceKey, org)
// 쌍. slice ii-b 가 `requestAllPagesForInstance(instanceKey, "orgs/{org}/repos")` 로
// repo 목록을 런타임 enumerate 할 대상이다. since 는 pass-through(도출 0).
export interface GithubOrgEnumerateTarget {
  // 매칭된 instance config 의 key(GithubRepoSource.instanceKey 와 동형).
  instanceKey: string;
  // org 전체 enumerate 대상 org 이름(instance config 의 orgs 원소).
  org: string;
  // incremental 수집 경계(ISO-8601). 주입값 그대로 pass-through. 미지정 시 undefined.
  since?: string;
}

// GithubRepoSourceResolution — resolveGithubRepoSources 반환 contract.
//   - sources: 모드 B(allowlist)로 즉시 산출된 (instance, org, repo) 수집 단위.
//   - orgEnumerateTargets: 모드 A(빈 allowlist) 매칭 instance 의 enumerate 대상
//     (instanceKey, org) 쌍 — slice ii-b 가 async 로 repo 목록을 채운다. 본 함수는
//     모드 A 의 실 source 를 산출하지 않는다(client 호출 0 경계).
export interface GithubRepoSourceResolution {
  sources: GithubRepoSource[];
  orgEnumerateTargets: GithubOrgEnumerateTarget[];
}

// normalizeKey — instance key / ServiceIdentity.service 매칭용 정규화. github-instance-
// config.ts 의 dedupe 정규화(`key.toUpperCase()`)와 동형 + 외부 입력(service) 방어를
// 위해 trim 동반. 실값 0 — 비교 키만 산출.
function normalizeKey(value: string): string {
  return value.trim().toUpperCase();
}

/**
 * resolveGithubRepoSources — Person 의 GitHub ServiceIdentity 를 활성
 * GithubInstanceConfig 에 매칭하고, 매칭된 instance 중 모드 B(non-empty `repos`
 * allowlist)의 allowlist 토큰을 `GithubRepoSource[]` 로 산출하는 순수·동기 함수.
 *
 * 매칭(ADR-0030 §2): 각 `identities[].service` 를 `instances[].key` 와
 * `normalizeKey`(trim+대문자) 비교로 매칭. 매칭 instance 가 없는 identity 는 skip(수집
 * 0, throw 0). 동일 instance 에 다중 identity 가 매칭돼도 instance 는 1 회만 처리한다
 * (중복 source/target 방지).
 *
 * 모드 분기(ADR-0030 §1):
 *   - 모드 B(`repos` non-empty): 각 토큰을 source 로 변환. `org/repo` 형식이면
 *     `{org, repo}`; bare `repo` 형식이면 instance 의 각 `orgs` 원소와 cross-product
 *     (`org×repo`). instance.orgs 가 0 개면 bare 토큰은 산출 불가 → skip. malformed
 *     슬래시(빈 org/repo, 다중 슬래시) 토큰은 skip(throw 0).
 *   - 모드 A(`repos` empty): source 산출 안 함. 각 org 를 `orgEnumerateTargets` 로
 *     노출(slice ii-b 가 async enumerate). orgs 0 개면 target 도 0.
 *
 * `since` 는 산출 source / target 에 그대로 pass-through(도출 0 — ADR-0030 §4).
 *
 * @returns `{ sources, orgEnumerateTargets }` — 모드 B 즉시 산출 source + 모드 A
 *   enumerate 대상. 입력이 비거나 매칭 0 이면 빈 배열(throw 0).
 */
export function resolveGithubRepoSources(
  instances: GithubInstanceConfig[],
  identities: Pick<ServiceIdentity, "service">[],
  since?: string,
): GithubRepoSourceResolution {
  const sources: GithubRepoSource[] = [];
  const orgEnumerateTargets: GithubOrgEnumerateTarget[] = [];

  // 매칭 대상 service 키 집합(정규화). identity 0 개면 빈 집합 → 매칭 instance 0.
  const wantedServices = new Set(
    identities.map((identity) => normalizeKey(identity.service)),
  );
  if (wantedServices.size === 0) {
    return { sources, orgEnumerateTargets };
  }

  // 이미 처리한 instance 정규화 키(다중 identity → 동일 instance 중복 처리 방지).
  const processed = new Set<string>();

  for (const instance of instances) {
    const normKey = normalizeKey(instance.key);
    // identity 가 가리키지 않는 instance 는 enumerate 대상 아님(ADR-0030 §2).
    if (!wantedServices.has(normKey)) {
      continue;
    }
    // 동일 instance 는 1 회만 처리(중복 source/target 방지).
    if (processed.has(normKey)) {
      continue;
    }
    processed.add(normKey);

    // 모드 A(빈 allowlist) — source 산출 안 함. 각 org 를 enumerate 대상으로 노출.
    if (instance.repos.length === 0) {
      for (const org of instance.orgs) {
        orgEnumerateTargets.push({ instanceKey: instance.key, org, since });
      }
      continue;
    }

    // 모드 B(allowlist) — 각 토큰을 source 로 변환.
    for (const token of instance.repos) {
      const parts = token.split("/");

      if (parts.length === 1) {
        // bare `repo` — instance 의 각 org 와 cross-product. orgs 0 개면 skip.
        const repo = parts[0].trim();
        if (repo.length === 0) {
          continue;
        }
        for (const org of instance.orgs) {
          sources.push({ instanceKey: instance.key, org, repo, since });
        }
        continue;
      }

      // `org/repo` — 정확히 1 슬래시 + 양쪽 비어있지 않을 때만 채택.
      const org = parts[0].trim();
      const repo = parts[1].trim();
      if (parts.length === 2 && org.length > 0 && repo.length > 0) {
        sources.push({ instanceKey: instance.key, org, repo, since });
        continue;
      }
      // malformed(다중 슬래시 / 빈 org / 빈 repo) — skip(throw 0).
    }
  }

  return { sources, orgEnumerateTargets };
}
