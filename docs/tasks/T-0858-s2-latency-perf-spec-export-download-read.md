---
id: T-0858
title: S2 조회 latency harness 를 ExportController :id/download artifact-stream read 에 배선하는 스물아홉 번째 perf-spec 신설
phase: P8
status: DONE
commitMode: pr
prNumber: 752
mergedAs: db091913
reviewRounds: 1
coversReq: [REQ-048, REQ-030, REQ-032, REQ-045]
estimatedDiff: 300
estimatedFiles: 1
created: 2026-07-09
independentStream: s2-latency-harness
dependsOn: []
touchesFiles: [test/perf/export-download-read.perf-spec.ts]
plannerNote: "P8 S2 latency backlog(§5 follow-up #2) — 29번째 slice: ExportController GET :id/download artifact-stream(StreamableFile) read 배선. T-0857 mirror + 첫 dual-service-call(findJob+materialize) read."
---

# T-0858 — S2 조회 latency harness 를 ExportController :id/download artifact-stream read 에 배선하는 스물아홉 번째 perf-spec 신설

## Why

P8 load-resilience-test-plan §5 follow-up #2(S2 조회 latency harness backlog)의 **스물아홉 번째 slice**다. 지금까지 28개 조회 endpoint(list/query/self-read 14 + :id detail 10 + group·part :id/persons 2 + export :id/status-view derived-detail 1 + import /modes derived-list 1)에 latency collector 를 배선했다. 다음 미배선 read 로 `ExportController` 의 **artifact-stream sub-resource read** 인 `GET /api/admin/export/:id/download`(`download` 핸들러 — `findJob(id)` 로 job 조회 → `buildScopePayload` 로 scope 합성 → `materializeFullExportDownload(scope)` 로 `Readable` 획득 → `collectStream` 으로 Buffer 화 → download header set 후 `StreamableFile` 200 반환)을 배선한다. 이는 **collector 가 단건 detail·derived read 뿐 아니라 두 개의 service 호출을 연쇄하고 StreamableFile(byte body)을 흘려보내는 artifact-stream read 에서도 유효함**을 실증하는 첫 slice다(REQ-048 조회 p95 < 3s, REQ-030 Export, REQ-032 raw 미저장·미노출, REQ-045 Admin 전용).

## Required Reading

- `test/perf/export-status-view-read.perf-spec.ts` — 가장 가까운 sibling(같은 `ExportController` + 같은 `MockExportJobService` 5-메서드 mock shape + `overrideGuard` passGuard 패턴). 본 spec 의 mirror base.
- `test/perf/import-modes-read.perf-spec.ts` — 직전 slice(T-0857). error-path·negative (a)~(d) 구조·주석 톤 참조.
- `test/perf/latency-collector.ts` — `collectLatencySamples`, `assertS2Threshold`, `RequestFn` 시그니처(변경 금지 — 호출·배선만).
- `src/export/export.controller.ts` (line 375~412) — `download` 핸들러 실동작(findJob + materializeFullExportDownload 연쇄 → StreamableFile). 배선 대상.
- `test/perf/jest-perf.json` — `testRegex: test/perf/.*\.perf-spec\.ts$` 매칭 확인(신설 spec 이 `pnpm test:perf` 로만 실행됨).

## Acceptance Criteria

- [ ] `test/perf/export-download-read.perf-spec.ts` 1개 파일 신설. `ExportController` 를 `Test.createTestingModule` 로 부트스트랩하고 `ExportJobService` 를 `useValue` mock(sibling 과 동일한 5-메서드 shape: `findRunning`/`createJob`/`findJob`/`previewSelection`/`materializeFullExportDownload`)으로 주입. `JwtAuthGuard`/`RolesGuard` 는 `overrideGuard(...).useValue({ canActivate: () => true })` 로 통과.
- [ ] **Happy-path test 1+**: `download` 핸들러가 정상 200(`findJob` mockResolvedValue(job) + `materializeFullExportDownload` mockResolvedValue(Readable.from(...)))을 N회 반환할 때 `collectLatencySamples` 가 `total===N`, `failures===0`, `samplesMs.length===N`, `assertS2Threshold(...).pass===true`, `errorRate===0` 임을 검증. 별도 test 1개로 실 응답 body(StreamableFile byte body)와 download header(Content-Type/Content-Disposition/Content-Length) 존재 및 `findJob`+`materializeFullExportDownload` 실호출을 확인.
- [ ] **Error path test 1+**: `findJob` 이 `NotFoundException`(404) reject → non-2xx 로 분류돼 `failures` 집계, `samplesMs.length===0`, `assertS2Threshold(...).pass===false` + `errorRate 임계 초과` 사유. 추가로 `materializeFullExportDownload` reject(의존성 실패, 500) 경로도 non-2xx failures 로 커버(dual-service-call 두 실패 지점 각각 1+).
- [ ] **Flow / branch cover**: collector 의 성공(2xx)/실패(non-2xx) 분기를 각각 도달. `download` 는 controller 자체 client 입력 분기가 없으므로(findJob→materialize raw forward) 실 응답(200) vs mock reject(404/500)로 두 분기를 커버하고, 그 사실을 주석에 명시.
- [ ] **Negative cases 충분 cover**(예외 상황 분기마다 1+): (a) 요청 wrapper 가 403(권한 거부 성격 non-2xx) 반환 → failures 분류·samplesMs 미집계; (b) mixed 부분 실패 — N회 중 1회만 non-2xx → `failures===1` 부분 집계 정확성 + `errorRateMax:0` 로도 fail; (c) `iterations===1` 경계 → 단일 download 조회로도 harness 정상 동작; (d) 요청 wrapper 가 body 없이 status 200 만 반환해도 harness 는 성공 집계(collector 성공 판정이 stream body shape 에 독립임 실증).
- [ ] `pnpm lint && pnpm build && pnpm test:perf` 통과 — 신설 spec 포함 전체 perf-spec(29 suites) green.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — perf-spec 은 collector/controller 를 호출만 하므로 무회귀.

## Out of Scope

- 실 DB round-trip baseline 실측 / k6 등 부하 발생기 / CI perf job 상시 편입 / collector·assert 순수 로직 자체 변경 — 본 spec 은 primitive 를 **호출·배선**만 한다.
- `materializeFullExportDownload`/`buildExportArtifactDescriptor`/`serializeExportDownloadHeaders`/`collectStream` helper 자체 로직·직렬화 포맷 단위 검증 — helper 전용 unit spec / controller unit spec 소관. 본 spec 은 정상 stream derive 경로만 배선한다.
- `ExportController.findJob`(:id detail)·`statusView`(:id/status-view)·`findRunning`(running) 재배선 — 본 spec 은 `:id/download` artifact-stream read 만.
- POST/PATCH/DELETE write route perf 배선 — 본 spec 은 조회에 집중(write-route latency 는 별도 후속 slice).
- 실 JWT 발급·검증·RBAC(@Roles("Admin")) escalation 자체 검증 — 본 spec 은 가드를 override 로 무력화한 뒤 latency 배선만(인증 정책은 기존 controller/service spec / roles.guard.spec / e2e).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 추가)
