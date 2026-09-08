---
id: T-1974
title: LLM 기본 provider 지정(PUT /providers/default) e2e 계약 고정
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-049, REQ-051, REQ-043]
estimatedDiff: 285
estimatedFiles: 1
dependsOn: [T-1973]
touchesFiles: [test/e2e/llm-provider-configs.e2e-spec.ts]
independentStream: llm-provider-config-e2e
created: 2026-09-08
plannerNote: P5 · T-1973 Follow-up 쓰기 축 마지막 route — PUT /default e2e 0(providers/default 매칭 0), 슬롯 교체·멱등·라우트 순서 미고정
---

# T-1974 — LLM 기본 provider 지정(PUT /providers/default) e2e 계약 고정

## Why

직전 T-1973(PR #1547 → main squash `333edf53`)이 쓰기 축의 `PATCH /:id` 를 닫으면서 Follow-ups 에 `PUT /api/llm/providers/default`(쓰기 축 잔여 **마지막** route)를 남겼다. 본 task 는 그 한 route 를 잇고, 같은 Follow-up 의 `isDefault: true` 파생 축도 **PUT 응답·후속 GET 범위 안에서만** 함께 고정한다(PATCH 대상 row 의 파생 유지는 아래 Follow-ups — 한 slice 에 둘을 넣으면 §3 cap 초과).

issue-still-relevant pre-check(origin/main `fd2908ea` 기준, 명령과 실측치 그대로 박제):

- `git grep -nE "\.put\(.*(PROVIDERS_URL|api/llm/providers)" origin/main -- test/` → **0 매칭**. PUT 축의 e2e 는 아직 하나도 없다.
- `git grep -n "providers/default" origin/main -- test/` → **0 매칭**(perf · load · smoke 포함 test 트리 전체).
- `git grep -l "api/llm/providers" origin/main -- test/` → 7 파일이나 `test/e2e/` 는 [`test/e2e/llm-provider-configs.e2e-spec.ts`](../../test/e2e/llm-provider-configs.e2e-spec.ts) **1 개뿐**(나머지는 perf 3 · load 1 · smoke 1 · README 1). 그 파일은 `1081 행`, top-level describe **4 개**(`65 행` 목록 · `261 행` `:id` 조회·삭제 · `574 행` POST · `845 행` PATCH)로 PUT describe 는 없다.
- 구현 축은 이미 main 에 있다 — [`src/llm/llm-provider-config.controller.ts`](../../src/llm/llm-provider-config.controller.ts) `123 행` `@Put("default")`, [`src/llm/llm-provider-config.service.ts`](../../src/llm/llm-provider-config.service.ts) `333 행` `setDefault`, [`src/llm/dto/set-default-llm-provider.dto.ts`](../../src/llm/dto/set-default-llm-provider.dto.ts). 즉 **미구현 route 신설이 아니라 이미 배선된 route 의 HTTP 계약을 red-able 하게 고정**하는 test-only slice 다.
- `git grep -c "setDefault" origin/main -- src/llm/` → 축의 검증은 `llm-provider-config.controller.spec.ts` **33** · `llm-provider-config.service.spec.ts` **10** 로 전량 **unit mock 축**뿐이다.
- `git ls-tree origin/main docs/tasks/ | grep T-1974` → 0(ID 미사용).

고정 가치 3 가지: (a) 슬롯 **교체**(이전 기본 → 새 기본)가 실 DB 왕복에서 "기본이 정확히 1 개" 로 수렴하는지, (b) 이미 기본인 config 재지정의 **멱등**(ADR-0062 §Decision 3)이 500/409 로 회귀하지 않는지, (c) controller `110~114 행` 이 경고한 **라우트 순서 회귀** — 정적 segment `default` 가 `:id` 계열보다 뒤로 밀리면 `PUT /providers/default` 가 조용히 다른 핸들러로 흘러가는데, 그 오매칭을 잡을 실 HTTP 축이 지금 0 이다.

## Required Reading

- [`test/e2e/llm-provider-configs.e2e-spec.ts`](../../test/e2e/llm-provider-configs.e2e-spec.ts) — `47 행` `PROVIDERS_URL`, `50~58 행` `VIEW_FIELDS` 7 key, `312 행` `ABSENT_ID`, `504~508 행` `ENC_KEY_ENV`, `377~399 행` `llmDefaultProvider.create({ data: { llmProviderConfigId } })` 로 슬롯 seed → 파생 `isDefault` 확인 패턴, `845~905 행` PATCH describe 의 env 키 주입 + `beforeAll` / `afterAll` / `beforeEach` seed / `afterEach` 정리 scaffold, `546~556 행` RBAC case 표. 본 task 는 이 파일 **하단에 다섯 번째 top-level describe 를 append** 한다.
- [`src/llm/llm-provider-config.controller.ts`](../../src/llm/llm-provider-config.controller.ts) `102~131 행` — `@Put("default")` 의 계약 주석(200 명시 고정 · 선언 위치 고정 경고 · ValidationPipe · Admin+ tier RBAC · service raw forward).
- [`src/llm/llm-provider-config.service.ts`](../../src/llm/llm-provider-config.service.ts) `315~350 행` — `setDefault` 의 4 분기(성공 read-your-write `isDefault: true` / P2003→404 / P2025→404 / 슬롯 확보 후 row null → 방어적 404).
- [`src/llm/llm-default-provider.repository.ts`](../../src/llm/llm-default-provider.repository.ts) `34~64 행` — `DEFAULT_SLOT_ID = "default"` 고정 PK + `setSlot` upsert 단일 statement(기본 0 개 window 부재 · 재호출 멱등).
- [`src/llm/dto/set-default-llm-provider.dto.ts`](../../src/llm/dto/set-default-llm-provider.dto.ts) — 단일 필수 필드 `llmProviderConfigId` (`@IsString` · `@IsNotEmpty` · `@MaxLength(255)`).
- [`test/helpers/auth-e2e-helper.ts`](../../test/helpers/auth-e2e-helper.ts) `106 행` `buildAuthCookie` · `132 행` `createAuthenticatedE2EApp`.
- [`docs/decisions/ADR-0062-llm-default-provider-explicit-selection.md`](../decisions/ADR-0062-llm-default-provider-explicit-selection.md) §Decision 2(단일 슬롯 원자성) · §Decision 3(멱등 · P2003 방향 반대).
- [CLAUDE.md](../../CLAUDE.md) §3.2(R-110 · R-112 · R-113) · §12(행 범위 표기).

## Acceptance Criteria

- [ ] `test/e2e/llm-provider-configs.e2e-spec.ts` **1 파일만** 수정. 기존 describe 4 개(`65` · `261` · `574` · `845 행`)는 무수정으로 두고 파일 하단에 `describe("E2E: PUT /api/llm/providers/default (T-1974, REQ-049/REQ-051/REQ-043)", ...)` 를 append 한다(자기 app 부트스트랩 + PATCH describe `857~860 행` 의 spec-local `LLM_APIKEY_ENC_KEY` 주입/복원 패턴 mirror — 리터럴 키 0, `randomBytes(32)`, `afterAll` 원값 복원).
- [ ] seed 는 `beforeEach` 에서 `prisma.llmProviderConfig.create` + `cipher.encrypt(<평문 상수>)` 로 config **2 건**(A · B — 교체 분기 입력). 쓰기 route(POST/PATCH) 경유 금지(PUT 축 단독 red 판정 유지). `afterEach` 는 PATCH describe `899~905 행` 과 동일하게 `truncateAll` → `llmDefaultProvider.deleteMany()` → `llmProviderConfig.deleteMany()` 순서.
- [ ] **happy path** — Admin 쿠키로 `{ llmProviderConfigId: A }` PUT → **200**(201 아님) + `Object.keys` 가 `VIEW_FIELDS` 7 key 와 정확히 일치 + `id === A` + **`isDefault: true`** + 응답에 `apiKey` 키 부재 · 본문 문자열에 seed 평문 부재.
- [ ] **소비처 연결(§3 소비처 동반)** — PUT 직후 같은 쿠키의 `GET /:id`(A) 가 `isDefault: true`, `GET /`(목록)에서 A 만 `true` 이고 B 는 `false`.
- [ ] **분기 — 슬롯 교체**: A 지정 후 B 지정 → 200 + B 의 `isDefault: true`, 이어진 `GET /` 에서 `isDefault: true` 인 원소가 **정확히 1 개(B)** 이고 `prisma.llmDefaultProvider.count()` 가 **1**(중복 슬롯 0, ADR-0062 §Decision 2).
- [ ] **분기 — 멱등**: 이미 기본인 A 를 같은 body 로 재지정 → 200 + `isDefault: true` + 슬롯 count 여전히 1(재호출이 409/500 으로 회귀하면 red, §Decision 3).
- [ ] **분기 — 라우트 순서 회귀 가드**: `PUT ${PROVIDERS_URL}/default` 가 `:id = "default"` 로 오매칭되지 않음을 단언한다 — 위 happy 200 응답의 `id` 가 요청 body 의 A 이고 `"default"` 가 아니며, 같은 쿠키의 `GET ${PROVIDERS_URL}/default` 는 **404**(그런 config id 는 없음)임을 확인.
- [ ] **error path — 부재 id**: `{ llmProviderConfigId: ABSENT_ID }` → **404**(service 가 P2003 · P2025 를 수렴, `333~350 행`) 이고 `prisma.llmDefaultProvider.count()` 가 **0**(실패 요청이 슬롯을 만들지 않음).
- [ ] **negative — ValidationPipe 예외 분기마다 1+**: `it.each` 로 최소 4 종(필드 누락 / 빈 문자열 / wrong type(number) / allow-list 밖 키 포함) → 각각 **400** + 슬롯 count 0(service 미호출).
- [ ] **negative — RBAC 예외 분기마다 1+**: `it.each` 로 3 종(User 쿠키 403 / 쿠키 부재 401 / 변조 JWT 401) → 각각 슬롯 count 0(`546~556 행` 표 mirror). 과차단 없음 검증으로 SuperAdmin PUT 200 1 건 추가.
- [ ] `pnpm lint && pnpm build && pnpm test` 로컬 green(R-110). e2e 는 실 DB 필요라 CI `pnpm test:e2e`(R-113)에서 green 확인.
- [ ] `pnpm test:cov` 통과 — line ≥ 80% / function ≥ 80%(production 코드 0 LOC 변경이라 임계 유지 확인만).
- [ ] 실 diff 가 300 LOC 를 넘길 것 같으면 **case 를 줄이는 순서**를 지킨다: (1) SuperAdmin 과차단 it → (2) ValidationPipe `it.each` 를 3 행으로 축소. 축 자체를 통째로 빼지 말고 줄인 항목은 Follow-ups 에 적는다.

## Out of Scope

- `src/` · `prisma/` · `web/` · `.github/workflows/` · `package.json` 변경 0. 본 task 는 test-only 이며 route 동작을 바꾸지 않는다.
- `test/perf/*` · `test/load/*` 무접촉 — PLAN `157`·`158 행` 오너 게이트(신규 per-route perf baseline slice 금지).
- REQ-049 / REQ-051 상태 칸 재판정 — PLAN `183 행` once-rule 상 T-1971 이 이미 1 회 수행했다. 본 slice 로 다시 만들지 않는다.
- 신규 helper 신설 0 — 기존 `test/helpers/auth-e2e-helper.ts` · `db-truncate.ts` 만 사용(PLAN `182 행` 소비처 동반 의무).
- CI env · `.env` · 워크플로에 `LLM_APIKEY_ENC_KEY` 주입 금지(spec-local 일회용 키만, 커밋되는 secret 0).
- 기본으로 지정된 row 를 `PATCH` 했을 때 `isDefault: true` 파생이 유지되는지 — PATCH 축 소관, Follow-ups.
- 기본 지정 config 의 `DELETE` 409(FK Restrict) 경로 — `261 행` describe 소관, 본 slice 에서 확장 금지.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (비어 있음 — sub-agent 가 발견한 인접 작업을 여기에 적는다)
- 후보: 기본으로 지정된 row 를 `PATCH /:id` 로 갱신했을 때 `isDefault: true` 파생과 슬롯이 그대로 유지되는지 e2e(T-1973 잔여).
- 후보: 기본 지정된 config 를 `DELETE /:id` 하면 409(슬롯 `onDelete: Restrict`) 이고 슬롯 불변인지 e2e — service `296 행` delete 의 P2003 분기가 e2e 미고정.
