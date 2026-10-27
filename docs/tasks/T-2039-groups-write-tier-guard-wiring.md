---
id: T-2039
title: groups guard 실배선 ⑤b — GroupController write 축 5 route (Admin+) 인증·인가 게이트 + census 판정면 갱신
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-043, REQ-045, REQ-073]
estimatedDiff: 230
estimatedFiles: 4
created: 2026-10-27
independentStream: q0056-groups-guard
dependsOn: [T-2037, T-2038]
touchesFiles:
  [
    src/user/group.controller.ts,
    src/user/group.controller.spec.ts,
    test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts,
    test/smoke/groups.smoke-spec.ts,
  ]
hqOrigin: Q-0056
plannerNote: P5 · Q-0056 ① groups 축 ⑤b — ⑤a·s2 bootstrap 선행 머지 완료, write 5 route Admin+ 실배선 (T-2029 동형)
---

# T-2039 — GroupController write 축 5 route Admin+ 게이트 (Q-0056 ⑤b)

## Why

[PLAN.md](../PLAN.md) `157 행` 오너 최우선 지시 아래 도는 Q-0056 arc 의 groups 축이다. 오너 결정은 `STATE.humanQuestions` Q-0056 `decision` 의 옵션 ① (persons → groups → parts, 기존 `JwtAuthGuard` · `RolesGuard` · `@Roles` 재사용, 새 dependency 0) 이다. [T-2037](T-2037-groups-read-tier-guard-wiring.md) `## Follow-ups` 첫 항목이 정한 순서는 ⑤a read → s2 bootstrap 자격 상향 → **⑤b write** → ⑤c e2e 다. 앞의 둘은 머지됐다 (⑤a `62dd40b4` PR #1598, [T-2038](T-2038-k6-s2-bootstrap-superadmin.md) `0489ec13` PR #1599). persons 축 [T-2029](T-2029-persons-write-tier-guard-wiring.md) 와 같은 형태로 **write 축 5 route** 를 배선한다.

**api.md tier 행 누락 2 route 판정 (T-2037 Out of Scope 예약분 처리)**: api.md groups 표 (`89~93 행`) 에는 `POST :id/members` · `DELETE :id/members/:membershipId` 행이 없다. 둘 다 관례로 **`Admin+` 로 확정** 하고 HQ 는 올리지 않는다. 근거는 다음과 같다. 표 안의 모든 mutation 행 (groups POST · PATCH · DELETE, persons write 3 route, nested identities 4 route, parts POST) 이 예외 없이 `Admin+` 이다. README `86 행` 은 User 를 read-only 등급으로 정의한다. T-2031 ~ T-2036 의 모든 선행 slice 도 이 두 route 에 `adminCookie` · bootstrap SuperAdmin 자격을 골랐으므로 재작업이 0 이다.

issue-still-relevant pre-check (planner, 2026-10-27, `origin/main` = `f2dcf48d`):

- `src/user/group.controller.ts` 의 write 5 handler (`create` `158 행` `@Post()` · `addMember` `170 행` `@Post(":id/members")` · `update` `206 행` `@Patch(":id")` · `delete` `217 행` `@Delete(":id")` · `removeMember` `228 행` `@Delete(":id/members/:membershipId")`) 에는 `@UseGuards` · `@Roles` 가 **0** 이다. 머리 주석 `55~56 행` 도 "write 축 5 route 는 **아직 미배선**" 이라고 적고 있다. 따라서 의도가 main 에 아직 없고, 착수는 유효하다.
- census 실측값은 ⑤a 상태 그대로다. `30 행` `MIN.guarded` **73**, `KNOWN_GAP_REQ_043` **11** (`45~49 행` 에 groups write 5 항목), `119 행` `toBe(11)` · `120 행` `toBe(16)` 이다.
- **write 축 소비처 전수 재실측** (T-2037 `## Follow-ups` 가 요구한 선행 조건): `test/e2e/groups.e2e-spec.ts` 의 write 10 지점과 `test/smoke/groups.smoke-spec.ts` 의 write 7 지점이 모두 `adminCookie` 를 선탑재했다 (17 건 전부 `admin`). perf 6 spec 은 write 를 HTTP 로 부르지 않는다 (realdb 2 spec 의 `prisma.*.delete` 는 직접 DB 정리). k6 s2 의 groups seed POST · teardown DELETE 는 T-2038 이 SuperAdmin 자격으로 올렸다. web 은 T-2032 · T-2033 이 인증 cookie 계약을 닫았다. 따라서 판정이 뒤집히는 곳은 **census 한 곳과 unit spec 의 (a) 대조군** 뿐이다.
- 본 slice 를 금지하는 owner commit 은 없다. PLAN `158 행` 이 금지하는 것은 per-route perf baseline 신설이라 저촉되지 않는다.

## Required Reading

- `docs/STATE.json` 의 `humanQuestions` Q-0056 `decision` — 오너 승인 원문과 조건
- **선례 (그대로 따른다)**: [docs/tasks/T-2029-persons-write-tier-guard-wiring.md](T-2029-persons-write-tier-guard-wiring.md) 와 그 머지 commit `19241c5f` (PR #1590, 실측 4 파일 +175/-29). 기존 describe 를 확장하고 (a) 대조군을 tier 대조군으로 교체한 방식을 따른다.
- [src/user/group.controller.ts](../../src/user/group.controller.ts) — `50~60 행` (머리 주석 "RBAC 배선 현황" 블록과 "책임 경계" 블록. "아직 미배선" · "⑤b 책임" 서술이 갱신 대상), `106~111 행` (read 축 배선 선례: 주석 2 줄 + decorator 2 줄), `155~236 행` (write 5 handler 와 기존 주석. `201 행` "AuthGuard 적용 안 함" 서술도 갱신 대상). import 블록 (`77 행` `UseGuards` · `83 행` `JwtAuthGuard`) 은 이미 들어 있다.
- [src/user/group.controller.spec.ts](../../src/user/group.controller.spec.ts) — `930 행~` `describe("GroupController (RBAC guard 배선 — T-2037 read)")` 의 harness (`reflector` · `guardsOf` · `rolesOf` · `buildApp` · 거부 guard stub), `944 행` `READ_ROUTES` 표, `962~968 행` `WRITE_ROUTES` 표 (지금은 handler 이름만 있다. path · method · service mock 열을 늘려 쓴다), `1024~1077 행` (error path · 분기 국면), `1079~1118 행` (negative (a)~(d). **(a) `1080~1086 행` 은 "write 축에 metadata 없음" 단언이라 본 slice 로 반드시 뒤집힌다**).
- [src/user/person.controller.spec.ts](../../src/user/person.controller.spec.ts) — T-2029 가 같은 describe 안에 write 축을 넣은 형태 (`WRITE_ROUTES` · `DENIALS` 재사용 · `User` 403 분기 · tier 대조군)
- [test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts](../../test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts) — `30 행` `MIN`, `41~58 행` `KNOWN_GAP_REQ_043` 와 블록 주석, `119~120 행` 건수 고정
- [test/smoke/groups.smoke-spec.ts](../../test/smoke/groups.smoke-spec.ts) `34~35 행` — "guard 는 아직 미배선이라 단언은 무변경" 주석이 본 slice 로 stale 이 된다 (주석만 갱신)
- [docs/architecture/api.md](../architecture/api.md) `90~92 행` (POST · PATCH · DELETE `/api/groups` → Admin+) — 권한 등급 정본 (**수정 금지**, doc-sync 는 arc 완결 뒤)

## Acceptance Criteria

**배선 (production)**

- [ ] `group.controller.ts` 의 write 5 handler (`create` · `addMember` · `update` · `delete` · `removeMember`) 에 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` 를 부착한다. read 축 형태 (주석 1~2 줄 + decorator 2 줄) 와 같게 하고, `@HttpCode` 등 기존 decorator 순서는 보존한다. import 추가 0 · **새 dependency 0 · 새 guard class 0** · `ROLE_HIERARCHY` 변경 0.
- [ ] read 4 route 의 `@Roles("User")` 는 **무변경** 이고, 클래스 레벨 `@UseGuards` · `@Roles` 부착은 여전히 **0** 이다.
- [ ] 머리 주석 갱신: "RBAC 배선 현황 (T-2037 — Q-0056 ⑤a, read 축만)" 블록을 현재 상태로 바로잡는다. write 5 route 는 Admin+ 게이트 완료 (T-2039, 근거 api.md `90~92 행` + tier 행 누락 2 route 의 관례 판정 = 본 task `## Why`) 이고, 남은 조각은 e2e 인가 단언 (⑤c) 뿐이라고 2~4 줄로 적는다. "책임 경계" 블록의 "write 축 5 route 의 Admin+ guard — ⑤b 책임" 줄과 `201 행` 의 "AuthGuard 적용 안 함" 서술도 고친다. `git grep -n "아직 미배선\|AuthGuard 적용 안 함" src/user/group.controller.ts` 가 0 hit 이다.

**spec — R-112 (1)~(4) + regression**

- [ ] 새 describe 를 만들지 않고 기존 `describe("GroupController (RBAC guard 배선 — T-2037 read)")` 를 확장한다 (제목은 `T-2037 read / T-2039 write` 취지로 갱신). `WRITE_ROUTES` 표를 `READ_ROUTES` 와 같은 열 구성 (label · handler · 실제 path · method · service mock 이름) 으로 넓히고 **harness 를 재사용한다** (중복 정의 금지).
- [ ] **happy-path (route 당 1+)**: `it.each(WRITE_ROUTES)` 로 5 route 각각의 guard 목록이 `[JwtAuthGuard, RolesGuard]` 이고 `@Roles` 값이 `["Admin"]` 인지 `Reflector` 로 단언한다.
- [ ] **error path 1+**: guard 가 거부하는 두 형태 (`canActivate=false` → 403, `UnauthorizedException` throw → 401) 각각에서 write 5 route 를 호출하면 해당 `GroupService` mock (create · addMember · update · delete · removeMember — 실명은 spec 에서 확인) 의 call count 가 **0** 이다. 기존 거부 표를 재사용한다.
- [ ] **분기별 test**: `@Roles("Admin")` 가 소비하는 role 등급 축을 분기마다 1+ 로 단언한다. `Admin` · `SuperAdmin` 은 통과한다 (escalation). **`User` 등급은 403 이고 service 는 호출되지 않는다**. role 미부여 · 미인증도 통과하지 못한다. production 에 새 분기가 없다는 사실 (decorator 부착뿐) 은 spec 주석 1 줄로 남긴다.
- [ ] **예외 분기별 negative (각 1+)**: (a) 기존 `1080~1086 행` 의 "(a) write 축에는 metadata 가 없다" 단언을 **제거하고 tier 대조군으로 교체** 한다. read 축은 정확히 `["User"]`, write 축은 정확히 `["Admin"]` 이며, 서로 바뀌면 (read 가 Admin 으로 좁혀지거나 write 가 User 로 느슨해지면) red 다. (b) write 축 `@Roles` 가 `"User"` 또는 `"SuperAdmin"` 이면 red 가 되는 정확 등가 단언 (tier 오설정 탐지). (c) 클래스 레벨 `@UseGuards` · `@Roles` 부착 0 단언은 **유지** 한다. (d) write 축 guard 목록에 `RolesGuard` 가 있고 길이가 2 다 (빠지면 인증만 하고 인가를 빼먹은 형태로 red).
- [ ] **regression (`hqOrigin` Q-0056)**: 위 happy (5 route guard + `Admin` tier) 와 census 갱신이 regression 가드 역할을 한다. 누가 write 축 decorator 를 되돌리면 unit spec 과 census smoke 가 함께 red 가 된다. PR body 에 route · handler · tier 표 (tier 행 누락 2 route 표시 포함) 를 적는다.

**census 판정면 · 주석 정합**

- [ ] `route-auth-guard-coverage-census-drift.smoke-spec.ts` 를 실측에 맞춘다. `KNOWN_GAP_REQ_043` 에서 groups write 5 항목을 제거한다 (11 → 6). 건수 고정은 `toBe(11)` → `6`, `toBe(16)` → `11` 으로, `MIN.guarded` 는 `73` → `78` 로 바꾼다. groups 블록 주석은 "groups 9 route 전량 배선 완료 (⑤a read T-2037 / ⑤b write T-2039)" 로, 목록 끝 주석은 "남은 6 항목은 parts 축" 취지로 고친다. `PUBLIC_BY_DESIGN` 5 항목 · 교집합 0 · `MIN.controllers` · `MIN.routes` · `APP_GUARD` 0 단언은 **무변경** 이다.
- [ ] `test/smoke/groups.smoke-spec.ts` `34~35 행` 주석을 "read · write 전 축 guard 배선 완료 (T-2037 · T-2039). 기존 요청이 이미 tier cookie 를 선탑재해서 단언은 무변경" 취지로 바로잡는다 (**주석만** 고친다. `it` · `expect` · 요청 체인 변경 0).

**실행 검증**

- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `pnpm test:smoke` 통과 (특히 census drift 와 `groups.smoke-spec.ts`). `pnpm test:e2e` 통과 (`groups.e2e-spec.ts` 가 `adminCookie` 선탑재 덕에 **무수정** 으로 통과). 로컬 DB 가 없으면 PR head CI run 으로 확인하고 그 사실을 PR body 에 적는다.
- [ ] `git diff --stat` 이 `touchesFiles` 4 파일 이내이고 diff ≤ 300 LOC 다. 넘칠 것 같으면 분기 단언을 `it.each` 표로 먼저 압축한다. 그래도 넘으면 중단하고 실측 수치를 `## Follow-ups` 에 적는다 (cap 우회 금지).

## Out of Scope

- ⑤c e2e 무 cookie 401 (9 route) · User cookie mutation 403 (5 route) 단언 신설과 실 `RolesGuard` instance escalation describe. `test/e2e/groups.e2e-spec.ts` `22~23 행` 의 stale "guard 는 아직 미배선" 주석도 ⑤c 가 같은 파일을 고칠 때 함께 정리한다.
- perf 6 spec 의 "guard 미부착 · cookie 는 no-op" 주석 정리, `test/perf/README.md` · `docs/ops/load-resilience-test-plan.md` doc-sync.
- `test/load/*.js` · `.github/workflows/load-k6.yml` · web 변경, `test/helpers/` 수정.
- parts 축 전체 (6 route).
- 새 guard class · 새 role 등급 · `APP_GUARD` 전역 배선 · `ROLE_HIERARCHY` 변경 · `package.json` 변경.
- `docs/architecture/api.md` tier 행 2 개 추가 · `docs/requirements.md` REQ-043 · 045 · 073 재판정. CLAUDE.md §3.1 에 따라 3 controller arc 가 머지된 뒤 REQ 당 1 회 처리한다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (planner, arc 계획 — Q-0056 groups 축 마지막 조각) **⑤c e2e 인가 단언**: `test/e2e/groups.e2e-spec.ts` 1 파일에 무 cookie 401 (9 route) · User cookie mutation 403 (5 route) 단언을 신설하고 실 `RolesGuard` instance escalation 축을 더한다 ([T-2030](T-2030-persons-e2e-authz-assertions.md) 동형). 본 slice 머지 후 큐잉한다. 그다음은 parts 축 (6 route) 이다.
- (planner 판정, CLAUDE.md §3 소비처 동반 의무) helper · factory 신설이 없다. 기존 guard 2 개를 route 5 개에 배선하는 소비처 그 자체이고, 배선으로 깨지는 판정면 (census · unit (a) 대조군) 을 같은 PR 에서 닫는다 → 하한 충족.
- (planner 판정, cap) 선례 실측: T-2029 (write 3 route, harness 재사용) 4 파일 +175/-29, T-2037 (read 4 route, harness 신설) 3 파일 +277/-15. 본 slice 는 T-2037 harness 를 재사용하고 route 가 5 개라 spec 표 행이 2 개 늘어난다. 추정은 base 약 230 LOC (controller decorator + 주석 ~45 · spec ~155 · census ~20 · smoke 주석 ~4) · 4 파일로 cap 안이다. 같은 형태의 실측 선례가 직접 있으므로 R-112 backbone multiplier × 1.5 는 적용하지 않았다 (T-2037 판정과 같다). `sizeExempt` 는 필요 없다.
