---
id: T-2029
title: persons guard 실배선 ④b — PersonController write 축 3 route (Admin+) 인증·인가 게이트 + census 판정면 flip
phase: P5
status: TODO
commitMode: pr
coversReq: [REQ-043, REQ-045, REQ-073]
estimatedDiff: 250
estimatedFiles: 4
created: 2026-10-05
independentStream: q0056-persons-guard
dependsOn: [T-2027, T-2028]
touchesFiles:
  [
    src/user/person.controller.ts,
    src/user/person.controller.spec.ts,
    test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts,
    test/smoke/persons.smoke-spec.ts,
  ]
hqOrigin: Q-0056
plannerNote: P5 · Q-0056 ① 승인 ④ 실배선 2/3 — write 축 3 route Admin+. T-2027 harness 재사용으로 cap 안
---

# T-2029 — PersonController write 축 3 route Admin+ 게이트 (Q-0056 ④b)

## Why

[PLAN.md](../PLAN.md) `157 행` 오너 최우선 지시 아래 진행하는 Q-0056 persons guard arc 의 **④ 실배선 2/3** 이다. 오너 결정은 `STATE.humanQuestions` Q-0056 `decision` 의 **옵션 ① 승인** (persons → groups → parts 순서, 기존 `JwtAuthGuard` · `RolesGuard` · `@Roles` 재사용, 새 dependency 0) 이고, ④ 를 route tier 로 3 분할한 정본 순서는 [T-2027](T-2027-persons-read-tier-guard-wiring.md) `## Follow-ups` 의 **④a read → ④b write → ④c e2e** 다. ④a 는 머지됐고 ([T-2027](T-2027-persons-read-tier-guard-wiring.md), PR #1588), 부하 축 미준비 소비처 1 건도 선확보됐다 ([T-2028](T-2028-k6-s1-s3-bootstrap-superadmin.md), PR #1589).

본 slice 는 api.md `80 행` · `82 행` · `83 행` 의 **Admin+ write 축 3 route** (`POST /api/persons` · `PATCH /api/persons/:id` · `DELETE /api/persons/:id`) 를 배선한다.

issue-still-relevant pre-check (planner, 2026-10-05, `origin/main` = `39cb4f1e`):

- [src/user/person.controller.ts](../../src/user/person.controller.ts) `113 행` (`@Post()`) · `126 행` (`@Patch(":id")`) · `136 행` (`@Delete(":id")`) 에 `@UseGuards` · `@Roles` hit **0** → 본 task 의 의도는 main 에 미안착, 착수 유효. read 축 2 route (`87~89 행` · `103~105 행`) 는 이미 배선돼 있어 본 slice 는 손대지 않는다.
- census 실측값도 ④a 상태 그대로다 — `MIN.guarded` **66**, `KNOWN_GAP_REQ_043` **18**, `UNPROTECTED_ALLOWLIST` **23** 이고 그 18 항목 안에 `POST /api/persons` · `PATCH /api/persons/:id` · `DELETE /api/persons/:id` 3 항목이 남아 있다 (`60~62 행`).
- **write 축 소비처 전수 재실측** (T-2027 `## Follow-ups` ④b 가 요구한 선행 조건) 결과 **cookie 없이 write 를 호출하는 jest 소비처 0** 이다: `persons.e2e-spec.ts` 8 지점 · `person-identity-continuation.e2e-spec.ts` 5 지점 · `persons.smoke-spec.ts` 5 지점 전부 `.set("Cookie", adminCookie)` 선탑재 (adminCookie 는 `ADMIN_EMAIL` 토큰), `service-identities.e2e-spec.ts` 는 nested identities route 만 쓰고 `/api/persons` write 를 직접 호출하지 않는다, perf 5 spec 중 write 를 호출하는 것은 없다, k6 S3 write 2 왕복은 T-2028 이 SuperAdmin 자격으로 올렸다. 따라서 **판정면 flip 은 census 한 곳** 이고 ④a 때처럼 perf negative 를 뒤집을 필요가 없다.
- 최근 owner commit (PLAN `157` · `158` · `182` · `183 행`) 중 본 slice 를 금지하는 것은 없다 — `158 행` 은 per-route perf baseline **신설** 만 금지하고 본 slice 는 perf 파일을 건드리지 않는다.

## Required Reading

- [src/user/person.controller.ts](../../src/user/person.controller.ts) — `19~30 행` (머리 주석의 "RBAC 배선 현황 (T-2027 — Q-0056 ④a, read 축만)" 블록, 특히 "write 축 3 route 는 **아직 미배선**" 서술이 본 slice 갱신 대상), `44~52 행` (import 블록 — `UseGuards` · `JwtAuthGuard` · `RolesGuard` · `Roles` 는 이미 import 됨), `85~89 행` · `103~105 행` (read 축 배선 선례 — 주석 1 줄 + decorator 2 줄 형태를 그대로 mirror), `110~141 행` (배선 대상 3 핸들러 `create` · `update` · `remove` 의 기존 주석 + decorator).
- [src/user/assessment.controller.ts](../../src/user/assessment.controller.ts) `27~32 행` · `112~116 행` — Admin+ write 축 배선 선례 정본 (`@Roles("Admin")` 형태와 근거 주석 형식).
- [src/user/person.controller.spec.ts](../../src/user/person.controller.spec.ts) — `576 행` (`type RouteName` — `create` · `update` · `remove` 가 이미 포함), `579~641 행` (`describe("PersonController (RBAC guard 배선 — T-2027)")` 의 harness: `reflector` · `handlerOf` · `guardsOf` · `rolesOf` · `makeAllowingJwtGuard` · `buildApp`), `587~591 행` (`READ_ROUTES` 표 — 본 slice 는 `WRITE_ROUTES` 표를 같은 형태로 추가), `642~650 행` (happy `it.each`), `652~680 행` (error path `DENIALS` 표), `681~715 행` (role 등급 분기 `ESCALATED` 표 + role 미부여 403), `716~753 행` (negative 대조군 (a)~(d) — **(a) `717~723 행` 은 "write 축 3 route 에 metadata 없음" 단언이라 본 slice 로 반드시 뒤집힌다**).
- [docs/architecture/api.md](../architecture/api.md) `80 행` (`POST /api/persons` → **Admin+**) · `82 행` (`PATCH /api/persons/:id` → **Admin+**) · `83 행` (`DELETE /api/persons/:id` → **Admin+**) — 권한 등급의 정본. `79 행` · `81 행` (read 축 User+) 은 이미 반영됨.
- [test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts](../../test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts) — `30 행` (`MIN = { controllers: 23, routes: 89, guarded: 66 }`), `56~62 행` (`KNOWN_GAP_REQ_043` 의 persons 블록 주석 + 제거 대상 3 항목), `66~70 행` (`UNPROTECTED_ALLOWLIST` 합집합), `113~119 행` (실측 미보호 집합 == allowlist 양방향 비교), `121~131 행` (건수 고정 `toBe(18)` · `toBe(23)` + `PUBLIC_BY_DESIGN` 5 + 교집합 0).
- [test/smoke/persons.smoke-spec.ts](../../test/smoke/persons.smoke-spec.ts) `34 행` — "guard 미배선이라 기존 단언은 무변경" 주석 1 줄이 본 slice 로 stale 이 된다 (주석만 갱신, 단언 무변경).

## Acceptance Criteria

- [ ] `src/user/person.controller.ts` 의 `create` (`@Post()`) · `update` (`@Patch(":id")`) · `remove` (`@Delete(":id")`) 3 핸들러에 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` 이 부착된다 (read 축 `87~89 행` 형태 동형, `@HttpCode` 등 기존 decorator 순서 보존). import 추가 **0** (4 심볼 모두 이미 import 됨) · 새 dependency 0 · 새 guard class 신설 0 · `ROLE_HIERARCHY` 변경 0.
- [ ] read 축 2 route (`findActive` · `findOne`) 의 `@Roles("User")` 는 **무변경** 이고, 클래스 레벨 `@UseGuards` · `@Roles` 부착은 여전히 **0** 이다 (handler 단위 유지 — 클래스 레벨이면 census 가 tier 구분을 잃는다).
- [ ] 머리 주석 갱신: `19~30 행` 의 "RBAC 배선 현황" 블록에서 "write 축 3 route 는 **아직 미배선** … ④b 책임" 서술을 **현재 상태**로 바로잡는다 — write 축 3 route 는 Admin+ 게이트 완료 (근거 api.md `80` · `82` · `83 행`), 남은 조각은 e2e 인가 단언 (④c) 뿐임을 2~4 줄로 명시한다. `git grep -n "아직 미배선" src/user/person.controller.ts` 가 0 hit 이다.
- [ ] `src/user/person.controller.spec.ts` 의 기존 `describe("PersonController (RBAC guard 배선 — T-2027)")` 안에 `WRITE_ROUTES` 표 (`[["POST /api/persons","create"],["PATCH /api/persons/:id","update"],["DELETE /api/persons/:id","remove"]]`) 를 추가하고 **harness (`buildApp` · `makeAllowingJwtGuard` · `guardsOf` · `rolesOf`) 를 재사용** 한다 (중복 정의 금지 — 신설 describe 를 따로 만들지 말고 기존 블록을 확장한다).
- [ ] **happy-path 단언 (route 당 1+)** — `it.each(WRITE_ROUTES)` 로 3 route 각각의 guard 목록이 `[JwtAuthGuard, RolesGuard]` 이고 `@Roles` 값이 `["Admin"]` 임을 `Reflector` 로 단언한다.
- [ ] **error path 단언 1+** — write 축에서 guard 가 거부하면 handler body 가 실행되지 않음을 검증한다: `canActivate=false` (403) 와 `UnauthorizedException` throw (401) 두 거부 형태 각각에서 3 route 호출 시 `PersonService.create` · `update` · `remove` mock call count 가 **0** 이다 (기존 `DENIALS` 표 재사용).
- [ ] **분기별 test** — `@Roles("Admin")` 이 소비하는 role 등급 분기를 cover: `Admin` · `SuperAdmin` 은 통과하고 (`ROLE_HIERARCHY` escalation), **`User` 등급은 403 + service 미호출**, role 미부여 / 미인증도 통과하지 않음을 분기마다 1+ 로 단언한다. production 쪽 새 분기는 없고 decorator 부착뿐이라는 사실은 spec 주석 1 줄로 남긴다.
- [ ] **예외 분기별 negative 단언** — 각 1+: (a) 기존 `716~723 행` 의 "(a) write 축 3 route 에는 guard · @Roles metadata 가 없다" 단언을 **제거하고 그 자리를 tier 대조군으로 교체** 한다 — read 축은 정확히 `["User"]`, write 축은 정확히 `["Admin"]` 이고 서로 바뀌면 red (read 축이 Admin 으로 좁혀지거나 write 축이 User 로 느슨해지는 두 방향 모두 탐지). (b) write 축 `@Roles` 가 `"User"` / `"SuperAdmin"` 으로 바뀌면 red 인 정확 등가 단언 (tier 오설정). (c) 클래스 레벨 `@UseGuards` · `@Roles` 부착 0 단언은 **유지** (기존 (c) 그대로). (d) write 축 guard 목록에 `RolesGuard` 가 있고 길이가 2 — 빠지면 인증만 하고 인가를 빼먹은 형태로 red.
- [ ] `test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts` 판정면을 **실측에 맞춰** 갱신한다: `KNOWN_GAP_REQ_043` 에서 `"POST /api/persons"` · `"PATCH /api/persons/:id"` · `"DELETE /api/persons/:id"` 3 항목 제거 (18 → 15), `121~131 행` 의 건수 고정 `toBe(18)` → `15` · `toBe(23)` → `20`, `30 행` `MIN.guarded` `66` → `69`. `PUBLIC_BY_DESIGN` 5 항목 · 교집합 0 · `MIN.controllers` 23 · `MIN.routes` 89 · `APP_GUARD` 0 단언은 **무변경** 이다. `56~62 행` 의 persons 블록 주석은 "persons 5 route 전량 배선 완료 (④a read T-2027 / ④b write T-2029) — 남은 15 항목은 groups · parts 축" 취지로 갱신한다.
- [ ] `test/smoke/persons.smoke-spec.ts` `34 행` 주석을 "write 축은 Admin+ 게이트 완료 (T-2029) — 기존 요청이 이미 `adminCookie` 선탑재라 단언은 무변경" 취지로 바로잡는다 (**주석만** — `it` / `expect` / 요청 체인 변경 0).
- [ ] `pnpm lint && pnpm build && pnpm test` green. `pnpm test:smoke` green (특히 `route-auth-guard-coverage-census-drift.smoke-spec.ts` 전건 + `persons.smoke-spec.ts`). `pnpm test:e2e` green (`persons.e2e-spec.ts` · `person-identity-continuation.e2e-spec.ts` · `service-identities.e2e-spec.ts` 가 cookie 선탑재로 **무수정** 통과함을 확인).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] **regression test** (hqOrigin Q-0056): 위 negative (a) tier 대조군이 regression 가드다 — 누가 write 축 `@Roles` 를 제거하거나 `"User"` 로 느슨하게 바꾸면 spec 이 red 가 되고, census 건수 고정 (`15` · `20` · `MIN.guarded` 69) 이 두 번째 그물이 된다. PR body 에 배선 지점을 파일 · 행 단위 표로 적는다.
- [ ] 변경 파일은 `touchesFiles` **4 개** 를 넘지 않고 diff 는 **300 LOC 이하** 다. 초과가 보이면 ① write 축 단언을 기존 `it.each` 표에 흡수 (새 describe 신설 금지) ② `persons.smoke-spec.ts` 주석 갱신을 `## Follow-ups` 로 미뤄 3 파일로 축소 를 **순서대로** 시도하고, 그래도 넘으면 중단하고 `## Follow-ups` 에 수치를 적는다 (cap 우회 금지).

## Out of Scope

- **④c e2e 인가 단언 신설** — `test/e2e/persons.e2e-spec.ts` 의 무 cookie 401 (5 route) · User cookie 로 mutation 403 (3 route) 단언 신설 + 실 `RolesGuard` instance escalation describe. 본 slice 는 그 파일을 **읽기만** 하고 수정하지 않는다 (선행 chain 이 이미 cookie 를 실어 무수정 green).
- `test/perf/*` 전체 — write 축을 호출하는 perf spec 이 없으므로 판정면 flip 대상 0. per-route perf baseline 신설은 PLAN `158 행` 이 금지한다.
- `test/load/*.js` · `.github/workflows/load-k6.yml` 변경, 실 k6 run 발화 — S3 write 자격은 [T-2028](T-2028-k6-s1-s3-bootstrap-superadmin.md) 이 이미 올렸다.
- nested identities route (`/api/persons/:personId/identities*` 6 route) 배선 — persons 최상위 5 route 와 별 축이고 census 의 남은 15 항목에 속한다.
- groups (9 route) · parts (6 route) 배선 — Q-0056 `decision` 의 순서상 persons 완결 후.
- `docs/architecture/api.md` · `docs/requirements.md` REQ-043 · 045 · 073 재판정 · `docs/ops/load-resilience-test-plan.md` · `test/perf/README.md` 의 "cookie 없이 측정" 전제 doc-sync — CLAUDE.md §3.1 판정 규칙 대로 persons 축 ④a~④c 완결 뒤 direct doc-only slice 1 개로 묶는다 ([T-2027](T-2027-persons-read-tier-guard-wiring.md) `## Out of Scope` 예약분 승계).
- 새 guard class · 새 role 등급 · `APP_GUARD` 전역 배선 · `ROLE_HIERARCHY` 변경 · `package.json` 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (planner, arc 계획 — Q-0056 persons 축 ④ 마지막 조각) **④c e2e 인가 단언**: `test/e2e/persons.e2e-spec.ts` 1 파일에 무 cookie 401 (5 route) · User cookie mutation 403 (3 route) 단언 신설 + 실 `RolesGuard` instance escalation 축 (`assessment.controller.spec.ts` `689 행~` 형태). 1 파일 slice 라 cap 여유. 본 slice 머지 후 큐잉한다.
- (planner 판정, CLAUDE.md §3 소비처 동반 의무) 본 slice 는 helper · factory 신설이 아니라 **기존 guard 2 개를 실제 route 3 개에 배선하는 소비처 그 자체** 이고, 배선으로 깨지는 유일한 판정면 (census) 을 같은 PR 에서 함께 닫는다 → 하한 충족, 별 소비처 slice 예약 없음.
- (planner 판정, cap) ④a 실측 (`d8e7bebb`: 4 파일 +297/-44, 그 중 spec +214) 기준 본 slice 는 route 1 개 많지만 **T-2027 이 깐 harness (`buildApp` · `DENIALS` · `ESCALATED` 표) 를 재사용** 하므로 spec 증분이 표 추가 + it.each 확장으로 압축된다. perf 판정면 flip 도 없어 `estimatedDiff` 250 / `estimatedFiles` 4 로 cap 안이라 판단했다 — split · `sizeExempt` 불요.
