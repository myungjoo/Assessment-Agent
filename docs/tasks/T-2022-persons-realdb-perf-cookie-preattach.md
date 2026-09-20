---
id: T-2022
title: persons guard 배선 선행 3 — realdb perf 3 spec 에 인증 cookie 선탑재
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-043, REQ-045, REQ-048, REQ-073]
estimatedDiff: 170
estimatedFiles: 3
created: 2026-09-20
independentStream: q0056-persons-guard
dependsOn: [T-2021]
touchesFiles:
  [
    test/perf/person-read-realdb.perf-spec.ts,
    test/perf/person-detail-read-realdb.perf-spec.ts,
    test/perf/person-list-scale-realdb.perf-spec.ts,
  ]
hqOrigin: Q-0056
plannerNote: P5 · Q-0056 ① persons 선행 3 — T-2020 Follow-up ② 후반, realdb perf 3 spec 을 인증 harness 로 전환
---

# T-2022 — persons guard 배선 선행 3: realdb perf 3 spec 에 인증 cookie 선탑재

## Why

오너가 HQ **Q-0056** 에서 옵션 ① 을 승인했다 (`docs/STATE.json` `humanQuestions` Q-0056 `decision`, 2026-09-14). `api/persons` → `api/groups` → `api/parts` 순으로 기존 `JwtAuthGuard` · `RolesGuard` · `@Roles` 를 배선한다. persons 축은 무-cookie 소비처가 많아 [T-2020](T-2020-persons-guard-precursor-cookie-preattach.md) `## Follow-ups` 가 ② perf 선행 → ③ k6 선행 → ④ guard 실배선 순서를 박제했다. 그 ② 중 mock 부트 2 spec 은 [T-2021](T-2021-perf-mock-boot-guard-override-prep.md) 로 머지됐고, 본 task 는 ② 의 **남은 절반 — realdb perf 3 spec** 이다.

**issue-still-relevant 확인** (origin/main `7720e1d0`): `src/user/person.controller.ts` 에 `UseGuards` · `@Roles` 는 여전히 0 hit 이고, 세 realdb spec 은 모두 `createE2EApp()` 로 부트해 cookie 없이 `GET /api/persons` 를 호출한다 (`person-read-realdb` `64` · `104 행`, `person-detail-read-realdb` `64` · `125 행`, `person-list-scale-realdb` `31` · `69 행`). ④ 가 controller 에 guard 를 붙이면 세 spec 의 모든 요청이 **401** 이 되어 `errorRate` 위반으로 한꺼번에 red 가 된다.

guard 가 없는 지금 인증 harness 로 먼저 옮겨두면 cookie 는 무시되는 no-op 이라 본 slice 는 단독 green 머지가 되고, ④ 시점의 perf red 요인 3 개가 미리 제거된다. 전환 형태는 [test/perf/assessment-read-realdb.perf-spec.ts](../../test/perf/assessment-read-realdb.perf-spec.ts) `57~80 행` 에 이미 박제돼 있어 새 개념 도입은 0 이다.

## Required Reading

- `docs/STATE.json` 의 `humanQuestions` Q-0056 `decision` — 오너 승인 원문 · 조건
- [docs/tasks/T-2020-persons-guard-precursor-cookie-preattach.md](T-2020-persons-guard-precursor-cookie-preattach.md) `## Follow-ups` — persons 축 잔여 slice ②~④ 순서와 executor 의 과소추정 실측 메모
- [docs/tasks/T-2021-perf-mock-boot-guard-override-prep.md](T-2021-perf-mock-boot-guard-override-prep.md) `## Why` — 본 slice 의 직전 절반 (mock 부트 2 spec)
- **전환 선례**: [test/perf/assessment-read-realdb.perf-spec.ts](../../test/perf/assessment-read-realdb.perf-spec.ts) `57~62 행` (import), `63~70 행` (`beforeAll` — `createAuthenticatedE2EApp([{ role: "User" }])` · `buildAuthCookie` · `truncateAll` → `reseedAuthenticatedActors`), `71~80 행` (`afterEach` 재-seed 주석)
- [test/helpers/auth-e2e-helper.ts](../../test/helpers/auth-e2e-helper.ts) `106 행` (`buildAuthCookie`), `132 행` (`createAuthenticatedE2EApp`), `165~200 행` (`reseedAuthenticatedActors` 와 afterEach 순서 전제)
- [test/perf/person-read-realdb.perf-spec.ts](../../test/perf/person-read-realdb.perf-spec.ts) `46~47 행` (import), `102~112 행` (`beforeAll`), `118~123 행` (`afterEach`), `156` · `165 행` (요청 2 지점), `329~345 행` (`registerCheckinBaselineWiringSuite` 주석의 "guard 미부착이라 cookie 없이 200" 서술)
- [test/perf/person-detail-read-realdb.perf-spec.ts](../../test/perf/person-detail-read-realdb.perf-spec.ts) `41 행` · `63~64 행`, `121~131 행` (`beforeAll` — "`createAuthenticatedE2EApp` 불요" 주석), `133~136 행` (`afterEach`), `175` · `182` · `392` · `427` · `487` · `492 행` (요청 6 지점)
- [test/perf/person-list-scale-realdb.perf-spec.ts](../../test/perf/person-list-scale-realdb.perf-spec.ts) `11~14 행` (헤더 ③ "guard 미부착 · 인증 노이즈 0" 서술), `30~31 행`, `67~80 행` (`beforeAll` / `afterEach`), `104 행` (요청 1 지점), `232 행` (지역 `truncateAll` 호출)
- [src/user/person.controller.ts](../../src/user/person.controller.ts) — guard 가 아직 없음을 재확인 (본 task 에서 **수정 금지**)
- [docs/architecture/api.md](../architecture/api.md) `79~83 행` — persons 5 route tier (GET 2 = `User+`, POST · PATCH · DELETE = `Admin+`)
- [test/perf/jest-perf.json](../../test/perf/jest-perf.json) — 세 spec 은 `pnpm test:perf` 로만 실행되고 `pnpm test` 에는 picking 되지 않는다

## Acceptance Criteria

- [ ] 세 파일 모두 `createE2EApp` import 를 `createAuthenticatedE2EApp` · `buildAuthCookie` · `reseedAuthenticatedActors` (`test/helpers/auth-e2e-helper`) 로 바꾸고, `beforeAll` 을 `ctx = await createAuthenticatedE2EApp([{ role: "User" }])` → `app = ctx.app` → `prisma = ctx.prisma` → `cookie = buildAuthCookie(Object.values(ctx.tokens)[0])` → `truncateAll(prisma)` → `reseedAuthenticatedActors(ctx)` 순으로 전환한다 (`assessment-read-realdb.perf-spec.ts` `63~70 행` 과 같은 형태).
- [ ] 세 파일의 `afterEach` 에서 `truncateAll(prisma)` **직후** `reseedAuthenticatedActors(ctx)` 를 호출한다. `person-list-scale-realdb.perf-spec.ts` `232 행` 처럼 본문 안에서 개별적으로 `truncateAll` 을 부르는 지점도 같은 재-seed 를 뒤에 붙인다 (`truncateAll` 이 actor `User` row 를 지우면 JWT `sub` 매칭이 깨진다 — helper `165~200 행` 전제).
- [ ] 세 파일의 모든 `request(app.getHttpServer())` 요청 (합계 9 지점: read 2 · detail 6 · list 1) 에 `.set("Cookie", cookie)` 를 붙인다. `git grep -n "request(app.getHttpServer())" test/perf/person-read-realdb.perf-spec.ts test/perf/person-detail-read-realdb.perf-spec.ts test/perf/person-list-scale-realdb.perf-spec.ts` 의 모든 hit 이 cookie 를 싣는다.
- [ ] "guard 미부착이라 cookie 불요 / 인증 노이즈 0" 취지의 기존 주석 (`person-read-realdb` `337 행` 부근, `person-detail-read-realdb` `41` · `124 행`, `person-list-scale-realdb` `11~14 행`) 을 "guard 배선 선행 (Q-0056 ④) — guard 가 붙어도 401 로 깨지지 않도록 인증 cookie 를 선탑재한다. 현재 controller 는 guard 미부착이라 cookie 는 no-op" 취지로 갱신한다. `git grep -n "cookie 없이 200\|createAuthenticatedE2EApp. 불요\|cookie 불요" test/perf/person-*-realdb.perf-spec.ts` 가 0 hit 이다.
- [ ] 동작 무변경: `git diff --stat origin/main -- src prisma web test/helpers` 가 비어 있다. 세 spec 의 `it` 개수 · 제목 · 기존 단언 (`assertS2Threshold` · `lastListBody` / `lastBody` 대조 · 200/404 분기 · 관찰 줄) 은 그대로고, `registerCheckinBaselineWiringSuite` 로 등록되는 국면 수도 불변이다.
- [ ] happy-path: `pnpm test:perf --testPathPattern "person-(read|detail-read|list-scale)-realdb"` 가 실 DB 환경에서 통과하고 pass 수가 변경 전과 같다 (변경 전후 수치를 PR body 에 적는다). 로컬에 DB 가 없어 실행이 불가하면 그 사실과 대체 검증 (아래 R-110 항목 + CI 결과) 을 PR body 에 명시한다.
- [ ] error path: 기존 non-2xx 국면 — `person-read-realdb` 의 미존재 id 404, `person-detail-read-realdb` 의 404 · 인위 non-2xx 주입, `person-list-scale-realdb` 의 인위 non-2xx 주입 (`p95MaxMs: 0` fail 국면 포함) — 이 cookie 부착 뒤에도 같은 status · 같은 판정으로 도달한다. cookie 가 에러 분기를 삼키지 않음을 이 국면들이 보증한다.
- [ ] 분기: 신규 production 분기 0 (test-only slice). cookie 는 상수 문자열이라 분기가 없다 — 이 항목은 그 사실을 PR body 에 한 줄로 명시하는 것으로 충족한다.
- [ ] negative (예외 분기마다 1+): ① 미존재 id 조회가 여전히 404 로 분류된다. ② 인위 non-2xx 주입 국면의 `errorRate` 위반 판정이 그대로다. ③ 주입 임계 `p95MaxMs: 0` 대비 fail 국면이 그대로 fail 로 판정된다. ④ `afterEach(truncateAll)` 뒤 seed 가 빈 상태의 빈 배열 200 국면이 재-seed 이후에도 동일하다. 네 국면 모두 **기존 test 를 재사용** 하며 신규 test 는 추가하지 않는다 (국면 수 불변 단언과 충돌 방지).
- [ ] regression (hqOrigin Q-0056): PR body 에 세 파일의 `createAuthenticatedE2EApp` · `reseedAuthenticatedActors` · `.set("Cookie", cookie)` 지점을 파일 · 행 단위 표로 적는다. 누가 이를 되돌리면 ④ guard 배선 시점에 세 spec 이 401 로 red 가 되므로, 표와 위 grep 단언이 regression 가드 역할을 한다.
- [ ] R-110: `pnpm lint && pnpm build && pnpm test` 통과. `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — production 변경 0 이라 수치는 불변이어야 한다.
- [ ] `git diff --stat` 이 `touchesFiles` 3 파일 이내다.

## Out of Scope

- `src/user/person.controller.ts` guard 실배선 · `person.controller.spec.ts` guard metadata 단언 · `persons.e2e-spec.ts` 401/403 신규 단언 · census `KNOWN_GAP_REQ_043` 축소 — persons **마지막** slice (④) 몫.
- `person-measure-confirm-realdb.perf-spec.ts` 의 cookie-less 200 단언 flip — ④ 몫.
- k6 `test/load/s1-batch.js` · `s2-read.js` · `s3-concurrent.js` 와 `load-workflow-k6-harness-wiring-drift.smoke-spec.ts` — ③ 몫.
- `group-persons-read` · `part-persons-read` · `group-persons-scale-realdb` perf spec — groups · parts 축이라 별도 arc.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) 의 slice 1 · 19 · 23 서술 갱신 — doc-only direct slice 로 분리 (Follow-ups).
- 임계값 (`DEFAULT_P95_MAX_MS` · `p95MaxMs`) · baseline 파일 · 새 helper · 새 dependency · 새 test 국면 추가.
- `docs/requirements.md` REQ status 재판정 — arc 머지 후 REQ 당 1 회.
- "API localhost 외 차단" — 오너가 철회했다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (planner, arc 계획 — Q-0056 persons 축 잔여) 본 task 머지로 ② 가 끝난다. 다음은 ③ k6 선행 (`s1-batch.js` · `s2-read.js` · `s3-concurrent.js` setup 의 login cookie 획득 + `load-workflow-k6-harness-wiring-drift.smoke-spec.ts` 의 "guard-free" 전제 갱신 — 착수 전 drift smoke 짝 개수를 다시 센다), 그 뒤 ④ guard 실배선이다. 정본 순서는 [T-2020](T-2020-persons-guard-precursor-cookie-preattach.md) `## Follow-ups`.
- (planner, doc-sync) `docs/ops/load-resilience-test-plan.md` `2876` · `3142` · `3227 행` 의 slice 1 · 19 · 23 서술이 "cookie 없이 측정" 전제를 담고 있으면 ④ 머지 후 doc-only direct slice 로 한 번에 정정한다.
