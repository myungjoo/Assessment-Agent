// import-restore-plan-summary — UC-07 Import 복원 plan 영향 breakdown 요약 순수 helper (T-0448,
// P7 R-57 / REQ-030 / REQ-032). T-0437 의 selectExportRecords → T-0438 의 buildExportDump →
// T-0439 의 checkSchemaVersionCompat → T-0440 의 validateImportDumpStructure → T-0441 의
// summarizeImportImpact → T-0442 의 buildImportRestorePlan 다음의 자연 building block 이다.
// buildImportRestorePlan(T-0442)이 산출한 {toDelete, toInsert, toKeep} plan 은 세 배열을 통째로
// 들고 있을 뿐, UC-07 §5 step 7 의 강한 confirmation dialog(destructive 명시 + 영향 범위)와
// §8 (e) Audit row 가 필요로 하는 삭제/삽입/보존 row 의 entity-별 + 전체 breakdown 을 derive
// 하지 않는다 — buildExportImportAuditEntry(T-0443)도 plan.toInsert.length 단일 rowCount 만 쓰고
// delete/keep 분포는 노출하지 않는다. 본 helper 는 그 gap 을 순수 derivation 으로 박제한다 —
// ImportRestorePlan 을 받아 {deleted, inserted, kept} 각각의 total + perEntity(5 entity)
// breakdown 을 산출하는 순수 함수다.
//
// persistence / repository / transaction / DB delete-insert / REST 배선 호출 0 이며, 새 도메인
// 타입 신설 0(import-restore-plan.ts 의 ImportRestorePlan + export-scope-select.ts 의
// ExportEntity 재사용), 새 외부 dependency 0 이다. plan 산출 로직 재구현도 0 — 본 helper 는
// plan 을 입력으로만 받는다. 코드 골격은 import-restore-preview.ts 의 순수-helper 패턴(plain
// 요약 interface + perEntity 5 entity 0-init + non-mutating + assertValidDate 한국어 메시지
// convention + 빈 입력 정상)을 mirror 한다. REQ-032(raw 미저장)는 본 helper 가 입력 plan 의
// record 만 집계하고 raw 를 새로 fetch 하지 않으므로 helper layer 에서 자연 유지된다.
import { ExportEntity, ExportRecord } from "./export-scope-select";
import { ImportRestorePlan } from "./import-restore-plan";

// 한 그룹(deleted/inserted/kept)의 breakdown — total(그룹 전체 row 수) + perEntity(5 entity
// 전부 key 인 number map, records 실측 집계). 5 허용 외 entity 는 perEntity 에 key 가 없어
// 자연 무시(entity 허용 검증은 T-0440 책임으로 위임).
export interface RestorePlanGroupBreakdown {
  total: number;
  perEntity: Record<ExportEntity, number>;
}

// 복원 plan 영향 breakdown 요약 verdict — plain object. plan 의 세 배열(toDelete/toInsert/
// toKeep)을 각각 deleted/inserted/kept 그룹 breakdown 으로 집계한다. 후속 confirmation
// dialog(UC-07 §5 step 7)와 Audit row(§8 (e))가 이 요약을 그대로 사용한다.
export interface RestorePlanSummary {
  deleted: RestorePlanGroupBreakdown;
  inserted: RestorePlanGroupBreakdown;
  kept: RestorePlanGroupBreakdown;
}

// plain object(null/배열/비-object 아님) 판정 — top-level plan 입력 방어에 쓴다.
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Invalid Date / 비-Date 입력은 명시적 error (import-restore-preview.assertValidDate 와 동형
// message convention — 해당 helper 가 export 되지 않아 본 파일에 mirror 한다).
function assertValidDate(value: unknown, label: string): asserts value is Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError(
      `summarizeRestorePlan: ${label} 은(는) 유효한 Date instance 여야 합니다`,
    );
  }
}

// 한 plan 배열을 그룹 breakdown 으로 집계 — 비-배열 시 TypeError(label 명시), 원소 instant 가
// 비-Date/Invalid Date 면 그 index 를 메시지에 담아 TypeError. 5 entity 전부 0-init map 에
// records 1 회 순회로 +1 집계하며, 5 허용 외 entity 는 key 가 없어 자연 무시. 입력 배열·원소를
// 변형하지 않고 새 map 을 반환한다(non-mutating).
function summarizeGroup(
  records: unknown,
  label: string,
): RestorePlanGroupBreakdown {
  if (!Array.isArray(records)) {
    throw new TypeError(
      `summarizeRestorePlan: plan.${label} 는 배열이어야 합니다 (받음: ${typeof records})`,
    );
  }

  // perEntity 5 entity 전부 0 초기화 — records 에 없는 entity 도 key 로 존재(누락 0).
  const perEntity = {
    Assessment: 0,
    Person: 0,
    Group: 0,
    LlmConfig: 0,
    AuditLog: 0,
  } as Record<ExportEntity, number>;

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index] as ExportRecord;
    assertValidDate(record?.instant, `${label}[${index}].instant`);
    const entity = record.entity;
    // 5 허용 entity 만 집계 — 허용 외 값(구조 검증 전제 위반)은 perEntity 에 key 가 없으므로
    // 자연 무시(누락 0, T-0440 검증 책임 위임).
    if (
      Object.prototype.hasOwnProperty.call(perEntity, entity) &&
      typeof entity === "string"
    ) {
      perEntity[entity] += 1;
    }
  }

  return { total: records.length, perEntity };
}

// summarizeRestorePlan — buildImportRestorePlan(T-0442)이 산출한 ImportRestorePlan 을 받아
// {deleted, inserted, kept} 각 그룹의 total + perEntity(5 entity) breakdown 을 순수 derivation
// 으로 산출한다. UC-07 §6.2 정합:
//   - replace plan(toKeep 빈 배열) → kept.total=0 + perEntity 전부 0.
//   - merge plan → kept breakdown 이 보존 record 분포를 반영.
//   - perEntity 는 plan 의 record 1 회 순회 entity-별 집계(records 가 ground truth).
//
// 입력 plan / 세 배열 / record instant Date 객체를 변형하지 않으며(non-mutating — freeze 된
// plan/배열로 호출해도 통과), 반환 map 은 새 객체다. transaction 전 안전을 위한 최소 입력 방어:
//   - plan 이 plain object 아님(null/배열/비-object) → TypeError.
//   - plan.toDelete / toInsert / toKeep 중 하나가 배열 아님 → TypeError(어느 배열인지 명시).
//   - record 원소의 instant 가 유효 Date 아님(비-Date / Invalid Date) → 그 index 를 메시지에
//     담은 TypeError.
// happy-path 는 buildImportRestorePlan 통과 plan 을 전제하므로 위 방어 분기는 negative test 로
// cover 한다.
export function summarizeRestorePlan(
  plan: ImportRestorePlan,
): RestorePlanSummary {
  // top-level plan 이 plain object 가 아니면 하위 배열에 접근할 수 없어 즉시 throw.
  if (!isPlainObject(plan)) {
    throw new TypeError(
      `summarizeRestorePlan: plan 은 plain object 여야 합니다 (받음: ${
        plan === null ? "null" : Array.isArray(plan) ? "array" : typeof plan
      })`,
    );
  }

  const source = plan as {
    toDelete?: unknown;
    toInsert?: unknown;
    toKeep?: unknown;
  };

  return {
    deleted: summarizeGroup(source.toDelete, "toDelete"),
    inserted: summarizeGroup(source.toInsert, "toInsert"),
    kept: summarizeGroup(source.toKeep, "toKeep"),
  };
}
