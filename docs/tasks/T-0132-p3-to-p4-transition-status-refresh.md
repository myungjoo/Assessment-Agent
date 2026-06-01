---
id: T-0132
title: "P3→P4 전이 doc status refresh — T-0125 closure (controller RBAC chain 3/3 + @CurrentUser decorator) 시점 반영"
phase: P3
status: DONE
commitMode: direct
hqOrigin: null
coversReq: []
estimatedDiff: 110
estimatedFiles: 1
created: 2026-06-01T14:20:00+09:00
dependsOn: []
plannerNote: "P3 운영-doc refresh — p3-to-p4-transition.md 의 last refresh(§2.6/§4.1 session #22, T-0075 closure)는 약 50 task 뒤쳐짐. T-0077~T-0125(User/Auth/Assessment/Contribution/Summary entity + service + controller + RBAC + decorator)의 P3 진척을 §2.7 신규 subsection 으로 박제. doc-only direct, inline-amend × 0.4 sub-multiplier 적용."
---

# T-0132 — P3→P4 전이 doc status refresh (T-0125 closure 시점)

## Why

[docs/architecture/p3-to-p4-transition.md](../architecture/p3-to-p4-transition.md) 의 last refresh 는 §2.6 + §4.1 (session #22 turn 1, T-0075 closure 직후) 시점 — Group + Part CRUD-U 4-layer 박제까지만 반영. 그 후 본 turn(2026-06-01) 까지 P3 backbone 이 큰 폭으로 진척했다:

- entity layer: User entity (T-0077~), Assessment / Contribution / Summary entity (T-0110~T-0113 schema + repository chain 6/6, ADR-0006 박제)
- service layer: AssessmentService / ContributionService / SummaryService (T-0114~T-0116, service half 3/3 closure)
- HTTP layer: AssessmentController / ContributionController / SummaryController (T-0117~T-0119, REST endpoint 12종)
- RBAC chain 3/3: T-0121 / T-0122 / T-0123 (Assessment/Contribution/Summary controller 에 JwtAuthGuard + RolesGuard + @Roles 적용)
- api.md §5 doc-sync (T-0120 + T-0124) — RBAC enforced 박제 15+ row
- @CurrentUser() decorator 추출 (T-0125, PR-126 머지 7b2e1f3)
- 운영 정책 layer: ADR-0009 ref-CAS lock (T-0126) + ADR-0010 cron MCP pr-mode (T-0129) + LOOP/CLAUDE operationalization (T-0127/T-0128/T-0130/T-0131)

전이 doc 의 entity/module/ADR progress 카운터가 약 50 task 뒤쳐진 상태로, P3 → P4 trigger 의사결정을 다음 planner / humanQuestion 이 평가할 때 stale snapshot 위에서 평가하게 된다. 본 task 는 §2.7 신규 subsection 1 개를 신설해 T-0125 closure 시점의 박제 fact 만 박제한다 (결정 신설 0, STATE.phase 변경 0 — T-0063 박제 invariant 유지).

## Required Reading

- `docs/architecture/p3-to-p4-transition.md` (전체) — refresh 대상. 특히 §2 (status quo) / §2.6 (session #22 refresh) / §4.1 (권장 강화).
- `docs/PLAN.md` §P3 (L47-66) — entity / module / ADR / test-quality bullet inventory.
- `docs/architecture/p3-implementation-plan.md` §6 — entity 5/11 / module 2/5 / ADR 1/4 progress source.
- `docs/architecture/data-model.md` (entity 인벤토리 — 11 entity, P3 박제 갱신 카운트 산정 근거).
- `docs/progress/journal-2026-05-31.md` + `docs/progress/journal-2026-06-01.md` — T-0117~T-0125 closure history.
- `docs/tasks/T-0125-current-user-decorator-extraction.md` + `docs/tasks/T-0123-summary-controller-rbac.md` — refresh marker(direct-precedent).

## Acceptance Criteria

- [ ] `docs/architecture/p3-to-p4-transition.md` 에 **§2.7 새 subsection 1개 신설** — heading: `### 2.7 T-0125 closure 시점 refresh (controller RBAC chain 3/3 + @CurrentUser decorator)`. §2.6 (session #22) 패턴 mirror 로 박제 freeze invariant 명시 + 추가 박제 layer 만 신설.
- [ ] §2.7 본문에 다음 4 진척 사실을 박제:
  - [ ] **entity layer**: User entity (T-0077~) + Assessment / Contribution / Summary entity (T-0110 schema + T-0111/T-0112/T-0113 repository chain) → progress 8/11 → 약 11/11 (User + 3 평가 entity 추가). 정확한 수는 doc 작성 시 data-model.md 인벤토리 11 entity 와 대조해 산정.
  - [ ] **module layer**: AuthModule + AssessmentService/ContributionService/SummaryService application layer + HTTP controller (Assessment/Contribution/Summary) — module 2/5 → 약 4/5 또는 5/5 (UserModule + PersistenceModule + AuthModule + AssessmentModule(통합) 등 modules.md 대조 산정).
  - [ ] **ADR layer**: ADR-0005 (MCP tools) + ADR-0006 (assessment data model) + ADR-0007 (RBAC 모델 — 존재 시) + ADR-0008 (auth credential — 존재 시) + ADR-0009 (strong ref-CAS lock) + ADR-0010 (cron MCP pr-mode) — 실제 ACCEPTED ADR 수를 `docs/decisions/` 인벤토리로 산정. ADR 1/4 → 실 카운트 갱신.
  - [ ] **RBAC enforce milestone**: T-0121 + T-0122 + T-0123 controller RBAC chain 3/3 closure (Assessment / Contribution / Summary 4 endpoint × 3 controller = 12 endpoint 에 JwtAuthGuard + RolesGuard 박제) + T-0125 @CurrentUser() 추출 — Auth/RBAC bullet 의 enforce 완료 박제.
- [ ] §2.7 본문 끝에 박제 marker 1줄: `**T-0125 closure 시점 P3 backbone progress milestone — RBAC enforce 완결 + HTTP layer 박제 + User+Assessment 도메인 추가**`.
- [ ] §2.7 본문에 STATE.phase 변경 0 명시 (P3-in-progress 유지) + 실제 phase 전환 / binding-decision 은 다음 planner / humanQuestion 의 책임이라는 invariant 재확인.
- [ ] §4.1 의 "잔여 P3 backbone task estimate ~5~6 task" 박제는 **수정하지 않는다** — T-0076 session #22 박제 freeze 유지. 대신 §2.7 안에 "T-0125 closure 시점 잔여 estimate refresh: AuthModule + ADR-0008 + cross-cutting R-59 schema-level enforcement = 약 2~3 task 추가 (Group/Part/User read-only RBAC 확장 별도)" 같은 한 줄로 진척 박제.
- [ ] §5 의 last refresh 머지 SHA 줄 (있다면) 에 T-0132 머지 후 driver 가 갱신할 placeholder 한 줄 추가.
- [ ] 1 파일 (`docs/architecture/p3-to-p4-transition.md`) 만 편집. src/ 변경 0, schema 변경 0, ADR 신설 0, PLAN.md 변경 0.
- [ ] 추가된 diff ≤ 130 LOC (inline-amend, §2.7 만 신설).
- [ ] 본 task 는 `commitMode: direct` — main 에 doc-only direct commit. PR / reviewer 호출 0.

## Out of Scope

- **PLAN.md §P3 bullet status 표기 갱신** — 별도 follow-up direct task. 본 task 는 transition doc 1 파일만.
- **P3 → P4 실 phase 전환 결정** — STATE.phase 변경 0. T-0063 박제 invariant 유지.
- **§2.1–§2.6 박제 freeze 수정** — 역사 박제 invariant. 본 task 는 §2.7 신설 + §5 SHA placeholder 만.
- **§4 / §4.1 권장 강화 박제 수정** — invariant. §2.7 안에 진척 박제만.
- **새 ADR 작성 / src 변경 / spec 추가** — direct-mode 위반.
- **api.md / data-model.md / modules.md 갱신** — 다른 task.
- **운영 정책 backlog (cron 1-fire 1-task 완화 / CLAUDE 길이 mitigation / PLAN 분리) ADR 작성** — 별도 future task, 본 task scope 외.

## Suggested Sub-agents

- 호출 없음. driver 가 Edit 도구로 §2.7 신설 + §5 placeholder 추가 직접 수행 (T-0124 와 동일 패턴 — doc-only direct enumerated-section inline-amend × 0.4 multiplier).

## Follow-ups

- (Planner 예약 후보) PLAN.md §P3 bullet 의 enforce 완결 표기 동기 (direct, ~20 LOC).
- (Planner 예약 후보) 운영 정책 review backlog 의 "cron 1-fire 1-task 정책 완화 검토" 항목을 ADR scaffold 로 박제 (direct doc 작성, ADR PROPOSED, ~80 LOC).
- (Planner 예약 후보) merged-leftover branch cleanup (T-0110/T-0111/T-0112/T-0115/T-0122 + nifty-knuth-* 5종 + tender-cannon-* 등 squash auto-delete 403 누적분) — 사용자 housekeeping 판단 대기.
