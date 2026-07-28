---
id: T-1276
title: 복원 트랜잭션의 실 DB rollback regression e2e (실행 slice 3b-2b)
phase: P5
status: DONE
commitMode: pr
prNumber: 1167
completedAt: 2026-07-28T01:56:04Z
coversReq: [REQ-030, REQ-032]
estimatedDiff: 255
estimatedFiles: 1
created: 2026-07-28
independentStream: import-restore-engine
dependsOn: [T-1275]
touchesFiles:
  - test/e2e/import-restore-transaction.e2e-spec.ts
plannerNote: "3b-2b = test-only e2e 1 파일 (prod 0). 실 DB rollback 실증. 선례 e2e 축약해 ≤265 LOC — T-1275 실측 278 대비 여유"
---

# T-1276 — 복원 트랜잭션의 실 DB rollback regression e2e (실행 slice 3b-2b)

## Why

[ADR-0055](../decisions/ADR-0055-import-multipart-file-upload.md) §Follow-up (b) 복원 엔진 chain 의 실행 조각 3b-2a ([T-1275](T-1275-import-restore-transaction-service.md), PR #1166) 가 `ImportRestoreTransactionService.restore()` 로 단일 `$transaction` 배선을 닫았다. 다만 그 검증은 **전량 mock** 이었다 — `$transaction` 이 콜백을 실행하는 mock 은 "실패하면 되돌아간다" 를 흉내낼 수 없으므로, [ADR-0044](../decisions/ADR-0044-export-import-job-persistence.md) §3 이 요구하는 **atomic 복원** 은 아직 실증되지 않았다. 부분 복원이 성공으로 보고되는 사고는 정확히 이 지점에서 난다.

본 slice 는 실 PostgreSQL 위에서 (a) 정상 복원이 DB 에 반영되는 것과 (b) 실행 중간 step 이 실패하면 **선행 delete 까지 원상 복귀** 하는 것을 왕복 실증한다. T-1275 가 주석으로만 박아둔 rollback 전제 (runner 의 lazy guard 가 `steps[1]` 결함을 `steps[0]` 실행 후 드러내지만 `$transaction` 이 무해화한다) 를 실 DB 사실로 바꾸는 것이 본 task 의 전부다. R-113 (unit 외 e2e 도 CI 에서 수행) 정합.

**estimate 근거** — 본 slice 는 **production 0 LOC** 인 test-only slice 라 chain 의 1:2.1 비율이 적용되지 않는다. 기존 e2e 선례는 300~700 행이지만 그것들은 HTTP + RBAC + 다중 endpoint 를 함께 태운 spec 이고, 본 spec 은 **service 1 개 · entity 2 종 · 시나리오 6 개** 로 좁다. 부트스트랩 (~35) + fixture helper (~45) + 시나리오 6 개 (~150) + 주석 (~25) ≈ **255**. T-1275 가 가이드 265 대비 278 로 나온 실측을 반영해 **총 ≤265 LOC** 를 sub-limit 으로 못 박고, 초과가 예상되면 시나리오를 줄인다 (아래 diff 규율 참조). `sizeExempt` 를 쓰지 않는다.

## Required Reading

- [src/import/import-restore-transaction.service.ts](../../src/import/import-restore-transaction.service.ts) 전체 (~96 행) — 본 e2e 의 유일한 검증 대상. `restore(plan)` 의 계약 (선-조립 → 빈 step 단락 → `$transaction` 1 회 → runner 1 회 → `{ outcomes, deleted, inserted }`), `IMPORT_RESTORE_TRANSACTION_OPTIONS` (`maxWait` 10s / `timeout` 120s), error 를 감싸지 않고 그대로 전파하는 경계.
- [src/import/import-restore-transaction.service.spec.ts](../../src/import/import-restore-transaction.service.spec.ts) — mock unit 이 **이미 커버한 범위**. 본 e2e 는 그 mock 단언을 복제하지 않는다 (mock 으로 증명 불가능한 것 = 실 rollback · 실 Prisma 거부 · 실 row 상태 만 다룬다).
- [src/import/import-restore-run-steps.ts](../../src/import/import-restore-run-steps.ts) 45~120 행 — 순차 `for...of` + fail-fast. 중간 step 실패 시 남은 step 을 부르지 않고 그대로 전파한다는 사실이 본 e2e 의 rollback 시나리오 설계 근거.
- [src/export/import-restore-plan.ts](../../src/export/import-restore-plan.ts) 44~55 행 — `ImportRestorePlan<TInsert>` 의 `toDelete` (`ExportRecord[]` = `{ entity, instant }`) / `toInsert` (`FullExportRecord[]` = `{ entity, instant, fields }`) / `toKeep`. 본 e2e 는 plan 을 **직접 조립** 한다 (`buildImportRestorePlan` 왕복은 상류 unit 이 이미 커버).
- [src/import/import-restore-delete-where.ts](../../src/import/import-restore-delete-where.ts) 39~57 행 — delete 가 `{ createdAt: { in: [Date, ...] } }` 로 나간다. 따라서 seed row 의 `createdAt` 을 **명시 지정** 하고, `toDelete[].instant` 는 **seed 후 DB 에서 다시 읽은 `createdAt` 값** 을 써야 정밀도 불일치로 0 건 삭제되는 함정을 피한다.
- [src/export/export-entity-full-record-select.ts](../../src/export/export-entity-full-record-select.ts) 48~64 행 — `Person` / `Group` 의 allow-list 컬럼. `toInsert[].fields` 는 이 컬럼들이어야 `createMany` 가 실 테이블에 들어간다.
- [prisma/schema.prisma](../../prisma/schema.prisma) 55~62 행 (`Person`: `email @unique`) + 97~105 행 (`Group`: `id @id`, `name` 비-unique) — negative 시나리오의 제약 위반 재료 (중복 email → P2002, 중복 id → P2002).
- [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) 40~60 행 — `TRUNCATE_TABLES` 에 `"Person"` / `"Group"` 이 이미 포함. 본 e2e 는 이 두 entity 만 쓰므로 helper 를 **수정하지 않는다**.
- [test/e2e/export-download.e2e-spec.ts](../../test/e2e/export-download.e2e-spec.ts) 1~60 행 + `afterEach` / `afterAll` 블록 — 실 DB e2e 의 파일 헤더 주석 · cleanup 순서 선례. 단 본 e2e 는 HTTP · 인증을 쓰지 않으므로 `createAuthenticatedE2EApp` **를 쓰지 않는다** (그 helper 는 truncate 후 actor User re-seed 부담을 동반한다 — T-0520 사고).
- [src/persistence/prisma.service.ts](../../src/persistence/prisma.service.ts) 28~45 행 — `PrismaService` 는 무인자 생성자 + `onModuleInit` 에서 `$connect`. `Test.createTestingModule({ providers: [PrismaService, ImportRestoreTransactionService] }).compile()` + `moduleRef.init()` 으로 AppModule 없이 최소 부트스트랩이 가능하다 (`ImportRestoreTransactionService` 는 아직 `import.module.ts` 에 등록돼 있지 않으며 등록은 3c 몫).
- [test/jest-e2e.json](../../test/jest-e2e.json) — `testRegex: .*\.e2e-spec\.ts$` 가 신규 파일을 자동 pickup 한다 (**설정 변경 0**). `maxWorkers: 1` 이라 truncate 기반 격리가 안전.

## Acceptance Criteria

- [ ] 신규 파일 [test/e2e/import-restore-transaction.e2e-spec.ts](../../test/e2e/import-restore-transaction.e2e-spec.ts) 1 개만 추가한다. `src/` · `test/helpers/` · `test/jest-e2e.json` · `package.json` · `scripts/` **0 수정** (production 0 LOC).
- [ ] 파일 상단 주석에 chain 위치 (3b-2b) · 검증 대상 (`ImportRestoreTransactionService.restore` 의 실 `$transaction` 원자성) · **mock unit 과의 분업** (mock 으로 증명 불가능한 것만 여기서 본다) · 실 DB 전략 (CI 의 `pnpm test:e2e` + `services.postgres`, 로컬 `DATABASE_URL` 부재 시 미실행) 을 적되 **총 22 행 이내** 로 압축한다.
- [ ] **부트스트랩** — `Test.createTestingModule({ providers: [PrismaService, ImportRestoreTransactionService] })` 로 최소 module 을 올리고 `moduleRef.get(...)` 으로 service / prisma 를 얻는다. `AppModule` · supertest · JWT · guard 를 쓰지 않는다 (HTTP 경로는 3c 몫). `afterEach` 는 `truncateAll(prisma)` 1 회, `afterAll` 은 module close + `$disconnect`.
- [ ] **fixture 규율** — seed helper 는 `createdAt` 을 명시 지정해 Group / Person row 를 만들고 **DB 가 돌려준 row** 를 반환하는 단일 factory 1~2 개로 통일한다 (`toDelete[].instant` 는 그 반환값의 `createdAt` 을 그대로 사용 — 정밀도 불일치로 0 건 삭제되는 함정 차단). plan 조립 helper 도 1 개로 통일하고 시나리오마다 사본을 만들지 않는다.
- [ ] **happy-path e2e 1+** — Group 2 건 · Person 1 건을 seed 한 뒤 (a) Group 1 건 삭제 + Group 1 건 삽입 + Person 1 건 삽입이 섞인 plan 으로 `restore()` 를 부르고, (b) 반환이 `{ deleted: 1, inserted: 2 }` 이며 `outcomes` 의 delete 가 insert 보다 앞서고, (c) **실 DB 조회** 로 삭제 대상 row 부재 · 삽입 row 존재 · 손대지 않은 row 보존을 단언한다. 반환 합계와 실 row 변화량이 일치함을 함께 단언한다 (합계만 맞고 DB 는 안 바뀌는 회귀 차단).
- [ ] **rollback regression (본 task 의 핵심) 1+** — 선행 delete 가 성공한 **뒤** 후행 insert 가 실패하도록 plan 을 짠다 (예: 삽입 Group 의 `id` 를 남아있는 Group 의 `id` 와 동일하게 → 실 PK unique 위반). `restore()` 가 reject 하고, 그 후 **DB 가 복원 시도 이전과 완전히 동일** 함을 단언한다: (a) delete 대상 row 가 **여전히 존재**, (b) 같은 step 의 다른 삽입 row 가 **하나도 남지 않음**, (c) 전체 row 수가 seed 직후와 동일. 이 3 단언이 T-1275 주석의 rollback 전제를 실 사실로 바꾸는 지점이다.
- [ ] **error path e2e 1+** — 위 rollback 케이스에서 전파된 error 가 **service 가 감싼 것이 아님** 을 단언한다 (Prisma 가 던진 error 그대로 — `PrismaClientKnownRequestError` 계열이거나 최소한 `ImportRestoreTransactionService:` 같은 본 service 발 prefix 가 붙지 않음). Prisma error code → HTTP exception 매핑이 **아직 없음** 을 pin 하는 것이 목적이다 (매핑 도입 slice 가 본 단언을 의도적으로 갱신하게 된다).
- [ ] **분기 cover** — 분기마다 1+: (a) delete + insert 혼합 (happy), (b) **빈 plan** (`toDelete` / `toInsert` 모두 빈 배열) → reject 0 · `{ outcomes: [], deleted: 0, inserted: 0 }` · DB 무변화, (c) delete-only plan → 해당 row 만 사라지고 나머지 보존, (d) 실행 중간 실패 → 전량 rollback.
- [ ] **negative cases 충분 cover** — 예외 분기마다 1+ 이되 반복 단언은 `it.each` 표로 압축한다: (a) 삽입 row 가 실 unique 제약을 위반 (Group PK 중복 · Person `email` 중복) → 각각 reject + 원상 복귀 (표 1 개), (b) 삽입 `fields` 에 실 테이블에 없는 컬럼 또는 타입이 맞지 않는 값 (예: `name` 에 number) → Prisma 거부 + 원상 복귀 + 부분 삽입 0, (c) 조립 단계 결함 (`toDelete[].instant` 가 비-Date / 무효 entity) → **상류의 한국어 `TypeError` 가 그대로 전파** 되고 DB 무변화 (T-1275 mock unit 의 "`$transaction` 0 회" 를 실 DB 쪽에서 보완 — PR #1166 MINOR-1 회수), (d) 존재하지 않는 `instant` 로 delete 하는 plan → reject 0 이되 `deleted: 0` 이고 기존 row 가 그대로 (조용한 오삭제 0).
- [ ] **REQ-032 정합** — seed / 삽입 fields 중 한 값을 `"leak-me"` 같은 marker 로 두고, 실패 경로에서 **본 service 가 만든 산출물 (반환값 · 본 service 발 메시지)** 에 그 marker 가 나타나지 않음을 단언한다. Prisma 자체 error 본문은 본 service 관할 밖이므로 단언 대상에서 제외한다 (과잉 단언 금지 — 상류 라이브러리 문구에 spec 을 묶지 않는다).
- [ ] **timeout 관측 기록 (PR #1166 NIT-4 회수)** — `IMPORT_RESTORE_TRANSACTION_OPTIONS.timeout` (120s) 가 실 Prisma 커넥션 풀 · DB `statement_timeout` 과 어떻게 상호작용하는지 본 e2e 실행에서 관측한 사실을 **주석 1~2 줄** 로 남긴다 (예: 본 규모 왕복은 수백 ms 로 완료되어 두 한도 어디에도 닿지 않음). 값 변경 · 풀 설정 변경은 하지 않는다.
- [ ] **격리** — 시나리오 간 순서 의존 0. 각 `it` 이 자기 seed 로 시작하고 `afterEach` truncate 로 끝난다. 임의 순서 실행 (`--randomize` 상당) 에서도 통과하도록 전역 mutable 상태를 두지 않는다.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — `src/` 변경 0 이라 coverage 수치 영향 없음). CI 의 `pnpm test:e2e` step 에서 본 spec 이 green.
- [ ] **R-112 적용 메모** — 본 task 는 신규 public symbol 0 (production 0 LOC) 이므로 추가 unit spec 은 만들지 않는다. R-112 의 happy / error / branch / negative 4 종은 위 e2e 항목들이 대신 충족한다. `scripts/check-spec-presence.sh` 통과 (신규 `src/` 파일 없음), `prettier --check` 통과.
- [ ] **diff 규율** — **총 diff ≤ 265 LOC / 1 파일** (CLAUDE.md §3 hard cap 300 대비 35 LOC 여유). 265 초과가 예상되면 임의로 넘기지 말고 negative (b) → (d) 순으로 덜어내고 그 사실을 PR body + 본 task Follow-ups 에 박제한다. 그래도 초과면 planner 에게 split 을 요청한다.

## Out of Scope

- **Prisma error (P2002 / P2003 / P2025) → HTTP exception 매핑** — 후속 slice **3b-2c**. 본 task 는 매핑이 없다는 사실을 pin 만 한다.
- **`import.module.ts` provider 등록 · `import-job.service.ts` / `import.controller.ts` 재배선 · T-1254 interim false-success guard 교체 · DTO 변경 · HTTP / RBAC 경로 e2e** — 실행 slice **3c**.
- [src/import/import-restore-transaction.service.ts](../../src/import/import-restore-transaction.service.ts) 및 그 mock unit spec 수정 — touchesFiles 밖. 본 e2e 가 결함을 드러내면 고치지 말고 PR body + Follow-ups 에 박제하고 planner 에게 넘긴다 (`timeout` 값 조정 포함).
- `test/helpers/db-truncate.ts` 확장 (`Assessment` / `LlmProviderConfig` / `AuditLog` 테이블 추가) — 본 e2e 는 `Person` / `Group` 만 쓰므로 불요. FK 위반 (P2003) 시나리오가 필요해지면 그 helper 확장과 함께 별도 slice.
- `test/jest-e2e.json` · `package.json` script · `.github/workflows/ci.yml` · `scripts/daily-test.sh` 변경 (0 건 — testRegex 가 자동 pickup 하며 daily-test leg 추가는 drift-guard smoke 3 종 동반 수정을 부르는 cap 위험, Q-0054).
- 복원 값 · 서술 조립 (`buildImportRestoreStepCall` · `where` · row 산출) · runner 로직 · plan 산출 helper 수정 — T-1264 ~ T-1274 에서 shipped. 본 e2e 는 소비자다.
- 성능 측정 · 대용량 dump 부하 (perf-spec) — 별도 slice. 본 e2e 는 소규모 fixture 로 정확성만 본다.
- Prisma schema 변경 · migration · 새 외부 dependency (0 건).
- `tokenOf` · `describeReceived` · `kindOf` 사본 공용 module 추출, spec fixture helper 공용화 — 별도 위생 slice (우선순위 상향 상태).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (예고) 실행 slice **3b-2c** — Prisma error (P2002 중복 · P2003 FK · P2025 부재) → HTTP exception 매핑 + 그 매핑의 unit spec. 본 e2e 의 "감싸지 않음" 단언을 그 slice 가 의도적으로 갱신한다.
- (예고) 실행 slice **3c** — `import.module.ts` provider 등록 + `import-job.service.ts` / `import.controller.ts` 재배선 (T-1254 interim `markFailed` guard 를 실 복원 pipeline 으로 교체) + import UI false-success 상태 해소.

## 결과 (2026-07-28 01:56Z, DONE)

PR [#1167](https://github.com/myungjoo/Assessment-Agent/pull/1167) squash merge `5d47552d` (round 1/7 APPROVE, 4-게이트 PASS). 실측 **+259 LOC / 1 파일** (production 0). `Test.createTestingModule({ providers: [PrismaService, ImportRestoreTransactionService] })` 최소 부트스트랩으로 AppModule·supertest·JWT 없이 실 DB 를 붙였고, `toDelete[].instant` 는 DB 가 돌려준 `createdAt` 을 그대로 써 정밀도 불일치로 인한 0 건 삭제 함정을 차단했다. happy 1 · rollback regression 1 · error path 1 · 분기 4 종 (혼합 / 빈 plan / delete-only / 중간 실패) · negative 7 종 (unique 위반 2 · Prisma 거부 fields 2 · 조립 결함 2 · 무존재 instant 1). reviewer NIT 3 건은 모두 판단 근거 확인 성격이라 fix 대상 0 — follow-up 이월 없음.
