---
id: T-1274
title: 복원 step 배열을 tx client 위에서 실행 (실행 slice 3b-1/3)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 275
estimatedFiles: 2
created: 2026-07-28
independentStream: import-restore-engine
dependsOn: [T-1273]
touchesFiles:
  - src/import/import-restore-run-steps.ts
  - src/import/import-restore-run-steps.spec.ts
plannerNote: "R-112 backbone x 1.5 = 275 LOC. T-1273 실측 280(prod 88 : spec 192) 역산 — cap 안, sizeExempt 없음"
completedAt: 2026-07-28
mergedAs: 0aa2850c7dd20e95dcee760493a6c30dd8e4e7d2
prNumber: 1165
reviewRounds: 1
---

# T-1274 — 복원 step 배열을 tx client 위에서 실행 (실행 slice 3b-1/3)

## Why

[ADR-0055](../decisions/ADR-0055-import-multipart-file-upload.md) §Follow-up (b) 복원 엔진 chain 의 종착점은 [ADR-0044](../decisions/ADR-0044-export-import-job-persistence.md) §3 atomic `$transaction` 실 복원이다. 실행 조각 네 개 — insert row 산출 (1/3, T-1270) · delete instant 목록 (2a, T-1271) · delete `where` 조립 (2b, T-1272) · 호출 서술 dispatch (3a, T-1273) — 가 닫혔고, 이제 **그 서술을 실제로 부르는 runner** 만 남았다.

T-1273 Follow-ups 는 3b 를 "`tx[delegate][method](args)` 배선 + rollback regression" 으로 예고했다. 그런데 그 한 조각 안에는 (a) step 배열을 순차로 실행하며 결과를 모으는 runner 와 (b) `PrismaService.$transaction` 을 열고 rollback 을 책임지는 service 배선이 함께 들어있다. T-1270 이 est 340 대비 실측 573 으로 초과하며 reviewer 가 **재초과 시 BLOCKER 격상** 을 예고했으므로 3b 를 둘로 나눈다. 본 slice **3b-1** 은 **tx client 를 인자로 받기만 하는 runner** 라 PrismaService · NestJS DI · DB 를 잡지 않고 mock 만으로 전량 검증되며, 다음 slice 3b-2 가 실 `$transaction` 을 열어 본 runner 를 그 안에서 한 번 부르는 얇은 배선으로 남는다.

**estimate 근거** — T-1273 실측 **280 LOC (production 88 : spec 192 = 1 : 2.18)**, T-1272 실측 **228 (58 : 170)**. 본 slice 는 async 실행 · tx surface guard 가 붙어 production 이 3a 와 비슷한 ~95, spec 은 관측 비율 (~1.9) 을 적용해 ~180 → 총 **~275**. **cap (300 LOC / 5 파일) 안이라 `sizeExempt` 를 쓰지 않는다.**

## Required Reading

- [src/import/import-restore-step-call.ts](../../src/import/import-restore-step-call.ts) — 직전 slice (3a) 전량. 본 runner 가 step 마다 `buildImportRestoreStepCall(step)` 을 **그대로 호출** 해 `{ delegate, method, args }` 를 얻는다. `tokenOf` 규약 · 한국어 throw 계약 · 비변형 규약 · 헤더 주석 분량 (8 행) 을 mirror 한다.
- [src/import/import-restore-steps.ts](../../src/import/import-restore-steps.ts) 57~72 행 — `ImportRestoreStepMethod` / `ImportRestoreTransactionStep` 정의 (본 runner 입력 배열의 원소 타입). 배열의 **delete-before-insert 순서 계약은 `planImportRestoreTransactionSteps` (T-1264) 가 이미 검증** 하므로 본 runner 는 재검증도 재정렬도 하지 않는다.
- [src/export/export-entity-sources.ts](../../src/export/export-entity-sources.ts) 25~41 행 — `ExportEntityDelegate` union 5 값 (`assessment` / `person` / `group` / `llmProviderConfig` / `permissionDeniedRecord`). 본 runner 의 tx client surface 타입 key 가 이 union 이다.
- [src/assessment-evaluation/evaluation-result-persist.service.ts](../../src/assessment-evaluation/evaluation-result-persist.service.ts) 83~125 행 — 기존 `PrismaTransactionClient` 최소 surface 타입 + `tx as PrismaTransactionClient` 캐스팅 선례. 본 slice 는 PrismaService 를 잡지 않지만 **surface 타입을 좁게 선언하고 캐스팅은 호출자 (3b-2) 몫으로 미루는 패턴** 을 그대로 따른다.
- [src/import/import-restore-step-call.spec.ts](../../src/import/import-restore-step-call.spec.ts) — colocated spec 선례 (192 행). 본 task 의 신규 spec 은 **[src/import/import-restore-run-steps.spec.ts](../../src/import/import-restore-run-steps.spec.ts) (colocated)** 위치가 의무이며, fixture builder 단일화 · `it.each` 표 압축 패턴을 그대로 따른다.

## Acceptance Criteria

- [ ] 신규 파일 [src/import/import-restore-run-steps.ts](../../src/import/import-restore-run-steps.ts) 에 다음을 export 한다: 최소 surface 타입 `ImportRestoreDelegateClient` (`deleteMany` / `createMany` 가 각각 `args` 1 개를 받아 `Promise<{ count: number }>` 를 돌려주는 형태), `ImportRestoreTxClient` (`Record<ExportEntityDelegate, ImportRestoreDelegateClient>` 기반), 결과 타입 `ImportRestoreStepOutcome` (`{ entity, phase, delegate, method, count }`), 그리고 `async runImportRestoreSteps(tx: ImportRestoreTxClient, steps: readonly ImportRestoreTransactionStep[]): Promise<ImportRestoreStepOutcome[]>`. 파일 상단 주석에 chain 위치 (3b-1) 와 책임 경계 (`$transaction` 열기 · PrismaService 주입 · rollback 매핑 0 — 3b-2 위임 / 값·서술 조립 0 — 3a 위임) 를 적되 **주석 총 18 행 이내** 로 압축한다.
- [ ] **서술 조립 위임** — `delegate` / `method` / `args` 를 직접 만들지 않고 step 마다 `buildImportRestoreStepCall(step)` 을 호출해 얻는다 (dispatch · entity 판정 · drift 검사 사본 0). 3a 와 그 하류의 한국어 throw (`phase` / `entity` / `delegate` drift / 빈 `records` / 비-Date instant / `fields` 위반) 는 **그대로 전파** 되며 본 runner 가 감싸거나 메시지를 바꾸지 않는다 (전파를 test 로 pin — 메시지 prefix 가 `buildImportRestoreStepCall:` 등 하류 것임을 단언해 재랩핑 회귀 차단).
- [ ] **순차 실행 계약** — `for...of` + `await` 로 **주어진 순서 그대로 한 번에 하나씩** 부른다. `Promise.all` · `map(async ...)` 병렬 실행 **금지** (delete-before-insert FK 순서가 깨지면 `Assessment.personId → Person` 필수 FK 가 중간 상태에서 터진다). 순서 검증 · 재정렬은 하지 않는다 (T-1264 몫). 호출 순서가 입력 순서와 일치함을 mock 호출 로그로 단언한다.
- [ ] **fail-fast 계약** — 어느 step 이 throw / reject 하면 **즉시 중단** 하고 그 error 를 그대로 전파한다. 남은 step 은 호출하지 않으며 (mock 호출 횟수로 단언), 부분 결과 배열을 반환하는 경로가 없다. 이미 수행된 호출의 되돌리기 (rollback) 는 시도하지 않는다 — `$transaction` 이 할 일이라 여기서 흉내내면 이중 보상이 된다 (주석에 명시).
- [ ] **tx surface guard** — `tx` 가 객체가 아니면 (`null` / `undefined` / 원시값) 한국어 `TypeError`, `tx[delegate]` 가 없거나 그 위의 `method` 가 함수가 아니면 한국어 `TypeError` 로 **어느 호출도 하기 전에** 거부한다 (3a 가 delegate 를 표에서만 읽으므로 여기서 걸리는 것은 tx 쪽 결함이다). `steps` 가 배열이 아니면 한국어 `TypeError`. 메시지에는 `delegate` / `method` 이름과 step index 만 싣는다.
- [ ] **결과 계약** — `count` 는 delegate 반환값의 `count` 를 읽되 그것이 number 가 아니면 (누락 · `undefined` · 비-number · 반환값이 `null`) 한국어 `TypeError` 로 거부한다 (조용히 0 으로 대체하면 복원이 안 된 것을 성공으로 보고한다). 반환 배열은 입력 step 과 **같은 길이 · 같은 순서** 이며, 빈 배열 입력은 tx 호출 0 회 + `[]` 반환이다.
- [ ] **비변형 규약** — 입력 `steps` 배열 / step / records / `Date` / `fields` 와 `tx` 객체를 변형하지 않는다 (freeze 된 입력으로 호출해도 통과). 반환 outcome 배열을 호출자가 변형해도 입력이 오염되지 않음을 test 로 단언한다.
- [ ] **REQ-032 정합** — error 메시지에 record 원본 · `instant` 값 · row 값 · `fields` 값 · stack 을 싣지 않는다 (비-string 은 `typeof` / 타입 이름만). Prisma / delegate 가 던진 error 는 **감싸지 않고 그대로 전파** 한다 (메시지 가공 0 — 매핑은 3b-2 · 3c 몫). `"leak-me"` 를 payload 자리에 투입해도 본 runner 가 만든 메시지에 나타나지 않음을 되돌림 감지 negative test 로 pin 한다.
- [ ] **happy-path unit test 1+** — delete 2 건 + insert 2 건이 섞인 정상 step 배열을 mock tx 로 실행해 (a) 호출 순서가 입력 순서와 동일, (b) 각 호출의 `args` 가 3a 산출과 동일 (`{ where: { createdAt: { in: [...] } } }` / `{ data: [row...] }`), (c) 반환 outcome 이 `{ entity, phase, delegate, method, count }` 로 채워짐을 단언한다. `groupImportRestoreOperations` → `planImportRestoreTransactionSteps` → 본 runner 로 이어지는 chain 합성 test 1+ 로 실제 step 이 통과함을 실증하고, 5 entity 전부가 표의 delegate key 로 인덱싱됨을 `it.each` 표 1 개로 cover 한다.
- [ ] **error path unit test 1+** — `tx` 가 `null` / `undefined` / 원시값, `steps` 가 `null` / 비배열인 경우 한국어 `TypeError` 로 거부되고 어떤 delegate 도 호출되지 않으며 (호출 0 단언) 부분 결과가 반환되지 않음을 단언한다.
- [ ] **분기 cover** — 분기마다 1+ test: delete 갈래 실행 / insert 갈래 실행 / 빈 배열 (호출 0) / tx 비-객체 (거부) / delegate 누락 (거부) / method 비-함수 (거부) / `count` 비-number (거부) / 하류 builder throw 전파 / delegate reject 전파.
- [ ] **negative cases 충분 cover** — 예외·경계 분기마다 1+ 이되 `it.each` 표로 압축한다: (a) `tx` 가 `undefined` · `null` · number · string 각각 `TypeError` + 호출 0 (표 1 개), (b) `tx` 에서 필요한 delegate key 를 뺀 경우 · 그 key 값이 `null` · `method` 가 없음 · `method` 가 비-함수 각각 `TypeError` 이고 **그 step 이전 호출만 일어났음** (표 1 개), (c) delegate 반환이 `undefined` · `null` · `{}` · `{ count: "3" }` 각각 `TypeError` (표 1 개), (d) 무효 `phase` · 무효 `entity` · `delegate` drift · 빈 `records` · 비-Date instant 가 하류 메시지 그대로 전파되고 **tx 호출 0** (표 1 개), (e) 배열 중간 step 의 delegate 가 reject 하면 그 error 가 전파되고 이후 step 호출 0 · 이전 호출의 되돌리기 시도 0, (f) freeze 된 steps / step / records / Date / tx 로 호출해도 통과 + 입력 비변형, (g) 반환 outcome 배열 · 원소를 호출자가 변형해도 입력 step 이 오염되지 않고, 같은 입력 2 회 호출 시 동일 결과이되 반환 배열은 서로 다른 instance.
- [ ] **다른 파일 0 수정** — 기존 module 을 한 줄도 고치지 않고 `pnpm build` 통과. compile 이 깨지면 임의 수정 대신 PR body + 본 task Follow-ups 에 박제하고 planner 에게 넘긴다.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 신규 파일은 statement/branch/function/line 100% 목표 (동일 chain 선례 T-1255~T-1273 동형).
- [ ] `scripts/check-spec-presence.sh` 통과, `prettier --check` 통과.
- [ ] **diff 규율 (T-1270 reviewer MINOR-1 회수 — 재초과 시 BLOCKER 예고 유효)** — production ≤ **100 LOC**, spec ≤ **185 LOC**, **총 diff ≤ 285 LOC** 를 지킨다. mock tx 는 호출 로그를 남기는 단일 factory 1 개로 재사용하고 반복 단언은 `it.each` 표로 압축한다. 285 초과가 예상되면 **임의로 넘기지 말고** negative (f)/(g) 를 다음 slice 로 미루거나 planner 에게 split 을 요청한다.

## Out of Scope

- **`PrismaService` 주입 / `$transaction` 열기 / `tx as ImportRestoreTxClient` 캐스팅 / rollback regression / Prisma error → HTTP exception 매핑** — 실행 slice 3b-2. 본 slice 는 **주어진 tx 위에서 부르기만** 한다.
- 호출 서술 조립 (`buildImportRestoreStepCall`) · `where` · row 산출 수정 — T-1270 ~ T-1273 에서 shipped. 본 slice 는 **호출만** 한다.
- step 배열의 delete-before-insert 순서 **검증 · 재정렬** — T-1264 `planImportRestoreTransactionSteps` 몫. 본 runner 는 받은 순서를 그대로 실행한다.
- `EXPORT_ENTITY_SOURCES` 표 · `ImportRestoreTransactionStep` 필드 수정 · 타입 파라미터화 — 본 slice 는 read-only 소비자다.
- `import-job.service.ts` / `import.controller.ts` 재배선 · interim false-success guard (T-1254) 교체 · DTO 변경 — 실행 slice 3c.
- e2e / smoke spec 추가 (실 DB 왕복) — 3b-2 가 실 `$transaction` 을 잡을 때 mock unit 과 함께 재산정한다.
- Prisma schema 변경 · migration · 새 외부 dependency (0 건).
- `tokenOf` · `describeReceived` · `kindOf` 사본 공용 module 추출, spec fixture helper 공용화 — 별도 위생 slice (chain 상 사본 6 개째, 우선순위 상향 상태).
- raw NUL 보유 나머지 tracked 파일 정리 / 제어 바이트 금지 CI 가드 (T-1267 Follow-ups).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (예고) 실행 slice **3b-2/3** — `PrismaService.$transaction` 안에서 본 runner 를 1 회 호출하는 service 배선 + tx client 캐스팅 + rollback regression (실패 step 이후 DB 원상 복귀). 여기서 처음 DB 를 잡으므로 mock unit 과 e2e 분리를 그때 재산정한다.
- (이월, 비차단, 3b-2 로 지정) [src/import/import-restore-run-steps.ts](../../src/import/import-restore-run-steps.ts) 의 tx surface guard 가 step 별 lazy 검사라 `steps[1]` 의 delegate 결함이 `steps[0]` 실행 **후** 에 드러난다 (T-1274 reviewer NIT-1). negative AC 의 "그 step 이전 호출만 일어났음" 과는 정합하며 실제 안전성은 3b-2 의 `$transaction` rollback 이 담보 — 3b-2 에서 그 전제를 주석/test 로 이어 박제한다.
- (이월, 비차단, 3b-2 로 지정) 같은 파일의 `typeof table !== "object"` 가 함수형 tx 와 배열을 통과시켜 tx 메시지 대신 delegate 메시지로 거부된다 — 진단이 한 단계 늦을 뿐 기능 영향 0 (T-1274 reviewer NIT-2). 본 PR 에서 in-PR fix 하지 않은 이유는 diff 가 이미 299/300 이라 cap 초과.
- (planner 조치 요청) 본 chain 의 실측 production : spec 비율이 **1 : 2.1** 로 안정화됐다 (T-1272 58:170, T-1273 88:192, T-1274 96:203). 이후 slice 의 spec LOC 가이드를 그 비율로 재산정할 것 — 가이드가 계속 과소면 매 slice 형식 위반이 반복된다 (T-1274 reviewer MINOR-1: 가이드 285 대비 실측 299, CLAUDE.md §3 hard cap 300 은 준수).
- (예고) 실행 slice **3c** — `import-job.service.ts` / `import.controller.ts` 재배선 (T-1254 interim `markFailed` guard 를 실 복원 pipeline 으로 교체) + import UI false-success 상태 해소.
- (이월, 비차단) `tokenOf` / `kindOf` / `describeReceived` / `describeFieldsKind` 사본이 chain 안에서 6 개째 — 공용 module 추출 위생 slice 우선순위 상향 (T-1271 NIT-2, T-1265 NIT-1).
- (이월, 비차단) [src/import/import-restore-insert-rows.spec.ts](../../src/import/import-restore-insert-rows.spec.ts) 199 · 215 행의 `for (const [, value] of ...)` 가 표의 label 을 버려 실패 case 식별 불가 (T-1270 reviewer 잔여 NIT). touchesFiles 밖이라 위생 slice 대기.
- (이월, 비차단) `dumpWithRecords` 계열 spec fixture helper 가 chain 안에서 7 번째 사본에 가까워졌다 — test fixture 공용 module 추출 (T-1269 reviewer NIT-1).
- (이월, 비차단) `src/import/import-restore-input.spec.ts` fixture helper 의 `entity in entityCounts` → `Object.prototype.hasOwnProperty.call` (T-1268 reviewer NIT-5).
