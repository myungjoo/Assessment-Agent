---
id: T-1262
title: Import 복원 operation 그룹핑 helper (plan → entity·phase 별 실행 단위)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 500
estimatedFiles: 3
created: 2026-07-27
independentStream: import-restore-engine
dependsOn: [T-1261]
touchesFiles:
  - src/import/import-restore-order.ts
  - src/import/import-restore-ops.ts
  - src/import/import-restore-ops.spec.ts
sizeExempt: true
exemptReason: R-112 backbone slice — production ~120 LOC 는 cap 안이고 초과분은 전량 spec(4 분기 × negative 다수). 동일 chain 선례 T-1255~T-1261 이 모두 spec 초과로 머지됐고 T-1261 실측은 총 595 LOC(production 106 / spec 489).
prNumber: 1153
reviewRounds: 2
mergedAs: 3686e34f
completedAt: 2026-07-27T12:23:00Z
actualDiff: 628
actualFiles: 3
plannerNote: "cap-bend pre-justified: R-112 backbone x 1.5 = 500 LOC, 선례 T-1261 실측 595(prod 106/spec 489) — ADR-0055 §Follow-up(b) 여덟 번째 slice"
---

# T-1262 — Import 복원 operation 그룹핑 helper (plan → entity·phase 별 실행 단위)

## Why

[ADR-0055](../decisions/ADR-0055-import-multipart-file-upload.md) §Follow-up (b) 복원 엔진 chain (역직렬화 → 구조 검증 → version gate → records hydrate → 복원 입력 합성 → 복원 plan 산출 → FK 안전 실행 순서 → **entity 별 operation 그룹핑** → ADR-0044 §3 atomic `$transaction` 복원 → controller 재배선) 의 **여덟 번째 slice** 다. 직전 slice (T-1261) 가 "어느 entity 를 먼저 넣고 먼저 지울지" 순서만 박제했지만, 실제 `$transaction` 은 record 를 **entity 단위 배치**로 넘겨야 하므로 `ImportRestorePlan` 의 `{toDelete, toInsert}` 평면 배열을 **(phase, entity, records) 실행 단위**로 접는 한 겹이 더 필요하다. 본 slice 가 그 순수 변환만 담당해, 다음 slice (실 `$transaction`) 가 순서 재추론·그룹핑·평면 순회를 한꺼번에 떠안지 않게 한다 (PLAN.md P7 line 137 R-57 backup/restore 의 restore 경로 실동작 완결).

부가로 T-1261 reviewer NIT-1 을 회수한다 — `"insert" | "delete"` union 을 `ImportRestorePhase` named type 으로 export 해 본 slice 와 하류 slice 들이 literal union 을 재선언하지 않도록 한다.

## Required Reading

- [docs/decisions/ADR-0055-import-multipart-file-upload.md](../decisions/ADR-0055-import-multipart-file-upload.md) — §Follow-up (b) 복원 엔진 chain 의 slice 경계.
- [docs/decisions/ADR-0044-export-import-job-persistence.md](../decisions/ADR-0044-export-import-job-persistence.md) — §2 raw 미저장 / artifactRef, §3 all-or-nothing `$transaction` 복원 계약.
- [src/import/import-restore-order.ts](../../src/import/import-restore-order.ts) — 본 task 가 수정할 파일 (`ImportRestorePhase` named type export + `orderImportRestoreEntities` 시그니처 반영). `IMPORT_RESTORE_INSERT_ORDER` 재사용 대상.
- [src/import/import-restore-order.spec.ts](../../src/import/import-restore-order.spec.ts) — 기존 spec (회귀 무영향 확인용, 본 task 는 수정 대상 아님).
- [src/export/import-restore-plan.ts](../../src/export/import-restore-plan.ts) — `ImportRestorePlan` (`toDelete` / `toInsert` / `toKeep`) 및 throw 계약 (TypeError / RangeError + 한국어 메시지) 동형 참조.
- [src/export/export-scope-select.ts](../../src/export/export-scope-select.ts) — `ExportEntity` union (5 literal) 과 `ExportRecord` (`entity` / `instant`) shape.
- [src/import/import-restore-plan-prepare.ts](../../src/import/import-restore-plan-prepare.ts) — 상류 verdict 계약 (본 helper 가 그 성공분 `plan` 을 소비할 위치임을 확인).

## Acceptance Criteria

- [ ] `src/import/import-restore-order.ts` 에 `export type ImportRestorePhase = "insert" | "delete";` 를 추가하고, `orderImportRestoreEntities` 의 `phase` 파라미터 타입을 이 named type 으로 교체한다. **런타임 동작 변경 0** (기존 spec 전부 그대로 통과).
- [ ] `src/import/import-restore-ops.ts` 신설 — `ImportRestoreOperation` (`{ phase: ImportRestorePhase; entity: ExportEntity; records: ExportRecord[] }`) 과 `groupImportRestoreOperations(plan: ImportRestorePlan): ImportRestoreOperation[]` 를 export.
- [ ] 산출 순서 계약: **delete phase 그룹이 전부 앞, insert phase 그룹이 그 뒤**. 각 phase 안의 entity 순서는 `orderImportRestoreEntities` 결과를 그대로 따른다 (순서 상수·역순 배열을 본 파일에서 재선언 금지 — DRY, T-1261 상수 재사용).
- [ ] `toKeep` 은 operation 을 만들지 않는다 (삭제·삽입 대상이 아니므로). record 가 0 건인 entity 는 빈 그룹조차 만들지 않는다. 그룹 안 record 는 **입력 순서를 보존**한다.
- [ ] 순수·non-mutating — 입력 `plan` / 그 배열 / 원소를 변형하지 않고 (freeze 된 입력으로 호출해도 통과) 항상 새 배열·새 그룹 객체를 반환한다. DB · Prisma · `$transaction` · repository · file I/O · REST 배선 0.
- [ ] **happy-path unit test 1+** — replace 형태 plan (기존 전부 delete + incoming 전부 insert) 과 merge 형태 plan (일부 delete + 전부 insert + toKeep 존재) 각각에서 (phase, entity, records) 그룹 배열이 FK 안전 순서로 나오는지 검증 (`Person` 그룹이 insert 에서 `Assessment` 보다 앞, delete 에서는 뒤).
- [ ] **error path unit test 1+** — `plan` 이 null / undefined / 비-객체 → TypeError, `toDelete` 또는 `toInsert` 가 배열 아님 → TypeError, record 의 `entity` 가 5 literal 밖 값 (오타 / 소문자 / null / 숫자 / 객체) → 그 배열명과 index 를 담은 RangeError. 메시지는 한국어이며 record 원본·raw 를 메시지에 싣지 않는다 (REQ-032).
- [ ] **분기 cover** — phase 2 종 (delete / insert) × 그룹 존재/부재, `toKeep` 무시 경로, 빈 plan (세 배열 모두 빈 배열 → 빈 결과, error 아님), 단일 entity 만 있는 plan, 5 entity 전부 있는 plan 각 1+ test.
- [ ] **negative cases 충분 cover** — 예외 분기마다 1+: (a) 비-객체 plan 3 종 (null / undefined / 숫자), (b) `toDelete` 비-배열, (c) `toInsert` 비-배열, (d) delete 배열 원소 entity 위반, (e) insert 배열 원소 entity 위반, (f) 원소가 null / 원시값이라 `entity` 접근이 불가한 경우, (g) 검증 실패 시 **부분 결과를 돌려주지 않음** (throw 전 어떤 그룹도 반환되지 않음) 확인, (h) 입력 배열이 `Object.freeze` 여도 정상 동작 (non-mutating 증명), (i) 반환 배열을 호출자가 변형해도 다음 호출 결과가 오염되지 않음.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 신규 파일은 statement/branch/function/line 100% 목표 (동일 chain 선례 T-1255~T-1261 동형).
- [ ] `scripts/check-spec-presence.sh` 통과 — 신규 production `.ts` 마다 colocated spec 존재 (`src/import/import-restore-ops.spec.ts`).

## Out of Scope

- 실 `$transaction` 실행 · Prisma delegate 호출 · DB 접근 (다음 slice).
- `EXPORT_ENTITY_SOURCES` (export-job.service.ts module-private 매핑표) 의 공용 module 추출 — 별도 slice (Follow-ups 참조). 본 task 는 entity 이름만 다루며 Prisma model 이름을 알 필요가 없다.
- `import.controller.ts` 의 interim false-success guard 교체 · REST 배선 (chain 마지막 slice).
- `ImportRestorePlan` / `buildImportRestorePlan` 의 계약 변경, conflict key 규칙 변경.
- `orderImportRestoreEntities` 의 런타임 동작·throw 계약 변경 (본 task 는 타입 명명만).
- DB schema 변경 · migration · 새 외부 dependency 추가 (0 건).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (T-1261 reviewer round 2 NIT-1 이월) delegate 매핑 공용 module 추출 slice — `src/export/export-job.service.ts` 138~173행의 module-private `EXPORT_ENTITY_SOURCES` (ExportEntity → Prisma delegate) 를 공용 module 로 승격하고, `src/import/import-restore-order.spec.ts` 의 `ENTITY_TO_PRISMA_MODEL` 사본이 그 공용 상수를 import 하도록 전환. `$transaction` slice 의 prerequisite.
- (T-1261 reviewer round 2 MINOR-1 이월) `docs/architecture/estimate-model.md` sub-multiplier 박제 follow-up 에 T-1261 실측치 합산 — production 106 / spec 489 (nit-closure +221 포함) / 총 595, `sizeExempt` 근거였던 320 의 약 1.9배. **nit-closure 분량도 추정에 포함해야 한다**는 항목 추가.
- (T-1259~T-1261 이월, 미회수) `src/export/import-dump-validate.ts` 53 / 93행의 `generatedAt` issue 메시지가 "ISO 파싱 가능한 string" 이라고 적혀 있으나 실제 판정은 `new Date()` 파싱 기준 — 문구 정합 필요.
