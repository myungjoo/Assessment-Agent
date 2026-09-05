---
id: T-1910
title: AdminView 그룹 패널의 생성 폼 · 인라인 수정 폼(`1660 행` ~ `1714 행`)을 AdminGroupsSection props 로 흡수 (경로 2 슬라이스 2/2)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-028, REQ-049]
estimatedDiff: 260
estimatedFiles: 3
independentStream: adminview-god-component-refactor
dependsOn: [T-1909]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminGroupsSection.tsx
  - web/src/views/AdminGroupsSection.test.tsx
created: 2026-09-06
plannerNote: "P6 · PLAN 184 행 경로 2 그룹 패널 2/2 — T-1909 가 children 으로 통과시킨 생성·수정 폼을 props 로 흡수(T-1908 형 승계, 실측 234 LOC 전례)"
---

# T-1910 — AdminView 그룹 패널의 생성 폼 · 인라인 수정 폼을 AdminGroupsSection props 로 흡수 (경로 2 슬라이스 2/2)

## Why

[docs/PLAN.md](../PLAN.md) `184 행` AdminView god component 부채 bullet 이 지목한 **경로 2(JSX `<section>` 패널 1 개씩 하위 컴포넌트로 분해)** 의 그룹 패널 arc 를 완결한다. [T-1909](T-1909-adminview-groups-section-extract.md) (PR #1500 → main `7b9d858d`) 가 섹션 껍데기 · `<h2>` · `<GroupList>` 를 신설 [AdminGroupsSection.tsx](../../web/src/views/AdminGroupsSection.tsx) 로 옮기면서 생성 폼 · 인라인 수정 폼은 **`children` 슬롯으로 통과만** 시켰고(렌더 DOM 순서 보존 목적), 그 task 의 `Out of Scope` 와 `Follow-ups` 가 본 슬라이스 2/2 를 명시적으로 남겼다.

**형(form) 은 직전 패널에서 검증됐다** — 수집 대상 패널이 같은 2 분할로 [T-1907](T-1907-adminview-collection-targets-section-extract.md)(282 LOC) → [T-1908](T-1908-adminview-collection-targets-section-absorb-children.md)(3 파일 +166/-68 = 234 LOC, cap 내) 로 완결됐고, 2/2 에서 `children` · `ReactNode` import 를 제거해 마운트를 self-closing 으로 전환하는 절차까지 동일하다. 그룹 패널의 흡수 대상 축은 12 개(생성 5 · 수정 7)로 T-1908 의 12 축(alert 3 · 등록 폼 9)과 같은 규모라 같은 예산 안에서 끝난다.

**이 슬라이스가 AdminView 를 목표선까지 민다** — head `7b9d858d` 실측 `wc -l` = **2,005 줄**로 PLAN 이 박제한 목표선 `≤ 2,000` 까지 잔여 `-5 줄`이다. 본 슬라이스가 걷어내는 children 55 줄(`1660 행` ~ `1714 행`) 대비 마운트 props 는 12 줄 남짓이라 순감 `-40 줄` 안팎이 예상되며, 마커 승격 판정 자체는 별도 direct slice 소관이다(본 task 는 PLAN 을 건드리지 않는다).

## Required Reading

- [docs/PLAN.md](../PLAN.md) `184 행` — 경로 2 제약 3 종(패널 1 개씩 · 순수 추출 3 조건 **미충족**이라 `sizeExempt` 금지 · anchor census 선행) 문단.
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) 의 그룹 패널 — `1649 행` ~ `1652 행`(마운트 선행 주석 4 줄, "children 으로 통과" 서술이 본 task 로 무효가 되므로 갱신 대상) · `1653 행` ~ `1659 행`(`<AdminGroupsSection …>` 여는 태그 + 목록 축 5 props) · `1660 행` ~ `1676 행`(**생성 폼 `<div>`** — input `추가할 그룹 이름` · `그룹 추가` 버튼 · `createGroupError` alert) · `1677 행` ~ `1686 행`(인라인 수정 폼 주석 10 줄) · `1687 행` ~ `1714 행`(**인라인 수정 폼** 조건부 `editingGroupId !== null ? … : null`) · `1715 행`(닫는 `</AdminGroupsSection>`).
- 같은 파일의 그룹 폼 상태 · 핸들러 선언(**옮기지 않는다**, 값만 props 로 내려보낸다) — `619 행`(`groupNameInput`/`setGroupNameInput`) · `623 행`(`creatingGroup`) · `627 행`(`createGroupError`) · `635 행`(`handleCreateGroup`) · `680 행`(`editingGroupId`) · `685 행`(`editGroupNameInput`/`setEditGroupNameInput`) · `694 행`(`updatingGroup`) · `698 행`(`updateGroupError`) · `728 행`(`handleCancelEditGroup`) · `741 행`(`handleUpdateGroup`).
- [web/src/views/AdminGroupsSection.tsx](../../web/src/views/AdminGroupsSection.tsx) 전량 53 줄 — `6 행`(`import type { ReactNode }`) · `10 행` ~ `21 행`(props 인터페이스: 목록 축 5 + `children?`) · `31 행` ~ `44 행`(렌더 트리 `<section>` → `<h2>` → `{children}` → `<GroupList>`) · `50 행` ~ `52 행`(export convention).
- [web/src/views/AdminCollectionTargetsSection.tsx](../../web/src/views/AdminCollectionTargetsSection.tsx) `1 행` ~ `52 행` — **직전 슬라이스 2/2 의 형**: props 그룹별 주석 · `on<Axis>Change` / `on<Axis>Submit` 네이밍 · "변환 · 기본값 부여 0" 원칙 · children 슬롯 제거 서술을 그대로 승계한다.
- [web/src/views/AdminGroupsSection.test.tsx](../../web/src/views/AdminGroupsSection.test.tsx) 전량 96 줄 — `baseProps` factory 관례와 `renderToStaticMarkup` 정적 렌더 케이스. children 전달/미전달 · children 순서 index 단언 케이스는 본 task 로 소멸하므로 폼 축 케이스로 **대체**한다.
- [web/src/views/AdminView.test.tsx](../../web/src/views/AdminView.test.tsx) `5727 행` ~ `5752 행`(생성 폼 렌더 · 빈 필드 disabled 단언) · `7505 행` ~ `7513 행`(`editingGroupId=null` 시 수정 폼 미렌더 단언) — **markup 단언**이라 같은 DOM 을 내면 무수정 통과한다(무수정 통과가 본 task 의 렌더 동일성 실증 수단이다).
- [web/src/views/AdminView.groups-list-contract.test.ts](../../web/src/views/AdminView.groups-list-contract.test.ts) `77 행` ~ `84 행` — AdminView 소스를 읽는 유일한 그룹 drift-guard(anchor 는 prelude 의 `useApiResource<GroupRow[]>(groupsPath…)` 라 무수정 통과).
- [docs/decisions/ADR-0041-frontend-composition-wiring.md](../decisions/ADR-0041-frontend-composition-wiring.md) `§Decision 1` — 컴포넌트는 fetch 를 모른다(controlled props 전용, 조회 · 훅 호출 0).
- [CLAUDE.md](../../CLAUDE.md) `§3`(소비처 동반 의무 · cap) · `§3.2`(R-112).

## Acceptance Criteria

- [ ] [web/src/views/AdminGroupsSection.tsx](../../web/src/views/AdminGroupsSection.tsx) 가 생성 폼 · 인라인 수정 폼 마크업을 **글자 그대로** 흡수한다 — 렌더 트리는 `<section id={ADMIN_SECTION_GROUPS_ID} aria-label={GROUP_HEADING}>` → `<h2>` → 생성 폼 `<div>` → 인라인 수정 폼 조건부 → `<GroupList …/>` 순서로, 이동 전 DOM 과 동일하다(폼 2 종이 `<h2>` 뒤 · `GroupList` **앞** — T-1909 의 children 위치 그대로).
- [ ] props 흡수 12 축 — 생성 축 5(`createName: string` · `onCreateNameChange: (next: string) => void` · `onCreateSubmit: () => void` · `createLoading?: boolean` · `createError?: string`), 수정 축 7(`editingId: string | null` · `editName: string` · `onEditNameChange: (next: string) => void` · `onEditSubmit: () => void` · `onEditCancel: () => void` · `editLoading?: boolean` · `editError?: string`). 기존 목록 축 5 props 는 이름 · optional 여부 무변경. `children?: ReactNode` prop 과 `import type { ReactNode }` 는 **제거**한다(소비처 0).
- [ ] 분기 술어를 **동일 술어 그대로** 옮긴다 — 수정 폼은 `editingId !== null` 일 때만 렌더(undefined 를 편집 상태로 오인하지 않게 `string | null` 필수 prop), 버튼 disabled 식은 `createLoading || !createName.trim()` · `editLoading || !editName.trim()` 로 원본과 동형, alert 2 종은 falsy 면 미렌더. 컴포넌트 안에서 조회 · 훅 호출 · 자체 state · trim 외 값 변환 0(ADR-0041 §Decision 1).
- [ ] [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) 소비처 배선 **같은 PR** — `1660 행` ~ `1714 행`(children 55 줄)을 삭제하고 마운트를 **self-closing** `<AdminGroupsSection … />` 으로 전환하며 12 축을 props 로 전달한다(`createName={groupNameInput}` · `onCreateNameChange={(next) => setGroupNameInput(next)}` · `onCreateSubmit={handleCreateGroup}` · `createLoading={creatingGroup}` · `createError={createGroupError}` · `editingId={editingGroupId}` · `editName={editGroupNameInput}` · `onEditNameChange={(next) => setEditGroupNameInput(next)}` · `onEditSubmit={handleUpdateGroup}` · `onEditCancel={handleCancelEditGroup}` · `editLoading={updatingGroup}` · `editError={updateGroupError}`). `619 행` ~ `761 행` 의 상태 · 핸들러 선언은 **한 줄도 옮기지 않는다**.
- [ ] 주석 이관은 응축한다 — AdminView `1649 행` ~ `1652 행` 선행 주석은 "children 통과" 서술을 지우고 **4 줄 이하**로 갱신, 인라인 수정 폼 주석 10 줄(`1677 행` ~ `1686 행`)은 컴포넌트로 옮기되 **6 줄 이하**로 응축한다(주석 왕복만으로 20 LOC 을 쓰지 않기 위한 예산).
- [ ] happy-path 1+ — [web/src/views/AdminGroupsSection.test.tsx](../../web/src/views/AdminGroupsSection.test.tsx) 에서 `renderToStaticMarkup` 정적 렌더로 `aria-label="추가할 그룹 이름"` input · `그룹 추가</button>` · 전달한 group row 이름이 한 마크업에 함께 나옴을 검증.
- [ ] error path 1+ — `createError` · `editError` 각각에 문자열을 주면 해당 폼 하단에 `role="alert"` 문구가 렌더되고 throw 0 임을 검증(둘은 서로 다른 자리라 동시 전달 시 **2 개** 가 나옴을 함께 단언).
- [ ] 분기마다 1+ — (a) `editingId` null → 수정 폼 미렌더 / 문자열 → 렌더, (b) `createLoading` true → input · 버튼 `disabled` / false → 활성, (c) `createName` 이 공백뿐 → `그룹 추가` disabled / 유효 문자열 → 활성, (d) `editLoading` true → 수정 · 취소 버튼 disabled, (e) `createError`/`editError` falsy → alert 미렌더.
- [ ] negative 를 예외 분기마다 1+ — (a) `editName` 이 공백뿐이면 `그룹 수정` 버튼이 disabled 이고 throw 0, (b) `editingId` 가 빈 문자열 `''` 이어도 (null 이 아니므로) 수정 폼이 렌더되어 원본 술어와 동일함, (c) `groups` 빈 배열 + 두 폼 값 빈 문자열의 초기 상태에서 안전 렌더, (d) `createLoading` 과 `createError` 가 동시에 truthy 인 충돌 입력에서 disabled 와 alert 가 함께 유지되고 throw 0, (e) `onDelete`/`onEdit` 미전달 읽기 전용 경로에서 행 컨트롤 미렌더 + 폼은 그대로 렌더.
- [ ] 폼 위치 회귀 방어 1+ — 생성 폼 마커(`추가할 그룹 이름`) · 수정 폼 마커(`수정할 그룹 이름`) · group row 이름의 마크업 내 **문자열 index 순서**가 `<h2>` < 생성 폼 < 수정 폼 < 목록 임을 단언(JSX 순서가 뒤집히면 fail).
- [ ] 기존 spec **무수정** green — `AdminView.test.tsx` `5727 행` ~ `5752 행` · `7505 행` ~ `7513 행`, `AdminView.groups-list-contract.test.ts`, `GroupList.test.tsx` 를 한 줄도 고치지 않는다(고쳐야 한다면 마크업이 달라진 것이므로 되돌린다).
- [ ] 검증 명령 전량 green — root `pnpm lint && pnpm build && pnpm test`, `pnpm test:cov` 임계(line ≥ 80% / function ≥ 80%) 통과, `web` 에서 `pnpm test`(vitest run) · `pnpm build` 통과, `BASE_REF=origin/main scripts/check-spec-presence.sh` 통과.
- [ ] cap 준수 — 최종 diff 300 LOC 이하 / 파일 3 개. 파일별 예산: 컴포넌트 최종 165 줄 이하 · spec diff 100 LOC 이하(공용 `baseProps` factory 1 개, 케이스당 10 줄 이하) · AdminView diff 75 LOC 이하. 예산 초과가 불가피하면 `sizeExempt` 를 붙이지 말고 BLOCKED(`task-too-large`) 로 되돌린다(PLAN `184 행` 이 경로 2 를 순수 추출 3 조건 미충족으로 박제).
- [ ] 착수 시 census 재실행 — `grep -rn "추가할 그룹 이름\|수정할 그룹 이름\|editingGroupId" web/src --include=*.test.*` 로 그룹 폼 마크업 · 심볼을 anchor 로 쓰는 spec 이 늘지 않았음을 확인하고, 늘었으면 그 파일을 `touchesFiles` 에 합산한 뒤 파일 수 5 초과 시 BLOCKED 로 되돌린다.

## Out of Scope

- 그룹 조회 `useApiResource<GroupRow[]>(groupsPath)` · 그룹 mutation 러너(`runCreateGroup` · `runUpdateGroup`) · 상태 · `useCallback` 핸들러를 컴포넌트로 옮기지 않는다 — 컨테이너 잔존(ADR-0041 §Decision 1).
- `GroupList` 내부 수정 금지(props 계약 · 마크업 · 기본 문구 무변경, `emptyMessage` 신규 전달 금지).
- 폼 마크업 개선 금지 — `<form>` 전환 · label 재작성 · 접근성 속성 추가 · className 추가 · CSS 규칙 추가 모두 다른 주제다(발견 시 `Follow-ups`).
- 나머지 3 패널(사용자 관리 · 인원 · 파트) 손대지 않는다.
- `sizeExempt` 부여 금지.
- PLAN `184 행` 실측 LOC 갱신 · `≤ 2,000` 마커 승격 금지(별도 direct slice 소관).
- 새 문구 상수 · 배럴 재수출 추가 · 새 dependency 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (생성 시점 없음)
