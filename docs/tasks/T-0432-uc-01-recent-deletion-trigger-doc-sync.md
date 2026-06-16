---
id: T-0432
title: UC-01 §3 재수집 trigger 에 shipped recent-deletion endpoint doc-sync
phase: P7
status: PENDING
commitMode: direct
coversReq: [REQ-041]
estimatedDiff: 20
estimatedFiles: 1
created: 2026-06-16
touchesFiles: [docs/use-cases/UC-01-evaluation-execution.md]
dependsOn: [T-0428, T-0430, T-0431]
independentStream: req-041-doc-sync
plannerNote: P7 ⑤ REQ-041 — UC-01 §3 trigger 3(재수집 trigger)에 shipped POST /api/schedules/recent-deletion endpoint 참조 보강. doc-only, 게이트 없음.
---

# T-0432 — UC-01 §3 재수집 trigger 에 shipped recent-deletion endpoint doc-sync

## Why

[UC-01](../use-cases/UC-01-evaluation-execution.md) §3 Trigger 는 3 가지 trigger 경로를 박제한다. 그 중 trigger 3 ("재수집 trigger", UC-06 후속) 은 P2 설계기에 작성돼 REQ-037 conceptual delete→재수집 만 서술하며, 이후 P7 stream 에서 shipped 된 실 진입점 — `POST /api/schedules/recent-deletion/:personId` (T-0428, PR #346) + `RecentDeletionRunnerService.runRecentDeletion` (T-0427, PR #344, 삭제→`CollectionTriggerService` 재수집 orchestrate) — 을 0회 참조한다. `git grep -c "recent-deletion|RecentDeletion|api/schedules" UC-01` = 0 매칭으로 doc/reality gap 을 확인했다 (exit 1). T-0431 이 UC-06 에, T-0430 이 api.md §5 에 같은 endpoint 를 박제한 것과 동형으로, UC-01 §3 trigger 3 에 shipped 구현 참조를 한 절 보강해 living document 정합을 복원한다. doc-only (UC-01 1파일) 라 schema/repository/module-cycle 게이트 0, src/test 코드 0 LOC.

## Required Reading

- `docs/use-cases/UC-01-evaluation-execution.md` — 수정 대상. 특히 §3 Trigger (32~38행, trigger 3 "재수집 trigger") / §11 References (179~191행).
- `docs/architecture/api.md` §5 Endpoint 표 (recent-deletion 행, T-0430 박제) — shipped endpoint 의 정확한 계약 참조 source.
- `docs/use-cases/UC-06-evaluation-delete-reeval.md` §6.5 "shipped 구현 참조" addendum (T-0431 박제) — 같은 doc-sync 의 표현 mirror 대상.

## Acceptance Criteria

- [ ] UC-01 §3 trigger 3 ("재수집 trigger", 38행) 에 shipped 구현 참조를 1 절 보강 — conceptual REQ-037 서술은 유지하고, 그 뒤에 실 진입점이 `POST /api/schedules/recent-deletion/:personId` (T-0428, PR #346, Admin+ RBAC) 이며 `RecentDeletionRunnerService.runRecentDeletion` (T-0427, PR #344) 이 삭제→같은 기간 재수집 (`CollectionTriggerService` 위임) 을 수행함을 한 문장으로 추가. 단 실 deleter (`RECENT_DELETION_DELETER`) provider 바인딩은 schema/repository 게이트 동반 별도 sub-slice 로 미shipped (`deletedCount:0` 기본) 임을 명시 (UC-06 §6.5 / api.md §5 와 동일 한정).
- [ ] §11 References 에 `docs/architecture/api.md` §5 recent-deletion 행 링크 1줄 추가 (REQ-041 recent-deletion endpoint 의 계약 source 지칭). 기존 References 항목은 보존.
- [ ] §5 sequence diagram (alt cron/manual block) / §6 / §9 mapping table / §10 REQ cover 표 의 기존 서술은 **변경하지 않는다** — 본 UC 의 conceptual 의도 (재수집 trigger 는 UC-06 의 책임, UC-01 은 수렴 flow 만) 를 존중하고, addendum 은 §3 trigger 3 한 절 + §11 References 한 줄로만 한정 (diagram 재작성 / REQ row 추가 금지 → diff 최소화 + scope creep 차단).
- [ ] 본문 한국어, 식별자/경로/HTTP method/status code 는 영어 (§12).
- [ ] doc-only direct commit — production code 0 LOC. (R-110/R-112 면제 — direct doc-only commit 에는 tester 불요.)

## Out of Scope

- §5 sequence diagram / §9 mapping table / §10 REQ cover 표 수정 — 본 task 는 §3 trigger 3 + §11 References 만 (diff ≤ ~20 LOC 유지). 필요 판단 시 Follow-up.
- REQ-041 을 §10 REQ cover 표에 새 row 로 추가 — UC-01 의 primary REQ 가 아니라 UC-06 의 책임이며, 본 task 는 trigger 3 의 shipped 진입점 참조 보강만 (REQ cover 표 변경은 scope creep).
- 실 `RecentDeletionDeleter` Prisma provider 구현 — schema/repository 게이트 (backlogNote slice 2 후속 a). 본 task 는 그 게이트 미존재 사실만 언급.
- instants 후보 자동 도출 / 삭제 audit 영속 — repository/schema 게이트 (backlogNote 후속 a-2 / slice 3).
- api.md / data-model.md / UC-06 수정 — 이미 T-0430/T-0431 로 박제됨. 본 task 는 UC-01 1파일만.

## Suggested Sub-agents

`implementer` (doc-only 단일 파일 편집). architect/tester 불요 (direct doc-only, 코드 0 LOC).

## Follow-ups

(없음 — sub-agent 가 발견 시 추가)
