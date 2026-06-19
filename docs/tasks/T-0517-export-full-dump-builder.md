---
id: T-0517
title: FullExportRecord[] → full-record dump envelope 순수 builder (buildFullExportDump)
phase: P5-in-progress
status: DONE
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 240
estimatedFiles: 2
created: 2026-06-19
dependsOn: []
touchesFiles:
  - src/export/export-full-dump.ts
  - src/export/export-full-dump.spec.ts
independentStream: export-download-chain
plannerNote: "P5 export download chain — ADR-0047 §Follow-ups[2] dependency-free 조각: FullExportRecord[]→fields 보존 dump envelope 순수 builder(materialize 입력 contract)"
---

# T-0517 — FullExportRecord[] → full-record dump envelope 순수 builder (buildFullExportDump)

## Why

[ADR-0047](../decisions/ADR-0047-export-dump-db-read-scope.md) §Follow-ups[2] (실 service-layer materialization) chain 의 다음 dependency-free 조각이다. T-0516 의 `collectFullExportRecords()` 는 `FullExportRecord[]`(`{entity, instant, fields}`)를 산출하지만, 기존 `buildExportDump`([export-dump.ts](../../src/export/export-dump.ts))는 입력을 `ExportRecord[]`(`{entity, instant}`)로만 받아 **`fields` 를 envelope 에 담지 못한다** — full-record dump 의 본문(`fields`)이 직렬화에서 소실된다. 본 task 는 `FullExportRecord[]` 를 받아 `fields` 를 보존한 dump envelope(`FullExportDump`)를 조립하는 dependency-free 순수 builder(`buildFullExportDump`)를 신설한다. 이는 [materializeExportDump](../../src/export/export-dump-materialize.ts)(T-0506, `ExportDump → Readable`)의 full-record 입력 contract 를 닫는 honest 한 다음 조각이며, DB/repository/controller 실배선(impure) 은 본 task 의 후속이다 (ADR-0047 §Out of scope — "service-layer materialization 함수 구현"의 순수 절반).

REQ-030(Export) / REQ-032(raw 미저장) 정합: 본 builder 는 `fields` 를 그대로 보존만 하고 컬럼 필터링은 하지 않는다 — secret deny 는 상류 query projection-only(T-0514) + `buildFullExportRecord`(T-0515 조립 단계 2 차 그물)가 이미 강제하므로, 본 builder 는 그 contract 산출물을 신뢰하고 envelope 로 감싸기만 한다 (ADR-0047 §Decision3(i) descriptor single-source 정신 — 재필터 0).

## Required Reading

- `docs/decisions/ADR-0047-export-dump-db-read-scope.md` — §Decision1·§Decision3(i)·§Follow-ups[2] (full-record dump 컬럼 경계 + materialization invariant)
- `src/export/export-dump.ts` — 기존 `buildExportDump` / `ExportDump` / `ExportDumpMeta` / `EXPORT_SCHEMA_VERSION` / `assertValidDate` 패턴 (본 builder 가 mirror 할 골격)
- `src/export/export-full-record.ts` — `FullExportRecord` 타입(`{entity, instant, fields}`) — 본 builder 의 입력 원소 contract
- `src/export/export-scope-select.ts` — `ExportEntity`(5 union) / `ExportScope` / `ExportRecord` 타입
- `src/export/export-dump.spec.ts` — colocated spec 작성 convention(describe/it 구조, error 단언 패턴) 참고
- 신규 spec 은 colocated `src/export/export-full-dump.spec.ts` 에 둔다 (NestJS convention + discoverability — helper fallback 불요, 단일 파일 spec).

## Acceptance Criteria

- [ ] `src/export/export-full-dump.ts` 신설 — `FullExportDump` interface(기존 `ExportDump` 의 `records` 를 `FullExportRecord[]` 로 좁힌 envelope: `schemaVersion`/`generatedAt`/`scope`/`entityCounts`/`recordCount`/`records: FullExportRecord[]`) + `buildFullExportDump(records: ReadonlyArray<FullExportRecord>, meta: ExportDumpMeta): FullExportDump` 순수 함수 export. 새 외부 dependency 0 (Node 내장 + 기존 same-folder import 만, Prisma runtime import 0).
- [ ] `fields` 보존 — 입력 각 `FullExportRecord` 의 `fields` 가 출력 `records[i].fields` 에 손실 없이 담긴다 (full-record 본문 직렬화 가능). `buildExportDump` 처럼 `entityCounts`(5 entity 전부 key, 0 초기화 후 +1 집계) / `recordCount` / `generatedAt` ISO 직렬화 / `schemaVersion` default(`EXPORT_SCHEMA_VERSION`) 동작은 동형 보존.
- [ ] non-mutating — 입력 `records` 배열·원소·`fields` 를 변형하지 않고 새 배열을 반환(입력 순서 보존). `Object.freeze(records)` / freeze 된 원소로 호출해도 통과.
- [ ] Happy-path unit test — 정상 `FullExportRecord[]` + meta 로 envelope 조립, `fields` 보존·`entityCounts` 정확·`recordCount` 일치·`generatedAt` ISO 문자열 검증 1+.
- [ ] Error path unit test — `meta` 부재(null/undefined) → TypeError, `records` 비-배열 → TypeError, 원소 `instant` 비-Date/Invalid Date → 그 index 담은 TypeError, `entity` 5 허용 외 → 그 index 담은 RangeError 각 1+.
- [ ] Flow/branch cover — schemaVersion 제공 vs 부재(default) 분기 / 빈 records(전 entity 0 + recordCount 0 + records []) vs 다수 records 분기 / 단일 entity vs 다수 entity 혼합 분기 각 1+ test.
- [ ] Negative cases 충분 cover — 빈 입력·경계값(record 0 개)·`fields` 가 빈 객체인 record·멀티바이트 한글 `fields` 값·여러 entity 가 섞인 순서 보존·non-mutating(입력 freeze 후 호출) 등 예외 상황 각 1+ test (단일 negative 금지 — 분기마다 cover).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (신규 파일 line ≥ 80% / function ≥ 80% — 본 순수 파일은 100% 목표).

## Out of Scope

- DB / Prisma / repository 실 read 배선 — 본 task 는 순수 builder 만 (impure full-record materialization service 함수는 후속 task).
- `GET /api/admin/export/:id/download` streaming controller 배선 — 후속 task (ADR-0047 §Follow-ups[3]).
- `buildExportDump`(기존 instant-only) 수정·deprecate — 본 builder 는 ADD-only, 기존 함수·spec 불변.
- `fields` 컬럼 필터링·secret strip·재검증 — 상류 projection-only(T-0514) + `buildFullExportRecord`(T-0515)가 이미 강제 (본 builder 재필터 0, descriptor single-source 정신).
- chunk 단위 직렬화 / descriptor 메타 결합 / 압축 — 후속 task (ADR-0046 §Decision1 맞물림 helper 들과의 실배선).
- import / restore 역직렬화 — 별도 chain.
- `prisma/schema.prisma` / `package.json` / lockfile 변경 — 일절 없음 (새 dep/credential/schema 0).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — sub-agent 가 관련 작업 발견 시 추가)
