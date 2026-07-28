---
id: T-1291
title: materializeFullExportDownload 에 scope 선별 배선 (dump 가 RANGE/PARTIAL 을 실제로 반영)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 220
estimatedFiles: 3
created: 2026-07-28
independentStream: export-scope-materialization
dependsOn: [T-1290]
touchesFiles:
  - src/export/export-job.service.ts
  - src/export/export-job.service.spec.ts
  - src/export/export.controller.ts
plannerNote: "cap-bend 없음: R-112 backbone x1.5 = 220 LOC / 3 파일. T-1290 이 연 제네릭 타입의 소비 slice — 캐스팅 0 으로 scope 선별 배선"
---

# T-1291 — materializeFullExportDownload 에 scope 선별 배선 (dump 가 RANGE/PARTIAL 을 실제로 반영)

## Why

[T-1290](T-1290-export-selection-generic-record.md) 이 `selectExportRecords` / `ExportSelection` 을 `TRecord extends ExportRecord = ExportRecord` 로 열어, `FullExportRecord[]` 를 **캐스팅 없이** scope 선별에 통과시킬 수 있게 했다. 본 slice 는 그 타입을 **소비** 해 실 다운로드 경로의 gap 을 닫는다 — 현재 [`materializeFullExportDownload`](../../src/export/export-job.service.ts) (450 행) 는 머리 주석이 명시하듯 "scope 선별 필터링(selectExportRecords)을 추가하지 않는다" 라서, Admin 이 `scope=PARTIAL + entitySelector=["Group"]` 또는 `scope=RANGE + dateRange` 로 job 을 만들어도 내려받는 dump 는 **5 entity 전부** 이고 `scope` 는 envelope metadata 로만 찍힌다. [UC-07](../use-cases/UC-07-export-import.md) §6.1 이 박제한 Export 3 차원 옵션이 실 artifact 에 **미반영** 인 상태 (REQ-030 전반부 미충족) 이며, 이 gap 때문에 [T-1289](T-1289-import-merge-mode-e2e.md) 가 예고한 **부분 dump + MERGE cross-instance migration e2e** (UC-07 §6.2) 가 애초에 성립하지 않는다.

배선 자체는 한 줄 — `collectFullExportRecords()` 결과를 `selectExportRecords(scope, records)` 에 통과시키고 `selected` 만 `buildFullExportDump` 로 넘긴다. `entityCounts` / `recordCount` 는 builder 가 입력 records 를 1 회 순회해 산출하므로 **자동으로 선별 후 기준** 이 되고, `excluded` 는 다운로드 artifact 에 담기지 않는다 (버린다 — 선별의 정의). REQ-032 (raw 미저장) 는 상류 projection-only read 가 이미 강제하므로 본 slice 로 약화되지 않고, 오히려 내려가는 데이터가 **줄어들기만** 한다.

**estimate 근거** — production 은 `selectExportRecords` import 1 줄 + 호출 1 줄 + `selected` 전달 1 줄 + 머리 주석 amend (기존 "선별 0" 문단 교체) ~25 LOC, controller 는 stale 주석 2 줄 amend (comment-only, 런타임 0). 나머지는 spec — full / range / partial 3 분기 + 선별 후 count + 에러 전파 + negative (~170 LOC). R-112 backbone × 1.5, base ~145 → **~220 LOC / 3 파일** (cap 300 안, `sizeExempt` 불요).

## Required Reading

- [src/export/export-job.service.ts](../../src/export/export-job.service.ts) 의 `materializeFullExportDownload` (422~468 행 — 머리 주석 포함) + import 블록 92~98 행 (`selectExportRecords` / `ExportScope as ExportScopePayload` 는 **이미 import 돼 있다** — 새 import 불요 여부 확인). **본 task 의 주 변경 대상**.
- [src/export/export-job.service.spec.ts](../../src/export/export-job.service.spec.ts) 의 `describe("materializeFullExportDownload")` 블록 (2551~2754 행) — `buildMaterializeService()` mock 빌더와 기존 `FULL_SCOPE` 단언 계약. **덧붙이기 우선**, 기존 test 는 (아래 Acceptance 의 주석 amend 외에) 수정하지 않는다.
- [src/export/export-scope-select.ts](../../src/export/export-scope-select.ts) 의 `selectExportRecords<TRecord>` (127~215 행) — 3 분기 규칙 (full 전부 / range `[start, end)` 반열림 / partial `entitySelector` 멤버십 / range+entitySelector AND) 과 throw 계약 (`RangeError` scope·dateRange 부재·partial selector 부재, `TypeError` 비배열·invalid instant + index). **0 수정**.
- [src/export/export-full-dump.ts](../../src/export/export-full-dump.ts) 의 `buildFullExportDump` (71~131 행) — `entityCounts` 5 entity 0 초기화 후 입력 1 회 순회 집계 + `recordCount = copied.length`. **선별 후 records 를 넘기면 count 가 자동으로 선별 기준이 된다는 근거**. **0 수정**.
- [src/export/export.controller.ts](../../src/export/export.controller.ts) 의 `buildScopePayload` (282~298 행) + `coerceDateRange` (268~280 행) — job row 의 Prisma enum/Json 을 lowercase `ExportScopePayload` 로 합성하며 `dateRange.start/end` ISO string 을 **`Date` 로 coerce** 한다 (본 배선이 `assertValidRange` 를 통과하는 근거). 282·286~287 행 주석의 "record 선별과 결합되지 않는다" 문구가 **본 slice 로 stale** 이 된다 — comment-only amend 대상.
- [docs/use-cases/UC-07-export-import.md](../use-cases/UC-07-export-import.md) §6.1 (Export 3 차원 옵션) — 본 배선이 충족시키는 계약.

## Acceptance Criteria

- [ ] **변경 파일 3 개 이하** — `src/export/export-job.service.ts` + colocated spec `src/export/export-job.service.spec.ts` + (comment-only) `src/export/export.controller.ts`. 다른 `src/**` · `test/**` · `web/**` · `prisma/**` · `package.json` **0 수정**.
- [ ] **배선 본체** — `materializeFullExportDownload` 가 `collectFullExportRecords()` 결과를 `selectExportRecords(scope, records)` 에 통과시키고, 그 `selected` 를 `buildFullExportDump(selected, { scope, generatedAt: new Date() })` 에 넘긴다. **캐스팅 0** (T-1290 제네릭 덕분에 `FullExportRecord[]` 가 그대로 흐른다 — `as` / `unknown` 경유 추가 금지). `excluded` 는 artifact 에 담지 않는다. 반환 타입 `Promise<Readable>` · 인자 시그니처 `(scope: ExportScopePayload)` 불변.
- [ ] **happy — PARTIAL 선별 1+** — 5 entity 모두 row 가 있는 mock 상태에서 `scope: "partial", entitySelector: ["Group"]` 로 호출하면, 소비한 JSON envelope 의 `records` 가 **Group 만** 담고 `entityCounts.Group === Group row 수`, 나머지 4 entity `=== 0`, `recordCount === Group row 수` 다. `records[0].fields` 가 보존된다 (fields 손실 0).
- [ ] **분기 cover — full / range / partial 각 1+** —
      (a) `scope: "full"` → 기존 동작과 **동일** (5 entity 전부, 기존 test 무회귀).
      (b) `scope: "range"` + `dateRange` → `[start, end)` **반열림** 경계대로 선별 (start 시각 record 포함, end 시각 record 배타 — 경계값 각 1 건씩 mock 에 심어 단언).
      (c) `scope: "partial"` → `entitySelector` 멤버십.
      추가로 `range` + `entitySelector` 동시 지정 시 **AND** 결과 1+ (두 조건 모두 만족한 record 만).
- [ ] **선별 후 메타 일관성 1+** — 어느 분기든 `recordCount === records.length` 이고 `sum(entityCounts) === recordCount` 이며, envelope 의 `scope` 는 입력 scope 를 그대로 박제한다 (metadata 박제 회귀 없음). 즉 metadata 와 body 가 **같은 선별 기준** 을 본다.
- [ ] **error path 1+** — delegate `findMany` reject (의존성 실패) 가 선별 도달 전 **swallow 0 으로 raw propagate** 되는 기존 계약이 유지된다. 추가로 `selectExportRecords` 의 throw 가 **변환 없이 raw propagate** 됨을 단언한다 (service 는 raw-forward, 변환은 controller 책임 — 기존 주석 정책 유지): `scope: "partial"` + `entitySelector` 부재 → `RangeError`.
- [ ] **negative cases 충분 cover** — 예외 상황마다 1+: (a) `scope: "range"` + `dateRange` 누락 → `RangeError` propagate, (b) `scope: "range"` + `start >= end` (역전/빈 구간) → `RangeError` propagate, (c) 허용 외 `scope` 값 → `RangeError` propagate, (d) row 의 `instant` 가 비-Date/Invalid Date → `TypeError` propagate (선별 단계에서 잡히든 상류에서 잡히든 **호출자에게 TypeError 가 도달** 하는 것으로 단언), (e) **선별 결과가 빈 배열** (아무 record 도 매칭 안 되는 `partial` selector) → error 가 아니라 `recordCount 0` / `entityCounts` 전부 0 / `records []` 인 정상 envelope 가 직렬화된다, (f) `LlmConfig` 를 포함해 선별해도 envelope `records[].fields` 에 `apiKey` 가 **부재** (secret deny 회귀 — 선별 배선이 상류 projection 을 우회하지 않음).
- [ ] **머리 주석 amend (service)** — `materializeFullExportDownload` 머리 주석의 "scope 선별 필터링(selectExportRecords)을 추가하지 않는다 … 별도 task" 문단을 **본 slice 의 사실로 교체** 한다: 선별을 적용한다는 것, `selected` 만 envelope 에 담고 `excluded` 는 버린다는 것, `entityCounts`/`recordCount` 가 선별 후 기준이라는 것, 캐스팅 0 근거 (T-1290 제네릭) 를 **한국어** (§12) 로 4~7 줄. 기존 (1)(2)(3) 배선 설명과 예외 전파 문단은 유지하되 선별 단계를 반영해 갱신한다.
- [ ] **stale 주석 amend (controller, comment-only)** — `export.controller.ts` 282~298 행 `buildScopePayload` 주석의 "job 의 scope 는 … record 선별과 결합되지 않는다(§Out of Scope — materializeFullExportDownload 는 5 entity 전체 read)" 문구를 현재 사실 (T-1291 이후 scope 가 실 선별에 쓰인다) 로 고친다. **코드 라인 0 수정** — 주석만.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `prettier --check` 통과, `scripts/check-spec-presence.sh` 통과.
- [ ] **diff 규율** — 총 diff ≤ 300 LOC / 3 파일. 초과가 예상되면 negative (f) → (c) 순으로 덜어내고 그 사실을 PR body + 본 task Follow-ups 에 박제한다.

## Out of Scope

- **`readonly TRecord[]` 전환 0** — T-1290 round 1 MINOR A (defer 합의): `export-scope-select.ts:53-54` 의 `selected` / `excluded` 지역 배열이 가변 `TRecord[]` 라 `ExportSelection<FullExportRecord>` → `ExportSelection` 대입 시 TS 배열 공변 unsoundness 가 열려 있다. 현 소비처가 read-only 라 실 피해 0 이며, `readonly` 전환은 소비처 (`export-dump-size-estimate.ts` · `export-selection-summary.ts` · `previewSelection`) 동반 수정이 필요해 파일 수가 늘어난다 — 본 slice 에서 건드리지 않는다 (Follow-ups 로 이월).
- **`previewSelection` 경로 변경 0** — 이미 `selectExportRecords` 를 쓰고 있고 본 slice 와 무관하다. `collectExportRecords` (instant-only projection) 도 불변.
- **`selectExportRecords` throw 의 HTTP status 매핑 0** — service 는 raw-forward 유지 (RangeError → 현재 500). 사용자 대면 status 재매핑은 별도 판단 (Follow-ups).
- **e2e / smoke 추가 0** — 본 slice 는 unit 배선 사실까지. 부분 dump 실 왕복 (다운로드 → import MERGE) e2e 는 다음 slice.
- **`export-scope-validate.ts` · `export-selection-summary.ts` · `export-dump-size-estimate.ts` · `export-full-dump.ts` 수정 0**, 새 helper · 새 파일 · 새 타입 신설 0.
- **import 측 0**, **새 ADR · Prisma schema/migration · 새 외부 dependency · `web/` UI 수정 0**.
- **`deploy/daily-test.sh` leg 추가 0** — leg 를 늘리면 drift-guard smoke spec 3 종 (T-0791 / T-0944 / T-0947) 동반 수정이 강제돼 파일 수 cap 을 넘긴다 (MEMORY: daily-test leg drift-guard parity, Q-0054 / T-1122 BLOCKED 선례).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (T-1290 round 1 MINOR A 이월) `ExportSelection` 의 `selected` / `excluded` 를 `readonly TRecord[]` 로 좁혀 배열 공변 unsoundness 를 닫는 slice — 소비처 (`export-dump-size-estimate.ts` · `export-selection-summary.ts` · `export-job.service.previewSelection` · 본 task 의 materialize 경로) 동반 수정 필요. 현 실 피해 0 (소비처 전부 read-only) 이라 우선순위 낮음.
- (다음 slice, 본 chain) **부분 dump + MERGE cross-instance migration e2e** (UC-07 §6.2) — 본 slice 로 scope 반영이 성립하므로, `PARTIAL(entitySelector=[...])` 로 다운로드한 dump 를 다른 인스턴스에 MERGE import 해 **선별된 entity 만** 이동하고 기존 데이터가 보존되는지를 실 DB 로 닫는다.
- (본 slice 조사 중 확인) `selectExportRecords` 의 `RangeError` (예: RANGE job 인데 `dateRange` 가 null 인 손상 row) 가 download 경로에서 **500** 으로 나간다 — create 시 `validateExportScope` 가 막으므로 정상 경로에서는 발생 불가하나, 사용자 대면 status (409/422) 로 매핑할지 판단 필요.
- (유지, 3c-3d3) 크기 상한 413 e2e — 50 MiB 초과 업로드. **선행 확인 의무**: supertest 가 multer mid-stream abort 를 어떻게 표면화하는지 (ECONNRESET / EPIPE) 국소 확인 후, flaky 하면 기존 `multer-exception.filter.spec.ts` 의 실 파이프라인 경계 (10 bytes 상한) 로 만족시키고 e2e 는 포기하는 선택지를 planner 에 보고한다.
- (미해결 정책, T-1287 → T-1290 이월) `LlmProviderConfig` 왕복 불가 — export full-record select 가 `apiKey` 를 제외 (ADR-0047 secret deny) 하는데 schema 의 `apiKey` 는 not-null 이라, 실 운영 dump 에 그 entity 가 1 건이라도 있으면 REPLACE / MERGE 어느 mode 든 복원 `$transaction` 이 통째로 실패할 것으로 예상된다. **복원 정책 (해당 entity skip / 재입력 요구 / 부분 실패 안내) 은 secret 처리 결정이라 CLAUDE.md §5 상 사람 결정 대상** — driver 가 `humanQuestion` 으로 escalate 하는 것이 적절하다.
- (관측, 이월) UC-07 §8 (b)(e) 가 요구하는 **Export / Import Audit log row 영속화 0** — 순수 helper `buildExportImportAuditEntry` (T-0443) 는 있으나 실 insert 경로가 없고, Prisma 에 범용 `AuditLog` model 자체가 없다. 도입은 schema migration 이라 §5 사람 결정 대상.
