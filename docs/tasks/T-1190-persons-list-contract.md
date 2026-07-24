---
id: T-1190
title: 인원 목록 조회 endpoint web↔backend 계약 drift-guard spec 추가 (GET /api/persons · bare @Get() findActive vs @Get(":id") findOne 판별 축 + ?_r nonce 무해)
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-026, REQ-049]
estimatedDiff: 245
estimatedFiles: 1
created: 2026-07-24
independentStream: web-contract-guard
dependsOn: []
touchesFiles: [web/src/views/AdminView.persons-list-contract.test.ts]
plannerNote: "P6 contract-guard arc 다음 slice — 인원 목록 조회(GET /api/persons). T-1189 provider list GET 패턴 mirror. person CRUD(POST/PATCH/DELETE) guard 완결의 read 측 대응 + GET-vs-GET(findActive vs findOne) 판별 축."
---

# T-1190 — 인원 목록 조회 endpoint web↔backend 계약 drift-guard spec 추가

## Why

T-1189 가 LLM provider **목록 조회(GET /api/llm/providers)** 계약 drift-guard 로 provider 계약 guard 의 read 측을 완결하고, 그 과정에서 **bare `@Get()` findAll 을 `@Get(":id")` findById 대조군에서 판별** 하는 GET-vs-GET 축을 확립했다. 본 task 는 그 패턴을 **인원 목록 조회(GET /api/persons)** 로 mirror 해, 인원 자원의 계약 guard read 측을 채운다. 인원 CRUD mutation guard 3종(생성 T-1178 · 수정 T-1179 · 삭제 T-1180)은 이미 shipped 됐고, 본 task 가 그 **read 측 대응** 을 더해 인원 계약 guard 를 완결한다.

AdminView 는 인원 관리 섹션 mount 시 `useApiResource<PersonRow[]>(personsPath)` 로 인원 목록을 조회하고(L2658), 생성/수정/삭제 성공 시 `personsRefreshNonce` 증가로 재조회를 유발한다. 이 GET 발사가 backend `PersonController.findActive` (`@Get()` on `@Controller("api/persons")`, 200 + active 인원 `Person[]`, 빈 배열도 정상) 계약과 drift 없이 일치함을 test-only 로 고정한다.

본 slice 는 T-1189 GET 패턴(GET method · bare `@Get()` 세그먼트 0 · 핸들러 인자 0 · `?_r=nonce` cache-buster 무해)을 인원으로 mirror 하되, provider 와 동형의 **GET-vs-GET 판별 축** 을 커버한다: person controller 는 같은 소스에 **두 개의 GET 핸들러** — `@Get() findActive`(목록) 과 `@Get(":id") findOne`(단건) — 를 가진다. 따라서 추출기가 web 목록 발사(bare base)에 대응하는 **`@Get()` findActive 를 `@Get(":id") findOne` 대조군에서 정확히 판별** 해야 한다(세그먼트 0 GET 을 세그먼트 1 GET 과 혼동 금지). (REQ-026 인원 관리의 read 측 · REQ-049 Admin 가시성, api.md §3, ADR-0040/ADR-0041.)

## Required Reading

- `web/src/views/AdminView.llm-provider-list-contract.test.ts` — **직전 GET-list slice 선례** (T-1189). 실 controller 소스 `readFileSync` 라이브 로드 + `stripComments`/`extractControllerRoute`/`extractHandlerMethods`/`composeRoute`/`diffContract` 정규식 추출기·대조기·negative(a~g) 구조를 그대로 차용. 본 task 는 대상을 providers 에서 persons 로 바꾼 mirror — GET method·bare `@Get()`·query-무해·`@Get(":id")` 판별 축을 인원으로 재적용.
- `web/src/views/AdminView.difficulty-mapping-list-contract.test.ts` — GET-list arc 의 첫 선례(T-1188). bare `@Get()` 세그먼트 0 · 핸들러 인자 부재 · `?_r` nonce 무해 축의 원형 참조.
- `web/src/views/AdminView.person-delete-contract.test.ts` — 형제 person guard(T-1180). person controller 소스 로드 경로 · `PERSONS_PATH`(`/api/persons`) 대조 방식의 인원 측 선례. 단 delete 는 mutation(`@Delete(":id")`+path param), 본 task 는 read(GET, bare base) 이므로 발사·핸들러 축이 다름.
- `web/src/views/AdminView.tsx` — `buildPersonsPath(refreshNonce)` (L685, `export` L4756) — nonce≤0 이면 base `PERSONS_PATH`(`/api/persons`, L81) 그대로, nonce>0 이면 `${base}?_r=${nonce}` cache-buster(`buildProvidersPath` 동형). 조회 call site: `const personsPath = useMemo(() => buildPersonsPath(personsRefreshNonce), [...])` (L2645), `const { data: ... } = useApiResource<PersonRow[]>(personsPath)` (L2658) — **옵션 인자 없음**(→ default GET). `PersonRow` type import L56. (수정 0.)
- `web/src/api/useApiResource.ts` — `useApiResource(path)` 를 단일 인자로 호출하면 `options === undefined` → `request` 에 method 미지정 → `fetch` default **GET**. 즉 web 인원 목록 발사 method 는 GET convention. (수정 0 — read-only hook.)
- `src/user/person.controller.ts` — 대조 대상 backend. `@Controller("api/persons")` (L41), `@Get()` + 핸들러 `findActive(): Promise<Person[]>` (L53~54) — **인자 0, @Body/@Param/@Query 없음, 200 + active 인원 배열**. 같은 소스의 `@Get(":id") findOne(@Param("id"))` (L60~61) 는 GET-vs-GET 판별 대조군, `create @Post()`(L68)·`update @Patch(":id")`(L81)·`remove @Delete(":id")`(L91) 는 method drift 대조군.

## Acceptance Criteria

신규 파일 `web/src/views/AdminView.persons-list-contract.test.ts` **1개만** 추가. 실 controller 소스(`person.controller.ts`)와 AdminView 소스를 `readFileSync` 로 라이브 로드하고, `buildPersonsPath` 를 import 해 실 경로를 계산한다(ADR-0040 §5 — RTL/jsdom 없음). 아래 R-112 4종 + negative 를 모두 cover.

- [ ] **happy-path (경로 정합)**: `buildPersonsPath(0)` 이 `/api/persons` 를 반환하고, 이 base 가 backend `@Get()` findActive on `@Controller("api/persons")` 의 route 와 완전 일치 (`diffContract` 가 `[]`).
- [ ] **happy-path (method 정합)**: web 목록 발사 method 가 GET — AdminView 소스에서 `useApiResource<PersonRow[]>(personsPath)` call site 가 **옵션 인자 없이** 호출됨(→ default GET)을 소스 대조로 검증하고, backend findActive 핸들러가 `@Get`(POST/PATCH/DELETE 아님)임을 확인. 양측 method == GET.
- [ ] **happy-path (query 무해)**: `buildPersonsPath(5)` 가 `/api/persons?_r=5` 를 반환하되, `?` 앞 base 경로가 여전히 backend route 와 일치. `_r` 은 backend `@Get()` 가 `@Query` 미선언이라 무시하는 cache-buster 로, 계약 drift 가 아님을 명시(추출기가 base 비교 시 query 를 strip).
- [ ] **error path (추출기 무력화 방어)**: `ROUTE`/`method`/handler 추출이 하나도 비어있지 않음 검증. 빈 소스 입력 시 통과가 아니라 `'backend 계약 추출 실패'` 사유 1건 반환(대조가 통과하지 않음).
- [ ] **분기 — base 파싱**: `@Controller("api/persons")` 를 `/api/persons` 로 정규화.
- [ ] **분기 — bare @Get() 세그먼트 0 합성**: `@Get()`(인자 없음)를 base 와 합성해 `/api/persons` template, 추가 세그먼트/path param 정확히 0 임을 검증.
- [ ] **분기 — 핸들러 인자 부재**: `findActive` 핸들러가 `@Body`·`@Param`·`@Query` 를 하나도 갖지 않음(`hasBody === false` 등) — GET 목록 조회는 body/param 계약 없음을 입증.
- [ ] **분기 — GET-vs-GET 판별 (핵심 축)**: 같은 소스의 `@Get(":id") findOne` 은 세그먼트 1 + `@Param("id")` 를 가짐 — 추출기가 web 목록 발사(bare base)에 대응하는 **`@Get()` findActive 를 선택** 하고 `@Get(":id") findOne` 을 잘못 매칭하지 않음(세그먼트 0 GET vs 세그먼트 1 GET 판별)을 입증.
- [ ] **negative (a) base 오타**: backend base 를 `api/person`(단수) / `api/persons-x` 로 바꾸면 path 불일치로 잡힘(404 예방).
- [ ] **negative (b) method drift**: findActive 핸들러가 `@Post`/`@Patch`/`@Delete` 로 바뀌면 method 불일치로 잡힘(web 은 GET 발사).
- [ ] **negative (c) 세그먼트 추가**: findActive 가 `@Get("all")` / `@Get(":id")`(세그먼트 1) 로 drift 시 path 불일치(web 은 bare base 발사).
- [ ] **negative (d) query 를 path 세그먼트로 오인 방지**: 추출기가 `buildPersonsPath(n>0)` 의 `?_r=n` query 를 path 세그먼트로 착각하지 않음 — query strip 후 base 만 비교하되, **진짜 추가 path 세그먼트**(negative c)는 여전히 잡힘(query 와 세그먼트를 구분함) 입증.
- [ ] **negative (e) mutation 대조군 혼동**: `create`(`@Post()`) / `update`(`@Patch(":id")`) / `remove`(`@Delete(":id")`) 를 GET 목록 핸들러로 오인하지 않음 — 추출기가 `@Get()` findActive 를 정확히 선택.
- [ ] **negative (f) 주석 false-positive**: 주석 줄의 `@Get()`/`@Controller(...)`/`GET /api/persons` 문자열(본 소스 L1~10 주석에 다수 존재)을 실 decorator 로 오인하지 않음(`stripComments` 방어).
- [ ] **negative (g) findOne 판별 실패 방지**: `@Get(":id") findOne` 을 세그먼트 0 로 오축소하거나 `@Get()` findActive 로 병합하지 않음 — 두 GET 핸들러가 서로 다른 route(`/api/persons` vs `/api/persons/:id`)로 정확히 추출됨 입증.
- [ ] `pnpm --dir web test`(또는 web workspace vitest) 실측 통과 확인 — 위 모든 케이스 green. base/`@Get` 변조 → fail → revert 로 guard 유효성 실증.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only 파일이라 커버리지 회귀 없음 확인.
- [ ] size gate: diff ≤ 300 LOC, 변경 파일 정확히 1개.

## Out of Scope

- production 코드(`AdminView.tsx`, `useApiResource.ts`, `apiClient.ts`, `person.controller.ts`) 및 기존 guard 파일 수정 **금지** — 신규 test 파일 1개만 추가.
- 신규 devDependency 추가 금지(정규식 추출기만 — 기존 vitest 사용).
- 인원 **단건 조회(GET /api/persons/:id, findOne)** 계약 guard 는 본 task 범위 아님 — web 이 목록 발사만 하고 단건 GET call site 가 없으므로 guard 대상 아님. findOne 은 negative g 의 대조군으로만 참조.
- 그룹/파트/사용자 목록 GET(`buildGroupsPath`/`buildPartsPath`/`buildUsersPath`) · 그룹 멤버/파트 인원 GET(`buildGroupMembersPath`/`buildPartPersonsPath`) · `AUTH_ME_PATH` 계약 guard 는 본 task 범위 아님 — 후속 GET-list slice 로 순차 확산.
- export/import · schedule · reevaluate 계약 guard 는 본 task 범위 아님(PLAN P6 상 SchedulePanel/ReEvaluationTriggerPanel defer).
- **shared-helper 추출 refactor 는 여전히 Out of Scope** — `stripComments`/`extractControllerRoute`/`extractHandlerMethods`/`composeRoute`/`diffContract` 등이 20+ contract-guard test 파일에 중복됐지만, 공용 helper 추출은 별도 refactor slice(아래 Follow-up 유지).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (carry-forward) contract-guard test 21+ 파일이 공유하는 정규식 추출기/대조기(`stripComments`, `extractControllerRoute`, `extractHandlerMethods`, `composeRoute`, `diffContract`, `toFire`)를 `web/src/views/__contract-guard__/` 공용 helper 로 추출하는 refactor slice — 중복 제거 + 단일 유지보수 지점. 주요 mutation/read 계약 guard 가 거의 완결된 시점이라 추출 ROI 재평가 적기. helper 추출 자체가 다수 파일을 건드려 5-파일 cap 을 넘으므로 planner 가 split 필요.
- (후보) 그룹/파트/사용자 목록 GET(`buildGroupsPath`/`buildPartsPath`/`buildUsersPath`) 계약 guard — 본 task 의 GET-vs-GET(findActive/findAll vs findOne/findById) 판별 축을 각 controller 로 mirror. 순차 slice.
- (후보) 인원 **단건 조회(GET /api/persons/:id, findOne)** 계약 guard — web 에 단건 GET call site 가 도입되면 본 task 의 GET-vs-GET 판별 축을 findOne 발사에 mirror.
