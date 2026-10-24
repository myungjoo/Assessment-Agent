---
id: T-2037
title: groups guard 실배선 ⑤a — GroupController read 축 4 route (User+) 인증 게이트 + census 판정면 갱신
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-043, REQ-045, REQ-073]
estimatedDiff: 250
estimatedFiles: 3
created: 2026-10-23
independentStream: q0056-groups-guard
dependsOn: [T-2031, T-2032, T-2033, T-2034, T-2035, T-2036]
touchesFiles:
  [
    src/user/group.controller.ts,
    src/user/group.controller.spec.ts,
    test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts,
  ]
hqOrigin: Q-0056
plannerNote: P5 · Q-0056 ① groups 축 ⑤a — 선행 ①~④ 머지 완료, read 4 route User+ 실배선 (T-2027 동형)
---

# T-2037 — GroupController read 축 4 route 인증 게이트 (Q-0056 ⑤a)

## Why

[PLAN.md](../PLAN.md) `157 행` 오너 최우선 지시 아래 진행하는 Q-0056 arc 의 groups 축이다. 오너 결정은 `STATE.humanQuestions` Q-0056 `decision` 의 옵션 ① (persons → groups → parts, 기존 `JwtAuthGuard` · `RolesGuard` · `@Roles` 재사용, 새 dependency 0) 이다. [T-2031](T-2031-groups-guard-precursor-cookie-preattach.md) `## Follow-ups` 가 정한 순서 중 선행 ① e2e · smoke (T-2031), ② web 계약 (T-2032 · T-2033), ③ perf 6 spec (T-2034 · T-2035), ④ k6 (T-2036, `55c10020`) 이 모두 머지됐다. 그래서 이제 **⑤ 실배선** 에 들어간다. persons 축 [T-2027](T-2027-persons-read-tier-guard-wiring.md) 과 같이 tier 로 나눈 첫 조각으로, **read 축 4 route** 만 배선한다.

**api.md tier 행 누락 4 route 판정 (T-2031 Follow-ups 미결 항목 처리)**: api.md `89~93 행` groups 표에는 9 route 중 5 행만 있다. 이번 slice 에 걸리는 read 2 route (`GET /api/groups/:id` · `GET /api/groups/:id/persons`) 는 관례로 **`User+` 로 확정** 하고 HQ 는 올리지 않는다. 근거는 다음과 같다. 표 안의 모든 GET 행 (groups 목록 · `:id/members`, persons 목록 · `:id`, parts 목록) 이 예외 없이 `User+` 이고, README `86 행` 이 User 를 read-only 등급으로 정의한다. 또 T-2031 이후 모든 선행 slice 가 이 관례로 cookie 를 골랐으므로 재작업도 0 이다. write 2 route (`POST :id/members` · `DELETE :id/members/:membershipId`) 의 `Admin+` 확정은 ⑤b 몫이다.

issue-still-relevant pre-check (planner, 2026-10-23, `origin/main` = `f3a34549`):

- `src/user/group.controller.ts` 의 `UseGuards` · `@Roles` hit 는 **0** 이다. 머리 주석 `51 행` 도 "AuthGuard (Admin+ / User+) 적용 안 함 — 후속 task 책임" 이라고 적고 있다. → 의도가 main 에 아직 안착하지 않았으므로 착수는 유효하다.
- read 4 handler 는 `findAll` (`92 행` `@Get()`) · `findById` (`99 행` `@Get(":id")`) · `findPersons` (`108 행` `@Get(":id/persons")`) · `findMembers` (`120 행` `@Get(":id/members")`) 이다.
- census `KNOWN_GAP_REQ_043` 는 15 항목이고 그중 groups read 4 항목이 `43~46 행` 에 있다. `121 행` `toBe(15)` · `122 행` `toBe(20)` 이고 `30 행` `MIN.guarded` 는 `69` 다.
- 배선 후 깨질 수 있는 소비처를 실측했다. e2e · smoke (T-2031) · perf 6 spec (T-2034 mock 부트 guard override, T-2035 realdb cookie) · k6 s2 (T-2036) 는 모두 선탑재가 끝났다. group perf 6 spec 에는 "cookie 미부착이라도 200" 류 negative 단언이 **없어서** T-2027 의 realdb perf 같은 flip 지점은 0 이다 (`grep -n "401" test/perf/group-*.ts` 는 주석만 hit). k6 s2 는 stamp 파생 `User` cookie 를 쓰는데, read 축은 `User+` 라 충분하다.
- 본 slice 를 금지하는 owner commit 은 없다. PLAN `158 행` 이 금지하는 것은 per-route perf baseline 신설이라 저촉되지 않는다.

## Required Reading

- `docs/STATE.json` 의 `humanQuestions` Q-0056 `decision` — 오너 승인 원문과 조건
- **선례 (그대로 따른다)**: [docs/tasks/T-2027-persons-read-tier-guard-wiring.md](T-2027-persons-read-tier-guard-wiring.md) 와 그 머지 commit `d8e7bebb` (PR #1588). 실측 diff 는 controller `+34` · spec `+148` · census `+19` 다.
- [src/user/group.controller.ts](../../src/user/group.controller.ts) — `1~60 행` (머리 주석. `5~13 행` route 목록, `51 행` "AuthGuard 적용 안 함" 서술이 갱신 대상), import 블록, `79~86 행` (`@Controller` + controller-scope `@UsePipes`), `92~125 행` (read handler 4 개의 decorator 블록)
- [src/user/person.controller.ts](../../src/user/person.controller.ts) — read 축 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("User")` 배선 형태와 근거 주석 형식 (T-2027 정본)
- [src/user/person.controller.spec.ts](../../src/user/person.controller.spec.ts) `566~800 행` — `describe("PersonController (RBAC guard 배선 …)")` 의 `GUARDS_METADATA_KEY` · `Reflector` 단언, error path · 분기 · negative 국면 구성
- [src/user/group.controller.spec.ts](../../src/user/group.controller.spec.ts) — `148 행` `describe("GroupController (unit)")`, `557 행` ValidationPipe integration (`584 행` `Test.createTestingModule`). guard 부착 뒤 DI 가 깨지지 않는지 확인한다 (T-2027 이 person spec 에서 어떻게 처리했는지 참고).
- [test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts](../../test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts) — `30 행` `MIN`, `41~60 행` `KNOWN_GAP_REQ_043`, `120~122 행` 건수 고정
- [docs/architecture/api.md](../architecture/api.md) `89 행` (`GET /api/groups` User+) · `93 행` (`GET /api/groups/:id/members` User+) — 권한 등급의 정본 (**수정 금지**, doc-sync 는 arc 완결 뒤)
- [test/e2e/groups.e2e-spec.ts](../../test/e2e/groups.e2e-spec.ts) · [test/smoke/groups.smoke-spec.ts](../../test/smoke/groups.smoke-spec.ts) — GET 호출에 `userCookie` 가 이미 실려 있어 무수정으로 통과하는지 **확인만** 한다. T-2027 은 `persons.smoke-spec.ts` 를 3 줄 고쳤다. 실행 시점에 red 가 되는 cookie 누락 호출이 보이면 그 파일을 4 번째 파일로 더해 최소 수정하고 PR body 에 사유를 적는다.

## Acceptance Criteria

**배선 (production)**

- [ ] `group.controller.ts` 의 read 4 handler (`findAll` · `findById` · `findPersons` · `findMembers`) 에 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("User")` 를 부착한다 (person.controller read 축 형태와 같게). import 는 `@nestjs/common` 의 `UseGuards` 와 `src/auth` 의 기존 `JwtAuthGuard` · `RolesGuard` · `Roles` 를 재사용한다. **새 dependency 0 · 새 guard class 0**.
- [ ] write 5 route (`create` · `addMember` · `update` · `delete` · `removeMember`) 는 **무변경** 이다 (⑤b 몫). 클래스 레벨 `@UseGuards` 는 붙이지 않는다. 클래스 레벨에 붙이면 census 가 9 route 전량을 보호로 세어 ⑤b 와의 경계가 무너진다.
- [ ] 머리 주석 갱신: `51 행` 의 "AuthGuard 적용 안 함" 서술을 현재 상태로 바로잡는다. read 4 route 는 User+ 게이트 완료 (T-2037), write 5 route 는 미배선 (⑤b) 이라고 2~4 줄로 적는다. 근거로 api.md `89 행` · `93 행`, tier 행 누락 2 route 의 관례 판정 (본 task `## Why`), Q-0056 을 가리킨다. `1 행` 의 "8 REST endpoint" 도 실측 9 로 고친다.

**spec — R-112 (1)~(4)**

- [ ] **happy-path**: `group.controller.spec.ts` 에 `describe("GroupController (RBAC guard 배선 — T-2037 read)")` 1 개를 추가한다. read 4 route 각각에서 `Reflector` 로 읽은 guard 목록이 `JwtAuthGuard` · `RolesGuard` 를 포함하고 `@Roles` 값이 `["User"]` 인지 단언한다 (route 당 1+, `it.each` 표 권장).
- [ ] **error path 1+**: `JwtAuthGuard` stub 의 `canActivate` 가 `false` 이거나 throw 하는 상태에서 read 4 route 를 호출하면 handler body (`GroupService.findAll` · `findById` · `findPersonsByGroupId` · members 조회 메서드 — 실명은 spec 에서 확인) 가 **호출되지 않는다** (mock call count 0).
- [ ] **분기별 test**: `@Roles("User")` 가 소비하는 role 등급 축을 분기마다 1+ 로 단언한다. `User` · `Admin` · `SuperAdmin` 은 통과하고 (escalation), role 미부여 · 미인증은 통과하지 못한다. production 쪽에 새 분기가 없다는 사실 (decorator 부착뿐) 은 spec 주석 1 줄로 남긴다.
- [ ] **예외 분기별 negative (각 1+)**: (a) write 5 route 에는 guard metadata 가 **없다** (⑤b 미착수 대조군, 과잉 배선 방지). (b) `@Roles` 값이 `"Admin"` 이면 red 가 되는 대조 단언 (tier 오설정 탐지). (c) 클래스 레벨 `@UseGuards` metadata 가 없다는 단언 (경계 붕괴 탐지). (d) guard 목록에 `RolesGuard` 가 빠지면 red (인증만 하고 인가를 빼먹는 형태 탐지).
- [ ] **regression (`hqOrigin` Q-0056)**: 위 happy (4 route guard + `User` tier) 와 census 갱신이 regression 가드 역할을 한다. 누가 read 축 decorator 를 되돌리면 unit spec 과 census smoke 가 함께 red 가 된다. PR body 에 route · handler · tier 표를 적는다.

**census 판정면**

- [ ] `route-auth-guard-coverage-census-drift.smoke-spec.ts` 를 실측에 맞춘다. `KNOWN_GAP_REQ_043` 에서 groups read 4 항목 (`GET /api/groups` · `GET /api/groups/:id` · `GET /api/groups/:id/persons` · `GET /api/groups/:id/members`) 을 제거한다 (15 → 11). 건수 고정은 `toBe(15)` → `11`, `toBe(20)` → `16` 으로, `MIN.guarded` 는 `69` → `73` 으로 바꾼다. 목록 끝 주석은 "남은 11 항목은 groups write 5 · parts 6" 취지로 고친다. `PUBLIC_BY_DESIGN` 5 항목 · 교집합 0 · `MIN.controllers` · `MIN.routes` · `APP_GUARD` 0 단언은 **무변경** 이다.

**실행 검증**

- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `pnpm test:smoke` 통과 (특히 census drift · `groups.smoke-spec.ts`). `pnpm test:e2e` 통과 (`groups.e2e-spec.ts` 가 cookie 선탑재로 무수정 통과). 로컬 DB 가 없으면 PR head CI run 으로 확인하고 그 사실을 PR body 에 적는다.
- [ ] `git diff --stat` 이 `touchesFiles` 3 파일 (위 소비처 예외 시 4) 이내이고 diff ≤ 300 LOC 다. 넘칠 것 같으면 role 분기 단언을 `it.each` 표로 먼저 압축한다. 그래도 넘으면 중단하고 수치를 `## Follow-ups` 에 적는다 (cap 우회 금지).

## Out of Scope

- write 5 route Admin+ 배선과 그 tier 행 누락 2 route (`POST :id/members` · `DELETE :id/members/:membershipId`) 판정 — ⑤b.
- e2e 무 cookie 401 · User cookie mutation 403 단언 신설, 실 `RolesGuard` instance escalation describe — ⑤c.
- **s2-read.js bootstrap 자격 tier 상향** — ⑤b 착수 전 선행 slice ([T-2036](T-2036-k6-s2-groups-cookie-preattach.md) `## Follow-ups` 둘째 항목). read 축은 `User` cookie 로 충분하므로 본 slice 앞에 둘 필요가 없다.
- perf 6 spec · k6 · web 수정, `test/helpers/` 수정, 새 dependency, `APP_GUARD` 전역 배선, `ROLE_HIERARCHY` 변경.
- parts 축 전체.
- `docs/architecture/api.md` tier 행 추가 · `docs/requirements.md` REQ 재판정 · `test/perf/README.md` · `docs/ops/load-resilience-test-plan.md` · perf spec 주석의 "guard 미부착" 서술 doc-sync. CLAUDE.md §3.1 에 따라 3 controller arc 가 머지된 뒤 REQ 당 1 회 처리한다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (planner, arc 계획 — Q-0056 groups 축 잔여) 순서는 ⑤a (본 task) → **s2 bootstrap SuperAdmin 자격 상향 선행** (T-2028 동형, `s2-read.js` + drift smoke 2 파일) → ⑤b write 5 route `Admin+` (census 11 → 6 · `MIN.guarded` 73 → 78, T-2029 동형) → ⑤c e2e 401 · 403 (T-2030 동형). ⑤b 착수 전에는 write 축을 cookie 없이 또는 User cookie 로 부르는 소비처를 다시 전수 실측한다.
- (planner 판정, CLAUDE.md §3 소비처 동반 의무) helper · factory 신설이 없다. 기존 guard 2 개를 route 4 개에 배선하는 소비처 그 자체이고, 배선으로 깨지는 판정면 (census) 을 같은 PR 에서 닫는다 → 하한 충족.
- (planner 판정, cap) base 약 210 LOC (controller 배선 + 주석 ~35 · spec describe ~150 · census ~20) 를 T-2027 실측 (+175/-29, read 2 route) 에 맞춰 보정했다. route 가 4 개라 spec 표 행이 늘어 추정은 250 LOC · 3 파일로 cap 안이다. R-112 backbone multiplier × 1.5 는 적용하지 않았다. 본 slice 는 DTO · service 신설이 없는 decorator 배선이고, 같은 형태의 실측 선례 (T-2027 · T-2029) 가 직접 있기 때문이다. `sizeExempt` 는 필요 없다.
