---
id: T-1756
title: Add e2e coverage for the ServiceIdentity set-primary route
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-078, REQ-024]
independentStream: service-identity-backend
dependsOn: [T-1755]
touchesFiles:
  - test/e2e/service-identities.e2e-spec.ts
estimatedDiff: 260
estimatedFiles: 1
created: 2026-08-28
plannerNote: P5 / ADR-0058 §Follow-ups (c) e2e chain 의 마지막 slice — primary 지정 route(200 + idempotent + 1-primary invariant) 계약 고정
---

# T-1756 — ServiceIdentity primary 지정 route 의 e2e 계약 고정

## Why

[ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups (c)` 의 e2e chain 은 T-1753 (GET 목록 · POST 생성) · T-1754 (PATCH 수정) · T-1755 (DELETE 삭제) 로 5 route 중 4 개를 덮었다. 남은 축은 **`POST /api/persons/:personId/identities/:identityId/primary`** 하나뿐이며 본 slice 가 (c) 의 마지막 조각이다.

이 route 가 지는 계약은 다른 4 route 와 다르다 — (i) `@Post` 인데 성공 status 가 **201 이 아니라 200** (`@HttpCode(200)` 명시, 새 row 를 만들지 않는 action POST), (ii) repository 의 `$transaction` (기존 primary `updateMany` unset + 대상 `update` set) 이 **REQ-024 "1 인원 1 primary"** 를 실 Postgres 위에서 원자적으로 유지하는지, (iii) **idempotent** — 이미 primary 인 row 에 재요청해도 결과 상태와 status 가 같은지. (ii)·(iii) 은 mock service 를 쓰는 unit spec 이나 smoke 로는 발화하지 않고 **실 DB 의 잔여 row 배치를 직접 조회해야만** 확인된다. harness (인증 actor seed · truncate · `reseedAuthenticatedActors` · `seedPerson` · `seedIdentity` · `identityEndpointFor`) 는 앞 3 slice 가 이미 지불했으므로 본 slice 는 **케이스 추가만** 한다.

## Required Reading

- [test/e2e/service-identities.e2e-spec.ts](../../test/e2e/service-identities.e2e-spec.ts) — 본 slice 가 유일하게 수정할 파일. 특히 `1~60 행` 헤더 주석 (slice 경계 · 축별 계약 문단 — 본 slice 가 갱신해야 한다), `endpointFor` · `identityEndpointFor` (`90~96 행`), `ADMIN_EMAIL` · `USER_EMAIL` · `IDENTITY_FIELDS` 상수 (`98~108 행`), `beforeAll` / `afterEach` / `afterAll` 골격과 공용 scope 의 `seedPerson` · `seedIdentity` helper (`119~140 행` 부근), 그리고 `574 행` 부터의 DELETE describe 가 DB 잔여 상태를 assert 로 삼는 방식. **harness 를 재구현하지 말고 그대로 재사용한다.**
- [docs/decisions/ADR-0058-service-identity-management-api.md](../decisions/ADR-0058-service-identity-management-api.md) — `§Decision 1` route 표의 **primary 행** (`76 행`: 성공 **200**, action POST 라 201 아님) 과 바로 아래 **idempotent** 서술 (`78~79 행`), `§Decision 2` (`N ≥ 1` 이면 primary 정확히 1 · `N = 0` 은 정상), `§Decision 3` (primary 를 PATCH body 축이 아니라 전용 경로로 뺀 이유), `§Decision 4` RBAC (편집 tier `Admin`+), `§Decision 5 b · e` (Person 부재 / 타 Person 소유 / `P2025` → 전부 404).
- [src/user/service-identity.service.ts](../../src/user/service-identity.service.ts) `201~228 행` — `setPrimary` 의 실행 순서: Person 선검사 404 → `findByPersonId` 소유 검사 404 → `repository.setPrimary` 의 `P2025` 를 404 로 변환 → 그 외 오류는 propagate.
- [src/user/service-identity.repository.ts](../../src/user/service-identity.repository.ts) `98~116 행` — `$transaction([updateMany(unset), update(set)])` 이 반환하는 값은 **두 번째 op 의 결과 row** 다. 응답 body 가 `isPrimary: true` 인 갱신 후 row 여야 하는 근거.
- [src/user/service-identity.controller.ts](../../src/user/service-identity.controller.ts) `160~190 행` — `@Post(":identityId/primary")` + `@HttpCode(200)` + `@Roles("Admin")` + 순수 위임.

## Acceptance Criteria

- [ ] `test/e2e/service-identities.e2e-spec.ts` **1 파일만** 수정한다 — 새 spec 파일 신설 0, production code (`src/**`) 변경 0, 설정 파일 (`test/jest-e2e.json` · `package.json`) 변경 0.
- [ ] primary 지정 전용 `describe` 그룹을 추가하되 `beforeAll` / `afterEach` / `afterAll` / `seedPerson` / `seedIdentity` / `identityEndpointFor` 를 **재사용** 한다 (harness · helper 중복 정의 금지). URL 조립이 필요하면 `identityEndpointFor(...) + "/primary"` 형태의 최소 helper 1 개까지만 허용한다.
- [ ] happy-path 1+ — Admin 이 `POST /api/persons/:personId/identities/:identityId/primary` 를 호출하면 **200** 이고 (201 이 아님을 명시적으로 단언), 응답 body 가 `IDENTITY_FIELDS` 5 필드를 갖는 갱신 후 row (`isPrimary: true`, `id` 가 요청한 identityId) 임을 확인.
- [ ] 분기 test — REQ-024 · `§Decision 2` 의 **1-primary invariant** 를 DB 직접 조회로 각 1+ 검증: ① 기존 primary 가 있는 Person 에서 다른 row 를 primary 로 지정하면 **기존 primary 가 `false` 로 내려가고 대상만 `true`** 이며 해당 Person 의 `isPrimary=true` row 개수가 정확히 1, ② row 3 개 중 비-primary 를 지정해도 결과가 정확히 1 primary, ③ **idempotent** — 이미 primary 인 row 에 재요청해도 200 이고 DB 배치가 이전과 동일 (primary 1 개 · 대상 동일).
- [ ] 분기 test — 3 단 404 를 **각각 1+** 로 나눠 검증: ① 미존재 `personId` → 404, ② 존재하는 다른 Person 소유 identity 의 id → **403 이 아니라 404** (`§Decision 5 e`), ③ 존재하는 Person + 미존재 `identityId` → 404. 응답 envelope 이 `statusCode` · `message` 를 포함하는지 1+ 케이스에서 확인하고, 메시지에 타 Person 의 `personId` 가 새지 않는지도 1+ 케이스에서 확인.
- [ ] error path test 1+ — 위 404 중 최소 1 케이스에서 **DB 상태가 변하지 않았음** (요청 대상 Person 의 primary 배치가 호출 전과 동일) 을 직접 조회로 확인 — 실패한 요청이 `updateMany` unset 만 남기고 rollback 되지 않는 사고를 막는 회귀 안전망.
- [ ] negative cases 충분 cover — 각 1+ test: ① 인증 쿠키 없이 호출 → **401**, ② `User` role 쿠키로 호출 → **403** (편집 tier 미달) + DB primary 배치 보존, ③ 빈 문자열 / 형식이 다른 `identityId` 같은 비정상 path 파라미터 → 404 계열이고 5xx 가 아님, ④ 요청 body 를 실어 보내도 (예: `{"isPrimary": false}`) 결과가 달라지지 않고 200 (본 route 는 body 를 읽지 않음).
- [ ] 파일 헤더 주석을 갱신한다 — (i) 본 slice 로 `§Follow-ups (c)` 의 5 route e2e chain 이 **완결** 된다는 slice 경계, (ii) R-113 cover 문단의 test 개수 · 구성 재집계, (iii) primary 지정 축이 지는 계약 (200 인 이유 · idempotent · `$transaction` 위의 1-primary invariant 가 응답이 아니라 **DB 잔여 배치**로만 확인되는 이유) 을 한국어로 명시.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:e2e` 로 본 spec 이 실제 실행돼 추가 케이스 전부 green (CI e2e leg 에서 PASS 실측).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).

## Out of Scope

- production code (`src/user/*`) 변경 — DTO · service · controller · repository 는 T-1739 ~ T-1752 에서 완결. e2e 가 fail 하면 원인을 spec 에서 먼저 의심하고, 실제 결함으로 판단되면 **고치지 말고** Follow-ups 에 적는다.
- 기존 GET / POST / PATCH / DELETE describe 의 케이스 수정 · 리네이밍 · 재배치 — 리팩터는 diff 를 부풀리고 review 표면을 넓힌다. 필요하면 Follow-ups.
- 동시 요청 (두 primary 지정이 경합) 의 race 검증 — `$transaction` 격리 수준 논의를 부르고 cap 을 깬다. 필요하면 별도 slice.
- smoke spec (`test/smoke/*`) 추가 · `scripts/daily-test.sh` leg 추가 — leg 를 건드리면 drift-guard smoke spec 3 종 동시 수정이 필요해 5 파일 cap 을 깬다 (Q-0054 선례).
- [docs/architecture/api.md](../architecture/api.md) · [docs/requirements.md](../requirements.md) doc-sync 와 ADR-0058 본문의 완료 표기 — `§Follow-ups (e)` 별도 slice (`commitMode: direct`).
- AdminView 편집 UI (`§Follow-ups (d)`).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- ADR-0058 `§Follow-ups (e)` [docs/architecture/api.md](../architecture/api.md) · [docs/requirements.md](../requirements.md) doc-sync (`commitMode: direct`) — 본 slice 로 (c) 가 닫히면 (e) 가 다음 순번.
- ADR-0058 `§Follow-ups (d)` AdminView 편집 UI (P6 frontend 소관).

## 결과 (2026-08-28 완료)

`Status: DONE` — PR [#1386](https://github.com/myungjoo/Assessment-Agent/pull/1386) squash merge (`6d347c77`). [test/e2e/service-identities.e2e-spec.ts](../../test/e2e/service-identities.e2e-spec.ts) 1 파일 (`+290/-10`) 만 수정했고 production code 변경은 0 이다. primary 지정 축 12 케이스 — happy 200 (201 아님 + 갱신 후 row 5 필드) · REQ-024 1-primary invariant 3 분기 (기존 primary unset + 대상 set · idempotent 재요청 · 잔여 배치 불변, 전부 DB 직접 조회) · `§Decision 5 b·e` 3 단 404 (Person 부재 · 타 Person 소유 · `P2025`, 각 envelope + 타 personId 누출 없음) · error path (404 후 primary 배치 불변) · negative 4 종 (401 · 403 + 배치 보존 · 비정상 path 파라미터 · body 무시 200). 기존 harness (`beforeAll` · `afterEach` · `seedPerson` · `seedIdentity` · `identityEndpointFor`) 를 전부 재사용해 중복 정의 0 이고, 새 helper 는 `primaryEndpointFor` 1 개뿐이다. reviewer APPROVE (round 1/7) → PR comment 외부 post → 4-게이트 충족 → squash merge + branch delete. CI e2e leg 에서 본 spec `PASS` (372 test) 실측. 본 slice 로 ADR-0058 `§Follow-ups (c)` e2e chain (5 route) 이 닫혔다 — 잔여는 `(e)` doc-sync 와 `(d)` UI.

reviewer MINOR 2 건은 non-blocking 이며 CLAUDE.md §3 Nit-closure 4 종에 해당하지 않아 본 PR 에서 미변경 — ① `G.4 idempotent` 를 연속 2 회 POST 로 강화하는 안 (현 diff 가 300 LOC 상한에 정확히 걸려 cap 초과), ② `not.toBe(201)` / `not.toBe(403)` 중복 단언 (AC 가 명시 요구).
