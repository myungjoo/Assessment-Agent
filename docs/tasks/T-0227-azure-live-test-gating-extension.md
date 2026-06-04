---
id: T-0227
title: azure_openai live-test gating helper 확장 (LLM_LIVE_PROVIDER / LLM_LIVE_API_VERSION)
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-096, REQ-097]
estimatedDiff: 210
estimatedFiles: 2
created: 2026-06-04
plannerNote: P4 milestone-1 2a 잔여 — ADR-0025 Decision §1·§3 의 azure gating 을 helper 로 구현(split 1/2; smoke spec 은 T-0228 후보). R-112 backbone × 1.5.
---

# T-0227 — azure_openai live-test gating helper 확장

## Why

ADR-0025(MERGED, 7103cbc) 가 Q-0021 의 azure_openai live target(gpt-5.4 / karina-east-us-2) 을 위한 env-gated live smoke 계약을 박제했다. 본 task 는 그 **2a 의 구현 첫 slice** — ADR-0025 Decision §1(azure gating env 이름 확장)·§3(skip-unless-credentialed 순수 helper 확장) 을 `src/llm/llm-live-test-gating.ts` 에 코드로 구현한다. 현재 helper 는 provider=custom 전용이라(`LLM_LIVE_TEST`/`LLM_LIVE_BASE_URL`/`LLM_LIVE_API_KEY` 3종) Q-0021 azure target 에 도달할 gating 판정이 없다. (azure live smoke spec 신설은 본 helper 에 의존하므로 후속 slice T-0228 후보로 분리 — 본 task 는 helper + 그 colocated spec 만.)

본 task 는 새 외부 dependency 0 / 실 credential 0 — gating env 의 *존재·비어있지 않음* 만 검사하는 순수 함수 확장이라 CLAUDE.md §5 게이트 미발화 / §9 실값 미기재.

## Required Reading

- `docs/decisions/ADR-0025-azure-openai-live-test-contract.md` — Decision §1(azure gating env 이름 + 완전성 규칙)·§3(순수 helper 확장 원칙·describe.skip 분기)·§5(provider 분기 경계). 본 task 의 계약 정본.
- `src/llm/llm-live-test-gating.ts` — 확장 대상 helper. 현 `resolveLiveTestGating`(custom 3종 gating) + env 이름 상수 + `LiveTestGating` 인터페이스 + `isPresent` guard.
- `src/llm/llm-live-test-gating.spec.ts` — 확장할 colocated spec(R-112 패턴 reference). 본 task 가 azure 분기 test 를 추가한다.
- `src/llm/providers/azure-openai.adapter.ts` — azure wire shape 정본(`buildAzureOpenaiRequest`/`parseAzureOpenaiResponse`). gating 이 공급할 값(deployment=`LLM_LIVE_MODEL`, apiVersion 필수, base host)의 의미 정합 기준.
- `src/llm/llm-gateway.interface.ts` (L20~22 만) — `LlmProvider` enum(`Custom = "custom"`, `AzureOpenai = "azure_openai"`) — provider 분기 값 정합.

## Acceptance Criteria

- [ ] `src/llm/llm-live-test-gating.ts` 에 ADR-0025 Decision §1 의 신규 env 이름 상수 export 추가: `LLM_LIVE_PROVIDER_ENV = "LLM_LIVE_PROVIDER"`, `LLM_LIVE_API_VERSION_ENV = "LLM_LIVE_API_VERSION"`. (실값 0 — 이름 상수만, §9.)
- [ ] azure gating 판정을 순수 함수로 구현 — `LLM_LIVE_PROVIDER` 가 azure(`azure_openai` 또는 `azure`) 를 가리킬 때 `LLM_LIVE_TEST` AND `LLM_LIVE_BASE_URL` AND `LLM_LIVE_API_KEY` AND `LLM_LIVE_API_VERSION` AND `LLM_LIVE_MODEL`(deployment) 이 **모두** non-empty(trim 후 length > 0)면 enabled=true. 하나라도 부재/빈/공백 → enabled=false + reason 에 부재 env 이름 박제(ADR-0025 §1 azure 완전성 규칙). 구현 형태(기존 `resolveLiveTestGating` 에 azure 분기 추가 vs 신규 `resolveAzureLiveTestGating` 분리)는 implementer 가 결정하되 ADR §3 순수 함수 분리 원칙·기존 custom 동작 backward-compat(LLM_LIVE_PROVIDER 부재=custom default) 준수.
- [ ] azure gating 반환에 apiVersion + deployment(=model) 값을 호출처(후속 smoke)가 쓸 수 있게 노출(예: `apiVersion?: string`, deployment 는 기존 `model` 필드 재사용). azure 경로에서 `LLM_LIVE_MODEL`(deployment) 부재 시 azure skip — default 의존 금지(ADR §1: deployment 는 필수 라우팅 키).
- [ ] 기존 custom gating 동작 불변 — `LLM_LIVE_PROVIDER` 부재 또는 `custom` 이면 현 `resolveLiveTestGating`(3종) 결과와 동일(backward-compat). 기존 custom spec 13 case 가 그대로 통과.
- [ ] **Happy-path test**: azure 완전 env(provider=azure_openai + 5종 모두 set)면 enabled=true 이고 baseUrl/apiKey/apiVersion/model(deployment) 이 trim 되어 채워진다. `azure`(짧은 별칭) 값도 azure 경로로 인식.
- [ ] **Error/negative path test (예외 분기마다 1+)**: azure 경로에서 (a) `LLM_LIVE_API_VERSION` 부재 → skip + reason 에 이름 (b) `LLM_LIVE_MODEL`(deployment) 부재 → skip (c) `LLM_LIVE_TEST` 부재 → skip (d) `LLM_LIVE_BASE_URL` 부재 → skip (e) `LLM_LIVE_API_KEY` 부재 → skip (f) 빈 문자열·공백-only env 는 부재로 취급 → skip. 각 1+ test.
- [ ] **Flow/branch test**: `LLM_LIVE_PROVIDER` 값에 따른 분기 — azure_openai/azure → azure 경로, custom/부재 → custom 경로(backward-compat) 각 1+. trim(주변 공백) 정규화 1+.
- [ ] **secret 미노출 test**: azure skip 시 reason 에 실 credential 값(base URL·key)이 새어나오지 않고 env 이름만 박제됨을 검증(1+).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 azure 분기 모두 cover.

## Out of Scope

- `test/smoke/llm-live-azure.smoke-spec.ts` 신설 — 본 helper 에 의존하므로 후속 slice(T-0228 후보). 본 task 는 helper + colocated spec 만.
- (2b) credentialed live run(로컬 secrets.env 실 네트워크 실행) — ADR-0025 §Consequences 후속 chain, §5 자격증명 게이트 deferred. 절대 포함 금지.
- `LlmHttpGateway`/adapter 의 동작 코드 변경 — ADR-0025 는 코드 전 계약 박제. gating helper 외 production 동작 변경 0.
- 명시 timeout/AbortController 도입 — ADR-0025 §4 별도 task.
- `LlmProviderConfig` 에 apiVersion 영속 컬럼 추가 — 미승인 schema migration(별개).
- ADR-0025 PROPOSED→ACCEPTED status flip — 별도 direct doc task(아래 Follow-ups 참조). 본 task 는 pr-mode 코드라 mix 금지(§3.1).

## Suggested Sub-agents

`implementer → tester` (ADR-0025 가 설계를 이미 박제 — 신규 architect/ADR 불요).

## Follow-ups

- (planner) T-0228 후보 — `test/smoke/llm-live-azure.smoke-spec.ts` 신설(custom `llm-live.smoke-spec.ts` mirror + `LlmProvider.AzureOpenai` + base host endpointUrl + apiVersion 경로). 본 task(gating helper) merge 후 큐잉. smoke spec 은 check-spec-presence 면제.
- (planner) T-0227 + T-0228 merge 후 ADR-0025 PROPOSED→ACCEPTED status 한 줄 flip(commitMode direct). **status-flip 권고**: 본 repo 의 기존 convention(ADR-0006/0014/0015 등)은 구현 slice 가 main 에 landing 한 후 status 를 ACCEPTED 로 flip 하는 패턴 — ADR-0025 §Consequences 후속 chain 표 마지막 row 도 "구현 slice 머지 후 status 한 줄 갱신(direct)" 으로 명시. 따라서 본 task 단독 merge 가 아니라 **azure 축 구현(gating helper T-0227 + smoke spec T-0228) 이 둘 다 landing 한 후** flip 권장 — 부분 구현(gating only) 상태에서 ACCEPTED 는 시기상조.
