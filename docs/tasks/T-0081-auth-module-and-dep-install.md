---
id: T-0081
title: AuthModule scaffold + @nestjs/jwt + @nestjs/passport + bcrypt dep install — ADR-0008 후속 chain BLOCKED 게이트 (사용자 결정 필수)
phase: P3
status: BLOCKED
blockedAt: 2026-05-28T02:05:02+09:00
hqId: HQ-0011
commitMode: pr
coversReq: [REQ-043, REQ-044, REQ-045]
estimatedDiff: 200
estimatedFiles: 5
sizeExempt: false
created: 2026-05-28
dependsOn: [T-0079, T-0080]
plannerNote: session #22 turn 10 cap-close — driver inline planner (T-0075 session #21 cap-close precedent 패턴). ADR-0008 후속 chain 의 BLOCKED 게이트 task — @nestjs/jwt + @nestjs/passport + @nestjs/passport-jwt + bcrypt 신규 dep 4 종 install 필요 → CLAUDE.md §5 "새 외부 dependency 추가" trigger 발화 예상. executor 시작 시 implementer 가 package.json 변경 시도 → BLOCKED return → notifier 가 HQ-NNNN raise (사용자 결정: install 진행 OR pivot OR partial scope). 사용자 unblock 후에 AuthModule scaffold (AuthService.hashPassword + verifyPassword + JWT issue/verify) 실 박제.
expectedBlocker: new-dep (CLAUDE.md §5 의 "새 외부 dependency 추가" trigger — ADR-0008 Decision 본문이 @nestjs/jwt + passport + bcrypt 4 패키지 install 을 후속 task chain 으로 deferred 박제. 본 task 의 execute 가 자연 발현)
---

# T-0081 — AuthModule scaffold + dep install (ADR-0008 후속 chain BLOCKED 게이트)

## Why

[ADR-0008](../decisions/ADR-0008-auth-credential-type.md) Decision 본문이 채택한 JWT (HS256) in HttpOnly cookie hybrid 의 실 박제 시작 task. [T-0080](T-0080-user-entity-and-repository.md) 머지 (881cc51, session #22 turn 9) 로 User entity Prisma + UserRepository(create + findByEmail) 박제 완성 → 다음 layer = **AuthModule scaffold + 신규 dep install**.

본 task 가 **ADR-0008 후속 chain 의 BLOCKED 게이트** — 4 종 신규 dep 추가 (`@nestjs/jwt`, `@nestjs/passport`, `@nestjs/passport-jwt`, `bcrypt`) → CLAUDE.md §5 의 "새 외부 dependency 추가" trigger 발화 → executor 진입 시 즉시 BLOCKED return → notifier HQ raise → 사용자 결정 후 unblock path.

## Required Reading

- [docs/decisions/ADR-0008-auth-credential-type.md](../decisions/ADR-0008-auth-credential-type.md) — JWT hybrid 결정 박제 + 후속 chain 박제 (T-0080~T-0083).
- [docs/tasks/T-0080-user-entity-and-repository.md](T-0080-user-entity-and-repository.md) — 직전 layer 박제 (User entity + UserRepository).
- [CLAUDE.md](../../CLAUDE.md) §5 — BLOCKED 처리 조건 ("새 외부 dependency 추가").
- [package.json](../../package.json) — 현재 dep 목록 (변경 대상).

## Acceptance Criteria

### A. Dep install (BLOCKED 게이트 — 사용자 결정 후 진행)

- [ ] `pnpm add @nestjs/jwt @nestjs/passport @nestjs/passport-jwt bcrypt` (production deps).
- [ ] `pnpm add -D @types/bcrypt @types/passport-jwt` (dev deps).
- [ ] `package.json` + `pnpm-lock.yaml` commit.

### B. AuthModule scaffold

- [ ] `src/auth/auth.module.ts` 신설 — JwtModule import (HS256 + AUTH_JWT_SECRET env), PassportModule import, AuthService export.
- [ ] `src/auth/auth.service.ts` 신설 — `hashPassword(plain: string): Promise<string>` (bcrypt 10 rounds) + `verifyPassword(plain: string, hash: string): Promise<boolean>` + `issueAccessToken(userId: string): string` (15min TTL) + `issueRefreshToken(userId: string): string` (7day TTL) + `verifyToken(token: string): JwtPayload`.
- [ ] `src/auth/auth.service.spec.ts` — R-112 4 카테고리 (happy / error / branch / negative).
- [ ] `src/app.module.ts` AuthModule import 추가.

### C. CI / 4-게이트

- [ ] lint / build / test:cov / smoke / e2e green.
- [ ] PR 4-게이트 all PASS.

## Out of Scope

- **Login/logout/refresh endpoint** — T-0082 후속 task.
- **RBAC AuthGuard / role-based decorator** — T-0083 후속 task.
- **User↔Person relation** — 별도 task.

## Suggested Sub-agents

`implementer → tester → reviewer → integrator` (architect=0, ADR-0008 박제 정공법 정합).

## Follow-ups

- T-0082 — login / logout / refresh endpoint (AuthController + cookie set/clear).
- T-0083 — RBAC AuthGuard + @Role() decorator + role-based 권한 invariant.
- estimate-model.md 16 회차 milestone refinement (본 task BLOCKED return + unblock cycle 의 estimate variance 박제 — BLOCKED 자체는 LOC 0, unblock 후 actual LOC vs envelope 비교 데이터).

## Status: BLOCKED

- **blockedAt**: 2026-05-28T02:05:02+09:00
- **reason**: `new-dep` (CLAUDE.md §5 의 "새 외부 dependency 추가" trigger 발화)
- **hqId**: [HQ-0011](../STATE.json) — `docs/STATE.json.humanQuestions[]` 참조
- **신규 dep 6 종**:
  - production: `@nestjs/jwt`, `@nestjs/passport`, `@nestjs/passport-jwt`, `bcrypt`
  - dev: `@types/bcrypt`, `@types/passport-jwt`
- **근거 ADR**: [ADR-0008](../decisions/ADR-0008-auth-credential-type.md) Decision 본문이 JWT (HS256) in HttpOnly cookie hybrid 박제용 4 종 production dep 채택을 deferred 박제 — 본 task 가 실 install 의 게이트.
- **사용자 결정 대기 옵션** (자세히는 HQ-0011 본문):
  1. install 진행 승인 — ADR-0008 정공법대로 6 종 박제 후 AuthModule scaffold.
  2. pivot scope — 다른 auth credential 방식 채택 (ADR-0008 재논의 + 새 ADR).
  3. partial scope — 일부 dep 만 install (예: bcrypt 먼저, passport stack 은 T-0082 deferral).
  4. other — 위 3 옵션이 다 부적합 시 사용자가 대안 명시.
- **Unblock 후 path**: driver [1] STATE 로드 → HQ-0011 `resolvedAt` 검출 → `decision` 분기 → (a) currentTask=T-0081 승격, executor dispatch / (b) T-0081 supersede + 새 ADR task / (c) T-0081 split. counter `tasksBlocked` 는 +1 박제된 채 유지 (resolved 후에도 BLOCKED 발화 사실 박제).
