---
id: T-0503
title: buildExportChunkPlan helper 를 ExportJobService.previewSelection 응답 확장으로 실호출 배선 — helper 배선 chain step12
phase: P7
status: DONE
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 210
estimatedFiles: 4
created: 2026-06-18
independentStream: export-import-wiring
dependsOn: [T-0502]
touchesFiles:
  - src/export/export-job.service.ts
  - src/export/export-job.service.spec.ts
  - src/export/export.controller.ts
  - src/export/export.controller.spec.ts
plannerNote: "P7 helper-배선 chain step12 — buildExportChunkPlan(T-0469 미호출 helper) 를 T-0502 previewSelection 의 sizeEstimate+deliveryPlan.chunked 위에 chunkPlan 응답 확장으로 조건부 배선(chunked true 면 chunk 경계 plan·아니면 null). chunkSizeBytes 는 default 상수, ENV 동적주입 별도 task. DB write 0·신규 endpoint 0. R-112 backbone × 1.5 = ~210 LOC."
---

# T-0503 — buildExportChunkPlan helper 를 previewSelection 응답 확장으로 실호출 배선 (chain step12)

## Why

P7 "45 helper(T-0437~T-0483) 실 호출 배선" 스트림의 chain step12 다. [T-0502](T-0502-export-result-wire.md) (chain step11, squash `2cab65e`) 가 `buildExportResult` 를 `ExportJobService.previewSelection` 응답의 `completionResult` 필드로 배선해 "이 scope 로 무엇이 export 되는가" 의 사람-친화 완료 결과를 노출했다. 이로써 preview 응답은 (a) count 요약 → (b) `summary`(T-0499) → (c) `sizeEstimate`(T-0500) → (d) `deliveryPlan`(T-0501 — `mode`/`chunked`/`pollingRequired`/`statusFlow`) → (e) `completionResult`(T-0502) 까지 "무엇을·얼마나·어떻게 전달할지·무엇이 export 되는지" 의 사전 안내 layer 를 갖췄다.

그러나 `deliveryPlan.chunked === true`(대량 dump — `estimatedBytes > chunkThreshold`) 인 경우에도 preview 응답은 **"그럼 실제로 chunk 를 어떻게 자를 것인가(몇 개로·각각 몇 byte·어디서부터)" 의 chunk 경계 plan** 을 아직 노출하지 않는다. `deliveryPlan` 은 "chunked streaming 이 필요한가" 의 boolean 권고까지만 산출하고, 실제 chunk 경계(chunk 개수·각 chunk 의 byte offset·각 chunk 의 byte size·마지막 잔여)는 미노출이다. UC-07 §5 step 13(Export 다운로드) + §8 NFR(대량 dump 는 chunked streaming) 이 요구하는 chunk descriptor 가 빈 채로 남아 있다.

이 gap 을 채우는 helper 가 이미 박제돼 있다 — `buildExportChunkPlan` ([T-0469](T-0469-export-chunk-plan-helper.md), `src/export/export-chunk-plan.ts`). 입력으로 `ExportDumpSizeEstimate`(T-0466 산출, T-0500 이 응답에 노출한 그 타입) + `chunkSizeBytes`(양의 정수) 를 받아 `{ totalBytes, chunkSizeBytes, chunkCount, chunks: ExportChunk[], lastChunkSizeBytes, headline(한국어) }` 의 chunk 분할 plan 을 순수 산술로 박제하는 helper(재계산 0 — 이미 산출된 estimate 의 `estimatedBytes` 만 chunkSize 로 분할). `git grep buildExportChunkPlan -- "src/**/*.controller.ts" "src/**/*.service.ts"` 0 매칭 — 자기 spec 외 production wiring 0 인 미호출 helper.

**chunkSizeBytes 정책 결정의 minimum-diff 처리**: `buildExportChunkPlan` 은 `chunkSizeBytes` 를 **필수 인자**로 요구한다(0 나누기 방지 — 양의 정수). [T-0502](T-0502-export-result-wire.md) Follow-ups 가 이를 "정책 row · ENV 기반 chunk 크기 결정이 선행" 이라 표시했으나, 본 chain 의 직전 step 들(T-0500/T-0501)이 helper default 옵션을 사용하고 동적 주입을 후속 task 로 미룬 패턴([T-0501](T-0501-export-job-plan-wire.md)의 `DEFAULT_CHUNK_THRESHOLD_BYTES` 5MB / `DEFAULT_POLL_INTERVAL_SECONDS` 3s 사용)을 그대로 mirror 한다 — 본 task 는 service 안에 **module-level 상수 `DEFAULT_EXPORT_CHUNK_SIZE_BYTES`(예: 1MB = 1024*1024)** 1 개를 박제해 `buildExportChunkPlan` 에 전달하고, 정책 row · ENV 기반 동적 chunk size 주입은 별도 task(§Follow-ups)로 미룬다. 이로써 정책 결정 선행 없이도 minimum-diff slice 가 성립한다(추가 인자·재계산 0).

본 task 는 신설 endpoint 0·DB write 0 의 **조건부 응답 확장 slice** 다. `ExportJobService.previewSelection(scope)` 안에서 이미 산출된 `sizeEstimate`(T-0500, ExportDumpSizeEstimate) 와 `deliveryPlan`(T-0501) 을 활용해, `deliveryPlan.chunked === true` 일 때만 `buildExportChunkPlan(sizeEstimate, DEFAULT_EXPORT_CHUNK_SIZE_BYTES)` 를 실호출해 `chunkPlan: ExportChunkPlan` 을 derive 하고, `chunked === false`(sync 다운로드 — chunk 불요) 면 `chunkPlan: null` 로 둔다. 반환 shape 을 기존 7 필드 + 신규 `chunkPlan: ExportChunkPlan | null` 결합으로 확장한다. POST `/api/admin/export/preview-selection` route 자체는 신설 0·메서드/URL/RBAC/ValidationPipe 불변 — 응답 body 만 확장된다.

이로써 (1) 미호출 helper 1 종이 실 HTTP path 에 연결되고(REQ-030 Export 대량 dump chunked 전달 사전 안내), (2) helper 가 estimate derivation 만 다루고 DB read 가 [T-0497](T-0497-export-select-records-preview-wire.md)~T-0502 에서 끝났으므로 REQ-032 raw 미저장 invariant 가 자연 유지되며(chunk 경계만 산술 derive, raw payload 0·추가 DB read 0), (3) Admin 전용 RBAC(REQ-045) 가 endpoint 불변으로 동일 적용된다. step11 의 completionResult 위에 chunk plan derivation 1 layer(조건부)만 더하는 minimum-diff slice.

본 task 는 **새 endpoint 0**(POST `/preview-selection` 메서드/URL 불변), **신규 DTO 파일 0**(응답 shape 은 service interface 확장만), **DB write 0**, **새 외부 dependency / migration / auth-flow 0**.

## Required Reading

- `docs/tasks/T-0503-export-chunk-plan-wire.md` (본 파일)
- `src/export/export-chunk-plan.ts` 전체 — 호출할 순수 helper. `buildExportChunkPlan(estimate: ExportDumpSizeEstimate, chunkSizeBytes: number, options?: ExportChunkPlanOptions): ExportChunkPlan`. 반환 shape: `{ totalBytes, chunkSizeBytes, chunkCount, chunks: ExportChunk[]({index,offsetBytes,sizeBytes,last}), lastChunkSizeBytes, headline(한국어) }`. **입력 방어**: estimate 비-plain-object → TypeError(label "estimate"), estimate.estimatedBytes 비-정수·음수·NaN·Infinity → TypeError, chunkSizeBytes 비-양의-정수(0·음수·소수·NaN·Infinity) → RangeError, options 비-object → TypeError, options.maxChunks 비-양의-정수 → RangeError, chunkCount > maxChunks → RangeError. 경계: estimatedBytes 0 → chunkCount 0 · chunks 빈 배열 · lastChunkSizeBytes 0(throw 0). 불변: chunks.length === chunkCount, sum(sizeBytes) === totalBytes, 마지막 외 모든 chunk sizeBytes === chunkSizeBytes, offset 연속(gap/overlap 0).
- `src/export/export-job.service.ts` 전체 — 배선 위치. 특히 (a) `previewSelection(scope)` (line 277~355) 의 현재 흐름 — `collectExportRecords()` → `selectExportRecords` → `summarizeExportSelection`(→summary) → `estimateExportDumpSize`(→sizeEstimate, line 305) → `buildExportJobPlan`(→deliveryPlan, line 318) → `buildExportResult`(→completionResult, line 331). 본 task 는 이미 산출된 `sizeEstimate`(line 305) 와 `deliveryPlan.chunked`(line 318) 를 활용해 조건부로 `buildExportChunkPlan(sizeEstimate, DEFAULT_EXPORT_CHUNK_SIZE_BYTES)` 를 호출 — 추가 순회·재계산 0(helper 가 estimate 만 derive). (b) `ExportSelectionPreview` interface (line 163~176) — 본 task 가 `chunkPlan: ExportChunkPlan | null` 필드 추가. (c) helper import 패턴 (line 41 `buildExportJobPlan` + `type ExportJobPlan` import, line 320 buildExportResult import) mirror. (d) 직전 step 들의 default 상수 사용 패턴(line 311~313 주석 — DEFAULT_CHUNK_THRESHOLD_BYTES/DEFAULT_POLL_INTERVAL_SECONDS) mirror 해 `DEFAULT_EXPORT_CHUNK_SIZE_BYTES` 상수 박제.
- `src/export/export-job.service.spec.ts` 전체 — colocated spec. T-0502 `previewSelection` test 의 PrismaService mock 패턴 (5 entity `findMany` stub) mirror 해 신규 `chunkPlan` 응답 shape 검증 추가. 신규 spec 파일 생성 금지 — colocated 우선.
- `src/export/export.controller.ts` 의 `previewSelection` endpoint — service 응답을 raw forward 만 한다. 본 task 의 응답 shape 확장이 controller 분기 추가 0(service return 그대로 200 forward). type import (`ExportSelectionPreview`) 정합화만 필요.
- `src/export/export.controller.spec.ts` 의 `previewSelection` test (T-0497~T-0502 추가분) — 신규 `chunkPlan` 응답 shape 의 controller 측 forward 검증 1+ 추가 또는 기존 expectation 갱신.
- `docs/use-cases/UC-07.md` §5 step 13 + §8 NFR(chunked streaming) — 대량 dump chunk 경계 안내의 의미 정합 확인.

## Acceptance Criteria

### 배선 설계 (구현 방향 — 세부는 implementer 재량, 단 helper 실호출 + 조건부 분기 + 신설 endpoint 0 + DB write 0 은 의무)

- [ ] `ExportJobService.previewSelection(scope)` 의 흐름을 (1) 기존 `collectExportRecords()` + `selectExportRecords` + `summarizeExportSelection`(→summary) + `estimateExportDumpSize`(→sizeEstimate) + `buildExportJobPlan`(→deliveryPlan) + `buildExportResult`(→completionResult) 호출 유지 → (2) `deliveryPlan.chunked === true` 일 때만 `buildExportChunkPlan(sizeEstimate, DEFAULT_EXPORT_CHUNK_SIZE_BYTES)` 실호출, `false` 면 `null` → (3) 산출 `ExportChunkPlan | null` 을 응답에 포함하도록 확장한다. helper 호출 위치·방식 배선 근거 주석 1 줄 박제 (UC-07 §5 step 13 + §8 NFR chunked streaming chunk 경계 + REQ-032 derivation-only + chunkSizeBytes default 상수 사용·ENV 동적주입 별도 task 명시).
- [ ] service 안에 module-level 상수 `DEFAULT_EXPORT_CHUNK_SIZE_BYTES`(양의 정수, 예: `1024 * 1024` = 1MB) 1 개를 박제하고 그 의미·정책 source 0(인자로 받은 값만 사용)·ENV 동적주입은 별도 task 임을 주석 1줄로 명시한다. helper `DEFAULT_CHUNK_THRESHOLD_BYTES`(전달 여부 판정) 와 chunk size(분할 단위)를 혼동하지 않는다.
- [ ] `ExportSelectionPreview` 에 `chunkPlan: ExportChunkPlan | null` 필드 추가. helper 의 `ExportChunkPlan` 타입을 그대로 surface 에 노출(service 가 `import { buildExportChunkPlan, type ExportChunkPlan }`). 기존 `selectedCount` / `excludedCount` / `perEntitySelected` / `summary` / `sizeEstimate` / `deliveryPlan` / `completionResult` 필드 전부 불변(append-only 확장 — backward-compat).
- [ ] 새 endpoint 0 — POST `/api/admin/export/preview-selection` 의 메서드/URL/RBAC/ValidationPipe 모두 불변. controller 분기 추가 0(service return 그대로 forward — 응답 shape 만 확장).
- [ ] DB write 0 — `buildExportChunkPlan` 는 입력 `sizeEstimate` + 상수만 derivation 하므로 추가 Prisma 호출 0. T-0497~T-0502 의 projection-only read(REQ-032) 정책 불변.
- [ ] helper `buildExportChunkPlan` 의 입력 방어 분기(RangeError/TypeError)는 항상 estimateExportDumpSize 통과 estimate(estimatedBytes 비-음수 정수) + 양의 정수 상수 chunkSizeBytes 만 forward 되므로 정상 경로에서 미발화(주석 1줄로 박제).

### R-112 4종 충분 cover (CLAUDE.md §3.2)

- [ ] **Happy-path unit test** (service spec) — (a) chunked === true (대량 selection → estimatedBytes > 5MB threshold) → `chunkPlan` 이 `ExportChunkPlan`(chunkCount > 0 · chunks 비지 않음 · totalBytes === sizeEstimate.estimatedBytes) 으로 박제됨 검증, (b) chunked === false (소량 selection) → `chunkPlan === null` 검증. 각 1+.
- [ ] **Error path unit test** (service spec) — (a) 5 entity findMany 중 하나가 Prisma error throw 시 service 가 raw propagate 검증(chunk plan 호출 도달 0), (b) chunk plan 호출 자체는 정상 estimate + 양의 정수 상수만 받으므로 helper 입력 방어 발화 0 검증(정상 흐름에서 estimatedBytes 는 항상 비-음수 정수 · chunkSizeBytes 는 양의 정수 상수).
- [ ] **Flow / branch coverage** — (a) `deliveryPlan.chunked === true` → `buildExportChunkPlan` 호출 → `chunkPlan` non-null 분기 / (b) `deliveryPlan.chunked === false` → 호출 skip → `chunkPlan === null` 분기 두 분기 각 1+ test. 두 분기가 응답 shape 의 핵심 branch.
- [ ] **Negative cases 충분 cover** — (a) 빈 DB / 빈 selection (estimatedBytes 0 → chunked false → `chunkPlan === null`), (b) 경계: estimatedBytes 가 threshold 와 정확히 같을 때(=== 는 초과 아님 → chunked false → null) 검증, (c) chunked === true 이고 totalBytes 가 chunkSize 배수 아닐 때 lastChunkSizeBytes < chunkSizeBytes 박제 검증, (d) controller spec — 권한 부족 (User actor 403), 인증 부재 (401), forbidNonWhitelisted (CreateExportDto 외 필드 400) — 각 1+ test.
- [ ] **Controller spec** (`export.controller.spec.ts`) — service.previewSelection mock 의 반환 shape 을 `chunkPlan` 포함(null 1 케이스 + non-null 1 케이스)으로 stub 하고 200 응답 body 에 `chunkPlan` 이 그대로 forward 됨을 1+ test.
- [ ] **Coverage 최소치** — `pnpm test:cov` 통과 (변경 파일 line ≥ 80% AND function ≥ 80% — `package.json` `coverageThreshold.global` 강제). 신규/변경 service 분기(chunked true/false)·controller 분기 전부 spec 도달.

### 정합 / 회귀 방지

- [ ] `buildExportChunkPlan` 의 import 경로는 `./export-chunk-plan` (같은 폴더) — 신규 alias / barrel re-export 신설 0.
- [ ] `chunkPlan.totalBytes`(non-null 일 때)가 `sizeEstimate.estimatedBytes` 와 일치함을 spec 1+ 로 cross-check (estimate ground-truth 회귀 차단).
- [ ] `chunkPlan !== null` ⟺ `deliveryPlan.chunked === true` 의 동치 관계를 spec 1+ 로 검증 (조건부 분기 ground-truth 회귀 차단).
- [ ] 기존 `summary` / `sizeEstimate` / `deliveryPlan` / `completionResult` / `selectedCount` / `excludedCount` / `perEntitySelected` 필드가 본 확장 후에도 그대로 반환됨을 spec 1+ 로 확인 (append-only 확장의 backward-compat 회귀 차단).
- [ ] `pnpm lint && pnpm build && pnpm test` 전부 green. CI workflow (`test:cov` step 포함) 도 green.

## Out of Scope

- 신규 endpoint / 새 route — 본 task 는 `POST /preview-selection` 의 응답 확장만. URL · 메서드 · RBAC · ValidationPipe 변경 0.
- DB write / 새 Prisma read — `buildExportChunkPlan` 는 input(sizeEstimate) derivation 이라 추가 DB 호출 0. T-0497~T-0502 의 projection-only `collectExportRecords` 그대로.
- **chunkSizeBytes 정책 row · ENV 기반 동적 주입** — 본 task 는 module-level `DEFAULT_EXPORT_CHUNK_SIZE_BYTES` 상수만. 정책 테이블 · 환경변수 기반 동적 chunk size 결정·주입은 별도 task (§Follow-ups). 직전 step T-0501 의 default 상수 패턴 mirror.
- 실 chunked streaming / byte slice 추출 / HTTP Range·Content-Range 헤더 직렬화 / SSE·long-poll 전송 — Q-0040 범위 밖. 본 task 는 chunk 경계 plan 안내만(REQ-030/REQ-032 범위). 실 streaming 전송은 P5 service layer(별도 task).
- `estimateExportDumpSize` / `buildExportJobPlan` 재호출 / 재계산 — 이미 산출된 `sizeEstimate` 와 `deliveryPlan.chunked` 만 활용. chunk plan helper 가 estimate 를 derive 만 한다(DRY).
- helper(`buildExportChunkPlan`) 구현 변경 — T-0469 helper 본문 (`src/export/export-chunk-plan.ts`) 은 건드리지 않는다. service 가 `ExportChunkPlan` interface 를 그대로 surface 에 노출하면 된다.
- 새 DTO 파일 / response DTO class — 응답 shape 은 service interface 확장만. `class-validator` 검증은 request 측 `CreateExportDto` 만, response 는 plain interface.
- ADR-0044 본문 변경 / 새 ADR — 본 task 는 코드만. chunk plan helper 는 신규 architectural 결정 0.
- `api.md` 의 `POST /api/admin/export/preview-selection` 응답 shape `chunkPlan` 정합 갱신 — 별도 doc-sync direct task (§Follow-ups).
- `ImportJobService` 대칭 배선 — import 측 별도 chain (별도 task).
- 새 외부 dependency / credential / 새 module 등록 — 0.

## Suggested Sub-agents

`implementer → tester` (service 조건부 분기(chunked true/false) + 응답 shape 1 필드 확장 + default 상수 1 개 + colocated spec 추가. architect 호출 불요 — helper 는 박제됐고 추가 architectural 결정 0·default 상수 사용은 직전 step 패턴 그대로.)

## Follow-ups

(생성 시점 비어 있음. sub-agent 가 관련 작업 발견 시 append — 예:
- **chunkSizeBytes 동적 주입 (별도 task)**: 정책 row · ENV 기반 chunk size 결정·주입으로 `DEFAULT_EXPORT_CHUNK_SIZE_BYTES` 상수를 대체 (pr-mode). buildExportJobPlan 의 chunkThreshold 동적주입 task 와 함께 묶을 수 있음.
- **다음 code slice (chain step13)**: chunk streaming progress / throughput / resume 계열 미호출 helper(export-chunk-stream-progress / export-chunk-resume-plan 등) 의 배선 — chunkPlan 위에 진행/재개 view 합성 (pr-mode).
- api.md §5 의 `POST /api/admin/export/preview-selection` 응답 shape `chunkPlan` 정합 갱신 (별도 doc-sync direct task).
- `ImportJobService` 측 대칭 — import chunk reassembly / dedup plan 실호출 배선 (별도 chain).)
