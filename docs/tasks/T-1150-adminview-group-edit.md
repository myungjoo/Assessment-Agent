---
id: T-1150
title: AdminView 그룹 수정 mutation 배선 PATCH /api/groups/:id
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-049, REQ-028]
estimatedDiff: 210
estimatedFiles: 2
created: 2026-07-24
independentStream: web-admin-group
dependsOn: [T-1149]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.test.tsx
plannerNote: "P6 line120 Admin 그룹관리 — T-1149 delete 후 edit slice 로 그룹 CRUD 완결. PATCH /api/groups/:id (name-only). GroupList onEdit prop 기존재(T-1147) → AdminView 2파일만. T-1145 person-edit mirror, R-112 backbone × 1.5."
---

# T-1150 — AdminView 그룹 수정 mutation 배선 PATCH /api/groups/:id

## Why

P6 PLAN.md line120 "Admin 패널 (인원·그룹…)" 의 그룹 관리 UI 는 presentational(T-1147 `GroupList`)·mount(T-1148)·create(T-1146)·delete(T-1149) 까지 배선됐다. 본 slice 는 그룹 CRUD 의 update 를 채워 `PATCH /api/groups/:id`(group.controller.ts `@Patch(":id")` L176, `UpdateGroupDto` L174 주석대로 `name` partial update 만 지원, row 부재 404, 빈/비정상 name 400)를 AdminView 그룹 관리 섹션에 배선한다. 직전 인원 수정 slice(T-1145, `runUpdatePerson` + `PersonList` onEdit + 인라인 수정 폼)와 동형 mirror 이나 그룹은 편집 필드가 `name` 하나뿐이라 person(fullName/email/active) 보다 단순하다. `GroupList` 는 이미 `onEdit?` prop 을 갖고 있어(T-1147, 미전달 시 버튼 미렌더) 컴포넌트 파일 수정 없이 AdminView 배선만으로 수정 버튼을 표면화한다. 본 slice 로 Admin 그룹 관리 CRUD(read/create/delete/update) 가 완결된다. REQ-049(Admin 그룹 관리)·REQ-028(임의 Group 관리) cover.

## Required Reading

- `web/src/views/AdminView.tsx` — 특히:
  - `runUpdatePerson`(L1672 부근) + `buildPersonPatch`(L1616) 순수 러너 패턴 — 본 slice 의 `runUpdateGroup` mirror 대상. 단 그룹은 편집 필드가 `name` 하나뿐이라 `buildPersonPatch` 같은 다필드 diff 조립 불필요(빈/미변경 name 가드만). deps 주입(`deps.patch(...)`)·성공 시 `groupsRefreshNonce` bump·실패 시 error state 안전 설정(no-throw)·in-flight 이중 PATCH 가드·편집 종료 콜백 주입 컨벤션 참조.
  - `runCreateGroup`(L1433)·`groupsRefreshNonce`(L1852)·`buildGroupsPath`(L1857 부근)·`GROUPS_PATH`(L65 부근) — 수정 성공 시 GET /api/groups 재조회 트리거에 재사용(신규 path 상수 0).
  - `handleUpdatePerson`(L2108) + 인원 수정 인라인 폼(L3155 부근, editing id state·prefill·저장/취소) — 본 slice 의 `handleUpdateGroup` + 그룹 인라인 수정 폼 mirror. 편집 대상 `editingGroupId` state + name input prefill.
  - 마운트된 `<GroupList ... onDelete={handleDeleteGroup} />` 섹션(T-1148/T-1149 배선) — 여기에 `onEdit={handleEditGroup}` 를 추가한다.
- `web/src/components/GroupList.tsx` — `onEdit?: (id: string) => void` prop 이미 존재(L55, 미전달 시 수정 버튼 미렌더). **본 slice 는 이 파일을 수정하지 않는다**(배선만).
- `web/src/views/AdminView.test.tsx` — 기존 그룹 create(runCreateGroup)·그룹 delete(runDeleteGroup)·인원 edit(runUpdatePerson) spec 컨벤션(mutation 러너 test 패턴, apiClient mock 방식) 참조해 회귀 없이 그룹 수정 test 추가.
- `src/user/group.controller.ts`(L176~185 `@Patch(":id")`) + `src/user/dto/update-group.dto.ts` — PATCH 계약(200, `name` 만 수정, row 부재 404, 빈/비정상 name 400) 확인만(수정 금지).

## Acceptance Criteria

- [ ] `AdminView.tsx` 에 `runUpdateGroup` 순수 러너 + `handleUpdateGroup`/`handleEditGroup` 콜백 배선 추가 — `PATCH /api/groups/:id` 호출(body `{ name }`), 성공 시 `groupsRefreshNonce` bump 로 GET /api/groups 재조회 + 편집 종료, 실패 시 error state 안전 설정(no-throw), in-flight 이중 PATCH 가드, 변경 없음/빈·공백 name 가드(미발사). `buildGroupsPath`·`groupsRefreshNonce`·`GROUPS_PATH` 재사용(신규 path 상수 0). `runUpdatePerson` 러너 구조 mirror(단 name 단일 필드라 다필드 diff 헬퍼 불요).
- [ ] 편집 대상 `editingGroupId` state + name input prefill 인라인 수정 폼 — `GroupList` 각 행 "수정" 버튼(onEdit=handleEditGroup)이 대상 id 를 세팅하면 폼이 열리고 저장/취소로 닫힌다. 마운트된 `<GroupList />` 에 `onEdit={handleEditGroup}` 전달. 기존 read/create/delete/멤버 패널 배선은 손대지 않는다.
- [ ] `GroupList.tsx` / apiClient / useApiResource / backend 파일 수정 0(배선만).
- [ ] happy-path unit test 1+ — `runUpdateGroup` 정상 수정 후 `groupsRefreshNonce` bump·재조회 유발 + 편집 종료 콜백 호출 검증, `onEdit(id)` → prefill → 저장 시 PATCH 발화(body `{ name }`) 검증.
- [ ] error path unit test 1+ — PATCH 404(row 부재)·400(빈/비정상 name)·403(권한 부족)·network 실패 각각 error state 설정·throw 안 함 검증(예외 분기마다 1+).
- [ ] 분기/flow test — in-flight 가드(중복 저장 시 두 번째 PATCH 미발화)·변경 없음/빈·공백 name 미발사·`onEdit` 미전달 시 수정 버튼 미렌더 각 분기 1+.
- [ ] negative cases 충분 cover — 빈/비정상 id no-op, 수정 실패 후 편집 상태·목록 유지, 재조회 전 상태 안전(unmount race), 이중 저장 방지, 취소 시 원복 등 예외 분기마다 1+.
- [ ] `pnpm --dir web test` (vitest) 및 `pnpm --dir web build` green.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). web 테스트는 vitest coverage 로 확인.

## Out of Scope

- 그룹 멤버(persons) 추가/제거 관리 UI(POST/DELETE `/api/groups/:id/members`) — 별도 후속 slice.
- 그룹 `active` toggle / 다른 도메인 필드 PATCH — `UpdateGroupDto` 가 `name` 만 지원(backend 계약 그대로 수용).
- 수정 확인 다이얼로그(confirm modal) — 단순 인라인 폼까지만. 필요 시 Follow-up.
- `GroupList` 정렬·필터·페이지네이션.
- backend group.controller / service / DTO 변경.
- 다른 stream(인원·LLM provider·permission-denied·재평가) 파일 변경.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음)
