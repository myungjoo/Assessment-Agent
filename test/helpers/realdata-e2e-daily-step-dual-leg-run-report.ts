// realdata-e2e-daily-step-dual-leg-run-report.ts — 실 평가 e2e daily-test 가 nightly 로
// spawn 하는 eval leg + collect leg 두 jest run 의 outcome → 하나의 rolling-issue 박제용
// dual-leg run report descriptor 순수 컴포저 (T-0894 박제).
//
// 책임: PLAN.md 109행 step ④(daily-test 가 eval leg + collect leg 를 각 1 회 spawn 한 뒤
//   결과를 result/rolling 이슈에 박제) 의 결과-박제 측 gap 을 메운다. 두 leg command-plan
//   측(T-0611↔T-0887 …)은 닫혔고 수렴 smoke(T-0893)까지 박제됐으나, 두 leg 의 run
//   outcome(run→pass / run→fail / skip)을 한 report 로 묶는 layer 는 부재했다. 본 컴포저가
//   그 gap 을 순수 함수로 메운다 — (두 leg run outcome, run 식별자) → 결정론적 dual-leg run
//   report(per-leg status + overall status + byte-identical summaryLine).
//
//   기존 컴포저와의 경계(재구현/재호출 0): `buildRealDataResultIssueOutcomeReport`(T-0590)
//   는 단일 gh 박제 결과 → 리포트(leg 개념 없음), `buildRealDataResultSummary`(T-0580/581)
//   는 eval leg `EvaluationResult[]` 만 집계(collect 미포함). 본 report 는 평가 narrative/
//   정량 집계 없이 leg 별 run status + run 식별자만 보유(REQ-059 raw 미저장 정합).
//
// 🔥 엄격 검증: gitSha/dateToken 공백 → throw, leg 라벨 mislabel/cross-wiring → throw,
//   run 인데 passed undefined(불완전) → throw, skip 인데 passed 정의(모순) → throw.
// 🔥 결정론·무공유: 입력 외 상태 의존 0, 동일 입력 → byte-identical, 입력 mutate 0,
//   매 호출 새 객체. report 는 실 credential 을 담지 않음(§9 echo 0).
// 🔥 build-time 완결: 실 jest spawn / 실 gh / 네트워크 / env 읽기 / live-LLM / 외부
//   라이브러리 0 — 내장 수동 검증만. 순수 함수(cloud cron 자율 실행 가능).
// Out of Scope: 실 daily-test bash 배선 / 실 jest spawn / 실 leg outcome 캡처 / 실 gh
//   박제 / credential wiring(step ④ live wiring — credential gate) / EvaluationResult[]
//   집계·렌더(T-0580/581) / 두 leg command-plan·gating·가드 수정(개념 참조만).
//
// 산출 report 6 필드(gitSha/dateToken/eval/collect/overallStatus/summaryLine) 전체가 입력
// (evalOutcome, collectOutcome, run) 으로부터 컴포저 재호출 없이 독립 재유도한 expected 와
// deep-equal 정합한지 검증하는 값-정합 가드(T-0910 신설)를 컴포저 산출 경로에 self-wire
// 한다(T-0911). 단일 return 사이트 직전에 산출 report + 세 입력을 넘겨 self-assert — per-leg
// status 파생·overallStatus 파생·gitSha/dateToken 전파·summaryLine 합성 중 값 drift 를
// build-time fail-fast 로 닫는다. 가드가 컴포저 type(RealDataDailyStepLegRunOutcome/
// RealDataDailyStepDualLegRunReport 등)을 type-only import 로만 가져와 컴포저 value 를
// import 하지 않으므로(value import 0), 컴포저가 본 가드를 top-level value import 해도
// 순환 의존이 생기지 않는다(summary 축 T-0726·dual-leg output 축 T-0907·search 축 T-0909
// type-only top-level import mirror — lazy require 불요).
import { assertRealDataDailyStepDualLegRunReportConsistentWithInput } from "./realdata-e2e-daily-step-dual-leg-run-report-consistency";
import type { RealDataResultIssueRunRef } from "./realdata-e2e-result-issue-descriptor";

// RealDataDailyStepLegRunOutcome — 한 leg(eval | collect)의 jest run outcome 입력.
//   - leg: 이 outcome 이 어느 leg 의 것인가("eval" | "collect"). 컴포저가 인자 위치와
//     라벨 정합(mislabel/cross-wiring 차단)을 강제한다.
//   - action: 그 leg 의 command-plan 이 실제로 무엇을 했는가("run" → jest spawn,
//     "skip" → gating 부재로 조용한 SKIP).
//   - passed: action === "run" 일 때만 정의(true → run→pass, false → run→fail).
//     action === "skip" 이면 undefined(정의되면 모순 outcome 으로 throw).
//   - specPath: 그 leg 가 돌린 canonical spec 경로(선택 — 진단용, report 로 전파 0).
export interface RealDataDailyStepLegRunOutcome {
  leg: "eval" | "collect";
  action: "run" | "skip";
  passed?: boolean;
  specPath?: string;
}

// per-leg 파생 status — run+passed=true → "pass", run+passed=false → "fail",
// skip → "skip". report 의 eval/collect 필드가 이 status 를 담는다.
export type RealDataDailyStepLegStatus = "pass" | "fail" | "skip";

// overallStatus — 두 leg status 로부터 파생하는 nightly run 전체 판정.
//   - "all-pass": 두 leg 모두 pass.
//   - "some-fail": 하나라도 fail(fail 이 최우선 — 다른 leg 가 skip 이어도 some-fail).
//   - "all-skip": 두 leg 모두 skip.
//   - "partial": 그 외 혼합(fail 없이 pass/skip 이 섞임).
export type RealDataDailyStepDualLegOverallStatus =
  | "all-pass"
  | "some-fail"
  | "all-skip"
  | "partial";

// RealDataDailyStepDualLegRunReport — 두 leg run outcome + run 식별자를 하나의
// rolling-issue 박제용으로 묶는 결정론적 report descriptor.
//   - gitSha / dateToken: run 식별자(run 에서 전파).
//   - eval / collect: 각 leg 의 { action, status }(action 은 outcome 에서 전파,
//     status 는 action+passed 로 파생).
//   - overallStatus: 두 leg status 로부터 파생한 전체 판정.
//   - summaryLine: 사람-친화 한 줄 요약(동일 입력 → byte-identical). gitSha/dateToken +
//     두 leg status + overallStatus 를 포함.
export interface RealDataDailyStepDualLegRunReport {
  gitSha: string;
  dateToken: string;
  eval: { action: "run" | "skip"; status: RealDataDailyStepLegStatus };
  collect: { action: "run" | "skip"; status: RealDataDailyStepLegStatus };
  overallStatus: RealDataDailyStepDualLegOverallStatus;
  summaryLine: string;
}

// 빈/공백-only 식별자 guard — 비식별 리포트(잘못된 run 식별자)를 방지하기 위해 대상
// 문자열이 빈 문자열·공백-only 면 명시적 throw(조용한 통과 차단). T-0582 `assertNonBlank`
// 규약과 동형.
function assertNonBlank(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new Error(
      `${fieldName} 가 비어있습니다 — 비식별 dual-leg run report 방지를 위해 빈/공백-only 값은 허용되지 않습니다.`,
    );
  }
}

// leg 라벨 guard — outcome 이 인자 위치가 기대하는 leg 라벨과 일치하는지 검증한다.
// eval 자리에 collect outcome 이(또는 그 반대) 들어오는 cross-wiring / mislabel 을
// 조용히 통과시키지 않고 명시적 throw 한다.
function assertLegLabel(
  outcome: RealDataDailyStepLegRunOutcome,
  expectedLeg: "eval" | "collect",
): void {
  if (outcome.leg !== expectedLeg) {
    throw new Error(
      `leg 라벨 불일치 — "${expectedLeg}" 자리에 leg="${outcome.leg}" outcome 이 들어왔습니다(cross-wiring/mislabel 차단).`,
    );
  }
}

// outcome 정합 guard + per-leg status 파생 — action/passed 조합의 무결성을 검증하고
// 파생 status 를 반환한다.
//   - action === "run" 인데 passed === undefined → throw(불완전 run outcome).
//   - action === "skip" 인데 passed !== undefined → throw(모순 outcome).
//   - run + passed=true → "pass", run + passed=false → "fail", skip → "skip".
function resolveLegStatus(
  outcome: RealDataDailyStepLegRunOutcome,
): RealDataDailyStepLegStatus {
  if (outcome.action === "run") {
    if (outcome.passed === undefined) {
      throw new Error(
        `leg="${outcome.leg}" outcome 이 action="run" 인데 passed 가 undefined 입니다 — 불완전 run outcome(pass/fail 미결정)은 허용되지 않습니다.`,
      );
    }
    return outcome.passed ? "pass" : "fail";
  }
  // action === "skip"
  if (outcome.passed !== undefined) {
    throw new Error(
      `leg="${outcome.leg}" outcome 이 action="skip" 인데 passed=${outcome.passed} 로 정의됐습니다 — skip 은 run 결과가 없어야 하는 모순 outcome 입니다.`,
    );
  }
  return "skip";
}

// overallStatus 파생 — 두 leg status 로부터 전체 판정을 계산한다. fail 이 최우선.
function deriveOverallStatus(
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

// buildRealDataDailyStepDualLegRunReport — 두 leg run outcome(eval + collect) + run
// 식별자를 결정론적 dual-leg run report 로 묶는 **순수 함수**. guard 6 분기(위 helper
// 참조) 통과 후 per-leg status(pass/fail/skip) 파생 + overallStatus 파생 + summaryLine
// 합성. 입력 읽기만(mutate 0), 매 호출 새 report(무공유), 입력 외 상태 의존 0(결정론).
export function buildRealDataDailyStepDualLegRunReport(
  evalOutcome: RealDataDailyStepLegRunOutcome,
  collectOutcome: RealDataDailyStepLegRunOutcome,
  run: RealDataResultIssueRunRef,
): RealDataDailyStepDualLegRunReport {
  // run 식별자 guard(비식별 리포트 차단).
  assertNonBlank(run.gitSha, "RealDataResultIssueRunRef.gitSha");
  assertNonBlank(run.dateToken, "RealDataResultIssueRunRef.dateToken");

  // leg 라벨 guard(cross-wiring/mislabel 차단).
  assertLegLabel(evalOutcome, "eval");
  assertLegLabel(collectOutcome, "collect");

  // per-leg status 파생(action/passed 정합 guard 동반).
  const evalStatus = resolveLegStatus(evalOutcome);
  const collectStatus = resolveLegStatus(collectOutcome);

  // overallStatus 파생(두 leg status 로부터).
  const overallStatus = deriveOverallStatus(evalStatus, collectStatus);

  // 사람-친화 한 줄 요약 합성(동일 입력 → byte-identical). run 식별자 + 두 leg status +
  // overallStatus 를 포함하되 실 credential/specPath 는 담지 않는다(§9 echo 0).
  const summaryLine = `[${run.dateToken}@${run.gitSha}] eval=${evalStatus} collect=${collectStatus} → ${overallStatus}`;

  // 새 report 객체(무공유·입력 보존). eval/collect 필드도 매 호출 새 객체.
  const report: RealDataDailyStepDualLegRunReport = {
    gitSha: run.gitSha,
    dateToken: run.dateToken,
    eval: { action: evalOutcome.action, status: evalStatus },
    collect: { action: collectOutcome.action, status: collectStatus },
    overallStatus,
    summaryLine,
  };

  // self-wire(T-0911) — 산출 report 6 필드 전체가 (evalOutcome, collectOutcome, run) 으로부터
  // 컴포저 재호출 없이 독립 재유도한 expected 와 deep-equal 정합한지 반환 직전 검증한다. 세
  // 입력은 파라미터로, report 는 위 조립 산출로 전부 가용하므로 한 호출 안에서 배선된다. 정상
  // 조립 경로는 입력과 정합하는 report 를 산출하므로 throw 0(검증만, 산출 byte-identical
  // 무변형). per-leg status/overallStatus 파생·gitSha/dateToken 전파·summaryLine 합성 회귀
  // 시 손상 산출이 하위 wiring(descriptor·markdown·command-args)으로 새기 전 fail-fast(값
  // 정합 위반 RangeError / 구조 결손 TypeError).
  assertRealDataDailyStepDualLegRunReportConsistentWithInput(
    report,
    evalOutcome,
    collectOutcome,
    run,
  );

  return report;
}
