---
id: T-0453
title: UC-07 Import 강한 confirmation dialog 메시지 조립 순수 helper buildRestoreConfirmation
phase: P7
status: DONE
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 190
estimatedFiles: 2
created: 2026-06-17
independentStream: export-import-helpers
dependsOn: []
touchesFiles: [src/export/import-restore-confirmation.ts, src/export/import-restore-confirmation.spec.ts]
sizeExempt: false
plannerNote: "P7 R-57 UC-07 §5 step2·step7 강한 confirmation dialog 메시지 조립 — RestorePlanSummary+mode 입력 순수 DRY 합성, 게이트-free"
---

# T-0453 — UC-07 Import 강한 confirmation dialog 메시지 조립 순수 helper buildRestoreConfirmation

## Why

UC-07 §5 step 2·step 7 + §3 trigger 2 는 Import / Restore 가 "가장 destructive 한 흐름 — 강한 confirmation dialog 필수 (destructive 명시 + 영향 범위 표시 + 기존 데이터 삭제 경고 + 사용자 명시 확인)" 을 요구한다. T-0437~T-0452 의 15 building block 은 영향 범위를 *구조화 데이터*(RestorePlanSummary{deleted/inserted/kept × total/perEntity}, ImportImpact, preflight verdict)로 박제했으나, **그 데이터를 사용자에게 보여줄 confirmation dialog *메시지 모델* 로 조립하는 helper 는 16 helper 중 0회 cover** 된 gap 이다 — 실 controller/WebUI 배선이 RestorePlanSummary 를 매번 풀어 경고 문구를 중복 작성해야 한다. buildRestoreConfirmation(summary, mode) 는 이미 산출된 RestorePlanSummary(T-0448) 와 import mode(replace/merge)를 입력으로 받아(재실행 0 — 순수 DRY 합성) {destructive, requiresExplicitConfirm, headline, warnings[], impactLines[]} 단일 confirmation 모델로 통합한다. REQ-032(raw 미저장)는 입력 summary 의 count 만 다뤄 자연 유지.

PLAN.md P7 Export/Import(R-57) 의 게이트-free building block stream(독립 stream export-import-helpers) 의 열여섯 번째 단추. dependsOn [] — 입력으로만 RestorePlanSummary 를 받으므로 schema/repository/transaction/REST 게이트 0.

## Required Reading

- `docs/use-cases/UC-07-export-import.md` — §3 trigger 2(강한 confirmation), §5 step 2·step 7(confirmation dialog 흐름), §6.2(replace/merge mode), §8 (a) Export·(b) Import postcondition.
- `src/export/import-restore-plan-summary.ts` — 본 helper 의 입력 타입 `RestorePlanSummary` / `RestorePlanGroupBreakdown` 정의 + perEntity 5-entity 0-init 패턴 + assertValidDate/isPlainObject 입력 방어 convention(mirror 대상).
- `src/export/export-scope-select.ts` — `ExportEntity` 5-union(perEntity key 집합) + `VALID_EXPORT_ENTITIES` 상수.
- `src/export/import-restore-preview.ts` — 순수-helper 골격(plain 요약 interface + 한국어 TypeError 메시지 convention + non-mutating + 빈 입력 정상)의 mirror source.
- `src/export/import-preflight-summary.ts` — 다중 누적·throw 0 verdict 합성 패턴 참고(blockingIssues/warnings 누적 mirror).

## Acceptance Criteria

- [ ] `src/export/import-restore-confirmation.ts` 신규 — 순수 함수 `buildRestoreConfirmation(summary: RestorePlanSummary, mode: "replace" | "merge"): RestoreConfirmation` + interface `RestoreConfirmation` export. persistence/repository/transaction/DB/REST 호출 0, 새 외부 dependency 0, 새 도메인 타입은 RestoreConfirmation 만(RestorePlanSummary/ExportEntity 재사용).
- [ ] 의미 규칙: `destructive === (mode === "replace" && summary.deleted.total > 0)` — replace mode 에서 삭제될 row 가 있으면 destructive. `requiresExplicitConfirm === destructive` (강한 명시 확인 필요). headline 은 mode·삭제/삽입/보존 total 을 담은 한국어 한 줄. warnings[] 에 replace+삭제 row 존재 시 "기존 데이터 N row 삭제" 경고 1+ 누적(throw 0). impactLines[] 는 deleted/inserted/kept 각 그룹의 total + 0 아닌 perEntity 만 한국어 라인으로 나열.
- [ ] non-mutating — 입력 summary 객체/중첩 perEntity map 을 변형하지 않고 새 객체/배열 반환. 빈 영향(모든 total 0) 정상 처리(destructive=false, warnings=[]).
- [ ] 입력 방어: summary 비-object/null/배열 → 한국어 TypeError, summary.deleted/inserted/kept 부재·비-object → 한국어 TypeError, total 비-정수 → TypeError, mode 가 "replace"/"merge" 외 → 한국어 TypeError. import-restore-plan-summary.ts 의 메시지 convention(`buildRestoreConfirmation: ...`) mirror.
- [ ] `src/export/import-restore-confirmation.spec.ts` 신규(colocated) — R-112 4종:
  - happy-path: replace mode + 삭제/삽입 row 존재 → destructive=true·requiresExplicitConfirm=true·warnings 1+·impactLines 0 아닌 entity 만 포함. merge mode → destructive=false.
  - error path: summary 부재/비-object, deleted/inserted/kept 부재, total 비-정수, mode invalid 각 1+ TypeError(한국어 메시지) 검증.
  - branch/flow cover: mode replace vs merge 분기, deleted.total>0 vs ===0 분기, perEntity 0 vs >0 라인 포함 분기, 빈 영향(전 total 0) 분기 각 1+.
  - negative cases 충분 cover: null·undefined·배열 입력, 음수/소수 total, mode "" / 대문자 "REPLACE" / 숫자, 깊은 중첩 perEntity 누락 등 예외 분기마다 1+.
  - non-mutating regression: 입력 summary 를 deepFreeze 후 호출해도 throw 0 + 입력 불변 단언.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 — 신규 파일 line ≥ 80% / function ≥ 80%(본 helper 패턴은 100% 목표).

## Out of Scope

- 실 Import transaction 실행 / DB delete-insert / row count 실측 — schema/repository 게이트 후속.
- 실 confirmation dialog 렌더링 / WebUI 컴포넌트 / i18n — P6 frontend 영역.
- REST controller(POST /api/admin/restore) multipart 수신·400/409 직렬화·response 배선 — repository 게이트 후속.
- RestorePlanSummary 산출 로직 재구현(본 helper 는 입력으로만 받음 — DRY).
- merge mode 의 conflict resolution 알고리즘(detectImportMergeConflicts T-0451 책임, 본 helper 는 결과 미참조).
- Audit log row insert(buildExportImportAuditEntry T-0443 책임).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 추가)

## Result (DONE 2026-06-17T04:48Z)

- PR #364 squash merge `a49a337`, reviewer round1 APPROVE, 4-게이트 PASS, CI green.
- 신규 `src/export/import-restore-confirmation.ts`(+160) — `buildRestoreConfirmation(summary, mode)` + `RestoreConfirmation` interface. `RestorePlanSummary`/`RestorePlanGroupBreakdown`/`ExportEntity` 재사용, 새 도메인 타입은 `RestoreConfirmation` 만, 새 외부 dep 0. `destructive===(mode==="replace" && deleted.total>0)`, `requiresExplicitConfirm===destructive`, headline·warnings·impactLines 한국어 조립, non-mutating, 한국어 TypeError 입력 방어.
- 신규 spec 23 test pass(happy/error/branch/negative 충분 + deepFreeze regression), 신규 파일 stmt/line/func 100%·branch 90.62% cov(≥80%). full suite 3765 pass.
- P7 Export/Import(R-57) 열여섯 번째 게이트-free 단추 shipped.
