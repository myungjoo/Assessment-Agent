---
id: T-1828
title: AdminView 수집 대상 행별 삭제 버튼 신설 + DELETE 배선
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-072, REQ-073]
independentStream: collection-target-admin-ui
dependsOn: [T-1826]
touchesFiles:
  - web/src/components/CollectionTargetList.tsx
  - web/src/components/CollectionTargetList.test.tsx
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.collection-targets-delete.test.tsx
estimatedDiff: 480
estimatedFiles: 4
sizeExempt: true
exemptReason: "cap-bend pre-justified: R-112 4-카테고리 cover backbone × 1.5 = 480 LOC. 직전 동형 slice T-1826(등록 폼 + POST 배선, 4 파일) 이 실측 +867 LOC 였고 초과분 대부분이 R-112 spec 이었다 — 제품 코드는 약 110 LOC 로 cap 안. 파일 수 4 로 파일 cap(≤ 5) 은 예외 없이 준수."
created: 2026-09-01
plannerNote: "P6 / ADR-0059 §Follow-ups (e) 편집 축 셋째 조각 — 읽기(T-1825)·등록(T-1826) 다음의 DELETE 1 동작"
---

# T-1828 — AdminView 수집 대상 행별 삭제 버튼 신설 + DELETE 배선

## Why

[PLAN.md](../PLAN.md) `130 행` 🔴 오너 지시 (평가 대상 추가·편집 인터페이스, REQ-070/072/073) 의 **시스템 축** 이며, [ADR-0059](../decisions/ADR-0059-collection-target-registration.md) `§Follow-ups (e)` (AdminView 등록·편집 패널) 의 **셋째 조각** 이다. 읽기 축은 [T-1825](T-1825-admin-collection-target-list-panel.md) (`CollectionTargetList` + AdminView 마운트), 등록 축은 [T-1826](T-1826-admin-collection-target-create-form.md) (`CollectionTargetAddForm` + POST 배선) 이 닫았고, T-1826 `Follow-ups` 가 잔여로 명시한 네 조각 (`PATCH` 수정 폼 · `DELETE` 삭제 버튼 · `active` 토글 · 배열 입력) 중 **DELETE 1 동작만** 자른다 — 인원 축 선례 (목록 T-1142 → 생성 T-1143 → **삭제** T-1144 → 수정 T-1145) 의 절단 순서를 그대로 승계한다. PATCH 축은 인라인 수정 폼 + patch 파생 helper 까지 필요해 같은 diff 에 담으면 파일 · LOC 이 모두 커지므로 뒤로 둔다.

**issue-still-relevant pre-check (planner 실측, origin/main `39cafb7f`)** — ① `git grep -c "onDelete" origin/main -- web/src/components/CollectionTargetList.tsx` = **0 건** (props 는 `targets` · `loading` · `error` · `emptyMessage` 4 개뿐), ② `git grep "DeleteCollectionTarget|deleteCollectionTarget" origin/main -- web/src` = **0 건**, ③ `git log origin/main -6 -- web/src` 최신 3 건은 `2ccc0218`(T-1826 등록 폼) · `2fe1b581`(T-1825 목록) · `dfa913f0`(T-1824 추출) 로 삭제 축을 건드린 commit 0 건. 따라서 본 task 의 의도는 main 에 미박제이며 중복이 아니다. backend 축은 이미 완결 — [collection-target.controller.ts](../../src/assessment-collection/collection-target.controller.ts) `183~189 행` 이 `@Delete(":id")` + `@HttpCode(204)` + `@Roles("Admin")` 으로 존재하고 (T-1817), 오류 계약은 [collection-targets.e2e-spec.ts](../../test/e2e/collection-targets.e2e-spec.ts) (T-1823) 가 고정했으며, [api.md](../architecture/api.md) doc-sync 도 [T-1827](T-1827-api-md-collection-target-routes-doc-sync.md) 이 끝냈다. 즉 잔여는 **화면 진입점 1 개** 뿐이다.

## Required Reading

- [web/src/components/CollectionTargetList.tsx](../../web/src/components/CollectionTargetList.tsx) — 삭제 버튼을 얹을 표시 축. `CollectionTargetListProps` (`69~78 행`) · 분기 순서 (loading → error → empty → populated) · `CollectionTargetRow.id` 계약.
- [web/src/components/PersonList.tsx](../../web/src/components/PersonList.tsx) `37~59 행` · `102~107 행` — `onDelete?: (id: string) => void` optional prop 선례 (미전달 시 버튼 미렌더 = 읽기 전용 하위 호환).
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) `1904~1975 행` — `CollectionTargetInput` / `CreateCollectionTargetDeps` / `runCreateCollectionTarget` (본 slice 가 1:1 mirror 할 러너 형태 · deps 주입 규약 · in-flight 가드 · 실패 시 throw 0).
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) `4520~4590 행` — `useApiResource<CollectionTargetRow[]>(COLLECTION_TARGETS_PATH)` · `reloadCollectionTargets` · `handleCreateCollectionTarget` 배선부.
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) `5855~5890 행` — 수집 대상 섹션 JSX (`<CollectionTargetList>` 마운트 · `isAdmin` gating 이 등록 폼에만 걸린 현 구조).
- [web/src/views/AdminView.collection-targets-create.test.tsx](../../web/src/views/AdminView.collection-targets-create.test.tsx) — 신규 spec 이 승계할 러너 spec 구조 (deps mock · 소스 guard).
- [src/assessment-collection/collection-target.controller.ts](../../src/assessment-collection/collection-target.controller.ts) `160~189 행` — DELETE 계약 (204 No Content · body 없음 · `P2025` → 404 · `@Roles("Admin")`).
- [docs/decisions/ADR-0059-collection-target-registration.md](../decisions/ADR-0059-collection-target-registration.md) `§Decision 5` — 삭제 행 계약과 "일시 제외는 `active=false` PATCH" 경계.

## Acceptance Criteria

- [ ] `CollectionTargetList` 에 optional prop `onDelete?: (id: string) => void` 를 추가하고, **주어졌을 때만** 각 행에 삭제 버튼 (`type="button"`) 을 렌더한다. 미전달 시 버튼 0 개 — T-1825 의 읽기 전용 마운트가 글자 그대로 보존된다 (`PersonList` `102~107 행` 선례).
- [ ] 삭제 버튼 클릭 시 그 행의 `row.id` 로 `onDelete` 를 호출한다. `CollectionTargetList` 는 fetch · 상태 보유 · 확인 대화상자를 일체 갖지 않는다 (presentational 책임만 — 파일 머리 주석의 경계 서술과 정합).
- [ ] `AdminView` 에 `runDeleteCollectionTarget(id, deps)` 순수 async 러너를 신설한다 — `runCreateCollectionTarget` 을 1:1 mirror 하되 DELETE 계약에 맞춘다: ① 빈/공백뿐 id 는 미발사, ② in-flight (진행 중 id 존재) 면 미발사, ③ 발사 전 직전 error 비움, ④ `DELETE ${COLLECTION_TARGETS_PATH}/${id}` 요청, ⑤ 성공 시 `reloadTargets()` 호출 (낙관 제거 없음 — 204 는 body 가 없으므로 응답을 소비하지 않는다), ⑥ 실패 시 `describeError` 문구만 표면화하고 **throw 하지 않는다**, ⑦ `finally` 로 진행 상태 해제.
- [ ] `AdminView` 가 삭제 진행 상태 (`deletingCollectionTargetId`) 와 오류 문구 (`deleteCollectionTargetError`) state 를 보유하고, 오류가 있으면 수집 대상 섹션 안에 `role="alert"` 로 노출한다.
- [ ] `<CollectionTargetList>` 에 `onDelete={isAdmin ? handleDeleteCollectionTarget : undefined}` 를 전달한다 — backend `@Delete` 가 `@Roles("Admin")` 이므로 non-Admin 에게는 403 이 확정된 컨트롤을 노출하지 않는다 (REQ-073 RBAC 일관 · T-1826 의 등록 폼 gating 과 동형). 목록 자체는 종전대로 gating 바깥에 남긴다.
- [ ] **happy-path unit test 1+** — 신규/변경 public symbol 마다: `CollectionTargetList` 가 `onDelete` 전달 시 행 수만큼 삭제 버튼을 렌더하고 클릭이 해당 `row.id` 로 콜백을 호출하는 test, `runDeleteCollectionTarget` 이 정상 경로에서 `DELETE` 를 1 회 발사하고 `reloadTargets` 를 호출하는 test.
- [ ] **error path unit test 1+** — 삭제 발사기가 reject (403 · 404 · 5xx · 네트워크 0) 할 때 러너가 throw 하지 않고 오류 문구만 설정하며 `reloadTargets` 는 호출하지 않는 test.
- [ ] **분기 cover** — 러너의 분기마다 1+ test: 빈 id 미발사 / in-flight 미발사 / 성공 분기 / 실패 분기 / `finally` 진행 해제 (성공·실패 양쪽). 컴포넌트는 `onDelete` 유/무 2 분기 + loading · error · empty 분기에서 버튼이 렌더되지 않음 1+.
- [ ] **negative cases 충분 cover — 예외 상황 각 1+ test**: ① 공백뿐 id, ② 비문자열 id (`undefined` · 숫자 등 계약 위반 입력), ③ in-flight 중 재클릭 (이중 DELETE 차단), ④ `isAdmin=false` 일 때 삭제 버튼 0 개 (RBAC 진입점 부재), ⑤ 빈 목록 · loading · error 분기에서 버튼 미렌더, ⑥ 러너가 다른 행의 진행 상태를 물들이지 않음 (격리), ⑦ 응답 body 가 예상 밖 shape (204 인데 body 존재) 여도 throw 0.
- [ ] 신규 spec 은 **colocated** 위치에 둔다 — 컴포넌트 축은 [web/src/components/CollectionTargetList.test.tsx](../../web/src/components/CollectionTargetList.test.tsx) 확장, 컨테이너 러너 축은 신규 `web/src/views/AdminView.collection-targets-delete.test.tsx` (`AdminView.collection-targets-create.test.tsx` 명명·구조 승계).
- [ ] `pnpm --dir web test` 전량 green (기존 3149+ 건 회귀 0), `pnpm --dir web build` · `pnpm --dir web lint` 통과.
- [ ] 저장소 루트 `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — `src/` 무변경이라 backend coverage 는 불변임을 확인한다.
- [ ] `git grep -c "onDelete" web/src/components/CollectionTargetList.tsx` ≥ 3 (props 선언 · 조건부 렌더 · 호출) 로 배선 실재를 실측한다.

## Out of Scope

- `PATCH` 인라인 수정 폼 · `active` 토글 · `orgs`/`repos`/`spaces` 배열 입력 UI — T-1826 `Follow-ups` 의 잔여 3 조각으로 각각 후속 slice.
- 삭제 확인 대화상자 (2 단계 확인 gate) 신설 — `ServiceIdentityRowActions` 의 확인 단계 패턴은 별도 판단이 필요하므로 본 slice 는 인원 축 (`PersonList` `onDelete`) 의 즉시 호출 선례를 따른다. 확인 단계 도입 여부는 `Follow-ups` 로 넘긴다.
- per-resource api client 모듈 추출 — T-1826 이 "5 route 가 다 붙는 시점에 추출 판단" 으로 미룬 그대로 유지.
- `src/` · `prisma/` · `test/e2e/` 무변경 — backend 5 route · 오류 계약 e2e 는 이미 완결됐다.
- `docs/requirements.md` 의 REQ-070 · REQ-072 · REQ-073 status 재판정 — 편집 축 (PATCH 폼) 이 아직 미완이라 CLAUDE.md `§3.1` 판정 규칙 6 대로 구현 완료 후 1 회만 수행한다. 본 slice 는 손대지 않는다.
- [api.md](../architecture/api.md) 등 문서 동기 — 본 slice 는 route 를 추가하지 않으므로 doc drift 0.
- `AdminView.tsx` god component 분할 (PLAN `183 행`) — 본 slice 는 append 이며, 추출은 별도 `pure-extraction` slice 소관.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append 한다.)
