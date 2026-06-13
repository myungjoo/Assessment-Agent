---
id: T-0370
title: P6 frontend UI slice 10 — 대시보드 필터/정렬 툴바 presentational 컴포넌트 (web/src/components/DashboardFilterBar.tsx)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-038, REQ-046]
estimatedDiff: 170
estimatedFiles: 2
created: 2026-06-13
plannerNote: P6 bullet2(시각화 대시보드 정렬·필터·시계열) 첫 미커버 slice — 필터/정렬 툴바 순수 presentational, T-0361~T-0369 file-disjoint·새 dep 0·ci.yml 무관.
independentStream: p6-frontend-ui
dependsOn: []
touchesFiles:
  - web/src/components/DashboardFilterBar.tsx
  - web/src/components/DashboardFilterBar.test.tsx
---

# T-0370 — P6 frontend UI slice 10: 대시보드 필터/정렬 툴바 presentational 컴포넌트

## Why

PLAN [Phase P6](../PLAN.md) bullet2 "시각화 대시보드 (정렬·필터·시계열)" 의 **첫 미커버 slice** 를 컴포넌트로 분해한다. bullet3 Admin 패널 5 fragment (인원·그룹·재평가·import/export·스케줄) 는 T-0366~T-0369 로 전부 presentational 분해 완료됐고, bullet1(로그인/셋업=T-0362/T-0365)·bullet4(평가 진행 보호=T-0361) 도 커버됐다. bullet2 대시보드의 결과 표는 이미 `EvaluationResultTable`(T-0363)이 있으나 **표를 구동하는 필터/정렬 컨트롤(검색어·지표 선택·정렬 컬럼·정렬 방향)** 은 아직 없다. 본 task 는 그 **필터/정렬 툴바 presentational 컴포넌트**를 박제한다. 직전 P6 slice (T-0361~T-0369) 와 동일하게 props 로만 현재 필터 값·콜백·loading/error 를 받는 순수 controlled component 로 시작하며, 실제 결과 fetch(GET /api/*)·정렬/필터 실 로직·시계열 차트·페이지네이션·전역 상태·라우팅·App.tsx 배선은 후속 slice 책임이다. (정렬·필터 표시 R-038 / 조회·시각화 R-046 의 UI 표면을 props 기반으로 미리 박제하고 데이터 배선만 후속으로 미룬다.)

## Required Reading

- `web/src/components/EvaluationResultTable.tsx` — 본 툴바가 구동할 대상 표의 정렬 상태(`sortKey`/`sortDirection`) 표현·컬럼 키 convention 을 참조해 일관된 정렬 키/라벨을 노출한다 (대상/지표/점수 컬럼). 직접 import 하지 않고(file-disjoint 유지), 정렬 키 모양만 정합시킨다.
- `web/src/components/DataImportExportPanel.tsx` — loading/busy 우선 정책(`loading===true` 우선) + `role="status"` 진행 표시 / `role="alert"` 에러 + 콜백 선택적 렌더(콜백 전달 시에만 트리거) + 라벨 fallback + named/default export convention 의 직전 선례. 본 task 의 입력·선택·버튼·진행상태·에러 분기 구조는 이 패턴을 그대로 차용한다.
- `web/src/components/DataImportExportPanel.test.tsx` — `react-dom/server` 의 `renderToStaticMarkup(<...>)` 으로 **jsdom 없이** 정적 markup 문자열만 검증하는 vitest 패턴 (dep 표면 최소화). 파일명 `.test.tsx` 고정 (root jest `testRegex .*\.spec\.ts$` pickup 충돌 회피).
- `docs/decisions/ADR-0040-frontend-stack.md` — §1 (React + Vite + TS), §2 (컴포넌트 구조·props 기반 presentational 정책·접근성 role 사용), §5 (dep 게이트: react / react-dom / vitest 만 — 그 외 import 금지).
- `web/tsconfig.json` — `jsx: react-jsx`, `strict: true`, `noUnusedLocals/Parameters` (lint-tight 컴파일).
- `web/package.json` — 사용 가능한 dep (react / react-dom / vitest 만).

## Acceptance Criteria

- [ ] `web/src/components/DashboardFilterBar.tsx` 신설. props 만 받는 순수 presentational controlled 컴포넌트. 최소 인터페이스 (구현이 동등 의미로 조정 가능):
  - 정렬 옵션 타입: `interface SortOption { key: string; label: string }` (named export).
  - props: `{ searchTerm?: string; onSearchChange?: (value: string) => void; sortOptions?: SortOption[]; sortKey?: string; onSortKeyChange?: (key: string) => void; sortDirection?: 'asc' | 'desc'; onSortDirectionToggle?: () => void; onReset?: () => void; loading?: boolean; error?: string; searchLabel?: string; resetLabel?: string }`.
  - **분기 동작 (R-112 cover 대상)**:
    - `loading === true` 면 `role="status"` 영역에 진행 표시 ("불러오는 중…" 등) 를 렌더하고, 검색 입력·정렬 선택·방향 토글·초기화 버튼은 비활성(`disabled`) 또는 미렌더하여 조작 중복을 막는다 (loading 우선 정책).
    - `loading` 이 아니고 `error` 가 truthy 면 `role="alert"` 영역에 error 문구를 렌더한다. (빈 문자열 `error` 는 falsy → alert 미렌더 — 경계값.)
    - `loading` 이 아니면 검색 입력(`<input>`)을 렌더하고, 현재 `searchTerm` 값을 표시하며, 변경(change) 시 `onSearchChange` 가 전달돼 있으면 `onSearchChange(value)` 를 호출한다. `onSearchChange` 미전달 시 입력을 비활성(읽기 표시) 또는 미렌더한다.
    - `loading` 이 아니면 정렬 컬럼 선택(`<select>` 또는 버튼 그룹)을 렌더한다. `sortOptions` 가 비었거나 미전달이면 선택 UI 를 미렌더(또는 비활성)한다. 옵션 변경 시 `onSortKeyChange` 가 전달돼 있으면 `onSortKeyChange(key)` 를 호출하고, 현재 `sortKey` 와 일치하는 옵션을 selected 로 표시한다.
    - `loading` 이 아니면 정렬 방향 토글 버튼을 렌더하고, 현재 `sortDirection`(기본 `'asc'`)을 라벨/표식(예: "오름차순"/"내림차순")으로 표시하며, 클릭 시 `onSortDirectionToggle` 가 전달돼 있으면 호출한다. 콜백 미전달 시 비활성 또는 미렌더한다.
    - `loading` 이 아니면 초기화 버튼을 렌더하고, 클릭 시 `onReset` 가 전달돼 있으면 호출한다. `onReset` 미전달 시 비활성 또는 미렌더한다.
    - `searchLabel`/`resetLabel` 미전달 시 기본 한국어 라벨(예: "검색", "초기화")로 fallback 한다. 빈 문자열이면 기본 라벨로 fallback (의미 없는 빈 라벨 방지).
  - named export(props 타입·`SortOption`)와 default export(컴포넌트)를 직전 컴포넌트와 동일 convention 으로 제공한다. 새 dependency import 금지 (react 만). fetch·라우팅·외부 store·실제 정렬/필터 로직 사용 금지 — 콜백 호출만.
- [ ] `web/src/components/DashboardFilterBar.test.tsx` 신설 — colocated spec. `vitest` + `react-dom/server` 의 `renderToStaticMarkup` 으로 정적 markup 만 검증 (새 dep 0). 파일명은 `.test.tsx` 고정. (콜백 호출 자체는 jsdom 이벤트가 필요하므로, 콜백 분기는 **렌더 구조** — 입력/선택/버튼의 존재·`disabled` 속성 유무·라벨 텍스트·`searchTerm`/`sortKey`/`sortDirection` 값 반영·`sortOptions` 렌더 — 로 검증한다. 직전 slice 와 동일하게 정적 markup 단언으로 분기 cover.)
- [ ] **Happy-path test 1+**: 정상 상태(loading/error 없음, 모든 콜백+`sortOptions` 전달)에서 검색 입력·정렬 선택·방향 토글·초기화 버튼이 활성 상태로 렌더되고 라벨·`searchTerm`·선택된 `sortKey`·`sortDirection` 표식이 표시됨을 검증.
- [ ] **Error path test 1+**: `error` truthy 전달 시 `role="alert"` 영역에 문구가 렌더됨을 검증.
- [ ] **Flow/branch test (각 분기 1+)**: loading 분기(`loading=true` → `role="status"` 진행 표시 렌더 + 컨트롤 비활성/미렌더), 검색 입력 렌더 분기, 정렬 선택 렌더 분기, 방향 토글 분기(asc/desc 표식 차이), 초기화 버튼 렌더 분기 각각 1+ test.
- [ ] **Negative cases 충분 cover (각 1+)**: `loading=true` 가 error·콜백보다 우선 (loading 우선 정책 — 컨트롤 비활성/미렌더) 1+; `error` 와 정상 props 동시 전달 시 error 우선 처리 1+; `onSearchChange` 미전달 시 검색 입력 비활성/미렌더 1+; `sortOptions` 빈 배열/미전달 시 정렬 선택 미렌더/비활성 1+; `onSortDirectionToggle` 미전달 시 방향 토글 비활성/미렌더 1+; `onReset` 미전달 시 초기화 버튼 비활성/미렌더 1+; `searchLabel`/`resetLabel` 미전달 시 기본 라벨 fallback 1+; 빈 문자열 `error`(falsy → alert 미렌더 경계값) 1+; `sortDirection` 미전달 시 기본 `'asc'` 표식 1+.
- [ ] `cd web && pnpm test` 통과 (web vitest 전부 green) — 신규 spec 포함.
- [ ] `cd web && pnpm lint && pnpm build` 통과 (`strict` + `noUnusedLocals/Parameters` 위반 0).
- [ ] 기존 backend 불변: root 에서 `pnpm lint && pnpm build && pnpm test` + `pnpm test:cov` 그대로 green (line ≥ 80% / function ≥ 80% — backend jest 에만 적용, web 은 vitest 별도). 본 task 는 `web/` 만 건드리므로 backend 영향 0.
- [ ] R-110: production code(컴포넌트) 변경이 있으므로 tester 가 위 명령을 실행·green 확인.
- [ ] R-114: push 후 PR CI 전 step green 확인 — approval-gate ordering fail 은 STATE.json `ci.benignRedNote` case A 절차(reviewer approve comment post 후 `gh run rerun <id> --failed`)로 처리.
- [ ] 본 컴포넌트는 분기(loading/error/검색/정렬선택/방향/초기화)가 있으므로 각 분기 1+ test 로 coverage line ≥ 80% / function ≥ 80% 충족(web vitest 기준).

## Out of Scope

- 실제 결과 fetch(GET /api/*) · 정렬/필터 실 로직(배열 정렬·필터링) · 시계열 차트 렌더 · 페이지네이션 · debounce · URL query 동기 · 토스트 배선 — 후속 slice 책임. 본 task 는 props 로 받은 상태를 표시하고 콜백만 호출.
- `EvaluationResultTable` 과의 실제 결합(툴바가 표를 구동) · 컨테이너 컴포넌트 · 상태 lift-up — 후속 wiring slice 책임. 본 task 는 file-disjoint 유지 (기존 컴포넌트 import·수정 0).
- 날짜 범위 선택기 · 다중 필터(AND/OR) · 저장된 필터 프리셋 — 별도 후속 slice.
- `App.tsx` 에 컴포넌트 wiring · 대시보드 컨테이너 · 라우팅 — 후속 slice 책임 (T-0361~T-0369 와 동일 정책).
- `.github/workflows/ci.yml` 변경 일절 금지 — web vitest CI 배선은 BLOCKED 상태인 T-0355 (workflow-scope credential 대기) 책임. 본 task 의 web test 는 로컬/PR-검토 단계에서 실행하되 CI step 추가는 하지 않는다.
- 새 dependency 추가 (jsdom · @testing-library · 차트 라이브러리 · 라우터 · 상태관리 · CSS 프레임워크 등) — 전부 ADR-0040 §5 new-dep 게이트. 본 task 는 react/react-dom/vitest 만.
- 기존 컴포넌트 수정 — file-disjoint 유지 (T-0361~T-0369 와 교집합 0).
- 정교한 스타일링(CSS) — 의미 구조(검색 `<input>` · 정렬 선택 · 방향 토글 버튼 · 초기화 버튼 · `role="status"` 진행 표시 · `role="alert"` 에러)만. 시각 디자인은 후속 styling slice.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0040 이 stack·구조·props presentational 정책을 이미 결정 완료. 본 task 는 그 위 대시보드 필터/정렬 툴바 컴포넌트 1개 구현)

## Follow-ups

(생성 시 비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
