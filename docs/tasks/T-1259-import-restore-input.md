---
id: T-1259
title: Import 복원 입력 준비 helper (screen + records hydrate 합성)
phase: P5
status: DONE
completedAt: 2026-07-27T09:57:30Z
prNumber: 1150
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 285
estimatedFiles: 2
created: 2026-07-27
independentStream: import-restore-engine
dependsOn: [T-1258]
touchesFiles:
  - src/import/import-restore-input.ts
  - src/import/import-restore-input.spec.ts
plannerNote: P5 ADR-0055 §Follow-up(b) 다섯 번째 slice — screen + hydrate 합성으로 $transaction 복원 입력(ExportRecord[]+version) 단일 verdict 확정
---

# T-1259 — Import 복원 입력 준비 helper (screen + records hydrate 합성)

## Why

[ADR-0055](../decisions/ADR-0055-import-multipart-file-upload.md) §Follow-up (b) 복원 엔진 chain (역직렬화 → 구조 검증 → schema version gate → 복원 plan 입력 복원 → [ADR-0044](../decisions/ADR-0044-export-import-job-persistence.md) §3 atomic `$transaction` 복원 → controller 재배선) 의 **다섯 번째 slice** 다. 직전 두 slice 로 `screenImportDumpBuffer` (buffer → 복원 시도 가능 여부 + `dump` + version 판정) 와 `hydrateImportDumpRecords` (dump → `ExportRecord[]`) 가 각각 머지됐지만 **둘은 아직 서로 배선되지 않아** 업로드 buffer 하나에서 `$transaction` 복원 입력 (`ExportRecord[]` + version 판정) 까지 한 번에 얻을 방법이 없다. 본 task 는 그 합성 한 겹만 순수 helper 로 닫아 다음 slice (실 `$transaction` 복원) 가 소비할 **단일 진입 계약** 을 만든다. REQ-030 (Import) / REQ-032 (raw 미저장 — 변환 결과를 어디에도 영속 저장하지 않음) 을 cover 한다.

## Required Reading

- [src/import/import-dump-screen.ts](../../src/import/import-dump-screen.ts) — 상류 helper. `screenImportDumpBuffer(buffer, options?)` 가 `{ ok: true; dump; version } | { ok: false; stage: "deserialize" | "structure" | "version"; issues }` 를 돌려준다. 본 helper 가 mirror 할 **단락 평가 + stage 전달 (재가공 0)** 패턴의 정본. 호출만 하고 수정 0.
- [src/import/import-dump-records-hydrate.ts](../../src/import/import-dump-records-hydrate.ts) — 하류 helper. `hydrateImportDumpRecords(dump: Record<string, unknown>)` 가 `{ ok: true; records: ExportRecord[] } | { ok: false; issues: string[] }` 를 돌려준다. 호출만 하고 수정 0.
- [src/export/export-scope-select.ts](../../src/export/export-scope-select.ts) 16~29 행 — `ExportEntity` / `ExportRecord` 타입. 본 helper 의 성공 결과 타입은 이 타입을 **재사용** 하며 새 도메인 타입 신설 0.
- [src/export/schema-version-compat.ts](../../src/export/schema-version-compat.ts) 20~40 행 — `SchemaVersionCompat` / `SchemaVersionCompatOptions`. 본 helper 는 options 를 **그대로 통과** 시키고 version 판정을 성공 결과에 그대로 실어 보낸다 (재해석 0).
- [src/import/import-dump-screen.spec.ts](../../src/import/import-dump-screen.spec.ts) — 신규 colocated spec 이 mirror 할 test 구조 (stage 별 `describe` + 실제 buffer 입력 + throw 0 검증 + non-mutating 검증).

## Acceptance Criteria

- [ ] `src/import/import-restore-input.ts` 신설 — 순수 함수 `prepareImportRestoreInput(buffer: Buffer, options?: SchemaVersionCompatOptions): ImportRestoreInputResult` 를 export 한다. 결과는 discriminated union `{ ok: true; records: ExportRecord[]; version: SchemaVersionCompat } | { ok: false; stage: ImportRestoreInputStage; issues: string[] }` (verdict-style, **throw 0**). `ImportRestoreInputStage = ImportDumpScreenStage | "records"` 로 정의해 상류 stage 를 확장 재사용한다 (문자열 리터럴 재선언 금지).
- [ ] 동작은 **단락 평가 2 단계**: (1) `screenImportDumpBuffer(buffer, options)` 실패 → 그 `stage` 와 `issues` 를 **그대로** 전달 (재가공 0), hydrate 는 실행하지 않는다. (2) screen 성공 후 `hydrateImportDumpRecords(dump)` 실패 → `{ ok: false, stage: "records", issues }` (hydrate 가 누적한 issue 배열 그대로). (3) 둘 다 통과 → `{ ok: true, records, version }` — screen 이 돌려준 version 판정을 그대로 실어 보낸다 (`accept` / `migrate` 구분은 호출측 몫, 차단 0).
- [ ] 순수·non-mutating — 입력 `buffer` / `options` 변형 0, DB · repository · file I/O · Prisma · `$transaction` · `buildImportRestorePlan` 호출 · REST 배선 0. 상류/하류 helper 의 규칙 (JSON 파싱 · 구조 검증 · version 판정 · records 타입 복원) 재구현 0 — **호출 순서와 실패 stage 분류만** 담당한다 (DRY).
- [ ] **Happy-path unit test 1+**: 정상 dump buffer (5 entity 혼합 + ISO instant + 현재 schemaVersion) → `ok: true`, `records` 가 `ExportRecord[]` 이고 각 `instant instanceof Date`, 순서 보존, `version.action === "accept"`. 빈 `records: []` dump → `ok: true` + 빈 배열.
- [ ] **Error path unit test 1+**: 비-Buffer / 빈 buffer / 손상 JSON → `ok: false` + `stage === "deserialize"`. 구조 위반 dump → `stage === "structure"`. 호환 불가 schemaVersion → `stage === "version"`.
- [ ] **분기 cover**: 위 (1) screen 실패 (deserialize / structure / version 3 경로 각 1+) / (2) hydrate 실패 (`stage === "records"`) / (3) 성공 — 모든 분기 각 1+ test. `version.action === "migrate"` 인 dump 도 **차단되지 않고** `ok: true` 로 통과함을 1+ test 로 확인.
- [ ] **Negative cases 충분 cover** — 각 1+ test: screen 실패 시 hydrate 가 **호출되지 않음** (jest spy 또는 hydrate 가 throw 할 입력으로 간접 확인 — spy 사용 시 positive-control 로 성공 경로에서는 호출됨도 함께 검증), records 원소의 `entity` 가 5-union 밖 / `instant` 가 파싱 불가 문자열·Invalid Date·number·null·누락 → `stage === "records"` + 해당 index 를 담은 issue, 위반 원소 2개 이상일 때 issues 가 모두 누적되고 부분 결과 (`records`) 를 반환하지 않음, `options` 미전달 (undefined) 과 커스텀 `currentVersion` 전달 두 경로, **어떤 입력에서도 throw 하지 않음** (`expect(() => ...).not.toThrow()`).
- [ ] non-mutating 검증 test 1+ — 호출 후 입력 buffer 내용 (`toString()`) 이 불변이고, 같은 buffer 로 두 번 호출해도 동일 결과가 나옴 (idempotent).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 신규 파일 2종은 line / branch / function 100% 목표.
- [ ] 새 외부 dependency 0 — `package.json` 변경 없음.

## Out of Scope

- ADR-0044 §3 atomic `$transaction` 복원 실행 (deleteMany / createMany / Prisma repository) — 다음 slice.
- `buildImportRestorePlan` 호출 · `ImportRestoreMode` (`replace` / `merge`) 결정 · Prisma `ImportMode` ↔ `ImportRestoreMode` 매핑 — 별도 slice.
- `import.controller.ts` 의 interim false-success guard (T-1254) 교체·재배선 — 후속 slice. 본 helper 는 어디에도 배선하지 않는다 (caller 0 인 채 머지).
- `screenImportDumpBuffer` / `hydrateImportDumpRecords` / `validateImportDumpStructure` / `checkSchemaVersionCompat` 등 기존 helper 의 signature·본문 수정 (아래 Follow-ups 의 문구 정정 포함 — 본 task 에서 하지 않는다).
- entity 별 도메인 field 복원, size / checksum / merge conflict 판정, e2e / smoke spec 추가, `docs/architecture/*` 갱신.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (T-1258 reviewer round 2 지적, 별건) [src/export/import-dump-validate.ts](../../src/export/import-dump-validate.ts) 53 행 주석 / 93 행 issue 메시지가 `generatedAt` 을 "ISO 파싱 가능한 string" 이라고 표현하지만 실제 판정은 `new Date(value)` 파싱 기준이라 ISO 8601 이 아닌 형식 (RFC 2822 등) 도 통과한다 — 문구 부정확. 문구만 정정하는 doc/comment-level fix task 로 회수 (본 task Out of Scope).
- ADR-0055 §Follow-up (b) 잔여 slice = ADR-0044 §3 `$transaction` 복원 엔진 → controller interim guard 교체 재배선. (다음 slice 는 T-1260 으로 큐잉됨 — 복원 plan 준비 helper.)

## Result (2026-07-27)

- PR [#1150](https://github.com/myungjoo/Assessment-Agent/pull/1150) squash merge `7a897954`. reviewer round 1 APPROVE + MINOR nit 1 건을 CLAUDE.md §3 nit-in-PR closure 로 같은 PR round 2 commit 에서 마감, round 2 재검토 finding 0 APPROVE. 4-게이트 전부 PASS.
- 신규 2 파일 `src/import/import-restore-input.ts` (+75) / `src/import/import-restore-input.spec.ts` (+357) — 신규 파일 line/branch/function 100%, 전체 suite green.
- 첫 CI run 의 `배포 산출물 검증` job fail 은 Docker Hub registry timeout 인프라 flake 였고 nit fix push 후 run 에서 자연 해소 (코드 결함 0).
