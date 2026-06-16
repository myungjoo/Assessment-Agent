// export-scope-validate — UC-07 Export scope 요청 payload 검증 순수 helper (T-0444, P7 R-57 /
// REQ-030 / REQ-032 / REQ-045). T-0437 selectExportRecords(scope 선별) → T-0438 buildExportDump
// → T-0439 checkSchemaVersionCompat → T-0440 validateImportDumpStructure → T-0441
// summarizeImportImpact → T-0442 buildImportRestorePlan → T-0443 buildExportImportAuditEntry 의
// 다음 게이트-free 단추다. selectExportRecords(T-0437)는 선별 시점에 inline 으로만 검증해 첫
// 위반에서 즉시 throw 하므로, BackendAPI 가 query 를 실행하기 **전에** 사용자에게 보여줄
// field-level 검증 결과(어느 필드가 왜 부적합한지의 목록)를 산출하지 못한다. 본 helper 는 그
// 사전 검증을 **순수 결정 로직** 으로 박제한다 — `ExportScope` 후보 입력을 받아 UC-07 §6.1 의
// 3 차원 옵션 규칙(scope enum / range scope 의 dateRange 필수·유효성 / partial scope 의
// entitySelector 필수·유효 entity / AND 조합)에 맞는지 검사해 `{ valid, errors, normalized? }`
// verdict 를 반환한다. Import 입구의 validateImportDumpStructure(T-0440, transaction 전 reject)
// 와 동형인 **Export 입구의 reject-before-run** gate 다.
//
// 코드 골격은 import-dump-validate.ts 의 순수-helper 패턴(plain verdict interface + 비-throw
// 누적 검증 + non-mutating + 입력 방어)을 mirror 한다. selectExportRecords 처럼 첫 위반에서
// throw 하지 않고, 여러 위반을 errors 배열에 모두 누적한다(UC-07 §7.3 form field-level error 가
// 한 번에 여러 필드를 표시할 수 있어야 함). 검증 규칙의 source-of-truth 는 export-scope-select.ts
// (VALID_SCOPES · ExportEntity · 반열림 [start,end) 정책)이며, 새 도메인 타입은 신설하지 않고
// 그쪽 ExportScope / ExportEntity 를 재사용한다. REQ-032(raw 미저장)는 본 helper 가 scope option
// 만 검사하고 record / raw 를 다루지 않으므로 helper layer 에서 자연 유지된다.
import { ExportEntity, ExportScope } from "./export-scope-select";

// 허용 scope 값 — export-scope-select.ts 의 VALID_SCOPES 와 동일 집합(그쪽이 export 되지 않아
// 본 파일에 같은 값을 mirror 한다). scope 차원 검증의 source-of-truth.
const VALID_SCOPES: ReadonlyArray<ExportScope["scope"]> = [
  "full",
  "range",
  "partial",
];

const VALID_SCOPE_SET: ReadonlySet<string> = new Set(VALID_SCOPES);

// 허용 ExportEntity 5 종(UC-07 §6.1 entitySelector 목록 — export-scope-select.ts ExportEntity
// union 과 동일 집합). partial scope 의 entitySelector 및 range+entitySelector AND 조합의 entity
// 값 유효성 검증에 쓴다.
const VALID_ENTITIES: ReadonlyArray<ExportEntity> = [
  "Assessment",
  "Person",
  "Group",
  "LlmConfig",
  "AuditLog",
];

const VALID_ENTITY_SET: ReadonlySet<string> = new Set(VALID_ENTITIES);

// 부적합 필드 식별자 — WebUI 의 form field 매핑용(§7.3 field-level error). 검출된 위반은 이
// field + 한국어 message 쌍으로 errors 배열에 누적된다.
export interface ExportScopeError {
  field: "scope" | "dateRange" | "entitySelector";
  message: string;
}

// Export scope payload 검증 verdict — plain object. valid 는 errors 가 빈 배열일 때만 true,
// errors 는 검출된 모든 위반의 누적 목록(첫 위반에서 멈추지 않음 — §7.3 form field-level error),
// normalized 는 valid 일 때만 채워지는 정규화된 ExportScope(full scope 의 무의미한
// dateRange/entitySelector 제거 등). 후속 BackendAPI 가 invalid 면 400 + errors 를 그대로 form
// field-level error 로 안내하고, valid 면 normalized 를 selectExportRecords 에 넘긴다.
export interface ExportScopeValidation {
  valid: boolean;
  errors: ExportScopeError[];
  normalized?: ExportScope;
}

// plain object(null/배열/비-object 아님) 판정 — top-level input 과 dateRange 검증에 쓴다.
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// 유효 Date instance(Invalid Date / 비-Date 아님) 판정 — dateRange.start / end 검증에 쓴다.
function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

// validateExportScope — Export scope 요청 payload 후보(unknown)가 UC-07 §6.1 의 3 차원 옵션
// 규칙에 맞는지 검사해 verdict 를 반환한다. selectExportRecords 와 달리 첫 위반에서 throw 하지
// 않고 모든 위반을 errors 에 누적한다(§7.3 form field-level error). UC-07 정합:
//   - input 이 null/undefined/비-object → { field: "scope", ... } error(이후 검증 중단, 하위
//     field 접근 불가).
//   - scope 가 부재 / "full"·"range"·"partial" 외 값(대소문자·빈 문자열 포함) → { field:
//     "scope", ... } error.
//   - scope="range" 인데 dateRange 부재 / start·end 가 유효 Date 아님 / start >= end(역전·빈
//     반열림 구간) → { field: "dateRange", ... } error. scope != "range" 인데 dateRange 가
//     주어지면 error 아님 — normalized 에서 제거(§6.1 "full → 전체").
//   - scope="partial" 인데 entitySelector 부재 / 비-배열 / 빈 배열 / 허용 ExportEntity 외 값
//     포함 → { field: "entitySelector", ... } error.
//   - range + entitySelector 동시 지정은 정상(§6.1 AND). 단 entitySelector 의 entity 값
//     유효성은 range scope 에서도 검사한다.
//
// 입력 객체/배열을 변형하지 않으며(non-mutating — freeze 된 input 통과), normalized 는 항상 새
// 객체(entitySelector 도 새 배열로 복사). 위반 0 이면 { valid: true, errors: [], normalized }
// 를 반환한다.
export function validateExportScope(input: unknown): ExportScopeValidation {
  const errors: ExportScopeError[] = [];

  // top-level 가 plain object 가 아니면 하위 field(scope/dateRange/entitySelector)에 접근할 수
  // 없어 즉시 단일 scope error 로 종료(throw 아님 — §7.3 는 400 verdict 응답).
  if (!isPlainObject(input)) {
    errors.push({
      field: "scope",
      message: `Export scope 는 object 여야 합니다 (받음: ${
        input === null ? "null" : Array.isArray(input) ? "array" : typeof input
      })`,
    });
    return { valid: false, errors };
  }

  const scope = input.scope;
  const scopeValid = typeof scope === "string" && VALID_SCOPE_SET.has(scope);
  if (!scopeValid) {
    errors.push({
      field: "scope",
      message: `scope 는 full/range/partial 중 하나여야 합니다 (받음: ${String(
        scope,
      )})`,
    });
  }

  // dateRange 차원 — scope="range" 일 때만 필수·검증. scope != "range" 면 dateRange 가 있어도
  // error 아님(normalized 에서 제거). scope 가 부적합한 경우엔 range 분기를 평가하지 않는다
  // (scope error 가 이미 박제됐고, dateRange 의무는 range scope 에서만 발생).
  const dateRange = input.dateRange;
  let normalizedRange: { start: Date; end: Date } | undefined;
  if (scope === "range") {
    if (!isPlainObject(dateRange)) {
      errors.push({
        field: "dateRange",
        message: `scope=range 에는 start/end 를 가진 dateRange 가 필요합니다 (받음: ${
          dateRange === null
            ? "null"
            : Array.isArray(dateRange)
              ? "array"
              : typeof dateRange
        })`,
      });
    } else {
      const start = dateRange.start;
      const end = dateRange.end;
      const startOk = isValidDate(start);
      const endOk = isValidDate(end);
      if (!startOk) {
        errors.push({
          field: "dateRange",
          message: "dateRange.start 는 유효한 Date instance 여야 합니다",
        });
      }
      if (!endOk) {
        errors.push({
          field: "dateRange",
          message: "dateRange.end 는 유효한 Date instance 여야 합니다",
        });
      }
      if (startOk && endOk && start.getTime() >= end.getTime()) {
        errors.push({
          field: "dateRange",
          message:
            `dateRange 는 start < end 인 반열림 구간이어야 합니다 ` +
            `(start=${start.toISOString()}, end=${end.toISOString()})`,
        });
      }
      if (startOk && endOk && start.getTime() < end.getTime()) {
        // normalized 는 항상 새 Date — 입력 객체 참조를 그대로 박지 않아 non-mutating 보장.
        normalizedRange = {
          start: new Date(start.getTime()),
          end: new Date(end.getTime()),
        };
      }
    }
  }

  // entitySelector 차원 — scope="partial" 일 때 필수, range 일 때 선택(주어지면 AND). 어느
  // 쪽이든 주어진 entitySelector 의 entity 값 유효성은 검사한다. valid 한 selector 는 새 배열로
  // 복사해 normalized 에 박는다(non-mutating).
  const entitySelector = input.entitySelector;
  let normalizedSelector: ExportEntity[] | undefined;
  if (scope === "partial") {
    if (!Array.isArray(entitySelector) || entitySelector.length === 0) {
      errors.push({
        field: "entitySelector",
        message: `scope=partial 에는 비어있지 않은 entitySelector 배열이 필요합니다 (받음: ${
          Array.isArray(entitySelector)
            ? "빈 배열"
            : entitySelector === null
              ? "null"
              : typeof entitySelector
        })`,
      });
    } else {
      normalizedSelector = collectValidEntities(entitySelector, errors);
    }
  } else if (Array.isArray(entitySelector) && entitySelector.length > 0) {
    // range(또는 그 외) scope 에 entitySelector 가 동봉된 경우 — entity 값 유효성만 검사하고
    // valid 면 AND 조건의 한 축으로 normalized 에 보존한다.
    normalizedSelector = collectValidEntities(entitySelector, errors);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // valid — scope 별로 무의미한 차원을 제거한 정규화된 ExportScope 를 새 객체로 조립한다.
  // full → dateRange/entitySelector 제거, range → dateRange(+ 동봉 시 entitySelector),
  // partial → entitySelector.
  const normalized: ExportScope = { scope: scope as ExportScope["scope"] };
  if (normalizedRange) {
    normalized.dateRange = normalizedRange;
  }
  if (normalizedSelector) {
    normalized.entitySelector = normalizedSelector;
  }

  return { valid: true, errors: [], normalized };
}

// entitySelector 배열의 각 원소가 허용 ExportEntity 5 종 중 하나인지 검사한다. 허용 외 값이
// 하나라도 있으면 그 값을 담은 entitySelector error 를 errors 에 누적하고 undefined 를 반환,
// 모두 유효하면 입력을 그대로 복사한 새 배열을 반환한다(non-mutating).
function collectValidEntities(
  selector: ReadonlyArray<unknown>,
  errors: ExportScopeError[],
): ExportEntity[] | undefined {
  const invalid: string[] = [];
  for (let index = 0; index < selector.length; index += 1) {
    const value = selector[index];
    if (typeof value !== "string" || !VALID_ENTITY_SET.has(value)) {
      invalid.push(String(value));
    }
  }
  if (invalid.length > 0) {
    errors.push({
      field: "entitySelector",
      message: `entitySelector 는 Assessment/Person/Group/LlmConfig/AuditLog 만 허용합니다 (허용 외: ${invalid.join(
        ", ",
      )})`,
    });
    return undefined;
  }
  return selector.slice() as ExportEntity[];
}
