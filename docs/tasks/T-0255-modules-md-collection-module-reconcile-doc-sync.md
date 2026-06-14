---
id: T-0255
title: modules.md row 9 수집/평가 분리 reconcile + AssessmentCollectionModule(10번째 module) 박제 + ADR-0029 L37 import 토폴로지 정정 (ADR-0029 slice vii)
phase: P4
commitMode: direct
coversReq: [REQ-005, REQ-006, REQ-007, REQ-008, REQ-015, REQ-031, REQ-033]
estimatedDiff: 70
estimatedFiles: 2
created: 2026-06-06
status: DONE
completedAt: 2026-06-06T16:50:00+09:00
commit: f766837
result: direct doc-sync f766837 (loop@AKIHA-s67 t5). modules.md 9→10 module reconcile(AssessmentCollectionModule row + AssessmentModule 수집/평가 분리 + mermaid 노드·edge + topological order + acyclic 금지 행 + components mapping Worker 1:2 + 카운트) + ADR-0029 L37 import 토폴로지 collection→user 정정(T-0254 reviewer MINOR-1 closeout). +25/-15, 2 파일, 코드 변경 0(R-110 면제).
plannerNote: P4 ADR-0029 slice vii doc-sync(direct) — modules.md 10번째 module(AssessmentCollectionModule) 박제 + row 9 수집/평가 분리 reconcile + ADR-0029 L37 collection→user 정정(reviewer MINOR-1 closeout). doc-only inline-amend ×0.64
---

# T-0255 — modules.md row 9 수집/평가 분리 reconcile + AssessmentCollectionModule 박제 + ADR-0029 L37 정정 (ADR-0029 slice vii)

## Why

ADR-0029 Decision §1 은 P4 수집(collection) 책임을 신설 `AssessmentCollectionModule` 로 분리하고, modules.md row 9 `AssessmentModule` 의 평가(P5) orchestration 의도와의 reconcile 을 별도 direct doc-sync task(Follow-up vii)로 deferred 했다. 그 사이 수집 backbone(T-0248~T-0254)이 6 slice 전부 머지되며 `AssessmentCollectionModule` 은 `src/assessment-collection/` 에 실재하고 `app.module.ts` 에도 이미 배선됐다(T-0251, L39) — 그러나 [docs/architecture/modules.md](../architecture/modules.md) 는 여전히 "9 module" 로 박제돼 있고 10번째 shipped module 인 `AssessmentCollectionModule` 이 module 목록·의존성 그래프·acyclic 검증·components↔modules mapping 어디에도 없다. 이는 architecture 인덱스의 실재하는 doc-drift 다.

추가로 ADR-0029 L37 은 import 방향을 "collection → adapter / persistence" 로 박제했으나, 실 DI edge 는 `CollectionPersistenceService` 가 `ContributionService`(UserModule export)를 주입하므로 **collection → user** 다(T-0254 reviewer MINOR-1 catch — DI-부정확 표기). 본 task 는 이 두 doc-drift 를 함께 닫아 후속 enumerate slice(v-b2)가 의존할 정확한 module view 를 정합한다. 순수 문서 정합(direct)이며 코드 변경 0(§5 미발화).

## Required Reading

- `docs/architecture/modules.md` — 갱신 대상. 특히 (a) L3 의 "9 번째 shipped module" 표현 + 본문의 "9 module" 카운트, (b) L26~43 "Module 목록" 표(9 row — `AssessmentModule` row 9 포함), (c) L45~114 mermaid 의존성 그래프, (d) L124~141 topological order + acyclic 검증, (e) L171~186 components↔modules mapping 표(Worker N:1 → AssessmentModule 등). 본 task 는 이 5 지점에 10번째 module 을 반영하고 `AssessmentModule` row 의 책임을 수집/평가 분리로 reconcile.
- `docs/decisions/ADR-0029-assessment-collection-orchestrator.md` — 특히 L37(import 방향 "collection → adapter / persistence" → 실 edge "collection → user / adapter" 로 정정) + L39(modules.md row 9 reconcile 을 본 doc-sync task 로 deferred 명시 — 본 task 가 그 deferred 를 수행). Decision §1 의 module 배치 결정이 본 reconcile 의 source.
- `src/assessment-collection/assessment-collection.module.ts` — `AssessmentCollectionModule` 의 실제 imports(`GithubModule` / `ConfluenceModule` / `UserModule`) + providers/exports(github/confluence collection service, orchestrator, persistence service). modules.md 신규 row 의 "주요 dependency" 와 mermaid edge 의 source of truth.
- `src/app.module.ts` — L39 `AssessmentCollectionModule` 이 이미 AppModule imports 에 등록됨(배선 완료 확인 — modules.md "AppModule 이 N module 을 imports" 카운트 갱신 근거).
- `src/assessment-collection/collection-persistence.service.ts` — `CollectionPersistenceService` 가 `ContributionService`(user) 를 주입 → import edge 가 collection → user 임을 보이는 근거(ADR-0029 L37 정정의 fact).

## Acceptance Criteria

- [ ] `docs/architecture/modules.md` Module 목록 표에 `AssessmentCollectionModule` row 1개 추가 — 책임 1~2줄(GitHub/Confluence adapter 위에서 활동[commit/PR/issue/page] 수집 → `Activity` 매핑 → dedup → `Contribution` 영속화, 평가는 P5 별개), 주요 dependency(`GithubModule` / `ConfluenceModule` / `UserModule` — ContributionService 영속화 경유), 관련 component(Worker 수집 부분), 관련 REQ(REQ-005~008 / REQ-015 / REQ-031~033), 관련 ADR(ADR-0029). 실제 module 의 imports 와 일치하게 박제.
- [ ] `AssessmentModule` row(row 9) 책임을 **수집/평가 분리로 reconcile** — row 9 의 orchestration 의도가 P5 평가(evaluation) 책임임을 명시하고, P4 수집(collection)은 신설 `AssessmentCollectionModule` 이 담당함을 1줄로 cross-reference(ADR-0029 Decision §1 근거 인용). row 9 의 기존 dependency/REQ 표기는 평가 책임 기준으로 유지.
- [ ] modules.md 본문의 module **카운트 정합** — "9 module" / "9 번째 shipped module"(L3 등) 표현을 10 module 현실로 갱신(예: "10 module", `AssessmentCollectionModule` 추가 박제 문구). 카운트가 등장하는 모든 지점(개요·Module 목록 도입부·acyclic 검증·components mapping 결론부) 일관 갱신.
- [ ] modules.md mermaid 의존성 그래프에 `assessmentCollection["AssessmentCollectionModule"]` 노드 + `app --> assessmentCollection` + `assessmentCollection --> github` + `assessmentCollection --> confluence` + `assessmentCollection --> user` edge 추가(실 imports 정합). edge 방향이 단방향(collection → adapter/user, 역방향 0)이라 cycle 미발생함을 확인.
- [ ] modules.md acyclic 검증의 topological order 에 `AssessmentCollectionModule` 위치 반영 — `GithubModule`/`ConfluenceModule`/`UserModule` 이 모두 인스턴스화된 이후(= UserModule 다음, AssessmentModule 과 동급 domain layer)에 위치하며, DAG(cycle 0) 유지가 깨지지 않음을 1줄로 박제.
- [ ] modules.md components↔modules mapping 표에서 Worker(평가 파이프라인) 또는 Backend API mapping 에 `AssessmentCollectionModule`(수집 service layer) 을 반영 — 수집은 `AssessmentCollectionModule`, 평가는 `AssessmentModule` 로 책임 분리됨을 mapping 비고에 명시.
- [ ] `docs/decisions/ADR-0029-assessment-collection-orchestrator.md` L37 import 토폴로지 표기 정정 — "import 방향 = collection → adapter / persistence" 를 실 DI edge 인 "collection → adapter(GithubModule/ConfluenceModule) + collection → user(ContributionService 영속화 경유 UserModule)" 로 정정. `CollectionPersistenceService` 가 `PersistenceModule` 이 아닌 `UserModule`(ContributionService export) 을 import 하는 fact 를 1줄 반영(reviewer MINOR-1 closeout). 정정은 inline edit 최소 범위(L37 해당 문장만) — Decision §1 의 다른 결정 본문은 불변.
- [ ] (선택) ADR-0029 L39 의 "reconcile 은 별도 direct doc-sync task(Follow-up vii)" 문구에 본 task ID(T-0255)를 박제해 deferred 가 닫혔음을 추적 가능하게(필요 시).
- [ ] 코드 변경 0 — `src/` / `prisma/` / `test/` / `.github/` 무수정. direct doc-only 정합이라 `pnpm test`/CI 불요(R-110 doc-only 면제).

## Out of Scope

- **slice v-b2 / enumerate** — `collectForPerson(person, since?)` 진입점 + Person 의 ServiceIdentity 별 GitHub instance×org×repo / Confluence instance 를 `CollectionSpec` 으로 산출하는 로직. ServiceIdentity 가 `service`+`externalId` 만 보유(prisma schema L237-254 확인, org/repo 부재)라 GithubRepoSource 의 org/repo source 가 ADR-0029 미정의 → 별도 ADR-first 설계 결정 선행 필요. 본 doc-sync task 밖.
- **slice vi / incremental since** — 직전 Assessment → since 도출. 별도 slice.
- **새 ADR 작성·기존 ADR Decision 본문 변경** — 본 task 는 ADR-0029 의 L37 import-토폴로지 **표기 정정**(DI fact 정합)만 하며 어떤 Decision 도 reverse/추가하지 않는다. 새 architecture 결정이 필요하면 별도 ADR task(pr-mode)로 escalate.
- **app.module.ts 배선 확인·수정** — 이미 T-0251 에서 배선됨(L39). 본 task 는 그 사실을 modules.md 카운트에 반영만 하고 코드 무수정.
- **modules.md 의 다른 row(AuthModule/PersistenceModule/Llm 등) 책임 재서술** — 본 task 는 `AssessmentCollectionModule` 신규 row + `AssessmentModule` row reconcile + 카운트/그래프/acyclic/mapping 의 그에 따른 최소 정합만. 무관 row 는 불변.
- live/credentialed 수집 문서화 — Q-0025 대로 UI 이후 deferred. 본 task 는 module view 구조 정합만.

## Suggested Sub-agents

(없음 — direct doc-only. driver 가 직접 modules.md + ADR-0029 inline 정합을 commit. architect/implementer/tester 미호출.)

## Follow-ups

(생성 시 비어 있음.)
