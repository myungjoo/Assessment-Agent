---
id: T-0256
title: Assessment collection enumerate(v-b2) 설계 ADR — Person → CollectionSpec 산출 + repo source 정책
phase: P4
commitMode: pr
coversReq: [REQ-005, REQ-006, REQ-007, REQ-008, REQ-015, REQ-024, REQ-031]
estimatedDiff: 230
estimatedFiles: 2
created: 2026-06-06
status: DONE
completedAt: 2026-06-06T17:13:00+09:00
prNumber: 219
mergeCommit: 9907ac8
adr: ADR-0030
result: PR-219 squash merge 9907ac8 (loop@AKIHA-s67 t7). ADR-0030 collection enumerate 6 결정(repo source env allowlist+org API, DB 기각 / Person→instance 매핑 + author 귀속 post-collection / Confluence enumerate / since=slice vi 주입 / collectForPerson 계약 / mocked R-112) + INDEX row. reviewer APPROVE(1 MINOR=status ACCEPTED vs AC PROPOSED, 변경 불요), CI green, 4-게이트 PASS. +97/2 파일, 코드 0.
plannerNote: P4 ADR-0029 collection slice v-b2(enumerate) ADR-first stage — Person→CollectionSpec 산출 + repo source(org전체 API / 지정 repo allowlist) 결정, impl 0 LOC. 다음 free ADR 번호 = ADR-0030
---

# T-0256 — Assessment collection enumerate(v-b2) 설계 ADR

## Why

ADR-0029 collection backbone 의 mock-unit slice — 매퍼(T-0252)·orchestrator(T-0253)·영속화(T-0254)·module/doc(T-0251/T-0255) — 가 모두 머지됐다. 그러나 두 collection service(`GithubCollectionService` / `ConfluenceCollectionService`)와 orchestrator(`CollectionOrchestratorService`)는 **이미 산출된 `CollectionSpec`(GitHub instance×org×repo source 배열 + Confluence instance 배열)을 입력으로 받을 뿐**, 그 spec 을 한 Person 으로부터 **enumerate** 하는 진입점(`collectForPerson(person, since?)`, ADR-0029 Decision §3)이 아직 0 이다.

차단점: ADR-0029 Decision §3 은 GitHub loop 을 "org/repo enumerate 후 commits/PRs/issues 호출"로만 명시하고, **org/repo 가 어디서 오는지의 source 정책은 결정하지 않았다**. main 대조 — `ServiceIdentity`(`service`/`externalId`/`isPrimary`)에 org/repo 정보 부재, `GithubRepoSource`(`{instanceKey, org, repo}`)의 repo source 미정의. 이 enumerate 설계 결정(repo source 정책 + Person→instance 매핑 + Confluence instance enumerate + since 경계)을 별도 ADR 로 선행 박제해야, 후속 `collectForPerson` 구현 slice 가 inline architecture 결정을 끌어들이지 않는다(CLAUDE.md §1 "코드보다 ADR이 먼저", §3.1 rule 4 — 새 ADR 은 pr). README L16-18 이 "지정 org 전체 Repository 혹은 지정 Repository" 두 모드를 product 요구로 박제하므로 본 결정은 ambiguity 가 아닌 설계 결정이다.

## Required Reading

- `docs/decisions/ADR-0029-assessment-collection-orchestrator.md`(특히 Decision §3 orchestration 계약 + §5 since + §7 testing posture — 본 ADR 이 그 §3 이 deferred 한 enumerate source 를 resolve)
- `docs/decisions/ADR-0017-github-instance-config-source.md`(GITHUB_INSTANCES + per-key `_HOST`/`_ORG`/`_TOKEN_ENC` env config — org source 의 기존 박제 + repo allowlist 추가 시 mirror 할 패턴)
- `src/github/github-instance-config.ts`(`GithubInstanceConfig {key, host, orgs, tokenEnc}` + `resolveGithubInstances` 순수 함수 — org 는 여기 있고 repo 는 부재)
- `src/github/github-instance-client.service.ts`(`requestAllPagesForInstance(key, path, query)` — org repo enumerate API 호출에 재사용 가능한 wrapper)
- `src/assessment-collection/github-collection.service.ts`(`GithubCollectionSpec {sources: GithubRepoSource[]}` + `GithubRepoSource {instanceKey, org, repo, since?}` — enumerate 산출 대상 입력 shape)
- `src/assessment-collection/confluence-collection.service.ts`(`ConfluenceCollectionSpec {instances: ConfluenceInstanceConfig[]}` — Confluence enumerate 산출 대상)
- `src/assessment-collection/collection-orchestrator.service.ts`(`CollectionSpec {github, confluence}` — enumerate 의 최종 산출 타입)
- `prisma/schema.prisma`(Person / ServiceIdentity 모델 — org/repo 부재 + service/externalId/isPrimary 만, Person→instance 매핑의 source)
- `README.md` L14-22(코드 평가 대상 원문 — "지정 org 전체 Repository 혹은 지정 Repository" 두 모드 + read 권한 부족 통지)
- `docs/architecture/data-model.md`(ServiceIdentity §3 관계 1 + REQ-024 primary key 역할 ID)
- `docs/architecture/INDEX.md`(ADR 목록 — 본 ADR row 추가 대상)

## Acceptance Criteria

본 task 는 **결정 전용 ADR 1개**(`docs/decisions/ADR-0030-assessment-collection-enumerate.md` — `docs/decisions/` 스캔으로 다음 free 번호 = ADR-0030 확인 후 배정) + INDEX row 추가만 산출한다. production LOC 0. ADR 은 다음을 **결정(decide)** 하되 구현하지 않는다(구현은 후속 slice).

- [ ] **(1) repo source 정책 결정** — README L16-18 의 두 모드("지정 org 전체 Repository" / "지정 Repository")를 어떻게 표현할지 결정: (모드 A) org 전체 = `GithubInstanceClient.requestAllPagesForInstance("orgs/{org}/repos")` API enumerate(기존 wrapper 재사용, 새 dep 0), (모드 B) 지정 repo = env allowlist(`GITHUB_<KEY>_REPOS` 류, ADR-0017 패턴, schema 0). 두 모드의 결합 규칙(allowlist 있으면 그것만, 없으면 org 전체 enumerate 등) 명문화. **DB allowlist(schema 변경 = §5 게이트)는 README 충족에 불필요하므로 Alternatives 에서 기각 근거 명시**.
- [ ] **(2) Person → instance/org 매핑 결정** — 한 Person 의 `ServiceIdentity[]`(service/externalId)에서 어느 GitHub instance config(com/sec/ecode)·org 를 enumerate 대상으로 삼을지의 매핑 위상 결정. ServiceIdentity.service ↔ GITHUB_INSTANCES key 대응 규칙 + 매칭 instance 부재 시 skip 정책 명시. raw token/secret 미접근 invariant(§9) 보존 명시.
- [ ] **(3) Confluence instance enumerate 결정** — `ConfluenceCollectionSpec.instances` 를 Person 으로부터 산출하는 위상(전체 활성 instance vs ServiceIdentity 기반 필터) + SPACE allowlist 는 traversal service 내부 책임이므로 enumerate scope 밖임을 명시.
- [ ] **(4) since 통합 지점 결정** — ADR-0029 §5(직전 Assessment → since 도출, slice vi)와 본 enumerate 의 경계 — enumerate 가 since 를 산출하는지 아니면 slice vi 가 주입하는지의 책임 경계 명시(중복 결정 회피).
- [ ] **(5) collectForPerson 진입 계약 결정** — `collectForPerson(person, since?): Promise<CollectionSpec>` 또는 `Promise<Activity[]>` 중 enumerate 의 반환 위상(spec 산출까지인지 orchestrator 호출까지인지) 결정 + 후속 구현 slice 의 cap(≤300 LOC) 분할 가능성 명시.
- [ ] **(6) Testing posture 재확인** — 구현 slice 는 mocked-adapter unit test 필수(R-112: happy/error/branch/negative 충분 cover + coverage line ≥80% / function ≥80%) + live enumerate(실 org repo API round-trip)는 Q-0025 대로 UI 이후 deferred 를 Consequences·Out of Scope 양쪽에 명시.
- [ ] ADR frontmatter status = PROPOSED, INDEX.md(또는 docs/decisions ADR 목록 문서)에 본 ADR row 추가.
- [ ] `pnpm lint && pnpm build` 통과(doc/ADR-only 변경이라 production test 영향 0이나 R-110 대로 tester 가 lint/build 확인). 분기 있는 production 코드 0 → R-112 happy/error/branch/negative/coverage 항목은 본 ADR-only task 에 **해당 없음**(분기 없음 — 이 항목 생략, 구현 slice 에서 강제).

## Out of Scope

- **enumerate 구현 코드**(`collectForPerson` 실 구현 / repo enumerate loop / Person→instance 매핑 함수) — 본 task 는 ADR 결정만, 구현은 후속 slice(v-b2 impl).
- **env allowlist parser 코드**(`GITHUB_<KEY>_REPOS` 류 실 파싱) — 결정만 박제, 구현은 후속 slice.
- **since 도출 로직**(slice vi, ADR-0029 §5) — 본 ADR 은 enumerate 와의 경계만 결정, 도출 구현은 별개.
- **DB schema 변경 / 새 entity**(repo allowlist 를 DB 로 영속하는 option) — README 충족에 불필요 + §5 schema 게이트라 Alternatives 기각 근거만, 채택 0.
- **live/credentialed enumerate**(실 GitHub org repo API round-trip) — Q-0025 대로 UI 이후 deferred.
- **새 외부 dependency / 새 credential / 새 master key** — 본 ADR 은 기존 wrapper(requestAllPagesForInstance) + 기존 env config 패턴만 재사용.
- **modules.md / data-model.md 동기 갱신** — 본 ADR 머지 후 별도 direct doc-sync(필요 시 Follow-up).

## Suggested Sub-agents

`architect → tester`

architect 가 ADR 본문(6 결정 + Consequences + Alternatives)을 작성하고 INDEX row 를 추가한다. tester 는 R-110 대로 `pnpm lint && pnpm build` 통과를 확인한다(doc-only 라 추가 unit test 0).

## Follow-ups

(생성 시 비어있음 — sub-agent 가 관련 작업 발견 시 추가)
