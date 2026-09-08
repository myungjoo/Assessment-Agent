---
id: T-1975
title: 기본 지정 row 의 PATCH × isDefault 파생 유지 e2e 계약 고정
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-049, REQ-051, REQ-043]
estimatedDiff: 265
estimatedFiles: 1
dependsOn: [T-1974]
touchesFiles: [test/e2e/llm-provider-configs.e2e-spec.ts]
independentStream: llm-provider-config-e2e
created: 2026-09-08
plannerNote: P5 · T-1974 Follow-up 잔여 1 축 — PATCH describe 안 isDefault 단언 0 · 슬롯 seed 0 이라 파생 유지가 e2e 미고정
---

# T-1975 — 기본 지정 row 의 PATCH × isDefault 파생 유지 e2e 계약 고정

## Why

직전 T-1974(PR #1548 → main squash `08918950`)가 쓰기 축 마지막 route `PUT /api/llm/providers/default` 를 닫으면서 provider config **6 route**(읽기 2 · 쓰기 3 + DELETE)의 단일 route 계약은 모두 e2e 로 고정됐다. 남은 것은 route **교차** 축 1 건 — T-1973 · T-1974 가 둘 다 Follow-up 으로 넘긴 "기본으로 지정된 row 를 `PATCH` 했을 때 `isDefault: true` 파생과 슬롯이 그대로 유지되는가" 다(한 slice 에 합치면 §3 cap 초과라 분리된 항목).

issue-still-relevant pre-check(origin/main `b3b12266` 기준, 명령과 실측치 그대로 박제):

- `git grep -c "isDefault" origin/main -- test/e2e/llm-provider-configs.e2e-spec.ts` → **29**. 그러나 `awk` 로 PATCH describe 구간(`846~1082 행`)만 보면 매칭은 **1 줄뿐이고 그것도 `1127 행` 의 PUT describe 헤더 주석**이다 — PATCH describe 본문의 `isDefault` 단언은 **0**.
- 같은 구간에서 `llmDefaultProvider` 매칭은 `904 행` **1 줄뿐**(`afterEach` 의 `deleteMany`). 즉 PATCH describe 는 기본 슬롯을 **한 번도 seed 하지 않아** 모든 케이스가 `isDefault: false` 경로만 밟는다. 기본 슬롯이 걸린 row 를 PATCH 하는 상태 조합은 e2e 에 존재하지 않는다.
- 구현 축은 이미 main 에 있다 — [`src/llm/llm-provider-config.service.ts`](../../src/llm/llm-provider-config.service.ts) `228 행` `update` 의 마지막 문장이 `270 행` `return this.sanitize(row, await this.readDefaultConfigId());` 다. 즉 **미구현 신설이 아니라** 이미 배선된 파생 계산의 HTTP 계약을 red-able 하게 고정하는 test-only slice 다.
- `git show origin/main:src/llm/llm-provider-config.service.spec.ts | grep -c "isDefault"` → **14**(controller.spec 은 8). 파생 축 검증이 unit mock 에 전량 몰려 있어, `update` 의 `readDefaultConfigId()` 인자가 유실되거나 `sanitize` 가 상수 false 로 회귀해도 실 DB · 실 HTTP 왕복에서는 red 가 되지 않는다.
- `git ls-tree origin/main docs/tasks/ | grep -c T-1975` → **0**(ID 미사용).
- 인접 Follow-up 후보였던 "기본 지정 config 의 DELETE 409" 는 **이미 고정돼 있다** — `git grep -n "409" origin/main -- test/e2e/llm-provider-configs.e2e-spec.ts` 가 `427 행` `기본 슬롯이 가리키는 config 를 DELETE 하면 409 이고 config·슬롯이 둘 다 잔존` 을 보여준다. 본 task 에서 다시 만들지 않는다(중복 slice 차단).

고정 가치 2 가지: (a) `update` 가 반환 view 의 `isDefault` 를 **슬롯 재조회 결과로** 계산한다는 계약 — 이 인자가 유실되면 Admin 이 기본 provider 를 수정한 직후 화면에서 기본 표시가 사라지는 회귀가 되는데 지금 이를 잡는 실 HTTP 축이 0 이다. (b) PATCH 는 슬롯을 **건드리지 않는다** 는 반대 방향 계약 — 기본이 아닌 row 를 수정했다고 기본으로 승격되거나, 실패한 PATCH(404 · 400 · 403)가 슬롯을 흔들지 않아야 한다.

## Required Reading

- [`test/e2e/llm-provider-configs.e2e-spec.ts`](../../test/e2e/llm-provider-configs.e2e-spec.ts) — `48 행` `PROVIDERS_URL`, `51~59 행` `VIEW_FIELDS` 7 key, `505 행` `ENC_KEY_ENV`, `390~399 행` · `429~440 행` 의 `llmDefaultProvider.create({ data: { llmProviderConfigId } })` 슬롯 seed → 파생 확인 + `count()` 단언 패턴, PATCH describe `846~1082 행`(특히 `858~890 행` env 키 주입 · `createAuthenticatedE2EApp` 3 actor scaffold, `893~899 행` `beforeEach` seed, `901~905 행` `afterEach` 정리 순서, `914~941 행` happy 단언 형태, `1072~1081 행` SuperAdmin 과차단 케이스), `1084~1111 행` T-1974 가 이미 둔 모듈 상수 `SECRET_DEFAULT_A` · `SECRET_DEFAULT_B` · `ABSENT_DEFAULT_ID` · `INVALID_DEFAULT_BODIES`(재사용 대상 — 유사 상수 신설 금지), `1113~1130 행` RBAC 3 조건 표. 본 task 는 이 파일 **하단(`1377 행` 뒤)에 여섯 번째 top-level describe 를 append** 한다.
- [`src/llm/llm-provider-config.service.ts`](../../src/llm/llm-provider-config.service.ts) `103~117 행` `readDefaultConfigId`(슬롯 부재 → null), `119~138 행` `sanitize`(`isDefault: row.id === defaultConfigId`), `228~271 행` `update` 5 단계(특히 `253~255 행` apiKey 재암호화 분기와 `270 행` 파생 재계산).
- [`src/llm/llm-provider-config.controller.ts`](../../src/llm/llm-provider-config.controller.ts) `180~198 행` `@Patch(":id")` 의 상태코드 · ValidationPipe · Admin+ tier 계약.
- [`src/llm/llm-default-provider.repository.ts`](../../src/llm/llm-default-provider.repository.ts) `38 행` `DEFAULT_SLOT_ID = "default"` 고정 PK + `46~64 행` `findSlot` / `setSlot`(단일 슬롯 · upsert).
- [`test/helpers/auth-e2e-helper.ts`](../../test/helpers/auth-e2e-helper.ts) `106 행` `buildAuthCookie` · `132 행` `createAuthenticatedE2EApp`.
- [`docs/decisions/ADR-0062-llm-default-provider-explicit-selection.md`](../decisions/ADR-0062-llm-default-provider-explicit-selection.md) §Decision 2(단일 슬롯 원자성) — 기본은 언제나 0 또는 1 개.
- [CLAUDE.md](../../CLAUDE.md) §3(소비처 동반 의무) · §3.2(R-110 · R-112 · R-113) · §12(행 범위 표기).

## Acceptance Criteria

- [ ] `test/e2e/llm-provider-configs.e2e-spec.ts` **1 파일만** 수정. 기존 describe 5 개(`66` · `262` · `575` · `846` · `1131 행`)와 기존 모듈 상수는 무수정으로 두고, 파일 하단에 `describe("E2E: PATCH /api/llm/providers/:id × 기본 슬롯 파생 (T-1975, REQ-049/REQ-051/REQ-043)", ...)` 를 append 한다(PATCH describe `858~890 행` 의 spec-local `LLM_APIKEY_ENC_KEY` 주입/복원 패턴 mirror — 리터럴 키 0, `randomBytes(32)`, `afterAll` 원값 복원).
- [ ] seed 는 `beforeEach` 에서 `prisma.llmProviderConfig.create` + `cipher.encrypt(...)` 로 config **2 건**(A · B) 을 만들고 `prisma.llmDefaultProvider.create({ data: { llmProviderConfigId: A } })` 로 **A 를 기본으로** 심는다. 쓰기 route(POST · PUT `/default`) 경유 금지(PATCH 축 단독 red 판정 유지). 평문 상수 · 부재 id 는 `1086~1089 행` 의 기존 `SECRET_DEFAULT_A` · `SECRET_DEFAULT_B` · `ABSENT_DEFAULT_ID` 를 재사용한다. `afterEach` 는 `901~905 행` 과 동일하게 `truncateAll` → `llmDefaultProvider.deleteMany()` → `llmProviderConfig.deleteMany()` 순서.
- [ ] **happy path** — Admin 쿠키로 기본 row A 의 `modelId` 를 PATCH → **200** + `Object.keys` 가 `VIEW_FIELDS` 7 key 와 정확히 일치 + `id === A` + **`isDefault: true` 유지** + `apiKey` 키 부재 + 본문 문자열에 seed 평문 부재. 아울러 `prisma.llmDefaultProvider.count()` 가 **1** 이고 슬롯의 `llmProviderConfigId` 가 여전히 **A**.
- [ ] **소비처 연결(§3 소비처 동반)** — 같은 PATCH 직후 같은 쿠키의 `GET /:id`(A) 가 `isDefault: true` + 갱신값 반영이고, `GET /`(목록)에서 `isDefault: true` 인 원소가 **정확히 1 개(A)**, B 는 `false`.
- [ ] **분기 — apiKey 재암호화 경로**: A 에 `apiKey` 를 명시한 PATCH → 200 + `isDefault: true` 유지 + 저장 ciphertext 가 새 평문으로 갱신(이전 ciphertext 와 상이, `cipher.decrypt` 왕복 일치) + 슬롯 count 1 · 대상 불변(`253~255 행` 분기가 파생 · 슬롯을 흔들지 않음).
- [ ] **분기 — 비기본 row(반대 방향)**: 기본이 아닌 B 를 PATCH → 200 + **`isDefault: false`** + 슬롯이 여전히 A 를 가리킴(PATCH 가 기본을 승격시키면 red).
- [ ] **분기 — 슬롯 부재**: `llmDefaultProvider.deleteMany()` 로 슬롯을 비운 뒤 A 를 PATCH → 200 + `isDefault: false`(`105~117 행` 의 null 분기).
- [ ] **error path — 부재 id**: `ABSENT_DEFAULT_ID` 로 PATCH → **404** + 슬롯 count **1** · 대상 여전히 A(실패가 슬롯을 흔들지 않음).
- [ ] **negative — 미지원 provider**: A 에 허용 집합 밖 `provider` literal → **400** + A 의 저장 row 필드 불변 + 슬롯 count 1 · 대상 A.
- [ ] **negative — ValidationPipe**: `it.each` 로 최소 2 종(wrong type / allow-list 밖 키 포함) → 각각 **400** + 슬롯 count 1 · 대상 A(service 미호출).
- [ ] **negative — RBAC 예외 분기마다 1+**: `it.each` 로 3 종(User 쿠키 403 / 쿠키 부재 401 / 변조 JWT 401) → 각각 A 의 row 불변 + 슬롯 count 1 · 대상 A(`1113~1130 행` 표 mirror). 과차단 없음 검증으로 SuperAdmin 의 A PATCH 200 + `isDefault: true` 1 건 추가.
- [ ] `pnpm lint && pnpm build && pnpm test` 로컬 green(R-110). e2e 는 실 DB 필요라 CI `pnpm test:e2e`(R-113)에서 해당 spec PASS 확인.
- [ ] `pnpm test:cov` 통과 — line ≥ 80% / function ≥ 80%(production 코드 0 LOC 변경이라 임계 유지 확인만).
- [ ] 실 diff 가 300 LOC 를 넘길 것 같으면 **case 를 줄이는 순서**를 지킨다: (1) SuperAdmin 과차단 it → (2) ValidationPipe `it.each` 를 1 행으로 축소 → (3) 미지원 provider 400 it. `isDefault` 파생 축(happy · 소비처 · 비기본 · 슬롯 부재)은 줄이지 않으며, 줄인 항목은 Follow-ups 에 적는다.

## Out of Scope

- `src/` · `prisma/` · `web/` · `.github/workflows/` · `package.json` 변경 0. 본 task 는 test-only 이며 route 동작을 바꾸지 않는다.
- 기본 지정 config 의 `DELETE` 409 — `427 행` 이 이미 고정했다(위 pre-check). 확장 · 중복 금지.
- `PUT /default` 자체의 계약(슬롯 교체 · 멱등 · 라우트 순서) — `1131 행` describe 소관. 본 slice 는 그 route 를 호출하지 않는다.
- `test/perf/*` · `test/load/*` 무접촉 — PLAN `157`·`158 행` 오너 게이트(신규 per-route perf baseline slice 금지).
- REQ-049 / REQ-051 상태 칸 재판정 — PLAN `183 행` once-rule 상 T-1971 이 이미 1 회 수행했다.
- 신규 helper · 신규 모듈 상수 신설 0 — 기존 `test/helpers/auth-e2e-helper.ts` · `db-truncate.ts` 와 `1084~1111 행` 상수만 재사용(PLAN `182 행` 소비처 동반 의무).
- CI env · `.env` · 워크플로에 `LLM_APIKEY_ENC_KEY` 주입 금지(spec-local 일회용 키만, 커밋되는 secret 0).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- **cap 축소로 뺀 case 2 건** (AC 마지막 항목의 축소 순서 (1) · (3) 적용 — 전량 포함 시 실 diff 325 LOC 로 §3 cap 초과였고, 축소 (2) 는 기존 모듈 상수 `INVALID_PATCH_BODIES` 재사용이라 LOC 절감이 0 이라 건너뛰었다): (a) SuperAdmin 쿠키로 기본 row A 를 PATCH → 200 + `isDefault: true` 과차단 없음 1 건 (b) 기본 row A 에 허용 집합 밖 `provider` literal → 400 + row · 슬롯 불변 1 건. 둘 다 `isDefault` 파생 축이 아니고 T-1973 describe(`1008 행` · `1072 행`)가 비기본 row 기준으로 이미 고정한 분기라, 잔여분은 "기본 슬롯이 걸린 row 에서도 같은가" 확인 1 건씩이다. 후속 slice 로 append 가능(예상 +30 LOC, 1 파일).
