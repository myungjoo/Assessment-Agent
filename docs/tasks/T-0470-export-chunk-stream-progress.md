---
id: T-0470
title: UC-07 §8 NFR chunked streaming 진행 상태(전달·잔여 chunk·전송 byte·진행률·현재 chunk content-range)를 렌더하는 순수 helper describeExportChunkStreamProgress
phase: P7
status: DONE
mergedAs: a73990b
prNumber: 381
reviewRounds: 1
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 195
estimatedFiles: 2
created: 2026-06-17
independentStream: uc07-export-import-helpers
dependsOn: []
touchesFiles:
  - src/export/export-chunk-stream-progress.ts
  - src/export/export-chunk-stream-progress.spec.ts
hqOrigin: null
plannerNote: "P7 UC-07 §8 NFR — buildExportChunkPlan(T-0469)은 정적 chunk 경계만 산출, chunked streaming 전송 *진행 상태*(전달·잔여 chunk·전송 byte·진행률·현재 chunk content-range)는 33 helper 중 0회 cover. pr·게이트-free·dependsOn []."
---

# T-0470 — UC-07 §8 NFR chunked streaming 진행 상태를 렌더하는 순수 helper describeExportChunkStreamProgress

## Why

UC-07 §8 NFR 은 대량 dump 를 "async job + status polling + **chunked streaming**" 으로 전달하라 명시한다. 직전 `buildExportChunkPlan`(T-0469)은 `ExportChunkPlan{chunkCount, chunks[], lastChunkSizeBytes, ...}` 으로 **정적 chunk 경계**(몇 개로·각각 몇 byte·어디서부터)까지 산출하지만, 실제 streaming 도중 "지금 몇 번째 chunk 까지 전달됐고·몇 byte 전송됐고·진행률 몇 %·다음(현재) chunk 의 Content-Range 는 무엇인가" 의 **전송 진행 상태(transfer progress)** 렌더링은 33 helper 중 0 회 cover 된 gap 이다(`git grep describeExportChunk|ExportChunkProgress|ExportChunkStream|chunkProgress|contentRange|ExportStreamProgress src/export` → 0 매칭). `describeExportJobStatus`(T-0468)가 async job *전체* 의 단일 status enum 을 진행 view 로 렌더한다면, 본 helper 는 그보다 한 단계 안쪽 — chunk-stream 단위의 진행률을 렌더한다(job-level 과 chunk-level 의 view 분리). UC-07 §5 step 13(Export 다운로드) + §8 chunked streaming 이 필요로 하는 진행 표시(WebUI progress bar / resume offset 안내)를 채운다. 실 streaming / byte slice / HTTP Range·Content-Range 헤더 직렬화 0 — 입력으로 받은 `ExportChunkPlan` 과 `deliveredChunks`(이미 전달된 chunk 개수)만으로 진행 상태를 순수 산술로 derive 한다.

## Required Reading

- `docs/use-cases/UC-07-export-import.md` §8 (NFR — async job + status polling + chunked streaming) + §5 step 13
- `src/export/export-chunk-plan.ts` — `ExportChunk{index, offsetBytes, sizeBytes, last}` + `ExportChunkPlan{totalBytes, chunkSizeBytes, chunkCount, chunks[], lastChunkSizeBytes, headline}` 타입(본 helper 의 입력으로 재사용 import) + `isPlainObject` / `describeNonObject` / `isValidNonNegativeInteger` / `isValidPositiveInteger` 입력 방어 + 한국어 message convention mirror 대상. **본 helper 는 chunk plan 을 재계산하지 않고 입력으로 받은 ExportChunkPlan 의 chunks 경계를 그대로 사용한다(DRY — buildExportChunkPlan 재호출 금지).**
- `src/export/export-job-status-view.ts` — `describeExportJobStatus`(T-0468)의 진행 view 모델(headline + detailLines + 진행 단계) 구조·한국어 라벨 convention 참조(동형 패턴 mirror — job-level view 와 chunk-stream-level view 의 일관성)
- `CLAUDE.md` §3.2 (R-112 4종 test 의무) + §12 (언어 정책 — 식별자 영어, 메시지·주석 한국어)

## Acceptance Criteria

- [ ] `src/export/export-chunk-stream-progress.ts` 신설. 신규 도메인 타입만 신설: `ExportChunkContentRange`(plain object: `firstBytePos: number`(현재 chunk 시작 byte, inclusive), `lastBytePos: number`(현재 chunk 끝 byte, inclusive = offset+size-1), `totalBytes: number`(전체 byte — content-range 의 instance-length), `chunkIndex: number`(0-base 현재 chunk 순번)), `ExportChunkStreamProgress`(plain object: `totalChunks: number`(입력 plan.chunkCount 그대로), `deliveredChunks: number`(전달 완료 chunk 개수), `remainingChunks: number`(= totalChunks - deliveredChunks), `transferredBytes: number`(전달 완료 chunk 들의 byte 합), `totalBytes: number`(입력 plan.totalBytes 그대로), `remainingBytes: number`(= totalBytes - transferredBytes), `percentComplete: number`(0~100, totalBytes 0 이면 100), `complete: boolean`(deliveredChunks === totalChunks), `currentChunk: ExportChunk | null`(다음 전달할 chunk = chunks[deliveredChunks], 전부 전달됐으면 null), `currentRange: ExportChunkContentRange | null`(currentChunk 의 content-range 산정값, currentChunk null 이면 null), `headline: string`(한국어 한 줄 진행 요약)). `ExportChunkPlan` / `ExportChunk` 는 재사용(import). `ExportChunkStreamProgressOptions` 는 신설하지 않음(입력 단순).
- [ ] `describeExportChunkStreamProgress(plan, deliveredChunks)` 순수 함수: 입력 `ExportChunkPlan` 과 `deliveredChunks`(0 ≤ deliveredChunks ≤ plan.chunkCount)로부터 진행 상태를 산정. `totalChunks = plan.chunkCount`, `remainingChunks = totalChunks - deliveredChunks`, `transferredBytes = plan.chunks[0..deliveredChunks-1] 의 sizeBytes 합`(deliveredChunks=0 이면 0), `totalBytes = plan.totalBytes`, `remainingBytes = totalBytes - transferredBytes`, `complete = (deliveredChunks === totalChunks)`, `currentChunk = complete ? null : plan.chunks[deliveredChunks]`, `currentRange = currentChunk ? {firstBytePos: currentChunk.offsetBytes, lastBytePos: currentChunk.offsetBytes + currentChunk.sizeBytes - 1, totalBytes, chunkIndex: currentChunk.index} : null`. `percentComplete`: totalBytes === 0 → 100, 아니면 `Math.round((transferredBytes / totalBytes) * 100)`(0~100 clamp 불필요 — transferredBytes ≤ totalBytes 불변). 불변: `transferredBytes + remainingBytes === totalBytes`, `deliveredChunks + remainingChunks === totalChunks`, `complete ⟺ (remainingChunks === 0 && remainingBytes === 0)`, `currentChunk === null ⟺ complete`, `complete` 일 때 `percentComplete === 100`(totalBytes 0 포함). non-mutating(입력 plan / plan.chunks 변형 0, 반환 객체·중첩 객체 항상 새 것). 동일 입력 2회 호출은 동등 결과(순수·결정성).
- [ ] 빈/경계 입력 처리: `plan.chunkCount === 0`(0 byte plan) → `totalChunks=0`, `deliveredChunks` 는 0 만 허용(0 초과면 RangeError), `complete=true`, `currentChunk=null`, `currentRange=null`, `percentComplete=100`, `remainingBytes=0`. `deliveredChunks === 0`(아직 미시작, chunkCount>0) → `transferredBytes=0`, `percentComplete=0`, `currentChunk=chunks[0]`, `currentRange` 가 첫 chunk 경계. `deliveredChunks === totalChunks`(전부 전달, chunkCount>0) → `complete=true`, `currentChunk=null`, `transferredBytes=totalBytes`, `percentComplete=100`. 단일 chunk plan(chunkCount=1) 에서 deliveredChunks 0→1 진행 검증. 각 경계를 spec 으로 명시 검증.
- [ ] 입력 방어: `plan` 이 plain object 아님(null/배열/원시값) → 한국어 `TypeError`(label "plan"). `plan.chunkCount` 가 비-정수·음수 또는 `plan.chunks` 가 배열 아님 또는 `plan.chunks.length !== plan.chunkCount` 또는 `plan.totalBytes` 가 비-음수정수 아님 → `TypeError`(받은 값·불일치 박제 — 손상된 plan 거부). `deliveredChunks` 가 비-음수 정수 아님(음수·소수·NaN·Infinity·비-number) → `TypeError`(받은 값 박제). `deliveredChunks > plan.chunkCount` → 한국어 `RangeError`(deliveredChunks·chunkCount 박제 — 전달 chunk 가 전체 chunk 를 초과할 수 없음). 어느 쪽인지(TypeError vs RangeError) spec describe 로 박제·일관 적용.
- [ ] **Happy-path unit test**: 다중 chunk 진행(예 chunkCount=3, deliveredChunks=1 → remainingChunks=2, transferredBytes=첫 chunk size, currentChunk=chunks[1], currentRange firstBytePos/lastBytePos 정확), 미시작(deliveredChunks=0 → percentComplete=0, currentChunk=chunks[0]), 완료(deliveredChunks=chunkCount → complete=true, currentChunk=null, percentComplete=100), 0 byte plan(chunkCount=0, deliveredChunks=0 → complete=true, percentComplete=100) 각각의 모든 필드 기대값 검증 test 각 1+ (총 4+ happy test).
- [ ] **Error path unit test**: plan 비-object / plan.chunkCount 부적합(음수·소수·NaN) / plan.chunks 배열 아님 / plan.chunks.length !== chunkCount(손상) / plan.totalBytes 부적합 / deliveredChunks 부적합(음수·소수·NaN·Infinity·비-number) / deliveredChunks > chunkCount 초과 각각에 대해 throw 검증 test 1+ (메시지 label·받은 값 포함 확인). 단일 negative 만 작성 금지 — 부적합 입력 종류마다 분리.
- [ ] **Flow / branch 분리 test**: complete vs 진행중 분기(currentChunk null vs 값), deliveredChunks 0 / 중간 / 전체 분기, totalBytes 0 vs >0 의 percentComplete 분기(100 vs 산술), 잔여 chunk(마지막 chunk 가 잔여 size 인 plan)에서 transferredBytes 누적 정확성 분기 각 1+ test.
- [ ] **Negative cases 충분 cover**: `transferredBytes + remainingBytes === totalBytes`(byte 회계 일치), `deliveredChunks + remainingChunks === totalChunks`, `complete ⟺ (remainingChunks === 0 && remainingBytes === 0)`, `currentRange.lastBytePos === currentRange.firstBytePos + currentChunk.sizeBytes - 1`(content-range inclusive 경계 정확), `currentRange.totalBytes === plan.totalBytes` 불변을 미시작·중간·완료·잔여 chunk 케이스 전수로 검증하는 test 1+, non-mutating(입력 plan deepFreeze 통과 + 반환 객체가 호출마다 새 인스턴스 — 두 호출 결과 `!==` 이면서 deep-equal) 검증 1+, deliveredChunks 를 0→1→…→chunkCount 로 진행시키며 transferredBytes 가 단조 증가하고 마지막에 totalBytes 와 일치함을 검증하는 test 1+.
- [ ] `src/export/export-chunk-stream-progress.spec.ts` colocated spec 으로 위 test 작성(NestJS convention).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — 신규 파일은 100% 목표).

## Out of Scope

- 실 chunked streaming / byte slice 추출 / HTTP Range·Content-Range 헤더 직렬화(실제 `Content-Range: bytes a-b/c` 문자열 생성) / SSE·long-poll 전송 / resumable upload 배선 — 본 helper 는 진행 상태 산정 + content-range *수치* 산출만. 실 streaming·헤더 직렬화는 P5 service / controller layer(repository 게이트).
- REST controller / endpoint / HTTP 206 Partial Content 상태 mapping — repository 게이트 후속.
- `buildExportChunkPlan`(T-0469) / `estimateExportDumpSize`(T-0466) / `buildExportJobPlan`(T-0467) / `describeExportJobStatus`(T-0468) 재호출·재구현 — 본 helper 는 이미 산출된 `ExportChunkPlan` 과 `deliveredChunks` 만 입력으로 받는다(DRY — chunk plan 재계산 금지).
- chunk 전달 상태의 source(job store / DB row / in-memory transfer state) — 본 helper 는 인자로 받은 `deliveredChunks` 만 사용(상태 source 0).
- chunk 별 실제 record 분배 / 재시도·실패 chunk 추적 / ack 프로토콜 — 본 helper 는 순방향 진행률만, 실 전송 상태 머신은 streaming 게이트 후속.
- 새 외부 dependency 추가 금지.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시점)
