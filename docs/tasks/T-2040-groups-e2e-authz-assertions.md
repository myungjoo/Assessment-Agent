---
id: T-2040
title: groups guard 실배선 ⑤c — groups.e2e-spec 에 인증·인가 e2e 단언 (무 cookie 401 · User mutation 403 · escalation) 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-043, REQ-045, REQ-073]
estimatedDiff: 240
estimatedFiles: 1
created: 2026-10-29
independentStream: q0056-groups-guard
dependsOn: [T-2037, T-2039]
touchesFiles: [test/e2e/groups.e2e-spec.ts]
hqOrigin: Q-0056
plannerNote: P5 · Q-0056 ① groups 축 ⑤c — ⑤a·⑤b 머지 완료, 9 route e2e 인가 단언 (T-2030 동형, test 1 파일)
---

# T-2040 — groups.e2e-spec 인증·인가 e2e 단언 신설 (Q-0056 ⑤c)

## Why

[PLAN.md](../PLAN.md) `157 행` 오너 최우선 지시 아래 도는 Q-0056 arc 의 **groups 축 마지막 조각** 이다. 오너 결정은 `STATE.humanQuestions` Q-0056 `decision` 의 옵션 ① 이고, 분할 정본은 [T-2039](T-2039-groups-write-tier-guard-wiring.md) `## Follow-ups` 첫 항목 (⑤c) 이다. ⑤a read ([T-2037](T-2037-groups-read-tier-guard-wiring.md), PR #1598) 와 ⑤b write ([T-2039](T-2039-groups-write-tier-guard-wiring.md), PR #1600 `976d6a0c`) 로 `GroupController` 9 route 전량에 guard 가 붙었다. 하지만 지금까지의 증거는 controller unit spec (metadata + stub guard) 과 census 건수뿐이다. 실 `JwtAuthGuard` · `RolesGuard` 가 실 HTTP 요청을 실제로 거부한다는 end-to-end 증거가 없고, 본 slice 가 그것을 닫는다 (README `83` · `85` · `86 행`). persons 축 [T-2030](T-2030-persons-e2e-authz-assertions.md) (머지 `0917bb26`, 실측 1 파일 +168/-3) 과 같은 형태다.

issue-still-relevant pre-check (planner, 2026-10-29, `origin/main` = `f44be1cc`):

- `test/e2e/groups.e2e-spec.ts` 에 `toBe(401)` · `toBe(403)` hit 이 **0** 이다. 의도가 main 에 없으므로 착수는 유효하다. `21~23 행` 머리 주석도 "guard 는 아직 미배선 … 401 · 403 단언은 groups 축 마지막 e2e slice 몫" 이라고 적고 있어 본 slice 를 지목한다.
- 현 15 test 는 전부 tier 에 맞는 cookie 를 싣는 **허용 경로** 만 본다 (GET = `userCookie`, 그 외 = `adminCookie`). 거부 경로 e2e 는 0 건이다.
- production 배선은 이미 끝났다. `src/user/group.controller.ts` 의 read 4 handler (`111` · `122` · `135` · `151 행`) 는 `@Roles("User")`, write 5 handler (`163` · `179` · `217` · `232` · `247 행`) 는 `@Roles("Admin")` 이고, 모두 `@UseGuards(JwtAuthGuard, RolesGuard)` 가 붙어 있다. 머리 주석 `60 행` 도 남은 조각이 "e2e 단언 (Q-0056 ⑤c) 뿐" 이라고 적는다. 따라서 본 slice 는 **production 0 LOC, test 1 파일** 이다.
- 본 slice 를 금지하는 owner commit 은 없다. PLAN `158 행` 이 금지하는 것은 per-route perf baseline 신설이고, 본 slice 는 `test/perf/` 를 건드리지 않는다.

## Required Reading

- [test/e2e/groups.e2e-spec.ts](../../test/e2e/groups.e2e-spec.ts) — `1~23 행` (머리 주석. `21~23 행` "인증 cookie 선탑재 (T-2031)" 블록의 "guard 는 아직 미배선" 서술이 갱신 대상), `27~50 행` (`auth-e2e-helper` import · `ADMIN_EMAIL` · `USER_EMAIL` · helper), `52~83 행` (describe 셋업: `createAuthenticatedE2EApp` · cookie 2 개 · `afterEach` 의 `truncateAll` → `reseedAuthenticatedActors` 순서), `86~296 행` (happy · REQ-051 — membership seed 방식), `297~433 행` (negative 7 건).
- **선례 (그대로 따른다)**: [test/e2e/persons.e2e-spec.ts](../../test/e2e/persons.e2e-spec.ts) `360~490 행` — T-2030 이 넣은 인가 단언 블록. `RouteCase` 표 · `send` helper (cookie undefined 면 header 를 싣지 않음) · `expectUntouched` · E.1 무 cookie 401 `it.each` · E.2 User 403 `it.each` · invalid JWT · 순서 negative · escalation 의 `it` 제목 형식을 본뜬다. 그리고 [docs/tasks/T-2030-persons-e2e-authz-assertions.md](T-2030-persons-e2e-authz-assertions.md) `## Acceptance Criteria`.
- [test/helpers/auth-e2e-helper.ts](../../test/helpers/auth-e2e-helper.ts) — `SeedUserRole` · `createAuthenticatedE2EApp` · `buildAuthCookie` · `reseedAuthenticatedActors` 계약. **읽기만** 하고 수정하지 않는다.
- [src/user/group.controller.ts](../../src/user/group.controller.ts) `50~60 행` (RBAC 배선 현황 주석) · `109~250 행` (9 route 의 path · method · tier). **읽기만** 한다.
- [docs/architecture/api.md](../architecture/api.md) `89~93 행` — groups 권한 등급 정본. tier 행이 없는 `POST :id/members` · `DELETE :id/members/:membershipId` 는 T-2039 `## Why` 의 관례 판정에 따라 Admin+ 다.

## Acceptance Criteria

본 slice 는 production symbol 추가 · 수정이 **0** 이다. R-112 4 항목은 "이미 배선된 9 route 의 guard 동작을 e2e 층에서 분기마다 검증" 하는 형태로 적용한다. colocated unit spec 은 T-2037 · T-2039 가 이미 닫았으므로 신설 대상이 아니고, e2e spec 위치는 기존 `test/e2e/groups.e2e-spec.ts` 그대로다.

- [ ] 변경 파일은 `test/e2e/groups.e2e-spec.ts` **1 개** 다. `src/` · `test/helpers/` · `test/smoke/` · `test/perf/` · `docs/architecture/` 변경은 0.
- [ ] 기존 `describe("E2E: /api/groups HTTP contract")` 의 셋업 (`createAuthenticatedE2EApp` · `afterEach` truncate + reseed) 을 **재사용** 한다. app bootstrap 을 두 번 띄우지 않는다. escalation 단언에 필요한 `SuperAdmin` actor 1 명은 `createAuthenticatedE2EApp` 인자 배열에 추가한다 (`{ role: "SuperAdmin", email: "groups-superadmin-actor@e2e.test" }` 형태, cookie 는 `buildAuthCookie`).
- [ ] **route 표**: `READ_ROUTES` 4 행 (`GET /api/groups` · `GET /api/groups/:id` · `GET /api/groups/:id/persons` · `GET /api/groups/:id/members`) 과 `WRITE_ROUTES` 5 행 (`POST /api/groups` · `POST /api/groups/:id/members` · `PATCH /api/groups/:id` · `DELETE /api/groups/:id` · `DELETE /api/groups/:id/members/:membershipId`) 을 persons 선례의 `RouteCase` 형태로 정의한다. nested route 를 위해 path 함수는 seed 결과 (group id · membership id) 를 받는다. body 가 필요한 write route 는 **유효한 body** 를 싣는다 (validation 400 이 아니라 guard 거부임을 보이기 위해).
- [ ] **happy-path (허용 경로) 단언** — 기존 15 test 는 **단언 무변경** 으로 유지한다 (허용 경로 증거). 추가로 role escalation 허용을 실 `RolesGuard` 로 확인한다. (i) `SuperAdmin` cookie 로 write 축 1+ route (`POST /api/groups`) 가 201 이고 DB 에 row 가 생긴다. (ii) `Admin` cookie 로 read 축 1+ route (`GET /api/groups`) 가 200 이다 (User+ tier 를 상위 role 이 통과).
- [ ] **error path — 무 cookie 401 (9 route 전부)**: 9 route 각각이 cookie 없이 **401** 을 돌려준다 (`it.each([...READ_ROUTES, ...WRITE_ROUTES])` 표 1 개). `:id` · `:membershipId` 는 실제 seed 한 id 를 써서 404 와 구분되게 한다 (guard 가 handler · pipe 보다 먼저 거부함을 보인다).
- [ ] **분기별 단언 — tier 미달 403 (write 축 5 route 전부)**: `userCookie` 로 write 5 route 각각이 **403** 이다. 반대 분기 (같은 `userCookie` 의 read 축 200) 는 기존 GET happy test 가 이미 cover 하므로 신규 중복은 금지하고, 대응 관계만 주석 1 줄로 적는다.
- [ ] **예외 분기별 negative 단언 (각 1+)**: (a) **invalid JWT cookie 401** — 서명이 틀린 토큰으로 read 1 + write 1 route (persons 선례 형태). (b) **거부 시 부수효과 0** — 401 · 403 으로 거부된 뒤 DB 를 조회해 단언한다. 거부된 `POST /api/groups` 뒤 group 수가 seed 그대로, 거부된 `PATCH` 뒤 group `name` 이 seed 값 그대로, 거부된 `DELETE /api/groups/:id` 뒤 group row 가 존재, 거부된 `POST :id/members` 뒤 membership 수가 seed 그대로, 거부된 `DELETE :id/members/:membershipId` 뒤 membership row 가 존재해야 한다 (persons 의 `expectUntouched` 처럼 helper 1 개로 묶는다). (c) **403 이 validation 보다 먼저** — `userCookie` + **빈 body** `POST /api/groups` 가 400 이 아니라 **403** 이다. (d) **401 이 404 보다 먼저** — 무 cookie + 존재하지 않는 id 의 `GET /api/groups/:id` 가 404 가 아니라 **401** 이다 (존재 여부 비노출).
- [ ] **regression test** (`hqOrigin` Q-0056): 위 무 cookie 401 × 9 와 User 403 × 5 가 regression 가드다. 누가 `GroupController` 의 `@UseGuards` 를 떼거나 write 축 `@Roles` 를 `"User"` 로 느슨하게 바꾸면 본 e2e 가 red 가 된다. `it` 제목에 `Q-0056` 과 route 를 적어 실패 로그만으로 원인이 드러나게 한다.
- [ ] 머리 주석 `21~23 행` 을 현재 상태로 갱신한다. "guard 는 아직 미배선" 서술을 지우고, "인가 단언 (T-2040, Q-0056 ⑤c): 무 cookie 401 × 9 · User mutation 403 × 5 · escalation" 취지 2~3 줄을 넣는다. test 개수를 적는 서술이 있으면 실측 건수로 바로잡는다. `git grep -n "아직 미배선" test/e2e/groups.e2e-spec.ts` 가 0 hit 이다.
- [ ] `afterEach` 의 `truncateAll(prisma)` → `reseedAuthenticatedActors(ctx)` 순서는 **무변경** 이다. 추가한 `SuperAdmin` actor 도 reseed 대상에 포함돼 test 순서와 무관하게 green 이다 (`pnpm test:e2e -- groups` 를 2 회 연속 돌려 flaky 0 확인).
- [ ] `pnpm lint && pnpm build && pnpm test` green. `pnpm test:e2e` green (특히 `groups.e2e-spec.ts` 전건, 그리고 직렬 실행되는 `persons.e2e-spec.ts` · `parts.e2e-spec.ts` 무영향). `pnpm test:smoke` green (census `KNOWN_GAP_REQ_043` 6 · `MIN.guarded` 78 무변경).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). production 변경이 0 이라 수치 변동이 없음을 확인만 한다. 로컬 DB 가 없으면 e2e 는 PR head CI run 으로 확인하고 그 사실을 PR body 에 적는다.
- [ ] diff 는 **300 LOC 이하** 다. 넘칠 것 같으면 ① 401 · 403 · 부수효과 단언을 `it.each` 표와 공용 helper 로 압축하고 ② negative (c) · (d) 를 `## Follow-ups` 로 미루는 순서로 시도한다. 그래도 넘으면 중단하고 실측 수치를 `## Follow-ups` 에 적는다 (cap 우회 금지).

## Out of Scope

- `src/` 전체 — guard · decorator · controller 변경 0. e2e 가 red 로 실제 결함을 드러내면 **고치지 말고** 중단한다. 재현 요청 · 기대 status · 실제 status 를 `## Follow-ups` 에 적는다 (patch 는 별 slice).
- `test/helpers/auth-e2e-helper.ts` · `test/helpers/db-truncate.ts` 수정 — 기존 계약으로 충분하다. 부족이 보이면 Follow-ups 에 적는다.
- parts 축 (6 route) guard 배선과 그 e2e — Q-0056 `decision` 순서상 groups 완결 뒤의 다음 arc 다.
- perf 6 spec 의 "guard 미부착 · cookie 는 no-op" 주석 정리, `test/perf/README.md` · `docs/ops/load-resilience-test-plan.md` doc-sync, `test/load/*` · `.github/workflows/*` · `package.json` 변경. per-route perf baseline 신설은 PLAN `158 행` 이 금지한다.
- `docs/architecture/api.md` tier 행 2 개 추가와 `docs/requirements.md` REQ-043 · 045 · 073 재판정 — CLAUDE.md §3.1 에 따라 3 controller arc 가 머지된 뒤 REQ 당 1 회 처리한다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (planner, arc 계획) 본 slice 가 머지되면 **groups 축 ⑤a~⑤c 가 완결** 된다. 다음은 Q-0056 `decision` 순서의 마지막 controller 인 **parts 6 route** arc 다 (persons · groups 와 같은 분할: 소비처 cookie 선탑재 실측 → read tier → write tier → e2e). census `KNOWN_GAP_REQ_043` 의 남은 6 항목이 그 대상이다.
- (planner 판정, CLAUDE.md §3 소비처 동반 의무) helper · factory 신설이 없다. 기존 `auth-e2e-helper` 를 소비하는 test 1 파일이므로 하한 해당 없음.
- (planner 판정, cap) 선례 실측 T-2030 (persons 5 route) 은 1 파일 +168/-3 이었다. 본 slice 는 route 가 9 개이고 nested route 용 seed (group · person · membership) 와 부수효과 단언이 membership 축까지 늘어나 base 약 240 LOC 로 본다 (route 표 · seed ~50 · 401/403 `it.each` ~45 · 부수효과 helper ~45 · invalid JWT ~30 · escalation ~35 · 순서 negative ~25 · 주석 ~10). 단일 파일 test 라 multiplier × 1.0, `estimatedFiles` 1 → cap 안. split · `sizeExempt` 는 필요 없다.
