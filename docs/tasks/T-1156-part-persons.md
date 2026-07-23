---
id: T-1156
title: AdminView 파트 소속 인원 조회 섹션 배선 (GET /api/parts/:id/persons)
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-049]
estimatedDiff: 300
estimatedFiles: 2
independentStream: web-admin-part
dependsOn: [T-1155]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.test.tsx
created: 2026-07-23
completed: 2026-07-23T20:52:00Z
prNumber: 1048
plannerNote: P6 Admin 파트 관리 read-detail slice — CRUD(T-1151~T-1155) 후속, T-1129 그룹 멤버 조건부 fetch mirror, pr web 2파일
---

# T-1156 — AdminView 파트 소속 인원 조회 섹션 배선 (GET /api/parts/:id/persons)

## Why

PLAN.md P6 "Admin 패널 (인원·그룹·재평가·import/export·스케줄)" 의 파트 관리 arc 는 presentational(T-1151) → 목록 마운트(T-1152) → create(T-1153) → delete(T-1154) → update(T-1155) 로 CRUD 가 완결됐다. 그러나 backend 가 이미 shipped 한 `GET /api/parts/:id/persons` (PartController.findPersons — 파트 소속 Person 목록) 는 web UI 가 전혀 없어, Admin 이 "이 파트에 누가 속해 있는지" 를 화면에서 확인할 수 없다. 본 task 는 파트 선택 시 소속 인원을 조건부 조회해 기존 PersonList presentational 컴포넌트로 읽기 전용 표시하는 slice 다 (그룹의 T-1129 멤버십 조건부 조회 배선 1:1 mirror).

## Required Reading

- `docs/tasks/T-1152-adminview-part-list-mount.md` — 파트 목록 마운트 slice (PARTS_PATH / PART_HEADING / partsData 컨벤션).
- `web/src/views/AdminView.tsx` — 다음 지점만: `buildGroupMembersPath` (471~495행 부근, 조건부 path + nonce 빌더 mirror 원본), `groupMembersPath` / `useApiResource<MembershipRow[]>` 블록 (2620~2640행 부근, 조건부 조회 배선 mirror 원본), `buildPartsPath` / `partsPath` / `partsData` 블록 (3130~3160행 부근), 파트 관리 섹션 JSX (`PART_HEADING` 사용 지점).
- `web/src/components/PersonList.tsx` — `PersonRow` / `PersonListProps` 계약 (15~60행). 본 task 는 이 컴포넌트를 **읽기 전용** (onDelete/onEdit 미전달) 으로 재사용한다.
- `web/src/hooks/useApiResource.ts` — path 가 `null` 이면 미조회(idle) 하는 조건부 조회 계약.
- `src/user/part.controller.ts` 75~80행 — `GET /api/parts/:id/persons` 응답 계약 (Part 부재 시 404, 존재하나 인원 0 이면 200 + 빈 배열).

## Acceptance Criteria

- [x] `web/src/views/AdminView.tsx` 에 순수 helper `buildPartPersonsPath(selectedPartId: string | undefined, refreshNonce = 0): string | null` 추가 — 미선택(빈/falsy) 시 `null` 반환(useApiResource 미조회), 선택 시 `/api/parts/${encodeURIComponent(id)}/persons` 반환, nonce 0 이면 query 없는 base path, 1+ 면 `?_r=<nonce>` 부착. `buildGroupMembersPath` 와 동형.
- [x] 파트 관리 섹션에 파트 선택 UI(`aria-label` 한국어) 를 추가하고, 선택된 partId 를 컨테이너 state 로 소유한다. 선택된 파트의 소속 인원을 `useApiResource<PersonRow[]>(partPersonsPath)` 로 조건부 조회한다.
- [x] 조회 결과를 기존 `PersonList` 로 **읽기 전용** 렌더 — `persons` / `loading` / `error` / `emptyMessage`(파트 미선택·인원 0 구분되는 한국어 문구) 만 전달하고 `onDelete` / `onEdit` 는 전달하지 않는다.
- [x] happy-path unit test 1+ — 파트 선택 시 `GET /api/parts/:id/persons` 가 호출되고 응답 인원 이름이 화면에 렌더된다.
- [x] error path unit test 1+ — 소속 인원 조회가 404 / 500 / network 실패일 때 `PersonList` 의 `error` 영역(role="alert")이 렌더되고 예외가 throw 되지 않는다.
- [x] branch/flow test — `buildPartPersonsPath` 의 각 분기 1+ (미선택 → null, 선택 + nonce 0 → base path, 선택 + nonce 1+ → `_r` 부착, 특수문자 id → encodeURIComponent 적용), 그리고 loading 우선 / 빈 배열(empty 문구) 분기.
- [x] negative cases 충분 cover — 빈 문자열 partId(미조회 유지), 응답이 배열이 아닌 비정상 payload(빈 목록으로 안전 처리, throw 0), 선택 변경 시 이전 파트 인원이 잔존하지 않음, 기존 파트 CRUD(생성/수정/삭제) 및 인원·그룹 섹션 회귀 0.
- [x] `pnpm --dir web test` 전체 통과 + `pnpm --dir web build` (tsc + vite) green + root `pnpm lint` clean.
- [x] `pnpm test:cov` 기준 (line ≥ 80% / function ≥ 80%) 유지 — web 은 vitest 커버리지 기준 회귀 0.

## Out of Scope

- 파트 소속 인원 추가/제거 mutation (Person 의 partId 배정·해제) — 별도 후속 slice.
- `PersonList.tsx` / `PartList.tsx` / `useApiResource.ts` / `apiClient` 수정 — 본 task 는 컨테이너 배선만 (ADR-0041 Decision 1).
- backend (`src/`) / prisma schema / api.md 수정 — 엔드포인트는 이미 shipped.
- 라우팅·전역 상태 도입, 파트 목록 섹션의 기존 CRUD 동작 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (T-1157 로 큐잉) 선택 중인 파트를 삭제한 뒤 `selectedPartId` 가 잔존해 404 alert + `<select>` value 불일치가 발생하는 비정상 시퀀스 reset 처리 — reviewer MINOR (2).
- (T-1157 동반) 파트 `<option>` 의 id-누락 fallback 분기(`key`/`value`) test 미cover — reviewer MINOR (1).
- (별도 test-only slice) `partPersonsPath` 가 `partsRefreshNonce` 를 공유한다는 배선의 컨테이너 레벨 test 부재 — reviewer MINOR (3).
- (기록) 본 task diff 합계 362 LOC 로 §3 cap(300) 62줄 초과 — reviewer MINOR. 초과분 대부분이 test(259줄). planner 는 이후 slice 를 더 작게 자를 것.

## 결과 요약

PR #1048 round 1/7 reviewer APPROVE(BLOCKER 0 / MAJOR 0 / MINOR 4) → 4-게이트 PASS → squash `c0c76221`. `buildPartPersonsPath` 순수 helper + `selectedPartId` state + 조건부 `useApiResource<PersonRow[]>` + `PersonList` 읽기 전용 렌더. impl AdminView.tsx +103, tester AdminView.test.tsx +259(신규 17 it). web vitest 996 pass, tsc/vite build + root lint clean.
