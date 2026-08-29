---
id: T-1770
title: AdminView 에 ServiceIdentity primary 지정(POST primary) 순수 러너 runSetPrimaryServiceIdentity 신설
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-078, REQ-079]
estimatedDiff: 190
estimatedFiles: 2
created: 2026-08-29
independentStream: service-identity-web
dependsOn: [T-1769]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.service-identity-primary.test.tsx
plannerNote: "P6/PLAN 132 행 — ADR-0058 (d) 열두 번째 web slice: primary 축 러너만 절단 (마운트는 다음 slice)"
---

# T-1770 — AdminView 에 ServiceIdentity primary 지정 순수 러너 신설

## Why

[PLAN.md](../PLAN.md) `132 행` 오너 지시 (R-182 ~ R-183) 의 잔여는 [ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups (d)` **AdminView 편집 UI** 다. 읽기 축 ([T-1766](T-1766-adminview-service-identity-list-wiring.md)) · 추가 축 ([T-1767](T-1767-adminview-service-identity-create-wiring.md)) · 수정 축 ([T-1768](T-1768-adminview-service-identity-update-wiring.md)) 이 배선됐고, 삭제 축은 [T-1769](T-1769-service-identity-delete-runner.md) 가 **순수 러너까지** 올렸다. 남은 쓰기 축은 **primary 지정 (POST primary)** 한 겹 + 그 뒤의 `ServiceIdentityRowActions` 마운트다.

[T-1769](T-1769-service-identity-delete-runner.md) 가 마운트를 미룬 이유가 그대로 유효하다 — `ServiceIdentityRowActions` 의 `onDeleteRequest` · `onDeleteConfirm` · `onDeleteCancel` · `onSetPrimary` 가 **모두 필수 prop** 이라, primary 러너 없이 마운트하면 아무 동작도 하지 않는 "primary 로 지정" 버튼이 노출된다. 반대로 primary 러너 + 컨테이너 state + 마운트를 한 slice 에 담으면 직전 3 slice 실적 (T-1767 · T-1768 각 2 파일 `+300`, T-1769 `+184`) 상 cap (≤ 300 LOC / ≤ 5 파일) 을 넘길 위험이 크다.

그래서 본 slice 는 **primary 축의 순수 러너 1 개 (`runSetPrimaryServiceIdentity`) 와 그 spec 만** 절단한다. 이로써 마운트 slice 가 필요로 하는 러너 2 개 (삭제 · primary) 가 모두 준비되고, 다음 slice 는 컨테이너 state + 마운트만 담아 cap 안에 든다.

## Required Reading

- `web/src/views/AdminView.tsx` `1845~1888 행` — 승계할 정본 선례 `DeleteServiceIdentityDeps` + `runDeleteServiceIdentity` (모듈 레벨 순수 async 러너: 3 no-op 가드 → 진행 on + 직전 error 비움 → `await` → 성공 `bumpRefresh()` / 실패 `setDeleteError(describeError(e))` (**throw 0**) → `finally` 진행 off). 본 slice 의 러너는 이 구조를 1:1 mirror 하되 **확인 단계가 없어 종료 콜백 (`endConfirm`) 을 받지 않는다**.
- `web/src/api/serviceIdentity.ts` `191~211 행` — `setPrimaryServiceIdentity(personId, identityId): Promise<ServiceIdentityRow>` 시그니처와 throw 계약 (빈 · 공백뿐 path param 은 호출 없이 `ApiError(0)`, body 없음, 이미 primary 인 행에 재요청해도 결과가 같은 **idempotent**, 404 3 단 · 401 · 5xx · 네트워크는 `ApiError` 전파). path 를 직접 조립하지 말고 이 함수를 쓴다.
- `web/src/components/ServiceIdentityRowActions.tsx` `1~50 행` — 후속 마운트 slice 가 쓸 props 계약 (`onSetPrimary` 는 이미 primary 인 행에서 disabled). 본 slice 는 **이 파일을 수정하지도 import 하지도 않는다**.
- `web/src/views/AdminView.service-identity-delete.test.tsx` `1~40 행` — 승계할 spec 패턴 (별도 파일 + `makeDeps` 헬퍼 + 전이 순서를 담는 `order` 배열, 컨테이너 렌더 0, 새 dependency 0).
- `web/src/views/AdminView.tsx` `5436~5456 행` test-only export 목록 — 신규 러너를 `runDeleteServiceIdentity` 인접에 추가해야 spec 이 import 할 수 있다.

## Acceptance Criteria

- [ ] `web/src/views/AdminView.tsx` 에 모듈 레벨 순수 async 러너 `runSetPrimaryServiceIdentity(personId: string, identityId: string, deps: SetPrimaryServiceIdentityDeps): Promise<void>` 와 그 `SetPrimaryServiceIdentityDeps` 인터페이스를 신설한다 (`runDeleteServiceIdentity` 동형). deps 는 최소 `setPrimary` (기본 주입 대상은 `setPrimaryServiceIdentity`) · `describeError` · `settingPrimary` · `setSettingPrimary` · `setPrimaryError` · `bumpRefresh` 를 받는다.
- [ ] 러너의 발사 가드 3 종: (a) `personId` 가 falsy · 빈 · 공백뿐이면 **미발사**, (b) `identityId` 가 falsy · 빈 · 공백뿐이면 **미발사** (깨진 item path 차단), (c) `deps.settingPrimary` 가 true 면 **미발사** (이중 POST 경합 차단). **"이미 primary 인 행" 가드는 두지 않는다** — client 계약이 idempotent 이고 버튼 disable 은 `ServiceIdentityRowActions` 책임이라는 근거를 코드 주석 1 줄로 남긴다.
- [ ] 발사 시 `setSettingPrimary(true)` + 직전 error 비움 → `await deps.setPrimary(personId, identityId)` → 성공 시 `bumpRefresh()` / 실패 시 `setPrimaryError(describeError(e))` 로 안전 표시 (**throw 0**, 실패 시 재조회하지 않는다) → 진행 off 는 성공 · 실패 공통 (`finally`).
- [ ] 성공 응답의 승격 row 반환값을 **소비하지 않고 버린다** — "1 인원 1 primary" invariant 상 승격은 직전 primary 행의 해제를 동반하는데 (ADR-0058 `§Decision 2`) 응답에는 그 반대편 행이 없어 낙관 갱신이 목록을 어긋나게 만든다. 그래서 `bumpRefresh()` 권위 재조회만 건다는 근거를 주석 1~2 줄로 남긴다.
- [ ] `runSetPrimaryServiceIdentity` 를 파일 하단 test-only export 목록에 추가한다.
- [ ] `web/src/views/AdminView.service-identity-primary.test.tsx` 를 신설한다 (vitest, 새 dependency 0). 아래 R-112 4 종을 모두 덮는다:
  - [ ] **happy-path** — 정상 인자로 러너 호출 시 `setPrimary` 가 정확히 `(personId, identityId)` 2 인자로 1 회 호출되고, 성공 후 `bumpRefresh` 가 1 회 호출되며 `setSettingPrimary` 가 true → false 순으로 전이하고 직전 error 가 먼저 비워지는 test 1+.
  - [ ] **error path** — `setPrimary` 가 reject (404 · 401 · 네트워크) 할 때 `setPrimaryError` 가 `describeError` 결과로 호출되고 **러너가 throw 하지 않으며** `bumpRefresh` 가 호출되지 않고 진행 플래그가 false 로 되돌아가는 test 각 1+.
  - [ ] **분기 cover** — 3 no-op 가드 (personId 미선택 / identityId 미선택 / `settingPrimary` true) 각각에 대해 `setPrimary` 도 `setSettingPrimary` 도 `setPrimaryError` 도 호출되지 않는 test 1+, 그리고 성공 분기와 실패 분기에서 `finally` 가 각각 실행되는 것을 확인하는 test 1+.
  - [ ] **negative cases 충분 cover** — `personId` · `identityId` 가 `undefined` · 빈 문자열 · 공백뿐인 경우, 앞뒤 공백이 섞인 id 가 trim 된 값으로 전달되는 경우, `setPrimary` 가 `ApiError` 가 아닌 값 (문자열 · `null` · `undefined`) 으로 reject 하는 경우 (`describeError` 가 흡수해 문구 표시 + throw 0), 이미 primary 인 대상에 재발사해도 호출이 그대로 1 회 나가고 성공 처리되는 경우 (idempotent — 가드 없음), 실패 직후 같은 대상으로 재시도할 때 직전 error 가 먼저 비워지는 경우 — 각 1+ test.
- [ ] `cd web && pnpm test` 통과 (신규 spec 포함 전 suite green — 기존 `AdminView.test.tsx` · `AdminView.service-identity-wiring.test.tsx` · `AdminView.service-identity-create.test.tsx` · `AdminView.service-identity-update.test.tsx` · `AdminView.service-identity-delete.test.tsx` 회귀 0).
- [ ] `cd web && pnpm build` 통과 (`tsc --noEmit` 포함 — 타입 오류 0).
- [ ] repo root 에서 `pnpm lint && pnpm build && pnpm test:cov` 통과 — coverage threshold line ≥ 80% AND function ≥ 80% 유지 (본 task 는 `src/` 를 건드리지 않으므로 backend 결과가 직전과 동일해야 한다).
- [ ] 최종 diff 가 300 LOC / 2 파일 안에 든다.

## Out of Scope

- `ServiceIdentityRowActions` 마운트 · 삭제 확인 (`confirmingDelete`) state 보유 · `handleDeleteServiceIdentity` · `handleSetPrimary` `useCallback` · 컨테이너 state 신설 — 후속 마운트 slice 책임 (본 slice 는 순수 러너 + spec 만).
- `runDeleteServiceIdentity` 수정 · deps 통합 리팩터 (두 러너의 진행 플래그를 하나로 합치는 등) — 마운트 slice 에서 실제 사용 형태가 확정된 뒤 판단.
- `web/src/components/ServiceIdentity*.tsx` · `web/src/api/serviceIdentity.ts` 수정 (읽기 전용 참조만).
- `buildServiceIdentitiesPath` · 조회 인원 `<select>` · 수정 대상 `<select>` · `ServiceIdentityList` · `ServiceIdentityAddForm` · `ServiceIdentityEditForm` 마운트 수정 (T-1766 ~ T-1769 산출물 그대로).
- `web/src/views/AdminView.test.tsx` (약 9800 행) · 기존 service-identity spec 4 종 수정 — 본 slice 는 별도 spec 파일만 추가한다. 기존 spec 이 깨지면 그 사실을 Follow-ups 에 적고 **BLOCKED 로 올린다** (파일 3 개째 편집은 cap 위험).
- 조회 인원 변경 시 `editingIdentityId` 잔존 정리 (T-1768 reviewer Nit) — 공통 helper 정리는 마운트 slice 에서.
- `docs/requirements.md` REQ-078 · REQ-079 status 재판정, ADR-0058 `§Follow-ups` 완료 표기, `docs/architecture/*` doc-sync — 쓰기 축 마운트 완료 후 별도 doc-sync slice.
- Admin+ RBAC gating · CSS · 탭 내비게이션 — PLAN `133 행` (R-187 ~ R-191) 별건.
- `scripts/daily-test.sh` leg 추가 — drift-guard smoke spec 3 개 동반 변경이 강제돼 5 파일 cap 을 넘는다 (Q-0054 선례). 명시적 scope 밖.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 적는다.)

## 완료 기록

- 완료: 2026-08-29T00:52:21Z (PR [#1398](https://github.com/myungjoo/Assessment-Agent/pull/1398) squash `427f1f53`)
- 결과: `web/src/views/AdminView.tsx` 에 `runSetPrimaryServiceIdentity` + `SetPrimaryServiceIdentityDeps` 신설, colocated spec 1 개 추가 (2 파일 `+197/-0`). 3 no-op 가드 + "이미 primary" 무가드 + 승격 row 미소비(`bumpRefresh()` 권위 재조회) 근거를 주석으로 박제. reviewer APPROVE(round 1/7) → 4-게이트 PASS.
- test: web 2760 test / root 458 suite · 13208 test green, `test:cov` threshold(line·function ≥ 80%) 유지. R-112 4 종(happy 1 · error 3 · 가드 7 분기 + finally 2 · negative 8) 전부 cover.
