---
id: ADR-0029
title: Assessment collection orchestrator 설계 — 기존 GitHub·Confluence adapter 위의 활동 수집 → Activity → Contribution 영속화 (P4)
status: ACCEPTED (2026-06-06)
date: 2026-06-06
relatedTask: T-0247
supersedes: null
---

# ADR-0029 — Assessment collection orchestrator 설계 박제

> 본 ADR 은 **수집(collection) 설계 결정만** 박제하며 production code 0 LOC 다 — `AssessmentCollectionModule` 신설·`Activity` 도메인 모델·orchestration 계약·dedup·incremental since·`Activity` → `Contribution` 영속화 매핑·testing posture 의 7 결정을 **decide** 하되 구현하지 않는다. 구현은 task §Follow-ups 의 후속 slice (i)~(vii) 가 각각 ≤300 LOC / ≤5 파일 + mocked unit test 로 강제한다. 사용자가 [Q-0025](../STATE.json) 를 승인하며 "기존 adapter 를 사용하는 수집 orchestrator 구축 + live 테스트는 UI 이후로 deferred, mocked unit test 는 R-112 대로 필수" 로 결정한 것이 본 ADR 의 외력이다.

## Context

GitHub adapter (`src/github/`) + Confluence adapter (`src/confluence/`) 는 transport · instance routing · token JIT decrypt · permission-denied emit 까지 [ADR-0016](ADR-0016-github-adapter-http-transport-contract.md) / [ADR-0017](ADR-0017-github-instance-config-source.md) / [ADR-0018](ADR-0018-confluence-adapter-http-transport-contract.md) / [ADR-0019](ADR-0019-same-host-auth-restriction-for-pagination.md) 위에 milestone-3 에서 모두 박제됐다. 그러나 **자기 test 외 caller 가 0** 이다 — 활동을 실제로 수집해 `Contribution` 으로 영속화하는 orchestrator 가 없다. 두 single-instance wrapper 가 그 진입 primitive 다:

- `GithubInstanceClient.requestForInstance / requestAllPagesForInstance` ([src/github/github-instance-client.service.ts](../../src/github/github-instance-client.service.ts)) — instance key 1 개의 단일/다중 page REST 요청. config resolve → token JIT decrypt → `GithubAdapter` 위임. 반환은 `unknown` / `unknown[]` (endpoint 별 응답 shape parser 는 caller 책임으로 위임).
- `ConfluenceSpaceTraversalService.traverseInstance` ([src/confluence/confluence-space-traversal.service.ts](../../src/confluence/confluence-space-traversal.service.ts)) — 단일 instance 의 SPACE allowlist 순회 + `_links.next` cursor flatten + SPACE 단위 4xx skip-and-continue (`PermissionDeniedEmitter.emit`). 반환은 `SpaceTraversalResult[]` (`{ spaceKey, pages: unknown[] }`).

[modules.md](../architecture/modules.md) row 9 `AssessmentModule` 의 orchestration 의도(commit / 문서 / Confluence page → 평가 파이프라인)는 미구현이고 `app.module.ts` 에도 미배선이다. `AssessmentService` ([src/user/assessment.service.ts](../../src/user/assessment.service.ts)) 는 현재 CRUD-only (create / findById / findByPerson / remove) 로 orchestration 을 포함하지 않는다. 본 ADR 은 그 공백의 **수집 책임**을 설계 결정으로 채운다(평가 / scoring 은 P5, scheduler 는 P7 별개).

### 외력

- **[CLAUDE.md §5](../../CLAUDE.md)** — 새 외부 dependency / DB schema 변경(migration) 은 BLOCKED. 본 수집 설계는 Node 내장 fetch(기존 adapter) + 기존 `Contribution` entity 만 재사용하므로 새 dep · 새 credential · 새 migration 0.
- **REQ-005 / REQ-006 / REQ-007 / REQ-008**([docs/requirements.md](../requirements.md)) — GitHub 3 instance(com / sec / ecode) 활동(commit / PR / Issue) 수집 + 권한 부족 통지. 본 ADR 의 orchestration 계약이 그 enumerate 구조를 박제.
- **REQ-009 / REQ-010 / REQ-015**([docs/requirements.md](../requirements.md)) — Fork/Rebase/Meld 중복 제거 + 시간적 중복(earlier date 우선) + Confluence 지정 SPACE 문서 활동. 본 ADR 의 dedup 결정이 cover.
- **REQ-031**([docs/requirements.md](../requirements.md) L58) — 재수집 중복 방지 + 최근 1주 재수집 OK. dedup + incremental since 결정이 backbone.
- **REQ-032 (raw-not-stored invariant)**([data-model.md §4](../architecture/data-model.md)) — raw commit 본문 / 문서 본문 미저장. mapper 경계 결정(raw `unknown` → typed `Activity` → 영속화는 typed 필드만)이 본 invariant 를 application-layer 에서 보존.

## Decision

### (1) Module placement — 신규 `AssessmentCollectionModule` 신설 (수집 P4 / 평가 P5 분리)

**채택: 신규 `AssessmentCollectionModule` 신설**(기존 `AssessmentModule` 확장 미채택).

- `AssessmentCollectionModule` 은 `GithubModule` / `ConfluenceModule` / `PersistenceModule` 을 import 한다(import 방향 = collection → adapter / persistence, leaf adapter 가 collection 을 모르는 단방향 유지 — [modules.md acyclic 검증](../architecture/modules.md) 보존). `PermissionDeniedEmitter` port 는 기존 adapter 가 이미 보유하므로 collection module 은 emit 을 트리거만 하고 직접 영속화하지 않는다.
- `app.module.ts` 배선 지점: AppModule `imports` 에 `AssessmentCollectionModule` 추가(adapter module 들 뒤, topological order 상 `AssessmentModule` 과 동급 domain module).
- **modules.md row 9 `AssessmentModule` 의도와의 reconcile**: row 9 의 평가 orchestration(commit / 문서 → 평가 파이프라인 + 결과 조회 controller)은 **P5 평가(evaluation)** 책임으로 유지하고, 본 P4 **수집(collection)** 은 `AssessmentCollectionModule` 로 **분리**한다. 근거 — (i) 수집(P4)과 평가(P5)는 phase · 책임 · test 경계가 다르고, (ii) scheduler(P7)는 수집/평가 둘 다 trigger 하므로 둘을 한 module 에 묶으면 비대해진다, (iii) collection module 은 LLM gateway(`LlmModule`)를 import 하지 않아 의존성 표면이 작다. `AssessmentCollectionModule` 의 수집 결과(`Contribution` row)는 P5 평가 파이프라인이 read 하는 입력이 된다 — collection 은 평가에 feeding 하되 실행하지 않는다(§Out of Scope). modules.md row 9 의 동기 갱신은 별도 direct doc-sync task(Follow-up vii).

### (2) Activity 도메인 모델 — typed base + 2 변형 + raw→typed mapper 경계

**채택: typed `Activity` discriminated union(base + `GithubActivity` / `ConfluenceActivity`)** + **mapper layer 가 raw→typed 변환 책임을 단독 보유**.

- `Activity`(base) 공통 필드: `externalId`(commit SHA / page-id 등 source 고유 식별자) / `sourceType`(`"github" | "confluence"` discriminator) / `instanceKey`(com / sec / ecode 또는 Confluence instance key) / `author`(외부 service ID) / `timestamp`(활동 발생 시각, since/dedup 기준) / `metadata`(typed 보조 필드 — raw 본문 아님).
- `GithubActivity` extends: `repoRef`(org/repo) / `kind`(`"commit" | "pr" | "issue"`).
- `ConfluenceActivity` extends: `spaceRef`(SPACE key) / `version`(page version number).
- **mapper 경계**: raw `unknown[]`(adapter 반환) → `Activity[]` 변환은 **별도 mapper 함수 layer**(`github-activity.mapper` / `confluence-activity.mapper`, 순수 함수)가 단독 책임. orchestrator service 는 mapper 를 호출만 하고 raw shape 를 직접 parse 하지 않는다(SRP + unit-testable 경계).
- **REQ-032 raw-not-stored 보존**: mapper 는 raw 응답에서 **typed 필드만 추출**하고 raw body(commit message 전문 / page 본문 HTML 등)는 `Activity` 에 싣지 않는다 — raw `unknown` 객체는 매핑 직후 폐기(in-memory transient). 영속화 대상은 `Activity` 의 typed 필드를 거쳐 `Contribution` 의 참조 식별자(URL / SHA / version)만이며, raw 본문 컬럼은 schema 차원에 부재([data-model.md §4](../architecture/data-model.md)). `metadata` 는 raw 본문이 아닌 typed 보조값(예: PR title 길이 · 변경 파일 수 같은 평가 입력 메타)만 — raw quote 금지.

### (3) Orchestration 계약 — instance × org × repo / instance × SPACE loop + skip-and-continue 재사용

**채택: per-person collection entry + per-source skip-and-continue(기존 emit 재사용)**.

- 진입 계약(시그니처는 결정만, 구현은 Follow-up): `collectForPerson(person, since?): Promise<Activity[]>` — 한 Person 의 ServiceIdentity 별로 적용 가능한 instance 를 enumerate 한다. 내부적으로 GitHub 측은 instance(com / sec / ecode) × org × repo loop, Confluence 측은 instance × SPACE allowlist loop.
- **GitHub loop**: instance key 별 `GithubInstanceClient.requestAllPagesForInstance(key, path, query)` 재사용 — org/repo enumerate 후 commits / PRs / issues endpoint 를 query(`since` 포함, §5)로 호출 → raw `unknown[]` → `github-activity.mapper` → `Activity[]`.
- **Confluence loop**: instance 별 `ConfluenceSpaceTraversalService.traverseInstance(config)` 재사용 — SPACE allowlist 순회는 이미 service 내부 책임이므로 orchestrator 는 instance loop 만 추가 → `SpaceTraversalResult[]` → `confluence-activity.mapper` → `Activity[]`.
- **per-source skip-and-continue**: 권한 부족(4xx)은 **기존 permission-denied emit 을 재사용**한다 — Confluence 는 `ConfluenceSpaceTraversalService` 가 이미 SPACE 단위 skip + emit, GitHub 은 `GithubAdapter` 가 4xx→`PermissionDeniedEvent` emit. orchestrator 는 한 instance/repo/SPACE 의 권한 부족이 다른 source 수집을 막지 않도록(부분 가용성 우선) 각 source 호출을 독립 try/catch 로 감싸 skip-and-continue 한다. orchestrator 는 새 emit 경로를 만들지 않고 기존 port 만 통과시킨다.

### (4) Dedup 전략 — commit SHA(earliest-timestamp wins) / Confluence page-id + version(latest)

**채택:**

- **commit**: `externalId = SHA` 기준 dedup. 같은 SHA 가 Fork/Rebase/Meld 로 여러 repo/instance 에서 수집되면(REQ-009 / REQ-031) **earliest `timestamp` 가 승리**(시간적 중복 시 earlier date 우선) — 동일 SHA 의 중복 `Activity` 중 가장 이른 timestamp 의 1 개만 유지.
- **Confluence page**: `(page-id, version)` 기준 dedup. 같은 page-id 의 여러 version 이 수집되면 **latest version 만 유지**(문서의 최신 상태가 기여 단위).
- dedup 은 mapper 이후 `Activity[]` 수준의 in-memory 연산(별도 dedup helper, 순수 함수)으로 결정한다 — DB unique constraint(`Assessment @@unique([personId, period, scope, periodStart])`)와는 별개의 application-layer pre-persistence dedup.

### (5) Incremental "since" 전략 — 직전 Assessment 로부터 since 도출 (결정만, 구현 deferred)

**채택(결정만):** 한 Person 의 **직전 Assessment** 의 `periodStart`(또는 마지막 수집 경계 timestamp)로부터 `since` 를 도출해 adapter query(GitHub `since` param / Confluence `lastModified` 필터)에 전달한다. 직전 Assessment 가 없으면(신규 인원) since 미지정 = full collection(REQ-027 1 년치 lifecycle 정책은 P7 별개). 경계값(직전 Assessment 와 동일 timestamp · 미래 timestamp · 빈 결과)의 처리는 **구현 slice(Follow-up vi)에서 negative case 로 cover** — 본 ADR 은 "직전 Assessment → since 도출 → adapter query 전달" 의 위상만 결정하고, 도출 로직 구현은 별도 후속 slice 로 **deferred**(구현이 한 slice cap 을 넘을 수 있어 독립 task).

### (6) Activity → Contribution 영속화 매핑 — 기존 entity 필드 1:1

**채택:** `Activity` → 기존 `Contribution` entity([prisma/schema.prisma](../../prisma/schema.prisma), [data-model.md](../architecture/data-model.md))로 1:1 매핑(새 컬럼 / migration 0):

| `Contribution` 필드 | `Activity` source | 비고 |
| --- | --- | --- |
| `assessmentId` | (orchestrator 가 묶는 Assessment) | N Contribution → 1 Assessment aggregate |
| `sourceType` | `activity.sourceType` + `kind` | 예: `"github:commit"` / `"confluence:page"`(literal 구체화는 구현 slice) |
| `sourceUrl` | activity 의 외부 URL(repo/page permalink) | raw 본문 아님 — 참조 식별자 |
| `sourceRef` | `activity.externalId`(SHA / `page-id@version`) | 재수집 dedup key(REQ-031) |
| `difficulty` / `contributionScore` / `volume` | **P5 평가 결과** | 수집 시점엔 미정 — placeholder 또는 평가 후 채움(평가는 P5, §Out of Scope) |
| `createdAt` | `@default(now())` | row 영속 시각 |

수집(P4)은 `sourceType` / `sourceUrl` / `sourceRef` 등 **참조 식별 필드만 채우고**, `difficulty` / `contributionScore` / `volume`(평가 산출물)은 P5 평가 파이프라인 책임 — collection 은 평가에 feeding 하되 scoring 을 실행하지 않는다. 영속화는 기존 Contribution repository 재사용(Follow-up v).

### (7) Testing posture — mocked-adapter unit test 필수(R-112) / live·e2e 수집 deferred

**채택:**

- **mocked-adapter unit test 필수**: 모든 구현 slice(Follow-up i~vi)는 `GithubInstanceClient` / `ConfluenceSpaceTraversalService` / mapper / dedup / repository 를 jest mock 으로 주입한 **mocked unit test** 를 동반한다([CLAUDE.md §3.2 R-112](../../CLAUDE.md) — happy / error / branch / negative 충분 cover + coverage line ≥80% AND function ≥80%). 특히 skip-and-continue 분기 · dedup earliest/latest 분기 · since 경계값은 negative case 로 명시 cover. patch 아닌 신규 slice 라 regression test 의무는 없으나 분기 cover 는 강제.
- **live / e2e 수집 테스트는 UI 이후로 deferred**(사용자 Q-0025 결정): 실 GitHub / Confluence token 주입 + 실 endpoint round-trip 의 수집 e2e 는 본 effort 범위 밖이다. 근거 — 수집 결과를 사람이 검증하려면 UI(조회 화면)가 필요하고, UI 이전에 live 수집을 돌리면 검증 surface 가 없다. live adapter transport 자체는 [ADR-0021](ADR-0021-github-confluence-live-integration-test-contract.md)(env-gated live smoke)가 이미 별도로 cover 하므로, 본 effort 는 mocked unit 으로 orchestration 로직만 검증하고 live 수집은 UI phase 이후 별도 task 로 박제한다(§Consequences 에 재명시).

## Consequences

**positive**:

- 고립돼 있던 두 single-instance wrapper(`GithubInstanceClient` / `ConfluenceSpaceTraversalService`)가 첫 production caller 를 얻는다 — adapter 투자가 활동 수집으로 실현.
- 새 외부 dependency 0 · 새 credential 0 · 새 DB migration 0 — 기존 adapter / Contribution entity / `LlmApiKeyCipher` cipher 만 재사용하므로 [CLAUDE.md §5](../../CLAUDE.md) BLOCKED 게이트 미해당.
- 수집(P4) / 평가(P5) 의 module 분리로 의존성 표면이 작아지고 phase 경계가 코드에 반영된다.
- raw-not-stored invariant 가 mapper layer 에서 application-level 로 한 번 더 보존(schema-level + application-level 이중).

**negative / 한계**:

- `Contribution.difficulty` / `contributionScore` / `volume` 는 수집 시점에 미정 — P5 평가 전까지 placeholder 상태의 row 가 존재할 수 있다(P5 가 채우는 2-phase). 그 transient 상태의 표현(nullable vs placeholder)은 구현 slice 의 결정으로 남긴다.
- **live / credentialed 수집은 UI 이후로 deferred** — 본 effort 머지 후에도 실 GitHub / Confluence 에 도달하는 수집 e2e 는 존재하지 않는다(mocked unit + ADR-0021 의 adapter-level live smoke 만). 실 수집 동작의 end-to-end 검증은 UI phase 이후 별도 task 의 §5 credential 게이트 항목으로 남는다.
- incremental since 도출 로직은 본 ADR 에서 결정만 — 구현 slice(vi)에서 경계값 negative case 와 함께 구체화될 때 추가 설계 결정(timezone · 1 주 재수집 window)이 필요할 수 있다.

## Alternatives

- **(a) 기존 `AssessmentModule` 확장(수집+평가 동일 module)** — 미채택. 수집(P4)과 평가(P5)의 phase · 책임 · test · 의존성(LLM import 여부) 경계가 달라 한 module 이 비대해지고, scheduler(P7) trigger 시 책임 혼선. (1) 의 분리가 응집도 우위.
- **(b) raw 응답을 그대로 영속화 후 후처리** — 미채택. REQ-032 raw-not-stored invariant 정면 위반(별도 ADR 없이 raw column 금지, [data-model.md §4](../architecture/data-model.md) / [CLAUDE.md §5](../../CLAUDE.md)). mapper 가 typed 필드만 추출하는 (2) 가 invariant 보존.
- **(c) orchestrator 가 adapter 를 직접 호출(wrapper service bypass)** — 미채택. `GithubInstanceClient` / `ConfluenceSpaceTraversalService` 가 token JIT decrypt · SPACE 순회 · skip-and-continue 를 이미 캡슐화하므로 bypass 는 그 로직을 중복 구현. (3) 의 wrapper 재사용이 DRY + 보안 invariant(never-read-back) 보존.
- **(d) dedup 을 DB unique constraint 에만 위임** — 미채택. Fork/Rebase/Meld 의 earliest-timestamp wins(REQ-009)는 "어느 row 를 살릴지" 의 application 의미 결정이라 schema unique 만으로 표현 불가. (4) 의 pre-persistence in-memory dedup 이 필요.
- **(e) live 수집 e2e 를 본 effort 에 포함** — 미채택. 사용자 Q-0025 결정 + UI 부재로 검증 surface 가 없어 flaky/무의미. (7) 의 deferred 가 사용자 결정 정합.

## References

- [docs/tasks/T-0247-assessment-collection-orchestrator-adr.md](../tasks/T-0247-assessment-collection-orchestrator-adr.md) — 본 ADR 의 source task(7 결정 AC + Follow-ups i~vii).
- [docs/architecture/modules.md](../architecture/modules.md) — row 9 `AssessmentModule` orchestration 의도(본 ADR 이 수집/평가 분리로 reconcile) + GithubModule / ConfluenceModule / PersistenceModule.
- [docs/architecture/data-model.md](../architecture/data-model.md) — Assessment / Contribution entity 필드 + §4 raw-not-stored invariant.
- [docs/architecture/components.md](../architecture/components.md) — GitHub / Confluence Adapter / Worker component 경계.
- [docs/decisions/ADR-0016-github-adapter-http-transport-contract.md](ADR-0016-github-adapter-http-transport-contract.md) — GitHub transport(request / requestAllPages 반환 raw `unknown[]`).
- [docs/decisions/ADR-0017-github-instance-config-source.md](ADR-0017-github-instance-config-source.md) — instance config env source(com / sec / ecode 키).
- [docs/decisions/ADR-0018-confluence-adapter-http-transport-contract.md](ADR-0018-confluence-adapter-http-transport-contract.md) — Confluence transport + `_links.next` cursor.
- [docs/decisions/ADR-0021-github-confluence-live-integration-test-contract.md](ADR-0021-github-confluence-live-integration-test-contract.md) — adapter-level env-gated live smoke(본 ADR 의 수집 e2e deferred 와 별개 layer).
- [src/github/github-instance-client.service.ts](../../src/github/github-instance-client.service.ts) / [src/confluence/confluence-space-traversal.service.ts](../../src/confluence/confluence-space-traversal.service.ts) — 본 ADR orchestration 이 재사용하는 single-instance wrapper.
- [src/user/assessment.service.ts](../../src/user/assessment.service.ts) — 현 CRUD-only Assessment service(orchestration 미포함).
- [docs/requirements.md](../requirements.md) — REQ-005~010 / REQ-015 / REQ-031 / REQ-032 / REQ-059 source of truth.

Refs: T-0247, ADR-0016, ADR-0017, ADR-0018, ADR-0019, ADR-0021, REQ-005, REQ-006, REQ-007, REQ-008, REQ-009, REQ-010, REQ-015, REQ-031, REQ-032, REQ-059
