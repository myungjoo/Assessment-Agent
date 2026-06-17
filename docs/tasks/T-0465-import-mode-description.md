---
id: T-0465
title: UC-07 §6.2 Import mode(replace/merge) 선택 사람-친화 설명 메시지 조립 순수 helper describeImportMode
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 195
estimatedFiles: 2
created: 2026-06-17
independentStream: uc07-export-import-helpers
dependsOn: []
touchesFiles:
  - src/export/import-mode-description.ts
  - src/export/import-mode-description.spec.ts
hqOrigin: null
plannerNote: "P7 UC-07 §6.2(replace/merge mode) Import 선택 설명 — Export 측 describeExportScope(T-0462)의 Import 대칭. pr, 게이트-free, dependsOn []. git grep describeImportMode/ImportModeDescription src/ 0 매칭."
---

# T-0465 — UC-07 §6.2 Import mode(replace/merge) 선택 사람-친화 설명 메시지 조립 순수 helper describeImportMode

## Why

UC-07 [§6.2](../use-cases/UC-07-export-import.md) 는 Import 의 두 mode 를 박제한다 — **replace mode (default)**: 기존 row 모두 삭제 후 file snapshot 으로 복원, **merge mode**: 기존 row 보존 + file artifact 의 row 추가(conflict 시 file 우선 또는 reject). [§5 step 2](../use-cases/UC-07-export-import.md) 의 confirmation dialog 는 Admin 에게 **선택한 mode 가 DB 에 무엇을 하는지** 를 사람-친화로 설명해야 한다 (destructive replace 인지, 보존적 merge 인지의 의미 전달).

직전 T-0462 `describeExportScope` 가 **Export 측 scope 선택**(§5 step 2 / §6.1)을 사람-친화 설명 메시지로 조립했다. 본 task 는 그 정확한 **Import 측 대칭** — Export 가 read-only scope 범위를 설명한다면, Import 는 mode(replace/merge)가 DB 에 가하는 동작(파괴적 교체 vs 보존적 병합)을 설명한다. 기존 28 helper(T-0437~T-0464)는 Import mode 의 *판정·계획·결과*는 cover 하나(`buildImportRestorePlan` 계획, `summarizeImportImpact` 영향, `buildRestoreConfirmation` 실행 전 destructive 경고, `buildRestoreResult` 완료 결과), **mode 선택 자체의 의미를 dialog 단계에서 설명하는 메시지**는 28 helper 중 0회 cover 된 gap 이다.

`buildRestoreConfirmation`(T-0453)과의 차이가 본 helper 의 존재 근거다 — confirmation 은 *실행 직전* 의 강한 경고(영향 row count + 명시 확인 요구)인 반면, 본 helper 는 *선택 단계* 에서 "이 mode 가 무엇을 하는가" 를 row count 없이 설명한다(아직 dump 가 분석되기 전 dialog). describeExportScope 가 scope 범위를 설명하는 것과 동형의 추상 레벨.

`describeImportMode(mode: ImportRestoreMode): ImportModeDescription` 는 이미 선택된 mode enum 만 입력으로 받아(실 DB / transaction / dump 분석 / REST / UI 0 — 순수·재실행 0) 한국어 headline + mode 동작 설명 detailLines + `destructive` flag(replace=true / merge=false) + `mergeStrategy`(merge 일 때만 conflict 정책 안내) + `reason` 슬러그(`"replace"` / `"merge"`)를 담은 단일 설명 모델을 조립한다. non-mutating, 한국어 TypeError/RangeError 입력 방어. `ImportRestoreMode` 타입(`src/export/import-restore-plan.ts`)을 **재사용** — 새 mode 도메인 타입 신설 0. touchesFiles disjoint·dependsOn [] — stage 5b 동시 driver 안전.

`git grep` 으로 `describeImportMode` / `ImportModeDescription` / `describeRestoreMode` / `RestoreModeDescription` / `importModeDescription` src/ **0 매칭** 확인(`ImportRestoreMode` 타입은 import-restore-plan.ts 에 기존 존재 — 재사용 대상).

## Required Reading

- `docs/use-cases/UC-07-export-import.md` — §6.2 (Import 의 merge 옵션: replace default 파괴적 교체 / merge 보존적 병합 + conflict 시 file 우선 또는 reject) + §5 step 2 (confirmation dialog) + §3 trigger 2 (destructive write operation) + §8 (b) Import postcondition.
- `src/export/export-scope-description.ts` — T-0462 `describeExportScope` / `ExportScopeDescription`. 본 helper 의 **직접 본보기(Export 대칭)** — plain 설명 모델 interface(headline + 설명 라인 배열 + flag + reason) + `isPlainObject`/`describe` 입력 방어 + 한국어 TypeError/RangeError convention + non-mutating + 불변 flag 패턴.
- `src/export/import-restore-plan.ts` — `ImportRestoreMode` 타입("replace" | "merge")의 정의 위치. 본 helper 의 `mode` 입력은 이 타입을 **재사용**(새 mode 도메인 타입 신설 금지). 허용 enum 집합 + RangeError 분기 convention 참조.
- `src/export/import-restore-confirmation.ts` — T-0453 `buildRestoreConfirmation` / `RestoreConfirmation`. 본 helper 와의 **경계 확인용**(confirmation 은 실행 직전 destructive 경고 + row 영향, 본 helper 는 선택 단계 mode 의미 설명 — 중복 조립 금지). `VALID_IMPORT_MODES` set + destructive flag convention 참조.

## Acceptance Criteria

- [ ] `src/export/import-mode-description.ts` 신설 — `describeImportMode(mode: ImportRestoreMode): ImportModeDescription` 순수 함수 + `ImportModeDescription` interface export. `ImportRestoreMode`(`import-restore-plan.ts`) 재사용. persistence/repository/transaction/DB/REST/dump 분석 호출 0, 새 외부 dependency 0.
- [ ] 모델 shape: `ImportModeDescription { headline: string; detailLines: string[]; destructive: boolean; mergeStrategy: string | null; reason: "replace" | "merge" }`. `destructive === (reason === "replace")` 불변. `mergeStrategy` 는 merge 일 때만 non-null(conflict 정책 안내 문자열), replace 일 때 null.
- [ ] `mode === "replace"` 분기 → §6.2 replace headline(한국어) + "기존 row 모두 삭제 후 file snapshot 으로 복원" 의미 detailLine + `destructive === true` + `mergeStrategy === null` + `reason === "replace"`.
- [ ] `mode === "merge"` 분기 → §6.2 merge headline + "기존 row 보존 + file artifact row 추가" 의미 detailLine + conflict 정책(file 우선 또는 reject) `mergeStrategy` 라인 + `destructive === false` + `reason === "merge"`.
- [ ] `src/export/import-mode-description.spec.ts` colocated 신설.
- [ ] Happy-path test 1+: `"replace"` → destructive 모델, `"merge"` → non-destructive + mergeStrategy 채워진 모델 각각 기대 shape(headline·detailLines·destructive·mergeStrategy·reason) 반환.
- [ ] Error path test 1+: `mode` 가 "replace"/"merge" 외 임의 문자열(예: "REPLACE" 대소문자 / "overwrite") → RangeError; `mode` 가 비-string(null/undefined/숫자/객체) → TypeError. 한국어 메시지 단언.
- [ ] Branch coverage: replace / merge 2 분기 + destructive true/false 분기 + mergeStrategy null/non-null 분기 각 1+ test.
- [ ] Negative cases 충분 cover: 허용 enum 외 문자열 RangeError / 비-string TypeError / 반환 객체의 detailLines 가 빈 배열이 아님 단언 / `destructive === (reason === "replace")` 불변이 두 mode 모두에서 성립 단언 / 동일 입력 2회 호출이 동등 결과(순수성) — 예외·불변·결정성 분기마다 1+.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 파일은 100% 목표.
- [ ] `pnpm lint && pnpm build && pnpm test` green, 새 외부 dependency 0.

## Out of Scope

- 실 Import 실행(transaction / 기존 row 삭제 / file snapshot 재구성 / merge conflict resolution 알고리즘) — AssessmentModule service 게이트된 후속(P5). 본 helper 는 mode 선택의 *의미만* 설명, 실 동작 0.
- row count / 영향 범위 표시 — 그건 `summarizeImportImpact`(T-가) + `buildRestoreConfirmation`(T-0453, 실행 직전 경고) 책임. 본 helper 는 dump 분석 전 mode 의미 설명만(row count 없음).
- conflict resolution 알고리즘(PK 충돌 / timestamp 비교 / dedupe 규칙) 구현 — §6.2 가 P5 service layer 책임으로 명시. 본 helper 의 `mergeStrategy` 는 안내 문자열일 뿐 실 로직 0.
- 실 HTTP / WebUI confirmation dialog 렌더링 / i18n — controller/frontend(P6) 영역. 본 helper 는 표시 모델만.
- 새 도메인 타입을 `ImportModeDescription` 외에 신설 금지(`ImportRestoreMode` 재사용).
- §6.1 Export scope 설명(T-0462 `describeExportScope`) / §7.x error 메시지(T-0459/T-0461/T-0463/T-0464 등)와 중복 조립 금지 — 본 helper 는 §6.2 Import mode 선택 설명만.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점)
