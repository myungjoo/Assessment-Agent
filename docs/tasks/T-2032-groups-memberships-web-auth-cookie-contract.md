---
id: T-2032
title: groups guard 배선 선행 2 — 멤버십 축 web 인증 cookie 전송 계약 test (useAdminMemberships 3 발사)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-043, REQ-045, REQ-046, REQ-073]
estimatedDiff: 190
estimatedFiles: 1
created: 2026-10-12
independentStream: q0056-groups-guard
dependsOn: [T-2031]
touchesFiles: [web/src/views/useAdminMemberships.auth-cookie.test.ts]
hqOrigin: Q-0056
plannerNote: P5 · Q-0056 ① groups 축 선행 2 — 오너 조건(web cookie 전송 확인) 중 멤버십 hook 3 발사, production 0 LOC
---

# T-2032 — groups guard 배선 선행 2: 멤버십 축 web 인증 cookie 전송 계약 test

## Why

[PLAN.md](../PLAN.md) `157 행` 오너 최우선 지시 아래 진행하는 Q-0056 arc 의 groups 축 두 번째 조각이다. [T-2031](T-2031-groups-guard-precursor-cookie-preattach.md) (`63eb406f`) 이 backend 2 spec 에 cookie 를 선탑재했고, 그 `## Follow-ups` ② 가 **web cookie 전송 계약 test** 를 다음 순서로 예약했다. 이 test 는 선택 사항이 아니라 오너 승인 조건이다 — `STATE.humanQuestions` Q-0056 `decision` 은 "각 slice 는 해당 route 를 호출하는 web 측이 인증 cookie 를 실제로 전송해 guard 배선 후에도 401 로 깨지지 않는지 확인하고, 그 확인을 AC 와 test 로 박제한다" 를 요구한다 (README `83` · `85` · `86 행`).

**security / auth 범위 판정 (CLAUDE.md §5)**: 본 slice 는 auth 동작을 바꾸지 않는다. production 변경 0 LOC 의 test 신설이고, 검증 대상인 `credentials: 'same-origin'` 강제는 이미 main 에 있는 `web/src/api/apiClient.ts` `63 행` · `78 행` 동작이다 ([ADR-0008](../decisions/ADR-0008-auth-credential-type.md) HttpOnly cookie 범위 안). guard 재사용 · 새 dependency 0 · api.md tier 준수는 Q-0056 옵션 ① 승인 범위이므로 추가 HQ 는 필요 없다 (persons 축 [T-2020](T-2020-persons-guard-precursor-cookie-preattach.md) 선례).

**분할 근거 (cap 수치)**: groups 의 web 발사 지점은 7 곳 · 2 모듈이다 — `useAdminMemberships` hook 3 곳 (멤버 GET · 추가 POST · 제거 DELETE) 과 `AdminView` 컨테이너 4 곳 (목록 GET · 생성 POST · 수정 PATCH · 삭제 DELETE). persons 선례 test 는 hook 1 개 · 4 발사에 151 줄이었고 T-2020 은 추정 210 → 첫 diff 486 LOC 였다. 컨테이너 쪽은 hook probe 가 아니라 `AdminView` 전체를 렌더해 `AdminGroupsSection` props 를 가로채야 해서 harness 가 다르다. 두 모듈을 한 PR 에 담으면 ~340 LOC 로 cap 을 넘으므로 **hook 3 발사만** 본 slice 가 가져가고 컨테이너 4 발사는 `## Follow-ups` 에 예약한다.

issue-still-relevant pre-check (planner, 2026-10-12, `origin/main` = `5bc36383`):

- `git ls-files "web/src/**auth-cookie*"` → `web/src/views/useAdminPersons.auth-cookie.test.ts` **1 건뿐**. groups 축 cookie 계약 test 는 main 에 없다 → 착수 유효.
- 기존 `web/src/views/useAdminMemberships.test.ts` (744 줄) 는 `../api/apiClient` 의 `request` 를 stub 으로 갈아끼운다 (`48~51 행`). 그래서 실 `fetch` 에 `credentials` 가 실리는지는 **검증하지 못한다** — 본 slice 가 메우는 빈칸이다.
- `src/user/group.controller.ts` guard 는 아직 미배선이다 (T-2031 pre-check 이후 그 파일 변경 commit 0). 본 test 는 guard 유무와 무관하게 green 이다.
- 최근 main commit (`00aa682e` ~ `5bc36383`) 은 T-2031 큐잉 · 머지 · bookkeeping 뿐이고 본 slice 를 금지하는 owner 지시는 없다. PLAN `158 행` (per-route perf baseline 신설 금지) 은 본 slice 와 무관하다.

## Required Reading

- `docs/STATE.json` 의 `humanQuestions` Q-0056 `decision` (오너 조건 원문)
- [web/src/views/useAdminPersons.auth-cookie.test.ts](../../web/src/views/useAdminPersons.auth-cookie.test.ts) 전체 (151 줄) — **harness 정본**. `13~24 행` `instrument` (러너 deps pass-through + 상태 전이 spy), `25~40 행` 부분 mock 2 개, `52~61 행` 서버 렌더 probe, `69~75 행` `startResourceEffect` 로 effect 본체 직접 실행, `77~151 행` 단언 구성
- [web/src/views/useAdminMemberships.ts](../../web/src/views/useAdminMemberships.ts) — `44~48 행` 파라미터 (`groups` · `selectedGroupId` · `personData`), `79~91 행` `groupMembersPath` + `useApiResource` 조회, `109~121 행` `handleRemove` (`remove: request`), `138~151 행` `handleAdd` (`add: request`), `163~177 행` 반환 표면 (수정 금지, 읽기만)
- [web/src/views/adminMembershipRunners.ts](../../web/src/views/adminMembershipRunners.ts) `48 행` `runRemove` · `114 행` `runAdd` — deps 키 이름과 발사 path · method · body (수정 금지)
- [web/src/views/adminResourcePathBuilders.ts](../../web/src/views/adminResourcePathBuilders.ts) 의 `buildGroupMembersPath` — nonce 0 일 때의 실제 URL 형태를 여기서 확인해 단언 문자열을 정한다
- [web/src/api/apiClient.ts](../../web/src/api/apiClient.ts) `52~90 행` — `credentials` 강제와 401 → refresh → retry 흐름 (수정 금지)
- 신규 test 의 colocated 위치: `web/src/views/useAdminMemberships.auth-cookie.test.ts`

## Acceptance Criteria

**계약 test 신설 (1 파일)**

- [ ] `web/src/views/useAdminMemberships.auth-cookie.test.ts` 를 새로 만든다. `../api/apiClient` 는 **mock 하지 않고** 전역 `fetch` 만 `vi.stubGlobal` 로 stub 한다. `../api/useApiResource` 와 `./adminMembershipRunners` 는 persons 선례와 같은 pass-through 부분 mock (원본 호출 + 인자 기록 · 상태 전이 콜백만 spy) 으로 감싼다.
- [ ] **happy-path — GET**: 그룹이 선택된 상태 (`selectedGroupId` 비어 있지 않음) 로 hook 을 렌더하고, hook 이 `useApiResource` 에 넘긴 path 로 `startResourceEffect` 를 돌린다. 실 `fetch` 첫 인자가 `/api/groups/<id>/members` 형태 (정확한 문자열은 `buildGroupMembersPath` 실측) 이고 두 번째 인자의 `credentials` 가 `'same-origin'` 이며 완료 상태의 `data` 가 응답 본문과 같다.
- [ ] **happy-path — mutation 2 종**: `handleAdd(personId)` 는 `POST /api/groups/<id>/members`, `handleRemove(membershipId)` 는 `DELETE /api/groups/<id>/members/<membershipId>` 를 `credentials: 'same-origin'` 으로 정확히 1 회 발사한다. 각 경우 러너 deps 의 발사 primitive (`add` · `remove`) 가 실 `request` 와 identity 로 같고 `bumpRefresh` spy 가 1 회 호출된다.
- [ ] **error path**: GET 이 401 이고 refresh 도 401 이면 완료 상태가 `error` 를 드러내고, refresh 요청 (`/api/auth/refresh`) 도 `same-origin` 이다.
- [ ] **분기**: GET 401 → refresh 성공 → retry 의 3 요청이 전부 `same-origin` 이고 최종 `data` 가 드러난다. 그룹 미선택 (`selectedGroupId === ''`) 이면 hook 이 `useApiResource` 에 `null` 을 넘겨 `fetch` 가 0 회다.
- [ ] **negative — 예외 분기마다 1+**: ① POST 403 이면 `bumpRefresh` 미호출 + `setAddError` 가 403 문구로 호출된다. ② DELETE 중 `fetch` reject 면 `bumpRefresh` 미호출 + `setRemoveError` 가 네트워크 오류 문구로 호출된다. ③ hook 이 주입한 실 primitive 에 `credentials: 'omit'` 을 cast 로 넘겨도 실 `fetch` 에는 `same-origin` 이 실린다 (강제 순서 회귀 가드). ④ 빈 `personId` 로 `handleAdd` 를 부르면 `fetch` 가 0 회다 (러너 no-op 가드 경유 — 실제 가드 조건은 `adminMembershipRunners.ts` 실측에 맞춘다).
- [ ] **regression 가드 (`hqOrigin` 있음)**: 위 단언 중 `credentials` 를 보는 것은 전부 **실 `fetch` mock 의 호출 인자** 로 판정한다 (`request` stub 호출 인자가 아니다). `apiClient.ts` 에서 `credentials: 'same-origin'` 을 지우면 본 파일이 red 가 됨을 로컬에서 1 회 확인하고 (커밋하지 않고 되돌림), 그 결과를 PR body 에 한 줄로 적는다.
- [ ] 파일 상단 주석에 "멤버십 축 web 인증 cookie 전송 계약 (T-2032, Q-0056 ① groups guard 배선 선행)" 취지와 harness 가 persons 선례를 따른다는 사실을 3~6 줄로 적는다.

**R-110 / R-112**

- [ ] R-112 적용 판정: 본 slice 는 **신규 · 수정 public symbol 0, production 분기 0** 인 test 신설이다. (1)~(4) 는 위 happy · error · 분기 · negative 항목으로 충족한다.
- [ ] 동작 무변경: `git diff --stat origin/main -- src prisma test web/src/views/useAdminMemberships.ts web/src/api` 가 비어 있다. 기존 `useAdminMemberships.test.ts` 는 수정하지 않는다.
- [ ] web 의 `test` (vitest) · `build` (`tsc --noEmit` + vite build) script 가 통과한다 — 실행 방식은 `.github/workflows/ci.yml` 의 web step 과 같게 한다. 신규 파일의 test 가 전부 pass 다.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). backend 변경 0 이라 수치 불변.
- [ ] `git diff --stat` 이 `touchesFiles` 1 파일이고 diff ≤ 300 LOC 다. 넘길 것 같으면 mutation 2 종을 `it.each` 표로 묶고 주석을 줄여 맞춘다 (T-2020 선례). 그래도 넘으면 중단하고 수치를 `## Follow-ups` 에 적는다.

## Out of Scope

- `AdminView` 컨테이너의 groups 4 발사 (목록 GET · 생성 · 수정 · 삭제) cookie 계약 test — 다음 slice (아래 Follow-ups).
- `src/user/group.controller.ts` guard 실배선, `group.controller.spec.ts`, e2e 401 · 403 단언, census allowlist 축소.
- perf 6 spec · k6 `s2-read.js` · drift smoke 의 cookie 대응.
- `web/src/api/apiClient.ts` · `useAdminMemberships.ts` · `adminMembershipRunners.ts` 등 production 파일 수정, 공용 test helper 추출 (persons 선례 test 와의 harness 중복은 알고 남긴다 — 3 번째 소비처가 생기는 slice 에서 판단).
- jsdom · testing-library 등 새 dependency (ADR-0040 §5).
- `docs/requirements.md` REQ status 재판정, api.md doc-sync — 3 controller arc 머지 후 REQ 당 1 회.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (planner, arc 계획 — Q-0056 groups 축 잔여) 순서대로 큐잉한다. 각 slice 착수 전에 소비처를 다시 실측한다.
  - ②b **AdminView groups 4 발사 cookie 계약 test** (`pr`, web test 1 파일, 예: `web/src/views/AdminView.groups-auth-cookie.test.ts`): `AdminView` 를 서버 렌더하고 `AdminGroupsSection` (`web/src/views/AdminView.tsx` `1674 행` 부근) 을 props 캡처용으로 mock 해 `onCreateSubmit` · `onEditSubmit` · `onDelete` 를 발사, 목록 GET 은 `buildGroupsPath` path 로 `startResourceEffect` 실행. 러너는 `adminGroupPartMutationRunners.ts` 의 `runCreateGroup` · `runUpdateGroup` · `runDeleteGroup`. 본 slice 와 파일-disjoint.
  - ③ **perf 선행** 3 + 3 파일, ④ **k6 선행**, ⑤ **guard 실배선** read → write → e2e — 내용은 [T-2031](T-2031-groups-guard-precursor-cookie-preattach.md) `## Follow-ups` 그대로.
- (planner, 미결 — ⑤ 착수 전 확정 필요) api.md groups 표에 tier 행이 없는 4 route 문제는 T-2031 `## Follow-ups` 둘째 항목에 그대로 남아 있다.
- (driver journal 2026-10-11 이월) `test/smoke/groups.smoke-spec.ts` · `persons.smoke-spec.ts` 상단 "실 DB 전략" 주석이 새 부트 경로 (`createE2EApp` 경유) 와 어긋난다 — 해당 파일을 다시 건드리는 slice (⑤ e2e 등) 에서 함께 정리한다. 단건 큐잉은 하지 않는다 (PLAN `183 행`).
- (planner 판정, CLAUDE.md §3 소비처 동반 의무) helper · factory 신설 없음 — 기존 hook 을 구동하는 test 1 파일이다 → 하한 해당 없음.
- (planner 판정, cap) base 190 LOC (persons 선례 151 줄 + 그룹 미선택 분기 · no-op 가드 negative 증분 ~40), test 신설이라 multiplier × 1.0. `estimatedFiles` 1 → cap 안, `sizeExempt` 불요.
