---
id: T-1729
title: DashboardView 점수 분포 축을 실 contributionScore 스케일(0–3) 집계로 교체
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-076]
independentStream: p6-dashboard-actual-behavior
dependsOn: [T-1727, T-1728]
touchesFiles:
  - web/src/views/DashboardView.tsx
  - web/src/views/DashboardView.test.tsx
estimatedDiff: 235
estimatedFiles: 2
created: 2026-08-27
plannerNote: P6 오너지시 PLAN 131행 ③ 분해 slice 4b-1 — T-1728 순수 모듈을 분포 축에만 배선(요약 지표·브리지 제거는 4b-2)
---

# T-1729 — DashboardView 점수 분포 축을 실 contributionScore 스케일(0–3) 집계로 교체

## Why

[PLAN.md](../PLAN.md) `131 행` 🔴 오너 지시 ③ ([requirements.md](../requirements.md) `95 행` REQ-076 — "점수 분포 등 시각화의 축·구간을 실제 metricScore 스케일에 맞춤, 0–100 임의 가정 금지") 분해 slice **4b-1** 이다. 직전 T-1728 이 실 스케일 집계 순수 모듈 [assessmentScoreScale.ts](../../web/src/api/assessmentScoreScale.ts) 를 신설했지만 **아직 아무 화면도 그것을 쓰지 않는다** — 배선 전까지 REQ-076 은 미충족이다.

현행 실측 (main `91fa397a`): [DashboardView.tsx](../../web/src/views/DashboardView.tsx) `160~166 행` 의 `BUCKET_EDGES` 가 `0–20 / 20–40 / 40–60 / 60–80 / 80–100` 5 구간이고 `266~292 행` `deriveScoreBuckets` 가 점수를 `0~100` 으로 clamp 한다. 실제 `contributionScore` 값역은 `[0, 3]` 이라 **모든 행이 첫 bucket `0–20` 에 몰려** 분포 차트가 항상 단일 막대가 된다. 본 slice 는 그 축을 `deriveContributionScoreBuckets` (폭 0.5 6 등분) 로 교체해 분포를 실제로 동작시킨다.

**분포 축만** 다루고 요약 지표(`deriveMetrics`)·임시 브리지(`toLegacyScoreRows`)·요약 카드 만점 표기는 건드리지 않는다 — 809 행 컨테이너와 1275 행 spec 을 한 commit 에 몰면 §3 크기 상한(300 LOC / 5 파일)을 넘기 때문이며, 잔여는 slice 4b-2 가 이어받는다.

## Required Reading

- [web/src/api/assessmentScoreScale.ts](../../web/src/api/assessmentScoreScale.ts) — 본 slice 가 배선할 대상. `deriveContributionScoreBuckets(rows: AssessmentDisplayRow[]): ScoreBucket[]` 시그니처, `CONTRIBUTION_SCORE_BUCKET_EDGES` 6 구간 라벨(`0–0.5` · `0.5–1` · `1–1.5` · `1.5–2` · `2–2.5` · `2.5–3`), 집계 대상 0 건이면 **빈 배열**(막대 0 개), `null`·비유한 값 행은 **집계 제외**(0 점 위장 금지), 범위 밖 값은 끝 bucket clamp.
- [web/src/views/DashboardView.tsx](../../web/src/views/DashboardView.tsx) — `156~166 행` (`BUCKET_EDGES` 주석 포함, **삭제 대상**) · `259~292 행` (`deriveScoreBuckets`, **삭제 대상**) · `567~571 행` (`scoreBuckets` useMemo, **교체 대상**) · `733~741 행` (`<ScoreDistributionChart buckets={scoreBuckets} …>` 배선부) · `795~808 행` (export 목록). `37~38 행` 의 `ScoreDistributionChart` 값/타입 import 도 확인 — 타입 import 가 미사용이 되면 함께 정리한다.
- [web/src/components/ScoreDistributionChart.tsx](../../web/src/components/ScoreDistributionChart.tsx) `23~31 행` — `ScoreDistributionBucket`(`id`·`label`·`count`) 소비 형태. **이 컴포넌트는 수정하지 않는다** (구조 호환이므로 prop 타입 변경 불요).
- [web/src/views/DashboardView.test.tsx](../../web/src/views/DashboardView.test.tsx) — `95~131 행` (`RAW_SAMPLE`, `contributionScore` 가 80/95/60 인 비현실 fixture — 교정 대상) · `256~272 행`·`283 행`·`320 행`·`549 행` (분포 라벨 기대값) · `385~424 행` (`deriveScoreBuckets` 순수 helper test 3 개, **삭제 대상**) · `167 행` (`<td>95</td>` 표 렌더 기대값). colocated spec 위치는 기존 그대로 `web/src/views/DashboardView.test.tsx` 다 (신규 파일 만들지 않는다).
- [web/src/api/assessmentRow.ts](../../web/src/api/assessmentRow.ts) — `AssessmentDisplayRow` 9 키와 숫자 축 `null` 정책(값 없음 ≠ 0 점).

## Acceptance Criteria

- [ ] `DashboardView.tsx` 의 `scoreBuckets` 파생이 `deriveContributionScoreBuckets(visibleRows)` 를 호출한다 — `legacyScoreRows` 를 경유하지 않는다 (useMemo 의존 배열도 `visibleRows` 로 교체).
- [ ] `BUCKET_EDGES` 상수와 `deriveScoreBuckets` 함수가 `DashboardView.tsx` 에서 **삭제** 되고 `export {}` 목록에서도 `deriveScoreBuckets` 가 빠진다. 파일 안에 `0–20`·`80–100`·`Math.min(100,` 같은 0–100 가정 잔재가 남지 않는다 (`grep -n "80–100\|0–20" web/src/views/DashboardView.tsx` 결과 0 줄).
- [ ] `RAW_SAMPLE` 의 `contributionScore` 가 실 스케일 값(예 `2.5` / `3` / `1.2`)으로 교정되고, 그에 맞춰 표 렌더·분포 라벨을 기대하는 기존 assertion 이 함께 갱신돼 전부 green.
- [ ] happy-path test 1+ — assessments 응답이 있을 때 `점수 분포` 차트가 실 스케일 라벨(예 `2.5–3`·`1–1.5`)로 렌더되고 각 bucket count 가 fixture 와 일치한다 (`renderToStaticMarkup` 정적 렌더).
- [ ] error path test 1+ — assessments 조회가 error 인 분기에서 분포 차트가 throw 없이 에러/빈 상태를 렌더한다 (기존 상태 분리 test 와 정합).
- [ ] 분기 cover — (a) `personId` 미선택(조회 미수행) → 분포 패널 미렌더, (b) 응답 row 는 있으나 전 행 `contributionScore` 가 `null` → 빈 bucket 배열(막대 0 개), (c) 정상 row 혼재 → 값 있는 행만 집계. 각 1+ test.
- [ ] negative cases 충분 cover — ① `data` 미도착(`undefined`) ② 비배열/결손 row 혼입 ③ 범위 밖 값(음수·`3` 초과)이 끝 bucket 으로 귀속되어 누락 0 ④ `NaN`·문자열 등 비유한 값 행이 첫 bucket 을 부풀리지 않음. 각 1+ test.
- [ ] 0–100 회귀 drift guard test 1+ — 렌더 결과 HTML 에 `80–100`·`0–20` 라벨이 **없음** 을 단언해, 옛 축으로 되돌아가면 fail 한다.
- [ ] 삭제된 `deriveScoreBuckets` 를 대상으로 하던 순수 helper test 3 개(`385~424 행`)가 제거되고 남은 import 도 정리돼 `pnpm --dir web build` (tsc) 가 통과한다.
- [ ] `pnpm --dir web test` (vitest) 전량 green, 루트 `pnpm lint` 통과, 루트 `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — `src/` diff 0 이므로 backend coverage 불변임을 확인).
- [ ] `git diff --stat` 기준 변경 파일이 위 2 개뿐이다 (`web/src/api/*`·`web/src/components/*`·`src/`·`prisma/`·`package.json` diff 0, 새 dependency 0).

## Out of Scope

- `deriveMetrics` · `toLegacyScoreRows` 제거와 요약 카드 만점 표기(`평균 점수 N 점` → `N / 3 점`) 교정 — slice 4b-2 가 이어받는다. 본 slice 에서 두 함수와 `legacyScoreRows` memo 는 **그대로 둔다**.
- `ScoreDistributionChart.tsx` 등 `web/src/components/*` 수정 (구조 호환이라 불필요 — ADR-0041 Decision 1 의 "presentational 은 fetch 를 모른다" 경계 유지).
- `assessmentScoreScale.ts` 본문·시그니처 변경 (T-1728 에서 확정 — 배선 편의를 위한 수정 금지, 필요하면 Follow-ups 에 기록).
- backend(`src/`) · `prisma/` · 새 endpoint · 서버측 aggregation 도입 (ADR-0040 §1 client-side 파생 유지).
- 기간 지정 UI(④) · 인원 선택 UI(①) · 표시 계약(②) 등 PLAN `131 행` 의 다른 축.
- `RAW_SAMPLE` 외 fixture 의 대량 재작성 · 무관한 describe 블록 정리.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
