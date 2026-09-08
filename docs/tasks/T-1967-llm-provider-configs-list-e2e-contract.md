---
id: T-1967
title: GET /api/llm/providers 목록 조회 e2e 계약 spec 신설 (apiKey 미노출 · RBAC 축)
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-051, REQ-043]
estimatedDiff: 230
estimatedFiles: 1
created: 2026-09-08
independentStream: e2e-contract-gap
dependsOn: []
touchesFiles: [test/e2e/llm-provider-configs.e2e-spec.ts]
plannerNote: "P7 e2e 공백 — test/e2e 의 api/llm/providers 참조 0 을 목록 조회 축(apiKey 미노출 · RBAC) 1 파일로 닫는다 (T-1960 동형)"
---

# T-1967 — GET /api/llm/providers 목록 조회 e2e 계약 spec 신설 (apiKey 미노출 · RBAC 축)

## Why

`LlmProviderConfigController` 는 `src/llm/llm-provider-config.controller.ts` `77 행` `@Controller("api/llm/providers")` 아래 6 핸들러를 노출하지만 **실 HTTP 왕복으로 그 계약을 고정하는 축이 없다**. 특히 ADR-0014 §3 never-read-back 이 요구하는 **`apiKey` 미노출** invariant 는 지금 service 단 unit spec 과 mocked perf spec 에만 있어, `LlmProviderConfigView` 의 명시 pick (`llm-provider-config.service.ts` `123~131 행`) 이 회귀로 전체 row spread 로 바뀌어도 실 응답을 보는 test 가 하나도 없다. 본 slice 는 그 공백 중 **목록 조회 축** 을 T-1960 (`difficulty-mappings` 조회 축) 과 동형으로 1 파일에 닫는다.

**issue-still-relevant pre-check (origin/main `c690aeaf` 실측)**:

- `git grep -c "api/llm/providers" origin/main -- test/` → hit 파일 **5 개 전부 e2e 밖**: `test/load/s1-batch.js` (k6 수동 workflow — `pnpm test:e2e` 미포함) · `test/perf/README.md` · `test/perf/llm-provider-config-read.perf-spec.ts` · `test/perf/llm-provider-config-detail-read.perf-spec.ts` · `test/perf/llm-provider-config-read-realdb.perf-spec.ts`. **`test/e2e/` 하위 hit 는 0** — 본 task 의 의도는 main 에 미안착.
- 컨트롤러 존재 확인: `origin/main:src/llm/llm-provider-config.controller.ts` `77 행` `@Controller("api/llm/providers")`, `95 행` `@Get()`, `141 행` `@Get(":id")` — 대상 route 실재.
- controller 미커버 목록 실측: `find src -name "*.controller.ts"` 22 개 중 e2e 참조 **0 인 controller 는 `llm-provider-config` 와 `cron-schedule` 둘뿐** — 본 slice 가 그 중 하나를 닫는다.
- 오너 게이트 미침범: `157 행`·`158 행` (R-91 k6 / R-92 per-route perf churn 중단) — 본 task 는 `test/perf`·`test/load` **무접촉**. `182 행` (소비처 동반 의무) — 신설 helper 0, 기존 `test/helpers/*` 재사용만. `183 행` (REQ 재판정 1 회) — 본 task 는 재판정 task 가 아니고 `docs/requirements.md` 무접촉.

## Required Reading

- `src/llm/llm-provider-config.controller.ts` — `77 행` `@Controller` + `@UsePipes(ValidationPipe)`, `95~99 행` `@Get() findAll` (RBAC `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`).
- `src/llm/llm-provider-config.service.ts` — `74~87 행` `LlmProviderConfigView` 타입 정의 (`Omit<LlmProviderConfig, "apiKey"> & { isDefault: boolean }` = 7 필드), `120~132 행` sanitize 의 **명시 field pick**, `139 행` `async findAll()`.
- `prisma/schema.prisma` — `model LlmProviderConfig` (`id` / `provider` / `endpointUrl` / `apiKey` / `modelId` / `createdAt` / `updatedAt`) 와 `484~492 행` `model LlmDefaultProvider` (`onDelete: Restrict`).
- `test/e2e/difficulty-mappings.e2e-spec.ts` `60~135 행` — 본 slice 가 1:1 mirror 할 선행 패턴 (`createAuthenticatedE2EApp` 3 actor seed → `buildAuthCookie` → `afterEach` 정리 → 조회 200 / RBAC 케이스). 특히 `92~99 행` 의 `truncateAll` **뒤** 에 `llmProviderConfig.deleteMany()` 를 명시 호출하는 정리 순서.
- `test/helpers/auth-e2e-helper.ts` — `72 행` `AuthenticatedE2EContext`, `106 행` `buildAuthCookie`, `132 행` `createAuthenticatedE2EApp`.
- `test/helpers/db-truncate.ts` `48~57 행` — `TRUNCATE_TABLES` 8 개 명단에 **`LlmProviderConfig` · `LlmDefaultProvider` 가 없음** (그래서 명시 `deleteMany` 필요).

## Acceptance Criteria

- [ ] `test/e2e/llm-provider-configs.e2e-spec.ts` **신규 1 파일** 을 추가한다 (`src/` · `web/` · 기존 spec 무접촉).
- [ ] **happy-path 1+** — Admin 쿠키 + `prisma.llmProviderConfig.create` 로 config 2 건 seed 후 `GET /api/llm/providers` 가 200 · `content-type` JSON · 배열 길이 2 이고, 각 row 가 `id` / `provider` / `endpointUrl` / `modelId` / `createdAt` / `updatedAt` / `isDefault` **7 키를 모두 노출** 함을 검증.
- [ ] **보안 invariant (본 slice 의 핵심)** — 위 응답의 모든 row 에 대해 `expect(row).not.toHaveProperty("apiKey")` 이고, 응답 본문 문자열 전체에 seed 한 apiKey 원문이 **포함되지 않음** 을 검증 (ADR-0014 §3 never-read-back — `LlmProviderConfigView` 의 명시 pick 회귀 감지).
- [ ] **분기 1+ (빈 결과)** — config 0 건 상태에서 Admin 조회가 **200 + 빈 배열** 임을 검증 (service 가 404 로 변환하지 않는 raw forward 계약 고정).
- [ ] **분기 1+ (RolesGuard escalation)** — SuperAdmin 쿠키도 200 임을 검증 (`@Roles("Admin")` 의 상위 tier 통과).
- [ ] **negative 1+ (tier 미달)** — User 쿠키로 조회 시 **403**.
- [ ] **negative 1+ (인증 부재)** — `Cookie` 헤더 없이 조회 시 **401**.
- [ ] **negative 1+ (변조 자격증명)** — 유효하지 않은 JWT 문자열 쿠키로 조회 시 **401** (`JwtAuthGuard` 검증 분기).
- [ ] `afterEach` 정리는 `truncateAll(prisma)` **뒤에** 자식(`llmDefaultProvider`) → 부모(`llmProviderConfig`) 순서로 `deleteMany` 를 명시 호출한다 (두 table 은 `TRUNCATE_TABLES` 명단 밖이고, 역순 삭제는 `onDelete: Restrict` 에 걸려 실패한다).
- [ ] `pnpm lint && pnpm build && pnpm test` 전부 통과.
- [ ] `pnpm test:e2e` 통과 — 신규 spec 의 모든 케이스 green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 본 task 는 `src/` 무접촉이라 전역 coverage 수치 변동이 없어야 한다 (하락 시 원인 규명).
- [ ] diff ≤ 300 LOC · 파일 ≤ 5 개 (실제 1 파일). 케이스 주석이 길어져 300 LOC 을 넘길 것 같으면 **변조 자격증명 401 케이스를 Follow-ups 로 내리고** cap 안에 맞춘다.

## Out of Scope

- `GET /api/llm/providers/:id` **단건 조회 축** (200 view / 부재 id 404) — Follow-up slice (T-1960 → T-1961 분할 선례 동형).
- `isDefault` 파생 필드의 true/false 분기 검증 (`LlmDefaultProvider` 슬롯 seed 필요) — Follow-up slice.
- 쓰기 축 전부 — `POST /` (201 생성) · `PATCH /:id` · `DELETE /:id` (204 / 404 / 409) · `PUT /default` (200 재지정). 별도 slice.
- `src/` 코드 변경 일체 (controller · service · DTO · guard). 본 task 는 **기존 동작을 고정만** 한다. 결함을 발견하면 고치지 말고 `Follow-ups` 에 적는다.
- `docs/requirements.md` REQ status 재판정 · `docs/api.md` 갱신 (PLAN `183 행` — 구현 후 1 회 규칙).
- `test/perf/*` · `test/load/*` 신규 slice (PLAN `157 행` · `158 행` 오너 게이트).
- `web/` 배선 · 새 test helper 신설 (기존 `test/helpers/*` 재사용만).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups
