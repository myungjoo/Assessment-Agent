---
id: T-0462
title: UC-07 Export scope 선택 사람-친화 설명 메시지 조립 순수 helper describeExportScope
phase: P7
status: PLANNER-QUEUED
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 190
estimatedFiles: 2
created: 2026-06-17
independentStream: uc07-export-import-helpers
dependsOn: []
touchesFiles:
  - src/export/export-scope-description.ts
  - src/export/export-scope-description.spec.ts
plannerNote: "P7 UC-07 §5 step2 / §6.1 Export scope dialog 설명 메시지 — Import 측 buildRestoreConfirmation(T-0453) 의 Export 대칭. pr, 게이트-free, dependsOn []."
---

# T-0462 — UC-07 Export scope 선택 사람-친화 설명 메시지 조립 순수 helper describeExportScope

## Why

UC-07 §5 step 2 (`WebUI → Admin: Export 는 scope 옵션 선택 dialog`) + §6.1 (Export 의 3 차원 옵션 — scope `full`/`range`/`partial` × dateRange × entitySelector) 는 Admin 이 Export 를 확정하기 **전에** "내가 무엇을 내보내는지" 를 사람이 읽을 형태로 확인하는 흐름을 요구한다. 그러나 T-0437~T-0461 의 25 building block 은 Export scope 를 **분류·검증·결과 요약** (selectExportRecords T-0437 / validateExportScope T-0444 / summarizeExportSelection T-0449 / buildExportResult T-0456) 까지만 cover 하며, **선택된 scope 자체를 사람-친화 설명 메시지로 조립** 하는 helper 는 0 회 cover 다. 이는 Import 측 `buildRestoreConfirmation` (T-0453, RestorePlanSummary → 사람-친화 confirmation 모델) 의 **Export 측 대칭** 이다 — Export 는 read-only 라 destructive 경고는 없지만, 선택 scope 의 범위(전체/기간/entity 한정)를 dialog 에 표시할 설명 모델이 필요하다.

`describeExportScope(scope, options?)` 는 `ExportScope` (T-0437 의 `scope` / `dateRange` / `entitySelector`) 를 입력으로 받아(실 DB query·직렬화·REST·UI 배선 0 — 순수 합성·재실행 0) `{headline, scopeKind, scopeLine, dateRangeLine?, entityLines[], readOnly}` 형태의 `ExportScopeDescription` 을 조립한다. scope `full`/`range`/`partial` 분기별 설명 라인을 생성하고, range 분기는 dateRange(start/end ISO)를, partial 분기는 entitySelector 5 entity 의 사람-친화 라벨 라인을 만든다. `readOnly===true` 불변(Export 는 DB 무변화 — §8 (a)). non-mutating, 입력 방어(한국어 TypeError/RangeError).

## Required Reading

- `docs/use-cases/UC-07-export-import.md` — §5 step 2 (scope 옵션 dialog) + §6.1 (3 차원 scope 옵션) + §8 (a) (Export read-only DB 무변화).
- `src/export/export-scope-select.ts` — `ExportScope` / `ExportEntity` / `VALID_EXPORT_SCOPES` / `VALID_EXPORT_ENTITIES` 타입·상수 재사용 source. `assertValidDate`/`assertValidRange` message convention 참고.
- `src/export/import-restore-confirmation.ts` — Import 측 대칭 helper (구조화 → 사람-친화 모델 조립 패턴 mirror). describe* 의 verdict shape·입력 방어·non-mutating 패턴의 직접 본보기.
- `src/export/import-restore-confirmation.spec.ts` — colocated spec 의 R-112 4종 + negative 충분 + deepFreeze regression 패턴 mirror.
- `src/common/period-boundary.ts` — `PeriodRange` 타입(dateRange 차원, 새 타입 신설 금지·재사용).

## Acceptance Criteria

- [ ] `src/export/export-scope-description.ts` 신설 — `describeExportScope(scope: ExportScope, options?: { now?: Date }): ExportScopeDescription` 순수 함수 + `ExportScopeDescription` interface export. `ExportScope`/`ExportEntity`/`PeriodRange` 재사용(새 도메인 타입은 `ExportScopeDescription` 만 신설).
- [ ] scope `full` → headline + scopeLine(전체 entity 전 기간), `dateRangeLine` 부재, entityLines 는 5 entity 전체 표시. `readOnly===true`.
- [ ] scope `range` → dateRange(start/end)를 ISO 로 담은 `dateRangeLine` 생성. dateRange 부재 시 RangeError.
- [ ] scope `partial` → entitySelector 의 선택 entity 만 사람-친화 라벨 entityLines 로 표시. entitySelector 부재/빈 배열 시 RangeError(모호 상태 거부).
- [ ] `src/export/export-scope-description.spec.ts` colocated 신설.
- [ ] Happy-path test 1+: 각 scope 분기(full/range/partial)가 기대 `ExportScopeDescription` shape 반환.
- [ ] Error path test 1+: scope 비-object / `scope.scope` 허용 외 값 → TypeError; range 인데 dateRange 부재 / start>=end → RangeError; partial 인데 entitySelector 부재/빈 배열 → RangeError; dateRange.start·end 비-Date/Invalid Date → TypeError.
- [ ] Branch coverage: full/range/partial 3 분기 + dateRange 유무 + entitySelector 유무 분기 각 1+ test.
- [ ] Negative cases 충분 cover: 허용 외 entity 가 entitySelector 에 섞임(자연 무시 또는 거부 — 구현 정책 명시 후 그 분기 test), now 미지정 fallback, 입력 객체 deepFreeze 후 non-mutating 단언(반환값이 입력을 변형하지 않음).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 파일은 100% 목표.
- [ ] `pnpm lint && pnpm build && pnpm test` green, 새 외부 dependency 0.

## Out of Scope

- 실 DB read-only query / dump 직렬화 / file streaming / REST controller(`GET /api/admin/export`) 배선 — repository/schema 게이트된 후속.
- Web UI dialog 컴포넌트 렌더링(본 helper 는 표시 모델만 조립, UI 0).
- Export 결과 메시지(이미 T-0456 buildExportResult cover) — 본 helper 는 실행 *전* scope 설명만.
- 새 도메인 타입을 `ExportScopeDescription` 외에 신설 금지(ExportScope/ExportEntity/PeriodRange 재사용).
- scope 옵션 *검증*(이미 T-0444 validateExportScope cover) — 본 helper 는 검증 통과한 scope 의 설명만.

## Suggested Sub-agents

implementer → tester

## Follow-ups
