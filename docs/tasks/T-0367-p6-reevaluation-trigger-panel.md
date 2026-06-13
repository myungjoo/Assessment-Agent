---
id: T-0367
title: P6 재평가(N일 재수집) 트리거 패널 presentational 컴포넌트 분해
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-041]
estimatedDiff: 165
estimatedFiles: 2
created: 2026-06-13
independentStream: p6-frontend-ui
dependsOn: []
touchesFiles:
  - web/src/components/ReEvaluationTriggerPanel.tsx
  - web/src/components/ReEvaluationTriggerPanel.test.tsx
plannerNote: P6 bullet3(Admin 패널 인원·그룹·재평가·import/export·스케줄)의 "재평가" — REQ-041(R-74 최근 N일 delete→재수집) 트리거 패널 분해. 직전 6 P6 컴포넌트와 file-disjoint·dep 0.
---

# T-0367 — P6 재평가(N일 재수집) 트리거 패널 presentational 컴포넌트 분해

## Why

PLAN.md Phase P6 "Admin 패널 (인원·그룹·**재평가**·import/export·스케줄)" bullet 의 "재평가" 조각을 구현한다. README REQ-041 (R-74) — Admin 이 최근 N일(예: 1일/7일/30일) 결과를 manual delete 후 재수집하는 흐름 — 의 UI building block 이다. backend 의 재수집/삭제 API 는 별도 phase(P7)에서 완결될 예정이므로, 본 slice 는 그 위에 올라가는 **순수 presentational controlled component** 만 책임진다: 선택 가능한 N일 window 목록·선택값·진행 상태·에러를 props 로만 받아 렌더하고, 트리거 버튼 클릭 시 콜백만 호출한다. 직전 6 개 P6 컴포넌트(EvaluationGuardBanner / LoginForm / EvaluationResultTable / DifficultyModelSelector / SuperAdminSetupForm / GroupMemberList)와 동일한 props/분기/named·default export convention 을 차용한다.

## Required Reading

- `web/src/components/GroupMemberList.tsx` — 가장 최근 머지된 동형 컴포넌트(loading>error>empty>populated 분기, named+default export, role="status"/"alert"). 분기 구조·export·주석 스타일을 그대로 차용.
- `web/src/components/GroupMemberList.test.tsx` — `renderToStaticMarkup` 정적 렌더 패턴(jsdom/@testing-library 없이 markup 문자열만 assert), `.test.tsx` 명명 이유(root jest testRegex 충돌 회피), happy/error/branch/negative 케이스 구성.
- `web/src/components/DifficultyModelSelector.tsx` — select/option 류 controlled 선택 UI 패턴(선택지 목록·선택값·onChange 콜백) 참고. 본 컴포넌트의 N일 window 선택부 형태 차용.
- `docs/decisions/ADR-0040-frontend-stack.md` §2(SPA 는 `/api/*` 순수 소비자, frontend 는 `src/` 미변경) + §5(새 dependency 도입 절차 — react/react-dom/vitest 외 dep 추가 금지).

## Acceptance Criteria

- [ ] `web/src/components/ReEvaluationTriggerPanel.tsx` 신설 — 순수 presentational controlled component. 다음 props 를 받는다(이름은 구현 재량이나 의미 고정):
  - `windows`: 선택 가능한 N일 window 목록(예: `[{ days: 1, label: '최근 1일' }, { days: 7, label: '최근 1주' }, { days: 30, label: '최근 30일' }]`).
  - `selectedDays`: 현재 선택된 window 의 days 값(controlled).
  - `onSelect(days)`: window 선택 변경 콜백.
  - `onTrigger(days)`: 재수집 트리거 버튼 클릭 콜백.
  - `submitting?`: 진행 중 플래그 — true 면 트리거 버튼 비활성 + 진행 표시(role="status").
  - `error?`: 에러 문구(선택) — truthy 면 role="alert" 영역에 렌더.
  - `confirmText?` 또는 동등 — 파괴적(delete→재수집) 동작임을 알리는 경고 문구(선택, 기본 한국어 문구 fallback).
- [ ] named export(타입 `ReEvaluationTriggerPanelProps` 및 window 항목 타입) + default export(컴포넌트) 둘 다 제공 — GroupMemberList 와 동일 convention.
- [ ] 분기 정책: submitting=true 우선(진행 중이면 트리거 버튼 disabled + 진행 표시) → error truthy 시 role="alert" 렌더 → 정상 시 window 선택 UI + 트리거 버튼 렌더. `windows` 빈 배열이면 트리거 불가 상태(빈 상태 문구 또는 버튼 disabled)로 처리(의미 없는 빈 트리거 방지).
- [ ] `web/src/components/ReEvaluationTriggerPanel.test.tsx` 신설 — `react-dom/server` 의 `renderToStaticMarkup` 으로 정적 markup 만 assert(jsdom/@testing-library 미사용, dep 표면 최소). 파일명 `.test.tsx` 고정.
- [ ] **Happy-path test 1+**: windows + selectedDays 정상 전달 시 각 window label 렌더 + 트리거 버튼(`<button`) 렌더 검증.
- [ ] **Error path test 1+**: error truthy 전달 시 role="alert" 영역에 문구 렌더 + 정상 선택 UI 미렌더 검증.
- [ ] **각 분기 1+ test**: submitting=true(진행 표시 + 트리거 버튼 disabled) / error 렌더 / 정상 렌더 / windows 빈 배열(빈/disabled 상태) 각 분기별 test 분리.
- [ ] **Negative cases 충분 cover(예외 상황 분기마다 1+)**: ① submitting=true 가 error 보다 우선(둘 다 전달 시 진행 표시만) ② error="" (빈 문자열 falsy) → alert 미렌더·정상 UI 렌더(경계값) ③ windows 빈 배열 → 트리거 버튼 disabled 또는 미렌더(빈 입력) ④ selectedDays 가 windows 에 없는 값 → throw 없이 안전 렌더(type/값 mismatch 경계) ⑤ 경고/confirm 문구 미전달 시 기본 문구 fallback, 빈 문자열이면 기본 문구로 fallback. 단일 negative 만 작성 금지 — 위 예외 분기마다 cover.
- [ ] `pnpm --filter web test` (vitest) 로컬 통과 — 전 case green. (ci.yml web vitest 배선은 T-0355 게이트 backlog 이므로 본 task 미포함 — PR 본문에 "web vitest 로컬 검증, ci.yml 미배선(T-0355 Follow-up)" 명시.)
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — 신규 컴포넌트가 colocated test 로 충분 cover 되어 web 패키지 coverage threshold 충족. (root jest 는 web 미포함이므로 web 측 vitest coverage 로 검증.)
- [ ] 새 dependency 0 — react/react-dom/vitest 외 import 추가 없음(`package.json`/`pnpm-lock.yaml` 무변경). `.github/workflows/` 무변경.

## Out of Scope

- 실제 `/api/*` fetch / 재수집·삭제 API 호출 / 낙관적 업데이트 / 전역 상태 / 라우팅 배선 — 후속 container slice 책임(본 컴포넌트는 props/콜백만).
- backend 재수집·N일 delete endpoint 신설/변경(`src/` 변경) — P7 backend 책임. 본 task 는 frontend 만.
- App.tsx composition wiring / 다른 P6 컴포넌트와의 조합 레이아웃.
- jsdom / @testing-library 도입(새 dep — ADR-0040 §5 게이트). 이벤트 발화 검증은 본 slice 범위 밖(정적 markup 만).
- confirm 모달 / 실제 사용자 확인 흐름 로직 — 본 컴포넌트는 경고 문구 렌더와 콜백 호출까지만.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
