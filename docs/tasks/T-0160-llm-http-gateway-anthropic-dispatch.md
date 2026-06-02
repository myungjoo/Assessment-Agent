---
id: T-0160
title: LlmHttpGateway — anthropic provider routing dispatch 연결 (anthropic adapter wiring)
phase: P4
status: DONE
completedAt: 2026-06-02T12:45:14+09:00
mergedAs: a61f192
prNumber: 150
reviewRounds: 1
commitMode: pr
coversReq: [REQ-099, REQ-101, REQ-102, REQ-103]
estimatedDiff: 180
estimatedFiles: 2
created: 2026-06-02
plannerNote: "P4 milestone-1 chain 6/N — gateway 가 config.provider==anthropic 시 anthropic adapter(T-0159) dispatch. T-0159 Follow-up #1 + T-0158 Follow-up #1. R-112 backbone ×1.5. fetch 주입 mock/cipher DI mock → dep0/credential0(§5 미발화)."
---

# T-0160 — LlmHttpGateway — anthropic provider routing dispatch 연결 (anthropic adapter wiring)

## Why

P4 milestone-1 (LLM provider HTTP gateway) chain 의 6차 slice다. 지금까지 azure_openai adapter(T-0155) + openai-compatible(custom/openai) adapter(T-0157) + anthropic adapter(T-0159) 순수 함수가 박제됐고, `LlmHttpGateway`(T-0156) 가 provider routing dispatch(T-0158)로 azure_openai / custom / openai 3 provider 를 처리한다. 그러나 **anthropic adapter(`buildAnthropicRequest` / `parseAnthropicResponse`, merged f150a95)는 만들어졌으나 아직 gateway 에 연결되지 않아** `LlmHttpGateway.generate` 가 anthropic provider 를 여전히 "미지원" throw 한다. 본 slice 는 T-0159 Follow-up #1(= T-0158 Follow-up #1)을 닫는다 — `config.provider == anthropic` 일 때 anthropic adapter 로 build/parse dispatch 하도록 분기를 추가한다. 이로써 milestone-1 의 4 provider(azure_openai / custom / openai / anthropic)가 unit 수준에서 동작하게 된다. 새 외부 dependency 0(기존 adapter 함수 호출만, pnpm add 0) / 실 credential 0(fetch 주입 mock + cipher DI mock) / 실 네트워크 0 / schema migration 0 / auth 0 — §5 HITL 게이트 미발화. google_gemini 만 미연결 잔존(adapter 순수 함수 자체가 미존재 → 별도 Follow-up).

## Required Reading

- `D:\Assessment-Agent\src\llm\llm-http-gateway.service.ts` — **본 slice 의 주 변경 대상**. 현재 `generate` 는 provider 가 `AzureOpenai` / `Custom` / `Openai` 가 아니면 "미지원" throw(라인 93~102) + build/parse 두 지점에서 azure vs openai-compatible 만 삼항 분기(라인 110~126, 147~149). 본 slice 는 (1) 미지원 검사에서 `Anthropic` 을 허용 집합에 추가, (2) build dispatch 에 anthropic 분기 추가(`buildAnthropicRequest`), (3) parse dispatch 에 anthropic 분기 추가(`parseAnthropicResponse(json, config.modelId)`)를 한다. `FetchLike` 주입 / `AZURE_OPENAI_DEFAULT_API_VERSION` 상수 / repository.findById raw row 조회 / cipher.decrypt / non-2xx throw 흐름은 그대로 유지. **참고**: build/parse 가 azure / openai-compatible / anthropic 3-way 가 되므로 기존 삼항 연산자 대신 if/else 또는 switch 로 정리하는 것이 가독성에 유리(구현 판단). anthropic 은 apiVersion 불요(buildAnthropicRequest 입력에 apiVersion 필드 없음), parse 는 provider 인자 불요(adapter 가 `LlmProvider.Anthropic` 하드코딩).
- `D:\Assessment-Agent\src\llm\providers\anthropic.adapter.ts` — 본 slice 가 연결할 순수 함수 `buildAnthropicRequest(input)` / `parseAnthropicResponse(json, modelId)`. 입력 타입 `AnthropicRequestInput`(endpointUrl/modelId/apiKey/prompt/options — **apiVersion 없음**), `parseAnthropicResponse` 는 provider 인자 없이 `LlmProvider.Anthropic` 하드코딩(openai-compatible 의 provider 인자 방식과 다름)에 유의.
- `D:\Assessment-Agent\src\llm\providers\openai-compatible.adapter.ts` — 직전 slice(T-0158)가 연결한 패턴 참고. anthropic 분기를 동일 cadence 로 추가.
- `D:\Assessment-Agent\src\llm\llm-gateway.interface.ts` — `LlmProvider` enum(`Anthropic="anthropic"` / `GoogleGemini="google_gemini"` 등). 본 slice 의 분기 판정 기준. google_gemini 는 본 slice 에서 여전히 "미지원" throw(adapter 미존재 → Follow-up).
- `D:\Assessment-Agent\src\llm\llm-http-gateway.service.spec.ts` — 기존 gateway colocated spec. azure + openai-compatible(custom/openai) + 미지원 provider 패턴이 박제됨 — 본 slice 는 여기에 anthropic 분기 test 를 **추가**(기존 test 회귀 보존). anthropic 의 wire 포맷(`/v1/messages` url / `x-api-key` 헤더 / `anthropic-version` / body `max_tokens`+`messages` / 응답 `content[0].text`) 검증 추가.

## Acceptance Criteria

변경 파일: `src/llm/llm-http-gateway.service.ts`(anthropic 분기 dispatch 추가) + `src/llm/llm-http-gateway.service.spec.ts`(anthropic 분기 test 추가). 신규 파일 0(기존 service/spec 만 변경). module 변경 0(이미 등록됨).

- [ ] `LlmHttpGateway.generate` 가 `config.provider == LlmProvider.Anthropic` 일 때 anthropic adapter 로 dispatch 한다:
  - build dispatch: `buildAnthropicRequest({ endpointUrl, modelId, apiKey, prompt, options })`(apiVersion 불요).
  - parse dispatch: `parseAnthropicResponse(json, config.modelId)`(provider 인자 불요 — adapter 가 `LlmProvider.Anthropic` 하드코딩).
  - 기존 azure_openai / custom / openai 경로는 회귀 0 으로 보존.
  - `GoogleGemini` 및 알 수 없는 값은 여전히 "미지원" 한국어 error throw(provider 값 포함). google_gemini 연결은 Follow-up(adapter 순수 함수 미존재).
- [ ] **공통 흐름 보존** — config 조회(repository.findById raw row, 부재 시 throw) → cipher.decrypt → adapter dispatch(build) → 주입된 fetch(POST) → HTTP non-2xx throw(status 포함) → response.json() → adapter dispatch(parse) → `LlmGenerateResult` 반환. build/parse 두 dispatch 지점이 동일 provider 기준으로 일관 분기해야 한다.
- [ ] **fetch / cipher 주입 유지** — `FetchLike` 생성자 주입(@Optional default globalThis.fetch) + cipher DI 그대로. 실 네트워크 호출 0 / 실 `LLM_APIKEY_ENC_KEY` 주입 0(unit 은 fetch mock + cipher mock).
- [ ] **Happy-path unit test 1+** — anthropic config + 정상 fetch mock → anthropic 경로로 호출되고(올바른 `<endpointUrl>/v1/messages` url / `x-api-key` 헤더 / `anthropic-version` 헤더 / body 에 `model`·`max_tokens`·`messages` 포함) `LlmGenerateResult`(narrative=content[0].text, provider=anthropic, modelId) 반환 검증. fetch 가 올바른 url/headers/body 로 1회 호출됐는지 검증. (기존 azure / custom / openai happy-path test 보존.)
- [ ] **Error path unit test 1+** — anthropic 경로에서 실패 throw 검증: config 부재(findById null) / decrypt throw / fetch reject(네트워크 오류) / HTTP non-2xx(401·500) / 비정상 응답 JSON(content 누락·빈 배열 등 parseAnthropicResponse throw) 각각.
- [ ] **Flow / branch coverage** — 각 분기 1+ test: provider == anthropic 분기(build + parse 각 지점) / HTTP 2xx vs non-2xx / 미지원(google_gemini → throw). anthropic difficulty 있음 vs 없음(system 필드 분기 — adapter 내부지만 gateway 경유 검증 1+)도 cover.
- [ ] **Negative cases 충분 cover** — 예외 상황 각 1+ test: anthropic 경로의 fetch reject / anthropic 경로의 HTTP 500 / anthropic 경로의 비정상 응답(content 빈 배열 등) / decrypt 실패 / google_gemini 미지원 throw / 알 수 없는 provider 값 미지원 throw. 단일 negative 만으로 부족 — 예외 처리 분기마다 cover.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test` 통과(변경 spec 포함 전체 green).
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%; 변경 파일 100% 목표).
- [ ] 새 외부 dependency 0(`pnpm add` 0 — Node 내장 fetch + 기존 @nestjs/common + 기존 anthropic adapter 함수만, package.json/lockfile 변경 0). 외부 credential 0(실 LLM API key·실 네트워크 호출 0 — fetch 주입 mock / cipher DI mock). schema migration 0(LlmProviderConfig 4 필드 그대로). auth 변경 0.

## Out of Scope

- **google_gemini adapter 연결** — gemini 는 또 다른 wire 포맷(`generateContent`)이고 adapter 순수 함수 자체가 아직 없다 → 별도 Follow-up(adapter slice 선행 후 gateway 연결). 본 slice 는 google_gemini 를 "미지원" throw 로 둔다.
- **max_tokens / anthropic-version 영속 컬럼화** — `LlmProviderConfig` 4 필드 그대로. anthropic 경로는 adapter 의 상수 default(`ANTHROPIC_MAX_TOKENS` / `ANTHROPIC_VERSION`) 유지 → schema migration(§5 게이트) Follow-up.
- **실 네트워크 호출 / 실 credential 주입** — fetch 주입 mock + cipher DI mock 유지. 실 LLM 호출·실 `LLM_APIKEY_ENC_KEY` 주입은 통합/배포 단계 책임(§5 재평가) → Follow-up.
- **DifficultyMapping ↔ provider/config routing** — 난이도별 config 선택 로직은 별도 slice → Follow-up.
- **assessment 평가 파이프라인 wiring (P5)** — 본 gateway 를 실제 평가 흐름에 연결하는 것은 P5 책임.
- **api.md / modules.md doc-sync** — gateway slice 들이 모인 뒤 별도 direct doc task.
- **package.json 변경** — 새 dependency 0 원칙(§5/§9 미발화 유지).

## Suggested Sub-agents

`implementer → tester`. (architect 불요 — `LlmGateway` interface(T-0135) + anthropic adapter(T-0159) + 기존 gateway provider routing dispatch(T-0158) + generic HTTP 결정[journal 10:35]이 contract 와 부품을 모두 박제 완료. 본 slice 는 기존 service 의 provider 분기에 anthropic case 1 개를 추가하는 구현이라 새 모듈 경계/공개 API 형태 결정 불요. build/parse 두 지점의 anthropic 분기 추가는 구현 결정으로 spec 에 박제.)

## Follow-ups

(생성 시 비어 있음. 향후 chain 후보 — sub-agent 가 발견 시 append:)

- (chain #1) google_gemini adapter 순수 함수(generateContent 포맷) → gateway 연결(마지막 미연결 provider).
- (chain #2) max_tokens / anthropic-version / apiVersion(및 기타 파라미터) 영속 컬럼화 — schema migration(§5 게이트).
- (chain #3) 실 네트워크/실 credential 통합 — `LLM_APIKEY_ENC_KEY` env 주입 + 실 LLM 호출 smoke/e2e(§5 재평가).
- (chain #4) DifficultyMapping ↔ provider/config routing(난이도별 config 선택).
- (chain #5) api.md / modules.md gateway doc-sync(direct).
