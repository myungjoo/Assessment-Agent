---
id: T-1266
title: 복원 plan 의 insert record 타입 일반화
phase: P5
status: DONE
prNumber: 1157
completedAt: 2026-07-27T16:44:00Z
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 300
estimatedFiles: 2
created: 2026-07-27
independentStream: import-restore-engine
dependsOn: [T-1265]
touchesFiles:
  - src/export/import-restore-plan.ts
  - src/export/import-restore-plan.spec.ts
sizeExempt: true
exemptReason: R-112 backbone slice — production 변경은 타입 파라미터 도입 ~30 LOC 로 cap 안이고 초과분은 전량 spec (generic 추론 pinning, fields identity 승계, default 파라미터 회귀, freeze 비변형, 기존 throw 계약 회귀 negative 다수). 동일 chain 실측 선례 T-1261 총 595, T-1262 총 628, T-1265 총 805.
plannerNote: "cap-bend pre-justified: R-112 backbone x 1.5 = 300 LOC, 선례 T-1265 실측 805 — ADR-0055 §Follow-up(b) 12 번째 slice"
---

# T-1266 — 복원 plan 의 insert record 타입 일반화

## Why

[ADR-0055](../decisions/ADR-0055-import-multipart-file-upload.md) §Follow-up (b) 복원 엔진 chain (역직렬화 → 구조 검증 → version gate → records hydrate → 복원 입력 합성 → plan 산출 → FK 안전 순서 → operation 그룹핑 → entity 매핑 공용 module → `$transaction` step 계획 → dump record `fields` 보존 → **타입 전파** → 실 `$transaction` 실행 → controller 재배선) 의 **열두 번째 slice** 다.

T-1265 로 `hydrateImportDumpRecords` 가 `FullExportRecord[]` (= `ExportRecord` + `fields`) 를 돌려주게 됐지만, 하류의 `buildImportRestorePlan` 이 입력·출력을 모두 `ExportRecord` 로 못박고 있어 **plan 경계에서 `fields` 가 타입 상 사라진다**. 그 결과 다음 slice (실 `$transaction` 실행) 가 `createMany({ data: fields })` 에 넣을 row payload 를 plan 에서 타입 안전하게 꺼낼 방법이 없다 (T-1265 Follow-ups ① 이 박제한 chain 잔여 후보의 첫 leg).

본 slice 는 그 한 겹만 닫는다 — plan 의 **insert 대상 record 타입만** 타입 파라미터로 열어 incoming 이 실어온 타입이 `toInsert` 까지 그대로 전달되게 한다. 런타임 동작은 **0 변경** 이며 (이미 `incoming.slice()` 로 원소 참조를 그대로 옮기고 있다), 기본 타입 파라미터로 기존 소비처는 한 줄도 고치지 않는다. 실 `$transaction` 실행과 상류 helper 의 타입 전파는 다음 slice 로 그대로 남는다.

## Required Reading

- [src/export/import-restore-plan.ts](../../src/export/import-restore-plan.ts) — 본 task 의 수정 대상. `ImportRestorePlan` interface, `buildImportRestorePlan` 시그니처, replace/merge 2 갈래, `conflictKey` / `assertValidRecords` / `assertValidDate` helper 와 throw 계약.
- [src/export/import-restore-plan.spec.ts](../../src/export/import-restore-plan.spec.ts) — 기존 계약 pinning test (본 slice 가 회귀 0 을 증명해야 할 기준선).
- [src/export/export-full-record.ts](../../src/export/export-full-record.ts) — `FullExportRecord` (`ExportRecord` + `fields: Record<string, unknown>`) 정의. 본 slice 가 타입 파라미터의 실사용 인자로 쓰는 타입.
- [src/export/export-scope-select.ts](../../src/export/export-scope-select.ts) — `ExportRecord` / `ExportEntity` 원 정의 (타입 파라미터 제약의 상한).
- [src/import/import-dump-records-hydrate.ts](../../src/import/import-dump-records-hydrate.ts) — `FullExportRecord[]` 를 돌려주는 상류 (T-1265). 본 slice 의 동기.
- [src/import/import-restore-plan-prepare.ts](../../src/import/import-restore-plan-prepare.ts) — `buildImportRestorePlan` 의 유일한 chain 소비처. 본 slice 이후에도 **수정 없이 컴파일 통과** 함을 확인만 하고 고치지 않는다.
- [src/export/import-restore-plan-summary.ts](../../src/export/import-restore-plan-summary.ts) — `ImportRestorePlan` 을 타입 인자 없이 쓰는 기존 소비처. 기본 타입 파라미터가 이들을 그대로 통과시켜야 한다.
- [docs/decisions/ADR-0044-export-import-job-persistence.md](../decisions/ADR-0044-export-import-job-persistence.md) — §3 replace mode `$transaction([deleteMany, ...create])` (row payload 의 최종 목적지).
- [docs/decisions/ADR-0055-import-multipart-file-upload.md](../decisions/ADR-0055-import-multipart-file-upload.md) — §Follow-up (b) 복원 엔진 chain 의 slice 경계.

## Acceptance Criteria

- [ ] `ImportRestorePlan` 을 **insert record 타입만** 여는 단일 타입 파라미터로 일반화한다 — `ImportRestorePlan<TInsert extends ExportRecord = ExportRecord>` 형태로 `toInsert: TInsert[]` 만 파라미터화하고, `toDelete` / `toKeep` 은 기존 record (DB 에서 읽은 `ExportRecord`) 에서 오므로 `ExportRecord[]` 그대로 둔다. 파라미터 이름·기본값 선택 근거를 주석 1~2 줄로 남긴다.
- [ ] `buildImportRestorePlan` 시그니처를 `<TInsert extends ExportRecord = ExportRecord>(existing: ReadonlyArray<ExportRecord>, incoming: ReadonlyArray<TInsert>, mode: ImportRestoreMode): ImportRestorePlan<TInsert>` 로 좁힌다 — `existing` 은 파라미터화하지 않는다 (기존 row 는 `fields` 를 갖지 않으며, merge 의 targeted delete 는 미해결 별도 slice).
- [ ] **런타임 동작 0 변경** — replace/merge 분기, `conflictKey` (entity + instant millis), 입력 순서 보존, 새 배열 반환, non-mutating 계약, throw 계약 (비-배열 `existing`/`incoming` → TypeError, 원소 `instant` 가 비-Date/Invalid Date → index 를 담은 TypeError, mode 가 replace/merge 밖 → RangeError) 과 **한국어 메시지 문구가 모두 그대로** 다. production 코드의 실행 문장은 타입 표기 외에 변경 0.
- [ ] `fields` 는 들여다보지도 변환하지도 않는다 (REQ-032 정합) — `conflictKey` 는 여전히 `entity` + `instant` 만 쓰고, 어떤 error 메시지에도 `fields` 값·payload·stack 이 실리지 않는다.
- [ ] 기본 타입 파라미터 하위호환 — `ImportRestorePlan` 을 **타입 인자 없이** 쓰는 기존 소비처 (`import-restore-plan-summary.ts`, `import-merge-conflict.ts`, `import-preflight-summary.ts`, `import-restore-confirmation.ts`, `import-restore-ops.ts`, `import-restore-plan-prepare.ts` 등) 는 **한 파일도 수정하지 않는다**. `pnpm build` 가 다른 파일 변경 없이 통과해야 하며, 수정이 필요해지면 기본 파라미터 설계가 틀린 것이므로 설계를 고친다.
- [ ] **happy-path unit test 1+** — (a) `FullExportRecord[]` 를 `incoming` 으로 넘기면 replace mode 의 `toInsert` 원소가 `fields` 를 그대로 갖고 **참조 identity 까지 동일** 함을 단언, (b) merge mode 에서도 `toInsert` 가 incoming 전부를 순서 보존해 싣고 각 원소의 `fields` 가 손실 0 임을 단언, (c) 타입 인자 없이 `ExportRecord[]` 로 호출한 기존 사용법이 그대로 동작.
- [ ] **컴파일 타임 pinning test** — 반환 plan 을 `ImportRestorePlan<FullExportRecord>` 타입 변수에 대입해 추론이 좁혀짐을 spec 안에서 고정하고, `toInsert[0].fields` 를 `as` 캐스팅 없이 읽는 문장을 둔다 (타입이 다시 넓어지면 `pnpm build` 가 깨지도록). `@ts-expect-error` 로 `toDelete[0].fields` 접근이 타입 오류임도 함께 박제한다.
- [ ] **error path unit test 1+** — 비-배열 `existing` / 비-배열 `incoming` / `incoming` 원소의 `instant` 가 Invalid Date / 비-Date / `fields` 를 가진 원소의 `instant` 누락 각각이 기존과 **동일한 error 종류와 동일한 한국어 메시지** 로 throw 됨을 단언한다 (메시지 문자열 회귀 pinning).
- [ ] **분기 cover** — replace / merge 2 분기, merge 의 충돌/비충돌 2 분기, mode 무효 분기, `existing` / `incoming` 각각의 배열 판정 분기 각 1+ test.
- [ ] **negative cases 충분 cover** — 예외 · 경계 분기마다 1+: (a) freeze 된 `existing` / `incoming` 배열과 freeze 된 원소 · freeze 된 `fields` 로 호출해도 throw 0 · 결과 동일, (b) 반환 plan 의 배열을 push/pop 해도 입력 배열 불변, (c) `existing` 은 `fields` 없는 `ExportRecord`, `incoming` 은 `FullExportRecord` 인 **혼합 호출** 이 정상 동작 (실제 배선의 형태), (d) merge 에서 `fields` 가 서로 다른데 `entity` + `instant` 가 같은 원소는 여전히 충돌로 판정 (`fields` 는 key 에 영향 0), (e) 빈 `incoming` / 빈 `existing` 경계, (f) mode 가 `null` / `"REPLACE"` (대소문자 mismatch) / 숫자 / 객체일 때 RangeError 와 메시지, (g) error 메시지에 `fields` 의 값이 실리지 않음 (secret 유사 문자열을 넣고 정규식으로 미노출 단언), (h) 같은 입력으로 두 번 호출하면 동일 결과 (idempotent).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 변경 파일은 statement/branch/function/line 100% 목표 (동일 chain 선례 T-1255~T-1265 동형).
- [ ] `scripts/check-spec-presence.sh` 통과, `prettier --check` 통과.

## Out of Scope

- 실 `$transaction` 실행 · Prisma delegate 호출 · `PrismaService` 주입 · DB 접근 (다음 slice).
- 상류 helper 의 타입 전파 — `import-restore-input.ts` / `import-restore-plan-prepare.ts` 가 `records: FullExportRecord[]` 를 노출하도록 좁히는 작업 (본 slice 는 plan 의 타입 문만 연다. 전파는 다음 slice — Follow-ups).
- 하류 `import-restore-ops.ts` / `import-restore-steps.ts` 의 record 타입 파라미터화 (별도 slice).
- `existing` 측 타입 파라미터화 · merge mode 의 targeted delete 설계 (`toDelete` record 가 row 식별 key 를 갖지 않는 미해결 문제 — ADR 대상 가능성, 별도 slice).
- `fields` 값의 타입 검증 · 강제 변환 · Prisma 컬럼 정합 판정 (본 layer 책임 0).
- `describeReceived` / `describeFieldsKind` 공용 module 추출 (별도 refactor slice).
- `fields` 없는 legacy dump 정책 · `schemaVersion` migrate 정책 (별도 결정).
- `import.controller.ts` 의 interim false-success guard 교체 · REST 배선 (chain 마지막 slice).
- DB schema 변경 · migration · 새 외부 dependency 추가 (0 건).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (T-1265 이월) 후속 slice 후보 (chain 잔여): ① 상류 타입 전파 (`import-restore-input.ts` → `import-restore-plan-prepare.ts`), ② 하류 타입 전파 (`import-restore-ops.ts` → `import-restore-steps.ts`), ③ 실 `$transaction` 실행 helper (replace = entity 별 `deleteMany` + `createMany({ data: fields })`, ADR-0044 §3), ④ merge mode 의 delete 타게팅 (row 식별 key 부재 — ADR 대상 가능성), ⑤ controller interim guard 교체.
- (T-1264 reviewer NIT-2 + T-1265 reviewer NIT-1 이월) `describeReceived` 가 `import-restore-steps.ts` · `import-restore-ops.ts` · `export-job-status-view.ts` 에, 동형 `describeFieldsKind` 가 `import-dump-records-hydrate.ts` 에 — 같은 "받은 값 종류 표기" 로직 4 사본. 공용 module 추출 refactor slice 후보 (T-1263 의 `EXPORT_ENTITY_SOURCES` 승격과 동형 패턴).
- (T-1264 reviewer NIT-3 이월) `ImportRestoreStepMethod` 의 `"deleteMany" | "createMany"` 가 실 Prisma delegate 메서드 이름과 컴파일 차원으로 묶여있지 않음 — `$transaction` 실행 slice 의 Acceptance Criteria 로 회수.
- (T-1265 reviewer round 1 MINOR-3 이월) controller 배선 slice **이전에** legacy dump (`fields` 부재) 정책을 결정한다 — 현재 `fields` 가 필수라 구버전 dump 복원이 전량 `stage: "records"` 로 거부된다.
- (T-1261 reviewer round 2 MINOR-1 이월) `docs/architecture/estimate-model.md` sub-multiplier 박제에 chain 실측치 합산 — T-1261 총 595, T-1262 총 628, T-1265 총 805, T-1266 총 342. nit-closure 분량도 추정에 포함해야 한다는 항목 추가.
- (T-1266 integrator 관측 → T-1267 로 큐잉됨) `src/export/import-restore-plan.ts` 가 `conflictKey` 구분자로 raw NUL 바이트를 소스에 직접 품어 git 이 파일을 binary 로 취급 — GitHub UI 에서 production diff 가 표시되지 않아 reviewer 가 코드 변경을 눈으로 못 본다 (§3.3 게이트 품질 직결). origin/main 기준선의 선행 조건이며 본 slice 유래 아님.
- (T-1266 planner 관측) tracked 파일 중 raw NUL 보유가 총 10 개 (assessment-evaluation 6 + test 2 + 본 chain 2). T-1267 은 chain 파일만 정리하며, 나머지 일괄 정리 + 제어 바이트 금지 CI 가드는 별도 slice.
- (T-1266 reviewer round 1 NIT-2 이월) `import-restore-plan.spec.ts` 의 `full()` fixture 가 `buildFullExportRecord` allow-list 를 우회해 임의 key 를 넣는다 — 상류 allow-list 계약이 바뀌어도 본 spec 은 detect 0. 본 layer 책임이 아니라 수용했으나 인지 항목으로 박제.
