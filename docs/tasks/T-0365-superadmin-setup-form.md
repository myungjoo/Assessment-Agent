---
id: T-0365
title: P6 SuperAdmin 초기 셋업 폼 presentational 컴포넌트
phase: P6
status: DONE
commitMode: pr
prNumber: 297
completedAt: 2026-06-13T08:28:00Z
mergeCommit: 4c23f94
coversReq: [REQ-084]
estimatedDiff: 150
estimatedFiles: 2
created: 2026-06-13
touchesFiles:
  - web/src/components/SuperAdminSetupForm.tsx
  - web/src/components/SuperAdminSetupForm.test.tsx
dependsOn: []
independentStream: p6-frontend-ui
plannerNote: P6 bullet1(로그인/SuperAdmin 초기 셋업 흐름) R-84 분해 — slice 5, 순수 presentational, T-0361~T-0364 와 file-disjoint·새 dep 0.
---

# T-0365 — P6 SuperAdmin 초기 셋업 폼 presentational 컴포넌트

## Why

PLAN P6 bullet1 "로그인 / SuperAdmin 초기 셋업 흐름" 중 SuperAdmin 지정 부분(R-84: 첫 로그인 SuperAdmin 지정)을 UI slice 로 분해한다. 직전 P6 slice(T-0361 EvaluationGuardBanner / T-0362 LoginForm / T-0363 EvaluationResultTable / T-0364 DifficultyModelSelector)와 동일하게 props 기반 순수 presentational 컴포넌트만 신설하며, 실제 fetch·전역 상태·라우팅 배선은 후속 slice 책임이다. 본 컴포넌트는 LoginForm 과 별개로 "최초 부트스트랩 시 SuperAdmin 계정 1개를 지정하는" 셋업 단계를 담당한다.

## Required Reading

- `web/src/components/LoginForm.tsx` — controlled 입력 폼·error/loading 분기·submit disabled·named/default export convention 의 직전 선례.
- `web/src/components/LoginForm.test.tsx` — `renderToStaticMarkup` 기반 정적 markup 검증 패턴(jsdom·@testing-library 없이 dep 표면 최소화).
- `web/src/components/DifficultyModelSelector.tsx` — loading/empty/populated 분기 + role="status"/role="alert" 접근성 convention.
- `web/src/components/DifficultyModelSelector.test.tsx` — R-112 4종(happy/error/branch/negative) 분기 검증 + 빈 문자열 경계값·loading 우선 정책 등 negative case 분류 선례.

## Acceptance Criteria

- [ ] `web/src/components/SuperAdminSetupForm.tsx` 신설. props 만 받는 순수 presentational controlled 컴포넌트 — 최소 다음 props: `username`/`password`(controlled value), `onUsernameChange`/`onPasswordChange`/`onSubmit` 콜백, `loading?`(제출 진행 중), `error?`(셋업 실패 문구). loading 우선 정책 + 입력 검증(빈 입력 시 submit 비활성) + error 시 `role="alert"` 영역 렌더를 포함한다.
- [ ] named export(props 타입)와 default export(컴포넌트)를 직전 컴포넌트와 동일 convention 으로 제공한다.
- [ ] `web/src/components/SuperAdminSetupForm.test.tsx` 신설 — colocated spec. `vitest` + `react-dom/server` 의 `renderToStaticMarkup` 으로 정적 markup 만 검증(새 dep 0). 파일명은 `.test.tsx` 고정(root jest `*.spec.ts` testRegex pickup 충돌 회피).
- [ ] **Happy-path test 1+**: username/password 정상 전달 시 폼 입력 필드·submit 버튼이 렌더되고 submit 이 활성 상태임을 검증.
- [ ] **Error path test 1+**: `error` truthy 전달 시 `role="alert"` 영역에 문구가 렌더됨을 검증.
- [ ] **Flow/branch test**: loading 분기(`loading=true` → 로딩 표시·submit 비활성), error 존재/부재 분기, 빈 입력→submit disabled 분기 각각 1+ test.
- [ ] **Negative cases 충분 cover (각 1+)**: 빈 문자열 `error`(falsy → alert 미렌더 경계값), username·password 중 하나만 빈 경우(submit 여전히 disabled), loading=true 가 error 보다 우선(loading 우선 정책), 공백만 입력한 경우 disabled 유지 등 예외 분기마다 test.
- [ ] `cd web && pnpm test` 통과(web vitest 전부 green) — 신규 spec 포함.
- [ ] `cd web && pnpm lint && pnpm build` 통과.
- [ ] 본 컴포넌트는 분기(loading/error/입력검증)가 있으므로 각 분기 1+ test 로 coverage line ≥ 80% / function ≥ 80% 충족(web vitest 기준).

## Out of Scope

- 실제 셋업 API 호출(POST)·전역 상태·라우팅·App.tsx 배선 — 후속 slice 책임.
- `.github/workflows/ci.yml` 에 web vitest 배선(T-0355 credential 게이트 — 본 task 는 ci.yml 무관, 로컬 `pnpm test` 로만 검증).
- 새 dependency 추가(jsdom·@testing-library 등) — `renderToStaticMarkup` 으로 충분.
- LoginForm 등 기존 컴포넌트 수정 — file-disjoint 유지.
- self-demote 금지·Admin→User 변경 등 R-84 의 나머지 RBAC 규칙(별도 slice).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음)
