---
id: T-0240
title: UserInstanceAccess grant/revoke controller e2e spec (ADR-0027 grant chain slice 4)
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-016, REQ-044]
estimatedDiff: 330
estimatedFiles: 1
created: 2026-06-05
plannerNote: P4 ADR-0027 grant chain slice 4(e2e) — POST/DELETE /api/users/:id/instance-access 실 guard+DB round-trip, R-113 gap closeout. grant chain 종결.
sizeExempt: true
exemptReason: "e2e single-file spec — permission-denied-records.e2e-spec.ts(344 LOC 단일 파일) precedent. happy grant/revoke + 7 negative(403 non-Admin·403 self·409 dup·204 revoke-absent·404 unknown·400 invalid·401 unauth) 를 한 describe 에 colocate. 파일 1 개라 5-파일 cap 무관, LOC 만 ~330 으로 cap 근처 — split 시 e2e seed/teardown 보일러플레이트 중복이 더 큼."
---

# T-0240 — UserInstanceAccess grant/revoke controller e2e spec (ADR-0027 grant chain slice 4)

## Why

ADR-0027 grant chain 의 slice 1(service, T-0237)·slice 2(controller, T-0238)·slice 3(api.md doc-sync, T-0239)가 모두 merged 됐으나, `POST/DELETE /api/users/:id/instance-access` 의 **실 guard stack + 실 PostgreSQL round-trip** e2e 가 부재한다(`test/e2e/` 에 instance-access 매칭 0 — 확인됨). R-113(unit 외 e2e 도 CI 수행)·CLAUDE §3.2 충족을 위해, 다른 10 RBAC controller(persons/groups/parts/summaries/permission-denied-records 등)와 동형의 e2e 를 신설한다. 본 task 완료로 ADR-0027 grant chain 이 종결되고 ADR-0024 의 "safe but useless"(non-Admin 영구 빈 audit) gap 이 닫힌다(REQ-016 권한 분리 / REQ-044 instance binding).

## Required Reading

- `src/user-instance-access/user-instance-access.controller.ts` — endpoint surface(`@Controller("api/users/:id/instance-access")`, POST grant 201 / DELETE revoke 204 `@HttpCode(204)`, `@Roles("Admin")`, `@UsePipes(ValidationPipe whitelist+forbidNonWhitelisted+transform)`).
- `src/user-instance-access/user-instance-access.service.ts` — grant/revoke 의 판별 책임(self-grant/revoke 403, P2002→409 dup, P2003→404 unknown user, revoke-absent idempotent no-op).
- `src/user-instance-access/grant-instance-access.dto.ts` — `{ instanceRef: string }` 검증 규칙(누락/빈값/wrong type/allow-list 밖 키 → 400).
- `test/e2e/permission-denied-records.e2e-spec.ts` — 1:1 mirror 할 e2e 패턴(`createAuthenticatedE2EApp` 다중 actor seed, `buildAuthCookie`, `afterEach(truncateAll)`, `afterAll(app.close + prisma.$disconnect)`, RBAC negative 섹션 구성).
- `test/helpers/auth-e2e-helper.ts` — `createAuthenticatedE2EApp([{role,email}])` 반환 surface(`users` = email→User 객체(`.id` 보유), `tokens` = email→token). target user 의 path `:id` 는 `ctx.users[email].id` 로 획득.
- `test/helpers/db-truncate.ts` — `TRUNCATE_TABLES` 에 `"User"` 가 있고 `UserInstanceAccess` 는 `onDelete: Cascade`(schema L221)라 User truncate CASCADE 로 동반 정리됨(별도 테이블 추가 불요). 단 본 task 진행 중 cascade 가 binding row 를 실제로 정리하는지 happy 후 잔여 검증 1 회로 확인.
- `prisma/schema.prisma` L214–227 — `UserInstanceAccess` 모델(`@@unique([userId, instanceRef])` → dup 시 P2002→409, `userId` FK → unknown user 시 P2003→404).

## Acceptance Criteria

전부 `test/e2e/user-instance-access.e2e-spec.ts` **단일 colocated e2e 파일**(testRegex `.*\.e2e-spec\.ts$` picking)로 작성. `pnpm test:e2e`(CI 의 e2e step, 실 PostgreSQL) 에서 자동 실행. 로컬 DATABASE_URL 부재 시 CI 에서만 실행되는 점은 permission-denied-records.e2e-spec.ts 와 동일.

**Happy path (R-112 #1):**
- [ ] grant happy — Admin token + 존재하는 target user 의 `:id` 로 `POST /api/users/:id/instance-access` `{ instanceRef }` → 201 + 생성된 binding(`userId`/`instanceRef`/`id`/`createdAt`) 응답. DB 에 row 실 영속 확인(`prisma.userInstanceAccess.findFirst`).
- [ ] revoke happy — 위 grant 로 생성된 binding 을 Admin token + 동일 `:id`/`instanceRef` 로 `DELETE` → 204 No Content(body 없음) + DB row 실 삭제 확인.
- [ ] SuperAdmin escalation — SuperAdmin token 으로 grant 201(RolesGuard escalation hierarchy descent, permission-denied B.2 mirror).

**Error / negative cases (R-112 #2·#4 — 예외 분기마다 1+):**
- [ ] non-Admin(User token) grant → 403(RolesGuard tier 미달). revoke 도 동일 403 별도 케이스.
- [ ] self-grant(actor.sub == path `:id`, Admin actor 가 자기 자신 대상) → 403(ForbiddenException, service 판별). self-revoke 도 403 별도 케이스.
- [ ] 중복 grant(동일 (userId, instanceRef) 2 회) → 2 번째 409(P2002→ConflictException).
- [ ] revoke-absent(존재하지 않는 binding 회수) → 204 idempotent no-op(404/500 아님 명시 assert).
- [ ] unknown user(존재하지 않는 `:id`) grant → 404(P2003→NotFoundException).
- [ ] invalid instanceRef(body `{}` 누락 / `{ instanceRef: "" }` 빈값 / wrong type / allow-list 밖 키) → 400(ValidationPipe). 최소 2 변형(누락 + 빈값) cover.
- [ ] unauthenticated — cookie 부재 → 401(JwtAuthGuard). invalid JWT cookie → 401 별도 케이스.

**Flow / branch (R-112 #3):**
- [ ] grant 201 vs revoke 204 의 status 분기, Admin pass vs User 403 분기, self 403 vs non-self pass 분기를 각 별도 it 으로 분리(위 케이스들이 이미 분기별 cover — 누락 분기 없음 확인).

**Coverage / CI:**
- [ ] `pnpm test:e2e` 통과(실 DB round-trip green). 본 e2e 는 production 신규 symbol 0(이미 머지된 controller/service 검증)이라 unit coverage 수치 변동 없음 — `pnpm test:cov`(line ≥ 80% / function ≥ 80%) 도 회귀 없이 통과.
- [ ] `pnpm lint && pnpm build` green.
- [ ] tester 가 `pnpm lint && pnpm build && pnpm test && pnpm test:e2e` 결과를 TESTER trail 에 박제(R-110).

## Out of Scope

- controller/service/DTO/schema 로직 변경 — slice 1·2 머지 완료. 본 task 는 e2e spec 추가만.
- smoke spec(prisma 모델 create/read round-trip) 신설 — 본 task 는 HTTP+guard e2e 만. smoke 가 별도 필요하면 Follow-up.
- api.md/modules.md doc 변경 — slice 3(T-0239) 완료. drift 발견 시 즉시 고치지 말고 Follow-up.
- `TRUNCATE_TABLES` 에 `"UserInstanceAccess"` 명시 추가 — User CASCADE 로 충분(Required Reading 확인). cascade 가 실제 정리 안 함이 드러나면(예: 향후 FK 변경) 그때 별도 task. 본 task 에서 db-truncate.ts 변경 금지.
- non-Admin own-instance positive 필터 / GET 조회 endpoint — 별개 milestone(§5 게이트).
- live token / 실 외부 네트워크 — 본 e2e 는 in-process 실 DB 만(외부 credential 0).

## Suggested Sub-agents

`implementer → tester` (신규 production symbol 0 — architect 불요. 머지된 controller/service 동작을 e2e 로 박제만).

## Follow-ups

(none yet)
