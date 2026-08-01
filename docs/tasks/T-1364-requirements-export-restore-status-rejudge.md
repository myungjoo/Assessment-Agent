---
id: T-1364
title: requirements.md 49 행 REQ-030 Export/backup + Restore 상태를 실측 기반 재판정
phase: P7
status: DONE
commitMode: direct
coversReq: [REQ-030]
estimatedDiff: 14
estimatedFiles: 2
created: 2026-08-01
independentStream: requirements-status-resync
dependsOn: []
touchesFiles:
  - docs/requirements.md
  - docs/tasks/T-1364-requirements-export-restore-status-rejudge.md
plannerNote: "requirements-status-resync 10 번째 slice — T-1363 Follow-ups 가 지목한 REQ-030 (ExportJob/ImportJob model + e2e 5 종 실재로 PLANNED stale 의심)"
---

# T-1364 — requirements.md 49 행 REQ-030 Export/backup + Restore 상태를 실측 기반 재판정

## Why

[docs/requirements.md](../requirements.md) 49 행 REQ-030 (README 57 행 — "평가 자료가 저장된 공간은 쉽게 export 하여 backup 하고 restore 하여 reset") 은 아직 상태 컬럼이 `PLANNED` 이지만, `prisma/schema.prisma` 에 `ExportJob` (614 행) · `ImportJob` (649 행) model 이 실재하고 `src/export/` · `src/import/` 모듈과 `test/e2e/export-download.e2e-spec.ts` 등 e2e 5 종이 main 에 안착해 있어 표가 실제 코드베이스와 어긋난다. T-1363 Follow-ups 가 다음 slice 후보로 명시적으로 지목한 row 이며, `requirements-status-resync` stream 의 10 번째 slice 로 표를 requirements 추적의 신뢰 가능한 single source of truth 로 되돌린다.

## Required Reading

- `docs/requirements.md` — 49 행 (REQ-030) 및 9 행의 상태 enum 정의
- `docs/tasks/T-1363-requirements-storage-policy-status-rejudge.md` — 직전 slice 의 상태 문자열 서술 포맷 (`DONE (implemented-on-main — <근거>` + `한계 — ...)`) 을 그대로 따른다
- `README.md` 57 행 — REQ-030 의 원문 지시 (export → backup, restore → reset 두 축)
- `prisma/schema.prisma` — `ExportJob` (614 행~) · `ImportJob` (649 행~) model 정의
- `src/export/export.controller.ts` — endpoint 실측 (`@Post()` · `@Get("running")` · `@Get(":id/download")` · `@Get(":id")` 등)
- `src/import/import.controller.ts` — endpoint 실측 (`@Post()` · `@Post("preview")` · `@Get("modes")` · `@Get(":id")` 등)

## Acceptance Criteria

- [x] `src/export/export.controller.ts` · `src/import/import.controller.ts` 의 `@Get`/`@Post` decorator 를 실측해 export 축과 restore 축 각각의 실재 endpoint 경로를 확인하고, 그 중 대표 경로를 상태 문자열에 인용한다 (추측한 경로를 적지 않는다).
- [x] `prisma/schema.prisma` 의 `ExportJob` · `ImportJob` model 이 실재함을 확인하고 model 명을 근거로 인용한다.
- [x] `test/e2e/` 의 export/import 관련 e2e spec 파일 목록과 각 파일의 `it(` 개수를 실측해 (예: `grep -c "it(" test/e2e/export-download.e2e-spec.ts`), 검증 위치 컬럼 `e2e` 가 실제 근거를 갖는지 확인한 뒤 개수를 상태 문자열에 인용한다.
- [x] REQ-030 (49 행) 의 상태 컬럼을 실측 결과에 따라 `PLANNED` → `DONE (implemented-on-main — <근거>)` 또는 근거 부족 시 `PLANNED` 유지 + 유지 사유 부기 중 하나로 갱신한다. 근거에는 실재하는 controller 경로 1 개 이상 + e2e spec 파일 경로 1 개 이상이 포함돼야 한다.
- [x] README 원문의 두 축 (export→backup / restore→**reset**) 중 실측으로 확인되지 않은 부분 (예: restore 가 기존 데이터를 완전 reset 하는지 vs merge 모드인지, `import-restore-plan` / `import-merge-conflict` 의 mode 처리) 은 상태 문자열 안에 "한계 —" 로 1~2 절 부기한다. 확인되지 않은 사실을 DONE 근거로 쓰지 않는다.
- [x] `grep -n "REQ-030" docs/requirements.md` 결과에서 해당 행의 상태 컬럼이 갱신됐고, 표의 컬럼 수 (`|` 구분 8 개) 가 다른 행과 동일하게 유지됨을 확인한다. `wc -l docs/requirements.md` 와 `grep -c "^| REQ-" docs/requirements.md` 값이 편집 전후 불변임도 확인한다.
- [x] 본 task 파일의 `status` 를 `DONE` 으로 바꾸고 완료 시각·결과 요약 (실측값 포함) 을 추가한다.

## Out of Scope

- 상태 컬럼 외 다른 컬럼 (README 행 번호 · 분류 · phase · 구현 위치 · 검증 위치) 수정 — 검증 위치 컬럼 재판정은 별도 slice 다.
- `prisma/schema.prisma` · `src/` · `test/` 등 코드 변경 일체 (본 task 는 `commitMode: direct` doc-only).
- export/import 기능 자체의 결함 수정 · 신규 endpoint 추가 · restore reset 모드 구현 (발견 시 Follow-ups 에만 적는다).
- 새 ADR 작성 또는 기존 ADR status 변경.
- REQ-030 외 다른 `PLANNED` row 재판정 (다음 slice 로 미룬다). 특히 인접한 REQ-031 (재수집 중복 방지) · REQ-033 은 건드리지 않는다.

## Suggested Sub-agents

`implementer` (doc-only 실측 + 표 갱신). 코드 변경이 0 이므로 tester 는 생략한다 (CLAUDE.md §3.2 R-110 의 direct-mode doc-only 면제).

## Follow-ups

- REQ-031 (재수집 중복 방지 + 최근 1주 재수집, requirements.md 50 행) 도 `PLANNED` 인데 수집 pipeline 이 main 에 상당 부분 안착해 있어 stale 의심 — `requirements-status-resync` 다음 slice 후보.
- README "reset" 의 정확한 의미 (DB 전체 초기화 vs dump 범위 entity 한정 선삭제) 확정 — 필요 시 UC-07 / ADR-0044 대조로 별도 doc slice. 본 task 는 상태 문자열의 "한계 —" 로만 부기했다.
- 예약 backup · 외부 저장소 업로드 · 비동기 job queue 부재는 기능 gap — 재판정이 아니라 구현 task 이므로 planner 가 P7 bullet 으로 판단.

## Result (완료 기록)

- 완료 시각: 2026-08-01 (UTC)
- 실측값:
  - export endpoint — `@Controller("api/admin/export")` + `@Post()` (162 행) · `@Get("running")` (183 행) · `@Post("describe-scope")` (222 행) · `@Post("preview-selection")` (268 행) · `@Get(":id/download")` (407 행) · `@Get(":id/status-view")` (464 행) · `@Get(":id")` (479 행).
  - import endpoint — `@Controller("api/admin/import")` + `@Post()` (233 행) · `@Post("preview")` (305 행) · `@Get("running")` (350 행) · `@Get("modes")` (367 행) · `@Get(":id")` (382 행).
  - schema — `ExportJob` 614 행 · `ImportJob` 649 행 · `enum ImportMode { REPLACE, MERGE }` 571~574 행 (`ImportJob.mode` 기본값 `REPLACE`).
  - e2e 5 spec 합계 56 it — `export-download` 12 · `export-scope-preview` 10 · `import-restore-http` 21 · `import-restore-rejection` 6 · `import-restore-transaction` 7.
- 판정: REQ-030 상태 `PLANNED` → `DONE (implemented-on-main — ...)` + "한계 —" 2 절 (reset 범위 미확정 · 운영 automation / 비동기 queue 부재) 부기.
- 표 무결성: `wc -l` 97 불변, `grep -c "^| REQ-"` 66 불변, 49 행 `|` 8 개 (인접 REQ-029 행과 동일).
