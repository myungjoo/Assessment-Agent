---
id: T-1896
title: AdminView 멤버십 축 배선(`736 행` ~ `841 행`, 106 줄)을 useAdminMemberships hook 으로 순수 추출
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-026]
independentStream: adminview-god-component-refactor
dependsOn: [T-1895]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/useAdminMemberships.ts
  - web/src/views/useAdminMemberships.test.ts
  - web/src/views/AdminView.group-members-contract.test.ts
estimatedDiff: 800
estimatedFiles: 4
sizeExempt: true
exemptReason: "pure-extraction — (a) 동작 변경 0: 멤버십 축 한 덩어리(`736 행` ~ `841 행` 의 `members` 파생 · `membersRefreshNonce` · `removing` · `removeError` · `groupMembersPath` useMemo · `useApiResource<MembershipRow[]>` 조회 · `groupMembers` 파생 · `handleRemove` · `adding` · `addError` · `handleAdd` · `addCandidates` = 12 선언)를 선행 주석까지 통째로 새 모듈로 옮기고, 새로 쓰는 것은 `function useAdminMemberships(...)` 시그니처(파라미터 3) · 반환 object literal · AdminView 의 destructure 배선뿐이며 분기 0. (b) 신규 로직 0 LOC: `runRemove` · `runAdd` 주입 키와 모든 `useMemo`/`useCallback` deps 배열을 글자-동일 이동한다. (c) 기존 spec 무수정 통과 — 렌더 spec 은 `useApiResource` mock 을 path 로 라우팅하고 JSX · 배럴은 무변경이라 회귀 0 이며, 소스 텍스트 anchor 를 옮겨야 하는 drift-guard 는 census 실측 1 파일뿐이다(pointer 만 교체, 계약 문장 무변경). 이동 106 줄이 삭제 · 추가로 이중 계상될 뿐 위험도에 비례하지 않는다. 파일 수 4 로 파일 cap (≤ 5) 준수(여유 1)."
created: 2026-09-05
plannerNote: "P6 / PLAN 183 행 AdminView 부채 경로 1 열한째 슬라이스 — T-1895 가 지목한 ① 그룹·멤버십 축 중 멤버십 조각, head acdc0d7c 재실측 2,080 줄 · 기대 -85 로 목표선 도달권"
---

# T-1896 — AdminView 멤버십 축 배선을 useAdminMemberships hook 으로 순수 추출

## Why

[docs/PLAN.md](../PLAN.md) `183 행` AdminView god component 부채 bullet 이 지목한 **경로 1(prelude 축 → custom hook)** 의 열한째 슬라이스다. 직전 슬라이스 [T-1895](T-1895-adminview-persons-create-update-hook-merge.md) 의 `Out of Scope` 첫 항목이 "① 그룹 · 멤버십 축 이동 — prelude 잔여 마지막 축으로 후속 슬라이스" 로 명시 지목했고, 본 task 는 그 마지막 축을 **멤버십 조각 먼저 / 그룹 조각 후속** 으로 갈라 앞 조각을 수행한다. AdminView 는 현재 **2,080 줄**이라 목표선 ≤ 2,000 줄까지 잔여 `-80 줄` 이고, 본 슬라이스의 기대 순 감소가 `-85 줄` 안팎이라 **목표선 도달권**이다.

**절단 근거 (멤버십 먼저인 이유)** — 잔여 축을 한 슬라이스로 묶으면 그룹 조각(`443 행` ~ `473 행` 선택 · nonce · path · 조회 + `567 행` ~ `717 행` 생성 · 삭제 · 편집 핸들러 + `734 행` `groups` 파생, 약 190 줄)까지 들어와 이동량이 300 줄에 가까워지고 anchor census 모수도 커진다. 반면 멤버십 조각은 `736 행` ~ `841 행` **106 줄 연속 블록**이고 축 밖 의존이 3 개(`groups` · `selectedGroupId` · `personData`)로 한정돼 있어, 그룹 조각을 그대로 둔 채 그 세 값을 파라미터로 받으면 자기완결이다. 그룹 축은 `selectedGroupId` 가 멤버십 · 스케줄 · 인원 등 여러 축의 입력이라 이동 시 파라미터 · 반환 표면 설계가 훨씬 넓어지므로, 좁은 조각을 먼저 걷어 다음 슬라이스의 판단 표면을 줄인다.

**issue-still-relevant pre-check 결과** ([.claude/agents/planner.md](../../.claude/agents/planner.md) `§Pre-check: issue-still-relevant`, head `acdc0d7c`(== `origin/main`, 작업트리 clean) 기준 실측):

1. **동일 의도 미안착** — `git grep -l "useAdminMemberships" origin/main -- 'web/**'` 결과 **0 건**. 목적지 모듈 [web/src/views/useAdminMemberships.ts](../../web/src/views/useAdminMemberships.ts) 는 main 에 없고, 기존 `useAdmin*` 모듈은 import/export · 수집 대상 · LLM provider · ServiceIdentity · 스케줄 · 사용자 · 파트 · 인원 8 종뿐이다.
2. **좌표 재실측** — `wc -l` 기준 AdminView.tsx **2,080 줄**(PLAN bullet 의 `2,542 줄` 은 T-1893 ~ T-1895 머지분만큼 stale — 본 task 는 좌표를 직접 재실측해 박제하고 bullet 갱신은 별도 `direct` task 로 둔다). 이동 블록의 현 좌표는 선행 주석 포함 **`736 행` ~ `841 행`**.
3. **축 밖 의존 3 개** — 블록 안에서 참조하는 값 중 모듈 최상위 import(`useApiResource` · `toErrorMessage` · `request` · `deriveMembers` · `buildGroupMembersPath` · `deriveMembersFromMemberships` · `findGroup` · `deriveAddCandidates` · `runRemove` · `runAdd` · `MembershipRow`)를 빼면 `groups`(그룹 축 파생) · `selectedGroupId`(그룹 축 state) · `personData`(`useAdminPersons` 반환) **3 개**뿐이고, 축 밖 setter 호출은 **0 건**이다.
4. **호출 순서 제약** — 블록이 돌려주는 `members` 를 `useAdminSchedule({ ... members ... })`(현 `919 행`)가 소비하므로 hook 호출은 **원 블록 자리(그룹 `groups` 파생 직후, LLM provider hook 앞)** 에 두어야 한다. 이 위치를 지키면 `useApiResource` 발사 순번도 이동 전과 같아 T-1895 처럼 순서 교환을 동반하지 않는다.
5. **anchor census** (PLAN bullet 의 census 방법 (i)~(iii) 적용) — 모수는 `grep -rl "AdminView.tsx" web/src --include=*.test.*` 기준 **13 파일**이고, 심볼명 + 호출식 정규식(`useApiResource<MembershipRow\[\]>\(` · `runRemove\(` · `runAdd\(` · `deriveAddCandidates\(` 등)으로 훑은 결과 AdminView **소스 텍스트**를 anchor 로 쓰는 것은 [AdminView.group-members-contract.test.ts](../../web/src/views/AdminView.group-members-contract.test.ts) **1 파일**뿐이다(`ADMIN_VIEW_SOURCE` → `extractMembersFireMethod` 가 `useApiResource<MembershipRow[]>(groupMembersPath)` 를 추출). [AdminView.test.tsx](../../web/src/views/AdminView.test.tsx) 는 멤버십 helper 를 **배럴에서 import 해 직접 호출**하거나 `renderToStaticMarkup` 으로 렌더할 뿐이고, 그 안의 `readFileSync` 소스 guard 3 곳은 사용자 관리 · 인스턴스 접근 축이라 본 축과 무관하다 → **무수정 통과 예상**.
6. **import 정리 불요** — 이동으로 AdminView 에서 마지막 소비처가 사라지는 helper 5 종(`deriveMembers` · `buildGroupMembersPath` · `deriveMembersFromMemberships` · `deriveAddCandidates` · `findGroup`)과 `runRemove` · `runAdd` · `MembershipRow` 는 **전부 파일 끝 배럴 재수출 목록에 이미 들어 있어** import 를 지우면 안 되고 `tsc --noEmit` 도 깨지지 않는다(T-1888 · T-1893 이 겪은 TS6133 정리가 본 슬라이스에는 발생하지 않는다).

## Required Reading

- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) — 이동 대상 `736 행` ~ `841 행`, 파라미터 출처(`443 행` `selectedGroupId` · `734 행` `groups` · `531 행` ~ `559 행` `useAdminPersons` 반환의 `personData`), 소비처 JSX(`1057 행` ~ `1082 행` GroupMemberList 배선 · `919 행` `useAdminSchedule` 의 `members` 주입), 배럴 재수출 목록(`1940 행` 이후).
- [web/src/views/useAdminPersons.ts](../../web/src/views/useAdminPersons.ts) — 직전 hook 슬라이스의 모듈 헤더 주석 · 파라미터 · 반환 캡슐화 관례(승계 대상).
- [web/src/views/useAdminPersons.test.ts](../../web/src/views/useAdminPersons.test.ts) — colocated spec harness 관례(probe + `createElement` + `renderToStaticMarkup`, `vi.hoisted` mock, 새 dependency 0). 신규 spec 은 이 파일과 **동일 harness** 로 작성한다.
- [web/src/views/AdminView.group-members-contract.test.ts](../../web/src/views/AdminView.group-members-contract.test.ts) — `108 행` `ADMIN_VIEW_SOURCE` · `115 행` `extractMembersFireMethod` (pointer 교체 대상).
- [web/src/views/adminMembershipRunners.ts](../../web/src/views/adminMembershipRunners.ts) · [web/src/views/adminMembershipDerivations.ts](../../web/src/views/adminMembershipDerivations.ts) — 주입 계약(`RemoveDeps` · `AddDeps`)과 파생 helper 시그니처(수정 대상 아님, 확인용).
- [docs/PLAN.md](../PLAN.md) `183 행` — 부채 bullet 의 경로 1 판정 · 순수 추출 3 조건 · anchor census 방법.
- [CLAUDE.md](../../CLAUDE.md) §3(소비처 동반 의무) · §3.2(R-112) · §12(언어 정책).

## Acceptance Criteria

- [ ] 신규 [web/src/views/useAdminMemberships.ts](../../web/src/views/useAdminMemberships.ts) 가 AdminView `736 행` ~ `841 행` 의 12 선언(`members` · `membersRefreshNonce` · `removing` · `removeError` · `groupMembersPath` · `useApiResource<MembershipRow[]>` destructure(`membershipData` · `membersLoading` · `membersError`) · `groupMembers` · `handleRemove` · `adding` · `addError` · `handleAdd` · `addCandidates`)을 **선행 주석까지 본문 무변경**으로 담는다. `runRemove` · `runAdd` 주입 키와 모든 `useMemo`/`useCallback` deps 배열이 이동 전과 글자-동일임을 diff 로 확인한다.
- [ ] hook 시그니처는 축 밖 의존 3 개(`groups` · `selectedGroupId` · `personData`)만 받는다(단일 object 파라미터 또는 위치 인자 — 선택 근거를 모듈 헤더 주석에 1 줄). 그 밖의 값은 받지 않는다.
- [ ] 반환은 잔류 소비처가 실제로 쓰는 심볼만 공개한다(`members` · `groupMembers` · `membersLoading` · `membersError` · `removing` · `removeError` · `handleRemove` · `adding` · `addError` · `handleAdd` · `addCandidates`). `membershipData` · `groupMembersPath` · `membersRefreshNonce` · 각 setter 는 **노출하지 않는다**(캡슐화 — T-1893 · T-1895 선례).
- [ ] AdminView 는 원 블록 자리(그룹 `groups` 파생 직후, LLM provider hook 호출 앞)에서 hook 을 호출해 destructure 로 즉시 되돌려 쓴다 — GroupMemberList 배선(`members` · `loading` · `error` · `onRemove` · `onAdd` · `addCandidates` · `addError`)과 `useAdminSchedule` 의 `members` 주입이 **글자-동일** 로 남는다(CLAUDE.md §3 소비처 동반 의무 — hook 단독 슬라이스 아님).
- [ ] JSX markup · 파일 끝 배럴 재수출 목록 · `AdminView.tsx` 상단 import 블록은 **무변경**이다(`git diff` 로 확인 — 위 pre-check 6 대로 배럴이 helper 를 붙잡고 있어 import 정리가 필요 없다).
- [ ] `wc -l web/src/views/AdminView.tsx` 가 **2,000 줄 이하**(기대 `1,990` 안팎). 목표선에 미달하면 실측치와 상쇄 요인(import · 배럴 잔량)을 `Follow-ups` 에 수치로 남긴다.
- [ ] 신규 colocated spec [web/src/views/useAdminMemberships.test.ts](../../web/src/views/useAdminMemberships.test.ts) 를 `useAdminPersons.test.ts` harness(probe + `createElement` + `renderToStaticMarkup` + `vi.hoisted` mock, **새 dependency 0**)로 작성하고, 다음 R-112 4 종을 모두 cover 한다:
  - [ ] **happy-path** 1+ — 그룹 선택 시 `groupMembersPath` 가 `/api/groups/:id/members` 로 조회되고 `groupMembers` · `members` · `addCandidates` 파생이 기대값을 낸다.
  - [ ] **error path** 1+ — remove DELETE 실패 · add POST 실패 각각에서 `removeError` / `addError` 가 사람-친화 문구로 채워지고 **throw 하지 않는다**. 조회 자체가 error 인 경우 `membersError` 가 그대로 전달된다.
  - [ ] **분기(flow)** 1+ — 그룹 미선택 → `groupMembersPath` null(idle, 조회 미발사) / 선택 있음 → path 생성, `membersRefreshNonce` 0 → 깨끗한 path · >0 → `_r` 부착, remove · add 성공 시 nonce bump 로 재조회 유발, `removing || membersLoading` · `removeError ?? membersError` 합성 우선순위 각 분기.
  - [ ] **negative cases 충분 cover** — 빈/공백 `membershipId` · 빈/공백 `personId` 발사 억제, 그룹 미선택 상태에서의 remove · add 발사 억제, in-flight(`removing` · `adding`) 중 재발사 억제, `membershipData` 가 비배열 · null · undefined 일 때 파생이 빈 배열로 안전 처리, 재시도 시작 시 이전 error 정리, 반환 표면에 setter · 내부 path 가 **없음**(캡슐화 회귀 가드).
- [ ] [AdminView.group-members-contract.test.ts](../../web/src/views/AdminView.group-members-contract.test.ts) 의 `ADMIN_VIEW_SOURCE` anchor 를 `useAdminMemberships.ts` 소스로 교체한다 — **pointer 만 교체하고 계약 문장 · 정규식 본문 · 단언 의미는 무변경**이며, 교체 사유를 T-1892 선례 문구와 동형으로 한 줄 주석에 남긴다.
- [ ] 나머지 drift-guard 12 파일은 **무수정** 으로 green (census 결과대로). 수정이 필요해지면 그 파일을 `touchesFiles` 에 합산하고 파일 cap(≤ 5) 을 재확인한다 — 5 를 넘으면 즉시 중단하고 `Follow-ups` 에 분할안을 적는다.
- [ ] `pnpm --dir web test` green(직전 기준 **138 파일 4,111 test** 에서 파일 +1 · test 증가), `pnpm --dir web build` · 루트 `pnpm lint` 통과.
- [ ] 루트 `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — `src/` 무변경이라 임계 영향 0 임을 확인만 한다.
- [ ] `bash scripts/check-spec-presence.sh` 통과(신규 `.ts` 모듈에 colocated spec 동반).
- [ ] `git diff --stat` 이 위 `touchesFiles` 4 파일만 보고한다.

## Out of Scope

- ① 그룹 축 이동(`443 행` ~ `473 행` · `567 행` ~ `717 행` · `734 행` `groups` 파생) — prelude 잔여 마지막 조각으로 **후속 슬라이스**. 본 task 는 그 값들을 파라미터로 받기만 한다.
- JSX return 의 하위 컴포넌트화(경로 2) — 순수 추출 3 조건 미충족이라 별도 절단 기준(패널 1 개씩)을 따른다.
- [adminMembershipRunners.ts](../../web/src/views/adminMembershipRunners.ts) · [adminMembershipDerivations.ts](../../web/src/views/adminMembershipDerivations.ts) 의 러너 · 파생 계약 수정, 배럴 재수출 표면 변경, `AdminView.tsx` 상단 import 정리.
- [docs/PLAN.md](../PLAN.md) `183 행` bullet 의 실측 갱신(현재 `2,542 줄` stale) — `direct` 대상이라 본 `pr` task 에 섞지 않는다 (CLAUDE.md §3.1 판정 규칙 3). 목표선 도달 여부 판정도 그 task 에서 한다.
- 이동 대상 코드의 동작 · 문구 · deps 배열 변경, 멤버 정렬 · 검색 같은 UX 개선, 새 dependency 추가(RTL · react-test-renderer 도입 금지).
- 위 AC 가 지목한 anchor pointer 주석 외의 주석 정리 · 리네이밍.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
