---
id: T-1200
title: 현재 사용자 조회(GET /api/auth/me) endpoint web↔backend 계약 drift-guard spec 추가 (AUTH_ME_PATH 2-세그먼트 base+literal subpath + method GET + 무-body·무-param(@Req 배제) + @Get("me") vs 형제 @Post("login"/"logout"/"refresh") method+세그먼트 판별)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-044, REQ-045]
estimatedDiff: 250
estimatedFiles: 1
created: 2026-07-25
independentStream: web-contract-guard
dependsOn: []
touchesFiles: [web/src/views/AdminView.auth-me-contract.test.ts]
plannerNote: "P6 contract-guard arc 다음 slice — 현재 사용자 조회(GET /api/auth/me, AUTH_ME_PATH). T-1199(schedules-list) sibling read guard. 핵심 축: 2-세그먼트 base(api/auth)+literal subpath(me) 합성 + method GET + 무-body·무-param(@Req 배제) + @Get(\"me\") vs 형제 @Post(login/logout/refresh) method+세그먼트 판별. pr web test-only 1파일, AdminView.tsx 파일-disjoint."
---

# T-1200 — 현재 사용자 조회(GET /api/auth/me) endpoint web↔backend 계약 drift-guard spec 추가

## Why

T-1199 가 스케줄 목록 조회(GET /api/schedules, bare-base)의 read-side 계약을 test-only 로 고정하면서 `useApiResource` GET 발사 5종 중 하나를 봉합했다. AdminView 의 `useApiResource` GET 발사 목록을 훑으면 아직 contract-guard 로 덮이지 않은 read-side 발사가 하나 남아있다 — **현재 사용자 조회(GET /api/auth/me)**(`useApiResource<MeRow>(AUTH_ME_PATH)`, L2634~2635). AdminView 컨테이너가 이 GET 으로 현재 사용자 role 을 조회해 `isAdmin` 게이팅(fail-closed)을 파생한다(REQ-045 Admin 전용 패널 gating · REQ-044 3-등급 role). 본 task 는 그 조회 발사와 backend `AuthController.me` 계약의 drift 를 test-only 로 고정해 P6 web↔backend contract-guard arc 의 남은 GET read 표면을 닫는다.

AdminView 는 `AUTH_ME_PATH = '/api/auth/me'`(L158, 고정 base+subpath 상수 — build*Path 빌더 없음, nonce 없음)로 `useApiResource<MeRow>(AUTH_ME_PATH)`(L2634~2635, useApiResource 네 번째 호출)를 발사한다. default GET(method 미명시 → GET)이며 body·path-param 이 없다. 이 GET 발사가 backend `AuthController.me`(`@Get("me")` on `@Controller("api/auth")`, `@Req() req` 만 주입 — `@Body`·`@Param` 0, 반환 `UserResponseDto`) 계약과 drift 없이 일치함을 라이브 소스 대조로 고정한다.

본 slice 의 판별 축은 T-1199(schedules-list, bare-base)와 세 가지가 다르다: (1) **2-세그먼트 route** — `@Controller("api/auth")` base + `@Get("me")` literal subpath 합성(`/api/auth/me`), schedules 의 bare-base(subpath 없음)와 대조되는 literal subpath 합성. (2) **형제 method+세그먼트 판별** — 같은 `@Controller("api/auth")` 위 형제 `@Post("login")`·`@Post("logout")`·`@Post("refresh")`(전부 POST + 다른 literal subpath)를 `@Get("me")` 로 오인하지 않음. (3) **@Req 배제** — `me(@Req() req)` 핸들러는 `@Req()`(request 객체 주입)를 갖지만 이는 body·path-param 이 아니므로 `hasBody === false && hasParam === false` — `@Req` 를 body/param 으로 오분류하지 않는 판별을 새 축으로 고정한다. (REQ-044 3-등급 role · REQ-045 Admin 전용 gating, ADR-0005/JwtAuthGuard 계약.)

## Required Reading

- `web/src/views/AdminView.schedules-list-contract.test.ts` — **직접 mirror 선례**(T-1199, GET read-side guard). 실 controller 소스 `readFileSync` 라이브 로드 + `stripComments`/`extractControllerRoute`/`extractHandlerMethods`(HTTP method + subPath 추출) + `extractHandlerParams`(균형 괄호 매칭으로 handler 서명 슬라이스 → @Body/@Param 판정) + `composeRoute`/`diffContract`/`stripQuery` + negative(a~g) 구조를 그대로 차용. 본 task 는 대상을 `cron-schedule.controller.list`(bare `@Get()`)에서 `auth.controller.me`(`@Get("me")` — literal subpath 보유)로 바꾸고, 발사기 anchor 를 `useApiResource<string[]>(SCHEDULES_PATH)` 에서 `useApiResource<MeRow>(AUTH_ME_PATH)` 로 교체한 mirror. **base subpath 축을 bare 에서 literal("me")로, param 판정 축에 @Req 배제 케이스를 추가한다.**
- `web/src/views/AdminView.users-list-contract.test.ts` — **GET-side read 발사기 대조 선례**(T-1195). `useApiResource<...>(PATH)` 발사(default GET, 무-body·무-param) 를 소스에서 anchor 로 슬라이스하는 방식 + `?_r` nonce 무해 축을 차용. 본 task 는 그 GET-발사 추출을 `useApiResource<MeRow>(AUTH_ME_PATH)` 로 재적용한다.
- `web/src/views/AdminView.tsx` — `AUTH_ME_PATH = '/api/auth/me'`(L158, `export` 여부 확인 — 없으면 소스 문자열 대조로 상수값 검증). 조회 발사 `useApiResource<MeRow>(AUTH_ME_PATH)`(L2634~2635). 발사 추출기 anchor 는 이 `useApiResource` 호출의 인자(`AUTH_ME_PATH`) + 제네릭(`MeRow`) — 주석 속 `GET /api/auth/me` 문자열(L2630 등)과 섞이지 않게 `useApiResource<MeRow>(AUTH_ME_PATH)` 명시 anchor 로 슬라이스. (수정 0 — read-only.)
- `web/src/hooks/useApiResource.ts`(또는 정의 파일) — `useApiResource(path)` 가 default GET 을 발사함을 확인(method 미명시 → GET, body·path-param 없음). (read-only.)
- `src/auth/auth.controller.ts` — 대조 대상 backend. `@Controller("api/auth")`(L106), `@Get("me")`(L296) + 핸들러 `me(@Req() req): Promise<UserResponseDto>`(L298) — **`@Req()` 만 주입, `@Body`·`@Param` 0(hasBody === false, hasParam === false)**. 같은 파일 형제 handler `@Post("login")`(L148) · `@Post("logout")`(L194) · `@Post("refresh")`(L218) 는 method+세그먼트 판별 대조군.

## Acceptance Criteria

신규 파일 `web/src/views/AdminView.auth-me-contract.test.ts` **1개만** 추가. 실 controller 소스(`auth.controller.ts`)·AdminView 소스를 `readFileSync` 로 라이브 로드하고, `AUTH_ME_PATH` 값(상수 export 시 import, 아니면 소스 대조로 확정)으로 실 경로를 계산한다(ADR-0040 §5 — RTL/jsdom 없음). 아래 R-112 4종 + negative 를 모두 cover.

- [ ] **happy-path (경로 정합)**: web 조회 경로 `/api/auth/me` 가 backend `@Get("me")` on `@Controller("api/auth")` 의 route(`/api/auth/me` — base `api/auth` + literal subpath `me`)와 세그먼트까지 일치(`diffContract` 가 `[]`). 2-세그먼트 base+subpath 합성 정확.
- [ ] **happy-path (method 정합)**: web 발사 method 가 GET — AdminView 소스에서 `useApiResource<MeRow>(AUTH_ME_PATH)` 가 default GET(method 미명시)임을 확인하고, backend me 핸들러가 `@Get`(POST/PUT/DELETE 아님)임을 확인. 양측 method == GET.
- [ ] **happy-path (무-body·무-param 정합, @Req 배제)**: backend me 핸들러가 `@Body`·`@Param` 을 갖지 않음(`hasBody === false` && `hasParam === false`)을 확인 — 핸들러가 `@Req()`(request 객체 주입)를 갖더라도 이를 body/param 으로 오분류하지 않음. web 조회도 body·path-param 없는 고정 상수 path 를 씀.
- [ ] **error path (추출기 무력화 방어)**: `ROUTE`/`method`/handler 추출이 하나도 비어있지 않음 검증. 빈 소스 입력 시 통과가 아니라 `'backend 계약 추출 실패'` 사유 1건 반환. `extractHandlerParams('', 'me')`·`extractHandlerMethods('')`·`extractControllerRoute('')` 가 빈 값(null/{}) 반환 확인.
- [ ] **분기 — base+literal subpath 세그먼트 파싱**: `@Controller("api/auth")` + `@Get("me")`(literal subpath `me`)를 `/api/auth/me` 로 정규화 — base(api/auth) 2세그먼트 + literal subpath 1세그먼트 합성임을 확인. schedules 의 bare-base(subpath 없음)와 대조.
- [ ] **분기 — 형제 method+세그먼트 판별(핵심 축)**: 같은 `@Controller("api/auth")` base 위 형제 `@Get("me")`(GET) 와 `@Post("login")`/`@Post("logout")`/`@Post("refresh")`(POST + 다른 subpath)를 **method+세그먼트로 구분** — 추출기가 GET 발사를 `me`(GET) 핸들러에 매칭하고 login/logout/refresh(POST) 로 오매칭하지 않음.
- [ ] **분기 — 핸들러 인자 판별(@Req 케이스)**: me 핸들러가 `@Body`·`@Param` 을 둘 다 갖지 않음(`hasBody === false` && `hasParam === false`) — `@Req()` 만 주입한 read handler 임을 고정(@Req 를 param 으로 오분류하면 회귀로 검출).
- [ ] **negative (a) base 오타**: backend base 를 `api/au`/`api/authx` 로 바꾸거나 subpath 를 `mee`/`m` 으로 바꾸면 path 불일치로 잡힘.
- [ ] **negative (b) method drift**: me 핸들러가 `@Post()`/`@Put()`/`@Delete()` 로 바뀌면 method 불일치로 잡힘(web 은 GET 발사). 특히 같은 base 형제 `@Post` 로의 method drift 를 검출.
- [ ] **negative (c) 세그먼트 drift**: me 가 `@Get("me/:id")`(path-param 추가) / `@Get()`(subpath 제거, bare-base 로 축소) 로 drift 시 web 발사(`/api/auth/me`)와 세그먼트 불일치로 잡힘.
- [ ] **negative (d) 인자 추가 오인 방지**: me 핸들러에 `@Param`/`@Body` 를 추가하도록 조작하면 web 조회(무-body·무-param)와 인자 계약 불일치가 회귀로 검출됨 — 인자-0 read 계약(@Req 만 허용)이 고정됨.
- [ ] **negative (e) 형제 api/auth handler 혼동**: 같은 `api/auth` prefix 를 공유하는 형제 handler(`@Post("login")`/`@Post("logout")`/`@Post("refresh")`)를 me 로 오인하지 않음 — 추출기가 `auth.controller.ts` 의 `@Get("me")` 를 정확히 선택하고 base 만 같은 다른 route 로 오확장하지 않음.
- [ ] **negative (f) `?_r` nonce 무해**: web 조회 path 에 cache-bust query(`?_r=<n>`)가 붙어도 route 대조가 base path 기준으로 통과함(query strip 후 대조).
- [ ] **negative (g) 주석 false-positive**: 주석 줄의 `@Get(...)`/`@Post(...)`/`@Controller(...)`/`GET /api/auth/me` 문자열(본 소스 상단·핸들러 주석에 다수 존재)을 실 decorator 로 오인하지 않음(`stripComments` 방어).
- [ ] `pnpm --dir web test`(또는 web workspace vitest) 실측 통과 확인 — 위 모든 케이스 green. base/method/세그먼트/인자 변조 → fail → revert 로 guard 유효성 실증.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only 파일이라 커버리지 회귀 없음 확인.
- [ ] size gate: diff ≤ 300 LOC, 변경 파일 정확히 1개.

## Out of Scope

- production 코드(`AdminView.tsx`, `useApiResource.ts`, `auth.controller.ts`) 및 기존 guard 파일 수정 **금지** — 신규 test 파일 1개만 추가.
- 신규 devDependency 추가 금지(정규식 추출기만 — 기존 vitest 사용).
- `@UseGuards(JwtAuthGuard)` / RBAC(User+) 도메인 검증은 본 task 범위 아님 — 본 task 는 **HTTP 계약(route/method/세그먼트/인자 부재)** 표면만 web↔backend 대조.
- 형제 `@Post("login")`/`@Post("logout")`/`@Post("refresh")` 계약 guard 는 본 task 범위 아님 — AdminView 는 이들을 발사하지 않으므로(로그인 흐름은 별도 view) web↔backend 대조 대상이 아님. 본 task 에서는 형제 method 혼동 negative(e) 대조군으로만 참조.
- import(`POST /api/admin/import`) · export(`GET /api/admin/export`) endpoint 계약 guard 는 본 task 범위 아님 — 각각 web 발사와 backend 계약 간 **알려진 drift 가 있어 사전 확인 필요**(T-1196~T-1199 Follow-up), 확인 후 별도 slice.
- **shared-helper 추출 refactor 는 여전히 Out of Scope** — `stripComments`/`extractControllerRoute`/`extractHandlerMethods`/`extractHandlerParams`/`composeRoute`/`diffContract`/`stripQuery` 등이 30+ contract-guard test 파일에 중복됐지만, 공용 helper 추출은 별도 refactor slice(아래 Follow-up 유지 — 다수 파일 접촉 5-파일 cap 초과라 planner split 필요).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (carry-forward) contract-guard test 30+ 파일이 공유하는 정규식 추출기/대조기(`stripComments`, `extractControllerRoute`, `extractHandlerMethods`, `extractHandlerParams`, `extractDtoFields`, `composeRoute`, `diffContract`, `stripQuery`)를 `web/src/views/__contract-guard__/` 공용 helper 로 추출하는 refactor slice — 중복 제거 + 단일 유지보수 지점. `useApiResource` GET read 표면이 전량 덮인 시점(groups/persons/parts/users/schedules/group-members/llm-providers/difficulty-mappings/part-persons/auth-me)이라 추출 ROI 재평가 적기. helper 추출 자체가 다수 파일을 건드려 5-파일 cap 초과 → planner split 필요.
- (후보) `DELETE /api/schedules/:name`(remove) 계약 guard — 현재 AdminView 에 remove 발사 UI 미확인(web 발사 없음)이라 web↔backend 대조 대상 아님. web UI 추가 시 slice.
- (후보) import(`POST /api/admin/import`) 계약 guard — web `runImport` 는 multipart FormData(file) 발사, backend `ImportController.create` 는 JSON `CreateImportDto{mode}` body — **실 drift 가능성**. 도메인 확인 후 slice.
- (후보) export(`GET /api/admin/export`) 계약 guard — web `runExport` 는 GET 파일 다운로드 기대, backend `ExportController` 는 job-based(`@Post()` createJob · `@Get(":id")` findJob). 도메인 확인 후 slice.
