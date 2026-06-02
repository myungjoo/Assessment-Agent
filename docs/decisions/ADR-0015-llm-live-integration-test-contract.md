---
id: ADR-0015
title: LLM live-integration TEST CONTRACT — env-gated skip-unless-credentialed live smoke 정책
status: PROPOSED
date: 2026-06-02
relatedTask: T-0171
supersedes: null
---

# ADR-0015 — LLM live-integration TEST CONTRACT 박제

## Context

[docs/STATE.json](../STATE.json) `humanQuestions[Q-0016].optionADecision` 에서 사용자가 P4 milestone-1 의 마지막 단계인 **실 LLM provider HTTP 통합(option A)** 을 승인했다. 즉 [src/llm/llm-http-gateway.service.ts](../../src/llm/llm-http-gateway.service.ts) 의 `LlmHttpGateway.generate` 를 실 네트워크 + 실 credential 로 custom(OpenAI-호환) provider 에 도달시켜 검증한다.

그러나 그 승인은 **2 단계 분해**를 명시했다 — (1) **dependency-free 선행 task**(본 ADR + env-gated live smoke scaffold, 실 credential 불요·즉시 착수), (2) **credentialed live-run task**(후속, §5 자격증명 게이트). 이 분해의 근거:

- **[CLAUDE.md §9](../../CLAUDE.md)** — credential(endpoint base URL · provider API key · 암호화 키) 의 실값을 코드/STATE/journal/ADR/spec/CI yaml 어디에도 기재할 수 없다. env/secret 주입만 허용. 따라서 본 ADR 은 env 변수 **이름**만 박제한다(값 0).
- **[CLAUDE.md §3.2 R-113](../../CLAUDE.md)** — CI 는 smoke + e2e 를 수행한다. 그러나 실 네트워크 live test 를 public CI 에서 무조건 실행하면 (i) secret-leak(API key 가 CI 로그·에러에 노출) (ii) flaky(외부 provider 가용성·rate-limit 의존) (iii) 비용(과금 API 호출) 이 발생한다. 따라서 live test 는 **gating env 부재 시 자동 skip → public CI 는 실 credential 없이 green 유지** 패턴이 필수다.

### 기존 테스트 layer 와의 경계 (본 ADR 이 RELATIVE 하게 정의)

본 ADR 의 live contract 는 이미 main 에 박제된 두 layer **위에** 세 번째 layer 를 더한다. 세 layer 의 경계를 명시하는 것이 본 ADR 의 핵심 산출물이다:

| layer | 파일 | fetch | endpoint | credential | CI 동작 |
| --- | --- | --- | --- | --- | --- |
| **(1) mocked unit** | [src/llm/llm-http-gateway.service.spec.ts](../../src/llm/llm-http-gateway.service.spec.ts) | jest mock 으로 *대체*(`FetchLike` 주입) | 없음 — fetch 자체가 mock | 0(fixture 평문) | 항상 실행 |
| **(2) stub round-trip smoke** | [test/smoke/llm-gateway-roundtrip.smoke-spec.ts](../../test/smoke/llm-gateway-roundtrip.smoke-spec.ts) (T-0168, Q-0016 decision B) | **실** `globalThis.fetch` | localhost `http.createServer` stub | 0(평문 fixture, localhost) | 항상 실행 |
| **(3) live smoke** (본 ADR) | `test/smoke/llm-live.smoke-spec.ts` (T-0171 신설) | **실** `globalThis.fetch` | **실** 외부 provider endpoint | 실 API key(env 주입) | **gating env 부재 시 skip** |

경계 요지: (1) 은 transport 를 *건너뛰고* dispatch/parse 분기만 검증, (2) 는 transport(헤더 직렬화·URL 조립·non-2xx 실수신·JSON 파싱)를 localhost 에서 실 fetch 로 검증하되 외부 의존 0, (3) 은 (2) 와 동일 transport 경로를 **실 외부 endpoint** 로 확장해 실 provider 계약 합치를 검증한다. (3) 만이 credential 을 요구하고 그래서 gating skip 대상이다.

### REQ 외력

- **REQ-096 / REQ-097** ([docs/requirements.md](../requirements.md)) — LLM provider HTTP 통합 + 난이도 routing 의 실 동작 검증 backbone. 본 ADR 은 그 live 검증의 test 계약을 박제한다.
- **[CLAUDE.md §3.2 R-112](../../CLAUDE.md)** — gating 판정 로직(env 읽기·완전성 검사)은 skip 본문에 묻으면 unit-test 불가하므로, entrypoint-helper 분리 원칙(R-112 `parse-port` 예시) 을 mirror 해 **순수 helper 함수**로 분리하고 happy/error/negative test 를 강제한다.

## Decision

본 ADR 은 다음 4 결정을 박제한다. **본 ADR 은 test 계약(env 이름·skip 메커니즘·wire shape·error 경계)을 기술하되 `LlmHttpGateway` 의 동작 코드는 변경하지 않는다**(timeout 도입 등은 별도 task — 아래 §4).

### Decision §1 — gating env 변수 이름 확정 (실 secret 값 0)

live smoke 는 다음 env 변수가 **모두** 비어있지 않게 set 된 경우에만 활성화된다:

- **`LLM_LIVE_TEST`** — gating flag. set(비어있지 않은 값) 시에만 live 경로 활성. 부재/빈 문자열/공백 시 skip. 이 flag 단독으로는 부족 — 아래 두 값도 필요.
- **`LLM_LIVE_BASE_URL`** — live endpoint 의 OpenAI-호환 base URL(예: `https://<provider-host>/v1`). 실값은 env 주입만([§9](../../CLAUDE.md)).
- **`LLM_LIVE_API_KEY`** — provider API key(평문). Authorization Bearer 에 실린다. 실값은 env 주입만([§9](../../CLAUDE.md)).
- **`LLM_APIKEY_ENC_KEY`**(재사용) — [ADR-0014 §2](ADR-0014-llm-api-key-encryption-at-rest.md) 가 확정한 apiKey encryption-at-rest master key env. live 경로가 cipher 를 통해 key 를 다룰 경우 이 env 를 재사용한다(새 env 도입 0). 본 scaffold 의 smoke 는 cipher 를 stub 하거나 평문 경로로 우회할 수 있으나(아래 §3), credentialed live-run task 가 실 cipher 를 쓸 때 이 env 를 재사용함을 박제한다.

선택적(optional, 부재 시 default):

- **`LLM_LIVE_MODEL`** — live 호출 model 식별자. 부재 시 helper 가 안전한 default(`gpt-3.5-turbo` 등 OpenAI-호환 통용 모델명)를 공급. gating 필수 4 종에는 포함하지 않는다(model 은 부재해도 default 로 진행 가능).

**gating 완전성 규칙**: `LLM_LIVE_TEST` AND `LLM_LIVE_BASE_URL` AND `LLM_LIVE_API_KEY` 3 종이 **모두** non-empty(trim 후 길이 > 0) 일 때만 `shouldRunLive === true`. 하나라도 부재/빈 문자열/공백-only 면 `false`(skip). 부분-set(일부만 존재)도 `false`. 이 판정은 §2 의 순수 helper 가 담당한다.

### Decision §2 — skip-in-CI gating 메커니즘 (순수 helper + describe.skip)

- **순수 helper 분리** — gating 판정은 `src/llm/llm-live-test-gating.ts` 의 **부수효과 0 순수 함수** `resolveLiveTestGating(env: NodeJS.ProcessEnv): LiveTestGating` 으로 분리한다. 반환은 `{ enabled: boolean; baseUrl?: string; apiKey?: string; model: string; reason: string }` 형태 — `enabled` 가 spec 의 skip/run 분기 입력. env 읽기·trim·완전성 검사·default model 공급을 모두 이 함수가 수행하므로 skip 본문에 분기가 묻지 않는다([R-112 entrypoint-helper](../../CLAUDE.md) 원칙 mirror).
- **describe 분기** — spec 은 `const gating = resolveLiveTestGating(process.env);` 후 `const d = gating.enabled ? describe : describe.skip;` 로 suite 를 등록한다. gating env 부재(= public CI 기본 조건) → `describe.skip` → 전 it 이 skip → CI green(실 네트워크 호출 0). 사람이 local / 전용 workflow 에 env 주입 시에만 `describe` 활성 → 실 호출.
- **CI 정합** — 새 spec 은 `.smoke-spec.ts` suffix 라 [test/jest-smoke.json](../../test/jest-smoke.json) 의 `testRegex` 가 자동 픽업하고 [.github/workflows/ci.yml](../../.github/workflows/ci.yml) "스모크 테스트" step 이 실행한다(CI/jest 설정 수정 0). CI 에는 gating env 가 없으므로 항상 skip — green 유지.

### Decision §3 — custom live endpoint request/response shape

live 호출은 기존 [src/llm/providers/openai-compatible.adapter.ts](../../src/llm/providers/openai-compatible.adapter.ts) custom(OpenAI-호환) 계약과 **정합**하며, 실 endpoint 에 대해 다음 wire shape 를 사용한다:

- **Request** — `POST {LLM_LIVE_BASE_URL}/chat/completions`(trailing slash 정규화 후 append, adapter 의 URL 규칙과 동일). 헤더 `Authorization: Bearer {LLM_LIVE_API_KEY}` + `Content-Type: application/json`. body `{ model, messages: [{ role: "user", content: <prompt> }] }`(difficulty 미지정 시 system message 없음 — adapter 동작과 동일).
- **Response** — `choices[0].message.content`(비어있지 않은 string) → `LlmGenerateResult.narrative`. provider = `custom`, modelId = 호출 model. `parseOpenaiCompatibleResponse` 가 이미 비정상 응답(choices 누락/빈 배열/message null/content 누락·빈)을 throw 하므로 live 경로는 그 파서를 그대로 재사용한다(별도 파싱 0).
- **검증 invariant** — live smoke 는 실 endpoint 1 회 호출 후 `result.narrative` 가 비어있지 않은 string 임을 assert 한다(실 provider 가 내용 있는 completion 을 돌려준다는 round-trip 합치). 내용 자체(문장 의미)는 비결정적이라 assert 하지 않는다 — 비어있지 않음 + provider/modelId 일치만.

### Decision §4 — live-path timeout / non-2xx error 매핑 경계

본 ADR 은 현 `LlmHttpGateway` 동작의 경계를 **기술**한다(코드 변경 0):

- **non-2xx 매핑(현 동작)** — [llm-http-gateway.service.ts L198](../../src/llm/llm-http-gateway.service.ts) 가 `!response.ok` 시 `{provider} HTTP 호출 실패 (status: {status})` Error throw. live endpoint 의 rate-limit(429)·5xx·auth 실패(401/403) 도 이 단일 경로로 status 포함 throw 된다. layer (2) stub smoke 가 이미 localhost 500 으로 이 경로를 검증했으므로([roundtrip.smoke-spec.ts](../../test/smoke/llm-gateway-roundtrip.smoke-spec.ts) negative it), live 의 non-2xx 도 동형으로 매핑된다 — live smoke 는 happy-path(2xx + narrative)만 검증하고 non-2xx 재현은 layer (2) 에 위임(실 endpoint 에 의도적 실패를 유도하지 않는다 — flaky/비용 회피).
- **timeout(현 부재)** — 현 gateway 는 명시 timeout(AbortController 등)을 두지 않는다 — 주입된 fetch 의 기본 동작에 따른다. live endpoint 의 hang 위험은 본 ADR 이 **인지·기술**하되 코드 도입은 별도 task(Out of Scope). live smoke 는 jest 기본 timeout(또는 spec 내 `jest.setTimeout`) 안에서 1 회 호출하며, timeout 초과는 jest 자체가 실패로 보고한다(별도 매핑 0). 명시 timeout/AbortController 도입은 credentialed live-run task 또는 별도 hardening task 책임.
- **책임 경계 요지** — mocked unit(1) 은 분기, stub smoke(2) 는 transport + non-2xx 실수신, live smoke(3) 은 실 endpoint happy round-trip. error 매핑 코드는 세 layer 가 동일한 현 gateway 경로를 공유 — 본 task 는 그 경로를 바꾸지 않는다.

## Consequences

### 양의 (positive)

1. **dependency-free 즉시 착수** — Node 내장만(새 dep 0), 실 credential 0 으로 live contract 와 scaffold 를 지금 박제 → [CLAUDE.md §5](../../CLAUDE.md) 게이트 미발화. credential 은 후속 task 가 env 주입.
2. **public CI green 보존** — Decision §2 의 gating env 부재 → describe.skip 으로 CI 는 실 네트워크 0·secret 0·비용 0 으로 green. R-113 smoke 게이트는 stub round-trip(2) + skip 된 live(3) 로 여전히 통과.
3. **순수 helper 의 testability** — gating 판정을 순수 함수로 분리해 R-112 happy/error/negative 를 unit-test 가능. skip 본문 미테스트 risk(entrypoint 분기 묻힘 안티패턴) 회피.
4. **layer 경계 명시** — mocked/stub/live 3 layer 의 책임이 본 ADR 표로 박제 → 후속 credentialed task 가 어느 layer 를 활성화하는지 모호성 0.
5. **adapter 재사용** — Decision §3 이 기존 openai-compatible.adapter 의 build/parse 계약을 그대로 재사용 → live 전용 wire 코드 중복 0, custom provider 계약 합치.

### 음의 (negative) / trade-off

1. **live 경로의 CI 미검증** — gating skip 이라 public CI 는 live 코드의 실 실행을 검증하지 않는다(skip 만 검증). mitigation: 순수 helper 의 gating 분기는 unit-test 로 full cover + credentialed live-run task 가 실 endpoint 로 1 회 검증.
2. **gating 4 env 운영 부담** — 사람이 local/전용 workflow 에 4 env 를 정확히 주입해야 live 활성. mitigation: helper 의 `reason` 필드가 어느 env 가 부재해 skip 됐는지 사람에게 보고.
3. **timeout 부재 잔존** — Decision §4 상 명시 timeout 미도입 → live endpoint hang 시 jest 기본 timeout 까지 대기. mitigation: spec 내 `jest.setTimeout` 상한 + 별도 hardening task 로 AbortController 도입 가능.

### 후속 task chain

| 후속 task | scope | dependency | BLOCKED risk |
| --- | --- | --- | --- |
| **credentialed live-run** | 사용자가 `LLM_LIVE_TEST`/`LLM_LIVE_BASE_URL`/`LLM_LIVE_API_KEY`(+필요 시 `LLM_APIKEY_ENC_KEY`)를 env/secret 주입 후 gated live smoke 를 실 네트워크 1 회 실행 검증. 필요 시 전용 workflow(secret 주입 step) | 본 task 머지 후 + 사용자 credential 제공 | **있음 — [§5](../../CLAUDE.md) 외부 자격증명 게이트** |
| **live timeout hardening** | `LlmHttpGateway` 에 AbortController 기반 명시 timeout 도입 + R-112 negative(timeout 발화) | 본 ADR 후 | 없음(Node 내장) |
| **custom 외 provider live 확장** | azure/anthropic/gemini live 동형 확장(각 별도 task) | custom live 검증 후 | provider 별 credential 게이트 |
| **ADR-0015 PROPOSED→ACCEPTED** | merge 후 status 한 줄 갱신(direct) | 본 task 머지 | 없음 |

## Alternatives considered

| 대안 | 장점 | 단점 / 정합도 | 채택 여부 |
| --- | --- | --- | --- |
| **(1) env-gated skip-unless-credentialed live smoke + 순수 gating helper** (채택) | public CI green 보존(skip) / 실 credential 0 으로 즉시 착수 / R-112 helper testable / mocked·stub layer 와 경계 명시 / adapter 재사용 | live 경로 자체는 CI 미검증(후속 task 가 검증) / 4 env 운영 부담 | **✓ 채택** |
| (2) live test 를 항상 실행(gating 없음) | live 경로가 매 CI 에서 실 검증 | **secret-leak(API key 가 CI 로그 노출)** + flaky(외부 provider 가용성·rate-limit) + 비용(과금 호출) + [§9](../../CLAUDE.md)/R-113 정합 0(public CI 에 credential 상주) | 기각 — secret-leak/flaky/비용 |
| (3) live test 미작성(option A 미검증) | 구현 0 / 복잡도 0 | **Q-0016 optionADecision(option A 승인) 위반** — milestone-1 live 통합이 영구 미검증 / 후속 credentialed task 가 scaffold 없이 from-scratch | 기각 — option A 미검증 |

## References

- [docs/STATE.json](../STATE.json) `humanQuestions[Q-0016].optionADecision` — option A 승인 + 2 단계 분해 지시(본 ADR 의 직접 motivation)
- [docs/decisions/ADR-0014-llm-api-key-encryption-at-rest.md](ADR-0014-llm-api-key-encryption-at-rest.md) §2 — `LLM_APIKEY_ENC_KEY` env 이름(본 ADR 재사용) + secret 값 0 기재 패턴
- [src/llm/llm-http-gateway.service.ts](../../src/llm/llm-http-gateway.service.ts) — `LlmHttpGateway.generate`(live 경로가 호출, non-2xx 매핑 현 동작 — Decision §4)
- [src/llm/providers/openai-compatible.adapter.ts](../../src/llm/providers/openai-compatible.adapter.ts) — custom wire shape baseline(Decision §3)
- [src/llm/llm-http-gateway.service.spec.ts](../../src/llm/llm-http-gateway.service.spec.ts) — mocked unit layer(1)
- [test/smoke/llm-gateway-roundtrip.smoke-spec.ts](../../test/smoke/llm-gateway-roundtrip.smoke-spec.ts) — stub round-trip smoke layer(2, T-0168/Q-0016 decision B)
- [test/jest-smoke.json](../../test/jest-smoke.json) — smoke testRegex + globalSetup(신규 live spec 의 suffix·DB 비의존 근거)
- [CLAUDE.md §3.2 R-112/R-113](../../CLAUDE.md) — entrypoint-helper 분리 + smoke/e2e CI 게이트
- [CLAUDE.md §5 / §9](../../CLAUDE.md) — 자격증명 BLOCKED 게이트 + secret 값 미기재(env 이름만)

Refs: T-0171, ADR-0014, REQ-096, REQ-097
