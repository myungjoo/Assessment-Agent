---
id: T-1256
title: Import dump parse pipeline helper (역직렬화→구조검증 합성) + BOM strip 보정
phase: P5
status: DONE
completedAt: 2026-07-27T07:58:00Z
mergedAs: 5e3f54ce
prNumber: 1147
reviewRounds: 1
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 280
estimatedFiles: 4
created: 2026-07-27
independentStream: import-restore-engine
dependsOn: [T-1255]
touchesFiles:
  - src/import/import-dump-parse.ts
  - src/import/import-dump-parse.spec.ts
  - src/import/import-dump-deserialize.ts
  - src/import/import-dump-deserialize.spec.ts
plannerNote: P5 ADR-0055 §Follow-up(b) 두 번째 slice — deserialize→validateImportDumpStructure 배선 + T-1255 BOM nit 회수 (version gate·$transaction 은 후속)
---

# T-1256 — Import dump parse pipeline helper (역직렬화 → 구조 검증 합성) + BOM strip 보정

## Why

[ADR-0055](../decisions/ADR-0055-import-multipart-file-upload.md) §Follow-up (b) 의 복원 엔진 chain (역직렬화 → 구조 검증 → schema version gate → [ADR-0044 §3](../decisions/ADR-0044-export-import-job-persistence.md) atomic `$transaction` 복원 → controller 재배선) 중 **첫 slice 인 T-1255 (`deserializeDumpBuffer`) 가 머지된 직후의 다음 단추** 다. 현재 `deserializeDumpBuffer` (buffer → `unknown`) 와 이미 존재하는 `validateImportDumpStructure` (파싱된 object → verdict) 는 **서로 배선되지 않은 채 따로 놓여 있어**, "업로드 buffer 하나를 넣으면 복원 가능한 dump 인지 단일 verdict 로 답한다" 는 상류 계약이 아직 없다. 본 task 는 그 둘을 합성하는 순수 pipeline helper 를 신설한다 (DB · `$transaction` · controller 배선 0 — 후속 slice). 동시에 T-1255 reviewer 가 남긴 MINOR nit (UTF-8 BOM 오탐) 을 회수한다 — Windows 계열 도구가 저장한 dump 는 선두에 BOM (`U+FEFF`) 이 붙는데 현 `deserializeDumpBuffer` 는 이를 strip 하지 않아 정상 dump 를 "손상된 dump JSON" 으로 **오탐** 하며, 이 오탐은 본 pipeline 을 그대로 통과해 실제 import 실패로 이어진다 (REQ-030 Import, REQ-032 raw 미저장 — 파싱만 하고 아무것도 영속 저장하지 않음).

## Required Reading

- [src/import/import-dump-deserialize.ts](../../src/import/import-dump-deserialize.ts) — 본 pipeline 의 1 단계 (`deserializeDumpBuffer` / `DumpDeserializeResult`) 이자 BOM 보정 대상. 현재 `buffer.toString("utf-8")` 결과를 BOM strip 없이 `trim()` / `JSON.parse` 에 넘긴다 (분기 4 개 주석 참조).
- [src/import/import-dump-deserialize.spec.ts](../../src/import/import-dump-deserialize.spec.ts) — BOM test 를 추가할 colocated spec. 기존 4 분기 test 구조를 mirror.
- [src/export/import-dump-validate.ts](../../src/export/import-dump-validate.ts) — 본 pipeline 의 2 단계. `validateImportDumpStructure(dump: unknown): ImportDumpValidation { valid, issues }` — 위반을 `issues` 배열에 **누적** 하고 throw 하지 않는다.
- [src/export/import-preflight-summary.ts](../../src/export/import-preflight-summary.ts) — 이미 존재하는 **하류** 통합 go/no-go helper (`summarizeImportPreflight`, structure/version/size/checksum verdict 합성). 본 task 는 이것을 **호출하지도 수정하지도 않는다** — 본 helper 는 그 상류의 "buffer → 파싱 + 구조 verdict" 만 담당하므로 책임 중복이 없음을 확인하는 용도로만 읽는다.
- [docs/decisions/ADR-0055-import-multipart-file-upload.md](../decisions/ADR-0055-import-multipart-file-upload.md) — §Decision 2 (memoryStorage buffer 직접 전달) + §Follow-up (b) chain 정의.
- [docs/tasks/T-1255-import-dump-deserialize.md](T-1255-import-dump-deserialize.md) — 직전 slice 의 범위·Out of Scope (본 task 가 이어받는 경계).

## Acceptance Criteria

- [ ] `src/import/import-dump-parse.ts` 신설 — 순수 함수 `parseImportDumpBuffer(buffer: Buffer): ImportDumpParseResult` 를 export 한다. 결과는 discriminated union `{ ok: true; dump: Record<string, unknown> } | { ok: false; stage: "deserialize" | "structure"; issues: string[] }` (verdict-style, throw 아님 — sibling 순수 helper 패턴 mirror).
- [ ] 동작: (1) `deserializeDumpBuffer` 호출 → `ok: false` 면 `{ ok: false, stage: "deserialize", issues: [reason] }` 로 즉시 반환 (구조 검증 미실행). (2) 성공 시 그 `value` 를 `validateImportDumpStructure` 에 넘겨 `valid: false` 면 `{ ok: false, stage: "structure", issues: <validation.issues 그대로> }`. (3) 둘 다 통과하면 `{ ok: true, dump }` — `dump` 는 파싱된 plain object.
- [ ] 순수·non-mutating — 입력 buffer / 파싱 결과 변형 0, DB · repository · file I/O · gzip 해제 · schema version 판정 · `summarizeImportPreflight` 호출 · REST 배선 0. `issues` 는 새 배열 또는 하류 verdict 배열 그대로 전달하되 원본을 mutate 하지 않는다.
- [ ] **T-1255 reviewer MINOR nit 회수 (BOM)**: `deserializeDumpBuffer` 가 UTF-8 decode 직후 **선두 BOM (`U+FEFF`) 을 strip** 한 뒤 whitespace 판정 / `JSON.parse` 를 수행하도록 보정한다. BOM 이 붙은 정상 dump 는 `ok: true` 여야 하고 (현재는 "손상된 dump JSON" 오탐), BOM 만 담긴 buffer (또는 BOM + whitespace) 는 "손상" 이 아니라 **빈 dump 파일** reason 으로 분류한다. 선두 1 개만 strip 하며 본문 중간의 `U+FEFF` 는 건드리지 않는다.
- [ ] **Happy-path unit test 1+**: 직렬화된 정상 dump envelope (schemaVersion / generatedAt / records / recordCount / entityCounts 정합) buffer → `ok: true` 이고 `dump` 가 파싱 결과와 deep-equal. 추가로 BOM 이 붙은 같은 buffer 도 `ok: true` (deserialize spec 쪽 happy test 1+).
- [ ] **Error path unit test 1+**: 손상 JSON buffer → `ok: false` + `stage === "deserialize"` + `issues.length === 1`, 그리고 함수가 throw 하지 않음. 구조 위반 dump (예: `recordCount !== records.length`) → `ok: false` + `stage === "structure"` + `issues` 가 validate 의 위반 메시지를 담음.
- [ ] **Flow / branch coverage**: 3 분기 (deserialize 실패 / structure 실패 / 전부 통과) 각각 최소 1 test 로 분리. deserialize 실패 시 `validateImportDumpStructure` 가 **호출되지 않음** 을 spy 로 검증 1 test.
- [ ] **Negative cases 충분 cover** — 각 1+ test: 비-Buffer 입력 (`null` · `undefined` · string) 이 `stage: "deserialize"` 로 안전 반환, 빈 buffer, whitespace-only buffer, BOM-only buffer, 파싱은 되지만 top-level 이 primitive / array 인 JSON (`"123"` · `"[]"`) 이 `stage: "structure"` 로 분류됨, 구조 위반이 여러 개인 dump 의 `issues` 가 2+ 누적, 입력 buffer 가 호출 후에도 원본과 동일 (non-mutating) 검증.
- [ ] **Coverage 최소치**: `pnpm test:cov` 통과 (신규/수정 파일 line ≥ 80% / function ≥ 80%, coverageThreshold 무회귀).
- [ ] `src/import/import-dump-parse.spec.ts` (colocated) 에 pipeline test 를, `src/import/import-dump-deserialize.spec.ts` (colocated) 에 BOM test 를 작성 — `check-spec-presence` 통과.
- [ ] `pnpm lint && pnpm build && pnpm test` green + `prettier --check` 통과.
- [ ] 변경 파일 4 개 / diff ≤ 300 LOC 유지 — pipeline spec 은 하류 helper (`deserializeDumpBuffer` / `validateImportDumpStructure`) 의 세부 분기를 **재검증하지 않고** 합성 계약 (stage 분류 · 단락 평가 · verdict 전달) 에 집중한다 (각 helper 의 세부는 자기 colocated spec 이 이미 cover).

## Out of Scope

- schema version gate 배선 (`checkSchemaVersionCompat` 호출) — **다음 slice**. 본 helper 는 version 을 판정하지 않는다.
- size / checksum / merge-conflict verdict 및 `summarizeImportPreflight` 합성 — 하류 별도 slice (본 task 는 그 helper 를 호출·수정하지 않는다).
- [ADR-0044 §3](../decisions/ADR-0044-export-import-job-persistence.md) atomic `$transaction` DB 복원 (REPLACE / MERGE) — 후속 slice.
- controller / service 재배선 — [import.controller.ts](../../src/import/import.controller.ts) 의 interim `markFailed` guard 는 **그대로 유지**. 본 helper 는 어디에도 wire 하지 않는다 (T-1254 guard 교체는 chain 완주 시점).
- `import-dump-validate.ts` / `import-preflight-summary.ts` 본문 수정 — 재사용만 한다.
- gzip / archive 해제, streaming 파싱, `UploadedDumpFile` 객체 overload, 새 dependency 추가.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — 신설 시. 참고: ADR-0055 §Follow-up (b) 잔여 slice = schema version gate 배선 → ADR-0044 §3 `$transaction` 복원 엔진 → controller interim guard 교체 재배선. 각 별도 task.)
