---
id: T-0850
title: S2 조회 latency harness 를 UserController :id detail-read 에 배선하는 스물한 번째 perf-spec 신설
phase: P8
status: DONE
commitMode: pr
mergedAs: 3eec9669
prNumber: 744
reviewRounds: 1
completedAt: 2026-07-09T04:50:00Z
coversReq: [REQ-048]
independentStream: s2-latency-perf-wiring
dependsOn: []
touchesFiles: [test/perf/user-detail-read.perf-spec.ts, test/perf/README.md]
estimatedDiff: 270
estimatedFiles: 2
created: 2026-07-09
plannerNote: "P8 load-resilience §5 follow-up (S2 latency harness) — T-0849(contribution :id) 다음 detail(:id) slice, UserController GET /api/users/:id 배선 (일곱 번째 :id detail, controller 자체 403 분기 있는 첫 detail)"
---

# T-0850 — S2 조회 latency harness 를 UserController :id detail-read 에 배선하는 스물한 번째 perf-spec 신설

## Why

[docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) §5 follow-up (S2 조회 latency 경량 harness) 의 endpoint 배선 backlog 를 한 slice 더 진행한다. T-0828/T-0829 가 신설한 latency primitive/collector 를, T-0830~T-0849 가 20 개 조회 endpoint(list/query/self-read 14 + summary·group·assessment·person·part·contribution :id detail 6)에 배선했다. 본 task 는 **스물한 번째 slice** 로 `UserController` 의 detail(:id) read `GET /api/users/:id` (`detail` 핸들러 — `@UseGuards(JwtAuthGuard)` + controller 자체 authorization 분기: isSelf/isAdminPlus 아니면 `ForbiddenException`(403), 통과 시 `userService.findById(id)` → row 부재 시 `NotFoundException`(404), 정상 시 `UserResponseDto.fromEntity`(200)) 에 collector 를 배선한다. 앞선 detail slice 와의 차이: 본 endpoint 는 **controller 자체 403 분기가 있는 첫 detail(:id)** 이라, T-0843(auth-me self-read) 의 `overrideGuard(JwtAuthGuard)` + `req.user` 박제 패턴을 mirror 하되 self/Admin+ 분기(200/403/404)를 함께 실증한다. REQ-048 (조회·시각화 3초 이내, `perf` 검증) 을 back 한다.

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) — §5 follow-up 인덱스, S2 시나리오·임계 (p95 < 3s, error rate < 1%).
- [test/perf/auth-me-read.perf-spec.ts](../../test/perf/auth-me-read.perf-spec.ts) — `overrideGuard(JwtAuthGuard)` + `req.user` 박제(canActivate 가 `req.user={sub,role}` 주입) 배선 패턴 (mirror 대상 — self-read + guard override).
- [test/perf/latency-collector.ts](../../test/perf/latency-collector.ts) — `collectLatencySamples` / `assertS2Threshold` / `RequestFn` 시그니처.
- [src/user/user.controller.ts](../../src/user/user.controller.ts) — `@Get(":id") @UseGuards(JwtAuthGuard) detail(@Param("id") id, @CurrentUser() actor)` 핸들러 (line 253~279). isSelf(`actor.sub===id`) / isAdminPlus(`actor.role==="Admin"||"SuperAdmin"`) 분기, 둘 다 false 시 `ForbiddenException`(403), 통과 시 `userService.findById(id)` → `UserResponseDto.fromEntity`.
- [src/user/user.service.ts](../../src/user/user.service.ts) — mock 대상 메서드 shape (`findById` line 183, `findAll` line 210, `changeRole` line 111, `signup`); detail 이 호출하는 것은 `findById` 뿐.

## Acceptance Criteria

- [ ] `test/perf/user-detail-read.perf-spec.ts` 신설. `UserController` 를 부트스트랩하고 `UserService` 를 mock(`useValue`) 으로 주입, `JwtAuthGuard` 를 `overrideGuard(...).useValue({ canActivate })` 로 override 하되 `canActivate` 가 `req.user = { sub, role }` 를 박제해 detail 핸들러가 isSelf/isAdminPlus 분기에 도달하게 한다(auth-me-read.perf-spec.ts 패턴). mock service 는 `findById` 를 포함한 `jest.fn` 들을 갖되 detail 경로는 `findById` 만 호출.
- [ ] **Happy-path test**: passGuard 가 `req.user={sub:SELF, role:"User"}` 박제(isSelf true) + mock `findById` 가 단일 User 반환 → 200 N회 → `total===N`, `failures===0`, `samplesMs.length===N`, `assertS2Threshold(result).pass===true`, `errorRate===0`, `service.findById` 가 N회 `SELF` 로 호출됨 검증. 응답 body 에 `hashedPassword` 미노출(UserResponseDto whitelist) 도 1 test 로 검증.
- [ ] **Error path test**: passGuard(isSelf true) + mock `findById` 가 `NotFoundException` throw → endpoint 404 → 전부 failures, `assertS2Threshold` pass===false + "error rate 임계 초과" 사유 포함 검증.
- [ ] **Flow / branch coverage**: controller 분기(isSelf/isAdminPlus 통과 → service 도달 vs 둘 다 false → 403) + collector 성공(2xx)/실패(non-2xx) 분기를 각각 1+ test 로 도달. Admin+ actor 가 타인 조회 시 통과(200) 분기도 별도 test 로 커버.
- [ ] **Negative cases 충분 cover** — 최소 4 종: (a) User actor 가 타인 조회(isSelf false + isAdminPlus false) → `ForbiddenException`(403) failures 분류 + `findById` 미호출(controller 가 service 도달 전 차단) 검증, (b) 존재하지 않는 id 조회 → `NotFoundException`(404) failures 분류(403 과 구분되는 non-2xx), (c) mixed 부분 실패 (N회 중 1회만 404 → `failures===1` 부분 집계 정확 + `errorRateMax:0` 로도 fail), (d) `iterations===1` 경계에서 harness 정상 동작.
- [ ] `test/perf/README.md` 의 배선 endpoint 카운트/목록을 20→21(user :id detail 추가)로 갱신 (T-0849 가 갱신한 형식 mirror).
- [ ] `pnpm test:perf` 실행 시 신규 spec 포함 전 perf-spec suite green (jest-perf.json `testRegex` 매칭 확인).
- [ ] `pnpm lint && pnpm build` green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). perf-spec 은 기본 `pnpm test` (`.spec.ts$`) 매칭 밖이라 coverage 회귀 무영향임을 확인.

## Out of Scope

- 실 DB round-trip baseline 실측 / k6 등 부하 발생기 도입 / CI perf job 상시 편입 (§5 item 3~5 별도 follow-up).
- `latency-collector.ts` / `latency-metrics.ts` 등 primitive·orchestration 순수 로직 자체 변경 — 본 spec 은 primitive 를 **호출·배선**만 한다.
- POST/PATCH 등 write route perf 배선 — 본 spec 은 detail(:id) 조회(findById)에 집중.
- `GET /api/users` list read 배선(별도 `user-read.perf-spec.ts` 이미 존재) — 본 spec 은 `:id` detail 만.
- 다른 미배선 detail(:id) endpoint(import/export/llm-config :id) 배선 — 각각 별도 slice.
- 실 JWT 발급·검증·RBAC escalation 자체 검증 — 본 spec 은 detail self/Admin 분기의 latency 배선만(인증 정책은 기존 user.controller.spec / jwt.strategy.spec / e2e).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 append)
