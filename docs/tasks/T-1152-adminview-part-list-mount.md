---
id: T-1152
title: AdminView 에 PartList 마운트 (GET /api/parts 조회 추가, 읽기 전용 파트 목록 섹션)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-049, REQ-028]
estimatedDiff: 180
estimatedFiles: 2
created: 2026-07-24
independentStream: web-admin-part
dependsOn: [T-1151]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.test.tsx
plannerNote: "P6 line120 Admin 파트 관리 — T-1151 PartList presentational 을 AdminView 에 마운트. 기존 파트 fetch 부재라 GET /api/parts useApiResource 신규 추가(그룹 T-1148 은 재사용, 파트는 신규). 읽기 전용 목록 섹션. pr web 2파일"
---

# T-1152 — AdminView 에 PartList 마운트 (GET /api/parts 조회 추가, 읽기 전용 파트 목록 섹션)

## Why

P6 PLAN.md line120 Admin 패널 bullet 은 관리 대상으로 "인원·그룹·파트·재평가·import/export·스케줄" 을 명시하고, README 85행("Admin은 … 인원 Group/파트 편집 등을 할 수 있다")·REQ-028(다중 임의 Group + **단일 조직도 파트**)이 파트 관리 UI 를 요구한다. 직전 그룹 관리 UI(presentational T-1147 → mount T-1148 → create T-1146 → delete T-1149 → update T-1150)와 동형으로 파트 관리 UI 도 presentational-first 로 진행 중이며, 읽기 전용 presentational 컴포넌트 `PartList`(T-1151, `web/src/components/PartList.tsx`)는 신설됐으나 **아직 어느 화면에도 마운트되지 않아 사람이 파트 목록 카드를 볼 수 없다**. 본 slice 는 직전 T-1148(GroupList 마운트)과 동일한 방식으로 AdminView 에 `PartList` 를 별도 섹션으로 마운트한다.

단, 한 가지 도메인 차이가 있다 — 그룹 마운트(T-1148)는 AdminView 가 이미 `<select>` 드롭다운용으로 그룹을 조회 중이라 그 기존 fetch 를 재사용했으나, **AdminView 는 현재 파트를 전혀 조회하지 않는다**(파트 관련 fetch·select·state 부재). 따라서 본 slice 는 `useApiResource<PartRow[]>(PARTS_PATH)` 조회를 **신규로 추가**한다(재사용 대상 없음). 파트는 생성 slice 가 아직 없으므로 refresh nonce 빌더 없이 단순 상수 path(`PARTS_PATH = '/api/parts'`, SCHEDULES_PATH 동형)로 조회하고, 생성 성공 재조회용 nonce-aware 빌더(buildGroupsPath 동형)는 후속 create slice 가 도입한다. 파트 삭제/수정 mutation 배선도 이후 별도 slice 책임(Out of Scope). REQ-049(Admin 관리 UI)·REQ-028(단일 조직도 파트 표면화) cover.

## Required Reading

- `web/src/views/AdminView.tsx` — 마운트 대상 컨테이너. 특히:
  - 단순 상수 path 조회 예: `const SCHEDULES_PATH = '/api/schedules'`(약 line 271) + `useApiResource<string[]>(SCHEDULES_PATH)`(약 line 2858). 본 slice 는 이 형태로 `const PARTS_PATH = '/api/parts'` + `useApiResource<PartRow[]>(PARTS_PATH)` 를 신규 추가한다(그룹처럼 nonce 빌더 불필요 — 생성 slice 부재).
  - heading 상수 컨벤션: `const PERSON_HEADING = '인원 관리'`(약 line 75)·`const GROUP_HEADING = '그룹 관리'`(약 line 79). 본 slice 는 `const PART_HEADING = '파트 관리'` 를 추가한다.
  - 그룹 목록 섹션 배선(약 line 3403~3467, `<section aria-label={GROUP_HEADING}>` + `<GroupList groups={data ?? []} loading={groupLoading} error={groupError} />`, `onDelete`/`onEdit` 미전달 = 읽기 전용)을 mirror 해 파트 섹션을 만든다.
  - AdminView 에는 로컬 `PartRow` 가 없다(파트 미사용 확인). 그룹 마운트(T-1148)가 로컬 `GroupRow` 이름 충돌 때문에 named import 를 피한 것과 달리, 본 slice 는 `PartList` 의 named `PartRow` 를 그대로 import 해 조회 제네릭·props 타입에 쓸 수 있다(충돌 없음).
- `web/src/components/PartList.tsx` — 마운트할 컴포넌트. `export default PartList` + `export type { PartRow, PartListProps }`. props: `parts: PartRow[]` / `loading?` / `error?` / `emptyMessage?` / optional `onDelete?` / `onEdit?`. 컴포넌트 파일 수정 0. 본 slice 는 `onDelete`/`onEdit` 를 **전달하지 않는다**(읽기 전용 마운트 — 버튼 미렌더).
- `web/src/api/useApiResource.ts` — fetch hook 계약(`useApiResource<T>(path)` → `{ data, loading, error }`). 수정 0.
- `web/src/views/AdminView.test.tsx` — colocated test. 기존 useApiResource / apiClient mock 방식과 다른 패널(그룹·인원) 마운트 test 구성을 참조해 회귀 없이 파트 목록 섹션 test 를 추가한다. 파트 조회 mock 을 추가할 때 기존 그룹·인원·멤버십·provider·schedules 조회 mock 이 깨지지 않도록 path 분기 mock 을 확장한다.
- `src/user/part.controller.ts`(L58~131, `@Get()` `GET /api/parts` 파트 배열 반환) + `prisma/schema.prisma`(L114~122 `model Part` — id/name(@unique)/persons) — 응답 shape 확인만(수정 금지 — 읽기 참조).

## Acceptance Criteria

- [ ] `web/src/views/AdminView.tsx` 에 `PartList`(default) 와 `PartRow`(named type) 를 `web/src/components/PartList` 에서 import 하고, `const PARTS_PATH = '/api/parts'`(SCHEDULES_PATH 동형 상수) + `const PART_HEADING = '파트 관리'` 를 추가한다. 컴포넌트 파일·backend·useApiResource·apiClient 수정 0.
- [ ] `useApiResource<PartRow[]>(PARTS_PATH)` 조회를 **신규로 추가**해 `{ data: partsData, loading: partLoading, error: partError }`(변수명에 part prefix — 다른 조회 상태와 미혼동, groupLoading/groupError 동형)로 destructure 한다. 그룹처럼 재사용할 기존 파트 fetch 는 없으므로 신규 호출이 정당하다(double-fetch 대상 부재).
- [ ] `<section aria-label={PART_HEADING}>` + `<h2>{PART_HEADING}</h2>` 별도 섹션에 `<PartList parts={partsData ?? []} loading={partLoading} error={partError} />` 를 마운트한다. `data` 가 `undefined`(미조회/진행 중/실패)일 때 `partsData ?? []` 로 빈 배열을 안전하게 넘겨 throw 없이 렌더. `onDelete`/`onEdit` 는 전달하지 않는다(삭제/수정 mutation 은 후속 slice — 버튼 미렌더). 기존 인원·그룹·멤버·provider·schedules 섹션 배선은 손대지 않는다.
- [ ] **Happy-path test**: 파트 fetch 가 파트 1+ 를 반환하면 AdminView 렌더의 파트 관리 섹션(`aria-label='파트 관리'`)에 각 파트 name 이 표면화되는지 1+ test(`useApiResource` 또는 `apiClient.request` mock 의 `/api/parts` 분기).
- [ ] **Error path test**: 파트 fetch 가 error 를 반환(예: 401/네트워크)하면 파트 관리 섹션이 `role="alert"` 에러 표면을 렌더하고 목록은 미렌더하는지 1+ test.
- [ ] **분기/flow test**: loading 중(로딩 표면 우선) / 빈 배열(빈 상태 문구) / populated 각 분기 1+ test. 기존 AdminView 다른 패널 test(인원·그룹·select·생성·멤버·provider·schedules)는 회귀 없이 유지.
- [ ] **Negative cases 충분 cover**: 경계·예외 각 1+ — `data` undefined 시 `partsData ?? []` 로 throw 없이 렌더 / `name` 없는 파트 행이 placeholder 로 throw 없이 렌더 / 다건 파트 key 중복 없음 / `onDelete`/`onEdit` 미전달이므로 각 행에 삭제·수정 버튼이 렌더되지 않음(읽기 전용 검증) / loading 이 error 보다 우선(둘 다 truthy) / 파트 조회 mock 추가가 기존 그룹·인원 등 조회 mock 을 깨지 않음. 단일 negative 만 두지 않는다.
- [ ] `pnpm --dir web test`(vitest) 통과 + `pnpm --dir web build`(tsc/vite) green, lint clean.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). web 테스트는 vitest coverage 로 확인.

## Out of Scope

- 파트 생성(POST /api/parts) 폼·refresh nonce 빌더(buildGroupsPath 동형) 도입 — 후속 create slice(그때 PARTS_PATH 를 `buildPartsPath(nonce)` 로 전환).
- 파트 삭제(DELETE /api/parts/:id)·수정(PATCH /api/parts/:id) mutation 러너·버튼 배선 — 각각 별도 후속 slice(본 task 는 `onDelete`/`onEdit` 미전달 = 읽기 전용 마운트까지만).
- 파트 소속 인원(persons) 관리 UI(`GET /api/parts/:id/persons` 조회·재배정) — 별도 후속 slice.
- 필터/정렬/페이지네이션(상위 컨테이너 책임).
- `PartList` 컴포넌트 자체 수정, `useApiResource`/`apiClient`/backend/prisma schema 수정.
- api.md 갱신(endpoint 이미 박제됨).
- 다른 stream(인원·그룹·LLM provider·permission-denied·스케줄·재평가) 파일 변경.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
