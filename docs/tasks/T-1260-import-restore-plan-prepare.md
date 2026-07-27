---
id: T-1260
title: Import 복원 plan 준비 helper (복원 입력 + mode 매핑 + plan 산출 합성)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 290
estimatedFiles: 2
created: 2026-07-27
independentStream: import-restore-engine
dependsOn: [T-1259]
touchesFiles:
  - src/import/import-restore-plan-prepare.ts
  - src/import/import-restore-plan-prepare.spec.ts
plannerNote: P5 ADR-0055 §Follow-up(b) 여섯 번째 slice — buffer+existing+Prisma ImportMode 를 ADR-0044 §3 $transaction 이 그대로 소비할 plan verdict 로 합성
---

# T-1260 — Import 복원 plan 준비 helper (복원 입력 + mode 매핑 + plan 산출 합성)

## Why

[ADR-0055](../decisions/ADR-0055-import-multipart-file-upload.md) §Follow-up (b) 복원 엔진 chain (역직렬화 → 구조 검증 → version gate → records hydrate → 복원 입력 합성 → **복원 plan 산출** → [ADR-0044](../decisions/ADR-0044-export-import-job-persistence.md) §3 atomic `$transaction` 복원 → controller 재배선) 의 **여섯 번째 slice** 다. 직전 slice (T-1259) 로 업로드 buffer 하나에서 `ExportRecord[]` + version 판정까지 얻는 `prepareImportRestoreInput` 이 머지됐고, plan 산출 규칙 자체는 T-0442 의 `buildImportRestorePlan` 이 이미 갖고 있지만 **둘은 서로 배선되지 않았고** Prisma `ImportMode` (`REPLACE` / `MERGE`) ↔ `ImportRestoreMode` (`replace` / `merge`) 를 잇는 경로도 없다. 또한 `buildImportRestorePlan` 은 **throw 계약** 이라 verdict 계약인 상류 chain 과 그대로 이어붙일 수 없다. 본 task 는 그 합성 + mode 매핑 + throw→verdict 흡수 한 겹만 순수 helper 로 닫아, 다음 slice (실 `$transaction` 복원) 가 **plan 하나만 받아 실행** 하면 되도록 단일 계약을 만든다. REQ-030 (Import) / REQ-032 (raw 미저장) 을 cover 한다.

## Required Reading

- [src/import/import-restore-input.ts](../../src/import/import-restore-input.ts) — 상류 helper. `prepareImportRestoreInput(buffer, options?)` 가 `{ ok: true; records: ExportRecord[]; version: SchemaVersionCompat } | { ok: false; stage: ImportRestoreInputStage; issues: string[] }` 를 돌려준다. 본 helper 가 mirror 할 **단락 평가 + stage 그대로 전달 (재가공 0)** 패턴의 정본. 호출만 하고 수정 0.
- [src/export/import-restore-plan.ts](../../src/export/import-restore-plan.ts) 24~110 행 — `ImportRestoreMode` (`"replace" | "merge"`), `ImportRestorePlan` (`toDelete` / `toInsert` / `toKeep`), `buildImportRestorePlan(existing, incoming, mode)`. **throw 계약** 이다 — 잘못된 mode 는 `RangeError`, 비-배열 / Invalid Date 원소는 `TypeError`. 본 helper 가 그 throw 를 verdict 로 흡수한다. 호출만 하고 수정 0. (이 파일은 git 이 binary 로 표시할 수 있다 — 읽을 때 `grep -a` / Read 도구 사용.)
- [src/export/export-scope-select.ts](../../src/export/export-scope-select.ts) 16~29 행 — `ExportEntity` / `ExportRecord` 타입. 새 도메인 타입 신설 0, 재사용만.
- [src/export/schema-version-compat.ts](../../src/export/schema-version-compat.ts) 20~40 행 — `SchemaVersionCompat` (`action: "accept" | "migrate" | "reject"`) / `SchemaVersionCompatOptions`. 본 helper 는 options 를 그대로 통과시키고 version 판정을 성공 결과에 그대로 실어 보낸다 (재해석 0).
- [src/import/import-job.service.ts](../../src/import/import-job.service.ts) 36·61~66·190~200 행 — Prisma `ImportMode` enum (`REPLACE` / `MERGE`) 의 기존 사용 패턴 (`Object.values(ImportMode).includes(...)` 방어 포함). 본 helper 의 mode 입력 타입 근거. 수정 0.
- [src/import/import-restore-input.spec.ts](../../src/import/import-restore-input.spec.ts) — 신규 colocated spec 이 mirror 할 test 구조 (stage 별 `describe` + 실제 buffer 입력 + throw 0 검증 + non-mutating / idempotent 검증 + spy positive-control).

## Acceptance Criteria

- [ ] `src/import/import-restore-plan-prepare.ts` 신설 — 순수 함수 `prepareImportRestorePlan(buffer: Buffer, existing: ReadonlyArray<ExportRecord>, mode: ImportMode, options?: SchemaVersionCompatOptions): ImportRestorePlanPrepareResult` 를 export 한다. 결과는 discriminated union `{ ok: true; plan: ImportRestorePlan; records: ExportRecord[]; version: SchemaVersionCompat } | { ok: false; stage: ImportRestorePlanStage; issues: string[] }` (verdict-style, **throw 0**). `ImportRestorePlanStage = ImportRestoreInputStage | "mode" | "plan"` 으로 정의해 상류 stage 를 확장 재사용한다 (문자열 리터럴 재선언 금지).
- [ ] 동작은 **단락 평가 3 단계**: (1) mode 매핑 — Prisma `ImportMode.REPLACE` → `"replace"`, `ImportMode.MERGE` → `"merge"`. enum 멤버가 아닌 값 (소문자 / `"PATCH"` / null / undefined / number / 객체) 은 `{ ok: false, stage: "mode", issues: [한국어 사유] }` 로 즉시 거부하며 **buffer 파싱을 시도하지 않는다**. (2) `prepareImportRestoreInput(buffer, options)` 실패 → 그 `stage` 와 `issues` 를 **그대로** 전달 (재가공 0), plan 산출은 실행하지 않는다. (3) `buildImportRestorePlan(existing, records, restoreMode)` 를 호출하되 throw 는 `{ ok: false, stage: "plan", issues: [error.message] }` 로 흡수한다 (stack / raw 미포함 — REQ-032 정합). 전부 통과 → `{ ok: true, plan, records, version }` — version 판정은 그대로 실어 보내고 `action === "migrate"` 를 차단하지 않는다 (차단 판단은 호출측 몫).
- [ ] 순수·non-mutating — 입력 `buffer` / `existing` / `options` 변형 0 (`existing` 은 `ReadonlyArray` 로 받고 원소도 건드리지 않는다), DB · repository · file I/O · Prisma client 호출 · `$transaction` · REST 배선 0 (`ImportMode` 는 **enum 값만** import). 상류/하류 helper 의 규칙 (JSON 파싱 · 구조 검증 · version 판정 · records 복원 · replace/merge 분류) 재구현 0 — 본 helper 는 **mode 매핑 + 호출 순서 + 실패 stage 분류** 만 담당한다 (DRY).
- [ ] **Happy-path unit test 1+**: 정상 dump buffer (5 entity 혼합 + 현재 schemaVersion) + 기존 record 배열 + `ImportMode.REPLACE` → `ok: true`, `plan.toDelete` 가 기존 전부 / `plan.toInsert` 가 dump records 전부 / `plan.toKeep` 빈 배열, `records` 각 `instant instanceof Date`, `version.action === "accept"`. `ImportMode.MERGE` 경로도 1+ — 충돌 (같은 entity + 같은 instant) 기존은 `toDelete`, 비충돌 기존은 `toKeep`, incoming 은 전부 `toInsert`. `existing` 빈 배열 / dump `records: []` 조합도 `ok: true`.
- [ ] **Error path unit test 1+**: 비-Buffer / 빈 buffer / 손상 JSON → `ok: false` + `stage === "deserialize"`. 구조 위반 dump → `stage === "structure"`. 호환 불가 schemaVersion → `stage === "version"`. records 원소 위반 → `stage === "records"`. 유효하지 않은 mode → `stage === "mode"`. `existing` 이 비-배열 / 원소 `instant` 가 Invalid Date → `stage === "plan"` (throw 가 verdict 로 흡수됨).
- [ ] **분기 cover**: (1) mode 실패 / (2) 복원 입력 실패 (deserialize · structure · version · records 4 경로 각 1+) / (3) plan throw 흡수 / (4) 성공 REPLACE / (5) 성공 MERGE — 모든 분기 각 1+ test. `version.action === "migrate"` 인 dump 도 차단되지 않고 `ok: true` 로 plan 까지 산출됨을 1+ test 로 확인.
- [ ] **Negative cases 충분 cover** — 각 1+ test: mode 실패 시 `prepareImportRestoreInput` 이 **호출되지 않음** (jest spy, 성공 경로에서는 호출됨을 positive-control 로 함께 검증), 복원 입력 실패 시 `buildImportRestorePlan` 이 **호출되지 않음** (동일 spy + positive-control), 실패 verdict 는 부분 결과 (`plan` / `records`) 를 절대 포함하지 않음, `plan` 실패 시 issues 가 정확히 1 개이고 한국어 메시지이며 stack / `Error` 객체를 그대로 노출하지 않음, `options` 미전달 (undefined) 과 커스텀 `currentVersion` / `allowMigrationFrom` 전달 두 경로, `existing` 에 원소 2 개 이상 위반이 있어도 throw 없이 verdict 로만 종료, **어떤 입력에서도 throw 하지 않음** (`expect(() => ...).not.toThrow()` — 위 모든 비정상 입력에 대해).
- [ ] non-mutating / idempotent 검증 test 1+ — 호출 후 입력 buffer 내용 (`toString()`) 과 `existing` 배열 길이·원소 (`instant.getTime()` 포함) 가 불변이고, 같은 입력으로 두 번 호출하면 동일 결과 (deep equal) 가 나온다.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 신규 파일 2종은 line / branch / function 100% 목표.
- [ ] 새 외부 dependency 0 — `package.json` 변경 없음.

## Out of Scope

- ADR-0044 §3 atomic `$transaction` 복원 실행 (deleteMany / createMany / Prisma repository / row → entity 매핑) — 다음 slice. 본 helper 는 plan 산출까지만.
- `import.controller.ts` 의 interim false-success guard (T-1254) 교체·재배선, `ImportJobService` 변경 — 후속 slice. 본 helper 는 어디에도 배선하지 않는다 (caller 0 인 채 머지).
- `prepareImportRestoreInput` / `buildImportRestorePlan` / `screenImportDumpBuffer` / `hydrateImportDumpRecords` 등 기존 helper 의 signature·본문 수정 (아래 Follow-ups 의 문구 정정 포함 — 본 task 에서 하지 않는다).
- merge conflict 알고리즘 고도화 (PK 기반 dedupe / timestamp 비교), `summarizeRestorePlan` · `summarizeImportImpact` · 확인 dialog 배선, size / checksum 검증.
- e2e / smoke spec 추가, `docs/architecture/*` 갱신, Prisma schema 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (T-1258 reviewer round 2 지적, T-1259 미회수 이월) [src/export/import-dump-validate.ts](../../src/export/import-dump-validate.ts) 53 행 주석 / 93 행 issue 메시지가 `generatedAt` 을 "ISO 파싱 가능한 string" 이라고 표현하지만 실제 판정은 `new Date(value)` 기준이라 ISO 8601 이 아닌 형식 (RFC 2822 등) 도 통과한다 — 문구 부정확. comment / 메시지 문구만 정정하는 fix 로 회수 (해당 spec 의 문구 assertion 동반 갱신 필요, 2 파일). 인접 slice 의 PR nit-closure 로 흡수하거나 별도 소형 task 로 큐잉.
- ADR-0055 §Follow-up (b) 잔여 slice = ADR-0044 §3 `$transaction` 복원 엔진 (plan → 실 DB 반영) → controller interim guard 교체 재배선.
