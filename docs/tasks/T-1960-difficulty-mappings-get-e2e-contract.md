---
id: T-1960
title: GET /api/llm/difficulty-mappings e2e 계약 spec 신설 (조회 · RBAC 축)
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-050, REQ-049]
estimatedDiff: 220
estimatedFiles: 1
created: 2026-09-07
independentStream: difficulty-mapping-e2e-contract
dependsOn: []
touchesFiles: [test/e2e/difficulty-mappings.e2e-spec.ts]
plannerNote: "P4 REQ-050 — 요구표가 스스로 적은 'test/e2e/ difficulty-mappings 참조 0' 공백을 조회 축 계약 spec 1 파일로 닫는다 (T-1958 동형)"
---

# T-1960 — GET /api/llm/difficulty-mappings e2e 계약 spec 신설 (조회 · RBAC 축)

## Why

[docs/PLAN.md](../PLAN.md) `86 행` (R-97 3 가지 난이도 모델 할당) 의 슬롯 매핑 backbone 은 main 에 전량 실재하지만, [docs/requirements.md](../requirements.md) `69 행` REQ-050 row 가 스스로 한계로 적어 둔 문장 — **"`test/e2e/` 의 difficulty-mappings 참조도 0 이라 … 실경로 검증이 unit 밖에 없다"** — 이 아직 참이다. 즉 3 슬롯 조회의 HTTP 계약(RBAC tier · seed 전 빈 배열이 404 가 아니라는 [ADR-0011](../decisions/ADR-0011-difficulty-model-assignment.md) `§3` 함의)이 실 DB 왕복으로 고정된 적이 없다. 본 task 는 그 공백 중 **조회(GET) 축** 을 e2e 계약 spec 1 파일로 닫는다. 직전 머지된 [T-1958](T-1958-schedules-backfill-e2e-contract.md) (backfill endpoint e2e, PR #1537 → main `742bd62d`) 과 동형 slice 다.

**오너 지시 게이트 판정 (4 종 전부 평가)**

- PLAN `157 행` (🔴🔴 R-91 k6 최우선) — **본 task 와 무충돌**. 그 chain 의 잔여는 `§5` 잔여 ①(실 수집 왕복 0) 뿐이고, [load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3` 의 `실 수집 왕복 해소 경로 판단 (사전 박제, T-1706)` 이 후보 3 종에 조건을 기계 대입해 **`자율 집행 채택` 0 건 · ㉠ 은 사람 승인 대기** 로 결론냈다. 따라서 planner 가 지금 자율로 큐잉할 수 있는 k6 slice 는 **존재하지 않으며**, 본 task 는 `test/load/` · `.github/workflows/load-k6.yml` 무접촉이다.
- PLAN `158 행` (🟡 R-92 per-route perf baseline churn 중단) — **미저촉**. 금지 대상은 `test/perf/*.perf-spec.ts` 신규 per-route baseline slice 이고, 본 task 는 `test/e2e/` 의 **기능 계약** spec 이다(측정·임계 0). `test/perf/difficulty-mapping-read.perf-spec.ts` 는 무접촉으로 둔다.
- PLAN `182 행` (소비처 동반 의무) — **미저촉이며 절단면도 적법**. helper · factory 신설이 0 이라 "소비처 없는 helper 단독 PR" 유형이 아니다. GET 축 / PATCH 축으로 나눈 절단면은 **diff 크기가 아니라 endpoint 단위**이고, GET 슬라이스만으로 그 endpoint 의 분기(401 · 403 · 빈 배열 200 · seed 후 200)가 **전부** 닫힌다.
- PLAN `183 행` (REQ 재판정 once-rule) — **본 task 는 재판정 task 가 아니다**. REQ-050 의 실 미충족(항목→난이도 결정 규칙 축)은 본 e2e 로 닫히지 않으므로 재판정 slice 를 만들지 않으며, 구현 전 판단은 본 `Why` 로 대신한다.

**issue-still-relevant pre-check (origin/main `ad7025c8` 실측)**

- `git grep -n "difficulty-mappings" origin/main -- test/` → 히트는 `test/perf/README.md` · `test/perf/difficulty-mapping-read*.perf-spec.ts` **뿐**이고 `test/e2e/` 히트 **0**. `git ls-tree --name-only origin/main test/e2e/` 30 파일에도 difficulty 관련 spec **없음**.
- 대상 route 는 main 에 실재 — `src/llm/difficulty-mapping.controller.ts` `58 행` `@Controller("api/llm/difficulty-mappings")` + `75 행` `@Get()` + `92 행` `@Patch(":difficulty")`, 둘 다 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`.
- 중복 의도 task 없음 — `docs/tasks/` 최신 ID 는 T-1959 이고 T-1955~T-1959 는 ADR-0064 알고리즘·연구 축 / REQ-027 backfill 축으로 본 주제와 무관. 따라서 **부분 안착 0 · 완전 안착 0** 으로 본 task 는 유효하다.

## Required Reading

- [src/llm/difficulty-mapping.controller.ts](../../src/llm/difficulty-mapping.controller.ts) `58~82 행` — 경로 prefix · `@Get()` · RBAC decorator · "seed 전 빈 배열도 정상 결과(404 변환 안 함)" 주석.
- [src/llm/difficulty-mapping.service.ts](../../src/llm/difficulty-mapping.service.ts) `136 행` `findAllMappings` — raw forward 계약(정렬·건수 보정 없음).
- [prisma/schema.prisma](../../prisma/schema.prisma) `441~455 행` `model DifficultyMapping` — `difficulty String` · `llmProviderConfigId String?` (nullable FK, `onDelete: Restrict`) · `@@unique([difficulty])`, 그리고 `406~423 행` `model LlmProviderConfig` 의 필수 필드(`provider` · `endpointUrl` · `apiKey` · `modelId`).
- [src/llm/difficulty.ts](../../src/llm/difficulty.ts) `20~30 행` — `Difficulty` union 3 값 + `DIFFICULTIES` 배열.
- [test/e2e/schedules-backfill.e2e-spec.ts](../../test/e2e/schedules-backfill.e2e-spec.ts) `1~75 행` — 본 task 가 1:1 mirror 할 구조(헤더 주석 책임 서술 · `createAuthenticatedE2EApp` 다중 actor seed · `buildAuthCookie` · `afterEach(truncateAll)` · `afterAll(close + $disconnect)`).
- [test/e2e/unevaluated-fill-run.e2e-spec.ts](../../test/e2e/unevaluated-fill-run.e2e-spec.ts) `42~46 행` 과 `123 행` · `133~134 행` — `LlmProviderConfig` 가 `truncateAll` 명단에 **없어** `deleteMany` 로 직접 정리해야 한다는 선례.
- [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) `44~56 행` `TRUNCATE_TABLES` 8 테이블 명단 — `DifficultyMapping` · `LlmProviderConfig` **미포함** 확인용.
- [docs/decisions/ADR-0011-difficulty-model-assignment.md](../decisions/ADR-0011-difficulty-model-assignment.md) `47~64 행` — §1 3 슬롯 고정 · §2 FK 참조 · §3 fail-fast.

## Acceptance Criteria

- [ ] 신규 파일 `test/e2e/difficulty-mappings.e2e-spec.ts` **1 개만** 추가한다. `src/` · `web/` · `prisma/` · `test/helpers/` · `test/perf/` · `test/load/` · `package.json` · 워크플로 diff **0**.
- [ ] **happy-path** — `LlmProviderConfig` 1 건과 `DifficultyMapping` 3 슬롯(`easy` · `medium` · `hard`; 그 중 2 건은 위 config 로 FK 지정, 1 건은 `llmProviderConfigId: null`)을 seed 한 뒤 Admin 쿠키로 `GET /api/llm/difficulty-mappings` 호출 시 **200** + 배열 길이 **3**, `difficulty` 값 집합이 `easy`/`medium`/`hard` 와 정확히 일치, 각 원소가 `id` · `difficulty` · `llmProviderConfigId` · `createdAt` · `updatedAt` key 를 노출함을 단언.
- [ ] **error path** — 쿠키 없이 호출 시 **401** 이고 body 가 슬롯 데이터를 노출하지 않음을 단언(인증 실패가 빈 배열 200 으로 뭉개지지 않는다).
- [ ] **분기 cover** — (i) 슬롯 row **0 건** 상태(seed 전)에서 Admin 호출 시 **200 + `[]`** 이며 404 가 **아님**을 단언([ADR-0011](../decisions/ADR-0011-difficulty-model-assignment.md) `§3` fail-fast 는 슬롯 조회가 아니라 resolve 경로의 계약이라는 사실 고정), (ii) FK 가 `null` 인 슬롯도 200 응답에 포함되어 `llmProviderConfigId === null` 로 그대로 노출됨을 단언(service 가 미설정 슬롯을 걸러내지 않는다).
- [ ] **negative case** — (i) `User` 등급 actor 쿠키로 호출 시 **403** (Admin+ tier 미달), (ii) `SuperAdmin` actor 쿠키로 호출 시 **200** (RolesGuard escalation 통과 — 403 로 과차단되지 않음), (iii) 401 · 403 경로의 응답 body 에 `difficulty` 문자열이 등장하지 않음(권한 실패 시 데이터 누출 0).
- [ ] **격리** — `afterEach` 에서 `truncateAll(prisma)` 에 더해 `prisma.difficultyMapping.deleteMany()` → `prisma.llmProviderConfig.deleteMany()` **순서로** 직접 정리한다(FK `onDelete: Restrict` 라 역순은 실패). 두 테이블이 `TRUNCATE_TABLES` 명단에 없다는 근거를 헤더 주석에 1 줄로 남긴다. `test/helpers/db-truncate.ts` 는 **수정하지 않는다**.
- [ ] `pnpm lint && pnpm build && pnpm test` green. `pnpm test:cov` 가 line ≥ 80% / function ≥ 80% 게이트를 계속 통과(`src/` 변경 0 이라 회귀 0). e2e 는 실 DB 필요 — 로컬 `DATABASE_URL` 부재 시 CI 의 `pnpm test:e2e`(R-113) green 으로 확인한다.
- [ ] 총 diff **≤ 300 LOC / 1 파일** 유지. 헤더 주석은 20 행 이내로 쓰고, 초과가 예상되면 케이스를 합치지 말고 주석을 줄인다.

## Out of Scope

- **`PATCH /api/llm/difficulty-mappings/:difficulty` 축 일체** — 400(미지원 난이도) · 400(DTO 검증) · 404(config 부재) · 404(슬롯 부재 P2025) · 403 · 200 재지정 6+ 케이스는 같은 파일에 **add-only** 로 얹는 후속 slice 소관이다(합치면 cap 300 LOC 초과 예상).
- `src/llm/` 의 controller · service · repository 동작 수정(정렬 보장, 3 슬롯 자동 seed, 빈 배열 → 404 변환 등) — 본 task 는 **현행 계약 고정**만 한다.
- REQ-050 의 실 미충족인 **항목→난이도 결정 규칙** 설계 · ADR 신설 · `classifyNarrative` 변경, 그리고 `options.difficulty` 미주입(ADR-0032 `56 행` 서술과의 drift) 해소 — 별도 설계 arc.
- `prisma/` seed script 신설(3 슬롯 seed 자동화) — DB 초기 데이터 경로는 별건.
- `docs/requirements.md` REQ-050 row 재판정 · `docs/use-cases/REQ-COVERAGE-AUDIT.md` 계수 갱신 — PLAN `183 행` once-rule 상 본 e2e 로는 REQ 가 충족되지 않으므로 **재판정 task 를 만들지 않는다**.
- `test/helpers/db-truncate.ts` 의 `TRUNCATE_TABLES` 에 테이블 추가 — 그 상수를 감시하는 spec 동반 수정을 강제해 파일 cap 을 위협한다(Q-0054 선례와 동형 위험).
- `scripts/daily-test.sh` leg 추가 · `test/perf/` · `test/load/` · k6 관련 일체 무접촉(PLAN `157`·`158 행`).
- 실 LLM 호출 · 실 네트워크 왕복 — 본 spec 은 DB + HTTP 계약만 다루므로 gateway 를 건드리지 않는다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 append 한다.)
