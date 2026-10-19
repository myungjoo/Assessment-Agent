---
id: T-2035
title: groups guard 배선 선행 5 — realdb perf 3 spec 에 인증 cookie 선탑재
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-043, REQ-045, REQ-048, REQ-073]
estimatedDiff: 180
estimatedFiles: 3
created: 2026-10-19
independentStream: q0056-groups-guard
dependsOn: [T-2034]
touchesFiles:
  [
    test/perf/group-read-realdb.perf-spec.ts,
    test/perf/group-members-read-realdb.perf-spec.ts,
    test/perf/group-persons-scale-realdb.perf-spec.ts,
  ]
hqOrigin: Q-0056
plannerNote: P5 · Q-0056 ① groups 축 선행 5 — Follow-up ③ 뒤 절반, realdb perf 3 spec 인증 harness 전환 (T-2022 동형)
---

# T-2035 — groups guard 배선 선행 5: realdb perf 3 spec 에 인증 cookie 선탑재

## Why

[PLAN.md](../PLAN.md) `157 행` 오너 최우선 지시 아래 진행하는 Q-0056 arc 의 groups 축 다섯 번째 조각이다. 오너 결정은 `STATE.humanQuestions` Q-0056 `decision` 의 옵션 ① (persons → groups → parts 순서, 기존 `JwtAuthGuard` · `RolesGuard` · `@Roles` 재사용, 새 dependency 0) 이다. [T-2031](T-2031-groups-guard-precursor-cookie-preattach.md) `## Follow-ups` ③ 이 perf 선행을 "mock 부트 3 spec guard override → realdb 3 spec cookie 선탑재" 로 나눴고, 앞 절반은 [T-2034](T-2034-groups-perf-mock-boot-guard-override-prep.md) (`4a040e80`) 로 머지됐다. 본 task 는 ③ 의 **뒤 절반** 이며 persons 축 [T-2022](T-2022-persons-realdb-perf-cookie-preattach.md) 와 같은 구조다.

세 spec 은 `createE2EApp()` 로 `AppModule` 전체를 띄우고 cookie 없이 `GET /api/groups*` 를 부른다. ⑤ 가 `GroupController` 에 guard 를 붙이면 세 spec 의 모든 요청이 **401** 이 되어 `errorRate` 위반으로 한꺼번에 red 가 된다. guard 가 없는 지금 인증 harness 로 옮겨두면 cookie 는 무시되는 no-op 이므로 본 slice 는 단독으로 green 머지되고, ⑤ 시점의 perf red 요인 3 개가 미리 사라진다. 기존 spec 수정이라 PLAN `158 행` (per-route perf baseline 신설 금지) 과 충돌하지 않는다.

issue-still-relevant pre-check (planner, 2026-10-19, `origin/main` = `c5649a69`):

- `src/user/group.controller.ts` 에 `UseGuards` · `@Roles` **0 hit** → guard 미배선, arc 유효.
- 세 spec 에 `createAuthenticatedE2EApp` · `buildAuthCookie` · `reseedAuthenticatedActors` · `.set("Cookie"` **0 hit**. 셋 다 `createE2EApp` 를 import 한다 (`group-read-realdb` `36 행` · `group-members-read-realdb` `58 행` · `group-persons-scale-realdb` `31 행`).
- `request(app.getHttpServer())` 호출 지점 실측 **합계 10**: `group-read-realdb` 3 (`114` · `123` · `131 행`), `group-members-read-realdb` 6 (`165` · `176` · `382` · `495` · `500` · `510 행`), `group-persons-scale-realdb` 1 (`119 행`).
- 본문 안의 개별 `truncateAll(prisma)` 호출은 세 파일 모두 **0** 이다 (`beforeAll` · `afterEach` 의 2 지점뿐). T-2022 의 `person-list-scale-realdb` `232 행` 같은 추가 재-seed 지점이 없다.
- 세 파일의 마지막 변경은 신설 commit (`97198504` T-1502 · `a8bc1e28` T-1504 · `b1da3564` T-1534) 뿐이고, T-2034 이후 main commit 은 bookkeeping 1 건 (`c5649a69`) 이다. 본 slice 를 금지하는 owner 지시는 없다.

## Required Reading

- `docs/STATE.json` 의 `humanQuestions` Q-0056 `decision` (오너 승인 원문 · 조건)
- [docs/tasks/T-2031-groups-guard-precursor-cookie-preattach.md](T-2031-groups-guard-precursor-cookie-preattach.md) `## Follow-ups` — groups 축 잔여 ③~⑤ 순서
- **전환 선례 (그대로 따른다)**: [test/perf/person-read-realdb.perf-spec.ts](../../test/perf/person-read-realdb.perf-spec.ts) `46~52 행` (import), `112~125 행` (`beforeAll` — `createAuthenticatedE2EApp([{ role: "User" }])` · `buildAuthCookie` · `truncateAll` → `reseedAuthenticatedActors`), `132~141 행` (`afterEach` 재-seed), `175` · `186 행` (`.set("Cookie", cookie)`) — T-2022 머지 결과물
- [test/helpers/auth-e2e-helper.ts](../../test/helpers/auth-e2e-helper.ts) — `buildAuthCookie` · `createAuthenticatedE2EApp` · `reseedAuthenticatedActors` 시그니처와 afterEach 순서 전제 (수정 금지)
- 변경 대상:
  - [test/perf/group-read-realdb.perf-spec.ts](../../test/perf/group-read-realdb.perf-spec.ts) `11~13 행` (헤더 "guard 미부착이라 인증·인가 노이즈 0" 서술), `34~36 행` (import), `63~76 행` (`beforeAll` / `afterEach`), `114` · `123` · `131 행` (요청 3 지점)
  - [test/perf/group-members-read-realdb.perf-spec.ts](../../test/perf/group-members-read-realdb.perf-spec.ts) `33~36 행` (헤더 ④ "401 / 403 분기가 구조적으로 존재하지 않는다" 서술), `56~58 행` (import), `106~120 행` (`beforeAll` — "`createAuthenticatedE2EApp` 불요" 주석 · `afterEach`), 요청 6 지점 (위 pre-check 행 번호)
  - [test/perf/group-persons-scale-realdb.perf-spec.ts](../../test/perf/group-persons-scale-realdb.perf-spec.ts) `29~31 행` (import), `67~80 행` (`beforeAll` / `afterEach`), `119 행` (요청 1 지점)
- [src/user/group.controller.ts](../../src/user/group.controller.ts) — guard 가 아직 없음을 재확인 (**수정 금지**, 읽기만)
- [test/perf/jest-perf.json](../../test/perf/jest-perf.json) — 세 spec 은 `pnpm test:perf` 로만 실행되고 `pnpm test` 에는 잡히지 않는다

## Acceptance Criteria

**인증 harness 전환 (3 spec)**

- [ ] 세 파일 모두 `createE2EApp` import 를 `createAuthenticatedE2EApp` · `buildAuthCookie` · `reseedAuthenticatedActors` (`../helpers/auth-e2e-helper`) 로 바꾸고, `beforeAll` 을 `ctx = await createAuthenticatedE2EApp([{ role: "User" }])` → `app = ctx.app` → `prisma = ctx.prisma` → `cookie = buildAuthCookie(Object.values(ctx.tokens)[0])` → `truncateAll(prisma)` → `reseedAuthenticatedActors(ctx)` 순으로 전환한다 (`person-read-realdb.perf-spec.ts` `113~125 행` 과 같은 형태). 쓰지 않게 된 `PrismaService` · `createE2EApp` import 는 지운다 (lint 기준).
- [ ] 세 파일의 `afterEach` 에서 `truncateAll(prisma)` **직후** `reseedAuthenticatedActors(ctx)` 를 호출한다 (`truncateAll` 이 actor `User` row 를 지우면 JWT `sub` 매칭이 깨진다 — helper 의 afterEach 순서 전제).
- [ ] 세 파일의 모든 `request(app.getHttpServer())` 요청 (합계 10 지점: read-realdb 3 · members-read-realdb 6 · persons-scale-realdb 1) 에 `.set("Cookie", cookie)` 를 붙인다. `git grep -c "request(app.getHttpServer())"` 와 `git grep -c '.set("Cookie", cookie)'` 의 파일별 수가 같다. `group-members-read-realdb` 의 path 변형 루프 (`495 행` `get(path)`) · `token` 루프 (`510 행`) 도 빠짐없이 싣는다.
- [ ] 옛 서술 갱신: `group-read-realdb` 헤더 `11~13 행` 의 "guard 미부착이라 인증·인가 노이즈 0 (`overrideGuard` 불요 서술이 실 DB 에서도 유효)", `group-members-read-realdb` `108~109 행` 의 "`createAuthenticatedE2EApp` 불요" 주석을 "guard 배선 선행 (T-2035, Q-0056 ① groups 축) — ⑤ 에서 `GroupController` 에 guard 가 붙어도 401 로 깨지지 않도록 인증 cookie 를 선탑재한다. 현재는 guard 미부착이라 cookie 는 no-op" 취지로 바꾼다. `group-members-read-realdb` 헤더 ④ (`33~36 행`) 는 "현재 guard 미부착이라 401 / 403 분기가 없고, 그 negative 는 ⑤ guard 실배선 이후 e2e 몫" 취지로 고친다 (본 spec 에 401 · 403 test 를 추가하지 않는다는 결론은 유지).
- [ ] 옛 서술 잔존 0: `git grep -n "createAuthenticatedE2EApp. 불요\|overrideGuard. 불요\|인증·인가 노이즈 0\|구조적으로 존재하지 않는다" -- test/perf/group-read-realdb.perf-spec.ts test/perf/group-members-read-realdb.perf-spec.ts test/perf/group-persons-scale-realdb.perf-spec.ts` 가 0 hit 다.

**동작 무변경 · R-112 판정**

- [ ] 동작 무변경: `git diff --stat origin/main -- src prisma web test/helpers` 가 비어 있다. 세 spec 의 `it` 개수 · 제목 · 기존 단언 (`assertS2Threshold` · `lastBody` 대조 · 200/404 분기 · 관찰 줄 축적) 은 그대로다.
- [ ] happy-path: `pnpm test:perf --testPathPattern "group-(read|members-read|persons-scale)-realdb"` 가 실 DB 환경에서 통과하고 pass 수가 변경 전과 같다 (변경 전후 수치를 PR body 에 적는다). 로컬에 DB 가 없어 실행이 불가하면 그 사실과 대체 검증 (아래 R-110 항목 + CI `test:perf` 결과) 을 PR body 에 명시한다.
- [ ] error path: 기존 non-2xx 국면 — `group-read-realdb` 의 미존재 id 404, `group-members-read-realdb` 의 미존재 group 404 (`382 행`) · path 변형 404 (`492~495 행`) · 비정상 token 국면 (`510 행`) — 이 cookie 부착 뒤에도 같은 status · 같은 판정으로 도달한다. cookie 가 에러 분기를 삼키지 않음을 이 국면들이 보증한다.
- [ ] 분기: 신규 production 분기 0 (test-only slice). cookie 는 상수 문자열이라 분기가 없다 — 이 사실을 PR body 에 한 줄로 적는 것으로 충족한다.
- [ ] negative (예외 분기마다 1+, **기존 test 재사용** — 신규 test 추가 금지): ① 미존재 id 조회가 여전히 404 로 분류된다 (read · members). ② path 변형 · 비정상 token 국면의 status 가 그대로다 (members). ③ 임계 주입 `p95MaxMs: 0` fail 국면 (`group-read-realdb` `274 행` (d) · `group-members-read-realdb` `520 행` (f) · `group-persons-scale-realdb` `273 행` (d)) 이 그대로 `pass===false` 로 판정된다. ④ `afterEach(truncateAll)` 뒤 seed 0 행 국면 (`group-read-realdb` `215 행` 분기 ① 빈 목록 200, `group-persons-scale-realdb` `213 행` row leak 0) 이 재-seed 이후에도 동일하다 — 재-seed 는 `User` row 만 되살리므로 Group · Person · membership 수 단언에 영향이 없어야 한다.
- [ ] regression (`hqOrigin` Q-0056): PR body 에 세 파일의 `createAuthenticatedE2EApp` · `reseedAuthenticatedActors` · `.set("Cookie", cookie)` 지점을 파일 · 행 단위 표로 적는다. 추가로 로컬 (DB 가 있으면) 에서 `GroupController` class 에 `@UseGuards(JwtAuthGuard, RolesGuard)` 와 `@Roles("User")` 를 임시로 붙인 상태에서 세 spec 이 green 인지 1 회 확인하고 (커밋하지 않고 되돌림), 결과 또는 실행 불가 사유를 PR body 에 한 줄로 적는다.

**R-110**

- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — production 변경 0 이라 수치 불변. `.perf-spec.ts` 는 `pnpm test` 에 잡히지 않으므로 perf 확인은 위 `pnpm test:perf` 항목과 CI 로 대신한다.
- [ ] `git diff --stat` 이 `touchesFiles` 3 파일 이내이고 diff ≤ 300 LOC 다.

## Out of Scope

- `src/user/group.controller.ts` guard 실배선, `group.controller.spec.ts`, e2e 401 · 403 신규 단언, census `KNOWN_GAP_REQ_043` 축소 — groups 축 ⑤ 몫.
- k6 `test/load/s2-read.js` groups 3 지점 · `load-workflow-k6-harness-wiring-drift.smoke-spec.ts` — ④ 몫.
- mock 부트 perf 3 spec (`group-read` · `group-detail-read` · `group-persons-read`) — T-2034 로 완료.
- parts 축 perf spec (`part-*`) · `group-measure-confirm` 류 다른 groups perf spec — 본 task 3 파일 외 수정 금지 (발견 시 `## Follow-ups` 에 적는다).
- 임계값 (`DEFAULT_P95_MAX_MS` · `p95MaxMs`) · baseline 파일 · 신규 perf spec · 새 helper · 새 test 국면 · 새 dependency.
- [test/perf/README.md](../../test/perf/README.md) · [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) 의 slice 2 · 3 · 18 서술 정정 — ⑤ 머지 후 doc-only direct slice 로 한 번에 (T-2022 Follow-ups 와 합침).
- `docs/requirements.md` REQ status 재판정, api.md doc-sync — 3 controller arc 머지 후 REQ 당 1 회.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (planner, arc 계획 — Q-0056 groups 축 잔여) 정본은 [T-2031](T-2031-groups-guard-precursor-cookie-preattach.md) `## Follow-ups`. 본 task 머지로 ③ 이 끝난다. 다음은 ④ k6 `s2-read.js` groups 3 지점 cookie 선탑재 (+ drift smoke 전제 갱신 — 착수 전 짝 개수를 다시 센다), 그 뒤 ⑤ guard 실배선.
- (planner, 미결 — ⑤ 착수 전 확정 필요) api.md groups 표에 tier 행이 없는 4 route 문제는 T-2031 `## Follow-ups` 둘째 항목에 그대로 남아 있다.
- (planner 판정, CLAUDE.md §3 소비처 동반 의무) helper · factory 신설 없음 — 기존 spec 3 파일의 부트 블록 · 요청 체인 수정이다 → 하한 해당 없음.
- (planner 판정, cap) base 180 LOC (파일당 import 3~4 · `beforeAll` 재작성 ~8 · `afterEach` +1 · 요청당 `.set` +1 줄 × 10 · 주석 교체 ~10~20 줄 증감 × 3), test 부트 수정이라 multiplier × 1.0 (T-2022 est 170 선례). `estimatedFiles` 3 → cap 안, `sizeExempt` 불요.
