---
id: T-0155
title: AzureOpenaiAdapter — azure_openai 요청/응답 shaping 순수 함수 (generic HTTP gateway 1차 slice)
phase: P4
status: DONE
completedAt: 2026-06-02T11:28:37+09:00
mergedAs: 30467c2
prNumber: 145
reviewRounds: 2
commitMode: pr
coversReq: [REQ-099, REQ-100, REQ-101, REQ-102, REQ-103]
estimatedDiff: 240
estimatedFiles: 4
created: 2026-06-02
plannerNote: "P4 milestone-1 chain 1/N — generic HTTP gateway 의 azure_openai 요청/응답 shaping 순수 함수 slice. R-112 backbone ×1.5, dep0/credential0(§5 미발화). T-0154 는 보류 queued 보존."
---

# T-0155 — AzureOpenaiAdapter — azure_openai 요청/응답 shaping 순수 함수 (generic HTTP gateway 1차 slice)

## Why

P4 milestone-1 (LLM provider HTTP gateway) 가 사용자 승인됐다 (journal 2026-06-02 10:35 박제). 확정 설계는 **generic HTTP** 방식 — Node 내장 `fetch` + 저장된 `endpointUrl`/`apiKey`/`modelId` 로 provider-agnostic 호출, **새 외부 dependency 0**. 1차 대상 provider 는 **azure_openai** (deployment id + api-version 포맷). 본 task 는 그 gateway chain 의 **가장 작은 첫 slice** — azure_openai 의 요청 조립(URL·헤더·body)과 응답 파싱(chat completions → `LlmGenerateResult`)을 **순수 함수**로 박제한다. 네트워크 호출(`fetch`)·apiKey decrypt 는 본 slice 가 아니라 후속 orchestration slice 책임 (Follow-ups). 순수 함수로 잘라 cap 안에서 완결 + 100% unit 검증 가능하게 한다. PLAN.md L85 (LLM provider 추상화, R-99~103) + 기존 `src/llm/llm-gateway.interface.ts` (T-0135 scaffold) 의 `LlmGenerateResult`/`LlmGenerateOptions`/`LlmProvider.AzureOpenai` contract 위에 build.

## Required Reading

- `D:\Assessment-Agent\src\llm\llm-gateway.interface.ts` — `LlmProvider` enum / `LlmGenerateOptions` / `LlmGenerateResult` / `isLlmProvider`. 본 adapter 의 입출력 타입 source.
- `D:\Assessment-Agent\src\llm\llm-provider-config.service.ts` — `LlmProviderConfigView` (apiKey 제외 view) + 기존 service 패턴 참고. 단, 본 adapter 는 평문 apiKey 를 인자로 받아 헤더에 싣는 순수 함수 (decrypt 는 후속 orchestration 책임 — 본 slice 는 인자로 받음).
- `D:\Assessment-Agent\src\llm\dto\create-llm-provider-config.dto.ts` — `endpointUrl`/`provider`/`apiKey`/`modelId` 필드 형태 참고 (config row shape).
- `D:\Assessment-Agent\src\llm\dto\create-llm-provider-config.dto.spec.ts` — colocated spec 작성 스타일 참고 (describe/it 한국어 관행).

## Acceptance Criteria

신규 파일: `src/llm/providers/azure-openai.adapter.ts` (순수 함수 모듈, NestJS provider 아님 — DI 불요) + colocated spec `src/llm/providers/azure-openai.adapter.spec.ts`.

- [ ] `buildAzureOpenaiRequest(input)` 순수 함수 — `endpointUrl`(base) + `modelId`(deployment id) + `apiVersion` + `apiKey`(평문) + `prompt` + `options`(`LlmGenerateOptions`) 를 받아 `{ url, headers, body }` 를 반환. URL 은 azure_openai 포맷 (`<endpointUrl>/openai/deployments/<modelId>/chat/completions?api-version=<apiVersion>`), 헤더는 `api-key: <apiKey>` + `Content-Type: application/json`, body 는 chat completions messages 배열 (`{ role: "user", content: prompt }`).
- [ ] `parseAzureOpenaiResponse(json)` 순수 함수 — Azure chat completions 응답 JSON 을 받아 `LlmGenerateResult` (`narrative`/`provider: LlmProvider.AzureOpenai`/`modelId`) 로 변환. `choices[0].message.content` 를 `narrative` 로 추출.
- [ ] **Happy-path unit test 1+** — 정상 config+prompt 로 `buildAzureOpenaiRequest` 가 올바른 url/headers/body 를 만들고, 정상 응답 JSON 으로 `parseAzureOpenaiResponse` 가 올바른 `LlmGenerateResult` 를 반환.
- [ ] **Error path unit test 1+** — `parseAzureOpenaiResponse` 가 `choices` 누락 / 빈 배열 / `message.content` 누락 등 비정상 응답에서 명확한 error throw (의미 불명한 `undefined` 반환 금지). `buildAzureOpenaiRequest` 가 빈 `endpointUrl`/빈 `modelId`/빈 `apiVersion` 등 invalid 입력에서 error throw.
- [ ] **Flow / branch coverage** — `buildAzureOpenaiRequest` 의 `options.difficulty` 명시 분기 vs 부재 분기, URL 끝 slash trailing 정규화 분기(있으면) 등 각 분기 1+ test.
- [ ] **Negative cases 충분 cover** — 예외 상황 각 1+ test: 빈 prompt / 빈 apiKey / endpointUrl 에 trailing slash 유무 / `choices` 가 null / `choices[0].message` 가 null / `content` 가 빈 문자열 / 응답이 object 아님(null·배열). 단일 negative 만으로 부족 — 예외 분기마다 cover.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test` 통과 (신규 spec 포함 전체 green).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%; 신규 파일 100% 목표 — 순수 함수라 달성 용이).
- [ ] 새 외부 dependency 0 (`pnpm add` 0 — Node 내장만, package.json/lockfile 변경 0). 외부 credential 0 (apiKey 는 함수 인자로만 받음 — env/secret 주입 0, 실 LLM API 호출 0).

## Out of Scope

- **`fetch` 네트워크 호출** — 실제 HTTP 호출 orchestration (`LlmHttpGateway implements LlmGateway` 가 `fetch` 로 url 호출 + 응답 받기)은 본 slice 아님 → Follow-up #1. 본 slice 는 순수 요청 조립 + 응답 파싱 함수만 (네트워크 0, mock 도 불요).
- **apiKey decrypt 연동** — `LlmApiKeyCipher.decrypt` 로 ciphertext → 평문 변환 후 헤더에 싣는 wiring 은 후속 orchestration slice (Follow-up #1). 본 adapter 는 평문 apiKey 를 인자로 받는다 (decrypt 호출 0).
- **다른 provider (anthropic / google_gemini / openai / custom) adapter** — 각 별도 task (Follow-up #2). 본 slice 는 azure_openai 1종만.
- **DifficultyMapping ↔ modelId routing** — 난이도별 provider/model 선택 로직은 후속 (Follow-up #3). 본 slice 는 `options.modelId`/`difficulty` 를 그대로 받아 shaping 만.
- **LlmModule provider 등록** — 본 adapter 는 순수 함수 모듈(DI 불요)이라 module 등록 0. orchestration gateway class 가 생길 때(Follow-up #1) module 등록.
- **api.md / modules.md doc-sync** — gateway slice 들이 모인 뒤 별도 direct doc task.
- **package.json 변경** — 새 dependency 0 원칙 (§5/§9 미발화 유지).

## Suggested Sub-agents

`implementer → tester`. (architect 불요 — 기존 `LlmGateway` interface T-0135 scaffold + generic HTTP 설계 결정[journal 10:35]이 contract 를 박제 완료. 본 slice 는 azure_openai 포맷 shaping 의 순수 함수 구현만이라 새 모듈 경계/공개 API 형태 결정 불요.)

## Follow-ups

(생성 시 비어 있음. 향후 chain 후보 — sub-agent 가 발견 시 append:)

- (chain #1) `LlmHttpGateway implements LlmGateway` — `fetch` 로 `buildAzureOpenaiRequest` 결과 URL 호출 + `parseAzureOpenaiResponse` 로 결과 파싱 + `LlmApiKeyCipher.decrypt` 로 apiKey 평문화 + provider routing(azure_openai dispatch). fetch 는 unit test 에서 mock (실 네트워크 0). credential(LLM API key) env 주입은 통합 단계에서만 — §5 재평가.
- (chain #2) anthropic / google_gemini / openai / custom adapter 각 slice.
- (chain #3) DifficultyMapping ↔ modelId routing (난이도별 model 선택).
- (chain #4) api.md / modules.md gateway doc-sync (direct).
