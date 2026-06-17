---
id: T-0477
title: UC-07 §8 NFR chunked streaming 진행 상태(T-0470)와 경과 시간으로부터 전송 처리율(throughput)·잔여 ETA·정체(stall) 여부를 정량화하는 순수 helper estimateExportChunkStreamThroughput
phase: P7
status: DONE
completedAt: 2026-06-17T17:02:40Z
prNumber: 388
mergeCommit: 16ab736
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 190
estimatedFiles: 2
created: 2026-06-17
independentStream: uc07-export-import-helpers
dependsOn: []
touchesFiles:
  - src/export/export-chunk-stream-throughput.ts
  - src/export/export-chunk-stream-throughput.spec.ts
hqOrigin: null
plannerNote: "P7 UC-07 §8 NFR — ExportChunkStreamProgress(T-0470)는 byte/chunk 진행만 노출, 시간 차원 0. 진행 snapshot + 경과 ms 로 throughput·잔여 ETA·stall 산정은 40 helper(T-0437~T-0476) 중 0회 cover. refetch-batch 포화 회피 직교 pick. pr·게이트-free·dependsOn []."
---

# T-0477 — UC-07 §8 NFR chunked streaming 전송 처리율·잔여 ETA·정체 정량화 순수 helper estimateExportChunkStreamThroughput

## Why

UC-07 §8 NFR 은 대량 dump 를 "async job + status polling + **chunked streaming**" 으로 전달한다. `describeExportChunkStreamProgress`(T-0470)는 전송 *진행 상태*(`ExportChunkStreamProgress{totalChunks, deliveredChunks, remainingChunks, transferredBytes, totalBytes, remainingBytes, percentComplete, complete, ...}`)를 산출하지만 — 이는 **순수히 byte/chunk 차원**일 뿐 **시간 차원이 전혀 없다**. 운영자/WebUI 가 "얼마나 빨리 전송 중인가(처리율)·앞으로 얼마나 더 걸리나(ETA)·전송이 멈춰있는가(stall)" 를 알려면 진행 snapshot 에 경과 시간(elapsed time)을 결합한 정량화가 필요하다.

이 transfer-rate / ETA / stall 도메인은 40 helper(T-0437~T-0476) 중 0 회 cover 된 gap 이다. 직전 4 helper(coalesce T-0473 / savings T-0474 / fragmentation T-0475 / gap T-0476)는 모두 `ExportChunkRefetchBatch` 의 **부분 손상 재요청 byte 영역 metric**(요청 수 절감·범위 크기 분산·범위 사이 무결 byte gap)을 다뤘다 — 그 refetch-batch metric 공간은 포화 상태다. 본 helper 는 그와 직교(orthogonal)한 영역으로, **정상 streaming 의 시간 대비 진행 효율**을 정량화한다(`git grep -iwl throughput|bytesPerMillisecond|bytesPerSecond|etaMillis|transferRate|elapsedMillis src/export` → 0 매칭 확인).

`describeExportChunkStreamProgress`(T-0470)가 *순간 진행 상태*(몇 byte/몇 chunk 전달됐나)를 렌더한다면, 본 helper 는 그 snapshot 과 경과 ms 를 입력으로 받아 **처리율(transferred / elapsed)·잔여 ETA(remaining / rate)·정체 여부(rate ≈ 0)** 를 순수 산술로 derive 한다(실 streaming·byte slice·HTTP Range·타이머·시계 read 0 — `elapsedMillis` 는 caller 가 측정해 전달). UC-07 §5 step 13(Export 다운로드)의 WebUI 진행 표시(progress bar 의 "남은 시간"·"전송 속도")와 §8 chunked streaming 의 정체 감지를 정량적으로 보강한다.

## Required Reading

- `docs/use-cases/UC-07-export-import.md` §8 (NFR — async job + status polling + chunked streaming) + §5 step 13 (Export 다운로드)
- `src/export/export-chunk-stream-progress.ts` — `ExportChunkStreamProgress{totalChunks, deliveredChunks, remainingChunks, transferredBytes, totalBytes, remainingBytes, percentComplete, complete, currentChunk, currentRange, headline}` 타입(본 helper 의 입력으로 재사용 import). 본 helper 는 진행 상태를 재산정하지 않고 입력으로 받은 `ExportChunkStreamProgress` 의 `transferredBytes`/`remainingBytes`/`totalBytes`/`complete`/`percentComplete` 등 필드를 그대로 사용한다(DRY — describeExportChunkStreamProgress 재호출 금지). 불변 `transferredBytes + remainingBytes === totalBytes`·`complete ⟺ remainingBytes === 0` 를 신뢰·검증한다. `isPlainObject` / `describeNonObject` / `isValidNonNegativeInteger` 입력 방어 + 한국어 message convention mirror 대상.
- `src/export/export-chunk-refetch-gap.ts` — `summariseExportChunkRefetchGaps`(T-0476). 직전 helper 의 입력 방어·non-mutating·결정성·한국어 headline·불변 검증 패턴 mirror 대상(refetch-batch 도메인과는 직교 — gapBytes/savings/fragmentation 와 중복 0).
- `CLAUDE.md` §3.2 (R-112 4종 test 의무) + §12 (언어 정책 — 식별자 영어, 메시지·주석 한국어)

## Acceptance Criteria

- [ ] `src/export/export-chunk-stream-throughput.ts` 신설. 신규 도메인 타입만 신설: `ExportChunkStreamThroughput`(plain object: `complete: boolean`(= progress.complete), `transferredBytes: number`(= progress.transferredBytes), `remainingBytes: number`(= progress.remainingBytes), `totalBytes: number`(= progress.totalBytes), `elapsedMillis: number`(입력 경과 시간 그대로), `bytesPerMillisecond: number`(= elapsedMillis === 0 ? 0 : transferredBytes / elapsedMillis; 소수 그대로), `bytesPerSecond: number`(= bytesPerMillisecond * 1000), `etaMillis: number`(잔여 byte 전송 추정 ms = bytesPerMillisecond === 0 ? (remainingBytes === 0 ? 0 : null-금지 대신 sentinel — 아래 명시) : remainingBytes / bytesPerMillisecond), `etaKnown: boolean`(ETA 산정 가능 여부 = remainingBytes === 0 || bytesPerMillisecond > 0), `stalled: boolean`(정체 = !complete && elapsedMillis > 0 && transferredBytes === 0 — 시간은 흘렀으나 한 byte 도 전송 안 됨), `headline: string`(한국어 한 줄 — 처리율·ETA·정체/완료 요약)). `etaMillis` 타입: ETA 가 산정 불가(`etaKnown === false`, 즉 미완료인데 rate 0)일 때는 `0` 이 아니라 명확한 sentinel 이 필요하므로 — `etaMillis: number`로 두되 `etaKnown === false` 일 때 `etaMillis === 0` 로 고정하고 그 의미를 `etaKnown` 으로 구분(즉 `etaMillis === 0 && etaKnown === false` ⟹ "산정 불가", `etaMillis === 0 && etaKnown === true` ⟹ "이미 완료/잔여 0"). `ExportChunkStreamProgress` 는 재사용(import). 옵션 타입은 신설하지 않음.
- [ ] `estimateExportChunkStreamThroughput(progress, elapsedMillis)` 순수 함수: 입력 `ExportChunkStreamProgress`(T-0470)와 비-음수정수 `elapsedMillis` 로부터 `bytesPerMillisecond = elapsedMillis === 0 ? 0 : transferredBytes / elapsedMillis`, `bytesPerSecond = bytesPerMillisecond * 1000`, `etaKnown = remainingBytes === 0 || bytesPerMillisecond > 0`, `etaMillis = remainingBytes === 0 ? 0 : (bytesPerMillisecond > 0 ? remainingBytes / bytesPerMillisecond : 0)`, `stalled = !progress.complete && elapsedMillis > 0 && transferredBytes === 0`, `complete = progress.complete` 를 derive. 불변: `bytesPerMillisecond >= 0`, `bytesPerSecond === bytesPerMillisecond * 1000`, `etaKnown === false ⟹ etaMillis === 0`, `remainingBytes === 0 ⟹ etaMillis === 0 && etaKnown === true`, `complete ⟹ remainingBytes === 0 && etaMillis === 0 && etaKnown === true && stalled === false`, `transferredBytes + remainingBytes === totalBytes`(입력 progress 계약 검증), `stalled === true ⟹ bytesPerMillisecond === 0 && !complete`. non-mutating(입력 progress 변형 0, 반환 객체 항상 새 것). 동일 입력 2회 호출은 동등 결과(순수·결정성).
- [ ] 경계 입력 처리: `complete === true`(remainingBytes=0) → `etaMillis=0`, `etaKnown=true`, `stalled=false`(elapsedMillis 와 무관). `elapsedMillis === 0`(아직 측정 시작) → `bytesPerMillisecond=0`, `bytesPerSecond=0`, `stalled=false`(시간 안 흘렀으므로 정체 아님), 미완료면 `etaKnown=false`·`etaMillis=0`. 정체(`elapsedMillis > 0`, `transferredBytes=0`, 미완료) → `stalled=true`, `bytesPerMillisecond=0`, `etaKnown=false`, `etaMillis=0`. 정상 진행(transferredBytes=500, remainingBytes=1500, totalBytes=2000, elapsedMillis=1000, 미완료) → `bytesPerMillisecond=0.5`, `bytesPerSecond=500`, `etaKnown=true`, `etaMillis=1500/0.5=3000`, `stalled=false`. 미완료인데 remainingBytes=0 인 모순은 입력 progress 계약 위반으로 거부(아래 방어). 각 경계를 spec 으로 명시 검증.
- [ ] 입력 방어: `progress` 이 plain object 아님(null/배열/원시값) → 한국어 `TypeError`(label "progress"). `progress.transferredBytes` / `progress.remainingBytes` / `progress.totalBytes` 가 비-음수정수 아님 → `TypeError`(label·받은 값 박제). `progress.complete` 가 boolean 아님 → `TypeError`(label·받은 값 박제). `elapsedMillis` 가 비-음수정수 아님(음수·소수·NaN·비-number) → `TypeError`(label "elapsedMillis"·받은 값 박제). `progress.transferredBytes + progress.remainingBytes !== progress.totalBytes`(progress 계약 위반) → 한국어 `RangeError`(기대값·실제값 박제). `progress.complete === true 인데 progress.remainingBytes !== 0` 또는 `progress.complete === false 인데 progress.remainingBytes === 0 && progress.totalBytes > 0`(complete 와 remainingBytes 모순) → `RangeError`(모순 박제). 어느 쪽인지(TypeError vs RangeError) spec describe 로 박제·일관 적용.
- [ ] **Happy-path unit test**: 정상 진행(transferredBytes/remainingBytes/elapsedMillis 주어진 → bytesPerMillisecond·bytesPerSecond·etaMillis·etaKnown 기대값·!stalled·!complete), 완료(complete=true → etaMillis=0·etaKnown=true·stalled=false), elapsedMillis=0 시작(rate 0·etaKnown=false·!stalled), 정체(stalled=true·rate 0·etaKnown=false), 빠른 전송(bytesPerSecond 큰 값 정확) 각각의 모든 필드 기대값 검증 test 각 1+ (총 5+ happy test).
- [ ] **Error path unit test**: progress 비-object / transferredBytes·remainingBytes·totalBytes 비-음수정수 아님(각각) / complete 비-boolean / elapsedMillis 비-음수정수 아님(음수·소수·NaN·비-number 각각) / transferredBytes+remainingBytes !== totalBytes / complete=true 인데 remainingBytes!=0 / complete=false 인데 remainingBytes==0(totalBytes>0) 각각에 대해 throw 검증 test 1+ (메시지 label·받은 값·위반 포함 확인, TypeError vs RangeError 구분 확인). 단일 negative 만 작성 금지 — 부적합 입력 종류마다 분리.
- [ ] **Flow / branch 분리 test**: elapsedMillis === 0 분기(rate 단락 0) vs > 0 분기, bytesPerMillisecond === 0 분기(etaKnown 판정·etaMillis 단락) vs > 0 분기(나눗셈), remainingBytes === 0 분기(etaMillis=0·etaKnown=true) vs > 0 분기, complete true vs false 분기, stalled true 분기(미완료+elapsed>0+transferred=0) vs false 분기(전송 있음 / elapsed=0 / complete) 각 1+ test.
- [ ] **Negative cases 충분 cover**: `bytesPerSecond === bytesPerMillisecond * 1000`, `etaKnown === false ⟹ etaMillis === 0`, `remainingBytes === 0 ⟹ etaMillis === 0 && etaKnown === true`, `complete ⟹ etaMillis === 0 && etaKnown === true && !stalled`, `stalled === true ⟹ bytesPerMillisecond === 0 && !complete`, `transferredBytes + remainingBytes === totalBytes` 를 정상·완료·elapsed0·정체·빠른전송 케이스 전수로 검증하는 test 1+, non-mutating(입력 progress deepFreeze 통과 + 반환 객체가 호출마다 새 인스턴스 — 두 호출 결과 `!==` 이면서 deep-equal) 검증 1+.
- [ ] `src/export/export-chunk-stream-throughput.spec.ts` colocated spec 으로 위 test 작성(NestJS convention).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — 신규 파일은 100% 목표).

## Out of Scope

- 실 streaming / byte slice 추출 / HTTP Range 요청·206 Partial Content / 타이머·`Date.now()`·`performance.now()` 등 실 시계 read(본 helper 는 `elapsedMillis` 를 caller 가 측정해 인자로 전달 — 시계 read 0). whole-span vs N-range 결정·SSE·long-poll·resumable upload 배선은 P5 service/controller layer(repository 게이트).
- 진행 상태(transferredBytes·remainingBytes·percentComplete) 재산정 — 본 helper 는 이미 산출된 `ExportChunkStreamProgress`(T-0470) 만 입력으로 받는다(DRY — describeExportChunkStreamProgress 재호출·재구현 금지). 진행 상태 산정은 `describeExportChunkStreamProgress`(T-0470), resume offset 은 `buildExportChunkResumePlan`(T-0471) 의 책임.
- 재요청 batch metric(요청 수 절감·범위 크기 분산·범위 사이 무결 byte gap) 재산정 — `summariseExportChunkRefetchSavings`(T-0474) / `summariseExportChunkRefetchFragmentation`(T-0475) / `summariseExportChunkRefetchGaps`(T-0476) 와 중복 금지. 본 helper 는 정상 streaming 의 시간 대비 처리율·ETA·정체만(refetch-batch 도메인과 직교).
- 무결성 검증 / digest / checksum 계산 — 본 helper 는 byte 수치·시간만 사용(무결성 source 0).
- 이동 평균(moving average)·지수 가중(EWMA)·다중 snapshot 시계열 기반 평활 throughput — 본 helper 는 단일 snapshot + 경과 ms 의 누적 평균 처리율(transferred / elapsed)만. 시계열 평활은 별도 후속 helper 후보.
- 표준편차·백분위·히스토그램 등 고차 통계 — 본 helper 는 처리율·ETA·정체의 기초 산술만.
- REST controller / endpoint / HTTP 상태 mapping / WebUI progress bar 렌더 컴포넌트 / 차트·시각화 — repository·WebUI 게이트 후속.
- 새 외부 dependency 추가 금지.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시점)
