---
id: T-0454
title: UC-07 Export/Import Audit entry 사람-친화 로그 메시지 조립 순수 helper formatAuditLogLine
phase: P7
status: DONE
commitMode: pr
mergedAs: 06ceef4
prNumber: 365
reviewRounds: 1
coversReq: [REQ-030, REQ-032]
estimatedDiff: 190
estimatedFiles: 2
created: 2026-06-17
independentStream: export-import-helpers
dependsOn: []
touchesFiles: [src/export/export-import-audit-message.ts, src/export/export-import-audit-message.spec.ts]
sizeExempt: false
plannerNote: "P7 R-57 UC-07 §8 (b)(e) Audit row 의 ExportImportAuditEntry 를 사람-친화 로그 메시지 라인으로 조립 — 순수 DRY 합성, 게이트-free"
---

# T-0454 — UC-07 Export/Import Audit entry 사람-친화 로그 메시지 조립 순수 helper formatAuditLogLine

## Why

UC-07 §8 (b) Export·(e) Import 는 두 분기 모두에서 "Audit log 1 row 생성 (operation 종류 + actor + scope/file source + row count)" 을 의무로 박제한다. T-0443 의 `buildExportImportAuditEntry` 는 그 audit 항목을 직렬화 가능한 **구조화 객체**(`ExportImportAuditEntry`{operation/actorId/actorRole/occurredAt/rowCount/detail})로 박제했으나, **그 구조화 entry 를 사람(Admin·운영자)이 읽을 단일 로그 메시지 라인으로 조립하는 helper 는 17 helper 중 0회 cover** 된 gap 이다 — 실 controller/audit viewer/WebUI 배선이 audit entry 를 매번 풀어 "export by admin@... (scope=full, 1234 rows)" 같은 표시 문구를 중복 작성해야 한다. `formatAuditLogLine(entry)` 는 이미 산출된 `ExportImportAuditEntry`(T-0443)를 입력으로 받아(재실행 0 — 순수 DRY 합성) operation·actor·scope/source·row count 를 담은 한국어 한 줄 메시지 + 부가 detail 라인 배열을 단일 모델로 조립한다. REQ-032(raw 미저장)는 입력 entry 의 count/metadata 만 다뤄 자연 유지된다.

PLAN.md P7 Export/Import(R-57) 의 게이트-free building block stream(독립 stream `export-import-helpers`)의 열일곱 번째 단추. T-0453 의 `buildRestoreConfirmation`(구조화 RestorePlanSummary → 사람-친화 confirmation 모델)과 동형 패턴 — 본 task 는 구조화 `ExportImportAuditEntry` → 사람-친화 audit 로그 메시지 모델. dependsOn [] — 입력으로만 `ExportImportAuditEntry` 를 받으므로 schema/repository/transaction/REST 게이트 0.

## Required Reading

- `docs/use-cases/UC-07-export-import.md` — §8 (b) Export Audit row·(e) Import Audit row(operation 종류 + actor + scope/file source + row count), §5 step 12(Audit log insert 흐름), §2 actor(Admin/SuperAdmin 등급).
- `src/export/export-import-audit.ts` — 본 helper 의 **입력 타입** `ExportImportAuditEntry` / `ExportAuditDetail` / `ImportAuditDetail` / `ExportImportAuditOperation` / `AuditActorRole` 정의 + `ExportScope` 의존 + non-mutating·한국어 TypeError 입력 방어 convention(mirror 대상).
- `src/export/export-scope-select.ts` — `ExportScope`(scope full/range/partial + dateRange + entitySelector) + `ExportEntity` 5-union — Export 분기 메시지의 scope 요약에 필요.
- `src/export/import-restore-confirmation.ts` — 직전 동형 task(T-0453) — 구조화 데이터를 사람-친화 메시지 모델(headline + 라인 배열)로 조립하는 골격·한국어 문구·non-mutating·입력 방어 convention 의 mirror source.
- `src/export/import-restore-plan-summary.ts` — perEntity 5-entity 0-init 박제 + `isPlainObject`/assert 입력 방어 convention 참고.

## Acceptance Criteria

- [ ] `src/export/export-import-audit-message.ts` 신규 — 순수 함수 `formatAuditLogLine(entry: ExportImportAuditEntry): AuditLogMessage` + interface `AuditLogMessage` export. persistence/repository/transaction/DB/REST/logger 호출 0, 새 외부 dependency 0, 새 도메인 타입은 `AuditLogMessage` 만(`ExportImportAuditEntry`/`ExportAuditDetail`/`ImportAuditDetail`/`ExportScope`/`ExportEntity` 재사용).
- [ ] 의미 규칙: `AuditLogMessage` 는 `{ headline: string; detailLines: string[]; operation: ExportImportAuditOperation; }` 형태. headline 은 operation(export/import 한국어 표기) + actor(actorId·actorRole) + rowCount + occurredAt 을 담은 한국어 한 줄. detailLines 는 분기별:
  - export 분기 — scope 요약(scope kind + dateRange 존재 시 start/end + entitySelector 존재 시 entity 목록) + 0 아닌 entityCounts entity-별 라인.
  - import 분기 — mode(replace/merge 한국어 표기) + deleted/inserted/kept count + source(부재 시 "(파일 출처 미지정)" 등 명시) 라인.
- [ ] non-mutating — 입력 entry 객체/중첩 detail/entityCounts map 을 변형하지 않고 새 객체/배열 반환. detail 의 entity 별 count 가 모두 0 이거나 detailLines 가 비는 경계도 정상 처리(throw 0).
- [ ] 입력 방어: entry 비-object/null/배열 → 한국어 TypeError, entry.operation 이 "export"/"import" 외 → 한국어 RangeError, entry.detail 부재·비-object → TypeError, operation="export" 인데 detail 에 scope/entityCounts 부재 → TypeError, operation="import" 인데 detail 에 mode/deleted/inserted/kept 부재·비-정수 → TypeError, rowCount 비-정수 → TypeError, actorId 비-string → TypeError. `export-import-audit.ts` / `import-restore-confirmation.ts` 의 메시지 convention(`formatAuditLogLine: ...`) mirror.
- [ ] `src/export/export-import-audit-message.spec.ts` 신규(colocated) — R-112 4종:
  - happy-path: export entry(scope=full, entityCounts 일부 0) → headline 에 actor·rowCount·"export" 포함, detailLines 에 scope 요약 + 0 아닌 entity 라인 포함. import entry(mode=replace, source 지정) → headline 에 "import" 포함, detailLines 에 mode·deleted/inserted/kept·source 라인 포함.
  - error path: entry 부재/비-object/배열, operation invalid, detail 부재, export detail 의 scope/entityCounts 부재, import detail 의 mode/count 부재·비-정수, rowCount 비-정수, actorId 비-string 각 1+ TypeError/RangeError(한국어 메시지) 검증.
  - branch/flow cover: operation export vs import 분기, export 의 scope full vs range(dateRange 포함) vs partial(entitySelector 포함) 분기, entityCounts 0 vs >0 라인 포함 분기, import 의 source 지정 vs 부재(null) 분기 각 1+.
  - negative cases 충분 cover: null·undefined·배열 입력, operation "" / 대문자 "EXPORT" / 숫자, rowCount 음수/소수, count 비-정수, source 빈 문자열 vs null 구분, detail 깊은 중첩 누락 등 예외 분기마다 1+.
  - non-mutating regression: 입력 entry 를 deepFreeze 후 호출해도 throw 0 + 입력 불변 단언.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 — 신규 파일 line ≥ 80% / function ≥ 80%(본 helper 패턴은 100% 목표).

## Out of Scope

- 실 Audit log row insert / repository / Prisma / transaction / DB 호출 — schema/repository 게이트 후속(buildExportImportAuditEntry T-0443 와 동일 경계).
- `ExportImportAuditEntry` 산출 로직 재구현(본 helper 는 입력으로만 받음 — DRY).
- 실 audit viewer 렌더링 / WebUI 컴포넌트 / i18n / 페이지네이션 — P6 frontend 영역.
- 로그 영속(file/stdout/structured logger 출력) 배선 — 본 helper 는 메시지 모델만 반환.
- REST controller(GET /api/admin/audit 등) 직렬화·response 배선 — repository 게이트 후속.
- raw GitHub commit / Confluence 문서 fetch(REQ-032 — 본 helper 는 metadata 만 다룸).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 추가)
