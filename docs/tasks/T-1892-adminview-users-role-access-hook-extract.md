---
id: T-1892
title: AdminView 사용자 관리 축 슬라이스 ② — 역할 변경 + 인스턴스 접근 배선(`1194 행` ~ `1288 행`, 95 줄)을 useAdminUsers hook 으로 합류 추출
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-044, REQ-045]
independentStream: adminview-god-component-refactor
dependsOn: [T-1891]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/useAdminUsers.ts
  - web/src/views/useAdminUsers.test.ts
  - web/src/views/AdminView.test.tsx
estimatedDiff: 470
estimatedFiles: 4
sizeExempt: true
exemptReason: "pure-extraction — (a) 동작 변경 0: `1194 행` ~ `1288 행` 한 구역(역할 변경 in-flight · 실패 문구 2 상태 · `changingRoleIdRef` · `changingRoleGate` useMemo · `handleChangeRole` / 인스턴스 접근 6 상태 · grant · revoke 핸들러 2 · `deriveInstanceAccessFormFlags` 파생)을 선행 주석까지 통째로 기존 `useAdminUsers` hook 으로 옮기고, 새로 쓰는 것은 반환 object literal 에 더해지는 13 줄과 AdminView 의 destructure 배선뿐이며 분기 0. 함께 사라지는 한시적 노출(`setUsersRefreshNonce`)은 유일 소비처인 `handleChangeRole` 이 같은 모듈로 들어와 내부 참조가 되는 결과일 뿐 계약 변경이 아니다. AdminView 의 react import 에서 `useRef` 를 내리는 1 줄은 이동으로 마지막 사용처가 사라진 데 따른 import 경로 조정이라 조건 (a) 의 허용 범위다. (b) 신규 로직 0 LOC: 러너 주입 키(`changingId: changingRoleGate.read()` · `isForbidden` · `isConflict` 부재 등) · `useCallback` deps 배열 · 파생 helper 인자 4 개까지 본문 무변경 이동. (c) 기존 spec 무수정 통과 — 렌더 spec 은 `vi.mock` 이 모듈 단위라 hook 모듈에도 그대로 적용돼 회귀 0 이고, 소스 텍스트 anchor 를 옮겨야 하는 drift-guard 는 census 실측 `AdminView.test.tsx` 1 파일(2 describe 블록)뿐이다(pointer 만 교체, 계약 문장 무변경). 이동 95 줄이 삭제 · 추가로 이중 계상될 뿐 위험도에 비례하지 않는다. 파일 수 4 로 파일 cap (≤ 5) 준수."
created: 2026-09-04
plannerNote: "P6 / PLAN 183 행 AdminView 부채 경로 1 일곱째 슬라이스 — 사용자 관리 축 2 분할의 ② 역할 변경+인스턴스 접근, head 4bf0bd41 재실측 · drift-guard 1 파일"
---

# T-1892 — AdminView 역할 변경 + 인스턴스 접근 배선을 useAdminUsers hook 으로 합류 추출

## Why

[docs/PLAN.md](../PLAN.md) `183 행` 의 AdminView god component 부채 bullet 이 지목한 **경로 1(prelude 축 → custom hook)** 의 일곱째 슬라이스이자, 그 bullet 이 "반드시 2 슬라이스로 나누라" 고 못 박은 **⑧ 사용자 관리 축 절단의 ②** 다. 슬라이스 ①([T-1891](T-1891-adminview-users-query-create-hook-extract.md), 조회 + 생성)이 `useAdminUsers.ts` 를 세우면서 잔류 역할 변경 · 인스턴스 접근 핸들러의 `bumpRefresh` 를 **글자-동일**로 유지하려고 `setUsersRefreshNonce` 를 한시적으로 노출해 둔 상태다. 본 task 가 그 소비처를 같은 모듈로 흡수하면서 한시적 노출을 되돌리고 사용자 관리 축 분해를 완결한다.

**issue-still-relevant pre-check 결과** (`.claude/agents/planner.md` §Pre-check, head `4bf0bd41` 기준 실측):

1. **미안착 확인** — `web/src/views/AdminView.tsx` 에 본 축이 그대로 남아 있다: `1198 행` `changingRoleId` state, `1207 행` `changingRoleIdRef` = `useRef`, `1208 행` ~ `1211 행` `changingRoleGate` useMemo, `1218 행` `const handleChangeRole = useCallback(`, `1236 행` ~ `1244 행` 인스턴스 접근 6 상태, `1247 행` ~ `1277 행` grant · revoke 핸들러 2, `1281 행` ~ `1287 행` `deriveInstanceAccessFormFlags` 파생. `git log origin/main -8 -- web/src/views/AdminView.tsx` 의 최신 commit 은 `4681918a` (T-1891 슬라이스 ①) 이며 본 축을 옮긴 commit 은 없다.
2. **목적지 모듈 실재 + 잔여 노출 실재** — `web/src/views/useAdminUsers.ts` 는 111 줄이고 `107 행` ~ `109 행` 이 "슬라이스 ② 가 그 소비처를 흡수하면서 이 줄을 제거한다" 는 주석과 함께 `setUsersRefreshNonce` 를 반환하고 있다. 즉 본 task 는 그 주석이 예고한 잔여 작업 그대로다.
3. **좌표 재실측** — bullet 이 적은 `1229 행` ~ `1322 행` 은 슬라이스 ① 머지로 **무효**다. 현 head 의 실제 구역은 `1194 행`(역할 변경 축 선행 주석 시작) ~ `1288 행`(파생 블록 뒤 빈 줄) **95 줄**이며, `1289 행` 부터는 파트 생성 축이라 절단면이 깨끗하다.
4. **anchor census 재실행** (bullet `(i)` 지시대로) — `grep -rln "handleChangeRole|runChangeRole|instanceAccessUserId|runGrantInstanceAccess|runRevokeInstanceAccess|deriveInstanceAccessFormFlags|changingRoleGate" web/src --include=*.test.*` 는 4 파일을 보고하지만, 그중 **`AdminView.tsx` 소스를 `readFileSync` 로 읽는 drift-guard 는 `AdminView.test.tsx` 1 파일**뿐이다(`AdminView.role-change-contract.test.ts` · `AdminView.instance-access-contract.test.ts` 는 backend controller · DTO · `UserList.tsx` 만 읽고 AdminView 소스는 읽지 않으며, `adminUserMutationRunners.test.ts` 는 러너 모듈만 검증한다). 따라서 총 4 파일 = 파일 cap 이내이며 bullet 의 예측(4 파일)과 일치한다.
5. **배럴 무변경 확인** — `2433 행` 이하 배럴이 `runChangeRole` · `runGrantInstanceAccess` · `runRevokeInstanceAccess` · `deriveInstanceAccessFormFlags` · `createInFlightIdGate` 를 `export { ... };` 형태로 재수출하므로 AdminView 의 해당 import 줄(`65 행` · `69 행` ~ `72 행` · `353 행`)은 **그대로 남아야 한다**. `toErrorMessage` 도 다른 축 러너 다수가 계속 쓴다. 이동으로 마지막 사용처가 사라지는 것은 `useRef` 하나뿐이다(`18 행`).

## Required Reading

- [docs/PLAN.md](../PLAN.md) `183 행` — 부채 bullet 의 2 슬라이스 절단 지시 · 순수 추출 3 조건 판정 · 파일 cap anchor census 방법 `(i)` ~ `(iv)`
- [docs/tasks/T-1891-adminview-users-query-create-hook-extract.md](T-1891-adminview-users-query-create-hook-extract.md) — 슬라이스 ① 의 절단 규약 · `setUsersRefreshNonce` 한시 노출의 회수 조건
- [web/src/views/useAdminUsers.ts](../../web/src/views/useAdminUsers.ts) 전문(111 줄) — 머리말 주석 · 반환 표면 캡슐화 규약 · `107 행` ~ `109 행` 한시 노출
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) `1173 행` ~ `1192 행`(슬라이스 ① destructure 지점) · `1194 행` ~ `1288 행`(이동 대상) · `1815 행` ~ `1880 행`(사용자 관리 섹션 JSX 소비처) · `2425 행` ~ `2450 행`(배럴)
- [web/src/views/useAdminUsers.test.ts](../../web/src/views/useAdminUsers.test.ts) `1 행` ~ `160 행`(probe harness · `vi.hoisted` mock 규약) · `185 행`(공개 표면 단언) · `495 행`(내부 전용 값 부재 단언)
- [web/src/views/AdminView.test.tsx](../../web/src/views/AdminView.test.tsx) `9181 행` ~ `9214 행`(T-1165 역할 변경 배선 drift guard) · `9601 행` ~ `9632 행`(T-1168 인스턴스 접근 배선 drift guard)
- [web/src/views/adminUserMutationRunners.ts](../../web/src/views/adminUserMutationRunners.ts) — `runChangeRole` · `runGrantInstanceAccess` · `runRevokeInstanceAccess` 시그니처(주입 키 무변경 확인용)

## Acceptance Criteria

- [ ] `web/src/views/useAdminUsers.ts` 가 `AdminView.tsx` `1194 행` ~ `1288 행` 의 선행 주석과 12 선언(역할 변경 2 상태 · `changingRoleIdRef` · `changingRoleGate` useMemo · `handleChangeRole` / 인스턴스 접근 6 상태 · grant · revoke 핸들러 2 · `deriveInstanceAccessFormFlags` 파생)을 **본문 한 글자도 바꾸지 않고** 흡수한다. hook 파라미터는 여전히 없다(축 밖 상태 의존 0).
- [ ] 반환 표면에 JSX 소비처가 실제로 쓰는 심볼만 더한다: `changingRoleId` · `changeRoleError` · `handleChangeRole` · `instanceAccessUserId` · `setInstanceAccessUserId` · `instanceRefInput` · `setInstanceRefInput` · `instanceAccessError` · `instanceAccessNotice` · `handleGrantInstanceAccess` · `handleRevokeInstanceAccess` · `instanceAccessBusy` · `instanceAccessActionDisabled`. 내부 전용(`changingRoleIdRef` · `changingRoleGate` · `grantingInstanceAccess` · `revokingInstanceAccess` · setter 5 종)은 노출하지 않는다.
- [ ] 한시적 노출이던 `setUsersRefreshNonce` 를 반환 표면에서 **제거**하고, 그 사유를 적은 `107 행` ~ `109 행` 주석도 함께 정리한다(유일 소비처 `handleChangeRole` 이 같은 모듈 안으로 들어와 내부 참조가 됐다는 사실을 머리말 주석에 1~2 줄로 박제).
- [ ] `AdminView.tsx` 는 해당 구역을 슬라이스 ① destructure 블록의 확장으로 대체한다 — **소비처 동반**: 사용자 관리 섹션 JSX(`1815 행` ~ `1880 행`)의 `onChangeRole` · `changingRoleId` · 인스턴스 접근 폼 4 요소 · alert · notice 가 destructure 한 값을 즉시 되돌려 쓴다(hook 단독 슬라이스가 아니다 — CLAUDE.md §3 slice 하한 충족).
- [ ] `AdminView.tsx` 의 배럴 `export { ... };` 목록 · JSX markup · 러너 import 줄은 **무변경**이고, react import(`18 행`)에서 `useRef` 만 내린다(이동으로 마지막 사용처 소멸 — 다른 import 는 배럴 재수출 때문에 반드시 남긴다).
- [ ] `web/src/views/useAdminUsers.test.ts` 에 happy-path 추가 — `handleChangeRole` 이 `runChangeRole(id, nextRole, {...})` 에 주입 키 7 개(`patch: request` · `describeError: toErrorMessage` · `isForbidden` · `changingId: changingRoleGate.read()` · `setChangingId: changingRoleGate.write` · `setChangeError` · `bumpRefresh`)를 이동 전 그대로 넘기고, grant · revoke 가 각각 주입 키 8 / 7 개를 그대로 넘기며, 성공 경로에서 `instanceRefInput` 이 비워지고 notice 가 채워진다.
- [ ] 같은 spec 의 error path 1+ — 역할 변경 403(`isForbidden` 참) · 그 외 status(`toErrorMessage` 파생) 실패에서 `changeRoleError` 가 채워지고 진행 id 가 `undefined` 로 되돌아오며 throw 가 밖으로 새지 않는다. grant 409 중복 · revoke 실패에서도 `instanceAccessError` 가 채워지고 throw 0 이다.
- [ ] 같은 spec 의 branch cover — (1) `changingRoleGate.read()` 가 **호출 시점** 값이라 같은 tick 두 번째 발사가 억제된다(render 시점 캡처로 되돌아가면 fail), (2) `grantingInstanceAccess` / `revokingInstanceAccess` 두 in-flight 축이 각각 참일 때 폼 전체가 잠긴다, (3) `deriveInstanceAccessFormFlags` 진리표 4 입력(userId 빈값 · instanceRef 공백-only · granting · revoking) 이 `busy` · `actionDisabled` 로 갈리는 분기 각각, (4) revoke 에는 `isConflict` 주입이 없다는 분기 차이.
- [ ] 같은 spec 의 negative cases **충분 cover** — 예외 분기마다 1+: 빈 `instanceAccessUserId` · 공백-only `instanceRefInput` 에서 발사 0, in-flight 중 중복 클릭 이중 발사 0, 역할 변경 실패 문구가 생성 실패 문구(`createUserError`)와 섞이지 않음(별개 축 유지), grant 성공 후 notice 가 남은 상태에서 revoke 실패 시 error 가 표면화되는 상호 덮어쓰기 순서, 내부 전용 값(`changingRoleGate` · `grantingInstanceAccess` 등)이 반환 표면에 없음. 단일 negative 로 끝내지 않는다.
- [ ] 슬라이스 ① 이 남긴 공개 표면 단언 2 건(`185 행` "11 심볼 + 한시적 setUsersRefreshNonce 만 공개" · `495 행` "내부 전용 값 부재")을 확장된 반환 표면과 `setUsersRefreshNonce` 제거 사실에 맞게 갱신한다 — **단언의 의미(공개 표면 화이트리스트 + 내부 전용 값 비공개)는 그대로 유지**한다.
- [ ] `AdminView.test.tsx` 의 T-1165 역할 변경 배선 drift guard 를 pointer 만 교체한다 — `const handleChangeRole = useCallback(` 블록 anchor 는 `useAdminUsers.ts` 소스를 읽고, 렌더 표면 단언(`changingRoleId={changingRoleId}`)은 `AdminView.tsx` 소스를 그대로 읽는다. `it` 제목 · 단언 의미 무변경.
- [ ] `AdminView.test.tsx` 의 T-1168 인스턴스 접근 배선 drift guard 를 pointer 만 교체한다 — markup 단언(`disabled={instanceAccessActionDisabled}` 2 건 · `disabled={instanceAccessBusy}` 2 건)은 `AdminView.tsx` 소스, `deriveInstanceAccessFormFlags({...})` 배선 블록 단언은 `useAdminUsers.ts` 소스를 읽는다. 인라인 조건식 복귀를 막는 부정 단언 3 건은 **두 소스 모두**에 적용해 회귀 차단 범위를 좁히지 않는다.
- [ ] `cd web && pnpm lint && pnpm build && pnpm test` 전부 통과 — 특히 `AdminView.role-change-contract.test.ts` · `AdminView.instance-access-contract.test.ts` · 사용자 관리 섹션 렌더 test 가 **무수정 green**(렌더 계약 회귀 0).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 확장된 `useAdminUsers.ts` 포함.
- [ ] `git diff --stat` 이 위 `touchesFiles` 4 개만 보고하고, `wc -l web/src/views/AdminView.tsx` 가 현 2,507 줄에서 **약 `-80 줄`**(이동 95 − destructure · 주석 증가분) 줄어든 값을 보인다.

## 완료 기록

- **완료 시각**: 2026-09-04T16:58:15Z (PR [#1479](https://github.com/myungjoo/Assessment-Agent/pull/1479) squash merge → main [`bfa0a0ea`](https://github.com/myungjoo/Assessment-Agent/commit/bfa0a0ea))
- **결과 요약**: `1194 행` ~ `1288 행` 의 12 선언(역할 변경 2 상태 · `changingRoleIdRef` · `changingRoleGate` useMemo · `handleChangeRole` / 인스턴스 접근 6 상태 · grant · revoke 핸들러 2 · `deriveInstanceAccessFormFlags` 파생)을 deps 배열 · 러너 주입 키(역할 7 · grant 8 · revoke 7)까지 글자-동일로 [useAdminUsers.ts](../../web/src/views/useAdminUsers.ts) 로 합류 이동하고, AdminView 는 슬라이스 ① destructure 블록의 확장으로 소비한다. 슬라이스 ① 이 남긴 한시적 `setUsersRefreshNonce` 노출은 유일 소비처 `handleChangeRole` 이 같은 모듈로 들어오면서 **회수**됐다(예고 주석도 정리). 4 파일 `+833/-155`, **AdminView.tsx 2,507 → 2,426 줄**(-81) · `useAdminUsers.ts` 111 → 228 줄. spec 은 T-1892 describe 4 개 · 17 케이스 증설로 R-112 4 종 cover, web vitest 136 파일 4,026 test green. 배럴 · JSX markup · 러너 import 무변경이고 react import 에서 `useRef` 1 줄만 하차했다. drift-guard 2 건(T-1165 역할 변경 · T-1168 인스턴스 접근)은 anchor pointer 만 교체하고 단언 의미는 무변경(부정 단언 3 건은 두 소스 모두에 적용).
- **4-게이트**: reviewer VERDICT=APPROVE comment 외부 존재(driver 가 `gh pr view 1479 --json comments` 로 재확인) · PR CI green · integrator 자체 점검 통과 → **round 1** 머지.
- **실측 편차 0 건**: 순 감소가 task 예상 "약 -80 줄" 과 실측 **-81 줄** 로 일치했다 — 슬라이스 ① 이 박제한 "되돌아오는 상수 약 25 줄" 보정이 그대로 맞았다.

## Out of Scope

- **JSX return(`1502 행` 이하) 의 하위 컴포넌트화** — PLAN 이 판정한 경로 2 이며 순수 추출 3 조건 미충족이라 별도 슬라이스다.
- 잔여 3 축(① 그룹 · 멤버십, ② 인원, ⑦ 파트) hook 화 — 각각 별도 슬라이스.
- `adminUserMutationRunners.ts` · `adminInFlightGate` helper · `UserList` 컴포넌트 · backend `user.controller.ts` 수정.
- `AdminView` 배럴 목록 변경, `useAdminUsers` 를 배럴에 추가하는 것(공개 표면 무변경이 순수 추출의 전제).
- `AdminView.role-change-contract.test.ts` · `AdminView.instance-access-contract.test.ts` 수정 — 두 파일은 AdminView 소스를 읽지 않으므로 손댈 이유가 없다(손대면 파일 cap 초과 risk).
- 옮기는 김에 하는 리팩터(주석 정리 · 변수명 개선 · deps 배열 최적화 · 상태 병합 · grant/revoke 상태 통합) — 순수 추출 조건 (b) 를 깬다.
- [docs/PLAN.md](../PLAN.md) `183 행` 실측 갱신 — 머지 후 별도 `direct` task.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 적는다.)
