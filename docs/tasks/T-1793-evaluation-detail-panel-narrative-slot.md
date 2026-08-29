---
id: T-1793
title: EvaluationDetailPanel 에 평가 정성 서술(narrative) optional 표시 슬롯 추가
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-075]
estimatedDiff: 180
estimatedFiles: 2
created: 2026-08-30
completed: 2026-08-29T23:51:43Z
prNumber: 1414
independentStream: p6-display-contract-narrative
dependsOn: []
touchesFiles:
  - web/src/components/EvaluationDetailPanel.tsx
  - web/src/components/EvaluationDetailPanel.test.tsx
plannerNote: P6 PLAN 131 행 ② 표시 계약 정합 — REQ-075 잔여 narrative 축의 앞부분(패널 슬롯만, 배선은 후속)
---

# T-1793 — EvaluationDetailPanel 에 평가 정성 서술(narrative) optional 표시 슬롯 추가

## Why

[PLAN.md](../PLAN.md) `131 행` 오너 지시 ② "표시 계약 정합" 의 잔여 1 개를 여는 slice 다. [T-1792](T-1792-requirements-req075-display-contract-rejudge.md) 가 [requirements.md](../requirements.md) `94 행` REQ-075 를 `IN_PROGRESS` 로 재판정하면서, 4 축(표 · 점수 분포 · 시계열 · 기여 상세) 배선이 전량 머지됐는데도 REQ 문언이 열거한 backend 필드 5 종 중 **`narrative` 만 어느 화면에도 닿지 않는다** 는 점을 유일한 미충족 근거로 못박았다. 표 축은 [AssessmentResultTable.tsx](../../web/src/components/AssessmentResultTable.tsx) `15 행` 이 "장문 서술이라 표 셀에 넣으면 행 높이가 무너진다. **상세 패널 축이다**" 로 스스로 이 축을 상세 패널에 넘겼는데, 정작 [EvaluationDetailPanel.tsx](../../web/src/components/EvaluationDetailPanel.tsx) 에는 평가 전체 수준의 서술을 받을 자리가 없다 — `EvaluationMetricItem.rationale` 은 지표 1 개당 근거라 `Assessment.narrative`(평가 1 건 전체 서술) 를 담을 수 없다.

DashboardView 배선까지 한 slice 에 담으면 컨테이너 선택 row 파생 + props 조립 + drift-guard spec 까지 얹혀 cap 초과가 확실하므로, [T-1774](T-1774-service-identity-list-row-actions-slot.md) → [T-1777](T-1777-service-identity-row-actions-mount.md) 선례대로 **하위 호환 optional slot 만 먼저 절단**한다. 컴포넌트는 fetch 를 모르는 순수 presentational 이라는 [ADR-0041](../decisions/ADR-0041-frontend-composition-wiring.md) `§Decision 1` 경계도 그대로 지킨다.

## Required Reading

- [web/src/components/EvaluationDetailPanel.tsx](../../web/src/components/EvaluationDetailPanel.tsx) — 본 task 의 변경 대상. 파일 상단 주석의 presentational 계약, `LOADING_TEXT` / `DEFAULT_*` 상수 convention, loading → error → 빈 목록 → 정상 4 분기 순서를 그대로 따른다.
- [web/src/components/EvaluationDetailPanel.test.tsx](../../web/src/components/EvaluationDetailPanel.test.tsx) — 기존 colocated spec. 본 task 의 새 test 는 **이 파일에 추가**한다 (새 spec 파일 신설 금지).
- [web/src/api/assessmentRow.ts](../../web/src/api/assessmentRow.ts) `27 행` · `101 행` — `narrative: string` 선언과 `toDisplayString` 매핑. 후속 배선 slice 가 이 값을 넘길 예정이므로 **문자열 1 개** 라는 타입 전제를 확인만 한다 (본 task 에서 import 하지 않는다).
- [web/src/components/AssessmentResultTable.tsx](../../web/src/components/AssessmentResultTable.tsx) `15 행` — narrative 를 표에서 제외하고 상세 패널로 넘긴 근거 주석.
- [docs/requirements.md](../requirements.md) `94 행` REQ-075 — 잔여 `narrative` 미표시 판정 본문.

## Acceptance Criteria

- [ ] `EvaluationDetailPanelProps` 에 optional 필드 `narrative?: string` 을 추가하고, 무엇을 담는 축인지(평가 1 건 전체의 LLM 정성 서술 — 지표별 `rationale` 과 다른 축) 를 한국어 주석으로 명시한다.
- [ ] narrative 가 truthy 이면 평가 대상 · 기간 헤더 아래에 plain text 로 렌더한다. 마크다운/리치 텍스트 렌더러 · 새 dependency 도입 0 ([ADR-0040](../decisions/ADR-0040-frontend-stack.md) `§5` 승계 — 컴포넌트 상단 주석이 인용하는 그 조항). 스크린리더 식별을 위해 서술 영역에 한국어 라벨(예: `aria-label="평가 정성 서술"`)을 부여한다.
- [ ] **빈 목록 분기에서도 렌더한다** — narrative 는 평가 전체 축이라 metric 항목이 0 개여도 표시돼야 한다. 즉 기존 `items.length === 0` early return 경로와 정상 경로 **양쪽** 에 서술 영역이 들어간다.
- [ ] loading · error 분기에서는 narrative 를 렌더하지 않는다 (loading 우선 정책 · error 시 항목 미렌더 정책 승계).
- [ ] **하위 호환** — `narrative` 미전달 또는 빈 문자열이면 서술 영역 자체를 렌더하지 않아 기존 markup 이 바이트 단위로 동일하다 (T-1774 선례). 빈 문자열 fallback 문구를 새로 만들지 않는다.
- [ ] happy-path unit test 1+ — narrative 문자열 전달 시 정상 경로에서 그 텍스트가 화면에 노출된다.
- [ ] error path unit test 1+ — `error` 가 truthy 이면 narrative 를 전달해도 `role="alert"` 만 렌더되고 서술 텍스트가 문서에 없다.
- [ ] 분기 cover — loading / error / 빈 목록 / 정상 4 분기 각각에 대해 narrative 렌더 여부를 고정하는 test 1+ (빈 목록 · 정상 = 렌더, loading · error = 미렌더).
- [ ] negative cases 충분 cover — 각 1+ test: ① `narrative` 미전달(undefined) 시 서술 영역 미렌더 ② 빈 문자열 `''` 시 미렌더(경계값, fallback 문구 위장 금지) ③ 공백만 있는 문자열 등 비정상 입력에서 throw 없이 안전 렌더 ④ narrative 를 지표 `rationale` 자리로 새어 나가게 하지 않음(항목 근거 텍스트와 혼입 0) ⑤ 미전달 시 기존 markup 불변(하위 호환 회귀 방어).
- [ ] `cd web && pnpm test` (vitest) 전량 green — 기존 web spec 회귀 0.
- [ ] `cd web && pnpm build` green (타입 오류 0).
- [ ] 저장소 루트에서 `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).

## Out of Scope

- [DashboardView.tsx](../../web/src/views/DashboardView.tsx) 배선 — 선택 row 의 `narrative` 를 패널로 내려보내는 컨테이너 변경은 **후속 slice** 소관 (본 task 는 slot 만).
- [assessmentRow.ts](../../web/src/api/assessmentRow.ts) · [contributionRow.ts](../../web/src/api/contributionRow.ts) 등 api 모듈 변경 (매핑은 이미 shipped).
- backend (`src/`) · prisma schema 변경.
- [requirements.md](../requirements.md) REQ-075 `DONE` 승격, PLAN `131 행` 마커 승격 — 배선 머지 후 별도 doc-only slice.
- CSS · 전역 스타일 도입 (REQ-080, PLAN `133 행` 소관).
- `EvaluationMetricItem` 계약 변경 (기여 상세 축 계약이라 건드리면 [contributionRow.ts](../../web/src/api/contributionRow.ts) 까지 파급).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (a) DashboardView 배선 slice — 선택 row(`selectedRow`)의 `narrative` 를 `<EvaluationDetailPanel narrative={...}>` 로 내려보내 REQ-075 잔여를 실제로 닫는다.
- (b) (a) 머지 후 [requirements.md](../requirements.md) `94 행` REQ-075 `IN_PROGRESS` → `DONE` 재판정 + REQ-074 · REQ-076 · REQ-077 재판정, 이어서 PLAN `131 행` 마커 승격 (doc-only direct).

## 결과 (2026-08-29T23:51Z, pr PR #1414 → main squash `a13fa062`)

**Status: DONE** — [EvaluationDetailPanel.tsx](../../web/src/components/EvaluationDetailPanel.tsx) 에 평가 정성 서술(`narrative`) optional 표시 슬롯을 추가했다 (2 파일 `+150/-1`).

- `narrative?: string` prop + `hasNarrative` 판정 helper + `NARRATIVE_ARIA_LABEL` 상수를 두고, 빈 목록 경로와 정상 경로 **양쪽**에 같은 `narrativeNode` 를 삽입했다 — metric 0 개인 평가에서도 서술이 렌더된다.
- `narrativeNode` 파생을 loading · error early return **뒤** 에 놓아 두 분기 미렌더가 구조적으로 보장된다.
- 하위 호환: 미전달 · 빈 문자열 · 공백-only 시 markup 바이트 동일 (negative test 로 고정). 새 dependency · 마크다운 렌더러 0.
- R-112 4 종 cover — happy / error / 4 분기(loading · error · 빈 목록 · 정상) / negative 5 종, narrative 9 케이스 추가. web vitest 104 files · 3000 test green, 루트 `test:cov` 458 suite / 13208 test green (line · function ≥ 80%).
- 4-게이트 PASS — reviewer APPROVE round 1/7 · PR comment 외부 post · PR CI green · integrator 자체 점검. squash merge + branch delete 완료.
- **잔여**: 본 slot 은 아직 소비처가 0 이다 — [DashboardView.tsx](../../web/src/views/DashboardView.tsx) 에서 선택 평가의 `narrative` 를 패널에 넘기는 배선 slice 가 REQ-075 `DONE` 승격의 남은 조건이다.
