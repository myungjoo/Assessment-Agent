---
id: T-1264
title: Import 복원 $transaction step 계획 helper 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 500
estimatedFiles: 4
created: 2026-07-27
independentStream: import-restore-engine
dependsOn: [T-1263]
touchesFiles:
  - src/import/import-restore-steps.ts
  - src/import/import-restore-steps.spec.ts
  - src/export/import-dump-validate.ts
  - src/export/import-dump-validate.spec.ts
sizeExempt: true
exemptReason: R-112 backbone slice — production 은 신규 helper ~140 LOC + 문구 정합 ~5 LOC 로 cap 안이고 초과분은 전량 spec (5 entity × 2 phase happy + 입력 방어 6 종 + 순서 계약 negative 다수). 동일 chain 실측 선례 T-1261 총 595 (prod 106 / spec 489), T-1262 총 628 (prod 154 / spec 474), T-1263 도 동형으로 머지됨.
plannerNote: "cap-bend pre-justified: R-112 backbone x 1.5 = 500 LOC, 선례 T-1262 실측 628(prod 154/spec 474) — ADR-0055 §Follow-up(b) 열 번째 slice"
---

# T-1264 — Import 복원 $transaction step 계획 helper 신설

## Why

[ADR-0055](../decisions/ADR-0055-import-multipart-file-upload.md) §Follow-up (b) 복원 엔진 chain (역직렬화 → 구조 검증 → version gate → records hydrate → 복원 입력 합성 → plan 산출 → FK 안전 순서 → operation 그룹핑 → entity 매핑 공용 module → **ADR-0044 §3 atomic `$transaction` 복원** → controller 재배선) 의 **열 번째 slice** 다. T-1262 가 산출하는 `ImportRestoreOperation` 은 `(phase, entity, records)` 까지만 알고, T-1263 이 승격한 `EXPORT_ENTITY_SOURCES` 는 `entity → delegate·model` 만 안다. 실 `prisma.$transaction([...])` 을 호출하려면 그 둘을 합쳐 **"어느 delegate 의 어느 메서드를 어떤 순서로 부를지"** 가 확정된 step 목록이 필요하다.

본 slice 는 그 **순수 변환과 순서 계약 검증만** 담당한다 — Prisma client 를 잡지 않고 step 서술만 만들어, 다음 slice (실 `$transaction` 실행) 가 매핑·순서·검증을 한꺼번에 떠안지 않게 한다 (PLAN.md R-57 backup/restore 의 restore 경로 실동작 완결로 가는 길목). 함께 T-1259~T-1263 이 다섯 번 이월한 미회수 follow-up 1 건 (`import-dump-validate.ts` 의 `generatedAt` issue 문구 부정확) 을 동반 회수한다 — sibling `import-dump-records-hydrate.ts` 가 이미 "`new Date()` 로 파싱 가능한 string" 으로 정확히 적고 있어 문구만 동형화하면 끝나는 ~5 LOC 이라, 여섯 번째 이월보다 여기서 닫는 편이 싸다.

## Required Reading

- [docs/decisions/ADR-0055-import-multipart-file-upload.md](../decisions/ADR-0055-import-multipart-file-upload.md) — §Follow-up (b) 복원 엔진 chain 의 slice 경계.
- [docs/decisions/ADR-0044-export-import-job-persistence.md](../decisions/ADR-0044-export-import-job-persistence.md) — §3 Import atomic `$transaction([deleteMany, ...create])` all-or-nothing 계약 (본 helper 가 서술하려는 호출 열).
- [src/import/import-restore-ops.ts](../../src/import/import-restore-ops.ts) — 입력 타입 `ImportRestoreOperation` 과 그 산출 순서 계약 (delete 그룹 전부 → insert 그룹 전부, 빈 그룹 미생성, record 입력 순서 보존).
- [src/import/import-restore-order.ts](../../src/import/import-restore-order.ts) — `ImportRestorePhase` union 과 `IMPORT_RESTORE_INSERT_ORDER` (entity 순서 single-source — 본 task 에서 재선언 금지).
- [src/export/export-entity-sources.ts](../../src/export/export-entity-sources.ts) — `EXPORT_ENTITY_SOURCES` / `ExportEntityDelegate` / `exportEntityPrismaModel` (delegate·model 매핑 single-source, T-1263).
- [src/export/export-scope-select.ts](../../src/export/export-scope-select.ts) — `ExportEntity` union 과 `ExportRecord` 최소 shape (`{ entity, instant }`).
- [src/export/import-dump-validate.ts](../../src/export/import-dump-validate.ts) — 53 / 85 / 93행 `generatedAt` 문구 (동반 회수 대상) 와 실제 판정식 (`typeof` + `trim()` + `new Date(...)` NaN).
- [src/import/import-dump-records-hydrate.ts](../../src/import/import-dump-records-hydrate.ts) — 47 / 112행 문구 (동형화 기준 표현).

## Acceptance Criteria

- [ ] `src/import/import-restore-steps.ts` 신설 — `ImportRestoreStepMethod` (`"deleteMany" | "createMany"`), `ImportRestoreTransactionStep` (`{ phase, entity, delegate, model, method, records }`), `planImportRestoreTransactionSteps(operations: ImportRestoreOperation[]): ImportRestoreTransactionStep[]` 를 export 한다.
- [ ] 매핑 규칙 — `phase === "delete"` → `method: "deleteMany"`, `phase === "insert"` → `method: "createMany"`. `delegate` / `model` 은 `EXPORT_ENTITY_SOURCES` (T-1263) 에서만 얻고 **본 파일에서 5 entity 매핑을 재선언하지 않는다** (사본 0 — T-1261 NIT-1 재발 방지).
- [ ] 순서 계약 검증 — 입력 operation 배열에서 **모든 delete 가 모든 insert 앞** 이라는 계약을 확인하고, insert 뒤에 delete 가 나오면 그 index 를 담은 `RangeError` 를 던진다 (손으로 조립된 배열이 FK 안전 순서를 깨는 회귀 catch). 순서를 **재정렬하지 않는다** — 위반은 고치지 않고 알린다.
- [ ] 순수 · non-mutating — 입력 배열 / operation / records 를 변형하지 않고 (freeze 된 입력으로 호출해도 통과) 항상 새 배열 · 새 step 객체를 돌려준다. `records` 는 새 배열로 복사해 호출자가 반환값을 바꿔도 입력이 오염되지 않는다. Prisma client · `$transaction` 실행 · DB · repository · file I/O · REST 배선 0.
- [ ] 입력 방어는 sibling `groupImportRestoreOperations` 와 **동형 throw 계약** (한국어 `TypeError` / `RangeError`). REQ-032 — 메시지에 record 원본 · payload 를 싣지 않으며 비-string 값은 타입 이름만 노출한다.
- [ ] (동반 회수) `src/export/import-dump-validate.ts` 의 `generatedAt` issue 메시지와 53 / 85행 주석을 실제 판정 (`new Date()` 파싱 기준) 과 일치하도록 정정한다 — 표현은 sibling `import-dump-records-hydrate.ts` 와 동형. 판정식 · 분기 · issue 개수는 **변경 0** (문구만).
- [ ] **happy-path unit test 1+** — (a) delete 2 그룹 + insert 3 그룹 혼합 입력이 같은 개수 · 같은 순서의 step 으로 변환되고 각 step 의 `delegate` / `model` / `method` 가 기대값과 일치, (b) 5 entity × 2 phase 전 조합에 대해 delegate·model 이 `EXPORT_ENTITY_SOURCES` 와 일치 (표 drift 감시), (c) 빈 배열 입력 → 빈 배열 반환 (error 아님).
- [ ] **error path unit test 1+** — operations 가 배열 아님 (`null` / `undefined` / 객체 / 문자열 / 숫자) → `TypeError`, 원소가 `null` / 원시값 → `TypeError`, `phase` 가 `"delete"` / `"insert"` 밖 (오타 / 대문자 / 빈 문자열 / 비-string) → `RangeError`, `entity` 가 5 종 밖 → `RangeError`, `records` 가 배열 아님 → `TypeError`, `records` 가 빈 배열 → `RangeError` (T-1262 의 "빈 그룹 미생성" 계약 위반).
- [ ] **분기 cover** — `phase` 2 분기 (delete → deleteMany / insert → createMany) 각 1+, 순서 계약 검증의 (정상 / delete-after-insert 위반) 2 분기 각 1+, 입력 방어의 각 throw 분기 1+.
- [ ] **negative cases 충분 cover** — 예외 · 경계 분기마다 1+: (a) insert 뒤 delete 가 하나라도 있으면 `RangeError` 이며 메시지에 위반 index 포함, (b) delete 만 / insert 만 있는 배열은 정상 통과, (c) `"__proto__"` / `"constructor"` 를 entity 또는 phase 로 넣어도 상속 속성 오탐 없이 `RangeError`, (d) freeze 된 입력 (배열 · operation · records 모두 freeze) 으로 호출해도 throw 0 이고 결과가 동일, (e) 반환 step 의 `records` 배열을 호출자가 push / 정렬해도 입력 operation 의 records 불변, (f) 반환 step 객체의 `delegate` 를 바꿔도 `EXPORT_ENTITY_SOURCES` 원본 불변, (g) error 메시지에 record payload · `instant` 값 · stack 이 실리지 않음 (정규식 단언), (h) 같은 entity 가 같은 phase 에 두 번 등장해도 step 2 개로 그대로 보존 (그룹 병합 · 중복 제거를 임의로 하지 않음), (i) `generatedAt` 문구 정정 후에도 기존 3 negative (비-string / 빈 문자열 / Invalid Date) 가 그대로 issue 를 만들고, RFC 2822 처럼 ISO 는 아니지만 `new Date()` 로 파싱되는 string 은 issue 를 만들지 않음 (문구와 실제 판정의 정합 pinning).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 신규 파일은 statement/branch/function/line 100% 목표 (동일 chain 선례 T-1255~T-1263 동형).
- [ ] `scripts/check-spec-presence.sh` 통과 — 신규 production `.ts` 에 colocated spec (`src/import/import-restore-steps.spec.ts`) 존재, `prettier --check` 통과.

## Out of Scope

- 실 `$transaction` 실행 · Prisma delegate 호출 · `PrismaService` 주입 · DB 접근 (다음 slice). 본 task 는 **호출 서술 (step) 만** 만들고 아무것도 실행하지 않는다.
- `import-restore-ops.ts` / `import-restore-order.ts` / `export-entity-sources.ts` production 수정 (본 task 는 이들을 **읽기만** 한다 — 필요한 타입이 export 안 돼 있으면 그 사실을 Follow-ups 에 적고 우회하지 말 것).
- `ExportRecord` 가 `{ entity, instant }` 최소 shape 라 실제 row 재구성이 불가능한 문제 (dump payload 확장) — 별도 slice / ADR 대상. 본 task 는 records 를 **불투명하게 그대로 옮기기만** 한다.
- `import.controller.ts` 의 interim false-success guard 교체 · REST 배선 (chain 마지막 slice).
- `import-dump-validate.ts` 의 판정 로직 · issue 개수 · 검증 순서 변경 (동반 회수는 **문구만**).
- DB schema 변경 · migration · 새 외부 dependency 추가 (0 건).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (T-1261 reviewer round 2 MINOR-1 이월) `docs/architecture/estimate-model.md` sub-multiplier 박제 follow-up 에 chain 실측치 합산 — T-1261 총 595 (prod 106 / spec 489), T-1262 총 628 (prod 154 / spec 474). `sizeExempt` 근거 추정치의 약 1.3~1.9 배이며 **nit-closure 분량도 추정에 포함해야 한다** 는 항목 추가.
