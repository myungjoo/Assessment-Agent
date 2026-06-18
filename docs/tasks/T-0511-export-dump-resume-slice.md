---
id: T-0511
title: ADR-0046 §Decision 1 맞물림 (iii) resume materialization — MaterializedExportDumpChunk[] 를 ExportChunkResumePlan 의 remainingChunks 경계로 필터해 재전송 대상 chunk subset 만 반환하는 순수 helper selectRemainingMaterializedDumpChunks 신설
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
  - src/export/export-dump-resume-slice.ts
  - src/export/export-dump-resume-slice.spec.ts
hqOrigin: null
plannerNote: "P7 ADR-0046 §Decision 1 맞물림 (iii) 'resumeFromByte/remainingChunks 가 재개 시 materialization 시작 offset 을 지시' 의 materialization-side piece. 순수 helper+spec, dep 0, dependsOn []."
---

# T-0511 — MaterializedExportDumpChunk[] 를 ExportChunkResumePlan 의 remainingChunks 경계로 필터해 재전송 대상 chunk subset 만 반환하는 순수 helper selectRemainingMaterializedDumpChunks

## Why

머지된 [ADR-0046](../decisions/ADR-0046-export-dump-materialization-storage.md)(b718bb8, origin/main 60766ce) Decision §1 "기존 chunk helper 와의 맞물림" 절은 materialization 이 소비할 4 개 산정 helper 를 명시했다 — (i) chunk-plan offset/size → byte slice, (ii) currentRange → Content-Range 헤더, **(iii) `buildExportChunkResumePlan` 의 `resumeFromByte`/`remainingChunks` 가 재개 시 materialization 의 시작 offset 을 지시한다**, (iv) refetchRanges → 손상 chunk 재요청 re-slice.

직전 chain step 들은 (i)·(ii) 를 닫았다 — [sliceMaterializedDumpByChunkPlan](../../src/export/export-dump-chunk-slice.ts)(T-0507, 885bc22) 은 전체 chunk 를 byte slice 하고, [createChunkedExportDumpReadable](../../src/export/export-dump-chunk-readable.ts)(T-0509, ed56a49) 은 전체 chunk 의 Readable 을 만들며, [serializeExportDownloadHeaders](../../src/export/export-download-headers.ts)(T-0510, 60766ce) 는 (ii) Content-Range 헤더를 직렬화한다. 그러나 (iii) **resume materialization** — 전송이 중단됐다가 재개될 때 이미 ack 된 chunk 는 빼고 **`remainingChunks` 만** 다시 materialize 해 재전송하는 piece — 는 비어 있다. `git grep -E "selectRemainingMaterializedDumpChunks|RemainingMaterialized|sliceResumed|resumeMaterialized|filterChunksByResume" src/export/` → origin/main 0 매칭 (resume/refetch 기반 materialized chunk subset helper 미박제 확인).

[buildExportChunkResumePlan](../../src/export/export-chunk-resume-plan.ts)(T-0471) 은 `ExportChunkResumePlan{resumeNeeded, acknowledgedChunks, remainingChunks: ExportChunk[], remainingChunkCount, resumeFromByte, ...}` 으로 **재개 지시 (어느 chunk 부터 다시 보낼지)** 를 순수 산술로 derive 하지만, 그것은 chunk 경계 메타 (`ExportChunk{index, offsetBytes, sizeBytes, last}`) 만 들고 있고 **실 byte (`bytes: Buffer`) 는 없다**. 반대로 `sliceMaterializedDumpByChunkPlan` 산출 `MaterializedExportDumpChunk[]` 은 실 byte 를 들고 있지만 전체 chunk 다. 그 둘을 잇는 책임자 — "이미 materialize 된 전체 chunk 배열에서 resume plan 이 지목한 remaining chunk 들만 골라낸다" — 가 없다.

본 task 는 그 (iii) deferred piece 를 **순수 helper 함수 1 개** 로 닫는다 — 이미 materialize 된 `MaterializedExportDumpChunk[]` 와 `ExportChunkResumePlan` 을 받아, resume plan 의 `remainingChunks` 가 지목한 index 의 materialized chunk subset 만 (원래 byte 보존하며) 반환한다. resume plan 재산정 0 (T-0471 산출값만 소비 — single-source), 실 byte slice 재계산 0 (T-0507 산출 chunk 의 `bytes` 그대로). controller/service/HTTP 206 Partial Content / Range 요청 파싱은 후속 task 책임 (ADR-0046 §Out of scope, [UC-07 §8 NFR](../use-cases/UC-07-export-import.md) resumable streaming, REQ-030 다운로드 / REQ-032 raw 미저장).

## Required Reading

- `docs/decisions/ADR-0046-export-dump-materialization-storage.md` — 특히 Decision §1 "기존 chunk helper 와의 맞물림" 절 (iii) ("buildExportChunkResumePlan 의 resumeFromByte/remainingChunks 가 재개 시 materialization 의 시작 offset 을 지시한다") + Decision §3 invariant ("chunk helper 가 산정한 byte 경계를 입력으로 받아 slice 만 한다 — helper 의 산정 로직을 controller/service 가 재구현하지 않는다 / 새 외부 dep 0").
- `src/export/export-dump-chunk-slice.ts` (T-0507, 885bc22) — `MaterializedExportDumpChunk` interface(`index`/`offsetBytes`/`sizeBytes`/`last`/`bytes: Buffer`, L29~35) + `sliceMaterializedDumpByChunkPlan` 순수-helper 스타일(`isPlainObject`/`describeNonObject` 입력 방어 + 한국어 `TypeError`/`RangeError` + non-mutating + `Buffer.from(slice)` alias 0 + 결정성). 본 helper 의 필수 입력 1 타입 — import 재사용(`./export-dump-chunk-slice`), 새 타입 신설 금지. 같은 convention 을 mirror.
- `src/export/export-chunk-resume-plan.ts` (T-0471) — `ExportChunkResumePlan` interface(`resumeNeeded`/`acknowledgedChunks`/`acknowledgedBytes`/`resumeFromByte`/`remainingChunks: ExportChunk[]`/`remainingChunkCount`/`remainingBytes`/`resumeRange`/`headline`) + 그 불변(특히 `remainingChunks.length === remainingChunkCount`, `resumeNeeded ⟺ remainingChunkCount > 0`, `acknowledgedChunks + remainingChunkCount === chunkCount`). 본 helper 의 필수 입력 2 타입 — import 재사용(`./export-chunk-resume-plan`), 새 타입 신설 금지.
- `src/export/export-chunk-plan.ts` — `ExportChunk` interface(`index`/`offsetBytes`/`sizeBytes`/`last`, L27~32). `remainingChunks` element 타입. 본 helper 가 index/offset 정합 검증에 참조.

## Acceptance Criteria

- [ ] `src/export/export-dump-resume-slice.ts` 에 순수 helper `selectRemainingMaterializedDumpChunks(materializedChunks: MaterializedExportDumpChunk[], resumePlan: ExportChunkResumePlan): MaterializedExportDumpChunk[]` 를 신설한다. `MaterializedExportDumpChunk` 는 `./export-dump-chunk-slice`, `ExportChunkResumePlan` 은 `./export-chunk-resume-plan` 에서 import — 새 도메인 타입 신설 0, 새 외부 dependency 0(Node 내장만). 반환은 항상 새 배열(입력 배열 alias 0).
- [ ] 선택 규칙(resume plan single-source — ADR-0046 §Decision 3): `resumePlan.remainingChunks` 가 지목한 각 chunk 의 `index` 에 해당하는 `materializedChunks` element 만 골라 **원래 입력 순서(index 오름차순)** 로 반환한다. `resumePlan.remainingChunks` 의 chunk 경계 메타(`index`/`offsetBytes`/`sizeBytes`/`last`)는 그에 대응하는 `materializedChunks` element 의 메타와 일치해야 하며(single-source 정합 검증), 불일치 시 `RangeError`(아래 입력 방어 (f)). resume plan 의 chunk 경계를 본 helper 가 재계산하지 않는다.
- [ ] `resumeNeeded` 분기: (a) `resumePlan.resumeNeeded === false`(전부 ack — `remainingChunkCount === 0`, `remainingChunks === []`)이면 빈 배열 `[]` 반환(재전송할 chunk 0 — 정상, throw 0). (b) `resumeNeeded === true`이면 `remainingChunks` 에 대응하는 materialized subset 반환(`length === remainingChunkCount`).
- [ ] 반환 chunk 의 `bytes` 는 입력 `materializedChunks` element 의 `bytes` Buffer 를 **독립 복사본(`Buffer.from(...)`)** 으로 담는다(alias 0 — 반환 chunk 의 bytes 를 mutate 해도 입력/후속 호출 영향 0). 메타(`index`/`offsetBytes`/`sizeBytes`/`last`)는 그대로 복사.
- [ ] 입력 방어 분기(한국어 `TypeError`/`RangeError`, T-0507·T-0471 convention 정합): (a) `materializedChunks` 가 배열 아님(null/undefined/object/원시값) → 한국어 `TypeError`(받은 type label 박제). (b) `resumePlan` 이 plain object 아님(null/배열/원시값) → 한국어 `TypeError`. (c) `resumePlan.remainingChunks` 가 배열 아님 → 한국어 `TypeError`. (d) `resumePlan.remainingChunkCount` 가 `remainingChunks.length` 와 불일치 → 한국어 `RangeError`(resume plan 불변 위반). (e) `remainingChunks` 의 어떤 chunk `index` 에 대응하는 element 가 `materializedChunks` 에 없음(index 범위 밖 / 중복 / 누락) → 한국어 `RangeError`(받은 index 박제). (f) 대응 materialized element 의 경계 메타(`offsetBytes`/`sizeBytes`/`last`/`index`)가 resume plan chunk 메타와 불일치 → 한국어 `RangeError`(불일치 필드·값 박제 — single-source drift 거부). (g) `materializedChunks` 의 어떤 element 가 `MaterializedExportDumpChunk` shape 위반(plain object 아님 / `bytes` 가 Buffer 아님 등) 으로 접근 불가 → 한국어 `TypeError`.
- [ ] 입력 `materializedChunks`/`resumePlan` 객체·중첩 구조를 변형하지 않는다(non-mutating — `Object.freeze(resumePlan)` + 각 chunk `Object.freeze` 로 호출해도 throw 0 + 결과 정확). 동일 입력 2회 호출 결과가 동등(결정성). 반환 배열·element 는 항상 새 객체(입력 alias 0).
- [ ] **Happy-path unit test 1+** — (a) [sliceMaterializedDumpByChunkPlan](../../src/export/export-dump-chunk-slice.ts)(실 dump+plan)로 만든 `MaterializedExportDumpChunk[]` + [buildExportChunkResumePlan](../../src/export/export-chunk-resume-plan.ts)(같은 plan, 일부 `acknowledgedChunks`)로 만든 `resumePlan`(resumeNeeded=true) 전달 → 반환 subset 의 `length === remainingChunkCount`, 각 element 의 `index`/`offsetBytes`/`sizeBytes`/`bytes` 가 원본 materialized chunk 와 정확히 일치, 순서가 index 오름차순. (b) 반환 subset 의 모든 `bytes` 를 concat 하면 원본 직렬화 buffer 의 `resumeFromByte..` 잔여 부분과 byte-동일(맞물림 invariant — resume 합 === 잔여 byte).
- [ ] **Error path unit test 1+** — (a) `materializedChunks` 비-배열(null/object) → 한국어 `TypeError`. (b) `resumePlan` 비-object → `TypeError`. (c) `resumePlan.remainingChunks` 비-배열 → `TypeError`. (d) `remainingChunkCount` 가 `remainingChunks.length` 와 불일치 → `RangeError`. (e) `remainingChunks` 에 materialized 에 없는 index → `RangeError`. (f) 경계 메타 drift(예: resume chunk `sizeBytes` 가 materialized 와 다름) → `RangeError`.
- [ ] **분기마다 test 분리 (branch coverage)** — (i) 각 입력 방어 throw 분기, (ii) `resumeNeeded === false`(빈 배열 반환) 분기, (iii) `resumeNeeded === true` 단일 remaining chunk 분기, (iv) `resumeNeeded === true` 다수 remaining chunk 분기, (v) `acknowledgedChunks === 0`(전부 remaining — 전체 반환) 경계 분기 각 1+ test.
- [ ] **Negative cases 충분 cover** — (a) `materializedChunks=null` / (b) `materializedChunks={}`(비-배열 object) / (c) `resumePlan=null` / (d) `resumePlan=배열` / (e) `resumePlan.remainingChunks=null` / (f) `remainingChunkCount`≠`remainingChunks.length` / (g) `remainingChunks` index 가 materialized 범위 밖(예: index 99) / (h) 경계 메타 drift(`offsetBytes` 불일치) / (i) materialized element 의 `bytes` 가 Buffer 아님 → 각 throw. (j) **빈 dump**(materializedChunks=[], resumePlan.resumeNeeded=false) → 빈 배열 반환(throw 0). (k) **non-mutating** — `Object.freeze(resumePlan)` + materialized chunk `Object.freeze` 호출해도 throw 0 + 결과 정확. (l) **결정성** — 동일 입력 2회 호출 결과 완전 동일. (m) **alias 0** — 반환 chunk 의 `bytes` 를 mutate 해도 입력 materialized chunk·다음 호출 결과 영향 0.
- [ ] **맞물림 invariant** test 1+ — `acknowledgedChunks=0`(전부 remaining)일 때 반환 subset 이 입력 `materializedChunks` 와 chunk 개수·각 byte 동일(전체 = remaining 의 특수 경우)임을 검증. `acknowledgedChunks === chunkCount`(전부 ack, resumeNeeded=false)일 때 빈 배열임을 검증.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — colocated spec `src/export/export-dump-resume-slice.spec.ts` 로 작성.

## Out of Scope

- 실 HTTP 206 Partial Content 응답 / Range 요청 헤더 파싱 / `res.write` 재전송 배선 — 후속 controller task. 본 helper 는 재전송 대상 chunk subset 배열만 반환.
- `ExportChunkResumePlan` 의 산정 자체(`acknowledgedChunks` → `remainingChunks` derive) — [buildExportChunkResumePlan](../../src/export/export-chunk-resume-plan.ts)(T-0471) 별도 helper. 본 task 는 그 산출물을 소비만(재산정 0 — single-source).
- `MaterializedExportDumpChunk[]` 의 산정 자체(dump+plan → byte slice) — [sliceMaterializedDumpByChunkPlan](../../src/export/export-dump-chunk-slice.ts)(T-0507) 별도 helper. 본 task 는 그 산출물에서 subset 만 선택.
- resume subset 의 Readable 화(`Readable.from`) — 필요 시 후속 task(T-0509 의 resume 변형). 본 task 는 Buffer chunk 배열만, stream 0.
- Content-Range 헤더 직렬화 — [serializeExportDownloadHeaders](../../src/export/export-download-headers.ts)(T-0510) 별도 helper. 본 task 는 byte subset 만, 헤더 0.
- (iv) refetch/integrity 기반 손상 chunk re-slice — 별도 후속 helper(`reconcileExportChunkIntegrity` 의 `refetchRanges` 소비). 본 task 는 (iii) resume 만, (iv) refetch 0.
- DB / repository / Prisma query streaming / persistence 배선 — 후속 task(ADR-0046 §Out of scope).
- 새 외부 dependency — 도입 시 §5 BLOCKED. 본 task 는 순수 배열 필터·Buffer 복사만.
- `STATE.json` / journal / counter 변경 — driver 책임.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 추가)
