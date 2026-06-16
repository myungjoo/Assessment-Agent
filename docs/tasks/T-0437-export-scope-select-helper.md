---
id: T-0437
title: UC-07 Export scope 선별 순수 helper (selectExportRecords)
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 150
estimatedFiles: 2
created: 2026-06-16
independentStream: p7-export-import
dependsOn: []
touchesFiles: [src/export/export-scope-select.ts, src/export/export-scope-select.spec.ts]
plannerNote: "P7 R-57/REQ-030 UC-07 Export 첫 게이트-free 단추 — scope 선별 순수 helper(persistence/schema 무관). T-0424/T-0425 helper-먼저 패턴 mirror."
---

# T-0437 — UC-07 Export scope 선별 순수 helper (selectExportRecords)

## Why

[PLAN.md](../PLAN.md) Phase P7 의 "Import / export / restore (R-57)" bullet 은 P7 잔여 중 아직 shipped 0 인 미착수 단추다(cron 주기 R-72 / manual trigger R-73 / 최근 N일 delete R-74 / 신규 인원 1년치 R-50 는 전부 shipped). [api.md §5 L122~126](../architecture/api.md) + [UC-07](../use-cases/UC-07-export-import.md) 가 `GET /api/admin/export?scope=...` 를 conceptual 박제했으나 `src/` 에 export 구현은 0 이다(`git grep export-scope|exportDump|buildExport src/` exit 1 — 미착수 확인). REQ-041 stream 이 입증한 "helper 먼저, 배선은 후속" 패턴([T-0424](T-0424-recent-deletion-window-helper.md) buildRecentDeletionWindow → [T-0425](T-0425-deletion-window-select-helper.md) selectInDeletionWindow → [T-0427](T-0427-recent-deletion-runner-service.md) runner)을 그대로 적용해, **Export 의 게이트-free 첫 단추 = scope 선별 순수 helper** 를 박제한다. 본 helper 는 persistence/repository/schema/module 호출 0(이미 메모리에 올라온 record 배열을 받아 scope 규칙으로 분류만) 이라 §5 의 schema/credential/architect 게이트를 전혀 건드리지 않는다. REQ-032(raw 미저장)는 Export payload 에 자연 전파 — 본 helper 는 입력으로 받은 record 만 다루며 raw 를 새로 fetch 하지 않으므로 invariant 가 helper layer 에서도 유지된다(UC-07 §1 invariant (a)).

## Required Reading

- [docs/use-cases/UC-07-export-import.md](../use-cases/UC-07-export-import.md) — §3 trigger 1(Export read-only) / §6.1 Export scope 옵션(3차원: scope full/range/partial × dateRange × entitySelector) / §8 (a) Export postcondition. 본 helper 가 cover 할 scope 분류 규칙의 source.
- [src/scheduling/deletion-window-select.ts](../../src/scheduling/deletion-window-select.ts) — mirror 할 순수-helper 패턴(반열림 [start,end) PeriodRange 분류 + assertValidDate/assertValidWindow + non-mutating + 입력 순서 보존 + 빈 배열 정상). 본 task 의 코드 골격 reference.
- [src/scheduling/deletion-window-select.spec.ts](../../src/scheduling/deletion-window-select.spec.ts) — colocated spec 작성 패턴(R-112 4종 + negative 충분 cover) reference.
- [src/common/period-boundary.ts](../../src/common/period-boundary.ts) L13~ — `PeriodRange { start: Date; end: Date }` interface 정의. dateRange 표현에 재사용(새 타입 신설 금지, 기존 import).

## Acceptance Criteria

- [ ] 새 파일 `src/export/export-scope-select.ts` 에 순수 함수 `selectExportRecords` 를 박제. 시그니처(이름은 가이드 — 구현 시 자연스럽게 조정 가능):
  - 입력: `scope: ExportScope`(아래) + `records: ReadonlyArray<ExportRecord>`. `ExportRecord` 는 본 파일에 최소 형태로 정의 — `{ entity: ExportEntity; instant: Date }` 같이 분류에 필요한 필드만(전체 row 형태는 P5 배선 책임이라 본 helper 는 분류 key 만 알면 됨).
  - `ExportScope` 는 UC-07 §6.1 의 3차원을 표현: `{ scope: "full" | "range" | "partial"; dateRange?: PeriodRange; entitySelector?: ExportEntity[] }`. `ExportEntity` 는 `"Assessment" | "Person" | "Group" | "LlmConfig" | "AuditLog"` enum/union(UC-07 §6.1 entitySelector 목록).
  - 출력: `{ selected: ExportRecord[]; excluded: ExportRecord[] }` — scope 규칙을 만족하는 record(selected) 와 그 외(excluded) 두 배열. 입력 순서 보존, non-mutating, 합집합 = 입력(중복/누락 0).
- [ ] 분류 규칙(UC-07 §6.1 정합):
  - `scope: "full"` → 모든 record selected(dateRange/entitySelector 무시).
  - `scope: "range"` → `dateRange` [start, end) 반열림에 드는 record 만 selected(start 포함·end 배타, deletion-window-select 와 동일 의미). `dateRange` 부재 시 RangeError.
  - `scope: "partial"` → `entitySelector` 에 포함된 entity 의 record 만 selected. `entitySelector` 부재/빈 배열 시 RangeError(아무것도 선택 안 되는 모호 상태 거부).
  - `scope: "range"` 이면서 `entitySelector` 도 주어지면 두 조건 AND(둘 다 만족해야 selected) — UC-07 §6.1 의 Cartesian product 조합 예("scope=range + dateRange + entitySelector" 분기 backup) cover.
- [ ] **Happy-path unit test**: `selectExportRecords` 의 full / range / partial / (range+entitySelector AND) 각 정상 경로 1+ test. 반열림 경계(start === instant 는 selected, end === instant 는 excluded) 1+ test.
- [ ] **Error path unit test**: scope 값 invalid(허용 외 문자열)→ error, range 인데 dateRange 부재 → RangeError, partial 인데 entitySelector 부재/빈 배열 → RangeError, dateRange.start >= end 역전 → RangeError, record.instant 비-Date/Invalid Date → TypeError(index 포함 메시지), records 가 배열 아님 → TypeError 각 1+.
- [ ] **Flow / branch coverage**: scope 3분기(full/range/partial) + range+entitySelector AND 분기 + 반열림 경계 분기 각 1+ test.
- [ ] **Negative cases 충분 cover**: 빈 records 입력(빈 분류, error 아님) / dateRange 경계값(start==end 역전 거부) / entitySelector 에 없는 entity 만 있는 records(전부 excluded) / NaN·Infinity instant / 음수 timestamp / 입력 배열 비변형(원본 freeze 후 호출해도 통과) 각 1+ test.
- [ ] colocated spec `src/export/export-scope-select.spec.ts` 에 위 test 작성(deletion-window-select.spec.ts mirror). helper fallback 불요(단일 spec).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% — 신규 helper 는 100% 목표).

## Out of Scope

- **persistence/repository/DB 조회 0** — 본 helper 는 이미 메모리에 올라온 record 배열만 받는다. 실 DB dump query(Assessment + Person + Group + LlmConfig + AuditLog read)는 후속 배선 task(repository 게이트 진입 시 재확인).
- **REST endpoint / controller / module 배선 0** — `GET /api/admin/export` controller, AssessmentModule provider 등록은 후속(T-0427 runner→T-0428 controller 동형 후속 sub-slice).
- **dump 직렬화 포맷(JSON/SQL/archive) 0** — 본 helper 는 record 분류만, 직렬화·streaming·file 생성은 후속.
- **Import / Restore / merge mode / schema version migration 0** — UC-07 §6.2/§6.3 의 destructive write 경로는 본 task 무관(별도 후속, transaction = schema/repository 게이트).
- 새 외부 dependency 추가 0 / schema.prisma 변경 0 / 새 ADR 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 추가)
