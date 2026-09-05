---
id: T-1904
title: AdminView 에 섹션 탭 내비 마운트 + 섹션 id 부여 (REQ-080 slice 2/2)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-080]
estimatedDiff: 240
estimatedFiles: 4
independentStream: p6-frontend-composition
dependsOn: [T-1903]
touchesFiles:
  - web/src/views/adminViewConstants.ts
  - web/src/views/adminViewConstants.test.ts
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.test.tsx
created: 2026-09-05
plannerNote: P6 · PLAN 134 행 ① 뒤 축 잔여 — T-1903 component 의 소비처 배선(AdminView 마운트) slice 2/2
---

# T-1904 — AdminView 에 섹션 탭 내비 마운트 + 섹션 id 부여 (REQ-080 slice 2/2)

## Why

[docs/PLAN.md](../PLAN.md) `134 행` 🔴 오너 지시(2026-08-26 UI 기본기)의 **유일한 잔여**인 "AdminView 다수 섹션 탭/구획 내비게이션" 을 닫는 뒤 조각이다. 앞 조각 [T-1903](T-1903-admin-section-nav-component-css.md)(PR #1496, main `e66078d3`)이 순수 component 와 전역 CSS anchor 3 종을 머지했고, 그 task `§Follow-ups` 가 본 slice 를 파일 · 배선 단위로 지정했다 — 지금 상태에서는 component 가 **어디에서도 마운트되지 않아** 화면 동작 변화가 0 이다([CLAUDE.md](../../CLAUDE.md) `§3` 소비처 동반 의무의 잔여분).

**issue-still-relevant pre-check (origin/main `a2746710`)** — `git grep -n "AdminSectionNav" origin/main -- web/src` 의 히트가 `web/src/components/AdminSectionNav.tsx` · 그 colocated spec · `web/src/styles/global.css` `126 행` 주석뿐이고 **`web/src/views/AdminView.tsx` 히트 0**, `git grep -n "id=\"admin-section" origin/main -- web/src` 도 **0 매치**라 배선 · 섹션 id 부여가 모두 미박제임을 확인했다. 대상 `<section>` 5 곳은 `AdminView.tsx` `1267 행`(사용자) · `1395 행`(인원) · `1602 행`(그룹) · `1689 행`(파트) · `1800 행`(수집 대상)에 실재한다. 동일 의도의 PENDING task 도 없다(`grep -rl "AdminSectionNav" docs/tasks/` = T-1858 · T-1859 · T-1903 뿐).

## Required Reading

- [docs/PLAN.md](../PLAN.md) `134 행` — 오너 지시 bullet 의 "본 bullet 의 잔여" · "다음 행동" · "진행 pointer" 문장.
- [docs/tasks/T-1903-admin-section-nav-component-css.md](T-1903-admin-section-nav-component-css.md) `§Follow-ups` — 본 slice 가 이어받는 배선 4 항목(①~④).
- [web/src/components/AdminSectionNav.tsx](../../web/src/components/AdminSectionNav.tsx) `10 ~ 30 행`(className 상수 3 종 · 라벨 · `AdminSectionDescriptor` 타입) · `36 ~ 68 행`(`selectSection` 순수 함수의 3 미발화 조건) · `95 ~ 105 행`(export 배럴 — named + default).
- [web/src/views/adminViewConstants.ts](../../web/src/views/adminViewConstants.ts) `1 ~ 20 행` — 모듈 소유 범위(“(b) DOM id 상수 군”) · **AdminView 를 import 하지 않는 단방향 규약**.
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) `347 ~ 375 행`(`adminViewConstants` import 목록 — heading 상수 5 종 위치) · `725 행`(`isAdmin` 파생) · `964 ~ 970 행`(최상위 `<section aria-label="Admin 관리">` 렌더 진입) · `1267` · `1395` · `1602` · `1689` · `1800 행`(대상 `<section>` 5 곳) · `1878 행~`(파일 끝 export 배럴).
- [web/src/views/AdminView.test.tsx](../../web/src/views/AdminView.test.tsx) `1 ~ 45 행` — `useApiResource` `vi.mock` 라우터 + `renderToStaticMarkup` 정적 렌더 관례(jsdom · testing-library 미사용, 순수 helper 는 직접 호출).
- [web/src/views/adminViewConstants.test.ts](../../web/src/views/adminViewConstants.test.ts) `1 ~ 30 행` — 상수 모듈 spec 관례.

## Acceptance Criteria

- [ ] `web/src/views/adminViewConstants.ts` 에 섹션 id 상수 5 종 추가 — `ADMIN_SECTION_USERS_ID` = `admin-section-users`, `ADMIN_SECTION_PERSONS_ID` = `admin-section-persons`, `ADMIN_SECTION_GROUPS_ID` = `admin-section-groups`, `ADMIN_SECTION_PARTS_ID` = `admin-section-parts`, `ADMIN_SECTION_COLLECTION_TARGETS_ID` = `admin-section-collection-targets`.
- [ ] 같은 모듈에 순수 함수 `buildAdminSectionDescriptors(isAdmin: boolean): AdminSectionDescriptor[]` 추가 — label 은 기존 heading 상수(`USER_HEADING` · `PERSON_HEADING` · `GROUP_HEADING` · `PART_HEADING` · `COLLECTION_TARGET_HEADING`) **재사용**(새 문구 상수 0). `isAdmin === false` 이면 사용자 섹션 descriptor 를 제외한 4 개만 반환(그 섹션이 `isAdmin` gating 안쪽에만 마운트되므로 죽은 탭 미노출). 타입은 `../components/AdminSectionNav` 에서 **type-only import**, `AdminView` import 0(단방향 규약 유지).
- [ ] `web/src/views/AdminView.tsx` 배선 — ① 대상 `<section>` 5 곳(`1267` · `1395` · `1602` · `1689` · `1800 행`)에 위 id 상수로 `id={...}` 부여(기존 `aria-label` · 자식 마크업 무변경), ② 활성 섹션 상태 1 개(`activeSectionId`, 초기값은 신규 optional prop `initialActiveSectionId = ''` 로 주입 가능 — 기존 `initial*` prop 관례 정합), ③ 최상위 `<section aria-label="Admin 관리">` 여는 태그 직후에 `<AdminSectionNav sections={buildAdminSectionDescriptors(isAdmin)} activeId={...} onSelect={...} />` 마운트.
- [ ] 선택 발사는 `AdminView.tsx` 에 순수 runner `runSelectAdminSection(sectionId, deps)` 로 분리(기존 `run*` helper 관례) — `deps` 는 `{ setActiveSectionId, getElement? }`. 동작: 활성 상태를 `sectionId` 로 갱신하고, `getElement(sectionId)` 가 element 를 주면 그 element 의 `scrollIntoView?.()` 를 호출한다. element 미발견 · `scrollIntoView` 부재 · `getElement` 미전달 어느 경우에도 throw 0. `document` 직접 참조는 배선부(호출 지점)에만 두고 runner 는 순수 유지. 파일 끝 export 배럴에 `runSelectAdminSection` 추가.
- [ ] happy-path 1+ — `adminViewConstants.test.ts` 에서 `buildAdminSectionDescriptors(true)` 가 id 5 종 · heading 라벨 5 종을 순서대로 반환함을 검증, `AdminView.test.tsx` 정적 렌더에서 `admin-section-nav` 마크업과 버튼 개수 · 섹션 5 곳의 `id=` 속성 존재를 검증.
- [ ] error path 1+ — `runSelectAdminSection` 이 `getElement` 가 `null` 을 돌려주는 경우(섹션 미마운트)에도 throw 0 이고 상태 갱신은 그대로 일어남을 검증.
- [ ] 분기마다 1+ — (a) `isAdmin` true / false 로 descriptor 개수 5 / 4 분기, (b) `getElement` 전달 / 미전달 분기, (c) 반환 element 에 `scrollIntoView` 존재 / 부재 분기, (d) 활성 섹션 지정 / 미지정 상태의 정적 렌더 분기(활성 className 1 개 / 0 개).
- [ ] negative 를 예외 분기마다 1+ — (a) `buildAdminSectionDescriptors(false)` 반환에 `admin-section-users` **미포함**, (b) 비-Admin 정적 렌더 markup 에 사용자 탭 label 미노출, (c) `getElement` 가 throw 없이 `undefined` 를 돌려줄 때 무해, (d) `scrollIntoView` 가 함수가 아닐 때(속성이 숫자 등) 호출 시도 없이 무해, (e) descriptor 목록에 없는 `sectionId` 로 호출해도 상태 갱신 외 부작용 0(`getElement` 결과가 없으면 스크롤 시도 0), (f) 기존 정적 렌더 회귀 — nav 추가 후에도 인원 · 그룹 · 파트 · 수집 대상 섹션 heading 이 그대로 렌더.
- [ ] 검증 명령 전량 green — root `pnpm lint && pnpm build && pnpm test`, `pnpm test:cov` 임계(line ≥ 80% / function ≥ 80%) 통과, `web` 에서 `pnpm test`(vitest run) 통과, `BASE_REF=origin/main scripts/check-spec-presence.sh` 통과.
- [ ] 기존 spec 무수정 — `AdminSectionNav.test.tsx` · `globalCssContract.test.ts` · 기존 `AdminView*.test.*` 케이스를 한 줄도 고치지 않고 green(신규 케이스 추가만).

## Out of Scope

- `web/src/components/AdminSectionNav.tsx` · `web/src/styles/global.css` 수정 — T-1903 이 고정한 표면을 그대로 소비만 한다(CSS 규칙 추가 · className 상수 변경 금지).
- 섹션 조건부 표시 / 숨김(탭 전환 시 다른 섹션 언마운트) · 라우팅 · URL hash 동기화 — 본 slice 는 활성 표시 + 해당 섹션으로의 스크롤까지만.
- `AdminView.tsx` 의 기존 섹션 내부 마크업 · 상태 · mutation 배선 변경, god component 추가 분할(PLAN `183 행` 부채는 별도 slice).
- backend · `src/` · e2e · 워크플로 · `package.json` 변경, 새 외부 dependency.
- REQ-080 status 재판정 및 PLAN `134 행` 마커 승격 — [CLAUDE.md](../../CLAUDE.md) `§3.1` rule 대로 본 구현이 머지된 뒤 별도 `direct` doc-sync task 1 회.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (doc-sync, `direct`) 본 slice 머지 후 [docs/requirements.md](../requirements.md) `99 행` REQ-080 `IN_PROGRESS → DONE` 재판정 + PLAN `134 행` bullet `[x]` 승격 + `docs/architecture` 해당 행 동기.
- cap 초과 조짐 시 탈출구 — 케이스를 삭제하지 말고 `it.each` 로 압축하고, 그래도 300 LOC / 5 파일을 넘으면 `task-too-large` 로 escalate 한다.
