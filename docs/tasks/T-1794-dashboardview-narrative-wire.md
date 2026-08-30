---
id: T-1794
title: DashboardView 에서 선택 row 의 narrative 를 EvaluationDetailPanel 로 배선
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-075]
estimatedDiff: 150
estimatedFiles: 2
created: 2026-08-30
independentStream: p6-display-contract
dependsOn: [T-1793]
touchesFiles:
  - web/src/views/DashboardView.tsx
  - web/src/views/DashboardView.narrative-wire.test.tsx
plannerNote: P6 오너 지시 PLAN 131 행 ② 표시 계약 정합 — T-1793 이 만든 narrative 슬롯의 유일 소비처 배선
---

# T-1794 — DashboardView 에서 선택 row 의 narrative 를 EvaluationDetailPanel 로 배선

## Why

[PLAN.md](../PLAN.md) `131 행` 오너 지시 "대시보드 실동작" ② **표시 계약 정합** 의 마지막 잔여다. [T-1792](T-1792-requirements-req075-display-contract-rejudge.md) 가 [requirements.md](../requirements.md) `94 행` REQ-075 를 `DONE` 이 아닌 `IN_PROGRESS` 로 묶어둔 근거는 backend 필드 5 종 중 `narrative` 만 어느 화면에도 도달하지 않는다는 점 하나였고, [T-1793](T-1793-evaluation-detail-panel-narrative-slot.md) 이 [EvaluationDetailPanel.tsx](../../web/src/components/EvaluationDetailPanel.tsx) 에 하위 호환 optional `narrative?: string` 슬롯(`69 행` prop · `108~109 행` `hasNarrative` · `146~147 행` `narrativeNode`)을 먼저 절단했다. 그 슬롯은 지금 소비처가 0 이다 — [DashboardView.tsx](../../web/src/views/DashboardView.tsx) `891~897 행` 의 마운트가 `narrative` 를 넘기지 않아 실데이터가 여전히 렌더되지 않는다.

본 slice 는 이미 존재하는 두 조각(`selectedRow` 파생 `670~673 행` + `AssessmentDisplayRow.narrative` [assessmentRow.ts](../../web/src/api/assessmentRow.ts) `27 행`)을 슬롯에 연결하는 **배선 한 겹만** 절단한다. 컴포넌트·매퍼 수정 0, backend 무변경, 새 dependency 0.

## Required Reading

- [web/src/views/DashboardView.tsx](../../web/src/views/DashboardView.tsx) — 특히 `670~673 행`(`selectedRow` useMemo) 과 `886~897 행`(`EvaluationDetailPanel` 마운트 주석 + props)
- [web/src/components/EvaluationDetailPanel.tsx](../../web/src/components/EvaluationDetailPanel.tsx) — `49~70 행`(props 계약 · `narrative?: string`), `108~109 행`(`hasNarrative`), `140~180 행`(`narrativeNode` 삽입 위치 · loading/error early return 관계)
- [web/src/api/assessmentRow.ts](../../web/src/api/assessmentRow.ts) — `14~28 행`(`AssessmentDisplayRow`, `narrative: string` 은 결손 시 빈 문자열로 정규화됨), `44~47 행`(`toDisplayString`)
- [web/src/views/DashboardView.test.tsx](../../web/src/views/DashboardView.test.tsx) — 기존 렌더 harness(mock fetch 셋업 · 선택 row 조작 방식) 참고용. **본 task 는 이 파일을 수정하지 않고** 신규 colocated spec `web/src/views/DashboardView.narrative-wire.test.tsx` 를 만든다.
- [docs/tasks/T-1793-evaluation-detail-panel-narrative-slot.md](T-1793-evaluation-detail-panel-narrative-slot.md) — 슬롯 계약(미전달·빈 문자열 시 하위 호환) 확인용

## Acceptance Criteria

- [ ] [DashboardView.tsx](../../web/src/views/DashboardView.tsx) 의 `EvaluationDetailPanel` 마운트에 `narrative={selectedRow?.narrative}` 축을 추가한다. 선택 row 가 없으면 `undefined` 가 전달돼 슬롯이 렌더되지 않아야 한다(빈 안내 `DETAIL_EMPTY_LABEL` 경로 무변경).
- [ ] 마운트 위 주석에 "narrative 는 `Contribution` 이 아니라 선택된 `Assessment` 1 건의 정성 서술 축이라 `contributionMetrics` 가 아닌 `selectedRow` 에서 온다" 는 근거를 한국어로 박제한다. `212 행` 의 기존 "narrative 는 `Assessment` 소관" 주석과 모순되지 않게 정합시킨다.
- [ ] 신규 colocated spec `web/src/views/DashboardView.narrative-wire.test.tsx` 를 추가한다 (기존 spec 파일 수정 0).
- [ ] **happy-path test 1+** — assessments 응답에 `narrative` 가 있는 row 를 선택하면 상세 패널에 그 문자열이 렌더된다(`EvaluationDetailPanel` 의 `NARRATIVE_ARIA_LABEL` 노드로 조회).
- [ ] **error path test 1+** — contributions 조회가 실패해 `contributionError` 가 세워진 상태에서는 상세 패널이 error 분기로 early return 하므로 narrative 가 렌더되지 않는다. assessments 조회 자체가 실패해 `visibleRows` 가 비면 `selectedRow` 가 `undefined` 라 narrative 미렌더인 것도 함께 고정한다.
- [ ] **분기 cover** — (a) 선택 row 있음 + narrative 비어있지 않음 → 렌더, (b) 선택 row 있음 + narrative 빈 문자열(backend 결손을 `toDisplayString` 이 `''` 로 정규화한 경우) → 미렌더, (c) 선택 row 없음(`selectedId` 미선택 / 존재하지 않는 id) → 미렌더, (d) contributions loading 중 → 상세 패널 loading 분기라 미렌더. 각 분기 1+ test.
- [ ] **negative cases 충분 cover** — 각 1+ test: ① `narrative` 필드가 응답에 아예 없는 row(매퍼가 `''` 로 흡수) ② `narrative` 가 문자열이 아닌 타입(숫자·객체·null)으로 도착 ③ 공백만 있는 문자열 ④ 선택 id 가 현재 페이지 밖 row 를 가리키는 경우(`selectedRow` 는 `visibleRows` 기준 — [DashboardView.tsx](../../web/src/views/DashboardView.tsx) `870~873 행` 주석 참조)에도 throw 없이 안전 동작 ⑤ 다른 row 로 선택을 바꾸면 표시되는 narrative 도 그 row 의 것으로 교체된다(stale 표시 금지).
- [ ] `cd web && pnpm test` 전량 green (신규 spec 포함).
- [ ] 루트 `pnpm lint && pnpm build && pnpm test` green, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).

## Out of Scope

- [EvaluationDetailPanel.tsx](../../web/src/components/EvaluationDetailPanel.tsx) 수정 — 슬롯은 [T-1793](T-1793-evaluation-detail-panel-narrative-slot.md) 이 이미 shipped. 본 task 는 소비처만 만든다.
- [assessmentRow.ts](../../web/src/api/assessmentRow.ts) · [contributionRow.ts](../../web/src/api/contributionRow.ts) 매퍼 수정 — `narrative` 정규화는 이미 박제돼 있다.
- 표 축([AssessmentResultTable.tsx](../../web/src/components/AssessmentResultTable.tsx))에 narrative 컬럼 추가 — `15 행` 이 "장문이라 상세 패널 축이다" 로 이미 배제 근거를 박제했다.
- 마크다운/줄바꿈 렌더링, 길이 truncation, 접기/펼치기 UI — 표시 정책 확장은 별도 slice.
- [requirements.md](../requirements.md) `94 행` REQ-075 재판정 및 [PLAN.md](../PLAN.md) `131 행` ② 마커 승격 — 본 배선 머지 후 별도 `direct` slice.
- 기존 spec 파일([DashboardView.test.tsx](../../web/src/views/DashboardView.test.tsx) 등) 수정 · backend `src/` 변경 · 새 dependency 추가.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
