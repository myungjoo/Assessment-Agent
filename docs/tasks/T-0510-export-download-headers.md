---
id: T-0510
title: ADR-0046 §Decision 1·3 다운로드 헤더 직렬화 layer — ExportArtifactDescriptor(+선택 ExportChunkContentRange)를 HTTP 응답 헤더 문자열 map 으로 직렬화하는 순수 helper serializeExportDownloadHeaders 신설
phase: P7
status: DONE
completedAt: 2026-06-18T18:12:00Z
mergedAs: 60766ce
prNumber: 423
reviewRounds: 1
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 240
estimatedFiles: 2
created: 2026-06-19
independentStream: uc07-export-import-helpers
dependsOn: []
touchesFiles:
  - src/export/export-download-headers.ts
  - src/export/export-download-headers.spec.ts
hqOrigin: null
plannerNote: "P7 ADR-0046 §Decision 1 'helper=수치, materialization=헤더 문자열 생성' + §Decision 3 'descriptor single-source' 의 헤더 직렬화 piece. 순수 helper+spec, dep 0, dependsOn []."
---

# T-0510 — ExportArtifactDescriptor(+선택 ExportChunkContentRange)를 HTTP 응답 헤더 문자열 map 으로 직렬화하는 순수 helper serializeExportDownloadHeaders

## Why

머지된 [ADR-0046](../decisions/ADR-0046-export-dump-materialization-storage.md)(b718bb8) Decision §1 은 두 가지 헤더 직렬화 책임을 명시 박제했다: (1) "다운로드 응답 헤더 (`Content-Type` / `Content-Disposition` / `Content-Length`) 는 [buildExportArtifactDescriptor](../../src/export/export-artifact-descriptor.ts) 산출물 (`contentType` / `contentDisposition` / `byteSizeHint`) 을 그대로 직렬화한다 — descriptor 가 곧 materialization 의 메타 source", (2) "describeExportChunkStreamProgress 의 `currentRange` (content-range 수치) 를 materialization 이 `Content-Range: bytes {first}-{last}/{total}` 헤더로 직렬화한다 (**helper 가 수치를, materialization 이 헤더 문자열 생성을**)". 그리고 §Decision 3 invariant 는 "descriptor single-source — 다운로드 메타 (fileName / contentType / Content-Length / Content-Disposition) 는 buildExportArtifactDescriptor 산출물을 그대로 직렬화 — controller 가 헤더값을 새로 계산하지 않는다 (drift 0)" 를 강제한다.

직전 chain step 들은 byte body 측만 닫았다 — [materializeExportDump](../../src/export/export-dump-materialize.ts)(T-0506) 은 단일 Readable, [sliceMaterializedDumpByChunkPlan](../../src/export/export-dump-chunk-slice.ts)(T-0507) 은 chunk byte slice, [createChunkedExportDumpReadable](../../src/export/export-dump-chunk-readable.ts)(T-0509) 은 chunk 경계 Readable 을 만든다. 그러나 그 stream body 와 함께 응답에 실릴 **HTTP 헤더 문자열을 descriptor·content-range 수치로부터 직렬화하는 layer** 는 비어 있다 — `git grep -E "serializeExportDownloadHeaders|exportDownloadHeaders|buildExportResponseHeaders|Content-Range" src/` → 0 매칭(33+ export helper 어디에도 헤더 직렬화 없음, main 미박제 확인). `ExportArtifactDescriptor`(T-0457) 와 `ExportChunkContentRange`(T-0508-인접, `firstBytePos`/`lastBytePos`/`totalBytes`/`chunkIndex`) 는 **수치·메타** 만 들고 있고, 그것을 `Content-Range: bytes 0-1023/4096` 같은 **RFC 7233 헤더 문자열** 로 만드는 책임자가 아무도 없다.

본 task 는 그 deferred piece 를 **순수 helper 함수 1 개** 로 닫는다 — `ExportArtifactDescriptor`(필수) 와 `ExportChunkContentRange`(선택, partial/chunk 전송 시) 를 받아 HTTP 응답 헤더 key→value 문자열 map(`Record<string, string>`)을 직렬화한다. controller/service/HTTP `res.setHeader` 배선은 후속 task 책임([UC-07 §5 step13 / §8 NFR](../use-cases/UC-07-export-import.md), REQ-030 다운로드 / REQ-032 raw 미저장).

## Required Reading

- `docs/decisions/ADR-0046-export-dump-materialization-storage.md` — 특히 Decision §1 "헤더 직렬화" + "기존 chunk helper 와의 맞물림" 절 (ii) ("describeExportChunkStreamProgress 의 currentRange 를 materialization 이 `Content-Range: bytes {first}-{last}/{total}` 헤더로 직렬화한다 — helper 가 수치를, materialization 이 헤더 문자열 생성을") + Decision §3 invariant ("descriptor single-source / controller 가 헤더값을 새로 계산하지 않는다 / 새 외부 dep 0").
- `src/export/export-artifact-descriptor.ts` — `ExportArtifactDescriptor` interface(`fileName`/`contentType`/`byteSizeHint`/`contentDisposition`/`scopeToken`, L29~35). 본 helper 의 필수 입력 1. 새 타입 신설 금지 — import 재사용. 특히 `contentDisposition` 은 이미 `attachment; filename="<fileName>"` 형태로 조립돼 있으므로 본 helper 가 재조립하지 않고 그대로 헤더 값으로 직렬화(single-source — 재계산 금지).
- `src/export/export-chunk-stream-progress.ts` — `ExportChunkContentRange` interface(`firstBytePos`/`lastBytePos`/`totalBytes`/`chunkIndex`, L31~36). 본 helper 의 선택 입력 2. 새 타입 신설 금지 — import 재사용. `Content-Range: bytes {firstBytePos}-{lastBytePos}/{totalBytes}` 형식으로 직렬화(RFC 7233).
- `src/export/export-dump-materialize.ts` (T-0506, 08a010f) — 순수 helper 스타일(`isPlainObject` 입력 방어 + 한국어 `TypeError` + non-mutating + 결정성). 본 task 는 같은 convention 을 따른다.

## Acceptance Criteria

- [ ] `src/export/export-download-headers.ts` 에 순수 helper `serializeExportDownloadHeaders(descriptor: ExportArtifactDescriptor, contentRange?: ExportChunkContentRange | null): Record<string, string>` 를 신설한다. `ExportArtifactDescriptor` 는 `./export-artifact-descriptor`, `ExportChunkContentRange` 는 `./export-chunk-stream-progress` 에서 import — 새 도메인 타입 신설 0, 새 외부 dependency 0(순수 문자열 조립만). 반환은 항상 새 plain object(`Record<string, string>`).
- [ ] 직렬화 규칙(descriptor single-source — ADR-0046 §Decision 3): (a) `Content-Type` = `descriptor.contentType` 그대로. (b) `Content-Disposition` = `descriptor.contentDisposition` 그대로(재조립 0 — 이미 `attachment; filename="..."` 형태). (c) `Content-Length` = `String(descriptor.byteSizeHint)`(number → 문자열). 세 헤더는 descriptor 입력이 유효하면 항상 포함.
- [ ] `Content-Range` 직렬화(선택 입력): (a) `contentRange` 가 제공되면(non-null) `Content-Range: bytes {firstBytePos}-{lastBytePos}/{totalBytes}` 형식 문자열을 추가(RFC 7233, 예: `bytes 0-1023/4096`). (b) `contentRange` 가 `undefined`/`null`(생략 — full 다운로드) 이면 `Content-Range` 키를 넣지 않는다(전체 전송이라 partial-range 헤더 부재가 정상).
- [ ] 입력 방어 분기(한국어 `TypeError`/`RangeError`, T-0506·T-0457 convention 정합): (a) `descriptor` 가 plain object 아님(null/배열/원시값) → 한국어 `TypeError`(받은 type label 박제). (b) `descriptor.contentType`/`descriptor.contentDisposition` 가 문자열 아님 → 한국어 `TypeError`. (c) `descriptor.byteSizeHint` 가 비-음수 정수 아님(음수/소수/NaN/Infinity/비-number) → 한국어 `TypeError` 또는 `RangeError`(받은 값 박제). (d) `contentRange` 가 제공됐으나 plain object 아님 → 한국어 `TypeError`. (e) `contentRange.firstBytePos`/`lastBytePos`/`totalBytes` 가 비-음수 정수 아님, 또는 `firstBytePos > lastBytePos`, 또는 `lastBytePos >= totalBytes` → 한국어 `RangeError`(받은 값·불일치 박제 — RFC 7233 유효 range invariant).
- [ ] 입력 descriptor/contentRange 객체를 변형하지 않는다(non-mutating — `Object.freeze(descriptor)` + `Object.freeze(contentRange)` 로 호출해도 throw 0 + 결과 정확). 동일 입력 2회 호출의 헤더 map 이 동등(결정성). 반환 map 은 항상 새 객체(입력 객체 alias 0).
- [ ] **Happy-path unit test 1+** — (a) [buildExportArtifactDescriptor](../../src/export/export-artifact-descriptor.ts) 로 만든 실 descriptor + `contentRange` 생략 → `Content-Type`/`Content-Disposition`/`Content-Length` 3 헤더만 포함, `Content-Range` 부재, 값이 descriptor 와 정확히 일치. (b) 실 descriptor + [describeExportChunkStreamProgress](../../src/export/export-chunk-stream-progress.ts) 산출 `currentRange` 전달 → 위 3 헤더 + `Content-Range: bytes {first}-{last}/{total}` 정확한 문자열 포함.
- [ ] **Error path unit test 1+** — (a) `descriptor` 비-object(null/숫자/배열) → 한국어 `TypeError`. (b) `descriptor.contentType` 비-문자열 → `TypeError`. (c) `descriptor.byteSizeHint` 음수/소수 → `TypeError`/`RangeError`. (d) `contentRange` 비-object → `TypeError`. (e) `contentRange.firstBytePos > lastBytePos` → `RangeError`. (f) `contentRange.lastBytePos >= totalBytes` → `RangeError`.
- [ ] **분기마다 test 분리 (branch coverage)** — (i) 각 입력 방어 throw 분기, (ii) `contentRange` 제공 분기(`Content-Range` 포함), (iii) `contentRange` 생략 분기(`Content-Range` 부재), (iv) `contentRange === null` 명시 전달 분기(생략과 동일하게 부재) 각 1+ test.
- [ ] **Negative cases 충분 cover** — (a) `descriptor=null` / (b) `descriptor=배열` / (c) `descriptor.contentType=숫자` / (d) `descriptor.byteSizeHint=-1` / (e) `descriptor.byteSizeHint=1.5` / (f) `descriptor.byteSizeHint=NaN` → 각 throw. (g) `contentRange={firstBytePos: 100, lastBytePos: 50, ...}`(first > last) → `RangeError`. (h) `contentRange.lastBytePos === totalBytes`(경계 초과) → `RangeError`. (i) `contentRange.totalBytes=0` 인데 byte 가 있음 → `RangeError`. (j) **non-mutating** — `Object.freeze(descriptor)` + `Object.freeze(contentRange)` 호출해도 throw 0 + 헤더 정확. (k) **결정성** — 동일 입력 2회 호출 헤더 map 완전 동일. (l) **alias 0** — 반환 map 을 mutate 해도 다음 호출 결과 영향 0.
- [ ] **`Content-Range` 형식 정확성** test 1+ — `{firstBytePos:0, lastBytePos:1023, totalBytes:4096}` → `Content-Range` 값이 정확히 `"bytes 0-1023/4096"`(공백·하이픈·슬래시 위치 정확, RFC 7233 형식) 임을 문자열 동일 비교로 검증.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — colocated spec `src/export/export-download-headers.spec.ts` 로 작성.

## Out of Scope

- 실 HTTP `res.setHeader` 호출 / NestJS `@Header()` decorator / `StreamableFile` 옵션 배선 — 후속 controller task. 본 helper 는 헤더 key→value 문자열 map 만 반환(controller 가 그 map 을 응답에 set).
- 응답 body(`Readable` stream) 자체 — [createChunkedExportDumpReadable](../../src/export/export-dump-chunk-readable.ts)(T-0509) / [materializeExportDump](../../src/export/export-dump-materialize.ts)(T-0506) 별도 helper. 본 task 는 헤더만, body 0.
- `ExportArtifactDescriptor` / `ExportChunkContentRange` 의 산정 자체 — [buildExportArtifactDescriptor](../../src/export/export-artifact-descriptor.ts)(T-0457) / [describeExportChunkStreamProgress](../../src/export/export-chunk-stream-progress.ts) 별도 helper. 본 task 는 그 산출물을 헤더 문자열로 **직렬화** 만(재산정 0 — ADR-0046 §Decision 3 single-source).
- `Accept-Ranges` / `ETag` / 캐시 제어 헤더 / CORS 헤더 — 본 task 범위 밖(필요 시 후속 task). 본 helper 는 ADR-0046 §Decision 1 이 명시한 4 헤더(`Content-Type`/`Content-Disposition`/`Content-Length`/선택 `Content-Range`) 만.
- chunk 단위 직렬화 / checksum / resume / refetch — 별도 helper(`export-chunk-*`).
- descriptor drift 검증 — [export-descriptor-drift-verify.ts](../../src/export/export-descriptor-drift-verify.ts)(T-0508) 별도 helper. 본 task 는 헤더 직렬화만, drift 판정 0.
- DB / repository / Prisma query / persistence 배선 — 후속 task(ADR-0046 §Out of scope).
- REST controller 배선(`GET /api/admin/export`) — 후속 task.
- 새 외부 dependency — 도입 시 §5 BLOCKED. 본 task 는 순수 문자열 조립만.
- `STATE.json` / journal / counter 변경 — driver 책임.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 추가)
