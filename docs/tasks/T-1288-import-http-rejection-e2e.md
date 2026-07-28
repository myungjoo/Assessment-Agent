---
id: T-1288
title: import 업로드 거부 경계 e2e (401 / 403 / 400 / 409, 실행 slice 3c-3d2)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 280
estimatedFiles: 1
created: 2026-07-28
completedAt: 2026-07-28T17:51:48Z
prNumber: 1179
independentStream: import-restore-engine
dependsOn: [T-1287]
touchesFiles:
  - test/e2e/import-restore-rejection.e2e-spec.ts
plannerNote: "cap-bend 없음: R-112 backbone x1.5 = 280 LOC / 1 파일 (cap 안). T-1287 Follow-up 3c-3d2 — 거부 경계 e2e, export 왕복 helper 불요"
---

# T-1288 — import 업로드 거부 경계 e2e (401 / 403 / 400 / 409, 실행 slice 3c-3d2)

## Why

[T-1287](T-1287-import-restore-http-e2e.md) (PR #1178 squash `d4b7bc56`) 이 실행 slice **3c-3d1** 로 `POST /api/admin/import` 의 **성공 경로 + dump 파싱 실패** 를 실 PostgreSQL 왕복으로 박제했다. 그러나 그 spec 은 actor 를 Admin 1 종만 seed 하고 항상 파일을 첨부하므로, controller 가 실제로 **거부해야 하는 경계** — 미인증 401 · User actor 403 · 파일 누락 400 · 진행 중 import 충돌 409 — 는 여전히 mock 경계 (`import.controller.spec.ts`) 에서만 검증돼 있다. 실 guard stack (`JwtAuthGuard` + `RolesGuard`) 과 `FileInterceptor` 조립이 HTTP 경계에서 정말 그렇게 동작하는지, 그리고 거부 시 **DB 가 전혀 변하지 않는지** 를 증명한 test 는 0 이다.

본 slice 는 T-1287 Follow-ups 가 예고한 **3c-3d2** 를 실행해 그 구멍을 닫는다 (R-113 — unit 외 end-to-end CI 수행). 핵심 계약은 두 가지다: (a) 거부는 `ImportJob` row 를 만들지 않거나 (guard / 파일 검증 단계) 새 row 를 추가하지 않고 (409), (b) 어떤 거부 경로에서도 Group / Person row 수가 불변이다 (복원 `$transaction` 미도달 — UC-07 §7.4). 이로써 REQ-045 (Admin 전용) 가 실 HTTP 경계 사실로, REQ-030 / REQ-032 의 "거부 시 DB 변경 0 · raw 미저장" 이 실 DB 사실로 박제된다.

**estimate 근거** — 신규 spec 1 파일. 파일 머리 주석 (실 DB 전략 · actor 3 종 seed 근거 · RUNNING job 직접 seed 근거 · 413 제외 사유) ~50, import + describe scaffolding (`createAuthenticatedE2EApp` 3 actor · `afterEach` 정리 · `reseedAuthenticatedActors`) ~60, helper (`uploadAs` / `counts` / `seedRunningImportJob`) ~40, test 6~7 종 ~130 → **~280 LOC / 1 파일** (cap 300 안, `sizeExempt` 불요). R-112 backbone × 1.5 카테고리, 선례 [T-1287](T-1287-import-restore-http-e2e.md) 실측 270 LOC. 본 slice 는 export→download 왕복 helper 가 **불필요** (거부는 dump 내용에 무관) 해 T-1287 보다 helper 가 가볍다.

## Required Reading

- [src/import/import.controller.ts](../../src/import/import.controller.ts) 의 `create()` 데코레이터 stack 과 본문 — 라우트가 `POST /api/admin/import`, multipart field 이름은 **`file`**, `mode` 는 form field. `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` 가 `FileInterceptor` **보다 먼저** 실행되므로 401 / 403 은 파일 파싱 전에 차단되고 `createJob` 미도달 → job row 0. 파일 누락 시 `BadRequestException(400)` 이 controller 자체 분기 (createJob · runJob 둘 다 미호출). **0 수정**.
- [src/import/import-job.service.ts](../../src/import/import-job.service.ts) 의 `createJob` / `deriveRaceState` (73~132 행) — RUNNING import job 이 1+ 면 `evaluateImportRaceGuard` verdict 가 blocking 이 되어 `ConflictException(409)` 이고 **`prisma.importJob.create` 미도달**. race 경과 산출 기준은 가장 오래된 RUNNING job 의 `startedAt ?? createdAt` 이라, 409 를 재현하려면 seed 한 RUNNING job 의 `startedAt` 이 **현재 시각 근처** 여야 한다 (오래된 값은 helper timeout 분기로 흘러 blocking 이 아닐 수 있다). 409 message 는 headline + detailLines 를 `" / "` 로 결합한 사람-친화 문자열 (raw stack 미포함). **0 수정**.
- [test/e2e/import-restore-http.e2e-spec.ts](../../test/e2e/import-restore-http.e2e-spec.ts) 전체 (T-1287, 270 줄) — 본 spec 이 mirror 할 뼈대: 머리 주석 형식 · `createAuthenticatedE2EApp` / `buildAuthCookie` · `afterEach` 의 `importJob.deleteMany()` → `exportJob.deleteMany()` → `truncateAll` → **`reseedAuthenticatedActors`** 순서 · `uploadDump` 의 `.field("mode", ...)` + `.attach("file", buffer, "dump.json")` 패턴. **0 수정** (본 task 는 별도 파일 신설).
- [test/helpers/auth-e2e-helper.ts](../../test/helpers/auth-e2e-helper.ts) 의 `createAuthenticatedE2EApp(SeedUserInput[])` — `role` 은 `"SuperAdmin" | "Admin" | "User"` 3 종이고 `ctx.tokens[email]` / `ctx.users[email]` 가 email key 로 노출된다. `reseedAuthenticatedActors(ctx)` 는 **원본 id / email / role 그대로** 재삽입 (JWT sub claim 유효 유지). **0 수정**.
- [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) 의 `TRUNCATE_TABLES` 7 종 — `ImportJob` / `ExportJob` 는 **미포함** 이라 명시 `deleteMany` 가 선행돼야 하고 (`requestedById → User` 가 `onDelete: Restrict`), `truncateAll` 이 actor User 를 지우므로 actor 재 seed 가 의무다 (선례 T-0520 round 2). **0 수정**.
- [prisma/schema.prisma](../../prisma/schema.prisma) 의 `model ImportJob` (`status` / `mode` / `startedAt` / `requestedById`) — RUNNING job 직접 seed 시 채워야 할 필드의 source.

## Acceptance Criteria

- [ ] 신규 파일 **1 개만** 추가한다: `test/e2e/import-restore-rejection.e2e-spec.ts`. `src/**` · `web/**` · `prisma/**` · `deploy/**` · `scripts/**` · `package.json` · `test/jest-e2e.json` · 기존 `test/e2e/**` · `test/smoke/**` · `test/perf/**` **0 수정** (`testRegex` 가 새 파일을 자동 picking 하므로 config 변경 불요).
- [ ] **actor seed** — `createAuthenticatedE2EApp` 에 `Admin` + `User` 2 종을 명시 email 로 seed 하고, 각 cookie 를 `buildAuthCookie` 로 만든다. 업로드는 `uploadAs(cookie?, opts)` helper 1 개로 통일한다 (cookie 미지정 = 미인증, `attach` 생략 = 파일 누락). 업로드 본문은 **작은 고정 Buffer** 면 충분하다 — 거부 경로는 dump 내용을 읽지 않으므로 export→download 왕복을 만들지 **않는다**.
- [ ] **happy 항목 (권한 통과 경로가 실제로 진입한다)** — Admin cookie + 파일 첨부 요청이 401 / 403 / 400 으로 막히지 않고 controller 본문에 도달함을 증명한다: 응답이 **400 (dump 파싱 실패)** 이고 실 DB 의 `ImportJob` row 가 **정확히 1 건** 생성돼 `status === "FAILED"` 다 (guard + 파일 검증 통과 → `createJob` 도달 → runner 실행의 외부 증거). 성공 복원 왕복은 T-1287 이 이미 cover 하므로 반복하지 않는다.
- [ ] **error path — 미인증 401 1+** — cookie 없이 파일을 첨부해 요청하면 (a) 응답 **401**, (b) `ImportJob` row 수 **0** (createJob 미도달), (c) Group / Person row 수 요청 전과 동일.
- [ ] **error path — User actor 403 1+** — User cookie + 파일 첨부 요청이 (a) 응답 **403**, (b) `ImportJob` row 수 **0**, (c) Group / Person row 수 불변 (REQ-045 Admin 전용).
- [ ] **분기 cover — 409 진행 중 충돌 양쪽** — (i) `prisma.importJob.create` 로 `status: "RUNNING"` + `startedAt: new Date()` + `requestedById: ctx.users[ADMIN_EMAIL].id` job 1 건을 직접 seed 한 뒤 Admin 업로드 → 응답 **409**, `ImportJob` row 는 여전히 **1 건** (seed 한 RUNNING 것뿐 — 새 row 미생성), Group / Person row 수 불변, 응답 message 에 stack trace · 업로드 raw 본문이 없다. (ii) 같은 요청을 RUNNING job 이 **없는** 상태에서 보내면 409 가 아니라 (dump 가 손상돼) **400** 이고 job row 가 1 건 생성된다 — race guard 분기의 반대편이 실제로 통과함을 확인.
- [ ] **negative cases 충분 cover** — 예외 상황마다 1+: (a) 파일 누락 (`attach` 없이 `.field("mode","REPLACE")` 만) Admin 요청 → **400** + `ImportJob` row **0** (controller 자체 분기라 createJob 미도달) + Group / Person 불변, (b) 미인증 요청은 **파일 누락 여부와 무관하게 401** (guard 가 파일 검증보다 먼저임 — cookie 없이 `attach` 도 없는 요청이 400 이 아니라 401), (c) 거부 응답 body 에 업로드 raw 본문 sentinel 문자열이 **포함되지 않는다** (REQ-032 회귀 — 고정 sentinel 로 단언), (d) 409 거부 후에도 seed 한 RUNNING job 의 `status` / `startedAt` 이 변경되지 않는다 (거부가 기존 job 을 건드리지 않음).
- [ ] **정리 규율** — `afterEach` 는 `importJob.deleteMany()` → `exportJob.deleteMany()` → `truncateAll(prisma)` → **`reseedAuthenticatedActors(ctx)`** 순으로 수행한다 (FK `onDelete: Restrict` + actor User 재삽입, T-1287 과 동일). `afterAll` 에서 `app.close()` + `prisma.$disconnect()`.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 본 e2e 는 CI 의 `pnpm test:e2e` step 에서 실행되며 (로컬 `DATABASE_URL` 부재 시 미실행), PR CI 의 e2e leg 가 green 이어야 한다.
- [ ] `prettier --check` 통과, `scripts/check-spec-presence.sh` 통과. 파일 머리에 **한국어 주석** (§12) 으로 실 DB 전략 · actor 2 종 seed 근거 · RUNNING job 직접 seed 근거 (`startedAt` 을 현재 시각으로 두는 이유) · 413 제외 사유를 박제한다.
- [ ] **diff 규율** — **총 diff ≤ 300 LOC / 1 파일** (cap 그대로, `sizeExempt` 없음). 초과가 예상되면 negative (d) → (c) 순으로 덜어내고 그 사실을 PR body + 본 task Follow-ups 에 박제한다. 그래도 초과면 멈추고 planner 에게 split 을 요청한다 (BLOCKED `task-too-large`).
- [ ] **엔진 · guard 결함 발견 시 수정 금지** — 거부 경계 검증 중 controller / guard / race guard 결함 (예: 401 이어야 할 요청이 400, 409 가 안 잡힘) 이 드러나면 `src/**` 를 고치지 말고 재현 조건을 Follow-ups 에 기록한 뒤 BLOCKED 로 종료한다 (planner 가 patch slice 를 큐잉).

## Out of Scope

- **크기 상한 413 e2e 0** — `MAX_IMPORT_FILE_SIZE_BYTES` (50 MiB) 초과 업로드는 (i) 50 MiB 버퍼 할당 + 전송 비용, (ii) multer 가 상한 도달 시 stream 을 중단해 supertest 쪽이 `ECONNRESET` / `EPIPE` 로 깨질 수 있는 알려진 flakiness 표면 때문에 별도 slice **3c-3d3** 으로 분리한다 (Follow-ups 예고). 본 slice 는 근처에 가지 않는다.
- **성공 복원 왕복 재검증 0** — export→download→import 왕복 · `restoredRowCount` · row 부활 단언은 T-1287 소유. 본 spec 은 그 helper 를 복제하지 않는다.
- **`MERGE` mode semantics 검증 0** — mode 별 복원 의미는 별도 slice.
- **`src/**` 수정 0** — controller · guard · job service · runner · restore service 전부 불변 (위 Acceptance 마지막 항목).
- **`deploy/daily-test.sh` leg 추가 0** — leg 를 늘리면 drift-guard smoke spec 3 종 (T-0791 / T-0944 / T-0947) 동반 수정이 강제돼 파일 수 cap 을 넘긴다 (MEMORY: daily-test leg drift-guard parity, Q-0054 / T-1122 BLOCKED 선례). 신규 e2e 파일은 `test/jest-e2e.json` 의 `testRegex` 가 자동 picking 하므로 leg 추가 자체가 불요다.
- **`test/perf/**` 수정 0** — 본 task 는 DI 를 확장하지 않으므로 `controllers: [ImportController]` 조립 parity 갱신 대상 0.
- **비동기 job 전환 · 진행률 polling · 재시도 · 관측 metric · Prisma schema/migration · 새 외부 dependency · 새 ADR 0** — 전부 본 slice 밖 (본 e2e 는 ADR-0055 §Follow-up (b) 안의 검증 실행이다).
- **`web/` UI 수정 0**.

## Suggested Sub-agents

`tester → implementer` (본 task 는 test-only — tester 가 spec 작성·실행까지 맡고, implementer 는 호출하지 않아도 무방하다)

## Follow-ups

- (예고) 실행 slice **3c-3d3** — 크기 상한 413 e2e (50 MiB 초과 업로드 → 413 + job row 0 + DB 변경 0). supertest 의 mid-stream abort 취급을 먼저 확인한 뒤 단일 test 로 좁혀 작성.
- (예고) `MERGE` mode 실 DB 왕복 e2e — 기존 row 보존 + 부재 row 만 삽입되는 semantics 실증.
- (검토 대상, T-1287 이월) `LlmProviderConfig` 왕복 불가 가능성 — full-record select 가 `apiKey` 를 제외 (ADR-0047 secret deny) 하므로 REPLACE 재삽입이 not-null 위반일 것으로 예상된다. 실 운영 dump 에는 그 entity 가 포함되므로 복원 정책 (skip / 재입력 요구 / 부분 실패 안내) 결정 필요 — ADR amend 후보.
- (관례 박제, T-1286 executor) controller 생성자 확장은 `test/perf/` 의 `controllers: [<Name>]` 조립 spec 과 parity 를 요구한다. 향후 DI 확장 task estimate 시 `grep -rn "controllers: \[<Name>\]" test/` 결과를 파일 수 산정에 포함할 것.
