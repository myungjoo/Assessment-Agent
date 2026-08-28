---
id: T-1767
title: AdminView 에 ServiceIdentity 추가(POST) 축 배선 (runCreateServiceIdentity 러너 + ServiceIdentityAddForm 마운트 + 재조회 nonce)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-078, REQ-079]
estimatedDiff: 280
estimatedFiles: 2
created: 2026-08-29
independentStream: service-identity-web
dependsOn: [T-1766]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.service-identity-create.test.tsx
plannerNote: "P6/PLAN 132 행 — ADR-0058 (d) 아홉 번째 web slice: T-1766 읽기 축 뒤 쓰기 축 3 겹 중 추가(POST) 1 겹만 절단"
---

# T-1767 — AdminView 에 ServiceIdentity 추가(POST) 축 배선

## Why

[PLAN.md](../PLAN.md) `132 행` 오너 지시 (R-182 ~ R-183) 의 잔여는 [ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups (d)` **AdminView 편집 UI** 다. backend 5 route (T-1748 ~ T-1756) · web client 5 함수 (T-1759 ~ T-1761) · presentational 컴포넌트 4 종 (T-1762 ~ T-1765) 이 박제됐고, [T-1766](T-1766-adminview-service-identity-list-wiring.md) 이 **읽기 축** (조회 인원 `<select>` + 조건부 path builder + `useApiResource` + `ServiceIdentityList` 마운트) 을 배선했다.

남은 쓰기 축은 **추가 (POST) · 수정 (PATCH) · 삭제·primary (DELETE / POST primary)** 3 겹이며, 셋을 한 번에 붙이면 cap (≤ 300 LOC / ≤ 5 파일) 을 확실히 넘는다. 본 task 는 그중 **추가 (POST /api/persons/:personId/identities) 1 겹만** 절단한다 — `runCreateServiceIdentity` 순수 러너 + 컨테이너 state · 핸들러 + `ServiceIdentityAddForm` 마운트 + 성공 시 목록 재조회 nonce bump. `ServiceIdentityAddForm` 은 T-1763 이 이미 마련해 둔 controlled presentational 컴포넌트라 **컴포넌트 파일은 수정하지 않는다**.

REQ-078 / REQ-079 의 status 재판정은 쓰기 축 3 겹이 모두 마운트된 뒤 별도 doc-sync slice 에서 한다 — 본 slice 만으로는 어떤 REQ 도 status 를 바꾸지 않는다.

## Required Reading

- `web/src/views/AdminView.tsx` `2160~2215 행` — 승계할 정본 선례 `DeletePersonDeps` + `runDeletePerson` (모듈 레벨 순수 async 러너 + deps 주입 패턴: 비정상 입력 no-op 가드 → in-flight 가드 → `setCreating(true)` + 직전 error 비움 → await → 성공 `bumpRefresh()` / 실패 `setError(describeError(e))` (throw 0) → finally 진행 off).
- `web/src/views/AdminView.tsx` `2920~2957 행` — 승계할 컨테이너 배선 선례 `creatingPerson` / `createPersonError` state + `handleCreatePerson` `useCallback` (deps 주입 형태, 입력값·in-flight 를 deps 배열에 포함해 stale 방지, 성공 시 `resetInput`).
- `web/src/views/AdminView.tsx` `2885~2913 행` — 본 slice 가 확장할 지점: `serviceIdentitiesPath` `useMemo` (현재 nonce 미전달 — 주석 "재조회 nonce 는 쓰기 축 slice 몫") 와 `serviceIdentities` 방어 배열.
- `web/src/views/AdminView.tsx` `847 행` 부근 `buildServiceIdentitiesPath(selectedPersonId, refreshNonce = 0)` — 두 번째 인자를 이미 받으므로 **builder 를 수정하지 말고** 호출측에서 nonce 를 넘긴다.
- `web/src/views/AdminView.tsx` `4870~4892 행` — 마운트 지점 (인원 관리 `<section>` 안의 조회 `<select>` + `ServiceIdentityList`). `ServiceIdentityAddForm` 은 이 목록 근처에 붙인다.
- `web/src/views/AdminView.tsx` `5100~5135 행` 부근 test-only export 목록 — 신규 러너를 여기에 추가해야 spec 이 import 할 수 있다.
- `web/src/api/serviceIdentity.ts` `122~140 행` — `createServiceIdentity(personId, { service, externalId })` 시그니처와 throw 계약 (빈/공백 personId 는 호출 없이 `ApiError(0)`, 400 · 404 · 409 중복 · 401 · 5xx · 네트워크 모두 `ApiError` 전파). path 를 직접 조립하지 말고 이 함수를 쓴다.
- `web/src/components/ServiceIdentityAddForm.tsx` `28~46 행` — props 계약 (`service` · `externalId` · `onServiceChange` · `onExternalIdChange` · `onSubmit` 필수, `loading?` · `error?` 선택). `isPrimary` 입력 축이 없다는 것도 계약이다.
- `web/src/views/AdminView.service-identity-wiring.test.tsx` `1~50 행` — 승계할 spec 패턴 (별도 파일 + file-level `vi.mock('../api/useApiResource')` + presentational stub prop 캡처 + `renderToStaticMarkup`, 새 dependency 0). 이 파일과 `AdminView.test.tsx` 는 **수정하지 않는다**.

## Acceptance Criteria

- [ ] `web/src/views/AdminView.tsx` 에 모듈 레벨 순수 async 러너 `runCreateServiceIdentity(personId: string, input: { service: string; externalId: string }, deps: CreateServiceIdentityDeps): Promise<void>` 와 그 `CreateServiceIdentityDeps` 인터페이스를 신설한다 (`runDeletePerson` / `runCreatePerson` 동형). deps 는 최소 `create` (기본 주입은 `createServiceIdentity`) · `describeError` · `creating` · `setCreating` · `setCreateError` · `bumpRefresh` · `resetInput` 를 받는다.
- [ ] 러너의 발사 가드: (a) `personId` 가 falsy · 빈 · 공백뿐이면 **미발사** (인원 미선택 상태에서 POST 가 나가면 안 된다), (b) `service` 또는 `externalId` 가 trim 후 빈 문자열이면 **미발사** (backend 400 확정 요청 사전 차단), (c) `deps.creating` 이 true 면 **미발사** (이중 POST · state 경합 차단). 발사 시 `setCreating(true)` + 직전 error 비움 → `await deps.create(...)` → 성공 시 `bumpRefresh()` + `resetInput()` / 실패 시 `setCreateError(describeError(e))` 로 안전 표시 (**throw 0**, 실패 시 nonce bump 와 입력 초기화 모두 하지 않는다) → 진행 off 는 성공·실패 공통.
- [ ] 컨테이너에 controlled 입력 state 2 개 (`identityServiceInput` · `identityExternalIdInput`) · in-flight 플래그 (`creatingServiceIdentity`) · 실패 문구 (`createServiceIdentityError`) · 재조회 nonce (`serviceIdentitiesRefreshNonce`) 를 신설하고, `handleCreateServiceIdentity` `useCallback` 이 위 러너에 deps 를 주입해 호출만 하도록 배선한다 (입력값 · in-flight · 선택 인원을 deps 배열에 포함해 stale 방지).
- [ ] 기존 `serviceIdentitiesPath` `useMemo` 를 `buildServiceIdentitiesPath(selectedIdentityPersonId || undefined, serviceIdentitiesRefreshNonce)` 로 확장하고 deps 배열에 nonce 를 추가한다 — builder 본문 · `ServiceIdentityList` 마운트 · 조회 `<select>` 는 수정하지 않는다.
- [ ] `ServiceIdentityAddForm` 을 default import 로 인원 관리 섹션의 `ServiceIdentityList` 근처에 마운트한다. `loading` 은 `creatingServiceIdentity`, `error` 는 `createServiceIdentityError` 를 내려보낸다. **컴포넌트 파일 · `web/src/api/serviceIdentity.ts` 는 수정하지 않는다** (ADR-0041 Decision 1 — 폼은 fetch 를 모른다).
- [ ] `runCreateServiceIdentity` 를 파일 하단 test-only export 목록에 추가한다.
- [ ] `web/src/views/AdminView.service-identity-create.test.tsx` 를 신설한다 (vitest + `renderToStaticMarkup` + `vi.mock`, 새 dependency 0). 아래 R-112 4 종을 모두 덮는다:
  - [ ] **happy-path** — (1) 정상 personId + 정상 입력으로 러너 호출 시 `create` 가 정확히 `(personId, { service, externalId })` 인자로 1 회 호출되고 성공 후 `bumpRefresh` · `resetInput` 이 각 1 회 호출되며 `setCreating` 이 true → false 순으로 전이하는 test 1+, (2) AdminView 렌더 시 `ServiceIdentityAddForm` 이 마운트되고 초기 입력 2 개가 빈 문자열 · `loading` falsy · `error` undefined 로 내려가는 test 1+.
  - [ ] **error path** — `create` 가 reject (예: 409 중복 · 400 · 네트워크) 할 때 `setCreateError` 가 `describeError` 결과로 호출되고 **러너가 throw 하지 않으며** `bumpRefresh` · `resetInput` 이 호출되지 않고 진행 플래그가 false 로 되돌아가는 test 각 1+.
  - [ ] **분기 cover** — 3 no-op 가드 (personId 미선택 / 입력 미완 / `creating` true) 각각에 대해 `create` 가 호출되지 않고 `setCreating` 도 호출되지 않는 test 1+, 그리고 `buildServiceIdentitiesPath` 에 nonce 0 → base / nonce 1+ → `?_r=` 부착이 전달되는 컨테이너 분기 test 1+.
  - [ ] **negative cases 충분 cover** — personId 가 `undefined` · 빈 문자열 · 공백뿐인 경우, `service` 만 공백 · `externalId` 만 공백 · 둘 다 공백인 경우, `create` 가 `ApiError` 가 아닌 값 (문자열 · `null`) 으로 reject 하는 경우 (`describeError` 가 흡수해 문구가 표시되고 throw 0), 실패 직후 재시도 시 직전 error 가 먼저 비워지는 경우 — 각 1+ test.
- [ ] `cd web && pnpm test` 통과 (신규 spec 포함 전 suite green — 기존 `AdminView.test.tsx` · `AdminView.service-identity-wiring.test.tsx` 회귀 0).
- [ ] `cd web && pnpm build` 통과 (`tsc --noEmit` 포함 — 타입 오류 0).
- [ ] repo root 에서 `pnpm lint && pnpm build && pnpm test:cov` 통과 — coverage threshold line ≥ 80% AND function ≥ 80% 유지 (본 task 는 `src/` 를 건드리지 않으므로 backend 결과가 직전과 동일해야 한다).
- [ ] 최종 diff 가 300 LOC / 2 파일 안에 든다. 초과 조짐이 보이면 주석 · 중복 case 를 축약해 맞추되 **R-112 필수 케이스는 삭제하지 않는다** (T-1766 실행 선례).

## Out of Scope

- `ServiceIdentityEditForm` · `ServiceIdentityRowActions` 마운트, `updateServiceIdentity` · `deleteServiceIdentity` · `setPrimaryServiceIdentity` 호출, 편집 대상 row 상태 보유 — 후속 수정 축 · 삭제/primary 축 slice 책임.
- `web/src/components/ServiceIdentity*.tsx` · `web/src/api/serviceIdentity.ts` 본문 수정 (읽기 전용 재사용만).
- `buildServiceIdentitiesPath` 본문 · 조회 `<select>` · `ServiceIdentityList` 마운트 수정 (T-1766 산출물 그대로 재사용, 호출 인자만 확장).
- `web/src/views/AdminView.test.tsx` (9827 행) · `web/src/views/AdminView.service-identity-wiring.test.tsx` 수정 — 본 slice 는 별도 spec 파일만 추가한다. 기존 spec 이 새 폼 때문에 깨지면 그 사실을 Follow-ups 에 적고 **BLOCKED 로 올린다** (파일 3 개째 편집은 cap 위험).
- service 후보 목록 (활성 instance key) 제시 · CSS · 탭 내비게이션 · Admin+ RBAC gating — PLAN `133 행` (R-187 ~ R-191) 및 ADR-0058 `§Consequences (b)` 별건.
- `docs/requirements.md` REQ-078 · REQ-079 status 재판정, ADR-0058 `§Follow-ups` 완료 표기, `docs/architecture/*` doc-sync.
- `scripts/daily-test.sh` leg 추가 (drift-guard smoke spec 3 개 동반 변경으로 cap 초과).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)
