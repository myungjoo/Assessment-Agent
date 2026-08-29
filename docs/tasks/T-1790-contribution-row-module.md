---
id: T-1790
title: 기여 상세 표시 row 순수 모듈 contributionRow 신설
phase: P6
status: DONE
prNumber: 1412
completedAt: 2026-08-29T20:56:35Z
mergeCommit: 37a01e89
commitMode: pr
coversReq: [REQ-075, REQ-004]
estimatedDiff: 420
estimatedFiles: 2
created: 2026-08-29
independentStream: p6-dashboard-display-contract
dependsOn: []
touchesFiles:
  - web/src/api/contributionRow.ts
  - web/src/api/contributionRow.test.ts
sizeExempt: true
exemptReason: R-112 4 종 cover spec 이 강제하는 test LOC 이 본체의 약 2 배 — 선례 T-1724 · T-1728 · T-1788 과 동형 (본체 ~150 LOC · spec ~270 LOC, production 파일은 1 개).
plannerNote: "P6 오너 지시 PLAN 131 행 ② 표시 계약 정합(REQ-075) 의 기여 상세 축 — T-1788 Follow-up (b) 를 모듈 slice 로 절단"
---

# T-1790 — 기여 상세 표시 row 순수 모듈 contributionRow 신설

## Why

오너 지시 [PLAN](../PLAN.md) `131 행` 🔴 "대시보드 실동작 (R-175~R-178)" 의 **② 표시 계약 정합(REQ-075)** 중 남은 축은 상세 패널의 기여(Contribution) 행이다. 표 축([T-1724](T-1724-assessment-display-row-mapper.md)~[T-1727](T-1727-dashboardview-assessment-row-wire.md)) · 점수 분포 축([T-1728](T-1728-assessment-score-scale-module.md)~[T-1731](T-1731-dashboardview-legacy-score-bridge-removal.md)) · 시계열 축([T-1788](T-1788-summary-trend-row-module.md)~[T-1789](T-1789-dashboardview-summary-row-wire.md)) 은 닫혔지만, [DashboardView.tsx](../../web/src/views/DashboardView.tsx) `186 행` 의 컨테이너-로컬 `ContributionRow` 는 라벨을 `metricLabel` → `label`, 점수를 `score` → `contribution`, 근거를 `rationale` → `narrative` 순으로 읽는다. 그런데 `GET /api/contributions` 는 [contribution.controller.ts](../../src/user/contribution.controller.ts) `97~106 행` 이 Prisma row 를 그대로 반환하므로 실제 필드는 [schema.prisma](../../prisma/schema.prisma) `329~349 행` 의 `sourceType` · `sourceUrl` · `sourceRef` · `difficulty` · `contributionScore`(Decimal) · `volume` 이다 — 겹치는 키가 `id` 하나뿐이라 **모든 기여 항목이 라벨 "지표 미상" · 점수 0 · 근거 없음으로 렌더**된다.

본 slice 는 그 간극을 흡수하는 **순수 매핑 모듈만** 절단한다. 실제 소비 배선(DashboardView 의 로컬 `ContributionRow` · `deriveContributionMetrics` 철거)은 T-1724→T-1727 · T-1788→T-1789 선례대로 다음 slice 로 분리한다 — 모듈 + 배선 + drift-guard anchor 재지정을 한 slice 에 담으면 cap 을 넘긴다.

**오너 우선순위에 대한 메모** — [PLAN](../PLAN.md) `156 행` 의 🔴🔴 R-91 k6 부하검증(2026-07-30)보다 본 축은 늦게 내려온 오너 지시(2026-08-26, `131 행`)이며, R-91 chain 은 S1 16 회 · S2 6 회 · S3 5 회 baseline 실측이 회수된 상태(`147 행`)라 즉시 착수 대상 slice 가 남아 있지 않다(잔여 "실 수집 축" 은 실 GitHub/Confluence credential 이 필요해 §5 게이트 대상). 금지 상한인 "신규 R-92 per-route perf baseline slice"(`157 행`)는 본 task 가 건드리지 않는다.

## Required Reading

- [docs/tasks/T-1788-summary-trend-row-module.md](T-1788-summary-trend-row-module.md) — 직전 동형 모듈 slice 의 범위·계약 (본 task 의 형태 기준)
- [web/src/api/summaryRow.ts](../../web/src/api/summaryRow.ts) — 매핑 모듈 관례(키 목록 상수 · fallback 라벨 · 순수성 계약 주석)
- [web/src/api/assessmentRow.ts](../../web/src/api/assessmentRow.ts) `57~80 행` — 재사용할 `parseNumericField` (복제 금지)
- [web/src/views/DashboardView.tsx](../../web/src/views/DashboardView.tsx) `180~245 행` — 현행 로컬 `ContributionRow` · `deriveContributionMetrics` (본 task 는 읽기만, 수정 금지)
- [web/src/components/EvaluationDetailPanel.tsx](../../web/src/components/EvaluationDetailPanel.tsx) `31~42 행` — 소비처 `EvaluationMetricItem` 계약(축 이름 정합 기준)
- [prisma/schema.prisma](../../prisma/schema.prisma) `329~349 행` — backend `model Contribution` 실 필드(권위 계약)
- [src/user/contribution.controller.ts](../../src/user/contribution.controller.ts) `97~118 행` — `GET /api/contributions` 가 Prisma row 를 그대로 반환함의 근거

## Acceptance Criteria

- [ ] `web/src/api/contributionRow.ts` 신설. 다음을 export 한다:
  - `ContributionDisplayRow` interface — `id` · `label` · `sourceType` · `sourceUrl` · `sourceRef` · `difficulty` · `score`(`number | null`) · `volume`(`number | null`) 축을 갖는다. **점수는 결손 시 0 으로 위장하지 않고 `null`** 로 남긴다(T-1788 `value` 정책 승계 — 값 없음 ≠ 0 점).
  - `CONTRIBUTION_DISPLAY_ROW_KEYS` — 위 interface 키 목록 상수(drift guard 용, 선언 순서 = interface 순서).
  - `FALLBACK_CONTRIBUTION_LABEL` — 라벨 파생 실패 시 fallback 문자열(예: `'기여 미상'`).
  - `toContributionLabel(sourceType: unknown, sourceRef: unknown): string` — `sourceType` 과 `sourceRef` 를 사람이 읽을 수 있는 한 줄 라벨로 합성. 한쪽만 있으면 그 한쪽, 둘 다 결손이면 `FALLBACK_CONTRIBUTION_LABEL`.
  - `toContributionDisplayRow(raw: unknown, index: number): ContributionDisplayRow | null` — 단일 row 매핑. `id` 결손 시 index 기반 합성 key(`c{index+1}`) 사용.
  - `deriveContributionDisplayRows(raw: unknown): ContributionDisplayRow[]` — 배열 입력 매핑. 비배열 입력은 빈 배열.
- [ ] 수치 파싱은 [assessmentRow.ts](../../web/src/api/assessmentRow.ts) 의 `parseNumericField` 를 **import 재사용** — 동일 로직 복제 0 (`contributionScore` 는 Prisma `Decimal` 이라 JSON 직렬화 후 문자열로 도착할 수 있음을 주석으로 박제).
- [ ] 순수성 계약 준수 — `fetch` · React · `useApiResource` import 0, module-level 가변 상태 0, throw 0, 입력 객체 mutation 0. 근거를 파일 상단 주석에 한국어로 박제.
- [ ] colocated spec `web/src/api/contributionRow.test.ts` 를 신설하고 R-112 4 종을 모두 덮는다:
  - [ ] happy-path — 실제 backend row 형태(`sourceType` · `sourceRef` · `contributionScore` 문자열 Decimal · `volume`)를 넣어 라벨·점수·부가 축이 기대대로 매핑되는지 1+ 케이스.
  - [ ] error path — 손상 입력(`null` · `undefined` · 원시값 · `Object.freeze` 된 객체 · 배열 아닌 값)에서 throw 없이 값으로 흡수되는지 각 1+ 케이스.
  - [ ] 분기 cover — `toContributionLabel` 의 4 분기(둘 다 존재 / `sourceType` 만 / `sourceRef` 만 / 둘 다 결손), `id` 존재/결손 2 분기, 점수 파싱 성공/실패 2 분기 각 1+ 케이스.
  - [ ] negative cases 충분 cover — 빈 문자열 라벨 후보, 공백만 있는 문자열, `contributionScore: ''`(빈 문자열 → `Number('')===0` 함정), 비수치 문자열, `boolean`/`null` 수치 축, 결손 row 가 섞인 배열, `volume` 결손 각 1+ 케이스.
  - [ ] `CONTRIBUTION_DISPLAY_ROW_KEYS` 와 실제 매핑 결과의 `Object.keys` 가 일치하는 drift guard 케이스 1+.
- [ ] `pnpm --dir web test` (web vitest) 전량 green.
- [ ] 루트 `pnpm lint && pnpm build && pnpm test` 및 `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% threshold 유지).

## Out of Scope

- [DashboardView.tsx](../../web/src/views/DashboardView.tsx) 수정 일체 — 로컬 `ContributionRow` · `deriveContributionMetrics` 철거와 소비 배선은 **다음 slice**(T-1789 선례). 본 slice 는 소비처 0 인 모듈만 박제한다.
- [EvaluationDetailPanel.tsx](../../web/src/components/EvaluationDetailPanel.tsx) 의 props 계약 변경.
- backend 변경 일체 — `Contribution` 응답에 `rationale`/`narrative` 축을 추가하는 계약 확장은 별도 결정(정성 근거는 `Assessment.narrative` 소관).
- `docs/requirements.md` REQ-074~077 재판정 · [PLAN](../PLAN.md) `131 행` 마커 승격 — 축 전체가 닫힌 뒤 별도 doc-only slice.
- 새 외부 dependency 추가(§5 게이트).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (a) **DashboardView 배선** — 로컬 `ContributionRow` · `deriveContributionMetrics` 를 철거하고 본 모듈 소비로 전환 ([T-1789](T-1789-dashboardview-summary-row-wire.md) 선례 동형). 그때 `c{index+1}` 합성 key 가 [EvaluationDetailPanel](../../web/src/components/EvaluationDetailPanel.tsx) 의 `EvaluationMetricItem.id` 와 맞물리는지 확인한다.
- (b) **REQ-074~077 재판정 + [PLAN](../PLAN.md) `131 행` 마커 승격** — 표 · 점수 분포 · 시계열 · 기여 4 축이 모두 배선까지 닫힌 뒤 doc-only slice 로.

## 결과 (2026-08-29)

**DONE** — PR [#1412](https://github.com/myungjoo/Assessment-Agent/pull/1412) → main squash `37a01e89` (2 파일 `+417/-0`).

- [contributionRow.ts](../../web/src/api/contributionRow.ts) 166 LOC 신설 — `sourceType` · `sourceRef` 합성 라벨 4 분기, `id` 결손 시 `c{index+1}` 합성 key, 수치는 [assessmentRow.ts](../../web/src/api/assessmentRow.ts) 의 `parseNumericField` import 재사용(복제 0), 결손은 0 위장 없이 `null` 유지.
- colocated spec 251 LOC / 29 케이스로 R-112 4 종 cover — web vitest 104 files / 2987 tests, 루트 458 suite / 13208 test, `test:cov` threshold 전부 green.
- 4-게이트 PASS — reviewer APPROVE round 1/7 (finding 0), PR comment 외부 post `5464819978`, PR CI `9a80ca12` success, integrator 자체 점검.
