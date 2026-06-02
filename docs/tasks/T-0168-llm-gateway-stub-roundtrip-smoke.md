---
id: T-0168
title: LlmHttpGateway 의 실 globalThis.fetch round-trip 을 로컬 stub 서버로 closeout 하는 smoke test 추가
phase: P4
status: DONE
commitMode: pr
prNumber: 155
mergedAs: 7c6aba5
reviewRounds: 1
completedAt: 2026-06-02T17:08:00+09:00
coversReq: [REQ-099, REQ-100, REQ-101, REQ-102, REQ-103]
estimatedDiff: 190
estimatedFiles: 1
created: 2026-06-02
plannerNote: P4 milestone-1 — Q-0016 decision (B). 실 credential 0 / dep 0 로 LlmHttpGateway 의 실 fetch transport 잔여 risk 를 stub round-trip smoke 로 닫음.
---

# T-0168 — LlmHttpGateway 의 실 globalThis.fetch round-trip 을 로컬 stub 서버로 closeout 하는 smoke test 추가

## Why

Q-0016 decision (B): mocked-fetch unit test 는 `fetch` 를 jest mock 으로 **대체**하므로 실제 transport 배선(헤더 직렬화 · URL 조립 · non-2xx 실수신 · JSON 파싱)을 통과시키지 못한다. 본 task 는 Node 내장 `http.createServer` 로 OpenAI-호환 `/chat/completions` stub 서버를 localhost ephemeral 포트(0)에 띄우고, `LlmHttpGateway.generate()` 가 **실 `globalThis.fetch`** 로 그 stub 에 end-to-end 도달하는 경로를 검증해 milestone-1 의 transport 잔여 risk 를 닫는다. 새 외부 dependency 0 / 실 credential 0 / 실 LLM endpoint 0 — CLAUDE.md §5 게이트 미발화. README 110~114 / R-113 의 smoke 부분(`pnpm test:smoke`, CI step "스모크 테스트")에 합류한다.

## Required Reading

- `src/llm/llm-http-gateway.service.ts` — `LlmHttpGateway.generate()` 흐름, `FetchLike` 타입(생성자 4번째 인자 `@Optional fetchFn`, default `globalThis.fetch`). 본 test 는 fetchFn 을 **주입하지 않거나** `globalThis.fetch` 를 명시 주입해 실 fetch 경로를 강제한다.
- `src/llm/providers/openai-compatible.adapter.ts` — custom provider 의 `{url, headers, body}` 조립(`<endpointUrl>/chat/completions`, `Authorization: Bearer`, body `{model, messages}`) + 응답 파싱(`choices[0].message.content`). stub 서버가 echo/고정응답으로 돌려줄 JSON 형태의 근거.
- `src/llm/llm-http-gateway.service.spec.ts` — 기존 **mocked-fetch** unit test(중복 금지 — 본 task 는 실 fetch round-trip 만 신규). `makeGateway` harness 의 repository/cipher/difficultyMappingService mock 패턴 참고(stub round-trip 도 이 3 의존은 mock — DB·credential 불요).
- `test/smoke/app.smoke-spec.ts` — `*.smoke-spec.ts` 컨벤션(`beforeAll`/`afterAll` 생명주기, suffix 가 `pnpm test:smoke` 에 자동 픽업되는 구조).
- `test/jest-smoke.json` — smoke jest config(`testRegex: .*\.smoke-spec\.ts$`, `globalSetup` 은 DATABASE_URL 만 요구하며 본 LLM stub spec 은 DB 미사용 — globalSetup 의 1 회 truncate 는 무해). `.github/workflows/ci.yml` L115~118 의 "스모크 테스트" step 이 본 spec 을 CI 에서 자동 실행 — **CI 파일 수정 불요**.

## Acceptance Criteria

- [ ] `test/smoke/llm-gateway-roundtrip.smoke-spec.ts` 1 개 신규 작성. Node 내장 `http.createServer` 로 OpenAI-호환 `POST /chat/completions` stub 서버를 세움(고정/echo completion JSON 반환, 그리고 negative 경로용으로 non-2xx 도 반환 가능). 포트 충돌 회피를 위해 **ephemeral 포트(`listen(0)`)** 로 listen 하고 실제 할당 포트를 `server.address()` 로 읽어 base URL 을 구성한다.
- [ ] stub 서버 생명주기: `beforeAll` 에서 listen(준비 완료까지 await), `afterAll` 에서 `server.close()` 로 정리(누수 0). 포트는 하드코딩 금지.
- [ ] **Happy round-trip (실 fetch)**: `LlmHttpGateway` 를 repository(custom provider config, `endpointUrl = http://127.0.0.1:<ephemeral>`)·cipher(decrypt → 평문 key)·difficultyMappingService mock + **실 `globalThis.fetch`**(주입 또는 default)로 조립하고 `generate()` 를 호출. 검증: (1) stub 이 수신한 request 의 URL(`/chat/completions`)·headers(`Authorization: Bearer ...`, `Content-Type: application/json`)·body(`{model, messages:[{role:"user",...}]}`) 가 직렬화되어 실제로 도달했고, (2) 반환된 `LlmGenerateResult.narrative` 가 stub 의 completion content 와 일치, `provider === custom`, `modelId` 일치.
- [ ] **Negative round-trip (실 fetch, non-2xx)**: stub 이 non-2xx(예: 500)를 반환하도록 라우팅한 뒤 `generate()` 호출 → gateway 가 status 를 포함한 Error 를 throw 하는지 검증(실 `response.ok === false` 경로 — mock 이 아닌 실 fetch 가 non-2xx 를 실수신). `await expect(...).rejects.toThrow(String(status))`.
- [ ] 실 네트워크/실 credential/실 LLM endpoint 0 — 모든 통신은 localhost stub 으로만. test key 는 fixture 평문(`"plaintext-key"` 류), 실 API key·실 endpoint 금지.
- [ ] `pnpm test:smoke` 가 본 spec 을 픽업해 통과한다(로컬 기준 — CI 는 동일 step 에서 자동 실행). DATABASE_URL 은 smoke globalSetup 요구라 로컬 실행 시 기존 smoke 와 동일하게 주입.
- [ ] `pnpm lint` / `pnpm build` 통과(신규 spec 의 TS 타입·eslint 무경고).
- [ ] 본 spec 은 smoke suite 라 unit coverage(`pnpm test:cov`) 통계 scope 밖(`collectCoverageFrom: src/**/*`) — 단 신규 코드는 spec 뿐이라 production LOC 0, coverage 임계 영향 없음. (production symbol 추가 시에만 R-112 happy/error/branch/negative + `pnpm test:cov` line/function ≥ 80% 적용. 본 task 는 test-only 라 src 변경 0 가 기본 — 변경 발생 시 그 symbol 에 R-112 적용.)

## Out of Scope

- 실 LLM endpoint / 실 provider 자격증명 / `LLM_APIKEY_ENC_KEY` 실값 주입(= Q-0016 option A, 여전히 deferred — §5 게이트).
- custom 외 4 provider(azure_openai / openai / anthropic / google_gemini)의 live·stub round-trip. 본 task 는 **custom(OpenAI-호환)** happy + 1 non-2xx negative 만. 나머지는 follow-up(공통 transport 가 동일해 risk 낮음 — trivially free 가 아니면 확장 금지).
- 새 외부 dependency(nock / msw / supertest-against-real-server 등) 추가. Node 내장 `http` 만 사용.
- `src/llm/` production 코드 변경(transport 배선은 이미 main 에 완결 — T-0157/T-0158 등). 본 task 는 test-only 가 원칙. 불가피한 export 노출 등 최소 변경 발생 시 task Follow-ups 에 기록하고 cap 안에서 처리.
- e2e suite(`test/e2e/*.e2e-spec.ts`)로의 추가 배치 — smoke 1 곳으로 충분(중복 금지). e2e 확장 필요성 발견 시 follow-up.
- jest 설정/CI workflow 변경(기존 smoke step 이 suffix 로 자동 픽업하므로 불요).

## Suggested Sub-agents

`implementer → tester` (architect 불요 — Node 내장 http + 기존 smoke 컨벤션을 쓰는 test 인프라라 ADR-worthy 아님. cross-cutting 결정 0).

## Follow-ups

(작성 시 비어있음 — sub-agent 가 관련 작업 발견 시 추가)
