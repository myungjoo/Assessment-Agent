---
id: T-1755
title: Add e2e coverage for the ServiceIdentity delete (DELETE) route
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-078, REQ-024]
independentStream: service-identity-backend
dependsOn: [T-1754]
touchesFiles:
  - test/e2e/service-identities.e2e-spec.ts
estimatedDiff: 260
estimatedFiles: 1
created: 2026-08-28
plannerNote: P5 / ADR-0058 §Follow-ups (c) e2e chain 3 번째 slice — DELETE 축(204 + §Decision 2 재승격 + 3 단 404) 계약 고정
---

# T-1755 — ServiceIdentity 삭제(DELETE) route 의 e2e 계약 고정

## Why

[ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups (c)` 의 e2e chain 은 T-1753 (GET 목록 · POST 생성) 과 T-1754 (PATCH 수정) 로 3 route 를 덮은 상태다. 남은 축은 **`DELETE` 삭제**와 **primary 지정** 2 route 인데, 둘을 한 commit 에 담으면 T-1753 (`+288`) · T-1754 (`+255`) 실적에 비추어 [CLAUDE.md](../../CLAUDE.md) §3 의 300 LOC 상한을 넘는다.

그래서 본 slice 는 **`DELETE /api/persons/:personId/identities/:identityId` 한 축만** 고정한다. DELETE 는 `§Decision 2` 의 **삭제 후 primary 재승격** (지운 row 가 primary 면 잔여 row 중 `createdAt` 오름차순 첫 row 를 승격, 잔여 0 이면 승격 없음, 비-primary 삭제면 승격 동작 없음) 을 지는 유일한 route 다. 이 invariant 는 mock service 를 쓰는 unit spec 이나 smoke 로는 발화하지 않고 **실 Postgres 위의 잔여 상태를 조회해야만** 성립을 확인할 수 있다. harness (인증 actor seed · truncate · `reseedAuthenticatedActors` · `seedPerson` · `identityEndpointFor`) 는 T-1753 · T-1754 가 이미 지불했으므로 본 slice 는 **케이스 추가만** 한다.

## Required Reading

- [test/e2e/service-identities.e2e-spec.ts](../../test/e2e/service-identities.e2e-spec.ts) — 본 slice 가 유일하게 수정할 파일. 특히 `1~45 행` 헤더 주석 (slice 경계 · R-113 cover 문단 — 본 slice 가 갱신해야 한다), `endpointFor` · `identityEndpointFor` (`73~76 행`) · `ADMIN_EMAIL` · `USER_EMAIL` 상수, `beforeAll` / `afterEach` / `afterAll` 골격과 `seedPerson` helper (`99 행` 부근), 그리고 `316~330 행` PATCH describe 안의 `seedIdentity` helper 구현. **harness 를 재구현하지 말고 그대로 재사용한다.**
- [docs/decisions/ADR-0058-service-identity-management-api.md](../decisions/ADR-0058-service-identity-management-api.md) — `§Decision 1` route 표의 **DELETE 행** (성공 **204**, body 없음), `§Decision 2` 마지막 항 (마지막 primary 삭제 시 재승격 규칙 · 잔여 0 이면 승격 없음 · 비-primary 삭제면 승격 없음), `§Decision 4` RBAC (편집 tier `Admin`+), `§Decision 5 b · e` (Person 부재 / 타 Person 소유 / `P2025` → 전부 404).
- [src/user/service-identity.service.ts](../../src/user/service-identity.service.ts) `230~289 행` — `delete` 의 실행 순서: Person 선검사 404 → 소유 검사 404 → `repository.delete` 의 `P2025` 를 404 로 변환 → 삭제 대상이 primary 였을 때만 `selectNextPrimaryIdentity` 결과로 `setPrimary` 호출. 승격 판정이 **`owned` 스냅샷** 기준이라는 점 확인.
- [src/user/service-identity.controller.ts](../../src/user/service-identity.controller.ts) `140~163 행` — DELETE handler 의 `@HttpCode(204)` · `Promise<void>` (body 없음) · `@Roles("Admin")` · 순수 위임.
- [src/user/service-identity-primary-order.ts](../../src/user/service-identity-primary-order.ts) — 재승격 순서 (`createdAt` 오름차순, 동률이면 `id` 오름차순) 의 정본. e2e seed 가 이 순서를 결정론적으로 만들 수 있게 `createdAt` 을 명시 지정해야 하는지 판단하는 데 필요하다.

## Acceptance Criteria

- [ ] `test/e2e/service-identities.e2e-spec.ts` **1 파일만** 수정한다 — 새 spec 파일 신설 0, production code (`src/**`) 변경 0, 설정 파일 (`test/jest-e2e.json` · `package.json`) 변경 0.
- [ ] DELETE 전용 `describe` 그룹을 추가하되 `beforeAll` / `afterEach` / `afterAll` / `seedPerson` / `identityEndpointFor` 를 **재사용** 한다 (harness 중복 정의 금지). `seedIdentity` 는 PATCH describe 안에 있으므로 공용 scope 로 hoist 하거나 DELETE 용 seed helper 를 최소 형태로 1 개만 둔다 — 두 벌 복제 금지.
- [ ] happy-path 1+ — Admin 이 `DELETE /api/persons/:personId/identities/:identityId` 를 호출하면 **204** 이고 응답 body 가 비어 있으며, DB 를 직접 조회해 해당 row 가 **실제로 사라진 것** 을 확인.
- [ ] 분기 test — `§Decision 2` 재승격 3 분기를 **각각 1+** 로 검증 (전부 DB 조회 기준): ① **primary row 삭제 + 잔여 2 개** → `createdAt` 오름차순 첫 row 가 `isPrimary=true` 로 승격되고 나머지는 `false`, ② **primary row 삭제 + 잔여 0** → 승격 없이 Person 의 identity 가 0 개, ③ **비-primary row 삭제** → 기존 primary 가 그대로 유지되고 승격 동작 없음.
- [ ] 분기 test — 3 단 404 를 **각각 1+** 로 나눠 검증: ① 미존재 `personId` → 404, ② 존재하는 다른 Person 소유 identity 의 id 로 DELETE → **403 이 아니라 404** (`§Decision 5 e`), ③ 존재하는 Person + 미존재 `identityId` → 404. 응답 envelope 이 `statusCode` · `message` 를 포함하는지 1+ 케이스에서 확인.
- [ ] error path test 1+ — 위 404 중 최소 1 케이스에서 **DB 상태가 변하지 않았음** (대상 row 가 그대로 남아 있고 primary 배치도 불변) 을 직접 조회로 확인.
- [ ] negative cases 충분 cover — 각 1+ test: ① 인증 쿠키 없이 DELETE → **401**, ② `User` role 쿠키로 DELETE → **403** (편집 tier 미달) + DB row 보존, ③ 같은 id 로 **두 번째 DELETE** → 404 (멱등 아님, 소유 검사 단계에서 걸림), ④ 빈 문자열 / 형식이 다른 `identityId` 같은 비정상 path 파라미터 → 404 계열 응답이고 5xx 가 아님.
- [ ] 파일 헤더 주석을 갱신한다 — (i) 본 slice 가 DELETE 축을 추가로 덮고 **primary 지정 1 route** 만 후속 slice 로 남는다는 slice 경계, (ii) R-113 cover 문단의 test 개수 · 구성 재집계, (iii) DELETE 가 `§Decision 2` 재승격을 지는 유일한 route 이며 그 성립을 응답이 아니라 **DB 잔여 상태**로만 확인할 수 있는 이유를 한국어로 명시.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:e2e` 로 본 spec 이 실제 실행돼 추가 케이스 전부 green (CI e2e leg 에서 PASS 실측).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).

## Out of Scope

- **primary 지정 route** (`POST /:identityId/primary`) 의 e2e — `§Follow-ups (c)` 의 **마지막 slice** 소관. 본 slice 에서 미리 케이스를 추가하면 cap 을 깬다.
- production code (`src/user/*`) 변경 — DTO · service · controller · repository 는 T-1739 ~ T-1752 에서 완결. e2e 가 fail 하면 원인을 spec 에서 먼저 의심하고, 실제 결함으로 판단되면 **고치지 말고** Follow-ups 에 적는다.
- 기존 GET / POST / PATCH describe 의 케이스 수정 · 리네이밍 · 재배치 — `seedIdentity` hoist 외의 리팩터는 diff 를 부풀리고 review 표면을 넓힌다. 필요하면 Follow-ups.
- smoke spec (`test/smoke/*`) 추가 · `scripts/daily-test.sh` leg 추가 — leg 를 건드리면 drift-guard smoke spec 3 종 동시 수정이 필요해 5 파일 cap 을 깬다 (Q-0054 선례).
- [docs/architecture/api.md](../architecture/api.md) · [docs/requirements.md](../requirements.md) doc-sync 와 ADR-0058 본문의 완료 표기 — `§Follow-ups (e)` 별도 slice (`commitMode: direct`).
- AdminView 편집 UI (`§Follow-ups (d)`).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- ADR-0058 `§Follow-ups (c)` 의 **primary 지정 축** e2e slice — 본 slice 가 끝나면 (c) 의 마지막 잔여.
- ADR-0058 `§Follow-ups (e)` [docs/architecture/api.md](../architecture/api.md) · [docs/requirements.md](../requirements.md) doc-sync (`commitMode: direct`).
