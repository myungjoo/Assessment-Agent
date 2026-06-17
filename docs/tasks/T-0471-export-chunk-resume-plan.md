---
id: T-0471
title: UC-07 §8 NFR chunked streaming 중단 후 재개 지시(재개 시작 byte·잔여 chunk 목록·재개 Content-Range 수치·재개 필요 여부)를 산정하는 순수 helper buildExportChunkResumePlan
phase: P7
status: DONE
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 200
estimatedFiles: 2
created: 2026-06-17
independentStream: uc07-export-import-helpers
dependsOn: []
touchesFiles:
  - src/export/export-chunk-resume-plan.ts
  - src/export/export-chunk-resume-plan.spec.ts
hqOrigin: null
plannerNote: "P7 UC-07 §8 NFR — describeExportChunkStreamProgress(T-0470)는 순방향 진행 *view*만, chunked streaming 중단 후 *재개 지시*(재개 시작 byte·잔여 chunk·재개 Content-Range 수치·재개 필요 여부)는 34 helper 중 0회 cover. pr·게이트-free·dependsOn []."
---

# T-0471 — UC-07 §8 NFR chunked streaming 재개 지시를 산정하는 순수 helper buildExportChunkResumePlan

## Why

UC-07 §8 NFR 은 대량 dump 를 "async job + status polling + **chunked streaming**" 으로 전달하라 명시한다. 직전 `describeExportChunkStreamProgress`(T-0470)는 `ExportChunkStreamProgress{deliveredChunks, transferredBytes, percentComplete, currentChunk, currentRange, ...}` 으로 **순방향 진행 view**(지금 어디까지 왔나)를 렌더하지만, 전송이 중단(연결 끊김·timeout)됐다가 재개될 때 "어느 byte 부터 다시 보내야 하고·어떤 chunk 들이 잔여이며·재개 시 첫 chunk 의 Content-Range 수치는 무엇이고·애초에 재개가 필요하긴 한가" 의 **재개 지시(resume directive)** 산정은 34 helper 중 0 회 cover 된 gap 이다(`git grep ExportChunkResume|ChunkResumePlan|buildExportChunkResume|ResumeDirective|resumeFromChunk src/` → 0 매칭). `describeExportChunkStreamProgress`(T-0470)가 진행 *상태* 를 보여주는 read-only view 라면, 본 helper 는 그로부터 한 단계 앞 — 중단 지점에서 **무엇을 다시 해야 하는가** 의 actionable plan 을 순수 산술로 derive 한다(progress view 와 resume directive 의 책임 분리). UC-07 §5 step 13(Export 다운로드) + §8 chunked streaming 이 필요로 하는 resumable 전송(재시도·재개 offset 안내)을 채운다. 실 재전송 / byte slice / HTTP Range 요청 / 상태 머신 0 — 입력으로 받은 `ExportChunkPlan` 과 `acknowledgedChunks`(수신측이 ack 한 chunk 개수)만으로 재개 plan 을 순수 산술로 derive 한다.

## Required Reading

- `docs/use-cases/UC-07-export-import.md` §8 (NFR — async job + status polling + chunked streaming) + §5 step 13
- `src/export/export-chunk-plan.ts` — `ExportChunk{index, offsetBytes, sizeBytes, last}` + `ExportChunkPlan{totalBytes, chunkSizeBytes, chunkCount, chunks[], lastChunkSizeBytes, headline}` 타입(본 helper 의 입력으로 재사용 import) + `isPlainObject` / `describeNonObject` / `isValidNonNegativeInteger` / `isValidPositiveInteger` 입력 방어 + 한국어 message convention mirror 대상. **본 helper 는 chunk plan 을 재계산하지 않고 입력으로 받은 ExportChunkPlan 의 chunks 경계를 그대로 사용한다(DRY — buildExportChunkPlan 재호출 금지).**
- `src/export/export-chunk-stream-progress.ts` — `ExportChunkStreamProgress` / `ExportChunkContentRange`(content-range firstBytePos/lastBytePos/totalBytes/chunkIndex 산정 규칙) 구조·한국어 라벨 convention 참조(동형 패턴 mirror — progress view 와 resume directive 의 일관성). **본 helper 는 describeExportChunkStreamProgress 를 재호출하지 않는다(DRY — plan + acknowledgedChunks 만 입력).** content-range 수치 산정 공식(firstBytePos = offsetBytes, lastBytePos = offsetBytes + sizeBytes - 1)은 동일 규칙 적용.
- `CLAUDE.md` §3.2 (R-112 4종 test 의무) + §12 (언어 정책 — 식별자 영어, 메시지·주석 한국어)

## Acceptance Criteria

- [ ] `src/export/export-chunk-resume-plan.ts` 신설. 신규 도메인 타입만 신설: `ExportChunkResumePlan`(plain object: `resumeNeeded: boolean`(acknowledgedChunks < chunkCount), `acknowledgedChunks: number`(입력 그대로 — 이미 ack 된 chunk 개수), `acknowledgedBytes: number`(ack 된 chunk 들의 sizeBytes 합 = 재개 시작 byte offset), `resumeFromByte: number`(= acknowledgedBytes — 다음 전송이 시작할 byte offset; 전부 ack 됐으면 totalBytes), `remainingChunks: ExportChunk[]`(아직 ack 안 된 chunk 목록 = chunks[acknowledgedChunks..]의 복사본; 전부 ack 됐으면 빈 배열), `remainingChunkCount: number`(= chunkCount - acknowledgedChunks), `remainingBytes: number`(= totalBytes - acknowledgedBytes), `resumeRange: ExportChunkContentRange | null`(재개 시 첫 잔여 chunk 의 content-range = remainingChunks[0] 기준 수치; resumeNeeded=false 이면 null), `headline: string`(한국어 한 줄 재개 지시 요약)). `ExportChunkPlan` / `ExportChunk` / `ExportChunkContentRange` 는 재사용(import — content-range 타입은 export-chunk-stream-progress 에서 import). `ExportChunkResumePlanOptions` 는 신설하지 않음(입력 단순).
- [ ] `buildExportChunkResumePlan(plan, acknowledgedChunks)` 순수 함수: 입력 `ExportChunkPlan` 과 `acknowledgedChunks`(0 ≤ acknowledgedChunks ≤ plan.chunkCount)로부터 재개 plan 을 산정. `acknowledgedBytes = plan.chunks[0..acknowledgedChunks-1] 의 sizeBytes 합`(acknowledgedChunks=0 이면 0), `resumeFromByte = acknowledgedBytes`, `resumeNeeded = (acknowledgedChunks < plan.chunkCount)`, `remainingChunkCount = plan.chunkCount - acknowledgedChunks`, `remainingBytes = plan.totalBytes - acknowledgedBytes`, `remainingChunks = plan.chunks.slice(acknowledgedChunks).map(복사)`(원본 chunk 객체 mutate·공유 금지 — 새 객체로 복사), `resumeRange = resumeNeeded ? {firstBytePos: remainingChunks[0].offsetBytes, lastBytePos: remainingChunks[0].offsetBytes + remainingChunks[0].sizeBytes - 1, totalBytes: plan.totalBytes, chunkIndex: remainingChunks[0].index} : null`. 불변: `acknowledgedBytes + remainingBytes === totalBytes`, `acknowledgedChunks + remainingChunkCount === chunkCount`, `remainingChunks.length === remainingChunkCount`, `resumeNeeded ⟺ (remainingChunkCount > 0)`, `resumeRange === null ⟺ !resumeNeeded`, `resumeNeeded` 이면 `resumeFromByte === remainingChunks[0].offsetBytes`(재개 byte 가 첫 잔여 chunk 시작과 일치), `!resumeNeeded` 이면 `resumeFromByte === totalBytes && remainingBytes === 0`. non-mutating(입력 plan / plan.chunks 변형 0, 반환 객체·remainingChunks 항목·resumeRange 항상 새 것). 동일 입력 2회 호출은 동등 결과(순수·결정성).
- [ ] 빈/경계 입력 처리: `plan.chunkCount === 0`(0 byte plan) → `acknowledgedChunks` 는 0 만 허용(0 초과면 RangeError), `resumeNeeded=false`, `acknowledgedBytes=0`, `resumeFromByte=0`, `remainingChunks=[]`, `remainingChunkCount=0`, `remainingBytes=0`, `resumeRange=null`. `acknowledgedChunks === 0`(아직 미시작, chunkCount>0) → `resumeNeeded=true`, `acknowledgedBytes=0`, `resumeFromByte=0`, `remainingChunks` = 전체 chunks 복사, `resumeRange` 가 첫 chunk 경계. `acknowledgedChunks === chunkCount`(전부 ack, chunkCount>0) → `resumeNeeded=false`, `remainingChunks=[]`, `remainingBytes=0`, `resumeFromByte=totalBytes`, `resumeRange=null`. 단일 chunk plan(chunkCount=1) 에서 acknowledgedChunks 0→1 전환 검증. 각 경계를 spec 으로 명시 검증.
- [ ] 입력 방어: `plan` 이 plain object 아님(null/배열/원시값) → 한국어 `TypeError`(label "plan"). `plan.chunkCount` 가 비-정수·음수 또는 `plan.chunks` 가 배열 아님 또는 `plan.chunks.length !== plan.chunkCount` 또는 `plan.totalBytes` 가 비-음수정수 아님 → `TypeError`(받은 값·불일치 박제 — 손상된 plan 거부). `acknowledgedChunks` 가 비-음수 정수 아님(음수·소수·NaN·Infinity·비-number) → `TypeError`(받은 값 박제). `acknowledgedChunks > plan.chunkCount` → 한국어 `RangeError`(acknowledgedChunks·chunkCount 박제 — ack 된 chunk 가 전체 chunk 를 초과할 수 없음). 어느 쪽인지(TypeError vs RangeError) spec describe 로 박제·일관 적용.
- [ ] **Happy-path unit test**: 다중 chunk 부분 ack(예 chunkCount=3, acknowledgedChunks=1 → resumeNeeded=true, acknowledgedBytes=첫 chunk size, resumeFromByte=첫 chunk size, remainingChunks=[chunks[1],chunks[2]] 복사, resumeRange firstBytePos/lastBytePos 정확), 미시작(acknowledgedChunks=0 → resumeFromByte=0, remainingChunks=전체, resumeRange=첫 chunk), 완료(acknowledgedChunks=chunkCount → resumeNeeded=false, remainingChunks=[], resumeFromByte=totalBytes, resumeRange=null), 0 byte plan(chunkCount=0, acknowledgedChunks=0 → resumeNeeded=false, resumeRange=null) 각각의 모든 필드 기대값 검증 test 각 1+ (총 4+ happy test).
- [ ] **Error path unit test**: plan 비-object / plan.chunkCount 부적합(음수·소수·NaN) / plan.chunks 배열 아님 / plan.chunks.length !== chunkCount(손상) / plan.totalBytes 부적합 / acknowledgedChunks 부적합(음수·소수·NaN·Infinity·비-number) / acknowledgedChunks > chunkCount 초과 각각에 대해 throw 검증 test 1+ (메시지 label·받은 값 포함 확인). 단일 negative 만 작성 금지 — 부적합 입력 종류마다 분리.
- [ ] **Flow / branch 분리 test**: resumeNeeded true vs false 분기(resumeRange null vs 값, remainingChunks 빈 배열 vs 값), acknowledgedChunks 0 / 중간 / 전체 분기, 잔여 chunk(마지막 chunk 가 잔여 size 인 plan)에서 acknowledgedBytes·remainingBytes 산술 정확성 분기, resumeFromByte 가 첫 잔여 chunk offset 과 일치하는 분기 각 1+ test.
- [ ] **Negative cases 충분 cover**: `acknowledgedBytes + remainingBytes === totalBytes`(byte 회계 일치), `acknowledgedChunks + remainingChunkCount === chunkCount`, `remainingChunks.length === remainingChunkCount`, `resumeNeeded ⟺ (remainingChunkCount > 0)`, `resumeRange === null ⟺ !resumeNeeded`, `resumeNeeded` 일 때 `resumeRange.lastBytePos === resumeRange.firstBytePos + remainingChunks[0].sizeBytes - 1`(content-range inclusive 경계 정확) + `resumeRange.firstBytePos === resumeFromByte`(재개 byte 가 첫 잔여 chunk 시작과 일치) + `resumeRange.totalBytes === plan.totalBytes` 불변을 미시작·중간·완료·잔여 chunk 케이스 전수로 검증하는 test 1+, non-mutating(입력 plan deepFreeze 통과 + 반환 객체·remainingChunks 항목이 호출마다 새 인스턴스 — 두 호출 결과 `!==` 이면서 deep-equal, remainingChunks 항목이 plan.chunks 항목과 `!==`) 검증 1+, acknowledgedChunks 를 0→1→…→chunkCount 로 진행시키며 acknowledgedBytes 가 단조 증가하고 마지막에 totalBytes 와 일치하며 resumeNeeded 가 마지막에만 false 가 됨을 검증하는 test 1+.
- [ ] `src/export/export-chunk-resume-plan.spec.ts` colocated spec 으로 위 test 작성(NestJS convention).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — 신규 파일은 100% 목표).

## Out of Scope

- 실 재전송 / byte slice 추출 / HTTP Range 요청·206 Partial Content 응답 / Content-Range 헤더 직렬화(실제 `Content-Range: bytes a-b/c` 문자열 생성) / SSE·long-poll·resumable upload 프로토콜 배선 — 본 helper 는 재개 plan 산정 + content-range *수치* 산출만. 실 재전송·헤더 직렬화는 P5 service / controller layer(repository 게이트).
- REST controller / endpoint / HTTP 상태 mapping — repository 게이트 후속.
- `describeExportChunkStreamProgress`(T-0470) / `buildExportChunkPlan`(T-0469) / `buildExportJobPlan`(T-0467) / `describeExportJobStatus`(T-0468) 재호출·재구현 — 본 helper 는 이미 산출된 `ExportChunkPlan` 과 `acknowledgedChunks` 만 입력으로 받는다(DRY — chunk plan·progress view 재계산 금지). `ExportChunkContentRange` 타입은 export-chunk-stream-progress 에서 import 재사용(중복 정의 금지).
- ack 상태의 source(job store / DB row / in-memory transfer state / 수신측 ack 프로토콜) — 본 helper 는 인자로 받은 `acknowledgedChunks` 만 사용(상태 source 0).
- 재시도 정책 / 실패 chunk 식별 / backoff / 최대 재시도 횟수 / timeout 산정 — 본 helper 는 순방향 재개 offset·잔여 chunk 만, 실 재시도 상태 머신은 streaming 게이트 후속.
- 새 외부 dependency 추가 금지.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시점)
