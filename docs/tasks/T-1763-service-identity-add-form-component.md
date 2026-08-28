---
id: T-1763
title: web ServiceIdentityAddForm 추가 전용 폼 컴포넌트 신설 (쓰기 축 1/2)
phase: P6
status: DONE
completedAt: 2026-08-28T17:53:43Z
prNumber: 1391
mergeCommit: 1ca0e3f7
commitMode: pr
coversReq: [REQ-078, REQ-079]
estimatedDiff: 285
estimatedFiles: 2
created: 2026-08-28
independentStream: service-identity-web
dependsOn: [T-1762]
touchesFiles:
  - web/src/components/ServiceIdentityAddForm.tsx
  - web/src/components/ServiceIdentityAddForm.test.tsx
plannerNote: "P6/PLAN 132 행 — ADR-0058 (d) 다섯 번째 web slice: 표시 축(T-1762) 다음 겹으로 추가 폼 1 개만 절단"
---

# T-1763 — web ServiceIdentityAddForm 추가 전용 폼 컴포넌트 신설 (쓰기 축 1/2)

## Why

[PLAN.md](../PLAN.md) `132 행` 오너 지시 (R-182 ~ R-183) 의 잔여는 [ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups (d)` **AdminView 편집 UI** 다. backend 5 route (T-1748 ~ T-1756) · web client 5 함수 (T-1759 ~ T-1761) · 표시 축 컴포넌트 (T-1762 `ServiceIdentityList`) 까지 main 에 박제됐고, 남은 것은 **편집 동선 + AdminView 배선** 이다.

`(d)` 잔여 전체 (추가 폼 + 수정 · 삭제 · primary 지정 동선 + AdminView 배선 + RBAC gating + fetch 상태 보유) 는 [CLAUDE.md](../../CLAUDE.md) §3 의 cap (≤ 300 LOC / ≤ 5 파일) 을 확실히 넘는다. 본 task 는 그중 **추가(POST) 동선의 입력 폼 한 겹만** 절단한다 — `service` · `externalId` 2 축을 props 로 받아 렌더하고 submit 가능 여부만 판정하는 순수 presentational controlled component 1 개 + spec. 실제 `createServiceIdentity` 호출 · 상태 보유 · 목록 갱신 · AdminView 배선은 후속 slice 책임이다.

REQ-079 의 "이름 / email 만 입력 가능한 상태 금지" 해소 판정은 배선 slice 가 한다 — **본 slice 만으로는 어떤 REQ 도 DONE 표기하지 않는다**.

## Required Reading

- [docs/decisions/ADR-0058-service-identity-management-api.md](../decisions/ADR-0058-service-identity-management-api.md) — `§Decision 1` (route 표) · `§Decision 2` (primary 축은 전용 route 단일화 = 본 폼에 `isPrimary` 입력 금지) · `§Follow-ups (d)`.
- `src/user/dto/create-service-identity.dto.ts` — 본 폼의 안내 문구 · submit 게이팅이 인용할 **정본 규칙**: `service` 는 `@IsNotEmpty` + `@MaxLength(64)` + `@Matches(/^[A-Za-z0-9._-]+$/)`, `externalId` 는 `@IsNotEmpty` + `@MaxLength(255)`. 필드는 이 2 개뿐 (`forbidNonWhitelisted` 라 `isPrimary` 등 여분 키는 그 자체로 400).
- `web/src/api/serviceIdentity.ts` — `createServiceIdentity(personId, { service, externalId })` 시그니처 (`122 행` 부근). 본 task 는 이 함수를 **호출하지 않고** 입력 축만 맞춘다.
- `web/src/components/SuperAdminSetupForm.tsx` — 승계할 폼 선례: props-only controlled component, `aria-describedby` 로 연결한 조건 안내 문구 상수, `loading` 우선 submit 차단 정책, `role="alert"` 에러 영역, named + default export convention.
- `web/src/components/SuperAdminSetupForm.test.tsx` — 승계할 spec 선례 (vitest + `react-dom/server` `renderToStaticMarkup`, jsdom · @testing-library dep 0).
- `web/src/components/ServiceIdentityList.test.tsx` `1 ~ 20 행` — 같은 도메인의 직전 slice spec 헤더 · 파일명 규약 (`.test.tsx` 고정 — root jest `testRegex` pickup 충돌 회피).

## Acceptance Criteria

- [ ] `web/src/components/ServiceIdentityAddForm.tsx` 를 신설한다. props 는 controlled 축만 받는다: `service: string`, `externalId: string`, `onServiceChange: (value: string) => void`, `onExternalIdChange: (value: string) => void`, `onSubmit: () => void`, `loading?: boolean`, `error?: string`. 컴포넌트 내부에서 fetch · `useState` · 목록 갱신을 하지 않는다.
- [ ] submit 게이팅 규칙을 구현한다 — 다음 중 하나라도 참이면 submit 버튼 `disabled`: (1) `loading === true` (loading 우선), (2) `service.trim() === ''`, (3) `externalId.trim() === ''`, (4) `service` 가 `/^[A-Za-z0-9._-]+$/` 불일치, (5) `service.length > 64`, (6) `externalId.length > 255`. 폼 submit 의 기본 동작은 막고 (`preventDefault`), disabled 상태에서는 `onSubmit` 을 호출하지 않는다.
- [ ] `service` · `externalId` 각각의 조건 안내 문구를 상수로 export 하고 (`SuperAdminSetupForm.tsx` 의 `USERNAME_HINT_ID` / `USERNAME_HINT_TEXT` 선례 승계) 각 입력의 `aria-describedby` 가 그 id 를 가리키게 한다. 문구는 위 DTO 의 **실제 규칙만** 인용한다 (없는 조건을 지어내지 않는다).
- [ ] `error` 가 truthy 면 `role="alert"` 영역에 렌더하고, falsy (미전달 · 빈 문자열) 면 렌더하지 않는다.
- [ ] `isPrimary` 입력 축을 두지 않는다 (ADR-0058 `§Decision 2` — primary 전이는 전용 route 단일화). 컴포넌트 상단 주석에 그 근거를 1 ~ 2 줄로 남긴다.
- [ ] `web/src/components/ServiceIdentityAddForm.test.tsx` 를 신설한다 (vitest + `renderToStaticMarkup`, 새 dependency 0). 아래 R-112 4 종을 모두 덮는다:
  - [ ] **happy-path** — `service` · `externalId` 가 규칙을 만족하면 두 입력의 `value` 가 렌더되고 submit 버튼이 enabled 인 test 1+.
  - [ ] **error path** — `error` 전달 시 `role="alert"` 영역에 그 문구가 렌더되는 test 1+, `error` 미전달 시 alert 영역이 없는 test 1+.
  - [ ] **분기 cover** — 위 submit 게이팅 6 조건 각각 1+ test (loading 우선 / 빈 service / 빈 externalId / service 형식 위반 / service 길이 초과 / externalId 길이 초과), 그리고 안내 문구 · `aria-describedby` 연결 test 1+.
  - [ ] **negative cases 충분 cover** — 공백만 입력한 `service` · 공백만 입력한 `externalId` · 형식 위반 문자 (예: 공백 포함 · `/` · 한글) · `service` 경계값 64 자 정확히는 enabled / 65 자는 disabled · `externalId` 경계값 255 자 정확히는 enabled / 256 자는 disabled · 빈 문자열 `error` 는 alert 미렌더 — 각 1+ test.
- [ ] `cd web && pnpm test` 통과 (신규 spec 포함 전 suite green).
- [ ] `cd web && pnpm build` 통과 (`tsc --noEmit` 포함 — 타입 오류 0).
- [ ] repo root 에서 `pnpm lint && pnpm build && pnpm test` 통과 (backend 회귀 0 — 본 task 는 `src/` 를 건드리지 않으므로 변화가 없어야 한다).

## Out of Scope

- `createServiceIdentity` 등 client 함수 **호출** · 상태 보유 · 목록 재조회 · 낙관적 갱신 — 후속 배선 slice 책임.
- 수정 (PATCH) · 삭제 (DELETE) · primary 지정 폼 / 버튼 — 쓰기 축 2/2 후속 slice 책임.
- `AdminView` 또는 다른 view 파일 수정 · 라우팅 · RBAC gating — 배선 slice 책임.
- `ServiceIdentityList.tsx` 수정 (편집 handler 주입 포함) — 본 task 는 신규 파일 2 개만 추가한다.
- service 후보 목록 (활성 instance key 조회 수단) 신설 — ADR-0058 `§Consequences (b)` 판단은 배선 slice 로 승계. 본 폼은 자유 입력 + 형식 검증만 한다.
- `src/`, `prisma/`, `docs/architecture/api.md`, `docs/requirements.md` 변경 — `(e)` doc-sync slice 책임.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)
