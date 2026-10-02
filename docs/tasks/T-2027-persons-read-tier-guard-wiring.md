---
id: T-2027
title: persons guard 실배선 ④a — PersonController read 축 2 route (User+) 인증 게이트 + census · perf 판정면 flip
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-043, REQ-045, REQ-073]
estimatedDiff: 280
estimatedFiles: 4
created: 2026-10-01
independentStream: q0056-persons-guard
dependsOn: [T-2020, T-2021, T-2022, T-2023, T-2024, T-2025, T-2026]
touchesFiles:
  [
    src/user/person.controller.ts,
    src/user/person.controller.spec.ts,
    test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts,
    test/perf/person-measure-confirm-realdb.perf-spec.ts,
  ]
hqOrigin: Q-0056
plannerNote: P5 · Q-0056 ① 승인 ④ 실배선 1/3 — read 축 2 route 만. 선례 T-0121·T-0122 가 652 LOC 라 tier 로 split
---

# T-2027 — PersonController read 축 2 route 인증 게이트 (Q-0056 ④a)

## Why

[PLAN.md](../PLAN.md) `157 행` 오너 최우선 지시 아래 진행한 Q-0056 persons guard arc 의 **선행 chain 7 slice (T-2020 ~ T-2026) 가 전부 머지돼** 이제 실배선 단계 ④ 에 들어선다. 오너 결정은 `STATE.humanQuestions` Q-0056 `decision` 의 **옵션 ① 승인** (persons → groups → parts 순서, 기존 `JwtAuthGuard` · `RolesGuard` · `@Roles` 재사용, 새 dependency 0) 이고, arc 의 정본 순서는 [T-2020](T-2020-persons-guard-precursor-cookie-preattach.md) `## Follow-ups` 의 **④** 다.

④ 를 **route tier 로 3 분할한 첫 조각**이 본 slice 다 — api.md `79 행` · `81 행` 의 **User+ read 축 2 route** (`GET /api/persons` · `GET /api/persons/:id`) 만 배선한다. 분할 근거는 선례 실측이다: 같은 형태의 controller 전량 배선인 [T-0121](T-0121-assessment-controller-rbac.md) (`929166df`, 4 route) 과 [T-0122](T-0122-contribution-controller-rbac.md) (`6779cf8b`, 4 route) 가 각각 **654 LOC / 652 LOC · 3 파일** 로 CLAUDE.md §3 cap (≤ 300 LOC) 의 2 배를 썼다 (controller `+46` · controller spec `+360` · e2e `+298~309`). persons 는 5 route 라 전량 배선은 cap 을 더 크게 넘는다.

issue-still-relevant pre-check (planner, 2026-10-01, `origin/main` = `d9c3e3dc`):

- [src/user/person.controller.ts](../../src/user/person.controller.ts) 의 `UseGuards` hit **0** · `@Roles` hit **0** · `src/` 전체 `APP_GUARD` **0** → 본 task 의 의도는 main 에 미안착, 착수 유효.
- 소비처 전수 실측 (`api/persons` 참조 spec 31 건) 결과 **read 축 배선으로 깨지는 판정면은 2 곳뿐** 이다 — census allowlist (아래 `## Required Reading`) 와 `person-measure-confirm-realdb.perf-spec.ts` 의 cookie-less 200 단언. 나머지는 선행 chain 이 이미 닫았다: e2e 3 건 · smoke 1 건은 cookie 선탑재 (T-2020), realdb perf 3 건은 cookie 선탑재 (T-2022), mock-boot perf 2 건은 `overrideGuard` 선탑재 (T-2021), k6 3 종은 setup 부트스트랩 + cookie 선탑재 (T-2023 ~ T-2026).
- 최근 owner commit (PLAN `157 행` · `158 행` · `182 행` · `183 행`) 중 본 slice 를 금지하는 것은 없다 — `158 행` 은 per-route **perf baseline** 신설만 금지하고 본 slice 는 기존 perf spec 의 판정면 flip 이며, `182 행` 소비처 동반 의무는 아래 `## Follow-ups` 판정으로 충족한다.

## Required Reading

- [src/user/person.controller.ts](../../src/user/person.controller.ts) — `1~24 행` (머리 주석의 route 5 종 목록 + `20 행` 의 "AuthGuard 적용 안 함 — T-0038+ 책임" 서술이 본 slice 로 갱신 대상), `25~42 행` (import 블록), `44~52 행` (`@Controller` + controller-scope `@UsePipes`), `@Get()` · `@Get(":id")` 핸들러 2 개의 decorator 블록.
- [src/user/assessment.controller.ts](../../src/user/assessment.controller.ts) `27~32 행` · `91~95 행` · `112~116 행` — **배선 선례 정본**. User+ 조회 축의 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("User")` 2 줄 형태와 근거 주석 형식.
- [src/user/assessment.controller.spec.ts](../../src/user/assessment.controller.spec.ts) `482 행~` (`describe("AssessmentController (RBAC guard integration)")`) — guard metadata 단언 선례. 같은 파일 `689 행~` (`real RolesGuard escalation 분기`) 는 본 slice `## Out of Scope`.
- [docs/architecture/api.md](../architecture/api.md) `79 행` (`GET /api/persons` → **User+ (조회)**) · `81 행` (`GET /api/persons/:id` → **User+**) — 권한 등급의 정본. `80 행` · `82 행` · `83 행` (POST · PATCH · DELETE → Admin+) 은 본 slice 밖.
- [test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts](../../test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts) — `30 행` (`MIN = { controllers: 23, routes: 89, guarded: 64 }`), `42~63 행` (`KNOWN_GAP_REQ_043` 20 항목 — 그 중 `GET /api/persons` · `GET /api/persons/:id` 2 항목이 제거 대상), `66~70 행` (`UNPROTECTED_ALLOWLIST` 합집합), `113~119 행` (실측 미보호 집합 == allowlist 양방향 비교), `121~131 행` (태그 건수 고정 `5` · `20` · `25` + 교집합 0).
- [test/perf/person-measure-confirm-realdb.perf-spec.ts](../../test/perf/person-measure-confirm-realdb.perf-spec.ts) — `107~112 행` (`jar === null` 이면 Cookie 미부착 경로), `58 행` (`TAMPERED` cookie), **flip 대상 2 지점**: `200~210 행` (negative (a) "cookie 미부착 → 401 이 아니라 200") · `212~219 행` (negative (b) "변조 토큰 → 401/403 이 아니라 200"). 그대로 green 을 유지해야 하는 인접 단언: `137~171 행` (happy ①~③ 의 200 + 길이) · `221~245 행` (negative (c) 전량 inactive · (d) errorRate 혼합).
- [test/e2e/persons.e2e-spec.ts](../../test/e2e/persons.e2e-spec.ts) `35~36 행` — 요청 11 곳 전부에 tier cookie 가 이미 실려 있어 **본 slice 로 깨지지 않음**을 확인만 한다 (파일 수정 금지 — `## Out of Scope`).

## Acceptance Criteria

- [ ] `src/user/person.controller.ts` 의 `@Get()` (목록) 과 `@Get(":id")` (상세) 2 핸들러에 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("User")` 가 부착된다 (assessment.controller `91~95 행` 형태 동형). import 는 `@nestjs/common` 의 `UseGuards` + `src/auth` 의 `JwtAuthGuard` · `RolesGuard` · `Roles` 재사용이고 **새 dependency 0** · 새 guard class 신설 0.
- [ ] 같은 controller 의 `@Post()` · `@Patch(":id")` · `@Delete(":id")` 3 route 는 **무변경** (write 축은 ④b 책임) — decorator 추가 0, 클래스 레벨 `@UseGuards` 부착 0 (클래스 레벨이면 census 가 5 route 전량 보호로 세어 ④b 와 경계가 무너진다).
- [ ] 머리 주석 갱신: `20 행` 의 "AuthGuard (Admin+ / User+) 적용 안 함 — T-0038+ 책임" 서술을 **현재 상태**로 바로잡는다 — read 축 2 route 는 User+ 게이트 완료, write 축 3 route 는 미배선 (④b) 임을 2~4 줄로 명시하고 근거로 api.md `79 행` · `81 행` 과 Q-0056 을 가리킨다.
- [ ] `src/user/person.controller.spec.ts` 에 guard metadata 를 검증하는 `describe` 1 개를 추가한다 (assessment.controller.spec `482 행~` 동형). **happy-path** — `GET /api/persons` · `GET /api/persons/:id` 각 핸들러에서 `Reflector` 로 읽은 guard 목록이 `JwtAuthGuard` · `RolesGuard` 를 포함하고 `@Roles` 값이 `"User"` 임을 단언 (route 당 1+).
- [ ] **error path 단언 1+** — guard 가 거부하는 경로를 검증한다: `JwtAuthGuard` stub 의 `canActivate` 가 `false` / throw 인 상태로 2 route 를 호출하면 handler body (`PersonService.findActive` · `findOne`) 가 **호출되지 않는다** (service mock call count 0).
- [ ] **분기별 test** — `RolesGuard` 가 소비하는 role 등급 분기를 cover: `@Roles("User")` 상태에서 `User` · `Admin` · `SuperAdmin` 3 등급이 모두 통과하고 (escalation), role 미부여 / 미인증은 통과하지 않음을 분기마다 1+ 로 단언. 본 slice 가 production 쪽에 새 분기를 추가하지 않는다는 사실 (decorator 부착뿐) 은 spec 주석 1 줄로 남긴다.
- [ ] **예외 분기별 negative 단언** — 각 1+: (a) write 축 3 route 에는 guard metadata 가 **없음** (④b 미착수 사실의 대조군, 과잉 배선 방지), (b) `@Roles` 값이 `"Admin"` 으로 바뀌면 red 가 되는 대조 단언 (tier 오설정 탐지), (c) 클래스 레벨 `@UseGuards` 가 부착되면 red 가 되는 단언 (경계 붕괴 탐지), (d) guard 목록에서 `RolesGuard` 가 빠지면 red (인증만 하고 인가를 빼먹는 형태 탐지).
- [ ] `test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts` 판정면을 **실측에 맞춰** 갱신한다: `KNOWN_GAP_REQ_043` 에서 `"GET /api/persons"` · `"GET /api/persons/:id"` 2 항목 제거 (20 → 18), `121~131 행` 의 건수 고정 `toBe(20)` → `18` · `toBe(25)` → `23`, `30 행` `MIN.guarded` `64` → `66`. `PUBLIC_BY_DESIGN` 5 항목 · 교집합 0 · `MIN.controllers` 23 · `MIN.routes` 89 · `APP_GUARD` 0 단언은 **무변경**이고, 남은 18 항목 중 `POST`/`PATCH`/`DELETE /api/persons` 3 항목은 ④b 대상임을 주석 1 줄로 남긴다.
- [ ] `test/perf/person-measure-confirm-realdb.perf-spec.ts` 의 negative (a) · (b) 를 **flip** 한다 — cookie 미부착은 200 이 아니라 `401`, 변조 토큰도 `401` 임을 단언하고 (그에 맞게 `it` 문자열도 갱신), "guard 미부착" 전제 주석 (`107 행` 부근 · `200 행` 부근) 을 "read 축 guard 배선 완료 (T-2027)" 로 바로잡는다. happy ①~③ 의 cookie 부착 경로 200 단언과 negative (c) · (d) 는 **문자 단위 그대로** 유지한다 (측정 축 · errorRate 셈법 변경 0).
- [ ] `pnpm lint && pnpm build && pnpm test` green. `pnpm test:smoke` green (특히 `route-auth-guard-coverage-census-drift.smoke-spec.ts` 전건 + `persons.smoke-spec.ts`). `pnpm test:e2e` green (`persons.e2e-spec.ts` · `person-identity-continuation.e2e-spec.ts` · `service-identities.e2e-spec.ts` 가 cookie 선탑재로 무수정 통과함을 확인).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] 변경 파일은 `touchesFiles` **4 개**를 넘지 않고 diff 는 300 LOC 이하다. 초과가 보이면 spec 의 role escalation 분기 단언을 `it.each` 표로 압축하는 것을 **먼저** 시도하고, 그래도 넘으면 중단하고 `## Follow-ups` 에 수치를 적는다 (cap 우회 금지).

## Out of Scope

- **write 축 3 route** (`POST` · `PATCH` · `DELETE /api/persons`) 의 Admin+ 배선 — ④b 별 slice (아래 `## Follow-ups`).
- `test/e2e/persons.e2e-spec.ts` 의 무 cookie 401 · User cookie mutation 403 단언 **신설** — ④c 별 slice. 본 slice 는 그 파일을 **읽기만** 하고 수정하지 않는다 (선행 chain 이 이미 cookie 를 실어 무수정 green).
- `src/user/assessment.controller.spec.ts` `689 행~` 형태의 **실 `RolesGuard` instance escalation describe 신설** — 본 slice 는 metadata + stub guard 축까지. 실 instance 축은 ④b 또는 ④c 에서 write 축과 함께.
- groups (9 route) · parts (6 route) 배선 — Q-0056 `decision` 의 순서상 persons 완결 후.
- `docs/architecture/api.md` · `docs/requirements.md` REQ-043 · 045 · 073 재판정 · `docs/ops/load-resilience-test-plan.md` · `test/perf/README.md` 의 "cookie 없이 측정" 전제 doc-sync — CLAUDE.md §3.1 판정 규칙 6 (구현 머지 후 REQ 당 1 회) 대로 persons 축 ④a~④c 완결 뒤 direct doc-only slice 1 개로 묶는다 ([T-2022](T-2022-persons-realdb-perf-cookie-preattach.md) `## Follow-ups` 예약분 흡수).
- 새 guard class · 새 role 등급 · `APP_GUARD` 전역 배선 · `ROLE_HIERARCHY` 변경.
- `test/load/*.js` · `.github/workflows/` · `package.json` 변경, 실 k6 run 발화.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (planner, arc 계획 — Q-0056 persons 축 ④ 잔여 2 조각) 순서대로 큐잉한다.
  - **④b write 축**: `src/user/person.controller.ts` 의 `@Post()` · `@Patch(":id")` · `@Delete(":id")` 에 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` 배선 (api.md `80 행` · `82 행` · `83 행`) + `person.controller.spec.ts` guard metadata 단언 3 route + census `KNOWN_GAP_REQ_043` 18 → 15 · `UNPROTECTED_ALLOWLIST` 23 → 20 · `MIN.guarded` 66 → 69. 착수 전 write 축을 cookie 없이 호출하는 spec 을 다시 전수 실측한다 (본 slice 실측 시점에는 `persons.e2e-spec.ts` · `persons.smoke-spec.ts` 가 전부 `adminCookie` 선탑재였다).
  - **④c e2e 인가 단언**: `test/e2e/persons.e2e-spec.ts` 에 무 cookie 401 (5 route) · User cookie 로 mutation 403 (3 route) 단언 신설 + 실 `RolesGuard` escalation 축. ④b 머지 후 1 파일 slice 라 cap 여유.
- (planner 판정, CLAUDE.md §3 소비처 동반 의무) 본 slice 는 helper · factory 신설이 아니라 **기존 guard 2 개를 실제 route 2 개에 배선하는 소비처 그 자체**이고, 배선으로 깨지는 판정면 2 곳 (census · realdb perf) 을 같은 PR 에서 함께 닫는다 → 하한 충족, 별 소비처 slice 예약 없음.
- (planner 판정, cap) ④ 를 한 slice 로 묶으면 선례 T-0121 (654 LOC) · T-0122 (652 LOC) 기준 **5 route × 3~5 파일 = 650 LOC 이상 · 5 파일** 로 cap (300 LOC / 5 파일) 을 2 배 초과한다. 그래서 `sizeExempt` 가 아니라 **route tier 로 split** 을 택했다 (④a read 2 route / ④b write 3 route / ④c e2e) — 각 조각이 독립적으로 CI green 을 유지하는 절단면이다.
