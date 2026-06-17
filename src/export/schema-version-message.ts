// schema-version-message — UC-07 Import schema version 호환 판정 사람-친화 안내 메시지 조립 순수
// helper (T-0458, P7 R-57 / REQ-030 / REQ-032). T-0437 selectExportRecords → T-0438 buildExportDump
// → T-0439 checkSchemaVersionCompat → T-0440 validateImportDumpStructure → … → T-0453
// buildRestoreConfirmation → T-0454 formatAuditLogLine → T-0455 buildRestoreResult → T-0456
// buildExportResult 다음의 게이트-free building block 이다. UC-07 §6.3 은 업로드된 dump 의 schema
// version 이 현재 시스템 version 과 다를 때 (i) 자동 migration 후보 또는 (ii) reject + 사용자에게
// version mismatch 안내(default)를 박제한다. T-0439 checkSchemaVersionCompat 가 그 호환 판정을
// 구조화 verdict SchemaVersionCompat{compatible, action, uploadedVersion, currentVersion, reason?}
// 로 산출했으나, §6.3 (ii) 가 명시한 "사용자에게 version mismatch 안내"(사람이 읽을 메시지) +
// §6.3 (i) migrate 후보 안내 + accept 확인 문구는 0 회 cover 된 gap 이다 — reason 필드는
// "schema version mismatch: <u> ≠ <c>" 같은 terse machine 문자열일 뿐 WebUI / form field-level
// error 가 그대로 표시할 사람-친화 모델이 아니다.
//
// 본 helper 는 이미 산출된 SchemaVersionCompat verdict 를 입력으로 받아(재실행 0 — 순수 DRY 합성)
// 한국어 headline + 부가 detailLines + action + blocking 을 담은 단일 메시지 모델
// VersionCompatMessage 를 조립한다. 이는 T-0453 buildRestoreConfirmation / T-0454 formatAuditLogLine
// / T-0455 buildRestoreResult / T-0456 buildExportResult 가 확립한 "구조화 verdict → 사람-친화
// 메시지 모델" 패턴의 Import version-gate 측 적용이다. persistence / repository / transaction / DB /
// REST / file-parse / 실 migration 호출 0, 새 외부 dependency 0, 새 도메인 타입은
// VersionCompatMessage 만 신설(SchemaVersionCompat 재사용). checkSchemaVersionCompat(T-0439) 산출
// 로직 재구현 0 — 본 helper 는 입력으로만 받는다(DRY). 코드 골격은 export-import-audit-message.ts
// (T-0454) / import-restore-confirmation.ts(T-0453) 의 순수-helper 패턴(plain 모델 interface +
// isPlainObject·assert 입력 방어 + 한국어 TypeError 메시지 convention + non-mutating)을 mirror
// 한다. REQ-032(raw 미저장)는 version string / metadata 만 다뤄 raw 를 새로 fetch 하지 않으므로
// helper layer 에서 자연 유지된다.
import { SchemaVersionCompat } from "./schema-version-compat";

// 조립된 사람-친화 schema version 호환 안내 메시지 모델 — plain object. headline 은 action 분기별
// 한국어 한 줄, detailLines 는 uploaded→current version 노출 + 후속 권고 라인 배열, action 은 입력
// verdict 의 action 그대로(렌더 분기용), blocking 은 "사용자가 진행 전 반드시 해소해야 하는가"
// (reject 만 true — accept/migrate 는 후속 결정 위임). blocking === (action === "reject") 불변.
// 후속 WebUI version-gate 컴포넌트 / form field-level error(P6)가 이 모델을 그대로 렌더한다.
export interface VersionCompatMessage {
  headline: string;
  detailLines: string[];
  action: "accept" | "migrate" | "reject";
  blocking: boolean;
}

// 허용 action 집합 — SchemaVersionCompat.action 3-union 과 동일. 입력 방어에서 이 집합 밖의 값은
// 호출측 배선 버그로 보아 RangeError.
const VALID_ACTIONS: ReadonlySet<string> = new Set([
  "accept",
  "migrate",
  "reject",
]);

// plain object(null / 배열 / 비-object 아님) 판정 — top-level compat 입력 방어에 쓴다.
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

// 비어있지 않은 schema version string 검증 — 비-string / 빈 문자열 / 공백만이면 TypeError(어느
// 필드인지 label 로 명시). schema-version-compat.ts 의 assertVersionString 과 동형 convention.
function assertVersionString(
  value: unknown,
  label: string,
): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(
      `buildVersionCompatMessage: ${label} 은(는) 비어있지 않은 schemaVersion string 이어야 합니다 ` +
        `(받음: ${typeof value === "string" ? `"${value}"` : describe(value)})`,
    );
  }
}

// buildVersionCompatMessage — 이미 산출된 SchemaVersionCompat(T-0439)를 받아 사람-친화 schema
// version 호환 안내 메시지 모델을 순수 합성한다(UC-07 §6.3 정합):
//   - accept — 호환 확인 headline + uploaded/current version 라인 + "그대로 복원 가능" 안내,
//     blocking=false.
//   - migrate — 자동 migration 후보 headline + uploaded→current 변환 라인 + "migration 진행 여부
//     결정 필요" 후속 안내(§6.3 (i)), blocking=false(후속 결정 위임).
//   - reject — version mismatch 거부 headline(§6.3 (ii)) + uploaded/current 라인 + "맞는 version
//     dump 재업로드 / 자동 migration 미지원" 재확인 안내, blocking=true.
// 입력 compat 객체를 변형하지 않고 새 객체·배열을 반환한다(non-mutating — freeze 된 compat 으로
// 호출해도 통과). blocking === (compat.action === "reject") 불변을 유지한다. transaction/배선 전
// 안전을 위한 입력 방어:
//   - compat 가 plain object 아님(null / 배열 / 비-object) → TypeError.
//   - compat.action 이 "accept" / "migrate" / "reject" 외 → RangeError.
//   - compat.uploadedVersion / currentVersion 이 비-string · 빈 문자열 · 공백만 → TypeError.
// happy-path 는 checkSchemaVersionCompat 통과 verdict 를 전제하므로 위 방어 분기는 negative test
// 로 cover 한다.
export function buildVersionCompatMessage(
  compat: SchemaVersionCompat,
): VersionCompatMessage {
  // top-level compat 가 plain object 가 아니면 하위 필드에 접근할 수 없어 즉시 throw.
  if (!isPlainObject(compat)) {
    throw new TypeError(
      `buildVersionCompatMessage: compat 는 plain object 여야 합니다 (받음: ${describe(
        compat,
      )})`,
    );
  }

  const source = compat as Partial<SchemaVersionCompat>;

  // action 검증 먼저 — 분기 진입 전 거부(대소문자 mismatch / null / 숫자 모두 reject).
  const action = source.action;
  if (typeof action !== "string" || !VALID_ACTIONS.has(action)) {
    throw new RangeError(
      `buildVersionCompatMessage: compat.action 은 accept/migrate/reject 중 하나여야 합니다 ` +
        `(받음: ${String(action)})`,
    );
  }

  // version string 검증 — 비-string / 빈 문자열 / 공백만이면 TypeError.
  assertVersionString(source.uploadedVersion, "uploadedVersion");
  assertVersionString(source.currentVersion, "currentVersion");

  const uploadedVersion = source.uploadedVersion as string;
  const currentVersion = source.currentVersion as string;

  // blocking 은 reject 일 때만 true — accept/migrate 는 후속 결정 위임(불변 유지).
  const blocking = action === "reject";

  let headline: string;
  const detailLines: string[] = [];

  if (action === "accept") {
    headline = `schema version 호환 확인 — 업로드 dump 를 그대로 복원할 수 있습니다`;
    detailLines.push(`업로드 version: ${uploadedVersion}`);
    detailLines.push(`현재 시스템 version: ${currentVersion}`);
    detailLines.push("두 version 이 일치하여 추가 변환 없이 진행 가능합니다");
  } else if (action === "migrate") {
    headline = `schema version 차이 — 자동 migration 후보입니다`;
    detailLines.push(`업로드 version: ${uploadedVersion}`);
    detailLines.push(`현재 시스템 version: ${currentVersion}`);
    detailLines.push(
      `${uploadedVersion} → ${currentVersion} 자동 migration 을 적용할 수 있습니다`,
    );
    detailLines.push("migration 진행 여부를 결정한 뒤 복원을 계속하세요");
  } else {
    headline = `schema version 불일치 — 이 dump 는 복원할 수 없습니다`;
    detailLines.push(`업로드 version: ${uploadedVersion}`);
    detailLines.push(`현재 시스템 version: ${currentVersion}`);
    detailLines.push(
      "현재 시스템과 호환되는 version 의 dump 를 다시 업로드하세요",
    );
    detailLines.push("이 version 차이는 자동 migration 이 지원되지 않습니다");
  }

  return {
    headline,
    detailLines,
    action: action as "accept" | "migrate" | "reject",
    blocking,
  };
}
