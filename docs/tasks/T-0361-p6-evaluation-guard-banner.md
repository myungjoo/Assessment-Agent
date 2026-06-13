---
id: T-0361
title: P6 frontend UI slice 1 — R-78 평가 진행 중 경고 배너 컴포넌트 (web/src/components/EvaluationGuardBanner.tsx)
phase: P6
status: DONE
commitMode: pr
prNumber: 293
completedAt: 2026-06-13T06:31:03Z
mergeCommit: cdea958
coversReq: [REQ-042, REQ-038]
estimatedDiff: 110
estimatedFiles: 2
created: 2026-06-13
independentStream: p6-frontend-ui
dependsOn: [T-0353]
touchesFiles:
  - web/src/components/EvaluationGuardBanner.tsx
  - web/src/components/EvaluationGuardBanner.test.tsx
plannerNote: "P6 UI bullet4(R-78 시각화 보호) 분해 — scaffold 후 첫 UI slice, .tsx pure 컴포넌트(분기有), 새 dep 0, ci.yml 무관"
---

# T-0361 — P6 frontend UI slice 1: R-78 평가 진행 중 경고 배너 컴포넌트

## Why

Q-0037 사용자 결정 ("P6 frontend 진입") 에 따라 P6 frontend UI 작업을 분해한다. [PLAN.md](../PLAN.md) Phase P6 의 4번째 bullet **"평가 진행 중 시각화 보호 (R-78) — 평가 자료 수집/평가 중에는 기존 자료만 표시 + 상단 경고 배너"** 와 [ADR-0040](../decisions/ADR-0040-frontend-stack.md) §6 (R-78 의 frontend 측 책임 = 실행 상태에 따라 배너 토글) 를 충족하는 첫 단계로, **평가 진행 중임을 알리는 전역 경고 배너 presentational 컴포넌트**를 박제한다.

본 task 는 scaffold chain (T-0353 workspace+Vite SPA / T-0354 serve-static) 위에 올라가는 **첫 실 UI slice** 다. 배너는 평가 실행 상태를 props 로 받아 토글하는 순수 presentational 컴포넌트로, 실행 상태 polling·`/api/*` 소비·전역 상태 배선 같은 책임은 후속 slice 로 분리한다 (아래 Out of Scope). 이렇게 데이터 의존성 0 으로 시작해야 scaffold 외 어떤 task 에도 의존하지 않는 dependency-free 진입이 된다.

## Required Reading

- `docs/decisions/ADR-0040-frontend-stack.md` — §1 (React + Vite + TS), §6 (R-78 의 frontend 측 책임: 실행 상태에 따라 배너 토글 + 기존 자료만 표시 — 단 polling/endpoint 는 본 task 범위 아님)
- `web/src/App.tsx` — 현 정적 placeholder 컴포넌트 구조 (함수형 컴포넌트 + named/default export convention)
- `web/src/App.test.tsx` — vitest 테스트 패턴: `react-dom/server` 의 `renderToStaticMarkup(<...>)` 로 **jsdom 없이** 정적 렌더 문자열만 검증 (dep 표면 최소화 — jsdom·@testing-library 도입은 ADR-0040 §5 게이트라 본 task 금지). 파일명은 `.test.tsx` 고정 (root jest `testRegex .*\.spec\.ts$` pickup 충돌 회피)
- `web/tsconfig.json` — `jsx: react-jsx`, `strict: true`, `noUnusedLocals/Parameters` (lint-tight 컴파일)
- `web/package.json` — 사용 가능한 dep (react / react-dom / vitest 만 — 그 외 import 금지)

## Acceptance Criteria

- [ ] `web/src/components/EvaluationGuardBanner.tsx` 신설 — props 로 평가 실행 상태를 받는 순수 함수형 컴포넌트. 최소 인터페이스: `{ active: boolean; message?: string }`. `active === true` 면 경고 배너(예: `role="alert"` + 기본 한국어 경고 문구 "평가가 진행 중입니다. 표시되는 자료는 직전까지 수집된 기존 자료입니다.")를 렌더, `active === false` 면 `null` 반환(아무것도 렌더 안 함). `message` 가 주어지면 기본 문구 대신 사용. 새 dependency import 금지 (react 만).
- [ ] R-112 unit tests — `web/src/components/EvaluationGuardBanner.test.tsx` (vitest, `renderToStaticMarkup` 사용 — jsdom 불요):
  - **happy-path 1+**: `active={true}` 렌더 결과에 기본 경고 문구("평가가 진행 중") 포함 + `role="alert"` 속성 포함 검증.
  - **error/negative path 1+**: `active={false}` 렌더 결과가 빈 문자열(`''`)임 검증 — 비활성 시 배너 미노출 (자료 화면을 가리지 않음).
  - **flow / branch**: `active` 의 true/false 2 분기 각 1+ test (위 두 항목이 곧 분기 cover — 본 컴포넌트의 핵심 분기).
  - **negative cases 충분 cover**:
    - `active={true}` + custom `message` 전달 시 기본 문구가 아닌 custom 문구를 렌더(기본 문구 미포함) 1+.
    - `active={true}` + 빈 문자열 `message=""` 같은 경계 입력 처리 검증(빈 message 면 기본 문구로 fallback 하거나 빈 message 를 그대로 렌더하지 않음 — 구현이 택한 정책을 test 로 고정) 1+.
    - `active={false}` 일 때는 `message` 가 주어져도 배너를 렌더하지 않음(빈 출력) 1+.
  - 실행: `pnpm --filter web test` (vitest run) 통과.
- [ ] **테스트 파일명은 `.test.tsx`** — root jest `testRegex` (`.*\.spec\.ts$`) pickup 충돌 회피. `web/` 아래에 `.spec.ts` 파일 금지(`.tsx` 는 패턴 불일치라 안전하나 규율로 `.test.tsx` 고정). 컴포넌트 파일도 `.tsx` 로 둬 `scripts/check-spec-presence.sh` 의 `*.ts` pathspec 밖에 둔다(web `.ts` spec 정책은 BLOCKED T-0355 책임이므로 본 task 는 `.ts` 신설을 피한다).
- [ ] `pnpm --filter web build` 성공 — type-check(`tsc --noEmit`) + vite build green (`strict` + `noUnusedLocals` 위반 0).
- [ ] 기존 backend 불변: root 에서 `pnpm lint && pnpm build && pnpm test` 그대로 green + `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — backend jest 에만 적용, web 은 vitest 별도). 본 task 는 `web/` 만 건드리므로 backend 영향 0 이어야 함.
- [ ] R-110: production code(컴포넌트) 변경이 있으므로 tester 가 위 명령(`pnpm --filter web test` + root `pnpm lint && pnpm build && pnpm test`)을 실행·green 확인.
- [ ] R-114: push 후 PR CI 전 step green 확인 — approval-gate ordering fail 은 STATE.json `ci.benignRedNote` case A 절차(reviewer approve comment post 후 `gh run rerun <id> --failed`)로 처리.

## Out of Scope

- **`.github/workflows/ci.yml` 변경 일절 금지** — web vitest 의 CI 자동 실행 step 추가는 BLOCKED 상태인 T-0355 (slice 3, `workflow` scope credential 대기) 의 책임. 본 task 의 web test 는 로컬/PR-검토 단계에서 실행하되 CI step 추가는 하지 않는다(현 CI 가 무변경으로 green 이어야 함).
- 평가 실행 상태 **polling / `/api/*` 상태 endpoint 소비 / 전역 상태(context·store) 배선** — 후속 slice (ADR-0040 §6 의 polling 주기·endpoint 는 P5/P7 evaluation run 상태 자산 의존이라 별도). 본 task 는 props 만 받는 순수 컴포넌트.
- 로그인 화면 · 대시보드 · Admin 패널 등 다른 P6 UI bullet — 각 후속 task.
- `App.tsx` 에 배너 wiring(렌더 트리에 실제 삽입) — 상태 소스가 없는 현 단계에선 make-work. 컴포넌트만 정의하고 export 한다.
- 새 dependency 추가 (jsdom · @testing-library · 라우터 · 차트 · 상태관리 · CSS 프레임워크 등) — 전부 ADR-0040 §5 new-dep 게이트(별도 승인). 본 task 는 react/react-dom/vitest 만 사용.
- web vitest **coverage threshold 도입**(`@vitest/coverage-v8` 새 dev dep) — §5 게이트, BLOCKED T-0355 Follow-up.
- 배너의 정교한 스타일링(CSS) — 의미 구조(`role="alert"` + 텍스트)만. 시각 디자인은 후속 styling slice.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0040 이 stack·구조·R-78 frontend 책임을 결정 완료, 본 task 는 그 §6 의 배너 컴포넌트 1개 구현)

## Follow-ups

(생성 시 비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
