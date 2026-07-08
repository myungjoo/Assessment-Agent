---
id: T-0843
title: S2 조회 latency harness 를 열네 번째 조회 endpoint(AuthController GET /api/auth/me)에 배선하는 perf-spec 신설
phase: P8
status: DONE
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 190
estimatedFiles: 2
created: 2026-07-09
independentStream: p8-load-resilience-s2
dependsOn: []
touchesFiles:
  - test/perf/auth-me-read.perf-spec.ts
  - test/perf/README.md
plannerNote: "P8 line148 부하·내성 follow-up #14(load-resilience-test-plan §5-2) — S2 collector 를 열네 번째 조회 endpoint(AuthController GET /api/auth/me @UseGuards(JwtAuthGuard) self-read)에 배선, 신규 dep 0"
---

# T-0843 — S2 조회 latency harness 를 열네 번째 조회 endpoint(AuthController)에 배선하는 perf-spec 신설

## Why

[docs/PLAN.md](../PLAN.md) P8 line148(부하·내성 테스트) 의 follow-up chain 이자
[docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) §5 item 2("S2
조회 latency 경량 harness — supertest 기반, 신규 dependency 불요")의 다음 slice 다. T-0830
이 첫 조회 controller(`SummaryController`)에, T-0831~T-0842 가 순서대로
`AssessmentController`·`ContributionController`·`PersonController`·`GroupController`·`PartController`·`UserController`·`PermissionDeniedRecordController`·`LlmProviderConfigController`·`DifficultyMappingController`·`CronScheduleController`·`ExportController`·`ImportController`
에 S2 collector 를 배선했고, 본 task 는 **열네 번째 조회 endpoint** 인
`AuthController` 의 `GET /api/auth/me`(`me` → `userService.findById(req.user.sub)` →
`UserResponseDto.fromEntity` — 인증된 사용자 자기 자신 조회, ADR-0008 §6 / REQ-048 back)에
같은 harness 를 배선하는 `*.perf-spec.ts` 를 추가한다.

`GET /api/auth/me` 는 `@UseGuards(JwtAuthGuard)` **만** 부착된(RolesGuard 미적용) self-read
로, 앞선 12·13 slice(Export/Import 의 Admin 가드 부착 raw-forward list)와 달리 **controller
자체 분기가 있는** 경로다: (1) `req.user.sub` 추출 후 부재 시 401(defence in depth),
(2) `userService.findById(sub)` 가 stale token(DB row 삭제) 시 `NotFoundException`(404),
(3) 정상 시 `UserResponseDto.fromEntity` 로 5 필드(hashedPassword 제외) 200 반환. 따라서 본
perf-spec 은 `user-read.perf-spec.ts`(T-0836) 처럼 `overrideGuard(JwtAuthGuard)` 의
`canActivate` 가 `req.user = { sub }` 를 박제하는 passGuard 를 써야 endpoint 가 sub 를 읽어
200/404 분기에 도달한다(req.user 미박제 시 500 TypeError → 분기 미도달). 이로써 harness 가
**가드 부착 + controller 분기 있는 self-read 경로**까지 재사용됨을 실증한다(REQ-048 조회 3초
이내 back). non-2xx 분류 실증은 mocked `userService.findById` 가 예외를 던져 endpoint 가
500/404 를 반환하는 error path 로 커버한다. 신규 외부 dependency 는 0(supertest 는 기존
devDependency).

`AuthController` 의 생성자는 `AuthService`·`UserRepository`·`JwtService`·`UserService` 4 개를
주입받으므로(`auth.controller.spec.ts` 의 provider 목록 참조), perf-spec 의 테스트 모듈은 4 개
mock 을 `useValue` 로 제공하되 `GET /api/auth/me` 경로가 실제로 호출하는 것은
`userService.findById` 뿐이므로 나머지 3 mock 은 shape 정합용 jest.fn 만 두면 부트스트랩이
성립한다(RolesGuard 는 부착 안 됐으므로 override 불요 — JwtAuthGuard 만 override).

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) — §2 S2("조회·시각화 read API") / §3 임계 표(p95 < 3s, error rate < 1%) / §4.1 supertest 접근 / §5 follow-up 인덱스.
- [test/perf/latency-collector.ts](../../test/perf/latency-collector.ts) — `collectLatencySamples`·`assertS2Threshold` 시그니처(요청 함수 주입, `now` clock 주입, 2xx/reject 분류).
- [test/perf/user-read.perf-spec.ts](../../test/perf/user-read.perf-spec.ts) — **가장 근접한 mirror 대상**(T-0836) — `JwtAuthGuard` override 의 `canActivate` 가 `req.user = ADMIN_ACTOR` 를 박제해 controller 가 actor.sub 를 읽는 분기(200/404)에 도달시키는 passGuard 패턴 재사용. RolesGuard override 부분만 제거(본 endpoint 는 RolesGuard 미부착).
- [test/perf/export-running-read.perf-spec.ts](../../test/perf/export-running-read.perf-spec.ts) — 참고용(T-0841, happy/error/negative(a~d) describe 구조·mock service 패턴·readRequest 형태).
- [test/perf/jest-perf.json](../../test/perf/jest-perf.json) — `testRegex: test/perf/.*\.perf-spec\.ts$`, `maxWorkers: 1`(변경 불요 — 기존 regex 가 신규 파일 자동 매칭).
- [test/perf/README.md](../../test/perf/README.md) — "후속 harness (`*.perf-spec.ts`)" 절(본 task 가 열네 번째 배선 spec 을 반영해 갱신).
- [src/auth/auth.controller.ts](../../src/auth/auth.controller.ts) — `@Controller("api/auth")` `@Get("me")` `@UseGuards(JwtAuthGuard)` `me`(req.user.sub 추출 → 부재 시 401, `userService.findById(sub)` → row 부재 시 404, 정상 시 `UserResponseDto.fromEntity` 200). 생성자에서 `AuthService`·`UserRepository`·`JwtService`·`UserService` 4 개 주입.
- [src/auth/auth.controller.spec.ts](../../src/auth/auth.controller.spec.ts) — 참고용(L633~L639 provider 목록: `AuthService`·`UserRepository`·`JwtService`·`UserService` 4 mock; L557~L577 req.user undefined/sub undefined/sub 빈 문자열 → 401 negative 패턴; perf-spec 은 unit spec 이 아니라 latency 배선이지만 provider/mock shape 재사용 가능).
- [src/user/user.service.ts](../../src/user/user.service.ts) — `findById(id: string): Promise<User>`(row 부재 시 `NotFoundException`) 시그니처(mock 대상 shape 참조 — perf-spec 은 `findById` 만 배선하되 mock 은 필요한 메서드만 jest.fn).
- [src/user/dto/user-response.dto.ts](../../src/user/dto/user-response.dto.ts) — `fromEntity(user): UserResponseDto`(5 필드 id/email/role/createdAt/updatedAt, hashedPassword 제외) — mocked `findById` 가 반환할 fixture User 는 이 5 필드 + hashedPassword 를 포함한 shape 로 구성(fromEntity 가 whitelist).

## Acceptance Criteria

perf-spec 은 결정론적이어야 하며(실 DB·실 Prisma·외부 I/O 무의존), collector 배선의 정확성을
검증한다. `AuthService`·`UserRepository`·`JwtService`·`UserService` 는 모두 mock(`useValue`)으로
대체한다(`GET /api/auth/me` 경로가 실제 호출하는 것은 `userService.findById` 뿐이므로 나머지
3 개는 shape 정합용 jest.fn). controller 의 `GET /api/auth/me` 는 `JwtAuthGuard` **만** 부착돼
있으므로 `user-read.perf-spec.ts` 처럼 `overrideGuard(JwtAuthGuard).useValue({ canActivate: (ctx) => { ctx.switchToHttp().getRequest().user = { sub: "..." }; return true; } })`
로 가드를 무력화하되 **req.user 를 박제**한다(req.user 미박제 시 me 핸들러가 sub 를 못 읽어
분기 미도달). RolesGuard override 는 하지 않는다(본 endpoint 미부착). `export-running-read`/
`user-read` 의 describe 구조를 mirror 하되 대상 controller/route/service·guard override 만 교체한다.

- [ ] `test/perf/auth-me-read.perf-spec.ts` 신설 — `Test.createTestingModule` 로 `AuthController` + 4 mock 프로바이더(`AuthService`·`UserRepository`·`JwtService`·`UserService`, 최소 `userService.findById` jest.fn) 를 부트스트랩하고 `overrideGuard(JwtAuthGuard)` 의 `canActivate` 가 `req.user = { sub }` 를 박제하도록 한 뒤, `collectLatencySamples(() => request(app.getHttpServer()).get("/api/auth/me"), N)` 로 반복 호출해 표본을 수집하고 `assertS2Threshold(result).pass` 가 `true` 임을 검증(happy-path).
- [ ] Happy-path unit test: mocked `findById` 가 정상 User(200) 를 반환할 때 `collectLatencySamples` 가 `total === N`, `failures === 0`, `samplesMs.length === N` 을 만족하고 `assertS2Threshold` 가 pass(p95 < 3000ms) 임을 검증하는 test 1+. 응답 body 에 `hashedPassword` 가 없음(UserResponseDto whitelist) 도 최소 1회 assert.
- [ ] Error path unit test: mocked `findById` 가 `NotFoundException` 을 던져 endpoint 가 non-2xx(404) 를 반환할 때 `collectLatencySamples` 가 해당 호출을 `failures` 로 분류하고 `assertS2Threshold` 가 errorRate 위반 사유(`reasons`)를 담아 `pass === false` 를 반환함을 검증하는 test 1+.
- [ ] Branch/flow cover: `assertS2Threshold` 의 pass 분기(200)와 fail 분기(임계 위반, 404/500) 각각을 실제 endpoint 호출 결과로 도달시키는 test 각 1+ (위 happy/error 로 충족되면 그 명시로 갈음). controller 의 sub 부재 → 401 분기도 아래 negative (b) 로 도달.
- [ ] Negative cases 충분 cover — 예외 상황 각 1+ test:
  - (a) **stale token(404)**: `findById` 가 `NotFoundException`(DB row 삭제된 valid-signature token) 을 던질 때 endpoint 가 404 를 반환하고 collector 가 `failures` 로 분류, `assertS2Threshold` fail.
  - (b) **인증 컨텍스트 부재(401)**: passGuard 가 `req.user` 를 박제하지 않거나 `sub` 가 빈 문자열/undefined 일 때 me 핸들러의 defence-in-depth 분기가 401 을 반환하고 collector 가 `failures` 로 분류함을 실증(별도 describe 또는 별도 module 로 req.user 미박제 guard 를 써서 도달).
  - (c) **mixed 부분 실패**: 다수 호출 중 일부만 404/실패할 때 `failures` 부분 집계 정확성.
  - (d) **iterations 경계**: `iterations === 1` 등 경계에서 harness 가 깨지지 않음.
- [ ] `pnpm test:perf` 통과 — 신규 perf-spec 이 `jest-perf.json` regex 에 매칭되어 실제로 실행되고 green(기존 13 perf-spec 과 함께 열네 개 다 실행).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — perf-spec 이 기존 unit coverage gate 를 깨지 않음(perf-spec 은 별도 config 이므로 기존 `pnpm test` green 유지도 함께 확인).
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `test/perf/README.md` 의 harness 절을 갱신 — 이제 열네 개의 실 perf-spec(summary + assessment + contribution + person + group + part + user + permission-denied-read + llm-provider-config-read + difficulty-mapping-read + cron-schedule-read + export-running-read + import-running-read + auth-me-read) 이 존재함을 반영(파일명·실행법·mock 으로 DB 무의존임을 1~3줄로 명시; 본 endpoint 는 JwtAuthGuard 만 부착이라 `overrideGuard(JwtAuthGuard)` 의 canActivate 가 req.user 를 박제해야 sub 분기에 도달함을 짧게 언급 — RolesGuard override 불요).
- [ ] 신규 외부 dependency 0 — `package.json`/`pnpm-lock.yaml` 무변경(supertest 는 기존 devDependency).

## Out of Scope

- 실 DB(Postgres)·실 Prisma 를 띄운 진짜 round-trip latency 측정 — 본 task 는 harness **배선 검증**이지 baseline 실측이 아니다(baseline 은 §5 item 5 별도 follow-up).
- S1(평가 배치 1h)·S3(동시성 내성) harness — 신규 부하 발생기(k6 등)를 요구하므로 §5 item 1/3 별도 task(owner 승인 BLOCKED).
- k6/artillery/autocannon 등 신규 dependency 도입 — CLAUDE.md §5 BLOCKED, ADR-0054 owner 승인 후 별도 pr-task.
- `.github/workflows/` 에 perf job 상시 편입 — §5 item 4 별도 task(부하는 무거워 PR CI 와 분리).
- PLAN.md line148 checkbox flip — harness 전체 완결 전까지 `[ ]` 유지(본 task 는 slice 14).
- `assertS2Threshold`/`collectLatencySamples` 순수 로직 자체 변경 — 이미 T-0828/T-0829 에서 spec 완료. 본 task 는 그 primitive 를 **호출·배선**만 한다.
- 기존 13 perf-spec(summary~import-running) 변경 — file-disjoint 유지(본 task 는 신규 `auth-me-read.perf-spec.ts` 만 추가).
- `POST /api/auth/login`·`POST /api/auth/logout`·`POST /api/auth/refresh` endpoint 배선 — 본 task 는 read(`GET /api/auth/me`) 만 배선. login/logout/refresh 는 write/auth-flow 경로라 S2 조회 범위 밖(필요 시 별도 검토).
- JWT 발급/검증·cookie rotation·RBAC escalation 자체 검증 — 본 task 는 me self-read 의 latency 배선만(인증 정책은 기존 auth.controller.spec / jwt.strategy.spec / e2e 가 커버).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(작성 시 비어 있음. sub-agent 가 관련 작업 발견 시 여기에 append.)

## Result (DONE — 2026-07-08T22:10Z)

- PR [#737](https://github.com/myungjoo/Assessment-Agent/pull/737) squash-merge `fc1ad0c7` (round 1/7, reviewer APPROVE finding 0, 4-게이트 PASS, CI green).
- 신설: `test/perf/auth-me-read.perf-spec.ts` (AuthController + 4 mock provider, `JwtAuthGuard` override 의 canActivate 가 `req.user={sub}` 박제; happy 2 / error 1 / negative a~d), `test/perf/README.md` harness 절 13→14 갱신. +346/-10, 2 files.
- 검증: `pnpm lint`·`pnpm build` green, `pnpm test:perf` 14 suites/84 tests green(신규 spec 8 test), `pnpm test:cov` 357 suites/9094 tests green(coverage line·function ≥80% gate 유지). 신규 외부 dependency 0.
- fineGrainedConcurrency ON(stage 5b, maxConcurrentClaims=2) claim-pickup fire: acquire-lock CAS(cron@aa-local-15-50c5) → active claims 0<2 pr-mode 단독 조건 충족 → select-claim T-0843(lock tombstone release 동일 commit) → lock-free executor → PR #737 → sync-claim-pr(prNumber=737) → integrator 4-게이트 → merge → claim prune [].
