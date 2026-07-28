---
id: T-1286
title: import controller 의 interim guard 를 job runner 호출로 교체 (실행 slice 3c-3c)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 330
estimatedFiles: 2
created: 2026-07-28
independentStream: import-restore-engine
dependsOn: [T-1285]
touchesFiles:
  - src/import/import.controller.ts
  - src/import/import.controller.spec.ts
sizeExempt: true
exemptReason: "controller 생성자 1 개 확장이 spec 의 17 개 `new ImportController(...)` 사이트 + interim 기대 8 개 test 를 같은 commit 안에서만 green 하게 만든다 — 배선 seam 을 반으로 쪼개면 dead field(lint fail) 또는 red commit 이 불가피해 split 불가. 파일 수는 2 (cap 5 이내), LOC 만 cap-bend."
plannerNote: "cap-bend pre-justified: R-112 backbone x1.5 = 330 LOC / 2 파일, T-1284 패턴 — 배선 seam 은 split 시 red commit 불가피"
---

# T-1286 — import controller 의 interim guard 를 job runner 호출로 교체 (실행 slice 3c-3c)

## Why

[ADR-0055](../decisions/ADR-0055-import-multipart-file-upload.md) §Follow-up (b) 복원 엔진 chain 은 [T-1284](T-1284-import-job-runner-service.md) (3c-3a) 로 [`ImportJobRunnerService.runJob`](../../src/import/import-job-runner.service.ts) 을 만들고 [T-1285](T-1285-import-module-job-runner-provider.md) (3c-3b, PR #1176 머지 `99e85d68`) 로 DI 등록까지 마쳤지만, **production 호출처는 여전히 0** 이다. [import.controller.ts](../../src/import/import.controller.ts) 213 행은 아직 [T-1254](T-1254-import-interim-guard.md) 의 interim guard (`this.service.markFailed(job.id, INTERIM_RESTORE_UNWIRED_MESSAGE)`) 에 머물러 있어, 업로드된 dump 는 수신 즉시 FAILED 로 마감되고 `file.buffer` 는 한 번도 소비되지 않는다.

본 slice 는 그 한 줄을 **실 복원 실행으로 교체** 한다 — controller 가 `ImportJobRunnerService` 를 주입받아 `createJob` 직후 `runJob({ jobId, buffer, mode, artifactRef })` 를 호출하고, 그 결과 (status=SUCCEEDED + `restoredRowCount`) 를 반환한다. 이로써 ADR-0055 §Consequences 의 부정 항목 "chain 완주 전 import UI false-success" 가 interim FAILED 우회가 아니라 **실 복원 성공/실패** 로 닫힌다 (REQ-030 Restore). 실패 사유 기록·정제는 runner 가 이미 소유하므로 (REQ-032 raw 미저장 정합) controller 는 자체 분기를 늘리지 않는다.

**estimate 근거 (cap-bend pre-justified)** — production 은 생성자 1 의존 추가 + return 라인 교체 + `INTERIM_RESTORE_UNWIRED_MESSAGE` 상수/주석 제거 + create() 주석 현행화로 ~90 diff LOC. spec 은 `new ImportController(service)` **17 개 사이트** 인자 확장 + `buildServiceMock()` 확장 + `Test.createTestingModule` 3 곳 provider 추가 + interim 의미에 매인 test 8 개 전환 + 배선 계약 신규 test 로 ~240 diff LOC. 합 **~330 LOC / 2 파일** — R-112 backbone × 1.5 카테고리 (선례 [T-1284](T-1284-import-job-runner-service.md) 실측 285 LOC). 파일 수는 cap (5) 이내이고 LOC 만 300 을 넘는다. **split 불가 근거**: 생성자만 먼저 확장하는 선행 slice 는 미사용 private 필드로 lint/build 가 깨지고, spec 전환만 먼저 하는 slice 는 production 이 아직 markFailed 라 test 가 red 다 — 어느 쪽으로 잘라도 green commit 이 성립하지 않는다. 그래서 `sizeExempt: true` 로 한 commit 유지하되 아래 §Acceptance Criteria 의 자체 sub-limit (≤ 380 LOC / 2 파일) 로 팽창을 막는다.

## Required Reading

- [src/import/import.controller.ts](../../src/import/import.controller.ts) 106~115 행 (`INTERIM_RESTORE_UNWIRED_MESSAGE` 상수 + 주석 — 본 task 가 **삭제**) · 135~214 행 (생성자 · `create()` 의 주석 블록과 본문 — 파일 누락 400 분기 / `createJob` 호출 / interim `markFailed` return). 교체 대상의 정확한 경계.
- [src/import/import-job-runner.service.ts](../../src/import/import-job-runner.service.ts) 31~76 행 — `RunImportJobInput` 4 필드 (`jobId` / `buffer` / `mode` / `artifactRef`) · `runJob` 의 3 단계 (markRunning → restoreFromDump → markSucceeded) · 실패 시 `recordFailure` 후 **원본 error 재throw**. controller 가 예외를 삼키면 안 되는 근거이며 본 파일은 **0 수정**.
- [src/import/uploaded-dump-file.ts](../../src/import/uploaded-dump-file.ts) 전체 — `buffer` / `originalname` / `size` / `mimetype` 4 필드. `artifactRef` 값 정책의 재료 (`originalname`) 확인용. **0 수정**.
- [src/import/import.controller.spec.ts](../../src/import/import.controller.spec.ts) 101~121 행 (`buildServiceMock()` — 본 task 가 runner mock 까지 돌려주도록 확장) · 128~325 행 (unit describe 의 create 관련 test 8 개 — interim 의미 전환 대상) · 550~560 행 · 978~990 행 (`Test.createTestingModule` provider 배열 2 곳 — runner provider 추가) · 574~618 행 · 635~664 행 (supertest 경로의 interim 기대). 전환 범위 산정의 근거.
- [docs/tasks/T-1254-import-interim-guard.md](T-1254-import-interim-guard.md) §Why · §Out of Scope — 본 task 가 **되돌리는** interim guard 의 도입 의도 (reversible 로 설계됐다는 원문). 삭제가 정당한 근거.

## Acceptance Criteria

- [ ] 파일 **2 개만** 변경한다: [src/import/import.controller.ts](../../src/import/import.controller.ts) · [src/import/import.controller.spec.ts](../../src/import/import.controller.spec.ts). [import.module.ts](../../src/import/import.module.ts) (이미 T-1285 등록 완료) · [import-job-runner.service.ts](../../src/import/import-job-runner.service.ts) · [import-restore.service.ts](../../src/import/import-restore.service.ts) · [import-job.service.ts](../../src/import/import-job.service.ts) · 각 기존 spec · `test/**` · `web/**` · `prisma/**` · `scripts/**` · `package.json` **0 수정**.
- [ ] **배선 계약** — `ImportController` 생성자에 `ImportJobRunnerService` 를 **값 import** 로 주입 (`import type` 금지 — DI 메타데이터 소거). `create()` 는 파일 검증 → `createJob` → `runJob({ jobId: job.id, buffer: file.buffer, mode: job.mode, artifactRef: file.originalname })` 순으로 호출하고 그 반환 `ImportJob` 을 재가공 없이 돌려준다. **`mode` 는 `dto.mode` 가 아니라 생성된 row 의 `job.mode`** 를 쓴다 (schema `@default(REPLACE)` 가 적용된 확정값이 source). `buffer` 는 복사·slice 없이 **같은 인스턴스** 로 넘긴다.
- [ ] **interim 잔재 0** — `INTERIM_RESTORE_UNWIRED_MESSAGE` 상수와 그 주석 블록을 제거하고, controller 에서 `this.service.markFailed` 호출이 **0** 이 된다 (실패 기록은 runner 몫). `git grep "INTERIM_RESTORE_UNWIRED_MESSAGE" -- "src/**" "test/**" "web/src/**"` 결과가 **0 건** 이다 (`dist/**` 빌드 산출물 제외). `ImportJobService.markFailed` 메서드 자체는 삭제하지 않는다 (runner 가 사용 중).
- [ ] **주석 동기** — `create()` 상단 주석의 "interim false-success guard (T-1254)" / "buffer 를 여전히 소비하지 않는다" / "reversible" 서술을 **실 배선 서술** 로 교체한다: runner 위임 3 단계 · `artifactRef` = 업로드 파일명 · `mode` 는 job row 값 · controller 자체 분기는 파일 누락 400 하나뿐이고 `createJob` / `runJob` 예외는 raw propagate. stale 서술 0, 한국어 (§12).
- [ ] **happy-path unit test 1+** — (a) 파일 + `mode` 지정 요청에서 `createJob` → `runJob` 순서로 각 1 회 호출되고 (`invocationCallOrder` 비교), `runJob` 인자가 `{ jobId: job.id, buffer: <업로드 buffer 와 toBe 동일 인스턴스>, mode: <job row 의 mode>, artifactRef: <file.originalname> }` 와 정확히 일치하며, 반환이 `runJob` 결과 (status=SUCCEEDED + `restoredRowCount` 보존) 와 `toBe` 동일하다. (b) supertest 경로 (RBAC integration describe) 에서 Admin actor 의 POST 가 201 + SUCCEEDED body 를 돌려준다.
- [ ] **error path unit test 1+** — (a) `runJob` 이 `BadRequestException` (dump 파싱 실패 등) 으로 reject 하면 controller 가 삼키지 않고 그대로 propagate 하며 추가 `markFailed` 호출 0 (기록은 runner 몫), (b) `runJob` 이 raw `Error` 로 reject 해도 동일하게 raw propagate (재랩핑 0), (c) supertest 경로에서 `runJob` reject 가 4xx/5xx 로 표면화된다.
- [ ] **분기 cover** — create() 의 분기마다 1+: (a) 파일 누락 (`file === undefined`) → `BadRequestException(400)` + `createJob` · `runJob` **둘 다 미호출**, (b) 파일 수신 + `mode` 지정 → `mode: dto.mode` forward 후 `runJob` 도달, (c) 파일 수신 + `mode` 미지정 → `createJob` 에 `mode: undefined` forward 하되 `runJob` 에는 **job row 의 확정 mode** 가 전달됨 (dto.mode 가 아님을 명시 단언).
- [ ] **negative cases 충분 cover** — 예외 상황마다 1+: (a) `createJob` 이 `ConflictException` (진행 중 race 409) 을 던지면 `runJob` **미호출** + raw propagate, (b) `createJob` 이 `BadRequestException` (mode invariant) 을 던져도 동일, (c) `createJob` 이 raw `Error` 로 reject 해도 동일, (d) 반환 job 의 status 가 PENDING 으로 남지 않는다 — 회귀 방어 (false-success 차단이 interim FAILED 가 아니라 실 복원 결과로 유지됨), (e) controller 가 `buffer` 를 재가공하지 않는다 (`Buffer.from` / `slice` / `toString` 호출 0 — `runJob` 인자 buffer 가 업로드 buffer 와 `toBe`), (f) 미인증 401 · User actor 403 요청에서 `createJob` · `runJob` **둘 다 미호출** (guard 가 파일 파싱·복원보다 먼저 차단), (g) 잘못된 mode enum / extra form field / `requestedById` 위장 키 요청이 400 이며 `runJob` 미호출.
- [ ] 기존 test 의 **의미 회귀 0** — interim 문구에 매인 단언만 배선 계약 단언으로 전환하고, RBAC · 라우트 우선순위 · `GET running` / `GET :id` / `GET modes` · guard metadata · 크기 상한 describe 는 **원형 유지** 한다. spec 의 전체 test 수는 줄지 않는다.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 변경 2 파일의 신규/변경 line 은 **100%** 를 목표로 한다.
- [ ] `scripts/check-spec-presence.sh` 통과, `prettier --check` 통과. 신규 test 는 실 DB 0 (mock service / mock runner 만 — 실 connection · `$transaction` 실행 0).
- [ ] **diff 규율 (sizeExempt 아래의 자체 sub-limit)** — **총 diff ≤ 380 LOC / 2 파일**. 초과가 예상되면 negative (g) → (f) 순으로 덜어내고 그 사실을 PR body + 본 task Follow-ups 에 박제한다. 그래도 초과면 작업을 멈추고 planner 에게 split 을 요청한다 (BLOCKED `task-too-large`).

## Out of Scope

- **HTTP 경계 e2e / smoke / `daily-test.sh` leg 추가 0** — 실 PostgreSQL 왕복으로 `status=SUCCEEDED` + `restoredRowCount` + 409 / 400 응답 body 를 실증하는 것은 실행 slice **3c-3d**. `daily-test.sh` 를 건드리면 drift-guard smoke spec 3 종 (T-0791 / T-0944 / T-0947) 동반 수정으로 파일 수가 cap 을 넘으므로 (MEMORY: daily-test leg drift-guard parity) 본 slice 는 그 근처에 가지 않는다.
- **`ImportJobRunnerService` · `ImportRestoreService` · `ImportRestoreTransactionService` · `ImportJobService` 본문 수정 0** — `runJob` 시그니처 · 실패 message 정제 2 분기 · `restoredRowCount` 산출 (`inserted` 만) · 전이 메서드 전부 불변. 결함이 보이면 고치지 말고 Follow-ups 에 적는다.
- **`import.module.ts` 수정 0** — `ImportJobRunnerService` 는 T-1285 가 이미 `providers` · `exports` 에 등록했다. 본 task 는 inject 만 한다 (module spec 도 0 수정).
- **`artifactRef` 정책 확장 0** — 값은 `file.originalname` 그대로다. 저장소 업로드 · URI 스킴 · 해시 · 중복 파일명 처리 · 크기/mimetype 기록 같은 확장은 본 slice 밖 (필요하면 Follow-ups).
- **비동기 처리 전환 0** — `runJob` 을 요청-응답 안에서 **동기적으로 await** 한다. queue / background worker / 타임아웃 / 진행률 스트리밍 도입은 별도 ADR 사안이다 (`GET running` polling 계약도 그대로 유지).
- **`web/` UI 수정 0** — AdminView 의 import 표시 흐름은 status 값만 보므로 배선만으로 자연 해소된다. UI 문구 조정이 필요해 보이면 Follow-ups 에 적는다.
- **재시도 · 로깅 · 관측 metric · 부분 복원 · 보상 로직 · status 선검증 guard 도입 0**, Prisma schema · migration 0, 새 외부 dependency 0, 새 ADR 0 (본 배선은 이미 ADR-0055 §Follow-up (b) 안의 결정 실행이다).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (예고) 실행 slice **3c-3d** — HTTP 경계 e2e 실 DB 왕복 실증 (파일 누락 400 · dump 파싱 실패 400 · 진행 중 충돌 409 · 성공 시 `status=SUCCEEDED` + `restoredRowCount` 응답 body + 복원된 row 실검증).
- (검토 대상) 대용량 dump 의 동기 처리 지연 — 본 slice 는 요청-응답 안에서 복원을 완주한다. 50 MiB 상한 (`MAX_IMPORT_FILE_SIZE_BYTES`) 내에서도 응답 지연이 문제가 되면 비동기 job 처리 전환을 별도 ADR 로 검토.
