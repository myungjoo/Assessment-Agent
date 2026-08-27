---
id: T-1728
title: 실 contributionScore 스케일(0–3) 기반 점수 분포·요약 집계 순수 모듈 신설
phase: P6
status: DONE
commitMode: pr
prNumber: 1358
coversReq: [REQ-076]
independentStream: p6-dashboard-actual-behavior
dependsOn: [T-1724, T-1727]
touchesFiles:
  - web/src/api/assessmentScoreScale.ts
  - web/src/api/assessmentScoreScale.test.ts
estimatedDiff: 290
estimatedFiles: 2
created: 2026-08-27
plannerNote: P6 오너지시 PLAN 131행 ③ 분해 slice 4a — 0–100 임의 가정을 실 ordinal 스케일 0–3 으로 교정하는 순수 집계 모듈 선행
---

# T-1728 — 실 contributionScore 스케일(0–3) 기반 점수 분포·요약 집계 순수 모듈 신설

## Why

[PLAN.md](../PLAN.md) `131 행` 🔴 오너 지시 ③ ([requirements.md](../requirements.md) `95 행` REQ-076 — "점수 분포 등 시각화의 축·구간을 실제 metricScore 스케일에 맞춤, 0–100 임의 가정 금지") 의 분해 slice 4a 다. 직전 T-1727 이 표 파이프라인을 `AssessmentDisplayRow` 계약으로 교체하면서 요약 지표·점수 분포만 임시 브리지 `toLegacyScoreRows` 로 이어 두었고, 그 브리지 제거를 Follow-up 으로 남겼다.

planner 실측 (main `a2e643a2`): [DashboardView.tsx](../../web/src/views/DashboardView.tsx) `160~170 행` 의 `BUCKET_EDGES` 는 `0–20 / 20–40 / 40–60 / 60–80 / 80–100` 5 구간이고 `deriveScoreBuckets` 가 점수를 `Math.min(100, Math.max(0, score))` 로 clamp 한다. 그런데 backend `Assessment.contributionScore` 는 [evaluation-result.persist.mapper.ts](../../src/assessment-evaluation/domain/evaluation-result.persist.mapper.ts) `73~78 행` 의 `CONTRIBUTION_SCORE_BY_LEVEL` (`zero=0 / low=1 / medium=2 / high=3`) ordinal 의 **평균** 이라 값역이 `[0, 3]` 이다. 즉 **현실의 모든 행이 첫 bucket `0–20` 에 몰려** 분포 차트가 항상 단일 막대가 되고, 요약 카드의 "평균 점수 N 점" 도 100 점 만점을 암시해 오해를 준다 — REQ-076 이 금지한 바로 그 상태다.

배선처 `DashboardView.tsx` 는 809 행이고 두 helper 교체 + 브리지 제거 + 그 helper 를 검사하는 기존 spec 블록 재작성을 한 commit 에 몰면 §3 크기 상한 (300 LOC / 5 파일) 을 넘는다. 그래서 T-1726 (정렬·검색 순수 모듈 선행 → T-1727 배선) 선례를 승계해, **실 스케일 상수와 집계 순수 연산만** 먼저 분리한다.

## Required Reading

- [src/assessment-evaluation/domain/evaluation-result.persist.mapper.ts](../../src/assessment-evaluation/domain/evaluation-result.persist.mapper.ts) `69~78 행` (`CONTRIBUTION_SCORE_BY_LEVEL` — zero=0 / low=1 / medium=2 / high=3 등간격 ordinal) + `170~205 행` (`contributionScore` = component score 의 **평균**, 빈 입력 0) — 값역 `[0, 3]` 의 근거. **본 task 는 `src/` 를 수정하지 않는다 (읽기 전용).**
- [web/src/api/assessmentRow.ts](../../web/src/api/assessmentRow.ts) — `AssessmentDisplayRow` 9 키 · 숫자 축 `null` 정책 (값 없음 ≠ 0 점). 본 모듈은 이 타입을 **type-only import** 한다.
- [web/src/api/assessmentRowOps.ts](../../web/src/api/assessmentRowOps.ts) — 같은 계층 순수 모듈의 파일 머리 주석 · export 형태 · `null` 취급 규약 (본 모듈이 따를 형식 선례).
- [web/src/components/ScoreDistributionChart.tsx](../../web/src/components/ScoreDistributionChart.tsx) `23~31 행` — `ScoreDistributionBucket` (`id` · `label` · `count`) 소비 형태. 구조 호환이 목표이며 **본 모듈은 이 컴포넌트를 import 하지 않는다** (api → components 역방향 의존 금지, spec 에서만 type-only 로 호환 검증).
- [web/src/views/DashboardView.tsx](../../web/src/views/DashboardView.tsx) `160~170 행` (`BUCKET_EDGES`) · `260~292 행` (`deriveScoreBuckets`) · `294~356 행` (`toLegacyScoreRows` · `deriveMetrics`) — 대체 대상의 현행 규약 확인용. **본 task 는 이 파일을 수정하지 않는다.**
- [web/src/api/assessmentRowOps.test.ts](../../web/src/api/assessmentRowOps.test.ts) — colocated spec 배치 · drift guard test 작성 선례.

## Acceptance Criteria

- [ ] 신규 파일 [web/src/api/assessmentScoreScale.ts](../../web/src/api/assessmentScoreScale.ts) 에 실 스케일 상수를 박제한다 — `CONTRIBUTION_SCORE_MIN = 0` · `CONTRIBUTION_SCORE_MAX = 3`. 파일 머리 주석에 근거 (`CONTRIBUTION_SCORE_BY_LEVEL` ordinal 평균, REQ-076) 와 backend single source 경로를 명시한다.
- [ ] `CONTRIBUTION_SCORE_BUCKET_EDGES` 를 `[0, 3]` 을 **폭 0.5 로 6 등분** 한 구간 (`0–0.5` · `0.5–1` · `1–1.5` · `1.5–2` · `2–2.5` · `2.5–3`) 으로 export 한다. 정수 경계 (`1` · `2`) 가 ordinal 등급 경계와 정확히 일치해야 한다. 귀속 규칙은 `[min, max)` 반열림 + **마지막 bucket 만 상한 포함** (T-1727 이전 규약 승계).
- [ ] `deriveContributionScoreBuckets(rows: AssessmentDisplayRow[]): ScoreBucket[]` 순수 함수를 export 한다 — `contributionScore` 가 `null`/비유한 수인 행은 **집계에서 제외** (0 점 위장 금지, T-1724·T-1727 결정 승계), 범위 밖 값은 가장 가까운 끝 bucket 으로 clamp (누락 금지), 집계 대상 행이 0 건이면 **빈 배열** 반환 (차트가 빈 상태 렌더). 입력 mutation 0 · throw 0.
- [ ] `summarizeContributionScores(rows: AssessmentDisplayRow[]): ContributionScoreSummary` 순수 함수를 export 한다 — `{ count: number; average: number | null; scoreMax: number }`. `count` 는 **점수를 가진 행 수**, `average` 는 그 평균 (소수 둘째 자리 결정적 round), 대상 0 건이면 `average` 는 `0` 이 아니라 **`null`**, `scoreMax` 는 `CONTRIBUTION_SCORE_MAX`. 표시 라벨·단위·카드 형태는 본 모듈이 만들지 않는다 (배선 slice 책임).
- [ ] 반환 타입 `ScoreBucket` · `ContributionScoreSummary` 를 export 하고, 모듈이 `react` · `components/*` · fetch · 전역 상태를 **import 하지 않는다** (`AssessmentDisplayRow` type-only import 만).
- [ ] happy-path unit test 3+ — (a) 여러 등급이 섞인 행 배열이 각 bucket 에 정확히 분포, (b) `summarizeContributionScores` 의 `count`·`average` 정확값, (c) 정수 경계값 `1`·`2` 가 상위 bucket 에 귀속.
- [ ] error path unit test 2+ — 배열이 아닌 입력 (`null` · 객체 · 문자열, 타입 우회) 과 행 원소가 `null`/비객체인 경우 각각 빈 배열·`{count:0, average:null}` 을 반환하고 **throw 0**.
- [ ] 분기 cover — (a) 빈 배열, (b) 전 행 `contributionScore=null`, (c) 하한 미만 (`-1`) 과 상한 초과 (`4`) 의 clamp 각 1+, (d) 마지막 bucket 상한 포함 (`3`), (e) 첫 bucket 하한 포함 (`0`), (f) 일부만 `null` 인 혼합 배열.
- [ ] negative cases 충분 cover — 각 1+ test: (a) `NaN`·`Infinity` 점수가 집계에 포함되지 않음, (b) `contributionScore` 가 문자열인 행 (타입 우회) 이 평균을 오염시키지 않음, (c) `null` 행이 첫 bucket 을 부풀리지 않음 (0 점 위장 0), (d) 입력 배열·원소가 mutate 되지 않음 (호출 전후 deep-equal), (e) `average` 가 대상 0 건일 때 `0` 이 아닌 `null`, (f) bucket `count` 합이 집계 대상 행 수와 항상 일치.
- [ ] drift guard test 2+ — (a) `CONTRIBUTION_SCORE_BUCKET_EDGES` 가 `[CONTRIBUTION_SCORE_MIN, CONTRIBUTION_SCORE_MAX]` 를 **틈·겹침 없이** 연속으로 덮고 첫 `min` 과 마지막 `max` 가 상수와 일치, (b) 반환 bucket 이 `ScoreDistributionBucket` (`id`·`label`·`count`) 과 구조 호환임을 type-only import 로 컴파일 타임 고정 + 키 집합 assertion. 스케일 가정이 다시 `0–100` 으로 돌아가면 fail 해야 한다.
- [ ] `cd web && pnpm test` (vitest) 전량 green · `cd web && pnpm build` 통과 (TypeScript 오류 0).
- [ ] 루트 `pnpm lint` 통과 + 루트 `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — `src/` diff 0 이라 backend coverage 불변임을 확인.

## Out of Scope

- [DashboardView.tsx](../../web/src/views/DashboardView.tsx) 수정 — `BUCKET_EDGES` 삭제 · `deriveScoreBuckets`/`deriveMetrics` 를 본 모듈로 이전 · 임시 브리지 `toLegacyScoreRows` 제거 · 요약 카드 라벨을 `0–3` 만점 표기로 교정하는 **배선은 slice 4b** 다. 본 task 는 그 파일 diff **0**.
- [ScoreDistributionChart.tsx](../../web/src/components/ScoreDistributionChart.tsx) · [MetricSummaryCards](../../web/src/components/) · [assessmentRow.ts](../../web/src/api/assessmentRow.ts) · [assessmentRowOps.ts](../../web/src/api/assessmentRowOps.ts) 수정 — 전부 diff 0 파일 (type-only import 조차 컴포넌트 쪽으로는 하지 않는다).
- `src/` · `prisma/` 수정 — 스케일의 single source 는 backend 이며 본 task 는 **읽고 따라갈 뿐** 바꾸지 않는다. 값역 정책 변경 (가중치 · ordinal 재정의) 은 ADR 대상.
- `Summary.metricScore` (난이도·기여도·volume `log1p` 합성, 상한 없음) 축 정합 — 시계열 패널의 축 문제는 별도 slice. 본 모듈은 `Assessment.contributionScore` 축만 다룬다.
- 기간 (일/주/월 + 시작) 지정 UI 와 `POST /api/assessment-evaluation/period` 호출 경로 (REQ-077, PLAN `131 행` ④).
- 서버 aggregation 전환 · 새 endpoint 추가 · 차트 라이브러리 도입 (ADR-0040 §5 유지) · 새 dependency 추가.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

## Result

- **DONE 2026-08-27T00:52:30Z** — PR [#1358](https://github.com/myungjoo/AA_S1/pull/1358) merge (main `9baee802`, round 1, CI pass).
- 신규 2 파일 +444/-0 (`assessmentScoreScale.ts` +163 · colocated spec +281). 실 스케일 상수 `CONTRIBUTION_SCORE_MIN = 0` · `CONTRIBUTION_SCORE_MAX = 3` 을 backend 근거(`CONTRIBUTION_SCORE_BY_LEVEL` ordinal 평균) 주석과 함께 박제했다.
- 폭 0.5 6 등분 `CONTRIBUTION_SCORE_BUCKET_EDGES` (정수 경계 1 · 2 가 ordinal 등급 경계와 일치, 마지막 구간만 상한 포함) + `deriveContributionScoreBuckets` (`null` · 비유한 값 제외, 범위 밖은 끝 bucket clamp, 대상 0 건이면 빈 배열) + `summarizeContributionScores` (`count` · `average` 소수 2 자리 · 0 건이면 `average` 는 `null` · `scoreMax`) export.
- `AssessmentDisplayRow` **type-only import** 만이라 `react` · `components/*` · fetch import 0, throw 0 · 입력 mutation 0. `ScoreDistributionBucket` 구조 호환은 spec 에서 type-only 로만 검증 (api → components 역방향 의존 0).
- spec 281 행 — happy 5 / error 2 / 분기 6 / negative 6 + drift guard 2 (구간이 `[0, 3]` 을 틈·겹침 없이 덮음 · `ScoreDistributionBucket` 구조 호환) 로 `0–100` 가정 회귀를 fail 로 드러낸다.
- web vitest 79 파일 2379 test green · `pnpm build`(tsc) 통과 · 루트 `pnpm lint` · `test:cov` 13009 test green. `src/` diff 0 이라 backend coverage 불변.
- 범위 불변 — `DashboardView.tsx` · `ScoreDistributionChart.tsx` · `assessmentRow.ts` · `assessmentRowOps.ts` · `src/` · `prisma/` · `package.json` diff **0 파일**, 새 dependency 0.
- **크기 상한 초과 기록**: 총 444 LOC 로 §3 의 300 LOC 상한을 넘겼다. 초과분 전부가 R-112 강제 spec(281 행)이고 production 은 163 행 / 1 파일이라, 직전 동형 slice T-1726(411 LOC, PR #1356) 선례를 승계해 진행했다. 이 사실은 PR 본문과 reviewer comment 에 명시 박제돼 있다.
