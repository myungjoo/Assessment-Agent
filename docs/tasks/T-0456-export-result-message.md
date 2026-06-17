---
id: T-0456
title: UC-07 Export 완료 결과 메시지 조립 순수 helper buildExportResult
phase: P7
status: DONE
completedAt: 2026-06-17T06:55:00Z
mergedAs: 7b6af6f
prNumber: 367
reviewRounds: 1
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 190
estimatedFiles: 2
created: 2026-06-17
independentStream: export-import-helpers
dependsOn: []
touchesFiles: [src/export/export-result.ts, src/export/export-result.spec.ts]
sizeExempt: false
plannerNote: "P7 R-57 UC-07 §5 step13(Export 다운로드 완료)·§8 (a) Export 완료 결과 메시지(선별 row count + scope 요약 + Audit 영향) 조립 — 순수 DRY 합성, 게이트-free, T-0455 Import 대칭"
---

# T-0456 — UC-07 Export 완료 결과 메시지 조립 순수 helper buildExportResult

## Why

UC-07 §5 step 13 (`WebUI->>Admin: 결과 표시 (Export: 다운로드 완료 ...)`) + §8 (a) Export postcondition (`DB 상태 무변화 (read-only operation)` + `Audit log 1 row 생성 — Export 종류 + actor + scope + row count` + `Admin 에게 file artifact 전달 완료`) 은 Export 직렬화 **이후** Admin 에게 보여줄 **Export 완료 결과 메시지** 조립을 박제한다. 그러나 18 building block(T-0437~T-0455) 의 result/message 조립 helper 들은 전부 **Import 측 흐름**만 cover 한다 — T-0448 `summarizeRestorePlan`(Import plan breakdown), T-0453 `buildRestoreConfirmation`(Import 실행 전 confirmation), T-0454 `formatAuditLogLine`(Export·Import audit 라인), T-0455 `buildRestoreResult`(Import 실행 후 result). **Export 흐름의 완료 결과(선별된 row count + scope 요약 + entity-별 영향)를 사람이 읽을 단일 결과 메시지로 조립하는 helper 는 19 helper 중 0회 cover** 된 gap 이다. T-0449 `summarizeExportSelection` 은 `ExportSelectionSummary`{selected/excluded breakdown + instantRange} 구조화 산출까지만 하고, "다운로드 완료 — 1234 row export(Assessment X·Person Y ...), scope=range(2026-01-01~2026-03-31)" 같은 **사람-친화 결과 표시 문구**는 실 controller / WebUI 배선이 매번 풀어 중복 작성해야 한다.

`buildExportResult(summary, scope)` 는 이미 산출된 `ExportSelectionSummary`(T-0449) + `ExportScope`(T-0437)를 입력으로 받아(재실행 0 — 순수 DRY 합성) `{ headline, exportedCounts, impactLines[], scopeLine }` 단일 결과 모델로 조립한다. 이는 **T-0455 `buildRestoreResult`(Import 실행 후 result)의 Export 측 대칭** — Import 는 복원 결과 + 재수집 안내, Export 는 다운로드 완료 + scope 요약 + 영향 범위. REQ-032(raw 미저장)는 입력 summary 의 count/metadata 만 다뤄 자연 유지된다(§8 (a) Export payload 에 raw 자연 부재).

PLAN.md P7 Export/Import(R-57) 의 게이트-free building block stream(독립 stream `export-import-helpers`)의 열아홉 번째 단추. dependsOn [] — 입력으로만 `ExportSelectionSummary` + `ExportScope` 를 받으므로 schema/repository/transaction/REST 게이트 0. 실 dump 직렬화 · file streaming · REST response 배선 · 실 Audit row insert 는 §Out of Scope(게이트된 후속).

## Required Reading

- `docs/use-cases/UC-07-export-import.md` — §5 step 13(`결과 표시 (Export: 다운로드 완료 ...)`), §8 (a) Export postcondition(DB 무변화 + Audit row(Export 종류 + actor + scope + row count) + file artifact 전달), §6.1 Export scope 옵션(full/range/partial × dateRange × entitySelector).
- `src/export/export-selection-summary.ts` — 본 helper 의 **첫 입력 타입** `ExportSelectionSummary`{selected/excluded 각 `ExportSelectionGroupBreakdown`{total, perEntity 5-entity, instantRange{earliest,latest}|null}} 정의 + `isPlainObject`/`assertValidDate` 입력 방어 convention(mirror 대상).
- `src/export/export-scope-select.ts` — 본 helper 의 **둘째 입력 타입** `ExportScope`{scope: "full"|"range"|"partial", dateRange?, entitySelector?} + `ExportEntity` 5-union(Assessment/Person/Group/LlmConfig/AuditLog) + `VALID_EXPORT_SCOPES` 상수. scopeLine 조립과 입력 방어(허용 scope 외 RangeError)에 필요.
- `src/export/import-restore-result.ts` — 직전 대칭 task(T-0455) — 구조화 summary + mode 를 사람-친화 결과 메시지 모델(headline + counts + 라인 배열)로 조립하는 골격·한국어 문구·non-mutating·입력 방어 convention 의 mirror source.

## Acceptance Criteria

- [ ] `src/export/export-result.ts` 신규 — 순수 함수 `buildExportResult(summary: ExportSelectionSummary, scope: ExportScope): ExportResult` + interface `ExportResult` export. persistence/repository/transaction/DB/REST/logger/file-stream 호출 0, 새 외부 dependency 0, 새 도메인 타입은 `ExportResult` 만(`ExportSelectionSummary`/`ExportSelectionGroupBreakdown`/`ExportScope`/`ExportEntity` 재사용).
- [ ] 의미 규칙: `ExportResult` 는 `{ headline: string; exportedCounts: { selected: number; excluded: number }; impactLines: string[]; scopeLine: string; }` 형태.
  - `headline` 은 "다운로드 완료" + 핵심 selected row count 를 담은 한국어 한 줄.
  - `exportedCounts` 는 `summary.selected.total`/`summary.excluded.total` 을 그대로 옮긴 요약 수치.
  - `impactLines` 는 selected 의 0 아닌 entity-별 영향 라인(`perEntity` 기반). excluded 가 0 보다 크면 제외 row 요약 라인도 포함(scope=full 이면 excluded.total=0 이 정상 — §6.1, 그 경우 제외 라인 생략 가능).
  - `scopeLine` 은 scope(full/range/partial 한국어 표기) + range scope 면 dateRange 요약 + partial scope 면 entitySelector 요약을 담은 한국어 한 줄(§8 (a) Audit 의 scope 표시).
- [ ] non-mutating — 입력 summary 객체/중첩 breakdown/perEntity map/instantRange 와 scope 객체/entitySelector 배열을 변형하지 않고 새 객체/배열 반환. selected/excluded 가 모두 0 이거나 impactLines 가 비는 경계도 정상 처리(throw 0).
- [ ] 입력 방어: summary 비-object/null/배열 → 한국어 TypeError, summary.selected/excluded 부재·비-object → TypeError, 각 그룹의 total 비-정수·음수 → TypeError, perEntity 부재·비-object → TypeError, scope 비-object/null → TypeError, scope.scope 가 "full"/"range"/"partial" 외(""·"FULL"·숫자·null) → 한국어 RangeError. `import-restore-result.ts`/`export-selection-summary.ts` 의 메시지 convention(`buildExportResult: ...`) mirror.
- [ ] `src/export/export-result.spec.ts` 신규(colocated) — R-112 4종:
  - happy-path: scope=full summary(selected>0, excluded=0) → headline 에 "다운로드 완료"·count 포함, exportedCounts 일치, impactLines 에 0 아닌 entity 라인 포함, scopeLine 에 "full(전체)" 류 표기 포함. scope=range summary(selected/excluded 분배) → scopeLine 에 dateRange 요약 + 제외 라인 포함. scope=partial → scopeLine 에 entitySelector 요약 포함.
  - error path: summary 부재/비-object/배열, 그룹 부재, total 비-정수·음수, perEntity 부재, scope 부재, scope.scope invalid 각 1+ TypeError/RangeError(한국어 메시지) 검증.
  - branch/flow cover: scope full vs range vs partial 분기, excluded.total 0 vs >0 라인 포함 분기, entity count 0 vs >0 라인 포함 분기, 전체 selected 0(빈 export) 경계 각 1+.
  - negative cases 충분 cover: null·undefined·배열 입력, scope.scope "" / 대문자 "RANGE" / 숫자 / null, total 음수/소수/NaN, perEntity 일부 entity 누락, dateRange/entitySelector 부재·비정상 입력, 깊은 중첩 누락 등 예외 분기마다 1+.
  - non-mutating regression: 입력 summary + scope 를 deepFreeze 후 호출해도 throw 0 + 입력 불변 단언.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 — 신규 파일 line ≥ 80% / function ≥ 80%(본 helper 패턴은 100% 목표).

## Out of Scope

- 실 Export dump 직렬화 / read-only query / repository / Prisma / DB 호출 — schema/repository 게이트 후속.
- `ExportSelectionSummary` 산출 로직 재구현(본 helper 는 입력으로만 받음 — DRY, summarizeExportSelection T-0449 책임).
- 실 Audit log row insert(§8 (a)) — repository 게이트 후속. 본 helper 는 메시지 문자열만 조립.
- 실 file artifact streaming / download / 압축 archive — P5 service layer + P6 frontend 영역.
- REST controller(GET /api/admin/export response) 직렬화·response 배선 — repository 게이트 후속.
- raw GitHub commit / Confluence 문서 fetch(REQ-032 — 본 helper 는 metadata 만 다룸).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 추가)
