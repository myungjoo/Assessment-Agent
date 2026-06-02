---
id: T-0156
title: LlmHttpGateway — azure_openai orchestration (config lookup → decrypt → fetch → parse, fetch 주입)
phase: P4
status: DONE
completedAt: 2026-06-02T11:45:39+09:00
mergedAs: efa81c7
prNumber: 146
reviewRounds: 1
commitMode: pr
coversReq: [REQ-099, REQ-100, REQ-101, REQ-102, REQ-103]
estimatedDiff: 240
estimatedFiles: 4
created: 2026-06-02
plannerNote: "P4 milestone-1 chain 2/N — azure_openai orchestration gateway(config→decrypt→fetch→parse). R-112 backbone ×1.5. fetch 주입(unit mock)/cipher DI mock → 새 dep0/credential0(§5 미발화). routing/타 provider 는 Follow-up."
---

# T-0156 — LlmHttpGateway — azure_openai orchestration (config lookup → decrypt → fetch → parse)

## Why

P4 milestone-1 (LLM provider HTTP gateway) chain 의 2차 slice다. 1차 slice T-0155 (merged 30467c2) 가 azure_openai 의 요청 조립(`buildAzureOpenaiRequest`)과 응답 파싱(`parseAzureOpenaiResponse`)을 **순수 함수**로 박제했다. 본 slice 는 그 순수 함수들을 **묶는 orchestration layer** — `LlmGateway` interface (T-0135 scaffold) 를 구현하는 NestJS service `LlmHttpGateway` 를 azure_openai 1종에 대해 박제한다. 흐름: 저장된 `LlmProviderConfig` 조회 → `LlmApiKeyCipher.decrypt` 로 apiKey 평문화 → `buildAzureOpenaiRequest` 로 요청 조립 → **주입된 fetch** 로 HTTP 호출 → `parseAzureOpenaiResponse` 로 결과 변환. 이로써 milestone-1 의 end-to-end 호출 경로가 unit 수준에서 완성된다 (실 네트워크·실 credential 0 — fetch 는 주입해 mock, cipher 는 DI mock). PLAN.md L85 (LLM provider 추상화, R-99~103) + T-0155 Follow-up #1 박제.

## Required Reading

- `D:\Assessment-Agent\src\llm\llm-gateway.interface.ts` — `LlmGateway` interface (`generate(prompt, options)`), `LlmGenerateOptions`, `LlmGenerateResult`, `LlmProvider` enum. 본 gateway 가 구현할 계약 + 입출력 타입.
- `D:\Assessment-Agent\src\llm\providers\azure-openai.adapter.ts` — `buildAzureOpenaiRequest` / `parseAzureOpenaiResponse` / `AzureOpenaiRequestInput`. 본 gateway 가 호출할 순수 함수 2종 (특히 `apiVersion` 이 별도 입력임에 유의 — 본 slice 에서 어떻게 공급할지 결정 필요, 아래 Acceptance 참조).
- `D:\Assessment-Agent\src\llm\llm-apikey-cipher.service.ts` — `LlmApiKeyCipher.decrypt(envelope)`. 본 gateway 가 ciphertext apiKey 를 평문화할 때 호출 (DI 주입, unit 에서 mock).
- `D:\Assessment-Agent\src\llm\llm-provider-config.repository.ts` — `findById(id)` (null-safe). 본 gateway 가 config row(apiKey ciphertext 포함 raw row) 를 조회할 source. **service 의 sanitize view 가 아니라 repository 의 raw row 를 직접 조회** (apiKey ciphertext 가 필요하므로 — service.findById 는 apiKey 를 redact 하므로 부적합).
- `D:\Assessment-Agent\src\llm\llm.module.ts` — 본 gateway 를 provider 로 등록할 위치 (providers 배열). cipher / repository 는 이미 등록·export 됨.
- `D:\Assessment-Agent\src\llm\providers\azure-openai.adapter.spec.ts` — colocated spec 작성 스타일 (describe/it 한국어 관행) 참고.

## Acceptance Criteria

신규 파일: `src/llm/llm-http-gateway.service.ts` (`@Injectable` NestJS service, `LlmGateway` 구현) + colocated spec `src/llm/llm-http-gateway.service.spec.ts`. 변경 파일: `src/llm/llm.module.ts` (providers 등록).

- [ ] `LlmHttpGateway implements LlmGateway` — `generate(prompt, options)` 1 메서드. 흐름: (1) `options` 의 config 식별자(아래 결정)로 `LlmProviderConfigRepository.findById` 호출 → row 부재 시 명확한 error throw, (2) row.provider 가 `azure_openai` 인지 확인 → 그 외 provider 면 "미지원 — 본 slice 는 azure_openai 만" 명확한 error throw(routing 은 Follow-up), (3) `LlmApiKeyCipher.decrypt(row.apiKey)` 로 평문 apiKey 획득, (4) `buildAzureOpenaiRequest` 로 요청 조립, (5) **주입된 fetch** 로 url 호출(POST, headers, body), (6) HTTP non-2xx 응답이면 명확한 error throw(status 포함), (7) response body JSON 파싱 후 `parseAzureOpenaiResponse` 로 `LlmGenerateResult` 반환.
- [ ] **fetch 주입 설계** — `fetch` 를 직접 호출하지 말고 constructor 또는 메서드 인자로 주입 가능한 함수 타입(예: `FetchLike = (url, init) => Promise<...>`)으로 받아 unit 에서 mock 가능하게 한다. default 는 Node 내장 `globalThis.fetch`. **실 네트워크 호출 0**.
- [ ] **apiVersion 공급 결정** — `buildAzureOpenaiRequest` 는 `apiVersion` 을 별도 입력으로 요구하나 `LlmProviderConfig` 4 필드(provider/endpointUrl/apiKey/modelId)에는 없다. 본 slice 는 **상수 default api-version**(예: 모듈 상수 `AZURE_OPENAI_DEFAULT_API_VERSION`)으로 공급하고, 영속 컬럼 추가는 Out of Scope(Follow-up)임을 코드 주석에 명시. (config 컬럼 추가는 schema migration → §5 게이트이므로 본 slice 회피.)
- [ ] **Happy-path unit test 1+** — azure_openai config row + 정상 fetch mock(2xx + 정상 chat completions JSON)으로 `generate` 가 올바른 `LlmGenerateResult`(narrative/provider/modelId) 반환. fetch 가 올바른 url/headers/body 로 1회 호출됐는지 검증.
- [ ] **Error path unit test 1+** — 각 실패 경로 throw 검증: config 부재(repository.findById → null), decrypt throw(cipher mock reject/throw), fetch reject(네트워크 오류 시뮬레이션), HTTP non-2xx(예: 401/500), 비정상 응답 JSON(parseAzureOpenaiResponse 가 throw 하는 형태).
- [ ] **Flow / branch coverage** — 각 분기 1+ test: provider == azure_openai vs 그 외(미지원 throw), HTTP 2xx vs non-2xx, fetch 성공 vs reject. (분기마다 test 분리.)
- [ ] **Negative cases 충분 cover** — 예외 상황 각 1+ test: 존재하지 않는 config id / azure_openai 아닌 provider(예: anthropic row → 미지원 throw) / decrypt 실패(잘못된 키·변조) / fetch 가 reject / HTTP 401·500 / response.json() 이 비정상(choices 누락 등). 단일 negative 만으로 부족 — 예외 분기마다 cover.
- [ ] LlmModule providers 에 `LlmHttpGateway` 등록(필요 시 export). cipher / repository 는 이미 등록됨 — 신규 inject 만.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test` 통과 (신규 spec 포함 전체 green).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%; 신규 파일 100% 목표).
- [ ] 새 외부 dependency 0 (`pnpm add` 0 — Node 내장 fetch + 기존 @nestjs/common 만, package.json/lockfile 변경 0). 외부 credential 0 (실 LLM API key·실 네트워크 호출 0 — fetch 주입 mock / cipher DI mock. `LLM_APIKEY_ENC_KEY` 실 주입 0 — cipher 는 mock 이라 실 decrypt 미발생).

## Out of Scope

- **multi-provider routing** — anthropic / google_gemini / openai / custom dispatch 는 본 slice 아님 → Follow-up #1. 본 slice 는 azure_openai 1종만 처리하고 그 외 provider 는 명확한 "미지원" error throw.
- **apiVersion / 기타 azure 파라미터의 영속 컬럼화** — `LlmProviderConfig` 에 apiVersion 컬럼 추가는 schema migration(§5 게이트) → Follow-up #2. 본 slice 는 상수 default api-version 사용.
- **실제 네트워크 호출 / 실 credential 주입** — fetch 는 주입해 unit 에서 mock, cipher 는 DI mock. 실 LLM API 호출·실 `LLM_APIKEY_ENC_KEY` 주입은 통합/배포 단계 책임(그 시점 §5 재평가) → Follow-up #3.
- **DifficultyMapping ↔ provider/model routing** — 난이도별 provider/config 선택 로직(어떤 config id 를 쓸지 결정)은 Follow-up #4. 본 slice 는 호출자가 넘긴 식별자로 config 를 직접 조회.
- **assessment 평가 파이프라인 wiring (P5)** — 본 gateway 를 실제 평가 흐름에 연결하는 것은 P5 책임.
- **api.md / modules.md doc-sync** — gateway slice 들이 모인 뒤 별도 direct doc task.
- **package.json 변경** — 새 dependency 0 원칙(§5/§9 미발화 유지).

## Suggested Sub-agents

`implementer → tester`. (architect 불요 — `LlmGateway` interface(T-0135) + azure adapter 순수 함수(T-0155) + generic HTTP 설계 결정[journal 10:35]이 contract 를 박제 완료. 본 slice 는 기존 부품을 묶는 orchestration service 구현 + module 등록이라 새 모듈 경계/공개 API 형태 결정 불요. 단 config 식별자 입력 방식·apiVersion 상수 default 는 구현 결정으로 spec 에 박제.)

## Follow-ups

(생성 시 비어 있음. 향후 chain 후보 — sub-agent 가 발견 시 append:)

- (chain #1) multi-provider routing — anthropic / google_gemini / openai / custom adapter 각 slice + provider dispatch.
- (chain #2) apiVersion(및 기타 azure 파라미터) 영속 컬럼화 — schema migration(§5 게이트).
- (chain #3) 실 네트워크/실 credential 통합 — `LLM_APIKEY_ENC_KEY` env 주입 + 실 LLM 호출 smoke/e2e(§5 재평가).
- (chain #4) DifficultyMapping ↔ provider/config routing (난이도별 config 선택).
- (chain #5) api.md / modules.md gateway doc-sync (direct).
