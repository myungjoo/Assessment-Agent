---
id: T-1163
title: UserList 에 역할 변경 진행 표면 추가 (changingRoleId → 행별 disabled + aria-busy)
phase: P6
status: DONE
completedAt: 2026-07-24T00:56:45Z
prNumber: 1055
commitMode: pr
coversReq: [REQ-044, REQ-045]
estimatedDiff: 180
estimatedFiles: 2
independentStream: web-admin-user
dependsOn: [T-1162]
touchesFiles:
  - web/src/components/UserList.tsx
  - web/src/components/UserList.test.tsx
created: 2026-07-24
plannerNote: P6 line120 Admin 사용자 관리 arc 6번째 slice — T-1162 reviewer NIT-4(행별 disabled 표면 부재) 를 presentational 층에서 해소
---

# T-1163 — UserList 에 역할 변경 진행 표면 추가 (changingRoleId → 행별 disabled + aria-busy)

## Why

PLAN.md P6 line 120 (Admin 패널) 사용자 관리 arc 의 6번째 slice 다. T-1162 가 `runChangeRole` PATCH 배선을 완료하면서 컨테이너에 `changingRole` in-flight flag 를 두었지만, `UserList` 에는 진행 상태를 받을 prop 자체가 없어 요청 중에도 모든 역할 변경 버튼이 활성으로 보인다 (T-1162 reviewer NIT-4). 사용자는 응답 전에 다른 행 버튼을 계속 누를 수 있고, 러너의 `changing` 가드가 조용히 no-op 하므로 **아무 피드백 없이 클릭이 삼켜진다**.

본 task 는 그 진행 상태를 presentational 층에 여는 slice 다 — `changingRoleId` prop 1개를 추가해 (a) 진행 중인 행의 버튼을 `disabled` + `aria-busy` 로 표시하고 (b) 단일 in-flight 정책에 맞춰 나머지 행 버튼도 `disabled` 로 잠근다. T-1161 (`onChangeRole` 표면) → T-1162 (컨테이너 배선) 와 동일한 presentational-먼저 cadence 이며, 컨테이너 state 를 `changingRole: boolean` 에서 진행 id 로 바꿔 전달하는 배선은 다음 slice 다 (Out of Scope).

## Required Reading

- `web/src/components/UserList.tsx` 전체 (133행) — 특히 51~65행 `UserListProps` (`onChangeRole?` 시그니처), 36~49행 `resolveRoleAction` 순수 헬퍼, 96~129행 목록 렌더 (`rowId` / `roleAction` 판정 후 버튼 조건부 렌더 117~124행). 본 task 는 props 1개 추가 + 버튼 attribute 확장만 하고 기존 분기 (loading 우선 → error → empty → populated) 는 건드리지 않는다.
- `web/src/components/UserList.tsx` 25~34행 — 문구 상수 블록 (`LOADING_TEXT` / `DEFAULT_EMPTY_MESSAGE` / `EMAIL_PLACEHOLDER` / `PROMOTE_LABEL` / `DEMOTE_LABEL`). 진행 중 문구 상수를 이 블록에 한국어로 추가한다.
- `web/src/components/DashboardFilterBar.tsx` 110~135행 — `disabled={!onSearchChange}` 형태의 boolean attribute 렌더 선례. 본 task 의 `disabled` 표현을 이 convention 에 맞춘다.
- `web/src/components/DashboardFilterBar.test.tsx` 156~220행 — `renderToStaticMarkup` 결과에서 `disabled` 문자열 유무 / 등장 횟수를 세는 assertion convention (`html.match(/disabled/g)`). 본 task 의 disabled test 는 이 방식을 따른다.
- `web/src/components/UserList.test.tsx` 1~60행 (파일 헤더 주석 + `sampleUsers` fixture) 과 227행 이후 `onChangeRole` describe — 새 test 는 파일 끝에 append 하며 기존 test 는 수정하지 않는다. `renderToStaticMarkup` 은 이벤트를 발화하지 않으므로 (jsdom 미도입) 클릭 검증 대신 markup attribute 검증 + 콜백 직접 호출 방식이 본 파일의 convention 이다.
- `web/src/views/AdminView.tsx` 의 `<UserList ... />` 마운트 지점 (사용자 관리 섹션, T-1162 머지분) — **읽기만** 한다. 새 prop 은 optional 이라 컨테이너 무변경으로도 build 가 통과해야 함을 확인하는 용도.

## Acceptance Criteria

- [ ] `UserListProps` 에 `changingRoleId?: string` 을 추가한다 — 역할 변경 요청이 진행 중인 사용자 id. 한국어 주석으로 (a) 상위 컨테이너의 단일 in-flight 상태를 표현한다는 점, (b) 미전달 시 모든 버튼이 활성인 하위 호환 default 라는 점을 명시한다.
- [ ] 진행 판정은 `changingRoleId` 가 truthy 일 때만 성립한다 (빈 문자열은 falsy → 진행 없음). 진행 중이면 **모든 역할 변경 버튼**에 `disabled` 를 건다 (컨테이너 러너가 두 번째 발사를 no-op 하는 단일 in-flight 정책의 정직한 표면).
- [ ] `row.id === changingRoleId` 인 행의 버튼에만 추가로 `aria-busy="true"` 를 렌더하고, 그 행에 진행 문구 (`role="status"`) 1개를 표시한다. 문구는 새 상수로 상수 블록에 추가한다.
- [ ] `changingRoleId` 미전달 / `undefined` / 빈 문자열이면 markup 에 `disabled` 와 `aria-busy` 가 **한 번도 등장하지 않는다** (T-1159 / T-1161 / T-1162 회귀 0).
- [ ] `onChangeRole` 미전달 시에는 버튼 자체가 없으므로 `changingRoleId` 가 있어도 `disabled` / `aria-busy` / 진행 문구가 렌더되지 않는다 (읽기 전용 하위 호환 유지).
- [ ] happy-path unit test 1+ — `onChangeRole` + `changingRoleId='u1'` 전달 시 (a) `u1` 행 버튼에 `disabled` + `aria-busy="true"` + 진행 문구가 있고, (b) 같은 목록의 다른 행 버튼도 `disabled` 지만 `aria-busy` 는 없으며, (c) 버튼 개수 자체는 `changingRoleId` 유무와 무관하게 동일하다 (버튼이 사라지지 않는다).
- [ ] error path unit test 1+ — (a) `error` truthy + `changingRoleId` 동시 전달 시 alert 만 렌더되고 버튼·진행 문구는 0 (error 우선 정책 유지), (b) `loading=true` + `changingRoleId` 동시 전달 시 로딩 문구만 렌더 (loading 우선 정책 유지).
- [ ] 분기 cover — 각 1+ test: `changingRoleId` 미전달 / `undefined` 명시 / 빈 문자열 / 매칭 행 있음 / 매칭 행 없는 미지 id / `onChangeRole` 미전달 + `changingRoleId` 전달 / users 빈 배열 + `changingRoleId` 전달.
- [ ] negative cases 충분 cover — 각 1+ test: (a) `changingRoleId` 가 목록에 없는 id 여도 throw 없이 전 행 `disabled` + `aria-busy` 0 (fail-closed — in-flight 사실이 우선), (b) `id` 누락 row 는 원래도 버튼이 없으므로 `changingRoleId` 와 무관하게 `disabled` 0, (c) `role` 누락 / `'superadmin'` 같은 미지 role row 는 버튼 0 이라 진행 표면도 0, (d) `role='SuperAdmin'` row 는 버튼 0 유지, (e) 진행 중 행의 버튼 라벨 (승급/강등 문구) 이 사라지지 않는다 (라벨 교체 금지 — 기존 문구 계약 회귀 0), (f) 모든 필드 누락 row `{}` + `changingRoleId` 전달 시 throw 0.
- [ ] `pnpm --dir web test` (vitest) 전체 green + `pnpm --dir web build` (tsc + vite) green. 루트 `pnpm lint` clean.
- [ ] `pnpm test:cov` 기준선 유지 — 본 task 는 `src/` 를 건드리지 않으므로 backend coverage (line ≥ 80% / function ≥ 80%) 가 그대로 통과해야 한다.
- [ ] 사이즈 게이트 — 최종 diff ≤ 300 LOC / 파일 2개. 목표 배분: `UserList.tsx` ≤ 45 LOC, `UserList.test.tsx` ≤ 160 LOC. 초과 예상 시 (1) 주석을 선례 참조 한 줄로 압축하고 (2) 분기 / negative test 를 `it.each` 표로 합친다. **test 항목 자체를 빼서 줄이지 말 것** (R-112 위반).

## Out of Scope

- `web/src/views/AdminView.tsx` 수정 — 컨테이너의 `changingRole: boolean` state 를 진행 id 로 바꿔 `changingRoleId` 로 내려보내는 배선은 **다음 slice** 다. 본 task 의 prop 은 optional 이라 컨테이너 무변경으로도 build·test 가 green 이어야 한다.
- **(이월 — T-1162 reviewer MINOR-2)** RTL 등 상호작용 렌더 harness 도입 — `@testing-library/react` 는 새 외부 dependency 라 CLAUDE.md §5 상 BLOCKED 대상이다. 본 task 도 `renderToStaticMarkup` + 콜백 직접 호출 convention 을 그대로 따른다.
- **(이월 — T-1162 reviewer NIT-3)** 403 전용 문구의 self-demote 원인 분화 — 문구는 컨테이너 (`AdminView`) 소관이라 본 presentational task 범위 밖. 별도 task 후보.
- 자기 자신 강등 방지 (self-demote) 클라이언트 가드 — 현재 UI 에서는 `onChangeRole` 이 SuperAdmin 에게만 내려가고 SuperAdmin 행은 버튼 0 이라 도달 불가 경로다. 필요성 재평가 후 별도 task.
- 확인 다이얼로그 / 역할 3종 select box / 낙관적 UI 갱신 / spinner 아이콘 등 시각 요소 — 본 slice 는 `disabled` + `aria-busy` + 텍스트 진행 문구만.
- `PartList` / `GroupList` / `PersonList` 등 다른 List 컴포넌트에 동일 진행 표면 확산 — 별도 task.
- **(이월 — T-1158 reviewer MINOR)** `web/` vitest coverage 수치 미강제 해소 (CI 인프라 사안) / `emptyMessage` 빈 문자열 truthy 처리의 4개 List 일괄 수정 — 각각 별도 task.
- backend (`src/`) · prisma schema · `web/src/api/*` · `docs/architecture/api.md` 수정.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)
