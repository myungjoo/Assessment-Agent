---
id: T-0463
title: UC-07 §7.3 Export scope payload 검증 실패 사람-친화 안내 메시지 조립 순수 helper buildExportScopeRejection
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
  - src/export/export-scope-rejection-message.ts
  - src/export/export-scope-rejection-message.spec.ts
plannerNote: "P7 UC-07 §7.3 Export scope payload 검증 실패 안내 메시지 — Import 측 buildDumpValidationMessage(T-0459, §7.4)의 Export 대칭. pr, 게이트-free, dependsOn []."
---

# T-0463 — UC-07 §7.3 Export scope payload 검증 실패 사람-친화 안내 메시지 조립 순수 helper buildExportScopeRejection

## Why

UC-07 [§7.3](../use-cases/UC-07-export-import.md) (payload 검증 실패) 는 Export 의 scope 옵션 / dateRange / entitySelector 가 부적합할 때 `400 + 검증 메시지` 를 반환하고 WebUI 가 그것을 **form field-level error** 로 표시함을 박제한다. T-0444 `validateExportScope` 가 그 사전 검증을 구조화 verdict `ExportScopeValidation{ valid, errors: ExportScopeError[], normalized? }` 로 산출했으나, 그 `errors[]` 는 `{ field, message }` 쌍의 진단용 누적 배열일 뿐 — §7.3 이 명시한 사람이 읽을 reject **headline** + field 별 묶음 안내 + 재입력 actionable guidance + blocking flag 를 담은 메시지 모델은 25+ helper 중 0 회 cover 된 gap 이다.

이는 Import 측 `buildDumpValidationMessage` (T-0459, §7.4 dump 구조 reject → `DumpValidationMessage{ headline, detailLines, blocking }`) 의 **Export 측 대칭** 이다 — Import 입구는 file 손상(§7.4)을 reject 하고, Export 입구는 scope payload 부적합(§7.3)을 reject 한다. 두 흐름 모두 "구조화 verdict → 사람-친화 메시지 모델" 패턴을 따르며 (T-0453 buildRestoreConfirmation / T-0455 buildRestoreResult / T-0458 buildVersionCompatMessage / T-0459 buildDumpValidationMessage / T-0461 buildRestoreFailureMessage 가 확립), 본 helper 는 그 패턴의 §7.3 Export 입구 측 적용이다.

`buildExportScopeRejection(validation: ExportScopeValidation): ExportScopeRejectionMessage` 는 이미 산출된 `ExportScopeValidation` verdict 를 입력으로만 받아(재실행·재검증 0 — 순수 DRY 합성) 한국어 headline + field 별로 묶은 detailLines + 재입력 actionable guidance + blocking flag 를 담은 단일 메시지 모델을 조립한다. 실 DB query / scope 재검증 / REST / UI 배선 0 — 순수 합성. non-mutating, 한국어 TypeError/RangeError 입력 방어. touchesFiles disjoint·dependsOn [] — stage 5b 동시 driver 안전.

`git grep` 으로 `buildExportScopeRejection` / `ExportScopeRejectionMessage` / `exportScopeRejection` / `buildExportRejection` src/export 0 매칭 확인.

## Required Reading

- `docs/use-cases/UC-07-export-import.md` — §7.3 (payload 검증 실패 → 400 + form field-level error) + §6.1 (Export 3 차원 scope 옵션) + §8 (a) Export read-only.
- `src/export/export-scope-validate.ts` — T-0444 `validateExportScope` / `ExportScopeValidation` / `ExportScopeError{ field, message }`. 본 helper 의 **입력 verdict source** — field union(`"scope" | "dateRange" | "entitySelector"`) + errors 누적 의미를 mirror. (검증 로직 재구현 금지 — 입력으로만 받음.)
- `src/export/import-dump-validate-message.ts` — T-0459 `buildDumpValidationMessage` / `DumpValidationMessage`. 본 helper 의 **Import 측 대칭** — plain 모델 interface + `isPlainObject`/`describe` 입력 방어 + 한국어 TypeError/RangeError convention + non-mutating + `blocking === !valid` 불변 패턴의 직접 본보기.
- `src/export/import-dump-validate-message.spec.ts` (colocated spec) — R-112 4종 + negative 충분 + deepFreeze regression 패턴 mirror 대상.

## Acceptance Criteria

- [ ] `src/export/export-scope-rejection-message.ts` 신설 — `buildExportScopeRejection(validation: ExportScopeValidation): ExportScopeRejectionMessage` 순수 함수 + `ExportScopeRejectionMessage` interface export. `ExportScopeValidation` / `ExportScopeError` 재사용(새 도메인 타입은 `ExportScopeRejectionMessage` 만 신설). persistence/repository/transaction/DB/REST/scope 재검증 호출 0, 새 외부 dependency 0.
- [ ] 모델 shape: `{ headline: string; detailLines: string[]; blocking: boolean }`. `blocking === !validation.valid` 불변 (검증 통과면 비-blocking).
- [ ] `valid === true` 분기 → 검증 통과 headline(한국어 한 줄) + 확인 detailLine + `blocking === false`.
- [ ] `valid === false` 분기 → reject headline(부적합 field 개수 요약 한 줄) + `errors[]` 를 field 별로 묶은 사람-친화 detailLines(scope/dateRange/entitySelector 순, 원본 message 보존) + "scope 옵션을 수정해 다시 시도하세요" 취지 재입력 actionable 라인 + `blocking === true`.
- [ ] `src/export/export-scope-rejection-message.spec.ts` colocated 신설.
- [ ] Happy-path test 1+: `valid=true` verdict → 통과 모델, `valid=false` (단일 field 위반 / 다중 field 위반) verdict → 기대 `ExportScopeRejectionMessage` shape(headline·detailLines·blocking) 반환.
- [ ] Error path test 1+: `validation` 비-object/null/배열 → TypeError; `validation.valid` 비-boolean → TypeError; `validation.errors` 비-array → TypeError; `valid=false` 인데 `errors` 빈 배열(reject 인데 사유 0 모순) → RangeError; `valid=true` 인데 `errors` 비어있지 않음(모순) 처리 정책 명시 후 그 분기 test(거부 또는 무시 — 구현 정책 1택 후 단언).
- [ ] Branch coverage: valid true/false 분기 + 단일 field vs 다중 field 묶음 분기 + blocking 분기 각 1+ test.
- [ ] Negative cases 충분 cover: `errors[i]` 가 비-object / `field` 가 union 외 값 / `message` 비-string 등 깨진 error 원소 방어 분기, 입력 `validation`·중첩 `errors` 배열 deepFreeze 후 호출해도 throw 0 + 입력 불변 단언(non-mutating regression), detailLines 가 입력 message 를 변형 없이 보존하는지 단언 — 예외 분기마다 1+.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 파일은 100% 목표.
- [ ] `pnpm lint && pnpm build && pnpm test` green, 새 외부 dependency 0.

## Out of Scope

- scope payload *검증* 로직 재구현 (이미 T-0444 `validateExportScope` cover) — 본 helper 는 산출된 verdict 입력으로만 받음(DRY).
- 실 DB read-only query / dump 직렬화 / REST controller(`GET /api/admin/export`) 400 응답 직렬화·HTTP status 매핑 — repository/controller 게이트된 후속.
- Web UI form field-level error 컴포넌트 렌더링 / i18n (본 helper 는 표시 모델만 조립, UI 0) — P6 frontend 영역.
- §7.4 Import dump 구조 reject 안내(T-0459 `buildDumpValidationMessage` 책임) 와 중복 메시지 조립 금지 — 본 helper 는 §7.3 Export scope 측만.
- §7.5 DB write fail 안내(T-0461 `buildRestoreFailureMessage`) / Export scope 선택 *설명*(T-0462 `describeExportScope`, 검증 *전* 표시) 과 중복 금지 — 본 helper 는 검증 *실패* 안내만.
- 새 도메인 타입을 `ExportScopeRejectionMessage` 외에 신설 금지(`ExportScopeValidation`/`ExportScopeError` 재사용).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점)
