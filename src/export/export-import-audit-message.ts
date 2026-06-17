// export-import-audit-message — UC-07 Export/Import Audit entry 사람-친화 로그 메시지 조립 순수
// helper (T-0454, P7 R-57 / REQ-030 / REQ-032). T-0437 selectExportRecords → T-0438 buildExportDump
// → T-0439 checkSchemaVersionCompat → T-0440 validateImportDumpStructure → T-0441
// summarizeImportImpact → T-0442 buildImportRestorePlan → T-0443 buildExportImportAuditEntry → …
// → T-0453 buildRestoreConfirmation 다음의 게이트-free building block 이다. UC-07 §8 (b) Export·
// (e) Import 두 분기는 모두 "Audit log 1 row 생성(operation 종류 + actor + scope/file source +
// row count)"(§5 step 12)을 의무로 박제하고, T-0443 의 buildExportImportAuditEntry 가 그 audit
// 항목을 직렬화 가능한 구조화 객체(ExportImportAuditEntry)로 박제했다. 그러나 그 구조화 entry 를
// 사람(Admin·운영자)이 읽을 단일 로그 메시지 라인으로 조립하는 helper 는 0 회 cover 된 gap 이다
// — 실 controller / audit viewer / WebUI 배선이 매번 entry 를 풀어 "export by admin@... (scope=
// full, 1234 rows)" 같은 표시 문구를 중복 작성해야 한다. 본 helper 는 이미 산출된
// ExportImportAuditEntry(T-0443)를 입력으로 받아(재실행 0 — 순수 DRY 합성) operation·actor·
// scope/source·row count 를 담은 한국어 headline 한 줄 + 부가 detailLines 배열을 단일 모델로
// 조립한다.
//
// persistence / repository / transaction / DB / REST / logger 호출 0, 새 외부 dependency 0, 새
// 도메인 타입은 AuditLogMessage 만 신설(ExportImportAuditEntry / ExportAuditDetail /
// ImportAuditDetail / ExportScope / ExportEntity 재사용). ExportImportAuditEntry 산출 로직 재구현
// 0 — 본 helper 는 입력으로만 받는다(DRY). 코드 골격은 import-restore-confirmation.ts(T-0453,
// 구조화 데이터 → 사람-친화 메시지 모델) / import-restore-plan-summary.ts 의 순수-helper 패턴
// (plain 모델 interface + isPlainObject·assert 입력 방어 + 한국어 TypeError 메시지 convention +
// non-mutating + 빈 입력 정상)을 mirror 한다. REQ-032(raw 미저장)는 입력 entry 의 count/metadata
// 만 다뤄 raw 를 새로 fetch 하지 않으므로 helper layer 에서 자연 유지된다.
import {
  ExportAuditDetail,
  ExportImportAuditEntry,
  ExportImportAuditOperation,
  ImportAuditDetail,
} from "./export-import-audit";
import { ExportEntity, ExportScope } from "./export-scope-select";

// 조립된 사람-친화 audit 로그 메시지 모델 — plain object. headline 은 operation(한국어 표기) +
// actor(actorId·actorRole) + rowCount + occurredAt 을 담은 한국어 한 줄, detailLines 는 분기별
// 부가 정보(export: scope 요약 + 0 아닌 entity 라인 / import: mode + deleted·inserted·kept +
// source) 라인 배열, operation 은 입력 entry 의 operation 을 그대로 전달(렌더 분기용). 후속
// audit viewer / WebUI 컴포넌트(P6)가 이 모델을 그대로 렌더한다.
export interface AuditLogMessage {
  headline: string;
  detailLines: string[];
  operation: ExportImportAuditOperation;
}

// audit operation 한국어 표기 — headline 작성에 쓴다.
const OPERATION_LABELS: Record<ExportImportAuditOperation, string> = {
  export: "내보내기(export)",
  import: "가져오기(import)",
};

const VALID_OPERATIONS: ReadonlySet<string> = new Set(["export", "import"]);

// import mode 한국어 표기 — import 분기 detailLines 작성에 쓴다.
const MODE_LABELS: Record<string, string> = {
  replace: "전체 교체(replace)",
  merge: "병합(merge)",
};

// export scope kind 한국어 표기 — export 분기 scope 요약 라인에 쓴다.
const SCOPE_LABELS: Record<string, string> = {
  full: "전체(full)",
  range: "기간(range)",
  partial: "부분(partial)",
};

// perEntity 라인 작성 순서 — ExportEntity 5-union 과 동일 집합·고정 순서(라인 결정성 보장).
const ENTITY_ORDER: ReadonlyArray<ExportEntity> = [
  "Assessment",
  "Person",
  "Group",
  "LlmConfig",
  "AuditLog",
];

// plain object(null / 배열 / 비-object 아님) 판정 — top-level entry / 중첩 detail 입력 방어에 쓴다.
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// 입력값 종류를 사람-친화 문자열로 — 방어 메시지의 "(받음: ...)" 부분에 쓴다.
function describe(value: unknown): string {
  if (value === undefined) {
    return "undefined";
  }
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}

// export 분기 detailLines 조립 — scope 요약 라인(kind + dateRange 존재 시 start/end + entity
// Selector 존재 시 entity 목록) + 0 아닌 entityCounts entity-별 라인. detail.scope/entityCounts
// 부재·비-object 면 TypeError. 입력 detail 을 변형하지 않고 새 lines 배열에 push 만 한다.
function buildExportDetailLines(detail: unknown): string[] {
  if (!isPlainObject(detail)) {
    throw new TypeError(
      `formatAuditLogLine: operation=export 에는 detail object 가 필요합니다 (받음: ${describe(
        detail,
      )})`,
    );
  }
  const source = detail as Partial<ExportAuditDetail>;
  const scope = source.scope;
  if (
    !isPlainObject(scope) ||
    typeof (scope as ExportScope).scope !== "string"
  ) {
    throw new TypeError(
      `formatAuditLogLine: export detail 에는 scope object 가 필요합니다 (받음: ${describe(
        scope,
      )})`,
    );
  }
  const entityCounts = source.entityCounts;
  if (!isPlainObject(entityCounts)) {
    throw new TypeError(
      `formatAuditLogLine: export detail 에는 entityCounts object 가 필요합니다 (받음: ${describe(
        entityCounts,
      )})`,
    );
  }

  const lines: string[] = [];
  const scopeKind = (scope as ExportScope).scope;
  const scopeLabel = SCOPE_LABELS[scopeKind] ?? scopeKind;
  let scopeLine = `scope: ${scopeLabel}`;

  // dateRange 존재(유효 start/end Date) 시 [start, end) 요약 추가 — 부재/비-Date 면 생략.
  const dateRange = (scope as ExportScope).dateRange;
  if (
    isPlainObject(dateRange) &&
    dateRange.start instanceof Date &&
    !Number.isNaN(dateRange.start.getTime()) &&
    dateRange.end instanceof Date &&
    !Number.isNaN(dateRange.end.getTime())
  ) {
    scopeLine += ` [${dateRange.start.toISOString()} ~ ${dateRange.end.toISOString()})`;
  }

  // entitySelector 존재(비어있지 않은 배열) 시 entity 목록 추가 — 부재/빈 배열 면 생략.
  const selector = (scope as ExportScope).entitySelector;
  if (Array.isArray(selector) && selector.length > 0) {
    scopeLine += ` 대상: ${selector.join(", ")}`;
  }
  lines.push(scopeLine);

  // 0 아닌 양의 정수 entity 만 라인으로 노출(0 / 비-정수는 생략 — 영향 없음으로 간주).
  const counts = entityCounts as Record<string, unknown>;
  for (const entity of ENTITY_ORDER) {
    const count = counts[entity];
    if (typeof count === "number" && Number.isInteger(count) && count > 0) {
      lines.push(`  - ${entity}: ${count} row`);
    }
  }

  return lines;
}

// import 분기 detailLines 조립 — mode(한국어 표기) + deleted/inserted/kept count 라인 + source
// (지정 시 출처 문자열, null 시 "(파일 출처 미지정)") 라인. detail.mode 가 허용 외 / deleted·
// inserted·kept 가 비-정수면 TypeError. 입력 detail 을 변형하지 않고 새 lines 배열에 push 만 한다.
function buildImportDetailLines(detail: unknown): string[] {
  if (!isPlainObject(detail)) {
    throw new TypeError(
      `formatAuditLogLine: operation=import 에는 detail object 가 필요합니다 (받음: ${describe(
        detail,
      )})`,
    );
  }
  const source = detail as Partial<ImportAuditDetail>;

  const mode = source.mode;
  if (typeof mode !== "string" || !(mode in MODE_LABELS)) {
    throw new TypeError(
      `formatAuditLogLine: import detail.mode 는 replace/merge 중 하나여야 합니다 (받음: ${String(
        mode,
      )})`,
    );
  }

  // deleted / inserted / kept 는 0 이상 정수 필수(비-정수 / 음수 / 비-number 거부).
  const counts: Array<["deleted" | "inserted" | "kept", string]> = [
    ["deleted", "삭제"],
    ["inserted", "삽입"],
    ["kept", "보존"],
  ];
  const numeric: Record<string, number> = {};
  for (const [key] of counts) {
    const value = (source as Record<string, unknown>)[key];
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
      throw new TypeError(
        `formatAuditLogLine: import detail.${key} 는 0 이상 정수여야 합니다 (받음: ${String(
          value,
        )})`,
      );
    }
    numeric[key] = value;
  }

  const lines: string[] = [];
  lines.push(`mode: ${MODE_LABELS[mode]}`);
  lines.push(
    `삭제 ${numeric.deleted} / 삽입 ${numeric.inserted} / 보존 ${numeric.kept} row`,
  );

  // source 라인 — 지정(비-빈 문자열) 시 출처 그대로, null / 빈 문자열 / 부재 시 미지정 명시.
  const src = source.source;
  if (typeof src === "string" && src.length > 0) {
    lines.push(`출처: ${src}`);
  } else {
    lines.push("출처: (파일 출처 미지정)");
  }

  return lines;
}

// formatAuditLogLine — 이미 산출된 ExportImportAuditEntry(T-0443)를 받아 사람-친화 audit 로그
// 메시지 모델을 순수 합성한다(UC-07 §8 (b)(e) 정합):
//   - headline — operation(한국어 표기) + actor(actorId·actorRole) + rowCount + occurredAt 을
//     담은 한국어 한 줄.
//   - detailLines — export 분기: scope 요약 + 0 아닌 entity 라인 / import 분기: mode + 삭제·
//     삽입·보존 count + source 라인.
//   - operation — 입력 entry 의 operation 그대로(렌더 분기용).
//
// 입력 entry 객체 / 중첩 detail / entityCounts map 을 변형하지 않고 새 객체·배열을 반환한다
// (non-mutating — deepFreeze 된 entry 로 호출해도 통과). transaction/배선 전 안전을 위한 입력 방어:
//   - entry 가 plain object 아님(null / 배열 / 비-object) → TypeError.
//   - entry.operation 이 "export" / "import" 외 → RangeError.
//   - entry.actorId 비-string → TypeError.
//   - entry.rowCount 비-정수 → TypeError.
//   - entry.detail 부재 / 비-object → TypeError.
//   - operation=export 인데 detail 에 scope / entityCounts 부재·비-object → TypeError.
//   - operation=import 인데 detail.mode 허용 외 / deleted·inserted·kept 비-정수 → TypeError.
// happy-path 는 buildExportImportAuditEntry 통과 entry 를 전제하므로 위 방어 분기는 negative test
// 로 cover 한다.
export function formatAuditLogLine(
  entry: ExportImportAuditEntry,
): AuditLogMessage {
  // top-level entry 가 plain object 가 아니면 하위 필드에 접근할 수 없어 즉시 throw.
  if (!isPlainObject(entry)) {
    throw new TypeError(
      `formatAuditLogLine: entry 는 plain object 여야 합니다 (받음: ${describe(
        entry,
      )})`,
    );
  }

  const source = entry as Partial<ExportImportAuditEntry>;

  // operation 검증 먼저 — 분기 진입 전 거부(대소문자 mismatch / null / 숫자 모두 reject).
  const operation = source.operation;
  if (typeof operation !== "string" || !VALID_OPERATIONS.has(operation)) {
    throw new RangeError(
      `formatAuditLogLine: operation 은 export/import 중 하나여야 합니다 (받음: ${String(
        operation,
      )})`,
    );
  }

  // actorId 검증 — 비-string 거부.
  const actorId = source.actorId;
  if (typeof actorId !== "string") {
    throw new TypeError(
      `formatAuditLogLine: entry.actorId 는 string 이어야 합니다 (받음: ${describe(
        actorId,
      )})`,
    );
  }

  // rowCount 검증 — 0 이상 정수 필수(음수 / 소수 / NaN / 비-number 거부).
  const rowCount = source.rowCount;
  if (
    typeof rowCount !== "number" ||
    !Number.isInteger(rowCount) ||
    rowCount < 0
  ) {
    throw new TypeError(
      `formatAuditLogLine: entry.rowCount 는 0 이상 정수여야 합니다 (받음: ${String(
        rowCount,
      )})`,
    );
  }

  const actorRole = source.actorRole;
  const occurredAt = source.occurredAt;

  const operationLabel =
    OPERATION_LABELS[operation as ExportImportAuditOperation];
  const headline =
    `[${operationLabel}] 수행자: ${actorId}(${String(actorRole)}), ` +
    `${rowCount} row, 시각: ${String(occurredAt)}`;

  // 분기별 detailLines 조립 — detail 부재/비-object 는 각 분기 helper 가 TypeError.
  const detailLines =
    operation === "export"
      ? buildExportDetailLines(source.detail)
      : buildImportDetailLines(source.detail);

  return {
    headline,
    detailLines,
    operation: operation as ExportImportAuditOperation,
  };
}
