---
id: T-1970
title: LLM provider config 단건 조회 · 삭제 e2e 계약 고정 (GET/DELETE :id)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-051, REQ-043]
estimatedDiff: 290
estimatedFiles: 1
created: 2026-09-08
independentStream: llm-provider-config-e2e
dependsOn: [T-1967]
touchesFiles:
  - test/e2e/llm-provider-configs.e2e-spec.ts
plannerNote: T-1967 이 목록 축만 닫아 :id 단건·삭제 e2e 0 — 404/409(기본 provider 점유)·never-read-back 을 같은 spec 에 잇는다.
---

# T-1970 — LLM provider config 단건 조회 · 삭제 e2e 계약 고정 (GET/DELETE :id)

## Why

T-1967(PR #1543 → main `b2a6ce5d`) 이 `GET /api/llm/providers` **목록** 축만 e2e 로 닫았고, 같은 controller 의 나머지 5 handler 는 실 HTTP 왕복 축이 0 이다. 그중 **단건 조회 · 삭제** 두 route 는 `LlmApiKeyCipher` 암호화 경로를 타지 않아(seed 는 prisma 직접 create, 읽기 경로는 never-decrypt) 기존 spec 의 무-network 전략을 그대로 승계할 수 있는 유일한 쓰기-쪽 묶음이다. 특히 **삭제의 409 분기** 는 ADR-0062 `§Decision 2` 가 신설한 전역 기본 provider 슬롯(`LlmDefaultProvider.llmProviderConfigId` `onDelete: Restrict`)이 "기본으로 지정된 config 는 못 지운다" 를 새 코드 0 으로 성립시킨 계약인데, 지금은 이 성립이 unit 축(P2003 → `ConflictException` 매핑)에만 있고 실 FK 왕복으로 확인되지 않는다 — schema 의 `Restrict` 가 `Cascade`/`SetNull` 로 회귀해도 red 가 되지 않는다. 요구표 `62 행` REQ-043 은 검증 방법을 `e2e` 로 선언하는데 본 controller 의 보호 route 6 개 중 e2e 로 tier 를 실제 왕복 검증한 것은 목록 1 개뿐이다.

**issue-still-relevant pre-check (origin/main `5c15e1f5` 실측)**:

- `grep -rn "llm/providers" test/e2e/` hit 3 건 전부 `test/e2e/llm-provider-configs.e2e-spec.ts` 의 목록 축(`1`·`40`·`58 행`) — **`:id` 경로 e2e hit 0**.
- route 실재 확인: `src/llm/llm-provider-config.controller.ts` `141~144 행` `@Get(":id")` → `service.findById` raw forward, `199~203 행` `@Delete(":id")` + `@HttpCode(204)`. 둘 다 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`.
- 404/409 분기 실재 확인: `src/llm/llm-provider-config.service.ts` `156~159 행`(`findById` null → `NotFoundException`), `297~309 행`(`delete` 의 P2025 → 404 / P2003 → 409 / 그 외 raw propagate).
- FK 실재 확인: `prisma/schema.prisma` `model LlmDefaultProvider` 의 `llmProviderConfigId String @unique` + `@relation(..., onDelete: Restrict)`.
- 오너 게이트 미침범 — `test/perf`·`test/load` 무접촉(PLAN `157`·`158 행`), 신설 helper 0 이라 소비처 동반 의무(`182 행`) 해당 없음, `docs/requirements.md` 무접촉(`183 행` once-rule 은 본 slice 머지 뒤 1 회로 미룬다).

## Required Reading

- `test/e2e/llm-provider-configs.e2e-spec.ts` — 전체. 본 task 는 이 파일에 describe 를 **추가** 한다(신규 파일 생성 금지). `beforeAll` actor 3 종·`afterEach` 의 자식→부모 deleteMany 순서·`SECRET_A`/`SECRET_B`·`VIEW_FIELDS` 상수를 그대로 재사용.
- `src/llm/llm-provider-config.controller.ts` `141~144 행`(`@Get(":id")`) · `199~203 행`(`@Delete(":id")` + `@HttpCode(204)`) — 경로·상태코드·guard tier 원본.
- `src/llm/llm-provider-config.service.ts` `147~163 행`(`findById` 의 404 분기 + sanitize/isDefault 파생) · `272~310 행`(`delete` 의 P2025/P2003/raw 3 분기).
- `prisma/schema.prisma` `model LlmDefaultProvider` · `model LlmProviderConfig` — 409 를 만드는 `onDelete: Restrict` FK 와 `@unique` 슬롯 형태.
- `test/helpers/auth-e2e-helper.ts` · `test/helpers/db-truncate.ts` — 기존 helper 재사용 경계(신규 helper 신설 금지).
- `docs/decisions/ADR-0014-llm-apikey-encryption.md` `§3`(never-read-back) · `docs/decisions/ADR-0062-llm-default-provider-explicit-selection.md` `§Decision 2`.

## Acceptance Criteria

- [ ] `test/e2e/llm-provider-configs.e2e-spec.ts` 에 `GET /api/llm/providers/:id` · `DELETE /api/llm/providers/:id` 용 describe 를 추가한다(파일 1 개만 변경, 기존 목록 describe 본문 무수정).
- [ ] **happy — 단건 조회**: seed 한 config 의 `id` 로 `GET` 하면 200 이고 body 가 `VIEW_FIELDS` 7 key 를 모두 가지며 값이 seed 값과 일치한다.
- [ ] **happy — 삭제**: seed 한 config 를 `DELETE` 하면 204 이고 응답 body 가 비어 있으며, 이어지는 `GET :id` 가 404 이고 `prisma.llmProviderConfig.count()` 가 0 이다(실 삭제 확인).
- [ ] **never-read-back (ADR-0014 §3)**: 200 단건 응답에 `apiKey` 키가 없고, 응답 본문 문자열에 seed 한 apiKey 원문이 등장하지 않는다(키 부재 + 원문 미포함 이중 단언). 204 삭제 응답 본문에도 config 필드가 0 개다.
- [ ] **분기 — `isDefault` 파생 2 종**: 기본 슬롯 미지정 상태의 `GET :id` 는 `isDefault: false`, 같은 config 를 가리키는 `LlmDefaultProvider` row 를 넣은 뒤의 `GET :id` 는 `isDefault: true`.
- [ ] **error path — 404 2 종**: 부재 `id` 로 `GET` 시 404, 부재 `id` 로 `DELETE` 시 404(P2025 → 404 매핑). 두 실패 응답 모두 다른 config 의 데이터를 흘리지 않고, `DELETE` 404 이후 기존 row 는 잔존한다.
- [ ] **분기 — 409 (핵심)**: `LlmDefaultProvider` 가 가리키는 config 를 `DELETE` 하면 409 이고, 응답 후 해당 `llmProviderConfig` row 와 `llmDefaultProvider` 슬롯이 **둘 다 잔존** 한다(P2003 → `ConflictException` 매핑 + `onDelete: Restrict` 회귀 감지).
- [ ] **negative — 예외 분기별 1+**: 2 route 각각에 대해 User tier 403 · 쿠키 부재 401 · 변조 JWT 401 을 `it.each` 로 cover(총 6 케이스). 각 실패 경로에서 config 데이터가 응답에 노출되지 않고 `DELETE` 실패 시 row 가 잔존한다.
- [ ] **negative — escalation 과차단 없음**: SuperAdmin 쿠키의 `GET :id` 가 200 이다(RolesGuard escalation, 과차단 0).
- [ ] `it.each` 테이블은 객체 표 + `$routeLabel` 형태로 두어 test 이름에 route 객체가 덤프되지 않게 한다(T-1968 nit 승계).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. `src/` 무접촉이라 전역 coverage 는 불변이어야 하며, `pnpm test:cov` 가 line ≥ 80% · function ≥ 80% 임계로 통과한다.
- [ ] `pnpm test:e2e` 는 로컬 `DATABASE_URL` 부재 시 실행 불가하므로 CI e2e job(R-113) 결과로 확인하고, 새 spec 이 `PASS` 목록에 나타난다.
- [ ] 변경 diff ≤ 300 LOC · 파일 1 개(§3 cap).

## Out of Scope

- `POST /` · `PATCH /:id` · `PUT /default` 3 route 의 e2e — 앞의 둘은 `LlmApiKeyCipher` 암호화 경로(`LLM_APIKEY_ENC_KEY` env 필요)를 타므로 env 주입 방식 결정이 선행돼야 한다. 별도 slice 로 남긴다(Follow-ups (a)).
- `src/` · `web/` · `prisma/schema.prisma` 의 어떤 변경도 금지 — 본 task 는 현행 동작을 고정만 한다. 결함을 발견하면 고치지 말고 Follow-ups 에 적는다.
- 신규 test helper · fixture 파일 신설 금지(기존 `auth-e2e-helper` · `db-truncate` 재사용).
- `docs/requirements.md` REQ-051 / REQ-043 상태 칸 수정 — §3.1 규칙 6(구현 slice 머지 후 REQ 당 1 회)에 따라 본 slice 머지 뒤 별도 task 1 회로 처리한다.
- `test/perf/` · `test/load/` 접촉(PLAN `157`·`158 행` 오너 게이트).
- `LLM_APIKEY_ENC_KEY` 를 CI workflow 나 spec 에 주입하는 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

- (a) planner 예약: `POST /` · `PATCH /:id` · `PUT /default` e2e — `LLM_APIKEY_ENC_KEY` 주입 방식(spec-local 테스트 키 vs CI env) 결정이 선행.
- (b) planner 예약: 본 slice 머지 후 REQ-051(+ REQ-043) 상태 칸에 e2e 좌표를 **1 회** 박제(목록·단건·삭제 축을 한 번에 — 왕복 금지, PLAN `183 행`).
