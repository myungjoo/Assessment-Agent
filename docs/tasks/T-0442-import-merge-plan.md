---
id: T-0442
title: UC-07 Import merge/replace mode 복원 plan 산출 순수 helper buildImportRestorePlan
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 165
estimatedFiles: 2
created: 2026-06-16
independentStream: export-import
dependsOn: []
touchesFiles:
  - src/export/import-restore-plan.ts
  - src/export/import-restore-plan.spec.ts
plannerNote: "P7 R-57 게이트-free 6번째 단추 — UC-07 §6.2 replace/merge mode 복원 plan 순수 derivation (DB/transaction 0)"
---

# T-0442 — UC-07 Import merge/replace mode 복원 plan 산출 순수 helper buildImportRestorePlan

## Why

PLAN P7 "Import/export/restore (R-57)" 의 게이트-free building block chain (T-0437 selectExportRecords → T-0438 buildExportDump → T-0439 checkSchemaVersionCompat → T-0440 validateImportDumpStructure → T-0441 summarizeImportImpact) 의 다음 자연 단추다. 구조 검증 (T-0440) 과 영향 요약 (T-0441) 을 통과한 dump 를 실제 transaction 으로 복원하기 직전, **어떤 record 를 삭제 / 삽입 / 보존할지** 를 결정하는 것이 UC-07 §6.2 의 replace / merge mode 정책이다. 본 task 는 그 결정 로직을 **순수 derivation** 으로 박제한다 — 메모리에 올라온 기존 record 배열 + import dump 의 record 배열 + mode (replace default / merge) 를 받아 `{toDelete, toInsert, toKeep}` plan 을 산출하는 순수 함수. 실 transaction / repository / DB delete-insert 배선은 게이트된 후속 sub-slice 책임 (UC-07 §5 step 7·11, §6.2, §8 (a)). REQ-032 (raw 미저장) 는 본 helper 가 입력 record 만 다루고 raw 를 새로 fetch 하지 않으므로 helper layer 에서 자연 유지된다.

## Required Reading

- `docs/use-cases/UC-07-export-import.md` — §3 trigger 2 (Import/Restore), §6.2 (merge 옵션: replace mode default / merge mode + conflict 시 file 우선 or reject), §8 (b) Import postcondition, §1 invariant (b) atomic transaction.
- `src/export/export-scope-select.ts` — `ExportEntity` / `ExportRecord` 타입 정의 (재사용, 새 타입 신설 0) + `assertValidDate` message convention.
- `src/export/import-restore-preview.ts` — 직전 단추 (T-0441) 의 helper-먼저 패턴 mirror: plain 결과 interface + non-mutating + 입력 방어 (비-object/비-배열/Invalid Date TypeError) + isPlainObject 헬퍼.
- `src/export/export-dump.ts` — `ExportDump` 타입 (import dump 의 records payload source) + 조립 helper 패턴 (building block 재사용 + 빈 입력 정상).

## Acceptance Criteria

본 task 는 `commitMode: pr` 코드 task 이므로 R-112 4 항목 + coverage 최소치를 모두 만족한다.

- [ ] `src/export/import-restore-plan.ts` 신설 — `buildImportRestorePlan(existing: ReadonlyArray<ExportRecord>, incoming: ReadonlyArray<ExportRecord>, mode: "replace" | "merge")` 순수 함수. 결과 plain interface `ImportRestorePlan { toDelete: ExportRecord[]; toInsert: ExportRecord[]; toKeep: ExportRecord[] }` export.
  - **replace mode (default)**: 기존 record 전부 `toDelete`, incoming record 전부 `toInsert`, `toKeep` 빈 배열 (UC-07 §6.2 "기존 row 모두 삭제 후 file snapshot 으로 복원").
  - **merge mode**: 기존 record 전부 `toKeep`, incoming record 중 기존과 충돌하지 않는 것만 `toInsert`, conflict (같은 entity + 같은 instant millis 의 record 가 기존에 존재) 인 incoming record 는 file 우선 정책에 따라 기존을 `toDelete` + incoming 을 `toInsert` (UC-07 §6.2 "conflict 시 file 우선"). 충돌 판정 key 는 `entity` + `instant.getTime()` 조합.
  - 모든 출력 배열은 입력 순서를 보존하고 non-mutating (freeze 된 입력으로 호출해도 통과, 입력 배열·원소 변형 0).
- [ ] **Happy-path unit test 1+**: replace mode (기존 N개 + incoming M개 → toDelete N / toInsert M / toKeep 0), merge mode 충돌 없음 (기존 전부 toKeep + incoming 전부 toInsert), merge mode 충돌 있음 (충돌 기존은 toDelete + incoming 으로 교체, 비충돌 기존은 toKeep) 각각 검증.
- [ ] **Error path unit test 1+**: `existing` 또는 `incoming` 이 배열 아님 → TypeError (한국어 메시지), record 원소의 `instant` 가 비-Date / Invalid Date → 그 index 를 담은 TypeError, `mode` 가 "replace"/"merge" 외 값 → RangeError.
- [ ] **Flow / branch cover**: replace 분기 / merge 분기 / merge 안의 충돌-있음·충돌-없음 분기 각 1+ test. 빈 입력 경계 (existing []·incoming [] 조합 — replace 빈 toDelete, merge 빈 toInsert) test.
- [ ] **Negative cases 충분 cover**: 각 예외 분기마다 1+ — 비-배열 existing, 비-배열 incoming, 단일/다중 Invalid Date instant (index 메시지 정확), 잘못된 mode 값 (null/숫자/대소문자 mismatch 포함), 같은 instant 다른 entity (충돌 아님 검증), 동일 record 가 incoming 에 중복 등장 시 동작, 기존·incoming 완전 동일 set (merge 시 전부 충돌 교체). non-mutating 검증 (Object.freeze 입력 통과 + 원본 배열 length/원소 불변).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 파일은 selectExportRecords/buildExportDump/summarizeImportImpact 동형으로 100% 지향.
- [ ] `pnpm lint && pnpm build && pnpm test` green (tester 가 확인, R-110).

## Out of Scope

- 실 transaction / repository / DB delete-insert / Prisma 호출 — schema/repository 게이트 (CLAUDE.md §5), 게이트된 후속 sub-slice 책임.
- file parse / JSON.parse / 압축 archive 해제 / 무결성 hash — 본 helper 는 이미 메모리에 올라온 record 배열만 다룬다.
- schema version 호환 판정 (T-0439 책임) / 구조 무결성 전체 검증 (T-0440 책임) — 본 helper 는 그 두 gate 통과를 전제하되 최소 입력 방어만 한다.
- PK 기반 dedupe / timestamp 비교 / 복잡한 conflict resolution 알고리즘 (UC-07 §6.2 "P5 service layer 책임") — 본 helper 는 entity+instant millis 단순 key 충돌 + file 우선 default 만 박제.
- REST controller / endpoint 배선 / GET /api/admin/export / POST /api/admin/restore — repository 게이트, 후속.
- 새 dependency / package.json 변경 / DB schema 변경 — 발생 시 BLOCKED.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점)
