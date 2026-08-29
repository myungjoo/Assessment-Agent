---
id: T-1772
title: AdminView 에 ServiceIdentity 행별 액션 어댑터 buildServiceIdentityRowActionBridge 신설
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-078, REQ-079]
estimatedDiff: 230
estimatedFiles: 2
created: 2026-08-29
independentStream: service-identity-web
dependsOn: [T-1771]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.service-identity-row-bridge.test.tsx
plannerNote: "P6/PLAN 132 행 — ADR-0058 (d) 열네 번째 web slice: 러너 boolean 계약 ↔ 플래그 id-귀속 계약 어댑터만 절단"
---

# T-1772 — AdminView 에 ServiceIdentity 행별 액션 어댑터 신설

## Why

[PLAN.md](../PLAN.md) `132 행` 오너 지시 (REQ-078 / REQ-079) 의 잔여는 [ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups (d)` **AdminView 편집 UI** 다. 읽기 ([T-1766](T-1766-adminview-service-identity-list-wiring.md)) · 추가 ([T-1767](T-1767-adminview-service-identity-create-wiring.md)) · 수정 ([T-1768](T-1768-adminview-service-identity-update-wiring.md)) 축이 배선됐고, 삭제 ([T-1769](T-1769-service-identity-delete-runner.md)) · primary ([T-1770](T-1770-service-identity-set-primary-runner.md)) 순수 러너와 행별 플래그 파생 helper ([T-1771](T-1771-service-identity-row-actions-flags.md)) 까지 올라와 있다. 남은 건 `ServiceIdentityRowActions` 마운트 한 겹이다.

그 마운트를 지금 그대로 한 slice 에 담으면 cap (≤ 300 LOC / ≤ 5 파일) 을 넘는다 — 직전 배선 3 slice 가 각각 정확히 `+300` LOC 였다. 게다가 마운트 안에는 **아직 아무도 채우지 않은 계약 간극** 이 하나 있다: 두 러너의 deps 는 `deleting: boolean` / `setDeleting(next: boolean)` / `setDeleteError(next: string | undefined)` 처럼 **행 개념이 없는 boolean · 문구 계약** 인데, `deriveServiceIdentityRowActionsFlags` 는 `busyIdentityId` / `errorIdentityId` 처럼 **행 id 귀속 계약** 을 읽는다. 그 사이를 잇는 어댑터를 마운트 JSX 안에 인라인으로 쓰면, 실패 시 `setErrorText` 만 부르고 `setErrorIdentityId` 를 빠뜨려도 어떤 test 도 깨지지 않은 채 **실패 문구가 어느 행에도 뜨지 않는 무성(無聲) 실패** 가 된다. 반대로 `setBusy(false)` 가 소유 검사 없이 진행 id 를 지우면 **다른 행의 진행 표시를 남이 꺼버리는 창** 이 열린다.

그래서 본 slice 는 그 간극만 순수 factory 로 절단한다. [ADR-0040](../decisions/ADR-0040-frontend-stack.md) `§5` 로 jsdom/RTL 상태 구동 렌더 test 가 불가한 현 harness 에서는 helper 직접 호출만이 이 전이 표를 고정할 수 있다. 마운트 (state · `useCallback` · JSX map) 는 다음 slice 로 미룬다.

## Required Reading

- `web/src/views/AdminView.tsx` `1845~1887 행` — `DeleteServiceIdentityDeps` / `runDeleteServiceIdentity` (T-1769). 본 어댑터가 채워야 할 소비처 3 필드는 `deleting: boolean` · `setDeleting` · `setDeleteError` 이며, 러너는 시작 시 `setDeleteError(undefined)` 를 먼저 부르고 `finally` 에서 `setDeleting(false)` 를 부른다 (호출 순서가 계약).
- `web/src/views/AdminView.tsx` `1891~1932 행` — `SetPrimaryServiceIdentityDeps` / `runSetPrimaryServiceIdentity` (T-1770). 필드 이름만 다르고 (`settingPrimary` · `setSettingPrimary` · `setPrimaryError`) 형태가 동일하다 — **한 어댑터가 두 축 모두에 주입** 될 수 있어야 한다.
- `web/src/views/AdminView.tsx` `2197~2250 행` — `ServiceIdentityRowFlagsInput` / `deriveServiceIdentityRowActionsFlags` / `normalizeRowId` (T-1771). 본 어댑터가 **써 넣는** state 가 그 helper 가 **읽는** 입력이다. 정규화 규칙 (`trim()`, 빈 값 = 미선택) 을 반드시 같은 방식으로 맞춘다 — `normalizeRowId` 를 재사용한다 (같은 규칙을 두 번 구현하면 drift 가 난다).
- `web/src/views/AdminView.tsx` `2407~2433 행` — `InFlightIdGate` / `createInFlightIdGate` (T-1165). 본 어댑터는 gate 를 새로 만들지 않고 **주입받아 read / write 만** 한다. `read()` 는 호출 시점 ref 값이라 render 캡처 값이 아니다.
- `web/src/views/AdminView.tsx` `5548~5563 행` 및 `5605~5612 행` — test-only export 블록 (값 / `export type`). 신규 factory 와 두 타입을 `deriveServiceIdentityRowActionsFlags` · `createInFlightIdGate` 인접에 추가해야 spec 이 import 할 수 있다.
- `web/src/views/AdminView.service-identity-row-flags.test.tsx` — 승계할 colocated spec 형식 (진리표 전량 고정 + 순수성 검증). 본 slice 의 spec 도 **동일 형식의 신규 별도 파일** 에 쓴다 (거대 `AdminView.test.tsx` 편집 회피).

## Acceptance Criteria

- [ ] `web/src/views/AdminView.tsx` 에 모듈 레벨 순수 factory `buildServiceIdentityRowActionBridge(identityId: string, deps: ServiceIdentityRowActionBridgeDeps): ServiceIdentityRowActionBridge` 와 두 인터페이스를 신설한다. `deps` 는 최소 `gate: InFlightIdGate` · `setErrorIdentityId: (next: string | undefined) => void` · `setErrorText: (next: string | undefined) => void`, 반환은 `{ busy: boolean; setBusy: (next: boolean) => void; setError: (next: string | undefined) => void }` — 그대로 두 러너 deps 의 `deleting` / `setDeleting` / `setDeleteError` (및 `settingPrimary` / `setSettingPrimary` / `setPrimaryError`) 에 꽂을 수 있는 모양이어야 한다.
- [ ] 전이 규칙 4 종을 구현한다: (a) `identityId` 가 빈 문자열 · 공백뿐이면 `busy` 는 `false` 이고 `setBusy` · `setError` 는 **아무 setter 도 호출하지 않는 no-op** (귀속 불가한 값이 state 를 오염시키지 않는다 — 그런 행은 러너 가드가 이미 no-op 이라 실패 자체가 발생하지 않는다), (b) `busy` 는 `gate.read()` 를 정규화한 값이 이 행과 **일치할 때만** `true` (다른 행의 진행은 이 행을 잠그지 않는다 — T-1771 `loading` 규칙과 동일), (c) `setBusy(true)` 는 `gate.write(<이 행 id>)`, `setBusy(false)` 는 **현재 gate 값이 이 행일 때만** `gate.write(undefined)` (늦게 끝난 요청이 남의 진행 표시를 꺼버리는 창 차단), (d) `setError(문구)` 는 문구가 truthy 일 때 `setErrorIdentityId(<이 행 id>)` 와 `setErrorText(문구)` 를 **둘 다** 호출하고, 문구가 `undefined` · 빈 문자열 · 공백뿐이면 **소유 여부와 무관하게** 둘 다 `undefined` 로 비운다 (귀속 slot 이 목록 전체에 하나뿐이라, 지우지 않으면 재시도 성공 후에도 stale 문구가 남는다).
- [ ] 위 (a) · (c) · (d) 의 근거를 `deriveServiceIdentityRowActionsFlags` 와 같은 **"(a) 결함 / (b) 그래서" 2 문단 주석** 형식으로 남기고, "`busy` 는 호출 시점 `gate.read()` 스냅샷이므로 render 시점이 아니라 **핸들러 호출 시점에 build** 해야 한다" 를 1 줄 박제한다. 행 id 정규화는 기존 `normalizeRowId` 를 재사용한다 (중복 구현 금지).
- [ ] factory 자체는 **순수** 하다 — `throw` 0, React hook 0, 모듈 밖 state 참조 0, build 시점 부수효과 0 (setter 는 반환된 함수를 호출할 때만 불린다). 같은 인자로 두 번 build 하면 같은 모양의 결과.
- [ ] 신규 factory 와 두 타입을 `web/src/views/AdminView.tsx` 하단 test-only export 블록에 추가한다 (타입은 `export type` 목록).
- [ ] 신규 colocated spec `web/src/views/AdminView.service-identity-row-bridge.test.tsx` 를 만들고 **happy-path** 1+ 를 담는다 — 이 행이 진행 중일 때 `busy === true` 이고, `setBusy(true)` → `setError('...')` → `setBusy(false)` 순서가 gate · 두 setter 를 규칙대로 호출한다 (러너의 실제 호출 순서를 재현한 시나리오 1+).
- [ ] **error path** 1+ — 실패 문구 전달 시 `setErrorIdentityId` 가 **이 행 id 로** 불렸는지 확인 (귀속 누락 차단), 그리고 그 결과를 `deriveServiceIdentityRowActionsFlags` 에 넣으면 이 행에서만 `error` 가 뜨고 다른 행에서는 `undefined` 인지 확인 (두 helper 계약 정합 검증 1+).
- [ ] **분기 (flow) cover** — 위 규칙 (a) ~ (d) 각 분기의 참 · 거짓 양쪽을 각각 1+ test 로 고정한다 (진리표 형태 권장): 빈 행 id / 정상 행 id, gate 가 이 행 · 다른 행 · `undefined`, `setBusy(true)` · `setBusy(false)`, 문구 truthy · falsy.
- [ ] **negative cases 충분 cover** — 예외 상황 각 1+ test: `identityId` 가 빈 문자열, 공백뿐, 다른 행이 진행 중일 때 `setBusy(false)` 가 `gate.write` 를 **호출하지 않음**, 빈 행 id 에서 `setBusy` · `setError` 가 어떤 setter 도 호출하지 않음, `setError('')` · `setError('   ')` · `setError(undefined)` 가 모두 두 setter 를 `undefined` 로 비움, 앞뒤 공백만 다른 gate 값이 같은 행으로 취급됨, build 만 하고 아무 것도 호출하지 않으면 setter 호출 0.
- [ ] `web/src/views/AdminView.tsx` 의 **컨테이너 본문 · JSX 는 이번에 수정하지 않는다** — 소비처는 다음 마운트 slice 이므로 spec 에 소스 문자열 drift guard 를 넣지 않는다 (미소비 상태를 guard 가 곧바로 red 로 만든다). 대신 factory 주석에 "소비처는 후속 `ServiceIdentityRowActions` 마운트 slice" 를 1 줄 남긴다.
- [ ] `cd web && pnpm lint && pnpm build && pnpm test` 전량 green (`tsc --noEmit` 의 `noUnusedLocals` 위반 0 — 신규 심볼은 export 로 소비된다).
- [ ] 루트 `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — web coverage threshold 도 유지.

## Out of Scope

- `ServiceIdentityRowActions` 마운트 (JSX map · 컨테이너 `useState` / `useRef` / `useMemo` / `useCallback`) — 다음 slice.
- `runDeleteServiceIdentity` · `runSetPrimaryServiceIdentity` · `deriveServiceIdentityRowActionsFlags` · `createInFlightIdGate` 의 **기존 계약 수정** — 이미 머지된 시그니처를 그대로 둔다.
- `web/src/components/ServiceIdentityRowActions.tsx` · `ServiceIdentityList.tsx` · `web/src/api/serviceIdentity.ts` 수정.
- backend (`src/`) · prisma schema · 워크플로 · `package.json` 수정, 새 dependency 추가.
- Admin RBAC gating, `docs/architecture/api.md` · `docs/requirements.md` REQ-078 / REQ-079 재판정 doc-sync (ADR-0058 §Follow-ups (e)).
- `web/src/views/AdminView.test.tsx` (거대 파일) 에 case 추가 — 신규 별도 spec 파일만 쓴다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

## 결과 (2026-08-29 완료)

- **Status: DONE** — 2026-08-29T02:54:32Z, PR [#1400](https://github.com/myungjoo/Assessment-Agent/pull/1400) squash 머지 `9a7da367`.
- `web/src/views/AdminView.tsx` 에 순수 factory `buildServiceIdentityRowActionBridge` + 인터페이스 2 개를 신설하고, colocated spec `AdminView.service-identity-row-bridge.test.tsx` 를 붙였다 (2 파일 `+266/-0`, cap 이내 · 새 dependency 0 · 컨테이너 본문/JSX 무수정).
- 러너 deps 의 boolean 계약(`deleting` / `setDeleting` / `setDeleteError`)과 T-1771 플래그 helper 의 id-귀속 계약(`busyIdentityId` / `errorIdentityId`) 사이 간극을 전이 규칙 (a)~(d) 로 절단했다. `normalizeRowId` 재사용으로 정규화 규칙을 단일화해, `setErrorIdentityId` 누락 시 실패 문구가 어느 행에도 뜨지 않는 무성 실패와 `setBusy(false)` 소유 미검사로 남의 진행 표시를 꺼버리는 창을 막았다.
- 신규 spec 24 케이스(happy 2 · error 2 · 진리표 14 · negative 6) 전량 green, web 95 파일 2809 케이스 green, 루트 `test:cov`(line/function 80%) · lint · build(tsc --noEmit + vite) green.
- reviewer APPROVE(round 1/7) + PR comment 외부 post + CI green 4-게이트 PASS.
- 잔여 `ADR-0058 §Follow-ups (d)`: `ServiceIdentityRowActions` 마운트(러너 2 종 + 플래그 helper + bridge 준비 완료) + Admin RBAC gating + doc-sync.
