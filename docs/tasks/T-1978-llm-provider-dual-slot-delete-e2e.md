---
id: T-1978
title: 기본 슬롯 · 난이도 슬롯이 동시에 참조하는 config 의 DELETE 409 · 2 단 해소 e2e 고정
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-049, REQ-050, REQ-051, REQ-043]
estimatedDiff: 270
estimatedFiles: 2
dependsOn: [T-1977]
touchesFiles: [test/e2e/llm-provider-configs.e2e-spec.ts]
independentStream: llm-provider-config-e2e
created: 2026-09-08
plannerNote: P5 · T-1977 이 Out of Scope 로 넘긴 마지막 잔여 축 — 두 FK 동시 참조의 부분 해소 시 409 유지가 e2e 0
---

# T-1978 — 기본 슬롯 · 난이도 슬롯이 동시에 참조하는 config 의 DELETE 409 · 2 단 해소 e2e 고정

## Why

`/api/llm/providers` 6 route 의 단일 route 계약(T-1967 ~ T-1974)과 **기본 슬롯 교차**(T-1975 · T-1976) · **난이도 슬롯 교차**(T-1977)는 모두 e2e 로 닫혔다. 남은 것은 T-1977 이 `## Out of Scope` 마지막 bullet 로 명시 이월한 축 하나 — `LlmDefaultProvider`(ADR-0062 §Decision 2) 와 `DifficultyMapping`(ADR-0011 §2) **두 Restrict FK 가 동시에 같은 config 를 가리키는 상태**다. 이 상태의 운영 의미는 "409 를 풀려면 재지정을 **두 번** 해야 한다" 인데, 한 쪽만 재지정한 중간 상태에서 삭제가 열려버리면 남은 슬롯의 FK 가 조용히 깨진다(평가 라우팅 · 기본 provider 해석이 말없이 죽는 회귀). 그 중간 상태가 지금 어디에도 고정돼 있지 않다.

issue-still-relevant pre-check (origin/main `0f5c72db`, 실측):

- [test/e2e/llm-provider-configs.e2e-spec.ts](../../test/e2e/llm-provider-configs.e2e-spec.ts) 는 `2172 행` · top-level describe **8 개**(`66`·`262`·`575`·`846`·`1131`·`1396`·`1715`·`1933 행`).
- **교차 seed 0 (양방향 실측)** — T-1976 describe 구간(`1715~1932 행`)의 `difficultyMapping` 매칭 **0**, T-1977 describe 구간(`1933 행` 이후)의 `llmDefaultProvider.create|upsert` 매칭 **0**(같은 구간의 `llmDefaultProvider` 등장은 `2002 행` cleanup `deleteMany` 1 건뿐). 즉 두 FK 를 **동시에** seed 하는 케이스가 spec 전체에 없다.
- 기존 409 케이스는 둘 다 **단일 FK** 다 — `427 행`(기본 슬롯 점유 config 삭제 409) · `2026 행`(난이도 슬롯 참조 config 삭제 409) · `2098 행`(난이도 슬롯 **2 건**이 같은 config 를 참조해도 409). 서로 다른 종류의 FK 가 겹친 상태와, 그 중 하나만 푼 부분 해소 상태는 미고정.
- 구현은 이미 main 에 실재한다(= 미구현 신설이 아니라 **계약 고정**): [src/llm/llm-provider-config.service.ts](../../src/llm/llm-provider-config.service.ts) `297~311 행` `delete` 의 P2025→404 / P2003→409 변환은 **FK 종류를 구분하지 않는 단일 분기**이고, 409 메시지도 "DifficultyMapping 슬롯 **또는** 기본 provider 지정을 다른 config 로 재지정한 뒤 삭제하세요" 라고 두 원인을 한 문장에 묶는다 — 원인이 둘 다 살아 있을 때 한 번의 재지정으로 삭제가 열리지 않는다는 사실이 메시지에는 안 드러나고 test 에도 없다.
- unit 축은 mock 기반이라 이 축을 원리적으로 cover 하지 못한다 — service spec 의 P2003 은 repository mock 이 던지는 값이라 "FK 가 몇 개 남았는지" 를 DB 가 판정하지 않는다. 실 DB 왕복만이 `onDelete: Restrict` 2 개의 AND 의미를 검증한다.

가치: ① 두 FK 중 하나가 `SetNull` / `Cascade` 로 회귀하면 부분 해소 후 삭제가 열려 남은 슬롯이 깨지는데, 그 회귀를 잡는 test 가 현재 0. ② 해소 시퀀스가 controller **3 개**(providers DELETE · difficulty-mappings PATCH · providers PUT /default)를 가로지르는 실사용 배선이라 CLAUDE.md §3 "소비처 동반" 관점의 실 왕복 검증이다.

## Required Reading

- [test/e2e/llm-provider-configs.e2e-spec.ts](../../test/e2e/llm-provider-configs.e2e-spec.ts) — `48~64 행`(`PROVIDERS_URL` · `VIEW_FIELDS` · `SECRET_A`/`SECRET_B` 재사용 상수), `1715~1800 행`(T-1976 describe 의 부트스트랩 · `ENC_KEY_ENV` 임시 키 · 기본 슬롯 `llmDefaultProvider.create` seed · `afterEach` 자식→부모 정리 — 신설 describe 는 이 형태를 mirror), `1933~2024 행`(T-1977 describe 의 `MAPPINGS_URL` 지역 상수 · `difficultyMapping.createMany` 3 슬롯 seed · `readSlotFk` 헬퍼 · 3 단 cleanup), `2069~2095 행`(난이도 슬롯 PATCH 재지정 후 DELETE 204 시퀀스), `1204~1215 행`(`putDefault` 호출 형태 — `PUT ${PROVIDERS_URL}/default` + body `{ llmProviderConfigId }`, 200).
- [src/llm/llm-provider-config.service.ts](../../src/llm/llm-provider-config.service.ts) `297~311 행` — `delete` 의 P2025→404 / P2003→409 변환과 409 메시지 문구(FK 종류 미구분).
- [src/llm/llm-provider-config.controller.ts](../../src/llm/llm-provider-config.controller.ts) — `@Put("default")`(200, Admin+ tier) · `@Delete(":id")`(204) 두 route 의 guard 데코레이터 조합.
- [src/llm/difficulty-mapping.controller.ts](../../src/llm/difficulty-mapping.controller.ts) `92~105 행` — `PATCH /api/llm/difficulty-mappings/:difficulty`(200, Admin+ tier).
- [prisma/schema.prisma](../../prisma/schema.prisma) `441~458 행`(`DifficultyMapping` · nullable FK · `onDelete: Restrict` · `@@unique([difficulty])`) + `484~492 행`(`LlmDefaultProvider` 단일 슬롯 · `onDelete: Restrict`).

## Acceptance Criteria

구현 파일 변경 0 LOC — [test/e2e/llm-provider-configs.e2e-spec.ts](../../test/e2e/llm-provider-configs.e2e-spec.ts) **하단에 아홉 번째 top-level describe 1 개만 append** 한다(기존 describe 8 개 무수정, 모듈 스코프 상수 신설 0 — 지역 상수/헬퍼는 신설 describe 안에서만).

- [ ] seed 는 prisma 직접 create — config A · B + `LlmDefaultProvider` 슬롯 1 건(→ A) + `DifficultyMapping` 3 건(`easy → A`, `medium → null`, `hard → null`). `afterEach` 는 `truncateAll` → `difficultyMapping.deleteMany()` → `llmDefaultProvider.deleteMany()` → `llmProviderConfig.deleteMany()` **자식→부모 순**(역순은 Restrict 로 실패).
- [ ] **happy/branch** — Admin 쿠키 `DELETE ${PROVIDERS_URL}/{A}` 가 **409** 이고 A 잔존 · 기본 슬롯 1 건이 여전히 A · `easy` FK 가 A · config count 2(두 FK 동시 점유의 P2003→409).
- [ ] **branch(부분 해소 1 — 난이도만 재지정)** — `PATCH /api/llm/difficulty-mappings/easy` 로 `easy` 를 B 로 재지정(200) 한 뒤의 `DELETE {A}` 는 **여전히 409** 이고 A 잔존 · 기본 슬롯이 그대로 A · `easy` FK 는 B 유지(한 FK 만 풀려도 삭제가 열리지 않는다).
- [ ] **branch(부분 해소 2 — 기본만 재지정)** — `PUT ${PROVIDERS_URL}/default` body `{ llmProviderConfigId: B }`(200) 뒤의 `DELETE {A}` 는 **여전히 409** 이고 A 잔존 · 기본 슬롯이 B · `easy` FK 는 A 유지(반대 순서에서도 대칭 성립).
- [ ] **branch(완전 해소)** — 두 재지정을 모두 마친 뒤의 `DELETE {A}` 는 **204 + 빈 body** 이고 A 부재 · B 잔존 · 기본 슬롯 1 건이 B · `easy` FK 가 B · `difficultyMapping` count 3(2 단 해소가 실 배선에서 성립).
- [ ] **error path(누출)** — 위 409 응답 3 종 중 최소 1 종의 본문 문자열에 A 의 `apiKey` 원문(`SECRET_A`)이 등장하지 않는다(ADR-0014 §3 — 실패 경로도 secret 표면 0).
- [ ] **negative(과차단 확산 0)** — 어느 FK 도 참조하지 않는 config B 의 Admin `DELETE` 는 seed 직후 상태에서 **204** 이고 A 잔존 · 기본 슬롯 A · `easy` FK A 불변.
- [ ] **negative(과허용 0)** — SuperAdmin 쿠키로 이중 참조 중인 A 를 `DELETE` 해도 **409** 이고 A · 두 슬롯 불변(RolesGuard escalation 이 DB 제약을 우회하지 않는다).
- [ ] **negative(guard 선행) `it.each` 3 종** — User role 403 / cookie 부재 401 / 변조 JWT 401. 셋 다 409 로 새지 않고, config 2 건 · 기본 슬롯 A · `easy` FK A 가 모두 불변이며 응답 본문에 `apiKey` 원문 미노출.
- [ ] `pnpm lint && pnpm build && pnpm test` green, `pnpm test:cov` 가 line ≥ 80% / function ≥ 80% 임계 통과(본 task 는 production 0 LOC 라 임계 유지 확인 목적).
- [ ] CI 의 `pnpm test:e2e`(R-113) 에서 본 spec 이 PASS 하고 e2e 합계 case 수가 직전 대비 실측 증가(직전 값은 T-1977 머지 후 CI run 로그 기준으로 확인).

## Out of Scope

- `src/`, `web/`, `prisma/`, `.github/workflows/`, `package.json` 변경 — 본 task 는 test 1 파일 append 전용(production 0 LOC).
- 기존 top-level describe 8 개 수정 · 기존 케이스 재작성(특히 `427 행` 기본 슬롯 409, `1857 행` 비기본 row 204, `2026`·`2098 행` 난이도 슬롯 409 는 그대로 둔다).
- 409 메시지 문구 자체의 개선(두 FK 를 구분해 안내하도록 바꾸는 등) — 서비스 코드 변경이라 별건. 발견 시 `Follow-ups` 에만 적는다.
- `test/perf/` · `test/load/` 신규 slice(PLAN `156~157 행` 오너 게이트 — per-route baseline slice 큐잉 금지).
- `docs/requirements.md` REQ status 재판정(CLAUDE.md §3.1 once-rule — 본 arc 는 T-1971 이 이미 수행).
- 공용 helper · fixture 신설(PLAN `182 행` 소비처 동반 의무 — 소비처 없는 helper 단독 추가 금지) 및 `test/helpers/db-truncate.ts` 의 `TRUNCATE_TABLES` 명단 변경.
- `DifficultyMapping` 3 슬롯이 **서로 다른** config 를 가리키는 조합 · 기본 슬롯 재지정의 멱등 재호출 — 이미 T-1974 · T-1977 이 각각 cover 했거나 한계효용 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 발견 시 append)
