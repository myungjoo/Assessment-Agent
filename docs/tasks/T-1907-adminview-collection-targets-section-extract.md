---
id: T-1907
title: AdminView 수집 대상 패널의 section 껍데기 + 목록 축(`1854 행` ~ `1905 행`)을 AdminCollectionTargetsSection 으로 분해 (경로 2 슬라이스 1/2)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-072]
estimatedDiff: 285
estimatedFiles: 3
independentStream: adminview-god-component-refactor
dependsOn: [T-1906]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminCollectionTargetsSection.tsx
  - web/src/views/AdminCollectionTargetsSection.test.tsx
created: 2026-09-06
plannerNote: "P6 · PLAN 184 행 경로 2(JSX 섹션 분해) 첫 슬라이스 — 지목된 수집 대상 패널을 cap 산술대로 2 분할한 1/2(껍데기+목록 축), 소비처 배선 동반"
---

# T-1907 — AdminView 수집 대상 패널의 section 껍데기 + 목록 축을 AdminCollectionTargetsSection 으로 분해 (경로 2 슬라이스 1/2)

## Why

[docs/PLAN.md](../PLAN.md) `184 행` AdminView god component 부채 bullet 이 **경로 1(prelude → custom hook) 종료**를 확정하고 남은 수단으로 **경로 2(JSX 섹션 → 하위 컴포넌트)** 를 지목했으며, 다음 대상으로 **수집 대상 패널**(`1863 행` ~ `1939 행`, 77 줄 — 축 밖 의존이 가장 적고 이 패널을 anchor 로 쓰는 drift-guard 가 0)과 목적지 `web/src/views/AdminCollectionTargetsSection.tsx` 를 명시했다. 본 task 는 그 지목을 집행한다.

**다만 패널 1 개를 통째로 옮기는 단일 슬라이스는 cap 을 넘는다** — planner 실측 산술: ① AdminView 삭제 77 줄 + 마운트 · props 추가 약 32 줄 = 약 109 ② 신설 컴포넌트(22 props 인터페이스 + 이동 JSX) 약 115 ③ colocated spec 약 120 → 합계 **약 344 LOC > 300**. 같은 파일 계열의 실측 선례가 이 산술을 뒷받침한다 — [T-1903](T-1903-admin-section-nav-component-css.md) 은 소비처 배선 **없이** component 105 + spec 168 + CSS 22 = **295 insertions** 였고, [T-1904](T-1904-adminview-mount-section-nav.md) 는 배선만으로 **294 insertions / 6 deletions** 였다. PLAN `184 행` 이 박제한 대로 경로 2 는 순수 추출 3 조건 **미충족**이라 `sizeExempt` 직행이 금지되므로, [CLAUDE.md](../../CLAUDE.md) `§3` 의 "cap 초과가 `estimatedDiff` 수치로 제시된 경우" 예외에 따라 **패널을 2 슬라이스로 나누되 각 슬라이스가 자기 소비처 배선을 동반**한다(컴포넌트 단독 PR 0 — PLAN 경로 2 제약 (2) 준수). 본 1/2 는 `<section>` 껍데기 + `<h2>` + `<CollectionTargetList>` 마운트를 옮기고 오류 alert 3 종 · 등록 폼은 **`children` 슬롯으로 그대로 통과**시켜 JSX 순서 · 렌더 DOM 을 글자 그대로 보존한다(2/2 가 그 슬롯을 props 로 흡수한다).

착수 전 planner 가 확인한 사실(재확인 불요): AdminView.tsx 실측 **2,080 줄**, 패널 좌표 `1863 행` ~ `1939 행`, census `grep -rl "AdminView.tsx" web/src --include=*.test.*` = **13 파일이며 그중 수집 대상 심볼 · 호출식을 anchor 로 쓰는 파일 0**, [AdminView.test.tsx](../../web/src/views/AdminView.test.tsx) `10046 행` ~ `10052 행` 의 섹션 id 5 종 단언은 **렌더 markup 단언**이라 자식 컴포넌트가 같은 마크업을 내면 무수정 통과, 배럴 재수출(`1944 행` ~)에 `CollectionTargetList` · `COLLECTION_TARGET_HEADING` · `EMPTY_COLLECTION_TARGET_TEXT` · `ADMIN_SECTION_COLLECTION_TARGETS_ID` **없음**(공개 표면 무변경).

## Required Reading

- [docs/PLAN.md](../PLAN.md) `184 행` — AdminView 부채 bullet 의 **JSX 패널 인벤토리** · **경로 2 제약 3 종** · **다음 대상 = 수집 대상 패널** 문단.
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) `1854 행` ~ `1862 행`(선행 주석 블록) · `1863 행` ~ `1866 행`(`<section>` 여는 태그) · `1867 행`(`<h2>`) · `1868 행` ~ `1905 행`(`<CollectionTargetList …/>` 16 props + gating 주석) · `1906 행` ~ `1938 행`(오류 alert 3 종 + 등록 폼 — **이동 대상 아님, children 으로 잔존**) · `1939 행`(닫는 `</section>`).
- 같은 파일 `237 행` ~ `241 행`(`CollectionTargetList` import + 주석) · `351 행` · `357 행` · `360 행`(`ADMIN_SECTION_COLLECTION_TARGETS_ID` · `COLLECTION_TARGET_HEADING` · `EMPTY_COLLECTION_TARGET_TEXT` import) — 이동 후 미사용이 되는 import 정리 대상.
- 같은 파일 `944 행` ~ `970 행` — `useAdminCollectionTargets()` destructure 블록(**본 슬라이스에서 손대지 않는다**, 값만 props 로 내려보낸다).
- [web/src/components/CollectionTargetList.tsx](../../web/src/components/CollectionTargetList.tsx) — props 계약(이름 · optional 여부)만 확인.
- [web/src/views/adminViewConstants.ts](../../web/src/views/adminViewConstants.ts) `49 행` · `54 행` · `213 행` — 신설 컴포넌트가 직접 import 할 문구 · id 상수.
- [web/src/views/AdminView.test.tsx](../../web/src/views/AdminView.test.tsx) `10014 행` ~ `10082 행` — 섹션 id · heading 렌더 단언(무수정 통과 근거, `renderToStaticMarkup` 관례 참고).
- [web/src/components/AdminSectionNav.test.tsx](../../web/src/components/AdminSectionNav.test.tsx) — presentational 컴포넌트 spec 의 정적 렌더 관례(jsdom 미사용).
- [docs/decisions/ADR-0041-frontend-composition-wiring.md](../decisions/ADR-0041-frontend-composition-wiring.md) `§Decision 1` — 컴포넌트는 fetch 를 모른다(본 컴포넌트는 조회 · 훅 호출 0, controlled props 전용).
- [CLAUDE.md](../../CLAUDE.md) `§3`(소비처 동반 의무) · `§3.2`(R-112).

## Acceptance Criteria

- [ ] 신설 [web/src/views/AdminCollectionTargetsSection.tsx](../../web/src/views/AdminCollectionTargetsSection.tsx) — default export 컴포넌트 `AdminCollectionTargetsSection` 과 named export 타입 `AdminCollectionTargetsSectionProps`. 렌더 트리는 `<section id={ADMIN_SECTION_COLLECTION_TARGETS_ID} aria-label={COLLECTION_TARGET_HEADING}>` → `<h2>{COLLECTION_TARGET_HEADING}</h2>` → `<CollectionTargetList …/>` → `{children}` 순서로, 이동 전 마크업과 **동일한 DOM** 을 낸다(`emptyMessage` 는 prop 이 아니라 `EMPTY_COLLECTION_TARGET_TEXT` 상수를 컴포넌트가 직접 import 해 넘긴다).
- [ ] props 는 목록 축 14 개 + `children?: ReactNode` — `targets` · `loading` · `error` · `onDelete?` · `onToggleActive?` · `onEditStart?` · `editingId?` · `editEndpoint` · `onEditEndpointChange` · `onEditSubmit?` · `onEditCancel` · `editBusy` · `editScopes` · `onEditScopeChange?`. **`isAdmin` 을 prop 으로 받지 않는다** — gating 삼항(`isAdmin ? handler : undefined`)은 AdminView 호출부에 그대로 남겨 컴포넌트 안 신규 분기를 0 으로 유지한다(조회 · 훅 호출 · 상태 0, ADR-0041 §Decision 1).
- [ ] [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) 소비처 배선 **같은 PR** — `1854 행` ~ `1867 행` 및 `1868 행` ~ `1905 행` 을 지우고 그 자리에 `<AdminCollectionTargetsSection …>` 마운트를 넣되, `1906 행` ~ `1938 행`(오류 alert 3 종 + 등록 폼)은 **중첩 깊이 그대로** 그 컴포넌트의 children 으로 남긴다(재들여쓰기 churn 0). 선행 주석 블록 9 줄은 마운트 위 **4 줄 이하**로 응축한다.
- [ ] import 정리 — 위 이동으로 미사용이 된 `CollectionTargetList`(+ 주석 `237 행` ~ `240 행`) · `ADMIN_SECTION_COLLECTION_TARGETS_ID` · `COLLECTION_TARGET_HEADING` · `EMPTY_COLLECTION_TARGET_TEXT` 를 AdminView 에서 제거한다. `CollectionTargetAddForm` · 러너 3 종 import 는 **유지**(children 과 배럴 재수출이 계속 쓴다).
- [ ] happy-path 1+ — 신설 colocated spec [web/src/views/AdminCollectionTargetsSection.test.tsx](../../web/src/views/AdminCollectionTargetsSection.test.tsx) 에서 `renderToStaticMarkup` 정적 렌더로 `id="admin-section-collection-targets"` · `aria-label` · `<h2>수집 대상 관리</h2>` · 전달한 target row 문구가 함께 나옴을 검증.
- [ ] error path 1+ — `error` 에 문자열을 주면 그 오류 표면이 렌더되고 throw 0 임을 검증(목록 본체 미표시).
- [ ] 분기마다 1+ — (a) `loading` true / false, (b) `targets` 비어있음 / 1+ row, (c) `children` 전달 / 미전달, (d) `editingId` 일치 row 존재 / 부재(인라인 편집 폼 노출 · 미노출).
- [ ] negative 를 예외 분기마다 1+ — (a) `onDelete` · `onToggleActive` · `onEditStart` · `onEditSubmit` · `onEditScopeChange` 를 모두 `undefined` 로 준 비-Admin 경로에서 삭제 · 토글 · 편집 컨트롤이 **하나도 렌더되지 않고** throw 0, (b) `targets` 가 빈 배열이어도 `EMPTY_COLLECTION_TARGET_TEXT` 로 안전 렌더, (c) `children` 미전달 시 section 이 빈 자식으로도 정상 렌더, (d) row 의 선택 필드가 누락돼도(예: `endpoint` 없음) throw 없이 렌더.
- [ ] 기존 spec **무수정** green — `AdminView.collection-targets-*.test.tsx` 6 건 · `AdminView.test.tsx` 섹션 id · heading 단언을 한 줄도 고치지 않는다(고쳐야 한다면 마크업이 달라진 것이므로 되돌린다).
- [ ] 검증 명령 전량 green — root `pnpm lint && pnpm build && pnpm test`, `pnpm test:cov` 임계(line ≥ 80% / function ≥ 80%) 통과, `web` 에서 `pnpm test`(vitest run) · `pnpm build` 통과, `BASE_REF=origin/main scripts/check-spec-presence.sh` 통과.
- [ ] cap 준수 — 최종 diff 300 LOC 이하 / 파일 3 개. 파일별 예산: 신설 컴포넌트 105 줄 이하(이동 주석은 10 줄 이하로 응축) · 신설 spec 105 줄 이하(공용 `baseProps` factory 1 개로 케이스당 10 줄 이하) · AdminView diff 95 줄 이하. 예산 초과가 불가피하면 `sizeExempt` 를 붙이지 말고 BLOCKED(`task-too-large`) 로 되돌린다.

## Out of Scope

- `useAdminCollectionTargets()` 호출 · destructure 블록(`944 행` ~ `970 행`)을 컴포넌트로 옮기지 않는다 — 슬라이스 2/2 소관.
- 오류 alert 3 종 · 등록 폼(`1906 행` ~ `1938 행`)을 props 로 흡수하지 않는다 — children 슬롯으로 통과만 시킨다(2/2 소관).
- `CollectionTargetList` · `CollectionTargetAddForm` 내부 수정 금지(props 계약 · 마크업 무변경).
- 나머지 4 패널(사용자 · 인원 · 그룹 · 파트) 손대지 않는다.
- `sizeExempt` 부여 금지 — PLAN `184 행` 이 경로 2 를 순수 추출 3 조건 **미충족**으로 박제했다.
- PLAN `184 행` 실측 LOC 갱신 · 마커 승격 금지(별도 direct slice).
- 새 문구 상수 · 새 className · 새 CSS 규칙 · 새 dependency 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (생성 시점 없음 — 슬라이스 2/2 는 본 PR 머지 후 planner 가 PLAN `184 행` 지목대로 큐잉한다.)
