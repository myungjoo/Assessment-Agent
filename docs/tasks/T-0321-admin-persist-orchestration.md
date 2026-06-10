---
id: T-0321
title: period→collect→evaluate Admin full-persist orchestration bridge service (first-write-wins read-through)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-040, REQ-045]
estimatedDiff: 270
estimatedFiles: 4
created: 2026-06-10
plannerNote: P5/ADR-0037 slice2 — Admin full-persist compose(§D1 Admin/§D2 single-writer/amended §D3 first-write-wins read-through/§D4 fresh collect); est R-112 backbone×1.5 + P2002 sub×1.2 = ×1.8
---

# T-0321 — period→collect→evaluate Admin full-persist orchestration bridge service (first-write-wins read-through)

## Why

[ADR-0037](../decisions/ADR-0037-period-collection-evaluate-bridge.md)(이제 status **ACCEPTED** — PR #268, squash 52ab7a7)의 두 PROPOSE 결정(§Decision2 double-write 경계 / §Decision3 idempotency)이 [Q-0032](../STATE.json) 에서 모두 resolve 됐다 — §Decision2 = **evaluation-side single-writer**(as-proposed), §Decision3 = **first-write-wins read-through**(409 전파 폐기, amend). 이로써 ADR-0037 §Follow-ups **slice 2 의 Admin full-persist 경로**가 unblock 됐다. 본 task 는 그 **Admin orchestration bridge** 만 구현한다 — `collectActivities`(persist-free, fresh) → `filterActivitiesByAuthor` → `evaluateActivities` → **`EvaluationResultPersistService` 로 영속화**(임의 personId, §Decision1 Admin) 를 compose 하되, 같은 `(personId, period, scope, periodStart)` 좌표는 **create-if-absent-else-read**(좌표 부재 시 create+persist+반환, 존재 시 기존 저장본 read 반환, write 0; P2002 race loser 는 catch 후 read fall-through — 409 전파 0, overwrite 0)로 구현한다(amended §Decision3). 이미 머지된 User ephemeral 경로(PeriodBridgeEphemeralService, T-0316)와 sibling 으로, ephemeral 의 구조적 write-0 보장을 훼손하지 않는다. README R-9(Admin·User 임의 기간 평가문 요청, PLAN P5 L98)의 마지막 backbone(Admin)을 닫는다.

## Required Reading

- `docs/decisions/ADR-0037-period-collection-evaluate-bridge.md` — §Decision1(Admin full path: collect→evaluate→persist, 임의 personId)·§Decision2(evaluation-side single-writer: collection-side persist 우회)·**amended §Decision3(first-write-wins read-through: create-if-absent-else-read, P2002 catch → read fall-through, reeval/overwrite 아님)**·§Decision4(fresh in-memory collect source-of)·§Follow-ups slice 2·§Cross-Module Impact(import 재사용 목록).
- `docs/decisions/ADR-0033-evaluation-result-persistence.md` — `EvaluationResultPersistService.persist(context, results, mode)` / `PersistMode`("fill"|"reeval") / `$transaction` reset-and-recreate / P2002→ConflictException 의 영속화 substrate. **주의: slice 2 는 create-if-absent-else-read 라 reeval(overwrite) 을 호출하지 않는다.** `fill` 모드는 존재 시 no-op 이지만 **기존 평가 payload 를 read·반환하지 않는다**(`contributionCount: 0` 만 반환) — 좌표 존재 시 기존 저장본을 caller 에게 read-back 하는 경로를 본 service 가 추가해야 함(설계 포인트, 아래 Acceptance 참조).
- `src/assessment-evaluation/period-bridge-ephemeral.service.ts` — 머지된 User ephemeral orchestration(T-0316). 본 task 는 그 sibling/extension — compose 4 단계 패턴 + `PeriodBridgePersonInput` contract mirror 대상.
- `src/assessment-evaluation/evaluation-result-persist.service.ts` — `persist(context, results, mode): Promise<PersistResult>`(`PersistResult = { assessmentId, contributionCount }`) + `EvaluationPersistContext = { personId, period, scope, periodStart: Date }`. Admin 분기가 호출할 영속화 API.
- `src/assessment-collection/collection-orchestrator.service.ts` — `collectActivities(spec): Promise<Activity[]>`(persist-free, throw 0) + `CollectionSpec`. **시그니처만** read.
- `src/assessment-collection/collection-spec.service.ts` — `buildCollectionSpec(person, since?): Promise<CollectionSpec>`. **시그니처만** read.
- `src/assessment-collection/domain/author-filter.ts` — `filterActivitiesByAuthor(activities, serviceIdentities)` 순수 함수. **시그니처만** read.
- `src/assessment-evaluation/evaluation-orchestrator.service.ts` — `evaluateActivities(activities, options): Promise<EvaluationResult[]>` + `ScoringOptions`. **시그니처만** read.
- `src/assessment-evaluation/assessment-evaluation.module.ts` — provider/export 배선(본 service 등록 + 필요 시 `EvaluationResultPersistService`/collection service DI 확보).
- `CLAUDE.md` §3.2(R-112 4종 + negative cases 충분 cover / coverage line ≥ 80% AND function ≥ 80%) / §12(언어 정책).

## 설계 결정 (본 task 가 택해 명시할 것)

- **sibling service 권장** — 본 task 는 **새 Admin-persist orchestration service**(예: `PeriodBridgeAdminPersistService`, colocated `src/assessment-evaluation/period-bridge-admin-persist.service.ts`)를 신설한다. PeriodBridgeEphemeralService 에 role/mode 분기를 추가해 persist 의존을 주입하는 방식은 **금지** — ephemeral service 가 persist symbol 을 주입조차 안 함으로써 구조적으로 보장하는 write-0(ADR-0037 §Decision1 ephemeral 경계)을 깨뜨리기 때문이다. 두 service 를 분리하면 ephemeral 경로는 persist 도달 불가가 구조적으로 유지되고, Admin service 만 persist 를 주입한다(persist 도달 가능성을 Admin 에 국소화). 본 결정을 service 파일 상단 주석에 박제할 것.
- **create-if-absent-else-read 구현 골격** — `EvaluationResultPersistService.persist` 의 `fill` 모드는 좌표 존재 시 no-op(write 0)이나 기존 평가 payload 를 반환하지 않으므로, 본 service 는: (a) compose 로 fresh `EvaluationResult[]` 산출 → (b) `persist(context, results, "fill")` 호출(좌표 부재 시 create, 존재 시 no-op) → (c) **반환된 `assessmentId` 로 기존 영속 평가문을 read-back** 하여 caller 에게 반환(좌표가 부재였든 존재했든 동일 read-back 으로 수렴 — first-write-wins). 또는 동등한 get-or-create 형태. P2002 가 `persist` 에서 `ConflictException` 으로 올라오면 **catch 후 같은 좌표 read 경로로 fall-through**(409 전파 0). **`reeval` 모드 호출 금지**(overwrite DEFERRED).
- read-back 경로가 새 read repository 메서드를 요구해 create 경로 + read 경로 합산이 cap(300 LOC / 5 파일) 초과 위험이면 **SPLIT**: slice 2a(Admin persist create 경로 + "fill") / slice 2b(좌표 존재·P2002 시 read-through read-back). **단 한 task 로 들어가면 한 task 우선** — 본 task 는 일단 단일 task 로 시도하고, implementer 가 cap 초과를 감지하면 Follow-ups 에 split 제안을 append 한 뒤 cap 안에서 가능한 절반(create 경로 + read-back seam)을 완결한다.

## Acceptance Criteria

- [ ] `src/assessment-evaluation/period-bridge-admin-persist.service.ts`(파일명 자유, colocated) 에 `@Injectable()` Admin orchestration service 신설. 메서드 예: `generateAndPersist(person: PeriodBridgePersonInput, period: { since?: string }, options: ScoringOptions, context: EvaluationPersistContext): Promise<...>`(반환 타입은 구현이 결정 — 영속 식별자 + 평가문 read-back 결과). 임의 personId 허용(self-only 강제는 slice 4 — 본 service 는 resolved context 를 받는다).
  - compose 흐름: (1) `buildCollectionSpec(person, since)` → (2) `collectActivities(spec)`(persist-free, fresh) → (3) `filterActivitiesByAuthor(activities, person.serviceIdentities)` → (4) `evaluateActivities(filtered, options)` → (5) **first-write-wins read-through persist**(create-if-absent-else-read; "fill" 호출 + read-back, P2002 catch → read fall-through). reeval/overwrite 호출 0.
- [ ] **구조적 경계**: 본 Admin service 는 `EvaluationResultPersistService` 를 주입한다(persist 도달 가능 — Admin 경로 한정). PeriodBridgeEphemeralService 는 **변경하지 않는다**(ephemeral 의 persist-미주입 write-0 보장이 구조적으로 그대로 유지됨을 보존 — sibling 분리). 본 task 가 ephemeral service 에 mode/role 분기를 추가하지 않음을 spec 또는 구조로 확인.
- [ ] NestJS DI 배선: `AssessmentEvaluationModule` 에 본 service 를 provider 등록(+ 후속 controller slice 가 inject 받도록 export). `EvaluationResultPersistService` + collection service(`CollectionSpecService`/`CollectionOrchestratorService`) DI resolve 확보(이미 ephemeral 배선에서 collection module import 가 있으면 재사용; persist service 는 평가 module 내 provider 확인).
- [ ] **Happy-path unit test 1+**: mock 주입(collection spec/orchestrator/evaluation + `EvaluationResultPersistService`) → 좌표 **부재** 첫 호출 시 compose 4 단계 순서대로 호출 + persist("fill") 1회 + 영속 식별자/평가문 반환 검증. 실 LLM/실 DB/실 네트워크 0.
- [ ] **Error path unit test 1+**: (a) `evaluateActivities` reject → 본 service swallow 없이 전파(persist 미호출 검증). (b) `persist` 가 `ConflictException`(P2002 변환) reject → 본 service 가 catch 후 read 경로로 fall-through 해 기존 저장본 반환(409 전파 0). (c) `buildCollectionSpec` reject → 전파(fail-fast).
- [ ] **Flow / branch 분기 cover**: (i) 좌표 부재(create 경로) vs (ii) 좌표 존재(read-through, write 미발생) vs (iii) race P2002(catch → read fall-through) 3 분기 각 1+ test. `since` 미지정/지정 pass-through 도 각 1 test.
- [ ] **Negative cases 충분 cover(예외 상황 분기마다 1+)**:
  - **2번째 동일 좌표 호출은 read-through** — 같은 context 로 재호출 시 persist 가 새 write 를 만들지 않고(또는 "fill" no-op) 기존 저장본을 read 반환함을 mock 으로 검증(409 미발생, 두 번째 create 0).
  - **concurrent/duplicate → P2002 catch → read fall-through** — persist 가 `ConflictException` 던질 때 read 경로로 수렴(409 caller 전파 0).
  - **빈 수집 흡수** — `collectActivities` 빈 `Activity[]` 또는 `filterActivitiesByAuthor` 귀속 0 건 → `evaluateActivities([])` 빈 결과 → persist 경로의 빈 입력 처리(throw 0, 또는 빈 결과의 정의된 동작) 검증.
  - **collection-orchestrator partial-failure 흡수** — orchestrator 가 부분 실패를 자체 흡수(throw 0)하므로 본 service 가 별도 throw 없이 진행함을 확인(orchestrator throw 0 전제 재확인).
  - **ephemeral write-0 보존 구조 확인** — 본 task 가 PeriodBridgeEphemeralService 를 변경하지 않았고(ephemeral 경로는 여전히 어떤 persist symbol 도 주입/도달 불가) Admin persist 가 sibling 으로 격리됨을 spec/구조로 박제.
  - `reeval` 모드 미호출 — 본 service 가 persist 를 호출할 때 mode 가 "fill"(또는 동등한 create-if-absent)이며 "reeval" 을 전달하지 않음을 검증(overwrite DEFERRED 회귀 가드).
- [ ] colocated spec(`src/assessment-evaluation/period-bridge-admin-persist.service.spec.ts`) 에 위 test 박제. mocked-LLM + mocked-collection + mocked-persist(또는 thin persist seam) unit — 실 DB round-trip 0. 2+ spec 공유 mock 가 생기면 `test/helpers/` fallback(현재 colocated 우선).
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% — `coverageThreshold.global`).

## Out of Scope

- **controller endpoint / HTTP route(POST /api/assessment-evaluation/period 의 Admin role 분기)** — slice 3 책임. 본 task 는 orchestration service + DI 배선까지만.
- **RBAC: Admin 임의 personId 허용 / User self-only(personId 동등성) 강제 guard** — slice 4 책임(self-only 는 T-0317 에서 일부 강제됨). 본 service 는 resolved `context`/`person` 입력을 받는다.
- **e2e / 실 PostgreSQL / 실 DB round-trip / 동시 호출 idempotency 실측** — slice 5 책임(ADR-0004). 본 task 의 unit 은 mocked persist 또는 thin persist seam 으로 검증(full Admin persist round-trip + concurrency idempotency 실 PostgreSQL 검증은 slice 5).
- **DEFERRED overwrite capability** — 이미 영속화된 좌표의 평가문을 새 평가로 교체(`reeval`/reset-and-recreate)하는 경로 일절 금지. 본 v1 은 first-write-wins read-through(create-if-absent-else-read)만(amended §Decision3).
- **live LLM round-trip** — mocked-LLM unit 만(§Decision5 credential 게이트 deferred).
- **timezone(Asia/Seoul vs UTC) 결정** — Q-0026 별건, 본 task 밖.
- **collection module / EvaluationResultPersistService / ephemeral service 의 기존 동작·시그니처 변경** — import 재사용 + (필요 시 module export 추가) 외 0.

## Suggested Sub-agents

`implementer → tester`(architect 불요 — ADR-0037 §Decision1/2/3(amended)/4 가 설계를 이미 박제; 새 알고리즘 0, compose + persist read-through 분기 + DI 배선만).

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 append. 알려진 후속 slice:)

- **slice 3 — controller Admin 분기 endpoint** — `POST /api/assessment-evaluation/period` 의 Admin role 분기 + 영속 Assessment 식별자 응답(create/read-through 모두 식별자 반환, 중복 좌표는 409 아닌 기존 식별자/결과) + colocated controller unit.
- **slice 4 — RBAC guard** — Admin 임의 personId 허용 / User self-only(personId 동등성, fail-closed) 분기 강제(self-only 는 T-0317 에서 일부 강제됨 — Admin 임의 personId 경로 확정) + negative(타인 personId → 403 / 인증 부재 → 401).
- **slice 5 — e2e(ADR-0004 실 PostgreSQL)** — Admin full-persist round-trip(평가 결과 영속 검증) + **first-write-wins read-through idempotency**(같은 좌표 2번째 호출 → 기존 반환, **409 아님**, row 증가 0) + 동시 호출 수렴(같은 좌표 동시 2 호출 → 최종 row 1 + 양쪽 동일 결과, 409 전파 없음).
- **(DEFERRED) overwrite / 이미 영속화된 평가문 재평가** — `reeval`/reset-and-recreate replace existing 경로(권한·이력 보존·동시 read 일관성 새 결정 동반). 별도 후속 ADR/task(Q-0032 DEFERRED 지시).
