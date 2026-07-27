---
id: T-1265
title: Import dump record `fields` 보존 hydrate
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 380
estimatedFiles: 2
created: 2026-07-27
independentStream: import-restore-engine
dependsOn: [T-1264]
touchesFiles:
  - src/import/import-dump-records-hydrate.ts
  - src/import/import-dump-records-hydrate.spec.ts
sizeExempt: true
exemptReason: R-112 backbone slice — production 은 기존 helper 에 fields 검증·보존 ~70 LOC 증분이라 cap 안이고 초과분은 전량 spec (fields 부재/비-object/allow-list 위반/prototype key/불변성/기존 계약 회귀 negative 다수). 동일 chain 실측 선례 T-1261 총 595(prod 106/spec 489), T-1262 총 628(prod 154/spec 474), T-1264 도 동형.
plannerNote: "cap-bend pre-justified: R-112 backbone x 1.5 = 380 LOC, 선례 T-1262 실측 628 — ADR-0055 §Follow-up(b) 11 번째 slice"
---

# T-1265 — Import dump record `fields` 보존 hydrate

## Why

[ADR-0055](../decisions/ADR-0055-import-multipart-file-upload.md) §Follow-up (b) 복원 엔진 chain (역직렬화 → 구조 검증 → version gate → records hydrate → 복원 입력 합성 → plan 산출 → FK 안전 순서 → operation 그룹핑 → entity 매핑 공용 module → `$transaction` step 계획 → **실 `$transaction` 실행** → controller 재배선) 의 **열한 번째 slice** 다.

T-1264 로 step 계획 (`planImportRestoreTransactionSteps`) 까지 닫히면서 다음 slice 는 실 `$transaction` 실행인데, 그 slice 가 곧바로 막힌다 — 실제 export 다운로드 경로 (`ExportJobService.materializeFullExportDownload`) 는 `buildFullExportDump` 로 **`records[i].fields` (full-record payload) 를 담은 dump** 를 쓰는데, 복원 측 `hydrateImportDumpRecords` 는 `{ entity, instant }` 만 남기고 `fields` 를 **버린다**. 그 결과 step 의 `records` 에는 `createMany({ data })` 에 넣을 row 값이 존재하지 않는다 (T-1264 §Out of Scope 가 "dump payload 확장은 별도 slice" 로 남긴 gap, 2026-07-27 journal 의 planner 관측과 동일 건).

본 slice 는 그 gap 만 닫는다 — hydrate 가 `fields` 를 **검증하고 보존** 하도록 좁히고, [ADR-0047](../decisions/ADR-0047-export-dump-db-read-scope.md) §Decision 2(b) 의 allow-list 엄격 거부를 **import 방향으로 mirror** 해 표 밖 key (특히 `LlmConfig.apiKey` 같은 secret) 가 복원 경로로 들어오는 것을 조립 단계에서 차단한다 (REQ-032). 실 `$transaction` 실행은 다음 slice 로 그대로 남는다.

## Required Reading

- [src/import/import-dump-records-hydrate.ts](../../src/import/import-dump-records-hydrate.ts) — 본 task 의 수정 대상. 현 verdict (`ImportDumpRecordsHydration`), 3 분기 구조, issue 누적 패턴, `isPlainObject` / `describeKind` / `toInstant` helper.
- [src/import/import-dump-records-hydrate.spec.ts](../../src/import/import-dump-records-hydrate.spec.ts) — 기존 계약 pinning test (특히 "여분 top-level key drop" 단언 — 본 slice 가 `fields` 예외를 도입하므로 갱신 대상).
- [src/export/export-full-record.ts](../../src/export/export-full-record.ts) — `FullExportRecord` (`ExportRecord` + `fields: Record<string, unknown>`) 타입 정의와 allow-list 엄격 거부 근거 주석 (본 slice 가 mirror 할 정책).
- [src/export/export-entity-full-record-select.ts](../../src/export/export-entity-full-record-select.ts) — `EXPORT_ENTITY_FULL_RECORD_SELECT` / `getExportEntityFullRecordSelect(entity)` allow-list single-source (본 task 에서 재선언 금지).
- [src/export/export-full-dump.ts](../../src/export/export-full-dump.ts) — 실제 dump envelope (`FullExportDump.records: FullExportRecord[]`) — 복원 입력이 실제로 어떤 shape 인지의 근거.
- [src/import/import-restore-input.ts](../../src/import/import-restore-input.ts) — 유일한 소비처. 본 slice 이후에도 `records: ExportRecord[]` 선언 그대로 컴파일 통과함을 확인만 하고 **수정하지 않는다**.
- [docs/decisions/ADR-0047-export-dump-db-read-scope.md](../decisions/ADR-0047-export-dump-db-read-scope.md) — §Decision 2(b) allow-list 엄격 거부 (본 slice 가 import 방향으로 mirror 하는 정책).
- [docs/decisions/ADR-0044-export-import-job-persistence.md](../decisions/ADR-0044-export-import-job-persistence.md) — §3 replace mode `$transaction([deleteMany, ...create])` (하류가 필요로 하는 row payload 의 목적지).
- [docs/decisions/ADR-0055-import-multipart-file-upload.md](../decisions/ADR-0055-import-multipart-file-upload.md) — §Follow-up (b) 복원 엔진 chain 의 slice 경계.

## Acceptance Criteria

- [ ] `ImportDumpRecordsHydration` 의 성공 갈래를 `{ ok: true; records: FullExportRecord[] }` 로 좁힌다 — `FullExportRecord` 는 `src/export/export-full-record.ts` 에서 import 재사용하고 새 record 타입을 신설하지 않는다.
- [ ] `fields` 필수 계약 — 원소의 `fields` 가 부재하거나 plain object 가 아니면 (null / 배열 / 문자열 / 숫자 / boolean) 그 index 를 담은 issue 를 누적한다. 기존 `entity` / `instant` 위반과 동일하게 **early-return 없이 누적** 하고, 위반이 하나라도 있으면 부분 결과 없이 `{ ok: false, issues }` 를 돌려준다.
- [ ] allow-list 멤버십 검증 — `getExportEntityFullRecordSelect(entity)` 로 얻은 해당 entity 의 allow-list 밖 key 가 `fields` 에 하나라도 있으면 issue 를 만든다 (ADR-0047 §Decision 2(b) 엄격 거부의 import 측 mirror — secret `apiKey` 혼입 차단). allow-list 5 entity 매핑을 **본 파일에서 재선언하지 않는다** (사본 0).
- [ ] key 판정은 **own enumerable key** 기준 — `Object.keys` / `Object.prototype.hasOwnProperty` 경유로 판정해 `__proto__` · `constructor` 같은 상속 속성이 오탐/누락되지 않는다.
- [ ] REQ-032 정합 — `fields` 의 **값** 은 들여다보지도 변환하지도 않고 (타입 검증 0, Date 복원 0) 불투명하게 옮긴다. issue 메시지에는 위반 **key 이름과 index** 만 싣고 값 · payload · stack 은 절대 싣지 않는다.
- [ ] 순수 · non-mutating — `fields` 는 **새 객체로 shallow copy** 해 담아 호출자가 반환값의 `fields` 를 바꿔도 입력 dump 가 오염되지 않는다. freeze 된 dump · records · 원소 · `fields` 로 호출해도 throw 0 이며 결과가 동일하다. 여전히 어떤 입력에서도 throw 하지 않는다 (verdict-only).
- [ ] 기존 계약 회귀 0 — `records` 비-배열 단일 issue 분기, `entity` 5 종 판정, `instant` (ISO string / Date instance / 새 Date 복사) 판정, 입력 순서 보존, issue 문구는 **변경 0**. `fields` 관련 issue 만 새로 추가된다.
- [ ] `entity` 가 5 종 밖이면 allow-list 조회 자체가 불가하므로 그 원소에 대해 **allow-list issue 를 중복 생성하지 않는다** (entity issue 만). 이 계약을 test 로 고정한다.
- [ ] 기존 "여분 top-level key drop" pinning test 를 갱신 — `entity` / `instant` / `fields` 3 key 만 승계하고 그 외 top-level key 는 계속 drop 됨을 단언한다 (계약 변경이 의도적임을 test 로 박제).
- [ ] **happy-path unit test 1+** — (a) 5 entity 각각에 대해 allow-list 안 key 로 채운 `fields` 가 손실 없이 그대로 승계되고 (key 집합 · 값 identity 단언), (b) 여러 원소 혼합 입력이 입력 순서를 보존하며, (c) `fields` 가 빈 객체 `{}` 인 원소는 정상 통과 (필수 컬럼 판정은 본 layer 책임 아님 — 계약 pinning).
- [ ] **error path unit test 1+** — `fields` 부재 / `null` / 배열 / 문자열 / 숫자 각각이 index 를 담은 issue 를 만들고, allow-list 밖 key (`apiKey` 포함) 가 issue 를 만들며, 두 원소가 각각 다른 사유로 위반하면 issue 가 **둘 다** 누적된다.
- [ ] **분기 cover** — `fields` plain-object 판정 2 분기, allow-list 위반 유/무 2 분기, entity 무효 시 allow-list 검사 skip 분기, 성공/실패 verdict 2 분기 각 1+ test.
- [ ] **negative cases 충분 cover** — 예외 · 경계 분기마다 1+: (a) `fields` 에 `__proto__` / `constructor` key 를 넣어도 상속 속성 오탐 없이 allow-list 위반으로 잡히고, (b) allow-list 밖 key 가 여러 개면 issue 가 그 사실을 index 와 함께 알리며, (c) issue 메시지에 `fields` 의 **값** 이 실리지 않음 (secret 유사 값 문자열을 넣고 정규식으로 미노출 단언), (d) freeze 된 입력 (dump · records 배열 · 원소 · `fields` 전부 freeze) 으로 호출해도 throw 0 · 결과 동일, (e) 반환 record 의 `fields` 에 key 를 추가/삭제해도 입력 dump 의 `fields` 불변, (f) `entity` 무효 원소는 entity issue 1 건만 (allow-list issue 중복 0), (g) `instant` 무효 + `fields` 무효가 동시인 원소는 issue 2 건 누적, (h) allow-list 상수를 손복사하지 않았음을 보이는 drift 감시 — `EXPORT_ENTITY_FULL_RECORD_SELECT` 를 기준으로 5 entity 의 허용 key 를 순회 검증.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 변경 파일은 statement/branch/function/line 100% 목표 (동일 chain 선례 T-1255~T-1264 동형).
- [ ] `scripts/check-spec-presence.sh` 통과, `prettier --check` 통과.

## Out of Scope

- 실 `$transaction` 실행 · Prisma delegate 호출 · `PrismaService` 주입 · DB 접근 (다음 slice).
- `import-restore-input.ts` / `import-restore-plan.ts` / `import-restore-ops.ts` / `import-restore-steps.ts` 의 타입 전파 (`ExportRecord` → `FullExportRecord` 로 좁히기). `FullExportRecord` 는 `ExportRecord` 의 구조적 superset 이라 **수정 없이 컴파일 통과** 하므로 본 slice 는 건드리지 않는다 (타입 전파는 별도 slice — Follow-ups).
- `fields` 없는 legacy dump 하위호환 · `schemaVersion` migrate 정책 (본 slice 는 `fields` 를 **필수** 로 둔다 — 완화가 필요하면 별도 ADR/slice).
- `fields` 값의 타입 검증 · 강제 변환 (예: 날짜 문자열 → Date, id 형식 검사) — 값은 불투명하게 옮기기만 한다.
- `EXPORT_ENTITY_FULL_RECORD_SELECT` allow-list 내용 변경 · export 측 파일 수정 (읽기만).
- `import.controller.ts` 의 interim false-success guard 교체 · REST 배선 (chain 마지막 slice).
- DB schema 변경 · migration · 새 외부 dependency 추가 (0 건).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (T-1264 reviewer NIT-2 이월) `describeReceived` 가 `src/import/import-restore-steps.ts` · `src/import/import-restore-ops.ts` · `src/export/export-job-status-view.ts` 3 곳에 사본으로 존재 — 공용 module 추출 검토. 본 slice 의 `touchesFiles` 밖이라 **별도 refactor slice 후보** 로 박제 (T-1263 의 `EXPORT_ENTITY_SOURCES` 승격과 동형 패턴).
- (T-1264 reviewer NIT-3 이월) `ImportRestoreStepMethod` 의 `"deleteMany" | "createMany"` 가 실 Prisma delegate 메서드 이름과 컴파일 차원으로 묶여있지 않음 — **다음 `$transaction` 실행 slice 의 Acceptance Criteria 로 회수** (`Pick<Prisma.TransactionClient, ExportEntityDelegate>` 기반 타입 제약 + 5 delegate × 2 method 존재 drift test).
- (T-1261 reviewer round 2 MINOR-1 이월) `docs/architecture/estimate-model.md` sub-multiplier 박제에 chain 실측치 합산 — T-1261 총 595 (prod 106 / spec 489), T-1262 총 628 (prod 154 / spec 474). `sizeExempt` 근거 추정치의 약 1.3~1.9 배이며 **nit-closure 분량도 추정에 포함해야 한다** 는 항목 추가.
- 후속 slice 후보 (chain 잔여): ① `FullExportRecord` 타입 전파 (input → plan → ops → steps), ② 실 `$transaction` 실행 helper (replace = entity 별 `deleteMany` + `createMany({ data: fields })`, ADR-0044 §3), ③ merge mode 의 delete 타게팅 — `toDelete` record 가 row 식별 key 를 갖지 않아 targeted delete 가 불가능한 문제 (ADR 대상 가능성), ④ controller interim guard 교체.
