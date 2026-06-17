---
id: T-0474
title: UC-07 §8 NFR chunked streaming 재요청 coalescing(T-0473)이 절감한 HTTP Range 요청 수·절감률을 정량화하는 순수 helper summariseExportChunkRefetchSavings
phase: P7
status: DONE
completedAt: 2026-06-17T15:50:30Z
prNumber: 385
mergeCommit: 90df25d
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 200
estimatedFiles: 2
created: 2026-06-18
independentStream: uc07-export-import-helpers
dependsOn: []
touchesFiles:
  - src/export/export-chunk-refetch-savings.ts
  - src/export/export-chunk-refetch-savings.spec.ts
hqOrigin: null
plannerNote: "P7 UC-07 §8 NFR — coalesceExportChunkRefetch(T-0473)는 병합된 ranges/rangeCount/failedChunkCount 만 노출, 병합이 절감한 HTTP Range 요청 수(failedChunkCount-rangeCount)·절감률은 37 helper 중 0회 cover. pr·게이트-free·dependsOn []."
---

# T-0474 — UC-07 §8 NFR chunked streaming 재요청 coalescing 절감 효과 정량화 순수 helper summariseExportChunkRefetchSavings

## Why

UC-07 §8 NFR 은 대량 dump 를 "async job + status polling + **chunked streaming**" 으로 전달하고, 부분 손상 복구 시 **재요청 HTTP Range 요청 수를 최소화**(효율적 전송)하라 명시한다. 직전 `coalesceExportChunkRefetch`(T-0473)는 수신측 무결성 reconcile 결과의 연속(인접 index) 실패 chunk 들을 하나의 byte 범위로 **병합**한 재요청 batch(`ExportChunkRefetchBatch{rangeCount, failedChunkCount, refetchBytes, ranges}`)를 산정한다. 즉 병합 *후* 의 범위 개수(`rangeCount`)와 병합 *전* 의 실패 chunk 개수(`failedChunkCount`)를 모두 노출하지만, **병합이 실제로 절감한 HTTP Range 요청 수**(`failedChunkCount - rangeCount`)·**절감률**·그 효율 이득을 사람이 읽을 수 있는 view 로 **정량화**하는 합성은 37 helper(T-0437~T-0473) 중 0 회 cover 된 gap 이다(`git grep savings|Savings|reduction|requestsSaved|requestCount|requestsEliminated src/export` → 0 매칭).

`coalesceExportChunkRefetch`(T-0473)가 재요청 범위를 **병합·열거**한다면, 본 helper 는 그와 직교(orthogonal) — 이미 산출된 `ExportChunkRefetchBatch` 를 받아 **병합으로 제거된 요청 수**(`requestsSaved = failedChunkCount - rangeCount`), **절감률**(`savingsRatio = requestsSaved / failedChunkCount`, 백분율), 효율 등급(절감 없음 / 부분 / 전부 1요청 통합)을 순수 산술로 derive 한다(실 재전송·byte slice·HTTP Range·헤더 직렬화·요청 발행 0). 이로써 coalescing 의 ROI 가 관측 가능해져 UC-07 §8 NFR 의 효율적 부분 손상 복구를 정량적으로 채운다(WebUI/로그가 "N개 요청 → M개로 통합, K개 절감(P%)" 를 그대로 표시).

## Required Reading

- `docs/use-cases/UC-07-export-import.md` §8 (NFR — async job + status polling + chunked streaming) + §5 step 13
- `src/export/export-chunk-refetch-coalesce.ts` — `ExportChunkRefetchBatch{allIntact, failedChunkCount, rangeCount, ranges: ExportChunkRefetchRange[], refetchBytes, headline}` + `ExportChunkRefetchRange{firstBytePos, lastBytePos, byteLength, firstChunkIndex, lastChunkIndex, chunkCount}` 타입(본 helper 의 입력으로 재사용 import) + `isPlainObject` / `describeNonObject` / `isValidNonNegativeInteger` 입력 방어 + 한국어 message convention mirror 대상. **본 helper 는 coalescing 을 재실행하지 않고 입력으로 받은 `ExportChunkRefetchBatch` 의 필드를 그대로 사용한다(DRY — coalesceExportChunkRefetch 재호출 금지).**
- `src/export/export-chunk-integrity-reconcile.ts` — `ExportChunkIntegrityReconcile` 타입(참조만 — 본 helper 입력 아님; failedChunkCount 의미 동형 참조). 입력 방어 helper 동형 패턴.
- `CLAUDE.md` §3.2 (R-112 4종 test 의무) + §12 (언어 정책 — 식별자 영어, 메시지·주석 한국어)

## Acceptance Criteria

- [ ] `src/export/export-chunk-refetch-savings.ts` 신설. 신규 도메인 타입만 신설: `ExportChunkRefetchSavings`(plain object: `allIntact: boolean`(병합할 실패 chunk 0개 = batch.allIntact), `failedChunkCount: number`(병합 전 실패 chunk 총 개수 = 병합 없을 때 필요한 요청 수 = batch.failedChunkCount), `rangeCount: number`(병합 후 연속 범위 개수 = coalescing 후 실제 요청 수 = batch.rangeCount), `requestsSaved: number`(병합으로 제거된 요청 수 = failedChunkCount - rangeCount; 0 이상), `savingsRatio: number`(절감률 0~1 소수 = failedChunkCount === 0 일 때 0, 아니면 requestsSaved / failedChunkCount), `savingsPercent: number`(savingsRatio × 100 을 정수로 반올림한 백분율 0~100), `fullyCoalesced: boolean`(모든 실패 chunk 가 하나의 범위로 통합 = failedChunkCount > 0 && rangeCount === 1), `refetchBytes: number`(= batch.refetchBytes — 병합은 byte 총량 보존, 절감 view 에 함께 노출), `headline: string`(한국어 한 줄 — "N개 요청 → M개로 통합, K개 절감(P%)" 또는 무결 시 절감 없음 요약)). `ExportChunkRefetchBatch` 는 재사용(import). 옵션 타입은 신설하지 않음.
- [ ] `summariseExportChunkRefetchSavings(batch)` 순수 함수: 입력 `ExportChunkRefetchBatch`(T-0473)로부터 `requestsSaved = failedChunkCount - rangeCount`, `savingsRatio = failedChunkCount === 0 ? 0 : requestsSaved / failedChunkCount`, `savingsPercent = Math.round(savingsRatio * 100)`, `fullyCoalesced = failedChunkCount > 0 && rangeCount === 1`, `allIntact = batch.allIntact`, `refetchBytes = batch.refetchBytes` 를 derive. 불변: `requestsSaved >= 0`(rangeCount <= failedChunkCount — coalescing 은 요청 수를 늘리지 않음), `requestsSaved === failedChunkCount - rangeCount`, `0 <= savingsRatio <= 1`, `0 <= savingsPercent <= 100`, `allIntact ⟺ (failedChunkCount === 0) ⟺ (rangeCount === 0) ⟺ (requestsSaved === 0 && savingsRatio === 0)`, `fullyCoalesced ⟹ (rangeCount === 1 && failedChunkCount >= 1)`, `failedChunkCount === rangeCount ⟹ requestsSaved === 0 && savingsRatio === 0`(병합 없음 — 전부 비연속 실패). non-mutating(입력 batch / batch.ranges 변형 0, 반환 객체 항상 새 것). 동일 입력 2회 호출은 동등 결과(순수·결정성).
- [ ] 경계 입력 처리: `batch.allIntact === true`(failedChunkCount=0, rangeCount=0) → `requestsSaved=0`, `savingsRatio=0`, `savingsPercent=0`, `fullyCoalesced=false`, headline 은 "재요청 불필요(무결)" 동형. 단일 실패 chunk(failedChunkCount=1, rangeCount=1) → `requestsSaved=0`, `savingsRatio=0`, `fullyCoalesced=true`(1개 chunk 가 1개 범위 — 통합 단위). 전부 연속 실패(failedChunkCount=5, rangeCount=1) → `requestsSaved=4`, `savingsRatio=0.8`, `savingsPercent=80`, `fullyCoalesced=true`. 전부 비연속 실패(failedChunkCount=3, rangeCount=3) → `requestsSaved=0`, `savingsRatio=0`, `fullyCoalesced=false`. 혼합(failedChunkCount=3, rangeCount=2) → `requestsSaved=1`, `savingsRatio≈0.333`, `savingsPercent=33`, `fullyCoalesced=false`. 반올림 경계(예 failedChunkCount=3, rangeCount=1 → ratio=2/3≈0.667 → percent=67) 검증. 각 경계를 spec 으로 명시 검증.
- [ ] 입력 방어: `batch` 이 plain object 아님(null/배열/원시값) → 한국어 `TypeError`(label "batch"). `batch.failedChunkCount` / `batch.rangeCount` / `batch.refetchBytes` 가 비-음수정수 아님 → `TypeError`(label·받은 값 박제 — 손상된 batch 거부). `batch.allIntact` 가 boolean 아님 → `TypeError`(label·받은 값 박제). `batch.rangeCount > batch.failedChunkCount`(병합이 요청 수를 늘린 모순 — coalescing 계약 위반) → 한국어 `RangeError`(위반 박제 — 손상된 batch). `batch.allIntact` 와 수치의 모순(allIntact=true 인데 failedChunkCount !== 0 또는 rangeCount !== 0; allIntact=false 인데 failedChunkCount === 0) → `RangeError`(모순 박제). `batch.failedChunkCount === 0` 인데 `batch.rangeCount !== 0` 또는 그 역(failedChunkCount > 0 인데 rangeCount === 0) → `RangeError`(모순 박제 — 무결/손상 정의 위반). 어느 쪽인지(TypeError vs RangeError) spec describe 로 박제·일관 적용.
- [ ] **Happy-path unit test**: 전부 연속(failedChunkCount=5, rangeCount=1 → requestsSaved=4, savingsPercent=80, fullyCoalesced=true), 전부 비연속(3,3 → requestsSaved=0, fullyCoalesced=false), 혼합(3,2 → requestsSaved=1, savingsPercent=33), allIntact(0,0 → 전부 0, fullyCoalesced=false), 단일 실패(1,1 → requestsSaved=0, fullyCoalesced=true) 각각의 모든 필드 기대값 검증 test 각 1+ (총 5+ happy test).
- [ ] **Error path unit test**: batch 비-object / failedChunkCount·rangeCount·refetchBytes 비-음수정수 아님(각각) / allIntact 비-boolean / rangeCount > failedChunkCount / allIntact 와 수치 모순(true+failedChunkCount!=0, false+failedChunkCount==0) / failedChunkCount=0 인데 rangeCount!=0 / failedChunkCount>0 인데 rangeCount==0 각각에 대해 throw 검증 test 1+ (메시지 label·받은 값·위반 포함 확인, TypeError vs RangeError 구분 확인). 단일 negative 만 작성 금지 — 부적합 입력 종류마다 분리.
- [ ] **Flow / branch 분리 test**: allIntact true vs false 분기(전부 0 vs 값), failedChunkCount === 0 분기(savingsRatio=0 단락)·> 0 분기(나눗셈), fullyCoalesced 분기(rangeCount===1 && failedChunkCount>=1 일 때 true / 아닐 때 false — failedChunkCount=1·rangeCount=1 경계, failedChunkCount=2·rangeCount=1 경계, rangeCount=2 경계 각 1+), requestsSaved=0 분기(failedChunkCount===rangeCount, 병합 없음) vs > 0 분기, savingsPercent 반올림 분기(0.5 미만 내림 vs 이상 올림 경계) 각 1+ test.
- [ ] **Negative cases 충분 cover**: `requestsSaved === failedChunkCount - rangeCount` 및 `requestsSaved >= 0`(병합이 요청을 늘리지 않음), `0 <= savingsRatio <= 1` 및 `savingsPercent === Math.round(savingsRatio*100)`, `allIntact ⟺ (failedChunkCount === 0) ⟺ (rangeCount === 0) ⟺ (requestsSaved === 0)`, `fullyCoalesced ⟹ (rangeCount === 1 && failedChunkCount >= 1)`, `failedChunkCount === rangeCount ⟹ requestsSaved === 0`(전부 비연속) 을 연속·비연속·혼합·무결 케이스 전수로 검증하는 test 1+, non-mutating(입력 batch deepFreeze 통과 + 반환 객체가 호출마다 새 인스턴스 — 두 호출 결과 `!==` 이면서 deep-equal) 검증 1+.
- [ ] `src/export/export-chunk-refetch-savings.spec.ts` colocated spec 으로 위 test 작성(NestJS convention).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — 신규 파일은 100% 목표).

## Out of Scope

- 실 재전송 / byte slice 추출 / HTTP Range 요청 발행·206 Partial Content 응답 / `Range: bytes=a-b` 또는 `Content-Range` 헤더 문자열 직렬화 / 병렬 재전송 스케줄링 — 본 helper 는 coalescing 절감 효과 **수치 정량화**만. 실 재전송·헤더 직렬화는 P5 service / controller layer(repository 게이트).
- chunk 병합·재요청 범위 산정 재실행 — 본 helper 는 이미 산출된 `ExportChunkRefetchBatch`(T-0473) 만 입력으로 받는다(DRY — coalesceExportChunkRefetch 재호출·재구현 금지). 병합은 `coalesceExportChunkRefetch`(T-0473) 의 책임, per-chunk 무결성 reconcile 은 `reconcileExportChunkIntegrity`(T-0472) 의 책임.
- 무결성 검증 / digest / checksum 계산 — 본 helper 는 batch 의 수치 필드만 사용(무결성 source 0).
- 재요청 byte 총량(`refetchBytes`)의 절감 — coalescing 은 byte 총량을 **보존**하므로 byte 절감은 0(요청 수만 절감). refetchBytes 는 함께 노출만 하고 절감 대상으로 계산하지 않는다.
- REST controller / endpoint / HTTP 상태 mapping / WebUI 렌더 컴포넌트 — repository·WebUI 게이트 후속.
- 재시도 정책 / backoff / 최대 재요청 횟수 / timeout / 비용 모델(요청당 latency·대역폭 추정) — 본 helper 는 요청 수 절감의 산술 정량화만, 실 비용 모델은 streaming 게이트 후속.
- 새 외부 dependency 추가 금지.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시점)
