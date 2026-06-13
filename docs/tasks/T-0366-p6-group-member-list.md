---
id: T-0366
title: P6 frontend UI slice 6 — 그룹 인원 목록 presentational 컴포넌트 (web/src/components/GroupMemberList.tsx)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-046, REQ-047]
estimatedDiff: 150
estimatedFiles: 2
created: 2026-06-13
independentStream: p6-frontend-ui
dependsOn: []
touchesFiles:
  - web/src/components/GroupMemberList.tsx
  - web/src/components/GroupMemberList.test.tsx
plannerNote: P6 bullet3(Admin 패널 인원·그룹) 분해 — slice 6, 그룹 멤버 목록 순수 presentational, T-0361~T-0365 와 file-disjoint·새 dep 0·ci.yml 무관.
---

# T-0366 — P6 frontend UI slice 6: 그룹 인원 목록 presentational 컴포넌트

## Why

PLAN [Phase P6](../PLAN.md) bullet3 "Admin 패널 (인원·그룹·재평가·import/export·스케줄)" 의 첫 building block 으로, **한 그룹에 속한 인원(멤버) 목록을 표시하는 presentational 컴포넌트**를 박제한다. 직전 P6 slice (T-0361 EvaluationGuardBanner / T-0362 LoginForm / T-0363 EvaluationResultTable / T-0364 DifficultyModelSelector / T-0365 SuperAdminSetupForm) 와 동일하게 props 로만 데이터·콜백·loading/error 를 받는 순수 controlled component 로 시작하며, 실제 fetch·전역 상태·라우팅·App.tsx 배선은 후속 slice 책임이다. backend 의 그룹/멤버 API 는 이미 완결되어 있어, 본 task 는 그 위에 올라가는 데이터 의존성 0 의 순수 presentational UI slice 다.

## Required Reading

- `web/src/components/EvaluationResultTable.tsx` — loading/empty/populated 3분기 + 빈 상태 메시지 fallback + 테이블 렌더 + named/default export convention 의 직전 선례. 본 task 의 멤버 목록 분기 구조는 이 패턴을 그대로 차용한다.
- `web/src/components/EvaluationResultTable.test.tsx` — `react-dom/server` 의 `renderToStaticMarkup(<...>)` 으로 **jsdom 없이** 정적 markup 문자열만 검증하는 vitest 패턴 (dep 표면 최소화). 파일명 `.test.tsx` 고정 (root jest `testRegex .*\.spec\.ts$` pickup 충돌 회피).
- `web/src/components/DifficultyModelSelector.tsx` — `role="status"` 로딩 표시 + `role="alert"` 에러 영역 + loading 우선 정책 convention. 본 task 의 loading/error 표시도 동일 접근성 구조를 따른다.
- `docs/decisions/ADR-0040-frontend-stack.md` — §1 (React + Vite + TS), §5 (dep 게이트: react / react-dom / vitest 만 — 그 외 import 금지).
- `web/tsconfig.json` — `jsx: react-jsx`, `strict: true`, `noUnusedLocals/Parameters` (lint-tight 컴파일).
- `web/package.json` — 사용 가능한 dep (react / react-dom / vitest 만).

## Acceptance Criteria

- [ ] `web/src/components/GroupMemberList.tsx` 신설. props 만 받는 순수 presentational controlled 컴포넌트. 최소 인터페이스 (구현이 동등 의미로 조정 가능):
  - 멤버 옵션 타입: `{ id: string; name: string; role?: string }` (secret 필드 없음 — backend sanitize view 정합).
  - props: `{ members: Member[]; loading?: boolean; error?: string; emptyMessage?: string; onRemove?: (memberId: string) => void }`.
  - **분기 동작 (R-112 cover 대상)**:
    - `loading === true` 면 `role="status"` 영역에 로딩 표시 ("불러오는 중…") 를 렌더하고 목록·빈상태는 렌더하지 않는다 (loading 우선 정책).
    - `loading` 이 아니고 `error` 가 truthy 면 `role="alert"` 영역에 error 문구를 렌더한다.
    - `loading` 이 아니고 error 없고 `members` 가 빈 배열이면 빈 상태 메시지 (`emptyMessage` 또는 기본 "표시할 인원이 없습니다") 를 렌더하고 목록은 렌더하지 않는다.
    - `loading` 이 아니고 error 없고 `members` 가 1개 이상이면 각 멤버를 `<li>`(또는 테이블 행) 로 렌더하고 각 멤버의 `name` 과 `role`(있으면) 을 표시한다.
    - `onRemove` 가 전달되면 각 멤버 행에 제거 버튼을 렌더하고 클릭 시 `onRemove(member.id)` 호출. `onRemove` 미전달 시 제거 버튼은 렌더하지 않는다.
  - named export(props 타입)와 default export(컴포넌트)를 직전 컴포넌트와 동일 convention 으로 제공한다. 새 dependency import 금지 (react 만). fetch·라우팅·외부 store 사용 금지 — 데이터는 props 로만 받는다.
- [ ] `web/src/components/GroupMemberList.test.tsx` 신설 — colocated spec. `vitest` + `react-dom/server` 의 `renderToStaticMarkup` 으로 정적 markup 만 검증 (새 dep 0). 파일명은 `.test.tsx` 고정.
- [ ] **Happy-path test 1+**: members 2~3개 전달 시 각 멤버의 `name`(및 `role`) 이 목록 항목으로 렌더됨을 검증.
- [ ] **Error path test 1+**: `error` truthy 전달 시 `role="alert"` 영역에 문구가 렌더되고 목록은 렌더되지 않음을 검증.
- [ ] **Flow/branch test (각 분기 1+)**: loading 분기(`loading=true` → `role="status"` 렌더·목록/빈상태 미렌더), 빈 배열 분기(빈 상태 메시지 렌더·목록 미렌더), populated 분기(멤버 항목 렌더), `onRemove` 전달/미전달 분기(제거 버튼 렌더 유무) 각각 1+ test.
- [ ] **Negative cases 충분 cover (각 1+)**: `loading=true` 가 error·members 보다 우선 (loading 우선 정책 — members 채워져 있어도 목록 미렌더) 1+; `error` 와 `members` 동시 전달 시 error 우선·목록 미렌더 1+; `emptyMessage` 미전달 시 기본 빈 상태 문구 fallback 1+; `role` 미포함 멤버도 렌더 throw 없이 name 만 표시 1+; 빈 문자열 `error`(falsy → alert 미렌더 경계값) 1+.
- [ ] `cd web && pnpm test` 통과 (web vitest 전부 green) — 신규 spec 포함.
- [ ] `cd web && pnpm lint && pnpm build` 통과 (`strict` + `noUnusedLocals/Parameters` 위반 0).
- [ ] 기존 backend 불변: root 에서 `pnpm lint && pnpm build && pnpm test` + `pnpm test:cov` 그대로 green (line ≥ 80% / function ≥ 80% — backend jest 에만 적용, web 은 vitest 별도). 본 task 는 `web/` 만 건드리므로 backend 영향 0.
- [ ] R-110: production code(컴포넌트) 변경이 있으므로 tester 가 위 명령을 실행·green 확인.
- [ ] R-114: push 후 PR CI 전 step green 확인 — approval-gate ordering fail 은 STATE.json `ci.benignRedNote` case A 절차(reviewer approve comment post 후 `gh run rerun <id> --failed`)로 처리.
- [ ] 본 컴포넌트는 분기(loading/error/empty/populated/onRemove)가 있으므로 각 분기 1+ test 로 coverage line ≥ 80% / function ≥ 80% 충족(web vitest 기준).

## Out of Scope

- 실제 멤버 목록 fetch · 멤버 추가/제거 API 호출 (`POST/DELETE /api/groups/:id/members` 등) · 낙관적 업데이트 · 토스트 배선 — 후속 slice. 본 task 는 props 로 받은 members 를 표시하고 `onRemove` 콜백만 호출.
- 멤버 추가 폼 · 그룹 생성/수정/삭제 폼 · 그룹 선택 드롭다운 — 별도 후속 slice.
- `App.tsx` 에 컴포넌트 wiring · Admin 패널 컨테이너 · 라우팅 — 후속 slice 책임 (T-0361~T-0365 와 동일 정책).
- `.github/workflows/ci.yml` 변경 일절 금지 — web vitest CI 배선은 BLOCKED 상태인 T-0355 (workflow-scope credential 대기) 책임. 본 task 의 web test 는 로컬/PR-검토 단계에서 실행하되 CI step 추가는 하지 않는다.
- 새 dependency 추가 (jsdom · @testing-library · 라우터 · 상태관리 · CSS 프레임워크 등) — 전부 ADR-0040 §5 new-dep 게이트. 본 task 는 react/react-dom/vitest 만.
- 기존 컴포넌트 수정 — file-disjoint 유지 (T-0361~T-0365 와 교집합 0).
- 정교한 스타일링(CSS) · 페이지네이션/정렬/필터 등 고급 패턴 — 의미 구조(`<ul>`/`<li>` 또는 테이블 · `role="status"` 로딩 · `role="alert"` 에러 · 빈 상태 메시지)만. 시각 디자인은 후속 styling slice.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0040 이 stack·구조를, backend 가 그룹/멤버 API 계약을 이미 결정 완료. 본 task 는 그 위 presentational 목록 컴포넌트 1개 구현)

## Follow-ups

(생성 시 비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
