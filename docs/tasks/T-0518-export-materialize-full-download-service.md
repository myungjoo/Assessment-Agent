---
id: T-0518
title: ExportJobService.materializeFullExportDownload service-layer 배선 (collect→buildFullExportDump→materialize)
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 240
estimatedFiles: 2
dependsOn: []
independentStream: export-download-chain
touchesFiles: [src/export/export-job.service.ts, src/export/export-job.service.spec.ts]
hqOrigin: null
created: 2026-06-19
plannerNote: "P7 export download chain — collectFullExportRecords→buildFullExportDump→materializeExportDump 묶는 service 메서드. ADR-0047 §Follow-ups[2], §5 자동 진행(controller 는 후속)."
---

# T-0518 — ExportJobService.materializeFullExportDownload service-layer 배선

## Why

ADR-0047 §Follow-ups[2] ("실 service-layer materialization 함수 — `ExportDump` → Node `Readable` stream, allow-list full-record read + descriptor 메타") 의 dependency-free 다음 조각이다. 순수 builder 3 종 (T-0514 select 상수 · T-0515 record builder · T-0517 dump envelope) 과 impure DB-read (T-0516 `collectFullExportRecords`) · pure materialize (T-0506 `materializeExportDump`) 가 모두 박제됐으나 **어느 것도 단일 service 메서드로 묶이지 않았다**. 본 task 는 그 셋을 `ExportJobService.materializeFullExportDownload(scope)` 하나로 배선해 "scope → full-record DB-read → fields 보존 envelope → Node `Readable` stream" 의 in-process 다운로드 materialization 을 service 차원에서 완결한다 (REQ-030 Export / REQ-032 raw 미저장). controller (`GET /api/admin/export/:id/download`) 는 후속 task (§Out of Scope). ADR-0046/ADR-0047 ACCEPTED 가 컬럼·저장 경계를 이미 닫았고 Q-0043 옵션1 이 service-layer 배선 방향을 승인했으므로 본 조각은 "결정된 ADR 의 구현" (CLAUDE.md §5 자동 진행, 신규 게이트 아님 — 새 dependency / schema migration / auth 표면 0).

## Required Reading

- `src/export/export-job.service.ts` — 배선 대상. 특히 `collectFullExportRecords()` (L493~521, impure DB-read → `FullExportRecord[]`), `previewSelection` 의 helper 호출 패턴, `EXPORT_ENTITY_SOURCES` 매핑표.
- `src/export/export-job.service.spec.ts` — 기존 spec 의 PrismaService mock 패턴 (colocated spec — 본 task 의 신규 test 도 여기에 추가).
- `src/export/export-full-dump.ts` — `buildFullExportDump(records, meta)` + `FullExportDump` 타입 + `ExportDumpMeta` 입력 (`{ scope, generatedAt, schemaVersion? }`).
- `src/export/export-dump-materialize.ts` — `materializeExportDump(dump: ExportDump): Readable` (순수, `JSON.stringify` + `Readable.from`, plain-object 입력 방어).
- `src/export/export-dump.ts` — `ExportDump` / `ExportDumpMeta` / `EXPORT_SCHEMA_VERSION` 정의 (materializeExportDump 가 받는 타입). `FullExportDump` 와 `ExportDump` 의 구조 관계 (records 원소 타입만 좁힘) 확인.
- `src/export/export-scope-select.ts` — `ExportScope` 타입 (메서드 인자).
- `docs/decisions/ADR-0047-export-dump-db-read-scope.md` — §Decision3(i) descriptor single-source / 재필터 0 invariant + §Follow-ups[2].
- `docs/decisions/ADR-0046-export-dump-materialization-storage.md` — §Decision1 in-process Node Readable 전략 + 4 invariant.

## Acceptance Criteria

- [ ] `ExportJobService` 에 새 public 메서드 `materializeFullExportDownload(scope: ExportScope): Promise<Readable>` (또는 동등 시그니처) 추가. 동작: (1) `collectFullExportRecords()` 로 `FullExportRecord[]` read, (2) `buildFullExportDump(records, { scope, generatedAt: new Date() })` 로 `FullExportDump` envelope 조립, (3) `materializeExportDump(dump)` 로 Node `Readable` 반환. ADD-only — 기존 `previewSelection`/`collectExportRecords`/`collectFullExportRecords`/mark*/find* 불변.
- [ ] `FullExportDump` → `materializeExportDump(dump: ExportDump)` 의 타입 정합 처리: `FullExportDump` 는 `ExportDump` 의 `records` 원소 타입만 `FullExportRecord` 로 좁힌 구조적 superset 이므로 직렬화·plain-object 입력 방어와 호환된다. 재필터 / secret strip / 컬럼 재검증을 **추가하지 않는다** (ADR-0047 §Decision3(i) descriptor single-source — 상류 projection-only T-0514 + buildFullExportRecord T-0515 가 이미 강제). 타입 변환이 필요하면 안전한 구조적 widening (직렬화 의미 보존) 으로 처리하고 주석으로 근거 명시.
- [ ] **Happy-path unit test 1+**: PrismaService mock 으로 5 entity 일부에 row 를 채운 뒤 `materializeFullExportDownload(scope)` 호출 → 반환이 `Readable` instance 이고, stream 을 소비해 얻은 JSON 을 parse 했을 때 `schemaVersion`/`generatedAt`/`scope`/`entityCounts`/`recordCount`/`records` 가 envelope 형태로 존재하고 `records[].fields` 가 보존됨을 단언.
- [ ] **Error path unit test 1+**: `collectFullExportRecords` 내부 `delegate.findMany` 가 reject (의존성 실패) 하면 그 reject 가 swallow 없이 propagate 됨을 단언 (Promise.all 전파).
- [ ] **Branch / flow cover**: 빈 DB (전 entity 빈 배열) → 빈 envelope (`recordCount: 0`, `entityCounts` 전부 0, `records: []`) 가 정상 직렬화되어 valid `Readable` 반환되는 분기 1+; 일부 entity 만 row 존재하는 분기 1+.
- [ ] **Negative cases 충분 cover** (각 1+): (a) `collectFullExportRecords` 가 산출한 record 의 `instant` (createdAt) 가 비-Date/누락이면 `buildFullExportRecord`/`buildFullExportDump` 의 TypeError 가 propagate; (b) allow-list 외 key (예: 상류 select 결함 시뮬로 `apiKey`) 가 row 에 섞이면 `buildFullExportRecord` RangeError propagate (REQ-032 §Decision2(b) 2 차 방어선 회귀); (c) `LlmConfig` row 의 정상 경로 결과 envelope `records` 에 `apiKey` key 가 부재함을 `.not.toHaveProperty("apiKey")` 로 단언 (secret deny 회귀).
- [ ] `pnpm lint && pnpm build` clean.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 변경된 `export-job.service.ts` 의 신규 메서드 line/branch cover 포함.

## Out of Scope

- `GET /api/admin/export/:id/download` streaming controller 배선 — 후속 task (ADR-0047 §Follow-ups[3]).
- ExportJob row 의 status 전이 / artifactRef 기록과의 결합 (materialize 결과를 job 생명주기에 묶는 것) — 본 task 는 scope → Readable 순수 배선만, job lifecycle 연결은 후속.
- chunk-plan 기반 chunk 단위 직렬화 / `export-chunk-*` byte slice 실 배선 (T-0507~T-0512 helper 의 실호출) — 후속 chain (ADR-0046 §Decision1 맞물림).
- scope 선별 필터링 변경 — `collectFullExportRecords` 는 현재 5 entity 전체를 allow-list read 한다. scope 기반 record 선별 (selectExportRecords 적용) 을 본 메서드에 추가하지 않는다 (envelope `scope` 는 meta context 로만 박제 — 선별 결합은 별도 task 결정 사항).
- `descriptor` (ExportArtifactDescriptor) 헤더 직렬화 / Content-Length 등 HTTP 응답 헤더 — controller task.
- 새 dependency / schema migration / import 측 역직렬화 / 외부 object-storage — 전부 본 task 범위 밖.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — sub-agent 가 관련 작업 발견 시 추가)
