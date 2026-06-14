---
id: T-0374
title: P6 frontend UI slice 14 — 점수 분포 막대 차트 presentational 컴포넌트 (web/src/components/ScoreDistributionChart.tsx)
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-038, REQ-036]
estimatedDiff: 190
estimatedFiles: 2
created: 2026-06-13
plannerNote: P6 bullet2(시각화 대시보드) 잔여 fragment — 점수 분포 막대 차트(chart lib 없이 div 막대) props 기반 presentational, T-0361~T-0373 file-disjoint·새 dep 0·ci.yml 무관·dependsOn 빈배열 병렬 claimable.
independentStream: p6-frontend-ui
dependsOn: []
touchesFiles:
  - web/src/components/ScoreDistributionChart.tsx
  - web/src/components/ScoreDistributionChart.test.tsx
---

# T-0374 — P6 frontend UI slice 14: 점수 분포 막대 차트 presentational 컴포넌트

## Why

PLAN [Phase P6](../PLAN.md) bullet2 "시각화 대시보드 (정렬·필터·시계열)" 의 잔여 표시 표면 중 **점수 분포 막대 차트**(score distribution histogram) fragment 를 컴포넌트로 분해한다. bullet2 의 필터/정렬은 `DashboardFilterBar`(T-0370), 결과 표는 `EvaluationResultTable`(T-0363), 시계열 추이는 `TrendTimeSeriesPanel`(T-0371), 페이지네이션은 `DashboardPaginationControl`(T-0372), 상단 요약 카드는 `MetricSummaryCards`(T-0373)가 props 기반으로 박제했으나, **점수대별 인원 분포를 막대로 보여주는 분포 시각화**는 아직 없다. 이 fragment 는 T-0373 의 Out of Scope 에서 "막대형 분포 시각화는 별도 후속 slice (chart lib 없이 div 막대) 후보" 로 명시 박제된 잔여 작업이다. 본 task 는 그 **점수 분포 막대 차트 presentational 컴포넌트**를 박제한다. 직전 P6 slice 와 동일하게 props 로만 분포 bucket 배열·loading/error 를 받는 순수 controlled component 로 시작하며, **내부 상태/데이터 fetch/집계 없이** 막대를 표시만 한다. 막대 높이/너비는 CSS percent (`max` 대비 비율) 로만 계산하는 순수 표시 파생이며 차트 라이브러리는 도입하지 않는다 (div 막대 + role 접근성). 실제 분포 집계 fetch(GET /api/*)·서버 aggregation·전역 상태·라우팅·App.tsx 배선은 후속 slice 책임이다. (REQ-038 의 UI 조회·시각화 표면 중 분포 시각화를 props 기반으로 미리 박제하고, REQ-036 의 "상대 비교 가능 + Metric 수치" 의 정적 분포 표시 표면만 확보한다. 실 데이터 배선·집계 계산·성능 검증은 후속.)

## Required Reading

- `web/src/components/MetricSummaryCards.tsx` — loading 우선 정책(`loading===true` 우선) + `role="status"` 진행 표시 / `role="alert"` 에러 + 빈/미전달 fallback 분기 + 라벨 fallback + 비정상 number(NaN/Infinity) 안전 표식 치환 + named(`export interface`)/default export convention 의 직전 선례(T-0373). 본 task 의 loading/error 분기·빈 목록 fallback·라벨 fallback·비정상 값 안전 표식 구조는 이 패턴을 그대로 차용한다. 직접 import 하지 않고(file-disjoint 유지) 모양만 정합.
- `web/src/components/TrendTimeSeriesPanel.tsx` — 시계열 data point 배열을 props 로 받아 표시하는 직전 선례(T-0371). 분포 bucket(`count`/`label`) 배열 props 모양·max 대비 비율 표시 파생을 이와 정합시킨다. 직접 import 하지 않고 모양만 정합.
- `web/src/components/DataImportExportPanel.test.tsx` — `react-dom/server` 의 `renderToStaticMarkup(<...>)` 으로 **jsdom 없이** 정적 markup 문자열만 검증하는 vitest 패턴 (dep 표면 최소화). 파일명 `.test.tsx` 고정 (root jest `testRegex .*\.spec\.ts$` pickup 충돌 회피).
- `docs/decisions/ADR-0040-frontend-stack.md` — §1 (React + Vite + TS), §2 (컴포넌트 구조·props 기반 presentational 정책·접근성 role 사용), §5 (dep 게이트: react / react-dom / vitest 만 — 그 외 import 금지, **차트·시각화·상태관리·라우터 라이브러리 포함 금지** — 막대는 div + inline style 로만).
- `web/tsconfig.json` — `jsx: react-jsx`, `strict: true`, `noUnusedLocals/Parameters` (lint-tight 컴파일).
- `web/package.json` — 사용 가능한 dep (react / react-dom / vitest 만).

## Acceptance Criteria

- [ ] `web/src/components/ScoreDistributionChart.tsx` 신설. props 만 받는 순수 presentational 컴포넌트. 최소 인터페이스 (구현이 동등 의미로 조정 가능):
  - 분포 bucket 타입(named export): `interface ScoreDistributionBucket { id: string; label: string; count: number }` (예: label="0–20", count=12 처럼 점수 구간별 인원 수).
  - props 타입(named export): `interface ScoreDistributionChartProps { buckets: ScoreDistributionBucket[]; loading?: boolean; error?: string; emptyLabel?: string; titlePrefix?: string }`.
  - **분기 동작 (R-112 cover 대상)**:
    - `loading === true` 면 `role="status"` 영역에 진행 표시 ("불러오는 중…" 등) 를 렌더하고, 막대 목록은 미렌더한다 (loading 우선 정책 — error 보다 우선).
    - `loading` 이 아니고 `error` 가 truthy 면 `role="alert"` 영역에 error 문구를 렌더하고 막대 목록은 미렌더한다. (빈 문자열 `error` 는 falsy → alert 미렌더 — 경계값.)
    - `loading`·`error` 가 아니고 `buckets` 가 빈 배열(또는 미전달/undefined)이면 `emptyLabel`(미전달 시 기본 한국어 라벨, 예: "표시할 분포 데이터가 없습니다")로 빈 상태를 렌더한다.
    - `loading`·`error` 가 아니고 `buckets` 가 1개 이상이면 각 bucket 을 막대로 렌더한다: `label`·`count` 를 표시하고, 막대 높이/너비를 **bucket 중 최대 count 대비 비율(percent)** 로 inline style(`width`/`height: NN%`) 로 계산해 div 막대로 표현한다. 차트 라이브러리·SVG path·canvas 사용 금지 — div + inline style 만. 접근성을 위해 각 막대에 `role="img"` 또는 `aria-label`(예: "0–20: 12명") 부여.
    - `titlePrefix` 미전달 시 기본 한국어 라벨(예: "점수 분포")로 fallback 한다. 빈 문자열이면 기본 라벨로 fallback (의미 없는 빈 라벨 방지).
  - **안전 렌더 / 비율 계산**: 모든 `count` 가 0 이거나 max count 가 0 이면 0 나눗셈을 피하고 모든 막대를 0% (또는 안전 최소 표시) 로 렌더한다 (`NaN`/`Infinity` width 방지). `count` 가 음수·`NaN`·`Infinity` 등 비정상 값이면 안전하게 0 으로 clamp 해 raw NaN/Infinity 비율을 렌더하지 않는다. `label` 빈 문자열 등 비정상 항목도 throw 없이 안전 표시.
  - 내부 상태(`useState`)·데이터 fetch·집계 계산(점수→bucket 분류 등)·라우팅·외부 store 사용 금지 — props 표시·비율 파생만(props 로 받은 `count` 의 max 대비 비율 같은 순수 표시 파생은 허용).
  - named export(bucket 타입·props 타입)와 default export(컴포넌트)를 직전 컴포넌트와 동일 convention 으로 제공한다. 새 dependency import 금지 (react 만).
- [ ] `web/src/components/ScoreDistributionChart.test.tsx` 신설 — colocated spec. `vitest` + `react-dom/server` 의 `renderToStaticMarkup` 으로 정적 markup 만 검증 (새 dep 0). 파일명은 `.test.tsx` 고정. (분기는 **렌더 구조** — 막대 개수·`label`/`count` 텍스트·비율 width/height percent·`role="status"`/`role="alert"`/빈 상태 라벨/title fallback — 로 검증한다.)
- [ ] **Happy-path test 1+**: 정상 상태(loading/error 없음, 2개 이상 `buckets` 전달)에서 각 bucket 의 `label`·`count`·title prefix 가 렌더되고 막대 개수가 입력 bucket 수와 일치하며, max count bucket 의 막대가 100%(또는 최대 비율)로 렌더됨을 검증.
- [ ] **Error path test 1+**: `error` truthy 전달 시 `role="alert"` 영역에 문구가 렌더되고 막대 목록이 미렌더됨을 검증.
- [ ] **Flow/branch test (각 분기 1+)**: loading 분기(`loading=true` → `role="status"` 진행 표시 + 막대 미렌더), 빈 상태 분기(`buckets=[]` → `emptyLabel` 렌더), 정상 막대 렌더 분기, 비율 계산 분기(max 대비 작은 bucket 이 < 100% width 로 렌더) 각각 1+ test.
- [ ] **Negative cases 충분 cover (각 1+)**: `loading=true` 가 error 보다 우선 1+; `error` 와 정상 `buckets` 동시 전달 시 error 우선(막대 미렌더) 1+; `buckets=[]` 빈 배열(빈 상태 라벨) 1+; `buckets` 미전달(undefined → 빈 상태) 1+; `emptyLabel` 미전달 시 기본 라벨 fallback 1+; `titlePrefix` 미전달 시 기본 라벨 fallback 1+; 빈 문자열 `titlePrefix`(falsy → 기본 라벨 fallback 경계값) 1+; 빈 문자열 `error`(falsy → alert 미렌더 경계값) 1+; 모든 `count`=0(max 0 → 0 나눗셈 방지, 0% width) 1+; `count` 가 음수/`NaN`/`Infinity` 등 비정상일 때 0 clamp(raw NaN/Infinity width 미렌더) 1+; 단일 bucket(`buckets` 길이 1 → 그 막대 100%) 1+.
- [ ] `cd web && pnpm test` 통과 (web vitest 전부 green) — 신규 spec 포함.
- [ ] `cd web && pnpm lint && pnpm build` 통과 (`strict` + `noUnusedLocals/Parameters` 위반 0).
- [ ] 기존 backend 불변: root 에서 `pnpm lint && pnpm build && pnpm test` + `pnpm test:cov` 그대로 green (line ≥ 80% / function ≥ 80% — backend jest 에만 적용, web 은 vitest 별도). 본 task 는 `web/` 만 건드리므로 backend 영향 0.
- [ ] R-110: production code(컴포넌트) 변경이 있으므로 tester 가 위 명령을 실행·green 확인.
- [ ] R-114: push 후 PR CI 전 step green 확인 — approval-gate ordering fail 은 STATE.json `ci.benignRedNote` case A 절차(reviewer approve comment post 후 `gh run rerun <id> --failed`)로 처리.
- [ ] 본 컴포넌트는 분기(loading/error/빈 목록/비율 계산/0 나눗셈 방지/비정상 count clamp)가 있으므로 각 분기 1+ test 로 coverage line ≥ 80% / function ≥ 80% 충족(web vitest 기준).

## Out of Scope

- 실제 분포 집계 fetch(GET /api/*) · 서버 aggregation(점수→bucket 분류 계산) · 점수 구간 산정 로직 — 후속 slice 책임. 본 task 는 props 로 받은 bucket 배열을 표시만 하고 max 대비 비율 같은 순수 표시 파생만 수행.
- 내부 상태(`useState`)로 bucket 보유 · 데이터 로딩 로직 — 본 task 는 controlled(부모가 데이터 소유). 컨테이너 변형은 후속 wiring slice 책임.
- 차트 라이브러리 도입(recharts · chart.js · d3 등) · SVG path · canvas 렌더 — ADR-0040 §5 new-dep 게이트. 본 task 는 div + inline style percent 막대만.
- 막대 외 추가 시각화(선·원·산점도) · 인터랙티브 툴팁 · drill-down · 애니메이션 — 후속 slice 후보. 본 task 는 정적 막대 + label/count + 비율 표시만.
- REQ-048 "조회·시각화 3초 이내" 의 실제 성능 검증 · 데이터 로딩 최적화 — 후속 데이터 배선·성능 task 책임. 본 task 는 표시 표면만.
- `MetricSummaryCards`/`EvaluationResultTable`/`DashboardFilterBar`/`TrendTimeSeriesPanel`/`DashboardPaginationControl` 와의 실제 결합 · 대시보드 컨테이너 · 상태 lift-up — 후속 wiring slice 책임. 본 task 는 file-disjoint 유지 (기존 컴포넌트 import·수정 0).
- `App.tsx` 에 컴포넌트 wiring · 대시보드 컨테이너 · 라우팅 — 후속 slice 책임 (T-0361~T-0373 와 동일 정책).
- `.github/workflows/ci.yml` 변경 일절 금지 — web vitest CI 배선은 BLOCKED 상태인 T-0355 (workflow-scope credential 대기) 책임. 본 task 의 web test 는 로컬/PR-검토 단계에서 실행하되 CI step 추가는 하지 않는다.
- 새 dependency 추가 (jsdom · @testing-library · 차트 lib · 상태관리 · 라우터 · CSS 프레임워크 등) — 전부 ADR-0040 §5 new-dep 게이트. 본 task 는 react/react-dom/vitest 만.
- 기존 컴포넌트 수정 — file-disjoint 유지 (T-0361~T-0373 와 교집합 0).
- 정교한 스타일링(CSS) · 반응형 그리드 · 축 눈금/그리드 라인 세부 — 의미 구조(막대 목록 · label/count · max 대비 비율 width · 빈 상태 · `role="status"`/`role="alert"`)만. 정교한 레이아웃은 후속 slice.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0040 이 stack·구조·props presentational 정책을 이미 결정 완료. 본 task 는 그 위 점수 분포 막대 차트 컴포넌트 1개 구현)

## Follow-ups

(생성 시 비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append)

---

## 완료 기록

- **Status: DONE** (2026-06-13T12:37Z, cron@cloud-aa-local-sched)
- PR [#306](https://github.com/myungjoo/Assessment-Agent/pull/306) → squash merge `a16f5c6` (`--delete-branch`).
- reviewer APPROVE round 1/7 (MINOR×2 비차단: 총계 표시 직접 단언 권고 / web vitest CI 미배선 = T-0355 tracked gap), integrator 4-게이트 PASS, CI first-pass green.
- ScoreDistributionChart presentational 컴포넌트 + spec(web vitest 19 신규/233 전체) — 새 dep 0, backend 불변.
- frontmatter status 가 머지 시 closeout 에서 PENDING 으로 잔류 → 본 doc-sync 로 DONE 정정 (T-0402).
