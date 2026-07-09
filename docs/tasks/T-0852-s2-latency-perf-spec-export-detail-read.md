---
id: T-0852
title: S2 조회 latency harness 를 ExportController :id detail-read 에 배선하는 스물세 번째 perf-spec 신설
phase: P8
status: DONE
completedAt: 2026-07-09T06:58:00Z
mergedAs: ffddffc2
prNumber: 746
reviewRounds: 1
commitMode: pr
coversReq: [REQ-048, REQ-096]
independentStream: s2-latency-perf-wiring
dependsOn: []
touchesFiles: [test/perf/export-detail-read.perf-spec.ts, test/perf/README.md]
estimatedDiff: 270
estimatedFiles: 2
created: 2026-07-09
plannerNote: "P8 load-resilience §5 follow-up (S2 latency harness) — T-0851(llm-provider :id) 다음 detail(:id) slice, ExportController GET /api/admin/export/:id findJob 배선 (아홉 번째 :id detail, Admin 가드 → llm-provider/assessment-detail overrideGuard mirror, T-0851 Out-of-Scope 가 명시한 export :id slice)"
---

# T-0852 — S2 조회 latency harness 를 ExportController :id detail-read 에 배선하는 스물세 번째 perf-spec 신설

## Why

[docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) §5 follow-up (S2 조회 latency 경량 harness) 의 endpoint 배선 backlog 를 한 slice 더 진행한다. T-0828/T-0829 가 신설한 latency primitive/collector 를, T-0830~T-0851 이 22 개 조회 endpoint(list/query/self-read 14 + summary·group·assessment·person·part·contribution·user·llm-provider-config :id detail 8)에 배선했다. 본 task 는 **스물세 번째 slice** 로 `ExportController` 의 detail(:id) read `GET /api/admin/export/:id` (`findJob` 핸들러 — `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` Admin+ tier, `service.findJob(id)` → row 부재 시 service 가 `NotFoundException`(404) raw propagate, 정상 시 단건 `ExportJob`(200)) 에 collector 를 배선한다. controller 자체 분기 없음(`service.findJob(id)` raw forward). 앞선 llm-provider-config :id(T-0851)·assessment-detail(T-0846) 과 동형인 **가드 부착 Admin :id detail** 이라 `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)` 무력화 + `findJob` mock 패턴을 mirror 하고, 같은 export 모듈의 sibling spec [test/perf/export-running-read.perf-spec.ts](../../test/perf/export-running-read.perf-spec.ts) 의 부트스트랩(ExportController + `ExportJobService` mock 단일 주입)을 재사용한다(req.user 박제 불요 — controller 자체 authorization 분기 없음). T-0851 Out of Scope 가 "다른 미배선 detail(:id) endpoint(import/export :id) 배선 — 각각 별도 slice" 로 명시한 잔여 export :id slice 다. REQ-048 (조회·시각화 3초 이내, `perf` 검증) + REQ-096 (Admin export/import 가시성) 을 back 한다.

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) — §5 follow-up 인덱스, S2 시나리오·임계 (p95 < 3s, error rate < 1%).
- [test/perf/llm-provider-config-detail-read.perf-spec.ts](../../test/perf/llm-provider-config-detail-read.perf-spec.ts) — 직전 slice (T-0851). 가드 부착 Admin :id detail 의 `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)` + `findById` mock + 404/500 분기 배선 패턴 (mirror 대상 — 본 task 는 `findById`→`findJob` 치환).
- [test/perf/export-running-read.perf-spec.ts](../../test/perf/export-running-read.perf-spec.ts) — 같은 export 모듈 sibling spec. ExportController 부트스트랩 + `ExportJobService` mock(`useValue`) shape + overrideGuard 재사용 참고. mock type 에 이미 `findJob: jest.Mock` 이 선언돼 있음 — 본 spec 은 `findJob` 만 호출 검증.
- [test/perf/latency-collector.ts](../../test/perf/latency-collector.ts) — `collectLatencySamples` / `assertS2Threshold` / `RequestFn` 시그니처.
- [src/export/export.controller.ts](../../src/export/export.controller.ts) — `@Get(":id") @UseGuards(JwtAuthGuard, RolesGuard) @Roles("Admin") async findJob(@Param("id") id)` 핸들러 (line 451~455). controller 자체 분기 없음 — `service.findJob(id)` raw forward. 라우트 선언 순서(running·:id/download·:id/status-view 가 :id 보다 먼저)는 본 spec 과 무관(단건 :id 만 직접 호출).
- [src/export/export-job.service.ts](../../src/export/export-job.service.ts) — `findJob` 시그니처·반환 `ExportJob` shape + row 부재 시 P2025 → `NotFoundException`(404) 변환 위치 확인 (mock 이 재현할 정상/예외 동작 정의).

## Acceptance Criteria

- [ ] `test/perf/export-detail-read.perf-spec.ts` 신설. `ExportController` 를 부트스트랩하고 `ExportJobService` 를 mock(`useValue`) 으로 주입, 부착된 가드(`JwtAuthGuard`·`RolesGuard`)를 `overrideGuard(...).useValue({ canActivate: () => true })` 로 무력화(llm-provider-config-detail 및 sibling export-running spec 패턴). mock service 는 `findJob` 을 포함한 `jest.fn` 들을 갖되 detail 경로는 `findJob` 만 호출.
- [ ] **Happy-path test**: 가드 통과 + mock `findJob` 이 단일 `ExportJob` 반환 → 200 N회 → `total===N`, `failures===0`, `samplesMs.length===N`, `assertS2Threshold(result).pass===true`, `errorRate===0`, `service.findJob` 이 N회 요청 `id` 로 호출됨 검증.
- [ ] **Error path test**: 가드 통과 + mock `findJob` 이 `NotFoundException` throw → endpoint 404 → 전부 failures, `assertS2Threshold` pass===false + "error rate 임계 초과" 사유 포함 검증.
- [ ] **Flow / branch coverage**: collector 성공(2xx)/실패(non-2xx) 분기를 각각 1+ test 로 도달. controller 자체 분기가 없으므로(raw forward) "분기 없음 — controller 는 service 결과 forward 만" 을 spec 주석에 명시하고 service 반환(200)/예외(404·500) 로 collector 분기를 커버.
- [ ] **Negative cases 충분 cover** — 최소 4 종: (a) 존재하지 않는 id 조회 → mock `findJob` 이 `NotFoundException`(404) throw → failures 분류(2xx 아님) 검증, (b) mock `findJob` 이 일반 Error throw → endpoint 500 → failures 분류(404 와 구분되는 non-2xx) 검증, (c) mixed 부분 실패 (N회 중 1회만 404 → `failures===1` 부분 집계 정확 + `errorRateMax:0` 로도 fail) 검증, (d) `iterations===1` 경계에서 harness 정상 동작 검증.
- [ ] `test/perf/README.md` 의 배선 endpoint 카운트/목록을 22→23(export :id detail 추가)로 갱신 (T-0851 이 갱신한 형식 mirror — 상단 목록 괄호 + 하단 endpoint 설명 항목 둘 다).
- [ ] `pnpm test:perf` 실행 시 신규 spec 포함 전 perf-spec suite green (jest-perf.json `testRegex` 매칭 확인).
- [ ] `pnpm lint && pnpm build` green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). perf-spec 은 기본 `pnpm test` (`.spec.ts$`) 매칭 밖이라 coverage 회귀 무영향임을 확인.

## Out of Scope

- 실 DB round-trip baseline 실측 / k6 등 부하 발생기 도입 / CI perf job 상시 편입 (§5 item 3~5 별도 follow-up).
- `latency-collector.ts` / `latency-metrics.ts` 등 primitive·orchestration 순수 로직 자체 변경 — 본 spec 은 primitive 를 **호출·배선**만 한다.
- POST/PATCH/DELETE 등 write route perf 배선 — 본 spec 은 detail(:id) 조회(findJob)에 집중.
- `GET /api/admin/export/running` list read 배선(별도 `export-running-read.perf-spec.ts` 이미 존재) — 본 spec 은 `:id` detail 만.
- `GET /api/admin/export/:id/download` · `:id/status-view` 등 파생 detail route 배선 — 본 spec 은 순수 `:id` findJob 만(다른 route 는 필요 시 별도 slice).
- 다른 미배선 detail(:id) endpoint(import :id) 배선 — 별도 slice (import.controller findJob).
- 실 JWT 발급·검증·RBAC(@Roles("Admin")) escalation 자체 검증 — 본 spec 은 가드를 override 로 무력화한 뒤 detail latency 배선만(인증 정책은 기존 controller.spec / roles.guard.spec / e2e).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 append)
