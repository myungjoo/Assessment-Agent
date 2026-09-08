---
id: T-1972
title: LLM provider config 생성(POST) e2e 계약 고정 — 암호화 저장 · never-read-back · RBAC
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-049, REQ-051, REQ-043]
estimatedDiff: 285
estimatedFiles: 1
created: 2026-09-08
independentStream: llm-provider-config-e2e
dependsOn: [T-1967, T-1970]
touchesFiles:
  - test/e2e/llm-provider-configs.e2e-spec.ts
plannerNote: 읽기 2 축(T-1967·T-1970)은 닫혔고 쓰기 축 e2e 는 0 — POST 를 spec-local 임시 enc key 로 열어 암호화 저장 왕복까지 고정.
---

# T-1972 — LLM provider config 생성(POST) e2e 계약 고정

## Why

`LlmProviderConfigController` 의 읽기 축은 T-1967(목록, PR #1543 → main `b2a6ce5d`) · T-1970(`:id` 단건 · 삭제, PR #1545 → main `5e05de31`) 로 닫혔지만 **쓰기 축 e2e 는 여전히 0** 이다. 실측 pre-check(origin/main `fb4a19a3`): `grep -rn "\.post(" test/e2e/llm-provider-configs.e2e-spec.ts` = **0 hit**, `grep -rln "api/llm/providers" test/` = 7 파일 중 `test/e2e/` 는 위 1 파일뿐이고 나머지는 `test/perf` 3 · `test/load` 1 · `test/smoke` 1 · `test/perf/README.md` 라 **POST 를 실 HTTP 로 왕복하는 축이 어디에도 없다**. 그 결과 `service.create` 가 `cipher.encrypt` 를 거쳐 **암호문**을 영속한다는 ADR-0014 §1 invariant 가 unit mock 축에만 존재하고, 배선이 평문 저장으로 회귀해도 red 가 되는 지점이 없다.

선행 slice 들이 "`LLM_APIKEY_ENC_KEY` 주입 방식 결정 선행" 을 이유로 미룬 축인데, 실측 결과 그 결정은 작다 — `src/llm/llm-apikey-cipher.service.ts` `48 행` `resolveKey()` 가 **호출 시점마다** `process.env` 를 읽으므로(부트스트랩 시점 캡처 아님), spec 이 `beforeAll` 에서 `randomBytes(32).toString("base64")` 로 만든 **일회용 키를 `process.env` 에 넣고 `afterAll` 에서 원값 복원**하면 CI env · 워크플로 · `.env` 파일을 전혀 건드리지 않고 쓰기 경로를 열 수 있다. 같은 패턴이 이미 `src/confluence/confluence-token-decrypt.spec.ts` `33~46 행` 의 `withEnvKey` 로 박제돼 있다. 새 외부 dependency 0 · 새 credential 0 · 리포지토리에 남는 secret 0 이라 CLAUDE.md §5 게이트에 걸리지 않는다.

PLAN `183 행` once-rule 대로 REQ-049 · REQ-051 상태 칸 재판정은 T-1971 이 이미 1 회 수행했으므로 본 slice 는 재판정을 열지 않는다(쓰기 축 좌표 추가가 필요하면 PATCH/PUT 축까지 머지된 뒤 1 회).

## Required Reading

- `test/e2e/llm-provider-configs.e2e-spec.ts` — `1~32 행`(헤더 주석: 실 DB 전략 · 정리 순서 · apiKey 원문 미노출 규약), `44~58 행`(`PROVIDERS_URL` · `VIEW_FIELDS` 7 key · `SECRET_*` 상수), `60 행` 목록 describe, `256 행` `:id` describe(**둘 다 무수정** — 본 task 는 파일 하단에 세 번째 top-level describe 를 append).
- `src/llm/llm-provider-config.controller.ts` — `78~92 행`(controller-scope `@UsePipes(new ValidationPipe({ whitelist, forbidNonWhitelisted, transform }))`), `159~166 행`(`@Post()` + `@Roles("Admin")`, `@HttpCode` 없음 → NestJS 기본 **201**).
- `src/llm/llm-provider-config.service.ts` — `164~205 행` `create()`(① `isLlmProvider` 미충족 → 400 ② `cipher.encrypt` ③ ciphertext 로 `repository.create` ④ sanitize view 반환).
- `src/llm/dto/create-llm-provider-config.dto.ts` — `36~62 행`(4 필드 `@IsString` + `@IsNotEmpty`: `provider` · `endpointUrl` · `apiKey` · `modelId`).
- `src/llm/llm-apikey-cipher.service.ts` — `43~74 행` `resolveKey()`(env 부재/길이 미달 시 throw, 평문 fallback 금지), `76 행` `export class LlmApiKeyCipher`(+ `encrypt` / `decrypt`).
- `src/llm/llm-gateway.interface.ts` — `20~26 행` `LlmProvider` 5 값(`custom` · `azure_openai` · `anthropic` · `google_gemini` · `openai`).
- `src/confluence/confluence-token-decrypt.spec.ts` — `30~46 행` `withEnvKey` env set/복원 패턴(본 spec 이 mirror 할 참조).
- `test/helpers/auth-e2e-helper.ts` — `createAuthenticatedE2EApp` · `buildAuthCookie` 시그니처.
- `docs/decisions/ADR-0014-llm-api-key-encryption-at-rest.md` — §1(AES-256-GCM envelope) · §2(키 주입 · fail-fast) · §3(never-read-back).

## Acceptance Criteria

파일은 `test/e2e/llm-provider-configs.e2e-spec.ts` **1 개만** 수정한다(하단 append + 헤더 주석 1~2 줄 갱신). 기존 두 describe 는 수정 0.

- [ ] **키 주입** — 새 describe 의 `beforeAll` 이 `randomBytes(32).toString("base64")` 로 만든 일회용 키를 `process.env.LLM_APIKEY_ENC_KEY` 에 설정하고, `afterAll` 이 **원래 값(부재였으면 부재)으로 복원**한다. 리터럴 키 하드코딩 0, `.env`/워크플로/CI 설정 파일 변경 0.
- [ ] **happy-path** — Admin 쿠키로 `POST /api/llm/providers`(provider `openai`) → **201** + 본문이 `VIEW_FIELDS` 7 key 를 모두 노출하고 `isDefault === false`.
- [ ] **never-read-back(ADR-0014 §3)** — 201 응답 본문에 `apiKey` 키가 없고, 응답 본문 문자열(`JSON.stringify`)에 요청한 apiKey 원문이 등장하지 않는다(이중 단언).
- [ ] **암호화 저장 왕복(ADR-0014 §1)** — 생성된 row 를 `prisma.llmProviderConfig.findUnique` 로 읽어 `row.apiKey !== <평문>` 이고, `app.get(LlmApiKeyCipher).decrypt(row.apiKey) === <평문>` 임을 단언(평문 저장 회귀 시 red).
- [ ] **소비처 연결(happy-path 흐름)** — 생성 직후 같은 Admin 쿠키의 `GET /api/llm/providers` 가 200 + 정확히 1 건을 반환하고 그 본문에도 apiKey 원문이 없다.
- [ ] **error path — 미지원 provider** — `provider: "not_a_provider"` → **400** 이고 `prisma.llmProviderConfig.count()` 가 0(부작용 없음).
- [ ] **분기 — ValidationPipe negative `it.each` 4 종**: (a) `provider` 필드 누락 (b) `apiKey: ""` 빈 문자열 (c) `modelId: 123` wrong type (d) allow-list 밖 키(`{ ...valid, unexpectedField: "x" }`) → 각각 **400** + row 생성 0. test 이름에 케이스 라벨을 쓰고 객체를 통째로 덤프하지 않는다.
- [ ] **error path — 키 부재 fail-fast(ADR-0014 §2)** — `process.env.LLM_APIKEY_ENC_KEY` 를 일시 삭제한 상태의 `POST` 가 **500** 이고 row 생성 0(평문 fallback 저장 0). 케이스 종료 시 키를 즉시 복원한다(`try/finally`).
- [ ] **negative — RBAC `it.each` 3 종**: User 쿠키 → **403** / 쿠키 부재 → **401** / 변조 JWT → **401**. 세 경우 모두 `count()` 0 이고 응답 본문에 apiKey 원문이 없다.
- [ ] **negative — 과차단 없음** — SuperAdmin 쿠키 `POST` 는 RolesGuard escalation 으로 **201**.
- [ ] **정리** — `afterEach` 가 기존 describe 와 동일하게 `truncateAll(prisma)` → `llmDefaultProvider.deleteMany()` → `llmProviderConfig.deleteMany()` 순(자식→부모, `onDelete: Restrict`)으로 정리한다.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. `src/` 무접촉이므로 전역 coverage(line ≥ 80% / function ≥ 80%, `pnpm test:cov`)는 변동 없이 유지된다.
- [ ] e2e 는 CI 의 `pnpm test:e2e`(R-113)에서 green. 로컬 `DATABASE_URL` 부재 시 실행 skip 은 기존 두 describe 와 동일하게 동작.

## Out of Scope

- `PATCH /api/llm/providers/:id` · `PUT /api/llm/providers/default` e2e — 후속 slice(본 task 가 키 주입 패턴을 먼저 박제).
- `src/` · `prisma/` · `web/` · `.github/workflows/` · `package.json` 변경 일절 금지(암호화 배선은 이미 존재 — 본 task 는 계약 고정만).
- `test/perf/*` · `test/load/*` 접촉 금지(PLAN `157 행` · `158 행` 오너 게이트).
- `docs/requirements.md` REQ 상태 칸 재판정 금지(PLAN `183 행` once-rule — T-1971 이 이미 1 회 수행).
- 기존 목록 · `:id` describe 의 케이스 수정 · 재배치 · helper 추출 금지(신설 helper 0 — CLAUDE.md §3 소비처 동반 의무는 본 spec 이 자기 소비처라 충족).
- 실 LLM 호출 · live gateway · `SEED_LLM_*` 계열 env 접촉 금지.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

- (a) planner 예약: `PATCH /:id`(부분 갱신 · apiKey 미지정 시 기존 ciphertext 유지 = never-read-back) e2e.
- (b) planner 예약: `PUT /default`(기본 provider 슬롯 지정 · `:id` 선행 route 순서) e2e.
- (c) planner 예약: 쓰기 3 축이 모두 머지된 뒤 REQ-049 · REQ-051 상태 칸에 쓰기 축 좌표를 **1 회** 추가(왕복 금지, PLAN `183 행`).
