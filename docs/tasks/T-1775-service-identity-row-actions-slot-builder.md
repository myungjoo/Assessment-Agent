---
id: T-1775
title: AdminView 에 ServiceIdentity 행별 액션 slot factory buildServiceIdentityRowActionsSlot 신설
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-078, REQ-079]
estimatedDiff: 210
estimatedFiles: 2
independentStream: web-admin-service-identity
dependsOn: [T-1773, T-1774]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.service-identity-row-slot.test.tsx
created: 2026-08-29
plannerNote: P6 ADR-0058 §Follow-ups (d) 열일곱 번째 web slice — props factory(T-1773) + list slot(T-1774) 사이 렌더 slot 절단, cap 초과 회피
---

# T-1775 — AdminView 에 ServiceIdentity 행별 액션 slot factory `buildServiceIdentityRowActionsSlot` 신설

## Why

[ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups (d)` (AdminView 편집 UI)
의 잔여는 `ServiceIdentityRowActions` 를 실제로 목록에 마운트하는 배선이다. 직전 slice 로
러너 2 종(T-1769 / T-1770) · 플래그 helper(T-1771) · 어댑터(T-1772) · props 조립 factory(T-1773) ·
`ServiceIdentityList` 의 optional slot `renderRowActions`(T-1774) 가 모두 준비됐다.

남은 마운트를 한 slice 로 담으면 컨테이너 state 4 종 + in-flight gate + wiring deps memo +
`renderRowActions` JSX + spec 을 한꺼번에 실어야 해서, 직전 배선 slice 실적(T-1773 이 정확히
`+300`)상 cap(≤ 300 LOC / ≤ 5 파일) 초과가 확실하다. 그래서 본 slice 는 **"행 → 액션 노드"
변환 한 겹**(props factory 호출 + 컴포넌트 element 생성)만 모듈 레벨 순수 factory 로 절단하고,
컨테이너 state · gate · deps memo · JSX 마운트는 다음 slice 로 미룬다. `web/tsconfig.json` 의
`noUnusedLocals` 때문에 컨테이너 state 만 먼저 두는 분할은 불가하므로, 모듈 레벨 export 가능한
순수 factory 로 절단하는 것이 이 chain 에서 유일하게 성립하는 분할 축이다(T-1772 선례).

본 factory 가 막는 결함: (1) slot 을 마운트 JSX 안 인라인 화살표로 두면 `buildServiceIdentityRowActionsProps`
(T-1773) 를 우회해 props 를 손으로 다시 조립하는 drift 가 열리고, (2) 행마다가 아니라 slot 생성
시점에 한 번만 props 를 만들면 한 행의 플래그(진행 중 · 삭제 확인 · 실패 문구)가 모든 행에 복제되며,
(3) 현재 `ServiceIdentityRowActions` 는 AdminView 에 **type-only import** 뿐이라 값 import 로의
승격을 배선 slice 와 함께 처리하면 회귀 표면이 두 겹으로 겹친다.

## Required Reading

- `web/src/views/AdminView.tsx` — 다음 구간만: `81~89 행`(현재의 type-only import + api client import),
  `2200~2253 행`(`deriveServiceIdentityRowActionsFlags`), `2254~2325 행`(`buildServiceIdentityRowActionBridge`),
  `2327~2425 행`(`ServiceIdentityRowActionsWiringDeps` + `buildServiceIdentityRowActionsProps`),
  `5682~5799 행`(하단 `export { ... }` / `export type { ... }` 블록)
- `web/src/components/ServiceIdentityRowActions.tsx` — `ServiceIdentityRowActionsProps` 9 props 계약
- `web/src/components/ServiceIdentityList.tsx` — `renderRowActions?: (identity: ServiceIdentityRow) => ReactNode` slot 계약(T-1774)
- `web/src/views/AdminView.service-identity-row-props.test.tsx` — 주입 harness(gate stub · setter 스파이) 형식. 본 slice 의 새 spec 이 그대로 승계한다
- `docs/decisions/ADR-0058-service-identity-management-api.md` — `§Follow-ups (d)`, `§Decision 2`
- `docs/decisions/ADR-0041-frontend-composition-wiring.md` — `§Decision 1`(presentational 경계: 조립은 컨테이너 책임)

## Acceptance Criteria

- [ ] `web/src/views/AdminView.tsx` 에 모듈 레벨 순수 factory `buildServiceIdentityRowActionsSlot(deps: ServiceIdentityRowActionsWiringDeps): (identity: ServiceIdentityRow) => ReactElement` 를 신설한다. 반환 함수는 호출될 때마다 `buildServiceIdentityRowActionsProps(identity, deps)` 를 새로 호출하고 그 결과를 `ServiceIdentityRowActions` 에 그대로 spread 한 element 를 돌려준다 — props 재조립 · 필드 추가/누락 · 결과 캐싱 금지.
- [ ] deps 타입은 `ServiceIdentityRowActionsWiringDeps`(T-1773) 를 **재선언 없이** 그대로 재사용한다(같은 모양 중복 정의 시 drift). 새 인터페이스 신설은 금지.
- [ ] `ServiceIdentityRowActions` 를 값(default) import 로 승격한다 — 기존 `import type { ServiceIdentityRowActionsProps }` 는 유지하되 값 import 를 함께 둔다. 새 dependency 0 · backend 무변경.
- [ ] 신설 factory 를 파일 하단 `export { ... }` 블록에 추가해 spec 이 직접 호출할 수 있게 한다(기존 `buildServiceIdentityRowActionsProps` 선례와 동일 위치).
- [ ] 컨테이너 본문(`AdminView` 함수 내부 state · handler · JSX) 은 **무수정** — `renderRowActions` 실제 전달은 다음 slice 책임. 본 slice 의 소비처는 spec 뿐이다.
- [ ] 신규 colocated spec `web/src/views/AdminView.service-identity-row-slot.test.tsx` 를 추가한다. RTL 상태 구동 렌더 없이(ADR-0040 `§5`) factory 를 직접 호출하고 반환 element 의 `type` · `props` 를 검사한다.
- [ ] happy-path test 1+ — slot(row) 가 `type === ServiceIdentityRowActions` 이고 `props.identity` 가 넘긴 행과 동일 참조이며, 9 props(`identity` · `onEdit` · `onDeleteRequest` · `onDeleteConfirm` · `onDeleteCancel` · `onSetPrimary` · `confirmingDelete` · `loading` · `error`) 가 모두 실려 있음을 검증.
- [ ] error path test 1+ — 행 id 가 빈 문자열 · 공백뿐인 행으로 slot 을 호출하면 플래그 3 종이 전부 꺼짐이고 콜백 5 종이 어떤 주입 함수(`remove` · `setPrimary` · `setConfirmingDeleteId` · `onEdit`)도 부르지 않는 no-op 임을 검증(T-1773 귀속 불가 규칙 승계). 추가로 `remove` 가 reject 하는 주입에서 실패 문구가 `setErrorIdentityId` · `setErrorText` 짝으로 귀속됨을 검증.
- [ ] 분기 cover test — 같은 slot 함수로 서로 다른 두 행을 호출했을 때 (a) 진행 중 행만 `loading: true`, (b) 삭제 확인 대상 행만 `confirmingDelete: true`, (c) 실패 귀속 행만 `error` 문구를 갖고 다른 행은 `undefined` 임을 각각 1+ test 로 고정(플래그가 전 행에 복제되는 창 차단).
- [ ] negative cases 충분 cover — 최소 6 종: ① 행 id 빈 문자열 ② 공백만인 행 id ③ 미선택 sentinel `''` 이 든 `confirmingDeleteId` 가 어떤 행도 열지 않음 ④ `errorText` 없이 `errorIdentityId` 만 있을 때 `error` 미노출 ⑤ `personId` 미선택(빈 값)에서 `onDeleteConfirm` 이 러너 가드로 no-op ⑥ slot 을 같은 행으로 두 번 호출하면 매번 새 props 객체가 만들어져(캐싱 0) 그 사이 바뀐 deps 상태가 반영됨.
- [ ] `onDeleteConfirm` 이 `remove(personId, identity.id)` 를, `onSetPrimary` 가 `setPrimary(personId, identity.id)` 를 각각 인자 순서 그대로 호출함을 검증(두 primitive 는 시그니처가 같아 스왑 주입이 컴파일을 통과하는 축 교차 사고 — T-1773 `§(a)(1)`).
- [ ] `pnpm --dir web test` green · `pnpm --dir web build`(tsc --noEmit + vite) green.
- [ ] 루트 `pnpm lint` 통과 · `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%).

## Out of Scope

- 컨테이너 state 4 종(`confirmingDeleteIdentityId` · 진행 id + ref/gate · `errorIdentityId` · `errorText`) 신설과 `useMemo` wiring deps 조립 — 다음 slice.
- `<ServiceIdentityList renderRowActions={...} />` 실제 전달 및 그 markup 회귀 spec — 다음 slice.
- `deleteServiceIdentity` · `setPrimaryServiceIdentity` client 함수의 컨테이너 기본 주입 — 다음 slice(본 slice 는 deps 로 받기만 한다).
- `ServiceIdentityRowActions` · `ServiceIdentityList` · 두 러너 · 플래그 helper · 어댑터 · props factory 본문 수정(전부 기존 계약 그대로 소비).
- Admin RBAC gating(`(d)` 잔여) 및 `api.md` / `requirements.md` doc-sync(`(e)`).
- backend(`src/`) · Prisma schema · 새 dependency 추가.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 append)

---

## 완료 기록

- 완료 시각: 2026-08-29T05:57:23Z (PR [#1403](https://github.com/myungjoo/Assessment-Agent/pull/1403) squash 머지 `94d6a997`)
- 결과 요약: `web/src/views/AdminView.tsx` 하단 export 블록에 순수 factory `buildServiceIdentityRowActionsSlot` 신설 + colocated spec 12 test (2 파일 `+218/-0`). deps 는 `ServiceIdentityRowActionsWiringDeps` 재사용(타입 재선언 0), `ServiceIdentityRowActions` 값 import 승격, 컨테이너 본문/JSX 무수정 · 새 dependency 0 · backend 무변경. reviewer APPROVE(round 1/7, finding 0) + CI green 으로 4-게이트 PASS.
