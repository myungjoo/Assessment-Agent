/**
 * 체크인 baseline step 요약 markdown 을 **GitHub Actions job 요약 파일에 append 하는 주입식
 * sink 단일 진입점** (REQ-048, ADR-0056 §Decision 3 (b) · §Follow-ups (b)).
 *
 * §Decision 3 (b) 는 상대 회귀를 **"로그와 step 요약으로 가시화만 하고 exit code 를 바꾸지
 * 않는다"** 고 못 박았다. **요약 조립** 축은 `formatCheckinStepSummaryBlock` 이 확정했으나 그
 * 문자열을 job 요약으로 **내보내는 경로** 가 저장소에 없어 관찰-only 정책의 유일한 신호인 가시성이
 * 0 이었다. 본 모듈은 그 배선의 첫 조각 — 블록을 `$GITHUB_STEP_SUMMARY` 경로에 붙이는 sink — 만
 * 책임진다(호출처 배선 · 기본 주입값 바인딩은 다음 slice).
 *
 * **전역 접근 0** — 환경변수 record 와 append 함수를 전부 **주입**받고 `process.env` 를 읽거나
 * `fs` 를 import 하지 않는다(`checkin-baseline-run.ts` 주입 패턴과 동형 — 결정론 보존).
 * **exit code 불변** — append 가 무엇을 던져도 삼켜 `failed` 로만 보고한다(요약 기록 실패가 CI 를
 * 빨갛게 만들면 §Decision 3 (b) 약속이 깨진다). 단 **인자 형태 위반**(프로그래머 오류)은 형제
 * 모듈과 동일하게 `TypeError` / `RangeError` 로 던진다. **본문 가공 0** — trim · 재정렬 ·
 * 이스케이프 · 재포맷 없이 싣고, 블록끼리 붙지 않게 **끝 개행 1 개 보장** 만 한다.
 */

/**
 * GitHub Actions 가 job 요약 파일 경로를 싣는 **환경변수명**. 다음 배선 slice 와 spec 이 문자열을
 * 다시 적지 않도록 이 한 곳에만 적고 export 한다.
 */
export const GITHUB_STEP_SUMMARY_ENV = "GITHUB_STEP_SUMMARY";

/** 주입 append 함수 타입 — `fs.appendFileSync(path, data)` 와 구조적으로 호환. */
export type StepSummaryAppendFn = (path: string, data: string) => void;

/** 입력 — 환경변수 record 와 append 함수를 전부 주입받는다(전역 접근 0). */
export interface CheckinStepSummarySinkDeps {
  /** 환경변수 record(요약 파일 경로 조회용 — 전역을 직접 읽지 않기 위해 주입받는다). */
  processEnv: Record<string, string | undefined>;
  /** append 수행 함수(`fs.appendFileSync` 호환). skip 국면에서는 호출하지 않는다. */
  append: StepSummaryAppendFn;
}

/**
 * 결과 판별 union — `"appended"` 는 append 수행(대상 경로 포함), `"skipped"` 는 append 함수를
 * **호출하지 않은** 단락(환경변수 부재 · 빈/공백-only), `"failed"` 는 append 함수가 던진 값을
 * 삼킨 국면. 사유는 영어 기계 분류용 슬러그.
 */
export type CheckinStepSummarySinkOutcome =
  | { status: "appended"; path: string }
  | { status: "skipped"; reason: "env-absent" | "env-blank" }
  | { status: "failed"; reason: "append-threw" };

/**
 * 조립된 step 요약 블록을 `$GITHUB_STEP_SUMMARY` 파일에 **정확히 1 회** append 한다(재시도 ·
 * 중복 호출 0). 순서는 (1) 인자 형태 검증 → (2) 환경변수 조회 · 단락 판정 → (3) append 위임.
 *
 * **환경변수 단락** — 키가 없으면 `skipped`(`env-absent`), 값이 빈/공백-only 면
 * `skipped`(`env-blank`). 두 국면 모두 append 를 **0 회** 호출한다(job 요약이 없는 로컬 실행에서
 * 요약 기록은 그냥 없는 일이 되어야 한다).
 *
 * **본문 가공 0 · 끝 개행 1 개 보장** — 블록은 그대로 싣되 개행으로 끝나지 않을 때만 개행 1 개를
 * 덧붙인다(포매터가 "이음은 호출측 책임"으로 남긴 몫). **순수성** — 인자(`deps` · 환경변수
 * record)를 변형하지 않고 append 호출 밖 부작용이 0 이라 같은 입력은 늘 같은 결과를 낸다.
 *
 * @param block 요약 파일에 실을 markdown 블록(`formatCheckinStepSummaryBlock` 결과 상정).
 * @param deps 환경변수 record + append 함수 주입 묶음.
 * @returns append 수행(`appended`) · 단락(`skipped`) · 삼킨 실패(`failed`) 판별 union.
 * @throws {TypeError} `block` non-string, `deps` non-object · `null` · `undefined`,
 *   `deps.processEnv` non-object · `null`, `deps.append` non-function 일 때(프로그래머 오류).
 * @throws {RangeError} `block` 이 빈/공백-only 일 때(요약에 실을 내용이 없다). append 함수가
 *   던지는 값은 **어떤 것도 전파하지 않는다** — 삼켜서 `failed` 로만 낸다(exit code 불변).
 */
export function appendCheckinStepSummary(
  block: string,
  deps: CheckinStepSummarySinkDeps,
): CheckinStepSummarySinkOutcome {
  // 1. 인자 형태 검증 — 프로그래머 오류는 삼키지 않고 즉시 던진다(관찰-only 계약과 별개).
  if (typeof block !== "string") {
    throw new TypeError("appendCheckinStepSummary: block 은 string 이어야 함");
  }
  if (block.trim() === "") {
    throw new RangeError(
      "appendCheckinStepSummary: block 은 빈/공백-only string 일 수 없음",
    );
  }
  if (typeof deps !== "object" || deps === null) {
    throw new TypeError(
      "appendCheckinStepSummary: deps 는 object 이어야 함(null 불가)",
    );
  }
  const { processEnv, append } = deps;
  if (typeof processEnv !== "object" || processEnv === null) {
    throw new TypeError(
      "appendCheckinStepSummary: deps.processEnv 는 object 이어야 함(null 불가)",
    );
  }
  if (typeof append !== "function") {
    throw new TypeError(
      "appendCheckinStepSummary: deps.append 는 function 이어야 함",
    );
  }
  // 2. 요약 파일 경로 조회 — 키 부재와 빈/공백-only 값을 다른 슬러그로 구분해 단락한다.
  const path = processEnv[GITHUB_STEP_SUMMARY_ENV];
  if (path === undefined) {
    return { status: "skipped", reason: "env-absent" };
  }
  if (typeof path !== "string" || path.trim() === "") {
    return { status: "skipped", reason: "env-blank" };
  }
  // 3. 본문은 손대지 않고 끝 개행만 보장한다(블록끼리 붙는 것 방지 — 이미 개행이면 그대로).
  const data = block.endsWith("\n") ? block : `${block}\n`;
  // 4. append 는 정확히 1 회 위임. 실패는 삼켜 failed 로만 보고한다(exit code 불변).
  try {
    append(path, data);
  } catch {
    return { status: "failed", reason: "append-threw" };
  }
  return { status: "appended", path };
}
