---
id: T-0349
title: T-0341 frontmatter status stale 정정 — IN_PROGRESS → DONE flip bookkeeping
phase: P5
status: PENDING
commitMode: direct
coversReq: [TBD]
estimatedDiff: 8
estimatedFiles: 1
created: 2026-06-11
independentStream: stage5-default-on-safeguards
dependsOn: []
touchesFiles: [docs/tasks/T-0341-adr0036-stage5-default-on-safeguards-amend.md]
plannerNote: "P5 / T-0348 Follow-ups 분해 — T-0341 stale IN_PROGRESS 가 5a claim-pickup 스캔·BLOCKED 스캔을 오염 가능, direct 8 LOC bookkeeping"
---

# T-0349 — T-0341 frontmatter status flip bookkeeping

## Why

T-0341 (ADR-0036 stage 5 기본-ON 안전장치 §Decision 8 amend) 은 사용자 직접 commit 9fde830 (2026-06-10) 으로 본문이 main 에 박제 완료됐고, 그 위에서 §Decision 8 구현 chain (T-0342~T-0347) 과 stage 5a 진입 (T-0348) 까지 전부 완결됐다. 그러나 task 파일 frontmatter 는 여전히 `status: IN_PROGRESS` 로 stale 하다 (main 1471dbe 직접 read 확인). T-0348 Follow-ups 가 이 flip 누락을 명시 박제했다.

단순 bookkeeping 을 넘어선 정합 근거: 본 fire 부터 5a 활성 (`flags.fineGrainedConcurrency=true`) 이라 LOOP §1[2] claim-pickup 경로가 task frontmatter status 를 스캔 입력으로 쓴다 — stale IN_PROGRESS 는 "다른 driver 가 진행 중인 task" 로 오판될 수 있고, planner 의 auto-unblock / BLOCKED 스캔에도 노이즈다. status 정확성이 동시성 메커니즘의 전제이므로 지금 닫는다.

## Required Reading

- docs/tasks/T-0341-adr0036-stage5-default-on-safeguards-amend.md (frontmatter L1~16 + Acceptance Criteria — flip 대상과 완료 근거 확인)
- docs/tasks/T-0348-adr0036-stage5a-toggle-on-maxclaims1.md §Follow-ups (본 task 의 출처 — flip 정당화 박제 확인)

## Acceptance Criteria

- [ ] `docs/tasks/T-0341-adr0036-stage5-default-on-safeguards-amend.md` frontmatter `status: IN_PROGRESS` → `status: DONE` flip + `completed: 2026-06-10` 필드 추가 (실 완료일 = 사용자 commit 9fde830 일자).
- [ ] 같은 파일 말미에 짧은 Result 절 1~3줄 박제: 사용자 직접 commit 9fde830 으로 완료, 후속 구현 chain T-0342~T-0348 전부 머지, 마지막 AC (CI 항목) 는 direct 진행으로 무의미 — flip 근거가 파일 안에서 self-contained 하도록.
- [ ] 그 외 본문 변경 0 (Why / Required Reading / AC 체크박스 재서술 금지 — frontmatter + Result 절만).
- [ ] commit 후 `git grep -c "status: IN_PROGRESS" docs/tasks/T-0341-adr0036-stage5-default-on-safeguards-amend.md` 가 0 (flip 검증).
- [ ] push 후 main CI green 확인 (R-114 — doc-only 라 trivially green 예상, `gh run list` conclusion success).

(doc-only direct task — R-112 unit test 항목 해당 없음, R-110 doc-only direct 면제. 분기 없음 — branch/negative 항목 생략.)

## Out of Scope

- T-0341 의 `coversReq: [TBD]` 보정 — 별도 정책 (TBD 일괄 정리는 만들지 않음, CLAUDE §12 호환 단락 동형).
- 다른 task 파일의 status 일괄 감사 — 본 task 는 T-0341 1건만. 추가 stale 발견 시 Follow-ups 에 박제.
- 5b 진입 / `maxConcurrentClaims` 상향 — 5a 정확성 게이트 (concurrency.md §7) 관측 후 별도 task.
- src/ 코드·ADR·CI 변경 0.

## Suggested Sub-agents

`implementer` 1회 (frontmatter 2줄 + Result 절 1~3줄 — executor 가 직접 처리해도 무방한 크기). tester 생략 (R-110 doc-only direct 면제).

## Follow-ups

(없음 — sub-agent 가 관련 작업 발견 시 여기 append)
