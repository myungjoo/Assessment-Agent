---
id: T-0478
title: UC-07 §8 NFR chunked streaming 의 여러 처리율 snapshot(T-0477) 시계열을 평균·최고·최저 전송 처리율과 정체 구간으로 평활·집계하는 순수 helper summariseExportChunkThroughputSeries
phase: P7
status: DONE
completedAt: 2026-06-17T17:23:02Z
prNumber: 389
mergeCommit: 549dfcd
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 195
estimatedFiles: 2
created: 2026-06-17
independentStream: uc07-export-import-helpers
dependsOn: []
touchesFiles:
  - src/export/export-chunk-throughput-series.ts
  - src/export/export-chunk-throughput-series.spec.ts
hqOrigin: null
plannerNote: "P7 UC-07 §8 NFR — estimateExportChunkStreamThroughput(T-0477)는 단일 snapshot 의 누적 평균 처리율만 산출, 시계열 0. 여러 throughput sample 을 평균·최고·최저 rate·정체 구간 수로 평활·집계는 41 helper 중 0회 cover(T-0477 가 Out of Scope 로 명시 deferral). pr·게이트-free·dependsOn []."
---

# T-0478 — UC-07 §8 NFR chunked streaming 처리율 snapshot 시계열 평활·집계 순수 helper summariseExportChunkThroughputSeries

## Why

UC-07 §8 NFR 은 대량 dump 를 "async job + status polling + **chunked streaming**" 으로 전달한다. `estimateExportChunkStreamThroughput`(T-0477)는 *단일 진행 snapshot* + 경과 ms 로부터 그 시점의 **누적 평균 처리율**(transferred / elapsed)·잔여 ETA·정체 여부를 산출한다. 그러나 운영자/WebUI 가 polling 주기마다 받아 모은 **여러 throughput snapshot 의 시계열**을 보면 — 누적 평균 한 값만으로는 드러나지 않는 정보가 있다: 전송이 도중에 **얼마나 빨랐다 느려졌나(최고/최저 순간 처리율)**, **정체가 몇 번/몇 구간 있었나**, 전송 진행이 **단조 증가했는가(transferredBytes 역행 없음)**. 이를 단일 요약으로 평활(smoothing)·집계하면 진행 바의 "평균 속도"·"최고 속도"·"정체 횟수" 표시와 §8 정체 누적 감지를 정량적으로 보강한다.

이 multi-sample throughput series 도메인은 41 helper(T-0437~T-0477) 중 0 회 cover 된 gap 이며, **T-0477 의 Out of Scope 가 "이동 평균·다중 snapshot 시계열 기반 평활 throughput 은 별도 후속 helper 후보" 로 명시 deferral 한 직교 영역**이다(`git grep -iwl "ThroughputSample\|aggregateThroughput\|smoothThroughput\|averageRate\|peakRate\|movingAverage\|samples" src/export` → 0 매칭 확인). 본 helper 는 T-0477 이 만든 `ExportChunkStreamThroughput` 의 **배열**을 입력으로 받아 sample 별 `bytesPerMillisecond`/`bytesPerSecond`·`stalled` 필드로부터 시계열 집계를 derive 한다(실 streaming·byte slice·타이머·시계 read 0 — 각 snapshot 은 caller 가 이미 산정해 전달).

## Required Reading

- `docs/use-cases/UC-07-export-import.md` §8 (NFR — async job + status polling + chunked streaming) + §5 step 13 (Export 다운로드 진행 표시)
- `src/export/export-chunk-stream-throughput.ts` — `ExportChunkStreamThroughput{complete, transferredBytes, remainingBytes, totalBytes, elapsedMillis, bytesPerMillisecond, bytesPerSecond, etaMillis, etaKnown, stalled, headline}` 타입(본 helper 의 **입력 배열 원소 타입**으로 재사용 import). 본 helper 는 처리율을 재산정하지 않고 입력 sample 의 `bytesPerMillisecond`/`bytesPerSecond`/`stalled`/`transferredBytes`/`complete` 필드를 그대로 집계한다(DRY — estimateExportChunkStreamThroughput 재호출 금지). `isPlainObject` / `describeNonObject` / `isValidNonNegativeInteger` 입력 방어 + 한국어 message convention mirror 대상.
- `src/export/export-chunk-stream-progress.ts` — 직전 도메인의 non-mutating·결정성·한국어 headline·불변 검증 패턴 mirror 대상(진행 상태 재산정 금지 — 본 helper 는 throughput sample 만).
- `CLAUDE.md` §3.2 (R-112 4종 test 의무) + §12 (언어 정책 — 식별자 영어, 메시지·주석 한국어)

## Acceptance Criteria

- [ ] `src/export/export-chunk-throughput-series.ts` 신설. 신규 도메인 타입만 신설: `ExportChunkThroughputSeries`(plain object: `sampleCount: number`(입력 배열 길이), `averageBytesPerSecond: number`(sample 들의 `bytesPerSecond` 산술 평균; sampleCount === 0 → 0), `peakBytesPerSecond: number`(최댓값; 빈 배열 → 0), `minBytesPerSecond: number`(최솟값; 빈 배열 → 0), `stalledSampleCount: number`(`stalled === true` 인 sample 수), `stalledWindowCount: number`(연속된 stalled sample 묶음을 1 구간으로 센 정체 *구간* 수 — run-length; 예 [stalled, stalled, !stalled, stalled] → 2), `everStalled: boolean`(= stalledSampleCount > 0), `monotonicProgress: boolean`(인접 sample 의 `transferredBytes` 가 비-감소인가 — 역행 0; sampleCount ≤ 1 → true), `complete: boolean`(마지막 sample 의 `complete`; 빈 배열 → false), `headline: string`(한국어 한 줄 — 평균/최고 처리율·정체 구간·완료 여부 요약)). `ExportChunkStreamThroughput` 는 재사용(import). 옵션 타입은 신설하지 않음.
- [ ] `summariseExportChunkThroughputSeries(samples)` 순수 함수: 입력 `ExportChunkStreamThroughput[]` 로부터 위 필드를 단일 패스 집계로 derive. `averageBytesPerSecond = sampleCount === 0 ? 0 : Σ bytesPerSecond / sampleCount`, `peakBytesPerSecond = sampleCount === 0 ? 0 : max(bytesPerSecond)`, `minBytesPerSecond = sampleCount === 0 ? 0 : min(bytesPerSecond)`, `stalledSampleCount = count(stalled)`, `stalledWindowCount = stalled run 개수`, `monotonicProgress = ∀ i>0: samples[i].transferredBytes >= samples[i-1].transferredBytes`, `complete = sampleCount === 0 ? false : samples[last].complete`. 불변: `0 <= minBytesPerSecond <= averageBytesPerSecond <= peakBytesPerSecond`(sampleCount ≥ 1), `0 <= stalledWindowCount <= stalledSampleCount <= sampleCount`, `everStalled === (stalledSampleCount > 0)`, `stalledSampleCount === 0 ⟹ stalledWindowCount === 0`, `sampleCount <= 1 ⟹ monotonicProgress === true`. non-mutating(입력 배열·원소 변형 0, 반환 객체 항상 새 것). 동일 입력 2회 호출은 동등 결과(순수·결정성).
- [ ] 경계 입력 처리: 빈 배열(`[]`) → sampleCount=0, 모든 rate 0, stalledSampleCount/stalledWindowCount=0, everStalled=false, monotonicProgress=true, complete=false. 단일 sample(길이 1) → average=peak=min=그 sample 의 bytesPerSecond, monotonicProgress=true, stalledWindowCount = sample.stalled ? 1 : 0. 모두 stalled → stalledSampleCount=sampleCount·stalledWindowCount=1·peak/min/average=0(stalled 면 bytesPerSecond=0). 교차 stalled([정체,정상,정체]) → stalledWindowCount=2. transferredBytes 역행([1000,800]) → monotonicProgress=false. 각 경계를 spec 으로 명시 검증.
- [ ] 입력 방어: `samples` 가 배열 아님(null/object/원시값) → 한국어 `TypeError`(label "samples"). 배열 원소 중 plain object 아님(null/배열/원시값) → `TypeError`(index·받은 값 박제). 원소의 `bytesPerSecond` 가 비-음수 유한 number 아님 / `transferredBytes` 가 비-음수정수 아님 / `stalled` 가 boolean 아님 / `complete` 가 boolean 아님 → `TypeError`(index·label·받은 값 박제). 각 위반 종류마다 spec 으로 박제·일관 적용.
- [ ] **Happy-path unit test**: 정상 시계열(여러 sample 의 average/peak/min 기대값·정체 0·monotonic=true·complete 마지막 sample 반영), 단일 sample, 마지막 sample complete=true → series.complete=true, 점증 처리율([느림,빠름] → peak>min·average 중간), 완료 시계열 각각의 모든 필드 기대값 검증 test 각 1+ (총 5+ happy test).
- [ ] **Error path unit test**: samples 비-배열 / 원소 비-object / 원소 bytesPerSecond 비-음수유한 아님(음수·NaN·Infinity·비-number 각각) / 원소 transferredBytes 비-음수정수 아님 / 원소 stalled 비-boolean / 원소 complete 비-boolean 각각에 대해 throw 검증 test 1+ (메시지 index·label·받은 값 포함 확인). 단일 negative 만 작성 금지 — 부적합 입력 종류마다 분리.
- [ ] **Flow / branch 분리 test**: sampleCount === 0 분기(전 필드 0/기본값) vs ≥ 1 분기, stalled run 경계 분기(연속 stalled 묶음 vs 교차 stalled → stalledWindowCount run-length), monotonicProgress true 분기(비-감소) vs false 분기(역행), complete 마지막 sample true vs false 분기, peak === min 분기(전 sample 동일 rate) vs peak > min 분기 각 1+ test.
- [ ] **Negative cases 충분 cover**: `0 <= minBytesPerSecond <= averageBytesPerSecond <= peakBytesPerSecond`, `0 <= stalledWindowCount <= stalledSampleCount <= sampleCount`, `everStalled === (stalledSampleCount > 0)`, `stalledSampleCount === 0 ⟹ stalledWindowCount === 0`, `sampleCount <= 1 ⟹ monotonicProgress === true` 를 빈 배열·단일·정상·전부정체·교차정체·역행 케이스 전수로 검증하는 test 1+, non-mutating(입력 배열 deepFreeze 통과 + 반환 객체가 호출마다 새 인스턴스 — 두 호출 결과 `!==` 이면서 deep-equal) 검증 1+.
- [ ] `src/export/export-chunk-throughput-series.spec.ts` colocated spec 으로 위 test 작성(NestJS convention).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — 신규 파일은 100% 목표).

## Out of Scope

- 단일 snapshot 처리율·잔여 ETA·정체 여부 산정 — 이미 `estimateExportChunkStreamThroughput`(T-0477)가 책임. 본 helper 는 그 결과(`ExportChunkStreamThroughput`)의 **배열**만 집계(DRY — estimateExportChunkStreamThroughput 재호출·재구현 금지).
- 지수 가중 이동 평균(EWMA)·가중 평활·윈도우 슬라이딩 평균 등 가중치 기반 평활 — 본 helper 는 비가중 산술 평균·최고·최저만. 가중 평활은 별도 후속 helper 후보.
- 표준편차·분산·백분위(p50/p95)·히스토그램 등 고차 통계 — 본 helper 는 평균·최고·최저·정체 구간 수의 기초 집계만.
- 실 streaming / byte slice / HTTP Range·206 Partial Content / 타이머·`Date.now()`·`performance.now()` 등 실 시계 read(각 sample 의 시간·byte 수치는 caller 가 이미 산정해 전달 — 시계 read 0). SSE·long-poll·resumable upload 배선은 P5 service/controller layer(repository 게이트).
- 진행 상태(transferredBytes·remainingBytes·percentComplete) 재산정 — `describeExportChunkStreamProgress`(T-0470)의 책임. 본 helper 는 throughput sample 만.
- 재요청 batch metric(요청 수 절감·범위 분산·무결 byte gap) — `summariseExportChunkRefetchSavings`(T-0474)/`Fragmentation`(T-0475)/`Gaps`(T-0476)와 중복 금지(refetch-batch 도메인과 직교).
- 무결성 검증 / digest / checksum 계산 — 본 helper 는 처리율 수치·정체 flag 만(무결성 source 0).
- REST controller / endpoint / HTTP 상태 mapping / WebUI progress bar·차트 렌더 컴포넌트 — repository·WebUI 게이트 후속.
- 새 외부 dependency 추가 금지.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시점)
