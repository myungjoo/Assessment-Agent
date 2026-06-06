---
id: T-0266
title: modules.md AssessmentCollectionModule row 를 enumerate chain wiring 으로 doc-sync
phase: P4
status: DONE
commitMode: direct
coversReq: [REQ-005, REQ-006, REQ-007, REQ-008]
estimatedDiff: 12
estimatedFiles: 1
created: 2026-06-06
plannerNote: P4 collection — T-0265/T-0264 Follow-up; modules.md row40 enumerate chain(4 service)+collectForPerson 진입 stale → merged reality 정합(direct doc-only)
---

# T-0266 — modules.md AssessmentCollectionModule row 를 enumerate chain wiring 으로 doc-sync

## Why

T-0264(collectForPerson 진입 service, PR-227) + T-0265(enumerate chain 4 service 의 module 배선, PR-228, merge 0356fc0)로 ADR-0030 §5 enumerate chain 이 코드/DI 상 완성됐다. 그러나 `docs/architecture/modules.md` 의 AssessmentCollectionModule row(line 40)는 아직 T-0254 시점(4 service: GithubCollectionService / ConfluenceCollectionService / CollectionOrchestratorService / CollectionPersistenceService)에 머물러 있고 본문이 명시적으로 "enumerate(Person→`CollectionSpec`)·incremental since 는 후속 slice" 라고 적혀 있어 merged reality 와 어긋난다(stale). 본 task 는 그 row 1줄을 머지된 8-service 배선 + `collectForPerson` 진입 계약(buildCollectionSpec→collect→author 필터→persist)으로 정합한다. T-0265 / T-0264 Follow-up 에 명시된 별도 direct doc-sync 항목이다.

## Required Reading

- `docs/architecture/modules.md` — 특히 line 40 의 AssessmentCollectionModule row(현재 4 service 만 반영, "enumerate·since 후속 slice" 표기) + line 3 의 머리말(T-0255 정합 이력) + line 60/105/143/167 의 collection 관련 mermaid/의존성 행(이 행들은 의존 방향만 다루므로 갱신 불요인지 확인용)
- `src/assessment-collection/assessment-collection.module.ts` (origin/main) — 현재 providers 8개(GithubCollectionService / ConfluenceCollectionService / CollectionOrchestratorService / CollectionPersistenceService / GithubOrgEnumerateService / GithubCollectionSpecService / CollectionSpecService / CollectionEntryService) + exports 5개(앞 4 + CollectionEntryService). enumerate chain leaf 의존 GithubInstanceClient 는 기존 GithubModule import 로 닫힘(새 import 0)
- `docs/decisions/ADR-0030-assessment-collection-enumerate.md` (origin/main) §5 Implementation slices + `collectForPerson(person, since?)` 진입 계약 — buildCollectionSpec(순수 산출) → CollectionPersistenceService.collectAndPersist(spec, assessmentId) 호출, since 는 주입(도출 안 함)

## Acceptance Criteria

- [ ] `docs/architecture/modules.md` line 40 의 AssessmentCollectionModule row "구성" 문장이 merged 8-service 배선을 반영한다 — 기존 4 service(GithubCollectionService / ConfluenceCollectionService / CollectionOrchestratorService / CollectionPersistenceService)에 더해 enumerate chain 4 service(`CollectionEntryService`[collectForPerson 진입] / `CollectionSpecService` / `GithubCollectionSpecService` / `GithubOrgEnumerateService`)와 그 출처 task(T-0264 / T-0265, ADR-0030)를 명시.
- [ ] 같은 row 에 `collectForPerson(person, since?)` 진입 계약 한 줄 박제 — buildCollectionSpec(Person→CollectionSpec 순수 산출) → collect(orchestrator aggregate) → author 귀속 필터(ServiceIdentity.externalId) → persist(CollectionPersistenceService) 4단계 조립. since 는 enumerate 가 주입받아 pass-through(도출 안 함, slice vi 책임)임을 명시.
- [ ] 기존 row 의 stale 문구 "enumerate(Person→`CollectionSpec`)·incremental since 는 후속 slice" 를 "enumerate(collectForPerson) 완료(T-0264/T-0265). incremental since 도출(slice vi)·live/credentialed 수집은 후속" 식으로 정정 — enumerate 가 done 임을 반영하되 since 도출 / live 는 여전히 후속임을 유지.
- [ ] line 3 머리말의 정합 이력에 본 task(T-0266, enumerate chain reconcile) 한 줄 append — T-0255 가 10번째 module 을 정합한 뒤 enumerate chain wiring 을 본 task 가 정합했다는 추적.
- [ ] ADR-0030 의 enumerate 가 새 module/component 를 추가하지 않음(기존 AssessmentCollectionModule 내부 service 추가일 뿐) 확인 — component↔module N:N mapping(line 189/196 "8 component → 10 module")과 mermaid 노드(line 60)는 변경 불요, 건드리지 않는다.
- [ ] 변경 후 markdown 표 구조가 깨지지 않음(파이프 컬럼 정합) — 육안 또는 렌더 확인.

## Out of Scope

- `src/` 코드 변경 일절 금지 — 본 task 는 순수 문서 정합(direct doc-only). module.ts / service 코드는 이미 머지됨(0356fc0).
- 새 ADR 작성 금지(ADR-0030 이미 ACCEPTED, 신설 불요).
- modules.md 의 다른 module row(AssessmentModule 등) 변경 금지 — AssessmentCollectionModule row + line 3 머리말만.
- mermaid 노드 / component↔module mapping 표(line 189/196) / 의존성 acyclic 표(line 167) 변경 금지 — enumerate 는 module 내부 service 추가라 module-level 위상 불변.
- slice vi(since 도출) / live·credentialed 수집 관련 신규 task 생성 금지 — 본 task 는 doc-sync 1건만. 후속은 Follow-ups 에 기록.
- `docs/PLAN.md` / `docs/STATE.json` / journal 변경 금지(STATE/journal 은 driver bookkeeping 책임).

## Suggested Sub-agents

`implementer`만 (direct doc-only — tester 불요: R-110 은 direct-mode doc-only commit 을 면제). driver 가 직접 Edit 해도 무방.

## Follow-ups

- slice vi (T-0267): 직전 Assessment → since 도출 service (collectForPerson 의 since 인자 소비처).
- 호출처 결선: scheduler/manual trigger(P5 평가 진입)가 collectForPerson 을 호출하며 assessmentId 주입 — P5/P7 경계 + Assessment row 생성 주체 결정 필요(ADR-worthy, defer).

## 완료 기록

- DONE 2026-06-06 (loop@AKIHA-s68 turn 10 FINAL). direct doc-sync content commit `770a314`(modules.md row40 8-service 배선 + collectForPerson 진입 계약 + line3 머리말 정합). reviewer/PR 불요(direct doc-only, R-110 tester 면제). +2/-2, 1 파일.
