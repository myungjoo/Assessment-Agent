---
id: T-1774
title: ServiceIdentityList 에 행별 액션 slot renderRowActions 추가 (하위 호환 optional)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-078, REQ-079]
estimatedDiff: 150
estimatedFiles: 2
created: 2026-08-29
independentStream: service-identity-web
dependsOn: [T-1773]
touchesFiles:
  - web/src/components/ServiceIdentityList.tsx
  - web/src/components/ServiceIdentityList.test.tsx
plannerNote: "P6/PLAN 132 행 — ADR-0058 (d) 열여섯 번째 web slice: 행 액션을 li 안에 꽂을 optional slot 만 절단"
---

# T-1774 — ServiceIdentityList 에 행별 액션 slot 추가

## Why

[PLAN.md](../PLAN.md) 132 행 오너 지시 (R-182~R-183 — 인원별 서비스 ID 매핑 관리 API·UI) 의 web 축이자
[ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups (d)` 의 **열여섯 번째 web slice** 다.
앞선 다섯 slice 가 삭제 러너 (T-1769) · primary 러너 (T-1770) · 행별 플래그 helper (T-1771) · 행별 액션 어댑터 (T-1772) ·
행별 props 조립 factory (T-1773) 를 차례로 박제해 `ServiceIdentityRowActions` 에 넘길 props 는 완성됐다. 그런데 **그 컴포넌트를
행 안에 꽂을 자리가 없다** — `ServiceIdentityList` 는 `<li>` 안에 service · externalId · primary 표식만 그리고 확장점이 0 이라,
지금 상태로 마운트하려면 AdminView 가 목록 밖에 액션 버튼만 따로 `map` 하는 수밖에 없다. 그러면 행과 액션이 시각적으로 분리돼
"어느 행을 지우는지" 를 사람이 알 수 없다.

본 slice 는 그 확장점 하나만 절단한다. 액션 9 props 를 리스트로 다시 통과시키는 대신 (그러면 `ServiceIdentityRowActionsProps`
가 두 곳에 복제돼 drift 가 난다) **행 객체를 받아 노드를 돌려주는 optional slot** 만 둔다. 다음 slice (AdminView 마운트) 는
`renderRowActions={(row) => <ServiceIdentityRowActions {...buildServiceIdentityRowActionsProps(row, deps)} />}` 한 줄로 끝나
state 4 종 + gate + deps memo 를 담고도 cap 안에 들어온다 (직전 배선 slice 들이 각각 정확히 `+300` 이었던 점을 감안한 분할).

slot 이 막는 결함 세 가지: (1) 액션이 행 밖에 그려져 대상 오인 삭제, (2) `loading` / `error` / 빈 목록 분기에서도 slot 이
호출돼 존재하지 않는 행의 액션이 뜨는 창, (3) slot 미전달인 기존 호출부 (`AdminView` 읽기 축 T-1766) 의 markup 이 바뀌는 회귀.

## Required Reading

- [web/src/components/ServiceIdentityList.tsx](../../web/src/components/ServiceIdentityList.tsx) — 전문 (86 행). 특히 `[1] loading → [2] error → [3] empty → [4] populated` 4 분기 순서와 `<li>` 안 표시 컬럼 순서
- [web/src/components/ServiceIdentityList.test.tsx](../../web/src/components/ServiceIdentityList.test.tsx) — 본 slice 가 test 를 **추가** 할 colocated spec (207 행). `renderToStaticMarkup` 기반 정적 markup 단언 형식을 그대로 승계한다
- [web/src/components/ServiceIdentityRowActions.tsx](../../web/src/components/ServiceIdentityRowActions.tsx) — slot 의 실 소비자가 될 컴포넌트 (`ServiceIdentityRowActionsProps` 9 props). 본 slice 는 이 파일을 **수정하지 않는다** — slot 계약이 이 props 를 복제하지 않는 근거로만 읽는다
- [web/src/components/UserList.tsx](../../web/src/components/UserList.tsx) — `54 행` 부근 `UserListProps` 의 optional 콜백 prop 하위 호환 convention (미전달 시 미렌더, 기존 호출부 회귀 0). 본 slot 이 승계할 선례
- [web/src/api/serviceIdentity.ts](../../web/src/api/serviceIdentity.ts) — `ServiceIdentityRow` 타입 (slot 인자 타입)
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) — `5439 행` 부근 `<ServiceIdentityList ... />` 현 호출부 3 props (본 slice 는 이 파일을 수정하지 않는다 — 호출부 무변경으로 하위 호환을 확인하는 용도)
- [docs/decisions/ADR-0058-service-identity-management-api.md](../decisions/ADR-0058-service-identity-management-api.md) — `§Decision 2` (1 인원 1 primary invariant) · `§Follow-ups (d)`
- [docs/decisions/ADR-0041-frontend-composition-wiring.md](../decisions/ADR-0041-frontend-composition-wiring.md) — `§Decision 1` (presentational 은 fetch·state 0, props 만 받는 controlled 경계 — slot 도 이 경계를 넘지 않는다)

## Acceptance Criteria

- [ ] `ServiceIdentityListProps` 에 optional slot prop **1 개만** 추가한다 — `renderRowActions?: (identity: ServiceIdentityRow) => ReactNode`
      (`ReactNode` 는 `react` 에서 `import type` — 새 dependency 0). 액션 콜백·플래그를 개별 prop 으로 늘어놓지 않는다
      (`ServiceIdentityRowActionsProps` 복제 금지 — drift 차단).
- [ ] slot 결과는 `[4] populated` 분기의 **각 `<li>` 안**, 기존 표시 컬럼 (service · externalId · primary 표식) **뒤** 에 렌더한다.
      `<ul>` 밖이나 별도 목록으로 빼지 않는다 (행-액션 귀속이 본 slice 의 목적).
- [ ] slot 은 행마다 **정확히 1 회**, `identities` 배열 순서대로 그 행 객체를 인자로 호출한다. 배열을 복제·정렬·필터하지 않는 기존 계약은 그대로다.
- [ ] `[1] loading` · `[2] error` · `[3] empty` 세 분기에서는 slot 을 **한 번도 호출하지 않는다** (존재하지 않는 행의 액션 노출 차단).
- [ ] `renderRowActions` 미전달 시 markup 이 **바이트 단위로 종전과 동일** 하다 — 기존 호출부 (`AdminView` T-1766 배선) 회귀 0.
- [ ] 본 컴포넌트는 여전히 stateless presentational 이다 — `useState` · fetch · slot 반환값 가공·캐싱을 도입하지 않는다 (ADR-0041 `§Decision 1`).
- [ ] `web/src/components/ServiceIdentityList.test.tsx` 에 test 를 **추가** 하고 (기존 test 삭제·수정 금지) R-112 4 종을 모두 덮는다.
  - [ ] **happy-path** — identities 2 건 + slot 전달 시 (a) slot 이 정확히 2 회, (b) 인자가 각각 그 행 객체 (배열 순서 일치), (c) 반환 노드가 각 `<li>` **안** 에 있음 (해당 행의 `externalId` 와 다음 `<li>` 시작 사이 index) 을 검증.
  - [ ] **error path** — slot 이 throw 하면 렌더가 그 예외를 **삼키지 않고 상위로 전파** 함을 `expect(() => renderToStaticMarkup(...)).toThrow()` 로 고정 (컴포넌트가 error boundary 를 흉내내지 않는다는 경계). 또한 `error` prop 이 truthy 인 분기에서는 slot 호출 0 이며 alert 문구만 렌더됨을 검증.
  - [ ] **분기 cover** — `[1] loading` / `[2] error` / `[3] empty` / `[4] populated` 4 분기 각각에서 slot 호출 횟수 (0/0/0/N) 를 각 1+ test 로 고정.
  - [ ] **negative cases 충분 cover** — (a) slot 미전달 시 markup 이 slot 도입 전과 동일 (기존 표식·`<li>` 수 불변), (b) slot 이 `null` 반환 시 throw 없이 그 행이 정상 렌더, (c) slot 이 `undefined` 반환 시 동일, (d) `identities` 가 빈 배열이면 slot 호출 0, (e) `loading=true` 가 `identities` 다건 + slot 동시 전달보다 우선해 slot 호출 0, (f) slot 이 다른 행의 노드를 돌려줘도 컴포넌트가 교정하지 않고 받은 대로 렌더 (판정은 상위 책임) — 각 1+ test.
- [ ] `pnpm --dir web test` (또는 저장소 표준 web test 명령) 전량 green.
- [ ] 저장소 루트 `pnpm lint` · `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `pnpm --dir web build` (tsc --noEmit + vite) green — `noUnusedLocals` 위반 0.

## Out of Scope

- `web/src/views/AdminView.tsx` 수정 — `<ServiceIdentityRowActions>` 마운트, 컨테이너 state (`confirmingDeleteId` · busy gate · 에러 귀속 slot 2 종), wiring deps memo 는 **다음 slice** 책임이다. 본 slice 는 호출부를 건드리지 않고 slot 만 연다.
- `ServiceIdentityRowActions.tsx` · `ServiceIdentityAddForm.tsx` · `ServiceIdentityEditForm.tsx` 본문 수정.
- `web/src/api/serviceIdentity.ts` client 함수 신설·수정.
- 목록에 정렬·필터·페이지네이션·행 선택 상태 도입.
- backend (`src/`) · prisma schema · e2e · smoke 변경.
- Admin RBAC gating, doc-sync (`docs/architecture/*`), ADR 갱신 — ADR-0058 `§Follow-ups (d)` 잔여로 남긴다.
- 새 외부 dependency 추가 (§5 게이트) — `ReactNode` 는 이미 설치된 `react` 의 type 이라 delta 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 발견한 후속 작업을 여기에 적는다.)
