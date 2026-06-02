---
id: T-0158
title: LlmHttpGateway — provider routing dispatch (azure_openai vs custom/openai adapter 분기 연결)
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-099, REQ-100, REQ-101, REQ-102, REQ-103]
estimatedDiff: 180
estimatedFiles: 2
created: 2026-06-02
plannerNote: "P4 milestone-1 chain 4/N — gateway 가 config.provider 로 azure vs openai-compatible adapter 선택 dispatch. R-112 backbone ×1.5. fetch 주입 mock/cipher DI mock → 새 dep0/credential0(§5 미발화). anthropic/gemini 는 Follow-up."
---

# T-0158 — LlmHttpGateway — provider routing dispatch (azure_openai vs custom/openai adapter 분기 연결)

## Why

P4 milestone-1 (LLM provider HTTP gateway) chain 의 4차 slice다. 1차(T-0155, merged 30467c2)가 azure_openai adapter 순수 함수를, 2차(T-0156, merged efa81c7)가 그것을 묶는 orchestration service `LlmHttpGateway` 를 **azure_openai 1종에 대해서만** 박제했다. 3차(T-0157, merged 55bd04d)가 custom/openai(OpenAI 호환) adapter 순수 함수(`buildOpenaiCompatibleRequest` / `parseOpenaiCompatibleResponse`)를 박제했으나 **아직 gateway 에 연결되지 않았다**. 본 slice 는 `LlmHttpGateway.generate` 가 조회한 `config.provider` 값에 따라 azure adapter(azure_openai) vs openai-compatible adapter(custom/openai)를 **선택 dispatch** 하도록 분기를 연결한다. 이로써 milestone-1 의 multi-provider 호출 경로 중 OpenAI 호환 두 provider 가 unit 수준에서 동작하게 된다. T-0156 Follow-up #1 + T-0157 Follow-up #1 박제 (둘 다 동일한 gateway routing dispatch 를 가리킴). 새 외부 dependency 0 / 실 credential 0 / 실 네트워크 0 — fetch 는 주입 mock, cipher 는 DI mock 유지.

## Required Reading

- `D:\Assessment-Agent\src\llm\llm-http-gateway.service.ts` — **본 slice 의 주 변경 대상**. 현재 `generate` 는 provider != `AzureOpenai` 시 "미지원" error throw + azure adapter 2종 hardcode (라인 82~117). 본 slice 는 이 hardcode 를 provider 분기 dispatch 로 교체한다. `FetchLike` 주입 / `AZURE_OPENAI_DEFAULT_API_VERSION` 상수 / repository.findById raw row 조회 / cipher.decrypt 흐름은 그대로 유지.
- `D:\Assessment-Agent\src\llm\providers\openai-compatible.adapter.ts` — 본 slice 가 연결할 순수 함수 `buildOpenaiCompatibleRequest(input)` / `parseOpenaiCompatibleResponse(json, modelId, provider)`. 입력 타입 `OpenaiCompatibleRequestInput`(endpointUrl/modelId/apiKey/prompt/options — **apiVersion 없음**), `parseOpenaiCompatibleResponse` 의 **provider 인자**(custom/openai 구분 → result.provider 에 채움)에 유의.
- `D:\Assessment-Agent\src\llm\providers\azure-openai.adapter.ts` — 기존 azure 경로의 `buildAzureOpenaiRequest` / `parseAzureOpenaiResponse`. azure 만 `apiVersion` 입력 필요(openai-compatible 는 불요) — 분기별 입력 차이의 근거.
- `D:\Assessment-Agent\src\llm\llm-gateway.interface.ts` — `LlmProvider` enum(`Custom="custom"` / `AzureOpenai="azure_openai"` / `Anthropic` / `GoogleGemini` / `Openai="openai"`). 본 slice 의 분기 판정 기준. anthropic/google_gemini 는 본 slice 에서 여전히 "미지원" throw (Follow-up).
- `D:\Assessment-Agent\src\llm\llm-http-gateway.service.spec.ts` — 기존 gateway colocated spec. azure happy/error/branch/negative 패턴이 박제됨 — 본 slice 는 여기에 openai-compatible(custom/openai) 분기 + 미지원 provider 분기 test 를 **추가**(기존 azure test 회귀 보존).

## Acceptance Criteria

변경 파일: `src/llm/llm-http-gateway.service.ts`(provider 분기 dispatch) + `src/llm/llm-http-gateway.service.spec.ts`(분기 test 추가). 신규 파일 0 (기존 service/spec 만 변경). module 변경 0 (이미 등록됨).

- [ ] `LlmHttpGateway.generate` 가 `config.provider` 값에 따라 adapter 를 선택 dispatch 한다:
  - `LlmProvider.AzureOpenai` → 기존 경로: `buildAzureOpenaiRequest`(apiVersion 상수 default 공급) + `parseAzureOpenaiResponse`. (기존 동작 보존 — 회귀 0.)
  - `LlmProvider.Custom` 또는 `LlmProvider.Openai` → 신규 경로: `buildOpenaiCompatibleRequest`(apiVersion 불요) + `parseOpenaiCompatibleResponse`(`config.provider` 를 provider 인자로 전달 — result.provider 에 정확히 custom/openai 가 채워지도록).
  - 그 외(`Anthropic` / `GoogleGemini` / 알 수 없는 값) → 명확한 "미지원 — 본 slice 는 azure_openai / custom / openai 만 처리" 한국어 error throw(provider 값 포함). anthropic/gemini 연결은 Follow-up.
- [ ] **공통 흐름 보존** — config 조회(repository.findById raw row, 부재 시 throw) → cipher.decrypt(ciphertext apiKey 평문화) → adapter dispatch(build) → **주입된 fetch**(POST, url/headers/body) → HTTP non-2xx throw(status 포함) → response.json() → adapter dispatch(parse) → `LlmGenerateResult` 반환. dispatch 가 build/parse 두 지점 모두에서 동일 provider 기준으로 일관되게 분기해야 한다.
- [ ] **fetch / cipher 주입 유지** — `FetchLike` 생성자 주입(@Optional default globalThis.fetch) + cipher DI 그대로. 실 네트워크 호출 0 / 실 LLM_APIKEY_ENC_KEY 주입 0(unit 은 fetch mock + cipher mock).
- [ ] **Happy-path unit test 1+** — 각 dispatch 경로별: (a) azure_openai config + 정상 fetch mock → azure 경로로 호출되고(올바른 url/api-key 헤더/api-version) 올바른 `LlmGenerateResult`(provider=azure_openai) 반환[기존 test 보존 또는 보강], (b) custom config + 정상 fetch mock → openai-compatible 경로로 호출되고(올바른 `/chat/completions` url / `Authorization: Bearer` 헤더 / body 에 model 필드) `LlmGenerateResult.provider == custom` 반환, (c) openai config → 동일 경로 + `provider == openai` 반환. fetch 가 분기별로 올바른 url/headers/body 로 1회 호출됐는지 검증.
- [ ] **Error path unit test 1+** — 각 dispatch 경로에서 실패 throw 검증: config 부재(findById null) / decrypt throw / fetch reject(네트워크 오류) / HTTP non-2xx(401·500) / 비정상 응답 JSON(choices 누락 등 parse throw). 최소 azure 경로와 openai-compatible 경로 각각에서 fetch reject + non-2xx + parse-throw 를 cover.
- [ ] **Flow / branch coverage** — 각 분기 1+ test: provider == azure_openai vs custom vs openai vs 미지원(anthropic/google_gemini → throw). build dispatch 분기 + parse dispatch 분기 + HTTP 2xx vs non-2xx 각각 분리.
- [ ] **Negative cases 충분 cover** — 예외 상황 각 1+ test: 미지원 provider(anthropic / google_gemini → 미지원 throw, 각각) / openai-compatible 경로의 fetch reject / openai-compatible 경로의 HTTP 500 / openai-compatible 경로의 비정상 응답(choices 빈 배열 등) / decrypt 실패. 단일 negative 만으로 부족 — 예외 처리 분기마다 cover.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test` 통과(신규/변경 spec 포함 전체 green).
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%; 변경 파일 100% 목표).
- [ ] 새 외부 dependency 0(`pnpm add` 0 — Node 내장 fetch + 기존 @nestjs/common + 기존 adapter 함수만, package.json/lockfile 변경 0). 외부 credential 0(실 LLM API key·실 네트워크 호출 0 — fetch 주입 mock / cipher DI mock). schema migration 0(LlmProviderConfig 4 필드 그대로). auth 변경 0.

## Out of Scope

- **anthropic / google_gemini adapter 연결** — 이 둘은 OpenAI 호환과 다른 wire 포맷(anthropic messages API + x-api-key, gemini generateContent)이라 adapter 순수 함수 자체가 아직 없다 → Follow-up #1, #2(각각 adapter slice 선행 후 gateway 연결). 본 slice 는 이 둘을 "미지원" throw 로 둔다.
- **apiVersion / 기타 파라미터 영속 컬럼화** — `LlmProviderConfig` 4 필드 그대로. azure 경로는 상수 default api-version 유지 → schema migration(§5 게이트) Follow-up.
- **실 네트워크 호출 / 실 credential 주입** — fetch 주입 mock + cipher DI mock 유지. 실 LLM 호출·실 `LLM_APIKEY_ENC_KEY` 주입은 통합/배포 단계 책임(§5 재평가) → Follow-up.
- **DifficultyMapping ↔ provider/config routing** — 난이도별 config 선택 로직은 별도 slice → Follow-up.
- **assessment 평가 파이프라인 wiring (P5)** — 본 gateway 를 실제 평가 흐름에 연결하는 것은 P5 책임.
- **api.md / modules.md doc-sync** — gateway slice 들이 모인 뒤 별도 direct doc task.
- **package.json 변경** — 새 dependency 0 원칙(§5/§9 미발화 유지).

## Suggested Sub-agents

`implementer → tester`. (architect 불요 — `LlmGateway` interface(T-0135) + azure adapter(T-0155) + openai-compatible adapter(T-0157) + orchestration service(T-0156) + generic HTTP 결정[journal 10:35]이 contract 와 부품을 모두 박제 완료. 본 slice 는 기존 service 안에서 이미 존재하는 두 adapter 를 provider 값으로 선택 dispatch 하도록 분기를 추가하는 구현이라 새 모듈 경계/공개 API 형태 결정 불요. build/parse 두 지점의 일관된 분기 + provider 인자 전달은 구현 결정으로 spec 에 박제.)

## Follow-ups

(생성 시 비어 있음. 향후 chain 후보 — sub-agent 가 발견 시 append:)

- (chain #1) anthropic adapter 순수 함수(messages API + x-api-key) → gateway 연결.
- (chain #2) google_gemini adapter 순수 함수(generateContent 포맷) → gateway 연결.
- (chain #3) apiVersion(및 기타 azure 파라미터) 영속 컬럼화 — schema migration(§5 게이트).
- (chain #4) 실 네트워크/실 credential 통합 — `LLM_APIKEY_ENC_KEY` env 주입 + 실 LLM 호출 smoke/e2e(§5 재평가).
- (chain #5) DifficultyMapping ↔ provider/config routing(난이도별 config 선택).
- (chain #6) api.md / modules.md gateway doc-sync(direct).
