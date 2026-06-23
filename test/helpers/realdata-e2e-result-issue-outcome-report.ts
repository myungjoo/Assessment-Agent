// realdata-e2e-result-issue-outcome-report.ts — 실 평가 e2e 결과 이슈 박제 outcome +
// run 식별자 → e2e 실행 리포트 descriptor 종단 순수 컴포저 (T-0590 박제).
//
// 책임:
//   - step④(daily-test 결과를 result/rolling 이슈에 박제) build-time chain 의 **실행-후
//     해석(post-execution interpretation) 측 종단** 을 닫는다. chain 의 실행-후 측은 이미:
//     T-0589 `parseRealDataResultIssueCreateEditOutput` 이 `execFile('gh', argv)` 의
//     stdout(이슈 URL) → `RealDataResultIssueOutcome {issueNumber, url}` 로 파싱한다.
//     그러나 caller(daily-test live wiring)가 박제 직후 **"어느 run 이 어느 이슈에
//     무엇을 박제했는가"를 사람-친화 확인 리포트로 묶는 단계** 가 빠져있었다. 본 컴포저가
//     그 단계를 순수 함수로 박제해 post-실행 round-trip(stdout 파싱 → run 식별 결합 →
//     확인 리포트)을 닫는다.
//   - T-0582 `RealDataResultIssueRunRef {gitSha, dateToken}` 가 run 을 식별하고 T-0589
//     outcome 이 박제 결과(issueNumber/url)를 담으므로, 이 둘을 결합하면 daily-test step 이
//     로그/이슈 코멘트로 emit 할 수 있는 **결정론적 e2e 실행 리포트 descriptor** 가 된다.
//
// 🔥 엄격 검증 (조용한 통과 금지):
//   - run.gitSha / run.dateToken 빈/공백-only → throw(T-0582 `assertNonBlank` 동형 —
//     비식별 리포트 방지). outcome.url 빈/공백-only → throw. outcome.issueNumber 가
//     양의 정수(0/음수/비정수 차단)가 아니면 throw(T-0584 `assertPositiveNumber` 동형).
//     비정상 입력이 조용히 통과해 잘못된 확인 리포트로 새는 것을 차단한다.
//
// 🔥 결정론·무공유 (R-59 / REQ-059 정합):
//   - 입력 외 상태(시각·난수·env) 의존 0. 동일 (outcome, run) 두 번 호출 → byte-identical
//     `summaryLine` + deep-equal 결과. 매 호출 새 객체 반환 — 입력 객체 mutate 0.
//   - 리포트는 run 식별자(gitSha/dateToken) + 박제 결과(issueNumber/url) 만 보유하고
//     평가 narrative/원본 활동은 보유하지 않는다(REQ-059 raw 미저장 정합).
//
// 🔥 build-time 완결 — dependency-free (cloud cron 자율 실행 가능):
//   - 실 네트워크 호출 0, env 읽기 0, DB 접근 0, live-LLM 0, credential 0, gh 실행 0.
//     외부 라이브러리(zod 등) 0 — 내장 수동 검증만. 순수 함수.
//
// Out of Scope (task T-0590):
//   - 실 gh 호출 / `execFile('gh', argv)` / 실 이슈 코멘트 박제(step④ live wiring —
//     credential gate, deferred). 본 컴포저는 (outcome, run) → report descriptor 만 산출.
//   - stdout 파싱(T-0589 위임) · 종단 plan 합성(T-0588 위임) · 결과 요약 마크다운 렌더
//     (T-0581 위임) — 본 helper 는 박제 outcome + run → 실행 리포트 단일 책임.
//   - raw 평가 narrative/원본 활동 보유·저장 — REQ-059 정합으로 issueNumber/url/run 식별자만.
import type { RealDataResultIssueRunRef } from "./realdata-e2e-result-issue-descriptor";
import type { RealDataResultIssueOutcome } from "./realdata-e2e-result-issue-output-parse";

// RealDataResultIssueOutcomeReport — daily-test 결과 이슈 박제 후 caller 가 로그/이슈
// 코멘트로 emit 할 수 있는 사람-친화 확인 리포트 descriptor.
//   - issueNumber: 생성/수정된 이슈 번호(양의 정수, outcome 에서 전파).
//   - url: 박제된 이슈 URL(outcome 에서 전파).
//   - gitSha: run 식별 git short sha(run 에서 전파).
//   - dateToken: run 실행 날짜 토큰(run 에서 전파).
//   - summaryLine: 사람-친화 한 줄 요약(동일 입력 → byte-identical).
export interface RealDataResultIssueOutcomeReport {
  issueNumber: number;
  url: string;
  gitSha: string;
  dateToken: string;
  summaryLine: string;
}

// 빈/공백-only 식별자 guard — 비식별 리포트(잘못된 run 식별자·URL)를 방지하기 위해
// 대상 문자열이 빈 문자열·공백-only 면 명시적 throw(조용한 통과 차단). T-0582
// `assertNonBlank` 규약과 동형.
function assertNonBlank(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new Error(
      `${fieldName} 가 비어있습니다 — 비식별 실행 리포트 방지를 위해 빈/공백-only 값은 허용되지 않습니다.`,
    );
  }
}

// issueNumber guard — 박제 결과 number 는 항상 양의 정수여야 한다. 0/음수/비정수면
// 비정상 outcome 으로 간주하고 명시적 throw. T-0584 `assertPositiveNumber` 규약과 동형.
function assertPositiveIssueNumber(value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `RealDataResultIssueOutcome.issueNumber 가 양의 정수가 아닙니다(${value}) — 비정상 outcome 이 실행 리포트로 새는 것을 방지하기 위해 0 이하/비정수는 허용되지 않습니다.`,
    );
  }
}

// buildRealDataResultIssueOutcomeReport — 박제 outcome(issueNumber/url) + run 식별자
// (gitSha/dateToken) 를 결정론적 e2e 실행 리포트 descriptor 로 묶는 **순수 함수**.
//
// 분기:
//   - guard: run.gitSha 빈/공백 → throw, run.dateToken 빈/공백 → throw,
//     outcome.url 빈/공백 → throw, outcome.issueNumber 0/음수/비정수 → throw(각 별도 분기).
//   - 정상: issueNumber/url/gitSha/dateToken 전파 + summaryLine 합성. 동일 입력이면
//     summaryLine 이 byte-identical.
//
// 순수성·무공유:
//   - 입력 outcome / run(읽기만, mutate 0). 매 호출이 새 report 객체를 반환 — 출력이
//     입력 / 다음 호출 결과와 무공유. 입력 외 상태 의존 0(결정론).
export function buildRealDataResultIssueOutcomeReport(
  outcome: RealDataResultIssueOutcome,
  run: RealDataResultIssueRunRef,
): RealDataResultIssueOutcomeReport {
  // run 식별자 guard(비식별 리포트 차단).
  assertNonBlank(run.gitSha, "RealDataResultIssueRunRef.gitSha");
  assertNonBlank(run.dateToken, "RealDataResultIssueRunRef.dateToken");

  // 박제 결과 guard(비정상 outcome 차단).
  assertNonBlank(outcome.url, "RealDataResultIssueOutcome.url");
  assertPositiveIssueNumber(outcome.issueNumber);

  // url 정규화(trailing 개행/공백 trim) — outcome.url 은 이미 trim 되어 들어오나
  // 방어적으로 한 번 더 정규화해 결정론적 리포트를 보장한다.
  const url = outcome.url.trim();

  // 사람-친화 한 줄 요약 합성(동일 입력 → byte-identical).
  const summaryLine = `[${run.dateToken}@${run.gitSha}] 결과 이슈 #${outcome.issueNumber} 박제 → ${url}`;

  // 새 report 객체 반환(무공유·입력 보존).
  return {
    issueNumber: outcome.issueNumber,
    url,
    gitSha: run.gitSha,
    dateToken: run.dateToken,
    summaryLine,
  };
}
