---
id: T-0458
title: UC-07 schema version 호환 판정 사람-친화 안내 메시지 조립 순수 helper buildVersionCompatMessage
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032]
dependsOn: []
independentStream: uc07-export-import-helpers
touchesFiles: [src/export/schema-version-message.ts, src/export/schema-version-message.spec.ts]
estimatedDiff: 190
estimatedFiles: 2
created: 2026-06-17
plannerNote: "P7 R-57 UC-07 §6.3 — checkSchemaVersionCompat(T-0439) verdict 를 사람-친화 안내 메시지로 조립하는 helper 0회-cover gap(git grep buildVersionCompatMessage/VersionCompatMessage src/export 0 매칭). pr, 게이트-free, dependsOn []."
---

# T-0458 — UC-07 schema version 호환 판정 사람-친화 안내 메시지 조립 순수 helper buildVersionCompatMessage

## Why

UC-07 [§6.3](../use-cases/UC-07-export-import.md) 은 업로드된 dump 의 schema version 이 현재 시스템 version 과 다를 때 **(i) 자동 migration 후보** 또는 **(ii) reject + 사용자에게 version mismatch 안내** (default) 를 박제한다. T-0439 `checkSchemaVersionCompat` 가 그 호환 판정을 구조화 verdict `SchemaVersionCompat{compatible, action: accept|migrate|reject, uploadedVersion, currentVersion, reason?}` 로 산출했으나, §6.3 (ii) 가 명시한 "**사용자에게 version mismatch 안내**" (사람이 읽을 메시지) + §6.3 (i) migrate 후보 안내 + accept 확인 문구는 21 helper 중 0회 cover 된 gap 이다 — `reason` 필드는 `"schema version mismatch: <u> ≠ <c>"` 같은 terse machine 문자열일 뿐 WebUI / form field-level error 가 그대로 표시할 사람-친화 모델이 아니다.

본 task 는 이미 산출된 `SchemaVersionCompat` verdict 를 입력으로 받아(재실행 0 — 순수 DRY 합성) 한국어 headline + 부가 detailLines + 후속 권고(actionable guidance) 를 담은 단일 메시지 모델 `VersionCompatMessage` 를 조립하는 **순수 helper** 다. 이는 T-0453 `buildRestoreConfirmation` / T-0454 `formatAuditLogLine` / T-0455 `buildRestoreResult` / T-0456 `buildExportResult` 가 확립한 "구조화 verdict → 사람-친화 메시지 모델" 패턴의 Import version-gate 측 적용이다. persistence / repository / transaction / DB / REST / file-parse / 실 migration 호출 0, 새 외부 dependency 0 — 게이트-free.

## Required Reading

- `docs/use-cases/UC-07-export-import.md` — §6.3 (schema version 차이, (i) migrate / (ii) reject default) + §7.3 (payload 검증 실패 → 400 + 검증 메시지) + §7.4 (Import file 손상).
- `src/export/schema-version-compat.ts` — T-0439 `checkSchemaVersionCompat` + `SchemaVersionCompat` / `SchemaVersionCompatOptions` 타입. 본 helper 의 입력 source.
- `src/export/export-import-audit-message.ts` — T-0454 `formatAuditLogLine` / `AuditLogMessage`. 구조화 → 사람-친화 메시지 모델 패턴 mirror 대상 (plain interface + assert 입력 방어 + 한국어 TypeError + non-mutating).
- `src/export/export-import-audit-message.spec.ts` (colocated spec) — spec 위치·구조 mirror 대상.
- `src/export/import-restore-confirmation.ts` — T-0453 `buildRestoreConfirmation`. headline + warnings[] + actionable 라인 조립 패턴 참고.

## Acceptance Criteria

- [ ] `src/export/schema-version-message.ts` 신설 — `buildVersionCompatMessage(compat: SchemaVersionCompat): VersionCompatMessage` 순수 함수 export. 입력 `SchemaVersionCompat`(T-0439 verdict) 을 받아 `{ headline: string; detailLines: string[]; action: "accept" | "migrate" | "reject"; blocking: boolean }` 모델 조립. raw 미저장(REQ-032) 정합 — version string / metadata 만 다루고 raw 미fetch.
- [ ] `action` 분기별 한국어 메시지: **accept** → 호환 확인 headline + blocking=false, **migrate** → 자동 migration 후보 안내 + uploaded→current 라인 + blocking=false(후속 결정 위임), **reject** → version mismatch 거부 headline + 재확인 안내 라인 + blocking=true. `blocking === (compat.action === "reject")` 불변 유지.
- [ ] `compat.uploadedVersion` / `compat.currentVersion` 을 detailLines 에 사람-친화로 노출. non-mutating — 입력 `compat` 변형 0 (freeze 된 객체로 호출해도 통과).
- [ ] 입력 방어: `compat` 가 비-object / null → 한국어 `TypeError`. `compat.action` 이 `accept|migrate|reject` 외 값 → 한국어 `TypeError` (또는 `RangeError`). `uploadedVersion` / `currentVersion` 이 비-string·빈 문자열 → 한국어 `TypeError`.
- [ ] `src/export/schema-version-message.spec.ts` (colocated) 신설 — R-112 4종 충족:
  - [ ] happy-path: `accept` / `migrate` / `reject` 각 action 에 대해 올바른 headline·detailLines·blocking 반환 test 1+ (각 1+).
  - [ ] error path: `compat` null/비-object, `action` 부정값, version string 부적합 각각 한국어 메시지 `TypeError`/`RangeError` test 1+.
  - [ ] flow / branch: 3개 action 분기 각각 별 test 분리 (accept blocking=false / migrate blocking=false / reject blocking=true).
  - [ ] negative cases 충분 cover: 빈 detailLines 경계 / version 동일한데 action=reject 같은 비정상 verdict 입력 / freeze 된 입력 non-mutating regression / uploadedVersion===currentVersion 경계 등 예외 분기마다 1+.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. `pnpm test:cov` 통과 (신규 파일 line ≥ 80% / function ≥ 80% — 가능하면 100%).

## Out of Scope

- 실 schema migration 수행 (§6.3 (i), P5 migration table 책임) — 본 helper 는 메시지 조립만.
- REST controller / 400 응답 직렬화 / form field-level error 배선 — repository/controller 게이트된 후속.
- file parse / 무결성 hash 재검증 / 압축 해제 (§7.4) — 별도 helper / 게이트된 후속.
- `checkSchemaVersionCompat`(T-0439) 자체 재구현 — 입력으로만 받는다 (DRY, 재실행 0).
- 새 도메인 타입은 `VersionCompatMessage` 만 신설 (`SchemaVersionCompat` 재사용). 새 외부 dependency 0.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점)
