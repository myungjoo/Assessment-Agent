---
id: ADR-0045
title: "LLM provider 는 배포-환경 설정이다 — provider-agnostic live-verification 원칙 (어떤 provider 도 mandated/default 아님 + live 검증을 특정 cloud credential 에서 분리)"
status: ACCEPTED
date: 2026-06-18
acceptedAt: 2026-06-18
relatedTask: null
supersedes: null
augments: [ADR-0015, ADR-0025, ADR-0037]
relatedReq: [REQ-096, REQ-097]
---

# ADR-0045 — LLM provider 는 배포-환경 설정이다 (provider-agnostic live-verification)

> 본 ADR 은 **ACCEPTED** (2026-06-18, repo owner 가 아래 §ACCEPTED 전제조건 3개를 /loop 세션에서 모두 수락 — 결정 record 는 그 절 말미 참조). 새 메커니즘·새 코드·새 dependency 를 도입하지 **않으며**, 이미 main 에 박제된 provider-중립 설계 (`LlmProviderConfig` DB row + `LlmHttpGateway` 어댑터 + `llm-live-test-gating.ts` 의 custom↔azure 분기) 위에 **"LLM provider = 배포-환경 설정(deployment-environment configuration)" 이라는 명시적 원칙을 결정으로 확정**한다. 본 ADR 은 [ADR-0015](ADR-0015-llm-live-integration-test-contract.md)(custom live 계약)·[ADR-0025](ADR-0025-azure-openai-live-test-contract.md)(azure live 계약)·[ADR-0037 §Decision5](ADR-0037-period-collection-evaluate-bridge.md)(live 검증 deferred) 를 **폐기하지 않고 보강(augment)** 한다 — 그 위에 환경-중립 layer 를 올린다.

## ACCEPTED 전제조건 / 검토 포인트 (수락 완료 — record 는 절 말미)

본 ADR 이 ACCEPTED 로 flip 되기 전 사용자가 확인할 점:

1. **"어떤 provider 도 default/mandated 아님" 원칙에 동의하는가** — 본 ADR 은 로컬 LLM(Ollama/LM Studio/vLLM)·azure·anthropic·gemini·OpenAI-호환 cloud 를 **모두 동등한 valid config** 로 보고, 코드/CI 어디에도 특정 provider 를 default 로 박지 않음을 결정한다. 이 중립 원칙 자체가 검토 대상이다.
2. **live 검증을 azure 시험 credential(만료 2026-06-30)에서 분리하는 방향에 동의하는가** — [ADR-0037 §Decision5](ADR-0037-period-collection-evaluate-bridge.md) + [Q-0040 옵션2](../STATE.json)(STATE 의 live-LLM bridge 검증)가 그동안 만료 임박한 azure 키에 묶여 있었다. 본 ADR 은 "그 실행 환경이 가진 아무 provider 로 1회 round-trip" 이면 배선 검증이 충족된다고 결정해, azure 키 만료와 무관하게 검증이 영구 성립하도록 한다. 이 결합 해제가 핵심 검토 포인트다.
3. **검증(배선 동작)과 품질(평가문 수준)의 분리에 동의하는가** — 본 ADR 은 로컬 7~14B 모델 vs cloud flagship 의 **품질 판단을 하지 않는다**. live 검증은 "transport·인증·파싱 배선이 실 endpoint 와 합치하는가" 만 확인하고, 평가문 품질(LLM 정성 평가의 수준)은 별도 결정으로 남긴다.

**결정 record (ACCEPTED 2026-06-18)** — repo owner 가 위 3개 검토 포인트를 /loop 세션에서 **모두 수락**했다: (1) "어떤 provider 도 default/mandated 아님" 중립 원칙 동의, (2) live 검증을 azure 시험 credential(만료 2026-06-30)에서 분리하는 방향 동의, (3) 검증(배선)과 품질(평가문 수준)의 분리 동의. 이로써 status 는 ACCEPTED 로 확정됐다. 후속 구현 task(로컬 런너 live 검증 실수행 등)는 §Out of scope / §Follow-ups 로 분해한다.

## Context

### 트리거 — live 검증이 만료 임박 cloud credential 에 묶여 있다

[ADR-0037 §Decision5](ADR-0037-period-collection-evaluate-bridge.md) 가 period→collection→evaluate bridge 의 **live-LLM 검증을 §5 credential 게이트로 deferred** 했고, 그 deferred 가 [Q-0040](../STATE.json) 의 live-LLM bridge 검증으로 이어지면서 실제 검증 타깃이 **만료 임박(2026-06-30)한 azure 시험 credential**(ADR-0025 Context 의 `karina-east-us-2` / secrets.env)에 사실상 결합돼 있었다. 즉 "배선이 동작하는가" 라는 검증이 "특정 cloud 키가 유효한가" 에 종속됐다 — 키가 만료되면 영구 미검증 상태로 회귀하는 잘못된 결합이다.

### 핵심 사실 — 이 시스템은 **이미** provider-agnostic 하다

본 ADR 은 새 중립성을 도입하는 게 아니라, 이미 박제된 중립성을 **명시적 결정으로 확정**한다. 근거:

- **provider = DB row 설정**: provider 선택은 코드에 박힌 상수가 아니라 [LlmProviderConfigRepository](../../src/llm/llm-provider-config.repository.ts) 의 `LlmProviderConfig` 영속 row 로 표현된다 — Admin 이 instance 별 endpoint / API key(at-rest 암호화, [ADR-0014](ADR-0014-llm-api-key-encryption-at-rest.md)) / model 을 지정한다. provider 를 바꾸는 것은 **코드 변경이 아니라 설정(row) 변경**이다.
- **gateway = 어댑터 dispatch**: [LlmHttpGateway](../../src/llm/llm-http-gateway.service.ts) 는 `config.provider` 에 따라 `azure_openai` / `openai-compatible`(custom) / `anthropic` / `gemini` 4 종 어댑터([src/llm/providers/](../../src/llm/providers/))를 dispatch 한다. 어느 provider 든 동일한 `generate(...)` 추상화 뒤에 있다.
- **live-smoke gating 도 provider-중립**: [src/llm/llm-live-test-gating.ts](../../src/llm/llm-live-test-gating.ts) 의 `resolveLiveTestGating` 은 `LLM_LIVE_PROVIDER` 로 custom↔azure 를 분기하는 **provider-중립 구조**다(부재 = custom default — backward-compat). custom 경로는 `Authorization: Bearer` + `{baseUrl}/chat/completions`, azure 경로는 `api-key` 헤더 + `/openai/deployments/<dep>/...?api-version=` 로 갈라지되, gating·skip·invariant 형태는 동형(mirror)이다.
- **live-smoke spec 들도 중립**: `test/smoke/period-bridge-live.smoke-spec.ts`·`test/smoke/llm-live-azure.smoke-spec.ts` 는 gating env 부재 시 `describe.skip` 으로 public CI green 을 유지하는 skip-unless-credentialed 패턴([ADR-0015](ADR-0015-llm-live-integration-test-contract.md) §2 / [ADR-0025](ADR-0025-azure-openai-live-test-contract.md) §3)을 공유한다 — 어느 provider env 가 주입되든 그 env 가 가리키는 endpoint 로 1회 round-trip 한다.

### 외력

- **[ADR-0015](ADR-0015-llm-live-integration-test-contract.md)** — custom(OpenAI-호환) live-test 계약. 본 ADR 은 이 계약을 폐기하지 않고, "custom 경로 = 로컬/원격 OpenAI-호환 endpoint" 가 **여러 valid 배포 환경 중 하나**임을 확정한다.
- **[ADR-0025](ADR-0025-azure-openai-live-test-contract.md)** — azure live-test 계약. 본 ADR 은 이 계약도 폐기하지 않고, azure 를 **여러 검증 타깃 중 하나**로 격하한다(default/mandated 아님).
- **[ADR-0037 §Decision5](ADR-0037-period-collection-evaluate-bridge.md)** — bridge live 검증의 credential deferred. 본 ADR 이 그 deferred 의 **결합 대상을 "특정 cloud 키" 에서 "실행 환경이 가진 아무 provider" 로 교체**한다(아래 Decision §3).
- **[CLAUDE.md §5](../../CLAUDE.md)** — 새 외부 dependency / 새 credential 은 BLOCKED. 본 결정은 **새 dependency 0**(gateway 는 Node 내장 fetch 로 localhost/원격 endpoint 호출 — package.json 변경 없음), **새 credential 강제 0**(오히려 cloud credential 을 검증 critical path 에서 제거). 따라서 §5 게이트를 어느 축도 발화하지 않는다.
- **[CLAUDE.md §9](../../CLAUDE.md)** — 실 credential 값은 코드/STATE/journal/ADR/spec 어디에도 기재 금지. 본 ADR 은 env 변수 **이름** 만 참조하며 실 endpoint key / 로컬 model 가중치 경로 등의 실값을 기재하지 않는다.

## Decision

### Decision §1 — LLM provider 는 코드 선택이 아니라 배포-환경 설정이다

**채택: LLM provider 는 코드에 박힌 선택이 아니라 "배포-환경 설정(deployment-environment configuration)" 이며, 그 선택은 (a) 런타임에서 `LlmProviderConfig` DB row(Admin 지정 endpoint/key/model) (b) live-verification 에서 gating env(`LLM_LIVE_PROVIDER` + `LLM_LIVE_*`)로 표현된다. provider 를 바꾸는 것은 코드 변경이 아니라 설정 변경이다.**

- 본 결정은 **새 메커니즘을 도입하지 않는다** — 이미 main 에 존재하는 `LlmProviderConfig` row + `LlmHttpGateway` dispatch + `resolveLiveTestGating` 분기가 이 환경-중립성을 구현하고 있다. 본 §1 은 그것을 **명시적 결정으로 확정**해, 향후 누구도 "provider 를 코드에 hard-code" 하는 방향으로 drift 하지 않도록 못 박는다.
- 운영(런타임)·검증(live-smoke) 두 평면 모두에서 provider 는 설정 표면(DB row / env)에 산다 — 어느 평면에서도 특정 provider 가 소스 코드 상수로 박히지 않는다.

### Decision §2 — 어떤 provider 도 mandated/default 가 아니다 — 모두 동등한 valid config

**채택: openai-compatible 로컬 런너(Ollama / LM Studio / vLLM 등, localhost 의 `/v1`), `azure_openai`, `anthropic`, `gemini`, 기타 OpenAI-호환 cloud(OpenAI / Together / Groq 등)가 **모두 동등하게 valid 한 config** 다. 어느 하나도 시스템에 baked-in(default/mandated)되지 않는다.**

- **로컬 LLM 은 "여러 valid 환경 중 하나"** — 개발/테스트 머신이 로컬 LLM(예: RTX 4070 12GB 에서 Qwen2.5 / EXAONE 7~14B)으로 도는 것은 지원되는 배포 환경 config 중 하나일 뿐, 시스템에 채택/도입/baked-in 되는 게 **아니다**. localhost OpenAI-호환 endpoint 는 ADR-0015 의 custom 경로(`LLM_LIVE_PROVIDER` 부재/custom)로 그대로 흡수된다 — 새 어댑터·새 env 0.
- **default 박기 금지(NON-goal)** — 코드/CI/config 어디에도 특정 provider 를 default 로 박는 순간 "여러 환경 중 하나" 가 "환경 강제" 로 변질돼 본 결정의 취지를 깬다. 따라서 **default provider 변경 0, CI 가 특정 provider 를 가정 0** 을 명시 금지로 박제한다(§Consequences NON-goal).
- **gating default 의 의미 한정** — `resolveLiveTestGating` 의 "`LLM_LIVE_PROVIDER` 부재 → custom" 은 ADR-0015 backward-compat 를 위한 **경로 분기 default 일 뿐**, "custom 이 시스템의 default provider" 라는 뜻이 **아니다**. provider env 자체가 부재하면 live smoke 는 skip(검증 미수행)이지 custom 으로 강제 실행되는 게 아니다.

### Decision §3 — live-verification 을 특정 cloud credential 에서 분리한다

**채택: live-verification(배선 검증)은 특정 cloud credential 의 유효성과 분리된다. live-smoke 가 이미 provider-중립이므로, 검증은 **"그 실행 환경이 가진 아무 provider 로 1회 round-trip"** 이면 충족된다. 개발 머신에서는 custom 경로(localhost OpenAI-호환)로 검증을 수행해 azure 키 만료(2026-06-30)와 무관하게 배선 검증이 **영구적으로 성립**하게 한다. azure / anthropic 등 cloud 키는 "여러 검증 타깃 중 하나" 로 격하된다.**

- **결합 해제**: [ADR-0037 §Decision5](ADR-0037-period-collection-evaluate-bridge.md) 의 live 검증 deferred 가 묶여 있던 대상은 "만료 임박 azure 시험 credential" 이었다. 본 ADR 은 그 deferred 를 폐기하지 않고, **검증 타깃을 "실행 환경이 가진 아무 provider"** 로 일반화한다 — 검증의 충분조건은 "실 endpoint 에 1회 round-trip 해 비어있지 않은 narrative 를 받는다"(ADR-0015 §3 / ADR-0025 §2 의 invariant 형태) 이지 "azure 키가 유효하다" 가 아니다.
- **검증 critical path 에서 cloud credential 제거**: 개발 머신이 localhost OpenAI-호환 런너를 띄우면 custom 경로(`LLM_LIVE_TEST` + `LLM_LIVE_BASE_URL=http://localhost:<port>/v1` + `LLM_LIVE_API_KEY=<로컬 런너가 요구하는 임의값/dummy>`)로 live smoke 가 활성화돼 배선이 검증된다. 이로써 [CLAUDE.md §5](../../CLAUDE.md) cloud-credential 게이트가 **검증 critical path 에서 사라진다** — 검증이 외부 cloud 키 제공 여부에 더 이상 종속되지 않는다.
- **cloud 키의 격하**: azure(ADR-0025) / anthropic / gemini / OpenAI-호환 cloud 키는 검증을 **막는 게이트가 아니라 추가 검증 타깃**이 된다 — 있으면 그 provider 로도 round-trip 검증을 더 할 수 있고, 없어도 로컬 custom 경로로 배선 검증이 성립한다. azure live smoke(`test/smoke/llm-live-azure.smoke-spec.ts`)는 그대로 유지되며 azure gating env 주입 시에만 활성(독립 skip/run, ADR-0025 §3).
- **검증 ≠ 품질(분리 명시)**: 본 §3 의 live-verification 은 **배선 동작**(transport·인증 헤더·URL 라우팅·응답 파싱이 실 endpoint 와 합치)만 확인한다. **로컬 7~14B 모델 vs cloud flagship 의 평가문 품질 판단은 본 결정 밖**이다(별도 결정). 로컬 custom 경로로 배선이 green 이어도 그것은 "배선이 동작한다" 의 증거일 뿐 "평가문 품질이 충분하다" 의 증거가 아니다 — 품질은 평가문 수준에 대한 별도 평가/결정으로 다룬다.

### Decision §4 — 새 dependency / 새 mechanism 0 (확정 박제)

**채택: 본 ADR 은 새 외부 dependency 0 / 새 mechanism 0 / 새 mandated credential 0 으로 완결된다. gateway 는 Node 내장 fetch 로 localhost / 원격 endpoint 를 호출할 뿐이며, package.json·CI workflow·gating helper 의 동작 코드를 변경하지 않는다.**

- **새 dependency 0** — localhost OpenAI-호환 런너 호출은 기존 `openai-compatible.adapter` + `LlmHttpGateway` 의 내장 fetch 경로 그대로다. Ollama/LM Studio/vLLM 자체는 **개발 머신의 외부 프로세스(배포 환경 일부)** 이지 본 repo 의 npm dependency 가 **아니다** — package.json 변경 0.
- **새 mechanism 0** — `LlmProviderConfig` row / `LlmHttpGateway` dispatch / `resolveLiveTestGating` 분기 모두 이미 존재. 본 ADR 은 이들을 변경하지 않고 그 위에 **원칙(결정)만 올린다**.
- **새 mandated credential 0** — 오히려 cloud credential 을 검증 critical path 에서 제거한다(§3). 따라서 [CLAUDE.md §5](../../CLAUDE.md) BLOCKED 게이트(새 dep / 새 credential / schema migration)를 어느 축도 발화하지 않는다.

## Consequences

### 긍정

- **live 검증이 cloud 키 만료와 영구 분리** — 개발 머신의 localhost custom 경로로 배선 검증이 항상 성립하므로, azure 시험 credential 만료(2026-06-30) 후에도 [ADR-0037 §Decision5](ADR-0037-period-collection-evaluate-bridge.md) live 검증이 영구 미검증으로 회귀하지 않는다.
- **§5 cloud-credential 게이트가 검증 critical path 에서 제거** — 배선 검증이 외부 cloud 키 제공 여부에 종속되지 않아, dependency-free / credential-free 로 live round-trip 검증을 수행할 수 있다.
- **provider drift 차단** — "provider = 배포 설정" 원칙이 명시 박제돼, 향후 누구도 특정 provider 를 코드/CI default 로 박는 방향으로 drift 하지 않는다(§Consequences NON-goal 가 reviewer 점검 대상).
- **기존 ADR 보강(폐기 0)** — ADR-0015(custom)·ADR-0025(azure)·ADR-0037(deferred)을 그대로 유지하며 그 위에 환경-중립 layer 만 올린다 — 머지된 계약·history 와 충돌 0.
- **새 dependency 0 / 새 mechanism 0 / 새 mandated credential 0** — CLAUDE.md §5 BLOCKED 게이트 미발화. 이미 박제된 중립 설계를 결정으로 확정할 뿐이라 구현 risk 가 낮다.

### 부정 / trade-off

- **로컬 런너 운영 부담** — 개발 머신에서 live 검증을 하려면 사람이 localhost OpenAI-호환 런너(Ollama/LM Studio/vLLM)를 띄우고 model 을 로드해야 한다. mitigation: 런너 부재 시 gating env 가 비어 live smoke 는 skip(검증 미수행)이고 public CI 는 green 유지 — 검증은 옵션이지 강제가 아니다.
- **로컬 model 품질 ≠ cloud flagship** — localhost 7~14B 모델로 배선이 green 이어도 평가문 **품질**은 cloud flagship 과 다를 수 있다. 본 ADR 은 검증(배선)과 품질을 분리(§3)하므로 품질 판단은 별도 결정으로 남는다 — 배선 green 을 품질 보증으로 오해하면 안 된다(reviewer / 사용자 인지 필요).
- **검증 환경 비결정성** — "실행 환경이 가진 아무 provider" 라는 일반화는 검증 환경이 머신마다 다를 수 있음을 뜻한다(머신 A 는 localhost custom, 머신 B 는 azure). mitigation: 어느 환경이든 동일한 invariant("실 endpoint 1회 round-trip → 비어있지 않은 narrative")를 검증하므로 배선 합치 판정은 환경 무관하게 동등하다(provider 별 wire 차이는 어댑터가 흡수).

### NON-goal (명시 금지 — 박제)

- **새 외부 dependency 추가 0** — gateway 는 Node 내장 fetch 로 localhost/원격 endpoint 를 호출할 뿐. package.json 변경 없음. 로컬 런너(Ollama 등)는 개발 머신의 외부 프로세스이지 repo dependency 가 아니다.
- **default provider 변경 0** — 코드/config 어디에도 특정 provider 를 default 로 박지 않는다. 박는 순간 "환경 중 하나" 가 "환경 강제" 로 변질돼 본 결정의 취지를 깬다.
- **CI 가 특정 provider 가정 0** — public CI 는 어느 provider gating env 도 갖지 않아 live smoke 를 skip 한다(green). CI 가 특정 provider 로 live 호출하도록 만들지 않는다(secret-leak / flaky / 비용 — ADR-0015 §Alternatives 2 기각 사유 그대로).
- **로컬 LLM "채택/도입" 아님** — 본 ADR 은 로컬 LLM 을 지원되는 환경 config 중 하나로 **문서화**할 뿐, 그것을 시스템에 채택/도입하는 결정이 **아니다**.

### Cross-Module Impact

본 결정은 **public API / shared symbol contract 를 변경하지 않는다** — `LlmProviderConfigRepository` / `LlmHttpGateway.generate` / `resolveLiveTestGating` / 4 어댑터의 기존 시그니처를 **전부 변경 0** 으로 유지한다(import 재사용·동작 코드 무변경). 따라서 hard rule(cross-module impact)의 "public API / shared symbol contract 변경" 에 해당하는 파괴적 변경이 없어 inbound caller scan / BLOCKED(cross-module-spread) 게이트가 발화하지 않는다.

- **영향 표면 = 문서 + 원칙 박제(코드 0)** — 본 ADR 은 ADR 파일 1 개 + (필요 시) `deployment.md` 한 문단 추가뿐. `src/` 코드 변경 0, 어댑터/gateway/gating 의 contract 변경 0.
- **provider 추가/교체 시에도 contract 무변경** — 새 provider 환경(예: localhost custom)은 기존 어댑터 경로로 흡수되므로 caller(`LlmHttpGateway` 를 호출하는 evaluation pipeline 등)는 영향받지 않는다 — provider 는 설정 표면(row/env)에서만 갈린다.

## Alternatives considered

### A. provider-중립 원칙을 명시 결정으로 확정 (채택)

이미 박제된 `LlmProviderConfig` row + 어댑터 dispatch + gating 분기를 "provider = 배포 설정" 원칙으로 확정하고, live 검증을 "실행 환경이 가진 아무 provider 1회 round-trip" 으로 일반화하는 안. **채택** — 새 mechanism/dependency/credential 0 으로 (i) live 검증을 만료 임박 cloud 키에서 영구 분리하고 (ii) provider drift 를 차단하며 (iii) ADR-0015/0025/0037 을 폐기 없이 보강한다.

### B. azure live 검증만 유지(현상 — live 검증을 azure credential 에 결합한 채) (미채택)

[ADR-0037 §Decision5](ADR-0037-period-collection-evaluate-bridge.md) + [Q-0040](../STATE.json) 의 live 검증을 azure 시험 credential 에 그대로 묶어 두는 안. 미채택 — azure 키 만료(2026-06-30) 시 live 검증이 **영구 미검증으로 회귀**한다(잘못된 결합). live-smoke 가 이미 provider-중립인데도 검증을 특정 cloud 키에 종속시키는 것은 §5 credential 게이트를 검증 critical path 에 불필요하게 상주시킨다.

### C. 로컬 LLM 을 system default 로 채택(코드/CI 에 박기) (미채택)

로컬 OpenAI-호환 런너를 default provider 로 코드/CI 에 박아 검증을 단순화하는 안. 미채택 — "여러 valid 환경 중 하나" 를 "환경 강제(default)" 로 변질시켜 본 ADR §2 의 중립 취지를 정면으로 깬다. 또한 CI 가 특정 provider 를 가정하면 secret-leak/flaky/비용 risk([ADR-0015](ADR-0015-llm-live-integration-test-contract.md) §Alternatives 2 기각 사유)가 되살아난다. provider 는 설정 표면에 남아야 하며 default 로 박혀선 안 된다.

### D. 로컬 LLM 도입을 품질까지 포함해 결정 (미채택)

로컬 7~14B 모델의 평가문 품질이 cloud flagship 을 대체할 수 있는지까지 본 ADR 에서 함께 결정하는 안. 미채택 — 검증(배선 동작)과 품질(평가문 수준)은 서로 다른 결정 축이고, 품질 판단은 평가문 수준에 대한 별도 평가·근거를 요구한다. 본 ADR 은 **배선 검증의 provider-중립성** 만 확정하고 품질은 별도 결정으로 분리(§3)해 scope 를 단일 결정으로 유지한다([CLAUDE.md](../../CLAUDE.md) one-decision-per-ADR).

## Out of scope

본 ADR 은 **원칙(결정)만 박제**한다 — 다음은 후속 task / 별도 결정 책임:

- **로컬 런너로 live 검증 실수행** — 개발 머신에 localhost OpenAI-호환 런너를 띄우고 custom gating env 주입 후 live smoke 1회 round-trip 실행(§Follow-ups). 새 dependency 0(런너는 외부 프로세스), 검증 결과는 배선 green 만.
- **평가문 품질 평가** — 로컬 모델 vs cloud flagship 의 평가문 수준 비교는 별도 결정/평가 task.
- **gating helper 코드 변경** — 본 ADR 은 `resolveLiveTestGating` 동작을 변경하지 않는다. 추가 provider(anthropic/gemini) 의 live gating 확장이 필요해지면 별도 task([ADR-0015](ADR-0015-llm-live-integration-test-contract.md) 후속 chain mirror).
- **provider 선택 운영 UX** — Admin UI 에서 `LlmProviderConfig` row 를 편집하는 UX 는 본 ADR 밖(기존 controller/UX task 책임).

## References

- [docs/decisions/ADR-0015-llm-live-integration-test-contract.md](ADR-0015-llm-live-integration-test-contract.md) — custom(OpenAI-호환) live-test 계약 + skip-unless-credentialed gating(본 ADR 이 보강 — custom 경로 = 로컬/원격 OpenAI-호환 환경 중 하나)
- [docs/decisions/ADR-0025-azure-openai-live-test-contract.md](ADR-0025-azure-openai-live-test-contract.md) — azure live-test 계약 + secrets.env credential 경로(본 ADR 이 보강 — azure 를 "여러 검증 타깃 중 하나" 로 격하)
- [docs/decisions/ADR-0037-period-collection-evaluate-bridge.md](ADR-0037-period-collection-evaluate-bridge.md) §Decision5 — bridge live 검증의 credential deferred(본 ADR 이 그 결합 대상을 "실행 환경이 가진 아무 provider" 로 교체)
- [docs/decisions/ADR-0014-llm-api-key-encryption-at-rest.md](ADR-0014-llm-api-key-encryption-at-rest.md) §2 — `LLM_APIKEY_ENC_KEY` at-rest 키(LlmProviderConfig 의 apiKey 암호화 — provider config 의 보안 표면)
- [src/llm/llm-live-test-gating.ts](../../src/llm/llm-live-test-gating.ts) — `resolveLiveTestGating` custom↔azure provider-중립 분기(본 ADR §1·§3 의 중립성 근거 코드)
- [src/llm/llm-http-gateway.service.ts](../../src/llm/llm-http-gateway.service.ts) — `LlmHttpGateway` provider dispatch(내장 fetch — 새 dependency 0)
- [src/llm/llm-provider-config.repository.ts](../../src/llm/llm-provider-config.repository.ts) — `LlmProviderConfig` row(provider = 배포 설정 표면)
- [src/llm/providers/](../../src/llm/providers/) — azure_openai / openai-compatible / anthropic / gemini 어댑터(provider 별 wire 흡수)
- [docs/architecture/deployment.md](../architecture/deployment.md) "외부 네트워크 boundary" — 5 provider 접근 대상(custom = 사내/사용자 지정 OpenAI-호환 포함)
- [docs/STATE.json](../STATE.json) — Q-0040(live-LLM bridge 검증 — 본 ADR 이 검증을 cloud 키 만료에서 분리)
- [CLAUDE.md §1 / §5 / §9 / §12](../../CLAUDE.md) — stack 제약 / BLOCKED 게이트(새 dep·credential 미발화) / secret 미기재 / 언어 정책

Refs: ADR-0015, ADR-0025, ADR-0037, ADR-0014, REQ-096, REQ-097, Q-0040
