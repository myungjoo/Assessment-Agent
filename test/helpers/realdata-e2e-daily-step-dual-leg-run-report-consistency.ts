// realdata-e2e-daily-step-dual-leg-run-report-consistency.ts — 실 평가 e2e daily-step
// dual-leg run report 종단 컴포저 `buildRealDataDailyStepDualLegRunReport`(T-0894) 의
// **산출**(`RealDataDailyStepDualLegRunReport` =
// `{gitSha, dateToken, eval:{action,status}, collect:{action,status}, overallStatus, summaryLine}`)
// 6 필드 전체가 입력 `(evalOutcome, collectOutcome, run)` 으로부터 **컴포저 재호출 없이
// 독립 재유도**한 expected 와 deep-equal 정합한지 검증하는 순수 가드(T-0910 박제).
//
// 동기: dual-leg run report 축의 하위 parse seam 두 곳 — output-parse(T-0906 신설 →
// T-0907 self-wire)·search-parse(T-0908 신설 → T-0909 self-wire) — 에만 값-정합 가드가
// 박제됐고, 두 leg run outcome + run 식별자를 6 필드 report 로 묶는 **종단 컴포저**
// `buildRealDataDailyStepDualLegRunReport(evalOutcome, collectOutcome, run)` 에는 산출 6
// 필드 전체를 입력으로부터 컴포저 재호출 없이 독립 재유도해 deep-equal 대조하는 값-정합
// 가드가 부재였다. 그래서 per-leg status 파생(run+passed→pass/fail·skip→skip)·overallStatus
// 파생(fail 최우선 → some-fail/all-pass/all-skip/partial)·gitSha/dateToken 전파·summaryLine
// 템플릿 합성 중 어느 하나라도 값 drift 가 생겨도 build-time 에 잡히지 않았다. 본 가드는
// 컴포저 재호출 없이 `(evalOutcome, collectOutcome, run)` 만으로 expected 6 필드를 독립
// 재유도(leg 라벨 정합 → per-leg status 파생 → overallStatus 파생 → gitSha/dateToken 전파
// → summaryLine 동형 합성)한 뒤 산출 `report` 와 deep-equal 대조해, 그 값 drift 가
// build-time fail-fast 로 차단되게 한다(REQ-032 raw 미저장·REQ-059 입력 외 데이터 생성 0 —
// 손상 report 가 하위 descriptor/markdown/command-args wiring 으로 새기 전 차단). summary
// 축 선례 T-0725(`assertRealDataResultIssueOutcomeReportOutputConsistentWithInput`)의
// dual-leg 축 mirror 다.
//
// 재유도 규칙(single-source 동형): 컴포저(T-0894)와 동일한 산출 규약을 **독립 재구현**한다
// — run.gitSha/dateToken 빈/공백 → throw, leg 라벨 정합(eval 자리 eval·collect 자리
// collect, cross-wiring throw), per-leg status 파생(action="run"+passed=undefined throw,
// action="skip"+passed 정의 throw, run+passed=true→"pass"·false→"fail"·skip→"skip"),
// overallStatus 파생(fail 최우선 some-fail, 둘 다 pass→all-pass, 둘 다 skip→all-skip, 그
// 외 partial), summaryLine 을
// `[${dateToken}@${gitSha}] eval=${evalStatus} collect=${collectStatus} → ${overallStatus}`
// 로 동형 합성. 통과분을 6 키 report 객체로 정규화한다. 컴포저
// (`buildRealDataDailyStepDualLegRunReport`)는 **호출하지 않는다** — 재호출 deep-equal 은
// 양방향 drift 상쇄라 무의미하다(독립 재유도가 핵심). summaryLine 템플릿·overallStatus·
// per-leg status 규약은 컴포저와 byte-identical 하게 본 모듈이 재구현한다(재호출 0 원칙 유지).
//
// 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
//   - `report`/`evalOutcome`/`collectOutcome`/`run` 이 non-null 객체 아님·report 6 필드
//     type 위반·run.gitSha/dateToken 빈/공백·leg 라벨 오류·action="run"+passed=undefined·
//     action="skip"+passed 정의 등 입력 자체의 구조 결손 → 한국어 TypeError(재유도/비교
//     자체를 진행할 수 없는 경우).
//   - 재유도 expected 와 산출 report 의 어느 6 필드라도 값이 어긋남 → 한국어 RangeError
//     (값 정합 위반, 어느 필드가 기대 vs 실측 으로 drift 했는지 노출).
//   - silent 통과 0, fail-fast. 공백·대소문자 민감(추가 trim·case-fold 0).
//
// 비변형 / 순수: report·evalOutcome·collectOutcome·run 읽기·비교만(쓰기 0). 부수효과·
// `@Injectable`·Prisma·LLM·새 외부 dependency·env/네트워크/credential·gh 실행 0. 동일
// 입력 → 동일 동작. raw narrative 미저장(R-59 / REQ-032) — gitSha·dateToken·leg
// action/status·overallStatus·summaryLine 값만 다루며(outcome.specPath 는 report 로 전파
// 되지 않으므로 재유도 대상도 아님), 에러 메시지에 raw 활동 본문·credential·specPath 를
// 누설하지 않는다(report 필드 값만 노출).
//
// 순환 의존 없음(향후 self-wire top-level import 근거): 본 가드는 입력·출력 type 을 컴포저
// 파일에서 `import type` only 로, `RealDataResultIssueRunRef` 를
// `./realdata-e2e-result-issue-descriptor` 에서 `import type` 로 가져온다(value import 0).
// 따라서 후속 self-wire task 에서 컴포저가 본 가드를 top-level value import 해도 CommonJS
// 순환 의존이 생기지 않는다(T-0725→T-0726, T-0906→T-0907 mirror — 본 task 는 가드 신설만).
//
// Out of Scope (T-0910): 컴포저 본문 수정 / self-wire 배선(후속 task — T-0725→T-0726 분리
// 패턴 동형) · 하위 seam 값-가드(output-parse T-0906/07·search-parse T-0908/09) 수정 · 자동
// 복구/재합성/정규화 · zod·ajv 등 외부 validation 도입 · production `src/` 변경 — 전부 0.
import type {
  RealDataDailyStepLegRunOutcome,
  RealDataDailyStepDualLegRunReport,
  RealDataDailyStepLegStatus,
  RealDataDailyStepDualLegOverallStatus,
} from "./realdata-e2e-daily-step-dual-leg-run-report";
import type { RealDataResultIssueRunRef } from "./realdata-e2e-result-issue-descriptor";

// assertInputObject — 입력이 deep-equal 재유도를 진행하기 전 구조적으로 온전한지(non-null
// 객체·비배열) fail-fast 검증한다. 구조 결손은 RangeError 가 아니라 TypeError 로 구분한다
// (값 정합 위반과 분리).
function assertInputObject(value: unknown, label: string): void {
  if (typeof value !== "object" || value === null) {
    throw new TypeError(
      `${label} 이 non-null 객체가 아니다(타입: ${typeof value}, 값: ${String(
        value,
      )}) — dual-leg run report 산출 독립 재유도를 진행할 수 없다.`,
    );
  }
  if (Array.isArray(value)) {
    throw new TypeError(
      `${label} 이 배열이다 — ${label} 은 키-값 객체여야 하며 배열일 수 없다.`,
    );
  }
}

// assertNonBlankInput — 입력 식별자 문자열이 빈/공백-only 면 구조 결손 TypeError. 컴포저
// (T-0894 `assertNonBlank`)의 빈/공백 차단 규약을 독립 재구현한다(재호출 0). 비식별 입력이
// 재유도로 새는 것을 차단한다.
function assertNonBlankInput(value: unknown, fieldName: string): void {
  if (typeof value !== "string") {
    throw new TypeError(
      `${fieldName} 가 문자열이 아니다(타입: ${typeof value}, 값: ${String(
        value,
      )}) — dual-leg run report 산출 독립 재유도를 진행할 수 없다.`,
    );
  }
  if (value.trim().length === 0) {
    throw new TypeError(
      `${fieldName} 가 비어있다(빈/공백-only) — 비식별 입력은 dual-leg run report 재유도 대상이 아니다.`,
    );
  }
}

// reDeriveLegField — 한 leg outcome 으로부터 report 의 leg 필드 `{action, status}` 를
// **독립 재유도**한다. 컴포저(T-0894 `assertLegLabel`+`resolveLegStatus`) 규약을 재구현
// 한다: leg 라벨 정합(eval 자리 eval·collect 자리 collect, cross-wiring throw) → action
// 이 "run"|"skip" → action="run"+passed=undefined throw · action="skip"+passed 정의
// throw → run+passed=true→"pass"·false→"fail"·skip→"skip". 구조 결손은 TypeError 로
// 분기한다(값 정합 위반 RangeError 와 구분). 입력 객체를 읽기만 하고 변형하지 않는다.
function reDeriveLegField(
  outcome: RealDataDailyStepLegRunOutcome,
  expectedLeg: "eval" | "collect",
): { action: "run" | "skip"; status: RealDataDailyStepLegStatus } {
  assertInputObject(outcome, `${expectedLeg}Outcome`);

  // leg 라벨 정합(cross-wiring/mislabel 차단) — 컴포저 assertLegLabel 규약 동형.
  if (outcome.leg !== expectedLeg) {
    throw new TypeError(
      `leg 라벨 불일치 — "${expectedLeg}" 자리에 leg="${String(
        outcome.leg,
      )}" outcome 이 들어왔다(cross-wiring/mislabel 차단). 재유도를 진행할 수 없다.`,
    );
  }

  // action 규약(run|skip 만 허용) — 컴포저 resolveLegStatus 규약 동형.
  if (outcome.action !== "run" && outcome.action !== "skip") {
    throw new TypeError(
      `${expectedLeg} leg 의 action 이 "run"|"skip" 이 아니다(값: ${String(
        outcome.action,
      )}) — dual-leg run report 재유도 대상이 아니다.`,
    );
  }

  if (outcome.action === "run") {
    if (outcome.passed === undefined) {
      throw new TypeError(
        `${expectedLeg} leg 이 action="run" 인데 passed 가 undefined 다 — 불완전 run outcome(pass/fail 미결정)은 재유도 대상이 아니다.`,
      );
    }
    if (typeof outcome.passed !== "boolean") {
      throw new TypeError(
        `${expectedLeg} leg 의 passed 가 boolean 이 아니다(타입: ${typeof outcome.passed}) — dual-leg run report 재유도 대상이 아니다.`,
      );
    }
    return { action: "run", status: outcome.passed ? "pass" : "fail" };
  }

  // action === "skip"
  if (outcome.passed !== undefined) {
    throw new TypeError(
      `${expectedLeg} leg 이 action="skip" 인데 passed=${String(
        outcome.passed,
      )} 로 정의됐다 — skip 은 run 결과가 없어야 하는 모순 outcome 이라 재유도 대상이 아니다.`,
    );
  }
  return { action: "skip", status: "skip" };
}

// deriveOverallStatusInput — 두 leg status 로부터 전체 판정을 계산한다. fail 이 최우선.
// 컴포저(T-0894 `deriveOverallStatus`) 규약을 독립 재구현한다(재호출 0).
function deriveOverallStatusInput(
  evalStatus: RealDataDailyStepLegStatus,
  collectStatus: RealDataDailyStepLegStatus,
): RealDataDailyStepDualLegOverallStatus {
  if (evalStatus === "fail" || collectStatus === "fail") {
    return "some-fail";
  }
  if (evalStatus === "pass" && collectStatus === "pass") {
    return "all-pass";
  }
  if (evalStatus === "skip" && collectStatus === "skip") {
    return "all-skip";
  }
  return "partial";
}

// reDeriveExpectedReport — `(evalOutcome, collectOutcome, run)` 만으로 expected
// `RealDataDailyStepDualLegRunReport` 6 필드를 **독립 재유도**한다. 컴포저(T-0894)의 산출
// 규약(run.gitSha/dateToken 빈/공백 guard → leg 라벨 정합 → per-leg status 파생 →
// overallStatus 파생 → summaryLine 동형 합성 → 6 키 정규화)을 의도적으로 재구현
// (`buildRealDataDailyStepDualLegRunReport` 재호출 0 — 재호출은 양방향 drift 상쇄로 의미가
// 없다). 입력 자체의 구조 결손은 TypeError 로 분기한다(값 정합 위반 RangeError 와 구분).
// 입력 객체를 읽기만 하고 변형하지 않는다.
function reDeriveExpectedReport(
  evalOutcome: RealDataDailyStepLegRunOutcome,
  collectOutcome: RealDataDailyStepLegRunOutcome,
  run: RealDataResultIssueRunRef,
): RealDataDailyStepDualLegRunReport {
  // run 식별자 구조·빈/공백 guard(비식별 리포트 차단) — 컴포저 규약 동형 재구현.
  assertInputObject(run, "run");
  assertNonBlankInput(run.gitSha, "run.gitSha");
  assertNonBlankInput(run.dateToken, "run.dateToken");

  // per-leg 필드 독립 재유도(leg 라벨 정합 + action/passed 정합 guard 동반).
  const evalField = reDeriveLegField(evalOutcome, "eval");
  const collectField = reDeriveLegField(collectOutcome, "collect");

  // overallStatus 파생(두 leg status 로부터).
  const overallStatus = deriveOverallStatusInput(
    evalField.status,
    collectField.status,
  );

  // summaryLine 동형 합성 — 컴포저 템플릿 byte-identical 재구현.
  const summaryLine = `[${run.dateToken}@${run.gitSha}] eval=${evalField.status} collect=${collectField.status} → ${overallStatus}`;

  // 6 키 정규화(추가 필드 0, 무공유). eval/collect 도 새 객체.
  return {
    gitSha: run.gitSha,
    dateToken: run.dateToken,
    eval: { action: evalField.action, status: evalField.status },
    collect: { action: collectField.action, status: collectField.status },
    overallStatus,
    summaryLine,
  };
}

// assertLegShape — report 의 leg 필드(`eval`/`collect`)가 `{action, status}` 2 키 객체이며
// action/status 가 문자열인지 fail-fast 검증한다. 구조 결손은 TypeError 로 분기.
function assertLegShape(value: unknown, label: string): void {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(
      `report.${label} 이 non-null 객체가 아니다(타입: ${typeof value}) — dual-leg run report 독립 재유도 정합 비교를 진행할 수 없다.`,
    );
  }
  const leg = value as { action?: unknown; status?: unknown };
  if (typeof leg.action !== "string") {
    throw new TypeError(
      `report.${label}.action 이 문자열이 아니다(타입: ${typeof leg.action}) — dual-leg run report 정합 비교를 진행할 수 없다.`,
    );
  }
  if (typeof leg.status !== "string") {
    throw new TypeError(
      `report.${label}.status 가 문자열이 아니다(타입: ${typeof leg.status}) — dual-leg run report 정합 비교를 진행할 수 없다.`,
    );
  }
}

// REPORT_STRING_FIELDS — 산출 report 최상위 문자열 필드 4 종(gitSha/dateToken/
// overallStatus/summaryLine). eval/collect 는 중첩 객체라 별도(assertLegShape) 검증.
const REPORT_STRING_FIELDS = [
  "gitSha",
  "dateToken",
  "overallStatus",
  "summaryLine",
] as const;

// assertReportStructure — 산출 `report` 와 6 필드의 type 이 deep-equal 비교를 진행하기 전
// 구조적으로 온전한지 fail-fast 검증. 구조/타입 결손은 RangeError 가 아니라 TypeError 로
// 구분한다(값 정합 위반과 분리).
function assertReportStructure(
  report: RealDataDailyStepDualLegRunReport,
): asserts report is RealDataDailyStepDualLegRunReport {
  if (typeof report !== "object" || report === null) {
    throw new TypeError(
      `report 가 non-null 객체가 아니다(타입: ${typeof report}, 값: ${String(
        report,
      )}) — 컴포저 산출은 RealDataDailyStepDualLegRunReport 객체여야 한다.`,
    );
  }
  if (Array.isArray(report)) {
    throw new TypeError(
      "report 가 배열이다 — report 는 {gitSha, dateToken, eval, collect, overallStatus, summaryLine} 키-값 객체여야 하며 배열일 수 없다.",
    );
  }
  for (const field of REPORT_STRING_FIELDS) {
    if (typeof report[field] !== "string") {
      throw new TypeError(
        `report.${field} 가 문자열이 아니다(타입: ${typeof report[field]}) — dual-leg run report 독립 재유도 정합 비교를 진행할 수 없다.`,
      );
    }
  }
  assertLegShape(report.eval, "eval");
  assertLegShape(report.collect, "collect");
}

// isReportDeepEqual — 두 `RealDataDailyStepDualLegRunReport` 가 6 필드(최상위 4 string +
// eval/collect 중첩 {action,status})·추가필드 drop(최상위 키 정확히 6개·leg 키 정확히 2개)
// 면에서 deep-equal 인지 비교한다. 재유도 expected 는 항상 6 키·leg 2 키만 가지므로 산출이
// 추가 키를 누설하면 키 개수 불일치로 잡는다. 순수 비교(쓰기 0).
function isReportDeepEqual(
  actual: RealDataDailyStepDualLegRunReport,
  expected: RealDataDailyStepDualLegRunReport,
): boolean {
  // 추가필드 drop 정합 — 최상위 6 키·leg 2 키.
  if (Object.keys(actual).length !== 6) {
    return false;
  }
  if (
    Object.keys(actual.eval).length !== 2 ||
    Object.keys(actual.collect).length !== 2
  ) {
    return false;
  }
  return (
    actual.gitSha === expected.gitSha &&
    actual.dateToken === expected.dateToken &&
    actual.eval.action === expected.eval.action &&
    actual.eval.status === expected.eval.status &&
    actual.collect.action === expected.collect.action &&
    actual.collect.status === expected.collect.status &&
    actual.overallStatus === expected.overallStatus &&
    actual.summaryLine === expected.summaryLine
  );
}

/**
 * 실 평가 e2e daily-step dual-leg run report 종단 컴포저 산출 `report` 의 **값** 6 필드
 * 전체가 입력 `(evalOutcome, collectOutcome, run)` 으로부터 컴포저 재호출 없이 독립 재유도한
 * expected 와 deep-equal 정합함을 런타임에서 검증하는 순수 가드(PLAN.md P5 109행 step ④
 * dual-leg 박제 chain 의 종단 산출 무결성 조각 / REQ-059·REQ-032). 하위 seam 값-가드
 * (output-parse T-0906/07·search-parse T-0908/09) 보완 mirror — 그 둘은 파서 seam 값만
 * 검증하므로 종단 컴포저의 per-leg status/overallStatus/summaryLine 파생 drift 를 놓치지만,
 * 본 가드는 `(evalOutcome, collectOutcome, run)` 을 독립 재유도해 6 필드 회귀를 fail-fast
 * 로 잡는다. summary 축 T-0725 의 dual-leg 축 mirror.
 *
 * 불변식: expected = `(evalOutcome, collectOutcome, run)` 에서 run.gitSha/dateToken 빈/공백
 * guard → leg 라벨 정합 → per-leg status 파생 → overallStatus 파생 → gitSha/dateToken 전파
 * → summaryLine 동형 합성 → 6 키 정규화로 독립 재유도한 객체. 산출 `report` 와 6 필드 값·키
 * 집합(추가필드 drop)이 전부 deep-equal(===) 이어야 한다. 컴포저 재호출 0(독립 재유도).
 *
 * 에러 정책: report/evalOutcome/collectOutcome/run 비-non-null-객체/배열·report 6 필드 type
 * 위반·run.gitSha/dateToken 빈/공백·leg 라벨 오류·action="run"+passed=undefined·
 * action="skip"+passed 정의 → TypeError(구조 결손). 재유도 expected 와 report 가 6 필드 값·
 * 추가필드 면에서 drift → RangeError(기대 vs 실측 노출, 값 정합 위반). silent 통과 0,
 * fail-fast. 공백·대소문자 민감(추가 trim·case-fold 0).
 *
 * @param report 검증 대상 컴포저 산출(`buildRealDataDailyStepDualLegRunReport` 결과).
 *   변형하지 않는다(읽기·비교만).
 * @param evalOutcome 산출의 single source eval leg outcome. 변형하지 않는다(읽기·재유도만).
 * @param collectOutcome 산출의 single source collect leg outcome. 변형하지 않는다.
 * @param run 산출의 single source run 식별자(gitSha/dateToken). 변형하지 않는다.
 * @returns 정합하면 정상 반환(void).
 * @throws {TypeError} report/evalOutcome/collectOutcome/run 비-non-null-객체/배열·report 6
 *   필드 type 위반·run.gitSha/dateToken 빈/공백·leg 라벨 오류·action/passed 모순(구조 결손).
 * @throws {RangeError} 재유도 expected 와 report 가 6 필드 값·추가필드 drift(값 정합 위반,
 *   기대 vs 실측 포함).
 */
export function assertRealDataDailyStepDualLegRunReportConsistentWithInput(
  report: RealDataDailyStepDualLegRunReport,
  evalOutcome: RealDataDailyStepLegRunOutcome,
  collectOutcome: RealDataDailyStepLegRunOutcome,
  run: RealDataResultIssueRunRef,
): void {
  // 구조 검증(TypeError 분기) — report 객체+6 필드 type 및 (evalOutcome, collectOutcome,
  // run) 독립 재유도(내부에서 입력 객체·leg 라벨·action/passed·run 식별자 구조 검증).
  assertReportStructure(report);
  const expected = reDeriveExpectedReport(evalOutcome, collectOutcome, run);

  // 값 정합 비교(RangeError 분기) — 6 필드 값·추가필드 deep-equal.
  if (!isReportDeepEqual(report, expected)) {
    throw new RangeError(
      `정합 위반: 컴포저 산출 report 가 (evalOutcome, collectOutcome, run) 으로부터 독립 재유도한 expected 와 deep-equal 하지 않다 — 기대=${JSON.stringify(
        expected,
      )}, 실측=${JSON.stringify(
        report,
      )}. gitSha/dateToken 전파·per-leg status 파생·overallStatus 파생·summaryLine 합성 또는 추가필드 drop 이 drift 했거나 입력과 어긋났다.`,
    );
  }
}
