---
id: T-0165
title: LlmHttpGateway 에 difficulty 기반 config routing 연결 (DifficultyMappingService.resolveModel 소비)
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-097]
estimatedDiff: 85
estimatedFiles: 2
created: 2026-06-02
plannerNote: P4 milestone-1 dependency-free 잔여 — REQ-097 난이도별 모델 라우팅. gateway 가 options.difficulty 를 무시하고 modelId 만 소비 → resolveModel 연결. 새 dep 0 / credential 0 / §5 미발화.
---

# T-0165 — LlmHttpGateway 에 difficulty 기반 config routing 연결

## Why

[PLAN.md](../PLAN.md) Phase P4 L86 "**3가지 난이도 모델 할당** (R-97) — 평가 항목별 난이도 분류 + 어떤 항목이 어떤 난이도 모델로 처리될지" 를 cover 한다. 현재 main 에 `DifficultyMappingService.resolveModel(difficulty)` (난이도 → `ResolvedModel{configId, provider, modelId}` 해석) 와 `LlmHttpGateway.generate(prompt, options)` 가 모두 머지돼 있으나 **둘이 연결돼 있지 않다**. gateway 는 `options.modelId` 를 곧바로 `repository.findById(modelId)` 로 config 조회에 쓰고 `options.difficulty` 필드는 완전히 무시한다 ([llm-gateway.interface.ts](../../src/llm/llm-gateway.interface.ts) 의 `LlmGenerateOptions.difficulty` 는 placeholder 주석). 그 결과 "난이도별 모델 라우팅" (ADR-0011 §3) 이 런타임에서 동작하지 않는다. 본 task 는 gateway 가 `options.difficulty` 가 주어지면 `resolveModel` 로 config 를 선택하도록 in-process routing 분기를 연결한다.

이 작업은 **dependency-free** — 두 symbol 모두 main 박제, 새 외부 dependency 0 / 외부 credential 0 / schema 변경 0 / §5 미발화. 실 LLM HTTP 호출은 기존 주입 `FetchLike` 로 mock 되므로 unit 만으로 신규 분기를 전부 cover 한다 (T-0162 spec 패턴 mirror).

## Required Reading

- `src/llm/llm-http-gateway.service.ts` — 본 task 가 수정할 gateway. 특히 `generate()` 의 (1) config 조회 단계 (`this.repository.findById(options.modelId)`) 와 생성자 주입 목록.
- `src/llm/llm-http-gateway.service.spec.ts` (colocated spec — 본 task 가 신규 분기 test 를 추가할 위치) — 기존 fetch/repository/cipher mock 패턴 + provider dispatch test 구조 참조.
- `src/llm/difficulty-mapping.service.ts` (L58 `ResolvedModel` interface, L68 `DifficultyMappingService`, L93 `async resolveModel(difficulty)`) — 주입할 서비스 + 반환 shape. `resolveModel` 은 허용 밖 난이도 / 매핑 부재 시 throw 하는 점 확인.
- `src/llm/llm-gateway.interface.ts` (`LlmGenerateOptions` — `modelId` 필수 + `difficulty?` 선택) — 옵션 contract. 본 task 는 interface 변경 없이 기존 `difficulty?` 필드 의미를 활성화만 한다.

## Acceptance Criteria

- [ ] `LlmHttpGateway` 생성자에 `DifficultyMappingService` 를 DI 주입 (기존 `LlmProviderConfigRepository` / `LlmApiKeyCipher` 주입 패턴과 동일하게).
- [ ] `generate()` 의 config 조회 단계를 분기: `options.difficulty` 가 주어지면 `difficultyMappingService.resolveModel(options.difficulty)` 로 `configId` 를 얻어 그 id 로 config 조회, 주어지지 않으면 기존대로 `options.modelId` 를 config id 로 사용. 두 경로 모두 config 부재 시 기존 error 메시지 정합 throw.
- [ ] 난이도 routing 으로 선택된 config 의 provider / modelId 가 이후 dispatch + `LlmGenerateResult` 에 정확히 반영되는지 (기존 dispatch 분기 재사용, 분기 로직 변경 없음).
- [ ] Happy-path unit test 1+: `options.difficulty` 제공 시 `resolveModel` 이 반환한 configId 로 config 가 조회되고 정상 narrative/provider/modelId 가 반환됨 (fetch + repository + cipher + difficultyMappingService 전부 mock).
- [ ] Happy-path unit test 1+: `options.difficulty` 미제공 (기존 modelId 직접 경로) 시 종전 동작이 유지됨 (regression 보호 — difficulty 미사용 호출이 깨지지 않음).
- [ ] Error path unit test 1+: `resolveModel` 이 throw (허용 밖 난이도 / 매핑 부재) 할 때 gateway 가 그 error 를 swallow 하지 않고 전파.
- [ ] Error path unit test 1+: difficulty 경로로 resolve 된 configId 의 config 가 repository 에 없을 때 (`findById` → null) 기존 "config 를 찾을 수 없습니다" error throw.
- [ ] Flow / branch: difficulty 제공 경로 / 미제공 경로 두 분기 각 1+ test (위 happy-path 2 항목이 cover).
- [ ] negative cases 충분 cover — (a) resolveModel throw 전파, (b) resolve 된 config 부재, (c) difficulty 빈 문자열/undefined 처리 (undefined → modelId 경로, 빈 문자열은 resolveModel 의 isDifficulty 검증에 위임), 각 1+ test. 단일 negative 만 작성 금지.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — `coverageThreshold.global` 강제).

## Out of Scope

- 실 LLM endpoint 호출 / 실 API key credential / `LLM_APIKEY_ENC_KEY` env 주입 — milestone-1 실 통합은 §5 HITL 게이트 (별도 사용자 승인 필요). 본 task 는 in-process routing 연결만, 기존 주입 `FetchLike` mock 으로 검증.
- `LlmGenerateOptions` interface 의 필드 추가/변경 (기존 `difficulty?` 필드 의미 활성화만, contract 불변).
- DifficultyMapping CRUD / `assignProviderConfig` / repository 로직 수정 (이미 main 박제 — 본 task 는 `resolveModel` 소비만).
- provider 별 dispatch / adapter 순수 함수 / apiVersion 영속 컬럼 등 다른 follow-up (T-0156/0162 Follow-ups §5 게이트 또는 별도).
- schema / migration 변경 (§5 게이트).
- `LlmModule` provider 등록 외 다른 module wiring 변경 (필요 최소한의 DI 등록만).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시 비어 있음. sub-agent 가 발견 시 append:)

- (chain — §5 게이트) milestone-1 실 LLM 통합 — `LLM_APIKEY_ENC_KEY` env 주입 + 실 endpoint 호출을 평가 파이프라인(AssessmentModule)에 연결 + smoke/e2e. 사용자 승인 필수 (새 credential · 실 HTTP).
- (chain — §5 게이트) provider 별 파라미터 (maxOutputTokens / apiVersion / anthropic-version / max_tokens) 영속 컬럼화 — schema migration.
