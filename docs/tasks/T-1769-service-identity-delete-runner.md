---
id: T-1769
title: AdminView 에 ServiceIdentity 삭제(DELETE) 순수 러너 runDeleteServiceIdentity 신설
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-078, REQ-079]
estimatedDiff: 195
estimatedFiles: 2
created: 2026-08-29
independentStream: service-identity-web
dependsOn: [T-1768]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.service-identity-delete.test.tsx
plannerNote: "P6/PLAN 132 행 — ADR-0058 (d) 열한 번째 web slice: 삭제 축을 러너만 절단 (마운트는 primary 러너 뒤)"
---

# T-1769 — AdminView 에 ServiceIdentity 삭제(DELETE) 순수 러너 신설

## Why

[PLAN.md](../PLAN.md) `132 행` 오너 지시 (R-182 ~ R-183) 의 잔여는 [ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups (d)` **AdminView 편집 UI** 다. 읽기 축 ([T-1766](T-1766-adminview-service-identity-list-wiring.md)) · 추가 축 ([T-1767](T-1767-adminview-service-identity-create-wiring.md)) · 수정 축 ([T-1768](T-1768-adminview-service-identity-update-wiring.md)) 이 배선됐고, 남은 쓰기 축은 **삭제 (DELETE)** 와 **primary 지정 (POST primary)** 2 겹이다.

두 겹의 UI 표면은 모두 [T-1765](T-1765-service-identity-row-actions-component.md) 가 만든 `ServiceIdentityRowActions` 한 컴포넌트가 진다 — 그 컴포넌트의 `onDeleteRequest` · `onDeleteConfirm` · `onDeleteCancel` · `onSetPrimary` 가 **모두 필수 prop** 이라, 삭제 축만 배선한 채 마운트하면 아무 동작도 하지 않는 "primary 로 지정" 버튼이 사용자에게 노출된다 (실제 결함). 반대로 삭제 + primary + 마운트를 한 slice 에 담으면 직전 3 slice 실적 (T-1767 · T-1768 각 2 파일 `+300`) 상 cap (≤ 300 LOC / ≤ 5 파일) 을 확실히 넘는다.

그래서 본 slice 는 **삭제 축의 순수 러너 1 개 (`runDeleteServiceIdentity`) 와 그 spec 만** 절단한다. 컨테이너 state · 마운트는 두지 않는다 — presentational 컴포넌트 4 종 (T-1762 ~ T-1765) 을 배선 전에 먼저 박제한 선례와 같은 단계적 분할이며, 러너는 test-only export 로 검증된다. 후속 slice 가 primary 러너를 만들고, 그 다음 slice 가 두 러너 + `ServiceIdentityRowActions` 마운트를 한 번에 배선한다.

## Required Reading

- `web/src/views/AdminView.tsx` `1791~1843 행` — 승계할 정본 선례 `UpdateServiceIdentityDeps` + `runUpdateServiceIdentity` (모듈 레벨 순수 async 러너: no-op 가드 → 진행 on + 직전 error 비움 → `await` → 성공 `bumpRefresh()` + 종료 콜백 / 실패 `setError(describeError(e))` (**throw 0**) → `finally` 진행 off). 본 slice 의 러너는 이 구조를 1:1 mirror 하되 입력 body 가 없다.
- `web/src/api/serviceIdentity.ts` `166~190 행` — `deleteServiceIdentity(personId, identityId): Promise<void>` 시그니처와 throw 계약 (빈 · 공백뿐 path param 은 호출 없이 `ApiError(0)`, 204 라 body 파싱 없음, 404 3 단 (Person 부재 · 타 Person 소유 · `P2025`) · 401 · 5xx · 네트워크 모두 `ApiError` 전파). path 를 직접 조립하지 말고 이 함수를 쓴다.
- `web/src/components/ServiceIdentityRowActions.tsx` `1~40 행` — 후속 마운트 slice 가 쓸 props 계약과 삭제 확인 2 단계 (`confirmingDelete`) semantic. 본 slice 는 **이 파일을 수정하지도 import 하지도 않는다** — 러너의 종료 콜백 이름 (`endConfirm`) 이 이 2 단계와 맞물린다는 것만 확인한다.
- `web/src/views/AdminView.service-identity-update.test.tsx` `1~40 행` — 승계할 spec 패턴 (별도 파일 + file-level `vi.mock('../api/useApiResource')` + `makeDeps` 헬퍼 + 전이 순서를 담는 `order` 배열, 새 dependency 0). 본 slice 는 컨테이너 렌더를 하지 않으므로 presentational stub · `renderToStaticMarkup` 부분은 생략해도 된다.
- `web/src/views/AdminView.tsx` `5378~5402 행` 부근 test-only export 목록 — 신규 러너를 여기에 추가해야 spec 이 import 할 수 있다 (`runCreateServiceIdentity` · `runUpdateServiceIdentity` 인접).

## Acceptance Criteria

- [ ] `web/src/views/AdminView.tsx` 에 모듈 레벨 순수 async 러너 `runDeleteServiceIdentity(personId: string, identityId: string, deps: DeleteServiceIdentityDeps): Promise<void>` 와 그 `DeleteServiceIdentityDeps` 인터페이스를 신설한다 (`runUpdateServiceIdentity` 동형). deps 는 최소 `remove` (기본 주입 대상은 `deleteServiceIdentity`) · `describeError` · `deleting` · `setDeleting` · `setDeleteError` · `bumpRefresh` · `endConfirm` 을 받는다.
- [ ] 러너의 발사 가드 3 종: (a) `personId` 가 falsy · 빈 · 공백뿐이면 **미발사**, (b) `identityId` 가 falsy · 빈 · 공백뿐이면 **미발사** (깨진 item path 차단), (c) `deps.deleting` 이 true 면 **미발사** (이중 DELETE — 두 번째가 404 로 실패해 오해를 부르는 것을 차단). 수정 축과 달리 body 입력이 없으므로 입력 미완 가드는 두지 않는다는 사실을 코드 주석 1 줄로 남긴다.
- [ ] 발사 시 `setDeleting(true)` + 직전 error 비움 → `await deps.remove(personId, identityId)` → 성공 시 `bumpRefresh()` + `endConfirm()` / 실패 시 `setDeleteError(describeError(e))` 로 안전 표시 (**throw 0**, 실패 시 재조회도 확인 단계 종료도 하지 않는다 — 확인 단계를 열어둬 재시도할 수 있어야 한다) → 진행 off 는 성공 · 실패 공통 (`finally`).
- [ ] 삭제 대상이 primary 였을 때의 자동 재승격은 backend 책임 ([ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Decision 2`) 이므로 러너는 낙관 갱신 · 승격 추론을 하지 않고 `bumpRefresh()` 로 권위 재조회만 한다는 근거를 주석 1~2 줄로 남긴다.
- [ ] `runDeleteServiceIdentity` 를 파일 하단 test-only export 목록에 추가한다.
- [ ] `web/src/views/AdminView.service-identity-delete.test.tsx` 를 신설한다 (vitest, 새 dependency 0). 아래 R-112 4 종을 모두 덮는다:
  - [ ] **happy-path** — 정상 인자로 러너 호출 시 `remove` 가 정확히 `(personId, identityId)` 2 인자로 1 회 호출되고, 성공 후 `bumpRefresh` · `endConfirm` 이 각 1 회 호출되며 `setDeleting` 이 true → false 순으로 전이하고 직전 error 가 먼저 비워지는 test 1+.
  - [ ] **error path** — `remove` 가 reject (404 · 401 · 네트워크) 할 때 `setDeleteError` 가 `describeError` 결과로 호출되고 **러너가 throw 하지 않으며** `bumpRefresh` · `endConfirm` 이 호출되지 않고 진행 플래그가 false 로 되돌아가는 test 각 1+.
  - [ ] **분기 cover** — 3 no-op 가드 (personId 미선택 / identityId 미선택 / `deleting` true) 각각에 대해 `remove` 도 `setDeleting` 도 `setDeleteError` 도 호출되지 않는 test 1+, 그리고 성공 분기와 실패 분기에서 `finally` 가 각각 실행되는 것을 확인하는 test 1+.
  - [ ] **negative cases 충분 cover** — `personId` · `identityId` 가 `undefined` · 빈 문자열 · 공백뿐인 경우, 앞뒤 공백이 섞인 id 가 trim 된 값으로 전달되는 경우, `remove` 가 `ApiError` 가 아닌 값 (문자열 · `null` · `undefined`) 으로 reject 하는 경우 (`describeError` 가 흡수해 문구 표시 + throw 0), 실패 직후 같은 대상으로 재시도할 때 직전 error 가 먼저 비워지는 경우 — 각 1+ test.
- [ ] `cd web && pnpm test` 통과 (신규 spec 포함 전 suite green — 기존 `AdminView.test.tsx` · `AdminView.service-identity-wiring.test.tsx` · `AdminView.service-identity-create.test.tsx` · `AdminView.service-identity-update.test.tsx` 회귀 0).
- [ ] `cd web && pnpm build` 통과 (`tsc --noEmit` 포함 — 타입 오류 0).
- [ ] repo root 에서 `pnpm lint && pnpm build && pnpm test:cov` 통과 — coverage threshold line ≥ 80% AND function ≥ 80% 유지 (본 task 는 `src/` 를 건드리지 않으므로 backend 결과가 직전과 동일해야 한다).
- [ ] 최종 diff 가 300 LOC / 2 파일 안에 든다.

## Out of Scope

- `ServiceIdentityRowActions` 마운트 · 삭제 확인 (`confirmingDelete`) state 보유 · `handleDeleteServiceIdentity` `useCallback` · 컨테이너 state 신설 — 후속 마운트 slice 책임 (본 slice 는 순수 러너 + spec 만).
- `setPrimaryServiceIdentity` 호출 · primary 축 러너 — 후속 primary slice 책임.
- `web/src/components/ServiceIdentity*.tsx` · `web/src/api/serviceIdentity.ts` 수정 (읽기 전용 참조만).
- `buildServiceIdentitiesPath` · 조회 인원 `<select>` · 수정 대상 `<select>` · `ServiceIdentityList` · `ServiceIdentityAddForm` · `ServiceIdentityEditForm` 마운트 수정 (T-1766 ~ T-1768 산출물 그대로).
- `web/src/views/AdminView.test.tsx` (약 9800 행) · 기존 service-identity spec 3 종 수정 — 본 slice 는 별도 spec 파일만 추가한다. 기존 spec 이 깨지면 그 사실을 Follow-ups 에 적고 **BLOCKED 로 올린다** (파일 3 개째 편집은 cap 위험).
- 조회 인원 변경 시 `editingIdentityId` 잔존 정리 (T-1768 reviewer Nit) — 공통 helper 정리는 마운트 slice 에서.
- `docs/requirements.md` REQ-078 · REQ-079 status 재판정, ADR-0058 `§Follow-ups` 완료 표기, `docs/architecture/*` doc-sync — 쓰기 축 3 겹 마운트 완료 후 별도 doc-sync slice.
- Admin+ RBAC gating · CSS · 탭 내비게이션 — PLAN `133 행` (R-187 ~ R-191) 별건.
- `scripts/daily-test.sh` leg 추가 — drift-guard smoke spec 3 개 동반 변경이 강제돼 5 파일 cap 을 넘는다 (Q-0054 선례). 명시적 scope 밖.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 적는다.)
