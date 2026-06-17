// import-dump-size-validate — UC-07 Import dump 크기 한계 검증 순수 helper (T-0450, P7 R-57 /
// REQ-030 / REQ-032). T-0437 selectExportRecords → T-0438 buildExportDump → T-0439
// checkSchemaVersionCompat → T-0440 validateImportDumpStructure → T-0441 summarizeImportImpact
// → T-0442 buildImportRestorePlan → T-0443 buildExportImportAuditEntry → T-0444
// validateExportScope → T-0445 상수 DRY → T-0446 computeDumpChecksum/verifyDumpChecksum →
// T-0447 summarizeRestorePlan → T-0449 summarizeExportSelection 의 다음 게이트-free 단추다.
// UC-07 §7.3 (payload 검증 실패) 가 명시한 "Import 의 file 크기 한계 초과 → 400 + 검증 메시지"
// gate 는 기존 12 helper 중 0 회 cover — validateImportDumpStructure(T-0440)는 dump 구조만,
// computeDumpChecksum/verifyDumpChecksum(T-0446)은 byte-level 무결성만 검사하고, 어느 helper 도
// size cap(전체 record 수 · entity-별 record 수 한계)을 검사하지 않는다. 본 helper 는 그 gap 을
// 순수 derivation 으로 박제한다 — ExportDump(T-0438 envelope)를 받아 옵션 maxTotalRecords /
// maxPerEntity(entity-별 cap map)로 size cap 위반을 검사해 plain verdict 를 반환하는 순수 함수다.
// UC-07 §7.3 (transaction 시작 전 reject — DB 변경 0) 의 Import side 사전 게이트.
//
// 코드 골격은 export-scope-validate.ts(T-0444)의 verdict 패턴(다중 누적 + 비-throw +
// non-mutating)을 mirror 하되 size cap 에 맞춰 kind/limit/actual/entity 필드를 박제한다.
// persistence/repository/transaction/REST 호출 0, 새 도메인 타입 신설 0(ExportDump/ExportEntity
// 재사용), 새 외부 dependency 0. REQ-032(raw 미저장)는 입력 dump 의 count metadata 만 다루고
// raw 를 새로 fetch 하지 않으므로 helper layer 에서 자연 유지된다.
import { ExportDump } from "./export-dump";
import { ExportEntity, VALID_EXPORT_ENTITIES } from "./export-scope-select";

// size cap 옵션 — 둘 다 선택. maxTotalRecords 는 전체 record 수 상한, maxPerEntity 는 entity-별
// record 수 상한 map(부분 지정 가능 — 지정한 entity 만 검사). 옵션 자체 또는 두 필드 모두 부재
// 시 cap 검사 skip(valid=true). 후속 BackendAPI / controller 가 정책 row · ENV 기반 동적 cap 을
// 넘긴다(본 helper 는 정책 source 0 — 옵션으로 받은 값만 검사).
export interface ImportDumpSizeLimits {
  maxTotalRecords?: number;
  maxPerEntity?: Partial<Record<ExportEntity, number>>;
}

// 검출된 size cap 위반 1 건 — total-overflow(전체 record 수 초과) 또는 per-entity-overflow
// (특정 entity 의 record 수 초과). limit/actual 은 어느 cap 을 얼마나 초과했는지의 진단값,
// entity 는 per-entity-overflow 일 때만 채운다. WebUI / 400 응답이 그대로 안내에 쓴다.
export interface ImportDumpSizeError {
  kind: "total-overflow" | "per-entity-overflow";
  message: string;
  limit: number;
  actual: number;
  entity?: ExportEntity;
}

// size cap 검증 verdict — plain object. valid 는 errors 가 빈 배열일 때만 true, errors 는 검출된
// 모든 위반의 누적 목록(첫 위반에서 멈추지 않음 — §7.3 다중 안내), totals 는 ground truth
// (dump.records 순회)로 산출한 전체/ entity-별 record 수(cap 부재여도 항상 산출). 후속 Import
// 배선이 invalid 면 transaction 을 시작하지 않고 errors 를 그대로 사용자에게 안내한다(§7.3).
export interface ImportDumpSizeVerdict {
  valid: boolean;
  errors: ImportDumpSizeError[];
  totals: {
    total: number;
    perEntity: Record<ExportEntity, number>;
  };
}

// plain object(null/배열/비-object 아님) 판정 — top-level dump 와 maxPerEntity 검증에 쓴다.
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// cap 후보값이 유효한 비-음수 정수(0 허용)인지 판정 — NaN/Infinity/소수/음수/비-number 거부.
// cap 0 은 "허용 0 건"의 정상 정책이므로 허용한다(빈 dump 만 통과).
function isValidCap(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

// validateImportDumpSize — ExportDump(이미 메모리에 올라온 envelope)가 옵션 size cap 을 넘지
// 않는지 검사해 verdict 를 반환한다. UC-07 §7.3 정합:
//   - dump 가 plain object 아님(null/배열/비-object) → TypeError(label "dump").
//   - dump.records 가 배열 아님 → TypeError(label "dump.records").
//   - maxTotalRecords / maxPerEntity[k] 가 비-정수·음수·NaN·Infinity 등 → TypeError(어느 옵션 /
//     어느 entity 인지 메시지 박제). maxPerEntity 가 비-object(배열/null/원시값) → TypeError.
//   - totals 는 dump.records 를 ground truth 로 산출(envelope entityCounts metadata 와 별개) —
//     total = records.length, perEntity 는 5 entity 0-init map 에 records 1 회 순회로 +1 집계.
//     5 허용 외 entity 값은 key 가 없어 자연 무시(T-0440 구조 검증 책임 위임).
//   - cap 위반은 즉시 throw 하지 않고 errors 에 모두 누적(maxTotalRecords 초과 + 여러 entity
//     초과 동시 발생 시 한 verdict 에 전부 박제 — 다중 누적 패턴). cap 비교는 totals 기준.
//   - 옵션 부재(options 자체 또는 두 필드 모두 부재) → cap 검사 skip(valid=true, errors=[]).
//   - 경계: actual === limit → 통과(초과 아님), actual === limit + 1 → 초과. 빈 dump(records 0)
//     + cap 0 → 통과.
//
// 입력 dump/options 를 변형하지 않으며(non-mutating — freeze 된 입력 통과), errors/totals 는
// 항상 새 객체. 위반 0 이면 { valid: true, errors: [], totals } 를 반환한다.
export function validateImportDumpSize(
  dump: ExportDump,
  options?: ImportDumpSizeLimits,
): ImportDumpSizeVerdict {
  // top-level dump 가 plain object 아니면 records 에 접근할 수 없어 즉시 throw(구조 검증과 달리
  // 이는 helper 의 호출 계약 위반 — verdict 가 아니라 프로그래밍 오류로 본다).
  if (!isPlainObject(dump)) {
    throw new TypeError(
      `validateImportDumpSize: dump 는 plain object 여야 합니다 (받음: ${
        dump === null ? "null" : Array.isArray(dump) ? "array" : typeof dump
      })`,
    );
  }

  const records = (dump as { records: unknown }).records;
  if (!Array.isArray(records)) {
    throw new TypeError(
      `validateImportDumpSize: dump.records 는 배열이어야 합니다 (받음: ${typeof records})`,
    );
  }

  // totals 산출 — records 가 ground truth. 5 entity 0-init map 에 1 회 순회로 +1. 5 허용 외
  // entity(비-string 포함)는 key 가 없어 자연 무시(T-0440 검증 책임 위임).
  const perEntity = {
    Assessment: 0,
    Person: 0,
    Group: 0,
    LlmConfig: 0,
    AuditLog: 0,
  } as Record<ExportEntity, number>;
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index] as { entity?: unknown };
    const entity = record?.entity;
    if (typeof entity === "string" && entity in perEntity) {
      perEntity[entity as ExportEntity] += 1;
    }
  }
  const total = records.length;
  const totals = { total, perEntity };

  const errors: ImportDumpSizeError[] = [];

  // 옵션 부재(options 자체 또는 두 필드 모두 부재) → cap 검사 skip(valid=true).
  if (!options) {
    return { valid: true, errors, totals };
  }

  const { maxTotalRecords, maxPerEntity } = options;

  // maxTotalRecords cap — 주어졌을 때만 검사. 비-정수·음수·NaN·Infinity 등 → TypeError.
  if (maxTotalRecords !== undefined) {
    if (!isValidCap(maxTotalRecords)) {
      throw new TypeError(
        `validateImportDumpSize: options.maxTotalRecords 는 0 이상의 정수여야 합니다 (받음: ${String(
          maxTotalRecords,
        )})`,
      );
    }
    if (total > maxTotalRecords) {
      errors.push({
        kind: "total-overflow",
        message: `전체 record 수(${total})가 한계(${maxTotalRecords})를 초과했습니다`,
        limit: maxTotalRecords,
        actual: total,
      });
    }
  }

  // maxPerEntity cap map — 주어졌을 때만 검사. 비-object(배열/null/원시값) → TypeError. 각 cap
  // 값은 isValidCap 으로 검증(어느 entity 인지 메시지 박제). 5 허용 entity 만 비교 대상 —
  // 알 수 없는 key 는 무시(정책: 미지 entity cap 은 silent skip, 5 entity 만 검사).
  if (maxPerEntity !== undefined) {
    if (!isPlainObject(maxPerEntity)) {
      throw new TypeError(
        `validateImportDumpSize: options.maxPerEntity 는 entity→number cap map 이어야 합니다 (받음: ${
          maxPerEntity === null
            ? "null"
            : Array.isArray(maxPerEntity)
              ? "array"
              : typeof maxPerEntity
        })`,
      );
    }
    for (let i = 0; i < VALID_EXPORT_ENTITIES.length; i += 1) {
      const entity = VALID_EXPORT_ENTITIES[i];
      const cap = (maxPerEntity as Record<string, unknown>)[entity];
      if (cap === undefined) {
        continue;
      }
      if (!isValidCap(cap)) {
        throw new TypeError(
          `validateImportDumpSize: options.maxPerEntity.${entity} 는 0 이상의 정수여야 합니다 (받음: ${String(
            cap,
          )})`,
        );
      }
      const actual = perEntity[entity];
      if (actual > cap) {
        errors.push({
          kind: "per-entity-overflow",
          message: `${entity} record 수(${actual})가 한계(${cap})를 초과했습니다`,
          limit: cap,
          actual,
          entity,
        });
      }
    }
  }

  return { valid: errors.length === 0, errors, totals };
}
