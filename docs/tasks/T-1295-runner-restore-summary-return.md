---
id: T-1295
title: runner 가 복원 요약을 결과로 함께 반환 (runJob 반환 shape 확장, 실행 slice 3c-4b)
phase: P5
status: DONE
completedAt: 2026-07-29T00:53:19Z
prNumber: 1186
mergeCommit: 55b08476
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 220
estimatedFiles: 4
created: 2026-07-29
independentStream: import-restore-engine
dependsOn: []
touchesFiles:
  - src/import/import-job-runner.service.ts
  - src/import/import-job-runner.service.spec.ts
  - src/import/import.controller.ts
  - src/import/import.controller.spec.ts
plannerNote: "cap-bend 없음: R-112 backbone x1.5 = 약 220 LOC / 4 파일. T-1294 가 만든 summary 를 runner 경계까지 올리는 한 겹 (3c-4b)"
---

# T-1295 — runner 가 복원 요약을 결과로 함께 반환 (runJob 반환 shape 확장, 실행 slice 3c-4b)

## Why

[T-1294](T-1294-restore-plan-summary-wire.md) 가 [`ImportRestoreService.restoreFromDump`](../../src/import/import-restore.service.ts) 의 반환을 `ImportRestoreResult`(= 기존 `outcomes` / `deleted` / `inserted` + **`summary: RestorePlanSummary`**) 로 넓혀 [UC-07](../use-cases/UC-07-export-import.md) §5 step 12 의 "복원 row count + **영향 요약**" 중 **요약 산출** 을 실 복원 경로에 처음 배선했다. 그러나 그 요약의 **소비처는 아직 0** 이다 — 유일한 호출자인 [`ImportJobRunnerService.runJob`](../../src/import/import-job-runner.service.ts) 이 `restored.inserted` 하나만 읽고 `markSucceeded` 로 넘긴 뒤 `ImportJob` row 만 반환하므로, 요약은 그 함수 지역 변수에서 사라진다. 즉 MERGE 가 무엇을 보존했는지 (`summary.kept`) · REPLACE 가 entity 별로 무엇을 지웠는지 (`summary.deleted.perEntity`, [T-1293](T-1293-partial-dump-merge-migration-e2e.md) 이 e2e 로 닫은 §6.2 조합 계약의 핵심 관측값) 는 여전히 HTTP layer 에 도달하지 못한다.

본 slice 는 그 **한 겹** — runner 의 반환 경계 — 만 넓힌다. `runJob` 이 `Promise<ImportJob>` 대신 `Promise<RunImportJobResult>` (= `{ job, summary }`) 를 돌려주고, 유일한 호출처인 [`ImportController.create`](../../src/import/import.controller.ts) 는 `result.job` 을 그대로 forward 해 **외부 HTTP 응답 shape 를 한 글자도 바꾸지 않는다**. 응답 envelope 를 실제로 넓히는 결정 (응답 body 에 `restoreSummary` 를 실을지 · 필드명 · e2e 박제) 은 **외부 계약 변경** 이라 별도 slice 로 분리한다 — 그래야 그 slice 가 e2e 1 개와 함께 자기 diff 안에서 완결되고, 본 slice 는 4 파일 cap 안에 남는다.

`markSucceeded` 로 요약을 **영속화하지 않는** 이유: `ImportJob` 에 breakdown 을 담을 컬럼이 없고, 컬럼 추가는 Prisma schema migration 이라 CLAUDE.md §5 상 BLOCKED 대상이다 (T-1294 Out of Scope 와 동일 판단 유지). 따라서 요약은 in-memory 반환값으로만 위층에 전달된다.

`restoredRowCount` 산출 규칙은 **불변** — 여전히 `restored.inserted` 만 쓴다 ([UC-07](../use-cases/UC-07-export-import.md) §8 (e) 의 "복원된 row count" 는 재구성된 row 수이고 REPLACE 선삭제분은 복원량이 아니다). 새로 손에 들어온 `summary.inserted.total` 로 바꾸지 않는다 — 두 값이 같아야 한다는 보증은 본 slice 가 검증할 사실이 아니며, 조용한 의미 변경은 회귀 표면이다.

**estimate 근거** — runner 본문 (타입 1 + 반환 조립 + 근거 주석) ~40 LOC + runner spec 확장 ~60 + controller 3 줄 + 주석 ~15 + controller spec 의 `runJob` mock 반환 shape 조정 및 신규 단언 ~35 → base ~145, R-112 backbone × 1.5 → **~220 LOC / 4 파일** (cap 300 / 5 안, `sizeExempt` 불요).

## Required Reading

- [src/import/import-job-runner.service.ts](../../src/import/import-job-runner.service.ts) 전체 (95 줄) — **본 task 의 주 변경 대상**. 보존해야 할 계약: 3 단계 순서 (`markRunning` → `restoreFromDump` → `markSucceeded`), 실패 시 `recordFailure` 후 **원본 error 재throw** (재랩핑 0), 성공 경로를 `try` 밖에 두어 bookkeeping 실패를 복원 실패로 오분류하지 않음, `IMPORT_RESTORE_UNEXPECTED_FAILURE_MESSAGE` 고정 문구 (REQ-032).
- [src/import/import-restore.service.ts](../../src/import/import-restore.service.ts) 의 `ImportRestoreResult` 선언부 (헤더 주석 직후 ~48 행 부근) — 소비할 타입의 정본. `summary: RestorePlanSummary` 가 기존 3 필드에 더해진 형태다. **0 수정**.
- [src/export/import-restore-plan-summary.ts](../../src/export/import-restore-plan-summary.ts) 26~40 행 (`RestorePlanGroupBreakdown` / `RestorePlanSummary`) — 반환에 실을 타입 shape (`deleted` / `inserted` / `kept` 각각 `total` + 5 entity `perEntity`). **0 수정**.
- [src/import/import.controller.ts](../../src/import/import.controller.ts) 의 `create` 메서드 (파일 하단부, `return this.runner.runJob({...})` 지점) — **두 번째 변경 대상**. controller 계약 "자체 분기 0 (service raw forward)" 와 반환 타입 `Promise<ImportJob>` 를 그대로 지킨다.
- [src/import/import-job-runner.service.spec.ts](../../src/import/import-job-runner.service.spec.ts) 전체 (190 줄) — **colocated spec, 세 번째 변경 대상**. 재사용할 구조: `makeRunner(over)` (네 협력 메서드를 같은 `order` 로그에 기록해 호출 **순서** 단언), `run(svc, mode)` 축약, `RESULT` 상수 (`ImportRestoreTransactionResult` 로 타입돼 있어 `summary` 추가가 필요하다), `Box` / `RESOLVED` sentinel (비-Error throw 단언용).
- [src/import/import.controller.spec.ts](../../src/import/import.controller.spec.ts) 의 `runnerMock` 조립부 (~113~125 행) + `POST create` describe 블록 (~139~240 행) — **네 번째 변경 대상**. `runnerMock.runJob.mockResolvedValueOnce(...)` 가 지금은 `ImportJob` row 를 직접 resolve 하므로 `{ job, summary }` 로 바꿔야 하는 지점들이다. 기존 describe/it 문자열과 호출-인자 단언 (`toHaveBeenCalledWith` / `invocationCallOrder` / `buffer` 동일 인스턴스) 은 **그대로 유지**.
- [docs/use-cases/UC-07-export-import.md](../use-cases/UC-07-export-import.md) §5 step 12 (90 행 부근) + §8 (e) — 본 배선이 향하는 계약 정본.

## Acceptance Criteria

- [ ] **변경 파일 4 개** — `src/import/import-job-runner.service.ts` + colocated spec, `src/import/import.controller.ts` + colocated spec **만**. `src/import/` 의 다른 파일 (`import-restore.service.ts` · transaction service · `import-job.service.ts` · `import.module.ts`) · `src/export/**` · `prisma/**` · `test/**` · `web/**` · `package.json` **0 수정**.
- [ ] **반환 타입 신설 1 개** — runner 파일에 `export interface RunImportJobResult { job: ImportJob; summary: RestorePlanSummary }` (또는 동등한 명시 export 타입) 을 선언하고 `runJob` 의 반환 타입을 그것으로 바꾼다. `job` 은 `markSucceeded` 가 돌려준 row **인스턴스 그대로**, `summary` 는 `restoreFromDump` 결과의 `summary` **인스턴스 그대로** (복제 · 재계산 · 필드 pick 0). runner 안에서 요약 로직을 다시 구현하지 않는다 (DRY).
- [ ] **`restored` 지역 변수 타입을 `ImportRestoreResult` 로 좁힌다** — 현재 `ImportRestoreTransactionResult` 로 선언돼 있어 `summary` 가 보이지 않는다. `import { type ImportRestoreResult } from "./import-restore.service"` 로 교체하고, 더 이상 쓰이지 않으면 `ImportRestoreTransactionResult` import 는 제거한다 (미사용 import 금지). 캐스팅 (`as`) 0.
- [ ] **`restoredRowCount` 규칙 불변** — `markSucceeded(jobId, artifactRef, restored.inserted)` 의 세 번째 인자는 여전히 `restored.inserted` 다. `summary.inserted.total` 로 바꾸지 않으며, 그 근거 (§8 (e) 의 복원 row count 정의 + 조용한 의미 변경 회피) 를 한국어 주석 1~2 줄 (§12) 로 남긴다.
- [ ] **controller 는 `result.job` 만 forward** — `create` 의 반환 타입은 `Promise<ImportJob>` 그대로이고, 응답 body 는 종전과 **완전히 동일** 하다 (`summary` 필드가 HTTP 응답에 새로 나타나지 않는다). 응답 envelope 확장을 다음 slice 로 미룬 근거를 한국어 주석 2~3 줄로 그 지점에 남긴다. controller 자체 분기 추가 0 (파일 누락 400 이 유일한 분기라는 계약 유지), try/catch 신설 0.
- [ ] **happy-path unit test 1+ (runner)** — 성공 경로에서 반환값이 (a) `job` 으로 `markSucceeded` 의 반환 인스턴스를 **`toBe` 동일성** 으로 싣고, (b) `summary` 로 `restoreFromDump` 결과의 `summary` 를 **`toBe` 동일성** 으로 실으며, (c) 호출 순서가 `["markRunning", "restoreFromDump", "markSucceeded"]` 그대로임을 단언한다. `summary` 는 비어있지 않은 `kept` 를 가진 값 (MERGE 성격) 을 최소 1 개 test 에 쓴다.
- [ ] **happy-path unit test 1+ (controller)** — `runJob` 이 `{ job, summary }` 를 resolve 할 때 `create` 의 반환이 `job` 인스턴스와 **`toBe` 동일** 하고, 반환 객체에 `summary` key 가 **없음** (`expect(Object.keys(...)).not.toContain("summary")` 또는 `toBe` 동일성으로 충분히 단언) 을 확인한다 — 외부 계약 무변화의 unit 증거.
- [ ] **error path unit test 1+** — (a) `restoreFromDump` 가 reject (`BadRequestException`) 하면 `markFailed` 가 정제된 message 로 1 회 호출된 뒤 **원본 인스턴스가 그대로** 전파되고 (`toBe`), 요약이 대신 반환되지 않음, (b) `markSucceeded` 가 reject 하면 그 error 가 전파되고 `markFailed` 는 **미호출** (성공 경로가 `try` 밖이라는 기존 계약 회귀 방지), (c) controller 는 `runJob` reject 를 삼키지 않고 raw propagate (기존 단언 유지).
- [ ] **분기 cover** — (a) 성공 → `{ job, summary }` 조립 경로, (b) `markRunning` throw → `restoreFromDump` · `markSucceeded` 둘 다 **미호출** (`not.toHaveBeenCalled`), (c) 실패 message 정제 2 분기 (`HttpException` → 원문 message / 그 외 → `IMPORT_RESTORE_UNEXPECTED_FAILURE_MESSAGE`) 가 반환 shape 변경 후에도 그대로 동작.
- [ ] **negative cases 충분 cover** — 예외 상황마다 1+: (a) 세 그룹이 모두 `total: 0` 인 빈 요약이어도 정상 반환 (throw 0 · `summary` 가 `undefined` 로 뭉개지지 않음), (b) runner 가 `summary` 객체를 **변형하지 않음** (호출 전 deep clone 과 호출 후 deep-equal 비교 — non-mutating), (c) `markFailed` 자체가 reject 하는 edge 에서도 원본 복원 error 가 전파됨 (기존 흡수 계약 회귀 방지), (d) `markFailed` 에 넘어간 message 에 dump 원문 · `summary` 수치 · stack 조각이 실리지 않음 (REQ-032 — 고정 상수 또는 상류 정제 message 와 정확 일치), (e) 비-Error 값 (`undefined`) 이 throw 된 경우에도 고정 상수 기록 + 그 값 그대로 재throw.
- [ ] **기존 test 무회귀** — 두 spec 의 기존 describe/it 문자열 · `makeRunner` / `makeController` 골격 · 호출 인자 단언 (`toHaveBeenCalledWith` · `invocationCallOrder` · `buffer` 동일 인스턴스) 은 바꾸지 않는다. 반환 shape 변경 때문에 조정이 불가피한 단언 (`runJob` mock 의 resolve 값, 반환 비교) **만** 최소 수정하고, 수정 목록을 PR body 에 한 줄로 남긴다.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 변경한 `import-job-runner.service.ts` 는 line/branch/function 100% 유지, `import.controller.ts` 는 종전 수치 유지.
- [ ] `prettier --check` 통과, `scripts/check-spec-presence.sh` 통과. PR CI 의 unit · smoke · e2e leg 전부 green — 특히 `test/e2e/import-restore-http.e2e-spec.ts` · `import-restore-rejection.e2e-spec.ts` · `import-restore-transaction.e2e-spec.ts` 가 **0 수정** 으로 통과해야 한다 (외부 HTTP 계약 무변화의 증거).
- [ ] **diff 규율** — 총 diff ≤ 300 LOC / 4 파일. 초과가 예상되면 negative (e) → (a) 순으로 덜어내고 그 사실을 PR body + 본 task Follow-ups 에 박제한다. 그래도 초과면 멈추고 planner 에게 split 을 요청한다 (BLOCKED `task-too-large`).
- [ ] **엔진 결함 발견 시 수정 금지** — 배선 중 하류 결함 (예: `ImportRestoreResult` 가 `import` 순환을 만든다 · `summary` 가 특정 경로에서 `undefined`) 이 드러나면 `import-restore.service.ts` / `src/export/**` 를 고치지 말고 재현 조건을 Follow-ups + PR body 에 기록한 뒤 BLOCKED 로 종료한다 (planner 가 patch slice 를 큐잉).

## Out of Scope

- **HTTP 응답 envelope 확장 0** — 응답 body 에 `restoreSummary` (또는 동등 필드) 를 싣는 배선은 **다음 slice** (3c-4c). 본 slice 는 runner ↔ controller 경계까지만이며 외부 응답 shape 는 불변이다.
- **e2e / smoke 추가 · 수정 0** — 외부 관측 가능한 변화가 없어 e2e 로 확인할 사실이 없다. 응답에 실리는 slice 가 e2e 를 동반한다.
- **Prisma schema / migration 0** — `ImportJob` 에 breakdown 컬럼을 추가하지 않는다 (§5 BLOCKED 대상). 요약은 in-memory 반환값일 뿐 영속화 0.
- **Audit log row 영속화 0** — UC-07 §8 (e) 의 실 insert 경로는 범용 `AuditLog` model 부재로 사람 결정 대상 (Follow-ups 유지).
- **`restoredRowCount` 의미 변경 0** — `summary.inserted.total` 로의 교체 · `deleted` 합산 · 새 count 필드 추가 전부 금지.
- **`ImportRestoreService` / `summarizeRestorePlan` / transaction service 본문 수정 0** — 본 slice 는 이미 산출된 값을 위로 올릴 뿐이다.
- **`ImportJobService` (`markRunning` / `markSucceeded` / `markFailed`) signature 변경 0** — 요약을 인자로 받게 넓히지 않는다 (저장할 컬럼이 없다).
- **web/ UI 수정 0 · 새 ADR 0 · 새 외부 dependency 0.**
- **`deploy/daily-test.sh` leg 추가 0** — leg 를 늘리면 drift-guard smoke spec 3 종 (T-0791 / T-0944 / T-0947) 동반 수정이 강제돼 파일 수 cap 을 넘긴다 (Q-0054 / T-1122 BLOCKED 선례).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (본 slice 가 여는 다음 단추, 3c-4c) **응답 envelope 확장** — `POST /api/admin/import` 응답이 job row + 복원 영향 요약을 함께 싣도록 controller 반환 shape 를 넓히고 (`{ ...job, restoreSummary }` 또는 `{ job, summary }` 중 택 1 — 기존 client/e2e 파급이 작은 쪽), e2e 1 건으로 실 HTTP 왕복에 박제한다. UC-07 §5 step 12 "복원 row count + 영향 요약" 이 그 slice 에서 처음 외부 사실이 된다.
- (유지, T-1293/T-1294) **부분 dump + REPLACE 의 비선별 entity 삭제** — "Group 만 담긴 파일" 을 REPLACE 로 올리면 Person·Assessment 까지 증발한다. 차단/경고 여부는 제품 결정 — 사람 판단 대상. `summary.deleted.perEntity` 가 그 영향 범위를 수치화한다.
- (유지, 3c-3d3) 크기 상한 413 e2e — 50 MiB 초과 업로드. **선행 확인 의무**: supertest 가 multer mid-stream abort 를 어떻게 표면화하는지 (ECONNRESET / EPIPE) 국소 확인 후, flaky 하면 기존 `multer-exception.filter.spec.ts` 의 실 파이프라인 경계로 만족시키고 e2e 는 포기하는 선택지를 planner 에 보고한다.
- (T-1290 round 1 MINOR A 이월) `ExportSelection` 의 `selected` / `excluded` 를 `readonly TRecord[]` 로 좁혀 배열 공변 unsoundness 를 닫는 slice — 소비처 4 곳 동반 수정 필요. 현 실 피해 0 이라 우선순위 낮음.
- (T-1291 → T-1294 이월) `selectExportRecords` 의 `RangeError` (손상 job row) 가 download 경로에서 **500** 으로 나간다 — 정상 경로 도달 불가하나 사용자 대면 status (409/422) 매핑 여부는 판단 필요.
- (미해결 정책, T-1287 → T-1294 이월) `LlmProviderConfig` 왕복 불가 — export full-record select 가 `apiKey` 를 제외 (ADR-0047 secret deny) 하는데 schema 의 `apiKey` 는 not-null 이라, 실 dump 에 그 entity 가 1 건이라도 있으면 복원 `$transaction` 이 통째로 실패할 것으로 예상된다. **복원 정책은 secret 처리 결정이라 CLAUDE.md §5 상 사람 결정 대상**.
- (관측, 이월) UC-07 §8 (b)(e) 가 요구하는 **Export / Import Audit log row 영속화 0** — 순수 helper `buildExportImportAuditEntry` (T-0443) 는 있으나 실 insert 경로가 없고, Prisma 에 범용 `AuditLog` model 자체가 없다. 도입은 schema migration 이라 §5 사람 결정 대상.
