---
id: T-1831
title: AdminView 수집 대상 행별 endpoint 인라인 편집 + PATCH { endpoint } 배선
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-070, REQ-072, REQ-073]
independentStream: collection-target-admin-ui
dependsOn: [T-1830]
touchesFiles:
  - web/src/views/adminCollectionTargetRunners.ts
  - web/src/views/AdminView.tsx
  - web/src/components/CollectionTargetList.tsx
  - web/src/components/CollectionTargetList.test.tsx
  - web/src/views/AdminView.collection-targets-endpoint-edit.test.tsx
estimatedDiff: 560
estimatedFiles: 5
sizeExempt: true
exemptReason: "cap-bend pre-justified — R-112 4-카테고리 backbone(러너 + 컴포넌트 controlled 폼 + 컨테이너 배선 + spec 2 종) × 1.5. 동형 선례 실측이 T-1828 4 파일 +532/-2 · T-1829 4 파일 +664/-4 이고 본 slice 는 거기에 입력 폼 1 개가 더 붙는다(대부분이 spec LOC). 파일 수 5 로 파일 cap(≤ 5)은 예외 없이 준수."
created: 2026-09-01
plannerNote: "P6 / ADR-0059 §Follow-ups (e) 편집 축 마지막 남은 값-편집 조각 중 endpoint 1 축 — 러너와 소비처 배선을 한 PR 에 묶는다(§3 소비처 동반 의무)"
---

# T-1831 — AdminView 수집 대상 행별 endpoint 인라인 편집 + PATCH { endpoint } 배선

## Why

[ADR-0059](../decisions/ADR-0059-collection-target-registration.md) `§Follow-ups (e)` (AdminView
등록·편집 패널) 에서 아직 화면이 없는 축은 **값 편집**(`endpoint` · `orgs` · `repos` · `spaces`)
하나뿐이다. 읽기([T-1825](T-1825-admin-collection-target-list-panel.md)) · 등록([T-1826](T-1826-admin-collection-target-create-form.md)) ·
삭제([T-1828](T-1828-admin-collection-target-delete.md)) · 활성 토글([T-1829](T-1829-admin-collection-target-active-toggle.md))
은 모두 shipped 이고, [T-1830](T-1830-adminview-collection-target-runners-extract.md) 이 그 러너
군을 [adminCollectionTargetRunners.ts](../../web/src/views/adminCollectionTargetRunners.ts) 로 빼
두어 **본 slice 의 러너는 AdminView 를 더 키우지 않고** 그 모듈에 붙는다 (T-1830 `Follow-ups` 의
지시 그대로).

본 slice 는 그 값-편집 축 중 **`endpoint` 1 축**을 화면에서 끝까지 발사한다 — 행별 "편집" 진입 →
인라인 입력 → 저장 → `PATCH /api/collection-targets/:id` `{ endpoint }` → 권위 재조회. 잘못
입력한 대상 URL 을 **삭제 + 재등록 없이** 고칠 수 있게 되는, 그 자체로 완결된 사용자 기능이다
(REQ-072 "평가 대상 시스템 등록·편집" 의 편집 절반, REQ-070 의 "막히지 않는 대상 인터페이스").
러너만 신설하고 배선을 미루지 않는다 — [CLAUDE.md](../../CLAUDE.md) `§3` 소비처 동반 의무대로
`runUpdateCollectionTarget` 과 그 소비처(목록 진입점 + 컨테이너 handler + 섹션 렌더)를 **한 PR** 에
담는다.

배열 3 축(`orgs` · `repos` · `spaces`) 을 같은 slice 에 넣지 않는 근거는 수치다 — 세 축은 각각
콤마 입력 → 배열 파싱 helper(빈 원소 · 공백 trim · 중복 경계)와 type 별 노출 분기(GITHUB 은
`orgs`/`repos`, CONFLUENCE 는 `spaces`)가 붙어 폼 · 러너 · spec 이 축당 ~150 LOC 씩 늘고, 위
`estimatedDiff` 560 에 더하면 **800 LOC 초과 · 파일 6~7 개**로 파일 cap(5)까지 깨진다. 그래서
분리하되, 다음 slice 가 **어느 파일의 어느 배선**인지를 `Follow-ups` 에 못박는다.

issue-still-relevant pre-check (planner, `origin/main` `ebbf3717`): `git grep runUpdateCollectionTarget
-- web` **0 건**, `CollectionTargetList.tsx` 의 props 는 `onDelete`(`99 행`) · `onToggleActive`(`105 행`)
뿐이라 편집 진입점 0, `CollectionTargetEditForm` 류 컴포넌트도 부재. 즉 본 편집 축은 main 에 아직
안착하지 않았다. `docs/requirements.md` `89~92 행` REQ-070 / REQ-072 / REQ-073 은 모두 `PLANNED`
이며, 그 재판정은 편집 축 마지막 조각 머지 후 [CLAUDE.md](../../CLAUDE.md) `§3.1` 규칙 6 대로
**구현 후 1 회**만 한다 (본 slice 범위 밖).

## Required Reading

- [web/src/views/adminCollectionTargetRunners.ts](../../web/src/views/adminCollectionTargetRunners.ts) — 러너 3 개의 계약·주석 관례 정본. 특히 `runToggleCollectionTargetActive`(PATCH 축) 를 1:1 mirror 한다: `typeof id === 'string'` 가드 → in-flight id 가드 → 진행 on + 직전 error 비움 → `encodeURIComponent` path → 성공 재조회 / 실패 문구(throw 0) → `finally` 진행 off. 상수 `COLLECTION_TARGETS_PATH` 도 여기 정본을 쓴다(재선언 금지).
- [web/src/components/CollectionTargetList.tsx](../../web/src/components/CollectionTargetList.tsx) — props interface `86 행`, `onDelete` `99 행`, `onToggleActive` `105 행`, 렌더 분기 `110 행` 이하(loading → error → empty → populated). presentational 경계(fetch·상태 보유 금지, controlled props 만) 를 그대로 지킨다.
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) — `4534~4556 행` 토글 축 state + `useCallback` handler(본 slice 가 동형으로 편집 축 state/handler 를 추가할 자리), `5837~5884 행` 수집 대상 섹션(목록 마운트 · 실패 alert 2 개 · `isAdmin` gating 된 등록 폼). 러너 import 는 `132~137 행`.
- [web/src/components/CollectionTargetList.test.tsx](../../web/src/components/CollectionTargetList.test.tsx) — 컴포넌트 spec 관례(콜백 미전달 시 미렌더 · 클릭 인자 검증).
- [web/src/views/AdminView.collection-targets-active-toggle.test.tsx](../../web/src/views/AdminView.collection-targets-active-toggle.test.tsx) — 직전 동형 slice 의 spec 구조(러너 단위 케이스 + 컨테이너 배선 렌더 케이스). 본 slice 의 새 spec 이 이 구조를 따른다.
- [src/assessment-collection/dto/update-collection-target.dto.ts](../../src/assessment-collection/dto/update-collection-target.dto.ts) — 허용 축 5 개(`endpoint` `@IsString` + `@IsNotEmpty` + `@MaxLength(255)`) 와 **정체성 축(`type` · `instanceKey`) body 금지**(forbidNonWhitelisted 400) 계약. 본 slice 의 body 는 `{ endpoint }` 하나뿐이다.
- [docs/decisions/ADR-0059-collection-target-registration.md](../decisions/ADR-0059-collection-target-registration.md) `§Decision 5`(PATCH 200 / merge patch / 400 · 403 · 404 오류 표) · `§Follow-ups (e)`.

## 설계 계약 (구현 전 확정)

**러너** — `adminCollectionTargetRunners.ts` 에 `runUpdateCollectionTarget(id, patch, deps)` 를
추가한다. `patch` 는 `{ endpoint?: string }` 형태의 **부분 갱신 객체**로 받아 다음 slice 가 배열
축을 필드만 늘려 재사용할 수 있게 한다 (러너 재작성 0). 가드·전이:

- 비문자열 / 빈 / 공백뿐 `id` → 미발사.
- `patch` 가 객체가 아니거나 **적용할 키 0 개** → 미발사 (의미 없는 PATCH 왕복 차단).
- `endpoint` 가 전달됐는데 trim 후 빈 문자열 → 미발사 (`@IsNotEmpty` 400 확정 요청을 네트워크 전에 차단). 전송값은 trim 한 값.
- `deps.updatingId` 보유 → 미발사 (이중 PATCH · state 경합 가드).
- 발사: 진행 id on + 직전 error 비움 → `PATCH ${COLLECTION_TARGETS_PATH}/${encodeURIComponent(id)}` (`Content-Type: application/json`) → 성공 시 `deps.reloadTargets()` + `deps.onUpdated?.()`(편집 폼 닫기) / 실패 시 `deps.setUpdateError(deps.describeError(e))` (throw 0, 재조회·입력 유지) → `finally` 진행 id off.

**목록 컴포넌트** — controlled 편집 props 를 optional 로 추가한다(미전달 시 렌더·동작 변화 0 —
기존 spec 회귀 0): `onEditStart?: (id: string, currentEndpoint: string) => void`(토글의 "다음
상태 동봉" 계약과 동형으로 **현재 값을 함께 넘겨** 컨테이너가 prefill 을 다시 계산하지 않게 한다) ·
`editingId?: string` · `editEndpoint?: string` · `onEditEndpointChange?: (next: string) => void` ·
`onEditSubmit?: (id: string) => void` · `onEditCancel?: () => void` · `editBusy?: boolean`.
`onEditStart` 가 주어진 행에만 "편집" 버튼을 렌더하고, `editingId === row.id` 인 행에서는 편집
버튼 대신 인라인 입력(접근 가능한 이름 있는 `<input>`) + "저장" + "취소" 를 렌더한다. `editBusy`
가 true 면 저장 버튼 `disabled`. 요청 · 진행 상태 · 오류 문구는 여전히 컨테이너 몫이다.

**컨테이너** — AdminView 에 편집 축 state 4 개(`editingCollectionTargetId` ·
`collectionTargetEndpointEditInput` · `updatingCollectionTargetId` · `updateCollectionTargetError`)
와 handler 3 개(편집 시작 = id + 현재 endpoint prefill, 저장 = 러너 호출, 취소 = state 비움) 를
토글 축(`4534~4556 행`) 동형으로 추가하고, 편집 관련 콜백은 **`isAdmin` 일 때만** 내려보낸다
(`@Roles("Admin")` PATCH — 403 확정 컨트롤 미노출, REQ-073). 편집 실패 문구는 삭제·토글 문구와
**별도 alert** 로 섹션에 렌더한다(어느 동작이 실패했는지 구분).

## Acceptance Criteria

- [ ] `runUpdateCollectionTarget` 이 `adminCollectionTargetRunners.ts` 에 추가되고 위 설계 계약대로 동작한다. AdminView 는 목록 진입점 · handler · 섹션 렌더까지 같은 PR 에서 배선돼, 화면에서 endpoint 편집이 실제로 발사된다(러너 단독 slice 아님).
- [ ] **happy-path**: ① 러너가 정상 인자로 PATCH 1 회를 올바른 path(`/api/collection-targets/<encode(id)>`) · method · body(`{ endpoint: trim 값 }`) 로 발사하고 성공 시 재조회 + 편집 종료 콜백을 호출한다. ② 목록에서 "편집" 클릭 → 입력 변경 → "저장" 이 컨테이너 handler 를 거쳐 발사되는 배선 렌더 test 1+.
- [ ] **error path**: 발사기 reject(400 · 403 · 404 · 5xx · 네트워크 0 표면) 시 오류 문구가 표면화되고 throw 0 · 재조회 미호출 · 진행 id 가 `finally` 로 해제된다는 test 1+.
- [ ] **분기 cover**: 러너의 각 분기 — 미발사 가드 4 종(비문자열/빈 id, 빈 patch, 빈 `endpoint`, in-flight) · 성공 경로 · 실패 경로 · `onUpdated` 미전달(optional) 경로 — 마다 test 1+. 컴포넌트 분기 — 편집 콜백 미전달 시 버튼 미렌더 · `editingId` 불일치 행은 폼 미렌더 · 일치 행만 폼 렌더 · `editBusy` 시 저장 버튼 disabled — 마다 test 1+.
- [ ] **negative cases 충분 cover**(단일 negative 금지 — 예외 분기마다): 공백뿐 id 미발사 · `undefined`/숫자 id 미발사 · `patch` 가 `undefined`/`{}` 일 때 미발사 · `endpoint` 가 공백뿐일 때 미발사 · 이중 저장 클릭(진행 중) 미발사 · 재발화 시 직전 오류 문구 초기화 · 실패 후에도 진행 해제 · 특수문자 id 의 `encodeURIComponent` 인코딩 · 예상 밖 응답 shape(배열 · null)에도 throw 0 · non-Admin 마운트에서 편집 버튼 미렌더(403 확정 컨트롤 미노출).
- [ ] 기존 spec 회귀 0 — 수집 대상 관련 기존 spec 5 개(`collection-targets-mount` · `create` · `delete` · `active-toggle` · `adminCollectionTargetRunners.test.ts` · `CollectionTargetList.test.tsx`)가 **기존 케이스 수정 없이** 통과한다(새 props 는 전부 optional).
- [ ] `pnpm --dir web test` green · `pnpm --dir web build` green(`tsc --noEmit` + `vite build`).
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). `src/` 무변경이라 backend coverage 변동 0 이어야 한다.
- [ ] 변경 파일이 frontmatter `touchesFiles` 5 개를 넘지 않는다(파일 cap 준수 — 새 컴포넌트 파일 신설 금지).

## Out of Scope

- **배열 3 축(`orgs` · `repos` · `spaces`) 편집** — 콤마 파싱 helper · type 별 노출 분기 포함. 위 `Why` 의 수치 근거대로 다음 slice.
- **정체성 축(`type` · `instanceKey`) 편집** — ADR-0059 `§Decision 5` 가 "변경은 DELETE + POST" 로 못박았다. 입력조차 만들지 않는다.
- 새 컴포넌트 파일(`CollectionTargetEditForm.tsx`) 신설 — 파일 cap 을 깨고 본 slice 를 2 개로 쪼개게 만든다. 편집 폼은 `CollectionTargetList` 안 인라인으로 둔다(행 단위 진입점이라 목록 밖에 자리가 없다 — 삭제·토글 버튼 선례 동형).
- per-resource api client 모듈 추출 · `useApiResource` 의 nonce-aware path 빌더 전환 · 낙관적 갱신(성공 후 재조회 유지).
- AdminView 의 다른 helper 군 추가 순수 추출(PLAN `183 행` 부채 축) — 본 slice 는 러너를 이미 추출된 모듈에 붙일 뿐 새 추출을 하지 않는다.
- `docs/requirements.md` REQ-070 / REQ-072 / REQ-073 status 재판정 · `docs/architecture/api.md` doc-sync · PLAN `183 행` 실측 LOC 갱신 — 전부 `direct` 라 `§3.1` 규칙 3 상 본 `pr` task 와 혼합 금지이며, REQ 재판정은 규칙 6 대로 편집 축 마지막 조각 머지 후 1 회만.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (planner 예약) **배열 3 축 편집 slice** — 같은 인라인 폼에 `orgs` · `repos` · `spaces` 콤마 입력 3 개를 추가하고, 파싱 helper 는 [web/src/views/adminCollectionTargetRunners.ts](../../web/src/views/adminCollectionTargetRunners.ts) 에 두어(AdminView 를 다시 키우지 않는다) 본 slice 의 `runUpdateCollectionTarget(id, patch, deps)` `patch` 에 필드만 늘려 실어 보낸다. 노출 분기는 `CollectionTargetList.tsx` 의 편집 폼 안에서 행 `type` 으로 가른다(GITHUB → `orgs`/`repos`, CONFLUENCE → `spaces`).
