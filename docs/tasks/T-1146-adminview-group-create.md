---
id: T-1146
title: AdminView 그룹 생성 mutation 배선 (POST /api/groups)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-028, REQ-049]
estimatedDiff: 200
estimatedFiles: 2
created: 2026-07-23
independentStream: web-admin-group
dependsOn: []
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.test.tsx
plannerNote: P6 PLAN line120 Admin 그룹 관리 create slice — 그룹은 현재 read-only(select+멤버관리) 뿐, 그룹 생성 UI 부재. T-1143 runCreatePerson 패턴 mirror, pr web 2파일
---

# T-1146 — AdminView 그룹 생성 mutation 배선 (POST /api/groups)

## Why

P6 frontend Admin 패널의 그룹 관리(PLAN.md line120, REQ-028 임의 Group 등록 / REQ-049 Admin 패널)에서 **그룹 자체의 생성 UI 가 부재**하다. 현재 AdminView 는 `GROUPS_PATH` 로 그룹 목록을 read-only 로만 조회해 select 드롭다운과 멤버 관리(추가 T-1131 / 제거 T-1130)에 쓸 뿐, 새 그룹을 만들 방법이 없다. backend `POST /api/groups`(`src/user/group.controller.ts` `@Post()` + `CreateGroupDto { name }`)는 이미 shipped 이므로, 인원 생성(T-1143 `runCreatePerson`)에서 검증된 패턴을 그대로 mirror 해 그룹 생성 폼을 배선한다. 인원 관리 CRUD 시퀀스(T-1141~T-1145)와 동형인 그룹 관리 CRUD 의 첫 mutation slice 다.

## Required Reading

- `web/src/views/AdminView.tsx` — 기존 인원 생성 배선(`runCreatePerson`·`buildPersonsPath`·`personsRefreshNonce`)과 그룹 조회부(`GROUPS_PATH`, line 61 / `useApiResource<GroupRow[]>(GROUPS_PATH)`, line 1702). `GROUPS_PATH` 를 nonce-aware `buildGroupsPath(nonce)` 로 전환하고 `groupsRefreshNonce` state + `runCreateGroup` 러너 + 생성 폼을 추가한다.
- `web/src/views/AdminView.test.tsx` — 기존 인원 생성 mutation 테스트 패턴(happy/error/분기/negative — trim 가드·in-flight·nonce bump·재조회). 그룹 생성도 동형으로 커버.
- `src/user/dto/create-group.dto.ts` — 생성 payload 계약(`name: string` 단일 필드, `@IsString`+`@IsNotEmpty`). 폼 입력 1종을 이 계약에 맞춘다. Group.name 은 `@unique` 미정의라 서비스가 P2002→409 변환 없이 raw forward — UI 는 409 를 특수 분기하지 않고 일반 error 로 표면화.

## Acceptance Criteria

- [ ] `GROUPS_PATH` 상수를 `buildGroupsPath(nonce)` 빌더로 전환(nonce query 를 붙여 생성 성공 후 재조회 유발). 기존 정적 `GROUPS_PATH` 를 참조하던 `useApiResource<GroupRow[]>` 호출을 `buildGroupsPath(groupsRefreshNonce)` 로 교체. `personsRefreshNonce` mirror.
- [ ] `AdminView` 에 그룹 생성 폼(name controlled input + "그룹 추가" 버튼) + `runCreateGroup(name, deps)` 순수 async 러너 추가. 러너는 (1) trim 후 빈/공백 name 가드(no-op — 불필요 POST 미발사), (2) creating in-flight 이중 POST 가드, (3) 성공 시 `groupsRefreshNonce` bump 재조회 + 입력 초기화, (4) 실패 시 사람-친화 error state 표면화(throw 없음, no-throw), (5) finally 진행 off 를 수행한다. body 는 `{ name: name.trim() }`(T-1143 `runCreatePerson` mirror).
- [ ] `apiClient`/`useApiResource`/backend `src/` 수정 0(ADR-0041 Decision 1 — 기존 fetch hook 재사용만).
- [ ] happy-path unit test 1+: `runCreateGroup` 정상 POST(올바른 path `/api/groups`·method POST·body `{ name }`·성공 시 `groupsRefreshNonce` bump 재조회·입력 초기화), `buildGroupsPath` 가 nonce 를 query 로 반영하는지.
- [ ] error path unit test 1+: POST 400/409/network 실패 시 error state 표면화(setCreateGroupError)·nonce 미bump·throw 없음.
- [ ] flow / 분기 test: trim 후 빈 name 가드(POST 미발사), 공백-only 입력 가드, creating in-flight 재발사 차단, `buildGroupsPath` nonce 0/>0 분기 각각 test.
- [ ] negative cases 충분 cover: 앞뒤 공백 name → trim 후 body 반영, 재클릭 이중 POST 차단, reject 시 finally 진행 off 복구, 성공 후 입력 필드 초기화 확인 — 각 1+ test.
- [ ] `web/` 테스트 전체 통과(`pnpm --dir web test`), `pnpm --dir web build`(tsc --noEmit + vite build) green, lint clean. (web 은 vitest — jest `coverageThreshold` 무관, 기존 web 테스트 관행 준수: 신규 심볼 happy/error/분기/negative 충분 cover.)

## Out of Scope

- backend `src/` 변경(POST /api/groups 이미 shipped — 서버 계약 손대지 않음).
- `apiClient.ts`·`useApiResource.ts` 수정(ADR-0041 D1 — 기존 fetch hook 재사용만).
- 그룹 수정(PATCH /api/groups/:id)·삭제(DELETE /api/groups/:id) mutation — 별도 후속 slice(그룹 CRUD edit/delete).
- 별도 `GroupList` presentational 컴포넌트 신설 — 본 task 는 기존 그룹 select 조회부 재조회만 갱신, 목록 카드 UI 는 별도 slice.
- Group.name 중복(409) 특수 UI 분기 — Group.name 은 `@unique` 미정의라 서버가 409 를 거의 안 던짐, 일반 error 표면화로 충분.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음)
