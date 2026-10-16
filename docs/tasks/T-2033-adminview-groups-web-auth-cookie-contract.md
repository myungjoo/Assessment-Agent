---
id: T-2033
title: groups guard 배선 선행 3 — AdminView 컨테이너 groups 4 발사 web 인증 cookie 전송 계약 test
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-043, REQ-045, REQ-046, REQ-073]
estimatedDiff: 210
estimatedFiles: 1
created: 2026-10-14
independentStream: q0056-groups-guard
dependsOn: [T-2032]
touchesFiles: [web/src/views/AdminView.groups-auth-cookie.test.ts]
hqOrigin: Q-0056
plannerNote: P5 · Q-0056 ① groups 축 선행 3 — 오너 조건(web cookie 전송 확인) 잔여분 AdminView 4 발사, production 0 LOC
---

# T-2033 — groups guard 배선 선행 3: AdminView 컨테이너 groups 4 발사 web 인증 cookie 전송 계약 test

## Why

[PLAN.md](../PLAN.md) `157 행` 오너 최우선 지시 아래 진행하는 Q-0056 arc 의 groups 축 세 번째 조각이다. [T-2032](T-2032-groups-memberships-web-auth-cookie-contract.md) (`15fb3613`) 이 멤버십 hook 3 발사를 잠갔고, 그 `## Follow-ups` ②b 가 **AdminView 컨테이너의 groups 4 발사** (목록 GET · 생성 POST · 수정 PATCH · 삭제 DELETE) 를 다음 순서로 예약했다. 이 test 는 오너 승인 조건이다 — `STATE.humanQuestions` Q-0056 `decision` 은 "각 slice 는 해당 route 를 호출하는 web 측이 인증 cookie 를 실제로 전송해 guard 배선 후에도 401 로 깨지지 않는지 확인하고, 그 확인을 AC 와 test 로 박제한다" 를 요구한다. 본 slice 가 머지되면 groups 9 route 의 web 발사 7 곳이 전부 잠긴다 (README `83` · `85` · `86 행`).

**security / auth 범위 판정 (CLAUDE.md §5)**: auth 동작을 바꾸지 않는다. production 변경 0 LOC 의 test 신설이고, 검증 대상인 `credentials: 'same-origin'` 강제는 이미 main 에 있는 `web/src/api/apiClient.ts` `63 행` · `78 행` 동작이다 ([ADR-0008](../decisions/ADR-0008-auth-credential-type.md) 범위 안). Q-0056 옵션 ① 승인 범위이므로 추가 HQ 는 필요 없다 (T-2020 · T-2032 선례).

issue-still-relevant pre-check (planner, 2026-10-14, `origin/main` = `6bab43f3`):

- `git ls-files "web/src/**auth-cookie*"` → `useAdminPersons.auth-cookie.test.ts` · `useAdminMemberships.auth-cookie.test.ts` **2 건뿐**. AdminView 컨테이너 groups 4 발사 계약 test 는 main 에 없다 → 착수 유효.
- 기존 `web/src/views/AdminView.test.tsx` (10,117 줄) 는 `../api/useApiResource` (`23 행`) 와 `../api/apiClient` (`46 행`) 를 둘 다 mock 한다. 그래서 실 `fetch` 에 `credentials` 가 실리는지는 **검증하지 못한다** — 본 slice 가 메우는 빈칸이다.
- `src/user/group.controller.ts` guard 는 아직 미배선이다. 본 test 는 guard 유무와 무관하게 green 이다.
- T-2032 머지 이후 main commit 은 bookkeeping 1 건 (`6bab43f3`) 뿐이고 본 slice 를 금지하는 owner 지시는 없다. PLAN `158 행` (per-route perf baseline 신설 금지) 은 무관하다.

**harness 가 선례와 달라지는 지점 (planner 실측 — 구현 전에 반드시 읽을 것)**: 4 발사는 hook 이 아니라 `AdminView` 컴포넌트 본문에 있다 (`AdminView.tsx` `513~516 행` `groupsPath`, `636~648 행` `handleCreateGroup`, `666~677 행` `handleDeleteGroup`, `743~766 행` `handleUpdateGroup`). 서버 렌더 (`renderToStaticMarkup`) 에서는 state 가 초기값에 고정되고 그 초기값을 주입하는 props 가 groups 축에는 없다 (`initialSelectedGroupId` 는 멤버십 선택용). 따라서 캡처한 `onCreateSubmit` · `onEditSubmit` 을 그대로 부르면 `groupNameInput === ''` · `editingGroupId === null` 이라 `runCreateGroup` (`77~80 행` 빈 name 가드) · `runUpdateGroup` (`390~392 행` 빈 id 가드) 이 **발사 전에 반환한다**. 삭제만 인자 (`id`) 를 직접 받으므로 그대로 발사된다. 이 제약은 AC 의 "러너 pass-through 가 가드 입력을 고정값으로 대체" 규칙으로 푼다 — 계약의 대상은 입력값이 아니라 **컨테이너가 러너에 주입한 발사 primitive 가 실 `request` 인가** 이기 때문이다.

## Required Reading

- `docs/STATE.json` 의 `humanQuestions` Q-0056 `decision` (오너 조건 원문)
- [web/src/views/useAdminMemberships.auth-cookie.test.ts](../../web/src/views/useAdminMemberships.auth-cookie.test.ts) 전체 (163 줄) — **harness 정본**. `13~24 행` `instrument`, `25~40 행` 부분 mock 2 개, `63~71 행` `startResourceEffect` 로 effect 본체 직접 실행, `73~163 행` 단언 구성과 `it.each` 묶음
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) — `228 행` `AdminGroupsSection` import, `509~527 행` 목록 조회, `636~648 행` · `666~677 행` · `743~766 행` 핸들러 3 개, `1674~1692 행` 섹션 마운트 props (수정 금지, 읽기만)
- [web/src/views/adminGroupPartMutationRunners.ts](../../web/src/views/adminGroupPartMutationRunners.ts) `48~110 행` `runCreateGroup` · `193~250 행` `runDeleteGroup` · `354~440 행` `runUpdateGroup` — deps 키 이름 (`create` · `remove` · `update`) 과 가드 순서 · 발사 path · method · body (수정 금지)
- [web/src/views/adminResourcePathBuilders.ts](../../web/src/views/adminResourcePathBuilders.ts) `79~84 행` `buildGroupsPath` — nonce 0 이면 `/api/groups`
- [web/src/api/apiClient.ts](../../web/src/api/apiClient.ts) `52~90 행` — `credentials` 강제와 401 → refresh → retry 흐름 (수정 금지)
- 신규 test 의 colocated 위치: `web/src/views/AdminView.groups-auth-cookie.test.ts`

## Acceptance Criteria

**계약 test 신설 (1 파일)**

- [ ] `web/src/views/AdminView.groups-auth-cookie.test.ts` 를 새로 만든다. `../api/apiClient` 는 **mock 하지 않고** 전역 `fetch` 만 `vi.stubGlobal` 로 stub 한다. `../api/useApiResource` 는 T-2032 와 같은 pass-through (원본 호출 + path 기록) 로 감싼다.
- [ ] `./AdminGroupsSection` 의 default export 를 props 캡처용 mock (받은 props 를 기록하고 `null` 반환) 으로 바꾸고 `AdminView` 를 `renderToStaticMarkup` 으로 1 회 렌더해 `onCreateSubmit` · `onEditSubmit` · `onDelete` 를 얻는다. 렌더 자체로는 `fetch` 가 0 회임을 단언한다 (서버 렌더는 effect 를 돌리지 않는다).
- [ ] `./adminGroupPartMutationRunners` 는 부분 mock 으로 감싸되 `runCreateGroup` · `runUpdateGroup` · `runDeleteGroup` 3 개만 pass-through 로 바꾼다 (파트 러너 등 나머지 export 는 원본 그대로). pass-through 는 **컨테이너가 넘긴 deps 를 `instrument` 해 원본 러너에 그대로 전달** 하고, 가드 입력만 고정값으로 대체한다 — create 는 name, update 는 id · name · originalName (서로 다른 값). 대체 사실과 이유 (서버 렌더에서 state 주입 불가) 를 mock 바로 위 주석 2~3 줄로 적는다. delete 는 호출 인자를 대체하지 않는다.
- [ ] **happy-path — GET**: 기록된 `useApiResource` path 중 `/api/groups` (nonce 0, `buildGroupsPath` 실측) 가 있고, 그 path 로 `startResourceEffect` 를 돌리면 실 `fetch` 두 번째 인자의 `credentials` 가 `'same-origin'` 이며 완료 상태 `data` 가 응답 본문과 같다.
- [ ] **happy-path — mutation 3 종** (`it.each` 권장): `onCreateSubmit()` → `POST /api/groups`, `onEditSubmit()` → `PATCH /api/groups/<id>`, `onDelete(id)` → `DELETE /api/groups/<id>` 가 각각 `credentials: 'same-origin'` 으로 정확히 1 회 발사된다. 각 경우 컨테이너가 넘긴 deps 의 발사 primitive (`create` · `update` · `remove`) 가 실 `request` 와 identity 로 같고 `bumpRefresh` spy 가 1 회 호출된다.
- [ ] **error path**: GET 이 401 이고 refresh 도 401 이면 완료 상태가 `error` 를 드러내고, refresh 요청 (`/api/auth/refresh`) 도 `same-origin` 이다.
- [ ] **분기**: mutation 1 종 (PATCH 권장) 에서 401 → refresh 성공 → retry 의 3 요청이 전부 `same-origin` 이고 `bumpRefresh` 가 1 회 호출된다.
- [ ] **negative — 예외 분기마다 1+**: ① POST 403 이면 `bumpRefresh` 미호출 + `setCreateError` 가 호출된다. ② DELETE 중 `fetch` reject 면 `bumpRefresh` 미호출 + `setDeleteError` 가 호출된다. ③ PATCH 409 (또는 러너가 구분하는 다른 비-2xx — 실측) 면 `closeEdit` 미호출 + `setUpdateError` 가 호출된다. ④ 컨테이너가 주입한 실 primitive 에 `credentials: 'omit'` 을 cast 로 넘겨도 실 `fetch` 에는 `same-origin` 이 실린다. ⑤ 빈 id 로 `onDelete('')` 를 부르면 `fetch` 가 0 회다 (`runDeleteGroup` 가드 경유). error 문구는 러너 실측에 맞추고, 문구가 불안정하면 "문자열로 호출됨" 수준으로만 단언한다.
- [ ] **regression 가드 (`hqOrigin` 있음)**: `credentials` 를 보는 단언은 전부 **실 `fetch` mock 의 호출 인자** 로 판정한다. `apiClient.ts` 에서 `credentials: 'same-origin'` 을 지우면 본 파일이 red 가 됨을 로컬에서 1 회 확인하고 (커밋하지 않고 되돌림), 그 결과를 PR body 에 한 줄로 적는다.
- [ ] 파일 상단 주석에 "AdminView 컨테이너 groups 축 web 인증 cookie 전송 계약 (T-2033, Q-0056 ① groups guard 배선 선행)" 취지와 harness 가 T-2032 선례에서 달라지는 두 지점 (섹션 props 캡처 · 가드 입력 대체) 을 4~7 줄로 적는다.

**R-110 / R-112**

- [ ] R-112 적용 판정: 본 slice 는 **신규 · 수정 public symbol 0, production 분기 0** 인 test 신설이다. (1)~(4) 는 위 happy · error · 분기 · negative 항목으로 충족한다.
- [ ] 동작 무변경: `git diff --stat origin/main -- src prisma test web/src/api web/src/views/AdminView.tsx web/src/views/AdminGroupsSection.tsx web/src/views/adminGroupPartMutationRunners.ts` 가 비어 있다. 기존 `AdminView.test.tsx` 는 수정하지 않는다.
- [ ] web 의 `test` (vitest) · `build` (`tsc --noEmit` + vite build) script 가 통과한다 — 실행 방식은 `.github/workflows/ci.yml` 의 web step 과 같게 한다. 신규 파일의 test 가 전부 pass 다.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). backend 변경 0 이라 수치 불변.
- [ ] `git diff --stat` 이 `touchesFiles` 1 파일이고 diff ≤ 300 LOC 다. 넘길 것 같으면 mutation · negative 를 `it.each` 표로 묶고 주석을 줄여 맞춘다 (T-2020 · T-2032 선례). 그래도 넘으면 중단하고 수치를 `## Follow-ups` 에 적는다.
- [ ] `AdminView` 전체 서버 렌더가 실 `useApiResource` · 실 `apiClient` 아래에서 throw 하면 (다른 섹션 hook 이 렌더 시점에 `fetch` 를 요구하는 경우 등) production 을 고치지 말고 중단한 뒤 원인 hook 과 줄 번호를 `## Follow-ups` 에 적는다.

## Out of Scope

- `src/user/group.controller.ts` guard 실배선, `group.controller.spec.ts`, e2e 401 · 403 단언, census allowlist 축소.
- perf 6 spec · k6 `s2-read.js` · drift smoke 의 cookie 대응.
- `AdminView.tsx` 에 groups 초기값 주입 props (`initialGroupNameInput` 류) 추가 — test 를 위한 production 표면 확장은 하지 않는다. `apiClient.ts` · 러너 · `AdminGroupsSection.tsx` 수정도 없다.
- 공용 auth-cookie test helper 추출 — 본 slice 가 3 번째 소비처라 추출 여부를 판단할 시점이지만, harness 가 hook probe (2 건) 와 컨테이너 캡처 (1 건) 로 갈려 공통부가 `instrument` · `json` 정도다. 판단만 `## Follow-ups` 에 남기고 추출은 하지 않는다.
- parts 축 (`runCreatePart` 등) 의 cookie 계약 — parts arc 몫.
- jsdom · testing-library 등 새 dependency (ADR-0040 §5).
- `docs/requirements.md` REQ status 재판정, api.md doc-sync — 3 controller arc 머지 후 REQ 당 1 회.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (planner, arc 계획 — Q-0056 groups 축 잔여) 순서대로 큐잉한다. 각 slice 착수 전에 소비처를 다시 실측한다. 내용은 [T-2031](T-2031-groups-guard-precursor-cookie-preattach.md) `## Follow-ups` 그대로.
  - ③ **perf 선행** 3 + 3 파일 (mock 부트 3 spec guard override → realdb 3 spec cookie 선탑재).
  - ④ **k6 선행** (`test/load/s2-read.js` groups 3 지점 + drift smoke 전제 갱신).
  - ⑤ **guard 실배선** read 4 route → write 5 route → e2e 401 · 403.
- (planner, 미결 — ⑤ 착수 전 확정 필요) api.md groups 표에 tier 행이 없는 4 route 문제는 T-2031 `## Follow-ups` 둘째 항목에 그대로 남아 있다.
- (driver journal 2026-10-11 이월) `test/smoke/groups.smoke-spec.ts` · `persons.smoke-spec.ts` 상단 "실 DB 전략" 주석 정리는 해당 파일을 다시 건드리는 slice (⑤ e2e 등) 에서 함께 한다. 단건 큐잉은 하지 않는다.
- (planner 판정, CLAUDE.md §3 소비처 동반 의무) helper · factory 신설 없음 — 기존 컨테이너를 구동하는 test 1 파일이다 → 하한 해당 없음.
- (planner 판정, cap) base 210 LOC (T-2032 실측 163 줄 + 섹션 props 캡처 mock ~15 + 러너 3 종 가드 입력 대체 ~20 + PATCH negative ~12), test 신설이라 multiplier × 1.0. `estimatedFiles` 1 → cap 안, `sizeExempt` 불요.
