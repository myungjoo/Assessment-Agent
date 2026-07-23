---
id: T-1158
title: UserList presentational 컴포넌트 신설 (Admin 사용자 관리 목록 UI 첫 slice)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-044, REQ-045]
estimatedDiff: 280
estimatedFiles: 2
independentStream: web-admin-user
dependsOn: [T-1157]
touchesFiles:
  - web/src/components/UserList.tsx
  - web/src/components/UserList.test.tsx
created: 2026-07-24
plannerNote: P6 line120 Admin 사용자 관리 arc 첫 slice — 인원/그룹/파트 CRUD 완결 후 남은 UI 공백(README 84행), PartList T-1151 mirror, pr web 2파일
---

# T-1158 — UserList presentational 컴포넌트 신설

## Why

PLAN.md P6 line 120 (Admin 패널) 의 남은 UI 공백을 연다. AdminView 는 현재 인원(T-1141~T-1145)·그룹(T-1147~T-1150)·파트(T-1151~T-1157) CRUD 를 모두 배선했지만, README 84행이 요구하는 **"Admin 이 사용자를 추가하고 User→Admin 승급을 Web UI 상에서 수행"** (REQ-044) 에 해당하는 화면은 하나도 없다 — AdminView 가 호출하는 path 목록에 `/api/users` 가 전혀 없다. backend 는 이미 완결 (`GET /api/users` Admin+ 목록, `POST /api/users` 생성, `PATCH /api/users/:id/role` SuperAdmin 승강) 이므로 UI 만 남았다.

본 task 는 그 arc 의 **첫 slice** 로, ADR-0041 Decision 1 (presentational-first, controlled lift-up) 에 따라 순수 presentational `UserList` 컴포넌트만 신설한다. 실 fetch·mount·mutation 배선은 후속 slice 책임이다 (T-1151 PartList → T-1152 mount → T-1153 create 와 동일한 순서).

## Required Reading

- `web/src/components/PartList.tsx` (전체 114행) — 본 task 가 1:1 mirror 할 직전 presentational 컴포넌트. row 타입 / props 인터페이스 / `loading → error → empty → populated` 분기 순서 / 한국어 상수 / `export type { ... }` + `export default` convention 을 그대로 따른다.
- `web/src/components/PartList.test.tsx` (1~60행의 import·상수·헤더 주석 + 아무 `describe` 블록 1개) — 테스트 파일의 렌더 방식·쿼리 convention 만 파악. 전체를 읽지 말 것 (context 보호).
- `src/user/dto/user-response.dto.ts` 52~68행 — backend 응답 필드 (`id` / `email` / `role` / `createdAt` / `updatedAt`). 비밀 필드(hashedPassword)는 응답에 없다.
- `src/user/user.controller.ts` 203~213행 — `GET /api/users` (Admin+ RBAC, `UserResponseDto[]` 배열 직반환 — envelope 없음).
- `docs/decisions/ADR-0041-frontend-composition-wiring.md` 의 Decision 1 — presentational 컴포넌트는 fetch 를 모른다는 경계.
- `README.md` 84행 — 3 등급(SuperAdmin / Admin / User) 과 승급 규칙 (본 slice 는 표시만, 승급 동작은 후속).

## Acceptance Criteria

- [ ] `web/src/components/UserList.tsx` 신설 — 순수 controlled presentational 컴포넌트. props 는 `users: UserRow[]`, `loading?: boolean`, `error?: string`, `emptyMessage?: string` 4 개만. row 타입 `UserRow` 는 backend 응답 대비 보수적으로 `{ id?: string; email?: string; role?: string }` (모두 optional) 로 둔다. `export type { UserRow, UserListProps }` + `export default UserList` convention 준수.
- [ ] 렌더 분기는 PartList 와 동일한 우선순위 — `loading === true` (role="status" 로딩 문구) → `error` truthy (role="alert") → `users.length === 0` (role="status" 빈 상태 문구, `emptyMessage` 빈 문자열이면 기본 문구 fallback) → 목록(`<ul>/<li>`). 각 행은 email 을 주 라벨로, role 을 보조 라벨로 표시한다.
- [ ] happy-path unit test 1+ — `users` 2건 이상 전달 시 각 행의 email·role 이 모두 렌더된다.
- [ ] error path test 1+ — `error` 문구 전달 시 `role="alert"` 영역에 그 문구가 렌더되고 목록은 렌더되지 않는다.
- [ ] 분기 cover — 위 4 분기(loading / error / empty / populated) 각각 1+ test. 특히 `loading=true` + `error` + `users` 가 동시에 주어져도 로딩 표시가 우선함을 검증 (loading 우선 정책).
- [ ] negative cases 충분 cover — 예외 상황마다 각 1+ test: (a) `email` 누락 row → placeholder 문구로 표시하고 throw 하지 않음, (b) `role` 누락 row → email 만 표시, (c) `id` 누락 row → index 기반 key fallback 으로 렌더 (경고 없이 정상 렌더), (d) `emptyMessage` 빈 문자열 → 기본 빈 상태 문구 fallback, (e) `error` 빈 문자열(falsy 경계값) → alert 분기로 진입하지 않고 목록/빈 상태가 렌더, (f) `users` 빈 배열 + `loading` 미전달 → 빈 상태 문구.
- [ ] `pnpm --dir web test` (vitest) 전체 green + `pnpm --dir web build` (tsc + vite) green. 루트 `pnpm lint` clean.
- [ ] `pnpm test:cov` 기준선 유지 — 본 task 는 `src/` 를 건드리지 않으므로 backend coverage(line ≥ 80% / function ≥ 80%) 가 그대로 통과해야 한다.
- [ ] 사이즈 게이트 — 최종 diff ≤ 300 LOC / 파일 2개. 컴포넌트 ~100 LOC, 테스트 ~180 LOC 를 목표로 하고, 초과가 예상되면 negative case 를 표 기반 `it.each` 로 압축한다 (테스트 항목을 빼서 줄이지 말 것).

## Out of Scope

- `web/src/views/AdminView.tsx` 수정 — mount 는 후속 slice (T-1152 PartList mount mirror).
- 실 fetch (`useApiResource('/api/users')`) · `apiClient` · `useApiResource` 수정.
- 사용자 생성 폼 (`POST /api/users`) · 역할 변경 (`PATCH /api/users/:id/role`) 콜백 props — 본 slice 는 **콜백 props 를 도입하지 않는다** (cap 준수). 후속 slice 에서 `onChangeRole` 등을 추가한다.
- SuperAdmin 강등 규칙 (본인 강등 금지 등) 의 클라이언트 검증 — 역할 변경 slice 책임.
- backend (`src/`) · prisma schema · api.md 수정.
- 정렬 / 필터 / pagination.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)

참고 (본 task 범위 아님): T-1157 reviewer 가 남긴 "web/ 에 jsdom·@testing-library 부재로 컨테이너 핸들러 클릭 구동 test 불가" 항목은 신규 dev dependency 추가 대상이라 CLAUDE.md §5 BLOCKED (새 외부 dependency) — 필요 시 humanQuestion 으로 올려야 하며 본 task 에서 처리하지 않는다.
