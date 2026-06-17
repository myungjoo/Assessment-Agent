// export-scope-description — UC-07 Export scope 선택 사람-친화 설명 메시지 조립 순수 helper
// (T-0462, P7 R-57 / REQ-030 / REQ-032 / REQ-045). T-0437 selectExportRecords / T-0444
// validateExportScope / T-0449 summarizeExportSelection / T-0456 buildExportResult 까지의
// Export building block 은 scope 를 분류·검증·결과 요약까지만 cover 했으나, 사용자가 Export 를
// 확정하기 *전에* "내가 무엇을 내보내는지" 를 dialog 에 표시할 설명 모델로 조립하는 helper 는
// 0 회 cover 된 gap 이다. 본 helper 는 Import 측 buildRestoreConfirmation(T-0453,
// RestorePlanSummary → 강한 confirmation 모델) 의 Export 측 대칭이다 — Export 는 read-only
// (UC-07 §8 (a) DB 무변화) 라 destructive 경고는 없고, 선택 scope 의 범위(전체/기간/entity 한정)
// 를 dialog 에 보여줄 설명 모델만 산출한다.
//
// describeExportScope(scope, options?) 는 ExportScope(T-0437 의 scope / dateRange /
// entitySelector) 를 입력으로 받아(실 DB query · 직렬화 · REST · UI 배선 0 — 순수 합성·재실행 0)
// {headline, scopeKind, scopeLine, dateRangeLine?, entityLines[], readOnly} 의
// ExportScopeDescription 을 조립한다. persistence / repository / REST 배선 호출 0, 새 외부
// dependency 0, 새 도메인 타입은 ExportScopeDescription 만 신설(ExportScope / ExportEntity /
// PeriodRange 재사용). 코드 골격은 import-restore-confirmation.ts 의 순수-helper 패턴(plain 모델
// interface + 한국어 TypeError/RangeError 입력 방어 + non-mutating + freeze 된 입력 통과)을
// mirror 한다. REQ-032(raw 미저장)는 입력 scope 만 다뤄 raw 를 새로 fetch 하지 않으므로 helper
// layer 에서 자연 유지된다.
import { PeriodRange } from "../common/period-boundary";

import {
  ExportEntity,
  ExportScope,
  VALID_EXPORT_ENTITIES,
  VALID_EXPORT_SCOPES,
} from "./export-scope-select";

// Export scope 설명 dialog 메시지 모델 — plain object. headline 은 scope 종류를 담은 한국어 한
// 줄, scopeKind 는 입력 scope 의 종류(full/range/partial — 분기 식별 key), scopeLine 은 무엇을
// 내보내는지의 한국어 한 줄 설명, dateRangeLine 은 range scope 일 때만 채워지는 기간 라인
// (start/end ISO), entityLines 는 대상 entity 의 사람-친화 라벨 라인 목록(full → 5 entity 전체,
// partial → 선택 entity 만, range → 5 entity 전체), readOnly 는 Export 가 DB 를 변경하지 않음
// (§8 (a)) 을 나타내는 불변 true 다. 후속 WebUI scope 옵션 dialog(P6)가 이 모델을 그대로 렌더한다.
export interface ExportScopeDescription {
  headline: string;
  scopeKind: ExportScope["scope"];
  scopeLine: string;
  dateRangeLine?: string;
  entityLines: string[];
  readOnly: true;
}

// 허용 scope 집합 — 입력 방어에서 이 집합 밖의 값은 호출측 배선 버그로 본다.
const VALID_SCOPES: ReadonlySet<string> = new Set(VALID_EXPORT_SCOPES);

// 허용 entity 집합 — entitySelector 멤버십 검증에 쓴다.
const VALID_ENTITIES: ReadonlySet<ExportEntity> = new Set(
  VALID_EXPORT_ENTITIES,
);

// entity 라인 작성 순서 — ExportEntity 5-union 과 동일 집합·고정 순서(라인 결정성 보장).
const ENTITY_ORDER: ReadonlyArray<ExportEntity> = VALID_EXPORT_ENTITIES;

// entity 별 사람-친화 한국어 라벨 — entityLines 작성에 쓴다.
const ENTITY_LABELS: Record<ExportEntity, string> = {
  Assessment: "평가 결과",
  Person: "인원 master",
  Group: "Group",
  LlmConfig: "LLM 설정",
  AuditLog: "Audit log",
};

// scope 종류별 사람-친화 한국어 라벨 — headline 작성에 쓴다.
const SCOPE_LABELS: Record<ExportScope["scope"], string> = {
  full: "전체",
  range: "기간 한정",
  partial: "entity 한정",
};

// plain object(null / 배열 / 비-object 아님) 판정 — top-level scope 입력 방어에 쓴다.
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Invalid Date / 비-Date 입력은 명시적 error(export-scope-select / period-boundary 의
// assertValidDate message convention 과 동형). dateRange.start/end 검증에 쓴다.
function assertValidDate(value: unknown, label: string): asserts value is Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError(
      `describeExportScope: ${label} 은(는) 유효한 Date instance 여야 합니다`,
    );
  }
}

// range scope 의 dateRange 검증 — start/end 가 유효 Date 인지(TypeError) + 반열림 구간이
// 비어있지 않은지(start < end, RangeError). start >= end(역전/빈 구간)는 설명할 대상이 없으므로
// 호출자 오류로 거부한다(selectExportRecords.assertValidRange 동형).
function assertValidRange(range: PeriodRange): void {
  assertValidDate(range?.start, "dateRange.start");
  assertValidDate(range?.end, "dateRange.end");
  if (range.start.getTime() >= range.end.getTime()) {
    throw new RangeError(
      `describeExportScope: dateRange 는 start < end 인 반열림 구간이어야 합니다 ` +
        `(start=${range.start.toISOString()}, end=${range.end.toISOString()})`,
    );
  }
}

// 한 entity 의 사람-친화 라인 작성 — "  - 평가 결과 (Assessment)" 형태. 라벨 + 식별자를 함께
// 담아 사람·기계 모두 읽기 쉽게 한다.
function entityLine(entity: ExportEntity): string {
  return `  - ${ENTITY_LABELS[entity]} (${entity})`;
}

// describeExportScope — 검증 통과한 ExportScope 를 받아 Export scope 옵션 dialog 의 설명 메시지
// 모델을 순수 합성한다(UC-07 §5 step 2 + §6.1 + §8 (a) 정합):
//   - scope "full"    → headline(전체) + scopeLine(전체 entity · 전 기간) + dateRangeLine 부재 +
//                       entityLines 는 5 entity 전체. readOnly=true.
//   - scope "range"   → dateRange(start/end)를 ISO 로 담은 dateRangeLine 생성 + entityLines 는
//                       5 entity 전체(range 는 기간만 한정, entity 는 전체). dateRange 부재 →
//                       RangeError, start>=end → RangeError, start/end 비-Date/Invalid → TypeError.
//   - scope "partial" → entitySelector 의 선택 entity 만 사람-친화 라벨 entityLines 로 표시.
//                       entitySelector 부재/빈 배열 → RangeError(모호 상태 거부), 허용 외 entity
//                       섞임 → RangeError(거부 정책 — silent 무시 금지로 의도 어긋남을 조기 노출).
//
// 입력 scope 객체 / 중첩 dateRange / entitySelector 배열을 변형하지 않고 새 객체·배열을 반환한다
// (non-mutating — freeze 된 scope 로 호출해도 통과). options.now 는 향후 "현재 시점 기준" 표시
// 확장 여지를 위한 자리로, 미지정 시 new Date() fallback(현재 동작은 now 를 라인에 노출하지
// 않으나 입력 방어 일관성을 위해 받는다). dialog 표시 전 안전을 위한 입력 방어:
//   - scope 가 plain object 아님(null / 배열 / 비-object) → TypeError.
//   - scope.scope 가 full/range/partial 외 값 → RangeError.
//   - range 인데 dateRange 부재 / start>=end → RangeError, start/end Invalid → TypeError.
//   - partial 인데 entitySelector 부재/빈 배열 / 허용 외 entity 섞임 → RangeError.
export function describeExportScope(
  scope: ExportScope,
  options?: { now?: Date },
): ExportScopeDescription {
  // top-level scope 가 plain object 가 아니면 하위 필드에 접근할 수 없어 즉시 throw.
  if (!isPlainObject(scope)) {
    throw new TypeError(
      `describeExportScope: scope 는 plain object 여야 합니다 (받음: ${
        scope === null ? "null" : Array.isArray(scope) ? "array" : typeof scope
      })`,
    );
  }

  // scope.scope 는 허용 3 종 외 거부 — 빈 문자열 / 대문자 / 숫자 등 모두 RangeError
  // (selectExportRecords 와 동형 — scope 종류는 RangeError 로 거부).
  const kind = (scope as { scope?: unknown }).scope;
  if (typeof kind !== "string" || !VALID_SCOPES.has(kind)) {
    throw new RangeError(
      `describeExportScope: scope 는 full/range/partial 중 하나여야 합니다 (받음: ${String(
        kind,
      )})`,
    );
  }
  const scopeKind = kind as ExportScope["scope"];

  // options.now 는 향후 확장용 — 미지정 시 fallback. 지정 시 유효 Date 인지 방어(라인에 직접
  // 노출하진 않으나 잘못된 입력을 조기 거부해 호출측 배선 버그를 드러낸다).
  const now = options?.now ?? new Date();
  assertValidDate(now, "options.now");

  const scopeLabel = SCOPE_LABELS[scopeKind];
  const headline = `Export 범위: ${scopeLabel}`;

  let scopeLine: string;
  let dateRangeLine: string | undefined;
  let entityLines: string[];

  if (scopeKind === "full") {
    // full → 전체 entity · 전 기간. dateRangeLine 부재, entityLines 는 5 entity 전체.
    scopeLine = "전체 entity 를 전 기간에 걸쳐 내보냅니다";
    entityLines = ENTITY_ORDER.map(entityLine);
  } else if (scopeKind === "range") {
    // range → dateRange [start, end) 검증 후 ISO 라인 생성. entity 는 전체(기간만 한정).
    if (!scope.dateRange) {
      throw new RangeError(
        "describeExportScope: scope=range 에는 dateRange 가 필요합니다",
      );
    }
    assertValidRange(scope.dateRange);
    const startIso = scope.dateRange.start.toISOString();
    const endIso = scope.dateRange.end.toISOString();
    scopeLine = "지정 기간에 해당하는 전체 entity 를 내보냅니다";
    dateRangeLine = `기간: ${startIso} ~ ${endIso} (반열림 [start, end))`;
    entityLines = ENTITY_ORDER.map(entityLine);
  } else {
    // partial → entitySelector 의 선택 entity 만. 부재/빈 배열은 모호 상태라 거부.
    const selector = scope.entitySelector;
    if (!Array.isArray(selector) || selector.length === 0) {
      throw new RangeError(
        "describeExportScope: scope=partial 에는 비어있지 않은 entitySelector 가 필요합니다",
      );
    }
    // 허용 외 entity 가 섞이면 거부(silent 무시 금지 — 호출측 의도 어긋남을 조기 노출).
    for (const entity of selector) {
      if (!VALID_ENTITIES.has(entity)) {
        throw new RangeError(
          `describeExportScope: entitySelector 에 허용 외 entity 가 있습니다 (받음: ${String(
            entity,
          )})`,
        );
      }
    }
    // 선택 entity 만 라벨 라인으로 — ENTITY_ORDER 순서로 정렬해 라인 결정성을 보장하되,
    // selector 에 든 것만 노출(중복은 자연 dedup).
    const selectedSet = new Set(selector);
    const selected = ENTITY_ORDER.filter((entity) => selectedSet.has(entity));
    scopeLine = `선택한 ${selected.length} 개 entity 만 내보냅니다`;
    entityLines = selected.map(entityLine);
  }

  return {
    headline,
    scopeKind,
    scopeLine,
    ...(dateRangeLine !== undefined ? { dateRangeLine } : {}),
    entityLines,
    readOnly: true,
  };
}
