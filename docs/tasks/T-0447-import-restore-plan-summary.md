---
id: T-0447
title: UC-07 Import 복원 plan 영향 breakdown 요약 순수 helper summarizeRestorePlan
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 160
estimatedFiles: 2
created: 2026-06-17
independentStream: export-import
dependsOn: []
touchesFiles:
  - src/export/import-restore-plan-summary.ts
  - src/export/import-restore-plan-summary.spec.ts
plannerNote: "P7 R-57/REQ-030 — UC-07 Export/Import 열한 번째 게이트-free 단추(restore plan delete/insert/keep entity-별 breakdown 요약), pr, dependsOn []"
---

# T-0447 — UC-07 Import 복원 plan 영향 breakdown 요약 순수 helper summarizeRestorePlan

## Why

PLAN.md P7 "Import / export / restore (R-57)" bullet 의 게이트-free building block stream
(selectExportRecords → buildExportDump → checkSchemaVersionCompat → validateImportDumpStructure →
summarizeImportImpact → buildImportRestorePlan → buildExportImportAuditEntry → validateExportScope →
상수 DRY → computeDumpChecksum/verifyDumpChecksum) 10개 완비 후 다음 게이트-free 단추다.
`buildImportRestorePlan`(T-0442)이 산출한 `{toDelete, toInsert, toKeep}` plan 은 세 배열을 통째로
들고 있을 뿐, UC-07 §5 step 7 의 **강한 confirmation dialog ("destructive 명시 + 영향 범위")** 와
§8 (e) Audit row 가 필요로 하는 **삭제/삽입/보존 row 의 entity-별 + 전체 breakdown** 을 0회 derive
한다 — `buildExportImportAuditEntry`(T-0443)는 `plan.toInsert.length` 단일 rowCount 만 쓰고
delete/keep 분포는 노출하지 않는다. 본 task 는 그 gap 을 순수 derivation 으로 박제한다 —
`ImportRestorePlan` 을 받아 `{deleted, inserted, kept}` 각각의 total + perEntity(5 entity) breakdown
을 산출하는 순수 함수다. persistence/repository/transaction/REST 호출 0, 새 도메인 타입 신설 0
(`ImportRestorePlan`/`ExportEntity` 재사용), 새 외부 dependency 0. REQ-032(raw 미저장)는 입력 plan
의 record 만 집계하고 raw 를 새로 fetch 하지 않으므로 helper layer 에서 자연 유지된다.

## Required Reading

- `docs/use-cases/UC-07-export-import.md` — §5 step 7 (강한 confirmation, 영향 범위 표시) / §6.2
  (replace/merge mode) / §8 (e) (Audit 복원 row count). 본 helper 가 cover 하는 conceptual source.
- `src/export/import-restore-plan.ts` — `buildImportRestorePlan`(T-0442) 가 산출하는
  `ImportRestorePlan` interface(`toDelete`/`toInsert`/`toKeep`) + `ImportRestoreMode` + 입력 방어
  convention. 본 helper 의 입력 타입 source — 재사용한다.
- `src/export/import-restore-preview.ts` — `summarizeImportImpact`(T-0441) 의 순수-helper 패턴
  (plain 요약 interface + perEntity 5 entity 0-init + non-mutating + `assertValidDate` 한국어 메시지
  convention + 빈 입력 정상). 본 helper 의 골격 mirror 대상.
- `src/export/export-scope-select.ts` — `ExportEntity`(5 entity union) + `ExportRecord` 타입 재사용
  source (`{entity, instant}`).
- `src/export/import-restore-preview.spec.ts` (colocated spec 위치 참고) — 신규 spec 은
  `src/export/import-restore-plan-summary.spec.ts` (colocated) 에 둔다.

## Acceptance Criteria

- [ ] `src/export/import-restore-plan-summary.ts` 신설 — `summarizeRestorePlan(plan: ImportRestorePlan)`
      함수 + 반환 `RestorePlanSummary` plain interface export. `{deleted, inserted, kept}` 3 그룹 각각
      `{total: number, perEntity: Record<ExportEntity, number>}` 형태(5 entity 전부 key 인 0-init map),
      `import-restore-plan.ts` 의 `ImportRestorePlan` + `export-scope-select.ts` 의 `ExportEntity`
      재사용(새 도메인 타입/새 dependency 0).
- [ ] UC-07 §6.2 정합: replace plan(toKeep 빈 배열) → kept.total=0, merge plan → kept breakdown 반영.
      perEntity 는 plan 의 record 1회 순회 entity-별 집계(records 가 ground truth).
- [ ] non-mutating — freeze 된 plan/배열로 호출해도 통과, 입력 배열·원소 변형 0, 반환 map 은 새 객체.
- [ ] happy-path unit test 1+ — replace plan / merge plan / 빈 plan(세 배열 모두 빈) 각각 total +
      perEntity 정확 산출 검증.
- [ ] error path unit test 1+ — plan 이 plain object 아님(null/배열/비-object) → TypeError, 세 배열 중
      하나가 배열 아님 → TypeError, record 원소 instant 가 비-Date/Invalid Date → 그 index 메시지 TypeError.
- [ ] flow / branch test — 각 그룹(deleted/inserted/kept) 비어있는 경우와 비어있지 않은 경우 분기, 5
      entity 가 섞인 record 집합에서 perEntity 정확 분배, entity 가 5 허용 외 값일 때 perEntity 무시(누락
      0, T-0440 검증 책임 위임) 각 분기 1+ test.
- [ ] negative cases 충분 cover — null/undefined plan, 세 배열 각각 비-배열(string/number/object),
      instant 가 string/number/NaN-Date/null, 단일 record 그룹 경계, 5 entity 전부 섞인 대량 record,
      중복 entity 누적 — 예외 처리 분기마다 각 1+ test (단일 negative 만 작성 금지).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 파일은 line/branch/func 100% cov 목표
      (선례 T-0441/T-0442 동형 100% 유지).
- [ ] `pnpm lint && pnpm build && pnpm test` green (tester 가 실행 결과 확인 — R-110).

## Out of Scope

- 실 transaction / repository / DB delete-insert / Prisma 호출 — 게이트된 후속 sub-slice (schema/repository 게이트).
- REST controller(GET /api/admin/export · POST /api/admin/restore) 배선 — repository 게이트.
- `buildImportRestorePlan` 의 plan 산출 로직 재구현 — 본 helper 는 plan 을 입력으로만 받는다(재구현 0).
- 새 도메인 타입 신설(ImportRestorePlan/ExportEntity/ExportRecord 재사용만) · 새 외부 dependency.
- confirmation dialog UI / Web UI 표시 — WebModule 후속 영역.
- Audit log row insert / 영속 — `buildExportImportAuditEntry`(T-0443) + 게이트된 후속 책임.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시 비어있음)
