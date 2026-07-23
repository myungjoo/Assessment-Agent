---
id: T-1159
title: AdminView 에 UserList 읽기 전용 사용자 목록 섹션 마운트
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-044, REQ-045]
estimatedDiff: 200
estimatedFiles: 2
independentStream: web-admin-user
dependsOn: [T-1158]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.test.tsx
created: 2026-07-24
completedAt: 2026-07-23T22:52:00Z
prNumber: 1051
plannerNote: P6 line120 Admin 사용자 관리 arc 2번째 slice — T-1158 UserList 가 미마운트 상태, T-1152 PartList mount 1:1 mirror, pr web 2파일
---

# T-1159 — AdminView 에 UserList 읽기 전용 사용자 목록 섹션 마운트

## Why

PLAN.md P6 line 120 (Admin 패널) 의 사용자 관리 arc 2번째 slice 다. T-1158 이 presentational `UserList` 를 신설했지만 아직 **어디에도 마운트되지 않아** (reviewer MINOR (3)) 운영 가치가 0 이다. backend `GET /api/users` (Admin+ RBAC, `UserResponseDto[]` 직반환) 는 이미 완결이므로, AdminView 가 그 목록을 조회해 `UserList` 에 넘기는 읽기 전용 섹션 하나만 추가하면 README 84행 (3 등급 표시) 의 첫 화면이 열린다.

파트 arc 의 T-1152 (PartList 읽기 전용 마운트) 와 1:1 mirror 다 — 재사용 가능한 기존 users fetch 가 없으므로 신규 `useApiResource<UserRow[]>` 호출 1개를 추가하고, mutation 콜백은 전달하지 않는다 (생성·역할 변경은 후속 slice).

## Required Reading

- `web/src/views/AdminView.tsx` 의 다음 지점만 (전체 4260행 read 금지 — context 보호):
  - 80~95행 — `PERSON_HEADING` / `GROUP_HEADING` / `PARTS_PATH` / `PART_HEADING` 상수 convention. 본 task 는 `USERS_PATH` / `USER_HEADING` 을 같은 자리·같은 주석 스타일로 추가한다.
  - 3225~3240행 — `useApiResource<PartRow[]>(partsPath)` 호출부 (`data: partsData` destructure + loading/error 명명 convention).
  - 4130~4150행 — `<PartList parts={partsData ?? []} ... />` 마운트 JSX (섹션 `aria-label` / heading / props 전달 형태).
  - 3612~3625행 — `isAdmin` RBAC gating 분기 (`isAdmin ? (...) : ...`). 본 섹션을 그 gating 안쪽에 둔다.
- `web/src/components/UserList.tsx` 전체 (87행) — props (`users` / `loading?` / `error?` / `emptyMessage?`) 와 `UserRow` 타입 export.
- `web/src/views/AdminView.test.tsx` 5525~5580행 — T-1152 파트 마운트 test 의 `setRoutes` mock 방식·단일 fetch 검증 (`paths.filter(...)` 길이 1) convention. 그 외 구간은 읽지 말 것.
- `src/user/user.controller.ts` 203~213행 — `GET /api/users` 가 Admin+ RBAC 이며 배열을 envelope 없이 직반환함을 재확인.

## Acceptance Criteria

- [ ] `web/src/views/AdminView.tsx` 에 `USERS_PATH = '/api/users'` 와 `USER_HEADING = '사용자 관리'` 상수를 기존 상수 블록 convention (한국어 주석 1~3줄 + 상수) 대로 추가한다.
- [ ] `useApiResource<UserRow[]>(USERS_PATH)` 신규 호출 1개로 사용자 목록을 조회하고, `data` / `loading` / `error` 를 `UserList` 에 그대로 넘긴다. 정적 path 를 쓰고 refresh nonce 는 도입하지 않는다 (mutation 이 없으므로 — 후속 slice 에서 `buildUsersPath(nonce)` 로 전환).
- [ ] `isAdmin` RBAC gating 블록 안쪽에 `aria-label="사용자 관리 섹션"` 을 가진 별도 섹션을 만들고 `USER_HEADING` heading + `<UserList users={usersData ?? []} loading={...} error={...} />` 를 마운트한다. `onChangeRole` 같은 mutation 콜백은 **전달하지 않는다** (읽기 전용).
- [ ] happy-path unit test 1+ — 사용자 2건 반환 시 사용자 관리 heading + 각 행의 email·role 이 렌더되고, `GET /api/users` 가 **정확히 한 번만** 조회된다 (`paths.filter((p) => p === USERS_PATH)` 길이 1 — double-fetch 없음).
- [ ] error path test 1+ — users fetch 가 error (예: 403) 를 반환하면 사용자 섹션이 `role="alert"` 에러를 렌더하고 목록(email) 은 미렌더한다.
- [ ] 분기 cover — (a) loading=true 시 로딩 문구 우선 렌더, (b) 빈 배열 시 빈 상태 문구, (c) `isAdmin === false` (me 조회가 User role 또는 미조회) 일 때 사용자 관리 섹션이 **렌더되지 않음**, 각 1+ test.
- [ ] negative cases 충분 cover — 각 1+ test: (a) users 응답이 `undefined` (미조회 idle) 여도 throw 없이 빈 상태 렌더, (b) email 누락 row 가 섞여도 throw 없이 렌더, (c) me 조회 loading 중에는 Admin 섹션 미렌더 (기존 gating 회귀 0), (d) 기존 인원/그룹/파트 섹션의 fetch 횟수가 본 변경으로 늘지 않음 (각 path 호출 1회 유지 — 회귀 방지).
- [ ] `pnpm --dir web test` (vitest) 전체 green + `pnpm --dir web build` (tsc + vite) green. 루트 `pnpm lint` clean.
- [ ] `pnpm test:cov` 기준선 유지 — 본 task 는 `src/` 를 건드리지 않으므로 backend coverage (line ≥ 80% / function ≥ 80%) 가 그대로 통과해야 한다.
- [ ] 사이즈 게이트 — 최종 diff ≤ 300 LOC / 파일 2개. AdminView.tsx ~50 LOC, test ~160 LOC 목표. 초과 예상 시 negative case 를 `it.each` 표로 압축한다 (test 항목을 빼서 줄이지 말 것).

## Out of Scope

- 사용자 생성 폼 (`POST /api/users`) · 역할 변경 (`PATCH /api/users/:id/role`) 배선 — 각각 후속 slice.
- `UserList.tsx` / `UserList.test.tsx` 수정 — 본 task 는 마운트만. props 부족이 드러나면 Follow-ups 에 적는다.
- `web/src/api/apiClient.ts` · `useApiResource.ts` 수정.
- refresh nonce (`buildUsersPath`) 도입 — mutation slice 가 필요할 때 전환.
- 기존 인원/그룹/파트 섹션 로직 변경 · 정렬 / 필터 / pagination.
- backend (`src/`) · prisma schema · `docs/architecture/api.md` 수정.
- `emptyMessage` 공백 문자열 truthy 문제 (T-1158 reviewer MINOR (1)) 의 convention 차원 일괄 수정 — 4개 List 컴포넌트 공통 사안이라 별도 task.
- web vitest coverage 수치 강제 인프라 (T-1158 reviewer MINOR (2)) — CI/설정 변경이라 별도 task.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)

## 결과 (2026-07-23 완료)

- PR [#1051](https://github.com/myungjoo/Assessment-Agent/pull/1051) squash 머지 `0163de4a`. reviewer round 1/7 APPROVE (BLOCKER 0 / MAJOR 0 / MINOR 3), round 2 에서 §3 Nit-in-PR closure 로 MINOR (2)(3) 마감.
- `USERS_PATH` / `USER_HEADING` 상수 + `useApiResource<UserRow[]>` 단일 정적 path 조회 1건 추가, `isAdmin` 분기 안쪽에 `aria-label="사용자 관리 섹션"` 으로 `UserList` 마운트 (mutation 콜백 미전달 — 읽기 전용 slice).
- 누적 +232 / -0 LOC · 2 파일 (cap 300/5 내), 신규 test 9건. web vitest 1029 pass · 루트 jest 11363 pass · `tsc --noEmit` + `vite build` + 루트 lint clean. CI run 30051241100 두 job 모두 pass.
- 잔여 MINOR (1) (Admin+ 4종 endpoint 를 `isAdmin` 무관하게 무조건 조회) 은 공통 convention 사안이라 T-1160 Out of Scope 로 이월.
