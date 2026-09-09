---
id: T-1989
title: import job 조회 2 route e2e 계약 신설 + e2e census allowlist 소진
phase: P8
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-043, REQ-045]
estimatedDiff: 280
estimatedFiles: 2
dependsOn: [T-1985, T-1988]
touchesFiles:
  - test/e2e/import-job-read.e2e-spec.ts
  - test/smoke/route-e2e-coverage-census-drift.smoke-spec.ts
independentStream: e2e-route-coverage
created: 2026-09-09
plannerNote: PLAN 166 행 E2E 커버리지 — census 미커버 allowlist 2 건(import 조회)을 실 e2e 로 닫아 0 으로 소진
---

# T-1989 — import job 조회 2 route e2e 계약 신설 + e2e census allowlist 소진

## Why

[docs/PLAN.md](../PLAN.md) `166 행` "E2E 시나리오 커버리지" 축에서, T-1985 가 세운 route e2e census 는 전 route 89 개 중 **정확히 2 건**을 미커버로 남겨 두고 `realdb-perf-spec-covered` 태그로 이월했다 — `GET /api/admin/import/running` 과 `GET /api/admin/import/modes` 다. 이 둘의 유일한 근거는 service mock + guard override 로 route 하나만 부팅하는 [test/perf/import-detail-read-realdb.perf-spec.ts](../../test/perf/import-detail-read-realdb.perf-spec.ts) 이라 **실 HTTP 왕복 · 실 guard · 실 DB 결합이 한 번도 검증된 적이 없다**. 본 slice 는 두 route 의 실 왕복 e2e 를 신설해 그 이월분을 소진하고(미커버 2 → 0) allowlist 를 비운다. REQ-030(Import/Export) 의 조회 축 · REQ-043(전 기능 보호) 의 실 guard 축 · REQ-045(Admin 권한) 를 같은 spec 에서 고정한다.

**issue-still-relevant pre-check (origin/main `28ca18be` 실측)** — (1) `git ls-tree -r origin/main test/e2e | grep -i import` 결과는 `import-restore-http` · `import-restore-rejection` · `import-restore-transaction` 3 개뿐이고 조회 축 spec 은 없다. (2) `grep -rn "import/running\|import/modes" test/e2e/` 결과 **0 건** — 두 route 를 왕복하는 e2e 는 실재하지 않는다. (3) [test/smoke/route-e2e-coverage-census-drift.smoke-spec.ts](../../test/smoke/route-e2e-coverage-census-drift.smoke-spec.ts) `39~42 행` 의 `E2E_UNCOVERED_ALLOWLIST` 가 여전히 그 2 건을 담고 있고 T-1988 fire 가 미커버 2 건을 재확인했다. (4) main 최근 8 commit 중 `test/e2e` 를 건드린 것은 census 스캐너 리팩터 3 건(T-1986·T-1987·T-1988)과 다른 route 의 e2e 신설이라 본 의도와 겹치지 않는다. → **미해소 확인, 중복 아님.**

두 파일이 한 commit 이어야 하는 이유(§3 소비처 동반 의무) — e2e 를 추가하면 census 의 "미커버 집합 == allowlist 정확 일치" 단언이 **미달(stale allowlist)** 로 red 가 된다. 신설과 allowlist 소진은 분리 불가다.

## Required Reading

- [src/import/import.controller.ts](../../src/import/import.controller.ts) `344~377 행` — 대상 2 route (`@Get("running")` · `@Get("modes")`) 의 계약 · `@Get(":id")` 보다 먼저 선언된 ordering 근거 · `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`.
- [prisma/schema.prisma](../../prisma/schema.prisma) `689~706 행` — `ImportJob` 모델. `requestedById` 는 `User` 로의 `onDelete: Restrict` FK 이고 `@@index([status, createdAt])` 가 status polling 용이다.
- [test/e2e/export-job-status-read.e2e-spec.ts](../../test/e2e/export-job-status-read.e2e-spec.ts) — **본 slice 의 템플릿**(T-1980, 같은 형태의 job 조회 + RBAC e2e). 특히 `1~15 행` 헤더 근거 서술, `beforeAll` actor 3 종 구성, `afterEach` 의 "Restrict FK 때문에 job 을 먼저 비우고 truncate 뒤 actor 재-seed" 순서를 그대로 승계한다.
- [test/helpers/auth-e2e-helper.ts](../../test/helpers/auth-e2e-helper.ts) — `createAuthenticatedE2EApp` · `buildAuthCookie` · `reseedAuthenticatedActors` · `AuthenticatedE2EContext` 시그니처.
- [test/smoke/route-e2e-coverage-census-drift.smoke-spec.ts](../../test/smoke/route-e2e-coverage-census-drift.smoke-spec.ts) `35~43 행`(`MIN` · `E2E_UNCOVERED_ALLOWLIST`) · `134~146 행`(정확 일치 단언) · `248~262 행`(perf-spec 은 커버 근거 아님 단언) — 이번에 함께 고쳐야 하는 지점 전부.

## Acceptance Criteria

- [ ] **신설** — `test/e2e/import-job-read.e2e-spec.ts` 1 개를 만든다. mock override 0 · 실 Prisma · 실 guard(guard override 금지). 헤더 주석에 "왜 e2e 인가"(route ordering · 실 guard · 실 row 결합)와 T-1989 출처를 3~6 줄로 남긴다. **production(`src/`) 변경 0 LOC.**
- [ ] **happy-path 1+ (public symbol 별)** — ① `GET /api/admin/import/running` 이 Admin 쿠키로 200 + 배열을 돌려주고, `status: "RUNNING"` 인 `ImportJob` row 를 seed 하면 그 `id` 가 응답에 포함된다. ② `GET /api/admin/import/modes` 가 200 + 원소 2 개(`REPLACE` 축 `destructive: true` / `MERGE` 축 `destructive: false`)를 돌려준다. ③ SuperAdmin 쿠키로도 두 route 가 200(상위 tier 과차단 0).
- [ ] **error path 1+** — 쿠키 없이 호출하면 두 route 모두 401 이고 body 에 job 데이터가 새지 않는다. 그리고 인접 route 의 오판정 계약 — `GET /api/admin/import/running` 이 `findJob("running")` 으로 흘러 404 가 되지 **않음**을 200 응답으로 고정한다(`modes` 도 동일). ordering 이 뒤집히면 red 가 되어야 한다.
- [ ] **분기별 1+** — `findRunning` 의 실 DB 분기 각각: (a) `ImportJob` row 0 건 → 200 + 빈 배열(404 변환 0) (b) `RUNNING` row 1 건 → 그 1 건만 (c) `RUNNING` + 비-`RUNNING`(예: `PENDING` · `SUCCEEDED`) 혼재 → `RUNNING` 만 걸러진다.
- [ ] **negative case 를 예외 분기마다 1+** — RBAC 예외 분기를 route × actor 행렬로 `it.each` 하나에 묶어 각 1+: (1) `User` 쿠키 → 403 (2) 쿠키 부재 → 401 (3) 변조 JWT 쿠키 → 401. 두 route 모두에 적용해 총 6 케이스. 403/401 응답 body 에 `ImportJob` 필드(`artifactRef` 등)가 포함되지 않음도 1+ 단언.
- [ ] **직렬화 축 1+** — `running` 응답의 `createdAt` 이 실 HTTP 왕복에서 ISO 문자열로 관찰되고 `Date` 객체가 아니다(`typeof === "string"`).
- [ ] **정리 순서** — `afterEach` 는 `ImportJob → User` 의 `Restrict` FK 때문에 `truncateAll` **앞**에 `importJob` 을 비우고, **뒤**에 `reseedAuthenticatedActors` 로 원 `id` 를 유지한 채 actor 를 복원한다(JWT `sub` 유지). 이 순서가 어긋나면 FK 위반으로 red 가 된다.
- [ ] **census allowlist 소진** — [route-e2e-coverage-census-drift.smoke-spec.ts](../../test/smoke/route-e2e-coverage-census-drift.smoke-spec.ts) 에서 `E2E_UNCOVERED_ALLOWLIST` 를 **빈 배열**로 만들고, `134~146 행` 단언을 "실측 미커버 0 건"으로 바꾼다(양방향 비교 형태 · 자기검증 성격은 유지). 미사용이 된 `REASON` 상수는 지운다(lint red 방지).
- [ ] **census 재기준선** — `MIN` 을 실측값으로 갱신한다(`e2eSpecs` 38 → 39, `covered` 87 → 89 예상). **실측이 예상과 다르면 예상값을 쓰지 말고 실측을 따르고**, 그 차이를 `## Follow-ups` 에 적는다. `controllers` 23 · `routes` 89 는 불변이어야 한다.
- [ ] **perf-spec 비-근거 계약 보존** — `248~262 행` 의 "e2e 가 아닌 파일(perf-spec · unit spec)은 커버 근거로 세지 않는다" it 은 allowlist 에 의존하지 않는 형태로 고쳐 **의미를 유지**한다(두 route label 을 직접 지정해 `isCoveredBy(route, perfSource) === true` 이면서도 `e2eFiles()` 에 perf 가 없음을 고정). 이 it 을 통째로 삭제하지 않는다.
- [ ] **census 헤더 갱신** — `1~10 행` 의 "allowlist 2 건은 … 이월분이다" 서술이 거짓으로 남지 않게 현행 사실(미커버 0 · T-1989 가 소진)로 고친다.
- [ ] `pnpm lint && pnpm build && pnpm test` green. `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — `src/` 0 LOC 변경이라 전역 coverage 는 불변이어야 한다.
- [ ] `pnpm test:smoke` 에서 census 2 suite 가 모두 PASS 하고, guard 축 spec([route-auth-guard-coverage-census-drift.smoke-spec.ts](../../test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts))은 **무접촉**이다. `pnpm test:e2e` 에서 신설 spec PASS. CI 의 `smoke test` · `e2e test` leg green 확인(R-113).
- [ ] **cap 준수** — 합계 diff ≤ 300 LOC / 파일 ≤ 5 개(실제 2 개)를 유지한다. 초과가 보이면 항목을 버리지 말고 RBAC · 분기 it 을 `it.each` 로 더 묶고 헤더 주석을 줄인다.

## Out of Scope

- **guard 배선 금지** — guard 축 census 의 `KNOWN_GAP_REQ_043` 20 건(groups · parts · persons)에 `@UseGuards` 를 다는 일. auth 변경은 CLAUDE.md §5 오너 승인 대상이며 본 slice 와 무관하다.
- `src/import/` 의 어떤 파일도 수정하지 않는다 — 이미 머지된 route 의 계약 고정 전용이다. 결함을 발견하면 고치지 말고 `## Follow-ups` 에 적는다.
- `GET /api/admin/import/:id` · `POST /api/admin/import` · `POST /api/admin/import/preview` 의 신규 e2e 추가(이미 커버 — 기존 import-restore 3 spec 소관).
- T-1988 `## Follow-ups` 의 매칭기 추가 정밀화(동적 시작 chain 앵커 · e2e builder 인라인)는 별도 slice — 본 slice 는 `isCoveredBy` 본문을 건드리지 않는다.
- guard 축 census spec · [test/helpers/route-census.ts](../../test/helpers/route-census.ts) 수정, 새 helper 신설, 새 외부 dependency.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups
