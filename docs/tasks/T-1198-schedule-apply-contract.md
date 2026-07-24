---
id: T-1198
title: 스케줄 주기 등록/교체(apply·upsert) endpoint web↔backend 계약 drift-guard spec 추가 (PUT /api/schedules · SCHEDULES_PATH bare-base + method PUT + @Body UpsertCronScheduleDto{name,cronExpression} + falsy-cron 미발사 guard + 형제 api/schedules controller(list/remove/trigger/recent-deletion/backfill) 판별)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-040, REQ-045]
estimatedDiff: 260
estimatedFiles: 1
created: 2026-07-25
independentStream: web-contract-guard
dependsOn: []
touchesFiles: [web/src/views/AdminView.schedule-apply-contract.test.ts]
plannerNote: "P6 contract-guard arc 다음 slice — 스케줄 주기 apply/upsert(PUT /api/schedules, SCHEDULES_PATH). T-1197 trigger 형제 controller 의 body-보유 mutation(같은 cron-schedule.controller 의 @Put upsert). 핵심 축: bare-base(subPath 없음) + method PUT + @Body UpsertCronScheduleDto{name,cronExpression} + falsy-cron 미발사 guard + 형제 controller(@Get list/@Delete remove/@Post trigger/recent-deletion/backfill) 판별. pr web test-only 1파일, AdminView.tsx 파일-disjoint."
resumeBranch: claude/T-1198-schedule-apply-contract
resumeBranchSha: cfafdde4
resumeState: "구현+테스트+push 완료(cfafdde4). PR open 만 남음 — 2026-07-24T19:5xZ cron fire(cron@aa-cloud-31ae4960)가 GitHub PR-create write-path 일시 장애(GraphQL/REST 둘 다 500·empty, reads 정상)로 PR 을 열지 못함. 다음 fire 재진입 시 아래 ## RESUME 섹션 절차를 따른다(재구현 금지)."
---

# T-1198 — 스케줄 주기 등록/교체(apply·upsert) endpoint web↔backend 계약 drift-guard spec 추가

## RESUME (다음 fire 필독 — 재구현 금지)

**상태: 구현·테스트·push 완료. PR open + 4-gate 만 남음.**

2026-07-24 cron fire(cron@aa-cloud-31ae4960)가 본 spec 을 완성해 feature branch `claude/T-1198-schedule-apply-contract`(tip `cfafdde4`, +300/-0, `web/src/views/AdminView.schedule-apply-contract.test.ts` 1파일)에 commit·push 까지 마쳤으나, **GitHub PR-create write-path 일시 장애**(`gh pr create` GraphQL + REST `POST /pulls` 모두 500/empty, reads 정상)로 PR 을 열지 못하고 종료했다. task 코드에는 결함이 없다(로컬 web 전체 1767 green + tsc clean).

다음 fire(GitHub write-path 복구 후) 재진입 절차:

1. **재구현하지 말 것.** 원격 브랜치 `claude/T-1198-schedule-apply-contract`(`cfafdde4`)가 완성 spec 을 이미 보유. `git fetch` 후 이 브랜치가 살아있는지 확인. 살아있으면 그대로 사용.
2. 그 브랜치에서 **PR open**(제목: `test(web): 스케줄 주기 등록/교체(PUT /api/schedules) endpoint web↔backend 계약 drift-guard spec 추가 (T-1198)`, 본문에 task 링크 + Acceptance 체크리스트).
3. integrator dispatch → reviewer 4-gate(§3.3) → CI green → squash merge + branch delete.
4. merge 후 본 ## RESUME 섹션과 frontmatter 의 `resumeBranch`/`resumeBranchSha`/`resumeState` 를 bookkeeping 에서 제거(cleanup).
5. **브랜치가 소실됐거나(정리 스크립트가 삭제) reopen 불가하면** 그때만 재구현으로 fallback — 동일 Acceptance Criteria 로 새로 작성.

## Why

T-1197 이 **수동 즉시 재평가(POST /api/schedules/trigger)** 계약 drift-guard 로 `api/schedules` 자원의 body·param 없는 202 mutation 을 봉합했고, 그 negative(e) 대조군으로 같은 `cron-schedule.controller.ts` 파일의 형제 handler(@Get() list · @Put() upsert · @Delete(":name") remove)를 이미 참조했다. 그 형제 중 아직 guard 가 없는 가장 핵심적인 mutation 이 **스케줄 주기 등록/교체(PUT /api/schedules)** 다 — Admin 이 cron 식을 입력해 default schedule 을 upsert 하는 body-보유 mutation. 본 task 는 그 발사와 backend 계약의 drift 를 test-only 로 고정한다. trigger(T-1197)의 POST mutation 패턴을 mirror 하되, **body 없는 202 → @Body DTO 를 실어 보내는 PUT** 라는 축을 다시 세워, T-1196 recent-deletion 의 `@Body` 대조 축을 body-only(path-param 없는) 형태로 재적용한다.

AdminView 는 SchedulePanel 의 apply 컨트롤에서 스케줄 주기 적용을 발화한다. `handleApply`(컨테이너) 가 `runApply(cronExpression, { request: apiClient.request, busy, ... })`(L1022~1059) 를 호출하고, 이 러너는 `deps.request(SCHEDULES_PATH, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name: DEFAULT_SCHEDULE_NAME, cronExpression }) })`(L1042~1049) 로 **JSON body 를 실은 명시적 PUT** 을 발사한다. `SCHEDULES_PATH = '/api/schedules'`(L344)는 build*Path 빌더 없는 고정 base 상수(bare base — subPath 없음)다. `DEFAULT_SCHEDULE_NAME = 'daily-evaluation'`(L351)은 SchedulePanel 이 name 을 노출하지 않으므로 컨테이너가 공급하는 default. 발사 전 `runApply` 는 `!cronExpression`(빈/falsy cron 식)이면 조기 return 해 **잘못된 body PUT 을 억제**(L1027~1029)하고, `deps.busy`(이전 apply/trigger 미완)이면 조기 return 해 **이중 PUT·state 경합을 차단**(L1031~1033)한다. 이 PUT 발사가 backend `CronScheduleController.upsert`(`@Put()`(bare, subPath 없음) on `@Controller("api/schedules")`, `@Body() dto: UpsertCronScheduleDto`) 계약과 drift 없이 일치함을 test-only 로 고정한다.

본 slice 의 판별 축은 trigger(T-1197)와 세 가지가 다르다: (1) **method PUT**(trigger 의 POST 대신), (2) **bare base**(literal subPath 없음 — `@Put()` 은 `/api/schedules` 자체, trigger 의 `trigger` literal 세그먼트 부재), (3) **@Body UpsertCronScheduleDto{name,cronExpression} 존재**(trigger 의 무-body fire-and-forget 대조 — 단 path-param 은 여전히 부재). guard 축은 falsy-cron 미발사 + busy 이중발사 방지 두 가지. 여기에 `api/schedules` prefix 를 공유하는 **형제 handler(같은 파일 @Get() list · @Delete(":name") remove · @Post("trigger") trigger, 별도 파일 @Post("recent-deletion/:personId") · @Post("backfill/:personId"))를 upsert 로 오인하지 않는** 판별을 함께 고정한다. (REQ-040 스케줄 주기 등록/교체(R-73) · REQ-045 Admin 전용, api.md schedules §, ADR-0042 §Decision 2.)

## Required Reading

- `web/src/views/AdminView.schedule-trigger-contract.test.ts` — **직접 mirror 선례**(T-1197, 같은 `cron-schedule.controller.ts` 형제 handler 의 mutation guard). 실 controller 소스 `readFileSync` 라이브 로드 + `stripComments`/`extractControllerRoute`/`extractHandlerMethods`(HTTP method + subPath 추출) + `extractHandlerParams`(균형 괄호 매칭으로 handler 서명 슬라이스 → @Body/@Param 판정) + `composeRoute`/`diffContract`/`toFire`/`sliceTriggerRunner` 정규식 추출기·대조기·negative(a~g) 구조를 그대로 차용. 본 task 는 대상을 `cron-schedule.controller.trigger`(`@Post("trigger")`)에서 `cron-schedule.controller.upsert`(`@Put()` bare, `@Body`)로 바꾸고, 발사기를 `runTrigger`(body·param 없는 POST) 에서 `runApply`(JSON body PUT, subPath 없음) 로 교체한 mirror. **method + 세그먼트 축은 재적용하되, method 를 POST→PUT 로, subPath 를 `trigger` literal → bare base(빈 subPath) 로 바꾸고, @Body 대조 축을 되살린다(hasBody === true + body 키 `name`·`cronExpression`)**. guard 축은 busy 이중발사에 falsy-cron 미발사를 더한다.
- `web/src/views/AdminView.recent-deletion-contract.test.ts` — @Body DTO 계약 대조 축(`extractDtoFields`/body 키 대조) 참조 선례(T-1196). 본 task 는 그 body-키 대조를 `UpsertCronScheduleDto{name,cronExpression}` 로 재적용하되 path-param 축은 제거(upsert 는 param 없음).
- `web/src/views/AdminView.tsx` — `SCHEDULES_PATH = '/api/schedules'` (L344, `export` 대상 여부 확인 — 없으면 소스 문자열 대조로 상수값 검증), `DEFAULT_SCHEDULE_NAME = 'daily-evaluation'` (L351). 발사 러너 `runApply(cronExpression, deps)` (L1022~1059): `!cronExpression` → 조기 return(미발사, L1027~1029), `deps.busy` → 조기 return(미발사, L1031~1033), 아니면 `deps.request(SCHEDULES_PATH, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name: DEFAULT_SCHEDULE_NAME, cronExpression }) })` (L1042~1049). 발사 추출기 anchor 는 `runApply` 본문 안의 `SCHEDULES_PATH` + `method: 'PUT'` + `body:` — 주석 속 문자열과 섞이지 않게 `runApply` 함수 영역만 슬라이스 후 명시 anchor(trigger 선례의 `sliceTriggerRunner` 동형으로 `runApply` 슬라이서 신설). (수정 0.)
- `web/src/api/apiClient.ts` — `apiClient.request(path, options)` — `runApply` 가 `deps.request` 로 주입받는 발사 primitive. `method: 'PUT'` + JSON body 를 그대로 fetch 로 흘려보냄. (수정 0 — read-only.)
- `src/scheduling/cron-schedule.controller.ts` — 대조 대상 backend. `@Controller("api/schedules")` (L70), `@Put()` (bare, subPath 없음) + 핸들러 `upsert(@Body() dto: UpsertCronScheduleDto): void` (L103~107) — **`@Body` 존재, `@Param` 없음**. 같은 파일의 형제 handler `@Get()` list(L90) · `@Delete(":name")` remove(L120, @Param) · `@Post("trigger")` trigger(L140) 는 base 오인·method drift·literal 세그먼트 판별 대조군.
- `src/scheduling/dto/upsert-cron-schedule.dto.ts` — `UpsertCronScheduleDto` — `name`(필수, @IsNotEmpty) + `cronExpression` 필드. web 발사 body 키(`name`, `cronExpression`)와 정합 대조. (read-only — 필드명 확인용.)
- `src/scheduling/recent-deletion.controller.ts` · `src/scheduling/backfill.controller.ts` — 같은 `@Controller("api/schedules")` prefix 를 공유하는 **별도 파일 형제 controller**(`@Post("recent-deletion/:personId")` · `@Post("backfill/:personId")`). negative(e) 형제 base-혼동 대조군 — 추출기가 `cron-schedule.controller.ts` 의 `@Put()` upsert 를 정확히 선택하고 base 만 같은 다른 route 로 오확장하지 않음 검증.

## Acceptance Criteria

신규 파일 `web/src/views/AdminView.schedule-apply-contract.test.ts` **1개만** 추가. 실 controller 소스(`cron-schedule.controller.ts`)·AdminView 소스를 `readFileSync` 로 라이브 로드하고, `SCHEDULES_PATH` 값(상수 export 시 import, 아니면 소스 대조로 확정)으로 실 경로를 계산한다(ADR-0040 §5 — RTL/jsdom 없음). 아래 R-112 4종 + negative 를 모두 cover.

- [ ] **happy-path (경로 정합)**: web 발사 경로 `/api/schedules` 가 backend `@Put()` upsert on `@Controller("api/schedules")` 의 route(`/api/schedules` — subPath 없음, bare base)와 세그먼트까지 일치 (`diffContract` 가 `[]`). base(`api/schedules`) 단일 세그먼트 합성(literal 없음) 정확.
- [ ] **happy-path (method 정합)**: web 발사 method 가 PUT — AdminView 소스에서 `runApply` 안 `deps.request(SCHEDULES_PATH, ...)` 호출이 `method: 'PUT'` 을 명시함을 소스 대조로 검증하고, backend upsert 핸들러가 `@Put`(GET/POST/DELETE 아님)임을 확인. 양측 method == PUT.
- [ ] **happy-path (@Body 정합)**: web 발사 options 에 `body` 가 있고 그 JSON 키가 `name`·`cronExpression` 임을 소스/발사 캡처 대조로 검증하고, backend upsert 핸들러가 `@Body() dto: UpsertCronScheduleDto` 를 가짐(`hasBody === true`)을 확인. 양측 모두 body 보유 — mutation payload 계약(`name`·`cronExpression`)이 drift 없음을 고정.
- [ ] **happy-path (path-param 부재 정합)**: backend upsert 핸들러가 `@Param` 을 갖지 않고(`hasParam === false`) route 에 `:` 동적 세그먼트가 없음을 확인. web 발사도 고정 base 상수 path(치환 세그먼트 없음)를 씀 — trigger·remove 와 대조되는 무-param mutation.
- [ ] **error path (추출기 무력화 방어)**: `ROUTE`/`method`/handler 추출이 하나도 비어있지 않음 검증. 빈 소스 입력 시 통과가 아니라 `'backend 계약 추출 실패'` 사유 1건 반환(대조가 통과하지 않음). `extractHandlerParams('', 'upsert')`·`extractHandlerMethods('')`·`extractControllerRoute('')` 가 빈 값(null/{}) 반환 확인.
- [ ] **분기 — bare base 세그먼트 파싱**: `@Controller("api/schedules")` + `@Put()`(subPath 빈 문자열)를 `/api/schedules` 로 정규화 — base 단일 세그먼트(literal subPath 없음)임을 확인. trigger 의 2세그먼트 합성과 대조.
- [ ] **분기 — falsy-cron 미발사 guard**: `runApply` 가 `if (!cronExpression) return;` 조기 return 으로 발사를 억제함을 소스 대조로 검증 — 빈/falsy cron 식일 때 잘못된 body PUT 이 나지 않음을 입증. cronExpression 유효할 때만 실 path 로 대조(발사 vs 미발사 두 분기).
- [ ] **분기 — busy 이중발사 미발사 guard**: `runApply` 가 `if (deps.busy) return;` 조기 return 으로 발사를 억제함을 소스 대조로 검증 — 이전 apply/trigger 미완 중 이중 PUT 이 나지 않음. busy=false 일 때만 실 발사(발사 vs 미발사 두 분기).
- [ ] **분기 — 핸들러 인자 판별**: upsert 핸들러가 `@Body` 는 갖고(`hasBody === true`) `@Param` 은 갖지 않음(`hasParam === false`) — trigger(둘 다 부재)·remove(@Param 존재)·recent-deletion(param+body 둘 다 존재)와 대조되는 body-only handler 임을 고정.
- [ ] **negative (a) base 오타**: backend base 를 `api/schedule`(단수) / `api/schedules-x` 로 바꾸면 path 불일치로 잡힘.
- [ ] **negative (b) method drift**: upsert 핸들러가 `@Get()`/`@Post()`/`@Delete()` 로 바뀌면 method 불일치로 잡힘(web 은 PUT 발사).
- [ ] **negative (c) 세그먼트 추가 drift**: upsert 가 `@Put("apply")`(literal 추가) / `@Put(":name")`(path-param 추가) 로 drift 시 web 발사(bare base `/api/schedules`)와 세그먼트 불일치로 잡힘.
- [ ] **negative (d) body 키 drift**: backend `UpsertCronScheduleDto` 대조 키를 `cron`(축약 오타) / `expression`(다른 키) 로 바꾸거나 web 발사 body 에서 `cronExpression`·`name` 키를 누락/추가하면 body 계약 불일치가 회귀로 검출됨 — mutation payload 계약이 고정됨.
- [ ] **negative (e) 형제 api/schedules controller 혼동**: 같은 `api/schedules` prefix 를 공유하는 형제 handler(같은 파일 `@Get()` list / `@Delete(":name")` remove / `@Post("trigger")` trigger, 및 별도 파일 `@Post("recent-deletion/:personId")` / `@Post("backfill/:personId")`)를 upsert 로 오인하지 않음 — 추출기가 `cron-schedule.controller.ts` 의 `@Put()` upsert 를 정확히 선택하고, base 만 같은 다른 route 로 오확장하지 않음. 특히 형제 mutation(trigger POST · remove DELETE)과 method·세그먼트가 다름을 판별.
- [ ] **negative (f) @Body 소실 오인 방지**: upsert 핸들러에서 `@Body` 파라미터를 제거하도록 조작하면 web 발사(body 보유)와 인자 계약 불일치가 회귀로 검출됨 — body-보유 mutation 계약이 고정됨(fire-and-forget 으로 오변질 방지).
- [ ] **negative (g) 주석 false-positive**: 주석 줄의 `@Put(...)`/`@Controller(...)`/`PUT /api/schedules` 문자열(본 소스 상단·endpoint 주석에 다수 존재)을 실 decorator 로 오인하지 않음(`stripComments` 방어).
- [ ] `pnpm --dir web test`(또는 web workspace vitest) 실측 통과 확인 — 위 모든 케이스 green. base/method/세그먼트/body-키/인자 변조 → fail → revert 로 guard 유효성 실증.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only 파일이라 커버리지 회귀 없음 확인.
- [ ] size gate: diff ≤ 300 LOC, 변경 파일 정확히 1개.

## Out of Scope

- production 코드(`AdminView.tsx`, `apiClient.ts`, `cron-schedule.controller.ts`, `upsert-cron-schedule.dto.ts`) 및 기존 guard 파일 수정 **금지** — 신규 test 파일 1개만 추가.
- 신규 devDependency 추가 금지(정규식 추출기만 — 기존 vitest 사용).
- backend upsert 의 도메인 로직(cron 식 검증·SchedulerRegistry 등록/교체·기존 job 재등록 산술) 대조는 본 task 범위 아님 — 본 task 는 **HTTP 계약(route/method/세그먼트/@Body 키/인자 부재)** 표면만 web↔backend 대조.
- `DELETE /api/schedules/:name`(remove) 계약 guard 는 본 task 범위 아님 — 단 web 이 해당 DELETE 를 발사하는지 발사기 존재 선확인 필요(현재 AdminView 에 remove 발사 UI 미확인). 확인 후 별도 slice(Follow-up). 본 task 에서는 형제 base-혼동 negative(e) 대조군으로만 참조.
- `GET /api/schedules`(schedule list read) 계약 guard 는 본 task 범위 아님 — 별도 read slice(Follow-up).
- `POST /api/schedules/backfill/:personId`(backfill) 계약 guard 는 본 task 범위 아님 — 현재 AdminView 에 backfill 발사기 미존재(web 발사 없음)라 web↔backend 대조 대상이 아님. web UI 추가 시 slice.
- import(`POST /api/admin/import`) · export(`GET /api/admin/export`) endpoint 계약 guard 는 본 task 범위 아님 — 각각 web 발사(multipart / GET)와 backend 계약(JSON CreateImportDto / job-based POST) 간 **알려진 drift 가 있어 사전 확인 필요**(T-1196/T-1197 Follow-up), 확인 후 별도 slice.
- **shared-helper 추출 refactor 는 여전히 Out of Scope** — `stripComments`/`extractControllerRoute`/`extractHandlerMethods`/`extractHandlerParams`/`composeRoute`/`diffContract` 등이 29+ contract-guard test 파일에 중복됐지만, 공용 helper 추출은 별도 refactor slice(아래 Follow-up 유지 — 다수 파일 접촉 5-파일 cap 초과라 planner split 필요).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (carry-forward) contract-guard test 29+ 파일이 공유하는 정규식 추출기/대조기(`stripComments`, `extractControllerRoute`, `extractHandlerMethods`, `extractHandlerParams`, `extractDtoFields`, `composeRoute`, `diffContract`, `stripQuery`)를 `web/src/views/__contract-guard__/` 공용 helper 로 추출하는 refactor slice — 중복 제거 + 단일 유지보수 지점. api/schedules read+mutation 표면이 거의 다 덮인 시점이라 추출 ROI 재평가 적기. helper 추출 자체가 다수 파일을 건드려 5-파일 cap 초과 → planner split 필요.
- (후보) `DELETE /api/schedules/:name`(remove) 계약 guard — 단 web 이 해당 DELETE 를 발사하는지 발사기 존재 선확인 필요(현재 AdminView 에 remove 발사 UI 미확인). 확인 후 slice.
- (후보) `GET /api/schedules`(schedule list read) 계약 guard — web 조회 발사기 존재 확인 후 read slice.
- (후보) import(`POST /api/admin/import`) 계약 guard — web `runImport` 는 multipart FormData(file) 를 발사하나 backend `ImportController.create` 는 JSON `CreateImportDto{mode}` body 만 받음(multipart 미수신). **실 drift 가능성** — guard 신설이 drift 를 fail 로 노출할 수 있어 도메인 확인 후 slice(단순 mirror 부적합).
- (후보) export(`GET /api/admin/export`) 계약 guard — web `runExport` 는 GET 파일 다운로드를 기대하나 backend `ExportController` 는 job-based(`@Post()` createJob · `@Get(":id")` findJob) — bare-base method 대조 이슈. 도메인 확인 후 slice.
