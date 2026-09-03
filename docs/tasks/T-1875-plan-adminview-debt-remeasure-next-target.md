---
id: T-1875
title: PLAN 183 행 AdminView 부채 6 차 실측 갱신 + 다음 추출 대상 재지목
phase: P5
status: DONE
completedAt: 2026-09-03T18:41:52Z
commitMode: direct
coversReq: [REQ-049]
independentStream: adminview-god-component-debt
dependsOn: [T-1872, T-1873, T-1874]
touchesFiles: [docs/PLAN.md]
estimatedDiff: 12
estimatedFiles: 1
created: 2026-09-03
plannerNote: P5 PLAN 183 행 부채 bullet — T-1872·T-1873·T-1874 머지로 표기가 stale(4,497/93 vs 실측 4,072/66) + 지목 대상이 전량 마감돼 교체
---

# T-1875 — PLAN 183 행 AdminView 부채 6 차 실측 갱신 + 다음 추출 대상 재지목

## Why

[docs/PLAN.md](../PLAN.md) `183 행` 의 오너 지시 부채 bullet (AdminView.tsx god component) 은 이 부채의 **유일한 추적 지점**이며, 거기 박제된 실측값과 "다음 추출 대상" 지목이 그대로 다음 `pr` 슬라이스의 입력이 된다. 두 값이 stale 하면 다음 슬라이스가 이미 추출된 심볼을 다시 지목하는 중복 task 로 이어진다 ([T-1859](T-1859-req080-global-style-rejudge-plan-debt-remeasure.md) · [T-1861](T-1861-plan-adminview-debt-remeasure-next-target.md) · [T-1871](T-1871-plan-adminview-debt-remeasure-next-target.md) 이 같은 사유로 만들어진 선례). 또 [T-1874](T-1874-adminview-membership-mutation-runners-extract.md) `Follow-ups` 세 번째 항목이 "본 task 머지 후 1 회로 묶어 doc churn 을 줄인다" 며 본 갱신을 명시 위임했다 — 세 슬라이스분을 한 번에 흡수한다.

**issue-still-relevant pre-check (origin/main `4444be7b` 실측)**:

- PLAN `183 행` 표기 = `4,497 줄 · top-level 선언 93 개` (측정 sha `b908be1a`) vs **실측 `4,072 줄 · 선언 66 개`** — [T-1872](T-1872-adminview-create-user-runners-extract.md) (`-105`) · [T-1873](T-1873-adminview-user-access-role-runners-extract.md) (`-194`) · [T-1874](T-1874-adminview-membership-mutation-runners-extract.md) (`-126`) 세 머지분이 **모두 미반영**.
- 같은 행이 지목한 "다음 대상 = 사용자 관리 mutation 축 17 심볼 (`1128~1426 행`)" 은 T-1872 (생성 축 7) + T-1873 (권한 · 역할 축 10) 이 [adminUserMutationRunners.ts](../../web/src/views/adminUserMutationRunners.ts) 로 **전량 추출 완료** 해 지목이 소멸했다 (`git show origin/main:web/src/views/AdminView.tsx | grep -c 'function runChangeRole'` = 0). 그 문단이 "경계 밖" 으로 적어 둔 `runAdd`(`1089 행`) 조차 T-1874 가 [adminMembershipRunners.ts](../../web/src/views/adminMembershipRunners.ts) 로 이미 옮겨 좌표가 통째로 무효다.
- 새 지목 후보의 심볼은 **여전히 AdminView.tsx 에만** 있다 — 멤버십 파생 helper 5 (`findGroup` `590 행` · `deriveMembers` `606 행` · `buildGroupMembersPath` `639 행` · `deriveMembersFromMemberships` `660 행` · `deriveAddCandidates` `689 행`) · 난이도 매핑 assign 축 (`AssignDeps` `951 행` · `runAssign` `969 행`). 이들을 이미 담은 목적지 모듈은 없다 (`git ls-tree origin/main web/src/views/` 의 `admin*Runners.ts` 9 모듈에 히트 0).
- 본 갱신 대상은 `docs/PLAN.md` **1 파일뿐** — 같은 실측치를 박제한 다른 문서는 없다 (부채 추적 지점 단일). 세 슬라이스분 갱신이 main 에 미안착이라 중복 task 가 아니다.

## Required Reading

- [docs/PLAN.md](../PLAN.md) `183 행` — 갱신 대상 bullet 전문 (한 줄이 매우 길다; 반드시 **부분 편집**으로 처리한다).
- [docs/tasks/T-1871-plan-adminview-debt-remeasure-next-target.md](T-1871-plan-adminview-debt-remeasure-next-target.md) — 직전 (5 차) 실측 갱신의 문장 형태 · 좌표 박제 방식 선례.
- [docs/tasks/T-1874-adminview-membership-mutation-runners-extract.md](T-1874-adminview-membership-mutation-runners-extract.md) `Follow-ups` — 본 slice 로 위임된 갱신 항목과 사전 박제된 다음 후보 ① · ②.

## Acceptance Criteria

측정은 **PLAN bullet 이 박제한 방법 그대로** 수행하고, 그 시점 `origin/main` head sha 를 함께 적는다:

```
git fetch origin main -q
git show origin/main:web/src/views/AdminView.tsx | wc -l
git show origin/main:web/src/views/AdminView.tsx | grep -cE '^(export )?(async )?(function|const|let|type|interface|class|enum) '
git rev-parse --short origin/main
```

- [ ] bullet 제목의 `— 4,497 줄` 을 실측 LOC (본 pre-check 시점 **4,072**) 로 교체. 실행 시점 실측이 다르면 **실측값을 우선**한다.
- [ ] 본문 실측 문구 `**4,497 줄 · top-level 선언 93 개**(2026-09-03 head \`b908be1a\` 실측)` 을 `**4,072 줄 · top-level 선언 66 개**(2026-09-03 head \`756af122\` 실측)` 로 교체 (측정 sha 는 T-1874 머지 commit).
- [ ] 최초 기록 대비 누적 감소 표기 **2 곳** 을 `-1,590 줄` → `-2,015 줄` 로 갱신하고, 선언 수 추이 `(선언 149 → 93)` 을 `(선언 149 → 66)` 으로 갱신 (6,087 − 4,072 = 2,015).
- [ ] 목표선 잔여 표기 `-2,497 줄` → `-2,072 줄` 로 갱신한다 (4,072 − 2,000 = 2,072). 이어지는 페이스 서술은 **최근 실측을 함께 박제**하도록 고쳐 쓴다 — 선언된 `-250~500 줄` 밴드로는 산술 5 회 이상이지만, **최근 3 슬라이스 실측은 `-105` · `-194` · `-126` (평균 `-142`) 로 밴드 하단에도 못 미쳐 그 페이스로는 산술 15 회가 필요**하다는 사실을 한 문장으로 적는다.
- [ ] 진척 목록을 **순수 추출 9 슬라이스 → 12 슬라이스** 로 늘리고 세 건을 추가한다: [T-1872](T-1872-adminview-create-user-runners-extract.md) [adminUserMutationRunners.ts](../../web/src/views/adminUserMutationRunners.ts) (사용자 생성 축 9 선언, `-105 줄`) · [T-1873](T-1873-adminview-user-access-role-runners-extract.md) 같은 모듈 (인스턴스 접근 · 역할 변경 축 10 심볼 + 상수 4, `-194 줄`, **사용자 관리 축 마감**) · [T-1874](T-1874-adminview-membership-mutation-runners-extract.md) [adminMembershipRunners.ts](../../web/src/views/adminMembershipRunners.ts) (그룹 멤버십 add · remove 러너 4 심볼, `-126 줄`).
- [ ] 소멸한 "다음 대상" 지목 문단 (사용자 관리 mutation 축 17 심볼 + 그 좌표 · `USERS_PATH` 처리 · `1128~1232` / `1234~1426` 절단선 후보) 을 **멤버십 파생 helper 축** 으로 교체한다. 아래 실측 사실을 그대로 박제할 것 (head `756af122` 기준):
  - 대상 = `findGroup`(`590 행`) · `deriveMembers`(`606 행`) · `buildGroupMembersPath`(`639 행`) · `deriveMembersFromMemberships`(`660 행`) · `deriveAddCandidates`(`689 행`) 의 **순수 helper 5**, 선행 주석부터 `deriveAddCandidates` 끝까지 `588 행` ~ `715 행` 의 **연속 1 블록 128 줄**.
  - **동반 이동 박제** — 위 helper 가 쓰는 frontend-local row 타입 3 (`GroupMemberRow` `480 행` · `GroupRow` `494 행` · `MembershipRow` `506 행`, 선행 주석 포함 `477 행` ~ `512 행`) 과 상수 `FALLBACK_MEMBER_NAME`(`473 행`) 도 함께 옮긴다. 잔류 컨테이너가 `useApiResource<GroupRow[]>`(`1079 행`) · `useApiResource<MembershipRow[]>`(`1740 행`) 로 세 타입을 계속 쓰므로, 새 모듈이 AdminView 를 import 하면 역방향이라 금지 — **타입 · 상수를 동반 이동하고 AdminView 가 새 모듈에서 import** 하는 방향만 성립한다 (T-1873 의 `USERS_PATH` 선례).
  - 경계 밖 = `EMPTY_MEMBER_TEXT`(`471 행`, markup `3029 행` 전용) · `FALLBACK_GROUP_NAME`(`475 행`) · `isAdminRole`(`584 행`) · `DIFFICULTY_KEYS`(`718 행`) 이후의 provider 파생 helper 군.
  - 새 모듈은 `Member`(`../components/GroupMemberList`) · `PersonRow`(`../components/PersonList`) 를 **컴포넌트 모듈에서 직접** import 한다 (AdminView 경유 아님 — 역방향 0). 기대 순 감소는 **`-150 줄` 안팎**.
  - **파일 cap 주의 박제** — 배럴이 helper 5 를 이미 `export` 하므로 (`3941 행` ~ `3945 행`) 재수출을 유지하면 심볼 import 방식 spec 은 무수정 통과한다. 다만 AdminView **소스 텍스트**를 읽는 drift-guard 중 [AdminView.group-members-contract.test.ts](../../web/src/views/AdminView.group-members-contract.test.ts) (`68 행` `extractMembersFireMethod`) 와 [AdminView.groups-list-contract.test.ts](../../web/src/views/AdminView.groups-list-contract.test.ts) 는 anchor 가 잔류부인지 **슬라이스 착수 시 재확인** 해 파일 cap (≤ 5, LOC 만 면제) 산술에 반영한다.
- [ ] 위 지목 문단 끝에 **더 작은 후속 후보** 를 한 문장으로 덧붙인다 — **난이도 매핑 assign 축** (`AssignDeps` `951 행` · `runAssign` `969 행`, 선행 주석부터 `943 행` ~ `1001 행` 연속 59 줄) 을 기존 [adminLlmProviderMutationRunners.ts](../../web/src/views/adminLlmProviderMutationRunners.ts) 로 이동하되, 잔류 `buildMappingsPath`(`796 행`) 가 `LLM_MAPPINGS_PATH`(`395 행`) 를 쓰므로 **상수를 동반 이동하고 AdminView 가 import 로 되돌려 쓰는** 방향만 성립한다는 사실까지 적는다.
- [ ] `git diff --stat` 이 `docs/PLAN.md` **1 파일** 만 보고하고, bullet 의 나머지 서술 (측정 방법 문단 · 구조적 유인 설명 · 선행 처리 [T-1822](T-1822-pure-extraction-cap-bend-category.md) 링크 · 목표선 정의 · `[ ]` 체크박스 상태) 은 **무변경**.
- [ ] 코드 변경 0 이므로 test 는 불요 — 단 `git status --short` 로 `docs/PLAN.md` 외 오염이 없음을 확인한다. (R-112 4 항목은 `commitMode: direct` doc-only 라 적용 대상이 아니다 — CLAUDE.md §3.2 의 direct-mode doc-only 면제.)

## Out of Scope

- `web/src/views/AdminView.tsx` 를 포함한 **모든 코드 변경** — 본 slice 는 doc-only `direct` 다. 실제 추출은 후속 `pr` slice (§3.1 판정 규칙 3 분리 유지).
- 지목된 멤버십 파생 helper 축의 실제 이동 · 새 모듈 신설 — 다음 `pr` task 의 몫이다.
- `docs/requirements.md` 의 REQ status 재판정 — 본 slice 는 리팩터 추적 문서 갱신이라 REQ 구현이 없다 (CLAUDE.md §3.1 판정 규칙 6).
- PLAN `181 행` · `182 행` (과분할 차단 · 재판정 왕복) bullet 갱신.
- 부채 bullet 의 목표선 (≤ 2,000 줄) 자체 재조정 — 오너 지시값이라 planner 판단으로 바꾸지 않는다.
- `docs/PLAN.md` 의 다른 phase · 항목, [PLAN_archive.md](../PLAN_archive.md).

## Suggested Sub-agents

`implementer` (doc 편집 단독 — architect · tester 불요, 코드 변경 0)

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
