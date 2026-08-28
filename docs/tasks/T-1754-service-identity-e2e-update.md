---
id: T-1754
title: Add e2e coverage for the ServiceIdentity update (PATCH) route
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-078, REQ-024]
independentStream: service-identity-backend
dependsOn: [T-1753]
touchesFiles:
  - test/e2e/service-identities.e2e-spec.ts
estimatedDiff: 200
estimatedFiles: 1
created: 2026-08-28
plannerNote: P5 / ADR-0058 §Follow-ups (c) e2e chain 2 번째 slice — PATCH 수정 축(3 단 404 · 금지 축 400 게이트) 계약 고정
---

# T-1754 — ServiceIdentity 수정(PATCH) route 의 e2e 계약 고정

## Why

[ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups (c)` 의 e2e chain 은 T-1753 이 **읽기 · 생성 축** (GET 목록 · POST 생성) 만 덮은 상태다. 남은 축은 `PATCH` 수정 · `DELETE` 삭제 · primary 지정 3 route 이며, 이 셋을 한 commit 에 담으면 T-1753 실적 (2 route + harness 로 `+288` LOC) 에 비추어 [CLAUDE.md](../../CLAUDE.md) §3 의 300 LOC 상한을 확실히 넘는다.

그래서 잔여 3 route 를 다시 절단해 본 slice 는 **`PATCH /api/persons/:personId/identities/:identityId` 한 축만** 고정한다. PATCH 는 `§Decision 3` 의 **금지 축 400 게이트** (`isPrimary` · `service` 는 DTO 필드 자체가 없어 `forbidNonWhitelisted` 가 400) 와 `§Decision 5 b · e` 의 **3 단 404** (Person 부재 · 타 Person 소유 · `P2025`) 를 동시에 지는 route 라, 실 DB · 실 ValidationPipe 를 통과하는 계약이 한 번도 발화된 적 없는 지금이 가장 회귀 위험이 크다. harness (인증 actor seed · truncate · `reseedAuthenticatedActors` · `seedPerson`) 는 T-1753 이 이미 지불했으므로 본 slice 는 **케이스 추가만** 한다.

## Required Reading

- [test/e2e/service-identities.e2e-spec.ts](../../test/e2e/service-identities.e2e-spec.ts) — 본 slice 가 유일하게 수정할 파일. 특히 `1~40 행` 헤더 주석 (slice 경계 서술 · R-113 cover 문단 — 본 slice 가 갱신해야 한다), `endpointFor` · `ADMIN_EMAIL` · `USER_EMAIL` · `IDENTITY_FIELDS` 상수, `beforeAll` / `afterEach` / `afterAll` 골격과 `seedPerson` helper. **이 harness 를 재구현하지 말고 그대로 재사용한다.**
- [docs/decisions/ADR-0058-service-identity-management-api.md](../decisions/ADR-0058-service-identity-management-api.md) — `§Decision 1` route 표의 **PATCH 행** (성공 200), `§Decision 3` (PATCH 는 `externalId` 단일 축 · `isPrimary` · `service` 금지 · 명시적 `null` 은 400), `§Decision 4` RBAC (편집 tier `Admin`+), `§Decision 5 b · e` (identity 부재 / 타 Person 소유 / `P2025` → 전부 404)
- [src/user/dto/update-service-identity.dto.ts](../../src/user/dto/update-service-identity.dto.ts) — `externalId?` 단일 필드와 `@ValidateIf((_o, v) => v !== undefined)` 채택 근거 (미전달은 skip, 명시적 `null` 은 `@IsString` 위반 400). 제약은 `@IsNotEmpty` · `@MaxLength(255)`.
- [src/user/service-identity.service.ts](../../src/user/service-identity.service.ts) `151~183 행` — `update` 의 실행 순서: Person 선검사 404 → 소유 검사 404 → `externalId === undefined` 면 **repository 미호출로 현재 row 그대로 반환** → `P2025` 를 404 로 변환.
- [src/user/service-identity.controller.ts](../../src/user/service-identity.controller.ts) `116~136 행` — PATCH handler 의 status (200, `@HttpCode` 없음) · `@Roles("Admin")` · 순수 위임 (변환 0).
- [test/helpers/auth-e2e-helper.ts](../../test/helpers/auth-e2e-helper.ts) `132~215 행` — `createAuthenticatedE2EApp` / `buildAuthCookie` / `reseedAuthenticatedActors` 시그니처 (신규 호출을 추가할 일은 없지만 쿠키 재사용 방식 확인용).

## Acceptance Criteria

- [ ] `test/e2e/service-identities.e2e-spec.ts` **1 파일만** 수정한다 — 새 spec 파일 신설 0, production code (`src/**`) 변경 0, 설정 파일 (`test/jest-e2e.json` · `package.json`) 변경 0.
- [ ] 기존 `describe` 블록 안 (또는 같은 파일의 형제 `describe`) 에 PATCH 전용 그룹을 추가하되, `beforeAll` / `afterEach` / `afterAll` / `seedPerson` 을 **재사용** 한다 (harness 중복 정의 금지).
- [ ] happy-path 1+ — `PATCH /api/persons/:personId/identities/:identityId` 가 `{ externalId }` 를 받아 **200** 과 갱신된 row 를 반환하고, **DB 를 직접 조회해** `externalId` 가 실제로 바뀐 것을 확인.
- [ ] 분기 test — `§Decision 3` 의 보존 semantic: **빈 body `{}`** 로 PATCH 하면 200 이고 `externalId` 가 **변하지 않으며** `isPrimary` · `service` 도 그대로임을 DB 조회로 확인 (service 의 `externalId === undefined` 단락 분기).
- [ ] 분기 test — 3 단 404 를 **각각 1+** 로 나눠 검증: ① 미존재 `personId` → 404, ② 존재하는 다른 Person 소유 identity 의 id 로 PATCH → **403 이 아니라 404** (`§Decision 5 e`), ③ 존재하는 Person + 미존재 `identityId` → 404. 각 응답 envelope 이 `statusCode` · `message` 를 포함하는지 1+ 케이스에서 확인.
- [ ] error path test 1+ — 위 404 중 최소 1 케이스에서 **DB 상태가 변하지 않았음** (대상 row 의 `externalId` 보존) 을 직접 조회로 확인.
- [ ] negative cases 충분 cover — 각 1+ test: ① 인증 쿠키 없이 PATCH → **401**, ② `User` role 쿠키로 PATCH → **403** (편집 tier 미달), ③ body 에 `isPrimary` 포함 → **400** (`forbidNonWhitelisted` 금지 축 게이트), ④ body 에 `service` 포함 → **400**, ⑤ `externalId: null` → **400** (`@ValidateIf` 가 skip 하지 않음), ⑥ `externalId: ""` → **400** (`@IsNotEmpty`).
- [ ] 파일 헤더 주석을 갱신한다 — (i) 본 slice 가 PATCH 축을 추가로 덮고 `DELETE` · primary 지정만 후속 slice 로 남는다는 slice 경계, (ii) R-113 cover 문단의 test 개수 · 구성 재집계, (iii) 3 단 404 가 403 이 아닌 404 인 이유 (`§Decision 5 e`) 를 한국어로 명시.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:e2e` 로 본 spec 이 실제 실행돼 추가 케이스 전부 green (CI e2e leg 에서 PASS 실측).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).

## Out of Scope

- `DELETE` · primary 지정 2 route 의 e2e — `§Follow-ups (c)` 의 **마지막 slice** 소관. DELETE 는 `§Decision 2` 의 삭제 후 재승격까지 DB 상태로 검증해야 해 그 자체로 한 slice 분량이다. 본 slice 에서 미리 케이스를 추가하면 cap 을 깬다.
- production code (`src/user/*`) 변경 — DTO · service · controller 는 T-1739 ~ T-1752 에서 완결. e2e 가 fail 하면 원인을 spec 에서 먼저 의심하고, 실제 결함으로 판단되면 **고치지 말고** Follow-ups 에 적는다.
- harness 리팩터 (`seedPerson` 일반화 · 공용 helper 추출 등) — 동작 동일한 정리는 본 slice 의 diff 를 부풀리고 review 표면을 넓힌다. 필요하면 Follow-ups.
- smoke spec (`test/smoke/*`) 추가 · `scripts/daily-test.sh` leg 추가 — leg 를 건드리면 drift-guard smoke spec 3 종 동시 수정이 필요해 5 파일 cap 을 깬다 (Q-0054 선례).
- [docs/architecture/api.md](../architecture/api.md) · [docs/requirements.md](../requirements.md) doc-sync 와 ADR-0058 본문의 완료 표기 — `§Follow-ups (e)` 별도 slice (`commitMode: direct`).
- AdminView 편집 UI (`§Follow-ups (d)`).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- ADR-0058 `§Follow-ups (c)` 의 **삭제 · primary 지정 축** e2e slice (`§Decision 2` 재승격을 DB 상태로 검증) — 본 slice 가 끝나면 (c) 의 마지막 잔여.
- ADR-0058 `§Follow-ups (e)` [docs/architecture/api.md](../architecture/api.md) · [docs/requirements.md](../requirements.md) doc-sync (`commitMode: direct`).
