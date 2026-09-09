---
id: T-1995
title: 시각화 컴포넌트 렌더 latency 측정 — REQ-047 규모 표본 3 종 (분포 · 시계열 · 결과 표)
phase: P7
status: DONE
commitMode: pr
coversReq: [REQ-048, REQ-047]
estimatedDiff: 210
estimatedFiles: 1
estimatedLoc: 210
independentStream: web-render-latency-axis
dependsOn: [T-1993]
touchesFiles: [web/src/perf/visualizationRender.perf.test.tsx]
created: 2026-09-09
plannerNote: P7 · PLAN 154 행 ④ — App 셸만 재는 현 측정을 시각화 3 컴포넌트 × REQ-047 규모 표본으로 확장
---

# T-1995 — 시각화 컴포넌트 렌더 latency 측정 (REQ-047 규모 표본 3 종)

## Why

[docs/PLAN.md](../PLAN.md) `154 행` 잔여 4 축 ④ 는 [T-1994](T-1994-req048-web-render-axis-doc-sync.md) 이후 "**첫 측정 경로 개시(SSR markup 한정) · 축 완결 미도달**" 로 판정돼 있다. 현재 측정 대상은 [web/src/App.tsx](../../web/src/App.tsx) 뿐인데 그 본문은 `return <AppShell />` **한 줄** (파일 전체 `10 행`) 이라, README `92 행` 이 요구하는 "로딩 및 **시각화**에 3초 이내" 의 정작 시각화 표면 — 분포 차트 · 시계열 패널 · 평가 결과 표 — 은 한 번도 측정되지 않았다. 본 slice 는 그 3 표면을 [docs/requirements.md](../requirements.md) `66 행` REQ-047 의 규모(100~200명) 를 반영한 표본으로 재서 축을 데이터-규모 축으로 확장한다.

**issue-still-relevant pre-check (origin/main `8cca7d49` 실측)** —

- `git ls-tree origin/main web/src/perf/` = **3 blob** (`renderLatency.ts` · `renderLatency.test.ts` · `appRender.perf.test.tsx`) — 시각화 컴포넌트 측정 파일 **부재**.
- `git grep -c -E "measureRenderLatency|performance\.now" origin/main -- 'web/src/components/**' 'web/src/views/**'` 히트 **0 건** — 31 개 컴포넌트 spec · 60+ view spec 중 렌더 소요를 재는 것이 하나도 없다.
- `git grep -c "REQ048_RENDER_MAX_MS" origin/main -- 'web/src/**'` 은 `web/src/perf/` 3 파일 안(2 · 3 · 2 히트)에서만 잡히고 그 밖은 **0** — 임계 판정 소비처가 perf 디렉토리 밖으로 나간 적 없음.
- 기존 표시 spec 의 표본 규모: `ScoreDistributionChart.test.tsx` 의 `label:` **10 건**, `TrendTimeSeriesPanel.test.tsx` 의 `label:` **6 건** — 전부 동작 검증용 소표본이라 REQ-047 규모(100~200명) 표본이 **0 건**.

→ 미해소 확인. 본 slice 는 새 helper 를 만들지 않고 T-1993 이 이미 머지한 `measureRenderLatency` / `assertRenderThreshold` 의 **두 번째 소비처**만 추가하므로 §3 소비처 동반 의무에 저촉하지 않는다. 오너 지시 `158 행` 의 "신규 per-route perf baseline slice 큐잉 금지" 는 backend `test/perf/*.perf-spec.ts` 의 R-92 read-latency 축 상한이며, 본 slice 는 그 축이 아니라 web 시각화 축 ④ 라 무저촉이다(T-1993 과 동일 근거). 새 dependency 0 — 기존 `vitest` + `react-dom/server` 만 쓴다.

## Required Reading

- [docs/PLAN.md](../PLAN.md) `154 행` (잔여 4 축 ④ 의 현행 판정 문장) · `158 행` (오너 상한의 적용 범위)
- [docs/requirements.md](../requirements.md) `66 행` REQ-047 — 규모 표본의 근거 수치(100~200명 / 50~100 repo)
- [web/src/perf/renderLatency.ts](../../web/src/perf/renderLatency.ts) `17 행` `REQ048_RENDER_MAX_MS` · `62~90 행` `measureRenderLatency(render, iterations, opts)` (thunk 예외 전파 · iterations 1 이상 정수) · `100~132 행` `assertRenderThreshold` (표본 0 은 pass=false, 초과 시 reason 문자열)
- [web/src/perf/appRender.perf.test.tsx](../../web/src/perf/appRender.perf.test.tsx) `1~34 행` — 소비처 작성 관행(파일명 `.perf.test.tsx` 로 root jest testRegex 회피, 빈 markup 배제 단언, 측정 한계 주석)
- [web/src/components/ScoreDistributionChart.tsx](../../web/src/components/ScoreDistributionChart.tsx) `23~46 행` — `ScoreDistributionBucket { id, label, count }` · props(`buckets` · `loading` · `error` · `emptyLabel` · `titlePrefix`) 와 loading 우선 분기
- [web/src/components/TrendTimeSeriesPanel.tsx](../../web/src/components/TrendTimeSeriesPanel.tsx) `27~52 행` — `TrendPoint { label, value }` · props(`points` · `valueFormatter` · `loading` · `error` · `emptyMessage`)
- [web/src/components/AssessmentResultTable.tsx](../../web/src/components/AssessmentResultTable.tsx) `60~73 행` — props(`rows` 필수 · `sortKey` · `sortDirection` · `loading` · `emptyMessage`)
- [web/src/api/assessmentRow.ts](../../web/src/api/assessmentRow.ts) `14~28 행` — `AssessmentDisplayRow` 9 키(`contributionScore` · `volume` 은 `number | null`)
- [scripts/check-spec-presence.sh](../../scripts/check-spec-presence.sh) `44~58 행` — 신규 `web/src/**` 파일의 colocated spec 규칙(본 파일은 자체가 test 라 T-1993 선례대로 통과)

## Acceptance Criteria

- [ ] 신규 파일 [web/src/perf/visualizationRender.perf.test.tsx](../../web/src/perf/visualizationRender.perf.test.tsx) **1 개만** 추가하고, 상단 주석에 측정 한계(React SSR markup 생성 시간만 재며 브라우저 layout · paint · 네트워크 · 데이터 로딩 미포함) 를 T-1993 과 같은 취지로 명시한다.
- [ ] **happy-path (R-112 ①)** — `ScoreDistributionChart`(bucket **20 개**) · `TrendTimeSeriesPanel`(point **200 개**) · `AssessmentResultTable`(row **200 개**, REQ-047 인원 상한 반영) 각각에 대해 `measureRenderLatency` 로 반복 측정 후 `assertRenderThreshold` 의 `pass === true` · `reason === ''` 를 단언하는 it 이 **컴포넌트마다 1+**. 표본 수(`summary.samples`) 도 함께 단언한다.
- [ ] **negative (R-112 ④)** — 컴포넌트마다 비정상 props 표본 측정 it 1+: 분포는 `count` 에 음수 · `NaN` · `Infinity` 포함, 시계열은 `value` 에 `NaN` · 음수 포함, 표는 `contributionScore` / `volume` 이 `null` 인 행 포함. 각 경우 측정이 throw 없이 끝나고 markup 이 비어 있지 않으며 임계 판정이 `pass === true` 임을 단언한다.
- [ ] **negative — 빈 렌더 위장 배제 (R-112 ④)** — 각 happy-path 측정에서 마지막 markup 이 `''` 가 아님과 **표본 규모가 실제로 렌더됐음**(예: 표는 200 행 표식 개수, 시계열은 200 포인트 표식 개수를 markup 에서 세어 단언) 을 검증해 "0ms 로 통과하는 빈 렌더" 를 배제한다.
- [ ] **분기 (R-112 ③)** — 세 컴포넌트의 loading 우선 분기와 빈 데이터 분기를 각각 측정하는 it 1+: `loading: true` 경로(데이터 미렌더) 와 빈 배열 경로(`emptyLabel` / `emptyMessage` fallback) 에서도 측정이 성립하고 임계 판정이 `pass === true` 임을 단언한다.
- [ ] **error path (R-112 ②)** — 렌더 thunk 가 throw 하는 경우 `measureRenderLatency` 가 예외를 삼키지 않고 전파함을 시각화 소비처 맥락에서 단언하는 it 1+ (예: 필수 prop 을 의도적으로 깨뜨린 thunk 또는 명시적 throw thunk).
- [ ] `cd web && pnpm test` 전량 green — 기존 web test 파일 **142 개** 가 143 개가 되고 회귀 0.
- [ ] `cd web && pnpm build` (`tsc --noEmit` + `vite build`) 통과 — 새 파일의 타입 오류 0.
- [ ] repo root `pnpm lint && pnpm build && pnpm test` 통과 (backend 무영향) 이며 `pnpm test:cov` 가 line ≥ 80% · function ≥ 80% 게이트를 유지한다.
- [ ] `git diff --stat` 상 변경 파일이 신규 1 개뿐이고 `src/` · `test/` · `docs/` diff **0**.

## Out of Scope

- `web/src/perf/renderLatency.ts` 수정 — helper 계약은 T-1993 대로 고정, 본 slice 는 소비처만 추가한다.
- `DashboardView` · `AdminView` 등 컨테이너 렌더 측정 — fetch · hook 경로가 얽혀 별도 slice.
- jsdom · `@testing-library` · k6 등 신규 dependency 도입 (도입 필요 시 ADR + 오너 승인 경로).
- `test/perf/baselines/` 류 체크인 baseline 파일 생성 · 상대 회귀 임계 도입 (ADR-0056 축, 본 slice 밖).
- [docs/PLAN.md](../PLAN.md) `154 행` · [docs/requirements.md](../requirements.md) REQ-047 / REQ-048 재판정 — 머지 후 별도 direct doc-sync slice (§3.1 once-rule).
- backend `test/perf/*.perf-spec.ts` 추가 · 수정 (오너 `158 행` 상한).
- 측정 대상 컴포넌트 3 종의 production 코드 수정.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음)
