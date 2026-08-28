---
id: T-1768
title: AdminView 에 ServiceIdentity 수정(PATCH) 축 배선 (runUpdateServiceIdentity 러너 + 수정 대상 select + ServiceIdentityEditForm 마운트)
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-078, REQ-079]
estimatedDiff: 285
estimatedFiles: 2
created: 2026-08-29
independentStream: service-identity-web
dependsOn: [T-1767]
prNumber: 1396
completedAt: 2026-08-28T23:03:56Z
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.service-identity-update.test.tsx
plannerNote: "P6/PLAN 132 행 — ADR-0058 (d) 열 번째 web slice: 쓰기 축 잔여 2 겹 중 수정(PATCH) 1 겹만 절단"
---

# T-1768 — AdminView 에 ServiceIdentity 수정(PATCH) 축 배선

## Why

[PLAN.md](../PLAN.md) `132 행` 오너 지시 (R-182 ~ R-183) 의 잔여는 [ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups (d)` **AdminView 편집 UI** 다. backend 5 route (T-1748 ~ T-1756) · web client 5 함수 (T-1759 ~ T-1761) · presentational 컴포넌트 4 종 (T-1762 ~ T-1765) 이 박제됐고, [T-1766](T-1766-adminview-service-identity-list-wiring.md) 이 읽기 축 (GET), [T-1767](T-1767-adminview-service-identity-create-wiring.md) 이 추가 축 (POST) 을 배선했다.

남은 쓰기 축은 **수정 (PATCH)** 과 **삭제 · primary 지정 (DELETE / POST primary)** 2 겹이며, 둘을 한 번에 붙이면 직전 slice 실적 (T-1767 = 2 파일 `+300`) 상 cap (≤ 300 LOC / ≤ 5 파일) 을 확실히 넘는다. 본 task 는 그중 **수정 (`PATCH /api/persons/:personId/identities/:identityId`) 1 겹만** 절단한다 — `runUpdateServiceIdentity` 순수 러너 + 수정 대상 선택 · 편집 state · 핸들러 + T-1764 가 이미 만든 `ServiceIdentityEditForm` 마운트 + 성공 시 목록 재조회 nonce bump.

`ServiceIdentityEditForm` 과 `web/src/api/serviceIdentity.ts` 는 이미 완결돼 있으므로 **두 파일 모두 수정하지 않는다** (ADR-0041 Decision 1 — 폼은 fetch 를 모른다). REQ-078 / REQ-079 의 status 재판정은 쓰기 축 3 겹이 모두 마운트된 뒤 별도 doc-sync slice 에서 한다.

## Required Reading

- `web/src/views/AdminView.tsx` `1725~1783 행` — 승계할 정본 선례 `ServiceIdentityInput` + `CreateServiceIdentityDeps` + `runCreateServiceIdentity` (모듈 레벨 순수 async 러너: no-op 가드 → 진행 on + 직전 error 비움 → await → 성공 `bumpRefresh()` / 실패 `setError(describeError(e))` (**throw 0**) → `finally` 진행 off). 본 slice 의 러너는 이 구조를 1:1 mirror 한다.
- `web/src/views/AdminView.tsx` `2949~3035 행` — 확장 지점: `selectedIdentityPersonId` state (`2949 행`) · `serviceIdentitiesRefreshNonce` (`2960 행`) · `serviceIdentitiesPath` `useMemo` (`2966 행`) · `serviceIdentities` 방어 배열 (`2986 행`) · 추가 축 state 4 개와 `handleCreateServiceIdentity` `useCallback` (`2991~3032 행`).
- `web/src/views/AdminView.tsx` `4988~5021 행` — 마운트 지점 (인원 관리 `<section>` 안의 조회 `<select>` + `ServiceIdentityList` + `ServiceIdentityAddForm`). 수정 폼은 이 추가 폼 뒤에 붙인다.
- `web/src/views/AdminView.tsx` `5238~5261 행` 부근 test-only export 목록 — 신규 러너를 여기에 추가해야 spec 이 import 할 수 있다 (`buildServiceIdentitiesPath` `5238 행` · `runCreateServiceIdentity` `5260 행` 인접).
- `web/src/api/serviceIdentity.ts` `140~165 행` — `updateServiceIdentity(personId, identityId, { externalId })` 시그니처와 throw 계약 (빈 · 공백뿐 path param 은 호출 없이 `ApiError(0)`, 400 · 404 (부재 **또는 타 Person 소유**) · 401 · 5xx · 네트워크 모두 `ApiError` 전파, 전송 body 는 `externalId` 단일). path 를 직접 조립하지 말고 이 함수를 쓴다.
- `web/src/components/ServiceIdentityEditForm.tsx` `30~52 행` — props 계약 (`service` · `initialExternalId` · `externalId` · `onExternalIdChange` · `onSubmit` · `onCancel` 필수, `loading?` · `error?` 선택). `service` 는 읽기 전용 표시 축이고 `isPrimary` 입력 축은 없다는 것도 계약이다.
- `web/src/components/ServiceIdentityEditForm.tsx` `70~78 행` — 폼 자체 submit 게이팅 4 조건 (`loading` 우선 · 빈 입력 · 255 초과 · 변경 0). 특히 **변경 0 판정이 원문 비교** 라는 주석 — 러너가 `externalId` 를 trim 해 보내면 폼의 판정과 실제 저장값이 어긋나므로 본 slice 의 전송값 정책 근거가 된다.
- `web/src/views/AdminView.service-identity-create.test.tsx` `1~40 행` — 승계할 spec 패턴 (별도 파일 + file-level `vi.mock('../api/useApiResource')` + presentational stub prop 캡처 + `renderToStaticMarkup` + `makeDeps` 헬퍼, 새 dependency 0). 이 파일 · `AdminView.service-identity-wiring.test.tsx` · `AdminView.test.tsx` 는 **수정하지 않는다**.

## Acceptance Criteria

- [ ] `web/src/views/AdminView.tsx` 에 모듈 레벨 순수 async 러너 `runUpdateServiceIdentity(personId: string, identityId: string, input: { externalId: string }, deps: UpdateServiceIdentityDeps): Promise<void>` 와 그 `UpdateServiceIdentityDeps` 인터페이스를 신설한다 (`runCreateServiceIdentity` 동형). deps 는 최소 `update` (기본 주입은 `updateServiceIdentity`) · `describeError` · `updating` · `setUpdating` · `setUpdateError` · `bumpRefresh` · `endEdit` 를 받는다.
- [ ] 러너의 발사 가드 4 종: (a) `personId` 가 falsy · 빈 · 공백뿐이면 **미발사**, (b) `identityId` 가 falsy · 빈 · 공백뿐이면 **미발사** (깨진 item path 차단), (c) `externalId` 가 trim 후 빈 문자열이면 **미발사** (backend 400 확정 요청 사전 차단), (d) `deps.updating` 이 true 면 **미발사** (이중 PATCH · state 경합 차단).
- [ ] 발사 시 `setUpdating(true)` + 직전 error 비움 → `await deps.update(personId, identityId, { externalId })` → 성공 시 `bumpRefresh()` + `endEdit()` / 실패 시 `setUpdateError(describeError(e))` 로 안전 표시 (**throw 0**, 실패 시 nonce bump 도 편집 종료도 하지 않는다 — 입력을 남겨 재시도할 수 있어야 한다) → 진행 off 는 성공 · 실패 공통 (`finally`).
- [ ] 전송 `externalId` 는 **trim 하지 않은 원문** 을 그대로 보낸다 (빈 판정에만 trim 을 쓴다). 그 근거 (`ServiceIdentityEditForm` 의 변경 0 판정이 원문 비교라 trim 전송 시 판정과 저장값이 어긋난다) 를 코드 주석 1~2 줄로 남긴다.
- [ ] 컨테이너에 편집 state 4 개를 신설한다 — 수정 대상 id (`editingIdentityId`, 빈 문자열이 미편집) · controlled 입력 (`identityEditExternalIdInput`) · in-flight 플래그 (`updatingServiceIdentity`) · 실패 문구 (`updateServiceIdentityError`). 그리고 `editingIdentity` 를 `serviceIdentities` 에서 id 로 찾아 파생시킨다 (**새 fetch 0** — 목록에서 사라진 대상이면 `undefined` 가 되어 폼이 자연히 접힌다).
- [ ] 수정 대상 선택 `<select>` (`aria-label="수정 대상 identity 선택"`) 을 신설한다. 옵션은 `serviceIdentities` 파생이고 (미선택 option 1 개 + row 당 1 개), 선택 변경 시 `editingIdentityId` 를 갱신하면서 해당 row 의 `externalId` 로 입력을 prefill 하고 직전 실패 문구를 비운다. **`ServiceIdentityList` · 조회 인원 `<select>` 는 수정하지 않는다.**
- [ ] `handleUpdateServiceIdentity` `useCallback` 이 위 러너에 deps 를 주입해 호출만 하도록 배선한다 (선택 인원 · 대상 id · 입력값 · in-flight 를 deps 배열에 포함해 stale 방지). 편집 취소 핸들러는 대상 id · 입력 · 실패 문구를 모두 초기 상태로 되돌린다.
- [ ] `ServiceIdentityEditForm` 을 default import 로 `ServiceIdentityAddForm` 뒤에 **조건부 마운트** 한다 (`editingIdentity` 가 `undefined` 면 미렌더). `service` 는 `editingIdentity.service`, `initialExternalId` 는 `editingIdentity.externalId`, `loading` 은 `updatingServiceIdentity`, `error` 는 `updateServiceIdentityError` 를 내려보낸다. **`web/src/components/ServiceIdentity*.tsx` · `web/src/api/serviceIdentity.ts` 는 수정하지 않는다.**
- [ ] `runUpdateServiceIdentity` 를 파일 하단 test-only export 목록에 추가한다.
- [ ] T-1767 이 남긴 reviewer Nit 1 건을 함께 흡수한다 — `type ServiceIdentityInput` (`1725 행`) 위에 그 타입이 무엇인지 설명하는 주석 1 줄 추가.
- [ ] `web/src/views/AdminView.service-identity-update.test.tsx` 를 신설한다 (vitest + `renderToStaticMarkup` + `vi.mock`, 새 dependency 0). 아래 R-112 4 종을 모두 덮는다:
  - [ ] **happy-path** — (1) 정상 인자로 러너 호출 시 `update` 가 정확히 `(personId, identityId, { externalId })` 로 1 회 호출되고 성공 후 `bumpRefresh` · `endEdit` 가 각 1 회 호출되며 `setUpdating` 이 true → false 순으로 전이하는 test 1+, (2) 편집 대상이 목록에 있을 때 AdminView 렌더에서 `ServiceIdentityEditForm` 이 마운트되고 `service` · `initialExternalId` 가 그 row 값으로, `loading` falsy · `error` undefined 로 내려가는 test 1+.
  - [ ] **error path** — `update` 가 reject (400 · 404 · 네트워크) 할 때 `setUpdateError` 가 `describeError` 결과로 호출되고 **러너가 throw 하지 않으며** `bumpRefresh` · `endEdit` 가 호출되지 않고 진행 플래그가 false 로 되돌아가는 test 각 1+.
  - [ ] **분기 cover** — 4 no-op 가드 (personId 미선택 / identityId 미선택 / 입력 미완 / `updating` true) 각각에 대해 `update` 도 `setUpdating` 도 호출되지 않는 test 1+, 그리고 컨테이너 분기 2 종 — 편집 대상 미선택 시 폼 미마운트 · 선택 id 가 목록에 없을 때 (삭제됐거나 조회 인원이 바뀐 경우) 폼 미마운트 — 각 1+.
  - [ ] **negative cases 충분 cover** — `identityId` 가 `undefined` · 빈 문자열 · 공백뿐인 경우, `externalId` 가 공백뿐인 경우, 앞뒤 공백이 포함된 `externalId` 가 **trim 되지 않고 원문 그대로** 전송되는 경우, `update` 가 `ApiError` 가 아닌 값 (문자열 · `null`) 으로 reject 하는 경우 (`describeError` 가 흡수해 문구 표시 + throw 0), 실패 직후 재시도 시 직전 error 가 먼저 비워지는 경우 — 각 1+ test.
- [ ] `cd web && pnpm test` 통과 (신규 spec 포함 전 suite green — 기존 `AdminView.test.tsx` · `AdminView.service-identity-wiring.test.tsx` · `AdminView.service-identity-create.test.tsx` 회귀 0).
- [ ] `cd web && pnpm build` 통과 (`tsc --noEmit` 포함 — 타입 오류 0).
- [ ] repo root 에서 `pnpm lint && pnpm build && pnpm test:cov` 통과 — coverage threshold line ≥ 80% AND function ≥ 80% 유지 (본 task 는 `src/` 를 건드리지 않으므로 backend 결과가 직전과 동일해야 한다).
- [ ] 최종 diff 가 300 LOC / 2 파일 안에 든다. 초과 조짐이 보이면 주석 · 중복 case 를 축약해 맞추되 **R-112 필수 케이스는 삭제하지 않는다** (T-1766 · T-1767 실행 선례).

## Out of Scope

- `ServiceIdentityRowActions` 마운트, `deleteServiceIdentity` · `setPrimaryServiceIdentity` 호출, 삭제 확인 상태 보유 — 후속 삭제 / primary 축 slice 책임.
- `web/src/components/ServiceIdentity*.tsx` · `web/src/api/serviceIdentity.ts` 본문 수정 (읽기 전용 재사용만).
- `buildServiceIdentitiesPath` 본문 · 조회 인원 `<select>` · `ServiceIdentityList` · `ServiceIdentityAddForm` 마운트 수정 (T-1766 · T-1767 산출물 그대로 재사용).
- `web/src/views/AdminView.test.tsx` (약 9800 행) · `AdminView.service-identity-wiring.test.tsx` · `AdminView.service-identity-create.test.tsx` 수정 — 본 slice 는 별도 spec 파일만 추가한다. 기존 spec 이 새 폼 · 새 `<select>` 때문에 깨지면 그 사실을 Follow-ups 에 적고 **BLOCKED 로 올린다** (파일 3 개째 편집은 cap 위험).
- 목록 행에서 바로 편집 진입하는 UX (`ServiceIdentityList` 에 `onEdit` 추가) · CSS · 탭 내비게이션 · Admin+ RBAC gating — PLAN `133 행` (R-187 ~ R-191) 및 ADR-0058 `§Consequences (b)` 별건.
- `docs/requirements.md` REQ-078 · REQ-079 status 재판정, ADR-0058 `§Follow-ups` 완료 표기, `docs/architecture/*` doc-sync.
- `scripts/daily-test.sh` leg 추가 — drift-guard smoke spec 3 개 동반 변경이 강제돼 5 파일 cap 을 넘는다 (Q-0054 선례). 명시적 scope 밖.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 적는다.)

## 결과 요약 (2026-08-28 완료)

- **DONE** — PR [#1396](https://github.com/myungjoo/Assessment-Agent/pull/1396) squash 머지 `4173f57b`, feature branch 삭제. reviewer APPROVE(round 1/7) → 4-게이트 PASS → CI green.
- 변경: `web/src/views/AdminView.tsx` + 신규 `web/src/views/AdminView.service-identity-update.test.tsx` (2 파일 `+300/-0` — cap 정확히 충족). 컴포넌트 · api client · 기존 3 spec 수정 0, 새 dependency 0.
- `runUpdateServiceIdentity` 순수 러너 + `UpdateServiceIdentityDeps` + 4 no-op 가드(personId · identityId · externalId · updating) + 성공 시 `bumpRefresh`/`endEdit` · 실패 시 문구만(throw 0) · finally 진행 off. `externalId` 는 폼의 변경 0 판정과 맞추려 원문 그대로 전송(근거 주석 동반).
- 편집 state 4 개 + `editingIdentity` 파생(새 fetch 0) + 수정 대상 `<select>`(aria-label) prefill + `ServiceIdentityEditForm` 조건부 마운트. T-1767 reviewer Nit(`ServiceIdentityInput` 설명 주석)도 흡수.
- test: web vitest 91 파일 2723 test green, 루트 jest 458 suite 13208 test green (line 99.94% · function 100%). R-112 4 종 — happy 2 · error 5(400 · 404 · network · 문자열 · null) · 가드/컨테이너 분기 8 · negative(원문 전송 · 재시도 error 선-비움 · 공백뿐 입력) 커버.

## Follow-ups (완료 시점 추가)

- 조회 인원 변경 시 `editingIdentityId` 잔존 — 파생(`editingIdentity`)이 흡수해 현재는 무해하나, 삭제/primary 축 slice 에서 공통 helper 로 정리 권장 (reviewer Nit).
- 목록 행 인라인 편집 UX 는 PLAN `133 행` 별건 — 본 slice 는 select 기반 편집만.
- ADR-0058 `§Follow-ups (d)` 잔여: 삭제/primary 축 배선 · RBAC gating · REQ-078/079 재판정.
