---
id: T-1255
title: Import dump buffer 역직렬화 순수 helper 신설 (parse-only, DB·검증 0)
phase: P5
status: DONE
completedAt: 2026-07-27T07:05:00Z
mergedAs: 490205a9
prNumber: 1146
reviewRounds: 1
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 90
estimatedFiles: 2
created: 2026-07-27
independentStream: import-restore-engine
dependsOn: []
touchesFiles:
  - src/import/import-dump-deserialize.ts
  - src/import/import-dump-deserialize.spec.ts
plannerNote: P5 ADR-0055 §Follow-up(b) restore engine 첫 slice — buffer→object 역직렬화 순수 helper(validate/$transaction 미포함, 후속 slice)
---

# T-1255 — Import dump buffer 역직렬화 순수 helper 신설 (parse-only)

## Why

[ADR-0055](../decisions/ADR-0055-import-multipart-file-upload.md) §Follow-up (b) 의 "dump 파싱 → 실 복원 엔진 (역직렬화 → [ADR-0044 §3](../decisions/ADR-0044-export-import-job-persistence.md) atomic `$transaction`)" chain 은 파싱·구조검증·version gate·$transaction 복원·controller 재배선을 모두 포함해 300 LOC / 5 파일 cap 을 크게 초과한다. 그 chain 의 **가장 작은 dependency-free 첫 step** 이 본 task 다 — 업로드된 dump `Buffer` 를 JSON 객체로 **역직렬화만** 하는 순수 helper 신설. 현재 구조 검증 helper [import-dump-validate.ts](../../src/export/import-dump-validate.ts) 는 "이미 파싱된 plain object" 를 받으며 `JSON.parse 0` 을 명시하므로, buffer → object 로 만드는 이 앞단이 부재하다. 본 helper 가 그 gap 을 메워 후속 slice (validate 배선 → $transaction 복원 엔진 → controller 재배선, 현 interim `markFailed` guard 교체) 의 입력을 완성한다 (REQ-030 Import, REQ-032 raw 미저장 — 파싱만 하고 어떤 것도 영속 저장하지 않음).

## Required Reading

- [docs/decisions/ADR-0055-import-multipart-file-upload.md](../decisions/ADR-0055-import-multipart-file-upload.md) — §Decision 2 (memoryStorage buffer 직접 전달) + §Consequences 부정 (chain 완주 전 interim guard) + §Follow-up (b)
- [src/export/import-dump-validate.ts](../../src/export/import-dump-validate.ts) — 본 helper 의 **하류 소비자** + mirror 할 순수-helper verdict 패턴 (plain result interface / 한국어 위반 메시지 / non-mutating / early-throw 아님). `validateImportDumpStructure` 는 파싱을 하지 않으므로 본 helper 가 그 앞단.
- [src/export/export-dump.ts](../../src/export/export-dump.ts) — `ExportDump` envelope 구조 (역직렬화 성공 시 나오는 정상 shape 예시. 단 본 helper 는 shape 을 검증하지 않고 `unknown` 으로 통과시킴 — 검증은 하류 validate 책임)
- [src/import/uploaded-dump-file.ts](../../src/import/uploaded-dump-file.ts) — `UploadedDumpFile.buffer: Buffer` (본 helper 입력의 실제 출처. 단 helper 는 파일 객체가 아니라 raw `Buffer` 를 받아 decouple)

## Acceptance Criteria

- [ ] `src/import/import-dump-deserialize.ts` 신설 — 순수 함수 `deserializeDumpBuffer(buffer: Buffer): DumpDeserializeResult` 를 export 한다. 결과는 discriminated union `{ ok: true; value: unknown } | { ok: false; reason: string }` (verdict-style, throw 아님 — `import-dump-validate.ts` 패턴 mirror). value 는 `unknown` (구조 typing 은 하류 validate 책임 — decouple).
- [ ] 동작: (1) UTF-8 decode 후 `JSON.parse`, 성공 시 `{ ok: true, value: <파싱 결과> }`. (2) 입력이 `Buffer` 가 아니면 (`Buffer.isBuffer` false) `{ ok: false, reason }`. (3) 빈 buffer (length 0) / whitespace-only 는 `{ ok: false, reason }`. (4) 손상 JSON (SyntaxError) 은 catch 해 `{ ok: false, reason: "손상된 dump JSON ..." }` — throw 하지 않음. reason 은 사람-친화 한국어 short message 만 (raw stack / 외부 본문 미포함, REQ-032).
- [ ] 순수·non-mutating — 입력 buffer 변형 0, DB·repository·file I/O·gzip 해제·구조 검증·schema version 판정·REST 배선 호출 0.
- [ ] **Happy-path unit test 1+**: 정상 JSON 을 담은 `Buffer` (예: 직렬화된 `ExportDump` 유사 object) → `ok: true` 이고 `value` 가 파싱 결과와 deep-equal.
- [ ] **Error path unit test 1+**: 손상 JSON buffer (truncated / trailing comma 등) → `ok: false` + reason 존재, 함수가 throw 하지 않음.
- [ ] **Flow / branch coverage**: 위 4 분기 (정상 / 비-Buffer / 빈·whitespace / 손상 JSON) 각각 최소 1 test 로 분리.
- [ ] **Negative cases 충분 cover** — 각 1+ test: 비-Buffer 입력 (string · null · undefined), 빈 Buffer, whitespace-only Buffer, 손상 JSON (여러 형태), 그리고 **primitive/array 로 파싱되는 valid JSON** (예: `"123"` · `"\"x\""` · `"[]"`) 이 `ok: true` 로 통과함을 검증 (구조 검증은 본 helper 책임 아님을 명시적으로 박제 — 하류 validate 가 걸러냄).
- [ ] **Coverage 최소치**: `pnpm test:cov` 통과 (신규 파일 line ≥ 80% / function ≥ 80%, coverageThreshold 무회귀).
- [ ] `src/import/import-dump-deserialize.spec.ts` (colocated) 에 위 test 작성 — `check-spec-presence` 통과.
- [ ] `pnpm lint && pnpm build && pnpm test` green + `prettier --check` 통과.

## Out of Scope

- 구조 무결성 검증 (`validateImportDumpStructure` — 이미 존재, 본 helper 하류에서 별도 배선).
- schema version 호환 판정 (`checkSchemaVersionCompat` — 이미 존재).
- ADR-0044 §3 atomic `$transaction` DB 복원 (REPLACE deleteMany + create / MERGE) — 후속 slice.
- controller/service 재배선 (현 [import.controller.ts](../../src/import/import.controller.ts) 의 interim `markFailed` guard 교체) — 후속 slice. 본 task 는 helper 신설만 하고 어디에도 wire 하지 않는다 (guard 그대로 유지).
- gzip / archive 압축 해제, streaming 파싱, `UploadedDumpFile` 객체 자체를 받는 overload — buffer 만 받는다.
- 새 dependency 추가 (JSON.parse 는 Node 내장 — 새 dep 0).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — 신설 시. 참고: ADR-0055 §Follow-up (b) 잔여 slice = deserialize→validate→version gate 배선 / ADR-0044 §3 `$transaction` 복원 엔진 / controller interim guard 교체 재배선. 각 별도 task.)
