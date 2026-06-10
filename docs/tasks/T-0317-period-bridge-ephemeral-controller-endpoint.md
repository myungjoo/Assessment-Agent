---
id: T-0317
title: period bridge ephemeral controller endpoint (User self-only, persist 0) 추가
phase: P5
status: DONE
completedAt: 2026-06-10T11:46:00+09:00
mergedAs: e01a4d5
prNumber: 266
reviewRounds: 1
commitMode: pr
coversReq: [REQ-009, REQ-045]
estimatedDiff: 135
estimatedFiles: 2
created: 2026-06-10
plannerNote: P5 ADR-0037 §Decision1/4 FIRM ephemeral-only slice3 — 기존 auth infra 재사용(§5 미발화), Admin-persist/§Decision2·3 제외, R-112 backbone ×1.5
---

# T-0317 — period bridge ephemeral controller endpoint (User self-only, persist 0)

## Why

ADR-0037 §Follow-ups slice 3(controller endpoint)의 **FIRM 부분만** 박제한다 — `POST /api/assessment-evaluation/period` 가 인증된 User 가 **자기 자신**의 임의 기간 평가문을 요청하면(self-only) `PeriodBridgeEphemeralService.generateEphemeral` 에 위임해 `EvaluationResult[]` 를 **DB write 0** 로 반환한다(README R-9 / PLAN P5 L98 User 경로, §Decision1 User self-only ephemeral + §Decision4 fresh in-memory collect). 직전 slice T-0315(입력 DTO)·T-0316(ephemeral orchestration service)이 머지됐고 본 slice 가 HTTP 진입을 닫는다. **Admin full-persist 경로(§Decision2 double-write / §Decision3 idempotency)는 ADR-0037 에서 PROPOSE 상태(사용자 ADR PR 검토 대기)라 본 task 가 일절 baking 하지 않는다.**

## Required Reading

- `docs/decisions/ADR-0037-period-collection-evaluate-bridge.md` — §Decision1(User self-only ephemeral, fail-closed)·§Decision4(fresh collect source-of)·§Follow-ups slice 3. §Decision2/§Decision3 은 PROPOSE — 본 task 범위 밖(읽되 baking 금지).
- `src/assessment-evaluation/period-bridge-ephemeral.service.ts` — 위임 대상 `generateEphemeral(person, period, options)`. person 은 **resolved**(`serviceIdentities`) 입력을 요구.
- `src/assessment-evaluation/dto/period-bridge.dto.ts` — `@Body()` DTO(personId/period/scope/periodStart/mode). 본 endpoint 는 ephemeral 이므로 mode 는 무시.
- `src/assessment-evaluation/assessment-evaluation.controller.ts` — 기존 controller(같은 `@Controller("api/assessment-evaluation")`). 본 endpoint 를 여기에 추가하거나 별도 controller 로 분리할지 결정(같은 path prefix 유지).
- `src/user/assessment.controller.ts` — RBAC + `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles` + controller-scope ValidationPipe 패턴 mirror.
- `src/auth/current-user.decorator.ts` — `@CurrentUser("sub")` 로 principal userId 추출(self-only 동등성 검사 source).
- `src/user/person.service.ts` (L99-109) — `findByIdWithIdentities(personId)` → resolved person(404 on missing). controller 가 personId → resolved person 변환에 재사용.

## Acceptance Criteria

- [ ] `POST /api/assessment-evaluation/period` endpoint 추가 — `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("User")`(User+ escalation), controller-scope ValidationPipe(whitelist + forbidNonWhitelisted + transform), `@Body() PeriodBridgeDto` 수신.
- [ ] **self-only 강제(fail-closed)**: `@CurrentUser("sub")` 의 principal userId 가 `dto.personId` 와 **일치할 때만** 진행. 불일치 시 403(ForbiddenException) — 타인 평가문 요청 차단. principal sub 이 undefined/null 이면 deny(fail-closed).
- [ ] personId → resolved person 변환은 `PersonService.findByIdWithIdentities(dto.personId)` 재사용(존재하지 않으면 그 service 가 NotFoundException 404 전파 — controller 추가 분기 0).
- [ ] resolved person 의 `serviceIdentities` 를 `{ serviceIdentities }` 로 조립해 `generateEphemeral(person, { since? }, { modelId? })` 에 위임하고 반환 `EvaluationResult[]` 를 그대로 200 으로 응답(가공 0). **persist 호출 0**(영속 식별자 반환 안 함 — ephemeral).
- [ ] **happy-path unit test 1+**: self == personId 인 User 가 호출 → `generateEphemeral` 1회 위임 + 반환 결과 그대로 응답(orchestrator·PersonService mock, 실 LLM/DB/네트워크 0).
- [ ] **error path unit test 1+**: self != personId(타인 personId) → 403, 위임(`generateEphemeral`) 미호출 검증.
- [ ] **flow / 분기 cover**: principal sub undefined(fail-closed deny) 분기 1+ test, person 미존재(PersonService NotFoundException 전파) 분기 1+ test.
- [ ] **negative cases 충분 cover**: 타인 personId(403) + principal sub 부재(deny) + person 404(NotFound 전파) 각 1+ test(예외 처리 분기마다 cover). DTO 검증(필수 누락 / wrong-type / 정의 외 필드 → 400)은 ValidationPipe 통합으로 확인하되, e2e 가 부재하므로 본 unit 에서는 ValidationPipe 가 controller 에 wire 됨을 메타데이터/구조로 확인.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — colocated spec 위치는 `src/assessment-evaluation/assessment-evaluation.controller.spec.ts`(기존 controller 에 추가 시) 또는 신설 controller 의 colocated spec.
- [ ] `pnpm lint && pnpm build && pnpm test` green(tester 가 확인).
- [ ] PR 본문에 "smoke/e2e(실 PostgreSQL round-trip + User ephemeral DB-write-0 검증)는 ADR-0037 slice 5 후속" 명시.

## Out of Scope

- **Admin full-persist 경로** — `@Roles("Admin")` collect→evaluate→persist 분기, `EvaluationResultPersistService.persist` 호출, 영속 식별자(assessmentId/contributionCount) 반환은 본 task 밖(ADR-0037 §Decision2/§Decision3 PROPOSE 의존 — 사용자 ADR PR 검토 후 별도 slice).
- **ADR-0037 §Decision2(double-write 경계)·§Decision3(idempotency) 의 어떤 semantics 도 baking 금지** — `@@unique`/P2002→Conflict/mode(fill·reeval) 분기 0. 본 endpoint 는 write 0 이라 무관.
- **새 auth/permission model 도입 금지** — 기존 `JwtAuthGuard`/`RolesGuard`/`@Roles`/`@CurrentUser`/`PersonService.findByIdWithIdentities` 재사용만. 새 guard/decorator/role 의미/escalation 매핑 변경 0.
- **e2e / 실 PostgreSQL / 동시 호출 idempotency 검증** — ADR-0037 slice 5(후속).
- **live LLM round-trip** — §Decision5 credential 게이트 deferred(mocked-LLM unit 만).
- **새 외부 dependency / DB schema 변경 / 새 credential** — 0(전부 기존 재사용). 발생 시 §5 BLOCKED.
- **since 도출 로직** — `period.since` pass-through(SinceDerivationService 도출은 Admin/collection 책임). 본 endpoint 는 dto 가 주는 기간 입력만 forward.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0037 §Decision1/4 가 FIRM 박제, 기존 패턴 mirror).

## Follow-ups

(없음 — 생성 시점)
