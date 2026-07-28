---
id: T-1282
title: ImportModule 에 복원 orchestrator provider 등록 + T-1281 이월 nit 2 건 해소 (실행 slice 3c-2c)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 170
estimatedFiles: 4
created: 2026-07-28
independentStream: import-restore-engine
dependsOn: [T-1281]
touchesFiles:
  - src/import/import.module.ts
  - src/import/import.module.spec.ts
  - src/import/import-restore.service.ts
  - src/import/import-restore.service.spec.ts
plannerNote: "cap-bend 없음: R-112 backbone x1.5 = 170 LOC / 4 파일 — T-1279(3c-1) 동형 등록 한 겹 + 이월 nit 2 건 동반 closure"
---

# T-1282 — ImportModule 에 복원 orchestrator provider 등록 + T-1281 이월 nit 2 건 해소 (실행 slice 3c-2c)

## Why

[ADR-0055](../decisions/ADR-0055-import-multipart-file-upload.md) §Follow-up (b) 복원 엔진 chain 은 [T-1281](T-1281-import-restore-orchestrator.md) (실행 slice 3c-2b, PR #1172 머지 `be2edf8a`) 로 orchestrator [`ImportRestoreService`](../../src/import/import-restore.service.ts) 를 신설했지만, 그 service 는 **DI container 에 등록돼 있지 않다** — `import.module.ts` 의 providers 에 없어 controller / `import-job.service.ts` 어느 쪽도 inject 할 수 없다. 본 slice 는 [T-1279](T-1279-import-module-restore-provider.md) (3c-1, `ImportRestoreTransactionService` 등록) 와 **정확히 동형** 인 등록 한 겹만 채워 다음 slice 3c-3 (controller / job service 재배선) 이 inject 만 하면 되게 만든다.

함께, T-1281 의 integrator 가 "본 PR diff 가 정확히 300 LOC / 2 파일 로 cap 을 소진" 이라는 §3 Nit-in-PR closure 의 cap 예외로 이월한 **NIT 3 건 중 2 건** 을 본 PR 에서 닫는다 (T-1279 가 T-1278 이월 nit 을 같은 PR 에서 닫은 리듬 그대로): (i) 실패 stage `it.each` table 이 문자열 리터럴 배열이라 `ImportRestorePlanStage` union 에 stage 가 추가돼도 **아무 test 도 깨지지 않는** exhaustiveness 공백, (ii) `issues` 가 빈 배열일 때 거부 message 가 `"import 복원 거부 (stage: plan): "` 로 **꼬리 구분자만 남는** 조립 결함. 나머지 1 건 (`as unknown as` 캐스팅이 `export-job.service.ts` 와 `import-restore.service.ts` 2 곳으로 확산 — 캐스팅 helper 통합) 은 `src/export/**` 3 파일을 추가로 건드려 cap 을 넘기므로 본 slice **밖** 이다 (Follow-ups 에 별도 slice 로 예고).

본 commit 후에도 `ImportRestoreService` 의 **호출처는 여전히 0** 이라 런타임 동작 변화는 0 이다 (등록만 — 배선은 3c-3).

**estimate 근거** — production 은 `import.module.ts` 등록 2 원소 + 헤더 주석 갱신 ~15 LOC, service message 조립 분기 ~8 LOC. spec 은 module resolve/negative ~55, service spec 의 exhaustive table + 빈 issues 단언 갱신 ~30. R-112 backbone × 1.5 로 **~170 LOC / 4 파일** — cap (300 LOC / 5 파일) **안** 이라 `sizeExempt` 불요. 선례 T-1279 실측 150 LOC / 3 파일.

## Required Reading

- [src/import/import.module.ts](../../src/import/import.module.ts) 전체 (~45 행) — T-1279 가 `ImportRestoreTransactionService` 를 providers · exports 에 **1 원소씩** 추가한 형태 + 헤더의 "책임 범위 (T-0489 배선 + T-1279 등록)" / "책임 경계 (Out of Scope)" 주석 구조. 본 task 는 그 구조에 3c-2c 한 줄씩을 **덧붙이기만** 한다.
- [src/import/import-restore.service.ts](../../src/import/import-restore.service.ts) 의 생성자 (`PrismaService`, `ImportRestoreTransactionService` 2 의존) 와 `restoreFromDump` 안 `BadRequestException` 조립 1 곳 — 등록 시 resolve 되어야 할 dep 그래프 + 이월 nit (ii) 의 수정 지점.
- [src/import/import.module.spec.ts](../../src/import/import.module.spec.ts) 전체 (212 행) — `jest.mock("../persistence/prisma.service", ...)` 로 `PrismaService` super() 부작용을 회피하고 `PersistenceModule` + `ImportModule` 을 함께 compile 하는 관례 + T-1279 가 추가한 `compile()` 공통 helper. **기존 test 는 원형 그대로 두고** 신규 test 만 helper 로 붙인다.
- [src/import/import-restore.service.spec.ts](../../src/import/import-restore.service.spec.ts) 88~92 행 (`reject(stage, issues)` fixture) · 169~186 행 (`it.each<ImportRestorePlanStage>([...])` stage 6 종 table) · 198~203 행 (빈 `issues` 단언 `toBe("import 복원 거부 (stage: plan): ")`) — 이월 nit (i) · (ii) 가 각각 손볼 정확한 위치.
- [src/import/import-restore-plan-prepare.ts](../../src/import/import-restore-plan-prepare.ts) 43 행 (`export type ImportRestorePlanStage = ImportRestoreInputStage | "mode" | "plan"`) + 57~64 행 (verdict discriminated union) — exhaustiveness guard 가 걸어야 할 union 의 정의처.
- [docs/tasks/T-1279-import-module-restore-provider.md](T-1279-import-module-restore-provider.md) §Acceptance Criteria — 같은 등록 slice 의 판정 기준 (providers · exports 각 1 원소 · imports/controllers 변경 0 · 호출처 0 유지). 본 task 는 그 기준을 `ImportRestoreService` 로 치환해 재사용한다.

## Acceptance Criteria

- [ ] 파일 **4 개만** 변경한다: [src/import/import.module.ts](../../src/import/import.module.ts) · [src/import/import.module.spec.ts](../../src/import/import.module.spec.ts) · [src/import/import-restore.service.ts](../../src/import/import-restore.service.ts) · [src/import/import-restore.service.spec.ts](../../src/import/import-restore.service.spec.ts). `import.controller.ts` · `import-job.service.ts` · `import-restore-transaction.service.ts` · `src/export/**` · `test/**` · `prisma/**` **0 수정**.
- [ ] **등록 계약** — `ImportRestoreService` 가 `@Module()` 의 `providers` 와 `exports` 에 **각각 1 원소씩** 추가된다. `imports` (`AuthModule`) · `controllers` (`ImportController`) · 기존 `ImportJobService` / `ImportRestoreTransactionService` 원소는 **변경 0**. `PrismaService` 는 `PersistenceModule` (`@Global`) 공급이라 신규 import 0.
- [ ] **호출처 0 유지** — 본 commit 후에도 `ImportRestoreService.restoreFromDump` 의 production 호출처는 0 이다 (`git grep "restoreFromDump" -- "src/**" ':!*.spec.ts'` 결과가 service 자기 정의 1 곳뿐). 등록 외 배선 · job status 전이 · interim guard 교체 0 → 런타임 동작 변화 0.
- [ ] **헤더 주석 동기** — `import.module.ts` 헤더의 "책임 범위" 에 3c-2c 항목 1 개를 추가하고, "책임 경계 (Out of Scope)" 의 "복원 service 의 호출처는 아직 0" 문장을 `ImportRestoreService` 까지 포함하도록 갱신한다 (stale 서술 0). 주석은 한국어 (§12).
- [ ] **이월 nit (i) — stage exhaustiveness** — `import-restore.service.spec.ts` 의 stage table 을 문자열 리터럴 배열 대신 **`Record<ImportRestorePlanStage, true>` 형태의 const 에서 파생** 시켜 (예: `Object.keys(STAGE_TABLE) as ImportRestorePlanStage[]`), `ImportRestorePlanStage` union 에 stage 가 추가되면 **`pnpm build` (tsc) 가 fail** 하도록 만든다. 현행 6 종 (`deserialize` · `structure` · `version` · `records` · `mode` · `plan`) 이 그대로 돌아야 하며 stage 당 개별 `it` 추가 0 (`it.each` 유지).
- [ ] **이월 nit (ii) — 빈 issues 꼬리** — `import-restore.service.ts` 의 거부 message 조립을 `issues` 가 비면 꼬리 구분자 (`": "`) 를 남기지 않도록 고친다 (예: 조립 결과가 `"import 복원 거부 (stage: plan)"`). REQ-032 계약은 불변 — stage 토큰 + 상류가 정제한 issue 문자열 **외 어떤 것도** message 에 싣지 않고 `cause` 도 붙이지 않는다. 4 단계 본문 구조 · 단락 순서 · 전파 계약은 **변경 0**.
- [ ] **happy-path unit test 1+** — (a) `PersistenceModule` + `ImportModule` compile 후 `moduleRef.get(ImportRestoreService)` 가 정의된 인스턴스를 돌려준다, (b) 그 인스턴스가 `restoreFromDump` 를 함수로 노출하고 주입된 `ImportRestoreTransactionService` 도 같은 container 에서 resolve 된다 (dep 그래프가 실제로 닫힘).
- [ ] **error path unit test 1+** — (a) `ImportModule` 을 `PersistenceModule` **없이** compile 하면 `PrismaService` 미해소로 reject 된다 (`await expect(...).rejects.toThrow()`), (b) 거부 message 조립에서 `issues` 가 빈 배열인 verdict 로 `restoreFromDump` 를 부르면 여전히 `BadRequestException` (status 400) 이 던져진다.
- [ ] **분기 cover** — 분기마다 1+: (a) `issues` 비어있지 않음 → `": " + 이어붙인 issue` 형태, (b) `issues` 빈 배열 → 꼬리 구분자 **없는** message (`toBe` 로 정확 일치 단언 — 기존 198~203 행 단언을 새 계약으로 갱신), (c) verdict `ok: true` 경로는 message 조립 자체가 일어나지 않음 (기존 test 유지).
- [ ] **negative cases 충분 cover** — 예외 상황마다 1+: (a) module compile 만으로 `$transaction` 이 **0 회** 열린다 (mock `$transaction` 호출 횟수 0 — 등록이 부수효과를 만들지 않음), (b) module compile 만으로 `collectFullExportRecords` 계열 DB read 가 0 회 (mock delegate 호출 0), (c) `moduleRef.get(ImportRestoreService)` 를 두 번 호출하면 **같은 싱글턴 인스턴스** (`toBe`) — provider 가 중복 등록되지 않았음, (d) `ImportModule` 을 import 하는 외부 module 에서도 `ImportRestoreService` 가 resolve 된다 (exports 누락 negative — 별도 wrapper `@Module({ imports: [PersistenceModule, ImportModule] })` 로 확인), (e) 빈 `issues` message 에 dump 원문 · record `fields` 값 · `undefined` · `"null"` 같은 잡음 문자열이 섞이지 않는다 (REQ-032 부정 단언), (f) stage table 파생이 6 종을 **누락 없이** 돌린다 (실행된 case 수가 union 크기와 같음을 단언).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 변경 대상 4 파일의 신규/변경 line 은 **100%** 를 목표로 한다.
- [ ] `scripts/check-spec-presence.sh` 통과, `prettier --check` 통과. 신규 test 는 실 DB 0 (`jest.mock` 한 `PrismaService` 만 — 실 connection · `$transaction` 실행 0).
- [ ] **diff 규율** — **총 diff ≤ 220 LOC / 4 파일** (cap 300 대비 자체 sub-limit). 초과가 예상되면 negative (e) → (d) 순으로 덜어내고 그 사실을 PR body + 본 task Follow-ups 에 박제한다. 그래도 초과면 planner 에게 split 을 요청한다.

## Out of Scope

- **이월 nit (iii) — `as unknown as ExportFullRecordReadClient` 캐스팅 helper 통합** (`export-job.service.ts` 와 `import-restore.service.ts` 2 곳 확산). 통합하려면 `src/export/export-full-record-collect.ts` + 그 spec + `export-job.service.ts` 3 파일이 추가로 열려 총 7 파일 → cap 초과. **별도 slice** 로 Follow-ups 에 예고한다. 본 task 에서 캐스팅 형태를 손대지 않는다.
- **`import.controller.ts` / `import-job.service.ts` 재배선** — `ImportRestoreService` inject · T-1254 interim `markFailed` guard 교체 · `markRunning` → 복원 → `markSucceeded` 전이 · `restoredRowCount` 영속화 · import UI false-success 해소 — 실행 slice **3c-3**. 본 slice 는 등록만 (T-1279 의 "등록만 하고 호출처는 만들지 않는다" 리듬 mirror).
- `ImportRestoreService` 의 **4 단계 본문 구조 변경 0** — 단계 추가/삭제 · 재시도 · 로깅 · 관측 metric · 캐시 · 부분 복원 · 보상 로직 · `SchemaVersionCompatOptions` 노출 0. 본 task 가 만지는 실행 문은 **거부 message 조립 1 곳뿐**.
- `collectFullExportRecords` · `prepareImportRestorePlan` · `ImportRestoreTransactionService` · `toImportRestoreHttpException` 의 **내용 수정 0** — 이미 닫힌 재료다. 결함이 보이면 고치지 말고 Follow-ups 에 적는다.
- e2e / HTTP 경계 test 추가 · 수정 (실 DB 왕복 실증은 배선 slice 3c-3 이후) · Prisma schema · migration · 새 외부 dependency (0 건) · 성능 최적화 · `import.module.spec.ts` 의 **기존 test 3 종 의미 변경** (원형 유지, 신규 test 만 추가).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (예고) 실행 slice **3c-2d** — T-1281 이월 nit (iii): `PrismaService` → `ExportFullRecordReadClient` 캐스팅을 `export-full-record-collect.ts` 의 이름 있는 helper (예: `asExportFullRecordReadClient`) 로 통합하고 `export-job.service.ts` · `import-restore.service.ts` 두 호출처를 그 helper 로 교체 (3~5 파일, 동작 변화 0 refactor).
- (예고) 실행 slice **3c-3** — `import.controller.ts` / `import-job.service.ts` 재배선 (interim guard → 실 복원 pipeline, `markRunning` / `markSucceeded` / `markFailed` 전이 + `restoredRowCount`) + HTTP 경계 e2e (400 / 409 응답 body) + import UI false-success 해소.
