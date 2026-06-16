---
id: T-0444
title: UC-07 Export scope 요청 payload 검증 순수 helper validateExportScope
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 165
estimatedFiles: 2
created: 2026-06-16
independentStream: export-import
dependsOn: []
touchesFiles:
  - src/export/export-scope-validate.ts
  - src/export/export-scope-validate.spec.ts
plannerNote: "P7 R-57 게이트-free 8번째 단추 — UC-07 §7.3 Export scope payload 검증(form field-level error) 순수 결정 helper (DB/persistence 0)"
hqOrigin:
---

# T-0444 — UC-07 Export scope 요청 payload 검증 순수 helper validateExportScope

## Why

PLAN P7 "Import/export/restore (R-57)" 의 게이트-free building block chain (T-0437 selectExportRecords → T-0438 buildExportDump → T-0439 checkSchemaVersionCompat → T-0440 validateImportDumpStructure → T-0441 summarizeImportImpact → T-0442 buildImportRestorePlan → T-0443 buildExportImportAuditEntry) 의 다음 자연 단추다. 7 개 단추는 Export 선별·조립, Import 검증·복원 plan·Audit 항목까지 cover 했으나, **UC-07 §7.3 payload 검증 실패 (Export 의 scope 옵션 / dateRange / entitySelector 부적합 → 400 + 검증 메시지, WebUI 는 form field-level error)** 의 Export-side 사전 검증은 아직 어떤 helper 도 cover 하지 않는다. 현 `selectExportRecords` (T-0437) 는 선별 시점에 inline 으로만 검증해 첫 위반에서 즉시 throw 하므로, BackendAPI 가 query 를 실행하기 **전에** 사용자에게 보여줄 field-level 검증 결과 (어느 필드가 왜 부적합한지의 목록) 를 산출하지 못한다. 본 task 는 그 사전 검증을 **순수 결정 로직** 으로 박제한다 — `ExportScope` 후보 입력을 받아 §6.1 의 3 차원 옵션 규칙 (scope enum / range scope 의 dateRange 필수·유효성 / partial scope 의 entitySelector 필수·유효 entity / AND 조합) 에 맞는지 검사해, `{ valid, errors }` (errors 는 field + message 쌍 목록) verdict 를 반환하는 순수 함수. Import 입구의 `validateImportDumpStructure` (T-0440, transaction 전 reject) 와 동형인 **Export 입구의 reject-before-run** gate 다. REQ-032 (raw 미저장) 는 본 helper 가 scope option 만 검사하고 record / raw 를 다루지 않으므로 helper layer 에서 자연 유지된다.

## Required Reading

- `docs/use-cases/UC-07-export-import.md` — §6.1 Export scope 옵션 (3 차원: scope full/range/partial × dateRange × entitySelector, 조합 규칙·AND), §7.3 payload 검증 실패 (scope/dateRange/entitySelector 부적합 → 400 + field-level error), §4 precondition 2, §8 (a) Export postcondition.
- `src/export/export-scope-select.ts` — `ExportScope` / `ExportEntity` 타입 정의 (재사용, 새 도메인 타입 신설 0) + `VALID_SCOPES` 집합 + `assertValidRange` / 반열림 [start,end) 정책 + assertValidDate message convention. 본 task 는 이 inline 검증 규칙을 verdict 형태로 사전화한다 (재구현이 아니라 같은 규칙의 비-throw 버전).
- `src/export/import-dump-validate.ts` — Import 입구 검증 helper (T-0440) 의 verdict 패턴 (plain 결과 interface + 비-throw 누적 검증 + non-mutating + 입력 방어). Export 입구 검증의 mirror 대상 — verdict shape / errors 누적 / 함수 구조를 동형으로.

## Acceptance Criteria

본 task 는 `commitMode: pr` 코드 task 이므로 R-112 4 항목 + coverage 최소치를 모두 만족한다. spec 은 colocated (`src/export/export-scope-validate.spec.ts`).

- [ ] `src/export/export-scope-validate.ts` 신설 — `validateExportScope(input: unknown): ExportScopeValidation` 순수 함수. 결과 plain interface export:
  - `ExportScopeValidation { valid: boolean; errors: ExportScopeError[]; normalized?: ExportScope }` — `valid` 는 errors 가 빈 배열일 때만 true, `errors` 는 검출된 모든 위반의 누적 목록 (첫 위반에서 멈추지 않음 — §7.3 form field-level error 가 한 번에 여러 필드 표시 가능), `normalized` 는 valid 일 때만 채워지는 정규화된 ExportScope (예: full scope 의 무의미한 dateRange/entitySelector 제거).
  - `ExportScopeError { field: "scope" | "dateRange" | "entitySelector"; message: string }` — field 는 부적합 필드 식별 (WebUI 의 form field 매핑용), message 는 한국어 사유.
  - **scope 차원**: `scope` 부재 또는 "full"/"range"/"partial" 외 값 → `{ field: "scope", ... }` error (`export-scope-select.ts` 의 `VALID_SCOPES` 동형).
  - **range 차원**: scope="range" 인데 `dateRange` 부재 / `dateRange.start` 또는 `dateRange.end` 가 비-Date·Invalid Date / `start >= end` (역전·빈 반열림 구간) → `{ field: "dateRange", ... }` error. scope != "range" 인데 dateRange 가 주어지면 → normalized 에서 제거 (또는 무시 — error 아님, §6.1 "full → 전체").
  - **partial 차원**: scope="partial" 인데 `entitySelector` 부재 / 빈 배열 / 허용 ExportEntity (Assessment/Person/Group/LlmConfig/AuditLog) 외 값 포함 → `{ field: "entitySelector", ... }` error.
  - **AND 조합**: scope="range" + entitySelector 동시 지정은 정상 (§6.1 AND, valid). 단 entitySelector 의 entity 값 유효성은 range scope 에서도 검사.
  - 입력이 null/undefined/비-object → valid:false + `{ field: "scope", ... }` error (throw 가 아니라 verdict — §7.3 는 400 응답이라 throw 대신 verdict 반환이 BackendAPI 가 쓰기 자연스러움). non-mutating — 입력 객체/배열 변형 0 (freeze 된 입력 통과). normalized 는 항상 새 객체.
- [ ] **Happy-path unit test 1+**: scope="full" (dateRange/entitySelector 없음 → valid + normalized.scope="full"), scope="range" + 유효 dateRange ([start,end) start<end → valid + normalized.dateRange 박제), scope="partial" + 유효 entitySelector (→ valid), scope="range" + entitySelector AND 조합 (→ valid) 각각 검증.
- [ ] **Error path unit test 1+**: null/undefined/비-object 입력 (→ valid:false, field "scope"), scope 부재·허용 외 값·숫자 (→ field "scope"), range 인데 dateRange 부재·비-Date·Invalid Date·start>=end (→ field "dateRange"), partial 인데 entitySelector 부재·빈 배열·허용 외 entity 포함 (→ field "entitySelector") 각각 검증.
- [ ] **Flow / branch cover**: full / range / partial 각 분기 1+ test, dateRange 유효/무효 각 1+, entitySelector 유효/무효 각 1+, AND 조합 1+, scope != range 인데 dateRange 동봉 (normalized 정리) 1+, errors 다중 누적 (예: scope 부적합 + 동시에 다른 필드 부적합 시 여러 error 동시 수집) 1+ test.
- [ ] **Negative cases 충분 cover**: 각 예외 분기마다 1+ — null/undefined/문자열/숫자 input, scope 대소문자 mismatch ("Full") / 빈 문자열 / null, dateRange.start>end (역전) / start==end (빈 구간) / start·end 한쪽만 Date / NaN Date, entitySelector 빈 배열 / 비-배열 / 허용 외 entity 1 개 포함 / 허용 entity + 허용 외 entity 혼합, 여러 필드 동시 위반 시 errors 길이 ≥ 2 검증, valid:true 일 때 errors 가 빈 배열·normalized 존재 검증. non-mutating 검증 (Object.freeze 한 input + 중첩 dateRange/entitySelector 통과 + 원본 배열 length/원소 불변).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 파일은 selectExportRecords / validateImportDumpStructure 동형으로 100% 지향.
- [ ] `pnpm lint && pnpm build && pnpm test` green (tester 가 확인, R-110).

## Out of Scope

- REST controller / endpoint 배선 / GET /api/admin/export query string parse → ExportScope 매핑 / 400 응답 직렬화 — repository/controller 게이트 (CLAUDE.md §5), 후속 sub-slice 책임. 본 helper 는 검증 verdict 산출까지만.
- 실 DB dump query / 선별 실행 — T-0437 selectExportRecords 가 검증 통과한 scope 를 소비 (본 helper 는 검증만, 선별 재구현 0).
- file 크기 한계 / payload 무결성 hash (§7.3 의 다른 검증 항목) — Export scope 옵션 검증 범위 밖 (hash 는 Import 측, 크기는 streaming 후속).
- import-dump-validate 와의 공통 검증 util 추출 / 리팩토링 — 본 task 는 신규 파일만, 기존 helper 변경 0 (필요 시 Follow-up).
- 새 도메인 타입 신설 (ExportScope/ExportEntity 재사용) / 새 dependency / package.json 변경 / DB schema 변경 — 발생 시 BLOCKED.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점)
