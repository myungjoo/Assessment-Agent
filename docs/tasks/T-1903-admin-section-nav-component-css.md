---
id: T-1903
title: Admin 섹션 탭/구획 내비게이션 순수 component + 전역 CSS anchor 신설
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-080]
independentStream: web-admin-section-nav
dependsOn: []
touchesFiles:
  - web/src/components/AdminSectionNav.tsx
  - web/src/components/AdminSectionNav.test.tsx
  - web/src/styles/global.css
estimatedDiff: 245
estimatedFiles: 3
created: 2026-09-05
requeued: null
plannerNote: PLAN 134 행 🔴 오너 지시의 유일한 잔여(AdminView 섹션 탭 내비) 1/2 — 순수 component + CSS anchor
---

# T-1903 — Admin 섹션 탭/구획 내비게이션 순수 component + 전역 CSS anchor 신설

## Why

[PLAN.md](../PLAN.md) `134 행` 🔴 오너 지시(2026-08-26 UI 기본기)의 5 개 항목 중 ② ~ ⑤ 와 ① 앞 축(전역 CSS 도입, T-1858)은 전부 shipped 이고 **잔여는 ① 뒤 축인 "관리 화면 다수 섹션의 탭/구획 내비게이션" 1 건뿐**이다. 같은 bullet 의 "다음 행동" 이 그 slice 를 `pr` 로 지정하면서 **마크업 anchor(className)와 그 anchor 를 잡는 전역 CSS 규칙을 한 slice 에 함께** 넣으라고 못박았으므로, 본 task 는 그 둘을 같은 PR 에 담는다.

**issue-still-relevant pre-check (origin/main `9a90318d`)** — ① `git grep -n "AdminSectionNav|section-nav|SECTION_NAV" origin/main -- web/` **0 매치** (component · className anchor 모두 미박제), ② `git grep -n -i "tab|nav\b|activeSection" origin/main -- web/src/views/AdminView.tsx` **0 매치** (AdminView 에 내비 마크업 없음), ③ `git grep -n -i "tab" origin/main -- web/src/styles/global.css` 는 `51 행` `table { ... }` 뿐이라 탭 규칙 부재, ④ [requirements.md](../requirements.md) `99 행` REQ-080 이 `IN_PROGRESS` (뒤 축 미shipped 명시). → 본 slice 는 잔여 전량이 미안착 상태에서 착수한다.

**소비처 동반 의무([CLAUDE.md](../../CLAUDE.md) `§3`) 예외 근거 — 수치 제시** — AdminView 마운트까지 합치면 `AdminView.tsx` 의 section id 부여 5 곳 + 섹션 descriptor 상수 + active 상태 + nav 렌더(약 40 ~ 60 LOC)와 `AdminView.test.tsx` 정적 렌더 케이스(약 60 ~ 80 LOC)가 더해져 **합계 약 345 ~ 385 LOC / 5 파일**로 `§3` cap(≤ 300 LOC)을 초과한다. 본 slice 는 className anchor(마크업)와 CSS 규칙을 **함께** 담아 "CSS 만 넣고 마크업을 미루는" 금지 형태를 피하고, AdminView 배선은 `§Follow-ups` 에 파일 · 배선 단위로 명시한다 (T-1900 → T-1901 과 동일한 분할 선례).

## Required Reading

- [docs/PLAN.md](../PLAN.md) `134 행` — 오너 지시 bullet 의 "본 bullet 의 잔여" · "다음 행동" 문장.
- [docs/decisions/ADR-0061-frontend-global-stylesheet.md](../decisions/ADR-0061-frontend-global-stylesheet.md) `§Decision` D1 ~ D4 (순수 CSS · 새 dep 0 · `:root` 토큰 전용 규약).
- [web/src/styles/global.css](../../web/src/styles/global.css) `9 ~ 25 행` (`:root` 토큰 15 종) · `27 ~ 60 행` (element 규칙 배치 관례).
- [web/src/components/DashboardPeriodSelector.tsx](../../web/src/components/DashboardPeriodSelector.tsx) `1 ~ 40 행` — 순수 presentational component 관례(주석 머리말 · props 계약 · named + default export).
- [web/src/components/DashboardPeriodSelector.test.tsx](../../web/src/components/DashboardPeriodSelector.test.tsx) `1 ~ 25 행` — vitest + `renderToStaticMarkup` 정적 렌더 검증 관례(jsdom · testing-library 미사용, 콜백은 순수 export 함수 직접 호출).
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) `1267 행` · `1395 행` · `1602 행` · `1689 행` · `1800 행` — 후속 배선 대상 `<section aria-label=...>` 5 곳(본 task 는 읽기만, 수정 금지).

## Acceptance Criteria

- [ ] `web/src/components/AdminSectionNav.tsx` 신설 — 순수 presentational component. `fetch` · `apiClient` · `useApiResource` · AdminView import 0, 새 외부 dependency 0.
- [ ] public 표면은 정확히 다음으로 고정 — className 상수 3 종(`ADMIN_SECTION_NAV_CLASS` = `admin-section-nav`, `ADMIN_SECTION_NAV_ITEM_CLASS` = `admin-section-nav__item`, `ADMIN_SECTION_NAV_ACTIVE_CLASS` = `admin-section-nav__item--active`), 접근성 라벨 상수 1 종, 타입 `AdminSectionDescriptor` (`{ id: string; label: string }`), 순수 함수 `selectSection(sections, activeId, nextId, onSelect?)`, component `AdminSectionNav` (named + default export).
- [ ] 렌더 계약 — `<nav aria-label=...>` 안에 descriptor 당 `<button type="button">` 1 개, 활성 항목만 active className + `aria-current="true"`. `sections` 가 빈 배열이면 **`null` 반환**(마크업 0).
- [ ] `selectSection` 계약 — 목록에 없는 `nextId` 면 `onSelect` 미발화, 이미 활성인 id 재선택도 미발화, `onSelect` 미전달 시 throw 0.
- [ ] `web/src/styles/global.css` 에 위 anchor 3 종 규칙 추가 — 값은 기존 `:root` 토큰(`--space-*` · `--color-*` · `--radius-*`)만 사용하고 신규 토큰 선언 0, 외부 `@import` 0 (ADR-0061 D1 · D3).
- [ ] colocated spec `web/src/components/AdminSectionNav.test.tsx` 신설 — happy-path 1+ (descriptor 3 개 + 활성 1 개 렌더 시 버튼 3 개 · active className · `aria-current` 검증).
- [ ] error path 1+ — `sections: []` 에서 `null` 반환(렌더 문자열 빈 값) 검증.
- [ ] 분기마다 1+ — (a) 활성 / 비활성 항목 className 분기, (b) `activeId` 미지정(undefined) 분기, (c) `onSelect` 유 / 무 분기.
- [ ] negative 를 예외 분기마다 1+ — (a) 빈 `sections`, (b) 목록에 없는 `activeId`(활성 표시 0), (c) `onSelect` 미전달 시 `selectSection` 호출 throw 0, (d) 목록에 없는 `nextId` 로 호출 시 미발화, (e) 이미 활성인 id 재선택 시 미발화, (f) label 에 HTML 특수문자가 있어도 정적 렌더가 이스케이프.
- [ ] CSS drift guard 1+ — spec 이 `readFileSync` 로 `web/src/styles/global.css` 를 읽어 anchor 3 종이 **selector 로 실재**함을 검증(상수 → CSS 단방향 대조).
- [ ] 검증 명령 전량 green — root `pnpm lint && pnpm build && pnpm test`, `pnpm test:cov` 임계(line ≥ 80% / function ≥ 80%) 통과, `web` 에서 `pnpm test`(vitest run) 통과, `scripts/check-spec-presence.sh` 통과.
- [ ] 기존 spec 무수정 — `globalCssContract.test.ts` · `AdminView*.test.*` 를 한 줄도 고치지 않고 green.

## Out of Scope

- `web/src/views/AdminView.tsx` 수정 일체(마운트 · section id 부여 · active 상태) — 후속 slice.
- `web/src/styles/globalCssContract.ts` 의 `REQUIRED_CSS_TOKENS` 변경 · 신규 `:root` 토큰 도입.
- 섹션 표시 / 숨김(조건부 언마운트) · 라우팅 · `scrollIntoView` 등 실동작 내비게이션 — 본 slice 는 마크업 + 스타일 anchor 까지만.
- backend · `src/` · e2e · 워크플로 · `package.json` 변경.
- REQ-080 status 재판정 (`§3.1` rule — 구현 slice 전량 머지 뒤 1 회).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (소비처 배선, `pr`) `web/src/views/AdminView.tsx` 에 ① `<section>` 5 곳(`1267` · `1395` · `1602` · `1689` · `1800 행`)에 안정 `id` 부여, ② 기존 heading 상수를 재사용하는 섹션 descriptor 상수, ③ 활성 섹션 상태 + `AdminSectionNav` 마운트, ④ `AdminView.test.tsx` 정적 렌더 케이스(nav 존재 · 버튼 수 · 활성 표시) — 약 100 ~ 140 LOC / 2 파일.
