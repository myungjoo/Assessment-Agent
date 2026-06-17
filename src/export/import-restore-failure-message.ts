// import-restore-failure-message — UC-07 §7.5 Import 복원 실패(DB write fail) 사람-친화 rollback
// 보장·재시도 안내 메시지 조립 순수 helper (T-0461, P7 R-57 / REQ-030 / REQ-032). T-0437
// selectExportRecords → … → T-0453 buildRestoreConfirmation(실행 *전*) → T-0455
// buildRestoreResult(commit *후* 성공) → T-0459 buildDumpValidationMessage(§7.4 구조 reject) →
// T-0460 evaluateImportRaceGuard(§7.6 race) 다음의 게이트-free building block 이다. UC-07 §7.5 는
// Import 복원 중 PersistenceModule 의 connection 끊김 / timeout / transaction rollback / cascade
// constraint 위반 시 5xx + WebUI 재시도 안내를 박제하며, 그 핵심 invariant 는 "atomic —
// all-or-nothing — 기존 row 삭제와 file snapshot 재구성이 함께 rollback (부분 복원 상태 없음)"
// 이다(§5 step 7·11 / §8 (b)(c) 정합). T-0455 buildRestoreResult 가 transaction commit *이후*
// 성공 결과 메시지를 조립했으나, 그 실패측 대칭 — DB write fail 시 Admin 에게 보여줄 rollback
// 보장(부분 복원 상태 없음 안심) + 사유 분류 + 재시도 actionable 안내 메시지 — 는 24+ helper 중
// 0 회 cover 된 gap 이다.
//
// 본 helper 는 이미 분류된 실패 사유를 구조화 descriptor RestoreFailureDescriptor{kind, mode} 로
// 받아(실 transaction / repository / DB query 0 — 순수 합성, 재실행 0) 한국어 headline + rollback
// 보장 라인(부분 복원 상태 없음) + 사유별 detailLines + 재시도 actionable 안내 + retryable flag 를
// 담은 단일 메시지 모델 RestoreFailureMessage 를 조립한다. 이는 T-0453 buildRestoreConfirmation
// (실행 전) / T-0455 buildRestoreResult(성공) / T-0459 buildDumpValidationMessage(§7.4 구조 reject)
// 가 확립한 "구조화 verdict → 사람-친화 메시지 모델" 패턴의 §7.5 실패 측 적용이다. persistence /
// repository / transaction / DB / REST / 5xx 직렬화 / retry 자동 재시도 배선 호출 0, 새 외부
// dependency 0, 새 도메인 타입은 RestoreFailureDescriptor / RestoreFailureKind /
// RestoreFailureMessage 3 종만 신설(mode 는 T-0455 와 동형 "replace" | "merge" 재사용). 코드 골격은
// import-restore-result.ts(T-0455 성공측 대칭) / import-dump-validate-message.ts(T-0459)의 plain
// 모델 interface + isPlainObject 입력 방어 + 한국어 TypeError/RangeError convention + non-mutating
// 을 mirror 한다. REQ-032(raw 미저장)는 사유/mode 만 다루고 raw 를 새로 fetch 하지 않으므로 helper
// layer 에서 자연 유지된다.

// §7.5 의 4 실패 사유 union — connection(DB 연결 끊김) / timeout(write timeout) / rollback
// (transaction rollback) / cascade(cascade constraint 위반). 이 집합 밖의 값은 호출측 배선 버그로
// 보아 RangeError(허용 enum 위반은 RangeError, shape 위반은 TypeError 로 구분).
export type RestoreFailureKind =
  | "connection"
  | "timeout"
  | "rollback"
  | "cascade";

// 복원 실패 사유 descriptor — 이미 분류된 실패 사유(kind)와 적용 mode(replace/merge)를 입력으로만
// 받는다(실 transaction 재실행 0). mode 는 T-0455 buildRestoreResult 와 동형 "replace" | "merge".
export interface RestoreFailureDescriptor {
  kind: RestoreFailureKind;
  mode: "replace" | "merge";
}

// 조립된 사람-친화 복원 실패 안내 메시지 모델 — plain object. headline 은 "복원 실패" + mode
// (replace/merge 한국어 표기) + 사유 요약 한 줄, rollbackAssured 는 atomic all-or-nothing 보장
// (§7.5 불변 — 모든 kind 에서 항상 true), detailLines 는 rollback 보장 라인(부분 복원 상태 없음) +
// 사유별 한국어 진단·안내 라인, retryable 은 단순 재시도로 해소 가능한지(connection/timeout/
// rollback=true, cascade=false). 후속 WebUI 실패 화면(P6)이 이 모델을 그대로 렌더하고, REST
// controller(repository 게이트 후속)가 §7.5 5xx 응답으로 직렬화한다.
export interface RestoreFailureMessage {
  headline: string;
  rollbackAssured: boolean;
  detailLines: string[];
  retryable: boolean;
}

// 허용 import mode — UC-07 §6.2 의 두 적용 방식(T-0455 와 동형 재사용). 입력 방어에서 이 집합 밖의
// 값은 호출측 배선 버그로 보아 RangeError.
const VALID_IMPORT_MODES: ReadonlySet<string> = new Set(["replace", "merge"]);

// 허용 실패 사유 집합 — kind 값 검증에 쓴다.
const VALID_FAILURE_KINDS: ReadonlySet<string> = new Set([
  "connection",
  "timeout",
  "rollback",
  "cascade",
]);

// kind 별 한국어 사유 요약 — headline 작성에 쓴다.
const KIND_SUMMARIES: Record<RestoreFailureKind, string> = {
  connection: "DB 연결 끊김",
  timeout: "DB write timeout",
  rollback: "transaction rollback",
  cascade: "cascade constraint 위반",
};

// kind 별 한국어 진단 라인 — detailLines 에 사유 설명으로 노출한다.
const KIND_DETAILS: Record<RestoreFailureKind, string> = {
  connection: "사유: DB 연결이 끊겨 복원 transaction 이 완료되지 못했습니다",
  timeout: "사유: DB write 가 시간 초과되어 복원 transaction 이 중단되었습니다",
  rollback:
    "사유: 복원 transaction 이 rollback 되어 변경이 적용되지 않았습니다",
  cascade: "사유: cascade constraint 위반으로 복원 데이터를 적용할 수 없습니다",
};

// retryable=true 사유의 공통 재시도 안내 — connection/timeout/rollback 은 일시적 장애라 단순
// 재시도로 해소 가능.
const RETRY_GUIDANCE = "잠시 후 동일 file 로 복원을 재시도하세요";

// retryable=false 사유(cascade)의 안내 — 단순 재시도로 해소 불가한 데이터 정합 문제.
const CASCADE_GUIDANCE =
  "file/데이터 정합을 확인한 뒤 올바른 dump 로 재업로드하세요(단순 재시도로 해소되지 않습니다)";

// §7.5 atomic all-or-nothing rollback 보장 라인 — 모든 kind 에서 항상 detailLines 에 포함되어
// Admin 에게 부분 복원 상태가 없음을 안심시킨다.
const ROLLBACK_ASSURANCE =
  "기존 데이터는 변경되지 않았습니다(부분 복원 상태 없음 — atomic all-or-nothing rollback)";

// plain object(null / 배열 / 비-object 아님) 판정 — top-level descriptor 입력 방어에 쓴다.
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

// buildRestoreFailureMessage — 이미 분류된 RestoreFailureDescriptor 를 받아 Import 복원 실패(§7.5
// DB write fail) 시 Admin 에게 보여줄 사람-친화 안내 메시지 모델을 순수 합성한다(UC-07 §7.5 정합):
//   - headline — "복원 실패" + mode(replace/merge 한국어 표기) + 사유 요약 한 줄.
//   - rollbackAssured — 항상 true(§7.5 atomic all-or-nothing — 어떤 실패 사유든 부분 복원 없음).
//   - detailLines — rollback 보장 라인(부분 복원 상태 없음) + 사유별 진단 라인 + 재시도 안내 라인.
//   - retryable — connection/timeout/rollback 은 true(일시적 장애, 단순 재시도 가능), cascade 는
//     false(데이터 정합 문제 — 재업로드 필요).
//
// 입력 descriptor 를 변형하지 않고 새 객체·배열을 반환한다(non-mutating — freeze 된 descriptor 로
// 호출해도 통과). transaction 후 배선 전 안전을 위한 입력 방어:
//   - descriptor 가 plain object 아님(null / 배열 / 비-object) → TypeError.
//   - descriptor.kind 가 4 허용 union 외(빈 문자열 / 대문자 / 숫자 / null 등) → RangeError.
//   - descriptor.mode 가 "replace" / "merge" 외 → RangeError.
// happy-path 는 service layer 가 이미 분류한 사유를 전제하므로 위 방어 분기는 negative test 로
// cover 한다.
export function buildRestoreFailureMessage(
  descriptor: RestoreFailureDescriptor,
): RestoreFailureMessage {
  // top-level descriptor 가 plain object 가 아니면 하위 필드에 접근할 수 없어 즉시 throw.
  if (!isPlainObject(descriptor)) {
    throw new TypeError(
      `buildRestoreFailureMessage: descriptor 는 plain object 여야 합니다 (받음: ${describe(
        descriptor,
      )})`,
    );
  }

  const source = descriptor as Partial<RestoreFailureDescriptor>;

  // kind 는 4 허용 값 외 거부 — 빈 문자열 / 대문자 "CONNECTION" / 숫자 / null 등 모두 RangeError.
  const kind = source.kind;
  if (typeof kind !== "string" || !VALID_FAILURE_KINDS.has(kind)) {
    throw new RangeError(
      `buildRestoreFailureMessage: descriptor.kind 는 "connection" | "timeout" | "rollback" | ` +
        `"cascade" 중 하나여야 합니다 (받음: ${String(kind)})`,
    );
  }

  // mode 는 두 허용 값 외 거부 — T-0455 convention 동형 RangeError.
  const mode = source.mode;
  if (typeof mode !== "string" || !VALID_IMPORT_MODES.has(mode)) {
    throw new RangeError(
      `buildRestoreFailureMessage: descriptor.mode 는 "replace" | "merge" 중 하나여야 합니다 ` +
        `(받음: ${String(mode)})`,
    );
  }

  const failureKind = kind as RestoreFailureKind;

  // retryable — cascade 만 false(데이터 정합 문제), 나머지(connection/timeout/rollback)는 true.
  const retryable = failureKind !== "cascade";

  const modeLabel = mode === "replace" ? "전체 교체(replace)" : "병합(merge)";
  const headline = `복원 실패 — ${modeLabel} 모드, ${KIND_SUMMARIES[failureKind]}`;

  // detailLines — rollback 보장 라인(항상 1번째) + 사유 진단 라인 + retryable 분기별 재시도 안내.
  const detailLines: string[] = [];
  detailLines.push(ROLLBACK_ASSURANCE);
  detailLines.push(KIND_DETAILS[failureKind]);
  detailLines.push(retryable ? RETRY_GUIDANCE : CASCADE_GUIDANCE);

  return {
    headline,
    // §7.5 atomic all-or-nothing — 어떤 실패 사유든 부분 복원 상태가 없으므로 항상 보장됨.
    rollbackAssured: true,
    detailLines,
    retryable,
  };
}
