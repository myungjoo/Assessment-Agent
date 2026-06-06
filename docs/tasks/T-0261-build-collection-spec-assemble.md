---
id: T-0261
title: ADR-0030 §5 enumerate slice ii-b2b — buildCollectionSpec(person, since?) 조립(GithubCollectionSpec + Confluence resolve → CollectionSpec)
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-005, REQ-006, REQ-007, REQ-008, REQ-015, REQ-024]
estimatedDiff: 265
estimatedFiles: 2
created: 2026-06-06
plannerNote: "P4 ADR-0030 §5 cap-split slice ii-b2b — buildCollectionSpec 전체 조립(T-0260 GithubCollectionSpec + resolveConfluenceInstances → CollectionSpec). resolveConfluenceInstances 기존 함수 호출만."
---

# T-0261 — ADR-0030 §5 enumerate slice ii-b2b — buildCollectionSpec(person, since?) 조립(GithubCollectionSpec + Confluence resolve → CollectionSpec)

## Why

ADR-0030 §5 cap-split 의 slice ii(`buildCollectionSpec`)는 (i) `_REPOS` env parser(T-0257 머지), (ii-a) mode B allowlist 순수 매칭(T-0258 머지, `resolveGithubRepoSources`), (ii-b1) mode A org→repo async enumerate(T-0259 머지, `GithubOrgEnumerateService.enumerateRepoSources`), (ii-b2a) GitHub-only `buildGithubCollectionSpec`(T-0260 머지, `GithubCollectionSpecService.buildGithubCollectionSpec(person, since?): Promise<GithubCollectionSpec>`)까지 진행됐다. 남은 ii-b2b 는 **전체 `buildCollectionSpec(person, since?): Promise<CollectionSpec>`** — GitHub 쪽(T-0260 의 `GithubCollectionSpec`)과 Confluence 쪽(`resolveConfluenceInstances(env).instances` 로 채운 `ConfluenceCollectionSpec`)을 결합해 `CollectionSpec { github, confluence }`(orchestrator 입력 타입)을 산출하는 thin orchestration service 다. ADR-0030 §3 은 Confluence enumerate 를 "활성 instance 전체(`resolveConfluenceInstances(env)`)"로 결정했고, 그 함수는 `src/confluence/confluence-instance-config.ts` 에 **이미 존재**한다(재구현 0 — 호출만). main 대조 결과 `buildCollectionSpec` 전체 조립 진입점은 아직 0 이므로 본 slice 가 정당한 dependency-first 다음 단위다. README L15-18(GitHub 두 모드)·L19(Confluence) 와 REQ-005~008(GitHub)·REQ-015(Confluence)·REQ-024(Person ID 매칭)를 cover 한다. `collectForPerson` 진입 + 영속화 결선 + author 필터는 본 task 출력을 소비하는 후속 slice iii 책임이다.

## Required Reading

- `docs/decisions/ADR-0030-assessment-collection-enumerate.md` — §3(Confluence instance enumerate = `resolveConfluenceInstances(env)` 가 산출하는 전체 활성 instance config, SPACE scope 는 traversal service 책임이라 enumerate 밖), §4(since 는 enumerate 가 도출 안 하고 주입받아 pass-through), §5(cap 분할 — `buildCollectionSpec(person)` 별도 분리 명시), §6(testing posture — mocked-adapter unit, negative: 매칭 instance 부재 / 빈 입력 / since pass-through).
- `src/assessment-collection/github-collection-spec.service.ts` — T-0260 산출물. `GithubCollectionSpecService.buildGithubCollectionSpec(person: GithubCollectionSpecInput, since?): Promise<GithubCollectionSpec>`(async) + `GithubCollectionSpecInput { serviceIdentities: Pick<ServiceIdentity, "service">[] }`. 본 task 가 생성자 주입 + 호출해 `CollectionSpec.github` 를 획득(GitHub 결합 로직 재구현 금지 — 호출만).
- `src/confluence/confluence-instance-config.ts` L40-110 — `resolveConfluenceInstances(env: NodeJS.ProcessEnv): ConfluenceInstanceResolution { instances: ConfluenceInstanceConfig[]; rejected: string[] }`(sync 순수, **기존 함수 — 재구현 금지, import 후 호출만**). 본 task 는 `instances` 만 소비(`rejected` 진단은 사용 안 함)해 `ConfluenceCollectionSpec.instances` 를 채운다.
- `src/assessment-collection/confluence-collection.service.ts` L43-50 — `ConfluenceCollectionSpec { instances: ConfluenceInstanceConfig[] }`(본 task 가 채울 Confluence 쪽 타입).
- `src/assessment-collection/collection-orchestrator.service.ts` L45-60 — `CollectionSpec { github: GithubCollectionSpec; confluence: ConfluenceCollectionSpec }`(본 task 의 **산출 타입** — 이 타입을 그대로 조립해 반환). `@Injectable` service 구조·주석 톤 참고.
- `prisma/schema.prisma` `model ServiceIdentity {personId, service, externalId, isPrimary}` — 본 task 의 person 입력은 `serviceIdentities`(`Pick<ServiceIdentity, "service">[]` 이상)만 소비해 GitHub service 쪽에 그대로 전달한다. Prisma 타입은 `@prisma/client` 에서 import. author 귀속(`externalId` 필터)은 본 task 밖(slice iii).

## Acceptance Criteria

본 task 의 산출물은 `src/assessment-collection/collection-spec.service.ts`(async `@Injectable` service) + colocated `src/assessment-collection/collection-spec.service.spec.ts`(R-112 spec) 이다. `env` 주입 경계는 반드시 mock-injectable 해야 한다(T-0260 의 `@Optional() env = process.env` 패턴 mirror).

- [ ] **service(async)**: `CollectionSpecService`(또는 동등명) class 를 `@Injectable` 로 추가. `GithubCollectionSpecService`(T-0260)를 생성자 주입 + `env`(`NodeJS.ProcessEnv`)를 `@Optional` 주입(default `process.env`). `buildCollectionSpec(person, since?): Promise<CollectionSpec>` 메서드가 (a) `githubSpecService.buildGithubCollectionSpec(person, since)` 로 `GithubCollectionSpec` 획득(await), (b) `resolveConfluenceInstances(this.env).instances` 로 활성 Confluence instance config 배열 획득 → `{ instances }: ConfluenceCollectionSpec` 조립, (c) `{ github, confluence }: CollectionSpec` 반환.
- [ ] **Confluence enumerate 규칙(ADR-0030 §3)**: `ConfluenceCollectionSpec.instances` 는 `resolveConfluenceInstances(env).instances`(전체 활성 instance) 로 채운다 — Person→instance 매핑 없이 활성 instance 전체 대상(GitHub 과 달리 Confluence 는 instance 매핑이 약함, §3). `rejected` 진단은 본 task 가 사용하지 않는다. SPACE scope 는 traversal service 책임이라 본 task 는 SPACE 를 건드리지 않는다.
- [ ] **GitHub 위임**: GitHub 쪽 결합(mode B + mode A)은 `GithubCollectionSpecService`(T-0260)에 위임만 한다 — 본 service 는 그 결과(`GithubCollectionSpec`)를 받아 `CollectionSpec.github` 에 넣을 뿐 결합 로직을 재구현하지 않는다(T-0260 책임 경계 존중).
- [ ] **env 주입 경계**: `resolveConfluenceInstances` 가 읽는 `env` 는 생성자 `@Optional` 주입으로 mock 가능하게 한다(실 `process.env` 직접 하드참조 금지 — spec 이 임의 env map 으로 Confluence instance 를 구성해 실 env 의존 없이 테스트). GitHub 쪽 env 는 `GithubCollectionSpecService` 가 자체 보유하므로 본 service 는 Confluence resolve 용 env 만 주입받으면 된다.
- [ ] **person 입력 타입 + since pass-through**: person 입력은 `GithubCollectionSpecInput`(또는 그 super-set)을 그대로 GitHub service 에 전달. `since` 는 GitHub service 에 pass-through 만(도출 0 — slice vi). Confluence 쪽은 현 `ConfluenceCollectionSpec` 에 since 필드가 없으므로(traversal/도출은 slice vi/iii) since 를 Confluence instance 산출에 주입하지 않는다(현 타입 불변 — 단 JSDoc 에 "Confluence since 는 slice vi" 명시).
- [ ] happy-path test 1+: GitHub 매칭 instance + Confluence 활성 instance 가 모두 있는 입력 → `CollectionSpec.github`(`buildGithubCollectionSpec` mock 반환과 동일) + `CollectionSpec.confluence.instances`(resolve 된 instance 와 동일)가 올바르게 조립됨 + `buildGithubCollectionSpec` 가 person/since 로 호출됨을 mock 으로 검증 + `since` pass-through 확인.
- [ ] error/negative test 1+ **각각**(ADR-0030 §6 + 분기마다 cover): (a) GitHub 매칭 instance 부재(빈 `sources` 반환하는 GitHub service mock) → `CollectionSpec.github.sources` 빈 + Confluence 는 정상 조립(throw 0), (b) Confluence 활성 instance 0(`resolveConfluenceInstances` 가 빈 instances 반환하는 env map) → `CollectionSpec.confluence.instances` 빈 + GitHub 는 정상(throw 0), (c) 양쪽 모두 비어 있음(빈 serviceIdentities + Confluence env 없음) → `{ github: { sources: [] }, confluence: { instances: [] } }`(throw 0), (d) `buildGithubCollectionSpec` 가 throw(mock reject) 시 동작을 ADR-0030 §3 부분 가용성 원칙에 맞게 결정하고 test 로 cover(권장: GitHub service 는 이미 내부 흡수하므로 본 service 는 전파해도 무방하나 — 구현이 흡수 택 시 negative test 로 명시, 전파 택 시 그 동작을 test 로 명시), (e) since 미지정(undefined) → GitHub service 가 since undefined 로 호출됨, (f) since 지정 → GitHub service 가 그 since 로 호출됨.
- [ ] flow/branch cover: GitHub sources 존재 vs 빈 / Confluence instances 존재 vs 빈 / since 지정 vs 미지정 각 1+ test.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — `coverageThreshold.global` 강제.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과(tester 가 결과 확인 — R-110).
- [ ] colocated spec 위치: `src/assessment-collection/collection-spec.service.spec.ts`(NestJS convention + 기존 collection slice 의 colocated 패턴 정합). `GithubCollectionSpecService` 는 jest mock 객체 literal 로 주입(`Test.createTestingModule` 또는 직접 `new` — 단일 spec, 공유 helper 불요). env 는 임의 map literal 로 주입.

## Out of Scope

- **`resolveConfluenceInstances` 재구현** — `src/confluence/confluence-instance-config.ts` 에 **이미 존재**(sync 순수 함수). 본 task 는 import 후 호출만 한다 — 절대 재구현·수정 금지.
- **GitHub mode B+A 결합 로직** — T-0260(`GithubCollectionSpecService.buildGithubCollectionSpec`)에서 완결. 본 task 는 그 service 를 주입·호출만 한다(재구현 금지).
- **`collectForPerson` 진입 + 영속화 결선(`collectAndPersist`) + author 필터(`Activity.author === externalId`)** — slice iii. 본 task 는 `CollectionSpec` 산출까지만(영속화/귀속 0).
- **since 도출(직전 Assessment → since)** — slice vi(ADR-0029 §5). 본 task 는 since 를 주입받아 GitHub service 에 pass-through 만. Confluence since 통합도 slice vi/iii.
- **author 귀속 / Confluence Person→instance 매핑** — ADR-0030 §3 대로 Confluence enumerate 는 활성 instance 전체 대상이고 author 매칭은 slice iii. 본 task 는 Confluence 쪽에서 Person 매칭을 하지 않는다(활성 instance 전체를 그대로 spec 에).
- **실 네트워크 / 실 credential** — Q-0025 대로 deferred. 본 task 는 mock 주입 `GithubCollectionSpecService` + 임의 env map(Confluence resolve) 위에서만 unit-test(실 fetch 0 / 실 token 0).
- **module 배선 / DI provider 등록** — 본 service 를 `AssessmentCollectionModule` provider 로 등록하는 배선은 별도 micro-slice 또는 slice iii(`collectForPerson` service 화 시). 본 task 의 spec 은 `Test.createTestingModule` 로 service + mock(GitHub spec service)만 wiring. 단 standalone provider 즉시 등록이 cap 내 1~2 줄이고 module spec 회귀 비용이 작으면 포함 무방(구현 판단, reviewer 와 정합).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 추가)

- slice iii: `collectForPerson(person, since?)` 진입 + 영속화 결선(`collectAndPersist`) + author 필터(`Activity.author === externalId`).
- slice vi: since 도출(직전 Assessment → since) — GitHub/Confluence 양쪽 pass-through.
- module 배선: `buildCollectionSpec` chain service 들을 `AssessmentCollectionModule` provider 로 등록(별도 micro-slice 가능).
