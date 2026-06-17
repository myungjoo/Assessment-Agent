---
id: T-0480
title: UC-07 §8 NFR chunked upload Import 측 수신 chunk 디스크립터가 완전·연속·무중복·정렬된 reassembly 가능한 시퀀스인지 순수 산술로 검증하는 helper validateImportChunkReassemblyOrder
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 195
estimatedFiles: 2
created: 2026-06-17
independentStream: uc07-export-import-helpers
dependsOn: []
touchesFiles:
  - src/export/import-chunk-reassembly-order.ts
  - src/export/import-chunk-reassembly-order.spec.ts
hqOrigin: null
plannerNote: "P7 UC-07 §8 NFR — export-streaming(throughput/progress/resume/refetch coalesce·savings·fragmentation·gap·retry-budget) 공간 포화. IMPORT 측으로 pivot: 업로드/수신된 dump chunk 디스크립터가 완전·연속·무중복·정렬된 reassembly 시퀀스인지 검증은 43 helper(T-0437~T-0479) 중 0회 cover(git grep ImportChunk|reassembl|nextExpectedOffset 0). export refetch-gap 은 *재요청* 대상, 본 helper 는 import *재조립 순서* 검증 — 직교. pr·게이트-free·dependsOn []."
---

# T-0480 — UC-07 §8 NFR chunked upload Import 측 수신 chunk reassembly 순서 검증 순수 helper validateImportChunkReassemblyOrder

## Why

UC-07 §8 NFR 은 대량 dump 의 전달을 "async job + status polling + **chunked streaming** + resumable upload" 로 설계한다(P5 별도 설계 — 본 task 는 순수 산술 helper 만). 지금까지의 chunked-streaming helper 들(T-0437~T-0479, 43개)은 **거의 전부 Export 측(다운로드)** 에 집중돼 있다 — `buildExportChunkPlan`·`describeExportChunkStreamProgress`·`buildExportChunkResumePlan`·`estimateExportChunkStreamThroughput`·`summariseExportChunkThroughputSeries`·refetch 계열(coalesce/savings/fragmentation/gap/retry-budget)·integrity reconcile 모두 export 가 chunk 를 *내보내는/재요청하는* 쪽이다.

그러나 chunked 전송에는 대칭되는 **Import 측(수신·업로드)** 책임이 있다: dump 가 여러 chunk 로 나뉘어 도착하면, importer 는 재조립(reassembly) 을 시작하기 전에 **수신한 chunk 디스크립터들이 하나의 완전한 byte 시퀀스를 이루는지** 검증해야 한다 — 빠진 chunk 가 없는가(완전성), 인접 chunk 의 byte 범위가 끊김 없이 이어지는가(연속성·gap 없음), 같은 범위가 두 번 오지 않았는가(무중복·overlap 없음), index 가 0..N-1 로 정렬돼 있는가(순서). 이 검증을 통과해야만 atomic Import transaction(§8 (b) — 부분 복원 상태 없음)을 안전하게 시작할 수 있다. payload 검증 실패는 §7.3(400 + 검증 메시지)·§7.4(transaction 시작 전 reject — DB 변경 0) 흐름으로 연결된다.

이 **import-side chunk reassembly-order 검증** 도메인은 43 helper 중 0 회 cover 된 gap 이다(`git grep -iwl "ImportChunk\|reassembl\|validateImportChunk\|nextExpectedOffset\|expectedSequence" src/` → 0 매칭 확인). Export 측 `summariseExportChunkRefetchGaps`(T-0476)는 *손상돼 재요청할* export chunk 의 byte gap 을 다루지만, 본 helper 는 *수신된 import chunk* 가 재조립 가능한 완전 시퀀스인지를 판정한다 — 방향(다운로드 vs 업로드)·목적(재요청 대상 산정 vs 재조립 go/no-go)이 직교한다. `import-merge-conflict`(T-0451)은 record-level 충돌, `import-preflight-summary`(T-0452)는 구조/크기 go/no-go 로 chunk 시퀀스 정합과 무관하다.

실 업로드 수신·byte slice·HTTP Range/206·resumable upload 프로토콜·타이머·시계 read 0 — chunk 디스크립터(index·offset·size)는 caller 가 전달하고, 본 helper 는 산술 검증만 한다.

## Required Reading

- `docs/use-cases/UC-07-export-import.md` §8 (NFR — async job + status polling + chunked streaming + resumable upload) + §7.3/§7.4 (payload 검증 실패 reject·transaction 시작 전 reject) + §8 (b) Import atomic transaction(부분 복원 상태 없음)
- `src/export/export-chunk-refetch-gap.ts` — byte gap/연속성 산정 패턴 mirror 대상(단, export 손상-chunk gap 과 직교 — 재호출 금지). `isPlainObject` / `describeNonObject` / `isValidNonNegativeInteger` 입력 방어 + 한국어 message convention + non-mutating·결정성·한국어 headline 패턴.
- `src/export/export-chunk-refetch-savings.ts` — 배열 입력을 단일 패스로 집계하는 순수 helper 코드 골격 mirror 대상(절감률 재산정 금지 — 본 helper 는 시퀀스 검증만).
- `CLAUDE.md` §3.2 (R-112 4종 test 의무) + §12 (언어 정책 — 식별자 영어, 메시지·주석 한국어)

## Acceptance Criteria

- [ ] `src/export/import-chunk-reassembly-order.ts` 신설. 신규 도메인 타입 신설: `ImportChunkDescriptor`(plain object: `index: number`(0-기반 chunk 순번 — 비-음수 정수), `offsetBytes: number`(이 chunk 가 차지하는 시작 byte offset — 비-음수 정수), `sizeBytes: number`(이 chunk 의 byte 크기 — 양의 정수, ≥ 1))와 입력 타입 `ImportChunkReassemblyOrderInput`(plain object: `chunks: ImportChunkDescriptor[]`(수신된 chunk 디스크립터 배열), `expectedTotalBytes: number`(완전 시퀀스의 총 byte 수 — 비-음수 정수))와 결과 타입 `ImportChunkReassemblyOrderReport`(plain object: `receivedChunkCount: number`(= chunks.length), `expectedTotalBytes: number`(입력 echo), `coveredBytes: number`(정렬·중복제거 없이 단순 sizeBytes 합), `complete: boolean`(빠진 index·gap·overlap 없이 0..N-1 이 끊김없이 expectedTotalBytes 를 정확히 덮음), `outOfOrder: boolean`(입력 순서가 index 오름차순이 아님), `missingIndexes: number[]`(0..maxIndex 중 누락된 index 오름차순), `duplicateIndexes: number[]`(중복 등장한 index 오름차순·중복제거), `gapBytes: number`(정렬 후 인접 chunk 사이 비어있는 총 byte), `overlapBytes: number`(정렬 후 인접 chunk 가 겹치는 총 byte), `byteShortfall: number`(= max(0, expectedTotalBytes - coveredBytes)), `nextExpectedOffset: number`(정렬된 시퀀스를 끊김 없이 따라갔을 때 다음에 와야 할 offset — 완전하면 expectedTotalBytes), `headline: string`(한국어 한 줄 — 수신/기대 chunk·완전성·누락·gap/overlap 요약)). 옵션 타입은 신설하지 않음.
- [ ] `validateImportChunkReassemblyOrder(input)` 순수 함수: 입력 chunks 를 (원본 비변형) index 기준 정렬한 복사본으로 위 필드를 단일 패스로 derive. 불변(invariant): `coveredBytes === chunks.sizeBytes 합`, `gapBytes >= 0 && overlapBytes >= 0`, `byteShortfall === max(0, expectedTotalBytes - coveredBytes)`, `complete ⟺ (missingIndexes.length === 0 && duplicateIndexes.length === 0 && gapBytes === 0 && overlapBytes === 0 && coveredBytes === expectedTotalBytes)`, `complete ⟹ outOfOrder 와 무관하게 시퀀스 자체는 유효`, `nextExpectedOffset` 은 정렬 후 연속 구간 끝(첫 gap/끝). non-mutating(입력 객체·배열 변형 0, 반환 객체·배열 항상 새 것). 동일 입력 2회 호출은 동등 결과(순수·결정성).
- [ ] 경계 입력 처리: `chunks` 빈 배열(complete=false·receivedChunkCount=0·coveredBytes=0·byteShortfall=expectedTotalBytes·missingIndexes=[]·nextExpectedOffset=0). 단일 chunk 완전(index=0·offset=0·size=expectedTotalBytes → complete=true). 누락 index 분기(0,2 수신·1 누락 → missingIndexes=[1]·complete=false). 중복 index 분기(0,0,1 → duplicateIndexes=[0]). gap 분기(chunk0 offset0 size10 + chunk1 offset20 size10 → gapBytes=10). overlap 분기(chunk0 offset0 size15 + chunk1 offset10 size10 → overlapBytes=5). outOfOrder 분기(입력이 index [1,0] → outOfOrder=true 이나 정렬 후 평가). byteShortfall 분기(coveredBytes < expectedTotalBytes) vs 정확 일치. 각 경계를 spec 으로 명시 검증.
- [ ] 입력 방어: `input` 이 plain object 아님(null/배열/원시값) → 한국어 `TypeError`(label "input"·받은 값 박제). `input.chunks` 가 배열 아님 → `TypeError`(label "chunks"). `input.chunks[i]` 가 plain object 아님 → `TypeError`(label·index 박제). `chunks[i].index` / `offsetBytes` 가 비-음수 유한 정수 아님, `chunks[i].sizeBytes` 가 양의 유한 정수(≥1) 아님(음수·0·NaN·Infinity·소수·비-number 각각), `input.expectedTotalBytes` 가 비-음수 유한 정수 아님 → 각각 `TypeError`(label·받은 값 박제). 각 위반 종류마다 spec 으로 박제·일관 적용.
- [ ] **Happy-path unit test**: 완전 정렬 시퀀스(0,1,2 끊김없이 expectedTotalBytes 정확 덮음 → complete=true·outOfOrder=false·gapBytes=0·overlapBytes=0·byteShortfall=0·nextExpectedOffset=expectedTotalBytes), 단일 chunk 완전, 입력이 뒤섞였으나 정렬 후 완전(outOfOrder=true·complete=true), headline 한국어 내용 검증 test 각 1+ (총 5+ happy test).
- [ ] **Error path unit test**: input 비-object / chunks 비-배열 / chunks[i] 비-object / index·offsetBytes 비-음수정수 아님(음수·NaN·Infinity·소수·비-number 각각) / sizeBytes 비-양의정수 아님(0·음수·NaN·Infinity·소수 각각) / expectedTotalBytes 비-음수정수 아님 각각에 대해 throw 검증 test 1+ (메시지 label·받은 값·index 포함 확인). 단일 negative 만 작성 금지 — 부적합 입력 종류마다 분리.
- [ ] **Flow / branch 분리 test**: 빈 chunks 분기 vs 비-빈 분기, complete=true vs false 의 각 false 원인(누락 index / 중복 index / gap / overlap / byteShortfall) 각 1+, outOfOrder true(입력 비정렬) vs false 분기, gapBytes 0 vs >0 분기, overlapBytes 0 vs >0 분기, byteShortfall 0(정확) vs >0(부족) 분기, nextExpectedOffset 이 완전 시(=expectedTotalBytes) vs 첫 gap 에서 멈춤 분기 각 1+ test.
- [ ] **Negative cases 충분 cover**: `coveredBytes === sizeBytes 합`, `byteShortfall === max(0, expectedTotalBytes - coveredBytes)`, `complete ⟺ (missing 0 && duplicate 0 && gap 0 && overlap 0 && coveredBytes === expectedTotalBytes)`, `gapBytes >= 0 && overlapBytes >= 0` 를 완전·누락·중복·gap·overlap·부족·비정렬 케이스 전수로 검증하는 test 1+, non-mutating(입력 객체·chunks 배열 deepFreeze 통과 + 반환 객체·배열이 호출마다 새 인스턴스 — 두 호출 결과 `!==` 이면서 deep-equal) 검증 1+.
- [ ] `src/export/import-chunk-reassembly-order.spec.ts` colocated spec 으로 위 test 작성(NestJS convention).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — 신규 파일은 100% 목표).

## Out of Scope

- Export 측 손상 chunk 재요청 byte 범위 병합·절감률·byte gap·범위 분산·재시도 횟수 예산 — `coalesceExportChunkRefetch`(T-0473)/`summariseExportChunkRefetchSavings`(T-0474)/`Fragmentation`(T-0475)/`Gaps`(T-0476)/`deriveExportChunkRefetchRetryBudget`(T-0479)의 책임. 본 helper 는 *수신된 import chunk* 의 재조립 순서·완전성 검증만(다운로드 재요청 도메인 재호출·재구현 금지).
- 실 업로드 수신 / byte slice 추출·재조립(실 bytes 결합) / HTTP Range·206 Partial Content·multipart upload / resumable upload 프로토콜 / SSE·long-poll 배선 — P5 service/controller layer(repository 게이트). 본 helper 는 chunk 디스크립터(index·offset·size) 수치만 검증.
- digest / checksum / 무결성 검증 — `computeDumpChecksum`/`verifyDumpChecksum`(T-0446)/`reconcileExportChunkIntegrity`(T-0472)의 책임. 본 helper 는 byte 범위 정합만(내용 무결성 0).
- dump 구조·schema 버전·크기·record merge 충돌·preflight go/no-go 검증 — `validateImportDumpStructure`(T-0440)/`checkSchemaVersionCompat`(T-0439)/`validateImportDumpSize`(T-0450)/`detectImportMergeConflicts`(T-0451)/`buildImportPreflightSummary`(T-0452)의 책임. 본 helper 는 chunk 시퀀스 정합만.
- 타이머·`Date.now()`·`setTimeout` 등 실 시계·스케줄 read(시계 read 0 — 모든 수치는 caller 전달).
- REST controller / endpoint / HTTP 상태 mapping / WebUI 업로드 진행·오류 안내 컴포넌트 렌더 — repository·WebUI 게이트 후속.
- 새 외부 dependency 추가 금지.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시점)
