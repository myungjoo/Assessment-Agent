---
id: T-1294
title: 복원 결과에 plan 영향 breakdown 요약 동봉 (summarizeRestorePlan 첫 production 배선, 실행 slice 3c-4a)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 150
estimatedFiles: 2
created: 2026-07-28
independentStream: import-restore-engine
dependsOn: []
touchesFiles:
  - src/import/import-restore.service.ts
  - src/import/import-restore.service.spec.ts
plannerNote: "cap-bend 없음: R-112 backbone x1.5 = 150 LOC / 2 파일. T-0448 helper 의 production 호출처 0 을 해소하는 UC-07 §5 step 12 '영향 요약' 첫 배선"
---

# T-1294 — 복원 결과에 plan 영향 breakdown 요약 동봉 (summarizeRestorePlan 첫 production 배선, 실행 slice 3c-4a)

## Why

[UC-07](../use-cases/UC-07-export-import.md) §5 step 12 (90 행) 는 Import 응답이 **"복원 row count + 영향 요약"** 이어야 한다고 박제하고, §8 (e) 는 Audit row 가 복원 breakdown 을 담아야 한다고 요구한다. 이 "영향 요약" 을 순수 derivation 으로 계산하는 helper 는 이미 있다 — [`summarizeRestorePlan`](../../src/export/import-restore-plan-summary.ts) (T-0448) 이 `ImportRestorePlan` 의 `{toDelete, toInsert, toKeep}` 를 `{deleted, inserted, kept}` 각각의 `total` + 5 entity `perEntity` breakdown 으로 집계한다. 그러나 **production 호출처가 0** 이다 (`git grep summarizeRestorePlan -- src` 결과가 전부 형제 module 의 chain 설명 주석). 즉 helper 는 머지됐지만 실 복원 경로 어디에서도 산출되지 않아, 응답·audit 어느 쪽도 breakdown 을 가질 수 없다.

현행 실 복원 결과는 [`ImportRestoreTransactionResult`](../../src/import/import-restore-transaction.service.ts) 의 `{ outcomes, deleted, inserted }` 뿐 — **총계 2 개만** 있고 `kept` 도, entity 별 분포도 없다. 그래서 [`ImportJobRunnerService`](../../src/import/import-job-runner.service.ts) 는 `restored.inserted` 하나만 `restoredRowCount` 로 기록할 수 있고, MERGE 가 무엇을 보존했는지 ([T-1293](T-1293-partial-dump-merge-migration-e2e.md) 이 e2e 로 닫은 §6.2 조합 계약의 핵심 관측값) 는 복원 결과 어디에도 남지 않는다. 본 slice 는 [`ImportRestoreService.restoreFromDump`](../../src/import/import-restore.service.ts) 가 **이미 손에 쥐고 있는** `prepared.plan` 에서 요약을 derive 해 결과에 동봉하는 **한 겹** 만 닫는다 — 그 위층 (runner → job record → controller 응답 → audit row) 배선은 후속 slice 다.

**요약 산출 지점을 `$transaction` 앞에 두는 것이 본 slice 의 설계 결정** 이다. `summarizeRestorePlan` 은 입력 방어 위반 시 TypeError 를 throw 하는 계약이라, 커밋 **후** 에 호출하면 이론상 성공한 복원이 error 로 뒤집혀 job 이 FAILED 로 오기록될 수 있다. 파생을 실행 전에 두면 어떤 실패든 [UC-07](../use-cases/UC-07-export-import.md) §7.4 의 "transaction 시작 전 reject (DB 변경 0)" 단락 규율 안으로 들어온다 — 이 service 가 이미 `prepared.ok === false` 를 (4) 앞에서 단락시키는 것과 동일한 근거다.

**estimate 근거** — service 본문 변경 (import 1 + 결과 타입 1 + 파생 1 줄 + 근거 주석) ~30 LOC + spec 확장 (happy / 분기 / negative) ~70 LOC → base ~100, R-112 backbone × 1.5 → **~150 LOC / 2 파일** (cap 300 안, `sizeExempt` 불요). 선례 [T-1281](T-1281-import-restore-service.md) / [T-1284](T-1284-import-job-runner-service.md) 의 "한 겹만 합성" 형태와 동형.

## Required Reading

- [src/import/import-restore.service.ts](../../src/import/import-restore.service.ts) 전체 (72 줄) — **본 task 의 주 변경 대상**. `restoreFromDump(buffer, mode)` 의 4 단계 ((1) `collectFullExportRecords` → (2) `prepareImportRestorePlan` → (3) 실패 verdict 400 단락 → (4) `this.transaction.restore(prepared.plan)`) 와 머리 주석의 계약 (재랩핑·흡수 0 / REQ-032 message 규율 / 단락 순서) 을 그대로 보존한다.
- [src/export/import-restore-plan-summary.ts](../../src/export/import-restore-plan-summary.ts) 26~40 행 (`RestorePlanGroupBreakdown` / `RestorePlanSummary` 타입) + 100~133 행 (`summarizeRestorePlan` 계약) — 배선할 helper 의 정본. 입력 방어 3 종 (plan 이 plain object 아님 / 세 배열 중 하나가 배열 아님 / record 의 `instant` 가 유효 Date 아님) 은 **TypeError throw** 이고, 그 밖에는 non-mutating·throw 0 이다. **0 수정**.
- [src/import/import-restore-transaction.service.ts](../../src/import/import-restore-transaction.service.ts) 37~41 행 (`ImportRestoreTransactionResult = { outcomes, deleted, inserted }`) — 확장 대상 결과 shape 의 정본. **0 수정**.
- [src/import/import-restore-plan-prepare.ts](../../src/import/import-restore-plan-prepare.ts) 57~64 행 — 성공 verdict 가 `plan: ImportRestorePlan<FullExportRecord>` 를 싣는다. `summarizeRestorePlan(plan: ImportRestorePlan)` 의 default 제네릭 인자는 `ExportRecord` 이고 `FullExportRecord` 는 그 구조적 subtype 이라 **캐스팅 없이** 그대로 넘어간다 (`as` 금지). **0 수정**.
- [src/import/import-restore.service.spec.ts](../../src/import/import-restore.service.spec.ts) 전체 (266 줄) — **colocated spec, 본 task 의 두 번째 변경 대상**. 재사용할 구조: 23~28 행의 `jest.mock("../export/export-full-record-collect")` + `jest.mock("./import-restore-plan-prepare")` (plan 을 test 가 직접 통제할 수 있는 이유), 53 행 `makeService(...)` (prisma / transaction stub 주입), 123 행 `describe("ImportRestoreService.restoreFromDump")`. 기존 describe/it 문자열과 단언은 바꾸지 않고 **덧붙인다**.
- [src/import/import-job-runner.service.ts](../../src/import/import-job-runner.service.ts) 56~76 행 — 본 service 의 **유일한 호출처**. 새 필드를 읽지 않아도 컴파일·동작이 그대로여야 한다 (본 slice 는 runner 를 수정하지 않는다). **0 수정**.
- [docs/use-cases/UC-07-export-import.md](../use-cases/UC-07-export-import.md) §5 step 12 (90 행) + §8 (e) (133 행) — 본 배선이 향하는 계약 정본.

## Acceptance Criteria

- [ ] **변경 파일 2 개** — `src/import/import-restore.service.ts` + colocated spec `src/import/import-restore.service.spec.ts` **만**. `src/export/**` · `src/import/` 의 다른 파일 (runner · transaction service · controller · module) · `prisma/**` · `test/**` · `web/**` · `package.json` **0 수정**.
- [ ] **결과 타입 확장 1 개** — `import-restore.service.ts` 에 `ImportRestoreTransactionResult` 를 그대로 포함하고 `summary: RestorePlanSummary` 한 필드만 더한 **명시 export 타입** (예: `export interface ImportRestoreResult extends ImportRestoreTransactionResult { summary: RestorePlanSummary }`) 을 선언하고 `restoreFromDump` 의 반환 타입을 그것으로 바꾼다. 기존 3 필드 (`outcomes` / `deleted` / `inserted`) 의 이름·타입·값은 한 글자도 바뀌지 않는다 (runner 의 `restored.inserted` 가 그대로 컴파일·동작).
- [ ] **파생 지점은 `$transaction` 앞** — `summarizeRestorePlan(prepared.plan)` 호출을 성공 verdict 확인 **직후, `this.transaction.restore(...)` 호출 이전** 에 둔다. 근거 (helper 의 TypeError 가 커밋 후에 터지면 성공한 복원이 FAILED 로 오기록됨 + UC-07 §7.4 "transaction 시작 전" 규율) 를 **한국어 주석 2~3 줄** (§12) 로 그 지점에 남긴다.
- [ ] **재랩핑·흡수 0 계약 보존** — `summarizeRestorePlan` 의 TypeError 를 try/catch 로 흡수하거나 `BadRequestException` 으로 재랩핑하지 **않는다**. 인스턴스 그대로 전파한다 (이 module 머리 주석의 전파 계약 그대로). 캐스팅 (`as`) · 새 helper 신설 · plan 복제 · 요약 로직 재구현 **0** — 본 service 는 호출만 한다 (DRY).
- [ ] **happy-path unit test 1+** — 성공 verdict + `transaction.restore` 성공 시 반환값이 (a) 기존 3 필드를 transaction stub 의 반환 그대로 싣고, (b) `summary.deleted` / `summary.inserted` / `summary.kept` 각각의 `total` 과 `perEntity` 가 주입한 plan 의 세 배열에서 실측 집계된 값과 정확히 일치함을 단언한다 (`toEqual` 정확 일치 — 부분 매칭 금지). MERGE 성격의 plan (비어있지 않은 `toKeep`) 을 최소 1 개 test 에 쓴다 — 기존 결과 shape 로는 관측 불가하던 `kept` 가 본 slice 의 산출물임을 보이기 위함.
- [ ] **error path unit test 1+** — `transaction.restore` 가 reject (예: `ConflictException`) 하면 그 인스턴스가 **그대로** 전파되고 요약이 대신 반환되지 않음을 단언한다. 또한 `prepared.ok === false` 인 기존 거부 경로에서 `BadRequestException` message 가 종전과 동일하고 `transaction.restore` 가 **미호출** 임을 확인한다 (기존 단언 유지 + 요약 산출이 그 단락을 흐트러뜨리지 않음).
- [ ] **분기 cover** — (a) 요약 산출 성공 → transaction 호출 → 결과 동봉 경로, (b) 요약 산출 실패 (malformed plan) → **`transaction.restore` 가 호출되지 않음** (`expect(restore).not.toHaveBeenCalled()`) 경로, (c) 세 배열이 모두 빈 plan → `total` 이 전부 0 이고 `perEntity` 5 entity key 가 전부 존재하며 값이 0 인 정상 요약 (throw 0). mock 된 `prepareImportRestorePlan` 이 plan 을 통제하므로 세 분기 모두 mock 주입으로 결정론적으로 만든다.
- [ ] **negative cases 충분 cover** — 예외 상황마다 1+: (a) plan 의 `toKeep` 이 배열이 아닌 값 → helper 의 TypeError 가 **그대로** (재랩핑 0, `BadRequestException` 아님) 전파되고 DB 미접근, (b) plan 의 record `instant` 가 Invalid Date → 동일하게 TypeError 전파 + `transaction.restore` 미호출, (c) 반환 `summary` 가 주입한 plan 객체·배열을 **변형하지 않음** (호출 전후 plan 을 deep-equal 비교 — non-mutating), (d) 반환 `summary` 의 어느 문자열 필드에도 dump 원문 · record `fields` 값 · stack 이 실리지 않음 (REQ-032 — `summary` 는 숫자 집계뿐임을 구조로 단언), (e) 같은 입력으로 두 번 호출하면 동일 `summary` (idempotent).
- [ ] **기존 test 무회귀** — 기존 spec 의 describe/it 문자열·단언·`makeService` 본문·`jest.mock` factory 는 바꾸지 않는다. 반환 shape 확장으로 기존 단언이 깨지면 (`toEqual` 로 전체 객체를 비교하던 곳) **그 단언만** 새 필드를 포함하도록 최소 수정하고, 수정 사유를 PR body 에 한 줄 남긴다.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 변경한 `import-restore.service.ts` 는 line/branch/function 100% 유지.
- [ ] `prettier --check` 통과, `scripts/check-spec-presence.sh` 통과. PR CI 의 unit · smoke · e2e leg 전부 green — 특히 기존 e2e ([test/e2e/import-restore-http.e2e-spec.ts](../../test/e2e/import-restore-http.e2e-spec.ts)) 가 **0 수정** 으로 통과해야 한다 (외부 HTTP 계약 무변화의 증거).
- [ ] **diff 규율** — 총 diff ≤ 300 LOC / 2 파일. 초과가 예상되면 negative (e) → (c) 순으로 덜어내고 그 사실을 PR body + 본 task Follow-ups 에 박제한다. 그래도 초과면 멈추고 planner 에게 split 을 요청한다 (BLOCKED `task-too-large`).
- [ ] **엔진 결함 발견 시 수정 금지** — 배선 중 helper·transaction 쪽 결함 (예: `ImportRestorePlan<FullExportRecord>` 가 `summarizeRestorePlan` 인자로 컴파일되지 않음 · `perEntity` key 누락) 이 드러나면 `src/export/**` 를 고치지 말고 재현 조건을 Follow-ups + PR body 에 기록한 뒤 BLOCKED 로 종료한다 (planner 가 patch slice 를 큐잉).

## Out of Scope

- **runner / controller / job record 배선 0** — `ImportJobRunnerService` 가 `summary` 를 읽어 기록하거나, controller 응답 envelope 가 그것을 싣는 배선은 **후속 slice** (3c-4b 이후). 본 slice 는 service 반환 경계까지만이며 외부 HTTP 응답 shape 는 한 글자도 바뀌지 않는다.
- **Prisma schema / migration 0** — `ImportJob` 에 breakdown 컬럼을 추가하지 않는다 (schema 변경은 CLAUDE.md §5 상 BLOCKED 대상). 요약은 in-memory 반환값일 뿐 영속화하지 않는다.
- **Audit log row 영속화 0** — UC-07 §8 (e) 의 실 insert 경로는 범용 `AuditLog` model 부재로 사람 결정 대상 (Follow-ups 유지).
- **`summarizeRestorePlan` / `summarizeImportImpact` 본문 수정 0** — 집계 규칙·방어 분기·메시지 문구 전부 불변. 본 slice 는 호출만 한다.
- **e2e / smoke 추가 0** — 외부 관측 가능한 변화가 없어 e2e 로 확인할 사실이 없다. 후속 배선 slice 가 응답에 실을 때 e2e 를 추가한다.
- **`summarizeImportImpact` (T-0441) 배선 0** — dump 기준 영향 요약은 plan 기준 breakdown 과 다른 축이라 별도 slice.
- **`readonly TRecord[]` 전환 0** — T-1290 round 1 MINOR A (defer 합의) 는 소비처 동반 수정이라 본 slice 밖 (Follow-ups 유지).
- **`deploy/daily-test.sh` leg 추가 0** — leg 를 늘리면 drift-guard smoke spec 3 종 (T-0791 / T-0944 / T-0947) 동반 수정이 강제돼 파일 수 cap 을 넘긴다 (Q-0054 / T-1122 BLOCKED 선례).
- **새 ADR · 새 외부 dependency · `web/` UI 수정 0.**

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (본 slice 가 여는 다음 단추) **runner 배선** — `ImportJobRunnerService.runJob` 이 `restored.summary` 를 소비하는 경로. 단 `ImportJob` 에 저장할 컬럼이 없어 (schema 변경 = §5 BLOCKED) 응답 envelope 로 흘릴지 / audit 경로를 먼저 열지 판단이 선행돼야 한다 — planner 가 slice 순서를 결정한다.
- (유지, T-1293) **부분 dump + REPLACE 의 비선별 entity 삭제** — 사용자가 "Group 만 담긴 파일" 을 REPLACE 로 올리면 Person·Assessment 까지 증발한다. 부분 dump 에 REPLACE 를 막거나 경고해야 하는지는 제품 결정 — 사람 판단 대상. 본 slice 의 `summary.deleted.perEntity` 가 그 영향 범위를 처음으로 수치화한다.
- (유지, 3c-3d3) 크기 상한 413 e2e — 50 MiB 초과 업로드. **선행 확인 의무**: supertest 가 multer mid-stream abort 를 어떻게 표면화하는지 (ECONNRESET / EPIPE) 국소 확인 후, flaky 하면 기존 `multer-exception.filter.spec.ts` 의 실 파이프라인 경계로 만족시키고 e2e 는 포기하는 선택지를 planner 에 보고한다.
- (T-1290 round 1 MINOR A 이월) `ExportSelection` 의 `selected` / `excluded` 를 `readonly TRecord[]` 로 좁혀 배열 공변 unsoundness 를 닫는 slice — 소비처 4 곳 동반 수정 필요. 현 실 피해 0 이라 우선순위 낮음.
- (T-1291 → T-1293 이월) `selectExportRecords` 의 `RangeError` (손상 job row) 가 download 경로에서 **500** 으로 나간다 — 정상 경로 도달 불가하나 사용자 대면 status (409/422) 매핑 여부는 판단 필요.
- (미해결 정책, T-1287 → T-1293 이월) `LlmProviderConfig` 왕복 불가 — export full-record select 가 `apiKey` 를 제외 (ADR-0047 secret deny) 하는데 schema 의 `apiKey` 는 not-null 이라, 실 dump 에 그 entity 가 1 건이라도 있으면 복원 `$transaction` 이 통째로 실패할 것으로 예상된다. **복원 정책은 secret 처리 결정이라 CLAUDE.md §5 상 사람 결정 대상**.
- (관측, 이월) UC-07 §8 (b)(e) 가 요구하는 **Export / Import Audit log row 영속화 0** — 순수 helper `buildExportImportAuditEntry` (T-0443) 는 있으나 실 insert 경로가 없고, Prisma 에 범용 `AuditLog` model 자체가 없다. 도입은 schema migration 이라 §5 사람 결정 대상.
