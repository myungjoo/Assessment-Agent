---
id: T-0506
title: ADR-0046 Decision §1 materialization 첫 step — ExportDump envelope 를 Node 내장 stream.Readable 로 직렬화하는 순수 함수 materializeExportDump 신설
phase: P7
status: DONE
completedAt: 2026-06-18T16:17:00Z
resultSummary: "PR #419 round1 APPROVE+CI green → squash merge 08a010f. src/export/export-dump-materialize.ts(78 LOC) + spec(308 LOC) line/branch/function 100% cov, 17 tests pass, 전체 218 suites/5074 tests pass. 새 외부 dep 0, Node 내장 stream 만."
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 200
estimatedFiles: 2
created: 2026-06-19
independentStream: uc07-export-import-helpers
dependsOn: []
touchesFiles:
  - src/export/export-dump-materialize.ts
  - src/export/export-dump-materialize.spec.ts
hqOrigin: null
plannerNote: "P7 ADR-0046(b718bb8) Decision §1 — envelope→Node Readable in-process materialization 의 첫 dependency-free step. DB/controller/repo 배선 0, 순수 함수+unit test 만. dep 0(Node 내장 stream). pr·게이트-free·dependsOn []."
---

# T-0506 — ExportDump envelope 를 Node 내장 stream.Readable 로 직렬화하는 순수 함수 materializeExportDump

## Why

방금 머지된 [ADR-0046](../decisions/ADR-0046-export-dump-materialization-storage.md)(b718bb8) Decision §1 은 `ExportDump` envelope 를 **in-process 에서 Node.js 내장 `stream`/`Readable` 기반으로 materialize** 한다고 박제했다(`JSON.stringify(envelope)` 직렬화 → Node `Readable` 로 감싸 응답 본문으로 흘려보냄, 새 외부 dependency 0). 본 task 는 그 chain 의 **dependency-free 첫 구현 step** 으로, envelope 를 받아 직렬화 byte 를 담은 Node `stream.Readable` 을 반환하는 **순수 함수 1개** 를 신설한다. DB / repository / controller 배선은 후속 task 책임(ADR-0046 §Out of scope) — 본 step 은 순수 함수 + unit test 만으로 완결한다([UC-07 §5 step13 / §8 NFR](../use-cases/UC-07-export-import.md) materialization piece, REQ-030 다운로드 / REQ-032 raw 미저장).

## Required Reading

- `docs/decisions/ADR-0046-export-dump-materialization-storage.md` — 특히 Decision §1(materialization = in-process JSON 직렬화 → Node `Readable`) + Decision §3(후속 구현 invariant: 새 dep 0 / descriptor single-source / chunk helper 산정값만 소비).
- `src/export/export-dump.ts` — `ExportDump` interface(L44~51: schemaVersion / generatedAt / scope / entityCounts / recordCount / records) — 본 함수의 입력 타입(import 재사용, 새 타입 신설 금지).
- `src/export/export-artifact-descriptor.ts` — `estimateByteSize`(L107~110)의 `Buffer.byteLength(JSON.stringify(dump), "utf8")` 직렬화 방식 — descriptor 의 `byteSizeHint` 산정 방식과 materialization 의 직렬화 방식이 정합해야 한다(drift 0 — 둘 다 `JSON.stringify`).
- `src/export/export-dump-checksum.ts`(있다면 직렬화 방식 참고용) 및 `src/export/export-chunk-plan.ts` — chunk 경계가 byte slice 의 입력이 되는 layer 분리 이해용(본 task 는 chunk slice 구현 아님 — 전체 envelope 직렬화만).

## Acceptance Criteria

- [ ] `src/export/export-dump-materialize.ts` 에 순수 함수 `materializeExportDump(dump: ExportDump): Readable` 를 신설한다. Node.js 내장 `stream` 의 `Readable` 만 사용하며(`import { Readable } from "stream"` 또는 `node:stream`), `JSON.stringify(dump)` 결과(UTF-8)를 담은 `Readable`(예: `Readable.from(serialized)`)을 반환한다. 새 외부 dependency 0, 새 도메인 타입 신설 0(`ExportDump` 는 `./export-dump` 에서 import).
- [ ] 반환 stream 을 끝까지 읽어 concat 한 결과가 `JSON.stringify(dump)` 와 byte-동일함을 검증하는 happy-path unit test 1+ 추가(예: scope=full envelope, records 비어있지 않은 envelope, 멀티바이트 한글 포함 record 모두 정확 직렬화).
- [ ] **Error path test 1+** — `dump` 가 plain object 가 아닌 입력(null / undefined / 숫자 / 문자열 / 배열)에 대해 명시적 `TypeError`(한국어 message, 기존 helper convention `materializeExportDump: dump 는 ...` 형태) throw 검증. 직렬화 불가(순환 참조 등) 입력에 대한 동작도 1 case(throw 전파 또는 명시 error) 검증.
- [ ] **분기마다 test 분리(branch coverage)** — 입력 방어 분기(plain object 아님 → TypeError)와 정상 분기(직렬화 → Readable)를 각각 cover. 빈 records envelope(`recordCount: 0`, `records: []`)도 정상 직렬화되어 valid JSON stream 을 반환함을 별도 test 로 검증.
- [ ] **Negative cases 충분 cover** — (a) `dump=null`, (b) `dump=undefined`, (c) `dump=배열`, (d) `dump=원시값(숫자/문자열)`, (e) 빈 envelope(records []), (f) 멀티바이트(한글) record 포함, (g) non-mutating(입력 dump 객체를 변형하지 않음 — `Object.freeze(dump)` 로 호출해도 통과) 각 1+ test.
- [ ] 반환값이 `Readable` instance 임을(`result instanceof Readable`) 검증하는 test 1+.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — colocated spec `src/export/export-dump-materialize.spec.ts` 로 작성.

## Out of Scope

- DB / repository / Prisma query / persistence 배선 — 후속 task(ADR-0046 §Out of scope). 본 task 는 이미 메모리에 있는 `ExportDump` 만 입력으로 받는다.
- REST controller 배선(`GET /api/admin/export` streaming 응답 / NestJS `StreamableFile` 반환) — 후속 task.
- chunk 단위 직렬화(대량 dump 메모리 압박 완화 — record 부분집합씩 stringify) — 후속 task. 본 함수는 전체 envelope 를 한 번에 `JSON.stringify` 한다(ADR-0046 §Decision 1 "Node Readable stream" 전략만 박제, chunk 단위는 §Out of scope).
- chunk byte slice / Content-Range 헤더 직렬화 — `export-chunk-*` helper 가 산정한 경계를 소비하는 별도 후속 task(본 task 는 전체 직렬화만).
- 로컬 임시 dir / `fs` / `os.tmpdir()` 영속 저장(ADR-0046 §Decision 2 보조 옵션) — 후속 task. 본 task 는 영속 저장 0(응답 직접 streaming default) 의 in-memory 직렬화만.
- 새 외부 dependency / 압축 lib(gzip / archiver) — 도입 시 §5 BLOCKED. 본 task 는 Node 내장 `stream` 만.
- `STATE.json` / journal / counter 변경 — driver 책임.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 추가)
