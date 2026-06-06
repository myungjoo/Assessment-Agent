---
id: T-0265
title: ADR-0030 §5 slice iii-b2b — collection enumerate chain service 들을 AssessmentCollectionModule 에 배선
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-005, REQ-006, REQ-007, REQ-008, REQ-015, REQ-024, REQ-031, REQ-032]
estimatedDiff: 120
estimatedFiles: 2
created: 2026-06-06
plannerNote: "P4 ADR-0030 §5 slice iii-b2b — CollectionEntryService + 의존 chain(CollectionSpecService→GithubCollectionSpecService→GithubOrgEnumerateService) 4개를 AssessmentCollectionModule provider/export 배선 + module.spec 회귀. GithubInstanceClient 는 기존 GithubModule export 로 닫힘(ADR 불요). pr ~120 LOC/2파일."
---

# T-0265 — ADR-0030 §5 slice iii-b2b — collection enumerate chain service 들을 AssessmentCollectionModule 에 배선

## Why

ADR-0030 §5 cap-split 의 building block 이 전부 머지됐다 — `buildCollectionSpec`(T-0261) / `filterActivitiesByAuthor`(T-0262) / `persistActivities`(T-0263 / PR-226) / `collectForPerson` 진입 service `CollectionEntryService`(T-0264 / PR-227 merge 0557a7d). 그러나 T-0264 가 명시적으로 분리한 대로 **`CollectionEntryService` 와 그 의존 chain 은 아직 `AssessmentCollectionModule` provider 에 미등록**이라 DI 로 resolve 할 수 없다. main(0557a7d) 대조 결과 module providers/exports 에는 `GithubCollectionService` / `ConfluenceCollectionService` / `CollectionOrchestratorService` / `CollectionPersistenceService` 4개뿐이고, enumerate chain 4 service 는 파일만 존재한다(issue-still-relevant pre-check 통과 — 배선 미완 확정).

본 task 는 그 미등록 4 service 를 module 에 배선해 `CollectionEntryService` 가 DI 로 resolve 가능하게 한다. 이로써 P5 평가 진입(scheduler / manual trigger)이 `CollectionEntryService` 를 inject 받아 `collectForPerson(person, since?, assessmentId)` 를 호출하는 결선(호출처, 후속 slice)의 선행 조건이 충족된다. README L13-18(Person 기여 수집→귀속→영속화) + REQ-005~008/REQ-015/REQ-024/REQ-031/032 를 cover 한다.

의존 트리(main 대조 — 변경 0, 호출 contract 그대로):
- `CollectionEntryService` → `CollectionSpecService` + `CollectionOrchestratorService`(**이미 등록**) + `CollectionPersistenceService`(**이미 등록**)
- `CollectionSpecService` → `GithubCollectionSpecService` + `@Optional() env`
- `GithubCollectionSpecService` → `GithubOrgEnumerateService` + `@Optional() env`
- `GithubOrgEnumerateService` → `GithubInstanceClient`(**`GithubModule` export, 이미 import 됨**)

따라서 **새로 등록할 provider 는 4개**: `CollectionEntryService`, `CollectionSpecService`, `GithubCollectionSpecService`, `GithubOrgEnumerateService`. leaf 의존 `GithubInstanceClient` 는 `GithubModule` 이 export(github.module.ts L65)하고 본 module 이 이미 `GithubModule` 을 import(L63)하므로 — **새 import / 새 ADR 불필요**. 기존 `GithubCollectionService` 가 동일하게 `GithubInstanceClient` 를 쓰며 이미 resolve 되는 패턴을 그대로 mirror 한다(GithubInstanceClient import 경계 판정: ADR-worthy 아님, 가장 단순한 기존 패턴 재사용).

새 DB schema 0 / 새 dependency 0 / 새 credential 0 (순수 DI 선언 + mocked module-spec 회귀). CLAUDE.md §5 게이트 미발화. Q-0025(mocked unit/module test 만) 정합.

## Required Reading

- `docs/decisions/ADR-0030-assessment-collection-enumerate.md` — §5(collectForPerson 진입 계약 + module 배선이 별도 micro-slice 라는 cap 분할), §1(import 방향 단방향 collection → adapter/user), §6(testing posture — mocked module-spec).
- `docs/tasks/T-0264-collect-for-person-entry-service.md` — Out of Scope + Follow-ups 의 slice iii-b2b 정의: `CollectionSpecService` + 신설 `CollectionEntryService` 를 `AssessmentCollectionModule` provider/export 로 등록 + `assessment-collection.module.spec.ts` 회귀(provider resolve 검증)가 본 task 의 책임 경계.
- `src/assessment-collection/assessment-collection.module.ts` — **본 task 가 수정**할 module. 현재 providers/exports = 4개(GithubCollectionService / ConfluenceCollectionService / CollectionOrchestratorService / CollectionPersistenceService). imports = [GithubModule, ConfluenceModule, UserModule]. 본 task 는 enumerate chain 4 service 를 providers 에 추가(export 는 최소 `CollectionEntryService` — 외부 진입점; chain 중간 service 의 export 여부는 아래 Acceptance Criteria 참조). import 추가 불요.
- `src/assessment-collection/assessment-collection.module.spec.ts` — **본 task 가 수정**할 module spec. 기존 패턴: `jest.mock("../persistence/prisma.service")`(PrismaService super() 부작용 회피) + `Test.createTestingModule({ imports: [PersistenceModule, AssessmentCollectionModule] }).compile()` + `moduleRef.get(...)` resolve 검증 + sentinel override(exports 정합) + 미등록 가드(negative). 신규 4 service 의 resolve 검증을 이 패턴으로 추가.
- `src/assessment-collection/collection-entry.service.ts` — 진입 service `CollectionEntryService`(생성자 = CollectionSpecService + CollectionOrchestratorService + CollectionPersistenceService). 호출/등록만, 변경 0.
- `src/assessment-collection/collection-spec.service.ts` — `CollectionSpecService`(생성자 = GithubCollectionSpecService + `@Optional() env`). 등록만, 변경 0.
- `src/assessment-collection/github-collection-spec.service.ts` — `GithubCollectionSpecService`(생성자 = GithubOrgEnumerateService + `@Optional() env`). 등록만, 변경 0.
- `src/assessment-collection/github-org-repo-enumerate.service.ts` — `GithubOrgEnumerateService`(생성자 = `GithubInstanceClient`). 등록만, 변경 0.
- `src/github/github.module.ts` L57/L65 — `GithubInstanceClient` 가 providers + exports 에 등록됨 확인용(leaf 의존이 import 로 닫힘의 증명, 변경 0).

## Acceptance Criteria

본 task 의 산출물은 `assessment-collection.module.ts` 1개 + `assessment-collection.module.spec.ts` 1개 = 2 파일 수정이다. 신규 production 파일 0(기존 4 service 재사용, 배선만).

- [ ] **provider 4개 추가**: `assessment-collection.module.ts` 의 `providers` 배열에 `CollectionEntryService`, `CollectionSpecService`, `GithubCollectionSpecService`, `GithubOrgEnumerateService` 4개를 추가한다(기존 4개 유지). 각 import 문도 추가. import 배열(imports)은 변경하지 않는다 — `GithubInstanceClient` 는 기존 `GithubModule` export 로 이미 공급됨.
- [ ] **export 정합**: `exports` 배열에 최소 `CollectionEntryService` 를 추가한다(외부 = scheduler/manual trigger 가 inject 할 유일한 진입점). chain 중간 service(`CollectionSpecService` / `GithubCollectionSpecService` / `GithubOrgEnumerateService`)는 module 내부 의존이므로 **export 불필요**(의존성 표면 최소화) — 단 외부에서 직접 쓸 명분이 현재 0 이면 export 하지 않는다. export 결정 근거를 module.ts 주석에 1줄 박제.
- [ ] **GithubInstanceClient import 경계 명시**: module.ts 주석에 "enumerate chain 의 leaf 의존 `GithubInstanceClient` 는 기존 `GithubModule` import + export 로 이미 공급됨(github.module.ts L65) — 새 import 불요, 기존 `GithubCollectionService` 와 동일 패턴" 을 1~2줄 박제(다음 turn 의 attention drift 방지).
- [ ] happy-path test 1+: `Test.createTestingModule({ imports: [PersistenceModule, AssessmentCollectionModule] }).compile()` 후 `moduleRef.get(CollectionEntryService)` 가 `CollectionEntryService` instance 로 resolve 됨을 검증(전체 의존 chain 이 DI 로 닫힘의 증명 — CollectionSpecService → GithubCollectionSpecService → GithubOrgEnumerateService → GithubInstanceClient 까지). 기존 4 service resolve test 는 회귀 보존.
- [ ] error path / negative test 1+ **각 신규 service 미등록 가드**: `AssessmentCollectionModule` 없이 `PersistenceModule` 만 import 한 context 에서 `moduleRef.get(CollectionEntryService)` 가 throw 함을 검증(기존 미등록-가드 test 에 신규 4 service 추가 — 누군가 provider 등록을 빠뜨리면 fail). 단일 negative 만 작성 금지 — 신규 4 service 각각 또는 진입점 + 대표 chain service 1+ 를 cover.
- [ ] flow/branch cover: 본 module 은 순수 DI 선언이라 런타임 분기 0 — spec 에 "분기 없음 — 생략" 명시. 대신 resolve(happy) + sentinel override(exports 정합) + 미등록 가드(negative) 로 wiring 정합의 모든 경로를 cover(기존 spec 패턴 mirror).
- [ ] **sentinel override(exports 정합)**: `CollectionEntryService` 를 sentinel 로 `overrideProvider` 한 뒤 resolve 시 sentinel 이 나옴을 검증(export 등록이 정상이라 외부 inject 가능함의 간접 증명) — 기존 spec 의 sentinel 패턴 mirror.
- [ ] **회귀 보존**: 기존 4 service(GithubCollectionService / ConfluenceCollectionService / CollectionOrchestratorService / CollectionPersistenceService)의 resolve test + 미등록 가드 test 가 그대로 pass(배선 추가가 기존 wiring 을 깨지 않음).
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — `coverageThreshold.global` 강제.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과(tester 가 결과 확인 — R-110).

## Out of Scope

- **modules.md row 40 doc-sync** — `docs/architecture/modules.md` 의 AssessmentCollectionModule 구성 목록은 현재 `CollectionOrchestratorService` / `CollectionPersistenceService` 까지만 반영(enumerate chain `CollectionEntryService` / `CollectionSpecService` 등 미반영, stale). 이 doc-sync 는 **별도 direct doc-sync task**(§3.1 commitMode 혼합 금지 — pr task 에 docs/ 섞지 않음). 본 task 의 Follow-ups 에 박제.
- **신규 4 service 의 코드 변경** — `CollectionEntryService` / `CollectionSpecService` / `GithubCollectionSpecService` / `GithubOrgEnumerateService` 전부 기존 시그니처/구현 재사용(등록/import 만). 본 task 는 그 파일들을 수정하지 않는다.
- **imports 배열 변경 / 새 module import** — `GithubInstanceClient` 는 기존 `GithubModule` export 로 닫히므로 imports 변경 0. 만약 build/test 에서 `GithubInstanceClient` resolve 실패가 발생하면(예상 밖) 즉시 중단하고 import 경계를 재검토(ADR-worthy 여부 판단) — 현 설계상 불필요.
- **호출처 결선(scheduler/manual trigger)** — `CollectionEntryService.collectForPerson` 를 호출하며 assessmentId 를 주입하는 P5 평가 진입점 wiring 은 후속 slice. 본 task 는 DI resolve 가능 상태까지만.
- **slice vi(since 도출)** — 직전 Assessment → since 계산 service. 별개 slice.
- **실 네트워크 / 실 credential** — Q-0025 대로 deferred. mocked module-spec(jest.mock PrismaService)으로만 검증(실 fetch 0 / 실 token 0).
- **DB schema / migration** — 0(기존 entity/service 재사용). 구현 중 schema 변경이 필요해 보이면 즉시 중단하고 §5 게이트로 escalate(현 설계상 불필요).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 추가)

- modules.md row 40 doc-sync(direct): AssessmentCollectionModule 구성 목록에 enumerate chain(`CollectionEntryService` 진입 + `CollectionSpecService`/`GithubCollectionSpecService`/`GithubOrgEnumerateService`) 을 반영 + collectForPerson 진입 계약 한 줄.
- slice vi: since 도출(직전 Assessment → since) service — collectForPerson 의 since 인자 소비처.
- 호출처 결선: scheduler/manual trigger(P5 평가 진입)가 `CollectionEntryService.collectForPerson(person, since?, assessmentId)` 를 호출하며 assessmentId 를 주입하는 진입점 wiring.
