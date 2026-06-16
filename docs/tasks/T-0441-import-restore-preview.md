---
id: T-0441
title: UC-07 Import restore 영향 범위 요약 순수 helper summarizeImportImpact
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 160
estimatedFiles: 2
created: 2026-06-16
independentStream: export-import-helpers
dependsOn: []
touchesFiles:
  - src/export/import-restore-preview.ts
  - src/export/import-restore-preview.spec.ts
plannerNote: "P7 R-57 UC-07 §5 step 7/§8(e) — 구조 검증 통과 dump 의 restore 영향 범위 요약 순수 helper, 게이트-free, T-0437~T-0440 helper-먼저 mirror"
---

# T-0441 — UC-07 Import restore 영향 범위 요약 순수 helper summarizeImportImpact

## Why

T-0437 `selectExportRecords`(scope 선별) → T-0438 `buildExportDump`(dump envelope 조립) → T-0439 `checkSchemaVersionCompat`(Import 입구 version gate) → T-0440 `validateImportDumpStructure`(구조 무결성 gate) 네 building block 다음의 자연스러운 다음 단추다. 구조 검증을 통과한 dump 가 **transaction 시작 전에** 사용자에게 보여줄 **영향 범위 요약**(restore 시 entity 별 복원 row 수 · 전체 row 수 · 시간 범위)을 산출하는 순수 helper 를 추가한다 ([UC-07](../use-cases/UC-07-export-import.md) §5 step 7 "강한 confirmation — destructive 명시 + 영향 범위", §8 (e) Audit metadata "복원된 row count"). 

destructive 한 replace mode (§3 trigger 2, §6.2) 의 강한 confirmation dialog 는 "기존 데이터 삭제 경고 + 영향 범위" 를 표시해야 하는데, 그 영향 범위는 구조-검증된 `ExportDump` envelope 에서 **순수 derivation** 으로 계산 가능하다 — entityCounts 를 검증·정규화한 per-entity 요약 + records 의 instant 시간 범위(earliest / latest) + 총 row 수. persistence / repository / DB query / transaction / file parse / REST 배선 호출 0 인 게이트-free 단추다(README "평가 자료의 저장" — REQ-030, REQ-032).

REQ-032(raw 미저장)는 본 helper 가 envelope 의 count / instant metadata 만 다루고 raw 를 새로 fetch 하지 않으므로 layer 에서 자연 유지된다.

## Required Reading

- `docs/use-cases/UC-07-export-import.md` — §5 step 7 (강한 confirmation, 영향 범위 표시), §6.2 (replace mode default — 기존 row 삭제), §8 (e)(Import Audit log row 의 복원 row count), §8 NFR (dump size 비례).
- `src/export/export-dump.ts` — `ExportDump` / `ExportDumpMeta` / `EXPORT_SCHEMA_VERSION` / `ALL_ENTITIES`(5 entity) 정의. 본 helper 의 입력 envelope 의 **정방향 생성자** — entityCounts 5 key·recordCount·records 의 shape source-of-truth.
- `src/export/export-scope-select.ts` — `ExportEntity` / `ExportRecord`(`{ entity, instant }`) 타입. 본 helper 가 시간 범위·entity 집계에 쓸 record shape.
- `src/export/import-dump-validate.ts` — 직전 helper(T-0440). 본 helper 는 **구조 검증을 통과한 dump 를 전제** 로 동작하나, 입력 방어를 위해 `validateImportDumpStructure` 를 호출하거나 동형 최소 검증을 수행한다(아래 Acceptance Criteria 참조). 순수-helper 골격(plain verdict interface + non-mutating + 한국어 메시지 convention) mirror 대상.
- `src/export/import-dump-validate.spec.ts` — spec 골격(R-112 4 종 describe 구조, freeze 통과 non-mutating 검증, negative 분기별 it) mirror 대상.

## Acceptance Criteria

- [ ] `src/export/import-restore-preview.ts` 신설 — 순수 함수 `summarizeImportImpact(dump: ExportDump): ImportImpact` export. plain 요약 interface (`ImportImpact`) 와 함께 export — 형태 예: `{ totalRecords: number; perEntity: Record<ExportEntity, number>; instantRange: { earliest: Date; latest: Date } | null }`(records 가 비어있으면 `instantRange = null`). 입력 인자를 변형하지 않음(non-mutating). persistence / repository / file parse / transaction / REST 호출 0(import 는 `export-dump.ts` / `export-scope-select.ts` 의 타입·상수, 그리고 필요 시 `import-dump-validate.ts` 의 검증 함수만).
- [ ] 산출 규칙(UC-07 §5 step 7 / §8 (e) 정합):
  - `totalRecords` = `dump.records.length`(또는 검증된 recordCount). 빈 dump 시 0.
  - `perEntity` = 5 entity(ALL_ENTITIES) 전부 key 를 가진 number map — `dump.records` 를 1 회 순회해 entity 별 집계(누락 key 없이 0 초기화 후 +1). entityCounts metadata 와 별개로 **records 실측** 으로 집계(구조 검증 통과 dump 라면 둘이 일치하지만 본 helper 는 records 가 ground truth).
  - `instantRange` = records 의 instant 중 earliest / latest(Date 쌍). 빈 records → null.
  - 입력 records / dump 를 변형하지 않으며(non-mutating), 입력 순서·원본 instant Date 객체를 복제하지 않고 그대로 참조해도 무방하나 반환 map 은 새 객체.
- [ ] 입력 방어(transaction 전 안전) — `dump` 가 구조적으로 부적합(비-object / records 비-배열 / instant 가 유효 Date 아님)이면 명시적 `TypeError`(한국어 메시지, `assert*` convention mirror) 또는 `validateImportDumpStructure` 위임 후 invalid 시 throw. happy-path 는 구조 검증 통과 dump 를 전제하므로 방어 분기는 negative test 로 cover.
- [ ] Happy-path unit test 1+ — `buildExportDump` 가 만든 정상 envelope(다수 entity 혼합 records)로 호출 시 `totalRecords` / `perEntity`(5 key 합계 정합) / `instantRange`(earliest < latest) 정확 산출. 빈 records envelope → `totalRecords=0` / `perEntity` 전부 0 / `instantRange=null`.
- [ ] Error/negative path unit test 충분 cover — 비-object dump · `records` 비-배열 · records 원소의 instant 가 Invalid Date / 비-Date · 단일 record(earliest === latest 경계) · 단일 entity 만 존재(나머지 4 key 0) · 동일 instant 다수 record. 각 위반이 TypeError 또는 적절한 결과를 내는지 검증.
- [ ] Flow / branch coverage — 빈 records 분기(instantRange null) + 비어있지 않은 분기(earliest/latest 계산) + entity 별 집계 분기 + 입력 방어 throw 분기 각 1+ test.
- [ ] non-mutating 검증 — `Object.freeze` 된 dump / records 입력으로 호출해도 통과(입력 변형 0).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 `import-restore-preview.ts` 는 100% 목표(순수 함수). 전체 test green.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] colocated spec — `src/export/import-restore-preview.spec.ts` (NestJS convention + 기존 export helper 4개와 동일 colocated 배치).

## Out of Scope

- 실제 transaction / 기존 row 삭제 / file snapshot 재구성(UC-07 §5 Import 분기 · §7.5) — repository/schema 게이트, 본 task 0. 본 helper 는 "삭제 전 영향 미리보기" 만 산출.
- merge mode 의 conflict 영향 계산(§6.2 — 기존 row 와의 PK 충돌 / dedupe) — P5 service layer 책임. 본 helper 는 replace mode 의 단순 복원 row 수만 요약.
- schema version 호환 판정 — T-0439 `checkSchemaVersionCompat` 책임.
- dump 구조 무결성 전체 검증 — T-0440 `validateImportDumpStructure` 책임(본 helper 는 그 통과를 전제 + 최소 입력 방어만).
- Audit log row 의 실제 영속 / actor / file source 기록 — repository 게이트, 별도 task.
- REST controller(`POST /api/admin/restore`) 배선 / multipart 처리 / confirmation dialog UI — repository/web 게이트, 별도 task.
- STATE.json / journal 갱신(driver 의 bookkeeping commit 책임).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시 비어있음)
