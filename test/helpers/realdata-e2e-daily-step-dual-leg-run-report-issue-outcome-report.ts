// realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report.ts — 실 평가 e2e
// daily-step dual-leg run report 이슈 박제 outcome + run 식별자 → e2e 실행 리포트
// descriptor 종단 순수 컴포저 (T-1000 박제 — 요약축 T-0590
// `buildRealDataResultIssueOutcomeReport` 의 daily-step 축 mirror).
//
// 책임:
//   - PLAN.md 109행 step ④(daily-test 결과를 dual-leg run report rolling-issue 에 박제)
//     의 **실행-후 해석(post-execution interpretation) 측 종단** 을 닫는다. dual-leg 축의
//     실행-후 chain 은 이미 T-0903 `parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput`
//     이 `execFile('gh', argv)` 의 stdout → `RealDataDailyStepDualLegRunReportIssueOutcome
//     {issueNumber, url}` 로 파싱한다. 그러나 caller(daily-test live wiring)가 박제 직후
//     **"어느 run 이 어느 이슈에 무엇을 박제했는가"를 사람-친화 확인 리포트로 묶는 종단
//     단계** 가 빠져있었다. 본 컴포저가 그 단계를 순수 함수로 박제해 post-실행 round-trip
//     (stdout 파싱 → run 식별 결합 → 확인 리포트)을 닫는다. 요약축 T-0590 의 dual-leg mirror.
//
//   요약축 대비 축-차이: 요약축은 run 식별자를 별도 `RealDataResultIssueRunRef` 로 받지만
//     daily-step 축은 별도 run ref 타입이 없고 run 식별자(gitSha·dateToken)를
//     `RealDataDailyStepDualLegRunReport`(T-0894) 가 이미 보유한다(descriptor T-0896 도
//     report 를 그대로 받는 관례와 동일). 따라서 본 컴포저는 `(outcome, report)` 를
//     입력받는다 — 요약축의 `(outcome, run)` 을 daily-step 관례로 치환.
//
// 🔥 엄격 검증 (조용한 통과 금지):
//   - report.gitSha / report.dateToken 빈/공백-only → throw(T-0896 `assertNonBlank` 동형 —
//     비식별 리포트 방지). outcome.url 빈/공백-only → throw. outcome.issueNumber 가
//     양의 정수(0/음수/비정수 차단)가 아니면 throw(T-0898 `assertPositiveNumber` 동형).
//     비정상 입력이 조용히 통과해 잘못된 확인 리포트로 새는 것을 차단한다.
//
// 🔥 결정론·무공유 (R-59 / REQ-059 정합):
//   - 입력 외 상태(시각·난수·env) 의존 0. 동일 (outcome, report) 두 번 호출 → byte-identical
//     `summaryLine` + deep-equal 결과. 매 호출 새 객체 반환 — 입력 객체 mutate 0.
//   - 리포트는 run 식별자(gitSha/dateToken) + 박제 결과(issueNumber/url) 만 보유하고
//     평가 narrative/원본 활동은 보유하지 않는다(REQ-059 raw 미저장 정합).
//
// 🔥 build-time 완결 — dependency-free (cloud cron 자율 실행 가능):
//   - 실 네트워크 호출 0, env 읽기 0, DB 접근 0, live-LLM 0, credential 0, gh 실행 0.
//     외부 라이브러리(zod 등) 0 — 내장 수동 검증만. 순수 함수.
//
// 🔥 self-wire (T-1002 — 반환 직전 summaryLine 정합 self-assert 배선):
//   - consistency 가드(summary-line-consistency T-1001)가 main 에 박제된 뒤, 본 producer 의
//     단일 반환 지점 직전에 그 가드를 self-assert 로 배선한다(요약축 T-0702 mirror). 이로써
//     어떤 경로로 producer 를 호출하든 summaryLine 합성 회귀(토큰 순서·구분자·접두 drift,
//     구성 4 필드↔summaryLine 어긋남)로 손상된 report 가 step ④ 박제/로그 emit wiring 으로
//     새기 전 build-time 에 fail-fast throw 로 차단된다. 가드는 read-only(report mutate 0)이며
//     정상 산출물에는 void 반환 — 관측 불가능하게 동일한 report 를 그대로 반환한다. 기존 입력
//     guard(assertNonBlank/assertPositiveIssueNumber)는 그대로 유지한다.
//   - output-consistency 가드(요약축 T-0726 analog)는 daily-step 축에 아직 존재하지 않으므로
//     그 두 번째 self-assert 는 미배선(별도 후속 slice — 가드 신설 → self-wire 순).
//
// Out of Scope (task T-1002):
//   - output-consistency 가드(요약축 T-0726 대응) 신설·self-wire 0 — daily-step 대응
//     가드 부재, 별도 후속 slice.
//   - outcome-report-from-output(요약축 T-0589 계열) mirror 0 — 본 producer 에 의존하는
//     상위 조립, 별도 후속 leaf.
//   - 실 gh 호출 / `execFile('gh', argv)` / stdout 파싱(T-0903 위임) 재현 0 — 본 producer 는
//     이미 파싱된 outcome + report → 리포트 descriptor 만 산출.
//   - raw 평가 narrative/원본 활동 보유·저장 — REQ-059 정합으로 issueNumber/url/run 식별자만.
//   - production `src/` 코드 변경 — test helper 단독(타입 read-only `import type` 만).
import type { RealDataDailyStepDualLegRunReport } from "./realdata-e2e-daily-step-dual-leg-run-report";
// summaryLine 정합 가드(T-1001)를 반환 직전 self-assert 로 배선하기 위한 value import
// (요약축 T-0702 mirror). 가드는 report 타입만 `import type` 로 참조하고 본 producer 의
// value 를 import 하지 않으므로(oracle 독립성), 본 producer 가 가드를 value import 해도
// 런타임 순환 의존이 생기지 않는다.
import { assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-summary-line-consistency";
import type { RealDataDailyStepDualLegRunReportIssueOutcome } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse";

// RealDataDailyStepDualLegRunReportIssueOutcomeReport — daily-test dual-leg run report
// 이슈 박제 후 caller 가 로그/이슈 코멘트로 emit 할 수 있는 사람-친화 확인 리포트
// descriptor.
//   - issueNumber: 생성/수정된 이슈 번호(양의 정수, outcome 에서 전파).
//   - url: 박제된 이슈 URL(outcome 에서 전파, trim 정규화).
//   - gitSha: run 식별 git short sha(report 에서 전파).
//   - dateToken: run 실행 날짜 토큰(report 에서 전파).
//   - summaryLine: 사람-친화 한 줄 요약(동일 입력 → byte-identical).
export interface RealDataDailyStepDualLegRunReportIssueOutcomeReport {
  issueNumber: number;
  url: string;
  gitSha: string;
  dateToken: string;
  summaryLine: string;
}

// 빈/공백-only 식별자 guard — 비식별 리포트(잘못된 run 식별자·URL)를 방지하기 위해
// 대상 문자열이 빈 문자열·공백-only 면 명시적 throw(조용한 통과 차단). daily-step
// descriptor T-0896 `assertNonBlank` 규약과 동형.
function assertNonBlank(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new Error(
      `${fieldName} 가 비어있습니다 — 비식별 실행 리포트 방지를 위해 빈/공백-only 값은 허용되지 않습니다.`,
    );
  }
}

// issueNumber guard — 박제 결과 number 는 항상 양의 정수여야 한다. 0/음수/비정수면
// 비정상 outcome 으로 간주하고 명시적 throw. T-0898 `assertPositiveNumber` 규약과 동형.
function assertPositiveIssueNumber(value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `RealDataDailyStepDualLegRunReportIssueOutcome.issueNumber 가 양의 정수가 아닙니다(${value}) — 비정상 outcome 이 실행 리포트로 새는 것을 방지하기 위해 0 이하/비정수는 허용되지 않습니다.`,
    );
  }
}

// buildRealDataDailyStepDualLegRunReportIssueOutcomeReport — 박제 outcome(issueNumber/
// url) + run 식별자(report.gitSha/dateToken) 를 결정론적 e2e 실행 리포트 descriptor 로
// 묶는 **순수 함수**.
//
// 분기:
//   - guard: report.gitSha 빈/공백 → throw, report.dateToken 빈/공백 → throw,
//     outcome.url 빈/공백 → throw, outcome.issueNumber 0/음수/비정수 → throw(각 별도 분기).
//   - 정상: issueNumber/url/gitSha/dateToken 전파 + summaryLine 합성. 동일 입력이면
//     summaryLine 이 byte-identical. daily-step runToken 관례(`${dateToken}@${gitSha}`,
//     descriptor T-0896 동형)에 정합.
//
// 순수성·무공유:
//   - 입력 outcome / report(읽기만, mutate 0). 매 호출이 새 report 객체를 반환 — 출력이
//     입력 / 다음 호출 결과와 무공유. 입력 외 상태 의존 0(결정론).
//
// self-wire(T-1002) — 반환 직전 summaryLine 정합 가드(T-1001)로 self-assert 해 합성 회귀로
// 손상된 report 가 새기 전 fail-fast 로 차단한다. output-consistency 가드(요약축 T-0726 analog)는
// daily-step 축 미존재라 그 두 번째 self-assert 는 미배선(후속 slice).
export function buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
  outcome: RealDataDailyStepDualLegRunReportIssueOutcome,
  report: RealDataDailyStepDualLegRunReport,
): RealDataDailyStepDualLegRunReportIssueOutcomeReport {
  // run 식별자 guard(비식별 리포트 차단).
  assertNonBlank(report.gitSha, "RealDataDailyStepDualLegRunReport.gitSha");
  assertNonBlank(
    report.dateToken,
    "RealDataDailyStepDualLegRunReport.dateToken",
  );

  // 박제 결과 guard(비정상 outcome 차단).
  assertNonBlank(
    outcome.url,
    "RealDataDailyStepDualLegRunReportIssueOutcome.url",
  );
  assertPositiveIssueNumber(outcome.issueNumber);

  // url 정규화(trailing 개행/공백 trim) — outcome.url 은 이미 trim 되어 들어오나
  // 방어적으로 한 번 더 정규화해 결정론적 리포트를 보장한다.
  const url = outcome.url.trim();

  // 사람-친화 한 줄 요약 합성(동일 입력 → byte-identical). daily-step runToken 관례
  // (`${dateToken}@${gitSha}`)에 정합.
  const summaryLine = `[${report.dateToken}@${report.gitSha}] 결과 이슈 #${outcome.issueNumber} 박제 → ${url}`;

  // 새 report 객체(무공유·입력 보존).
  const outcomeReport: RealDataDailyStepDualLegRunReportIssueOutcomeReport = {
    issueNumber: outcome.issueNumber,
    url,
    gitSha: report.gitSha,
    dateToken: report.dateToken,
    summaryLine,
  };

  // self-wire(T-1002) — 반환 직전 summaryLine 정합 가드(T-1001)로 self-assert 해, 합성
  // 회귀(템플릿 토큰 순서·구분자·접두 drift, 구성 4 필드↔summaryLine 어긋남)로 손상된
  // report 가 step ④ 박제/로그 emit wiring 으로 새기 전 fail-fast throw 하도록 닫는다. 가드는
  // read-only(report mutate 0)이며 정상 산출물에는 void 반환 — 관측 불가능하게 동일한
  // outcomeReport 를 그대로 반환한다. 기존 입력 guard(assertNonBlank/assertPositiveIssueNumber)는
  // 위 호출 그대로 유지. output-consistency 가드(요약축 T-0726 analog)는 daily-step 축 미존재라
  // 두 번째 self-assert 는 미배선(후속 slice).
  assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent(
    outcomeReport,
  );

  return outcomeReport;
}
