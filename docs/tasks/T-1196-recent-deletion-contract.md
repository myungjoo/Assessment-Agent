---
id: T-1196
title: 재평가(최근 N일 delete→재수집) 트리거 endpoint web↔backend 계약 drift-guard spec 추가 (POST /api/schedules/recent-deletion/:personId · buildRecentDeletionPath literal recent-deletion + :personId path-param + @Body RecentDeletionDto{instants,days?} + encodeURIComponent + falsy-personId 미발사 guard, 형제 api/schedules controller 판별)
phase: P6
status: DONE
completedAt: 2026-07-24T18:12:00Z
mergedAs: aeb941c9
prNumber: 1088
reviewRounds: 1
commitMode: pr
coversReq: [REQ-041, REQ-045]
estimatedDiff: 288
estimatedFiles: 1
created: 2026-07-25
independentStream: web-contract-guard
dependsOn: []
touchesFiles: [web/src/views/AdminView.recent-deletion-contract.test.ts]
plannerNote: "P6 contract-guard arc 다음 slice — 재평가 트리거(POST /api/schedules/recent-deletion/:personId, buildRecentDeletionPath). read GET slice(T-1195 users-list) 완결 후 mutation 측 미봉 endpoint. 핵심 축: literal recent-deletion + :personId path-param + POST + @Body{instants,days?} + falsy-personId 미발사 guard + 형제 api/schedules controller(cron/backfill) 판별. pr web test-only 1파일, AdminView.tsx 파일-disjoint."
---

# T-1196 — 재평가(최근 N일 delete→재수집) 트리거 endpoint web↔backend 계약 drift-guard spec 추가

## Why

T-1195 가 **사용자 목록 조회(GET /api/users)** 계약 drift-guard 로 read GET 표면의 최근 미봉 슬라이스를 채웠고, 그 직전 T-1190~T-1194 는 인원/파트/그룹/사용자 목록·멤버십·소속 GET 표면을 순차 봉합했다. read 측이 두터워진 지금, 아직 guard 가 없는 **mutation 표면** 중 하나가 **재평가 트리거(POST /api/schedules/recent-deletion/:personId)** 이며 — T-1195 Out of Scope 및 여러 mutation guard(role-change/member-add/remove/create/update/delete) 선례가 가리키는 다음 순차 slice 다. 본 task 는 그 mutation 발사와 backend 계약의 drift 를 test-only 로 고정한다. role-change/member-add 같은 mutation guard 패턴을 `api/schedules` 자원으로 mirror 한다.

AdminView 는 재평가 트리거 패널(`ReEvaluationTriggerPanel`)에서 선택 인원의 최근 N일 결과를 delete→재수집 발화한다. `handleReevalTrigger`(L3992~) 가 `runReEvaluate(selectedPersonId, days, { post: apiClient.request, ... })`(L1142~1177) 를 호출하고, 이 러너는 `deps.post(buildRecentDeletionPath(personId), { method: 'POST', headers: {...}, body: JSON.stringify({ instants: [], days }) })`(L1163~1167) 로 **명시적 POST** 를 발사한다. `buildRecentDeletionPath(personId)`(L1115~1117) 는 `${SCHEDULES_PATH}/recent-deletion/${encodeURIComponent(personId)}`(= `/api/schedules/recent-deletion/<enc>`) 를 만든다. 발사 전 `runReEvaluate` 는 **falsy personId(인원 미선택)이면 조기 return 해 미발사**(L1148~1150 — path param 누락·깨진 요청 방어)하고, `submitting`(이전 재평가 미완)이면 이중 POST 를 막는다. 이 POST 발사가 backend `RecentDeletionController.recentDeletion`(`@Post("recent-deletion/:personId")` on `@Controller("api/schedules")`, `@Param("personId")` + `@Body() RecentDeletionDto`, 202 Accepted) 계약과 drift 없이 일치함을 test-only 로 고정한다.

본 slice 의 판별 축은 read GET slice 들과 두 가지가 다르다: (1) **method = POST**(web 이 `method: 'POST'` 를 명시 — GET default 발사와 대조), (2) **@Body RecentDeletionDto 계약**(`instants` 필수 + `days` optional — web 이 `{ instants: [], days }` 를 실제로 보냄). 여기에 `api/schedules` prefix 를 공유하는 **형제 controller(CronScheduleController · BackfillController)의 다른 handler 를 recentDeletion 으로 오인하지 않는** 판별과, `recent-deletion` literal + `:personId` path-param 2세그먼트 합성, encodeURIComponent, falsy-personId 미발사 guard 를 함께 고정한다. (REQ-041 최근 N일 결과 manual delete/재수집 · REQ-045 Admin 전용, api.md schedules §, ADR-0038 reeval chain, ADR-0040/ADR-0041.)

## Required Reading

- `web/src/views/AdminView.role-change-contract.test.ts` — **직접 mirror 선례**(T-1171, mutation guard). 실 controller 소스 `readFileSync` 라이브 로드 + `stripComments`/`extractControllerRoute`/`extractHandlerMethods`(HTTP method + subPath 추출) + `extractDtoFields`(DTO required/optional 필드 추출) + `composeRoute`/`diffContract`/`stripQuery` 정규식 추출기·대조기·negative(a~g) 구조를 그대로 차용. 본 task 는 대상을 `user.controller.changeRole`(`PATCH /api/users/:id/role`)에서 `recent-deletion.controller.recentDeletion`(`POST /api/schedules/recent-deletion/:personId`)로 바꾸고, 발사기를 `runChangeRole`(fired role enum)에서 `runReEvaluate`(POST + body{instants,days}) 로 교체한 mirror. **method POST + @Body DTO 대조 + path-param 축**을 그대로 재적용하되, changeRole 의 enum ⊆ 단언 대신 본 slice 는 body 필드 계약(instants 필수 / days optional)을 대조한다.
- `web/src/views/AdminView.users-list-contract.test.ts` — 형제 read GET guard 직전 slice(T-1195). `readFileSync` 라이브 로드 + `?_r` query strip + 2-way handler 판별 방식의 최근 골격 선례. 본 task 는 그 골격을 mutation(POST + body)으로 mirror 하되 query strip 은 본 발사에 `?_r` 이 없으므로 base-only 정합으로 단순화한다.
- `web/src/views/AdminView.tsx` — `buildRecentDeletionPath(personId: string): string` (L1115~1117, `export` L4772) — `${SCHEDULES_PATH}/recent-deletion/${encodeURIComponent(personId)}`. `SCHEDULES_PATH = '/api/schedules'` (L344). 발사 러너 `runReEvaluate(personId, days, deps)` (L1142~1177): falsy `personId` → 조기 return(미발사, L1148~1150), `deps.submitting` → 미발사(L1152~1154), 아니면 `deps.post(buildRecentDeletionPath(personId), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instants: [], days }) })` (L1163~1167). call site: `handleReevalTrigger`(L3992~) → `runReEvaluate(selectedPersonId, days, { post: apiClient.request, ... })`. 발사 추출기 anchor 는 소문자 `buildRecentDeletionPath` 함수 본문 + `runReEvaluate` 안의 `method: 'POST'` / `body: JSON.stringify({ instants: [], days })` — 주석 속 문자열과 섞이지 않게 명시 anchor. (수정 0.)
- `web/src/api/apiClient.ts` — `apiClient.request(path, options)` — `runReEvaluate` 가 `deps.post` 로 주입받는 발사 primitive. `method: 'POST'` + JSON body 를 그대로 fetch 로 흘려보냄(GET default 와 대조). (수정 0 — read-only.)
- `src/scheduling/recent-deletion.controller.ts` — 대조 대상 backend. `@Controller("api/schedules")` (L65), `@Post("recent-deletion/:personId")` + `@HttpCode(202)` + 핸들러 `recentDeletion(@Param("personId") personId, @Body() dto: RecentDeletionDto)` (L96~111) — **`@Param("personId")` 1개 + `@Body() RecentDeletionDto`, 202 Accepted**. 같은 `api/schedules` prefix 를 공유하는 형제 controller(`CronScheduleController` · `BackfillController`)의 handler 는 base 오인 판별 대조군(**본 파일에는 없지만 base prefix 공유** — negative (e) 에서 base 만 같은 다른 route 로 오확장하지 않음 검증).
- `src/scheduling/dto/recent-deletion.dto.ts` — `RecentDeletionDto` — `instants`(ISO string[], 필수) + `days`(number, optional). web 이 `{ instants: [], days }` 로 보내는 body 계약의 source. required/optional 필드 대조 대상.

## Acceptance Criteria

신규 파일 `web/src/views/AdminView.recent-deletion-contract.test.ts` **1개만** 추가. 실 controller 소스(`recent-deletion.controller.ts`)·DTO 소스(`recent-deletion.dto.ts`)·AdminView 소스를 `readFileSync` 로 라이브 로드하고, `buildRecentDeletionPath` 를 import 해 실 경로를 계산한다(ADR-0040 §5 — RTL/jsdom 없음). 아래 R-112 4종 + negative 를 모두 cover.

- [ ] **happy-path (경로 정합)**: `buildRecentDeletionPath("p1")` 이 `/api/schedules/recent-deletion/p1` 를 반환하고, 이 path 가 backend `@Post("recent-deletion/:personId")` recentDeletion on `@Controller("api/schedules")` 의 route(`/api/schedules/recent-deletion/:personId`)와 path-param 위치까지 일치 (`diffContract` 가 `[]`).
- [ ] **happy-path (method 정합)**: web 재평가 발사 method 가 POST — AdminView 소스에서 `runReEvaluate` 안 `deps.post(...)` 호출이 `method: 'POST'` 를 명시함을 소스 대조로 검증하고, backend recentDeletion 핸들러가 `@Post`(GET/PATCH/DELETE 아님)임을 확인. 양측 method == POST. (read GET slice 와 대조되는 축 — GET default 아님.)
- [ ] **happy-path (body 필드 정합)**: web 이 보내는 body(`{ instants: [], days }`)의 키가 backend `RecentDeletionDto` 의 필드 집합과 정합 — `instants` 는 필수, `days` 는 optional. `extractDtoFields` 로 추출한 required/optional 집합에 web fired 키가 모두 포함되고, web 이 필수 필드(`instants`)를 누락하지 않음을 대조.
- [ ] **happy-path (인코딩)**: `buildRecentDeletionPath("a/b")` 이 personId 를 `encodeURIComponent` 로 인코딩(`a%2Fb`)해 세그먼트가 깨지지 않음(`/api/schedules/recent-deletion/a%2Fb`) — literal `recent-deletion` 세그먼트와 path-param 이 분리 유지.
- [ ] **error path (추출기 무력화 방어)**: `ROUTE`/`method`/handler/DTO 필드 추출이 하나도 비어있지 않음 검증. 빈 소스 입력 시 통과가 아니라 `'backend 계약 추출 실패'` 사유 1건 반환(대조가 통과하지 않음).
- [ ] **분기 — base + literal + path-param 세그먼트 파싱**: `@Controller("api/schedules")` + `@Post("recent-deletion/:personId")` 를 `/api/schedules/recent-deletion/:personId` 로 정규화 — base(`api/schedules`) + literal(`recent-deletion`) + path-param(`:personId`) 3요소 합성 정확.
- [ ] **분기 — path-param 위치**: `:personId` 가 literal `recent-deletion` 뒤(마지막 세그먼트)에 있음을 검증 — web 발사도 동일 위치에 인코딩된 personId 를 놓음.
- [ ] **분기 — 핸들러 인자**: `recentDeletion` 핸들러가 `@Param("personId")` + `@Body() RecentDeletionDto` 를 가짐(`hasParam === true`·`hasBody === true`) — mutation 은 path-param + body 계약 둘 다 존재(read GET 의 body 부재와 대조).
- [ ] **분기 — falsy-personId 미발사 guard**: `runReEvaluate` 가 `if (!personId) return;` 조기 return 으로 발사를 억제함을 소스 대조로 검증 — 깨진 `/api/schedules/recent-deletion/`(빈 personId) POST 가 나지 않음을 입증. personId 가 truthy 일 때만 실 path 로 대조(선택 vs 미선택 두 분기 — read slice 의 null idle 축 대응).
- [ ] **negative (a) base 오타**: backend base 를 `api/schedule`(단수) / `api/schedules-x` 로 바꾸면 path 불일치로 잡힘.
- [ ] **negative (b) method drift**: recentDeletion 핸들러가 `@Get("recent-deletion/:personId")`/`@Patch(...)`/`@Delete(...)` 로 바뀌면 method 불일치로 잡힘(web 은 POST 발사) — read GET 으로 오인되지 않음.
- [ ] **negative (c) literal 세그먼트 오타**: recentDeletion 이 `@Post("recent-delete/:personId")`(literal 오타) / `@Post("reeval/:personId")`(다른 literal) 로 drift 시 web 발사(`recent-deletion`)와 literal 불일치로 잡힘.
- [ ] **negative (d) path-param 축소/추가 drift**: recentDeletion 이 `@Post("recent-deletion")`(path-param 소실) / `@Post("recent-deletion/:personId/instants")`(세그먼트 추가) 로 drift 시 path 불일치. web 발사(literal + `:personId` 1개)와 세그먼트 불일치로 잡힘.
- [ ] **negative (e) 형제 api/schedules controller 혼동**: `api/schedules` prefix 를 공유하는 형제 handler(예: backfill/cron controller 의 다른 subPath) 를 recentDeletion 으로 오인하지 않음 — 추출기가 `recent-deletion.controller.ts` 소스의 `@Post("recent-deletion/:personId")` recentDeletion 을 정확히 선택하고, base 만 같은 다른 route(`recent-deletion` literal 없는)로 오확장하지 않음.
- [ ] **negative (f) body 필드 drift**: backend `RecentDeletionDto` 에서 `instants` 필수 필드가 사라지거나(web 은 여전히 `instants` 를 보냄) web 이 필수 필드를 누락하도록 조작하면 body 필드 대조가 불일치로 잡힘 — required 필드 집합 정합이 회귀로 검출됨.
- [ ] **negative (g) 주석 false-positive**: 주석 줄의 `@Post("recent-deletion/:personId")`/`@Controller(...)`/`POST /api/schedules/recent-deletion/:personId` 문자열(본 소스 상단·endpoint 주석에 다수 존재)을 실 decorator 로 오인하지 않음(`stripComments` 방어).
- [ ] `pnpm --dir web test`(또는 web workspace vitest) 실측 통과 확인 — 위 모든 케이스 green. base/method/literal/path-param/body 변조 → fail → revert 로 guard 유효성 실증.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only 파일이라 커버리지 회귀 없음 확인.
- [ ] size gate: diff ≤ 300 LOC, 변경 파일 정확히 1개.

## Out of Scope

- production 코드(`AdminView.tsx`, `apiClient.ts`, `recent-deletion.controller.ts`, `recent-deletion.dto.ts`, `RecentDeletionRunnerService`) 및 기존 guard 파일 수정 **금지** — 신규 test 파일 1개만 추가.
- 신규 devDependency 추가 금지(정규식 추출기만 — 기존 vitest 사용).
- backend runner/service(`RecentDeletionRunnerService.runRecentDeletion`)의 도메인 로직(delete→재수집 산술·boundary·instants 도출) 대조는 본 task 범위 아님 — 본 task 는 **HTTP 계약(route/method/path-param/body 필드)** 표면만 web↔backend 대조.
- 선택 인원의 최근 N일 실제 instant 자동 도출(별도 GET) · 202 응답 body(deletedCount/recollected) 소비 계약 guard 는 본 task 범위 아님 — 후속 slice(web 이 아직 응답 body 를 소비하지 않음, L1161~1162).
- export GET(`buildExportPath`, `/api/admin/export`) 계약 guard 는 본 task 범위 아님 — bare-base 가 backend `@Post()` create 와 method 대조 이슈가 있어 별도 확인 후 slice(Follow-up).
- backfill/cron(`CronScheduleController`/`BackfillController`) endpoint 계약 guard 는 본 task 범위 아님 — 본 task 에서는 형제 base-혼동 negative(e) 대조군으로만 참조.
- **shared-helper 추출 refactor 는 여전히 Out of Scope** — `stripComments`/`extractControllerRoute`/`extractHandlerMethods`/`extractDtoFields`/`composeRoute`/`diffContract`/`stripQuery` 등이 27+ contract-guard test 파일에 중복됐지만, 공용 helper 추출은 별도 refactor slice(아래 Follow-up 유지 — 다수 파일 접촉 5-파일 cap 초과라 planner split 필요).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (carry-forward) contract-guard test 27+ 파일이 공유하는 정규식 추출기/대조기(`stripComments`, `extractControllerRoute`, `extractHandlerMethods`, `extractDtoFields`, `composeRoute`, `diffContract`, `stripQuery`)를 `web/src/views/__contract-guard__/` 공용 helper 로 추출하는 refactor slice — 중복 제거 + 단일 유지보수 지점. read+mutation 표면이 두터워진 시점이라 추출 ROI 재평가 적기. helper 추출 자체가 다수 파일을 건드려 5-파일 cap 초과 → planner split 필요.
- (후보) export GET(`buildExportPath`, GET /api/admin/export?scope=) 계약 guard — 단 web 이 GET 을 발사하는데 backend bare-base 는 `@Post()` create 라 method 대조 이슈 선확인 필요. 확인 후 slice.
- (후보) 재평가 트리거 202 응답 body(deletedCount/recollected) 소비 계약 guard — web 이 응답 body 를 소비하도록 확장되면 응답 shape 대조 축을 발사 대상으로 승격.
