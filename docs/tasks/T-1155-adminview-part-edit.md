---
id: T-1155
title: AdminView 파트 수정 mutation 배선 PATCH /api/parts/:id
phase: P6
status: DONE
commitMode: pr
prNumber: 1047
mergedAs: c4c1d7352c0c890290ca3ac8ffd117820f370bfe
reviewRounds: 1
completedAt: 2026-07-23T20:22:00Z
coversReq: [REQ-028, REQ-049]
estimatedDiff: 235
estimatedFiles: 2
created: 2026-07-24
independentStream: web-admin-part
dependsOn: [T-1154]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.test.tsx
plannerNote: "P6 line120 Admin 파트관리 — T-1154 delete 후 edit slice 로 파트 CRUD 완결. PATCH /api/parts/:id(name-only, Part.name @unique→409). PartList onEdit prop 기존재(T-1151) → AdminView 2파일. T-1150 group-edit mirror + T-1153 isConflict/PART_DUPLICATE_ERROR 재사용, R-112 backbone × 1.5."
---

# T-1155 — AdminView 파트 수정 mutation 배선 PATCH /api/parts/:id

## Why

P6 PLAN.md line120 "Admin 패널 (인원·그룹·파트…)" 의 파트 관리 UI 는 presentational(T-1151 `PartList`)·mount(T-1152)·create(T-1153)·delete(T-1154) 까지 배선됐다. 본 slice 는 파트 CRUD 의 update 를 채워 `PATCH /api/parts/:id`(part.controller.ts `@Patch(":id")` L121, `UpdatePartDto` 는 `name` partial update 만 지원, row 부재 404, 빈/비정상 name 400)를 AdminView 파트 관리 섹션에 배선한다. 직전 그룹 수정 slice(T-1150, `runUpdateGroup` + `GroupList` onEdit + 인라인 name 수정 폼)와 동형 mirror 이나, **파트는 `Part.name @unique`(prisma/schema.prisma L108/L110) 라 rename 이 기존 파트명과 충돌하면 409 를 반환한다** — 이는 그룹(Group.name 미-unique, P2002 분기 부재)과 다르며, 이미 T-1153 create 가 도입한 `PART_DUPLICATE_ERROR` + `isConflict` 주입 패턴을 수정 러너에도 재사용해 409 전용 문구로 구분 표면화한다. `PartList` 는 이미 `onEdit?` prop 을 갖고 있어(T-1151, 미전달 시 버튼 미렌더) 컴포넌트 파일 수정 없이 AdminView 배선만으로 수정 버튼을 표면화한다. 본 slice 로 Admin 파트 관리 CRUD(read/create/delete/update) 가 완결된다. REQ-028(임의 Part 관리)·REQ-049(Admin 파트 관리) cover.

## Required Reading

- `web/src/views/AdminView.tsx` — 특히:
  - `runCreatePart`(L1512 부근, `CreatePartDeps`·`isConflict` 주입·`PART_DUPLICATE_ERROR` 409 전용 문구 분기·`partsRefreshNonce` bump) — 본 slice 의 `runUpdatePart` 가 재사용할 409 판정/전용 문구 패턴. `isConflict` deps 주입 컨벤션 그대로 mirror.
  - `PART_DUPLICATE_ERROR`(L101)·`buildPartsPath`(L657)·`partsRefreshNonce` — 수정 성공 시 GET /api/parts 재조회 트리거 + 409 문구에 재사용(신규 path 상수 0).
  - 그룹 수정 러너 `runUpdateGroup` + `handleUpdateGroup`/`handleEditGroup` + `editingGroupId` state + 그룹 인라인 name 수정 폼(prefill·저장/취소, T-1150 배선) — 본 slice 의 `runUpdatePart`/`handleUpdatePart`/`handleEditPart` + `editingPartId` + 파트 인라인 name 수정 폼 mirror 대상. 편집 필드가 `name` 하나뿐이라 다필드 diff 헬퍼 불요(빈/미변경 name 가드만).
  - 마운트된 `<PartList ... onDelete={handleDeletePart} />` 섹션(T-1152/T-1154 배선) — 여기에 `onEdit={handleEditPart}` 를 추가한다.
- `web/src/components/PartList.tsx` — `onEdit?: (id: string) => void` prop 이미 존재(L52, 미전달 시 수정 버튼 미렌더). **본 slice 는 이 파일을 수정하지 않는다**(배선만).
- `web/src/views/AdminView.test.tsx` — 기존 파트 create(`runCreatePart`, 409 spec 포함)·파트 delete(`runDeletePart`)·그룹 edit(`runUpdateGroup`) spec 컨벤션(mutation 러너 test 패턴, apiClient mock·isConflict mock 방식) 참조해 회귀 없이 파트 수정 test 추가.
- `src/user/part.controller.ts`(L121~127 `@Patch(":id")`) + `src/user/dto/update-part.dto.ts` — PATCH 계약(200, `name` 만 수정, row 부재 404, 빈/비정상 name 400, 동명 중복 409) 확인만(수정 금지).

## Acceptance Criteria

- [ ] `AdminView.tsx` 에 `runUpdatePart` 순수 러너 + `handleUpdatePart`/`handleEditPart` 콜백 배선 추가 — `PATCH /api/parts/:id` 호출(body `{ name }`), 성공 시 `partsRefreshNonce` bump 로 GET /api/parts 재조회 + 편집 종료, 실패가 409(중복 이름)면 `PART_DUPLICATE_ERROR` 전용 문구, 그 외(400·403·네트워크·비-2xx)는 일반 error state 안전 설정(no-throw), in-flight 이중 PATCH 가드, 변경 없음/빈·공백 name 가드(미발사). `buildPartsPath`·`partsRefreshNonce`·`PART_DUPLICATE_ERROR`·`isConflict` 재사용(신규 path 상수 0). `runUpdateGroup` 러너 구조 mirror + `runCreatePart` 의 409 판정 패턴 결합.
- [ ] 편집 대상 `editingPartId` state + name input prefill 인라인 수정 폼 — `PartList` 각 행 "수정" 버튼(onEdit=handleEditPart)이 대상 id 를 세팅하면 폼이 열리고 저장/취소로 닫힌다. 마운트된 `<PartList />` 에 `onEdit={handleEditPart}` 전달. 기존 read/create/delete 배선은 손대지 않는다.
- [ ] `PartList.tsx` / apiClient / useApiResource / backend 파일 수정 0(배선만).
- [ ] happy-path unit test 1+ — `runUpdatePart` 정상 수정 후 `partsRefreshNonce` bump·재조회 유발 + 편집 종료 콜백 호출 검증, `onEdit(id)` → prefill → 저장 시 PATCH 발화(body `{ name }`) 검증.
- [ ] error path unit test 1+ — PATCH 409(중복 이름 → `PART_DUPLICATE_ERROR` 전용 문구)·404(row 부재)·400(빈/비정상 name)·403(권한 부족)·network 실패 각각 적절한 error state 설정·throw 안 함 검증(예외 분기마다 1+). 특히 409 vs 비-409 문구 구분 검증.
- [ ] 분기/flow test — in-flight 가드(중복 저장 시 두 번째 PATCH 미발화)·변경 없음/빈·공백 name 미발사·`onEdit` 미전달 시 수정 버튼 미렌더·`isConflict` true/false 분기 각 1+.
- [ ] negative cases 충분 cover — 빈/비정상 id no-op, 수정 실패 후 편집 상태·목록 유지, 재조회 전 상태 안전(unmount race), 이중 저장 방지, 취소 시 원복 등 예외 분기마다 1+.
- [ ] `pnpm --dir web test` (vitest) 및 `pnpm --dir web build` green.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). web 테스트는 vitest coverage 로 확인.

## Out of Scope

- 파트 소속 persons 관리 UI(파트-인원 재배치) — 별도 후속/미정 slice.
- 파트 `active`/기타 도메인 필드 PATCH — `UpdatePartDto` 가 `name` 만 지원(backend 계약 그대로 수용).
- 수정 확인 다이얼로그(confirm modal) — 단순 인라인 폼까지만. 필요 시 Follow-up.
- `PartList` 정렬·필터·페이지네이션.
- backend part.controller / service / DTO / prisma schema 변경.
- 다른 stream(인원·그룹·LLM provider·permission-denied·재평가) 파일 변경.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음)
