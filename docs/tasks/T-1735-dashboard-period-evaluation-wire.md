---
id: T-1735
title: DashboardView 에 기간 지정 평가 요청 배선 (선택 상태 소유 + 컨트롤 마운트 + 실 제출)
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-077]
estimatedDiff: 340
estimatedFiles: 2
created: 2026-08-27
completedAt: 2026-08-27T13:57:16Z
prNumber: 1365
mergeCommit: 90b5aa05
independentStream: web-req077-period
dependsOn: [T-1732, T-1733, T-1734]
touchesFiles:
  - web/src/views/DashboardView.tsx
  - web/src/views/DashboardView.period-evaluation.test.tsx
sizeExempt: true
exemptReason: "cap-bend pre-justified: R-112 4-카테고리 cover backbone × 1.5 = 340 LOC, T-1723(409 LOC, 동일 컨테이너 배선 + 전용 spec 분리) 선례 승계 — production 은 ≤ 120 LOC 로 억제하고 초과분은 전부 spec"
plannerNote: "P6 오너지시 PLAN 131행 ④ / REQ-077 slice 4 — T-1732~T-1734 3 모듈의 첫 화면 소비처 배선(재조회는 slice 5)"
---

# T-1735 — DashboardView 에 기간 지정 평가 요청 배선 (선택 상태 소유 + 컨트롤 마운트 + 실 제출)

## Why

오너 지시 [PLAN](../PLAN.md) `131 행` ④ (REQ-077) 는 "기간(일/주/월 + 시작) 지정 UI + `POST /api/assessment-evaluation/period` 호출 경로 배선" 을 요구한다. slice 1 [evaluationPeriod.ts](../../web/src/api/evaluationPeriod.ts) (요청 조립 계약, T-1732) · slice 2 [DashboardPeriodSelector.tsx](../../web/src/components/DashboardPeriodSelector.tsx) (선택 컨트롤, T-1733) · slice 3 [periodEvaluationSubmit.ts](../../web/src/api/periodEvaluationSubmit.ts) (실행 + 응답 정규화, T-1734) 세 조각이 모두 머지됐으나 **어느 화면도 이 셋을 소비하지 않는다** — `origin/main` 실측상 `web/src/views/` 에서 세 모듈 import 0 이라 사용자가 기간 평가를 요청할 경로는 여전히 0 이다.

본 slice 4 는 그 세 조각을 대시보드 컨테이너에 배선해 **화면에서 실제로 POST 가 나가는 지점까지** 를 닫는다. 다만 성공 후 결과 표 재조회는 [useApiResource](../../web/src/api/useApiResource.ts) 가 `path` 변경만을 조회 trigger 로 삼아 별도 reload 수단이 없어(hook 계약 변경 동반) **slice 5 로 분리** 한다. 컨테이너가 이미 747 행 · spec 이 1556 행이라 배선과 재조회를 한 slice 에 넣으면 §3 상한을 크게 넘긴다 — T-1728 (순수 모듈 선행) → T-1729 · T-1730 (배선) 및 T-1723 (인원 선택 배선을 전용 spec 파일로 분리) 선례를 승계한다.

## Required Reading

- [docs/tasks/T-1734-period-evaluation-submit-module.md](T-1734-period-evaluation-submit-module.md) — 직전 slice 범위·경계 (본 task 의 상류)
- [web/src/api/periodEvaluationSubmit.ts](../../web/src/api/periodEvaluationSubmit.ts) — `submitPeriodEvaluation` / `normalizePeriodEvaluationResponse` / outcome 타입 (정본, 재선언 금지)
- [web/src/components/DashboardPeriodSelector.tsx](../../web/src/components/DashboardPeriodSelector.tsx) `30~44 행` — props 계약 (`onChangePeriod` / `onChangePeriodStart` / `onSubmit` / `submitting` / `error`)
- [web/src/api/evaluationPeriod.ts](../../web/src/api/evaluationPeriod.ts) — `PeriodEvaluationRequest` 타입 (컨테이너는 조립을 컨트롤에 위임하고 타입만 참조)
- [web/src/views/DashboardView.tsx](../../web/src/views/DashboardView.tsx) `373~410 행` (state 소유 구간) 과 `565~600 행` (인원 선택 핸들러 · personId 미선택 분기) — 배선 지점
- [web/src/views/DashboardView.person-selector.test.tsx](../../web/src/views/DashboardView.person-selector.test.tsx) `1~40 행` — 전용 spec 파일 관례 (`useApiResource` 를 `vi.mock` 으로 치환 + `renderToStaticMarkup` + 순수 helper 직접 호출)
- [docs/decisions/ADR-0041-frontend-composition-wiring.md](../decisions/ADR-0041-frontend-composition-wiring.md) Decision 1·3 — controlled lift-up 경계 (컴포넌트 수정 0, 상태는 컨테이너 소유)

## Acceptance Criteria

변경 대상은 2 파일뿐이다 — [web/src/views/DashboardView.tsx](../../web/src/views/DashboardView.tsx) 수정 + 신규 전용 spec `web/src/views/DashboardView.period-evaluation.test.tsx` (**colocated 위치 고정** — `web/src/views/` 안, `.test.tsx`, T-1723 의 `DashboardView.person-selector.test.tsx` 명명 관례 승계).

- [ ] 컨테이너가 기간 선택 상태를 `useState` 로 소유 — 기간 종류 · 시작일 · 진행 중 flag · 실패 문구 · 성공 문구. 초기값은 미선택(빈 값) 이고 `personId` 선택 변경 시 진행 중/실패/성공 문구는 초기화한다(직전 대상의 결과 문구가 다음 대상 화면에 남지 않도록).
- [ ] `DashboardPeriodSelector` 를 **personId 가 선택된 본문 분기에만** 마운트하고 위 상태를 props 로 내린다 (`personId` 는 컨테이너의 `selectedPersonId`). 컴포넌트 파일 수정 0 · 컨트롤이 이미 갖는 제출 가능 판정(`buildSelectionRequest`) 재발명 0.
- [ ] `onSubmit` 핸들러가 [periodEvaluationSubmit.ts](../../web/src/api/periodEvaluationSubmit.ts) 의 `submitPeriodEvaluation` 을 호출한다 — 호출 전 진행 중 true + 이전 문구 clear, 완료 후 진행 중 false. `fetch` 직접 호출 0 · `apiClient` 직접 import 0 (모듈 경유만).
- [ ] 결과 문구 파생을 **순수 함수로 분리해 export** (예: `derivePeriodEvaluationNotice(outcome)`) — 성공 outcome 은 `normalizePeriodEvaluationResponse` 결과를 사람-친화 한국어 문구로(건수 또는 `assessmentId`/생성 여부 반영), 실패 outcome 은 모듈이 준 한국어 사유를 그대로 전달. throw 0 · 입력 mutation 0. 렌더는 성공 문구를 `role="status"`, 실패 문구는 컨트롤의 `error` prop 으로 넘긴다.
- [ ] **happy-path unit test 1+** — 유효 선택으로 제출 시 `submitPeriodEvaluation` 이 컨트롤이 조립한 request 그대로 1 회 호출되고, 성공 outcome 이 성공 문구로 파생된다.
- [ ] **error path unit test 1+** — 제출 모듈이 `status: 'error'` 를 반환할 때 컨테이너가 throw 하지 않고 실패 문구를 파생한다(성공 문구는 미설정).
- [ ] **분기 test** — (a) personId 미선택 분기에서 기간 컨트롤 미렌더 · 선택 분기에서 렌더, (b) 결과 문구 파생의 성공/실패 분기, (c) 성공 정규화 결과가 건수형 / `assessmentId` 형 / 미상형일 때의 문구 분기 각 1+.
- [ ] **negative cases 충분 cover** — 최소 6 종 각 1+: (1) outcome 이 `null`/`undefined`, (2) outcome 이 알 수 없는 shape, (3) 실패 사유 문자열이 빈 값, (4) 성공 정규화 결과의 식별자·건수가 모두 `null`, (5) 인원 목록 조회가 error 인 상태에서도 기간 컨트롤 배선이 깨지지 않음, (6) 제출 모듈이 reject(throw) 할 때 컨테이너가 삼키고 실패 문구로 떨어뜨림 — 어느 경우도 throw 0.
- [ ] `pnpm --dir web test` (vitest) 전량 green — 기존 [DashboardView.test.tsx](../../web/src/views/DashboardView.test.tsx) · [DashboardView.person-selector.test.tsx](../../web/src/views/DashboardView.person-selector.test.tsx) 회귀 0. `pnpm --dir web build` (tsc + vite) green.
- [ ] 루트 `pnpm lint` green + `pnpm test:cov` green (line ≥ 80% / function ≥ 80%) — 본 task 는 `src/` diff 0 이라 backend coverage 불변임을 확인.
- [ ] `git diff --stat` 로 변경 파일이 위 2 개뿐임을 확인 (`web/src/components/*` · `web/src/api/*` · `src/` · `package.json` diff 0).

**크기 상한 사전 고지** — production(`DashboardView.tsx`) 순증은 ≤ 120 LOC 로 억제한다. R-112 4 항목 + negative 6 종 강제로 신규 spec 이 커져 총합이 §3 의 300 LOC 를 넘을 수 있으며, 그 경우 초과분이 전부 spec 이라는 사실을 PR 본문 · reviewer comment 에 명시하고 T-1723 (409 LOC, PR #1345) · T-1734 (455 LOC, PR #1364) 선례를 승계한다. 파일 수 상한 (5) 는 초과하지 않는다.

## Out of Scope

- **제출 성공 후 결과 재조회** (assessments/summaries 재조회 — `useApiResource` 의 reload 수단 신설 동반) — **slice 5** 가 담당. 본 task 에서 [useApiResource.ts](../../web/src/api/useApiResource.ts) 는 diff 0.
- `DashboardPeriodSelector.tsx` · `evaluationPeriod.ts` · `periodEvaluationSubmit.ts` 수정 — 세 계약 모두 머지됐고 본 컨테이너는 소비만 한다.
- personId 미선택 분기의 렌더 변경 · 인원 선택 배선(T-1723) 수정 · 표/정렬/필터/페이지네이션 파이프라인 수정.
- `reevaluate` 플래그 UI · `scope` 선택 UI 노출 (계약 기본값 `aggregate` 유지).
- backend (`src/`) 변경 · `prisma/` 변경 · 새 dependency 추가 (`@vitest/coverage-v8` · `@testing-library/*` 등) · CI workflow 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 추가)

## 결과 (2026-08-27 DONE)

PR [#1365](https://github.com/myungjoo/Assessment-Agent/pull/1365) → main `90b5aa05` squash 머지. 2 파일 `+419/-1` — production 순증 119 LOC(사전 고지 ≤120 준수), 초과분 299 LOC 는 전부 신규 전용 spec(`sizeExempt` 근거대로). `DashboardView` 가 기간 선택 상태를 `useState` 로 소유하고 `personId` 선택 분기에서만 `DashboardPeriodSelector` 를 마운트하며, 제출은 `submitPeriodEvaluation` 경유로만 나간다(`fetch`·`apiClient` 직접 호출 0). 결과 문구 파생은 순수 함수 `derivePeriodEvaluationNotice` 로 분리 export(throw 0 · mutation 0). 신규 spec 17 케이스로 R-112 4 종 전부 cover(happy 2 · error path 2 · 마운트/성공·실패/응답형 분기 · negative 6 종 + 건수 경계값). web vitest 83 파일 2484 test · web build · 루트 lint · `test:cov` 453 suite 13009 test 전량 green(`src/` diff 0 이라 backend coverage 불변). reviewer round 2/7 종결 후 4-게이트 충족.

**후속(slice 5)**: 제출 성공 후 결과 표 재조회 — `useApiResource` 가 `path` 변경만을 조회 trigger 로 삼아 별도 reload 수단이 없어 hook 계약 변경을 동반한다.
