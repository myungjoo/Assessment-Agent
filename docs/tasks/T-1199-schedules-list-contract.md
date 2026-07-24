---
id: T-1199
title: 스케줄 목록 조회(GET /api/schedules) endpoint web↔backend 계약 drift-guard spec 추가 (SCHEDULES_PATH bare-base + method GET + 무-body/무-param + @Get() list vs @Put() upsert 형제 method 판별 + 형제 api/schedules controller(remove/trigger/recent-deletion/backfill) 판별)
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-039, REQ-045]
estimatedDiff: 250
estimatedFiles: 1
created: 2026-07-25
independentStream: web-contract-guard
dependsOn: []
touchesFiles: [web/src/views/AdminView.schedules-list-contract.test.ts]
plannerNote: "P6 contract-guard arc 다음 slice — 스케줄 목록 조회(GET /api/schedules, SCHEDULES_PATH). T-1198 upsert 형제 controller 의 read-side. 핵심 축: bare-base + method GET + 무-body·무-param + @Get() list vs @Put() upsert 같은 base method 판별 + 형제 controller(@Delete remove/@Post trigger/recent-deletion/backfill) 판별. pr web test-only 1파일, AdminView.tsx 파일-disjoint."
---

# T-1199 — 스케줄 목록 조회(GET /api/schedules) endpoint web↔backend 계약 drift-guard spec 추가

## Why

T-1198 이 **스케줄 주기 등록/교체(PUT /api/schedules)** 계약 drift-guard 로 `api/schedules` 자원의 body-보유 mutation 을 봉합했고, 그 negative(e) 대조군으로 같은 `cron-schedule.controller.ts` 파일의 형제 handler(@Get() list · @Delete(":name") remove · @Post("trigger") trigger)를 참조했다. T-1198 Follow-up 이 명시적으로 예약한 다음 slice 가 바로 이 형제 중 유일한 **read-side handler — 스케줄 목록 조회(GET /api/schedules)** 다. Admin 이 등록된 cron job 이름 목록을 조회하는 무-body·무-param 200 read. 본 task 는 그 조회 발사와 backend 계약의 drift 를 test-only 로 고정한다. T-1195(users-list) 등 GET-side guard 를 mirror 하되, **같은 base(`api/schedules`) 위 method 만 다른 형제(@Get() list vs @Put() upsert)** 판별을 핵심 축으로 세운다.

AdminView 는 SchedulePanel 의 목록 표면에서 스케줄 조회를 발화한다. 컨테이너가 `useApiResource<string[]>(SCHEDULES_PATH)`(L3535~3539, useApiResource 다섯 번째 호출)로 GET 을 발사하고 응답 `string[]`(등록 schedule name 목록)·loading·error 를 message/error props 로 패널에 내려보낸다(Decision 1 — 패널은 fetch 를 모른다). `SCHEDULES_PATH = '/api/schedules'`(L344)는 build*Path 빌더 없는 고정 base 상수(bare base — subPath 없음). useApiResource 는 default GET(method 미명시 → GET)이며 body·path-param 이 없다. 이 GET 발사가 backend `CronScheduleController.list`(`@Get()`(bare, subPath 없음) on `@Controller("api/schedules")`, 인자 0, 반환 `string[]`) 계약과 drift 없이 일치함을 test-only 로 고정한다.

본 slice 의 판별 축은 upsert(T-1198)와 세 가지가 다르다: (1) **method GET**(upsert 의 PUT 대신), (2) **무-body**(upsert 의 @Body UpsertCronScheduleDto 대조 — GET list 는 인자 0), (3) **read-only**(mutation 아님). 핵심은 **같은 base `api/schedules` 위에서 method 만 다른 형제(@Get() list vs @Put() upsert)** 를 method 로 정확히 판별하는 것 — 세그먼트가 아니라 method 축으로 구분되는 첫 read-vs-mutation 대조다. 여기에 `api/schedules` prefix 를 공유하는 **형제 handler(같은 파일 @Put() upsert · @Delete(":name") remove · @Post("trigger") trigger, 별도 파일 @Post("recent-deletion/:personId") · @Post("backfill/:personId"))를 list 로 오인하지 않는** 판별을 함께 고정한다. (REQ-039 스케줄 목록 조회(R-72) · REQ-045 Admin 전용, api.md schedules §, ADR-0042 §Decision 2.)

## Required Reading

- `web/src/views/AdminView.schedule-apply-contract.test.ts` — **직접 mirror 선례**(T-1198, 같은 `cron-schedule.controller.ts` 형제 handler 의 guard). 실 controller 소스 `readFileSync` 라이브 로드 + `stripComments`/`extractControllerRoute`/`extractHandlerMethods`(HTTP method + subPath 추출) + `extractHandlerParams`(균형 괄호 매칭으로 handler 서명 슬라이스 → @Body/@Param 판정) + `composeRoute`/`diffContract`/negative(a~g) 구조를 그대로 차용. 본 task 는 대상을 `cron-schedule.controller.upsert`(`@Put()` bare, `@Body`)에서 `cron-schedule.controller.list`(`@Get()` bare, 인자 0)로 바꾸고, 발사기를 `runApply`(JSON body PUT) 에서 `useApiResource<string[]>(SCHEDULES_PATH)`(default GET, body·param 없음) 로 교체한 mirror. **method 축을 PUT→GET 로, @Body 대조 축을 hasBody === false 로 되돌린다.**
- `web/src/views/AdminView.users-list-contract.test.ts` — **GET-side read 발사기 대조 선례**(T-1195). `useApiResource<...>(PATH)` 발사(default GET, 무-body·무-param) 를 소스에서 anchor 로 슬라이스하는 방식 + `?_r` nonce 무해 축을 차용. 본 task 는 그 GET-발사 추출을 `useApiResource<string[]>(SCHEDULES_PATH)` 로 재적용한다. 단 users 는 2-way GET(@Get() list vs @Get(":id") detail) 세그먼트 판별인 반면, 본 task 는 **같은 base method 판별(@Get() list vs @Put() upsert)** 이 핵심 축이라는 점만 다름.
- `web/src/views/AdminView.tsx` — `SCHEDULES_PATH = '/api/schedules'` (L344, `export` 대상 여부 확인 — 없으면 소스 문자열 대조로 상수값 검증). 조회 발사 `useApiResource<string[]>(SCHEDULES_PATH)` (L3535~3539). 발사 추출기 anchor 는 이 `useApiResource` 호출의 인자(`SCHEDULES_PATH`) + 제네릭(`string[]`) — 주석 속 `GET /api/schedules` 문자열(L340·L4286 등 다수)과 섞이지 않게 `useApiResource<string[]>(SCHEDULES_PATH)` 명시 anchor 로 슬라이스. (수정 0 — read-only.)
- `web/src/hooks/useApiResource.ts`(또는 정의 파일) — `useApiResource(path)` 가 default GET 을 발사함을 확인(method 미명시 → GET, body·path-param 없음). (read-only — GET 발사 default 확인용.)
- `src/scheduling/cron-schedule.controller.ts` — 대조 대상 backend. `@Controller("api/schedules")` (L70), `@Get()` (bare, subPath 없음) + 핸들러 `list(): string[]` (L90~95) — **인자 0(hasBody === false, hasParam === false)**. 같은 파일의 형제 handler `@Put()` upsert(L103, @Body) · `@Delete(":name")` remove(L120, @Param) · `@Post("trigger")` trigger(L140) 는 method drift·세그먼트 판별 대조군.
- `src/scheduling/recent-deletion.controller.ts` · `src/scheduling/backfill.controller.ts` — 같은 `@Controller("api/schedules")` prefix 를 공유하는 **별도 파일 형제 controller**(`@Post("recent-deletion/:personId")` · `@Post("backfill/:personId")`). negative(e) 형제 base-혼동 대조군 — 추출기가 `cron-schedule.controller.ts` 의 `@Get()` list 를 정확히 선택하고 base 만 같은 다른 route 로 오확장하지 않음 검증.

## Acceptance Criteria

신규 파일 `web/src/views/AdminView.schedules-list-contract.test.ts` **1개만** 추가. 실 controller 소스(`cron-schedule.controller.ts`)·AdminView 소스를 `readFileSync` 로 라이브 로드하고, `SCHEDULES_PATH` 값(상수 export 시 import, 아니면 소스 대조로 확정)으로 실 경로를 계산한다(ADR-0040 §5 — RTL/jsdom 없음). 아래 R-112 4종 + negative 를 모두 cover.

- [ ] **happy-path (경로 정합)**: web 조회 경로 `/api/schedules` 가 backend `@Get()` list on `@Controller("api/schedules")` 의 route(`/api/schedules` — subPath 없음, bare base)와 세그먼트까지 일치 (`diffContract` 가 `[]`). base(`api/schedules`) 단일 세그먼트 합성(literal 없음) 정확.
- [ ] **happy-path (method 정합)**: web 발사 method 가 GET — AdminView 소스에서 `useApiResource<string[]>(SCHEDULES_PATH)` 가 default GET(method 미명시)임을 확인하고, backend list 핸들러가 `@Get`(PUT/POST/DELETE 아님)임을 확인. 양측 method == GET.
- [ ] **happy-path (무-body·무-param 정합)**: backend list 핸들러가 `@Body`·`@Param` 을 갖지 않음(`hasBody === false` && `hasParam === false`)을 확인. web 조회도 body·path-param 없는 고정 base 상수 path 를 씀 — upsert(@Body 보유)·remove(@Param 보유)·recent-deletion(param+body 보유)와 대조되는 인자-0 read handler.
- [ ] **error path (추출기 무력화 방어)**: `ROUTE`/`method`/handler 추출이 하나도 비어있지 않음 검증. 빈 소스 입력 시 통과가 아니라 `'backend 계약 추출 실패'` 사유 1건 반환(대조가 통과하지 않음). `extractHandlerParams('', 'list')`·`extractHandlerMethods('')`·`extractControllerRoute('')` 가 빈 값(null/{}) 반환 확인.
- [ ] **분기 — bare base 세그먼트 파싱**: `@Controller("api/schedules")` + `@Get()`(subPath 빈 문자열)를 `/api/schedules` 로 정규화 — base 단일 세그먼트(literal subPath 없음)임을 확인. trigger 의 2세그먼트 합성과 대조.
- [ ] **분기 — 같은 base method 판별(핵심 축)**: 같은 `@Controller("api/schedules")` base 위 형제 `@Get()` list 와 `@Put()` upsert 를 **method 로 구분** — 추출기가 GET 발사를 `list`(GET) 핸들러에 매칭하고 `upsert`(PUT) 로 오매칭하지 않음. 세그먼트가 아니라 method 축으로 갈리는 read-vs-mutation 판별.
- [ ] **분기 — 핸들러 인자 판별**: list 핸들러가 `@Body`·`@Param` 을 둘 다 갖지 않음(`hasBody === false` && `hasParam === false`) — upsert(@Body)·remove(@Param)·recent-deletion(param+body)와 대조되는 인자-0 handler 임을 고정.
- [ ] **negative (a) base 오타**: backend base 를 `api/schedule`(단수) / `api/schedules-x` 로 바꾸면 path 불일치로 잡힘.
- [ ] **negative (b) method drift**: list 핸들러가 `@Put()`/`@Post()`/`@Delete()` 로 바뀌면 method 불일치로 잡힘(web 은 GET 발사). 특히 같은 base 형제 `@Put()` upsert 로의 method drift 를 검출.
- [ ] **negative (c) 세그먼트 추가 drift**: list 가 `@Get("list")`(literal 추가) / `@Get(":name")`(path-param 추가) 로 drift 시 web 발사(bare base `/api/schedules`)와 세그먼트 불일치로 잡힘.
- [ ] **negative (d) 인자 추가 오인 방지**: list 핸들러에 `@Param`/`@Body` 를 추가하도록 조작하면 web 조회(무-body·무-param)와 인자 계약 불일치가 회귀로 검출됨 — 인자-0 read 계약이 고정됨(mutation 으로 오변질 방지).
- [ ] **negative (e) 형제 api/schedules controller 혼동**: 같은 `api/schedules` prefix 를 공유하는 형제 handler(같은 파일 `@Put()` upsert / `@Delete(":name")` remove / `@Post("trigger")` trigger, 및 별도 파일 `@Post("recent-deletion/:personId")` / `@Post("backfill/:personId")`)를 list 로 오인하지 않음 — 추출기가 `cron-schedule.controller.ts` 의 `@Get()` list 를 정확히 선택하고, base 만 같은 다른 route 로 오확장하지 않음.
- [ ] **negative (f) `?_r` nonce 무해**: web 조회 path 에 cache-bust query(`?_r=<n>`)가 붙어도 route 대조가 base path 기준으로 통과함(query strip 후 대조) — useApiResource 재조회 nonce 가 계약 대조를 깨지 않음을 고정.
- [ ] **negative (g) 주석 false-positive**: 주석 줄의 `@Get(...)`/`@Controller(...)`/`GET /api/schedules` 문자열(본 소스 상단·endpoint 주석에 다수 존재)을 실 decorator 로 오인하지 않음(`stripComments` 방어).
- [ ] `pnpm --dir web test`(또는 web workspace vitest) 실측 통과 확인 — 위 모든 케이스 green. base/method/세그먼트/인자 변조 → fail → revert 로 guard 유효성 실증.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only 파일이라 커버리지 회귀 없음 확인.
- [ ] size gate: diff ≤ 300 LOC, 변경 파일 정확히 1개.

## Out of Scope

- production 코드(`AdminView.tsx`, `useApiResource.ts`, `cron-schedule.controller.ts`) 및 기존 guard 파일 수정 **금지** — 신규 test 파일 1개만 추가.
- 신규 devDependency 추가 금지(정규식 추출기만 — 기존 vitest 사용).
- backend list 의 도메인 로직(SchedulerRegistry 조회·등록 job 이름 산출) 대조는 본 task 범위 아님 — 본 task 는 **HTTP 계약(route/method/세그먼트/인자 부재)** 표면만 web↔backend 대조.
- `DELETE /api/schedules/:name`(remove) 계약 guard 는 본 task 범위 아님 — web 이 해당 DELETE 를 발사하는지 발사기 존재 선확인 필요(현재 AdminView 에 remove 발사 UI 미확인). 확인 후 별도 slice(Follow-up). 본 task 에서는 형제 base-혼동 negative(e) 대조군으로만 참조.
- `POST /api/schedules/backfill/:personId`(backfill) 계약 guard 는 본 task 범위 아님 — 현재 AdminView 에 backfill 발사기 미존재(web 발사 없음)라 web↔backend 대조 대상이 아님. web UI 추가 시 slice.
- import(`POST /api/admin/import`) · export(`GET /api/admin/export`) endpoint 계약 guard 는 본 task 범위 아님 — 각각 web 발사와 backend 계약 간 **알려진 drift 가 있어 사전 확인 필요**(T-1196~T-1198 Follow-up), 확인 후 별도 slice.
- **shared-helper 추출 refactor 는 여전히 Out of Scope** — `stripComments`/`extractControllerRoute`/`extractHandlerMethods`/`extractHandlerParams`/`composeRoute`/`diffContract` 등이 30+ contract-guard test 파일에 중복됐지만, 공용 helper 추출은 별도 refactor slice(아래 Follow-up 유지 — 다수 파일 접촉 5-파일 cap 초과라 planner split 필요).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (carry-forward) contract-guard test 30+ 파일이 공유하는 정규식 추출기/대조기(`stripComments`, `extractControllerRoute`, `extractHandlerMethods`, `extractHandlerParams`, `extractDtoFields`, `composeRoute`, `diffContract`, `stripQuery`)를 `web/src/views/__contract-guard__/` 공용 helper 로 추출하는 refactor slice — 중복 제거 + 단일 유지보수 지점. api/schedules read+mutation 표면이 거의 다 덮인 시점(GET list · PUT upsert · POST trigger · recent-deletion 완료)이라 추출 ROI 재평가 적기. helper 추출 자체가 다수 파일을 건드려 5-파일 cap 초과 → planner split 필요.
- (후보) `DELETE /api/schedules/:name`(remove) 계약 guard — 단 web 이 해당 DELETE 를 발사하는지 발사기 존재 선확인 필요(현재 AdminView 에 remove 발사 UI 미확인). 확인 후 slice.
- (후보) import(`POST /api/admin/import`) 계약 guard — web `runImport` 는 multipart FormData(file) 를 발사하나 backend `ImportController.create` 는 JSON `CreateImportDto{mode}` body 만 받음. **실 drift 가능성** — guard 신설이 drift 를 fail 로 노출할 수 있어 도메인 확인 후 slice(단순 mirror 부적합).
- (후보) export(`GET /api/admin/export`) 계약 guard — web `runExport` 는 GET 파일 다운로드를 기대하나 backend `ExportController` 는 job-based(`@Post()` createJob · `@Get(":id")` findJob) — bare-base method 대조 이슈. 도메인 확인 후 slice.
