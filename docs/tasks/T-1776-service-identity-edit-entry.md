---
id: T-1776
title: AdminView 에 ServiceIdentity 행 편집 진입 helper beginServiceIdentityEdit 신설
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-078, REQ-079]
estimatedDiff: 200
estimatedFiles: 2
independentStream: web-admin-service-identity
dependsOn: [T-1773, T-1775]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.service-identity-edit-entry.test.tsx
created: 2026-08-29
plannerNote: P6 ADR-0058 §Follow-ups (d) 열여덟 번째 web slice — 마운트가 요구하는 onEdit(행 객체) 진입 helper 만 절단해 마운트 cap 초과 회피
---

# T-1776 — AdminView 에 ServiceIdentity 행 편집 진입 helper `beginServiceIdentityEdit` 신설

## Why

[ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups (d)` (AdminView 편집 UI)
의 잔여는 `ServiceIdentityRowActions` 를 목록에 실제로 마운트하는 배선 한 겹이다. 러너 2 종(T-1769 /
T-1770) · 플래그 helper(T-1771) · 어댑터(T-1772) · props 조립 factory(T-1773) · 목록 slot(T-1774) ·
slot factory(T-1775) 가 모두 준비됐고, 남은 것은 컨테이너 state 4 종 + in-flight gate + wiring deps
memo + `renderRowActions` JSX + spec 이다. 이를 한 slice 에 담으면 직전 배선 slice 실적(T-1773 이
정확히 `+300`, T-1775 가 `+218`)상 cap(≤ 300 LOC / ≤ 5 파일) 초과가 확실하다.

그래서 본 slice 는 마운트가 요구하는 wiring dep 중 **아직 어떤 형태로도 존재하지 않는 유일한 항목**
— `ServiceIdentityRowActionsWiringDeps.onEdit: (identity: ServiceIdentityRow) => void` 의 본체 —
한 겹만 모듈 레벨 순수 helper 로 절단한다. 현재 AdminView 의 편집 진입은 `handleEditTargetChange`
(수정 대상 `<select>` 의 change 이벤트) 뿐이라 **행 객체가 아니라 이벤트 + 목록 재탐색** 을 전제하고
있어 행 액션 버튼의 `onEdit` 계약에 그대로 꽂을 수 없다. `web/tsconfig.json` 의 `noUnusedLocals`
때문에 컨테이너 state 만 먼저 두는 분할은 불가하므로(빌드 실패), 모듈 레벨 export 가능한 순수
helper 로 절단하는 것이 이 chain 에서 성립하는 유일한 분할 축이다(T-1772 / T-1775 선례).

본 helper 가 막는 결함: (1) 편집 진입을 마운트 JSX 안 인라인 화살표로 두면 `externalId` prefill 을
빠뜨려 편집 폼이 빈 값으로 열리고 "변경 0" 판정이 뒤집히며, (2) 진입 시 직전 실패 문구(수정 실패 ·
행 액션 실패)를 비우지 않으면 새 편집 화면에 남의 실패 문구가 그대로 남고, (3) 다른 행이 열어둔
삭제 확인 slot 을 닫지 않으면 편집 폼과 "정말 삭제" 확인 단계가 동시에 열린 모순 상태가 된다.

## Required Reading

- `docs/decisions/ADR-0058-service-identity-management-api.md` — `§Decision 2`, `§Follow-ups (d)`
- `docs/tasks/T-1775-service-identity-row-actions-slot-builder.md` — 직전 slice 의 분할 근거
- `web/src/views/AdminView.tsx` — 다음 지점만:
  - `ServiceIdentityRowActionsWiringDeps` 선언부(`onEdit` · `setConfirmingDeleteId` ·
    `setErrorIdentityId` · `setErrorText` 계약)
  - `normalizeRowId` (행 id 정규화 — 재사용 대상, 재구현 금지)
  - 컨테이너의 편집 state 4 개 (`editingIdentityId` · `identityEditExternalIdInput` ·
    `updatingServiceIdentity` · `updateServiceIdentityError`) 와 `handleEditTargetChange` ·
    `endServiceIdentityEdit`
  - 파일 하단 `export { ... }` / `export type { ... }` 블록
- `web/src/api/serviceIdentity.ts` — `ServiceIdentityRow` 타입
- `web/src/views/AdminView.service-identity-row-slot.test.tsx` — colocated spec 작성 관례(순수
  helper 직접 호출 + 부수효과 mock 검증)

## Acceptance Criteria

- [ ] `web/src/views/AdminView.tsx` 에 모듈 레벨(컨테이너 함수 바깥) 순수 helper
      `beginServiceIdentityEdit(identity: ServiceIdentityRow, deps: BeginServiceIdentityEditDeps): void`
      와 그 deps 인터페이스 `BeginServiceIdentityEditDeps` 를 신설한다. deps 는 주입 setter 만 받는다:
      `setEditingIdentityId` · `setEditExternalIdInput` · `setUpdateError` ·
      `setConfirmingDeleteId` · `setErrorIdentityId` · `setErrorText`.
- [ ] 동작 계약:
  - 정상 행이면 대상 id 는 `identity.id` **원문 그대로** 싣는다(목록 `find` 가 원문 비교라 정규화
        값을 실으면 대상을 못 찾는다 — 근거를 주석으로 박제).
  - `externalId` prefill 은 문자열일 때만 그 값, 아니면 빈 문자열(비정상 payload 방어).
  - 직전 수정 실패 문구(`setUpdateError`)와 행 액션 실패 귀속/문구(`setErrorIdentityId` ·
        `setErrorText`)를 모두 `undefined` 로 비운다.
  - 다른 행이 열어둔 삭제 확인 slot 을 닫는다(`setConfirmingDeleteId(undefined)`).
  - 행 id 가 귀속 불가(빈 문자열 · 공백만 · 문자열 아님)면 **6 개 setter 중 어느 것도 호출하지 않는
        전체 no-op** 이며 throw 하지 않는다. 판정은 기존 `normalizeRowId` 재사용(재구현 금지).
  - 호출 자체는 인자 객체를 변형하지 않고 fetch · 러너 · async 를 일절 부르지 않는다.
- [ ] helper 와 타입을 파일 하단 `export { ... }` / `export type { ... }` 블록에 각각 추가한다.
- [ ] 신규 colocated spec `web/src/views/AdminView.service-identity-edit-entry.test.tsx` 를 추가하고
      다음 R-112 4 종을 모두 덮는다:
  - happy-path 1+ — 정상 행 진입 시 6 setter 가 각각 기대 인자로 1 회씩 호출되는지(대상 id 원문 ·
        prefill 값 · 나머지 4 개 `undefined`).
  - error path 1+ — `externalId` 가 `undefined` / 숫자 / `null` 인 비정상 row 에서도 throw 없이 빈
        문자열 prefill 로 접히는지.
  - 분기 cover — 귀속 가능 행(전체 갱신) / 귀속 불가 행(전체 no-op) 두 분기 각각 1+.
  - negative cases 충분 cover — 빈 문자열 id · 공백만 id · 문자열 아닌 id · `externalId` 타입
        mismatch · 인자 객체 무변형(호출 전후 deep-equal) · 같은 행 재진입이 이전 실패 문구를 다시
        비우는지 각 1+.
- [ ] `pnpm --dir web test` · 루트 `pnpm test` 전량 green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] 루트 `pnpm lint` · `pnpm --dir web build` green (`noUnusedLocals` 위반 0).

## Out of Scope

- 컨테이너 state 4 종 · in-flight gate · wiring deps memo · `renderRowActions` JSX 마운트 — 다음 slice.
- `handleEditTargetChange` · `endServiceIdentityEdit` · 기존 편집 폼 배선 수정 (본 helper 는 신설만).
- `web/src/components/ServiceIdentityRowActions.tsx` · `ServiceIdentityList.tsx` 등 컴포넌트 수정.
- `web/src/api/serviceIdentity.ts` 및 backend(`src/`) · Prisma schema 무변경.
- 새 dependency 추가, ADR 신설/개정, doc-sync(api.md · requirements.md).
- Admin RBAC gating.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 여기 append)
