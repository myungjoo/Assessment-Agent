---
id: T-2030
title: persons guard 실배선 ④c — persons.e2e-spec 에 인증·인가 e2e 단언 (무 cookie 401 · User mutation 403 · escalation) 신설
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-043, REQ-045, REQ-046, REQ-073]
estimatedDiff: 190
estimatedFiles: 1
created: 2026-10-07
independentStream: q0056-persons-guard
dependsOn: [T-2029]
touchesFiles: [test/e2e/persons.e2e-spec.ts]
hqOrigin: Q-0056
plannerNote: P5 · Q-0056 ① 승인 ④ 실배선 3/3 — persons 5 route e2e 인가 단언. test 1 파일, production 0 LOC
---

# T-2030 — persons.e2e-spec 인증·인가 e2e 단언 신설 (Q-0056 ④c)

## Why

[PLAN.md](../PLAN.md) `157 행` 오너 최우선 지시 아래 진행하는 Q-0056 persons guard arc 의 **④ 실배선 3/3 (persons 축 마지막 조각)** 이다. 오너 결정은 `STATE.humanQuestions` Q-0056 `decision` 의 **옵션 ① 승인** 이고, 분할 정본은 [T-2029](T-2029-persons-write-tier-guard-wiring.md) `## Follow-ups` 첫 항목 (④c) 이다. ④a read ([T-2027](T-2027-persons-read-tier-guard-wiring.md), PR #1588) · ④b write ([T-2029](T-2029-persons-write-tier-guard-wiring.md), PR #1590) 로 `PersonController` 5 route 전량에 guard 가 붙었지만, 지금까지의 증거는 **controller unit spec (metadata + stub guard)** 과 **census 건수** 뿐이다 — 실 `JwtAuthGuard` · `RolesGuard` 가 실 HTTP 요청을 실제로 거부한다는 end-to-end 증거가 없다. 본 slice 가 그 증거를 닫는다 (README `83` · `85` · `86 행`).

issue-still-relevant pre-check (planner, 2026-10-07, `origin/main` = `12c45932`):

- [test/e2e/persons.e2e-spec.ts](../../test/e2e/persons.e2e-spec.ts) 에 `toBe(401)` · `toBe(403)` hit **0** → 본 task 의 의도는 main 에 미안착, 착수 유효. 그 파일의 마지막 변경은 `5a724a08` (T-2020 cookie 선탑재) 이고 인가 단언은 넣지 않았다.
- 현 11 test 는 전부 tier 에 맞는 cookie 를 싣는 **허용 경로** 만 본다 (GET = `userCookie`, 그 외 = `adminCookie`). 거부 경로 e2e 0 건.
- production 은 이미 배선 완료 — `src/user/person.controller.ts` 의 5 핸들러 모두 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles` 부착 (read `"User"` / write `"Admin"`). 따라서 본 slice 는 **production 0 LOC, test 1 파일** 이다.
- 최근 owner commit (PLAN `157` · `158` · `182` · `183 행`) 중 본 slice 를 금지하는 것은 없다 — `158 행` 은 per-route perf baseline 신설만 금지하고 본 slice 는 `test/perf/` 를 건드리지 않는다.

## Required Reading

- [test/e2e/persons.e2e-spec.ts](../../test/e2e/persons.e2e-spec.ts) — `28~36 행` (머리 주석의 test 개수 서술 + "인증 cookie 선탑재 (T-2020)" 블록 — 본 slice 로 갱신 대상), `41~50 행` (`auth-e2e-helper` import + `ADMIN_EMAIL` · `USER_EMAIL`), `72~103 행` (describe 셋업: `createAuthenticatedE2EApp` · cookie 2 개 · `afterEach` 의 `truncateAll` → `reseedAuthenticatedActors` 순서), `105~210 행` (happy 5 건 — 요청 체인 형태), `211~324 행` (negative · branch 6 건).
- [test/e2e/assessments.e2e-spec.ts](../../test/e2e/assessments.e2e-spec.ts) `155~280 행` — e2e 인가 단언 선례 정본 (A.1~A.7: 무 cookie 401 · invalid JWT 401 · User token 403 의 `it` 제목 형식 · seed 방식 · 단언 형태). 본 slice 는 이 형태를 persons 로 mirror 한다.
- [test/helpers/auth-e2e-helper.ts](../../test/helpers/auth-e2e-helper.ts) `53~110 행` · `132~200 행` — `SeedUserRole` (`"SuperAdmin" | "Admin" | "User"`) · `createAuthenticatedE2EApp` · `buildAuthCookie` · `reseedAuthenticatedActors` 계약. **읽기만** 하고 수정하지 않는다.
- [docs/architecture/api.md](../architecture/api.md) `79~83 행` — persons 5 route 의 권한 등급 정본 (GET 2 = User+, POST · PATCH · DELETE = Admin+).
- [src/user/person.controller.ts](../../src/user/person.controller.ts) `19~30 행` — "RBAC 배선 현황" 머리 주석 (남은 조각이 ④c 뿐임을 적은 서술 — 읽기만).

## Acceptance Criteria

본 slice 는 production symbol 추가 · 수정이 **0** 이다. R-112 4 항목은 "이미 배선된 5 route 의 guard 동작을 e2e 층에서 분기마다 검증" 으로 적용한다 (colocated unit spec 은 T-2027 · T-2029 가 이미 닫았으므로 신설 대상 아님 — e2e spec 위치는 기존 `test/e2e/persons.e2e-spec.ts` 그대로).

- [ ] 변경 파일은 `test/e2e/persons.e2e-spec.ts` **1 개** 다. `src/` · `test/helpers/` · `test/smoke/` · `test/perf/` · `docs/architecture/` 변경 0.
- [ ] 기존 `describe("E2E: /api/persons HTTP contract")` 의 셋업 (`createAuthenticatedE2EApp` · `afterEach` truncate + reseed) 을 **재사용** 한다 — 별도 app bootstrap 을 두 번 띄우지 않는다. escalation 단언에 필요한 `SuperAdmin` actor 1 명은 `createAuthenticatedE2EApp` 인자 배열에 추가한다 (`{ role: "SuperAdmin", email: "persons-superadmin-actor@e2e.test" }` 형태, cookie 는 `buildAuthCookie`).
- [ ] **happy-path (허용 경로) 단언** — 기존 11 test 는 **단언 무변경** 으로 유지한다 (허용 경로 증거). 추가로 role escalation 허용을 실 `RolesGuard` 로 확인한다: (i) `SuperAdmin` cookie 로 write 축 1+ route (`POST /api/persons`) 가 201 이고 DB 에 row 가 생긴다, (ii) `Admin` cookie 로 read 축 1+ route (`GET /api/persons`) 가 200 이다 (User+ tier 를 상위 role 이 통과).
- [ ] **error path — 무 cookie 401 (5 route 전부)** — `GET /api/persons` · `GET /api/persons/:id` · `POST /api/persons` · `PATCH /api/persons/:id` · `DELETE /api/persons/:id` 각각이 cookie 없이 **401** 을 돌려준다 (`it.each` 표 1 개로 압축 가능). `:id` route 는 실제 seed 한 person id 를 써서 404 와 구분되게 한다 (guard 가 handler · pipe 보다 먼저 거부함을 보인다).
- [ ] **분기별 단언 — tier 미달 403 (write 축 3 route 전부)** — `userCookie` 로 `POST` · `PATCH` · `DELETE` 각각이 **403** 이다. 반대 분기로 같은 `userCookie` 의 read 축 2 route 는 200 (기존 B.1 · B.2 가 이미 cover — 신규 중복 금지, 주석 1 줄로 대응 관계만 적는다).
- [ ] **예외 분기별 negative 단언** — 각 1+: (a) **invalid JWT cookie 401** — 서명이 틀린 토큰으로 read 1 + write 1 route (assessments A.4 · A.5 형태). (b) **거부 시 부수효과 0** — 403 / 401 로 거부된 `POST` 뒤 `prisma.person.count()` 가 0, 거부된 `PATCH` 뒤 대상 row 의 필드가 seed 값 그대로, 거부된 `DELETE` 뒤 row 가 여전히 존재 (또는 `active` 무변경) 함을 DB 조회로 단언한다. (c) **403 이 validation 보다 먼저** — `userCookie` + **빈 body** `POST /api/persons` 가 400 이 아니라 **403** 이다 (guard 가 `ValidationPipe` 앞에서 끊음). (d) **401 이 404 보다 먼저** — 무 cookie + 존재하지 않는 id 의 `GET /api/persons/:id` 가 404 가 아니라 **401** 이다 (존재 여부 비노출).
- [ ] **regression test** (hqOrigin Q-0056): 위 무 cookie 401 × 5 와 User 403 × 3 이 regression 가드다 — 누가 `PersonController` 의 `@UseGuards` 를 떼거나 write 축 `@Roles` 를 `"User"` 로 느슨하게 바꾸면 본 e2e 가 red 가 된다. `describe` 또는 `it` 제목에 `Q-0056` 과 route 를 적어 실패 로그만으로 원인이 드러나게 한다.
- [ ] 머리 주석 `32~36 행` 을 현재 상태로 갱신한다 — test 개수 서술을 실측 건수로 바로잡고, "인증 cookie 선탑재 (T-2020)" 블록 아래에 "인가 단언 (T-2030, Q-0056 ④c): 무 cookie 401 × 5 · User mutation 403 × 3 · escalation" 취지 2~3 줄을 추가한다.
- [ ] `afterEach` 의 `truncateAll(prisma)` → `reseedAuthenticatedActors(ctx)` 순서는 **무변경** 이고, 추가한 `SuperAdmin` actor 도 reseed 대상에 포함돼 test 순서와 무관하게 green 이다 (`pnpm test:e2e -- persons` 를 2 회 연속 돌려 flaky 0 확인).
- [ ] `pnpm lint && pnpm build && pnpm test` green. `pnpm test:e2e` green (특히 `persons.e2e-spec.ts` 전건 + `person-identity-continuation.e2e-spec.ts` · `service-identities.e2e-spec.ts` 무영향). `pnpm test:smoke` green (census 건수 `15` · `20` · `MIN.guarded` 69 무변경).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — production 변경 0 이라 수치 변동 없음을 확인만 한다.
- [ ] diff 는 **300 LOC 이하** 다. 초과가 보이면 ① 401 · 403 단언을 `it.each` 표로 압축 ② negative (c) · (d) 를 `## Follow-ups` 로 미룸 을 **순서대로** 시도하고, 그래도 넘으면 중단하고 `## Follow-ups` 에 수치를 적는다 (cap 우회 금지).

## Out of Scope

- `src/` 전체 — guard · decorator · controller 변경 0. e2e 가 red 로 실제 결함을 드러내면 **고치지 말고** 중단해 `## Follow-ups` 에 재현 요청 · 기대 · 실제 status 를 적는다 (patch 는 별 slice).
- `test/helpers/auth-e2e-helper.ts` · `test/helpers/db-truncate.ts` 수정 — 기존 계약으로 충분하다. 부족이 보이면 Follow-ups.
- `test/e2e/person-identity-continuation.e2e-spec.ts` · `test/e2e/service-identities.e2e-spec.ts` — nested identities route (`/api/persons/:personId/identities*` 6 route) 는 별 축이고 census 의 남은 15 항목에 속한다.
- groups (9 route) · parts (6 route) guard 배선과 그 e2e — Q-0056 `decision` 순서상 persons 완결 뒤의 다음 arc.
- `test/perf/*` · `test/load/*` · `.github/workflows/*` · `package.json` 변경. per-route perf baseline 신설은 PLAN `158 행` 이 금지한다.
- `docs/architecture/api.md` · `docs/requirements.md` REQ-043 · 045 · 046 · 073 재판정 · `docs/ops/load-resilience-test-plan.md` · `test/perf/README.md` 의 "cookie 없이 측정" 전제 doc-sync — CLAUDE.md §3.1 대로 본 slice 머지 **뒤** direct doc-only slice 1 개로 묶는다 ([T-2027](T-2027-persons-read-tier-guard-wiring.md) `## Out of Scope` 예약분 승계).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (planner, arc 계획) 본 slice 머지로 **persons 축 ④a~④c 완결**. 다음 순서: ① persons 축 doc-sync direct slice 1 개 (api.md 배선 현황 · `docs/requirements.md` REQ-043 · 045 · 046 재판정 · perf README / load plan 의 "cookie 없이 측정" 전제 정정 — T-2027 `## Out of Scope` 예약분) ② Q-0056 `decision` 순서의 다음 controller 인 **groups 9 route** arc (persons 와 같은 3 분할: 소비처 cookie 선탑재 실측 → read tier → write tier → e2e).
- (planner 판정, CLAUDE.md §3 소비처 동반 의무) 본 slice 는 helper · factory 신설이 없다 — 기존 `auth-e2e-helper` 를 소비하는 test 1 파일이다 → 하한 해당 없음.
- (planner 판정, cap) base 190 LOC (401 표 ~35 · 403 + 부수효과 0 ~70 · invalid JWT ~30 · escalation ~30 · 순서 negative ~20 · 주석 ~5), single-file test 라 multiplier × 1.0. `estimatedFiles` 1 → cap 안, split · `sizeExempt` 불요.
