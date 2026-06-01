---
id: T-0133
title: P3→P4 phase transition binding decision (option c hybrid-parallel) + STATE.phase 전환
phase: P3
status: PENDING
commitMode: direct
coversReq: [REQ-051, REQ-057, REQ-058, REQ-059, REQ-063, REQ-084]
estimatedDiff: 80
estimatedFiles: 3
created: 2026-06-01
plannerNote: P3 backbone entity 9/11·module 3/5·RBAC 3/3 완결 → transition doc §2.7/§4.1 이 명시 위임한 P3→P4 binding decision 시점 도달, option (c) 박제 + phase 전환
---

# T-0133 — P3→P4 phase transition binding decision (option c hybrid-parallel)

## Why

[docs/architecture/p3-to-p4-transition.md](../architecture/p3-to-p4-transition.md) §2.7 + §4.1 + §3 은 P4 진입 trigger 3 옵션의 trade-off 만 박제하고, **실 binding-decision 은 "다음 planner dispatch 또는 humanQuestion 발화의 책임"** 으로 명시 위임했다 (§2.7 마지막 단락, §4.1 권장 강화). T-0125/T-0132 closure 로 P3 backbone 이 충분히 박제됨 — entity 9/11 (Person/Group/Part/PersonGroupMembership/User/ServiceIdentity/Assessment/Contribution/Summary, `prisma/schema.prisma` 9 model 대조) + module 3/5 (PersistenceModule/UserModule/AuthModule) + ADR 8 ACCEPTED + controller RBAC chain 3/3 enforce 완결 (T-0121/T-0122/T-0123) + @CurrentUser decorator (T-0125). 권장 option (c) hybrid-parallel 의 P3 안 핵심 backbone (User + AuthModule + ADR-0008 + Assessment + Contribution + Summary entity + RBAC) 이 모두 박제됨. 따라서 본 task 가 CLAUDE.md §2 step 3 의 planner 책임 + Decision algorithm step 5 (phase exhausted → advance) 를 수행해 **option (c) 를 binding 으로 박제하고 STATE.phase 를 P4 로 전환**한다.

PLAN.md Phase P3 (L47–66) 의 13 bullet 중 도메인 backbone + test-quality 4/4 가 closure 됨 — 잔여 (LlmProviderConfig/DifficultyMapping/PermissionDeniedRecord + ADR-0005 cross-cutting + ADR-0007 audit log) 는 option (c) 정의상 P4 와 병행. 본 task 는 README 의 phase roadmap (P3 Domain core → P4 External integrations) 진행을 외화한다.

## Required Reading

- [docs/architecture/p3-to-p4-transition.md](../architecture/p3-to-p4-transition.md) — §2.7 (T-0125 closure refresh) + §4 (권장 option) + §4.1 (binding-decision 시점) + §3 (3 옵션 정의). 본 task 가 추가할 §7 의 위치.
- [docs/PLAN.md](../PLAN.md) L47–89 — Phase P3 bullet + P3→P4 전이 trigger 섹션 + Phase P4 backbone.
- [docs/STATE.json](../STATE.json) — `phase` 필드 (`P3-in-progress` → `P4-in-progress` 전환 대상).

## Acceptance Criteria

- [ ] `docs/architecture/p3-to-p4-transition.md` 에 **§7 "P3→P4 binding decision (T-0133)"** subsection 신설: option (c) hybrid-parallel 을 binding 으로 박제 (선택 근거 = entity 9/11 + module 3/5 + ADR 8 ACCEPTED + RBAC chain 3/3 완결 + §4/§4.1 권장 강화 누적) + 전환 시점 사실 (T-0125/T-0132 closure) + P4 와 병행 deferred 항목 명시 (LlmProviderConfig / DifficultyMapping / PermissionDeniedRecord + ADR-0005 cross-cutting + ADR-0007 audit log). §2.1–§2.7 박제 freeze 유지 (역사 invariant — 본문 수정 금지, §7 신설만).
- [ ] `docs/PLAN.md` 의 "P3 → P4 전이 trigger" 섹션 (L68–74) 에 binding 박제 한 줄 추가: "**binding decision (T-0133)**: option (c) hybrid-parallel 채택, STATE.phase P4-in-progress 전환" + 해당 줄이 본 task 머지 commit 을 가리키도록 표기. Phase P3/P4 bullet 본문 (L53–66, L80–87) 변경 0.
- [ ] `docs/STATE.json` 의 `phase` 를 `"P3-in-progress"` → `"P4-in-progress"` 로 변경. 다른 필드 (currentTask/nextTask/lock/ci/counters/loopSession) 변경 0.
- [ ] 본 task 는 doc/STATE-only direct — `src/` / `test/` / `prisma/` / `.github/` / `package.json` 변경 0 (검증: `git diff --name-only` 에 위 경로 0).
- [ ] 분기 없음 (doc 편집 + STATE 1 필드 변경) — R-112 test 4 항목은 코드 변경 0 이므로 면제. R-110 direct doc-only commit 면제.

## Out of Scope

- ADR-0006 (assessment data model) PROPOSED→ACCEPTED 전이 — 별도 1-줄 direct follow-up (본 task 와 분리).
- ADR-0005 cross-cutting field policy ADR 신설 — option (c) 정의상 P4 와 병행, 별도 task.
- ADR-0007 audit log schema ADR 신설 — P4 와 병행, 별도 task.
- AssessmentModule 추출 (현 Assessment/Contribution/Summary 가 UserModule 안에 통합 wiring) — 별도 pr-mode refactor task.
- LlmModule scaffold / LlmProviderConfig / DifficultyMapping entity — P4 backbone task.
- P4 entry document (p4-implementation-plan.md) 신설 — 별도 planner task (P2→P3 의 p3-implementation-plan.md 패턴 reuse). 본 task 는 phase 전환 binding 만, P4 task breakdown 은 다음 planner dispatch.
- 어떤 code / schema / CI / dependency 변경도 하지 않는다.

## Suggested Sub-agents

없음 — driver 가 Edit 도구로 직접 수행 (doc 3 파일 편집, sub-agent 불요). architect/implementer/tester 미호출 (코드 변경 0).

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 append)
