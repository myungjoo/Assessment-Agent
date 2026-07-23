---
id: T-1149
title: AdminView 그룹 삭제 mutation 배선 DELETE /api/groups/:id
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-049, REQ-028]
estimatedDiff: 200
estimatedFiles: 2
created: 2026-07-24
independentStream: web-admin-group
dependsOn: [T-1148]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.test.tsx
plannerNote: "P6 line120 Admin 그룹관리 — T-1148 GroupList 마운트 후 delete slice. DELETE /api/groups/:id 배선. GroupList onDelete prop 기존재(T-1147) → AdminView 2파일만. T-1144 person-delete mirror, R-112 backbone × 1.5."
---

# T-1149 — AdminView 그룹 삭제 mutation 배선 DELETE /api/groups/:id

## Why

P6 PLAN.md line120 "Admin 패널 (인원·그룹…)" 의 그룹 관리 UI 는 presentational(T-1147 `GroupList`)·mount(T-1148, 읽기 전용 목록 섹션)·create(T-1146) 까지 배선됐다. 본 slice 는 그룹 CRUD 의 delete 를 채워 `DELETE /api/groups/:id`(group.controller.ts `@Delete(":id")` L187, 204 No Content, row 부재 404) 를 AdminView 그룹 관리 섹션에 배선한다. 직전 인원 삭제 slice(T-1144, `runDeletePerson` + `PersonList` onDelete)와 동형 mirror 이며, `GroupList` 는 이미 `onDelete?` prop 을 갖고 있어(T-1147, 미전달 시 버튼 미렌더) 컴포넌트 파일 수정 없이 AdminView 배선만으로 삭제 버튼을 표면화한다. REQ-049(Admin 그룹 관리)·REQ-028(임의 Group 관리) cover.

## Required Reading

- `web/src/views/AdminView.tsx` — 특히:
  - `runCreateGroup`(L1433) 순수 러너 패턴 — 본 slice 의 `runDeleteGroup` mirror 대상. deps 주입 방식(`deps.create(...)` → `deps.delete(...)`)과 성공 시 `groupsRefreshNonce` bump(L1419 부근), 실패 시 error state 안전 설정(no-throw) 컨벤션 참조.
  - `groupsRefreshNonce`(L1793)·`buildGroupsPath`(L622)·`GROUPS_PATH`(L65) — 삭제 성공 시 GET /api/groups 재조회 트리거에 재사용(신규 path 상수 0).
  - `handleCreateGroup`(L1906) — 컨테이너 콜백 배선 패턴. 본 slice 의 `handleDeleteGroup` mirror.
  - 마운트된 `<GroupList ... />` 섹션(T-1148 배선, `groups`/`loading`/`error` props 전달 부, 약 L3130~) — 여기에 `onDelete={handleDeleteGroup}` 를 추가한다.
- `web/src/components/GroupList.tsx` — `onDelete?: (id: string) => void` prop 이미 존재(L51, 미전달 시 삭제 버튼 미렌더). **본 slice 는 이 파일을 수정하지 않는다**(배선만).
- `web/src/views/AdminView.test.tsx` — 기존 그룹 create / person delete(runDeletePerson) spec 컨벤션(mutation 러너 test 패턴, apiClient mock 방식) 참조해 회귀 없이 그룹 삭제 test 추가.
- `src/user/group.controller.ts`(L187~189 `@Delete(":id")`) — DELETE 계약(204, row 부재 404) 확인만(수정 금지).

## Acceptance Criteria

- [ ] `AdminView.tsx` 에 `runDeleteGroup` 순수 러너 + `handleDeleteGroup` 콜백 배선 추가 — `DELETE /api/groups/:id` 호출, 성공 시 `groupsRefreshNonce` bump 로 GET /api/groups 재조회, 실패 시 error state 안전 설정(no-throw), in-flight 이중 DELETE 가드(삭제 중 id 추적). `buildGroupsPath`·`groupsRefreshNonce`·`GROUPS_PATH` 재사용(신규 path 상수 0). `runCreateGroup` 러너 구조 mirror.
- [ ] 마운트된 `<GroupList />` 에 `onDelete={handleDeleteGroup}` 전달 — 각 그룹 행에 삭제 버튼이 렌더되도록 배선. 기존 read/create/멤버 패널 배선은 손대지 않는다.
- [ ] `GroupList.tsx` / apiClient / useApiResource / backend 파일 수정 0(배선만).
- [ ] happy-path unit test 1+ — `runDeleteGroup` 정상 삭제 후 `groupsRefreshNonce` bump·재조회 유발 검증, `onDelete(id)` 호출 시 DELETE 발화 검증.
- [ ] error path unit test 1+ — DELETE 404(row 부재)·403(권한 부족)·network 실패 각각 error state 설정·throw 안 함 검증(예외 분기마다 1+).
- [ ] 분기/flow test — in-flight 가드(중복 클릭 시 두 번째 DELETE 미발화)·`onDelete` 미전달 시 버튼 미렌더 각 분기 1+.
- [ ] negative cases 충분 cover — 빈/비정상 id no-op, 삭제 실패 후 목록 유지, 재조회 전 상태 안전(unmount race), 이중 삭제 방지 등 예외 분기마다 1+.
- [ ] `pnpm --dir web test` (vitest) 및 `pnpm --dir web build` green.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). web 테스트는 vitest coverage 로 확인.

## Out of Scope

- 그룹 수정(PATCH /api/groups/:id) mutation — 별도 후속 slice(T-1150 예정, group.controller `@Patch(":id")` L176).
- 삭제 확인 다이얼로그(confirm modal) — 단순 버튼 배선까지만. 필요 시 Follow-up.
- 그룹 멤버(persons) cascade 삭제 UX·경고 — backend 계약 그대로 수용, UI 경고 미도입.
- `GroupList` 정렬·필터·페이지네이션.
- backend group.controller / service / DTO 변경.
- 다른 stream(인원·LLM provider·permission-denied·재평가) 파일 변경.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음)
