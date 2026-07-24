---
id: T-1165
title: AdminView 역할 변경 in-flight 가드를 ref 기반으로 전환해 stale closure 이중 발사 차단
phase: P6
status: DONE
prNumber: 1057
completedAt: 2026-07-24T02:05:00Z
commitMode: pr
coversReq: [REQ-044, REQ-045]
estimatedDiff: 190
estimatedFiles: 2
created: 2026-07-24
independentStream: web-admin-user
dependsOn: [T-1164]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.test.tsx
plannerNote: P6 line120 Admin 사용자 관리 arc 8번째 slice — T-1164 reviewer MINOR-2(가드 stale closure 창) 해소
---

# T-1165 — AdminView 역할 변경 in-flight 가드를 ref 기반으로 전환해 stale closure 이중 발사 차단

## Why

PLAN.md P6 line 120 (Admin 패널) 사용자 관리 arc 의 8번째 slice 다. T-1161~T-1164 로 역할 변경 콜백 → PATCH 배선 → 진행 표면 → 진행 id 전환까지 닫혔지만, T-1164 reviewer 가 MINOR-2 로 남긴 결함이 그대로 있다 — `handleChangeRole` 은 `useCallback(..., [changingRoleId])` 로 memo 되어 **render 시점의** `changingRoleId` 를 캡처하는데, `setChangingRoleId(id)` 는 비동기 re-render 이후에야 새 closure 를 만든다. 그래서 첫 클릭 직후 re-render 전에 두 번째 클릭이 들어오면 두 호출 모두 `changingId: undefined` 를 보고 **PATCH 가 2회 발사**된다. 단일 in-flight 정책이 실사용 빠른 연속 클릭에서 뚫리는 창이다.

본 task 는 그 창을 닫는다 — 진행 id 를 `useRef` 에 **동기적으로** 선반영하는 gate 를 두고, 러너에 주입하는 `changingId` 를 render state 가 아니라 ref 의 현재 값으로 읽게 한다. `useState` 값은 `UserList` 로 내려보내는 렌더 표면이라 그대로 유지한다(ref 는 렌더를 트리거하지 않으므로 state 를 대체할 수 없다 — 둘을 함께 쓴다). 러너(`runChangeRole`) 본체·PATCH 계약은 무변경이다.

## Required Reading

- `web/src/views/AdminView.tsx` 1711~1722행 `ChangeRoleDeps` — `changingId: string | undefined` / `setChangingId: (next: string | undefined) => void` 두 필드. **본 task 는 이 인터페이스를 바꾸지 않는다** (주입되는 값의 출처만 바뀐다).
- `web/src/views/AdminView.tsx` 1730~1766행 `runChangeRole` 러너 본체 — 발사 억제 가드(`!trimmedId || !trimmedRole || deps.changingId`), 시작 시 `deps.setChangingId(id)`(trim 하지 않은 원본), `finally` 의 `deps.setChangingId(undefined)`. **러너는 무변경** — 본 task 가 바꾸는 것은 컨테이너가 주입하는 `changingId` 를 언제 읽느냐뿐이다.
- `web/src/views/AdminView.tsx` 3470~3496행 — `const [changingRoleId, setChangingRoleId] = useState<string | undefined>(undefined)` 선언 + `handleChangeRole` useCallback (`changingId: changingRoleId`, `setChangingId: setChangingRoleId`, deps 배열 `[changingRoleId]`). 결함 지점이다.
- `web/src/views/AdminView.tsx` 18행 import 문 (`import { useCallback, useMemo, useState } from 'react';`) — `useRef` 를 추가해야 한다. 20행의 `request` / 19행의 `toErrorMessage` 는 **모듈 import 라 참조가 stable** 하다(useCallback deps 축소 판단 근거).
- `web/src/views/AdminView.tsx` 4126~4133행 `<UserList ... onChangeRole={isSuperAdmin ? handleChangeRole : undefined} changingRoleId={changingRoleId} />` 마운트 — **여기는 계속 state 값(`changingRoleId`)을 내려보낸다**. ref 값을 내려보내면 리렌더가 일어나지 않아 진행 표면이 죽는다.
- `web/src/views/AdminView.tsx` 4480~4544행 test-only export 블록 (`runChangeRole` / `ChangeRoleDeps` 가 각각 값·타입 export 목록에 있음) — 새 helper 와 그 타입을 같은 목록에 추가한다.
- `web/src/views/AdminView.test.tsx` 8464~8660행 `describe('AdminView — 사용자 역할 변경 실 PATCH mutation (T-1162 runChangeRole)')` 의 `makeRoleDeps` harness 와 8666행~ `describe('AdminView — 역할 변경 진행 id 배선 (T-1164 changingRoleId)')` 의 축약 `makeDeps` harness — 본 task 의 새 describe 는 이 두 harness 의 convention(러너 직접 호출 + mock deps, jsdom/RTL 없음)을 그대로 따른다.

## Acceptance Criteria

- [ ] `AdminView.tsx` 에 순수 factory helper `createInFlightIdGate(ref, setState)` 를 추가한다 — 인자는 `{ current: string | undefined }` 형태의 ref-like 객체와 state setter 이며, 반환은 `{ read: () => string | undefined; write: (next: string | undefined) => void }`. `write` 는 **먼저 `ref.current` 에 동기 반영한 뒤** `setState(next)` 를 호출한다(순서가 계약 — 동기 선반영이 본 task 의 전부다). `read` 는 `ref.current` 를 그대로 돌려준다. 반환 타입에도 이름을 붙여(`InFlightIdGate` 등) test-only export 블록의 타입 목록에 추가한다.
- [ ] helper 와 그 두 메서드에 한국어 주석으로 (a) state 만으로는 render 사이 창에서 stale 값이 읽힌다는 결함, (b) 그래서 가드 읽기는 ref, 렌더 표면은 state 라는 이중 보관 이유를 남긴다.
- [ ] 컨테이너에서 `useRef<string | undefined>(undefined)` 로 진행 id ref 를 만들고 gate 를 구성한 뒤, `handleChangeRole` 이 러너에 `changingId: gate.read()` (호출 시점 읽기) / `setChangingId: gate.write` 를 주입하도록 바꾼다. `useState` 의 `changingRoleId` 선언과 `<UserList changingRoleId={changingRoleId} />` 배선은 **그대로 유지**한다.
- [ ] `handleChangeRole` 의 useCallback deps 배열에서 `changingRoleId` 를 제거한다 — 가드가 render state 를 더는 읽지 않아 재생성이 불필요하며, 오히려 handler 참조가 매 진행 전이마다 바뀌지 않게 된다. 남는 참조(`request` / `toErrorMessage` / setter / gate)가 모두 stable 함을 주석 한 줄로 근거 남긴다.
- [ ] `runChangeRole` 본체·`ChangeRoleDeps` 인터페이스·PATCH path/body·403 전용 문구·`bumpRefresh` 권위 재조회·SuperAdmin gating 은 **한 줄도 바꾸지 않는다** (계약 회귀 0).
- [ ] happy-path unit test 1+ — gate 의 `write('u1')` 직후 **await 없이** `read()` 가 `'u1'` 을 돌려주고(동기 선반영), `setState` 가 `'u1'` 로 정확히 1회 호출된다. `write(undefined)` 로 비운 뒤 `read()` 가 `undefined` 인 경로도 1+.
- [ ] **regression test 1+ (본 task 의 핵심)** — gate 를 주입한 deps 로 `runChangeRole('u1', 'Admin', deps)` 를 **await 하지 않고 연속 2회** 호출했을 때 `patch` mock 이 정확히 1회만 호출된다(두 번째는 no-op). 비교축으로, 같은 시나리오를 render-state 캡처 방식(고정 `changingId: undefined`)으로 흉내내면 2회 발사됨을 같은 test 또는 인접 test 에서 대조 단언해, 본 fix 가 무엇을 막는지 test 가 스스로 증언하게 한다.
- [ ] error path unit test 1+ — (a) PATCH 가 reject(403 / 비-403) 한 뒤에도 `finally` 의 `gate.write(undefined)` 로 ref 가 비워져 **다음 발사가 정상적으로 통과**한다(진행 id 영구 잔류로 인한 영구 잠금 0), (b) `setState` 가 throw 하는 비정상 setter 를 주입해도 `ref.current` 는 이미 갱신된 상태다(ref 우선 순서 계약 확인).
- [ ] 분기 cover — 각 1+ test: `read()` 가 `undefined` 일 때 발사됨 / `'u1'` 일 때(같은 id 재발사) no-op / `'u2'` 일 때(다른 id) no-op / 빈 id / 공백만 든 id / 빈 role. no-op 경로에서는 `patch` · `setChangeError` · `setState` 호출이 모두 0 이어야 한다.
- [ ] negative cases 충분 cover — 각 1+ test: (a) 공백 padding 이 든 id(`'  u1  '`) 발사 시 ref 에 박제되는 값은 원본 `'  u1  '` 이고 PATCH path 는 `'/api/users/u1/role'` 이다(T-1164 의 원본/trim 분리 계약 회귀 0), (b) 첫 호출 완료 후 두 번째 호출은 정상 발사되어 `patch` 가 총 2회이고 ref 시퀀스가 켜짐→꺼짐 쌍으로 누적된다, (c) 같은 값으로 `write` 를 2회 연속 호출해도 ref·setState 가 각각 그 값으로 일관되게 남는다(멱등), (d) 비-ApiError(순수 `Error`) throw 에서도 throw 가 새어나오지 않고 ref 가 정리된다, (e) `AdminView` 초기 렌더(`renderToStaticMarkup`)에서 사용자 관리 섹션 markup 에 `aria-busy` 가 0 이고 사용자 목록·생성 폼 렌더가 회귀 0 이다.
- [ ] 새 describe 는 기존 T-1162 / T-1164 describe 의 assertion 을 **하나도 삭제·약화하지 않는다** — 두 harness 는 `ChangeRoleDeps` 계약 무변경이라 그대로 통과해야 한다.
- [ ] `pnpm --dir web test` (vitest) 전체 green + `pnpm --dir web build` (tsc + vite) green. 루트 `pnpm lint` clean.
- [ ] `pnpm test:cov` 기준선 유지 — 본 task 는 `src/` 를 건드리지 않으므로 backend coverage (line ≥ 80% / function ≥ 80%) 가 그대로 통과해야 한다.
- [ ] 사이즈 게이트 — 최종 diff ≤ 300 LOC / 파일 2개. 목표 배분: `AdminView.tsx` ≤ 45 LOC, `AdminView.test.tsx` ≤ 150 LOC. 초과 예상 시 (1) 주석을 선례 참조 한 줄로 압축하고 (2) 분기 / negative test 를 `it.each` 표로 합친다. **test 항목 자체를 빼서 줄이지 말 것** (R-112 위반).

## Out of Scope

- `web/src/components/UserList.tsx` / `UserList.test.tsx` 수정 — presentational 층은 T-1163 에서 완성됐고 본 fix 는 컨테이너 내부 문제다. 파일 수 cap 도 깨진다.
- 역할 변경 mutation 정책 변경 — PATCH path / body / 403 전용 문구 / `bumpRefresh` / SuperAdmin gating / 단일 in-flight 정책 자체는 유지. 본 task 는 **기존 정책이 새는 창을 막을 뿐** 정책을 바꾸지 않는다.
- 다중 in-flight 허용(행별 동시 역할 변경) — 별도 결정 사안.
- **(이월 — T-1164 reviewer NIT-1)** RTL 등 상호작용 렌더 harness 도입으로 pass-down 값 경로 잠그기 — `@testing-library/react` 는 새 외부 dependency 라 CLAUDE.md §5 상 BLOCKED 대상이다. 본 task 도 `renderToStaticMarkup` + 러너·helper 직접 호출 convention 을 그대로 따른다.
- **(이월 — T-1162 reviewer NIT-3)** 403 문구의 self-demote 원인 분화 — 별도 task 후보.
- 같은 ref-gate 패턴을 다른 mutation(인원·그룹·파트 생성/삭제/수정, provider CRUD)으로 확산하는 리팩터 — 본 task 는 역할 변경 경로 하나만 고친다. helper 를 재사용 가능한 형태로 두되 호출부 확산은 별도 task.
- 확인 다이얼로그 / 역할 select box / 낙관적 UI 갱신 / spinner 아이콘 / 디바운스·쓰로틀 도입.
- backend (`src/`) · prisma schema · `web/src/api/*` · `deploy/daily-test.sh` · smoke drift-guard spec · `docs/architecture/*` 수정.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)
