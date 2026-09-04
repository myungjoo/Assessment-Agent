---
id: T-1895
title: AdminView ② 인원 축 중 생성·수정 배선(`537 행` ~ `586 행` · `738 행` ~ `849 행`, 162 줄)을 useAdminPersons hook 으로 합류 추출
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-026]
independentStream: adminview-god-component-refactor
dependsOn: [T-1894]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/useAdminPersons.ts
  - web/src/views/useAdminPersons.test.ts
  - web/src/views/AdminView.person-create-identity-autoselect.test.tsx
  - web/src/views/AdminView.person-update-identity-autoselect.test.tsx
estimatedDiff: 900
estimatedFiles: 5
sizeExempt: true
exemptReason: "pure-extraction — (a) 동작 변경 0: 인원 축 잔여 2 조각(`537 행` ~ `586 행` 생성 2 input · in-flight · 실패 문구 · `handleCreatePerson` / `738 행` ~ `849 행` 편집 대상 id · 편집 3 input · 원본 스냅샷 · in-flight · 실패 문구 · `resetEditPersonForm` · `handleEditPerson` · `handleCancelEditPerson` · `handleUpdatePerson`)을 선행 주석까지 통째로 기존 `useAdminPersons` 모듈로 합류시키고, 새로 쓰는 것은 hook 시그니처 2 번째 파라미터와 반환 object literal 확장 · AdminView 의 destructure 배선뿐이며 분기 0. (b) 신규 로직 0 LOC: `runCreatePerson` · `buildPersonPatch` · `runUpdatePerson` 주입 키와 `useCallback` deps 배열을 글자-동일 이동하고, 파라미터명을 `setSelectedIdentityPersonId` 로 유지해 `onCreated:` · `onUpdated:` 두 줄까지 무변경으로 옮긴다. (c) 기존 spec 무수정 통과 — 렌더 spec 은 path 라우팅이라 회귀 0 이고, 소스 텍스트 anchor 를 옮겨야 하는 drift-guard 는 census 실측 2 파일뿐이다(pointer 만 교체, 계약 문장 무변경). 이동 162 줄이 삭제 · 추가로 이중 계상될 뿐 위험도에 비례하지 않는다. 파일 수 5 로 파일 cap (≤ 5) 준수."
created: 2026-09-05
plannerNote: "P6 / PLAN 183 행 AdminView 부채 경로 1 열째 슬라이스 — T-1894 가 명시 지목한 ② 인원 생성·수정 합류, head ad60b52e 재실측 · hook 호출 2 개 순서 교환 동반"
---

# T-1895 — AdminView 인원 생성·수정 배선을 useAdminPersons hook 으로 합류 추출

## Why

[docs/PLAN.md](../PLAN.md) `183 행` AdminView god component 부채 bullet 이 지목한 **경로 1(prelude 축 → custom hook)** 의 열째 슬라이스이며, 직전 슬라이스 [T-1894](T-1894-adminview-persons-query-delete-hook-extract.md) 의 `Out of Scope` 첫 항목이 후속으로 **명시 지목**한 바로 그 절단면이다("인원 축의 생성 · 수정 조각 이동 — 후속 슬라이스(같은 `useAdminPersons` 모듈로 합류, autoselect drift-guard 2 건 pointer 동반, 5 파일)"). 본 슬라이스가 끝나면 ② 인원 축이 소진되고 prelude 잔여는 ① 그룹 · 멤버십 축 하나만 남는다. AdminView 는 현재 **2,217 줄**이라 목표선 ≤ 2,000 줄까지 잔여 `-217 줄` 이고, 본 슬라이스의 기대 순 감소는 `-130 줄` 안팎이다.

**issue-still-relevant pre-check 결과** ([.claude/agents/planner.md](../../.claude/agents/planner.md) `§Pre-check: issue-still-relevant`, head `ad60b52e`(== `origin/main`, 작업트리 clean) 기준 실측):

1. **동일 의도 미안착** — `git grep "handleCreatePerson\|handleUpdatePerson" -- web/src/views/useAdminPersons.ts` **0 건**. 현 `useAdminPersons.ts` 는 107 줄이고 public symbol 은 `useAdminPersons` 1 개, 반환 키는 T-1894 가 옮긴 조회 · 삭제 9 개뿐이다(`personData` · `personLoading` · `personError` · `personsIncludeInactive` · `setPersonsIncludeInactive` · `deletingPerson` · `deletePersonError` · `handleDeletePerson` · `setPersonsRefreshNonce`). 생성 · 수정 조각은 여전히 `AdminView.tsx` 본문에 있다.
2. **좌표 재실측** (T-1894 의 `Out of Scope` 가 적어둔 좌표는 그 슬라이스 이전 것이라 무효 → 현 head 로 재측정) — **(A) 생성 `537 행` ~ `586 행`**(50 줄 — `fullNameInput` · `emailInput` `540 행` ~ `541 행` · `creatingPerson` `545 행` · `createPersonError` `549 행` ~ `551 행` · `handleCreatePerson` `558 행` ~ `586 행`), **(B) 수정 `738 행` ~ `849 행`**(112 줄 — `editingPersonId` `741 행` · 편집 3 input · `editPersonOriginal` `752 행` · `updatingPerson` `758 행` · `updatePersonError` `762 행` ~ `764 행` · `resetEditPersonForm` `768 행` ~ `774 행` · `handleEditPerson` `779 행` ~ `792 행` · `handleCancelEditPerson` `798 행` ~ `804 행` · `handleUpdatePerson` `811 행` ~ `849 행`). 합 **162 줄**.
3. **축 밖 의존 실측 — 하나뿐이고 그것이 hook 호출 순서를 강제한다** — 두 조각이 밖에서 받아야 하는 값은 `setSelectedIdentityPersonId` **1 개**다(`onCreated` `582 행` · `onUpdated` `837 행`). 나머지(`request` · `toErrorMessage` · `runCreatePerson` · `buildPersonPatch` · `runUpdatePerson` · `setPersonsRefreshNonce`)는 이미 hook 안에 있거나 hook 이 소유한다. 그런데 그 setter 는 `useAdminServiceIdentities` 가 돌려주고 그 호출이 `useAdminPersons` **뒤**(`533 행`)에 있어, 파라미터로 넘기려면 **두 hook 호출 블록의 순서를 교환**해야 한다. 두 hook 사이에 데이터 의존이 없음을 확인했다 — `useAdminServiceIdentities(initialSelectedIdentityPersonId, initialEditingIdentityId)` 는 props 유래 초기값 2 개만 받고 `personData` 를 읽지 않으며, 인원 `<select>` 가 `personData` 를 쓰는 곳은 hook 밖 JSX 다. 순서 교환은 `useApiResource` 발사 순번을 (그룹 → `auth/me` → 인원 → identity) 에서 (그룹 → `auth/me` → identity → 인원) 으로 바꾸지만, T-1894 가 실측·박제한 대로 **web 의 모든 spec 은 `useApiResource` mock 을 path 로 라우팅하고 호출 순번 라우팅은 0 건**이라 회귀가 없어야 한다. 이는 본 슬라이스에서 유일하게 "이동" 이 아닌 변경이므로 AC 에서 전체 web 스위트로 실증한다.
4. **anchor census 재실행** — `grep -rl "AdminView.tsx" web/src --include=*.test.*` 결과 **13 파일**이고, 그중 본 2 조각의 심볼을 소스 텍스트로 잡는 것은 `AdminView.person-create-identity-autoselect.test.tsx`(`163 행` ~ `168 행`, `/onCreated:\s*\(personId\)\s*=>\s*setSelectedIdentityPersonId\(personId\)/`) 와 `AdminView.person-update-identity-autoselect.test.tsx`(`140 행` ~ `145 행`, `onUpdated` 동형) **2 건**뿐이다. `AdminView.test.tsx` 의 `handleEditPerson` · `editingPersonId` 언급 4 건은 모두 주석 · 렌더 마크업 검증이라 소스 anchor 가 아니고, `AdminView.persons-list-contract.test.ts` · `AdminView.persons-include-inactive.test.tsx` 는 T-1894 가 이미 hook 쪽으로 pointer 를 옮긴 조회 축 guard 라 무영향이다. 따라서 파일 수는 AdminView + hook + hook spec + guard 2 = **5 파일 = cap 정확히 소진**이며 **여유 0** 이다.
5. **barrel 재수출 무영향** — `AdminView.tsx` 의 인원 러너 import(`278 행` ~ `291 행`)와 파일 말미 배럴 재수출(`2122 행` · `2154 행` ~ `2160 행` · `2189 행` ~ `2211 행`)은 본 슬라이스가 건드리지 않는다. T-1894 가 `runDeletePerson` 호출을 옮기고도 import 를 남긴 선례와 동형이다(배럴이 소비처).

## Required Reading

- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) — 이동 대상 2 조각(`537 행` ~ `586 행` · `738 행` ~ `849 행`), 순서를 교환할 hook 호출 2 블록(`482 행` ~ `500 행` 인원 · `502 행` ~ `535 행` identity), 잔류 소비처(인원 관리 JSX `1600 행` ~ `1700 행` 부근).
- [web/src/views/useAdminPersons.ts](../../web/src/views/useAdminPersons.ts) — 합류 목적지. 현 시그니처 `useAdminPersons(initialPersonsIncludeInactive: boolean)` 와 반환 object literal.
- [web/src/views/useAdminPersons.test.ts](../../web/src/views/useAdminPersons.test.ts) — 확장할 colocated spec(현 24 케이스).
- [web/src/views/adminPersonMutationRunners.ts](../../web/src/views/adminPersonMutationRunners.ts) — `runCreatePerson` · `buildPersonPatch` · `runUpdatePerson` 의 deps 계약(주입 키 이름 확인용, **수정 금지**).
- [web/src/views/AdminView.person-create-identity-autoselect.test.tsx](../../web/src/views/AdminView.person-create-identity-autoselect.test.tsx) — `159 행` ~ `170 행` 배선 guard.
- [web/src/views/AdminView.person-update-identity-autoselect.test.tsx](../../web/src/views/AdminView.person-update-identity-autoselect.test.tsx) — `136 행` ~ `147 행` 배선 guard.
- [web/src/views/useAdminUsers.ts](../../web/src/views/useAdminUsers.ts) — 합류 추출 선례([T-1892](T-1892-adminview-users-role-access-hook-extract.md) 가 2 차 조각을 같은 모듈로 합류시키며 한시 노출 setter 를 반환 표면에서 내린 패턴).

## Acceptance Criteria

- [ ] `web/src/views/useAdminPersons.ts` 가 위 2 조각을 **본문 무변경**으로 흡수한다 — state 선언 · `useCallback` 본문 · deps 배열 · `runCreatePerson` / `runUpdatePerson` 주입 키를 글자-동일 이동하고, 선행 주석도 함께 옮긴다. 새로 쓰는 것은 시그니처 2 번째 파라미터와 반환 키 확장뿐이다.
- [ ] hook 시그니처가 `useAdminPersons(initialPersonsIncludeInactive: boolean, setSelectedIdentityPersonId: (personId: string) => void)` 이다 — 파라미터명을 유지해 `onCreated:` · `onUpdated:` 두 줄을 무변경으로 옮긴다.
- [ ] `AdminView.tsx` 에서 `useAdminServiceIdentities(...)` 호출 블록을 `useAdminPersons(...)` 호출 블록 **앞**으로 옮기고, 두 블록의 선행 주석에서 "호출 위치를 이 자리 그대로 둔다 / 인원 조회 직후 그대로 두어야 한다"는 서술을 실제 순서와 정합하게 정정한다(계약 문장이 아니라 사실 서술이므로 정정 대상).
- [ ] `setPersonsRefreshNonce` 를 hook 반환 표면에서 **내린다** — 마지막 소비처(생성 · 수정 핸들러의 `bumpRefresh`)가 hook 안으로 들어오므로 한시 노출이 끝난다([T-1892](T-1892-adminview-users-role-access-hook-extract.md) 의 `setUsersRefreshNonce` 선례). `git grep "setPersonsRefreshNonce" -- web/src/views/AdminView.tsx` 가 **0 건**임을 확인한다.
- [ ] happy-path unit test — `useAdminPersons.test.ts` 에 새 반환 심볼(`handleCreatePerson` · `handleEditPerson` · `handleCancelEditPerson` · `handleUpdatePerson` · `resetEditPersonForm` 과 노출 state)의 정상 경로 test 각 1+ 추가(생성 성공 시 2 입력 초기화 + 재조회 + `setSelectedIdentityPersonId` 호출, 수정 성공 시 변경 필드만 PATCH + 편집 종료 + 재조회).
- [ ] error path unit test — 생성 POST 실패 · 수정 PATCH 실패 각각에서 실패 문구가 세팅되고 **throw 되지 않으며** in-flight 가 해제되는 test 각 1+.
- [ ] branch/flow test — 분기마다 test 를 나눈다: `handleEditPerson` 의 `personData` 매칭 성공 / 매칭 실패(early return), `handleCancelEditPerson` 의 `updatingPerson` true(취소 억제) / false(리셋), `buildPersonPatch` 결과가 변경 필드 0 인 경로 / 1+ 인 경로.
- [ ] negative cases 충분 cover — 예외 상황 각 1+ test: 빈 · 공백 `fullName` · `email` 발사 억제, in-flight 중 재발사 억제(생성 · 수정 각각), 빈 · falsy `editingPersonId` 발사 억제, 변경 필드 0 발사 억제, `personData` 가 `undefined` · 빈 배열일 때 `handleEditPerson` no-op, 실패 후 재시도 시작 시 이전 error 정리.
- [ ] `AdminView.person-create-identity-autoselect.test.tsx` · `AdminView.person-update-identity-autoselect.test.tsx` 의 배선 guard 는 **pointer 만 교체**한다 — 읽는 소스를 `./useAdminPersons.ts` 로 바꾸고, 같은 guard 에 "AdminView 가 `setSelectedIdentityPersonId` 를 `useAdminPersons(` 인자로 넘긴다" 는 AdminView 쪽 assertion 1 개를 더해 end-to-end 계약을 잠근다. 기존 계약 문장(정규식 본문)은 바꾸지 않는다.
- [ ] `pnpm --dir web lint && pnpm --dir web build && pnpm --dir web test` 통과 — 위 2 건 외 기존 spec **무수정** 통과(특히 hook 호출 순서 교환으로 깨지는 spec 0 건임을 전체 스위트로 실증). 깨지는 spec 이 나오면 계약 문장을 고치지 말고 즉시 멈춰 `Follow-ups` 에 적고 planner 에게 넘긴다.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `wc -l web/src/views/AdminView.tsx` 로 LOC 감소를 확인하고 그 수치를 PR 본문에 적는다 (2,217 기준, 기대 `-130 줄` 안팎).

## Out of Scope

- ① 그룹 · 멤버십 축 이동 — prelude 잔여 마지막 축으로 후속 슬라이스.
- JSX return 의 하위 컴포넌트화(경로 2) — 순수 추출 3 조건 미충족이라 별도 절단 기준을 따른다.
- [web/src/views/adminPersonMutationRunners.ts](../../web/src/views/adminPersonMutationRunners.ts) 의 러너 · deps 계약 수정, 배럴 재수출 표면 변경, `AdminView.tsx` 상단 import 정리.
- [docs/PLAN.md](../PLAN.md) `183 행` bullet 의 실측 갱신 — `direct` 대상이라 본 `pr` task 에 섞지 않는다 (CLAUDE.md §3.1 판정 규칙 3).
- 이동 대상 코드의 동작 · 문구 · deps 배열 변경, 새 dependency 추가, 인원 축 UX 개선.
- 위 AC 가 지목한 2 블록 선행 주석 정정 외의 주석 정리 · 리네이밍.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

## 결과 (2026-09-04 22:59Z 완료)

- **DONE** (`pr`, PR [#1482](https://github.com/myungjoo/Assessment-Agent/pull/1482) → main [`2c3fbf24`](https://github.com/myungjoo/Assessment-Agent/commit/2c3fbf24)). round 1 squash merge.
- 인원 생성·수정 2 조각(162 줄)을 기존 `web/src/views/useAdminPersons.ts`(107 → 301 줄) 로 **합류** — state 선언 · `useCallback` 본문 · deps 배열 · `runCreatePerson` / `buildPersonPatch` / `runUpdatePerson` 주입 키를 글자-동일 이동하고 `onCreated:` · `onUpdated:` 두 줄까지 무변경 유지. 새로 쓴 것은 시그니처 2 번째 파라미터(`setSelectedIdentityPersonId`) 와 반환 키 확장뿐.
- `useAdminServiceIdentities` 호출 블록을 `useAdminPersons` 앞으로 교환 — 본 슬라이스의 유일한 "이동 아닌 변경" 이며, `useApiResource` 발사 순번만 바뀌고 web 전체 스위트로 회귀 0 을 실증했다(spec 이 전부 path 라우팅).
- `setPersonsRefreshNonce` 한시 노출 종료 — hook 반환 표면에서 내렸고 `AdminView.tsx` grep 0 건.
- **AdminView.tsx 2,217 → 2,080 줄(-137)**. 5 파일 `+969/-237`. 목표선 ≤ 2,000 까지 잔여 `-80 줄`.
- spec 24 → 53 케이스로 확장해 R-112 4 종 cover(happy · error · 분기 · negative 충분). web 138 파일 4,111 test green, backend 466 suite 13,495 test + `coverageThreshold`(line/function ≥ 80%) 통과.
- autoselect drift-guard 2 건은 pointer 만 교체하고 AdminView 인자 assertion 1 개씩을 더해 end-to-end 계약을 잠갔다(기존 정규식 본문 무변경).
- 4-게이트 실측 — reviewer VERDICT=APPROVE comment 외부 존재 · PR CI success(기본 검사 · 배포 산출물 검증) · integrator 자체 점검 통과 · CI green.
