---
id: T-1281
title: buffer → plan → 복원 orchestrator service 신설 (실행 slice 3c-2b)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 290
estimatedFiles: 2
created: 2026-07-28
independentStream: import-restore-engine
dependsOn: [T-1280]
touchesFiles:
  - src/import/import-restore.service.ts
  - src/import/import-restore.service.spec.ts
plannerNote: "cap-bend 없음: R-112 backbone x1.5 = 290 LOC / 2 파일 — 3c-2a helper 로 재료가 다 모여 orchestrator 한 겹만 남음"
---

# T-1281 — buffer → plan → 복원 orchestrator service 신설 (실행 slice 3c-2b)

## Why

[ADR-0055](../decisions/ADR-0055-import-multipart-file-upload.md) §Follow-up (b) 복원 엔진 chain 은 지금까지 재료를 하나씩 닫아왔다 — plan 준비 (`prepareImportRestorePlan`), 트랜잭션 실행 ([`ImportRestoreTransactionService`](../../src/import/import-restore-transaction.service.ts), 3b-2a~3b-2c), DI 등록 ([T-1279](T-1279-import-module-restore-provider.md), 3c-1), 기존 record 로딩 ([T-1280](T-1280-export-full-record-collect-helper.md), 3c-2a). 그런데 **그 셋을 잇는 호출자가 아직 0** 이라 `prepareImportRestorePlan` 은 production 호출처가 없고 (`git grep` 결과 spec 뿐) 복원은 여전히 실행되지 않는다.

본 slice 는 그 한 겹만 채운다 — **dump buffer + `ImportMode` 를 받아 (1) 기존 record 로딩 → (2) plan 준비 → (3) 실패 verdict 를 400 으로 거부 → (4) `restore()` 호출** 을 순서대로 합성하는 `ImportRestoreService` 를 신설한다. 실패 verdict 를 400 으로 보는 근거는 [UC-07](../use-cases/UC-07-export-import.md) §7.3 (schema version 부적합 → 400) · §7.4 (dump 포맷 아님 / 손상 → 400 + **transaction 시작 전 reject, DB 변경 0**) 이다 — 본 orchestrator 의 단락 순서가 그 "트랜잭션 시작 전" 계약을 코드로 강제한다.

`import.module.ts` 등록 · controller / `import-job.service.ts` 재배선은 **의도적으로 다음 slice** 로 남긴다 (T-1277 → T-1278 → T-1279 에서 검증된 "helper 먼저 · 호출처 0 · 배선은 다음 slice" 리듬 그대로). 그래서 본 commit 의 런타임 동작 변화는 0 이다.

**estimate 근거** — production 은 service 신설 ~90 LOC (헤더 계약 주석 포함, 실행 문은 4 단계 ~25 줄) + spec ~200 (happy 2 · error 3 · 분기 stage 6 종 table-driven · negative 6). 본 chain 실측 비율 (production : spec ≈ 1 : 2.1) 대로 **~290 LOC / 2 파일** — cap (300 LOC / 5 파일) **안** 이라 `sizeExempt` 불요.

## Required Reading

- [src/import/import-restore-plan-prepare.ts](../../src/import/import-restore-plan-prepare.ts) 43~64 행 + 113~161 행 — `prepareImportRestorePlan(buffer, existing, mode, options?)` 시그니처 · `ImportRestorePlanPrepareResult` discriminated union (`{ ok: true, plan, records, version }` / `{ ok: false, stage, issues }`) · **throw 0 계약** (어떤 입력에서도 verdict 로만 답한다 — 본 orchestrator 가 try/catch 로 감싸지 않는 근거).
- `ImportRestorePlanStage` 의 실 구성 — [src/import/import-restore-input.ts](../../src/import/import-restore-input.ts) 31 행 (`ImportRestoreInputStage = ImportDumpScreenStage | "records"`) + [src/import/import-dump-screen.ts](../../src/import/import-dump-screen.ts) 28 행 (`= ImportDumpParseStage | "version"`) + [src/import/import-dump-parse.ts](../../src/import/import-dump-parse.ts) 19 행 (`= "deserialize" | "structure"`). 합쳐 **6 종**: `deserialize` · `structure` · `version` · `records` · `mode` · `plan`.
- [src/import/import-restore-transaction.service.ts](../../src/import/import-restore-transaction.service.ts) 36~48 행 + 61~97 행 — `restore(plan): Promise<ImportRestoreTransactionResult>` 시그니처 · 반환 shape (`{ outcomes, deleted, inserted }`) · 실패 시 매핑된 HTTP exception 또는 원본 전파 (본 orchestrator 는 **재랩핑 0**).
- [src/export/export-full-record-collect.ts](../../src/export/export-full-record-collect.ts) 30~68 행 — `collectFullExportRecords(client)` + `ExportFullRecordReadClient` (`Readonly<Record<ExportEntityDelegate, ...>>`). **실 Prisma 캐스팅은 호출자 몫** 이라는 경계 — 그 캐스팅이 본 service 안 한 곳에서만 일어난다.
- [src/export/export-job.service.ts](../../src/export/export-job.service.ts) 506~522 행 — 같은 helper 를 `PrismaService` 로 호출하는 **선례 한 줄** (`this.prisma as unknown as ExportFullRecordReadClient`). 캐스팅 형태를 그대로 mirror 한다.
- [src/import/import-restore-transaction.service.spec.ts](../../src/import/import-restore-transaction.service.spec.ts) 1~60 행 — 같은 폴더 service spec 의 mock 구성 관례 (`Test.createTestingModule` 없이 직접 `new` + 좁은 mock 주입). 본 task 의 colocated spec 은 **[src/import/import-restore.service.spec.ts](../../src/import/import-restore.service.spec.ts)** (신규) 에 둔다.
- [docs/use-cases/UC-07-export-import.md](../use-cases/UC-07-export-import.md) 123~124 행 — §7.3 / §7.4 의 400 + "transaction 시작 전 reject (DB 변경 0)" 계약.

## Acceptance Criteria

- [ ] 파일 **2 개만** 변경한다: [src/import/import-restore.service.ts](../../src/import/import-restore.service.ts) (신규) · [src/import/import-restore.service.spec.ts](../../src/import/import-restore.service.spec.ts) (신규, **colocated**). `import.module.ts` · `import.controller.ts` · `import-job.service.ts` · `src/export/**` · `test/**` **0 수정**.
- [ ] **service 계약** — `@Injectable()` `ImportRestoreService` 가 `constructor(private readonly prisma: PrismaService, private readonly transaction: ImportRestoreTransactionService)` 로 두 의존만 받고, `async restoreFromDump(buffer: Buffer, mode: ImportMode): Promise<ImportRestoreTransactionResult>` 하나만 public 으로 노출한다. 본문은 **정확히 4 단계** 다: (1) `collectFullExportRecords(this.prisma as unknown as ExportFullRecordReadClient)` · (2) `prepareImportRestorePlan(buffer, existing, mode)` · (3) `!ok` → `BadRequestException` throw · (4) `return this.transaction.restore(prepared.plan)`. 새 로직 0 — 재시도 · 로깅 · 관측 metric · 캐시 · 부분 복원 · 보상 로직 · job status 전이 0.
- [ ] **거부 계약 (REQ-030 / REQ-032)** — `!ok` 일 때 던지는 `BadRequestException` 의 message 는 **stage 토큰 + `issues` 문자열만** 조립한다 (예: `` `import 복원 거부 (stage: ${stage}): ${issues.join("; ")}` ``). raw buffer 내용 · record `fields` 값 · plan payload · stack 을 싣지 않고 원본 verdict 객체를 `cause` 로도 붙이지 않는다. `issues` 는 상류 helper 가 이미 정제한 한국어 문자열이라 그대로 쓴다 (재가공 0).
- [ ] **단락 순서 강제 (UC-07 §7.4)** — `!ok` 경로에서 `ImportRestoreTransactionService.restore` 는 **호출 0** (mock 호출 횟수 0 단언). 반대로 `ok` 경로에서는 `restore` 를 **정확히 1 회**, `prepared.plan` **인스턴스 그대로** (`toBe`) 넘긴다.
- [ ] **전파 계약** — `prepareImportRestorePlan` 은 throw 0 계약이라 try/catch 로 감싸지 않는다. `collectFullExportRecords` 의 throw (delegate reject / `TypeError` / `RangeError`) 와 `restore()` 의 throw (매핑된 `ConflictException` / `BadRequestException` / 원본 Prisma error) 는 **인스턴스 동일성 유지로 전파** 하며 재랩핑 · 흡수 0.
- [ ] **happy-path unit test 1+** — (a) mock read client 가 record 를 돌려주고 verdict 가 `ok` 이면 `restore` 의 반환 객체를 **그대로** (`toBe`) 돌려주고 `{ deleted, inserted }` 가 보존됨, (b) `prepareImportRestorePlan` 이 `(buffer, existing, mode)` 3 인자로 호출되고 `existing` 이 read helper 가 돌려준 배열 **인스턴스 그대로** 임.
- [ ] **error path unit test 1+** — (a) read 단계 delegate reject → 그 error 가 `rejects.toBe` 로 전파되고 `prepareImportRestorePlan` · `restore` 호출 0, (b) `restore` 가 `ConflictException` 으로 reject → 그 인스턴스 그대로 전파 (재랩핑 0), (c) `restore` 가 매핑 밖 원본 error 로 reject → 역시 인스턴스 그대로 전파.
- [ ] **분기 cover** — 분기마다 1+: (a) `ok: true` 경로, (b) `ok: false` 경로. 실패 stage **6 종** (`deserialize` · `structure` · `version` · `records` · `mode` · `plan`) 은 **`it.each` table-driven 1 개** 로 묶어 각 stage 문자열이 message 에 나타나고 전부 400 임을 단언한다 (LOC 절약 — stage 당 개별 `it` 금지).
- [ ] **negative cases 충분 cover** — 예외 상황마다 1+: (a) `issues` 가 여러 개면 전부 message 에 포함되고 구분자로 이어짐, (b) `issues` 가 빈 배열이어도 throw 는 `BadRequestException` 이고 message 조립이 깨지지 않음, (c) 던진 exception 이 `BadRequestException` 인스턴스이며 status 400 임 (`getStatus()`), (d) 거부 message 에 dump 원문 / record `fields` 값이 **포함되지 않음** (REQ-032 — 민감 문자열을 심은 buffer·record 로 부정 단언), (e) 빈 DB (read 가 빈 배열) 여도 `existing: []` 로 정상 진행하고 read 실패로 오인하지 않음, (f) 같은 service 인스턴스로 두 번 호출해도 상태를 남기지 않음 (read · prepare · restore 가 각각 2 회 호출, 캐시 0).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 신규 service 는 branch 포함 **100%** 를 목표로 한다.
- [ ] `scripts/check-spec-presence.sh` 통과, `prettier --check` 통과. 신규 spec 은 실 DB 0 (mock 만 — 실 `PrismaService` 인스턴스 · `$transaction` 실행 0).
- [ ] **diff 규율** — **총 diff ≤ 300 LOC / 2 파일**. 초과가 예상되면 negative (f) → (e) 순으로 덜어내고 그 사실을 PR body + 본 task Follow-ups 에 박제한다. 그래도 초과면 planner 에게 split 을 요청한다.

## Out of Scope

- **`import.module.ts` 등록** (`ImportRestoreService` 를 providers · exports 에) — 실행 slice **3c-2c**. 본 commit 의 신규 service 는 **호출처 0 · DI 미등록** 이라 런타임 동작 변화가 0 이다 (T-1277 의 "helper 먼저, 배선은 다음 slice" 리듬 mirror).
- **`import.controller.ts` / `import-job.service.ts` 재배선** · T-1254 interim `markFailed` guard 교체 · `markRunning` → 복원 → `markSucceeded` 전이 · `restoredRowCount` 영속화 · import UI false-success 해소 — 실행 slice **3c-3** 이후.
- `prepareImportRestorePlan` 의 4 번째 인자 (`SchemaVersionCompatOptions`) 노출 · version `action === "migrate"` 별도 처리 — 본 slice 는 기본값으로만 호출하고 verdict 를 그대로 따른다. 정책이 필요하면 고치지 말고 Follow-ups 에 적는다.
- `collectFullExportRecords` · `prepareImportRestorePlan` · `ImportRestoreTransactionService` · `toImportRestoreHttpException` 의 **내용 수정 0** — 네 재료는 이미 닫혔다. 결함이 보이면 고치지 말고 Follow-ups 에 적는다.
- e2e / HTTP 경계 test 추가 · 수정 (실 DB 왕복 실증은 배선 slice 이후) · Prisma schema · migration · 새 외부 dependency (0 건) · 로깅 · 관측 metric · 성능 최적화 (scope 선별 · streaming · 배치).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (예고) 실행 slice **3c-2c** — `ImportRestoreService` 를 `import.module.ts` 의 providers · exports 에 등록 (T-1279 와 동형, 1~3 파일).
- (예고) 실행 slice **3c-3** — `import.controller.ts` / `import-job.service.ts` 재배선 (interim guard → 실 복원 pipeline, `markRunning` / `markSucceeded` / `markFailed` 전이 + `restoredRowCount`) + HTTP 경계 e2e (400 / 409 응답 body) + import UI false-success 해소.
