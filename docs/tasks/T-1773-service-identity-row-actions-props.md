---
id: T-1773
title: AdminView 에 ServiceIdentity 행별 액션 props 조립 helper buildServiceIdentityRowActionsProps 신설
phase: P6
status: DONE
commitMode: pr
prNumber: 1401
completedAt: 2026-08-29T04:04:01Z
mergeCommit: 2af5586a
coversReq: [REQ-078, REQ-079]
estimatedDiff: 260
estimatedFiles: 2
created: 2026-08-29
independentStream: service-identity-web
dependsOn: [T-1772]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.service-identity-row-props.test.tsx
plannerNote: "P6/PLAN 132 행 — ADR-0058 (d) 열다섯 번째 web slice: 행 props 5 콜백 + 3 플래그 조립만 순수 factory 로 절단"
---

# T-1773 — AdminView 에 ServiceIdentity 행별 액션 props 조립 helper 신설

## Why

[PLAN.md](../PLAN.md) 132 행 오너 지시 (R-182~R-183 — 인원별 서비스 ID 매핑 관리 API·UI) 의 web 축이자
[ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups (d)` 의 **열다섯 번째 web slice** 다.
앞선 네 slice 가 삭제 러너 (T-1769) · primary 러너 (T-1770) · 행별 플래그 helper (T-1771) · 행별 액션 어댑터 (T-1772) 를
차례로 박제해 재료는 모두 준비됐지만, 그 재료를 `ServiceIdentityRowActions` 가 요구하는 **props 한 덩어리 (identity + 콜백 5 종 + 플래그 3 종)**
로 묶는 조립 층이 아직 없다. 본 slice 는 그 조립만 순수 factory 로 절단한다 — 마운트 JSX 와 컨테이너 state 는 다음 slice 로 남긴다.

조립을 마운트 JSX 의 행 `map` 안 인라인으로 두면 다음 세 사고가 **어떤 test 도 깨지 않은 채** 지나간다.

1. **축 교차** — 삭제 러너의 `remove` 와 primary 러너의 `setPrimary` 는 시그니처가 `(personId, identityId) => Promise<unknown>`
   로 완전히 같아, 주입을 서로 바꿔 꽂아도 컴파일이 통과한다. 결과는 "identity 삭제" 버튼이 primary 지정 POST 를 쏘는 사고다.
   같은 이유로 `personId` / `identityId` 인자 순서를 뒤바꿔도 (둘 다 `string`) 타입이 잡아주지 않는다.
2. **굳은 busy 스냅샷** — `buildServiceIdentityRowActionBridge` 의 `busy` 는 호출 시점 `gate.read()` 스냅샷이다
   (T-1772 주석). render 시점에 한 번만 build 해서 콜백이 그 객체를 캡처하면 in-flight 가드가 항상 직전 render 값을 보게 되어
   이중 발사 차단이 죽는다.
3. **남의 확인 단계 닫기** — 삭제 취소가 소유 검사 없이 `confirmingDeleteId` slot 을 비우면, 목록 전체에 하나뿐인 그 slot 때문에
   다른 행이 열어둔 확인 단계까지 닫힌다.

## Required Reading

- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) — 다음 구간만:
  - 1845~1935 행: `DeleteServiceIdentityDeps` / `runDeleteServiceIdentity` / `SetPrimaryServiceIdentityDeps` / `runSetPrimaryServiceIdentity` (본 helper 가 발사할 러너 2 종과 그 deps 필드 이름)
  - 2197~2249 행: `ServiceIdentityRowFlagsInput` / `ServiceIdentityRowActionsFlags` / `deriveServiceIdentityRowActionsFlags` / `normalizeRowId`
  - 2251~2325 행: `ServiceIdentityRowActionBridgeDeps` / `ServiceIdentityRowActionBridge` / `buildServiceIdentityRowActionBridge`
  - 2482~2510 행 부근: `InFlightIdGate` / `createInFlightIdGate`
  - 5620~5700 행 부근: 파일 말미 `export { ... }` + `export type { ... }` 블록 (신규 symbol 을 여기에 추가해야 `noUnusedLocals` 를 통과한다)
- [web/src/components/ServiceIdentityRowActions.tsx](../../web/src/components/ServiceIdentityRowActions.tsx) — `ServiceIdentityRowActionsProps` 계약 (필수 prop 6 · 선택 prop 3)
- [web/src/api/serviceIdentity.ts](../../web/src/api/serviceIdentity.ts) — `ServiceIdentityRow` 타입과 `deleteServiceIdentity` / `setPrimaryServiceIdentity` 시그니처
- [web/src/views/AdminView.service-identity-row-bridge.test.tsx](../../web/src/views/AdminView.service-identity-row-bridge.test.tsx) — 직전 slice 의 colocated spec 형식 (본 slice spec 이 승계할 선례)
- [docs/decisions/ADR-0058-service-identity-management-api.md](../decisions/ADR-0058-service-identity-management-api.md) — `§Decision 1` (idempotent primary 지정) · `§Decision 2` (1 인원 1 primary invariant · 자동 승격은 backend 책임) · `§Follow-ups (d)`
- [docs/decisions/ADR-0040-frontend-stack.md](../decisions/ADR-0040-frontend-stack.md) — `§5` (새 dependency 도입 절차 → RTL 미도입으로 상태 구동 렌더 test 가 불가하므로 순수 helper 직접 호출로 진리표를 고정하는 근거)

## Acceptance Criteria

- [ ] `web/src/views/AdminView.tsx` 에 순수 factory `buildServiceIdentityRowActionsProps(identity, deps)` 와 그 주입 계약
      `interface ServiceIdentityRowActionsWiringDeps` **정확히 2 개**의 새 module-level symbol 을 신설한다. 반환 타입은
      `ServiceIdentityRowActions` 에서 `import type` 한 `ServiceIdentityRowActionsProps` 를 그대로 쓴다 (같은 모양을 재선언하면 drift 가 난다).
- [ ] 반환 props 의 플래그 3 종 (`confirmingDelete` / `loading` / `error`) 은 `deriveServiceIdentityRowActionsFlags` (T-1771) 결과를
      그대로 싣는다 — 판정 로직을 본 helper 안에서 다시 구현하지 않는다.
- [ ] 콜백 5 종 매핑을 다음과 같이 고정한다.
      `onEdit` → 주입 콜백에 `identity` 를 그대로 전달 / `onDeleteRequest` → 확인 대상 slot 을 이 행 id 로 설정 /
      `onDeleteCancel` → 이 행이 확인 대상일 때만 slot 을 비움 (소유 검사) / `onDeleteConfirm` → `runDeleteServiceIdentity` /
      `onSetPrimary` → `runSetPrimaryServiceIdentity`. 두 러너에는 각각 주입된 `remove` · `setPrimary` 만 꽂고 인자는 항상
      `(personId, identity.id)` 순서다.
- [ ] `buildServiceIdentityRowActionBridge` 는 **콜백 호출 시점** 에 build 한다 (render 시점 1 회 build 금지). 그 근거를 주석으로 박제한다.
- [ ] 행 id 정규화는 `normalizeRowId` 를 재사용한다. 정규화 결과가 빈 행은 다섯 콜백 모두 어떤 주입 함수도 부르지 않는 no-op 이며
      플래그 3 종은 모두 꺼짐이다.
- [ ] `buildServiceIdentityRowActionsProps` 호출 자체는 부수효과 0 이다 — 반환 시점까지 어떤 setter · 러너 · fetch 도 호출하지 않고
      인자 객체도 변형하지 않는다.
- [ ] 신규 symbol 2 개를 파일 말미 `export { ... }` / `export type { ... }` 블록에 추가한다.
- [ ] colocated spec `web/src/views/AdminView.service-identity-row-props.test.tsx` 를 신설하고 R-112 4 종을 모두 덮는다.
  - [ ] **happy-path** — 정상 행에서 (a) 플래그 3 종이 `deriveServiceIdentityRowActionsFlags` 결과와 일치, (b) `onDeleteConfirm` 이
        주입 `remove` 를 `(personId, identity.id)` 로 정확히 1 회 호출하고 `setPrimary` 는 0 회, (c) `onSetPrimary` 가 그 반대임을 각각 검증 (축 교차 회귀 차단).
  - [ ] **error path** — `remove` · `setPrimary` 가 reject 할 때 각각 실패 문구가 `describeError` 를 거쳐 **이 행에 귀속**되고
        (`setErrorIdentityId` + `setErrorText` 짝 호출), `bumpRefresh` 가 호출되지 않으며 helper 가 throw 하지 않음을 검증.
  - [ ] **분기 cover** — (a) 정규화 결과가 빈 행 (빈 문자열 · 공백뿐) 의 5 콜백 전원 no-op, (b) 확인 대상이 이 행일 때 / 다른 행일 때의
        `onDeleteCancel` 동작 차이, (c) gate 가 이 행을 들고 있을 때 in-flight 가드로 재발사 0, (d) gate 가 다른 행을 들고 있을 때는
        정상 발사, (e) `personId` 미선택 시 no-op — 각 분기 1+ test.
  - [ ] **negative cases 충분 cover** — `personId` 공백뿐 · `identity.id` 공백뿐 · 이미 primary 인 행에서의 `onSetPrimary` 호출 (러너에 가드 없음을 명시적으로 고정) ·
        `errorText` 가 빈 문자열일 때 error 미노출 · 삭제 실패 후 확인 단계가 닫히지 않음 · bridge 를 호출 시점마다 새로 build 하는지
        (연속 두 번 호출 사이에 gate 값을 바꿔 두 번째 호출이 새 값을 보는지) — 각 1+ test.
- [ ] `pnpm --dir web test` (또는 저장소 표준 web test 명령) 전량 green.
- [ ] 저장소 루트 `pnpm lint` · `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `pnpm --dir web build` (tsc --noEmit + vite) green — `noUnusedLocals` 위반 0.

## Out of Scope

- `<ServiceIdentityRowActions>` **마운트 JSX** 추가 및 컨테이너 state (`confirmingDeleteId` · `busyIdentityId` · 에러 귀속 slot) 선언 — 다음 slice 책임.
- `AdminView` 컴포넌트 본문 (hook · 핸들러 · 기존 JSX) 수정. 본 slice 는 module-level helper 신설과 export 블록 2 줄 추가만 건드린다.
- `ServiceIdentityRowActions.tsx` · `ServiceIdentityList.tsx` 등 컴포넌트 본문 수정.
- `web/src/api/serviceIdentity.ts` 의 client 함수 신설·수정.
- backend (`src/`) · prisma schema · e2e · smoke 변경.
- Admin RBAC gating, doc-sync (`docs/architecture/*`), ADR 갱신 — ADR-0058 `§Follow-ups (d)` 잔여로 남긴다.
- 새 외부 dependency 추가 (§5 게이트).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 발견한 후속 작업을 여기에 적는다.)
