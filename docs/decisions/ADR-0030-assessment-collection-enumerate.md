# ADR-0030 — Assessment collection enumerate(v-b2) 설계 — Person → CollectionSpec 산출 + repo source 정책

- Status: ACCEPTED (T-0256)
- Date: 2026-06-06
- 관련 ADR: [ADR-0029](ADR-0029-assessment-collection-orchestrator.md)(collection orchestrator — 본 ADR 이 그 Decision §3 이 deferred 한 enumerate source 를 resolve), [ADR-0017](ADR-0017-github-instance-config-source.md)(GitHub instance env config — 본 ADR 의 repo allowlist 가 mirror 할 패턴), [ADR-0018](ADR-0018-confluence-adapter-http-transport-contract.md)(Confluence config shape)
- 관련 REQ: REQ-005~008(GitHub 활동 수집), REQ-015(Confluence), REQ-024(Person ID), REQ-031(재수집 dedup)

## Context

[ADR-0029](ADR-0029-assessment-collection-orchestrator.md) 가 결정한 collection backbone 의 mock-unit slice — typed `Activity` + raw→typed 매퍼(T-0248/T-0252), `GithubCollectionService` / `ConfluenceCollectionService`(T-0249/T-0250), `CollectionOrchestratorService`(aggregate, T-0253), `CollectionPersistenceService`(영속화, T-0254), `AssessmentCollectionModule` 배선 + modules.md doc-sync(T-0251/T-0255) — 가 전부 머지됐다.

그러나 두 collection service 와 orchestrator 는 **이미 산출된 `CollectionSpec`** 을 입력으로 받을 뿐이다:

- `GithubCollectionSpec { sources: GithubRepoSource[] }`, `GithubRepoSource { instanceKey, org, repo, since? }`
- `ConfluenceCollectionSpec { instances: ConfluenceInstanceConfig[] }`
- `CollectionSpec { github: GithubCollectionSpec; confluence: ConfluenceCollectionSpec }`

한 Person 으로부터 이 `CollectionSpec` 을 **enumerate** 하는 진입점(`collectForPerson`, ADR-0029 Decision §3 이 "instance×org×repo loop" 로만 언급)이 아직 0 이다. 그 enumerate 의 핵심 미정 결정은 **`GithubRepoSource` 의 `org` / `repo` 가 어디서 오는가** 다 — main 대조:

- `ServiceIdentity`(prisma schema) = `{ personId, service, externalId, isPrimary }` — **org/repo 정보 부재**, 외부 service 식별자(`externalId` = GitHub login 등)만 보유.
- `GithubInstanceConfig`([src/github/github-instance-config.ts](../../src/github/github-instance-config.ts)) = `{ key, host, orgs: string[], tokenEnc }` — `GITHUB_<KEY>_ORG` env 에서 온 **org 은 있으나 repo 는 없다**(ADR-0017).
- `GithubInstanceClient.requestAllPagesForInstance(key, path, query)` — `orgs/{org}/repos` 호출로 org 의 repo 목록을 enumerate 할 수 있는 기존 wrapper(새 caller 추가만, dep 0).

README [코드 평가 대상](../../README.md) L15-18 은 3 GitHub instance 각각에 대해 **"지정 Organization 내 전체 Repository, 혹은 지정 Repository"** 두 모드를 product 요구로 박제했다. 즉 무엇을 수집할지(org 전체 / 지정 repo)는 이미 정해져 있고, **어떻게 그 source 를 표현·산출할지** 만 본 ADR 이 결정한다(ambiguity 가 아닌 설계 결정). 본 ADR 은 후속 `collectForPerson` 구현 slice 가 inline architecture 결정을 끌어들이지 않도록 그 enumerate 위상을 선행 박제한다(CLAUDE.md §1 "코드보다 ADR이 먼저").

## Decision

### (1) repo source 정책 — env allowlist 우선, 없으면 org 전체 API enumerate

README 의 두 모드를 **GitHub instance config 의 per-key env 확장**으로 표현한다(ADR-0017 패턴 mirror):

- **모드 B(지정 repo, 우선)** — instance 별 `GITHUB_<KEY>_REPOS` env(comma/space-separated `org/repo` 또는 `repo` 토큰 allowlist). 존재하면 그 repo 만 수집 대상. `GithubInstanceConfig` 에 `repos: string[]`(빈 배열 = 미설정) 필드를 추가하고 `resolveGithubInstances` 가 `_REPOS` suffix 를 파싱하도록 확장(impl slice 책임; ADR 은 shape·suffix 만 박제). schema 변경 0 / 새 dep 0.
- **모드 A(org 전체, fallback)** — 해당 instance 의 `GITHUB_<KEY>_REPOS` 가 미설정(빈 배열)이면, 그 instance 의 각 org 에 대해 `GithubInstanceClient.requestAllPagesForInstance(key, "orgs/{org}/repos")` 로 repo 목록을 **런타임 enumerate** 한다(기존 wrapper 재사용, 새 caller 1 개 추가). 권한 부족(4xx) repo 는 기존 per-source skip-and-continue 로 흡수(ADR-0029 §3) — README L20 "접근 권한 부족 시 인식·대응" 은 기존 `PermissionDeniedEvent` emit 경로가 충족.

**결합 규칙**: allowlist 가 있으면 allowlist 만(org 전체 enumerate 안 함), 없으면 org 전체 enumerate. 두 모드는 instance 단위로 독립 — 같은 Person 의 instance A 는 allowlist, instance B 는 org 전체일 수 있다.

**DB allowlist(기각)** — repo allowlist 를 별도 entity/컬럼으로 DB 영속하는 안은 (i) schema migration 이 CLAUDE.md §5 HITL 게이트이고, (ii) README 요구 충족에 불필요하며(env config 로 충분), (iii) instance config 가 이미 env-source(ADR-0017)라 일관성을 깬다 — 채택하지 않는다(§Alternatives).

### (2) Person → instance/org 매핑 + author 귀속

- **instance 매핑** — 한 Person 의 `ServiceIdentity[]` 중 GitHub 계열(`service` 값이 GitHub instance 를 가리키는 것)을 `GITHUB_INSTANCES` key 와 대응시킨다. 대응 규칙: `ServiceIdentity.service` 가 instance key(또는 그 정규화형)와 매칭되는 instance config 만 enumerate 대상. **매칭되는 활성 instance config 가 없으면 그 ServiceIdentity 는 skip**(수집 0, throw 0) — 부분 가용성 우선(ADR-0029 §3). instance config(org/repo/token)는 env 에서 오고, Person 은 "어느 instance 에 계정이 있는가"(`ServiceIdentity`)만 제공한다.
- **org/repo scope** — 매칭된 instance config 의 `orgs`(+ 모드 (1)의 repo) 가 그 instance 의 수집 scope. org/repo 는 **instance config(env) 소유** 이지 Person 소유가 아니다 — 즉 같은 instance 의 org/repo scope 는 모든 Person 에 공통이고, Person 별 차이는 아래 author 귀속으로 표현된다.
- **author 귀속** — Person 의 기여만 평가 대상이므로 수집된 활동을 그 Person 에 귀속시켜야 한다. 귀속 key 는 `ServiceIdentity.externalId`(그 instance 에서의 GitHub login)다. 수집된 `Activity` 는 이미 `author` 필드를 보유하므로(매퍼 산출), **귀속/필터는 `Activity.author === externalId` 매칭으로 enumerate-호출처(또는 영속화 직전)에서 수행**한다. 이 방식은 collection service 시그니처를 불변으로 두어(T-0249/T-0250 mock-unit slice 안정) post-collection author 필터로 귀속한다. API-side `?author={login}` query 로 수집량을 줄이는 최적화는 collection service 확장이 필요하므로 **후속 최적화 slice 로 deferred**(본 ADR 은 귀속 key = externalId, default = post-collection 필터만 결정). `isPrimary` ServiceIdentity 우선순위는 author 매칭에는 무관(같은 instance 의 login 1 개) — 다중 GitHub identity 는 각 instance 별 externalId 로 독립 매칭.
- **§9 invariant 보존** — enumerate 는 instance config 의 `tokenEnc`(암호문)를 adapter 에 전달만 하고 직접 복호/노출하지 않는다(기존 JIT decrypt 경로 그대로). raw token/secret 미접근.

### (3) Confluence instance enumerate

- `ConfluenceCollectionSpec.instances` 는 **`resolveConfluenceInstances(env)` 가 산출하는 전체 활성 Confluence instance config** 로 채운다(ADR-0018 의 `CONFLUENCE_INSTANCES` + per-key shape). GitHub 과 달리 Confluence 는 Person→instance 의 1:1 service identity 매핑이 약하고(사내 단일/소수 instance), SPACE allowlist 가 instance config 에 이미 포함되므로, enumerate 는 활성 instance 전체를 대상으로 둔다.
- **SPACE scope 는 enumerate 밖** — SPACE allowlist 순회·page enumerate 는 `ConfluenceSpaceTraversalService` 내부 책임(ADR-0013/0018). enumerate 는 instance config 배열만 산출하고 SPACE 는 건드리지 않는다.
- **author 귀속** — GitHub 과 동형. Confluence Activity 의 `author`(accountId/username)를 Person 의 Confluence `ServiceIdentity.externalId` 와 매칭해 post-collection 귀속. 매칭 ServiceIdentity 부재 시 그 instance 의 Confluence 활동은 그 Person 에 귀속되지 않는다.

### (4) since 통합 지점 — enumerate 는 since 를 주입받는다(도출 안 함)

- `collectForPerson(person, since?)` 의 `since` 는 **호출처(또는 slice vi)가 주입** 한다. enumerate 자체는 직전 Assessment 를 조회해 since 를 도출하지 **않는다** — since 도출(직전 Assessment → since)은 ADR-0029 §5 의 slice vi 책임(중복 결정 회피).
- enumerate 는 주입받은 `since` 를 산출하는 모든 `GithubRepoSource.since` 와 Confluence 수집 query 에 **pass-through** 만 한다(GithubRepoSource 가 이미 `since?` 필드 보유 — 도출 0, 전달만).

### (5) collectForPerson 진입 계약 — `Promise<Contribution[]>`(영속화까지) + 내부 단계 분할

- `collectForPerson(person: Person, since?: string): Promise<Contribution[]>` — Person 을 받아 (a) ServiceIdentity→instance 매핑 + repo source enumerate 로 `CollectionSpec` 산출, (b) `CollectionPersistenceService.collectAndPersist(spec, assessmentId)` 호출까지 수행하고 영속화된 `Contribution[]` 반환. `assessmentId` 주입 경계는 호출처(scheduler/manual trigger, P5 평가 진입)가 결정한다.
- **반환 위상**: enumerate 는 `CollectionSpec` 산출(순수, mockable)과 영속화 호출(부수효과)을 한 service 에 둔다. 단 `CollectionSpec` 산출 로직(`buildCollectionSpec(person)`)은 **별도 순수 함수/메서드로 분리** 해 mock-adapter unit test 가 enumerate 위상만 독립 검증 가능하게 한다(repo enumerate API 호출은 mock 주입).
- **cap 분할** — 구현이 ≤300 LOC / ≤5 파일 cap 을 초과하면 (i) `_REPOS` env parser 확장 + `GithubInstanceConfig.repos` 필드, (ii) Person→instance 매핑 + repo source 산출(`buildCollectionSpec`), (iii) `collectForPerson` 진입 + 영속화 결선 + author 필터 의 3 slice 로 dependency-first 분할(planner 판단).

### (6) Testing posture

- 구현 slice 는 **mocked-adapter unit test 필수**(CLAUDE.md §3.2 R-112 — happy / error path / branch / negative cases 충분 cover, coverage line ≥ 80% AND function ≥ 80%). 특히 negative: 매칭 instance 부재 skip / allowlist 빈 → org enumerate fallback / org repo enumerate 4xx skip / author 불일치 활동 제외 / 빈 ServiceIdentity / since pass-through 경계.
- **live/credentialed enumerate**(실 GitHub `orgs/{org}/repos` API round-trip + 실 token)는 [Q-0025] 대로 **UI 이후 deferred** — 구현 slice 는 mock 주입 `GithubInstanceClient` 위에서만 unit-test, 실 네트워크 0 / 실 token 0. live 통합은 ADR-0021 의 env-gated skip-unless-credentialed 패턴으로 별도 task.

## Consequences

**긍정**:
- enumerate 의 모든 미정 위상(repo source / Person→instance 매핑 / author 귀속 / since 경계 / 진입 계약)이 코드보다 먼저 박제 — 후속 구현 slice 는 inline architecture 결정 0 으로 진행.
- 새 외부 dependency 0 / DB schema 변경 0 / 새 credential 0 — `_REPOS` env 확장 + 기존 `requestAllPagesForInstance` wrapper 재사용만. §5 HITL 미발화.
- collection service 시그니처 불변(post-collection author 필터) — T-0249/T-0250 mock-unit slice 안정 유지.

**부정 / trade-off**:
- 모드 A(org 전체)는 org 의 모든 repo·모든 author 활동을 수집한 뒤 author 필터하므로, 큰 org 에서 수집량이 비효율적일 수 있다. API-side `?author=` 최적화는 후속 slice 로 deferred(본 ADR 은 정확성 우선, 최적화 후행).
- repo allowlist·org 매핑이 env-source 라 운영 시 Person 추가/instance 추가가 env 변경(배포)을 요구한다. 향후 운영 편의가 필요하면 config UI / DB 전환을 별도 ADR 로 재검토(현 시점 README 충족에 env 로 충분).
- author 귀속이 `ServiceIdentity.externalId` 정확성에 의존 — 잘못된/누락된 ServiceIdentity 는 그 Person 의 활동을 누락시킨다(데이터 품질 문제는 Person 관리 책임, 본 enumerate 밖).

## Alternatives

- **(기각) DB repo allowlist entity** — repo scope 를 `RepoAllowlist` 같은 entity 로 DB 영속. 장점: 운영 시 배포 없이 변경. 단점: schema migration = §5 HITL 게이트 + instance config 가 이미 env-source(ADR-0017)라 이원화. README 충족에 불필요 → 기각. 운영 편의가 실제 병목이 되면 재검토.
- **(기각) Person 별 repo scope** — org/repo 를 Person 마다 다르게(ServiceIdentity 에 repo 컬럼 추가). schema 변경 + README 가 org/instance 단위 scope 를 요구하지 Person 단위 repo scope 를 요구하지 않음 → 기각. Person 별 차이는 author 귀속으로 충분.
- **(deferred, 기각 아님) API-side `?author=` 필터** — 수집 단계에서 GitHub commits API 의 `author` query 로 Person 활동만 수집. collection service 시그니처 확장 필요 → mock-unit slice 를 건드리므로 본 enumerate 와 분리, 정확성 확보 후 최적화 slice 로 도입.
- **(deferred) since 를 enumerate 가 도출** — enumerate 가 직전 Assessment 를 조회해 since 산출. ADR-0029 §5 가 이미 slice vi 책임으로 분리했으므로 중복 — enumerate 는 주입만.

## References

- [ADR-0029 — Assessment collection orchestrator](ADR-0029-assessment-collection-orchestrator.md) — 본 ADR 이 resolve 하는 Decision §3(enumerate source) / §5(since) 의 source.
- [ADR-0017 — GithubModule instance sub-config source](ADR-0017-github-instance-config-source.md) — `GITHUB_INSTANCES` + per-key env 패턴(본 ADR 의 `_REPOS` 확장이 mirror).
- [ADR-0018 — ConfluenceAdapter HTTP transport 계약](ADR-0018-confluence-adapter-http-transport-contract.md) — `CONFLUENCE_INSTANCES` config shape.
- [ADR-0021 — GitHub·Confluence live-integration TEST CONTRACT](ADR-0021-github-confluence-live-integration-test-contract.md) — live enumerate 의 env-gated 패턴.
- [README.md](../../README.md) L15-18 — "지정 Organization 내 전체 Repository, 혹은 지정 Repository" 두 모드 product 요구.
- [src/github/github-instance-config.ts](../../src/github/github-instance-config.ts) — `GithubInstanceConfig` + `resolveGithubInstances`(본 ADR 의 `repos` 필드·`_REPOS` 확장 대상).

Refs: T-0256, ADR-0029, ADR-0017, ADR-0018, ADR-0021, REQ-005, REQ-006, REQ-007, REQ-008, REQ-015, REQ-024, REQ-031
