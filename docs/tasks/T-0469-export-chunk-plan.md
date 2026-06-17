---
id: T-0469
title: UC-07 §8 NFR chunked streaming 의 실제 chunk 경계(개수·offset·size·마지막 잔여)를 산정하는 순수 helper buildExportChunkPlan
phase: P7
status: DONE
mergedAs: 07602e4
prNumber: 380
reviewRounds: 1
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 195
estimatedFiles: 2
created: 2026-06-17
independentStream: uc07-export-import-helpers
dependsOn: []
touchesFiles:
  - src/export/export-chunk-plan.ts
  - src/export/export-chunk-plan.spec.ts
hqOrigin: null
plannerNote: "P7 UC-07 §8 NFR — buildExportJobPlan(T-0467)은 chunked:boolean 권고 플래그만 산출, 실제 chunked streaming 의 chunk 경계(개수·byte offset·각 chunk size·마지막 잔여)는 32 helper 중 0회 cover. pr·게이트-free·dependsOn []."
---

# T-0469 — UC-07 §8 NFR chunked streaming 의 실제 chunk 경계(개수·offset·size·마지막 잔여)를 산정하는 순수 helper buildExportChunkPlan

## Why

UC-07 §8 NFR 은 대량 dump 를 "async job + status polling + **chunked streaming**" 으로 전달하라 명시한다. 직전 `buildExportJobPlan`(T-0467)은 estimate 로부터 `chunked: boolean`(estimatedBytes > chunkThreshold) 권고 플래그까지만 산출하고, `describeExportJobStatus`(T-0468)는 단일 status enum 을 진행 view 로 렌더할 뿐 — **chunked streaming 을 실제로 수행하려면 필요한 chunk 경계(전체 chunk 개수·각 chunk 의 byte offset·각 chunk 의 byte size·마지막 chunk 의 잔여 byte) 산정은 32 helper 중 0 회 cover 된 gap** 이다(`git grep buildExportChunkPlan|ExportChunkPlan|ExportChunk|computeChunk|chunkOffsets src/` → 0 매칭). T-0467 이 "chunked 가 필요한가" 를 boolean 으로 판정한다면, 본 helper 는 그 estimate 의 `estimatedBytes` 와 chunk 크기를 입력으로 받아 "그럼 chunk 를 어떻게 자를 것인가(몇 개로·각각 몇 byte·어디서부터)" 의 분할 plan 을 순수 산술로 박제한다. UC-07 §5 step 13(Export 다운로드) + §8 chunked streaming 이 필요로 하는 chunk descriptor 를 채운다. 실 streaming / byte slice / HTTP range / job store 0 — 입력으로 받은 `estimatedBytes` 와 `chunkSizeBytes` 만으로 경계를 derive 한다.

## Required Reading

- `docs/use-cases/UC-07-export-import.md` §8 (NFR — async job + status polling + chunked streaming) + §5 step 13
- `src/export/export-job-plan.ts` — `ExportJobPlan.chunked: boolean` + `ExportJobPlanOptions.chunkThresholdBytes` + `DEFAULT_CHUNK_THRESHOLD_BYTES` + `isPlainObject` / `describeNonObject` / `isValidNonNegativeInteger` 입력 방어 + 한국어 message convention mirror 대상. **본 helper 는 chunk threshold(전달 여부 판정)와 chunk size(분할 단위)를 혼동하지 않는다 — buildExportJobPlan 의 chunked 플래그를 재호출하지 않고 estimatedBytes 만 입력으로 받는다(DRY).**
- `src/export/export-dump-size-estimate.ts` — 입력 `ExportDumpSizeEstimate` 타입(`estimatedBytes` / `humanSize` / `recordTotal` / `perEntityBytes` / `large` / `recommendation`) + `formatHumanSize` 류 byte → 한국어 라벨 convention 참조(존재 시 import 재사용, 그렇지 않으면 본 helper 는 byte 숫자만 다룸)
- `CLAUDE.md` §3.2 (R-112 4종 test 의무) + §12 (언어 정책 — 식별자 영어, 메시지·주석 한국어)

## Acceptance Criteria

- [ ] `src/export/export-chunk-plan.ts` 신설. 신규 도메인 타입만 신설: `ExportChunk`(plain object: `index: number`(0-base 순번), `offsetBytes: number`(이 chunk 시작 byte offset), `sizeBytes: number`(이 chunk 의 byte 수 — 마지막 chunk 는 잔여), `last: boolean`(마지막 chunk 면 true)), `ExportChunkPlan`(plain object: `totalBytes: number`(입력 estimatedBytes 그대로), `chunkSizeBytes: number`(분할 단위), `chunkCount: number`(전체 chunk 개수), `chunks: ExportChunk[]`(경계 목록), `lastChunkSizeBytes: number`(마지막 chunk byte — totalBytes 가 chunkSize 의 배수면 chunkSize, 아니면 잔여), `headline: string`(한국어 한 줄 요약)). `ExportDumpSizeEstimate` 는 재사용(import). `ExportChunkPlanOptions`(`maxChunks?: number`(이 개수 초과 시 chunk 크기를 키우는 대신 RangeError 로 거부할지, 또는 cap 적용할지 — 둘 중 하나를 spec describe 문자열로 박제하고 일관 적용; 단순화를 위해 미지정 시 cap 없음)) 만 선택 신설.
- [ ] `buildExportChunkPlan(estimate, chunkSizeBytes, options?)` 순수 함수: `estimate.estimatedBytes`(= `totalBytes`)와 `chunkSizeBytes` 로부터 chunk 경계를 산정. `chunkCount = totalBytes === 0 ? 0 : Math.ceil(totalBytes / chunkSizeBytes)`. 각 chunk i(0-base): `offsetBytes = i * chunkSizeBytes`, 마지막 chunk(`i === chunkCount - 1`) 외에는 `sizeBytes = chunkSizeBytes`, 마지막 chunk 는 `sizeBytes = totalBytes - offsetBytes`(= 잔여, 배수면 chunkSize), `last = (i === chunkCount - 1)`. 불변: `chunks.length === chunkCount`, `sum(chunks[*].sizeBytes) === totalBytes`, 마지막 외 모든 chunk `sizeBytes === chunkSizeBytes`, `chunks[i].offsetBytes === chunks[i-1].offsetBytes + chunks[i-1].sizeBytes`(인접 chunk 연속·gap 0·overlap 0), `lastChunkSizeBytes === (chunkCount === 0 ? 0 : chunks[chunkCount-1].sizeBytes)`, `0 < lastChunkSizeBytes <= chunkSizeBytes`(chunkCount > 0 일 때). non-mutating(입력 estimate 변형 0, 반환 객체·배열은 항상 새 것). 동일 입력 2회 호출은 동등 결과(순수·결정성).
- [ ] 빈/경계 입력 처리: `totalBytes === 0` → `chunkCount=0` + `chunks=[]` + `lastChunkSizeBytes=0`(chunk 없음을 명시). `totalBytes <= chunkSizeBytes`(0 초과) → 단일 chunk(`chunkCount=1`, `chunks[0].sizeBytes === totalBytes`, `last=true`). `totalBytes` 가 `chunkSizeBytes` 의 정확한 배수 → 마지막 chunk `sizeBytes === chunkSizeBytes`(잔여 0 이 아니라 full chunk — 빈 추가 chunk 금지). 각 경계를 spec 으로 명시 검증.
- [ ] 입력 방어: `estimate` 가 plain object 아님(null/배열/원시값) → 한국어 `TypeError`(label "estimate"). `estimate.estimatedBytes` 가 비-정수·음수·NaN·Infinity·비-number → `TypeError`(받은 값 박제). `chunkSizeBytes` 가 **양의 정수**(0 금지 — 0 으로 나누기 방지)가 아님(0·음수·소수·NaN·Infinity·비-number) → 한국어 `RangeError` 또는 `TypeError`(어느 쪽인지 spec describe 로 박제·일관 적용, 받은 값 메시지 박제). `options` 가 비-object(배열/null — undefined 는 정상) → `TypeError`. `maxChunks`(주어졌으면) 부적합 → `TypeError`/`RangeError`.
- [ ] **Happy-path unit test**: 배수 케이스(예 totalBytes=300, chunkSize=100 → chunkCount=3, 각 sizeBytes=100, offset 0/100/200, last=index2), 잔여 케이스(예 totalBytes=250, chunkSize=100 → chunkCount=3, sizeBytes 100/100/50, lastChunkSizeBytes=50), 단일 chunk 케이스(totalBytes ≤ chunkSize), 0 byte 케이스(chunkCount=0) 각각의 모든 필드 기대값 검증 test 각 1+ (총 4+ happy test).
- [ ] **Error path unit test**: estimate 비-object / estimatedBytes 부적합(음수·소수·NaN·Infinity·비-number) / chunkSizeBytes=0(0 나누기 방지) / chunkSizeBytes 음수·소수·NaN·Infinity·비-number / options 비-object / maxChunks 부적합 각각에 대해 throw 검증 test 1+ (메시지 label·받은 값 포함 확인). 단일 negative 만 작성 금지 — 부적합 입력 종류마다 분리.
- [ ] **Flow / branch 분리 test**: 배수/잔여 분기(마지막 chunk 가 full vs 잔여), 0 byte / 단일 chunk / 다중 chunk 분기, last 플래그 분기(첫·중간·마지막 chunk 의 last 값), options 미지정 vs maxChunks 지정 분기 각 1+ test.
- [ ] **Negative cases 충분 cover**: `sum(chunks[*].sizeBytes) === totalBytes`(소실·중복 byte 0), 인접 chunk 연속(`offsetBytes` 가 직전 offset+size 와 정확히 일치 — gap/overlap 0), `0 < lastChunkSizeBytes <= chunkSizeBytes`(chunkCount>0), `chunks.length === chunkCount`, 마지막 외 모든 chunk `sizeBytes === chunkSizeBytes` 불변을 배수·잔여·단일 chunk 케이스 전수로 검증하는 test 1+, non-mutating(반환 객체가 호출마다 새 인스턴스 — 두 호출 결과 `!==` 이면서 deep-equal, freeze 입력 통과) 검증 1+, 큰 totalBytes 와 작은 chunkSize 에서 chunkCount 가 정확히 `Math.ceil` 값임을 검증하는 test 1+.
- [ ] `src/export/export-chunk-plan.spec.ts` colocated spec 으로 위 test 작성(NestJS convention).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — 신규 파일은 100% 목표).

## Out of Scope

- 실 chunked streaming / byte slice 추출 / HTTP Range·Content-Range 헤더 직렬화 / SSE·long-poll 전송 / resumable upload 배선 — 본 helper 는 byte 경계 산정만. 실 streaming 은 P5 service / controller layer(repository 게이트).
- REST controller / endpoint / HTTP status mapping — repository 게이트 후속.
- `buildExportJobPlan`(T-0467) / `estimateExportDumpSize`(T-0466) / `describeExportJobStatus`(T-0468) 재호출·재구현 — 본 helper 는 `ExportDumpSizeEstimate`(estimatedBytes)와 `chunkSizeBytes` 만 입력으로 받는다(DRY).
- chunk 크기·maxChunks 의 정책 source(ENV / DB row / config) — 본 helper 는 인자로 받은 값만 사용(정책 source 0).
- chunk 별 실제 record 분배(어떤 record 가 어느 chunk 에 들어가는지) — 본 helper 는 byte 경계만, record-level 분배는 실 직렬화 게이트 후속.
- 새 외부 dependency 추가 금지.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시점)
