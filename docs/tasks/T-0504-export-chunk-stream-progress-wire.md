---
id: T-0504
title: describeExportChunkStreamProgress helper 를 ExportJobService.previewSelection 응답의 초기 streamProgress 로 실호출 배선 — helper 배선 chain step13
phase: P7
status: DONE
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 210
estimatedFiles: 4
created: 2026-06-18
independentStream: export-import-wiring
dependsOn: [T-0503]
touchesFiles:
  - src/export/export-job.service.ts
  - src/export/export-job.service.spec.ts
  - src/export/export.controller.ts
  - src/export/export.controller.spec.ts
plannerNote: "P7 helper-배선 chain step13 — describeExportChunkStreamProgress(T-0470 미호출 helper) 를 T-0503 의 chunkPlan 위에 deliveredChunks=0(미시작) 으로 호출해 초기 streamProgress(0% · 첫 chunk content-range) 응답 조건부 배선. chunkPlan null 이면 null. DB write 0·신규 endpoint 0. R-112 backbone × 1.5 = ~210 LOC."
---

# T-0504 — describeExportChunkStreamProgress helper 를 previewSelection 응답의 초기 streamProgress 로 실호출 배선 (chain step13)

## Why

P7 "45 helper(T-0437~T-0483) 실 호출 배선" 스트림의 chain step13 다. [T-0503](T-0503-export-chunk-plan-wire.md) (chain step12, squash `046836c`) 가 `buildExportChunkPlan` 을 `ExportJobService.previewSelection` 응답의 `chunkPlan: ExportChunkPlan | null` 필드로 조건부 배선해 "대량 dump 를 몇 개 chunk 로·각각 몇 byte·어디서부터 자를 것인가" 의 정적 chunk 경계 plan 을 노출했다. 이로써 preview 응답은 (a) count 요약 → (b) `summary`(T-0499) → (c) `sizeEstimate`(T-0500) → (d) `deliveryPlan`(T-0501) → (e) `completionResult`(T-0502) → (f) `chunkPlan`(T-0503) 까지 "무엇을·얼마나·어떻게 전달할지·무엇이 export 되는지·어떻게 chunk 로 자를지" 의 사전 안내 layer 를 갖췄다.

그러나 `chunkPlan` 은 **정적 chunk 경계**(chunk 개수·각 chunk 의 offset/size)까지만 노출하고, "그럼 streaming 의 *진행 상태* 는 어떻게 표시되는가 — 지금 몇 번째 chunk·몇 byte 전송됨·진행률 몇 %·다음 전달할 chunk 의 Content-Range 수치는 무엇인가" 의 transfer-progress view 는 아직 미노출이다. 특히 preview 시점(streaming 시작 전)에 WebUI 가 보여줄 **초기 진행 상태**(0% · 전체 N chunk 대기 · 첫 chunk 의 content-range)가 빈 채로 남아 있다. UC-07 §5 step 13(Export 다운로드) + §8 NFR(chunked streaming progress bar / resume offset 안내) 이 요구하는 진행 view 의 gap 이다.

이 gap 을 채우는 helper 가 이미 박제돼 있다 — `describeExportChunkStreamProgress` ([T-0470](T-0470-export-chunk-stream-progress-helper.md), `src/export/export-chunk-stream-progress.ts`). 입력으로 `ExportChunkPlan`(T-0469 산출, T-0503 이 응답에 노출한 그 타입) + `deliveredChunks`(전달 완료 chunk 개수, 비-음수 정수) 를 받아 `{ totalChunks, deliveredChunks, remainingChunks, transferredBytes, totalBytes, remainingBytes, percentComplete, complete, currentChunk: ExportChunk | null, currentRange: ExportChunkContentRange | null, headline(한국어) }` 의 진행 상태를 순수 산술로 derive 하는 helper(재계산 0 — 이미 산출된 plan 의 chunks 경계만 사용). `git grep describeExportChunkStreamProgress -- "src/**/*.controller.ts" "src/**/*.service.ts"` 0 매칭 — 자기 spec 외 production wiring 0 인 미호출 helper.

**preview 시점의 deliveredChunks=0(미시작) 배선의 정당성**: streaming 도중의 실제 `deliveredChunks` 는 runtime streaming 상태(실 byte 전송)가 있어야 하나, 그 실 streaming 전송은 Q-0040 범위 밖(repository/streaming 게이트)이다. 그러나 helper 는 `deliveredChunks=0` 을 정상 경계로 다룬다 — 이 경우 `transferredBytes 0 · percentComplete 0 · complete false · currentChunk = chunks[0](첫 chunk) · currentRange = 첫 chunk 의 content-range(firstBytePos/lastBytePos/totalBytes/chunkIndex)` 의 **초기 진행 상태** 를 산출한다. 이는 preview 응답에 "streaming 을 시작하면 첫 chunk 의 Content-Range 는 무엇이고 진행률 0% 에서 출발한다" 는 forward-looking 초기 view 를 정확히 채워준다. 직전 step 들이 helper default 인자를 사용하고 runtime 동적 값을 후속 task 로 미룬 패턴(T-0501/T-0503 의 default 상수)을 mirror 해, 본 task 는 `deliveredChunks` 인자를 **상수 0(미시작)** 으로 고정 전달하고, runtime streaming 상태 기반 동적 progress(실 전송된 chunk 수 주입)는 별도 task(§Follow-ups — 실 streaming 게이트와 묶임)로 미룬다.

본 task 는 신설 endpoint 0·DB write 0 의 **조건부 응답 확장 slice** 다. `ExportJobService.previewSelection(scope)` 안에서 이미 산출된 `chunkPlan`(T-0503, `ExportChunkPlan | null`) 을 활용해, `chunkPlan !== null` 일 때만 `describeExportChunkStreamProgress(chunkPlan, 0)` 를 실호출해 `streamProgress: ExportChunkStreamProgress` 를 derive 하고, `chunkPlan === null`(sync 다운로드 — chunk 불요) 면 `streamProgress: null` 로 둔다. 반환 shape 을 기존 8 필드 + 신규 `streamProgress: ExportChunkStreamProgress | null` 결합으로 확장한다. POST `/api/admin/export/preview-selection` route 자체는 신설 0·메서드/URL/RBAC/ValidationPipe 불변 — 응답 body 만 확장된다.

이로써 (1) 미호출 helper 1 종이 실 HTTP path 에 연결되고(REQ-030 Export 대량 dump chunked 전달 진행 사전 안내), (2) helper 가 plan derivation 만 다루고 DB read 가 [T-0497](T-0497-export-select-records-preview-wire.md)~T-0503 에서 끝났으므로 REQ-032 raw 미저장 invariant 가 자연 유지되며(진행 상태만 산술 derive, raw payload 0·추가 DB read 0), (3) Admin 전용 RBAC(REQ-045) 가 endpoint 불변으로 동일 적용된다. step12 의 chunkPlan 위에 초기 progress view derivation 1 layer(조건부)만 더하는 minimum-diff slice.

본 task 는 **새 endpoint 0**(POST `/preview-selection` 메서드/URL 불변), **신규 DTO 파일 0**(응답 shape 은 service interface 확장만), **DB write 0**, **새 외부 dependency / migration / auth-flow 0**.

## Required Reading

- `docs/tasks/T-0504-export-chunk-stream-progress-wire.md` (본 파일)
- `src/export/export-chunk-stream-progress.ts` 전체 — 호출할 순수 helper. `describeExportChunkStreamProgress(plan: ExportChunkPlan, deliveredChunks: number): ExportChunkStreamProgress`. 반환 shape: `{ totalChunks, deliveredChunks, remainingChunks, transferredBytes, totalBytes, remainingBytes, percentComplete, complete, currentChunk: ExportChunk | null, currentRange: ExportChunkContentRange | null, headline(한국어) }`. **입력 방어**: plan 비-plain-object → TypeError(label "plan"), plan.chunkCount/plan.totalBytes 비-음수정수 아님 → TypeError, plan.chunks 배열 아님 / plan.chunks.length !== plan.chunkCount → TypeError, deliveredChunks 비-음수정수 아님(음수·소수·NaN·Infinity·비-number) → TypeError, deliveredChunks > plan.chunkCount → RangeError. **경계**: deliveredChunks 0(미시작) → transferredBytes 0·percentComplete 0·complete false·currentChunk chunks[0]·currentRange 첫 chunk content-range(firstBytePos=offsetBytes, lastBytePos=offsetBytes+sizeBytes-1, totalBytes, chunkIndex). chunkCount 0(0 byte plan) → totalChunks 0·deliveredChunks 0 만 허용·complete true·currentChunk null·percentComplete 100. **불변**: transferredBytes + remainingBytes === totalBytes, deliveredChunks + remainingChunks === totalChunks, complete ⟺ (remainingChunks 0 && remainingBytes 0), currentChunk null ⟺ complete.
- `src/export/export-chunk-plan.ts` — `ExportChunkPlan` / `ExportChunk` 타입 정의(helper 입력). chunkPlan non-null 일 때 chunkCount ≥ 1·chunks 비지 않음이라 deliveredChunks=0 호출 시 currentChunk = chunks[0] non-null.
- `src/export/export-job.service.ts` 전체 — 배선 위치. 특히 (a) `previewSelection(scope)` (line 300~) 의 현재 흐름 — `collectExportRecords()` → `selectExportRecords` → `summarizeExportSelection`(→summary) → `estimateExportDumpSize`(→sizeEstimate) → `buildExportJobPlan`(→deliveryPlan) → `buildExportResult`(→completionResult) → `buildExportChunkPlan`(→chunkPlan, line 366~368 조건부). 본 task 는 이미 산출된 `chunkPlan`(line 366) 을 활용해 조건부로 `describeExportChunkStreamProgress(chunkPlan, 0)` 를 호출 — 추가 순회·재계산 0(helper 가 plan 만 derive). (b) `ExportSelectionPreview` interface (line 179~199) — 본 task 가 `streamProgress: ExportChunkStreamProgress | null` 필드 추가. (c) helper import 패턴 (line 38~41 `buildExportChunkPlan` + `type ExportChunkPlan` import) mirror — `import { describeExportChunkStreamProgress, type ExportChunkStreamProgress } from "./export-chunk-stream-progress"`. (d) 직전 step 들의 조건부 분기 패턴(line 366~368 `deliveryPlan.chunked ? ... : null`) mirror — `chunkPlan !== null ? describeExportChunkStreamProgress(chunkPlan, 0) : null`. deliveredChunks 상수 0(미시작) 의미·runtime 동적 주입은 별도 task 임을 주석 1줄 명시.
- `src/export/export-job.service.spec.ts` 전체 — colocated spec. T-0503 `previewSelection` test 의 PrismaService mock 패턴 (5 entity `findMany` stub) mirror 해 신규 `streamProgress` 응답 shape 검증 추가. 신규 spec 파일 생성 금지 — colocated 우선.
- `src/export/export.controller.ts` 의 `previewSelection` endpoint — service 응답을 raw forward 만 한다. 본 task 의 응답 shape 확장이 controller 분기 추가 0(service return 그대로 200 forward). type import (`ExportSelectionPreview`) 정합화만 필요.
- `src/export/export.controller.spec.ts` 의 `previewSelection` test (T-0497~T-0503 추가분) — 신규 `streamProgress` 응답 shape 의 controller 측 forward 검증 1+ 추가 또는 기존 expectation 갱신.
- `docs/use-cases/UC-07.md` §5 step 13 + §8 NFR(chunked streaming progress) — 진행 view 의 의미 정합 확인.

## Acceptance Criteria

### 배선 설계 (구현 방향 — 세부는 implementer 재량, 단 helper 실호출 + 조건부 분기 + 신설 endpoint 0 + DB write 0 은 의무)

- [ ] `ExportJobService.previewSelection(scope)` 의 흐름을 (1) 기존 helper 호출 chain(collectExportRecords → selectExportRecords → summarizeExportSelection → estimateExportDumpSize → buildExportJobPlan → buildExportResult → buildExportChunkPlan(→chunkPlan)) 유지 → (2) `chunkPlan !== null` 일 때만 `describeExportChunkStreamProgress(chunkPlan, 0)` 실호출, `null` 면 `null` → (3) 산출 `ExportChunkStreamProgress | null` 을 응답에 포함하도록 확장한다. helper 호출 위치·방식 배선 근거 주석 1 줄 박제 (UC-07 §5 step 13 + §8 NFR chunked streaming progress + REQ-032 derivation-only + deliveredChunks=0 미시작 초기 view·runtime 동적 주입 별도 task 명시).
- [ ] `describeExportChunkStreamProgress` 의 두 번째 인자 `deliveredChunks` 는 **상수 `0`(미시작 — preview 시점)** 으로 고정 전달하고, 그 의미(streaming 시작 전 초기 진행 상태 — 0% · 첫 chunk content-range 안내)·runtime 실 전송 chunk 수 기반 동적 주입은 별도 task 임을 주석 1줄로 명시한다.
- [ ] `ExportSelectionPreview` 에 `streamProgress: ExportChunkStreamProgress | null` 필드 추가. helper 의 `ExportChunkStreamProgress` 타입을 그대로 surface 에 노출(service 가 `import { describeExportChunkStreamProgress, type ExportChunkStreamProgress }`). 기존 `selectedCount` / `excludedCount` / `perEntitySelected` / `summary` / `sizeEstimate` / `deliveryPlan` / `completionResult` / `chunkPlan` 필드 전부 불변(append-only 확장 — backward-compat).
- [ ] 새 endpoint 0 — POST `/api/admin/export/preview-selection` 의 메서드/URL/RBAC/ValidationPipe 모두 불변. controller 분기 추가 0(service return 그대로 forward — 응답 shape 만 확장).
- [ ] DB write 0 — `describeExportChunkStreamProgress` 는 입력 `chunkPlan` + 상수 0 만 derivation 하므로 추가 Prisma 호출 0. T-0497~T-0503 의 projection-only read(REQ-032) 정책 불변.
- [ ] helper `describeExportChunkStreamProgress` 의 입력 방어 분기(RangeError/TypeError)는 항상 buildExportChunkPlan 통과 chunkPlan(chunks.length === chunkCount·totalBytes 비-음수정수) + deliveredChunks 0(0 ≤ chunkCount) 만 forward 되므로 정상 경로에서 미발화(주석 1줄로 박제).

### R-112 4종 충분 cover (CLAUDE.md §3.2)

- [ ] **Happy-path unit test** (service spec) — (a) chunked === true (대량 selection → chunkPlan non-null) → `streamProgress` 가 `ExportChunkStreamProgress`(deliveredChunks 0 · transferredBytes 0 · percentComplete 0 · complete false · currentChunk === chunkPlan.chunks[0] · currentRange non-null) 으로 박제됨 검증, (b) chunked === false (소량 selection → chunkPlan null) → `streamProgress === null` 검증. 각 1+.
- [ ] **Error path unit test** (service spec) — (a) 5 entity findMany 중 하나가 Prisma error throw 시 service 가 raw propagate 검증(stream progress 호출 도달 0), (b) stream progress 호출 자체는 정상 chunkPlan + 상수 0 만 받으므로 helper 입력 방어 발화 0 검증(정상 흐름에서 chunkPlan.chunks.length === chunkCount · deliveredChunks 0 ≤ chunkCount).
- [ ] **Flow / branch coverage** — (a) `chunkPlan !== null` → `describeExportChunkStreamProgress` 호출 → `streamProgress` non-null 분기 / (b) `chunkPlan === null` → 호출 skip → `streamProgress === null` 분기 두 분기 각 1+ test. 두 분기가 응답 shape 의 핵심 branch.
- [ ] **Negative cases 충분 cover** — (a) 빈 DB / 빈 selection (estimatedBytes 0 → chunked false → chunkPlan null → `streamProgress === null`), (b) chunked === true 이고 chunkCount 가 1 일 때 currentChunk === chunks[0] · remainingChunks === 1 박제 검증, (c) chunked === true 이고 chunkCount 가 2+ 일 때 currentRange.firstBytePos === chunks[0].offsetBytes · currentRange.lastBytePos === chunks[0].offsetBytes + chunks[0].sizeBytes - 1 박제 검증, (d) controller spec — 권한 부족 (User actor 403), 인증 부재 (401), forbidNonWhitelisted (CreateExportDto 외 필드 400) — 각 1+ test.
- [ ] **Controller spec** (`export.controller.spec.ts`) — service.previewSelection mock 의 반환 shape 을 `streamProgress` 포함(null 1 케이스 + non-null 1 케이스)으로 stub 하고 200 응답 body 에 `streamProgress` 가 그대로 forward 됨을 1+ test.
- [ ] **Coverage 최소치** — `pnpm test:cov` 통과 (변경 파일 line ≥ 80% AND function ≥ 80% — `package.json` `coverageThreshold.global` 강제). 신규/변경 service 분기(chunkPlan null/non-null)·controller 분기 전부 spec 도달.

### 정합 / 회귀 방지

- [ ] `describeExportChunkStreamProgress` 의 import 경로는 `./export-chunk-stream-progress` (같은 폴더) — 신규 alias / barrel re-export 신설 0.
- [ ] `streamProgress`(non-null 일 때)의 `totalBytes` 가 `chunkPlan.totalBytes` 와, `totalChunks` 가 `chunkPlan.chunkCount` 와 일치함을 spec 1+ 로 cross-check (plan ground-truth 회귀 차단).
- [ ] `streamProgress !== null` ⟺ `chunkPlan !== null` 의 동치 관계를 spec 1+ 로 검증 (조건부 분기 ground-truth 회귀 차단).
- [ ] 기존 `summary` / `sizeEstimate` / `deliveryPlan` / `completionResult` / `chunkPlan` / `selectedCount` / `excludedCount` / `perEntitySelected` 필드가 본 확장 후에도 그대로 반환됨을 spec 1+ 로 확인 (append-only 확장의 backward-compat 회귀 차단).
- [ ] `pnpm lint && pnpm build && pnpm test` 전부 green. CI workflow (`test:cov` step 포함) 도 green.

## Out of Scope

- 신규 endpoint / 새 route — 본 task 는 `POST /preview-selection` 의 응답 확장만. URL · 메서드 · RBAC · ValidationPipe 변경 0.
- DB write / 새 Prisma read — `describeExportChunkStreamProgress` 는 input(chunkPlan) derivation 이라 추가 DB 호출 0. T-0497~T-0503 의 projection-only `collectExportRecords` 그대로.
- **runtime 실 전송 chunk 수(deliveredChunks > 0) 기반 동적 progress** — 본 task 는 `deliveredChunks=0`(미시작 초기 view) 만. 실 streaming 도중의 동적 진행률(전송된 chunk 수 주입)은 별도 task (§Follow-ups) — 실 chunked streaming 전송 게이트와 묶임.
- 실 chunked streaming / byte slice 추출 / HTTP Range·Content-Range 헤더 직렬화("Content-Range: bytes a-b/c" 문자열 생성) / SSE·long-poll 전송 / resumable upload — Q-0040 범위 밖. 본 task 는 진행 view 안내(currentRange 수치)만(REQ-030/REQ-032 범위). 실 streaming 전송은 P5 service layer(별도 task).
- `buildExportChunkPlan` / `estimateExportDumpSize` / `buildExportJobPlan` 재호출 / 재계산 — 이미 산출된 `chunkPlan` 만 활용. stream progress helper 가 plan 을 derive 만 한다(DRY).
- helper(`describeExportChunkStreamProgress`) 구현 변경 — T-0470 helper 본문 (`src/export/export-chunk-stream-progress.ts`) 은 건드리지 않는다. service 가 `ExportChunkStreamProgress` interface 를 그대로 surface 에 노출하면 된다.
- 새 DTO 파일 / response DTO class — 응답 shape 은 service interface 확장만. `class-validator` 검증은 request 측 `CreateExportDto` 만, response 는 plain interface.
- ADR 본문 변경 / 새 ADR — 본 task 는 코드만. stream progress helper 는 신규 architectural 결정 0.
- `api.md` 의 `POST /api/admin/export/preview-selection` 응답 shape `streamProgress` 정합 갱신 — 별도 doc-sync direct task (§Follow-ups).
- `ImportJobService` 대칭 배선 (import-chunk-upload-progress 등) — import 측 별도 chain (별도 task).
- 새 외부 dependency / credential / 새 module 등록 — 0.

## Suggested Sub-agents

`implementer → tester` (service 조건부 분기(chunkPlan null/non-null) + 응답 shape 1 필드 확장 + deliveredChunks 상수 0 전달 + colocated spec 추가. architect 호출 불요 — helper 는 박제됐고 추가 architectural 결정 0·조건부 분기는 직전 step 패턴 그대로.)

## Follow-ups

(생성 시점 비어 있음. sub-agent 가 관련 작업 발견 시 append — 예:
- **runtime 동적 deliveredChunks 주입 (별도 task)**: 실 streaming 도중의 전송 완료 chunk 수를 주입해 동적 progress 를 산출 — 실 chunked streaming 전송 게이트(Q-0040 범위 밖)와 묶임.
- **다음 code slice (chain step14)**: chunk throughput / resume 계열 미호출 helper(export-chunk-stream-throughput / export-chunk-throughput-series / export-chunk-resume-plan) 의 배선 — 단, throughput/series 는 실 시간축 전송 sample 이 필요해 runtime streaming 게이트일 가능성 높음(배선 전 입력 요구사항 확인 필요). resume-plan 은 chunkPlan + 실패 chunk 집합이 필요해 역시 runtime 상태 의존 가능 — 후속 planner 가 입력 게이트 판정.
- api.md §5 의 `POST /api/admin/export/preview-selection` 응답 shape `streamProgress` 정합 갱신 (별도 doc-sync direct task).
- `ImportJobService` 측 대칭 — import chunk upload progress(import-chunk-upload-progress) 실호출 배선 (별도 chain).)
