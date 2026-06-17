---
id: T-0473
title: UC-07 §8 NFR chunked streaming per-chunk 무결성 재요청 지시(T-0472)의 인접 실패 chunk 를 연속 byte 범위로 병합해 재요청 HTTP Range 요청 수를 최소화하는 순수 helper coalesceExportChunkRefetch
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 220
estimatedFiles: 2
created: 2026-06-17
independentStream: uc07-export-import-helpers
dependsOn: []
touchesFiles:
  - src/export/export-chunk-refetch-coalesce.ts
  - src/export/export-chunk-refetch-coalesce.spec.ts
hqOrigin: null
plannerNote: "P7 UC-07 §8 NFR — reconcileExportChunkIntegrity(T-0472)는 실패 chunk 별 content-range 를 1:1 로 나열만, 인접 실패 chunk 를 연속 byte 범위로 병합(재요청 Range 요청 수 최소화)은 36 helper 중 0회 cover. pr·게이트-free·dependsOn []."
---

# T-0473 — UC-07 §8 NFR chunked streaming 재요청 인접 chunk 연속 byte 범위 병합 순수 helper coalesceExportChunkRefetch

## Why

UC-07 §8 NFR 은 대량 dump 를 "async job + status polling + **chunked streaming**" 으로 전달하라 명시한다. 직전 `reconcileExportChunkIntegrity`(T-0472)는 수신측 per-chunk 무결성 검사 결과(boolean 배열)로부터 실패한 chunk 들을 골라 **각 실패 chunk 마다 content-range 를 1:1 로** 나열한 재요청 지시(`refetchRanges: ExportChunkContentRange[]`)를 산정한다. 그러나 실패 chunk 가 **연속**으로 발생한 경우(예: chunk 1·2·3 이 모두 손상) 이를 chunk 1개당 HTTP Range 요청 하나씩 — 즉 3 개의 분리된 재요청으로 보내는 것은 비효율이며, UC-07 §8 NFR 이 요구하는 효율적 전송에 반한다. 인접한 실패 chunk 들을 **하나의 연속 byte 범위**(`bytes=offset(1)-end(3)`)로 병합해 **재요청 HTTP Range 요청 수를 최소화**하는 합성(coalescing)은 36 helper 중 0 회 cover 된 gap 이다(`git grep coalesce|mergeRange|RefetchBatch|contiguous|coalesceRefetch|RangeBatch|batchRefetch src/export` → 0 매칭; `src/scheduling/backfill-plan` 의 무관 매칭만 존재).

`reconcileExportChunkIntegrity`(T-0472)가 실패 chunk 를 **식별·열거**(per-chunk 1:1 범위)한다면, 본 helper 는 그와 직교(orthogonal) — 이미 산출된 무결성 reconcile 결과의 `failedChunks`(index 오름차순 보장)를 받아 **연속 index 의 실패 chunk 들을 하나의 byte 범위로 병합**한 재요청 batch plan 을 순수 산술로 derive 한다(실 재전송·byte slice·HTTP Range·헤더 직렬화 0). 비연속 실패(예: chunk 1·4)는 분리된 2 개 범위로, 연속 실패(예: chunk 1·2·3)는 하나의 병합 범위로 derive 한다. UC-07 §5 step 13(Export 다운로드) + §8 chunked streaming 의 효율적 부분 손상 복구(재요청 요청 수 최소화)를 채운다.

## Required Reading

- `docs/use-cases/UC-07-export-import.md` §8 (NFR — async job + status polling + chunked streaming) + §5 step 13
- `src/export/export-chunk-integrity-reconcile.ts` — `ExportChunkIntegrityReconcile{allIntact, verifiedChunkCount, intactChunkCount, failedChunkCount, failedChunks: ExportChunk[], refetchRanges: ExportChunkContentRange[], refetchBytes, headline}` 타입(본 helper 의 입력으로 재사용 import) + `isPlainObject` / `describeNonObject` / `isValidNonNegativeInteger` 입력 방어 + 한국어 message convention mirror 대상. **본 helper 는 무결성 검증을 재실행하지 않고 입력으로 받은 `ExportChunkIntegrityReconcile` 의 `failedChunks` 를 그대로 사용한다(DRY — reconcileExportChunkIntegrity 재호출 금지).**
- `src/export/export-chunk-plan.ts` — `ExportChunk{index, offsetBytes, sizeBytes, last}` 타입(`failedChunks` 항목의 shape — 병합 범위 산정의 offset/size 입력) + 입력 방어 helper 동형 참조.
- `src/export/export-chunk-stream-progress.ts` — `ExportChunkContentRange{firstBytePos, lastBytePos, totalBytes, chunkIndex}` 구조·content-range inclusive 경계 규칙(firstBytePos = offsetBytes, lastBytePos = offsetBytes + sizeBytes - 1) 참조(동형 패턴 mirror). 본 helper 의 병합 범위 byte 산정도 동일 inclusive 규칙 적용(단, chunkIndex 대신 병합된 첫·끝 chunk index 를 별도 필드로 노출 — 아래 타입 참조).
- `CLAUDE.md` §3.2 (R-112 4종 test 의무) + §12 (언어 정책 — 식별자 영어, 메시지·주석 한국어)

## Acceptance Criteria

- [ ] `src/export/export-chunk-refetch-coalesce.ts` 신설. 신규 도메인 타입만 신설: `ExportChunkRefetchRange`(plain object: `firstBytePos: number`(병합 범위 시작 byte = 그룹 첫 실패 chunk 의 offsetBytes), `lastBytePos: number`(병합 범위 끝 byte inclusive = 그룹 마지막 실패 chunk 의 offsetBytes + sizeBytes - 1), `byteLength: number`(= lastBytePos - firstBytePos + 1 = 그룹 chunk sizeBytes 합), `firstChunkIndex: number`(그룹 첫 chunk index), `lastChunkIndex: number`(그룹 마지막 chunk index), `chunkCount: number`(그룹에 포함된 연속 chunk 개수)) + `ExportChunkRefetchBatch`(plain object: `allIntact: boolean`(병합할 실패 chunk 0개), `failedChunkCount: number`(병합 전 실패 chunk 총 개수 = reconcile.failedChunkCount), `rangeCount: number`(병합 후 연속 범위 개수 = ranges.length), `ranges: ExportChunkRefetchRange[]`(병합된 연속 byte 범위 배열; firstBytePos 오름차순; 모두 무결하면 빈 배열), `refetchBytes: number`(병합 범위 byteLength 합 = reconcile.refetchBytes 와 동일), `headline: string`(한국어 한 줄 — 병합 결과·재요청 범위 개수 요약)). `ExportChunkIntegrityReconcile` / `ExportChunk` 는 재사용(import). 옵션 타입은 신설하지 않음.
- [ ] `coalesceExportChunkRefetch(reconcile)` 순수 함수: 입력 `ExportChunkIntegrityReconcile`(T-0472)의 `failedChunks`(index 오름차순)를 **index 가 연속(인접)한 그룹으로 분할**해 각 그룹을 하나의 `ExportChunkRefetchRange` 로 병합. 그룹화 규칙: `failedChunks` 를 순회하며 직전 chunk 의 `index + 1 === 현재 chunk.index` 이면 같은 그룹, 아니면 새 그룹 시작(연속 index 만 병합 — offset 인접성이 아니라 chunk index 인접성 기준; ExportChunkPlan 의 chunk 는 gap/overlap 0 이므로 index 연속 ⟺ byte 연속). 각 그룹에 대해 `firstBytePos = 그룹 첫 chunk.offsetBytes`, `lastBytePos = 그룹 마지막 chunk.offsetBytes + 마지막 chunk.sizeBytes - 1`, `byteLength = lastBytePos - firstBytePos + 1`, `firstChunkIndex = 그룹 첫 chunk.index`, `lastChunkIndex = 그룹 마지막 chunk.index`, `chunkCount = 그룹 chunk 개수`. `allIntact = reconcile.allIntact`, `failedChunkCount = reconcile.failedChunkCount`, `rangeCount = ranges.length`, `refetchBytes = ranges 의 byteLength 합`. 불변: `ranges 의 chunkCount 합 === failedChunkCount`, `refetchBytes === reconcile.refetchBytes`, `rangeCount <= failedChunkCount`(병합으로 같거나 줄어듦), `allIntact ⟺ (ranges.length === 0) ⟺ (failedChunkCount === 0) ⟺ (refetchBytes === 0)`, 각 range 의 `byteLength === lastBytePos - firstBytePos + 1`, ranges 는 firstBytePos 오름차순(인접 range 끼리 byte gap 존재 — 연속이면 병합됐을 것). non-mutating(입력 reconcile / reconcile.failedChunks 변형 0, 반환 객체·ranges 항목 항상 새 것). 동일 입력 2회 호출은 동등 결과(순수·결정성).
- [ ] 빈/경계 입력 처리: `reconcile.allIntact === true`(failedChunks 빈) → `allIntact=true`, `ranges=[]`, `rangeCount=0`, `refetchBytes=0`, `failedChunkCount=0`. 단일 실패 chunk → `rangeCount=1`, range 의 `chunkCount=1`, `firstChunkIndex===lastChunkIndex`. 전부 연속 실패(예 chunk 0·1·2·3·4 전부) → `rangeCount=1`, 하나의 범위가 전체 chunk 병합(`chunkCount===failedChunkCount`, `firstBytePos=0`, `lastBytePos=totalBytes-1` 동형). 전부 비연속 실패(예 chunk 0·2·4) → `rangeCount=3`, 각 range `chunkCount=1`. 혼합(예 chunk 1·2·4 — 1·2 연속·4 분리) → `rangeCount=2`(첫 range chunkCount=2, 둘째 chunkCount=1). 각 경계를 spec 으로 명시 검증.
- [ ] 입력 방어: `reconcile` 이 plain object 아님(null/배열/원시값) → 한국어 `TypeError`(label "reconcile"). `reconcile.failedChunks` 가 배열 아님 → `TypeError`(label "reconcile.failedChunks", 받은 값 박제). `reconcile.failedChunks` 항목이 plain object 아님 또는 `index`/`offsetBytes`/`sizeBytes` 가 비-음수정수 아님(`sizeBytes` 는 양의 정수) → `TypeError`(부적합 index·받은 값 박제 — 손상된 reconcile 거부). `reconcile.failedChunks` 가 index 오름차순 아님(직전 index >= 현재 index — 정렬 위반·중복) → 한국어 `RangeError`(위반 위치 index 박제 — 입력 계약 위반). `reconcile.allIntact`/`reconcile.failedChunkCount` 와 `failedChunks` 의 모순(예: allIntact=true 인데 failedChunks 비어있지 않음, 또는 failedChunkCount !== failedChunks.length) → `RangeError`(모순 박제 — 손상된 reconcile). 어느 쪽인지(TypeError vs RangeError) spec describe 로 박제·일관 적용.
- [ ] **Happy-path unit test**: 연속 실패 그룹 병합(chunk 1·2·3 연속 → rangeCount=1, range firstBytePos=chunks[1].offset, lastBytePos=chunks[3].offset+size-1, byteLength=세 size 합, chunkCount=3), 비연속 실패(chunk 0·2·4 → rangeCount=3 각 chunkCount=1), 혼합(chunk 1·2·4 → rangeCount=2), allIntact(failedChunks=[] → ranges=[], refetchBytes=0) 각각의 모든 필드 기대값 검증 test 각 1+ (총 4+ happy test).
- [ ] **Error path unit test**: reconcile 비-object / reconcile.failedChunks 배열 아님 / failedChunks 항목 비-object / 항목 index·offsetBytes 비-음수정수 아님 / 항목 sizeBytes 비-양정수 / failedChunks 오름차순 위반(역순·중복 index) / allIntact 와 failedChunks 모순 / failedChunkCount 와 failedChunks.length 불일치 각각에 대해 throw 검증 test 1+ (메시지 label·받은 값·위반 위치 포함 확인, TypeError vs RangeError 구분 확인). 단일 negative 만 작성 금지 — 부적합 입력 종류마다 분리.
- [ ] **Flow / branch 분리 test**: allIntact true vs false 분기(ranges 빈 배열 vs 값), 연속 그룹 vs 비연속(병합 vs 분리) 분기, 그룹 경계 분기(직전 index+1 === 현재 index 일 때 같은 그룹 / 아닐 때 새 그룹) — 첫·중간·마지막 chunk 만 실패하는 분기 각 1+, 단일 chunk plan(chunkCount=1)·단일 실패 분기, 잔여(마지막) chunk 가 병합 그룹의 끝인 경우 lastBytePos 산술 정확성 분기 각 1+ test.
- [ ] **Negative cases 충분 cover**: `ranges 의 chunkCount 합 === failedChunkCount`(병합 전후 chunk 회계 일치), `refetchBytes === reconcile.refetchBytes`(병합이 byte 총량 보존), `rangeCount <= failedChunkCount`(병합으로 감소), `allIntact ⟺ (ranges.length === 0) ⟺ (failedChunkCount === 0) ⟺ (refetchBytes === 0)`, 각 range 의 `byteLength === lastBytePos - firstBytePos + 1` 및 `byteLength === 그룹 chunk sizeBytes 합`, `firstChunkIndex <= lastChunkIndex` 및 `lastChunkIndex - firstChunkIndex + 1 === chunkCount`, ranges 가 firstBytePos 오름차순·인접 range 사이 byte gap 존재(연속이면 병합됐을 것)임을 연속·비연속·혼합 케이스 전수로 검증하는 test 1+, non-mutating(입력 reconcile·failedChunks deepFreeze 통과 + 반환 객체·ranges 항목이 호출마다 새 인스턴스 — 두 호출 결과 `!==` 이면서 deep-equal) 검증 1+.
- [ ] `src/export/export-chunk-refetch-coalesce.spec.ts` colocated spec 으로 위 test 작성(NestJS convention).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — 신규 파일은 100% 목표).

## Out of Scope

- 실 digest / checksum 계산 / chunk 무결성 검증 — 본 helper 는 이미 산출된 `ExportChunkIntegrityReconcile`(T-0472) 의 `failedChunks` 만 입력으로 받는다(무결성 검증 재실행 0). chunk 별 무결성 판정은 `reconcileExportChunkIntegrity`(T-0472) 의 책임, 전체 dump checksum 은 `verifyDumpChecksum`(T-0446) 의 책임.
- 실 재전송 / byte slice 추출 / HTTP Range 요청 발행·206 Partial Content 응답 / `Content-Range: bytes a-b/c` 또는 `Range: bytes=a-b` 헤더 문자열 직렬화 / multipart 응답 — 본 helper 는 재요청 **byte 범위 수치 병합**만. 실 재전송·헤더 직렬화는 P5 service / controller layer(repository 게이트).
- REST controller / endpoint / HTTP 상태 mapping — repository 게이트 후속.
- `reconcileExportChunkIntegrity`(T-0472) / `buildExportChunkResumePlan`(T-0471) / `describeExportChunkStreamProgress`(T-0470) / `buildExportChunkPlan`(T-0469) 재호출·재구현 — 본 helper 는 이미 산출된 `ExportChunkIntegrityReconcile` 만 입력으로 받는다(DRY — 무결성 reconcile·chunk plan·resume plan 재계산 금지). `ExportChunk` 는 export-chunk-plan 에서, `ExportChunkIntegrityReconcile` 는 export-chunk-integrity-reconcile 에서 import 재사용(중복 정의 금지).
- 무결성 결과의 source(수신측 검증 프로토콜 / job store / DB / digest 비교 로직) — 본 helper 는 인자로 받은 `ExportChunkIntegrityReconcile` 만 사용(상태 source 0).
- 재시도 정책 / backoff / 최대 재요청 횟수 / timeout / 재요청 우선순위 / 병렬 재전송 스케줄링 — 본 helper 는 연속 byte 범위 병합만, 실 재시도 상태 머신은 streaming 게이트 후속.
- 새 외부 dependency 추가 금지.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시점)
