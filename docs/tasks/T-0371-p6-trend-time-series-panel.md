---
id: T-0371
title: P6 frontend UI slice 11 — 시계열 추이 패널 presentational 컴포넌트 (web/src/components/TrendTimeSeriesPanel.tsx)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-046, REQ-092]
estimatedDiff: 180
estimatedFiles: 2
created: 2026-06-13
plannerNote: P6 bullet2(시각화 대시보드 정렬·필터·시계열) 잔여 '시계열' fragment — 차트 lib 없이 props 기반 추이 요약 테이블 presentational, T-0361~T-0370 file-disjoint·새 dep 0·ci.yml 무관.
independentStream: p6-frontend-ui
dependsOn: []
touchesFiles:
  - web/src/components/TrendTimeSeriesPanel.tsx
  - web/src/components/TrendTimeSeriesPanel.test.tsx
---

# T-0371 — P6 frontend UI slice 11: 시계열 추이 패널 presentational 컴포넌트

## Why

PLAN [Phase P6](../PLAN.md) bullet2 "시각화 대시보드 (정렬·필터·시계열)" 의 **잔여 '시계열' fragment** 를 컴포넌트로 분해한다. bullet2 의 세 갈래 중 정렬·필터 컨트롤은 직전 slice `DashboardFilterBar`(T-0370)가 props 기반으로 박제했고, 결과 표는 `EvaluationResultTable`(T-0363)이 박제했으나 **시계열(시간 경과에 따른 점수/지표 추이)** 표시 표면은 아직 없다. 본 task 는 그 **시계열 추이 패널 presentational 컴포넌트**를 박제한다. 직전 P6 slice (T-0361~T-0370) 와 동일하게 props 로만 시계열 데이터 포인트·기간 라벨·loading/error 를 받는 순수 controlled component 로 시작하며, **차트 라이브러리를 도입하지 않고** 각 데이터 포인트를 시간순 요약 테이블(시점·값·증감)로 렌더한다. 실제 결과 fetch(GET /api/*)·시계열 집계 로직·SVG/Canvas 차트 렌더·기간 선택·KST 경계 계산·전역 상태·라우팅·App.tsx 배선은 후속 slice 책임이다. (조회·시각화 R-046 의 추이 표시 UI 표면을 props 기반으로 미리 박제하고, R-092 의 "조회·시각화 3초 이내" 가 향후 구동할 표시 컴포넌트의 정적 표면만 확보한다 — 데이터 배선·성능 검증은 후속.)

## Required Reading

- `web/src/components/EvaluationResultTable.tsx` — 점수/지표 컬럼 키 convention(`EvaluationResultRow`)·`sortDirection`('asc'|'desc') 표현·`role`/`aria-*` 사용·named(`export type`)/default export convention 의 직전 선례. 본 추이 패널의 데이터 포인트 값 모양·라벨·접근성 표식을 이와 정합시킨다. 직접 import 하지 않고(file-disjoint 유지) 모양만 정합.
- `web/src/components/DashboardFilterBar.tsx` — loading 우선 정책(`loading===true` 우선) + `role="status"` 진행 표시 / `role="alert"` 에러 + 빈 배열/미전달 시 미렌더(또는 비활성) 분기 + 라벨 fallback + named/default export convention 의 직전 선례(T-0370). 본 task 의 loading/error/빈-데이터 분기 구조는 이 패턴을 그대로 차용한다.
- `web/src/components/DataImportExportPanel.test.tsx` — `react-dom/server` 의 `renderToStaticMarkup(<...>)` 으로 **jsdom 없이** 정적 markup 문자열만 검증하는 vitest 패턴 (dep 표면 최소화). 파일명 `.test.tsx` 고정 (root jest `testRegex .*\.spec\.ts$` pickup 충돌 회피).
- `docs/decisions/ADR-0040-frontend-stack.md` — §1 (React + Vite + TS), §2 (컴포넌트 구조·props 기반 presentational 정책·접근성 role 사용), §5 (dep 게이트: react / react-dom / vitest 만 — 그 외 import 금지, **차트 라이브러리 포함 금지**).
- `web/tsconfig.json` — `jsx: react-jsx`, `strict: true`, `noUnusedLocals/Parameters` (lint-tight 컴파일).
- `web/package.json` — 사용 가능한 dep (react / react-dom / vitest 만).

## Acceptance Criteria

- [ ] `web/src/components/TrendTimeSeriesPanel.tsx` 신설. props 만 받는 순수 presentational controlled 컴포넌트. 최소 인터페이스 (구현이 동등 의미로 조정 가능):
  - 데이터 포인트 타입: `interface TrendPoint { label: string; value: number }` (named export — `label` 은 시점 표식 예: "6/01", value 는 그 시점 점수/지표 값).
  - props: `{ title?: string; points?: TrendPoint[]; valueLabel?: string; valueFormatter?: (value: number) => string; loading?: boolean; error?: string; emptyMessage?: string }`.
  - **분기 동작 (R-112 cover 대상)**:
    - `loading === true` 면 `role="status"` 영역에 진행 표시 ("불러오는 중…" 등) 를 렌더하고, 추이 테이블·증감 표식은 미렌더한다 (loading 우선 정책 — error·points 보다 우선).
    - `loading` 이 아니고 `error` 가 truthy 면 `role="alert"` 영역에 error 문구를 렌더하고 추이 테이블은 미렌더한다. (빈 문자열 `error` 는 falsy → alert 미렌더 — 경계값.)
    - `loading`·`error` 가 아니고 `points` 가 비었거나 미전달이면 `emptyMessage`(미전달 시 기본 한국어 예: "표시할 추이 데이터가 없습니다") 를 렌더하고 추이 테이블은 미렌더한다.
    - `loading`·`error` 가 아니고 `points` 가 1개 이상이면 시간순 요약 테이블(또는 list)을 렌더한다. 각 행에 시점 `label`·값(`valueFormatter` 전달 시 그 결과, 미전달 시 숫자 그대로 또는 `toString`)·**직전 포인트 대비 증감 표식**(상승/하락/유지 — 첫 포인트는 증감 미상이라 표식 생략)을 표시한다. `valueLabel`(미전달 시 기본 예: "값") 을 값 컬럼 헤더로 표시한다.
    - `title` 미전달 시 기본 한국어 라벨(예: "추이")로 fallback 한다. 빈 문자열이면 기본 라벨로 fallback (의미 없는 빈 제목 방지).
  - named export(props 타입·`TrendPoint`)와 default export(컴포넌트)를 직전 컴포넌트와 동일 convention 으로 제공한다. 새 dependency import 금지 (react 만). fetch·라우팅·외부 store·차트 라이브러리·실제 시계열 집계 로직 사용 금지 — props 표시·증감 비교(직전값 대비)만.
- [ ] `web/src/components/TrendTimeSeriesPanel.test.tsx` 신설 — colocated spec. `vitest` + `react-dom/server` 의 `renderToStaticMarkup` 으로 정적 markup 만 검증 (새 dep 0). 파일명은 `.test.tsx` 고정. (분기는 **렌더 구조** — 테이블/list 존재·행 수·시점 라벨·값(formatter 반영)·증감 표식·`role="status"`/`role="alert"`/빈 메시지 텍스트 — 로 검증한다. 직전 slice 와 동일하게 정적 markup 단언으로 분기 cover.)
- [ ] **Happy-path test 1+**: 정상 상태(loading/error 없음, `points` 2+ 전달)에서 시점 라벨·값(`valueFormatter` 적용)·증감 표식(상승/하락)·`valueLabel` 헤더·`title` 이 렌더되고 행 수가 `points` 길이와 일치함을 검증.
- [ ] **Error path test 1+**: `error` truthy 전달 시 `role="alert"` 영역에 문구가 렌더되고 추이 테이블이 미렌더됨을 검증.
- [ ] **Flow/branch test (각 분기 1+)**: loading 분기(`loading=true` → `role="status"` 진행 표시 + 테이블 미렌더), 빈-데이터 분기(`points` 빈/미전달 → `emptyMessage` 렌더), 정상 렌더 분기, 증감 표식 분기(상승 vs 하락 — 직전값 대비 표식 차이), 첫 포인트 증감 미상(표식 생략) 분기 각각 1+ test.
- [ ] **Negative cases 충분 cover (각 1+)**: `loading=true` 가 error·points 보다 우선 1+; `error` 와 정상 `points` 동시 전달 시 error 우선(테이블 미렌더) 1+; `points` 빈 배열/미전달 시 `emptyMessage` 렌더(테이블 미렌더) 1+; `emptyMessage` 미전달 시 기본 메시지 fallback 1+; `valueFormatter` 미전달 시 숫자 값 그대로 표시 1+; `title`/`valueLabel` 미전달 시 기본 라벨 fallback 1+; 빈 문자열 `title`(falsy → 기본 라벨 fallback 경계값) 1+; 빈 문자열 `error`(falsy → alert 미렌더 경계값) 1+; `points` 단일 포인트(첫 포인트 증감 미상 → 증감 표식 생략) 1+; 동일 값 연속 포인트(증감 '유지' 또는 표식 생략) 1+.
- [ ] `cd web && pnpm test` 통과 (web vitest 전부 green) — 신규 spec 포함.
- [ ] `cd web && pnpm lint && pnpm build` 통과 (`strict` + `noUnusedLocals/Parameters` 위반 0).
- [ ] 기존 backend 불변: root 에서 `pnpm lint && pnpm build && pnpm test` + `pnpm test:cov` 그대로 green (line ≥ 80% / function ≥ 80% — backend jest 에만 적용, web 은 vitest 별도). 본 task 는 `web/` 만 건드리므로 backend 영향 0.
- [ ] R-110: production code(컴포넌트) 변경이 있으므로 tester 가 위 명령을 실행·green 확인.
- [ ] R-114: push 후 PR CI 전 step green 확인 — approval-gate ordering fail 은 STATE.json `ci.benignRedNote` case A 절차(reviewer approve comment post 후 `gh run rerun <id> --failed`)로 처리.
- [ ] 본 컴포넌트는 분기(loading/error/빈-데이터/정상/증감 표식)가 있으므로 각 분기 1+ test 로 coverage line ≥ 80% / function ≥ 80% 충족(web vitest 기준).

## Out of Scope

- 실제 결과 fetch(GET /api/*) · 시계열 집계 로직(기간별 그룹·평균·이동평균) · SVG/Canvas/차트 라이브러리 렌더 · 기간 선택기 · 줌/팬 · 툴팁 · 범례 · KST 경계 계산(timezone) — 후속 slice 책임. 본 task 는 props 로 받은 포인트를 시간순 요약 테이블로 표시하고 직전값 대비 증감만 비교.
- R-092 "조회·시각화 3초 이내" 의 실제 성능 검증 · 데이터 로딩 최적화 — 후속 데이터 배선·성능 task 책임. 본 task 는 표시 표면만.
- `EvaluationResultTable`/`DashboardFilterBar` 와의 실제 결합(필터/정렬이 추이를 구동) · 컨테이너 컴포넌트 · 상태 lift-up — 후속 wiring slice 책임. 본 task 는 file-disjoint 유지 (기존 컴포넌트 import·수정 0).
- `App.tsx` 에 컴포넌트 wiring · 대시보드 컨테이너 · 라우팅 — 후속 slice 책임 (T-0361~T-0370 와 동일 정책).
- `.github/workflows/ci.yml` 변경 일절 금지 — web vitest CI 배선은 BLOCKED 상태인 T-0355 (workflow-scope credential 대기) 책임. 본 task 의 web test 는 로컬/PR-검토 단계에서 실행하되 CI step 추가는 하지 않는다.
- 새 dependency 추가 (jsdom · @testing-library · 차트 라이브러리(recharts/chart.js/d3 등) · 라우터 · 상태관리 · CSS 프레임워크 등) — 전부 ADR-0040 §5 new-dep 게이트. 본 task 는 react/react-dom/vitest 만.
- 기존 컴포넌트 수정 — file-disjoint 유지 (T-0361~T-0370 와 교집합 0).
- 정교한 스타일링(CSS) · 실제 그래프 시각화(막대/꺾은선) — 의미 구조(시점·값·증감 표식 테이블 · `role="status"` 진행 표시 · `role="alert"` 에러 · 빈 메시지)만. 시각 차트는 후속 차트 slice.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0040 이 stack·구조·props presentational 정책을 이미 결정 완료. 본 task 는 그 위 시계열 추이 패널 컴포넌트 1개 구현)

## Follow-ups

(생성 시 비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
