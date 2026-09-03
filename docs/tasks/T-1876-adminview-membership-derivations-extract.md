---
id: T-1876
title: AdminView 의 멤버십 파생 helper 축(helper 5 + row 타입 3 + 상수 1)을 adminMembershipDerivations 로 순수 추출
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-028, REQ-045]
independentStream: adminview-god-component-refactor
dependsOn: [T-1874]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/adminMembershipDerivations.ts
  - web/src/views/adminMembershipDerivations.test.ts
estimatedDiff: 740
estimatedFiles: 3
sizeExempt: true
exemptReason: "pure-extraction — (a) 동작 변경 0 (연속 블록 `588~715 행` 의 helper 5 와 row 타입 블록 `477~510 행` · 상수 `472~473 행` 을 통째로 옮기고 helper 5 · 타입 3 선언 앞에 `export` 만 붙인 뒤 AdminView 가 단방향 import 로 되돌려 쓰는 것이 전부) · (b) 신규 로직 0 LOC (helper 5 본문 · 타입 3 필드 · 상수 값 · 각 선언 위 주석 블록 무변경) · (c) 기존 spec 은 AdminView 배럴 재수출 덕에 `from './AdminView'` 무수정 통과 (`AdminView.test.tsx` · `AdminView.group-members-contract.test.ts` · `AdminView.group-member-add-contract.test.ts` 는 심볼 import 방식이라 소스 경로에 의존하지 않고, 소스 텍스트를 읽는 drift-guard 3 종의 anchor 는 모두 잔류부다 — 아래 Why 의 실측 참조). 삭제 약 164 + 추가 약 197 이 전부 이동량이고 나머지는 신규 경계 spec 이라 LOC 이 위험도에 비례하지 않는다. 파일 수 3 으로 파일 cap (≤ 5) 은 예외 없이 준수."
plannerNote: "P6 / PLAN 183 행 AdminView 부채 열셋째 실분할 — 멤버십 파생 helper 5 + row 타입 3 + 상수 1 (588~715 행 연속 블록)"
created: 2026-09-03
---

# T-1876 — AdminView 의 멤버십 파생 helper 축(helper 5 + row 타입 3 + 상수 1)을 adminMembershipDerivations 로 순수 추출

## Why

[docs/PLAN.md](../PLAN.md) `183 행` 의 AdminView god component 부채 bullet 이 [T-1875](T-1875-plan-adminview-debt-remeasure-next-target.md) 의 6 차 실측 갱신에서 **다음 대상으로 명시 지목**한 것이 본 task 의 **멤버십 파생 helper 축**이다. 직전 [T-1874](T-1874-adminview-membership-mutation-runners-extract.md) 가 같은 멤버십 축의 **mutation 러너** 4 심볼을 [adminMembershipRunners.ts](../../web/src/views/adminMembershipRunners.ts) 로 옮겼고, 본 task 는 그 짝인 **순수 파생 helper** 를 신규 모듈로 옮기는 열셋째 순수-추출 슬라이스다. cap 이 append 를 싸게 extract 를 비싸게 만들어 온 구조를 되돌려 목표선 (≤ 2,000 줄) 까지의 잔여를 줄이는 것이 목적이다.

**issue-still-relevant pre-check (origin/main `3ff16d53` 실측)**:

- `wc -l web/src/views/AdminView.tsx` = **4,072 줄**, 선언 수 (`grep -cE '^(export )?(async )?(function|const|let|type|interface|class|enum) '`) = **66**. PLAN bullet 의 표기 (`4,072 줄 · 선언 66`) 와 **일치** — T-1875 가 방금 갱신했으므로 stale 0.
- 이동 대상 helper 5 (`findGroup` · `deriveMembers` · `buildGroupMembersPath` · `deriveMembersFromMemberships` · `deriveAddCandidates`) 가 **여전히 AdminView.tsx 에만** 정의돼 있다 — `590` · `606` · `639` · `660` · `689 행` 으로 **PLAN 이 적은 좌표와 글자-동일**. 선행 주석부터 `deriveAddCandidates` 의 닫는 `}` (`715 행`) 까지 `588 행` ~ `715 행` 의 **연속 1 블록 128 줄**임을 경계 실측으로 확인했다 (`587 행` = 빈 줄, `586 행` = 잔류 `isAdminRole` 의 닫는 `}`, `716 행` = 빈 줄, `717 행` 부터 잔류 `DIFFICULTY_KEYS`).
- 동반 이동 대상도 좌표 일치 — row 타입 3 은 선행 주석 포함 `477 행` ~ `510 행` (`GroupMemberRow` `480` · `GroupRow` `494` · `MembershipRow` `506`) 이고 상수 `FALLBACK_MEMBER_NAME` 은 주석 포함 `472 행` ~ `473 행` 이다. 사이에 낀 `EMPTY_MEMBER_TEXT` (`471 행`) · `FALLBACK_GROUP_NAME` (`475 행`) 은 **경계 밖**이라 그 자리에 잔류한다 (블록이 2 조각으로 나뉘는 유일한 지점).
- 목적지 모듈 `web/src/views/adminMembershipDerivations.ts` 는 origin/main 에 **부재** (`git ls-tree origin/main web/src/views/` 히트 0) — 중복 task 아님. 기존 [adminMembershipRunners.ts](../../web/src/views/adminMembershipRunners.ts) 는 `GroupRow` · `MembershipRow` · `GroupMemberRow` · `FALLBACK_MEMBER_NAME` 을 **한 번도 참조하지 않아** (`grep` 히트 0) 두 모듈 사이 결합이 생기지 않는다.
- **역방향 import 0 성립 실측** — 새 모듈이 밖에서 끌어오는 타입은 `Member` (`../components/GroupMemberList`, AdminView `100 행`) 와 `PersonRow` (`../components/PersonList`, AdminView `133 행`) 둘뿐이고, 두 컴포넌트 모듈 어느 쪽도 `AdminView` 를 import 하지 않는다 (주석 언급 1 줄만 존재) — cycle 0.
- **소비처는 전부 AdminView 에 잔류**한다 — `deriveMembers` (`1709 행`) · `buildGroupMembersPath` (`1729 행`) · `deriveMembersFromMemberships` + `findGroup` (`1746` · `1748 행`) · `deriveAddCandidates` (`1807 행`) 의 `useMemo` 4 개와 타입을 쓰는 `useApiResource<GroupRow[]>` (`1079 행`) · `useApiResource<MembershipRow[]>` (`1740 행`) 이다. 이 배선을 **같은 PR 안에서** import 로 갈아끼우므로 CLAUDE.md §3 의 소비처 동반 의무를 충족한다 (helper 단독 slice 아님).
- **파일 cap 산술 확정 — drift-guard 동반 갱신 0**. AdminView **소스 텍스트**를 읽는 spec 은 3 파일 (`AdminView.group-members-contract.test.ts` · `AdminView.groups-list-contract.test.ts` · `AdminView.test.tsx`) 인데 anchor 를 전수 확인한 결과 **모두 잔류부**다: 앞 둘의 정규식은 각각 `useApiResource<MembershipRow[]>(groupMembersPath)` (`68 행` `extractMembersFireMethod`) 와 `useApiResource<GroupRow[]>(groupsPath)` (`77 행` `extractGroupsFireMethod`) 로 **컨테이너 call site** 를 잡으며 (`1740` · `1079 행` — 타입 인자 표기가 그대로 남으므로 매칭 유지), `AdminView.test.tsx` 의 `readFileSync` 3 곳 (`9188` · `9605` · `9681 행`) 은 `handleChangeRole` 배선 · 인스턴스 접근 폼 flag · 사용자 관리 섹션 markup 을 본다. 따라서 변경 파일은 **3 개**로 확정된다.

## Required Reading

- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) — `472 행` ~ `473 행` (상수 `FALLBACK_MEMBER_NAME`), `477 행` ~ `510 행` (row 타입 3 블록), `588 행` ~ `715 행` (helper 5 연속 블록), `1079 행` · `1709 행` · `1729 행` · `1740 행` ~ `1750 행` · `1807 행` 부근 (소비처 `useMemo` 4 + 타입을 쓰는 조회 2), 파일 머리 import 블록 (`18 행` ~ `140 행` — 특히 `Member` `100 행` · `PersonRow` `133 행`), 파일 끝 `export {` (`3940 행` ~) · `export type {` (`4023 행` ~) 배럴.
- [web/src/views/adminMembershipRunners.ts](../../web/src/views/adminMembershipRunners.ts) — 직전 슬라이스가 만든 **모듈 헤더 주석 규약 · 단방향 import 선언 · export 부착 관례**의 참조 선례 (본 task 의 새 모듈도 같은 형식을 따른다).
- [web/src/views/adminMembershipRunners.test.ts](../../web/src/views/adminMembershipRunners.test.ts) — 신규 경계 spec 의 구성 선례 (R-112 4 종 배치 + 동일 참조 단언).
- [web/src/views/AdminView.group-members-contract.test.ts](../../web/src/views/AdminView.group-members-contract.test.ts) — `68 행` `extractMembersFireMethod` 의 anchor 가 잔류 call site 임을 착수 시 재확인 (무수정 통과해야 함).
- [web/src/views/AdminView.groups-list-contract.test.ts](../../web/src/views/AdminView.groups-list-contract.test.ts) — `77 행` `extractGroupsFireMethod` 의 anchor 가 잔류 call site 임을 착수 시 재확인 (무수정 통과해야 함).

## Acceptance Criteria

- [ ] 신규 파일 [web/src/views/adminMembershipDerivations.ts](../../web/src/views/adminMembershipDerivations.ts) 가 존재하고 helper 5 (`findGroup` · `deriveMembers` · `buildGroupMembersPath` · `deriveMembersFromMemberships` · `deriveAddCandidates`) 와 row 타입 3 (`GroupMemberRow` · `GroupRow` · `MembershipRow`) **총 8 심볼**을 `export` 한다. 각 선언의 **본문 · 필드 · 선행 주석은 한 글자도 바뀌지 않아야** 하며 (선언 앞 `export` 키워드 부착만 허용), 상수 `FALLBACK_MEMBER_NAME` 은 배럴에 없던 **모듈-private 심볼이므로 `export` 없이** 값 · 주석 그대로 옮긴다.
- [ ] 새 모듈이 밖에서 끌어오는 의존은 `import type { Member } from '../components/GroupMemberList';` 와 `import type { PersonRow } from '../components/PersonList';` **둘뿐**이다. **역방향 import 0** — `grep -n "from './AdminView'" web/src/views/adminMembershipDerivations.ts` 히트 0.
- [ ] [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) 에서 위 9 선언 (helper 5 + 타입 3 + 상수 1) 이 제거되고, 새 모듈에서 값 (helper 5) 과 타입 (3) 을 import 하도록 배선된다. 경계 밖 `EMPTY_MEMBER_TEXT` · `FALLBACK_GROUP_NAME` · `isAdminRole` · `DIFFICULTY_KEYS` 는 **이동하지 않고 원래 자리에 남는다**.
- [ ] 소비처가 같은 PR 안에서 새 모듈의 helper 를 호출하도록 배선된다 (소비처 동반 의무 — helper 단독 slice 금지): `useMemo` 4 개 (`deriveMembers` · `buildGroupMembersPath` · `deriveMembersFromMemberships`+`findGroup` · `deriveAddCandidates`) 와 타입을 쓰는 조회 2 개 (`useApiResource<GroupRow[]>` · `useApiResource<MembershipRow[]>`) 가 모두 컴파일 · 통과한다.
- [ ] AdminView 파일 끝 배럴이 이동 전 공개 표면을 그대로 re-export 한다 — `export { ... findGroup, deriveMembers, buildGroupMembersPath, deriveMembersFromMemberships, deriveAddCandidates ... }` 와 `export type { ... GroupRow, GroupMemberRow, MembershipRow ... }` 유지. 기존 spec 의 `from './AdminView'` 가 **무수정**으로 통과해야 한다.
- [ ] `wc -l web/src/views/AdminView.tsx` 가 **4,072 줄보다 작아진다** (기대 `-150 줄` 안팎). PR 본문에 이동 전/후 실측 LOC 을 박제한다.
- [ ] **happy-path unit test** — 신규 spec 에서 helper 5 각각의 정상 경로를 1+ 검증한다: `findGroup` 이 id 일치 그룹을 반환 · `deriveMembers` 가 `group.members` 를 `Member[]` 로 매핑 · `buildGroupMembersPath` 가 `/api/groups/:id/members` 를 생성 · `deriveMembersFromMemberships` 가 membership id 를 `Member.id` 로, 매칭 person 이름을 `Member.name` 으로 매핑 · `deriveAddCandidates` 가 미소속 인원만 후보로 반환.
- [ ] **error path unit test** — helper 5 는 모두 순수 함수라 throw 대신 **안전 fallback** 이 error path 다. 비정상 입력 (`undefined` · `null` · 배열 아님 · 필수 필드 누락 row) 을 각 helper 에 넣었을 때 (a) **throw 하지 않고** (b) 계약된 안전값 (`undefined` / `[]` / `null`) 을 돌려주며 (c) 부분 손상 row 가 있어도 나머지 row 매핑이 계속됨을 각 1+ 검증한다.
- [ ] **flow / 분기 cover** — 각 helper 의 분기를 1+ test 로 분리한다: `findGroup` 3 (비배열 / falsy id / 미발견 / 발견) · `deriveMembers` 4 (그룹 미발견 → `[]` / `rawMembers` 비배열 → `[]` / `members` 우선 / `persons` fallback) · `buildGroupMembersPath` 3 (미선택 → `null` / `refreshNonce <= 0` → query 없는 base / `>= 1` → `?_r=<nonce>` 부착) · `deriveMembersFromMemberships` 3 (memberships 비배열 → `[]` / `group` undefined 로 persons 빈 배열 / personId 매칭 성공·실패) · `deriveAddCandidates` 3 (`personData` 비배열 → `[]` / `membershipData` 비배열 → 전원 후보 / 멤버 제외).
- [ ] **negative cases 충분 cover** — 예외 상황마다 1+ test: (a) 빈 문자열 `selectedGroupId` (`findGroup` · `buildGroupMembersPath` 의 falsy 경로), (b) 비정상 문자가 든 `groupId` 의 `encodeURIComponent` 안전 인코딩, (c) `id` 누락 row 의 index 기반 합성 key (`m<n>` · `p<n>`) 안정성, (d) `name` · `fullName` 둘 다 누락 및 **빈 문자열** 이름의 `FALLBACK_MEMBER_NAME` 대체 (`name || FALLBACK` 경로), (e) `personId` 가 빈 문자열 · 비문자열인 membership 이 제외 키에서 걸러져 정상 인원이 후보에서 사라지지 않음, (f) 음수 `refreshNonce` 가 query 없는 base 로 떨어짐, (g) 이미 멤버인 인원이 `deriveAddCandidates` 결과에서 빠짐 (중복 추가 UI 차단).
- [ ] **동일 참조 검증 1+** — `import { findGroup, deriveMembers, buildGroupMembersPath, deriveMembersFromMemberships, deriveAddCandidates } from './AdminView'` 로 얻은 심볼이 `adminMembershipDerivations` 의 것과 **동일 참조** (`toBe`) 임을 단언해 배럴 재수출이 사본이 아님을 박제한다.
- [ ] `pnpm --dir web test` (vitest) 전량 green — 기존 계약 spec · drift-guard 3 종 (`AdminView.group-members-contract.test.ts` · `AdminView.groups-list-contract.test.ts` · `AdminView.test.tsx`) **무수정** 통과 포함.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — jest `coverageThreshold` 미달 시 CI red.
- [ ] `pnpm lint && pnpm build` 가 web · backend 양쪽에서 통과한다.

## Out of Scope

- **난이도 매핑 assign 축** (`AssignDeps` (`951 행`) · `runAssign` (`969 행`) · 동반 상수 `LLM_MAPPINGS_PATH` (`395 행`)) 이동 — PLAN `183 행` 이 "더 작은 후속 후보" 로 따로 박제한 별도 슬라이스다.
- **provider 파생 helper 군** (`deriveProviders` (`724 행`) 이후) 과 `DIFFICULTY_KEYS` (`718 행`) — 연속 블록의 아래쪽 이웃이지만 LLM 축이라 대상이 아니다.
- `EMPTY_MEMBER_TEXT` (`471 행`, markup 전용) · `FALLBACK_GROUP_NAME` (`475 행`) · `isAdminRole` (`584 행`) 이동 — 경계 밖으로 확정된 잔류 심볼이다.
- helper 본문의 어떤 **동작 변경 · 리팩터 · 주석 재작성**도 금지 (순수 추출 — 선언 앞 `export` 부착과 import 배선만). 성능 최적화 · 타입 강화 (`?` 제거 등) · 이름 변경 전부 금지.
- 기존 spec 의 import 경로를 `./adminMembershipDerivations` 로 갈아끼우는 정리 — 배럴 재수출로 무수정 통과가 성립하므로 불필요한 diff 를 만들지 않는다.
- [docs/PLAN.md](../PLAN.md) `183 행` bullet 의 실측 LOC 갱신 · 다음 대상 재지목 — `direct` 대상이라 §3.1 판정 규칙 3 에 따라 별도 task (Follow-ups 참조).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

- (planner 사전 박제) 다음 순수-추출 후보: **난이도 매핑 assign 축** — `AssignDeps` · `runAssign` (`943 행` ~ `1001 행` 연속 59 줄) 을 기존 [adminLlmProviderMutationRunners.ts](../../web/src/views/adminLlmProviderMutationRunners.ts) 로 이동. 잔류 `buildMappingsPath` (`796 행`) 가 `LLM_MAPPINGS_PATH` (`395 행`) 를 쓰므로 T-1873 의 `USERS_PATH` 선례대로 **상수를 동반 이동하고 AdminView 가 import 로 되돌려 쓰는** 방향만 성립한다.
- (planner 사전 박제) [docs/PLAN.md](../PLAN.md) `183 행` bullet 갱신 (`direct`) — 본 task 머지 후 실측 LOC 을 갱신하고 진척 목록에 열셋째 슬라이스를 추가한다. 다음 슬라이스와 묶어 doc churn 을 줄일 수 있으면 묶는다.

## 완료 기록

- **Status: DONE** — 2026-09-03T20:01:50Z (`pr`, [PR #1467](https://github.com/myungjoo/Assessment-Agent/pull/1467) → main [`34fdf2ce`](https://github.com/myungjoo/Assessment-Agent/commit/34fdf2ce), round 1 머지).
- helper 5 · row 타입 3 · 상수 1 을 [adminMembershipDerivations.ts](../../web/src/views/adminMembershipDerivations.ts) 로 이동(`+559/-167`). 본문 · 주석 byte-identical(diff 0 hunk), 소비처 `useMemo` 4 + 조회 2 배선을 같은 PR 에 동반, 참조 0 이 된 `Member` 타입 import 만 컨테이너에서 제거(TS6133). 역방향 import 0 · 배럴 재수출로 기존 계약 spec · drift-guard 3 종 무수정 통과.
- **AdminView.tsx `4,072 → 3,921 줄`(-151)** — 기대치 `-150` 과 일치.
- 검증: web vitest 127 파일 `3,784` test green(신규 30 — R-112 happy · error · 분기 · negative 4 종 + 배럴 동일 참조 5), backend jest 466 suite `13,495` test green(line 99.94% · function 100%), `pnpm lint && pnpm build` 양쪽 통과. PR head run(33798718775) success.

- (실행 중 발견) `src/run-status/run-status.service.spec.ts:134` 가 full-suite 병렬 1 회차에서 flaky fail (단독 재실행 · CI 모두 green). 본 task 는 backend 0 LOC 변경이라 무관한 기존 flake — 별도 follow-up task 후보.
