---
id: T-1290
title: selectExportRecords / ExportSelection 제네릭 확장 (full-record fields 보존 타입 열기)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 120
estimatedFiles: 2
created: 2026-07-28
independentStream: export-scope-materialization
dependsOn: []
touchesFiles:
  - src/export/export-scope-select.ts
  - src/export/export-scope-select.spec.ts
plannerNote: "cap-bend 없음: R-112 backbone x1.5 = 120 LOC / 2 파일. export scope 미반영 gap 의 선행 타입 slice — T-1266 제네릭 확장 선례 동형, 런타임 0 변경"
---

# T-1290 — selectExportRecords / ExportSelection 제네릭 확장 (full-record fields 보존 타입 열기)

## Why

[T-1287](T-1287-import-restore-http-e2e.md) ~ [T-1289](T-1289-import-merge-mode-e2e.md) 이 import 복원 왕복을 실 DB 사실로 닫는 동안, 그 다음 slice 로 예고돼 있던 **부분 dump (scope 한정) + MERGE cross-instance migration e2e** ([UC-07](../use-cases/UC-07-export-import.md) §6.2) 가 **애초에 성립하지 않는다**는 사실이 드러났다 — 실 다운로드 경로 [`materializeFullExportDownload`](../../src/export/export-job.service.ts) 가 주석으로 명시하듯 **scope 선별을 적용하지 않는다** ("scope 선별 필터링(selectExportRecords)을 추가하지 않는다 … envelope `scope` 는 meta context 로만 박제된다 — 별도 task"). 즉 Admin 이 `scope=PARTIAL + entitySelector=["Group"]` 로 job 을 만들어도 내려받는 dump 는 **5 entity 전부** 이며, `scope` 는 metadata 로만 찍힌다. UC-07 §6.1 이 박제한 scope 3 차원 옵션이 실 artifact 에 **미반영** 인 상태다 (REQ-030 전반부).

그 배선을 하려면 `collectFullExportRecords` 가 만드는 `FullExportRecord[]` (= `ExportRecord` + `fields`) 를 `selectExportRecords` 에 통과시켜야 하는데, 현 시그니처는 `ReadonlyArray<ExportRecord>` → `ExportSelection` (`ExportRecord[]`) 로 **고정** 이라 통과시키면 `fields` 가 타입에서 지워진다 — 배선 slice 가 캐스팅을 끌어들이게 된다. 본 slice 는 그 캐스팅 표면을 만들기 **전에** 타입만 열어둔다: [T-1266](T-1266-restore-plan-generic.md) 이 `buildImportRestorePlan` 에 `TInsert` 를 열어 dump record 의 `fields` 를 캐스팅 없이 흘린 것과 **동형** 이며, 그때와 같이 **런타임 동작은 0 변경** (이미 `filter`/`push` 로 원소 **참조** 를 그대로 옮기고 있다).

**estimate 근거** — 본체는 `interface ExportSelection` 1 줄 + 함수 시그니처 3 줄 + 내부 지역 배열 타입 2 곳의 제네릭화 (~15 LOC) 이고, 나머지는 spec 확장 (제네릭 입력 happy/branch/negative ~90 LOC). 새 파일 0, 새 helper 0. R-112 backbone × 1.5, base ~80 → **~120 LOC / 2 파일** (cap 300 안, `sizeExempt` 불요).

## Required Reading

- [src/export/export-scope-select.ts](../../src/export/export-scope-select.ts) 전체 (191 줄) — **본 task 의 유일한 production 변경 대상**. `ExportRecord` / `ExportScope` / `ExportSelection` (42~45 행) / `selectExportRecords` (106 행~) 와 그 3 분기 (full / range / partial) · 입력 방어 (`RangeError` scope, `TypeError` 비배열, `TypeError` invalid instant + index) · 순서 보존 · non-mutating 계약.
- [src/export/export-scope-select.spec.ts](../../src/export/export-scope-select.spec.ts) (381 줄) — 기존 단언 계약. **덧붙이기만** 하고 기존 test 는 수정하지 않는다.
- [src/export/export-full-record.ts](../../src/export/export-full-record.ts) 의 `FullExportRecord` (27 행) + `buildFullExportRecord` (75 행) — 제네릭 인스턴스화 test 가 쓸 실제 superset 타입. **0 수정**.
- [src/export/import-restore-plan.ts](../../src/export/import-restore-plan.ts) 의 `buildImportRestorePlan<TInsert extends ExportRecord = ExportRecord>` (114~120 행) — 본 slice 가 mirror 할 **선례 시그니처 형태** (default 타입 인자로 기존 호출처 무변경). **0 수정**.
- [src/export/export-job.service.ts](../../src/export/export-job.service.ts) 의 `materializeFullExportDownload` 머리 주석 (421~450 행) — 본 slice 가 여는 타입의 **소비처 예고** (배선은 다음 slice, 본 task 는 손대지 않는다).
- [src/export/export-dump-size-estimate.ts](../../src/export/export-dump-size-estimate.ts) 의 `estimateExportDumpSize(selection: ExportSelection)` (122 행) — default 타입 인자로 **무변경 컴파일** 되어야 하는 기존 consumer. **0 수정**.

## Acceptance Criteria

- [ ] **변경 파일 2 개** — `src/export/export-scope-select.ts` + colocated spec `src/export/export-scope-select.spec.ts` 만. 다른 `src/**` · `test/**` · `web/**` · `prisma/**` · `package.json` **0 수정**.
- [ ] **`ExportSelection` 제네릭화** — `export interface ExportSelection<TRecord extends ExportRecord = ExportRecord> { selected: TRecord[]; excluded: TRecord[] }`. default 타입 인자 덕분에 기존 `ExportSelection` 표기 (예: `export-dump-size-estimate.ts` 122 행, `export-job.service.ts`) 는 **한 글자도 고치지 않고** 컴파일된다.
- [ ] **`selectExportRecords` 제네릭화** — `selectExportRecords<TRecord extends ExportRecord = ExportRecord>(scope: ExportScope, records: ReadonlyArray<TRecord>): ExportSelection<TRecord>`. **런타임 본문 변경 0** — 분기 순서 · 검증 순서 · 에러 메시지 문자열 · 결과 순서 보존 · non-mutating 전부 현행 그대로 (내부 지역 배열의 원소 타입만 `TRecord` 로 좁힌다). 인자 순서 `(scope, records)` 도 불변.
- [ ] **happy — `FullExportRecord` 인스턴스화 1+** — `buildFullExportRecord` 로 만든 `fields` 보유 record 배열을 넘기면 반환 `selected[0].fields` 를 **캐스팅 없이** 읽을 수 있고 (타입), 그 값이 입력 원소와 **동일 참조** 다 (런타임 — `toBe` 로 단언). 기존 `ExportRecord` 만 넘기는 happy 경로도 그대로 통과한다.
- [ ] **분기 cover — full / range / partial 각 1+** — 제네릭 입력 (`FullExportRecord[]`) 에서도 세 scope 분기의 분류 결과가 기존과 동일하다: full = 전부 selected, range = `[start, end)` 반열림 경계, partial = `entitySelector` 멤버십. 각 분기에서 `selected` + `excluded` 의 합집합이 입력과 일치 (중복/누락 0) 하고 순서가 보존된다.
- [ ] **error path 1+** — 제네릭 인스턴스화 상태에서도 기존 throw 계약이 동일하다: (a) 허용 외 scope → `RangeError`, (b) records 비배열 → `TypeError`, (c) 원소 `instant` 가 비-Date / Invalid Date → **그 index 가 담긴** `TypeError`. 메시지 문자열이 현행과 같은지 함께 단언한다 (문구 회귀 방지).
- [ ] **negative cases 충분 cover** — 예외 상황마다 1+: (a) `scope=partial` + `entitySelector` 부재/빈 배열 → `RangeError`, (b) `scope=range` + `dateRange` 누락 → `RangeError`, (c) 빈 records 입력은 error 가 아니라 빈 분류 2 개, (d) `Object.freeze` 한 입력 배열·원소를 넘겨도 throw 없이 통과하고 **입력이 변형되지 않는다** (non-mutating — 입력 배열 길이·원소 참조 동일), (e) `fields` 가 있는 record 와 없는 record 를 섞어 넘겨도 분류가 깨지지 않는다 (구조적 superset 혼합).
- [ ] **기존 consumer 무변경 실증 1+** — spec 안에서 `ExportSelection` 을 **타입 인자 없이** 선언한 변수에 `selectExportRecords(scope, records)` 결과를 대입해도 컴파일된다 (default 타입 인자 회귀 방지). `pnpm build` / `tsc --noEmit` 이 `export-dump-size-estimate.ts` · `export-job.service.ts` 를 **무수정으로** 통과하는 것으로 갈음한다.
- [ ] **머리 주석 amend** — `export-scope-select.ts` 머리/함수 주석에 제네릭 확장의 의도 (full-record `fields` 를 캐스팅 없이 흘리기 위한 타입-only 확장, 런타임 0 변경, T-1266 동형) 를 **한국어** (§12) 로 3~5 줄 덧붙인다. 기존 주석 내용은 지우지 않는다.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `prettier --check` 통과, `scripts/check-spec-presence.sh` 통과.
- [ ] **diff 규율** — 총 diff ≤ 300 LOC / 2 파일. 초과가 예상되면 negative (e) → (d) 순으로 덜어내고 그 사실을 PR body + 본 task Follow-ups 에 박제한다.

## Out of Scope

- **`materializeFullExportDownload` 배선 0** — scope 선별을 실 다운로드에 적용하는 것은 **다음 slice** (Follow-ups). 본 task 는 그 배선이 캐스팅 없이 가능하도록 타입만 연다. `export-job.service.ts` **0 수정**.
- **런타임 동작 변경 0** — 분류 규칙 · 경계 해석 · 에러 메시지 · 순서 · 성능 특성 전부 불변. 본 slice 로 dump 내용이 바뀌면 안 된다.
- **`ExportRecord` / `FullExportRecord` 타입 자체 수정 0**, 새 helper · 새 파일 · 새 타입 신설 0.
- **`export-scope-validate.ts` · `export-selection-summary.ts` · `export-dump-size-estimate.ts` 제네릭화 0** — 필요해지면 소비 slice 에서 판단 (지금 미리 열지 않는다).
- **import 측 0** — `import-restore-plan.ts` 는 이미 T-1266 에서 열려 있으므로 손대지 않는다.
- **e2e / smoke 추가 0** — 타입-only 변경이라 HTTP 경계 사실이 바뀌지 않는다. 실 왕복 검증은 배선 slice 이후.
- **새 ADR · Prisma schema/migration · 새 외부 dependency · `web/` UI 수정 0**.
- **`deploy/daily-test.sh` leg 추가 0** — leg 를 늘리면 drift-guard smoke spec 3 종 (T-0791 / T-0944 / T-0947) 동반 수정이 강제돼 파일 수 cap 을 넘긴다 (MEMORY: daily-test leg drift-guard parity, Q-0054 / T-1122 BLOCKED 선례).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (다음 slice, 본 chain) `materializeFullExportDownload` 에 `selectExportRecords(scope, records)` 배선 — dump 가 job 의 scope (RANGE dateRange / PARTIAL entitySelector) 를 실제로 반영하도록. `entityCounts` / `recordCount` 가 선별 후 기준이 되는지, `excluded` 를 버리는지 확인 필요. 그 slice 이후에야 **부분 dump + MERGE cross-instance migration e2e** (T-1289 예고) 가 성립한다.
- (유지, 3c-3d3) 크기 상한 413 e2e — 50 MiB 초과 업로드. **선행 확인 의무**: supertest 가 multer mid-stream abort 를 어떻게 표면화하는지 (ECONNRESET / EPIPE) 국소 확인 후, flaky 하면 기존 `multer-exception.filter.spec.ts` 의 실 파이프라인 경계 (10 bytes 상한) 로 만족시키고 e2e 는 포기하는 선택지를 planner 에 보고한다.
- (미해결 정책, T-1287 → T-1289 이월) `LlmProviderConfig` 왕복 불가 — export full-record select 가 `apiKey` 를 제외 (ADR-0047 secret deny) 하는데 schema 의 `apiKey` 는 not-null 이라, 실 운영 dump 에 그 entity 가 1 건이라도 있으면 REPLACE / MERGE 어느 mode 든 복원 `$transaction` 이 통째로 실패할 것으로 예상된다 (`deploy/seed-llm-config.sh` 가 운영 인스턴스에 그 row 를 심으므로 실사용에서 거의 확실히 발생). **복원 정책 (해당 entity skip / 재입력 요구 / 부분 실패 안내) 은 secret 처리 결정이라 CLAUDE.md §5 상 사람 결정 대상** — driver 가 `humanQuestion` 으로 escalate 하는 것이 적절하다.
- (관측, 본 task 조사 중 확인) UC-07 §8 (b)(e) 가 요구하는 **Export / Import Audit log row 영속화 0** — 순수 helper `buildExportImportAuditEntry` (T-0443) 는 있으나 실 insert 경로가 없고, Prisma 에 범용 `AuditLog` model 자체가 없다 (`AuditLog` export entity 는 `PermissionDeniedRecord` 매핑). 도입은 schema migration 이라 §5 사람 결정 대상.
