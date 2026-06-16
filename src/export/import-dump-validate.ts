// import-dump-validate — UC-07 Import dump 구조 무결성 검증 순수 helper (T-0440, P7 R-57 /
// REQ-030 / REQ-032). T-0437 의 selectExportRecords(scope 선별) → T-0438 의 buildExportDump
// (dump envelope 조립, 직렬화 방향) → T-0439 의 checkSchemaVersionCompat(Import 입구 version
// gate) 다음의 자연 building block 이다. version gate 를 통과한 업로드 dump 가 **transaction
// 시작 전에** 본 시스템 dump 포맷의 구조 무결성을 갖췄는지 판정하는 순수 helper 로,
// buildExportDump 가 만든 ExportDump envelope 의 **역방향 검증** 이다(UC-07 §5 step 7 payload
// 검증, §7.4 "Import file 손상 → transaction 시작 전 reject, DB 변경 0"). persistence /
// repository / DB query · file parse · JSON.parse · 압축 archive 해제 · 무결성 hash · transaction
// · REST 배선 호출 0 이며(이미 파싱된 plain object 의 **구조** 만 검증), schema version 호환
// 판정(accept/migrate/reject)도 본 helper 0(T-0439 책임 — 본 helper 는 schemaVersion 의
// string-shape 만 본다).
//
// 코드 골격은 schema-version-compat.ts / export-dump.ts 의 순수-helper 패턴(plain verdict
// interface + non-mutating + 입력 검증 + 한국어 위반 메시지)을 mirror 한다. 단 본 helper 는
// early-throw 가 아니라 **여러 위반을 issues 배열에 모두 누적** 한다 — transaction 전에 한 번에
// 안내하기 위함(UC-07 §7.4). 검증 규칙의 source-of-truth 는 export-dump.ts(EXPORT 5 entity ·
// recordCount === records.length · entityCounts 5 key)와 export-scope-select.ts(ExportEntity ·
// ExportRecord shape)이며, 새 상수/타입은 신설하지 않고 그쪽을 재사용한다. REQ-032(raw 미저장)
// 는 본 helper 가 envelope 구조만 검증하고 raw 를 새로 fetch 하지 않으므로 자연 유지된다.
import { ExportEntity } from "./export-scope-select";

// 검증이 기대하는 5 entity (UC-07 §6.1 entitySelector 목록 — export-dump.ts ALL_ENTITIES 와
// 동일 집합). entityCounts 가 전부 key 로 가져야 하고, records 원소의 entity 도 이 중 하나여야
// 한다. export-dump.ts 의 ALL_ENTITIES 는 export 되지 않아 본 파일에 같은 값을 mirror 한다.
const ALL_ENTITIES: ReadonlyArray<ExportEntity> = [
  "Assessment",
  "Person",
  "Group",
  "LlmConfig",
  "AuditLog",
];

const VALID_ENTITY_SET: ReadonlySet<string> = new Set(ALL_ENTITIES);

// 구조 무결성 검증 verdict — plain object. valid 시 issues 는 빈 배열, invalid 시 issues 에
// 한국어 위반 메시지를 모두 누적(여러 위반 동시 박제 — early-throw 아님). 후속 Import 배선이
// invalid 면 transaction 을 시작하지 않고 issues 를 그대로 사용자에게 안내한다(UC-07 §7.4).
export interface ImportDumpValidation {
  valid: boolean;
  issues: string[];
}

// plain object(null/배열/비-object 아님) 판정 — top-level dump 와 entityCounts 검증에 쓴다.
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// validateImportDumpStructure — 이미 파싱된 plain object dump 가 본 시스템 dump envelope
// (buildExportDump 의 ExportDump)의 구조 무결성을 갖췄는지 검증한다. UC-07 §7.4 정합:
//   - top-level 가 plain object 아님(null/배열/비-object) → invalid + 명시 issue(이후 검증 중단,
//     하위 field 접근 불가).
//   - schemaVersion 이 비어있지 않은 string 아님 → issue(string-shape 만, 호환 판정 0).
//   - generatedAt 이 ISO 파싱 가능한 string 아님(빈/비-string/Invalid Date) → issue.
//   - records 가 배열 아님 → issue. 배열이면 각 원소가 { entity, instant } shape 이고 entity 가
//     5 허용 값(ALL_ENTITIES)인지 검증, 위반 원소는 그 index 를 담은 issue.
//   - entityCounts 가 5 entity 전부 key 를 가진 number map 아님 → issue.
//   - 상호 정합: recordCount !== records.length → issue, entityCounts 합계 !== recordCount → issue.
//
// 입력 인자를 변형하지 않으며(non-mutating — freeze 된 dump/records 로 호출해도 통과),
// 여러 위반은 issues 배열에 모두 누적한다(early-throw 아님, transaction 전 한 번에 안내).
// 위반 0 이면 { valid: true, issues: [] } 를 반환한다.
export function validateImportDumpStructure(
  dump: unknown,
): ImportDumpValidation {
  const issues: string[] = [];

  // top-level 가 plain object 가 아니면 하위 field 에 접근할 수 없어 즉시 단일 issue 로 종료.
  if (!isPlainObject(dump)) {
    issues.push(
      `dump 는 plain object 여야 합니다 (받음: ${
        dump === null ? "null" : Array.isArray(dump) ? "array" : typeof dump
      })`,
    );
    return { valid: false, issues };
  }

  // schemaVersion — 비어있지 않은 string shape 만 검증(accept/migrate/reject 호환 판정 0).
  const schemaVersion = dump.schemaVersion;
  if (typeof schemaVersion !== "string" || schemaVersion.trim().length === 0) {
    issues.push(
      `schemaVersion 은 비어있지 않은 string 이어야 합니다 (받음: ${typeof schemaVersion})`,
    );
  }

  // generatedAt — ISO 파싱 가능한 string(비-string / 빈 / Invalid Date 거부).
  const generatedAt = dump.generatedAt;
  if (
    typeof generatedAt !== "string" ||
    generatedAt.trim().length === 0 ||
    Number.isNaN(new Date(generatedAt).getTime())
  ) {
    issues.push(
      `generatedAt 은 ISO 파싱 가능한 string 이어야 합니다 (받음: ${typeof generatedAt})`,
    );
  }

  // records — 배열인지 먼저 확인. 배열이면 각 원소 shape/entity 검증 + 길이 정합 비교 base.
  const records = dump.records;
  const recordsIsArray = Array.isArray(records);
  if (!recordsIsArray) {
    issues.push(`records 는 배열이어야 합니다 (받음: ${typeof records})`);
  } else {
    // 각 원소가 { entity, instant } shape 이고 entity 가 5 허용 값인지 — 위반 index 박제.
    for (let index = 0; index < records.length; index += 1) {
      const record = records[index];
      if (!isPlainObject(record)) {
        issues.push(
          `records[${index}] 는 { entity, instant } 형태의 object 여야 합니다`,
        );
        continue;
      }
      if (
        typeof record.entity !== "string" ||
        !VALID_ENTITY_SET.has(record.entity)
      ) {
        issues.push(
          `records[${index}].entity 는 5 허용 entity 중 하나여야 합니다 (받음: ${String(
            record.entity,
          )})`,
        );
      }
      if (!("instant" in record)) {
        issues.push(`records[${index}].instant 가 누락되었습니다`);
      }
    }
  }

  // entityCounts — 5 entity 전부 key 를 가진 number map. 누락 key / 비-number value 거부.
  const entityCounts = dump.entityCounts;
  let countsSum: number | null = null;
  if (!isPlainObject(entityCounts)) {
    issues.push(
      `entityCounts 는 5 entity 를 key 로 가진 object 여야 합니다 (받음: ${
        entityCounts === null
          ? "null"
          : Array.isArray(entityCounts)
            ? "array"
            : typeof entityCounts
      })`,
    );
  } else {
    let sum = 0;
    let countsValid = true;
    for (let i = 0; i < ALL_ENTITIES.length; i += 1) {
      const key = ALL_ENTITIES[i];
      const value = entityCounts[key];
      if (typeof value !== "number" || Number.isNaN(value)) {
        issues.push(
          `entityCounts.${key} 는 number 여야 합니다 (받음: ${typeof value})`,
        );
        countsValid = false;
      } else {
        sum += value;
      }
    }
    if (countsValid) {
      countsSum = sum;
    }
  }

  // recordCount — number shape + records.length 정합. records 가 배열일 때만 길이 비교.
  const recordCount = dump.recordCount;
  if (typeof recordCount !== "number" || Number.isNaN(recordCount)) {
    issues.push(
      `recordCount 는 number 여야 합니다 (받음: ${typeof recordCount})`,
    );
  } else if (recordsIsArray && recordCount !== (records as unknown[]).length) {
    issues.push(
      `recordCount(${recordCount}) 가 records.length(${
        (records as unknown[]).length
      }) 와 일치하지 않습니다`,
    );
  }

  // entityCounts 합계 === recordCount 상호 정합 — 둘 다 정상 추출됐을 때만 비교.
  if (
    countsSum !== null &&
    typeof recordCount === "number" &&
    !Number.isNaN(recordCount) &&
    countsSum !== recordCount
  ) {
    issues.push(
      `entityCounts 합계(${countsSum}) 가 recordCount(${recordCount}) 와 일치하지 않습니다`,
    );
  }

  return { valid: issues.length === 0, issues };
}
