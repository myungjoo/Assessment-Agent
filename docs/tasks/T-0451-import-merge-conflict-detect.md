---
id: T-0451
title: UC-07 Import merge-mode 충돌 검출·보고 순수 helper detectImportMergeConflicts
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 190
estimatedFiles: 2
created: 2026-06-17
independentStream: export-import
dependsOn: []
touchesFiles:
  - src/export/import-merge-conflict.ts
  - src/export/import-merge-conflict.spec.ts
hqOrigin: null
plannerNote: "P7 R-57/REQ-030 — UC-07 Export/Import 열네 번째 게이트-free 단추(merge-mode 충돌 검출·보고 §6.2 'file 우선 또는 reject' policy 입력), pr, dependsOn []"
---

# T-0451 — UC-07 Import merge-mode 충돌 검출·보고 순수 helper detectImportMergeConflicts

## Why

PLAN.md P7 "Import / export / restore (R-57)" bullet 의 게이트-free building block stream
(selectExportRecords → buildExportDump → checkSchemaVersionCompat → validateImportDumpStructure →
summarizeImportImpact → buildImportRestorePlan → buildExportImportAuditEntry → validateExportScope →
상수 DRY → computeDumpChecksum/verifyDumpChecksum → summarizeRestorePlan → summarizeExportSelection →
validateImportDumpSize) 13개 완비 후 다음 게이트-free 단추다.

**UC-07 §6.2 가 명시한 merge mode 의 "conflict 시 file 우선 또는 reject" 정책 중 reject 경로를
위한 충돌 *검출·보고* 가 13개 helper 중 0회 cover** 된 gap 을 메운다. `buildImportRestorePlan`
(T-0442)은 merge mode 의 충돌을 **항상 file 우선으로 해결**해 {toDelete, toInsert, toKeep} plan 을
산출할 뿐, 어떤 record 가 충돌했는지 / 충돌이 몇 건인지를 별도로 *보고하지 않는다* — §6.2 의 또 다른
선택지인 "reject" 정책(충돌 발견 시 import 거부)과 §5 step7 강한 confirmation dialog(영향 범위 표시 —
"기존 N row 가 file 의 row 로 덮어써짐")가 필요로 하는 충돌 집합 자체를 노출하는 helper 가 없다.

본 task 는 그 gap 을 순수 derivation 으로 박제한다 — 메모리에 올라온 기존 `ExportRecord[]` +
import dump 의 `ExportRecord[]` 를 받아 `(entity, instant millis)` 충돌 key(T-0442 `conflictKey` 와
동형) 기준으로 충돌 record 쌍을 검출해 `{hasConflict, conflicts[{entity, instant, existingCount,
incomingCount}], perEntity, total}` 형태의 plain verdict 를 반환하는 순수 함수
`detectImportMergeConflicts(existing, incoming)` 다. 이는 plan 산출(T-0442)과 분리된 *보고/판정* layer
로, 호출자(controller / confirmation dialog / reject 정책)가 충돌 유무·범위를 보고 file 우선 진행 vs
reject 를 결정하도록 한다.

`summarizeRestorePlan`(T-0448) 의 entity-별 0-init breakdown 패턴 + `validateImportDumpSize`(T-0450)
의 verdict shape 패턴(다중 누적 + 비-throw)을 mirror 한다. persistence/repository/transaction/REST
호출 0, 새 도메인 타입 신설 0(`ExportRecord`/`ExportEntity` 재사용), 새 외부 dependency 0. REQ-032
(raw 미저장)는 입력 record 의 entity/instant 분류 key 만 다루고 raw 를 새로 fetch 하지 않으므로
helper layer 에서 자연 유지된다. 실 merge transaction 의 conflict resolution 실행(file 우선 덮어쓰기
또는 reject throw), PK 기반 dedupe / timestamp 비교 같은 복잡한 resolution 알고리즘, REST controller
의 reject → 409/400 직렬화는 게이트된 후속 §Out of Scope.

## Required Reading

- `docs/use-cases/UC-07-export-import.md` — §6.2 (Import merge 옵션 — "conflict 시 file 우선 또는
  reject") + §5 step7 (강한 confirmation dialog — 영향 범위 표시) + §1 invariant (b) (Import atomic
  transaction). 본 helper 가 cover 하는 conceptual source.
- `src/export/import-restore-plan.ts` — `buildImportRestorePlan`(T-0442) 의 `conflictKey(record)` =
  `"${entity} ${instant.getTime()}"` 충돌 판정 convention + `ImportRestoreMode`/`ExportRecord` 재사용 +
  `assertValidDate`/`assertValidRecords` 한국어 메시지 convention. 본 helper 는 같은 충돌 key 를
  공유하되 plan 대신 *충돌 보고* 를 산출한다(분리된 layer).
- `src/export/export-scope-select.ts` — `ExportRecord`(`{entity: ExportEntity, instant: Date}`) +
  `ExportEntity`(5 entity union) + `VALID_EXPORT_ENTITIES` 상수(T-0445 DRY). 본 helper 의 입력 record
  타입 + perEntity 5 entity 0-init map source. 새 타입 신설 0 — 재사용한다.
- `src/export/import-restore-plan-summary.ts` — `summarizeRestorePlan`(T-0448) 의 entity-별 0-init
  breakdown(`perEntity` 5-entity 0-init + `total`) 산출 패턴. 본 helper 의 `perEntity`/`total` shape
  mirror 대상.
- `src/export/import-dump-size-validate.ts` (colocated spec 위치 참고) + `src/export/import-restore-plan.spec.ts`
  — verdict shape spec 패턴 참고. 신규 spec 은 `src/export/import-merge-conflict.spec.ts` (colocated) 에 둔다.

## Acceptance Criteria

- [ ] `src/export/import-merge-conflict.ts` 신설 — `detectImportMergeConflicts(existing:
      ReadonlyArray<ExportRecord>, incoming: ReadonlyArray<ExportRecord>): ImportMergeConflictReport`
      함수 + 반환 `ImportMergeConflictReport` plain interface export. 반환 형태 `{hasConflict: boolean,
      conflicts: ImportMergeConflict[], perEntity: Record<ExportEntity, number>, total: number}`,
      `ImportMergeConflict = {entity: ExportEntity, instant: Date, existingCount: number,
      incomingCount: number}` shape. `import-restore-plan.ts` 의 충돌 key convention(`(entity, instant
      millis)`) 재사용 + `export-scope-select.ts` 의 `ExportRecord`/`ExportEntity` 재사용(새 도메인
      타입/새 dependency 0).
- [ ] UC-07 §6.2 정합: 충돌 = 같은 `(entity, instant millis)` key 가 existing 과 incoming 양쪽에 모두
      존재. 각 충돌 key 마다 conflict 항목 1개 누적(즉시 throw 0 — `validateImportDumpSize`/T-0450 패턴
      mirror), `existingCount`/`incomingCount` 는 그 key 의 existing/incoming 쪽 중복 record 수(같은 key
      가 한쪽에 여러 건일 수 있음). 충돌 0건이면 `hasConflict=false`, `conflicts=빈 배열`, `total=0`.
- [ ] `perEntity`/`total` 산출 — `total = conflicts.length`(충돌 key 수), `perEntity` 는 5 entity
      0-init map 에 충돌 key 의 entity 별 +1 집계(T-0448 `summarizeRestorePlan` mirror). 충돌 key 의
      순서는 incoming 입력 순서 보존(결정적).
- [ ] non-mutating — freeze 된 existing/incoming 으로 호출해도 통과, 입력 배열·원소 변형 0, 반환
      `conflicts`/`perEntity` 는 새 객체, `instant` 는 입력 Date 참조 또는 새 Date(어느 쪽이든 입력
      변형 0).
- [ ] 입력 방어 — existing/incoming 이 비-배열(null/undefined/object/string) → TypeError(label
      "existing"/"incoming"), record 원소 instant 가 비-Date/Invalid Date → TypeError(해당 배열·index
      메시지 박제, `import-restore-plan.ts` `assertValidRecords` convention mirror), record 원소가
      비-object → TypeError. entity 가 5 허용 외 값인 record 는 perEntity 누락 0(key 없어 자연 무시,
      T-0440 검증 책임 위임) — 단 충돌 key 매칭 자체는 entity 문자열 동등성으로 동작.
- [ ] happy-path unit test 1+ — (a) 충돌 0(existing/incoming key 완전 disjoint) → hasConflict=false,
      conflicts 빈 배열, total=0, (b) 단일 충돌(한 key 가 양쪽에 1건씩) → conflicts 1 + perEntity 정확
      + existingCount/incomingCount=1, (c) 빈 existing + 빈 incoming → 충돌 0 정상.
- [ ] error path unit test 1+ — (a) 다중 충돌(2+ key 가 양쪽에 존재) → conflicts 다중 누적(throw 0,
      입력 순서 보존), (b) 같은 key 가 incoming 에 여러 건 → incomingCount > 1 정확, (c) 같은 key 가
      existing 에 여러 건 → existingCount > 1 정확.
- [ ] flow / branch test — 충돌 0 / 충돌 1 / 충돌 다중 / 빈 existing(incoming 만) / 빈 incoming
      (existing 만) / 양쪽 빈 / 같은 instant 다른 entity(충돌 아님 — entity 까지 일치해야 충돌) / 같은
      entity 다른 instant(충돌 아님) / 5 entity 각각 충돌 분기 각 1+ test.
- [ ] negative cases 충분 cover — existing/incoming 이 null/undefined/비-배열(object/string/number),
      record 원소가 비-object/null, record instant 가 비-Date/Invalid Date/숫자, entity 가 5 허용 외
      값(자연 무시 동작 — perEntity 미반영이되 conflict key 매칭은 동작), 대량 record(같은 key 중복
      다수), 같은 instant millis 의 boundary(밀리초 단위 동등성), 충돌과 비충돌이 섞인 입력 —
      예외 처리 분기마다 각 1+ test (단일 negative 만 작성 금지).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 파일은 line/branch/func 100% cov 목표
      (선례 T-0442/T-0448/T-0450 동형 100% 유지).
- [ ] `pnpm lint && pnpm build && pnpm test` green (tester 가 실행 결과 확인 — R-110).

## Out of Scope

- 실 merge transaction 의 conflict resolution 실행(file 우선 덮어쓰기 / reject throw / DB delete-insert)
  — 게이트된 후속 sub-slice (schema/repository 게이트).
- `buildImportRestorePlan`(T-0442) 의 plan 산출 재구현 — 본 helper 는 충돌 *검출·보고* 만, plan 산출은
  그 helper 책임. 두 layer 는 분리 유지.
- PK 기반 dedupe / timestamp 비교 / 복잡한 conflict resolution 알고리즘 — P5 service layer 책임
  (UC-07 §6.2 명시 Out of Scope).
- REST controller 의 reject → 409/400 직렬화 + confirmation dialog UI 렌더 — repository/controller +
  WebModule 게이트.
- `validateImportDumpStructure`(T-0440) 의 구조 검증 / `checkSchemaVersionCompat`(T-0439) version gate
  재구현 — 본 helper 는 충돌 검출만, 그 검증들 통과 전제.
- 새 도메인 타입 신설(`ExportRecord`/`ExportEntity` 재사용만) · 새 외부 dependency.
- Audit log row insert / 영속 — `buildExportImportAuditEntry`(T-0443) + 게이트된 후속 책임.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시 비어있음)
