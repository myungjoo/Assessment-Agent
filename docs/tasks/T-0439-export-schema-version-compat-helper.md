---
id: T-0439
title: UC-07 Import schema version 호환 판정 순수 helper (checkSchemaVersionCompat)
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 150
estimatedFiles: 2
created: 2026-06-16
independentStream: p7-export-import
dependsOn: []
touchesFiles: [src/export/schema-version-compat.ts, src/export/schema-version-compat.spec.ts]
gateFree: true
plannerNote: "P7 R-57/REQ-030 UC-07 Export/Import 세 번째 게이트-free 단추 — 업로드 dump 의 schemaVersion 을 현재 버전과 비교해 호환 판정(§6.3). T-0437/T-0438 helper 패턴 mirror, persistence/schema/REST 무관."
---

# T-0439 — UC-07 Import schema version 호환 판정 순수 helper (checkSchemaVersionCompat)

## Why

[PLAN.md](../PLAN.md) Phase P7 의 "Import / export / restore (R-57)" bullet 에서 Export 방향의 게이트-free building block 2 개가 완성됐다 — [T-0437](T-0437-export-scope-select-helper.md) `selectExportRecords`(scope 선별) → [T-0438](T-0438-export-dump-envelope-helper.md) `buildExportDump`(dump envelope 조립, `EXPORT_SCHEMA_VERSION = "1"` + envelope 헤더 박제). 그 다음 자연스러운 게이트-free 단추는 **Import 입구의 schema version 호환 판정 순수 helper** 다 — [UC-07 §6.3 schema version 차이](../use-cases/UC-07-export-import.md) 가 요구하는 "업로드된 file 의 schema version 이 현재 시스템 version 과 다를 때 (i) 자동 migration vs (ii) reject(default) 판정" 의 순수 결정 로직을 박제한다. [REQ-041 stream](T-0427-recent-deletion-runner-service.md) 이 입증한 "helper 먼저, 배선은 후속" 패턴을 그대로 적용 — `buildExportDump`(직렬화 방향) 다음의 자연 building block 은 **역방향(Import) 입구의 version gate** 다(실 file parse·transaction·controller 는 후속 repository/schema 게이트).

본 helper 는 persistence/repository/DB query/file parse/streaming 호출 0 — 업로드 dump 의 `schemaVersion` string 과 현재 시스템의 `EXPORT_SCHEMA_VERSION` 만 받아 `{ compatible: boolean; action: "accept" | "migrate" | "reject"; reason?: string }` 형태의 plain verdict 를 반환만 한다. 따라서 §5 의 schema/credential/architect 게이트를 전혀 건드리지 않는다. UC-07 §6.3 default = reject(file 무결성 우선) 정책을 박제하며, migration table(P5 책임)은 본 helper 가 호출하지 않고 "migrate 가능 후보" verdict 만 낸다(conceptual reference). REQ-032(raw 미저장)는 본 helper 가 version string 만 다뤄 raw 와 무관하므로 자연 유지.

## Required Reading

- [docs/use-cases/UC-07-export-import.md](../use-cases/UC-07-export-import.md) — §6.3 schema version 차이((i) 자동 migration / (ii) reject default) / §4 precondition 4(a)(dump 포맷 schema version 일치 또는 §6.3 적용) / §7.3·§7.4(version 부적합 → 400 reject, transaction 시작 전). 본 helper 가 박제할 호환 판정 규칙의 source.
- [src/export/export-dump.ts](../../src/export/export-dump.ts) L17~19 — `EXPORT_SCHEMA_VERSION = "1"` 상수 정의(본 helper 가 "현재 시스템 version" default 로 재사용 — 새 상수 신설 금지, 기존 import). + L44~ `ExportDump` envelope 의 `schemaVersion` 필드(본 helper 입력의 의미적 source).
- [src/export/export-dump.spec.ts](../../src/export/export-dump.spec.ts) — colocated spec 작성 패턴(R-112 4종 + negative 충분 cover) + `EXPORT_SCHEMA_VERSION` import 사용 reference.
- [src/export/export-scope-select.ts](../../src/export/export-scope-select.ts) — mirror 할 순수-helper 골격 패턴(non-mutating + 입력 검증 + RangeError/TypeError 분기 메시지). 본 task 의 코드 스타일 reference.

## Acceptance Criteria

- [ ] 새 파일 `src/export/schema-version-compat.ts` 에 순수 함수 `checkSchemaVersionCompat` 를 박제. 시그니처(이름은 가이드 — 구현 시 자연스럽게 조정 가능):
  - 입력: `uploadedVersion: string`(업로드 dump 의 `schemaVersion`) + 선택적 `options?: { currentVersion?: string; allowMigrationFrom?: ReadonlyArray<string> }`. `currentVersion` 부재 시 `EXPORT_SCHEMA_VERSION`(export-dump.ts import) default. `allowMigrationFrom` 은 "현재 version 으로 자동 migration 이 허용된 과거 version 목록"(부재/빈 배열 시 migration 후보 없음 → mismatch 는 전부 reject).
  - 출력: `SchemaVersionCompat` verdict — `{ compatible: boolean; action: "accept" | "migrate" | "reject"; uploadedVersion: string; currentVersion: string; reason?: string }`.
- [ ] 판정 규칙(UC-07 §6.3 정합):
  - `uploadedVersion === currentVersion` → `{ compatible: true, action: "accept" }`(reason 생략).
  - `uploadedVersion !== currentVersion` 이고 `allowMigrationFrom` 에 `uploadedVersion` 포함 → `{ compatible: false, action: "migrate", reason: "<uploaded>→<current> 자동 migration 후보" }`(§6.3 (i) — 본 helper 는 후보 판정만, 실 migration 0).
  - `uploadedVersion !== currentVersion` 이고 migration 후보 아님 → `{ compatible: false, action: "reject", reason: "schema version mismatch: <uploaded> ≠ <current>" }`(§6.3 (ii) default — file 무결성 우선).
  - `uploadedVersion` 이 string 아님 / 빈 문자열 / 공백만 → TypeError(message 에 "schemaVersion" 포함). `currentVersion`(주어진 경우) 동일 검증.
  - `allowMigrationFrom` 가 배열 아님(주어진 경우) → TypeError. 원소가 비-string 이면 TypeError.
  - 입력 인자를 변형하지 않는다(non-mutating — `allowMigrationFrom` 배열 freeze 후 호출해도 통과).
- [ ] **Happy-path unit test**: `checkSchemaVersionCompat` 의 accept(동일 version) / migrate(allowMigrationFrom 포함) / reject(mismatch + 후보 아님) 각 정상 verdict 1+ test. `currentVersion` 부재 시 `EXPORT_SCHEMA_VERSION`("1") default 적용 1+ test.
- [ ] **Error path unit test**: uploadedVersion 비-string → TypeError, 빈 문자열 → TypeError, 공백만 → TypeError, currentVersion 비-string(명시 시) → TypeError, allowMigrationFrom 비-배열 → TypeError, allowMigrationFrom 원소 비-string → TypeError 각 1+.
- [ ] **Flow / branch coverage**: accept vs migrate vs reject 3 분기 + currentVersion default vs 명시 분기 + allowMigrationFrom 부재 vs 매칭 vs 비매칭 분기 각 1+ test.
- [ ] **Negative cases 충분 cover**: allowMigrationFrom 빈 배열(mismatch 전부 reject) / allowMigrationFrom 에 uploadedVersion 없음(reject) / uploadedVersion == currentVersion 인데 allowMigrationFrom 에도 들어있음(accept 우선, migrate 아님) / 입력 배열 비변형(freeze 후 호출 통과) / verdict 의 reason 이 reject·migrate 에만 존재하고 accept 엔 생략 각 1+ test.
- [ ] colocated spec `src/export/schema-version-compat.spec.ts` 에 위 test 작성(export-dump.spec.ts mirror). helper fallback 불요(단일 spec).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% — 신규 helper 는 100% 목표).

## Out of Scope

- **실 migration 수행 0** — 본 helper 는 "migrate 후보" verdict 만 낸다. version A dump → version B schema 자동 변환(migration table)은 P5 service layer 책임(UC-07 §6.3 (i) conceptual reference).
- **persistence/repository/DB 조회 0 / file parse 0** — 본 helper 는 schema version string 만 받는다. 실 file artifact 의 schema header parse / 무결성 hash 검증 / 압축 해제는 후속 배선 task(§7.4, repository 게이트).
- **REST endpoint / controller / module 배선 0** — `POST /api/admin/restore` controller, multipart upload, AssessmentModule provider 등록은 후속 sub-slice.
- **Import transaction / row 삭제·재구성 0** — UC-07 §5 Import 분기의 destructive write(transaction = schema/repository 게이트)는 본 task 무관.
- **merge mode / conflict resolution 0** — UC-07 §6.2 의 replace/merge mode 판정·PK 충돌 처리는 본 task 무관(별도 후속).
- 새 외부 dependency 추가 0 / schema.prisma 변경 0 / 새 ADR 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 추가)
