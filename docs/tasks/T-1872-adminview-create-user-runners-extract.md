---
id: T-1872
title: AdminView 의 사용자 생성 mutation 러너 군을 adminUserMutationRunners 로 순수 추출
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-039]
independentStream: adminview-god-component-refactor
dependsOn: [T-1871]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/adminUserMutationRunners.ts
  - web/src/views/adminUserMutationRunners.test.ts
  - web/src/views/AdminView.create-user-failure.test.ts
estimatedDiff: 420
estimatedFiles: 4
sizeExempt: true
exemptReason: "pure-extraction — (a) 동작 변경 0 (연속 블록 이동 + 선언 앞 export 키워드 부착 + 단방향 import 배선만) · (b) 신규 로직 0 LOC (상수 4 · 순수 helper 3 · deps 타입 1 · async 러너 1 의 본문 무변경) · (c) 런타임 spec 은 AdminView 배럴 재수출 덕에 `from './AdminView'` 무수정 통과하고, 소스-텍스트 drift-guard 1 개는 리터럴 읽기 대상 pointer 만 바뀌며 단언 내용은 불변. 삭제 약 130 + 추가 약 170 이 전부 이동량이고 나머지는 신규 모듈 경계 spec 이라 LOC 이 위험도에 비례하지 않는다. 파일 수 4 로 파일 cap (≤ 5) 은 예외 없이 준수."
plannerNote: "P6 / PLAN 183 행 AdminView 부채 열째 실분할 — 재지목된 사용자 관리 축 17 심볼 중 생성 축 7 심볼 + 동반 상수 2 를 첫 slice 로"
created: 2026-09-03
---

# T-1872 — AdminView 의 사용자 생성 mutation 러너 군을 adminUserMutationRunners 로 순수 추출

## Why

[docs/PLAN.md](../PLAN.md) `183 행` (오너 지시 2026-08-31 · AdminView god component 부채) 의 실분할 **열째 슬라이스** 다. 직전 [T-1871](T-1871-plan-adminview-debt-remeasure-next-target.md) 이 스케줄 축 소멸을 반영해 다음 대상을 **사용자 관리 mutation 축 17 심볼 (`1128~1426 행`)** 로 재지목했고, 같은 bullet 이 파일 cap 을 이유로 **생성 축 (`1128~1232 행`, 7 심볼) / 권한 · 역할 축 (`1234~1426 행`, 10 심볼)** 을 절단선 후보로 제시했다. 본 task 는 그 중 **생성 축** 을 옮기는 첫 slice 이며, 축 전체를 한 번에 옮기면 drift-guard 동반 갱신으로 파일 수가 밀려 cap 을 넘길 위험이 있어 bullet 이 제시한 절단선을 그대로 따른다.

**issue-still-relevant pre-check (origin/main `36f3d4c8` 기준 실측)** — 본 task 의 의도가 아직 main 에 안착하지 않았음을 확인했다 (중복 task 사고 선례 T-1859 · T-1861 차단).

- `web/src/views/adminUserMutationRunners.ts` 는 **부재** — `git ls-files web/src/views` 에 `adminUser*` 모듈이 없다.
- 이동 대상 9 선언이 모두 [AdminView.tsx](../../web/src/views/AdminView.tsx) (`4,497 행`) 에 잔류한다: `USERS_PATH` (`276 행`) · `USER_DUPLICATE_ERROR` (`335 행`) · `CREATE_USER_ERROR_SEPARATOR` (`1133 행`) · `CREATE_USER_ERROR_LINE_CLASS` (`1137 행`) · `hasCreateUserErrorLines` (`1142 행`) · `describeCreateUserFailureLines` (`1156 행`) · `describeCreateUserFailure` (`1170 행`) · `CreateUserDeps` (`1173 행`) · `runCreateUser` (`1193 행`).
- 즉 superseded · 중복이 아니다.

**경계 근거 (동반 이동 · 파일 cap 산술)** — 두 가지를 미리 실측했다.

- **`USERS_PATH` 동반 이동은 필수** 다. 이동 대상 `runCreateUser` (`1208 행`) 가 이 상수를 쓰고, 잔류 `buildUsersPath` (`869 · 871 행`) · `buildInstanceAccessPath` (`1236 행`) · `runChangeRole` (`1409 행`) 도 함께 쓴다. 새 모듈이 AdminView 를 import 하면 역방향이라 금지이므로 **상수를 새 모듈로 옮기고 AdminView 가 import** 하는 방향만 성립한다 (T-1860 의 `formatRestorePlanConfirmText` 경계 오판 재발 차단). `USER_DUPLICATE_ERROR` (`335 행`) 는 소비처가 `runCreateUser` (`1217 · 1219 행`) **뿐** 이라 (그 밖의 등장은 주석 `337 · 343 · 1150 행`) 함께 옮긴다.
- **drift-guard 영향은 1 파일** 이다. 소스 텍스트를 읽는 spec 중 [AdminView.create-user-failure.test.ts](../../web/src/views/AdminView.create-user-failure.test.ts) 만 리터럴 2 개 (`CREATE_USER_ERROR_SEPARATOR` `174~186 행` · `CREATE_USER_ERROR_LINE_CLASS` `487~493 행`) 를 AdminView 소스에서 정규식으로 뽑아 동반 갱신 대상이다. [AdminView.create-user-contract.test.ts](../../web/src/views/AdminView.create-user-contract.test.ts) (`91~92 행`) · [AdminView.instance-access-contract.test.ts](../../web/src/views/AdminView.instance-access-contract.test.ts) (`164~168 행`) · [AdminView.role-change-contract.test.ts](../../web/src/views/AdminView.role-change-contract.test.ts) (`136~138 행`) 는 controller · DTO · UserList 소스만 읽어 영향이 없고, [AdminView.users-list-contract.test.ts](../../web/src/views/AdminView.users-list-contract.test.ts) 의 `extractUsersFireMethod` (`74 행`) 는 `useApiResource<UserRow[]>(usersPath …)` **call site** 만 anchor 로 잡아 (`USERS_PATH` 는 `72 행` 주석에만 등장) 상수 이동에 영향받지 않는다 — 그래도 착수 시 실행으로 재확인한다. 그래서 총 4 파일이며 cap (≤ 5) 에 1 칸 여유가 남는다.

## Required Reading

- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) — 이동 대상 `271~276 행` (`USERS_PATH` + 선행 주석) · `332~335 행` (`USER_DUPLICATE_ERROR` + 선행 주석) · `1128~1232 행` (생성 축 연속 1 블록: 상수 2 · helper 3 · `CreateUserDeps` · `runCreateUser` + 각 선행 주석), 잔류 소비처 `865~872 행` (`buildUsersPath`) · `1234~1237 행` (`buildInstanceAccessPath`) · `1405~1412 행` (`runChangeRole` 의 role path 조립) · `3051~3071 행` (`handleCreateUser`) 과 줄 배열 렌더 분기, import 배선 `19~24 행` 및 `55~68 행` 인근, 파일 끝 test 전용 export 배럴 (`runCreateUser` · `describeCreateUserFailure` · `describeCreateUserFailureLines` · `hasCreateUserErrorLines` · `CREATE_USER_ERROR_LINE_CLASS` 항목) 과 `export type` 배럴의 `CreateUserDeps`.
- [web/src/views/adminScheduleRunners.ts](../../web/src/views/adminScheduleRunners.ts) — 직전 슬라이스가 확립한 모듈 헤더 주석의 **단방향 import 규약** 과 export 배치 선례 (본 모듈도 같은 형태로 만든다).
- [web/src/views/adminScheduleRunners.test.ts](../../web/src/views/adminScheduleRunners.test.ts) — 신규 모듈 경계 spec 의 선례 (happy / 분기 / error path / negative 번호 매김 방식).
- [web/src/views/AdminView.create-user-failure.test.ts](../../web/src/views/AdminView.create-user-failure.test.ts) — `155 행` · `451 행` 의 `readFileSync` drift-guard 두 블록과 그 안의 리터럴 정규식 · 배럴 존재 단언.
- [docs/PLAN.md](../PLAN.md) `183 행` — 부채 bullet 의 절단선 지정 · 경계 밖 심볼 (`runAdd` · `InFlightIdGate` · `createInFlightIdGate`) 명시.

## Acceptance Criteria

- [ ] `web/src/views/adminUserMutationRunners.ts` 를 신설하고 위 9 선언 (`USERS_PATH` · `USER_DUPLICATE_ERROR` · `CREATE_USER_ERROR_SEPARATOR` · `CREATE_USER_ERROR_LINE_CLASS` · `hasCreateUserErrorLines` · `describeCreateUserFailureLines` · `describeCreateUserFailure` · `CreateUserDeps` · `runCreateUser`) 을 **본문 한 줄도 바꾸지 않고** 옮긴다 (선언 앞 `export` 부착과 선행 주석 동반 이동만 허용). `grep -n "runCreateUser\|describeCreateUserFailure\|hasCreateUserErrorLines\|USER_DUPLICATE_ERROR" web/src/views/AdminView.tsx` 로 AdminView 안 **정의** 잔존이 0 임을 확인 (호출 · import · 배럴 항목은 남는다).
- [ ] 새 모듈이 `./AdminView` 를 import 하지 않는다 (역방향 0). `grep -n "from './AdminView'" web/src/views/adminUserMutationRunners.ts` 결과가 비어 있어야 한다. 외부 의존은 `../api/apiClient` (`ApiError` · `RequestOptions`) · `../api/useApiResource` (`toErrorMessage`) · `../api/signupError` (`classifySignupFailure` · `formatSignupFailure`) 에서 직접 import 한다.
- [ ] 소비처 배선을 같은 PR 에서 갈아끼운다 (CLAUDE.md §3 소비처 동반 의무) — `handleCreateUser` · 줄 배열 렌더 분기 · `buildUsersPath` · `buildInstanceAccessPath` · `runChangeRole` 이 모두 새 모듈 import 값을 쓴다. 재선언 0.
- [ ] AdminView 파일 끝 배럴이 값 5 개 (`runCreateUser` · `describeCreateUserFailure` · `describeCreateUserFailureLines` · `hasCreateUserErrorLines` · `CREATE_USER_ERROR_LINE_CLASS`) 와 `CreateUserDeps` 타입을 그대로 re-export 해 **공개 표면 무변경** — 기존 spec 의 `from './AdminView'` 가 무수정으로 통과한다.
- [ ] `web/src/views/adminUserMutationRunners.test.ts` 신규 경계 spec (R-112 4 종, 모듈 **직접 import** 경로로 검증):
  - [ ] happy-path — `runCreateUser` 가 `POST /api/users` 를 1 회 발사하고 body 가 `{ email, password }` 이며 성공 시 `bumpRefresh` · `resetInput` 를 호출한다. `describeCreateUserFailureLines` 가 400 이 아닌 입력에 대해 `toErrorMessage` 1 줄을 돌려준다.
  - [ ] error path — 주입 `create` 가 reject 하면 throw 없이 `setCreateError` 로 문구를 표면화하고 `finally` 가 `setCreating(false)` 를 보장한다.
  - [ ] 분기 — 409 (`isConflict` true) 는 `USER_DUPLICATE_ERROR` 1 줄, 400 (`ApiError`) 은 축별 사유 줄들, 그 외는 `describeError` 파생 1 줄로 갈린다 (`describeErrorLines` 주입 유무 분기 포함).
  - [ ] negative 충분 cover (예외 상황 분기마다 1+) — ① 빈 email · ② 빈 password 면 미발사 · state 전이 0, ③ `creating: true` 재호출 시 이중 POST 0, ④ `hasCreateUserErrorLines` 가 `undefined` · 비배열 · 빈 배열에 throw 0 으로 false, ⑤ 실패 경로에서 `bumpRefresh` · `resetInput` 이 호출되지 않음 (실패를 성공으로 오인 0), ⑥ `describeError` 가 실패 1 회당 정확히 1 회만 호출됨 (줄 배열 fallback 이 중복 호출하지 않음).
- [ ] [AdminView.create-user-failure.test.ts](../../web/src/views/AdminView.create-user-failure.test.ts) 의 리터럴 대조 2 곳이 새 모듈 소스를 읽도록 pointer 만 갱신하고 **단언 내용은 불변** — `CREATE_USER_ERROR_SEPARATOR` 가 AppShell 의 `SETUP_ERROR_SEPARATOR` 와 같은 값이라는 계약, `CREATE_USER_ERROR_LINE_CLASS` 토큰 값 고정이 그대로 red 로 잡힌다. `runCreateUser(...)` 배선 · 렌더 분기 · 배럴 존재 단언은 AdminView 소스를 계속 읽는다 (대상이 잔류하므로 무수정).
- [ ] [AdminView.users-list-contract.test.ts](../../web/src/views/AdminView.users-list-contract.test.ts) 가 무수정으로 통과함을 실행으로 재확인한다 (`USERS_PATH` 이동 영향 없음 검증). 만약 red 면 5 번째 파일 슬롯으로 pointer 만 갱신한다.
- [ ] `pnpm --filter web lint && pnpm --filter web build` 통과 (web workspace 스크립트명이 다르면 저장소 실제 스크립트를 따른다).
- [ ] `pnpm test` 통과 — 기존 사용자 축 spec 5 개 (`AdminView.create-user-contract` · `AdminView.create-user-failure` · `AdminView.role-change-contract` · `AdminView.instance-access-contract` · `AdminView.users-list-contract`) 와 `AdminView.test.tsx` 가 모두 green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] AdminView.tsx 의 `wc -l` 감소분을 PR 본문에 실측으로 적는다 (`4,497` → 측정값).

## Out of Scope

- **권한 · 역할 축 10 심볼 (`1234~1426 행`)** 이동 — `buildInstanceAccessPath` · `InstanceAccessFormInput` · `InstanceAccessFormFlags` · `deriveInstanceAccessFormFlags` · `GrantInstanceAccessDeps` · `runGrantInstanceAccess` · `RevokeInstanceAccessDeps` · `runRevokeInstanceAccess` · `ChangeRoleDeps` · `runChangeRole` 은 다음 slice 책임. 본 slice 는 이들이 새 모듈의 `USERS_PATH` 를 import 하도록 배선만 한다.
- 경계 밖 심볼 — 위쪽 `runAdd` (`1089 행`, 멤버십 축) 와 아래쪽 `InFlightIdGate` (`1430 행`) · `createInFlightIdGate` (`1442 행`) (컨테이너 소유 범용 gate) 는 건드리지 않는다.
- 이동 심볼의 **본문 · 주석 문구 수정** — `USERS_PATH` 선행 주석의 stale 한 서술 ("생성 · 역할 변경 slice 가 아직 없어…") 정정 포함. 순수 추출 (b) 조건 유지를 위해 글자 그대로 옮긴다 (정정은 Follow-ups).
- 기존 spec 의 `from './AdminView'` import 경로 재작성 (배럴 재수출로 무수정 통과 — 불필요한 diff 금지).
- 새 helper 신설 · 러너 시그니처 변경 · state 구조 변경 · 렌더 마크업 변경.
- [docs/PLAN.md](../PLAN.md) `183 행` 실측 LOC 갱신 (direct task 소관 — 본 PR 에서 문서 수정 금지).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- `USERS_PATH` 선행 주석의 stale 서술 정정 (생성 · 역할 변경 slice 가 이미 존재하므로) — 다음 사용자 축 slice 에 묶어 처리.
