---
id: T-1285
title: ImportModule 에 job runner service provider 등록 (실행 slice 3c-3b)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 170
estimatedFiles: 2
created: 2026-07-28
independentStream: import-restore-engine
dependsOn: [T-1284]
touchesFiles:
  - src/import/import.module.ts
  - src/import/import.module.spec.ts
plannerNote: "cap-bend 없음: R-112 backbone x1.5 = 170 LOC / 2 파일 — T-1279/T-1282 동형 등록 한 겹 (controller 교체는 3c-3c)"
---

# T-1285 — ImportModule 에 job runner service provider 등록 (실행 slice 3c-3b)

## Why

[ADR-0055](../decisions/ADR-0055-import-multipart-file-upload.md) §Follow-up (b) 복원 엔진 chain 은 [T-1284](T-1284-import-job-runner-service.md) (실행 slice 3c-3a, PR #1175 머지 `66ff4a92`) 로 job 전이와 복원 실행을 합성하는 [`ImportJobRunnerService`](../../src/import/import-job-runner.service.ts) 를 신설했지만, 그 service 는 **DI container 에 등록돼 있지 않다** — [import.module.ts](../../src/import/import.module.ts) 의 `providers` 에 없어 [import.controller.ts](../../src/import/import.controller.ts) 가 inject 할 수 없다.

본 slice 는 [T-1279](T-1279-import-module-restore-provider.md) (3c-1) · [T-1282](T-1282-import-module-restore-orchestrator-provider.md) (3c-2c) 와 **정확히 동형** 인 등록 한 겹만 채운다. 다음 slice 3c-3c 가 controller 의 T-1254 interim guard (`markFailed(INTERIM_RESTORE_UNWIRED_MESSAGE)`) 를 `runJob` 호출로 교체할 때 inject 만 하면 되게 만드는 것이 목적이다.

본 commit 후에도 `runJob` 의 **production 호출처는 여전히 0** 이라 런타임 동작 변화는 **0** 이다 (등록만 — 배선은 3c-3c, HTTP 경계 e2e 는 3c-3d).

**estimate 근거** — production 은 `import.module.ts` 의 `providers` · `exports` 각 1 원소 + 헤더 주석 갱신 ~15 LOC, spec 은 신규 describe 1 개 (~110 LOC). R-112 backbone × 1.5 로 **~170 LOC / 2 파일** — cap (300 LOC / 5 파일) **안** 이라 `sizeExempt` 불요. 선례 [T-1282](T-1282-import-module-restore-orchestrator-provider.md) 실측 207 LOC / 4 파일 (그중 2 파일은 이월 nit 몫이라 등록 자체는 2 파일).

## Required Reading

- [src/import/import.module.ts](../../src/import/import.module.ts) 전체 (60 행) — T-1279 / T-1282 가 `providers` · `exports` 에 **1 원소씩** 추가한 형태 + 헤더의 "책임 범위 (T-0489 배선 + T-1279 / T-1282 등록)" / "책임 경계 (Out of Scope)" 주석 구조. 본 task 는 그 구조에 3c-3b 한 겹을 **덧붙이기만** 한다.
- [src/import/import-job-runner.service.ts](../../src/import/import-job-runner.service.ts) 40~56 행 — `@Injectable()` + 생성자 2 의존 (`ImportJobService`, `ImportRestoreService`, 둘 다 이미 등록됨) + public 메서드 `runJob(input: RunImportJobInput): Promise<ImportJob>` 단일. 등록 시 dep 그래프가 닫히는지 판단하는 근거. 본 task 는 이 파일을 **0 수정**.
- [src/import/import.module.spec.ts](../../src/import/import.module.spec.ts) 21~54 행 (`jest.mock("../persistence/prisma.service", ...)` + 공통 `compile()` helper) · 220~224 행 (`RestoreConsumerModule` wrapper — exports 누락 negative 대역) · 226~310 행 (T-1282 의 3c-2c describe 전체) — 본 task 가 **그대로 mirror 할 형식**. 기존 test 는 원형 유지하고 신규 describe 만 덧붙인다.
- [docs/tasks/T-1282-import-module-restore-orchestrator-provider.md](T-1282-import-module-restore-orchestrator-provider.md) §Acceptance Criteria · §Out of Scope — 같은 등록 slice 의 판정 기준 (providers · exports 각 1 원소 · imports/controllers 변경 0 · 호출처 0 유지). 본 task 는 그 기준을 `ImportJobRunnerService` 로 치환해 재사용한다.
- [docs/tasks/T-1284-import-job-runner-service.md](T-1284-import-job-runner-service.md) §Out of Scope 첫 항목 — 본 slice 의 범위 정의 ("class + spec 만 만들고 DI 미등록 유지" 의 다음 겹) 원문.

## Acceptance Criteria

- [ ] 파일 **2 개만** 변경한다: [src/import/import.module.ts](../../src/import/import.module.ts) · [src/import/import.module.spec.ts](../../src/import/import.module.spec.ts). [import.controller.ts](../../src/import/import.controller.ts) · [import-job.service.ts](../../src/import/import-job.service.ts) · [import-job-runner.service.ts](../../src/import/import-job-runner.service.ts) · [import-restore.service.ts](../../src/import/import-restore.service.ts) · 각 기존 spec · `test/**` · `prisma/**` · `package.json` **0 수정**.
- [ ] **등록 계약** — `ImportJobRunnerService` 가 `@Module()` 의 `providers` 와 `exports` 에 **각각 1 원소씩** 추가된다. `imports` (`AuthModule`) · `controllers` (`ImportController`) · 기존 3 원소 (`ImportJobService` · `ImportRestoreTransactionService` · `ImportRestoreService`) 는 **변경 0** (순서 재배치 · rename 포함 0). `PrismaService` 는 `PersistenceModule` (`@Global`) 공급이라 신규 import 0. import 문은 **값 import** 여야 한다 (`import type` 으로 쓰면 DI 메타데이터가 소거된다).
- [ ] **호출처 0 유지** — 본 commit 후에도 `runJob` 의 production 호출처는 0 이다 (`git grep "runJob" -- "src/**" ':!*.spec.ts'` 결과가 service 자기 정의 1 곳뿐). 등록 외 배선 · interim guard 교체 · controller 수정 0 → 런타임 동작 변화 0.
- [ ] **헤더 주석 동기** — `import.module.ts` 헤더의 "책임 범위" 에 3c-3b 항목 1 개를 추가하고, "책임 경계 (Out of Scope)" 의 "복원 service 두 종 … 호출처는 아직 0" 문장을 `ImportJobRunnerService` 까지 포함하도록 갱신한다 (stale 서술 0 — 등록 3 종 / 호출처 0 이라는 사실이 주석과 정확히 일치해야 한다). 주석은 한국어 (§12).
- [ ] **happy-path unit test 1+** — (a) `PersistenceModule` + `ImportModule` 을 함께 compile 한 뒤 `moduleRef.get(ImportJobRunnerService)` 가 `ImportJobRunnerService` 인스턴스를 돌려준다, (b) 그 인스턴스가 `runJob` 을 함수로 노출하고 주입된 `ImportJobService` · `ImportRestoreService` 가 **같은 container 의 인스턴스와 동일** (`toBe`) 하다 — dep 그래프가 실제로 닫힘 (T-1282 의 `resolve 된 인스턴스가 …` test 형식 mirror).
- [ ] **error path unit test 1+** — (a) 공급자 없이 `ImportJobRunnerService` 만 담은 최소 module 을 compile 하면 DI 미해소로 reject 된다 (`await expect(build).rejects.toThrow()` — DI 실패가 조용히 통과하지 않음). `ImportModule` 통째를 `PersistenceModule` 없이 compile 하는 형태는 **쓰지 않는다** (T-1279 / T-1282 주석이 박제한 jest worker crash 회피).
- [ ] **분기 cover** — 등록 경로의 분기마다 1+: (a) `providers` 등록 → module 내부에서 resolve 성공, (b) `exports` 등록 → `ImportModule` 을 import 하는 외부 module (`RestoreConsumerModule` 재사용 또는 동형 wrapper) 에서도 resolve 성공, (c) provider 를 sentinel 로 override 해도 compile 이 성립 (등록 토큰이 override 가능한 정상 provider 임 — 기존 `sentinel` test 형식 mirror).
- [ ] **negative cases 충분 cover** — 예외 상황마다 1+: (a) compile 만으로 `$transaction` 이 **0 회** 열린다, (b) compile 만으로 DB read (`person.findMany` mock) 가 **0 회** — 등록이 부수효과를 만들지 않음, (c) `moduleRef.get(ImportJobRunnerService)` 를 두 번 호출하면 **같은 싱글턴 인스턴스** (`toBe`) — 중복 등록 0, (d) 신규 등록이 기존 배선을 깨지 않는다 — 같은 compile 안에서 `ImportJobService` · `ImportRestoreTransactionService` · `ImportRestoreService` · `ImportController` 가 **모두** 여전히 resolve 된다, (e) compile · `close()` 만으로 `markRunning` / `markSucceeded` / `markFailed` 계열 DB write surface (mock delegate `importJob.update`) 호출이 **0 회** — 등록이 job row 를 건드리지 않음, (f) `moduleRef.close()` 가 정상 resolve 된다 (등록이 teardown 을 막지 않음).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 변경 2 파일의 신규/변경 line 은 **100%** 를 목표로 한다.
- [ ] `scripts/check-spec-presence.sh` 통과, `prettier --check` 통과. 신규 test 는 실 DB 0 (`jest.mock` 한 `PrismaService` 만 — 실 connection · `$transaction` 실행 0).
- [ ] **diff 규율** — **총 diff ≤ 200 LOC / 2 파일** (cap 300 대비 자체 sub-limit). 초과가 예상되면 negative (f) → (e) 순으로 덜어내고 그 사실을 PR body + 본 task Follow-ups 에 박제한다. 그래도 초과면 planner 에게 split 을 요청한다.

## Out of Scope

- **`import.controller.ts` 교체 0** — T-1254 interim guard (`markFailed(INTERIM_RESTORE_UNWIRED_MESSAGE)`) → `runJob` 호출 교체 · `INTERIM_RESTORE_UNWIRED_MESSAGE` 상수 제거 · `file.buffer` 소비 · `artifactRef` 값 정책 (`file.originalname` 등) 확정 · controller spec 갱신 · import UI false-success 해소는 실행 slice **3c-3c**. 본 slice 에서 controller 와 [import.controller.spec.ts](../../src/import/import.controller.spec.ts) 는 **한 줄도** 바뀌지 않는다 (T-1279 / T-1282 의 "등록만 하고 호출처는 만들지 않는다" 리듬 mirror).
- **HTTP 경계 e2e / smoke / `daily-test.sh` leg 추가 0** — 400 / 409 응답 body · `status=SUCCEEDED` + `restoredRowCount` 실증은 controller 배선 이후라야 의미가 있어 실행 slice **3c-3d**. `daily-test.sh` 를 건드리면 drift-guard smoke spec 3 종 (T-0791 / T-0944 / T-0947) 동반 수정으로 파일 수가 cap 을 넘으므로 본 slice 는 그 근처에 가지 않는다.
- **`ImportJobRunnerService` 본문 수정 0** — `runJob` 시그니처 · 3 단계 호출 순서 · `restoredRowCount` 산출 (`inserted` 만) · 실패 message 정제 2 분기 · `IMPORT_RESTORE_UNEXPECTED_FAILURE_MESSAGE` 상수 문구는 **전부 불변**. 신규 메서드 추가 · status 선검증 guard · 재시도 · 로깅 · 관측 metric 도입 0. 결함이 보이면 고치지 말고 Follow-ups 에 적는다.
- **`ImportJobService` · `ImportRestoreService` · `ImportRestoreTransactionService` 수정 0** — 이미 닫힌 재료이며 본 task 에서는 resolve 대상일 뿐이다. 각 service 의 기존 spec 도 **의미 변경 0**.
- **`import.module.spec.ts` 의 기존 test 의미 변경 0** — 기존 describe 3 블록 (`ImportModule` · 3c-1 · 3c-2c) 은 원형 유지, 신규 describe 만 파일 끝에 덧붙인다. 공통 `compile()` helper · `jest.mock` 블록 · `RestoreConsumerModule` wrapper 는 **재사용** 하되 필요한 mock delegate (`importJob.update` 등) 추가는 기존 단언을 깨지 않는 범위에서만.
- Prisma schema · migration 0, 새 외부 dependency 0, 성능 최적화 0, 새 ADR 0 (등록 한 겹은 이미 ADR-0055 §Follow-up (b) 안의 결정 실행이다).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (예고) 실행 slice **3c-3c** — [import.controller.ts](../../src/import/import.controller.ts) 의 T-1254 interim guard 를 `ImportJobRunnerService.runJob` 호출로 **교체** + `INTERIM_RESTORE_UNWIRED_MESSAGE` 제거 + `artifactRef` 값 정책 확정 + controller spec 갱신 (import UI false-success 해소).
- (예고) 실행 slice **3c-3d** — HTTP 경계 e2e (파일 누락 400 · 복원 거부 400 · 충돌 409 · 성공 시 `status=SUCCEEDED` + `restoredRowCount` 응답 body) 실 DB 왕복 실증.
