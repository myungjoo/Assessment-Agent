---
id: T-1524
title: 실 DB round-trip perf-spec slice 13 — DifficultyMappingController 조회 route(nullable FK 3 슬롯 목록) p95 실측
phase: P7
status: IN_PROGRESS
commitMode: pr
prNumber: 1223
coversReq: [REQ-048]
estimatedDiff: 285
estimatedFiles: 2
created: 2026-08-07
independentStream: p7-perf-realdb-baseline
dependsOn: [T-1523]
touchesFiles:
  - test/perf/difficulty-mapping-read-realdb.perf-spec.ts
  - test/perf/README.md
plannerNote: "PLAN 142 행 잔여 ①(실측 endpoint 11 개) 을 열두 번째 도메인으로 확장 — 새 축은 nullable 관계형 FK 미조인 조회 + slice 11 부모의 자식 테이블(Restrict 정리 순서 강제) + schema 로 3 row 상한된 고정 슬롯"
---

# T-1524 — 실 DB round-trip slice 13 (DifficultyMappingController 조회 route)

## Why

[PLAN.md](../PLAN.md) `142 행` (R-92 조회 3초 이내) 의 잔여 절은 실 DB round-trip 실측 범위가
**endpoint 11 개(조회 route 21)** 뿐이고 나머지 read perf-spec **30 개** 는 여전히 service mock +
guard override(배선 latency) 임을 명시한다. slice 1~12 는 그 잔여를 endpoint 도메인 단위로 하나씩
좁혀 왔다(직전 slice 12 = [T-1522](T-1522-perf-realdb-slice12-import-modes-running-read.md), 그
doc-sync = [T-1523](T-1523-perf-realdb-slice12-doc-sync.md), main `c9db935a`). 본 task 는 같은 방식으로
**열두 번째 endpoint 도메인** 인 `DifficultyMappingController` 의 조회 route
`GET /api/llm/difficulty-mappings` 를 실 Prisma round-trip 으로 실측해 REQ-048(p95 < 3000ms) 의
실 DB 증거를 1 도메인 더 넓힌다(조회 route 21 → 22).

앞 slice 와 겹치지 않는 **새 구조 축 3 개** 를 고른 결과다:

1. **nullable 관계형 FK(`llmProviderConfigId String?`) 의 NULL / 비-NULL 혼재 + `include` 0 미조인 조회** —
   앞 12 slice 의 실측 대상 중 **관계형 FK 자체가 nullable 인 payload 축** 은 없었다(slice 10 의 `Json?` 2
   컬럼은 구조화 scalar, slice 12 의 `Int?` / `String?` 은 비-관계 scalar). 본 경로는 부모 row 가 실재해도
   `findMany()` 가 `include` 를 주지 않아 **join 0 · FK 는 문자열 컬럼으로만 직렬화** 된다.
2. **부모–자식 두 테이블이 각각 별도 slice 로 실측되는 첫 페어 + `onDelete: Restrict` 로 정리 순서가 강제되는
   첫 실 DB slice** — 부모 `LlmProviderConfig` 는 slice 11([T-1520](T-1520-perf-realdb-slice11-llm-provider-config-read.md),
   main `a3703964`)에서 이미 실측했고 본 slice 는 그 **자식** 을 잰다. 두 테이블 모두 `truncateAll` 명단
   밖이라 spec-local `deleteMany` 가 필요하고, `DifficultyMapping → LlmProviderConfig` **자식 먼저** 순서를
   지켜야 한다(역순은 `Restrict` 위반).
3. **schema 로 카디널리티가 상한된 고정 슬롯 테이블** — `@@unique([difficulty])` + easy/medium/hard 3 슬롯
   고정([ADR-0011](../decisions/ADR-0011-difficulty-model-assignment.md) §1)이라 결과 집합이 구조적으로
   3 을 넘을 수 없다. 앞 slice 의 대상은 모두 원리상 무한 증가 가능한 테이블이었으므로, **규모 민감도가
   schema 로 bounded 인 첫 실측 경로** 다.

`@Roles("Admin")` guard 레벨 403 은 slice 10·11·12 와 동일하므로 **새 축으로 주장하지 않는다**. 무필터 전량
`findMany()` 역시 slice 11 과 같아 새 축이 아니다(언급만).

## Required Reading

- [test/perf/llm-provider-config-read-realdb.perf-spec.ts](../../test/perf/llm-provider-config-read-realdb.perf-spec.ts) — 부모 테이블 slice 11. spec-local `deleteMany` + 실 JWT cookie + `truncateAll` 후 actor 재-seed 패턴의 직접 mirror 원본.
- [test/perf/import-read-realdb.perf-spec.ts](../../test/perf/import-read-realdb.perf-spec.ts) — 직전 slice 12. 최신 구조(측정 helper·negative 배치) 참조.
- [src/llm/difficulty-mapping.controller.ts](../../src/llm/difficulty-mapping.controller.ts) — 측정 대상 `@Get()` findAll(RBAC `@Roles("Admin")`, service raw forward).
- [src/llm/difficulty-mapping.service.ts](../../src/llm/difficulty-mapping.service.ts) · [src/llm/difficulty-mapping.repository.ts](../../src/llm/difficulty-mapping.repository.ts) — `findAllMappings` → `findMany()` (인자 0, `include` 0) 경로.
- [prisma/schema.prisma](../../prisma/schema.prisma) 의 `model DifficultyMapping` / `model LlmProviderConfig` — nullable FK · `@@unique([difficulty])` · `onDelete: Restrict`.
- [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) — `TRUNCATE_TABLES` 명단(두 대상 테이블 모두 **부재** — 수정하지 말 것).
- [test/perf/README.md](../../test/perf/README.md) 의 `## 실 DB round-trip baseline (slice 목록)` 과 `**잔여**` bullet — 본 task 가 갱신할 정본.

## Acceptance Criteria

- [ ] `test/perf/difficulty-mapping-read-realdb.perf-spec.ts` 신설 — mock override 0 으로 `AppModule` 을 부트스트랩하고 실 `PrismaService` 로 seed 한 뒤 `GET /api/llm/difficulty-mappings` 를 실 JWT cookie 로 측정한다(`collectLatencySamples` + `assertS2Threshold`, 임계 `DEFAULT_P95_MAX_MS = 3000` 그대로 사용).
- [ ] **happy-path** 1+ — Admin actor 목록 조회가 200 + seed 한 3 슬롯 전량 반환 + p95 < 3000ms pass.
- [ ] **error path** 1+ — 인증/인가 실패(401·403)에서 표본이 성공 표본으로 집계되지 않고 `failures` 로 분류됨을 단언.
- [ ] **분기 cover** 3 — (a) seed 0 건에서 빈 배열 200(404 아님), (b) FK 가 **NULL 인 슬롯과 비-NULL 인 슬롯이 한 응답에 공존** 하고 비-NULL 값이 seed 한 부모 config id 와 일치, (c) 부모 row 가 실재해도 응답 원소에 **중첩 관계 객체 키(`llmProviderConfig`) 부재**(`include` 0 · 미조인 SELECT 의 직접 증거).
- [ ] **negative cases 충분 cover** 4 — (a) Cookie 미부착 401, (b) 서명 변조 토큰 cookie 401(403 아님), (c) User tier actor 403(guard 레벨 · DB 미도달), (d) 자식 row 가 남아있는 상태에서 부모 `prisma.llmProviderConfig.deleteMany()` 가 `onDelete: Restrict` 로 거부됨(위 축 ② 정리 순서 계약의 negative 증거).
- [ ] 정리 규율 — `afterEach` 는 `prisma.difficultyMapping.deleteMany()` → `prisma.llmProviderConfig.deleteMany()` → `truncateAll(prisma)` 순서로 호출하고, `truncateAll` 이 `"User"` 를 지우므로 actor User 를 **원본 id 그대로** 재-seed 한다. `test/helpers/db-truncate.ts` 는 **수정하지 않는다**.
- [ ] 두 표본(예: FK 지정 슬롯 vs 미지정 슬롯, seed 0 건 vs 3 건)의 **대소 관계는 단언하지 않는다** — wall-clock 비결정성(slice 3 선례), 관찰 기록만.
- [ ] `test/perf/README.md` 에 `- **slice 13** — ...` bullet 추가 + `**잔여**` bullet 의 계수를 실검산으로 갱신(실측 endpoint 11 → **12**, 조회 route 21 → **22**, perf-spec 46 → **47**, read glob 41 → **42**, 실 DB 12 → **13**(read 11 → **12**), mock 잔존 **30 불변**). 계수는 추정이 아니라 실제 `ls test/perf` 결과로 검산할 것.
- [ ] `pnpm test:perf` 가 로컬 실 Postgres(`docker compose up -d postgres` + `DATABASE_URL` + `pnpm prisma migrate deploy`) 전제에서 통과하고, `pnpm lint && pnpm build && pnpm test` 도 통과.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — 본 task 는 `src/` 변경 0 이므로 coverage 수치가 흔들리지 않음을 확인.

## Out of Scope

- **production code · `prisma/schema.prisma` · 임계값(`DEFAULT_P95_MAX_MS`) 변경 0** — 본 slice 는 측정만 한다.
- `PATCH /api/llm/difficulty-mappings/:difficulty` (write 경로) 측정 — 본 slice 는 list read 만. 필요 시 별도 slice.
- 기존 mock 짝 spec [`difficulty-mapping-read.perf-spec.ts`](../../test/perf/difficulty-mapping-read.perf-spec.ts) 수정·삭제 — 배선 latency 측정 책임은 그대로 둔다(mock 잔존 30 불변의 근거).
- `test/helpers/db-truncate.ts` 의 `TRUNCATE_TABLES` 명단 확장 — spec-local `deleteMany` 로 흡수(slice 11 선례).
- `writeBaselineFile` / `confirmOrCompareBaseline` 로 baseline 파일 확정 — `buildBaselineReport` 한 줄 관찰 전용 유지(부하계획 §5 item 5 별도).
- `docs/PLAN.md` `142 행` · `docs/ops/load-resilience-test-plan.md` `§ 5` item 5 · `docs/requirements.md` REQ-048 doc-sync — 본 PR 머지 **후 별도 direct task**(slice 11·12 선례: T-1521 · T-1523). commitMode 혼합 금지(CLAUDE.md §3.1).
- REQ-047 실 scale(100~200명 / 50~100 repo) 부하 검증 — 본 slice 의 seed 는 상대 비교용 소규모 표본이다.
- 파일 2 개 · 300 LOC cap 준수 — spec 이 커지면 test 수를 줄이지 말고 주석을 압축한다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups
