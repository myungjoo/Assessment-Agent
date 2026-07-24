---
id: T-1192
title: 파트 소속 인원 조회 endpoint web↔backend 계약 drift-guard spec 추가 (GET /api/parts/:id/persons · buildPartPersonsPath path-param + literal-segment 축 + 조건부 null 발사 + ?_r nonce 무해)
phase: P6
status: DONE
mergedAs: 1266cca1
prNumber: 1084
reviewRounds: 1
completedAt: 2026-07-24T15:40:00Z
commitMode: pr
coversReq: [REQ-028, REQ-049]
estimatedDiff: 280
estimatedFiles: 1
created: 2026-07-25
independentStream: web-contract-guard
dependsOn: []
touchesFiles: [web/src/views/AdminView.part-persons-contract.test.ts]
plannerNote: "P6 contract-guard arc 다음 slice — 파트 소속 인원 조회(GET /api/parts/:id/persons). T-1191 parts-list GET 의 3-way 대조군이던 findPersons 를 정면 대상으로. path-param :id + literal persons 세그먼트 + 조건부 null 발사 새 축."
---

# T-1192 — 파트 소속 인원 조회 endpoint web↔backend 계약 drift-guard spec 추가

## Why

T-1191 이 **파트 목록 조회(GET /api/parts)** 계약 drift-guard 를 완결하며, 같은 소스의 `@Get(":id/persons") findPersons` 를 **3-way GET 판별의 대조군** 으로만 참조했다. 본 task 는 그 findPersons 를 **정면 대상** 으로 삼아, 파트 소속 인원 조회(`GET /api/parts/:id/persons`) 계약 guard 를 신설한다. 이로써 파트 자원의 read 표면 두 축(목록 bare base · 소속 인원 path-param+literal 세그먼트)이 모두 봉합된다.

AdminView 는 파트 선택 시 `useApiResource<PersonRow[]>(partPersonsPath)` 로 선택 파트의 소속 인원을 조건부 조회한다(L3582~3586). `partPersonsPath` 는 `buildPartPersonsPath(selectedPartId || undefined, partsRefreshNonce)`(L3574~3575) 로 계산되는데, **선택이 없으면 `null` 을 반환해 미조회(idle)** 하고(깨진 `/api/parts//persons` 404 예방), 선택이 있으면 `/api/parts/${encodeURIComponent(id)}/persons` base 를 만들며, nonce>0 이면 `?_r=<nonce>` cache-buster 를 부착한다(L737~749). 이 GET 발사가 backend `PartController.findPersons`(`@Get(":id/persons")` on `@Controller("api/parts")`, 200 + `Person[]`, 파트 부재 시 404, 인원 0 이면 빈 배열) 계약과 drift 없이 일치함을 test-only 로 고정한다.

본 slice 는 T-1191 GET 패턴을 계승하되 **새 발사 축 3종** 을 커버한다: (1) **path-param `:id` + literal `persons` 세그먼트 합성** — backend `@Get(":id/persons")` 는 세그먼트 2(`:id` param + `persons` literal), (2) **조건부 null 발사** — 미선택 시 web 이 아예 발사하지 않음(idle)을 계약 무위반으로 명시, (3) **`encodeURIComponent` path-param 안전 인코딩** — 비정상 id 도 path 를 깨뜨리지 않음. 추출기는 web 발사(`/api/parts/:id/persons`)를 같은 소스의 `@Get()` findAll(세그먼트 0)·`@Get(":id")` findById(세그먼트 1)와 혼동 없이 **`@Get(":id/persons")` findPersons(세그먼트 2)에 정확히 매칭** 해야 한다. (REQ-028 파트 관리의 소속 인원 read 측 · REQ-049 Admin 가시성, api.md §3, ADR-0040/ADR-0041.)

## Required Reading

- `web/src/views/AdminView.parts-list-contract.test.ts` — **직전 파트 GET slice 선례** (T-1191). 실 controller 소스 `readFileSync` 라이브 로드 + `stripComments`/`extractControllerRoute`/`extractHandlerMethods`/`composeRoute`/`diffContract`/`stripQuery` 정규식 추출기·대조기·negative(a~g) 구조를 그대로 차용. 본 task 는 대상을 findAll(bare base)에서 findPersons(`:id/persons`)로 바꾼 mirror — path-param + literal 세그먼트 합성·조건부 null 발사·query 무해 축을 추가.
- `web/src/views/AdminView.part-delete-contract.test.ts` — 형제 part guard(T-1183). part controller 소스 로드 경로 + **path-param `:id` 발사 축의 파트 측 선례**(`@Delete(":id")`). 본 task 는 그 path-param 축에 literal `persons` 세그먼트를 추가로 합성(세그먼트 2). 단 delete 는 mutation, 본 task 는 read(GET).
- `web/src/views/AdminView.tsx` — `buildPartPersonsPath(selectedPartId, refreshNonce=0)` (L737~749, `export` L4760): `selectedPartId` falsy 이면 `null`(미조회 idle), truthy 이면 `/api/parts/${encodeURIComponent(selectedPartId)}/persons` base, nonce>0 이면 `${base}?_r=${nonce}`. 조회 call site: `const partPersonsPath = useMemo(() => buildPartPersonsPath(selectedPartId || undefined, partsRefreshNonce), [...])` (L3574~3575), `const { data: partPersonData, ... } = useApiResource<PersonRow[]>(partPersonsPath)` (L3582~3586) — **옵션 인자 없음**(→ default GET). `PersonRow` 제네릭이 형제 `buildPartsPath`(→`PartRow[]`)와 자동 분리. (수정 0.)
- `web/src/api/useApiResource.ts` — `useApiResource(path)` 단일 인자 호출 → `options === undefined` → method 미지정 → `fetch` default **GET**. 또한 `path === null` 이면 미조회(idle) convention(L9~11) — 조건부 null 발사의 근거. (수정 0 — read-only hook.)
- `src/user/part.controller.ts` — 대조 대상 backend. `@Controller("api/parts")` (L50), `@Get(":id/persons")` + 핸들러 `findPersons(@Param("id") id): Promise<Person[]>` (L77~79) — **`@Param("id")` 1개, @Body/@Query 없음, 200 + Person 배열**. 같은 소스의 `@Get() findAll`(L63~64, 세그먼트 0)·`@Get(":id") findById`(L70~72, 세그먼트 1)는 GET-vs-GET 판별 대조군, `create @Post()`(L84)·`update @Patch(":id")`(L121 부근)·`delete @Delete(":id")` 는 method drift 대조군.

## Acceptance Criteria

신규 파일 `web/src/views/AdminView.part-persons-contract.test.ts` **1개만** 추가. 실 controller 소스(`part.controller.ts`)와 AdminView 소스를 `readFileSync` 로 라이브 로드하고, `buildPartPersonsPath` 를 import 해 실 경로를 계산한다(ADR-0040 §5 — RTL/jsdom 없음). 아래 R-112 4종 + negative 를 모두 cover.

- [ ] **happy-path (경로 정합)**: `buildPartPersonsPath("p1", 0)` 이 `/api/parts/p1/persons` 를 반환하고, 이 경로가 backend `@Get(":id/persons")` on `@Controller("api/parts")` 의 route template(`/api/parts/:id/persons`)와 정합(`diffContract` 가 `[]` — path-param 슬롯 위치·literal 세그먼트 일치).
- [ ] **happy-path (method 정합)**: web 발사 method 가 GET — AdminView 소스에서 `useApiResource<PersonRow[]>(partPersonsPath)` call site 가 **옵션 인자 없이** 호출됨(→ default GET)을 소스 대조로 검증하고, backend findPersons 핸들러가 `@Get`(POST/PATCH/DELETE 아님)임을 확인. 양측 method == GET.
- [ ] **happy-path (query 무해)**: `buildPartPersonsPath("p1", 5)` 가 `/api/parts/p1/persons?_r=5` 를 반환하되, `?` 앞 base 경로가 여전히 backend route 와 일치. `_r` 은 backend 가 `@Query` 미선언이라 무시하는 cache-buster 로 계약 drift 아님을 명시(추출기가 base 비교 시 query strip).
- [ ] **error path (추출기 무력화 방어)**: `ROUTE`/`method`/handler 추출이 하나도 비어있지 않음 검증. 빈 소스 입력 시 통과가 아니라 `'backend 계약 추출 실패'` 사유 1건 반환(대조가 통과하지 않음).
- [ ] **분기 — base 파싱**: `@Controller("api/parts")` 를 `/api/parts` 로 정규화.
- [ ] **분기 — path-param + literal 세그먼트 합성 (핵심 축)**: `@Get(":id/persons")` 를 base 와 합성해 `/api/parts/:id/persons` template 을 만들고, 세그먼트 정확히 2개(`:id` = path param 슬롯 1 + `persons` = literal 1)임을 검증. `buildPartPersonsPath("p1")` 의 `p1` 이 `:id` 슬롯에, `persons` literal 이 그대로 매칭됨.
- [ ] **분기 — 조건부 null 발사(idle)**: `buildPartPersonsPath(undefined)` / `buildPartPersonsPath("")` 가 `null` 반환 — 미선택 시 web 이 아예 발사하지 않음(useApiResource idle)을 계약 무위반으로 입증(파트 미선택은 drift 가 아니라 조회 부재).
- [ ] **분기 — path-param 인코딩**: `buildPartPersonsPath("a b/c")` 가 `encodeURIComponent` 로 `/api/parts/a%20b%2Fc/persons` 를 만들되, 인코딩 후에도 세그먼트 구조(param 1 + literal `persons`)가 유지돼 backend route 와 정합(인코딩된 param 값이 literal `persons` 세그먼트를 침범하지 않음).
- [ ] **분기 — 핸들러 인자**: `findPersons` 핸들러가 `@Param("id")` 1개를 갖고 `@Body`·`@Query` 는 하나도 갖지 않음(GET 조회는 body/query 계약 없음, path param 만).
- [ ] **분기 — 3-way GET 판별**: 같은 소스의 `@Get() findAll`(세그먼트 0)·`@Get(":id") findById`(세그먼트 1)를 web 발사(`/api/parts/:id/persons`, 세그먼트 2)에 대면 각각 path 불일치로 잡힘 — 추출기가 findPersons 를 findAll·findById 로 오축소/오확장하지 않음.
- [ ] **negative (a) base 오타**: backend base 를 `api/part`(단수) / `api/parts-x` 로 바꾸면 path 불일치로 잡힘.
- [ ] **negative (b) method drift**: findPersons 핸들러가 `@Post`/`@Patch`/`@Delete` 로 바뀌면 method 불일치로 잡힘(web 은 GET 발사).
- [ ] **negative (c) literal 세그먼트 drift**: `@Get(":id/persons")` 가 `@Get(":id/members")` / `@Get(":id")`(literal 제거) / `@Get("persons/:id")`(순서 뒤집힘) 으로 drift 시 path 불일치로 잡힘(literal 문자열·세그먼트 순서 정합 입증).
- [ ] **negative (d) query 를 path 세그먼트로 오인 방지**: 추출기가 `buildPartPersonsPath("p1", n>0)` 의 `?_r=n` query 를 path 세그먼트로 착각하지 않음 — query strip 후 base 만 비교하되, **진짜 세그먼트 drift**(negative c)는 여전히 잡힘.
- [ ] **negative (e) 인코딩된 param 을 세그먼트 경계로 오인 방지**: `encodeURIComponent` 로 인코딩된 `%2F`(슬래시) 를 추출기/대조기가 실 세그먼트 구분자로 오인하지 않음 — param 값 안의 인코딩 문자가 `persons` literal 세그먼트를 삼키거나 추가 세그먼트를 만들지 않음.
- [ ] **negative (f) 형제 GET 혼동**: `@Get() findAll` / `@Get(":id") findById` / mutation(`@Post`/`@Patch`/`@Delete`) 를 findPersons 핸들러로 오인하지 않음 — 추출기가 `@Get(":id/persons")` 를 정확히 선택.
- [ ] **negative (g) 주석 false-positive**: 주석 줄의 `@Get(...)`/`@Controller(...)`/`GET /api/parts/:id/persons` 문자열(본 소스 상단 주석에 존재)을 실 decorator 로 오인하지 않음(`stripComments` 방어).
- [ ] `pnpm --dir web test`(또는 web workspace vitest) 실측 통과 확인 — 위 모든 케이스 green. base/`@Get`/literal 세그먼트 변조 → fail → revert 로 guard 유효성 실증.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only 파일이라 커버리지 회귀 없음 확인.
- [ ] size gate: diff ≤ 300 LOC, 변경 파일 정확히 1개.

## Out of Scope

- production 코드(`AdminView.tsx`, `useApiResource.ts`, `apiClient.ts`, `part.controller.ts`) 및 기존 guard 파일 수정 **금지** — 신규 test 파일 1개만 추가.
- 신규 devDependency 추가 금지(정규식 추출기만 — 기존 vitest 사용).
- 파트 **단건 조회(GET /api/parts/:id, findById)** 계약 guard 는 본 task 범위 아님 — web 에 단건 GET call site 가 없어 대상 아님(3-way 판별 대조군으로만 참조).
- 그룹/사용자 목록 GET(`buildGroupsPath`/`buildUsersPath`) 계약 guard 는 본 task 범위 아님 — 후속 GET-list slice.
- export/import · schedule · reevaluate 계약 guard 는 본 task 범위 아님(PLAN P6 상 defer).
- **shared-helper 추출 refactor 는 여전히 Out of Scope** — `stripComments`/`extractControllerRoute`/`extractHandlerMethods`/`composeRoute`/`diffContract`/`stripQuery` 등이 23+ contract-guard test 파일에 중복됐지만, 공용 helper 추출은 별도 refactor slice(아래 Follow-up 유지 — 다수 파일 접촉 5-파일 cap 초과라 planner split 필요).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (carry-forward) contract-guard test 23+ 파일이 공유하는 정규식 추출기/대조기(`stripComments`, `extractControllerRoute`, `extractHandlerMethods`, `composeRoute`, `diffContract`, `stripQuery`)를 `web/src/views/__contract-guard__/` 공용 helper 로 추출하는 refactor slice — 중복 제거 + 단일 유지보수 지점. 파트 read 표면(목록 + 소속 인원)이 봉합된 시점이라 추출 ROI 재평가 적기. helper 추출 자체가 다수 파일을 건드려 5-파일 cap 초과 → planner split 필요.
- (후보) 그룹/사용자 목록 GET(`buildGroupsPath`/`buildUsersPath`) 계약 guard — 다-way GET 판별 축을 각 controller 로 mirror. 순차 slice.
- (후보) 그룹 소속 인원 조회(GET /api/groups/:id/persons, `buildGroupPersonsPath` 계열) 계약 guard — 본 task 의 path-param + literal 세그먼트 축을 그룹 자원으로 mirror.
