---
id: T-0228
title: azure_openai live-test smoke spec 신설 (test/smoke/llm-live-azure.smoke-spec.ts)
phase: P4
status: DONE
commitMode: pr
coversReq: [REQ-096, REQ-097]
estimatedDiff: 120
estimatedFiles: 1
created: 2026-06-04
completedAt: 2026-06-04T15:48:00+09:00
prNumber: 199
mergedAs: c18cd77
reviewRounds: 1
plannerNote: P4 milestone-1 2a split 2/2 — ADR-0025 Decision §2·§3·§5·§6 의 azure live smoke spec(custom mirror). T-0227 gating helper 의존. single-spec × 1.0.
result: DONE — test/smoke/llm-live-azure.smoke-spec.ts 신설(custom mirror, azure wire shape, gating "azure"→LlmProvider.AzureOpenai 매핑, describe.skip no-env CI green). reviewer APPROVE r1 0 findings(매핑·skip-clean·secret 확인). CI green 1회(race 없음), 4-gate PASS, squash merge c18cd77. milestone-1 2a 완결. tasksCompleted 225→226. 후속=T-0229(ADR-0025 PROPOSED→ACCEPTED flip, direct).
---

# T-0228 — azure_openai live-test smoke spec 신설

## Why

ADR-0025(MERGED, 7103cbc) 가 Q-0021 의 azure_openai live target(deployment `gpt-5.4` / `https://karina-east-us-2-api.openai.azure.com`) 을 위한 env-gated live smoke 계약을 박제했고, T-0227(MERGED, ed8e369) 이 그 gating 판정(`resolveLiveTestGating` 의 azure 분기 — `LLM_LIVE_PROVIDER`/`LLM_LIVE_API_VERSION` + 5-field 완전성)을 helper 로 구현했다. 본 task 는 그 **2a 의 마지막 slice** — ADR-0025 Decision §2(azure wire shape)·§3(describe.skip gating)·§5(provider 분기 경계)·§6(cipher stub 우회) 에 따라 azure live smoke spec(`test/smoke/llm-live-azure.smoke-spec.ts`)을 신설한다. 기존 custom live smoke(`test/smoke/llm-live.smoke-spec.ts`)를 mirror 하되 azure wire shape 로 교체한다.

본 task 는 새 외부 dependency 0 / 실 credential 0 — gating env 부재 시 `describe.skip` 으로 전 it 가 skip 되어 public CI 는 green 유지(R-113). 실 네트워크 1회 호출은 본 task 가 아니라 후속 (2b) credentialed live run(§5 게이트, deferred) 이 로컬 secrets.env 주입 시 수행한다. 본 task 의 CI 검증 책임은 **skip path 가 `pnpm test:smoke` 에서 깨끗하게 skip 되며 green** 임을 확인하는 것까지다.

## Required Reading

- `docs/decisions/ADR-0025-azure-openai-live-test-contract.md` — 계약 정본. Decision §2(azure wire shape: URL `/openai/deployments/<deployment>/chat/completions?api-version=`, `api-key` 헤더, apiVersion 필수, body 에 model 없음, response invariant)·§3(describe.skip gating + custom 과 독립 별도 파일)·§5(provider 분기 — repository stub 의 `provider: LlmProvider.AzureOpenai` + base host endpointUrl)·§6(cipher stub 우회).
- `test/smoke/llm-live.smoke-spec.ts` — mirror reference(custom live smoke). gating·격리·describe.skip·repository/cipher/difficultyMappingService stub·invariant assert 패턴을 그대로 따른다.
- `src/llm/llm-live-test-gating.ts` — T-0227 으로 merge 된 azure 분기. `resolveLiveTestGating(process.env)` 가 반환하는 `LiveTestGating`(`provider: "custom" | "azure"`, `enabled`, `baseUrl?`, `apiKey?`, `apiVersion?`, `model`, `reason`). **본 spec 은 `gating.enabled` 로 describe 분기**.
- `src/llm/providers/azure-openai.adapter.ts` — azure wire shape 정본(`buildAzureOpenaiRequest`/`parseAzureOpenaiResponse`). gateway 가 이 adapter 로 분기하므로 spec 은 adapter 를 직접 부르지 않고 `LlmHttpGateway.generate` 를 호출한다.
- `src/llm/llm-http-gateway.service.ts` — gateway 가 `config.provider === LlmProvider.AzureOpenai` 일 때 azure adapter 로 build/parse dispatch 함. **중요(L52~55, L155~163)**: gateway 는 apiVersion 을 config/env 가 아니라 상수 `AZURE_OPENAI_DEFAULT_API_VERSION = "2024-02-15-preview"` 로 공급한다 — apiVersion 영속 컬럼이 아직 없기 때문. 즉 `gating.apiVersion`(env) 은 **gating 완전성 판정용**이고 실제 wire 의 api-version 은 이 상수다. spec 은 이 사실을 인지하고 narrative/provider invariant 만 assert 한다(api-version 값 자체는 assert 하지 않음).
- `src/llm/llm-gateway.interface.ts` (L20~26 만) — `LlmProvider` enum. `Custom = "custom"`, `AzureOpenai = "azure_openai"`.

## Acceptance Criteria

- [ ] `test/smoke/llm-live-azure.smoke-spec.ts` 신설 — `resolveLiveTestGating(process.env)` 로 gating 판정 후 `const describeLive = gating.enabled ? describe : describe.skip;` 패턴으로 suite 등록(custom spec mirror). **gating env 부재 시 `describe.skip` → 전 it skip → public CI green**(ADR-0025 §3, R-113).
- [ ] **provider 라벨 매핑(reviewer 핸드오프 — 절대 혼동 금지)**: gating 의 `LiveProvider` 내부 라벨은 `"azure"` 이며, 이는 wire enum `LlmProvider.AzureOpenai = "azure_openai"` 와 **다른 값**이다. repository stub 의 `provider` 필드에는 **반드시 `LlmProvider.AzureOpenai`** 를 넣는다 — `gating.provider`(="azure") 문자열을 그대로 흘려보내지 않는다. (gateway 의 provider 분기[L129~140]는 `config.provider === LlmProvider.AzureOpenai` 로 매칭하므로 `"azure"` 를 넘기면 "미지원 provider" throw 가 발생한다.)
- [ ] **azure wire shape 도달 검증(ADR-0025 §2)**: spec 은 `LlmHttpGateway.generate` 를 1회 호출하고, repository stub 이 `provider: LlmProvider.AzureOpenai` + `endpointUrl: gating.baseUrl`(azure resource base host) + `modelId: gating.model`(deployment 이름, Q-0021 = `gpt-5.4`) 를 돌려주도록 구성한다. gateway 가 azure adapter 로 분기해 `POST {base}/openai/deployments/<deployment>/chat/completions?api-version=<ver>` + `api-key` 헤더 wire 로 실 endpoint 에 도달하는 경로를 검증.
- [ ] **cipher 우회(ADR-0025 §6)**: cipher stub 의 `decrypt` 가 `gating.apiKey`(= env `LLM_LIVE_API_KEY` 평문)를 반환 — 실 `LLM_APIKEY_ENC_KEY` decrypt 미발생. repository stub 의 `apiKey` 는 placeholder(실값 아님). 실 API key 는 env 출처일 뿐 코드 기재 0(§9, custom spec mirror).
- [ ] **difficultyMappingService 미사용**: custom spec mirror 로 `resolveModel` 호출 시 throw 하는 stub(미예상 진입 박제). `generate` 는 `{ modelId: "<config id>" }`(difficulty 미지정 → modelId 직접 경로)로 호출.
- [ ] **Happy-path invariant(ADR-0025 §2)**: live enabled 시(=gated, CI 에서는 skip) `result.narrative` 가 비어있지 않은 string 이고 `result.provider === LlmProvider.AzureOpenai`, `result.modelId === gating.model`(deployment) 임을 assert. 내용 의미는 비결정적이라 assert 안 함(custom spec 동형).
- [ ] **분기 — skip path 검증**: 분기의 핵심은 `gating.enabled` 의 describe/describe.skip 이며, public CI(env 부재)에서는 항상 skip 경로를 탄다. `pnpm test:smoke` 가 본 spec 을 픽업하고(`.smoke-spec.ts` suffix → `test/jest-smoke.json` testRegex 자동) skip 으로 green 통과함을 검증. (live enabled 경로의 실 호출은 §5 게이트 후속 task — 본 task 는 skip 경로가 깨끗히 green 임이 CI 검증 책임.)
- [ ] **negative/격리(§9)**: 실 credential 값(base URL·API key)을 spec 파일 어디에도 적지 않는다(env=`gating` 출처만). `jest.setTimeout` 상한(custom 의 30000 mirror)으로 live hang 대비(skip 시 미발화).
- [ ] **smoke spec colocated unit spec 면제**: smoke 파일은 `scripts/check-spec-presence.sh` 에서 제외 대상이므로 본 smoke 파일에 대한 colocated `.spec.ts` 는 만들지 않는다. 단 spec 자체는 `pnpm test:smoke` 에서 실제로 실행(skip)되어야 한다.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:smoke` 통과(본 spec 이 gating env 부재로 skip → green; 기존 smoke 회귀 0).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 본 task 는 smoke spec 추가라 production 코드 변경 0(coverage 영향 0 확인).

## Out of Scope

- (2b) credentialed live run — 로컬 secrets.env(`LLM_LIVE_PROVIDER=azure_openai`/`LLM_LIVE_BASE_URL`/`LLM_LIVE_API_KEY`/`LLM_LIVE_API_VERSION`/`LLM_LIVE_MODEL=gpt-5.4`)를 env 주입해 실 네트워크 1회 실행 검증. ADR-0025 §Consequences 후속 chain, §5 자격증명 게이트 deferred. **절대 포함 금지**(실 credential 주입·실 호출 0).
- `src/llm/llm-live-test-gating.ts` 추가 변경 — T-0227 으로 azure gating 이 이미 merge 됨. 본 task 는 그 helper 를 **소비**만 한다.
- `LlmHttpGateway`/adapter 의 동작 코드 변경 — ADR-0025 는 코드 전 계약 박제. gateway/adapter 동작 변경 0(apiVersion 상수 default 도 본 task 에서 바꾸지 않음).
- apiVersion 영속 컬럼화(`LlmProviderConfig` schema migration) — 미승인(§5 DB schema 게이트), 별개.
- 명시 timeout/AbortController 도입 — ADR-0025 §4 별도 task(azure/custom 공통 gateway).
- ADR-0025 PROPOSED→ACCEPTED status flip — 본 task merge 후 별도 direct doc task(아래 Follow-ups). 본 task 는 pr-mode 코드라 mix 금지(§3.1 rule 3/4).

## Suggested Sub-agents

`implementer → tester` (ADR-0025 + T-0227 helper 가 설계·gating 을 이미 박제 — 신규 architect/ADR 불요).

## Follow-ups

- (planner) **T-0229 후보 — ADR-0025 PROPOSED→ACCEPTED status flip(commitMode direct, 1-line)**. 본 task(T-0228 smoke spec) merge 후 큐잉. 근거: azure 축 구현이 gating helper(T-0227) + smoke spec(T-0228) 둘 다 main 에 landing 하므로 ADR-0025 의 live-test 계약이 완전 구현됨 → repo convention(ADR-0006/0014/0015: 구현 slice 머지 후 flip)에 따라 ACCEPTED 로 flip. status flip 은 `direct`(ADR status 한 줄), 본 task 는 `pr`(code) 라 §3.1 rule 3/4 에 의해 **반드시 별도 task**(같은 task 에 bundle 금지).
- (executor/tester) ADR-0025 §4 의 명시 timeout(AbortController) 미도입 잔존 — azure live hang 시 `jest.setTimeout` 상한까지 대기. ADR-0015/0025 공유 후속 "live timeout hardening" task(azure/custom 공통 gateway) 로 별도 처리.
