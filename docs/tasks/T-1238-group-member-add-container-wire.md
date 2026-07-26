---
id: T-1238
title: AdminView 멤버 추가 컨테이너 배선 — addCandidates(persons−members) 파생 + GroupMemberList onAdd/addCandidates 주입
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-046, REQ-047]
estimatedDiff: 230
estimatedFiles: 2
created: 2026-07-26
independentStream: p6-group-member-add
dependsOn: [T-1237]
touchesFiles: [web/src/views/AdminView.tsx, web/src/views/AdminView.group-member-add-contract.test.ts]
plannerNote: P6 deferred-wiring — T-1237 Follow-up 컨테이너 배선. presentational onAdd/addCandidates(T-1237 신설) 를 AdminView GroupMemberList 에 주입 + persons−members 후보 파생, 기존 free-text personId 입력 은퇴. backend POST :id/members 이미 shipped.
---

# T-1238 — AdminView 멤버 추가 컨테이너 배선 (addCandidates 파생 + onAdd/addCandidates 주입)

## Why

PLAN.md line 123 의 **deferred 잔여** 중 "GroupMember add mutation" 는 backend(`POST /api/groups/:id/members`, `addMember`, AddMemberDto `{ personId }`) 가 이미 shipped 이고, T-1131 로 AdminView 에 add mutation 러너(`runAdd`)·핸들러(`handleAdd`)·POST 배선이 이미 들어와 있다. 그러나 현재 add UX 는 **컨테이너가 직접 소유한 free-text personId `<input>`**(AdminView.tsx L4066~4082)이고, 방금 머지된 T-1237(PR #1129)이 presentational `GroupMemberList` 에 신설한 `onAdd?: (personId) => void` / `addCandidates?: Member[]` 두 prop 은 **아직 컨테이너에서 주입되지 않았다**(L4052~4058 은 `members`/`loading`/`error`/`emptyMessage`/`onRemove` 만 전달).

본 task 는 T-1237 의 Follow-up(그 task 파일 Follow-ups 절 T-1238 후보)으로, ADR-0041 의 controlled lift-up 원칙에 따라 **후보 파생 + 신 prop 주입**을 컨테이너에 배선한다: (1) 전체 인원(`personData`, id=personId)에서 현재 그룹 멤버(membership 의 personId)를 제외한 `addCandidates` 를 순수 helper 로 파생하고, (2) 그것과 `onAdd` 를 `<GroupMemberList>` 에 주입해 컴포넌트의 select 기반 추가 form 을 활성화하며, (3) 이제 중복이 된 컨테이너 소유 free-text personId 입력 컨트롤을 은퇴시켜 add UX 를 presentational 컴포넌트로 일원화한다. T-1130(remove) 의 정확한 add 거울상이 이로써 완결된다.

## Required Reading

- `web/src/views/AdminView.tsx` — 다음 구간만: (a) `deriveMembersFromMemberships`(L558~) 및 `deriveMembers`(L504~) 순수 helper 관례 — 신 helper `deriveAddCandidates` 를 동형(배열 아님 → 빈 배열, throw 없음, id=personId, index fallback key)으로 작성한다. (b) `personData` useApiResource(`useApiResource<PersonRow[]>(personsPath)`, L2655~2658) — 후보 소스. (c) `membershipData`(L3043) — 현재 그룹 멤버십(각 row 의 `personId`)으로 제외 집합 파생. (d) `runAdd`/`handleAdd`/`personIdInput` 상태(L3079~3108) — `handleAdd` 를 인자(personId)를 받는 형태로 리팩터. (e) `<GroupMemberList>` 렌더(L4052~4058) 와 free-text 입력 블록(L4066~4082) — 후자 은퇴, 전자에 신 prop 주입.
- `web/src/components/GroupMemberList.tsx` — T-1237 이 신설한 `onAdd?: (personId: string) => void` / `addCandidates?: Member[]` prop 계약 + `Member` 타입(`id`/`name`/`role?`). 본 task 는 **컴포넌트를 수정하지 않고** 이 계약을 소비만 한다.
- `web/src/views/AdminView.group-member-add-contract.test.ts` — 기존 add 배선 contract test 구조(mock request 주입·POST 발사 assert 관례). free-text 입력 전제 test 는 신 select 기반 흐름으로 갱신하고, `deriveAddCandidates`·onAdd 주입 test 를 추가한다.
- `web/src/components/PersonList.tsx` 의 `PersonRow` 타입(참고, 변경 불요) — 후보 파생 시 `id`/`name`(또는 `fullName`) 필드 매핑 근거.

## Acceptance Criteria

- [ ] 순수 helper `deriveAddCandidates(personData: PersonRow[] | undefined, membershipData: MembershipRow[] | undefined): Member[]` 를 신설한다 — 전체 인원에서 현재 멤버(membership 의 `personId`)를 제외한 후보를 `Member`(`id = personId`, `name = fullName ?? name ?? fallback`) 로 매핑. `personData`/`membershipData` 가 배열이 아니면 빈 배열(throw 없음), id 누락 인원은 index 기반 안전 key.
- [ ] AdminView 에서 위 helper 로 `addCandidates` 를 `useMemo` 파생(deps: personData·membershipData·selectedGroupId)하고, `<GroupMemberList>` 에 `onAdd`·`addCandidates` 두 prop 을 주입한다.
- [ ] `handleAdd` 를 `(personId: string) => void` 시그니처로 리팩터해 `onAdd` 로 넘긴다 — 선택된 후보의 personId 를 인자로 받아 `runAdd(personId, {...})` 발사. 기존 free-text 전용 `personIdInput`/`setPersonIdInput` 상태와 `resetInput` 은 제거하거나 무해화(select 는 컴포넌트 로컬 state, 컨테이너는 값 미보유).
- [ ] 기존 컨테이너 소유 free-text personId `<input>` + "추가" 버튼 블록(AdminView.tsx L4066~4082)을 **제거**한다(add UX 일원화). `addError` 실패 문구는 `<GroupMemberList>` 근처(또는 그 error props 경로)로 유지해 실패 시 안전 표시(throw 없음).
- [ ] 무회귀: `onRemove`(handleRemove)·멤버십 조회 loading/error 합성·`membersRefreshNonce` bump 재조회 동작은 불변. add 성공 시에도 기존과 동일하게 `membersRefreshNonce` bump 로 권위 재조회.
- [ ] **Happy-path test 1+**: personData(3인) + membershipData(그 중 1인 멤버) 주입 시 `addCandidates` 가 나머지 2인만 포함(멤버 제외)함을 검증 + `<GroupMemberList>` 의 select 후보 선택 → "추가" 클릭 시 `POST /api/groups/:id/members` 가 body `{ personId }` 로 정확히 1회 발사됨을 mock request 로 검증.
- [ ] **Error/negative test 각 1+**: (a) 그룹 미선택 시 add 미발사(runAdd 그룹 미선택 가드 — POST 0). (b) 후보 미선택 상태에서 추가 시 POST 미발사(빈 personId 차단). (c) POST 실패(비-2xx/네트워크) 시 `addError` 사람-친화 문구 안전 표시 + throw 없음. (d) `personData`/`membershipData` 가 undefined/비배열일 때 `deriveAddCandidates` 가 빈 배열 반환(throw 없음) + 후보 없음 안내 경로.
- [ ] **Flow/branch cover**: (1) 전체 인원 중 일부만 멤버 → 후보 = 비멤버만(제외 로직 분기). (2) 모든 인원이 이미 멤버 → 후보 빈 배열(빈 후보 안전 표시 분기). (3) add in-flight(adding=true) 중 재클릭 시 이중 POST 미발사(runAdd adding 가드).
- [ ] 기존 `AdminView.group-member-add-contract.test.ts` 의 무관 assert 무회귀(remove·기타 패널 test 파일은 건드리지 않음).
- [ ] production 코드 변경은 `AdminView.tsx` 1개로 한정 — `GroupMemberList.tsx`·apiClient·useApiResource·backend 는 **읽기만**, 수정 금지.
- [ ] `pnpm --dir web test`(vitest) green — 신규/갱신 test 전부 pass, 나머지 spec 무회귀. `pnpm --dir web build`(tsc --noEmit + vite) green(TS6133 unused `personIdInput`/import 0 — 제거된 상태 정합). 신규 helper·배선 라인/분기가 신규 test 로 충분 cover(web coverageThreshold 는 T-1165 게이트로 미강제이나 전 분기 test 지향).

## Out of Scope

- **GroupMemberList.tsx 수정 금지** — T-1237 이 신설한 `onAdd`/`addCandidates` 계약을 소비만 한다(컴포넌트 마크업/prop 재설계 0).
- backend group.controller/service/add-member.dto/api.md 변경 0 — 이미 shipped 계약(POST :id/members) 소비만.
- ReEvaluationTriggerPanel·SchedulePanel·EvaluationGuardBanner polling 등 다른 deferred 잔여(PLAN.md L123) 배선 금지 — 본 task 는 멤버 add 접점만.
- 후보 정렬/검색/페이지네이션·중복 추가 서버 방지(@@unique P2002 409 처리 문구 고도화)는 본 slice 미포함(select 는 파생된 `addCandidates` 를 그대로 렌더, P2002 는 기존 add error 경로가 흡수).
- 재평가 인원 선택 `<select>`(personOptions = deriveMembers 결과, L3985)·그 밖 personData 소비처는 건드리지 않는다(add 후보 파생은 별도 helper).
- **cap 유의**: AdminView.tsx 1 파일(helper 신설 + 배선 + 입력 블록 제거) + contract test 1 파일 ≈ 230 LOC 예상. 300 LOC / 5 파일 cap 초과 위험 시 executor 가 즉시 BLOCKED(task-too-large)로 planner split 요청(예: helper+파생 slice ↔ 입력-블록-은퇴 slice 분할).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 후보: add 성공 후 select 재선택 UX(추가 직후 다음 후보로 focus/초기화) — presentational 로컬 처리 여지 검토(GroupMemberList 로컬 state 라 컨테이너 무관일 수 있음).
- 후보: 후보 목록 대량(수백 인원) 시 select 검색/필터 — 별도 slice.

## Result — DONE (2026-07-26T04:04:18Z)

PR #1130 squash merge(`1502b893`, branch delete). deriveAddCandidates(persons−members) 순수 helper 신설 + useMemo 파생, GroupMemberList 에 onAdd/addCandidates 주입, handleAdd (personId)=>void 리팩터, free-text personId input 블록 은퇴. production 변경 AdminView.tsx 1파일 한정(+73/-41), test 2파일 확장. web lint+build+test green(1966 pass), diff 256/-56 3파일(cap 이내). reviewer round 1/7 APPROVE, 4-게이트 PASS(CI unit+smoke green). MINOR(non-blocking): frontmatter touchesFiles 가 AdminView.test.tsx 를 under-declare — free-text 마크업 제거에 따른 불가피한 test 갱신이라 fold-in 불요.
