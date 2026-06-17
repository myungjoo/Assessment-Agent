// import-merge-conflict — UC-07 Import merge-mode 충돌 검출·보고 순수 helper (T-0451, P7 R-57 /
// REQ-030 / REQ-032). T-0437 selectExportRecords → T-0438 buildExportDump → T-0439
// checkSchemaVersionCompat → T-0440 validateImportDumpStructure → T-0441 summarizeImportImpact →
// T-0442 buildImportRestorePlan → T-0443 buildExportImportAuditEntry → T-0444 validateExportScope
// → T-0445 상수 DRY → T-0446 computeDumpChecksum/verifyDumpChecksum → T-0448 summarizeRestorePlan
// → T-0449 summarizeExportSelection → T-0450 validateImportDumpSize 의 다음 게이트-free 단추다.
// UC-07 §6.2 가 명시한 merge mode 의 "conflict 시 file 우선 또는 reject" 정책 중 reject 경로 +
// §5 step 7 강한 confirmation dialog(영향 범위 표시)는 기존 13 helper 중 0 회 cover —
// buildImportRestorePlan(T-0442)은 merge 충돌을 **항상 file 우선으로 해결**해 {toDelete, toInsert,
// toKeep} plan 만 산출할 뿐, 어떤 record 가 / 몇 건이 충돌했는지를 별도로 보고하지 않는다.
// 본 helper 는 그 gap 을 순수 derivation 으로 박제한다 — 기존 ExportRecord[] + import dump 의
// ExportRecord[] 를 받아 (entity, instant millis) 충돌 key(T-0442 conflictKey 와 동형) 기준으로
// 충돌 record 쌍을 검출해 plain verdict 를 반환하는 순수 함수다. plan 산출(T-0442)과 분리된
// 보고/판정 layer 로, 호출자(controller / confirmation dialog / reject 정책)가 충돌 유무·범위를
// 보고 file 우선 진행 vs reject 를 결정한다.
//
// persistence / repository / transaction / REST 호출 0, 새 도메인 타입 신설 0(ExportRecord /
// ExportEntity 재사용), 새 외부 dependency 0. 코드 골격은 summarizeRestorePlan(T-0448)의 entity-별
// 0-init breakdown 패턴 + validateImportDumpSize(T-0450)의 verdict shape(다중 누적 + 비-throw +
// non-mutating)을 mirror 하고, 충돌 key 는 import-restore-plan.ts(T-0442)의 conflictKey convention
// 을 공유한다. REQ-032(raw 미저장)는 입력 record 의 entity/instant 분류 key 만 다루고 raw 를
// 새로 fetch 하지 않으므로 helper layer 에서 자연 유지된다.
import { ExportEntity, ExportRecord } from "./export-scope-select";

// 검출된 충돌 1 건 — 같은 (entity, instant millis) key 가 existing 과 incoming 양쪽에 모두 존재.
// existingCount / incomingCount 는 그 key 가 각 쪽에서 갖는 중복 record 수(같은 key 가 한쪽에
// 여러 건일 수 있음). instant 는 그 충돌 key 를 대표하는 Date(incoming 쪽 첫 record 의 instant 를
// 그대로 참조 — 입력 변형 0). WebUI / confirmation dialog 가 그대로 안내에 쓴다.
export interface ImportMergeConflict {
  entity: ExportEntity;
  instant: Date;
  existingCount: number;
  incomingCount: number;
}

// merge 충돌 검출·보고 verdict — plain object. hasConflict 는 conflicts 가 비어있지 않을 때만
// true, conflicts 는 검출된 모든 충돌 key 의 누적 목록(즉시 throw 0 — validateImportDumpSize 패턴),
// perEntity 는 충돌 key 의 entity-별 5 entity 0-init 집계, total 은 충돌 key 수(= conflicts.length).
// 후속 호출자가 hasConflict 로 file 우선 진행 vs reject 를 판정한다(UC-07 §6.2).
export interface ImportMergeConflictReport {
  hasConflict: boolean;
  conflicts: ImportMergeConflict[];
  perEntity: Record<ExportEntity, number>;
  total: number;
}

// plain object(null/배열/비-object 아님) 판정 — record 원소 입력 방어에 쓴다.
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Invalid Date / 비-Date 입력은 명시적 error (import-restore-plan.assertValidDate 와 동형 message
// convention — 해당 helper 가 export 되지 않아 본 파일에 mirror 한다).
function assertValidDate(value: unknown, label: string): asserts value is Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError(
      `detectImportMergeConflicts: ${label} 은(는) 유효한 Date instance 여야 합니다`,
    );
  }
}

// records 배열 입력 방어 + 원소 검증 — 비-배열 시 TypeError(label 명시), 원소가 비-object 면
// 그 index 를 메시지에 담은 TypeError, 원소 instant 가 비-Date/Invalid Date 면 그 index 를 메시지에
// 담은 TypeError(import-restore-plan.assertValidRecords convention mirror). 검증만 하고 변형 0.
function assertValidRecords(
  records: unknown,
  label: string,
): asserts records is ReadonlyArray<ExportRecord> {
  if (!Array.isArray(records)) {
    throw new TypeError(
      `detectImportMergeConflicts: ${label} 는 배열이어야 합니다 (받음: ${typeof records})`,
    );
  }
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!isPlainObject(record)) {
      throw new TypeError(
        `detectImportMergeConflicts: ${label}[${index}] 는 object 여야 합니다 (받음: ${
          record === null
            ? "null"
            : Array.isArray(record)
              ? "array"
              : typeof record
        })`,
      );
    }
    assertValidDate(
      (record as { instant?: unknown }).instant,
      `${label}[${index}].instant`,
    );
  }
}

// 충돌 판정 key — entity + instant millis 조합(import-restore-plan.ts conflictKey 와 동형).
// PK 기반 dedupe / timestamp 비교 같은 복잡한 conflict resolution 은 P5 service layer 책임이라
// 본 helper 0 — UC-07 §6.2 의 단순 key 만 쓴다.
function conflictKey(record: ExportRecord): string {
  return `${record.entity} ${record.instant.getTime()}`;
}

// detectImportMergeConflicts — 기존 record 배열 + import dump 의 incoming record 배열을 받아
// merge mode 충돌(같은 (entity, instant millis) key 가 양쪽에 모두 존재)을 검출·보고한다.
// UC-07 §6.2 정합:
//   - existing 의 key→count map 을 먼저 만든 뒤, incoming 을 순회하며 같은 key 의 incoming 쪽
//     count 를 집계한다(같은 key 가 incoming 에 여러 건이면 incomingCount 누적).
//   - existing 에도 존재하는 key 만 충돌로 박제하되, 충돌 key 의 첫 등장 순서(incoming 입력 순서)를
//     보존해 결정적 출력을 보장한다(같은 key 의 2 번째 이후 등장은 incomingCount 만 +1).
//   - 각 충돌 key 마다 conflict 항목 1 개 — existingCount = existing 쪽 중복 수, incomingCount =
//     incoming 쪽 중복 수. 즉시 throw 0(validateImportDumpSize/T-0450 패턴 mirror).
//   - total = conflicts.length(충돌 key 수), perEntity 는 5 entity 0-init map 에 충돌 key 의
//     entity-별 +1 집계(summarizeRestorePlan/T-0448 mirror). 충돌 0 → hasConflict=false,
//     conflicts 빈 배열, total=0, perEntity 전부 0.
//
// non-mutating(freeze 된 existing/incoming 으로 호출해도 통과, 입력 배열·원소 변형 0) 이며 반환
// conflicts/perEntity 는 새 객체, instant 는 incoming 입력 Date 참조(입력 변형 0). 빈 입력은
// 정상(error 아님). 입력 방어:
//   - existing / incoming 이 배열 아님(null/undefined/object/string) → TypeError(label 명시).
//   - record 원소가 비-object → TypeError(해당 배열·index 메시지 박제).
//   - record 원소 instant 가 비-Date/Invalid Date → TypeError(해당 배열·index 메시지 박제).
//   - entity 가 5 허용 외 값인 record 는 perEntity 에 key 가 없어 자연 무시(T-0440 검증 책임
//     위임) — 단 충돌 key 매칭 자체는 entity 문자열 동등성으로 동작한다.
export function detectImportMergeConflicts(
  existing: ReadonlyArray<ExportRecord>,
  incoming: ReadonlyArray<ExportRecord>,
): ImportMergeConflictReport {
  // 두 배열 + 원소 검증 — 충돌 집계 전에 입력 무결성을 먼저 확정한다.
  assertValidRecords(existing, "existing");
  assertValidRecords(incoming, "incoming");

  // existing 의 key→중복 수 map — incoming 충돌 판정 + existingCount 산출의 ground truth.
  const existingCounts = new Map<string, number>();
  for (let index = 0; index < existing.length; index += 1) {
    const key = conflictKey(existing[index]);
    existingCounts.set(key, (existingCounts.get(key) ?? 0) + 1);
  }

  // 충돌 key → 누적 conflict 항목 map(incomingCount 누적용) + 입력 순서 보존 배열.
  const conflictByKey = new Map<string, ImportMergeConflict>();
  const conflicts: ImportMergeConflict[] = [];

  for (let index = 0; index < incoming.length; index += 1) {
    const record = incoming[index];
    const key = conflictKey(record);
    const existingCount = existingCounts.get(key);
    // existing 에 없는 key 는 충돌 아님(merge 시 신규 삽입) — skip.
    if (existingCount === undefined) {
      continue;
    }
    const found = conflictByKey.get(key);
    if (found) {
      // 같은 key 의 incoming 2 번째 이후 등장 — incomingCount 만 +1(새 항목 추가 0, 순서 유지).
      found.incomingCount += 1;
    } else {
      // 충돌 key 의 첫 등장 — incoming 입력 순서로 박제. instant 는 incoming 첫 record 참조.
      const conflict: ImportMergeConflict = {
        entity: record.entity,
        instant: record.instant,
        existingCount,
        incomingCount: 1,
      };
      conflictByKey.set(key, conflict);
      conflicts.push(conflict);
    }
  }

  // perEntity 5 entity 전부 0 초기화 — 충돌 key 의 entity 별 +1 집계(누락 0).
  const perEntity = {
    Assessment: 0,
    Person: 0,
    Group: 0,
    LlmConfig: 0,
    AuditLog: 0,
  } as Record<ExportEntity, number>;
  for (let index = 0; index < conflicts.length; index += 1) {
    const entity = conflicts[index].entity;
    // 5 허용 entity 만 집계 — 허용 외 값(구조 검증 전제 위반)은 key 가 없어 자연 무시.
    if (
      typeof entity === "string" &&
      Object.prototype.hasOwnProperty.call(perEntity, entity)
    ) {
      perEntity[entity] += 1;
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
    perEntity,
    total: conflicts.length,
  };
}
