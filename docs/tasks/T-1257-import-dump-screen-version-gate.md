---
id: T-1257
title: Import dump screening helper (파싱 pipeline + schema version gate 배선)
phase: P5
status: DONE
completedAt: 2026-07-27T08:53:12Z
prNumber: 1148
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 250
estimatedFiles: 2
created: 2026-07-27
independentStream: import-restore-engine
dependsOn: [T-1256]
touchesFiles:
  - src/import/import-dump-screen.ts
  - src/import/import-dump-screen.spec.ts
plannerNote: P5 ADR-0055 §Follow-up(b) 세 번째 slice — parseImportDumpBuffer + checkSchemaVersionCompat 배선 ($transaction 복원은 후속)
---

# T-1257 — Import dump screening helper (파싱 pipeline + schema version gate 배선)

## Why

[ADR-0055](../decisions/ADR-0055-import-multipart-file-upload.md) §Follow-up (b) 의 복원 엔진 chain (역직렬화 → 구조 검증 → **schema version gate** → [ADR-0044 §3](../decisions/ADR-0044-export-import-job-persistence.md) atomic `$transaction` 복원 → controller 재배선) 중 **세 번째 slice** 다. 직전 T-1256 이 `parseImportDumpBuffer` (buffer → 파싱 + 구조 verdict) 를 세웠지만, 그 결과가 **현재 시스템 schema 로 복원 가능한 version 인지** 는 아직 아무도 묻지 않는다 — `checkSchemaVersionCompat` (T-0439) 는 2026-06 부터 caller 0 인 채 놓여 있다. 본 task 는 그 둘을 합성해 "업로드 buffer 하나를 넣으면 **복원 시도해도 되는 dump 인지** 단일 verdict 로 답한다" 는 계약을 완성한다 (DB · `$transaction` · controller 배선 0 — 후속 slice). REQ-030 (Import) / REQ-032 (raw 미저장 — 파싱 결과를 어디에도 영속 저장하지 않음) 을 cover 한다.

## Required Reading

- [src/import/import-dump-parse.ts](../../src/import/import-dump-parse.ts) — 본 helper 의 1~2 단계 (`parseImportDumpBuffer` / `ImportDumpParseResult` / `ImportDumpParseStage`). 실패 verdict shape (`{ ok: false, stage, issues }`) 를 그대로 확장한다.
- [src/import/import-dump-parse.spec.ts](../../src/import/import-dump-parse.spec.ts) — 신규 colocated spec 이 mirror 할 test 구조 (분기별 describe + non-mutating 검증).
- [src/export/schema-version-compat.ts](../../src/export/schema-version-compat.ts) — 본 helper 의 3 단계. `checkSchemaVersionCompat(uploadedVersion: string, options?: SchemaVersionCompatOptions): SchemaVersionCompat` — `action` 은 `"accept" | "migrate" | "reject"` 이고 **비어있지 않은 string 이 아닌 uploadedVersion 은 TypeError** 를 던진다 (본 helper 는 구조 검증 통과 후에만 호출하므로 이 throw 경로에 도달하지 않음).
- [src/export/import-dump-validate.ts](../../src/export/import-dump-validate.ts) — 구조 검증이 `schemaVersion` 을 "비어있지 않은 string" 으로 이미 보장한다는 근거 (79~81 행). 본 task 는 이 파일을 **수정하지 않는다**.
- [src/export/import-preflight-summary.ts](../../src/export/import-preflight-summary.ts) — 하류 통합 go/no-go helper. `action === "reject"` 는 blocking, `"migrate"` 는 warning 이라는 **기존 등급 분류** 를 본 helper 가 그대로 따라야 한다 (162~190 행). 호출·수정 0 — 등급 정합 확인용으로만 읽는다.
- [docs/decisions/ADR-0055-import-multipart-file-upload.md](../decisions/ADR-0055-import-multipart-file-upload.md) — §Follow-up (b) chain 정의.

## Acceptance Criteria

- [ ] `src/import/import-dump-screen.ts` 신설 — 순수 함수 `screenImportDumpBuffer(buffer: Buffer, options?: SchemaVersionCompatOptions): ImportDumpScreenResult` 를 export 한다. 결과는 discriminated union `{ ok: true; dump: Record<string, unknown>; version: SchemaVersionCompat } | { ok: false; stage: "deserialize" | "structure" | "version"; issues: string[] }` (verdict-style, throw 아님 — sibling 순수 helper 패턴 mirror). 실패 stage 타입은 `ImportDumpParseStage` 를 재사용해 합성한다 (문자열 union 재정의 금지).
- [ ] 동작: (1) `parseImportDumpBuffer` 호출 → `ok: false` 면 그 `stage` / `issues` 를 **그대로** 전달 (version gate 미실행 — 단락 평가). (2) 성공 시 `dump.schemaVersion` 을 `checkSchemaVersionCompat` 에 넘긴다. (3) `action === "reject"` 면 `{ ok: false, stage: "version", issues: [reason] }`. (4) `action === "accept" | "migrate"` 면 `{ ok: true, dump, version }` — `migrate` 는 차단이 아니라 호출측 confirmation 영역 (`import-preflight-summary` 의 warning 등급과 동일 분류) 이며, 판단 근거는 반환된 `version` verdict 로 전달한다.
- [ ] 순수·non-mutating — 입력 buffer / `options` / 파싱 결과 변형 0, DB · repository · file I/O · gzip 해제 · size · checksum · merge 판정 · `summarizeImportPreflight` 호출 · REST 배선 0. 하류 helper 의 규칙을 재구현하지 않고 **호출 순서와 실패 stage 분류만** 담당한다 (DRY).
- [ ] **Happy-path unit test 1+**: 현재 `EXPORT_SCHEMA_VERSION` 으로 직렬화된 정상 dump buffer → `ok: true` + `version.action === "accept"` + `version.compatible === true` + `dump` 가 파싱 결과와 deep-equal.
- [ ] **Error path unit test 1+**: 손상 JSON buffer → `ok: false` + `stage === "deserialize"`, 구조 위반 dump (예: `recordCount !== records.length`) → `ok: false` + `stage === "structure"`, version mismatch dump (`allowMigrationFrom` 미지정) → `ok: false` + `stage === "version"` + `issues.length === 1` (reason 포함). 어느 경우에도 함수가 throw 하지 않음을 검증.
- [ ] **Flow / branch coverage**: 4 분기 (parse 실패 전달 / version reject / version migrate / version accept) 각각 최소 1 test 로 분리. parse 실패 시 `checkSchemaVersionCompat` 가 **호출되지 않음** 을 spy 로 검증 1 test.
- [ ] **Negative cases 충분 cover** — 각 1+ test: 비-Buffer 입력 (`null` · `undefined` · string) 이 `stage: "deserialize"` 로 안전 반환, 빈/whitespace-only buffer, top-level 이 primitive / array 인 JSON 이 `stage: "structure"` 로 분류, `options.currentVersion` 을 명시해 mismatch 를 유도한 경우 `stage: "version"`, `allowMigrationFrom` 에 업로드 version 이 포함되면 `ok: true` + `action === "migrate"` (차단 아님), `Object.freeze` 된 `options` 로 호출해도 통과 (non-mutating), 호출 후 입력 buffer 가 원본과 동일 (non-mutating).
- [ ] **Coverage 최소치**: `pnpm test:cov` 통과 (신규 파일 line ≥ 80% / function ≥ 80%, coverageThreshold 무회귀).
- [ ] `src/import/import-dump-screen.spec.ts` (colocated) 에 작성 — `check-spec-presence` 통과.
- [ ] `pnpm lint && pnpm build && pnpm test` green + `prettier --check` 통과.
- [ ] 변경 파일 2 개 / diff ≤ 300 LOC 유지 — spec 은 하류 helper (`parseImportDumpBuffer` / `checkSchemaVersionCompat`) 의 세부 규칙을 **재검증하지 않고** 합성 계약 (stage 분류 · 단락 평가 · verdict 전달 · migrate 등급) 에 집중한다.

## Out of Scope

- size / checksum / merge-conflict verdict 및 `summarizeImportPreflight` 합성 — 하류 별도 slice (본 task 는 그 helper 를 호출·수정하지 않는다).
- 실제 schema migration 수행 (`action === "migrate"` 일 때의 변환 로직) — `checkSchemaVersionCompat` 주석대로 "후보 판정" 까지만.
- [ADR-0044 §3](../decisions/ADR-0044-export-import-job-persistence.md) atomic `$transaction` DB 복원 (REPLACE / MERGE) — 후속 slice.
- controller / service 재배선 — [import.controller.ts](../../src/import/import.controller.ts) 의 interim `markFailed` guard (T-1254) 는 **그대로 유지**. 본 helper 는 어디에도 wire 하지 않는다.
- `import-dump-parse.ts` / `import-dump-validate.ts` / `schema-version-compat.ts` / `import-preflight-summary.ts` 본문 수정 — 재사용만 한다.
- gzip / archive 해제, streaming 파싱, `UploadedDumpFile` 객체 overload, 새 dependency 추가.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — 신설 시. 참고: ADR-0055 §Follow-up (b) 잔여 slice = ADR-0044 §3 `$transaction` 복원 엔진 → controller interim guard 교체 재배선. 각 별도 task.)
