---
id: T-0396
title: PLAN.md P6 섹션을 composition-wiring chain 완결 현실로 doc-sync
phase: P6
status: PENDING
commitMode: direct
coversReq: [REQ-038, REQ-044, REQ-049, REQ-078]
estimatedDiff: 40
estimatedFiles: 1
created: 2026-06-14
plannerNote: P6 — PLAN.md P6 4 bullet 이 wiring chain(T-0353~T-0394) 완결 미반영(전부 미체크); composition-wiring closure + backend-게이트 잔여 deferred doc-sync (direct doc-only)
touchesFiles: [docs/PLAN.md]
dependsOn: []
independentStream: p6-frontend-doc-sync
---

# T-0396 — PLAN.md P6 섹션을 composition-wiring chain 완결 현실로 doc-sync

## Why

P6 frontend composition-wiring chain(①~⑥, T-0378~T-0394)이 T-0394 머지(PR #325 squash b152181)로 완결됐고, 그 직전 presentational 분해(15 컴포넌트, T-0361~T-0375) + scaffold(T-0353/T-0354) 도 머지됐다. T-0395 가 `docs/architecture/modules.md` 의 WebModule 서술을 shipped 현실로 doc-sync 했으나, `docs/PLAN.md` 의 **Phase P6 섹션(L113~119)은 아직 stale** 하다 — 4 개 bullet("로그인/SuperAdmin 초기 셋업 흐름" / "시각화 대시보드" / "Admin 패널" / "R-78 평가 진행 중 시각화 보호")이 전부 미체크(`[ ]`)이고, composition-wiring closure 가 반영돼 있지 않다. 또한 L119 의 ADR-0041 status 가 `(PROPOSED)` 로 적혀 있으나 이미 ACCEPTED(T-0377 flip)다. 본 task 는 PLAN.md P6 섹션을 shipped 현실로 정합한다(REQ-038 UI / REQ-044 3 권한 로그인 UI / REQ-049 Admin LLM 설정 UI / REQ-078 평가 중 시각화 보호의 frontend 표현이 어디까지 박제됐는지를 master plan 이 정확히 가리키도록).

이것은 master plan 의 reality doc-sync 다(T-0395 modules.md doc-sync 와 동형, phase-level) — 코드 변경 0, 새 결정 0, 새 dependency 0. driver closeout 은 STATE/journal 만 갱신하고 PLAN.md phase bullet 정합은 미반영이므로, 본 planner task 가 genuine 한 잔여다. backend 계약 미shipped 라 의도적 defer 인 잔여 stream 을 함께 박제해 다음 planner 가 make-work 로 재발견하지 않도록 한다.

## Required Reading

- `docs/PLAN.md` — L113~119 "Phase P6 — Web UI" 섹션(4 bullet + composition-wiring 전환 단락). 본 task 가 갱신할 정확한 지점.
- `docs/tasks/T-0395-modules-md-web-frontend-doc-sync.md` — 직전 doc-sync task 의 Why/AC(동형 정합 + backend-게이트 deferred 박제 표현 차용).
- `docs/decisions/ADR-0041-frontend-composition-wiring.md` — status(이미 ACCEPTED, T-0377 flip) 확인용. 전문 정독 불요 — status 줄만.
- `docs/STATE.json` `backlogNote` — defer 된 잔여 stream 목록(import 결과 상세 / GroupMember add·remove mutation / SchedulePanel(P7) / ReEvaluationTriggerPanel(api.md 94-97 deferred) / R-78 auto-polling)의 정확한 표현.

## Acceptance Criteria

- [ ] PLAN.md P6 의 4 bullet 각각을 shipped 현실로 정합:
  - "로그인 / SuperAdmin 초기 셋업 흐름" → composition-wiring ②(AuthGate, T-0379)·⑥(SuperAdminSetupForm 배선, T-0394)로 조립 완료 박제. `[x]` 체크 + 완료 마커(어느 task chain 으로 shipped 됐는지).
  - "시각화 대시보드 (정렬·필터·시계열)" → DashboardView(③a~③b-3, T-0381~T-0384) + presentational(필터바/시계열/분포/페이지네이션 등) 조립 완료 박제. `[x]`.
  - "Admin 패널 (인원·그룹·재평가·import/export·스케줄)" → AdminView(④a~④h, T-0385~T-0392)로 **shipped 계약 범위**(GroupMemberList 조회·DifficultyModelSelector·export/import·scope·RBAC gating) 조립 완료. 단 재평가(ReEvaluationTriggerPanel)·스케줄(SchedulePanel)은 backend 계약 미shipped 로 **미마운트 defer**임을 명시. 부분 완료라 `[~]` 또는 `[x]`(조립된 범위) + defer 주석 — 표기는 기존 PLAN.md convention(다른 phase 의 부분완료 표기)을 따른다.
  - "R-78 평가 진행 중 시각화 보호" → EvaluationGuardBanner DashboardView 배선(⑤, T-0393) 완료, 단 자동 polling(backend status 계약 미shipped)은 defer 박제. `[x]`(배선) + defer 주석.
- [ ] PLAN.md L119 composition-wiring 단락의 ADR-0041 `(PROPOSED)` → `(ACCEPTED)` 정정 + wiring chain 이 ①~⑥(T-0378~T-0394)로 **완결**됐음을 1~2 문장 박제(현재는 "후속 wiring chain 은 … 순차로 진행" 미래형 — 완결 과거형으로 갱신).
- [ ] backend-contract 미shipped 라 의도적으로 defer 인 잔여(ReEvaluationTriggerPanel·SchedulePanel 미마운트 / EvaluationGuardBanner 자동 polling / GroupMember add·remove mutation / import 결과 상세)를 P6 섹션에 **"backend 계약 확정 후 배선" deferred** 로 한 줄(또는 sub-bullet) 박제 — make-work 가 아니라 의도적 defer 임을 doc 에 남겨 다음 planner 가 재발견하지 않도록. 근거: api.md 94~97(`/run`·bulk DELETE·`/reeval`·`/reset` 미구현) + SchedulerModule(P7, `@nestjs/schedule` 새 dep).
- [ ] web vitest CI 배선(T-0355)이 `onHold: credential-workflow-scope`(token workflow scope 부재)로 게이트됨을 P6 섹션 또는 composition 단락에 한 줄 박제(다음 planner 가 게이트 상태를 즉시 인지하도록).
- [ ] P6 외 다른 phase 섹션·운영 정책 backlog 는 수정하지 않음(diff 를 P6 섹션 L113~119 로 국한).
- [ ] 변경이 doc-only(`docs/PLAN.md` 단일 파일)임을 확인 — 코드·테스트·다른 doc 미변경.

## Out of Scope

- 실제 wiring 코드 변경(이미 shipped — 본 task 는 PLAN doc-sync 만).
- ReEvaluationTriggerPanel·SchedulePanel 의 실 배선(backend 계약 미shipped — defer 유지, 본 task 는 그 defer 사실을 PLAN 에 박제만).
- ADR-0041 본문·status 수정(이미 ACCEPTED — PLAN 의 링크 status 표기만 정정, ADR 파일은 미변경).
- `docs/architecture/*.md`(modules.md 는 T-0395 가 처리) 등 다른 doc 동기 — PLAN.md 에 국한. 다른 doc 이 stale 하면 별도 follow-up.
- STATE.json `phase` 필드 변경(P6 미완결 — wiring 은 끝났으나 backend-게이트 잔여 + T-0355 게이트 존재. phase 전환은 driver/별도 결정 책임).
- README 갱신(driver closeout 또는 별도 task).
- P7(SchedulePanel·scheduler) 진입 task 생성(본 task 는 P6 정합만).

## Suggested Sub-agents

`implementer` (doc-only 단일 파일 edit — architect/tester 불요; direct doc commit 이라 R-110 tester 면제, CLAUDE.md §3.2 direct-mode doc-only 예외).

## Follow-ups

(없음 — 생성 시점)
