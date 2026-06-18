---
id: T-0509
title: ADR-0046 Decision §1 chunked-Readable 실행 layer — ExportDump + ExportChunkPlan 을 받아 sliced byte 를 chunk 경계대로 push 하는 Node Readable 을 만드는 순수 factory createChunkedExportDumpReadable 신설
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 240
estimatedFiles: 2
created: 2026-06-18
independentStream: uc07-export-import-helpers
dependsOn: []
touchesFiles:
  - src/export/export-dump-chunk-readable.ts
  - src/export/export-dump-chunk-readable.spec.ts
hqOrigin: null
plannerNote: "P7 ADR-0046 §Decision 1 'materialization=byte slice 를 Readable 에 push' 실행 layer. T-0506 단일-Readable + T-0507 in-memory Buffer[] 의 다음 단계 — chunk 경계대로 push 하는 Readable factory. 순수 helper+spec, dep 0, dependsOn []."
---

# T-0509 — ExportDump + ExportChunkPlan 을 받아 sliced byte 를 chunk 경계대로 push 하는 Node Readable 을 만드는 순수 factory createChunkedExportDumpReadable

## Why

머지된 [ADR-0046](../decisions/ADR-0046-export-dump-materialization-storage.md)(b718bb8) Decision §1 은 다음을 명시 박제했다: "[buildExportChunkPlan](../../src/export/export-chunk-plan.ts) 이 `totalBytes`/`chunkSizeBytes` 로부터 각 chunk 의 `offsetBytes`/`sizeBytes` 를 산정하면, **materialization 은 직렬화된 byte 를 그 경계대로 slice 해 Readable 에 `push` 한다** (helper 가 '어디서부터 몇 byte' 를, materialization 이 '실제 byte slice' 를 책임 — 책임 분리)". 직전 chain step 두 개는 그 piece 의 절반씩만 박제했다 — [materializeExportDump](../../src/export/export-dump-materialize.ts)(T-0506, 08a010f) 은 envelope 전체를 한 번에 `JSON.stringify` 해 **단일** `Readable.from(serialized)` 로 만들고(chunk 경계 0), [sliceMaterializedDumpByChunkPlan](../../src/export/export-dump-chunk-slice.ts)(T-0507, 885bc22) 은 직렬화 byte 를 chunk 경계대로 자른 **in-memory `Buffer[]`** 만 반환한다(Readable push 0). 즉 두 helper 가 **각자 절반** 만 한다 — T-0506 은 stream 이나 chunk 0, T-0507 은 chunk 이나 stream 0.

ADR-0046 §Decision 1 이 envision 한 "chunk 경계대로 push 하는 Readable" 자체를 produce 하는 helper 는 `git grep -E "createChunkedExportDumpReadable|chunkedExportReadable|chunkPlanToReadable|streamExportDumpChunks" src/` → 0 매칭으로 미박제다(33+ export helper 어디에도 없음 — main 미박제 확인). T-0506 의 §Out of Scope 첫 항목("chunk 단위 streaming 직렬화") + T-0507 의 §Out of Scope 첫 항목("실 Readable stream 으로 chunk 별 push") 가 정확히 본 piece 를 deferred 했다. 본 task 는 그 deferred piece 를 **순수 factory 함수 1 개** 로 닫는다 — `ExportDump` 와 `ExportChunkPlan` 을 입력으로 받아, T-0507 의 byte slice 결과를 `Readable.from(iterable)`(Node 표준 helper) 로 감싸 chunk 경계대로 buffer 를 차례로 push 하는 stream 을 반환하는 pure factory. controller/service/repository/HTTP pipe 배선은 후속 task 책임([UC-07 §5 step13 / §8 NFR](../use-cases/UC-07-export-import.md), REQ-030 다운로드 / REQ-032 raw 미저장).

## Required Reading

- `docs/decisions/ADR-0046-export-dump-materialization-storage.md` — 특히 Decision §1 "기존 chunk helper 와의 맞물림" 절 (i) ("materialization 은 직렬화된 byte 를 그 경계대로 slice 해 Readable 에 `push` 한다 — helper 가 '어디서부터 몇 byte' 를, materialization 이 '실제 byte slice' 를 책임") + Decision §3 invariant ("새 외부 dep 0", "descriptor single-source / 재계산 금지").
- `src/export/export-dump.ts` — `ExportDump` interface (입력 1, 새 타입 신설 금지 — import 재사용).
- `src/export/export-chunk-plan.ts` — `ExportChunkPlan` interface (입력 2, 새 타입 신설 금지 — import 재사용). 특히 `chunks[].offsetBytes` / `chunks[].sizeBytes` / `chunks[].last` / `chunkCount` 불변(L34~49).
- `src/export/export-dump-chunk-slice.ts` (T-0507, 885bc22) — `sliceMaterializedDumpByChunkPlan(dump, plan): MaterializedExportDumpChunk[]` 가 본 helper 가 의존할 byte slice layer. **본 task 의 구현은 그 함수를 호출해 결과 buffer 배열을 얻은 뒤 `Readable.from` 으로 push 하는 형태가 default**(직렬화·invariant 검증 재구현 0 — DRY). 한국어 `TypeError`/`RangeError` convention 도 그대로 전파.
- `src/export/export-dump-materialize.ts` (T-0506, 08a010f) — 단일-Readable factory 의 스타일 (`Readable.from` 사용 + isPlainObject 입력 방어 + 한국어 TypeError + non-mutating + `instanceof Readable` 통과) — 본 task 는 같은 convention 을 따른다.

## Acceptance Criteria

- [ ] `src/export/export-dump-chunk-readable.ts` 에 순수 factory `createChunkedExportDumpReadable(dump: ExportDump, plan: ExportChunkPlan): Readable` 를 신설한다. 반환 타입은 Node 내장 `stream` 의 `Readable` 그 자체(새 타입 신설 0). `ExportDump` 는 `./export-dump`, `ExportChunkPlan` 은 `./export-chunk-plan` 에서 import — 새 외부 dependency 0(Node 내장 `stream.Readable` 만). 구현은 `sliceMaterializedDumpByChunkPlan(dump, plan)`(T-0507) 을 호출해 chunk byte 를 얻은 뒤 `Readable.from(chunks.map(c => c.bytes))`(또는 동등한 iterable→Readable wrapping) 으로 감싸는 형태가 default — 직렬화·invariant 검증을 본 helper 가 재구현하지 않는다(DRY, ADR-0046 §Decision 3 재계산 금지).
- [ ] 입력 방어 분기는 T-0507 의 throw 를 그대로 전파한다: (a) `dump` 가 plain object 아님 → 한국어 `TypeError` 전파. (b) `plan` 이 plain object 아님 → 한국어 `TypeError` 전파. (c) `plan.chunks` 가 배열 아님 → 한국어 `TypeError` 전파. (d) 직렬화 byte length 가 `plan.totalBytes` 와 불일치 → 한국어 `RangeError` 전파. 본 factory 가 별도 wrap 하지 않으며, 호출측이 T-0507 의 원본 진단 메시지를 그대로 받는다(원본 message 유지 검증 test 의무).
- [ ] 반환 `Readable` 의 stream 동작은 다음을 강제한다: (a) `result instanceof Readable === true`. (b) `chunkCount === 0`(빈 envelope) 시에도 정상 — 즉시 `end` event 만 발생하는 빈 stream 반환(throw 0). (c) `chunkCount === 1` 시 단일 buffer push 후 end. (d) `chunkCount > 1` 시 `plan.chunks[i].offsetBytes` 오름차순으로 buffer 가 순서대로 push 됨(stream 으로 받은 chunk 들을 concat 하면 `Buffer.from(JSON.stringify(dump), "utf8")` 와 byte-동일).
- [ ] 입력 dump/plan 객체·중첩 구조를 변형하지 않는다(non-mutating — `Object.freeze(dump)` + `Object.freeze(plan)` + `Object.freeze(plan.chunks)` 로 호출해도 throw 0 + stream 결과 byte 정확). 동일 입력 2회 호출의 stream 산출 byte 가 동일(결정성 — `JSON.stringify` + T-0507 결정성에 위임).
- [ ] **Happy-path unit test 1+** — (a) [buildExportDump](../../src/export/export-dump.ts) 로 만든 실 envelope + [buildExportChunkPlan](../../src/export/export-chunk-plan.ts) 으로 산정한 plan(chunkSizeBytes 충분히 큼 → 단일 chunk) → stream 을 끝까지 read 한 결과가 `JSON.stringify(dump)` 의 UTF-8 byte 와 byte-동일. (b) 같은 envelope 를 작은 chunkSizeBytes 로 plan(다수 chunk) → stream chunk 들을 concat 하면 동일 byte. (c) 멀티바이트 한글 record 포함 envelope 도 정확(`Buffer.concat` 결과가 `Buffer.from(serialized, "utf8")` 와 byte-동일).
- [ ] **Error path unit test 1+** — (a) `dump` 비-object(null / 숫자 / 배열) → T-0507 의 `TypeError`(`sliceMaterializedDumpByChunkPlan: dump 는 ...`) 가 그대로 throw (메시지 원형 유지 검증). (b) `plan` 비-object → 동일 패턴 `TypeError`. (c) `plan.chunks` 비-배열 → `TypeError`. (d) 직렬화 byte length ≠ `plan.totalBytes`(stale plan 손조작) → `RangeError`(`직렬화 byte length(...)가 plan.totalBytes(...)와 일치하지 않습니다` 메시지 원형 유지). throw 는 factory 호출 시점에 즉시 발생 — Readable 을 받은 뒤 read 단계에서 발생하지 않음을 검증(eager 검증).
- [ ] **분기마다 test 분리 (branch coverage)** — (i) 입력 방어 분기(각 throw — dump/plan/chunks 비-object, totalBytes drift), (ii) `chunkCount === 0` 빈 envelope 분기(빈 stream → 즉시 end), (iii) `chunkCount === 1` 단일 chunk 분기(1개 buffer push), (iv) `chunkCount > 1` 다수 chunk 분기(N개 buffer 순서대로 push) 각 1+ test.
- [ ] **Negative cases 충분 cover** — (a) `dump=null` / (b) `plan=null` / (c) `plan.chunks=null` → 각 `TypeError`. (d) `plan.totalBytes` 가 직렬화 buffer 보다 작음 → `RangeError`. (e) `plan.totalBytes` 가 더 큼 → `RangeError`. (f) `chunkCount===0` 빈 plan → 정상 빈 stream(`instanceof Readable` 통과 + read 결과 빈 buffer). (g) **non-mutating** — `Object.freeze(dump)` + `Object.freeze(plan)` + `Object.freeze(plan.chunks)` 로 호출해도 throw 0 + stream byte 정확. (h) **결정성** — 동일 입력으로 2 회 factory 호출 → 두 stream 의 끝까지 read 한 byte 가 완전 동일. (i) **alias 0** — factory 가 produce 한 stream 의 buffer 를 mutate 해도(`buf[0] = 0xFF`) 다음 factory 호출이 만든 stream 의 buffer 가 영향받지 않음(T-0507 의 `Buffer.from(slice)` alias 0 정합 — stream 까지 그 invariant 가 보존되는지 검증). (j) **순서 보존** — `chunkCount > 1` 시 stream 으로 받은 chunk index 가 `0, 1, 2, ...` 오름차순임을 검증.
- [ ] **반환값이 Node 내장 `stream.Readable` instance** 인지(`result instanceof Readable === true`) 검증하는 test 1+ — 새 외부 stream lib(예: `Web Streams API`, `readable-stream` npm pkg) 의존 0 검증.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — colocated spec `src/export/export-dump-chunk-readable.spec.ts` 로 작성.

## Out of Scope

- 실 `Readable` 을 HTTP response 로 pipe / NestJS `StreamableFile` 래핑 / `res.write` 직접 호출 — 후속 controller task. 본 factory 는 in-process `Readable` instance 만 반환 (downstream controller 가 그 instance 를 `StreamableFile` 로 감싸거나 직접 pipe).
- HTTP `Content-Length` / `Content-Range` / `Content-Disposition` 헤더 직렬화 — 후속 task. 본 task 는 stream body 만, header 0.
- chunk 단위 **직렬화** (record 부분집합씩 stringify — 대량 dump 메모리 압박 완화) — 후속 task (ADR-0046 §Out of scope 의 "chunk 단위 직렬화 구현"). 본 task 는 전체 envelope 를 한 번에 직렬화한 byte 를 chunk 경계로 **자른** 결과만 push (T-0506 / T-0507 와 같은 직렬화 방식).
- chunk 무결성 (checksum / hash) — `export-chunk-integrity-reconcile.ts`(T-0472) 별도 helper. 본 task 와 책임 분리.
- chunk resume / refetch / Range 요청 처리 — `export-chunk-resume-plan.ts`(T-0471) / `export-chunk-refetch-*` 별도 helper.
- descriptor drift 검증 — `export-descriptor-drift-verify.ts`(T-0508) 별도 helper (본 task 는 stream produce 만, drift 판정 0).
- backpressure / pause / resume / flow-mode 세부 제어 — Node 내장 `Readable.from` 의 default 동작을 그대로 채택 (custom `_read` 구현 0). 향후 backpressure tuning 필요 시 별도 task.
- DB / repository / Prisma query / persistence 배선 — 후속 task (ADR-0046 §Out of scope). 본 task 는 메모리에 있는 envelope + plan 만 입력.
- REST controller 배선 (`GET /api/admin/export` chunked streaming 응답) — 후속 task.
- 새 외부 dependency / 압축 lib (gzip / archiver / web-streams-polyfill) — 도입 시 §5 BLOCKED. 본 task 는 Node 내장 `stream.Readable` 만.
- `STATE.json` / journal / counter 변경 — driver 책임.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 추가)
