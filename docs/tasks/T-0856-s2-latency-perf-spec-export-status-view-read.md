---
id: T-0856
title: S2 조회 latency perf-spec 를 ExportController GET /api/admin/export/:id/status-view derived-detail read 에 배선
phase: P8
status: PENDING
commitMode: pr
coversReq: [REQ-048, REQ-030, REQ-032]
independentStream: s2-latency-harness
dependsOn: []
touchesFiles:
  - test/perf/export-status-view-read.perf-spec.ts
  - test/perf/README.md
estimatedDiff: 235
estimatedFiles: 2
created: 2026-07-09
plannerNote: "P8 load-resilience §5 #2 — S2 latency harness 27번째 perf-spec, ExportController :id/status-view derived-detail read (export-detail T-0852 mirror, guard-protected Admin)"
---

# T-0856 — S2 조회 latency perf-spec 를 ExportController GET /api/admin/export/:id/status-view derived-detail read 에 배선

## Why

[docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) §5 follow-up #2(조회 endpoint latency harness 배선)의 스물일곱 번째 slice다. T-0830~T-0855 가 26 개 조회 endpoint(list/query/self-read 14 + summary·group·assessment·person·part·contribution·user·llm-config·export·import :id detail 10 + group·part :id/persons sub-resource 2)에 collector 를 배선했다. 본 task 는 직전 T-0854/T-0855 의 Out of Scope 가 "`export/:id/status-view` 등 남은 detail 변형 배선(별도 slice)" 로 명시한 잔여 slice 로, `ExportController` 의 `GET /api/admin/export/:id/status-view`(`statusView` → `service.findJob(id)` 로 job 조회 후 `describeExportJobStatus(JOB_STATUS_TO_VIEW[job.status])` 로 사람-친화 `ExportJobStatusView` 를 200 반환 — job 부재 시 service `findJob` 의 `NotFoundException`(404)이 helper 호출 도달 전 raw propagate, controller 자체 분기 0)에 harness 를 배선한다. 앞선 detail slice 들이 raw record 를 반환한 반면 본 endpoint 는 status 를 view 로 derive 하는 **derived-detail** 경로라 harness 재사용이 순수 pass-through 뿐 아니라 조합 read 에서도 유효함을 실증한다. `@UseGuards(JwtAuthGuard, RolesGuard) @Roles("Admin")` 가 부착된 Admin-tier read 라 export-detail(T-0852) 의 guard override 패턴을 mirror 한다. REQ-048(조회 p95 < 3s) + REQ-030/032(async job 진행 view / raw stack 미노출)를 cover 한다.

## Required Reading

- [test/perf/export-detail-read.perf-spec.ts](../../test/perf/export-detail-read.perf-spec.ts) — 본 spec 의 mirror 원본(T-0852). 같은 `ExportController` + `ExportJobService` mock(`useValue`, `findJob: jest.Mock`) + `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)` useValue({canActivate:()=>true}) 무력화 + happy/404/500/mixed/n=1 분기 배선 패턴(mirror 원본 — 본 task 는 배선 대상 route 를 `:id` findJob → `:id/status-view` statusView 로 치환하고, 성공 시 반환 타입이 raw ExportJob 이 아니라 derive 된 `ExportJobStatusView` 임에 주석 반영).
- [test/perf/latency-collector.ts](../../test/perf/latency-collector.ts) — `collectLatencySamples` / `assertS2Threshold` / `RequestFn` 시그니처(호출·배선 대상, 변경 금지).
- [src/export/export.controller.ts](../../src/export/export.controller.ts) (line 414~444) — `@Get(":id/status-view") @UseGuards(JwtAuthGuard, RolesGuard) @Roles("Admin") statusView(@Param("id") id)` → `service.findJob(id)` 후 `describeExportJobStatus(JOB_STATUS_TO_VIEW[job.status])` raw forward. controller 자체 try/catch·분기 0(주석 line 422~429 참조 — job 부재 시 findJob 의 NotFoundException 이 helper 호출 전 raw propagate).
- [test/perf/README.md](../../test/perf/README.md) — perf-spec 카운트/목록 표(26 → 27 갱신 대상, 상단 목록 + 하단 endpoint 설명 둘 다).

## Acceptance Criteria

- [ ] `test/perf/export-status-view-read.perf-spec.ts` 신설 — `GET /api/admin/export/:id/status-view` 를 `collectLatencySamples`/`assertS2Threshold` 에 배선. `JwtAuthGuard`·`RolesGuard` 는 `overrideGuard(...).useValue({ canActivate: () => true })` 로 통과(export-detail T-0852 mirror), `ExportJobService` 는 `findJob: jest.fn()` mock(`useValue`)로 주입.
- [ ] **Happy-path test 1+**: mock `findJob` 가 유효 `status` 를 가진 job 반환 → 200 N회 → `total===N`, `failures===0`, `samplesMs.length===N`, `assertS2Threshold(result).pass===true`, `errorRate===0`, 그리고 `findJob` 가 요청 id 로 `toHaveBeenCalledWith` 실증(@Param raw forward). 응답 body 가 `describeExportJobStatus` derive 결과(`ExportJobStatusView`)임을 최소 1개 field(예: `terminal`/`phaseLabel`)로 확인.
- [ ] **Derived-view happy-path 분기 1+**: 서로 다른 `JobStatus`(예: 진행 중 vs terminal) mock 으로 `JOB_STATUS_TO_VIEW` 매핑 → helper derive 가 정상 200 분류됨을 각각 확인(derived-detail 고유 특성 커버). 두 status 모두 성공 latency 표본으로 집계됨을 실증.
- [ ] **Error path test 1+**: mock `findJob` 가 `NotFoundException`(job 부재) → 404 N회 → 전부 `failures`, `samplesMs.length===0`, `assertS2Threshold(result).pass===false` + "error rate 임계 초과" 사유 포함.
- [ ] **Flow / branch coverage**: controller 자체 분기 없음(findJob → helper raw forward) → 이 항목은 collector 의 성공(2xx)/실패(non-2xx) 분기를 service 반환(200) vs 예외(404·500)로 커버함을 spec 주석에 명시.
- [ ] **Negative cases 충분 cover** — 각 1+ test: (a) 존재하지 않는 export id 조회 → `NotFoundException`(404) failures 분류(2xx 아님), (b) 일반 Error → 500 응답(404 와 구분되는 non-2xx) failures 분류, (c) mixed 부분 실패(N회 중 1회만 404 → `failures===1` 부분 집계 정확성), (d) `iterations===1` 경계에서 harness 정상 동작.
- [ ] `pnpm test:perf` 통과 — 신규 spec 포함 27 suites green(`jest-perf.json` 의 `testRegex: test/perf/.*\.perf-spec\.ts$` 매칭).
- [ ] `pnpm lint && pnpm build` green.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — perf-spec 은 `.spec.ts$` 밖이라 unit coverage gate 에 회귀 무영향임을 tester 가 확인.
- [ ] `test/perf/README.md` 의 배선 endpoint 카운트/목록을 26 → 27(export :id/status-view 추가)으로 갱신, derived-detail(:id/status-view) read 명시(상단 목록 괄호 + 하단 endpoint 설명 항목 둘 다).

## Out of Scope

- 실 DB round-trip baseline 실측 / 실 Prisma / k6 등 부하 발생기 / CI perf job 상시 편입(§5 item 3~5 별도 follow-up).
- `latency-collector.ts` / `latency-metrics.ts` 등 primitive·orchestration 순수 로직 자체 변경 — 본 spec 은 primitive 를 **호출·배선**만 한다.
- `export/:id/download`(StreamableFile·@Res passthrough·buffer collection·header serialize 로 heavier mocking 필요) 배선 — 별도 slice.
- `describeExportJobStatus` / `JOB_STATUS_TO_VIEW` helper 자체 로직·입력 방어 분기(TypeError/RangeError) 단위 검증 — helper 전용 unit spec 소관(본 spec 은 정상 매핑 경로만 배선).
- POST/PATCH/DELETE write route perf 배선(본 spec 은 조회에 집중).
- 실 JWT 발급·검증·RBAC(@Roles("Admin")) escalation 자체 검증 — 본 spec 은 가드를 override 로 무력화한 뒤 latency 배선만(인증 정책은 기존 controller/service spec / roles.guard.spec / e2e).
- `ExportController.findJob`(:id detail)·`running`(list) 재배선(각각 export-detail / export-running spec 이 이미 존재) — 본 spec 은 `:id/status-view` derived-detail 만.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 append)
