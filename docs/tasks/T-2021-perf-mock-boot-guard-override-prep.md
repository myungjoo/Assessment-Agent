---
id: T-2021
title: persons guard 배선 선행 2 — mock 부트 perf 2 spec 에 guard override 선탑재
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-043, REQ-045, REQ-048, REQ-073]
estimatedDiff: 110
estimatedFiles: 2
created: 2026-09-18
independentStream: q0056-persons-guard
dependsOn: [T-2020]
touchesFiles: [test/perf/person-read.perf-spec.ts, test/perf/person-detail-read.perf-spec.ts]
hqOrigin: Q-0056
plannerNote: P5 · Q-0056 ① persons slice 선행 2 — T-2020 Follow-up ② 중 mock 부트 2 spec 의 overrideGuard 선탑재
---

# T-2021 — persons guard 배선 선행 2: mock 부트 perf 2 spec 에 guard override 선탑재

## Why

오너가 HQ **Q-0056** 에서 옵션 ① 을 승인했다 (`docs/STATE.json` `humanQuestions` Q-0056 `decision`, 2026-09-14). `api/persons` → `api/groups` → `api/parts` 순으로 기존 `JwtAuthGuard` · `RolesGuard` · `@Roles` 를 배선한다. persons 축은 소비처가 많아 [T-2020](T-2020-persons-guard-precursor-cookie-preattach.md) 에서 선행 slice 로 쪼갰고, 그 `Follow-ups` 가 남긴 순서는 ② perf 선행 → ③ k6 선행 → ④ guard 실배선이다. 본 task 는 ② 의 **앞 절반** 이다.

**issue-still-relevant 확인** (origin/main `2b90a6d3`): `src/user/person.controller.ts` 에 `UseGuards` · `@Roles` 는 여전히 0 hit 이다. 그리고 `test/perf/person-read.perf-spec.ts` `98 행` · `test/perf/person-detail-read.perf-spec.ts` `78 행` 은 `overrideGuard` 를 **호출하지 않고** "PersonController 는 guard 미적용 — overrideGuard 없이 순수 부트스트랩" 이라는 주석만 달고 있다. 두 spec 은 `AppModule` 이 아니라 `Test.createTestingModule({ controllers: [PersonController], providers: [{ provide: PersonService, useValue: … }] })` 로 controller 1 개만 띄운다. 이 상태에서 ④ 가 controller 에 guard 를 붙이면 `JwtAuthGuard` · `RolesGuard` 가 요구하는 provider 가 test module 에 없어 **DI 실패 또는 전 요청 401** 로 두 spec 이 한꺼번에 red 가 된다.

guard 가 아직 없는 지금 `overrideGuard` 를 먼저 달아두면 동작은 no-op 이라 본 slice 는 단독으로 green 머지가 되고, ④ 시점의 perf red 요인 2 개가 미리 제거된다. 같은 패턴이 이미 `test/perf/assessment-read.perf-spec.ts` `77~80 행` 에 박제돼 있어 새 개념 도입은 0 이다.

T-2020 의 `Follow-ups` ② 는 mock 부트 2 spec + realdb 3 spec 을 한 slice (5 파일) 로 잡았으나, T-2020 executor 실측이 "estimatedDiff 210 → 첫 diff 486 LOC" 로 과소 추정이었다고 기록했다. realdb 3 spec 은 harness 를 `createE2EApp` → `createAuthenticatedE2EApp` 로 바꾸고 `afterEach` 재-seed 까지 붙여야 해 5 파일을 한 PR 에 담으면 300 LOC cap 을 넘길 공산이 크다. 그래서 ② 를 성격이 다른 두 slice 로 나눈다. 본 task 는 mock 부트 2 spec (cookie 불요 · override 만 필요), 다음 task 가 realdb 3 spec (cookie 선탑재) 이다.

## Required Reading

- `docs/STATE.json` 의 `humanQuestions` Q-0056 `decision` — 오너 승인 원문 · 조건
- [docs/tasks/T-2020-persons-guard-precursor-cookie-preattach.md](T-2020-persons-guard-precursor-cookie-preattach.md) `## Follow-ups` — persons 축 잔여 slice ②~④ 순서
- [docs/architecture/api.md](../architecture/api.md) `79~83 행` — persons 5 route tier (GET 2 = `User+`, POST · PATCH · DELETE = `Admin+`)
- 선례: [test/perf/assessment-read.perf-spec.ts](../../test/perf/assessment-read.perf-spec.ts) `17~25 행` (주석 표현), `36~37 행` (guard import 경로), `63 행` (`passGuard` 상수), `71~85 행` (`overrideGuard` 부트 블록)
- [test/perf/person-read.perf-spec.ts](../../test/perf/person-read.perf-spec.ts) `13~28 행` (guard 관련 헤더 주석), `89~106 행` (`beforeAll` 부트), 파일 끝 `registerCheckinBaselineWiringSuite` 호출
- [test/perf/person-detail-read.perf-spec.ts](../../test/perf/person-detail-read.perf-spec.ts) `21~34 행` (guard 관련 헤더 주석), `73~86 행` (`beforeAll` 부트)
- [src/auth/jwt-auth.guard.ts](../../src/auth/jwt-auth.guard.ts), [src/auth/roles.guard.ts](../../src/auth/roles.guard.ts) — override 대상 class 식별자
- [src/user/person.controller.ts](../../src/user/person.controller.ts) — guard 가 아직 없음을 재확인 (본 task 에서 **수정 금지**)
- [test/perf/jest-perf.json](../../test/perf/jest-perf.json) — 본 spec 2 개는 `pnpm test:perf` 로만 실행됨

## Acceptance Criteria

- [ ] `test/perf/person-read.perf-spec.ts` 의 `Test.createTestingModule({…})` 체인에 `.overrideGuard(JwtAuthGuard).useValue(passGuard).overrideGuard(RolesGuard).useValue(passGuard)` 를 붙인다. `passGuard` 는 `{ canActivate: () => true }` 로 `assessment-read.perf-spec.ts` `63 행` 과 같은 형태로 선언한다.
- [ ] `test/perf/person-detail-read.perf-spec.ts` 에 같은 override 를 붙인다.
- [ ] 두 파일의 "PersonController 는 guard 미적용 — overrideGuard 없이 순수 부트스트랩" 주석 (각 파일 본문 `78` · `98 행` 부근) 과 헤더 주석의 대응 서술을 갱신한다. 새 서술은 "guard 배선 선행 (T-2020 arc) — Q-0056 ④ 에서 `PersonController` 에 guard 가 붙어도 부트가 깨지지 않도록 `overrideGuard` 를 선탑재한다. 현재는 no-op" 취지를 담는다. 옛 "적용해도 no-op / 불요" 서술이 남아 있으면 안 된다 (`git grep -n "overrideGuard 없이" test/perf/person-read.perf-spec.ts test/perf/person-detail-read.perf-spec.ts` 가 0 hit).
- [ ] 동작 무변경: `git diff --stat origin/main -- src prisma web` 가 비어 있다. 두 spec 의 `it` 개수 · 제목 · 기존 단언 (`assertS2Threshold` · `toHaveBeenCalledTimes` · 200/404/500 분기) 은 그대로다. `registerCheckinBaselineWiringSuite` 로 등록되는 국면 10 개도 불변이다.
- [ ] happy-path: `pnpm test:perf --testPathPattern "person-(read|detail-read)\.perf-spec"` 가 통과하고, 두 spec 의 pass 수가 변경 전과 같다 (변경 전후 수치를 PR body 에 적는다). 실 DB 불요 — mock 부트라 로컬에서 실행 가능하다.
- [ ] error path: 기존 non-2xx 국면 (`person-read` 의 `findById` `NotFoundException` 404 · mock 예외 500, `person-detail-read` 의 404 · 500) 이 override 부착 뒤에도 같은 status 로 도달한다. guard override 가 error 분기를 삼키지 않음을 이 국면들이 보증한다.
- [ ] 분기: 신규 production 분기 0 (test-only slice). override 자체는 분기 없는 `canActivate: () => true` 상수라 추가 분기 test 대상이 없다 — 이 항목은 그 사실을 PR body 에 한 줄로 명시하는 것으로 충족한다.
- [ ] negative (예외 분기마다 1+): ① mock service 가 reject 하는 국면이 여전히 500 으로 분류돼 `failures` 에 잡힌다. ② 존재하지 않는 id 조회가 여전히 404 로 분류된다. ③ `iterations === 1` 경계 국면 (`person-read` 의 `(d)` test) 이 그대로 통과한다. 세 국면 모두 **기존 test 를 재사용** 하며 신규 test 는 추가하지 않는다 (추가 시 국면 수 불변 단언과 충돌).
- [ ] regression (hqOrigin Q-0056): PR body 에 `overrideGuard` 호출 지점을 파일 · 행 단위 표로 적는다. 이후 누가 override 를 제거하면 ④ guard 배선 시점에 두 spec 이 다시 red 가 되므로, 표와 위 grep 단언이 regression 가드 역할을 한다.
- [ ] R-110: `pnpm lint && pnpm build && pnpm test` 통과. `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — production 변경 0 이라 수치는 불변이어야 한다. `.perf-spec.ts` 는 `pnpm test` 에 picking 되지 않으므로 perf 확인은 위 `pnpm test:perf` 항목으로 대신한다.
- [ ] `git diff --stat` 이 `touchesFiles` 2 파일 이내다.

## Out of Scope

- `src/user/person.controller.ts` guard 실배선 · `person.controller.spec.ts` · e2e 401/403 신규 단언 · census `KNOWN_GAP_REQ_043` 축소 — persons **마지막** slice (④) 몫.
- realdb perf 3 spec (`person-read-realdb` · `person-detail-read-realdb` · `person-list-scale-realdb`) 의 cookie 선탑재 — 본 task 바로 다음 slice 몫.
- `person-measure-confirm-realdb.perf-spec.ts` 의 cookie-less 200 단언 flip — ④ 몫.
- k6 `test/load/s1-batch.js` · `s2-read.js` · `s3-concurrent.js` 와 `load-workflow-k6-harness-wiring-drift.smoke-spec.ts` — ③ 몫.
- `group-persons-read` · `part-persons-read` · `group-persons-scale-realdb` perf spec — groups · parts 축이라 별도 arc.
- 임계값 (`DEFAULT_P95_MAX_MS`) · baseline 파일 · 새 helper · 새 dependency · `docs/requirements.md` REQ status 재판정 (arc 머지 후 REQ 당 1 회).
- "API localhost 외 차단" — 오너가 철회했다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (planner, arc 계획 — Q-0056 persons 축 잔여) ②-후반 → ③ → ④ 순서는 [T-2020](T-2020-persons-guard-precursor-cookie-preattach.md) `## Follow-ups` 가 정본이다. 본 task 머지 후 다음 slice 는 realdb perf 3 spec cookie 선탑재 (`person-read-realdb` · `person-detail-read-realdb` · `person-list-scale-realdb`, harness 를 `createAuthenticatedE2EApp` 으로 전환 + `afterEach` 에 `reseedAuthenticatedActors`).
