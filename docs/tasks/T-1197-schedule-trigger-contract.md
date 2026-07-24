---
id: T-1197
title: 수동 재평가 즉시 실행(manual trigger) endpoint web↔backend 계약 drift-guard spec 추가 (POST /api/schedules/trigger · SCHEDULE_TRIGGER_PATH literal trigger + method POST + body 없음(fire-and-forget 202) + busy 이중발사 guard + 형제 api/schedules controller(list/upsert/remove/recent-deletion/backfill) 판별)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-040, REQ-045]
estimatedDiff: 250
estimatedFiles: 1
created: 2026-07-25
independentStream: web-contract-guard
dependsOn: []
touchesFiles: [web/src/views/AdminView.schedule-trigger-contract.test.ts]
plannerNote: "P6 contract-guard arc 다음 slice — 수동 즉시 재평가(POST /api/schedules/trigger, SCHEDULE_TRIGGER_PATH). T-1196 recent-deletion 형제 api/schedules 자원의 body·param 없는 202 mutation. 핵심 축: literal trigger + method POST + body 부재 + busy 이중발사 guard + 형제 controller(@Get list/@Put upsert/@Delete remove/recent-deletion/backfill) 판별. pr web test-only 1파일, AdminView.tsx 파일-disjoint."
---

# T-1197 — 수동 재평가 즉시 실행(manual trigger) endpoint web↔backend 계약 drift-guard spec 추가

## Why

T-1196 이 **재평가 트리거(POST /api/schedules/recent-deletion/:personId)** 계약 drift-guard 로 `api/schedules` 자원의 첫 mutation 슬라이스를 봉합했고, 그 negative(e) 대조군으로 같은 base 를 공유하는 형제 controller(cron/backfill)를 이미 참조했다. 그 형제 중 아직 guard 가 없는 가장 단순한 mutation 이 **수동 즉시 재평가(POST /api/schedules/trigger)** 다 — Admin 이 cron 주기와 무관하게 즉시 1회 평가를 발화하는 fire-and-forget 202 endpoint. 본 task 는 그 발사와 backend 계약의 drift 를 test-only 로 고정한다. recent-deletion 의 POST mutation 패턴을 mirror 하되, **path-param·body 가 없는 body-less 202** 라는 최소 mutation 축으로 단순화한다.

AdminView 는 SchedulePanel 의 manual trigger 컨트롤에서 즉시 재평가를 발화한다. `handleTrigger`(L3939~) 가 `runTrigger({ request: apiClient.request, busy, ... })`(L1067~) 를 호출하고, 이 러너는 `deps.request(SCHEDULE_TRIGGER_PATH, { method: 'POST' })`(L1078) 로 **body 없는 명시적 POST** 를 발사한다. `SCHEDULE_TRIGGER_PATH = '/api/schedules/trigger'`(L347)는 build*Path 빌더 없는 고정 상수다. 발사 전 `runTrigger` 는 `deps.busy`(이전 apply/trigger 미완)이면 조기 return 해 **이중 POST·state 경합을 차단**(L1069~1071)한다. 이 POST 발사가 backend `CronScheduleController.trigger`(`@Post("trigger")` + `@HttpCode(202)` on `@Controller("api/schedules")`, `@Param`·`@Body` 없음, fire-and-forget 202 Accepted) 계약과 drift 없이 일치함을 test-only 로 고정한다.

본 slice 의 판별 축은 recent-deletion(T-1196)과 세 가지가 다르다: (1) **path-param 없음**(literal `trigger` 단일 세그먼트 — `:personId` 없음), (2) **body 없음**(fire-and-forget — recent-deletion 의 `@Body RecentDeletionDto` 대조 축 부재), (3) **guard 축이 busy 이중발사 방지**(recent-deletion 의 falsy-personId 미발사 대신). 여기에 `api/schedules` prefix 를 공유하는 **형제 handler(@Get() list · @Put() upsert · @Delete(":name") remove · recent-deletion.controller 의 @Post("recent-deletion/:personId") · backfill.controller 의 @Post("backfill/:personId"))를 trigger 로 오인하지 않는** 판별을 함께 고정한다. (REQ-040 수동 즉시 재평가(R-73) · REQ-045 Admin 전용, api.md schedules §, ADR-0042 §Decision 2.)

## Required Reading

- `web/src/views/AdminView.recent-deletion-contract.test.ts` — **직접 mirror 선례**(T-1196, 같은 `api/schedules` base 의 POST mutation guard). 실 controller 소스 `readFileSync` 라이브 로드 + `stripComments`/`extractControllerRoute`/`extractHandlerMethods`(HTTP method + subPath 추출) + `composeRoute`/`diffContract`/`stripQuery` 정규식 추출기·대조기·negative(a~g) 구조를 그대로 차용. 본 task 는 대상을 `recent-deletion.controller.recentDeletion`(`POST /api/schedules/recent-deletion/:personId`)에서 `cron-schedule.controller.trigger`(`POST /api/schedules/trigger`)로 바꾸고, 발사기를 `runReEvaluate`(POST + path-param + body)에서 `runTrigger`(body·param 없는 POST) 로 교체한 mirror. **method POST + literal 세그먼트 축은 그대로 재적용하되, path-param 및 @Body DTO 대조 축은 본 slice 에서 제거**(trigger 는 param·body 없음)하고, guard 축을 falsy-personId 미발사에서 busy 이중발사 방지로 교체한다.
- `web/src/views/AdminView.role-change-contract.test.ts` — mutation guard 정규식 추출기(`extractHandlerMethods` 의 HTTP method + subPath 추출) 골격 참조 선례. 본 task 는 그 method 추출을 body·param 없는 POST 로 단순화 재적용.
- `web/src/views/AdminView.tsx` — `SCHEDULE_TRIGGER_PATH = '/api/schedules/trigger'` (L347, `export` 대상 여부 확인 — 없으면 소스 문자열 대조로 상수값 검증). 발사 러너 `runTrigger(deps)` (L1067~1085): `deps.busy` → 조기 return(미발사, L1069~1071), 아니면 `deps.request(SCHEDULE_TRIGGER_PATH, { method: 'POST' })` (L1078, body 없음). call site: `handleTrigger`(L3939~) → `runTrigger({ request: apiClient.request, busy, ... })`. 발사 추출기 anchor 는 `runTrigger` 본문 안의 `SCHEDULE_TRIGGER_PATH` + `method: 'POST'` — 주석 속 문자열과 섞이지 않게 명시 anchor. (수정 0.)
- `web/src/api/apiClient.ts` — `apiClient.request(path, options)` — `runTrigger` 가 `deps.request` 로 주입받는 발사 primitive. `method: 'POST'` 를 그대로 fetch 로 흘려보냄(body 없음). (수정 0 — read-only.)
- `src/scheduling/cron-schedule.controller.ts` — 대조 대상 backend. `@Controller("api/schedules")` (L70), `@Post("trigger")` + `@HttpCode(202)` + 핸들러 `trigger(): Promise<void>` (L140~145) — **`@Param`·`@Body` 없음, 202 Accepted fire-and-forget**. 같은 파일의 형제 handler `@Get()` list(L90) · `@Put()` upsert(L103, @Body) · `@Delete(":name")` remove(L118, @Param) 는 base 오인·method drift 판별 대조군.
- `src/scheduling/recent-deletion.controller.ts` · `src/scheduling/backfill.controller.ts` — 같은 `@Controller("api/schedules")` prefix 를 공유하는 **별도 파일 형제 controller**(`@Post("recent-deletion/:personId")` · `@Post("backfill/:personId")`). negative(e) 형제 base-혼동 대조군 — 추출기가 `cron-schedule.controller.ts` 의 `@Post("trigger")` 를 정확히 선택하고 base 만 같은 다른 POST route 로 오확장하지 않음 검증.

## Acceptance Criteria

신규 파일 `web/src/views/AdminView.schedule-trigger-contract.test.ts` **1개만** 추가. 실 controller 소스(`cron-schedule.controller.ts`)·AdminView 소스를 `readFileSync` 로 라이브 로드하고, `SCHEDULE_TRIGGER_PATH` 값(상수 export 시 import, 아니면 소스 대조로 확정)으로 실 경로를 계산한다(ADR-0040 §5 — RTL/jsdom 없음). 아래 R-112 4종 + negative 를 모두 cover.

- [ ] **happy-path (경로 정합)**: web 발사 경로 `/api/schedules/trigger` 가 backend `@Post("trigger")` trigger on `@Controller("api/schedules")` 의 route(`/api/schedules/trigger`)와 세그먼트까지 일치 (`diffContract` 가 `[]`). base(`api/schedules`) + literal(`trigger`) 2세그먼트 합성 정확.
- [ ] **happy-path (method 정합)**: web 발사 method 가 POST — AdminView 소스에서 `runTrigger` 안 `deps.request(SCHEDULE_TRIGGER_PATH, ...)` 호출이 `method: 'POST'` 를 명시함을 소스 대조로 검증하고, backend trigger 핸들러가 `@Post`(GET/PUT/DELETE 아님)임을 확인. 양측 method == POST.
- [ ] **happy-path (body 부재 정합)**: web 발사 options 에 `body` 키가 없음(fire-and-forget)을 소스 대조로 검증하고, backend trigger 핸들러가 `@Body` 파라미터를 갖지 않음(`hasBody === false`)을 확인. 양측 모두 body 없음 — mutation 이지만 payload 없는 발사임을 고정.
- [ ] **happy-path (path-param 부재 정합)**: backend trigger 핸들러가 `@Param` 을 갖지 않고(`hasParam === false`) route 에 `:` 동적 세그먼트가 없음을 확인. web 발사도 고정 상수 path(치환 세그먼트 없음)를 씀 — recent-deletion 의 path-param 축과 대조되는 무-param 정합.
- [ ] **error path (추출기 무력화 방어)**: `ROUTE`/`method`/handler 추출이 하나도 비어있지 않음 검증. 빈 소스 입력 시 통과가 아니라 `'backend 계약 추출 실패'` 사유 1건 반환(대조가 통과하지 않음).
- [ ] **분기 — base + literal 세그먼트 파싱**: `@Controller("api/schedules")` + `@Post("trigger")` 를 `/api/schedules/trigger` 로 정규화 — base(`api/schedules`) + literal(`trigger`) 2요소 합성 정확.
- [ ] **분기 — busy 이중발사 미발사 guard**: `runTrigger` 가 `if (deps.busy) return;` 조기 return 으로 발사를 억제함을 소스 대조로 검증 — 이전 apply/trigger 미완 중 이중 POST 가 나지 않음을 입증. busy=false 일 때만 실 path 로 대조(발사 vs 미발사 두 분기 — recent-deletion 의 falsy-personId 축 대응).
- [ ] **분기 — 핸들러 인자 부재**: trigger 핸들러가 `@Param`·`@Body` 를 둘 다 갖지 않음(`hasParam === false`·`hasBody === false`) — recent-deletion(param+body 둘 다 존재)·upsert(@Body 존재)·remove(@Param 존재)와 대조되는 무-인자 handler 임을 고정.
- [ ] **negative (a) base 오타**: backend base 를 `api/schedule`(단수) / `api/schedules-x` 로 바꾸면 path 불일치로 잡힘.
- [ ] **negative (b) method drift**: trigger 핸들러가 `@Get("trigger")`/`@Put("trigger")`/`@Delete("trigger")` 로 바뀌면 method 불일치로 잡힘(web 은 POST 발사).
- [ ] **negative (c) literal 세그먼트 오타**: trigger 가 `@Post("triggr")`(literal 오타) / `@Post("run")`(다른 literal) 로 drift 시 web 발사(`trigger`)와 literal 불일치로 잡힘.
- [ ] **negative (d) 세그먼트 추가/축소 drift**: trigger 가 `@Post()`(literal 소실 — bare base) / `@Post("trigger/:id")`(path-param 추가) 로 drift 시 path 불일치. web 발사(literal `trigger` 단일 세그먼트, param 없음)와 세그먼트 불일치로 잡힘.
- [ ] **negative (e) 형제 api/schedules controller 혼동**: 같은 `api/schedules` prefix 를 공유하는 형제 handler(같은 파일 `@Get()` list / `@Put()` upsert / `@Delete(":name")` remove, 및 별도 파일 `@Post("recent-deletion/:personId")` / `@Post("backfill/:personId")`)를 trigger 로 오인하지 않음 — 추출기가 `cron-schedule.controller.ts` 의 `@Post("trigger")` trigger 를 정확히 선택하고, base 만 같은 다른 route 로 오확장하지 않음. 특히 형제 POST(recent-deletion/backfill)와 method 는 같지만 literal 세그먼트가 다름을 판별.
- [ ] **negative (f) body/param drift 오인 방지**: trigger 핸들러에 `@Body dto` 또는 `@Param("x")` 가 추가되도록 조작하면 web 발사(body·param 없음)와 인자 계약 불일치가 회귀로 검출됨 — 무-인자 fire-and-forget 계약이 고정됨.
- [ ] **negative (g) 주석 false-positive**: 주석 줄의 `@Post("trigger")`/`@Controller(...)`/`POST /api/schedules/trigger` 문자열(본 소스 상단·endpoint 주석에 다수 존재)을 실 decorator 로 오인하지 않음(`stripComments` 방어).
- [ ] `pnpm --dir web test`(또는 web workspace vitest) 실측 통과 확인 — 위 모든 케이스 green. base/method/literal/세그먼트/인자 변조 → fail → revert 로 guard 유효성 실증.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only 파일이라 커버리지 회귀 없음 확인.
- [ ] size gate: diff ≤ 300 LOC, 변경 파일 정확히 1개.

## Out of Scope

- production 코드(`AdminView.tsx`, `apiClient.ts`, `cron-schedule.controller.ts`) 및 기존 guard 파일 수정 **금지** — 신규 test 파일 1개만 추가.
- 신규 devDependency 추가 금지(정규식 추출기만 — 기존 vitest 사용).
- backend trigger 의 도메인 로직(주입 `tickHandler` 실행·cron tick 수렴·평가 발화 산술) 대조는 본 task 범위 아님 — 본 task 는 **HTTP 계약(route/method/세그먼트/인자 부재)** 표면만 web↔backend 대조.
- `PUT /api/schedules`(runApply, cron 등록/교체 upsert) 계약 guard 는 본 task 범위 아님 — 형제 mutation 이지만 `@Put()` + `@Body UpsertCronScheduleDto` 라 별도 slice(Follow-up). 본 task 에서는 형제 base-혼동 negative(e) 대조군으로만 참조.
- `GET /api/schedules`(schedule list read) · `DELETE /api/schedules/:name`(remove) 계약 guard 는 본 task 범위 아님 — 각 별도 read/mutation slice(Follow-up).
- import(`POST /api/admin/import`) · export(`GET /api/admin/export`) endpoint 계약 guard 는 본 task 범위 아님 — 각각 web 발사(multipart / GET)와 backend 계약(JSON CreateImportDto / job-based POST) 간 **알려진 drift 가 있어 사전 확인 필요**(T-1196 Follow-up), 확인 후 별도 slice.
- **shared-helper 추출 refactor 는 여전히 Out of Scope** — `stripComments`/`extractControllerRoute`/`extractHandlerMethods`/`composeRoute`/`diffContract`/`stripQuery` 등이 28+ contract-guard test 파일에 중복됐지만, 공용 helper 추출은 별도 refactor slice(아래 Follow-up 유지 — 다수 파일 접촉 5-파일 cap 초과라 planner split 필요).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (carry-forward) contract-guard test 28+ 파일이 공유하는 정규식 추출기/대조기(`stripComments`, `extractControllerRoute`, `extractHandlerMethods`, `extractDtoFields`, `composeRoute`, `diffContract`, `stripQuery`)를 `web/src/views/__contract-guard__/` 공용 helper 로 추출하는 refactor slice — 중복 제거 + 단일 유지보수 지점. read+mutation 표면이 두터워진 시점이라 추출 ROI 재평가 적기. helper 추출 자체가 다수 파일을 건드려 5-파일 cap 초과 → planner split 필요.
- (후보) `PUT /api/schedules`(runApply, cron upsert) 계약 guard — `@Put()` + `@Body UpsertCronScheduleDto{name,cronExpression}` 대조. web `runApply` 의 JSON body 발사와 정합. 형제 api/schedules mutation 의 다음 slice.
- (후보) `DELETE /api/schedules/:name`(remove) 계약 guard — 단 web 이 해당 DELETE 를 발사하는지 발사기 존재 선확인 필요(현재 AdminView 에 remove 발사 UI 미확인). 확인 후 slice.
- (후보) import(`POST /api/admin/import`) 계약 guard — web `runImport` 는 multipart FormData(file) 를 발사하나 backend `ImportController.create` 는 JSON `CreateImportDto{mode}` body 만 받음(multipart 미수신). **실 drift 가능성** — guard 신설이 drift 를 fail 로 노출할 수 있어 도메인 확인 후 slice(단순 mirror 부적합).
- (후보) export(`GET /api/admin/export`) 계약 guard — web `runExport` 는 GET 파일 다운로드를 기대하나 backend `ExportController` 는 job-based(`@Post()` createJob · `@Get(":id")` findJob) — bare-base method 대조 이슈. 도메인 확인 후 slice.
