---
id: T-1800
title: 조회(GET) 축 배선 실측으로 REQ-077 재판정 + PLAN 131 행 ④ 축 서술 갱신
phase: P6
status: PENDING
commitMode: direct
coversReq: [REQ-077]
estimatedDiff: 70
estimatedFiles: 2
created: 2026-08-30
independentStream: p6-display-contract
dependsOn: [T-1799]
touchesFiles:
  - docs/requirements.md
  - docs/PLAN.md
plannerNote: "P6 오너 지시 131 행 ④ — T-1799 머지로 조회 GET 축이 닫혀 REQ-077 IN_PROGRESS drift 재판정 (doc-only)"
---

# T-1800 — 조회(GET) 축 배선 실측으로 REQ-077 재판정 + PLAN 131 행 ④ 축 서술 갱신

## Why

오너 지시 [PLAN](../PLAN.md) `131 행` (대시보드 실동작, R-175~R-178) 의 마지막 잔여 축 ④([requirements.md](../requirements.md) `96 행` REQ-077) 는 [T-1798](T-1798-requirements-req077-period-ui-rejudge.md) 재판정에서 `PLANNED` → `IN_PROGRESS` 로만 승격됐다. `DONE` 을 보류한 **유일한 근거**가 "선택한 기간이 조회(GET) query 에 반영되지 않음 — `DashboardView` 가 컨테이너 state 가 아니라 무-prop 마운트되는 `period` prop 을 소비" 였는데, 그 한 겹을 [T-1799](T-1799-dashboardview-period-query-wire.md)(PR #1416, main `a6e44a94`)가 배선해 닫았다. 따라서 지금 `96 행` 은 **구현이 앞서고 문서만 뒤처진 drift** 다.

planner 가 본 fire 에서 issue-still-relevant pre-check 로 `origin/main` 을 직접 확인했다 — `origin/main:docs/requirements.md` `96 행` 은 여전히 `IN_PROGRESS` 이고, `origin/main:web/src/views/DashboardView.tsx` 에는 `deriveQueryPeriod`(컨테이너 state `evaluationPeriod` 우선 · prop `period` fallback)와 그 결과를 두 조회 path 파생(`buildAssessmentsPath` · `buildSummariesPath`)에 넘기는 배선이 이미 박제돼 있다. 즉 재판정 대상은 실재하며 중복 작업이 아니다.

다만 REQ 문언 첫 축은 "조회 기간(일/주/월 **+ 시작 시점**) 지정" 이라, GET query 에 실리는 것이 기간 종류(`period`)뿐이고 시작 시점(`periodStart`)이 backend 조회 계약에 없다는 점이 판정에 영향을 줄 수 있다. 그래서 본 task 는 판정을 미리 정하지 않고 아래 판정 분기대로 **실측 후 `DONE` 또는 `IN_PROGRESS`(잔여 좌표 명시)** 중 하나를 고른다.

## Required Reading

- [docs/requirements.md](../requirements.md) `96 행` — REQ-077 row (재판정 대상. `93~95 행` REQ-074 · REQ-075 · REQ-076 세 row 는 판정 본문 서술 형식 참고용 read-only)
- [docs/PLAN.md](../PLAN.md) `131 행` — 오너 지시 bullet 의 ④ 축 서술 두 곳 (본문 중 "④ 기간(일/주/월+시작) 지정 UI + POST /api/assessment-evaluation/period 호출 경로 배선 — 2026-08-30 부분 shipped …" 문단과, 말미 "본 bullet 마커는 `[ ]` 유지" 문장 안의 ④ 잔여 서술 · 잔여 좌표 열거)
- [web/src/views/DashboardView.tsx](../../web/src/views/DashboardView.tsx) — 조회 축 판정의 핵심. `deriveQueryPeriod` 정의(컨테이너 state 우선 · prop fallback 규칙), 그 반환을 소비하는 `buildAssessmentsPath` · `buildSummariesPath` 호출부, 두 path builder 안의 `params.set('period', …)` 분기, 기간 선택 state `evaluationPeriod` 선언부 — **행 좌표는 본 fire 에서 직접 열어 재확인한 값으로 적는다** (planner 가 여기 적은 이름만 단서로 쓰고 번호는 베끼지 말 것)
- [web/src/AppShell.tsx](../../web/src/AppShell.tsx) — `<DashboardView />` 마운트 지점 (무-prop 마운트가 유지되는지, 그럼에도 state 우선 규칙으로 조회에 기간이 실리는지 확인)
- [web/src/views/DashboardView.period-query-wire.test.tsx](../../web/src/views/DashboardView.period-query-wire.test.tsx) — T-1799 가 추가한 colocated 검증체 (검증 위치 열 판정 근거)
- [docs/architecture/api.md](../architecture/api.md) — `GET /api/assessments` 조회 계약 (query 가 `personId` · `period` 뿐인지, `periodStart` 가 계약에 있는지)
- [src/user/assessment.controller.ts](../../src/user/assessment.controller.ts) — `GET /api/assessments` 의 실제 query 파라미터 (backend 가 시작 시점 필터를 받는지 여부의 사실 근거)
- [docs/tasks/T-1798-requirements-req077-period-ui-rejudge.md](T-1798-requirements-req077-period-ui-rejudge.md) — 직전 판정 본문과 그 보류 근거 (본 slice 가 걷어내야 할 문장이 무엇인지)

## Acceptance Criteria

- [ ] [requirements.md](../requirements.md) `96 행` REQ-077 의 status 를 실측 결과에 따라 재판정한다. 판정은 **T-1798 이 보류 근거로 든 조회(GET) 축이 실제로 닫혔는지**를 먼저 확인한 뒤 정한다 — 선택된 기간이 `GET /api/assessments` · `GET /api/summaries` 조회 path 의 query 로 실리면 그 근거는 소멸이다. 조회 축을 포함해 REQ 문언에 잔여가 없으면 `IN_PROGRESS` → `DONE`, 잔여가 남으면 `IN_PROGRESS` 를 유지하되 **잔여를 파일·행 좌표로 좁혀 명시**한다 (없는 잔여를 지어내지도, 있는 잔여를 감추지도 않는다).
- [ ] 판정 본문에서 **시작 시점(`periodStart`) 의 조회 반영 여부를 명시적으로 다룬다** — REQ 문언이 "조회 기간(일/주/월 + 시작 시점) 지정" 이므로, backend `GET /api/assessments` 가 시작 시점 필터를 받지 않는다면 그것이 (가) REQ 문언상 잔여인지 (나) UI 제공 의무 밖(조회 계약 소관)인지 한 문장 이상으로 판단 근거를 적는다. 판단이 (가) 면 `IN_PROGRESS` 유지 + 잔여 좌표, (나) 면 `DONE` 으로 가되 그 해석 근거를 남긴다.
- [ ] T-1798 이 적어둔 보류 근거 문장(prop 소비 · 무-prop 마운트 · `params.set('period', period)` 분기가 항상 거짓)을 **현재 사실에 맞게 걷어내거나 갱신**한다 — 이미 거짓이 된 서술이 row 에 남지 않게 한다.
- [ ] 같은 row 의 근거 열에 조회 축 shipped slice `T-1799` 를 기존 chain(`T-1732` ~ `T-1737`)과 같은 표기로 추가한다.
- [ ] 검증 위치 열(현재 `unit`)을 실측으로 재확인한다 — 조회 축의 실 검증체가 [DashboardView.period-query-wire.test.tsx](../../web/src/views/DashboardView.period-query-wire.test.tsx) 등 web colocated vitest 인지 확인하고, 그 파일명을 판정 본문에 적는다. `test/e2e/` 에 본 REQ 문언을 브라우저 렌더로 검증하는 harness 가 새로 생겼는지도 확인해 값이 바뀌어야 하면 정정한다.
- [ ] [PLAN.md](../PLAN.md) `131 행` 의 ④ 축 서술 두 곳을 재판정 결과와 정합하게 갱신한다 — 본문 ④ 축의 "부분 shipped" · "다만 선택한 기간이 조회(GET) query 에는 반영되지 않아 …" 서술과, 말미 잔여 문장의 ④ 상태 · 잔여 좌표 열거(`web/src/views/DashboardView.tsx` `134 행` · `537 행` · `550 행` 과 `web/src/AppShell.tsx` `315 행`)를 현재 사실로 교체한다.
- [ ] 두 문서의 좌표 표기는 CLAUDE.md §12 "범위 좌표 표기" 3 점을 따른다 (`~` 하나 · 단일 행은 `96 행` · `L` prefix 금지).
- [ ] 코드 변경 0 — `git diff --stat` 결과가 [docs/requirements.md](../requirements.md) · [docs/PLAN.md](../PLAN.md) 2 파일뿐임을 확인한다.

## Out of Scope

- **[PLAN.md](../PLAN.md) `131 행` bullet 마커 `[ ]` → `[x]` 승격 금지** — 승격 판단은 REQ-074 ~ REQ-077 네 row 가 모두 `DONE` 으로 **머지된 상태**를 근거로 해야 하고, 본 slice 는 REQ-077 판정 자체를 만드는 중이라 자기 자신을 근거로 삼게 된다. 승격은 별도 doc slice 소관 (T-1785 · T-1787 선례).
- 코드 변경 일절 금지 — `web/` · `src/` · `test/` 를 건드리지 않는다. `periodStart` 조회 query 확장이 잔여로 판정돼도 **본 slice 에서 배선하지 않는다** (Follow-ups 에만 적는다).
- REQ-077 외 다른 REQ row 수정 금지 (`93~95 행` 은 형식 참고용 read-only).
- 새 ADR · 새 architecture 문서 · 새 spec 작성 금지. [api.md](../architecture/api.md) 의 GET 계약 확장 서술도 본 slice 밖.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 동기 갱신 금지 (필요 시 Follow-ups).

## Suggested Sub-agents

`implementer` (doc-only 편집). commitMode 가 `direct` 라 reviewer · integrator 경로 없음. 코드 변경 0 이므로 tester 호출은 §3.2 면제 대상이나, 편집 후 `git diff --stat` 으로 2 파일만 바뀌었는지 확인한다.

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 적는다.)
