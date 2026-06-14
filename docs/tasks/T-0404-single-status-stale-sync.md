---
id: T-0404
title: single-status stale 3건(T-0037/T-0244/T-0284) frontmatter status 정합 doc-sync
phase: P4
status: DONE
commitMode: direct
coversReq: []
estimatedDiff: 12
estimatedFiles: 4
created: 2026-06-14
plannerNote: T-0403 Follow-up — 머지/실행 완료됐으나 frontmatter status 가 stale 한 3건을 한 direct doc-only task 로 정합. T-0037(PR#36 머지, PENDING)·T-0244(3be8260 실행, PENDING)·T-0284(PR#237 머지, IN_PROGRESS) → 전부 DONE.
independentStream: doc-sync-stale-status
dependsOn: []
touchesFiles: [docs/tasks/T-0037-patch-active-and-other-fields-fix.md, docs/tasks/T-0244-t0154-superseded-bookkeeping.md, docs/tasks/T-0284-ci-doc-only-approval-gate-exemption.md]
---

# T-0404 — single-status stale 3건 frontmatter status 정합

## Why

[T-0403](T-0403-adr0029-collection-slice-stale-status-sync.md) Follow-up 이 지목한 single-`status:` stale 3건을 한 direct doc-only fire 로 정합한다. 세 task 모두 산출물이 main 에 안착(머지 또는 직접 commit)했으나 자기 task 파일 frontmatter 의 `status:` 만 진행 중 상태로 잔류 → `git log`·task status 로 진행 재구성 시 사실과 다른 상태를 노출했다.

| task | 잔류 status | 실제 | 근거 |
| --- | --- | --- | --- |
| T-0037 | `PENDING` | DONE | PR #36(`f63f94e`) round 1 single-shot 머지 + driver DONE 박제(`87c1bd6`) |
| T-0244 | `PENDING` | DONE | `3be8260` 가 T-0154 SUPERSEDED bookkeeping 실행(T-0154 frontmatter = `SUPERSEDED` 확인) |
| T-0284 | `IN_PROGRESS` | DONE | PR #237(`0d44570` Merge) 머지(`47910c3 ci(approval-gate)`) |

`tasksCompleted` 는 불변(396) — 세 task 는 이미 main 에 반영된 작업의 bookkeeping 정정이지 신규 task 완료가 아니다(T-0402/T-0403 doc-sync 선례 정합).

## Acceptance Criteria

- [x] T-0037 frontmatter `status: PENDING` → `DONE`.
- [x] T-0244 frontmatter `status: PENDING` → `DONE`.
- [x] T-0284 frontmatter `status: IN_PROGRESS` → `DONE`.
- [x] 각 파일에 `## 완료 기록` 1줄 추가(머지/실행 근거 박제).
- [x] 3개 파일 외 task 파일 본문 불변(frontmatter status + 완료기록 append 만).
- [x] 각 파일 `status:` 라인 정확히 1개(중복 0).

## Out of Scope

- **코드/spec 변경 금지** — 순수 frontmatter + 완료기록 doc-only 정합. commitMode: direct.
- **T-0355 는 손대지 않는다** — `onHold: credential-workflow-scope`(web vitest CI 미배선)는 의도적 보류이며 stale 아님. WIND-DOWN 게이트 항목으로 유지.
- 세 task 본문(Why/Acceptance/Follow-ups) 수정 금지.

## Suggested Sub-agents

`implementer`(doc-only frontmatter edit) — direct commit 이라 tester 불요(코드 0, R-110 doc-only 면제).

## 완료 기록

- **DONE (T-0404 본 fire)** — cron@cloud-aa-local-15 fire 가 lock CAS 획득 후 3건 frontmatter status 정합 + 완료기록 append, direct doc-only main commit. T-0403 Follow-up 의 single-status stale 잔무를 완결. 이로써 T-0402 Follow-up 의 9 stale-status 후보 중 collection slice 5건(T-0403)+single-status 3건(본 task)+T-0355(의도적 보류, 유지)로 전부 판정 완료.
