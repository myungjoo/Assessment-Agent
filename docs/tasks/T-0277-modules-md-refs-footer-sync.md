---
id: T-0277
title: modules.md Refs footer 를 본문 박제 (ADR-0030/0031, T-0255~T-0276, REQ-040) 로 정합
phase: P4
status: DONE
commitMode: direct
coversReq: [REQ-040, REQ-057]
estimatedDiff: 3
estimatedFiles: 1
created: 2026-06-07
completedAt: 2026-06-08T01:05:00+09:00
resultSummary: modules.md L241 Refs footer 에 T-0266/T-0269/T-0276 + ADR-0030/ADR-0031 + REQ-040 추가 + T 그룹 ascending 재정렬 (+1/-1, 1 file). 본문 박제 grep 누락 0. content commit 50bacd8.
plannerNote: P4 doc-sync — modules.md L241 Refs footer 가 본문 박제된 ADR-0030/0031, T-0255/T-0266/T-0269/T-0276, REQ-040 미추적 (catalogue drift)
---

# T-0277 — modules.md Refs footer 를 본문 박제 (ADR-0030/0031, T-0255~T-0276, REQ-040) 로 정합

## Why

[docs/architecture/modules.md](../architecture/modules.md) 본문 머리말(L3) 및 AssessmentCollectionModule row(L40) 에는 ADR-0029/ADR-0030/ADR-0031 + T-0255/T-0266/T-0269/T-0276 + REQ-040(manual trigger) 박제가 5+ 회 등장하나, L241 Refs: footer 는 그 박제를 미추적 (현재 footer 에 ADR-0030/0031 / T-0266/T-0269/T-0276 / REQ-040 누락). T-0255 머지 시점에 한 차례 footer 가 확장됐으나 이후 collection backbone chain (T-0266 enumerate doc-sync → T-0269 since-derivation doc-sync → T-0276 manual-trigger doc-sync) 가 추가될 때마다 footer 동기 누락이 누적된 catalogue drift. 본 task 가 footer 한 줄을 본문 박제와 정합해 future planner survey 의 ADR/task/REQ 색인 가치를 회복한다.

직접적인 사용자 영향은 작으나 (자료 위치는 본문에 이미 박제됨), modules.md footer Refs 는 P1 T-A4 산출물의 catalogue contract 라 본문 박제와 동기되는 게 정합. dependency-free, §5 미발화, direct doc-only inline-amend, ≤5 LOC.

## Required Reading

- [docs/architecture/modules.md](../architecture/modules.md) L3 머리말 + L40 AssessmentCollectionModule row + L188 Backend API 분기 + L196 N:N 요약 + L241 현재 Refs footer
- 본 task 가 박제할 task / ADR / REQ 의 발화 위치:
  - T-0255 (AssessmentCollectionModule 10번째 module 정합)
  - T-0266 (enumerate chain wiring doc-sync, ADR-0030)
  - T-0269 (SinceDerivationService 배선 doc-sync, ADR-0029 §5)
  - T-0276 (manual-trigger 호출처 결선 doc-sync, ADR-0031 chain #1~#5)
  - ADR-0030 (assessment-collection-enumerate)
  - ADR-0031 (collection-manual-trigger)
  - REQ-040 (manual trigger, AssessmentCollectionModule row + api.md endpoint 박제)

## Acceptance Criteria

- [ ] [docs/architecture/modules.md](../architecture/modules.md) L241 Refs: 줄에 다음 식별자 추가:
  - **Task**: `T-0266`, `T-0269`, `T-0276` (기존 `T-0255` 유지)
  - **ADR**: `ADR-0030`, `ADR-0031` (기존 `ADR-0029` 유지)
  - **REQ**: `REQ-040` (manual trigger; 기존 REQ-005~008 / 015 / 026 / 031~033 / 038 / 039 / 044 / 049 / 051~055 유지)
- [ ] 기존 Refs 식별자 순서 (T → ADR → REQ) 유지, 같은 group 안 ID 오름차순.
- [ ] 본 정합 후 본문 박제 (L3 머리말 / L40 row / L188 Backend API / L196 summary) 와 footer 간 ID 누락 0 — grep 으로 모든 footer ID 가 본문에 1+ 회 등장함을 점검.
- [ ] 본 task 는 direct doc-only 이므로 reviewer / tester / PR 호출 0 (R-110 면제). driver 가 직접 Edit 후 main push.
- [ ] 분기 없음 — 단순 footer 정합이라 R-112 항목 (happy/error/branch/negative/coverage) 적용 대상 0. 본 task 본문에 "분기 없음 — R-112 항목 생략" 명시로 §3.2 우회 아닌 명시적 면제.

## Out of Scope

- modules.md 본문 (L40 row, mermaid, dependency 표) 변경 — 본 task 는 footer 1 줄만 정합.
- 다른 architecture doc (api.md, data-model.md, components.md, deployment.md) 의 footer Refs 동기 — 별도 doc 의 drift 는 별도 task 로 분리 (본 task 의 Follow-ups 에 박제).
- PLAN.md / requirements.md / use-cases doc 의 ADR-0030/0031 / T-0271~T-0276 추적 — 다른 catalogue contract.
- Collection backbone 의 phase 진척 결정 (P5 평가 진입 / scheduler 자동화 / live token / Stryker) — 모두 §5 게이트 또는 phase 경계, Q-0027 escalate 책임.

## Suggested Sub-agents

없음 — driver 가 직접 Edit + main push (direct doc-only). 본 task 는 cron-fire 의 cheap-value progress 단위로 sub-agent dispatch overhead 가 정당화되지 않음.

## Follow-ups

- (1) 본 task 머지 후 dependency-free 잔여 0 예상 — 다음 planner survey 는 Q-0027 (collection chain 후 차기 phase 우선순위 — P5 평가 진입 / scheduler 자동화 / live token / Stryker / 정지) 로 escalate 가능성 높음.
- (2) 본 task 가 modules.md footer 만 정합 — api.md / components.md / deployment.md / data-model.md 의 footer Refs catalogue drift sweep 은 (있다면) 별도 task 로 분리. 본 task 머지 시 driver 가 다른 doc 의 footer drift 도 빠르게 grep 검증해 발견되면 따로 박제 (현재 planner 가 미확인).
- (3) UC-01 §3.2 의 "Web UI 평가 즉시 실행 버튼" → POST /api/assessment-collection/collect 매핑은 P5 평가 layer 가 entrypoint 를 박제한 후 정합 가능 (현재 endpoint 는 수집만, 평가 placeholder). UC-01 분기 정합은 P5 진척 후 follow-up.
