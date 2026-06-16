---
id: T-0431
title: UC-06 에 shipped recent-deletion REST endpoint + runner 구현 doc-sync
phase: P7
status: PENDING
commitMode: direct
coversReq: [REQ-041]
estimatedDiff: 30
estimatedFiles: 1
created: 2026-06-16
touchesFiles: [docs/use-cases/UC-06-evaluation-delete-reeval.md]
dependsOn: [T-0428, T-0430]
independentStream: req-041-doc-sync
plannerNote: P7 ⑤ REQ-041 — UC-06(P2 설계기 conceptual)에 shipped /api/schedules/recent-deletion endpoint+runner 구현 사실 addendum 박제. doc-only, 게이트 없음.
---

# T-0431 — UC-06 에 shipped recent-deletion REST endpoint + runner 구현 doc-sync

## Why

[UC-06](../use-cases/UC-06-evaluation-delete-reeval.md) 는 P2 설계기에 작성돼 REQ-041 최근 N일 manual delete→재수집을 **conceptual endpoint** (`DELETE /api/assessments` 등, §5 sequence diagram / §9 mapping) 로만 박제했다. 이후 P7 stream 에서 실제 구현이 shipped 됐다: `RecentDeletionRunnerService.runRecentDeletion` (T-0427, PR #344) + `POST /api/schedules/recent-deletion/:personId` REST endpoint (T-0428, PR #346) + api.md §5 표 박제 (T-0430). UC-06 가 이 실제 구현을 0회 참조해 doc/reality gap 이 있다 (`git grep "schedules/recent-deletion" UC-06` = 0 매칭 확인). 본 task 는 UC-06 에 **구현 사실 addendum** 을 추가해 living document 정합을 복원한다. doc-only (UC-06 1파일) 라 schema/repository/module-cycle 게이트 0, src/test 코드 0 LOC.

## Required Reading

- `docs/use-cases/UC-06-evaluation-delete-reeval.md` — 수정 대상. 특히 §5 (sequence diagram, conceptual endpoint) / §6.4 (즉시 재수집 옵션) / §9 (Component/Module mapping) / §11 (References).
- `docs/architecture/api.md` (138~142행 근방) — shipped endpoint 의 정확한 계약 (`POST /api/schedules/recent-deletion/:personId`, `RecentDeletionDto` (`instants` ISO `string[]` + 선택 `days`), 202 + `RecentDeletionRunResult` `{personId, deletedCount, recollected}`, Admin+ RBAC, deleter 미주입 시 `deletedCount:0`). T-0430 이 박제한 source.
- `docs/STATE.json` 의 `backlogNote` — REQ-041 slice 진행 history (T-0427 runner / T-0428 endpoint / T-0430 api.md doc-sync 의 게이트 상황).

## Acceptance Criteria

- [ ] UC-06 에 **구현 사실 addendum** 추가 — §6.4 (즉시 재수집 옵션) 끝 또는 §8 (Postconditions) 뒤에 짧은 subsection (예: `### 6.5 shipped 구현 참조 (P7 REQ-041)` 또는 §8 의 한 bullet) 으로, P2 설계기의 conceptual endpoint 와 실제 shipped 구현의 매핑을 1 문단으로 박제: `POST /api/schedules/recent-deletion/:personId` (T-0428, PR #346) 가 본 UC 의 REQ-041 trigger 1 의 실 진입점이며, `RecentDeletionRunnerService.runRecentDeletion` (T-0427, PR #344) 이 삭제→같은 기간 재수집 (CollectionTriggerService 위임) 을 수행함. 단 실 deleter (`RECENT_DELETION_DELETER`) provider 바인딩은 schema/repository 게이트 동반 별도 sub-slice 로 미shipped (`deletedCount:0` 기본) 임을 명시.
- [ ] §11 References 에 `docs/architecture/api.md` 의 recent-deletion 행 링크 1줄 추가 (이미 api.md 일반 링크가 있으면 recent-deletion 행 지칭 문구로 보강).
- [ ] §5 sequence diagram / §9 mapping table 의 기존 conceptual 서술은 **변경하지 않는다** — P2 설계기 의도 (UC 는 conceptual, 구체 endpoint 는 api.md) 를 존중하고, addendum 은 "shipped 구현 참조" 로만 추가 (diagram 재작성 금지 → diff 최소화 + scope creep 차단).
- [ ] frontmatter 의 `coversReq` / `status` 등 기존 값 보존 — `status: DONE` 그대로 (UC-06 자체는 P2 에 완료된 문서, 본 task 는 doc-sync addendum 만).
- [ ] doc-only direct commit — production code 0 LOC. (R-110/R-112 면제 — direct doc-only commit 에는 tester 불요.)

## Out of Scope

- §5 sequence diagram 재작성 / conceptual endpoint 문구 수정 — 본 task 는 addendum 만 (diff ≤ ~30 LOC 유지).
- 실 `RecentDeletionDeleter` Prisma provider 구현 — schema/repository 게이트 (backlogNote slice 2 후속 a). 본 task 는 그 게이트 미존재 사실만 언급.
- instants 후보 자동 도출 / 삭제 audit 영속 — repository/schema 게이트 (backlogNote 후속 a-2 / slice 3).
- data-model.md / components.md / modules.md 수정 — 신규 entity 0 이라 불요 (T-0430 journal 에서 확인됨).
- UC-01 §5 의 재수집 trigger source 서술 수정 — 본 task 는 UC-06 1파일만.

## Suggested Sub-agents

`implementer` (doc-only 단일 파일 편집). architect/tester 불요.

## Follow-ups

(없음 — sub-agent 가 발견 시 추가)
