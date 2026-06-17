// export-access-denial-message — UC-07 Export·Import 진입 인증·권한 거부 사람-친화 안내 메시지 조립
// 순수 helper (T-0464, P7 / REQ-043 / REQ-044 / REQ-045). T-0437 selectExportRecords →
// T-0438 buildExportDump → … → T-0459 buildDumpValidationMessage → T-0461
// buildRestoreFailureMessage → T-0462 describeExportScope → T-0463 buildExportScopeRejection
// 다음의 게이트-free building block 이다. UC-07 §7.1 은 인증 실패 시(미인증) main flow 진입을
// 401 + login redirect 로 막고, §7.2 는 인증은 됐으나 권한 부족(Admin 미만) 시 403 + "Admin 권한
// 필요" 안내로 막는다(§4 precondition 1·2, §5 step 5 AuthModule guard). 기존 helper 들은 payload
// 검증 실패(§7.3 buildExportScopeRejection) / dump 구조 실패(§7.4 buildDumpValidationMessage) /
// DB write 실패(§7.5 buildRestoreFailureMessage) / race timeout(§7.6 evaluateImportRaceGuard) 의
// 사람-친화 안내까지 모두 cover 하나, 진입 자체를 막는 §7.1(인증)/§7.2(권한) 거부 안내 메시지는
// 0 회 cover 된 gap 이다 — error path 6 종 중 마지막 미cover 2 종.
//
// 본 helper 는 이미 산출된 인증·권한 판정 descriptor ExportAccessDecision 을 입력으로만 받아(실 guard /
// JWT 검증 / session lookup / DB / REST 0 — 순수·재실행 0) 한국어 headline + 다음 행동 안내
// detailLines + blocking flag + reason 슬러그를 담은 단일 메시지 모델 ExportAccessDenialMessage 를
// 조립한다. 이는 §7.3 scope reject(T-0463 ExportScopeRejectionMessage) / §7.4 dump reject(T-0459
// DumpValidationMessage) 의 "구조화 판정 → 사람-친화 메시지 모델(headline + detailLines + blocking)"
// 패턴을 입구 guard 측(인증·권한)에 적용한 것이다. payload/dump reject 가 "잘못된 입력" 을 막는다면,
// access denial 은 "자격 없는 호출자" 를 막는다.
//
// §7.1 우선순위 박제 — 미인증이면 권한 평가 전에 인증 거부(401 우선, role 값과 무관). persistence /
// repository / transaction / DB / REST / guard / JWT 호출 0, 새 외부 dependency 0, 새 도메인 타입은
// ExportAccessDecision / ExportAccessDenialMessage 만 신설(AuditActorRole /
// ExportImportAuditOperation 재사용 — 거부 대상 role 표현은 입력 타입 내부에서만 "User" / null 로
// 확장). 코드 골격은 export-scope-rejection-message.ts(T-0463) 의 순수-helper 패턴(plain 모델
// interface + isPlainObject·describe 입력 방어 + 한국어 TypeError/RangeError convention +
// non-mutating + blocking 불변)을 mirror 한다.
import {
  AuditActorRole,
  ExportImportAuditOperation,
} from "./export-import-audit";

// 거부 사유 슬러그 — 후속 layer(controller)가 이것으로 HTTP status(401/403) 를 매핑한다.
// "unauthenticated"=§7.1(401), "insufficient-role"=§7.2(403), "granted"=접근 허용(거부 아님).
export type ExportAccessDenialReason =
  | "unauthenticated"
  | "insufficient-role"
  | "granted";

// 입력 descriptor 의 role 필드 — Audit 의 AuditActorRole(Admin/SuperAdmin) 을 재사용하되 거부
// 대상까지 표현하도록 "User"(권한 부족 등급) / null(권한 미상)로 입력 타입 내부에서만 확장한다.
// 새 도메인 actor-role 타입을 신설하지 않는다(AuditActorRole 재사용 — Out of Scope 박제).
export type ExportAccessRole = AuditActorRole | "User" | null;

// 이미 내려진 인증·권한 판정 descriptor — 실 guard 가 산출한 것을 입력으로만 받는다(재검증 0).
// authenticated 는 인증 통과 여부, role 은 인증된 경우의 등급(미인증이면 무시), operation 은
// 거부 맥락(export/import). 본 helper 는 이 descriptor 만으로 표시 메시지를 합성한다.
export interface ExportAccessDecision {
  authenticated: boolean;
  role?: ExportAccessRole;
  operation: ExportImportAuditOperation;
}

// 조립된 사람-친화 접근 거부/허용 안내 메시지 모델 — plain object. headline 은 reason 분기별
// 한국어 한 줄, detailLines 는 다음 행동 안내(미인증=재로그인, 권한부족=Admin 필요 + operation
// 맥락, 허용=진행 가능), blocking 은 "진행 전 반드시 해소해야 하는가"(거부만 true), reason 은
// 후속 status 매핑용 슬러그. blocking === (reason !== "granted") 불변. 후속 controller / WebUI(P6)
// 가 이 모델을 그대로 소비한다.
export interface ExportAccessDenialMessage {
  headline: string;
  detailLines: string[];
  blocking: boolean;
  reason: ExportAccessDenialReason;
}

// Admin 이상 권한 등급 set — 이 set 에 속해야 접근 허용(granted). 그 외(User / null / union 외
// 임의 문자열)는 권한 부족(insufficient-role)으로 거부한다(UC-07 §2 "Admin 이상" 박제).
const GRANTED_ROLES: ReadonlySet<string> = new Set(["Admin", "SuperAdmin"]);

// 유효 operation set — export/import 외 값(대소문자 mismatch / null / 숫자 포함)은 RangeError.
const VALID_OPERATIONS: ReadonlySet<string> = new Set(["export", "import"]);

// operation 을 사람-친화 한국어로 — detailLine 의 맥락 라인에 쓴다.
const OPERATION_LABEL: Readonly<Record<ExportImportAuditOperation, string>> = {
  export: "내보내기(Export)",
  import: "가져오기(Import)",
};

// plain object(null / 배열 / 비-object 아님) 판정 — top-level decision 입력 방어에 쓴다.
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

// buildExportAccessDenial — 이미 산출된 ExportAccessDecision 을 받아 사람-친화 접근 거부/허용
// 안내 메시지 모델을 순수 합성한다(UC-07 §7.1/§7.2 정합):
//   - authenticated=false — §7.1 인증 거부 headline + 재로그인 안내 detailLine +
//     reason="unauthenticated" + blocking=true. §7.1 우선순위로 role 값과 무관(role 이 Admin
//     이어도 미인증이면 인증 거부가 이긴다).
//   - authenticated=true + role 이 Admin/SuperAdmin 미만(User / null / union 외) — §7.2 권한
//     거부 headline + "Admin 이상 권한 필요" 안내 + operation 맥락 라인 +
//     reason="insufficient-role" + blocking=true.
//   - authenticated=true + role 이 Admin/SuperAdmin — 접근 허용 headline + 진행 가능 detailLine +
//     reason="granted" + blocking=false.
// 입력 decision 객체를 변형하지 않고 항상 새 객체를 반환한다(non-mutating — freeze 된 decision 으로
// 호출해도 통과). blocking === (reason !== "granted") 불변을 유지한다. 배선 전 안전을 위한 입력 방어:
//   - decision 이 plain object 아님(null / 배열 / 비-object) → TypeError.
//   - decision.authenticated 가 비-boolean → TypeError.
//   - decision.operation 이 "export"/"import" 외 값 → RangeError.
// authenticated=true 인데 role 이 부재/null 인 경계는 "권한 없음" 으로 취급해 insufficient-role
// 분기로 처리한다(throw 0 — 판정 descriptor 가 role 을 못 채웠으면 안전하게 거부 쪽으로 fail-safe).
export function buildExportAccessDenial(
  decision: ExportAccessDecision,
): ExportAccessDenialMessage {
  // top-level decision 이 plain object 가 아니면 하위 필드에 접근할 수 없어 즉시 throw.
  if (!isPlainObject(decision)) {
    throw new TypeError(
      `buildExportAccessDenial: decision 은 plain object 여야 합니다 (받음: ${describe(
        decision,
      )})`,
    );
  }

  const source = decision as Partial<ExportAccessDecision>;

  // authenticated 검증 — 비-boolean(null / 숫자 / 문자열 등) 거부.
  const authenticated = source.authenticated;
  if (typeof authenticated !== "boolean") {
    throw new TypeError(
      `buildExportAccessDenial: decision.authenticated 는 boolean 이어야 합니다 (받음: ${describe(
        authenticated,
      )})`,
    );
  }

  // operation 검증 — export/import 외 값(대소문자 mismatch / null / 숫자) 거부.
  const operation = source.operation;
  if (typeof operation !== "string" || !VALID_OPERATIONS.has(operation)) {
    throw new RangeError(
      `buildExportAccessDenial: decision.operation 은 export/import 중 하나여야 합니다 (받음: ${describe(
        operation,
      )})`,
    );
  }

  const operationLabel =
    OPERATION_LABEL[operation as ExportImportAuditOperation];

  // §7.1 우선순위 — 미인증이면 role 평가 전에 인증 거부(401 우선, role 값 무관).
  if (!authenticated) {
    return {
      headline: "로그인이 필요합니다 — 인증되지 않은 접근입니다",
      detailLines: [
        `${operationLabel} 기능은 로그인한 사용자만 사용할 수 있습니다`,
        "다시 로그인한 뒤 같은 작업을 시도하세요",
      ],
      blocking: true,
      reason: "unauthenticated",
    };
  }

  // 인증은 됐으나 권한 평가 — Admin/SuperAdmin 만 허용. role 부재/null/User/union 외는 거부.
  const role = source.role;
  const granted = typeof role === "string" && GRANTED_ROLES.has(role);

  if (!granted) {
    return {
      headline: "권한이 부족합니다 — Admin 이상 권한이 필요합니다",
      detailLines: [
        `${operationLabel} 기능은 Admin 또는 SuperAdmin 권한이 있어야 사용할 수 있습니다`,
        "권한 있는 관리자에게 문의하거나 적절한 권한으로 다시 로그인하세요",
      ],
      blocking: true,
      reason: "insufficient-role",
    };
  }

  // 인증 + Admin 이상 — 접근 허용.
  return {
    headline: "접근이 허용되었습니다 — 작업을 진행할 수 있습니다",
    detailLines: [
      `${operationLabel} 기능에 대한 인증·권한 확인을 통과했습니다`,
    ],
    blocking: false,
    reason: "granted",
  };
}
