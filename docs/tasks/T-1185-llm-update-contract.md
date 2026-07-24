---
id: T-1185
title: LLM provider 수정 endpoint web↔backend 계약 drift-guard spec (PATCH /api/llm/providers/:id · api/llm/providers 3-세그먼트 base + @Patch(":id") path param 합성 + UpdateLlmProviderConfigDto 4 all-optional subset + PATCH partial body/Content-Type 존재 축)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-096]
estimatedDiff: 290
estimatedFiles: 1
created: 2026-07-24
independentStream: web-admin-user
dependsOn: []
touchesFiles:
  - web/src/views/AdminView.llm-provider-update-contract.test.ts
plannerNote: P6 line120 Admin 패널 — T-1184 Out of Scope 예약 "LLM provider 수정(PATCH /api/llm/providers/:id, runUpdateProvider L2566)" 대상. api/llm/providers 3-세그먼트 base + @Patch(":id") path param 합성 + UpdateLlmProviderConfigDto 4 all-optional subset 축. test-only pr 1파일 disjoint 동시 claim 안전
---

# T-1185 — LLM provider 수정 endpoint web↔backend 계약 drift-guard spec

## Why

PLAN.md P6 line 120 (Admin 패널) 인원·그룹·파트·LLM provider 관리 arc 의 후속 slice 다. web↔backend 계약 drift-guard 패턴이 인스턴스 접근(T-1169/T-1170) → 역할 변경(T-1171) → 사용자 생성(T-1172) → 그룹 멤버 추가/제거(T-1173/T-1174) → 그룹 생성/수정/삭제(T-1175/T-1176/T-1177) → 인원 생성/수정/삭제(T-1178/T-1179/T-1180) → 파트 생성/수정/삭제(T-1181/T-1182/T-1183) → LLM provider 생성(T-1184) 16 slice 를 거쳐 안정됐다. T-1184 Out of Scope 는 "LLM provider 수정(`PATCH /api/llm/providers/:id`, `runUpdateProvider` L2566)·삭제(`DELETE /api/llm/providers/:id`, `runDeleteProvider` L1286)로 guard 확산 — 본 slice 는 LLM provider 생성만. 이후 대상은 별도 slice(LLM provider CRUD arc 마무리)" 를 **명시적으로 예약**했으며, 그 예약의 **첫 대상**이 LLM provider 수정 endpoint 다. 본 task 는 그 예약을 실행해 LLM provider CRUD 계약 guard 확산의 두 번째 slice(수정 PATCH)를 완결한다.

LLM provider 수정은 web `runUpdateProvider` 러너(`AdminView.tsx` 2500~2588, 발사부 2566~2571)가 발사하고 backend `LlmProviderConfigController.update`(`@Controller("api/llm/providers")` base + `@Patch(":id")`, `@Body() UpdateLlmProviderConfigDto`, 200 OK 반환)가 받는다. 이 경로는 앞선 16 slice 와 같은 silent-drift 위험(backend 가 route/method/body 계약을 바꿔도 web unit test 가 green 유지 → 런타임 404/405/400)을 가지며, 다음 축을 대조한다 — 특히 **LLM provider 도메인 PATCH 에서의 신규 대조 포인트**를 담는다:

1. **`api/llm/providers` 3-세그먼트 base + `@Patch(":id")` path param 합성 — guard arc 최초의 다중-세그먼트 base + path param 결합** — backend `@Controller("api/llm/providers")` base(3 세그먼트) 와 `@Patch(":id")`(세그먼트 1개 + path param `:id`)를 합성하면 최종 template 은 `/api/llm/providers/:id`(path param **1개**, 세그먼트 **4개**)다. T-1184(LLM provider create)가 3-세그먼트 base 를 처음 대조했으나 path param 0(bare `@Post()`)이었고, path-param 결합 PATCH 는 앞선 도메인이 전부 단일-세그먼트 base(`api/parts/:id`·`api/persons/:id`)였으므로 본 task 는 **3-세그먼트 base + path param `:id` 결합을 처음 대조**한다(신규 결합 shape). `@Patch(":id")` path param 합성 자체는 T-1182(part update)·T-1179(person update)·T-1176(group update)가 이미 검증한 shape 이며 본 task 는 그 shape 를 3-세그먼트 base 에 처음 결합한다. web 러너는 `${LLM_PROVIDERS_PATH}/${encodeURIComponent(deps.id)}`(= `/api/llm/providers/<id>`, L167 + L2566) 로 발사(path param 1)한다. backend 가 base 를 `api/llm/provider`(오타)/`api/providers`(세그먼트 축소) 로 바꾸거나 `@Patch()`(path param 제거)/`@Patch(":providerId")`(param 이름 변경으로 세그먼트 수 유지하나 web 인코딩 위치 대조 유지) 로 바꾸면 route 세그먼트/param 대조가 fail 한다.
2. **PATCH + partial body/Content-Type 존재 — UpdateLlmProviderConfigDto 4 all-optional subset (guard arc 최초 all-optional PATCH subset)** — 이게 본 slice 의 **핵심 신규 대조**다. web 발사 `init` 은 `{ method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }`(L2567~2570)로 **부분 갱신 body 를 전송**한다. web 러너는 `provider`/`endpointUrl`/`apiKey`/`modelId` 중 **값이 있는 필드만 body 에 담고**(L2542~2555), 담긴 필드가 0이면 미발사(빈 body PATCH 회피 가드, L2557~2559). backend `update(@Body() dto: UpdateLlmProviderConfigDto)` 의 DTO 는 `provider`·`endpointUrl`·`apiKey`·`modelId` **4 필드 전부 `@IsOptional`**(부재 허용, 명시 시만 `@IsString`+`@IsNotEmpty`+`@MaxLength`)이다(`src/llm/dto/update-llm-provider-config.dto.ts`). 앞선 update slice 의 optional subset 은 그룹·파트(1 필드)·인원(다수)였으므로 본 task 는 **4 all-optional 필드 allow-set** 을 대조한다. 대조는 "web 발사 body 필드 집합 ⊆ backend allow-set(provider·endpointUrl·apiKey·modelId 4개)" 형태다(PATCH 부분 갱신 semantics — required subset 이 아니라 **allowed subset**: web 이 보내는 임의 부분집합이 backend 가 허용하는 4 필드 집합 안에 들어야 함). backend 가 필드를 제거(예: `endpointUrl` allow-set 에서 삭제)하거나 web 이 backend allow-set 밖 필드(예: `region`)를 발사하면 fail 한다. (참고: `apiKey` 는 body 에 평문 포함되나 **응답측 redaction·encrypt-at-rest 대조는 요청 계약 harness 경계 밖** — Out of Scope 참조. 여기서는 요청 body 필드 집합만 대조한다.)
3. **PATCH method + body/Content-Type 존재** — web `init.method === 'PATCH'` 와 backend `@Patch` decorator 의 정합, 그리고 web `init.headers['Content-Type'] === 'application/json'` + `body` 존재를 대조한다. backend 가 method 를 바꾸거나(`@Put`/`@Post`/`@Delete`) web 이 다른 method 를 발사하거나 body/Content-Type 를 누락하면 fail 한다.

본 task 는 **신규 test 파일 1개만** 추가하며 production 소스(`AdminView.tsx` · `src/llm/**`)를 건드리지 않는다. 신규 파일이라 기존 16 guard 파일들과도 disjoint → fineGrainedConcurrency(stage 5b) 하에서 동시 claim 안전하다.

## Required Reading

- `web/src/views/AdminView.part-update-contract.test.ts`(= T-1182 이 만든 **`@Patch(":id")` path param 합성 + optional body subset + PATCH body/Content-Type 존재** 선례 guard spec) 전체 — `@Patch(":id")` path param route 합성 대조 · optional body allowed-subset 판정 · PATCH body/Content-Type 존재 대조 · `options` 캡처 로직 · 주석 false-positive 방어 로직을 **읽어 패턴만 차용**하고 **수정하지 않는다**(파일-disjoint 유지). T-1182 는 `api/parts` 단일-세그먼트 base 였으므로 본 task 는 **`api/llm/providers` 3-세그먼트 base** 로 base 문자열과 필드 집합(4 all-optional)만 조정한다(method/path-param shape 는 동일). 로컬 함수는 새 파일에 compact 하게 다시 둔다(YAGNI — 공용 helper 추출은 아래 Out of Scope 대로 별도 slice). 실제 파일명은 `git ls-files web/src/views/` 로 확인.
- `web/src/views/AdminView.llm-provider-create-contract.test.ts`(= T-1184 이 만든 `api/llm/providers` 3-세그먼트 base + bare `@Post()` + 4 필드 subset 선례) — **3-세그먼트 base(`api/llm/providers`) 파싱·정규화**의 가장 가까운 선례(base shape 동일, method/path-param 만 상이). base 문자열 파싱·세그먼트 수 판정 로직만 차용하고 method 를 `@Patch(":id")`(path param 1)로, subset 판정을 all-optional allowed-subset 으로 조정.
- `web/src/views/AdminView.tsx` 2500~2588행 `runUpdateProvider` — mock deps(`update`/`describeError`/`updating`/`setUpdating`/`setUpdateError`/`bumpRefresh`/`closeEdit`/`id`/`fields`)로 호출해 실 발사 `path`(`${LLM_PROVIDERS_PATH}/${encodeURIComponent(deps.id)}` = `/api/llm/providers/<id>`, L167+L2566)/`method`(`PATCH`)/`options`(headers `Content-Type: application/json` + body `JSON.stringify(body)`, 담긴 필드만, L2567~2570)를 캡처하는 대상. 담긴 필드가 0이거나 `updating` 중이면 미발사(가드, L2557~2559) — happy-path 는 유효 부분집합(예: `modelId` 1개 또는 4 필드 전부) 발사 케이스로 캡처.
- `src/llm/llm-provider-config.controller.ts` 73행 `@Controller("api/llm/providers")` base + 145~152행 `@Patch(":id")` + `@Param("id") id: string` + `@Body() dto: UpdateLlmProviderConfigDto` (핸들러 이름 `update`, 200 OK). base(`api/llm/providers`, 3 세그먼트)와 `@Patch(":id")`(세그먼트 1 + path param)를 합성해 최종 template `/api/llm/providers/:id`(path param 1)로 정규화하는 것이 route 대조의 핵심.
- `src/llm/dto/update-llm-provider-config.dto.ts` — `UpdateLlmProviderConfigDto` 4 필드(`provider`·`endpointUrl`·`apiKey`·`modelId`) 전부 `@IsOptional`(부재 허용, 명시 시만 `@IsString`+`@IsNotEmpty`+`@MaxLength`)임을 확인. allow-set(4 필드) 대조의 근거 — PATCH 는 required subset 이 아니라 **allowed subset**(web 부분집합 ⊆ backend 4 필드 allow-set).

## Acceptance Criteria

- [ ] **base + `@Patch(":id")` route 합성 대조**: backend 소스에서 `@Controller("api/llm/providers")` base 와 `@Patch(":id")` decorator 를 파싱·합성해 최종 template `/api/llm/providers/:id`(path param **1개**, 세그먼트 **4개**)로 정규화하고, web `runUpdateProvider` 발사 path(`${LLM_PROVIDERS_PATH}/${encodeURIComponent(id)}` → `/api/llm/providers/<id>`)/method(`PATCH`)와 대조한다. base 가 정확히 `api/llm/providers`(3 세그먼트) 이고 `@Patch(":id")` 가 path param 1개(마지막 세그먼트)임을 명시 검증 — backend 가 `@Patch()`(path param 제거) 또는 base 를 `api/llm/provider`(오타)/`api/providers`(세그먼트 축소) 로 바꾸면 fail.
- [ ] **UpdateLlmProviderConfigDto 4 all-optional allowed-subset 대조**: backend DTO 에서 allow-set(`provider`·`endpointUrl`·`apiKey`·`modelId` 4개, 전부 optional)을 추출하고, web 발사 body 필드 집합이 그 allow-set 의 **부분집합(⊆)**임을 대조한다(PATCH partial-update semantics — web 이 보내는 임의 부분집합이 backend allow-set 안에 들어야 함). backend 가 allow-set 에서 필드를 제거하거나 web 이 allow-set 밖 필드(예: `region`)를 발사하면 fail.
- [ ] **PATCH body/Content-Type 존재 대조**: web 발사 `init` 에 `method: 'PATCH'` + `headers['Content-Type'] === 'application/json'` + `body`(JSON 문자열)가 **존재**함을 대조한다. backend `update` 핸들러가 `@Body()` decorator 를 가진 body-수신 핸들러임을 소스에서 추출해 정합 검증한다. backend 가 `@Body` 를 제거하거나 web 이 body/Content-Type 를 누락하면 fail.
- [ ] **PATCH method 대조**: web 발사 method(`PATCH`)와 backend `@Patch` decorator 종류가 정합함을 대조한다. backend method 가 `@Put`/`@Post`/`@Delete`/`@Get` 로 바뀌거나 web 이 다른 method 를 발사하면 fail.
- [ ] **Happy-path test 1+**: 현재 backend(`@Controller("api/llm/providers")` + `@Patch(":id")` + `@Body() UpdateLlmProviderConfigDto` 4 all-optional) 상태에서 web `runUpdateProvider` 발사(유효 부분집합 — 예: `modelId` 1개 발사, 그리고 4 필드 전부 발사 케이스 각 1)가 route/method/body/allowed-subset 대조를 모두 통과함을 검증(정상 계약이 green).
- [ ] **Error path test 1+**: 추출기가 빈 집합/`null` 을 반환하는 입력(빈 소스 등)에서 대조가 조용히 통과하지 않고 선단언으로 fail 함을 유지·검증(guard 무력화 방어).
- [ ] **분기 cover**: 각 새 분기를 test 로 나눈다 — (1) 3-세그먼트 base route 파싱분기(`@Controller("api/llm/providers")` → `/api/llm/providers`) 1 test, (2) `@Patch(":id")` path param 합성분기(path param 1, 마지막 세그먼트) 1 test, (3) DTO 4 all-optional allow-set 추출분기 1 test, (4) web `options` → method/body/Content-Type 매핑분기 1 test.
- [ ] **Negative cases 충분 cover** — 각 1+ test: (a) backend 가 base 를 `api/llm/provider`(오타)/`api/providers`(세그먼트 축소) 로 바꿈 → base route 불일치 fail, (b) backend 가 `@Patch(":id")` 를 `@Patch()`(path param 제거) 로 바꿈 → route path-param 불일치 fail, (c) backend 가 method 를 `@Put()`/`@Post()` 로 바꿨는데 web 은 PATCH 발사 → method 불일치 fail, (d) backend 가 allow-set 에서 필드를 제거(예: `endpointUrl`)했는데 web 이 그 필드를 발사 → allowed-subset 위반 fail, (e) web 이 backend allow-set 밖 필드(예: `region`)를 발사 → allowed-subset 위반 fail, (f) web 이 `Content-Type` 헤더 또는 `body` 를 누락 → PATCH body 존재 대조 fail, (g) backend 가 `@Body` decorator 를 제거 → body-수신 정합 위반 fail, (h) 주석 줄에만 `@Patch(...)`/`@Controller(...)` 문자열이 있고 실 decorator 가 없는 가짜 소스는 method/base 추출 실패로 판정(주석 false-positive 방어).
- [ ] **실측 확인**: 구현자는 backend base(`api/llm/providers`→`api/llm/provider`) 또는 `@Patch(":id")`→`@Patch()`(path param 제거) 또는 DTO allow-set 필드 제거 중 하나를 임시 변경해 guard 가 실제로 fail 하는 것을 최소 1회 확인한 뒤 되돌린다(되돌림 후 green 상태로 commit).
- [ ] `pnpm --dir web test` (vitest) 전체 green + `pnpm --dir web build` (tsc + vite) green. 루트 `pnpm lint` clean.
- [ ] `pnpm test:cov` 기준선 유지 — 본 task 는 `src/` 를 건드리지 않으므로 backend coverage(line ≥ 80% / function ≥ 80%)가 그대로 통과해야 한다.
- [ ] **사이즈 게이트** — 최종 diff ≤ 300 LOC / 파일 1개. 초과 예상 시 negative case 를 `it.each` 표로 합치고 추출기 주석을 선례(T-1182/T-1184) 참조 한 줄로 압축한다. **test 항목 자체를 빼서 줄이지 말 것**(R-112 위반).

## Out of Scope

- `web/src/views/AdminView.tsx` · 기존 guard spec 파일들(instance-access · role-change · create-user · group-member-add · group-member-remove · group-create · group-update · group-delete · person-create · person-update · person-delete · part-create · part-update · part-delete · llm-provider-create contract test) · `src/llm/**` 등 **기존 파일 수정 전면 금지** — 본 slice 는 신규 파일 1개 추가만(파일-disjoint 유지가 동시 claim 안전성의 근거). 대조 결과 실제 drift 가 발견되면 고치지 말고 Follow-ups 에 적는다.
- 공용 계약 추출 helper 파일 신설(`web/src/test-utils/contract-guard.ts` 등) — 확산 use site 가 17 곳이 되어 추출 ROI 가 임계를 강하게 넘어섰다. 단 helper 추출은 17 개 기존 파일을 동시에 건드려 **파일-disjoint(동시 claim 안전)를 깨므로** 본 slice 와 분리한다. 별도 refactor slice 로 검토(본 task Follow-ups 에 추출 후보 박제 — 17 use site 도달로 우선 검토 강력 권장).
- LLM provider 삭제(DELETE /api/llm/providers/:id, `runDeleteProvider` L1286)로 guard 확산 — 본 slice 는 LLM provider 수정만. 삭제가 LLM provider CRUD arc 의 **마지막** slice(별도 task).
- **apiKey 응답측 redaction·encrypt-at-rest(ADR-0014) 대조** · 응답 status code(200 OK) 대조 · 응답 body(apiKey 제거 view) 대조 · 400 검증 실패(미지원 provider·빈 필드·extra 키) 대조 · 404 미존재 대조 · 403 Admin+ 미만 대조 · schema 부수효과 — ADR-0040 §5 harness 경계 그대로(요청 계약만 guard, 응답 계약·보안 invariant 은 범위 밖). 특히 apiKey 는 요청 body 필드 집합에 포함되나 그 재암호화·never-read-back 은 본 guard 범위 밖.
- `runUpdateProvider` 의 빈 body 미발사 가드(담긴 필드 0 → 미발사) · `updating` 이중발사 가드 · `bumpRefresh`/`closeEdit` 성공 후 부수효과 · 실패 시 error 표면화 등 러너 자체 동작 검증 — 본 guard 는 web↔backend **계약(route/method/body)** 정적 대조만. 러너 상태전이 동작은 별도 spec 몫.
- backend 소스 파싱용 AST 파서·새 devDependency 도입 — 문자열/정규식으로 충분(§5 새-dep 게이트 대상).
- `web/package.json` vitest coverage threshold 도입 — 새 외부 dependency(`@vitest/coverage-v8`) PLAN P6 게이트 backlog(line 125).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 비어 있음. sub-agent 가 관련 작업 발견 시 여기에 추가. 특히 계약 guard use site 가 17 곳 도달 — 공용 helper 추출 ROI 가 임계를 **강하게** 넘어섰으므로 17 개 파일 동시 수정 refactor slice 후보를 명시 박제할 것(별도 slice — 파일-disjoint 동시 claim 안전성을 깨므로 본 arc 확산과 분리). LLM provider 수정 완결 후 마지막 확산 대상은 LLM provider 삭제(DELETE /api/llm/providers/:id, `runDeleteProvider` L1286) — LLM provider CRUD arc 마무리.)
