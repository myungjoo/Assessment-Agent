---
id: T-0226
title: azure_openai live-test 계약 ADR — Q-0021 승인 target(gpt-5.4 / karina-east-us-2) 의 env-gated live smoke 계약 확장
phase: P4
status: DONE
commitMode: pr
coversReq: [REQ-096, REQ-097]
estimatedDiff: 85
estimatedFiles: 1
created: 2026-06-04
completedAt: 2026-06-04T15:18:00+09:00
prNumber: 197
mergedAs: 7103cbc
reviewRounds: 1
plannerNote: P4 milestone-1 2a 잔여 — ADR-0015 는 custom-only 박제됨, Q-0021 승인 azure_openai live target 의 계약 확장 ADR(코드 전 박제, pr)
result: DONE — ADR-0025(PROPOSED) 신설: azure_openai live-test 계약(wire shape /openai/deployments/<dep>/chat/completions?api-version= + api-key 헤더 + apiVersion 필수, gating env 변수명만, skip-unless-credentialed R-113, timeout+non-2xx 경계, cipher stub 우회). reviewer 코드 대조 APPROVE r1 0 findings, 실 secret 0, 4-gate PASS, squash merge 7103cbc. tasksCompleted 223→224. 후속=T-0227(gating azure 확장 + azure live smoke spec).
---

# T-0226 — azure_openai live-test 계약 ADR 박제

## Why

[STATE.json](../STATE.json) `humanQuestions[Q-0021].decision` 가 milestone-1 credentialed live LLM run 을 승인했고, **target 을 명시**했다 — provider=`azure_openai`, deployment/model=`gpt-5.4`, endpoint=`https://karina-east-us-2-api.openai.azure.com`. 그 decision 은 Q-0016 optionA 의 2-step 분해(2a dependency-free 선행 → 2b credentialed run)를 준수한다.

issue-still-relevant 점검 결과 2a 의 **generic 부분은 이미 main 에 박제**됐다 — [ADR-0015](../decisions/ADR-0015-llm-live-integration-test-contract.md)(ACCEPTED) + [src/llm/llm-live-test-gating.ts](../../src/llm/llm-live-test-gating.ts) + [test/smoke/llm-live.smoke-spec.ts](../../test/smoke/llm-live.smoke-spec.ts). 그러나 그 박제는 **provider=custom(OpenAI-호환) 전용**이다: gating 은 `LLM_LIVE_BASE_URL`/`LLM_LIVE_API_KEY`/`LLM_LIVE_MODEL` 3종만 알고 azure 의 `apiVersion`/deployment 라우팅을 모르며, live smoke 는 `provider: LlmProvider.Custom` 을 하드코딩한다. azure_openai 는 wire shape 가 다르다(URL `/openai/deployments/<model>/chat/completions?api-version=<v>`, header `api-key:`, apiVersion 필수 — [azure-openai.adapter.ts](../../src/llm/providers/azure-openai.adapter.ts) 참조). 그래서 Q-0021 의 azure target 에 실제로 도달하려면 live-test 계약을 azure 로 확장해야 한다.

본 task 는 그 **확장 계약을 코드 전에 ADR 로 박제**한다([CLAUDE.md §1](../../CLAUDE.md) "코드보다 ADR이 먼저", [§3.1 rule 4](../../CLAUDE.md) "새 ADR = pr-mode"). 실 credential 불요(§5 미발화) — 계약 문서만. 후속 slice 가 gating 확장 + azure live smoke spec 을 구현한다.

## Required Reading

- [docs/decisions/ADR-0015-llm-live-integration-test-contract.md](../decisions/ADR-0015-llm-live-integration-test-contract.md) — 본 ADR 이 확장하는 기존 custom-only 계약(env 이름/skip 메커니즘/3-layer 경계 표). 본 ADR 은 이를 supersede 하지 않고 azure 축을 더한다.
- [src/llm/llm-live-test-gating.ts](../../src/llm/llm-live-test-gating.ts) — 현 gating env 상수(`LLM_LIVE_TEST`/`LLM_LIVE_BASE_URL`/`LLM_LIVE_API_KEY`/`LLM_LIVE_MODEL`)와 `resolveLiveTestGating` 순수 함수 — azure 확장이 어디에 들어갈지 파악용(코드는 본 task 에서 변경 안 함).
- [src/llm/providers/azure-openai.adapter.ts](../../src/llm/providers/azure-openai.adapter.ts) — azure wire shape(URL `/openai/deployments/<model>/chat/completions?api-version=`, `api-key` header, apiVersion 필수)의 정본. live 계약의 endpoint/auth/apiVersion 경계가 이 adapter 와 일치해야 함.
- [test/smoke/llm-live.smoke-spec.ts](../../test/smoke/llm-live.smoke-spec.ts) — custom live smoke 의 gating·격리·describe.skip 패턴(azure spec 이 mirror 할 reference).
- [docs/STATE.json](../STATE.json) `humanQuestions[Q-0021].decision` 및 `[Q-0016].optionADecision` — target(azure_openai/gpt-5.4/karina-east-us-2) + 2a/2b 분해 + §9 credential 금지.
- [docs/decisions/ADR-0014-llm-api-key-encryption-at-rest.md](../decisions/ADR-0014-llm-api-key-encryption-at-rest.md) — `LLM_APIKEY_ENC_KEY` at-rest 키(2b 가 사용; 본 ADR 은 live smoke 가 cipher 를 stub 으로 우회하는 경계만 명시).

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0025-azure-openai-live-test-contract.md` 신설(status `PROPOSED`, frontmatter `relatedTask: T-0226`, `supersedes: null`).
- [ ] Context 절: ADR-0015 가 custom-only 임을 명시하고, Q-0021 승인 target(provider=azure_openai / deployment=gpt-5.4 / endpoint=karina-east-us-2-api.openai.azure.com) 과의 gap(wire shape·auth header·apiVersion)을 박제. **실 endpoint/key/deployment 실값 중 endpoint host 와 deployment 이름은 Q-0021 decision 에 이미 공개돼 있으므로 기재 가능하나, API key 실값은 절대 금지(§9)** — env 이름만.
- [ ] Decision 절에 다음을 enumerated 로 박제:
  - [ ] gating env 확장 — provider 선택(azure 활성) + apiVersion 전달 + (필요 시) deployment/model 의 env 변수 **이름** 확정(실값 0). 기존 `LLM_LIVE_*` 와의 관계(재사용 vs 신규 prefix 예: `LLM_LIVE_PROVIDER`/`LLM_LIVE_API_VERSION`) 명시.
  - [ ] azure live wire shape — URL `/openai/deployments/<model>/chat/completions?api-version=<v>`, `api-key` header, apiVersion 필수 가 [azure-openai.adapter.ts](../../src/llm/providers/azure-openai.adapter.ts) 와 일치함을 박제.
  - [ ] skip-unless-credentialed gating — azure gating env 부재 시 `describe.skip` → public CI green 유지(R-113). custom live smoke 와 독립적으로 skip/run.
  - [ ] timeout + non-2xx live 매핑 경계 — live hang 대비 jest timeout 상한 + non-2xx → status 포함 throw(adapter/gateway 기존 매핑 재사용, 본 ADR 은 경계만; 동작 코드 변경 별도).
  - [ ] cipher 우회 경계 — live smoke 가 실 `LLM_APIKEY_ENC_KEY` decrypt 를 우회하고 env 평문 key 를 stub cipher 로 공급하는 경계(custom live smoke 와 동형).
- [ ] Consequences 절에 positive/negative + 후속 slice(gating 확장 + azure live smoke spec = T-0227 후보, 그 후 2b credentialed run) 명시.
- [ ] Alternatives 절에 "ADR-0015 를 inline amend" vs "신규 ADR-0025" 택일 근거(ADR 본문 immutable 원칙 → 신규) 박제.
- [ ] 분기 없음 — 본 task 는 doc-only ADR 신설(production code 0). R-112 happy/error/branch/negative unit test 항목은 코드 부재로 **생략**(이 task 에는 적용 대상 symbol 0). tester 는 `pnpm lint && pnpm build && pnpm test` 가 ADR 추가로 깨지지 않음을 확인(R-110: pr-mode 는 production code 0 이어도 tester 호출 의무).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과(ADR 신설은 코드 무변경이라 회귀 0 확인).

## Out of Scope

- gating helper(`src/llm/llm-live-test-gating.ts`) 의 azure 확장 **코드** — 후속 slice(T-0227 후보).
- azure live smoke spec(`test/smoke/llm-live-azure.smoke-spec.ts`) **파일 생성** — 후속 slice.
- 2b credentialed live run(실 네트워크 1회 호출 + 로컬 secrets.env 주입 + `LLM_APIKEY_ENC_KEY` 생성) — §5 credential 게이트, 별도 task(deferred).
- `LlmHttpGateway` 동작 코드 변경(timeout 도입 등) — 본 ADR 은 경계만 박제, 코드 별도.
- ADR-0015 본문 수정 — immutable. 본 ADR 이 독립 확장.
- API key 등 실 secret 값 기재 — §9 절대 금지.

## Suggested Sub-agents

architect → tester

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 추가)
