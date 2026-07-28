---
id: T-1275
title: 복원 step 을 단일 $transaction 안에서 실행하는 service (실행 slice 3b-2a)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 265
estimatedFiles: 2
created: 2026-07-28
independentStream: import-restore-engine
dependsOn: [T-1274]
touchesFiles:
  - src/import/import-restore-transaction.service.ts
  - src/import/import-restore-transaction.service.spec.ts
plannerNote: "실측 1:2.1 재산정 (prod 85 : spec 180) = 265 LOC. 3b-2 를 2a/2b 로 split — 실 DB rollback regression 은 2b"
---

# T-1275 — 복원 step 을 단일 $transaction 안에서 실행하는 service (실행 slice 3b-2a)

## Why

[ADR-0055](../decisions/ADR-0055-import-multipart-file-upload.md) §Follow-up (b) 복원 엔진 chain 의 종착점은 [ADR-0044](../decisions/ADR-0044-export-import-job-persistence.md) §3 atomic `$transaction` 실 복원이다. 값 산출 (T-1270 ~ T-1272) · 호출 서술 dispatch (3a, T-1273) · **tx 위에서의 순차 실행** (3b-1, T-1274) 이 모두 닫혔고, 남은 것은 그 runner 를 **실제 `$transaction` 안에서 한 번 부르는** 배선뿐이다.

T-1274 Follow-ups 는 3b-2 를 "`PrismaService.$transaction` 배선 + tx client 캐스팅 + rollback regression" 으로 예고했다. 그런데 그 안에는 (a) mock 만으로 전량 검증되는 service 배선과 (b) 실 DB 를 왕복해야 하는 rollback regression + Prisma error → HTTP exception 매핑이 함께 들어있다. 후자는 e2e 인프라 (truncateAll · 실 트랜잭션 왕복) 를 처음 잡는 조각이라 성격도 검증 비용도 다르다. 그래서 3b-2 를 **2a (본 task, mock unit 전량) / 2b (실 DB rollback + error 매핑)** 로 나눈다. 본 slice 를 닫으면 3c (controller · import-job.service 재배선) 가 **service 메서드 하나만 부르면 되는** 단일 진입점을 갖는다.

**estimate 근거 (T-1274 reviewer MINOR-1 회수)** — 본 chain 의 실측 production : spec 비율이 **1 : 2.1** 로 안정화됐다 (T-1272 58:170, T-1273 88:192, T-1274 96:203 = 1:2.11). 본 slice 의 production 은 조립 위임 · `$transaction` 1 회 · 요약 집계라 **~85**, spec 은 관측 비율을 그대로 적용해 **~180** → 총 **~265**. CLAUDE.md §3 hard cap (300 LOC / 5 파일) 대비 35 LOC 여유를 남긴 값이며 **`sizeExempt` 를 쓰지 않는다**. 이 여유가 T-1274 (가이드 285 / 실측 299) 처럼 cap 을 스치는 상황을 막는다.

## Required Reading

- [src/import/import-restore-run-steps.ts](../../src/import/import-restore-run-steps.ts) 25~57 행 — 직전 slice (3b-1) 의 타입과 시그니처. `ImportRestoreDelegateClient` / `ImportRestoreTxClient` (5 delegate key) / `ImportRestoreStepOutcome` / `runImportRestoreSteps(tx, steps)`. 본 service 는 이 runner 를 **`$transaction` 콜백 안에서 정확히 1 회** 부른다. 1~11 행 헤더 주석의 책임 경계 (rollback 0 · 매핑 0 · 서술 조립 0) 를 이어받아 본 파일 주석에서 "그 rollback 을 여기서 `$transaction` 이 책임진다" 를 닫는다.
- [src/assessment-evaluation/evaluation-result-persist.service.ts](../../src/assessment-evaluation/evaluation-result-persist.service.ts) 83~139 행 — 기존 `$transaction` 배선 선례. 좁은 surface 타입 선언 · `tx as PrismaTransactionClient` 캐스팅 위치 · `@Injectable()` + `constructor(private readonly prisma: PrismaService)` · error 전파 경계. 본 slice 는 이 패턴을 그대로 따르되 **P2002 → ConflictException 같은 매핑은 하지 않는다** (3b-2b 몫).
- [src/import/import-job.service.ts](../../src/import/import-job.service.ts) 40~75 행 — 같은 module 안의 `PrismaService` import 경로 (`../persistence/prisma.service`) 와 생성자 주입 형태.
- [src/export/import-restore-plan.ts](../../src/export/import-restore-plan.ts) 44~55 행 — `ImportRestorePlan<TInsert>` 의 `toDelete` / `toInsert` / `toKeep` 필드 (본 service 입력 타입).
- [src/import/import-restore-ops.ts](../../src/import/import-restore-ops.ts) 128~140 행 + [src/import/import-restore-steps.ts](../../src/import/import-restore-steps.ts) 169~181 행 — `groupImportRestoreOperations(plan)` → `planImportRestoreTransactionSteps(operations)` 시그니처와 각자의 한국어 throw 계약. 본 service 는 이 둘을 **순서대로 호출만** 하고 그 검증을 재구현하지 않는다.
- [test/helpers/prisma-mock.ts](../../test/helpers/prisma-mock.ts) — 기존 PrismaService mock 선례. 재사용 가능하면 그대로 쓰고, `$transaction` 콜백 실행 mock 이 없으면 본 spec 안에 단일 factory 1 개로 지역 정의한다 (helper 파일 수정 금지 — touchesFiles 밖).
- [src/import/import-restore-run-steps.spec.ts](../../src/import/import-restore-run-steps.spec.ts) — colocated spec 선례 (203 행). 본 task 의 신규 spec 은 **[src/import/import-restore-transaction.service.spec.ts](../../src/import/import-restore-transaction.service.spec.ts) (colocated)** 위치가 의무이며, mock factory 단일화 · `it.each` 표 압축 패턴을 그대로 따른다.

## Acceptance Criteria

- [ ] 신규 파일 [src/import/import-restore-transaction.service.ts](../../src/import/import-restore-transaction.service.ts) 에 `@Injectable()` `ImportRestoreTransactionService` 를 export 한다. 생성자는 `private readonly prisma: PrismaService` 하나이며, 공개 메서드는 `async restore(plan: ImportRestorePlan<FullExportRecord>): Promise<ImportRestoreTransactionResult>` 하나다. 결과 타입 `ImportRestoreTransactionResult` = `{ outcomes: ImportRestoreStepOutcome[]; deleted: number; inserted: number }` 도 함께 export 한다. 파일 상단 주석에 chain 위치 (3b-2a) 와 책임 경계 (Prisma error → HTTP 매핑 0 · module 등록 0 · controller 배선 0 — 3b-2b/3c 위임 / 값·서술 조립 0 · 순서 검증 0 — 상류 위임) 를 적되 **주석 총 18 행 이내** 로 압축한다.
- [ ] **조립 위임** — `plan` 을 받아 `groupImportRestoreOperations(plan)` → `planImportRestoreTransactionSteps(operations)` 로 step 배열을 얻는다. entity 판정 · delete-before-insert 순서 · `where` / row 산출 사본 0 이며, 그 helper 들의 한국어 throw 는 **감싸지 않고 그대로 전파** 한다 (메시지 prefix 가 `groupImportRestoreOperations:` / `planImportRestoreTransactionSteps:` 등 하류 것임을 test 로 단언해 재랩핑 회귀 차단).
- [ ] **단일 트랜잭션 계약** — 실행은 `this.prisma.$transaction(콜백, 옵션)` **정확히 1 회** 이며 콜백 안에서 `runImportRestoreSteps` 를 **정확히 1 회** 부른다. 트랜잭션을 여러 번 열거나 step 을 나눠 실행하는 경로가 없다 (원자성이 깨지면 부분 복원이 성공으로 보고된다). 옵션은 named 상수로 `{ maxWait, timeout }` 을 명시하고 (대용량 dump 가 기본 5s interactive 한도에 걸리는 것을 막는 의도를 주석 1 줄로), 그 값이 실제 전달됨을 test 로 단언한다.
- [ ] **tx 캐스팅 국소화** — `$transaction` 콜백이 받는 `tx` 를 `tx as unknown as ImportRestoreTxClient` 로 **한 곳에서만** 좁히고 그 근거를 주석 1 줄로 남긴다 (runner 가 요구하는 5 delegate key 는 실 `Prisma.TransactionClient` 의 부분집합). `any` 사용 0, `Prisma.TransactionClient` 를 runner 로 그대로 흘려보내지 않는다.
- [ ] **선-조립 계약** — step 조립은 `$transaction` 을 열기 **전에** 끝낸다. 조립이 throw 하면 `$transaction` 호출 0 회임을 test 로 단언한다 (열어놓고 실패하면 DB 세션·커넥션이 낭비된다).
- [ ] **빈 plan 분기** — 조립 결과 step 이 빈 배열이면 `$transaction` 을 **열지 않고** `{ outcomes: [], deleted: 0, inserted: 0 }` 을 반환한다 (빈 트랜잭션 왕복 0). 호출 0 회를 test 로 단언한다.
- [ ] **요약 계약** — `deleted` 는 `phase === "delete"` outcome 의 `count` 합, `inserted` 는 `phase === "insert"` outcome 의 `count` 합이며 `outcomes` 는 runner 반환을 순서 그대로 싣는다 (재정렬 · 병합 0). 합계가 outcome 과 어긋나지 않음을 test 로 단언한다.
- [ ] **error 전파 · rollback 위임** — runner / 하류 / Prisma 가 던진 error 를 **감싸지 않고 그대로 전파** 한다 (Prisma error code → HTTP exception 매핑 0 — 3b-2b 몫). 실패 시 부분 결과를 반환하는 경로가 없고, 이미 수행된 호출을 되돌리는 보상 로직도 없다 — 되돌리기는 `$transaction` 이 한다 (주석에 명시).
- [ ] **rollback 전제 박제 (T-1274 reviewer NIT-1 회수)** — runner 의 tx surface guard 는 step 별 lazy 검사라 `steps[1]` 의 결함이 `steps[0]` 실행 **후** 드러난다. 그 부분 적용이 `$transaction` rollback 으로 무해화된다는 전제를 주석 1~2 줄로 적고, 콜백이 도중 throw 하면 service 가 성공 결과를 만들지 않고 error 를 그대로 전파함을 test 로 pin 한다 (실 DB 왕복 rollback 실증은 3b-2b).
- [ ] **비변형 규약** — 입력 `plan` / `toDelete` / `toInsert` / record / `Date` / `fields` 를 변형하지 않는다 (freeze 된 입력으로 호출해도 통과). 반환 `outcomes` 배열을 호출자가 변형해도 입력이 오염되지 않음을 test 로 단언한다.
- [ ] **REQ-032 정합** — 본 service 가 만드는 어떤 메시지에도 record 원본 · `fields` 값 · `instant` 값 · plan payload · stack 을 싣지 않는다. `"leak-me"` 를 payload 자리에 투입해도 본 service 가 만든 메시지에 나타나지 않음을 되돌림 감지 negative test 로 pin 한다.
- [ ] **happy-path unit test 1+** — delete 2 건 + insert 2 건이 섞인 plan 을 mock PrismaService (콜백을 mock tx 로 실행하는 `$transaction`) 로 복원해 (a) `$transaction` 이 옵션과 함께 1 회 호출, (b) tx delegate 호출 순서가 조립된 step 순서 (delete 먼저) 와 동일, (c) 반환이 `{ outcomes, deleted, inserted }` 로 정확히 채워짐을 단언한다. `prepareImportRestorePlan` 산출 형태의 plan (또는 그와 동형 fixture) 을 그대로 넣어 chain 합성이 통과함을 실증하는 test 1+ 를 포함한다.
- [ ] **error path unit test 1+** — `plan` 이 `null` / `undefined` / 원시값이면 하류 `groupImportRestoreOperations` 의 한국어 `TypeError` 가 그대로 전파되고 `$transaction` 호출 0 회 · 부분 결과 반환 0 임을 단언한다.
- [ ] **분기 cover** — 분기마다 1+ test: 빈 step (트랜잭션 미개시) / delete·insert 혼합 실행 / 조립 단계 throw / 콜백 안 runner throw / `$transaction` 자체 reject / delete-only plan / insert-only plan.
- [ ] **negative cases 충분 cover** — 예외·경계 분기마다 1+ 이되 `it.each` 표로 압축한다: (a) `plan` 이 `undefined` · `null` · number · string 각각 하류 `TypeError` + `$transaction` 0 회 (표 1 개), (b) `plan.toDelete` / `plan.toInsert` 가 비배열이거나 원소가 결함 (비-Date instant · 무효 entity · 빈 records) 이면 하류 메시지 그대로 전파 + `$transaction` 0 회 (표 1 개), (c) `$transaction` 이 준 tx 에 delegate 누락 · method 비-함수 · 반환 `count` 비-number 이면 runner 의 `TypeError` 가 그대로 전파되고 성공 결과 미반환 (표 1 개), (d) `$transaction` 자체가 reject (커넥션 실패 · timeout 등) 하면 그 error 가 그대로 전파되고 재시도 0 · 결과 미반환, (e) 콜백 중간 step 이 reject 하면 error 전파 + 되돌리기 시도 0 + 성공 결과 미생성, (f) freeze 된 plan / records / Date 로 호출해도 통과 + 입력 비변형, (g) 같은 plan 으로 2 회 호출 시 동일 결과이되 반환 배열은 서로 다른 instance 이고, 반환 outcome 변형이 입력을 오염시키지 않음.
- [ ] **다른 파일 0 수정** — `import.module.ts` provider 등록 · controller 배선 · 기존 helper 수정 0 으로 `pnpm build` 통과 (DI 등록은 3b-2b/3c 몫이며 본 slice 는 단위 검증만). compile 이 깨지면 임의 수정 대신 PR body + 본 task Follow-ups 에 박제하고 planner 에게 넘긴다.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 신규 파일은 statement/branch/function/line 100% 목표 (동일 chain 선례 T-1255~T-1274 동형).
- [ ] `scripts/check-spec-presence.sh` 통과, `prettier --check` 통과.
- [ ] **diff 규율 (실측 1:2.1 재산정 — T-1274 reviewer MINOR-1 회수)** — production ≤ **88 LOC**, spec ≤ **190 LOC**, **총 diff ≤ 278 LOC** 를 지킨다 (CLAUDE.md §3 hard cap 300 대비 22 LOC 여유). mock PrismaService 는 호출 로그를 남기는 단일 factory 1 개로 재사용하고 반복 단언은 `it.each` 표로 압축한다. 278 초과가 예상되면 **임의로 넘기지 말고** negative (f)/(g) 를 3b-2b 로 미루거나 planner 에게 split 을 요청한다.

## Out of Scope

- **실 DB rollback regression (실 `$transaction` 왕복 · truncateAll e2e) · Prisma error (P2002 / P2003 / P2025) → HTTP exception 매핑** — 실행 slice 3b-2b. 본 slice 는 mock unit 으로만 검증하고 error 는 그대로 전파한다.
- **`import.module.ts` provider 등록 · `import-job.service.ts` / `import.controller.ts` 재배선 · T-1254 interim false-success guard 교체 · DTO 변경** — 실행 slice 3c.
- 복원 값·서술 조립 (`buildImportRestoreStepCall` · `where` · row 산출) 및 runner 로직 수정 — T-1270 ~ T-1274 에서 shipped. 본 slice 는 **부르기만** 한다.
- step 배열의 delete-before-insert 순서 **검증 · 재정렬** — T-1264 `planImportRestoreTransactionSteps` 몫.
- [src/import/import-restore-run-steps.ts](../../src/import/import-restore-run-steps.ts) 의 `typeof table !== "object"` 가 함수형 tx · 배열을 통과시키는 진단 지연 (T-1274 reviewer NIT-2) 수정 — touchesFiles 밖이라 3b-2b 또는 위생 slice. 본 service 는 항상 실 Prisma tx 객체를 넘기므로 기능 영향 0.
- `prepareImportRestorePlan` / plan 산출 / dump 파싱 수정 — read-only 소비자다.
- Prisma schema 변경 · migration · 새 외부 dependency (0 건).
- `tokenOf` · `describeReceived` · `kindOf` 사본 공용 module 추출, spec fixture helper 공용화 — 별도 위생 slice (우선순위 상향 상태).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (예고) 실행 slice **3b-2b** — 실 DB rollback regression (실패 step 이후 원상 복귀 실증) + Prisma error → HTTP exception 매핑 + `import.module.ts` provider 등록. 여기서 처음 실 DB 를 잡으므로 mock unit 과 e2e 분리를 그때 재산정한다 (jest-e2e globalSetup 이 `DATABASE_URL` 대상 DB 를 truncate 하므로 별도 test DB 전제 — Q-0054 주의사항 정합).
- (예고) 실행 slice **3c** — `import-job.service.ts` / `import.controller.ts` 재배선 (T-1254 interim `markFailed` guard 를 실 복원 pipeline 으로 교체) + import UI false-success 상태 해소.
- (이월, 비차단, 3b-2b 로 지정) `import-restore-run-steps.ts` 의 tx surface guard 가 함수형 tx · 배열을 통과시켜 tx 메시지 대신 delegate 메시지로 거부된다 (T-1274 reviewer NIT-2) — 진단 한 단계 지연, 기능 영향 0.
- (이월, 비차단) `tokenOf` / `kindOf` / `describeReceived` / `describeFieldsKind` 사본이 chain 안에서 6 개째 — 공용 module 추출 위생 slice 우선순위 상향 (T-1271 NIT-2, T-1265 NIT-1).
- (이월, 비차단) [src/import/import-restore-insert-rows.spec.ts](../../src/import/import-restore-insert-rows.spec.ts) 199 · 215 행의 `for (const [, value] of ...)` 가 표의 label 을 버려 실패 case 식별 불가 (T-1270 reviewer 잔여 NIT).
- (이월, 비차단) `dumpWithRecords` 계열 spec fixture helper 가 chain 안에서 8 번째 사본에 가까워졌다 — test fixture 공용 module 추출 (T-1269 reviewer NIT-1).
- (이월, 비차단) `src/import/import-restore-input.spec.ts` fixture helper 의 `entity in entityCounts` → `Object.prototype.hasOwnProperty.call` (T-1268 reviewer NIT-5).
