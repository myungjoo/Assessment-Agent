---
id: T-0260
title: ADR-0030 §5 enumerate slice ii-b2a — buildGithubCollectionSpec(person, since?) 조립(mode B + mode A → GithubCollectionSpec)
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-005, REQ-006, REQ-007, REQ-008, REQ-024]
estimatedDiff: 250
estimatedFiles: 3
created: 2026-06-06
plannerNote: "P4 ADR-0030 §5 cap-split slice ii-b2a — GitHub-only buildGithubCollectionSpec(mode B+A 결합). Confluence+CollectionSpec 조립은 ii-b2b. T-0258/T-0259 산출 소비."
---

# T-0260 — ADR-0030 §5 enumerate slice ii-b2a — buildGithubCollectionSpec(person, since?) 조립(mode B + mode A → GithubCollectionSpec)

## Why

ADR-0030 §5 cap-split 의 slice ii(`buildCollectionSpec`)는 (i) `_REPOS` env parser(T-0257 머지), (ii-a) mode B allowlist 순수 매칭(T-0258 머지, `resolveGithubRepoSources` → `{ sources, orgEnumerateTargets }`), (ii-b1) mode A org→repo async enumerate(T-0259 머지, `GithubOrgEnumerateService.enumerateRepoSources(targets)` → `GithubRepoSource[]`)까지 진행됐다. 남은 ii-b2(전체 `buildCollectionSpec` 조립: GitHub mode B+A 결합 + Confluence `resolveConfluenceInstances` + `CollectionSpec` 조립)는 한 task 에 넣으면 cap(300 LOC / 5 파일)을 명백히 초과한다 — async service + GitHub 결합 + Confluence resolve + `CollectionSpec` 조립 + R-112 negative matrix(직전 T-0258/T-0259 가 spec 분량으로 363/388 LOC overshoot). 따라서 dependency-first 로 다시 쪼개 본 task(ii-b2a)는 **GitHub-only `buildGithubCollectionSpec` 단독** — Person 의 `ServiceIdentity[]` 와 활성 `GithubInstanceConfig[]`(env resolve)로부터 mode B(`resolveGithubRepoSources` 의 sync `sources`)와 mode A(`GithubOrgEnumerateService.enumerateRepoSources(orgEnumerateTargets)` 의 async source)를 결합해 단일 `GithubCollectionSpec { sources }` 를 산출한다. Confluence enumerate(`resolveConfluenceInstances`) + 전체 `CollectionSpec { github, confluence }` 조립은 본 task 출력을 소비하는 후속 slice ii-b2b 책임이다. README L15-18 의 두 모드(지정 repo / org 전체) 결합과 REQ-005~008(GitHub 활동 수집)·REQ-024(Person ID 매칭)를 cover 한다.

## Required Reading

- `docs/decisions/ADR-0030-assessment-collection-enumerate.md` — §1(repo source 결합 규칙: allowlist 있으면 allowlist 만, 없으면 org 전체 enumerate — instance 단위 독립), §2(Person→instance 매핑: GitHub 계열 `ServiceIdentity` 만 enumerate 대상, 매칭 instance 부재 skip), §5(cap 분할 + `buildCollectionSpec` 분리 가능 명시), §6(testing — negative 목록: 매칭 instance 부재 skip / allowlist 빈 → org enumerate fallback / since pass-through).
- `src/assessment-collection/domain/github-repo-source.ts` — T-0258 산출물. `resolveGithubRepoSources(instances, identities, since?): GithubRepoSourceResolution { sources, orgEnumerateTargets }`(sync 순수). 본 task 가 호출해 mode B `sources` + mode A 대상 `orgEnumerateTargets` 를 동시 획득.
- `src/assessment-collection/github-org-repo-enumerate.service.ts` — T-0259 산출물. `GithubOrgEnumerateService.enumerateRepoSources(targets: GithubOrgEnumerateTarget[]): Promise<GithubRepoSource[]>`(async). 본 task 가 생성자 주입 + `orgEnumerateTargets` 를 넘겨 mode A `GithubRepoSource[]` 획득.
- `src/assessment-collection/github-collection.service.ts` L50-66 — `GithubRepoSource {instanceKey, org, repo, since?}` + `GithubCollectionSpec { sources: GithubRepoSource[] }`(본 task 의 산출 타입).
- `src/github/github-instance-config.ts` — `resolveGithubInstances(env): GithubInstanceResolution { instances, rejected }` + `GithubInstanceConfig {key, host, orgs, repos, tokenEnc}`. 본 task 가 활성 GitHub instance 를 env 에서 resolve 해 `resolveGithubRepoSources` 의 `instances` 인자로 넘긴다(reject 진단은 사용 안 함 — `instances` 만 소비).
- `prisma/schema.prisma` L55-67(`model Person` — `serviceIdentities` relation), L237-254(`model ServiceIdentity {personId, service, externalId, isPrimary}`). 본 task 가 Person 의 `serviceIdentities` 를 `resolveGithubRepoSources` 의 `identities` 인자로 넘긴다. Prisma 타입은 `@prisma/client` 에서 import.
- `src/assessment-collection/collection-orchestrator.service.ts` L36-56 — `CollectionSpec { github: GithubCollectionSpec; confluence: ConfluenceCollectionSpec }`(ii-b2b 가 조립할 상위 타입). 본 task 는 `github` 쪽(`GithubCollectionSpec`)만 산출한다(전체 `CollectionSpec` 조립 안 함).
- `src/assessment-collection/confluence-collection.service.ts` L8-30, per-instance skip-and-continue 패턴 — 코드 스타일·주석 톤·`@Injectable` service 구조 참고(본 task 의 service 도 동형 NestJS service).

## Acceptance Criteria

본 task 의 산출물은 `src/assessment-collection/github-collection-spec.service.ts`(async `@Injectable` service) + colocated `src/assessment-collection/github-collection-spec.service.spec.ts`(R-112 spec) 이다. `env` 주입 경계(아래)는 구현 판단이나 반드시 mock-injectable 해야 한다.

- [ ] **service(async)**: `GithubCollectionSpecService`(또는 동등명) class 를 `@Injectable` 로 추가. `GithubOrgEnumerateService` 를 생성자 주입. `buildGithubCollectionSpec(person, since?): Promise<GithubCollectionSpec>` 류 메서드가 (a) 활성 GitHub instance 를 `resolveGithubInstances(env).instances` 로 resolve, (b) `resolveGithubRepoSources(instances, person.serviceIdentities, since)` 로 mode B `sources` + mode A `orgEnumerateTargets` 동시 획득, (c) `enumerateRepoSources(orgEnumerateTargets)` 로 mode A `GithubRepoSource[]` 획득(await), (d) mode B sources + mode A sources 를 결합(concat, 결정론적 순서 — mode B 먼저)해 `{ sources }: GithubCollectionSpec` 반환.
- [ ] **결합 규칙(ADR-0030 §1)**: mode B 와 mode A 는 instance 단위 독립이며(`resolveGithubRepoSources` 가 이미 instance 별로 allowlist 유무를 분기해 한쪽만 산출), 본 service 는 그 두 산출(B sources + A enumerate 결과)을 단순 결합만 한다 — instance 별 allowlist-vs-org 분기를 본 service 가 재판정하지 않는다(T-0258 책임 경계 존중).
- [ ] **env 주입 경계**: `resolveGithubInstances` 가 읽는 `env`(`NodeJS.ProcessEnv`)는 생성자/메서드 인자로 주입 가능하게 한다(예: `@Inject` 토큰 또는 메서드 파라미터 default `process.env`) — spec 이 임의 env map 으로 instance 를 구성해 실 env 의존 없이 테스트할 수 있도록. 실 `process.env` 직접 하드참조 금지(테스트 격리).
- [ ] **person 입력 타입**: Person 의 `serviceIdentities`(`Pick<ServiceIdentity, "service">[]` 이상)만 소비. 전체 Prisma `Person` row 가 아니어도 되도록 입력 타입을 좁혀도 무방(단 JSDoc 에 입력 contract 명시). author 귀속/필터(`Activity.author === externalId`)는 본 task 밖(slice iii).
- [ ] happy-path test 1+: mode B allowlist instance + mode A(빈 allowlist) instance 가 섞인 Person → mode B sources + mode A enumerate 결과가 올바르게 결합된 `GithubCollectionSpec.sources` 산출 + `enumerateRepoSources` 가 `orgEnumerateTargets` 로 호출됨을 mock 으로 검증 + `since` pass-through 확인.
- [ ] error/negative test 1+ **각각**(ADR-0030 §6 + 분기마다 cover): (a) 매칭 GitHub instance 부재 Person(빈 serviceIdentities 또는 unmatched service) → 빈 `sources`(enumerate 호출 0 또는 빈 targets, throw 0), (b) mode B-only(모든 매칭 instance 에 allowlist) → `orgEnumerateTargets` 빈 → `enumerateRepoSources` 가 빈 결과 반환(또는 호출 skip) → sources = mode B 만, (c) mode A-only(모든 매칭 instance allowlist 빈) → mode B sources 0, mode A enumerate 결과만, (d) `enumerateRepoSources` 가 throw(mock reject) → 본 service 의 처리(skip-and-continue 로 빈 mode A 흡수 vs 전파)를 ADR-0030 §1 부분 가용성 원칙에 맞게 결정하고 그 동작을 test 로 cover(권장: enumerate 실패는 mode A 빈 배열로 흡수, mode B sources 는 보존 — 단 enumerate service 가 이미 내부 per-target skip 하므로 throw 가능성은 낮음; 구현이 흡수 택 시 negative test 로 명시), (e) since 미지정(undefined) → 산출 source 의 since 도 undefined, (f) since 지정 → 모든 산출 source 에 since pass-through(mode B/A 둘 다).
- [ ] flow/branch cover: 빈 targets early(enumerate 호출 분기) vs non-empty / mode B 존재 vs 부재 / 결합 순서 각 1+ test.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — `coverageThreshold.global` 강제.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과(tester 가 결과 확인 — R-110).
- [ ] colocated spec 위치: `src/assessment-collection/github-collection-spec.service.spec.ts`(NestJS convention + 기존 collection slice 의 colocated 패턴 정합). `GithubOrgEnumerateService` 는 jest mock 객체 literal 로 주입(`Test.createTestingModule` 또는 직접 `new` — 단일 spec, 공유 helper 불요). env 는 임의 map literal 로 주입.

## Out of Scope

- **Confluence instance enumerate + 전체 `CollectionSpec` 조립** — `resolveConfluenceInstances(env)` → `ConfluenceCollectionSpec` 산출 + `CollectionSpec { github, confluence }` 조립은 slice ii-b2b(후속). 본 task 는 GitHub 쪽(`GithubCollectionSpec`)만 산출하고 Confluence·CollectionSpec 을 건드리지 않는다.
- **`collectForPerson` 진입 + 영속화 결선(`collectAndPersist`) + author 필터(`Activity.author === externalId`)** — slice iii. 본 task 는 영속화/귀속을 다루지 않는다(GitHub repo source 조립만).
- **mode B allowlist 매칭 로직** — T-0258(`resolveGithubRepoSources`)에서 완결. 본 task 는 그 함수를 호출만 한다(재구현 금지).
- **mode A org→repo enumerate 로직** — T-0259(`GithubOrgEnumerateService.enumerateRepoSources`)에서 완결. 본 task 는 그 service 를 주입·호출만 한다.
- **since 도출(직전 Assessment → since)** — slice vi(ADR-0029 §5). 본 task 는 since 를 주입받아 pass-through 만.
- **GitHub instance 결합 규칙 재판정** — instance 별 allowlist-vs-org 분기는 `resolveGithubRepoSources` 가 이미 수행(mode B `sources` + mode A `orgEnumerateTargets` 분리 반환). 본 task 는 두 산출을 결합만 한다.
- **실 네트워크 / 실 credential** — Q-0025 대로 deferred. 본 task 는 mock 주입 `GithubOrgEnumerateService` + 임의 env map 위에서만 unit-test(실 fetch 0 / 실 token 0).
- **module 배선 / DI provider 등록** — 본 service 를 `AssessmentCollectionModule` provider 로 등록하는 배선은 ii-b2b(전체 buildCollectionSpec service 화 시) 또는 별도 micro-slice. 본 task 의 spec 은 `Test.createTestingModule` 로 service + mock(enumerate service)만 wiring. 단 standalone provider 즉시 등록이 cap 내 1~2 줄이고 module spec 회귀 비용이 작으면 포함 무방(구현 판단, reviewer 와 정합).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 추가)

- slice ii-b2b: Confluence instance enumerate(`resolveConfluenceInstances`) + 전체 `buildCollectionSpec(person, since?)` 조립(`CollectionSpec { github, confluence }`).
- slice iii: `collectForPerson` 진입 + 영속화 결선(`collectAndPersist`) + author 필터.
- slice vi: since 도출(직전 Assessment → since).
