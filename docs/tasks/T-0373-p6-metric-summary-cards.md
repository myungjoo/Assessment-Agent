---
id: T-0373
title: P6 frontend UI slice 13 — 대시보드 요약 지표 카드 행 presentational 컴포넌트 (web/src/components/MetricSummaryCards.tsx)
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-038, REQ-036]
estimatedDiff: 180
estimatedFiles: 2
created: 2026-06-13
plannerNote: P6 bullet2(시각화 대시보드) 잔여 fragment — 상단 요약 지표(KPI) 카드 행 props 기반 presentational, T-0361~T-0372 file-disjoint·새 dep 0·ci.yml 무관.
independentStream: p6-frontend-ui
dependsOn: []
touchesFiles:
  - web/src/components/MetricSummaryCards.tsx
  - web/src/components/MetricSummaryCards.test.tsx
---

# T-0373 — P6 frontend UI slice 13: 대시보드 요약 지표 카드 행 presentational 컴포넌트

## Why

PLAN [Phase P6](../PLAN.md) bullet2 "시각화 대시보드 (정렬·필터·시계열)" 의 잔여 표시 표면 중 **대시보드 상단 요약 지표(KPI) 카드 행** fragment 를 컴포넌트로 분해한다. bullet2 의 정렬·필터 컨트롤은 `DashboardFilterBar`(T-0370)가, 결과 표는 `EvaluationResultTable`(T-0363)가, 시계열 추이는 `TrendTimeSeriesPanel`(T-0371)가, 페이지네이션은 `DashboardPaginationControl`(T-0372)가 props 기반으로 박제했으나, **대시보드 최상단에 노출하는 집계 요약 지표**(예: 평가 인원 수·평균 점수·최고/최저·전기 대비 변화 표식)는 아직 없다. 본 task 는 그 **요약 지표 카드 행 presentational 컴포넌트**를 박제한다. 직전 P6 slice (T-0361~T-0372) 와 동일하게 props 로만 지표 항목 배열·loading/error 를 받는 순수 controlled component 로 시작하며, **내부 상태/데이터 fetch 없이** 카드 목록을 표시만 한다. 실제 집계 fetch(GET /api/*)·서버 aggregation·전역 상태·라우팅·App.tsx 배선은 후속 slice 책임이다. (REQ-038 의 UI 조회·시각화 표면 중 상단 요약 표시를 props 기반으로 미리 박제하고, REQ-036 의 "상대 비교 가능 + Metric 수치" 의 정적 표시 표면 — 수치 지표 카드 + 전기 대비 변화 표식 — 만 확보한다. 실 데이터 배선·집계 계산·성능 검증은 후속.)

## Required Reading

- `web/src/components/DashboardPaginationControl.tsx` — loading 우선 정책(`loading===true` 우선) + `role="status"` 진행 표시 / `role="alert"` 에러 + 빈/미전달 fallback 분기 + 라벨 fallback + named(`export type`/`interface`)/default export convention 의 직전 선례(T-0372). 본 task 의 loading/error 분기·빈 목록 fallback·라벨 fallback 구조는 이 패턴을 그대로 차용한다. 직접 import 하지 않고(file-disjoint 유지) 모양만 정합.
- `web/src/components/EvaluationResultTable.tsx` — 결과 데이터 행 convention(`EvaluationResultRow` 류 named 타입)·`role`/`aria-*` 사용·named/default export convention 의 직전 선례. 본 요약 카드의 지표 항목 타입·표식 모양을 이와 정합시킨다. 직접 import 하지 않고 모양만 정합.
- `web/src/components/DataImportExportPanel.test.tsx` — `react-dom/server` 의 `renderToStaticMarkup(<...>)` 으로 **jsdom 없이** 정적 markup 문자열만 검증하는 vitest 패턴 (dep 표면 최소화). 파일명 `.test.tsx` 고정 (root jest `testRegex .*\.spec\.ts$` pickup 충돌 회피).
- `docs/decisions/ADR-0040-frontend-stack.md` — §1 (React + Vite + TS), §2 (컴포넌트 구조·props 기반 presentational 정책·접근성 role 사용), §5 (dep 게이트: react / react-dom / vitest 만 — 그 외 import 금지, 차트·상태관리·라우터 라이브러리 포함 금지).
- `web/tsconfig.json` — `jsx: react-jsx`, `strict: true`, `noUnusedLocals/Parameters` (lint-tight 컴파일).
- `web/package.json` — 사용 가능한 dep (react / react-dom / vitest 만).

## Acceptance Criteria

- [ ] `web/src/components/MetricSummaryCards.tsx` 신설. props 만 받는 순수 presentational 컴포넌트. 최소 인터페이스 (구현이 동등 의미로 조정 가능):
  - 지표 항목 타입(named export): `interface MetricSummaryItem { id: string; label: string; value: string | number; unit?: string; delta?: number; deltaLabel?: string }`.
  - props 타입(named export): `interface MetricSummaryCardsProps { metrics: MetricSummaryItem[]; loading?: boolean; error?: string; emptyLabel?: string; titlePrefix?: string }`.
  - **분기 동작 (R-112 cover 대상)**:
    - `loading === true` 면 `role="status"` 영역에 진행 표시 ("불러오는 중…" 등) 를 렌더하고, 카드 목록은 미렌더한다 (loading 우선 정책 — error 보다 우선).
    - `loading` 이 아니고 `error` 가 truthy 면 `role="alert"` 영역에 error 문구를 렌더하고 카드 목록은 미렌더한다. (빈 문자열 `error` 는 falsy → alert 미렌더 — 경계값.)
    - `loading`·`error` 가 아니고 `metrics` 가 빈 배열(또는 미전달/undefined)이면 `emptyLabel`(미전달 시 기본 한국어 라벨, 예: "표시할 지표가 없습니다")로 빈 상태를 렌더한다.
    - `loading`·`error` 가 아니고 `metrics` 가 1개 이상이면 각 지표를 카드로 렌더한다: `label`·`value`(+`unit` 있으면 병기)·`delta` 가 있으면 전기 대비 변화 표식(부호·`deltaLabel`)을 표시. `delta > 0` / `delta < 0` / `delta === 0` 세 분기를 시각/문자 표식(예: "▲"/"▼"/"–" 또는 양/음/보합 텍스트)으로 구분한다.
    - `titlePrefix` 미전달 시 기본 한국어 라벨(예: "요약 지표")로 fallback 한다. 빈 문자열이면 기본 라벨로 fallback (의미 없는 빈 라벨 방지).
  - **안전 렌더**: `value` 가 `number` 일 때 `NaN`/`Infinity` 등 비정상 값이 들어와도 안전 표식(예: "–")로 치환해 raw NaN/Infinity 렌더를 방지한다. `label` 빈 문자열 등 비정상 항목도 throw 없이 안전 표시.
  - 내부 상태(`useState`)·데이터 fetch·집계 계산(평균/합 등)·라우팅·외부 store 사용 금지 — props 표시·표식 파생만(props 로 받은 `delta` 의 부호 판정 같은 순수 표시 파생은 허용).
  - named export(지표 항목 타입·props 타입)와 default export(컴포넌트)를 직전 컴포넌트와 동일 convention 으로 제공한다. 새 dependency import 금지 (react 만).
- [ ] `web/src/components/MetricSummaryCards.test.tsx` 신설 — colocated spec. `vitest` + `react-dom/server` 의 `renderToStaticMarkup` 으로 정적 markup 만 검증 (새 dep 0). 파일명은 `.test.tsx` 고정. (분기는 **렌더 구조** — 카드 개수·`label`/`value`/`unit` 텍스트·`delta` 부호 표식·`role="status"`/`role="alert"`/빈 상태 라벨/title fallback — 로 검증한다.)
- [ ] **Happy-path test 1+**: 정상 상태(loading/error 없음, 2개 이상 `metrics` 전달)에서 각 지표의 `label`·`value`(+`unit`)·title prefix 가 렌더되고 카드 개수가 입력 항목 수와 일치함을 검증.
- [ ] **Error path test 1+**: `error` truthy 전달 시 `role="alert"` 영역에 문구가 렌더되고 카드 목록이 미렌더됨을 검증.
- [ ] **Flow/branch test (각 분기 1+)**: loading 분기(`loading=true` → `role="status"` 진행 표시 + 카드 미렌더), 빈 상태 분기(`metrics=[]` → `emptyLabel` 렌더), 정상 카드 렌더 분기, `delta > 0`(증가 표식)·`delta < 0`(감소 표식)·`delta === 0`(보합 표식) 각각 1+ test.
- [ ] **Negative cases 충분 cover (각 1+)**: `loading=true` 가 error 보다 우선 1+; `error` 와 정상 `metrics` 동시 전달 시 error 우선(카드 미렌더) 1+; `metrics=[]` 빈 배열(빈 상태 라벨) 1+; `metrics` 미전달(undefined → 빈 상태) 1+; `emptyLabel` 미전달 시 기본 라벨 fallback 1+; `titlePrefix` 미전달 시 기본 라벨 fallback 1+; 빈 문자열 `titlePrefix`(falsy → 기본 라벨 fallback 경계값) 1+; 빈 문자열 `error`(falsy → alert 미렌더 경계값) 1+; `value` 가 `NaN`/`Infinity` 등 비정상 number 일 때 안전 표식 치환(raw NaN/Infinity 미렌더) 1+; `delta` 미전달(undefined → 변화 표식 미렌더) 1+; `unit` 미전달(value 단독 렌더) 1+.
- [ ] `cd web && pnpm test` 통과 (web vitest 전부 green) — 신규 spec 포함.
- [ ] `cd web && pnpm lint && pnpm build` 통과 (`strict` + `noUnusedLocals/Parameters` 위반 0).
- [ ] 기존 backend 불변: root 에서 `pnpm lint && pnpm build && pnpm test` + `pnpm test:cov` 그대로 green (line ≥ 80% / function ≥ 80% — backend jest 에만 적용, web 은 vitest 별도). 본 task 는 `web/` 만 건드리므로 backend 영향 0.
- [ ] R-110: production code(컴포넌트) 변경이 있으므로 tester 가 위 명령을 실행·green 확인.
- [ ] R-114: push 후 PR CI 전 step green 확인 — approval-gate ordering fail 은 STATE.json `ci.benignRedNote` case A 절차(reviewer approve comment post 후 `gh run rerun <id> --failed`)로 처리.
- [ ] 본 컴포넌트는 분기(loading/error/빈 목록/delta 부호 3분기/비정상 value)가 있으므로 각 분기 1+ test 로 coverage line ≥ 80% / function ≥ 80% 충족(web vitest 기준).

## Out of Scope

- 실제 집계 fetch(GET /api/*) · 서버 aggregation(평균/합/비교 계산) · 전기 대비 delta 계산 — 후속 slice 책임. 본 task 는 props 로 받은 지표·delta 를 표시만 하고 부호 판정 같은 순수 표시 파생만 수행.
- 내부 상태(`useState`)로 지표 보유 · 데이터 로딩 로직 — 본 task 는 controlled(부모가 데이터 소유). 컨테이너 변형은 후속 wiring slice 책임.
- 차트/스파크라인 시각화(막대·선) · 차트 라이브러리 도입 — 본 task 는 수치 카드 + 텍스트/기호 변화 표식만. 막대형 분포 시각화는 별도 후속 slice (chart lib 없이 div 막대) 후보.
- REQ-048 "조회·시각화 3초 이내" 의 실제 성능 검증 · 데이터 로딩 최적화 — 후속 데이터 배선·성능 task 책임. 본 task 는 표시 표면만.
- `EvaluationResultTable`/`DashboardFilterBar`/`TrendTimeSeriesPanel`/`DashboardPaginationControl` 와의 실제 결합 · 대시보드 컨테이너 · 상태 lift-up — 후속 wiring slice 책임. 본 task 는 file-disjoint 유지 (기존 컴포넌트 import·수정 0).
- `App.tsx` 에 컴포넌트 wiring · 대시보드 컨테이너 · 라우팅 — 후속 slice 책임 (T-0361~T-0372 와 동일 정책).
- `.github/workflows/ci.yml` 변경 일절 금지 — web vitest CI 배선은 BLOCKED 상태인 T-0355 (workflow-scope credential 대기) 책임. 본 task 의 web test 는 로컬/PR-검토 단계에서 실행하되 CI step 추가는 하지 않는다.
- 새 dependency 추가 (jsdom · @testing-library · 차트 lib · 상태관리 · 라우터 · CSS 프레임워크 등) — 전부 ADR-0040 §5 new-dep 게이트. 본 task 는 react/react-dom/vitest 만.
- 기존 컴포넌트 수정 — file-disjoint 유지 (T-0361~T-0372 와 교집합 0).
- 정교한 스타일링(CSS) · 반응형 그리드 레이아웃 세부 · 지표 drill-down 인터랙션 — 의미 구조(카드 목록 · label/value/unit · delta 부호 표식 · 빈 상태 · `role="status"`/`role="alert"`)만. 정교한 레이아웃/인터랙션은 후속 slice.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0040 이 stack·구조·props presentational 정책을 이미 결정 완료. 본 task 는 그 위 요약 지표 카드 컴포넌트 1개 구현)

## Follow-ups

(생성 시 비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append)

---

## 완료 기록

- **Status: DONE** (2026-06-13T12:14Z, cron@aa-local-15)
- PR [#305](https://github.com/myungjoo/Assessment-Agent/pull/305) → squash merge `10f55c3` (`--delete-branch`).
- reviewer APPROVE round 1/7 (findings 0), integrator 4-게이트 PASS, CI first-pass green.
- MetricSummaryCards.tsx(+146) + MetricSummaryCards.test.tsx(+231, 26 spec) — web vitest 214 pass, tsc strict+build green. 새 dep 0, backend 불변.
- R-114: squash 10f55c3 main push run 은 다음 fire 재확인(web-only/squash trivially green 예상).
