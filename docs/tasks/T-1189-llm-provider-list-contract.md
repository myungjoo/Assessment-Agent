---
id: T-1189
title: LLM provider 목록 조회 endpoint web↔backend 계약 drift-guard spec 추가 (GET /api/llm/providers · bare @Get() findAll vs @Get(":id") findById 판별 축 + ?_r nonce 무해)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-051, REQ-052, REQ-053, REQ-054, REQ-055, REQ-096]
estimatedDiff: 240
estimatedFiles: 1
created: 2026-07-24
independentStream: web-contract-guard
dependsOn: []
touchesFiles: [web/src/views/AdminView.llm-provider-list-contract.test.ts]
plannerNote: "P6 contract-guard arc 다음 slice — LLM provider 목록 조회(GET /api/llm/providers). T-1188 Follow-up 이 명시한 provider GET slice. T-1188 GET 패턴 mirror + 신규 축: bare @Get() findAll 을 @Get(':id') findById 대조군에서 판별."
---

# T-1189 — LLM provider 목록 조회 endpoint web↔backend 계약 drift-guard spec 추가

## Why

T-1188 이 난이도-모델 매핑 **조회(GET /api/llm/difficulty-mappings)** 계약 drift-guard 로 arc 의 첫 GET-side guard 를 완결하며, 자기 Follow-up 에서 "LLM provider **목록 조회(GET /api/llm/providers)** GET-side 계약 guard — 본 slice 의 GET 패턴(bare 발사·query-무해 축)을 `buildProvidersPath`/provider `@Get()` findAll 에 mirror" 를 명시했다. 본 task 가 그 slice 다. AdminView 는 provider 관리 화면 mount 시 `useApiResource<LlmProviderRow[]>(providersPath)` 로 provider 목록을 조회하고(③b), create/update/delete 성공 시 `providersRefreshNonce` 증가로 재조회를 유발한다(③c). 이 GET 발사가 backend `LlmProviderConfigController.findAll` (`@Get()` on `@Controller("api/llm/providers")`, 200 + `LlmProviderConfigView[]` — apiKey 제거 view, 빈 배열도 정상) 계약과 drift 없이 일치함을 test-only 로 고정한다. provider CRUD 3종(생성 T-1184 · 수정 T-1185 · 삭제 T-1186) 계약 guard 는 이미 shipped 됐고, 본 task 가 그 **read 측 대응** 을 채워 provider 계약 guard 를 완결한다.

본 slice 는 T-1188 GET 패턴(GET method · bare `@Get()` 세그먼트 0 · 핸들러 인자 0 · `?_r=nonce` cache-buster 무해)을 provider 로 mirror 하되, **T-1188 에 없던 신규 대조 축**을 커버한다: provider controller 는 같은 소스 안에 **두 개의 GET 핸들러** — `@Get()` findAll(목록) 과 `@Get(":id")` findById(단건) — 를 가진다(difficulty-mapping controller 는 `@Get()` 하나뿐이었음). 따라서 추출기가 web 목록 발사(bare base)에 대응하는 **`@Get()` findAll 을 `@Get(":id")` findById 대조군에서 정확히 판별** 해야 한다(세그먼트 0 GET 을 세그먼트 1 GET 과 혼동 금지). 이 GET-vs-GET path-param 판별이 본 slice 의 고유 대조점이다. (REQ-051~055 provider config CRUD 의 read 측 · REQ-096 Admin 가시성, ADR-0011 §2, api.md.)

## Required Reading

- `web/src/views/AdminView.difficulty-mapping-list-contract.test.ts` — **직전 GET slice 선례** (T-1188). 실 controller 소스 `readFileSync` 라이브 로드 + `stripComments`/`extractControllerRoute`/`extractHandlerMethods`/`composeRoute`/`diffContract` 정규식 추출기·대조기·negative(a~f) 구조를 그대로 차용. 본 task 는 대상을 difficulty-mappings 에서 providers 로 바꾼 mirror — GET method·bare `@Get()`·query-무해 축을 provider 로 재적용하고, **`@Get(":id")` findById 대조군 판별 축**(아래 negative g)을 추가.
- `web/src/views/AdminView.llm-provider-delete-contract.test.ts` — 형제 provider guard(T-1186, DELETE). provider controller 소스 로드 경로 · `LLM_PROVIDERS_PATH` 대조 방식의 provider 측 선례. 단 delete 는 mutation(`@Delete(":id")`+path param), 본 task 는 read(GET, bare base) 이므로 발사·핸들러 축이 다름.
- `web/src/views/AdminView.tsx` — `buildProvidersPath(refreshNonce)` (L672, `export` L4755) — nonce≤0 이면 base `LLM_PROVIDERS_PATH`(`/api/llm/providers`, L167) 그대로, nonce>0 이면 `${base}?_r=${nonce}` cache-buster(difficulty-mapping 의 `buildMappingsPath` 동형). 조회 call site: `const providersPath = useMemo(() => buildProvidersPath(providersRefreshNonce), [providersRefreshNonce])` (L3117), `const { data: ... } = useApiResource<LlmProviderRow[]>(providersPath)` (L3129) — **옵션 인자 없음**(→ default GET). `LlmProviderRow` type export L4807.
- `web/src/api/useApiResource.ts` — `useApiResource(path)` 를 단일 인자로 호출하면 `options === undefined` → `request` 에 method 미지정 → `fetch` default **GET**. 즉 web provider 목록 발사 method 는 GET convention. (수정 0 — read-only hook.)
- `src/llm/llm-provider-config.controller.ts` — 대조 대상 backend. `@Controller("api/llm/providers")` (L73), `@Get()` + 핸들러 `findAll(): Promise<LlmProviderConfigView[]>` (L91~95) — **인자 0, @Body/@Param/@Query 없음, controller 분기 없음(service raw forward, 404 변환 안 함), 200 + 배열(apiKey 제거 view)**. 같은 소스의 `@Get(":id") findById(@Param("id"))` (L106~109) 는 GET-vs-GET 판별 대조군, `create @Post()`(L124)·`update @Patch(":id")`(L145)·`delete @Delete(":id")`(L164) 는 method drift 대조군.

## Acceptance Criteria

신규 파일 `web/src/views/AdminView.llm-provider-list-contract.test.ts` **1개만** 추가. 실 controller 소스(`llm-provider-config.controller.ts`)와 AdminView 소스를 `readFileSync` 로 라이브 로드하고, `buildProvidersPath` 를 import 해 실 경로를 계산한다(ADR-0040 §5 — RTL/jsdom 없음). 아래 R-112 4종 + negative 를 모두 cover.

- [ ] **happy-path (경로 정합)**: `buildProvidersPath(0)` 이 `/api/llm/providers` 를 반환하고, 이 base 가 backend `@Get()` findAll on `@Controller("api/llm/providers")` 의 route 와 완전 일치 (`diffContract` 가 `[]`).
- [ ] **happy-path (method 정합)**: web 목록 발사 method 가 GET — AdminView 소스에서 `useApiResource<LlmProviderRow[]>(providersPath)` call site 가 **옵션 인자 없이** 호출됨(→ default GET)을 소스 대조로 검증하고, backend findAll 핸들러가 `@Get`(POST/PATCH/DELETE 아님)임을 확인. 양측 method == GET.
- [ ] **happy-path (query 무해)**: `buildProvidersPath(5)` 가 `/api/llm/providers?_r=5` 를 반환하되, `?` 앞 base 경로가 여전히 backend route 와 일치. `_r` 은 backend `@Get()` 가 `@Query` 미선언이라 무시하는 cache-buster 로, 계약 drift 가 아님을 명시(추출기가 base 비교 시 query 를 strip).
- [ ] **error path (추출기 무력화 방어)**: `ROUTE`/`method`/handler 추출이 하나도 비어있지 않음 검증. 빈 소스 입력 시 통과가 아니라 `'backend 계약 추출 실패'` 사유 1건 반환(대조가 통과하지 않음).
- [ ] **분기 — base 파싱**: `@Controller("api/llm/providers")` 를 `/api/llm/providers` 로 정규화.
- [ ] **분기 — bare @Get() 세그먼트 0 합성**: `@Get()`(인자 없음)를 base 와 합성해 `/api/llm/providers` template, 추가 세그먼트/path param 정확히 0 임을 검증.
- [ ] **분기 — 핸들러 인자 부재**: `findAll` 핸들러가 `@Body`·`@Param`·`@Query` 를 하나도 갖지 않음(`hasBody === false` 등) — GET 목록 조회는 body/param 계약 없음을 입증.
- [ ] **분기 — GET-vs-GET 판별 (신규 축)**: 같은 소스의 `@Get(":id") findById` 는 세그먼트 1 + `@Param("id")` 를 가짐 — 추출기가 web 목록 발사(bare base)에 대응하는 **`@Get()` findAll 을 선택** 하고 `@Get(":id") findById` 를 잘못 매칭하지 않음(세그먼트 0 GET vs 세그먼트 1 GET 판별)을 입증.
- [ ] **negative (a) base 오타**: backend base 를 `api/llm/provider`(단수) / `api/llm/providers-x` 로 바꾸면 path 불일치로 잡힘(404 예방).
- [ ] **negative (b) method drift**: findAll 핸들러가 `@Post`/`@Patch`/`@Delete` 로 바뀌면 method 불일치로 잡힘(web 은 GET 발사).
- [ ] **negative (c) 세그먼트 추가**: findAll 이 `@Get("all")` / `@Get(":id")`(세그먼트 1) 로 drift 시 path 불일치(web 은 bare base 발사).
- [ ] **negative (d) query 를 path 세그먼트로 오인 방지**: 추출기가 `buildProvidersPath(n>0)` 의 `?_r=n` query 를 path 세그먼트로 착각하지 않음 — query strip 후 base 만 비교하되, **진짜 추가 path 세그먼트**(negative c)는 여전히 잡힘(query 와 세그먼트를 구분함) 입증.
- [ ] **negative (e) mutation 대조군 혼동**: `create`(`@Post()`) / `update`(`@Patch(":id")`) / `delete`(`@Delete(":id")`) 를 GET 목록 핸들러로 오인하지 않음 — 추출기가 `@Get()` findAll 을 정확히 선택.
- [ ] **negative (f) 주석 false-positive**: 주석 줄의 `@Get()`/`@Controller(...)` 를 실 decorator 로 오인하지 않음(`stripComments` 방어) — 본 소스는 L8/L29 등 주석에 `GET /api/llm/providers` 문자열이 다수 존재하므로 이 방어가 특히 중요.
- [ ] **negative (g) findById 판별 실패 방지**: `@Get(":id") findById` 를 세그먼트 0 로 오축소하거나 `@Get()` findAll 로 병합하지 않음 — 두 GET 핸들러가 서로 다른 route(`/api/llm/providers` vs `/api/llm/providers/:id`)로 정확히 추출됨 입증.
- [ ] **negative (소스 유실)**: 빈 소스 입력 시 추출기가 null/`{}` 반환하고 대조가 통과하지 않음.
- [ ] `pnpm --dir web test`(또는 web workspace vitest) 실측 통과 확인 — 위 모든 케이스 green. base/`@Get` 변조 → fail → revert 로 guard 유효성 실증.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only 파일이라 커버리지 회귀 없음 확인.
- [ ] size gate: diff ≤ 300 LOC, 변경 파일 정확히 1개.

## Out of Scope

- production 코드(`AdminView.tsx`, `useApiResource.ts`, `apiClient.ts`, `llm-provider-config.controller.ts`) 및 기존 guard 파일 수정 **금지** — 신규 test 파일 1개만 추가.
- 신규 devDependency 추가 금지(정규식 추출기만 — 기존 vitest 사용).
- provider **단건 조회(GET /api/llm/providers/:id, findById)** 계약 guard 는 본 task 범위 아님 — web 이 목록 발사만 하고 단건 GET call site 가 없다면 guard 대상 아님. 본 task 는 목록(findAll) 만. findById 는 negative g 의 대조군으로만 참조.
- export/import(`runExport`/`runImport`) · schedule(`runTrigger`) · reevaluate(`runReEvaluate`) 계약 guard 는 본 task 범위 아님. SchedulePanel/ReEvaluationTriggerPanel 은 PLAN P6 상 backend-contract 미shipped 로 defer.
- **shared-helper 추출 refactor 는 여전히 Out of Scope** — `stripComments`/`extractControllerRoute`/`extractHandlerMethods`/`composeRoute`/`diffContract` 등이 20+ contract-guard test 파일에 중복됐지만, 공용 helper 추출은 별도 refactor slice(아래 Follow-up 유지).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (carry-forward) contract-guard test 20+ 파일이 공유하는 정규식 추출기/대조기(`stripComments`, `extractControllerRoute`, `extractHandlerMethods`, `composeRoute`, `diffContract`, `toFire`)를 `web/src/views/__contract-guard__/` 공용 helper 로 추출하는 refactor slice — 중복 제거 + 단일 유지보수 지점. provider CRUD+list · difficulty-mapping · person/group/part 등 주요 mutation/read 계약 guard 가 거의 완결된 시점이라 추출 ROI 재평가 적기. helper 추출 자체가 다수 파일을 건드려 5-파일 cap 을 넘으므로 planner 가 split 필요.
- (후보) provider **단건 조회(GET /api/llm/providers/:id, findById)** 계약 guard — web 에 단건 GET call site 가 도입되면 본 task 의 GET-vs-GET 판별 축을 findById 발사에 mirror.
