// export-result — UC-07 Export 완료 결과 메시지 조립 순수 helper (T-0456, P7 R-57 / REQ-030 /
// REQ-032). T-0437 selectExportRecords → T-0438 buildExportDump → … → T-0449
// summarizeExportSelection → … → T-0454 formatAuditLogLine → T-0455 buildRestoreResult(Import
// 실행 *후* 결과) 다음의 게이트-free building block 이다. UC-07 §5 step 13
// (`결과 표시 (Export: 다운로드 완료 …)`) + §8 (a) Export postcondition(DB 무변화 read-only +
// Audit row(Export 종류 + actor + scope + row count) + file artifact 전달)은 Export 직렬화
// *이후* Admin 에게 보여줄 **Export 완료 결과 메시지** 조립을 박제한다. 그러나 18 building
// block(T-0437~T-0455)의 result/message 조립 helper 는 전부 Import 측 흐름만 cover 했다 —
// Export 흐름의 완료 결과(선별 row count + scope 요약 + entity-별 영향)를 사람이 읽을 단일 결과
// 메시지로 조립하는 helper 는 0 회 cover 된 gap 이다. 본 helper 는 그 gap 을 순수 DRY 합성으로
// 박제한다.
//
// buildExportResult(summary, scope)는 이미 산출된 ExportSelectionSummary(T-0449) +
// ExportScope(T-0437)를 입력으로 받아(재실행 0 — 순수 DRY 합성) {headline, exportedCounts,
// impactLines[], scopeLine} 단일 결과 모델로 조립한다. 이는 T-0455 buildRestoreResult(Import
// 실행 후 result)의 Export 측 대칭 — Import 는 복원 결과 + 재수집 안내, Export 는 다운로드 완료 +
// scope 요약 + 영향 범위.
//
// persistence / repository / transaction / DB query · 직렬화 · REST 배선 / logger / file-stream
// 호출 0, 새 외부 dependency 0, 새 도메인 타입은 ExportResult 만 신설(ExportSelectionSummary /
// ExportSelectionGroupBreakdown / ExportScope / ExportEntity 재사용). ExportSelectionSummary
// 산출 로직 재구현 0 — 본 helper 는 입력으로만 받는다(DRY, summarizeExportSelection T-0449 책임).
// 코드 골격은 import-restore-result.ts(직전 대칭 task T-0455)의 plain 모델 interface + 한국어
// TypeError/RangeError 메시지 convention + non-mutating + 빈 입력 정상 + perEntity 5-entity
// 패턴을 mirror 한다. REQ-032(raw 미저장)는 입력 summary 의 count/metadata 만 다뤄 raw 를 새로
// fetch 하지 않으므로 helper layer 에서 자연 유지된다(§8 (a) Export payload 에 raw 자연 부재).
import {
  ExportEntity,
  ExportScope,
  VALID_EXPORT_SCOPES,
} from "./export-scope-select";
import {
  ExportSelectionGroupBreakdown,
  ExportSelectionSummary,
} from "./export-selection-summary";

// Export 완료 결과 메시지 모델 — plain object. headline 은 "다운로드 완료" + 핵심 selected row
// count 를 담은 한국어 한 줄, exportedCounts 는 summary.selected/excluded 의 total 을 그대로 옮긴
// 요약 수치, impactLines 는 selected 의 0 아닌 entity-별 영향 라인(excluded.total>0 면 제외 요약
// 라인 포함, full scope 의 excluded.total=0 은 제외 라인 생략), scopeLine 은 scope(full/range/
// partial 한국어 표기) + range dateRange 요약 + partial entitySelector 요약을 담은 한국어 한
// 줄이다. 후속 WebUI 결과 화면(P6)이 이 모델을 그대로 렌더하고, REST controller(repository
// 게이트 후속)가 §8 (a) 응답으로 직렬화한다.
export interface ExportResult {
  headline: string;
  exportedCounts: { selected: number; excluded: number };
  impactLines: string[];
  scopeLine: string;
}

// perEntity 라인 작성 순서 — ExportEntity 5-union 과 동일 집합·고정 순서(라인 결정성 보장).
const ENTITY_ORDER: ReadonlyArray<ExportEntity> = [
  "Assessment",
  "Person",
  "Group",
  "LlmConfig",
  "AuditLog",
];

// scope 한국어 표기 — scopeLine 의 머리 라벨. VALID_EXPORT_SCOPES(T-0437) 와 동일 집합이며
// 한쪽이 늘면 본 map 도 함께 갱신해야 한다(허용 scope 외 값은 호출 전 RangeError 로 차단됨).
const SCOPE_LABELS: Record<ExportScope["scope"], string> = {
  full: "full(전체)",
  range: "range(기간)",
  partial: "partial(부분)",
};

// 허용 scope 집합 — VALID_EXPORT_SCOPES(T-0437) single-source 를 그대로 set 으로 감싼다(DRY —
// scope 차원 멤버십을 본 helper 가 별도 선언하지 않는다).
const VALID_SCOPES: ReadonlySet<string> = new Set(VALID_EXPORT_SCOPES);

// plain object(null / 배열 / 비-object 아님) 판정 — top-level summary + 그룹 + perEntity + scope
// 입력 방어에 쓴다.
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// 비-plain-object 값의 표시명 — 메시지에 어떤 잘못된 입력이 왔는지 담는다.
function describeNonObject(value: unknown): string {
  return value === undefined
    ? "undefined"
    : value === null
      ? "null"
      : Array.isArray(value)
        ? "array"
        : typeof value;
}

// 한 그룹 breakdown(selected/excluded)의 shape 방어 — 부재 / 비-object 면 TypeError(어느 그룹
// 인지 label 로 명시), total 이 비-정수(NaN / 소수 / 음수 / 비-number)면 TypeError, perEntity 가
// 부재 / 비-object 면 TypeError. 검증 후 호출측은 group.perEntity 를 안전하게 읽는다
// (import-restore-result.assertGroupBreakdown mirror).
function assertGroupBreakdown(
  value: unknown,
  label: string,
): asserts value is ExportSelectionGroupBreakdown {
  if (!isPlainObject(value)) {
    throw new TypeError(
      `buildExportResult: summary.${label} 은(는) object 여야 합니다 ` +
        `(받음: ${describeNonObject(value)})`,
    );
  }
  const total = (value as { total?: unknown }).total;
  if (typeof total !== "number" || !Number.isInteger(total) || total < 0) {
    throw new TypeError(
      `buildExportResult: summary.${label}.total 은(는) 0 이상 정수여야 합니다 ` +
        `(받음: ${String(total)})`,
    );
  }
  const perEntity = (value as { perEntity?: unknown }).perEntity;
  if (!isPlainObject(perEntity)) {
    throw new TypeError(
      `buildExportResult: summary.${label}.perEntity 은(는) object 여야 합니다 ` +
        `(받음: ${describeNonObject(perEntity)})`,
    );
  }
}

// selected 그룹의 0 아닌 entity 라인을 누적 — total 라인 1 개 + 0 아닌 perEntity 만 entity 라인.
// perEntity 의 entity 값이 0 / 비-정수면 라인을 생략한다(부가 정보라 관대 — total 은 이미 엄격
// 검증됨). 입력을 변형하지 않고 lines 배열에 push 만 한다(non-mutating).
function appendSelectedLines(
  lines: string[],
  selected: ExportSelectionGroupBreakdown,
): void {
  lines.push(`선별 ${selected.total} row`);
  const perEntity = selected.perEntity as Record<ExportEntity, unknown>;
  for (const entity of ENTITY_ORDER) {
    const count = perEntity[entity];
    // 0 아닌 양의 정수 entity 만 라인으로 노출(0 / 비-정수는 생략 — 영향 없음으로 간주).
    if (typeof count === "number" && Number.isInteger(count) && count > 0) {
      lines.push(`  - ${entity}: ${count} row export`);
    }
  }
}

// range scope 의 dateRange 요약 — start/end 가 유효 Date 면 ISO 구간으로, 아니면 미지정 표기.
// 본 helper 는 §Out of Scope(select 의 dateRange 검증은 T-0437 책임)에 따라 dateRange 부재/
// 비정상을 throw 하지 않고 결과 라인에서 관대 처리한다(scope 한국어 표기는 항상 노출).
function describeDateRange(scope: ExportScope): string {
  const range = scope.dateRange;
  if (
    range &&
    range.start instanceof Date &&
    !Number.isNaN(range.start.getTime()) &&
    range.end instanceof Date &&
    !Number.isNaN(range.end.getTime())
  ) {
    return `, 기간 ${range.start.toISOString()} ~ ${range.end.toISOString()}`;
  }
  return ", 기간 미지정";
}

// partial scope 의 entitySelector 요약 — 비어있지 않은 배열이면 entity 목록을, 아니면 미지정
// 표기. dateRange 와 마찬가지로 select 검증(T-0437)은 §Out of Scope 라 throw 하지 않는다.
function describeEntitySelector(scope: ExportScope): string {
  const selector = scope.entitySelector;
  if (Array.isArray(selector) && selector.length > 0) {
    return `, 대상 ${selector.join(", ")}`;
  }
  return ", 대상 미지정";
}

// scopeLine 조립 — scope 한국어 표기 + range/partial 별 부가 요약(§8 (a) Audit scope 표시).
function buildScopeLine(scope: ExportScope): string {
  const label = SCOPE_LABELS[scope.scope];
  if (scope.scope === "range") {
    return `scope=${label}${describeDateRange(scope)}`;
  }
  if (scope.scope === "partial") {
    return `scope=${label}${describeEntitySelector(scope)}`;
  }
  // full → 부가 요약 없음(dateRange/entitySelector 무시 — §6.1).
  return `scope=${label}`;
}

// buildExportResult — 이미 산출된 ExportSelectionSummary(T-0449)와 ExportScope(T-0437)를 받아
// Export 직렬화 *이후* Admin 에게 보여줄 Export 완료 결과 메시지 모델을 순수 합성한다(UC-07 §5
// step 13 + §8 (a) 정합):
//   - headline — "다운로드 완료" + selected 핵심 row count 한 줄.
//   - exportedCounts — summary.selected/excluded 의 total 을 그대로 옮긴 요약 수치.
//   - impactLines — selected total 라인 + 0 아닌 perEntity 라인. excluded.total>0 면 제외 요약
//     라인 추가(full scope 의 excluded.total=0 은 제외 라인 생략 — §6.1).
//   - scopeLine — scope 한국어 표기 + range dateRange 요약 / partial entitySelector 요약.
//
// 입력 summary 객체 / 중첩 breakdown / perEntity map / instantRange 와 scope 객체 /
// entitySelector 배열을 변형하지 않고 새 객체·배열을 반환한다(non-mutating — freeze 된 입력으로
// 호출해도 통과). selected/excluded 가 모두 0 이거나 impactLines 가 비는 경계도 정상 처리한다
// (throw 0). 직렬화 전 안전을 위한 입력 방어:
//   - summary 가 plain object 아님(null / 배열 / 비-object) → TypeError.
//   - summary.selected / excluded 중 하나가 부재 / 비-object → TypeError(어느 그룹인지 명시).
//   - 그 total 이 0 이상 정수 아님(NaN / 소수 / 음수 / 비-number) → TypeError.
//   - 그 perEntity 가 부재 / 비-object → TypeError.
//   - scope 가 plain object 아님 → TypeError.
//   - scope.scope 가 "full" / "range" / "partial" 외 값(빈 문자열 / 대문자 / 숫자 / null) →
//     RangeError(허용 enum 위반은 RangeError, shape 위반은 TypeError 로 구분).
// happy-path 는 summarizeExportSelection 통과 summary + 검증된 scope 를 전제하므로 위 방어 분기는
// negative test 로 cover 한다.
export function buildExportResult(
  summary: ExportSelectionSummary,
  scope: ExportScope,
): ExportResult {
  // top-level summary 가 plain object 가 아니면 하위 그룹에 접근할 수 없어 즉시 throw.
  if (!isPlainObject(summary)) {
    throw new TypeError(
      `buildExportResult: summary 는 plain object 여야 합니다 (받음: ${describeNonObject(
        summary,
      )})`,
    );
  }

  const summarySource = summary as {
    selected?: unknown;
    excluded?: unknown;
  };
  assertGroupBreakdown(summarySource.selected, "selected");
  assertGroupBreakdown(summarySource.excluded, "excluded");

  // scope shape 방어 — 비-object 면 scope.scope 에 접근할 수 없어 TypeError.
  if (!isPlainObject(scope)) {
    throw new TypeError(
      `buildExportResult: scope 는 plain object 여야 합니다 (받음: ${describeNonObject(
        scope,
      )})`,
    );
  }

  // scope.scope 는 세 허용 값 외 거부 — 빈 문자열 / 대문자 "FULL" / 숫자 / null 등 모두 RangeError.
  const scopeKind = (scope as { scope?: unknown }).scope;
  if (typeof scopeKind !== "string" || !VALID_SCOPES.has(scopeKind)) {
    throw new RangeError(
      `buildExportResult: scope.scope 는 full/range/partial 중 하나여야 합니다 (받음: ${String(
        scopeKind,
      )})`,
    );
  }

  const selected = summarySource.selected as ExportSelectionGroupBreakdown;
  const excluded = summarySource.excluded as ExportSelectionGroupBreakdown;

  const headline = `다운로드 완료 — 선별 ${selected.total} row export`;

  const exportedCounts = {
    selected: selected.total,
    excluded: excluded.total,
  };

  // impactLines — selected total 라인 + 0 아닌 perEntity 라인. excluded.total>0 면 제외 요약
  // 라인 추가(full scope 의 excluded.total=0 은 제외 라인 생략 — §6.1).
  const impactLines: string[] = [];
  appendSelectedLines(impactLines, selected);
  if (excluded.total > 0) {
    impactLines.push(`제외 ${excluded.total} row`);
  }

  const scopeLine = buildScopeLine(scope as ExportScope);

  return {
    headline,
    exportedCounts,
    impactLines,
    scopeLine,
  };
}
