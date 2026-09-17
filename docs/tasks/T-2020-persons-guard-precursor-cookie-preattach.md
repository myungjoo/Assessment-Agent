---
id: T-2020
title: persons guard 배선 선행 — 무-cookie 소비처 3 spec 에 인증 cookie 선탑재 + web cookie 전송 계약 test
phase: P5
status: DONE
prNumber: 1581
commitMode: pr
coversReq: [REQ-043, REQ-045, REQ-046, REQ-073]
estimatedDiff: 210
estimatedFiles: 4
created: 2026-09-15
independentStream: q0056-persons-guard
dependsOn: [T-2017]
touchesFiles: [test/smoke/persons.smoke-spec.ts, test/e2e/persons.e2e-spec.ts, test/e2e/person-identity-continuation.e2e-spec.ts, web/src/views/useAdminPersons.auth-cookie.test.ts]
hqOrigin: Q-0056
plannerNote: P5 · Q-0056 ① persons slice 선행 1 — guard 배선 시 깨질 무-cookie 소비처 cookie 선탑재 + web 조건 test
---

# T-2020 — persons guard 배선 선행: 무-cookie 소비처 3 spec 에 인증 cookie 선탑재 + web cookie 전송 계약 test

## Why

오너가 HQ **Q-0056** 에서 옵션 ① 을 승인했다 (`STATE.humanQuestions` Q-0056 `decision`, 2026-09-14). 승인 내용은 `api/persons` → `api/groups` → `api/parts` 순서로 기존 `JwtAuthGuard` · `RolesGuard` · `@Roles` 를 배선하는 것이다. 조건이 하나 붙었다. 각 slice 는 web 측이 인증 cookie 를 실제로 보내서 guard 배선 뒤에도 401 로 깨지지 않는다는 것을 AC 와 test 로 남겨야 한다. 오너가 함께 냈던 "API localhost 외 차단" 제안은 오너가 철회했으므로 이 arc 에 넣지 않는다.

**planner 실측 — persons controller 1 개의 guard 배선이 5 파일 cap 을 넘는다** (origin/main `156ee378`). `src/user/person.controller.ts` 에는 여전히 `UseGuards` · `@Roles` 가 0 hit 이다 (issue-still-relevant 확인). 그런데 `/api/persons` 를 cookie 없이 호출하는 CI 실행 소비처가 controller · spec · census 외에도 여럿이다.

- e2e: `test/e2e/persons.e2e-spec.ts` (11 요청), `test/e2e/person-identity-continuation.e2e-spec.ts` (`32 행` 주석이 "guard 미적용이라 쿠키 없이" 를 명시, `74` · `138` · `206` · `218` · `259 행`)
- smoke: `test/smoke/persons.smoke-spec.ts` (AppModule 부트, cookie 0)
- perf (CI `perf test` step, `.github/workflows/ci.yml` `251~267 행`): `person-read` · `person-detail-read` (guard 없는 모듈 부트라 guard 부착 시 DI 실패 가능), `person-read-realdb` · `person-detail-read-realdb` · `person-list-scale-realdb`, 그리고 `person-measure-confirm-realdb` (cookie 없이 200 을 **단언**)
- k6: `test/load/s1-batch.js` · `s2-read.js` · `s3-concurrent.js` 는 `/api/persons` 를 "guard-free" 로 전제한다. `test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts` `437~461 행` 도 같은 전제를 둔다.

오너 결정문의 "controller 별 slice 3 개" 를 한 PR 에 담으면 10 파일을 넘는다. 그래서 persons slice 를 **선행 slice 로 쪼갠다**. 선행 slice 는 guard 가 아직 없는 route 에 cookie 를 먼저 싣는다. cookie 를 실어도 지금 동작은 바뀌지 않으므로 선행 slice 는 각자 green 으로 머지할 수 있다. 마지막 guard 배선 slice 는 controller · spec · e2e 401/403 · census · cookie-less 단언 flip 만 가져간다. 이 분할은 auth 동작을 바꾸지 않는 test 재배치다. 오너 승인 범위 (guard 배선 자체와 새 dependency 0) 도 바꾸지 않으므로 추가 HQ 는 필요 없다.

본 task 는 그 첫 선행 slice 다. AppModule 로 부팅하는 backend 소비처 3 spec 에 cookie 를 선탑재한다. 오너 조건인 web cookie 전송 확인도 persons 축 test 로 여기서 먼저 남긴다.

## Required Reading

- `docs/STATE.json` 의 `humanQuestions` Q-0056 `decision` (오너 승인 원문 · 조건)
- [docs/architecture/api.md](../architecture/api.md) `79~83 행` — persons 5 route 의 tier (GET 2 = `User+`, POST · PATCH · DELETE = `Admin+`)
- [test/helpers/auth-e2e-helper.ts](../../test/helpers/auth-e2e-helper.ts) `106 행` `buildAuthCookie`, `132 행` `createAuthenticatedE2EApp`, `182 행` `reseedAuthenticatedActors`
- [test/e2e/person-identity-continuation.e2e-spec.ts](../../test/e2e/person-identity-continuation.e2e-spec.ts) `25~100 행` (harness · 주석), `138` · `206` · `218` · `259 행` (cookie 없는 persons 요청)
- [test/e2e/persons.e2e-spec.ts](../../test/e2e/persons.e2e-spec.ts) `1~86 행` (harness), `88~297 행` (요청 11 곳)
- [test/smoke/persons.smoke-spec.ts](../../test/smoke/persons.smoke-spec.ts) `40~80 행` (AppModule 부트 · truncate)
- harness 선례: [test/e2e/service-identities.e2e-spec.ts](../../test/e2e/service-identities.e2e-spec.ts) `142~200 행` (Admin + User 2 actor, `afterEach` 는 `truncateAll` → `reseedAuthenticatedActors` 순서)
- [web/src/api/apiClient.ts](../../web/src/api/apiClient.ts) `55~80 행` (`credentials: 'same-origin'` 강제 · 401 refresh), [web/src/api/useApiResource.ts](../../web/src/api/useApiResource.ts) `15 행`
- [web/src/views/useAdminPersons.ts](../../web/src/views/useAdminPersons.ts) `28` · `64` · `85` · `119` · `222 행` (persons GET · DELETE · POST · PATCH 발사 지점), colocated spec [web/src/views/useAdminPersons.test.ts](../../web/src/views/useAdminPersons.test.ts) (harness 선례 — 이 spec 은 `apiClient` 를 mock 하므로 신규 test 는 mock 하지 않는 점이 다르다)
- 신규 web test 의 colocated 위치: `web/src/views/useAdminPersons.auth-cookie.test.ts`

## Acceptance Criteria

**backend 소비처 cookie 선탑재 (3 spec)**

- [ ] `test/e2e/persons.e2e-spec.ts` 의 harness 를 `createAuthenticatedE2EApp` (Admin 1 · User 1) 로 바꾼다. `afterEach` 는 `truncateAll` → `reseedAuthenticatedActors` 순서로 둔다. `/api/persons` 요청 11 곳 전부에 `.set("Cookie", …)` 를 붙인다. GET 2 route 는 `userCookie`, POST · PATCH · DELETE 는 `adminCookie` 를 쓴다 (api.md `79~83 행` tier). 기존 11 test 의 status · body 단언은 바꾸지 않는다.
- [ ] `test/e2e/person-identity-continuation.e2e-spec.ts` 의 persons 요청 5 곳 (`74` · `138` · `206` · `218` · `259 행`) 에 `adminCookie` 를 싣는다. `32~33 행` 주석을 "persons 도 편집 tier cookie 를 싣는다 (guard 배선 선행, T-2020)" 취지로 고친다. 10 test 의 기존 단언은 유지한다.
- [ ] `test/smoke/persons.smoke-spec.ts` 의 persons 요청 전부에 tier 에 맞는 cookie 를 싣는다. 인증 actor 는 `test/helpers/auth-e2e-helper.ts` 를 재사용하고, 새 helper 는 만들지 않는다. truncate 로 actor 가 지워지면 원본 id 로 재삽입한다.
- [ ] 기계 검증: 3 파일 각각에서 `/api/persons` 를 대상으로 하는 supertest 호출 수와 그 호출 체인의 `.set("Cookie"` 수가 같다. 실행 시점에 다시 세서 PR body 에 표로 적는다. cookie 없는 persons 호출이 남으면 그 사유를 해당 줄 주석으로 단다 (이번 slice 에서는 0 건이 기대값).
- [ ] 동작 무변경: `src/` 변경 0 이다. `git diff --stat origin/main -- src prisma` 가 비어 있다. guard 가 아직 없으므로 3 spec 의 기존 test 수와 pass 결과는 같다.
- [ ] (권장 · 기록) executor 는 가능하면 로컬에서 **커밋하지 않고** `PersonController` 에 `@UseGuards(JwtAuthGuard, RolesGuard)` + tier `@Roles` 를 임시로 붙인다. 그 상태로 3 spec 을 돌려 401 · 403 없이 통과하는지 확인하고 되돌린다. 결과 (실행 여부 · pass 수) 는 `docs/progress/details/T-2020-dryrun.md` 에 적는다. DB 가 없어 못 돌렸으면 그 사실만 적는다.

**web cookie 전송 계약 (오너 조건 — persons 축)**

- [ ] 신규 `web/src/views/useAdminPersons.auth-cookie.test.ts` 를 만든다. `apiClient` 는 **mock 하지 않고** 전역 `fetch` 만 stub 해서 `useAdminPersons` 를 구동한다. persons 4 발사 (GET `/api/persons` 목록 · POST `/api/persons` · PATCH `/api/persons/:id` · DELETE `/api/persons/:id`) 에 대해, 실제 `fetch` 두 번째 인자의 `credentials` 가 `'same-origin'` 인지 method 별로 1 test 이상 단언한다 (happy-path).
- [ ] error path 1+: 인원 목록 GET 이 401 을 받으면 apiClient 의 refresh 경로를 탄다. refresh 도 실패하면 hook 이 error 상태를 드러낸다. 이때 refresh · retry 요청도 `credentials: 'same-origin'` 인지 단언한다.
- [ ] negative 는 예외 분기마다 1+: ① mutation (POST · PATCH · DELETE 중 1 개 이상) 이 403 을 받으면 성공 상태로 전이하지 않고 error 를 드러낸다. ② 네트워크 예외 (`fetch` reject) 도 error 로 드러난다. ③ 호출자가 `credentials: 'omit'` 을 넘기려 해도 강제값 `'same-origin'` 이 유지된다. 이 가드가 실제로 도달 가능한 경로가 아니면 사유를 test 주석에 적고 생략한다.
- [ ] 분기: 신규 production 분기는 없다 (test-only slice). 위 test 들이 GET (useApiResource 경유) · mutation (request 경유) 두 발사 경로를 각각 cover 한다.

**R-110 / R-112 공통**

- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). production 변경이 0 이라 수치는 불변이어야 한다.
- [ ] `pnpm test:smoke` · `pnpm test:e2e` 통과 (CI leg 기준). web test 는 web 패키지의 test 명령으로 통과한다.
- [ ] regression (hqOrigin 있음): 위 기계 검증 표와 web `credentials` 단언이 regression 가드 역할을 한다. 이후 누군가 persons 요청에서 cookie 를 빼거나 apiClient 의 `credentials` 강제를 제거하면 test 가 red 가 된다. 적어도 web test 는 반드시 그렇게 동작한다.
- [ ] `git diff --stat` 이 `touchesFiles` 4 파일 (+ details 기록 파일) 이내다.

## Out of Scope

- `src/user/person.controller.ts` guard 실 배선, `person.controller.spec.ts`, e2e 401 · 403 신규 단언, census `KNOWN_GAP_REQ_043` 축소. 이는 persons **마지막** slice 몫이다.
- perf 6 spec (`test/perf/person-*.perf-spec.ts`) 과 k6 `test/load/s1-batch.js` · `s2-read.js` · `s3-concurrent.js` · load drift smoke 의 cookie 대응. 후속 선행 slice 몫이다.
- groups · parts 소비처, 새 dependency, `test/helpers/` 신규 helper, `docs/requirements.md` REQ status 재판정 (arc 머지 후 REQ 당 1 회).
- "API localhost 외 차단" — 오너가 철회했다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (planner, arc 계획 — Q-0056 persons 축 잔여) 다음 slice 들은 순서대로 큐잉한다.
  - ② **perf 선행**: guard 없는 모듈 부트 2 spec (`person-read` · `person-detail-read`) 에 guard override 를 준비하고, realdb 3 spec (`person-read-realdb` · `person-detail-read-realdb` · `person-list-scale-realdb`) 에 cookie 를 선탑재한다 (5 파일).
  - ③ **k6 선행**: `s1-batch.js` · `s2-read.js` · `s3-concurrent.js` setup 에서 login cookie 를 획득해 persons 요청에 싣고, `load-workflow-k6-harness-wiring-drift.smoke-spec.ts` 의 "guard-free" 전제를 갱신한다. 착수 전에 drift smoke 짝 개수를 다시 센다.
  - ④ **persons guard 배선**: `person.controller.ts` + `person.controller.spec.ts` (guard metadata 단언) + `persons.e2e-spec.ts` (무 cookie 401 · User cookie mutation 403) + census `KNOWN_GAP_REQ_043` 20 → 15 · `MIN.guarded` 상향 + `person-measure-confirm-realdb.perf-spec.ts` 의 cookie-less 200 단언 flip. AC 에 T-2020 web cookie test green 유지를 적는다.
  - 그 뒤 groups · parts 도 같은 방식으로 소비처를 먼저 실측하고 선행 slice 로 나눈다.
- (executor, 실측) estimatedDiff 210 은 과소 추정이었다 — 첫 diff 486 LOC 를 +255/-44 로 줄여 cap 에 맞췄다. 후속 ②~④ slice 는 추정치를 넉넉히 잡는다. 로컬 DB 부재로 guard 임시 부착 dry-run 은 미실행 (`docs/progress/details/T-2020-dryrun.md`).
