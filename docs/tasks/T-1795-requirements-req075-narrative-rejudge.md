---
id: T-1795
title: narrative 배선 shipped 실측으로 REQ-075 재판정 + PLAN 131 행 ② 축 shipped 서술
phase: P6
status: PENDING
commitMode: direct
coversReq: [REQ-075]
estimatedDiff: 70
estimatedFiles: 2
created: 2026-08-30
independentStream: web-dashboard-display-contract
dependsOn: [T-1794]
touchesFiles:
  - docs/requirements.md
  - docs/PLAN.md
plannerNote: "T-1794 머지로 REQ-075 의 유일 잔여(narrative 미표시)가 해소 — IN_PROGRESS 재판정 + PLAN 131 행 ② 축 서술 (doc-only)"
---

# T-1795 — narrative 배선 shipped 실측으로 REQ-075 재판정 + PLAN 131 행 ② 축 shipped 서술

## Why

[T-1792](T-1792-requirements-req075-display-contract-rejudge.md) 가 [requirements.md](../requirements.md) `94 행` REQ-075 를 `DONE` 이 아닌 `IN_PROGRESS` 로 묶어둔 근거는 **정확히 한 개** 였다 — REQ 문언이 열거한 backend 필드 5 종(`volume` · `difficulty` · `contributionScore` · `narrative` · `period`/`periodStart`) 중 `narrative` 만 모듈에 값이 보존될 뿐 어느 표시 축에도 닿지 않는다는 것. 그 잔여를 [T-1793](T-1793-evaluation-detail-panel-narrative-slot.md)(슬롯 절단) → [T-1794](T-1794-dashboardview-narrative-wire.md)(소비처 배선, PR #1415 → main `f4f4d75e`) 2 slice 가 닫았다.

따라서 지금 `94 행` 의 `IN_PROGRESS` 는 머지된 사실과 어긋난 drift 다. 본 slice 는 그 **한 행을 실측 좌표로 재판정** 하고, 같은 사실을 [PLAN](../PLAN.md) `131 행` 오너 지시 bullet 의 ② 축 서술에도 반영한다. 코드 변경 0 · 기존 문서 2 곳의 inline-amend 이므로 [CLAUDE.md §3.1](../../CLAUDE.md) 판정 1 에 따라 `commitMode: direct`.

**주의 — PLAN `131 행` bullet 마커는 `[ ]` 로 유지한다.** 그 bullet 은 ①(대시보드 안 인원 선택 UI, REQ-074) ②(표시 계약 정합, REQ-075) ③(점수 분포 실 스케일, REQ-076) ④(기간 지정 UI + period 호출, REQ-077) 4 축을 묶고 있고, 본 slice 가 닫는 것은 ② 하나뿐이다.

## Required Reading

- [docs/requirements.md](../requirements.md) `5~13 행` (운영 룰 — 상태 enum 5 값 · 검증 위치 enum 7 값 · "구현 위치 컬럼에 task 목록을 comma 로" 룰) 과 `94 행` (REQ-075 — 수정 대상 1 행). 현재 상태 토큰 `IN_PROGRESS` 와 그 뒤에 붙은 **잔여 1 개 — `narrative` 미표시** 문단이 본 slice 가 걷어낼 대상이다.
- [web/src/views/DashboardView.tsx](../../web/src/views/DashboardView.tsx) `886~906 행` — `EvaluationDetailPanel` 마운트의 `[narrative 출처 근거]` 주석(`891~897 행`) 과 `906 행` `narrative={selectedRow?.narrative}` 배선. **재판정 문장이 인용해야 할 핵심 좌표.**
- [web/src/components/EvaluationDetailPanel.tsx](../../web/src/components/EvaluationDetailPanel.tsx) `31 행`(`NARRATIVE_ARIA_LABEL = '평가 정성 서술'`) · `69 행`(`narrative?: string` prop) · `108~109 행`(`hasNarrative`) · `146~147 행`(`narrativeNode`) · `162 행` · `176 행`(삽입 위치 2 곳) — 값이 실제 DOM 노드까지 도달하는 경로.
- [web/src/api/assessmentRow.ts](../../web/src/api/assessmentRow.ts) `27 행`(`narrative` 선언) · `101 행`(매핑 본문) — 결손을 빈 문자열로 정규화하는 축.
- [web/src/views/DashboardView.narrative-wire.test.tsx](../../web/src/views/DashboardView.narrative-wire.test.tsx) — T-1794 가 추가한 신규 colocated spec. 재판정의 **검증 실체** 로 인용할 파일.
- [docs/PLAN.md](../PLAN.md) `131 행` — 오너 지시 "대시보드 실동작 (R-175~R-178)" bullet. ② 축 서술("프런트 EvaluationResultRow/ContributionRow 가 backend 응답과 id 외 불일치해 실데이터 렌더 0") 이 지금은 사실과 어긋난다.
- [docs/PLAN.md](../PLAN.md) `129 행` · `132 행` — 직전 두 bullet 의 **승격/서술 형식 선례**(T-1787 · T-1785). 마커를 올릴 때와 서술만 보탤 때의 표기 수위를 여기서 맞춘다.
- [docs/tasks/T-1792-requirements-req075-display-contract-rejudge.md](T-1792-requirements-req075-display-contract-rejudge.md) `## Acceptance Criteria` — 같은 REQ 행의 직전 재판정 선례. 좌표 인용 형식 · 검증 위치 정정 방식을 승계한다.

## Acceptance Criteria

- [ ] `docs/requirements.md` 의 **REQ-075 한 행만** 갱신된다. 4 축(테이블 · 상세 패널 · 점수 분포 · 시계열)과 필드 5 종이 모두 충족이면 `IN_PROGRESS` → `DONE`, 실측에서 미충족이 남으면 `IN_PROGRESS` 를 유지하고 **그 잔여를 한 줄로 명시** 한다. **근거 없이 토큰만 바꾸지 않는다** — 판정 문장이 어느 파일 몇 행이 REQ 문언을 충족하는지 적어야 한다.
- [ ] 재판정 문장이 `narrative` 축의 **도달 경로 전체를 좌표로** 인용한다 — 매퍼([assessmentRow.ts](../../web/src/api/assessmentRow.ts) `27 행` · `101 행`) → 컨테이너 배선([DashboardView.tsx](../../web/src/views/DashboardView.tsx) `906 행`) → 표시 노드([EvaluationDetailPanel.tsx](../../web/src/components/EvaluationDetailPanel.tsx) `146~147 행` `NARRATIVE_ARIA_LABEL` 노드). 한 단계라도 빠지면 미완.
- [ ] "구현 위치" 컬럼에 **narrative 축 shipped slice** 로 `T-1793`, `T-1794` 가 기존 축 목록(표 · 점수 분포 · 시계열 · 기여 상세 패널) 뒤에 comma 로 이어 붙는다 (`5~13 행` 운영 룰 형식 준수).
- [ ] T-1792 가 남긴 **"잔여 1 개 — `narrative` 미표시"** 문단이 걷히고, 그 자리에 해소 근거가 들어간다. `DONE` 으로 올릴 경우 잔여 표기를 두지 않는다.
- [ ] 검증 위치 컬럼은 실측대로 `unit` 을 유지하고, 검증 실체 목록에 T-1794 의 신규 colocated spec [DashboardView.narrative-wire.test.tsx](../../web/src/views/DashboardView.narrative-wire.test.tsx) 를 추가한다.
- [ ] REQ 경계 문장을 보존한다 — 대시보드 안 인원 선택 UI 는 `93 행` REQ-074, 점수 스케일 가정은 `95 행` REQ-076, 기간 지정 UI · period 호출 경로는 `96 행` REQ-077 소관이라 본 REQ 의 잔여로 적지 않는다.
- [ ] `docs/PLAN.md` `131 행` bullet 의 ② 축 서술이 실측에 맞게 갱신된다 — "id 외 불일치해 실데이터 렌더 0" 이라는 **더 이상 사실이 아닌 문장** 대신 4 축 + narrative 배선이 shipped 임을 slice ID(T-1724~T-1731, T-1788~T-1791, T-1793, T-1794)와 함께 한 덩어리로 적는다.
- [ ] `docs/PLAN.md` `131 행` bullet 의 **마커는 `[ ]` 로 유지** 되고, ①(REQ-074) · ③(REQ-076) · ④(REQ-077) 가 잔여라는 사실이 서술에 남는다. 마커를 `[x]` 로 올리면 위반.
- [ ] `docs/requirements.md` · `docs/PLAN.md` 외 파일 변경 0 — `git status --porcelain` 결과가 이 2 개 경로만 보여야 한다.
- [ ] 두 문서의 markdown 표/리스트 구조가 깨지지 않는다 — REQ 표는 컬럼 수(7) 가 유지되고, 갱신 후 `94 행` 이 여전히 REQ-075 단일 행이다(행 분할 금지).

## Out of Scope

- 코드 변경 일체 — `web/` · `src/` · `test/` 는 건드리지 않는다. 본 slice 는 이미 머지된 사실의 문서 반영뿐이다.
- REQ-074 · REQ-076 · REQ-077 행 재판정 — 각각 인원 선택 UI · 점수 스케일 · 기간 지정 UI 소관으로 별도 slice.
- [PLAN](../PLAN.md) `131 행` bullet 마커 `[x]` 승격 — ①③④ 잔여가 남아 있어 금지.
- [PLAN](../PLAN.md) `130 행` · `133 행` 등 다른 오너 지시 bullet 손질.
- narrative 표시 정책 확장(마크다운 렌더 · 줄바꿈 · truncation · 접기/펼치기) 및 그에 대한 신규 REQ row 채번.
- ADR 신설 · `docs/architecture/*` 갱신 · STATE/journal 편집(driver 소관).

## Suggested Sub-agents

`implementer`

## Follow-ups
