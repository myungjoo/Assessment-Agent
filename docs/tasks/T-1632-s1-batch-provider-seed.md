---
id: T-1632
title: s1-batch.js 에 ADR-0057 D5 LlmProviderConfig 단일-row 멱등 seed 배선
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-047]
estimatedDiff: 230
estimatedFiles: 2
created: 2026-08-21
createdAt: 2026-08-21T00:41:00Z
completedAt: 2026-08-21T01:59:46Z
prNumber: 1310
independentStream: load-harness-k6
dependsOn: [T-1631]
touchesFiles:
  - test/load/s1-batch.js
  - test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts
plannerNote: P5 R-91 chain 13/N — ADR-0057 D5 를 s1-batch.js setup/teardown 에 집행. workflow·script 배선은 후속 slice.
---

# T-1632 — s1-batch.js 에 ADR-0057 D5 LlmProviderConfig 단일-row 멱등 seed 배선

## Why

[docs/PLAN.md](../PLAN.md) `144 행` 오너 지시(R-91 k6 최우선·즉시 착수) chain 13/N 이다.
직전 T-1631 이 `test/load/s1-batch.js` 골격(ADR-0057 `D2`·`D3`·`D4`)을 박제하면서
[ADR-0057](../decisions/ADR-0057-s1-batch-load-io-isolation.md) `D5` 의 provider seed 를
명시적으로 다음 slice 로 남겼고, 스크립트 머리 주석도 "그 row 가 없으면 대상 route 는
resolver fail-fast 로 503" 이라고 스스로 적어 두었다.

`D5` 가 근거를 이미 확정했다 — 타격 route 는 orchestrator 위임 전에
`LlmProviderConfigResolver.resolveDefaultModelId()` 를 await 하고, 그 resolver 는 **0-row 와
2+row 를 모두** throw 로 막아 controller 가 503 으로 매핑한다. 부하 job 의 DB 는 run 마다 비어
있어 seed 없이는 모든 batch 호출이 503 이 되고, `D4` 의 `http_req_duration{route:batch}` 환산
임계와 전역 `http_req_failed` 가 함께 무의미해진다. 본 slice 는 그 전제조건을 **실 등록 경로**
(`POST /api/llm/providers`)로 스크립트 안에서 자기 정리되게 배선한다.

## Required Reading

- [docs/decisions/ADR-0057-s1-batch-load-io-isolation.md](../decisions/ADR-0057-s1-batch-load-io-isolation.md) `### D5` — 채택안(① `setup()` 의 `POST /api/llm/providers`) · **단일-row invariant**(GET 열거 → 전량 DELETE → POST 1 회 → teardown DELETE) · 더미 4 필드 · `route:seed` tag 귀속 · credential 0 근거. `## Alternatives considered` 의 `(D5) ②`·`(D5) ③` 는 **채택 금지 대안**임을 확인.
- [test/load/s1-batch.js](../../test/load/s1-batch.js) — 본 slice 가 수정할 대상. `SEED_PARAMS` / `SEED_DELETE_PARAMS` / `AUTH_PARAMS` 상수, `setup()` 의 stamp 규약, `teardown(data)` 회수 반복문, 머리 주석의 "범위 밖" 문단(본 slice 완료 후 갱신 대상).
- [src/llm/llm-provider-config.controller.ts](../../src/llm/llm-provider-config.controller.ts) `91 행`(`@Get()` 목록, Admin+) · `124 행`(`@Post()` 생성, 201 + apiKey 제거 view) · `164~167 행`(`@Delete(":id")`, `@HttpCode(204)`, Admin+) — seed 왕복이 탈 3 개 endpoint 의 정확한 계약.
- [src/llm/dto/create-llm-provider-config.dto.ts](../../src/llm/dto/create-llm-provider-config.dto.ts) `29~62 행` — 필수 4 필드(`provider` · `endpointUrl` · `apiKey` · `modelId`) 전부 `@IsString` + `@IsNotEmpty`, whitelist + forbidNonWhitelisted(허용 밖 키 400).
- [src/llm/llm-gateway.interface.ts](../../src/llm/llm-gateway.interface.ts) `21~27 행` — `LlmProvider` 허용 집합 5 값(`custom` / `azure_openai` / `anthropic` / `google_gemini` / `openai`). 이 집합 밖 값이면 service 가 400.
- [test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts) `1225~1405 행` — T-1631 이 만든 S1 상수(`S1_ROUTES` · `S1_BATCH_ROUTE` · `S1_THRESHOLD_KEYS`)와 helper(`s1Script` · `s1Body` · `apiRoutesOf` · `routeP95Expression`), 그리고 본 slice 가 **반드시 갱신해야 할** 기존 negative 단언 2 종 — `negative (1)` 의 허용 route 집합 대조, `negative (4)` 의 `/apiKey/` 부재 단언.
- [test/load/s2-read.js](../../test/load/s2-read.js) — seed/teardown 자기 정리 규약과 조건 분기 0 관용구(승계 대상).

## Acceptance Criteria

- [x] `test/load/s1-batch.js` 의 `setup()` 이 person seed **이전에** 인증(signup → login → cookie)을 마치고, 그 cookie 로 ADR-0057 `D5` 의 멱등 3 단 왕복을 수행한다 — (a) `GET /api/llm/providers` 로 기존 row 열거, (b) 열거된 전량을 `DELETE /api/llm/providers/:id` 로 제거, (c) `POST /api/llm/providers` 1 회로 더미 row 1 개 생성. 세 왕복 모두 `route:seed` tag 를 단다.
- [x] 생성 응답의 id 를 `setup()` 반환값(예 `providerId`)에 실어 `teardown(data)` 가 같은 `DELETE` 로 회수한다 — 회수도 `route:seed` tag.
- [x] POST body 는 `provider` · `endpointUrl` · `apiKey` · `modelId` 4 필드만(allow-list 밖 키 0). `provider` 는 `LlmProvider` 허용 집합 안의 값이고, 나머지 3 필드는 `stamp` 파생 더미 — 실 endpoint · 실 key 문자열 0, 고정 리터럴 자격증명 0.
- [x] 조건 분기 로직 0 유지 — 열거 결과 순회는 카운트 기반 반복문만(`if` / 삼항 / `&&` 금지). `__ENV` fallback `||` 는 기존 2 회 그대로.
- [x] 임계 선언 무변경 — `options.thresholds` 는 `http_req_duration{route:batch}` 산식 + `http_req_failed` `rate<0.01` 2 종 그대로(재산정 0, seed 왕복이 `batch` 임계에 섞이지 않음).
- [x] 스크립트 머리 주석의 "범위 밖" 문단에서 `D5` 항목을 제거하고 남은 후속 slice(`load-k6.yml` step · `package.json` script · 133명 full seed)만 남긴다.
- [x] **happy-path**: drift-guard smoke 에 `it` 추가 — seed 3 왕복 route 문자열 존재 · POST body 4 필드 존재 · `providerId` 가 `setup` 반환과 `teardown` 사용 양쪽에 존재 · seed 왕복이 `route:seed` params 를 쓰는지 각각 고정.
- [x] **error path**: 재사용 helper(`s1Body` / `apiRoutesOf` / `routeP95Expression`)의 부재 대상 · non-string 입력 계약이 신규 단언 대상에서도 성립함을 `it` 1+ 로 고정(기존 T-1631 error path 블록 패턴 승계).
- [x] **분기 cover**: 신규 helper 를 추가한다면 "대상 있음 / 없음" 두 분기를 각각 `it` 1+ 로 cover. helper 를 추가하지 않고 기존 helper 만 재사용했다면 그 사실을 spec 주석에 명시한다.
- [x] **negative 충분 cover**: (a) 기존 `negative (1)` 의 허용 route 집합에 `/api/llm/providers` 를 더해 **임의 route 혼입 0** 단언을 유지(단언 삭제·약화 금지), (b) 기존 `negative (4)` 의 `/apiKey/` 부재 단언을 "더미 apiKey 는 `stamp` 파생이며 실 secret 리터럴·`LLM_APIKEY_ENC_KEY` 문자열은 0" 형태로 **대체**(그냥 삭제 금지), (c) `route:batch` 외 tag 에 p95 임계 0 유지, (d) seed 왕복이 `default()` 본문(측정 iteration)에 새지 않음, (e) provider 값이 허용 집합 밖 문자열이 아님 — 각 1+ `it`.
- [x] `pnpm lint && pnpm build && pnpm test` green, `pnpm test:smoke` green(갱신된 S1 describe 포함).
- [x] `pnpm test:cov` 통과 — line ≥ 80% AND function ≥ 80%(`src/` 변경 0 이므로 회귀 없음 확인).
- [x] 신규 dependency 0 · DB schema 변경 0 · 인증/권한 모델 변경 0 · `src/` 변경 0 · `.github/workflows/` 변경 0 · `package.json` 변경 0.

## Out of Scope

- `.github/workflows/load-k6.yml` 의 S1 step 추가 · **smoke → S1 → S2 → S3** 순서 재배치 · `LOAD_TEST_STUB=1` 과 더미 `LLM_APIKEY_ENC_KEY` env 주입 — 다음 slice(파일 cap, T-1122 전례). 본 slice 시점의 스크립트는 여전히 어디에도 배선되지 않아 실행 경로 변화 0 이다.
- `package.json` 의 `test:load:s1` script 추가와 그 parity 대조 — workflow 배선 slice 와 함께.
- 133명 full seed 투입 · baseline 실측 · 계획 `§3` "baseline 후 fix" 임계 갱신 · 표본 2 종(10 vs 40) 선형성 점검.
- `src/` 코드 변경 일체(stub 배선 3 조각은 T-1627~T-1629 로 완결) · resolver 우회 분기 신설(ADR-0057 `(D5) ③` 기각안).
- workflow 의 `psql` 직접 INSERT seed(ADR-0057 `(D5) ②` 기각안).
- `Number(__ENV.K6_S1_PERSONS || 10)` 의 `NaN` 처리 — T-1631 Follow-up 대로 3 스크립트를 한 번에 다루는 별도 task.

## Suggested Sub-agents

`implementer → tester`

## 완료 기록

- **DONE** 2026-08-21T01:59:46Z — PR [#1310](https://github.com/myungjoo/Assessment-Agent/pull/1310) 라운드 1 APPROVE + CI green(4-게이트 충족) → squash merge `9099d99f`. 2 파일 `+164/-27`.
- `setup()` 순서를 **auth → provider seed(GET 열거 · DELETE 전량 · POST 1 회) → person seed** 로 재배치하고 cookie 실은 `route:seed` params 2 종을 추가했다. 더미 4 필드는 `stamp` 파생이며 `provider` 만 `LlmProvider` 허용 집합 값(`custom`) — 실 endpoint · 실 key 리터럴 0.
- 생성 id 를 `providerId` 로 `setup()` 반환에 실어 `teardown(data)` 가 같은 `DELETE` 로 회수한다. 조건 분기 로직 0 · `__ENV` fallback `||` 2 회 · 임계 선언(batch p95 산식 + `http_req_failed` `rate<0.01`) 전부 무변경.
- drift-guard smoke 에 `it` 4 종 추가 + 기존 `negative (1)`(허용 route 집합에 `/api/llm/providers` 추가) · `negative (4)`(`/apiKey/` 부재 → "더미는 `stamp` 파생, 실 secret 리터럴 0" 형태로 대체) 갱신. 대상 describe 89 tests green.
- `src/` 변경 0 이라 실행 경로 회귀 없음. 신규 dependency 0 · schema 0 · workflows 0 · `package.json` 0.

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 추가한다.)
