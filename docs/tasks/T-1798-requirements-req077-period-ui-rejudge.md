---
id: T-1798
title: 기간 지정 UI + period 호출 경로 실측으로 REQ-077 재판정 + PLAN 131 행 ④ 축 서술 갱신
phase: P6
status: PENDING
commitMode: direct
coversReq: [REQ-077]
estimatedDiff: 70
estimatedFiles: 2
created: 2026-08-30
independentStream: web-dashboard-display-contract
dependsOn: []
touchesFiles:
  - docs/requirements.md
  - docs/PLAN.md
plannerNote: "P6 오너 지시 131 행 ④ 축 — T-1732~T-1737 머지로 기간 UI·POST 경로가 shipped 인데 REQ-077 은 PLANNED drift (doc-only)"
---

# T-1798 — 기간 지정 UI + period 호출 경로 실측으로 REQ-077 재판정 + PLAN 131 행 ④ 축 서술 갱신

## Why

오너 지시 [PLAN](../PLAN.md) `131 행` (대시보드 실동작, R-175~R-178) 의 **마지막 잔여 축 ④(기간(일/주/월 + 시작 시점) 지정 UI + `POST /api/assessment-evaluation/period` 호출 경로 — [requirements.md](../requirements.md) `96 행` REQ-077)** 를 실측으로 판정하는 doc-only slice 다. 직전 세 fire 가 같은 패턴으로 ①([T-1796](T-1796-requirements-req074-person-selector-rejudge.md), REQ-074) · ②([T-1795](T-1795-requirements-req075-narrative-rejudge.md), REQ-075) · ③([T-1797](T-1797-requirements-req076-score-scale-rejudge.md), REQ-076) 을 닫았고 본 slice 가 그 네 번째다.

planner 가 본 fire 에서 issue-still-relevant pre-check 로 `origin/main` (`4fbe1d9f`) 을 직접 확인한 결과 **구현 대부분이 이미 shipped 인데 문서만 뒤처진 drift** 다 — 요청 조립 순수 모듈 [evaluationPeriod.ts](../../web/src/api/evaluationPeriod.ts)([T-1732](T-1732-evaluation-period-request-module.md)) · 선택 컨트롤 [DashboardPeriodSelector.tsx](../../web/src/components/DashboardPeriodSelector.tsx)([T-1733](T-1733-dashboard-period-selector-component.md)) · 실행/정규화 모듈 [periodEvaluationSubmit.ts](../../web/src/api/periodEvaluationSubmit.ts)([T-1734](T-1734-period-evaluation-submit-module.md)) · 컨테이너 배선 [DashboardView.tsx](../../web/src/views/DashboardView.tsx)([T-1735](T-1735-dashboard-period-evaluation-wire.md)) · 성공 후 재조회([T-1736](T-1736-use-api-resource-reload.md) · [T-1737](T-1737-dashboard-period-evaluation-reload.md)) 까지 6 slice 가 전부 `status: DONE` 인데도 `96 행` REQ-077 은 여전히 `PLANNED` 이고 근거 열에 shipped slice 가 0 건이다.

다만 본 REQ 문언은 **두 축**("조회 기간 지정 UI" + "사용자 지정 기간 평가 POST 호출 경로")이고, planner 실측상 **선택된 기간이 조회(GET) query 에 반영되는지가 불확실**하다 — [DashboardView.tsx](../../web/src/views/DashboardView.tsx) 의 `buildAssessmentsPath` / `buildSummariesPath` 인자로 쓰이는 `period` 는 컨테이너 state (`evaluationPeriod`) 가 아니라 **prop** 이고, 마운트처 [AppShell.tsx](../../web/src/AppShell.tsx) `315 행` 은 `<DashboardView />` 를 무-prop 으로 마운트한다. 그러므로 본 task 는 판정을 미리 정하지 않는다 — 아래 Acceptance Criteria 의 판정 분기대로 **실측 후 `DONE` 또는 `IN_PROGRESS`(잔여 명시)** 중 하나를 고른다.

## Required Reading

- [docs/requirements.md](../requirements.md) `96 행` — REQ-077 row (재판정 대상. `93~95 행` REQ-074 · REQ-075 · REQ-076 세 row 는 직전 재판정의 판정 본문 서술 형식 참고용으로만 읽는다)
- [docs/PLAN.md](../PLAN.md) `131 행` — 오너 지시 bullet 의 ④ 축 서술 두 곳 (본문 중 "④ 기간(일/주/월+시작) 지정 UI + POST /api/assessment-evaluation/period 호출 경로 배선" 과 말미 잔여 문장 "④(기간 지정 UI + POST /api/assessment-evaluation/period 호출 경로 — `96 행` REQ-077) 하나만 잔여다")
- [web/src/api/evaluationPeriod.ts](../../web/src/api/evaluationPeriod.ts) — `17 행` `PERIOD_EVALUATION_PATH`, `20~21 행` 허용 literal type, `24 행` `EVALUATION_PERIOD_OPTIONS`(일간·주간·월간), `34 행` `DEFAULT_EVALUATION_SCOPE`, `74 행` `normalizePeriodStartInput`, `113 행` `buildPeriodEvaluationRequest`
- [web/src/components/DashboardPeriodSelector.tsx](../../web/src/components/DashboardPeriodSelector.tsx) — `17~20 행` 라벨 상수, `104~115 행` `<select name="period">` + placeholder option, `123~124 행` `<input type="date" name="periodStart">`, `129~135 행` 제출 버튼과 `submittable` 게이팅
- [web/src/api/periodEvaluationSubmit.ts](../../web/src/api/periodEvaluationSubmit.ts) — `39~53 행` status 별 한국어 실패 사유, `76 행` `normalizePeriodEvaluationResponse`(User/Admin role 분기 응답 정규화), `112 행` `submitPeriodEvaluation`
- [web/src/views/DashboardView.tsx](../../web/src/views/DashboardView.tsx) — `84~86 행` import, `383~399 행` `PeriodEvaluationNotice` · `derivePeriodEvaluationNotice`, `433 행` `runPeriodEvaluation`, `484 행` `reloadAfterPeriodEvaluation`, `516~520 행` 기간 state, `737~746 행` `handlePeriodSubmit`, `797~808 행` `<DashboardPeriodSelector>` 마운트와 성공 문구, 그리고 **조회 축 확인용** `155~185 행` `buildAssessmentsPath` · `buildSummariesPath` 와 `132~134 행` `period?: string` prop 선언 · `537 행` · `550 행` 소비 지점
- [web/src/AppShell.tsx](../../web/src/AppShell.tsx) `315 행` — `<DashboardView />` 무-prop 마운트 (조회 축 판정의 핵심 사실)
- 검증 실체 후보 — [web/src/api/evaluationPeriod.test.ts](../../web/src/api/evaluationPeriod.test.ts), [web/src/api/periodEvaluationSubmit.test.ts](../../web/src/api/periodEvaluationSubmit.test.ts), [web/src/components/DashboardPeriodSelector.test.tsx](../../web/src/components/DashboardPeriodSelector.test.tsx), [web/src/views/DashboardView.period-evaluation.test.tsx](../../web/src/views/DashboardView.period-evaluation.test.tsx)
- [docs/tasks/T-1797-requirements-req076-score-scale-rejudge.md](T-1797-requirements-req076-score-scale-rejudge.md) — 직전 동형 재판정 slice 의 판정 본문 작성 형식

## Acceptance Criteria

- [ ] [requirements.md](../requirements.md) `96 행` REQ-077 의 status 를 실측 결과에 따라 재판정한다. 판정은 **두 축을 각각 확인한 뒤** 정한다: (가) 기간 종류(일/주/월) + 시작 시점 지정 UI 가 실제 DOM 노드로 화면에 렌더되는가, (나) 그 선택이 `POST /api/assessment-evaluation/period` 호출까지 끊김 없이 이어지는가. 두 축이 모두 충족되고 REQ 문언의 "조회 기간" 해석상 잔여가 없으면 `DONE`, 조회(GET) 축에 실제 잔여가 남으면 `IN_PROGRESS` 로 적고 **잔여를 파일·행 좌표로 명시**한다 (없는 잔여를 지어내지도, 있는 잔여를 감추지도 않는다).
- [ ] 판정 본문에 **요청 조립 축 · 선택 UI 축 · 실행/정규화 축 · 컨테이너 배선 축 · 성공 후 재조회 축** 5 축의 실제 파일·행 좌표를 근거로 박는다 (`93~95 행` 세 row 와 같은 형식 — 좌표는 본 fire 에서 `origin/main` 을 직접 열어 재확인한 값으로 적는다. planner 가 위 Required Reading 에 적은 행 번호를 그대로 베끼지 말 것).
- [ ] 조회 축 사실(`DashboardView` 의 `period` 가 prop 이고 [AppShell.tsx](../../web/src/AppShell.tsx) 가 무-prop 마운트라는 점, 그리고 선택 state `evaluationPeriod` 가 GET path 조립에 쓰이는지 여부)을 판정 본문에서 **명시적으로 다룬다** — 충족이면 왜 충족인지, 잔여면 무엇이 빠졌는지 한 문장 이상.
- [ ] 같은 row 의 근거 열(현재 `P6 (PLAN 131 행)` 만 있음)에 shipped slice chain `T-1732` · `T-1733` · `T-1734` · `T-1735` · `T-1736` · `T-1737` 을 `94 행` REQ-075 row 와 같은 표기로 추가한다.
- [ ] 검증 위치 열(현재 `e2e`)을 실측으로 검토한다 — `test/e2e/` 26 개 spec 중 본 REQ 문언(기간 선택 UI · period 평가 호출)을 브라우저 렌더로 검증하는 harness 가 있는지 직접 확인하고, 없으면 직전 세 row 와 같은 근거로 `unit` 으로 정정하고 실제 검증 실체(web colocated vitest 파일명)를 판정 본문에 적는다. 있으면 `e2e` 를 유지하고 그 spec 경로를 적는다.
- [ ] [PLAN.md](../PLAN.md) `131 행` 의 ④ 축 서술 두 곳을 재판정 결과와 정합하게 갱신한다 — 본문 ④ 축에는 shipped 근거 chain 과 `96 행` REQ-077 판정 참조를, 말미 잔여 문장에는 갱신된 잔여 상태(잔여 0 이면 "잔여 0", 잔여가 남으면 그 잔여)를 적는다.
- [ ] 두 문서의 좌표 표기는 CLAUDE.md §12 "범위 좌표 표기" 3 점을 따른다 (`~` 하나 · 단일 행은 `96 행` · `L` prefix 금지).
- [ ] 코드 변경 0 — `git diff --stat` 결과가 [docs/requirements.md](../requirements.md) · [docs/PLAN.md](../PLAN.md) 2 파일뿐임을 확인한다.

## Out of Scope

- **[PLAN.md](../PLAN.md) `131 행` bullet 마커 `[ ]` → `[x]` 승격 금지** — 승격은 REQ-074 ~ REQ-077 네 row 가 모두 `DONE` 으로 **머지된 상태를 근거로** 판단해야 하고, 본 slice 는 REQ-077 판정 자체를 만드는 중이라 자기 자신을 근거로 삼게 된다. 승격은 별도 doc slice 소관 (T-1785 · T-1787 선례).
- 코드 변경 일절 금지 — `web/` · `src/` · `test/` 를 건드리지 않는다. 조회 축에 잔여가 확인돼도 **본 slice 에서 배선하지 않는다** (Follow-ups 에만 적는다).
- REQ-077 외 다른 REQ row 수정 금지 (`93~95 행` 은 형식 참고용 read-only).
- 새 ADR · 새 architecture 문서 · 새 spec 작성 금지.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 동기 갱신 금지 (필요 시 Follow-ups).

## Suggested Sub-agents

`implementer` (doc-only 편집). commitMode 가 `direct` 라 reviewer · integrator 경로 없음. 코드 변경 0 이므로 tester 호출은 §3.2 면제 대상이나, 편집 후 `git diff --stat` 으로 2 파일만 바뀌었는지 확인한다.

## Follow-ups

(작성 시점 없음 — sub-agent 가 발견 시 여기에 append)
