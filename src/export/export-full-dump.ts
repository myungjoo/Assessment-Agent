// export-full-dump — UC-07 Export full-record dump envelope 조립 순수 helper (T-0517, P7
// R-57 / REQ-030 / REQ-032, ADR-0047 §Decision1·§Decision3(i)·§Follow-ups[2]). 기존
// buildExportDump([export-dump.ts])는 입력을 ExportRecord(`{entity, instant}`)로만 받아
// full-record 본문(`fields`)을 envelope 에 담지 못한다. 본 helper 는 T-0516 의
// collectFullExportRecords 가 산출하는 FullExportRecord(`{entity, instant, fields}`) 배열을
// 받아 `fields` 를 손실 없이 보존한 dump envelope(FullExportDump)를 조립한다 —
// schema version 헤더 + metadata(entity 별 count + generatedAt + scope 요약) + full-record
// payload(`fields` 포함). persistence/repository/DB query · 실 streaming · 압축 · REST 배선
// 호출 0 이며(Prisma runtime import 0 — ADR-0047 §Decision3(iii)), 후속 service-layer
// materialization(impure) 이 본 envelope 를 소비한다.
//
// 코드 골격은 buildExportDump 의 순수-helper 패턴(assertValidDate · 입력 비변형 · 입력 순서
// 보존 · 빈 입력 정상 · 한국어 error)을 mirror 한다. records 의 원소 타입만 ExportRecord →
// FullExportRecord 로 좁히고, envelope 의 records 도 FullExportRecord[] 로 좁힌다.
//
// 🔥 핵심 invariant(ADR-0047 §Decision3(i) descriptor single-source 정신): 본 builder 는
// `fields` 를 그대로 보존만 하고 컬럼 필터링·secret strip·재검증을 하지 않는다. secret deny
// 는 상류 query projection-only(T-0514) + buildFullExportRecord(T-0515 조립 2 차 그물)가 이미
// 강제하므로, 본 builder 는 그 contract 산출물을 신뢰하고 envelope 로 감싸기만 한다(재필터 0).
import { EXPORT_SCHEMA_VERSION, ExportDumpMeta } from "./export-dump";
import { FullExportRecord } from "./export-full-record";
import { ExportEntity, ExportScope } from "./export-scope-select";

// envelope metadata 의 entityCounts 가 항상 key 로 가져야 하는 5 entity (UC-07 §6.1
// entitySelector 목록). records 에 없는 entity 도 0 으로 초기화해 누락 key 가 없도록 한다.
const VALID_ENTITY_SET: ReadonlySet<string> = new Set<ExportEntity>([
  "Assessment",
  "Person",
  "Group",
  "LlmConfig",
  "AuditLog",
]);

// 조립된 full-record dump envelope — 기존 ExportDump 의 records 를 FullExportRecord[] 로 좁힌
// 직렬화 가능한 plain object. schema version 헤더 + 생성 시각(ISO string) + scope 요약 +
// entity 별 count(5 entity 전부 key) + 전체 record 수 + full-record payload(`fields` 포함).
// records 는 입력 순서를 보존한 새 배열(non-mutating).
export interface FullExportDump {
  schemaVersion: string;
  generatedAt: string;
  scope: ExportScope;
  entityCounts: Record<ExportEntity, number>;
  recordCount: number;
  records: FullExportRecord[];
}

// 비-Date / Invalid Date 입력은 명시적 error (export-dump.assertValidDate 와 동형 message
// convention — 해당 helper 가 export 되지 않아 본 파일에 mirror 한다).
function assertValidDate(value: unknown, label: string): asserts value is Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError(
      `buildFullExportDump: ${label} 은(는) 유효한 Date instance 여야 합니다`,
    );
  }
}

// buildFullExportDump — 선별·materialize 된 FullExportRecord 배열과 meta(scope + generatedAt
// + 선택적 schemaVersion)를 받아 직렬화 가능한 full-record dump envelope 를 조립한다.
// buildExportDump 와 동형 동작 + `fields` 보존:
//   - schemaVersion 부재 시 EXPORT_SCHEMA_VERSION default 적용.
//   - generatedAt 은 toISOString() 으로 직렬화(비-Date/Invalid Date 시 TypeError).
//   - entityCounts 는 5 entity 전부 0 초기화 후 records 1 회 순회로 +1 집계(누락 key 없음).
//   - recordCount = records.length.
//   - 각 record 의 `fields` 는 손실 없이 envelope 의 records[i].fields 에 그대로 담긴다.
//
// 입력 records 배열·원소·`fields` 를 변형하지 않고 새 배열을 반환하며(non-mutating), 결과
// records 는 입력 순서를 보존한다. 빈 records 입력은 entityCounts 전부 0 + recordCount 0 +
// records [](error 아님). records 가 배열이 아니면 TypeError, meta 부재(null/undefined)면
// TypeError, 원소 instant 가 비-Date/Invalid Date 면 그 index 를 메시지에 담아 TypeError,
// entity 가 5 허용 값 외면 그 index 를 메시지에 담아 RangeError 를 throw 한다.
export function buildFullExportDump(
  records: ReadonlyArray<FullExportRecord>,
  meta: ExportDumpMeta,
): FullExportDump {
  if (!meta) {
    throw new TypeError(
      `buildFullExportDump: meta 는 scope/generatedAt 을 담은 객체여야 합니다 (받음: ${String(
        meta,
      )})`,
    );
  }

  if (!Array.isArray(records)) {
    throw new TypeError(
      `buildFullExportDump: records 는 배열이어야 합니다 (받음: ${typeof records})`,
    );
  }

  // generatedAt 검증 + ISO 직렬화 — 비-Date/Invalid Date 면 TypeError.
  assertValidDate(meta.generatedAt, "generatedAt");
  const generatedAt = meta.generatedAt.toISOString();

  // schemaVersion 부재(undefined) 시 export-dump 의 상수 default 적용.
  const schemaVersion = meta.schemaVersion ?? EXPORT_SCHEMA_VERSION;

  // entityCounts 5 entity 전부 0 초기화 — records 에 없는 entity 도 key 로 존재(누락 0).
  const entityCounts = {
    Assessment: 0,
    Person: 0,
    Group: 0,
    LlmConfig: 0,
    AuditLog: 0,
  } as Record<ExportEntity, number>;

  // records 1 회 순회 — 원소 검증(instant TypeError / entity RangeError) + entity 별 빈도
  // 집계 + 입력 순서 보존 새 배열 조립(non-mutating). `fields` 는 그대로 보존(재필터 0 —
  // 상류 contract 신뢰, ADR-0047 §Decision3(i)).
  const copied: FullExportRecord[] = [];
  for (let index = 0; index < records.length; index += 1) {
    const record: FullExportRecord = records[index];
    assertValidDate(record?.instant, `records[${index}].instant`);
    const entity: ExportEntity = record.entity;
    if (!VALID_ENTITY_SET.has(entity)) {
      throw new RangeError(
        `buildFullExportDump: records[${index}].entity 는 5 허용 entity 중 하나여야 합니다 ` +
          `(받음: ${String(entity)})`,
      );
    }
    entityCounts[entity] += 1;
    copied.push(record);
  }

  return {
    schemaVersion,
    generatedAt,
    scope: meta.scope,
    entityCounts,
    recordCount: copied.length,
    records: copied,
  };
}
