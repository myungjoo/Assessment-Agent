---
id: T-1764
title: web ServiceIdentityEditForm externalId 수정 전용 폼 컴포넌트 신설 (쓰기 축 2/3)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-078, REQ-079]
estimatedDiff: 275
estimatedFiles: 2
created: 2026-08-28
independentStream: service-identity-web
dependsOn: [T-1763]
touchesFiles:
  - web/src/components/ServiceIdentityEditForm.tsx
  - web/src/components/ServiceIdentityEditForm.test.tsx
plannerNote: "P6/PLAN 132 행 — ADR-0058 (d) 여섯 번째 web slice: 추가 폼(T-1763) 다음 겹으로 externalId 수정 폼 1 개만 절단"
---

# T-1764 — web ServiceIdentityEditForm externalId 수정 전용 폼 컴포넌트 신설 (쓰기 축 2/3)

## Why

[PLAN.md](../PLAN.md) `132 행` 오너 지시 (R-182 ~ R-183) 의 잔여는 [ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups (d)` **AdminView 편집 UI** 다. backend 5 route (T-1748 ~ T-1756) · web client 5 함수 (T-1759 ~ T-1761) · 표시 축 (T-1762 `ServiceIdentityList`) · 추가 축 (T-1763 `ServiceIdentityAddForm`) 까지 main 에 박제됐고, 남은 것은 **수정 · 삭제 · primary 지정 동선 + AdminView 배선** 이다.

그 잔여 전체는 [CLAUDE.md](../../CLAUDE.md) §3 의 cap (≤ 300 LOC / ≤ 5 파일) 을 확실히 넘는다 (직전 겹 T-1763 이 컴포넌트 1 개 + spec 만으로 286 LOC). 본 task 는 그중 **수정 (PATCH) 동선의 입력 폼 한 겹만** 절단한다 — `externalId` 단일 축을 props 로 받아 렌더하고 submit 가능 여부만 판정하는 순수 presentational controlled component 1 개 + spec. 삭제 · primary 지정 버튼 (쓰기 축 3/3) 과 실제 `updateServiceIdentity` 호출 · 상태 보유 · 목록 갱신 · AdminView 배선은 후속 slice 책임이다.

REQ-078 Admin UI 축 / REQ-079 의 "이름 / email 만 입력 가능한 상태 금지" 해소 판정은 **배선 slice 가** 한다 — 본 slice 만으로는 어떤 REQ 도 status 를 바꾸지 않는다.

## Required Reading

- [docs/decisions/ADR-0058-service-identity-management-api.md](../decisions/ADR-0058-service-identity-management-api.md) — `§Decision 3` (PATCH 는 `externalId` **단일 축**, `service` · `isPrimary` 는 body 축에서 금지) · `§Decision 2` (primary 전이는 전용 route 단일화) · `§Follow-ups (d)`.
- `src/user/dto/update-service-identity.dto.ts` — 본 폼의 안내 문구 · submit 게이팅이 인용할 **정본 규칙**: `externalId` 는 `@IsString` + `@IsNotEmpty` + `@MaxLength(255)` 이고 미전달만 허용, 명시적 `null` 은 400. 필드는 이 1 개뿐 (`forbidNonWhitelisted` 라 `service` · `isPrimary` 는 그 자체로 400).
- `web/src/api/serviceIdentity.ts` `140~166 행` 부근 — `updateServiceIdentity(personId, identityId, { externalId })` 시그니처와 그 doc comment (허용 축 단일 근거). 본 task 는 이 함수를 **호출하지 않고** 입력 축만 맞춘다. `ServiceIdentityRow` 타입 (`28 행`) 은 그대로 재사용한다.
- `web/src/components/ServiceIdentityAddForm.tsx` — 직전 겹의 승계 대상: export 하는 상수 규약 (`EXTERNAL_ID_MAX_LENGTH` · `*_HINT_ID` · `*_HINT_TEXT`), props-only controlled component, `aria-describedby` 연결, `loading` 우선 submit 차단, `role="alert"` 에러 영역, named + default export + `export type { ...Props }` convention.
- `web/src/components/ServiceIdentityAddForm.test.tsx` `1~25 행` — 승계할 spec 헤더 · 패턴 (vitest + `react-dom/server` `renderToStaticMarkup`, jsdom · @testing-library dep 0, 정적 렌더라 콜백 자체는 검증 대상 아님) 과 파일명 규약 (`.test.tsx` 고정 — root jest `testRegex` pickup 충돌 회피).

## Acceptance Criteria

- [ ] `web/src/components/ServiceIdentityEditForm.tsx` 를 신설한다. props 는 controlled 축만 받는다: `service: string` (읽기 전용 표시), `initialExternalId: string`, `externalId: string`, `onExternalIdChange: (value: string) => void`, `onSubmit: () => void`, `onCancel: () => void`, `loading?: boolean`, `error?: string`. 컴포넌트 내부에서 fetch · `useState` · 목록 갱신을 하지 않는다.
- [ ] `service` 는 **입력 필드가 아니라 읽기 전용 텍스트**로 렌더하고, 그 옆(또는 안내 문구)에 "service 변경은 삭제 후 추가로 표현한다" 는 취지의 한국어 문구를 노출한다 (ADR-0058 `§Decision 3` 근거). `service` 를 편집 가능한 input 으로 두지 않는다.
- [ ] `isPrimary` 입력 축을 두지 않는다 (ADR-0058 `§Decision 2` — primary 전이는 전용 route). 컴포넌트 상단 주석에 `service` · `isPrimary` 두 축을 배제한 근거를 1~3 줄로 남긴다.
- [ ] submit 게이팅 규칙을 구현한다 — 다음 중 하나라도 참이면 submit 버튼 `disabled`: (1) `loading === true` (loading 우선), (2) `externalId.trim() === ''`, (3) `externalId.length > 255`, (4) `externalId === initialExternalId` (변경 0 이면 PATCH 무의미 — 불필요한 요청 차단). 폼 submit 기본 동작은 막고 (`preventDefault`), disabled 상태에서는 `onSubmit` 을 호출하지 않는다.
- [ ] 취소 버튼을 렌더하고 `onCancel` 에 연결한다. 취소 버튼은 `loading === true` 일 때만 `disabled` 이며, submit 게이팅 (2)~(4) 에는 영향받지 않는다 (수정 도중 언제든 빠져나올 수 있어야 한다).
- [ ] `externalId` 조건 안내 문구를 상수로 export 하고 (`ServiceIdentityAddForm.tsx` 의 `EXTERNAL_ID_HINT_ID` / `EXTERNAL_ID_HINT_TEXT` 선례 승계, id 값은 add 폼과 **충돌하지 않는** 별도 문자열) 입력의 `aria-describedby` 가 그 id 를 가리키게 한다. 문구는 위 DTO 의 **실제 규칙만** 인용한다 (없는 조건을 지어내지 않는다).
- [ ] `error` 가 truthy 면 `role="alert"` 영역에 렌더하고, falsy (미전달 · 빈 문자열) 면 렌더하지 않는다.
- [ ] `web/src/components/ServiceIdentityEditForm.test.tsx` 를 신설한다 (vitest + `renderToStaticMarkup`, 새 dependency 0). 아래 R-112 4 종을 모두 덮는다:
  - [ ] **happy-path** — `externalId` 가 `initialExternalId` 와 다르고 규칙을 만족하면 입력의 `value` 와 읽기 전용 `service` 텍스트가 렌더되고 submit 버튼이 enabled 인 test 1+.
  - [ ] **error path** — `error` 전달 시 `role="alert"` 영역에 그 문구가 렌더되는 test 1+, `error` 미전달 시 alert 영역이 없는 test 1+.
  - [ ] **분기 cover** — submit 게이팅 4 조건 각각 1+ test (loading 우선 / 빈 externalId / 길이 초과 / 미변경), 취소 버튼의 `loading` 유무 2 분기 각 1+ test, 안내 문구 · `aria-describedby` 연결 test 1+.
  - [ ] **negative cases 충분 cover** — 공백만 입력한 `externalId` · 경계값 255 자 정확히는 enabled / 256 자는 disabled · `initialExternalId` 와 공백만 다른 값 (`trim` 후 동일하지 않으므로 enabled 여야 하는지 disabled 여야 하는지 구현 규칙대로 1+ test 로 고정) · 빈 문자열 `error` 는 alert 미렌더 · `service` 가 편집 가능한 input 으로 렌더되지 않음 (`<input` 개수 1 개) — 각 1+ test.
- [ ] `cd web && pnpm test` 통과 (신규 spec 포함 전 suite green).
- [ ] `cd web && pnpm build` 통과 (`tsc --noEmit` 포함 — 타입 오류 0).
- [ ] repo root 에서 `pnpm lint && pnpm build && pnpm test` 통과 (backend 회귀 0 — 본 task 는 `src/` 를 건드리지 않으므로 결과가 직전과 동일해야 한다).

## Out of Scope

- `updateServiceIdentity` 등 client 함수 **호출** · 상태 보유 · 목록 재조회 · 낙관적 갱신 — 후속 배선 slice 책임.
- 삭제 (DELETE) · primary 지정 버튼 / 확인 동선 — 쓰기 축 3/3 후속 slice 책임.
- `AdminView.tsx` · `PersonList.tsx` 등 기존 화면 배선 · 탭 노출 · RBAC gating — 배선 slice 책임 (본 task 는 새 파일 2 개만 추가한다).
- `ServiceIdentityList.tsx` · `ServiceIdentityAddForm.tsx` 본문 수정 (상수 재사용을 위한 import 는 하지 않는다 — 두 폼의 hint id 는 서로 독립이어야 하므로 본 파일에서 자체 상수로 정의한다).
- `web/src/api/serviceIdentity.ts` · `src/` · `prisma/` 변경, 새 외부 dependency 추가 (jsdom · @testing-library 도입 금지).
- `docs/requirements.md` · `docs/PLAN.md` · ADR-0058 의 status / 완료 표기 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)
