---
id: T-0443
title: UC-07 Export/Import Audit log 항목 조립 순수 helper buildExportImportAuditEntry
phase: P7
status: DONE
completedAt: 2026-06-16T11:51:23Z
mergedAs: abc59f4
prNumber: 354
reviewRounds: 1
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 165
estimatedFiles: 2
created: 2026-06-16
independentStream: export-import
dependsOn: []
touchesFiles:
  - src/export/export-import-audit.ts
  - src/export/export-import-audit.spec.ts
plannerNote: "P7 R-57 게이트-free 7번째 단추 — UC-07 §8 (b)/(e) Export·Import Audit log 항목 순수 조립 (DB/persistence 0)"
---

# T-0443 — UC-07 Export/Import Audit log 항목 조립 순수 helper buildExportImportAuditEntry

## Why

PLAN P7 "Import/export/restore (R-57)" 의 게이트-free building block chain (T-0437 selectExportRecords → T-0438 buildExportDump → T-0439 checkSchemaVersionCompat → T-0440 validateImportDumpStructure → T-0441 summarizeImportImpact → T-0442 buildImportRestorePlan) 의 다음 자연 단추다. 이 6 개 단추는 Export 선별·조립과 Import 검증·복원 plan 까지 cover 했으나, **UC-07 §8 (b) Export Audit row** 와 **§8 (e) Import Audit row** — 두 분기 모두에서 의무인 "Audit log 1 row 생성 (operation 종류 + actor + scope/file source + row count)" 는 아직 아무 helper 도 cover 하지 않는다 (§8 (b) Export postcondition, §8 (e) Import postcondition, §5 step 12 `Audit log row insert`). 본 task 는 그 audit 항목을 **순수 derivation** 으로 박제한다 — operation 종류 (export/import) + actor 식별자 + 권한 등급 + scope/source context + row count + 발생 시각 (instant) 을 받아 직렬화 가능한 plain audit entry 객체를 조립하는 순수 함수. 실 Audit log row insert / repository / transaction 배선은 게이트된 후속 sub-slice 책임이다. REQ-032 (raw 미저장) 는 본 helper 가 count / scope / source metadata 만 다루고 raw 를 새로 fetch 하지 않으므로 helper layer 에서 자연 유지된다.

## Required Reading

- `docs/use-cases/UC-07-export-import.md` — §5 step 12 (`Audit log row insert (Export / Import 종류 + actor + scope / file source + row count)`), §8 (b) Export Audit row postcondition, §8 (e) Import Audit row postcondition, §2 actor (Admin / SuperAdmin 등급).
- `src/export/export-scope-select.ts` — `ExportScope` / `ExportEntity` / `ExportRecord` 타입 정의 (재사용, 새 도메인 타입 신설 0) + `assertValidDate` message convention.
- `src/export/export-dump.ts` — `ExportDump` 타입 (export 분기의 row count source: `recordCount` / `entityCounts`) + 조립 helper 패턴 (building block 재사용 + non-mutating + 빈 입력 정상 + assertValidDate 위임).
- `src/export/import-restore-plan.ts` — `ImportRestorePlan` 타입 (import 분기의 row count source: `toDelete` / `toInsert` / `toKeep` length) + 직전 단추 (T-0442) 의 helper-먼저 패턴 mirror (plain 결과 interface + non-mutating + 입력 방어 TypeError/RangeError 한국어 + VALID set).

## Acceptance Criteria

본 task 는 `commitMode: pr` 코드 task 이므로 R-112 4 항목 + coverage 최소치를 모두 만족한다. spec 은 colocated (`src/export/export-import-audit.spec.ts`).

- [ ] `src/export/export-import-audit.ts` 신설 — `buildExportImportAuditEntry(input: ExportImportAuditInput): ExportImportAuditEntry` 순수 함수. 입력 / 결과 plain interface export:
  - `ExportImportAuditInput { operation: "export" | "import"; actor: { id: string; role: "Admin" | "SuperAdmin" }; occurredAt: Date; export?: { scope: ExportScope; dump: ExportDump }; import?: { mode: "replace" | "merge"; plan: ImportRestorePlan; source?: string } }` — operation 에 맞는 sub-payload (`export` 또는 `import`) 필수.
  - `ExportImportAuditEntry { operation: "export" | "import"; actorId: string; actorRole: "Admin" | "SuperAdmin"; occurredAt: string; rowCount: number; detail: ... }` — `occurredAt` 은 `toISOString()` 직렬화, `detail` 은 분기별 요약 (export: scope 요약 + entityCounts, import: mode + {deleted, inserted, kept} count + source|null).
  - **export 분기**: `rowCount = dump.recordCount` (또는 entityCounts 합계 — dump 와 동일한 ground truth 1 개 선택, spec 으로 일치 검증), `detail.scope` 는 dump.scope 박제, `detail.entityCounts` 는 dump.entityCounts 박제.
  - **import 분기**: `rowCount = plan.toInsert.length` (복원된 row 수 = UC-07 §8 (e) "복원된 row count"), `detail.mode` 는 입력 mode, `detail.deleted/inserted/kept` 는 plan 세 배열 length, `detail.source` 는 입력 source ?? null.
  - non-mutating — 입력 객체·배열·중첩 dump/plan 변형 0 (freeze 된 입력으로 호출해도 통과). 결과는 항상 새 객체.
- [ ] **Happy-path unit test 1+**: export 분기 (정상 ExportDump + Admin actor → operation "export" + rowCount = recordCount + detail.scope/entityCounts 박제 + ISO occurredAt), import 분기 replace mode (정상 ImportRestorePlan + SuperAdmin actor → operation "import" + rowCount = toInsert.length + detail.deleted/inserted/kept 정확 + source 박제), import 분기 merge mode 각각 검증.
- [ ] **Error path unit test 1+**: `input` 부재 (null/undefined) → TypeError, `operation` 이 "export"/"import" 외 값 → RangeError, `occurredAt` 이 비-Date / Invalid Date → TypeError (한국어 메시지), `actor` 부재 또는 `actor.role` 이 허용 등급 외 → RangeError 또는 TypeError, operation="export" 인데 `export` sub-payload 부재 (또는 dump 부재) → TypeError, operation="import" 인데 `import` sub-payload 부재 (또는 plan 부재) → TypeError.
- [ ] **Flow / branch cover**: export 분기 / import 분기 각 1+ test, import 의 replace / merge mode 각 1+, source 있음 / source 부재 (→ null) 각 1+, occurredAt 검증 분기 / operation 검증 분기 / sub-payload 부재 분기 각 1+ test.
- [ ] **Negative cases 충분 cover**: 각 예외 분기마다 1+ — null input, operation 대소문자 mismatch / null / 숫자 (RangeError), actor.role 빈 문자열 / 잘못된 등급 / actor.id 비-string, occurredAt 비-Date / NaN Date, mismatched sub-payload (operation="export" + import payload 만 제공), dump.recordCount 와 entityCounts 합 불일치 시 동작 (선택한 ground truth 기준 명시 — 둘 중 dump.recordCount 우선 권장), 빈 dump (recordCount 0 → rowCount 0) / 빈 plan (toInsert [] → rowCount 0) 경계, source 빈 문자열 vs undefined 구분. non-mutating 검증 (Object.freeze 한 input + 중첩 dump/plan 통과 + 원본 배열 length/원소 불변).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 파일은 selectExportRecords / buildExportDump / buildImportRestorePlan 동형으로 100% 지향.
- [ ] `pnpm lint && pnpm build && pnpm test` green (tester 가 확인, R-110).

## Out of Scope

- 실 Audit log row insert / repository / Prisma / transaction / DB 호출 — schema/repository 게이트 (CLAUDE.md §5), 게이트된 후속 sub-slice 책임. 본 helper 는 audit entry **객체 조립** 까지만.
- file parse / JSON.parse / file source 의 실 hash·무결성 검증 — 본 helper 는 source 를 식별 문자열로만 받아 박제.
- 실 dump query / 실 복원 transaction 실행 (T-0438 / T-0442 가 산출한 dump·plan 을 소비만 — 재계산 0).
- AuditLog entity 스키마 정의 / 영속 컬럼 설계 — schema 게이트, 후속.
- REST controller / endpoint 배선 / GET /api/admin/export / POST /api/admin/restore / 응답 직렬화 — repository 게이트, 후속.
- 새 dependency / package.json 변경 / DB schema 변경 — 발생 시 BLOCKED.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점)
