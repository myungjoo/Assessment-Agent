---
id: T-1280
title: full-record DB-read 를 공용 helper 로 추출 (실행 slice 3c-2a)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 320
estimatedFiles: 3
created: 2026-07-28
independentStream: import-restore-engine
dependsOn: [T-1279]
touchesFiles:
  - src/export/export-full-record-collect.ts
  - src/export/export-full-record-collect.spec.ts
  - src/export/export-job.service.ts
sizeExempt: true
exemptReason: "R-112 backbone 추출 slice — production 은 helper ~95 LOC + service delegate 교체 ~15 LOC 로 cap 안이고 초과분은 전량 spec (5 entity × allow-list projection + negative 다수). 동일 chain 선례 T-1263 (같은 성격의 service-private → 공용 module 추출) 이 estimatedDiff 380 / 4 파일로 pre-justified 머지됐다."
plannerNote: "cap-bend pre-justified: R-112 backbone x1.5 = 320 LOC, T-1263 선례 — 3c-2 orchestrator 의 기존 record 로딩 prerequisite"
---

# T-1280 — full-record DB-read 를 공용 helper 로 추출 (실행 slice 3c-2a)

## Why

[ADR-0055](../decisions/ADR-0055-import-multipart-file-upload.md) §Follow-up (b) 복원 엔진 chain 은 3c-1 ([T-1279](T-1279-import-module-restore-provider.md), PR #1170) 로 `ImportRestoreTransactionService` 를 DI container 에 올렸다. 남은 3c-2 는 **buffer → plan → `restore()` orchestrator** 인데, 그 orchestrator 는 `prepareImportRestorePlan(buffer, existing, mode)` 의 두 번째 인자인 **기존 record 배열 (`FullExportRecord[]`)** 을 어디선가 읽어와야 한다. 그 읽기 로직은 이미 [`export-job.service.ts`](../../src/export/export-job.service.ts) 523~551 행에 `collectFullExportRecords` 로 존재하지만 **service-private** 라 import 경로가 없다.

본 slice 는 그 한 겹만 연다 — 읽기 로직을 **client 인자를 받는 공용 helper** 로 추출해, 다음 slice 의 orchestrator 가 `PrismaService` 를 그대로 넘겨 호출하면 되게 만든다. 이 방향은 같은 chain 의 [T-1263](T-1263-entity-sources-extract.md) 선례와 동형이다 (그때도 "service-private 로 두면 세 번째 사본이 생긴다" 가 추출 근거였다). helper 가 client 를 **인자로** 받으므로 `ImportModule` 이 `ExportModule` 을 import 하거나 `ExportJobService` 를 inject 하는 **cross-module DI 결합은 0** 이며 ([`import-restore-run-steps.ts`](../../src/import/import-restore-run-steps.ts) 의 `ImportRestoreTxClient` 규약 mirror), 사본도 생기지 않는다 (`ExportJobService` 는 같은 commit 에서 helper 로 위임하도록 바꾼다).

**estimate 근거** — production 은 helper 신설 ~95 LOC (본문은 기존 코드 이동 + 헤더 주석) + service delegate 교체 ~15 LOC, 나머지는 전량 spec (~210: 5 entity × allow-list projection 단언 + error 전파 3 종 + negative 다수). 본 chain 실측 비율 (production : spec ≈ 1 : 2.1) 대로 총 **~320 LOC / 3 파일** — cap (300) 을 소폭 넘어 `sizeExempt` 를 pre-justify 한다 (선례 T-1263 est 380 / 4 파일).

## Required Reading

- [src/export/export-job.service.ts](../../src/export/export-job.service.ts) 507~551 행 — **추출 대상 원본** (`private async collectFullExportRecords()`). 5 entity `Promise.all` + delegate cast + allow-list select projection + `buildFullExportRecord` 조립 + `flat()` 이 그대로 helper 본문이 된다 (로직 변경 0).
- 같은 파일 452~470 행 (`materializeFullExportDownload` — 현재 **유일한 호출처**) + 62~90 행 import 블록 (`getExportEntityFullRecordSelect` / `EXPORT_ENTITY_SOURCES` / `buildFullExportRecord` 의 import 위치 — 추출 후 미사용이 되는 것만 제거해야 한다. `EXPORT_ENTITY_SOURCES` 는 479 행 `collectExportRecords` 가 계속 쓰므로 **남긴다**).
- [src/import/import-restore-run-steps.ts](../../src/import/import-restore-run-steps.ts) 27~36 행 — 본 helper 의 client 타입이 mirror 할 규약 (`ImportRestoreDelegateClient` + `Readonly<Record<ExportEntityDelegate, ...>>`). 실 Prisma client 캐스팅은 **호출자 몫** 이라는 경계도 같이 따른다.
- [src/export/export-entity-sources.ts](../../src/export/export-entity-sources.ts) 19~75 행 — `ExportEntityDelegate` union + `EXPORT_ENTITY_SOURCES` 매핑표 (delegate / model / instantColumn 3 축).
- [src/export/export-entity-full-record-select.ts](../../src/export/export-entity-full-record-select.ts) 전체 — `getExportEntityFullRecordSelect(entity)` 의 allow-list select 계약 (secret `apiKey` 부재 — projection 단계 1 차 그물).
- [src/export/export-full-record.ts](../../src/export/export-full-record.ts) 27~90 행 — `FullExportRecord` 타입 + `buildFullExportRecord` 의 throw 계약 (비-Date instant → `TypeError`, allow-list 외 key → `RangeError`). 이 throw 들은 helper 가 **삼키지 않고 그대로 전파** 한다.
- [src/export/export-job.service.spec.ts](../../src/export/export-job.service.spec.ts) 2551~2754 행 (`materializeFullExportDownload` describe) — 본 추출의 **회귀 그물**. 이 spec 은 **수정 대상이 아니며** 무수정으로 green 이어야 한다 (mock client shape · 호출 인자 단언이 그대로 통과하는지가 "동작 변경 0" 의 증거).

## Acceptance Criteria

- [ ] 파일 **3 개만** 변경한다: [src/export/export-full-record-collect.ts](../../src/export/export-full-record-collect.ts) (신규) · [src/export/export-full-record-collect.spec.ts](../../src/export/export-full-record-collect.spec.ts) (신규) · [src/export/export-job.service.ts](../../src/export/export-job.service.ts) (수정). `export-job.service.spec.ts` / `export.module.ts` / `import.module.ts` / `src/import/**` **0 수정**.
- [ ] **helper 계약** — `export-full-record-collect.ts` 가 (a) 좁은 read client 타입 (`ExportFullRecordReadClient` = `Readonly<Record<ExportEntityDelegate, { findMany(args: { select: Record<string, true> }): Promise<Array<Record<string, unknown>>> }>>`, `ImportRestoreTxClient` 규약 mirror) 과 (b) `collectFullExportRecords(client): Promise<FullExportRecord[]>` 를 export 한다. 본문은 원본 코드 이동 — 5 entity `Promise.all` · entity 별 allow-list select · `buildFullExportRecord` 조립 · `flat()` 이며 **새 로직 0** (필터 · 정렬 · 재시도 · 로깅 · 캐시 0). 실 Prisma 타입 캐스팅은 helper 안이 아니라 **호출자** 몫이다.
- [ ] **service delegate 교체** — `ExportJobService` 의 `private async collectFullExportRecords()` 는 **이름 · 시그니처 · 호출처를 유지** 한 채 본문만 `return collectFullExportRecords(this.prisma as unknown as ExportFullRecordReadClient);` 한 줄로 바꾼다 (사본 0). 추출로 미사용이 된 import (`getExportEntityFullRecordSelect` · `buildFullExportRecord` — 파일 안 다른 사용처가 없는 것만) 를 제거하고, `EXPORT_ENTITY_SOURCES` 는 `collectExportRecords` 가 계속 쓰므로 **남긴다**. `materializeFullExportDownload` · `collectExportRecords` · `previewSelection` · `mark*` · `find*` 동작 변경 0.
- [ ] **회귀 무손상** — [src/export/export-job.service.spec.ts](../../src/export/export-job.service.spec.ts) 2551~2754 행 `materializeFullExportDownload` describe 가 **한 줄도 수정하지 않고** green. 수정이 필요하다고 판단되면 그 자체가 "동작 변경 0" 위반이므로 멈추고 Follow-ups 에 근거를 적는다.
- [ ] **happy-path unit test 1+** — mock client 의 5 delegate 가 row 를 돌려줄 때 `collectFullExportRecords` 가 `entity` / `instant` / `fields` 가 채워진 `FullExportRecord[]` 를 **entity 별 평탄화 순서** 대로 반환하고 총 건수가 입력 row 합과 같음을 단언.
- [ ] **error path unit test 1+** — (a) 한 delegate 의 `findMany` 가 reject 하면 그 error 가 **인스턴스 동일성 유지로 전파** (`rejects.toBe`) 되고 삼켜지지 않음, (b) row 의 instant 컬럼이 비-Date / 누락이면 `buildFullExportRecord` 의 `TypeError` 가 그대로 전파, (c) row 에 allow-list 외 key (예: `apiKey`) 가 섞이면 `RangeError` 가 그대로 전파.
- [ ] **분기 cover** — 분기마다 1+: (a) 전 entity 빈 배열 (빈 DB) → 빈 배열 반환 · throw 0, (b) 일부 entity 만 row 존재 → 존재 분만 평탄 반환, (c) 전 entity row 존재 → 5 entity 전부 포함.
- [ ] **negative cases 충분 cover** — 예외 상황마다 1+: (a) **REQ-032** — 각 `findMany` 호출 인자의 `select` 가 해당 entity 의 allow-list 와 **정확히 일치** 하고 `apiKey` key 가 어디에도 없음, (b) `findMany` 를 **무인자 / `select` 생략** 으로 부른 호출이 0 (전체 row read 금지), (c) delegate 호출 횟수가 entity 당 정확히 1 회 · 총 5 회, (d) client 에 delegate 가 누락된 경우 조용히 빈 배열을 돌려주지 않고 error 가 전파됨, (e) 입력 client 를 변형하지 않으며 (mock 객체 key 추가 · 함수 교체 0) 같은 client 로 두 번 호출하면 **매번 새 배열 인스턴스** (`not.toBe`) 반환.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 신규 helper 파일은 branch 포함 **100%** 를 목표로 한다.
- [ ] `scripts/check-spec-presence.sh` 통과, `prettier --check` 통과. 신규 spec 은 실 DB 0 (mock client 만 — Prisma client 인스턴스 · `$transaction` 호출 0).
- [ ] **diff 규율** — **총 diff ≤ 340 LOC / 3 파일**. 초과가 예상되면 negative (e) → (d) 순으로 덜어내고 그 사실을 PR body + 본 task Follow-ups 에 박제한다. 그래도 초과면 planner 에게 split 을 요청한다.

## Out of Scope

- **orchestrator 신설** (`prepareImportRestorePlan` + 기존 record 로딩 + `ImportRestoreTransactionService.restore()` 합성) — 실행 slice **3c-2b**. 본 task 는 그 재료 한 개 (record 로딩 경로) 만 연다.
- **`import.controller.ts` / `import-job.service.ts` 재배선 · T-1254 interim `markFailed` guard 교체 · `markRunning` → 복원 → `markSucceeded` 전이 · import UI false-success 해소** — 실행 slice **3c-3** 이후.
- `ImportModule` / `ExportModule` 의 `imports` · `providers` · `exports` 변경 0 — 본 helper 는 DI provider 가 아니라 **인자를 받는 함수** 라 module 배선이 필요 없다 (cross-module DI 결합 도입 금지).
- `collectExportRecords` (instant 1-컬럼 projection) 의 동형 추출 · 두 read 의 통합 — 별도 위생 slice. 본 task 는 full-record read 한 개만 옮긴다.
- allow-list select 상수 (`EXPORT_ENTITY_FULL_RECORD_SELECT` · `getExportEntityFullRecordSelect`) · `buildFullExportRecord` · `EXPORT_ENTITY_SOURCES` 의 내용 수정 — 세 helper 는 이미 닫혔다. 결함이 보이면 고치지 말고 Follow-ups 에 적는다.
- scope 기반 record 선별 결합 · pagination · streaming chunk read · 성능 최적화 (배치 · 커서) — 별도 slice.
- e2e / HTTP 경계 test 수정 · Prisma schema · migration · 새 외부 dependency (0 건) · 로깅 · 관측 metric.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (예고) 실행 slice **3c-2b** — buffer → plan → 복원 orchestrator 신설 (`collectFullExportRecords` 로 기존 record 로딩 → `prepareImportRestorePlan` verdict 처리 (실패 stage → 4xx) → `ImportRestoreTransactionService.restore()` 호출 → 건수 합계 반환).
- (예고) 실행 slice **3c-3** — `import.controller.ts` / `import-job.service.ts` 재배선 (T-1254 interim guard → 실 복원 pipeline, `markRunning` / `markSucceeded` / `markFailed` 전이) + HTTP 경계 e2e (409 / 400 응답 body) + import UI false-success 해소.
