---
id: T-1829
title: AdminView 수집 대상 행별 활성/비활성 토글 + PATCH { active } 배선
phase: P6
status: DONE
commitMode: pr
prNumber: 1437
coversReq: [REQ-072, REQ-073]
independentStream: collection-target-admin-ui
dependsOn: [T-1828]
touchesFiles:
  - web/src/components/CollectionTargetList.tsx
  - web/src/components/CollectionTargetList.test.tsx
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.collection-targets-active-toggle.test.tsx
estimatedDiff: 450
estimatedFiles: 4
sizeExempt: true
exemptReason: "cap-bend pre-justified — R-112 4-카테고리 backbone(컴포넌트 prop + 러너 + spec 2 종) × 1.5. 바로 앞 동형 slice T-1828 실측이 4 파일 +532/-2 였고 본 slice 는 그 삭제 축을 PATCH 축으로 1:1 mirror 한다. 파일 수 4 로 파일 cap(5)은 준수."
created: 2026-09-01
plannerNote: "P6 / ADR-0059 §Follow-ups (e) 편집 축 — DELETE(T-1828) 다음 순서로 §Decision 5 가 지정한 '일시 제외 = active=false PATCH' 1 동작만 절단"
---

# T-1829 — AdminView 수집 대상 행별 활성/비활성 토글 + PATCH { active } 배선

## Why

[ADR-0059](../decisions/ADR-0059-collection-target-registration.md) `§Follow-ups (e)` (AdminView
등록·편집 패널) 의 **넷째 조각** 이다. 읽기([T-1825](T-1825-admin-collection-target-list-panel.md)) ·
등록([T-1826](T-1826-admin-collection-target-create-form.md)) · 삭제([T-1828](T-1828-admin-collection-target-delete.md))
가 머지된 지금, 편집 축에서 화면 진입점이 없는 backend route 는 `PATCH /api/collection-targets/:id`
하나뿐이다.

편집 축을 **`active` 토글 1 동작으로 자른 근거는 ADR 본문**이다 — `§Decision 5` 의 DELETE 행이
"일시 제외는 삭제가 아니라 `active=false` PATCH" 라고 못박아, 토글이 PATCH 의 **주 use case** 이자
그 자체로 완결된 사용자 기능이다. `endpoint` · `orgs` · `repos` · `spaces` 를 고치는 폼은 입력
컨트롤 4 개와 폼 컴포넌트 신설이 붙어 같은 diff 에 담으면 파일 cap(5) 을 넘긴다(별도 slice 로
`Follow-ups` 에 박제). CLAUDE.md `§3` 소비처 동반 의무대로 컴포넌트 prop 신설과 AdminView 의 실
PATCH 배선을 **한 slice** 에 묶으므로 소비처 없는 helper 단독 PR 이 아니다.

issue-still-relevant pre-check (planner, `origin/main` `a3200c9f`): `git grep onToggleActive -- web/src`
**0 건**, `web/src` 전체에서 수집 대상 PATCH 발사 **0 건**(collection-target 관련 러너는
`runCreateCollectionTarget` · `runDeleteCollectionTarget` 둘뿐), `CollectionTargetList` 의 prop 은
`onDelete` 까지만 존재. backend 는 이미 완결이라 잔여는 화면 진입점 1 개뿐이다 —
[collection-target.controller.ts](../../src/assessment-collection/collection-target.controller.ts)
`@Patch(":id")` + `@Roles("Admin")`, [update-collection-target.dto.ts](../../src/assessment-collection/dto/update-collection-target.dto.ts)
의 `active?: boolean`(`@ValidateIf` + `@IsBoolean`), 오류 계약 e2e([T-1823](T-1823-collection-targets-error-contract-e2e.md)),
api.md doc-sync([T-1827](T-1827-api-md-collection-target-routes-doc-sync.md)).

## Required Reading

- [docs/decisions/ADR-0059-collection-target-registration.md](../decisions/ADR-0059-collection-target-registration.md) — `§Decision 5` route/권한/오류 표 (PATCH 행 + DELETE 행의 "일시 제외" 문장), `§Follow-ups (e)`
- [web/src/components/CollectionTargetList.tsx](../../web/src/components/CollectionTargetList.tsx) — `CollectionTargetRow` 정본 타입, `DELETE_LABEL` · `onDelete` 조건부 버튼 (`53~55 행` · `85~87 행` · `143~150 행`)
- [web/src/components/CollectionTargetList.test.tsx](../../web/src/components/CollectionTargetList.test.tsx) — element 트리 순회로 버튼 onClick 을 수동 호출하는 기존 spec 관례
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) — `runCreateCollectionTarget` (`1931~1976 행`, `apiClient.request` body 직렬화 관례) · `DeleteCollectionTargetDeps` + `runDeleteCollectionTarget` (`1977~2040 행`, 진행 중 id 가드 · `encodeURIComponent` · `finally` 해제) · `CollectionTargetList` 마운트 (`5945~5965 행`, `onDelete={isAdmin ? handleDeleteCollectionTarget : undefined}`)
- [web/src/views/AdminView.collection-targets-delete.test.tsx](../../web/src/views/AdminView.collection-targets-delete.test.tsx) — 러너 spec 의 deps mock 주입 관례 (본 slice 의 신규 spec 이 1:1 mirror 할 대상)
- [src/assessment-collection/dto/update-collection-target.dto.ts](../../src/assessment-collection/dto/update-collection-target.dto.ts) — 허용 축 5 개 · `active` 검증 계약 (정체성 축 `type`/`instanceKey` 는 body 금지)

## Acceptance Criteria

- [ ] `CollectionTargetList` 에 optional prop `onToggleActive?: (id: string, nextActive: boolean) => void` 를 추가하고, 전달됐을 때만 각 행에 토글 버튼을 렌더한다. 라벨은 행의 현재 상태에서 파생한다 — `active !== false` 면 `비활성화`, 아니면 `활성화` (상수로 박제, `DELETE_LABEL` 동형).
- [ ] 버튼 클릭 시 `onToggleActive(row.id, !(row.active !== false))` 로 **다음 상태** 를 함께 넘긴다 (호출부가 현재 상태를 다시 계산하지 않도록).
- [ ] `AdminView` 에 `runToggleCollectionTargetActive(id, nextActive, deps)` 순수 async 러너를 추가한다 — `runDeleteCollectionTarget` 을 1:1 mirror 하되 발사는 `PATCH ${COLLECTION_TARGETS_PATH}/${encodeURIComponent(id)}`, body 는 `JSON.stringify({ active: nextActive })` + `Content-Type: application/json`. 성공 시 목록 권위 재조회(`reloadTargets`), 실패 시 문구 표면화(throw 0), 진행 id 해제는 `finally`.
- [ ] `AdminView` 에 진행 중 행 id state 와 오류 문구 state 를 추가하고, `onToggleActive={isAdmin ? handleToggleCollectionTargetActive : undefined}` 로 내려 REQ-073 RBAC 게이팅을 박제한다 (non-Admin 에게는 버튼 자체가 렌더되지 않는다).
- [ ] **happy-path unit test 1+** — 컴포넌트: `onToggleActive` 전달 시 행 수만큼 토글 버튼 렌더 + 클릭 시 `(id, nextActive)` 인자로 호출. 러너: PATCH 1 회 발사(path · method · body · 헤더 정합) 후 `reloadTargets` 1 회 호출.
- [ ] **error path unit test 1+** — 러너의 발사기가 reject 할 때 `setToggleError` 에 `describeError` 결과가 담기고, `reloadTargets` 는 호출되지 않으며, 러너가 throw 하지 않는다.
- [ ] **분기 cover** — (a) `active === true` 행의 라벨/다음 상태 vs `active === false` 행의 라벨/다음 상태, (b) `active` 필드 자체가 누락된 행(기본 활성 취급), (c) `onToggleActive` 미전달 시 버튼 미렌더(하위 호환), (d) 러너의 성공 경로 vs 실패 경로, (e) 진행 중 id 보유 시 미발사, 각 1+ test.
- [ ] **negative cases 충분 cover** — 빈 문자열 id · 공백뿐 id · 비문자열 id 미발사, 이중 클릭(진행 중) 미발사, 재발화 시 직전 오류 문구 초기화, `finally` 로 진행 id 해제(실패 경로 포함), 특수문자 id 의 `encodeURIComponent` 인코딩, `isAdmin=false` 일 때 `onToggleActive` 가 `undefined` 로 내려가 버튼이 없는 것, 각 1+ test.
- [ ] `pnpm --dir web test` 전량 green, 루트 `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `pnpm --dir web build` · `pnpm lint` green.

## Out of Scope

- `endpoint` · `orgs` · `repos` · `spaces` 를 고치는 편집 폼 컴포넌트 신설 (별도 slice — `Follow-ups`).
- `src/` backend 변경 일체 — PATCH route · DTO · service · e2e 는 이미 완결이라 한 줄도 건드리지 않는다.
- `docs/requirements.md` 의 REQ-070 / REQ-072 / REQ-073 status 재판정 — 편집 축의 마지막 조각(값 편집 폼)이 머지된 뒤 CLAUDE.md `§3.1` 규칙 6 대로 **구현 후 1 회** 만 수행한다.
- `docs/architecture/api.md` 등 doc-sync (`commitMode` 혼합 금지 — 필요하면 별도 `direct` slice).
- 낙관적 UI 갱신 · 확인 대화상자 · per-resource api client 모듈 추출 (선행 3 slice 의 경계 그대로 승계).
- `AdminView` god component 추가 분할 ([PLAN.md](../PLAN.md) `183 행`) — 본 slice 는 기능 축이며 순수 추출은 별도 stream.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append 한다.)

## Result (2026-08-31)

`CollectionTargetList` 에 optional `onToggleActive` prop + `isRowActive` 순수 함수 + 상태 파생 라벨 (비활성화 / 활성화) 토글 버튼 (삭제 버튼 앞) 을 신설하고, `AdminView` 에 `runToggleCollectionTargetActive` 러너 (`PATCH` + body `{ active }` + 재조회 + 실패 시 throw 0 + `finally` 해제) 와 진행 id · 오류 state 를 배선했다. `onToggleActive={isAdmin ? handler : undefined}` 로 REQ-073 RBAC gating 을 같이 박제했다. 4 파일 +664/-4 (제품 코드 +151/-4, 나머지는 신규 spec 56 건), web 전량 3251 건 green · 루트 `pnpm test:cov` 13404 건 green (line · function 80% 게이트 통과, `src/` 무변경). PR [#1437](https://github.com/myungjoo/Assessment-Agent/pull/1437) reviewer APPROVE round=1 (BLOCKER 0 / MINOR 1 — `estimatedDiff: 450` 대비 실측 664 로 다음 mirror slice 추정치 상향 권고, 차단 사유 아님) · CI green · squash 머지 (`cbb37dcd`).
