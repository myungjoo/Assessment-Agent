---
id: T-1734
title: 기간 지정 평가 요청 실행·응답 정규화 순수 모듈 periodEvaluationSubmit 신설
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-077]
estimatedDiff: 300
estimatedFiles: 2
created: 2026-08-27
independentStream: web-req077-period
dependsOn: [T-1732, T-1733]
touchesFiles:
  - web/src/api/periodEvaluationSubmit.ts
  - web/src/api/periodEvaluationSubmit.test.ts
plannerNote: "P6 오너지시 PLAN 131행 ④ / REQ-077 slice 3 — POST 실행+role별 응답 정규화를 순수 모듈로 선행(배선은 slice 4)"
---

# T-1734 — 기간 지정 평가 요청 실행·응답 정규화 순수 모듈 periodEvaluationSubmit 신설

## Why

오너 지시 [PLAN](../PLAN.md) `131 행` ④ (REQ-077) 는 "기간(일/주/월 + 시작) 지정 UI + `POST /api/assessment-evaluation/period` 호출 경로 배선" 을 요구한다. slice 1 (T-1732) 이 요청 조립 계약 [evaluationPeriod.ts](../../web/src/api/evaluationPeriod.ts) 를, slice 2 (T-1733) 가 선택 컨트롤 [DashboardPeriodSelector.tsx](../../web/src/components/DashboardPeriodSelector.tsx) 를 박제했으나 **실 POST 를 수행하는 코드는 아직 0** 이다 (`origin/main` 의 `web/` 에서 `PERIOD_EVALUATION_PATH` 소비처는 spec 과 컨트롤의 조립뿐 — 실 호출 0, planner 실측).

본 slice 3 은 그 공백 중 **네트워크 실행 + 응답 정규화** 만 순수 모듈로 잘라 박제한다. 남은 `DashboardView` 배선 (상태 소유 · 렌더 · 재조회) 은 slice 4 가 이어받는다. 분리 근거: backend `POST /period` 는 **role 에 따라 body shape 이 갈리는** endpoint 라 (`User` → `EvaluationResult[]` ephemeral, `Admin` → `PeriodBridgeAdminResponse` = `{assessmentId, personId, period, scope, periodStart, created}`) 정규화 자체가 분기 있는 실 로직이고, `DashboardView.tsx` 는 이미 747 행 · 그 spec 은 1556 행이라 한 slice 에 실행·정규화·배선을 모두 넣으면 §3 상한 (300 LOC / 5 파일) 을 크게 넘긴다. T-1728 (순수 모듈 선행) → T-1729·T-1730 (배선) 선례를 승계한다.

## Required Reading

- [docs/tasks/T-1733-dashboard-period-selector.md](T-1733-dashboard-period-selector.md) — 직전 slice 범위·경계 (본 task 의 상류)
- [web/src/api/evaluationPeriod.ts](../../web/src/api/evaluationPeriod.ts) — `PERIOD_EVALUATION_PATH` / `PeriodEvaluationRequest` / `PeriodEvaluationRequestBody` 계약 (정본, 재선언 금지)
- [web/src/api/apiClient.ts](../../web/src/api/apiClient.ts) — `request` / `ApiError`(status 0 = 네트워크) 계약
- [web/src/api/exportJobFlow.ts](../../web/src/api/exportJobFlow.ts) — deps 주입형 async 순수 모듈 선례 (`ExportJobFlowDeps` 패턴 차용)
- [web/src/api/exportJobFlow.test.ts](../../web/src/api/exportJobFlow.test.ts) — 위 모듈의 colocated spec 작성 관례 (web 은 `.test.ts` 확장자)
- [src/assessment-evaluation/assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) `97~130 행` + `@Post("period")` 핸들러 — role 분기 응답 shape 정본
- [docs/decisions/ADR-0041-frontend-composition-wiring.md](../decisions/ADR-0041-frontend-composition-wiring.md) Decision 1·3 — container/presentational 경계 + apiClient 경유 원칙

## Acceptance Criteria

구현 대상은 신규 파일 2 개뿐이다 — production [web/src/api/periodEvaluationSubmit.ts](../../web/src/api/periodEvaluationSubmit.ts) + colocated spec `web/src/api/periodEvaluationSubmit.test.ts` (**colocated 위치 고정** — `web/src/api/` 안, `.test.ts`).

- [ ] `submitPeriodEvaluation(request, deps)` export — `deps.request` 를 주입받아 `request.path` 로 `method: 'POST'` + `Content-Type: application/json` + `JSON.stringify(request.body)` 호출. `deps` 미주입 시 기본값은 `apiClient` 의 `request`. `fetch` 직접 호출 0 · `react` import 0 · `EVALUATION_PERIOD_OPTIONS` 등 계약 literal 재선언 0.
- [ ] 결과는 throw 하지 않고 판별 가능한 outcome 으로 반환 — 성공은 `{ status: 'ok', ... }`, 실패는 `{ status: 'error', message }` (한국어 사유). 타입을 export 해 slice 4 가 소비할 수 있게 한다.
- [ ] `normalizePeriodEvaluationResponse(response: unknown)` export — role 분기 응답을 하나의 표시용 shape 으로 정규화: (a) 배열 (User ephemeral `EvaluationResult[]`) → 건수 보존 + `assessmentId`/`created` 는 `null`, (b) `assessmentId` 문자열을 가진 객체 (Admin `PeriodBridgeAdminResponse`) → `assessmentId` + `created` boolean 보존, (c) 그 외 알 수 없는 shape → throw 없이 건수/식별자 `null` 의 일반 성공. 입력 mutation 0.
- [ ] 실패 사유는 status 별 한국어 구분 문구로 매핑 (최소 `0`=네트워크, `400`=요청 값 오류, `401`=인증 만료, `403`=권한 부족, 그 외 5xx/미상). `useApiResource` 의 `toErrorMessage` 를 import 하지 않는 이유 (react 유입 회피 + REQ-077 이 요구하는 사유 구분이 `HTTP <status>: ...` generic 과 다름) 를 파일 머리 주석에 1~2 줄 명시.
- [ ] **happy-path unit test 1+** — 유효 `PeriodEvaluationRequest` 로 호출 시 `deps.request` 가 정확한 path·method·헤더·직렬화 body 로 1 회 호출되고 `status: 'ok'` 반환.
- [ ] **error path unit test 1+** — `deps.request` 가 `ApiError` 를 reject 할 때 throw 하지 않고 `status: 'error'` + 한국어 사유를 반환.
- [ ] **분기 test** — 정규화 3 분기 (배열 / `assessmentId` 객체 / 알 수 없는 shape) 각 1+ 및 에러 status 매핑 분기 각 1+.
- [ ] **negative cases 충분 cover** — 최소 6 종 각 1+: (1) `request` 가 `null`/`undefined`, (2) `request.body` 부재, (3) `deps.request` 가 비-`ApiError` (`Error` 아님, 예: 문자열) 로 reject, (4) 응답이 `null`, (5) 응답이 `assessmentId` 가 문자열이 아닌 객체, (6) 응답 배열 안 원소가 비객체 — 어느 경우도 throw 0.
- [ ] `pnpm --dir web test` (vitest) 전량 green, `pnpm --dir web build` (tsc + vite) green.
- [ ] 루트 `pnpm lint` green + `pnpm test:cov` green (line ≥ 80% / function ≥ 80%) — 본 task 는 `src/` diff 0 이라 backend coverage 불변임을 확인.
- [ ] `git diff --stat` 로 변경 파일이 위 2 개뿐임을 확인 (`DashboardView.tsx` · `DashboardPeriodSelector.tsx` · `evaluationPeriod.ts` · `src/` · `package.json` diff 0).

**크기 상한 사전 고지** — production 은 ≤ 130 LOC / 1 파일로 억제한다. R-112 4 항목 + negative 6 종 강제로 spec 이 커져 총합이 §3 의 300 LOC 를 넘을 수 있으며, 그 경우 초과분이 전부 spec 이라는 사실을 PR 본문·reviewer comment 에 명시하고 T-1726 (411 LOC, PR #1356) · T-1728 (444 LOC, PR #1358) 선례를 승계한다. 파일 수 상한 (5) 는 초과하지 않는다.

## Out of Scope

- `DashboardView.tsx` 배선 (기간 상태 소유 · 컨트롤 마운트 · 제출 후 재조회 · 성공/실패 표시) — **slice 4** 가 담당. 본 task 에서 `web/src/views/` 는 diff 0.
- `DashboardPeriodSelector.tsx` · `evaluationPeriod.ts` 수정 — 두 계약은 이미 머지됐고 본 모듈은 소비만 한다.
- `reevaluate` 플래그 UI · `scope` 선택 UI 노출 (계약 기본값 `aggregate` 유지).
- backend (`src/`) 변경 · `prisma/` 변경 · 새 dependency 추가 (`@vitest/coverage-v8` 등) · CI workflow 변경.
- `useApiResource` 에 refetch 기능 추가 등 공용 hook 수정 — 필요하면 slice 4 의 Follow-ups 로.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 추가)
