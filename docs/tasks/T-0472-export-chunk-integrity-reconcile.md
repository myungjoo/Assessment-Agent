---
id: T-0472
title: UC-07 §8 NFR chunked streaming 수신측 per-chunk 무결성 검증 결과로부터 재요청 지시(실패 chunk 식별·각 재요청 Content-Range 수치·재요청 byte 총량·전체 무결 여부)를 산정하는 순수 helper reconcileExportChunkIntegrity
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
  - src/export/export-chunk-integrity-reconcile.ts
  - src/export/export-chunk-integrity-reconcile.spec.ts
hqOrigin: null
plannerNote: "P7 UC-07 §8 NFR — buildExportChunkResumePlan(T-0471)는 연속 ack 지점 순방향 재개만, per-chunk 무결성 실패(비연속) 재요청 지시는 35 helper 중 0회 cover. dump-checksum(T-0446)은 전체 dump 만. pr·게이트-free·dependsOn []."
---

# T-0472 — UC-07 §8 NFR chunked streaming per-chunk 무결성 재요청 지시를 산정하는 순수 helper reconcileExportChunkIntegrity

## Why

UC-07 §8 NFR 은 대량 dump 를 "async job + status polling + **chunked streaming**" 으로 전달하라 명시한다. 직전 `buildExportChunkResumePlan`(T-0471)은 연속적으로 ack 된 chunk 개수(`acknowledgedChunks`)로부터 **순방향 재개**(어느 byte 부터 이어 보낼까)를 산정하지만, 전송 자체는 끊기지 않았어도 수신측이 chunk 별 무결성 검사(예: 각 chunk 의 digest 대조)에서 **비연속적인 실패**(예: chunk 0·2 는 통과, chunk 1·4 는 손상)를 발견한 경우 "어느 chunk 들을 다시 보내야 하고·각 재요청의 Content-Range 수치는 무엇이며·재요청 byte 총량은 얼마이고·애초에 전부 무결한가" 의 **재요청 지시(re-fetch directive)** 산정은 35 helper 중 0 회 cover 된 gap 이다(`git grep ChunkIntegrity|verifyExportChunk|ChunkChecksum|reconcileChunk|ChunkVerification src/` → 0 매칭). 전체 dump 단위 checksum helper `verifyDumpChecksum`(T-0446 `export-dump-checksum.ts`)는 dump 전체 1개 digest 대조만 — chunk 단위 무결성 reconcile 은 별도다. `buildExportChunkResumePlan`(T-0471)이 **연속** ack 경계 기준 forward resume 이라면, 본 helper 는 그와 직교(orthogonal) — 임의(비연속) chunk 집합의 무결성 실패를 받아 **그 chunk 들만** 골라 재요청 plan 을 순수 산술로 derive 한다. UC-07 §5 step 13(Export 다운로드) + §8 chunked streaming 이 필요로 하는 신뢰성 있는 전송(부분 손상 복구)을 채운다. 실 digest 계산 / 재전송 / HTTP Range 요청 / 상태 머신 0 — 입력으로 받은 `ExportChunkPlan` 과 chunk 별 무결성 결과(통과 여부 boolean 배열 또는 실패 index 집합)만으로 재요청 plan 을 순수 산술로 derive 한다.

## Required Reading

- `docs/use-cases/UC-07-export-import.md` §8 (NFR — async job + status polling + chunked streaming) + §5 step 13
- `src/export/export-chunk-plan.ts` — `ExportChunk{index, offsetBytes, sizeBytes, last}` + `ExportChunkPlan{totalBytes, chunkSizeBytes, chunkCount, chunks[], lastChunkSizeBytes, headline}` 타입(본 helper 의 입력으로 재사용 import) + `isPlainObject` / `describeNonObject` / `isValidNonNegativeInteger` / `isValidPositiveInteger` 입력 방어 + 한국어 message convention mirror 대상. **본 helper 는 chunk plan 을 재계산하지 않고 입력으로 받은 ExportChunkPlan 의 chunks 경계를 그대로 사용한다(DRY — buildExportChunkPlan 재호출 금지).**
- `src/export/export-chunk-stream-progress.ts` — `ExportChunkContentRange`(content-range firstBytePos/lastBytePos/totalBytes/chunkIndex 산정 규칙) 구조·한국어 라벨 convention 참조(동형 패턴 mirror). **본 helper 는 ExportChunkContentRange 를 import 재사용한다(중복 정의 금지).** content-range 수치 산정 공식(firstBytePos = offsetBytes, lastBytePos = offsetBytes + sizeBytes - 1)은 동일 규칙 적용.
- `src/export/export-chunk-resume-plan.ts` — `buildExportChunkResumePlan`(T-0471)의 직교 관계 확인용(연속 forward resume vs 비연속 무결성 재요청). **본 helper 는 buildExportChunkResumePlan 를 재호출하지 않는다(별개 책임).**
- `CLAUDE.md` §3.2 (R-112 4종 test 의무) + §12 (언어 정책 — 식별자 영어, 메시지·주석 한국어)

## Acceptance Criteria

- [ ] `src/export/export-chunk-integrity-reconcile.ts` 신설. 신규 도메인 타입만 신설: `ExportChunkIntegrityReconcile`(plain object: `allIntact: boolean`(실패 chunk 0개), `verifiedChunkCount: number`(입력 검증 결과 개수 = chunkCount), `intactChunkCount: number`(통과 chunk 개수), `failedChunkCount: number`(실패 chunk 개수), `failedChunks: ExportChunk[]`(실패한 chunk 목록 = 실패 index 의 plan.chunks 항목 복사본; index 오름차순; 모두 무결하면 빈 배열), `refetchRanges: ExportChunkContentRange[]`(각 실패 chunk 의 content-range 수치 배열; failedChunks 와 1:1 동순서; 모두 무결하면 빈 배열), `refetchBytes: number`(실패 chunk 들의 sizeBytes 합 = 재요청 총 byte; 모두 무결하면 0), `headline: string`(한국어 한 줄 재요청 지시 요약)). `ExportChunkPlan` / `ExportChunk` / `ExportChunkContentRange` 는 재사용(import — content-range 타입은 export-chunk-stream-progress 에서 import). 옵션 타입은 신설하지 않음(입력 단순).
- [ ] `reconcileExportChunkIntegrity(plan, chunkIntegrity)` 순수 함수: 입력 `ExportChunkPlan` 과 `chunkIntegrity`(길이 === plan.chunkCount 의 boolean 배열 — `chunkIntegrity[i] === true` 이면 chunk i 무결, false 이면 손상)로부터 재요청 plan 을 산정. `failedChunks = plan.chunks.filter((_, i) => chunkIntegrity[i] === false).map(복사)`(원본 chunk 객체 mutate·공유 금지 — 새 객체 복사; index 오름차순 유지), `failedChunkCount = failedChunks.length`, `intactChunkCount = plan.chunkCount - failedChunkCount`, `allIntact = (failedChunkCount === 0)`, `refetchBytes = failedChunks.reduce((s, c) => s + c.sizeBytes, 0)`, `refetchRanges = failedChunks.map(c => ({firstBytePos: c.offsetBytes, lastBytePos: c.offsetBytes + c.sizeBytes - 1, totalBytes: plan.totalBytes, chunkIndex: c.index}))`, `verifiedChunkCount = plan.chunkCount`. 불변: `intactChunkCount + failedChunkCount === chunkCount`, `failedChunks.length === failedChunkCount === refetchRanges.length`, `allIntact ⟺ (failedChunkCount === 0)`, `allIntact ⟺ (refetchBytes === 0)`, `allIntact ⟺ (refetchRanges.length === 0)`, `refetchBytes ≤ totalBytes`. non-mutating(입력 plan / plan.chunks / chunkIntegrity 변형 0, 반환 객체·failedChunks 항목·refetchRanges 항목 항상 새 것). 동일 입력 2회 호출은 동등 결과(순수·결정성).
- [ ] 빈/경계 입력 처리: `plan.chunkCount === 0`(0 byte plan) → `chunkIntegrity` 는 빈 배열만 허용(길이 0), `allIntact=true`, `verifiedChunkCount=0`, `intactChunkCount=0`, `failedChunkCount=0`, `failedChunks=[]`, `refetchRanges=[]`, `refetchBytes=0`. 전부 무결(chunkIntegrity 전부 true, chunkCount>0) → `allIntact=true`, `failedChunks=[]`, `refetchBytes=0`, `refetchRanges=[]`. 전부 손상(chunkIntegrity 전부 false, chunkCount>0) → `allIntact=false`, `failedChunks` = 전체 chunks 복사, `refetchBytes=totalBytes`, `refetchRanges` = 전체 chunk content-range. 비연속 실패(예 chunkCount=5, false at index 1·4) → `failedChunks=[chunks[1],chunks[4]]`, `refetchRanges` 동순서 2개, `refetchBytes` = 두 chunk size 합. 단일 chunk plan(chunkCount=1) 의 무결/손상 양분기 검증. 각 경계를 spec 으로 명시 검증.
- [ ] 입력 방어: `plan` 이 plain object 아님(null/배열/원시값) → 한국어 `TypeError`(label "plan"). `plan.chunkCount` 가 비-정수·음수 또는 `plan.chunks` 가 배열 아님 또는 `plan.chunks.length !== plan.chunkCount` 또는 `plan.totalBytes` 가 비-음수정수 아님 → `TypeError`(받은 값·불일치 박제 — 손상된 plan 거부). `chunkIntegrity` 가 배열 아님 → `TypeError`(label "chunkIntegrity", 받은 값 박제). `chunkIntegrity` 항목 중 boolean 아님(숫자·문자·null·undefined) → `TypeError`(부적합 index·받은 값 박제). `chunkIntegrity.length !== plan.chunkCount` → 한국어 `RangeError`(chunkIntegrity 길이·chunkCount 박제 — 검증 결과 개수가 chunk 개수와 불일치). 어느 쪽인지(TypeError vs RangeError) spec describe 로 박제·일관 적용.
- [ ] **Happy-path unit test**: 비연속 부분 실패(chunkCount=5, false at 1·4 → allIntact=false, failedChunks=[chunks[1],chunks[4]] 복사, refetchRanges 2개 firstBytePos/lastBytePos/chunkIndex 정확, refetchBytes=두 size 합), 전부 무결(chunkIntegrity 전부 true → allIntact=true, failedChunks=[], refetchBytes=0, refetchRanges=[]), 전부 손상(전부 false → failedChunks=전체, refetchBytes=totalBytes), 0 byte plan(chunkCount=0, chunkIntegrity=[] → allIntact=true) 각각의 모든 필드 기대값 검증 test 각 1+ (총 4+ happy test).
- [ ] **Error path unit test**: plan 비-object / plan.chunkCount 부적합(음수·소수·NaN) / plan.chunks 배열 아님 / plan.chunks.length !== chunkCount(손상) / plan.totalBytes 부적합 / chunkIntegrity 배열 아님 / chunkIntegrity 항목 비-boolean(숫자·문자·null) / chunkIntegrity.length !== chunkCount 불일치 각각에 대해 throw 검증 test 1+ (메시지 label·받은 값 포함 확인). 단일 negative 만 작성 금지 — 부적합 입력 종류마다 분리.
- [ ] **Flow / branch 분리 test**: allIntact true vs false 분기(failedChunks 빈 배열 vs 값, refetchRanges 빈 배열 vs 값, refetchBytes 0 vs 양수), 비연속 실패 vs 연속 실패 분기(filter 순서 보존 확인), 잔여 chunk(마지막 chunk 가 잔여 size)가 실패에 포함된 경우 refetchBytes 산술 정확성 분기, 첫 chunk·마지막 chunk·중간 chunk 만 각각 실패하는 분기 각 1+ test.
- [ ] **Negative cases 충분 cover**: `intactChunkCount + failedChunkCount === chunkCount`(chunk 회계 일치), `failedChunks.length === failedChunkCount === refetchRanges.length`, `allIntact ⟺ (failedChunkCount === 0) ⟺ (refetchBytes === 0) ⟺ (refetchRanges.length === 0)`, 각 refetchRange 에 대해 `lastBytePos === firstBytePos + 대응 failedChunk.sizeBytes - 1`(content-range inclusive 경계 정확) + `firstBytePos === 대응 failedChunk.offsetBytes` + `chunkIndex === 대응 failedChunk.index` + `totalBytes === plan.totalBytes` 불변을 비연속·전부실패·단일실패 케이스 전수로 검증하는 test 1+, `refetchBytes ≤ totalBytes` 및 전부 손상 시 `refetchBytes === totalBytes` 검증 1+, non-mutating(입력 plan·chunkIntegrity deepFreeze 통과 + 반환 객체·failedChunks 항목·refetchRanges 항목이 호출마다 새 인스턴스 — 두 호출 결과 `!==` 이면서 deep-equal, failedChunks 항목이 plan.chunks 항목과 `!==`) 검증 1+, failedChunks 가 항상 index 오름차순임을 비연속 실패 케이스로 검증하는 test 1+.
- [ ] `src/export/export-chunk-integrity-reconcile.spec.ts` colocated spec 으로 위 test 작성(NestJS convention).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — 신규 파일은 100% 목표).

## Out of Scope

- 실 digest / checksum 계산 / chunk 내용 비교 / HMAC / 암호화 무결성 검증 — 본 helper 는 이미 산출된 chunk 별 무결성 결과(boolean 배열)만 입력으로 받는다(실 검증 계산 0). 전체 dump checksum 은 `verifyDumpChecksum`(T-0446) 의 책임.
- 실 재전송 / byte slice 추출 / HTTP Range 요청·206 Partial Content 응답 / Content-Range 헤더 직렬화(실제 `Content-Range: bytes a-b/c` 문자열 생성) / multipart 응답 — 본 helper 는 재요청 plan 산정 + content-range *수치* 산출만. 실 재전송·헤더 직렬화는 P5 service / controller layer(repository 게이트).
- REST controller / endpoint / HTTP 상태 mapping — repository 게이트 후속.
- `buildExportChunkResumePlan`(T-0471) / `describeExportChunkStreamProgress`(T-0470) / `buildExportChunkPlan`(T-0469) / `verifyDumpChecksum`(T-0446) 재호출·재구현 — 본 helper 는 이미 산출된 `ExportChunkPlan` 과 chunk 별 무결성 boolean 배열만 입력으로 받는다(DRY — chunk plan·resume plan·dump checksum 재계산 금지). `ExportChunkContentRange` 타입은 export-chunk-stream-progress 에서 import 재사용(중복 정의 금지).
- 무결성 결과의 source(수신측 검증 프로토콜 / job store / DB / digest 비교 로직) — 본 helper 는 인자로 받은 `chunkIntegrity` boolean 배열만 사용(상태 source 0).
- 재시도 정책 / backoff / 최대 재시도 횟수 / timeout 산정 / 재요청 우선순위 — 본 helper 는 실패 chunk 식별·재요청 offset·byte 총량만, 실 재시도 상태 머신은 streaming 게이트 후속.
- 새 외부 dependency 추가 금지.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시점)
