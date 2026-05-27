---
id: T-0076
title: p3-to-p4-transition.md refresh — entity backbone 5/11 → 8/11 status quo 갱신 + P4 진입 binding-decision 권장 (Group + Part CRUD-U 4-layer closure 후)
phase: P3
status: DONE
commitMode: direct
coversReq: [REQ-051, REQ-058, REQ-028]
estimatedDiff: 120
actualDiff: 119
estimatedFiles: 2
actualFiles: 2
estimateOutcome: -1% accurate-pass (envelope 120 actual 119 raw-add, +119/-52 net +67, inline-amend sub-multiplier × 0.4 dogfood 3 회차 - 정확도 우수, T-0070 -63% / T-0073 -86% 누적 후 본 task accurate-pass = sub-multiplier × 0.4 calibration variance 큼)
created: 2026-05-27
completedAt: 2026-05-28T00:08:00+09:00
dependsOn: [T-0063, T-0075]
plannerNote: session #22 turn 2 — Group + Part CRUD-U 4-layer closure 후 entity backbone 8/11 박제, transition doc 의 5/11 status quo 와 갈림. P4 binding-decision 직전 refresh.
---

# T-0076 — p3-to-p4-transition.md refresh (entity backbone 5/11 → 8/11, P4 진입 binding-decision 권장)

## Why

[p3-to-p4-transition.md](../architecture/p3-to-p4-transition.md) 는 [T-0063](T-0063-p3-to-p4-transition-evaluation.md) 머지 시점 (session #19 turn 4, T-0062 closure 직후) 에 박제된 P3 status quo 와 P4 진입 trigger 3 옵션을 cover 한다. 본 doc 의 §2 entity progress 는 **5/11 (45%)** 박제 시점 freeze.

[T-0075](T-0075-part-controller-update.md) 머지 (e5bb1d2, session #22 turn 1) 로 **Part 도메인 CRUD-U 4-layer fully closed** 박제 완성. 직전 session #20 의 [T-0066](T-0066-group-update-dto-and-repository.md)~[T-0068](T-0068-group-controller-update.md) 머지로 **Group 도메인 CRUD-U 4-layer 박제 완성**. 결과: **entity backbone 진척 5/11 → 8/11 (73%)** — Person + ServiceIdentity + Group + Part + PersonGroupMembership (T-0063 박제 5) + Group CRUD-U + Part CRUD-U 의 controller layer fully closed 추가.

본 task 는 transition doc 의 §2 status quo + §4 권장 trigger option + §5 잔여 backbone task 목록을 **현 시점 (T-0075 머지 직후) 의 사실로 refresh** 한다. 이로써 **다음 planner dispatch 또는 humanQuestion 발화 시점에 P4 진입 binding-decision 가능**. 본 doc 자체는 결정 신설 0 (transition doc 의 §1 박제 invariant 유지) — STATE.phase 변경 0, refresh artifact 만 박제.

[PLAN.md](../PLAN.md) L70-74 의 P3→P4 전이 trigger 단락도 동기 갱신 (entity 5/11 → 8/11, T-0062 → T-0075 closure 시점 박제) 가능 — 별도 2 파일 envelope 안.

## Required Reading

- [docs/architecture/p3-to-p4-transition.md](../architecture/p3-to-p4-transition.md) — 본 task 의 변경 대상 (§2 status quo + §4 권장 + §5 잔여 backbone estimate). T-0063 박제 invariant (§1 박제 범위) 유지.
- [docs/PLAN.md](../PLAN.md) L70-74 — P3→P4 전이 trigger 단락 (현 status quo bullet 갱신 대상).
- [docs/architecture/data-model.md](../architecture/data-model.md) — 11 entity inventory source (변경 0).
- [docs/architecture/modules.md](../architecture/modules.md) — module skeleton 2/5 박제 source (변경 0).
- [docs/tasks/T-0066-group-update-dto-and-repository.md](T-0066-group-update-dto-and-repository.md) ~ [docs/tasks/T-0068-group-controller-update.md](T-0068-group-controller-update.md) — Group CRUD-U 4-layer 박제 task chain.
- [docs/tasks/T-0069-part-update-dto-and-repository.md](T-0069-part-update-dto-and-repository.md) + [docs/tasks/T-0071-part-service-update.md](T-0071-part-service-update.md) + [docs/tasks/T-0075-part-controller-update.md](T-0075-part-controller-update.md) — Part CRUD-U 4-layer 박제 task chain.
- [docs/architecture/estimate-model.md](../architecture/estimate-model.md) §3.2.2 inline-amend sub-pattern — 본 task 가 inline-amend × 0.4 sub-multiplier 의 dogfood 추가 1 회차 (T-0070 + T-0073 precedent 후속).

## Acceptance Criteria

### A. p3-to-p4-transition.md §2 status quo refresh

- [ ] `docs/architecture/p3-to-p4-transition.md` §2 상단의 "session #19 turn 4 시점 (T-0062 closure 직후)" 박제 freeze 마커를 보존하고, 그 아래에 **§2.6 신설 ("session #22 turn 1 시점 refresh")** subsection 추가 — T-0066~T-0075 박제 후의 사실 박제. T-0063 박제 invariant (5/11 freeze) 는 유지 (역사 박제).
- [ ] §2.6 안에 entity progress **5/11 → 8/11** 표 박제:
  - 추가 박제 3 layer-progress: Group CRUD-U 4-layer (T-0066+T-0067+T-0068) + Part CRUD-U 4-layer (T-0069+T-0071+T-0075).
  - 5/11 → 8/11 (45% → 73%) 의 milestone marker.
  - 미박제 3 entity 재정렬: User / Assessment / Contribution / Summary / LlmProviderConfig / DifficultyMapping / PermissionDeniedRecord — 7 entity 중 3 entity (User + Assessment + Contribution OR Assessment + Contribution + Summary) 가 P3 잔여 핵심 backbone, 나머지 4 는 옵션 (c) hybrid-parallel 적용 시 P4 와 병행.
- [ ] §2.6 안에 module skeleton + ADR progress 의 변경 0 박제 (`2/5 module + 1/4 ADR 유지` 한 줄).
- [ ] §2.6 안에 test-quality 9-cell matrix 의 retroactive 확장 박제 한 줄 — Group + Part 도메인 의 CRUD-U layer 추가 (단 spec 의 unit/integration 만, smoke/e2e 변경 0; 별도 후속 task).

### B. §4 권장 trigger option binding-decision 권장 amend

- [ ] §4 끝에 **§4.1 신설 ("session #22 시점 binding-decision 권장")** 추가:
  - 현재 entity 8/11 (73%) 박제 → 옵션 (c) hybrid-parallel 의 "핵심 backbone" 잔여 task estimate 약 9 → **약 5~6 task 로 축소** (User + AuthModule + ADR-0008 ~3 task + Assessment + Contribution + Summary 핵심 entity ~3 task) 박제.
  - 옵션 (c) hybrid-parallel 의 권장 강화 — entity 73% 박제 + Group/Part CRUD-U full coverage + cap-bend 14 회차 누적 평균 +41% 안정화 (estimate-model.md §2.4 박제) → 외부 통합 unblock 의 strategic value 한계 점에 가까움.
  - **권장 binding-decision 시점**: User entity + AuthModule + ADR-0008 신설 task chain 의 첫 task 진행 시 옵션 (c) hybrid-parallel 박제 (STATE.phase 변경 0 — 옵션 (c) 의 정의 자체가 P3-in-progress 유지 중 일부 P4 task 병행 trigger).
  - **단**: 본 task 머지 후에도 STATE.phase 변경 0 — phase 전환은 별도 planner / humanQuestion 의 책임 (T-0063 박제 invariant 유지).

### C. §5 잔여 backbone task estimate refresh

- [ ] §5 안의 옵션 (c) hybrid-parallel 표 갱신 — Group + Part CRUD-U 박제 후 잔여 task 수 ~9 → **~5~6 task** 로 축소 박제. "session #22 시점 refresh" marker 추가.
- [ ] 옵션 (b) strict-completion 표는 변경 0 박제 (잔여 ~17 task estimate 는 entity 진척에 비례하므로 8/11 → 11/11 에 약 8 task 잔여, but 본 doc invariant 유지 — 옵션 (b) 자체의 estimate 식 변경 0).
- [ ] 옵션 (a) eager-transition 표는 변경 0 박제.

### D. §6 References 갱신

- [ ] §6 References 에 T-0066 / T-0067 / T-0068 / T-0069 / T-0071 / T-0075 6 task ID 추가. Refs row 동기 갱신.
- [ ] §6 References 의 "본 doc 머지 commit SHA — T-0063 머지 후 driver bookkeeping 단계에서 갱신" 줄은 **본 task 머지 후 driver bookkeeping 단계에서 갱신** 으로 한 줄 추가 (T-0063 박제 invariant 유지 + 본 task refresh marker 추가).

### E. PLAN.md L70-74 동기 갱신 (선택)

- [ ] `docs/PLAN.md` L70-74 의 "현 status (T-0062 closure 시점)" bullet 을 **"현 status (T-0075 closure 시점)"** 으로 갱신 + entity 5/11 → 8/11 + module 2/5 유지 + ADR 1/4 유지 + test-quality 4/4 + 9-cell closure 유지 박제. 본 갱신은 1 줄 만 (Group + Part CRUD-U 4-layer closure milestone 박제).
- [ ] PLAN.md L70-74 의 "권장 trigger option" bullet 도 **옵션 (c) hybrid-parallel 의 권장 강화 (session #22 시점)** marker 1 줄 추가.

### F. 검증 (doc-only direct)

- [ ] markdown lint 0 error (Prettier check 통과).
- [ ] §2 박제 freeze marker (5/11 박제) + §2.6 refresh marker (8/11 박제) 양쪽 표시.
- [ ] §6 References 의 Refs row 박제 자연스러움 검증.

## Out of Scope

- **§1 박제 범위 변경 안 함** — T-0063 박제 invariant 유지 (본 doc 의 박제 범위 self-definition).
- **§3 P4 진입 trigger 3 옵션 정의 변경 안 함** — 옵션 (a) / (b) / (c) 의 정의 자체는 invariant 유지 (T-0063 박제). 권장 강화만 §4.1 신설로 추가.
- **STATE.phase 변경 안 함** — P3-in-progress 유지 (refresh artifact 만 박제). phase 전환은 별도 planner 책임.
- **새 task 신설 안 함** — 잔여 backbone task ID 할당은 별도 후속 planner dispatch 책임 (본 task 는 estimate 박제만, T-NNNN 할당 0).
- **data-model.md / modules.md / api.md / estimate-model.md 변경 안 함** — 본 task 는 transition doc + (선택) PLAN.md L70-74 의 동기 갱신만.
- **ADR 신설 안 함** — ADR-0008 / ADR-0005 cross-cutting / ADR-0006 LLM key / ADR-0007 audit log 4 ADR 의 신설은 별도 후속 task 책임.
- **smoke / e2e 변경 안 함** — Group + Part CRUD-U 의 PATCH e2e 박제는 별도 후속 task (T-0075 Follow-ups 의 "parts.e2e PATCH endpoint 박제").
- **estimate-model.md 15 회차 milestone refinement 안 함** — T-0070 14 회차 후 T-0071/T-0075 2 회차 누적 P2002 sub × 1.2 데이터 + T-0073 inline-amend × 0.4 1 회차 = 누적 데이터 3 회차, milestone 15 회차 도달 안 함. 별도 후속 task.

## Suggested Sub-agents

`implementer → (no tester needed — direct doc-only)` — direct commitMode 의 doc-only task 는 R-110 면제 (CLAUDE.md §3.2 본문 "direct-mode doc-only commit 만 본 규칙 면제"). architect 호출 0 (T-0063 박제 invariant 위 refresh 만).

- **implementer** — A.1~A.4 + B.1 + C.1~C.3 + D.1~D.2 + (선택) E.1~E.2. 단일 commit 안에 전부 박제. inline-amend × 0.4 sub-multiplier dogfood 3 회차 (T-0070 + T-0073 + 본 task).
- **tester** — 호출 0 (direct-mode doc-only, R-110 면제). 단 markdown lint (Prettier) 는 driver 가 commit 직전 검증.
- **reviewer / integrator** — 호출 0 (direct mode, PR 0).

## Follow-ups

- **estimate-model.md 15 회차 milestone refinement** — T-0070 14 회차 후 T-0071 / T-0075 / 본 T-0076 의 inline-amend × 0.4 데이터 3 회차 누적 + P2002 sub × 1.2 데이터 2 회차 누적. milestone trigger 15 회차 도달 시 박제.
- **race-patterns.md §8 multi-driver collab 3-way pattern 박제** — session #21 turn 1-4 의 3-way 합작 박제 (T-0071 + T-0072 + T-0073 + T-0074).
- **PartController / GroupController PATCH e2e 박제** — parts.e2e + groups.e2e amend 또는 새 task (PATCH e2e HTTP contract depth).
- **P3 잔여 backbone task chain 박제** — User entity + AuthModule + ADR-0008 신설 (옵션 (c) hybrid-parallel 의 first task chain). 본 task 의 §4.1 권장 binding-decision marker 후 별도 planner dispatch.
- **PLAN.md L51-66 의 잔여 13 bullet 동기 갱신** — Group + Part CRUD-U 박제 후 일부 bullet 의 closure marker 추가 (별도 작은 doc task).
- **Person 도메인 PATCH retroactive 일관성 검토** — T-0036 박제 PersonController.@Patch 의 R-112 4 카테고리 cover 충족 검증 (별도 doc-only review).
