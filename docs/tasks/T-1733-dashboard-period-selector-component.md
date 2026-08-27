---
id: T-1733
title: 대시보드 기간 지정 선택 컴포넌트 DashboardPeriodSelector 신설
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-077]
estimatedDiff: 290
estimatedFiles: 2
independentStream: p6-dashboard-period
dependsOn: []
touchesFiles:
  - web/src/components/DashboardPeriodSelector.tsx
  - web/src/components/DashboardPeriodSelector.test.tsx
created: 2026-08-27
plannerNote: PLAN 131 행 ④(REQ-077) slice 2 — T-1732 요청 계약을 소비하는 순수 presentational 기간 선택 컨트롤, 배선·실 POST 는 slice 3.
---

# T-1733 — 대시보드 기간 지정 선택 컴포넌트 DashboardPeriodSelector 신설

## Why

오너 지시 [PLAN](../PLAN.md) `131 행` 의 ① · ② · ③ 은 모두 닫혔고 남은 항목은 **④ 기간(일/주/월 + 시작 시점) 지정 UI + `POST /api/assessment-evaluation/period` 호출 경로 배선** = [requirements.md](../requirements.md) **REQ-077** 뿐이다. 직전 slice [T-1732](T-1732-evaluation-period-request-module.md) 가 요청 계약 순수 모듈 [evaluationPeriod.ts](../../web/src/api/evaluationPeriod.ts)(export 7 종)를 박제했으나 **소비처가 아직 0** 이라 화면에는 기간을 고를 수단이 여전히 없다. 실측 근거: `origin/main` 의 `web/` 에서 `PeriodSelector` 참조 **0 건** (issue-still-relevant pre-check 통과).

④ 전체(계약 + 선택 UI + DashboardView 배선 + 실 POST)는 §3 상한(300 LOC / 5 파일)을 크게 넘기므로 T-1728(순수 모듈) → T-1729·T-1730(배선) 선례를 승계해 **slice 2 = 순수 presentational 선택 컨트롤만** 으로 자른다. 본 slice 는 [ADR-0041](../decisions/ADR-0041-frontend-composition-wiring.md) Decision 1 의 presentational 경계를 지켜 fetch·상태 소유 0 으로 만들고, 배선과 실 POST 는 slice 3 이 이어받는다.

## Required Reading

- [web/src/api/evaluationPeriod.ts](../../web/src/api/evaluationPeriod.ts) — 소비할 계약. `EVALUATION_PERIOD_OPTIONS`(value/label 3 종) · `EvaluationPeriodGranularity` · `DEFAULT_EVALUATION_SCOPE` · `isEvaluationPeriodGranularity` · `normalizePeriodStartInput` · `buildPeriodEvaluationRequest`(무효 시 throw 없이 `null`).
- [web/src/components/DashboardPersonSelector.tsx](../../web/src/components/DashboardPersonSelector.tsx) — 직전 동형 선택 컨트롤. props 계약 · 분기 순서(loading 우선 → error → empty → populated) · 순수 함수 분리 · named + default export convention 을 그대로 차용한다.
- [web/src/components/DashboardPersonSelector.test.tsx](../../web/src/components/DashboardPersonSelector.test.tsx) — colocated spec 작성 관례(파일명은 `.test.tsx`, 정적 렌더 환경에서 콜백을 순수 함수로 검증).
- [docs/architecture/api.md](../architecture/api.md) `104 행` — `POST /api/assessment-evaluation/period` 계약 정본(참조만, 호출은 범위 밖).

## Acceptance Criteria

- [ ] `web/src/components/DashboardPeriodSelector.tsx` 신설 — 순수 presentational **controlled** component. props 로만 상태를 받는다: 선택된 `period`(granularity) · `periodStart`(`YYYY-MM-DD` 문자열) · `personId`(현재 대시보드가 선택 중인 인원, 미선택 허용) · `onChangePeriod` · `onChangePeriodStart` · `onSubmit` · `submitting?` · `error?`.
- [ ] 기간 종류 컨트롤은 `EVALUATION_PERIOD_OPTIONS` 를 소비해 렌더한다 — 라벨 문자열(`일간`/`주간`/`월간`)이나 literal 3 종을 컴포넌트 안에서 **재선언하지 않는다**(계약 이중 정의 금지).
- [ ] 시작 시점 컨트롤은 `<input type="date">` 이고 입력값을 **그대로** 상위에 전달한다 — 프런트 timezone offset 산술 · `Date` 재조립 **0**(KST 해석은 backend `parseKstPeriodInput` 책임, 근거를 주석에 명시).
- [ ] 제출 가능 여부는 `buildPeriodEvaluationRequest` 결과가 `null` 인지로 판정하는 **순수 export 함수** 1 개로 분리한다(예: `buildSelectionRequest` / `canSubmitPeriodSelection`) — 조건을 컴포넌트 안에서 재발명하지 않고, 불가하면 제출 버튼을 `disabled` 로 둔다.
- [ ] `onSubmit` 은 조립된 request(또는 그 body)를 인자로 호출한다 — 컴포넌트는 `fetch` · `apiClient` · `useApiResource` 를 import 하지 않고 실제 POST 를 수행하지 않는다.
- [ ] `error` 가 truthy 면 `role="alert"` 로 렌더하되 **선택 컨트롤을 삼키지 않는다**(에러가 수단을 없애면 REQ-077 취지 위반). `submitting` 이 true 면 제출 버튼 비활성 + 진행 문구 노출.
- [ ] named export + default export 를 함께 제공(기존 components 관례 동형).
- [ ] colocated spec `web/src/components/DashboardPeriodSelector.test.tsx` 신설 — 위치는 **colocated 고정**(`web/src/components/` 아래, `.test.tsx`).
- [ ] **happy-path test** — 추가된 각 public symbol(컴포넌트 · 순수 export 함수) 1+ : 옵션 3 종 렌더 · 선택된 값 반영 · 유효 입력에서 제출 버튼 활성 + `onSubmit` 이 계약 body(`personId`/`period`/`scope`/`periodStart`)로 호출됨.
- [ ] **error path test** — 무효 입력에서 순수 함수가 **throw 없이** `null`/`false` 반환, `error` prop 렌더 시에도 컨트롤이 그대로 존재.
- [ ] **분기 test** — `submitting` true/false · `error` 유무 · `personId` 미선택 vs 선택 · `scope` 기본값(`DEFAULT_EVALUATION_SCOPE`) 적용 분기 각 1+.
- [ ] **negative cases 충분 cover** — 예외 분기마다 1+ : (a) `personId` 빈 문자열/undefined (b) `periodStart` 빈 문자열 (c) 불가능 날짜 `2026-02-30` (d) zero-pad 누락 `2026-2-3` (e) 허용 밖 granularity `'year'` (f) 대소문자 변형 `'DAY'` (g) `props` 비문자열 값(숫자 등) 주입 (h) 정의 외 키가 `onSubmit` body 로 새지 않음.
- [ ] **drift guard 1+** — 컴포넌트가 `EVALUATION_PERIOD_OPTIONS` 의 value 집합과 동일한 option value 를 렌더함을 단언(계약에 option 이 추가/변경되면 fail).
- [ ] `pnpm --dir web test` green (기존 web vitest 전량 회귀 0), `pnpm --dir web build`(tsc) green.
- [ ] 루트 `pnpm lint` green + `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). `src/` diff 0 이라 backend coverage 불변임을 PR 본문에 명시.
- [ ] 변경 파일 **2 개** — 위 `touchesFiles` 외 diff 0(특히 `web/src/views/DashboardView.tsx` · `web/src/AppShell.tsx` · `web/src/api/*` · `src/` · `package.json` 미변경, 새 dependency 0).

## Out of Scope

- `DashboardView` / `AppShell` 배선, 상태 lift-up, 컨테이너 useMemo/useState 추가 — **slice 3** 책임.
- 실제 `POST /api/assessment-evaluation/period` 호출 · 응답 반영 · 실패 표시 · 재조회 트리거.
- `evaluationPeriod.ts` 수정(계약 변경) — 필요하면 Follow-ups 에 적고 별도 slice.
- `reevaluate` 플래그 UI(Admin 전용) · scope 선택 UI — 본 slice 는 기본값 경로만.
- 전역 CSS · 스타일 도입(PLAN R-187 소관), backend 변경, e2e 추가.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (후속 slice 3) DashboardView 배선 + 실 `POST /api/assessment-evaluation/period` 호출 · 응답 반영 · 실패 표시.
