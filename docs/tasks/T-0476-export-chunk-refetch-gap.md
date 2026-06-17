---
id: T-0476
title: UC-07 §8 NFR chunked streaming 재요청 batch(T-0473)의 분산된 실패 범위 *사이의 무결 byte gap*(outer span·총 gap byte·gap 개수·whole-span 재전송 trade-off)을 정량화하는 순수 helper summariseExportChunkRefetchGaps
phase: P7
status: DONE
completedAt: 2026-06-17T16:40:38Z
prNumber: 387
mergeCommit: 1339f48
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 200
estimatedFiles: 2
created: 2026-06-17
independentStream: uc07-export-import-helpers
dependsOn: []
touchesFiles:
  - src/export/export-chunk-refetch-gap.ts
  - src/export/export-chunk-refetch-gap.spec.ts
hqOrigin: null
plannerNote: "P7 UC-07 §8 NFR — coalesce(T-0473)·savings(T-0474)·fragmentation(T-0475)는 범위 자체·요청 수 절감·범위 크기 분산만 노출. 분산된 범위 *사이의 무결 byte gap*(outer span·총 gap byte·whole-span 재전송 trade-off)은 39 helper 중 0회 cover. pr·게이트-free·dependsOn []."
---

# T-0476 — UC-07 §8 NFR chunked streaming 재요청 batch 분산 범위 *사이* 무결 byte gap 정량화 순수 helper summariseExportChunkRefetchGaps

## Why

UC-07 §8 NFR 은 대량 dump 를 "async job + status polling + **chunked streaming**" 으로 전달하고, 부분 손상 복구 시 효율적 재전송을 요구한다. `coalesceExportChunkRefetch`(T-0473)는 인접 실패 chunk 를 연속 byte 범위로 병합한 재요청 batch(`ExportChunkRefetchBatch{rangeCount, failedChunkCount, refetchBytes, ranges: ExportChunkRefetchRange[]}`)를 산정하고, `summariseExportChunkRefetchSavings`(T-0474)는 병합이 절감한 **요청 수·절감률**을, `summariseExportChunkRefetchFragmentation`(T-0475)는 손상 byte 영역의 **분산 형상**(최대/최소/평균 범위 byte·범위 크기 산포)을 정량화한다.

그러나 셋 중 어느 것도 **분산된 재요청 범위들 *사이*에 끼어 있는 무결(intact) byte gap** — 즉 첫 범위 시작부터 마지막 범위 끝까지의 outer span 안에서 실패 범위가 차지하지 않는 무결 byte 가 얼마인지, gap 이 몇 개인지, 가장 큰 gap 이 얼마인지 — 는 노출하지 않는다. 이 gap 정보는 운영자/재전송 전략 결정에 핵심이다: **N 개의 분리된 작은 Range 요청**(refetchBytes 만 전송, gap 0)과 **outer span 전체를 한 번의 큰 Range 요청**(spannedBytes = refetchBytes + gapBytes 전송, gap 의 무결 byte 까지 불필요 재전송하지만 요청 1개)의 trade-off 를 판단하려면 gap 총량과 형상이 필요하다. 이 gap-between-ranges 도메인은 39 helper(T-0437~T-0475) 중 0 회 cover 된 gap 이다(`git grep -i gapBytes|interRangeGap|betweenRange|coverageSpan|spannedBytes|outerSpan|wastedBytes|envelopeBytes|gapCount src/export` → 0 매칭).

`coalesceExportChunkRefetch`(T-0473)가 범위를 **병합·열거**하고, `summariseExportChunkRefetchSavings`(T-0474)가 **요청 수 절감**을, `summariseExportChunkRefetchFragmentation`(T-0475)가 **범위 크기 분산**을 정량화한다면, 본 helper 는 그와 직교(orthogonal) — 이미 산출된 `ExportChunkRefetchBatch` 의 `ranges` 배열을 1 회 순회해 인접 범위 사이의 무결 byte gap(범위 *내부* 가 아닌 범위 *사이*)을 순수 산술로 derive 한다(실 재전송·byte slice·HTTP Range·헤더 직렬화·요청 발행 0). UC-07 §8 NFR 의 효율적 부분 손상 복구를 정량적으로 보강한다.

## Required Reading

- `docs/use-cases/UC-07-export-import.md` §8 (NFR — async job + status polling + chunked streaming) + §5 step 13
- `src/export/export-chunk-refetch-coalesce.ts` — `ExportChunkRefetchBatch{allIntact, failedChunkCount, rangeCount, ranges: ExportChunkRefetchRange[], refetchBytes, headline}` + `ExportChunkRefetchRange{firstBytePos, lastBytePos, byteLength, firstChunkIndex, lastChunkIndex, chunkCount}` 타입(본 helper 의 입력으로 재사용 import) + `isPlainObject` / `describeNonObject` / `isValidNonNegativeInteger` 입력 방어 + 한국어 message convention mirror 대상. **본 helper 는 coalescing 을 재실행하지 않고 입력으로 받은 `ExportChunkRefetchBatch` 의 `ranges`·수치 필드를 그대로 사용한다(DRY — coalesceExportChunkRefetch 재호출 금지). 불변 `ranges 의 byteLength 합 === refetchBytes`·`rangeCount === ranges.length`·`ranges 는 firstBytePos 오름차순`·`각 range 의 byteLength === lastBytePos - firstBytePos + 1`·`인접 range 끼리 byte gap 존재(연속이면 병합됐을 것 — 즉 ranges[i].lastBytePos < ranges[i+1].firstBytePos)` 를 신뢰·검증한다.**
- `src/export/export-chunk-refetch-fragmentation.ts` — `summariseExportChunkRefetchFragmentation`(T-0475). 동일 batch 를 입력으로 받는 직교 helper — 본 helper 는 범위 *내부* 크기 분산(fragmentation)이 아닌 범위 *사이* 무결 byte gap 을 산정한다(중복 0). 입력 방어·non-mutating·결정성 패턴 mirror 대상.
- `src/export/export-chunk-refetch-savings.ts` — `summariseExportChunkRefetchSavings`(T-0474). 본 helper 는 요청 수 절감(savings)이 아닌 gap(범위 사이 무결 byte)을 산정한다(중복 0).
- `CLAUDE.md` §3.2 (R-112 4종 test 의무) + §12 (언어 정책 — 식별자 영어, 메시지·주석 한국어)

## Acceptance Criteria

- [ ] `src/export/export-chunk-refetch-gap.ts` 신설. 신규 도메인 타입만 신설: `ExportChunkRefetchGaps`(plain object: `allIntact: boolean`(= batch.allIntact — 재요청 범위 0개), `rangeCount: number`(= batch.rangeCount = ranges.length), `refetchBytes: number`(= batch.refetchBytes — 실패 범위 byte 합), `outerSpanFirstBytePos: number`(첫 범위의 firstBytePos; ranges 비었으면 0), `outerSpanLastBytePos: number`(마지막 범위의 lastBytePos; ranges 비었으면 0), `spannedBytes: number`(outer span 전체 byte = outerSpanLastBytePos - outerSpanFirstBytePos + 1; ranges 비었으면 0; rangeCount === 1 이면 === refetchBytes), `gapCount: number`(인접 범위 사이 gap 개수 = max(rangeCount - 1, 0)), `gapBytes: number`(범위 사이 무결 byte 총합 = spannedBytes - refetchBytes; ranges 비었거나 단일 범위면 0), `largestGapBytes: number`(가장 큰 단일 gap 의 byte = max(ranges[i+1].firstBytePos - ranges[i].lastBytePos - 1); gap 없으면 0), `averageGapBytes: number`(gapBytes / gapCount; gapCount === 0 이면 0; 소수 그대로), `gapRatio: number`(gapBytes / spannedBytes; spannedBytes === 0 이면 0; 0~1 소수 — outer span 중 무결 비중), `contiguous: boolean`(gapCount === 0 — 범위 사이 gap 0 즉 무결이거나 단일 범위), `headline: string`(한국어 한 줄 — "재요청 N개 범위, outer span X bytes, 사이 무결 Y bytes(gap Z개)" 또는 무결/단일 시 동형 요약)). `ExportChunkRefetchBatch` / `ExportChunkRefetchRange` 는 재사용(import). 옵션 타입은 신설하지 않음.
- [ ] `summariseExportChunkRefetchGaps(batch)` 순수 함수: 입력 `ExportChunkRefetchBatch`(T-0473)의 `ranges` 배열을 1회 순회해 인접 쌍 `(ranges[i], ranges[i+1])` 의 gap = `ranges[i+1].firstBytePos - ranges[i].lastBytePos - 1` 을 누적·최대화하여 `gapBytes = Σ gap`, `largestGapBytes = max(gap)`, `gapCount = max(rangeCount - 1, 0)`, `outerSpanFirstBytePos = ranges[0].firstBytePos`(비었으면 0), `outerSpanLastBytePos = ranges[last].lastBytePos`(비었으면 0), `spannedBytes = rangeCount === 0 ? 0 : outerSpanLastBytePos - outerSpanFirstBytePos + 1`, `averageGapBytes = gapCount === 0 ? 0 : gapBytes / gapCount`, `gapRatio = spannedBytes === 0 ? 0 : gapBytes / spannedBytes`, `contiguous = gapCount === 0`, `allIntact = batch.allIntact` 를 derive. 불변: `spannedBytes === refetchBytes + gapBytes`, `0 <= gapBytes <= spannedBytes`, `0 <= gapRatio <= 1`, `largestGapBytes <= gapBytes`, `gapCount === 0 ⟹ gapBytes === 0 && largestGapBytes === 0 && averageGapBytes === 0 && gapRatio === 0 && contiguous`, `rangeCount === 1 ⟹ spannedBytes === refetchBytes && gapCount === 0 && contiguous`, `allIntact ⟺ rangeCount === 0 ⟹ 모든 span/gap 값 === 0 && contiguous(gapCount === 0)`, `rangeCount >= 2 ⟹ gapBytes >= rangeCount - 1`(병합 batch 는 인접 범위 사이 최소 1 byte gap — 연속이면 병합됐을 것). non-mutating(입력 batch / batch.ranges 변형 0, 반환 객체 항상 새 것). 동일 입력 2회 호출은 동등 결과(순수·결정성).
- [ ] 경계 입력 처리: `batch.allIntact === true`(rangeCount=0, ranges=[]) → 모든 span/gap 값=0, `gapCount=0`, `contiguous=true`, headline 은 "재요청 범위 없음(무결)" 동형. 단일 범위(rangeCount=1, ranges=[{firstBytePos:10, lastBytePos:109, byteLength:100}], refetchBytes=100) → `outerSpanFirstBytePos=10`, `outerSpanLastBytePos=109`, `spannedBytes=100`, `gapCount=0`, `gapBytes=0`, `largestGapBytes=0`, `gapRatio=0`, `contiguous=true`. 다중 범위(rangeCount=3, ranges firstBytePos/lastBytePos = 0/29, 50/99, 200/219; byteLength 30/50/20, refetchBytes=100) → `outerSpanFirstBytePos=0`, `outerSpanLastBytePos=219`, `spannedBytes=220`, gap1 = 50-29-1 = 20, gap2 = 200-99-1 = 100 → `gapBytes=120`, `largestGapBytes=100`, `gapCount=2`, `averageGapBytes=60`, `gapRatio=120/220≈0.5454`, `contiguous=false`. 2개 범위(rangeCount=2, 0/9, 20/29; byteLength 10/10, refetchBytes=20 → spannedBytes=30, gap=20-9-1=10, gapBytes=10, largestGapBytes=10, gapCount=1, averageGapBytes=10, gapRatio=10/30≈0.3333, contiguous=false). 동일 크기 gap(gap1=gap2=15) → largestGapBytes=15·averageGapBytes=15 검증. 각 경계를 spec 으로 명시 검증.
- [ ] 입력 방어: `batch` 이 plain object 아님(null/배열/원시값) → 한국어 `TypeError`(label "batch"). `batch.ranges` 가 배열 아님 → `TypeError`(label "batch.ranges"). `batch.failedChunkCount` / `batch.rangeCount` / `batch.refetchBytes` 가 비-음수정수 아님 → `TypeError`(label·받은 값 박제). `batch.allIntact` 가 boolean 아님 → `TypeError`(label·받은 값 박제). `batch.ranges` 원소가 plain object 아니거나 `firstBytePos`/`lastBytePos`/`byteLength` 가 비-음수정수 아님 → `TypeError`(원소 index·label 박제). `batch.rangeCount !== batch.ranges.length`(계약 위반) → 한국어 `RangeError`(불일치 박제). `batch.allIntact` 와 수치의 모순(allIntact=true 인데 rangeCount !== 0 또는 ranges.length !== 0; allIntact=false 인데 rangeCount === 0) → `RangeError`(모순 박제). 원소의 `byteLength !== lastBytePos - firstBytePos + 1`(범위 계약 위반) → `RangeError`(원소 index·기대값·실제값 박제). `ranges 의 byteLength 합 !== batch.refetchBytes`(coalescing 계약 위반) → `RangeError`(위반·기대값·실제값 박제). `ranges 가 firstBytePos 오름차순 아님` 또는 `인접 범위가 겹치거나 연속(ranges[i].lastBytePos >= ranges[i+1].firstBytePos - 1 — 연속이면 병합됐어야 함)` → `RangeError`(원소 index·위반 박제 — 손상된/미병합 batch 거부). 어느 쪽인지(TypeError vs RangeError) spec describe 로 박제·일관 적용.
- [ ] **Happy-path unit test**: 무결(allIntact, rangeCount=0 → 전부 0·contiguous), 단일 범위(rangeCount=1 → spannedBytes===refetchBytes·gap 전부 0·contiguous), 다중 범위(rangeCount=3 → outerSpan/spannedBytes/gapBytes/largestGapBytes/averageGapBytes/gapRatio 기대값·!contiguous), 2개 범위(rangeCount=2 → gapCount=1·gap 기대값), 동일 크기 gap(largestGapBytes===averageGapBytes) 각각의 모든 필드 기대값 검증 test 각 1+ (총 5+ happy test).
- [ ] **Error path unit test**: batch 비-object / ranges 비-배열 / failedChunkCount·rangeCount·refetchBytes 비-음수정수 아님(각각) / allIntact 비-boolean / ranges 원소 비-object / 원소 firstBytePos·lastBytePos·byteLength 비-음수정수 아님 / rangeCount !== ranges.length / allIntact 와 수치 모순(true+rangeCount!=0, false+rangeCount==0) / 원소 byteLength !== lastBytePos-firstBytePos+1 / byteLength 합 != refetchBytes / ranges 비오름차순 / 인접 범위 겹침·연속(미병합) 각각에 대해 throw 검증 test 1+ (메시지 label·받은 값·위반 포함 확인, TypeError vs RangeError 구분 확인). 단일 negative 만 작성 금지 — 부적합 입력 종류마다 분리.
- [ ] **Flow / branch 분리 test**: allIntact true vs false 분기(전부 0 vs 값), rangeCount === 0 분기(span/gap 단락 0) vs > 0 분기, gapCount === 0 분기(averageGapBytes 단락 0) vs > 0 분기(나눗셈), spannedBytes === 0 분기(gapRatio=0 단락) vs > 0 분기, contiguous 분기(rangeCount=0·1 → true / rangeCount>=2 → false 각 1+), largestGapBytes 선택 분기(첫 gap 이 최대 / 중간 gap 이 최대 / 마지막 gap 이 최대 / 동일 gap) 각 1+ test.
- [ ] **Negative cases 충분 cover**: `spannedBytes === refetchBytes + gapBytes`, `0 <= gapBytes <= spannedBytes`, `0 <= gapRatio <= 1`, `largestGapBytes <= gapBytes`, `gapCount === 0 ⟹ 모든 gap 값 0 && contiguous`, `rangeCount === 1 ⟹ spannedBytes === refetchBytes && contiguous`, `allIntact ⟺ rangeCount === 0`, `rangeCount >= 2 ⟹ gapBytes >= rangeCount - 1` 를 무결·단일·2개·다중·동일gap 케이스 전수로 검증하는 test 1+, non-mutating(입력 batch / batch.ranges deepFreeze 통과 + 반환 객체가 호출마다 새 인스턴스 — 두 호출 결과 `!==` 이면서 deep-equal) 검증 1+.
- [ ] `src/export/export-chunk-refetch-gap.spec.ts` colocated spec 으로 위 test 작성(NestJS convention).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — 신규 파일은 100% 목표).

## Out of Scope

- 실 재전송 / byte slice 추출 / HTTP Range 요청 발행·206 Partial Content 응답 / `Range: bytes=a-b` 또는 `Content-Range` 헤더 문자열 직렬화 / whole-span vs N-range 재전송 전략 *결정*(본 helper 는 trade-off 의 *수치 입력*만 derive — 실 결정·발행은 P5 service/controller layer, repository 게이트).
- chunk 병합·재요청 범위 산정 재실행 — 본 helper 는 이미 산출된 `ExportChunkRefetchBatch`(T-0473) 만 입력으로 받는다(DRY — coalesceExportChunkRefetch 재호출·재구현 금지). 병합은 `coalesceExportChunkRefetch`(T-0473), 요청 수 절감은 `summariseExportChunkRefetchSavings`(T-0474), 범위 크기 분산은 `summariseExportChunkRefetchFragmentation`(T-0475), per-chunk 무결성 reconcile 은 `reconcileExportChunkIntegrity`(T-0472) 의 책임.
- 범위 *내부* 크기 분산(largestRangeBytes·averageRangeBytes·largestRangeShare 등) 재산정 — `summariseExportChunkRefetchFragmentation`(T-0475) 와 중복 금지. 본 helper 는 범위 *사이* 무결 byte gap(outer span·gapBytes·largestGapBytes·gapRatio)만.
- 요청 수 절감(savings) 재산정 — `summariseExportChunkRefetchSavings`(T-0474) 와 중복 금지.
- 무결성 검증 / digest / checksum 계산 — 본 helper 는 batch 의 byte 위치·범위 필드만 사용(무결성 source 0).
- REST controller / endpoint / HTTP 상태 mapping / WebUI 렌더 컴포넌트 / 차트·시각화 — repository·WebUI 게이트 후속.
- 표준편차·중앙값·히스토그램 등 고차 통계 — 본 helper 는 총합·최대·평균·비중의 기초 산술 정량화만, 고차 통계는 별도 후속 helper 후보.
- 새 외부 dependency 추가 금지.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시점)
