---
id: T-1258
title: Import dump records 역직렬화 helper (ISO instant → Date, ExportRecord[] 복원)
phase: P5
status: DONE
commitMode: pr
prNumber: 1149
mergedAs: 5bfdc90f
reviewRounds: 2
completedAt: 2026-07-27T09:29:00Z
coversReq: [REQ-030, REQ-032]
estimatedDiff: 250
estimatedFiles: 2
created: 2026-07-27
independentStream: import-restore-engine
dependsOn: [T-1257]
touchesFiles:
  - src/import/import-dump-records-hydrate.ts
  - src/import/import-dump-records-hydrate.spec.ts
plannerNote: P5 ADR-0055 §Follow-up(b) 네 번째 slice — screen 통과 dump 의 records 를 ExportRecord[](Date instant)로 복원 ($transaction 복원 입력 계약)
---

# T-1258 — Import dump records 역직렬화 helper (ISO instant → Date, ExportRecord[] 복원)

## Why

[ADR-0055](../decisions/ADR-0055-import-multipart-file-upload.md) §Follow-up (b) 복원 엔진 chain (역직렬화 → 구조 검증 → schema version gate → **복원 plan 입력 복원** → [ADR-0044 §3](../decisions/ADR-0044-export-import-job-persistence.md) atomic `$transaction` 복원 → controller 재배선) 의 **네 번째 slice** 다. 직전 T-1257 의 `screenImportDumpBuffer` 는 "복원 시도해도 되는 dump 인가" 까지 답하지만, 그 결과 `dump.records` 는 **JSON round-trip 을 거친 plain object 배열 (instant 가 ISO string)** 이라 하류 복원 plan helper `buildImportRestorePlan` ([src/export/import-restore-plan.ts](../../src/export/import-restore-plan.ts)) 이 요구하는 `ExportRecord[]` (`instant: Date`) 계약과 타입이 맞지 않는다 — 저장소 어디에도 이 역직렬화(hydration)를 수행하는 helper 가 없다 (`git grep` 결과 production caller·helper 0). 본 task 는 그 gap 만 순수 helper 로 닫아 `$transaction` 복원 slice 의 입력 계약을 완성한다. REQ-030 (Import) / REQ-032 (raw 미저장 — 변환 결과를 어디에도 영속 저장하지 않음) 을 cover 한다.

## Required Reading

- [src/import/import-dump-screen.ts](../../src/import/import-dump-screen.ts) — 상류 verdict. 성공 시 `{ ok: true; dump: Record<string, unknown>; version }` 를 돌려주며, 본 helper 는 그 `dump` 를 입력으로 받는다 (호출·수정 0 — 타입 계약 확인용).
- [src/export/export-scope-select.ts](../../src/export/export-scope-select.ts) 16~29 행 — `ExportEntity` (5-union) 와 `ExportRecord { entity: ExportEntity; instant: Date }`. 본 helper 의 출력 타입은 **이 두 타입을 재사용** 하며 새 도메인 타입을 신설하지 않는다.
- [src/export/import-dump-validate.ts](../../src/export/import-dump-validate.ts) 24~35 행 + 97~125 행 — 5 entity 상수를 로컬 mirror 하는 선례와 `records[index]` 원소 검증 규칙 (`instant` 는 **존재 여부만** 검증하고 타입은 검증하지 않는다 → 그 잔여가 본 helper 책임). 위반 메시지에 index 를 담는 한국어 convention 도 여기서 mirror 한다. 본 task 는 이 파일을 **수정하지 않는다**.
- [src/export/import-restore-plan.ts](../../src/export/import-restore-plan.ts) 20~50 행 — 하류 소비자. `buildImportRestorePlan` 이 `ExportRecord[]` (유효 `Date` instant) 를 전제하고 Invalid Date 를 `TypeError` 로 막는다는 근거 (본 helper 가 그 앞단에서 verdict 로 흡수해 throw 를 예방). 호출·수정 0.
- [src/import/import-dump-parse.spec.ts](../../src/import/import-dump-parse.spec.ts) — 신규 colocated spec 이 mirror 할 test 구조 (분기별 `describe` + non-mutating 검증 + throw 0 검증).

## Acceptance Criteria

- [ ] `src/import/import-dump-records-hydrate.ts` 신설 — 순수 함수 `hydrateImportDumpRecords(dump: Record<string, unknown>): ImportDumpRecordsHydration` 를 export 한다. 결과는 discriminated union `{ ok: true; records: ExportRecord[] } | { ok: false; issues: string[] }` (verdict-style, **throw 0** — sibling 순수 helper 패턴 mirror). `ExportRecord` / `ExportEntity` 는 `../export/export-scope-select` 에서 import 해 재사용하고 새 도메인 타입 신설 0.
- [ ] 동작: (1) `dump.records` 가 배열이 아니면 `{ ok: false, issues: [한국어 1건] }`. (2) 배열이면 각 원소를 검사해 — plain object 아님 / `entity` 가 5 허용 값 아님 / `instant` 가 ISO 파싱 가능한 string 도 유효 `Date` instance 도 아님 (빈 문자열·Invalid Date·number·null 포함) — 위반마다 **그 index 를 담은 한국어 issue 를 누적** 한다 (early-return 아님 — 여러 위반 동시 박제, `import-dump-validate` 패턴 정합). (3) 위반 0 이면 입력 **순서를 보존한** `ExportRecord[]` 를 새 객체로 만들어 `{ ok: true, records }` 반환 (`instant` 는 `new Date(...)`, 이미 `Date` 인 원소도 새 `Date` 로 복사).
- [ ] 순수·non-mutating — 입력 `dump` / `dump.records` / 원소 객체를 변형 0 (freeze 된 입력으로 호출해도 통과), DB · repository · file I/O · JSON 파싱 · schema version 판정 · 구조 무결성 재검증 (`validateImportDumpStructure` 재구현) · `buildImportRestorePlan` 호출 · REST 배선 0. 상류 helper 규칙 재구현 없이 **records 원소의 타입 복원만** 담당한다 (DRY).
- [ ] **Happy-path unit test 1+**: 정상 dump (5 entity 혼합 + ISO string instant) → `ok: true`, `records.length` 일치, 각 원소의 `instant instanceof Date` 이고 `getTime()` 이 원본 ISO 와 동일, `entity` 순서 보존. 빈 `records: []` → `ok: true` + 빈 배열.
- [ ] **Error path unit test 1+**: `records` 가 배열 아님 (undefined / object / string) → `ok: false` + issue 1건. 원소가 plain object 아님 (null / 배열 / number) → `ok: false` + 해당 index 를 포함한 issue.
- [ ] **분기 cover**: 위 (1) 비-배열 / (2) 원소 위반 누적 / (3) 성공 세 분기 각 1+ test. `instant` 가 ISO string 인 경우와 이미 `Date` instance 인 경우 두 경로 각 1+ test.
- [ ] **Negative cases 충분 cover** — 각 1+ test: 잘못된 `entity` 값 (5-union 밖 문자열 · 비-string), `instant` 가 빈 문자열 / 파싱 불가 문자열 / `Invalid Date` instance / number / null / 누락, 위반 원소가 **2개 이상** 일 때 issues 가 모두 누적되고 각 메시지에 서로 다른 index 가 담김, 유효/위반 원소가 섞였을 때 `ok: false` 이고 부분 결과를 반환하지 않음, 그리고 **어떤 입력에서도 함수가 throw 하지 않음** (`expect(() => ...).not.toThrow()`).
- [ ] non-mutating 검증 test 1+ — `Object.freeze` 한 dump/records/원소로 호출해도 통과하고, 호출 후 원본 원소의 `instant` 가 여전히 원래 값 (string) 임을 확인.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 신규 파일 2종은 line / branch / function 100% 목표.
- [ ] 새 외부 dependency 0 — `package.json` 변경 없음.

## Out of Scope

- ADR-0044 §3 atomic `$transaction` 복원 실행 (deleteMany / createMany / Prisma 호출) — 다음 slice.
- `import.controller.ts` 의 interim false-success guard (T-1254) 교체·재배선 — 후속 slice. 본 helper 는 어디에도 배선하지 않는다 (caller 0 인 채 머지).
- `buildImportRestorePlan` / `summarizeImportPreflight` / `screenImportDumpBuffer` 등 기존 helper 의 signature·본문 수정.
- 구조 무결성 재검증 · schema version 판정 · size / checksum / merge conflict 판정 로직 추가 (각 helper 가 source-of-truth).
- entity 별 도메인 field (Assessment 본문 등) 복원 — 현 `ExportRecord` 는 `{ entity, instant }` 뿐이며 확장은 별건.
- e2e / smoke spec 추가, `docs/architecture/*` 갱신.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — 신설 시. 참고: ADR-0055 §Follow-up (b) 잔여 slice = ADR-0044 §3 `$transaction` 복원 엔진 → controller interim guard 교체 재배선.)
