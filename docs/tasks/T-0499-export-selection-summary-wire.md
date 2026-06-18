---
id: T-0499
title: summarizeExportSelection helper 를 ExportJobService.previewSelection 응답 확장으로 실호출 배선 — 45 helper 배선 chain step8
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 230
estimatedFiles: 4
created: 2026-06-18
independentStream: export-import-wiring
dependsOn: [T-0497]
touchesFiles:
  - src/export/export-job.service.ts
  - src/export/export-job.service.spec.ts
  - src/export/export.controller.ts
  - src/export/export.controller.spec.ts
plannerNote: "P7 helper-배선 chain step8 — summarizeExportSelection(T-0449 미호출 helper) 를 T-0497 previewSelection 의 ExportSelection 위에 응답 확장으로 배선(perEntity 5-key + instantRange{earliest,latest} 노출). DB write 0·신규 endpoint 0. downstream(estimate/plan/result) chain 의 다음 step. R-112 cap-bend pre-justified: backbone × 1.5 = ~225 LOC."
---

# T-0499 — summarizeExportSelection helper 를 previewSelection 응답 확장으로 실호출 배선 (chain step8)

## Why

P7 "45 helper(T-0437~T-0483) 실 호출 배선" 스트림의 chain step8 다. [T-0497](T-0497-export-select-records-preview-wire.md) (PR #408, squash 86c07c7) 가 step7 에서 `selectExportRecords` 를 신설 `ExportJobService.previewSelection` + `POST /api/admin/export/preview-selection` 으로 실 DB path 에 배선했고, [T-0498](T-0498-export-entity-source-mapping-adr-amend.md) 이 그 path 의 `EXPORT_ENTITY_SOURCES` 매핑을 ADR-0044 contract source 에 박제했다. previewSelection 의 현재 응답(`ExportSelectionPreview` — `selectedCount` / `excludedCount` / `perEntitySelected` 만)은 selected 측 5-entity breakdown 만 노출하고 **(a) excluded 측 5-entity breakdown 과 (b) selected/excluded 각 그룹의 instant 시간 범위(earliest/latest)** 는 미노출이다 — UC-07 §3 trigger 1 confirmation dialog (scope 옵션 선택 후 "내가 무엇을 내보내고 무엇을 제외하는지") + §5 step 2 scope 옵션 확인 + §8 (b) Audit row (Export 종류 + actor + scope + row count) 가 요구하는 사람-친화 breakdown 의 절반이다.

이 gap 을 채우는 helper 가 이미 박제돼 있다 — `summarizeExportSelection` ([T-0449](T-0449-export-selection-summary-helper.md), `src/export/export-selection-summary.ts`). 입력으로 `ExportSelection`({selected, excluded} 두 배열) 을 받아 두 그룹 각각의 `{ total, perEntity(5 entity 0-init Record), instantRange: {earliest, latest} | null }` 을 산출하는 순수 helper. `git grep summarizeExportSelection -- "src/**/*.controller.ts" "src/**/*.service.ts"` 0 매칭 — 자기 spec 외 production wiring 0 인 미호출 helper. T-0497 이 산출한 `ExportSelection` 위에 자연 연결되는 다음 chain step 이다.

본 task 는 신설 endpoint 0·DB write 0 의 **응답 확장 slice** 다. `ExportJobService.previewSelection` 안에서 `selectExportRecords` 결과(`ExportSelection`)를 그대로 `summarizeExportSelection(selection)` 에 forward 해 두 그룹 breakdown 을 derive 한 뒤, 반환 shape 을 (a) 기존 count 요약 + (b) helper 결과의 `ExportSelectionSummary`(selected/excluded 각각의 total / perEntity / instantRange) 결합으로 확장한다. POST `/api/admin/export/preview-selection` route 자체는 신설 0·메서드/URL 불변 — 응답 body 만 확장된다. RBAC / projection-only DB read / scope invariant 위반 raw forward 정책은 T-0497 그대로 mirror.

이로써 (1) 미호출 helper 1 종이 실 HTTP path 에 연결되고(REQ-030 Export scope 사람-친화 미리보기), (2) helper 가 selection 자체만 다루고 DB read 가 [T-0497](T-0497-export-select-records-preview-wire.md) 에서 끝났으므로 REQ-032 raw 미저장 invariant 가 자연 유지되며(레코드 count·instant 만 노출, raw payload 0), (3) Admin 전용 RBAC(REQ-045) 가 endpoint 불변으로 동일 적용된다. step7 의 read 위에 derivation 1 layer 만 더하는 minimum-diff slice.

본 task 는 **새 endpoint 0**(POST `/preview-selection` 메서드/URL 불변), **신규 DTO 파일 0**(응답 shape 은 service interface 확장만), **DB write 0**, **새 외부 dependency / migration / auth-flow 0**.

## Required Reading

- `docs/tasks/T-0499-export-selection-summary-wire.md` (본 파일)
- `src/export/export-selection-summary.ts` 전체 — 호출할 순수 helper. `summarizeExportSelection(selection: ExportSelection): ExportSelectionSummary`. 반환 shape: `{ selected: { total: number; perEntity: Record<ExportEntity, number>; instantRange: { earliest: Date; latest: Date } | null }, excluded: <동일 shape> }`. **입력 방어**: selection 비-plain-object → TypeError, selected/excluded 비-배열 → TypeError(어느 배열인지 label), record 원소 instant 비-Date/Invalid → 그 index TypeError. non-mutating, 빈 그룹 → instantRange null. `ExportSelection` / `ExportEntity` / `ExportRecord` 는 `./export-scope-select` 에서 재사용.
- `src/export/export-job.service.ts` 전체 — 배선 위치. 특히 (a) `previewSelection(scope)` 의 현재 흐름 — `collectExportRecords()` → `selectExportRecords(scope, records)` → count/perEntitySelected 합성. 본 task 는 그 분류 결과(`{ selected, excluded }`) 를 그대로 `summarizeExportSelection` 에 forward 하면 된다 — entity 별 count 재계산 회피(현재 perEntitySelected 합성 로직은 helper 가 cover 하므로 helper 결과로 대체 가능, 단 backward-compat 위해 기존 필드 유지 여부는 implementer 재량). (b) `ExportSelectionPreview` interface — 본 task 가 확장 또는 helper 의 `ExportSelectionSummary` 를 surface 에 추가. (c) `EXPORT_ENTITY_SOURCES` / `collectExportRecords` / `SCOPE_ENUM_TO_PAYLOAD` / Prisma error 변환 컨벤션 mirror — 본 task 는 신규 read 0.
- `src/export/export-job.service.spec.ts` 전체 — colocated spec. T-0497 `previewSelection` test 의 PrismaService mock 패턴 (5 entity `findMany` stub) mirror 해 신규 응답 shape 검증 추가. 신규 spec 파일 생성 금지 — colocated 우선.
- `src/export/export.controller.ts` 의 `previewSelection` endpoint (line 233~248) — service 응답을 raw forward 만 한다. 본 task 의 응답 shape 확장이 controller 분기 추가 0(service return 그대로 200 forward). type import (`ExportSelectionPreview` 또는 신규 결합 타입) 정합화만 필요.
- `src/export/export.controller.spec.ts` 의 `previewSelection` test (T-0497 추가분) — 신규 응답 shape 의 controller 측 forward 검증 1+ 추가 또는 기존 expectation 갱신.
- `docs/decisions/ADR-0044-export-import-job-persistence.md` §5 (T-0498 inline-amend 박제) — `EXPORT_ENTITY_SOURCES` 매핑이 contract source 임을 확인. 본 task 는 ADR 본문 변경 0(코드만 — 응답 확장).
- `docs/use-cases/UC-07.md` §3 trigger 1 + §5 step 2 + §8 (b) — confirmation dialog 및 Audit row 가 요구하는 breakdown(selected/excluded 각 perEntity·total·instantRange) 의미 정합 확인.

## Acceptance Criteria

### 배선 설계 (구현 방향 — 세부는 implementer 재량, 단 helper 실호출 + 신설 endpoint 0 + DB write 0 은 의무)

- [ ] `ExportJobService.previewSelection(scope)` 의 흐름을 (1) 기존 `collectExportRecords()` + `selectExportRecords(scope, records)` 호출 유지 → (2) 분류 결과 `{ selected, excluded }` 를 그대로 `summarizeExportSelection(...)` 실호출 → (3) helper 산출 `ExportSelectionSummary` 를 응답에 포함하도록 확장한다. helper 호출 위치·방식 배선 근거 주석 1 줄 박제 (UC-07 §3 trigger 1 / §8 (b) confirmation/audit breakdown 정합 + REQ-032 derivation-only).
- [ ] 응답 shape 확장은 다음 두 옵션 중 implementer 가 택일:
  - **옵션 A (preferred — minimum-diff)**: 기존 `ExportSelectionPreview` 에 `summary: ExportSelectionSummary` 필드 추가. `selectedCount` / `excludedCount` / `perEntitySelected` 는 backward-compat 위해 유지(또는 `summary.selected.total` / `summary.excluded.total` / `summary.selected.perEntity` 와 1:1 mirror 임을 주석으로 박제 + 추후 `perEntitySelected` 제거는 별도 task).
  - **옵션 B**: `ExportSelectionPreview` 를 `ExportSelectionSummary` + 최소 count 필드로 재정의(중복 제거). controller 측 변경 동반.
- [ ] 새 endpoint 0 — POST `/api/admin/export/preview-selection` 의 메서드/URL/RBAC/ValidationPipe 모두 불변. controller 분기 추가 0(service return 그대로 forward — 응답 shape 만 확장).
- [ ] DB write 0 — `summarizeExportSelection` 은 입력 `ExportSelection` 만 derivation 하므로 추가 Prisma 호출 0. T-0497 의 `collectExportRecords` projection-only read(REQ-032) 정책 불변.
- [ ] scope invariant 위반(RANGE+dateRange 누락 등) 시 service 안의 `selectExportRecords` 가 RangeError 를 raw propagate 하는 정책 그대로(controller 자체 분기 0). helper `summarizeExportSelection` 의 입력 방어 분기는 `selectExportRecords` 통과 selection 만 forward 되므로 정상 경로에서 미발화(주석 1줄로 박제).

### R-112 4종 충분 cover (CLAUDE.md §3.2)

- [ ] **Happy-path unit test** (service spec) — full scope / range scope / partial scope 각 1+: 분류 결과 → helper 호출 → 응답에 `summary.selected.total` · `summary.selected.perEntity`(5 key 전부) · `summary.selected.instantRange{earliest,latest}` · `summary.excluded.*` 가 정확히 박제됨을 검증.
- [ ] **Error path unit test** (service spec) — (a) 5 entity findMany 중 하나가 Prisma error throw 시 service 가 raw propagate 검증(helper 호출 도달 0), (b) helper 호출 자체는 정상 selection 입력만 받으므로 helper 입력 방어 발화 0 검증(정상 흐름에서 selection.selected/excluded 가 항상 ExportRecord[] 배열).
- [ ] **Flow / branch coverage** — full scope (excluded 빈) / range scope (양쪽 분배) / partial scope (entity 별 분배) / 빈 DB (양쪽 0 + instantRange null) 4 분기 각 1+ test.
- [ ] **Negative cases 충분 cover** — (a) 단일 record selected (earliest === latest 경계), (b) excluded 측 빈 (instantRange null), (c) selected 측 빈 partial scope (entitySelector 가 DB 에 0 record), (d) 모든 entity 0 record (full scope · 빈 DB), (e) controller spec — 권한 부족 (User actor 403), 인증 부재 (401), forbidNonWhitelisted (CreateExportDto 외 필드 400) — 각 1+ test.
- [ ] **Controller spec** (`export.controller.spec.ts`) — service.previewSelection mock 의 반환 shape 을 확장된 응답으로 stub 하고 200 응답 body 에 `summary` 가 그대로 forward 됨을 1+ test.
- [ ] **Coverage 최소치** — `pnpm test:cov` 통과 (변경 파일 line ≥ 80% AND function ≥ 80% — `package.json` `coverageThreshold.global` 강제). 신규/변경 service 분기·controller 분기 전부 spec 도달.

### 정합 / 회귀 방지

- [ ] `summarizeExportSelection` 의 import 경로는 `./export-selection-summary` (같은 폴더) — 신규 alias / barrel re-export 신설 0.
- [ ] helper 결과 `summary.selected.perEntity` 가 항상 5 key (Assessment·Person·Group·LlmConfig·AuditLog) 0-init 으로 박제됨을 spec 1+ 로 검증 (entity 누락 회귀 차단).
- [ ] 기존 `selectedCount` / `excludedCount` 가 옵션 A 선택 시 helper `summary.selected.total` / `summary.excluded.total` 과 정확히 일치함을 spec 1+ 로 cross-check (응답 shape 변경의 backward-compat 회귀 차단).
- [ ] `pnpm lint && pnpm build && pnpm test` 전부 green. CI workflow (`test:cov` step 포함) 도 green.

## Out of Scope

- 신규 endpoint / 새 route — 본 task 는 `POST /preview-selection` 의 응답 확장만. URL · 메서드 · RBAC · ValidationPipe 변경 0.
- DB write / 새 Prisma read — `summarizeExportSelection` 은 input derivation 이라 추가 DB 호출 0. T-0497 의 projection-only `collectExportRecords` 그대로.
- `estimateExportDumpSize`(T-0466) · `buildExportJobPlan`(T-0467) · `buildExportResult` 배선 — 다음 chain step 들 (별도 task, §Follow-ups).
- helper(`summarizeExportSelection`) 구현 변경 — T-0449 helper 본문 (`src/export/export-selection-summary.ts`) 은 건드리지 않는다. 단 helper 의 `ExportSelectionSummary` / `ExportSelectionGroupBreakdown` interface 를 service 가 그대로 surface 에 노출하면 된다.
- 새 DTO 파일 / response DTO class — 응답 shape 은 service interface 확장만 (옵션 A 또는 B). `class-validator` 검증은 request 측 `CreateExportDto` 만, response 는 plain interface.
- ADR-0044 본문 변경 / 새 ADR — 본 task 는 코드만. T-0498 inline-amend 가 contract source 정합화 완료.
- `api.md` / `data-model.md` / `directory.md` doc-sync — 응답 shape 변경에 따른 api.md §5 갱신은 필요 판단 시 §Follow-ups (별도 doc-sync task).
- `ImportJobService` 대칭 배선 (`summarizeImportImpact`(T-0441) / `summarizeRestorePlan`(T-0448) wiring) — import 측 별도 chain (별도 task).
- 5 entity → Prisma model 매핑 상수 변경 — `EXPORT_ENTITY_SOURCES` (T-0497 박제, T-0498 ADR 기록) 그대로 재사용.
- 새 외부 dependency / credential / 새 module 등록 — 0.

## Suggested Sub-agents

`implementer → tester` (service 분기 1줄 + 응답 shape 확장 + colocated spec 추가. architect 호출 불요 — helper 는 박제됐고 매핑은 T-0498 ADR amend 로 contract source 정합 완료, 새 architectural 결정 0. service interface 확장 옵션 A/B 는 implementer 재량.)

## Follow-ups

(생성 시점 비어 있음. sub-agent 가 관련 작업 발견 시 append — 예:
- **다음 code slice (chain step9)**: `estimateExportDumpSize`(T-0466, `src/export/export-dump-size-estimate.ts`) → `previewSelection` 결과 위에 dump 크기 estimate 합성 배선 (pr-mode). 본 task 의 응답 확장 위에 자연 연결.
- 이후 `buildExportJobPlan`(T-0467) → `buildExportResult` 순차 배선.
- api.md §5 의 `POST /api/admin/export/preview-selection` 응답 shape 정합 갱신 (별도 doc-sync direct task).
- `ImportJobService` 측 대칭 — `summarizeImportImpact`(T-0441) / `summarizeRestorePlan`(T-0448) 실호출 배선 (별도 chain).
- `ExportSelectionPreview` 의 `perEntitySelected` 와 `summary.selected.perEntity` 중복 제거 (옵션 A 선택 시) — 별도 refactor task.)
