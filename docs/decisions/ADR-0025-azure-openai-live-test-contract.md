---
id: ADR-0025
title: azure_openai live-integration TEST CONTRACT — Q-0021 승인 target(gpt-5.4 / karina-east-us-2)의 env-gated live smoke 계약 확장
status: PROPOSED
date: 2026-06-04
relatedTask: T-0226
supersedes: null
extends: ADR-0015
---

# ADR-0025 — azure_openai live-integration TEST CONTRACT 박제

> 본 ADR 은 [ADR-0015](ADR-0015-llm-live-integration-test-contract.md)(ACCEPTED, custom/OpenAI-호환 전용 live-test 계약)를 **supersede 하지 않고 azure_openai 축으로 확장**한다. ADR-0015 의 3-layer 경계(mocked unit / stub round-trip / live smoke)·skip-unless-credentialed gating 메커니즘·순수 helper 분리 원칙은 그대로 상속하고, 본 ADR 은 그 위에 azure_openai 전용 wire shape(URL 라우팅·`api-key` 헤더·apiVersion 필수)와 azure gating env 이름을 더한다. 코드 구현(gating helper 의 azure 확장 + azure live smoke spec)은 본 ADR 머지 후 후속 slice(T-0227 후보) 책임이며, 본 ADR 은 **코드 전 계약 박제**(production code 0)다.

## Context

[docs/STATE.json](../STATE.json) `humanQuestions[Q-0021].decision` 가 milestone-1 의 credentialed live LLM run 을 승인하면서 **target 을 명시**했다:

- provider = `azure_openai`
- deployment / model = `gpt-5.4`
- endpoint(host) = `https://karina-east-us-2-api.openai.azure.com`
- 시험용 API key 실값은 **repo 밖 로컬 secrets.env** 에만 보관(`C:/Users/MyungJoo Ham/.assessment-agent/secrets.env`, 유효기간 2026-06-30) — STATE/journal/코드/git/ADR/spec 어디에도 실값 미기재([CLAUDE.md §9](../../CLAUDE.md) + 사용자 명시 지시).

이 decision 은 [Q-0016 optionADecision](../STATE.json) 의 **2-step 분해**를 준수한다 — (2a) dependency-free 선행(live-test 계약 ADR + skip-unless-credentialed spec, 실 credential 불요) → (2b) credentialed live run(로컬 secrets.env 주입 후 실 네트워크 1회 검증 + [ADR-0014](ADR-0014-llm-api-key-encryption-at-rest.md) at-rest 키 생성). 본 task 는 그 **2a 의 잔여 ADR slice** 다.

### gap — 기존 live 계약은 custom-only

issue-still-relevant 점검 결과 2a 의 **generic 부분은 이미 main 에 박제**됐다 — [ADR-0015](ADR-0015-llm-live-integration-test-contract.md)(ACCEPTED) + [src/llm/llm-live-test-gating.ts](../../src/llm/llm-live-test-gating.ts) + [test/smoke/llm-live.smoke-spec.ts](../../test/smoke/llm-live.smoke-spec.ts). 그러나 그 박제는 **provider=custom(OpenAI-호환) 전용**이다 — Q-0021 의 azure target 에 실제로 도달하려면 다음 gap 을 메워야 한다:

| 축 | custom(ADR-0015, 기존) | azure_openai(Q-0021 target, 본 ADR) |
| --- | --- | --- |
| **URL** | `POST {baseUrl}/chat/completions`(trailing slash 정규화 후 append) | `POST {base}/openai/deployments/<deployment>/chat/completions?api-version=<ver>` |
| **auth header** | `Authorization: Bearer {key}` | `api-key: {key}`(Bearer 아님) |
| **apiVersion** | 없음 | **필수** query 파라미터(예: `2024-02-15-preview`) |
| **model 식별** | model 이름이 body `model` 필드 | deployment 이름이 **URL 경로**(body 에 model 없음) |
| **gating env** | `LLM_LIVE_BASE_URL`/`LLM_LIVE_API_KEY`/`LLM_LIVE_MODEL`(3종, +`LLM_LIVE_TEST` flag) | provider 선택 + apiVersion + deployment 라우팅을 모름 — 확장 필요 |
| **spec provider** | `provider: LlmProvider.Custom` 하드코딩 | `LlmProvider.AzureOpenai` 필요 |

azure wire shape 의 정본은 [src/llm/providers/azure-openai.adapter.ts](../../src/llm/providers/azure-openai.adapter.ts) 다 — `buildAzureOpenaiRequest` 가 URL 을 `<endpointUrl>/openai/deployments/<modelId>/chat/completions?api-version=<apiVersion>` 로 조립하고 헤더에 `api-key`(Bearer 아님)를 싣으며 apiVersion 을 `assertNonEmpty` 로 필수화한다. 본 ADR 의 live 계약 경계는 이 adapter 와 **정합**해야 한다.

### 3-layer 경계 상속 (ADR-0015 Context 표)

본 ADR 은 ADR-0015 가 정의한 3 layer(① mocked unit ② stub round-trip smoke ③ live smoke)를 그대로 상속하고, ③ live smoke layer 에 **azure 축의 두 번째 spec** 을 더한다. azure live smoke 는 custom live smoke 와 **독립적으로 skip/run** 한다 — 각자의 gating env 에 의해 결정된다(한쪽 활성이 다른쪽을 강제하지 않음). ① mocked unit·② stub round-trip 은 azure_openai adapter 를 이미 cover 하므로([Q-0016] 분석 — `azure-openai.adapter.spec.ts` 등) 본 ADR 의 신규 layer 는 ③ live 의 azure 확장 1개뿐이다.

### REQ 외력

- **REQ-096 / REQ-097** ([docs/requirements.md](../requirements.md)) — LLM provider HTTP 통합 + 난이도 routing 의 실 동작 검증 backbone. 본 ADR 은 그 live 검증을 Q-0021 의 azure target 으로 확장하는 test 계약을 박제한다.
- **[CLAUDE.md §3.2 R-112/R-113](../../CLAUDE.md)** — gating 판정은 순수 helper 로 분리(R-112 entrypoint-helper 원칙), live smoke 는 gating env 부재 시 describe.skip 으로 public CI green 유지(R-113 smoke 게이트 + secret-leak/flaky/비용 회피).
- **[CLAUDE.md §9](../../CLAUDE.md)** — credential 실값은 어디에도 미기재. 본 ADR 은 env 변수 **이름** 만 박제(값 0). endpoint host·deployment 이름은 Q-0021 decision 에 이미 공개돼 있어 기재 가능하나, API key 실값은 절대 금지.

## Decision

본 ADR 은 다음 6 결정을 박제한다. **본 ADR 은 test 계약(env 이름·skip 메커니즘·azure wire shape·error 경계·cipher 우회)을 기술하되 `LlmHttpGateway`·gating helper·spec 의 동작 코드는 변경하지 않는다** — 코드 구현은 후속 slice(§Consequences 후속 chain).

### Decision §1 — azure gating env 변수 이름 확장 (실 secret 값 0)

azure live smoke 는 다음 env 변수가 set 된 경우에만 활성화된다. 기존 `LLM_LIVE_*` 와의 관계를 명시한다:

**provider 선택 — 신규 flag**:

- **`LLM_LIVE_PROVIDER`**(신규, optional) — live 대상 provider 선택. 값이 `azure_openai`(또는 `azure`) 이면 azure 경로, `custom`(또는 부재) 이면 기존 custom 경로(ADR-0015 호환 default). 부재 시 기존 동작(custom) 보존 → ADR-0015 의 custom live smoke 와 backward-compatible. 본 env 는 gating *완전성* 필수에는 포함하지 않으며 **경로 분기** 용도다(부재 = custom).

**azure 전용 신규 env**:

- **`LLM_LIVE_API_VERSION`**(신규) — azure REST `api-version` query 값(예: `2024-02-15-preview`). azure 경로 활성 시 **필수**(부재/빈/공백 → azure skip). custom 경로에서는 무시된다.

**기존 `LLM_LIVE_*` 재사용(신규 prefix 도입 최소화)**:

- **`LLM_LIVE_TEST`**(재사용) — gating flag. azure/custom 공통 — set 시에만 live 경로 활성.
- **`LLM_LIVE_BASE_URL`**(재사용) — azure resource base endpoint(예: `https://karina-east-us-2-api.openai.azure.com`). azure 경로에서는 이 값이 `<base>` 로 쓰여 `/openai/deployments/...` 가 append 된다(custom 의 `/chat/completions` append 와 다른 라우팅 — 경로 조립은 provider 분기로 결정).
- **`LLM_LIVE_API_KEY`**(재사용) — provider API key 평문. **azure 경로에서는 `api-key` 헤더에 실린다**(custom 의 `Authorization: Bearer` 와 다름 — 헤더 조립도 provider 분기로 결정). 실값은 env 주입만(§9).
- **`LLM_LIVE_MODEL`**(재사용, 의미 확장) — **azure 경로에서는 deployment 이름**(Q-0021 target = `gpt-5.4`)으로 해석된다(azure 는 model 이 아니라 deployment 로 라우팅). custom 경로에서는 기존대로 body `model` 식별자. azure 경로에서는 URL 경로에 실리므로 default(`gpt-3.5-turbo`)에 의존하지 않고 **명시 요구**(부재 시 azure skip 권장 — deployment 는 필수 라우팅 키).
- **`LLM_APIKEY_ENC_KEY`**(재사용) — [ADR-0014 §2](ADR-0014-llm-api-key-encryption-at-rest.md) at-rest master key. (2b) credentialed run 이 실 cipher 를 쓸 때 재사용(새 env 0). 본 scaffold 의 smoke 는 §6 cipher stub 으로 우회.

**azure gating 완전성 규칙**: `LLM_LIVE_TEST` AND `LLM_LIVE_BASE_URL` AND `LLM_LIVE_API_KEY` AND `LLM_LIVE_API_VERSION` AND `LLM_LIVE_MODEL`(deployment) 이 **모두** non-empty(trim 후 길이 > 0) 이고 `LLM_LIVE_PROVIDER` 가 azure 를 가리킬 때만 azure live `enabled === true`. 하나라도 부재/빈/공백 → azure skip. custom gating(ADR-0015 §1, 3종 필수)과 별개로 평가된다.

### Decision §2 — azure live wire shape (azure-openai.adapter 정합)

azure live 호출은 [src/llm/providers/azure-openai.adapter.ts](../../src/llm/providers/azure-openai.adapter.ts) `buildAzureOpenaiRequest`/`parseAzureOpenaiResponse` 와 **정합**하며 다음 wire shape 를 쓴다:

- **Request URL** — `POST {LLM_LIVE_BASE_URL}/openai/deployments/{LLM_LIVE_MODEL}/chat/completions?api-version={LLM_LIVE_API_VERSION}`. `LLM_LIVE_BASE_URL` 끝 trailing slash 는 정규화(제거) 후 append(adapter 의 `replace(/\/+$/, "")` 규칙과 동일). `LLM_LIVE_MODEL` 은 deployment 이름(Q-0021 = `gpt-5.4`)으로 경로에 실린다.
- **Headers** — `api-key: {LLM_LIVE_API_KEY}`(소문자 `api-key`, **`Authorization: Bearer` 아님**) + `Content-Type: application/json`. 이것이 custom 과의 핵심 auth 차이.
- **apiVersion 필수** — query 파라미터 `api-version` 부재 시 azure REST 가 400 을 반환하므로 gating 에서 `LLM_LIVE_API_VERSION` 을 필수화(§1). adapter 도 `assertNonEmpty(input.apiVersion, ...)` 로 강제 — 정합.
- **Body** — `{ messages: [{ role: "user", content: <prompt> }] }`(difficulty 미지정 시 system message 없음 — adapter 동작과 동일). azure 는 deployment 가 URL 에 있으므로 body 에 `model` 필드 없음(adapter 와 동일).
- **Response** — `choices[0].message.content`(비어있지 않은 string) → `LlmGenerateResult.narrative`. provider = `azure_openai`(`LlmProvider.AzureOpenai`), modelId = deployment 이름. `parseAzureOpenaiResponse` 가 비정상 응답(object 아님/choices 누락·빈/message null/content 누락·빈)을 throw 하므로 live 경로는 그 파서를 그대로 재사용(별도 파싱 0).
- **검증 invariant** — azure live smoke 는 실 endpoint 1회 호출 후 `result.narrative` 가 비어있지 않은 string 이고 `provider === LlmProvider.AzureOpenai` 임을 assert. 내용 자체(문장 의미)는 비결정적이라 assert 하지 않는다(custom live smoke 와 동형).

### Decision §3 — skip-unless-credentialed gating (azure)

- **순수 helper 확장** — gating 판정은 [src/llm/llm-live-test-gating.ts](../../src/llm/llm-live-test-gating.ts) 의 부수효과 0 순수 함수에 azure 축을 더하는 방향(예: `resolveLiveTestGating` 가 `LLM_LIVE_PROVIDER` 를 읽어 azure 분기 시 `apiVersion`/deployment 완전성을 추가 검사, 또는 azure 전용 `resolveAzureLiveTestGating` 분리). 코드 형태는 후속 slice 가 결정 — 본 ADR 은 **순수 함수 분리 원칙**(R-112, skip 본문에 분기 미묻힘)만 박제.
- **describe.skip 분기** — azure live smoke spec 은 `const gating = resolve...(process.env); const d = gating.enabled ? describe : describe.skip;` 패턴으로 suite 를 등록한다. azure gating env 부재(= public CI 기본 조건) → `describe.skip` → 전 it skip → CI green(실 네트워크 0).
- **custom 과 독립** — azure live smoke 는 custom live smoke([test/smoke/llm-live.smoke-spec.ts](../../test/smoke/llm-live.smoke-spec.ts))와 **별도 파일**(`test/smoke/llm-live-azure.smoke-spec.ts`, 후속 slice)이며 각자의 gating env 로 독립 skip/run. `LLM_LIVE_PROVIDER` 가 custom 이면 azure spec skip, azure 면 custom spec 은 자기 gating 으로 별도 판정.
- **CI 정합** — 신규 spec 은 `.smoke-spec.ts` suffix 라 [test/jest-smoke.json](../../test/jest-smoke.json) `testRegex` 가 자동 픽업하고 [.github/workflows/ci.yml](../../.github/workflows/ci.yml) "스모크 테스트" step 이 실행(CI/jest 설정 수정 0). CI 에는 azure gating env 가 없으므로 항상 skip — green 유지(R-113).

### Decision §4 — timeout + non-2xx live error 매핑 경계 (azure)

본 ADR 은 현 `LlmHttpGateway` 동작의 경계를 **기술**한다(코드 변경 0):

- **non-2xx 매핑(현 동작)** — [llm-http-gateway.service.ts](../../src/llm/llm-http-gateway.service.ts) 가 `!response.ok` 시 `{provider} HTTP 호출 실패 (status: {status})` Error throw. azure endpoint 의 rate-limit(429)·5xx·auth 실패(401/403 — 잘못된 `api-key`)·apiVersion 누락(400)도 이 단일 경로로 status 포함 throw 된다. azure adapter 의 build/parse 는 이미 unit/stub layer 가 cover 하므로, azure live smoke 는 **happy-path(2xx + narrative)만 검증**하고 non-2xx 재현은 mocked/stub layer 에 위임(실 endpoint 에 의도적 실패 유도 금지 — flaky/비용/과금 회피).
- **timeout(현 부재)** — 현 gateway 는 명시 timeout(AbortController 등)을 두지 않는다 — 주입된 fetch 의 기본 동작에 따른다. azure endpoint hang 위험은 본 ADR 이 **인지·기술**하되 코드 도입은 별도 task(Out of Scope). azure live smoke 는 spec 내 `jest.setTimeout` 상한(예: custom 의 30s mirror) 안에서 1회 호출하며, timeout 초과는 jest 자체가 실패로 보고(별도 매핑 0). 명시 timeout/AbortController 도입은 ADR-0015 후속 chain 의 "live timeout hardening" task 가 azure/custom 공통 gateway 경로로 처리.
- **책임 경계 요지** — error 매핑 코드는 azure/custom 이 동일한 현 gateway 경로를 공유(provider 분기는 build/parse 에서만 발생, non-2xx 매핑은 공통). 본 task 는 그 경로를 바꾸지 않는다.

### Decision §5 — provider 분기 경계 (custom vs azure)

ADR-0015 와 본 ADR 의 차이는 **build/parse 의 provider 분기에 국한**된다:

- gateway 의 dispatch 는 config.provider(또는 live 의 `LLM_LIVE_PROVIDER` 매핑)에 따라 `openai-compatible.adapter`(custom) vs `azure-openai.adapter`(azure) 를 선택한다 — 이미 `LlmHttpGateway` 에 5 provider dispatch 가 박제됨([Q-0016] 분석).
- live smoke 의 차이는 (a) URL 라우팅 (b) auth 헤더 (c) apiVersion 필수 (d) deployment=URL-경로 model — 모두 §2 wire shape 표가 박제. gating·skip 메커니즘·cipher 우회·invariant 형태는 custom 과 **동형**(mirror).
- 따라서 후속 azure spec 은 custom spec 의 구조를 mirror 하되 repository stub 의 `provider: LlmProvider.AzureOpenai` + `endpointUrl`(base host) + apiVersion 전달 경로만 azure 로 교체한다.

### Decision §6 — cipher 우회 경계

azure live smoke 는 custom live smoke 와 **동형**으로 실 `LLM_APIKEY_ENC_KEY` decrypt 를 우회한다:

- repository stub 이 `apiKey: "ciphertext-not-used-cipher-is-stubbed"`(placeholder, 실값 아님) 를 돌려주고, cipher stub 의 `decrypt` 가 `gating.apiKey`(= env `LLM_LIVE_API_KEY` 평문)를 반환한다 — 실 at-rest decrypt 미발생. 실 API key 는 env 출처일 뿐 코드에 기재 0(§9).
- (2b) credentialed run 단계가 실 cipher + 실 `LLM_APIKEY_ENC_KEY`(ADR-0014 at-rest) 를 쓸 때 본 env 를 재사용 — 본 scaffold 단계는 transport 검증이 목적이라 cipher stub 우회로 충분.

## Consequences

### 양의 (positive)

1. **dependency-free 즉시 착수** — Node 내장만(새 dep 0), 실 credential 0 으로 azure live 계약을 코드 전에 박제 → [CLAUDE.md §5](../../CLAUDE.md) 게이트 미발화. credential 은 (2b) 가 로컬 secrets.env 주입.
2. **public CI green 보존** — Decision §3 의 azure gating env 부재 → describe.skip 으로 CI 는 실 네트워크 0·secret 0·비용 0 으로 green(R-113).
3. **ADR-0015 호환 + 최소 신규 env** — 기존 `LLM_LIVE_*` 4종 재사용 + 신규 2개(`LLM_LIVE_PROVIDER` 분기 + `LLM_LIVE_API_VERSION`)만 추가. `LLM_LIVE_PROVIDER` 부재 시 custom default 보존 → 기존 custom live smoke backward-compatible.
4. **adapter 재사용** — Decision §2 가 기존 azure-openai.adapter 의 build/parse 계약을 그대로 재사용 → live 전용 wire 코드 중복 0, azure provider 계약 합치.
5. **custom/azure 독립 skip/run** — Decision §3 으로 두 live spec 이 각자 gating 으로 독립 동작 → 한쪽 credential 만 있어도 다른쪽 강제 skip, 운영 유연성 + CI 영향 0.

### 음의 (negative) / trade-off

1. **live 경로의 CI 미검증** — gating skip 이라 public CI 는 azure live 코드의 실 실행을 검증하지 않는다(skip 만 검증). mitigation: azure adapter 의 build/parse 는 mocked/stub layer 가 full cover + (2b) credentialed run 이 실 endpoint 로 1회 검증.
2. **gating env 운영 부담 증가** — azure 는 custom 대비 env 가 더 많다(`LLM_LIVE_PROVIDER` + `LLM_LIVE_API_VERSION` + deployment 명시). mitigation: gating helper 의 `reason` 필드가 어느 env 가 부재해 skip 됐는지 보고.
3. **`LLM_LIVE_MODEL` 의미 overload** — 동일 env 가 custom 에선 body model, azure 에선 URL deployment 로 해석된다. mitigation: §1·§2 가 provider 별 의미를 명시 박제 + helper 가 provider 분기로 처리(혼동은 문서로 차단).
4. **timeout 부재 잔존** — Decision §4 상 명시 timeout 미도입 → azure endpoint hang 시 jest 상한까지 대기. mitigation: spec 내 `jest.setTimeout` + ADR-0015 후속 chain 의 live timeout hardening task(azure/custom 공통 gateway).

### 후속 task chain

| 후속 task | scope | dependency | BLOCKED risk |
| --- | --- | --- | --- |
| **azure gating + live smoke 구현**(T-0227 후보) | `src/llm/llm-live-test-gating.ts` 의 azure 확장(`LLM_LIVE_PROVIDER`/`LLM_LIVE_API_VERSION` 처리 + azure 완전성 검사) + `test/smoke/llm-live-azure.smoke-spec.ts` 신설(custom mirror) + R-112 helper unit test | 본 ADR 머지 후 | 없음(Node 내장, credential 0 — skip path 만 검증) |
| **(2b) credentialed live run** | 로컬 secrets.env(`LLM_LIVE_PROVIDER=azure_openai`/`LLM_LIVE_BASE_URL`/`LLM_LIVE_API_KEY`/`LLM_LIVE_API_VERSION`/`LLM_LIVE_MODEL=gpt-5.4` + `LLM_APIKEY_ENC_KEY`)를 env 주입해 gated azure live smoke 를 실 네트워크 1회 실행 검증 | 위 구현 slice 머지 후 + 사용자 credential 제공(이미 secrets.env 보관, 만료 2026-06-30) | **있음 — [§5](../../CLAUDE.md) 외부 자격증명 게이트** |
| **live timeout hardening**(ADR-0015 chain 공유) | `LlmHttpGateway` AbortController 기반 명시 timeout(azure/custom 공통) | 본 ADR 후 | 없음(Node 내장) |
| **ADR-0025 PROPOSED→ACCEPTED** | 구현 slice 머지 후 status 한 줄 갱신(direct) | 위 구현 slice 머지 | 없음 |

## Alternatives considered

| 대안 | 장점 | 단점 / 정합도 | 채택 여부 |
| --- | --- | --- | --- |
| **(1) 신규 ADR-0025 로 azure 축 확장**(채택) | ADR 본문 immutable 원칙 준수(ADR-0015 무변경) / azure gap 을 독립 문서로 명확 박제 / custom 계약과 경계 명시 / grep·history 추적 용이 | ADR 2개를 함께 읽어야 azure 전모 파악(ADR-0015 base + 0025 delta) | **✓ 채택** |
| (2) ADR-0015 본문 inline amend(azure 절 추가) | 한 문서에 custom+azure 통합 | **ADR 본문 immutable 원칙 위반**(ACCEPTED ADR 사후 편집 — [ADR-0015] 외 다수 ADR 이 이 원칙 준수) / T-0171 머지 history 와 불일치 / "이 ADR 은 언제 무엇을 결정했나" 추적성 훼손 | 기각 — immutable 위반 |
| (3) azure 전용 신규 env prefix(예: `AZURE_LIVE_*` 전면 신설) | custom/azure env 가 명확히 분리 | 기존 `LLM_LIVE_*` 4종과 중복(base URL·key·test flag 동일 의미) → 운영 env 폭증 / ADR-0015 호환성 단절 / `LLM_LIVE_PROVIDER` 분기 하나로 충분한데 과설계 | 기각 — env 중복·과설계 |
| (4) azure live test 미작성(custom-only 유지) | 구현 0 | **Q-0021 decision(azure target 명시 승인) 미충족** — milestone-1 의 실제 승인 target(azure_openai/gpt-5.4)이 영구 미검증 / (2b) credentialed run 이 scaffold 없이 from-scratch | 기각 — Q-0021 target 미검증 |

## References

- [docs/decisions/ADR-0015-llm-live-integration-test-contract.md](ADR-0015-llm-live-integration-test-contract.md) — 본 ADR 이 확장하는 custom-only live-test 계약(env 이름·skip 메커니즘·3-layer 경계·순수 helper 원칙의 base)
- [docs/STATE.json](../STATE.json) `humanQuestions[Q-0021].decision` — azure target(azure_openai/gpt-5.4/karina-east-us-2) + (2a/2b) 분해 + secrets.env 로컬 보관·§9 실값 금지 / `[Q-0016].optionADecision` — option A 승인 + 2-step 분해의 직접 motivation
- [src/llm/providers/azure-openai.adapter.ts](../../src/llm/providers/azure-openai.adapter.ts) — azure wire shape 정본(URL `/openai/deployments/<model>/chat/completions?api-version=`, `api-key` 헤더, apiVersion 필수) — Decision §2 의 정합 기준
- [src/llm/llm-live-test-gating.ts](../../src/llm/llm-live-test-gating.ts) — 현 gating env 상수(`LLM_LIVE_TEST`/`LLM_LIVE_BASE_URL`/`LLM_LIVE_API_KEY`/`LLM_LIVE_MODEL`) + `resolveLiveTestGating` 순수 함수 — Decision §1·§3 의 azure 확장 지점
- [test/smoke/llm-live.smoke-spec.ts](../../test/smoke/llm-live.smoke-spec.ts) — custom live smoke 의 gating·격리·describe.skip·cipher stub 패턴 — azure spec 이 mirror 할 reference(Decision §5·§6)
- [docs/decisions/ADR-0014-llm-api-key-encryption-at-rest.md](ADR-0014-llm-api-key-encryption-at-rest.md) §2 — `LLM_APIKEY_ENC_KEY` at-rest 키(2b 재사용; 본 ADR 은 live smoke 가 cipher stub 으로 우회하는 경계만 — Decision §6)
- [src/llm/llm-http-gateway.service.ts](../../src/llm/llm-http-gateway.service.ts) — non-2xx 매핑 현 동작(Decision §4, azure/custom 공통 경로)
- [CLAUDE.md §3.2 R-112/R-113](../../CLAUDE.md) — entrypoint-helper 분리 + smoke/e2e CI 게이트 / [§5 / §9](../../CLAUDE.md) — 자격증명 BLOCKED 게이트 + secret 값 미기재(env 이름만)

Refs: T-0226, ADR-0015, ADR-0014, REQ-096, REQ-097
