---
id: T-1799
title: DashboardView 조회 path 가 prop 대신 컨테이너 기간 state 를 소비하도록 배선
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-077]
estimatedDiff: 180
estimatedFiles: 2
created: 2026-08-30
independentStream: p6-display-contract
dependsOn: [T-1735, T-1798]
touchesFiles:
  - web/src/views/DashboardView.tsx
  - web/src/views/DashboardView.period-query-wire.test.tsx
prNumber: 1416
completedAt: 2026-08-30T06:02:31Z
plannerNote: P6 오너 지시 PLAN 131 행 ④ 의 유일 잔여 — 선택 기간이 GET query 에 실리도록 period lift-up 배선
---

# T-1799 — DashboardView 조회 path 가 prop 대신 컨테이너 기간 state 를 소비하도록 배선

## Why

[PLAN.md](../PLAN.md) `131 행` 오너 지시 "대시보드 실동작" 4 축 중 ①②③ 은 닫혔고 **④(기간 지정 UI + `POST /api/assessment-evaluation/period` 호출 경로, REQ-077)** 하나만 열려 있다. [T-1798](T-1798-requirements-req077-period-ui-rejudge.md) 이 [requirements.md](../requirements.md) `96 행` 을 `DONE` 이 아니라 `IN_PROGRESS` 로 판정한 근거는 **단 하나** — REQ 문언 첫 축인 "**조회** 기간 지정" 이 화면에 닿지 않는다는 점이다. 지정 UI 축과 POST 호출 축은 T-1732 ~ T-1737 6 slice 로 이미 shipped 다.

잔여의 실체는 소비처 불일치 한 겹이다. [DashboardView.tsx](../../web/src/views/DashboardView.tsx) `537 행` `buildAssessmentsPath(selectedPersonId, period)` 와 `550 행` `buildSummariesPath(selectedPersonId, period)` 가 소비하는 `period` 는 컨테이너 state `evaluationPeriod`(`516 행`)가 아니라 `134 행` 의 **prop** 이고, 실 마운트처 [AppShell.tsx](../../web/src/AppShell.tsx) `315 행` 은 `<DashboardView />` 를 무-prop 으로 마운트한다. 그래서 `166~168 행` · `183~185 행` 의 조건부 `params.set('period', period)` 분기가 실사용에서 항상 거짓이고, 사용자가 `<select name="period">` 로 일간/주간/월간을 골라도 GET path 에 `period=` 가 실리지 않는다. 인원 축이 [T-1723](T-1723-dashboard-person-selector-wiring.md) 의 `selectedPersonId` state 로 prop 의존을 끊은 것과 달리 기간 축만 그 lift-up 이 없다.

본 slice 는 path 파생 두 곳의 **인자 소비처만 바꾸는 배선 한 겹** 이다. path builder 순수 함수 자체 · 컴포넌트 · backend · 새 dependency 변경 0.

## Required Reading

- [web/src/views/DashboardView.tsx](../../web/src/views/DashboardView.tsx) — 특히 `130~135 행`(`period?: string` prop 선언 + 주석), `155~190 행`(`buildAssessmentsPath` · `buildSummariesPath` 순수 함수 — **수정 대상 아님**), `509~520 행`(`selectedPersonId` · `evaluationPeriod` state 선언), `535~552 행`(두 조회 path 파생 — **수정 대상**), `797~806 행`(`DashboardPeriodSelector` 마운트, `period={evaluationPeriod}`)
- [web/src/AppShell.tsx](../../web/src/AppShell.tsx) — `315 행` 무-prop 마운트(본 배선이 필요한 이유의 실측 근거). **수정 대상 아님**
- [web/src/api/evaluationPeriod.ts](../../web/src/api/evaluationPeriod.ts) — `20~24 행`(`EvaluationPeriodGranularity = 'day' | 'week' | 'month'` + `EVALUATION_PERIOD_OPTIONS`). select 가 만드는 값역 확인용
- [docs/architecture/api.md](../architecture/api.md) `97 행` — `GET /api/assessments?personId=&period=` 계약(`period` 는 `day|week|month`, `personId` 누락 시 400). `periodStart` query 는 **계약에 없다**
- [docs/requirements.md](../requirements.md) `96 행` — REQ-077 `IN_PROGRESS` 판정 본문의 "조회(GET) 축 = 잔여" 문단(잔여 좌표 목록)
- [web/src/views/DashboardView.person-selector.test.tsx](../../web/src/views/DashboardView.person-selector.test.tsx) `121~126 행` — `period` prop 주입 시 GET path 에 `period=2026-08` 이 실리는 기존 계약(하위 호환 회귀 위험 지점)

## Acceptance Criteria

- [ ] [DashboardView.tsx](../../web/src/views/DashboardView.tsx) 에 조회용 기간 파생을 1 개 추가하고, `537 행` · `550 행` 두 path 파생이 prop `period` 대신 그 파생값을 소비하게 한다. 파생 규칙은 **컨테이너 state 우선 · prop fallback** (`evaluationPeriod` 가 빈 문자열이면 prop `period` 를 그대로 쓴다) — 기존 prop 주입 렌더 계약을 깨지 않기 위함이다.
- [ ] 파생 위에 근거 주석을 한국어로 박제한다: (가) 실 마운트처 [AppShell.tsx](../../web/src/AppShell.tsx) `315 행` 이 무-prop 이라 prop 만 소비하면 `period=` 가 영원히 실리지 않는다는 사실, (나) 같은 `<select name="period">` 값이 조회 필터와 기간 평가 요청 두 곳의 단일 source 라는 판단, (다) `periodStart` 는 GET 계약([api.md](../architecture/api.md) `97 행`)에 없어 본 slice 범위 밖이라는 경계.
- [ ] 신규 colocated spec `web/src/views/DashboardView.period-query-wire.test.tsx` 를 추가한다 (기존 spec 파일 수정 0).
- [ ] **happy-path test 1+** — 화면 안에서 `<select name="period">` 로 기간(예: `week`)을 고르면 이후 assessments · summaries 조회 path 에 `period=week` 가 실린다(무-prop 마운트 기준).
- [ ] **error path test 1+** — 상류 조회가 실패(네트워크 거부/비-200)해도 기간 선택 배선이 throw 없이 렌더를 유지하고, 기간 선택 컨트롤이 화면에 남는다.
- [ ] **분기 test** — (가) 기간 미선택(state 빈 문자열) + prop 없음 → path 에 `period=` 미포함, (나) 기간 미선택 + `period` prop 주입 → prop 값이 실림(하위 호환), (다) 기간 선택됨 + prop 주입 동시 → **state 가 이긴다**, (라) personId 미선택 → path `null`(조회 미발사) 4 분기 각 1+ test.
- [ ] **negative test 충분 cover** — 최소 3 종: ① 기간 선택 후 다시 placeholder(빈 값)로 되돌리면 `period=` 가 다시 빠진다, ② 선택 기간이 GET query 로만 실리고 `periodStart` 는 어떤 조회 path 에도 실리지 않는다(계약 밖 param 미발사), ③ 배선을 되돌려 prop 만 소비하면 fail 하는 비-공허 확인(예: 무-prop + 기간 선택 상태에서 fire 된 path 를 직접 단언).
- [ ] `pnpm --dir web test` 전량 green — 특히 기존 `DashboardView.person-selector.test.tsx` `121~126 행` 과 `DashboardView.test.tsx` `672 행` · `1036 행` 의 prop 주입 렌더 계약이 깨지지 않아야 한다.
- [ ] root `pnpm lint && pnpm build && pnpm test` green, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).

## Out of Scope

- backend 변경 일체 — `periodStart` GET query 신설, `AssessmentController` / `SummaryController` DTO 확장은 하지 않는다(계약 확장 필요 여부 판단은 후속 architect slice).
- [AppShell.tsx](../../web/src/AppShell.tsx) 수정 — 무-prop 마운트는 그대로 두고 컨테이너가 자립하게 만든다(REQ-074 선례).
- `buildAssessmentsPath` · `buildSummariesPath` 순수 함수 본문 수정 및 그 기존 spec 수정.
- [DashboardPeriodSelector.tsx](../../web/src/components/DashboardPeriodSelector.tsx) 컴포넌트 수정(라벨 문구·컨트롤 추가 포함).
- `EvaluationDetailPanel` 의 `periodLabel={period}`(`901 행`) 표시 라벨 축 변경 — 표시 문구 축은 별도 판단.
- [requirements.md](../requirements.md) `96 행` REQ-077 재판정 및 [PLAN.md](../PLAN.md) `131 행` 마커 승격 — 머지 후 별도 direct doc slice.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

## 결과 요약 (2026-08-30 DONE)

PR [#1416](https://github.com/myungjoo/Assessment-Agent/pull/1416) squash 머지 (`a6e44a94`). `DashboardView.tsx` 에 조회용 기간 파생 1 개(`deriveQueryPeriod` — 컨테이너 state `evaluationPeriod` 우선 · prop `period` fallback)를 추가하고 두 조회 path 파생(`buildAssessmentsPath` · `buildSummariesPath`)의 인자만 그 값으로 교체했다. 컴포넌트 · backend · 순수 path builder · `AppShell.tsx` 변경 0, 새 dependency 0. 신규 colocated spec `DashboardView.period-query-wire.test.tsx` 로 R-112 4 종(happy 1 · error path 1 · 분기 4 · negative 3) cover, 배선을 prop 소비로 되돌리는 mutation 에서 7 test fail 로 비-공허성 확인. reviewer APPROVE round 1/7, 4-게이트 PASS, web 3033 test + root 13208 test green (`+296/-5`, 2 파일).

REQ-077 의 잔여였던 "조회 기간 지정" 축이 닫혔다 — 후속 재판정(`docs/requirements.md` `96 행` `IN_PROGRESS` → `DONE`) 은 Follow-up.
