---
id: T-1792
title: Re-judge REQ-075 against the shipped display-contract 4-axis chain
phase: P6
status: PENDING
commitMode: direct
coversReq: [REQ-075]
estimatedDiff: 20
estimatedFiles: 1
created: 2026-08-30
independentStream: web-dashboard-display-contract
dependsOn: [T-1791]
touchesFiles:
  - docs/requirements.md
plannerNote: "P6 PLAN 131 행 ② 축 4 개(표·분포·시계열·기여) 배선까지 머지됐는데 REQ-075 가 PLANNED 로 남은 drift 실측 재판정 (doc-only)"
---

# T-1792 — 표시 계약 정합 4 축 shipped 실측으로 REQ-075 재판정

## Why

[PLAN](../PLAN.md) `131 행` 의 오너 지시(2026-08-26, R-175~R-178) ② **표시 계약 정합** 축은 순수 모듈 절단 → 컨테이너 배선의 4 갈래 chain 으로 분해돼 **전부 main 에 머지**됐다 — 표 축 [T-1724](T-1724-assessment-display-row-mapper.md) · [T-1725](T-1725-assessment-result-table-component.md) · [T-1726](T-1726-assessment-row-sort-filter-ops.md) · [T-1727](T-1727-dashboardview-assessment-row-wire.md), 점수 분포 축 [T-1728](T-1728-contribution-score-scale-module.md) · [T-1729](T-1729-dashboard-score-distribution-real-scale-wire.md) · [T-1730](T-1730-dashboard-metric-summary-real-scale-wire.md) · [T-1731](T-1731-dashboard-remove-legacy-score-bridge.md), 시계열 축 [T-1788](T-1788-summary-trend-row-module.md) · [T-1789](T-1789-dashboardview-summary-row-wire.md), 기여 상세 패널 축 [T-1790](T-1790-contribution-row-module.md) · [T-1791](T-1791-dashboardview-contribution-row-wire.md).

그런데 [requirements.md](../requirements.md) `94 행` 의 REQ-075 는 여전히 상태 토큰 `PLANNED` 이고 "구현 위치" 컬럼도 `P6 (PLAN 131 행)` 만 적혀 있어 slice ID 가 하나도 없다 — 머지된 사실과 추적 표가 어긋난 drift 다. 본 slice 는 그 **한 행만** 실측 좌표 기반으로 재판정해 추적 표를 머지 사실에 맞춘다. 직전 [T-1791](T-1791-dashboardview-contribution-row-wire.md) Follow-up (a) 의 앞부분이며, 코드 변경 0 · 기존 문서 1 행의 inline-amend 이므로 [CLAUDE.md §3.1](../../CLAUDE.md) 판정 1 에 따라 `commitMode: direct`.

## Required Reading

- [docs/requirements.md](../requirements.md) `5~13 행` (운영 룰 — 상태 enum 5 값 · 검증 위치 enum 7 값 · "구현 위치 컬럼에 task 목록을 comma 로" 룰) 와 `94 행` (REQ-075 — **유일한 수정 대상**). REQ 문언은 "평가 결과 표시(테이블 · 상세 패널 · 점수 분포 · 시계열)가 backend 응답 필드(`volume` · `difficulty` · `contributionScore` · `narrative` · `period`/`periodStart`)와 계약 일치 + 실데이터 렌더 검증".
- **표 축 (모듈)**: [web/src/api/assessmentRow.ts](../../web/src/api/assessmentRow.ts) `21~27 행`(`AssessmentDisplayRow` 의 `periodStart` · `difficulty` · `contributionScore` · `volume` · `narrative`) · `52 행`(Decimal 문자열/숫자 양쪽 흡수 주석) · `97~101 행`(매핑 본문) + colocated [assessmentRow.test.ts](../../web/src/api/assessmentRow.test.ts).
- **표 축 (배선 · 정렬/필터 · 표시)**: [web/src/views/DashboardView.tsx](../../web/src/views/DashboardView.tsx) `31~34 행`(모듈 import) · `539 행`(매핑 책임 귀속 주석) · `600 행`(`filterAssessmentRows(deriveAssessmentDisplayRows(data), …)`) 와 [web/src/api/assessmentRowOps.ts](../../web/src/api/assessmentRowOps.ts) · [web/src/components/AssessmentResultTable.tsx](../../web/src/components/AssessmentResultTable.tsx) (T-1725 산출물 — 실제 렌더 컬럼 확인).
- **점수 분포 축**: [web/src/api/assessmentScoreScale.ts](../../web/src/api/assessmentScoreScale.ts) (`deriveContributionScoreBuckets` · `summarizeContributionScores` — 실 `contributionScore` 스케일) 와 [DashboardView.tsx](../../web/src/views/DashboardView.tsx) `35~43 행`(T-1729/T-1730 근거 주석 + import) · `651~652 행`(`scoreBuckets` useMemo) · `860~861 행`(`ScoreDistributionChart buckets={scoreBuckets}`).
- **시계열 축**: [web/src/api/summaryRow.ts](../../web/src/api/summaryRow.ts) `5 행`(옛 계약이 모든 포인트를 0 으로 렌더하던 근거) · `46~53 행`(`periodStart` · 파싱 실패 시 0 위장 금지 · `narrative`) · `69 행`(`toTrendLabel`) 와 [DashboardView.tsx](../../web/src/views/DashboardView.tsx) `48~49 행` · `548 행` · `642~645 행`(`deriveSummaryDisplayRows` → `toTrendPoints`).
- **기여 상세 패널 축**: [web/src/api/contributionRow.ts](../../web/src/api/contributionRow.ts) (`deriveContributionDisplayRows` · `FALLBACK_CONTRIBUTION_LABEL`) 와 [DashboardView.tsx](../../web/src/views/DashboardView.tsx) `55~56 행` · `563 행` · `658 행` · `664 행`(`toContributionMetricItems`) · `216 행`(`score === null` 행 제외 정책).
- **검증 실체 축**: `ls test/e2e | grep -i -E "dashboard|display"` 결과가 **0 건** 이라는 사실 (브라우저 e2e harness 부재) 과, 대신 존재하는 web colocated vitest — [DashboardView.test.tsx](../../web/src/views/DashboardView.test.tsx) · [DashboardView.assessments-list-contract.test.ts](../../web/src/views/DashboardView.assessments-list-contract.test.ts) · [DashboardView.summaries-list-contract.test.ts](../../web/src/views/DashboardView.summaries-list-contract.test.ts) · [DashboardView.contributions-list-contract.test.ts](../../web/src/views/DashboardView.contributions-list-contract.test.ts).
- [docs/tasks/T-1786-requirements-req067-069-signup-ux-rejudge.md](T-1786-requirements-req067-069-signup-ux-rejudge.md) `## Acceptance Criteria` — 직전 재판정 slice 의 서술 수위 · 좌표 인용 형식 · 검증 위치 정정 선례 (본 slice 도 같은 형식을 따른다).

## Acceptance Criteria

- [ ] `docs/requirements.md` 의 **REQ-075 한 행만** 갱신된다. 상태 토큰이 실측 근거와 함께 재판정된다 — 4 축(테이블 · 상세 패널 · 점수 분포 · 시계열)이 모두 충족이면 `PLANNED` → `DONE`, 실측에서 미충족 축이 남으면 `IN_PROGRESS` 로 두고 **그 잔여를 한 줄로 명시**한다. **근거 없이 토큰만 바꾸지 않는다** (판정 문장이 어느 파일 몇 행이 그 REQ 문언을 충족하는지 적어야 한다).
- [ ] 판정 문장이 REQ 문언이 열거한 **4 축을 각각 하나씩** 인용한다 — 테이블(`assessmentRow.ts` + `DashboardView.tsx` 배선 + `AssessmentResultTable`), 상세 패널(`contributionRow.ts` + `toContributionMetricItems`), 점수 분포(`assessmentScoreScale.ts` + `scoreBuckets`), 시계열(`summaryRow.ts` + `toTrendPoints`). 축 하나라도 인용이 빠지면 미완.
- [ ] 판정 문장이 REQ 문언이 열거한 **backend 필드 5 종**(`volume` · `difficulty` · `contributionScore` · `narrative` · `period`/`periodStart`)이 각각 어느 모듈의 어느 필드로 흘러 화면에 닿는지 밝힌다. 특히 `narrative` 는 표 축(`assessmentRow.ts` `27 행`)과 시계열 축(`summaryRow.ts` `53 행`) 양쪽에 존재하므로, **실제 렌더까지 닿는지** 를 확인해 닿지 않으면 그 잔여를 명시한다 (모듈이 갖고 있다는 사실만으로 "표시" 를 충족으로 적지 않는다).
- [ ] 판정 근거로 인용하는 모든 좌표가 실재한다 — 인용 전에 `grep -n "<인용 문자열>" <파일>` 로 확인하고, 확인되지 않은 케이스 · 파일 · 행 번호를 지어내 적지 않는다.
- [ ] **검증 위치 컬럼을 실측에 맞춘다** — 현재 `unit + e2e` 이나 `test/e2e/` 에 대시보드 표시 계약 e2e 가 0 건이면 `unit` 으로 정정하고 **정정 이유를 판정 문장에 한 구절로 남긴다**(브라우저 e2e harness 부재 — [T-1786](T-1786-requirements-req067-069-signup-ux-rejudge.md) 선례). 반대로 e2e 실체를 찾으면 `unit + e2e` 를 유지하고 그 파일을 인용한다. 어느 경우에도 [requirements.md](../requirements.md) `11 행` 의 검증 위치 enum 밖 토큰을 새로 만들지 않는다.
- [ ] "구현 위치" 컬럼에 대응 slice ID 가 comma 로 추가된다 — `T-1724` · `T-1725` · `T-1726` · `T-1727` · `T-1728` · `T-1729` · `T-1730` · `T-1731` · `T-1788` · `T-1789` · `T-1790` · `T-1791`. 기존 `P6 (PLAN 131 행)` 표기는 삭제하지 않는다.
- [ ] **REQ 문언 경계를 지킨다** — 대시보드 안 인원 선택 UI 는 `93 행` **REQ-074**, 점수 스케일 가정(0–100 금지) 자체는 `95 행` **REQ-076**, 기간 지정 UI · 기간 평가 호출은 `96 행` **REQ-077** 소관이다. 그 축의 미충족을 REQ-075 의 잔여로 적지 않는다 — 필요하면 "해당 축은 REQ-0NN 소관" 한 구절로 귀속만 밝힌다.
- [ ] 7 컬럼 schema 가 깨지지 않는다 — 수정 후 `awk -F'|' 'NR==94 {print NF}' docs/requirements.md` 가 다른 REQ 행과 같은 값이고, 행 안에 개행이 들어가지 않는다.
- [ ] 변경 파일은 `docs/requirements.md` **1 개뿐** — `git status --short` 에 다른 production 파일이 나타나지 않는다 (task 파일 · STATE · journal 은 driver bookkeeping 소관이라 예외).
- [ ] doc-only direct 이므로 코드 0 LOC — [CLAUDE.md §3.2](../../CLAUDE.md) R-110 tester 의무와 R-112 4 항목(happy / error path / 분기 / negative) 은 **적용 대상 없음**. 대신 위 좌표 grep 검증으로 대체한다.

## Out of Scope

- **PLAN.md `131 행` 마커 변경 금지** — 그 bullet 은 ① 인원 선택 UI · ② 표시 계약 정합 · ③ 점수 스케일 · ④ 기간 UI 4 축을 한 덩어리로 묶고 있어 REQ-075 하나만으로 `- [ ]` → `- [x]` 승격 판정을 할 수 없다. 승격은 REQ-074 · REQ-076 · REQ-077 재판정이 끝난 뒤 별도 direct doc slice 소관이다 (선례: [T-1787](T-1787-plan-129-signup-ux-closure.md)).
- **다른 REQ 행 수정 금지** — REQ-003 · REQ-004 (표시 축 서술이 겹치지만 다른 미충족 축을 함께 안고 있어 별도 판정 필요) · REQ-074 · REQ-076 · REQ-077 · 그 밖 어떤 행도 문체 통일 목적으로도 손대지 않는다.
- **코드 · spec 변경 0** — `web/` · `src/` · `test/` 어느 파일도 수정하지 않는다. 부족한 test 나 개선점이 보이면 아래 Follow-ups 에만 적는다.
- **표 schema · enum 변경 금지** — 7 컬럼 구조 · 상태 enum 5 값 · 검증 위치 enum 7 값 자체를 늘리거나 줄이지 않는다.
- **README 수정 금지** — README `176 행` 원문은 그대로 두고 본 표만 동기화한다.

## Suggested Sub-agents

`implementer` (doc-only 1 행 inline-amend — architect · tester 불요)

## Follow-ups

- (a) **REQ-003 · REQ-004 의 "표시 축 / 프런트 노출 축" 부분 amend** — 두 행은 평가 · 저장 · LLM 코멘트 등 다른 축의 잔여를 함께 안고 있으므로, 표시 축 문구만 본 chain 실측으로 갱신하는 별도 doc slice.
- (b) **REQ-074 · REQ-076 · REQ-077 재판정** — PLAN `131 행` ① · ③ · ④ 축의 shipped 여부 실측 후 각각 재판정 (축별 별도 slice 권장).
- (c) **PLAN `131 행` bullet 마커 승격** — 위 (b) 까지 끝나 4 축이 모두 닫히면 direct doc slice 로.
