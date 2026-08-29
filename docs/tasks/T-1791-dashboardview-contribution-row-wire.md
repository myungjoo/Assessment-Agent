---
id: T-1791
title: DashboardView 기여 상세 축을 contributionRow 모듈 소비로 배선 (로컬 ContributionRow · deriveContributionMetrics 철거)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-075, REQ-004]
estimatedDiff: 240
estimatedFiles: 3
created: 2026-08-30
independentStream: web-dashboard-display-contract
dependsOn: [T-1790]
touchesFiles:
  - web/src/views/DashboardView.tsx
  - web/src/views/DashboardView.test.tsx
  - web/src/views/DashboardView.contributions-list-contract.test.ts
plannerNote: "P6 PLAN 131 행 ② 기여 상세 축 배선 — T-1790 Follow-up (a), R-112 backbone × 1.5 = 240 LOC, T-1789 배선 선례 동형"
---

# T-1791 — DashboardView 기여 상세 축을 `contributionRow` 모듈 소비로 배선

## Why

오너 지시 [PLAN.md](../PLAN.md) `131 행` ② (표시 계약 정합 / [requirements.md](../requirements.md) `94 행` REQ-075, `23 행` REQ-004 의 "프런트 노출 축") 의 기여 상세 축은 [T-1790](T-1790-contribution-row-module.md) 이 순수 모듈 [web/src/api/contributionRow.ts](../../web/src/api/contributionRow.ts) 를 박제하며 절반만 닫혔다 — **소비처가 0** 이라 실제 화면인 [DashboardView.tsx](../../web/src/views/DashboardView.tsx) `186 행` 은 여전히 컨테이너-로컬 `ContributionRow{metricLabel,label,score,contribution,rationale,narrative}` 로 `GET /api/contributions` 응답을 읽는다. backend 가 돌려주는 실제 필드는 `sourceType` · `sourceRef` · `sourceUrl` · `difficulty` · `contributionScore`(Decimal) · `volume` 라서 겹치는 키가 `id` 하나뿐이고, 결과적으로 **모든 기여 항목이 라벨 "지표 미상" · 점수 0 · 근거 없음으로 렌더** 된다.

본 slice 가 그 배선을 수행해 기여 상세 축의 실데이터 렌더를 성립시킨다 — [T-1724](T-1724-assessment-display-row-mapper.md)(모듈) → [T-1727](T-1727-dashboardview-assessment-row-wire.md)(배선), [T-1788](T-1788-summary-trend-row-module.md)(모듈) → [T-1789](T-1789-dashboardview-summary-row-wire.md)(배선) 선례의 동형 후반부다. `useApiResource<ContributionRow[]>` 를 `<unknown[]>` 로 낮추는 순간 그 타입 인자를 anchor 로 쓰던 **drift-guard spec 1 개가 함께 깨지므로** 같은 commit 에서 anchor 를 재지정한다 (T-1727 · T-1789 선례 — alias 구조분해를 anchor 로 전환).

## Required Reading

- [web/src/api/contributionRow.ts](../../web/src/api/contributionRow.ts) — `ContributionDisplayRow`(`id` · `label` · `sourceType` · `sourceUrl` · `sourceRef` · `difficulty` · `score: number | null` · `volume: number | null`) · `toContributionLabel` · `toContributionDisplayRow` · `deriveContributionDisplayRows(raw: unknown)` · `FALLBACK_CONTRIBUTION_LABEL` 계약. 수치 결손은 `0` 위장 없이 `null`.
- [web/src/views/DashboardView.tsx](../../web/src/views/DashboardView.tsx) — `186~202 행`(로컬 `interface ContributionRow`) · `203 행`(`FALLBACK_METRIC_LABEL`) · `221~242 행`(`deriveContributionMetrics`) · `565~569 행`(`useApiResource<ContributionRow[]>(contributionsPath)`) · `656~659 행`(`contributionMetrics` useMemo) · 파일 말미 `export { ... }` / `export type { ... }` 목록. 그리고 T-1727/T-1789 가 남긴 "응답을 컨테이너가 특정 행 타입으로 단정하지 않는다" 주석 — 같은 근거를 기여 축에 승계한다.
- [web/src/views/DashboardView.tsx](../../web/src/views/DashboardView.tsx) `243~270 행`(`toTrendPoints`) — 본 task 가 신설할 표시 계층 helper 의 형태·주석 관례 기준 (**수정 금지**).
- [web/src/components/EvaluationDetailPanel.tsx](../../web/src/components/EvaluationDetailPanel.tsx) `28~42 행` — 소비처 `EvaluationMetricItem { id; label; score: number; maxScore?; rationale? }` 계약 (**수정 금지**).
- [web/src/views/DashboardView.test.tsx](../../web/src/views/DashboardView.test.tsx) — `25 행`(`deriveContributionMetrics` import) · `30 행`(`import type { ContributionRow }`) · `89 행`(`CONTRIBUTION_SAMPLE` fixture) · `760~805 행`(`deriveContributionMetrics` 검사 블록) · `1345~1358 행`(export surface guard 목록).
- [web/src/views/DashboardView.contributions-list-contract.test.ts](../../web/src/views/DashboardView.contributions-list-contract.test.ts) `66~79 행`(`extractContributionsFireMethod` 의 `<ContributionRow[]>` anchor) · `277 행`(추출기 자체를 검사하는 문자열 fixture).
- [web/src/views/DashboardView.assessments-list-contract.test.ts](../../web/src/views/DashboardView.assessments-list-contract.test.ts) `74~92 행` — anchor 재지정 선례(무-alias 구조분해를 anchor 로 쓰는 방식). 본 task 에서 **수정하지 않는다** (형제 anchor 유일성 판정 근거로만 읽는다).

## Acceptance Criteria

- [ ] `DashboardView.tsx` 의 컨테이너-로컬 `interface ContributionRow` · 상수 `FALLBACK_METRIC_LABEL` · 순수 함수 `deriveContributionMetrics` 를 **삭제** 하고, 그 named export / type export 도 함께 걷어낸다. 동등 cover 는 [contributionRow.test.ts](../../web/src/api/contributionRow.test.ts) 에 이미 있으므로 그 test 를 옮겨 적지 않는다 (중복 재작성 금지).
- [ ] 기여 조회를 `useApiResource<unknown[]>(contributionsPath)` 로 낮추고(컨테이너가 응답을 특정 행 타입으로 단정하지 않는다 — T-1727 · T-1789 근거 승계), 표시 행은 `deriveContributionDisplayRows(contributionData)` 로만 파생한다. alias 구조분해(`data: contributionData` · `contributionLoading` · `contributionError`) 는 **그대로 유지** 한다 (형제 조회와의 상태 분리).
- [ ] 컨테이너에 순수 helper `toContributionMetricItems(rows: ContributionDisplayRow[]): EvaluationMetricItem[]` 를 신설·named export 하고 `contributionMetrics` useMemo 가 이것만 호출하게 한다. 매핑 정책을 주석으로 박제한다:
  - `id` · `label` 은 표시 행 값을 그대로 쓴다(라벨 파생은 이미 `contributionRow.ts` 가 끝냈다 — 컨테이너 재파생 금지).
  - **`score === null` 행은 항목에서 제외** 한다 (표본 없음 ≠ 0 점 — [T-1789](T-1789-dashboardview-summary-row-wire.md) `toTrendPoints` · T-1727 · T-1730 정책 승계). 제외 근거를 주석 1~2 줄로 박제한다.
  - `maxScore` 는 **넘기지 않는다** (backend `Contribution` 에 만점 축이 없다 — 임의 분모 날조 금지).
  - `rationale` 은 `sourceUrl` 이 비어있지 않으면 그 값, 아니면 `undefined` (패널이 fallback 문구 표시). `Contribution` 에 정성 서술 축이 없다는 사실(narrative 는 `Assessment` 소관 — T-1790 Out of Scope 박제)을 주석으로 남긴다.
  - 배열이 아닌 입력도 throw 없이 빈 배열로 흡수한다.
- [ ] `EvaluationDetailPanel` 에 내려보내는 props(`metrics` · `loading` · `error` · `subjectName` · `periodLabel`) 의 형태·이름 불변 — 컴포넌트 파일 수정 0.
- [ ] `deriveMetrics` · `toTrendPoints` · `deriveContributionScoreBuckets` · `pageRows` · `buildContributionsPath` · `buildSummariesPath` · `buildAssessmentsPath` · `derivePersonOptions` · `runPeriodEvaluation` 계열의 **시그니처·본문 불변** (이 경계가 본 task 를 3 파일로 묶는다).
- [ ] drift-guard anchor 재지정 (같은 commit 필수 — 미동반 시 CI red): [DashboardView.contributions-list-contract.test.ts](../../web/src/views/DashboardView.contributions-list-contract.test.ts) 의 `extractContributionsFireMethod` anchor 를 `<ContributionRow[]>` 대신 **기여 조회만 갖는 alias 구조분해**(예: `data: contributionData` ~ `} = useApiResource<unknown[]>(...)`) 로 바꾸고, 형제 조회(assessments 무-alias · summaries 의 `trendData` alias · persons 의 `personsData` alias)와 섞이지 않는 유일성을 주석으로 박제한다. `277 행` 의 추출기 자체 검사 fixture 문자열도 새 anchor 형태로 갱신한다. **test 개수·이름·다른 단언은 불변** — anchor 갱신 외 확장 금지.
- [ ] happy-path unit test 1+ ([DashboardView.test.tsx](../../web/src/views/DashboardView.test.tsx)) — backend 실응답 형태(`sourceType` · `sourceRef` · `sourceUrl` · `contributionScore` Decimal 문자열 · `volume`) fixture 로 마운트했을 때 상세 패널에 **합성 라벨과 0 이 아닌 실제 점수** 가 렌더됨 1+, `toContributionMetricItems` 정상 매핑 1+.
- [ ] error path unit test 1+ — 기여 조회 실패(error) · `data` 미도착(`undefined`) 시 throw 0 + 빈/오류 표시로 흡수 1+, `toContributionMetricItems(null as never)` 류 비정상 입력이 빈 배열 반환 + throw 0 1+.
- [ ] 분기 cover — (a) `contributionLoading=true` 분기, (b) 항목 0 건 빈 상태 분기, (c) `score === null` 행이 섞인 배열에서 그 행만 제외되고 나머지는 유지, (d) `sourceUrl` 존재/부재에 따른 `rationale` 전달/미전달 2 분기, (e) 표 row 미선택 시 기여 조회 미수행 가드(`buildContributionsPath` → null) 회귀 0 각 1+.
- [ ] negative cases 충분 cover — 각 1+ test: (a) 배열이 아닌 응답(객체 · 문자열)에도 빈 항목 목록 + throw 0, (b) 옛 계약 row(`metricLabel`/`score`/`rationale` 만 존재)가 점수 0 으로 위장되지 않고 **항목에서 제외**, (c) 결손 row(`id` 부재 · 원소가 `null`)가 흡수되어 `'undefined'` · `'NaN'` 문자열이 화면에 새지 않음, (d) `contributionScore: ''` · `"abc"` 같은 비수치 값이 0 점 항목을 만들지 않음, (e) `sourceType` · `sourceRef` 둘 다 결손인 행이 `FALLBACK_CONTRIBUTION_LABEL` 로 표시되고 빈 라벨이 새지 않음.
- [ ] export surface guard(`DashboardView.test.tsx` `1345~1358 행`) 갱신 — `deriveContributionMetrics` 는 **없어야** 하고(옛 계약 재도입 = 값 0 위장 회귀 시 fail), `toContributionMetricItems` 는 **있어야** 한다. 나머지 helper 목록은 불변(과잉 삭제 차단).
- [ ] `cd web && pnpm test` (vitest) 전량 green — 위 3 파일 외 web spec 은 **수정 없이** green (특히 [DashboardView.person-selector.test.tsx](../../web/src/views/DashboardView.person-selector.test.tsx) · [DashboardView.assessments-list-contract.test.ts](../../web/src/views/DashboardView.assessments-list-contract.test.ts) · [DashboardView.summaries-list-contract.test.ts](../../web/src/views/DashboardView.summaries-list-contract.test.ts) · [DashboardView.permission-denied-records-list-contract.test.ts](../../web/src/views/DashboardView.permission-denied-records-list-contract.test.ts) · [DashboardView.period-evaluation.test.tsx](../../web/src/views/DashboardView.period-evaluation.test.tsx)).
- [ ] `cd web && pnpm build` 통과 (TypeScript 오류 0 — 옛 `ContributionRow` · `deriveContributionMetrics` 잔존 참조 없음).
- [ ] 루트 `pnpm lint && pnpm build && pnpm test` green, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] 새 외부 dependency 0 · `src/`(backend) 파일 변경 0 · `prisma/` 변경 0.

## Out of Scope

- [contributionRow.ts](../../web/src/api/contributionRow.ts) 본문 수정 — 모듈 계약은 T-1790 이 확정했다. 배선 중 부족이 보이면 본 task 의 Follow-ups 에 적고 다음 slice 로 넘긴다.
- [EvaluationDetailPanel.tsx](../../web/src/components/EvaluationDetailPanel.tsx) props 계약 변경 · `difficulty` · `volume` · `sourceUrl` 을 링크/배지로 표시하는 **패널 표시 확장** (별도 slice — 본 slice 는 기존 패널 계약 안에서 실데이터만 흘린다).
- 형제 drift-guard spec([DashboardView.assessments-list-contract.test.ts](../../web/src/views/DashboardView.assessments-list-contract.test.ts) `77 행` · [DashboardView.permission-denied-records-list-contract.test.ts](../../web/src/views/DashboardView.permission-denied-records-list-contract.test.ts) `84 행`) 의 `<ContributionRow[]>` 언급 **주석** 갱신 — 실행 anchor 가 아니라 fail 을 만들지 않는다. 파일 수 cap 보호를 위해 Follow-up 으로 미룬다.
- backend 변경 일체 — `Contribution` 응답에 정성 근거/만점 축을 더하는 계약 확장.
- [requirements.md](../requirements.md) REQ-004 · REQ-075 재판정 · [PLAN](../PLAN.md) `131 행` 마커 승격 — 4 축이 모두 닫힌 뒤 별도 doc-only slice.
- 새 외부 dependency 추가(§5 게이트).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (a) **REQ-004 · REQ-075 재판정 + [PLAN](../PLAN.md) `131 행` ② 축 closure** — 표 · 점수 분포 · 시계열 · 기여 4 축이 모두 배선까지 닫힌 뒤 doc-only slice 로.
- (b) **형제 drift-guard 주석 정리** — assessments · permission-denied contract spec 의 `<ContributionRow[]>` 언급 주석을 새 anchor 사실에 맞게 갱신 (다른 주석 정리와 묶어 1 slice).
- (c) **기여 상세 표시 확장** — `difficulty` · `volume` · `sourceUrl` 을 패널에 노출(링크 · 배지)하려면 `EvaluationMetricItem` 계약 확장이 선행돼야 한다 (컴포넌트 계약 변경이라 별도 slice).
