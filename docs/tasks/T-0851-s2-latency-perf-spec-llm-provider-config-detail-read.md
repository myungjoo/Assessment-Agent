---
id: T-0851
title: S2 조회 latency harness 를 LlmProviderConfigController :id detail-read 에 배선하는 스물두 번째 perf-spec 신설
phase: P8
status: PENDING
commitMode: pr
coversReq: [REQ-048, REQ-096]
independentStream: s2-latency-perf-wiring
dependsOn: []
touchesFiles: [test/perf/llm-provider-config-detail-read.perf-spec.ts, test/perf/README.md]
estimatedDiff: 260
estimatedFiles: 2
created: 2026-07-09
plannerNote: "P8 load-resilience §5 follow-up (S2 latency harness) — T-0850(user :id) 다음 detail(:id) slice, LlmProviderConfigController GET /api/llm/providers/:id findById 배선 (여덟 번째 :id detail, Admin 가드 → assessment-detail overrideGuard mirror)"
---

# T-0851 — S2 조회 latency harness 를 LlmProviderConfigController :id detail-read 에 배선하는 스물두 번째 perf-spec 신설

## Why

[docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) §5 follow-up (S2 조회 latency 경량 harness) 의 endpoint 배선 backlog 를 한 slice 더 진행한다. T-0828/T-0829 가 신설한 latency primitive/collector 를, T-0830~T-0850 이 21 개 조회 endpoint(list/query/self-read 14 + summary·group·assessment·person·part·contribution·user :id detail 7)에 배선했다. 본 task 는 **스물두 번째 slice** 로 `LlmProviderConfigController` 의 detail(:id) read `GET /api/llm/providers/:id` (`findById` 핸들러 — `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` Admin+ tier, `service.findById(id)` → row 부재 시 service 가 `NotFoundException`(404) 변환, 정상 시 apiKey 제거된 `LlmProviderConfigView`(200)) 에 collector 를 배선한다. 앞선 detail slice 와의 차이: user :id 는 controller 자체 403 분기였던 반면, 본 endpoint 는 **가드 부착 Admin :id detail** 이라 T-0846(assessment-detail) 의 `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)` 무력화 + `findById` mock 패턴을 mirror 한다(req.user 박제 불요 — controller 자체 authorization 분기 없음, RolesGuard 가 가드하는 것을 override 로 통과). REQ-048 (조회·시각화 3초 이내, `perf` 검증) + REQ-096 (Admin LLM provider 가시성) 을 back 한다.

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) — §5 follow-up 인덱스, S2 시나리오·임계 (p95 < 3s, error rate < 1%).
- [test/perf/assessment-detail-read.perf-spec.ts](../../test/perf/assessment-detail-read.perf-spec.ts) — 가드 부착 :id detail 의 `overrideGuard(...)` + `findById` mock + 404 분기 배선 패턴 (mirror 대상). 단 assessment 는 JwtAuthGuard/RolesGuard 조합이 아닐 수 있으니 실제 override 대상 가드는 아래 controller Required Reading 으로 확정.
- [test/perf/llm-provider-config-read.perf-spec.ts](../../test/perf/llm-provider-config-read.perf-spec.ts) — 같은 controller 의 list(findAll) 배선 spec. 부트스트랩·guard override·mock service shape 참고(단 본 task 는 `findById` 만 mock 호출 검증).
- [test/perf/latency-collector.ts](../../test/perf/latency-collector.ts) — `collectLatencySamples` / `assertS2Threshold` / `RequestFn` 시그니처.
- [src/llm/llm-provider-config.controller.ts](../../src/llm/llm-provider-config.controller.ts) — `@Get(":id") @UseGuards(JwtAuthGuard, RolesGuard) @Roles("Admin") findById(@Param("id") id)` 핸들러 (line 106~110). controller 자체 분기 없음 — `service.findById(id)` raw forward.
- [src/llm/llm-provider-config.service.ts](../../src/llm/llm-provider-config.service.ts) — `findById` 시그니처·반환 view shape(apiKey 제거) + null → `NotFoundException`(404) 변환 위치 확인 (mock 이 재현할 정상/예외 동작 정의).

## Acceptance Criteria

- [ ] `test/perf/llm-provider-config-detail-read.perf-spec.ts` 신설. `LlmProviderConfigController` 를 부트스트랩하고 `LlmProviderConfigService` 를 mock(`useValue`) 으로 주입, 부착된 가드(`JwtAuthGuard`·`RolesGuard`)를 `overrideGuard(...).useValue({ canActivate: () => true })` 로 무력화(assessment-detail 및 sibling list spec 패턴). mock service 는 `findById` 를 포함한 `jest.fn` 들을 갖되 detail 경로는 `findById` 만 호출.
- [ ] **Happy-path test**: 가드 통과 + mock `findById` 가 단일 `LlmProviderConfigView`(apiKey 미노출) 반환 → 200 N회 → `total===N`, `failures===0`, `samplesMs.length===N`, `assertS2Threshold(result).pass===true`, `errorRate===0`, `service.findById` 가 N회 요청 `id` 로 호출됨 검증. 응답 body 에 `apiKey` 미노출(view whitelist) 도 1 test 로 검증.
- [ ] **Error path test**: 가드 통과 + mock `findById` 가 `NotFoundException` throw → endpoint 404 → 전부 failures, `assertS2Threshold` pass===false + "error rate 임계 초과" 사유 포함 검증.
- [ ] **Flow / branch coverage**: collector 성공(2xx)/실패(non-2xx) 분기를 각각 1+ test 로 도달. controller 자체 분기가 없으므로(raw forward) "분기 없음 — controller 는 service 결과 forward 만" 을 spec 주석에 명시하고 service 반환(200)/예외(404·500) 로 collector 분기를 커버.
- [ ] **Negative cases 충분 cover** — 최소 4 종: (a) 존재하지 않는 id 조회 → mock `findById` 가 `NotFoundException`(404) throw → failures 분류(2xx 아님) 검증, (b) mock `findById` 가 일반 Error throw → endpoint 500 → failures 분류(404 와 구분되는 non-2xx) 검증, (c) mixed 부분 실패 (N회 중 1회만 404 → `failures===1` 부분 집계 정확 + `errorRateMax:0` 로도 fail) 검증, (d) `iterations===1` 경계에서 harness 정상 동작 검증.
- [ ] `test/perf/README.md` 의 배선 endpoint 카운트/목록을 21→22(llm-provider-config :id detail 추가)로 갱신 (T-0850 이 갱신한 형식 mirror — 상단 목록 괄호 + 하단 endpoint 설명 항목 둘 다).
- [ ] `pnpm test:perf` 실행 시 신규 spec 포함 전 perf-spec suite green (jest-perf.json `testRegex` 매칭 확인).
- [ ] `pnpm lint && pnpm build` green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). perf-spec 은 기본 `pnpm test` (`.spec.ts$`) 매칭 밖이라 coverage 회귀 무영향임을 확인.

## Out of Scope

- 실 DB round-trip baseline 실측 / k6 등 부하 발생기 도입 / CI perf job 상시 편입 (§5 item 3~5 별도 follow-up).
- `latency-collector.ts` / `latency-metrics.ts` 등 primitive·orchestration 순수 로직 자체 변경 — 본 spec 은 primitive 를 **호출·배선**만 한다.
- POST/PATCH/DELETE 등 write route perf 배선 — 본 spec 은 detail(:id) 조회(findById)에 집중.
- `GET /api/llm/providers` list read 배선(별도 `llm-provider-config-read.perf-spec.ts` 이미 존재) — 본 spec 은 `:id` detail 만.
- 다른 미배선 detail(:id) endpoint(import/export :id) 배선 — 각각 별도 slice.
- 실 JWT 발급·검증·RBAC(@Roles("Admin")) escalation 자체 검증 — 본 spec 은 가드를 override 로 무력화한 뒤 detail latency 배선만(인증 정책은 기존 controller.spec / roles.guard.spec / e2e).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 append)
