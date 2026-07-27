---
id: T-1270
title: 복원 insert step 의 createMany data row 순수 builder (실행 slice 1/3)
phase: P5
status: DONE
completedAt: 2026-07-27T20:07:00Z
prNumber: 1161
mergeCommit: 3254c75f
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 340
estimatedFiles: 2
created: 2026-07-28
independentStream: import-restore-engine
dependsOn: [T-1269]
touchesFiles:
  - src/import/import-restore-insert-rows.ts
  - src/import/import-restore-insert-rows.spec.ts
sizeExempt: true
exemptReason: "production 신규 module 은 ~85 LOC 로 cap 안. 초과분은 전량 colocated spec — 동일 chain 의 spec 실측(T-1266 313 / T-1268 294 / T-1269 ~320)을 근거로 산정했고, T-1264 형(신규 module + R-112 전면 cover) 이 679 까지 갔던 선례를 피하려고 실행 slice 를 3 조각(insert row / delete where / 실 runner)으로 미리 쪼갠 결과다."
plannerNote: "cap-bend pre-justified: R-112 backbone x 1.5 = 340 LOC, 선례 T-1269 실측 344 — 실행 slice 1/3 (createMany row builder)"
---

# T-1270 — 복원 insert step 의 createMany data row 순수 builder (실행 slice 1/3)

## Why

[ADR-0055](../decisions/ADR-0055-import-multipart-file-upload.md) §Follow-up (b) 복원 엔진 chain 의 마지막 남은 조각은 **ADR-0044 §3 atomic `$transaction` 실 복원** 이다. 직전 T-1269 로 `prepareImportRestorePlan` 의 성공 갈래가 `ImportRestorePlan<FullExportRecord>` 까지 좁혀져 `fields` 가 plan 경계를 통과하게 됐고, T-1264 의 `planImportRestoreTransactionSteps` 가 "어느 delegate 의 어느 메서드를 어떤 순서로" 까지 서술한다. 그런데 실제로 `prisma.<delegate>.createMany({ data })` 를 부르려면 **step 의 record 배열을 Prisma row payload 배열로 옮기는 한 겹** 이 아직 없다 — step 은 `{ entity, instant, fields }` 를 들고 있고 `createMany` 가 원하는 건 `fields` 그 자체다.

본 slice 는 그 **순수 변환만** 담당한다. 실행 slice 를 통째로 한 task 에 담으면 (row 산출 + delete `where` 산출 + Prisma client 배선 + rollback regression) T-1264 형 신규 module 이 실측 679 LOC 까지 갔던 전례를 그대로 밟게 되므로 — T-1269 reviewer MINOR-1 (3 slice 연속 cap-bend 경고) 에 따라 **실행 slice 를 3 조각 (1/3 insert row 산출 · 2/3 delete `where` 산출 · 3/3 실 `$transaction` runner) 으로 미리 쪼갠 첫 조각** 이다. Prisma client · DB · `$transaction` 은 본 slice 에서 0 이다.

설계 결정 1 건을 본 slice 가 확정한다 — `ImportRestoreTransactionStep.records` 는 `ExportRecord[]` (fields 없음) 로 선언돼 있으므로, `fields` 를 꺼내는 지점에서 **`import-restore-ops.ts` / `import-restore-steps.ts` 를 phase 판별 union 으로 타입 파라미터화하는 대신 런타임 narrowing guard 를 쓴다**. 근거: 여기가 DB 로 값이 넘어가는 마지막 경계라 타입 소거 뒤에도 남는 그물이 필요하고 ([export-full-record.ts](../../src/export/export-full-record.ts) 의 "조립 layer 마지막 그물" 선례와 동형), 이 선택으로 타입 전파 전용 slice 2 개 (ops / steps) 를 chain 에서 통째로 덜어낸다.

## Required Reading

- [src/import/import-restore-steps.ts](../../src/import/import-restore-steps.ts) 55~76 행 — `ImportRestoreTransactionStep` / `ImportRestoreStepMethod` 정의 (본 helper 의 입력 타입). 78~104 행 `describeReceived` · guard 패턴과 한국어 throw 계약도 본 helper 가 mirror 할 대상이다.
- [src/export/export-full-record.ts](../../src/export/export-full-record.ts) 23~30 행 + 50~70 행 — `FullExportRecord` (`fields` shape) 정의와 `isPlainObject` 판정 규칙. 본 helper 의 narrowing 은 이 규칙과 **문자 그대로 같은 엄격도** 여야 한다 (`Date` / 배열 / null-prototype 처리 포함).
- [src/import/import-dump-records-hydrate.ts](../../src/import/import-dump-records-hydrate.ts) 66~115 행 — 상류가 이미 수행한 `fields` 검증 (plain object + allow-list 엄격 거부). 본 helper 는 그 규칙을 **재구현하지 않는다** (allow-list 재검사 0 — source-of-truth 는 hydrate).
- [src/export/import-restore-plan.ts](../../src/export/import-restore-plan.ts) 39~55 행 — `ImportRestorePlan<TInsert>` 의 `toInsert` 만 파라미터화돼 있고 `toDelete` 는 `ExportRecord[]` 고정이라는 사실 (delete 쪽 `where` 산출이 왜 별도 slice 인지의 근거).
- [docs/tasks/T-1264-import-restore-steps.md](T-1264-import-restore-steps.md) — 같은 chain 의 신규 순수 module 선례 (throw 계약 · 부분 결과 미반환 · shallow copy 서술 방식).

## Acceptance Criteria

- [ ] 신규 파일 [src/import/import-restore-insert-rows.ts](../../src/import/import-restore-insert-rows.ts) 에 순수 함수 `buildImportRestoreInsertRows(step: ImportRestoreTransactionStep): Record<string, unknown>[]` 를 export 한다. 입력 step 의 `records` 를 입력 순서 그대로 `createMany({ data })` 에 넣을 row 배열로 옮긴다. 파일 상단에 chain 위치 · 책임 경계 (Prisma 0 / allow-list 재검증 0 / delete 쪽 미담당) 를 주석으로 남긴다.
- [ ] **런타임 narrowing** — 각 record 의 `fields` 가 plain object 인지 `export-full-record.ts` 와 동일한 엄격도로 판정한다 (`null` / 배열 / `Date` / 함수 / primitive 거부, `Object.create(null)` 수용). 위반 시 그 index 를 담은 한국어 `TypeError`. 판정 helper 를 새로 짜야 한다면 사본임을 주석에 명시하고 규칙 drift 를 감시하는 test 를 함께 둔다.
- [ ] **row 조립 규칙** — row 는 `fields` 의 **own enumerable key 만** 얕게 복사한 새 객체다 (`Object.prototype.hasOwnProperty.call` 또는 동등 수단 사용 — prototype chain key 혼입 0). 값은 **불투명하게 그대로** 옮긴다 (Date 재생성 · 직렬화 · 형 변환 · key 정규화 0). 입력 step / record / `fields` 는 변형하지 않는다 (freeze 된 입력으로 호출해도 통과).
- [ ] **phase 계약** — `phase !== "insert"` 또는 `method !== "createMany"` 인 step 은 한국어 `RangeError` 로 거부한다 (delete step 의 `where` 산출은 본 slice 책임 아님). `records` 가 빈 배열이면 상류 계약 (T-1264 의 "빈 그룹 미생성") 위반이므로 `RangeError` — no-op batch 를 하류로 흘리지 않는다.
- [ ] **REQ-032 정합** — error 메시지에 `fields` 안의 값 · record 원본 · stack 을 싣지 않는다 (비-string 은 `typeof` / 타입 이름만 노출). 이를 되돌림 감지 negative test 로 pin 한다 (`"leak-me"` 류 문자열 값을 넣고 메시지 비-노출 단언).
- [ ] **happy-path unit test 1+** — 정상 insert step (2 entity · 다중 record) 을 넣어 row 배열의 개수 · 순서 · key/값이 입력 `fields` 와 동일함을 단언하고, 반환 row 가 입력 `fields` 와 **다른 instance** 임 (얕은 복사) 을 함께 단언한다. `prepareImportRestorePlan` → `groupImportRestoreOperations` → `planImportRestoreTransactionSteps` → 본 helper 로 이어지는 chain 합성 test 1+ 을 두어 `fields` 가 dump 원문부터 row 까지 **캐스팅 없이** 실려 나옴을 실증한다.
- [ ] **error path unit test 1+** — step 이 `null` / `undefined` / 원시값 / 배열인 경우, `records` 가 배열이 아닌 경우 각각 한국어 `TypeError`. 부분 결과를 돌려주는 경로가 없음 (첫 위반 이전 record 의 row 가 반환되지 않음) 도 단언.
- [ ] **분기 cover** — 분기마다 1+ test: phase 거부 / method 거부 / 빈 records 거부 / `fields` 비-plain-object 거부 / 정상 조립.
- [ ] **negative cases 충분 cover** — 예외·경계 분기마다 1+: (a) `fields` 가 `undefined` (legacy dump 잔재) · `null` · 배열 · `Date` · 함수 · 문자열 각각 거부, (b) `fields` 가 own enumerable key 0 개인 빈 객체 → `RangeError` (빈 row 를 DB 로 보내지 않는다), (c) `__proto__` / `constructor` / `toString` 이 prototype 에만 있는 객체 → 그 key 가 row 에 실리지 않음, (d) `Object.create(null)` fields 수용, (e) 값 자리 10 종 (nested object · `Date` · `null` · `undefined` · 배열 · `Map` · class instance · number · boolean · 빈 문자열) 의 identity 보존, (f) freeze 된 step / record / fields 로 호출해도 통과 + 입력 비변형, (g) 같은 입력 2 회 호출 시 동일 결과 (idempotent) 이며 반환 배열 · row 는 서로 다른 instance, (h) 반환 row 를 호출자가 변형해도 입력 `fields` 가 오염되지 않음.
- [ ] **다른 파일 0 수정** — 기존 module (`import-restore-steps.ts` / `import-restore-ops.ts` / plan 계열) 을 한 줄도 고치지 않고 `pnpm build` 통과. 만약 compile 이 깨진다면 그것은 본 slice 의 설계 신호이므로 임의 수정 대신 PR body + task Follow-ups 에 박제하고 planner 에게 넘긴다.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 신규 파일은 statement/branch/function/line 100% 목표 (동일 chain 선례 T-1255~T-1269 동형).
- [ ] `scripts/check-spec-presence.sh` 통과, `prettier --check` 통과.
- [ ] **diff 규율 (T-1269 reviewer MINOR-1 회수)** — spec 은 fixture 를 재사용하고 반복 단언은 표 기반 (`it.each`) 으로 압축해 **총 diff 400 LOC 미만** 을 유지한다. 400 초과가 예상되면 임의로 넘기지 말고 (e) / (g) 계열 test 를 다음 slice 로 미루거나 planner 에게 split 을 요청한다.

## Out of Scope

- **실 `$transaction` 실행 / Prisma client·PrismaService 주입 / repository·service 배선** — 실행 slice 3/3.
- **delete step 의 `where` 절 산출** — 실행 slice 2/3. `toDelete` 는 `ExportRecord` (id 없음, `entity + instant` 만) 라 targeted delete 의 식별자 선택이 미해결 설계 쟁점이며 본 slice 에서 손대지 않는다.
- `import-restore-ops.ts` / `import-restore-steps.ts` 의 phase 판별 union 타입 파라미터화 — 본 slice 가 런타임 guard 로 대체하기로 확정했으므로 **하지 않는다**.
- `hydrateImportDumpRecords` 의 allow-list 검증 재구현 · 규칙 변경 (source-of-truth 는 hydrate).
- controller 재배선 / interim false-success guard 교체 (ADR-0055 §Follow-up (d) 는 T-1254 로 이미 shipped) / DTO 변경 / Prisma schema 변경 · migration / 새 외부 dependency (0 건).
- legacy dump (`fields` 부재) 수용 정책 결정 — controller 배선 slice 이전 별도 판단 (T-1265 reviewer MINOR-3 이월).
- `describeReceived` / `describeUnknown` 사본 공용 module 추출, spec fixture helper 공용화 — 별도 위생 slice.
- raw NUL 보유 나머지 tracked 파일 정리 / 제어 바이트 금지 CI 가드 (T-1267 Follow-ups).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (이월, 비차단) [src/import/import-restore-input.spec.ts](../../src/import/import-restore-input.spec.ts) fixture helper 의 `entity in entityCounts` → `Object.prototype.hasOwnProperty.call` (T-1268 reviewer NIT-5). 본 task 의 touchesFiles 밖이라 위생 slice 대기.
- (이월, 비차단) `dumpWithRecords` 계열 spec fixture helper 가 chain 안에서 4 번째 사본에 가까워졌다 — 판정 규칙 drift 전에 test fixture 공용 module 추출을 위생 slice 로 잡을 것 (T-1269 reviewer NIT-1).
- (planner 회수 완료) T-1269 reviewer MINOR-1 (3 slice 연속 cap-bend) — 본 task 가 실행 slice 를 3 조각으로 사전 분할하고 estimate 를 spec 실측 기반 340 으로 재보정하는 것으로 대응했다. 실측이 400 을 넘으면 다음 slice 는 반드시 더 잘게 쪼갠다.
