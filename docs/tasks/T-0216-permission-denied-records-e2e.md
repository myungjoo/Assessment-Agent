---
id: T-0216
title: GET /api/permission-denied-records audit endpoint RBAC e2e 추가 (R-113)
phase: P4
status: DONE
commitMode: pr
coversReq: [REQ-016, REQ-044]
estimatedDiff: 190
estimatedFiles: 1
created: 2026-06-04
prNumber: 189
mergedAs: d73245c
reviewRounds: 1
completedAt: 2026-06-04T11:00:00+09:00
plannerNote: P4 audit-query milestone hardening — T-0214 endpoint 에 HTTP/RBAC e2e 부재(9 RBAC controller 중 유일). R-113 실 gap closeout.
---

# T-0216 — GET /api/permission-denied-records audit endpoint RBAC e2e 추가 (R-113)

## Why

T-0214 가 `GET /api/permission-denied-records` audit 조회 endpoint 를 ship 했으나(ADR-0023 §5), 다른 모든 RBAC controller(auth / users / assessments / contributions / summaries 등 9 종)는 `*.e2e-spec.ts` 로 HTTP/RBAC round-trip 을 검증하는 반면 이 endpoint 는 prisma-model smoke(`test/smoke/permission-denied-record.smoke-spec.ts`, 모델 create/read 만)만 있고 **HTTP layer + RBAC guard stack 을 실 네트워크로 exercise 하는 e2e 가 0** 이다. 이는 R-113(smoke + e2e 도 CI 에서 함께 수행)의 실 gap 이다. 본 task 는 그 endpoint 를 README REQ-016(권한 부족의 user/admin audience 분리) / REQ-044(권한 거부 가시화)의 조회 경로로서 e2e 로 hardening 한다 — 방금 ship 한 audit endpoint 의 RBAC 경계(401 / Admin bypass / non-Admin 빈 배열 / query 필터)를 실 PostgreSQL + 실 guard stack 으로 박제.

## Required Reading

- `src/permission-denied/permission-denied-record.controller.ts` — 검증 대상 endpoint(`@Get()` + `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("User")` + `@CurrentUser()` actor 추출 + instanceRef/provider/httpStatus query → filter, parseHttpStatus 경계).
- `docs/decisions/ADR-0023-permission-denied-audit-query-rbac-contract.md` — Decision §1(audience: Admin 전체 / non-Admin authenticated → binding 부재 fallback 빈 배열) / §3(Admin bypass + service-layer own-instance 필터) / §4(401 / 403 / 빈-필터 / 200 빈 배열 응답 경계) / §5(endpoint shape). **own-instance 실 필터는 본 slice 범위 밖** — non-Admin 은 현 시점 binding-부재 빈 배열 fallback 까지만이 박제된 동작이므로 e2e 도 그 동작(non-Admin → 200 빈 배열)만 assert.
- `test/e2e/summaries.e2e-spec.ts` — mirror 대상 e2e 패턴(`createAuthenticatedE2EApp([{role}])` 로 actor seed + token 발급 / `buildAuthCookie` / `truncateAll` afterEach / supertest / RBAC negative(401 cookie 부재 · invalid JWT) + authed happy + escalation 구조).
- `test/e2e/auth.e2e-spec.ts` — `createAuthenticatedE2EApp` / `buildAuthCookie` / per-`it` ctx 격리(try/finally truncate+close) 패턴 참조(추가 role actor 가 필요할 때).
- `test/helpers/auth-e2e-helper.ts` (참조) — `createAuthenticatedE2EContext` 의 반환 shape(app / prisma / tokens / users)와 multi-role seed 시그니처 확인용.

## Acceptance Criteria

신규 파일 `test/e2e/permission-denied-records.e2e-spec.ts` 1 개 추가(기존 e2e 컨벤션 1:1 mirror — `createAuthenticatedE2EApp` 로 actor seed + token, `buildAuthCookie`, `afterEach(truncateAll)`, `afterAll(app.close + prisma.$disconnect)`, supertest). 다음을 모두 충족한다.

- [ ] **Happy-path(Admin bypass)**: Admin(또는 SuperAdmin) token 으로 `GET /api/permission-denied-records` → 200 + `application/json` + 배열. arrange 에서 `prisma.permissionDeniedRecord.create` 로 2+ record(서로 다른 instanceRef/provider)를 seed 하고, Admin 응답이 그 전체 record 를 본다(ADR-0023 §1 Admin bypass)는 것을 assert(개수/필드 검증).
- [ ] **Happy-path(non-Admin authenticated → 빈 배열 fallback)**: User role token 으로 동일 endpoint → 200 + 빈 배열(`[]`). record 가 DB 에 존재해도 non-Admin 은 binding-부재 fallback 으로 빈 배열(ADR-0023 §1 명시 채택, §4 "빈 결과" 경계). **403 아님** 을 명시 assert(status 200 확인).
- [ ] **Error path(미인증 → 401)**: cookie 부재 시 401(JwtAuthGuard reject) + invalid JWT cookie 시 401(verify fail) **각 1+**(ADR-0023 §4 미인증 경계, summaries.e2e A.1/A.4 mirror).
- [ ] **Flow / branch(query 필터)**: Admin token + query param 분기 — `?provider=github`(또는 `?instanceRef=` / `?httpStatus=403`)로 필터 시 매칭 record 만 반환(ADR-0023 §5 query param). 필터 일치 1 row + 비일치 record 미포함을 assert. parseHttpStatus 경계(예: `?httpStatus=abc` non-numeric → filter omit → 전체 반환, controller negative case #6)도 1+ cover.
- [ ] **Negative cases 충분 cover(예외 분기마다 1+)**: (a) non-Admin → 빈 배열(403 아님, 위 happy 와 겸), (b) 미인증 cookie 부재 401, (c) invalid JWT 401, (d) non-numeric httpStatus query → throw 0(500 아님, 정상 200 + 해당 필터 omit), (e) 빈 결과(Admin 이지만 매칭 record 0 → 200 빈 배열) **각 1+**. 단일 negative 만으로 부족 — 위 5 분기 각각 cover.
- [ ] **R-113 CI 실행**: 본 spec 이 `pnpm test:e2e`(CI e2e step, `test/jest-e2e.json` testRegex `.*\.e2e-spec\.ts$`)에서 자동 picking·실행되어 green. 로컬 실 DB 부재 시 CI 의 services.postgres 위에서만 실행(기존 e2e 동일).
- [ ] **Coverage threshold 비약화**: 신규 spec 추가가 `package.json` 의 `coverageThreshold.global`(line ≥ 80% / function ≥ 80%)을 낮추지 않는다. e2e 는 `pnpm test:cov` 대상이 아니나(test/e2e 는 unit coverage 집계 제외), production code 변경 0(test-only)이라 기존 unit coverage 불변 — `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) 확인.
- [ ] **검증 명령**: `pnpm lint && pnpm build && pnpm test` (unit green) + tester 가 `pnpm test:e2e` 결과 확인(R-110 — pr-mode tester 의무).

## Out of Scope

- **non-Admin own-instance 실 필터 결선** — User↔instance binding schema(ADR-0023 §2(b) DB-schema 게이트, Q-0019 는 PermissionDeniedRecord migration 만 승인 — instance-binding 은 별도 §5 게이트)가 선행 요구된다. 본 e2e 는 현 박제 동작(non-Admin → 빈 배열 fallback)만 assert 하고, "User 가 자기 instance record 만 본다" 의 positive 필터 동작은 binding schema 머지 후 별도 task 로 deferred. 본 e2e 에 그 미래 동작을 가정한 assertion 을 넣지 않는다.
- production code(controller / service / repository) 변경 — 본 task 는 test-only. 동작 변경이 필요하면 Follow-up 으로.
- smoke spec(`permission-denied-record.smoke-spec.ts`) 수정 — 모델 round-trip 책임은 그대로 둔다(본 task 는 HTTP/RBAC e2e 만 신설).
- 응답 envelope 표준화 / pagination / sort 변경 / DTO view 정형화 — controller 가 현재 raw `PermissionDeniedRecord[]` 반환(ADR-0023 §5 redaction 불요)이라 그 shape 을 그대로 검증만.
- 403 tier 미달 케이스 강제 — 본 endpoint 는 `@Roles("User")`(authenticated 면 role 게이트 통과, ADR-0023 §5)라 403 분기가 발생하지 않는다. e2e 에 인위적 403 케이스를 만들지 않는다(ADR-0023 §4 — 403 은 향후 higher-tier endpoint 경계).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(작성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
