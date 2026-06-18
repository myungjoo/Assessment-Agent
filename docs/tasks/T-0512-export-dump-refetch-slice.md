---
id: T-0512
title: ADR-0046 §Decision 1 맞물림 (iv) refetch materialization — MaterializedExportDumpChunk[] 를 reconcileExportChunkIntegrity 의 failedChunks(손상 chunk) 경계로 필터해 재요청 대상 chunk subset 만 반환하는 순수 helper selectRefetchMaterializedDumpChunks 신설
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 235
estimatedFiles: 2
created: 2026-06-19
independentStream: uc07-export-import-helpers
dependsOn: []
touchesFiles:
  - src/export/export-dump-refetch-slice.ts
  - src/export/export-dump-refetch-slice.spec.ts
hqOrigin: null
plannerNote: "P7 ADR-0046 §Decision 1 맞물림 (iv) 'refetchRanges 가 손상 chunk 재요청 시 다시 slice 할 경계를 지시' 의 materialization-side piece — 마지막 미박제 맞물림. 순수 helper+spec, dep 0, dependsOn []."
---

# T-0512 — MaterializedExportDumpChunk[] 를 reconcileExportChunkIntegrity 의 failedChunks 경계로 필터해 재요청 대상 chunk subset 만 반환하는 순수 helper selectRefetchMaterializedDumpChunks

## Why

머지된 [ADR-0046](../decisions/ADR-0046-export-dump-materialization-storage.md)(b718bb8, origin/main 8601ad9) Decision §1 "기존 chunk helper 와의 맞물림" 절은 materialization 이 소비할 4 개 산정 helper 를 명시했다 — (i) chunk-plan offset/size → byte slice, (ii) currentRange → Content-Range 헤더, (iii) `resumeFromByte`/`remainingChunks` → resume materialization, **(iv) [reconcileExportChunkIntegrity](../../src/export/export-chunk-integrity-reconcile.ts) 의 `refetchRanges` 가 손상 chunk 재요청 시 materialization 이 다시 slice 할 경계를 지시한다**.

(i)·(ii)·(iii) 는 이미 닫혔다 — [sliceMaterializedDumpByChunkPlan](../../src/export/export-dump-chunk-slice.ts)(T-0507, 885bc22) 이 전체 chunk 를 byte slice 하고, [createChunkedExportDumpReadable](../../src/export/export-dump-chunk-readable.ts)(T-0509, ed56a49) 이 전체 chunk 의 Readable 을 만들며, [serializeExportDownloadHeaders](../../src/export/export-download-headers.ts)(T-0510, 60766ce) 가 (ii) Content-Range 헤더를 직렬화하고, [selectRemainingMaterializedDumpChunks](../../src/export/export-dump-resume-slice.ts)(T-0511, 8601ad9) 가 (iii) **연속 forward resume** 측 materialized subset 을 골라낸다. 그러나 (iv) **refetch materialization** — 수신측이 chunk 별 무결성 검사에서 **비연속(non-contiguous) 손상**(예: chunk 0·2 통과, chunk 1·4 손상)을 발견했을 때, 그 **손상 chunk 들만** 골라 다시 materialize 해 재요청에 응답하는 piece — 는 비어 있다. `git grep -E "selectRefetch|RefetchMaterialized|selectCorrupted|MaterializedRefetch|reconcileMaterialized|selectFailedMaterialized" src/export/` → origin/main 0 매칭(refetch/integrity 기반 materialized chunk subset helper 미박제 확인). [T-0511 §Out of Scope](T-0511-export-dump-resume-slice.md) 도 "(iv) refetch/integrity 기반 손상 chunk re-slice — 별도 후속 helper" 로 본 piece 를 명시 deferred 했다.

(iii) resume 와 (iv) refetch 는 **직교(orthogonal)** 다 — [reconcileExportChunkIntegrity](../../src/export/export-chunk-integrity-reconcile.ts)(T-0472) 의 헤더 주석이 박제하듯, `buildExportChunkResumePlan` 은 *연속* ack 경계 기준 forward resume(어느 byte 부터 이어 보낼지)이지만, integrity reconcile 은 *임의(비연속)* chunk 집합의 무결성 실패를 받아 *그 chunk 들만* 골라 재요청 plan 을 derive 한다. `reconcileExportChunkIntegrity` 는 `ExportChunkIntegrityReconcile{allIntact, failedChunks: ExportChunk[], failedChunkCount, refetchRanges, refetchBytes, ...}` 으로 **재요청 지시(어느 chunk 가 손상됐는지)** 를 순수 산술로 derive 하지만 chunk 경계 메타만 들고 실 byte(`bytes: Buffer`)는 없다. 반대로 `MaterializedExportDumpChunk[]` 은 실 byte 를 들지만 전체 chunk 다. 본 helper 가 그 둘을 잇는다 — reconcile 결과의 `failedChunks` 가 지목한 index 의 materialized chunk subset 만 (원래 byte 보존하며) 골라 반환한다.

본 task 는 그 (iv) deferred piece 를 **순수 helper 함수 1 개** 로 닫아 ADR-0046 §Decision 1 의 4 개 맞물림을 전부 완성한다 — reconcile 재산정 0(T-0472 산출값만 소비 — single-source), 실 byte slice 재계산 0(T-0507 산출 chunk 의 `bytes` 그대로). controller/service/HTTP 206 Partial Content / Range 재요청 배선은 후속 task 책임(ADR-0046 §Out of scope, [UC-07 §8 NFR](../use-cases/UC-07-export-import.md) chunked streaming 신뢰성, REQ-030 다운로드 / REQ-032 raw 미저장).

## Required Reading

- `docs/decisions/ADR-0046-export-dump-materialization-storage.md` — 특히 Decision §1 "기존 chunk helper 와의 맞물림" 절 (iv) ("reconcileExportChunkIntegrity 의 refetchRanges 가 손상 chunk 재요청 시 materialization 이 다시 slice 할 경계를 지시한다") + Decision §3 invariant("chunk helper 가 산정한 byte 경계를 입력으로 받아 slice 만 한다 — helper 의 산정 로직을 controller/service 가 재구현하지 않는다 / 새 외부 dep 0").
- `src/export/export-chunk-integrity-reconcile.ts` (T-0472) — `ExportChunkIntegrityReconcile` interface(`allIntact`/`verifiedChunkCount`/`intactChunkCount`/`failedChunkCount`/`failedChunks: ExportChunk[]`/`refetchRanges`/`refetchBytes`/`headline`, L44~53) + 그 불변(특히 `failedChunks.length === failedChunkCount`, `failedChunks` 항상 index 오름차순, `allIntact ⟺ failedChunkCount === 0`). 본 helper 의 필수 입력 1 타입 — import 재사용(`./export-chunk-integrity-reconcile`), 새 타입 신설 금지. 같은 `isPlainObject`/`describeNonObject`/한국어 `TypeError`/`RangeError` convention 을 mirror.
- `src/export/export-dump-resume-slice.ts` (T-0511, 8601ad9) — 자매 helper `selectRemainingMaterializedDumpChunks`. 본 task 와 거의 동형 구조(materialized subset 선택 + `byIndex` Map + single-source drift 거부 + `Buffer.from(...)` alias 0 + non-mutating + 결정성). **본 helper 의 직접 본보기** — `failedChunks`(reconcile) 가 `remainingChunks`(resume plan) 자리를 대체할 뿐. 같은 입력 방어·복사 패턴을 mirror.
- `src/export/export-dump-chunk-slice.ts` (T-0507, 885bc22) — `MaterializedExportDumpChunk` interface(`index`/`offsetBytes`/`sizeBytes`/`last`/`bytes: Buffer`, L29~35). 본 helper 의 필수 입력 2 타입 — import 재사용(`./export-dump-chunk-slice`), 새 타입 신설 금지.
- `src/export/export-chunk-plan.ts` — `ExportChunk` interface(`index`/`offsetBytes`/`sizeBytes`/`last`). `failedChunks` element 타입. 본 helper 가 index/offset 정합 검증에 참조.

## Acceptance Criteria

- [ ] `src/export/export-dump-refetch-slice.ts` 에 순수 helper `selectRefetchMaterializedDumpChunks(materializedChunks: MaterializedExportDumpChunk[], reconcile: ExportChunkIntegrityReconcile): MaterializedExportDumpChunk[]` 를 신설한다. `MaterializedExportDumpChunk` 는 `./export-dump-chunk-slice`, `ExportChunkIntegrityReconcile` 은 `./export-chunk-integrity-reconcile` 에서 import — 새 도메인 타입 신설 0, 새 외부 dependency 0(Node 내장 Buffer 만). 반환은 항상 새 배열(입력 배열 alias 0).
- [ ] 선택 규칙(reconcile single-source — ADR-0046 §Decision 3): `reconcile.failedChunks` 가 지목한 각 손상 chunk 의 `index` 에 해당하는 `materializedChunks` element 만 골라 **원래 입력 순서(index 오름차순 — `failedChunks` 가 이미 index 오름차순)** 로 반환한다. `reconcile.failedChunks` 의 chunk 경계 메타(`index`/`offsetBytes`/`sizeBytes`/`last`)는 그에 대응하는 `materializedChunks` element 의 메타와 일치해야 하며(single-source 정합 검증), 불일치 시 `RangeError`(아래 입력 방어 (f)). 손상 chunk 의 경계를 본 helper 가 재계산하지 않는다.
- [ ] `allIntact` 분기: (a) `reconcile.allIntact === true`(손상 chunk 0 — `failedChunkCount === 0`, `failedChunks === []`)이면 빈 배열 `[]` 반환(재요청할 chunk 0 — 정상, throw 0). (b) `allIntact === false`이면 `failedChunks` 에 대응하는 materialized subset 반환(`length === failedChunkCount`).
- [ ] 반환 chunk 의 `bytes` 는 입력 `materializedChunks` element 의 `bytes` Buffer 를 **독립 복사본(`Buffer.from(...)`)** 으로 담는다(alias 0 — 반환 chunk 의 bytes 를 mutate 해도 입력/후속 호출 영향 0). 메타(`index`/`offsetBytes`/`sizeBytes`/`last`)는 그대로 복사.
- [ ] 입력 방어 분기(한국어 `TypeError`/`RangeError`, T-0511·T-0472 convention 정합): (a) `materializedChunks` 가 배열 아님(null/undefined/object/원시값) → 한국어 `TypeError`(받은 type label 박제). (b) `reconcile` 이 plain object 아님(null/배열/원시값) → 한국어 `TypeError`. (c) `reconcile.failedChunks` 가 배열 아님 → 한국어 `TypeError`. (d) `reconcile.failedChunkCount` 가 `failedChunks.length` 와 불일치 → 한국어 `RangeError`(reconcile 불변 위반). (e) `failedChunks` 의 어떤 손상 chunk `index` 에 대응하는 element 가 `materializedChunks` 에 없음(index 범위 밖 / 누락) → 한국어 `RangeError`(받은 index 박제). (f) 대응 materialized element 의 경계 메타(`offsetBytes`/`sizeBytes`/`last`/`index`)가 reconcile chunk 메타와 불일치 → 한국어 `RangeError`(불일치 필드·값 박제 — single-source drift 거부). (g) `materializedChunks` 의 어떤 element 가 `MaterializedExportDumpChunk` shape 위반(plain object 아님 / `bytes` 가 Buffer 아님 등)으로 접근 불가 → 한국어 `TypeError`.
- [ ] 입력 `materializedChunks`/`reconcile` 객체·중첩 구조를 변형하지 않는다(non-mutating — `Object.freeze(reconcile)` + 각 chunk `Object.freeze` 로 호출해도 throw 0 + 결과 정확). 동일 입력 2회 호출 결과가 동등(결정성). 반환 배열·element 는 항상 새 객체(입력 alias 0).
- [ ] **Happy-path unit test 1+** — (a) [sliceMaterializedDumpByChunkPlan](../../src/export/export-dump-chunk-slice.ts)(실 dump+plan)로 만든 `MaterializedExportDumpChunk[]` + [reconcileExportChunkIntegrity](../../src/export/export-chunk-integrity-reconcile.ts)(같은 plan, **비연속** `chunkIntegrity` 예: `[true, false, true, false]`)로 만든 `reconcile`(allIntact=false) 전달 → 반환 subset 의 `length === failedChunkCount`, 각 element 의 `index`/`offsetBytes`/`sizeBytes`/`bytes` 가 손상 index(예: 1·3)의 원본 materialized chunk 와 정확히 일치, 순서가 index 오름차순. (b) 반환 subset 의 각 chunk byte 가 원본 직렬화 buffer 의 해당 `offsetBytes..offsetBytes+sizeBytes` slice 와 byte-동일(맞물림 invariant — refetch chunk byte === 원본 손상 chunk byte).
- [ ] **Error path unit test 1+** — (a) `materializedChunks` 비-배열(null/object) → 한국어 `TypeError`. (b) `reconcile` 비-object → `TypeError`. (c) `reconcile.failedChunks` 비-배열 → `TypeError`. (d) `failedChunkCount` 가 `failedChunks.length` 와 불일치 → `RangeError`. (e) `failedChunks` 에 materialized 에 없는 index → `RangeError`. (f) 경계 메타 drift(예: reconcile chunk `sizeBytes` 가 materialized 와 다름) → `RangeError`.
- [ ] **분기마다 test 분리 (branch coverage)** — (i) 각 입력 방어 throw 분기, (ii) `allIntact === true`(빈 배열 반환) 분기, (iii) `allIntact === false` 단일 손상 chunk 분기, (iv) `allIntact === false` **비연속 다수** 손상 chunk 분기, (v) 전부 손상(`failedChunkCount === verifiedChunkCount` — 전체 반환) 경계 분기 각 1+ test.
- [ ] **Negative cases 충분 cover** — (a) `materializedChunks=null` / (b) `materializedChunks={}`(비-배열 object) / (c) `reconcile=null` / (d) `reconcile=배열` / (e) `reconcile.failedChunks=null` / (f) `failedChunkCount`≠`failedChunks.length` / (g) `failedChunks` index 가 materialized 범위 밖(예: index 99) / (h) 경계 메타 drift(`offsetBytes` 불일치) / (i) materialized element 의 `bytes` 가 Buffer 아님 → 각 throw. (j) **전부 무결**(reconcile.allIntact=true, failedChunks=[]) → 빈 배열 반환(throw 0). (k) **빈 dump**(materializedChunks=[], reconcile.allIntact=true, verifiedChunkCount=0) → 빈 배열 반환(throw 0). (l) **non-mutating** — `Object.freeze(reconcile)` + materialized chunk `Object.freeze` 호출해도 throw 0 + 결과 정확. (m) **결정성** — 동일 입력 2회 호출 결과 완전 동일. (n) **alias 0** — 반환 chunk 의 `bytes` 를 mutate 해도 입력 materialized chunk·다음 호출 결과 영향 0.
- [ ] **맞물림 invariant** test 1+ — 전부 손상(`chunkIntegrity` 전부 false, `failedChunkCount === verifiedChunkCount`)일 때 반환 subset 이 입력 `materializedChunks` 와 chunk 개수·각 byte 동일(전체 = 전부 손상의 특수 경우)임을 검증. `allIntact === true`(손상 0)일 때 빈 배열임을 검증. (선택) `reconcile.refetchBytes === 반환 subset 의 sizeBytes 합` 정합 검증(재요청 byte 총량 일치).
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — colocated spec `src/export/export-dump-refetch-slice.spec.ts` 로 작성.

## Out of Scope

- 실 HTTP 206 Partial Content 응답 / Range 재요청 헤더 파싱 / `res.write` 재전송 배선 — 후속 controller task. 본 helper 는 재요청 대상 chunk subset 배열만 반환.
- `ExportChunkIntegrityReconcile` 의 산정 자체(`chunkIntegrity` boolean[] → `failedChunks`/`refetchRanges` derive) — [reconcileExportChunkIntegrity](../../src/export/export-chunk-integrity-reconcile.ts)(T-0472) 별도 helper. 본 task 는 그 산출물을 소비만(재산정 0 — single-source).
- 실 chunk digest / checksum 계산 / 무결성 검사 자체 — 본 task 는 이미 검사된 reconcile 결과만 입력으로 받는다.
- `MaterializedExportDumpChunk[]` 의 산정 자체(dump+plan → byte slice) — [sliceMaterializedDumpByChunkPlan](../../src/export/export-dump-chunk-slice.ts)(T-0507) 별도 helper. 본 task 는 그 산출물에서 subset 만 선택.
- (iii) resume(연속 forward) 측 materialized subset 선택 — [selectRemainingMaterializedDumpChunks](../../src/export/export-dump-resume-slice.ts)(T-0511) 별도 helper. 본 task 는 (iv) refetch(비연속 손상)만, (iii) resume 0.
- refetch subset 의 Readable 화(`Readable.from`) / Content-Range 헤더 직렬화 — 각각 후속 / [serializeExportDownloadHeaders](../../src/export/export-download-headers.ts)(T-0510) 별도 helper. 본 task 는 byte subset 만, stream·헤더 0.
- DB / repository / Prisma query streaming / persistence 배선 — 후속 task(ADR-0046 §Out of scope).
- 새 외부 dependency — 도입 시 §5 BLOCKED. 본 task 는 순수 배열 필터·Buffer 복사만.
- `STATE.json` / journal / counter 변경 — driver 책임.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 추가)
