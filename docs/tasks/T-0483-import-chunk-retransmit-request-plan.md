---
id: T-0483
title: UC-07 §8 NFR resumable upload Import 측 재조립 검증으로 드러난 누락 chunk index 를 인접 run 으로 묶어 클라이언트에 재업로드를 요청할 retransmit-request plan 을 순수 산술로 산정하는 helper buildImportChunkRetransmitRequest
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
  - src/export/import-chunk-retransmit-request.ts
  - src/export/import-chunk-retransmit-request.spec.ts
hqOrigin: null
plannerNote: "P7 UC-07 §8 NFR — IMPORT pivot 지속. resumable upload 가 중단·재개될 때 수신측은 빠진 chunk 를 클라이언트에 *재업로드 요청*해야 한다. T-0480 validateImportChunkReassemblyOrder 는 missingIndexes/gapBytes 를 *탐지(go/no-go)* 만 하고 actionable *재업로드 요청 plan*(어느 index 를 인접 run 으로 묶어 몇 번의 요청으로 얼마의 byte 를 다시 받을지)은 산정 안 함 — 46 helper 중 0회 cover(git grep buildImportChunkRetransmitRequest|ImportChunkRetransmit|retransmitRequest|missingChunkRequest 0 — issue-still-relevant pre-check). 이는 export 측 buildExportChunkResumePlan(T-0471, 보내는측 재개 directive)의 대칭 IMPORT(받는측 재업로드 요청 directive)이며 coalesceExportChunkRefetch(T-0473, 실패 export chunk 인접 byte 병합)의 import 측 mirror — 방향(보내는측 resume vs 받는측 request)·입력(ack 개수/실패 chunk vs 수신 ImportChunkDescriptor[]+expectedTotalChunks)·출력(resume range/coalesce range vs 재업로드 요청할 index run 배열)이 직교. ImportChunkDescriptor 는 import-chunk-reassembly-order.ts 에서 DRY-import(재정의 금지)·validateImportChunkReassemblyOrder 재호출 금지(missing 판정 로직 재구현 아닌 *요청 plan* 만). pr·게이트-free·dependsOn []·새 dep 0·시계 read 0·실 byte slice/HTTP Range 0. touchesFiles disjoint·maxConcurrentClaims=2 stage 5b direct-only 동시성과 무관(pr-mode 단독). 주의: 본 pure-helper vein(export/import chunked-streaming 산술 단추)은 46개 누적·전부 실 service/controller 미배선(schema/repository 게이트)·diminishing returns 근접 — 사람이 schema/repository 게이트 해소 또는 실 배선 task 로의 전환을 검토할 시점. 본 T-0483 은 그 전까지의 마지막 명백한 게이트-free 단추로 큐잉."
---

# T-0483 — UC-07 §8 NFR resumable upload Import 측 누락 chunk 재업로드 요청 plan 순수 helper buildImportChunkRetransmitRequest

## Why

UC-07 §8 NFR 은 대량 dump 전달을 "async job + status polling + chunked streaming + **resumable upload**" 로 설계한다(P5 별도 설계 — 본 task 는 순수 산술 helper 만). resumable upload 가 중단됐다가 재개될 때, importer 는 재조립을 시작하기 전에 *수신한 chunk 시퀀스에서 빠진 부분을 클라이언트에게 다시 보내달라고 요청* 해야 한다 — 즉 누락된 chunk index 를 식별해 "이 index 들을 재업로드 해 달라" 는 actionable 요청 plan 을 만들어야 한다.

직전 IMPORT 측 helper 들은 수신 chunk 를 (T-0480) 재조립 가능한 완전·연속·무중복·정렬 시퀀스인지 **검증(go/no-go)** 하고, (T-0481) 수신 진행 상태를 **렌더** 하고, (T-0482) 중복·overlap 수신 record 를 **dedup** 한다. 그러나 어느 helper 도 누락 chunk 의 **재업로드 요청 plan** 을 만들지 않는다: T-0480 은 `missingIndexes`·`gapBytes` 를 **탐지만** 할 뿐 그 누락 index 를 "몇 번의 요청으로·인접 run 으로 묶어·얼마의 byte 를 다시 받을지" 의 actionable 요청 단위로 묶지 않으며, T-0481 은 진행률만, T-0482 는 중복 해소만 한다. resumable upload 를 실제로 재개하려면 그 사이의 책임 — "재조립 검증이 드러낸 누락 index 들을 인접한 연속 run 으로 묶어, 클라이언트에 보낼 재업로드 요청 batch (요청 개수·각 run 의 index 범위·재수신할 byte 추정)를 산정" — 을 하는 **retransmit-request plan** helper 가 필요하다. 이 도메인은 46 helper(T-0437~T-0482) 중 0 회 cover 된 gap 이다(`git grep -icE "buildImportChunkRetransmitRequest|ImportChunkRetransmit|retransmitRequest|requestRetransmit|missingChunkRequest" src/` → 0 매칭 확인 — issue-still-relevant pre-check, exit 1).

본 helper 는 download(Export) 측 `buildExportChunkResumePlan`(T-0471 — *보내는* 측 재개 directive: 어느 byte 부터 다시 보낼지)의 대칭 IMPORT(*받는* 측 재업로드 요청 directive: 어느 chunk 를 다시 받을지)이며, 동시에 `coalesceExportChunkRefetch`(T-0473 — 실패 export chunk 의 인접 byte 범위 병합)의 import 측 mirror 이다. 그러나 방향(보내는 측 resume vs 받는 측 request)·입력(ack 개수/실패 chunk vs 수신 `ImportChunkDescriptor[]` + `expectedTotalChunks`)·출력(resume byte range / coalesce byte range vs 재업로드 요청할 **index run** 배열)이 직교한다. T-0480 validate 와도 직교한다: validate 는 **누락을 탐지(시작 가능?)** 하고, 본 helper 는 **누락을 어떻게 다시 받을지(요청 plan)** 를 산정한다 — 완전성 boolean·gap·overlap·정렬 재판정은 하지 않는다. 도메인 타입 `ImportChunkDescriptor` 는 T-0480 의 `import-chunk-reassembly-order.ts` 에서 그대로 import 해 재사용한다(DRY — 재정의 금지).

실 업로드 수신·byte slice·실 재조립·HTTP Range/206·resumable upload 프로토콜(tus 등)·타이머·시계 read 0 — chunk 디스크립터(index·offset·size)와 expectedTotalChunks 는 caller 가 전달하고, 본 helper 는 산술 요청 plan 만 한다.

## Required Reading

- `docs/use-cases/UC-07-export-import.md` §8 (NFR — async job + status polling + chunked streaming + resumable upload)
- `src/export/import-chunk-reassembly-order.ts` — `ImportChunkDescriptor`(index·offsetBytes·sizeBytes) 타입을 **import 해 재사용**(재정의 금지) + `isPlainObject`/`describeNonObject` 입력 방어 골격·한국어 message convention mirror 대상. 단 본 helper 는 *검증* 이 아니라 *재업로드 요청 plan* — `validateImportChunkReassemblyOrder` 재호출·완전성/연속성/gap/overlap 판정 로직 재구현 금지(누락 index 의 run 묶음·요청 통계만).
- `src/export/export-chunk-resume-plan.ts` — 보내는 측 재개 directive(T-0471)의 코드 골격 mirror 대상(non-mutating·결정성·한국어 headline·resumeNeeded boolean 패턴). 단 보내는 측 resume 와 직교 — 재호출 금지(본 helper 는 받는 측 누락 index 재업로드 요청, byte resume 아님).
- `src/export/export-chunk-refetch-coalesce.ts` — 인접 실패 chunk 를 연속 run 으로 병합하는 coalescing 패턴(T-0473)의 mirror 대상(연속 index run 묶기·firstIndex/lastIndex/count 노출·index 오름차순 결정성). 단 export byte-range coalesce 와 직교 — 재호출 금지(본 helper 는 import 누락 index run, byte 범위 병합 아님).
- `CLAUDE.md` §3.2 (R-112 4종 test 의무) + §12 (언어 정책 — 식별자 영어, 메시지·주석 한국어)

## Acceptance Criteria

- [ ] `src/export/import-chunk-retransmit-request.ts` 신설. `ImportChunkDescriptor` 는 `./import-chunk-reassembly-order` 에서 import(재정의 금지). 신규 타입: 입력 `ImportChunkRetransmitRequestInput`(plain object: `receivedChunks: ImportChunkDescriptor[]`(현재까지 수신된 chunk 디스크립터 배열 — 비-음수 index·offset, 양의 size), `expectedTotalChunks: number`(완전 시퀀스의 총 chunk 수 = 정상 index 범위 0..expectedTotalChunks-1, 비-음수 정수), `expectedChunkSizeBytes: number`(아직 수신 안 된 chunk 의 byte 크기 추정에 쓸 chunk 당 표준 byte 크기, 양의 정수 ≥1)). 결과 `ImportChunkRetransmitRequest`(plain object: `retransmitNeeded: boolean`(누락 index 가 1개 이상인가), `receivedChunkCount: number`(서로 다른 수신 index 수), `expectedTotalChunks: number`(입력 echo), `missingIndexes: number[]`(0..expectedTotalChunks-1 중 수신 안 된 index 오름차순), `missingChunkCount: number`(= missingIndexes.length), `runs: ImportChunkRetransmitRun[]`(인접한 누락 index 를 묶은 요청 run 배열 — firstIndex 오름차순; 누락 0 이면 빈 배열), `runCount: number`(= runs.length = 클라이언트에 보낼 재업로드 요청 개수), `estimatedRetransmitBytes: number`(= missingChunkCount × expectedChunkSizeBytes — 다시 받아야 할 byte 추정), `headline: string`(한국어 한 줄 — 누락 chunk 수·요청 run 수·재수신 byte 추정 요약)). run 타입 `ImportChunkRetransmitRun`(plain object: `firstIndex: number`(run 첫 누락 index), `lastIndex: number`(run 마지막 누락 index inclusive), `chunkCount: number`(= lastIndex - firstIndex + 1 = 이 run 의 연속 누락 chunk 수)). 옵션 타입 신설 안 함.
- [ ] `buildImportChunkRetransmitRequest(input)` 순수 함수: receivedChunks(원본 비변형)에서 수신된 index 집합을 만들고, 0..expectedTotalChunks-1 중 미수신 index 를 오름차순 missingIndexes 로 derive, 인접한(연속) 누락 index 를 하나의 run 으로 병합(예: 누락 [1,2,3,5] → run [{1,3,3},{5,5,1}]). retransmitNeeded === (missingChunkCount > 0). estimatedRetransmitBytes = missingChunkCount × expectedChunkSizeBytes. 불변(invariant): `missingChunkCount === missingIndexes.length`, `runs 의 chunkCount 합 === missingChunkCount`, `runCount === runs.length`, `retransmitNeeded ⟺ missingChunkCount > 0 ⟺ runCount > 0`, `runs 는 firstIndex 오름차순·인접 run 끼리 비-연속(run 사이에 최소 1개 수신 index 존재)`, `각 run 의 firstIndex ≤ lastIndex`, `estimatedRetransmitBytes === missingChunkCount × expectedChunkSizeBytes`, `retransmitNeeded=false 이면 runs=[] && missingIndexes=[] && estimatedRetransmitBytes=0`. expectedTotalChunks 를 넘는 index 가 receivedChunks 에 있어도 missingIndexes 산정 시 0..expectedTotalChunks-1 범위만 본다(범위 밖 수신 index 는 누락 판정에 무영향 — 단 같은 index 중복 수신은 서로 다른 index 수 집계 시 한 번만 셈). non-mutating(입력 객체·receivedChunks 배열·각 원소 변형 0, 반환 객체·배열·원소 모두 새 것). 동일 입력 2회 호출은 동등 결과(순수·결정성).
- [ ] 경계 입력 처리: `expectedTotalChunks=0`(receivedChunks 무관 → retransmitNeeded=false·missingIndexes=[]·runs=[]·estimatedRetransmitBytes=0). 전부 수신(receivedChunks 가 0..N-1 전부 cover → retransmitNeeded=false·runs=[]). 전부 누락(receivedChunks=[] 이고 expectedTotalChunks=N>0 → missingIndexes=[0..N-1]·단일 run {0,N-1,N}·estimatedRetransmitBytes=N×size). 산발 누락(누락 index 가 비-연속 → 여러 run 으로 분리). 단일 누락(1개 index → 단일 run chunkCount=1). 인접 누락(연속 index 여러 개 → 하나의 run 으로 병합). 수신 index 가 중복으로 들어와도(같은 index 2회) missingIndexes 산정에 무영향. 각 경계를 spec 으로 명시 검증.
- [ ] 입력 방어: `input` 이 plain object 아님(null/배열/원시값) → 한국어 `TypeError`(label "input"·받은 값 박제). `input.receivedChunks` 가 배열 아님 → `TypeError`(label "receivedChunks"). `input.receivedChunks[i]` 가 plain object 아님 → `TypeError`(label·index 박제). `receivedChunks[i].index` / `offsetBytes` 가 비-음수 유한 정수 아님, `receivedChunks[i].sizeBytes` 가 양의 유한 정수(≥1) 아님 → 각각 `TypeError`(label·받은 값·index 박제). `input.expectedTotalChunks` 가 비-음수 유한 정수 아님(음수·NaN·Infinity·소수·비-number) → `TypeError`(label "expectedTotalChunks"·받은 값 박제). `input.expectedChunkSizeBytes` 가 양의 유한 정수(≥1) 아님(0·음수·NaN·Infinity·소수·비-number) → `TypeError`(label "expectedChunkSizeBytes"·받은 값 박제). 각 위반 종류마다 spec 으로 박제·일관 적용.
- [ ] **Happy-path unit test**: 전부 수신(retransmitNeeded=false), 전부 누락(단일 run), 산발 누락(여러 run 분리), 인접 누락(하나의 run 병합), 단일 누락(run chunkCount=1), estimatedRetransmitBytes 산정, headline 한국어 내용 검증 test 각 1+ (총 6+ happy test).
- [ ] **Error path unit test**: input 비-object / receivedChunks 비-배열 / receivedChunks[i] 비-object / index·offsetBytes 비-음수정수 아님(음수·NaN·Infinity·소수·비-number 각각) / sizeBytes 비-양의정수 아님(0·음수·NaN·Infinity·소수 각각) / expectedTotalChunks 비-음수정수 아님(음수·NaN·Infinity·소수·비-number 각각) / expectedChunkSizeBytes 비-양의정수 아님(0·음수·NaN·Infinity·소수 각각) 각각에 대해 throw 검증 test 1+ (메시지 label·받은 값·index 포함 확인). 단일 negative 만 작성 금지 — 부적합 입력 종류마다 분리.
- [ ] **Flow / branch 분리 test**: expectedTotalChunks=0 분기 vs >0 분기, retransmitNeeded true vs false 분기, missingChunkCount 0 vs >0 분기, run 병합 분기(인접 누락 1 run vs 산발 누락 N run), 수신 index 중복 분기(중복 수신해도 missingIndexes 불변), 범위 밖 수신 index 분기(expectedTotalChunks 이상 index 가 누락 판정에 무영향) 각 1+ test.
- [ ] **Negative cases 충분 cover**: `missingChunkCount === missingIndexes.length`, `runs 의 chunkCount 합 === missingChunkCount`, `retransmitNeeded ⟺ missingChunkCount > 0 ⟺ runCount > 0`, `runs 가 firstIndex 오름차순·인접 run 끼리 비-연속`, `각 run 의 firstIndex ≤ lastIndex`, `estimatedRetransmitBytes === missingChunkCount × expectedChunkSizeBytes` 를 전부수신·전부누락·산발누락·인접누락·빈입력 케이스 전수로 검증하는 test 1+, non-mutating(입력 객체·receivedChunks 배열·각 원소 deepFreeze 통과 + 반환 객체·runs 배열·각 run 원소가 호출마다 새 인스턴스 — 두 호출 결과 `!==` 이면서 deep-equal) 검증 1+.
- [ ] `src/export/import-chunk-retransmit-request.spec.ts` colocated spec 으로 위 test 작성(NestJS convention).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — 신규 파일은 100% 목표).

## Out of Scope

- 수신 chunk 시퀀스의 완전·연속·정렬 *검증(go/no-go)*·gapBytes·overlapBytes·nextExpectedOffset 산정 — `validateImportChunkReassemblyOrder`(T-0480)의 책임. 본 helper 는 *누락 index 재업로드 요청 plan* 만(완전성 boolean·gap·overlap·정렬 재판정 금지 — missingIndexes 는 요청 plan 산물로만 산정).
- 중복·overlap 수신 record 의 유지/폐기 dedup·redundant byte 산정 — `planImportChunkDeduplication`(T-0482)의 책임. 본 helper 는 누락 index 요청만(중복 record 폐기 결정·keptChunks·redundantBytes 도출 금지 — 수신 index 집합 산정 시 중복은 한 번만 셈).
- 수신 진행 상태(진행률·status taxonomy·resumeOffset) 렌더 — `describeImportChunkUploadProgress`(T-0481)의 책임. 본 helper 는 누락 요청 plan 만(percentComplete·status·resumeOffset 도출 금지).
- 보내는(Export) 측 전송 재개 directive(어느 byte 부터 다시 보낼지)·content-range 수치 — `buildExportChunkResumePlan`/`coalesceExportChunkRefetch`(T-0471/T-0473)의 책임(다운로드 도메인 재호출·재구현 금지).
- 실 업로드 수신 / byte slice·재조립(실 bytes 결합) / HTTP Range·206 Partial Content·multipart·resumable upload 프로토콜(tus 등) / SSE·long-poll·재시도 정책·backoff·상태 머신 배선 — P5 service/controller layer(repository 게이트). 본 helper 는 chunk 디스크립터(index·offset·size)와 expectedTotalChunks 수치만으로 요청 plan.
- digest / checksum / 무결성 검증 — `computeDumpChecksum`/`verifyDumpChecksum`(T-0446)/`reconcileExportChunkIntegrity`(T-0472)의 책임. 본 helper 는 누락 index/byte 추정 수치만(내용 무결성 0).
- 타이머·`Date.now()`·`setTimeout` 등 실 시계·스케줄 read(시계 read 0 — 모든 수치는 caller 전달).
- REST controller / endpoint / HTTP 상태 mapping / WebUI 재업로드 요청 안내 컴포넌트 렌더 — repository·WebUI 게이트 후속.
- 새 외부 dependency 추가 금지.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시점)
