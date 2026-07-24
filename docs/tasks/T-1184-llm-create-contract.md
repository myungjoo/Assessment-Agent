---
id: T-1184
title: LLM provider 생성 endpoint web↔backend 계약 drift-guard spec (POST /api/llm/providers · api/llm/providers 신규 3-세그먼트 base + bare @Post() 세그먼트0 합성 + CreateLlmProviderConfigDto 4 required 부분집합 + POST body 존재 축)
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-096]
estimatedDiff: 290
estimatedFiles: 1
created: 2026-07-24
independentStream: web-admin-user
dependsOn: []
touchesFiles:
  - web/src/views/AdminView.llm-provider-create-contract.test.ts
plannerNote: P6 line120 Admin 패널 — T-1183 Out of Scope 예약 "LLM provider mutation(POST/DELETE /api/llm/providers)로 guard 확산" 첫 대상. api/llm/providers 신규 3-세그먼트 base + bare @Post() 세그먼트0 합성 + CreateLlmProviderConfigDto 4 required 부분집합 축. test-only pr 1파일 disjoint 동시 claim 안전
---

# T-1184 — LLM provider 생성 endpoint web↔backend 계약 drift-guard spec

## Why

PLAN.md P6 line 120 (Admin 패널) 인원·그룹·파트·LLM provider 관리 arc 의 후속 slice 다. web↔backend 계약 drift-guard 패턴이 인스턴스 접근(T-1169/T-1170) → 역할 변경(T-1171) → 사용자 생성(T-1172) → 그룹 멤버 추가/제거(T-1173/T-1174) → 그룹 생성/수정/삭제(T-1175/T-1176/T-1177) → 인원 생성/수정/삭제(T-1178/T-1179/T-1180) → 파트 생성/수정/삭제(T-1181/T-1182/T-1183) 15 slice 를 거쳐 안정됐다. T-1183 Out of Scope 는 "LLM provider mutation(`POST/DELETE /api/llm/providers`)로 guard 확산 — 본 slice 로 파트 CRUD(생성·수정·삭제) 3 endpoint 를 완결. 이후 확산 대상은 별도 slice" 를 **명시적으로 예약**했으며, 그 예약의 **첫 대상**이 LLM provider 생성 endpoint 다. 본 task 는 그 예약을 실행해 LLM provider CRUD 계약 guard 확산의 첫 slice(생성 POST)를 완결한다.

LLM provider 생성은 web `runCreateProvider` 러너(`AdminView.tsx` 1409~1450)가 발사하고 backend `LlmProviderConfigController.create`(`@Controller("api/llm/providers")` base + bare `@Post()`, `@Body() CreateLlmProviderConfigDto`, 201 Created 반환)가 받는다. 이 경로는 앞선 15 slice 와 같은 silent-drift 위험(backend 가 route/method/body 계약을 바꿔도 web unit test 가 green 유지 → 런타임 404/405/400)을 가지며, 다음 축을 대조한다 — 특히 **LLM provider 도메인 POST 에서의 신규 대조 포인트**를 담는다:

1. **`api/llm/providers` 신규 3-세그먼트 base + bare `@Post()` 세그먼트0 합성 — guard arc 최초의 다중-세그먼트 base** — backend `@Controller("api/llm/providers")` base 와 bare `@Post()`(인자 없음, 세그먼트 0)를 합성하면 최종 template 은 `/api/llm/providers`(path param **0개**, 세그먼트 **3개**)다. 앞선 도메인 base 는 전부 단일 세그먼트(`api/parts`·`api/persons`·`api/groups`·`api/users`)였으므로 본 task 는 **3-세그먼트 base(`api/llm/providers`)를 처음 대조**한다(신규 base shape). bare `@Post()` 자체는 T-1181(part create)·T-1178(person create)·T-1175(group create)·T-1172(user create)가 이미 검증한 세그먼트0 합성이며 본 task 는 그 shape 를 3-세그먼트 base 에 처음 결합한다. web 러너는 `LLM_PROVIDERS_PATH`(= `/api/llm/providers`, L167) 상수를 그대로 발사(path param 없음)한다. backend 가 base 를 `api/llm/provider`(오타)/`api/providers`(세그먼트 축소)/`api/llm/provider-configs` 로 바꾸거나 `@Post(":id")` 처럼 세그먼트를 추가하면 fail 한다.
2. **POST + body/Content-Type 존재 — CreateLlmProviderConfigDto 4 required 부분집합 (guard arc 최대 required 필드 수)** — 이게 본 slice 의 **가장 큰 대조**다. web 발사 `init` 은 `{ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, endpointUrl, apiKey, modelId }) }`(L1433~1438)로 **4 필드 body 를 전송**한다. backend `create(@Body() dto: CreateLlmProviderConfigDto)` 의 DTO 는 `provider`·`endpointUrl`·`apiKey`·`modelId` **4 필드 전부 `@IsString` + `@IsNotEmpty`(required)** 다(`src/llm/dto/create-llm-provider-config.dto.ts`). 앞선 create slice 의 required subset 은 그룹·파트(1 필드)·인원(2 필드)·사용자(다수)였으므로 본 task 는 **4 required 필드 부분집합**을 대조한다(arc 최대 required 개수). 대조는 "web 발사 body 필드 집합 ⊇ backend required 필드 집합(provider·endpointUrl·apiKey·modelId 4개 모두)" 형태다. backend 가 required 필드를 추가(예: `region`)하거나 web 이 4 필드 중 하나를 빠뜨리면 fail 한다. (참고: `apiKey` 는 body 에 평문 포함되나 **응답측 redaction·encrypt-at-rest 대조는 요청 계약 harness 경계 밖** — Out of Scope 참조. 여기서는 요청 body 필드 집합만 대조한다.)
3. **POST method + body/Content-Type 존재** — web `init.method === 'POST'` 와 backend `@Post` decorator 의 정합, 그리고 web `init.headers['Content-Type'] === 'application/json'` + `body` 존재를 대조한다. backend 가 method 를 바꾸거나(`@Patch`/`@Put`/`@Delete`) web 이 다른 method 를 발사하거나 body/Content-Type 를 누락하면 fail 한다.

본 task 는 **신규 test 파일 1개만** 추가하며 production 소스(`AdminView.tsx` · `src/llm/**`)를 건드리지 않는다. 신규 파일이라 기존 15 guard 파일들과도 disjoint → fineGrainedConcurrency(stage 5b) 하에서 동시 claim 안전하다.

## Required Reading

- `web/src/views/AdminView.part-create-contract.test.ts`(= T-1181 이 만든 **bare `@Post()` 세그먼트0 합성 + required body 부분집합 + POST body/Content-Type 존재** 선례 guard spec) 전체 — bare `@Post()` 세그먼트0 route 합성 대조 · required body 부분집합 판정 · POST body/Content-Type 존재 대조 · `options` 캡처 로직 · 주석 false-positive 방어 로직을 **읽어 패턴만 차용**하고 **수정하지 않는다**(파일-disjoint 유지). T-1181 은 `api/parts` 단일-세그먼트 base + 1 required(`name`)였으므로 본 task 는 **`api/llm/providers` 3-세그먼트 base + 4 required(provider·endpointUrl·apiKey·modelId)** 로 base 문자열과 required 필드 집합만 조정한다(method/세그먼트0 shape 는 동일). 로컬 함수는 새 파일에 compact 하게 다시 둔다(YAGNI — 공용 helper 추출은 아래 Out of Scope 대로 별도 slice). 실제 파일명은 `git ls-files web/src/views/` 로 확인.
- `web/src/views/AdminView.person-create-contract.test.ts`(= T-1178 이 만든 `api/persons` base + bare `@Post()` + 2 required(`fullName`·`email`) 부분집합 선례) — **다중 required 필드 부분집합 대조**의 가장 가까운 선례(2 required → 본 task 4 required 로 확장). required 필드 집합 파싱·부분집합 판정 로직만 차용하고 필드 목록을 4개로 조정.
- `web/src/views/AdminView.tsx` 1409~1450행 `runCreateProvider` — mock deps(`create`/`describeError`/`creating`/`setCreating`/`setCreateError`/`bumpRefresh`/`resetInput`)로 호출해 실 발사 `path`(`LLM_PROVIDERS_PATH` = `/api/llm/providers`, L167)/`method`(`POST`)/`options`(headers `Content-Type: application/json` + body `JSON.stringify({ provider, endpointUrl, apiKey, modelId })`, L1433~1438)를 캡처하는 대상. 4 필드 중 하나라도 빈/공백이거나 `creating` 중이면 미발사(가드) — happy-path 는 유효 4 필드 발사 케이스로 캡처.
- `src/llm/llm-provider-config.controller.ts` 73행 `@Controller("api/llm/providers")` base + 124~128행 bare `@Post()` + `@Body() dto: CreateLlmProviderConfigDto` (핸들러 이름 `create`, 201 Created). base(`api/llm/providers`, 3 세그먼트)와 bare `@Post()`(세그먼트 0)를 합성해 최종 template `/api/llm/providers`(path param 0)로 정규화하는 것이 route 대조의 핵심.
- `src/llm/dto/create-llm-provider-config.dto.ts` — `CreateLlmProviderConfigDto` 4 필드(`provider`·`endpointUrl`·`apiKey`·`modelId`) 전부 `@IsString` + `@IsNotEmpty`(required)임을 확인. required 필드 집합 대조의 근거.

## Acceptance Criteria

- [ ] **base + bare `@Post()` route 합성 대조**: backend 소스에서 `@Controller("api/llm/providers")` base 와 bare `@Post()` decorator 를 파싱·합성해 최종 template `/api/llm/providers`(path param **0개**, 세그먼트 **3개**)로 정규화하고, web `runCreateProvider` 발사 path(`LLM_PROVIDERS_PATH` → `/api/llm/providers`)/method(`POST`)와 대조한다. base 가 정확히 `api/llm/providers`(3 세그먼트) 이고 `@Post()` 가 세그먼트 0(path param 없음)임을 명시 검증 — backend 가 `@Post(":id")`(세그먼트 추가) 또는 base 를 `api/llm/provider`(오타)/`api/providers`(세그먼트 축소) 로 바꾸면 fail.
- [ ] **CreateLlmProviderConfigDto 4 required 부분집합 대조**: backend DTO 에서 required 필드 집합(`provider`·`endpointUrl`·`apiKey`·`modelId` 4개)을 추출하고, web 발사 body 필드 집합이 그 required 집합을 **모두 포함(⊇)**함을 대조한다. backend 가 required 필드를 추가(예: `region`)하거나 web 이 4 필드 중 하나를 빠뜨리면 fail.
- [ ] **POST body/Content-Type 존재 대조**: web 발사 `init` 에 `method: 'POST'` + `headers['Content-Type'] === 'application/json'` + `body`(JSON 문자열)가 **존재**함을 대조한다. backend `create` 핸들러가 `@Body()` decorator 를 가진 body-수신 핸들러임을 소스에서 추출해 정합 검증한다(T-1181 POST body 존재 축과 정합). backend 가 `@Body` 를 제거하거나 web 이 body/Content-Type 를 누락하면 fail.
- [ ] **POST method 대조**: web 발사 method(`POST`)와 backend `@Post` decorator 종류가 정합함을 대조한다. backend method 가 `@Patch`/`@Put`/`@Delete`/`@Get` 로 바뀌거나 web 이 다른 method 를 발사하면 fail.
- [ ] **Happy-path test 1+**: 현재 backend(`@Controller("api/llm/providers")` + bare `@Post()` + `@Body() CreateLlmProviderConfigDto` 4 required) 상태에서 web `runCreateProvider` 발사(유효 4 필드)가 route/method/body/required 부분집합 대조를 모두 통과함을 검증(정상 계약이 green).
- [ ] **Error path test 1+**: 추출기가 빈 집합/`null` 을 반환하는 입력(빈 소스 등)에서 대조가 조용히 통과하지 않고 선단언으로 fail 함을 유지·검증(guard 무력화 방어).
- [ ] **분기 cover**: 각 새 분기를 test 로 나눈다 — (1) 3-세그먼트 base route 파싱분기(`@Controller("api/llm/providers")` → `/api/llm/providers`) 1 test, (2) bare `@Post()` 세그먼트0 합성분기(path param 0) 1 test, (3) DTO 4 required 필드 집합 추출분기 1 test, (4) web `options` → method/body/Content-Type 매핑분기 1 test.
- [ ] **Negative cases 충분 cover** — 각 1+ test: (a) backend 가 base 를 `api/llm/provider`(오타)/`api/providers`(세그먼트 축소) 로 바꿈 → base route 불일치 fail, (b) backend 가 bare `@Post()` 를 `@Post(":id")`(세그먼트 추가, path param 1) 로 바꿈 → route 세그먼트 초과 불일치 fail, (c) backend 가 method 를 `@Patch()`/`@Delete()` 로 바꿨는데 web 은 POST 발사 → method 불일치 fail, (d) backend 가 required 필드를 추가(예: `region`)했는데 web body 는 4 필드만 → required 부분집합 위반 fail, (e) web 이 4 required 필드 중 하나(예: `modelId`)를 누락 → required 부분집합 위반 fail, (f) web 이 `Content-Type` 헤더 또는 `body` 를 누락 → POST body 존재 대조 fail, (g) backend 가 `@Body` decorator 를 제거 → body-수신 정합 위반 fail, (h) 주석 줄에만 `@Post(...)`/`@Controller(...)` 문자열이 있고 실 decorator 가 없는 가짜 소스는 method/base 추출 실패로 판정(주석 false-positive 방어).
- [ ] **실측 확인**: 구현자는 backend base(`api/llm/providers`→`api/llm/provider`) 또는 bare `@Post()`→`@Post(":id")`(세그먼트 추가) 또는 DTO required 필드 추가 중 하나를 임시 변경해 guard 가 실제로 fail 하는 것을 최소 1회 확인한 뒤 되돌린다(되돌림 후 green 상태로 commit).
- [ ] `pnpm --dir web test` (vitest) 전체 green + `pnpm --dir web build` (tsc + vite) green. 루트 `pnpm lint` clean.
- [ ] `pnpm test:cov` 기준선 유지 — 본 task 는 `src/` 를 건드리지 않으므로 backend coverage(line ≥ 80% / function ≥ 80%)가 그대로 통과해야 한다.
- [ ] **사이즈 게이트** — 최종 diff ≤ 300 LOC / 파일 1개. 초과 예상 시 negative case 를 `it.each` 표로 합치고 추출기 주석을 선례(T-1181/T-1178) 참조 한 줄로 압축한다. **test 항목 자체를 빼서 줄이지 말 것**(R-112 위반).

## Out of Scope

- `web/src/views/AdminView.tsx` · 기존 guard spec 파일들(instance-access · role-change · create-user · group-member-add · group-member-remove · group-create · group-update · group-delete · person-create · person-update · person-delete · part-create · part-update · part-delete contract test) · `src/llm/**` 등 **기존 파일 수정 전면 금지** — 본 slice 는 신규 파일 1개 추가만(파일-disjoint 유지가 동시 claim 안전성의 근거). 대조 결과 실제 drift 가 발견되면 고치지 말고 Follow-ups 에 적는다.
- 공용 계약 추출 helper 파일 신설(`web/src/test-utils/contract-guard.ts` 등) — 확산 use site 가 16 곳이 되어 추출 ROI 가 임계를 강하게 넘어섰다. 단 helper 추출은 16 개 기존 파일을 동시에 건드려 **파일-disjoint(동시 claim 안전)를 깨므로** 본 slice 와 분리한다. 별도 refactor slice 로 검토(본 task Follow-ups 에 추출 후보 박제 — 16 use site 도달로 우선 검토 강력 권장).
- LLM provider 수정(PATCH /api/llm/providers/:id, `runUpdateProvider` L2566)·삭제(DELETE /api/llm/providers/:id, `runDeleteProvider` L1286)로 guard 확산 — 본 slice 는 LLM provider 생성만. 이후 대상은 별도 slice(LLM provider CRUD arc 마무리).
- **apiKey 응답측 redaction·encrypt-at-rest(ADR-0014) 대조** · 응답 status code(201 Created) 대조 · 응답 body(apiKey 제거 view) 대조 · 400 검증 실패(미지원 provider·빈 필드) 대조 · 409 중복 대조 · 403 Admin+ 미만 대조 · schema 부수효과 — ADR-0040 §5 harness 경계 그대로(요청 계약만 guard, 응답 계약·보안 invariant 은 범위 밖). 특히 apiKey 는 요청 body 필드 집합에 포함되나 그 암호화·redaction·never-read-back 은 본 guard 범위 밖.
- `runCreateProvider` 의 4 필드 빈/공백 미발사 가드 · `creating` 이중발사 가드 · `bumpRefresh`/`resetInput` 성공 후 부수효과 · 실패 시 error 표면화 등 러너 자체 동작 검증 — 본 guard 는 web↔backend **계약(route/method/body)** 정적 대조만. 러너 상태전이 동작은 별도 spec 몫.
- backend 소스 파싱용 AST 파서·새 devDependency 도입 — 문자열/정규식으로 충분(§5 새-dep 게이트 대상).
- `web/package.json` vitest coverage threshold 도입 — 새 외부 dependency(`@vitest/coverage-v8`) PLAN P6 게이트 backlog(line 125).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 비어 있음. sub-agent 가 관련 작업 발견 시 여기에 추가. 특히 계약 guard use site 가 16 곳 도달 — 공용 helper 추출 ROI 가 임계를 **강하게** 넘어섰으므로 16 개 파일 동시 수정 refactor slice 후보를 명시 박제할 것(별도 slice — 파일-disjoint 동시 claim 안전성을 깨므로 본 arc 확산과 분리). LLM provider 생성 완결 후 다음 확산 대상은 LLM provider 수정(PATCH /api/llm/providers/:id) · 삭제(DELETE /api/llm/providers/:id).)
