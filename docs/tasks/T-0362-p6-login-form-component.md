---
id: T-0362
title: P6 frontend UI slice 2 — 로그인 폼 입력 presentational 컴포넌트 (web/src/components/LoginForm.tsx)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-040, REQ-084]
estimatedDiff: 140
estimatedFiles: 2
created: 2026-06-13
independentStream: p6-frontend-ui
dependsOn: [T-0353]
touchesFiles:
  - web/src/components/LoginForm.tsx
  - web/src/components/LoginForm.test.tsx
plannerNote: "P6 UI bullet1(로그인 흐름) 분해 — 순수 presentational 폼 컴포넌트(분기有: error/loading/입력검증), 새 dep 0, ci.yml 무관, T-0361 패턴 차용"
---

# T-0362 — P6 frontend UI slice 2: 로그인 폼 입력 presentational 컴포넌트

## Why

Q-0037 사용자 결정 ("P6 frontend 진입") 에 따라 P6 frontend UI 작업을 계속 분해한다. [PLAN.md](../PLAN.md) Phase P6 의 1번째 bullet **"로그인 / SuperAdmin 초기 셋업 흐름"** 의 첫 단계로, **로그인 입력 폼 presentational 컴포넌트**를 박제한다. [ADR-0040](../decisions/ADR-0040-frontend-stack.md) 가 React + Vite + TS stack 과 R-84 (Auth/RBAC) 의 frontend 진입점을 결정해 두었으므로, 그 위에 올라가는 UI slice 다.

본 task 는 직전 slice (T-0361 EvaluationGuardBanner) 와 동일하게 **데이터 의존성 0 의 순수 presentational 컴포넌트**로 시작한다. 폼은 입력값·콜백·error/loading 플래그를 props 로만 받아 토글하며, 실제 인증 요청 (`POST /api/auth/login` 소비)·라우팅·세션 저장·전역 상태 배선은 후속 slice 로 분리한다 (아래 Out of Scope). 이렇게 scaffold (T-0353) 외 어떤 task 에도 의존하지 않는 dependency-free 진입을 유지해, fine-grained concurrency (현재 stage 5b, direct-only 병렬) 하에서도 다른 web 파일과 file-disjoint 하게 둔다.

## Required Reading

- `web/src/components/EvaluationGuardBanner.tsx` — 직전 slice 의 순수 presentational 컴포넌트 패턴 (props 인터페이스 + 분기 + named/default export convention + 한국어 주석). 본 task 는 이 패턴을 그대로 차용한다.
- `web/src/components/EvaluationGuardBanner.test.tsx` 가 아니라 **`web/src/App.test.tsx`** — vitest 테스트 패턴: `react-dom/server` 의 `renderToStaticMarkup(<...>)` 로 **jsdom 없이** 정적 렌더 문자열만 검증 (dep 표면 최소화 — jsdom·@testing-library 도입은 ADR-0040 §5 게이트라 본 task 금지). 파일명은 `.test.tsx` 고정 (root jest `testRegex .*\.spec\.ts$` pickup 충돌 회피)
- `docs/decisions/ADR-0040-frontend-stack.md` — §1 (React + Vite + TS), §5 (dep 게이트: react/react-dom/vitest 만 — 그 외 import 금지)
- `web/tsconfig.json` — `jsx: react-jsx`, `strict: true`, `noUnusedLocals/Parameters` (lint-tight 컴파일)
- `web/package.json` — 사용 가능한 dep (react / react-dom / vitest 만 — 그 외 import 금지)

## Acceptance Criteria

- [ ] `web/src/components/LoginForm.tsx` 신설 — 로그인 입력값과 콜백을 props 로 받는 순수 함수형 컴포넌트. 최소 인터페이스 (예시 — 구현이 동등 의미로 조정 가능):
  - `{ username: string; password: string; onUsernameChange: (v: string) => void; onPasswordChange: (v: string) => void; onSubmit: () => void; loading?: boolean; error?: string }`
  - **분기 동작 (R-112 cover 대상)**:
    - `error` 가 truthy 면 에러 메시지를 `role="alert"` 영역에 렌더, 없으면 에러 영역 미렌더.
    - `loading === true` 면 submit 버튼을 `disabled` + 진행 표시 (예: 버튼 텍스트 "로그인 중…"), `loading` 이 false/undefined 면 정상 "로그인" 버튼.
    - `username` 또는 `password` 가 빈 문자열이면 submit 버튼 `disabled` (입력 미완 시 제출 방지), 둘 다 채워지면 enabled. `loading` 과의 우선순위는 구현이 정한 정책을 test 로 고정 (예: loading 이면 입력 충족 여부와 무관하게 disabled).
  - 새 dependency import 금지 (react 만). fetch·라우팅·`useState` 외부 store 사용 금지 — 상태는 props 로 받는다 (controlled component).
- [ ] R-112 unit tests — `web/src/components/LoginForm.test.tsx` (vitest, `renderToStaticMarkup` 사용 — jsdom 불요):
  - **happy-path 1+**: 유효한 `username`/`password` 가 채워진 상태로 렌더 시 submit 버튼이 enabled (`disabled` 속성 미포함) + "로그인" 텍스트 포함 검증.
  - **error/negative path 1+**: `error="자격 증명이 올바르지 않습니다"` 전달 시 렌더 결과에 해당 문구 + `role="alert"` 포함 검증.
  - **flow / branch**: 아래 분기 각 1+ test —
    - `loading={true}` → submit 버튼 `disabled` + 진행 표시("로그인 중") 렌더.
    - `loading` 미전달(false) → submit 버튼 정상("로그인").
    - `username=""` (또는 `password=""`) → submit 버튼 `disabled` (입력 미완).
    - 양쪽 채워짐 + `loading` 없음 → submit 버튼 enabled.
  - **negative cases 충분 cover** (예외 상황 분기마다 1+):
    - `error` 미전달 시 에러 영역(`role="alert"`)이 렌더되지 않음 (빈 에러가 자리 차지 안 함) 1+.
    - 빈 입력(`username=""`, `password=""`) 동시 + `error` 동시 전달 시 에러는 보이되 submit 은 여전히 `disabled` (복합 상태) 1+.
    - `loading={true}` 이면 입력이 모두 채워져 있어도 submit `disabled` (loading 우선 정책 — 구현이 택한 정책을 고정) 1+.
  - 실행: `pnpm --filter web test` (vitest run) 통과.
- [ ] **테스트 파일명은 `.test.tsx`** — root jest `testRegex` (`.*\.spec\.ts$`) pickup 충돌 회피. `web/` 아래에 `.spec.ts` 파일 금지. 컴포넌트·테스트 둘 다 `.tsx` 로 둬 `scripts/check-spec-presence.sh` 의 `*.ts` pathspec 밖에 둔다 (web `.ts` spec 정책은 BLOCKED T-0355 책임이므로 본 task 는 `.ts` 신설을 피한다).
- [ ] `pnpm --filter web build` 성공 — type-check(`tsc --noEmit`) + vite build green (`strict` + `noUnusedLocals/Parameters` 위반 0).
- [ ] 기존 backend 불변: root 에서 `pnpm lint && pnpm build && pnpm test` 그대로 green + `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — backend jest 에만 적용, web 은 vitest 별도). 본 task 는 `web/` 만 건드리므로 backend 영향 0 이어야 함.
- [ ] R-110: production code(컴포넌트) 변경이 있으므로 tester 가 위 명령(`pnpm --filter web test` + root `pnpm lint && pnpm build && pnpm test`)을 실행·green 확인.
- [ ] R-114: push 후 PR CI 전 step green 확인 — approval-gate ordering fail 은 STATE.json `ci.benignRedNote` case A 절차(reviewer approve comment post 후 `gh run rerun <id> --failed`)로 처리.

## Out of Scope

- **`.github/workflows/ci.yml` 변경 일절 금지** — web vitest 의 CI 자동 실행 step 추가는 BLOCKED 상태인 T-0355 (slice 3, `workflow` scope credential 대기) 의 책임. 본 task 의 web test 는 로컬/PR-검토 단계에서 실행하되 CI step 추가는 하지 않는다 (현 CI 가 무변경으로 green 이어야 함).
- 실제 인증 요청 (`POST /api/auth/login` 등 `/api/*` 소비) · 세션/토큰 저장 · 로그인 성공 후 라우팅 · SuperAdmin 초기 셋업 분기 로직 — 후속 slice. 본 task 는 입력값·콜백을 props 로 받는 순수 controlled 컴포넌트만.
- `App.tsx` 에 LoginForm wiring (렌더 트리 삽입) · 폼 로컬 state 보유 컨테이너 (예: `LoginPage`) — 라우팅/상태 소스가 없는 현 단계에선 make-work. 컴포넌트만 정의하고 export 한다. (T-0361 과 동일 정책 — 컴포넌트 정의·export 까지.)
- 시각화 대시보드 · Admin 패널 · 평가 진행 중 배너(T-0361 완료) 등 다른 P6 UI bullet — 각 후속 task.
- 새 dependency 추가 (jsdom · @testing-library · 라우터 · 폼 라이브러리 · 상태관리 · CSS 프레임워크 등) — 전부 ADR-0040 §5 new-dep 게이트(별도 승인). 본 task 는 react/react-dom/vitest 만 사용.
- web vitest **coverage threshold 도입**(`@vitest/coverage-v8` 새 dev dep) — §5 게이트, BLOCKED T-0355 Follow-up.
- 폼의 정교한 스타일링(CSS) · 접근성 정밀화(aria-describedby 연결 등 고급 패턴) — 의미 구조(`role="alert"` · label · button text · disabled 상태)만. 시각 디자인은 후속 styling slice.
- 클라이언트 측 입력 형식 검증(이메일 정규식·비밀번호 강도 등) — 본 task 의 "빈 입력 → disabled" 외 추가 검증 규칙은 후속. 빈 여부만 분기한다.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0040 이 stack·구조·R-84 frontend 진입점을 결정 완료, 본 task 는 그 위 presentational 폼 컴포넌트 1개 구현)

## Follow-ups

(생성 시 비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
