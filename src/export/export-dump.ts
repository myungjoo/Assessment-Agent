// export-dump — UC-07 Export dump envelope 조립 순수 helper (T-0438, P7 R-57 / REQ-030 /
// REQ-032). T-0437 의 selectExportRecords 가 "이미 메모리에 올라온 record 를 scope 규칙으로
// 선별" 했다면, 본 helper 는 그 선별된 record 배열(+ scope context)을 받아 직렬화 가능한
// dump envelope 로 **조립**만 한다 — schema version 헤더 + metadata(entity 별 count +
// generatedAt + scope 요약) + records payload. persistence/repository/DB query · 실 streaming ·
// file 생성 · 압축 · REST 배선 호출 0 이며, 후속 배선 task(repository 게이트 진입 시 재확인)
// 가 본 envelope 를 소비한다.
//
// 코드 골격은 recent-deletion-plan.ts 의 "조립 helper" 패턴(building block 재사용 + non-
// mutating + 빈 입력 정상 + 검증 위임/전파)과 export-scope-select.ts 의 순수-helper 패턴
// (assertValidDate · 입력 순서 보존)을 mirror 한다. 타입은 새로 신설하지 않고
// export-scope-select.ts 의 ExportRecord / ExportEntity / ExportScope 를 그대로 재사용한다
// (REQ-032: 입력 record 만 envelope 에 담고 raw 를 새로 fetch 하지 않으므로 envelope layer
// 에서도 raw 미저장이 자연 유지 — UC-07 §1 invariant (a), §8 (b)).
import { ExportEntity, ExportRecord, ExportScope } from "./export-scope-select";

// dump envelope 의 기본 schema version — meta.schemaVersion 부재 시 default 로 적용한다.
// UC-07 §6.3 의 version mismatch 처리(후속 Import 가 reject/migration 판정에 사용)의 source.
export const EXPORT_SCHEMA_VERSION = "1";

// envelope metadata 의 entityCounts 가 항상 key 로 가져야 하는 5 entity (UC-07 §6.1
// entitySelector 목록). records 에 없는 entity 도 0 으로 초기화해 누락 key 가 없도록 한다.
const ALL_ENTITIES: ReadonlyArray<ExportEntity> = [
  "Assessment",
  "Person",
  "Group",
  "LlmConfig",
  "AuditLog",
];

const VALID_ENTITY_SET: ReadonlySet<string> = new Set(ALL_ENTITIES);

// dump envelope 의 meta 입력 — scope 요약(envelope 에 그대로 박제) + 생성 시각(ISO 직렬화
// 대상) + 선택적 schema version(부재 시 EXPORT_SCHEMA_VERSION default).
export interface ExportDumpMeta {
  scope: ExportScope;
  generatedAt: Date;
  schemaVersion?: string;
}

// 조립된 dump envelope — 직렬화 가능한 plain object. schema version 헤더 + 생성 시각(ISO
// string) + scope 요약 + entity 별 count(5 entity 전부 key) + 전체 record 수 + records payload.
// records 는 입력 순서를 보존한 새 배열(non-mutating).
export interface ExportDump {
  schemaVersion: string;
  generatedAt: string;
  scope: ExportScope;
  entityCounts: Record<ExportEntity, number>;
  recordCount: number;
  records: ExportRecord[];
}

// Invalid Date / 비-Date 입력은 명시적 error (export-scope-select.assertValidDate 와 동형
// message convention — 해당 helper 가 export 되지 않아 본 파일에 mirror 한다).
function assertValidDate(value: unknown, label: string): asserts value is Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError(
      `buildExportDump: ${label} 은(는) 유효한 Date instance 여야 합니다`,
    );
  }
}

// buildExportDump — 선별된 records 와 meta(scope + generatedAt + 선택적 schemaVersion)를 받아
// 직렬화 가능한 dump envelope 를 조립한다. UC-07 §5 직렬화 Note / §6.3 schema version /
// §8 (a)(e) Audit metadata 정합:
//   - schemaVersion 부재 시 EXPORT_SCHEMA_VERSION default 적용.
//   - generatedAt 은 toISOString() 으로 직렬화(비-Date/Invalid Date 시 TypeError).
//   - entityCounts 는 5 entity 전부 0 초기화 후 records 1 회 순회로 +1 집계(누락 key 없음).
//   - recordCount = records.length.
//
// 입력 records 배열을 변형하지 않고 새 배열을 반환하며(non-mutating), 결과 records 는 입력
// 순서를 보존한다. 빈 records 입력은 entityCounts 전부 0 + recordCount 0 + records [](error
// 아님). records 가 배열이 아니면 TypeError, meta 부재(null/undefined)면 TypeError, 원소
// instant 가 비-Date/Invalid Date 면 그 index 를 메시지에 담아 TypeError, entity 가 5 허용 값
// 외면 그 index 를 메시지에 담아 RangeError 를 throw 한다.
export function buildExportDump(
  records: ReadonlyArray<ExportRecord>,
  meta: ExportDumpMeta,
): ExportDump {
  if (!meta) {
    throw new TypeError(
      `buildExportDump: meta 는 scope/generatedAt 을 담은 객체여야 합니다 (받음: ${String(
        meta,
      )})`,
    );
  }

  if (!Array.isArray(records)) {
    throw new TypeError(
      `buildExportDump: records 는 배열이어야 합니다 (받음: ${typeof records})`,
    );
  }

  // generatedAt 검증 + ISO 직렬화 — 비-Date/Invalid Date 면 TypeError.
  assertValidDate(meta.generatedAt, "generatedAt");
  const generatedAt = meta.generatedAt.toISOString();

  // schemaVersion 부재(undefined) 시 본 파일 상수 default 적용.
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
  // 집계 + 입력 순서 보존 새 배열 조립(non-mutating).
  const copied: ExportRecord[] = [];
  for (let index = 0; index < records.length; index += 1) {
    const record: ExportRecord = records[index];
    assertValidDate(record?.instant, `records[${index}].instant`);
    const entity: ExportEntity = record.entity;
    if (!VALID_ENTITY_SET.has(entity)) {
      throw new RangeError(
        `buildExportDump: records[${index}].entity 는 5 허용 entity 중 하나여야 합니다 ` +
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
