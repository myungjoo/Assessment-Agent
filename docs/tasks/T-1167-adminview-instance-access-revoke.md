---
id: T-1167
title: AdminView 에 사용자 인스턴스 접근 권한 회수 배선 (DELETE /api/users/:id/instance-access)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-016, REQ-044]
estimatedDiff: 230
estimatedFiles: 2
created: 2026-07-24
independentStream: web-admin-user
dependsOn: [T-1166]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.test.tsx
plannerNote: P6 line120 Admin 사용자 관리 arc 10번째 slice — T-1166 이 defer 한 revoke(DELETE) 반대 방향 배선
---

# T-1167 — AdminView 에 사용자 인스턴스 접근 권한 회수 배선 (DELETE /api/users/:id/instance-access)

## Why

PLAN.md P6 line 120 (Admin 패널) 사용자 관리 arc 의 10번째 slice 다. T-1166 이 grant(POST) 한 방향만 배선하고 revoke(DELETE) 를 명시적으로 다음 slice 로 남겼다 (T-1166 Out of Scope 1행). backend 는 `DELETE /api/users/:id/instance-access` 를 **이미 shipped** 했는데 (ADR-0027 §1/§4, REQ-016 접근 권한 인식 / REQ-044 사용자 권한 관리) web UI 가 **0** 이라, 사람이 화면에서 잘못 부여한 권한을 회수할 경로가 없다 — 부여만 되고 회수는 못 하는 편도 표면이라 실사용 gap 이 명확하다.

본 task 는 T-1166 이 이미 마운트한 폼(대상 select + 인스턴스 주소 input)을 **재사용**하고 회수 버튼 1개 + 순수 async 러너 1개만 더한다. 새 폼·새 조회·새 상태 뭉치를 만들지 않아 diff 가 작다.

## Required Reading

- `src/user-instance-access/user-instance-access.controller.ts` 94~114행 `@Delete()` — `@HttpCode(204)` + `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`, body 는 grant 와 **같은** `GrantInstanceAccessDto` (`{ instanceRef }`), 성공 204 No Content(body 없음). controller 자체 분기 0 — service raw forward.
- `src/user-instance-access/user-instance-access.service.ts` 118~136행 `revoke()` 주석/본문 — (a) self-revoke 는 `ForbiddenException` 403, (b) `normalizeInstanceRef` 정규화값 기준 삭제, (c) **부재 binding 은 idempotent no-op(에러 없이 204)** — grant 와 달리 **409 분기가 없다**, (d) P2003(unknown user) → 404.
- `web/src/api/apiClient.ts` 39~46행 `parseBody` — content-type 이 json 이 아니면 `response.text()`. 204 No Content 는 body 가 비어 있어 `''` 로 정상 resolve 하며 JSON 파싱 throw 가 없다(본 task 가 성공 경로에서 반환값을 쓰지 않는 근거).
- `web/src/views/AdminView.tsx` 121~127행 instance-access 문구 상수 3종 (`INSTANCE_ACCESS_DUPLICATE_ERROR` / `INSTANCE_ACCESS_GRANTED_TEXT` / `INSTANCE_ACCESS_NO_USER_LABEL`) — 새 회수 성공 문구 상수는 이 블록에 같은 convention 으로 추가한다.
- `web/src/views/AdminView.tsx` 1718~1721행 `buildInstanceAccessPath(userId)` — **재사용**한다. grant 와 revoke 는 같은 path 라 새 helper 를 만들지 않는다.
- `web/src/views/AdminView.tsx` 1725~1770행 `GrantInstanceAccessDeps` + `runGrantInstanceAccess` — **본 task 러너의 1:1 mirror 원본**(가드 → 진행 on + error·notice 비움 → 발사 → 성공/실패 분기 → `finally` 진행 off, throw 0). 차이는 method(`DELETE`) 와 409 분기 부재뿐이다.
- `web/src/views/AdminView.tsx` 3602~3625행 instance-access state 5종 (`instanceAccessUserId` / `instanceRefInput` / `grantingInstanceAccess` / `instanceAccessError` / `instanceAccessNotice`) 과 `handleGrantInstanceAccess` useCallback — 본 task 는 여기에 진행 플래그 1개만 더한다.
- `web/src/views/AdminView.tsx` 4264~4300행 grant 폼 markup (`<select aria-label="접근 권한을 부여할 사용자">` / `<input aria-label="부여할 인스턴스 주소">` / 부여 버튼 / `role="alert"` / `role="status"`) — 회수 버튼은 **이 div 안**, 부여 버튼 바로 뒤에 둔다.
- `web/src/views/AdminView.tsx` 4650~4705행 test-only `export { ... }` 값 목록과 타입 export 목록 — 새 러너 / deps 타입을 같은 목록에 추가한다.
- `web/src/views/AdminView.test.tsx` 8985행~ `describe('AdminView — 인스턴스 접근 권한 부여 실 POST mutation (T-1166 runGrantInstanceAccess)')` 의 `makeDeps` harness — 본 task 의 새 describe 는 이 convention(러너 직접 호출 + mock deps, RTL 없음, 초기 렌더 단언은 `renderToStaticMarkup`)을 그대로 따른다.

## Acceptance Criteria

- [ ] 회수 성공 문구 상수 1개(예: `INSTANCE_ACCESS_REVOKED_TEXT = '인스턴스 접근 권한을 회수했습니다'`)를 `INSTANCE_ACCESS_GRANTED_TEXT` 옆에 추가한다. **부재 binding 도 성공(204)** 이므로 "회수했습니다" 문구가 idempotent no-op 에도 뜬다는 근거를 한국어 주석 1줄로 남긴다.
- [ ] `RevokeInstanceAccessDeps` + 순수 async 러너 `runRevokeInstanceAccess(userId, instanceRef, deps)` 를 추가한다(`GrantInstanceAccessDeps` / `runGrantInstanceAccess` mirror). 계약: (a) `userId` 또는 trim 된 `instanceRef` 가 빈 값이거나 `revoking` 이 true 면 **미발사**(상태 전이 0), (b) 발사 시 진행 on + 직전 error·성공 안내 비움, (c) `deps.revoke(buildInstanceAccessPath(trimmedId), { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instanceRef: trimmed }) })`, (d) 성공 시 회수 안내 문구 set + 인스턴스 입력만 초기화(선택된 사용자 유지 — grant 와 동형), (e) 실패 시 `describeError` 파생 문구를 error state 로 표면화하고 **throw 하지 않는다**, (f) `finally` 로 진행 off.
- [ ] **409 분기를 만들지 않는다** — service 가 부재 binding 을 idempotent 성공으로 처리하므로 `isConflict` 를 deps 에 두지 않는다. 그 근거(ADR-0027 §4 revoke idempotency)를 한국어 주석 1줄로 박제한다.
- [ ] 컨테이너에 진행 플래그 `revokingInstanceAccess` 1개와 `handleRevokeInstanceAccess` useCallback 을 추가한다. 대상 select / 인스턴스 input / error / notice state 는 **T-1166 것을 그대로 재사용**하고 새로 만들지 않는다(같은 폼 두 방향 action).
- [ ] grant 폼 div 안, 부여 버튼 바로 뒤에 `type="button"` 회수 버튼(라벨 예: `인스턴스 접근 권한 회수`)을 마운트한다. 두 버튼과 select·input 모두 **grant 또는 revoke 중 어느 하나라도 진행 중이면 비활성화**한다(교차 발사 이중 방어). 회수 버튼은 사용자 미선택·입력 공백에도 비활성화한다.
- [ ] `aria-label` 문자열 3종(`접근 권한을 부여할 사용자` / `부여할 인스턴스 주소` / `인스턴스 접근 권한 부여`)은 **한 글자도 바꾸지 않는다** — T-1166 test 의 selector 다. 라벨 일반화는 Follow-ups 로만 남긴다.
- [ ] 기존 사용자 생성 / 역할 변경 / `UserList` / grant 배선은 **한 줄도 바꾸지 않는다** (계약 회귀 0). `usersRefreshNonce` 도 건드리지 않는다(instance-access 조회 endpoint 부재 — T-1166 상수 주석).
- [ ] happy-path unit test 1+ — 유효 사용자 id + 인스턴스 주소로 러너 호출 시 `revoke` mock 이 `'/api/users/u1/instance-access'` path 와 `{ method: 'DELETE', body: JSON.stringify({ instanceRef: '<trim 값>' }) }` 로 정확히 1회 호출되고, 회수 안내 set · 입력 초기화 · 진행 on→off 순서가 확인된다.
- [ ] error path unit test 1+ — 403(self-revoke) · 404(unknown user) · 400 · 네트워크 실패가 각각 `describeError` 파생 문구로 error state 에 표면화되고, throw 가 호출자로 새어나오지 않으며 회수 안내는 set 되지 않는다.
- [ ] 분기 cover — 각 1+ test: `revoking` true(미발사) / 빈 `userId`(미발사) / 빈 `instanceRef`(미발사) / 공백만 `instanceRef`(미발사) / 성공 분기 / 실패 분기. 미발사 경로에서는 `revoke` · setter 호출이 **모두 0** 이어야 한다.
- [ ] negative cases 충분 cover — 각 1+ test: (a) 공백 padding 이 든 인스턴스 주소는 body 에 trim 된 값이 실린다, (b) slash·물음표 등이 든 사용자 id 는 `encodeURIComponent` 로 인코딩된 path 가 나간다, (c) 실패 후 재발사가 정상 통과한다(진행 플래그 영구 잠금 0), (d) 성공 직후 직전 error 문구가 남지 않고 실패 직후 직전 성공 안내가 남지 않는다(두 표면 상호 배타), (e) 부재 binding 성공(204, 빈 body resolve)도 회수 안내를 set 한다(idempotent 계약), (f) `AdminView` 초기 렌더(`renderToStaticMarkup`)에서 회수 버튼이 사용자 관리 섹션 안 grant 폼과 같은 컨테이너에 존재하고 기존 grant 폼·사용자 목록 렌더가 회귀 0 이며, 비-Admin 렌더에서는 회수 버튼이 **미노출**(fail-closed) 이다.
- [ ] 기존 T-1159 / T-1160 / T-1162 / T-1164 / T-1165 / T-1166 describe 의 assertion 을 **하나도 삭제·약화하지 않는다** — 전부 그대로 통과해야 한다.
- [ ] `pnpm --dir web test` (vitest) 전체 green + `pnpm --dir web build` (tsc + vite) green. 루트 `pnpm lint` clean.
- [ ] `pnpm test:cov` 기준선 유지 — 본 task 는 `src/` 를 건드리지 않으므로 backend coverage (line ≥ 80% / function ≥ 80%) 가 그대로 통과해야 한다.
- [ ] 사이즈 게이트 — 최종 diff ≤ 300 LOC / 파일 2개. 목표 배분: `AdminView.tsx` ≤ 80 LOC, `AdminView.test.tsx` ≤ 160 LOC. 초과 예상 시 (1) 주석을 선례 참조(`runGrantInstanceAccess` mirror) 한 줄로 압축하고 (2) 분기 / negative test 를 `it.each` 표로 합친다. **test 항목 자체를 빼서 줄이지 말 것** (R-112 위반).

## Out of Scope

- **`createInFlightIdGate`(T-1165) ref 패턴을 grant/revoke 로 확산** — 두 mutation 을 한 번에 훑는 별도 sweep task 로 남긴다(본 task 에서 grant 를 건드리면 회귀 표면이 커진다).
- 인스턴스 접근 권한 **목록 표시** — backend 에 GET(조회) endpoint 가 없다. 없는 계약을 프런트에서 추측 구현하지 않는다.
- 회수 확인(confirm) 다이얼로그 · 되돌리기 UX — 본 slice 는 계약 배선만.
- 403(self-revoke) / 404(unknown user) 전용 한국어 문구 분화 — 전부 `describeError` 일반 경로. (grant 의 409 전용 문구와 달리 revoke 는 전용 문구 0.)
- `web/src/components/UserList.tsx` / `UserList.test.tsx` 수정 — 본 slice 는 컨테이너 폼이며 presentational 층 확장 불요. 파일 수 cap 도 깨진다.
- `web/src/api/*` (apiClient · useApiResource) 수정 — 기존 `request` primitive 를 그대로 주입한다.
- `aria-label` 문자열의 "부여할" → 중립 표현 일반화 — T-1166 test selector 를 깨뜨린다. Follow-ups 로만.
- backend (`src/`) · prisma schema · `deploy/daily-test.sh` · smoke drift-guard spec (T-0791/T-0944/T-0947) · `docs/architecture/*` 수정 — daily-test leg 계열은 parity spec 3종 동반 갱신이 강제돼 5파일 cap 을 깬다(T-1122 / Q-0054 선례).
- `web/package.json` 의 vitest coverage threshold 도입 — `@vitest/coverage-v8` 새 외부 dependency 라 CLAUDE.md §5 게이트 대상(PLAN P6 backlog 박제됨).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)
