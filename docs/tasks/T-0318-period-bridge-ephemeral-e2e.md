---
id: T-0318
title: period bridge ephemeral endpoint e2e (User self-only round-trip + DB-write-0) 추가
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-045]
estimatedDiff: 190
estimatedFiles: 1
created: 2026-06-10
plannerNote: P5 ADR-0037 slice5 e2e의 ephemeral-only 부분 — User self-only round-trip+403/404+DB-write-0, 기존 e2e infra 재사용, Admin-persist/idempotency(§Decision2·3) 제외
---

# T-0318 — period bridge ephemeral endpoint e2e (User self-only + DB-write-0)

## Why

ADR-0037 §Follow-ups slice 5(e2e)의 **ephemeral 경로 부분만** 박제한다 — 머지된 `POST /api/assessment-evaluation/period` endpoint(T-0317, ADR-0037 §Decision1 User self-only ephemeral + §Decision4 fresh in-memory collect)를 실 PostgreSQL(ADR-0004) 위에서 end-to-end round-trip 검증한다. controller/service unit 은 위임 단위만 cover 했으므로, 본 e2e 가 **실 guard stack(JwtAuthGuard→RolesGuard) + self-only fail-closed + PersonService 404 전파 + 가장 중요한 DB-write-0**(ephemeral 호출이 Assessment/Contribution/Summary row 를 0 건 생성)를 닫는다. README R-9(임의 기간 평가문 요청, PLAN P5 L98)의 User 경로가 보안 모델(User read-only)을 위반하지 않음을 spec 으로 회귀 차단한다. **Admin full-persist round-trip + 동시 호출 idempotency(§Decision2 double-write / §Decision3)는 ADR-0037 에서 PROPOSE 상태(사용자 ADR PR 검토 대기)라 본 task 가 일절 baking 하지 않는다 — slice 5 의 나머지는 §Decision2/3 ACCEPTED 후 별도 task.**

## Required Reading

- `docs/decisions/ADR-0037-period-collection-evaluate-bridge.md` — §Decision1(User self-only ephemeral, fail-closed)·§Decision4(fresh collect source-of)·§Consequences "ephemeral write-0 의 구조적 강제"·§Follow-ups slice 5. **§Decision2/§Decision3(Admin persist/idempotency)은 PROPOSE — 본 task 범위 밖(읽되 baking·검증 금지).**
- `src/assessment-evaluation/assessment-evaluation.controller.ts` — 검증 대상. `POST /period`(`@Roles("User")`, `@CurrentUser("sub")` self-only fail-closed → 403, `PersonService.findByIdWithIdentities` 404 전파, persist 호출 0). **핵심 wiring 사실**: self-only 검사는 JWT `sub` 와 `dto.personId` 동등성을 본다.
- `test/e2e/assessment-collection-trigger.e2e-spec.ts` — **1:1 mirror 할 e2e 템플릿**. `createAuthenticatedE2EApp` + `buildAuthCookie` + 실 Person seed(빈 serviceIdentities → no-network) + `prisma.assessment.count()` DB-row assertion + 401/403/404/400 negative 패턴. 본 task 가 가장 가깝게 따른다.
- `test/helpers/auth-e2e-helper.ts` — `createAuthenticatedE2EApp([{ role, email }])` 가 `tokens`(email 키)·`users`(User row, `id`)·`prisma`·`jwtService` 반환. **JWT `sub` = `User.id`**(`issueAccessTokenFor` line 95~98). `buildAuthCookie(token)`.
- `prisma/schema.prisma` (model Person line 55, model User line 170) — **User 와 Person 은 별개 model, 각자 `cuid()` id, FK 연결 없음**. self-only happy-path 는 `sub(User.id) == dto.personId(Person.id)` 를 요구하므로 **seed 시 Person.id 를 User.id 와 동일하게 명시 생성**해야 한다(`prisma.person.create({ data: { id: ctx.users[email].id, fullName, email } })`). 이 nuance 를 반드시 처리(아래 Acceptance §happy 참조).
- `package.json` (script `test:e2e` line 21) — `jest --config ./test/jest-e2e.json`. CI 가 본 step 으로 e2e 실행(실 PostgreSQL, ADR-0004 DATABASE_URL 기 주입).

## Acceptance Criteria

새 e2e spec `test/e2e/period-bridge-ephemeral.e2e-spec.ts` 1 개를 추가한다. `assessment-collection-trigger.e2e-spec.ts` 의 `beforeAll(createAuthenticatedE2EApp [User+Admin]) / afterAll(close+$disconnect) / afterEach(truncateAll)` 구조를 mirror. 모든 case 가 실 guard·실 PostgreSQL 위에서 round-trip.

- [ ] **happy-path round-trip** — User 토큰 + `dto.personId == sub(User.id)` 인 Person(빈 serviceIdentities, **id 를 User.id 와 동일하게 명시 seed**) → 200 + body 가 `EvaluationResult[]`(빈 serviceIdentities 라 빈 수집 → 빈 배열, `Array.isArray(body) === true`). no-network(collectActivities 빈 spec → fetch 0, LLM 호출 0)로 실 외부 의존 0.
- [ ] **DB-write-0 (가장 중요)** — 위 happy 호출 **직후** `prisma.assessment.count()` / `prisma.contribution.count()` / `prisma.summary.count()` 가 모두 **0**(ephemeral 경로가 어떤 영속 row 도 생성하지 않음). §Decision1 ephemeral write-0 의 회귀 차단 spec — 이 assertion 이 본 task 의 핵심 가치.
- [ ] **error path 1: self-only 403** — User 토큰 + `dto.personId != sub`(타인 Person id) → 403 ForbiddenException + Assessment/Contribution/Summary count 0(타인 평가문 요청 차단, fail-closed).
- [ ] **error path 2: 401 인증 부재** — cookie 없이 호출 → 401 + DB row 0. (선택 추가: invalid JWT cookie → 401.)
- [ ] **error path 3: 404 Person 부재** — User 토큰 + `dto.personId == sub` 이되 그 id 의 Person row 미존재(User 만 seed, Person 미seed) → 404(PersonService.findByIdWithIdentities NotFoundException 전파) + DB row 0. self-only 통과 후 person resolve 단계에서 404 됨을 검증.
- [ ] **branch/negative: 400 validation** — User 토큰 + 빈 body(필수 필드 누락) → 400, 그리고 정의 외 raw 필드 포함 → 400(forbidNonWhitelisted) + DB row 0. (period/scope literal 검증은 DTO 가 @IsIn 미적용이므로 형식 위반만 cover.)
- [ ] **negative cases 충분 cover** — 위 self-only 403 / 401 / 404 / 400×2 가 예외 분기별 1+ 를 채운다(단일 negative 만으로 부족 — 각 fail-closed 분기 cover). 각 negative 가 DB-write-0 도 동반 검증.
- [ ] `pnpm test:e2e` 통과(실 PostgreSQL, CI). 본 task 는 e2e spec 만 추가하므로 production code 변경 0 — `tester` 가 `pnpm lint && pnpm build && pnpm test:e2e` 결과를 확인(R-110).
- [ ] coverage: 본 task 는 신규 production symbol 0(e2e spec 만)이라 `coverageThreshold`(unit `test:cov` line/function ≥ 80%) 회귀 0 — 기존 unit coverage 불변 확인(새 src 파일 미추가).

## Out of Scope

- **Admin full-persist round-trip 검증** — §Decision2(double-write 일원화) PROPOSE 의존. Admin 경로 자체가 아직 미구현(controller `POST /period` 는 User-only). §Decision2/3 ACCEPTED + Admin slice 머지 후 별도 e2e task.
- **동시 호출 idempotency 검증**(같은 좌표 동시 2 호출 → 최종 row 1 + 409) — §Decision3 PROPOSE 의존, Admin persist 경로 전제. 본 task 밖.
- **live-LLM round-trip**(실 endpoint/key 평가문 품질 검증) — §Decision5 credential 게이트 deferred(Q-0022 시험 credential 만료 2026-06-30). 본 task 는 no-network mocked 경로만.
- **production code 변경** — controller/service/DTO 는 T-0315~T-0317 에서 머지 완료. 본 task 는 e2e spec 추가만. 만약 검증 중 결함 발견 시 즉시 고치지 말고 Follow-ups 에 기록(patch task 분리).
- **새 e2e helper/auth infra 발명** — 기존 `createAuthenticatedE2EApp`/`buildAuthCookie`/`truncateAll` 재사용만. 새 helper 가 필요하다고 판단되면 BLOCKED 로 escalate(make-work 회피).

## Suggested Sub-agents

`tester` (e2e spec 작성이 본체 — 새 production symbol 0). 필요 시 `implementer → tester` 이나, 코드 변경이 없으므로 `tester` 단독 권장.

## Follow-ups

(생성 시 비어 있음. sub-agent 가 관련 작업 발견 시 append — 특히 Admin-persist e2e / idempotency e2e 는 §Decision2/3 ACCEPTED 후 별도 task 라는 점 명시.)
