---
id: T-1731
title: DashboardView 임시 브리지 toLegacyScoreRows 정의·export·전용 spec 제거
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-076]
estimatedDiff: 140
estimatedFiles: 2
created: 2026-08-27
independentStream: web-dashboard-real-scale
dependsOn: [T-1728, T-1729, T-1730]
touchesFiles:
  - web/src/views/DashboardView.tsx
  - web/src/views/DashboardView.test.tsx
plannerNote: PLAN 131 행 ③(REQ-076) slice 4b-3 — 소비처 0 이 된 브리지 잔재 삭제 + type-only import 정리
---

# T-1731 — DashboardView 임시 브리지 toLegacyScoreRows 정의·export·전용 spec 제거

## Why

오너 지시 [PLAN](../PLAN.md) `131 행` ③ (REQ-076 — 점수 분포 축을 실 metricScore 스케일에 맞춤, 0–100 임의 가정 금지) 분해 chain 의 마지막 slice **4b-3** 이다. T-1727 이 표 파이프라인을 새 행 계약 `AssessmentDisplayRow` 로 옮기면서, 요약 지표·점수 분포 helper 가 아직 기대하던 옛 계약 `EvaluationResultRow` 로 얇게 옮겨 주는 **임시 브리지** `toLegacyScoreRows` 를 두었다. 그 두 소비처는 T-1729(분포 축 → `deriveContributionScoreBuckets`)와 T-1730(요약 지표 → `summarizeContributionScores`)이 각각 실 스케일 순수 모듈로 교체해 사라졌다.

planner 가 본 fire 에서 `origin/main` (`dcd6df97`) 을 직접 확인한 결과, 브리지의 **production 소비처는 실제로 0** 이다 — `web/src/views/DashboardView.tsx` 에 남은 것은 `266 행` 함수 정의 · `771 행` export 항목 · 그 반환 타입만을 위한 `31 행` `EvaluationResultRow` type-only import · 관련 주석뿐이고, 나머지 참조는 전부 `DashboardView.test.tsx` 의 전용 spec 이다. 즉 직전 journal 이 예고한 계획이 그대로 유효하며, 본 slice 는 죽은 코드와 그것을 살아있게 유지하던 spec·import 를 함께 걷어내 REQ-076 정합 작업을 마무리한다.

## Required Reading

- `web/src/views/DashboardView.tsx` — 특히 `15~35 행` (import 블록 + T-1727/T-1730 주석), `255~292 행` (브리지 주석 + `toLegacyScoreRows` 정의), `768~782 행` (export 블록)
- `web/src/views/DashboardView.test.tsx` — 특히 `1~35 행` (import 블록, `toLegacyScoreRows` import 포함), `1116~1170 행` (`T-1727` describe 안의 브리지 전용 3 케이스)
- `web/src/api/assessmentScoreScale.ts` — 브리지가 담당하던 정책(`null`·비유한 값 제외 = 0 점 위장 금지)이 현재 어디에서 강제되는지 확인용
- `docs/tasks/T-1730-dashboard-metric-summary-real-scale-wire.md` — 직전 slice 가 남긴 Out of Scope 경계 (본 task 가 이어받는 잔재 목록)

## Acceptance Criteria

- [ ] `web/src/views/DashboardView.tsx` 에서 `toLegacyScoreRows` 함수 정의와 그 앞의 브리지 설명 주석을 삭제한다. 파일 안에 `toLegacyScoreRows` 문자열이 **0 회** 남는다 (`grep -c "toLegacyScoreRows" web/src/views/DashboardView.tsx` 가 0).
- [ ] 파일 하단 `export { ... }` 블록에서 `toLegacyScoreRows` 항목을 제거한다. 나머지 export 항목(`buildAssessmentsPath` · `resolveHeaderSort` · `deriveMetrics` · `buildSummariesPath` · `deriveTrendPoints` · `buildContributionsPath` · `deriveContributionMetrics` · `pageRows` · `derivePersonOptions`)은 **그대로 유지**한다.
- [ ] 브리지 반환 타입 전용이던 `import type { EvaluationResultRow } from '../components/EvaluationResultTable';` 를 삭제한다. 삭제 후 `EvaluationResultRow` 참조가 파일에 0 회여야 하며, 그렇지 않다면 삭제 대신 남긴 근거를 주석에 적는다.
- [ ] `15~35 행` 의 T-1727 / T-1730 주석 중 "브리지는 slice 4b-3 이 정리한다" 는 예고 문구를 **정리 완료 사실**로 갱신한다 — 요약 지표·분포 축이 모두 `web/src/api/assessmentScoreScale.ts` 의 순수 모듈을 소비하며 옛 행 계약 경유가 0 이라는 한 줄. 새 예고를 만들지 않는다.
- [ ] **happy-path**: `DashboardView.test.tsx` 에서 브리지 전용 3 케이스(매핑 happy-path / 비정상 입력 error path / `contributionScore=null` 제외 negative)와 상단 `toLegacyScoreRows` import 를 삭제하되, 삭제된 케이스가 지키던 계약이 다른 곳에서 여전히 단언되는지 확인하고 부족하면 보강한다. 최소한 요약 지표·분포가 정상 렌더되는 happy-path 1+ 가 남아 있어야 한다.
- [ ] **error path**: 응답 error 상태에서 요약 지표·분포 영역이 throw 없이 에러/빈 상태를 렌더하는 케이스 1+ 가 남아 있음을 확인한다 (기존 케이스로 충족되면 재작성 불필요 — 어떤 케이스가 이를 담당하는지 PR 본문에 명시).
- [ ] **분기 cover**: 본 task 는 분기를 추가하지 않고 삭제만 한다. 삭제로 인해 cover 가 사라지는 분기(값 없음 행 제외 / 비유한 값 제외 / 전 행 `null`)가 T-1729·T-1730 describe 또는 `assessmentScoreScale` colocated spec 에서 **여전히 각 1+ 로 단언되는지** 확인하고, 비면 그 자리에 채운다.
- [ ] **negative 충분 cover**: 미도착(`data` 없음) · 결손(`contributionScore=null`) · 값역 밖 · 비유한 값(`NaN`/`Infinity`) · 비객체 row 5 종이 삭제 후에도 각 1+ test 로 남아 있음을 확인한다. 하나라도 비면 남은 describe 에 추가한다.
- [ ] **drift guard(회귀 방지 test) 1+**: `import * as DashboardViewModule from './DashboardView'` 형태로 모듈을 읽어 `toLegacyScoreRows` 가 **export 되지 않음**을 단언하는 test 를 추가한다. 브리지가 되살아나거나 옛 행 계약 경유가 재도입되면 이 test 가 fail 한다.
- [ ] `pnpm --dir web test` 전량 green (기존 파일 수 유지, 삭제분 제외 test 수 감소는 허용).
- [ ] `pnpm --dir web build` (tsc) green — 사용하지 않는 import 제거 누락으로 인한 타입/lint 오류 0.
- [ ] 루트 `pnpm lint` green, `pnpm test:cov` green (line ≥ 80% / function ≥ 80%). `src/` diff 가 0 이므로 backend coverage 는 불변이어야 한다.
- [ ] 총 diff ≤ 300 LOC / 변경 파일 ≤ 5 (본 task 예상 2 파일).

## Out of Scope

- `web/src/components/EvaluationResultTable.tsx` 자체와 그 `EvaluationResultRow` 타입 정의 삭제 — 다른 소비처가 있을 수 있으므로 본 task 는 `DashboardView` 쪽 import 만 끊는다. 컴포넌트 정리가 필요해 보이면 Follow-ups 에 적는다.
- `deriveMetrics` · `deriveContributionMetrics` · `deriveTrendPoints` 등 남은 helper 의 시그니처·본문 변경.
- `web/src/api/assessmentScoreScale.ts` 의 상수·구간 정의 변경 (0–3 값역, bucket 폭 0.5 6 등분은 T-1728 확정 사실).
- 표시 컬럼 재설계 · 기간 지정 UI · 인원 선택 UI 등 PLAN `131 행` 의 ①②④ 항목.
- `web/package.json` 의 coverage threshold 도입 (새 dependency 게이트 — PLAN 의 게이트된 backlog).
- `src/` · `prisma/` · CI workflow · dependency manifest 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 추가)

## 완료 기록

- **완료 시각**: 2026-08-27T07:49Z (cron fire `cron@akiha-fa7ec4f8-0737`)
- **결과**: PR [#1361](https://github.com/myungjoo/AA_S1/pull/1361) squash merge → main `66713120`. 2 파일 `+32/-81`.
- **요약**: `web/src/views/DashboardView.tsx` 에서 임시 브리지 `toLegacyScoreRows` 함수 정의·브리지 설명 주석·하단 `export` 항목·반환 타입 전용이던 `EvaluationResultRow` type-only import 를 삭제했다(파일 내 두 식별자 참조 각 0 회). 남은 export 9 종(`buildAssessmentsPath` · `resolveHeaderSort` · `deriveMetrics` · `buildSummariesPath` · `deriveTrendPoints` · `buildContributionsPath` · `deriveContributionMetrics` · `pageRows` · `derivePersonOptions`)은 불변. 상단 주석의 "브리지는 slice 4b-3 이 정리한다" 예고는 **정리 완료 사실**(요약 지표·분포 축이 모두 `web/src/api/assessmentScoreScale.ts` 순수 모듈을 소비, 옛 행 계약 경유 0)로 갱신했고 새 예고는 만들지 않았다.
- **test**: 브리지 전용 3 케이스와 상단 import 를 삭제하는 대신, 모듈 export surface 를 읽어 `toLegacyScoreRows` 가 **export 되지 않음**을 단언하는 drift guard 1 을 추가했다. 삭제로 cover 가 사라질 뻔한 negative 5 종(미도착 · 결손 `contributionScore=null` · 값역 밖 · 비유한 값 · 비객체 row)과 분기 3 종은 T-1729 · T-1730 describe 및 `assessmentScoreScale` colocated spec 에 각 1+ 로 잔존함을 확인했다. web 79 파일 2397 test · 루트 `pnpm lint` · `pnpm test:cov`(453 suite 13009 test) · `pnpm --dir web build`(tsc) 전량 green, `src/` diff 0 이라 backend coverage 불변.
- **review**: reviewer APPROVE round 1/7 → §3.3 4-게이트 충족 후 squash merge + branch delete. Nit 1 건(`deriveMetrics` 위 주석 줄바꿈 폭)은 의미 손상 0 이라 추가 commit 없이 종결.
