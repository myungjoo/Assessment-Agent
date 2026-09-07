---
id: T-1961
title: Add PATCH /api/llm/difficulty-mappings/:difficulty e2e contract spec
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-050, REQ-049]
estimatedDiff: 195
estimatedFiles: 1
created: 2026-09-07
independentStream: e2e-contract-gap
dependsOn: [T-1960]
touchesFiles:
  - test/e2e/difficulty-mappings.e2e-spec.ts
plannerNote: P5 e2e 계약 공백 — T-1960 이 Out of Scope 로 남긴 PATCH 슬롯 재지정 축을 같은 파일 add-only 로 닫는다
---

# T-1961 — 난이도 매핑 PATCH 축 e2e 계약 spec 추가

## Why

`docs/requirements.md` `69 행` REQ-050 은 IN_PROGRESS 서술 안에서 "`test/e2e/` 의 difficulty-mappings 참조도 0 이라 셋업 전 fail-fast 4xx 의 실경로 검증이 unit 밖에 없다" 고 스스로 공백을 적어 두었다. 직전 slice T-1960(PR #1538 → main `68786f7e`)이 조회(`@Get()`) 축만 닫고 슬롯 재지정(`@Patch(":difficulty")`) 축은 명시적으로 Out of Scope 로 남겼으므로, ADR-0011 `§ 3` fail-fast 계약(미지원 난이도 400 / config 부재 404 / 슬롯 부재 404)의 실 HTTP 경로 검증은 여전히 unit 밖에 존재하지 않는다.

issue-still-relevant pre-check — origin/main `d08adaaa` 실측: `git grep -n "patch" -- test/e2e/difficulty-mappings.e2e-spec.ts` **0 hit**(파일 210 행 전체가 GET describe 1 개), `git grep "assignProviderConfig" -- test/` 는 `test/perf/difficulty-mapping-read.perf-spec.ts` 의 mock 선언 3 곳뿐으로 실 배선 호출 0, 동일 의도 PENDING task 0, `T-1961` ID 미사용. 반대로 검증 대상은 실재한다 — `src/llm/difficulty-mapping.controller.ts` `92~105 행` 의 `@Patch(":difficulty")` + `@HttpCode(200)` + `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`, `src/llm/dto/assign-difficulty-mapping.dto.ts` 의 필수 단일 필드 DTO.

PLAN 오너 게이트 판정: `157 행`(k6 — `package.json` · `test/load/` 무접촉) · `158 행`(per-route perf baseline churn — `test/perf/` 무접촉, 본 task 는 기능 계약 e2e) · `183 행`(REQ status 재판정 once-rule — 본 PR 은 `docs/requirements.md` 무접촉이며, REQ-050 재판정은 GET·PATCH 두 축이 모두 머지된 뒤 **1 회** direct doc-sync 로 수행한다) 전부 미침범.

## Required Reading

- `test/e2e/difficulty-mappings.e2e-spec.ts` — 전체 210 행 (헤더 주석 `1~23 행` 전략 · `84~92 행` afterEach 정리 순서 · `95~108 행` `seedThreeSlots()` 헬퍼 · `110 행` 이후 GET it 블록). 본 task 는 이 파일에 **add-only**.
- `src/llm/difficulty-mapping.controller.ts` `82~105 행` — PATCH 계약 주석 + decorator 스택.
- `src/llm/difficulty-mapping.service.ts` `153 행` 이후 `assignProviderConfig` — config 사전 존재 검증 → 404, P2025 → 404 변환.
- `src/llm/difficulty.ts` `20 · 26~30 · 36 행` — `Difficulty` union · `DIFFICULTIES` · `isDifficulty`.
- `src/llm/dto/assign-difficulty-mapping.dto.ts` — 필수 `llmProviderConfigId` 검증 3 decorator + ValidationPipe 결합 계약(주석 `9~16 행`).
- `test/helpers/auth-e2e-helper.ts` — `createAuthenticatedE2EApp` · `buildAuthCookie` 시그니처.
- `docs/decisions/ADR-0011-difficulty-model-assignment.md` `§ 2` (`53~58 행`) · `§ 3` (`60~64 행`) — FK 재지정 의미 · fail-fast 결정.

## Acceptance Criteria

- [ ] `test/e2e/difficulty-mappings.e2e-spec.ts` 에 `describe("E2E: PATCH /api/llm/difficulty-mappings/:difficulty ...")` 블록 1 개를 **추가**한다. 기존 GET describe 블록 · `beforeAll` / `afterEach` / `seedThreeSlots()` 는 수정하지 않고 재사용한다(파일 상단 주석의 책임 서술만 PATCH 축 포함으로 확장 허용).
- [ ] **happy-path 1+** — Admin 쿠키 + 3 슬롯 seed 상태에서 `hard` 슬롯(FK null)에 실 `LlmProviderConfig.id` 를 지정 → 200 + 응답 body 의 `difficulty === "hard"` · `llmProviderConfigId === configId` 확인, 이어서 `prisma.difficultyMapping.findFirst` 로 DB 반영까지 검증.
- [ ] **error path 1+** — 존재하지 않는 `llmProviderConfigId`(예: 미존재 cuid) 지정 시 404, 그리고 슬롯 row 가 없는 상태(seed 없이 호출)에서 P2025 → 404 로 전파되는 것을 각각 별도 it 으로 검증.
- [ ] **분기별 1+** — (i) 미지원 난이도 path param(`Easy` 대문자 · `trivial`) → 400, (ii) DTO 위반 3 종(필드 누락 / 빈 문자열 / whitelist 밖 extra 키) → 400, (iii) 이미 FK 가 설정된 슬롯(`easy`)의 재지정도 200 으로 갱신되는 idempotent-overwrite 분기. 각 분기 1+ it.
- [ ] **negative 1+ (예외 분기마다)** — 쿠키 없음 → 401, `User` tier → 403, 그리고 401 / 403 / 400 / 404 응답 이후 해당 슬롯의 `llmProviderConfigId` 가 **변경되지 않았음**을 DB 재조회로 확인(권한 실패가 write 로 새지 않음). `SuperAdmin` 은 escalation 으로 200(과차단 없음).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. `src/` 변경 0 이므로 전역 coverage 게이트(line ≥ 80% / function ≥ 80%) 회귀가 없음을 `pnpm test:cov` 로 확인.
- [ ] CI 의 `e2e test` step(`pnpm test:e2e`) green — 로컬 `DATABASE_URL` 부재 시 CI 결과로 판정한다(R-113).
- [ ] diff ≤ 300 LOC · 파일 1 개 유지. `src/` · `web/` · `prisma/` · `.github/workflows/` · `package.json` 무변경.

## Out of Scope

- `src/llm/` 의 controller · service · repository · DTO **production 코드 수정 금지**. 본 task 는 test-only 계약 고정이다.
- `test/helpers/db-truncate.ts` 의 `TRUNCATE_TABLES` 명단 수정 금지 — 기존 파일의 자식→부모 `deleteMany` 정리 방식을 그대로 쓴다.
- `docs/requirements.md` REQ-050 상태 칸 재판정(PLAN `183 행` once-rule — GET·PATCH 두 축 머지 후 별도 direct doc-sync 1 회로 수행).
- `test/perf/` · `test/load/` 파일 신설 · 수정(PLAN `157 · 158 행` 오너 게이트).
- `scripts/daily-test.sh` 에 leg 추가(Q-0054 선례 — drift-guard smoke 3 종 동반 수정으로 파일 cap 초과).
- LLM 실 호출 · `resolveModel` 경로 e2e · seed script 신설.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음)
