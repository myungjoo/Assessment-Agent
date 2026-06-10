---
id: T-0322
title: period bridge controller Admin-role 분기 + 영속 Assessment 식별자 응답 추가
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-040, REQ-045]
estimatedDiff: 170
estimatedFiles: 2
created: 2026-06-10
plannerNote: P5 ADR-0037 slice3 — POST /period 에 Admin role 분기(PeriodBridgeAdminPersistService) + 영속 Assessment 식별자 응답, slice4 RBAC defer, R-112 backbone ×1.5
---

# T-0322 — period bridge controller Admin-role 분기 + 영속 Assessment 식별자 응답

## Why

ADR-0037 §Follow-ups **slice 3(controller endpoint)의 Admin 분기**를 박제한다 — period bridge HTTP surface(`POST /api/assessment-evaluation/period`)에 **Admin full-persist 경로**를 배선해, Admin 이 임의 `personId` 의 임의 기간 평가문을 요청하면 `PeriodBridgeAdminPersistService.generateAndPersist`(T-0321 머지, first-write-wins read-through)에 위임해 평가 결과를 `Assessment`/`Contribution` 에 영속화하고 **영속 Assessment 식별자**를 응답한다(ADR-0037 §Decision1 "평가 결과가 Assessment/Contribution 에 영속화돼 이후 조회의 source", §Decision4 fresh in-memory collect). 직전 slice T-0316(ephemeral service)·T-0317(User ephemeral endpoint)·T-0321(Admin orchestration service)이 모두 머지됐고, 본 slice 가 Admin 경로의 HTTP 진입을 닫아 R-9(Admin·User 임의 기간 평가문 요청)의 마지막 backbone wire 를 잇는다.

## Required Reading

- `docs/decisions/ADR-0037-period-collection-evaluate-bridge.md` — §Decision1(Admin full-persist / User ephemeral 2 경로)·§Decision3(amended first-write-wins read-through — 같은 좌표 재호출은 409 아닌 기존 식별자/결과 반환)·§Decision4(fresh collect source-of)·§Follow-ups slice 3/4 경계. slice 4(RBAC) 경계는 아래 Out of Scope 참조.
- `src/assessment-evaluation/assessment-evaluation.controller.ts` — **기존 controller**. T-0317 이 `POST /api/assessment-evaluation/period` 에 `@Roles("User")` + `@CurrentUser("sub")` self-only ephemeral 경로를 이미 박제. 본 slice 가 같은 endpoint 에 Admin 분기를 추가하거나(권장 — 아래 결정) 별도 endpoint 를 신설할지 결정한다.
- `src/assessment-evaluation/period-bridge-admin-persist.service.ts` — 위임 대상 `generateAndPersist(person, period, options, context)` → `{ assessment: Assessment, created: boolean }`. `assessment.id` 가 영속 식별자. person 은 **resolved**(`serviceIdentities`) 입력, context 는 `EvaluationPersistContext`(personId/period/scope/periodStart) 4-tuple.
- `src/assessment-evaluation/period-bridge-ephemeral.service.ts` — 이미 wire 된 User 경로 위임 대상 `generateEphemeral(person, period, options)`. Admin 분기와 sibling.
- `src/assessment-evaluation/dto/period-bridge.dto.ts` — `@Body()` DTO(personId/period/scope/periodStart/mode). Admin 경로는 context 4-tuple 을 이 DTO 에서 조립(periodStart string → Date 파싱은 기존 evaluate() 패턴 mirror).
- `docs/tasks/T-0317-period-bridge-ephemeral-controller-endpoint.md` — 직전 endpoint slice template(RBAC·self-only·응답 shape 구조 참조).
- `CLAUDE.md` §3.2(R-112 test 4종 + negative cases 충분 cover) / §12(언어 정책).

## 결정해야 할 핵심 설계 질문(본 task 가 RESOLVE — 선택 + 근거 명시)

**Admin 은 기존 `POST /api/assessment-evaluation/period` 와 같은 endpoint 를 role-branching(User→ephemeral / Admin→persist) 으로 쓰는가, 아니면 별도 endpoint 인가?**

**권장 = 같은 endpoint role-branching.** 근거:

1. ADR-0037 §Decision1 은 Admin·User **둘 다 period/personId 를 입력으로 같은 의미의 "임의 기간 평가문 요청"** 을 수행한다 — 차이는 RBAC role 과 영속화 여부일 뿐 입력 계약(`PeriodBridgeDto`)·좌표 의미가 동일하다. 같은 resource 에 대한 같은 동사이므로 REST 상 같은 endpoint 가 자연스럽다.
2. 기존 controller 의 `period()` 메서드가 이미 `@Roles("User")` 로 박제돼 있고, RBAC role hierarchy(ADR-0008)상 Admin 은 User+ escalation 으로 이 endpoint 에 도달한다 — Admin 이 들어왔을 때 role 에 따라 분기(Admin→persist / User→ephemeral)하면 하나의 endpoint 가 두 경로를 dispatch 한다.
3. 단, **현재 `period()` 의 self-only 강제(`principalUserId !== dto.personId` → 403)는 Admin 의 "임의 personId" 허용과 충돌**한다 — Admin 은 타인 personId 를 target 할 수 있어야 한다(§Decision1). 본 slice 는 role dispatch 분기를 추가하되, **Admin 의 임의-personId 허용 vs User self-only 의 정밀한 guard 강화는 slice 4 로 분리**한다(아래 boundary). 본 slice 의 최소 변경은 `@Roles("User")` 단일 메서드 안에서 role 을 판별해(예: `@CurrentUser()` principal 의 role 또는 별도 role 추출) Admin 이면 self-only 검사를 우회하고 persist 경로로, User 면 기존 self-only ephemeral 경로로 dispatch 하는 것이다.

택한 접근(role dispatch 구현 방식 — 예: principal role 판별 source, Admin 분기의 self-only 우회)과 근거를 controller 주석 + PR 본문에 명시한다. 별도 endpoint 를 택할 경우 그 근거(예: self-only guard 와 Admin arbitrary-personId 의 guard-level 충돌 회피)를 명시하되, 권장은 같은 endpoint 다.

## slice 3 / slice 4 경계(어디서 선을 긋는가)

- **slice 3(본 task)** = controller wiring + 응답 shape + role dispatch. 즉 (a) Admin 분기에서 `PeriodBridgeAdminPersistService.generateAndPersist` 위임, (b) context 4-tuple(personId/period/scope/periodStart) 조립(기존 `evaluate()` 의 periodStart Date 파싱 mirror), (c) Admin 응답 body(영속 Assessment 식별자 — `assessment.id` + 필요한 좌표/created 플래그) 정의, (d) User 경로는 기존 ephemeral 그대로 유지.
- **slice 4(defer)** = Admin 임의-personId 허용 vs User self-only(personId 동등성)의 **RBAC guard 강화**. T-0317 이 User self-only(`principalUserId !== dto.personId` → 403)를 이미 controller 에 박제했으므로, slice 4 는 그 강제가 Admin 에는 적용되지 않고(임의 personId 허용) User 에만 적용되도록 guard 또는 orchestration 진입에서 정밀화하는 책임이다.
- **본 slice 가 self-contained 일 수 있는 조건**: Admin 분기가 **새 self-only 로직 없이** `@Roles` escalation + 기존 guard + Admin 의 self-only 검사 우회(Admin 은 arbitrary personId 허용이므로 동등성 검사를 타지 않음)만으로 닫히면 slice 3 는 self-contained 다. 본 task 는 **slice3/slice4 선이 정확히 어디인지 + 무엇을 defer 하는지** controller 주석/PR 본문에 명시한다. role dispatch 로 인해 누적 변경이 cap(300 LOC / 5 파일)에 근접하면 self-only guard 정밀화는 slice 4 로 미루고 본 slice 는 role dispatch + 응답 shape 까지만 닫는다.

## Acceptance Criteria

- [ ] `POST /api/assessment-evaluation/period` 에 Admin role 분기 추가(권장 — 같은 endpoint role-branching). Admin 이면 `PeriodBridgeAdminPersistService.generateAndPersist(person, { since }, options, context)` 에 위임, User 면 기존 `PeriodBridgeEphemeralService.generateEphemeral` ephemeral 경로 유지. role dispatch 방식·근거를 controller 주석에 명시.
- [ ] Admin 분기 응답 shape 정의 — 영속 Assessment 식별자(`assessment.id` + 필요한 좌표 정보 / created 플래그)를 반환(§Decision1 "영속화돼 이후 조회의 source"). User 분기는 기존대로 `EvaluationResult[]` ephemeral 반환(변경 0). 응답 interface 를 export 하고 주석으로 role 별 body 차이 박제.
- [ ] context 4-tuple(personId/period/scope/periodStart) 조립 — DTO 에서 personId/period/scope 전사 + periodStart `new Date(...)` 파싱(기존 `evaluate()` 패턴 mirror). person 은 `PersonService.findByIdWithIdentities` 로 resolve(row 부재 시 그 service 가 404 전파 — controller 추가 분기 0).
- [ ] **happy-path unit test 1+**(Admin): Admin role 호출 → `generateAndPersist` 1회 위임 + 반환 `assessment.id` 가 응답에 박제(orchestrator/service·PersonService mock, 실 LLM/DB/네트워크 0).
- [ ] **happy-path unit test 1+**(User 회귀): User role 호출 시 기존 ephemeral 경로 그대로(generateEphemeral 위임 + `EvaluationResult[]` 반환, persist 미호출) — 회귀 방지.
- [ ] **error path unit test 1+**: Admin 분기에서 위임 service reject(예: evaluateActivities throw / persist 비-Conflict error) 시 raw 전파(swallow 0) 검증.
- [ ] **flow / 분기 cover**: role dispatch 분기마다 test 분리 — Admin 분기 1+ / User 분기 1+ (각 분기 cover). person 미존재(PersonService NotFoundException 404 전파) 분기 1+.
- [ ] **negative cases 충분 cover**(예외 처리 분기마다 1+): (a) Admin 잘못된 DTO → 400(ValidationPipe 통합 — 본 unit 에서는 ValidationPipe 가 controller 에 wire 됨을 구조/메타데이터로 확인), (b) 인증 부재 → 401(guard 강제 — guard 메타데이터 확인), (c) role 미달/잘못된 role → 403(RolesGuard 강제 — 메타데이터/분기 확인), (d) person-not-found → 404 전파(PersonService throw pass-through). 단일 negative 만으로 부족 — 위 각 1+.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — colocated spec 위치는 `src/assessment-evaluation/assessment-evaluation.controller.spec.ts`(기존 controller spec 에 Admin 분기 case 추가). 신설 controller 를 택했다면 그 colocated spec.
- [ ] `pnpm lint && pnpm build && pnpm test` green(tester 가 확인).
- [ ] PR 본문에 (a) 택한 endpoint 접근(같은 endpoint role-branching vs 별도) + 근거, (b) slice3/slice4 경계(self-only guard 정밀화 = slice 4 defer 여부), (c) "smoke/e2e(Admin full-persist round-trip + first-write-wins read-through idempotency)는 ADR-0037 slice 5 후속" 명시.

## Out of Scope

- **slice 4 RBAC guard 강화** — Admin 임의-personId 허용 vs User self-only(personId 동등성, fail-closed)의 정밀 guard/orchestration 진입 강제. T-0317 이 User self-only(`principalUserId !== dto.personId` → 403)를 이미 박제했으므로, 본 slice 는 role dispatch + Admin 의 self-only 우회까지만. 새 self-only 로직이 본 slice 를 cap 초과로 밀면 slice 4 로 defer(본문 경계 참조).
- **slice 5 e2e** — Admin full-persist round-trip(실 PostgreSQL 영속 검증) + first-write-wins read-through idempotency(같은 좌표 2번째 호출 → 기존 반환, **409 아님**, row 증가 0) + 동시 호출 수렴(같은 좌표 동시 2호출 → 최종 row 1 + 양쪽 동일 결과). ADR-0004 실 PostgreSQL — 후속.
- **DEFERRED overwrite / 이미 영속화된 평가문 재평가** — ADR-0037 §Follow-ups DEFERRED. 본 slice 는 first-write-wins read-through(create-if-absent-else-read)만 — `reeval` 호출 0, `generateAndPersist` 가 mode 항상 "fill". DTO 의 `mode` 입력은 Admin 분기에서 reeval 로 baking 금지.
- **live LLM round-trip** — §Decision5 credential 게이트 deferred(mocked-LLM unit 만).
- **timezone(Q-0026)** — since 도출/timezone 정책은 본 slice 밖. periodStart 는 DTO pass-through + Date 파싱만.
- **새 외부 dependency / DB schema 변경 / 새 credential** — 0(전부 기존 재사용: `PeriodBridgeAdminPersistService`/`PeriodBridgeEphemeralService`/`PersonService`/기존 guard). 발생 시 §5 BLOCKED.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0037 §Decision1/3/4 가 FIRM 박제, T-0317 endpoint 패턴 + T-0321 service 위임 계약 mirror).

## Follow-ups

- slice 4 — RBAC guard 강화(Admin 임의-personId 허용 / User self-only personId 동등성 fail-closed). T-0317 의 User self-only 박제 위에서 Admin 우회 경로 정밀화 + negative(타인 personId User → 403 / Admin 임의 personId 허용 / principal sub 부재 → deny).
- slice 5 — e2e(ADR-0004 실 PostgreSQL): Admin full-persist round-trip(평가 결과 영속 검증) + first-write-wins read-through idempotency(같은 좌표 2번째 호출 → 기존 식별자/결과 반환, **409 아님**, row 증가 0) + 동시 호출 수렴(같은 좌표 동시 2호출 → 최종 row 1 + 양쪽 동일 결과, 409 전파 없음).
- (DEFERRED) overwrite / 이미 영속화된 평가문 재평가(replace existing — ADR-0033 reeval/reset-and-recreate delete→create). 별도 후속 ADR/task(Q-0032 지시).
