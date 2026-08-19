/**
 * 체크인 baseline **실행 결과 → 요약 포매터 → 요약 sink 를 잇는 합성 진입점**
 * (REQ-048, ADR-0056 §Decision 3 (b) · §Follow-ups (b)).
 *
 * 요약 축의 조각은 넷이 확정됐으나(포매터 · 울타리 산출 · 주입식 sink · 데이터 통로) **넷을 잇는
 * 곳이 없어** 호출처가 분기 · 포매터 호출 · sink 호출 · 예외 삼킴을 각자 조립해야 했고, 그 조립이
 * 복제되면 관찰-only 계약이 호출처 수만큼 흩어진다. 본 모듈은 그 **얇은 잇기 하나** 만 책임진다.
 *
 * **재구현 0**(새 문구 · 판정 · 상수 · deps 타입 0 — sink 결과는 그대로 통과) · **전역 접근 0**
 * (`process.env` 읽기 · `fs` import 0) · **exit code 불변**(회귀 입력에도 throw 0).
 */

import { CheckinBaselineRunOutcome } from "./checkin-baseline-run";
import { formatCheckinStepSummaryBlock } from "./checkin-baseline-step-summary";
import {
  CheckinStepSummarySinkDeps,
  appendCheckinStepSummary,
} from "./checkin-baseline-step-summary-sink";

/** sink 주입 묶음 타입을 **그대로** 재-export(새 타입 정의 금지 — 계약이 갈리면 안 된다). */
export type { CheckinStepSummarySinkDeps } from "./checkin-baseline-step-summary-sink";

/**
 * 결과 판별 union — `"appended"` 는 sink 가 append 를 수행한 국면, `"skipped"` 는 요약을 내보내지
 * 않은 단락, `"failed"` 는 포매터 또는 append 가 던진 값을 삼킨 국면. 사유는 영어 기계 분류용
 * 슬러그이며 `"not-compared"` · `"format-threw"` 두 국면만 본 모듈이 새로 낸다(나머지는 sink 값).
 */
export type CheckinStepSummaryEmitOutcome =
  | { status: "appended"; path: string }
  | { status: "skipped"; reason: "not-compared" | "env-absent" | "env-blank" }
  | { status: "failed"; reason: "format-threw" | "append-threw" };

/**
 * 체크인 baseline 실행 결과를 step 요약으로 **내보낸다**. 순서는 (1) 인자 형태 검증 → (2) 비교
 * 국면 단락 → (3) 포매터 조립 → (4) sink 위임이며 하위 진입점은 각각 **정확히 1 회** 호출한다.
 *
 * **비교 부재 단락** — `outcome.status !== "compared"` 면 포매터 · sink 를 **각 0 회** 호출하고
 * `skipped`(`not-compared`) 를 낸다("비교가 없었다"는 사실이 요약으로 새면 안 된다).
 * **본문 가공 0** — 포매터 결과는 trim · 재정렬 · 이스케이프 · 개행 조작 없이 sink 로 넘기고(끝
 * 개행 보장은 sink 책임), sink 반환은 재조립 · 재판정 없이 그대로 반환한다. **순수성** — 인자를
 * 변형하지 않아 같은 입력은 늘 같은 결과를 낸다.
 *
 * **관찰 경로 최외곽 계약** — 포매터가 던진 값은 **어떤 것도 전파하지 않고** 삼켜
 * `failed`(`format-threw`) 로만 보고한다(요약 기록 실패가 CI 를 빨갛게 만들면 §Decision 3 (b)
 * 약속이 깨진다 — sink 가 append 실패를 삼키는 것과 동형). 단 **본 모듈 자신의 인자 형태 위반**은
 * 형제 모듈과 동일하게 던지고, sink 가 자기 인자에 대해 던지는 `TypeError` 도 그대로 전파된다.
 *
 * @param outcome 체크인 baseline 실행 결과 판별 union(`compared` | `skipped`).
 * @param sectionTitle 요약 heading 문구(빈/공백-only 불가 — 포매터 계약 그대로).
 * @param deps 환경변수 record + append 함수 주입 묶음(sink 의 `CheckinStepSummarySinkDeps`).
 * @returns append 수행 · 단락 · 삼킨 실패 판별 union.
 * @throws {TypeError} `outcome` non-object · `null` · `undefined`, `sectionTitle` non-string,
 *   `deps` non-object · `null` · `undefined` 일 때. 그리고 비교 국면에서 sink 가 던지는
 *   `TypeError`(`deps.processEnv` non-object · `null`, `deps.append` non-function) 전파.
 * @throws {RangeError} `sectionTitle` 이 빈/공백-only 일 때. **포매터가 던지는 값은 전파하지
 *   않는다** — 삼켜서 `failed`(`format-threw`) 로만 낸다(exit code 불변).
 */
export function emitCheckinStepSummary(
  outcome: CheckinBaselineRunOutcome,
  sectionTitle: string,
  deps: CheckinStepSummarySinkDeps,
): CheckinStepSummaryEmitOutcome {
  // 1. 본 모듈 자신의 인자 형태 검증 — 프로그래머 오류는 삼키지 않고 즉시 던진다(관찰-only 계약과
  //    별개). 단락 국면도 같은 검증을 거치도록 분기보다 **앞** 에 둔다(계약 일관성).
  if (typeof outcome !== "object" || outcome === null) {
    throw new TypeError(
      "emitCheckinStepSummary: outcome 은 object 이어야 함(null 불가)",
    );
  }
  if (typeof sectionTitle !== "string") {
    throw new TypeError(
      "emitCheckinStepSummary: sectionTitle 는 string 이어야 함",
    );
  }
  if (sectionTitle.trim() === "") {
    throw new RangeError(
      "emitCheckinStepSummary: sectionTitle 는 빈/공백-only string 일 수 없음",
    );
  }
  if (typeof deps !== "object" || deps === null) {
    throw new TypeError(
      "emitCheckinStepSummary: deps 는 object 이어야 함(null 불가)",
    );
  }
  // 2. 비교하지 않은 국면 단락 — 포매터 · sink 를 각 0 회 호출한다.
  if (outcome.status !== "compared") {
    return { status: "skipped", reason: "not-compared" };
  }
  // 3. 포매터는 정확히 1 회 위임. 던진 값은 무엇이든 삼켜 failed 로만 보고한다(exit code 불변).
  let block: string;
  try {
    block = formatCheckinStepSummaryBlock(
      outcome.confirmOrCompare,
      sectionTitle,
    );
  } catch {
    return { status: "failed", reason: "format-threw" };
  }
  // 4. sink 로 위임하고 그 결과를 **가공 없이 그대로** 반환한다(재판정 · 재조립 0).
  return appendCheckinStepSummary(block, deps);
}
