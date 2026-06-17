// import-dump-validate-message — UC-07 Import dump 구조 검증 실패 사람-친화 안내 메시지 조립 순수
// helper (T-0459, P7 R-57 / REQ-030 / REQ-032). T-0437 selectExportRecords → T-0438 buildExportDump
// → T-0439 checkSchemaVersionCompat → T-0440 validateImportDumpStructure → … → T-0453
// buildRestoreConfirmation → T-0454 formatAuditLogLine → T-0455 buildRestoreResult → T-0456
// buildExportResult → T-0458 buildVersionCompatMessage 다음의 게이트-free building block 이다.
// UC-07 §7.4 는 업로드된 file 이 본 시스템 dump 포맷이 아니거나 partial corruption 일 때 transaction
// 시작 전 reject(DB 변경 0) + 사용자에게 file 재확인 안내를 박제한다. T-0440
// validateImportDumpStructure 가 그 구조 무결성 판정을 구조화 verdict ImportDumpValidation{valid,
// issues: string[]} 로 산출했으나, 그 issues[] 는 "recordCount !== records.length" 같은 진단용
// terse 문자열의 누적 배열일 뿐 — §7.4 가 명시한 사람이 읽을 reject headline + 재확인 actionable
// guidance + blocking flag 를 담은 메시지 모델은 0 회 cover 된 gap 이다.
//
// 본 helper 는 이미 산출된 ImportDumpValidation verdict 를 입력으로 받아(재실행 0 — 순수 DRY 합성)
// 한국어 headline + 부가 detailLines(누적 issues 를 사람-친화로 노출) + 후속 권고(file 재확인
// actionable guidance) + blocking flag 를 담은 단일 메시지 모델 DumpValidationMessage 를 조립한다.
// 이는 T-0453 buildRestoreConfirmation / T-0454 formatAuditLogLine / T-0455 buildRestoreResult /
// T-0456 buildExportResult / T-0458 buildVersionCompatMessage 가 확립한 "구조화 verdict → 사람-친화
// 메시지 모델" 패턴의 Import 구조-gate(§7.4) 측 적용이다. persistence / repository / transaction / DB /
// REST / file-parse / 무결성 hash 재검증 호출 0, 새 외부 dependency 0, 새 도메인 타입은
// DumpValidationMessage 만 신설(ImportDumpValidation 재사용). validateImportDumpStructure(T-0440)
// 산출 로직 재구현 0 — 본 helper 는 입력으로만 받는다(DRY). 코드 골격은 schema-version-message.ts
// (T-0458) / import-restore-confirmation.ts(T-0453) 의 순수-helper 패턴(plain 모델 interface +
// isPlainObject·assert 입력 방어 + 한국어 TypeError 메시지 convention + non-mutating)을 mirror
// 한다. REQ-032(raw 미저장)는 구조 verdict 만 다루고 raw 를 새로 fetch 하지 않으므로 helper layer
// 에서 자연 유지된다.
import { ImportDumpValidation } from "./import-dump-validate";

// 조립된 사람-친화 dump 구조 검증 안내 메시지 모델 — plain object. headline 은 valid 분기별
// 한국어 한 줄(valid=true 는 무결성 확인, valid=false 는 file 손상/포맷 불일치 reject), detailLines
// 는 valid=true 면 확인 라인, valid=false 면 누적 issues 를 사람-친화로 노출(원본 순서 유지) +
// file 재확인 actionable 라인, blocking 은 "사용자가 진행 전 반드시 해소해야 하는가"(reject 만
// true). blocking === !validation.valid 불변. 후속 WebUI 구조-gate 컴포넌트 / form field-level
// error(P6)가 이 모델을 그대로 렌더한다.
export interface DumpValidationMessage {
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

// buildDumpValidationMessage — 이미 산출된 ImportDumpValidation(T-0440)을 받아 사람-친화 dump 구조
// 검증 안내 메시지 모델을 순수 합성한다(UC-07 §7.4 정합):
//   - valid=true — 구조 무결성 확인 headline + 확인 detailLine + blocking=false.
//   - valid=false — file 손상/포맷 불일치 reject headline + 누적 issues 를 사람-친화 detailLines 로
//     노출(원본 순서 유지) + "file 재확인 후 재업로드" actionable 라인 + blocking=true.
// 입력 validation 객체/배열을 변형하지 않고 새 객체·배열을 반환한다(non-mutating — freeze 된
// validation/issues 로 호출해도 통과). blocking === !validation.valid 불변을 유지한다.
// transaction/배선 전 안전을 위한 입력 방어:
//   - validation 이 plain object 아님(null / 배열 / 비-object) → TypeError.
//   - validation.valid 가 비-boolean → TypeError.
//   - validation.issues 가 비-array → TypeError.
//   - valid=false 인데 issues 가 빈 배열인 비정상 verdict(reject 인데 사유 0 은 모순) → RangeError.
// happy-path 는 validateImportDumpStructure 통과 verdict 를 전제하므로 위 방어 분기는 negative
// test 로 cover 한다.
export function buildDumpValidationMessage(
  validation: ImportDumpValidation,
): DumpValidationMessage {
  // top-level validation 이 plain object 가 아니면 하위 필드에 접근할 수 없어 즉시 throw.
  if (!isPlainObject(validation)) {
    throw new TypeError(
      `buildDumpValidationMessage: validation 은 plain object 여야 합니다 (받음: ${describe(
        validation,
      )})`,
    );
  }

  const source = validation as Partial<ImportDumpValidation>;

  // valid 검증 — 비-boolean(null / 숫자 / 문자열 등) 거부.
  const valid = source.valid;
  if (typeof valid !== "boolean") {
    throw new TypeError(
      `buildDumpValidationMessage: validation.valid 는 boolean 이어야 합니다 (받음: ${describe(
        valid,
      )})`,
    );
  }

  // issues 검증 — 배열 아님(null / object / 문자열 등) 거부.
  const issues = source.issues;
  if (!Array.isArray(issues)) {
    throw new TypeError(
      `buildDumpValidationMessage: validation.issues 는 배열이어야 합니다 (받음: ${describe(
        issues,
      )})`,
    );
  }

  // valid=false 인데 issues 가 빈 배열이면 "reject 인데 사유 0" 모순 verdict — 호출측 배선
  // 버그로 보아 RangeError.
  if (!valid && issues.length === 0) {
    throw new RangeError(
      `buildDumpValidationMessage: valid=false 인데 issues 가 비어 있습니다 ` +
        `(reject 사유가 0 인 verdict 는 모순입니다)`,
    );
  }

  // blocking 은 valid 가 false(reject) 일 때만 true — valid=true 는 진행 가능(불변 유지).
  const blocking = !valid;

  let headline: string;
  const detailLines: string[] = [];

  if (valid) {
    headline = `dump 구조 무결성 확인 — 업로드 file 을 그대로 복원할 수 있습니다`;
    detailLines.push(
      "dump 포맷·레코드 구조 검증을 통과하여 복원을 진행할 수 있습니다",
    );
  } else {
    headline = `dump 파일 손상 또는 포맷 불일치 — 이 file 은 복원할 수 없습니다`;
    // 누적 issues 를 원본 순서 그대로 사람-친화 detailLine 으로 노출(원소 변형 0).
    for (let index = 0; index < issues.length; index += 1) {
      detailLines.push(`확인된 문제: ${issues[index]}`);
    }
    detailLines.push("file 을 다시 확인한 뒤 올바른 dump 를 재업로드하세요");
    detailLines.push("구조 검증을 통과하기 전에는 복원이 시작되지 않습니다");
  }

  return {
    headline,
    detailLines,
    blocking,
  };
}
