---
id: T-1160
title: AdminView 사용자 생성 mutation 배선 (POST /api/users)
phase: P6
status: DONE
commitMode: pr
prNumber: 1052
reviewRounds: 1
mergedAs: b43dadb9
completedAt: 2026-07-23T23:29:00Z
coversReq: [REQ-044, REQ-045]
estimatedDiff: 290
estimatedFiles: 2
independentStream: web-admin-user
dependsOn: [T-1159]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.test.tsx
created: 2026-07-24
plannerNote: P6 line120 Admin 사용자 관리 arc 3번째 slice — T-1153 파트 create 1:1 mirror(email+password 2필드·409 전용문구), pr web 2파일, cap 게이트 AC 박제
---

# T-1160 — AdminView 사용자 생성 mutation 배선 (POST /api/users)

## Why

PLAN.md P6 line 120 (Admin 패널) 의 사용자 관리 arc 3번째 slice 다. T-1158 (UserList presentational) → T-1159 (읽기 전용 마운트) 로 목록은 열렸지만 **사용자를 추가할 UI 가 없어** README 84행 "사용자 추가" 가 여전히 web 에서 불가능하다. backend `POST /api/users` (signup, `AddUserDto` = email + password, 201 Created, `User.email` 이 `@unique` 라 중복 시 409) 는 이미 완결이므로 AdminView 에 생성 폼 + 순수 러너만 배선하면 된다.

파트 arc 의 T-1153 (`runCreatePart` + `buildPartsPath(nonce)` + 409 전용 문구) 과 1:1 mirror 이며, 차이는 payload 가 `{ email, password }` 2 필드라는 점뿐이다. 검증된 패턴을 그대로 재사용하므로 apiClient / useApiResource / UserList / backend 수정은 0 이다 (ADR-0041 Decision 1 — 컴포넌트는 fetch 를 모른다).

## Required Reading

`web/src/views/AdminView.tsx` 는 4200행 이상이다 — **아래 지정 구간만 read** (전체 read 금지, context 보호).

- `web/src/views/AdminView.tsx`
  - 95~120행 — `PARTS_PATH` / `PART_HEADING` / `USERS_PATH` / `USER_HEADING` / `PART_DUPLICATE_ERROR` 상수 블록. 본 task 는 같은 자리에 `USER_DUPLICATE_ERROR` 상수를 추가한다.
  - 684~695행 — `buildPartsPath(refreshNonce)` 순수 helper. 본 task 의 `buildUsersPath(refreshNonce)` 가 이 형태를 그대로 따른다 (nonce ≤ 0 이면 base path 그대로 — T-1159 의 초기 조회 path 유지, 회귀 0).
  - 1565~1660행 — `CreatePartDeps` 인터페이스 + `runCreatePart` 러너 본체 (trim 가드 · in-flight 이중 POST 가드 · 성공 시 nonce bump + 입력 초기화 · 실패 no-throw · 409 → 전용 문구 · finally off). 본 task 의 `CreateUserDeps` / `runCreateUser` 가 이 구조를 mirror 한다.
  - 3290~3335행 — `useApiResource<UserRow[]>(USERS_PATH)` 호출부 (T-1159) 와 바로 아래 파트 생성 state (`partNameInput` / `creatingPart` / `createPartError`) + `handleCreatePart` `useCallback` 주입부.
  - 4118~4144행 — 파트 생성 폼 JSX (`aria-label` input + 버튼 `disabled={creatingPart || !partNameInput.trim()}` + `role="alert"` 에러 표시).
  - 3888~3905행 — T-1159 가 마운트한 사용자 관리 `<section aria-label={USER_HEADING}>` JSX. 본 task 의 생성 폼은 이 섹션 안쪽 (heading 바로 아래) 에 넣는다.
- `web/src/views/AdminView.test.tsx`
  - 5113~5200행 — `runCreatePart` mutation 러너 test convention (deps mock 조립 방식 · 발사 억제 검증 · 409 분기 검증).
  - 5670~5700행 — 파트 생성 폼 정적 렌더 test convention (`aria-label` / 버튼 문구 / 초기 disabled 검증).
  - 8110행 이후 — T-1159 사용자 관리 마운트 describe. 본 task 의 새 describe 는 그 뒤에 append 한다.
- `src/user/user.controller.ts` 139~166행 — `POST /api/users` 가 guard 없음 (Public tier) · 201 Created · `AddUserDto` (email + password) · 중복 email → 409 임을 재확인.
- `src/user/dto/add-user.dto.ts` 37~60행 — `@IsEmail` + `@IsNotEmpty` + `@IsString` + `@MinLength(8)` 검증 규칙 (클라이언트는 이 규칙을 복제하지 않고 서버 400 을 문구로 표면화한다).

## Acceptance Criteria

- [ ] `web/src/views/AdminView.tsx` 에 `USER_DUPLICATE_ERROR = '이미 존재하는 이메일입니다'` 상수를 기존 상수 블록 convention (한국어 주석 + 상수) 으로 추가한다.
- [ ] `buildUsersPath(refreshNonce: number): string` 순수 helper 를 `buildPartsPath` 동형으로 추가하고, T-1159 의 `useApiResource<UserRow[]>(USERS_PATH)` 를 `useMemo` 로 감싼 `buildUsersPath(usersRefreshNonce)` 조회로 전환한다. nonce 0 일 때 path 는 기존 `USERS_PATH` 와 **문자열이 동일** 해야 한다 (초기 조회 회귀 0).
- [ ] `CreateUserDeps` + `runCreateUser(email, password, deps)` 순수 async 러너를 `runCreatePart` mirror 로 추가한다. 동작: (a) email 또는 password 가 빈/공백이면 미발사, (b) `creating` in-flight 면 미발사 (이중 POST 가드), (c) 발사 시 진행 on + 직전 error 비움 → `POST /api/users` (body `{ email: trim 값, password }`), (d) 성공 시 `bumpRefresh()` + `resetInput()`, (e) 실패는 throw 하지 않고 error state 로 흡수 — `isConflict(e) === true` 면 `USER_DUPLICATE_ERROR`, 그 외는 `describeError(e)` 문구, (f) 성공·실패 공통으로 진행 off.
- [ ] 사용자 관리 섹션 (`aria-label={USER_HEADING}`) 안쪽에 생성 폼을 마운트한다 — `aria-label="추가할 사용자 이메일"` text input + `aria-label="추가할 사용자 비밀번호"` password input + `사용자 추가` 버튼 + 실패 시 `role="alert"` 문구. 버튼은 `creatingUser || !emailInput.trim() || !passwordInput` 일 때 disabled, 진행 중엔 두 input 도 disabled. `handleCreateUser` 가 실 deps (`request` / `toErrorMessage` / `(e) => e instanceof ApiError && e.status === 409`) 를 주입해 러너를 호출한다.
- [ ] happy-path unit test 1+ — 유효한 email + password 로 `runCreateUser` 호출 시 `POST /api/users` 가 정확히 1회, body 가 `{ email, password }` 이고, 성공 후 `bumpRefresh` / `resetInput` 각 1회 호출 + error 가 비워진다. 폼 정적 렌더 test 1+ — 사용자 관리 섹션에 두 input 과 `사용자 추가` 버튼이 렌더된다.
- [ ] error path unit test 1+ 씩 — (a) 409 throw 시 error state 가 `USER_DUPLICATE_ERROR` 이고 `describeError` 는 미사용, (b) 400 (검증 실패) throw 시 `describeError` 파생 일반 문구, (c) 네트워크 throw (비-`ApiError`) 시에도 러너가 throw 하지 않고 문구만 표면화. 세 경우 모두 `bumpRefresh` / `resetInput` 미호출 + 진행 플래그 off.
- [ ] 분기 cover — 각 1+ test: (a) `buildUsersPath(0)` = base path / `buildUsersPath(3)` = `_r=3` query 포함, (b) `isConflict` true 분기 vs false 분기, (c) 성공 분기 vs 실패 분기의 진행 플래그 전이, (d) 폼 초기 상태에서 `사용자 추가` 버튼이 disabled 로 렌더.
- [ ] negative cases 충분 cover — 각 1+ test: (a) email 빈 문자열 / 공백만 → 미발사 (`create` 호출 0), (b) password 빈 문자열 → 미발사, (c) `creating === true` (in-flight) 중 재호출 → 미발사 (이중 POST 0), (d) email 앞뒤 공백은 trim 되어 body 에 실림 (password 는 trim 하지 않음 — 공백도 유효 문자), (e) 본 변경으로 다른 섹션 (인원 / 그룹 / 파트) 의 조회 횟수가 늘지 않음 (각 path 호출 1회 유지 — 회귀 방지).
- [ ] `pnpm --dir web test` (vitest) 전체 green + `pnpm --dir web build` (tsc + vite) green. 루트 `pnpm lint` clean.
- [ ] `pnpm test:cov` 기준선 유지 — 본 task 는 `src/` 를 건드리지 않으므로 backend coverage (line ≥ 80% / function ≥ 80%) 가 그대로 통과해야 한다.
- [ ] 사이즈 게이트 — 최종 diff ≤ 300 LOC / 파일 2개 (T-1156·T-1153 의 cap 초과 재발 방지). 목표 배분: `AdminView.tsx` ≤ 130 LOC, `AdminView.test.tsx` ≤ 170 LOC. 초과 예상 시 (1) 주석을 mirror 선례 참조 한 줄 (`T-1153 runCreatePart mirror`) 로 압축하고 (2) negative / 분기 test 를 `it.each` 표로 합친다. **test 항목 자체를 빼서 줄이지 말 것** (R-112 위반).

## Out of Scope

- 역할 변경 (`PATCH /api/users/:id/role`) 배선 · SuperAdmin gating · `UserList` 에 `onChangeRole` prop 추가 — 다음 slice.
- `web/src/components/UserList.tsx` / `UserList.test.tsx` 수정 — 본 task 는 컨테이너 배선만.
- `web/src/api/apiClient.ts` · `useApiResource.ts` 수정.
- 클라이언트 측 email 형식 / password 최소 8자 사전 검증 복제 — 서버 400 을 문구로 표면화하는 것으로 대체 (검증 규칙 이중 관리 회피).
- 기존 인원 / 그룹 / 파트 섹션 로직 변경 · 사용자 목록 정렬 / 필터 / pagination.
- backend (`src/`) · prisma schema · `docs/architecture/api.md` 수정.
- **(이월 1 — T-1159 reviewer MINOR)** Admin+ endpoint (`USERS_PATH` 등 4종) 를 `isAdmin` 과 무관하게 무조건 조회하는 현재 convention (비-Admin actor 에서 확정 403 요청이 발생) 을 `isAdmin ? PATH : null` 조건부 조회로 전환하는 작업 — 4개 조회에 공통으로 걸린 convention 사안이라 별도 task 로 처리한다. 본 task 는 기존 convention 을 그대로 따른다.
- **(이월 2 — T-1159 reviewer MINOR)** `web/` vitest coverage 수치 미강제 (`web/package.json` 의 `test` 가 `vitest run` 만 실행 — threshold 없음) 해소 — CI / 설정 인프라 사안이라 별도 task.
- `emptyMessage` 빈 문자열 truthy 문제 (T-1158 reviewer MINOR) 의 4개 List 컴포넌트 일괄 수정 — 별도 task.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)
