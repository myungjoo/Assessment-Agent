---
id: T-1796
title: 인원 선택 UI shipped 실측으로 REQ-074 재판정 + PLAN 131 행 ① 축 서술 갱신
phase: P6
status: DONE
commitMode: direct
coversReq: [REQ-074]
estimatedDiff: 70
estimatedFiles: 2
created: 2026-08-30
completedAt: 2026-08-30T02:50:00Z
independentStream: web-dashboard-display-contract
dependsOn: []
touchesFiles:
  - docs/requirements.md
  - docs/PLAN.md
plannerNote: "P6 오너 지시 131 행 ① 축 — T-1722·T-1723 머지로 인원 선택 UI 가 shipped 인데 REQ-074 는 PLANNED drift (doc-only)"
---

# T-1796 — 인원 선택 UI shipped 실측으로 REQ-074 재판정 + PLAN 131 행 ① 축 서술 갱신

## Why

[PLAN](../PLAN.md) `131 행` 오너 지시 bullet 은 ①(인원 선택 UI, REQ-074) ②(표시 계약 정합, REQ-075) ③(점수 분포 실 스케일, REQ-076) ④(기간 지정 UI + period 호출, REQ-077) 4 축을 묶는다. 직전 [T-1795](T-1795-requirements-req075-narrative-rejudge.md) 가 ② 를 닫았고, 남은 3 축 중 ① 은 **구현 chain 이 이미 main 에 머지돼 있는데 문서만 뒤처진 drift** 다 — [requirements.md](../requirements.md) `93 행` 은 아직 `PLANNED` 이고 구현 위치 컬럼에 shipped slice 가 하나도 적혀 있지 않다.

실측 근거는 이미 main 에 있다. 컴포넌트 축은 [DashboardPersonSelector.tsx](../../web/src/components/DashboardPersonSelector.tsx)(T-1722) 가, 컨테이너 배선 축은 [DashboardView.tsx](../../web/src/views/DashboardView.tsx)(T-1723 — 조회·상태 소유·미선택/정상 두 분기 모두 렌더) 가 담당한다. 본 slice 는 그 사실을 **REQ 행 한 개 재판정 + PLAN ① 축 서술** 로만 반영한다. 코드 변경 0 · 기존 문서 2 곳의 inline-amend 이므로 [CLAUDE.md §3.1](../../CLAUDE.md) 판정 1 에 따라 `commitMode: direct`.

**주의 — PLAN `131 행` bullet 마커는 `[ ]` 로 유지한다.** 본 slice 가 닫는 것은 ① 하나뿐이고 ③(REQ-076) · ④(REQ-077) 는 잔여다.

## Required Reading

- [docs/requirements.md](../requirements.md) `5~13 행` (운영 룰 — 상태 enum · 검증 위치 enum · "구현 위치 컬럼에 task 목록을 comma 로" 룰) 과 `93 행` (REQ-074 — 수정 대상 1 행). 현재 값은 구현 위치 `P6 (PLAN 131 행)` · 검증 위치 `e2e` · 상태 `PLANNED` 셋 다 실측과 어긋난다.
- [web/src/components/DashboardPersonSelector.tsx](../../web/src/components/DashboardPersonSelector.tsx) `1~4 행`(REQ-074 목적 주석) · `46~48 행`(에러가 선택 수단을 삼키지 않는다는 계약) · `102 행`(`role="alert"`) · `105 행`(빈 상태 분기) · `108~117 행`(`<label>` + `<select>` + placeholder `<option value="">`) — **선택 수단이 실제 DOM 노드로 존재한다는 핵심 좌표.**
- [web/src/views/DashboardView.tsx](../../web/src/views/DashboardView.tsx) `119~123 행`(`PERSONS_PATH = '/api/persons'`) · `583~592 행`(`useApiResource` 로 인원 목록 조회) · `320 행` 이하 `derivePersonOptions`(응답 → 후보 매핑, 결손 흡수) · `609~612 행`(`personOptions` 파생) · `720~731 행`(`handlePersonSelect` — 선택 변경 시 row 선택·페이지·요청 문구 초기화) · `748~760 행`(`personSelector` element) · `763~777 행`(미선택 early-return 분기에서도 selector 를 함께 렌더) · `789~791 행`(정상 분기 렌더) — **"안내문만 있고 선택 수단이 없는 상태 금지" 를 두 분기 모두에서 충족한다는 근거.**
- [web/src/components/DashboardPersonSelector.test.tsx](../../web/src/components/DashboardPersonSelector.test.tsx) · [web/src/views/DashboardView.person-selector.test.tsx](../../web/src/views/DashboardView.person-selector.test.tsx) — 재판정의 **검증 실체** 로 인용할 colocated spec 2 개.
- `test/e2e/` 디렉토리 목록 — dashboard 렌더를 브라우저에서 확인하는 harness 가 있는지 실측(현재 인원 관련 e2e 는 [persons.e2e-spec.ts](../../test/e2e/persons.e2e-spec.ts) · [person-identity-continuation.e2e-spec.ts](../../test/e2e/person-identity-continuation.e2e-spec.ts) 로 supertest HTTP 축뿐). 검증 위치 컬럼 판정의 근거.
- [docs/PLAN.md](../PLAN.md) `131 행` — 오너 지시 bullet. ① 축 서술("현재 AppShell 이 DashboardView 를 무-prop 마운트해 personId 부재 → 안내문만 렌더, 선택 수단 0")이 지금은 사실과 어긋난다(무-prop 마운트는 여전하지만 컨테이너가 선택 state 를 소유해 선택 수단이 살아 있다 — [DashboardView.tsx](../../web/src/views/DashboardView.tsx) `74 행` 주석 · `512 행` `useState`).
- [docs/tasks/T-1795-requirements-req075-narrative-rejudge.md](T-1795-requirements-req075-narrative-rejudge.md) `## Acceptance Criteria` — 직전 재판정 선례. 좌표 인용 형식 · 구현 위치 comma 표기 · 검증 위치 정정 방식을 그대로 승계한다.

## Acceptance Criteria

- [ ] [docs/requirements.md](../requirements.md) 의 **REQ-074 한 행만** 갱신된다. 실측이 REQ 문언을 충족하면 `PLANNED` → `DONE`, 잔여가 남으면 `IN_PROGRESS` 로 두고 **그 잔여를 한 줄로 명시** 한다. **근거 없이 토큰만 바꾸지 않는다** — 판정 문장이 어느 파일 몇 행이 문언을 충족하는지 적어야 한다.
- [ ] 재판정 문장이 선택 수단의 **존재 경로 전체를 좌표로** 인용한다 — 조회([DashboardView.tsx](../../web/src/views/DashboardView.tsx) `PERSONS_PATH` · `useApiResource`) → 후보 매핑(`derivePersonOptions` · `personOptions`) → 컴포넌트 마운트(`personSelector`) → 실제 DOM 노드([DashboardPersonSelector.tsx](../../web/src/components/DashboardPersonSelector.tsx) `<label>` + `<select>` + placeholder `<option>`). 한 단계라도 빠지면 미완.
- [ ] REQ 문언의 금지 조항("안내문만 있고 선택 수단이 없는 상태 금지")이 **미선택 분기에서도** 충족됨을 좌표로 못박는다 — [DashboardView.tsx](../../web/src/views/DashboardView.tsx) 의 `if (!selectedPersonId)` early-return 안에 `personSelector` 가 안내 문구와 함께 렌더된다는 사실, 그리고 조회 error 여도 컴포넌트가 alert 와 select 를 병렬 렌더한다는 계약([DashboardPersonSelector.tsx](../../web/src/components/DashboardPersonSelector.tsx) `46~48 행` · `102 행`) 두 가지.
- [ ] "구현 위치" 컬럼에 shipped slice 가 comma 로 적힌다 — 컴포넌트 축 `T-1722`, 배선 축 `T-1723` (`5~13 행` 운영 룰 형식 준수). 기존 `P6 (PLAN 131 행)` 표기는 유지한다.
- [ ] 검증 위치 컬럼을 **실측대로** 정한다 — `test/e2e/` 에 대시보드 화면 렌더를 확인하는 harness 가 없고 검증 실체가 web colocated vitest 2 개뿐이면 `e2e` → `unit` 으로 정정하고 그 근거(어떤 spec 이 실체인지)를 판정 문장에 적는다. harness 가 실재하면 `e2e` 를 유지하고 그 파일을 인용한다.
- [ ] REQ 경계 문장을 남긴다 — 표시 계약 정합은 `94 행` REQ-075, 점수 스케일 가정은 `95 행` REQ-076, 기간 지정 UI · period 호출 경로는 `96 행` REQ-077 소관이라 본 REQ 의 잔여로 적지 않는다.
- [ ] [docs/PLAN.md](../PLAN.md) `131 행` bullet 의 ① 축 서술이 실측에 맞게 갱신된다 — "personId 부재 → 안내문만 렌더, 선택 수단 0" 이라는 **더 이상 사실이 아닌 문장** 대신 T-1722 · T-1723 으로 선택 수단이 shipped 임을(무-prop 마운트여도 컨테이너가 선택 state 를 소유) slice ID 와 함께 한 덩어리로 적는다.
- [ ] [docs/PLAN.md](../PLAN.md) `131 행` bullet 의 **마커는 `[ ]` 로 유지** 되고, ③(REQ-076) · ④(REQ-077) 가 잔여라는 사실이 서술에 남는다. 마커를 `[x]` 로 올리면 위반.
- [ ] `docs/requirements.md` · `docs/PLAN.md` 외 파일 변경 0 — `git status --porcelain` 결과가 이 2 개 경로만 보여야 한다.
- [ ] 두 문서의 markdown 구조가 깨지지 않는다 — REQ 표 컬럼 수(7)가 유지되고, 갱신 후 `93 행` 이 여전히 REQ-074 단일 행이다(행 분할 금지).

## Out of Scope

- 코드 변경 일체 — `web/` · `src/` · `test/` 는 건드리지 않는다. 본 slice 는 이미 머지된 사실의 문서 반영뿐이다.
- REQ-076 · REQ-077 행 재판정 — 각각 점수 분포 실 스케일 · 기간 지정 UI 소관으로 별도 slice.
- [PLAN](../PLAN.md) `131 행` bullet 마커 `[x]` 승격 — ③④ 잔여가 남아 있어 금지.
- [PLAN](../PLAN.md) `129 행` · `130 행` · `132 행` · `133 행` 등 다른 bullet 손질.
- 인원 선택 UI 기능 확장(검색형 선택 · 다중 선택 · URL query 동기화 · AppShell 로의 personId lift-up) 및 그에 대한 신규 REQ row 채번.
- 대시보드 e2e harness 신설 — 검증 위치 정정의 근거로만 실측하고, harness 자체를 만들지 않는다.
- ADR 신설 · `docs/architecture/*` 갱신 · STATE/journal 편집(driver 소관).

## Suggested Sub-agents

`implementer`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
