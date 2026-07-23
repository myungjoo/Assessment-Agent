---
id: T-1161
title: UserList 에 역할 변경 콜백 prop 추가 (onChangeRole)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-044, REQ-045]
estimatedDiff: 210
estimatedFiles: 2
independentStream: web-admin-user
dependsOn: [T-1160]
touchesFiles:
  - web/src/components/UserList.tsx
  - web/src/components/UserList.test.tsx
created: 2026-07-23
plannerNote: P6 line120 Admin 사용자 관리 arc 4번째 slice — PartList onDelete/onEdit mirror 로 UserList 역할 변경 콜백만 신설, AdminView 배선은 다음 slice
---

# T-1161 — UserList 에 역할 변경 콜백 prop 추가 (onChangeRole)

## Why

PLAN.md P6 line 120 (Admin 패널) 의 사용자 관리 arc 4번째 slice 다. T-1158 (UserList 신설) → T-1159 (읽기 전용 마운트) → T-1160 (생성 mutation) 으로 목록 표시와 추가는 열렸지만, README 84행 / REQ-044 의 **역할 승급·강등** (`PATCH /api/users/:id/role`, SuperAdmin 전용) 을 사람이 누를 표면이 web 에 전혀 없다.

T-1158 은 cap 준수를 위해 UserList 에 콜백 props 를 의도적으로 미도입했다. 본 task 는 그 잔여를 PartList (`onDelete` / `onEdit`, T-1151) convention 1:1 mirror 로 채워 **presentational 표면만** 연다. 실 PATCH 요청 · SuperAdmin gating · 진행/에러 상태는 상위 컨테이너 (AdminView) 책임이라 다음 slice 로 분리한다 (ADR-0041 Decision 1 — 컴포넌트는 fetch 를 모른다).

## Required Reading

- `web/src/components/UserList.tsx` (전체, 87행) — 현재 props 4종 (`users` / `loading` / `error` / `emptyMessage`) 와 렌더 분기 (loading 우선 → error → empty → populated), `UserRow` 3 필드 (`id?` / `email?` / `role?`), `EMAIL_PLACEHOLDER` 상수 convention.
- `web/src/components/PartList.tsx` 31~53행 + 90~108행 — `DELETE_LABEL` / `EDIT_LABEL` 상수 + `onDelete?` / `onEdit?` optional prop 주석 convention + `{onDelete && rowId ? <button type="button" onClick={() => onDelete(rowId)}>` 렌더 가드. 본 task 의 `onChangeRole` 이 이 형태를 그대로 따른다.
- `web/src/components/PartList.test.tsx` 1~40행 + 208~240행 — `renderToStaticMarkup` 정적 렌더 harness 와 `collectButtons` element-트리 순회 헬퍼 (jsdom 미도입이라 클릭은 button 의 `onClick` 을 수동 호출해 검증하는 convention, ADR-0040 §5 게이트).
- `web/src/components/UserList.test.tsx` (전체, 185행) — 기존 17 test 의 describe 구성. 본 task 의 새 test 는 뒤에 append 하며 기존 test 는 수정하지 않는다 (하위 호환 회귀 0).
- `src/user/user.controller.ts` 120~140행 — `PATCH /api/users/:id/role` 이 `@Roles("SuperAdmin")` 이고 body 가 `{ role }` 단일 필드임을 재확인 (본 task 는 호출하지 않고 콜백 인자 shape 만 맞춘다).
- `src/user/dto/change-role.dto.ts` 22~36행 — `role` 이 `"SuperAdmin" | "Admin" | "User"` 세 값만 허용됨 (`@IsIn(VALID_ROLE_VALUES)`).

## Acceptance Criteria

- [ ] `web/src/components/UserList.tsx` 에 optional prop `onChangeRole?: (id: string, nextRole: string) => void` 를 추가한다. 주석은 PartList `onDelete` convention (한국어 · 미전달 시 버튼 미렌더 · presentational 책임 경계 명시) 을 따른다.
- [ ] 버튼 라벨 상수 2개 (`PROMOTE_LABEL = 'Admin 으로 승급'`, `DEMOTE_LABEL = 'User 로 강등'`) 를 기존 상수 블록 (`LOADING_TEXT` 등) 옆에 추가한다.
- [ ] 각 행의 버튼 렌더 규칙: `onChangeRole` 과 `row.id` 가 **둘 다** 있을 때만 렌더하고, 현재 `row.role` 값에 따라 (a) `'User'` → 승급 버튼 1개 (`onChangeRole(id, 'Admin')`), (b) `'Admin'` → 강등 버튼 1개 (`onChangeRole(id, 'User')`), (c) `'SuperAdmin'` → 버튼 미렌더 (SuperAdmin 강등은 backend self-demote 금지 정책상 노출하지 않는다), (d) `role` 누락/미지 값 → 버튼 미렌더 (판정 불가 시 보수적 미노출). 컴포넌트는 여전히 stateless — 로컬 state / select 도입 금지.
- [ ] `onChangeRole` 미전달 시 기존 렌더 결과가 **그대로 유지** 된다 (T-1159 마운트 회귀 0). loading / error / empty 분기에서는 어떤 경우에도 역할 버튼을 렌더하지 않는다.
- [ ] happy-path unit test 1+ — `onChangeRole` 전달 시 `role: 'User'` 행에 승급 버튼이, `role: 'Admin'` 행에 강등 버튼이 렌더되고, 각 버튼의 `onClick` 을 수동 호출하면 (`collectButtons` 동형 순회) 해당 행의 `(row.id, 'Admin')` / `(row.id, 'User')` 인자로 정확히 1회 호출된다.
- [ ] error path unit test 1+ — (a) `error` truthy 일 때 `onChangeRole` 을 전달해도 alert 문구만 렌더되고 버튼이 0개, (b) `loading === true` 일 때도 버튼 0개 (loading 우선 정책 유지).
- [ ] 분기 cover — 각 1+ test: `role='User'` (승급만) / `role='Admin'` (강등만) / `role='SuperAdmin'` (버튼 0) / `role` 누락 (버튼 0) / `onChangeRole` 미전달 (버튼 0) / `id` 누락 (해당 행만 버튼 0, 다른 행은 정상 렌더).
- [ ] negative cases 충분 cover — 각 1+ test: (a) `users: []` + `onChangeRole` 전달 → 빈 상태 문구만 (버튼 0, throw 0), (b) `role` 이 소문자 `'admin'` 같은 미지 값 → 버튼 0 (대소문자 관대 처리 금지), (c) 혼합 목록 (User + Admin + SuperAdmin + role 누락) 에서 버튼 개수가 정확히 2개이고 각 인자가 해당 행 id 와 매칭, (d) 콜백을 호출해도 컴포넌트가 throw 하지 않고 다른 행 렌더에 영향 0, (e) `email` 누락 행에서도 role 버튼 렌더 규칙이 동일하게 적용 (placeholder 와 독립).
- [ ] `pnpm --dir web test` (vitest) 전체 green + `pnpm --dir web build` (tsc + vite) green. 루트 `pnpm lint` clean.
- [ ] `pnpm test:cov` 기준선 유지 — 본 task 는 `src/` 를 건드리지 않으므로 backend coverage (line ≥ 80% / function ≥ 80%) 가 그대로 통과해야 한다.
- [ ] 사이즈 게이트 — 최종 diff ≤ 300 LOC / 파일 2개. 목표 배분: `UserList.tsx` ≤ 60 LOC, `UserList.test.tsx` ≤ 150 LOC. 초과 예상 시 (1) 주석을 mirror 선례 참조 한 줄 (`PartList onDelete mirror`) 로 압축하고 (2) 분기 / negative test 를 `it.each` 표로 합친다. **test 항목 자체를 빼서 줄이지 말 것** (R-112 위반).

## Out of Scope

- `web/src/views/AdminView.tsx` 수정 — `runChangeRole` 러너 · `PATCH /api/users/:id/role` 호출 · SuperAdmin gating (`isSuperAdmin` 파생) · 진행/에러 상태 · `<UserList onChangeRole={...} />` 마운트는 **다음 slice** 책임.
- `web/src/api/apiClient.ts` · `useApiResource.ts` · backend (`src/`) · prisma schema · `docs/architecture/api.md` 수정.
- 역할 3종 select box / 인라인 편집 폼 / 확인 다이얼로그 도입 — 본 slice 는 stateless 버튼 2종만.
- 사용자 삭제 UI — backend 에 `DELETE /api/users/:id` endpoint 자체가 없다 (필요 시 별도 backend task 선행).
- 사용자 목록 정렬 / 필터 / pagination.
- **(이월 1 — T-1160 reviewer MINOR)** `web/src/views/AdminView.tsx` 의 사용자 조회 주석 블록 재배치 (T-1159 조회 설명 주석과 T-1160 nonce/`useMemo` 코드가 섞여 주석이 설명 대상과 분리됨, 동작 영향 0) — AdminView 를 건드리는 다음 slice 에서 함께 정리한다.
- **(이월 2 — T-1160 reviewer MINOR)** RTL 등 상호작용 렌더 harness 부재 (`createUserError` `role="alert"` 렌더 분기와 `disabled={creatingUser}` true 분기가 정적 렌더 test 로 직접 cover 되지 않음) — 파트/그룹 slice 와 동일한 공통 harness 한계라 별도 task 후보. 본 task 도 `renderToStaticMarkup` + element-트리 순회 convention 을 그대로 따른다.
- **(이월 3 — T-1159 reviewer MINOR)** Admin+ endpoint 4종을 `isAdmin` 과 무관하게 무조건 조회하는 convention (비-Admin actor 에서 확정 403 요청) 전환 — 4개 조회 공통 convention 사안이라 별도 task.
- **(이월 4 — T-1158 reviewer MINOR)** `web/` vitest coverage 수치 미강제 (`web/package.json` 의 `test` 가 threshold 없이 `vitest run` 만 실행) 해소 — CI / 설정 인프라 사안이라 별도 task.
- **(이월 5 — T-1158 reviewer MINOR)** `emptyMessage` 빈 문자열 truthy 처리의 4개 List 컴포넌트 일괄 수정 — 별도 task.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)
