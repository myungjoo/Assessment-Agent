---
id: T-0324
title: period bridge Admin full-persist(POST /period Admin 분기) doc-sync — api.md + modules.md 정합
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-009, REQ-040, REQ-045]
estimatedDiff: 55
estimatedFiles: 2
created: 2026-06-10
plannerNote: P5 ADR-0037 Admin full-persist 완결(T-0320~T-0323, ACCEPTED)로 POST /period 가 이제 User ephemeral/Admin persist 2분기 — api.md L102/L134·modules.md L41/L197 의 'Admin persist 는 PROPOSE 미shipped' stale 정정(direct doc-sync, T-0319 precedent)
---

# T-0324 — period bridge Admin full-persist(POST /period Admin 분기) doc-sync

## Why

ADR-0037 Admin full-persist 경로가 end-to-end 로 shipped 됐다(T-0320 §Decision3 design-amend·ADR ACCEPTED → T-0321 orchestration `PeriodBridgeAdminPersistService` → T-0322 controller Admin role 분기 → T-0323 e2e, main ad966d0). 이제 `POST /api/assessment-evaluation/period` 는 **같은 endpoint 가 role 로 두 경로를 dispatch** 한다(controller `period()` L247~261): **User 분기 → ephemeral self-only(DB write 0, `EvaluationResult[]`)** + **신규 Admin 분기 → full-persist(임의 personId, EvaluationResultPersistService 일원화 영속화, `PeriodBridgeAdminResponse` 반환)**. 그런데 architecture 문서가 실 시스템을 **mis-describe** 한다 — T-0319 doc-sync 시점에는 Admin 경로가 §Decision2/3 PROPOSE 였어서 "User ephemeral 만 shipped / Admin 은 PROPOSE 미shipped" 로 정합했는데, 그 사이 Admin 경로가 ACCEPTED·shipped 돼 그 서술이 stale 해졌다. 본 task 는 그 4 곳을 실코드(controller `persistForAdmin` L302~342 + `PeriodBridgeAdminResponse` L92~99)와 정합한다. T-0319/T-0295/T-0302/T-0311 doc-sync 와 동일 material class — shipped 변경 후 architecture 문서를 실코드에 맞추는 정합(make-work 아님: stale "PROPOSE 미shipped" 서술 + 누락된 Admin 응답 shape·idempotency 계약은 실제 correctness gap). T-0319 가 자신의 Out of Scope 에서 "Admin 경로는 ACCEPTED 후 별도 doc-sync" 로 본 task 를 예고한 바로 그 후속이다.

## Required Reading

- `src/assessment-evaluation/assessment-evaluation.controller.ts` — 검증 source(읽기 권장 범위만):
  - `PeriodBridgeAdminResponse` interface(L92~99) — Admin 분기 응답 shape `{ assessmentId, personId, period, scope, periodStart, created }`. `created` 는 이번 호출이 좌표를 새로 create(true) / first-write-wins read-through 로 기존 저장본 반환(false)했는지.
  - `period()`(L247~261) — `@Post("period")` `@Roles("User")` + `isAdminRole(actor?.role)` dispatch: Admin tier 이상 → `persistForAdmin` / 그 외 → `ephemeralForUser`.
  - `persistForAdmin`(L302~342) — self-only **우회**(임의 personId), `PersonService.findByIdWithIdentities`(404 전파) → context 4-tuple 조립 → `adminBridge.generateAndPersist(...)` 위임 → 영속 Assessment 식별자/좌표 + `created` 반환. service-layer error raw 전파(swallow 0). dto.mode 는 reeval baking 안 함(항상 fill).
- `docs/architecture/api.md` (L102 `/period` row, L134 summary 합계 문장) — `/period` row 가 현재 **User self-only ephemeral 만** 서술하고 "Admin full-persist 경로(§Decision2/3)는 PROPOSE 상태 미shipped" 로 stale. auth 컬럼도 `User (self-only)` 만. L134 도 "Admin full-persist 는 §Decision2/3 PROPOSE 미shipped" stale.
- `docs/architecture/modules.md` (L41 `AssessmentEvaluationModule` row, L197 Backend API component row) — L41 이 "**단 Admin full-persist 경로는 여전히 deferred** — §Decision2(double-write)/§Decision3(idempotency)가 PROPOSE 상태(사용자 ADR PR 검토 대기)라 미shipped" 로 stale. L197 도 `/period` 를 "User self-only ephemeral, DB-write-0" 만 서술.
- `docs/decisions/ADR-0037-period-collection-evaluate-bridge.md` (status ACCEPTED; §Decision2 evaluation-side single-writer L62~74 / §Decision3 first-write-wins read-through L76~90) — 문서 서술의 근거 ADR backref. **§Decision2/3 둘 다 ACCEPTED**(Q-0032 RESOLVED — §2 as-proposed, §3 409→first-write-wins). overwrite/재평가는 DEFERRED(같은 좌표 재호출은 기존 read 반환, reeval 아님).
- `docs/tasks/T-0319-period-bridge-ephemeral-endpoint-doc-sync.md` — 직전 doc-sync precedent(동일 material class + 포맷). 본 task 는 그 Out of Scope §43("Admin 경로는 ACCEPTED 후 별도 doc-sync")의 후속.

## Acceptance Criteria

본 task 는 architecture 문서(`docs/architecture/`) 2 파일만 수정하는 `direct` doc-sync 다. 코드 변경 0.

- [ ] `docs/architecture/api.md` 의 `POST /api/assessment-evaluation/period` row(L102) 정정 — endpoint 가 이제 **role 분기 2 경로** 임을 명시:
  - **User 분기**(기존 서술 보존): self-only(`@CurrentUser("sub") == dto.personId` 일치 시에만, 불일치 403 fail-closed), `PeriodBridgeEphemeralService` 위임, **persist 호출 0 / DB write 0**, `EvaluationResult[]` 200 반환.
  - **Admin 분기**(신규): Admin tier(ROLE_HIERARCHY.Admin) 이상이면 self-only **우회**(임의 personId target), `PeriodBridgeAdminPersistService.generateAndPersist` 위임으로 **EvaluationResultPersistService 일원화 영속화**(ADR-0037 §Decision2 evaluation-side single-writer), 응답 `PeriodBridgeAdminResponse` `{ assessmentId, personId, period, scope, periodStart, created }`(영속 Assessment 식별자/좌표 — 이후 조회 source). **first-write-wins read-through idempotency**(§Decision3) 명시 — 같은 (personId, period, scope, periodStart) 좌표 2 번째 호출은 새 write 0·기존 저장본 read 반환(`created: false`, **409 아님**), 동시 호출은 winner 1 row 로 수렴(409 전파 0). overwrite/재평가는 DEFERRED.
  - error 표기 정합(401/403/404/400) + Admin persist 의 영속화 동반. 관련 task(T-0320~T-0323) + ADR backref([ADR-0037] §Decision1/2/3) 추가. 기존 `/evaluate`·ephemeral row 포맷과 일관.
  - auth 컬럼을 `User (self-only) / Admin (full-persist)` 로 갱신(현재 `User (self-only)` 만 stale).
- [ ] `docs/architecture/api.md` 의 합계 문장(L134) 정정 — "Admin full-persist 는 §Decision2/3 PROPOSE 미shipped" stale 서술을 **Admin full-persist shipped(T-0320~T-0323, ADR-0037 ACCEPTED)** 로 갱신(같은 endpoint 가 User ephemeral / Admin persist 2 경로 dispatch).
- [ ] `docs/architecture/modules.md` 의 `AssessmentEvaluationModule` row(L41) 정정 — "**단 Admin full-persist 경로는 여전히 deferred — §Decision2/3 가 PROPOSE 상태**" stale 서술을 **Admin full-persist 경로 shipped** 로 갱신: `PeriodBridgeAdminPersistService`(T-0321, first-write-wins read-through + EvaluationResultPersistService 일원화 영속화) + controller Admin role 분기(T-0322, `PeriodBridgeAdminResponse` 영속 식별자 반환) + e2e(T-0323, 실 PostgreSQL round-trip + idempotency)가 shipped 임을 반영. §Decision2(single-writer)/§Decision3(first-write-wins) 둘 다 ACCEPTED 임을 backref. **overwrite/재평가는 DEFERRED**(별도 후속 ADR) 만 잔여로 1줄 표기.
- [ ] `docs/architecture/modules.md` 의 Backend API component row(L197 부근) 의 `/period` 서술("User self-only ephemeral, DB-write-0" 만) 에 Admin full-persist 분기를 1줄 반영(같은 `AssessmentEvaluationController` 가 `POST /period` 에서 role 로 ephemeral/persist dispatch — 과도하게 늘리지 말 것, 최소 정합).
- [ ] 문서 내 모든 신규 서술이 실코드와 일치(controller 의 실제 `@Roles`·dispatch·self-only 우회·persist 일원화·`PeriodBridgeAdminResponse`·`created` 의미·first-write-wins 409-아님 과 모순 0). ADR-0037 §Decision 번호 인용 정확.
- [ ] 분기 없음(doc-only) — R-112 test 항목은 본 task 에 미적용(코드 변경 0). `commitMode: direct` 라 tester/PR/CI 게이트 미해당(CLAUDE.md §3.1/§3.2 — direct doc-only commit 은 R-110 면제).
- [ ] §12 언어 정책 — 본문 한국어, 식별자/path/endpoint/enum 영어 유지.

## Out of Scope

- **overwrite/재평가(replace existing) 문서화 또는 구현** — ADR-0037 §Decision3 가 DEFERRED 로 명시(같은 좌표 재호출은 기존 read 반환, reeval 아님). 별도 후속 ADR/task 의존이라 본 doc-sync 는 "overwrite DEFERRED" 로만 표기. 설계/구현 금지.
- **live-LLM 검증 문서화** — §5 credential 게이트(Q-0022, 시험 credential 만료 2026-06-30) 의존. mocked-only bridge 의 실 네트워크 LLM round-trip 은 본 task 밖.
- **data-model.md 변경** — ADR-0037 Admin persist 는 기존 Assessment/Contribution entity + ADR-0033 `@@unique`·reset-and-recreate 재사용만(새 table/컬럼/unique 미동반, §Decision5 schema0). data-model.md 정합 불요. (검토 중 정합 필요 발견 시 Follow-ups 에 기록만.)
- **코드 변경** — controller/service/e2e 는 T-0321~T-0323 머지 완료. 본 task 는 architecture 문서만. 코드에서 결함 발견 시 즉시 수정 금지 — Follow-ups 에 patch task 후보로 기록.
- **ADR status flip** — ADR-0037 은 이미 ACCEPTED(T-0320 머지). 본 doc-sync 가 ADR status 를 건드리지 않는다.
- **새 endpoint row / 다른 controller RBAC** — `/period` 1 row + 합계 문장 + modules 2 row 정합만. 다른 endpoint·module 서술은 본 task 밖.

## Suggested Sub-agents

`implementer` 단독(또는 driver 직접 편집 — direct doc-only). 코드 변경 0 이라 tester 불요(direct commitMode, R-110 면제). 2 파일 doc-sync 만.

## Follow-ups

(생성 시 비어 있음. 본 doc-sync 머지 시 ADR-0037 backbone 의 dependency-free shipped 분 [ephemeral T-0313~0319 + Admin full-persist T-0320~0324 doc-sync] 이 전부 닫힌다 — R-9 backbone 완결. 잔여 ADR-0037 항목은 (a) overwrite/재평가 capability [§Decision3 DEFERRED — 별도 ADR 필요] (b) live-LLM 검증 [§5 credential 게이트]뿐으로 둘 다 비-dependency-free. 본 task 머지 후 planner 가 dependency-free P5 소진을 재평가해 escalate 여부 결정.)
