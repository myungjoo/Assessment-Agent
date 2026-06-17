---
id: T-0482
title: UC-07 §8 NFR resumable upload Import 측 재전송으로 중복·overlap 된 수신 chunk 디스크립터에서 재조립용 유지/폐기 집합과 제거 통계를 순수 산술로 산정하는 helper planImportChunkDeduplication
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
  - src/export/import-chunk-dedup-plan.ts
  - src/export/import-chunk-dedup-plan.spec.ts
hqOrigin: null
plannerNote: "P7 UC-07 §8 NFR — IMPORT pivot 지속. resumable upload 는 재개 시 같은 chunk 를 재전송할 수 있어 수신 디스크립터에 중복 index·overlap byte 범위가 섞인다. T-0480 validate 는 duplicateIndexes/overlapBytes 를 *탐지(go/no-go)* 만 하고 actionable *dedup 계획*(유지/폐기 record 집합·제거 통계)은 산정 안 함 — 45 helper 중 0 회 cover(git grep ImportChunkDedup|dedupImportChunk|duplicateChunks 0). download refetch coalesce(T-coalesce)의 대칭 IMPORT 측 resolve. ImportChunkDescriptor DRY-import. pr·게이트-free·dependsOn []·시계 read 0·실 byte slice 0."
---

# T-0482 — UC-07 §8 NFR resumable upload Import 측 중복·overlap 수신 chunk dedup 계획 순수 helper planImportChunkDeduplication

## Why

UC-07 §8 NFR 은 대량 dump 전달을 "async job + status polling + chunked streaming + **resumable upload**" 로 설계한다(P5 별도 설계 — 본 task 는 순수 산술 helper 만). resumable upload 의 본질상 업로드가 중단됐다가 재개될 때, importer 는 이미 받은 chunk 를 클라이언트가 **재전송**할 수 있다 — 즉 수신된 chunk 디스크립터 배열에는 같은 `index` 가 두 번 이상 나타나거나, 서로 다른 디스크립터가 같은 byte 범위를 부분/완전 **overlap** 하는 일이 자연스럽게 발생한다.

직전 helper 들은 IMPORT 측 수신 chunk 를 (T-0480) 재조립 가능한 완전·연속·무중복·정렬 시퀀스인지 **검증(go/no-go)** 하고, (T-0481) 수신 진행 상태(진행률·status taxonomy·resumeOffset)를 **렌더** 한다. 그러나 둘 다 중복/overlap 을 **해소**하지는 않는다: T-0480 은 `duplicateIndexes`·`overlapBytes` 를 **탐지만** 하고 어느 record 를 유지·폐기할지 결정하지 않으며, T-0481 은 진행률만 그린다. 재조립을 실제로 시작하려면 그 사이의 책임 — "재전송으로 중복된 수신 record 중 무엇을 유지하고 무엇을 버려 깨끗한 1:1 (index↔범위) dedup 집합을 만들 것인가, 그래서 redundant record/byte 가 얼마나 제거됐는가" — 를 산정하는 **dedup 계획** helper 가 필요하다. 이 도메인은 45 helper(T-0437~T-0481) 중 0 회 cover 된 gap 이다(`git grep -ic "ImportChunkDedup|dedupImportChunk|describeImportChunkDuplicat|duplicateChunks|coalesceImportChunk" src/` → 0 매칭 확인 — issue-still-relevant pre-check).

본 helper 는 download 측 `coalesceExportChunkRefetch`(재요청 byte 범위 coalesce)의 대칭 IMPORT 측 resolve 이지만 방향(보내는 측 재요청 range 병합 vs 받는 측 중복 수신 record dedup)·입력(요청 range vs 수신 `ImportChunkDescriptor[]`)·출력(coalesce 된 range vs 유지/폐기 record 집합 + 제거 통계)이 직교한다. T-0480 validate 와도 직교한다: validate 는 **완전성/연속성 판정**(시작 가능?)을, 본 helper 는 **중복 해소 결정**(무엇을 유지?)을 한다 — 완전성·gap·missingIndexes 는 다루지 않는다. 도메인 타입 `ImportChunkDescriptor` 는 T-0480 의 `import-chunk-reassembly-order.ts` 에서 그대로 import 해 재사용한다(DRY — 재정의 금지).

실 업로드 수신·byte slice·실 재조립·HTTP Range/206·resumable upload 프로토콜·타이머·시계 read 0 — chunk 디스크립터(index·offset·size)는 caller 가 전달하고, 본 helper 는 산술 dedup 계획만 한다.

## Required Reading

- `docs/use-cases/UC-07-export-import.md` §8 (NFR — async job + status polling + chunked streaming + resumable upload)
- `src/export/import-chunk-reassembly-order.ts` — `ImportChunkDescriptor`(index·offsetBytes·sizeBytes) 타입을 **import 해 재사용**(재정의 금지) + `isPlainObject`/`describeNonObject` 입력 방어 골격·한국어 message convention mirror 대상. 단 본 helper 는 *검증* 이 아니라 *중복 해소* — `validateImportChunkReassemblyOrder` 재호출·완전성/연속성/missingIndexes 판정 로직 재구현 금지(중복·overlap record 의 유지/폐기·제거 통계만).
- `src/export/export-chunk-refetch-coalesce.ts` — download 측 refetch range coalesce 의 코드 골격 mirror 대상(정렬·결정성·non-mutating·한국어 headline 산정 패턴). 단 download refetch 와 직교 — 재호출 금지(본 helper 는 import 수신 record dedup, range 병합 아님).
- `CLAUDE.md` §3.2 (R-112 4종 test 의무) + §12 (언어 정책 — 식별자 영어, 메시지·주석 한국어)

## Acceptance Criteria

- [ ] `src/export/import-chunk-dedup-plan.ts` 신설. `ImportChunkDescriptor` 는 `./import-chunk-reassembly-order` 에서 import(재정의 금지). 신규 타입: 입력 `ImportChunkDeduplicationInput`(plain object: `receivedChunks: ImportChunkDescriptor[]`(재개 재전송으로 중복·overlap 가능한 수신 디스크립터 배열 — 비-음수 index·offset, 양의 size)). 결과 `ImportChunkDeduplicationPlan`(plain object: `receivedChunkCount: number`(= receivedChunks.length), `keptChunks: ImportChunkDescriptor[]`(중복 해소 후 유지할 디스크립터 — index 오름차순 정렬·각 index 당 1개, 새 배열·원소도 새 객체 복사), `keptChunkCount: number`(= keptChunks.length), `discardedChunkCount: number`(= receivedChunkCount - keptChunkCount), `duplicateIndexes: number[]`(2회 이상 등장한 index 오름차순·중복제거), `keptBytes: number`(keptChunks 의 sizeBytes 단순 합), `redundantBytes: number`(폐기된 record 의 sizeBytes 합 = 전체 수신 sizeBytes 합 - keptBytes), `overlapBytes: number`(유지된 keptChunks 를 offset 기준 정렬했을 때 인접 chunk 가 겹치는 총 byte — 중복 index 폐기 후에도 서로 다른 index 가 byte 범위를 겹칠 수 있음), `hasDuplicates: boolean`(= duplicateIndexes.length > 0), `headline: string`(한국어 한 줄 — 수신/유지/폐기 record 수·redundant byte 요약)). 옵션 타입 신설 안 함.
- [ ] `planImportChunkDeduplication(input)` 순수 함수: receivedChunks 를 (원본 비변형) 처리해 위 필드를 derive. dedup 규칙: 같은 `index` 가 여러 번 등장하면 **첫 등장(입력 순서상 먼저 나온) 디스크립터를 유지하고 나머지를 폐기**(결정적 tie-break — 입력 순서 안정). keptChunks 는 유지된 디스크립터를 `index` 오름차순으로 정렬한 새 배열(원소도 새 객체로 복사). overlapBytes 는 keptChunks 를 `offsetBytes` 기준 정렬 후 인접 [prev.offset, prev.offset+prev.size) 와 [cur.offset, cur.offset+cur.size) 의 겹침 합. 불변(invariant): `keptChunkCount + discardedChunkCount === receivedChunkCount`, `keptChunkCount === (서로 다른 index 의 수)`, `redundantBytes >= 0`, `keptBytes + redundantBytes === (전체 수신 sizeBytes 합)`, `overlapBytes >= 0`, `hasDuplicates ⟺ duplicateIndexes.length > 0 ⟺ discardedChunkCount > 0`, `keptChunks 는 index 오름차순·중복 index 0`. non-mutating(입력 객체·receivedChunks 배열·각 원소 변형 0, 반환 객체·배열·원소 모두 새 것). 동일 입력 2회 호출은 동등 결과(순수·결정성).
- [ ] 경계 입력 처리: `receivedChunks` 빈 배열(receivedChunkCount=0·keptChunkCount=0·discardedChunkCount=0·duplicateIndexes=[]·keptBytes=0·redundantBytes=0·overlapBytes=0·hasDuplicates=false). 중복 0(모든 index 유일 → keptChunkCount===receivedChunkCount·discardedChunkCount=0·hasDuplicates=false·redundantBytes=0). 단일 index 의 동일 디스크립터 3회 수신(→ keptChunkCount=1·discardedChunkCount=2·duplicateIndexes=[해당 index]·redundantBytes=2*size). 입력이 뒤섞인 순서로 들어와도 keptChunks 가 index 오름차순(정렬 검증). 서로 다른 index 가 byte 범위 overlap(예: index0 offset0 size10 + index1 offset5 size10, 중복 index 없음 → discardedChunkCount=0·overlapBytes=5). 중복 + overlap 동시(같은 index 재전송 폐기 후에도 다른 index 와 겹침). 각 경계를 spec 으로 명시 검증.
- [ ] 입력 방어: `input` 이 plain object 아님(null/배열/원시값) → 한국어 `TypeError`(label "input"·받은 값 박제). `input.receivedChunks` 가 배열 아님 → `TypeError`(label "receivedChunks"). `input.receivedChunks[i]` 가 plain object 아님 → `TypeError`(label·index 박제). `receivedChunks[i].index` / `offsetBytes` 가 비-음수 유한 정수 아님, `receivedChunks[i].sizeBytes` 가 양의 유한 정수(≥1) 아님(음수·0·NaN·Infinity·소수·비-number 각각) → 각각 `TypeError`(label·받은 값·index 박제). 추가로 같은 `index` 가 중복 등장하되 `offsetBytes`/`sizeBytes` 가 **서로 다른** 경우(모순된 재전송) → `TypeError`(label "receivedChunks"·해당 index 박제 — 같은 chunk 의 재전송은 동일 범위여야 하므로 모순은 dedup 불가). 각 위반 종류마다 spec 으로 박제·일관 적용.
- [ ] **Happy-path unit test**: 중복 0(전부 유일 index → 그대로 유지), 단일 index 3회 재전송(2개 폐기·redundantBytes 산정), 뒤섞인 순서 입력의 정렬된 keptChunks, 서로 다른 index overlapBytes 산정, headline 한국어 내용 검증 test 각 1+ (총 5+ happy test).
- [ ] **Error path unit test**: input 비-object / receivedChunks 비-배열 / receivedChunks[i] 비-object / index·offsetBytes 비-음수정수 아님(음수·NaN·Infinity·소수·비-number 각각) / sizeBytes 비-양의정수 아님(0·음수·NaN·Infinity·소수 각각) / 같은 index 의 모순된 재전송(offset 또는 size 불일치) 각각에 대해 throw 검증 test 1+ (메시지 label·받은 값·index 포함 확인). 단일 negative 만 작성 금지 — 부적합 입력 종류마다 분리.
- [ ] **Flow / branch 분리 test**: 빈 receivedChunks 분기 vs 비-빈 분기, hasDuplicates true vs false 분기, discardedChunkCount 0 vs >0 분기, overlapBytes 0(겹침 없음) vs >0(겹침) 분기, 같은 index 첫-등장 유지 tie-break 분기(첫 디스크립터가 유지되는지), 중복+overlap 동시 분기 각 1+ test.
- [ ] **Negative cases 충분 cover**: `keptChunkCount + discardedChunkCount === receivedChunkCount`, `keptBytes + redundantBytes === 전체 수신 sizeBytes 합`, `redundantBytes >= 0`, `overlapBytes >= 0`, `hasDuplicates ⟺ duplicateIndexes.length > 0 ⟺ discardedChunkCount > 0`, `keptChunks 가 index 오름차순·중복 index 0` 을 중복0·중복有·overlap有·빈배열 케이스 전수로 검증하는 test 1+, non-mutating(입력 객체·receivedChunks 배열·각 원소 deepFreeze 통과 + 반환 객체·배열·원소가 호출마다 새 인스턴스 — 두 호출 결과 `!==` 이면서 deep-equal) 검증 1+.
- [ ] `src/export/import-chunk-dedup-plan.spec.ts` colocated spec 으로 위 test 작성(NestJS convention).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — 신규 파일은 100% 목표).

## Out of Scope

- 수신 chunk 시퀀스의 완전·연속·정렬 *검증(go/no-go)*·missingIndexes·gap 산정 — `validateImportChunkReassemblyOrder`(T-0480)의 책임. 본 helper 는 *중복 해소 계획* 만(완전성 boolean·missingIndexes·gapBytes·nextExpectedOffset 도출 금지 — duplicateIndexes/overlapBytes 는 dedup 결정 산물로만 산정).
- 수신 진행 상태(진행률·status taxonomy·resumeOffset) 렌더 — `describeImportChunkUploadProgress`(T-0481)의 책임. 본 helper 는 record dedup 만(percentComplete·status·resumeOffset 도출 금지).
- download(Export) 측 재요청 range coalesce·content-range 수치 — `coalesceExportChunkRefetch`/`describeExportChunkStreamProgress`(T-0470)의 책임(다운로드 도메인 재호출·재구현 금지).
- 실 업로드 수신 / byte slice·재조립(실 bytes 결합·중복 bytes 제거) / HTTP Range·206 Partial Content·multipart·resumable upload 프로토콜(tus 등) / SSE·long-poll 배선 — P5 service/controller layer(repository 게이트). 본 helper 는 chunk 디스크립터(index·offset·size) 수치만으로 dedup 계획.
- digest / checksum / 무결성 검증 — `computeDumpChecksum`/`verifyDumpChecksum`(T-0446)/`reconcileExportChunkIntegrity`(T-0472)의 책임. 본 helper 는 record/byte dedup 수치만(내용 무결성 0).
- 타이머·`Date.now()`·`setTimeout` 등 실 시계·스케줄 read(시계 read 0 — 모든 수치는 caller 전달).
- REST controller / endpoint / HTTP 상태 mapping / WebUI 업로드 dedup 안내 컴포넌트 렌더 — repository·WebUI 게이트 후속.
- 새 외부 dependency 추가 금지.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시점)
