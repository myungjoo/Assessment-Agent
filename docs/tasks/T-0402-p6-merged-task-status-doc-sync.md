---
id: T-0402
title: 머지 완료된 P6 presentational task 5건의 stale frontmatter status doc-sync (PENDING→DONE)
phase: P6
status: DONE
commitMode: direct
coversReq: []
estimatedDiff: 60
dependsOn: []
touchesFiles:
  - docs/tasks/T-0370-p6-dashboard-filter-bar.md
  - docs/tasks/T-0371-p6-trend-time-series-panel.md
  - docs/tasks/T-0372-p6-dashboard-pagination-control.md
  - docs/tasks/T-0374-p6-score-distribution-chart.md
  - docs/tasks/T-0375-p6-evaluation-detail-panel.md
---

## Why

P6 presentational 컴포넌트 task 5건(T-0370/T-0371/T-0372/T-0374/T-0375)은 전부 PR squash merge 로 main 에 반영됐으나(각각 `7db0039` #302 / `d104d45` #303 / `3465e09` #304 / `a16f5c6` #306 / `d24c54c` #307), 머지 시점의 closeout 이 STATE.json 의 `noteT*` 만 갱신하고 **개별 task 파일의 frontmatter `status` 를 PENDING 으로 잔류**시켰다. T-0373 같은 sibling 은 `status: DONE` + `## 완료 기록` 섹션을 갖는데, 이 5건만 누락이다.

이는 `git log`·task 파일 status 만 보고 진행상황을 재구성하려는 다음 driver/사람에게 **사실과 다른 상태(미완료처럼 보임)**를 노출한다. wind-down(dependency-free backlog 소진) 판정 직후 발견된 진짜 stale-doc 잔무로, direct doc-only 로 즉시 정정한다.

## Required Reading

- `docs/tasks/T-0373-p6-metric-summary-cards.md` — DONE task 의 frontmatter + `## 완료 기록` 컨벤션 선례.
- 대상 5개 task 파일 (touchesFiles).

## Acceptance Criteria

- [x] 대상 5개 task 파일의 frontmatter `status: PENDING` → `status: DONE` 정정.
- [x] 각 파일 말미에 `## 완료 기록` 섹션 추가 (Status/PR/squash SHA/reviewer round/요약 — T-0373 컨벤션 정합).
- [x] 머지 사실(squash SHA·PR 번호)은 STATE.json `noteT*` + `git log` 와 교차검증된 값만 기재.
- [x] direct commit (docs/tasks status 갱신 — CLAUDE §3.1 direct 컬럼). PR/reviewer 없음.

## Out of Scope

- 다른 stale-status 후보(T-0037/T-0244/T-025x/T-0284/T-0355)는 머지/abandoned/onHold 판정이 불명확 — 본 task 에서 건드리지 않는다. 별도 조사 follow-up.
- 코드·테스트·아키텍처 변경 없음 (frontmatter + 완료 기록 텍스트만).

## Follow-ups

- T-0037 / T-0244 / T-0253~T-0257 / T-0284(IN_PROGRESS) / T-0355(onHold credential-workflow-scope) 의 frontmatter status 가 실제 상태와 정합하는지 별도 sweep 필요 (각 머지/supersede/abandon 여부 확인 후 정정).

---

## 완료 기록

- **Status: DONE** (2026-06-14T04:41Z, cron@cloud-aa-local-sched)
- direct doc-only commit (docs/tasks/ 6 파일: 대상 5 + 본 task 파일).
- 대상 5건 머지 사실 `git log` 교차검증: T-0370 `7db0039`(#302) / T-0371 `d104d45`(#303) / T-0372 `3465e09`(#304) / T-0374 `a16f5c6`(#306) / T-0375 `d24c54c`(#307).
- tasksCompleted 불변(이미 머지 반영된 task 의 bookkeeping 정정일 뿐 신규 완료 아님).
