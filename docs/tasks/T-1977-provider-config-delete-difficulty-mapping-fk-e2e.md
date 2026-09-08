---
id: T-1977
title: 난이도 슬롯이 참조하는 provider config 의 DELETE 409 · 해소 경로 e2e 고정
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-049, REQ-050, REQ-051, REQ-043]
estimatedDiff: 285
estimatedFiles: 2
dependsOn: [T-1976]
touchesFiles: [test/e2e/llm-provider-configs.e2e-spec.ts]
independentStream: llm-provider-config-e2e
created: 2026-09-08
plannerNote: P5 · provider config 6 route 는 e2e 로 닫혔으나 DifficultyMapping FK 의 P2003→409 교차 축만 e2e 0
---

# T-1977 — 난이도 슬롯이 참조하는 provider config 의 DELETE 409 · 해소 경로 e2e 고정

## Why

T-1967 ~ T-1976 으로 `/api/llm/providers` 6 route 의 단일 route 계약과 **기본 슬롯(`LlmDefaultProvider`)** 교차 축은 전부 e2e 로 닫혔다. 남은 교차 축은 하나 — 같은 `delete` 의 P2003→409 분기를 **두 번째로** 트리거하는 `DifficultyMapping` FK (ADR-0011 §2 의 난이도 슬롯) 경로다. service 의 409 메시지 자체가 "먼저 DifficultyMapping 슬롯 또는 기본 provider 지정을 다른 config 로 재지정한 뒤 삭제하세요" 라고 안내하는데, 그 안내가 실 HTTP 왕복에서 성립하는지가 어디에도 고정돼 있지 않다.

issue-still-relevant pre-check (origin/main `ec90aa38`, 실측):

- `grep -c difficultyMapping test/e2e/llm-provider-configs.e2e-spec.ts` = **0**, 역방향 `grep -c "api/llm/providers" test/e2e/difficulty-mappings.e2e-spec.ts` = **0** → 두 도메인의 교차 e2e 는 **양방향 모두 0**. `test/e2e/` 전체에서 `difficulty-mappings.e2e-spec.ts` 밖의 `difficultyMapping` 참조도 **0** 건.
- 해당 spec 은 `1916 행` · top-level describe **7 개**(`66`·`262`·`575`·`846`·`1131`·`1396`·`1715 행`) 이고 `409` 매칭은 `427 행` **기본 슬롯 점유 config 삭제 1 건뿐** — 난이도 슬롯 참조로 발생하는 409 는 미고정.
- 구현은 이미 main 에 실재한다(= 미구현 신설이 아니라 **계약 고정**): service [`296~311 행`](../../src/llm/llm-provider-config.service.ts) `delete` 의 P2025→404 / P2003→409 분기 + [`prisma/schema.prisma`](../../prisma/schema.prisma) `452 행` `DifficultyMapping.llmProviderConfig ... onDelete: Restrict`. 그 검증은 `llm-provider-config.service.spec.ts` P2003 매칭 **18** · `llm-provider-config.controller.spec.ts` **6** 의 **unit mock 축 전량** 이라, DB 제약이 실제로 Restrict 인지 · guard 와 제약의 선후가 맞는지 · 재지정 후 삭제가 열리는지는 실 왕복에서 red 가 되지 않는다.
- 인접 후보였던 "기본 슬롯 점유 config 의 409" 는 `427 행` 이 이미 고정했고, "비기본 row DELETE 204" 는 T-1976 이 `1857 행` 에 고정했으므로 중복 slice 로 큐잉하지 않았다.

가치는 두 가지다. ① `onDelete: Restrict` 가 `SetNull` / `Cascade` 로 회귀하면 슬롯 FK 가 조용히 지워지는데(평가 라우팅이 말없이 죽는 회귀) 현재 그 회귀를 잡는 실 DB test 가 0 이다. ② 409 가 안내하는 **해소 경로**(난이도 슬롯을 다른 config 로 `PATCH` → 원래 config 삭제)는 controller 2 개를 가로지르는 배선이라 unit 축이 원리적으로 cover 하지 못한다 — CLAUDE.md §3 "소비처 동반" 관점의 실사용 시퀀스다.

## Required Reading

- [test/e2e/llm-provider-configs.e2e-spec.ts](../../test/e2e/llm-provider-configs.e2e-spec.ts) — `24~31 행`(실 DB 전략 + `truncateAll` 8 테이블 밖 테이블은 **자식→부모 순** 직접 `deleteMany`), `425~450 행`(기본 슬롯 409 선례), `1715~1800 행`(T-1976 describe 의 부트스트랩 · seed · `afterEach` 패턴 — 신설 describe 는 이 형태를 그대로 mirror), `48~64 행`(`VIEW_FIELDS` · `SECRET_A/B` 등 재사용 상수).
- [test/e2e/difficulty-mappings.e2e-spec.ts](../../test/e2e/difficulty-mappings.e2e-spec.ts) — `42 행`(`MAPPINGS_URL`), `54~59 행`(`SEED_LLM_CONFIG`), `95~113 행`(cleanup 순서 + `seedThreeSlots` 3 슬롯 seed 형태), `224~245 행`(PATCH describe 헤더 · URL 조립).
- [src/llm/llm-provider-config.service.ts](../../src/llm/llm-provider-config.service.ts) `296~311 행` — `delete` 의 P2025→404 / P2003→409 분기와 409 메시지 문구.
- [src/llm/difficulty-mapping.controller.ts](../../src/llm/difficulty-mapping.controller.ts) `92~105 행` — `PATCH /api/llm/difficulty-mappings/:difficulty`(200, Admin+ tier) — 해소 경로에서 호출할 route.
- [prisma/schema.prisma](../../prisma/schema.prisma) `447~458 행`(DifficultyMapping · `onDelete: Restrict` · `@@unique([difficulty])`) + `484~492 행`(LlmDefaultProvider).

## Acceptance Criteria

구현 파일 변경 0 LOC — `test/e2e/llm-provider-configs.e2e-spec.ts` **하단에 여덟 번째 top-level describe 1 개만 append** 한다(기존 describe 7 개 무수정, 신규 공용 상수 신설 0 — 기존 상수 재사용).

- [ ] seed 는 prisma 직접 create — config A · B + `DifficultyMapping` 슬롯 3 건(`easy → A`, `medium → null`, `hard → null`). `afterEach` 는 `truncateAll` → `difficultyMapping.deleteMany()` → `llmDefaultProvider.deleteMany()` → `llmProviderConfig.deleteMany()` **자식→부모 순** (역순은 Restrict 로 실패).
- [ ] **happy/branch** — Admin 쿠키로 `DELETE /api/llm/providers/{A}` 호출 시 **409** 이고, config A 잔존 · `easy` 슬롯 FK 가 A 그대로 · config count 2(P2003→409, Restrict 회귀 감지).
- [ ] **negative(누출)** — 위 409 응답 본문 문자열에 A 의 `apiKey` 원문이 등장하지 않는다(ADR-0014 §3 — 실패 경로도 secret 표면 0).
- [ ] **branch** — 아무 슬롯도 참조하지 않는 config B 의 Admin `DELETE` 는 **204 + 빈 body** 이고 B 부재 · A 잔존 · 슬롯 3 건 FK 불변(409 과차단이 비참조 row 로 확산 0).
- [ ] **branch(소비처 배선 · 해소 경로)** — `PATCH /api/llm/difficulty-mappings/easy` 로 슬롯을 B 로 재지정(200) 한 직후 `DELETE /api/llm/providers/{A}` 가 **204** 이고, A 부재 · `easy` 슬롯 FK 가 B 유지 · B 잔존(409 메시지가 안내하는 해소 시퀀스가 실 배선에서 성립).
- [ ] **branch(다중 참조)** — `easy` · `medium` 두 슬롯이 모두 A 를 가리키는 상태의 `DELETE {A}` 도 **409** 1 회이고 두 슬롯 FK 가 모두 불변.
- [ ] **branch(null FK)** — 슬롯 3 건이 전부 `llmProviderConfigId: null` 인 상태에서 `DELETE {A}` 는 **204**(null FK 는 Restrict 를 트리거하지 않음 — 슬롯 row 존재만으로 409 가 되지 않는다).
- [ ] **negative(과허용 0)** — SuperAdmin 쿠키로 참조 중인 A 를 `DELETE` 해도 **409** 이고 A · 슬롯 불변(RolesGuard escalation 이 DB 제약을 우회하지 않는다).
- [ ] **negative(guard 선행) `it.each` 3 종** — User role 403 / cookie 부재 401 / 변조 JWT 401. 셋 다 409 로 새지 않고, config A · B · 슬롯 3 건이 모두 불변이며 응답 본문에 `apiKey` 원문 미노출.
- [ ] `pnpm lint && pnpm build && pnpm test` green, `pnpm test:cov` 가 line ≥ 80% / function ≥ 80% 임계 통과(본 task 는 production 0 LOC 라 임계 유지 확인 목적).
- [ ] CI 의 `pnpm test:e2e`(R-113) 에서 본 spec 이 PASS 하고, e2e 합계 case 수가 실측 증가(직전 기준 36 suite / 590 case).

## Out of Scope

- `src/`, `web/`, `prisma/`, `.github/workflows/`, `package.json` 변경 — 본 task 는 test 1 파일 append 전용(production 0 LOC).
- 기존 top-level describe 7 개 수정 · 기존 케이스 재작성(특히 `427 행` 기본 슬롯 409, `1857 행` 비기본 row 204 는 그대로 둔다).
- `test/perf/` · `test/load/` 신규 slice(PLAN `156~157 행` 오너 게이트 — per-route baseline slice 큐잉 금지).
- `docs/requirements.md` 의 REQ status 재판정(§3.1 once-rule — 본 arc 는 T-1971 이 이미 수행).
- 공용 helper · fixture 신설 및 `test/helpers/db-truncate.ts` 의 `TRUNCATE_TABLES` 명단 변경.
- `PUT /default` 와 난이도 슬롯이 **동시에** 같은 config 를 가리키는 이중 Restrict 조합 — cap 압박 시 첫 번째로 잘라내고 Follow-ups 로 넘긴다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 발견 시 append)
