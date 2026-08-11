/**
 * 체크인 baseline confirm-or-compare **결과의 CI 로그 표기 단일 진입점** (REQ-048,
 * ADR-0056 §Decision 3 (b) · §Follow-ups (b)).
 *
 * ADR-0056 §Decision 3 (b) 는 baseline 대비 상대 회귀를 **로그로 가시화만 하고 exit code 는 바꾸지
 * 않는다** 고 못 박았다. 그런데 `confirmOrCompareBaseline` 이 내는 판별 union 을 로그 한 줄로
 * 요약하는 진입점이 없어, 호출측이 각자 `if` 로 문자열을 조립하면 그 순간 표기가 갈린다. 본 모듈은
 * 그 표기를 하나로 모아 후속 slice(배선 · workflow)가 공유하게 한다.
 *
 * **리포트 재구현 0** — 상세 비교 본문은 상위 io 진입점이 만들어 `result.report` 로 넘겨준다. 본
 * 모듈은 그 문자열을 **그대로 이어붙일 뿐** 이며 수치 계산 · 재포맷 · 임계 판정을 하지 않는다.
 * **순수 · 부작용 0** — 파일 시스템 · 환경변수 · 시각 · 난수 무의존(그 접근을 한 줄도 두지 않는다).
 * **exit code 불변** — 회귀(`regressed === true`) 입력에도 throw 하지 않고 문자열만 낸다. 회귀를
 * 실패로 승격하는 판단은 본 모듈의 책임이 아니다(ADR-0056 §Decision 3 (b)).
 */

import { ConfirmOrCompareResult } from "./latency-baseline-io";

/**
 * CI 로그에서 체크인 baseline 관련 줄을 grep 하는 **고정 축**. 값이 바뀌면 로그 수집 · 검색
 * 규약이 함께 깨지므로, 새 문자열을 따로 적지 말고 항상 본 상수를 참조한다.
 */
export const CHECKIN_LOG_PREFIX = "[perf][checkin-baseline]";

/** 문자열 필드 공통 검증 — non-string 은 `TypeError`, 빈/공백-only 는 `RangeError`. */
function requireNonBlankString(
  value: unknown,
  fieldLabel: string,
): asserts value is string {
  if (typeof value !== "string") {
    throw new TypeError(`${fieldLabel} 는 string 이어야 함`);
  }
  if (value.trim() === "") {
    throw new RangeError(`${fieldLabel} 는 빈/공백-only string 일 수 없음`);
  }
}

/**
 * `result` 형태를 확인하고 `outcome` 판별자를 돌려준다(line/block 이 공유해 예외 계약 일치).
 *
 * @throws {TypeError} `result` 가 non-object · `null`, 또는 `outcome` 이 non-string 일 때.
 * @throws {RangeError} `outcome` 이 `"established"`/`"compared"` 가 아닌 문자열일 때.
 */
function requireOutcome(result: unknown): "established" | "compared" {
  if (typeof result !== "object" || result === null) {
    throw new TypeError(
      "formatCheckinOutcome: result 는 object 이어야 함(null 불가)",
    );
  }
  const outcome = (result as { outcome?: unknown }).outcome;
  if (typeof outcome !== "string") {
    throw new TypeError(
      "formatCheckinOutcome: result.outcome 는 string 이어야 함",
    );
  }
  if (outcome !== "established" && outcome !== "compared") {
    throw new RangeError(
      `formatCheckinOutcome: 알 수 없는 outcome "${outcome}" (established|compared 만 허용)`,
    );
  }
  return outcome;
}

/**
 * confirm-or-compare 결과를 **개행 없는 한 줄** 로그 문자열로 요약한다.
 * `established` → `<prefix> outcome=established path=<result.path>`,
 * `compared` → `<prefix> outcome=compared regressed=<true|false>`.
 *
 * **원문 보존** — `path` 는 정규화 · 절대화 · 인용 없이 **받은 문자열 그대로** 싣는다(경로 표기
 * 판단은 경로 helper 책임). `compared` 입력에 `path` 가 섞여 있어도 line 에는 싣지 않는다.
 *
 * @throws {TypeError} `result` non-object · `null`, `outcome` non-string, `established` 의
 *   `path` non-string, `compared` 의 `comparison` non-object · `regressed` non-boolean 일 때.
 * @throws {RangeError} `outcome` 이 허용 밖 문자열이거나 `path` 가 빈/공백-only 일 때.
 */
export function formatCheckinOutcomeLine(
  result: ConfirmOrCompareResult,
): string {
  const outcome = requireOutcome(result);
  if (outcome === "established") {
    const { path } = result as { path: unknown };
    requireNonBlankString(path, "formatCheckinOutcomeLine: result.path");
    return `${CHECKIN_LOG_PREFIX} outcome=established path=${path}`;
  }
  const comparison = (result as { comparison?: unknown }).comparison;
  if (typeof comparison !== "object" || comparison === null) {
    throw new TypeError(
      "formatCheckinOutcomeLine: result.comparison 는 object 이어야 함(null 불가)",
    );
  }
  const regressed = (comparison as { regressed?: unknown }).regressed;
  if (typeof regressed !== "boolean") {
    throw new TypeError(
      "formatCheckinOutcomeLine: result.comparison.regressed 는 boolean 이어야 함",
    );
  }
  // 회귀여도 throw 하지 않는다 — 관찰만 노출(ADR-0056 §Decision 3 (b) exit code 불변).
  return `${CHECKIN_LOG_PREFIX} outcome=compared regressed=${regressed}`;
}

/**
 * 한 줄 요약에 상세 비교 본문을 덧붙인 **로그 블록** 을 만든다. `compared` 면
 * `line + "\n" + result.report`, `established` 면 한 줄만(덧붙일 본문이 없다).
 * **본문 재구현 0** — `report` 는 상위 io 진입점이 만든 문자열을 **가공 없이**(trim · 재정렬 ·
 * 수치 재계산 금지) 그대로 잇는다.
 *
 * @throws {TypeError} line 계약의 모든 `TypeError`, 또는 `compared` 의 `report` non-string 일 때.
 * @throws {RangeError} line 계약의 모든 `RangeError`, 또는 `report` 가 빈/공백-only 일 때.
 */
export function formatCheckinOutcomeBlock(
  result: ConfirmOrCompareResult,
): string {
  // 1. 형태 검증 · 한 줄 요약은 전적으로 line 진입점에 위임(중복 검증 금지).
  const line = formatCheckinOutcomeLine(result);
  if (requireOutcome(result) === "established") {
    return line;
  }
  // 2. compared 분기에서만 상세 본문을 검증하고 개행 1 개로 잇는다.
  const report = (result as { report?: unknown }).report;
  requireNonBlankString(report, "formatCheckinOutcomeBlock: result.report");
  return `${line}\n${report}`;
}
