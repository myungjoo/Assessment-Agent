---
id: T-1730
title: DashboardView 요약 지표를 실 contributionScore 스케일(0–3)로 배선하고 만점 표기 교정
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-076]
estimatedDiff: 270
estimatedFiles: 2
created: 2026-08-27
completedAt: 2026-08-27T05:52:52Z
prNumber: 1360
independentStream: web-dashboard-real-scale
dependsOn: [T-1728, T-1729]
touchesFiles:
  - web/src/views/DashboardView.tsx
  - web/src/views/DashboardView.test.tsx
plannerNote: PLAN 131 행 ③(REQ-076) slice 4b-2 — 요약 지표만 실 스케일로 교체, 브리지 제거는 4b-3 으로 분리
---

# T-1730 — DashboardView 요약 지표를 실 contributionScore 스케일(0–3)로 배선하고 만점 표기 교정

## Why

오너 지시 [PLAN](../PLAN.md) `131 행` ③ (REQ-076, "점수 분포 축 실 metricScore 스케일 정합 — 0–100 임의 가정 금지") 분해의 **slice 4b-2** 다. 직전 T-1729 가 점수 **분포 축** 은 실 `contributionScore` 스케일(값역 `[0, 3]`) 로 옮겼지만, **요약 지표 카드** 는 아직 임시 브리지 `toLegacyScoreRows` 를 경유한 `deriveMetrics` 가 산출하며 만점 근거 없이 "평균 점수 N 점" 만 찍는다 — 사람이 100 점 만점으로 오독하기 쉬운 마지막 표면이다. 본 slice 는 T-1728 이 신설한 순수 모듈의 `summarizeContributionScores` 를 요약 지표에 배선하고 만점을 화면에 드러낸다.

임시 브리지 `toLegacyScoreRows` 함수 자체의 삭제는 §3 크기 상한(300 LOC / 5 파일) 을 넘길 위험이 있어 **slice 4b-3 으로 분리** 한다 (Follow-ups). 본 task 는 그 함수를 호출하는 마지막 소비처(`legacyScoreRows` useMemo) 만 걷어내고 함수·spec 은 그대로 둔다.

## Required Reading

- [web/src/views/DashboardView.tsx](../../web/src/views/DashboardView.tsx) — 특히 `286~304 행` (`deriveMetrics` 정의 + 머리 주석), `481~485 행` (`legacyScoreRows` useMemo), `494~497 행` (`metrics` useMemo), `524~532 행` (`scoreBuckets` — T-1729 가 박제한 동형 배선 선례), 파일 끝 `export { ... }` 목록
- [web/src/views/DashboardView.test.tsx](../../web/src/views/DashboardView.test.tsx) — `20~22 행` (helper import), `135~160 행` (`SAMPLE` fixture + 렌더 assertion), `238~245 행` (기존 `deriveMetrics` 테스트), `1120~1135 행` (브리지 경유 집계 테스트)
- [web/src/api/assessmentScoreScale.ts](../../web/src/api/assessmentScoreScale.ts) — `summarizeContributionScores` / `ContributionScoreSummary` (`count` · `average: number | null` · `scoreMax`) · `CONTRIBUTION_SCORE_MIN/MAX`
- [web/src/components/MetricSummaryCards.tsx](../../web/src/components/MetricSummaryCards.tsx) — `MetricSummaryItem` (`id` · `label` · `value` · `unit?`) 와 렌더 방식
- [web/src/api/assessmentRow.ts](../../web/src/api/assessmentRow.ts) — `AssessmentDisplayRow` 의 `contributionScore` 필드 (값 없음은 `null`)
- [CLAUDE.md](../../CLAUDE.md) §3.2 (R-112) · §12 (언어 정책)

## Acceptance Criteria

- [x] `deriveMetrics` 의 시그니처를 `(rows: AssessmentDisplayRow[]) => MetricSummaryItem[]` 로 교체하고 내부 집계를 `summarizeContributionScores(rows)` 소비로 전환한다 — 컨테이너 안에서 평균을 다시 계산하지 않는다(집계 로직 중복 금지, 모듈은 수정 0).
- [x] `metrics` useMemo 가 `deriveMetrics(visibleRows)` 를 호출하도록 바꾸고, 마지막 소비처가 사라진 `legacyScoreRows` useMemo(`481~485 행`) 를 삭제한다. `toLegacyScoreRows` **함수 정의·export·기존 spec 은 건드리지 않는다**(slice 4b-3).
- [x] 카드 계약: `평가 건수` = 표시 행 수(`rows.length` — 표에 보이는 건수와 일치), `평균 점수` = `summary.average`. **만점은 `summary.scoreMax` 에서 온다 — 숫자 `3` 하드코딩 금지**. 화면 문자열에 만점이 드러난다(예: `"1.75 / 3"`).
- [x] `summary.average === null`(점수 보유 행 0 건) 이면 평균 점수 카드를 내지 않는다 — 0 으로 위장 금지. 입력이 빈 배열이거나 배열이 아니면(`null`·`undefined`·비배열) 빈 목록을 반환하고 throw 하지 않는다.
- [x] happy-path test 1+ — 실 스케일 행(예: `0.5` · `2` · `3`) 으로 `deriveMetrics` 가 평가 건수와 만점 병기 평균을 낸다.
- [x] error path test 1+ — 비배열 입력(`null` · `undefined` · 문자열) 에서 throw 0 + 빈 목록.
- [x] 분기 cover — (a) 빈 배열, (b) 전 행 `contributionScore` 가 `null`(평균 카드 미출력), (c) 값 있음·없음 혼재(분모가 값 보유 행 수), (d) 정상 전량 — 각 1+ test.
- [x] negative cases 충분 cover — 응답 미도착(`undefined` 전달) · 점수 결손(`null`) · 값역 밖(`-1` · `7`) · 비유한 값(`NaN` · `Infinity`) · 비객체 row 각 1+ test.
- [x] **0–100 회귀 drift guard** 1+ — 요약 지표가 `CONTRIBUTION_SCORE_MAX`(=3) 를 만점으로 쓴다는 사실을 assert 해, 만점을 `100` 으로 되돌리거나 `scoreMax` 를 하드코딩으로 바꾸면 fail 하게 한다(예: 평균 카드 문자열이 `/ 3` 을 포함하고 `100` 을 포함하지 않음).
- [x] 렌더 레벨 assertion 1+ — `DashboardView` 를 실제로 렌더했을 때 요약 카드에 만점 표기가 나온다(기존 `평가 건수` · `평균 점수` assertion 유지).
- [x] `pnpm --dir web test` green · `pnpm --dir web build`(tsc) green · 루트 `pnpm lint` green.
- [x] `src/` diff 0 이므로 backend `pnpm test:cov`(line ≥ 80% / function ≥ 80%) 는 불변 통과.
- [x] 변경 파일 2 개 · diff ≤ 300 LOC 유지.

## Out of Scope

- `toLegacyScoreRows` 함수 정의 · export · 그 helper 를 직접 검증하는 기존 spec 삭제 (slice 4b-3).
- `web/src/components/EvaluationResultTable.tsx` · `EvaluationResultRow` 타입 파일 정리.
- `web/src/api/assessmentScoreScale.ts` 수정 (모듈은 T-1728 확정본 그대로 소비만).
- `MetricSummaryCards.tsx` 컴포넌트 수정 — 만점 표기는 컨테이너가 조립한 `value` 문자열로 해결한다.
- 전기 대비 delta · 서버 aggregation endpoint · 기간 지정 UI(PLAN `131 행` ④).
- `src/` · `prisma/` · `package.json` · 새 dependency 추가.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- **slice 4b-3**: 임시 브리지 `toLegacyScoreRows` 함수 정의 · export · 전용 spec 삭제 + `EvaluationResultRow` type-only import 정리 (본 task 후 소비처 0).

## 결과 (2026-08-27 완료)

- **DONE** — PR [#1360](https://github.com/myungjoo/AA_S1/pull/1360) squash merge → main `00c754c6`. reviewer APPROVE round 1/7, 4-게이트 PASS.
- `deriveMetrics` 시그니처를 `AssessmentDisplayRow[]` 로 교체하고 집계를 T-1728 의 `summarizeContributionScores` 에 위임했다 — 컨테이너 평균 재계산 0, 만점은 `summary.scoreMax` 에서 화면에 드러나 `3` 하드코딩 0. 소비처가 사라진 `legacyScoreRows` useMemo 를 삭제하고 `metrics` 는 `visibleRows` 를 직접 소비한다. 2 파일 +236/-42.
- spec 에 T-1730 describe 14 케이스 추가: happy / error(비배열 입력 throw 0) / 분기 4 종(빈 배열 · 전 행 null · 혼재 · 전량 유효) / negative 5 종(미도착 · 결손 · 값역 밖 · 비유한 · 비객체 row) + **0–100 회귀 drift guard** + 렌더 레벨 2 종. web 79 파일 2399 test · backend 453 suite 13009 test · 루트 `pnpm lint` · `pnpm --dir web build`(tsc) 전량 green.
- 범위 불변 — 임시 브리지 `toLegacyScoreRows` 함수 정의 · export · 전용 spec 은 존치(소비처만 0 이 됨, slice 4b-3 이 삭제한다). `src/` diff 0 이라 backend coverage 불변, 새 dependency 0.
