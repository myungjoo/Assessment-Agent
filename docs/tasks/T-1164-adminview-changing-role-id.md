---
id: T-1164
title: AdminView 역할 변경 진행 상태를 boolean → 진행 id 로 전환하고 UserList 에 배선
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-044, REQ-045]
estimatedDiff: 200
estimatedFiles: 2
created: 2026-07-24
independentStream: web-admin-user
dependsOn: [T-1163]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.test.tsx
plannerNote: P6 line120 Admin 사용자 관리 arc 7번째 slice — T-1163 reviewer 지적(컨테이너 배선 부재로 진행 표면 미도달) 해소
---

# T-1164 — AdminView 역할 변경 진행 상태를 boolean → 진행 id 로 전환하고 UserList 에 배선

## Why

PLAN.md P6 line 120 (Admin 패널) 사용자 관리 arc 의 7번째 slice 다. T-1163 이 `UserList` 에 `changingRoleId` prop 을 열어 진행 중인 행의 `disabled` + `aria-busy` + 진행 문구를 렌더할 수 있게 했지만, 컨테이너(`AdminView`) 는 여전히 `changingRole: boolean` 만 들고 있고 그 prop 을 내려보내지 않는다. 그래서 T-1163 reviewer 가 지적한 대로 **실사용 화면 동작은 아직 하나도 바뀌지 않았다** — 역할 변경 PATCH 가 진행 중이어도 모든 버튼이 활성으로 보이고, 러너의 in-flight 가드가 두 번째 클릭을 아무 피드백 없이 삼킨다.

본 task 는 그 마지막 배선 slice 다 — 컨테이너 state 를 `changingRole: boolean` 에서 `changingRoleId: string | undefined` (진행 중인 사용자 id) 로 바꾸고, `runChangeRole` 러너가 발사 시작 시 대상 id 를 박제 / 종료 시 비우도록 deps 계약을 옮긴 뒤, 그 값을 `UserList` 로 내려보낸다. 이로써 T-1161 (콜백 표면) → T-1162 (PATCH 배선) → T-1163 (진행 표면) 3 slice 가 실제 화면에서 닫힌다.

## Required Reading

- `web/src/views/AdminView.tsx` 1707~1717행 `ChangeRoleDeps` 인터페이스 — 특히 `changing: boolean` / `setChanging: (next: boolean) => void` 두 필드. 본 task 가 바꾸는 계약이다.
- `web/src/views/AdminView.tsx` 1719~1758행 `runChangeRole` 러너 본체 — 발사 억제 가드 (`!trimmedId || !trimmedRole || deps.changing`), 시작 시 `deps.setChanging(true)` + `deps.setChangeError(undefined)`, 성공 시 `bumpRefresh()`, 403 분기, `finally` 의 `deps.setChanging(false)`. **PATCH path / body / 403 문구 / bumpRefresh 정책은 일절 바꾸지 않는다** — 진행 상태 표현만 바꾼다.
- `web/src/views/AdminView.tsx` 3463~3484행 — `changingRole` state 선언 + `handleChangeRole` useCallback (`changing: changingRole`, `setChanging: setChangingRole`, deps 배열 `[changingRole]`).
- `web/src/views/AdminView.tsx` 4114~4119행 `<UserList users / loading / error / onChangeRole />` 마운트 지점 (사용자 관리 섹션, isAdmin gating 안쪽). 여기에 prop 1개를 추가한다.
- `web/src/components/UserList.tsx` 66~92행 (`UserListProps` 의 `changingRoleId?: string` 선언 + `const changing = Boolean(changingRoleId)`) 과 118~130행 (`rowBusy = changing && rowId === changingRoleId` 로 `disabled` / `aria-busy` 렌더) — **읽기만** 한다. 본 task 는 `UserList` 를 수정하지 않는다. 매칭이 `row.id` 원본 문자열 동등 비교라는 점이 아래 "원본 id 박제" 판단의 근거다.
- `web/src/views/AdminView.test.tsx` 8460~8620행 `describe('AdminView — 사용자 역할 변경 실 PATCH mutation (T-1162 runChangeRole)')` 전체 — 특히 8476~8503행 `makeRoleDeps(changing: boolean)` harness (`calls.changing: boolean[]` 기록) 와 그 harness 를 쓰는 기존 assertion 6곳 (`expect(calls.changing).toEqual([true, false])` 형태, 8548 / 8560 / 8579 / 8601 / 8618행). deps 계약이 바뀌므로 이 harness 와 assertion 들을 함께 갱신한다.
- `web/src/views/AdminView.test.tsx` 상단 import 블록 (`ChangeRoleDeps` 타입 + `runChangeRole` 를 88~100행 부근에서 import) — 새 필드명으로 타입이 바뀌어도 import 목록은 그대로여야 한다.

## Acceptance Criteria

- [ ] `ChangeRoleDeps` 의 `changing: boolean` → `changingId: string | undefined`, `setChanging: (next: boolean) => void` → `setChangingId: (next: string | undefined) => void` 로 전환한다. 두 필드에 한국어 주석으로 (a) 값이 "현재 PATCH 진행 중인 사용자 id" 라는 점, (b) `undefined` 가 "진행 없음" 이라는 점을 명시한다.
- [ ] `runChangeRole` 의 발사 억제 가드는 **단일 in-flight 정책을 그대로 보존**한다 — 진행 중인 id 가 무엇이든 (다른 사용자 행이어도) 새 발사는 no-op (`deps.changingId` truthy 면 return). 기존 `!trimmedId || !trimmedRole` 빈 인자 가드도 유지.
- [ ] 발사 시작 시 `deps.setChangingId(id)` 로 **trim 하지 않은 원본 id** 를 박제한다 — `UserList` 의 `rowId === changingRoleId` 가 `row.id` 원본과의 동등 비교라 trim 값을 박제하면 진행 표시가 매칭되지 않기 때문이다. PATCH path 에는 기존대로 `encodeURIComponent(trimmedId)` 를 쓴다 (path 계약 회귀 0). 이 두 값이 의도적으로 다를 수 있다는 점을 주석 한 줄로 남긴다.
- [ ] 성공·실패 무관하게 `finally` 에서 `deps.setChangingId(undefined)` 로 비운다 (기존 `setChanging(false)` 와 동형 — 진행 상태가 남지 않는다).
- [ ] 컨테이너 state 를 `const [changingRoleId, setChangingRoleId] = useState<string | undefined>(undefined)` 로 바꾸고, `handleChangeRole` 이 `changingId: changingRoleId` / `setChangingId: setChangingRoleId` 를 주입하며 useCallback deps 배열을 `[changingRoleId]` 로 갱신한다 (stale 가드 방지).
- [ ] `<UserList ... />` 마운트에 `changingRoleId={changingRoleId}` 를 추가한다. 역할 변경 실패 문구(`changeRoleError`) alert 렌더와 `onChangeRole` 의 SuperAdmin gating (`isSuperAdmin ? handleChangeRole : undefined`) 은 **그대로 유지**한다.
- [ ] happy-path unit test 1+ — 승급(User→Admin) PATCH 성공 시 (a) `setChangingId` 호출 시퀀스가 `['u1', undefined]` 이고, (b) PATCH path/body/`bumpRefresh` 1회/error `undefined` 1회 세팅이 T-1162 기존 계약 그대로임을 확인한다. 강등(Admin→User) 경로도 1+.
- [ ] error path unit test 1+ — (a) 403 실패 시 `setChangingId` 가 `['u1', undefined]` 로 끝나고 403 전용 문구가 세팅되며 `bumpRefresh` 0, (b) 500 / 네트워크 오류 등 비-403 실패에서도 진행 id 가 `undefined` 로 정리된다 (`finally` 보장 — 진행 표시 영구 잔류 0).
- [ ] 분기 cover — 각 1+ test: `changingId=undefined` (발사됨) / `changingId='u1'` (같은 id 재발사 no-op) / `changingId='u2'` (**다른 id 여도 no-op** — 단일 in-flight) / 빈 id / 공백만 든 id / 빈 role / 공백만 든 role. no-op 경로에서는 `setChangingId` · `setChangeError` · `patch` 호출이 모두 0 이어야 한다.
- [ ] negative cases 충분 cover — 각 1+ test: (a) 공백 padding 이 든 id (`'  u1  '`) 발사 시 박제 값은 원본 `'  u1  '` 이고 PATCH path 는 trim·인코딩된 `'/api/users/u1/role'` 이다 (두 계약이 각각 유지), (b) 연속 2회 호출(첫 호출 완료 후 두 번째) 시 시퀀스가 `['u1', undefined, 'u1', undefined]` 로 누적되고 진행 id 가 겹쳐 남지 않는다, (c) 비-ApiError(순수 `Error`) throw 에서도 throw 가 새어나오지 않고 진행 id 가 정리된다, (d) `describeError` 가 호출되지 않는 403 분기와 호출되는 비-403 분기의 진행 id 정리 결과가 동일하다, (e) AdminView 초기 렌더(`renderToStaticMarkup`) 에서 진행 중이 아니므로 사용자 관리 섹션 markup 에 `aria-busy` 가 0 이고, 기존 사용자 목록·생성 폼 렌더가 회귀 0 이다.
- [ ] 기존 T-1162 describe 의 harness (`makeRoleDeps`) 와 assertion 6곳을 새 계약으로 갱신하되, **기존 검증 의도(PATCH path/body, 403 문구, bump, in-flight no-op, finally off)를 하나도 삭제하지 않는다** — 표현만 boolean 시퀀스에서 id 시퀀스로 옮긴다.
- [ ] `pnpm --dir web test` (vitest) 전체 green + `pnpm --dir web build` (tsc + vite) green. 루트 `pnpm lint` clean.
- [ ] `pnpm test:cov` 기준선 유지 — 본 task 는 `src/` 를 건드리지 않으므로 backend coverage (line ≥ 80% / function ≥ 80%) 가 그대로 통과해야 한다.
- [ ] 사이즈 게이트 — 최종 diff ≤ 300 LOC / 파일 2개. 목표 배분: `AdminView.tsx` ≤ 45 LOC, `AdminView.test.tsx` ≤ 180 LOC. 초과 예상 시 (1) 주석을 선례 참조 한 줄로 압축하고 (2) 분기 / negative test 를 `it.each` 표로 합친다. **test 항목 자체를 빼서 줄이지 말 것** (R-112 위반).

## Out of Scope

- `web/src/components/UserList.tsx` / `UserList.test.tsx` 수정 — T-1163 에서 이미 `changingRoleId` prop 과 렌더 계약이 완성돼 있다. 본 task 는 컨테이너 배선만 하고 presentational 층은 무변경이어야 한다 (변경이 필요해 보이면 Follow-ups 에 적고 진행하지 말 것 — 파일 수 cap 도 깨진다).
- 역할 변경 mutation 자체의 정책 변경 — PATCH path / body / 403 전용 문구 / `bumpRefresh` 권위 재조회 / SuperAdmin gating 은 T-1162 계약 그대로 유지.
- 다중 in-flight 허용 (행별 동시 역할 변경) — 현 정책은 단일 in-flight 다. 다중 허용은 러너·가드·상태 구조를 모두 바꾸는 별도 결정 사안.
- **(이월 — T-1162 reviewer MINOR-2)** RTL 등 상호작용 렌더 harness 도입 — `@testing-library/react` 는 새 외부 dependency 라 CLAUDE.md §5 상 BLOCKED 대상이다. 본 task 도 `renderToStaticMarkup` + 러너 직접 호출 convention 을 그대로 따른다.
- **(이월 — T-1162 reviewer NIT-3)** 403 문구의 self-demote 원인 분화 — 별도 task 후보.
- 확인 다이얼로그 / 역할 3종 select box / 낙관적 UI 갱신 / spinner 아이콘 — 본 slice 는 기존 텍스트·attribute 표면만 배선한다.
- `PartList` / `GroupList` / `PersonList` 등 다른 List 의 mutation 진행 상태를 id 화하는 동일 리팩터 확산 — 별도 task.
- backend (`src/`) · prisma schema · `web/src/api/*` · `deploy/daily-test.sh` · smoke drift-guard spec · `docs/architecture/*` 수정.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)
