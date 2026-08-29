---
id: T-1789
title: DashboardView 시계열 축을 summaryRow 모듈 소비로 배선 (로컬 SummaryRow · deriveTrendPoints 철거)
phase: P6
status: DONE
prNumber: 1411
completedAt: 2026-08-29T19:59:46Z
commitMode: pr
coversReq: [REQ-075]
independentStream: web-dashboard-display-contract
dependsOn: [T-1788]
touchesFiles:
  - web/src/views/DashboardView.tsx
  - web/src/views/DashboardView.test.tsx
  - web/src/views/DashboardView.summaries-list-contract.test.ts
  - web/src/views/DashboardView.period-evaluation.test.tsx
estimatedDiff: 230
estimatedFiles: 4
created: 2026-08-30
plannerNote: P6 PLAN 131 행 ② 시계열 축 배선 — T-1788 Follow-up (a), R-112 backbone × 1.5 = 230 LOC, T-1727 배선 선례 동형
---

# T-1789 — DashboardView 시계열 축을 `summaryRow` 모듈 소비로 배선

## Why

오너 지시 [PLAN.md](../PLAN.md) `131 행` ② (표시 계약 정합 / [requirements.md](../requirements.md) `94 행` REQ-075) 의 시계열 축은 [T-1788](T-1788-summary-trend-row-module.md) 이 순수 모듈 [web/src/api/summaryRow.ts](../../web/src/api/summaryRow.ts) 를 박제하며 절반만 닫혔다 — **소비처가 0** 이라 실제 화면인 [DashboardView.tsx](../../web/src/views/DashboardView.tsx) 는 여전히 컨테이너-로컬 `SummaryRow{period,label,value,score}` 로 `GET /api/summaries` 응답을 읽는다. backend 가 돌려주는 실제 필드는 `metricScore` · `periodStart` · `narrative` 라서 **모든 시계열 포인트가 값 0 으로 렌더** 되고 라벨은 시점이 아니라 period 종류(`daily` 등) 로 찍힌다.

본 slice 가 그 배선을 수행해 시계열 축의 실데이터 렌더를 성립시킨다 — [T-1724](T-1724-assessment-display-row-mapper.md)(모듈) → [T-1727](T-1727-dashboardview-assessment-row-wire.md)(배선) 로 나뉜 표 축 선례의 동형 후반부다. `useApiResource<SummaryRow[]>` 를 `<unknown[]>` 로 낮추는 순간 그 타입 인자를 anchor 로 쓰던 **drift-guard spec 2 개가 함께 깨지므로** 같은 commit 에서 anchor 를 재지정한다 (T-1727 이 assessments 축에서 남긴 선례 — 무-alias 구조분해를 anchor 로 전환).

## Required Reading

- [web/src/api/summaryRow.ts](../../web/src/api/summaryRow.ts) — `SummaryDisplayRow`(`id` · `period` · `periodStart` · `label` · `value: number | null` · `narrative`) · `toSummaryDisplayRow` · `deriveSummaryDisplayRows(raw: unknown)` · `FALLBACK_TREND_LABEL` 계약. 값 결손은 `0` 위장 없이 `null`.
- [web/src/views/DashboardView.tsx](../../web/src/views/DashboardView.tsx) — `162~171 행`(로컬 `interface SummaryRow`) · `253~266 행`(`deriveTrendPoints`) · `545~551 행`(`useApiResource<SummaryRow[]>(summariesPath)`) · `633~634 행`(`trendPoints` useMemo) · 파일 말미 `export { ... }` / `export type { ... }` 목록. 그리고 T-1727 이 assessments 축에서 남긴 `538~541 행` 주석(응답을 컨테이너가 단정하지 않는다) — 같은 근거를 시계열 축에 승계한다.
- [web/src/components/TrendTimeSeriesPanel.tsx](../../web/src/components/TrendTimeSeriesPanel.tsx) `25~32 행` — 소비처 `TrendPoint { label: string; value: number }` 계약 (**수정 금지**).
- [web/src/views/DashboardView.test.tsx](../../web/src/views/DashboardView.test.tsx) — `23 행`(`deriveTrendPoints` import) · `30 행`(`import type { SummaryRow, ... }`) · `90 행`(`TREND_SAMPLE` fixture) · `398~415 행`(`deriveTrendPoints` 검사 블록).
- [web/src/views/DashboardView.summaries-list-contract.test.ts](../../web/src/views/DashboardView.summaries-list-contract.test.ts) `66~79 행`(`extractSummariesFireMethod` 의 `<SummaryRow[]>` anchor) · `286 행`(추출기 자체를 검사하는 문자열 fixture).
- [web/src/views/DashboardView.assessments-list-contract.test.ts](../../web/src/views/DashboardView.assessments-list-contract.test.ts) `74~92 행` — anchor 재지정 선례(구조분해 형태를 anchor 로 쓰는 방식). 본 task 에서 **수정하지 않는다**.
- [web/src/views/DashboardView.period-evaluation.test.tsx](../../web/src/views/DashboardView.period-evaluation.test.tsx) `525~528 행` — `useApiResource<SummaryRow[]>` 정적 anchor.

## Acceptance Criteria

- [x] `DashboardView.tsx` 의 컨테이너-로컬 `interface SummaryRow` 와 순수 함수 `deriveTrendPoints` 를 **삭제** 하고, 그 named export / type export 도 함께 걷어낸다. 동등 cover 는 [summaryRow.test.ts](../../web/src/api/summaryRow.test.ts) 에 이미 있으므로 그 test 를 옮겨 적지 않는다 (중복 재작성 금지).
- [x] 시계열 조회를 `useApiResource<unknown[]>(summariesPath)` 로 낮추고(컨테이너가 응답을 특정 행 타입으로 단정하지 않는다 — T-1727 근거 승계), 표시 행은 `deriveSummaryDisplayRows(trendData)` 로만 파생한다. alias 구조분해(`data: trendData` · `trendLoading` · `trendError` · `reload: trendReload`) 는 **그대로 유지** 한다 (형제 조회와의 상태 분리 · T-1737 재조회 배선 회귀 0).
- [x] 컨테이너에 순수 helper `toTrendPoints(rows: SummaryDisplayRow[]): TrendPoint[]` 를 신설·named export 하고 `trendPoints` useMemo 가 이것만 호출하게 한다. **`value === null` 행은 포인트에서 제외** 한다 (표본 없음 ≠ 0 점 — T-1727 `toLegacyScoreRows` · T-1730 집계 정책 승계). 제외 근거를 주석 1~2 줄로 박제한다. 배열이 아닌 입력도 throw 없이 빈 배열로 흡수한다.
- [x] `TrendTimeSeriesPanel` 에 내려보내는 props(`points` · `loading` · `error`) 의 형태·이름 불변 — 컴포넌트 파일 수정 0.
- [x] `deriveMetrics` · `deriveContributionScoreBuckets` · `pageRows` · `buildSummariesPath` · `buildAssessmentsPath` · `buildContributionsPath` · `derivePersonOptions` · `runPeriodEvaluation` 계열의 **시그니처·본문 불변** (이 경계가 본 task 를 4 파일로 묶는다).
- [x] drift-guard anchor 재지정 (같은 commit 필수 — 미동반 시 CI red):
  - [x] [DashboardView.summaries-list-contract.test.ts](../../web/src/views/DashboardView.summaries-list-contract.test.ts) 의 `extractSummariesFireMethod` anchor 를 `<SummaryRow[]>` 대신 **시계열 조회만 갖는 alias 구조분해**(예: `data: trendData` ~ `} = useApiResource<unknown[]>(...)`) 로 바꾸고, 형제 조회(assessments 무-alias · contributions/permission-denied 의 다른 alias)와 섞이지 않는 유일성을 주석으로 박제한다. `286 행` 의 추출기 자체 검사 fixture 문자열도 새 anchor 형태로 갱신한다.
  - [x] [DashboardView.period-evaluation.test.tsx](../../web/src/views/DashboardView.period-evaluation.test.tsx) `527 행` 의 정적 정규식을 `useApiResource<unknown[]>` 기준으로 갱신하되 `reload: trendReload` alias 검사 의미는 유지한다 (그 줄이 지워지면 여전히 fail).
  - [x] 두 spec 의 **test 개수·이름·다른 단언은 불변** — anchor 갱신 외의 확장 금지.
- [x] happy-path unit test 1+ ([DashboardView.test.tsx](../../web/src/views/DashboardView.test.tsx)) — backend 실응답 형태(`metricScore` Decimal 문자열 + `periodStart` ISO) fixture 로 마운트했을 때 시계열에 **날짜 라벨과 0 이 아닌 실제 값** 이 렌더됨 1+, `toTrendPoints` 정상 매핑 1+.
- [x] error path unit test 1+ — 시계열 조회 실패(error) · `data` 미도착(`undefined`) 시 throw 0 + 빈/오류 표시로 흡수 1+, `toTrendPoints(null as never)` 류 비정상 입력이 빈 배열 반환 + throw 0 1+.
- [x] 분기 cover — (a) `trendLoading=true` 분기, (b) 포인트 0 건 빈 상태 분기, (c) `value === null` 행이 섞인 배열에서 그 행만 제외되고 나머지는 유지, (d) `periodStart` 유효/무효 라벨 분기가 화면 라벨로 이어짐, (e) 기간 평가 성공 후 `trendReload` 재조회 경로 회귀 0 각 1+.
- [x] negative cases 충분 cover — 각 1+ test: (a) 배열이 아닌 응답(객체 · 문자열)에도 빈 시계열 + throw 0, (b) 옛 계약 row(`value`/`score` 만 존재)가 값 0 으로 위장되지 않고 **포인트에서 제외**, (c) 결손 row(`id` 부재 · 원소가 `null`)가 흡수되어 `'undefined'` · `'NaN'` 문자열이 화면에 새지 않음, (d) `metricScore: "abc"` 같은 비수치 문자열이 0 포인트를 만들지 않음, (e) `personId` 미선택 시 시계열 조회 미수행 가드 회귀 0.
- [x] `cd web && pnpm test` (vitest) 전량 green — 위 4 파일 외 web spec 은 **수정 없이** green (특히 [DashboardView.person-selector.test.tsx](../../web/src/views/DashboardView.person-selector.test.tsx) · [DashboardView.assessments-list-contract.test.ts](../../web/src/views/DashboardView.assessments-list-contract.test.ts) · [DashboardView.contributions-list-contract.test.ts](../../web/src/views/DashboardView.contributions-list-contract.test.ts)).
- [x] `cd web && pnpm build` 통과 (TypeScript 오류 0 — 옛 `SummaryRow` · `deriveTrendPoints` 잔존 참조 없음).
- [x] 루트 `pnpm lint && pnpm build && pnpm test` green, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [x] 새 외부 dependency 0 · `src/`(backend) 파일 변경 0 · `prisma/` 변경 0.

## Out of Scope

- 상세 패널 `ContributionRow` 축 정합 (backend `Contribution{contributionScore · difficulty · volume · sourceRef}` 재설계) — [T-1788](T-1788-summary-trend-row-module.md) Follow-up (b) 로 별도 slice.
- [TrendTimeSeriesPanel.tsx](../../web/src/components/TrendTimeSeriesPanel.tsx) 수정 (`TrendPoint` 계약은 소비만).
- [summaryRow.ts](../../web/src/api/summaryRow.ts) 본문 수정 — 배선 과정에서 부족이 보이면 Follow-ups 에 적고 본 task 에서 고치지 않는다.
- [requirements.md](../requirements.md) `93~96 행` REQ-074~077 재판정 · [PLAN.md](../PLAN.md) `131 행` 마커 승격 — doc-only direct task 로 분리 (T-1786/T-1787 패턴).
- 기간 지정 UI(REQ-077) · 인원 선택 UI(REQ-074) 관련 변경 일체.
- 주석에만 `SummaryRow` 를 언급하는 [assessments-list-contract.test.ts](../../web/src/views/DashboardView.assessments-list-contract.test.ts) · [contributions-list-contract.test.ts](../../web/src/views/DashboardView.contributions-list-contract.test.ts) 수정 (코드 anchor 아님 — 파일 수 상한 보호).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

## 완료 요약 (driver 기입)

- PR [#1411](https://github.com/myungjoo/Assessment-Agent/pull/1411) → main squash `fda06775` (2026-08-29T19:59:46Z).
- 4 파일 `+286/-61`. 컨테이너-로컬 `SummaryRow` · `deriveTrendPoints` 철거 → `useApiResource<unknown[]>` + `deriveSummaryDisplayRows` 소비로 배선, 순수 helper `toTrendPoints`(`value === null` 행 제외) 신설.
- drift-guard anchor 2 종(summaries-list-contract · period-evaluation) 같은 commit 재지정 — test 개수·이름 불변.
- reviewer round 2/7 APPROVE (round 1 의 Nit-1 은 §3 Nit-in-PR closure 로 같은 PR 에서 마감, follow-up task 생성 0). PR CI `5ba53b6b` success, 4-게이트 PASS.
- web vitest 2958 test / 루트 458 suite · 13208 test green, `test:cov` threshold 통과.
