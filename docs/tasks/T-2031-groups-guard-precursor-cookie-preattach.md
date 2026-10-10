---
id: T-2031
title: groups guard 배선 선행 1 — 무-cookie backend 소비처 2 spec (groups e2e · smoke) 에 인증 cookie 선탑재
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-043, REQ-045, REQ-046, REQ-073]
estimatedDiff: 190
estimatedFiles: 2
created: 2026-10-10
independentStream: q0056-groups-guard
dependsOn: [T-2030]
touchesFiles: [test/e2e/groups.e2e-spec.ts, test/smoke/groups.smoke-spec.ts]
hqOrigin: Q-0056
plannerNote: P5 · Q-0056 ① groups 축 선행 1 — guard 배선 시 깨질 무-cookie AppModule 부트 2 spec cookie 선탑재, production 0 LOC
---

# T-2031 — groups guard 배선 선행 1: 무-cookie backend 소비처 2 spec 에 인증 cookie 선탑재

## Why

[PLAN.md](../PLAN.md) `157 행` 오너 최우선 지시 아래 진행하는 Q-0056 arc 의 **두 번째 controller (groups 9 route)** 첫 조각이다. 오너 결정은 `STATE.humanQuestions` Q-0056 `decision` 의 옵션 ① (persons → groups → parts 순서, 기존 `JwtAuthGuard` · `RolesGuard` · `@Roles` 재사용, 새 dependency 0) 이고, persons 축은 [T-2030](T-2030-persons-e2e-authz-assertions.md) 머지 (`0917bb26`) 로 ④a~④c 가 끝났다. 그 `## Follow-ups` 첫 항목 ② 가 "groups 9 route arc — persons 와 같은 분할 (소비처 cookie 선탑재 → read tier → write tier → e2e)" 을 다음 순서로 지정한다 (README `83` · `85` · `86 행`).

persons 축과 같은 이유로 guard 배선을 한 PR 에 담을 수 없다. guard 를 붙이는 순간 cookie 없이 `/api/groups` 를 부르는 CI 소비처가 전부 401 로 깨지는데, 그 소비처가 5 파일 cap 을 넘는다. 그래서 **guard 가 아직 없는 route 에 cookie 를 먼저 싣는 선행 slice** 로 나눈다. cookie 를 실어도 지금 동작은 바뀌지 않으므로 선행 slice 는 각자 green 으로 머지된다. 이 분할은 auth 동작을 바꾸지 않는 test 재배치라 오너 승인 범위를 벗어나지 않는다 (추가 HQ 불요, [T-2020](T-2020-persons-guard-precursor-cookie-preattach.md) 선례).

issue-still-relevant pre-check (planner, 2026-10-10, `origin/main` = `9b13120b`):

- `src/user/group.controller.ts` 에 `UseGuards` · `@Roles` **0 hit** (route 9 개: `92` · `99` · `108` · `120` · `128` · `140` · `176` · `187` · `198 행`) → guard 미배선, arc 유효.
- `/api/groups` 를 부르는 CI 실행 소비처 실측 — `git grep -l "api/groups" -- test`:
  - e2e `test/e2e/groups.e2e-spec.ts` (test 15 · supertest 호출 16 · `.set("Cookie"` **0**, `createE2EApp` 부트)
  - smoke `test/smoke/groups.smoke-spec.ts` (test 11 · supertest 호출 11 · `.set("Cookie"` **0**, `AppModule` 직접 부트)
  - perf 6 spec `test/perf/group-*.perf-spec.ts` (mock 부트 3 · realdb 3, cookie 0)
  - k6 `test/load/s2-read.js` (groups 참조 3 곳) + `test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts` (`440` · `741 행`)
  - 다른 e2e · smoke spec 에서 `/api/groups` 를 부르는 곳은 0 (drift smoke 2 개는 문자열 표만 보유).
- 합계 backend 소비처 10 파일 → 한 PR 불가. 본 slice 는 그중 **AppModule 로 부팅하는 2 spec** 만 가져간다.
- 최근 owner commit (PLAN `157` · `158` · `182` · `183 행`) 중 본 slice 를 금지하는 것은 없다. `158 행` 은 per-route perf baseline **신설** 금지이고 본 slice 는 `test/perf/` 를 건드리지 않는다.
- `STATE.backlogNoteT1866` 은 해소된 메모다 — T-1866 `status: SUPERSEDED`, 후속 T-1867 · T-1868 `DONE`. 큐잉 대상 아님.

web cookie 전송 계약 test (오너 조건) 를 본 slice 에 넣지 않는 근거 (CLAUDE.md §3 cap 수치): 2 spec 선탑재가 ~190 LOC (T-2020 실측 — 호출 25 곳 + web test 151 줄이 첫 diff 486 LOC, 압축 후 +255/-44) 이고, groups 의 web 발사 지점은 persons (4 곳, 1 hook) 보다 많은 7 곳 · 3 모듈 (`AdminView` 목록 GET · 그룹 생성 · 수정 · 삭제, `useAdminMemberships` 멤버 GET · 추가 · 제거) 이라 web test 가 ~180 LOC 로 추정된다. 합 ~370 LOC > 300 → 분리하고 `## Follow-ups` 에 예약한다.

## Required Reading

- `docs/STATE.json` 의 `humanQuestions` Q-0056 `decision` (오너 승인 원문 · 조건)
- [docs/architecture/api.md](../architecture/api.md) `89~93 행` — groups tier (GET = `User+`, POST · PATCH · DELETE = `Admin+`)
- [src/user/group.controller.ts](../../src/user/group.controller.ts) `79~200 행` — 9 route 의 method · path (수정 금지, 읽기만)
- [test/helpers/auth-e2e-helper.ts](../../test/helpers/auth-e2e-helper.ts) `106 행` `buildAuthCookie` · `132 행` `createAuthenticatedE2EApp` · `182 행` `reseedAuthenticatedActors`
- harness 선례 (그대로 따른다): [test/e2e/persons.e2e-spec.ts](../../test/e2e/persons.e2e-spec.ts) `44~136 행`, [test/smoke/persons.smoke-spec.ts](../../test/smoke/persons.smoke-spec.ts) `32~86 행`
- 변경 대상: [test/e2e/groups.e2e-spec.ts](../../test/e2e/groups.e2e-spec.ts) `20~60 행` (harness) + 호출 16 곳, [test/smoke/groups.smoke-spec.ts](../../test/smoke/groups.smoke-spec.ts) `32~68 행` (harness) + 호출 11 곳

## Acceptance Criteria

**cookie 선탑재 (2 spec)**

- [ ] `test/e2e/groups.e2e-spec.ts` 의 harness 를 `createE2EApp` 에서 `createAuthenticatedE2EApp` (Admin 1 · User 1) 로 바꾼다. `afterEach` 는 `truncateAll` → `reseedAuthenticatedActors` 순서로 둔다 (truncate 가 `User` 까지 비우므로 actor 를 원본 id 로 재삽입).
- [ ] `test/smoke/groups.smoke-spec.ts` 도 같은 harness 로 바꾼다. 인증 actor 는 `test/helpers/auth-e2e-helper.ts` 만 재사용하고 **새 helper 는 만들지 않는다**.
- [ ] 두 파일의 `/api/groups` supertest 호출 전부 (실행 시점 재실측, planner 실측 16 + 11) 에 `.set("Cookie", …)` 를 붙인다. cookie 선택 규칙: **GET 은 `userCookie`, POST · PATCH · DELETE 는 `adminCookie`** (api.md `89~93 행` tier 와 그 표의 read = `User+` / write = `Admin+` 관례). api.md 표에 행이 없는 4 route (`GET :id` · `GET :id/persons` · `POST :id/members` · `DELETE :id/members/:membershipId`) 도 같은 규칙을 적용한다.
- [ ] 기계 검증 (regression 가드, `hqOrigin` 있음): 파일별로 `/api/groups` 대상 supertest 호출 수와 그 호출 체인의 `.set("Cookie"` 수가 같다. 실행 시점에 다시 세어 PR body 에 표로 적는다. cookie 없는 호출이 남으면 사유를 해당 줄 주석으로 단다 (기대값 0 건).
- [ ] 동작 무변경: 기존 test 26 개 (e2e 15 · smoke 11) 의 status · body · DB state 단언을 바꾸지 않고 test 수도 같다. `git diff --stat origin/main -- src prisma web` 가 비어 있다.
- [ ] 파일 상단 주석에 "인증 cookie 선탑재 (T-2031, Q-0056 ① groups guard 배선 선행)" 취지 한 단락을 추가한다 (persons spec 주석과 같은 형태).

**R-110 / R-112**

- [ ] R-112 (1)~(4) 적용 판정: 본 slice 는 **신규 · 수정 public symbol 0, production 분기 0** 인 test harness 전환이다. happy-path 는 기존 26 test 가 cookie 를 실은 채 그대로 통과하는 것으로 충족한다. error path · negative (무 cookie 401 · User cookie mutation 403) 는 guard 가 아직 없어 **지금은 단언할 수 없다** — groups 축 마지막 e2e slice 몫이므로 본 slice 에서는 생략하고 신규 401 · 403 단언을 넣지 않는다.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). production 변경 0 이라 수치 불변.
- [ ] `pnpm test:smoke` · `pnpm test:e2e` 통과 (CI leg 기준 — 로컬 DB 가 없으면 PR head run 으로 확인하고 그 사실을 PR body 에 적는다).
- [ ] `git diff --stat` 이 `touchesFiles` 2 파일 이내이고 diff ≤ 300 LOC 다. prettier 재정렬로 300 을 넘길 것 같으면 주석 증분을 줄여 맞춘다 (T-2020 선례).

## Out of Scope

- `src/user/group.controller.ts` guard 실배선, `group.controller.spec.ts`, e2e 401 · 403 신규 단언, census `KNOWN_GAP_REQ_043` 15 → 6 축소 · `MIN.guarded` 상향 — groups 축 뒤쪽 slice 몫.
- perf 6 spec (`test/perf/group-*.perf-spec.ts`), k6 `test/load/s2-read.js`, `load-workflow-k6-harness-wiring-drift.smoke-spec.ts` 의 cookie 대응 — 후속 선행 slice 몫.
- web cookie 전송 계약 test — 후속 slice (아래 Follow-ups).
- parts 소비처, 새 dependency, `test/helpers/` 신규 helper · 기존 helper 수정.
- `docs/requirements.md` REQ-043 · 045 · 046 · 073 status 재판정, api.md · perf README doc-sync — CLAUDE.md §3.1 에 따라 **3 controller arc 가 모두 머지된 뒤 REQ 당 1 회** 만 한다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (planner, arc 계획 — Q-0056 groups 축 잔여) 순서대로 큐잉한다. 각 slice 착수 전에 소비처를 다시 실측한다.
  - ② **web cookie 전송 계약 test** (오너 조건, `pr`, web test 1 파일): `apiClient` 를 mock 하지 않고 전역 `fetch` 만 stub 해 groups 7 발사 (`web/src/views/AdminView.tsx` `514 행` 목록 GET · 그룹 생성 · 수정 · 삭제, `web/src/views/useAdminMemberships.ts` `80 행` 멤버 GET · 추가 · 제거) 의 `credentials: 'same-origin'` 을 단언. 선례 `web/src/views/useAdminPersons.auth-cookie.test.ts`. 본 slice 와 파일-disjoint 라 순서 무관.
  - ③ **perf 선행**: mock 부트 3 spec (`group-read` · `group-detail-read` · `group-persons-read`) guard override + realdb 3 spec (`group-read-realdb` · `group-members-read-realdb` · `group-persons-scale-realdb`) cookie 선탑재 — 6 파일이라 3 + 3 으로 나눈다 (T-2021 · T-2022 선례).
  - ④ **k6 선행**: `test/load/s2-read.js` groups 3 지점 cookie + drift smoke `440 행` 전제 갱신 (T-2023 선례, 착수 전 drift smoke 짝 개수 재확인).
  - ⑤ **guard 실배선** read 4 route → write 5 route → e2e 401 · 403 (T-2027 · T-2029 · T-2030 선례).
- (planner, 미결 — ⑤ 착수 전 확정 필요) api.md `89~93 행` 표에는 groups 9 route 중 **5 행만** 있다. `GET /api/groups/:id` · `GET /api/groups/:id/persons` · `POST /api/groups/:id/members` · `DELETE /api/groups/:id/members/:membershipId` 4 route 의 tier 행이 없다. 오너 결정문은 "권한 등급은 api.md 표를 따른다" 이므로, ⑤ 의 planner 는 표의 read = `User+` / write = `Admin+` 관례로 확정 가능한지 판단하고, 불가하면 `humanQuestion` 으로 올린다. 본 slice 의 cookie 선택은 그 관례를 따랐으므로 관례대로 확정되면 재작업 0 이다.
- (planner 판정, CLAUDE.md §3 소비처 동반 의무) 본 slice 는 helper · factory 신설이 없다 — 기존 `auth-e2e-helper` 를 소비하는 spec 2 파일이다 → 하한 해당 없음.
- (planner 판정, cap) base 190 LOC (e2e harness ~35 + 호출 16 × ~3 · smoke harness ~40 + 호출 11 × ~3 · 주석 ~15), test harness 전환이라 multiplier × 1.0. T-2020 이 추정 210 → 첫 diff 486 이었던 점을 반영해 web test 를 분리했다. `estimatedFiles` 2 → cap 안, `sizeExempt` 불요.
