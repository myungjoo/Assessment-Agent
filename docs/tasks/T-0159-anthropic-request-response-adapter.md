---
id: T-0159
title: AnthropicAdapter — anthropic Messages API 요청/응답 shaping 순수 함수
phase: P4
status: DONE
completedAt: 2026-06-02T12:29:19+09:00
mergedAs: f150a95
prNumber: 149
reviewRounds: 1
commitMode: pr
coversReq: [REQ-099, REQ-101, REQ-102, REQ-103]
estimatedDiff: 240
estimatedFiles: 2
created: 2026-06-02
plannerNote: "P4 milestone-1 chain 5/N — anthropic Messages API adapter 순수 함수(build/parse), T-0155/T-0157 패턴 mirror. R-112 backbone ×1.5. dep0/credential0/fetch0(§5 미발화). gateway 연결은 Follow-up."
---

# T-0159 — AnthropicAdapter — anthropic Messages API 요청/응답 shaping 순수 함수

## Why

P4 milestone-1 (LLM provider HTTP gateway) chain 의 5차 slice다. 지금까지 azure_openai adapter(T-0155) + openai-compatible(custom/openai) adapter(T-0157) 순수 함수와 이를 묶는 `LlmHttpGateway` orchestration·provider routing dispatch(T-0156·T-0158, merged 55b24be)가 박제됐다. 현재 gateway 는 `azure_openai / custom / openai` 3 provider 만 처리하고 `anthropic / google_gemini` 는 adapter 순수 함수 자체가 없어 "미지원" throw 다(T-0158 Follow-up #1·#2). 본 slice 는 README R-99~103 의 5 provider 중 `anthropic` 을 위한 요청/응답 shaping 순수 함수 2종(`buildAnthropicRequest` / `parseAnthropicResponse`)을 **gateway 연결 없이 standalone** 으로 박제한다 — T-0155(azure)·T-0157(openai-compat)이 adapter 와 gateway 연결을 별도 slice 로 나눈 동일 cadence. anthropic Messages API 는 OpenAI 호환과 wire 포맷이 달라(전용 `x-api-key` / `anthropic-version` 헤더, body 의 `max_tokens` 필수 + `system` top-level 필드, 응답의 `content[]` 블록 배열) 전용 adapter 가 필요하다. 새 외부 dependency 0(순수 함수라 fetch 도 미사용, pnpm add 0) / 실 credential 0(apiKey 는 평문 함수 인자) / 실 네트워크 호출 0 — §5 HITL 게이트 미발화.

## Required Reading

- `D:\Assessment-Agent\src\llm\providers\openai-compatible.adapter.ts` — **본 slice 가 mirror 할 직전 패턴**. `buildOpenaiCompatibleRequest`(URL 조립·trailing-slash 정규화·헤더·difficulty system message prepend) + `parseOpenaiCompatibleResponse`(choices[0].message.content → LlmGenerateResult·비정상 응답 throw) + 내부 `assertNonEmpty` guard 구조를 그대로 차용하되 anthropic wire 포맷으로 변형한다.
- `D:\Assessment-Agent\src\llm\providers\azure-openai.adapter.ts` — azure adapter(T-0155). provider 하드코딩 방식(`LlmProvider.AzureOpenai`)·input 인터페이스 형태 참고. anthropic 도 단일 provider 라 azure 처럼 `LlmProvider.Anthropic` 하드코딩(openai-compat 의 provider 인자 방식과 다름).
- `D:\Assessment-Agent\src\llm\llm-gateway.interface.ts` — `LlmGenerateOptions`(modelId/difficulty) / `LlmGenerateResult`(narrative/provider/modelId) / `LlmProvider` enum(`Anthropic = "anthropic"`). 반환 타입과 provider 식별자의 single source.
- `D:\Assessment-Agent\src\llm\providers\openai-compatible.adapter.spec.ts` — **colocated spec 위치·구조의 mirror 대상**. 본 slice 의 신규 spec 은 `src/llm/providers/anthropic.adapter.spec.ts`(colocated) 에 둔다. happy/error/branch/negative 충분 cover 패턴(빈 입력 / object 아님 / 누락 / 빈 배열 / content 누락)을 그대로 anthropic 응답 shape 로 옮긴다.

## anthropic Messages API wire 포맷 (구현 결정 — 본 slice 에서 박제)

OpenAI 호환과의 핵심 차이(adapter 분기의 근거):

- **URL**: `<endpointUrl>/v1/messages` (trailing-slash 정규화 후 append). `endpointUrl` 기본 base 는 `https://api.anthropic.com` 류이나 본 adapter 는 저장된 `endpointUrl` 을 base 로만 쓴다(custom proxy 허용).
- **헤더**: `x-api-key: <apiKey>` (Bearer 아님) + `anthropic-version: 2023-06-01` (상수 default — azure 의 api-version 상수 default 와 동일 취급, 영속 컬럼화는 Follow-up) + `Content-Type: application/json`.
- **body**: `{ model: <modelId>, max_tokens: <상수 default>, messages: [{ role: "user", content: prompt }] }`. anthropic 은 `max_tokens` 가 **필수** 라 상수 default(예: 1024)를 박제(영속 컬럼화 Follow-up). difficulty 가 명시되면 **top-level `system` 필드**(OpenAI 의 system message 가 아니라 anthropic 전용 top-level)로 난이도 힌트를 싣는다.
- **응답 파싱**: `content` 가 **블록 배열** — `content[0].text`(type=="text") 를 narrative 로 추출(OpenAI 의 `choices[0].message.content` 와 다름). 비정상(`content` 누락/빈 배열/블록 object 아님/text 누락·빈 문자열) → 명확한 한국어 Error throw.
- provider 는 `LlmProvider.Anthropic` 하드코딩(azure 와 동일 — anthropic 은 단일 provider).

## Acceptance Criteria

변경 파일: `src/llm/providers/anthropic.adapter.ts`(신규, 순수 함수 2종 + input/return 타입 + 내부 guard) + `src/llm/providers/anthropic.adapter.spec.ts`(신규 colocated spec). 신규 파일 2, 기존 파일 변경 0(gateway 연결은 Follow-up).

- [ ] `buildAnthropicRequest(input)` 가 anthropic Messages API 요청 `{ url, headers, body }` 를 조립한다 — URL `<endpointUrl>/v1/messages`(trailing-slash 정규화), 헤더 `x-api-key` + `anthropic-version` 상수 + `Content-Type`, body 에 `model`/`max_tokens` 상수/`messages` 포함, difficulty 명시 시 top-level `system` 필드 추가.
- [ ] `parseAnthropicResponse(json, modelId)` 가 응답 JSON 의 `content[0].text` 를 narrative 로 추출해 `LlmGenerateResult`(provider=`LlmProvider.Anthropic`)를 반환한다.
- [ ] **Happy-path unit test 1+** — `buildAnthropicRequest`: 정상 input → 올바른 url/x-api-key 헤더/anthropic-version/body(model·max_tokens·messages) 조립 검증 + difficulty 명시 시 `system` 필드 포함 검증. `parseAnthropicResponse`: 정상 응답 → narrative/provider=anthropic/modelId 반환 검증.
- [ ] **Error path unit test 1+** — `buildAnthropicRequest`: 각 필수 필드(endpointUrl/modelId/apiKey/prompt) 빈 값·non-string 시 throw. `parseAnthropicResponse`: object 아님 / `content` 누락 / 빈 배열 / `content[0]` object 아님 / `text` 누락·빈 문자열 각각 throw.
- [ ] **Flow / branch coverage** — 각 분기 1+ test: difficulty 있음 vs 없음(system 필드 prepend 분기) / trailing-slash 있는 endpointUrl vs 없는 endpointUrl(정규화 분기) / 응답 정상 vs 각 비정상 분기.
- [ ] **Negative cases 충분 cover** — 예외 상황 각 1+ test: 빈 endpointUrl / 빈 modelId / 빈 apiKey / 빈 prompt / non-string 입력 / 응답이 array(object 아님) / content 누락 / content 빈 배열 / content[0] null / text 누락 / text 빈 문자열. 단일 negative 만으로 부족 — 예외 처리 분기마다 cover.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test` 통과(신규 spec 포함 전체 green).
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%; 신규 파일 100% 목표).
- [ ] 새 외부 dependency 0(`pnpm add` 0 — Node 내장 + 기존 `llm-gateway.interface` import 만, package.json/lockfile 변경 0). 외부 credential 0(apiKey 평문 함수 인자, 실 네트워크·실 LLM 호출 0 — 순수 함수라 fetch 미사용). schema migration 0. auth 변경 0.

## Out of Scope

- **gateway 연결(provider routing dispatch)** — `LlmHttpGateway.generate` 가 `anthropic` provider 를 본 adapter 로 dispatch 하도록 분기를 추가하는 것은 별도 slice(Follow-up #1). 본 slice 는 standalone 순수 함수만 — gateway 는 여전히 anthropic 을 "미지원" throw(T-0155/T-0157 이 adapter 와 연결을 나눈 동일 cadence).
- **google_gemini adapter** — gemini 는 또 다른 wire 포맷(`generateContent`)이라 별도 adapter slice(Follow-up #2).
- **max_tokens / anthropic-version 영속 컬럼화** — `LlmProviderConfig` 4 필드 그대로. 본 slice 는 상수 default. 영속 컬럼화는 schema migration(§5 게이트) Follow-up.
- **실 네트워크 호출 / 실 credential 주입** — 순수 함수라 fetch 미사용. 실 LLM 호출·실 `LLM_APIKEY_ENC_KEY` 주입은 통합/배포 단계 책임(§5 재평가) Follow-up.
- **DifficultyMapping ↔ provider/config routing** — 난이도별 config 선택 로직은 별도 slice.
- **api.md / modules.md doc-sync** — gateway slice 들이 모인 뒤 별도 direct doc task.
- **package.json 변경** — 새 dependency 0 원칙(§5/§9 미발화 유지).

## Suggested Sub-agents

`implementer → tester`. (architect 불요 — `LlmGateway` interface(T-0135) + azure/openai-compat adapter(T-0155/T-0157) 패턴 + generic HTTP 결정[journal 10:35]이 contract 와 부품을 모두 박제 완료. 본 slice 는 기존 adapter 패턴을 anthropic wire 포맷으로 mirror 하는 구현이라 새 모듈 경계/공개 API 형태 결정 불요. anthropic wire 포맷 세부는 위 "anthropic Messages API wire 포맷" 절에 구현 결정으로 박제.)

## Follow-ups

(생성 시 비어 있음. 향후 chain 후보 — sub-agent 가 발견 시 append:)

- (chain #1) gateway provider routing dispatch 에 anthropic 분기 연결(`LlmHttpGateway.generate` 가 `LlmProvider.Anthropic` → 본 adapter dispatch).
- (chain #2) google_gemini adapter 순수 함수(generateContent 포맷) → gateway 연결.
- (chain #3) max_tokens / anthropic-version(및 기타 파라미터) 영속 컬럼화 — schema migration(§5 게이트).
- (chain #4) 실 네트워크/실 credential 통합 — `LLM_APIKEY_ENC_KEY` env 주입 + 실 LLM 호출 smoke/e2e(§5 재평가).
- (chain #5) DifficultyMapping ↔ provider/config routing(난이도별 config 선택).
- (chain #6) api.md / modules.md gateway doc-sync(direct).
