---
id: T-1287
title: import 업로드 → 실 복원 HTTP 경계 e2e (성공 경로, 실행 slice 3c-3d1)
phase: P5
status: DONE
completedAt: 2026-07-28T16:38:47Z
prNumber: 1178
mergedAs: d4b7bc56
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 300
estimatedFiles: 1
created: 2026-07-28
independentStream: import-restore-engine
dependsOn: [T-1286]
touchesFiles:
  - test/e2e/import-restore-http.e2e-spec.ts
sizeExempt: true
exemptReason: "e2e 신규 spec 1 개 단일 파일이며, AppModule 부트스트랩 + actor 2 종 seed + truncate 후 actor re-seed + export→download→import 왕복 helper 만으로 assertion 이전에 ~150 LOC 이 고정 소비된다 (선례: export-download.e2e-spec.ts 356 줄 / import-restore-transaction.e2e-spec.ts 259 줄). 파일 수는 1 (cap 5 이내) 이고 production 0 LOC — LOC 축만 cap 경계."
plannerNote: "cap-bend pre-justified: R-112 backbone x1.5 = 300 LOC / 1 파일, T-1276 e2e 패턴 — e2e 부트스트랩 boilerplate 고정 소비"
---

# T-1287 — import 업로드 → 실 복원 HTTP 경계 e2e (성공 경로, 실행 slice 3c-3d1)

## Why

[ADR-0055](../decisions/ADR-0055-import-multipart-file-upload.md) §Follow-up (b) 복원 엔진 chain 은 [T-1286](T-1286-import-controller-runner-wiring.md) (3c-3c, PR #1177 머지 `61b007e2`) 로 controller 의 interim guard 를 `ImportJobRunnerService.runJob` 실 호출로 바꿔 **배선 자체는 완료** 됐다. 그러나 지금까지의 검증은 전부 mock 경계다 — `ImportJobService` · `ImportRestoreService` · `PrismaService` 가 모두 mock 인 unit / supertest 뿐이고, **업로드된 dump 가 실 PostgreSQL 위에서 실제로 row 를 복원하는지** 를 왕복으로 증명한 test 는 0 이다 (T-1276 e2e 는 `$transaction` 원자성만, HTTP 경계 밖).

본 slice 는 그 마지막 구멍을 닫는다 (R-113 — unit 외 end-to-end CI 수행): 실 DB 에 seed → `POST /api/admin/export` + `GET /api/admin/export/:id/download` 로 **실제 dump 파일 본문** 을 얻고 → row 1 건을 삭제한 뒤 → 그 dump 를 `POST /api/admin/import` 에 multipart 업로드해 → 응답이 `status=SUCCEEDED` + `restoredRowCount` 이고 **삭제됐던 row 가 실제로 되살아났는지** 를 실 PostgreSQL 로 확인한다. 이로써 REQ-030 (Import/Restore) 의 backup→restore 왕복이 문서·mock 이 아니라 실행 사실로 박제되고, 실패 경로에서도 raw dump 가 저장되지 않음 (REQ-032) 이 실 DB 로 확인된다.

**estimate 근거 (cap-bend pre-justified)** — 신규 spec 1 파일. 파일 머리 주석 (실 DB 전략 · actor re-seed · seed 제약) ~45, import + describe scaffolding (`createAuthenticatedE2EApp` · afterEach 정리 · `reseedActors`) ~70, 왕복 helper (`seedRestorableEntities` / `createExportJob` / `downloadDump`) ~55, test 4 종 ~130 → **~300 LOC / 1 파일**. R-112 backbone × 1.5 카테고리, 선례 [T-1276](T-1276-import-restore-rollback-e2e.md) 실측 259 LOC (더 좁은 범위) · `export-download.e2e-spec.ts` 356 줄. production 코드 0 LOC 이고 파일 수는 cap (5) 훨씬 이내라 LOC 축만 경계에 닿는다 — `sizeExempt: true` 로 두되 아래 자체 sub-limit (≤ 340 LOC / 1 파일) 로 팽창을 막는다.

## Required Reading

- [src/import/import.controller.ts](../../src/import/import.controller.ts) 119~215 행 — 라우트가 `POST /api/admin/import` (`@Controller("api/admin/import")`) 이고 multipart field 이름이 **`file`**, `mode` 는 form field 라는 사실 · `create()` 3 단계 (파일 누락 400 → `createJob` → `runJob`) · `artifactRef = file.originalname` · `mode` 는 job row 확정값. **0 수정**.
- [src/import/import-job-runner.service.ts](../../src/import/import-job-runner.service.ts) 31~76 행 — `runJob` 이 markRunning → `restoreFromDump` → `markSucceeded(..., inserted)` 를 합성하고, 실패 시 `markFailed` 기록 후 **원본 error 재throw**. 성공 시 `restoredRowCount` 가 `inserted` 만이라는 계약 (REPLACE 선삭제분 미합산) — 단언 수치의 근거. **0 수정**.
- [test/e2e/export-download.e2e-spec.ts](../../test/e2e/export-download.e2e-spec.ts) 55~200 행 — 본 spec 이 1:1 mirror 할 패턴: `createAuthenticatedE2EApp` 로 Admin/User actor seed · `buildAuthCookie` · `afterEach` 의 job row `deleteMany` → `truncateAll` → **`reseedActors`** 순서 · `POST /api/admin/export` 로 `{ scope: "FULL" }` job 생성 후 `GET :id/download` 로 dump 본문 획득. **0 수정**.
- [test/e2e/import-restore-transaction.e2e-spec.ts](../../test/e2e/import-restore-transaction.e2e-spec.ts) 머리 주석 — 실 DB e2e 에서 `instant` (createdAt) 정밀도 함정과 최소 부트스트랩 선택 근거. 본 spec 은 HTTP 경계라 AppModule 을 쓰지만 instant 취급 주의는 동일. **0 수정**.
- [test/helpers/auth-e2e-helper.ts](../../test/helpers/auth-e2e-helper.ts) 의 `createAuthenticatedE2EApp` / `buildAuthCookie` / `AuthenticatedE2EContext` 시그니처 · [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) 의 `TRUNCATE_TABLES` 7 종 (ImportJob / ExportJob / Assessment / LlmProviderConfig **미포함** — 명시 `deleteMany` 필요). **0 수정**.
- [prisma/schema.prisma](../../prisma/schema.prisma) 649~666 행 (`model ImportJob` — `status` / `mode` / `artifactRef` / `restoredRowCount` / `error` / `requestedById` FK `onDelete: Restrict`). 응답·DB 단언 필드의 source.

## Acceptance Criteria

- [ ] 신규 파일 **1 개만** 추가한다: `test/e2e/import-restore-http.e2e-spec.ts`. `src/**` · `web/**` · `prisma/**` · `scripts/**` · `package.json` · `test/jest-e2e.json` · 기존 `test/e2e/**` · `test/smoke/**` · `test/perf/**` · `deploy/**` **0 수정** (jest-e2e 의 `testRegex` 가 새 파일을 자동 picking 하므로 config 변경 불요).
- [ ] **왕복 helper** — (a) `seedRestorableEntities()` 가 실 DB 에 **Group 1 + Person 1** 만 seed 한다. **`LlmProviderConfig` · `Assessment` · `PermissionDeniedRecord` 는 seed 금지** — full-record select 가 `apiKey` 를 제외해 REPLACE 재삽입이 not-null 위반으로 깨지는 등 본 slice 밖 표면을 끌어들인다 (그 entity 왕복은 Follow-ups). (b) `createExportJob()` 이 `POST /api/admin/export` 에 `{ scope: "FULL" }` 로 201 을 받고 id 를 돌려준다. (c) `downloadDump(jobId)` 가 `GET /api/admin/export/:id/download` 응답 본문을 **Buffer** 로 돌려준다 (`.buffer(true).parse(binary parser)` 또는 `Buffer.from(res.text)` 중 실제로 동작하는 경로 1 개만 — 재가공·재직렬화 0).
- [ ] **happy-path e2e 1+** — seed → export → download → `prisma.group.delete` 로 Group row 1 건 삭제 → `POST /api/admin/import` 에 `.attach("file", dumpBuffer, "dump.json")` + `.field("mode", "REPLACE")` + Admin cookie 로 요청 → (a) 응답 **201**, (b) body `status === "SUCCEEDED"`, (c) `restoredRowCount` 가 dump 의 record 수와 일치 (`inserted` 만), (d) `artifactRef === "dump.json"`, (e) `error === null`, (f) **삭제됐던 Group row 가 동일 id 로 실 DB 에 다시 존재** 하고 `name` 이 seed 값과 같다, (g) Person row 는 중복 없이 정확히 1 건 (id 보존).
- [ ] **error path e2e 1+** — 유효하지 않은 dump (`Buffer.from("not-json")`) 업로드 시 (a) 응답 **400**, (b) 실 DB 의 `ImportJob` row 가 `status === "FAILED"` 이고 `error` 가 비어있지 않으며 `restoredRowCount === null`, (c) `error` 문자열에 업로드 raw 본문 (`"not-json"`) 이 **포함되지 않는다** (REQ-032 raw 미저장 회귀 — sentinel 문자열로 단언), (d) Group / Person row 수가 요청 전과 동일 (transaction 시작 전 reject, DB 변경 0 — UC-07 §7.4).
- [ ] **분기 cover** — `create()` 의 `mode` 분기 1+: `mode` form field 를 **생략** 한 업로드가 201 + `SUCCEEDED` 이고 job row 의 `mode === "REPLACE"` (schema `@default` 확정값이 runner 로 전달됨) 임을 확인한다. `MERGE` 경로 왕복은 본 slice 밖 (Follow-ups).
- [ ] **negative cases 충분 cover** — 예외 상황마다 1+: (a) 구조 위반 dump (유효 JSON 이지만 `records` 키 없음) 업로드 → 400 + job `FAILED` + Group/Person row 수 불변, (b) 성공 응답의 `restoredRowCount` 가 REPLACE 선삭제분을 합산하지 않는다 (dump record 수 초과 아님을 명시 단언), (c) 실패 응답 body 에 stack trace · dump 본문 조각이 실리지 않는다 (message 만), (d) 성공 후에도 `ImportJob` row 가 정확히 1 건씩만 생성된다 (중복 job 0).
- [ ] **정리 규율** — `afterEach` 는 `importJob.deleteMany()` → `exportJob.deleteMany()` → `truncateAll(prisma)` → **`reseedActors()`** 순으로 수행한다. `ImportJob`/`ExportJob` 의 `requestedById → User` 는 `onDelete: Restrict` 라 job row 를 먼저 비워야 하고, `truncateAll` 이 actor User 를 지우므로 동일 id/email/role 로 재 seed 해야 다음 test 의 job 생성이 FK 위반으로 500 나지 않는다 (선례 T-0520 round 2).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). e2e 는 CI 의 `pnpm test:e2e` step 에서 실행되며 (로컬 `DATABASE_URL` 부재 시 미실행), PR CI 의 e2e leg 가 green 이어야 한다.
- [ ] `prettier --check` 통과, `scripts/check-spec-presence.sh` 통과. 파일 머리에 **한국어 주석** (§12) 으로 실 DB 전략 · seed 제약 (LlmConfig 금지 사유) · actor re-seed 근거를 박제한다.
- [ ] **diff 규율 (sizeExempt 아래의 자체 sub-limit)** — **총 diff ≤ 340 LOC / 1 파일**. 초과가 예상되면 negative (d) → (c) 순으로 덜어내고 그 사실을 PR body + 본 task Follow-ups 에 박제한다. 그래도 초과면 멈추고 planner 에게 split 을 요청한다 (BLOCKED `task-too-large`).
- [ ] **엔진 결함 발견 시 수정 금지** — 왕복 중 복원 엔진 / export select / controller 결함 (예: 특정 entity 의 재삽입 실패, instant 정밀도 불일치) 이 드러나면 `src/**` 를 고치지 말고 재현 조건을 Follow-ups 에 기록한 뒤 BLOCKED 로 종료한다 (planner 가 patch slice 를 큐잉).

## Out of Scope

- **거부 경계 e2e 전부** — 파일 누락 400 · 진행 중 충돌 409 · 미인증 401 · User actor 403 · 크기 상한 413 은 실행 slice **3c-3d2** (별도 task). 본 slice 는 성공 경로 + 파싱 실패 최소 1~2 종만 다룬다.
- **`MERGE` mode 왕복 검증 0** — 본 slice 의 mode 분기는 "미지정 → REPLACE 확정값" 까지다. MERGE semantics (기존 row 보존 + 부재 row 삽입) 의 실 DB 실증은 별도 slice.
- **`src/**` 수정 0** — controller · runner · restore service · transaction service · export helper 전부 불변. 결함이 보여도 고치지 않는다 (위 Acceptance 마지막 항목).
- **`deploy/daily-test.sh` · smoke leg 추가 0** — leg 를 늘리면 drift-guard smoke spec 3 종 (T-0791 / T-0944 / T-0947) 동반 수정이 강제돼 파일 수 cap 을 넘긴다 (MEMORY: daily-test leg drift-guard parity, Q-0054 선례). 본 slice 는 근처에 가지 않는다.
- **`test/perf/**` 수정 0** — perf spec 의 `controllers: [ImportController]` 조립은 T-1286 에서 이미 runner provider 와 parity 를 맞췄다. 본 task 는 DI 를 확장하지 않으므로 parity 갱신 대상 0.
- **비동기 job 전환 · 진행률 polling · 재시도 · 관측 metric · Prisma schema/migration · 새 외부 dependency · 새 ADR 0** — 전부 본 slice 밖 (본 e2e 는 ADR-0055 §Follow-up (b) 안의 검증 실행이다).
- **`web/` UI 수정 0** — AdminView 는 status 값만 보므로 본 배선 검증으로 영향 없음.

## Suggested Sub-agents

`tester → implementer` (본 task 는 test-only — tester 가 spec 을 쓰고 실행까지 맡고, implementer 는 호출하지 않아도 무방하다)

## Follow-ups

- (예고) 실행 slice **3c-3d2** — import HTTP 거부 경계 e2e (파일 누락 400 · 진행 중 충돌 409 · 미인증 401 · User 403 + 각 경우 DB 변경 0).
- (예고) `MERGE` mode 실 DB 왕복 e2e — 기존 row 보존 + 부재 row 만 삽입되는 semantics 실증.
- (검토 대상) `LlmProviderConfig` 왕복 불가 가능성 — full-record select 가 `apiKey` 를 제외 (ADR-0047 secret deny) 하므로 REPLACE 재삽입 시 not-null 위반이 예상된다. 본 slice 는 seed 에서 제외해 우회했으나, **실 운영 dump 에는 그 entity 가 포함** 되므로 복원 정책 (해당 entity skip / apiKey 재입력 요구 / 부분 실패 안내) 결정이 필요하다 — ADR amend 후보.
- (관례 박제, T-1286 executor) controller 생성자 확장은 `test/perf/` 의 `controllers: [<Name>]` 조립 spec 과 parity 를 요구한다. 향후 DI 확장 task 를 estimate 할 때 `grep -rn "controllers: \[<Name>\]" test/` 결과를 파일 수 산정에 포함할 것.
