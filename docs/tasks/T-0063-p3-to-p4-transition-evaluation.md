---
id: T-0063
title: P3 → P4 전이 조건 evaluation doc + PLAN.md trigger 명시
phase: P3
status: PENDING
commitMode: direct
coversReq: [REQ-057, REQ-058]
estimatedDiff: 80
estimatedFiles: 3
created: 2026-05-27
plannerNote: P3 test-quality 9-cell closure 후 P4 transition checkpoint — entity 5/11 + module 2/5 + ADR 1/4 + test 4/4 진척 검산 + P4 trigger 박제
---

# T-0063 — P3 → P4 전이 조건 evaluation doc + PLAN.md trigger 명시

## Why

session #19 turn 3 시점에 **P3 test-quality 9-cell closure** (backbone 3 도메인 persons / parts / groups × 3 layer unit / smoke / e2e fully closed) 가 박제되어 mock 시대 종결의 모든 도메인 cover 완성. [p3-implementation-plan.md §6](../architecture/p3-implementation-plan.md) 가 P3 → P4 전이 조건의 conceptual progress 박제 (entity 5/11 + module 2/5 + ADR 1/4 + test-quality 4/4) 를 유지하나, **(a) P4 진입 trigger 자체가 PLAN.md 본문에 미박제** — 어떤 시점에 P3-in-progress → P4 phase 전환을 단행해야 하는지의 의사결정 기준 부재. **(b) p3-implementation-plan.md §6 의 progress 박제가 T-0062 closure 시점의 milestone (9-cell closure) 갱신 미반영** — T-0062 머지 후 P3 진행 시점의 status quo 의 의사결정 가능 형태로 분명히 박제 필요.

본 task 는 **doc-only direct** — 코드 변경 0, 다음 3 산출물:

1. `docs/architecture/p3-to-p4-transition.md` 신설 — P3 → P4 전이 checkpoint doc. 현재 P3 진척 status (entity 5/11 / module 2/5 / ADR 1/4 / test-quality 9-cell closure) + 잔여 P3 backbone work (6 entity / 3 module / 3 ADR) + P4 진입 trigger 3 옵션 (eager-transition / strict-completion / hybrid-parallel) 박제.
2. `docs/PLAN.md` Phase P3 단락 끝에 "P3 → P4 전이 trigger" sub-section 추가 (≤ 30 LOC) — `docs/architecture/p3-to-p4-transition.md` reference + 선택된 trigger option 명시.
3. `docs/architecture/p3-implementation-plan.md` §6 P3 → P4 전이 조건 단락에 T-0062 (groups.e2e MERGED 3398ad9) + T-0061 (groups.smoke MERGED 2238e51) + T-0060 (parts.e2e MERGED acef3f4) + T-0059 (parts.smoke MERGED 3f71c64) 의 9-cell closure milestone 박제 갱신.

본 task 머지 후 **다음 cron / loop turn 의 planner 가 P3 잔여 또는 P4 진입을 의사결정 가능한 trigger document 가 main 에 영속화**. 본 task 자체는 trigger option 선택을 강제하지 않는다 — option (a) / (b) / (c) 의 trade-off 만 박제, 실제 phase 전환 의사결정은 별도 future task (또는 driver 의 next planner dispatch) 의 책임.

## Required Reading

- [docs/PLAN.md](../PLAN.md) — Phase P3 단락 (L47–66) + Phase P4 단락 (L70–80). 본 task 가 §P3 끝에 sub-section 추가, P4 단락은 변경 없음 (P4 entry 의 첫 task 는 별도 planner task 의 책임).
- [docs/architecture/p3-implementation-plan.md](../architecture/p3-implementation-plan.md) — 특히 §6 P3 → P4 전이 조건 (L172–204) — entity 5/11 / module 2/5 / ADR 1/4 / test-quality 4/4 박제. 본 task 가 본 §6 의 milestone 박제 갱신.
- [docs/STATE.json](../STATE.json) — counters.tasksCompleted=61 / phase=P3-in-progress / mostRecentTasks=[T-0062, T-0061, T-0060, T-0059, T-0058] / reviewRounds 누적. 본 task 의 progress 진척 source.
- [docs/architecture/INDEX.md](../architecture/INDEX.md) — architecture document 목록 + MVA 원칙. 본 task 가 신규 doc 추가 시 INDEX 에 row 추가 — 별도 task 분리 아님 (≤ 5 LOC inline 추가).
- [docs/decisions/ADR-0004-smoke-e2e-db-mode.md](../decisions/ADR-0004-smoke-e2e-db-mode.md) — P3 진행 중 신설된 첫 ADR (T-0051 9109e65 PR-46 ACCEPTED). 본 task 가 ADR progress 1/4 박제 source.
- [docs/progress/journal-2026-05-27.md](../progress/journal-2026-05-27.md) — session #19 turn 1/2/3 의 9-cell closure milestone 박제 source.
- [CLAUDE.md](../../CLAUDE.md) §3.1 (commitMode 정책) — 본 task 가 doc-only direct 인 근거 (`docs/architecture/*` 신규 추가 는 일반적 PR mode 이나 §3.1 표 "P3 → P4 transition" 같은 cross-cutting plan document 는 direct 로도 가능 — 본 task 는 결정 추가 0, 기존 진척 박제만이므로 ADR 미동반 direct 처리). **본 task 는 결정 신설 0 (trigger option 3 종은 박제만, 선택 안 함) → doc-only direct.**

## Acceptance Criteria

- [ ] `docs/architecture/p3-to-p4-transition.md` 신설 — 다음 6 단락 포함:
  1. **§1 개요** — 본 doc 의 목적 + scope (P3 → P4 phase 전이 의사결정 가능 형태의 trigger document) + 본 doc 이 결정 신설 0 / 박제만임을 명시.
  2. **§2 P3 진척 status quo (T-0062 closure 시점)** — entity 5/11 박제 (Person / ServiceIdentity / Group / Part / PersonGroupMembership) + 미박제 6 entity (User / Assessment / Contribution / Summary / LlmProviderConfig / DifficultyMapping / PermissionDeniedRecord — conceptual AuditLog 별도 deferred) + module 2/5 박제 (PersistenceModule / UserModule) + 미박제 3 module (AuthModule / AssessmentModule / LlmModule) + ADR 1/4 박제 (ADR-0004) + 후보 3 ADR (ADR-0005 cross-cutting / ADR-0006 LLM key / ADR-0007 audit log / ADR-0008 auth credential 의 4 후보 중 ADR-0008 이 우선순위 — User+AuthModule backbone 진입 직전 trigger) + test-quality 4/4 + 9-cell closure 박제.
  3. **§3 P4 진입 trigger 3 옵션** —
     - **(a) eager-transition**: 현 시점 (entity 5/11 / module 2/5) 에서 P4 진입. 잔여 P3 backbone (User + Assessment + Contribution + Summary + LlmProviderConfig + DifficultyMapping + PermissionDeniedRecord entity / AuthModule + AssessmentModule + LlmModule) 는 P4 진행 중 병행. 장점: GitHub adapter / Confluence adapter / LLM gateway 등 P4 외부 통합 의존성을 일찍 unblock. 단점: P3 의 도메인 invariant (raw 미저장 R-59 / 상대 비교 R-63 / RBAC R-84 등) schema-level 강제 누락 위험.
     - **(b) strict-completion**: PLAN.md L51–66 의 13 bullet 전부 + entity 11/11 + module 5/5 + ADR 4/4 박제 후 P4 진입. 장점: 도메인 invariant 의 schema-level 강제 + auth/RBAC 보안 layer 완성 후 외부 통합 진입 → 안전. 단점: P4 까지 평균 12–18 task 추가 진행 필요 (T-0063 ~ T-0080 예상), GitHub adapter / Confluence adapter unblock 까지 시간 비용 큼.
     - **(c) hybrid-parallel**: 핵심 P3 backbone (User + AuthModule + ADR-0008 auth credential / Assessment + Contribution + Summary entity + 영속 invariant ADR-0005 cross-cutting + ADR-0006 LLM key + raw 미저장 R-59 schema-level 강제 1+) 만 완성 후 P4 진입. LlmProviderConfig + DifficultyMapping + PermissionDeniedRecord 는 P4 와 병행. 장점: 보안 + 핵심 invariant 강제 + 외부 통합 일찍 unblock 의 균형. 단점: phase 의 boundary 가 모호 — phase-completion 의 박제 시점 의사결정 추가 필요.
  4. **§4 권장 trigger option + 의사결정 가능 시점** — 본 doc 은 선택 안 함 (decision deferred). 권장 후보: **(c) hybrid-parallel** (이유: P3 진행 중 발견된 cap-bend 패턴 5 회차 + R-112 colocated-spec catch streak 2 회차 + ADR-first split 4-stage closure 등 의 progress velocity 분석에서 strict-completion 까지 시간 비용 > P4 외부 통합 unblock 의 strategic value, hybrid 가 양쪽 균형). 단 본 doc 은 권장만 박제, **실 의사결정은 다음 planner dispatch 또는 humanQuestion 발화 시점**.
  5. **§5 P3 잔여 backbone task 목록 (estimate)** — User + AuthModule + ADR-0008 (~3 task estimate) / Assessment + Contribution + Summary entity (~6 task) / LlmProviderConfig + DifficultyMapping (~3 task) / PermissionDeniedRecord (~2 task) / ADR-0005 cross-cutting (~1 task) / ADR-0006 LLM key (~1 task) / ADR-0007 audit log (~1 task) — 합계 약 17 task estimate (option (b) strict-completion 시) 또는 약 9 task (option (c) hybrid 시) 또는 약 0 task (option (a) eager 시). 각 task ID 미할당 — 별도 planner 책임.
  6. **§6 References** — PLAN.md / p3-implementation-plan.md §6 / data-model.md / modules.md / 본 doc 머지 commit SHA (T-0063 머지 후 갱신).

- [ ] `docs/PLAN.md` Phase P3 단락 끝 (L66 직후) 에 "P3 → P4 전이 trigger" sub-section 추가 (≤ 30 LOC):
  - `docs/architecture/p3-to-p4-transition.md` 의 link
  - 현 status (entity 5/11 / module 2/5 / ADR 1/4 / test-quality 9-cell closure) 1 줄 박제
  - 권장 trigger option (c) hybrid-parallel 1 줄 박제 (선택 강제 안 함)
  - "전이 시점의 실 의사결정은 다음 planner dispatch 또는 humanQuestion 발화의 책임" 박제

- [ ] `docs/architecture/p3-implementation-plan.md` §6 P3 → P4 전이 조건 단락 (L172–204) 의 milestone 박제 갱신:
  - **9-cell closure 박제** — T-0059 (parts.smoke 3f71c64) / T-0060 (parts.e2e acef3f4) / T-0061 (groups.smoke 2238e51) / T-0062 (groups.e2e 3398ad9) 4 task 의 mergeCommit 박제 + 9-cell matrix (persons/parts/groups × unit/smoke/e2e) fully closed milestone 박제.
  - **mock 시대 종결 milestone 박제** — smoke 3/3 + e2e 3/3 closure + ADR-first split 4-stage trajectory (T-0051 ADR / T-0052 CI / T-0053 persons.smoke / T-0054 persons.e2e) 가 모든 domain 으로 확장됨 박제.

- [ ] `docs/architecture/INDEX.md` 에 p3-to-p4-transition.md row 추가 (≤ 3 LOC inline).

- [ ] 본 task 머지 후 `docs/STATE.json.phase` 는 **변경 안 함** (P3-in-progress 유지) — phase 전환은 본 task 책임 아님, 별도 future task 의 의사결정.

- [ ] 본 task 는 ADR 신설 0 / 새 외부 dependency 0 / 코드 변경 0 — doc-only direct 검산.

- [ ] 본 task 의 모든 본문 한국어 (CLAUDE.md §12) + 식별자 / 경로 / enum 값 / 명령어 영어 유지.

- [ ] 본 task 의 mergeCommit SHA 박제 — driver 의 [6] bookkeeping 단계에서 task frontmatter `mergedAs` 박제 + `docs/architecture/p3-to-p4-transition.md` §6 References 의 "T-0063 머지 commit SHA" placeholder 갱신.

본 task 는 doc-only direct 이므로 R-112 의 unit test / R-113 의 smoke/e2e / coverage 의무는 적용 0 (분기 없음 — 이 항목 생략).

## Out of Scope

- **실 P3 → P4 phase 전환 의사결정** — 본 task 는 trigger 박제만, 선택 안 함. STATE.phase 변경 0. 다음 planner dispatch 또는 humanQuestion 발화의 책임.
- **P3 잔여 backbone task (T-0064+) 생성** — 본 task 는 후보 목록 박제만, 실 task 생성 0. 별도 planner 책임.
- **새 ADR 신설** — 본 task 는 ADR-0005 cross-cutting / ADR-0006 LLM key / ADR-0007 audit log / ADR-0008 auth credential 의 4 후보 박제만, 신설 0. 각 책임 task 의 권한.
- **PLAN.md Phase P4 단락 (L70–80) 갱신** — 본 task scope 외, P4 entry 시 별도 planner task.
- **data-model.md / api.md / modules.md / directory.md / components.md 본문 갱신** — 본 task 는 doc 신설 + 2 doc 의 sub-section / 박제 갱신만, P2 artifact 본문 재편집 회피.
- **ADR-0002 / ADR-0003 status 변경** — 두 ADR 모두 ACCEPTED 유지. 본 task 는 reference 만.
- **estimate model 갱신 doc** — cap-bend 5 회차 systematic underestimate (T-0055 413 / T-0056 545 / T-0057 496 / T-0061 342 / T-0062 406) 박제는 별도 task (driver recommendation 후보 (c)) 의 책임.
- **AuthGuard ADR 신설 + 첫 적용** — driver recommendation 후보 (d) — 별도 task 책임 (본 task 는 ADR-0008 후보로만 박제).
- **CRLF / Windows worktree 정책 ADR** — driver recommendation 후보 (f) — 별도 task 책임.
- **GitHub Actions race-fix 패턴 ADR 박제** — driver recommendation 후보 (e) — 별도 task 책임.

## Suggested Sub-agents

`implementer (doc-only)` — architect 호출 0 (결정 신설 0, 기존 박제 갱신 + 신규 transition doc 작성). tester 호출 0 (doc-only direct, R-110~R-114 적용 외 — `pnpm lint` / `pnpm build` 영향 0 검산).

## Follow-ups

(empty at creation — sub-agent 가 본 task 진행 중 발견하는 follow-up 을 여기에 append)
