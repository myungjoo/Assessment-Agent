---
id: T-1891
title: AdminView 사용자 관리 축 슬라이스 ① — 사용자 조회 + 생성 배선(`1170 행` ~ `1227 행`, 58 줄)을 useAdminUsers hook 으로 순수 추출
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-044, REQ-045]
independentStream: adminview-god-component-refactor
dependsOn: [T-1890]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/useAdminUsers.ts
  - web/src/views/useAdminUsers.test.ts
  - web/src/views/AdminView.users-list-contract.test.ts
  - web/src/views/AdminView.create-user-failure.test.ts
estimatedDiff: 430
estimatedFiles: 5
sizeExempt: true
exemptReason: "pure-extraction — (a) 동작 변경 0: `1170 행` ~ `1227 행` 한 구역(사용자 재조회 nonce · 조회 path · `useApiResource<UserRow[]>` 조회 · 생성 입력 4 상태 · `handleCreateUser`)을 선행 주석까지 통째로 새 hook 모듈로 옮기고, 새로 쓰는 것은 `export function useAdminUsers()` 시그니처와 반환 object literal · AdminView 의 destructure 배선뿐이며 분기 0. (b) 신규 로직 0 LOC: `buildUsersPath(usersRefreshNonce)` useMemo · `runCreateUser(...)` 주입 키 12 개 · `useCallback` deps 배열까지 본문 무변경 이동. (c) 기존 spec 무수정 통과 — 렌더 spec 은 `vi.mock('../api/useApiResource')` 가 모듈 단위라 hook 모듈 import 에도 그대로 적용돼 회귀 0 이고, 소스 텍스트 anchor 를 옮겨야 하는 drift-guard 는 census 실측 2 파일뿐이다(pointer 만 교체, 계약 문장 무변경). 이동 58 줄이 삭제 · 추가로 이중 계상될 뿐 위험도에 비례하지 않는다. 파일 수 5 로 파일 cap (≤ 5) 준수."
created: 2026-09-04
plannerNote: "P6 / PLAN 183 행 AdminView 부채 경로 1 여섯째 슬라이스 — 사용자 관리 축 2 분할 중 ① 조회+생성, head 3db0d632 재실측 · drift-guard 2 건 pointer 동반"
---

# T-1891 — AdminView 사용자 조회 + 생성 배선을 useAdminUsers hook 으로 순수 추출

## Why

[docs/PLAN.md](../PLAN.md) `183 행` 의 AdminView god component 부채 bullet 이 지목한 **경로 1(prelude 축 → custom hook)** 의 여섯째 슬라이스다. 그 bullet 은 잔여 4 축 중 **⑧ 사용자 관리 축(`1170 행` ~ `1322 행`, 153 줄)을 다음 대상으로 지목하면서 반드시 2 슬라이스로 나누라**고 못 박았다 — 조회 · 생성 · 역할 변경이 `usersRefreshNonce` 를 공유해 한 덩어리지만 셋을 함께 옮기면 pointer 를 갱신해야 하는 drift-guard 가 3 건이 되어 총 6 파일로 파일 cap (≤ 5) 을 넘기기 때문이다. 본 task 는 그 절단의 **① 조회 + 생성** 이며, ② 역할 변경 + 인스턴스 접근은 같은 hook 모듈로 합류하는 후속 슬라이스다.

**issue-still-relevant pre-check 결과** (CLAUDE.md §Pre-check, head `3db0d632` 기준 실측):

1. **목적지 모듈 미존재** — `git ls-tree origin/main web/src/views/` 에 `useAdminUsers.ts` 가 없다(현존 hook 모듈은 `useAdminCollectionTargets` · `useAdminImportExport` · `useAdminLlmProviders` · `useAdminSchedule` · `useAdminServiceIdentities` 5 개). 본 축은 아직 AdminView 본문에 그대로 있다.
2. **좌표 재실측** — bullet 이 적은 `1170 행` ~ `1227 행` 이 현 head 에서도 정확하다: `1170 행` 이 축 선행 주석 시작, `1180 행` `usersRefreshNonce` 선언, `1182 행` `usersPath` useMemo, `1188 행` ~ `1191 행` `useApiResource<UserRow[]>(usersPath)`, `1194 행` ~ `1205 행` 생성 입력 · in-flight · 실패 문구 4 상태, `1207 행` ~ `1227 행` `handleCreateUser`. `1229 행` 부터가 슬라이스 ② 의 역할 변경 축이라 절단면이 깨끗하다.
3. **anchor census 재실행** (bullet `(i)` 지시대로) — `grep -rl "AdminView.tsx" web/src --include=*.test.*` 결과 **16 파일**이고, 그중 본 축 심볼을 **호출식 정규식**으로 잡는 것은 `AdminView.users-list-contract.test.ts`(`/useApiResource<UserRow\[\]>\(\s*(usersPath[^)]*)\)/`) 와 `AdminView.create-user-failure.test.ts`(`/runCreateUser\(\s*userEmailInput,\s*userPasswordInput,\s*\{...\}\)/`) **2 건**이다. `AdminView.test.tsx` 의 소스 가드 3 건은 각각 `handleChangeRole` 블록(슬라이스 ②) · 인스턴스 접근 markup(슬라이스 ②) · 사용자 섹션 JSX markup(이동 없음)이라 본 슬라이스에서는 **무수정 통과**한다.
4. **배럴은 건드리지 않는다** — `2410 행` 이하 배럴은 `export { ... };` 형태(재수출 `from` 이 아님)라 `buildUsersPath` · `runCreateUser` · `describeCreateUserFailure` · `describeCreateUserFailureLines` 의 import 줄(`66 행` ~ `70 행` · `306 행`)이 그대로 남아야 한다. 그래서 AdminView 의 import 블록 · 배럴 · 공개 표면은 **한 줄도 바뀌지 않고**, `create-user-failure.test.ts` 의 `expect(source).toContain('\n  describeCreateUserFailure,\n')` 도 그대로 green 이다.

## Required Reading

- [docs/PLAN.md](../PLAN.md) `183 행` — 부채 bullet 의 절단 지시 · 순수 추출 3 조건 판정 · 파일 cap anchor census 방법 `(i)` ~ `(iv)`
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) `1170 행` ~ `1227 행`(이동 대상) · `1229 행` ~ `1270 행`(잔류 역할 변경 축의 `setUsersRefreshNonce` 소비) · `1790 행` ~ `1890 행`(사용자 섹션 JSX 소비처) · `2410 행` 이하 배럴
- [web/src/views/useAdminSchedule.ts](../../web/src/views/useAdminSchedule.ts) — 직전 슬라이스(T-1889)가 세운 hook 모듈 규약(머리말 주석 · 파라미터 object · 반환 표면 캡슐화 · 배럴 미등록)
- [web/src/views/useAdminSchedule.test.ts](../../web/src/views/useAdminSchedule.test.ts) — hook spec 규약(happy / error / branch / negative 구성 선례)
- [web/src/views/AdminView.users-list-contract.test.ts](../../web/src/views/AdminView.users-list-contract.test.ts) `70 행` ~ `112 행` — `ADMIN_VIEW_SOURCE` 호출식 anchor 지점
- [web/src/views/AdminView.create-user-failure.test.ts](../../web/src/views/AdminView.create-user-failure.test.ts) `155 행` ~ `180 행` — `runCreateUser(...)` 호출식 anchor 지점
- [web/src/views/adminUserMutationRunners.ts](../../web/src/views/adminUserMutationRunners.ts) — `runCreateUser` 시그니처(주입 키 무변경 확인용)

## Acceptance Criteria

- [ ] `web/src/views/useAdminUsers.ts` 신설 — `1170 행` ~ `1227 행` 의 선행 주석 · 6 선언(`usersRefreshNonce` state · `usersPath` useMemo · `useApiResource<UserRow[]>` 조회 · 생성 입력 2 상태 · in-flight · 실패 문구 2 상태 · `handleCreateUser`)을 **본문 한 글자도 바꾸지 않고** 옮긴다. 파라미터는 없다(축 밖 의존 0 — 모든 참조가 모듈 최상위 import 로 해결된다).
- [ ] 반환 표면은 JSX 소비처와 잔류 축이 실제로 쓰는 것만 공개한다: `usersData` · `userLoading` · `userError` · `userEmailInput` · `setUserEmailInput` · `userPasswordInput` · `setUserPasswordInput` · `creatingUser` · `createUserError` · `createUserErrorLines` · `handleCreateUser`, 그리고 잔류 `handleChangeRole` 의 `bumpRefresh: () => setUsersRefreshNonce((n) => n + 1)` 를 **글자-동일**로 유지하기 위한 `setUsersRefreshNonce` (슬라이스 ② 가 흡수할 한시적 노출임을 주석으로 박제). `usersPath` 등 내부 값은 노출하지 않는다.
- [ ] `AdminView.tsx` 는 해당 구역을 `const { ... } = useAdminUsers();` destructure 로 대체한다 — **소비처 동반**: 사용자 섹션 JSX(`1790 행` ~ `1890 행`)가 destructure 한 값을 즉시 되돌려 쓰므로 hook 단독 슬라이스가 아니다(CLAUDE.md §3 slice 하한 충족).
- [ ] `AdminView.tsx` 의 import 블록 · 배럴 `export { ... };` 목록 · JSX markup 은 `useAdminUsers` import 1 줄 추가를 제외하고 **무변경**(공개 표면 회귀 0).
- [ ] `web/src/views/useAdminUsers.test.ts` 신설 — happy-path: `useAdminUsers()` 초기 반환이 조회 결과 · 빈 입력 · `creatingUser=false` · `createUserError=undefined` 를 그대로 노출하고 `handleCreateUser` 가 정상 입력에서 `runCreateUser` 경로로 생성 성공 후 입력을 비우고 nonce 를 +1 한다.
- [ ] 같은 spec 의 error path 1+ — 생성 요청이 실패(`ApiError` 400 / 409 / 네트워크 throw)했을 때 `createUserError` · `createUserErrorLines` 가 채워지고 `creatingUser` 가 false 로 되돌아오며 throw 가 밖으로 새지 않는다.
- [ ] 같은 spec 의 branch cover — (1) `usersRefreshNonce === 0` 분기와 `> 0` 분기가 각각 `buildUsersPath` 로 다른 경로 문자열을 만든다, (2) `creatingUser === true` 인 in-flight 재진입이 러너를 두 번 호출하지 않는다, (3) 조회 응답이 배열 / undefined 인 두 경우 반환이 각각 어떻게 보이는지.
- [ ] 같은 spec 의 negative cases **충분 cover** — 예외 분기마다 1+: 빈 이메일 · 빈 비밀번호 입력, 409 중복 이메일, 비배열 payload(객체 · null · 문자열) 조회 응답, in-flight 중복 클릭, 비밀번호 문자열이 실패 문구에 섞이지 않음(secret 누출 0). 단일 negative 로 끝내지 않는다.
- [ ] `AdminView.users-list-contract.test.ts` 의 호출식 anchor pointer 를 `useAdminUsers.ts` 소스로 옮긴다 — **계약 문장 · `it` 제목 · 단언 의미는 무변경**이고 읽는 파일만 바뀐다. `buildUsersPath` 를 `./AdminView` 배럴에서 import 하는 줄은 그대로 둔다.
- [ ] `AdminView.create-user-failure.test.ts` 의 `runCreateUser(userEmailInput, userPasswordInput, {...})` 정규식이 읽는 소스를 `useAdminUsers.ts` 로 옮긴다 — 주입 키 단언(`describeError: describeCreateUserFailure` 존재 · `describeError: toErrorMessage` 부재 등)은 그대로 유지한다.
- [ ] `cd web && pnpm lint && pnpm build && pnpm test` 전부 통과 — 특히 `AdminView.test.tsx` 의 소스 가드 3 건과 사용자 섹션 렌더 test 가 **무수정 green**(렌더 계약 회귀 0).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 `useAdminUsers.ts` 포함.
- [ ] `git diff --stat` 이 위 `touchesFiles` 5 개만 보고하고, `wc -l web/src/views/AdminView.tsx` 가 **약 `-50 줄`**(이동 58 − hook 호출 · import 증가분) 줄어든 값을 보인다.

## Out of Scope

- **슬라이스 ②(역할 변경 + 인스턴스 접근, `1229 행` ~ `1322 행`)** — 본 task 에서 옮기지 않는다. `AdminView.test.tsx` 의 `handleChangeRole` · 인스턴스 접근 anchor 는 손대지 않는다(건드리면 파일 cap 초과).
- **JSX return(`1502 행` ~ `2408 행`) 의 하위 컴포넌트화** — PLAN 이 판정한 경로 2 이며 순수 추출 3 조건 미충족이라 별도 슬라이스다.
- 잔여 3 축(① 그룹 · 멤버십, ② 인원, ⑦ 파트) hook 화.
- `adminUserMutationRunners.ts` · `UserList` 컴포넌트 · backend `user.controller.ts` 수정.
- `AdminView` 배럴 목록 변경, `useAdminUsers` 를 배럴에 추가하는 것(공개 표면 무변경이 순수 추출의 전제).
- 옮기는 김에 하는 리팩터(주석 정리 · 변수명 개선 · deps 배열 최적화 · 상태 병합) — 순수 추출 조건 (b) 를 깬다.
- [docs/PLAN.md](../PLAN.md) `183 행` 실측 갱신 — 머지 후 별도 `direct` task.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 적는다.)

**planner 가 미리 박제한 후속 절단면** (본 슬라이스 Out of Scope, 착수 순서 제안):

1. **사용자 관리 축 슬라이스 ②(`pr`)** — 역할 변경 + 인스턴스 접근(`1229 행` ~ `1322 행`, 약 94 줄)을 같은 `useAdminUsers.ts` 로 합류시키고, 본 슬라이스가 한시적으로 노출한 `setUsersRefreshNonce` 를 그때 반환 표면에서 내린다. `AdminView.test.tsx` 의 `const handleChangeRole = useCallback(` 블록 anchor 1 건만 pointer 교체 → AdminView.tsx + hook + hook spec + `AdminView.test.tsx` = **4 파일**.
2. **PLAN `183 행` 재실측 `direct` 슬라이스** — 두 슬라이스 머지 후 LOC · 4 구역 좌표 · prelude 축 인벤토리를 다시 재고, 소진된 ⑧ 축을 목록에서 지운다.

## 완료 기록

- **완료 시각**: 2026-09-04T14:55:03Z (PR [#1478](https://github.com/myungjoo/Assessment-Agent/pull/1478) squash merge → main [`4681918a`](https://github.com/myungjoo/Assessment-Agent/commit/4681918a))
- **결과 요약**: `1170 행` ~ `1227 행` 의 7 선언(재조회 nonce state · `buildUsersPath` useMemo · `useApiResource<UserRow[]>` 조회 · 생성 입력 4 상태 · `handleCreateUser`)을 deps 배열 · `runCreateUser` 주입 키 12 개까지 글자-동일로 신규 [useAdminUsers.ts](../../web/src/views/useAdminUsers.ts) 로 이동하고, AdminView 는 destructure 배선으로 소비한다. 5 파일 `+672/-66`, **AdminView.tsx 2,542 → 2,507 줄**(-35). 신규 colocated spec 17 케이스(happy 5 · error 3 · branch 4 · negative 5)로 R-112 4 종 cover, web vitest 136 파일 4,007 test green. 배럴 · JSX markup 무변경(미사용이 된 `UserRow` type import 1 줄만 `noUnusedLocals` 대응으로 정리 — 배럴 미등록이라 공개 표면 회귀 0, T-1886/T-1887 선례 동형). drift-guard 2 건(`AdminView.users-list-contract.test.ts` · `AdminView.create-user-failure.test.ts`)은 anchor pointer 만 교체하고 계약 문장은 무변경.
- **4-게이트**: reviewer VERDICT=APPROVE comment 외부 존재(driver 가 `gh pr view --json comments` 로 재확인) · PR CI green(head `2265d6c7` run success) · integrator 자체 점검 통과 → **round 1** 머지.
- **실측 편차 1 건**: 순 감소가 task 예상 "약 -50 줄" 이 아니라 **-35 줄**. 이동 자체는 58 줄이지만 배선 주석 6 + destructure 15 + import 4 가 AdminView 에 되돌아온다 — 후속 슬라이스 ② 의 기대치 산정 시 이 되돌아오는 상수(약 25 줄)를 감안한다.
