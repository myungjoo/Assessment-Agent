---
id: T-0475
title: UC-07 §8 NFR chunked streaming 재요청 batch(T-0473)의 실패 byte 영역 분산(fragmentation) 형상을 정량화하는 순수 helper summariseExportChunkRefetchFragmentation
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 200
estimatedFiles: 2
created: 2026-06-17
independentStream: uc07-export-import-helpers
dependsOn: []
touchesFiles:
  - src/export/export-chunk-refetch-fragmentation.ts
  - src/export/export-chunk-refetch-fragmentation.spec.ts
hqOrigin: null
plannerNote: "P7 UC-07 §8 NFR — coalesceExportChunkRefetch(T-0473)는 병합 범위 배열만, summariseExportChunkRefetchSavings(T-0474)는 요청 수 절감만 노출. 실패 byte 영역의 분산 형상(범위 개수·최대/평균 범위·산포도)은 38 helper 중 0회 cover. pr·게이트-free·dependsOn []."
---

# T-0475 — UC-07 §8 NFR chunked streaming 재요청 batch 실패 byte 영역 분산(fragmentation) 형상 정량화 순수 helper summariseExportChunkRefetchFragmentation

## Why

UC-07 §8 NFR 은 대량 dump 를 "async job + status polling + **chunked streaming**" 으로 전달하고, 부분 손상 복구 시 효율적 재전송을 요구한다. 직전 `coalesceExportChunkRefetch`(T-0473)는 수신측 무결성 reconcile 결과의 인접(연속 index) 실패 chunk 들을 하나의 연속 byte 범위로 병합한 재요청 batch(`ExportChunkRefetchBatch{rangeCount, failedChunkCount, refetchBytes, ranges: ExportChunkRefetchRange[]}`)를 산정하고, `summariseExportChunkRefetchSavings`(T-0474)는 병합이 절감한 **HTTP Range 요청 수·절감률**을 정량화한다.

그러나 둘 다 실패 byte 영역이 dump 전반에 **얼마나 흩어져(분산) 있는지의 형상(fragmentation)** 은 노출하지 않는다 — 즉 손상이 한 덩어리로 뭉쳐 있는지(1개 큰 범위) 아니면 dump 전반에 잘게 흩어져 있는지(많은 작은 범위), 가장 큰 재요청 범위가 얼마인지, 범위당 평균 byte·chunk 수가 얼마인지 등 **손상의 산포 특성**은 38 helper(T-0437~T-0474) 중 0 회 cover 된 gap 이다(`git grep -i fragment|scatter|dispersion|density|largestRange|averageRange|spanBytes|contiguity src/export` → 무관 매칭만, 0 도메인 cover).

`coalesceExportChunkRefetch`(T-0473)가 재요청 범위를 **병합·열거**하고 `summariseExportChunkRefetchSavings`(T-0474)가 **요청 수 절감**을 정량화한다면, 본 helper 는 그와 직교(orthogonal) — 이미 산출된 `ExportChunkRefetchBatch` 의 `ranges` 배열을 받아 **손상 byte 영역의 분산 형상**(범위 개수, 최대/최소/평균 범위 byte, 범위당 평균 chunk 수, 단일 범위 통합 여부, 가장 큰 범위가 차지하는 byte 비중)을 순수 산술로 derive 한다(실 재전송·byte slice·HTTP Range·헤더 직렬화·요청 발행 0). 이로써 운영자/로그가 "재요청 N개 범위, 최대 X bytes, 평균 Y bytes/범위" 같은 손상 형상을 관측해 재전송 전략(병렬도·우선순위)을 판단할 근거를 갖는다 — UC-07 §8 NFR 의 효율적 부분 손상 복구를 정량적으로 보강한다.

## Required Reading

- `docs/use-cases/UC-07-export-import.md` §8 (NFR — async job + status polling + chunked streaming) + §5 step 13
- `src/export/export-chunk-refetch-coalesce.ts` — `ExportChunkRefetchBatch{allIntact, failedChunkCount, rangeCount, ranges: ExportChunkRefetchRange[], refetchBytes, headline}` + `ExportChunkRefetchRange{firstBytePos, lastBytePos, byteLength, firstChunkIndex, lastChunkIndex, chunkCount}` 타입(본 helper 의 입력으로 재사용 import) + `isPlainObject` / `describeNonObject` / `isValidNonNegativeInteger` 입력 방어 + 한국어 message convention mirror 대상. **본 helper 는 coalescing 을 재실행하지 않고 입력으로 받은 `ExportChunkRefetchBatch` 의 `ranges`·수치 필드를 그대로 사용한다(DRY — coalesceExportChunkRefetch 재호출 금지). 불변 `ranges 의 chunkCount 합 === failedChunkCount`·`ranges 의 byteLength 합 === refetchBytes`·`rangeCount === ranges.length`·`ranges 는 firstBytePos 오름차순` 을 신뢰·검증한다.**
- `src/export/export-chunk-refetch-savings.ts` — `summariseExportChunkRefetchSavings`(T-0474). 동일 batch 를 입력으로 받는 직교 helper — 본 helper 는 요청 수 절감(savings)이 아닌 **byte 영역 분산 형상(fragmentation)** 을 산정한다(중복 0). 입력 방어·non-mutating·결정성 패턴 mirror 대상.
- `CLAUDE.md` §3.2 (R-112 4종 test 의무) + §12 (언어 정책 — 식별자 영어, 메시지·주석 한국어)

## Acceptance Criteria

- [ ] `src/export/export-chunk-refetch-fragmentation.ts` 신설. 신규 도메인 타입만 신설: `ExportChunkRefetchFragmentation`(plain object: `allIntact: boolean`(= batch.allIntact — 재요청 범위 0개), `rangeCount: number`(= batch.rangeCount = ranges.length — 분산된 재요청 범위 개수), `failedChunkCount: number`(= batch.failedChunkCount — 총 실패 chunk), `refetchBytes: number`(= batch.refetchBytes — 총 재요청 byte), `largestRangeBytes: number`(가장 큰 범위의 byteLength; ranges 비었으면 0), `smallestRangeBytes: number`(가장 작은 범위의 byteLength; ranges 비었으면 0), `averageRangeBytes: number`(refetchBytes / rangeCount; rangeCount === 0 이면 0; 소수 그대로), `averageChunksPerRange: number`(failedChunkCount / rangeCount; rangeCount === 0 이면 0; 소수 그대로), `largestRangeChunkCount: number`(가장 큰 byteLength 범위의 chunkCount; ranges 비었으면 0), `largestRangeShare: number`(largestRangeBytes / refetchBytes; refetchBytes === 0 이면 0; 0~1 소수), `singleRange: boolean`(rangeCount === 1 — 손상이 한 덩어리로 통합), `fragmented: boolean`(rangeCount > 1 — 손상이 둘 이상으로 분산), `headline: string`(한국어 한 줄 — "재요청 N개 범위, 최대 X bytes, 평균 Y bytes/범위" 또는 무결 시 분산 없음 요약)). `ExportChunkRefetchBatch` / `ExportChunkRefetchRange` 는 재사용(import). 옵션 타입은 신설하지 않음.
- [ ] `summariseExportChunkRefetchFragmentation(batch)` 순수 함수: 입력 `ExportChunkRefetchBatch`(T-0473)의 `ranges` 배열을 1회 순회해 `largestRangeBytes = max(byteLength)`, `smallestRangeBytes = min(byteLength)`, `largestRangeChunkCount`(largestRangeBytes 범위의 chunkCount — 동률이면 먼저 만난 것), `averageRangeBytes = rangeCount === 0 ? 0 : refetchBytes / rangeCount`, `averageChunksPerRange = rangeCount === 0 ? 0 : failedChunkCount / rangeCount`, `largestRangeShare = refetchBytes === 0 ? 0 : largestRangeBytes / refetchBytes`, `singleRange = rangeCount === 1`, `fragmented = rangeCount > 1`, `allIntact = batch.allIntact` 를 derive. 불변: `0 <= smallestRangeBytes <= averageRangeBytes <= largestRangeBytes`(rangeCount >= 1 일 때), `largestRangeBytes <= refetchBytes`, `0 <= largestRangeShare <= 1`, `rangeCount === 1 ⟹ largestRangeBytes === smallestRangeBytes === refetchBytes && largestRangeShare === 1 && singleRange && !fragmented`, `allIntact ⟺ (rangeCount === 0) ⟺ (refetchBytes === 0 && failedChunkCount === 0)`, `allIntact ⟹ 모든 byte/평균/share 값 === 0 && !singleRange && !fragmented`, `singleRange XOR fragmented`(rangeCount >= 1 일 때; rangeCount === 0 이면 둘 다 false). non-mutating(입력 batch / batch.ranges 변형 0, 반환 객체 항상 새 것). 동일 입력 2회 호출은 동등 결과(순수·결정성).
- [ ] 경계 입력 처리: `batch.allIntact === true`(rangeCount=0, ranges=[]) → 모든 byte/평균/share=0, `singleRange=false`, `fragmented=false`, headline 은 "재요청 범위 없음(무결)" 동형. 단일 범위(rangeCount=1, ranges=[{byteLength:100, chunkCount:3}], refetchBytes=100) → `largestRangeBytes=100`, `smallestRangeBytes=100`, `averageRangeBytes=100`, `largestRangeShare=1`, `averageChunksPerRange=3`, `largestRangeChunkCount=3`, `singleRange=true`, `fragmented=false`. 다중 범위(rangeCount=3, byteLength 30/50/20, chunkCount 1/2/1, refetchBytes=100, failedChunkCount=4) → `largestRangeBytes=50`, `smallestRangeBytes=20`, `averageRangeBytes≈33.33`, `largestRangeShare=0.5`, `largestRangeChunkCount=2`, `averageChunksPerRange≈1.333`, `singleRange=false`, `fragmented=true`. 동률 최대 byteLength(예 40/40/20) → 먼저 만난 범위의 chunkCount 채택 검증. 각 경계를 spec 으로 명시 검증.
- [ ] 입력 방어: `batch` 이 plain object 아님(null/배열/원시값) → 한국어 `TypeError`(label "batch"). `batch.ranges` 가 배열 아님 → `TypeError`(label "batch.ranges"). `batch.failedChunkCount` / `batch.rangeCount` / `batch.refetchBytes` 가 비-음수정수 아님 → `TypeError`(label·받은 값 박제 — 손상된 batch 거부). `batch.allIntact` 가 boolean 아님 → `TypeError`(label·받은 값 박제). `batch.ranges` 원소가 plain object 아니거나 `byteLength`/`chunkCount` 가 비-음수정수 아님 → `TypeError`(원소 index·label 박제). `batch.rangeCount !== batch.ranges.length`(계약 위반) → 한국어 `RangeError`(불일치 박제). `batch.allIntact` 와 수치의 모순(allIntact=true 인데 rangeCount !== 0 또는 ranges.length !== 0; allIntact=false 인데 rangeCount === 0) → `RangeError`(모순 박제). `ranges 의 byteLength 합 !== batch.refetchBytes` 또는 `ranges 의 chunkCount 합 !== batch.failedChunkCount`(coalescing 계약 위반 — 손상된 batch) → `RangeError`(위반·기대값·실제값 박제). 어느 쪽인지(TypeError vs RangeError) spec describe 로 박제·일관 적용.
- [ ] **Happy-path unit test**: 무결(allIntact, rangeCount=0 → 전부 0·!singleRange·!fragmented), 단일 범위(rangeCount=1 → largestRangeShare=1·singleRange·!fragmented), 다중 범위(rangeCount=3 혼합 byteLength → largestRangeBytes/평균/share/fragmented 기대값), 동률 최대(40/40/20 → 먼저 만난 chunkCount), 2개 범위(rangeCount=2 → fragmented·평균) 각각의 모든 필드 기대값 검증 test 각 1+ (총 5+ happy test).
- [ ] **Error path unit test**: batch 비-object / ranges 비-배열 / failedChunkCount·rangeCount·refetchBytes 비-음수정수 아님(각각) / allIntact 비-boolean / ranges 원소 비-object / 원소 byteLength·chunkCount 비-음수정수 아님 / rangeCount !== ranges.length / allIntact 와 수치 모순(true+rangeCount!=0, false+rangeCount==0) / byteLength 합 != refetchBytes / chunkCount 합 != failedChunkCount 각각에 대해 throw 검증 test 1+ (메시지 label·받은 값·위반 포함 확인, TypeError vs RangeError 구분 확인). 단일 negative 만 작성 금지 — 부적합 입력 종류마다 분리.
- [ ] **Flow / branch 분리 test**: allIntact true vs false 분기(전부 0 vs 값), rangeCount === 0 분기(평균·share 단락 0) vs > 0 분기(나눗셈), refetchBytes === 0 분기(largestRangeShare=0 단락) vs > 0 분기, singleRange 분기(rangeCount===1 일 때 true / 아닐 때 false — rangeCount=1·2 경계 각 1+), fragmented 분기(rangeCount>1 일 때 true / 아닐 때 false), 최대 byteLength 선택 분기(첫 원소가 최대 / 중간 원소가 최대 / 마지막 원소가 최대 / 동률 — 먼저 만난 것) 각 1+ test.
- [ ] **Negative cases 충분 cover**: `0 <= smallestRangeBytes <= averageRangeBytes <= largestRangeBytes <= refetchBytes`(rangeCount >= 1), `0 <= largestRangeShare <= 1`, `rangeCount === 1 ⟹ largest === smallest === refetchBytes && share === 1 && singleRange && !fragmented`, `allIntact ⟺ rangeCount === 0 ⟺ (refetchBytes === 0 && failedChunkCount === 0)`, `singleRange XOR fragmented`(rangeCount >= 1; rangeCount === 0 이면 둘 다 false) 를 무결·단일·다중·동률 케이스 전수로 검증하는 test 1+, non-mutating(입력 batch / batch.ranges deepFreeze 통과 + 반환 객체가 호출마다 새 인스턴스 — 두 호출 결과 `!==` 이면서 deep-equal) 검증 1+.
- [ ] `src/export/export-chunk-refetch-fragmentation.spec.ts` colocated spec 으로 위 test 작성(NestJS convention).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — 신규 파일은 100% 목표).

## Out of Scope

- 실 재전송 / byte slice 추출 / HTTP Range 요청 발행·206 Partial Content 응답 / `Range: bytes=a-b` 또는 `Content-Range` 헤더 문자열 직렬화 / 병렬 재전송 스케줄링·우선순위 결정 — 본 helper 는 손상 분산 형상 **수치 정량화**만. 실 재전송·스케줄링은 P5 service / controller layer(repository 게이트).
- chunk 병합·재요청 범위 산정 재실행 — 본 helper 는 이미 산출된 `ExportChunkRefetchBatch`(T-0473) 만 입력으로 받는다(DRY — coalesceExportChunkRefetch 재호출·재구현 금지). 병합은 `coalesceExportChunkRefetch`(T-0473) 의 책임, 요청 수 절감 정량화는 `summariseExportChunkRefetchSavings`(T-0474) 의 책임, per-chunk 무결성 reconcile 은 `reconcileExportChunkIntegrity`(T-0472) 의 책임.
- 요청 수 절감(savings) 재산정 — `summariseExportChunkRefetchSavings`(T-0474) 와 중복 금지. 본 helper 는 byte 영역 **분산 형상**(범위 크기·산포)만, 요청 수 절감은 노출하지 않는다.
- 무결성 검증 / digest / checksum 계산 — 본 helper 는 batch 의 수치·범위 필드만 사용(무결성 source 0).
- REST controller / endpoint / HTTP 상태 mapping / WebUI 렌더 컴포넌트 / 차트·시각화 — repository·WebUI 게이트 후속.
- 재전송 비용 모델 / latency·대역폭 추정 / 표준편차·중앙값 등 고차 통계 — 본 helper 는 최대·최소·평균·비중의 기초 산술 정량화만, 고차 통계는 별도 후속 helper 후보.
- 새 외부 dependency 추가 금지.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시점)
