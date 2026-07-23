---
id: T-1157
title: AdminView 선택 파트 삭제 시 selectedPartId reset (404 alert·select 값 불일치 결함 수정)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-045]
estimatedDiff: 240
estimatedFiles: 2
independentStream: web-admin-part
dependsOn: [T-1156]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.test.tsx
created: 2026-07-24
plannerNote: T-1156 reviewer MINOR (2) UX 결함 수정 — 선택 파트 삭제 후 selectedPartId 잔존 → 404 alert·select 불일치, pr web 2파일
---

# T-1157 — AdminView 선택 파트 삭제 시 selectedPartId reset

## Why

T-1156 (파트 소속 인원 조회 섹션 배선) 의 reviewer 가 남긴 MINOR 후속 중 실제 UX 결함 1건을 닫는다. 현재 `handleDeletePart` 는 삭제 성공 시 `partsRefreshNonce` 만 bump 하고 `selectedPartId` 는 그대로 두므로, **선택 중인 파트를 삭제하면** (a) `buildPartPersonsPath` 가 이미 사라진 파트의 `/api/parts/<deletedId>/persons` 를 재조회해 404 error 문구가 소속 인원 패널에 표시되고, (b) `<select value={selectedPartId}>` 가 더 이상 존재하지 않는 option 을 가리켜 브라우저 표시값(빈 선택지)과 컨테이너 state 가 불일치한다. 본 task 는 삭제 성공 시 선택을 해제하는 순수 helper 를 추가해 이 비정상 시퀀스를 정상화한다 (PLAN.md P6 Admin 패널 파트 관리 arc 의 결함 수정 slice).

## Required Reading

- `docs/tasks/T-1156-part-persons.md` — 파트 소속 인원 조회 slice 정의 (`buildPartPersonsPath` / `selectedPartId` / `NO_PART_SELECTED_TEXT` 컨벤션).
- `web/src/views/AdminView.tsx` — 다음 지점만:
  - `buildPartPersonsPath` (690~705행 부근) — 조건부 path 계약 (falsy → `null` 미조회).
  - `selectedPartId` state + `partPersonsPath` useMemo + `useApiResource<PersonRow[]>` 블록 (3197~3230행 부근).
  - `runDeletePart` / `DeletePartDeps` (1745~1805행 부근) — `bumpRefresh` 는 **성공 시에만** 호출된다는 계약.
  - `handleDeletePart` useCallback (3280~3295행 부근) — 본 task 의 주 수정 지점.
  - 파트 선택 `<select>` JSX (4100~4125행 부근) — `part.id ?? ''` fallback 분기.
- `web/src/views/AdminView.test.tsx` — 파트 삭제(T-1154) / 파트 소속 인원(T-1156) describe 블록. 기존 mock/헬퍼 컨벤션을 그대로 재사용한다 (새 helper 파일 신설 금지).

## Acceptance Criteria

- [ ] `web/src/views/AdminView.tsx` 에 순수 helper `resolveSelectedPartIdAfterDelete(current: string, deletedId: string): string` 추가 — 두 id 가 같으면 `''` (선택 해제), 다르면 `current` 그대로 반환. 빈 문자열·공백·undefined-like 입력에서도 throw 하지 않는다. 파일 하단 `export { ... }` 블록에 추가해 직접 unit test 가능하게 한다.
- [ ] `handleDeletePart` 의 `bumpRefresh` 가 파트 재조회 nonce bump 와 함께 `setSelectedPartId((cur) => resolveSelectedPartIdAfterDelete(cur, id))` 를 호출한다. **functional setState 를 사용해** `selectedPartId` 를 useCallback deps 에 추가하지 않는다 (stale closure 회피 + 기존 deps `[deletingPart]` 유지). `runDeletePart` / `DeletePartDeps` 시그니처는 변경하지 않는다 (성공 경로 전용 `bumpRefresh` 계약 재사용 — 실패 시 선택 유지가 자동 보장).
- [ ] happy-path unit test 1+ — 선택 중인 파트를 삭제하면 삭제 성공 후 파트 선택 `<select>` 의 값이 빈 선택지로 되돌아가고, 소속 인원 패널이 미선택 문구(`NO_PART_SELECTED_TEXT`) 를 표시한다.
- [ ] error path unit test 1+ — 삭제 DELETE 가 실패(403/404/network)하면 `selectedPartId` 가 **유지**되고 (선택 파트의 소속 인원이 그대로 표시), 예외가 throw 되지 않는다.
- [ ] branch/flow test — `resolveSelectedPartIdAfterDelete` 의 각 분기 1+ (동일 id → `''`, 다른 id → 원본 유지, `current` 가 빈 문자열 → `''` 유지) + 선택하지 않은 다른 파트를 삭제했을 때 선택이 보존되는 컨테이너 레벨 case 1+.
- [ ] negative cases 충분 cover — 삭제 성공 후 사라진 파트의 `/api/parts/<deletedId>/persons` 요청이 **재발사되지 않음** (fetch mock 호출 경로 검증) + 404 error alert 가 소속 인원 패널에 남지 않음, in-flight 중복 삭제 가드 회귀 0, 기존 파트 CRUD(생성/수정/삭제)·인원·그룹 섹션 회귀 0.
- [ ] T-1156 reviewer MINOR (1) 동시 해소 — 파트 목록 row 의 `id` 누락 시 `<option>` 이 fallback key/`value=""` 로 안전 렌더되고 선택해도 조회가 발사되지 않음을 검증하는 test **정확히 1 case** 추가 (≤25 LOC).
- [ ] `pnpm --dir web test` 전체 통과 + `pnpm --dir web build` (tsc + vite) green + root `pnpm lint` clean.
- [ ] `pnpm test:cov` 기준 (line ≥ 80% / function ≥ 80%) 유지 — web vitest 커버리지 회귀 0.
- [ ] **사이즈 상한 엄수** — 프로덕션 + 테스트 합계 diff ≤ 300 LOC, 파일 2개. 신규 test case 총 **7개 이하**로 유지하고, 초과 위험 시 위 MINOR (1) test 를 Follow-ups 로 미룬다 (T-1156 이 362 LOC 로 cap 을 초과한 재발 방지).

## Out of Scope

- `runDeletePart` / `DeletePartDeps` 시그니처 변경, 새 mutation 러너 도입.
- `PartList.tsx` / `PersonList.tsx` / `useApiResource.ts` / `apiClient` 수정 (ADR-0041 Decision 1 — 컨테이너 배선만).
- 그룹(`selectedGroupId`) 쪽 동일 패턴 적용 — 별도 slice (본 task 는 파트만).
- 파트 소속 인원 배정·해제 mutation, 라우팅·전역 상태 도입.
- backend (`src/`) / prisma schema / api.md 수정.
- `partsRefreshNonce` 공유 배선의 컨테이너 레벨 test 보강 (T-1156 MINOR (3)) — 아래 Follow-ups.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- T-1156 reviewer MINOR (3) — `partsRefreshNonce` 가 파트 목록 조회와 소속 인원 조회에 **공유** 배선된 사실(생성/수정/삭제 성공 시 두 조회가 함께 권위 재조회)을 컨테이너 레벨에서 검증하는 test 부재. 별도 test-only slice 로 박제 권장.
