---
id: T-1194
title: 그룹 멤버십 조회 endpoint web↔backend 계약 drift-guard spec 추가 (GET /api/groups/:id/members · @Get(":id/members") findMembers path-param + literal 세그먼트 발사 vs @Get(":id/persons") findPersons literal 판별 축 + 조건부 null idle + encodeURIComponent)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-026, REQ-049]
estimatedDiff: 285
estimatedFiles: 1
created: 2026-07-24
independentStream: web-contract-guard
dependsOn: []
touchesFiles: [web/src/views/AdminView.group-members-contract.test.ts]
plannerNote: "P6 contract-guard arc 다음 slice — 그룹 멤버십 조회(GET /api/groups/:id/members, findMembers). T-1192 part-persons mirror 를 그룹으로 — path-param :id + literal members 세그먼트 + 조건부 null idle + encodeURIComponent. 핵심 축: :id/members(findMembers) vs :id/persons(findPersons) literal 판별(같은 소스 두 segment-2 GET). pr web test-only 1파일, AdminView.tsx 파일-disjoint."
---

# T-1194 — 그룹 멤버십 조회 endpoint web↔backend 계약 drift-guard spec 추가

## Why

T-1193 이 **그룹 목록 조회(GET /api/groups)** 계약 drift-guard 로 그룹 자원의 목록(bare base) read 측을 완결했고, T-1192 는 **파트 소속 인원 조회(GET /api/parts/:id/persons, findPersons)** 로 파트 자원의 path-param read 측을 봉합했다. 본 task 는 그 두 선례를 합쳐 **그룹 멤버십 조회(GET /api/groups/:id/members, findMembers)** 계약 guard 를 추가해 그룹 read 표면의 마지막 미봉 슬라이스(path-param + literal 세그먼트)를 채운다. 즉 T-1192 part-persons 패턴을 그룹 자원으로 mirror 한다.

AdminView 는 그룹 관리 섹션에서 선택 그룹의 멤버십을 `useApiResource<MembershipRow[]>(groupMembersPath)` 로 조회하고(L3034~3046), 멤버 add/remove 성공 시 `membersRefreshNonce` 증가로 재조회를 유발한다. `groupMembersPath` 는 `buildGroupMembersPath(selectedGroupId || undefined, membersRefreshNonce)`(L537~552)로 계산되는데, 그룹 미선택(falsy)이면 **`null` 을 반환해 useApiResource 의 조건부 조회(path=null → idle, 미조회)** 를 유발하고(깨진 `/api/groups//members` 발사 예방), 선택 시 `/api/groups/${encodeURIComponent(id)}/members` base 를, nonce>0 이면 `${base}?_r=${nonce}` cache-buster 를 만든다. 이 GET 발사가 backend `GroupController.findMembers`(`@Get(":id/members")` on `@Controller("api/groups")`, 200 + `PersonGroupMembership[]`, 멤버 0 이면 빈 배열) 계약과 drift 없이 일치함을 test-only 로 고정한다.

본 slice 의 핵심 판별 축은 **literal 세그먼트 구분** 이다: group controller 는 같은 소스에 `@Get(":id/persons") findPersons`(세그먼트 2, literal `persons`)와 `@Get(":id/members") findMembers`(세그먼트 2, literal `members`)를 나란히 갖는다. 추출기가 web 멤버십 발사(`:id/members`)를 findMembers 에 정확히 매칭하고 findPersons(`:id/persons`)와 혼동하지 않아야 한다 — 같은 세그먼트 깊이(2)에서 literal 만 다른 두 GET 을 판별하는, T-1193 4-way 축보다 한 단계 정밀한 대조다. (REQ-026 그룹 관리의 멤버십 read 측 · REQ-049 Admin 가시성, api.md §3 L82, ADR-0040/ADR-0041.)

## Required Reading

- `web/src/views/AdminView.part-persons-contract.test.ts` — **직접 mirror 선례** (T-1192). 실 controller 소스 `readFileSync` 라이브 로드 + `stripComments`/`extractControllerRoute`/`extractHandlerMethods`/`composeRoute`/`diffContract`/`stripQuery` 정규식 추출기·대조기·negative(a~g) 구조를 그대로 차용. 본 task 는 대상을 `part.controller.findPersons`(`/api/parts/:id/persons`)에서 `group.controller.findMembers`(`/api/groups/:id/members`)로 바꾸고, 발사기를 `buildPartPersonsPath` 에서 `buildGroupMembersPath` 로 교체한 mirror. path-param `:id` + literal 세그먼트 2 + 조건부 null(idle) + encodeURIComponent 축을 그룹 멤버십으로 재적용.
- `web/src/views/AdminView.groups-list-contract.test.ts` — 형제 그룹 read guard 직전 slice(T-1193). group controller 소스 로드 경로 · `/api/groups` base 대조 · 4-way GET(`@Get()` findAll vs `@Get(":id")` findById vs `@Get(":id/persons")` findPersons vs `@Get(":id/members")` findMembers) 판별 방식의 그룹 측 선례. 본 task 는 그 4-way 중 findMembers 를 web 발사 대상으로 삼고 findPersons(literal persons)와의 구분을 핵심 negative 로 승격.
- `web/src/views/AdminView.tsx` — `buildGroupMembersPath(selectedGroupId, refreshNonce=0)` (L537~552, `export` L4749) — falsy id 이면 `null`(→ idle 미조회), 선택 시 `/api/groups/${encodeURIComponent(id)}/members`, nonce>0 이면 `?_r=<nonce>` cache-buster. 조회 call site: `const groupMembersPath = useMemo(() => buildGroupMembersPath(selectedGroupId || undefined, membersRefreshNonce), [...])` (L3034~3037), `const { data, ... } = useApiResource<MembershipRow[]>(groupMembersPath)` (L3046) — **옵션 인자 없음**(→ default GET). `MembershipRow[]` 제네릭이 형제 fetch(`GroupRow[]`/`PartRow[]`/`PersonRow[]`)와 자동 분리. 발사 추출기 anchor 는 소문자 `buildGroupMembersPath` 함수 본문 — 주석 속 `/api/groups/:id/members` 문자열과 섞이지 않게 명시 anchor. (수정 0.)
- `web/src/api/useApiResource.ts` — `useApiResource(path)` 단일 인자 호출 → `options === undefined` → method 미지정 → `fetch` default **GET**. `path === null` 이면 조회 skip(idle) — 그룹 미선택 시 발사 없음 convention. (수정 0 — read-only hook.)
- `src/user/group.controller.ts` — 대조 대상 backend. `@Controller("api/groups")` (L79), `@Get(":id/members")` + 핸들러 `findMembers(@Param("id") id): Promise<PersonGroupMembership[]>` (L120~123) — **`@Param("id")` 1개, @Body/@Query 없음, 200 + PersonGroupMembership 배열**. 같은 소스의 `@Get(":id/persons") findPersons(@Param("id"))` (L108~111, literal `persons` — **핵심 대조군**)·`@Get() findAll` (L92~95, 세그먼트 0)·`@Get(":id") findById` (L99~102, 세그먼트 1) 는 GET-vs-GET 판별 대조군, `create @Post(":id/members")`(L140, 같은 route 다른 method)·`delete @Delete(":id/members/:membershipId")`(L198) 는 method/세그먼트 drift 대조군.

## Acceptance Criteria

신규 파일 `web/src/views/AdminView.group-members-contract.test.ts` **1개만** 추가. 실 controller 소스(`group.controller.ts`)와 AdminView 소스를 `readFileSync` 로 라이브 로드하고, `buildGroupMembersPath` 를 import 해 실 경로를 계산한다(ADR-0040 §5 — RTL/jsdom 없음). 아래 R-112 4종 + negative 를 모두 cover.

- [ ] **happy-path (경로 정합)**: `buildGroupMembersPath("g1", 0)` 이 `/api/groups/g1/members` 를 반환하고, 이 path 가 backend `@Get(":id/members")` findMembers on `@Controller("api/groups")` 의 route(`/api/groups/:id/members`)와 path-param 위치까지 일치 (`diffContract` 가 `[]`).
- [ ] **happy-path (method 정합)**: web 멤버십 발사 method 가 GET — AdminView 소스에서 `useApiResource<MembershipRow[]>(groupMembersPath)` call site 가 **옵션 인자 없이** 호출됨(→ default GET)을 소스 대조로 검증하고, backend findMembers 핸들러가 `@Get`(POST/PATCH/DELETE 아님)임을 확인. 양측 method == GET.
- [ ] **happy-path (query 무해 + 인코딩)**: `buildGroupMembersPath("g1", 4)` 가 `/api/groups/g1/members?_r=4` 를 반환하되, `?` 앞 base 경로가 여전히 backend route 와 일치(추출기 query strip). `buildGroupMembersPath("a/b", 0)` 이 id 를 `encodeURIComponent` 로 인코딩(`a%2Fb`)해 세그먼트가 깨지지 않음(`/api/groups/a%2Fb/members`).
- [ ] **error path (추출기 무력화 방어)**: `ROUTE`/`method`/handler 추출이 하나도 비어있지 않음 검증. 빈 소스 입력 시 통과가 아니라 `'backend 계약 추출 실패'` 사유 1건 반환(대조가 통과하지 않음).
- [ ] **분기 — base + literal 세그먼트 파싱**: `@Controller("api/groups")` + `@Get(":id/members")` 를 `/api/groups/:id/members` 로 정규화 — base(`api/groups`) + path-param(`:id`) + literal(`members`) 세그먼트 3요소 합성 정확.
- [ ] **분기 — path-param 위치**: `:id` 가 세그먼트 2(0-index 1) 위치에 있고 literal `members` 가 그 뒤(세그먼트 3)임을 검증 — web 발사도 동일 위치에 인코딩된 id 를 놓음.
- [ ] **분기 — 핸들러 인자**: `findMembers` 핸들러가 `@Param("id")` 1개만 갖고 `@Body`·`@Query` 는 없음(`hasBody === false` 등) — GET 멤버십 조회는 path-param 만, body/query 계약 없음.
- [ ] **분기 — 조건부 null idle 발사**: `buildGroupMembersPath(undefined, 0)` 이 `null` 을 반환(그룹 미선택 → useApiResource idle, 발사 없음) — 깨진 `/api/groups//members`(빈 id) 발사가 나지 않음을 입증. 선택 시에만 계약 대조 대상 path 가 생성됨(선택 vs 미선택 두 분기).
- [ ] **분기 — literal 세그먼트 판별 (핵심 축)**: 같은 소스의 `@Get(":id/persons") findPersons` 는 세그먼트 2 literal `persons`, `@Get(":id/members") findMembers` 는 세그먼트 2 literal `members` — 추출기가 web 멤버십 발사(`:id/members`)에 대응하는 **findMembers 를 선택** 하고 findPersons(`:id/persons`)와 **혼동하지 않음**(같은 depth·다른 literal 판별)을 입증. 두 GET 이 서로 다른 route(`/api/groups/:id/persons` vs `/api/groups/:id/members`)로 정확히 추출됨.
- [ ] **negative (a) base 오타**: backend base 를 `api/group`(단수) / `api/groups-x` 로 바꾸면 path 불일치로 잡힘.
- [ ] **negative (b) method drift**: findMembers 핸들러가 `@Post(":id/members")`/`@Patch(":id/members")` 로 바뀌면 method 불일치로 잡힘(web 은 GET 발사) — 같은 route 의 `@Post(":id/members")` create 대조군과 구분.
- [ ] **negative (c) literal 세그먼트 오타**: findMembers 가 `@Get(":id/member")`(단수) / `@Get(":id/persons")`(persons literal) 로 drift 시 web 발사(`:id/members`)와 literal 불일치로 잡힘 — **members vs persons 오인이 회귀로 검출됨**.
- [ ] **negative (d) 세그먼트 축소/추가**: findMembers 가 `@Get(":id")`(literal 소실, 세그먼트 축소) / `@Get(":id/members/all")`(세그먼트 추가) 로 drift 시 path 불일치. query(`?_r=n`)를 path 세그먼트로 오인하지 않되(query strip), 진짜 추가 세그먼트는 여전히 잡힘.
- [ ] **negative (e) 형제 mutation 대조군 혼동**: `@Post(":id/members")` create / `@Delete(":id/members/:membershipId")` remove 를 GET 멤버십 조회 핸들러로 오인하지 않음 — 추출기가 `@Get(":id/members")` findMembers 를 정확히 선택.
- [ ] **negative (f) 주석 false-positive**: 주석 줄의 `@Get(":id/members")`/`@Controller(...)`/`GET /api/groups/:id/members` 문자열(본 소스 상단 주석에 다수 존재)을 실 decorator 로 오인하지 않음(`stripComments` 방어).
- [ ] **negative (g) idle(null) 을 통과로 오인 방지**: `buildGroupMembersPath(undefined, 0) === null` 을 "계약 일치"로 오판하지 않음 — null 은 발사 부재(idle)이지 drift 대조 통과가 아님을 명시(선택 그룹이 있을 때만 실 path 로 대조).
- [ ] `pnpm --dir web test`(또는 web workspace vitest) 실측 통과 확인 — 위 모든 케이스 green. base/literal/`@Get` 변조 → fail → revert 로 guard 유효성 실증.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only 파일이라 커버리지 회귀 없음 확인.
- [ ] size gate: diff ≤ 300 LOC, 변경 파일 정확히 1개.

## Out of Scope

- production 코드(`AdminView.tsx`, `useApiResource.ts`, `apiClient.ts`, `group.controller.ts`) 및 기존 guard 파일 수정 **금지** — 신규 test 파일 1개만 추가.
- 신규 devDependency 추가 금지(정규식 추출기만 — 기존 vitest 사용).
- 그룹 **소속 인원 조회(GET /api/groups/:id/persons, findPersons)** 계약 guard 는 본 task 범위 아님 — web 에 findPersons 대응 GET call site 가 별도 존재하지 않으면(현재 그룹 UI 는 members 발사만) 후속 slice 이며, 본 task 에서는 findPersons 를 literal 판별 negative 대조군(c)으로만 참조.
- 그룹 **단건 조회(GET /api/groups/:id, findById)** · **목록(GET /api/groups, findAll, T-1193 완료)** 계약 guard 는 본 task 범위 아님 — findById 는 4-way 대조군으로만 참조.
- 멤버 **추가(POST /api/groups/:id/members) · 제거(DELETE /api/groups/:id/members/:membershipId)** mutation guard 는 이미 shipped(group-member-add/remove) — 재작성 금지, 본 task 는 read(GET) 측만.
- 사용자 목록 GET(`buildUsersPath`) 계약 guard 는 본 task 범위 아님 — 후속 GET-list slice.
- **shared-helper 추출 refactor 는 여전히 Out of Scope** — `stripComments`/`extractControllerRoute`/`extractHandlerMethods`/`composeRoute`/`diffContract`/`stripQuery` 등이 25+ contract-guard test 파일에 중복됐지만, 공용 helper 추출은 별도 refactor slice(아래 Follow-up 유지 — 다수 파일 접촉 5-파일 cap 초과라 planner split 필요).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (carry-forward) contract-guard test 25+ 파일이 공유하는 정규식 추출기/대조기(`stripComments`, `extractControllerRoute`, `extractHandlerMethods`, `composeRoute`, `diffContract`, `stripQuery`)를 `web/src/views/__contract-guard__/` 공용 helper 로 추출하는 refactor slice — 중복 제거 + 단일 유지보수 지점. 그룹 read 표면(목록+멤버십)이 봉합된 시점이라 추출 ROI 재평가 적기. helper 추출 자체가 다수 파일을 건드려 5-파일 cap 초과 → planner split 필요.
- (후보) 사용자 목록 GET(`buildUsersPath`) 계약 guard — GET-list 판별 축을 user controller 로 mirror. 순차 slice.
- (후보) 그룹 단건 조회(GET /api/groups/:id, findById) 계약 guard — web 에 단건 GET call site 가 도입되면 4-way 판별의 세그먼트 1 축을 발사 대상으로 승격.
