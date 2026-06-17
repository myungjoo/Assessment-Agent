---
id: T-0450
title: UC-07 Import dump 크기 한계 검증 순수 helper validateImportDumpSize
phase: P7
status: DONE
completedAt: 2026-06-17T01:38:52Z
mergedAs: 0798942
prNumber: 361
reviewRounds: 1
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 180
estimatedFiles: 2
created: 2026-06-17
independentStream: export-import
dependsOn: []
touchesFiles:
  - src/export/import-dump-size-validate.ts
  - src/export/import-dump-size-validate.spec.ts
hqOrigin: null
plannerNote: "P7 R-57/REQ-030 — UC-07 Export/Import 열세 번째 게이트-free 단추(Import dump 크기 한계 검증 §7.3 file size cap gate), pr, dependsOn []"
---

# T-0450 — UC-07 Import dump 크기 한계 검증 순수 helper validateImportDumpSize

## Why

PLAN.md P7 "Import / export / restore (R-57)" bullet 의 게이트-free building block stream
(selectExportRecords → buildExportDump → checkSchemaVersionCompat → validateImportDumpStructure →
summarizeImportImpact → buildImportRestorePlan → buildExportImportAuditEntry → validateExportScope →
상수 DRY → computeDumpChecksum/verifyDumpChecksum → summarizeRestorePlan → summarizeExportSelection)
12개 완비 후 다음 게이트-free 단추다. **UC-07 §7.3 (payload 검증 실패) 가 명시한 "Import 의 file 크기
한계 초과 → 400 + 검증 메시지" gate 가 12개 helper 중 0회 cover** — `validateImportDumpStructure`
(T-0440)는 dump 의 구조(필드 shape · `entityCounts` cross-check)만 검사, `computeDumpChecksum`/
`verifyDumpChecksum`(T-0446)은 byte-level 무결성만 검사, 어느 helper 도 **size cap (전체 record 수
한계 · 그룹별 record 수 한계 · entity-별 record 수 한계)** 을 검사하지 않는다. 본 task 는 그 gap 을
순수 derivation 으로 박제한다 — `ExportDump`(T-0438 envelope)를 받아 옵션 `maxTotalRecords` /
`maxPerEntity`(5 entity 별 cap map) 으로 size cap 위반을 검사해 `{valid, errors[{kind, message,
limit?, actual?, entity?}], totals}` plain verdict 를 반환하는 순수 함수다.

`validateExportScope`(T-0444)의 verdict 패턴(다중 누적 + 비-throw + `{field, message}`)을 mirror 하되
size cap 에 맞춰 `kind`(`"total-overflow"`/`"per-entity-overflow"`) 와 `limit`/`actual`/`entity` 필드를
박제한다. UC-07 §7.3 (transaction 시작 전 reject — DB 변경 0) 의 Import side 사전 게이트 — 12 building
block 중 size cap 검사를 자연 채운다. persistence/repository/transaction/REST 호출 0, 새 도메인 타입
신설 0(`ExportDump`/`ExportEntity` 재사용), 새 외부 dependency 0. REQ-032(raw 미저장)는 입력 dump 의
count metadata 만 다루고 raw 를 새로 fetch 하지 않으므로 helper layer 에서 자연 유지된다. 실 controller
size cap 강제(req.headers["content-length"] 검사 · multipart cap), schema 게이트 size 정책 영속(설정 row)
은 게이트된 후속 §Out of Scope.

## Required Reading

- `docs/use-cases/UC-07-export-import.md` — §7.3 (payload 검증 실패 — "file 크기 한계 초과") + §1
  invariant (b) (Import atomic transaction — 부분 복원 상태 없음, 본 helper 는 transaction 시작 전
  reject) + §8 (b) (Audit row count). 본 helper 가 cover 하는 conceptual source.
- `src/export/export-dump.ts` — `ExportDump`(T-0438 envelope) interface(`schemaVersion`/`generatedAt`/
  `scope`/`entityCounts`/`recordCount`/`records`) + `EXPORT_SCHEMA_VERSION` + `ALL_ENTITIES`(5 entity 목록)
  + `assertValidDate` mirror convention. 본 helper 의 입력 타입 — 재사용한다.
- `src/export/export-scope-select.ts` — `ExportEntity`(5 entity union) 재사용 + `VALID_EXPORT_ENTITIES`
  상수(T-0445 DRY). 본 helper 의 `maxPerEntity` cap map 검증에 5 entity 열거 source.
- `src/export/export-scope-validate.ts` — `validateExportScope`(T-0444) 의 verdict 패턴(다중 누적 +
  비-throw + `{valid, errors[{field, message}], normalized?}` 형태). 본 helper 의 verdict shape mirror
  대상 (`field` 대신 `kind`/`limit`/`actual`/`entity` 박제).
- `src/export/import-dump-validate.ts` — `validateImportDumpStructure`(T-0440) 의 구조 검증 verdict
  패턴(`{valid, errors[]}` 누적 + 비-throw + transaction 전 reject 의 Import 입구 mirror). 본 helper
  도 같은 단계(transaction 시작 전 reject)의 size cap gate.
- `src/export/export-scope-validate.spec.ts` (colocated spec 위치 참고) — 신규 spec 은
  `src/export/import-dump-size-validate.spec.ts` (colocated) 에 둔다.

## Acceptance Criteria

- [ ] `src/export/import-dump-size-validate.ts` 신설 — `validateImportDumpSize(dump: ExportDump,
      options?: ImportDumpSizeLimits): ImportDumpSizeVerdict` 함수 + 반환 `ImportDumpSizeVerdict` plain
      interface export. `ImportDumpSizeLimits = {maxTotalRecords?: number, maxPerEntity?: Partial<Record<
      ExportEntity, number>>}` 옵션 + 반환 `{valid: boolean, errors: ImportDumpSizeError[], totals:
      {total: number, perEntity: Record<ExportEntity, number>}}` 형태. `ImportDumpSizeError =
      {kind: "total-overflow" | "per-entity-overflow", message: string, limit: number, actual: number,
      entity?: ExportEntity}` shape. `export-dump.ts` 의 `ExportDump`/`export-scope-select.ts` 의
      `ExportEntity` 재사용(새 도메인 타입/새 dependency 0).
- [ ] UC-07 §7.3 정합: cap 위반 시 즉시 throw 대신 다중 누적(`validateExportScope`/T-0444 패턴 mirror) —
      `maxTotalRecords` 초과 + 여러 entity 의 `maxPerEntity` 초과가 동시 발생해도 한 verdict 에 모두 박제.
      옵션 부재(`options` 자체 또는 두 필드 모두 부재) 시 cap 검사 skip(valid=true, errors=빈 배열, totals
      만 산출). 빈 dump(records 0)도 정상 통과(valid=true).
- [ ] `totals` 산출 — `total = dump.recordCount` 와 `dump.records.length` 중 records 가 ground truth(T-0441
      `summarizeImportImpact` mirror), `perEntity` 는 records 1 회 순회로 5 entity 0-init map 에 +1 집계.
      cap 비교는 `totals` 기준(envelope `entityCounts` metadata 와 별개로 ground truth).
- [ ] non-mutating — freeze 된 dump/options 로 호출해도 통과, 입력 배열·원소·options 변형 0, 반환
      `errors`/`totals` 는 새 객체.
- [ ] 입력 방어 — dump 가 plain object 아님(null/배열/비-object) → TypeError(label "dump"), dump.records
      비-배열 → TypeError(label "dump.records"), record 원소 entity 가 비-string 이면 perEntity 누락 0
      (5 허용 외 entity 는 key 없어 자연 무시, T-0440 검증 책임 위임), `maxTotalRecords`/`maxPerEntity[k]`
      가 비-정수·음수·NaN → TypeError(어느 옵션 / 어느 entity 인지 메시지 박제).
- [ ] happy-path unit test 1+ — (a) 옵션 부재 → cap skip, valid=true, totals 만 산출, (b) 작은 dump +
      넉넉한 cap → valid=true, errors 빈 배열, (c) totals 정확(빈 records / 5 entity 섞인 records / 단일
      entity 만 있는 records).
- [ ] error path unit test 1+ — (a) `maxTotalRecords` 초과 → errors[].kind="total-overflow" + limit/actual
      박제, (b) 단일 entity 의 `maxPerEntity` 초과 → errors[].kind="per-entity-overflow" + entity/limit/actual
      박제, (c) `maxTotalRecords` + 두 entity 의 `maxPerEntity` 동시 초과 → errors 3 누적(전부 박제, throw
      0 — 다중 누적 패턴 mirror).
- [ ] flow / branch test — 옵션 부재(2 종: options 부재 / 두 필드 모두 부재) / 단독 `maxTotalRecords` /
      단독 `maxPerEntity` / 둘 다 있음 / 5 entity 각각 cap 초과 분기, cap 정확히 일치(actual === limit →
      통과, actual === limit + 1 → 초과) 경계, 빈 records + cap 0 경계 각 분기 1+ test.
- [ ] negative cases 충분 cover — null/undefined dump, dump.records 비-배열(string/number/object),
      record 원소 entity 가 5 허용 외 값(자연 무시 동작), `maxTotalRecords` 가 0/음수/NaN/`Infinity`/
      string/null, `maxPerEntity` 가 비-object/배열/null, `maxPerEntity[k]` 가 비-정수/음수/NaN/string,
      알 수 없는 entity key 가 `maxPerEntity` 에 들어옴(무시 vs TypeError 정책 명시), 단일 record dump
      경계, 5 entity 전부 cap 초과 동시 발생 — 예외 처리 분기마다 각 1+ test (단일 negative 만 작성 금지).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 파일은 line/branch/func 100% cov 목표
      (선례 T-0441/T-0444/T-0448/T-0449 동형 100% 유지).
- [ ] `pnpm lint && pnpm build && pnpm test` green (tester 가 실행 결과 확인 — R-110).

## Out of Scope

- 실 transaction / repository / DB query / Prisma 호출 — 게이트된 후속 sub-slice (schema/repository 게이트).
- REST controller(GET /api/admin/export · POST /api/admin/restore) 의 multipart `Content-Length` 헤더
  기반 사전 cap 강제 — repository/controller 게이트.
- 압축 archive 의 압축 전/후 size 검증(§7.4) — 본 helper 는 메모리에 올라온 ExportDump 의 record count
  cap 만, byte-level archive size 는 별도 helper 또는 controller 책임.
- size cap 정책 영속(설정 row · ENV 기반 동적 cap) — schema 게이트.
- `validateImportDumpStructure`(T-0440) 의 구조 검증 재구현 — 본 helper 는 size cap 만, 구조는 그 helper
  통과 전제.
- 새 도메인 타입 신설(`ExportDump`/`ExportEntity` 재사용만) · 새 외부 dependency.
- Audit log row insert / 영속 — `buildExportImportAuditEntry`(T-0443) + 게이트된 후속 책임.
- WebUI form field-level error 표시 — WebModule 후속 영역.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시 비어있음)
