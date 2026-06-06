---
id: T-0253
title: Assessment 수집 orchestrator service — 두 collection service 호출 → Activity[] aggregate (ADR-0029 slice v-b)
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-005, REQ-006, REQ-007, REQ-008, REQ-015, REQ-031]
estimatedDiff: 165
estimatedFiles: 3
created: 2026-06-06
status: DONE
completedAt: 2026-06-06T15:54:00+09:00
prNumber: 217
mergeCommit: 0e72bb6
result: PR-217 squash merge 0e72bb6 (loop@AKIHA-s67 t1). CollectionOrchestratorService + spec(11 test) + module 배선. reviewer APPROVE(1 MINOR=LOC justified), CI green, 4-게이트 PASS. 실제 diff +403/-13 (4 파일) — spec/주석 dominated, 핵심 logic ≈30 LOC. orchestrator coverage 100%.
plannerNote: P4 ADR-0029 slice (v-b) — orchestrator aggregate(영속화·Person enumerate 제외)만 큐잉; v-c 영속화/vi since 는 Follow-ups. R-112 backbone ×1.5, @unique 무관 P2002 미적용
---

# T-0253 — Assessment 수집 orchestrator service — 두 collection service 호출 → Activity[] aggregate (ADR-0029 slice v-b)

## Why

ADR-0029 Decision §3 은 한 수집 단위에 대해 GitHub 측(`GithubCollectionService`) + Confluence 측(`ConfluenceCollectionService`)을 호출해 `Activity[]` 로 모으는 orchestration 계약을 결정했다. 두 collection service(T-0249/T-0250) 와 module 배선(T-0251) 은 머지됐으나 **두 service 를 함께 호출해 단일 `Activity[]` 로 aggregate 하는 caller 가 아직 0** 이다. 이는 README REQ-005~008(GitHub 활동 수집) + REQ-015(Confluence 문서 활동) 을 한 진입점으로 묶는 backbone 이다.

slice (v) 전체(orchestrator entry + Person 의 instance×org×repo·SPACE enumerate + 두 collection service 호출 + 영속화)는 colocated spec 포함 시 ≤300 LOC / ≤5 파일 cap 을 초과하므로 T-0252 가 v-a(순수 매퍼)를 먼저 분리했다. 본 task 는 그 다음 **dependency-first 단위인 aggregate orchestrator**만 분리한다 — 두 collection service 를 inject 받아 호출하고 결과를 단일 `Activity[]` 로 모으는 service 1개 + module 배선. **Person enumerate(spec 산출) 와 Contribution 영속화는 본 task 밖**(아래 §Out of Scope) 으로 두어 cap 안에 둔다. orchestrator 는 v-a 매퍼를 아직 호출하지 않는다(매퍼 호출은 영속화 직전 단계인 v-c).

## Required Reading

- `docs/decisions/ADR-0029-assessment-collection-orchestrator.md` — 특히 Decision §1(Module placement — `AssessmentCollectionModule` 에 collection service 들이 배선됨) + Decision §3(Orchestration 계약 — per-person collection entry + GitHub instance×org×repo loop / Confluence instance×SPACE loop + per-source skip-and-continue). 본 task 는 §3 의 "두 source 를 호출해 `Activity[]` 로 모으는" 부분만 구현(enumerate·영속화는 deferred).
- `src/assessment-collection/github-collection.service.ts` — `GithubCollectionService.collectGithubActivities(spec: GithubCollectionSpec): Promise<GithubActivity[]>` 시그니처 + `GithubCollectionSpec { sources: GithubRepoSource[] }` shape. 본 orchestrator 가 호출할 대상.
- `src/assessment-collection/confluence-collection.service.ts` — `ConfluenceCollectionService.collectConfluenceActivities(spec: ConfluenceCollectionSpec): Promise<ConfluenceActivity[]>` 시그니처 + `ConfluenceCollectionSpec { instances: ConfluenceInstanceConfig[] }` shape. 본 orchestrator 가 호출할 대상.
- `src/assessment-collection/domain/activity.ts` — `Activity` discriminated union(`GithubActivity` / `ConfluenceActivity`). aggregate 결과 타입 `Activity[]` 의 구성 요소.
- `src/assessment-collection/assessment-collection.module.ts` — 본 task 가 새 orchestrator service 를 provider/export 로 추가할 module. 현재 두 collection service 를 import/provide/export 중. github.module.ts / confluence.module.ts 의 provider/export 패턴을 mirror.
- `src/assessment-collection/github-collection.service.spec.ts` — colocated spec 위치/스타일 + collection service mock 주입 패턴 참조(본 orchestrator spec 도 `src/assessment-collection/` 에 colocated, 두 collection service 를 jest mock 으로 주입).

## Acceptance Criteria

- [ ] `src/assessment-collection/collection-orchestrator.service.ts` 신설 — `@Injectable()` `CollectionOrchestratorService`. 생성자에 `GithubCollectionService` + `ConfluenceCollectionService` 를 inject. 헤더 주석에 ADR-0029 §3 근거 + 책임 경계(enumerate·영속화 제외) 박제.
- [ ] **aggregate 메서드**: `collectActivities(spec: CollectionSpec): Promise<Activity[]>` (또는 동등 시그니처) export — `spec.github`(GithubCollectionSpec) 와 `spec.confluence`(ConfluenceCollectionSpec) 를 받아 두 collection service 를 호출하고 결과 `GithubActivity[]` + `ConfluenceActivity[]` 를 단일 `Activity[]` 로 concat 반환. `CollectionSpec` 인터페이스도 본 파일에 정의(`{ github: GithubCollectionSpec; confluence: ConfluenceCollectionSpec }`).
- [ ] **per-source 독립성(ADR-0029 §3 부분 가용성 우선)**: GitHub 수집과 Confluence 수집을 독립 호출로 묶되, 한쪽 collection service 가 throw 해도 다른 쪽 결과는 보존(skip-and-continue)하도록 각 호출을 독립 try/catch 로 감싸고 실패한 source 는 빈 배열로 흡수. 두 collection service 자체는 이미 내부적으로 source 단위 skip 하므로 본 orchestrator 의 try/catch 는 collection service 레벨 throw(예상 외 오류) 흡수가 목적임을 주석에 명시.
- [ ] colocated spec `src/assessment-collection/collection-orchestrator.service.spec.ts` 추가 — 두 collection service 를 jest mock 으로 주입(live·실 adapter 0, Q-0025 deferred 정합).
- [ ] **Happy-path test**: GitHub mock 이 `GithubActivity[]`(2건) + Confluence mock 이 `ConfluenceActivity[]`(1건) 반환 시 `collectActivities` 가 3건을 단일 `Activity[]` 로 concat 반환함을 검증(각 service 가 정확한 spec 으로 1회 호출됨도 assert).
- [ ] **Error path test**: GitHub collection service 가 reject(throw)할 때 Confluence 결과만 보존되어 반환됨(부분 가용성) + 반대로 Confluence 가 reject 할 때 GitHub 결과만 보존됨 — 각 1+ test. orchestrator 가 전체 throw 하지 않음을 검증.
- [ ] **Branch test**: (1) 두 source 모두 빈 배열 반환 시 빈 `Activity[]` 반환, (2) 한쪽만 비어있을 때 다른 쪽 결과만 반환 — 각 분기 1+ test.
- [ ] **Negative cases 충분 cover**: (1) 두 collection service 모두 throw 시 빈 `Activity[]` 반환(전체 throw 0), (2) spec.github.sources 가 빈 배열일 때 GithubCollectionService 에 그대로 pass-through 됨(orchestrator 가 enumerate·검증하지 않음 — 그건 v-b 상위 책임 아님), (3) 두 service 호출 순서·인자 정합 assert(잘못된 spec 전달 0), (4) 반환 배열이 GitHub→Confluence 순서로 concat 됨(또는 정의한 순서)을 결정론적으로 검증 — 각 1+ test.
- [ ] `src/assessment-collection/assessment-collection.module.ts` 에 `CollectionOrchestratorService` 를 providers 에 추가 + (후속 v-c 가 inject 할 수 있도록) exports 에 추가. 두 collection service import/배선은 이미 존재하므로 새 module import 0.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test` 통과 + `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%).

## Out of Scope

- **Person enumerate** — `collectForPerson(person, since?)` 진입점 + Person 의 ServiceIdentity 별 instance×org×repo / Confluence instance 를 `CollectionSpec` 으로 산출하는 로직은 본 task 밖(후속 — Follow-up). 본 orchestrator 는 **이미 산출된 `CollectionSpec` 을 입력으로 받는다**(enumerate 0).
- **Contribution 영속화** — v-a 매퍼(`mapActivityToContribution`) 호출 + `ContributionService.create` / repository 영속화 — slice (v-c)(Follow-up). 본 task 는 매퍼를 호출하지 않고 `Activity[]` aggregate 까지만.
- incremental `since` 도출(직전 Assessment → since) — slice (vi).
- 두 collection service / mapper / module import 구조 **수정 금지**(본 task 는 orchestrator service 1개 추가 + module provider/export 1줄 추가만 — 기존 collection service 시그니처 불변).
- live/credentialed 수집 — Q-0025 대로 UI 이후 deferred. 본 task 는 mock 주입 collection service 위에서만 unit-test.
- modules.md row 9 reconcile doc-sync — slice (vii).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (slice v-b2/enumerate) `collectForPerson(person, since?)` 진입점 — Person 의 ServiceIdentity 별 GitHub instance×org×repo / Confluence instance 를 `CollectionSpec` 으로 enumerate 한 뒤 본 orchestrator 의 `collectActivities` 를 호출. Person/ServiceIdentity 모델 traversal cap 검토 후 별도 slice.
- (slice v-c) Contribution 영속화 — v-a 매퍼(`mapActivityToContribution`) + 본 task 의 aggregate `Activity[]` 를 받아 `ContributionService.create`(UserModule export) 로 `Contribution[]` 영속화. assessmentId 주입 경계 + FK 위반 negative cover + 평가 필드 placeholder transient 표현 결정. UserModule import(또는 ContributionService 직접 주입) 배선 필요.
- (slice vi) incremental since 도출 — 직전 Assessment → `since` 계산 + 경계값(동일 timestamp·미래·빈 결과) negative cover.
- (slice vii) modules.md row 9 `AssessmentModule` 수집/평가 분리 reconcile doc-sync(direct).
