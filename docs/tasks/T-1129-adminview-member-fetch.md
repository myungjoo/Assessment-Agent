---
id: T-1129
title: AdminView 멤버 목록을 GET /api/groups/:id/members 로 fetch + membershipId 노출
phase: P6
status: DONE
mergedAs: 622681e6
prNumber: 1021
reviewRounds: 1
commitMode: pr
coversReq: [REQ-049]
independentStream: p6-frontend-composition
dependsOn: [T-1128]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.test.tsx
estimatedDiff: 130
estimatedFiles: 2
created: 2026-07-23
plannerNote: P6 line123 deferred 멤버 remove 배선 ④b — T-1128 GET members endpoint 를 AdminView 가 실 fetch, membershipId 노출로 ④c remove mutation 언블록
---

# T-1129 — AdminView 멤버 목록을 GET /api/groups/:id/members 로 fetch + membershipId 노출

## Why

[PLAN.md](../PLAN.md) P6 line 123 deferred 잔여 중 "GroupMember add·remove mutation" 배선의 선행 slice(④b)다. T-1128 이 backend `GET /api/groups/:id/members`(각 membership 의 `id`/`personId`/`groupId` 반환, [group.service.ts](../../src/user/group.service.ts) `findMembershipsByGroupId`)를 신설해 API gap 을 메웠으나, frontend([AdminView.tsx](../../web/src/views/AdminView.tsx))는 여전히 `GET /api/groups` 응답의 `members`/`persons` 필드를 client-side 로 파생할 뿐 이 신 endpoint 를 호출하지 않는다. 본 task 는 선택 그룹의 membership 을 신 endpoint 로 실 fetch 하고, `GroupMemberList` 의 `Member.id` 를 **membershipId** 로 노출한다 — 후속 ④c(remove mutation, `DELETE :id/members/:membershipId` 배선)의 인자(membershipId)를 확보해 REQ-049(Admin 인원·그룹 패널)를 진전시킨다.

## Required Reading

- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) — 현 그룹 목록 조회 + 멤버 client-side 파생 구조(④a). `deriveMembers`/`findGroup` helper, `GROUPS_PATH`, `useApiResource` 사용 패턴.
- [web/src/views/AdminView.test.tsx](../../web/src/views/AdminView.test.tsx) — 기존 test 패턴(신규 case 를 여기에 append).
- [web/src/api/useApiResource.ts](../../web/src/api/useApiResource.ts) — 조건부 조회 계약: `path === null`(falsy)이면 fetch 미수행, `path` 변경 시 refetch. 반환 `{ data, loading, error }`.
- [web/src/components/GroupMemberList.tsx](../../web/src/components/GroupMemberList.tsx) — presentational: `members: Member[]`(각 `id` = React key 이자 `onRemove` 인자), `loading`/`error`/`emptyMessage`/`onRemove?` props.
- [src/user/group.service.ts](../../src/user/group.service.ts) line 277~298 `findMembershipsByGroupId` — 반환 shape(`id`/`personId`/`groupId`/`createdAt`, Person 미조인). membershipId = `PersonGroupMembership.id`.
- [docs/architecture/api.md](../architecture/api.md) — `GET /api/groups/:id/members`(T-1128) row 확인.

## Acceptance Criteria

- [ ] AdminView 가 선택 그룹이 있을 때만 `GET /api/groups/${selectedGroupId}/members` 를 `useApiResource` 로 fetch 한다(조건부 조회 — 선택 없으면 `path=null` 로 미조회). 응답 membership 배열에서 `Member[]` 를 파생하되 각 `Member.id` = membership 의 `id`(membershipId)로 설정한다. member 표시명은 기존 그룹 응답의 person(personId 매칭)에서 채우고, 매칭 부재 시 안전한 fallback 문구를 쓴다.
- [ ] 파생된 `Member[]` 를 `GroupMemberList` 에 전달하고, 멤버 fetch 의 `loading`/`error` 상태를 `GroupMemberList` 의 대응 props 로 배선한다. `onRemove` 는 본 slice 범위 밖이므로 전달하지 않는다(remove 버튼 미렌더 — ④c follow-up).
- [ ] Happy-path test: 선택 그룹 존재 + membership 응답 1+ 일 때 신 endpoint 를 올바른 path 로 호출하고, 각 행의 `id` 가 membershipId 로, 표시명이 매칭 person 이름으로 렌더됨을 검증(1+).
- [ ] Error path test: 멤버 fetch 가 error 를 반환할 때 `GroupMemberList` 가 error 를 표시함을 검증(1+). person 매칭 실패(personId 부재) 시 fallback 명으로 렌더됨을 검증.
- [ ] 분기 test: (a) 선택 그룹 없음 → 멤버 endpoint 미호출(path=null, idle) / (b) 선택 그룹 있고 membership 0 → 빈 상태 문구 / (c) membership 1+ → 목록. 각 분기 1+ test.
- [ ] Negative test 충분 cover: membership 응답이 빈 배열·undefined 인 경우 crash 없이 빈 상태, membershipId 중복 없이 React key 안정, person 매칭 배열 미도착(undefined) 시 fallback — 각 1+ test.
- [ ] `pnpm --filter web test`(vitest) 전량 통과 — 신규 파생 로직의 happy/error/각 분기/negative 를 모두 cover. (web 은 jest coverageThreshold 미적용 스택이나, 위 4종 test 로 신규 로직 branch 를 충분 cover 한다.)
- [ ] `pnpm --filter web build`(tsc --noEmit + vite build) 통과 — 타입 회귀 없음.

## Out of Scope

- `onRemove`/`DELETE :id/members/:membershipId` remove mutation 배선(④c follow-up).
- 멤버 추가(add) mutation.
- `useApiResource` 에 manual refetch/refresh 추가(본 slice 는 path-change refetch 로 충분).
- backend([group.service.ts](../../src/user/group.service.ts)) 의 Person include shape 변경 — 표시명은 기존 그룹 응답에서 매칭한다.
- axios/react-query 등 새 data-fetch 라이브러리 도입(ADR-0040 §5 게이트 — native fetch/`useApiResource` 만).
- api.md 갱신(신 endpoint row 는 T-1128 이 이미 박제).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — sub-agent 가 관련 작업 발견 시 여기 append)
