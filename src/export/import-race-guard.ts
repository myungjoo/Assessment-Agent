// import-race-guard — UC-07 Import 진행중-작업 race precondition 판정 순수 helper (T-0460, P7
// R-57 / REQ-030 / REQ-037). T-0437 selectExportRecords → … → T-0450 validateImportDumpSize →
// T-0451 detectImportMergeConflicts → T-0452 summarizeImportPreflight → T-0453
// buildRestoreConfirmation 의 다음 게이트-free building block 이다. UC-07 §4 precondition 4 +
// §6.4 는 Import / Restore 호출 시 UC-01 평가 파이프라인 또는 UC-06 destructive operation 이
// 진행 중인지 검사하고, 진행 중이면 (i) default — 진행 중 작업 완료 후 본 UC 실행(defer) 또는
// (ii) 진행 중 작업 중단 후 본 UC 실행(interrupt → proceed) 중 사용자 결정에 위임한다. §7.6 은
// (i) default 흐름에서 진행 중 작업이 비정상 timeout / hang 시 본 UC 도 timeout 전파 → 재시도
// 안내를 명시한다. 이 race 판정(proceed / defer / timeout) 은 기존 23+ helper 중 0 회 cover 된
// gap 이다.
//
// 본 helper 는 이미 관측된 "진행 중 작업 상태 descriptor"(어떤 operation 이 언제 시작됐는지) +
// now + timeoutMs + 사용자 정책(onConflict)을 입력으로 받아(실 scheduler / DB / pipeline state
// query 0 — 순수·재실행 0) ImportRaceVerdict 단일 모델을 산출한다. 코드 골격은 import-dump-size-
// validate.ts(T-0450)의 non-throw verdict + 입력 방어 throw + 한국어 message convention, export-
// scope-select.ts(T-0437)의 plain descriptor interface + assertValidDate + non-mutating,
// import-restore-confirmation.ts(T-0453)의 headline + detailLines + blocking flag 조립 패턴을
// mirror 한다. persistence / repository / transaction / DB / scheduler / pipeline state query /
// REST 호출 0, 새 외부 dependency 0. 새 도메인 타입은 InProgressOperationState /
// ImportRaceOptions / ImportRaceVerdict 3 종만 신설한다.

// 진행 중일 수 있는 작업 종류 — UC-01 평가 파이프라인 또는 UC-06 destructive operation. active
// 가 true 일 때만 의미 있으며, detailLines 의 operation 라벨 분기에 쓰인다.
export type InProgressOperationKind = "UC01-pipeline" | "UC06-destructive";

// 진행 중 작업 상태 descriptor — 이미 관측된 state 를 입력으로만 받는다(실 polling 0). active
// 가 false 면 진행 중 작업 없음(operation / startedAt 무시). active 가 true 면 operation 종류와
// startedAt(작업 시작 instant) 이 필수 — 경과 시간(now - startedAt) 산출에 쓰인다.
export interface InProgressOperationState {
  active: boolean;
  operation?: InProgressOperationKind;
  startedAt?: Date;
}

// race 판정 옵션 — now(현재 instant, 부재 시 new Date()), timeoutMs(진행 중 작업의 비정상 hang
// 판정 임계, 부재 시 DEFAULT_TIMEOUT_MS), onConflict(§6.4 (i)/(ii) 사용자 정책, 부재 시 'defer'
// default). 모두 선택 — 후속 controller 가 정책 row / ENV 기반 값을 넘긴다(본 helper 는 정책
// source 0 — 옵션으로 받은 값만 판정).
export interface ImportRaceOptions {
  now?: Date;
  timeoutMs?: number;
  onConflict?: "defer" | "interrupt";
}

// race precondition 판정 verdict — plain object. verdict 는 proceed(진행 가능) / defer(진행 중
// 작업 완료까지 대기) / timeout(진행 중 작업이 임계 초과 hang) 셋 중 하나, blocking 은 본 UC 를
// 지금 진행할 수 없는지(verdict !== 'proceed' 와 동치 — 불변), reason 은 판정 근거의 기계 분류
// 슬러그, headline 은 사람-친화 한국어 한 줄, detailLines 는 operation 종류 · 경과 시간 · 임계를
// 노출하는 한국어 진단 라인 목록이다. 후속 controller / WebUI 가 이 모델을 그대로 안내에 쓴다.
export interface ImportRaceVerdict {
  verdict: "proceed" | "defer" | "timeout";
  blocking: boolean;
  reason: string;
  headline: string;
  detailLines: string[];
}

// 진행 중 작업이 없을 때의 default timeout 임계(ms) — 옵션 timeoutMs 부재 시 적용. §7.6 의 hang
// 판정 기준이며 후속 layer 가 환경별 값을 옵션으로 주입한다(본 상수는 입력 부재 시의 fallback).
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

// 허용 onConflict 정책 — §6.4 (i) defer(default) / (ii) interrupt. 이 집합 밖의 값은 호출측
// 배선 버그로 보아 TypeError.
const VALID_ON_CONFLICT: ReadonlySet<string> = new Set(["defer", "interrupt"]);

// operation 종류별 한국어 라벨 — detailLines 작성에 쓴다.
const OPERATION_LABELS: Record<InProgressOperationKind, string> = {
  "UC01-pipeline": "UC-01 평가 파이프라인",
  "UC06-destructive": "UC-06 삭제/재평가 작업",
};

// 허용 operation 종류 집합 — active=true 일 때 operation 값 검증에 쓴다.
const VALID_OPERATIONS: ReadonlySet<string> = new Set([
  "UC01-pipeline",
  "UC06-destructive",
]);

// plain object(null / 배열 / 비-object 아님) 판정 — top-level state / options 입력 방어에 쓴다.
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// 유효 Date instance 판정 — 비-Date / Invalid Date(NaN) 거부. export-scope-select 의
// assertValidDate 와 동형 message convention.
function assertValidDate(value: unknown, label: string): asserts value is Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError(
      `evaluateImportRaceGuard: ${label} 은(는) 유효한 Date instance 여야 합니다`,
    );
  }
}

// 양의 정수 판정 — timeoutMs 검증에 쓴다(0 / 음수 / 소수 / NaN / Infinity / 비-number 거부).
// timeout 임계 0 은 "모든 진행 중 작업이 즉시 hang" 의 무의미한 정책이라 양수만 허용한다.
function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

// evaluateImportRaceGuard — 이미 관측된 진행 중 작업 state descriptor 와 옵션을 받아 Import race
// precondition verdict 를 순수 산출한다(UC-07 §6.4 / §7.6 정합):
//   - active=false → proceed + blocking=false(진행 중 작업 없음).
//   - active=true && onConflict='interrupt' → proceed + blocking=false(§6.4 (ii) 사용자가 중단
//     선택 — 실 중단 배선은 Out of Scope, 본 helper 는 정책 결정만).
//   - active=true && onConflict='defer'(default) && 경과(now-startedAt) ≤ timeoutMs → defer +
//     blocking=true(§6.4 (i) 진행 중 완료까지 대기).
//   - active=true && onConflict='defer' && 경과 > timeoutMs → timeout + blocking=true(§7.6 비정상
//     hang — 재시도 안내).
// blocking === (verdict !== 'proceed') 불변 유지. 경과 === timeoutMs 경계는 ≤ 이므로 defer(임계
// 같을 때는 아직 hang 아님). 경과 0(startedAt === now) 도 defer.
//
// 입력 state / options 를 변형하지 않고(non-mutating — freeze 된 입력 통과) 새 verdict 객체를
// 반환한다. 입력 방어:
//   - state 가 plain object 아님(null / 배열 / 비-object) → TypeError.
//   - state.active 가 비-boolean → TypeError.
//   - active=true 인데 operation 부재 / 허용 외 → TypeError.
//   - active=true 인데 startedAt 부재 / 비-Date / Invalid Date → TypeError.
//   - options 가 주어졌는데 plain object 아님 → TypeError.
//   - options.now 가 주어졌는데 비-Date / Invalid Date → TypeError.
//   - options.timeoutMs 가 주어졌는데 비-양정수 → TypeError.
//   - options.onConflict 가 주어졌는데 허용 enum 외 → TypeError.
//   - now < startedAt(시간 역행) → RangeError(active=true 일 때만 산출하므로 그 분기에서 검사).
export function evaluateImportRaceGuard(
  state: InProgressOperationState,
  options?: ImportRaceOptions,
): ImportRaceVerdict {
  if (!isPlainObject(state)) {
    throw new TypeError(
      `evaluateImportRaceGuard: state 는 plain object 여야 합니다 (받음: ${
        state === null ? "null" : Array.isArray(state) ? "array" : typeof state
      })`,
    );
  }

  if (typeof (state as { active?: unknown }).active !== "boolean") {
    throw new TypeError(
      `evaluateImportRaceGuard: state.active 는 boolean 이어야 합니다 (받음: ${String(
        (state as { active?: unknown }).active,
      )})`,
    );
  }

  // options 입력 방어 — 주어졌을 때만. 부재 시 default(now=현재, timeoutMs=DEFAULT, onConflict=
  // 'defer') 적용.
  if (options !== undefined && !isPlainObject(options)) {
    throw new TypeError(
      `evaluateImportRaceGuard: options 는 plain object 여야 합니다 (받음: ${
        options === null
          ? "null"
          : Array.isArray(options)
            ? "array"
            : typeof options
      })`,
    );
  }

  const now = options?.now;
  if (now !== undefined) {
    assertValidDate(now, "options.now");
  }

  const timeoutMs = options?.timeoutMs;
  if (timeoutMs !== undefined && !isPositiveInteger(timeoutMs)) {
    throw new TypeError(
      `evaluateImportRaceGuard: options.timeoutMs 는 양의 정수여야 합니다 (받음: ${String(
        timeoutMs,
      )})`,
    );
  }

  const onConflict = options?.onConflict;
  if (
    onConflict !== undefined &&
    !VALID_ON_CONFLICT.has(onConflict as string)
  ) {
    throw new TypeError(
      `evaluateImportRaceGuard: options.onConflict 는 "defer" | "interrupt" 중 하나여야 합니다 (받음: ${String(
        onConflict,
      )})`,
    );
  }

  // active=false → proceed(진행 중 작업 없음). startedAt / operation 검증 skip.
  if (!state.active) {
    return {
      verdict: "proceed",
      blocking: false,
      reason: "no-active-operation",
      headline: "진행 중인 작업이 없어 Import 를 바로 진행합니다",
      detailLines: ["진행 중 작업 없음 — race precondition 통과"],
    };
  }

  // active=true → operation / startedAt 필수 검증.
  const operation = (state as { operation?: unknown }).operation;
  if (typeof operation !== "string" || !VALID_OPERATIONS.has(operation)) {
    throw new TypeError(
      `evaluateImportRaceGuard: active=true 인 state.operation 은 "UC01-pipeline" | "UC06-destructive" 중 하나여야 합니다 (받음: ${String(
        operation,
      )})`,
    );
  }
  const operationKind = operation as InProgressOperationKind;

  assertValidDate(
    (state as { startedAt?: unknown }).startedAt,
    "active=true 인 state.startedAt",
  );
  const startedAt = (state as { startedAt: Date }).startedAt;

  const effectivePolicy: "defer" | "interrupt" =
    (onConflict as "defer" | "interrupt" | undefined) ?? "defer";
  const operationLabel = OPERATION_LABELS[operationKind];

  // §6.4 (ii) 사용자가 중단 선택 → proceed(실 중단 배선은 Out of Scope). 시간 역행 검사 불필요
  // (경과 시간을 쓰지 않으므로) — 정책 결정만으로 proceed.
  if (effectivePolicy === "interrupt") {
    return {
      verdict: "proceed",
      blocking: false,
      reason: "interrupt-policy",
      headline: `${operationLabel} 을 중단하고 Import 를 진행합니다`,
      detailLines: [
        `진행 중 작업: ${operationLabel}`,
        "사용자 정책: interrupt — 진행 중 작업 중단 후 본 UC 실행",
      ],
    };
  }

  // defer 정책 → 경과 시간 산출. now 부재 시 현재 instant.
  const nowInstant = now ?? new Date();
  const elapsedMs = nowInstant.getTime() - startedAt.getTime();
  if (elapsedMs < 0) {
    throw new RangeError(
      `evaluateImportRaceGuard: now 가 startedAt 보다 앞설 수 없습니다 ` +
        `(startedAt=${startedAt.toISOString()}, now=${nowInstant.toISOString()})`,
    );
  }

  const effectiveTimeout = timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // 경과 ≤ timeoutMs → defer(§6.4 (i) 진행 중 완료까지 대기). 경계(경과 === timeoutMs)는 아직
  // hang 아니므로 defer.
  if (elapsedMs <= effectiveTimeout) {
    return {
      verdict: "defer",
      blocking: true,
      reason: "defer-policy",
      headline: "진행 중 작업 완료 후 자동 재시도 예정",
      detailLines: [
        `진행 중 작업: ${operationLabel}`,
        `경과 ${elapsedMs}ms / 임계 ${effectiveTimeout}ms — 아직 정상 진행 중`,
        "사용자 정책: defer — 진행 중 작업 완료까지 대기",
      ],
    };
  }

  // 경과 > timeoutMs → timeout(§7.6 비정상 hang — 재시도 안내).
  return {
    verdict: "timeout",
    blocking: true,
    reason: "operation-timeout",
    headline:
      "진행 중 작업이 임계를 초과해 hang 으로 판정 — 재시도가 필요합니다",
    detailLines: [
      `진행 중 작업: ${operationLabel}`,
      `경과 ${elapsedMs}ms / 임계 ${effectiveTimeout}ms — 임계 초과(비정상 hang)`,
      "재시도 안내: 진행 중 작업 상태 확인 후 Import 재시도",
    ],
  };
}
