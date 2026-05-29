---
id: T-0095
taskId: T-0095
title: UserResponseDto 도입 + signup 응답에서 hashedPassword 제거 (보안 risk fix)
phase: P3
status: DONE
commitMode: pr
coversReq: [REQ-043, REQ-044]
estimatedDiff: 200
estimatedFiles: 5
estimatedLoc: 200
dependsOn: [T-0092]
sizeExempt: false
created: 2026-05-29
createdAt: 2026-05-29T17:35:00+09:00
completedAt: 2026-05-29T17:42:00+09:00
actualDiff: 469
actualFiles: 5
actualLoc: 469
mergedAs: d842d35
pullRequest: 89
reviewRound: 1
ciRun: 26627221248
driverNote: "loop session #26 turn 9/10 — driver inline-executor 경로 (executor sub-agent 미dispatch, driver 가 직접 implementer + tester + push + reviewer + integrator 전체 chain 완수). round 1 single-shot first-run pass (post-push first-run reviewer-gate race trigger 0, case-insensitive approve 어휘 1+ 매칭 same-run catch). 실 LOC × 2.34 within R-112 spec mass tolerance (T-0094 ×2.19 + T-0091 ×1.86 + T-0086 ×2.28 + T-0083 ×1.77 precedent 5 회차 누적 정합, scope creep 0). T-0092 active 보안 risk fix application-layer 박제 완결 — POST + PATCH 두 endpoint hashedPassword 응답 누출 차단 + JSON 직렬화 round-trip 검증 + e2e regression guard. defence in depth 2 layer (DB-level bcrypt + HTTP-layer whitelist DTO) 완결. T-0094 e2e body assert 누락 공백 5 곳 regression assert 박제로 보강."
plannerNote: "loop session #26 turn 8/10 — T-0092 follow-up 보안 risk fix (signup 응답 hashedPassword leak 제거). partial-backbone × 1.3 envelope 200 LOC / 5 파일."
---

# T-0095 — UserResponseDto 도입 + signup 응답에서 hashedPassword 제거 (보안 risk fix)

## Why

[T-0092](T-0092-signup-endpoint.md) (MERGED `f97329b` PR-87) 가 `POST /api/users` signup endpoint 를 박제했으나 **응답 body 가 User row 전체 (hashedPassword 컬럼 포함) 를 그대로 노출** — `src/user/user.controller.ts` L17 + L133 + `src/user/user.service.ts` L26-28 의 docstring 에 명시된 **active 보안 risk**. signup 은 Public tier 이므로 누구나 호출 가능 → hashedPassword 가 HTTP 응답에 그대로 직렬화되어 외부로 흘러나간다 (bcrypt 10 rounds 라 rainbow table 공격 비용은 높지만 offline brute-force / GPU cracking 의 attack surface 가 공개됨). 본 task 가 **production 의 첫 active 보안 결함 fix**.

본 task 의 박제 항목:

1. **UserResponseDto 신설** — `src/user/dto/user-response.dto.ts` — User row 의 안전한 응답 shape 만 노출 (id / email / role / createdAt / updatedAt 5 필드, hashedPassword 제외). class 형태 + `fromEntity(user: User): UserResponseDto` static factory 박제.
2. **UserController.signup 응답 변환** — `userService.signup(...)` 결과를 `UserResponseDto.fromEntity()` 로 매핑 후 반환. 반환 type `Promise<User>` → `Promise<UserResponseDto>`.
3. **UserController.changeRole 응답 변환** — 동일 매핑 적용 (changeRole 도 User row 그대로 반환 중 — hashedPassword 누출 동일). T-0087 머지 시점 박제 risk 도 본 task 가 동시 fix.
4. **e2e regression test** — `test/e2e/users.e2e-spec.ts` 의 signup 4 it + changeRole 7 it 의 응답 body 에 `hashedPassword` 키 부재 검증 (각 it 마다 `expect(body).not.toHaveProperty("hashedPassword")` 박제).
5. **api.md 응답 shape doc-amend 는 별도 task** (Out of Scope — direct-mode follow-up).

[ADR-0008 §6 후속 chain](../decisions/ADR-0008-auth-credential-type.md) — _"User entity password 컬럼"_ 의 application-layer 책임 박제. password 가 DB-level 에서는 hashedPassword 컬럼으로 안전 (bcrypt) 하지만, **HTTP-layer 노출 차단** 은 별도 layer 책임. 본 task 가 그 layer 박제.

[README L83-84 REQ-043/REQ-044](../../README.md) — _"모든 사용 기능은 보안사항으로서 ID 와 Password 로 보호"_ — password 자체의 안전한 처리는 보호 의무 의 핵심.

[CLAUDE.md §3.2 R-112](../../CLAUDE.md) — UserResponseDto 와 그 fromEntity factory 가 신규 public symbol → happy/error/branch/negative 4 카테고리 cover 의무. UserController 의 signup/changeRole 메서드 signature 변경 → 기존 unit spec 의 regression 검증 + 신규 응답 shape 의 negative test (hashedPassword 누출 확인) 의무.

## Required Reading

- [src/user/user.controller.ts](../../src/user/user.controller.ts) — UserController PATCH /api/users/:id/role (L106-118) + POST /api/users (L135-139) 박제. 두 endpoint 모두 `Promise<User>` 반환 → `Promise<UserResponseDto>` 로 변경 의무. L17 + L133 의 보안 risk 주석 박제 reference.
- [src/user/user.controller.spec.ts](../../src/user/user.controller.spec.ts) — 기존 unit spec 박제. signup 5 it + changeRole 22 it 의 응답 shape 검증 부분이 본 task 로 영향 — 응답이 User → UserResponseDto 로 변경되므로 spec 의 mock 셋업 + assertion 도 동기 갱신.
- [src/user/user.service.ts](../../src/user/user.service.ts) — UserService.signup (L190-212) + changeRole (L111-162) 박제. 반환 type `Promise<User>` 유지 (service-layer 는 도메인 entity 반환, DTO 변환은 controller layer 책임 — clean separation 정공법 정합).
- [src/user/dto/change-role.dto.ts](../../src/user/dto/change-role.dto.ts) — 정공법 reference (한국어 주석 / Out of Scope / decorator stack — DTO 파일 패턴).
- [src/user/dto/add-user.dto.ts](../../src/user/dto/add-user.dto.ts) — T-0092 박제 reference. AddUserDto 의 파일 구조 + 주석 패턴 1:1 mirror.
- [prisma/schema.prisma](../../prisma/schema.prisma) — User model 정의 (id / email / hashedPassword / role / createdAt / updatedAt). UserResponseDto 의 필드 source.
- [test/e2e/users.e2e-spec.ts](../../test/e2e/users.e2e-spec.ts) — T-0087 + T-0092 박제 e2e. signup 4 it + changeRole 7 it 의 응답 body 검증 박제. 본 task 가 각 it 에 `expect(body).not.toHaveProperty("hashedPassword")` regression 박제.
- [docs/decisions/ADR-0008-auth-credential-type.md §6](../decisions/ADR-0008-auth-credential-type.md) — User entity password 컬럼 박제 reference.
- [docs/architecture/api.md L70](../architecture/api.md) — POST /api/users row 박제. 응답 shape 변경은 본 task 의 코드 fix 후 별도 doc-only direct task 가 row description 갱신 (Out of Scope, follow-up).
- [CLAUDE.md §3.2 R-110~R-114](../../CLAUDE.md) — happy/error/branch/negative + coverage line ≥ 80% AND function ≥ 80% + e2e CI 강제.
- [docs/architecture/estimate-model.md §4](../architecture/estimate-model.md) — partial-backbone × 1.3 multiplier 적용 (단일 신규 DTO + 2 controller 메서드 응답 변환 + e2e regression).

## Acceptance Criteria

### A. `src/user/dto/user-response.dto.ts` 신설

- [ ] [src/user/dto/user-response.dto.ts](../../src/user/dto/user-response.dto.ts) 신설. `UserResponseDto` class export. 다음 필드 박제 (모두 `readonly`):
  - `id: string`
  - `email: string`
  - `role: string`
  - `createdAt: Date`
  - `updatedAt: Date`
- [ ] `UserResponseDto.fromEntity(user: User): UserResponseDto` static factory 메서드 박제 — User row 에서 hashedPassword 제외 5 필드만 picking. `import type { User } from "@prisma/client"`.
- [ ] 파일 상단 한국어 주석 25-30 줄 — 책임 (User entity 의 안전한 HTTP 응답 shape — hashedPassword 차단) + 책임 경계 (도메인 invariant 0, ValidationPipe 0 — 응답 전용 DTO) + ADR-0008 §6 정합 (password 컬럼 HTTP-layer 보호) + REQ-043/REQ-044 cover + Out of Scope (lastLoginAt / passwordChangedAt 등 추가 필드, fromEntities 배열 헬퍼는 후속 task) + 정공법 (entity → DTO 변환은 controller layer 책임, service layer 는 도메인 entity 그대로 반환).

### B. `src/user/dto/user-response.dto.spec.ts` colocated spec (R-112 4 카테고리)

- [ ] [src/user/dto/user-response.dto.spec.ts](../../src/user/dto/user-response.dto.spec.ts) 신설. 다음 it 박제 (≥ 8 it):
  - **happy — fromEntity 정상 변환**: 완전한 User row → UserResponseDto instance, 5 필드 모두 정합.
  - **happy — hashedPassword 제외**: User row 에 hashedPassword="hashed" 박제 → 결과 DTO 에 hashedPassword 키 부재 (`expect(dto).not.toHaveProperty("hashedPassword")`).
  - **happy — Date 객체 보존**: createdAt / updatedAt 이 Date instance 그대로 (string 변환 0).
  - **branch — role "SuperAdmin"**: role="SuperAdmin" 박제 → DTO.role === "SuperAdmin".
  - **branch — role "Admin"**: role="Admin" 박제 → DTO.role === "Admin".
  - **branch — role "User"**: role="User" 박제 → DTO.role === "User".
  - **negative — extra 필드 추가 컬럼 미반영**: User row 에 임의 추가 컬럼 (`{...user, extraField:"x"}`) 박제 → 결과 DTO 에 extraField 키 부재 (whitelist 정합).
  - **negative — partial entity 보호**: id 만 있는 partial entity → fromEntity 호출 시 result.email / role / createdAt / updatedAt 가 undefined (TypeScript type narrowing 우회 시도 시 throw 0, 단순 undefined propagate — 호출자 책임 분리).

### C. `src/user/user.controller.ts` 의 응답 변환

- [ ] [src/user/user.controller.ts](../../src/user/user.controller.ts) 의 `changeRole` 메서드 반환 type 을 `Promise<User>` → `Promise<UserResponseDto>` 로 변경. service 호출 결과를 `UserResponseDto.fromEntity()` 로 매핑 후 반환.
- [ ] 동 controller 의 `signup` 메서드도 동일 매핑 적용 — 반환 type `Promise<UserResponseDto>`.
- [ ] import 추가 — `UserResponseDto` from `./dto/user-response.dto`. `User` import 는 보존 (changeRole / signup 내부에서 service 반환 type 으로 여전히 사용).
- [ ] 한국어 주석 갱신 (L13-18) — "응답 정책 (T-0095)" sub-section 박제: hashedPassword 제거 + UserResponseDto.fromEntity 매핑 + 보안 risk fix 완결 박제 + ADR-0008 §6 정합.

### D. `src/user/user.controller.spec.ts` 의 응답 shape 검증 갱신

- [ ] [src/user/user.controller.spec.ts](../../src/user/user.controller.spec.ts) 의 기존 signup 5 it + changeRole 22 it 박제 보존 + 다음 추가 it 박제 (≥ 4 it):
  - **happy — signup 응답이 UserResponseDto instance**: mockService.signup → User row → controller.signup 반환값이 UserResponseDto instance + hashedPassword 키 부재.
  - **happy — changeRole 응답이 UserResponseDto instance**: 동일 패턴.
  - **negative — signup 응답에 hashedPassword 키 부재**: mockService.signup → `{...user, hashedPassword:"$2b$10$..."}` → controller 반환값에 `hashedPassword` 키 0 (regression test — 본 task 의 핵심 보호).
  - **negative — changeRole 응답에 hashedPassword 키 부재**: 동일 패턴.
- [ ] 기존 5 it + 22 it 의 assertion 중 응답 shape 검증 부분이 영향받으면 (`expect(result).toBe(user)` 같이 entity reference 동일성 비교) UserResponseDto 매핑 후 5 필드 정합 비교로 갱신.

### E. `test/e2e/users.e2e-spec.ts` 의 regression 박제

- [ ] [test/e2e/users.e2e-spec.ts](../../test/e2e/users.e2e-spec.ts) 의 signup 4 it + changeRole 7 it 의 각 happy/branch it 에 `expect(response.body).not.toHaveProperty("hashedPassword")` regression 박제 추가 (최소 6 it — happy + branch only, error/negative it 은 body 가 error response 라 제외).
- [ ] e2e 가 body shape 도 검증하므로 응답 body 가 5 필드 (id / email / role / createdAt / updatedAt) 만 포함하는지 확인 추가 (`expect(Object.keys(response.body).sort()).toEqual(["createdAt", "email", "id", "role", "updatedAt"])` 패턴 1+ it).

### F. CI / 4-게이트

- [ ] `pnpm lint` 통과.
- [ ] `pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 — user-response.dto.ts + user.controller.ts (변경 부분) line ≥ 80% AND function ≥ 80%. 신규 surface (UserResponseDto + fromEntity) 100% cover 의무.
- [ ] `pnpm test:smoke` 통과 — smoke 변경 없음.
- [ ] `pnpm test:e2e` 통과 — users.e2e-spec.ts 전체 (signup 4 + changeRole 7 + 신규 regression assertion) 모두 green + auth.e2e-spec.ts 19 it (T-0094) + persons / groups / parts e2e 모두 green (regression 0).
- [ ] PR 4-게이트 all PASS (reviewer APPROVE + PR comment 외부 + integrator self-check + CI green).

## Out of Scope

- **api.md L70 POST /api/users row + L71 PATCH /api/users/:id/role row 의 응답 shape doc-amend** — 본 task 머지 후 doc-only direct follow-up task (T-0096 candidate, × 0.64 multiplier).
- **modules.md L34 UserModule row description 갱신** — UserResponseDto 추가 박제. doc-only direct follow-up.
- **다른 entity (Person / Group / Part) 의 ResponseDto 추출** — 현재 Person / Group / Part 는 hashedPassword 같은 민감 컬럼 0 — entity 그대로 반환해도 risk 0. 일반화 추출은 별도 task / ADR.
- **fromEntities 배열 헬퍼** — `UserResponseDto.fromEntities(users: User[]): UserResponseDto[]` 추출은 본 task 0. GET /api/users list endpoint 박제 시점에 도입 (별도 task).
- **NestJS @SerializeOptions / ClassSerializerInterceptor 도입** — 전역 직렬화 전략은 별도 ADR. 본 task 는 단순 static factory 박제 (다른 entity 의 동일 패턴 출현 시 일반화 추출).
- **AuthController.login 응답의 hashedPassword 검증** — login 응답은 이미 `{ userId }` 만 반환 (auth.controller L155 박제) — body 에 hashedPassword 부재 확정. 본 task 무관.
- **API 응답의 sensitive 컬럼 전수 audit** — 다른 endpoint 의 응답 audit 는 별도 task.
- **password 정책 강화 / rate limiting / email verification** — T-0092 박제 follow-up 별도 task.
- **User entity 의 lastLoginAt / passwordChangedAt 컬럼 추가** — schema 변경 필요 + ADR 동반. 별도 task.

## Suggested Sub-agents

`implementer → tester → reviewer → integrator` (architect=0 — 신규 결정 0, 단순 응답 변환 패턴 + 보안 risk fix 정공법, ChangeRoleDto / AddUserDto colocated spec 1:1 mirror 패턴).

## Follow-ups

- **T-0096 candidate** — api.md L70 POST /api/users row + L71 PATCH /api/users/:id/role row 응답 shape doc-amend (5 필드 박제 + hashedPassword 제거 cross-ref). doc-only direct inline-amend × 0.64.
- **modules.md L34 UserModule row description 갱신** — UserResponseDto 추가 박제. doc-only direct.
- **T-0097 candidate** — RefreshToken DB table + revocation backbone (ADR-0008 §6 후속 chain).
- **T-0098 candidate** — POST /api/users RBAC 강화 ADR (Public → Admin+ 또는 분리 endpoint `/api/auth/setup`). T-0092 Out of Scope 박제.
- **다른 entity ResponseDto 일반화 추출** — 2+ entity 의 동일 패턴 출현 시점에 별도 task.
- **NestJS ClassSerializerInterceptor 도입 ADR** — 전역 직렬화 전략 박제 시 본 fromEntity 패턴 의 위상 재검토.
- **API 응답의 sensitive 컬럼 전수 audit** — 다른 endpoint 의 응답 audit + ResponseDto 적용 우선순위 박제.
- **signup → login round-trip e2e** — T-0094 박제 follow-up + 본 task 의 응답 shape 검증 round-trip 정합.
- **estimate-model.md milestone refinement** — 본 task 의 partial-backbone × 1.3 (단일 신규 DTO + 2 controller 변환 + e2e regression) variance 박제 데이터 1 회차.
