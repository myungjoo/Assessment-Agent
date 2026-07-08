---
id: T-0823
title: PLAN.md Import/export/restore(R-57) bullet implemented-on-main checkbox 정합
phase: P8
status: PENDING
commitMode: direct
coversReq: [REQ-057]
touchesFiles: [docs/PLAN.md]
dependsOn: []
independentStream: plan-shipped-drift-sync
estimatedDiff: 2
estimatedFiles: 1
created: 2026-07-08
plannerNote: P8 line136 Import/export/restore(R-57) bullet [ ] stale — export/import 모듈 전량 shipped-on-main, T-0809~0822 drift 패턴 mirror, direct doc-only
---

# T-0823 — PLAN.md Import/export/restore(R-57) bullet implemented-on-main checkbox 정합

## Why

PLAN.md line 136 의 `- [ ] Import / export / restore (R-57)` bullet 이 미완료 `[ ]` 로 표기돼 있으나, 실제로는 origin/main 에 export/import/restore 전 경로가 이미 shipped 돼 있어 **PLAN↔shipped-code drift** 상태다. 이는 README line 57 (R-57: "평가 자료가 저장된 공간은 쉽게 export하여 backup하고 restore하여 reset") 을 cover 하는 deliverable 이 완결됐음에도 checkbox 가 stale 하게 남은 것으로, T-0809~T-0822 fire 들이 교정해 온 것과 **동일한 drift 패턴**이다. 미교정 시 미래 planner 가 이미 완결된 export/import 방향을 재큐잉하는 make-work risk 가 있다. 본 task 는 checkbox 를 `[x]` 로 정합하고 implemented-on-main 근거 절을 append 한다.

## Required Reading

- `docs/PLAN.md` line 136 (교정 대상 bullet) 및 인접 P7 line 135 (R-50 backfill, implemented-on-main 근거 절 형식 참고) — append-only 로 인접 bullet 무손상 유지.
- `docs/PLAN.md` line 148 (T-0821 운영 문서 implemented-on-main 근거 절) — 근거 절 서술 형식 mirror 참고.
- `src/export/export.controller.ts` (POST / GET running / describe-scope / preview-selection / :id/download / :id/status-view / :id endpoint 배선 확인).
- `src/export/export.module.ts`, `src/export/export-job.service.ts` (export job 영속화·orchestration).
- `src/import/import.controller.ts` (POST / GET running / modes / :id endpoint 배선 확인), `src/import/import-job.service.ts`.
- `src/export/import-restore-plan.ts`, `src/export/import-restore-preview.ts`, `src/export/import-restore-result.ts` (restore 경로 순수 조각).
- `docs/decisions/ADR-0044-export-import-job-persistence.md`, `ADR-0046-export-dump-materialization-storage.md`, `ADR-0047-export-dump-db-read-scope.md` (canonical 결정 링크용).

## Acceptance Criteria

- [ ] `docs/PLAN.md` line 136 의 `- [ ]` 를 `- [x]` 로 변경. (`grep -n "Import / export / restore" docs/PLAN.md` 로 `[x]` 확인)
- [ ] 같은 bullet 에 `**implemented-on-main**:` 근거 절 append — 다음을 명시: export 경로(`src/export/export.controller.ts` POST 생성 / GET running / describe-scope / preview-selection / `:id/download` streaming / `:id/status-view` / `:id` 조회 + `export-job.service.ts` 영속화 + dump materialization/chunk streaming/resume) + import 경로(`src/import/import.controller.ts` POST / GET running / modes / `:id` + `import-job.service.ts`) + restore 경로(`import-restore-plan`/`import-restore-preview`/`import-restore-result`) + canonical [ADR-0044](../decisions/ADR-0044-export-import-job-persistence.md)/[ADR-0046](../decisions/ADR-0046-export-dump-materialization-storage.md)/[ADR-0047](../decisions/ADR-0047-export-dump-db-read-scope.md).
- [ ] 교정 전 `git ls-tree origin/main src/export/export.controller.ts src/import/import.controller.ts` 로 파일 실존 재확인 — false-positive flip 방지 (executor 가 실측 후 flip).
- [ ] 인접 bullet(line 135 R-50 / line 137 성능 검증) 무손상 — append-only, diff 는 line 136 국한 (`+1/-1` 또는 근거 절 append 로 소폭 증가).
- [ ] `docs/PLAN.md` 파일이 유효한 markdown 유지 (체크박스 렌더링 정상).

분기 없음 — 단일 doc-only checkbox+근거 절 정합이라 R-112 코드 test 항목 비적용 (direct doc-only commit, CLAUDE.md §3.2 doc-only 면제).

## Out of Scope

- `src/export/` · `src/import/` 코드 변경 금지 — 본 task 는 PLAN.md 문서 정합만.
- bullet 106 (R-64 재실행·부분 reset, 의도적 `[ ]` 유지) / bullet 107 (overwrite/reset DEFERRED) 은 건드리지 마라 — 별개 결정.
- bullet 108/109 (live-LLM bridge / 실 github e2e — §5 credential/PAT 게이트) 정합 금지 — 사람 게이트 대상.
- 새 ADR 작성 금지 (ADR-0044/0046/0047 이미 존재, 링크만).
- STATE.json counters / flags 변경 금지 (driver 담당).

## Suggested Sub-agents

`implementer` 만 (direct doc-only 1 파일 정합 — architect/tester 불요). executor 가 직접 처리 가능.

## Follow-ups

(없음 — 생성 시 비어있음)
