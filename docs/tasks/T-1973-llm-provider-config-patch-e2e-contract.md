---
id: T-1973
title: LLM provider config 부분 갱신(PATCH /:id) e2e 계약 고정
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-049, REQ-051, REQ-043]
estimatedDiff: 290
estimatedFiles: 1
dependsOn: [T-1972]
touchesFiles: [test/e2e/llm-provider-configs.e2e-spec.ts]
independentStream: llm-provider-config-e2e
created: 2026-09-08
plannerNote: P5 · T-1972 Follow-up 쓰기 축 잔여 — PATCH /:id e2e 0(.patch 매칭 0), apiKey 재암호화·유지 분기 미고정
---

# T-1973 — LLM provider config 부분 갱신(PATCH /:id) e2e 계약 고정

## Why

직전 T-1972(PR #1546 → main squash `40a757c4`)가 쓰기 축의 첫 route 인 `POST /api/llm/providers` 를 e2e 로 닫으면서 `PATCH /:id` 와 `PUT /default` 를 명시적으로 Out of Scope 로 남겼다. 본 task 는 그 잔여 중 **`PATCH /:id` 한 route 만** 잇는다(`PUT /default` 는 아래 Follow-ups — 한 slice 에 둘을 넣으면 §3 cap 초과).

issue-still-relevant pre-check(origin/main `fe25f429` 기준, 명령과 실측치 그대로 박제):

- `git grep -nE "\.patch\(.*(PROVIDERS_URL|api/llm/providers)" origin/main -- test/` → **0 매칭**. PATCH 축의 e2e 는 아직 하나도 없다.
- `git grep -l "api/llm/providers" origin/main -- test/` → 7 파일이나 `test/e2e/` 는 [`test/e2e/llm-provider-configs.e2e-spec.ts`](../../test/e2e/llm-provider-configs.e2e-spec.ts) **1 개뿐**(나머지는 perf 3 · load 1 · smoke 1 · README 1). 그 파일은 `785 행`, top-level describe 3 개(`65 행` 목록 · `261 행` `:id` 조회·삭제 · `574 행` POST)로 PATCH describe 는 없다.
- 구현 축은 이미 main 에 있다 — [`src/llm/llm-provider-config.controller.ts`](../../src/llm/llm-provider-config.controller.ts) `180 행` `@Patch(":id")`, [`src/llm/llm-provider-config.service.ts`](../../src/llm/llm-provider-config.service.ts) `228~271 행` `update`. 즉 **미구현 route 를 만드는 task 가 아니라 이미 배선된 route 의 HTTP 계약을 red-able 하게 고정**하는 test-only slice 다.
- `docs/tasks/T-1973-*` 부재 확인(ID 미사용).

고정 가치: `update` 의 `253~255 행` **apiKey 분기**(명시 → 재암호화, 부재 → 기존 ciphertext 그대로 유지 = ADR-0014 §3 never-read-back)는 현재 unit mock 축에만 존재해, 재암호화가 평문 저장으로 회귀하거나 부재 시 ciphertext 가 덮여도 실 HTTP 왕복에서 아무도 red 가 되지 않는다.

## Required Reading

- [`test/e2e/llm-provider-configs.e2e-spec.ts`](../../test/e2e/llm-provider-configs.e2e-spec.ts) — `50~63 행` `VIEW_FIELDS` · seed secret 상수, `312 행` `ABSENT_ID`, `504~555 행` `ENC_KEY_ENV` · `VALID_CREATE_PAYLOAD` · ValidationPipe/RBAC case 표, `574~625 행` POST describe 의 env 키 주입 + `beforeAll` / `afterAll` / `afterEach` scaffold, `625~700 행` happy · never-read-back · 암호화 왕복 단언 패턴. 본 task 는 이 파일 **하단에 네 번째 top-level describe 를 append** 한다.
- [`src/llm/llm-provider-config.controller.ts`](../../src/llm/llm-provider-config.controller.ts) `168~189 행` — PATCH route 의 계약 주석(ValidationPipe 형식 검증 · service raw forward · Admin+ tier RBAC).
- [`src/llm/llm-provider-config.service.ts`](../../src/llm/llm-provider-config.service.ts) `228~271 행` — `update` 의 5 분기(미지원 provider 400 / partial data / apiKey 재암호화·유지 / P2025→404 / sanitize view).
- [`src/llm/dto/update-llm-provider-config.dto.ts`](../../src/llm/dto/update-llm-provider-config.dto.ts) `34~68 행` — 4 필드 전부 `@IsOptional` + 명시 시 `@IsString` / `@IsNotEmpty` / `@MaxLength`.
- [`test/helpers/auth-e2e-helper.ts`](../../test/helpers/auth-e2e-helper.ts) `106 행` `buildAuthCookie` · `132 행` `createAuthenticatedE2EApp`.
- [`docs/decisions/ADR-0014-llm-apikey-encryption.md`](../decisions/ADR-0014-llm-apikey-encryption.md) §1(암호화 저장) · §3(never-read-back).
- [CLAUDE.md](../../CLAUDE.md) §3.2(R-110 · R-112 · R-113) · §12(행 범위 표기).

## Acceptance Criteria

- [ ] `test/e2e/llm-provider-configs.e2e-spec.ts` **1 파일만** 수정. 기존 describe 3 개(`65` · `261` · `574 행`)는 무수정으로 두고 파일 하단에 `describe("E2E: PATCH /api/llm/providers/:id (T-1973, REQ-049/REQ-051/REQ-043)", ...)` 를 append 한다(자기 app 부트스트랩 + POST describe `577~583 행` 의 spec-local `LLM_APIKEY_ENC_KEY` 주입/복원 패턴 mirror — 리터럴 키 0, `randomBytes(32)`, `afterAll` 원값 복원).
- [ ] seed 는 `prisma.llmProviderConfig.create` + `cipher.encrypt(<평문 상수>)` 로 `beforeEach` 에 1 건(POST route 경유 금지 — PATCH 축 단독 red 판정 유지). `afterEach` 는 POST describe `615~621 행` 과 동일하게 `truncateAll` → `llmDefaultProvider.deleteMany()` → `llmProviderConfig.deleteMany()` 순서.
- [ ] **happy path** — Admin 쿠키로 `modelId` + `endpointUrl` 만 PATCH → 200 + `Object.keys` 가 `VIEW_FIELDS` 7 key 와 정확히 일치 + 명시 필드 교체 + **미명시 `provider` 불변** + 응답에 `apiKey` 키 부재.
- [ ] **소비처 연결(§3 소비처 동반)** — PATCH 직후 같은 쿠키의 `GET /:id` 가 200 이고 갱신값을 반영하며 본문에 apiKey 평문이 없음.
- [ ] **분기 — apiKey 명시**: 저장 row 의 `apiKey !== 새 평문` 이고 `cipher.decrypt(row.apiKey) === 새 평문`(ADR-0014 §1 재암호화), 응답 본문 문자열에 평문 부재.
- [ ] **분기 — apiKey 미명시**: PATCH 전후 저장 ciphertext 문자열이 **바이트 동일**(기존 유지, never-read-back). 다른 필드는 갱신됐음을 같은 it 에서 단언.
- [ ] **error path — 미지원 provider**: 허용 집합 밖 provider literal → 400 이고 row 필드 불변(`update` `233~237 행`).
- [ ] **error path — 부재 id**: `ABSENT_ID` 로 PATCH → 404(P2025 변환, `259~267 행`) 이고 기존 row 불변.
- [ ] **negative — ValidationPipe 예외 분기마다 1+**: `it.each` 로 최소 3 종(명시 필드 빈 문자열 / wrong type(number) / allow-list 밖 키) → 각각 400 + row 필드 불변.
- [ ] **negative — RBAC 예외 분기마다 1+**: `it.each` 로 3 종(User 쿠키 403 / 쿠키 부재 401 / 변조 JWT 401) → 각각 row 필드 불변(`547~555 행` 표 mirror). 과차단 없음 검증으로 SuperAdmin PATCH 200 1 건 추가.
- [ ] `pnpm lint && pnpm build && pnpm test` 로컬 green(R-110). e2e 는 실 DB 필요라 CI `pnpm test:e2e`(R-113)에서 green 확인.
- [ ] `pnpm test:cov` 통과 — line ≥ 80% / function ≥ 80%(production 코드 0 LOC 변경이라 임계 유지 확인만).
- [ ] 실 diff 가 300 LOC 를 넘길 것 같으면 **case 를 줄이는 순서**를 지킨다: (1) SuperAdmin 과차단 it → (2) ValidationPipe `it.each` 를 3 행으로 고정. 축 자체를 통째로 빼지 말고 줄인 항목은 Follow-ups 에 적는다.

## Out of Scope

- `PUT /api/llm/providers/default` e2e — 별도 후속 slice(아래 Follow-ups).
- `src/` · `prisma/` · `web/` · `.github/workflows/` · `package.json` 변경 0. 본 task 는 test-only 이며 route 동작을 바꾸지 않는다.
- `test/perf/*` · `test/load/*` 무접촉 — PLAN `157`·`158 행` 오너 게이트(신규 per-route perf baseline slice 금지).
- REQ-049 / REQ-051 상태 칸 재판정 — PLAN `183 행` once-rule 상 T-1971 이 이미 1 회 수행했다. 본 slice 로 다시 만들지 않는다.
- 신규 helper 신설 0 — 기존 `test/helpers/auth-e2e-helper.ts` · `db-truncate.ts` 만 사용(PLAN `182 행` 소비처 동반 의무).
- CI env · `.env` · 워크플로에 `LLM_APIKEY_ENC_KEY` 주입 금지(spec-local 일회용 키만, 커밋되는 secret 0).
- 기본 provider 슬롯(`LlmDefaultProvider`) seed 후 `isDefault: true` 파생 검증 — Follow-ups.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (비어 있음 — sub-agent 가 발견한 인접 작업을 여기에 적는다)
- 후보: `PUT /api/llm/providers/default` e2e 계약(쓰기 축 잔여 마지막 route).
- 후보: 기본 provider 로 지정된 row 를 PATCH 했을 때 `isDefault: true` 파생이 유지되는지 e2e(현 slice 는 `LlmDefaultProvider` seed 0).
