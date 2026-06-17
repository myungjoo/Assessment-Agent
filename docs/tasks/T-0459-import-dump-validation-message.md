---
id: T-0459
title: UC-07 Import dump 구조 검증 실패 사람-친화 안내 메시지 조립 순수 helper buildDumpValidationMessage
phase: P7
status: DONE
commitMode: pr
completedAt: 2026-06-17T08:15:00Z
completedBy: cron@local15-364f22Z
resultCommit: 02800d5
prNumber: 370
coversReq: [REQ-030, REQ-032]
dependsOn: []
independentStream: uc07-export-import-helpers
touchesFiles: [src/export/import-dump-validate-message.ts, src/export/import-dump-validate-message.spec.ts]
estimatedDiff: 190
estimatedFiles: 2
created: 2026-06-17
plannerNote: "P7 R-57 UC-07 §7.4 — validateImportDumpStructure(T-0440) verdict 를 사람-친화 file 재확인 안내 메시지로 조립하는 helper 0회-cover gap(git grep buildDumpValidationMessage/DumpValidationMessage src/export 0 매칭). pr, 게이트-free, dependsOn []."
---

# T-0459 — UC-07 Import dump 구조 검증 실패 사람-친화 안내 메시지 조립 순수 helper buildDumpValidationMessage

## Why

UC-07 [§7.4](../use-cases/UC-07-export-import.md) 는 업로드된 file 이 본 시스템 dump 포맷이 아니거나 partial corruption 일 때 **transaction 시작 전 reject (DB 변경 0) + 사용자에게 file 재확인 안내** 를 박제한다. T-0440 `validateImportDumpStructure` 가 그 구조 무결성 판정을 구조화 verdict `ImportDumpValidation{valid, issues: string[]}` 로 산출했으나, 그 `issues[]` 는 "recordCount !== records.length" 같은 **진단용 terse 문자열의 누적 배열** 일 뿐 — §7.4 가 명시한 사람이 읽을 reject headline + 재확인 actionable guidance + blocking flag 를 담은 메시지 모델은 21+ helper 중 0회 cover 된 gap 이다 (git grep buildDumpValidationMessage/DumpValidationMessage src/export 0 매칭 확인).

본 task 는 이미 산출된 `ImportDumpValidation` verdict 를 입력으로 받아(재실행 0 — 순수 DRY 합성) 한국어 headline + 부가 detailLines(누적 issues 를 사람-친화로 노출) + 후속 권고(actionable file 재확인 guidance) + blocking flag 를 담은 단일 메시지 모델 `DumpValidationMessage` 를 조립하는 **순수 helper** 다. 이는 T-0453 `buildRestoreConfirmation` / T-0454 `formatAuditLogLine` / T-0455 `buildRestoreResult` / T-0456 `buildExportResult` / T-0458 `buildVersionCompatMessage` 가 확립한 "구조화 verdict → 사람-친화 메시지 모델" 패턴의 Import 구조-gate(§7.4) 측 적용이다. persistence / repository / transaction / DB / REST / file-parse / 무결성 hash 재검증 호출 0, 새 외부 dependency 0 — 게이트-free.

## Required Reading

- `docs/use-cases/UC-07-export-import.md` — §7.4 (Import file 손상 → transaction 시작 전 reject + file 재확인 안내) + §7.3 (payload 검증 실패 → 400 + 검증 메시지) + §5 step 7 (payload 검증).
- `src/export/import-dump-validate.ts` — T-0440 `validateImportDumpStructure` + `ImportDumpValidation` 타입. 본 helper 의 입력 source (verdict 의 `valid` / `issues[]` 구조).
- `src/export/schema-version-message.ts` — T-0458 `buildVersionCompatMessage` / `VersionCompatMessage`. 구조화 verdict → 사람-친화 메시지 모델 패턴 mirror 대상 (plain interface + assert 입력 방어 + 한국어 TypeError + non-mutating + headline/detailLines/blocking).
- `src/export/schema-version-message.spec.ts` (colocated spec) — spec 위치·구조 mirror 대상.
- `src/export/import-restore-confirmation.ts` — T-0453 `buildRestoreConfirmation`. headline + warnings[]/detailLines + actionable 라인 조립 패턴 참고.

## Acceptance Criteria

- [ ] `src/export/import-dump-validate-message.ts` 신설 — `buildDumpValidationMessage(validation: ImportDumpValidation): DumpValidationMessage` 순수 함수 export. 입력 `ImportDumpValidation`(T-0440 verdict) 을 받아 `{ headline: string; detailLines: string[]; blocking: boolean }` 모델 조립. raw 미저장(REQ-032) 정합 — 구조 verdict 만 다루고 raw 미fetch.
- [ ] `valid` 분기별 한국어 메시지: **valid=true** → 구조 무결성 확인 headline + detailLines 빈 배열(또는 확인 라인 1) + blocking=false, **valid=false** → file 손상/포맷 불일치 reject headline + 누적 `issues[]` 를 사람-친화 detailLines 로 노출 + "file 재확인 후 재업로드" actionable 라인 + blocking=true. `blocking === !validation.valid` 불변 유지.
- [ ] `validation.issues` 를 detailLines 에 사람-친화로 노출(원본 순서 유지). non-mutating — 입력 `validation` 및 `validation.issues` 변형 0 (freeze 된 객체/배열로 호출해도 통과).
- [ ] 입력 방어: `validation` 이 비-object / null → 한국어 `TypeError`. `validation.valid` 가 비-boolean → 한국어 `TypeError`. `validation.issues` 가 비-array → 한국어 `TypeError`. `valid=false` 인데 `issues` 가 빈 배열인 비정상 verdict → 한국어 `TypeError`(또는 `RangeError`) (reject 인데 사유 0 은 모순).
- [ ] `src/export/import-dump-validate-message.spec.ts` (colocated) 신설 — R-112 4종 충족:
  - [ ] happy-path: `valid=true` / `valid=false`(issues 1+) 각 분기에 대해 올바른 headline·detailLines·blocking 반환 test 1+ (각 1+).
  - [ ] error path: `validation` null/비-object, `valid` 비-boolean, `issues` 비-array, valid=false+빈 issues 각각 한국어 메시지 `TypeError`/`RangeError` test 1+.
  - [ ] flow / branch: 2개 분기 각각 별 test 분리 (valid=true blocking=false / valid=false blocking=true).
  - [ ] negative cases 충분 cover: 다중 issues 누적 노출 순서 보존 / freeze 된 입력·freeze 된 issues 배열 non-mutating regression / valid=true 인데 issues 비어있지 않은 경계 입력 처리 / issues 원소가 빈 문자열인 경계 등 예외 분기마다 1+.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. `pnpm test:cov` 통과 (신규 파일 line ≥ 80% / function ≥ 80% — 가능하면 100%).

## Out of Scope

- file parse / JSON.parse / 압축 archive 해제 / 무결성 hash 재검증 (§7.4 의 parse 단계) — 본 helper 는 이미 파싱된 verdict 의 메시지 조립만.
- REST controller / 400 응답 직렬화 / form field-level error 배선 (§7.3 WebUI) — repository/controller 게이트된 후속.
- `validateImportDumpStructure`(T-0440) 자체 재구현 또는 추가 검증 규칙 — 입력으로만 받는다 (DRY, 재실행 0).
- schema version 호환 안내(§6.3, T-0458 `buildVersionCompatMessage` 책임) 와 중복 메시지 조립 금지 — 본 helper 는 구조 무결성(§7.4) 측만.
- 새 도메인 타입은 `DumpValidationMessage` 만 신설 (`ImportDumpValidation` 재사용). 새 외부 dependency 0.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점)
