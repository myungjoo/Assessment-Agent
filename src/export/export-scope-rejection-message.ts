// export-scope-rejection-message — UC-07 Export scope payload 검증 실패 사람-친화 안내 메시지 조립
// 순수 helper (T-0463, P7 R-57 / REQ-030 / REQ-032 / REQ-045). T-0437 selectExportRecords →
// T-0438 buildExportDump → T-0439 checkSchemaVersionCompat → T-0440 validateImportDumpStructure →
// … → T-0444 validateExportScope → T-0458 buildVersionCompatMessage → T-0459
// buildDumpValidationMessage → T-0461 buildRestoreFailureMessage → T-0462 describeExportScope
// 다음의 게이트-free building block 이다. UC-07 §7.3 은 Export 의 scope 옵션 / dateRange /
// entitySelector 가 부적합할 때 transaction(query 실행) 전 400 + 검증 메시지 reject + WebUI 가
// 그것을 form field-level error 로 표시함을 박제한다. T-0444 validateExportScope 가 그 사전 검증을
// 구조화 verdict ExportScopeValidation{ valid, errors: ExportScopeError[], normalized? } 로
// 산출했으나, 그 errors[] 는 { field, message } 쌍의 진단용 누적 배열일 뿐 — §7.3 이 명시한 사람이
// 읽을 reject headline + field 별로 묶은 안내 + 재입력 actionable guidance + blocking flag 를 담은
// 메시지 모델은 0 회 cover 된 gap 이다.
//
// 본 helper 는 이미 산출된 ExportScopeValidation verdict 를 입력으로 받아(재실행·재검증 0 — 순수 DRY
// 합성) 한국어 headline + field 별로 묶은 detailLines + 재입력 actionable guidance + blocking flag 를
// 담은 단일 메시지 모델 ExportScopeRejectionMessage 를 조립한다. 이는 Import 입구의 §7.4 dump 구조
// reject 안내 buildDumpValidationMessage(T-0459, DumpValidationMessage) 의 Export 입구 측(§7.3 scope
// payload reject) 대칭이며, T-0453 buildRestoreConfirmation / T-0455 buildRestoreResult / T-0458
// buildVersionCompatMessage / T-0459 buildDumpValidationMessage / T-0461 buildRestoreFailureMessage
// 가 확립한 "구조화 verdict → 사람-친화 메시지 모델" 패턴의 §7.3 Export 입구 측 적용이다.
// persistence / repository / transaction / DB / REST / scope 재검증 호출 0, 새 외부 dependency 0,
// 새 도메인 타입은 ExportScopeRejectionMessage 만 신설(ExportScopeValidation / ExportScopeError
// 재사용). validateExportScope(T-0444) 산출 로직 재구현 0 — 본 helper 는 입력으로만 받는다(DRY).
// 코드 골격은 import-dump-validate-message.ts(T-0459) 의 순수-helper 패턴(plain 모델 interface +
// isPlainObject·describe 입력 방어 + 한국어 TypeError/RangeError convention + non-mutating +
// blocking === !valid 불변)을 mirror 한다. REQ-032(raw 미저장)는 scope verdict 만 다루고 record /
// raw 를 새로 fetch 하지 않으므로 helper layer 에서 자연 유지된다.
import {
  ExportScopeError,
  ExportScopeValidation,
} from "./export-scope-validate";

// field 별 묶음 detailLine 의 사람-친화 라벨 + 출력 순서 source-of-truth. ExportScopeError.field
// union("scope" | "dateRange" | "entitySelector") 을 mirror 하며, §7.3 form field-level error 가
// scope → dateRange → entitySelector 순으로 묶여 표시되도록 순서를 박제한다.
const FIELD_ORDER: ReadonlyArray<ExportScopeError["field"]> = [
  "scope",
  "dateRange",
  "entitySelector",
];

const FIELD_LABEL: Readonly<Record<ExportScopeError["field"], string>> = {
  scope: "scope 옵션",
  dateRange: "기간(dateRange)",
  entitySelector: "대상 선택(entitySelector)",
};

// 조립된 사람-친화 Export scope 검증 안내 메시지 모델 — plain object. headline 은 valid 분기별
// 한국어 한 줄(valid=true 는 검증 통과, valid=false 는 부적합 field 개수 요약 reject), detailLines
// 는 valid=true 면 확인 라인, valid=false 면 errors 를 field 별로 묶은 사람-친화 안내(scope →
// dateRange → entitySelector 순, 원본 message 보존) + 재입력 actionable 라인, blocking 은 "사용자가
// 진행 전 반드시 해소해야 하는가"(reject 만 true). blocking === !validation.valid 불변. 후속 WebUI
// form field-level error 컴포넌트(P6)가 이 모델을 그대로 렌더한다.
export interface ExportScopeRejectionMessage {
  headline: string;
  detailLines: string[];
  blocking: boolean;
}

// plain object(null / 배열 / 비-object 아님) 판정 — top-level validation 입력 방어에 쓴다.
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

// 단일 error 원소가 사람-친화 노출 가능한 형태인지 판정 — field 가 union 멤버이고 message 가
// string 일 때만 정상으로 본다. 깨진 원소(비-object / field union 외 / message 비-string)는
// 본 판정에서 false 가 되어 fallback 라인으로 노출된다(throw 0 — §7.3 verdict 합성은 graceful).
function isWellFormedError(value: unknown): value is ExportScopeError {
  if (!isPlainObject(value)) {
    return false;
  }
  const field = value.field;
  const message = value.message;
  return (
    typeof field === "string" &&
    (FIELD_ORDER as ReadonlyArray<string>).includes(field) &&
    typeof message === "string"
  );
}

// buildExportScopeRejection — 이미 산출된 ExportScopeValidation(T-0444)을 받아 사람-친화 Export
// scope 검증 안내 메시지 모델을 순수 합성한다(UC-07 §7.3 정합):
//   - valid=true — 검증 통과 headline + 확인 detailLine + blocking=false.
//   - valid=false — 부적합 field 개수 요약 reject headline + errors 를 field 별로 묶은 사람-친화
//     detailLines(scope → dateRange → entitySelector 순, 원본 message 보존) + "scope 옵션을 수정해
//     다시 시도하세요" 취지 재입력 actionable 라인 + blocking=true.
// 입력 validation 객체 / 중첩 errors 배열을 변형하지 않고 새 객체·배열을 반환한다(non-mutating —
// freeze 된 validation/errors 로 호출해도 통과). blocking === !validation.valid 불변을 유지한다.
// 깨진 error 원소(비-object / field union 외 / message 비-string)는 throw 하지 않고 fallback
// 라인으로 graceful 노출한다(verdict 합성은 reject 안내가 목적이므로 입력 진단 잡음에 강건).
// 배선 전 안전을 위한 입력 방어:
//   - validation 이 plain object 아님(null / 배열 / 비-object) → TypeError.
//   - validation.valid 가 비-boolean → TypeError.
//   - validation.errors 가 비-array → TypeError.
//   - valid=false 인데 errors 가 빈 배열인 비정상 verdict(reject 인데 사유 0 은 모순) → RangeError.
// valid=true 인데 errors 가 비어있지 않은 경계 입력은 verdict 의 valid 분기만 신뢰해 통과 메시지로
// 처리하고 errors 는 무시한다(helper 는 검증을 재계산하지 않는다 — import 측 대칭 정책).
export function buildExportScopeRejection(
  validation: ExportScopeValidation,
): ExportScopeRejectionMessage {
  // top-level validation 이 plain object 가 아니면 하위 필드에 접근할 수 없어 즉시 throw.
  if (!isPlainObject(validation)) {
    throw new TypeError(
      `buildExportScopeRejection: validation 은 plain object 여야 합니다 (받음: ${describe(
        validation,
      )})`,
    );
  }

  const source = validation as Partial<ExportScopeValidation>;

  // valid 검증 — 비-boolean(null / 숫자 / 문자열 등) 거부.
  const valid = source.valid;
  if (typeof valid !== "boolean") {
    throw new TypeError(
      `buildExportScopeRejection: validation.valid 는 boolean 이어야 합니다 (받음: ${describe(
        valid,
      )})`,
    );
  }

  // errors 검증 — 배열 아님(null / object / 문자열 등) 거부.
  const errors = source.errors;
  if (!Array.isArray(errors)) {
    throw new TypeError(
      `buildExportScopeRejection: validation.errors 는 배열이어야 합니다 (받음: ${describe(
        errors,
      )})`,
    );
  }

  // valid=false 인데 errors 가 빈 배열이면 "reject 인데 사유 0" 모순 verdict — 호출측 배선
  // 버그로 보아 RangeError.
  if (!valid && errors.length === 0) {
    throw new RangeError(
      `buildExportScopeRejection: valid=false 인데 errors 가 비어 있습니다 ` +
        `(reject 사유가 0 인 verdict 는 모순입니다)`,
    );
  }

  // blocking 은 valid 가 false(reject) 일 때만 true — valid=true 는 진행 가능(불변 유지).
  const blocking = !valid;

  if (valid) {
    return {
      headline: "scope 검증 통과 — 입력한 Export 범위로 진행할 수 있습니다",
      detailLines: [
        "scope / 기간 / 대상 선택 검증을 통과하여 Export 를 진행할 수 있습니다",
      ],
      blocking,
    };
  }

  // valid=false — field 별로 errors 를 묶어 사람-친화 안내를 조립한다. 먼저 깨진 원소를
  // 분리하고(graceful — throw 0), 정상 원소를 field 기준으로 group 한다.
  const grouped = new Map<ExportScopeError["field"], string[]>();
  const malformed: string[] = [];
  for (let index = 0; index < errors.length; index += 1) {
    const entry = errors[index];
    if (isWellFormedError(entry)) {
      const bucket = grouped.get(entry.field);
      if (bucket) {
        bucket.push(entry.message);
      } else {
        grouped.set(entry.field, [entry.message]);
      }
    } else {
      malformed.push(describe(entry));
    }
  }

  // headline — 부적합 field 개수 요약. group 된 정상 field 수 + 깨진 원소 1 종(있으면)을 합산해
  // "N 개 항목" 으로 요약한다(원본 errors 길이가 아니라 사람이 고쳐야 할 묶음 단위).
  const affectedCount = grouped.size + (malformed.length > 0 ? 1 : 0);
  const headline = `Export scope 검증 실패 — ${affectedCount}개 항목을 수정해야 합니다`;

  const detailLines: string[] = [];
  // FIELD_ORDER 고정 순서(scope → dateRange → entitySelector)로 묶음 detailLine 노출 — 각 field
  // 의 누적 message 를 원본 그대로 보존해 합친다.
  for (let i = 0; i < FIELD_ORDER.length; i += 1) {
    const field = FIELD_ORDER[i];
    const messages = grouped.get(field);
    if (messages && messages.length > 0) {
      detailLines.push(`[${FIELD_LABEL[field]}] ${messages.join(" / ")}`);
    }
  }
  // 깨진 error 원소가 있으면 fallback 라인으로 별도 노출(throw 0).
  if (malformed.length > 0) {
    detailLines.push(
      `[알 수 없는 항목] 형식이 올바르지 않은 검증 결과 ${malformed.length}건이 포함되어 있습니다`,
    );
  }
  // 재입력 actionable guidance.
  detailLines.push("위 scope 옵션을 수정해 다시 시도하세요");
  detailLines.push("검증을 통과하기 전에는 Export 가 시작되지 않습니다");

  return {
    headline,
    detailLines,
    blocking,
  };
}
