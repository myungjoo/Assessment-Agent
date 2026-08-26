---
id: T-1717
title: 인증 후 대시보드↔관리 화면 전환 내비게이션 박제 (REQ-070 slice 1)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-070]
estimatedDiff: 140
estimatedFiles: 2
created: 2026-08-26
independentStream: evaluation-target-ui
dependsOn: []
touchesFiles:
  - web/src/AppShell.tsx
  - web/src/AppShell.test.tsx
plannerNote: P6 오너 지시(PLAN 130 행 🔴) 분해 slice 1 — view==='admin' 분기가 도달 불가라 로그인 직후 빈 상태에서 막히는 지점 해소.
---

# T-1717 — 인증 후 대시보드↔관리 화면 전환 내비게이션 박제 (REQ-070 slice 1)

## Why

오너 최우선 지시 [PLAN](../PLAN.md) `130 행` 🔴(평가 대상 추가·편집 인터페이스, REQ-070~REQ-073)의 분해 slice 1 이다. 오너가 지목한 증상은 "로그인 직후 **평가 대상을 선택하면 결과가 표시됩니다** 빈 상태에서 막힌다" 인데, planner 실측 결과 그 원인의 첫 마디가 **화면 전환 동선의 부재**다 — [AppShell.tsx](../../web/src/AppShell.tsx) `180 행` 의 `view === 'admin'` 분기는 존재하지만 인증 후 `setView('admin')` 를 호출하는 컨트롤이 **코드베이스 어디에도 없어**(`setView` 호출처는 `108 행` 인증 성공 → `'dashboard'`, `115 행` 셋업 진입, `134 행` 셋업 완료 → `'login'` 셋뿐) AdminView 는 **도달 불가한 dead branch** 다. 즉 인원·그룹·파트 CRUD 패널 10 종이 이미 AdminView 에 마운트돼 있어도(PLAN `123 행`) 사용자는 그 화면에 갈 수 없다.

본 slice 는 새 backend 계약·새 패널·새 dependency 0 으로 **인증 후 view 전환 내비게이션만** 박제해 그 dead branch 를 살린다(REQ-070 의 "빈 상태에서 막히지 않도록" 최소 필요조건). 인원 축 편집(REQ-071)·시스템 축 등록(REQ-072)·RBAC 노출 차등(REQ-073)은 후속 slice.

## Required Reading

- [web/src/AppShell.tsx](../../web/src/AppShell.tsx) — 특히 `30 행` `type View`, `32~34 행` `DEFAULT_AUTHED_VIEW`, `91 행` `useState<View>`, `106~116 행` 전환 핸들러, `147~195 행` render 트리(`AuthGate` children 의 view 분기 `178~182 행`, `188~194 행` `초기 셋업` 트리거 버튼 — 조건부 노출 선례).
- [web/src/AppShell.test.tsx](../../web/src/AppShell.test.tsx) — `24~114 행` `describe('AppShell')` 의 정적 렌더 test 관례(`renderToStaticMarkup` + 문자열 대조), 특히 `47 행` "인증 후 view placeholder 를 렌더하지 않는다" negative test 와 `86 행` login↔setup 상호배타 test.
- [web/src/AuthGate.tsx](../../web/src/AuthGate.tsx) — `children` 이 **인증 상태에서만** 렌더된다는 계약(내비게이션을 children 안에 두면 미인증 노출이 구조적으로 0 이 되는 근거) + `initialAuthenticated` 주입 패턴.
- [docs/requirements.md](../requirements.md) `89 행` REQ-070 (빈 상태에서 막히지 않도록 평가 대상 추가·편집 인터페이스 제공), `92 행` REQ-073 (편집은 Admin, User 는 조회 — 본 slice 의 Out of Scope 근거).
- [docs/decisions/ADR-0041-frontend-composition-wiring.md](../decisions/ADR-0041-frontend-composition-wiring.md) — `Decision 1` controlled lift-up(상태는 컨테이너 소유, presentational 수정 0) + `Decision 2` **무라우터 view 전환**(새 라우터 dependency 금지).

## Acceptance Criteria

- [ ] [AppShell.tsx](../../web/src/AppShell.tsx) 에 **인증 후에만** 렌더되는 view 전환 내비게이션을 박제한다 — `AuthGate` children 안, view 분기(`178 행`)보다 위에 두어 미인증 단계에서는 구조적으로 렌더되지 않게 한다. 항목은 `대시보드`(→ `'dashboard'`) · `관리`(→ `'admin'`) 2 개이고, 각 버튼 `onClick` 이 `setView(<대상 view>)` 를 호출한다. 새 dependency · 새 라우터 0 (ADR-0041 `Decision 2` 무라우터 전환 유지).
- [ ] 내비게이션 항목 목록을 **named export 한 상수** `AUTHED_NAV_ITEMS: ReadonlyArray<{ view: View; label: string }>` 로 두고, 현재 view 표식 판정을 **named export 한 순수 함수** `isNavItemActive(current: View, item: View): boolean` 로 분리한다 — web 에 `@testing-library/react` 가 없어(ADR-0040 §5 새-dep 게이트) 클릭 상호작용 test 가 불가하므로, 판정 규칙만은 단위로 검증 가능해야 한다([AppShell.tsx](../../web/src/AppShell.tsx) `59 행` `buildSetupErrorMessage` 선례와 동형). 두 심볼 모두 어떤 입력에도 throw 하지 않는다.
- [ ] 현재 view 인 항목은 `aria-current="page"` 로 표시하고, 내비게이션 컨테이너는 `<nav>` + 안정 식별 토큰(예: `className="app-shell-nav"`)을 갖는다(정적 렌더 test 가 대조할 앵커).
- [ ] happy-path unit test 1+ — `renderToStaticMarkup(<AppShell initialView="dashboard" />)` 결과에 `app-shell-nav` 토큰과 `대시보드` · `관리` 두 라벨이 모두 존재한다.
- [ ] error path unit test 1+ — `isNavItemActive` 에 `View` 가 아닌 값(예: `'' as View`, `undefined as unknown as View`)을 넘겨도 throw 없이 `false` 를 반환한다.
- [ ] 분기 cover — 각 분기 1+ test: ① `initialView="dashboard"` → 대시보드 항목이 `aria-current="page"` ② `initialView="admin"` → **관리** 항목이 `aria-current="page"` 이고 대시보드 항목은 아니다 ③ `isNavItemActive` 동일 view → `true` ④ 상이 view → `false`.
- [ ] negative cases 충분 cover(각 1+ test) — ① `initialView="login"` 렌더 결과에 `app-shell-nav` 토큰이 **부재**한다(미인증 노출 0) ② `initialView="superadmin-setup"` 렌더 결과에도 부재한다(셋업 단계 노출 0) ③ 한 렌더 결과에 `aria-current="page"` 가 **2 개 이상 등장하지 않는다**(활성 표식 중복 금지) ④ `AUTHED_NAV_ITEMS` 에 `'login'` · `'superadmin-setup'` 같은 미인증 view 가 섞여 있지 않다(항목 목록 오염 방지) ⑤ 내비게이션 추가로 `initialView="admin"` 렌더에 LoginForm(로그인 버튼)·셋업 폼 제목이 새로 섞이지 않는다.
- [ ] drift guard 1+ — `readFileSync('web/src/AppShell.tsx')` 소스 문자열에서 `관리` 항목의 클릭 경로가 실제로 `setView('admin')` 로 배선됐는지 대조한다(상호작용 렌더 test 불가에 대한 선례 보완 — [AdminView.userlist-wiring.test.tsx](../../web/src/views/AdminView.userlist-wiring.test.tsx) 방식).
- [ ] 기존 [AppShell.test.tsx](../../web/src/AppShell.test.tsx) `26~114 행` it 들이 **무수정으로 통과**한다(특히 `47 행` negative — 미인증 렌더에 인증 후 화면 토큰이 없어야 한다는 단언이 그대로 green).
- [ ] `pnpm --dir web test` green, `pnpm --dir web build` green.
- [ ] `src/` · `test/` · `.github/workflows/` · `package.json` diff **0 파일** — backend jest coverage(line ≥ 80% / function ≥ 80%)는 무영향이며 `pnpm test:cov` 재실행 불요임을 PR 본문에 명시한다.

## Out of Scope

- **RBAC 기반 내비게이션 노출 차등**(REQ-073) — AppShell 은 현재 로그인 사용자의 role 을 보유하지 않는다(`AuthGate.onAuthenticated` 가 role 을 전달하지 않음). role 전파 경로 신설은 별도 slice. 본 slice 는 두 항목을 무조건 노출하고, AdminView 안의 기존 RBAC gating 에 의존한다.
- **DashboardView 빈 상태 문구 변경** — `NO_PERSON_TEXT`([DashboardView.tsx](../../web/src/views/DashboardView.tsx) `49 행`) 및 그 문구를 대조하는 test 6 곳은 **무수정**. 빈 상태 안내에 동선을 덧붙이는 것은 별도 slice.
- **평가 대상 시스템(GitHub org/repo · Confluence SPACE) 등록 모델·API·UI**(REQ-072) — backend 계약 부재 + ADR 동반 대상이라 본 slice 진입 금지.
- **AdminView 패널 구성·순서 변경**, 새 패널 추가, `AdminView.tsx` 수정 일체.
- 새 라우터 · 새 CSS 프레임워크 · 새 dependency 도입(§5 새-dep 게이트).
- `docs/` 문서 갱신(PLAN `130 행` 체크박스 · requirements.md `PLANNED` → 상태 전이) — direct-mode 별도 task 소관(§3.1 mixed 금지).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 추가한다.)
