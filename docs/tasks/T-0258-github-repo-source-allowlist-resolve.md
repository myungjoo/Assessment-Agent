---
id: T-0258
title: ADR-0030 §5 enumerate slice ii-a — Person→GitHub instance 매칭 + mode B allowlist repo source 산출(순수 함수)
phase: P4
status: DONE
commitMode: pr
coversReq: [REQ-005, REQ-006, REQ-007, REQ-024]
estimatedDiff: 280
estimatedFiles: 2
created: 2026-06-06
plannerNote: "P4 ADR-0030 §5 cap-split slice ii-a — buildCollectionSpec 의 dependency-first 선행 단위(순수 mode B 매칭). mode A async enumerate 는 ii-b 로 분리."
---

# T-0258 — ADR-0030 §5 enumerate slice ii-a — Person→GitHub instance 매칭 + mode B allowlist repo source 산출(순수 함수)

## Why

ADR-0030 §5 의 cap-split 3 slice(i: `_REPOS` env parser=T-0257 머지, ii: `buildCollectionSpec`, iii: `collectForPerson`) 중 **slice ii 가 cap(300 LOC / 5 파일)을 초과**한다 — Person→instance 매칭 + mode B(allowlist) + mode A(org 전체 async enumerate) + Confluence enumerate + since pass-through + R-112 negative matrix 가 한 task 에 다 들어가지 않는다. 따라서 ii 를 dependency-first 로 다시 쪼개 본 task(ii-a)는 **client 호출이 없는 순수·동기 단위** — Person 의 `ServiceIdentity[]` 를 `GithubInstanceConfig[]` 에 key 로 매칭하고, 매칭된 instance 중 **mode B(non-empty `repos` allowlist)** 인 것에 대해 allowlist 토큰(`org/repo` 또는 `repo`)을 `GithubRepoSource[]` 로 산출하는 순수 함수만 박제한다. mode A(빈 allowlist → `requestAllPagesForInstance("orgs/{org}/repos")` 런타임 enumerate, async) + 전체 `buildCollectionSpec` 조립(GitHub A+B + Confluence + since) 은 후속 slice ii-b 책임이다. README L15-18 의 "지정 Repository" 모드(=mode B)와 REQ-005~007(GitHub 활동 수집)·REQ-024(Person ID 매칭)를 cover 한다.

## Required Reading

- `docs/decisions/ADR-0030-assessment-collection-enumerate.md` — §1(repo source 정책: mode B=allowlist 우선), §2(Person→instance 매핑 + author 귀속), §5(cap 분할 3 slice 정의), §6(testing posture — negative 목록).
- `src/github/github-instance-config.ts` — `GithubInstanceConfig {key, host, orgs, repos, tokenEnc}`(slice i 로 `repos: string[]` 이미 추가됨). 본 task 가 `repos`(mode B allowlist)와 `key`(매칭)를 소비.
- `src/assessment-collection/github-collection.service.ts` — `GithubRepoSource {instanceKey, org, repo, since?}` + `GithubCollectionSpec` shape. 본 task 의 산출 타입.
- `prisma/schema.prisma` L55-67(`model Person` — `serviceIdentities` relation), L237-254(`model ServiceIdentity {personId, service, externalId, isPrimary}`, `@@unique([personId, service])`). 매칭 입력. Prisma `ServiceIdentity` type 은 `@prisma/client` 에서 import.
- `src/assessment-collection/domain/commit-dedup.ts` — domain/ 순수 함수 + colocated spec 의 코드 스타일·주석 톤 참고(본 task 도 `domain/` 에 둔다).

## Acceptance Criteria

본 task 의 산출물은 `src/assessment-collection/domain/github-repo-source.ts`(순수 함수 모듈) + colocated `src/assessment-collection/domain/github-repo-source.spec.ts`(R-112 spec) 두 파일이다.

- [ ] `resolveGithubRepoSources(instances: GithubInstanceConfig[], identities: Pick<ServiceIdentity, "service">[], since?: string)` 류의 순수·동기 export 함수를 `domain/github-repo-source.ts` 에 추가. client 호출 0 / 부수효과 0 / async 아님.
- [ ] **instance 매칭(ADR-0030 §2)**: 각 `ServiceIdentity.service` 를 `GithubInstanceConfig.key` 와 매칭한다(매칭 규칙: `key.toUpperCase()` 정규화 비교 — `github-instance-config.ts` 의 dedupe 정규화와 동형). 매칭되는 instance config 가 없는 ServiceIdentity 는 skip(throw 0, 수집 0).
- [ ] **mode B 산출(ADR-0030 §1)**: 매칭된 instance 중 `repos` allowlist 가 non-empty 인 것만 본 함수가 처리. 각 allowlist 토큰을 `GithubRepoSource` 로 변환 — 토큰이 `org/repo` 형식이면 `{org, repo}` 로 split, bare `repo` 형식이면 instance 의 각 `orgs` 원소를 org 로 사용해 `org×repo` cross-product source 산출(instance 에 orgs 가 0 개면 bare-repo 토큰은 산출 불가 → skip). `instanceKey = config.key`, `since` 는 인자 그대로 pass-through(도출 0).
- [ ] **mode A 분리**: `repos` allowlist 가 빈 배열(mode A)인 매칭 instance 는 본 함수가 source 를 산출하지 **않는다**. 후속 slice ii-b 가 async org enumerate 로 처리하도록, 그 instance(또는 instance/org 쌍) 목록을 별도 반환 필드(예: `{ sources: GithubRepoSource[]; orgEnumerateTargets: {...}[] }`)로 노출하거나, 본 task 가 mode B sources 만 반환하고 ii-b 가 mode A 를 별도 산출하도록 한다(구현 판단 — 단 반환 contract 를 함수 JSDoc 에 명시).
- [ ] happy-path test 1+: mode B allowlist(`org/repo` 토큰 + bare `repo` 토큰 둘 다)가 매칭 instance 에서 올바른 `GithubRepoSource[]` 로 산출되고 `since` 가 pass-through 됨을 검증.
- [ ] error/negative test 1+ **각각**(ADR-0030 §6 negative 목록을 분기마다 cover): (a) 매칭 instance 부재 ServiceIdentity → skip(빈 결과·throw 0), (b) 빈 ServiceIdentity 배열 → 빈 sources, (c) mode A(빈 allowlist) 매칭 instance → mode B sources 0(orgEnumerateTargets 로만 노출), (d) bare `repo` 토큰 + instance orgs 0 개 → 그 토큰 skip, (e) `org/repo` 토큰의 org/repo split 경계(슬래시 다중/공백 — 토큰은 slice i 가 이미 trim·빈제거했으므로 malformed 슬래시 케이스 방어), (f) since 미지정(undefined) → 산출 source 의 `since` 도 undefined.
- [ ] flow/branch cover: 매칭 분기 / mode B vs mode A 분기 / `org/repo` vs bare `repo` 토큰 분기 각 1+ test.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — `coverageThreshold.global` 강제.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과(tester 가 결과 확인 — R-110).
- [ ] colocated spec 은 `src/assessment-collection/domain/github-repo-source.spec.ts` 위치(NestJS convention + domain/ 의 기존 colocated 패턴 정합). 공유 mock 불요(순수 함수 — 입력 객체 literal 로 충분).

## Out of Scope

- **mode A(org 전체) async enumerate** — `requestAllPagesForInstance("orgs/{org}/repos")` 호출로 repo 목록을 런타임 산출하는 로직은 slice ii-b. 본 task 는 mode A 대상 instance 를 식별·노출만 하고 실 enumerate 는 하지 않는다(client 호출 0).
- **전체 `buildCollectionSpec(person, since?)` 조립** — GitHub(A+B 결합) + Confluence(`resolveConfluenceInstances`) + `CollectionSpec` 조립은 slice ii-b.
- **`collectForPerson` 진입 + 영속화 결선(`collectAndPersist`) + author 필터(`Activity.author === externalId`)** — slice iii(후속). 본 task 는 author 귀속/필터를 다루지 않는다(repo source 산출만).
- **Confluence instance enumerate** — slice ii-b/iii.
- **since 도출(직전 Assessment → since)** — slice vi(ADR-0029 §5). 본 task 는 since 를 주입받아 pass-through 만.
- **실 네트워크 / 실 credential** — Q-0025 대로 deferred. 본 task 는 순수 함수라 네트워크 자체가 없다.
- **module 배선 변경 / DI provider 추가** — 본 task 는 순수 함수 모듈만 추가(provider 등록은 ii-b/iii 에서 buildCollectionSpec service 화 시).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- slice ii-b1 (T-0259): mode A(빈 allowlist) org→repo async enumerate — `orgEnumerateTargets` 소비.
- slice ii-b2: 전체 `buildCollectionSpec(person, since?)` 조립 (GitHub A+B + Confluence + since).
- slice iii: `collectForPerson` 진입 + 영속화 결선 + author 필터.
- (reviewer nit, 비-차단) mode B token-level dedup 부재 — downstream SHA dedup 이 흡수, 필요 시 ii-b 통합 시 자연 해소.

## 완료 기록

- DONE 2026-06-06 (loop@AKIHA-s68). PR-221 squash-merge `3987155`, reviewer APPROVE round 1/7 (0 BLOCKER/0 MAJOR/1 MINOR[LOC overage 비-차단]/1 nit[비-차단]), 4-게이트 PASS, CI green (approval-gate race → approve comment + rerun).
- 산출: `src/assessment-collection/domain/github-repo-source.ts` (`resolveGithubRepoSources` 순수 함수) + colocated spec (15 case, 신규 파일 cov 100%). +388 LOC/2 파일.
