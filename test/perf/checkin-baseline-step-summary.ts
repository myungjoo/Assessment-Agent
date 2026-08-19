/**
 * 체크인 baseline confirm-or-compare **결과의 CI job step 요약 markdown 조립 진입점**
 * (REQ-048, ADR-0056 §Decision 3 (b) · §Follow-ups (b)).
 *
 * ADR-0056 §Decision 3 (b) 는 baseline 대비 상대 회귀를 **"로그와 step 요약으로 가시화만 하고
 * exit code 를 바꾸지 않는다"** 고 못 박았다. 이 중 **로그** 축은
 * `checkin-baseline-report.ts`(`formatCheckinOutcomeLine` / `formatCheckinOutcomeBlock`) 가
 * 단일 진입점으로 잡았으나, **step 요약** 축은 저장소에 한 줄도 없었다. 관찰-only 정책에서는
 * 가시성이 유일한 신호라, 수천 줄 CI 로그에 묻힌 회귀 관찰은 사실상 안 보이는 것과 같다.
 * 본 모듈은 그 요약 markdown 표기를 **한 곳** 에 모아 후속 slice(`$GITHUB_STEP_SUMMARY` append
 * 배선 · workflow 노출)가 공유하게 한다.
 *
 * **리포트 재구현 0** — 상세 본문은 `formatCheckinOutcomeBlock` 결과 문자열을 **그대로** 코드
 * 블록에 싣는다. 수치 계산 · 재포맷 · 임계 판정 · 반올림을 본 모듈에서 하지 않고,
 * `CHECKIN_LOG_PREFIX` 같은 기존 상수도 새 문자열로 다시 적지 않는다(하위 진입점 경유).
 * **순수 · 부작용 0** — 파일 시스템 · 환경변수 · 시각 · 난수 접근이 한 줄도 없고 인자를 변형하지
 * 않는다. **exit code 불변** — 회귀(`regressed === true`) 입력에도 throw 하지 않고 문자열만 낸다.
 */

import { formatCheckinOutcomeBlock } from "./checkin-baseline-report";
import { ConfirmOrCompareResult } from "./latency-baseline-io";

/**
 * markdown fenced code block 울타리의 **최소 길이**(백틱 3 개). 표기가 갈리지 않도록 최소치는
 * 이 상수 한 곳에만 적고, 실제 길이는 본문에 맞춰 `resolveFenceForBody` 가 산출한다.
 */
const MIN_FENCE_LENGTH = 3;

/** 본문 안의 **연속 백틱 런** 을 모두 훑는 패턴(본문을 바꾸지 않고 세기만 한다). */
const BACKTICK_RUN = /`+/g;

/**
 * 본문을 감쌀 여닫이 울타리 문자열을 산출한다 — 길이는 `max(3, 본문 안 최장 백틱 런 + 1)`.
 * markdown 은 여는 울타리보다 짧은 백틱 런을 코드로 취급하므로, 본문에 백틱 3 개 이상의 런이
 * 섞이면 고정 3-백틱 울타리는 그 지점에서 블록을 **조기 종료** 시켜 이후 요약이 사라진다.
 * 본문을 지우거나 이스케이프하지 않고 **울타리만 늘려** 그 소실을 막는다(본문 가공 0).
 *
 * **순수 · 부작용 0** — 인자를 변형하지 않고 파일 시스템 · 환경변수 · 시각 · 난수 접근이 없다.
 *
 * @param body 코드 블록에 실을 본문 문자열(훑기만 하고 가공하지 않는다).
 * @returns 백틱만으로 이뤄진 울타리 문자열(길이 ≥ 3). 여는 · 닫는 울타리에 같은 값을 쓴다.
 * @throws 없음 — 어떤 string 입력(빈 문자열 · 백틱-only 포함)에도 throw 하지 않는다
 *   (ADR-0056 §Decision 3 (b) 관찰-only 계약 보호).
 */
export function resolveFenceForBody(body: string): string {
  let longestRun = 0;
  for (const run of body.match(BACKTICK_RUN) ?? []) {
    if (run.length > longestRun) {
      longestRun = run.length;
    }
  }
  return "`".repeat(Math.max(MIN_FENCE_LENGTH, longestRun + 1));
}

/**
 * 회귀 관찰 상태 한 줄을 만든다. 세 국면 모두 **exit code 불변(관찰-only)** 임을 명시해,
 * 요약만 보는 사람이 "CI 를 빨갛게 만드는 신호"로 오해하지 않게 한다.
 *
 * 형태 검증은 하지 않는다 — 호출 시점에 이미 `formatCheckinOutcomeBlock` 이 계약을 통과시킨
 * 결과만 넘어오므로, 여기서 다시 검증하면 예외 계약이 두 곳으로 갈린다.
 */
function statusLine(result: ConfirmOrCompareResult): string {
  if (result.outcome === "established") {
    return "- 회귀 관찰: 해당 없음(최초 baseline 확정) — exit code 불변(관찰-only).";
  }
  return result.comparison.regressed
    ? "- 회귀 관찰: **회귀 관찰됨** — exit code 불변(관찰-only, ADR-0056 §Decision 3 (b))."
    : "- 회귀 관찰: 회귀 없음 — exit code 불변(관찰-only, ADR-0056 §Decision 3 (b)).";
}

/**
 * confirm-or-compare 결과를 GitHub Actions **job 요약용 markdown 블록** 으로 조립한다.
 * 순서는 ① `## <sectionTitle>` heading, ② 회귀 관찰 상태 한 줄, ③ `formatCheckinOutcomeBlock`
 * 결과를 감싼 fenced code block 이며, 세 조각은 빈 줄 하나로 구분한다(markdown 렌더 안정).
 *
 * **본문 가공 0** — code block 안 문자열은 하위 진입점 결과를 trim · 재정렬 · 이스케이프 · 재계산
 * 없이 그대로 싣는다. 본문에 백틱 런이 섞여 있으면 본문을 손대는 대신 **울타리 길이를**
 * `resolveFenceForBody` 로 늘려 블록 조기 종료를 막는다. 회귀 입력에서도 throw 하지 않는다
 * (ADR-0056 §Decision 3 (b) 관찰-only).
 *
 * @param result confirm-or-compare 판별 union(`established` | `compared`).
 * @param sectionTitle 요약 heading 문구(빈/공백-only 불가 — 제목 없는 섹션은 요약 화면에서 무의미).
 * @returns 개행으로 이어붙인 markdown 블록(끝에 개행을 덧붙이지 않는다 — 이음은 호출측 책임).
 * @throws {TypeError} `sectionTitle` 이 non-string 일 때, 그리고 하위 진입점의 모든 `TypeError`
 *   (`result` non-object · `null`, `outcome` non-string, `established` 의 `path` non-string,
 *   `compared` 의 `comparison` non-object · `regressed` non-boolean · `report` non-string).
 * @throws {RangeError} `sectionTitle` 이 빈/공백-only 일 때, 그리고 하위 진입점의 모든
 *   `RangeError`(`outcome` 허용 밖 문자열, `path` · `report` 가 빈/공백-only).
 */
export function formatCheckinStepSummaryBlock(
  result: ConfirmOrCompareResult,
  sectionTitle: string,
): string {
  // 1. 본 모듈이 유일하게 책임지는 인자(heading 문구) 검증 — 하위 진입점이 모르는 값이다.
  if (typeof sectionTitle !== "string") {
    throw new TypeError(
      "formatCheckinStepSummaryBlock: sectionTitle 는 string 이어야 함",
    );
  }
  if (sectionTitle.trim() === "") {
    throw new RangeError(
      "formatCheckinStepSummaryBlock: sectionTitle 는 빈/공백-only string 일 수 없음",
    );
  }
  // 2. result 형태 검증 · 상세 본문 조립은 전적으로 로그 진입점에 위임(중복 검증 · 재구현 금지).
  const body = formatCheckinOutcomeBlock(result);
  // 3. 울타리는 본문의 최장 백틱 런에 맞춰 산출한다(여는 · 닫는 울타리 동일 문자열).
  const fence = resolveFenceForBody(body);
  // 4. heading → 상태 줄 → code block 순으로 이어붙인다(수치 가공 0).
  return [
    `## ${sectionTitle}`,
    "",
    statusLine(result),
    "",
    fence,
    body,
    fence,
  ].join("\n");
}
