---
id: T-2034
title: groups guard 배선 선행 4 — mock 부트 perf 3 spec 에 guard override 선탑재
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-043, REQ-045, REQ-048, REQ-073]
estimatedDiff: 130
estimatedFiles: 3
created: 2026-10-17
independentStream: q0056-groups-guard
dependsOn: [T-2033]
touchesFiles: [test/perf/group-read.perf-spec.ts, test/perf/group-detail-read.perf-spec.ts, test/perf/group-persons-read.perf-spec.ts]
hqOrigin: Q-0056
plannerNote: P5 · Q-0056 ① groups 축 선행 4 — Follow-up ③ 앞 절반, mock 부트 perf 3 spec overrideGuard 선탑재 (T-2021 동형)
---

# T-2034 — groups guard 배선 선행 4: mock 부트 perf 3 spec 에 guard override 선탑재

## Why

[PLAN.md](../PLAN.md) `157 행` 오너 최우선 지시 아래 진행하는 Q-0056 arc 의 groups 축 네 번째 조각이다. 오너 결정은 `STATE.humanQuestions` Q-0056 `decision` 의 옵션 ① (persons → groups → parts 순서, 기존 `JwtAuthGuard` · `RolesGuard` · `@Roles` 재사용, 새 dependency 0) 이다. groups 축은 [T-2031](T-2031-groups-guard-precursor-cookie-preattach.md) (e2e · smoke cookie 선탑재) → [T-2032](T-2032-groups-memberships-web-auth-cookie-contract.md) · [T-2033](T-2033-adminview-groups-web-auth-cookie-contract.md) (web cookie 계약 test) 까지 머지됐고, T-2031 `## Follow-ups` ③ 이 다음 순서로 **perf 선행 (mock 부트 3 spec guard override → realdb 3 spec cookie 선탑재, 3 + 3 분할)** 을 지정한다. 본 task 는 ③ 의 앞 절반이며 persons 축 [T-2021](T-2021-perf-mock-boot-guard-override-prep.md) 과 같은 구조다.

세 spec 은 `AppModule` 이 아니라 `Test.createTestingModule({ controllers: [GroupController], providers: [{ provide: GroupService, useValue: … }] })` 로 controller 1 개만 띄운다. 이 상태에서 ⑤ 가 `GroupController` 에 guard 를 붙이면 `JwtAuthGuard` · `RolesGuard` 가 요구하는 provider 가 test module 에 없어 **DI 실패 또는 전 요청 401** 로 세 spec 이 한꺼번에 red 가 된다. guard 가 없는 지금 `overrideGuard` 를 먼저 달면 동작은 no-op 이라 본 slice 는 단독으로 green 머지되고, ⑤ 시점의 perf red 요인 3 개가 미리 제거된다. 기존 spec 수정이라 PLAN `158 행` (신규 per-route perf baseline 금지) 과 충돌하지 않는다.

issue-still-relevant pre-check (planner, 2026-10-17, `origin/main` = `5af775d3`):

- `src/user/group.controller.ts` 에 `UseGuards` · `@Roles` **0 hit** → guard 미배선, arc 유효.
- 세 spec 에 `overrideGuard` 호출 **0 hit**. 대신 "guard 미적용 — overrideGuard 없이 순수 부트스트랩" 주석이 각 파일 본문 (`group-read` `71 행` · `group-detail-read` `77 행` · `group-persons-read` `86 행`) 과 헤더 (`group-read` `15~25 행` · `group-detail-read` `21~34 행` · `group-persons-read` `24~38 행`), 결정론 전략 절 (`54` · `62` · `72 행` 부근) 에 남아 있다.
- 세 파일의 마지막 변경은 신설 commit (`3b247550` T-0834 · `71270779` T-0845 · `e0cd0900` T-0854) 뿐이다. T-2033 이후 main commit 은 bookkeeping 1 건 (`5af775d3`) 이고 본 slice 를 금지하는 owner 지시는 없다.

## Required Reading

- `docs/STATE.json` 의 `humanQuestions` Q-0056 `decision` (오너 승인 원문 · 조건)
- [docs/tasks/T-2031-groups-guard-precursor-cookie-preattach.md](T-2031-groups-guard-precursor-cookie-preattach.md) `## Follow-ups` — groups 축 잔여 ③~⑤ 순서
- 선례 (그대로 따른다): [test/perf/person-read.perf-spec.ts](../../test/perf/person-read.perf-spec.ts) `13~29 행` (헤더 주석 표현), `58~59 행` (guard import 경로), `98 행` (`passGuard` 상수), `110~120 행` (`overrideGuard` 부트 블록) — T-2021 머지 결과물
- 변경 대상:
  - [test/perf/group-read.perf-spec.ts](../../test/perf/group-read.perf-spec.ts) `13~30 행` (헤더), `38~50 행` (import), `52~56 행` (결정론 전략 주석), `66~78 행` (`beforeAll` 부트)
  - [test/perf/group-detail-read.perf-spec.ts](../../test/perf/group-detail-read.perf-spec.ts) `19~36 행`, `46~58 행`, `60~64 행`, `72~84 행`
  - [test/perf/group-persons-read.perf-spec.ts](../../test/perf/group-persons-read.perf-spec.ts) `22~40 행`, `55~67 행`, `70~73 행`, `81~93 행`
- [src/auth/jwt-auth.guard.ts](../../src/auth/jwt-auth.guard.ts), [src/auth/roles.guard.ts](../../src/auth/roles.guard.ts) — override 대상 class 식별자
- [src/user/group.controller.ts](../../src/user/group.controller.ts) — guard 가 아직 없음을 재확인 (**수정 금지**, 읽기만)
- [test/perf/jest-perf.json](../../test/perf/jest-perf.json) — 세 spec 은 `pnpm test:perf` 로만 실행된다

## Acceptance Criteria

**override 선탑재 (3 spec)**

- [ ] 세 파일 각각의 `Test.createTestingModule({…})` 체인에 `.overrideGuard(JwtAuthGuard).useValue(passGuard).overrideGuard(RolesGuard).useValue(passGuard)` 를 붙인다. `passGuard` 는 `{ canActivate: () => true }` 로 `person-read.perf-spec.ts` `98 행` 과 같은 형태로 선언하고, import 경로도 같은 파일 `58~59 행` 을 따른다.
- [ ] 세 파일의 "guard 미적용 — overrideGuard 없이 순수 부트스트랩" · "적용해도 no-op" · "`overrideGuard` 불요" 서술 (본문 · 헤더 · 결정론 전략 절) 을 갱신한다. 새 서술은 "guard 배선 선행 (T-2034, Q-0056 ① groups 축) — ⑤ 에서 `GroupController` 에 guard 가 붙어도 controller 1 개만 띄우는 이 mock 부트가 DI 실패나 전 요청 401 로 깨지지 않도록 `overrideGuard` 를 선탑재한다. 현재는 no-op" 취지를 담는다 (`person-read.perf-spec.ts` `14~19 행` · `27~29 행` 표현 준용). 결정론 전략 절의 "인증/인가 분기 노이즈가 없다" 류 서술은 "override 로 인증/인가 layer 를 벗긴다" 로 바꾼다.
- [ ] 옛 서술 잔존 0: `git grep -n "overrideGuard 없이\|overrideGuard\` 불요\|guard 미적용" -- test/perf/group-read.perf-spec.ts test/perf/group-detail-read.perf-spec.ts test/perf/group-persons-read.perf-spec.ts` 가 0 hit 다.

**동작 무변경 · R-112 판정**

- [ ] 동작 무변경: `git diff --stat origin/main -- src prisma web test/helpers` 가 비어 있다. 세 spec 의 `it` 개수 (6 · 6 · 7) · 제목 · 기존 단언 (`assertS2Threshold` · `toHaveBeenCalledTimes` · 200/404/500 분기) 은 그대로다.
- [ ] happy-path: `pnpm test:perf --testPathPattern "group-(read|detail-read|persons-read)\.perf-spec"` 가 통과하고, 세 spec 의 pass 수가 변경 전과 같다 (변경 전후 수치를 PR body 에 적는다). mock 부트라 실 DB 없이 로컬에서 실행 가능하다.
- [ ] error path: 기존 non-2xx 국면 (`group-read` 의 mock 예외 500 · `GET /:id` 404, `group-detail-read` 의 404 · 500, `group-persons-read` 의 404 · 500) 이 override 부착 뒤에도 같은 status 로 도달한다. guard override 가 error 분기를 삼키지 않음을 이 국면들이 보증한다.
- [ ] 분기: 신규 production 분기 0 (test-only slice). override 는 분기 없는 `canActivate: () => true` 상수라 추가 분기 test 대상이 없다 — 이 사실을 PR body 에 한 줄로 적는 것으로 충족한다.
- [ ] negative (예외 분기마다 1+, **기존 test 재사용** — 신규 test 추가 금지): ① mock service reject 국면이 여전히 500 으로 `failures` 에 잡힌다 (세 spec 각각). ② 존재하지 않는 id 조회가 여전히 404 로 분류된다 (세 spec 각각). ③ mixed 국면 `(c)` 의 부분 집계 (`failures===1` · `samplesMs===3`) 가 그대로다. ④ `iterations===1` 경계 국면 `(d)` 가 그대로 통과한다. ⑤ `group-read` 의 빈 배열 · `group-persons-read` 의 empty-list 200 국면이 여전히 `failures===0` 이다.
- [ ] regression (`hqOrigin` Q-0056): PR body 에 `overrideGuard` 호출 지점을 파일 · 행 단위 표로 적는다. 누가 override 를 제거하면 ⑤ guard 배선 시점에 세 spec 이 red 가 되므로, 표와 위 grep 단언이 regression 가드 역할을 한다. 추가로 로컬에서 `GroupController` class 에 `@UseGuards(JwtAuthGuard, RolesGuard)` 를 임시로 붙인 상태에서 세 spec 이 green 인지 1 회 확인하고 (커밋하지 않고 되돌림), 결과를 PR body 에 한 줄로 적는다.

**R-110**

- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — production 변경 0 이라 수치 불변. `.perf-spec.ts` 는 `pnpm test` 에 잡히지 않으므로 perf 확인은 위 `pnpm test:perf` 항목으로 대신한다.
- [ ] `git diff --stat` 이 `touchesFiles` 3 파일 이내이고 diff ≤ 300 LOC 다.

## Out of Scope

- `src/user/group.controller.ts` guard 실배선, `group.controller.spec.ts`, e2e 401 · 403 신규 단언, census `KNOWN_GAP_REQ_043` 축소 — groups 축 ⑤ 몫.
- realdb perf 3 spec (`group-read-realdb` · `group-members-read-realdb` · `group-persons-scale-realdb`) cookie 선탑재 — 본 task 바로 다음 slice (③ 뒤 절반) 몫.
- k6 `test/load/s2-read.js` groups 3 지점 · `load-workflow-k6-harness-wiring-drift.smoke-spec.ts` — ④ 몫.
- parts 축 perf spec (`part-*.perf-spec.ts`) — parts arc 몫.
- 임계값 (`DEFAULT_P95_MAX_MS`) · baseline 파일 · 신규 perf spec · 새 helper · 새 dependency.
- `docs/requirements.md` REQ status 재판정, api.md · perf README doc-sync — 3 controller arc 머지 후 REQ 당 1 회.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (planner, arc 계획 — Q-0056 groups 축 잔여) 정본은 [T-2031](T-2031-groups-guard-precursor-cookie-preattach.md) `## Follow-ups`. 본 task 머지 후 다음 slice 는 ③ 뒤 절반 — realdb perf 3 spec (`group-read-realdb` · `group-members-read-realdb` · `group-persons-scale-realdb`) cookie 선탑재 (harness 를 `createAuthenticatedE2EApp` 로 전환 + `afterEach` 에 `reseedAuthenticatedActors`, [T-2022](T-2022-persons-realdb-perf-cookie-preattach.md) 선례). 그 뒤 ④ k6 → ⑤ guard 실배선.
- (planner, 미결 — ⑤ 착수 전 확정 필요) api.md groups 표에 tier 행이 없는 4 route 문제는 T-2031 `## Follow-ups` 둘째 항목에 그대로 남아 있다.
- (planner 판정, CLAUDE.md §3 소비처 동반 의무) helper · factory 신설 없음 — 기존 spec 3 파일의 부트 블록 수정이다 → 하한 해당 없음.
- (planner 판정, cap) base 130 LOC (파일당 import 2 + `passGuard` 1 + override 4 + 주석 교체 ~25 줄 증감 × 3), test 부트 수정이라 multiplier × 1.0. `estimatedFiles` 3 → cap 안, `sizeExempt` 불요.
