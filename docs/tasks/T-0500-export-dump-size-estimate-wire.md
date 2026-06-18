---
id: T-0500
title: estimateExportDumpSize helper 를 ExportJobService.previewSelection 응답 확장으로 실호출 배선 — 45 helper 배선 chain step9
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 220
estimatedFiles: 4
created: 2026-06-18
independentStream: export-import-wiring
dependsOn: [T-0499]
touchesFiles:
  - src/export/export-job.service.ts
  - src/export/export-job.service.spec.ts
  - src/export/export.controller.ts
  - src/export/export.controller.spec.ts
plannerNote: "P7 helper-배선 chain step9 — estimateExportDumpSize(T-0466 미호출 helper) 를 T-0499 previewSelection 의 ExportSelection 위에 sizeEstimate 응답 확장으로 배선(estimatedBytes/humanSize/large/recommendation/guidanceLines). DB write 0·신규 endpoint 0. R-112 backbone × 1.5 = ~220 LOC."
---

# T-0500 — estimateExportDumpSize helper 를 previewSelection 응답 확장으로 실호출 배선 (chain step9)

## Why

P7 "45 helper(T-0437~T-0483) 실 호출 배선" 스트림의 chain step9 다. [T-0499](T-0499-export-selection-summary-wire.md) (chain step8) 가 `summarizeExportSelection` 을 `ExportJobService.previewSelection` 응답의 `summary` 필드로 배선해 selected/excluded 두 그룹의 breakdown(total / perEntity / instantRange)을 노출했다. 이 응답은 "내가 무엇을 내보내는가"의 **구성**은 보여주지만, **예상 다운로드 규모(byte)와 대량 dump 시 async/streaming 권고**는 여전히 미노출이다 — UC-07 §8 NFR("본 UC 의 응답 시간은 dump size 에 비례. read 한정 SLA[REQ-048]의 3 초는 일반적 dump 에 적용, 대량 dump 는 long-running operation — async job + status polling + chunked streaming") + §3 trigger 1(scope 옵션 confirmation dialog) + §5 step 2(scope 옵션 확인)가 요구하는 "이 scope 면 예상 규모가 얼마이고 동기 다운로드인가 대량인가" 안내가 빠져 있다.

이 gap 을 채우는 helper 가 이미 박제돼 있다 — `estimateExportDumpSize` ([T-0466](T-0466-export-dump-size-estimate-helper.md), `src/export/export-dump-size-estimate.ts`). 입력으로 `ExportSelection`(selected/excluded 두 배열) 을 받아 selected record 를 entity-별 byte weight 로 추정해 `{ estimatedBytes, humanSize, recordTotal, perEntityBytes(5 entity 0-init), large, recommendation('sync'|'async-streaming'), guidanceLines(한국어) }` 을 산출하는 순수 helper. `git grep estimateExportDumpSize -- "src/**/*.controller.ts" "src/**/*.service.ts"` 0 매칭 — 자기 spec 및 미배선 helper(`export-chunk-plan.ts` / `export-job-plan.ts`) 외 production wiring 0 인 미호출 helper. T-0499 가 산출한 동일 `selection`(ExportSelection) 위에 자연 연결되는 다음 chain step 이다.

본 task 는 신설 endpoint 0·DB write 0 의 **응답 확장 slice** 다. `ExportJobService.previewSelection` 안에서 이미 산출된 `selection`(ExportSelection)을 그대로 `estimateExportDumpSize(selection)` 에 forward 해 dump size estimate 를 derive 한 뒤, 반환 shape 을 (a) 기존 count 요약 + `summary`(T-0499) + (b) 신규 `sizeEstimate: ExportDumpSizeEstimate` 결합으로 확장한다. POST `/api/admin/export/preview-selection` route 자체는 신설 0·메서드/URL/RBAC/ValidationPipe 불변 — 응답 body 만 확장된다. byte weight / async 임계는 helper default(`DEFAULT_BYTES_PER_RECORD` 1KB, `DEFAULT_ASYNC_THRESHOLD_BYTES` 10MB)를 사용한다(정책 row · ENV 기반 동적 값 주입은 별도 task — §Follow-ups).

이로써 (1) 미호출 helper 1 종이 실 HTTP path 에 연결되고(REQ-030 Export scope 사람-친화 미리보기·규모 안내), (2) helper 가 selection 자체만 다루고 DB read 가 [T-0499](T-0499-export-selection-summary-wire.md)/[T-0497](T-0497-export-select-records-preview-wire.md) 에서 끝났으므로 REQ-032 raw 미저장 invariant 가 자연 유지되며(record count·추정 byte 만 노출, raw payload 0), (3) Admin 전용 RBAC(REQ-045) 가 endpoint 불변으로 동일 적용된다. step8 의 derivation 위에 estimate derivation 1 layer 만 더하는 minimum-diff slice.

본 task 는 **새 endpoint 0**(POST `/preview-selection` 메서드/URL 불변), **신규 DTO 파일 0**(응답 shape 은 service interface 확장만), **DB write 0**, **새 외부 dependency / migration / auth-flow 0**.

## Required Reading

- `docs/tasks/T-0500-export-dump-size-estimate-wire.md` (본 파일)
- `src/export/export-dump-size-estimate.ts` 전체 — 호출할 순수 helper. `estimateExportDumpSize(selection: ExportSelection, options?: ExportDumpSizeEstimateOptions): ExportDumpSizeEstimate`. 반환 shape: `{ estimatedBytes, humanSize, recordTotal, perEntityBytes(Record<ExportEntity,number> 5 key), large(estimatedBytes > asyncThresholdBytes), recommendation('sync'|'async-streaming'), guidanceLines(string[]) }`. 불변: `large === (recommendation === "async-streaming")`. **입력 방어**: selection 비-plain-object → TypeError(label "selection"), selection.selected 비-배열 → TypeError(label "selection.selected"), options 비-object → TypeError, bytesPerRecord / defaultBytesPerRecord / asyncThresholdBytes 부적합 → TypeError. 빈 selection → estimatedBytes 0 / "0 B" / sync. default: `DEFAULT_BYTES_PER_RECORD`(1024) / `DEFAULT_ASYNC_THRESHOLD_BYTES`(10MB). non-mutating.
- `src/export/export-job.service.ts` 전체 — 배선 위치. 특히 (a) `previewSelection(scope)` (line 242~281) 의 현재 흐름 — `collectExportRecords()` → `selectExportRecords(scope, records)` → `summarizeExportSelection(selection)` → count/summary 합성. 본 task 는 그 `selection` 을 그대로 `estimateExportDumpSize(selection)` 에 forward 만 하면 된다 — 추가 순회 0(helper 가 self-집계). (b) `ExportSelectionPreview` interface (line 136~141) — 본 task 가 `sizeEstimate: ExportDumpSizeEstimate` 필드 추가. (c) helper import 패턴 (line 44~45 `summarizeExportSelection` import) mirror.
- `src/export/export-job.service.spec.ts` 전체 — colocated spec. T-0499 `previewSelection` test 의 PrismaService mock 패턴 (5 entity `findMany` stub) mirror 해 신규 `sizeEstimate` 응답 shape 검증 추가. 신규 spec 파일 생성 금지 — colocated 우선.
- `src/export/export.controller.ts` 의 `previewSelection` endpoint (line 233~248) — service 응답을 raw forward 만 한다. 본 task 의 응답 shape 확장이 controller 분기 추가 0(service return 그대로 200 forward). type import (`ExportSelectionPreview`) 정합화만 필요.
- `src/export/export.controller.spec.ts` 의 `previewSelection` test (T-0497/T-0499 추가분) — 신규 `sizeEstimate` 응답 shape 의 controller 측 forward 검증 1+ 추가 또는 기존 expectation 갱신.
- `docs/use-cases/UC-07.md` §8 NFR + §3 trigger 1 + §5 step 2 — dump size estimate / async-streaming 권고가 confirmation dialog 에서 요구되는 의미 정합 확인.

## Acceptance Criteria

### 배선 설계 (구현 방향 — 세부는 implementer 재량, 단 helper 실호출 + 신설 endpoint 0 + DB write 0 은 의무)

- [ ] `ExportJobService.previewSelection(scope)` 의 흐름을 (1) 기존 `collectExportRecords()` + `selectExportRecords` + `summarizeExportSelection` 호출 유지 → (2) 동일 `selection` 을 그대로 `estimateExportDumpSize(selection)` 실호출 → (3) helper 산출 `ExportDumpSizeEstimate` 를 응답에 포함하도록 확장한다. helper 호출 위치·방식 배선 근거 주석 1 줄 박제 (UC-07 §8 NFR / §3 trigger 1 size·async 안내 정합 + REQ-032 derivation-only).
- [ ] `ExportSelectionPreview` 에 `sizeEstimate: ExportDumpSizeEstimate` 필드 추가. helper 의 `ExportDumpSizeEstimate` 타입을 그대로 surface 에 노출(service 가 `import { ... type ExportDumpSizeEstimate }` 재노출). 기존 `selectedCount` / `excludedCount` / `perEntitySelected` / `summary` 필드 전부 불변(append-only 확장 — backward-compat).
- [ ] byte weight / async 임계는 helper default(options 미전달)로 호출한다 — 본 task 는 옵션 주입 0. 정책 row · ENV 기반 동적 값 주입은 별도 task(§Follow-ups). default 사용 근거 주석 1줄 박제.
- [ ] 새 endpoint 0 — POST `/api/admin/export/preview-selection` 의 메서드/URL/RBAC/ValidationPipe 모두 불변. controller 분기 추가 0(service return 그대로 forward — 응답 shape 만 확장).
- [ ] DB write 0 — `estimateExportDumpSize` 는 입력 `ExportSelection` 만 derivation 하므로 추가 Prisma 호출 0. T-0497/T-0499 의 projection-only read(REQ-032) 정책 불변.
- [ ] scope invariant 위반 시 `selectExportRecords` 가 throw 하는 정책 그대로(estimate 호출 도달 0). helper `estimateExportDumpSize` 의 입력 방어 분기는 `selectExportRecords` 통과 selection 만 forward 되므로 정상 경로에서 미발화(주석 1줄로 박제).

### R-112 4종 충분 cover (CLAUDE.md §3.2)

- [ ] **Happy-path unit test** (service spec) — full scope / range scope / partial scope 각 1+: 분류 결과 → estimate 호출 → 응답에 `sizeEstimate.estimatedBytes` · `sizeEstimate.humanSize` · `sizeEstimate.recordTotal` · `sizeEstimate.perEntityBytes`(5 key 전부) · `sizeEstimate.large` · `sizeEstimate.recommendation` · `sizeEstimate.guidanceLines` 가 정확히 박제됨을 검증.
- [ ] **Error path unit test** (service spec) — (a) 5 entity findMany 중 하나가 Prisma error throw 시 service 가 raw propagate 검증(estimate 호출 도달 0), (b) estimate 호출 자체는 정상 selection 입력만 받으므로 helper 입력 방어 발화 0 검증(정상 흐름에서 selection.selected 가 항상 ExportRecord[] 배열).
- [ ] **Flow / branch coverage** — (a) small dump (estimatedBytes ≤ 임계 → large=false / recommendation="sync") / (b) large dump (estimatedBytes > 임계 → large=true / recommendation="async-streaming") 두 분기 각 1+ test. 대량 분기는 selected record 수를 충분히 stub(예: 10MB 초과하도록 record 다수)해 large=true 를 유발.
- [ ] **Negative cases 충분 cover** — (a) 빈 DB / 빈 selection (estimatedBytes 0 · humanSize "0 B" · recommendation "sync" · guidanceLines sync 안내), (b) 경계 (estimatedBytes === 임계 → large=false / sync — 초과 아님), (c) 단일 record (perEntityBytes 1 entity 만 non-zero), (d) controller spec — 권한 부족 (User actor 403), 인증 부재 (401), forbidNonWhitelisted (CreateExportDto 외 필드 400) — 각 1+ test.
- [ ] **Controller spec** (`export.controller.spec.ts`) — service.previewSelection mock 의 반환 shape 을 `sizeEstimate` 포함으로 stub 하고 200 응답 body 에 `sizeEstimate` 가 그대로 forward 됨을 1+ test.
- [ ] **Coverage 최소치** — `pnpm test:cov` 통과 (변경 파일 line ≥ 80% AND function ≥ 80% — `package.json` `coverageThreshold.global` 강제). 신규/변경 service 분기·controller 분기 전부 spec 도달.

### 정합 / 회귀 방지

- [ ] `estimateExportDumpSize` 의 import 경로는 `./export-dump-size-estimate` (같은 폴더) — 신규 alias / barrel re-export 신설 0.
- [ ] helper 결과 `sizeEstimate.perEntityBytes` 가 항상 5 key (Assessment·Person·Group·LlmConfig·AuditLog) 0-init 으로 박제됨을 spec 1+ 로 검증 (entity 누락 회귀 차단).
- [ ] `sizeEstimate.large === (sizeEstimate.recommendation === "async-streaming")` 불변이 응답에서 유지됨을 spec 1+ 로 cross-check (helper 불변의 surface 회귀 차단).
- [ ] 기존 `summary` / `selectedCount` / `excludedCount` / `perEntitySelected` 필드가 본 확장 후에도 그대로 반환됨을 spec 1+ 로 확인 (append-only 확장의 backward-compat 회귀 차단).
- [ ] `pnpm lint && pnpm build && pnpm test` 전부 green. CI workflow (`test:cov` step 포함) 도 green.

## Out of Scope

- 신규 endpoint / 새 route — 본 task 는 `POST /preview-selection` 의 응답 확장만. URL · 메서드 · RBAC · ValidationPipe 변경 0.
- DB write / 새 Prisma read — `estimateExportDumpSize` 는 input derivation 이라 추가 DB 호출 0. T-0497/T-0499 의 projection-only `collectExportRecords` 그대로.
- byte weight / async 임계 옵션 동적 주입 — 정책 row · ENV 기반 `ExportDumpSizeEstimateOptions`(bytesPerRecord / defaultBytesPerRecord / asyncThresholdBytes) 주입은 별도 task (§Follow-ups). 본 task 는 helper default 만.
- `buildExportJobPlan`(T-0467) · `buildExportResult` · chunk plan 배선 — 다음 chain step 들 (별도 task, §Follow-ups).
- helper(`estimateExportDumpSize`) 구현 변경 — T-0466 helper 본문 (`src/export/export-dump-size-estimate.ts`) 은 건드리지 않는다. service 가 `ExportDumpSizeEstimate` interface 를 그대로 surface 에 노출하면 된다.
- 새 DTO 파일 / response DTO class — 응답 shape 은 service interface 확장만. `class-validator` 검증은 request 측 `CreateExportDto` 만, response 는 plain interface.
- ADR-0044 본문 변경 / 새 ADR — 본 task 는 코드만. estimate helper 는 신규 architectural 결정 0(default 상수는 helper 내 박제됨).
- `api.md` 의 `POST /api/admin/export/preview-selection` 응답 shape `sizeEstimate` 정합 갱신 — 별도 doc-sync direct task (§Follow-ups).
- `ImportJobService` 대칭 배선 (`validateImportDumpSize`(T-0450) wiring) — import 측 별도 chain (별도 task).
- 실 dump 직렬화 / 실 byte 측정 / async job / streaming — Q-0040 범위 밖. 본 task 는 estimate 안내만(REQ-030/REQ-032 범위).
- 새 외부 dependency / credential / 새 module 등록 — 0.

## Suggested Sub-agents

`implementer → tester` (service 분기 1줄 + 응답 shape 1 필드 확장 + colocated spec 추가. architect 호출 불요 — helper 는 박제됐고 default 상수는 helper 내 정의됨, 새 architectural 결정 0.)

## Follow-ups

(생성 시점 비어 있음. sub-agent 가 관련 작업 발견 시 append — 예:
- **다음 code slice (chain step10)**: `buildExportJobPlan`(T-0467, `src/export/export-job-plan.ts`) → `previewSelection` 결과(selection + summary + sizeEstimate) 위에 chunk/job plan 합성 배선 (pr-mode). 본 task 의 estimate 위에 자연 연결.
- 이후 `buildExportResult` 순차 배선.
- `ExportDumpSizeEstimateOptions`(byte weight / async 임계) 동적 주입 — 정책 row · ENV 기반 (별도 task).
- api.md §5 의 `POST /api/admin/export/preview-selection` 응답 shape `sizeEstimate` 정합 갱신 (별도 doc-sync direct task).
- `ImportJobService` 측 대칭 — `validateImportDumpSize`(T-0450) 실호출 배선 (별도 chain).)
