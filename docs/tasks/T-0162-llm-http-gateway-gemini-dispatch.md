---
id: T-0162
title: LlmHttpGateway google_gemini provider routing dispatch 연결 (gemini adapter wiring)
phase: P4
status: DONE
completedAt: 2026-06-02T13:14:17+09:00
mergedAs: d5666b8
prNumber: 152
reviewRounds: 1
commitMode: pr
coversReq: [REQ-099, REQ-101, REQ-102, REQ-103]
estimatedDiff: 180
estimatedFiles: 2
created: 2026-06-02
plannerNote: "P4 milestone-1 chain 8/N(종결 slice) — gateway 가 config.provider==google_gemini 시 buildGeminiRequest/parseGeminiResponse dispatch. T-0158/T-0160 wiring 패턴 mirror. R-112 backbone ×1.5(@unique 없음 → P2002 미적용) ~180 LOC cap 내. dep0/credential0(§5 미발화). 이후 chain(실 LLM 통합)은 §5 게이트."
---

# T-0162 — LlmHttpGateway google_gemini provider routing dispatch 연결 (gemini adapter wiring)

## Why

P4 milestone-1 (LLM provider HTTP gateway) chain 의 8차이자 **adapter wiring 종결 slice**다. 사용자가 milestone-1 을 승인했고(journal 10:35 — generic HTTP gateway, 새 dependency 0, credential 은 통합 단계에서만 env 주입), 지금까지 5 provider adapter 순수 함수(azure_openai T-0155 / openai-compatible custom·openai T-0157 / anthropic T-0159 / google_gemini T-0161)가 모두 박제됐고, `LlmHttpGateway`(T-0156) 의 provider routing dispatch 가 azure/custom/openai(T-0158) + anthropic(T-0160) **4 provider**를 unit 수준에서 동작시킨다. 그러나 `google_gemini` adapter(`buildGeminiRequest`/`parseGeminiResponse`, T-0161 merged)는 박제됐으나 gateway 에는 아직 미연결 — gateway 는 `config.provider == google_gemini` 시 여전히 "미지원" error throw 한다(`llm-http-gateway.service.ts` L99~109 의 provider 검사 + L168~174 의 parse dispatch 에 gemini 분기 부재). 본 slice 는 T-0161 Follow-up #1(= 각 adapter slice 의 wiring chain 종결)을 닫는다 — gateway 가 google_gemini 도 dispatch 하도록 분기를 추가하고 "미지원" 검사에서 google_gemini 를 제거한다. 이로써 **milestone-1 의 5 provider 가 전부 unit 수준에서 동작**한다. T-0158/T-0160 의 wiring 패턴을 그대로 mirror 하므로(gemini adapter 는 anthropic 처럼 provider 를 하드코딩 → parse 에 provider 인자 불요) 구현이 단순하다. 새 외부 dependency 0(기존 adapter 함수 호출만, pnpm add 0) / 실 credential 0(fetch 주입 unit mock + cipher DI mock — 실 네트워크·실 `LLM_APIKEY_ENC_KEY`·실 LLM 호출 0) / schema migration 0(LlmProviderConfig 4 필드 그대로) / auth 0 — §5 HITL 게이트 미발화. **주의: 본 slice 이후 milestone-1 의 다음 단계(실 LLM 통합 — 실제 endpoint 호출을 평가 파이프라인에 연결, 실 credential·실 HTTP·env 주입)는 §5 게이트다(아래 Follow-ups 참조).**

## Required Reading

- `D:\Assessment-Agent\src\llm\llm-http-gateway.service.ts` — **본 slice 가 수정할 파일**. 현재 generate() 가 (2) provider 검사(L99~109, azure_openai/custom/openai/anthropic 만 허용, 그 외 미지원 throw — google_gemini 포함) + (4) build dispatch(L120~146, azure/anthropic/else=openai-compatible 3-way) + (7) parse dispatch(L167~174, azure/anthropic/else=openai-compatible)로 구성. 본 slice 는: (a) provider 검사에서 google_gemini 를 허용 목록에 추가(미지원 throw 에서 제거), (b) build dispatch 에 `provider === LlmProvider.GoogleGemini` → `buildGeminiRequest({endpointUrl, modelId, apiKey, prompt, options})` 분기 추가, (c) parse dispatch 에 `provider === LlmProvider.GoogleGemini` → `parseGeminiResponse(json, config.modelId)` 분기 추가. **T-0160 이 anthropic 을 추가한 방식과 동형** — gemini 도 단일 provider 라 provider 인자 불요(adapter 가 LlmProvider.GoogleGemini 하드코딩). 미지원 throw 는 unknown provider 만 남는다.
- `D:\Assessment-Agent\src\llm\providers\google-gemini.adapter.ts` — 연결할 대상 순수 함수. `buildGeminiRequest(input: GeminiRequestInput): GeminiRequest`({url,headers,body}) — input = {endpointUrl, modelId, apiKey, prompt, options}. `parseGeminiResponse(json: unknown, modelId: string): LlmGenerateResult` — provider=LlmProvider.GoogleGemini 하드코딩(인자 불요). anthropic adapter 와 동형 시그니처.
- `D:\Assessment-Agent\src\llm\providers\anthropic.adapter.ts` — gemini wiring 의 mirror 기준(직전 wiring T-0160 이 연결한 adapter). buildAnthropicRequest/parseAnthropicResponse 가 gateway 에서 어떻게 dispatch 되는지 패턴 참고(provider 인자 없는 단일 provider adapter).
- `D:\Assessment-Agent\src\llm\llm-http-gateway.service.spec.ts` — **확장할 spec**. T-0160 이 anthropic dispatch describe 블록과 미지원 it.each 를 어떻게 갱신했는지 mirror. 본 slice 는 google_gemini dispatch describe(happy/error/branch) 추가 + 미지원 it.each 에서 google_gemini 제거(이제 지원), unknown provider 만 미지원 검증 유지.
- `D:\Assessment-Agent\src\llm\llm-gateway.interface.ts` — `LlmProvider.GoogleGemini="google_gemini"` enum 값 확인.

## Acceptance Criteria

변경 파일 2(`src/llm/llm-http-gateway.service.ts` + colocated `src/llm/llm-http-gateway.service.spec.ts`, 신규 파일 0). gateway 가 google_gemini 도 routing dispatch.

- [ ] `LlmHttpGateway.generate` 의 provider 검사(미지원 throw 분기)에서 google_gemini 를 허용으로 변경 — 허용 provider = azure_openai/custom/openai/anthropic/google_gemini, 그 외(unknown)만 미지원 throw.
- [ ] build dispatch 에 `provider === LlmProvider.GoogleGemini` → `buildGeminiRequest({endpointUrl: config.endpointUrl, modelId: config.modelId, apiKey, prompt, options})` 분기 추가(anthropic 분기 동형, apiVersion 불요).
- [ ] parse dispatch 에 `provider === LlmProvider.GoogleGemini` → `parseGeminiResponse(json, config.modelId)` 분기 추가(provider 인자 불요 — adapter 하드코딩).
- [ ] **Happy-path unit test 1+** — config.provider=google_gemini 인 mock config 로 generate() 호출 → repository.findById/cipher.decrypt/주입 fetch(mock, 정상 candidates JSON) 거쳐 LlmGenerateResult(narrative=candidates[0].content.parts[0].text, provider=google_gemini, modelId 일치) 반환. fetch 가 gemini URL(`<base>/v1beta/models/<modelId>:generateContent`) + `x-goog-api-key` 헤더로 호출됐는지 검증.
- [ ] **Error path unit test 1+** — google_gemini 경로의 각 error: config 부재(findById null)→throw / cipher.decrypt throw 전파 / fetch non-2xx(response.ok=false)→`google_gemini HTTP 호출 실패` throw / parseGeminiResponse 가 비정상 응답 JSON 에 throw 전파.
- [ ] **Flow / branch coverage** — google_gemini build 분기 + parse 분기 각 1+ test 실행되도록(기존 azure/anthropic/openai-compatible 분기 회귀 보존). difficulty 있음/없음 build 가 adapter 로 그대로 forward 되는지 1+(adapter 내부 분기는 T-0161 spec 책임이나, gateway 가 options 를 손실 없이 넘기는지 검증).
- [ ] **Negative cases 충분 cover** — 예외 상황 각 1+ test(단일 negative 만으로 부족): unknown provider(예: 빈 문자열·임의 값) 는 여전히 미지원 throw(google_gemini 가 추가돼도 unknown 누수 0) / fetch reject(네트워크 throw) 전파 / decrypt throw 전파 / parse throw 전파. 미지원 it.each 에서 google_gemini 가 제거되고 unknown 만 미지원으로 남는지 검증.
- [ ] **회귀 보존** — azure_openai/custom/openai/anthropic 기존 dispatch test 가 모두 green 유지(provider 분기 정리 후 누수·오분기 0).
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test` 통과(확장 spec 포함 전체 green).
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%; gateway service 파일 100% 목표).
- [ ] 새 외부 dependency 0(`pnpm add` 0 — 기존 google-gemini.adapter import 추가만, package.json/lockfile 변경 0). 외부 credential 0(fetch 주입 unit mock + cipher DI mock — 실 LLM API key·실 네트워크·실 `LLM_APIKEY_ENC_KEY`·env 주입 0). schema migration 0(LlmProviderConfig 4 필드 그대로). auth 변경 0.

## Out of Scope

- **adapter 순수 함수 수정** — `google-gemini.adapter.ts`(buildGeminiRequest/parseGeminiResponse)는 T-0161 에서 박제 완료. 본 slice 는 호출(연결)만 한다. adapter 내부 로직 변경 0.
- **maxOutputTokens / apiVersion / max_tokens 등 provider 별 파라미터 영속 컬럼화** — LlmProviderConfig 4 필드 그대로. 영속 컬럼화는 schema migration(§5 게이트) → Follow-up.
- **실 네트워크 호출 / 실 credential 주입 / 실 LLM 통합** — 본 slice 는 주입 fetch unit mock 으로만 검증. **실 endpoint 호출을 평가 파이프라인에 연결(실 `LLM_APIKEY_ENC_KEY` env 주입 + 실 HTTP + smoke/e2e)은 §5 HITL 게이트 — 별도 사용자 승인 필요. 본 task 에서 절대 하지 않는다.**
- **DifficultyMapping ↔ provider/config routing** — 난이도별 config 선택 로직은 별도 slice → Follow-up.
- **api.md / modules.md doc-sync** — milestone-1 gateway slice 들이 모두 모인 뒤 별도 direct doc task.
- **package.json 변경** — 새 dependency 0 원칙(§5/§9 미발화 유지).

## Suggested Sub-agents

`implementer → tester`. (architect 불요 — `LlmGateway` interface(T-0135) + 5 adapter 순수 함수(T-0155/T-0157/T-0159/T-0161) + gateway orchestration(T-0156) + wiring 패턴(T-0158 azure/custom/openai + T-0160 anthropic) + generic HTTP 결정[journal 10:35]이 contract·부품·연결 방식을 모두 박제 완료. 본 slice 는 T-0160 의 anthropic wiring 을 google_gemini 로 mirror 하는 단순 연결이라 새 모듈 경계/공개 API 형태 결정 불요.)

## Follow-ups

(생성 시 비어 있음. 향후 chain 후보 — sub-agent 가 발견 시 append:)

- **(chain #1 — §5 게이트) 실 네트워크/실 credential 통합** — `LLM_APIKEY_ENC_KEY` env 주입 + 실 LLM endpoint 호출을 평가 파이프라인에 연결 + smoke/e2e. **이 단계가 milestone-1 의 실 LLM 통합 — 실 credential·실 HTTP·env 주입 필요로 §5 HITL 게이트 발화 → 사용자 승인 필수. dep-free 작업 아님.** 본 T-0162 가 adapter wiring 종결 slice 이므로, 본 slice merge 후 milestone-1 의 dependency-free 잔여 작업은 사실상 소진된다 — 이후 진척은 본 chain #1 의 §5 승인이 선행돼야 한다.
- (chain #2 — §5 게이트) maxOutputTokens / apiVersion / anthropic-version / max_tokens(provider 별 파라미터) 영속 컬럼화 — schema migration(§5 게이트).
- (chain #3) DifficultyMapping ↔ provider/config routing(난이도별 config 선택).
- (chain #4) api.md / modules.md gateway doc-sync(direct, 순수 문서 정합 — §5 미발화).
