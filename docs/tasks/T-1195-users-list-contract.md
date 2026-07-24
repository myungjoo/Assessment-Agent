---
id: T-1195
title: 사용자 목록 조회 endpoint web↔backend 계약 drift-guard spec 추가 (GET /api/users · buildUsersPath bare @Get() list vs @Get(":id") detail 2-way GET 판별 + `?_r` nonce 무해 + `:id/role` mutation 대조군)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-044, REQ-045]
estimatedDiff: 280
estimatedFiles: 1
created: 2026-07-25
independentStream: web-contract-guard
dependsOn: []
touchesFiles: [web/src/views/AdminView.users-list-contract.test.ts]
plannerNote: "P6 contract-guard arc 다음 slice — 사용자 목록 조회(GET /api/users, buildUsersPath). T-1193 groups-list mirror(bare base GET-list) 를 user controller 로 — @Get() list vs @Get(\":id\") detail 2-way GET 판별 + @Patch(\":id/role\")/@Post() mutation 대조군. pr web test-only 1파일, AdminView.tsx 파일-disjoint."
---

# T-1195 — 사용자 목록 조회 endpoint web↔backend 계약 drift-guard spec 추가

## Why

T-1194 가 **그룹 멤버십 조회(GET /api/groups/:id/members)** 계약 drift-guard 로 그룹 read 표면(목록 + 멤버십)을 봉합했고, T-1192/T-1191 는 파트 자원(목록 + 소속 인원)을, T-1190/T-1193 는 인원/그룹 목록을 각각 봉합했다. 남은 미봉 read 표면 중 하나가 **사용자 목록 조회(GET /api/users)** 이며, T-1192·T-1194 Follow-ups 에서 "사용자 목록 GET(`buildUsersPath`) 계약 guard — GET-list 판별 축을 user controller 로 mirror" 로 다음 순차 slice 로 명시돼 있다. 본 task 는 그것을 채운다 — T-1193 groups-list(bare base GET-list) 패턴을 user controller 로 mirror 한다.

AdminView 는 사용자 관리 섹션에서 `useApiResource<UserRow[]>(usersPath)` 로 사용자 목록을 조회하고(L3617), 사용자 생성(`@Post`)·역할 변경(`@Patch(":id/role")`) 성공 시 `usersRefreshNonce` 증가로 재조회를 유발한다. `usersPath` 는 `buildUsersPath(usersRefreshNonce)`(L3609)로 계산되는데, `buildUsersPath`(L720~725, `export` L4759)는 nonce 0(초기 조회)이면 `USERS_PATH`(`/api/users`, L106)를 그대로, nonce>0 이면 `${USERS_PATH}?_r=<nonce>` cache-buster 를 반환한다(`buildPartsPath`/`buildGroupsPath` 동형 — bare base, path-param 없음, null idle 없음). 이 GET 발사가 backend `UserController.list`(`@Get()` on `@Controller("api/users")`, 200 + `UserResponseDto[]`, 사용자 0 이면 빈 배열) 계약과 drift 없이 일치함을 test-only 로 고정한다.

본 slice 의 판별 축은 **2-way GET 구분** 이다: user controller 는 같은 소스에 `@Get()` list(세그먼트 0, bare base — web 목록 발사 대상)와 `@Get(":id")` detail(세그먼트 1, path-param)을 나란히 갖는다. 추출기가 web 목록 발사(bare base)에 대응하는 **list 를 정확히 선택** 하고 detail(`:id`)과 혼동하지 않아야 한다. 추가로 같은 소스의 `@Patch(":id/role")` changeRole·`@Post()` signup 은 method drift 대조군이며, 특히 `@Patch(":id/role")` 은 `:id/role` 2세그먼트 mutation 이라 GET-list(bare base)와의 method·세그먼트 이중 구분 negative 대조로 승격한다. (REQ-044 사용자 관리 · REQ-045 Admin 사용자 목록 가시성, api.md §1, ADR-0040/ADR-0041.)

## Required Reading

- `web/src/views/AdminView.parts-list-contract.test.ts` — **직접 mirror 선례** (T-1191, bare base GET-list). 실 controller 소스 `readFileSync` 라이브 로드 + `stripComments`/`extractControllerRoute`/`extractHandlerMethods`/`composeRoute`/`diffContract`/`stripQuery` 정규식 추출기·대조기·negative(a~g) 구조를 그대로 차용. 본 task 는 대상을 `part.controller`(`/api/parts`, `buildPartsPath`)에서 `user.controller`(`/api/users`, `buildUsersPath`)로 바꾼 mirror. bare @Get() 세그먼트 0·핸들러 인자 0·`?_r=nonce` 무해 축을 사용자 자원으로 재적용. **단 part 은 3-way(findAll/findById/findPersons), user 는 2-way(list/detail) 판별** — 대조군 개수만 다르고 골격 동일.
- `web/src/views/AdminView.groups-list-contract.test.ts` — 형제 그룹 목록 guard(T-1193). `buildGroupsPath` nonce-aware bare base 대조 방식의 최근 선례. 본 task 는 그 골격을 사용자로 mirror.
- `web/src/views/AdminView.tsx` — `buildUsersPath(refreshNonce: number): string` (L720~725, `export` L4759) — nonce ≤ 0 이면 `USERS_PATH`(`/api/users`), nonce > 0 이면 `${USERS_PATH}?_r=<nonce>`. **null idle 없음·path-param 없음**(`buildPartsPath`/`buildGroupsPath` 동형). 조회 call site: `const usersPath = useMemo(() => buildUsersPath(usersRefreshNonce), [...])` (L3609), `const { data, ... } = useApiResource<UserRow[]>(usersPath)` (L3617) — **옵션 인자 없음**(→ default GET). `UserRow[]` 제네릭이 형제 fetch(`GroupRow[]`/`PartRow[]`/`PersonRow[]`)와 자동 분리. 발사 추출기 anchor 는 소문자 `buildUsersPath` 함수 본문 — 주석 속 `/api/users` 문자열과 섞이지 않게 명시 anchor. (수정 0.)
- `web/src/api/useApiResource.ts` — `useApiResource(path)` 단일 인자 호출 → `options === undefined` → method 미지정 → `fetch` default **GET**. (수정 0 — read-only hook.)
- `src/user/user.controller.ts` — 대조 대상 backend. `@Controller("api/users")` (L96), `@Get()` + 핸들러 `list(): Promise<UserResponseDto[]>` (L203~209) — **인자 0개(@Param/@Body/@Query 없음), 200 + UserResponseDto 배열**. 같은 소스의 `@Get(":id") detail(@Param("id"))` (L253~255, 세그먼트 1 — **핵심 GET 대조군**)·`@Patch(":id/role") changeRole` (L120~123, method+세그먼트 drift 대조군)·`@Post() signup` (L156~158, method drift 대조군, bare base 라 세그먼트 0 이지만 method 다름) 은 판별 대조군.

## Acceptance Criteria

신규 파일 `web/src/views/AdminView.users-list-contract.test.ts` **1개만** 추가. 실 controller 소스(`user.controller.ts`)와 AdminView 소스를 `readFileSync` 로 라이브 로드하고, `buildUsersPath` 를 import 해 실 경로를 계산한다(ADR-0040 §5 — RTL/jsdom 없음). 아래 R-112 4종 + negative 를 모두 cover.

- [ ] **happy-path (경로 정합)**: `buildUsersPath(0)` 이 `/api/users` 를 반환하고, 이 path 가 backend `@Get()` list on `@Controller("api/users")` 의 route(`/api/users`, bare base)와 일치 (`diffContract` 가 `[]`).
- [ ] **happy-path (method 정합)**: web 목록 발사 method 가 GET — AdminView 소스에서 `useApiResource<UserRow[]>(usersPath)` call site 가 **옵션 인자 없이** 호출됨(→ default GET)을 소스 대조로 검증하고, backend list 핸들러가 `@Get`(POST/PATCH/DELETE 아님)임을 확인. 양측 method == GET.
- [ ] **happy-path (query 무해)**: `buildUsersPath(7)` 이 `/api/users?_r=7` 을 반환하되, `?` 앞 base 경로가 여전히 backend route 와 일치(추출기 query strip). `_r` 은 backend 가 `@Query` 미선언이라 무시하는 cache-buster 로 계약 drift 아님을 명시.
- [ ] **error path (추출기 무력화 방어)**: `ROUTE`/`method`/handler 추출이 하나도 비어있지 않음 검증. 빈 소스 입력 시 통과가 아니라 `'backend 계약 추출 실패'` 사유 1건 반환(대조가 통과하지 않음).
- [ ] **분기 — base 파싱**: `@Controller("api/users")` 를 `/api/users` 로 정규화(base 만, sub-path 없음).
- [ ] **분기 — bare @Get() 세그먼트 0**: list 핸들러의 `@Get()` 이 sub-path 없이 base 그대로(`/api/users`, 세그먼트 0 = base 이후 추가 세그먼트 없음)임을 검증 — web 발사 bare base 와 정합.
- [ ] **분기 — 핸들러 인자 부재**: `list` 핸들러가 `@Param`·`@Body`·`@Query` 를 하나도 갖지 않음(`hasBody === false`·`hasParam === false` 등) — GET 목록 조회는 인자 계약 없음.
- [ ] **분기 — 2-way GET 판별 (핵심 축)**: 같은 소스의 `@Get(":id") detail`(세그먼트 1)를 web 목록 발사(bare base, 세그먼트 0)에 대면 path 불일치로 잡힘 — 추출기가 `@Get()` list 를 `@Get(":id")` detail 로 오확장하지 않고, 두 GET 이 서로 다른 route(`/api/users` vs `/api/users/:id`)로 정확히 추출됨.
- [ ] **negative (a) base 오타**: backend base 를 `api/user`(단수) / `api/users-x` 로 바꾸면 path 불일치로 잡힘.
- [ ] **negative (b) method drift**: list 핸들러가 `@Post()`/`@Patch()` 로 바뀌면 method 불일치로 잡힘(web 은 GET 발사) — 같은 base 의 `@Post() signup` 대조군과 구분.
- [ ] **negative (c) 세그먼트 추가 drift**: list 가 `@Get(":id")`(path-param 추가) / `@Get("all")`(literal 추가) 로 drift 시 web 발사(bare base)와 세그먼트 불일치로 잡힘. query(`?_r=n`)를 path 세그먼트로 오인하지 않되(query strip), 진짜 추가 세그먼트는 여전히 잡힘.
- [ ] **negative (d) `:id/role` mutation 대조군 혼동**: `@Patch(":id/role") changeRole`(세그먼트 2 mutation)를 GET 목록 조회 핸들러로 오인하지 않음 — method(PATCH≠GET)·세그먼트(`:id/role`≠bare base) 이중 불일치. 추출기가 `@Get()` list 를 정확히 선택.
- [ ] **negative (e) 형제 mutation 대조군 혼동**: `@Post() signup`(같은 bare base, 다른 method)을 GET list 로 오인하지 않음 — bare base 가 같아도 method 로 판별됨(GET vs POST).
- [ ] **negative (f) 주석 false-positive**: 주석 줄의 `@Get()`/`@Controller(...)`/`GET /api/users` 문자열(본 소스 상단·라우팅 순서 주석에 다수 존재)을 실 decorator 로 오인하지 않음(`stripComments` 방어).
- [ ] **negative (g) 형제 GET-list guard 발사기 오용 방지**: `buildUsersPath` 가 nonce ≤ 0 과 nonce > 0 두 분기 모두에서 `/api/users` base 를 유지함(형제 `buildGroupsPath`/`buildPartsPath` 와 base 만 다른 동형)을 명시 — 다른 자원 base(`/api/groups`·`/api/parts`)로 오발사하지 않음.
- [ ] `pnpm --dir web test`(또는 web workspace vitest) 실측 통과 확인 — 위 모든 케이스 green. base/method/`@Get` 세그먼트 변조 → fail → revert 로 guard 유효성 실증.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only 파일이라 커버리지 회귀 없음 확인.
- [ ] size gate: diff ≤ 300 LOC, 변경 파일 정확히 1개.

## Out of Scope

- production 코드(`AdminView.tsx`, `useApiResource.ts`, `apiClient.ts`, `user.controller.ts`) 및 기존 guard 파일 수정 **금지** — 신규 test 파일 1개만 추가.
- 신규 devDependency 추가 금지(정규식 추출기만 — 기존 vitest 사용).
- 사용자 **단건 조회(GET /api/users/:id, detail)** 계약 guard 는 본 task 범위 아님 — web 에 단건 GET call site 가 별도 존재하지 않으면 후속 slice 이며, 본 task 에서는 detail 을 2-way 판별 대조군(분기)으로만 참조.
- 사용자 **생성(POST /api/users, signup)** · **역할 변경(PATCH /api/users/:id/role, changeRole)** · **인스턴스 접근(instance-access)** mutation guard 는 이미 shipped(create-user/role-change/instance-access-contract) — 재작성 금지, 본 task 는 read(GET 목록) 측만. 본 task 에서는 method drift 대조군(negative d/e)으로만 참조.
- export/import · schedule · reevaluate · recent-deletion GET(`buildExportPath`/`buildRecentDeletionPath`) 계약 guard 는 본 task 범위 아님 — 후속 slice.
- **shared-helper 추출 refactor 는 여전히 Out of Scope** — `stripComments`/`extractControllerRoute`/`extractHandlerMethods`/`composeRoute`/`diffContract`/`stripQuery` 등이 26+ contract-guard test 파일에 중복됐지만, 공용 helper 추출은 별도 refactor slice(아래 Follow-up 유지 — 다수 파일 접촉 5-파일 cap 초과라 planner split 필요).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (carry-forward) contract-guard test 26+ 파일이 공유하는 정규식 추출기/대조기(`stripComments`, `extractControllerRoute`, `extractHandlerMethods`, `composeRoute`, `diffContract`, `stripQuery`)를 `web/src/views/__contract-guard__/` 공용 helper 로 추출하는 refactor slice — 중복 제거 + 단일 유지보수 지점. 사용자 read 표면(목록)이 봉합된 시점이라 추출 ROI 재평가 적기. helper 추출 자체가 다수 파일을 건드려 5-파일 cap 초과 → planner split 필요.
- (후보) 최근 삭제 조회(GET, `buildRecentDeletionPath`) 계약 guard — recent-deletion controller 로 mirror. 순차 slice.
- (후보) 사용자 단건 조회(GET /api/users/:id, detail) 계약 guard — web 에 단건 GET call site 가 도입되면 2-way 판별의 세그먼트 1 축을 발사 대상으로 승격.
