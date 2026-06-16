---
id: T-0440
title: UC-07 Import dump 구조 무결성 검증 순수 helper validateImportDumpStructure
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 170
estimatedFiles: 2
created: 2026-06-16
independentStream: export-import-helpers
dependsOn: []
touchesFiles:
  - src/export/import-dump-validate.ts
  - src/export/import-dump-validate.spec.ts
plannerNote: "P7 R-57 UC-07 §7.4 — Import 입구 dump 구조 무결성 검증 순수 helper(buildExportDump envelope 역방향), 게이트-free, T-0437/38/39 helper-먼저 mirror"
---

# T-0440 — UC-07 Import dump 구조 무결성 검증 순수 helper validateImportDumpStructure

## Why

T-0437 `selectExportRecords`(scope 선별) → T-0438 `buildExportDump`(dump envelope 조립, 직렬화 방향) → T-0439 `checkSchemaVersionCompat`(Import 입구 version gate) 세 building block 다음의 자연스러운 다음 단추다. version gate 를 통과한 업로드 dump 가 **transaction 시작 전에** 본 시스템 dump 포맷의 구조 무결성을 갖췄는지 판정하는 순수 helper 를 추가한다 ([UC-07](../use-cases/UC-07-export-import.md) §7.4 "Import file 손상 → transaction 시작 전 reject (DB 변경 0)", §5 step 7 payload 검증). `buildExportDump` 가 만든 `ExportDump` envelope 의 **역방향 검증** — schemaVersion / generatedAt / scope / entityCounts(5 entity 전부 key) / recordCount / records 의 shape 와 상호 정합(예: recordCount === records.length, entityCounts 합계 === recordCount)을 plain verdict 로 반환한다. persistence / repository / DB query / file parse / 압축 해제 / transaction / REST 배선 호출 0 인 게이트-free 단추다(README "평가 자료의 저장" — REQ-030, REQ-032).

REQ-032(raw 미저장)는 본 helper 가 envelope 구조만 검증하고 raw 를 새로 fetch 하지 않으므로 layer 에서 자연 유지된다.

## Required Reading

- `docs/use-cases/UC-07-export-import.md` — §5 step 7(payload 검증), §6.3(schema version), §7.3·§7.4(payload 검증 실패 / file 손상 → transaction 전 reject), §8 (b)(Import raw 미저장 자연 유지).
- `src/export/export-dump.ts` — `ExportDump` / `ExportDumpMeta` / `EXPORT_SCHEMA_VERSION` / `ALL_ENTITIES`(5 entity) 정의. 본 helper 가 검증할 envelope 의 **정방향 생성자**. 검증 규칙(entityCounts 5 key·recordCount === records.length·entity 허용 값)의 source-of-truth.
- `src/export/export-scope-select.ts` — `ExportEntity` / `ExportRecord` / `ExportScope` 타입. 본 helper 의 record-shape 검증 대상.
- `src/export/schema-version-compat.ts` — 직전 helper(T-0439). 순수-helper 골격(plain verdict interface + `assert*` TypeError 분기 메시지 convention + non-mutating + EXPORT_SCHEMA_VERSION 재사용)을 mirror 할 패턴 source.
- `src/export/schema-version-compat.spec.ts` — spec 골격(R-112 4 종 describe 구조, freeze 통과 non-mutating 검증, negative 분기별 it) mirror 대상.

## Acceptance Criteria

- [ ] `src/export/import-dump-validate.ts` 신설 — 순수 함수 `validateImportDumpStructure(dump: unknown): ImportDumpValidation` export. plain verdict interface(`{ valid: boolean; issues: string[] }` 형태 — `issues` 는 한국어 위반 메시지 배열, valid 시 빈 배열) 와 함께 export. 입력 인자를 변형하지 않음(non-mutating). persistence / repository / file parse / transaction / REST 호출 0(import 는 `export-dump.ts` / `export-scope-select.ts` 타입·상수만).
- [ ] 검증 규칙(UC-07 §7.4 정합, 구조 무결성):
  - top-level 가 plain object 아님(null / 배열 / 비-object) → invalid + 명시 issue.
  - `schemaVersion` 이 비어있지 않은 string 아님 → invalid issue.
  - `generatedAt` 이 ISO 파싱 가능한 string 아님(빈 / 비-string / Invalid Date) → invalid issue.
  - `records` 가 배열 아님 → invalid issue. 배열이면 각 원소가 `{ entity, instant }` shape 인지·entity 가 5 허용 값(ALL_ENTITIES)인지 검증, 위반 원소는 그 index 를 담은 issue.
  - `entityCounts` 가 5 entity 전부 key 를 가진 number map 아님 → invalid issue.
  - 상호 정합: `recordCount !== records.length` → issue, `entityCounts` 합계 !== `recordCount` → issue.
  - 위반 0 이면 `{ valid: true, issues: [] }`. 여러 위반 동시 누적 가능(issues 배열에 모두 박제 — early-throw 아님, transaction 전 한 번에 안내).
- [ ] Happy-path unit test 1+ — `buildExportDump` 가 만든 정상 envelope(빈 records / 다수 entity 혼합 records 두 케이스)가 `{ valid: true, issues: [] }` 반환.
- [ ] Error/negative path unit test 충분 cover — 위 각 위반 규칙(top-level 비-object · schemaVersion 누락/빈 · generatedAt Invalid · records 비-배열 · 원소 shape 위반 · entity 허용 외 값 · entityCounts key 누락 · recordCount 불일치 · entityCounts 합계 불일치)별 1+ test, 각 위반이 해당 issue 를 포함하는지 검증. 다중 위반 동시 누적 케이스 1+.
- [ ] Flow / branch coverage — valid 분기 + 각 invalid 분기 + 다중 위반 누적 분기 각 1+ test로 cover.
- [ ] non-mutating 검증 — `Object.freeze` 된 dump / records 입력으로 호출해도 통과(입력 변형 0).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 `import-dump-validate.ts` 는 100% 목표(순수 함수). 전체 test green.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] colocated spec — `src/export/import-dump-validate.spec.ts` (NestJS convention + 기존 export helper 3개와 동일 colocated 배치).

## Out of Scope

- 실제 file parse / JSON.parse / 압축 archive 해제 / 무결성 hash(SHA) 검증 — 본 helper 는 이미 파싱된 plain object 의 **구조** 만 검증(byte-level 무결성은 후속 배선 책임).
- schema version 호환 판정 — T-0439 `checkSchemaVersionCompat` 책임(본 helper 는 schemaVersion 의 string-shape 만, accept/migrate/reject 판정 0).
- transaction / 기존 row 삭제 / file snapshot 재구성(UC-07 §5 Import 분기 · §7.5) — repository/schema 게이트, 본 task 0.
- REST controller(`POST /api/admin/restore`) 배선 / multipart 처리 — repository 게이트, 별도 task.
- merge mode / conflict resolution(§6.2) — P5 service layer 책임.
- STATE.json / journal 갱신(driver 의 bookkeeping commit 책임).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시 비어있음)
