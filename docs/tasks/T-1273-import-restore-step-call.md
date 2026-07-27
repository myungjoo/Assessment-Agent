---
id: T-1273
title: 복원 step → Prisma 호출 인자 조립 (실행 slice 3a/3)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 245
estimatedFiles: 2
created: 2026-07-28
independentStream: import-restore-engine
dependsOn: [T-1272]
touchesFiles:
  - src/import/import-restore-step-call.ts
  - src/import/import-restore-step-call.spec.ts
plannerNote: "R-112 backbone x 1.5 = 245 LOC. T-1272 실측 228(prod 58 : spec 170) · T-1271 297(120:177) 역산 — cap 안, sizeExempt 없음"
---

# T-1273 — 복원 step → Prisma 호출 인자 조립 (실행 slice 3a/3)

## Why

[ADR-0055](../decisions/ADR-0055-import-multipart-file-upload.md) §Follow-up (b) 복원 엔진 chain 의 종착점은 ADR-0044 §3 atomic `$transaction` 실 복원이다. 지금까지 실행 조각 세 개 — insert row 산출 (1/3, T-1270) · delete instant 목록 (2a, T-1271) · delete `where` 조립 (2b, T-1272) — 이 닫혔고, 남은 것은 **실 runner** 다.

그런데 runner 는 (a) step 마다 어느 builder 를 부를지 고르는 dispatch, (b) `delegate` 이름으로 Prisma client 를 인덱싱하는 배선, (c) `$transaction` 실행·rollback 을 한꺼번에 떠안는다. T-1270 이 est 340 대비 실측 573 으로 초과하며 reviewer 가 **재초과 시 BLOCKER 격상** 을 예고했으므로, runner 를 통째로 한 slice 에 넣지 않고 **순수한 (a) 를 먼저 떼어낸다**. 본 slice 는 Prisma client 를 잡지 않는 마지막 순수 조각이며, 다음 slice (3b) 는 여기서 나온 호출 서술을 tx client 에 그대로 태우는 얇은 배선만 남는다.

**estimate 근거** — T-1272 실측 **228 LOC (production 58 : spec 170 = 1 : 2.93)**, T-1271 실측 **297 (120 : 177 = 1 : 1.48)**. 본 slice 는 분기가 두 갈래 (delete / insert) 라 production 이 2b 보다 커서 ~80, spec 은 관측 비율 중간값 (~2.1) 을 적용해 ~165 → 총 **~245**. **cap (300 LOC / 5 파일) 안이라 `sizeExempt` 를 쓰지 않는다.**

## Required Reading

- [src/import/import-restore-delete-where.ts](../../src/import/import-restore-delete-where.ts) — 직전 slice (2b). 본 helper 가 delete 갈래에서 `buildImportRestoreDeleteWhere(step)` 을 **그대로 호출** 한다. `tokenOf` / `isOwnExportEntity` 규약 · 한국어 throw 계약 · 비변형 규약 · 헤더 주석 분량 (12 행) 을 mirror 한다.
- [src/import/import-restore-insert-rows.ts](../../src/import/import-restore-insert-rows.ts) 177~196 행 — insert 갈래에서 호출할 `buildImportRestoreInsertRows(step): Record<string, unknown>[]`. 이쪽 `assertInsertStep` 은 `phase` / `method` / `records` / `fields` 를 보지만 **`step.entity` 유효성은 검사하지 않는다** — 2b 와 달리 entity 를 아예 읽지 않기 때문이다. 따라서 insert 갈래의 entity 검증은 **본 slice 의 책임** 이다.
- [src/import/import-restore-steps.ts](../../src/import/import-restore-steps.ts) 57~72 행 — `ImportRestoreStepMethod` / `ImportRestoreTransactionStep` 정의 (본 helper 의 입력 타입). step 에 이미 `delegate` / `model` 이 실려 있으나 그것은 `planImportRestoreTransactionSteps` 가 표에서 채운 값이라, 손조립 step 에서는 표와 어긋날 수 있다 (본 slice 의 drift 계약 근거).
- [src/export/export-entity-sources.ts](../../src/export/export-entity-sources.ts) 25~41 행 (`ExportEntityDelegate` / `ExportEntitySource`) + 69 행 이후 `EXPORT_ENTITY_SOURCES` 표 — `delegate` 를 얻는 단일 source. 표는 `Object.freeze` 된 **plain object** 라 `in` 연산자 조회는 prototype 속성 (`constructor` 등) 을 오탐한다.
- [src/import/import-restore-delete-where.spec.ts](../../src/import/import-restore-delete-where.spec.ts) — colocated spec 선례 (170 행). 본 task 의 신규 spec 은 **[src/import/import-restore-step-call.spec.ts](../../src/import/import-restore-step-call.spec.ts) (colocated)** 위치가 의무이며, fixture builder 단일화 · `it.each` 표 압축 패턴을 그대로 따른다.

## Acceptance Criteria

- [ ] 신규 파일 [src/import/import-restore-step-call.ts](../../src/import/import-restore-step-call.ts) 에 순수 함수 `buildImportRestoreStepCall(step: ImportRestoreTransactionStep): ImportRestoreStepCall` 과 그 반환 타입 `ImportRestoreStepCall` 을 export 한다. 반환 shape 은 `{ delegate: ExportEntityDelegate; method: ImportRestoreStepMethod; args: { where: ... } | { data: ... } }` 이며, `args` 는 discriminated 하게 delete → `{ where }` · insert → `{ data }` 다. 파일 상단 주석에 chain 위치 (3a) 와 책임 경계 (Prisma client 0 / `$transaction` 0 / 값 조립 0 — 1/3 · 2b 위임) 를 적되 **주석 총 18 행 이내** 로 압축한다.
- [ ] **값 조립 위임** — `where` / `data` 를 직접 만들지 않고 `buildImportRestoreDeleteWhere(step)` · `buildImportRestoreInsertRows(step)` 을 호출해 얻는다 (검증·조립 로직 사본 0). 두 builder 의 한국어 throw (`phase` / `method` / 빈 `records` / record entity 불일치 / 비-Date instant / `fields` 위반) 는 **그대로 전파** 되며 본 helper 가 감싸거나 메시지를 바꾸지 않는다 (전파를 test 로 pin — 메시지 prefix 가 각각 `collectImportRestoreDeleteInstants:` / `buildImportRestoreInsertRows:` 임을 단언해 재랩핑 회귀 차단).
- [ ] **dispatch 계약** — 갈래 선택은 `step.phase` 로만 한다 (`"delete"` → `buildImportRestoreDeleteWhere` + `method: "deleteMany"`, `"insert"` → `buildImportRestoreInsertRows` + `method: "createMany"`). `phase` 가 두 literal 밖 (`undefined` · `null` · 비-string · `"DELETE"` 대문자 · 미지 값) 이면 **어느 builder 도 부르기 전에** 본 helper 의 한국어 `RangeError` 로 거부한다 (builder 를 먼저 부르면 어느 쪽 메시지가 나올지 입력에 따라 흔들려 계약이 모호해진다).
- [ ] **entity → delegate 계약 (본 slice 고유)** — `delegate` 는 `step.delegate` 를 그대로 믿지 않고 `EXPORT_ENTITY_SOURCES[step.entity].delegate` 에서 읽는다. entity 판정은 `Object.prototype.hasOwnProperty.call` 로 하고 (`in` 연산자 · 직접 인덱싱 금지 — `"constructor"` / `"__proto__"` 가 유효 entity 로 오탐되면 `delegate` 가 `undefined` 가 되어 하류 runner 가 tx client 를 `undefined` key 로 인덱싱한다), 자기 속성이 아니면 한국어 `RangeError`. insert 갈래는 하류 builder 가 entity 를 아예 안 보므로 **이 검사가 유일한 그물** 이다.
- [ ] **delegate drift 계약** — `step.delegate` 가 존재하는데 표에서 읽은 값과 다르면 한국어 `RangeError` 로 거부한다 (조용히 표 값으로 덮어쓰지 않는다 — 손조립 step 의 매핑 오류를 알리기만 한다). `planImportRestoreTransactionSteps` 가 만든 step 은 표에서 채워지므로 정상 경로에서는 절대 발동하지 않음을 chain 합성 test 로 실증한다.
- [ ] **비변형 규약** — 입력 step / records / Date / `fields` / `EXPORT_ENTITY_SOURCES` 를 변형하지 않는다 (freeze 된 입력으로 호출해도 통과). 반환 객체를 호출자가 변형해도 표와 입력이 오염되지 않음을 test 로 단언한다. `args` 안의 `Date` · `fields` 값은 하류 builder 가 정한 identity 규약 (Date 는 입력 instance 그대로, row 값은 불투명 통과) 을 그대로 유지한다.
- [ ] **REQ-032 정합** — error 메시지에 record 원본 · `instant` 값 · `fields` 값 · stack 을 싣지 않는다 (비-string 은 `typeof` / 타입 이름만 노출). 2b 의 `tokenOf` 동형 helper 를 쓰되 **사본임을 주석에 명시** 한다. `"leak-me"` 를 payload 자리에 투입해도 메시지에 나타나지 않음을 되돌림 감지 negative test 로 pin 한다.
- [ ] **happy-path unit test 1+** — 정상 delete step 은 `{ delegate: 표 값, method: "deleteMany", args: { where: { createdAt: { in: [...] } } } }`, 정상 insert step 은 `{ delegate: 표 값, method: "createMany", args: { data: [row...] } }` 임을 단언한다. `groupImportRestoreOperations` → `planImportRestoreTransactionSteps` → 본 helper 로 이어지는 chain 합성 test 1+ 을 두어 실제 step 이 두 갈래 모두 통과함을 실증한다. 5 entity 전부에 대해 `delegate` 가 표의 값과 일치함을 `it.each` 표 1 개로 cover.
- [ ] **error path unit test 1+** — step 이 `null` / `undefined` / 원시값 / 배열인 경우 한국어 `TypeError` 또는 `RangeError` 로 거부되고 (본 helper 의 phase 판정이 먼저 걸린다), 부분 결과 (`args` 없이 `delegate` 만 담긴 객체 등) 가 반환되는 경로가 없음을 단언한다.
- [ ] **분기 cover** — 분기마다 1+ test: phase=delete / phase=insert / phase 무효 (거부) / entity 무효 (거부) / entity 가 prototype 속성 (거부) / delegate drift (거부) / 하류 builder throw 전파 (delete · insert 각 1).
- [ ] **negative cases 충분 cover** — 예외·경계 분기마다 1+ 이되 `it.each` 표로 압축한다: (a) `phase` 가 `undefined` · `null` · 비-string · `"DELETE"` · 미지 literal 각각 `RangeError` 이고 **하류 builder 가 호출되지 않음** (jest spy 또는 호출 시 throw 하는 fixture 로 단언, 표 1 개), (b) `entity` 가 `undefined` · 비-string · 소문자 오타 (`"person"`) · 미지 literal · `"constructor"` · `"__proto__"` · `"toString"` 각각 `RangeError` 이고 반환값에 `undefined` delegate 가 생기지 않음 (표 1 개, delete · insert 두 phase 모두), (c) `step.delegate` 가 표와 다른 값 (`"person"` ↔ Assessment 등) · 비-string 이면 `RangeError` (표 1 개), (d) 빈 `records` · record entity 불일치 · 비-Date instant · `fields` 비-plain-object 가 하류 메시지 그대로 전파 (표 1 개), (e) freeze 된 step / records / Date / `fields` 로 호출해도 통과 + 입력 비변형, (f) 같은 입력 2 회 호출 시 동일 결과 (idempotent) 이며 반환 객체 · `args` 는 서로 다른 instance, (g) 반환 `args` 를 호출자가 변형해도 입력 `records` · `EXPORT_ENTITY_SOURCES` 가 오염되지 않음.
- [ ] **다른 파일 0 수정** — 기존 module 을 한 줄도 고치지 않고 `pnpm build` 통과. compile 이 깨지면 임의 수정 대신 PR body + 본 task Follow-ups 에 박제하고 planner 에게 넘긴다.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 신규 파일은 statement/branch/function/line 100% 목표 (동일 chain 선례 T-1255~T-1272 동형).
- [ ] `scripts/check-spec-presence.sh` 통과, `prettier --check` 통과.
- [ ] **diff 규율 (T-1270 reviewer MINOR-1 회수 — 재초과 시 BLOCKER 예고 유효)** — production ≤ **85 LOC**, spec ≤ **195 LOC**, **총 diff ≤ 280 LOC** 를 지킨다. fixture 는 delete · insert 각 1 개 builder 로 재사용하고 반복 단언은 `it.each` 표로 압축한다. 280 초과가 예상되면 **임의로 넘기지 말고** negative (f)/(g) 를 다음 slice 로 미루거나 planner 에게 split 을 요청한다.

## Out of Scope

- **실 `$transaction` 실행 / Prisma client · PrismaService 주입 / tx client 인덱싱 / rollback regression** — 실행 slice 3b. 본 slice 는 **호출 서술만** 만든다.
- insert row 산출 (`buildImportRestoreInsertRows`) · delete `where` 조립 (`buildImportRestoreDeleteWhere`) · instant 목록 산출 수정 — T-1270 ~ T-1272 에서 shipped. 본 slice 는 **호출만** 한다.
- `EXPORT_ENTITY_SOURCES` 표 자체 수정 · `delegate` / `instantColumn` 값 변경 · entity 추가 — 본 slice 는 read-only 소비자다.
- `import-restore-steps.ts` 의 `ImportRestoreTransactionStep` 필드 추가 · 타입 파라미터화 — T-1270 에서 런타임 guard 로 대체하기로 확정했으므로 **하지 않는다**.
- `import.controller.ts` 의 interim false-success guard (T-1254) 교체 · service 배선 · DTO 변경 — 복원 pipeline 이 실제로 도는 slice 이후.
- Prisma schema 변경 · migration · 새 외부 dependency (0 건).
- `describeReceived` · `tokenOf` · `kindOf` 사본 공용 module 추출, spec fixture helper 공용화 — 별도 위생 slice (chain 상 사본 5 개째, 우선순위 상향 상태).
- raw NUL 보유 나머지 tracked 파일 정리 / 제어 바이트 금지 CI 가드 (T-1267 Follow-ups).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (예고) 실행 slice **3b/3** — 실 `$transaction` runner. 본 slice 가 만든 `ImportRestoreStepCall` 배열을 Prisma tx client 에 태우는 배선 (`tx[delegate][method](args)`) + rollback regression. 여기서 처음 DB 를 잡으므로 mock Prisma unit 과 e2e 를 분리할지 그때 재산정한다.
- (예고) 실행 slice **3c** — `import-job.service.ts` / `import.controller.ts` 재배선 (T-1254 interim `markFailed` guard 를 실 복원 pipeline 으로 교체) + import UI false-success 상태 해소.
- (이월, 비차단) `tokenOf` / `kindOf` / `describeReceived` / `describeFieldsKind` 사본이 chain 안에서 5 개째 — 공용 module 추출 위생 slice 우선순위 상향 (T-1271 NIT-2, T-1265 NIT-1).
- (이월, 비차단) [src/import/import-restore-insert-rows.spec.ts](../../src/import/import-restore-insert-rows.spec.ts) 199 · 215 행의 `for (const [, value] of ...)` 가 표의 label 을 버려 실패 case 식별 불가 (T-1270 reviewer 잔여 NIT). touchesFiles 밖이라 위생 slice 대기.
- (이월, 비차단) `dumpWithRecords` 계열 spec fixture helper 가 chain 안에서 6 번째 사본에 가까워졌다 — test fixture 공용 module 추출 (T-1269 reviewer NIT-1).
- (이월, 비차단) `src/import/import-restore-input.spec.ts` fixture helper 의 `entity in entityCounts` → `Object.prototype.hasOwnProperty.call` (T-1268 reviewer NIT-5).
