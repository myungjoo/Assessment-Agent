---
id: T-0516
title: ExportJobService 에 full-record allow-list DB-read 배선 (collectFullExportRecords)
phase: P7
status: DONE
commitMode: pr
coversReq: [REQ-030, REQ-032]
dependsOn: []
touchesFiles:
  - src/export/export-job.service.ts
  - src/export/export-job.service.spec.ts
independentStream: export-download-chain
estimatedDiff: 240
estimatedFiles: 2
created: 2026-06-19
plannerNote: P7 ADR-0047 §Follow-ups[2]/Q-0043 옵션1 첫 impure step — full-record allow-list DB-read 배선(projection-only secret deny), commitMode pr
---

# T-0516 — ExportJobService 에 full-record allow-list DB-read 배선 (collectFullExportRecords)

## Why

[Q-0043](../STATE.json) 옵션1(게이트1 service-layer 배선 code chain) 승인 + [ADR-0047](../decisions/ADR-0047-export-dump-db-read-scope.md)(ACCEPTED) §Follow-ups[2]·§Decision3 의 첫 **impure(DB-read) 배선** step 이다. T-0514(`EXPORT_ENTITY_FULL_RECORD_SELECT` allow-list select 상수) + T-0515(`buildFullExportRecord` 순수 builder)로 contract 가 갖춰졌고, 이제 그 둘을 실 Prisma read path 에 배선해 5 entity 의 full-record 컬럼을 **allow-list projection-only** 로 read 해 `FullExportRecord[]` 를 조립하는 service 메서드를 박제한다. 이는 "ADR-0047 로 이미 결정된 컬럼 경계의 구현"(CLAUDE.md §5 자동 진행 — 신규 게이트 아님)이며, 후속 materialization service 함수(`ExportDump` → Node `Readable`)와 `GET /api/admin/export/:id/download` controller 가 본 메서드를 입력 source 로 소비한다.

기존 `collectExportRecords`(instant 1-컬럼 projection — preview 용)는 **불변 보존**하고, 본 task 는 그와 직교한 새 private 메서드 `collectFullExportRecords` 를 **추가**한다(REQ-032 raw-미저장 + `apiKey` secret deny 를 projection-only 로 강제).

## Required Reading

- `docs/decisions/ADR-0047-export-dump-db-read-scope.md` — §Decision1(entity 별 allow-list 표) · §Decision2(raw-미저장/secret deny/projection-only 강제) · §Decision3(후속 구현 invariant: allow-list 컬럼만 select, 새 dep 0)
- `src/export/export-job.service.ts` — 배선 대상. 특히 `collectExportRecords`(L438~) 의 projection-only `delegate.findMany({ select })` 패턴 + `EXPORT_ENTITY_SOURCES` 매핑표(L132~) + `ExportEntityDelegate` union(L146~). 본 task 는 이 패턴을 full-record allow-list 로 확장한다.
- `src/export/export-entity-full-record-select.ts` — T-0514 산출. `EXPORT_ENTITY_FULL_RECORD_SELECT`(5 entity allow-list select 상수, `apiKey` 부재) + `getExportEntityFullRecordSelect`(방어 복제 derive). 본 메서드가 select 객체 source 로 소비.
- `src/export/export-full-record.ts` — T-0515 산출. `FullExportRecord` 타입 + `buildFullExportRecord(entity, instant, fields)` 순수 builder(allow-list 외 key → RangeError 2차 단언). 본 메서드가 row → FullExportRecord 조립에 소비.
- `src/export/export-scope-select.ts` — `ExportEntity` union + `ExportRecord` 타입(`instant` 컬럼은 entity 별 `createdAt` — `EXPORT_ENTITY_SOURCES.instantColumn`).
- `src/export/export-job.service.spec.ts` — colocated spec(추가 위치). 기존 `collectExportRecords`/`previewSelection` mock 패턴 참고.
- `test/helpers/prisma-mock.ts` — 공유 Prisma mock helper(5 delegate `findMany` stub). 본 spec 이 import.

## Acceptance Criteria

- [ ] `ExportJobService` 에 private(또는 internal) 메서드 `collectFullExportRecords(): Promise<FullExportRecord[]>` 추가 — 5 entity(`EXPORT_ENTITY_SOURCES`)를 돌며 각 delegate 에 `findMany({ select: getExportEntityFullRecordSelect(entity) })`(또는 `EXPORT_ENTITY_FULL_RECORD_SELECT[entity]` 직접)로 **allow-list 컬럼만** projection read 하고, 각 row 를 `buildFullExportRecord(entity, row[instantColumn] as Date, fields)` 로 조립해 평탄화 반환한다. 전체 row 읽기(`findMany()` 무인자/`select` 생략) **금지** — 명시 projection 만(ADR-0047 §Decision3(ii)).
- [ ] `LlmConfig`(→ `llmProviderConfig`) read 의 `select` 객체에 `apiKey` key 가 **절대 없다**(T-0514 상수가 보장 — 본 메서드는 그 상수/derive 만 사용). 새 select 객체를 ad-hoc 으로 만들어 secret 을 넣지 않는다.
- [ ] **Happy-path unit test 1+** — 5 entity mock 이 각 allow-list 컬럼 + instant 를 반환할 때 `collectFullExportRecords` 가 entity 별 `FullExportRecord`(`{entity, instant, fields}`)로 평탄·정확 조립함을 단언. `fields` 가 해당 entity allow-list 컬럼만 담음을 멤버십 정확 일치로 검증.
- [ ] **Error path unit test 1+** — delegate `findMany` 가 reject(의존성 실패)하면 그 error 가 swallow 없이 propagate 됨을 단언. 추가로 row 의 instant(`createdAt`)가 비-Date/누락이면 `buildFullExportRecord` 의 TypeError 가 전파됨을 단언.
- [ ] **Branch/flow cover** — 빈 DB(전 entity 빈 배열) → 빈 `FullExportRecord[]` 정상 반환(throw 0) 분기 + 일부 entity 만 row 존재하는 분기 각 1+ test.
- [ ] **Negative cases 충분 cover** — (a) `LlmConfig` row 결과에 `apiKey` 가 섞여 들어온 경우(상류 select 결함 시뮬) `buildFullExportRecord` 가 RangeError 로 거부함을 단언(`.not.toHaveProperty("apiKey")` 정합 회귀 — REQ-032 §Decision2(b) 2차 방어선), (b) allow-list 외 임의 key 가 섞인 경우 RangeError, (c) instant 컬럼 누락/Invalid Date 경계 각 1+ — 단일 negative 만으로 부족, 예외 분기마다 cover.
- [ ] colocated spec 위치 `src/export/export-job.service.spec.ts`(기존 파일에 describe 추가) — helper fallback 으로 `test/helpers/prisma-mock.ts` 의 5 delegate mock 재사용.
- [ ] `pnpm lint && pnpm build && pnpm test` green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규/변경 메서드 분기 cover.

## Out of Scope

- 실 materialization 함수(`ExportDump` → Node `Readable` stream) 구현 — 후속 task(ADR-0046 §Decision1 기반). 본 task 는 record 수집까지만.
- `GET /api/admin/export/:id/download` streaming controller 배선 — 후속 task.
- `previewSelection`/`collectExportRecords`(instant projection)의 동작 변경 — 보존 불변. 본 task 는 새 메서드 **추가**만.
- relation/nested include(Person 의 `assessments[]` 등) — ADR-0047 §Out of scope(scalar allow-list 만).
- 새 외부 dependency / 새 credential / `package.json` 변경 — 발생 시 BLOCKED(ADR-0047 §Decision3(iii)).
- `prisma/schema.prisma` 변경 / migration — 발생 시 BLOCKED(기존 컬럼만 read).
- `ExportSelectionPreview` 응답에 full-record surface(새 필드 노출) — 후속 task. 본 메서드는 내부 수집 layer 만.

## Suggested Sub-agents

implementer → tester

## Follow-ups

- 실 materialization service 함수(`ExportDump` → Node `Readable`, ADR-0046 §Decision1 helper 소비) — 본 `collectFullExportRecords` 가 입력 source.
- `GET /api/admin/export/:id/download` streaming controller 배선 + repository allow-list full-record DB-query streaming.

## Result (DONE 2026-06-19T06:11Z)

PR #429 squash merge `9d888cd` — reviewer APPROVE round1, 4-게이트 PASS, CI green(run 27809090064). `collectFullExportRecords` 추가(+270 LOC, export-job.service.ts line 98.71%/func 100%/branch 96%, 전체 5285 test green). ADD-only(기존 collectExportRecords/previewSelection 불변), apiKey secret deny projection-only 보존.
