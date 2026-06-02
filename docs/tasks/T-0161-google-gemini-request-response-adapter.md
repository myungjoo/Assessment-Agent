---
id: T-0161
title: GoogleGeminiAdapter — google_gemini 요청/응답 shaping 순수 함수 (generateContent 포맷)
phase: P4
status: DONE
completedAt: 2026-06-02T12:58:51+09:00
mergedAs: e10033c
prNumber: 151
reviewRounds: 1
commitMode: pr
coversReq: [REQ-099, REQ-101, REQ-102, REQ-103]
estimatedDiff: 240
estimatedFiles: 2
created: 2026-06-02
plannerNote: "P4 milestone-1 chain 7/N — google_gemini adapter 순수 함수(buildGeminiRequest/parseGeminiResponse, generateContent 포맷). T-0155/T-0157/T-0159 mirror. R-112 backbone ×1.5(@unique 없음 → P2002 미적용). 순수 함수라 fetch/credential 0(§5 미발화). gateway 연결은 Follow-up."
---

# T-0161 — GoogleGeminiAdapter — google_gemini 요청/응답 shaping 순수 함수 (generateContent 포맷)

## Why

P4 milestone-1 (LLM provider HTTP gateway) chain 의 7차 slice다. 사용자가 milestone-1 을 승인했고(journal 10:35 — generic HTTP gateway, 새 dependency 0, credential 은 통합 단계에서만 env 주입), 지금까지 azure_openai adapter(T-0155) + openai-compatible(custom/openai) adapter(T-0157) + anthropic adapter(T-0159) 순수 함수가 박제되고 `LlmHttpGateway`(T-0156) 의 provider routing dispatch(T-0158 azure/custom/openai + T-0160 anthropic)로 **4 provider(azure_openai / custom / openai / anthropic)가 unit 수준에서 동작**한다. 그러나 `LlmProvider.GoogleGemini` 는 wire 포맷이 달라(`generateContent` endpoint · `contents[]` 구조 · API key 쿼리·헤더) adapter 순수 함수 자체가 아직 없어 gateway 가 여전히 "미지원" throw 한다 — milestone-1 의 **마지막 미연결 provider**다. 본 slice 는 T-0159 Follow-up #2(= T-0157 Follow-up · T-0160 Follow-up chain #1)를 닫는다 — google_gemini 의 `buildGeminiRequest` / `parseGeminiResponse` 순수 함수 2종 + colocated spec 을 박제한다(T-0155/T-0157/T-0159 패턴 mirror). 새 외부 dependency 0(Node 내장만, pnpm add 0 — 순수 함수라 fetch 도 본 slice 에서 미사용) / 실 credential 0(apiKey 는 함수 평문 인자로만, 실 LLM 호출·env 주입 0) / schema migration 0 / auth 0 — §5 HITL 게이트 미발화. gateway 연결(`config.provider == google_gemini` → 본 adapter dispatch)은 Follow-up(adapter 선행 후 wiring slice).

## Required Reading

- `D:\Assessment-Agent\src\llm\providers\anthropic.adapter.ts` — **mirror 할 직전 패턴(T-0159)**. 본 slice 는 동일 구조로 google_gemini adapter 를 만든다: `buildGeminiRequest(input)` + `parseGeminiResponse(json, modelId)` 순수 함수 2종 + 입력 타입 `GeminiRequestInput`(endpointUrl/modelId/apiKey/prompt/options) + 반환 타입 `GeminiRequest`({url,headers,body}) + 내부 `assertNonEmpty` guard + 상수 default. **부수효과 0 / 외부 의존 0(Node 내장만) / apiKey 평문 인자로만(decrypt/secret 주입 코드 0) / 실 fetch 0** 원칙 동일.
- `D:\Assessment-Agent\src\llm\providers\openai-compatible.adapter.ts` — provider 인자를 받지 않고 `LlmProvider.GoogleGemini` 를 하드코딩하는 점은 azure/anthropic adapter 방식과 동일(openai-compatible 의 provider 인자 방식과 다름 — gemini 는 단일 provider). difficulty 옵션 분기(있음/없음) 처리 패턴 참고.
- `D:\Assessment-Agent\src\llm\llm-gateway.interface.ts` — `LlmGenerateOptions`(modelId/difficulty?) / `LlmGenerateResult`(narrative/provider/modelId) / `LlmProvider.GoogleGemini="google_gemini"` enum. 반환 result 의 provider 는 `LlmProvider.GoogleGemini` 하드코딩.
- `D:\Assessment-Agent\src\llm\providers\anthropic.adapter.spec.ts` — **colocated spec 패턴 mirror**. 본 slice 의 신규 spec 은 `D:\Assessment-Agent\src\llm\providers\google-gemini.adapter.spec.ts`(colocated) 에 둔다. anthropic spec 의 happy-path / error-path / branch / negative 구조를 gemini wire 포맷으로 mirror.

### google_gemini generateContent wire 포맷 (구현 결정 — 본 slice 에 박제)

azure/openai-compat/anthropic 과의 핵심 차이(구현 시 본 명세를 따른다):

- **URL**: `<endpointUrl>` 을 base 로 trailing slash 정규화(제거) 후 `/v1beta/models/<modelId>:generateContent` 를 append 한다(`<base>/v1beta/models/<modelId>:generateContent`). gemini 는 model 을 URL path 에 싣는다(anthropic/openai 의 body model 필드와 다름 — azure 의 deployment URL 라우팅과 유사하나 path 형태가 다름).
- **인증**: API key 는 `x-goog-api-key` 헤더에 싣는다(`Authorization: Bearer` 도 `x-api-key` 도 아님). `Content-Type: application/json` 동반. (쿼리 `?key=` 방식도 gemini 가 허용하나 본 slice 는 헤더 방식 1종으로 일관 박제 — apiKey 가 URL 에 노출되지 않아 로그 누출 위험이 낮음.)
- **body**: `{ contents: [{ role: "user", parts: [{ text: <prompt> }] }] }`. OpenAI 의 `messages[].content` 가 아니라 `contents[].parts[].text` 중첩 구조.
- **difficulty 힌트**: difficulty 가 명시된 경우 top-level `systemInstruction: { parts: [{ text: "난이도 수준: <difficulty>" }] }` 필드로 싣는다(gemini 전용 systemInstruction 구조 — OpenAI system message·anthropic top-level system string 과 다름). 부재 시 systemInstruction 미포함.
- **응답 파싱**: `candidates[0].content.parts[0].text` 가 narrative(OpenAI 의 `choices[0].message.content`·anthropic 의 `content[0].text` 와 다른 중첩 경로). 비정상 응답(candidates 누락/빈 배열/content object 아님/parts 누락·빈 배열/text 누락·빈 문자열/object 아님) 각각 명확한 한국어 Error throw.
- **상수 default**: gemini 도 `maxOutputTokens` 등 파라미터가 있으나 LlmProviderConfig 4 필드(provider/endpointUrl/apiKey/modelId)만 영속되므로, 필요한 default 는 adapter 상수로 박제(예: `GEMINI_MAX_OUTPUT_TOKENS`)하고 영속 컬럼화는 Follow-up(schema migration §5 게이트). (단 generateContent 는 maxOutputTokens 가 필수가 아니므로, generationConfig 를 굳이 싣지 않고 생략해도 무방 — 구현 판단. 싣는다면 상수 default 박제 + spec 검증.)

## Acceptance Criteria

신규 파일: `src/llm/providers/google-gemini.adapter.ts`(순수 함수 2종 + 타입/상수) + `src/llm/providers/google-gemini.adapter.spec.ts`(colocated spec). gateway/module/enum 변경 0(adapter 순수 함수만 — gateway 연결은 Follow-up).

- [ ] `buildGeminiRequest(input: GeminiRequestInput): GeminiRequest` 구현 — 위 wire 포맷대로 `{ url: <base>/v1beta/models/<modelId>:generateContent, headers: {x-goog-api-key, Content-Type}, body: JSON({contents:[{role:user,parts:[{text:prompt}]}], systemInstruction?}) }` 조립. endpointUrl trailing slash 정규화. 실 fetch 0(순수 함수).
- [ ] `parseGeminiResponse(json: unknown, modelId: string): LlmGenerateResult` 구현 — `candidates[0].content.parts[0].text` → narrative, provider=`LlmProvider.GoogleGemini` 하드코딩, modelId 그대로 반환.
- [ ] **입력 검증** — `assertNonEmpty` guard 로 endpointUrl/modelId/apiKey/prompt 가 비어있거나 string 아니면 한국어 Error throw(anthropic adapter 패턴 동일).
- [ ] **Happy-path unit test 1+** — 정상 input → 올바른 url(`<base>/v1beta/models/<modelId>:generateContent`) / `x-goog-api-key` 헤더 / body 의 `contents[0].parts[0].text == prompt` 검증. parse: 정상 candidates JSON → narrative=`candidates[0].content.parts[0].text`, provider=google_gemini, modelId 일치.
- [ ] **Error path unit test 1+** — build: endpointUrl/modelId/apiKey/prompt 각 빈 값·non-string 시 throw. parse: json 이 object 아님 / candidates 누락·빈 배열 / candidates[0].content object 아님 / parts 누락·빈 배열 / parts[0].text 누락·빈 문자열·non-string 각 throw.
- [ ] **Flow / branch coverage** — 각 분기 1+ test: difficulty 있음(systemInstruction 포함) vs 없음(systemInstruction 미포함) build 분기 / endpointUrl trailing slash 있음 vs 없음 정규화 / parse 의 정상 vs 각 비정상 분기.
- [ ] **Negative cases 충분 cover** — 예외 상황 각 1+ test(단일 negative 만으로 부족 — 예외 처리 분기마다): build 의 4 필드 각 빈 값 / parse 의 candidates 누락·빈 배열·content non-object·parts 빈 배열·text 빈 문자열·json null·json 배열. 각 한국어 error message 가 어느 필드/경로인지 식별 가능한지도 검증.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test` 통과(신규 spec 포함 전체 green).
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%; 신규 adapter 파일 100% 목표).
- [ ] 새 외부 dependency 0(`pnpm add` 0 — Node 내장 + 기존 llm-gateway.interface import 만, package.json/lockfile 변경 0). 외부 credential 0(apiKey 평문 함수 인자로만 — 실 LLM API key·실 네트워크 호출·env 주입 0). schema migration 0(LlmProviderConfig 4 필드 그대로). auth 변경 0.

## Out of Scope

- **gateway provider routing dispatch 연결** — `LlmHttpGateway.generate` 가 `config.provider == google_gemini` 시 본 adapter 로 build/parse dispatch 하도록 분기 추가 + "미지원" 검사에서 google_gemini 제거는 별도 slice(adapter 선행 후 wiring) → Follow-up #1. 본 slice 는 순수 함수만 박제하며 gateway/enum/module 은 건드리지 않는다(google_gemini 는 본 slice 후에도 gateway 에서 여전히 "미지원" throw).
- **maxOutputTokens / 기타 generationConfig 파라미터 영속 컬럼화** — LlmProviderConfig 4 필드 그대로. 필요한 default 는 adapter 상수. 영속 컬럼화는 schema migration(§5 게이트) → Follow-up.
- **실 네트워크 호출 / 실 credential 주입** — 순수 함수라 fetch 미사용. 실 LLM 호출·실 `LLM_APIKEY_ENC_KEY` 주입은 통합/배포 단계 책임(§5 재평가) → Follow-up.
- **DifficultyMapping ↔ provider/config routing** — 난이도별 config 선택 로직은 별도 slice → Follow-up.
- **api.md / modules.md doc-sync** — gateway slice 들이 모인 뒤 별도 direct doc task.
- **package.json 변경** — 새 dependency 0 원칙(§5/§9 미발화 유지).

## Suggested Sub-agents

`implementer → tester`. (architect 불요 — `LlmGateway` interface(T-0135) + azure/openai-compat/anthropic adapter(T-0155/T-0157/T-0159) 패턴 + generic HTTP 결정[journal 10:35]이 contract 와 부품을 모두 박제 완료. 본 slice 는 기존 adapter 패턴을 google_gemini generateContent wire 포맷으로 mirror 하는 구현이라 새 모듈 경계/공개 API 형태 결정 불요. gemini wire 포맷 세부는 위 "google_gemini generateContent wire 포맷" 절에 구현 결정으로 박제.)

## Follow-ups

(생성 시 비어 있음. 향후 chain 후보 — sub-agent 가 발견 시 append:)

- (chain #1) gateway provider routing dispatch 에 google_gemini 분기 연결(`LlmHttpGateway.generate` 가 `LlmProvider.GoogleGemini` → 본 adapter dispatch + "미지원" 검사에서 google_gemini 제거). 이로써 milestone-1 5 provider 전부 unit 동작 — adapter chain 종결.
- (chain #2) maxOutputTokens / apiVersion / anthropic-version / max_tokens(provider 별 파라미터) 영속 컬럼화 — schema migration(§5 게이트).
- (chain #3) 실 네트워크/실 credential 통합 — `LLM_APIKEY_ENC_KEY` env 주입 + 실 LLM 호출 smoke/e2e(§5 재평가). **이 단계가 milestone-1 의 실 LLM 통합 — 실 credential 필요로 §5 게이트 발화 예상**.
- (chain #4) DifficultyMapping ↔ provider/config routing(난이도별 config 선택).
- (chain #5) api.md / modules.md gateway doc-sync(direct).
