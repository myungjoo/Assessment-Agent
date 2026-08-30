---
id: T-1797
title: 실 contributionScore 스케일(0–3) 배선 실측으로 REQ-076 재판정 + PLAN 131 행 ③ 축 서술 갱신
phase: P6
status: DONE
commitMode: direct
coversReq: [REQ-076]
estimatedDiff: 70
estimatedFiles: 2
created: 2026-08-30
independentStream: web-dashboard-display-contract
dependsOn: []
touchesFiles:
  - docs/requirements.md
  - docs/PLAN.md
plannerNote: "P6 오너 지시 131 행 ③ 축 — T-1728~T-1731 머지로 실 스케일 정합이 shipped 인데 REQ-076 은 PLANNED drift (doc-only)"
---

# T-1797 — 실 contributionScore 스케일(0–3) 배선 실측으로 REQ-076 재판정 + PLAN 131 행 ③ 축 서술 갱신

## Why

오너 지시 [PLAN](../PLAN.md) `131 행` (대시보드 실동작, R-175~R-178) 의 잔여 2 축 중 **③(점수 분포 축의 실 metricScore 스케일 가정 — [requirements.md](../requirements.md) `95 행` REQ-076)** 를 닫는 doc-only slice 다. 직전 두 fire 가 같은 패턴으로 ①([T-1796](T-1796-requirements-req074-person-selector-rejudge.md), REQ-074) · ②([T-1795](T-1795-requirements-req075-narrative-rejudge.md), REQ-075) 를 재판정해 닫았고, 본 slice 는 그 세 번째다.

planner 가 본 fire 에서 `origin/main` (`95c4a4c5`) 을 직접 확인한 결과 **구현은 이미 shipped 인데 문서만 뒤처진 drift** 다 — 실 스케일 순수 모듈 [assessmentScoreScale.ts](../../web/src/api/assessmentScoreScale.ts) 를 신설한 [T-1728](T-1728-contribution-score-scale-module.md) 이후 분포 축 배선 [T-1729](T-1729-dashboard-score-distribution-real-scale-wire.md) · 요약 지표 축 배선 [T-1730](T-1730-dashboard-metric-summary-real-scale-wire.md) · 임시 브리지 제거 [T-1731](T-1731-dashboard-remove-legacy-score-bridge.md) 까지 chain 전량이 main 에 있는데도 `95 행` REQ-076 은 여전히 `PLANNED` 이고 근거 열에 shipped slice 가 0 건이다. 같은 사실을 `94 행` REQ-075 판정 본문은 이미 "점수 분포 축 shipped — T-1728, T-1729, T-1730, T-1731" 로 적고 있어, 두 row 사이의 서술이 서로 어긋난 상태다.

## Required Reading

- [docs/requirements.md](../requirements.md) `95 행` — REQ-076 row (재판정 대상. `93 행` REQ-074 · `94 행` REQ-075 두 row 는 직전 재판정의 서술 형식 참고용으로만 읽는다)
- [docs/PLAN.md](../PLAN.md) `131 행` — 오너 지시 bullet 의 ③ 축 서술 두 곳 (본문 중 "③ 점수 분포 축 실 metricScore 스케일 정합" 과 말미 잔여 문장 "③(점수 분포 축의 실 metricScore 스케일 가정 — `95 행` REQ-076)")
- [web/src/api/assessmentScoreScale.ts](../../web/src/api/assessmentScoreScale.ts) — `24~25 행` `CONTRIBUTION_SCORE_MIN`·`CONTRIBUTION_SCORE_MAX`(0–3), `56 행` `CONTRIBUTION_SCORE_BUCKET_EDGES`(폭 0.5 6 등분), `120 행` `deriveContributionScoreBuckets`, `152 행` `summarizeContributionScores`, `1~9 행` 스케일 근거 주석(backend `CONTRIBUTION_SCORE_BY_LEVEL` + 평균 규칙)
- [web/src/views/DashboardView.tsx](../../web/src/views/DashboardView.tsx) — `41~42 행` import, `648~653 행` `scoreBuckets` useMemo, `858~862 행` `buckets={scoreBuckets}` 마운트, `269~299 행` `deriveMetrics`(`286 행` `summarizeContributionScores` 소비 · `295 행` `` `${summary.average} / ${summary.scoreMax}` ``)
- [web/src/api/assessmentScoreScale.test.ts](../../web/src/api/assessmentScoreScale.test.ts) — `251 행` describe "drift guard — 스케일 가정이 0–100 으로 돌아가면 fail 한다"
- [web/src/views/DashboardView.test.tsx](../../web/src/views/DashboardView.test.tsx) — `1585 행` describe "점수 분포 실 스케일 배선 (T-1729)" · `1723 행` describe "요약 지표 실 스케일 배선 (T-1730)"
- [docs/tasks/T-1796-requirements-req074-person-selector-rejudge.md](T-1796-requirements-req074-person-selector-rejudge.md) — 직전 동형 재판정 slice 의 판정 본문 작성 형식

## Acceptance Criteria

- [x] [requirements.md](../requirements.md) `95 행` REQ-076 의 status 를 `PLANNED` → `DONE` 으로 재판정하고, 판정 본문에 **집계 축 · 분포 표시 축 · 요약 카드 축 · 회귀 방지 축** 4 축의 실제 파일·행 좌표를 근거로 박는다 (직전 `93 행` · `94 행` 판정 본문과 같은 형식 — 좌표는 본 fire 에서 `origin/main` 을 직접 열어 재확인한 값으로 적는다. planner 가 위에 적은 행 번호를 그대로 베끼지 말 것).
- [x] 같은 row 의 근거 열(현재 `P6 (PLAN 131 행)` 만 있음)에 shipped slice chain `T-1728` · `T-1729` · `T-1730` · `T-1731` 을 `94 행` REQ-075 row 와 같은 표기로 추가한다.
- [x] 검증 위치 열(`unit`)이 실측과 맞는지 확인한다 — `test/e2e/` 에 점수 분포/스케일을 브라우저로 확인하는 harness 가 있는지 직접 확인하고, 없다면 `unit` 유지 근거를 판정 본문에 한 줄로 적는다 (검증 실체는 `web/src/api/assessmentScoreScale.test.ts` 와 `web/src/views/DashboardView.test.tsx` 의 T-1729·T-1730 블록).
- [x] REQ 문언의 "**점수 분포 등** 시각화" 범위를 실측으로 점검한다 — `web/src/components/` 의 다른 시각화 컴포넌트(특히 `TrendTimeSeriesPanel.tsx` · `ScoreDistributionChart.tsx`)에 0–100 만점 가정이 남아 있는지 확인하고, 남아 있으면 `DONE` 대신 `IN_PROGRESS` 로 두고 잔여를 명시한다. (planner 사전 확인: `ScoreDistributionChart.tsx` `57~62 행` 의 `100` 은 막대 **폭 백분율** 계산이라 점수 만점 가정이 아니고, `TrendTimeSeriesPanel.tsx` 는 수치 축 없는 요약 테이블 렌더라 만점 가정이 없다 — 이 판단이 맞는지 확인 후 판정 본문에 한 줄로 근거를 남긴다.)
- [x] [PLAN.md](../PLAN.md) `131 행` 의 ③ 축 서술 두 곳을 shipped 사실에 맞게 갱신한다 — 본문 열거의 "③ 점수 분포 축 실 metricScore 스케일 정합" 을 shipped 서술(근거 slice + `95 행` REQ-076 재판정 참조)로 바꾸고, 말미 잔여 문장에서 ③ 을 빼 잔여를 ④(REQ-077) 하나로 줄인다.
- [x] `git diff --stat` 결과가 `docs/requirements.md` · `docs/PLAN.md` **2 파일** 뿐이고 코드 변경 0 이다.
- [x] `python -c "import json,io; json.load(io.open('docs/STATE.json',encoding='utf-8'))"` 로 STATE 무결성이 깨지지 않았음을 확인한다 (본 task 는 STATE 를 건드리지 않지만 driver bookkeeping 전 검증).
- [x] 분기 없음 · 코드 변경 0 인 doc-only task 이므로 R-112 4 항목(happy / error / branch / negative unit test)은 **적용 대상 아님** — CLAUDE.md §3.2 의 direct-mode doc-only 면제 조항에 해당한다. tester 미호출이 정당한 사유를 commit trail 의 `notes` 에 한 줄로 남긴다.

## Out of Scope

- `web/` 아래 **어떤 코드·spec 도 수정 금지** — 본 slice 는 문서 재판정 전용이다. 실측 중 코드 결함이 보이면 고치지 말고 Follow-ups 에 적는다.
- [PLAN.md](../PLAN.md) `131 행` bullet 의 마커 `[ ]` → `[x]` 승격 — ④(기간 지정 UI + `POST /api/assessment-evaluation/period` 호출 경로, `96 행` REQ-077) 가 잔여이므로 본 slice 에서 승격하지 않는다.
- `96 행` REQ-077 (④ 축) 재판정 또는 구현 — 별도 slice 소관.
- `93 행` REQ-074 · `94 행` REQ-075 판정 본문 재수정 (이미 닫힌 축).
- 새 ADR 작성, `docs/architecture/*` 갱신, requirements.md 의 다른 REQ row 일괄 점검.

## Suggested Sub-agents

`implementer` (doc-only 단일 편집 — architect · tester 불요)

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 추가)

## 결과 (2026-08-30 DONE)

`origin/main` 실측으로 4 개 AC 를 모두 충족했다.

- [requirements.md](../requirements.md) `95 행` REQ-076 을 `PLANNED` → `DONE` 재판정. 판정 본문에 **집계 축**(`web/src/api/assessmentScoreScale.ts` `24~25 행` 상수 0–3 · `56~68 행` 폭 0.5 6 등분 bucket · `92 행` clamp · `120 행` `deriveContributionScoreBuckets` · `152 행` `summarizeContributionScores`) · **분포 표시 축**(`web/src/views/DashboardView.tsx` `41~43 행` → `651~653 행` → `861 행`) · **요약 카드 축**(같은 파일 `286 행` · `295 행`) · **회귀 방지 축**(`assessmentScoreScale.test.ts` `251 행`, `DashboardView.test.tsx` `1585 행` · `1711 행` · `1723 행` · `1839 행` · `1430 행`) 4 축 좌표를 박았다. 근거 열에는 shipped chain `T-1728, T-1729, T-1730, T-1731` 을 `94 행` REQ-075 와 같은 표기로 추가.
- 검증 위치 `unit` 유지 — `test/e2e/` 26 개 spec 이 전부 supertest HTTP 축이고 점수 분포·스케일 브라우저 harness 는 0 건이었다(`ScoreDistribution` · `점수 분포` · `scoreMax` 검색 hit 0).
- "점수 분포 **등** 시각화" 범위 실측 결과 planner 사전 판단이 맞았다 — `ScoreDistributionChart.tsx` `57~62 행` 의 `100` 은 max count 대비 막대 폭 백분율, `TrendTimeSeriesPanel.tsx` 는 수치 축 없는 요약 테이블(`28~33 행` `TrendPoint` 는 `label` · `value` 뿐). `web/src/components/*.tsx` + `DashboardView.tsx` 전수 검색에서 0–100 만점 가정 실코드 hit 0 건이라 `IN_PROGRESS` 가 아니라 `DONE`.
- [PLAN.md](../PLAN.md) `131 행` ③ 축 서술을 shipped 로 바꾸고 말미 잔여를 ④(REQ-077) 하나로 축소. bullet 마커 `[ ]` 는 Out of Scope 대로 유지.
- 코드 변경 0 (`docs/requirements.md` · `docs/PLAN.md` 2 파일). doc-only 라 CLAUDE.md §3.2 R-112 면제 — commit trail `notes` 에 사유 기록.
