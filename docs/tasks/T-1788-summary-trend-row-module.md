---
id: T-1788
title: 시계열 요약 표시 row 순수 모듈 summaryRow 신설 (backend Summary 계약 정합)
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-075]
independentStream: web-dashboard-display-contract
dependsOn: []
touchesFiles:
  - web/src/api/summaryRow.ts
  - web/src/api/summaryRow.test.ts
estimatedDiff: 380
estimatedFiles: 2
sizeExempt: true
exemptReason: production 순증은 ≤ 130 LOC (mapper 1 모듈) 이고 초과분은 전부 R-112 강제 colocated spec — 동형 선례 T-1724(assessmentRow 124+269) · T-1728(contribution-score-scale) 승계.
created: 2026-08-29
plannerNote: cap-bend pre-justified — P6 PLAN 131 행 ② 표시 계약 정합의 시계열 축, R-112 backbone × 1.5 = 380 LOC, T-1724 패턴 정당화
---

# T-1788 — 시계열 요약 표시 row 순수 모듈 `summaryRow` 신설 (backend Summary 계약 정합)

## Why

오너 지시 [PLAN.md](../PLAN.md) `131 행` ② (표시 계약 정합 / REQ-075) 는 "평가 결과 표시(테이블 · 상세 패널 · **점수 분포** · **시계열**)가 backend 응답 필드와 계약 일치 + 실데이터 렌더 검증" 을 요구한다. 표 축([T-1724](T-1724-assessment-display-row-mapper.md)~[T-1727](T-1727-dashboardview-assessment-row-wire.md)) 과 점수 분포 · 요약 카드 축([T-1728](T-1728-contribution-score-scale-module.md)~[T-1731](T-1731-dashboard-remove-legacy-score-bridge.md)) 은 닫혔지만 **시계열 축은 아직 불일치** 다 — [DashboardView.tsx](../../web/src/views/DashboardView.tsx) 의 컨테이너-로컬 `SummaryRow` 는 값 후보를 `value` → `score` 순으로 읽는데, `GET /api/summaries` 가 돌려주는 Prisma `Summary` row 의 실제 필드는 `metricScore`(Decimal) · `periodStart`(DateTime) · `narrative` 라서 **모든 시계열 포인트가 값 0 으로 렌더** 되고 라벨은 시점이 아니라 period 종류(`daily` 등) 로 찍힌다.

본 slice 는 그 정합의 **순수 모듈 축만** 절단한다 — backend Summary row → 시계열 표시 row 매핑 함수와 colocated spec 을 신설한다. `DashboardView` 배선(로컬 `SummaryRow` · `deriveTrendPoints` 철거)은 다음 slice 로 미룬다: 배선까지 한 slice 에 담으면 컨테이너 spec 회귀분까지 얹혀 파일 · LOC 이 함께 불어나기 때문이며, 이는 표 축이 [T-1724](T-1724-assessment-display-row-mapper.md)(모듈) → [T-1727](T-1727-dashboardview-assessment-row-wire.md)(배선) 로 나뉜 선례와 동형이다.

## Required Reading

- [docs/PLAN.md](../PLAN.md) `131 행` — 오너 지시 원문(② 표시 계약 정합 축).
- [docs/requirements.md](../requirements.md) `94 행` — REQ-075 row (요약 · 검증 위치 · 상태).
- [web/src/api/assessmentRow.ts](../../web/src/api/assessmentRow.ts) — 동형 선례 mapper. 특히 `parseNumericField` (Decimal-as-string 흡수) 와 `toAssessmentDisplayRow` 의 `null` 반환 규약을 **재사용/승계** 한다.
- [web/src/api/assessmentRow.test.ts](../../web/src/api/assessmentRow.test.ts) — spec 구조(describe 분할 · negative 열거) 참고.
- [web/src/views/DashboardView.tsx](../../web/src/views/DashboardView.tsx) `162~180 행`(로컬 `SummaryRow`) · `250~262 행`(`deriveTrendPoints`) — 대체 대상 계약(본 slice 에서는 **읽기만**, 수정 금지).
- [web/src/components/TrendTimeSeriesPanel.tsx](../../web/src/components/TrendTimeSeriesPanel.tsx) `25~32 행` — 소비처 `TrendPoint { label: string; value: number }` 계약.
- [prisma/schema.prisma](../../prisma/schema.prisma) `model Summary` — 권위 필드(`id` · `personId` · `period` · `periodStart` · `narrative` · `metricScore` · `createdAt`).
- [docs/architecture/api.md](../architecture/api.md) `116 행` — `GET /api/summaries?personId=&period=` 응답 계약.

## Acceptance Criteria

- [x] `web/src/api/summaryRow.ts` 신설. 최소 다음을 named export 한다.
  - [x] `SummaryDisplayRow` 타입 — `id` · `period` · `periodStart` · `label`(표시용 시점) · `value: number | null`(metricScore) · `narrative` 를 갖는다. 값 결손은 `0` 으로 위장하지 않고 `null` 로 남긴다 (요약 카드 축의 "표본 없음 ≠ 평균 0" 정책 승계).
  - [x] `toSummaryDisplayRow(raw: unknown): SummaryDisplayRow | null` — 객체가 아니거나 `id` 가 빈 문자열/비문자열이면 `null`.
  - [x] `deriveSummaryDisplayRows(raw: unknown): SummaryDisplayRow[]` — 비배열 입력은 빈 배열로 흡수하고, `null` 매핑 row 는 제외한다 (throw 금지).
- [x] `metricScore` 는 [assessmentRow.ts](../../web/src/api/assessmentRow.ts) 의 `parseNumericField` 를 **import 해서** 해석한다 (숫자 · `"2.5"` 문자열 Decimal 모두 흡수). 파싱 로직을 새로 복제하지 않는다.
- [x] 시점 라벨은 `periodStart` 에서 파생한다 — ISO 문자열의 날짜 부분(`YYYY-MM-DD`) 을 라벨로 쓰고, `periodStart` 가 없거나 형식이 어긋나면 원문 → `period` 순으로 fallback 하며 마지막에도 없으면 빈 문자열이 아니라 결정적 fallback 라벨을 준다. `period` 종류값(`daily` 등) 을 시점 라벨로 **우선** 채택하지 않는다.
- [x] colocated spec `web/src/api/summaryRow.test.ts` 신설. R-112 4 종을 모두 덮는다.
  - [x] happy-path 1+ — 실제 `GET /api/summaries` 응답 형태(`metricScore` Decimal 문자열 + `periodStart` ISO) 배열이 `TrendPoint` 로 그대로 쓸 수 있는 라벨 · 값으로 매핑됨.
  - [x] error path 1+ — `metricScore` 누락 · `null` · `"abc"` 같은 비수치 문자열 · `NaN` 에서 throw 없이 `value === null`.
  - [x] 분기별 1+ — `id` 누락/빈 문자열 → `null`, `periodStart` 유효/무효/부재 3 분기, `narrative` 부재 fallback, 배열/비배열 분기.
  - [x] negative cases 충분 cover — `null` · `undefined` · 문자열 · 숫자 원소, 빈 배열, 원소가 객체 아님, 알 수 없는 추가 필드 존재, 옛 계약(`value` · `score` 만 있는 row) 이 값 0 으로 위장되지 않음(= `null`) 각 1+.
- [x] `pnpm --dir web test` (또는 repo 규약 명령) 로 web spec 전량 green.
- [x] 루트 `pnpm lint && pnpm build && pnpm test` green, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [x] 새 외부 dependency 0 · backend 파일 변경 0.

## Out of Scope

- `web/src/views/DashboardView.tsx` 배선 (로컬 `SummaryRow` · `deriveTrendPoints` 철거 및 신모듈 소비) — 다음 slice.
- `TrendTimeSeriesPanel.tsx` 수정 (`TrendPoint` 계약은 그대로 소비만 한다).
- 상세 패널 축(`ContributionRow` ↔ backend `Contribution{contributionScore, difficulty, volume}` 불일치) 정합 — 별도 slice.
- backend DTO/응답 shape 변경, `GET /api/summaries` 계약 변경, Prisma schema 변경.
- [docs/requirements.md](../requirements.md) REQ-074~077 재판정 및 [PLAN.md](../PLAN.md) `131 행` 마커 승격 (chain 종료 후 doc slice 소관).
- 시계열 정렬 · 기간 필터 · 전기 대비 delta 등 새 표시 기능 추가.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (a) `DashboardView` 배선 slice — 로컬 `SummaryRow`/`deriveTrendPoints` 를 신모듈 소비로 교체하고, `value === null` row 의 표시 정책(제외 vs 표기) 을 컨테이너 spec 으로 고정.
- (b) 상세 패널 축 정합 slice — `ContributionRow` 를 backend `Contribution{contributionScore · difficulty · volume · sourceRef}` 계약으로 재설계 (현재 `metricLabel`/`score`/`rationale` 후보가 실 응답에 없어 "지표 미상 · 0 점" 렌더).
- (c) 위 (a)(b) 종료 후 [docs/requirements.md](../requirements.md) `93~96 행` REQ-074~077 재판정 + [PLAN.md](../PLAN.md) `131 행` 마커 승격 (T-1786/T-1787 패턴).

## Result (2026-08-29 완료)

- **DONE** — PR [#1410](https://github.com/myungjoo/Assessment-Agent/pull/1410) squash merge `e117638a`. reviewer round 1/7 `VERDICT: APPROVE`, PR comment 외부 post 확인, PR CI `c3c2324d` success → 4-게이트 PASS.
- 신설 파일 2 개: `web/src/api/summaryRow.ts` (`SummaryDisplayRow` · `toSummaryDisplayRow` · `deriveSummaryDisplayRows`) + colocated spec `web/src/api/summaryRow.test.ts` (+434/-0).
- `metricScore` 는 [assessmentRow.ts](../../web/src/api/assessmentRow.ts) 의 `parseNumericField` 를 import 재사용해 Decimal-as-string 을 흡수했다 (로직 복제 0). 라벨은 `periodStart` ISO 날짜 → 원문 → `period` → 결정적 fallback 순으로 파생해 period 종류값이 시점 라벨로 새는 경로를 막았고, 값 결손은 0 위장 없이 `null` 로 남긴다.
- R-112 4 종 41 케이스 cover — web vitest 103 파일 / 2948 test green, 루트 lint · build · test(458 suite / 13208 test) · test:cov(line 99.94% · function 100%) green. 새 외부 dependency 0, backend 파일 변경 0.
- Out of Scope 는 그대로 남는다 — `DashboardView` 배선은 Follow-up (a), 상세 패널 `ContributionRow` 정합은 (b), REQ-074~077 재판정 + PLAN `131 행` 마커 승격은 (c).

