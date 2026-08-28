---
id: T-1765
title: web ServiceIdentityRowActions 삭제 · primary 지정 액션 컴포넌트 신설 (쓰기 축 3/3)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-078, REQ-079]
estimatedDiff: 285
estimatedFiles: 2
created: 2026-08-29
independentStream: service-identity-web
dependsOn: [T-1764]
touchesFiles:
  - web/src/components/ServiceIdentityRowActions.tsx
  - web/src/components/ServiceIdentityRowActions.test.tsx
plannerNote: "P6/PLAN 132 행 — ADR-0058 (d) 일곱 번째 web slice: 수정 폼(T-1764) 다음 겹으로 삭제·primary 지정 액션 축 1 개만 절단"
---

# T-1765 — web ServiceIdentityRowActions 삭제 · primary 지정 액션 컴포넌트 신설 (쓰기 축 3/3)

## Why

[PLAN.md](../PLAN.md) `132 행` 오너 지시 (R-182 ~ R-183) 의 잔여는 [ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups (d)` **AdminView 편집 UI** 다. backend 5 route (T-1748 ~ T-1756) · web client 5 함수 (T-1759 ~ T-1761) · 표시 축 (T-1762 `ServiceIdentityList`) · 추가 축 (T-1763 `ServiceIdentityAddForm`) · 수정 축 (T-1764 `ServiceIdentityEditForm`) 까지 main 에 박제됐고, 남은 것은 **삭제 · primary 지정 동선 + AdminView 배선** 이다.

그 잔여 전체는 [CLAUDE.md](../../CLAUDE.md) §3 의 cap (≤ 300 LOC / ≤ 5 파일) 을 확실히 넘는다 (직전 두 겹이 컴포넌트 1 개 + spec 만으로 각각 286 · 300 LOC). 본 task 는 그중 **삭제 (DELETE) · primary 지정 (POST .../primary) 두 action 의 버튼 축 한 겹만** 절단한다 — identity 행 1 개를 props 로 받아 편집 · 삭제 · primary 지정 버튼을 렌더하고 각 버튼의 사용 가능 여부만 판정하는 순수 presentational controlled component 1 개 + spec. 실제 `deleteServiceIdentity` · `setPrimaryServiceIdentity` 호출 · 상태 보유 · 목록 갱신 · AdminView 배선은 후속 배선 slice 책임이다.

REQ-078 Admin UI 축 / REQ-079 의 "이름 / email 만 입력 가능한 상태 금지" 해소 판정은 **배선 slice 가** 한다 — 본 slice 만으로는 어떤 REQ 도 status 를 바꾸지 않는다.

## Required Reading

- [docs/decisions/ADR-0058-service-identity-management-api.md](../decisions/ADR-0058-service-identity-management-api.md) — `§Decision 1` 표의 DELETE (204, body 없음) · primary 지정 (전용 POST, 200, **idempotent**) 행, `§Decision 2` (primary invariant · **마지막 primary 삭제 시 잔여 row 자동 승격은 backend 책임**), `§Consequences (c)` (자동 승격이 사용자 의도와 어긋날 수 있음 — 안내 문구 근거), `§Follow-ups (d)`.
- `web/src/api/serviceIdentity.ts` `28~36 행` (`ServiceIdentityRow` 타입 — `id` · `personId` · `service` · `externalId` · `isPrimary`) 과 `178~211 행` (`deleteServiceIdentity` · `setPrimaryServiceIdentity` 의 시그니처 · doc comment). 본 task 는 두 함수를 **호출하지 않고** 버튼 축만 맞춘다.
- `web/src/components/ServiceIdentityList.tsx` — 승계할 규약: `import type { ServiceIdentityRow }` 로 row 타입 재선언 0, `PRIMARY_BADGE_TEXT` 상수, loading → error 분기 순서, `role="status"` / `role="alert"` 사용법.
- `web/src/components/ServiceIdentityEditForm.tsx` — 직전 겹의 승계 대상: props-only controlled component (내부 `useState` · fetch 0), `loading` 우선 disable, `role="alert"` 에러 영역, 버튼 텍스트 상수 export, named + default export + `export type { ...Props }` convention, 배제 축 근거를 상단 주석에 남기는 패턴.
- `web/src/components/ServiceIdentityEditForm.test.tsx` `1~30 행` — 승계할 spec 헤더 · 패턴 (vitest + `react-dom/server` `renderToStaticMarkup`, jsdom · @testing-library dep 0, 정적 렌더라 콜백 자체는 검증 대상 아님) 과 파일명 규약 (`.test.tsx` 고정 — root jest `testRegex` pickup 충돌 회피).

## Acceptance Criteria

- [ ] `web/src/components/ServiceIdentityRowActions.tsx` 를 신설한다. props 는 controlled 축만 받는다: `identity: ServiceIdentityRow`, `onEdit: () => void`, `onDeleteRequest: () => void`, `onDeleteConfirm: () => void`, `onDeleteCancel: () => void`, `onSetPrimary: () => void`, `confirmingDelete?: boolean`, `loading?: boolean`, `error?: string`. 컴포넌트 내부에서 fetch · `useState` · 목록 갱신을 하지 않는다 (row 타입은 `import type { ServiceIdentityRow } from '../api/serviceIdentity'` 로 재사용하고 재선언하지 않는다).
- [ ] `confirmingDelete !== true` 이면 편집 · 삭제 · primary 지정 3 버튼을 렌더한다. `confirmingDelete === true` 이면 삭제 버튼 자리에 **확인 문구 + 확인 · 취소 2 버튼** 을 렌더한다 (확인 문구에는 어떤 행을 지우는지 알 수 있도록 `identity.service` 와 `identity.externalId` 를 포함한다). 확인 단계에서 삭제 버튼은 다시 렌더하지 않는다 (2 중 삭제 경로 차단).
- [ ] `identity.isPrimary === true` 이면 (1) primary 지정 버튼을 `disabled` 로 두고 (idempotent 지만 무의미한 요청을 UI 에서 차단 — ADR-0058 `§Decision 1`), (2) `ServiceIdentityList` 선례와 동형인 primary 표식 텍스트를 렌더한다. `false` 면 표식 없이 primary 지정 버튼이 enabled 다.
- [ ] `loading === true` 이면 **모든 버튼** (편집 · 삭제 · 확인 · 취소 · primary 지정) 을 `disabled` 로 둔다 — loading 이 다른 어떤 분기보다 우선한다.
- [ ] `identity.isPrimary === true` 인 행의 삭제 확인 문구에 "이 행을 지우면 backend 가 잔여 identity 중 하나를 자동으로 primary 로 승격한다" 는 취지의 한국어 안내를 추가로 노출한다 (ADR-0058 `§Decision 2` · `§Consequences (c)` 근거). `isPrimary === false` 인 행에는 그 안내를 노출하지 않는다.
- [ ] `error` 가 truthy 면 `role="alert"` 영역에 렌더하고, falsy (미전달 · 빈 문자열) 면 렌더하지 않는다.
- [ ] 버튼 텍스트 · primary 표식 · 안내 문구는 상수로 export 하고 (`ServiceIdentityEditForm.tsx` 의 상수 export 선례 승계), 컴포넌트 상단 주석에 본 컴포넌트가 client 함수를 호출하지 않는 이유 (배선 slice 책임) 를 1~3 줄로 남긴다.
- [ ] `web/src/components/ServiceIdentityRowActions.test.tsx` 를 신설한다 (vitest + `renderToStaticMarkup`, 새 dependency 0). 아래 R-112 4 종을 모두 덮는다:
  - [ ] **happy-path** — `isPrimary === false` · `loading` 미전달 · `confirmingDelete` 미전달 기본 상태에서 3 버튼이 모두 렌더되고 전부 enabled 이며 `identity.service` · `identity.externalId` 가 표시되는 test 1+.
  - [ ] **error path** — `error` 전달 시 `role="alert"` 영역에 그 문구가 렌더되는 test 1+, `error` 미전달 시 alert 영역이 없는 test 1+.
  - [ ] **분기 cover** — `confirmingDelete` 2 분기 (기본 / 확인 단계) 각 1+, `identity.isPrimary` 2 분기 (표식 · primary 버튼 disabled 유무) 각 1+, `loading` 2 분기 각 1+, 자동 승격 안내 문구의 노출 · 미노출 2 분기 각 1+ test.
  - [ ] **negative cases 충분 cover** — `loading === true` + `confirmingDelete === true` 조합에서 확인 · 취소 버튼까지 disabled (loading 우선), `loading === true` + `isPrimary === false` 에서도 primary 버튼 disabled, `confirmingDelete === true` 일 때 삭제 버튼 텍스트 미렌더, 빈 문자열 `error` 는 alert 미렌더, `externalId` 가 빈 문자열인 행도 렌더가 깨지지 않음 — 각 1+ test.
- [ ] `cd web && pnpm test` 통과 (신규 spec 포함 전 suite green).
- [ ] `cd web && pnpm build` 통과 (`tsc --noEmit` 포함 — 타입 오류 0).
- [ ] repo root 에서 `pnpm lint && pnpm build && pnpm test` 통과 (backend 회귀 0 — 본 task 는 `src/` 를 건드리지 않으므로 결과가 직전과 동일해야 한다).

## Out of Scope

- `deleteServiceIdentity` · `setPrimaryServiceIdentity` 등 client 함수 **호출** · 상태 보유 · 목록 재조회 · 낙관적 갱신 — 후속 배선 slice 책임.
- `AdminView.tsx` · `PersonList.tsx` 등 기존 화면 배선 · 탭 노출 · RBAC gating — 배선 slice 책임 (본 task 는 새 파일 2 개만 추가한다).
- `ServiceIdentityList.tsx` · `ServiceIdentityAddForm.tsx` · `ServiceIdentityEditForm.tsx` 본문 수정 (상수 재사용 목적의 import 도 하지 않는다 — 각 컴포넌트의 문구 상수는 서로 독립이어야 하므로 본 파일에서 자체 정의한다).
- `web/src/api/serviceIdentity.ts` · `src/` · `prisma/` 변경, 새 외부 dependency 추가 (jsdom · @testing-library 도입 금지).
- `docs/requirements.md` · `docs/PLAN.md` · ADR-0058 의 status / 완료 표기 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)
