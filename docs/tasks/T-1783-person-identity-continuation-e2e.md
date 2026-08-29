---
id: T-1783
title: 인원 추가·수정 → ServiceIdentity 매핑 연속 동선 e2e 고정
phase: P5
status: DONE
commitMode: pr
prNumber: 1409
coversReq: [REQ-079]
independentStream: service-identity-e2e
dependsOn: [T-1780, T-1781, T-1782]
touchesFiles:
  - test/e2e/person-identity-continuation.e2e-spec.ts
estimatedDiff: 280
estimatedFiles: 1
created: 2026-08-29
completedAt: 2026-08-29T14:01:04Z
plannerNote: P5 / PLAN 132 행 R-182~R-183 — REQ-079 잔여 (2) e2e 연속 동선 고정 (인원 생성·수정 후 이어서 매핑)
---

# T-1783 — 인원 추가·수정 → ServiceIdentity 매핑 연속 동선 e2e 고정

## Why

[T-1782](T-1782-requirements-req079-autoselect-rejudge.md) 가 `docs/requirements.md` `98 행`
REQ-079 를 재판정하며 남긴 **유일한 잔여 (2)** 가 "인원 추가 → 이어서 매핑" 연속 동선의 e2e 고정이다.
현재 shipped 검증 실체는 web colocated spec 2 개
(`AdminView.person-create-identity-autoselect.test.tsx` · `AdminView.person-update-identity-autoselect.test.tsx`)
뿐이고, backend 축의 `test/e2e/service-identities.e2e-spec.ts` 는 identity 5 route 를 **개별로만** 덮어
`POST /api/persons` 응답 id 를 그대로 `:personId` 로 이어 쓰는 연속 계약은 어디에서도 발화하지 않는다.

본 slice 는 그 한 칸을 채운다 — 실 PostgreSQL · 실 guard stack · 실 ValidationPipe 위에서
"인원을 만들거나 고친 직후 그 id 로 곧바로 매핑이 성립한다" 를 HTTP 계약으로 못 박아
[ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups (d)` 가 요구한
"이름 / email 만 입력 가능한 상태 금지" 를 backend 축에서도 회귀 안전망에 넣는다
(PLAN `132 행` 오너 지시 R-182~R-183).

production code 변경은 0 이다 — controller · service · repository · DTO 는 T-1739 ~ T-1752 에서 완결됐고,
본 task 는 **새 e2e spec 1 파일만** 추가한다.

## Required Reading

- `test/e2e/service-identities.e2e-spec.ts` (`100~205 행` — harness 재사용 패턴: `endpointFor` builder · actor email 상수 · `seedPerson` · `beforeAll` / `afterEach` / `afterAll` 계약)
- `test/e2e/persons.e2e-spec.ts` (`120~230 행` — `POST /api/persons` 201 응답 shape 과 400 envelope 선례)
- `test/helpers/auth-e2e-helper.ts` (`createAuthenticatedE2EApp` · `buildAuthCookie` · `reseedAuthenticatedActors` 시그니처)
- `test/helpers/db-truncate.ts` (`truncateAll` — actor User 까지 비우므로 `afterEach` 재-seed 순서 고정)
- `src/user/person.controller.ts` (`41~90 행` — guard 미적용 · `@Post()` 201 · `@Patch(":id")` 계약)
- `src/user/service-identity.controller.ts` (`69~200 행` — `api/persons/:personId/identities` 5 route 와 RBAC tier)
- `docs/decisions/ADR-0058-service-identity-management-api.md` `§Decision 1` · `§Decision 2` · `§Decision 4` · `§Decision 5`

## Acceptance Criteria

- [ ] `test/e2e/person-identity-continuation.e2e-spec.ts` 1 개를 신설한다. **production code 변경 0** (`git diff --stat` 에 `src/` · `web/` 파일이 나타나지 않을 것).
- [ ] harness 는 `service-identities.e2e-spec.ts` 와 동일하게 `createAuthenticatedE2EApp` (Admin + User 2 actor) · `buildAuthCookie` · `afterEach` 의 `truncateAll` + `reseedAuthenticatedActors` 를 재사용한다. actor email 은 기존 spec 과 겹치지 않는 새 값을 쓴다.
- [ ] **happy-path 1 (생성 축)**: `POST /api/persons` 201 응답의 `id` 를 그대로 `:personId` 에 넣어 `POST /api/persons/:personId/identities` 가 201 을 내고, 응답 `personId` 가 생성 id 와 같으며, 이어진 `GET` 목록이 그 1 row 를 돌려주는 것까지 한 test 안에서 연속으로 검증한다.
- [ ] **happy-path 2 (수정 축)**: `POST /api/persons` → `PATCH /api/persons/:id` (예: `fullName` 변경 200) → 같은 id 로 identity 추가 201 → `GET` 목록 1 row 라는 연속 동선을 검증한다.
- [ ] **분기 cover**: (a) 연속 동선으로 붙인 **첫** identity 는 DB 재조회에서 `isPrimary=true` (자동 승격 분기), (b) 같은 인원에 `service` 가 다른 **두 번째** identity 를 이어 붙이면 `isPrimary=false` 이고 첫 row 의 primary 가 유지된다 — 두 분기 각 1+ test.
- [ ] **error path**: `POST /api/persons` 가 400 (빈 body 또는 잘못된 email) 이면 응답 envelope 에 `statusCode` · `message` 가 있고 `prisma.person` row 가 0 이라 매핑 동선이 시작조차 되지 않음을 검증한다 (1+ test).
- [ ] **negative cases 충분 cover** — 다음 예외 상황 **각 1+ test**: (1) 인원은 생성됐지만 인증 쿠키 없이 매핑을 시도하면 401 이고 identity row 0, (2) `User` role 쿠키는 편집 tier 미달이라 403 이고 identity row 0, (3) 생성 후 `DELETE /api/persons/:id` 로 사라진 id 로 매핑하면 404, (4) 같은 `personId` + 같은 `service` 재매핑은 409 (P2002 변환) 이고 기존 row 가 1 개로 보존.
- [ ] 각 test 는 응답 status·body 뿐 아니라 필요한 곳에서 `prisma.serviceIdentity` / `prisma.person` **재조회로 실 DB 상태**를 assert 한다 (204·401·403 처럼 응답만으로 구분 불가능한 지점 필수).
- [ ] spec 상단 주석에 본 spec 의 책임 경계 (연속 동선 anchor — 개별 route 계약은 `service-identities.e2e-spec.ts` 책임, 중복 재검증 금지) 와 REQ-079 잔여 (2) 와의 연결을 한국어로 박제한다.
- [ ] `pnpm lint` · `pnpm build` green.
- [ ] `pnpm test:e2e` 전량 green (신설 spec 포함).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] diff ≤ 300 LOC · 변경 파일 1 개 유지 (초과 위험 시 negative (4) 409 케이스를 Follow-ups 로 미루고 cap 안에서 닫는다).

## Out of Scope

- `src/` · `web/` 의 어떤 production code 변경도 하지 않는다 (본 task 는 test-only).
- `docs/requirements.md` REQ-079 status 재판정 (`IN_PROGRESS` → `DONE`) — 본 spec 머지 실측 후 **별도 direct doc slice** 로 처리한다.
- [ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Status` · `§Follow-ups (d)·(e)` closure 표기 — 별도 direct doc slice.
- `service-identities.e2e-spec.ts` 가 이미 덮는 개별 route 계약 (PATCH 금지 축 400 · DELETE 재승격 3 분기 · primary 지정 route) 재검증.
- 새 e2e helper 추출 · 기존 helper 시그니처 변경 · 새 dependency 추가.
- web colocated spec 추가·수정 (T-1780 · T-1781 이 이미 unit 축을 덮었다).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 추가)
