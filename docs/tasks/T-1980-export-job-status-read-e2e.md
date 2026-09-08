---
id: T-1980
title: export job 진행 조회 3 route (running · :id/status-view · :id) e2e 계약 spec 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-043, REQ-045]
estimatedDiff: 290
estimatedFiles: 1
dependsOn: []
touchesFiles: [test/e2e/export-job-status-read.e2e-spec.ts]
independentStream: export-job-read-e2e
created: 2026-09-08
plannerNote: P5 · PLAN 166 행 e2e 축 — export job polling 3 route 는 perf-spec(mock service·guard override)만 있고 실 부팅 왕복 e2e 0
---

# T-1980 — export job 진행 조회 3 route e2e 계약 spec 신설

## Why

PLAN [`166 행`](../PLAN.md) 의 E2E 시나리오 커버리지 축에서 **export job 진행 조회(status polling) 3 route 는 실 부팅 왕복 e2e 가 0** 이다. pre-check 실측(origin/main `3f9f5017`):

- `test/e2e/` 35 spec 중 `running` · `status-view` 문자열 히트 **0**(`import-restore-rejection.e2e-spec.ts` 의 지역 변수 `running` 4 건은 route 호출이 아님). export 계열 e2e 2 개는 `POST /api/admin/export`(생성) 와 `GET :id/download`(다운로드) 만 친다 — [`export-download.e2e-spec.ts`](../../test/e2e/export-download.e2e-spec.ts) `212`·`260 행`, [`export-scope-preview.e2e-spec.ts`](../../test/e2e/export-scope-preview.e2e-spec.ts).
- 구현은 이미 main 에 실재하므로 **미구현 신설이 아니라 계약 고정**이다 — [`export.controller.ts`](../../src/export/export.controller.ts) `183 행` `@Get("running")` · `464 행` `@Get(":id/status-view")` · `479 행` `@Get(":id")`, 모두 `@Roles("Admin")`.
- 기존 커버는 **perf-spec 뿐이고 계약을 잠그지 못한다** — [`test/perf/export-running-read.perf-spec.ts`](../../test/perf/export-running-read.perf-spec.ts) `1~40 행` 이 자인하듯 `ExportJobService` 를 `useValue` mock 으로 갈아끼우고 `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)` 로 가드를 무력화한다(latency 배선만 측정). `export-status-view-read.perf-spec.ts` 도 동형. 즉 **실 Postgres 왕복 · 실 RBAC · 실 route matching 은 어느 spec 도 통과시키지 않는다.**

e2e 로만 잡히는 축 3 개:

1. **route ordering** — `running` 과 `:id/status-view` 는 `:id` 동적 segment 보다 먼저 선언돼야 한다([`export.controller.ts`](../../src/export/export.controller.ts) `178~180`·`459~461 행` 주석이 스스로 근거를 적고 있다). 선언 순서가 뒤집히면 `GET /running` 이 `findJob("running")` 으로 흘러 **404** 가 된다 — mock/guard override perf-spec 은 route 하나만 부팅하므로 이 회귀를 절대 못 잡는다.
2. **Date 직렬화** — `ExportJob` 은 `createdAt`/`startedAt`/`finishedAt` 이 `DateTime`([`prisma/schema.prisma`](../../prisma/schema.prisma) `model ExportJob`)이라 실 HTTP 왕복에서만 ISO 문자열로 관찰된다.
3. **status 필터 · 파생 view 의 실 DB 결합** — [`export-job.service.ts`](../../src/export/export-job.service.ts) `298~300 행` 의 `where: { status: "RUNNING" }` 이 4 값 enum(`PENDING`/`RUNNING`/`SUCCEEDED`/`FAILED`) 중 하나만 남기는지, 그리고 [`JOB_STATUS_TO_VIEW`](../../src/export/export.controller.ts) `136~141 행` → [`describeExportJobStatus`](../../src/export/export-job-status-view.ts) `135 행` 파생값이 실 row 의 status 와 일치하는지는 실 row 가 있어야 관찰된다.

오너 게이트 미침범 실측 — PLAN [`157`](../PLAN.md)·[`158 행`](../PLAN.md)(신규 perf/load slice 금지): 본 task 는 `test/perf/`·`test/load/` 무접촉이다. [`182 행`](../PLAN.md)(과분할·helper 신설): 신설 helper **0** — 기존 [`test/helpers/auth-e2e-helper.ts`](../../test/helpers/auth-e2e-helper.ts)·[`test/helpers/db-truncate.ts`](../../test/helpers/db-truncate.ts) 만 재사용하고, 절단면을 route 1 개가 아니라 **읽기 축 3 route 전량**으로 잡아 잔여 slice 를 남기지 않는다. [`183 행`](../PLAN.md)(REQ 재판정 왕복): `docs/requirements.md` 무접촉 — 재판정은 머지 후 필요 시 1 회로 이월.

## Required Reading

- [`src/export/export.controller.ts`](../../src/export/export.controller.ts) — `136~141 행`(`JOB_STATUS_TO_VIEW` 4 값 매핑), `178~188 행`(`@Get("running")` + 선언 순서 근거), `459~471 행`(`@Get(":id/status-view")` → `findJob` 후 helper 파생), `474~484 행`(`@Get(":id")` raw forward + P2025 → 404).
- [`src/export/export-job.service.ts`](../../src/export/export-job.service.ts) — `286~292 행`(`findJob` = `findUniqueOrThrow`, 부재 시 404), `296~300 행`(`findRunning` = `where: { status: "RUNNING" }`, 매칭 0 이면 빈 배열).
- [`src/export/export-job-status-view.ts`](../../src/export/export-job-status-view.ts) — `26~29 행`(불변식: `downloadable ⟹ status==="ready"`, `terminal ⟺ status∈{ready,failed}`, `nextStatus===null ⟺ terminal`), `123~128 행`(4 status 별 `stepIndex`/`nextStatus`/`terminal`/`downloadable` 표), `135 행`(`describeExportJobStatus`).
- [`prisma/schema.prisma`](../../prisma/schema.prisma) — `model ExportJob`(필수 컬럼 `scope`·`requestedById`, nullable `startedAt`/`finishedAt`, `requestedBy` 관계 `onDelete: Restrict`) + `enum JobStatus`(`PENDING`/`RUNNING`/`SUCCEEDED`/`FAILED`).
- [`test/e2e/export-download.e2e-spec.ts`](../../test/e2e/export-download.e2e-spec.ts) — `59~65 행`(helper import + `BASE` 상수), `89~108 행`(`createAuthenticatedE2EApp` 다중 actor + `buildAuthCookie`), `118~135 행`(**actor 재 seed 패턴** — `truncateAll` 이 User 를 지우므로 `ExportJob.requestedById` FK 대상이 사라진다. `prisma.exportJob.deleteMany()` 를 truncate **앞**에 두고, truncate **뒤**에 원 `id`/`email`/`role` 로 `reseedActors()`. 이 순서를 어기면 Restrict FK 로 truncate 가 실패한다).
- [`test/e2e/assessment-evaluation-relative-comparison.e2e-spec.ts`](../../test/e2e/assessment-evaluation-relative-comparison.e2e-spec.ts) — 직전 slice(T-1979)의 e2e 계약 spec 서술 형식 · guard `it.each` · SuperAdmin 과차단 0 단언 패턴 참고본.

## Acceptance Criteria

신규 파일 **[`test/e2e/export-job-status-read.e2e-spec.ts`](../../test/e2e/export-job-status-read.e2e-spec.ts) 1 개만** 추가하고 아래를 모두 만족한다.

- [ ] **happy-path (R-112 (1))** — 실 Postgres 에 `ExportJob` row 를 직접 seed 한 뒤 3 route 각각 200 을 확인한다: (a) `GET /api/admin/export/running` 이 `RUNNING` job 을 배열로 반환(`id` 일치), (b) `GET /api/admin/export/:id/status-view` 가 `{ status, stepIndex, totalSteps: 3, nextStatus, terminal, downloadable }` 파생 view 반환, (c) `GET /api/admin/export/:id` 가 raw job(`id`·`status`·`scope`·`requestedById`) 반환.
- [ ] **분기 (R-112 (3))** — ① `running` 필터: `PENDING`·`SUCCEEDED`·`FAILED` job 을 함께 seed 해도 `RUNNING` 만 반환되고, `RUNNING` 이 0 건이면 404 가 아니라 **200 + `[]`**, 2 건이면 2 건 전부 반환. ② `status-view` 파생: 최소 `RUNNING`(`running`/`terminal:false`/`downloadable:false`) 와 `SUCCEEDED`(`ready`/`terminal:true`/`downloadable:true`) 두 status 를 각각 단언해 `export-job-status-view.ts` `26~29 행` 불변식이 실 왕복에서 성립함을 확인.
- [ ] **route ordering 고정** — `GET /running` 이 `:id` 로 포착되지 않음(404 아님 · 배열 본문)과 `GET /:id/status-view` 가 `:id` 로 포착되지 않음(raw job 이 아니라 파생 view 본문)을 각각 단언.
- [ ] **error path (R-112 (2))** — 존재하지 않는 id 로 `GET /:id` 와 `GET /:id/status-view` 를 호출하면 각각 **404**(P2025 → `NotFoundException`) 이고, 본문에 `apiKey`·SQL·스택 트레이스 같은 내부 정보가 누출되지 않는다.
- [ ] **negative (R-112 (4)) — 인증/권한 분기마다 1+** — 3 route × (토큰 없음 → 401, 위조/손상 토큰 → 401, `User` role actor → 403) 를 `it.each` 로 cover 하고, 401/403 응답 본문에 job 데이터가 실리지 않음을 단언. 추가로 `SuperAdmin` actor 가 3 route 전부 200 임을 단언해 **과차단 0**(RolesGuard escalation)을 확인.
- [ ] **read-only 계약** — 3 route 호출 전후로 `prisma.exportJob.count()` 와 seed 한 row 의 `status`·`finishedAt` 이 불변임을 단언(조회가 DB 에 쓰지 않음).
- [ ] `pnpm lint && pnpm build && pnpm test` green. `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% — 본 task 는 `src/` 0 LOC 변경이라 전역 coverage 불변이어야 한다).
- [ ] `pnpm test:e2e` green — 신규 suite 1 개가 실행 목록에 포함되고, 기존 e2e suite 는 하나도 깨지지 않는다(특히 `export-download` 와 같은 `ExportJob`/`User` 테이블을 쓰므로 `afterEach` 정리 순서를 위 Required Reading `118~135 행` 패턴 그대로 따를 것).
- [ ] diff ≤ 300 LOC · 파일 1 개(CLAUDE.md §3 cap).

## Out of Scope

- `src/` · `prisma/` · `web/` · `.github/workflows/` · `package.json` 변경 — 본 task 는 **test-only** 다. 구현 결함을 발견하면 고치지 말고 `Follow-ups` 에 적는다.
- `POST /api/admin/export`(생성) · `GET :id/download` · `describe-scope` · `preview-selection` 재검증 — 이미 기존 e2e 2 개가 cover.
- import 측 대칭 route(`GET /api/admin/import/running` · `modes` · `:id`) e2e — 별도 slice.
- `test/perf/` · `test/load/` 접촉(PLAN `157`·`158 행` 오너 게이트) 및 신규 test helper 신설(PLAN `182 행` — 기존 2 helper 재사용만).
- `docs/requirements.md` REQ status 재판정(PLAN `183 행` — 머지 후 1 회로 이월).
- job 실행 파이프라인(dump 생성 · chunk streaming · artifactRef) 검증 — 본 spec 은 조회 계약만.
- 케이스별 서술 주석은 1~2 줄로 제한한다(장문 머리 주석으로 cap 을 초과시키지 말 것).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음)
