---
id: T-1723
title: DashboardView 에 인원 목록 조회 + DashboardPersonSelector 배선 (선택 상태 lift-up)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-074]
independentStream: p6-dashboard-actual-behavior
dependsOn: [T-1722]
touchesFiles:
  - web/src/views/DashboardView.tsx
  - web/src/views/DashboardView.person-selector.test.tsx
  - web/src/views/DashboardView.test.tsx
estimatedDiff: 280
estimatedFiles: 3
created: 2026-08-26
plannerNote: P6 오너지시 PLAN 131행 ① 분해 slice 2 — T-1722 컴포넌트를 DashboardView 가 실제 소비(무-prop 마운트에서도 선택 가능)
---

# T-1723 — DashboardView 에 인원 목록 조회 + DashboardPersonSelector 배선 (선택 상태 lift-up)

## Why

오너 지시 [PLAN](../PLAN.md) `131 행` 🔴 ① (대시보드 안에서 평가 대상 인원 선택 UI, [requirements.md](../requirements.md) `93 행` REQ-074) 의 분해 slice 2 다. 직전 slice T-1722 가 순수 presentational 컴포넌트 `DashboardPersonSelector` 를 신설했지만 **소비처가 0** 이다 — [AppShell.tsx](../../web/src/AppShell.tsx) `314 행` 이 `<DashboardView />` 를 무-prop 으로 마운트하고, [DashboardView.tsx](../../web/src/views/DashboardView.tsx) 는 `personId` 를 prop 으로만 받아 미선택이면 안내문(`NO_PERSON_TEXT`)만 렌더하므로 사용자는 여전히 빈 상태에서 막힌다.

본 slice 는 그 컴포넌트를 실제로 소비한다 — `DashboardView` 가 `GET /api/persons` 조회와 **선택 personId state 를 소유**(ADR-0041 controlled lift-up)하고, 미선택 분기와 정상 분기 **양쪽 모두** 에 선택 컨트롤을 렌더한다. `AppShell` 은 무수정 — 컨테이너가 상태를 소유하므로 무-prop 마운트 그대로 선택 수단이 살아난다.

## Required Reading

- [docs/tasks/T-1722-dashboard-person-selector-component.md](T-1722-dashboard-person-selector-component.md) — 직전 slice 의 컴포넌트 계약 · Out of Scope 경계
- [web/src/components/DashboardPersonSelector.tsx](../../web/src/components/DashboardPersonSelector.tsx) — props (`persons` / `selectedId` / `onSelect` / `loading` / `error`) · `SelectablePerson` 필드 · `filterSelectablePersons` · `submitSelection`
- [web/src/views/DashboardView.tsx](../../web/src/views/DashboardView.tsx) — 특히 `DashboardViewProps` (`personId` 등 `initial*` 주입 패턴) · `buildAssessmentsPath` / `buildSummariesPath` 의 `personId` 소비 · `PERMISSION_DENIED_RECORDS_PATH` 무조건 조회 선례 · `if (!personId)` 미선택 early-return 분기 · `return (` 정상 분기 상단
- [web/src/api/useApiResource.ts](../../web/src/api/useApiResource.ts) — `{ data, loading, error }` 반환 계약 · `path === null` 조건부 조회 가드
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) 의 `PERSONS_PATH` 상수 정의부 (`102~106 행` 부근) — `GET /api/persons` 경로 · 응답 row 형태 규약
- [web/src/views/DashboardView.test.tsx](../../web/src/views/DashboardView.test.tsx) — 기존 정적 렌더 spec 의 단언 방식 (`renderToStaticMarkup`, ADR-0040 §5 @testing-library 부재)
- [docs/decisions/ADR-0041-frontend-composition-wiring.md](../decisions/ADR-0041-frontend-composition-wiring.md) — Decision 1 (presentational 은 fetch 를 모른다) · Decision 3 (컨테이너가 data/loading/error 소유)

## Acceptance Criteria

- [ ] `web/src/views/DashboardView.tsx` 가 `DashboardPersonSelector` 를 default import 하고 (컴포넌트 파일 수정 0), 인원 목록 조회 상수 `PERSONS_PATH = '/api/persons'` 와 `useApiResource` 호출 1 개를 추가한다. 조회는 조건부 가드 없이 무조건 수행한다 (필수 query 없음 — `PERMISSION_DENIED_RECORDS_PATH` 선례).
- [ ] 순수 함수 `derivePersonOptions(rows)` 를 **named export** 로 신설한다 — 응답 row 배열을 `DashboardPersonSelector` 의 `persons` 형태로 매핑하고, `id` 가 없거나 비문자열인 row 는 제외, `fullName` 누락 시 안전 fallback, 입력이 배열이 아니면 빈 배열 반환 (throw 0). 컴포넌트의 `filterSelectablePersons` 를 재구현하지 않는다 (active 필터링은 컴포넌트 책임).
- [ ] `DashboardView` 가 선택 personId 를 `useState` 로 소유하고 초기값은 기존 `personId` prop 에서 받는다 (기존 prop 계약 하위 호환 — prop 주입 시 종전과 동일 렌더). `buildAssessmentsPath` / `buildSummariesPath` 는 prop 대신 이 **선택 state** 를 소비한다.
- [ ] 선택 컨트롤이 **미선택 early-return 분기와 정상 분기 양쪽 모두** 에 렌더된다 — 미선택 상태에서 안내문만 남고 선택 수단이 사라지면 REQ-074 위반이다. 조회 `loading` / `error` 는 컴포넌트 props 로 그대로 내려보내고, 에러여도 선택 컨트롤을 삼키지 않는다.
- [ ] happy-path unit test 1+ — `derivePersonOptions` 가 정상 row 배열을 옵션 배열로 매핑 + 선택 컨트롤 라벨(`평가 대상 인원`)이 미선택/정상 두 분기 마크업에 모두 존재.
- [ ] error path unit test 1+ — 인원 조회 실패(`error` 주입) 시에도 선택 컨트롤이 렌더되고 에러 문구가 함께 노출되는지 검증.
- [ ] 분기 cover — `derivePersonOptions` 의 각 분기 (정상 매핑 / `id` 결손 제외 / `fullName` 누락 fallback / 비배열 입력) + 렌더 분기 (미선택 early-return / 정상 / loading / error) 각 1+ test.
- [ ] negative cases 충분 cover — 빈 배열 · `undefined` 입력 · `id` 가 빈 문자열/공백 · 비객체 row · 미지의 선택 personId · 조회 실패 동시 발생 등 예외 상황 **각 1+ test** (단일 negative 로 끝내지 않는다).
- [ ] 신규 spec 은 colocated 위치 `web/src/views/DashboardView.person-selector.test.tsx` 에 둔다 (뷰 spec 은 `web/src/views/` colocated 규약). @testing-library 부재(ADR-0040 §5) 이므로 `renderToStaticMarkup` 정적 렌더 + 순수 함수 직접 호출로 검증한다.
- [ ] 기존 `DashboardView` spec 회귀 0 — 기존 단언을 **약화·삭제하지 않는다**. 새 선택 컨트롤 마크업 추가로 기존 단언이 깨지면 정합 보정만 허용 (`web/src/views/DashboardView.test.tsx` 최소 수정).
- [ ] `pnpm --dir web test` (vitest) 전량 green.
- [ ] 루트 `pnpm lint && pnpm build && pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). `src/` diff 0 파일이라 backend coverage 는 불변이어야 한다.
- [ ] 새 dependency 0 — `web/package.json` · `package.json` diff 0 파일.

## Out of Scope

- `web/src/AppShell.tsx` 수정 (본 slice 는 컨테이너 내부 상태 소유로 해결 — AppShell diff 0 파일).
- `web/src/components/DashboardPersonSelector.tsx` 수정 (컴포넌트 계약은 T-1722 확정본 그대로 소비만).
- `GET /api/persons` 의 web↔backend 계약 drift guard spec 신설 (`DashboardView.persons-list-contract.test.ts`) — 기존 `AdminView.persons-list-contract.test.ts` 가 같은 endpoint 를 이미 지킨다. 필요 시 후속 slice.
- REQ-075 표시 계약 정합 (`volume` / `difficulty` / `contributionScore` / `narrative` 필드 재설계) · REQ-076 점수 분포 축 재조정 — 별도 축, 별도 slice.
- 인원 목록 재조회 nonce · 검색/페이지네이션 · 선택 personId 의 URL/localStorage 영속화.
- `src/` backend 변경 · `test/e2e/` 변경 · 워크플로 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
