---
id: T-0316
title: period→collect→evaluate ephemeral orchestration bridge service (User self-only FIRM 경로만)
phase: P5
status: DONE
completedAt: 2026-06-10T11:24:00+09:00
mergedAs: 154d7a4
prNumber: 265
reviewRounds: 1
commitMode: pr
coversReq: [REQ-009, REQ-040, REQ-045]
estimatedDiff: 240
estimatedFiles: 4
created: 2026-06-10
plannerNote: P5/ADR-0037 slice2(partial) — §Decision1/4 FIRM ephemeral 경로만 compose, §Decision2/3 PROPOSE persist 미baking
---

# T-0316 — period→collect→evaluate ephemeral orchestration bridge service (User self-only FIRM 경로만)

## Why

[ADR-0037](../decisions/ADR-0037-period-collection-evaluate-bridge.md) §Follow-ups slice 2(orchestration bridge service)는 본래 Admin full-persist 경로까지 포함하지만, 그 persist 축은 ADR-0037 §Decision2(double-write 경계)·§Decision3(idempotency)에 의존하며 이 둘은 **PROPOSE 상태로 사용자 ADR PR 검토 대상**이다(Q-0031 박제). 따라서 본 task 는 ADR-0037 의 **FIRM 결정만**(§Decision1 의 User self-only ephemeral 경로 + §Decision4 fresh in-memory collect)으로 깨끗이 분리 가능한 **ephemeral compose orchestration service** 만 구현한다 — `collectActivities`(persist-free) → `filterActivitiesByAuthor`(순수 함수) → `evaluateActivities`(in-memory) 를 묶어 `EvaluationResult[]` 를 **DB write 0** 로 반환한다. 이는 README R-9(임의 기간 평가문 요청, PLAN P5 L98)의 User 경로를 충족하며, persist(§Decision2/3)는 본 task 가 일절 baking 하지 않는다(별도 후속 slice). T-0315(PeriodBridgeDto)가 입력 형식을 닫은 위에 본 service 가 compose layer 를 얹는다.

## Required Reading

- `docs/decisions/ADR-0037-period-collection-evaluate-bridge.md` — §Decision1(User self-only ephemeral, DB write 0 구조적 분기)·§Decision4(fresh in-memory collect source-of)·§Cross-Module Impact(import 재사용 목록). 단 §Decision2/3 은 본 task 와 무관(persist 미구현).
- `src/assessment-collection/collection-orchestrator.service.ts` — `CollectionOrchestratorService.collectActivities(spec): Promise<Activity[]>`(persist-free in-memory) + `CollectionSpec` interface.
- `src/assessment-collection/collection-spec.service.ts` — `CollectionSpecService.buildCollectionSpec(person, since?): Promise<CollectionSpec>`.
- `src/assessment-collection/domain/author-filter.ts` — `filterActivitiesByAuthor(activities, serviceIdentities)` 순수 함수.
- `src/assessment-collection/collection-entry.service.ts` — `CollectForPersonInput`(`{ serviceIdentities: Pick<ServiceIdentity,"service"|"externalId">[] }`) — 본 service 의 person 입력 contract mirror 대상. **단 `persistActivities` 를 포함하는 `collectForPerson` 은 호출하지 않는다**.
- `src/assessment-evaluation/evaluation-orchestrator.service.ts` — `EvaluationOrchestratorService.evaluateActivities(activities, options): Promise<EvaluationResult[]>`(in-memory, DB write 0) + `ScoringOptions`.
- `src/assessment-evaluation/evaluation-scoring.service.ts` — `ScoringOptions { modelId: string }`.
- `src/assessment-evaluation/assessment-evaluation.module.ts` — module provider/export 배선 패턴(본 service 등록 + `AssessmentCollectionModule` import 필요 여부 확인).
- `src/assessment-collection/assessment-collection.module.ts` — `CollectionSpecService`/`CollectionOrchestratorService` export 여부 확인(본 service 가 DI 로 주입받기 위함).

## Acceptance Criteria

- [ ] `src/assessment-evaluation/period-bridge-ephemeral.service.ts`(파일명 자유, colocated)에 `@Injectable()` orchestration service 신설. 메서드 예: `generateEphemeral(person: PeriodBridgePersonInput, period: { since?: string }, options: ScoringOptions): Promise<EvaluationResult[]>`.
  - 입력 `person` 은 `CollectForPersonInput` mirror(`{ serviceIdentities: Pick<ServiceIdentity,"service"|"externalId">[] }`) — **personId→ServiceIdentity DB 조회·self-only RBAC 는 본 task 밖**(slice 3/4), 호출처가 resolved person 을 넘긴다.
  - compose 흐름: (1) `buildCollectionSpec(person, since)` → (2) `collectActivities(spec)` → (3) `filterActivitiesByAuthor(activities, person.serviceIdentities)` → (4) `evaluateActivities(filtered, options)` → 반환. **persist 호출 0**.
- [ ] **구조적 write-0 보장**: 본 service 는 `EvaluationResultPersistService`·`CollectionPersistenceService`·`collectForPerson`(persistActivities 포함)·`prisma`/`$transaction` 을 **생성자 주입조차 하지 않는다**(persist 도달 불가가 구조적으로 보장 — ADR-0037 §Decision1 ephemeral 경계 박제). 본 service 는 `CollectionSpecService` + `CollectionOrchestratorService` + `EvaluationOrchestratorService` 3 개만 주입.
- [ ] NestJS DI 배선: `AssessmentEvaluationModule` 에 본 service 를 provider 등록(+ 후속 controller slice 가 inject 받도록 export). `CollectionSpecService`/`CollectionOrchestratorService` 를 DI resolve 하기 위해 `AssessmentCollectionModule` 을 import(해당 module 이 두 service 를 export 하는지 확인 — 미export 시 본 task 에서 export 추가는 가능하나 cap 내, 그 외 collection module 동작 변경 0).
- [ ] **Happy-path unit test 1+**: mock `CollectionSpecService.buildCollectionSpec`(임의 spec 반환) + mock `CollectionOrchestratorService.collectActivities`(임의 `Activity[]` 반환) + mock `EvaluationOrchestratorService.evaluateActivities`(임의 `EvaluationResult[]` 반환) 주입 → `generateEphemeral` 가 4 단계를 순서대로 호출하고 in-memory `EvaluationResult[]` 를 반환함을 검증. 실 LLM/실 DB/실 네트워크 0.
- [ ] **Error path unit test 1+**: (a) `collectActivities` 가 빈 `Activity[]` 반환 시 — `evaluateActivities([], options)` 호출 + 빈 결과 반환(빈 수집 흡수, throw 0). (b) `evaluateActivities` 가 reject 시 — 그 error 가 본 service 에서 swallow 없이 전파됨(부분 결과 위장 0).
- [ ] **Flow / branch 분기 cover**: `since` 미지정(undefined) vs 지정 두 경로가 `buildCollectionSpec` 에 그대로 pass-through 됨을 각각 test. 그 외 본 service 에 추가 분기를 두지 않는다(분기 최소화).
- [ ] **Negative cases 충분 cover(예외 상황 분기마다 1+)**:
  - `filterActivitiesByAuthor` 후 귀속 활동 0 건 → `evaluateActivities([])` → 빈 `EvaluationResult[]` 반환(타인 활동만 수집된 경우의 정상 빈 응답).
  - **persist 미호출 검증** — 본 service 가 어떤 persist symbol 도 주입/호출하지 않음을 test 로 박제(예: 주입된 mock 3 종 외 호출 0, 또는 생성자 의존이 정확히 3 개임을 검증). ADR-0037 §Decision1 ephemeral write-0 의 unit-level 회귀 가드(e2e DB-write-0 검증은 slice 5).
  - `buildCollectionSpec` reject(예: GitHub spec 조립 실패) 시 본 service 가 그 error 를 전파(fail-fast, swallow 0).
- [ ] colocated spec(`src/assessment-evaluation/period-bridge-ephemeral.service.spec.ts`) 에 위 test 박제. 2+ spec 공유 mock 가 생기면 `test/helpers/` fallback(현재는 colocated 우선).
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% — `coverageThreshold.global`).

## Out of Scope

- **Admin full-persist 경로 일절 금지** — `EvaluationResultPersistService.persist` 호출·`collectForPerson`(persistActivities) 호출·Assessment/Contribution DB write·`$transaction`·`@@unique`·P2002→Conflict 매핑 등 ADR-0037 §Decision2(double-write 경계)·§Decision3(idempotency)에 묶인 어떤 코드도 본 task 에서 작성하지 않는다(PROPOSE 상태, 사용자 ADR PR 검토 대기).
- **mode("fill"|"reeval") 분기 구현 금지** — mode 는 persist 모드(§Decision3)라 Admin persist slice 책임. 본 ephemeral service 는 mode 를 받지도/쓰지도 않는다.
- **personId → ServiceIdentity DB 조회 / Person row 존재 검증 / self-only RBAC(personId 동등성) 강제 금지** — slice 3(controller)·slice 4(RBAC guard) 책임. 본 service 는 resolved `person` 입력을 받는다.
- **controller endpoint / HTTP route(POST /api/assessment-evaluation/period) 신설 금지** — slice 3 책임.
- **e2e / 실 PostgreSQL / 동시 호출 idempotency 검증 금지** — slice 5 책임(ADR-0004).
- **live LLM round-trip 금지** — mocked-LLM unit 만(§Decision5 credential 게이트 deferred).
- **collection module 의 기존 동작 변경 금지** — `AssessmentCollectionModule` import / (필요 시) export 추가 외 collection service 시그니처·로직 변경 0.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0037 §Decision1/4 가 설계를 이미 박제; 새 알고리즘 0, compose + DI 배선만).

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 append.)
