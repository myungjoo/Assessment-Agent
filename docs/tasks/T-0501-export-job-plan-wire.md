---
id: T-0501
title: buildExportJobPlan helper 를 ExportJobService.previewSelection 응답 확장으로 실호출 배선 — 45 helper 배선 chain step10
phase: P7
status: DONE
mergedAs: 392e94e
prNumber: 411
reviewRounds: 1
completedAt: 2026-06-18T12:52:00Z
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 220
estimatedFiles: 4
created: 2026-06-18
independentStream: export-import-wiring
dependsOn: [T-0500]
touchesFiles:
  - src/export/export-job.service.ts
  - src/export/export-job.service.spec.ts
  - src/export/export.controller.ts
  - src/export/export.controller.spec.ts
plannerNote: "P7 helper-배선 chain step10 — buildExportJobPlan(T-0467 미호출 helper) 를 T-0500 previewSelection 의 sizeEstimate 위에 deliveryPlan 응답 확장으로 배선(mode/chunked/pollingRequired/statusFlow/instructionLines). DB write 0·신규 endpoint 0. R-112 backbone × 1.5 = ~220 LOC."
---

# T-0501 — buildExportJobPlan helper 를 previewSelection 응답 확장으로 실호출 배선 (chain step10)

## Why

P7 "45 helper(T-0437~T-0483) 실 호출 배선" 스트림의 chain step10 다. [T-0500](T-0500-export-dump-size-estimate-wire.md) (chain step9, PR #410, squash a184ad2) 가 `estimateExportDumpSize` 을 `ExportJobService.previewSelection` 응답의 `sizeEstimate` 필드로 배선해 selected record 의 예상 dump 크기(estimatedBytes/humanSize/large/recommendation('sync'|'async-streaming'))를 노출했다. 이 응답은 "이 dump 가 얼마나 크고 동기/async 중 무엇이 권고되는가"의 **판정**까지는 노출하지만, **그럼 실제로 어떻게 전달할 것인가**(즉시 동기 다운로드 vs async job 생성 후 status polling + chunked streaming)의 **실행 plan descriptor** 는 여전히 미노출이다 — UC-07 §8 NFR("대량 dump 는 long-running operation — async job + status polling + chunked streaming") + §3 trigger 1(scope confirmation dialog) + §5 step 13(Export 다운로드 완료 안내)가 요구하는 "이 dump 는 sync 다운로드인가 async job 인가, 어떤 단계를 거치는가" 안내가 빠져 있다.

이 gap 을 채우는 helper 가 이미 박제돼 있다 — `buildExportJobPlan` ([T-0467](T-0467-export-job-plan-helper.md), `src/export/export-job-plan.ts`). 입력으로 `ExportDumpSizeEstimate`(T-0466 산출, T-0500 이 응답에 노출한 그 타입) 을 받아 `{ mode('sync-download'|'async-job'), chunked, pollingRequired, statusFlow(ExportJobStatus[]), headline(한국어), instructionLines(한국어[]) }` 의 실행 plan 을 순수 합성하는 helper. `estimate.recommendation` 을 ground truth 로 사용해 mode 를 결정하고(`'sync'→sync-download`, `'async-streaming'→async-job`), `estimatedBytes > chunkThresholdBytes`(default 5MB)면 chunked streaming 을 권고한다. `git grep buildExportJobPlan -- "src/**/*.controller.ts" "src/**/*.service.ts"` 0 매칭 — 자기 spec 및 미배선 helper(`export-chunk-plan.ts` / `export-job-status-view.ts`) 외 production wiring 0 인 미호출 helper. T-0500 이 산출한 동일 `sizeEstimate`(ExportDumpSizeEstimate) 위에 자연 연결되는 다음 chain step 이다.

본 task 는 신설 endpoint 0·DB write 0 의 **응답 확장 slice** 다. `ExportJobService.previewSelection` 안에서 이미 산출된 `sizeEstimate`(ExportDumpSizeEstimate)를 그대로 `buildExportJobPlan(sizeEstimate)` 에 forward 해 delivery plan 을 derive 한 뒤, 반환 shape 을 (a) 기존 count 요약 + `summary`(T-0499) + `sizeEstimate`(T-0500) + (b) 신규 `deliveryPlan: ExportJobPlan` 결합으로 확장한다. POST `/api/admin/export/preview-selection` route 자체는 신설 0·메서드/URL/RBAC/ValidationPipe 불변 — 응답 body 만 확장된다. chunk 임계 / poll 간격은 helper default(`DEFAULT_CHUNK_THRESHOLD_BYTES` 5MB, `DEFAULT_POLL_INTERVAL_SECONDS` 3s)를 사용한다(정책 row · ENV 기반 동적 값 주입은 별도 task — §Follow-ups).

이로써 (1) 미호출 helper 1 종이 실 HTTP path 에 연결되고(REQ-030 Export scope 사람-친화 미리보기·전달 방식 안내), (2) helper 가 `sizeEstimate` derivation 만 다루고 DB read 가 [T-0497](T-0497-export-select-records-preview-wire.md)/[T-0499](T-0499-export-selection-summary-wire.md)/[T-0500](T-0500-export-dump-size-estimate-wire.md) 에서 끝났으므로 REQ-032 raw 미저장 invariant 가 자연 유지되며(estimate descriptor 만 derivation, raw payload 0·추가 DB read 0), (3) Admin 전용 RBAC(REQ-045) 가 endpoint 불변으로 동일 적용된다. step9 의 estimate 위에 plan derivation 1 layer 만 더하는 minimum-diff slice.

본 task 는 **새 endpoint 0**(POST `/preview-selection` 메서드/URL 불변), **신규 DTO 파일 0**(응답 shape 은 service interface 확장만), **DB write 0**, **새 외부 dependency / migration / auth-flow 0**.

## Required Reading

- `docs/tasks/T-0501-export-job-plan-wire.md` (본 파일)
- `src/export/export-job-plan.ts` 전체 — 호출할 순수 helper. `buildExportJobPlan(estimate: ExportDumpSizeEstimate, options?: ExportJobPlanOptions): ExportJobPlan`. 반환 shape: `{ mode('sync-download'|'async-job'), chunked: boolean, pollingRequired: boolean, statusFlow: ExportJobStatus[]('queued'|'running'|'ready'|'failed'), headline: string, instructionLines: string[] }`. **불변**: `mode === "async-job" ⟺ pollingRequired === true ⟺ statusFlow.length > 0`. mode 는 `estimate.recommendation` 을 ground truth 로 결정(`'sync'→sync-download`, `'async-streaming'→async-job`). chunked 는 `estimate.estimatedBytes > chunkThresholdBytes`(경계 === 는 초과 아님). **입력 방어**: estimate 비-plain-object → TypeError(label "estimate"), estimate.recommendation 이 sync/async-streaming 외 → RangeError, estimate.estimatedBytes 비-정수·음수·NaN·Infinity → TypeError, options 비-object → TypeError, chunkThresholdBytes/pollIntervalSeconds 부적합 → TypeError. default: `DEFAULT_CHUNK_THRESHOLD_BYTES`(5MB) / `DEFAULT_POLL_INTERVAL_SECONDS`(3). non-mutating, statusFlow/instructionLines 항상 새 배열.
- `src/export/export-job.service.ts` 전체 — 배선 위치. 특히 (a) `previewSelection(scope)` (line 253~303) 의 현재 흐름 — `collectExportRecords()` → `selectExportRecords` → `summarizeExportSelection` → `estimateExportDumpSize(selection)` → count/summary/sizeEstimate 합성. 본 task 는 그 `sizeEstimate`(이미 산출된 `ExportDumpSizeEstimate`)를 그대로 `buildExportJobPlan(sizeEstimate)` 에 forward 만 하면 된다 — 추가 순회·재계산 0(helper 가 estimate 만 derive). (b) `ExportSelectionPreview` interface (line 146~152) — 본 task 가 `deliveryPlan: ExportJobPlan` 필드 추가. (c) helper import 패턴 (line 35~36 `estimateExportDumpSize` + `type ExportDumpSizeEstimate` import) mirror.
- `src/export/export-job.service.spec.ts` 전체 — colocated spec. T-0500 `previewSelection` test 의 PrismaService mock 패턴 (5 entity `findMany` stub) mirror 해 신규 `deliveryPlan` 응답 shape 검증 추가. 신규 spec 파일 생성 금지 — colocated 우선.
- `src/export/export.controller.ts` 의 `previewSelection` endpoint (line 233~247) — service 응답을 raw forward 만 한다. 본 task 의 응답 shape 확장이 controller 분기 추가 0(service return 그대로 200 forward). type import (`ExportSelectionPreview`, line 87) 정합화만 필요.
- `src/export/export.controller.spec.ts` 의 `previewSelection` test (T-0497/T-0499/T-0500 추가분) — 신규 `deliveryPlan` 응답 shape 의 controller 측 forward 검증 1+ 추가 또는 기존 expectation 갱신.
- `docs/use-cases/UC-07.md` §8 NFR + §3 trigger 1 + §5 step 13 — sync-download vs async-job + status polling + chunked streaming plan 이 confirmation dialog / 다운로드 완료 안내에서 요구되는 의미 정합 확인.

## Acceptance Criteria

### 배선 설계 (구현 방향 — 세부는 implementer 재량, 단 helper 실호출 + 신설 endpoint 0 + DB write 0 은 의무)

- [ ] `ExportJobService.previewSelection(scope)` 의 흐름을 (1) 기존 `collectExportRecords()` + `selectExportRecords` + `summarizeExportSelection` + `estimateExportDumpSize(selection)` 호출 유지 → (2) 산출된 `sizeEstimate` 를 그대로 `buildExportJobPlan(sizeEstimate)` 실호출 → (3) helper 산출 `ExportJobPlan` 을 응답에 포함하도록 확장한다. helper 호출 위치·방식 배선 근거 주석 1 줄 박제 (UC-07 §8 NFR sync/async delivery plan + §3 trigger 1 / §5 step 13 정합 + REQ-032 derivation-only).
- [ ] `ExportSelectionPreview` 에 `deliveryPlan: ExportJobPlan` 필드 추가. helper 의 `ExportJobPlan` 타입을 그대로 surface 에 노출(service 가 `import { buildExportJobPlan, type ExportJobPlan }` 재노출). 기존 `selectedCount` / `excludedCount` / `perEntitySelected` / `summary` / `sizeEstimate` 필드 전부 불변(append-only 확장 — backward-compat).
- [ ] chunk 임계 / poll 간격은 helper default(options 미전달)로 호출한다 — 본 task 는 옵션 주입 0. 정책 row · ENV 기반 동적 값 주입은 별도 task(§Follow-ups). default 사용 근거 주석 1줄 박제.
- [ ] 새 endpoint 0 — POST `/api/admin/export/preview-selection` 의 메서드/URL/RBAC/ValidationPipe 모두 불변. controller 분기 추가 0(service return 그대로 forward — 응답 shape 만 확장).
- [ ] DB write 0 — `buildExportJobPlan` 은 입력 `ExportDumpSizeEstimate` 만 derivation 하므로 추가 Prisma 호출 0. T-0497/T-0499/T-0500 의 projection-only read(REQ-032) 정책 불변.
- [ ] scope invariant 위반 시 `selectExportRecords` 가 throw 하는 정책 그대로(plan 호출 도달 0). helper `buildExportJobPlan` 의 입력 방어 분기(RangeError/TypeError)는 `estimateExportDumpSize` 가 산출한 정상 estimate(recommendation sync/async-streaming · estimatedBytes 비-음수 정수)만 forward 되므로 정상 경로에서 미발화(주석 1줄로 박제).

### R-112 4종 충분 cover (CLAUDE.md §3.2)

- [ ] **Happy-path unit test** (service spec) — full scope / range scope / partial scope 각 1+: 분류 결과 → estimate → plan 호출 → 응답에 `deliveryPlan.mode` · `deliveryPlan.chunked` · `deliveryPlan.pollingRequired` · `deliveryPlan.statusFlow` · `deliveryPlan.headline` · `deliveryPlan.instructionLines` 가 정확히 박제됨을 검증.
- [ ] **Error path unit test** (service spec) — (a) 5 entity findMany 중 하나가 Prisma error throw 시 service 가 raw propagate 검증(plan 호출 도달 0), (b) plan 호출 자체는 정상 estimate 입력만 받으므로 helper 입력 방어 발화 0 검증(정상 흐름에서 estimate.recommendation 은 항상 sync/async-streaming · estimatedBytes 항상 비-음수 정수).
- [ ] **Flow / branch coverage** — (a) small dump (estimatedBytes ≤ async 임계 → recommendation="sync" → mode="sync-download" / pollingRequired=false / statusFlow=[]) / (b) large dump (estimatedBytes > async 임계 → recommendation="async-streaming" → mode="async-job" / pollingRequired=true / statusFlow=[queued,running,ready]) 두 분기 각 1+ test. 추가로 (c) chunk 임계 초과 → `deliveryPlan.chunked=true`, (d) chunk 임계 이하 → `chunked=false` 분기 각 1+ test. 대량 분기는 selected record 수를 충분히 stub 해 large=true 를 유발.
- [ ] **Negative cases 충분 cover** — (a) 빈 DB / 빈 selection (estimatedBytes 0 → mode="sync-download" · pollingRequired=false · statusFlow=[]), (b) chunk 임계 경계 (estimatedBytes === chunkThresholdBytes default 5MB → chunked=false — 초과 아님), (c) async 임계 경계 (estimatedBytes === async 임계 → recommendation="sync" → mode="sync-download"), (d) controller spec — 권한 부족 (User actor 403), 인증 부재 (401), forbidNonWhitelisted (CreateExportDto 외 필드 400) — 각 1+ test.
- [ ] **Controller spec** (`export.controller.spec.ts`) — service.previewSelection mock 의 반환 shape 을 `deliveryPlan` 포함으로 stub 하고 200 응답 body 에 `deliveryPlan` 이 그대로 forward 됨을 1+ test.
- [ ] **Coverage 최소치** — `pnpm test:cov` 통과 (변경 파일 line ≥ 80% AND function ≥ 80% — `package.json` `coverageThreshold.global` 강제). 신규/변경 service 분기·controller 분기 전부 spec 도달.

### 정합 / 회귀 방지

- [ ] `buildExportJobPlan` 의 import 경로는 `./export-job-plan` (같은 폴더) — 신규 alias / barrel re-export 신설 0.
- [ ] helper 결과 불변 `deliveryPlan.mode === "async-job" ⟺ deliveryPlan.pollingRequired === true ⟺ deliveryPlan.statusFlow.length > 0` 가 응답에서 유지됨을 spec 1+ 로 cross-check (helper 불변의 surface 회귀 차단 — async 분기 1 + sync 분기 1).
- [ ] `deliveryPlan.mode` 가 `sizeEstimate.recommendation` 과 1:1 대응(`'sync'→'sync-download'`, `'async-streaming'→'async-job'`)함을 spec 1+ 로 검증 (recommendation ground-truth 회귀 차단).
- [ ] 기존 `summary` / `sizeEstimate` / `selectedCount` / `excludedCount` / `perEntitySelected` 필드가 본 확장 후에도 그대로 반환됨을 spec 1+ 로 확인 (append-only 확장의 backward-compat 회귀 차단).
- [ ] `pnpm lint && pnpm build && pnpm test` 전부 green. CI workflow (`test:cov` step 포함) 도 green.

## Out of Scope

- 신규 endpoint / 새 route — 본 task 는 `POST /preview-selection` 의 응답 확장만. URL · 메서드 · RBAC · ValidationPipe 변경 0.
- DB write / 새 Prisma read — `buildExportJobPlan` 은 input(estimate) derivation 이라 추가 DB 호출 0. T-0497/T-0499/T-0500 의 projection-only `collectExportRecords` 그대로.
- chunk 임계 / poll 간격 옵션 동적 주입 — 정책 row · ENV 기반 `ExportJobPlanOptions`(chunkThresholdBytes / pollIntervalSeconds) 주입은 별도 task (§Follow-ups). 본 task 는 helper default 만.
- 실 async job 생성 / job queue / job id 발급 / status store / status polling endpoint / chunked streaming 직렬화 / resumable upload — Q-0040 범위 밖. 본 task 는 plan descriptor 안내만(REQ-030/REQ-032 범위). 실 job lifecycle 은 P5 service layer(별도 task).
- `buildExportResult` · `planExportChunks`(export-chunk-plan.ts) 배선 — 다음 chain step 들 (별도 task, §Follow-ups).
- helper(`buildExportJobPlan`) 구현 변경 — T-0467 helper 본문 (`src/export/export-job-plan.ts`) 은 건드리지 않는다. service 가 `ExportJobPlan` interface 를 그대로 surface 에 노출하면 된다.
- 새 DTO 파일 / response DTO class — 응답 shape 은 service interface 확장만. `class-validator` 검증은 request 측 `CreateExportDto` 만, response 는 plain interface.
- ADR-0044 본문 변경 / 새 ADR — 본 task 는 코드만. job plan helper 는 신규 architectural 결정 0(default 상수는 helper 내 박제됨).
- `api.md` 의 `POST /api/admin/export/preview-selection` 응답 shape `deliveryPlan` 정합 갱신 — 별도 doc-sync direct task (§Follow-ups).
- `ImportJobService` 대칭 배선 — import 측 별도 chain (별도 task).
- 새 외부 dependency / credential / 새 module 등록 — 0.

## Suggested Sub-agents

`implementer → tester` (service 분기 1줄 + 응답 shape 1 필드 확장 + colocated spec 추가. architect 호출 불요 — helper 는 박제됐고 default 상수는 helper 내 정의됨, 새 architectural 결정 0.)

## Follow-ups

(생성 시점 비어 있음. sub-agent 가 관련 작업 발견 시 append — 예:
- **다음 code slice (chain step11)**: `buildExportResult` 또는 `planExportChunks`(export-chunk-plan.ts) → `previewSelection` 결과(selection + summary + sizeEstimate + deliveryPlan) 위에 chunk plan / result 합성 배선 (pr-mode). 본 task 의 deliveryPlan 위에 자연 연결.
- `ExportJobPlanOptions`(chunk 임계 / poll 간격) 동적 주입 — 정책 row · ENV 기반 (별도 task).
- api.md §5 의 `POST /api/admin/export/preview-selection` 응답 shape `deliveryPlan` 정합 갱신 (별도 doc-sync direct task).
- `ImportJobService` 측 대칭 — import plan helper 실호출 배선 (별도 chain).)
