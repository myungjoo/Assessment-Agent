---
id: T-1909
title: AdminView 그룹 패널의 section 껍데기 + 목록 축(`1650 행` ~ `1658 행` · `1714 행` ~ `1732 행`)을 AdminGroupsSection 으로 분해 (경로 2 슬라이스 1/2)
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-028, REQ-049]
estimatedDiff: 235
estimatedFiles: 3
independentStream: adminview-god-component-refactor
dependsOn: [T-1908]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminGroupsSection.tsx
  - web/src/views/AdminGroupsSection.test.tsx
created: 2026-09-06
plannerNote: "P6 · PLAN 184 행 경로 2 두 번째 패널 — 수집 대상 패널 완결(T-1907·T-1908) 후 최소 패널인 그룹 76 줄을 같은 2 분할 형(1/2 껍데기+목록 축)으로"
---

# T-1909 — AdminView 그룹 패널의 section 껍데기 + 목록 축을 AdminGroupsSection 으로 분해 (경로 2 슬라이스 1/2)

## Why

[docs/PLAN.md](../PLAN.md) `184 행` AdminView god component 부채 bullet 이 남은 유일한 수단으로 **경로 2(JSX 섹션 → 하위 컴포넌트)** 를 지목하고, 절단 기준을 "JSX return 안의 `<section>` 패널 1 개" 로, 진행 방식을 "cap(≤ 300 LOC / ≤ 5 파일) 안에서 패널 1 개씩" 으로 박제했다. 그 첫 대상인 수집 대상 패널은 [T-1907](T-1907-adminview-collection-targets-section-extract.md) · [T-1908](T-1908-adminview-collection-targets-section-absorb-children.md) 로 완결됐고(각 282 · 234 LOC diff), 본 task 는 **다음 패널**을 같은 형으로 집행한다.

**다음 대상 = 그룹 패널** — planner 가 head `115828dc` 에서 재실측한 잔여 4 패널은 사용자 관리 `1322 행` ~ `1437 행`(116 줄) · 인원 `1450 행` ~ `1649 행`(200 줄) · **그룹 `1657 행` ~ `1732 행`(76 줄)** · 파트 `1744 행` ~ `1845 행`(102 줄)이고, 그룹이 **최소 mass** 이며 PLAN 이 수집 대상 패널에 적용했던 두 선정 기준(축 밖 의존 최소 · 이 패널을 anchor 로 쓰는 drift-guard 0)을 그대로 만족한다. 근거: (i) 이 패널이 소비하는 값은 그룹 조회 `data`/`groupLoading`/`groupError`(`522 행` ~ `526 행`) · 그룹 mutation 상태 · `adminViewConstants` 문구뿐이다. (ii) census `grep -rl "AdminView.tsx" web/src --include=*.test.*` = **13 파일**이고 그중 AdminView 소스를 읽는 [AdminView.groups-list-contract.test.ts](../../web/src/views/AdminView.groups-list-contract.test.ts) 의 유일한 anchor 는 `78 행` 의 정규식 `useApiResource<GroupRow[]>(groupsPath…)` 인데 그 호출은 **prelude 에 그대로 남으므로** 무수정 통과한다. (iii) 배럴 재수출(`1884 행` ~ `2022 행`)에 `GroupList` · `GROUP_HEADING` · `ADMIN_SECTION_GROUPS_ID` 가 **없어** 공개 표면이 바뀌지 않는다.

**패널을 2 슬라이스로 나눈다** — 그룹 패널 전량(76 줄 JSX + props 21 개)을 한 슬라이스에 넣으면 T-1907(222 ins / 60 del) · T-1908(166 ins / 68 del) 실측 대비 합계가 **300 LOC 을 넘는다**. PLAN `184 행` 이 경로 2 를 순수 추출 3 조건 **미충족**으로 박제해 `sizeExempt` 직행이 금지되므로, [CLAUDE.md](../../CLAUDE.md) `§3` 의 "cap 초과가 `estimatedDiff` 수치로 제시된 경우" 예외에 따라 나누되 **각 슬라이스가 자기 소비처 배선을 동반**한다(컴포넌트 단독 PR 0). 본 1/2 는 `<section>` 껍데기 + `<h2>` + `<GroupList>` 마운트를 옮기고 **생성 폼 · 인라인 수정 폼은 `children` 슬롯으로 그대로 통과**시켜 JSX 순서 · 렌더 DOM 을 글자 그대로 보존한다(2/2 가 그 슬롯을 props 로 흡수한다).

## Required Reading

- [docs/PLAN.md](../PLAN.md) `184 행` — **경로 2 제약 3 종** · **anchor census 방법** 문단(다음 대상 서술은 수집 대상 패널 기준이라 stale, 본 task 의 좌표가 우선).
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) 의 그룹 패널 — `1650 행` ~ `1656 행`(선행 주석 7 줄) · `1657 행`(`<section id={ADMIN_SECTION_GROUPS_ID} aria-label={GROUP_HEADING}>`) · `1658 행`(`<h2>`) · `1659 행` ~ `1675 행`(생성 폼 `<div>` — **이동 대상 아님, children 으로 잔존**) · `1676 행` ~ `1685 행`(수정 폼 주석) · `1686 행` ~ `1713 행`(인라인 수정 폼 조건부 — **children 으로 잔존**) · `1714 행` ~ `1724 행`(GroupList 주석) · `1725 행` ~ `1731 행`(`<GroupList …/>` 5 props) · `1732 행`(닫는 `</section>`).
- 같은 파일 `224 행` ~ `227 행`(`GroupList` import + 주석) · `346 행`(`ADMIN_SECTION_GROUPS_ID`) · `357 행`(`GROUP_HEADING`) — 이동 후 미사용이 되는 import 정리 대상.
- 같은 파일 `517 행` ~ `526 행` — 그룹 조회 `useApiResource<GroupRow[]>(groupsPath)` destructure(**손대지 않는다**, 값만 props 로 내려보낸다).
- [web/src/components/GroupList.tsx](../../web/src/components/GroupList.tsx) `39 행` ~ `61 행` — props 계약(`groups` 필수, `loading`/`error`/`emptyMessage`/`onDelete`/`onEdit` optional) 과 분기 순서(loading → error → empty → populated).
- [web/src/views/adminViewConstants.ts](../../web/src/views/adminViewConstants.ts) `36 행`(`GROUP_HEADING`) · `211 행`(`ADMIN_SECTION_GROUPS_ID`) — 신설 컴포넌트가 직접 import 할 문구 · id 상수.
- [web/src/views/AdminView.groups-list-contract.test.ts](../../web/src/views/AdminView.groups-list-contract.test.ts) `77 행` ~ `84 행` · `114 행` · `121 행` — AdminView 소스를 읽는 유일한 그룹 drift-guard 의 anchor 정규식(무수정 통과 근거).
- [web/src/views/AdminView.test.tsx](../../web/src/views/AdminView.test.tsx) `10013 행` ~ `10045 행` — 섹션 id 5 종 · nav 렌더 단언(**markup 단언**이라 자식 컴포넌트가 같은 마크업을 내면 무수정 통과).
- [web/src/views/AdminCollectionTargetsSection.tsx](../../web/src/views/AdminCollectionTargetsSection.tsx) · [AdminCollectionTargetsSection.test.tsx](../../web/src/views/AdminCollectionTargetsSection.test.tsx) — **직전 슬라이스의 형(form)**: props 전용 presentational + `renderToStaticMarkup` 정적 렌더 spec + 공용 `baseProps` factory 관례를 그대로 차용한다.
- [docs/decisions/ADR-0041-frontend-composition-wiring.md](../decisions/ADR-0041-frontend-composition-wiring.md) `§Decision 1` — 컴포넌트는 fetch 를 모른다(본 컴포넌트는 조회 · 훅 호출 0, controlled props 전용).
- [CLAUDE.md](../../CLAUDE.md) `§3`(소비처 동반 의무) · `§3.2`(R-112).

## Acceptance Criteria

- [ ] 신설 [web/src/views/AdminGroupsSection.tsx](../../web/src/views/AdminGroupsSection.tsx) — default export 컴포넌트 `AdminGroupsSection` 과 named export 타입 `AdminGroupsSectionProps`. 렌더 트리는 `<section id={ADMIN_SECTION_GROUPS_ID} aria-label={GROUP_HEADING}>` → `<h2>{GROUP_HEADING}</h2>` → `{children}` → `<GroupList …/>` 순서로, 이동 전 마크업과 **동일한 DOM** 을 낸다(children 이 GroupList 보다 **앞**에 오는 순서가 원본 그대로임을 반드시 지킬 것 — 수집 대상 패널과 순서가 반대다).
- [ ] props 는 목록 축 5 개 + `children?: ReactNode` — `groups` · `loading?` · `error?` · `onDelete?` · `onEdit?`. `ADMIN_SECTION_GROUPS_ID` · `GROUP_HEADING` 은 prop 이 아니라 컴포넌트가 `adminViewConstants` 에서 **직접 import** 한다. 컴포넌트 안에서 조회 · 훅 호출 · 자체 state · 신규 분기 0(ADR-0041 §Decision 1).
- [ ] [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) 소비처 배선 **같은 PR** — `1650 행` ~ `1658 행` 및 `1714 행` ~ `1732 행` 을 지우고 그 자리에 `<AdminGroupsSection groups={data ?? []} loading={groupLoading || deletingGroup} error={deleteGroupError ?? groupError} onDelete={handleDeleteGroup} onEdit={handleEditGroup}>` 마운트를 넣되, `1659 행` ~ `1713 행`(생성 폼 + 수정 폼 주석 + 인라인 수정 폼)은 **중첩 깊이 그대로** children 으로 남긴다(재들여쓰기 churn 0). 선행 주석 7 줄은 마운트 위 **4 줄 이하**로 응축한다.
- [ ] import 정리 — 위 이동으로 미사용이 된 `GroupList`(+ 주석 `224 행` ~ `226 행`) · `ADMIN_SECTION_GROUPS_ID` · `GROUP_HEADING` 을 AdminView 에서 제거하고, 신규 `AdminGroupsSection` import 를 추가한다. 그룹 조회 · 그룹 mutation 러너 import 는 **유지**(prelude 와 children 이 계속 쓴다).
- [ ] happy-path 1+ — 신설 colocated spec [web/src/views/AdminGroupsSection.test.tsx](../../web/src/views/AdminGroupsSection.test.tsx) 에서 `renderToStaticMarkup` 정적 렌더로 `id="admin-section-groups"` · `aria-label="그룹 관리"` · `<h2>그룹 관리</h2>` · 전달한 group row 이름이 함께 나옴을 검증.
- [ ] error path 1+ — `error` 에 문자열을 주면 `role="alert"` 오류 표면이 렌더되고 목록 본체는 미표시이며 throw 0 임을 검증.
- [ ] 분기마다 1+ — (a) `loading` true(로딩 표시 우선) / false, (b) `groups` 빈 배열(기본 empty 문구) / 1+ row, (c) `children` 전달 / 미전달, (d) `onDelete`/`onEdit` 전달 시 행 버튼 렌더 / 미전달 시 미렌더.
- [ ] negative 를 예외 분기마다 1+ — (a) `onDelete` · `onEdit` 를 모두 `undefined` 로 준 읽기 전용 경로에서 삭제 · 수정 버튼이 **하나도 렌더되지 않고** throw 0, (b) `groups` 가 빈 배열이어도 기본 empty 문구로 안전 렌더, (c) `children` 미전달 시 section 이 빈 자식으로도 정상 렌더, (d) `loading` true 이면서 `error` 도 truthy 인 충돌 입력에서 loading 우선 정책이 유지되고 throw 0, (e) row 의 `id` 가 없어도 throw 없이 렌더.
- [ ] children 순서 회귀 방어 1+ — children 마커와 group row 문구를 함께 렌더해 **children 이 `<h2>` 뒤 · GroupList 앞** 위치에 나옴을 문자열 index 비교로 단언(JSX 순서가 뒤집히면 fail).
- [ ] 기존 spec **무수정** green — `AdminView.groups-list-contract.test.ts` · `AdminView.test.tsx` 섹션 id · nav 단언 · `GroupList.test.tsx` 를 한 줄도 고치지 않는다(고쳐야 한다면 마크업이 달라진 것이므로 되돌린다).
- [ ] 검증 명령 전량 green — root `pnpm lint && pnpm build && pnpm test`, `pnpm test:cov` 임계(line ≥ 80% / function ≥ 80%) 통과, `web` 에서 `pnpm test`(vitest run) · `pnpm build` 통과, `BASE_REF=origin/main scripts/check-spec-presence.sh` 통과.
- [ ] cap 준수 — 최종 diff 300 LOC 이하 / 파일 3 개. 파일별 예산: 신설 컴포넌트 75 줄 이하(이동 주석은 10 줄 이하로 응축) · 신설 spec 110 줄 이하(공용 `baseProps` factory 1 개로 케이스당 10 줄 이하) · AdminView diff 60 줄 이하. 예산 초과가 불가피하면 `sizeExempt` 를 붙이지 말고 BLOCKED(`task-too-large`) 로 되돌린다.
- [ ] 착수 시 census 재실행 — `grep -rl "AdminView.tsx" web/src --include=*.test.*` 를 다시 돌려 그룹 패널 심볼 · 호출식을 anchor 로 쓰는 파일이 늘지 않았음을 확인하고, 늘었으면 그 파일을 `touchesFiles` 에 합산한 뒤 파일 수 5 초과 시 BLOCKED 로 되돌린다.

## Out of Scope

- 생성 폼(`1659 행` ~ `1675 행`) · 인라인 수정 폼(`1676 행` ~ `1713 행`)을 props 로 흡수하지 않는다 — children 슬롯으로 통과만 시킨다(슬라이스 2/2 소관).
- 그룹 조회 `useApiResource<GroupRow[]>(groupsPath)` 호출 · destructure(`517 행` ~ `526 행`) · 그룹 mutation 러너 · 핸들러를 컴포넌트로 옮기지 않는다.
- `GroupList` 내부 수정 금지(props 계약 · 마크업 · 기본 문구 무변경). `emptyMessage` 를 새로 넘기지 않는다(현재 미전달 → 기본 문구 fallback 유지).
- 나머지 3 패널(사용자 관리 · 인원 · 파트) 손대지 않는다.
- `sizeExempt` 부여 금지 — PLAN `184 행` 이 경로 2 를 순수 추출 3 조건 **미충족**으로 박제했다.
- PLAN `184 행` 실측 LOC 갱신 · 마커 승격 금지(별도 direct slice). 현 실측 2,022 줄은 목표선 ≤ 2,000 을 아직 `+22` 초과한다.
- 새 문구 상수 · 새 className · 새 CSS 규칙 · 새 dependency 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (생성 시점 없음 — 슬라이스 2/2(생성 폼 · 수정 폼 props 흡수)는 본 PR 머지 후 planner 가 큐잉한다.)
