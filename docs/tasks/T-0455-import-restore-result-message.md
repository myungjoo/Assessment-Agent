---
id: T-0455
title: UC-07 Import 복원 완료 결과 메시지 조립 순수 helper buildRestoreResult
phase: P7
status: DONE
commitMode: pr
mergedAs: fc20a97
prNumber: 366
reviewRounds: 1
completedAt: 2026-06-17T06:19:51Z
coversReq: [REQ-030, REQ-032, REQ-037]
estimatedDiff: 190
estimatedFiles: 2
created: 2026-06-17
independentStream: export-import-helpers
dependsOn: []
touchesFiles: [src/export/import-restore-result.ts, src/export/import-restore-result.spec.ts]
sizeExempt: false
plannerNote: "P7 R-57 UC-07 §5 step13·§8 (c) Import 복원 완료 후 결과 메시지(복원 row count + 영향 요약 + 자동 재수집 안내) 조립 — 순수 DRY 합성, 게이트-free"
---

# T-0455 — UC-07 Import 복원 완료 결과 메시지 조립 순수 helper buildRestoreResult

## Why

UC-07 §5 step 13 (`WebUI->>Admin: 결과 표시 ... Import: 복원 완료 + "다음 평가 진행 시 비어있는 시간 구간 자동 재수집" 안내`) + §8 (a) `복원 row count + 영향 요약` 응답 + §8 (c) `UC-01 의 다음 발화가 복원된 master + 비어있는 시간 구간 자동 감지 → 재수집`(REQ-037 cross-reference) 은 Import transaction commit **이후** Admin 에게 보여줄 **복원 완료 결과 메시지** 조립을 박제한다. 그러나 17 building block(T-0437~T-0454) 은 **사전(pre-execution)** 흐름만 cover 한다 — T-0448 `summarizeRestorePlan` 은 *plan* breakdown(실행 전 예측), T-0453 `buildRestoreConfirmation` 은 *실행 전 강한 confirmation dialog*, T-0454 `formatAuditLogLine` 은 audit 로그 라인. **transaction commit 후의 결과(복원 완료) 메시지 — 실제 복원된 row count + 영향 요약 + REQ-037 자동 재수집 안내 — 를 조립하는 helper 는 17 helper 중 0회 cover** 된 gap 이다. 실 controller / WebUI 배선이 `RestorePlanSummary` 를 매번 풀어 "복원 완료 — 1234 row 복원(삭제 X·삽입 Y·보존 Z), 다음 평가 진행 시 비어있는 시간 구간이 자동 재수집됩니다" 같은 결과 표시 문구를 중복 작성해야 한다.

`buildRestoreResult(summary, mode)` 는 이미 산출된 `RestorePlanSummary`(T-0448) + `mode`(replace/merge)를 입력으로 받아(재실행 0 — 순수 DRY 합성) `{ headline, restoredCounts, impactLines[], reseedNotice }` 단일 결과 모델로 조립한다. `reseedNotice` 는 REQ-037 §8 (c) 자동 재수집 안내 문구를 담는다(replace/merge 양 mode 공통 — 복원 후 비어있는 구간은 항상 다음 발화가 재수집). REQ-032(raw 미저장)는 입력 summary 의 count/metadata 만 다뤄 자연 유지된다.

PLAN.md P7 Export/Import(R-57) 의 게이트-free building block stream(독립 stream `export-import-helpers`)의 열여덟 번째 단추. T-0453 `buildRestoreConfirmation`(실행 *전* confirmation)의 대칭 — 본 task 는 실행 *후* result 메시지. dependsOn [] — 입력으로만 `RestorePlanSummary` 를 받으므로 schema/repository/transaction/REST 게이트 0. 실 transaction commit · row count 산출 · REST response 직렬화는 §Out of Scope(게이트된 후속).

## Required Reading

- `docs/use-cases/UC-07-export-import.md` — §5 step 13(`결과 표시 ... Import: 복원 완료 + 자동 재수집 안내`), §8 (a) `복원 row count + 영향 요약` 응답·(c) `UC-01 의 다음 발화가 비어있는 시간 구간 자동 재수집`(REQ-037), §6.2 merge/replace mode.
- `src/export/import-restore-plan-summary.ts` — 본 helper 의 **입력 타입** `RestorePlanSummary`{deleted/inserted/kept 각 `RestorePlanGroupBreakdown`{total, perEntity 5-entity}} 정의 + `isPlainObject`/assert 입력 방어 convention(mirror 대상).
- `src/export/import-restore-confirmation.ts` — 직전 대칭 task(T-0453) — 구조화 `RestorePlanSummary` + mode("replace"|"merge")를 사람-친화 메시지 모델(headline + 라인 배열 + boolean 플래그)로 조립하는 골격·한국어 문구·non-mutating·입력 방어 convention 의 mirror source. mode 타입 시그니처(`"replace" | "merge"`)도 여기서 동일하게 사용.
- `src/export/export-scope-select.ts` — `ExportEntity` 5-union(Assessment/Person/Group/LLMConfig/AuditLog) — impactLines 의 entity-별 라인 조립에 필요.

## Acceptance Criteria

- [ ] `src/export/import-restore-result.ts` 신규 — 순수 함수 `buildRestoreResult(summary: RestorePlanSummary, mode: "replace" | "merge"): RestoreResult` + interface `RestoreResult` export. persistence/repository/transaction/DB/REST/logger 호출 0, 새 외부 dependency 0, 새 도메인 타입은 `RestoreResult` 만(`RestorePlanSummary`/`RestorePlanGroupBreakdown`/`ExportEntity` 재사용).
- [ ] 의미 규칙: `RestoreResult` 는 `{ headline: string; restoredCounts: { deleted: number; inserted: number; kept: number }; impactLines: string[]; reseedNotice: string; }` 형태.
  - `headline` 은 "복원 완료" + mode(replace/merge 한국어 표기) + 핵심 count 를 담은 한국어 한 줄.
  - `restoredCounts` 는 `summary.deleted.total`/`inserted.total`/`kept.total` 을 그대로 옮긴 요약 수치.
  - `impactLines` 는 deleted/inserted/kept 별 + 0 아닌 entity-별 영향 라인(replace mode 는 kept.total=0 이 정상 — §6.2, 그 경우 kept 라인 생략 가능).
  - `reseedNotice` 는 REQ-037 §8 (c) 자동 재수집 안내 한국어 문구(예: "다음 평가 진행 시 비어있는 시간 구간이 자동으로 재수집됩니다"). replace/merge 공통 비-빈 문자열.
- [ ] non-mutating — 입력 summary 객체/중첩 breakdown/perEntity map 을 변형하지 않고 새 객체/배열 반환. 모든 count 가 0 이거나 impactLines 가 비는 경계도 정상 처리(throw 0).
- [ ] 입력 방어: summary 비-object/null/배열 → 한국어 TypeError, summary.deleted/inserted/kept 부재·비-object → TypeError, 각 그룹의 total 비-정수·음수 → TypeError, perEntity 부재·비-object → TypeError, mode 가 "replace"/"merge" 외(""·"REPLACE"·숫자·null) → 한국어 RangeError. `import-restore-confirmation.ts`/`import-restore-plan-summary.ts` 의 메시지 convention(`buildRestoreResult: ...`) mirror.
- [ ] `src/export/import-restore-result.spec.ts` 신규(colocated) — R-112 4종:
  - happy-path: replace mode summary(deleted>0, kept=0) → headline 에 "복원 완료"·"replace 표기"·count 포함, restoredCounts 일치, impactLines 에 0 아닌 entity 라인 포함, reseedNotice 비-빈. merge mode summary(deleted=0, kept>0) → headline 에 "merge 표기" 포함, kept 라인 포함.
  - error path: summary 부재/비-object/배열, 그룹 부재, total 비-정수·음수, perEntity 부재, mode invalid 각 1+ TypeError/RangeError(한국어 메시지) 검증.
  - branch/flow cover: mode replace vs merge 분기, kept.total 0 vs >0 라인 포함 분기, entity count 0 vs >0 라인 포함 분기, 전체 count 0(빈 복원) 경계 각 1+.
  - negative cases 충분 cover: null·undefined·배열 입력, mode "" / 대문자 "MERGE" / 숫자 / null, total 음수/소수/NaN, perEntity 일부 entity 누락, 깊은 중첩 누락 등 예외 분기마다 1+.
  - non-mutating regression: 입력 summary 를 deepFreeze 후 호출해도 throw 0 + 입력 불변 단언.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 — 신규 파일 line ≥ 80% / function ≥ 80%(본 helper 패턴은 100% 목표).

## Out of Scope

- 실 Import transaction commit / row 삭제·삽입 실행 / repository / Prisma / DB 호출 — schema/repository 게이트 후속.
- `RestorePlanSummary` 산출 로직 재구현(본 helper 는 입력으로만 받음 — DRY, summarizeRestorePlan T-0448 책임).
- 실 자동 재수집(REQ-037) trigger / UC-01 cron 발화 배선 — 본 helper 는 안내 문구 문자열만 조립.
- 실 WebUI 결과 화면 렌더링 / 다운로드 / i18n — P6 frontend 영역.
- REST controller(POST /api/admin/restore response) 직렬화·response 배선 — repository 게이트 후속.
- raw GitHub commit / Confluence 문서 fetch(REQ-032 — 본 helper 는 metadata 만 다룸).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 추가)
