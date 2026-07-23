---
id: T-1130
title: AdminView 멤버 제거 mutation 배선 (DELETE :id/members/:membershipId)
phase: P6
status: DONE
commitMode: pr
completedAt: 2026-07-23T01:44Z
prNumber: 1022
mergeCommit: 340d50a2
coversReq: [REQ-049]
independentStream: p6-frontend-composition
dependsOn: [T-1129]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.test.tsx
estimatedDiff: 150
estimatedFiles: 2
created: 2026-07-23
plannerNote: P6 line123 deferred 멤버 remove 배선 ④c — T-1129 가 노출한 membershipId 로 DELETE :id/members/:membershipId 배선, GroupMemberList onRemove 활성화
---

# T-1130 — AdminView 멤버 제거 mutation 배선 (DELETE :id/members/:membershipId)

## Why

[PLAN.md](../PLAN.md) P6 line 123 deferred 잔여 중 "GroupMember add·remove mutation" 배선의 remove slice(④c)다. backend `DELETE /api/groups/:id/members/:membershipId`([group.controller.ts](../../src/user/group.controller.ts) line 198, 204 No Content, service `removeMember(membershipId)`는 row 부재 시 P2025→NotFoundException)는 T-0057 로 이미 완결이고, 직전 T-1129 가 `GroupMemberList` 의 `Member.id` 를 **membershipId** 로 노출해 remove mutation 의 인자를 확보했다. 본 task 는 [AdminView.tsx](../../web/src/views/AdminView.tsx)에 remove async 러너(`runRemove`)와 `onRemove` 핸들러를 추가하고, 지금까지 미전달이던 `GroupMemberList` 의 `onRemove` prop 을 활성화해 각 멤버 행에 제거 버튼을 렌더한다 — REQ-049(Admin 인원·그룹 패널)의 멤버 제거를 operational 하게 만든다. `GroupMemberList` 컴포넌트는 이미 `onRemove` 를 지원(수정 0, ADR-0041 Decision 1)한다.

## Required Reading

- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) — T-1129 배선 구조. 특히 `runAssign`(line 494~)·`runImport`(line 663~)·`runApply`(line 720~) 의 **`*Deps` 주입 async 러너 convention**(busy 가드 + error/message 비움 + try/catch/finally + 낙관/롤백)을 그대로 차용한다. `buildGroupMembersPath`(line 355)·`deriveMembersFromMemberships`(line 371)·`useApiResource<MembershipRow[]>`(line 943)·GroupMemberList JSX(line 1327~1332)·`refreshNonce`/`buildMappingsPath`(line 443) cache-busting 재조회 패턴.
- [web/src/views/AdminView.test.tsx](../../web/src/views/AdminView.test.tsx) — 기존 test 패턴(러너 직접 검증 + 렌더 검증). 신규 case 를 여기에 append.
- [web/src/components/GroupMemberList.tsx](../../web/src/components/GroupMemberList.tsx) — `onRemove?: (memberId: string) => void`(line 36) 주어졌을 때만 각 행 제거 버튼 렌더(line 75~79). 컴포넌트 수정 금지.
- [web/src/api/apiClient.ts](../../web/src/api/apiClient.ts) — `request(path, options)` primitive(DELETE method 전달). `RequestOptions` 타입.
- [web/src/api/useApiResource.ts](../../web/src/api/useApiResource.ts) — path 변경 시 refetch 계약(remove 성공 후 재조회를 nonce query 로 유발).
- [src/user/group.controller.ts](../../src/user/group.controller.ts) line 198~205 `@Delete(":id/members/:membershipId")` — 204 No Content, `removeMember(membershipId)`. row 부재 시 service 가 NotFoundException(404).

## Acceptance Criteria

- [ ] `runRemove(membershipId, deps)` 순수 async 러너 추가(`runAssign`/`runImport` 의 `*Deps` 주입 convention 차용): 빈/falsy `membershipId` → 미발사, `removing`(이전 mutation 미완) → 미발사(이중 DELETE·경합 가드), 발사 시 진행 on + 직전 error 비움 → `DELETE /api/groups/${selectedGroupId}/members/${membershipId}`(groupId·membershipId 는 `encodeURIComponent` 안전 인코딩) → 성공(멤버십 재조회 트리거) / 실패(사람-친화 문구 표면화, throw 없음) → 진행 off(finally 공통).
- [ ] 멤버십 재조회 트리거 배선: `buildGroupMembersPath` 가 cache-busting nonce(`_r`)를 받도록 확장(`buildMappingsPath` 동형 — nonce 0 이면 깨끗한 path)하고, `membersRefreshNonce` state 를 remove 성공 시 +1 해 `useApiResource<MembershipRow[]>` 재조회를 유발한다. 선택 그룹 변경 refetch(path 변경) 는 유지한다.
- [ ] `GroupMemberList` 에 `onRemove` 핸들러(handleRemove) 전달 → 각 멤버 행에 제거 버튼 렌더. `loading`/`error` props 는 멤버십 조회와 remove mutation 을 합성(`removing || membersLoading` / `removeError || membersError`, mutation 우선). `GroupMemberList.tsx` 는 **수정하지 않는다**(ADR-0041 Decision 1).
- [ ] Happy-path test(1+): `runRemove` 가 올바른 DELETE path(`/api/groups/<gid>/members/<mid>`)로 `request` 를 method DELETE 로 호출하고, 성공 시 재조회 nonce 를 bump(setter 호출) + error 미설정임을 검증. 렌더 test: `onRemove` 전달 시 각 행에 제거 버튼이 렌더되고 클릭 시 해당 행의 membershipId 로 콜백이 호출됨을 검증.
- [ ] Error path test(1+): DELETE 가 reject(예: 404 NotFound / 403 Admin+ 미만 / 네트워크 0)일 때 `setRemoveError` 가 사람-친화 문구로 설정되고 재조회 nonce 는 bump 되지 않으며 throw 가 새어나오지 않음을 검증(각 분기 최소 하나).
- [ ] 분기 test: (a) 빈/falsy membershipId → DELETE 미발사 / (b) `removing===true`(이전 mutation 미완) → 미발사(이중 DELETE 가드) / (c) 정상 발사 → DELETE 1회. 각 분기 1+ test. `buildGroupMembersPath` 의 nonce 분기(0 → 깨끗한 path, >0 → `_r` 부착) 각 1+.
- [ ] Negative test 충분 cover: membershipId 에 특수문자 포함 시 `encodeURIComponent` 로 path 안전 인코딩됨, finally 가 성공·실패 어느 경로든 `setRemoving(false)` 로 복구함, remove 성공 후 재조회 도착 전 상태에서 crash 없음 — 각 1+ test.
- [ ] `pnpm --filter web test`(vitest) 전량 통과 — 신규 러너/핸들러의 happy/error/각 분기/negative 를 모두 cover. (web 은 jest coverageThreshold 미적용 스택이나, 위 4종 test 로 신규 로직 branch 를 충분 cover 한다.)
- [ ] `pnpm --filter web build`(tsc --noEmit + vite build) 통과 — 타입 회귀 없음.

## Out of Scope

- 멤버 추가(add) mutation(`POST :id/members`) 배선 — 별도 follow-up slice.
- 제거 전 확인 다이얼로그(confirm) UI — 본 slice 는 즉시 발사(runAssign 동형). 필요 시 follow-up.
- 낙관적 목록 제거(재조회 도착 전 행 즉시 제거) — 본 slice 는 재조회로 갱신(nonce refetch)만. 낙관 override 는 follow-up.
- `GroupMemberList.tsx` / `useApiResource.ts` / `apiClient.ts` 수정 — 기존 계약만 사용(ADR-0041 Decision 1).
- backend([group.controller.ts](../../src/user/group.controller.ts)/[group.service.ts](../../src/user/group.service.ts)) 변경 — DELETE endpoint 는 T-0057 로 이미 완결.
- axios/react-query 등 새 data-fetch 라이브러리 도입(ADR-0040 §5 게이트 — native fetch/`useApiResource`/`apiClient.request` 만).
- api.md 갱신(DELETE endpoint row 는 T-0057 이 이미 박제).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — sub-agent 가 관련 작업 발견 시 여기 append)
