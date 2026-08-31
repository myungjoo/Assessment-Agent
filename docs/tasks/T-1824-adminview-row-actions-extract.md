---
id: T-1824
title: AdminView 의 ServiceIdentity 행별 액션 helper 군을 별도 모듈로 순수 추출
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-078, REQ-079]
independentStream: adminview-god-component-refactor
dependsOn: [T-1822]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/adminServiceIdentityRowActions.tsx
estimatedDiff: 620
estimatedFiles: 2
sizeExempt: true
exemptReason: "pure-extraction — 동작 변경 0 · 신규 로직 0 LOC · 기존 spec 6 개가 import 경로까지 무수정으로 통과. 삭제 290 + 추가 약 320 이 전부 이동량이라 LOC 은 위험도에 비례하지 않는다. 파일 수 2 개로 파일 cap (≤ 5) 은 예외 없이 준수."
plannerNote: "P6 / PLAN 183 행 AdminView god component 부채의 첫 실분할 — T-1822 가 연 순수 추출 카테고리의 최초 적용"
---

# T-1824 — AdminView 의 ServiceIdentity 행별 액션 helper 군을 별도 모듈로 순수 추출

## Why

[PLAN.md](../PLAN.md) `183 행` (오너 지시 2026-08-31) 의 **후속** 항목이다. 그 bullet 은 선행 처리
([T-1822](T-1822-pure-extraction-cap-bend-category.md) — planner cap-bend 표에 순수 추출 카테고리 +
`sizeExempt` 직행 규칙 추가) 를 끝낸 뒤 **실제 분할 `pr` task 의 1 차 대상을 "ServiceIdentity 행별
액션 helper 군" 으로 못박아 두었다**. 본 task 가 그 첫 적용이며, cap 이 append 를 싸게 extract 를
비싸게 만들던 비대칭을 실제로 되돌리는 최초의 slice 다.

지금 [AdminView.tsx](../../web/src/views/AdminView.tsx) 는 **6,087 줄 · top-level 선언 149 개** 이고
3 일 (08-29 ~ 08-31) 에만 +985 줄 늘었다. 그리고 다음 대기 작업인 [ADR-0059](../decisions/ADR-0059-collection-target-registration.md)
`§Follow-ups (e)` (AdminView 평가 대상 등록·편집 패널) 은 같은 파일에 다시 수백 줄을 **덧붙인다** —
덧붙이기 전에 이미 응집된 helper 군 하나를 먼저 빼는 것이 부채를 늘리지 않는 유일한 순서다.

본 slice 는 **코드를 옮기기만 한다**. 동작 · 계약 · spec 은 한 줄도 바뀌지 않는다.

## Required Reading

- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) — 이동 대상은 **`2271 행` ~ `2560 행`** (290 줄) 한 덩어리다. 그 외에 볼 곳은 `1746 행` (`normalizeRowId` 의 두 번째 소비처) · `3647 행`~`3705 행` (helper 군의 컨테이너 배선) · 파일 끝 `export { ... }` / `export type { ... }` 목록.
- [docs/PLAN.md](../PLAN.md) `183 행` — 부채 bullet 과 1 차 대상 지정.
- [.claude/agents/planner.md](../../.claude/agents/planner.md) 의 cap-bend 표 "순수 추출 리팩터" 행 — (a) 동작 변경 없음 · (b) 신규 로직 0 LOC · (c) 기존 spec 그대로 통과 3 조건.
- 무수정으로 통과해야 하는 기존 spec 6 개: [AdminView.service-identity-row-flags.test.tsx](../../web/src/views/AdminView.service-identity-row-flags.test.tsx) · [AdminView.service-identity-row-bridge.test.tsx](../../web/src/views/AdminView.service-identity-row-bridge.test.tsx) · [AdminView.service-identity-row-props.test.tsx](../../web/src/views/AdminView.service-identity-row-props.test.tsx) · [AdminView.service-identity-row-slot.test.tsx](../../web/src/views/AdminView.service-identity-row-slot.test.tsx) · [AdminView.service-identity-edit-entry.test.tsx](../../web/src/views/AdminView.service-identity-edit-entry.test.tsx) · [AdminView.service-identity-row-actions-mount.test.tsx](../../web/src/views/AdminView.service-identity-row-actions-mount.test.tsx).

## 이동 대상 (정확한 목록)

새 파일 **`web/src/views/adminServiceIdentityRowActions.tsx`** 로 옮긴다. `web/src/views/` 아래에
두는 이유는 이동 블록의 상대 import 경로 (`../api/...` · `../components/...`) 가 그대로 유효해
**본문 재작성이 0** 이 되기 때문이다. JSX (`buildServiceIdentityRowActionsSlot`) 를 담으므로 확장자는
`.tsx` 다.

- 함수 6 개 — `deriveServiceIdentityRowActionsFlags` · `normalizeRowId` · `buildServiceIdentityRowActionBridge` · `buildServiceIdentityRowActionsProps` · `buildServiceIdentityRowActionsSlot` · `beginServiceIdentityEdit`
- type 6 개 — `ServiceIdentityRowFlagsInput` · `ServiceIdentityRowActionsFlags` · `ServiceIdentityRowActionBridgeDeps` · `ServiceIdentityRowActionBridge` · `ServiceIdentityRowActionsWiringDeps` · `BeginServiceIdentityEditDeps`
- 각 선언 위의 **주석 블록도 그대로 함께** 옮긴다 (주석이 이 helper 군의 결함 근거를 담은 정본이다).

배선 규칙:

- 새 모듈은 12 심볼을 모두 `export` 하고, AdminView 는 그것들을 `import` 만 한다. AdminView 파일 끝의 `export { ... }` · `export type { ... }` 목록은 **한 줄도 바꾸지 않는다** — 임포트한 심볼을 그대로 re-export 할 수 있어 기존 spec 6 개의 `from './AdminView'` 가 그대로 산다.
- `normalizeRowId` 는 `1746 행` 의 다른 소비처도 새 모듈에서 import 해 쓴다 (행 id 정규화 정본 1 개 유지 — 규칙 재구현 금지).
- 새 모듈이 필요로 하는 `InFlightIdGate` 는 **`import type { InFlightIdGate } from './AdminView';`** 로 받는다. type-only import 라 컴파일 시 지워져 **런타임 순환이 생기지 않는다** (AdminView → 새 모듈 방향만 값 의존). 만약 `tsc --noEmit` 이 이 형태를 문제 삼으면, 대체안으로 `InFlightIdGate` interface 선언 자체를 새 모듈로 함께 옮기고 AdminView 가 그 type 을 import 한다 (이 역시 순수 이동이다). `createInFlightIdGate` 함수 본체는 어느 경우에도 AdminView 에 남긴다.

## Acceptance Criteria

- [ ] `web/src/views/adminServiceIdentityRowActions.tsx` 가 신설되고 위 12 심볼 + 주석 블록이 **본문 변경 0** 으로 옮겨졌다. `git diff` 에서 이동 블록의 삭제 라인과 추가 라인이 (import 구문 · 파일 머리 주석을 제외하고) 1:1 로 일치함을 확인한다.
- [ ] `AdminView.tsx` 의 `2271 행` ~ `2560 행` 구간이 제거되고, 그 자리에 새 모듈 import 만 남았다. 파일 끝 `export { ... }` / `export type { ... }` 목록은 무변경.
- [ ] `wc -l web/src/views/AdminView.tsx` 가 **5,800 줄 이하** (현재 6,087) 임을 확인한다.
- [ ] **happy-path**: 기존 spec 6 개가 이동한 6 함수의 정상 경로를 이미 cover 한다는 것을 확인하고, 어느 심볼이든 happy-path test 가 0 이면 해당 기존 spec 파일에 1+ 를 보강한다.
- [ ] **error path**: 각 함수의 실패·비정상 입력 경로 (`normalizeRowId` 의 비문자열 · `beginServiceIdentityEdit` 의 비문자열 `externalId` · bridge 의 gate 미소유 등) 가 기존 spec 에 1+ 존재함을 확인하고, 빠진 것이 있으면 보강한다.
- [ ] **분기 cover**: 이동 대상의 분기 (귀속 가능/불가 id · gate 소유/미소유 · 삭제 확인 단계 on/off · 진행 중 여부) 마다 test 1+ 가 존재함을 확인한다.
- [ ] **negative cases 충분 cover**: 빈 문자열 · 공백뿐인 id · `undefined` sentinel 이 다른 행에 물드는 사고 · 다른 행의 진행이 이 행을 잠그는 사고 등 예외 분기마다 1+ 가 존재함을 확인한다. 단일 negative 만으로 끝내지 않는다.
- [ ] 위 4 항목의 보강이 필요했다면 **기존 spec 파일 안에서만** 처리한다 (새 spec 파일 신설 금지 — 파일 cap 및 순수 추출 성격 보존). 보강이 0 건이면 task 본문 Follow-ups 에 "보강 0 — 기존 spec 이 전량 cover" 를 적는다.
- [ ] `pnpm --filter web test` green — 기존 spec 6 개가 **import 경로 수정 없이** 통과한다 (순수 추출 조건 (c)).
- [ ] `pnpm --filter web build` green (`tsc --noEmit` + `vite build`).
- [ ] 백엔드 회귀 무영향 확인 — `pnpm lint && pnpm build && pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). `src/` 무변경이라 전역 coverage 변동은 0 이어야 한다.

## Out of Scope

- **동작 변경 일체** — 함수 본문 재작성 · 시그니처 변경 · 새 helper 신설 · 주석 내용 수정. 옮기는 것 외의 개선은 전부 Follow-ups 로.
- 기존 spec 6 개의 **import 경로 변경** (`'./AdminView'` → 새 모듈). AdminView re-export 로 무수정 통과가 가능하므로 본 slice 는 건드리지 않는다 (5 파일이 한꺼번에 바뀌어 순수 추출의 검증 가능성이 흐려진다).
- `createInFlightIdGate` 본체 · 인스턴스 접근 helper 군 (`GrantInstanceAccessDeps` 이후) · 그 밖의 AdminView helper 군 추출. 부채는 slice 를 나눠 갚는다.
- `docs/requirements.md` 등 AdminView 행 좌표를 인용하는 문서의 pointer 정정 (`direct` 라 §3.1 규칙 3 상 본 `pr` task 와 혼합 금지).
- [ADR-0059](../decisions/ADR-0059-collection-target-registration.md) `§Follow-ups (e)` 평가 대상 등록·편집 패널 착수.
- [PLAN.md](../PLAN.md) `183 행` bullet 의 실측 LOC 갱신 · 마커 승격 (`direct` doc slice 소관).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (예고) AdminView 행 좌표 pointer drift 정정 — 본 slice 가 `2271 행` ~ `2560 행` 을 걷어내면 그 아래 좌표가 약 290 행 앞당겨진다. [docs/requirements.md](../requirements.md) `97 행` REQ-078 (`5591 행` · `5606 행` · `5610 행` · `5617 행` · `5622 행` · `5645 행`) 과 `98 행` REQ-079 (`1702 행` · `1768 행` · `3013 행` · `3066 행` · `3716 행` · `3999 행`) 가 대상이며, `1702 행` · `1768 행` 처럼 이동 구간보다 위인 좌표는 불변이다. `direct` doc-sync slice 1 건으로 처리.
- (예고) 기존 spec 6 개의 import 경로를 새 모듈로 재지정하고 AdminView 의 해당 re-export 항목을 제거하는 정리 slice (5 파일 · 기계적).
