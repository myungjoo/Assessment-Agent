---
id: T-1284
title: job status 전이 + 복원 실행을 잇는 runner service 신설 (실행 slice 3c-3a)
phase: P5
status: DONE
commitMode: pr
prNumber: 1175
coversReq: [REQ-030, REQ-032]
estimatedDiff: 290
estimatedFiles: 2
created: 2026-07-28
independentStream: import-restore-engine
dependsOn: [T-1283]
touchesFiles:
  - src/import/import-job-runner.service.ts
  - src/import/import-job-runner.service.spec.ts
plannerNote: "cap-bend 없음: R-112 backbone x1.5 = 290 LOC / 2 파일 — 3c-3 의 service 배선 조각만 (controller/module/e2e 는 3c-3b~3c-3d)"
---

# T-1284 — job status 전이 + 복원 실행을 잇는 runner service 신설 (실행 slice 3c-3a)

## Why

[ADR-0055](../decisions/ADR-0055-import-multipart-file-upload.md) §Follow-up (b) 복원 엔진 chain 은 [T-1281](T-1281-import-restore-orchestrator.md) (3c-2b) 로 orchestrator [`ImportRestoreService.restoreFromDump(buffer, mode)`](../../src/import/import-restore.service.ts) 를 만들고 [T-1282](T-1282-import-module-restore-orchestrator-provider.md) (3c-2c) 로 DI 등록까지 마쳤지만 **호출처는 여전히 0** 이다. 반대편의 [`ImportJobService`](../../src/import/import-job.service.ts) 는 `markRunning` / `markSucceeded` / `markFailed` 전이를 다 갖췄으나 그 셋을 실 복원과 이어 부르는 코드가 없어, [import.controller.ts](../../src/import/import.controller.ts) 213 행은 아직 T-1254 interim guard (`markFailed(INTERIM_RESTORE_UNWIRED_MESSAGE)`) 에 머물러 있다.

본 slice 는 그 사이의 **한 겹** — job 생명주기 전이와 복원 실행을 합성하는 `ImportJobRunnerService` — 만 신설한다. 이 책임을 controller 에 직접 넣지 않는 이유는 (a) [import.controller.ts](../../src/import/import.controller.ts) 42~48 행이 "controller 자체 분기 0 (service raw forward)" 를 계약으로 박제했고, (b) 실패 전이 · 실패 message 정제 · `restoredRowCount` 산출은 HTTP 관심사가 아니며, (c) 1086 행짜리 [import.controller.spec.ts](../../src/import/import.controller.spec.ts) 에 R-112 4 종을 얹으면 cap 을 즉시 넘기 때문이다. [`ImportJobService`](../../src/import/import-job.service.ts) 안에 넣지 않는 이유도 같다 — 그 헤더가 스스로를 "PrismaService 위 얇은 persistence wrapping" 으로 한정했고, 거기에 `ImportRestoreService` 를 주입하면 428 행 기존 spec 이 통째로 흔들린다.

본 commit 후에도 runner 의 **호출처는 0** 이라 런타임 동작 변화는 **0** 이다 (T-1279 / T-1282 가 반복한 "만들고 → 등록하고 → 배선한다" 리듬 그대로). 실 배선은 3c-3b (module 등록) → 3c-3c (controller 교체) → 3c-3d (HTTP 경계 e2e) 로 이어진다.

**estimate 근거** — production 은 신규 service ~90 LOC (헤더 주석 + input interface + 실패 message 상수 + `runJob` 본문), spec 은 colocated 신규 ~200 LOC. R-112 backbone × 1.5 로 **~290 LOC / 2 파일** — cap (300 LOC / 5 파일) **안** 이라 `sizeExempt` 불요. 선례 [T-1281](T-1281-import-restore-orchestrator.md) 실측 300 LOC / 2 파일 (service 67 + spec 233).

## Required Reading

- [src/import/import-restore.service.ts](../../src/import/import-restore.service.ts) 전체 — `restoreFromDump(buffer, mode): Promise<ImportRestoreTransactionResult>` 시그니처와 전파 계약 (실패 verdict → `BadRequestException`, 매핑된 `ConflictException`, 매핑 미적중 시 **원본 Prisma error 그대로**). 본 task 는 이 service 를 **수정하지 않고 주입만** 한다.
- [src/import/import-job.service.ts](../../src/import/import-job.service.ts) 130~165 행 — `markRunning(id)` · `markSucceeded(id, artifactRef, restoredRowCount)` · `markFailed(id, error)` 시그니처와 "row 부재 시 P2025 → `NotFoundException`" 계약. 본 task 는 이 service 도 **수정하지 않고 주입만** 한다.
- [src/import/import-restore-transaction.service.ts](../../src/import/import-restore-transaction.service.ts) 34~40 행 — `ImportRestoreTransactionResult { outcomes, deleted, inserted }`. `restoredRowCount` 의 재료가 어느 필드인지 판단하는 근거.
- [docs/use-cases/UC-07-export-import.md](../use-cases/UC-07-export-import.md) 133 행 (e) — "복원된 row count" 의 의미 (삭제 건수가 아니라 재구성된 row 수).
- [src/import/import.controller.ts](../../src/import/import.controller.ts) 106~115 행 (`INTERIM_RESTORE_UNWIRED_MESSAGE`) · 194~213 행 (interim guard 블록) — 본 slice 가 **교체 대상으로 삼지 않는** 코드. 다음 slice 가 무엇을 지울지 알기 위한 읽기이며 본 task 에서 controller 는 **0 수정**.
- [docs/tasks/T-1281-import-restore-orchestrator.md](T-1281-import-restore-orchestrator.md) §Why · §Acceptance Criteria — "얇은 합성 service + colocated spec 2 파일" 의 직전 선례 (본 task 가 그 형식을 따른다).

## Acceptance Criteria

- [ ] 파일 **2 개만** 변경한다: 신규 [src/import/import-job-runner.service.ts](../../src/import/import-job-runner.service.ts) · 신규 [src/import/import-job-runner.service.spec.ts](../../src/import/import-job-runner.service.spec.ts) (colocated spec). [import.controller.ts](../../src/import/import.controller.ts) · [import-job.service.ts](../../src/import/import-job.service.ts) · [import-restore.service.ts](../../src/import/import-restore.service.ts) · [import.module.ts](../../src/import/import.module.ts) · 각 기존 spec · `test/**` · `prisma/**` · `package.json` **0 수정**.
- [ ] **service 계약** — `@Injectable() ImportJobRunnerService` 가 생성자로 `ImportJobService` 와 `ImportRestoreService` 를 주입받고, public 메서드는 `runJob(input: RunImportJobInput): Promise<ImportJob>` **하나** 다. `RunImportJobInput` 은 `{ jobId: string; buffer: Buffer; mode: ImportMode; artifactRef: string }` 이며 같은 파일에서 export 한다 (positional 인자 4 개는 문자열 2 개가 인접해 혼동 위험이 크므로 객체 입력).
- [ ] **호출 순서 계약** — `runJob` 본문은 (1) `markRunning(jobId)` → (2) `restoreFromDump(buffer, mode)` → (3-성공) `markSucceeded(jobId, artifactRef, restoredRowCount)` / (3-실패) `markFailed(jobId, <정제된 message>)` 후 **원본 error 재throw** 순서다. `markRunning` 이 throw 하면 `restoreFromDump` 는 **호출되지 않는다** (전이 실패 상태에서 DB 를 건드리지 않음). 재시도 · 로깅 · metric · 부분 복원 · 보상 로직 **0**.
- [ ] **`restoredRowCount` 산출** — `result.inserted` **만** 사용한다 (`deleted` 를 더하지 않는다 — UC-07 §8 (e) 의 "복원된 row count" 는 재구성된 row 수이고 REPLACE 의 선삭제 건수는 복원량이 아니다). 이 결정 근거를 코드 주석 1~2 줄로 박제한다.
- [ ] **실패 message 정제 (REQ-032)** — 실패 시 `markFailed` 에 넘기는 문자열은 다음 2 분기뿐이다: (a) error 가 `HttpException` 인스턴스면 `error.message` 그대로 (상류 `ImportRestoreService` / `toImportRestoreHttpException` 이 이미 정제한 한국어 문구), (b) 그 외 (raw Prisma error · 일반 `Error` · 비-Error throw) 는 파일 상단에 export 한 **고정 상수** (예: `IMPORT_RESTORE_UNEXPECTED_FAILURE_MESSAGE`) 만. raw error 의 `message` · `code` · `meta` · stack 은 (b) 경로에서 **한 글자도** job record 에 실리지 않는다.
- [ ] **원본 error 보존** — 실패 경로에서 던지는 것은 항상 `restoreFromDump` 가 던진 **그 인스턴스** 다 (재랩핑 0 → HTTP status 400 / 409 가 그대로 controller 까지 흐른다). `markFailed` 자체가 reject 하는 edge 에서도 **원본 복원 error 가 우선 전파** 된다 (기록은 best-effort — bookkeeping 실패로 원인을 가리지 않는다). 이 의도적 흡수 지점에 근거 주석을 남긴다.
- [ ] **성공 경로 흡수 0** — `markSucceeded` 가 reject 하면 그 error 를 그대로 전파하며 `markFailed` 를 부르지 않는다 (bookkeeping 실패를 복원 실패로 오분류 0).
- [ ] **happy-path unit test 1+** — REPLACE / MERGE 각각에서 (a) `markRunning` → `restoreFromDump` → `markSucceeded` 가 각 **정확히 1 회** 이 순서로 호출되고, (b) `markSucceeded` 인자가 `(jobId, artifactRef, inserted)` 이며, (c) 반환값이 `markSucceeded` 의 반환 `ImportJob` **그대로** (`toBe`) 다.
- [ ] **error path unit test 1+** — (a) `markRunning` 이 `NotFoundException` 을 던지면 그 인스턴스가 그대로 전파되고 `restoreFromDump` · `markSucceeded` · `markFailed` 호출이 **모두 0**, (b) `restoreFromDump` 가 `BadRequestException` 을 던지면 `markFailed` 1 회 + `markSucceeded` 0 회 + 원본 인스턴스 전파.
- [ ] **분기 cover** — 본문 분기 3 개 각각 1+ test: (i) 성공 / 실패 (try-catch), (ii) 실패 message 의 `HttpException` 여부 (a)/(b) 두 갈래, (iii) `markFailed` 성공 / reject. `HttpException` 갈래는 `BadRequestException`(400) 과 `ConflictException`(409) 두 케이스로 각각 message 가 **그대로** 기록됨을 확인한다.
- [ ] **negative cases 충분 cover** — 예외 상황마다 1+: (a) raw Prisma-like error (`{ code: "P2002", message: "Unique constraint failed on the fields: (`name`)" }`) 를 던지면 `markFailed` message 가 **고정 상수와 정확히 일치** 하고 `"P2002"` · 원본 message 조각 · `"Unique"` 같은 토큰을 **포함하지 않는다**, (b) 문자열 / `undefined` 같은 비-Error throw 도 같은 고정 상수로 기록되고 그 값 자체가 그대로 전파된다, (c) `markFailed` 가 reject 해도 전파되는 것은 **복원 error 인스턴스** 이고 bookkeeping error 가 아니다, (d) `markSucceeded` 가 reject 하면 그 error 가 전파되고 `markFailed` 호출 0, (e) `deleted > 0 && inserted === 0` 인 결과에서 `restoredRowCount` 로 **0** 이 기록된다 (deleted 합산 금지 pin), (f) `buffer` · `mode` 는 재가공 없이 **같은 인스턴스** 로 `restoreFromDump` 에 전달되고 `artifactRef` 도 그대로 `markSucceeded` 에 전달된다 (복제 · trim · 인코딩 변환 0), (g) 어떤 경로에서도 `markRunning` / `markSucceeded` / `markFailed` 가 2 회 이상 호출되지 않는다 (재시도 0).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 신규 service 파일은 line · branch · function **100%** 를 목표로 한다.
- [ ] `scripts/check-spec-presence.sh` 통과 (신규 production 파일에 colocated spec 존재), `prettier --check` 통과. spec 은 실 DB 0 · 실 `PrismaService` 인스턴스화 0 — `ImportJobService` / `ImportRestoreService` 를 좁은 jest mock 객체로 직접 생성자 주입한다 (`Test.createTestingModule` 없이도 무방).
- [ ] **diff 규율** — **총 diff ≤ 295 LOC / 2 파일** (cap 300 대비 자체 sub-limit). 초과가 예상되면 negative (d) → (g) 순으로 덜어내고 그 사실을 PR body + 본 task Follow-ups 에 박제한다. 그래도 초과면 planner 에게 split 을 요청한다.

## Out of Scope

- **`import.module.ts` 등록 0** — `ImportJobRunnerService` 를 providers · exports 에 넣는 일은 실행 slice **3c-3b** (T-1279 / T-1282 와 동형인 등록 한 겹). 본 slice 는 class + spec 만 만들고 DI 미등록 상태를 유지한다 (unit test 는 직접 생성자 주입이라 미등록이어도 green).
- **`import.controller.ts` 교체 0** — T-1254 interim guard (`markFailed(INTERIM_RESTORE_UNWIRED_MESSAGE)`) → `runJob` 호출 교체 · `INTERIM_RESTORE_UNWIRED_MESSAGE` 상수 제거 · `file.buffer` 소비 · `artifactRef` 값 정책 (`file.originalname` 등) 결정 · import UI false-success 해소는 실행 slice **3c-3c**. 본 slice 에서 controller 와 그 spec 은 **한 줄도** 바뀌지 않으며 runner 의 호출처는 0 을 유지한다.
- **HTTP 경계 e2e / smoke / `daily-test.sh` leg 추가 0** — 400 / 409 응답 body 실증은 controller 배선 이후라야 의미가 있어 실행 slice **3c-3d**. `daily-test.sh` 를 건드리면 drift-guard smoke spec 3 종 (T-0791 / T-0944 / T-0947) 동반 수정으로 파일 수가 cap 을 넘으므로 본 slice 는 그 근처에 가지 않는다.
- **`ImportJobService` · `ImportRestoreService` 본문 수정 0** — 시그니처 변경 · 새 메서드 추가 · 기존 spec 의미 변경 0. 두 service 는 주입 대상일 뿐이다.
- **job status 전이 규칙 자체의 확장 0** — PENDING 이 아닌 job 에 `runJob` 을 부르는 경우의 선검증 (status guard), 동시 실행 race guard 추가, timeout · 취소 · 재시도 정책 도입 **0**. race 차단은 이미 `createJob` 의 `evaluateImportRaceGuard` 몫이고, 그 이상은 별도 slice + 필요 시 ADR.
- **Audit log row 생성 0** (UC-07 §8 (e) 의 audit 항목은 별도 chain), Prisma schema · migration 0, 새 외부 dependency 0, 성능 최적화 0, 로깅 · 관측 metric 도입 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (예고) 실행 slice **3c-3b** — `ImportJobRunnerService` 를 [import.module.ts](../../src/import/import.module.ts) 의 providers · exports 에 등록 (T-1279 / T-1282 와 동형, 2 파일).
- (예고) 실행 slice **3c-3c** — [import.controller.ts](../../src/import/import.controller.ts) 의 T-1254 interim guard 를 `runJob` 호출로 **교체** + `INTERIM_RESTORE_UNWIRED_MESSAGE` 제거 + `artifactRef` 값 정책 확정 + controller spec 갱신 (import UI false-success 해소).
- (예고) 실행 slice **3c-3d** — HTTP 경계 e2e (파일 누락 400 · 복원 거부 400 · 충돌 409 · 성공 시 `status=SUCCEEDED` + `restoredRowCount` 응답 body) 실 DB 왕복 실증.

## 결과 (2026-07-28 완료)

- PR [#1175](https://github.com/myungjoo/Assessment-Agent/pull/1175) → squash merge `66ff4a92`. reviewer round **3/7** APPROVE, §3.3 4-게이트 전부 통과 (reviewer comment 3 건 PR 외부 존재 · CI 2 check pass · integrator 자체 acceptance 재점검 · 머지 직전 `origin/main` ancestor 확인).
- 실측 **+285 LOC / 2 파일** — cap (300 LOC / 5 파일) 안. 신규 [src/import/import-job-runner.service.ts](../../src/import/import-job-runner.service.ts) 는 `ImportJobService` + `ImportRestoreService` 두 주입만 받는 얇은 합성 service 이고, 본 commit 시점의 **호출처는 0** 이라 런타임 동작 변화 **0**.
- `restoredRowCount` 는 `inserted` 만 사용 (UC-07 §8 (e) — REPLACE 선삭제분 미합산, 근거 주석 박제). 실패 경로는 `HttpException` 이면 message 원문을 기록하고 그 외에는 고정 상수만 기록한 뒤 **원본 error 인스턴스를 재throw** (REQ-032 raw 미저장).
- R-112 4 종 cover 총 **13 case** — happy(REPLACE/MERGE) · `markRunning` 실패 시 `restoreFromDump` 미호출 · 400/409 원문 기록 · 비-HttpException 4 종 · `markFailed` reject 흡수 · `markSucceeded` reject 전파 · `inserted=0` pin. 신규 파일 line/branch/function **100%**, 전체 **428 suite / 12174 test** green.
- round 2 에서 reviewer 가 nit 흡수 commit 의 주석("명시 타입을 붙이면 TS2454") 이 **거짓**임을 MAJOR 로 지적 — integrator 가 `tsc --noEmit` exit 0 으로 독립 재현해 사실을 확인한 뒤 evolving-any 를 실제 명시 타입으로 좁히고 주석을 교정했다 (round 3 APPROVE). 잘못된 근거가 코드에 박제되는 것을 4-게이트가 차단한 사례.
