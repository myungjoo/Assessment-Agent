---
id: T-0125
title: "@CurrentUser() param decorator 신설 + UserController 2 callsite refactor (3-controller actor cast 중복 제거 first cut)"
phase: P3
status: DONE
completedAt: 2026-06-01T09:13:47+09:00
mergedAs: 7b2e1f33639755e260b3b32343425cfdaa7d8784
reviewRounds: 1
commitMode: pr
coversReq: [REQ-043, REQ-044, REQ-046, REQ-084]
estimatedDiff: 230
estimatedFiles: 4
created: 2026-06-01
dependsOn: [T-0083, T-0088, T-0101]
prNumber: 126
prBranch: claude/nifty-knuth-EBG6G
prHeadSha: d1b396b
plannerNote: "T-0123/T-0124 Follow-ups #2 — `req.user as { sub, role }` 3 callsite 중복 (user.controller × 2 + auth.controller × 1) 의 first cut. CurrentUser decorator 추출 + UserController 2 callsite refactor 만."
---

# T-0125 — `@CurrentUser()` param decorator 신설 + UserController 2 callsite refactor

## Why

PLAN.md P3 의 "Auth/RBAC 모델 (SuperAdmin/Admin/User)" + "User read-only 권한 범위 명시 — 조회·sort·filter 만 (R-86)" bullet 의 RBAC backbone 위에서, **T-0083 이 박제한 RBAC scaffold (JwtAuthGuard + RolesGuard + @Roles) 의 controller-level 사용 ergonomics 를 정련**한다. T-0123 Follow-ups #2 + T-0124 Follow-ups #1 의 planner 예약 항목 — 3 controller (user.controller × 2 + auth.controller × 1) 에 동일한 actor cast 패턴 `req.user as { sub: string; role: UserRole }` (또는 `{ sub?: string }`) 이 출현했고, 패턴 박제 회차 3 회로 추출 임계 충족.

본 task 는 **추출 first cut** — `src/auth/current-user.decorator.ts` 에 NestJS `createParamDecorator` 기반 `@CurrentUser()` param decorator 신설 + UserController 의 `changeRole` (L121-) + `detail` (L255-) **2 callsite** 만 refactor. AuthController 의 `me` callsite (L301) 는 cap (≤ 300 LOC / ≤ 5 파일) 보호를 위해 **별도 follow-up task** 로 분리. AssessmentController / ContributionController / SummaryController 의 RBAC chain (T-0121/T-0122/T-0123) 은 현재 actor 추출 0 (단지 guard 적용) 이라 본 task 의 refactor 대상 0.

이는 신규 architecture 결정 0, 신규 ADR 0, RBAC tier 의미 변경 0 — 단순 syntax sugar refactor. CLAUDE.md §3.1 의 `pr` 컬럼 (src/ 변경) 적용. 본 task 머지 후 actor 추출 동일 패턴이 1 callsite 만 남아 (auth.controller.me) 후속 follow-up 으로 single-callsite cleanup 가능.

## Required Reading

- `docs/tasks/T-0125-current-user-decorator-extraction.md` (본 파일)
- `docs/tasks/T-0123-summary-controller-rbac.md` — Follow-ups #2 의 planner 예약 항목 origin
- `docs/tasks/T-0124-api-md-rbac-enforced-annotation.md` — Follow-ups #1 의 planner 예약 항목 origin
- `src/auth/auth.service.ts` (L32-50 의 `JwtPayload` interface 박제 — `{ sub: string; role: string }`)
- `src/auth/jwt.strategy.ts` (L76-91 의 `validate(payload)` → req.user 박제 path)
- `src/auth/roles.decorator.ts` — 기존 decorator 박제 패턴 reference (colocated spec 위치 + `Reflector.createDecorator` pattern 참조용, 단 본 task 는 param decorator 라 `createParamDecorator` 사용)
- `src/auth/roles.guard.ts` (특히 ROLE_HIERARCHY) — escalation 매핑 semantic 확인 (decorator 자체는 escalation 0)
- `src/auth/jwt-auth.guard.ts` — JwtAuthGuard 가 req.user 박제하는 path 의 reference
- `src/user/user.controller.ts` (L121-145 `changeRole` + L255-275 `detail`) — refactor 대상 2 callsite (`@Req() req: Request` + cast 패턴 제거 대상)
- `src/user/user.controller.spec.ts` — colocated spec 의 actor cast 검증 assertion 갱신 대상
- `src/auth/auth.controller.ts` (L295-310 `me` 만, **읽기 전용**) — Out of Scope 의 cleanup 대상 1 callsite 확인용 (본 task 는 수정 0)
- `src/auth/auth.module.ts` — decorator import 경로 / module export 정합 확인 (param decorator 는 module export 불요지만, decorator 파일 위치 박제 reference)

## Acceptance Criteria

- [ ] **`src/auth/current-user.decorator.ts` 신설** — NestJS `createParamDecorator` 기반 `@CurrentUser()` param decorator 1개. 본문:
  - [ ] `import { createParamDecorator, ExecutionContext } from "@nestjs/common"` + `import type { JwtPayload } from "./auth.service"`.
  - [ ] `export const CurrentUser = createParamDecorator((data: keyof JwtPayload | undefined, ctx: ExecutionContext): JwtPayload | JwtPayload[keyof JwtPayload] | undefined => { const request = ctx.switchToHttp().getRequest(); const user = request.user as JwtPayload | undefined; if (user === undefined) return undefined; return data ? user[data] : user; })` 형태 또는 동등 구조. 파일 상단에 책임/사용 패턴/Out of Scope 한국어 주석 (≥ 20 줄, roles.decorator.ts 의 박제 패턴 mirror).
  - [ ] 사용 예: `@CurrentUser() actor: JwtPayload` (전체 payload) 또는 `@CurrentUser("sub") actorId: string` (특정 claim 만). decorator 자체는 JwtAuthGuard 가 req.user 박제 후에만 정의된 값 — 미인증 호출 시 undefined 반환 (호출 layer 가 JwtAuthGuard 로 차단 책임).
- [ ] **`src/user/user.controller.ts` 의 2 callsite refactor**:
  - [ ] `changeRole` (L121-145 부근): `@Req() req: Request` param 제거, `@CurrentUser("sub") actorUserId: string` 추가. 본문의 `const actorUserId = (req.user as { sub: string }).sub` 라인 제거 (decorator 가 직접 추출). import 의 `@Req`, `Request` 가 본 controller 의 다른 곳에서 안 쓰이면 제거.
  - [ ] `detail` (L255-275 부근): `@Req() req: Request` param 제거, `@CurrentUser() actor: JwtPayload` 추가 (혹은 `@CurrentUser("sub") actorId: string` + `@CurrentUser("role") actorRole: UserRole` 분리, 단 본문에서 둘 다 쓰므로 전체 payload 채택 권장). 본문의 `const actor = req.user as { sub: string; role: UserRole }` 라인 제거. `actor.sub` / `actor.role` 그대로 사용.
  - [ ] import 추가: `import { CurrentUser } from "../auth/current-user.decorator"` + `import type { JwtPayload } from "../auth/auth.service"`. 사용하지 않게 된 `@Req`, `Request` import 정리.
  - [ ] 기존 RBAC 동작 (guard stack `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(...)` + self-demote 검증 + Admin+ 분기 등) 변경 0 — actor 추출 path 만 교체.
- [ ] **Happy-path unit test** (colocated `src/auth/current-user.decorator.spec.ts` 신설):
  - [ ] decorator 의 factory 함수 직접 호출로 test (NestJS `createParamDecorator` 의 표준 test pattern — `Reflect.getMetadata` 또는 factory unwrap). data 인자 없이 호출 시 전체 `JwtPayload` 반환.
  - [ ] data 인자 `"sub"` 호출 시 sub claim string 반환.
  - [ ] data 인자 `"role"` 호출 시 role claim string 반환.
- [ ] **Error path unit test** (`current-user.decorator.spec.ts`):
  - [ ] request.user 가 undefined 일 때 (JwtAuthGuard 미통과 가정) factory 가 undefined 반환 — throw 0.
  - [ ] request.user 가 null 일 때 (방어 분기) undefined 반환.
  - [ ] data 인자가 payload 에 없는 key (예: `"missing" as any`) 일 때 undefined 반환 — throw 0.
- [ ] **Flow / branch test** (`current-user.decorator.spec.ts`): data 인자 유무 분기 (full payload vs single claim) 각 1+ test + request.user 존재/부재 분기 각 1+ test. 본 decorator 는 분기 2 종 — `data` truthy 분기 + `user` truthy 분기. 두 분기 cross-product 4 case cover.
- [ ] **Negative cases 충분 cover** (`current-user.decorator.spec.ts`): 단일 negative 가 아니라 예외 분기마다 각 1+. 아래 3 부류 모두 cover:
  - [ ] type mismatch — request 객체에 user 키 자체 부재 (`{}` shape).
  - [ ] type mismatch — request.user 가 string 또는 number 등 비-object (방어 cast 분기, 단 NestJS spec 상 보장 안 됨이므로 `as` cast 후 undefined-safe 동작 확인).
  - [ ] 의존성 실패 — ctx.switchToHttp().getRequest() 가 undefined 반환 시 안전한 처리 (방어 분기).
- [ ] **UserController spec 갱신** (`src/user/user.controller.spec.ts`):
  - [ ] `changeRole` test 의 mock request 전달 → `actorUserId: string` 직접 전달로 assertion 갱신. service spy 호출 인자 검증은 변경 0 (refactor 는 controller 내부 path 만, service 인터페이스 0 변경).
  - [ ] `detail` test 의 mock request 전달 → `actor: JwtPayload` 직접 전달로 assertion 갱신. self-detail 분기 / Admin+ 분기 / ForbiddenException 분기 등 기존 test case 모두 통과 (decorator 추출 후에도 동작 0 변경 보장).
  - [ ] guard mock / RolesGuard override pattern 변경 0 — decorator 는 guard 와 독립적이라 기존 guard mock 그대로 사용.
- [ ] **Coverage 최소치**: `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). current-user.decorator.ts 는 100% 유지 (단순 factory 함수, 분기 2 종 모두 spec cover).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. smoke (`pnpm test:smoke`) / e2e (`pnpm test:e2e`) 도 green (decorator refactor 는 e2e 동작 변경 0, 기존 auth cookie threading 그대로 통과 보장).
- [ ] CI 전 step green (spec-presence + lint + build + test:cov + smoke + e2e + reviewer-gate).

## Out of Scope

- **AuthController.me (L301) 의 callsite refactor** — 동일 패턴 1 callsite 잔존이지만 본 task 의 파일 cap (≤ 5 파일) 보호를 위해 **별도 follow-up task** 로 분리. 추가 시 auth.controller.ts + auth.controller.spec.ts 2 파일 (총 6 파일 → cap 초과). 본 task 머지 후 single-callsite cleanup 으로 작은 task.
- **AssessmentController / ContributionController / SummaryController 의 actor 추출** — 본 3 controller 는 RBAC guard 만 적용, actor 추출 0 (req.user 호출 0). refactor 대상 0.
- **`@Roles` decorator 자체 refactor / `RolesGuard` 공용 util refactor** — T-0123 Follow-ups #2 가 언급했으나, `@Roles` 와 `RolesGuard` 는 이미 공용 util 로 분리되어 있음 (`src/auth/roles.decorator.ts` + `src/auth/roles.guard.ts`, ROLE_HIERARCHY single source of truth). 추가 추출 대상 0.
- **새 architecture 결정 / 새 ADR** — 0. 본 task 는 NestJS 표준 patterns (createParamDecorator) 의 직접 적용 — 신규 결정 0.
- **JwtPayload interface 변경 / 추가 claim 박제** — 0. 기존 `{ sub: string; role: string }` 그대로 사용. claim 추가 (예: email / displayName) 는 별도 ADR (ADR-0008 amendment).
- **immediate role rotation / token refresh 시 새 role propagate** — 별도 task (user.controller.ts L46 박제, ADR 후보).
- **api.md / data-model.md / modules.md 등 architecture doc 갱신** — 본 task 는 syntax sugar refactor 로 외부 contract (HTTP request/response shape) 변경 0. doc 갱신 0.
- **e2e 새 시나리오 추가** — 0. 기존 e2e (auth.e2e-spec.ts / users.e2e-spec.ts) 가 통과하면 동작 보장 충분.
- **PLAN.md / STATE.json 갱신** — STATE.nextTask 만 planner 가 박제 (본 task), 그 외 driver 책임.

## Suggested Sub-agents

`implementer → tester` (architect 미호출 — 새 architecture 결정 0, NestJS `createParamDecorator` 표준 적용 + 기존 cast 패턴 1:1 대체. ADR / 신규 module 0).

## Follow-ups

(작성 시점 비어 있음. sub-agent 가 관련 작업 발견 시 추가.)
- (planner 예약) AuthController.me (L301) 의 `req.user as { sub?: string }` cast → `@CurrentUser("sub") actorId: string | undefined` refactor — single-callsite cleanup, ~50 LOC / 2 파일 / pr-mode, 본 task 머지 후 즉시 dispatch 가능.
- (planner 예약) T-0124 Follow-ups #2: PLAN.md P3 의 "Auth/RBAC 모델" + "User read-only 권한 범위 명시" bullet 의 chain 3/3 종결 표기 갱신 — P3 → P4 전이 시 일괄 검토 권장.
- (planner 예약) `JwtPayload` 의 추가 claim 박제 (email / displayName 등) ADR — ADR-0008 amendment 또는 신규 ADR (별도 architecture task).
