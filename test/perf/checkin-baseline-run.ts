/**
 * 체크인(repo 안 commit) baseline 의 **판정 → 비교 → 로그 조립 단일 진입점** (REQ-048,
 * ADR-0056 §Decision 2 · §Decision 3 (b) · §Follow-ups (b)).
 *
 * 경로 해석 · 로그 표기 · 진입 판정은 이미 세 모듈로 박제됐으나 셋을 **어떤 순서로 잇는지** 가
 * 없어, 배선 slice 가 각자 `if (plan.mode === "compare")` 를 적으면 순서 · skip 국면 로그 표기가
 * 갈린다. 본 모듈은 그 조립 순서 하나만 책임진다 — **신규 판정 로직 0 · 재구현 0**, 비교 자체도
 * 주입 함수 위임이라 파일 시스템 · 경로 builtin · 전역 환경변수 접근이 0 이다. **exit code 불변**
 * (회귀에도 throw 0, §Decision 3 (b)) · **write / establish 국면 부재**(§Decision 2).
 */

import { planCheckinBaselineCheck } from "./checkin-baseline-plan";
import {
  CHECKIN_LOG_PREFIX,
  formatCheckinCandidateLine,
  formatCheckinOutcomeBlock,
} from "./checkin-baseline-report";
import { resolveCheckinBaselineDir } from "./checkin-baseline-store";
import {
  BaselineComparison,
  BaselineEnvMeta,
  BaselineReport,
  CompareOptions,
} from "./latency-baseline";

/** 주입 비교 함수 타입 — `readCompareBaselineFile`(latency-baseline-io) 과 구조적으로 호환. */
export type CheckinBaselineCompareFn = (
  env: BaselineEnvMeta,
  baseDir: string,
  candidate: BaselineReport,
  options?: CompareOptions,
) => { comparison: BaselineComparison; report: string };

/** 입력 — 판정 재료(`CheckinBaselinePlanInput` 의 superset) + 비교 재료를 전부 주입받는다. */
export interface CheckinBaselineRunInput {
  /** 환경변수 record(토글 판정용 — 전역을 직접 읽지 않기 위해 주입받는다). */
  processEnv: Record<string, string | undefined>;
  /** 실행 환경 메타(파일명 slug 유도 · 비교 함수 1 번째 인자). */
  envMeta: BaselineEnvMeta;
  /** repo root · 파일 존재 여부(조회는 호출측 책임) · candidate · 허용치(선택). */
  repoRoot: string;
  exists: boolean;
  candidate: BaselineReport;
  options?: CompareOptions;
}

/** 결과 union — `"compared"` 는 비교 진입, `"skipped"` 는 비교 함수 미호출(토글 off · 부재). */
export type CheckinBaselineRunOutcome =
  | { status: "compared"; regressed: boolean; log: string }
  | { status: "skipped"; reason: "disabled" | "absent"; log: string };

/**
 * **판정 → (compare 국면에서만) 비교 → 로그 조립** 순서로 잇는다(전부 위임). (1) 판정은
 * `planCheckinBaselineCheck` — 그 예외는 **그대로 전파**. (2) `skip` 이면 비교 함수를 **호출하지
 * 않고** `CHECKIN_LOG_PREFIX` 기반 로그와 함께 `skipped`(`disabled` 는 경로 없이, `absent` 는
 * `plan.baselinePath` 를 싣는다). (3) `compare` 면 주입 함수를 `(envMeta,
 * resolveCheckinBaselineDir(repoRoot), candidate, options)` 로 **정확히 1 회** 호출하고 그 반환을
 * `formatCheckinOutcomeBlock` 에 넘겨 `log` 를, `comparison.regressed` 를 그대로 싣는다.
 *
 * **`compare` 형태 검증 시점** — 함수 여부 검사는 **비교 진입이 확정된 뒤**(3 단계)에만 한다. 즉
 * `skip` 두 국면에서는 `compare` 가 무효여도 예외가 없다(판정 단락 우선). **결정성 · 입력 불변 ·
 * exit code 불변** — 같은 입력은 늘 같은 결과, 인자 변형 0, 회귀에 throw 0.
 *
 * **`absent` 로그는 2 줄 · `compared` 로그는 3 줄** — 각각 기존 로그 뒤에
 * `formatCheckinCandidateLine` 결과를 개행 1 개로 잇는다(마지막 줄이 늘 candidate 줄). 그래서 두
 * 국면에서는 candidate 형태 불량이 포매터 예외로 **전파** 된다(`compared` 는 비교를 1 회 마친
 * 뒤 시점). `disabled` 는 무관 — 판정 단락이 우선이라 candidate 를 아예 보지 않는다(1 줄 불변).
 *
 * @param input 판정 재료 + 비교 재료.
 * @param compare 주입 비교 함수(`readCompareBaselineFile` 호환).
 * @returns 비교 국면(`compared`) 또는 단락 국면(`skipped`) 결과.
 * @throws {TypeError} `input` non-object · `null`, 비교 진입 확정 후 `compare` non-function, 그
 *   밖에 판정 · 경로 helper · 주입 함수 · 포매터(candidate 포함)가 던지는 것(전파).
 * @throws {RangeError} 판정 · 경로 helper · 포매터가 던지는 것(전파).
 */
export function runCheckinBaselineCheck(
  input: CheckinBaselineRunInput,
  compare: CheckinBaselineCompareFn,
): CheckinBaselineRunOutcome {
  // 1. 입력 형태 검증 — 필드 접근 전에 먼저 막는다.
  if (typeof input !== "object" || input === null) {
    throw new TypeError(
      "runCheckinBaselineCheck: input 은 object 이어야 함(null 불가)",
    );
  }
  // 2. 판정은 전적으로 위임(입력이 판정 helper 계약의 구조적 superset — 여분 필드는 무시된다).
  //    위임 예외(TypeError/RangeError)는 재검증 없이 그대로 전파.
  const plan = planCheckinBaselineCheck(input);
  // 3. skip 국면 — 비교 함수를 호출하지 않고 prefix 상수 기반 로그만 낸다.
  if (plan.mode === "skip") {
    if (plan.reason === "disabled") {
      // 토글 off 는 판정 단락이 우선 — candidate 를 검증도 노출도 하지 않는다(한 줄 불변).
      return {
        status: "skipped",
        reason: "disabled",
        log: `${CHECKIN_LOG_PREFIX} outcome=skipped reason=disabled`,
      };
    }
    // absent 는 기존 한 줄 **뒤에** candidate 지표 줄을 개행 1 개로 잇는다(정확히 2 줄). 최초
    // baseline 을 사람이 승인하려면 그 후보 수치가 CI 로그에 보여야 한다(ADR-0056
    // §Consequences (d) · §Follow-ups (a) 선행). write 국면은 여전히 만들지 않는다(§Decision 2).
    const log =
      `${CHECKIN_LOG_PREFIX} outcome=skipped reason=absent path=${plan.baselinePath}\n` +
      formatCheckinCandidateLine(input.candidate);
    return { status: "skipped", reason: "absent", log };
  }
  // 4. 비교 진입이 확정된 시점에만 주입 함수 형태를 검사한다(단락 국면에는 적용 안 함).
  if (typeof compare !== "function") {
    throw new TypeError(
      "runCheckinBaselineCheck: compare 는 function 이어야 함",
    );
  }
  // 5. 비교는 정확히 1 회 위임 호출 — baseDir 은 경로 helper 로만 얻는다.
  const baseDir = resolveCheckinBaselineDir(input.repoRoot);
  const result = compare(
    input.envMeta,
    baseDir,
    input.candidate,
    input.options,
  );
  // 6. 로그는 포매터 위임(재조립 · 형태 재검증 금지). 회귀여도 throw 하지 않는다. 그 블록 **뒤에**
  //    candidate 지표 줄을 개행 1 개로 이어 `absent` 국면과 대칭을 만든다 — baseline 을 체크인한
  //    뒤에는 CI 가 항상 이 분기로 떨어지므로, 여기에 축이 없으면 ADR-0056 §Decision 5 1 항의
  //    `label` 별 20 run 표본 축적 입력이 닫힌다. 블록 문자열 자체는 재조립 · 재포맷하지 않는다.
  const log =
    `${formatCheckinOutcomeBlock({ outcome: "compared", ...result })}\n` +
    formatCheckinCandidateLine(input.candidate);
  return { status: "compared", regressed: result.comparison.regressed, log };
}
