---
id: T-0214
title: PermissionDeniedRecord audit 조회 controller slice (Admin-path-first, dependency-free)
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-016, REQ-044]
estimatedDiff: 210
estimatedFiles: 5
created: 2026-06-04
plannerNote: P4 ADR-0023 후속 chain row2의 dependency-free Admin-path 분해 — endpoint+RBAC+service actor-aware bypass/empty-fallback. non-Admin own-instance 필터는 §5 binding 게이트라 Follow-up defer.
---

# T-0214 — PermissionDeniedRecord audit 조회 controller slice (Admin-path-first)

## Why

ADR-0023(b5bae25, T-0213)이 audit 조회 endpoint 의 RBAC/audience 계약을 박제했고, Q-0020 이 `GET /api/permission-denied-records`(RBAC=Admin+자기 instance)를 승인했다. 본 slice 는 ADR-0023 후속 chain(L117~127)의 controller slice 를 **Admin-path-first 로 분해**해 구현한다 — Admin/SuperAdmin 전체 조회(bypass) + non-Admin 은 **binding 부재 fallback(빈 배열)** 까지. non-Admin own-instance 필터의 실 결선은 `User↔instance allowed-instance` schema(ADR-0023 Decision §2(b))를 요구하는데 이는 Q-0019 가 **승인하지 않은 별도 §5 DB-schema 게이트**(ADR-0023 L123 명시: "Q-0019 는 PermissionDeniedRecord migration 만 승인 — instance-binding 은 별도 게이트")라 본 slice 에서 다루지 않고 Follow-up 으로 escalate-defer 한다. ADR-0023 L112/L124 가 "binding 부재 동안 endpoint 자체는 Admin-only 로 먼저 동작 가능(dependency-free)" 을 명시 허용하므로 본 분해는 ADR 정합이다. REQ-016(user/admin audience 분리) / REQ-044(권한 거부 가시화)를 조회 경로에서 진척시킨다.

## Required Reading

- `docs/decisions/ADR-0023-permission-denied-audit-query-rbac-contract.md` — Decision §1(audience 3-tier + binding 부재 fallback=빈 배열), §3(Admin bypass=ROLE_HIERARCHY 재사용, service-layer actor-aware 분기), §4(401/403/빈-필터 경계), §5(endpoint shape: `GET /api/permission-denied-records`, `@Roles("User")`, query param). **본 slice 는 Admin-path + non-Admin binding-부재 fallback 까지만** — own-instance 실 필터는 Follow-up.
- `src/llm/llm-provider-config.controller.ts` — controller RBAC stack mirror(`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(...)` + service raw forward + ValidationPipe).
- `src/permission-denied/permission-denied-record.service.ts` — 기존 `list(query?)` (signature 확장 대상 → `list(actor, query?)`).
- `src/permission-denied/permission-denied-record.repository.ts` — `PermissionDeniedRecordFilter`(instanceRef/provider/httpStatus), `findMany` 필터 표면.
- `src/auth/current-user.decorator.ts` — `@CurrentUser()` / `@CurrentUser("role")` actor 추출.
- `src/auth/auth.service.ts` (L36~46) — `JwtPayload`(sub+role, instance binding 부재 확인).
- `src/auth/roles.guard.ts` + `src/auth/roles.decorator.ts` — `ROLE_HIERARCHY` escalation(Admin⊇User) — Admin bypass 판별 재사용.
- `src/permission-denied/permission-denied-record.module.ts` — controller 등록 위치(providers/controllers).

## Acceptance Criteria

- [ ] `GET /api/permission-denied-records` controller 신설 — `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("User")`(ADR-0023 §5: authenticated 면 endpoint 접근, audience 차등은 service-layer). query param `instanceRef`/`provider`/`httpStatus` 수신(기존 `PermissionDeniedRecordFilter` 위). controller 자체 분기 없음 — `@CurrentUser()` actor 추출 후 service 에 actor 명시 전달, service raw forward.
- [ ] `PermissionDeniedRecordService.list` 를 actor-aware 하게 확장(`list(actor, query?)`) — (i) actor.role 이 Admin escalation(`ROLE_HIERARCHY`)에 속하면 필터 없이 `repository.findMany(query)` forward(Admin bypass, ADR-0023 §3), (ii) non-Admin 이면 **binding 부재 fallback**(ADR-0023 §1: 허용 instance 집합이 비어 있으면 200 빈 배열) — 본 slice 는 binding source 가 schema 에 부재하므로 non-Admin 은 **항상 빈 배열**(own-instance 실 필터는 Follow-up). 403 변환 0(authenticated 면 endpoint 접근 권한 있음, ADR-0023 §4).
- [ ] 기존 `list(query?)` 호출자(있으면) 동기 — service-internal 만 호출하므로 파급 표면 작음(ADR-0023 negative §4). 기존 spec 도 새 signature 로 갱신.
- [ ] **Happy-path unit test**: (a) Admin actor → `findMany(query)` 그대로 forward, 전체 record 반환. (b) SuperAdmin actor → 동일 bypass. (c) non-Admin(User) actor → 빈 배열 반환(binding-부재 fallback). (d) controller → `@CurrentUser()` actor 가 service 로 전달되고 query param 이 filter 로 매핑됨.
- [ ] **Error path unit test**: (a) service.list 가 repository reject(DB 장애) 시 swallow 없이 propagate(404 변환 0). (b) actor 가 undefined/role 누락 시 안전 처리(non-Admin 취급 → 빈 배열, throw 0).
- [ ] **Flow / branch cover**: service.list 의 Admin-escalation 분기 vs non-Admin 분기 각 1+ test. `ROLE_HIERARCHY` 경계(Admin / SuperAdmin = bypass / User = fallback) 각 분기.
- [ ] **Negative cases 충분 cover** (각 1+): (1) 미인증(JWT 부재) → JwtAuthGuard 401 — e2e 또는 guard-level negative. (2) non-Admin 이 Admin-scope(전체 record) 조회 시도 → 빈 배열(403 아님, ADR-0023 §4 빈-필터 — "타 instance/전체 record 비노출"). (3) authorized 이나 매칭 record 0 → 200 빈 배열(404 변환 0). (4) non-Admin 이 query param 으로 타 instanceRef 지정 → binding 부재라 빈 배열(query param 이 bypass 를 유발하지 않음). (5) 경계: role 문자열 case/unknown role → non-Admin 취급(빈 배열). (6) httpStatus query param 비정상값(non-numeric) → ValidationPipe/transform 경계(400 또는 무시) 검증.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — 추가/수정 symbol(controller handler, 확장된 service.list) colocated spec cover.
- [ ] colocated spec — controller: `src/permission-denied/permission-denied-record.controller.spec.ts`, service: 기존 `src/permission-denied/permission-denied-record.service.spec.ts` 에 actor-aware 분기 test 추가(없으면 신설). 공유 mock 은 `test/helpers/prisma-mock.ts` 재사용 가능.
- [ ] controller 를 `PermissionDeniedRecordModule` 의 `controllers` 배열에 등록.
- [ ] `pnpm lint && pnpm build && pnpm test` green(tester 검증).

## Out of Scope

- **non-Admin own-instance 실 필터 결선** — `User↔instance allowed-instance` schema(컬럼/테이블 + migration)를 요구하는 §5 DB-schema 게이트(ADR-0023 Decision §2(b), Q-0019 미승인). 본 slice 는 non-Admin = 빈 배열 fallback 까지만. own-instance 필터는 Follow-up → 별도 humanQuestion escalate.
- `JwtPayload` 확장(instance claim 추가) — ADR-0023 §2 가 server-side lookup 채택, claim 비확장(별도 ADR-0008 amendment 여지).
- exact-match 정규화(case/trailing slash) 확정 — own-instance 필터와 함께 Follow-up.
- retention/TTL pruning — ADR-0022 §3 영구 보존(미도입).
- 응답 envelope 표준화 / pagination / sort 변경 — 기존 view + createdAt desc(repository 고정) 그대로.
- 새 guard/interceptor 신설 — ADR-0023 §3.2(신규 guard 미신설, 기존 stack 재사용).

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0023 이 audience/필터/응답 경계/endpoint shape 를 이미 박제, 본 slice 는 그 단일 source mirror).

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가. 예상 Follow-up: non-Admin own-instance 필터 결선은 User↔instance binding schema(§5 DB-schema 게이트, Q-0019 미승인)를 선행 요구 → driver 가 본 slice 머지 후 새 humanQuestion 으로 escalate. residual nit `db-truncate.spec.ts` L7 docstring stale 은 인접 PR nit-closure 로 흡수.)
