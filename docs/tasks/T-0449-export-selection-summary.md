---
id: T-0449
title: UC-07 Export 선별 결과 영향 breakdown 요약 순수 helper summarizeExportSelection
phase: P7
status: DONE
completedAt: 2026-06-17T00:53:00Z
mergedAs: 7e555c4
reviewRounds: 1
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 170
estimatedFiles: 2
created: 2026-06-16
independentStream: export-import
dependsOn: []
touchesFiles:
  - src/export/export-selection-summary.ts
  - src/export/export-selection-summary.spec.ts
hqOrigin: null
prNumber: 360
plannerNote: "P7 R-57/REQ-030 — UC-07 Export/Import 열두 번째 게이트-free 단추(selectExportRecords 산출 selected/excluded entity-별 breakdown 요약), pr, dependsOn []"
---

# T-0449 — UC-07 Export 선별 결과 영향 breakdown 요약 순수 helper summarizeExportSelection

## Why

PLAN.md P7 "Import / export / restore (R-57)" bullet 의 게이트-free building block stream
(selectExportRecords → buildExportDump → checkSchemaVersionCompat → validateImportDumpStructure →
summarizeImportImpact → buildImportRestorePlan → buildExportImportAuditEntry → validateExportScope →
상수 DRY → computeDumpChecksum/verifyDumpChecksum → summarizeRestorePlan) 11개 완비 후 다음
게이트-free 단추다. **Import 측에는 영향 요약 helper 두 개(`summarizeImportImpact` T-0441 — dump
입력 / `summarizeRestorePlan` T-0448 — plan 의 3 배열 입력)가 있지만, Export 측의 대칭 helper 는
부재** — `selectExportRecords`(T-0437) 가 산출한 `ExportSelection`(`{selected, excluded}` 두 배열)
은 두 배열을 통째로 들고 있을 뿐, UC-07 §3 trigger 1 의 **사용자 confirmation dialog ("Export 는
scope 옵션 선택")** 와 §5 step 2(WebUI confirmation, scope 옵션 확인) + §8 (b) Audit log row
("Export 종류 + actor + scope + **row count**") 가 필요로 하는 **선별/제외 row 의 entity-별 +
전체 breakdown + 시간 범위** 를 0회 derive 한다. `buildExportDump`(T-0438)는 envelope `entityCounts`
(selected 만) + `recordCount` 단일 metadata 만 노출하고 excluded 분포·instant 범위는 노출 0.
본 task 는 그 gap 을 순수 derivation 으로 박제한다 — `ExportSelection` 을 받아 `{selected, excluded}`
각각의 total + perEntity(5 entity) breakdown + selected 의 instantRange(earliest/latest 또는 null)
를 산출하는 순수 함수다. persistence/repository/transaction/REST 호출 0, 새 도메인 타입 신설 0
(`ExportSelection`/`ExportEntity`/`ExportRecord` 재사용), 새 외부 dependency 0. REQ-032(raw 미저장)는
입력 selection 의 record 만 집계하고 raw 를 새로 fetch 하지 않으므로 helper layer 에서 자연 유지된다.

## Required Reading

- `docs/use-cases/UC-07-export-import.md` — §3 trigger 1 (사용자 confirmation dialog, Export 는 scope
  옵션 선택) / §5 step 2 / §6.1 (Export scope 옵션) / §8 (b) (Audit row count). 본 helper 가 cover
  하는 conceptual source.
- `src/export/export-scope-select.ts` — `selectExportRecords`(T-0437) 가 산출하는 `ExportSelection`
  interface(`selected`/`excluded` 두 배열) + `ExportEntity`(5 entity union) + `ExportRecord`
  (`{entity, instant}`) 타입 source. 본 helper 의 입력 타입 — 재사용한다.
- `src/export/import-restore-preview.ts` — `summarizeImportImpact`(T-0441) 의 순수-helper 패턴
  (plain 요약 interface + perEntity 5 entity 0-init map + `instantRange{earliest,latest}|null` +
  non-mutating + `assertValidDate` 한국어 메시지 convention + 빈 입력 정상). 본 helper 의 골격 mirror
  대상 (Import 의 단일 dump → Export 의 두 그룹 selected/excluded 으로 확장).
- `src/export/import-restore-plan-summary.ts` — `summarizeRestorePlan`(T-0448) 의 "두 개 이상 그룹
  breakdown" 골격 (`summarizeGroup` 내부 helper + 그룹 별 `{total, perEntity}` 반환 패턴). 본 helper
  도 selected/excluded 두 그룹에 대해 동일 패턴 적용.
- `src/export/import-restore-preview.spec.ts` (colocated spec 위치 참고) — 신규 spec 은
  `src/export/export-selection-summary.spec.ts` (colocated) 에 둔다.

## Acceptance Criteria

- [ ] `src/export/export-selection-summary.ts` 신설 — `summarizeExportSelection(selection: ExportSelection)`
      함수 + 반환 `ExportSelectionSummary` plain interface export. `{selected, excluded}` 두 그룹 각각
      `{total: number, perEntity: Record<ExportEntity, number>, instantRange: {earliest: Date, latest: Date} | null}`
      형태(5 entity 전부 key 인 0-init perEntity, 빈 그룹의 instantRange 는 null), `export-scope-select.ts`
      의 `ExportSelection`/`ExportEntity`/`ExportRecord` 재사용(새 도메인 타입/새 dependency 0).
- [ ] UC-07 §6.1 정합: full scope(excluded 빈 배열) → excluded.total=0 + perEntity 전부 0 + instantRange null,
      range scope(부분 selected/excluded) → 두 그룹 정확 분배, partial scope → entity 별 분배 정확. perEntity
      는 record 1회 순회 entity-별 집계(records 가 ground truth, entityCounts metadata 와 별개).
- [ ] non-mutating — freeze 된 selection/배열로 호출해도 통과, 입력 배열·원소 변형 0, 반환 map/instantRange
      는 새 객체.
- [ ] happy-path unit test 1+ — full(excluded 빈)/range(두 그룹 모두 비어있지 않음)/partial 각각 + 빈 selection
      (두 배열 모두 빈) 각각 total + perEntity + instantRange 정확 산출 검증.
- [ ] error path unit test 1+ — selection 이 plain object 아님(null/배열/비-object) → TypeError, 두 배열 중
      하나가 배열 아님 → TypeError(어느 배열인지 명시), record 원소 instant 가 비-Date/Invalid Date → 그 index
      메시지 TypeError.
- [ ] flow / branch test — 각 그룹(selected/excluded) 비어있는 경우와 비어있지 않은 경우 4 조합 분기, 5
      entity 가 섞인 record 집합에서 perEntity 정확 분배, entity 가 5 허용 외 값일 때 perEntity 무시(누락
      0, T-0440 검증 책임 위임), 단일 record 그룹의 instantRange earliest===latest 경계 각 분기 1+ test.
- [ ] negative cases 충분 cover — null/undefined selection, 두 배열 각각 비-배열(string/number/object),
      instant 가 string/number/NaN-Date/null, 단일 record 그룹 경계, 5 entity 전부 섞인 대량 record, 중복
      entity 누적, instantRange earliest/latest 동일 instant, 정렬되지 않은 instant 배열에서도 정확한 min/max
      추출 — 예외 처리 분기마다 각 1+ test (단일 negative 만 작성 금지).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 파일은 line/branch/func 100% cov 목표
      (선례 T-0441/T-0448 동형 100% 유지).
- [ ] `pnpm lint && pnpm build && pnpm test` green (tester 가 실행 결과 확인 — R-110).

## Out of Scope

- 실 transaction / repository / DB query / Prisma 호출 — 게이트된 후속 sub-slice (schema/repository 게이트).
- REST controller(GET /api/admin/export · POST /api/admin/restore) 배선 — repository 게이트.
- `selectExportRecords` 의 분류 로직 재구현 — 본 helper 는 selection 을 입력으로만 받는다(재구현 0).
- `buildExportDump` 의 envelope 조립 — 본 helper 는 dump 생성 전 selection 단계 요약만 (dump envelope
  의 `entityCounts`/`recordCount` 는 selected 만 기반, 본 helper 는 excluded + instantRange 추가).
- 새 도메인 타입 신설(`ExportSelection`/`ExportEntity`/`ExportRecord` 재사용만) · 새 외부 dependency.
- confirmation dialog UI / Web UI 표시 — WebModule 후속 영역.
- Audit log row insert / 영속 — `buildExportImportAuditEntry`(T-0443) + 게이트된 후속 책임.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시 비어있음)
