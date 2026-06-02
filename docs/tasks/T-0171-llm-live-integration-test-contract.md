---
id: T-0171
title: LLM live-integration TEST CONTRACT ADR(0015) + env-gated live smoke scaffold
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-096, REQ-097]
estimatedDiff: 250
estimatedFiles: 4
created: 2026-06-02
plannerNote: P4 milestone-1 live 통합(Q-0016 optionA) 의 dependency-free 선행 — ADR-0015 test 계약 + skip-unless-credentialed live smoke scaffold
---

# T-0171 — LLM live-integration TEST CONTRACT ADR(0015) + env-gated live smoke scaffold

## Why

P4 milestone-1 의 마지막 단계인 **실 LLM provider HTTP 통합(option A)** 을 사용자가 Q-0016.optionADecision 으로 승인했다. 그러나 §9(credential 은 코드/STATE/journal 금지·env/secret 주입) + R-113(CI 는 smoke/e2e 수행 — 실 네트워크 live test 는 public CI 에서 secret-leak/flaky/비용 risk) 때문에 work 는 2 단계로 분해된다. 본 task 는 그 중 **dependency-free 선행 task** — 실 credential 없이 지금 착수 가능한, live-integration 의 **TEST CONTRACT(ADR)** 박제와 **env 부재 시 자동 skip 되는 live smoke scaffold** 추가다. 후속 credentialed live-run(실 endpoint + 실 API key 주입)은 §5 게이트라 본 task 범위 밖이며 Follow-up 으로 남긴다.

## Required Reading

- `docs/STATE.json` — humanQuestions Q-0016.optionADecision(본 task 의 승인 근거 + 2 단계 분해 지시) + Q-0016.decision(option B = 기존 stub round-trip smoke 의 배경).
- `docs/decisions/ADR-0014-llm-api-key-encryption-at-rest.md` — `LLM_APIKEY_ENC_KEY` env getter 패턴 + apiKey encryption-at-rest 계약(live key 주입 경계의 참조점).
- `test/smoke/llm-gateway-roundtrip.smoke-spec.ts` — 기존 option-B local-stub round-trip smoke(실 credential 0). 본 task 의 live spec 은 이것과 **별개 파일**로, 실 endpoint·실 key 가 env 로 주입된 경우에만 동작하고 그 외엔 skip.
- `test/jest-smoke.json` — smoke testRegex `.*\.smoke-spec\.ts$` + `globalSetup`(DATABASE_URL 요구) — 새 live spec 의 suffix·DB 비의존 설계 근거.
- `test/helpers/jest-smoke-setup.ts` — smoke globalSetup 이 `DATABASE_URL` 을 fail-fast 요구함(live spec 이 DB 를 끌어오지 않도록 설계 시 유의).
- `src/llm/llm-http-gateway.service.ts` — `LlmHttpGateway.generate`(FetchLike 주입, custom/openai/azure/anthropic/gemini dispatch, non-2xx→throw 매핑) — live 경로가 호출할 대상 + timeout/non-2xx live 매핑 경계의 현 동작.
- `src/llm/providers/openai-compatible.adapter.ts` — custom(OpenAI-호환) provider 의 request/response shape(live endpoint 계약의 baseline).

## Acceptance Criteria

ADR(architect) + live smoke scaffold(implementer) + tester 검증을 한 PR 로 묶는다.

### ADR-0015 (live-integration TEST CONTRACT)

- [ ] `docs/decisions/ADR-0015-llm-live-integration-test-contract.md` 신설(status PROPOSED). Context/Decision/Consequences/Alternatives 한국어 본문.
- [ ] Decision 에 **credential env 변수 이름 확정**: gating flag `LLM_LIVE_TEST`(set 시에만 live 활성), live endpoint base URL env(예 `LLM_LIVE_BASE_URL`), provider API key env(예 `LLM_LIVE_API_KEY`), 그리고 encryption key 는 ADR-0014 의 `LLM_APIKEY_ENC_KEY` 재사용임을 명시.
- [ ] Decision 에 **skip-in-CI gating 메커니즘** 명시: gating env 부재 시 spec 이 `describe.skip`(또는 동등) 으로 자동 skip → public CI 는 실 credential 없이 green 유지. live 는 사람이 local / 전용 workflow 에 env 주입 시에만 실 네트워크 호출.
- [ ] Decision 에 **custom live endpoint request/response shape** 명시: OpenAI-호환 `POST {base}/chat/completions`, Authorization Bearer, body `{model, messages}`, 응답 `choices[0].message.content` → narrative(기존 openai-compatible.adapter 와 정합).
- [ ] Decision 에 **live-path timeout / non-2xx error 매핑 경계** 명시: 기존 mocked-fetch unit + stub round-trip smoke 와의 책임 경계(live 는 실 endpoint 의 timeout·rate-limit·5xx 를 어떻게 매핑/허용하는지) 박제.
- [ ] Alternatives 에 "live test 를 항상 실행(기각 — secret-leak/flaky/비용)" 과 "live test 미작성(기각 — option A 미검증)" 비교.

### live smoke scaffold

- [ ] `test/smoke/llm-live.smoke-spec.ts`(또는 ADR 이 정한 경로) 신설. ADR-0015 가 정한 gating env(`LLM_LIVE_TEST` 등) 부재 시 `describe.skip` 으로 전체 suite 가 skip 되어 CI 가 green.
- [ ] gating env 가 모두 존재할 때만 실 `globalThis.fetch` 로 live endpoint 에 `LlmHttpGateway.generate`(custom provider) 를 1 회 호출해 비어있지 않은 narrative 반환을 검증하도록 작성(이 경로는 본 PR CI 에서는 env 부재로 skip — 실 호출 0).
- [ ] live spec 은 `DATABASE_URL` / 실 DB 를 끌어오지 않도록 repository/cipher 의존을 live env 기반으로 구성하거나 최소 stub — smoke globalSetup 의 DB 요구가 live skip 판정과 무관하게 동작.

### R-112 test 요구 (skip-guard 로직에 적용)

- [ ] **Happy-path**: gating env 가 모두 set 된 경우의 live 호출 경로(narrative 반환) 검증 it 1+ (env 부재 CI 에서는 skip).
- [ ] **Error path**: gating helper(env 읽기/판정 함수)의 부분-set(일부 env 만 존재) · 전부-부재 case 1+ — 잘못된 gating 입력에 대해 skip 으로 안전하게 falling-back 함을 검증.
- [ ] **Flow / 분기**: gating 판정의 각 분기(전부-set → run, 일부/전부-부재 → skip) 각 1+ test. gating 로직은 별도 순수 helper 함수로 분리해 unit-testable 하게(skip 안의 본문은 직접 test 불가하므로 — R-112 entrypoint-helper 분리 원칙 mirror).
- [ ] **Negative cases 충분 cover**: 빈 문자열 env / 공백만 env / `LLM_LIVE_TEST` 만 있고 base URL·key 부재 / base URL 만 있고 key 부재 등 부분-부재 조합 각 1+ — skip 으로 귀결됨을 검증.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). gating helper 가 coverageThreshold 를 만족.

### CI 검증

- [ ] tester 가 **gating env 부재(= CI 기본 조건)에서** `pnpm lint && pnpm build && pnpm test:smoke && pnpm test` 를 실행해 live suite 가 skip 되고 전체 green 임을 확인(실 네트워크 호출 0).
- [ ] R-113 smoke+e2e 게이트가 여전히 green (기존 stub round-trip smoke + 신규 skip 된 live smoke).

## Out of Scope

- 실 credential(live endpoint base URL · provider API key · LLM_APIKEY_ENC_KEY) 의 **실값 주입 및 실 네트워크 live-run** — 후속 task(§5 게이트, Follow-up 참조). 본 task 는 실 호출 0.
- 실값 credential 을 코드/STATE/journal/ADR/spec/CI workflow yaml 어디에도 적지 않는다(§9). env 변수 **이름**만 박제.
- custom 외 provider(azure_openai/anthropic/google_gemini)의 live 통합 — custom 패턴 박제 후 동형 확장(별도 task).
- 전용 live workflow(`.github/workflows/*` 신규 또는 secret 주입 step) 추가 — 후속 credentialed task 에서 §5 승인과 함께.
- `LlmHttpGateway` 의 동작 변경(timeout 도입 등) — ADR 은 현 동작의 경계를 **기술**하되 코드는 바꾸지 않는다(필요 시 별도 task).
- apiVersion 영속 컬럼화 등 schema migration(미승인 §5 게이트).

## Suggested Sub-agents

`architect → implementer → tester` (ADR-0015 가 test 계약·env 이름·shape 를 먼저 박제한 뒤 implementer 가 그 계약대로 scaffold).

## Follow-ups

- **(credentialed live-run, §5 게이트 — planner 가 지금 큐잉하지 않음)**: 사용자가 live endpoint base URL + provider API key + LLM_APIKEY_ENC_KEY 를 **env/secret 으로 주입**(실값은 §9 에 따라 코드/STATE/journal/파일 절대 금지)한 뒤, 본 task 가 추가한 gated live spec 을 실 네트워크로 1 회 실행해 narrative 반환을 검증하는 task. §5 credential 게이트라 사용자 credential 제공 시점에 진입. 필요 시 전용 workflow(secret 주입)도 그 task 에서 §5 승인과 함께 추가.
- custom 외 4 provider(azure_openai/anthropic/google_gemini/openai)의 live 통합을 동형 확장(각 별도 task).
- ADR-0015 status PROPOSED→ACCEPTED 갱신(merge 후 direct 한 줄).
