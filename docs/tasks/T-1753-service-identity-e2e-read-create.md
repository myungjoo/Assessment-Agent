---
id: T-1753
title: Add e2e coverage for ServiceIdentity list and create routes
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-078, REQ-024]
independentStream: service-identity-backend
dependsOn: [T-1752]
touchesFiles:
  - test/e2e/service-identities.e2e-spec.ts
estimatedDiff: 290
estimatedFiles: 1
created: 2026-08-28
plannerNote: P5 / ADR-0058 §Follow-ups (c) e2e chain 의 1 번째 slice — GET 목록 + POST 생성(자동 승격) 계약 고정
---

# T-1753 — ServiceIdentity 목록 · 생성 route 의 e2e 계약 고정

## Why

[ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups (b)` 가 T-1752 로 마감돼 `§Decision 1` 의 5 route 가 전부 HTTP 로 노출됐지만, 지금까지의 검증은 전부 mock service 를 쓴 controller unit spec 이라 **실 DB · 실 guard · 실 ValidationPipe 를 통과하는 계약이 한 번도 발화된 적이 없다**. `§Follow-ups (c)` 는 `§Decision 5` 의 오류 표 5 행과 `§Decision 2` 의 자동 승격을 실 HTTP + DB 상태로 고정하라고 지시한다.

5 route × (happy + 오류 계약 + RBAC) 을 한 파일 한 commit 에 담으면 기존 e2e spec 실적 (persons 297 행 · groups 401 행) 상 [CLAUDE.md](../../CLAUDE.md) §3 의 300 LOC 상한을 확실히 넘는다. 그래서 `(c)` 를 **읽기 · 생성 축 (본 slice)** 과 **수정 · 삭제 · primary 지정 축 (후속 slice)** 으로 절단하고, 본 task 는 harness scaffolding (인증 actor seed · truncate · re-seed) 과 함께 `GET /api/persons/:personId/identities` · `POST /api/persons/:personId/identities` 두 route 를 덮는다. scaffolding 을 본 slice 가 지불하므로 후속 slice 는 케이스 추가만 남는다.

## Required Reading

- [docs/decisions/ADR-0058-service-identity-management-api.md](../decisions/ADR-0058-service-identity-management-api.md) — `§Decision 1` route 표의 **GET · POST 2 행**, `§Decision 2` (첫 row 자동 primary 승격), `§Decision 4` RBAC tier (조회 `User`+ / 편집 `Admin`+), `§Decision 5` 오류 변환표 (a `P2002` → 409 · d forbidNonWhitelisted → 400 · person 부재 → 404)
- [src/user/service-identity.controller.ts](../../src/user/service-identity.controller.ts) — 헤더 주석의 route 표 5 행과 guard / pipe 배선. 본 slice 가 고정할 GET · POST handler 의 status (200 / 201) 확인
- [src/user/service-identity.service.ts](../../src/user/service-identity.service.ts) — `findByPersonId` 반환 형태와 `create` 의 자동 승격 · `P2002` → `ConflictException` 변환 지점
- [test/e2e/user-instance-access.e2e-spec.ts](../../test/e2e/user-instance-access.e2e-spec.ts) `1~90 행` — 인증 e2e 의 표준 골격 (`createAuthenticatedE2EApp` 다중 actor seed → `buildAuthCookie` → `afterEach(truncateAll + reseedAuthenticatedActors)`). 본 spec 은 이 골격을 그대로 승계한다
- [test/helpers/auth-e2e-helper.ts](../../test/helpers/auth-e2e-helper.ts) `132~215 행` — `createAuthenticatedE2EApp(seed)` 시그니처와 `reseedAuthenticatedActors(ctx)` 의 존재 이유 (afterEach truncate 가 actor `User` row 를 지우므로 재삽입 필수 — 누락 시 후속 요청이 엉뚱한 404 를 낸다)
- [test/e2e/persons.e2e-spec.ts](../../test/e2e/persons.e2e-spec.ts) `1~40 행` — e2e 헤더 주석 관례 (smoke 대 e2e 책임 경계 · 실 DB seed 전략 · R-113 cover 서술)
- [prisma/schema.prisma](../../prisma/schema.prisma) `model Person` · `model ServiceIdentity` — seed 시 필요한 필수 필드 (`Person.fullName` · `email` unique, `ServiceIdentity.personId` · `service` · `externalId` + `@@unique([personId, service])`)

## Acceptance Criteria

- [ ] 새 파일 `test/e2e/service-identities.e2e-spec.ts` 1 개만 추가한다 — 기존 e2e spec 수정 0, production code 변경 0.
- [ ] harness 는 `createAuthenticatedE2EApp` 으로 `Admin` · `User` 2 actor 를 seed 하고, `afterEach` 에서 `truncateAll` 직후 `reseedAuthenticatedActors(ctx)` 를 호출한다 (actor `User` row 복원 누락 금지). `afterAll` 에서 `app.close()` + `prisma.$disconnect()`.
- [ ] happy-path 1+ — `GET /api/persons/:personId/identities` 가 seed 된 identity 2 row 를 200 + JSON 배열로 반환하고 각 element 가 `id` · `personId` · `service` · `externalId` · `isPrimary` 를 노출.
- [ ] happy-path 1+ — `POST /api/persons/:personId/identities` 가 201 + 생성된 row 를 반환하고, **DB 를 직접 조회해** 그 row 가 실제로 존재함을 확인.
- [ ] 분기 test — `§Decision 2` 자동 승격의 두 분기를 각각 1+ 로 나눠 검증: ① identity 0 개인 Person 의 **첫 생성 row 는 `isPrimary === true`**, ② 이미 primary 가 있는 Person 의 **두 번째 생성 row 는 `isPrimary === false` 이고 기존 primary 가 유지** (둘 다 응답 body 가 아니라 **DB 조회 결과**로 확인).
- [ ] 분기 test — `GET` 이 identity 0 row 인 Person 에 대해 404 가 아니라 **200 + 빈 배열** 을 반환 (빈 목록 분기).
- [ ] error path unit test 1+ — 미존재 `personId` 로 `POST` 시 404 이고 응답 envelope 이 `statusCode` · `message` 를 포함.
- [ ] negative cases 충분 cover — 각 1+ test: ① 인증 쿠키 없이 `GET` → **401**, ② `User` role 쿠키로 `POST` → **403** (편집 tier 미달), ③ 같은 `personId` + 같은 `service` 재생성 → **409** (`@@unique` → `P2002` 변환), ④ body 에 화이트리스트 밖 필드 (`isPrimary`) 포함 → **400** (`forbidNonWhitelisted`), ⑤ 필수 필드 누락 (`externalId` 없음) → **400**.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과하고 `pnpm test:e2e` 로 본 spec 이 실제 실행돼 전부 green (`test/jest-e2e.json` 의 `testRegex` 가 자동 picking — 설정 파일 수정 0).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] spec 헤더 주석에 (i) smoke 대 e2e 책임 경계, (ii) 본 slice 가 GET · POST 축만 덮고 PATCH · DELETE · primary 지정은 `§Follow-ups (c)` 후속 slice 임, (iii) R-113 cover 근거를 한국어로 명시.

## Out of Scope

- `PATCH` · `DELETE` · primary 지정 3 route 의 e2e — `§Follow-ups (c)` 후속 slice (본 slice 가 만든 harness 를 재사용한다). 본 slice 에서 미리 케이스를 추가하면 cap 을 깬다.
- production code (`src/user/*`) 변경 — controller · service · repository · DTO 는 T-1739 ~ T-1752 에서 완결. e2e 가 fail 하면 원인을 spec 에서 먼저 의심하고, 실제 결함이면 고치지 말고 Follow-ups 에 적는다.
- smoke spec (`test/smoke/*`) 추가 · `scripts/daily-test.sh` leg 추가 — leg 를 건드리면 drift-guard smoke spec 3 종 동시 수정이 필요해 5 파일 cap 을 깬다 (Q-0054 선례).
- `test/jest-e2e.json` · `package.json` · CI workflow 수정.
- [docs/architecture/api.md](../architecture/api.md) · [docs/requirements.md](../requirements.md) doc-sync 와 ADR-0058 본문의 완료 표기 — `§Follow-ups (e)` 별도 slice (`commitMode: direct`).
- AdminView 편집 UI (`§Follow-ups (d)`).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시점 비어 있음)
