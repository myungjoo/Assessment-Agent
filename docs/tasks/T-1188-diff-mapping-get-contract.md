---
id: T-1188
title: 난이도-모델 매핑 조회 endpoint web↔backend 계약 drift-guard spec 추가
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-049, REQ-050, REQ-096]
estimatedDiff: 230
estimatedFiles: 1
created: 2026-07-24
independentStream: web-contract-guard
dependsOn: []
touchesFiles: [web/src/views/AdminView.difficulty-mapping-list-contract.test.ts]
plannerNote: "P6 contract-guard arc 다음 slice — 난이도-모델 매핑 조회(GET /api/llm/difficulty-mappings). T-1187 Out of Scope 가 명시한 GET Follow-up. arc 첫 GET-side guard(bare @Get·body/param 없음·?_r nonce 무해 축)."
---

# T-1188 — 난이도-모델 매핑 조회 endpoint web↔backend 계약 drift-guard spec 추가

## Why

T-1187 이 난이도-모델 매핑 **지정(PATCH /api/llm/difficulty-mappings/:difficulty)** 계약 drift-guard 를 완결하며, 자기 Out of Scope 에서 "난이도-모델 매핑 **조회(GET)** 계약 guard 는 별도 slice — 필요 시 Follow-up" 을 명시했다. 본 task 가 그 GET slice 다. DifficultyModelSelector 는 mount 시 `useApiResource(buildMappingsPath(refreshNonce))` 로 3 슬롯 매핑을 조회(④b)하고, PATCH 성공 시 `refreshNonce` 증가로 재조회를 유발한다(④c). 이 GET 발사가 backend `DifficultyMappingController.findAll` (`@Get()` on `@Controller("api/llm/difficulty-mappings")`, 200 + `DifficultyMapping[]`, 빈 배열도 정상) 계약과 drift 없이 일치함을 test-only 로 고정한다.

본 slice 는 arc 의 **첫 GET-side contract guard** 로 새 대조 축을 커버한다: (1) **GET method** (기존 arc 는 전부 POST/PATCH/DELETE 발사) — web 은 `useApiResource(mappingsPath)` 를 옵션 없이 호출해 `request`→`fetch` 의 default GET 으로 발사, (2) **bare `@Get()` — path 세그먼트 0** (base route 만, `:id`/`:difficulty` path param 없음), (3) **핸들러 인자 0** — `findAll` 은 `@Body`/`@Param`/`@Query` 를 하나도 받지 않음, (4) **`?_r=nonce` cache-buster query 무해성** — `buildMappingsPath(n>0)` 이 붙이는 `_r` 쿼리는 backend `@Get()` 가 `@Query` 미선언이라 무시하며, 이는 drift 가 아니라 정상(부수효과 0, api.md 119). 이 query-무해 축이 본 slice 의 고유 대조점이다. (REQ-096 Admin 가시성/조회, REQ-049·050 난이도↔model 매핑, ADR-0011 §2.)

## Required Reading

- `web/src/views/AdminView.difficulty-mapping-assign-contract.test.ts` — **직전 slice 선례** (T-1187). 실 controller 소스 `readFileSync` 라이브 로드 + `stripComments`/`extractControllerRoute`/`extractHandlerMethods`/`composeRoute`/`diffContract` 정규식 추출기·대조기·negative(a~h) 구조를 그대로 차용. 본 task 는 발사를 mutation(PATCH+body)에서 read(GET, no body)로 바꾼 mirror — path param/body 대조 축을 제거하고 method=GET·bare `@Get()`·query-무해 축으로 대체.
- `web/src/views/AdminView.tsx` — `buildMappingsPath(refreshNonce)` (L659, `export` L4754) — nonce≤0 이면 base `LLM_MAPPINGS_PATH`(`/api/llm/difficulty-mappings`, L170) 그대로, nonce>0 이면 `${base}?_r=${nonce}` cache-buster. 조회 call site: `const { data: mappingData } = useApiResource<DifficultyMappingRow[]>(mappingsPath)` (L3239 부근) — **옵션 인자 없음**(→ default GET). `mappingsPath = useMemo(() => buildMappingsPath(refreshNonce), [refreshNonce])`.
- `web/src/api/useApiResource.ts` — `runFetch(path, options, ...)` (L52) → `request<T>(path, options)`. `useApiResource(path)` 를 단일 인자로 호출하면 `options === undefined` → `request` 에 method 미지정 → `fetch` default **GET**. 즉 web 조회 발사 method 는 GET convention. (수정 0 — read-only hook.)
- `web/src/api/apiClient.ts` — `fetchWithRefresh` (L52~) 가 `fetch(path, { ...init, credentials })` — `init.method` 부재 시 fetch 표준 default GET. web 조회가 명시 method override 없음을 뒷받침.
- `src/llm/difficulty-mapping.controller.ts` — 대조 대상 backend. `@Controller("api/llm/difficulty-mappings")` (L58), `@Get()` + 핸들러 `findAll(): Promise<DifficultyMapping[]>` (L75~79) — **인자 0, @Body/@Param/@Query 없음, controller 분기 없음(service raw forward), 200 + 배열**. 같은 소스의 `assign` 핸들러(`@Patch(":difficulty")` + `@Body`)는 대조군.

## Acceptance Criteria

신규 파일 `web/src/views/AdminView.difficulty-mapping-list-contract.test.ts` **1개만** 추가. 실 controller 소스(`difficulty-mapping.controller.ts`)와 AdminView 소스를 `readFileSync` 로 라이브 로드하고, `buildMappingsPath` 를 import 해 실 경로를 계산한다(ADR-0040 §5 — RTL/jsdom 없음). 아래 R-112 4종 + negative 를 모두 cover.

- [ ] **happy-path (경로 정합)**: `buildMappingsPath(0)` 이 `/api/llm/difficulty-mappings` 를 반환하고, 이 base 가 backend `@Get()` on `@Controller("api/llm/difficulty-mappings")` 의 route 와 완전 일치 (`diffContract` 가 `[]`).
- [ ] **happy-path (method 정합)**: web 조회 발사 method 가 GET — AdminView 소스에서 `useApiResource<DifficultyMappingRow[]>(mappingsPath)` call site 가 **옵션 인자 없이** 호출됨(→ default GET)을 소스 대조로 검증하고, backend 핸들러가 `@Get`(POST/PATCH/DELETE 아님)임을 확인. 양측 method == GET.
- [ ] **happy-path (query 무해)**: `buildMappingsPath(3)` 이 `/api/llm/difficulty-mappings?_r=3` 을 반환하되, `?` 앞 base 경로가 여전히 backend route 와 일치. `_r` 은 backend `@Get()` 가 `@Query` 미선언이라 무시하는 cache-buster 로, 계약 drift 가 아님을 명시(추출기가 base 비교 시 query 를 strip).
- [ ] **error path (추출기 무력화 방어)**: `ROUTE`/`method`/handler 추출이 하나도 비어있지 않음 검증. 빈 소스 입력 시 통과가 아니라 `'backend 계약 추출 실패'` 사유 1건 반환(대조가 통과하지 않음).
- [ ] **분기 — base 파싱**: `@Controller("api/llm/difficulty-mappings")` 를 `/api/llm/difficulty-mappings` 로 정규화.
- [ ] **분기 — bare @Get() 세그먼트 0 합성**: `@Get()`(인자 없음)를 base 와 합성해 `/api/llm/difficulty-mappings` template, 추가 세그먼트/path param 정확히 0 임을 검증.
- [ ] **분기 — 핸들러 인자 부재**: `findAll` 핸들러가 `@Body`·`@Param`·`@Query` 를 하나도 갖지 않음(`hasBody === false` 등) — GET 조회는 body/param 계약 없음을 입증.
- [ ] **분기 — @Body 존재 대조군**: 같은 소스의 `assign` 핸들러는 `@Body`/`:difficulty` param 을 가짐 — 추출기가 findAll 의 인자-부재를 실제로 구분함(대조군 혼동 없음) 입증.
- [ ] **negative (a) base 오타**: backend base 를 `api/llm/difficulty-mapping`(단수) / `api/llm/difficulty-mappings-x` 로 바꾸면 path 불일치로 잡힘(404 예방).
- [ ] **negative (b) method drift**: backend 가 `@Post`/`@Patch`/`@Delete` 로 바뀌면 method 불일치로 잡힘(web 은 GET 발사).
- [ ] **negative (c) 세그먼트 추가**: `@Get(":difficulty")` / `@Get("all")`(세그먼트 1) 로 drift 시 path 불일치(web 은 bare base 발사).
- [ ] **negative (d) query 를 path 세그먼트로 오인 방지**: 추출기가 `buildMappingsPath(n>0)` 의 `?_r=n` query 를 path 세그먼트로 착각하지 않음 — query strip 후 base 만 비교하되, **진짜 추가 path 세그먼트**(negative c)는 여전히 잡힘(query 와 세그먼트를 구분함) 입증.
- [ ] **negative (e) 대조군 핸들러 혼동**: `assign`(`@Patch(":difficulty")`) 을 GET 핸들러로 오인하지 않음 — 추출기가 `@Get()` findAll 을 정확히 선택.
- [ ] **negative (f) 주석 false-positive**: 주석 줄의 `@Get()`/`@Controller(...)` 를 실 decorator 로 오인하지 않음(`stripComments` 방어).
- [ ] **negative (소스 유실)**: 빈 소스 입력 시 추출기가 null/`{}` 반환하고 대조가 통과하지 않음.
- [ ] `pnpm --dir web test`(또는 web workspace vitest) 실측 통과 확인 — 위 모든 케이스 green. base/`@Get` 변조 → fail → revert 로 guard 유효성 실증.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only 파일이라 커버리지 회귀 없음 확인.
- [ ] size gate: diff ≤ 300 LOC, 변경 파일 정확히 1개.

## Out of Scope

- production 코드(`AdminView.tsx`, `useApiResource.ts`, `apiClient.ts`, `difficulty-mapping.controller.ts`) 및 기존 guard 파일 수정 **금지** — 신규 test 파일 1개만 추가.
- 신규 devDependency 추가 금지(정규식 추출기만 — 기존 vitest 사용).
- LLM provider **목록 조회(GET /api/llm/providers, buildProvidersPath)** 계약 guard 는 본 task 범위 아님(별도 slice — 필요 시 Follow-up). 본 task 는 difficulty-mappings GET 만.
- export/import(`runExport`/`runImport`) · schedule(`runTrigger`) · reevaluate(`runReEvaluate`) 계약 guard 는 본 task 범위 아님. SchedulePanel/ReEvaluationTriggerPanel 은 PLAN P6 상 backend-contract 미shipped 로 defer — 계약 guard 대상 아님.
- **shared-helper 추출 refactor 는 여전히 Out of Scope** — `stripComments`/`extractControllerRoute`/`extractHandlerMethods`/`composeRoute`/`diffContract` 등이 19+ contract-guard test 파일에 중복됐지만, 공용 helper 추출은 별도 refactor slice(아래 Follow-up 후보 유지).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (carry-forward) contract-guard test 19+ 파일이 공유하는 정규식 추출기/대조기(`stripComments`, `extractControllerRoute`, `extractHandlerMethods`, `composeRoute`, `diffContract`, `toFire`)를 `web/src/views/__contract-guard__/` 공용 helper 로 추출하는 refactor slice — 중복 제거 + 단일 유지보수 지점. AdminView 주요 mutation/read 계약 guard 가 거의 완결된 시점이라 추출 ROI 재평가 적기. helper 추출 자체가 다수 파일을 건드려 5-파일 cap 을 넘으므로 planner 가 split 필요.
- (후보) LLM provider **목록 조회(GET /api/llm/providers)** GET-side 계약 guard — 본 task 의 GET 패턴(bare 발사·query-무해 축)을 `buildProvidersPath`/provider `@Get()` findAll 에 mirror.

## Result (2026-07-24 DONE)

PR #1080 머지(squash `696d0494`, 4-게이트 round1 APPROVE). test-only 1파일 `web/src/views/AdminView.difficulty-mapping-list-contract.test.ts` (+228 LOC, 20 신규 test green). GET method·bare `@Get()` 세그먼트 0·핸들러 인자 0·`?_r` nonce cache-buster 무해성 축 커버. negative (a)base 오타 (b)method drift (c)세그먼트 추가 (d)query vs 세그먼트 구분 (e)대조군 혼동 (f)주석 false-positive + 소스 유실/발사 override drift 방어. web vitest 49파일 1547 tests green, tsc+build+lint green. main post-merge CI(696d0494) green. counters 1178→1179. claim prune([]).
