---
id: T-1154
title: AdminView 파트 삭제 mutation 배선 (DELETE /api/parts/:id)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-028, REQ-049]
estimatedDiff: 200
estimatedFiles: 2
created: 2026-07-24
independentStream: web-admin-part
dependsOn: [T-1153]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.test.tsx
plannerNote: "P6 line120 Admin 파트관리 delete slice — 파트 arc presentational(T-1151)→mount(T-1152)→create(T-1153) 다음. DELETE /api/parts/:id 배선. PartList onDelete prop 기존재 → AdminView 2파일. T-1149 group-delete mirror, R-112 backbone × 1.5."
---

# T-1154 — AdminView 파트 삭제 mutation 배선 (DELETE /api/parts/:id)

## Why

P6 PLAN.md line120 "Admin 패널 (인원·그룹·재평가·import/export·스케줄)" 과 README 85행("Admin은 … 인원 Group/파트 편집 등을 할 수 있다")·REQ-028(단일 조직도 파트)이 요구하는 파트 관리 UI 를, 직전 그룹 관리 arc(presentational T-1147 → mount T-1148 → create T-1146 → **delete T-1149** → update T-1150)와 동형으로 진행 중이다. 파트는 presentational(T-1151) → 읽기 전용 마운트(T-1152) → 생성(T-1153) 까지 배선됐으나 **사람이 파트를 지울 방법이 없다**. 본 slice 는 그룹 삭제(T-1149 `runDeleteGroup`)에서 검증된 패턴을 1:1 mirror 해 `DELETE /api/parts/:id`(part.controller.ts `@Delete(":id")` L131, 204 No Content, row 부재 404)를 AdminView 파트 관리 섹션에 배선한다. `PartList` 는 이미 `onDelete?: (id: string) => void` prop 을 갖고 있어(T-1151, 미전달 시 삭제 버튼 미렌더) 컴포넌트 파일 수정 없이 AdminView 배선만으로 삭제 버튼을 표면화한다. 또한 T-1153 이 이미 `buildPartsPath(nonce)`·`partsRefreshNonce` 를 main 에 박제했으므로 삭제 성공 시 재조회 트리거를 신규 상수 0 으로 재사용한다. REQ-028(파트 관리)·REQ-049(Admin 관리 UI) cover.

## Required Reading

- `web/src/views/AdminView.tsx` — 특히:
  - T-1153 이 추가한 파트 생성 배선: `buildPartsPath(refreshNonce)`(L657 부근)·`partsRefreshNonce` state·`runCreatePart(name, deps)` 순수 async 러너·파트 생성 폼. 본 slice 는 이 중 `buildPartsPath`·`partsRefreshNonce` 를 삭제 성공 재조회 트리거로 재사용하고, `runCreatePart` 러너 구조를 mirror 해 `runDeletePart` 를 추가한다(신규 path 상수 0).
  - 그룹 삭제 배선(T-1149): `runDeleteGroup(id, deps)` 순수 러너(빈/공백 id 가드·in-flight 이중 DELETE 가드·`encodeURIComponent`·성공 시 `groupsRefreshNonce` bump 재조회·실패 시 error state no-throw·finally 진행 off) + `handleDeleteGroup` 콜백 + 마운트된 `<GroupList onDelete={handleDeleteGroup} />` 배선. 본 slice 는 이를 파트로 그대로 mirror 한다.
  - 마운트된 `<PartList ... />` 섹션(T-1152 배선, `parts`/`loading`/`error` props 전달 부, `aria-label` 파트 관리 섹션) — 여기에 `onDelete={handleDeletePart}` 를 추가한다.
- `web/src/components/PartList.tsx` — `onDelete?: (id: string) => void` prop 이미 존재(L48, 미전달 시 삭제 버튼 미렌더). **본 slice 는 이 파일을 수정하지 않는다**(배선만).
- `web/src/views/AdminView.test.tsx` — 기존 파트 생성(runCreatePart)·그룹 삭제(runDeleteGroup) spec 컨벤션(mutation 러너 test 패턴, apiClient mock path 분기 방식) 참조해 회귀 없이 파트 삭제 test 추가.
- `src/user/part.controller.ts`(L131 `@Delete(":id")`) — DELETE 계약(204 No Content, row 부재 404) 확인만(수정 금지 — 읽기 참조).

## Acceptance Criteria

- [ ] `AdminView.tsx` 에 `runDeletePart(id, deps)` 순수 async 러너 + `handleDeletePart` 콜백 배선 추가 — `DELETE /api/parts/:id`(id `encodeURIComponent`) 호출, 성공 시 `partsRefreshNonce` bump 로 GET /api/parts 재조회, 실패 시 error state 안전 설정(throw 없음, no-throw), 삭제 중 id 추적으로 in-flight 이중 DELETE 가드, finally 진행 off. `buildPartsPath`·`partsRefreshNonce` 재사용(신규 path 상수 0). `runDeleteGroup`(T-1149) 러너 구조 1:1 mirror.
- [ ] 마운트된 `<PartList />` 에 `onDelete={handleDeletePart}` 전달 — 각 파트 행에 삭제 버튼이 렌더되도록 배선. 기존 read/create 배선은 손대지 않는다.
- [ ] `PartList.tsx`/`apiClient`/`useApiResource`/backend `src/` 수정 0(ADR-0041 D1 — 기존 fetch hook·presentational 재사용만, 배선만).
- [ ] **Happy-path unit test 1+** — `runDeletePart` 정상 삭제(올바른 path `/api/parts/:id`·method DELETE) 후 `partsRefreshNonce` bump·재조회 유발 검증, `onDelete(id)` 호출 시 DELETE 발화 검증.
- [ ] **Error path unit test 1+** — DELETE 404(row 부재)·403(권한 부족)·network/500 실패 각각 error state 표면화·`partsRefreshNonce` 미bump·throw 안 함 검증(예외 분기마다 1+).
- [ ] **분기/flow test** — in-flight 가드(중복 클릭 시 두 번째 DELETE 미발화), 빈/공백 id no-op(불필요 DELETE 미발사), `onDelete` 미전달 시 삭제 버튼 미렌더 각 분기 1+.
- [ ] **Negative cases 충분 cover(각 1+)** — 빈/비정상 id no-op / 삭제 실패 후 목록 유지 / reject 시 finally 진행 off 복구 / 이중 삭제 방지 / 삭제 DELETE mock 추가가 기존 파트·그룹·인원 등 조회·생성 mock 을 깨지 않음. 단일 negative 만 두지 않는다 — 예외 분기마다 cover.
- [ ] `pnpm --dir web test`(vitest) 통과 + `pnpm --dir web build`(tsc --noEmit + vite build) green, lint clean.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). web 은 vitest coverage 로 확인.

## Out of Scope

- 파트 수정(PATCH /api/parts/:id) mutation — 별도 후속 slice(그룹 update T-1150 mirror, part.controller `@Patch(":id")` L121).
- 삭제 확인 다이얼로그(confirm modal) — 단순 버튼 배선까지만. 필요 시 Follow-up.
- 파트 소속 인원(persons) cascade/재배정 UX·경고 — backend 계약 그대로 수용, UI 경고 미도입.
- `PartList` 정렬·필터·페이지네이션(상위 컨테이너 책임).
- backend `src/` (part.controller/service/DTO)·`prisma`·`apiClient.ts`·`useApiResource.ts`·`PartList.tsx` 변경.
- api.md 갱신(endpoint 이미 박제됨).
- 다른 stream(인원·그룹·LLM provider·permission-denied·스케줄·재평가) 파일 변경.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
