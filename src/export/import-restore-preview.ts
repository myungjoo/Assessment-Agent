// import-restore-preview — UC-07 Import restore 영향 범위 요약 순수 helper (T-0441, P7 R-57 /
// REQ-030 / REQ-032). T-0437 의 selectExportRecords(scope 선별) → T-0438 의 buildExportDump
// (dump envelope 조립) → T-0439 의 checkSchemaVersionCompat(Import 입구 version gate) →
// T-0440 의 validateImportDumpStructure(구조 무결성 gate) 다음의 자연 building block 이다.
// 구조 검증을 통과한 dump 가 **transaction 시작 전에** 사용자에게 보여줄 **영향 범위 요약**
// (restore 시 entity 별 복원 row 수 · 전체 row 수 · instant 시간 범위)을 산출하는 순수 helper
// 로, buildExportDump 가 만든 ExportDump envelope 의 metadata/records 에서 **순수 derivation**
// 만 한다(UC-07 §5 step 7 "강한 confirmation — destructive 명시 + 영향 범위", §8 (e) Audit
// metadata "복원된 row count").
//
// persistence / repository / DB query · file parse · JSON.parse · transaction · REST 배선
// 호출 0 이며, schema version 호환 판정(T-0439)도 구조 무결성 전체 검증(T-0440)도 본 helper 0
// 이다 — 본 helper 는 그 두 gate 의 통과를 전제로 하되, transaction 전 안전을 위해 최소 입력
// 방어(비-object dump / records 비-배열 / instant 비-Date·Invalid Date)만 명시적 TypeError 로
// 막는다. 코드 골격은 export-dump.ts / export-scope-select.ts 의 순수-helper 패턴(plain 요약
// interface + non-mutating + assertValidDate 한국어 메시지 convention)을 mirror 하고, 타입은
// 새로 신설하지 않고 export-scope-select.ts 의 ExportEntity / ExportRecord 와 export-dump.ts
// 의 ExportDump 를 재사용한다. REQ-032(raw 미저장)는 본 helper 가 envelope 의 count / instant
// metadata 만 다루고 raw 를 새로 fetch 하지 않으므로 layer 에서 자연 유지된다.
import { ExportDump } from "./export-dump";
import { ExportEntity, ExportRecord } from "./export-scope-select";

// restore 영향 범위 요약 verdict — plain object. totalRecords(전체 복원 row 수) + perEntity
// (5 entity 전부 key 인 number map, records 실측 집계) + instantRange(records 의 instant 시간
// 범위, 빈 records 면 null). 후속 confirmation dialog(UC-07 §5 step 7) 가 이 요약을 그대로
// 사용자에게 안내한다(destructive 경고 + 영향 범위).
export interface ImportImpact {
  totalRecords: number;
  perEntity: Record<ExportEntity, number>;
  instantRange: { earliest: Date; latest: Date } | null;
}

// plain object(null/배열/비-object 아님) 판정 — top-level dump 입력 방어에 쓴다.
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Invalid Date / 비-Date 입력은 명시적 error (export-scope-select.assertValidDate 와 동형
// message convention — 해당 helper 가 export 되지 않아 본 파일에 mirror 한다).
function assertValidDate(value: unknown, label: string): asserts value is Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError(
      `summarizeImportImpact: ${label} 은(는) 유효한 Date instance 여야 합니다`,
    );
  }
}

// summarizeImportImpact — 구조 검증을 통과한 ExportDump envelope 를 받아 restore 영향 범위
// 요약(ImportImpact)을 순수 derivation 으로 산출한다. UC-07 §5 step 7 / §8 (e) 정합:
//   - totalRecords = dump.records.length(records 실측). 빈 dump 시 0.
//   - perEntity = 5 entity 전부 key 인 number map — records 1 회 순회로 entity 별
//     집계(0 초기화 후 +1). entityCounts metadata 와 별개로 records 가 ground truth.
//   - instantRange = records 의 instant 중 earliest / latest(Date 쌍). 빈 records → null.
//
// 입력 dump / records / instant Date 객체를 변형하지 않으며(non-mutating — freeze 된 dump/
// records 로 호출해도 통과), 반환 perEntity map 과 instantRange 는 새 객체다(원본 Date 참조는
// 복제하지 않고 그대로 담아도 무방). transaction 전 안전을 위한 최소 입력 방어:
//   - dump 가 plain object 아님(null/배열/비-object) → TypeError.
//   - dump.records 가 배열 아님 → TypeError.
//   - records 원소의 instant 가 유효 Date 아님(비-Date / Invalid Date) → 그 index 를 메시지에
//     담은 TypeError.
// happy-path 는 구조 검증 통과 dump 를 전제하므로 위 방어 분기는 negative test 로 cover 한다.
export function summarizeImportImpact(dump: ExportDump): ImportImpact {
  // top-level dump 가 plain object 가 아니면 하위 field 에 접근할 수 없어 즉시 throw.
  if (!isPlainObject(dump)) {
    throw new TypeError(
      `summarizeImportImpact: dump 는 plain object 여야 합니다 (받음: ${
        dump === null ? "null" : Array.isArray(dump) ? "array" : typeof dump
      })`,
    );
  }

  const records: unknown = (dump as { records?: unknown }).records;
  if (!Array.isArray(records)) {
    throw new TypeError(
      `summarizeImportImpact: dump.records 는 배열이어야 합니다 (받음: ${typeof records})`,
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

  let earliest: Date | null = null;
  let latest: Date | null = null;

  // records 1 회 순회 — instant 검증(비-Date/Invalid Date 시 그 index TypeError) + entity 별
  // 집계 + earliest/latest 갱신. entity 가 5 허용 외 값이어도(구조 검증 전제 위반) perEntity 에
  // key 가 없으므로 집계에서 자연 무시(본 helper 는 entity 허용 검증은 T-0440 책임으로 위임).
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index] as ExportRecord;
    assertValidDate(record?.instant, `records[${index}].instant`);
    const entity = record.entity;
    if (
      Object.prototype.hasOwnProperty.call(perEntity, entity) &&
      typeof entity === "string"
    ) {
      perEntity[entity] += 1;
    }
    const instant = record.instant;
    if (earliest === null || instant.getTime() < earliest.getTime()) {
      earliest = instant;
    }
    if (latest === null || instant.getTime() > latest.getTime()) {
      latest = instant;
    }
  }

  // 빈 records → instantRange null. 비어있지 않으면 earliest/latest 가 모두 set 됨(단일 record
  // 면 earliest === latest 경계).
  const instantRange =
    earliest !== null && latest !== null ? { earliest, latest } : null;

  return {
    totalRecords: records.length,
    perEntity,
    instantRange,
  };
}
