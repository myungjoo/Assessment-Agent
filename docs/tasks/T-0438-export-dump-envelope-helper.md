---
id: T-0438
title: UC-07 Export dump envelope 조립 순수 helper (buildExportDump)
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 150
estimatedFiles: 2
created: 2026-06-16
independentStream: p7-export-import
dependsOn: []
touchesFiles: [src/export/export-dump.ts, src/export/export-dump.spec.ts]
plannerNote: "P7 R-57/REQ-030 UC-07 Export 두 번째 게이트-free 단추 — selected record → dump envelope 조립 순수 helper(schema version 헤더+metadata). T-0437 helper 패턴 mirror, persistence/schema 무관."
---

# T-0438 — UC-07 Export dump envelope 조립 순수 helper (buildExportDump)

## Why

[PLAN.md](../PLAN.md) Phase P7 의 "Import / export / restore (R-57)" bullet 에서 [T-0437](T-0437-export-scope-select-helper.md) 이 scope 선별 순수 helper(`selectExportRecords`)를 박제해 Export 의 첫 게이트-free 단추를 shipped 했다. 그 다음 자연스러운 게이트-free 단추는 **선별된 record 를 직렬화 가능한 dump envelope 로 조립하는 순수 helper** 다 — [UC-07 §5 step 직렬화 Note](../use-cases/UC-07-export-import.md) + §6.3 schema version 차이 처리 + §8 (e) Audit metadata 가 요구하는 "dump format" 의 envelope 골격을 박제한다. [REQ-041 stream](T-0427-recent-deletion-runner-service.md) 이 입증한 "helper 먼저, 배선은 후속" 패턴(T-0424 window → T-0425 select → T-0426 plan 조립)을 그대로 적용 — `selectExportRecords` (선별) 다음의 자연 building block 은 **dump envelope 조립** 이다(실 DB query·streaming·controller 는 후속 repository 게이트).

본 helper 는 persistence/repository/DB query/streaming/file 생성 호출 0 — 이미 메모리에 올라온 record 배열(+ scope context)을 받아 schema version 헤더 + metadata(entity 별 count + generatedAt + scope 요약) + records payload 를 가진 plain object envelope 를 반환만 한다. 따라서 §5 의 schema/credential/architect 게이트를 전혀 건드리지 않는다. REQ-032(raw 미저장)는 본 helper 가 입력 record 만 envelope 에 담고 raw 를 새로 fetch 하지 않으므로 envelope layer 에서도 자연 유지된다(UC-07 §1 invariant (a), §8 (b)). schema version 헤더는 §6.3 의 version mismatch 처리(후속 Import 가 reject/migration 판정에 사용)의 source 가 된다.

## Required Reading

- [docs/use-cases/UC-07-export-import.md](../use-cases/UC-07-export-import.md) — §5 step 직렬화 Note("dump format 직렬화") / §6.1 Export scope 3차원(envelope metadata 의 scope 요약 source) / §6.3 schema version 차이(envelope 의 schema version 헤더 의도) / §8 (a)(e) Export postcondition(row count + Audit metadata). 본 helper 가 조립할 envelope 형태의 source.
- [src/export/export-scope-select.ts](../../src/export/export-scope-select.ts) — 본 task 가 재사용할 `ExportRecord` / `ExportEntity` / `ExportScope` / `ExportSelection` 타입 정의(새 타입 신설 금지, 기존 import) + mirror 할 순수-helper 패턴(assertValidDate · non-mutating · 입력 순서 보존 · 빈 배열 정상). 본 task 의 코드 골격 reference.
- [src/export/export-scope-select.spec.ts](../../src/export/export-scope-select.spec.ts) — colocated spec 작성 패턴(R-112 4종 + negative 충분 cover) reference.
- [src/scheduling/recent-deletion-plan.ts](../../src/scheduling/recent-deletion-plan.ts) — building block helper(선별) 다음의 "조립 helper" 패턴 reference(검증 위임 전파 + non-mutating + 빈 배열 정상). 본 task 와 동형(plan 조립 ↔ envelope 조립).

## Acceptance Criteria

- [ ] 새 파일 `src/export/export-dump.ts` 에 순수 함수 `buildExportDump` 를 박제. 시그니처(이름은 가이드 — 구현 시 자연스럽게 조정 가능):
  - 입력: `records: ReadonlyArray<ExportRecord>`(export-scope-select.ts 의 타입 재사용 — 이미 `selectExportRecords` 로 선별된 `selected` 배열을 받는 것이 일반 호출) + `meta: { scope: ExportScope; generatedAt: Date; schemaVersion?: string }`(scope 요약 + 생성 시각 + 선택적 schema version — 부재 시 본 파일의 `EXPORT_SCHEMA_VERSION` 상수 default).
  - 출력: `ExportDump` envelope — `{ schemaVersion: string; generatedAt: string(ISO); scope: ExportScope; entityCounts: Record<ExportEntity, number>; recordCount: number; records: ExportRecord[] }`. `entityCounts` 는 5 entity 전부 key 로 가지며 records 에 없으면 0(누락 key 없음). `records` 는 입력 순서를 보존한 새 배열(non-mutating).
- [ ] 조립 규칙:
  - `schemaVersion` 부재 시 `EXPORT_SCHEMA_VERSION`(본 파일 상수, 예: `"1"`) default 적용.
  - `generatedAt` 는 ISO string 으로 직렬화(`toISOString()`). 비-Date/Invalid Date 시 TypeError.
  - `entityCounts` 는 records 를 1회 순회해 entity 별 빈도 집계(5 entity 전부 0 초기화 후 +1). recordCount = records.length.
  - records 의 각 원소 instant 가 비-Date/Invalid Date 시 TypeError(index 포함 메시지). entity 가 5 허용 값 외 시 RangeError(index 포함).
  - 입력 records 배열을 변형하지 않으며, 빈 records 입력은 entityCounts 전부 0 + recordCount 0 + records [](error 아님).
- [ ] **Happy-path unit test**: `buildExportDump` 의 정상 envelope 조립 1+ test — schemaVersion default 적용 / 명시 schemaVersion 적용 / entityCounts 5 entity 집계 정확 / generatedAt ISO 직렬화 / records 순서 보존 각 cover.
- [ ] **Error path unit test**: generatedAt 비-Date/Invalid Date → TypeError, records 가 배열 아님 → TypeError, record.instant 비-Date/Invalid Date → TypeError(index 포함), record.entity 허용 외 값 → RangeError(index 포함), meta 부재(null/undefined) → TypeError 각 1+.
- [ ] **Flow / branch coverage**: schemaVersion default vs 명시 분기 + 빈 records vs 비어있지 않은 records 분기 + entityCounts 의 5 entity 각 분기(어느 entity 든 집계되는 경로) 각 1+ test.
- [ ] **Negative cases 충분 cover**: 빈 records 입력(entityCounts 전부 0, error 아님) / 한 entity 만 있는 records(나머지 4 entity 0) / 모든 entity 가 섞인 records(각 count 정확) / 입력 배열 비변형(원본 freeze 후 호출해도 통과) / 결과 envelope 가 입력 records 와 별개 배열(반환 records mutate 가 입력에 영향 0) 각 1+ test.
- [ ] colocated spec `src/export/export-dump.spec.ts` 에 위 test 작성(export-scope-select.spec.ts mirror). helper fallback 불요(단일 spec).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% — 신규 helper 는 100% 목표).

## Out of Scope

- **persistence/repository/DB 조회 0** — 본 helper 는 이미 메모리에 올라온(그리고 `selectExportRecords` 로 선별된) record 배열만 받는다. 실 DB dump query(Assessment + Person + Group + LlmConfig + AuditLog read)는 후속 배선 task(repository 게이트 진입 시 재확인).
- **REST endpoint / controller / module 배선 0** — `GET /api/admin/export` controller, AssessmentModule provider 등록은 후속(T-0437 select → 본 task envelope 후 controller 동형 후속 sub-slice).
- **실 streaming / file 생성 / 압축 archive / chunked download 0** — 본 helper 는 plain object envelope 만 반환. JSON.stringify·streaming·resumable upload·대량 dump async job 은 후속(UC-07 §8 NFR Out of Scope).
- **Import / Restore / 역직렬화 / schema migration 0** — 본 helper 는 dump(직렬화 방향)만. UC-07 §6.2/§6.3 의 load 경로(transaction = schema/repository 게이트)는 본 task 무관.
- **전체 row payload 구조 0** — 본 helper 의 `ExportRecord` 는 분류/집계 key(entity + instant)만 담는 최소 형태(T-0437 정의). 실 컬럼 전부를 담는 row 직렬화는 후속 배선 책임.
- 새 외부 dependency 추가 0 / schema.prisma 변경 0 / 새 ADR 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 추가)
