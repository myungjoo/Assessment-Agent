---
id: T-1849
title: AppShell run-status polling 배선 (5 초 주기 + 탭 비가시 중단)
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-083]
independentStream: run-status-web
dependsOn: [T-1848]
touchesFiles:
  - web/src/AppShell.tsx
  - web/src/AppShell.test.tsx
estimatedDiff: 285
estimatedFiles: 2
created: 2026-09-02
plannerNote: P6 PLAN 133 행 ④ / ADR-0060 §Follow-ups (e) 의 (e2) — (e1) helper 의 소비처 배선. base 190 × 1.5 = 285 로 cap 안, T-1838 실측 253 이 선례.
---

# T-1849 — AppShell run-status polling 배선 (5 초 주기 + 탭 비가시 중단)

## Why

[PLAN.md](../PLAN.md) `133 행` 오너 지시 (R-187~R-191) 의 잔여 ④ "R-78 평가 진행 배너 자동 polling" 을 닫는 chain 의 **마지막 코드 slice** 다. [ADR-0060](../decisions/ADR-0060-evaluation-run-status-endpoint.md) `§Follow-ups` chain 은 (a) → (b) → (d) → (e) → (f) 이고 backend 는 (a)(b)(c)(d) 로 완결됐으며 (e1) 조회 client 도 머지됐다 — 남은 것은 **그 client 를 실제로 부르는 소비처 배선** 하나다. 본 slice 가 머지되면 배너가 처음으로 실제 서버 상태를 따라 켜지고 꺼진다.

**issue-still-relevant pre-check 실측 (origin/main `50d86c37`)**:

- **(e1) 은 안착** — `git ls-tree -r origin/main` 에 `web/src/api/runStatus.ts` · `web/src/api/runStatus.test.ts` 존재 (`53add39e`, `+299/-0`). `fetchRunStatus()` · `isRunActive()` · `RUN_STATUS_PATH` 가 이미 export 돼 있으므로 본 slice 는 **helper 를 새로 만들지 않고 소비만** 한다.
- **(e2) 는 미착수** — `git grep -n "runStatus\|fetchRunStatus" origin/main -- web/src/AppShell.tsx` 매칭 **0**, `git grep -n "setInterval\|visibilityState" origin/main -- web/src/AppShell.tsx` 매칭 **0**, `origin/main:web/src/AppShell.tsx` `263 행` 은 여전히 `const [evaluationInProgress] = useState<boolean>(false);` 로 **setter 조차 없는 고정 false** 다.
- 즉 **부분 안착** 이며 (planner `§ Pre-check` step 5), 본 task 는 잔여 (e2) 축만 책임진다. 중복 큐잉 아님 — `docs/tasks/` 에 AppShell polling 을 다루는 PENDING/BLOCKED task 는 없다.
- 배너가 지금 조용한 것은 [ADR-0060](../decisions/ADR-0060-evaluation-run-status-endpoint.md) `§Consequences (a)` 가 미리 박제한 대로 **소비처 미배선** 탓이지 "평가가 안 돌고 있음" 이 아니다.

**크기 판정 ([CLAUDE.md](../../CLAUDE.md) `§3`)**: base 직관은 `AppShell.tsx` 약 75 LOC (판정 helper 14 + 주기 상수 4 + state/주입점 10 + effect 42 + 헤더 주석 5) + `AppShell.test.tsx` 약 115 LOC = **약 190 LOC / 2 파일**. estimate-model 의 R-112 backbone 카테고리 × 1.5 = **285 LOC** 로 300 cap 안이라 **split 불요 · `sizeExempt` 불요**. 동형 선례인 [T-1838](T-1838-web-session-restore-hydration.md) (AppShell effect + 순수 helper + drift-guard spec) 실측이 `+253/-1` / 3 파일이라 이 대역이 실증된다. **소비처 동반 의무는 본 slice 자체가 충족** 한다 — helper 신설이 아니라 (e1) helper 의 호출자 배선이 본 slice 의 전부다.

**cap 여유 15 LOC 의 압박 대응**: spec 은 [T-1838](T-1838-web-session-restore-hydration.md) 선례대로 **순수 helper 단위 test + 소스 drift-guard + 정적 렌더** 3 종으로만 구성하고 (web 에 `@testing-library/react` · jsdom 이 없다 — [ADR-0040](../decisions/ADR-0040-frontend-stack.md) `§5` 새-dep 게이트) 무관한 리팩터를 0 으로 둔다. 그럼에도 300 LOC 초과가 확실해지면 **자를 수 있는 축은 탭 비가시 중단 (§Decision 5 두 번째 항목) 하나뿐** 이며, 그때는 아래 `Follow-ups` 에 (e2b) 로 파일·행 좌표까지 박제하고 분리한다. 주기 조회 · 미인증 게이트 · unmount 정리 · 실패 흡수 소비는 **자를 수 없다** (그 넷이 빠지면 배너가 켜지지 않거나 누수가 남아 slice 의 기능이 성립하지 않는다).

## Required Reading

- [docs/decisions/ADR-0060-evaluation-run-status-endpoint.md](../decisions/ADR-0060-evaluation-run-status-endpoint.md) `160~183 행` `§Decision 5` (권장 간격 5 초 근거 · 탭 비가시 중단 · 다중 인스턴스 false-negative) + `281~287 행` `§Follow-ups (e)`
- [web/src/api/runStatus.ts](../../web/src/api/runStatus.ts) — 소비할 계약. `RUN_STATUS_PATH` · `isRunActive()` · `fetchRunStatus(): Promise<boolean>` (**절대 reject 하지 않음** — 파일 헤더 주석의 흡수 사유)
- [web/src/AppShell.tsx](../../web/src/AppShell.tsx) `82~86 행` (`isAuthedView` — view 문자열의 단일 근거) · `111~119 행` (`shouldLoadCurrentUser` — 순수 helper + effect 게이트 관례) · `260~263 행` (배선 대상 state) · `337~353 행` (등급 적재 effect 의 `cancelled` 패턴) · `417~418 행` (배너 슬롯)
- [web/src/AppShell.test.tsx](../../web/src/AppShell.test.tsx) `936~991 행` — 동형 선례 (T-1838): 순수 helper 단위 test + **소스 drift-guard** + 정적 렌더 negative 로 effect 를 검증하는 방식
- [web/src/components/EvaluationGuardBanner.tsx](../../web/src/components/EvaluationGuardBanner.tsx) — `active` prop 계약 (수정 대상 아님, 읽기만)

## Acceptance Criteria

- [ ] `web/src/AppShell.tsx` 에 **polling 주기 상수** 를 named export 한다 (예: `RUN_STATUS_POLL_INTERVAL_MS = 5000`). `setInterval` 인자에 숫자 리터럴을 직접 적지 않는다 — 근거는 [ADR-0060](../decisions/ADR-0060-evaluation-run-status-endpoint.md) `§Decision 5` 이며 그 참조를 주석에 박제한다.
- [ ] **순수 판정 helper** 를 named export 한다 (예: `shouldPollRunStatus(view: View, documentHidden: boolean): boolean`). 인증 후 view 이고 문서가 가시일 때만 `true`. view 판정 근거는 기존 `isAuthedView` **하나** 이며 view 문자열 (`'dashboard'` 등) 을 helper 안에 다시 하드코딩하지 않는다 ([shouldShowLogout](../../web/src/AppShell.tsx) `126 행` 선례). 타입을 우회한 런타임 입력에도 **throw 0**.
- [ ] `263 행` 의 `const [evaluationInProgress] = useState<boolean>(false)` 를 **setter 보유 state** 로 바꾸고, 정적 렌더 검증을 위한 주입점 `initialEvaluationInProgress?: boolean` (기본 `false`) 을 `AppShellProps` 에 추가한다 (`initialView` · `initialCurrentUser` 선례와 동형 — renderToStaticMarkup 은 effect 를 실행하지 않는다).
- [ ] **polling effect** 를 배선한다.
  - [ ] 미인증 view 에서는 조회하지 않고 `evaluationInProgress` 를 `false` 로 되돌린다 — 로그아웃 후 배너가 켜진 채 남지 않게 한다 (동일 값 setState 는 React 가 bailout 하므로 루프가 생기지 않음을 주석에 박제).
  - [ ] 인증 후 view 진입 시 **즉시 1 회** 조회하고, 이후 `RUN_STATUS_POLL_INTERVAL_MS` 주기로 `fetchRunStatus()` 를 부른다. 매 tick 은 판정 helper 로 게이트한다.
  - [ ] `document` 의 `visibilitychange` 를 구독해 **비가시 중 조회를 멈추고 가시화 시 즉시 1 회** 조회한다 ([ADR-0060](../decisions/ADR-0060-evaluation-run-status-endpoint.md) `§Decision 5`).
  - [ ] cleanup 에서 `clearInterval` + `removeEventListener` 를 모두 수행하고, `cancelled` 플래그로 언마운트 이후의 늦은 `setState` 를 막는다 (`337~353 행` 패턴 승계).
  - [ ] 조회 결과 boolean 을 그대로 `evaluationInProgress` 에 대입한다. **AppShell 안에 별도 `try/catch` · 에러 배너 · 재시도 로직을 두지 않는다** — 실패 흡수는 `fetchRunStatus()` 의 계약이고 여기서 다시 구현하면 규칙이 두 곳으로 갈라진다.
  - [ ] 새 외부 dependency 0 ([ADR-0040](../decisions/ADR-0040-frontend-stack.md) `§5` 게이트) · 새 credential 0.
- [ ] `418 행` `<EvaluationGuardBanner active={evaluationInProgress} />` 는 **그대로 둔다** (컴포넌트 파일 수정 0).
- [ ] colocated spec `web/src/AppShell.test.tsx` 에 describe 2 개를 추가한다. R-112 4 항목을 모두 cover 한다.
  - [ ] **happy-path** — ① 판정 helper 가 인증 후 view + 가시 문서에 `true` ② `initialEvaluationInProgress` 를 `true` 로 준 정적 렌더에 R-78 배너 토큰이 실제로 나타난다 (각 1+ test).
  - [ ] **error path** — 조회 실패는 `fetchRunStatus()` 가 `false` 로 흡수하므로 그 결과 배너가 **켜지지 않음** 을 정적 렌더로 고정하고, 소스 drift-guard 로 AppShell 이 자체 catch · 에러 문구 · 재시도를 만들지 않음을 확인 (각 1+ test).
  - [ ] **분기 cover** — 판정 helper 의 분기마다 test: 인증 후 view + 가시 (`true`) / 인증 후 view + 비가시 (`false`) / 미인증 view `'login'` (`false`) / `'superadmin-setup'` (`false`).
  - [ ] **negative cases 충분 cover** — 최소 6 종: 타입 우회 빈 문자열 view · `undefined` view · 비가시 상태의 인증 후 view · 미인증 view 에서 배너 미렌더 · `initialEvaluationInProgress` 기본값 (`false`) 에서 배너 미렌더 · 미인증 진입 정적 렌더의 무회귀 (인증 후 내비 · 로그아웃 부재). 각 케이스가 **throw 0** 임을 함께 확인한다.
  - [ ] **drift guard (effect 는 정적 렌더로 발화되지 않음)** — `readFileSync` 로 `AppShell.tsx` 소스를 읽어 다음을 고정: `fetchRunStatus` import · 주기 상수 선언과 `setInterval` 이 그 상수를 사용 · `clearInterval` · `addEventListener('visibilitychange'` 와 대응하는 `removeEventListener` · `setEvaluationInProgress(` 호출 · `cancelled = true` · 판정 helper 가 effect 안에서 실제로 게이트로 쓰임. 숫자 리터럴 `5000` 이 `setInterval` 호출부에 직접 박히지 않았음도 negative 로 고정한다.
- [ ] `pnpm lint && pnpm build` 통과. 저장소 unit test (`pnpm test`) green.
- [ ] `pnpm test:cov` 통과 — 전역 임계 line ≥ 80% / function ≥ 80% 유지.
- [ ] `web/` 에서 `pnpm test` (vitest) 로 신규 spec 이 green 임을 확인하고 결과를 trail 에 남긴다.

## Out of Scope

- **`web/src/components/EvaluationGuardBanner.tsx` 수정 0** — [ADR-0060](../decisions/ADR-0060-evaluation-run-status-endpoint.md) `§Follow-ups (e)` 가 "컴포넌트 파일 수정 0" 을 명시했다. 기존 `active` prop 계약을 그대로 소비한다.
- **`web/src/api/runStatus.ts` 수정 0** — (e1) 에서 확정된 계약이다. 여기에 타이머 · 재시도 · 캐시를 넣지 않는다 (타이머 소유는 컴포넌트 lifecycle 책임이라는 분할 경계).
- **backend 수정 0** — `src/run-status/*` · `test/e2e/*` · `prisma/schema.prisma` 무변경. schema 승격이 필요하다고 판단되면 즉시 중단하고 `BLOCKED` → notifier ([CLAUDE.md](../../CLAUDE.md) `§5`, [ADR-0060](../decisions/ADR-0060-evaluation-run-status-endpoint.md) `§Consequences (e)`).
- **새 dependency 0** — `@testing-library/react` · jsdom · fake timer 라이브러리를 도입하지 않는다 ([ADR-0040](../decisions/ADR-0040-frontend-stack.md) `§5` 게이트). effect 검증은 T-1838 의 drift-guard 방식으로 한다. 도입이 필요하다고 판단되면 `BLOCKED` → notifier.
- **doc-sync 0** — [api.md](../architecture/api.md) 표 행 추가, [frontend-api-contract.md](../architecture/frontend-api-contract.md) `87 행` gap 갱신, [requirements.md](../requirements.md) `102 행` REQ-083 재판정은 (f) slice 소관이다 ([CLAUDE.md](../../CLAUDE.md) `§3.1` 규칙 6 — 재판정은 구현 머지 후 1 회).
- **[PLAN.md](../PLAN.md) `133 행` 마커 변경 0** — 잔여 ① 전역 CSS 가 남아 `[ ]` 를 유지한다.
- **polling 주기의 설정화 0** — env · 설정 UI · 사용자별 조정은 요구가 아니다. 상수 1 개로 둔다.
- **AppShell 의 다른 effect · 핸들러 리팩터 0** — 세션 복원 · 등급 적재 · 로그아웃 배선은 손대지 않는다 (cap 여유 15 LOC).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- **(f) doc-sync + REQ-083 재판정** — 본 slice 머지 후 1 회. [api.md](../architecture/api.md) 표에 `GET /api/run-status` 행 추가, [frontend-api-contract.md](../architecture/frontend-api-contract.md) `87 행` gap 을 shipped 로 갱신 + `107 행` 목록에서 1 번 항목 제거, [requirements.md](../requirements.md) `102 행` REQ-083 status 를 (a)~(e) 실측에 맞춰 재판정. 코드 변경 0 이므로 `commitMode: direct`.
- **(e2b) 탭 비가시 중단 분리 — cap 초과가 실제로 확인된 경우에만** — 본 slice 가 300 LOC 를 넘길 것이 구현 중 확실해지면 가시성 축만 떼어낸다: `web/src/AppShell.tsx` 의 polling effect 에서 `document.addEventListener('visibilitychange', ...)` 구독 · 대응 `removeEventListener` · 판정 helper 의 `documentHidden` 인자, `web/src/AppShell.test.tsx` 의 가시성 분기 test 와 drift-guard 중 `visibilitychange` 단언이 그 범위다. 분리 시 본 slice 의 helper 시그니처는 `shouldPollRunStatus(view)` 로 두고 (e2b) 가 인자를 추가한다.

## Result (2026-09-02)

`DONE` — `pr` mode, PR [#1454](https://github.com/myungjoo/Assessment-Agent/pull/1454) → main `58ce46f3`. `web/src/AppShell.tsx` `+78/-5` + `web/src/AppShell.test.tsx` `+132/-0` = `+205/-5` 2 파일 (사전 `estimatedDiff` 285 대비 실측 210 — 하회). T-1848 의 `fetchRunStatus()` 를 실제로 호출하는 **소비처 배선**이라 이 slice 로 ADR-0060 `§Follow-ups (e)` 가 닫혔다. 주기 상수 `RUN_STATUS_POLL_INTERVAL_MS` named export + 순수 판정 helper `shouldPollRunStatus(view, documentHidden)` 를 분리해 effect 본문이 조건을 재구현하지 않게 했고, effect 는 즉시 1 회 조회 → interval → `visibilitychange` 구독 → cleanup(`clearInterval` + `cancelled` 플래그) 순으로 배선했다. `EvaluationGuardBanner` · `runStatus.ts` · backend 전부 무변경 (`418 행` 배너 prop 은 기존 계약 그대로). R-112 4 종 = happy / error path / 분기 / negative 8 종 + effect 의존성 drift guard 3 = **12 test 추가**. web vitest 105 green, 저장소 jest 13495 green, 전역 line 99.94% · function 100% 로 임계(80/80) 유지. reviewer round 1 MINOR nit 1 건(effect 의존성 drift guard)은 follow-up 으로 넘기지 않고 `§3` Nit-in-PR closure 대로 round 2 에서 닫아 APPROVE, 4-게이트 PASS 후 squash + branch delete. 본 slice 는 `§7.5` multi-task chain 의 두 번째 task 로 처리돼 commit body 에 `FIRE-BATCH: T-1848+T-1849` marker 가 박혔다. 잔여 (f) doc-sync + REQ-083 재판정은 미착수.
