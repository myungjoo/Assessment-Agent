---
id: T-1271
title: 복원 delete step 의 대상 instant 목록 산출 (실행 slice 2a/3)
phase: P5
status: DONE
completedAt: 2026-07-27T21:01:32Z
prNumber: 1162
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 285
estimatedFiles: 2
created: 2026-07-28
independentStream: import-restore-engine
dependsOn: [T-1270]
touchesFiles:
  - src/import/import-restore-delete-instants.ts
  - src/import/import-restore-delete-instants.spec.ts
plannerNote: "R-112 backbone x 1.5 = 285 LOC. T-1270 실측 573(prod 196 : spec 377 = 1:1.92) 기반 재보정 — slice 2/3 을 2a/2b 로 재분할해 cap 안"
---

# T-1271 — 복원 delete step 의 대상 instant 목록 산출 (실행 slice 2a/3)

## Why

[ADR-0055](../decisions/ADR-0055-import-multipart-file-upload.md) §Follow-up (b) 복원 엔진 chain 의 남은 목표는 ADR-0044 §3 atomic `$transaction` 실 복원이다. 직전 T-1270 이 insert 쪽 `createMany({ data })` row 산출을 닫았고, 남은 축은 delete 쪽 `deleteMany({ where })` 다. 그런데 `toDelete` 는 `ExportRecord` (`entity` + `instant` 뿐, **id 없음**) 라 "무엇을 지울지" 를 식별할 축이 `instant` 하나이며, 그 목록을 만들기 전에 계약 검증 (phase / method / entity 일치 / 유효 Date) 이 선행돼야 한다.

본 slice 는 그 **식별자 목록 산출까지만** 담당한다 — delete step 하나를 받아 삭제 대상 instant 배열을 돌려주는 순수 함수다. `instantColumn` 조회와 Prisma `where` 객체 조립은 다음 slice (2b) 로 분리한다.

**분할 근거 (T-1270 reviewer MINOR-1 회수)** — T-1270 은 estimate 340 대비 실측 **573 LOC** (production 196 : spec 377 = 1 : 1.92) 로 초과했고, `sizeExempt` 전제였던 "production ~85 LOC" 가 falsified 됐다. reviewer 는 다음 slice 의 재초과를 BLOCKER 로 격상하겠다고 예고했다. 따라서 예고했던 실행 slice 2/3 을 **2a (본 task — 계약 검증 + instant 목록) / 2b (instantColumn 매핑 + `where` 객체 조립)** 로 다시 쪼갠다. 본 task 의 `estimatedDiff` 는 희망치가 아니라 위 실측 비율에서 역산한 값이며 (production ~95 × 1.92 ≈ 185 → 총 ~280), **cap (300 LOC / 5 파일) 안이라 `sizeExempt` 를 쓰지 않는다**.

## Required Reading

- [src/import/import-restore-steps.ts](../../src/import/import-restore-steps.ts) 55~76 행 — `ImportRestoreTransactionStep` / `ImportRestoreStepMethod` 정의 (본 helper 의 입력 타입). 78~104 행 `describeReceived` · guard · 한국어 throw 계약도 본 helper 가 mirror 할 대상이다.
- [src/import/import-restore-insert-rows.ts](../../src/import/import-restore-insert-rows.ts) — 직전 형제 slice. throw 계약 · 비변형 규약 · 부분 결과 미반환을 그대로 mirror 하되, **파일 상단 주석은 이 파일보다 짧게** 유지한다 (본 task 의 LOC 예산 근거 중 하나).
- [src/export/export-scope-select.ts](../../src/export/export-scope-select.ts) 26~29 행 — `ExportRecord` 가 `entity` + `instant` 뿐이라는 사실 (id 부재가 본 slice 설계의 출발점).
- [src/export/import-restore-plan.ts](../../src/export/import-restore-plan.ts) 39~55 행 — `toDelete` 가 `ExportRecord[]` 로 고정돼 있고 파라미터화되지 않은 이유 (기존 row 는 DB 에서 읽은 것이라 dump 의 `fields` 가 없다).
- [src/export/export-entity-sources.ts](../../src/export/export-entity-sources.ts) `instantColumn` 필드 주석 — **본 slice 는 이 module 을 import 하지 않는다**. 경계 확인용으로만 읽는다 (컬럼 매핑은 slice 2b 책임).

## Acceptance Criteria

- [ ] 신규 파일 [src/import/import-restore-delete-instants.ts](../../src/import/import-restore-delete-instants.ts) 에 순수 함수 `collectImportRestoreDeleteInstants(step: ImportRestoreTransactionStep): Date[]` 를 export 한다. 파일 상단 주석에 chain 위치와 책임 경계 (Prisma 0 / `instantColumn` 조회 0 / `where` 조립 0 / insert 쪽 미담당) 를 적되 **주석 총 20 행 이내**로 압축한다.
- [ ] **phase 계약** — `phase !== "delete"` 또는 `method !== "deleteMany"` 인 step 은 한국어 `RangeError` 로 거부한다 (insert step 의 row 산출은 T-1270 책임). `records` 가 빈 배열이면 상류 계약 (T-1264 의 "빈 그룹 미생성") 위반이므로 `RangeError` — 전체 삭제로 오독될 수 있는 빈 목록을 하류로 흘리지 않는다.
- [ ] **entity 일치 계약** — step 은 단일 entity 에 대한 호출 서술이므로, `record.entity !== step.entity` 인 원소가 있으면 그 index 를 담은 한국어 `RangeError`. 다른 delegate 의 row 가 섞여 삭제되는 사고를 이 지점에서 끊는다.
- [ ] **instant 검증** — 각 record 의 `instant` 가 `Date` instance 이고 `Number.isNaN(getTime())` 이 아님을 확인한다. 위반 시 그 index 를 담은 한국어 `TypeError`. 검증을 **전 원소에 대해 마친 뒤에야** 결과를 조립하므로 부분 결과를 돌려주는 경로가 없다.
- [ ] **중복 제거 + 순서 보존** — 같은 millis 를 갖는 record 가 여럿이면 결과에는 **첫 등장 1 건만** 남기고, 남은 원소의 상대 순서는 입력 순서를 보존한다. `deleteMany` 의 `in` 목록이 무의미하게 불어나지 않게 하기 위함이며, 정렬하지 않는다 (상류 순서 회귀를 조용히 덮지 않는다).
- [ ] **비변형 · identity 규약** — 반환 배열은 **새 배열**이지만 원소 `Date` 는 입력 instance 를 **그대로** 옮긴다 (복제 0 — T-1270 의 "값은 불투명하게" 규약과 동형). 입력 step / records / Date 는 변형하지 않는다 (freeze 된 입력으로 호출해도 통과). 이 선택을 주석 1~2 행으로 명시하고 test 로 pin 한다.
- [ ] **REQ-032 정합** — error 메시지에 record 원본 · `instant` 값 · stack 을 싣지 않는다 (비-string 은 `typeof` / 타입 이름만 노출). `describeReceived` 사본을 쓴다면 사본임을 주석에 명시한다. 되돌림 감지 negative test 로 pin 한다.
- [ ] **happy-path unit test 1+** — 정상 delete step (다중 record, 일부 중복 instant 포함) 에서 결과의 개수 · 순서 · 각 원소가 입력 `Date` 와 동일 instance 임을 단언한다. `groupImportRestoreOperations` → `planImportRestoreTransactionSteps` → 본 helper 로 이어지는 chain 합성 test 1+ 을 두어 delete step 이 실제로 본 helper 를 통과함을 실증한다.
- [ ] **error path unit test 1+** — step 이 `null` / `undefined` / 원시값 / 배열인 경우, `records` 가 배열이 아닌 경우 각각 한국어 `TypeError`. 첫 위반 이전 원소의 결과가 반환되지 않음 (부분 결과 0) 도 단언.
- [ ] **분기 cover** — 분기마다 1+ test: phase 거부 / method 거부 / 빈 records 거부 / entity 불일치 거부 / instant 비-Date 거부 / 정상 조립 (중복 있음 · 없음 두 갈래).
- [ ] **negative cases 충분 cover** — 예외·경계 분기마다 1+ 이되 `it.each` 표로 압축한다: (a) `instant` 가 `undefined` · `null` · 문자열 · number · `Invalid Date` · Date-like 유사 객체 각각 거부 (표 1 개), (b) `records` 원소가 `null` / 원시값이라 필드를 읽을 수 없는 경우 거부, (c) `record.entity` 가 다른 유효 entity · 비-string · 미지 literal 인 경우 거부 (표 1 개), (d) 전 원소의 instant 가 같은 millis 인 경우 결과 길이 1, (e) freeze 된 step / records / Date 로 호출해도 통과 + 입력 비변형, (f) 같은 입력 2 회 호출 시 동일 결과 (idempotent) 이며 반환 배열은 서로 다른 instance, (g) 반환 배열을 호출자가 변형해도 입력 `records` 가 오염되지 않음.
- [ ] **다른 파일 0 수정** — 기존 module 을 한 줄도 고치지 않고 `pnpm build` 통과. compile 이 깨지면 임의 수정 대신 PR body + 본 task Follow-ups 에 박제하고 planner 에게 넘긴다.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 신규 파일은 statement/branch/function/line 100% 목표 (동일 chain 선례 T-1255~T-1270 동형).
- [ ] `scripts/check-spec-presence.sh` 통과, `prettier --check` 통과.
- [ ] **diff 규율 (T-1270 reviewer MINOR-1 회수 — 재초과 시 BLOCKER 예고)** — production ≤ **120 LOC**, spec ≤ **200 LOC**, **총 diff ≤ 300 LOC** 를 지킨다. fixture 는 단일 builder 로 재사용하고 반복 단언은 `it.each` 표로 압축한다. 300 초과가 예상되면 **임의로 넘기지 말고** negative (f)/(g) 를 다음 slice 로 미루거나 planner 에게 split 을 요청한다.

## Out of Scope

- **`instantColumn` 조회 · Prisma `where` 객체 조립** — 실행 slice 2b. `EXPORT_ENTITY_SOURCES` 를 본 slice 에서 import 하지 않는다.
- **실 `$transaction` 실행 / Prisma client · PrismaService 주입 / repository · service 배선** — 실행 slice 3/3.
- insert step 의 row 산출 (`buildImportRestoreInsertRows`) 수정 · 재배선 — T-1270 에서 shipped.
- `import-restore-ops.ts` / `import-restore-steps.ts` 의 phase 판별 union 타입 파라미터화 — T-1270 에서 런타임 guard 로 대체하기로 확정했으므로 **하지 않는다**.
- `toDelete` 의 식별자 축을 id 기반으로 바꾸는 설계 변경 · plan 계열 타입 파라미터화 확대 — 별도 판단.
- controller 재배선 / DTO 변경 / Prisma schema 변경 · migration / 새 외부 dependency (0 건).
- `describeReceived` 사본 공용 module 추출, spec fixture helper 공용화 — 별도 위생 slice.
- raw NUL 보유 나머지 tracked 파일 정리 / 제어 바이트 금지 CI 가드 (T-1267 Follow-ups).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (이월, 비차단) [src/import/import-restore-insert-rows.spec.ts](../../src/import/import-restore-insert-rows.spec.ts) 199 · 215 행의 `for (const [, value] of ...)` 가 표의 label (`ACCEPTED` / `NON_PLAIN` 첫 원소) 을 버려서 실패 시 어느 case 인지 식별되지 않는다 — label 을 살려 `it.each` 로 옮기거나 `expect(...).toEqual` 에 label 을 실어야 한다 (T-1270 reviewer 잔여 NIT). 본 task 의 touchesFiles 밖이라 위생 slice 대기.
- (예고) 실행 slice **2b** — `EXPORT_ENTITY_SOURCES.instantColumn` 조회 + `{ [instantColumn]: { in: Date[] } }` `where` 객체 조립. 본 slice 의 산출물을 그대로 소비하므로 production ~60 / spec ~120 예상.
- (예고) 실행 slice **3/3** — 실 `$transaction` runner. Prisma client 주입 + step 순회 + rollback regression. 여기서 처음 DB 를 잡으므로 그 전에 slice 크기를 다시 산정한다.
- (이월, 비차단) `src/import/import-restore-input.spec.ts` fixture helper 의 `entity in entityCounts` → `Object.prototype.hasOwnProperty.call` (T-1268 reviewer NIT-5).
- (이월, 비차단) `dumpWithRecords` 계열 spec fixture helper 가 chain 안에서 5 번째 사본에 가까워졌다 — 판정 규칙 drift 전에 test fixture 공용 module 추출을 위생 slice 로 잡을 것 (T-1269 reviewer NIT-1).

## 결과 (2026-07-27T21:01:32Z, DONE)

- PR [#1162](https://github.com/myungjoo/AA_S1/pull/1162) squash merge `a81bb2c3` — reviewer round 1 APPROVE(BLOCKER 0), 4-게이트 모두 통과.
- 신설 [src/import/import-restore-delete-instants.ts](../../src/import/import-restore-delete-instants.ts) 의 `collectImportRestoreDeleteInstants` — 계약 검증(phase / method / 빈 records / entity 일치 / instant 유효성) 을 전 원소에 대해 마친 뒤에야 조립하는 2-pass 순수 함수. 중복 millis 는 첫 등장만 남기고 순서 보존, Date 는 입력 instance 를 그대로 옮긴다(복제 0). Prisma · `instantColumn` 접촉 0.
- 실측 **297 LOC / 2 파일**(production 120 : spec 177 = 1:1.48) — cap 300 안. T-1270 의 573 초과 이후 diff 규율 회복.
- 신규 파일 stmt/branch/func/line 100%, 전체 419 suite / 11923 test green. `test:cov` 임계(line·function 80%) · `check-spec-presence` · `prettier --check` 통과.
- 잔여 NIT-2(reviewer): `tokenOf` / `kindOf` 가 T-1270 helper 의 사본이라 chain 상 사본이 누적된다 — 아래 Follow-ups 의 공용 module 추출 위생 slice 우선순위 상향.
