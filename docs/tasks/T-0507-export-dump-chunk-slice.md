---
id: T-0507
title: ADR-0046 Decision §1 맞물림 (i) — materializeExportDump 의 직렬화 byte 를 ExportChunkPlan 경계대로 slice 하는 순수 함수 sliceMaterializedDumpByChunkPlan 신설
phase: P7
status: DONE
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 240
estimatedFiles: 2
created: 2026-06-18
independentStream: uc07-export-import-helpers
dependsOn: []
touchesFiles:
  - src/export/export-dump-chunk-slice.ts
  - src/export/export-dump-chunk-slice.spec.ts
hqOrigin: null
plannerNote: "P7 ADR-0046 Decision §1 맞물림 (i) — buildExportChunkPlan 경계 + materializeExportDump 직렬화 layer 사이의 byte slice piece. T-0506 의 §Out of scope 항목 1 closure. 순수 helper+spec, dep 0, dependsOn []."
---

# T-0507 — materializeExportDump 의 직렬화 byte 를 ExportChunkPlan 경계대로 slice 하는 순수 함수 sliceMaterializedDumpByChunkPlan

## Why

머지된 [ADR-0046](../decisions/ADR-0046-export-dump-materialization-storage.md)(b718bb8) Decision §1 의 "기존 chunk helper 와의 맞물림" 절 (i) 은 다음을 박제했다: "[buildExportChunkPlan](../../src/export/export-chunk-plan.ts) 이 `totalBytes`/`chunkSizeBytes` 로부터 각 chunk 의 `offsetBytes`/`sizeBytes` 를 산정하면, materialization 은 직렬화된 byte 를 그 경계대로 slice 해 Readable 에 push 한다 (helper 가 '어디서부터 몇 byte' 를, materialization 이 '실제 byte slice' 를 책임 — 책임 분리)". 직전 T-0506 ([08a010f](../../src/export/export-dump-materialize.ts)) 은 전체 envelope 를 한 번에 `JSON.stringify` 해 단일 `Readable` 로 만드는 piece 만 박제했고, 그 §Out of Scope 가 "chunk byte slice / Content-Range 헤더 직렬화 — `export-chunk-*` helper 가 산정한 경계를 소비하는 별도 후속 task" 로 명시 deferred 했다. 본 task 는 그 deferred piece 를 **순수 함수 1개** 로 닫는다 — `ExportDump` 와 `ExportChunkPlan` 을 입력으로 받아 직렬화된 byte 를 chunk 경계대로 잘라 `Buffer` 배열로 반환하는 pure helper. DB / repository / controller / stream pipe 배선은 후속 task 책임([UC-07 §5 step13 / §8 NFR](../use-cases/UC-07-export-import.md) chunked streaming, REQ-030 다운로드 / REQ-032 raw 미저장).

## Required Reading

- `docs/decisions/ADR-0046-export-dump-materialization-storage.md` — 특히 Decision §1 "맞물림" 절 (i) (helper = 산정 layer / materialization = slice 실행 layer 책임 분리) + Decision §3 invariant (새 dep 0 / descriptor single-source / chunk helper 산정값만 소비 — 재계산 금지).
- `src/export/export-dump.ts` — `ExportDump` interface (입력 1, 새 타입 신설 금지 — import 재사용).
- `src/export/export-dump-materialize.ts` (08a010f T-0506) — 직렬화 방식 정합 source (`JSON.stringify(dump)`).
- `src/export/export-chunk-plan.ts` — `ExportChunkPlan` / `ExportChunk` interface (입력 2, 새 타입 신설 금지 — import 재사용). 특히 `chunks[].offsetBytes` / `chunks[].sizeBytes` / `chunks[].last` 의 불변(연속·gap 0·overlap 0, sum === totalBytes) 박제 라인 (L34~49).
- `src/export/export-artifact-descriptor.ts` (L107~110 `estimateByteSize`) — `Buffer.byteLength(JSON.stringify(dump), "utf8")` 으로 size 산정 방식. 본 task 는 같은 직렬화 방식으로 produce 한 byte length 가 `plan.totalBytes` 와 일치함을 invariant 로 강제(drift 0 — ADR-0046 §Decision 3 "descriptor single-source").

## Acceptance Criteria

- [ ] `src/export/export-dump-chunk-slice.ts` 에 순수 함수 `sliceMaterializedDumpByChunkPlan(dump: ExportDump, plan: ExportChunkPlan): MaterializedExportDumpChunk[]` 를 신설한다. 반환 element 타입은 `{ index: number; offsetBytes: number; sizeBytes: number; last: boolean; bytes: Buffer }` 한 종류 (`MaterializedExportDumpChunk` 로 export). `ExportDump` 는 `./export-dump`, `ExportChunkPlan`/`ExportChunk` 는 `./export-chunk-plan` 에서 import — 새 타입 신설 0, 새 외부 dependency 0(Node 내장 `Buffer` 만).
- [ ] 구현은 다음을 강제한다: (a) `JSON.stringify(dump)` 으로 1회 직렬화 후 `Buffer.from(serialized, "utf8")` 로 buffer 화 (T-0506 의 `materializeExportDump` 와 정확히 같은 직렬화 방식), (b) `Buffer.byteLength(serialized, "utf8") === plan.totalBytes` invariant 검증 — 불일치 시 한국어 message 의 `RangeError` throw (ADR-0046 §Decision 3 descriptor single-source 강제), (c) `plan.chunks` 를 순회하며 `buffer.subarray(chunk.offsetBytes, chunk.offsetBytes + chunk.sizeBytes)` 로 slice 후 새 `Buffer.from(slice)` 로 복사한 byte 를 결과 element 에 담음 (입력 buffer 와 alias 0 — 호출측이 결과를 mutate 해도 원본 직렬화 buffer 가 변형되지 않음).
- [ ] 반환 배열의 길이는 `plan.chunkCount` 와 일치하며, 각 element 의 `index`/`offsetBytes`/`sizeBytes`/`last` 는 `plan.chunks[i]` 의 동명 필드와 동일하다. `chunkCount === 0` (totalBytes 0) 일 때 빈 envelope 도 정상 — 반환 `[]`.
- [ ] **Happy-path unit test 1+** — (a) scope=full + records 비어있지 않은 envelope 를 chunkSizeBytes=충분히 큰 값으로 plan → 단일 chunk, sliced bytes === 직렬화 buffer 전체 검증. (b) 동일 envelope 를 작은 chunkSizeBytes 로 plan → 다수 chunk, 모든 chunk bytes 를 concat 하면 원본 직렬화 buffer 와 byte-동일 검증. (c) 멀티바이트 한글 record 포함 envelope 도 정확 slice (byte 경계가 UTF-8 코드포인트 중간을 자를 수 있으나 본 함수의 책임은 byte 정확성 — 문자열 의미 유지가 아님; concat 했을 때 원본과 동일이면 통과).
- [ ] **Error path unit test 1+** — (a) `dump` 가 plain object 가 아닐 때 (null / undefined / 숫자 / 문자열 / 배열) `TypeError`(한국어 message, `sliceMaterializedDumpByChunkPlan: dump 는 ...` 형태) throw. (b) `plan` 이 plain object 가 아닐 때 `TypeError`. (c) 직렬화된 buffer length 가 `plan.totalBytes` 와 불일치할 때 (예: plan 을 손으로 조작한 stale plan) `RangeError`(한국어 message) throw.
- [ ] **분기마다 test 분리 (branch coverage)** — (i) 입력 방어 분기 (dump/plan 비-object → throw), (ii) totalBytes 불일치 분기 (drift → throw), (iii) chunkCount === 0 정상 분기 (빈 배열 반환), (iv) chunkCount === 1 정상 분기 (단일 chunk full), (v) chunkCount > 1 정상 분기 (다수 chunk + 마지막 잔여) 각 1+ test.
- [ ] **Negative cases 충분 cover** — (a) `dump=null`, (b) `plan=null`, (c) `plan.chunks=null` (plan shape 위반 — `TypeError`), (d) `plan.totalBytes` 가 직렬화 buffer 보다 작음 (drift `RangeError`), (e) `plan.totalBytes` 가 직렬화 buffer 보다 큼 (drift `RangeError`), (f) `chunkCount===0` 빈 plan → `[]` 정상, (g) `chunkCount===1` 단일 chunk plan → 1-원소 배열, (h) **non-mutating** — `Object.freeze(dump)` + `Object.freeze(plan)` + `Object.freeze(plan.chunks)` 로 호출해도 throw 0 + 결과 정확, (i) **결정성** — 동일 입력 2 회 호출의 결과가 모든 element 의 byte 까지 동일, (j) **alias 0** — 반환된 `bytes` Buffer 를 mutate 해도 원본 직렬화 buffer / 후속 호출의 결과가 영향받지 않음.
- [ ] 반환 element 의 `bytes` 가 `Buffer` instance 임을(`result[i].bytes instanceof Buffer`) 검증하는 test 1+ — Node 내장 `Buffer` 만 사용 (Uint8Array · ArrayBuffer 직접 노출 0).
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — colocated spec `src/export/export-dump-chunk-slice.spec.ts` 로 작성.

## Out of Scope

- 실 `Readable` stream 으로 chunk 별 push / pipe — 후속 task. 본 함수는 in-memory `Buffer` 배열만 반환 (downstream controller / streaming pipe 가 본 결과를 `Readable` 에 push 하거나 HTTP Content-Range 응답으로 직렬화).
- HTTP `Content-Range` 헤더 문자열 직렬화 — 후속 task ([describeExportChunkStreamProgress](../../src/export/export-chunk-stream-progress.ts) 의 `currentRange` 산정값을 헤더 문자열로 만드는 piece, ADR-0046 §Decision 1 맞물림 (ii)). 본 task 는 byte slice 만.
- chunk 단위 streaming 직렬화 (record 부분집합씩 stringify — 메모리 압박 완화) — 후속 task (ADR-0046 §Out of scope). 본 함수는 전체 envelope 를 한 번에 `JSON.stringify` 후 byte 단위 slice 만.
- DB / repository / Prisma query / persistence 배선 — 후속 task (ADR-0046 §Out of scope). 본 task 는 이미 메모리에 있는 `ExportDump` + `ExportChunkPlan` 만 입력으로 받는다.
- REST controller 배선 (`GET /api/admin/export` chunked streaming 응답) — 후속 task.
- chunk 무결성 (checksum / hash) 산정 — `export-chunk-integrity-reconcile.ts` (T-0472) 가 별도 helper. 본 task 와 책임 분리.
- 새 외부 dependency / 압축 lib (gzip / archiver) — 도입 시 §5 BLOCKED. 본 task 는 Node 내장 `Buffer` 만.
- `STATE.json` / journal / counter 변경 — driver 책임.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 추가)
