---
id: T-0378
title: P6 composition wiring ① AppShell 레이아웃 골격 + view enum 상태 + R-78 배너 슬롯
phase: P6
status: DONE
completedAt: 2026-06-13T14:10:00Z
mergedAs: 200f670
prNumber: 309
reviewRounds: 1
commitMode: pr
coversReq: [REQ-038, REQ-042]
estimatedDiff: 165
estimatedFiles: 4
created: 2026-06-13
independentStream: p6-frontend-composition
dependsOn: []
touchesFiles: [web/src/AppShell.tsx, web/src/AppShell.test.tsx, web/src/App.tsx, web/src/App.test.tsx]
plannerNote: "P6 wiring①; ADR-0041 Decision1·4·5; AppShell 골격+view enum+R-78 배너 슬롯; R-112 backbone×1.5≈165 LOC"
sizeExempt: false
---

# T-0378 — P6 composition wiring ① AppShell 레이아웃 골격 + view enum 상태 + R-78 배너 슬롯

## Why

ADR-0041 (composition-wiring 전환, ACCEPTED) 의 Consequences §중립 wiring chain ① — 15 개 presentational 컴포넌트를 실 화면으로 조립하는 첫 slice 다. 본 task 는 ADR-0041 Decision 1 (AppShell → 인증 게이트 → 화면 컨테이너 위계 중 **최상위 AppShell 골격**), Decision 2 (무라우터 view enum 상태), Decision 4 (R-78 배너 슬롯) 을 cover 한다. 현재 `web/src/App.tsx` 는 분기 0 정적 placeholder (T-0353) 라 PLAN P6 의 "시각화 대시보드 / Admin / R-78 보호" bullet 으로 진행하려면 전역 레이아웃 + view 전환 골격이 먼저 필요하다 (README REQ-038 시각화 UI / REQ-042·R-78 평가 진행 중 보호).

본 slice 는 **골격만** — 실 인증 분기 · LoginForm 배선 · fetch hook · 화면 컨테이너 조립은 후속 wiring ②~⑤ 의 책임이다 (Out of Scope). AppShell 은 view enum 상태를 보유하고, R-78 배너 슬롯에 `EvaluationGuardBanner` 를 props 배선만 한다 (컴포넌트 수정 0).

## Required Reading

- `docs/decisions/ADR-0041-frontend-composition-wiring.md` — Decision 1 (controlled lift-up 위계) / Decision 2 (무라우터 view enum) / Decision 4 (R-78 배너 슬롯) / Decision 5 (single-claim 순차 stream)
- `docs/decisions/ADR-0040-frontend-stack.md` §5 (new-dep 게이트 — jsdom/@testing-library/router/fetch 라이브러리 도입 금지, react/react-dom 만) / §6 (R-78 frontend 책임)
- `web/src/App.tsx` — 교체 대상 placeholder (현 정적 구조)
- `web/src/App.test.tsx` — 갱신할 기존 spec (vitest + react-dom/server renderToStaticMarkup 패턴, jsdom 미사용)
- `web/src/components/EvaluationGuardBanner.tsx` — R-78 배너 슬롯에 배선할 presentational (props: `active: boolean`, `message?: string`; active=false 면 null 반환)
- `web/src/components/EvaluationGuardBanner.test.tsx` — colocated test 작성 패턴 참고 (.test.tsx 확장자 고정 — root jest testRegex `.*\.spec\.ts$` pickup 충돌 회피)

## Acceptance Criteria

- [ ] `web/src/AppShell.tsx` 신설 — 전역 레이아웃 컴포넌트. 다음을 포함:
  - [ ] view enum 타입 정의 (예 `type View = 'login' | 'dashboard' | 'admin' | 'superadmin-setup'`) 와 `useState<View>` 기반 현재 view 상태 보유 (초기값 `'login'`).
  - [ ] 전역 레이아웃 골격 (예 `<div>` 헤더 영역 + 본문 영역). 본문 영역은 현재 view 를 식별 가능한 최소 텍스트/마크업으로 조건부 렌더 (실 화면 컨테이너는 후속 slice — 본 slice 는 view 별 placeholder 텍스트로 충분).
  - [ ] R-78 배너 슬롯 — `evaluationInProgress: boolean` 상태 (초기값 `false`) 를 보유하고 이를 `EvaluationGuardBanner` 의 `active` prop 으로 내려보냄. 배너는 레이아웃 최상단 (헤더 위/안) 에 배치.
- [ ] `web/src/App.tsx` 갱신 — placeholder 마크업 제거하고 `<AppShell />` 를 렌더하는 thin wrapper 로 교체.
- [ ] 새 dependency 0 — `react`/`react-dom` 만 사용 (jsdom · @testing-library · react-router · axios · react-query 등 import/추가 금지, ADR-0040 §5). 추가 시 BLOCKED.
- [ ] `web/src/AppShell.test.tsx` 신설 (vitest + `react-dom/server` renderToStaticMarkup, jsdom 미사용 — 기존 web test 패턴 동일). `.test.tsx` 확장자 고정. R-112 4 종:
  - [ ] happy-path: AppShell 렌더 결과가 빈 문자열이 아니고 레이아웃 골격 (헤더/식별 토큰) 을 포함.
  - [ ] error/negative path: 초기 `evaluationInProgress=false` 상태에서 R-78 배너 문구 (`평가가 진행 중`) 가 렌더되지 않음 (배너 슬롯이 active=false 를 내려 null 반환).
  - [ ] flow/branch: view enum 별 분기 — 초기 view (`login`) 에서 다른 view 의 placeholder 텍스트가 렌더되지 않음 (조건부 렌더 분기 cover). 상태 변경 헬퍼/핸들러가 노출되면 view 전환 후 해당 view 렌더 검증 1+ (handler 미노출 시 본 항목은 "초기 view 분기만 검증" 으로 명시하고 후속 slice 로 위임).
  - [ ] negative cases 충분 cover: 미구현 view 화면 문구 미렌더 1+ / 빈 출력 회귀 방지 1+ / R-78 배너 비활성 1+ — 예외 상황 분기마다 각 1+.
- [ ] `web/src/App.test.tsx` 갱신 — App 이 AppShell 을 렌더함을 검증 (AppShell 의 식별 토큰 포함). 기존 placeholder 문구 단언 (제거된 "P6 frontend scaffold") 은 갱신/제거.
- [ ] `pnpm --dir web test` (vitest) 통과 — AppShell.test.tsx + App.test.tsx + 기존 컴포넌트 test 전부 green.
- [ ] `pnpm --dir web build` (tsc + vite build) 통과 — 타입 에러 0.
- [ ] root `pnpm lint && pnpm build` 통과 (web 변경이 root NestJS 빌드/lint 를 깨지 않음 확인).
- [ ] coverage: web vitest 의 본 task 신규 파일 (AppShell.tsx) line ≥ 80% AND function ≥ 80% 충족. (web vitest 는 root jest `coverageThreshold` 와 별개 — `pnpm --dir web test` 의 coverage 리포트로 확인. ci.yml 미배선은 T-0355 Follow-up 의 기존 tracked gap.)

## Out of Scope

- 실 인증 게이트 분기 (미인증/인증 판정 + LoginForm 배선) — wiring ② 책임.
- 401→refresh→retry fetch hook / native `fetch` 래퍼 / `/api/*` 호출 — wiring ② 이후 책임.
- 대시보드 · Admin · SuperAdmin 셋업 화면 컨테이너 실 조립 (presentational 컴포넌트 props 배선) — wiring ③~④ 책임. 본 slice 는 view 별 placeholder 텍스트만.
- R-78 `evaluationInProgress` 의 실 polling / 평가 실행 상태 endpoint 소비 — wiring ⑤ 책임 (본 slice 는 상태를 `false` 고정 보유 + 배너 슬롯 배선만).
- react-router · @tanstack/react-query · axios · jsdom · @testing-library 등 새 dependency 도입 (ADR-0041 Decision 2·3 deferred — §5-gated, 사용자 승인 필요).
- EvaluationGuardBanner 등 기존 presentational 컴포넌트 수정 (controlled lift-up — props 배선만, 컴포넌트 수정 0).
- 전역 CSS/스타일링 프레임워크 도입.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 없음 — sub-agent 가 관련 작업 발견 시 추가)
