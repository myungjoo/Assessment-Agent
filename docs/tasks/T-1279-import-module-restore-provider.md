---
id: T-1279
title: ImportModule 에 복원 트랜잭션 service provider 등록 + T-1278 이월 nit 보강 (실행 slice 3c-1)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 150
estimatedFiles: 3
created: 2026-07-28
independentStream: import-restore-engine
dependsOn: [T-1278]
touchesFiles:
  - src/import/import.module.ts
  - src/import/import.module.spec.ts
  - src/import/import-restore-transaction.service.spec.ts
plannerNote: "3c 첫 조각 — 복원 service 를 DI container 에 등록/export 만. controller·job service 재배선은 3c-2. T-1278 이월 nit(calls 공허 단언) 동반 해소."
---

# T-1279 — ImportModule 에 복원 트랜잭션 service provider 등록 + T-1278 이월 nit 보강 (실행 slice 3c-1)

## Why

[ADR-0055](../decisions/ADR-0055-import-multipart-file-upload.md) §Follow-up (b) 복원 엔진 chain 은 3b-2c-2 ([T-1278](T-1278-import-restore-error-wire.md), PR #1169) 로 `ImportRestoreTransactionService` 한 겹을 계약까지 닫았다. 그러나 그 service 는 **어느 module 에도 등록되지 않아 NestJS 런타임에 존재하지 않는다** — `import.module.ts` 의 providers 는 아직 `ImportJobService` 하나뿐이다. 본 slice 는 3c (module 등록 → controller / import-job.service 재배선 → interim guard 교체) 중 **가장 앞 조각인 DI 등록 한 겹만** 닫아, 다음 slice 가 orchestrator / controller 에서 이 service 를 inject 할 수 있게 한다. 등록 자체는 얇지만 빠지면 3c-2 가 `Nest can't resolve dependencies` 로 실패하는 실질 선행 조건이다.

동시에 [T-1278](T-1278-import-restore-error-wire.md) integrator 가 **실행 slice 3c 로 이월 합의** 한 nit 1 건을 함께 해소한다: 매핑 unit test 의 `caught()` helper 가 `makeService(undefined, thrown)` 으로 **`$transaction` 자체를 reject** 시키므로 콜백이 아예 실행되지 않고, 그 결과 negative (e) 의 `expect(calls).toEqual([])` 단언이 **공허하게 항상 참** 이다 (보상 로직 부재를 실제로 검증하지 못한다). 실 Prisma error 는 트랜잭션 **안의 delegate 호출** 에서 나오므로, 실 step 을 몇 개 실행한 뒤 중간 delegate 가 P2002 로 reject 하는 시나리오로 보강해야 "매핑이 붙어도 이후 호출 0 · 보상 delete 0" 이 참으로 검증된다.

**estimate 근거** — production 은 import 1 행 + providers/exports 각 1 원소 + 헤더 주석 갱신 ~12 LOC 이고 나머지는 전량 spec (module.spec ~+55, service.spec ~+50/-5). 본 chain 실측 비율 (production : spec ≈ 1 : 2.1) 대로 총 **~150 LOC / 3 파일** — cap (300 / 5) 안이라 `sizeExempt` 를 쓰지 않는다.

## Required Reading

- [src/import/import.module.ts](../../src/import/import.module.ts) 전체 (39 행) — 본 task 의 유일한 production 수정 대상. 19~22 행의 "책임 경계 (Out of Scope)" 주석이 "실 atomic transaction 복원 로직 — 후속 task" 라고 적혀 있어 본 등록에 맞게 갱신 대상이다. `PersistenceModule` (`@Global()`) 이 `PrismaService` 를 공급하므로 imports 추가는 불요.
- [src/import/import.module.spec.ts](../../src/import/import.module.spec.ts) 전체 (100 행) — 추가할 test 의 골격. 특히 13~27 행 `jest.mock("../persistence/prisma.service", ...)` (신규 service 의 `$transaction` dep 을 위해 mock 클래스 보강이 필요한지 판단) + 43~53 행 provider resolve 패턴 + 90~99 행 Reflect metadata 로 생성자 dep 을 정적 확인하는 패턴.
- [src/import/import-restore-transaction.service.ts](../../src/import/import-restore-transaction.service.ts) 61~63 행 — 등록 대상 `@Injectable()` class 와 그 유일한 생성자 dep (`PrismaService`). 본 task 는 **이 파일을 수정하지 않는다**.
- [src/import/import-restore-transaction.service.spec.ts](../../src/import/import-restore-transaction.service.spec.ts) 51~75 행 (`makeService(reply?, txReject?)` factory — `reply` 로 특정 delegate 호출에 reject 주입 가능) + 191~197 행 (기존 (e) 중간 step reject test — 보강의 참고 형태) + 206~217 행 (`caught()` helper — 본 nit 의 진원지, `failing()` 이 `txReject` 경로라 `calls` 가 항상 빈 배열).
- [src/export/export.module.ts](../../src/export/export.module.ts) — provider 다중 등록 mirror 참고 (등록 순서 · exports 표기 관례). 본 task 는 이 파일을 수정하지 않는다.

## Acceptance Criteria

- [ ] 파일 **3 개만** 수정한다: [src/import/import.module.ts](../../src/import/import.module.ts) · [src/import/import.module.spec.ts](../../src/import/import.module.spec.ts) · [src/import/import-restore-transaction.service.spec.ts](../../src/import/import-restore-transaction.service.spec.ts). 신규 파일 0 · `import.controller.ts` / `import-job.service.ts` / `import-restore-transaction.service.ts` / `import-restore-error.ts` / `app.module.ts` **0 수정**.
- [ ] **등록 계약** — `ImportModule` 의 `providers` 에 `ImportRestoreTransactionService` 를 추가하고 `exports` 에도 함께 박제한다 (`ImportJobService` 관례 mirror — 후속 3c-2 orchestrator / 외부 module 재사용 대비). `imports` 배열 변경 0 (`PrismaService` 는 `PersistenceModule` `@Global()` 공급), `controllers` 변경 0, 기존 `ImportJobService` 등록 변경 0.
- [ ] **주석 갱신** — module 헤더의 "책임 범위" 에 본 등록 1~2 행 (chain 위치 `3c-1` 표기 + "provider 등록만 · controller / job service 재배선은 3c-2" 명시) 을 추가하고, 19~22 행 "책임 경계" 의 "실 atomic transaction 복원 로직 — 후속 task" 문장을 현행 (service 는 등록됐고 **호출처는 아직 0**) 에 맞게 정정한다. 헤더 총 길이는 기존 ±5 행 이내.
- [ ] **happy-path unit test 1+** — [src/import/import.module.spec.ts](../../src/import/import.module.spec.ts) 에 "compile 시 `ImportRestoreTransactionService` provider 가 resolve 된다" test 추가 (`moduleRef.get(...)` 가 `toBeInstanceOf` 통과). 기존 3 test 는 의미 변경 없이 통과 유지.
- [ ] **error path unit test 1+** — `PersistenceModule` 없이 `ImportModule` 만 compile 하면 `PrismaService` 미해소로 실패함을 단언하거나 (`await expect(...compile()).rejects.toThrow()`), mock `PrismaService` 를 sentinel 로 override 했을 때 신규 provider 가 그 sentinel 을 주입받는지 단언한다 — 둘 중 **DI 실패가 조용히 통과하지 않음** 을 보이는 쪽을 택하고 근거를 test 제목에 남긴다.
- [ ] **분기 cover** — module 파일 자체에는 실행 분기가 0 이므로 (decorator metadata 선언뿐) 등록 정합의 관측 가능한 경우를 각 1+ 로 나눈다: (a) 정상 compile + resolve, (b) 신규 provider 를 sentinel 로 `overrideProvider` 해도 compile, (c) Reflect metadata 로 `ImportRestoreTransactionService` 의 생성자 dep 이 `PrismaService` 임을 정적 확인 (`@Global` 의존 정합 — 누락 시 fail).
- [ ] **negative cases 충분 cover** — (a) 신규 등록이 기존 `ImportJobService` / `ImportController` resolve 를 깨지 않음 (같은 compile 안에서 3 종 동시 `get`), (b) module 이 `PrismaService` 를 **자체 provider 로 중복 등록하지 않음** (`@Global` 인스턴스와 갈라지면 트랜잭션이 다른 커넥션에서 돈다 — `moduleRef.get(PrismaService)` 가 `PersistenceModule` 인스턴스와 동일함을 `toBe` 로 단언), (c) compile 만으로 DB 접속 · `$transaction` 호출이 **일어나지 않음** (mock 의 `$transaction` jest.fn 이 `not.toHaveBeenCalled`), (d) `moduleRef.close()` 로 정리해 열린 handle 0.
- [ ] **T-1278 이월 nit 해소 (regression 성격)** — [src/import/import-restore-transaction.service.spec.ts](../../src/import/import-restore-transaction.service.spec.ts) 의 3b-2c-2 describe 에 **실 step 실행 후 실패** 시나리오 test 1+ 추가: `makeService((k) => k === "person.createMany" ? Promise.reject(P2002 error) : { count: 1 })` 처럼 `reply` 경로로 중간 delegate 를 reject 시켜 (i) `restore()` 가 `ConflictException` (409) 으로 reject 되고, (ii) `calls` 가 **실제 실행된 step 까지의 배열과 정확히 일치** 하며 (`toEqual([])` 이 아니라 실행 sequence 단언 — 실패 이후 호출 0 · 보상 delete 0), (iii) `$transaction` 호출 1 회 · 재시도 0 임을 단언한다. 기존 `caught()` helper 의 공허한 `expect(calls).toEqual([])` 은 **그 helper 가 `txReject` 경로 전용임을 주석 1 행으로 명시** 하거나 새 helper 로 분리해, 같은 착각이 재발하지 않게 한다.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `scripts/check-spec-presence.sh` 통과, `prettier --check` 통과. `import.module.spec.ts` 는 실 DB 0 (기존 `jest.mock` 유지 — 신규 service 의 `$transaction` 이 필요하면 mock 클래스에 jest.fn 으로 추가).
- [ ] **diff 규율** — **총 diff ≤ 200 LOC / 3 파일**. 초과가 예상되면 negative (d) → (b) 순으로 덜어내고 그 사실을 PR body + 본 task Follow-ups 에 박제한다. 그래도 초과면 planner 에게 split 을 요청한다.

## Out of Scope

- **`import.controller.ts` / `import-job.service.ts` 재배선 · T-1254 interim `markFailed` guard 교체 · `markRunning` → 복원 실행 → `markSucceeded` 전이 배선** — 실행 slice **3c-2** 이후. 본 task 후에도 복원 pipeline 은 여전히 호출되지 않으며 import UI 는 false-success 를 닫아둔 interim 상태 그대로다.
- **buffer → plan orchestrator 신설** (`prepareImportRestorePlan` + 기존 record 로딩 (`ExportJobService.collectFullExportRecords` 계열) + `restore()` 합성) — 별도 slice. cross-module 의존 (Import ↔ Export) 설계 판단이 필요해 본 등록 slice 에 섞지 않는다.
- `import-restore-transaction.service.ts` · `import-restore-error.ts` production 수정 — 두 파일은 T-1275 / T-1277 / T-1278 에서 닫혔다. 결함이 보이면 고치지 말고 Follow-ups 에 적는다.
- `app.module.ts` 등록 변경 · `ExportModule` 수정 · 새 module 신설 · 새 외부 dependency (0 건).
- HTTP / RBAC e2e · [test/e2e/import-restore-transaction.e2e-spec.ts](../../test/e2e/import-restore-transaction.e2e-spec.ts) 수정 — 본 task 는 e2e 를 건드리지 않는다 (등록만으로 HTTP 경로가 바뀌지 않음).
- 로깅 · 관측 metric · 실패 통계 · Prisma schema / migration · 성능 측정.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (예고) 실행 slice **3c-2** — buffer → plan orchestrator (`prepareImportRestorePlan` + 기존 record 로딩 + `ImportRestoreTransactionService.restore()` 합성) 신설.
- (예고) 실행 slice **3c-3** — `import.controller.ts` / `import-job.service.ts` 재배선 (T-1254 interim guard → 실 복원 pipeline, `markRunning` / `markSucceeded` / `markFailed` 전이) + HTTP 경계 e2e (409 / 400 응답 body) + import UI false-success 해소.
