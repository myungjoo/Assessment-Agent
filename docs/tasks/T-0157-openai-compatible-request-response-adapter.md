---
id: T-0157
title: OpenAI 호환(custom/openai) 요청/응답 shaping 순수 함수 adapter (buildOpenaiCompatibleRequest + parseOpenaiCompatibleResponse)
phase: P4
status: DONE
completedAt: 2026-06-02T11:59:40+09:00
mergedAs: 55bd04d
prNumber: 147
reviewRounds: 1
commitMode: pr
coversReq: [REQ-099, REQ-100, REQ-101, REQ-102, REQ-103]
estimatedDiff: 300
estimatedFiles: 2
created: 2026-06-02
plannerNote: "P4 milestone-1 chain 3/N — custom/openai(OpenAI 호환) adapter 순수 함수 2종 + colocated spec. T-0155 azure 패턴 mirror, R-112 backbone ×1.5. dep0/credential0(§5 미발화). gateway routing dispatch 는 Follow-up."
---

# T-0157 — OpenAI 호환(custom/openai) 요청/응답 shaping 순수 함수 adapter

## Why

P4 milestone-1 (LLM provider HTTP gateway) chain 의 3차 slice다. 1차(T-0155, merged 30467c2)가 azure_openai 의 요청/응답 shaping 을 순수 함수로, 2차(T-0156, merged efa81c7)가 그것을 묶는 orchestration service `LlmHttpGateway` 를 azure_openai 1종에 대해 박제했다. README L85 는 5 provider 를 요구한다 — **custom (OpenAI 호환 / 내부 자체 서버 / proxy)** / Azure OpenAI / Anthropic / Google Gemini / OpenAI. 이 중 `custom` 과 `openai` 는 모두 **OpenAI Chat Completions 호환 wire 포맷**을 공유한다(custom 은 OpenAI 호환 endpoint, openai 는 정식 OpenAI). 본 slice 는 azure_openai 와 별개인 이 OpenAI 호환 포맷의 요청 조립(`buildOpenaiCompatibleRequest`)과 응답 파싱(`parseOpenaiCompatibleResponse`)을 **순수 함수**로 박제한다 — T-0155 의 azure adapter 와 동일 패턴. 이로써 multi-provider 의 두 번째 wire 포맷이 unit 수준에서 박제되고, 후속 gateway routing dispatch slice 가 provider 에 따라 azure / openai-compatible adapter 를 선택할 수 있게 된다. **본 slice 는 순수 함수 2종 + spec 만** — gateway 의 provider 분기 dispatch 연결은 Follow-up(별도 slice).

## Required Reading

- `D:\Assessment-Agent\src\llm\providers\azure-openai.adapter.ts` — **본 slice 의 mirror 대상**. `buildAzureOpenaiRequest` / `parseAzureOpenaiResponse` / `AzureOpenaiRequestInput` / `AzureOpenaiRequest` / 내부 `assertNonEmpty` guard. 동일한 구조·검증·error 메시지 스타일을 OpenAI 호환 포맷으로 옮긴다(차이점은 아래 Acceptance 참조).
- `D:\Assessment-Agent\src\llm\providers\azure-openai.adapter.spec.ts` — colocated spec 작성 스타일(describe/it 한국어 관행, happy/error/branch/negative 충분 cover) 참고. 본 slice 의 spec 도 이 스타일을 mirror.
- `D:\Assessment-Agent\src\llm\llm-gateway.interface.ts` — `LlmGenerateOptions`(modelId/difficulty) / `LlmGenerateResult`(narrative/provider/modelId) / `LlmProvider` enum(`Custom = "custom"`, `Openai = "openai"`). 본 adapter 의 입출력 타입 + `parseOpenaiCompatibleResponse` 가 `result.provider` 에 채울 값 결정에 필요.

## Acceptance Criteria

신규 파일: `src/llm/providers/openai-compatible.adapter.ts`(순수 함수 모듈, NestJS provider 아님 — DI 불요) + colocated spec `src/llm/providers/openai-compatible.adapter.spec.ts`.

- [ ] `buildOpenaiCompatibleRequest(input)` — OpenAI Chat Completions 호환 요청을 조립한다. 입력 타입 `OpenaiCompatibleRequestInput`(endpointUrl/modelId/apiKey/prompt/options — **apiVersion 없음**, azure 와의 핵심 차이). 반환 `{ url, headers, body }`(azure adapter 의 `AzureOpenaiRequest` 와 동일 shape — 재사용 또는 동형 신규 타입 중 구현자 판단, 단 import cycle 회피). 차이점:
  - **URL 포맷**: azure 의 `<endpoint>/openai/deployments/<modelId>/chat/completions?api-version=...` 가 아니라 OpenAI 표준 `<endpointUrl>/chat/completions`(또는 endpointUrl 이 이미 full path 면 그대로 — 구현자가 "endpointUrl 은 base 로 보고 `/chat/completions` 를 append, trailing slash 정규화" 규칙을 코드 주석에 명시). api-version query 없음.
  - **인증 헤더**: azure 의 `api-key: <key>` 가 아니라 OpenAI 표준 `Authorization: Bearer <apiKey>`. `Content-Type: application/json` 동일.
  - **body**: `{ model: <modelId>, messages: [...] }` — OpenAI 는 azure 와 달리 body 에 `model` 필드를 포함한다(azure 는 url 의 deployment 로 라우팅). difficulty 가 명시되면 azure 와 동일하게 system message 를 prepend, 그 뒤 user message 1 개.
- [ ] **빈/비-string 입력 검증** — azure adapter 의 `assertNonEmpty` 와 동일하게 endpointUrl/modelId/apiKey/prompt 가 비어있거나 string 이 아니면 명확한 한국어 Error throw(메시지에 어느 필드인지 포함). (apiVersion 은 본 포맷에 없으므로 검증 대상 아님.)
- [ ] `parseOpenaiCompatibleResponse(json, modelId, provider)` — OpenAI 호환 chat completions 응답 JSON 을 `LlmGenerateResult` 로 변환(`choices[0].message.content` → narrative). 비정상 응답(object 아님 / choices 누락·빈 배열 / choices[0] object 아님 / message object 아님 / content 비어있거나 string 아님)은 azure adapter 와 동일하게 각각 명확한 한국어 Error throw. **provider 파라미터** — custom/openai 두 provider 가 본 포맷을 공유하므로 호출처가 실제 provider(`LlmProvider.Custom` 또는 `LlmProvider.Openai`)를 넘겨 `result.provider` 에 채운다(azure adapter 가 `LlmProvider.AzureOpenai` 를 하드코딩한 것과의 차이 — 코드 주석에 명시).
- [ ] **Happy-path unit test 1+** — 각 함수: `buildOpenaiCompatibleRequest` 가 정상 입력으로 올바른 url(`/chat/completions`, api-version 없음) / headers(`Authorization: Bearer ...`) / body(model 필드 포함) 를 반환. `parseOpenaiCompatibleResponse` 가 정상 응답 JSON + provider 인자로 올바른 `LlmGenerateResult`(narrative/provider/modelId) 반환.
- [ ] **Error path unit test 1+** — `buildOpenaiCompatibleRequest`: 빈 endpointUrl / 빈 modelId / 빈 apiKey / 빈 prompt / 비-string 각각 throw. `parseOpenaiCompatibleResponse`: object 아님 / choices 누락 / choices 빈 배열 / message 누락 / content 빈 문자열 각각 throw.
- [ ] **Flow / branch coverage** — 각 분기 1+ test: difficulty 명시 vs 미명시(system message prepend 분기), endpointUrl trailing slash 있음 vs 없음(정규화 분기), provider 인자 = custom vs openai(반환 provider 분기). 분기마다 test 분리.
- [ ] **Negative cases 충분 cover** — 예외 상황 각 1+ test: 빈/공백-only 필드(각 필드) / 비-string 타입 / 비정상 응답의 모든 형태(위 error path). 단일 negative 만으로 부족 — 예외 처리 분기마다 cover.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test` 통과(신규 spec 포함 전체 green).
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%; 신규 파일 100% 목표).
- [ ] 새 외부 dependency 0(`pnpm add` 0 — Node 내장만, package.json/lockfile 변경 0). 외부 credential 0(apiKey 는 함수 인자 평문으로만 받음 — env 주입·실 네트워크 호출·실 LLM 호출 0). 본 slice 는 순수 함수라 fetch 도 사용하지 않는다.

## Out of Scope

- **gateway 의 provider 분기 dispatch** — `LlmHttpGateway` 가 config.provider 에 따라 azure / openai-compatible adapter 를 선택하도록 연결하는 것은 본 slice 아님 → Follow-up #1(별도 slice, src/llm/llm-http-gateway.service.ts 변경 + DI 불요한 순수 함수 호출). 본 slice 는 순수 함수 2종 + spec 만 박제. gateway 는 여전히 azure 만 처리(T-0156 상태 유지).
- **anthropic / google_gemini adapter** — 이 둘은 OpenAI 호환과 다른 wire 포맷(특히 anthropic 의 messages API + x-api-key 헤더)이라 각각 별도 slice → Follow-up #2, #3.
- **apiVersion / 기타 파라미터 영속 컬럼화** — `LlmProviderConfig` 4 필드는 그대로(schema migration §5 게이트 → 별도 Follow-up). OpenAI 호환 포맷은 api-version 이 없으므로 본 slice 에 영향 없음.
- **실 네트워크 호출 / 실 credential 주입** — 순수 함수라 fetch 미사용. 실 LLM 호출·실 `LLM_APIKEY_ENC_KEY` 주입은 통합/배포 단계 책임(§5 재평가).
- **DifficultyMapping ↔ provider/model routing** — 난이도별 provider/config 선택 로직은 별도 slice(T-0156 Follow-up #4 와 동일).
- **api.md / modules.md doc-sync** — adapter slice 들이 모인 뒤 별도 direct doc task.
- **package.json 변경** — 새 dependency 0 원칙(§5/§9 미발화 유지).

## Suggested Sub-agents

`implementer → tester`. (architect 불요 — `LlmGateway` interface(T-0135) + azure adapter 패턴(T-0155) + generic HTTP 결정[journal 10:35]이 contract 를 박제 완료. 본 slice 는 기존 azure adapter 를 OpenAI 호환 포맷으로 mirror 하는 순수 함수 추가라 새 모듈 경계/공개 API 형태 결정 불요. URL append 규칙·provider 파라미터 설계는 구현 결정으로 spec 에 박제.)

## Follow-ups

(생성 시 비어 있음. 향후 chain 후보 — sub-agent 가 발견 시 append:)

- (chain #1) gateway provider 분기 dispatch — `LlmHttpGateway` 가 config.provider 에 따라 azure / openai-compatible adapter 선택(custom/openai → 본 adapter, azure_openai → 기존).
- (chain #2) anthropic adapter — messages API + x-api-key 헤더(OpenAI 호환과 다른 wire 포맷) 순수 함수.
- (chain #3) google_gemini adapter — Gemini generateContent 포맷 순수 함수.
- (chain #4) 실 네트워크/실 credential 통합 — `LLM_APIKEY_ENC_KEY` env 주입 + 실 LLM 호출 smoke/e2e(§5 재평가).
- (chain #5) api.md / modules.md gateway doc-sync(direct).
