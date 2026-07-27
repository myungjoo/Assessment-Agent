---
id: T-1272
title: 복원 delete step 의 Prisma where 절 조립 (실행 slice 2b/3)
phase: P5
status: DONE
completedAt: 2026-07-27T21:57:34Z
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 190
estimatedFiles: 2
created: 2026-07-28
independentStream: import-restore-engine
dependsOn: [T-1271]
touchesFiles:
  - src/import/import-restore-delete-where.ts
  - src/import/import-restore-delete-where.spec.ts
plannerNote: "R-112 backbone x 1.5 = 190 LOC. T-1271 실측 297(prod 120 : spec 177 = 1:1.48) 기반 역산 — cap 안, sizeExempt 없음"
---

# T-1272 — 복원 delete step 의 Prisma where 절 조립 (실행 slice 2b/3)

## Why

[ADR-0055](../decisions/ADR-0055-import-multipart-file-upload.md) §Follow-up (b) 복원 엔진 chain 의 목표는 ADR-0044 §3 atomic `$transaction` 실 복원이다. 직전 T-1271 (실행 slice 2a) 이 delete step → 삭제 대상 `Date[]` 산출을 닫았으므로, 남은 delete 축은 그 목록을 실제 Prisma 호출 인자인 `deleteMany({ where })` 의 `where` 객체로 옮기는 조립이다.

본 slice 는 그 **조립까지만** 담당한다 — delete step 하나를 받아 `EXPORT_ENTITY_SOURCES[entity].instantColumn` 을 조회하고 `{ [instantColumn]: { in: Date[] } }` 를 돌려주는 순수 함수다. 실 `$transaction` 실행 · Prisma client 주입은 다음 slice (3/3) 로 분리한다.

**estimate 근거 (T-1270 reviewer MINOR-1 회수 유지)** — T-1270 이 est 340 대비 실측 573 으로 초과해 reviewer 가 재초과 시 BLOCKER 격상을 예고했고, 재분할한 T-1271 은 실측 **297 LOC (production 120 : spec 177 = 1 : 1.48)** 로 cap 안에 안착했다. 본 task 의 `estimatedDiff` 는 그 실측 비율에서 역산한 값 (production ~75 × 1.5 ≈ 115 → 총 ~190) 이며, **cap (300 LOC / 5 파일) 안이라 `sizeExempt` 를 쓰지 않는다**.

## Required Reading

- [src/import/import-restore-delete-instants.ts](../../src/import/import-restore-delete-instants.ts) — 직전 slice (2a). 본 helper 가 `collectImportRestoreDeleteInstants(step)` 를 **그대로 호출**해 목록을 얻는다. 파일 상단 주석 · `fail` / `tokenOf` / `kindOf` 규약 · 한국어 throw 계약 · 비변형 규약을 mirror 하되, **주석은 이 파일보다 짧게** 유지한다 (LOC 예산 근거).
  - 중요 사실: `assertDeleteStep` (53~65 행) 은 `phase` / `method` / `records` 만 검증하고 **`step.entity` 가 유효한 `ExportEntity` literal 인지는 검사하지 않는다** — record 와의 일치만 본다 (82~87 행). 따라서 entity 유효성 검증은 **본 slice 의 책임**이다.
- [src/export/export-entity-sources.ts](../../src/export/export-entity-sources.ts) 37~44 행 (`ExportEntitySource.instantColumn`) + 69 행 이후 `EXPORT_ENTITY_SOURCES` 표 — 본 slice 가 처음으로 import 하는 매핑 (5 entity 모두 `createdAt`). 표는 `Object.freeze` 된 **plain object** 라 `in` 연산자로 조회하면 prototype 속성 (`constructor` 등) 이 오탐된다.
- [src/import/import-restore-steps.ts](../../src/import/import-restore-steps.ts) 55~76 행 — `ImportRestoreTransactionStep` 정의 (본 helper 의 입력 타입). step 에 이미 `delegate` / `model` 이 실려 있지만 `instantColumn` 은 없다 (본 slice 가 표에서 조회하는 이유).
- [src/import/import-restore-delete-instants.spec.ts](../../src/import/import-restore-delete-instants.spec.ts) — colocated spec 선례. 본 task 의 신규 spec 은 **[src/import/import-restore-delete-where.spec.ts](../../src/import/import-restore-delete-where.spec.ts) (colocated)** 위치가 의무이며, fixture builder 단일화 · `it.each` 표 압축 패턴을 그대로 따른다.
- [src/import/import-restore-insert-rows.ts](../../src/import/import-restore-insert-rows.ts) — 형제 slice (1/3). "값은 불투명하게 옮긴다" 규약의 원본.

## Acceptance Criteria

- [ ] 신규 파일 [src/import/import-restore-delete-where.ts](../../src/import/import-restore-delete-where.ts) 에 순수 함수 `buildImportRestoreDeleteWhere(step: ImportRestoreTransactionStep): Record<string, { in: Date[] }>` 를 export 한다. 파일 상단 주석에 chain 위치 (2b) 와 책임 경계 (Prisma client 0 / `$transaction` 0 / insert 쪽 0 / 목록 산출은 2a 위임) 를 적되 **주석 총 18 행 이내**로 압축한다.
- [ ] **목록 산출 위임** — instant 목록은 직접 순회하지 않고 `collectImportRestoreDeleteInstants(step)` 를 호출해 얻는다 (검증 로직 사본 0). 따라서 phase / method / 빈 `records` / record 별 entity 일치 / 유효 Date 위반은 2a 의 한국어 throw 가 **그대로 전파**되며, 본 helper 가 감싸거나 메시지를 바꾸지 않는다 (전파 사실을 test 로 pin).
- [ ] **entity 유효성 계약 (본 slice 고유)** — `step.entity` 가 `EXPORT_ENTITY_SOURCES` 의 **자기 자신의 속성** 인지 `Object.prototype.hasOwnProperty.call` 로 판정하고, 아니면 한국어 `RangeError` 로 거부한다. `in` 연산자 · 직접 인덱싱 금지 — `"constructor"` / `"__proto__"` 같은 prototype 속성이 유효 entity 로 오탐되면 `where` key 가 `undefined` 가 되어 **조건 없는 전체 삭제**로 번역될 수 있다. 이 사고 경로를 negative test 로 pin 한다.
- [ ] **조립 계약** — 반환 객체는 `{ [source.instantColumn]: { in: instants } }` 형태의 **새 plain object** 이고, key 는 표에서 읽은 컬럼 이름 (현재 5 entity 모두 `createdAt`) 이며 하드코딩하지 않는다. `in` 배열은 2a 가 돌려준 배열을 그대로 실어도 되나, 원소 `Date` 는 입력 instance 를 **그대로** 옮긴다 (복제 0 — 2a · T-1270 의 "값은 불투명하게" 규약과 동형).
- [ ] **빈 `in` 불가 보장** — 2a 가 빈 `records` 를 `RangeError` 로 거부하므로 `in` 배열은 항상 1 건 이상이다. 이 invariant 를 주석 1 행으로 명시하고, "빈 배열이 반환될 수 없음" 을 test 로 pin 한다 (빈 `in` 은 Prisma 에서 0 건 매치라 무해하지만, 계약이 느슨해지면 상류 변경 시 전체 삭제 회귀 위험이 열린다).
- [ ] **비변형 규약** — 입력 step / records / Date / `EXPORT_ENTITY_SOURCES` 를 변형하지 않는다 (freeze 된 입력으로 호출해도 통과). 반환 객체를 호출자가 변형해도 표와 입력이 오염되지 않음을 test 로 단언한다.
- [ ] **REQ-032 정합** — error 메시지에 record 원본 · `instant` 값 · stack 을 싣지 않는다 (비-string entity 는 `typeof` / 타입 이름만 노출). 2a 의 `tokenOf` 동형 helper 를 쓰되 **사본임을 주석에 명시**한다. 되돌림 감지 negative test 로 pin 한다.
- [ ] **happy-path unit test 1+** — 정상 delete step (다중 record, 일부 중복 instant 포함) 에서 결과 key 가 `createdAt` 이고 `in` 의 개수 · 순서 · 각 원소가 입력 `Date` 와 동일 instance 임을 단언한다. `groupImportRestoreOperations` → `planImportRestoreTransactionSteps` → 본 helper 로 이어지는 chain 합성 test 1+ 을 두어 delete step 이 실제로 본 helper 를 통과함을 실증한다. 5 entity 전부에 대해 key 가 표의 `instantColumn` 과 일치함을 `it.each` 표 1 개로 cover.
- [ ] **error path unit test 1+** — step 이 `null` / `undefined` / 원시값 / 배열인 경우 2a 의 한국어 `TypeError` 가 그대로 전파됨. 부분 결과 (key 만 있고 `in` 이 비거나 미완성인 객체) 가 반환되는 경로가 없음도 단언.
- [ ] **분기 cover** — 분기마다 1+ test: entity 유효 / entity 무효 (거부) / prototype 속성 entity (거부) / 2a 전파 거부 / 정상 조립 (중복 있음 · 없음 두 갈래).
- [ ] **negative cases 충분 cover** — 예외·경계 분기마다 1+ 이되 `it.each` 표로 압축한다: (a) `step.entity` 가 `undefined` · `null` · 비-string · 소문자 오타 (`"person"`) · 미지 literal 각각 `RangeError` (표 1 개), (b) `step.entity` 가 `"constructor"` · `"__proto__"` · `"toString"` 인 경우도 `RangeError` 이고 반환 객체에 `undefined` key 가 생기지 않음 (표 1 개), (c) phase / method 위반 · 빈 `records` · record entity 불일치 · 비-Date instant 가 2a 메시지 그대로 전파 (표 1 개 — 메시지 prefix 가 `collectImportRestoreDeleteInstants:` 임을 단언해 재랩핑 회귀 차단), (d) 전 원소 instant 가 같은 millis 인 경우 `in` 길이 1, (e) freeze 된 step / records / Date 로 호출해도 통과 + 입력 비변형, (f) 같은 입력 2 회 호출 시 동일 결과 (idempotent) 이며 반환 객체 · `in` 배열은 서로 다른 instance, (g) 반환 객체의 `in` 을 호출자가 변형해도 입력 `records` · `EXPORT_ENTITY_SOURCES` 가 오염되지 않음.
- [ ] **다른 파일 0 수정** — 기존 module 을 한 줄도 고치지 않고 `pnpm build` 통과. compile 이 깨지면 임의 수정 대신 PR body + 본 task Follow-ups 에 박제하고 planner 에게 넘긴다.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 신규 파일은 statement/branch/function/line 100% 목표 (동일 chain 선례 T-1255~T-1271 동형).
- [ ] `scripts/check-spec-presence.sh` 통과, `prettier --check` 통과.
- [ ] **diff 규율 (T-1270 reviewer MINOR-1 회수 — 재초과 시 BLOCKER 예고 유효)** — production ≤ **90 LOC**, spec ≤ **170 LOC**, **총 diff ≤ 260 LOC** 를 지킨다. fixture 는 단일 builder 로 재사용하고 반복 단언은 `it.each` 표로 압축한다. 260 초과가 예상되면 **임의로 넘기지 말고** negative (f)/(g) 를 다음 slice 로 미루거나 planner 에게 split 을 요청한다.

## Out of Scope

- **실 `$transaction` 실행 / Prisma client · PrismaService 주입 / repository · service 배선** — 실행 slice 3/3.
- insert step 의 row 산출 (`buildImportRestoreInsertRows`) · instant 목록 산출 (`collectImportRestoreDeleteInstants`) 수정 · 재배선 — T-1270 / T-1271 에서 shipped. 본 slice 는 **호출만** 한다.
- `EXPORT_ENTITY_SOURCES` 표 자체 수정 · `instantColumn` 값 변경 · entity 추가 — 본 slice 는 read-only 소비자다.
- `import-restore-ops.ts` / `import-restore-steps.ts` 의 phase 판별 union 타입 파라미터화 — T-1270 에서 런타임 guard 로 대체하기로 확정했으므로 **하지 않는다**.
- `where` 에 instant 외 축 (id · entity 컬럼 · 복합 조건) 을 추가하는 설계 변경 — `toDelete` 가 `ExportRecord` (id 없음) 인 한 축은 instant 뿐이다. 변경하려면 별도 판단.
- controller 재배선 / DTO 변경 / Prisma schema 변경 · migration / 새 외부 dependency (0 건).
- `describeReceived` · `tokenOf` · `kindOf` 사본 공용 module 추출, spec fixture helper 공용화 — 별도 위생 slice.
- raw NUL 보유 나머지 tracked 파일 정리 / 제어 바이트 금지 CI 가드 (T-1267 Follow-ups).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (이월, 비차단) [src/import/import-restore-insert-rows.spec.ts](../../src/import/import-restore-insert-rows.spec.ts) 199 · 215 행의 `for (const [, value] of ...)` 가 표의 label (`ACCEPTED` / `NON_PLAIN` 첫 원소) 을 버려서 실패 시 어느 case 인지 식별되지 않는다 (T-1270 reviewer 잔여 NIT). 본 task 의 touchesFiles 밖이라 위생 slice 대기.
- (예고) 실행 slice **3/3** — 실 `$transaction` runner. Prisma client 주입 + step 순회 (`deleteMany({ where })` / `createMany({ data })`) + rollback regression. 여기서 처음 DB 를 잡으므로 그 전에 slice 크기를 다시 산정한다 (mock Prisma unit + e2e 분리 여부 포함).
- (이월, 비차단) `src/import/import-restore-input.spec.ts` fixture helper 의 `entity in entityCounts` → `Object.prototype.hasOwnProperty.call` (T-1268 reviewer NIT-5). 본 task 의 entity 조회 규약과 같은 부류라 함께 정리할 후보.
- (이월, 비차단) `dumpWithRecords` 계열 spec fixture helper 가 chain 안에서 6 번째 사본에 가까워졌다 — 판정 규칙 drift 전에 test fixture 공용 module 추출을 위생 slice 로 잡을 것 (T-1269 reviewer NIT-1).
