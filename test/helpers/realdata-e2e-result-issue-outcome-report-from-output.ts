// realdata-e2e-result-issue-outcome-report-from-output.ts — 실 평가 e2e 결과 이슈
// `gh issue create` / `gh issue edit <n>` 의 stdout + run 식별자 → e2e 실행 리포트
// descriptor post-execution 단일 진입 순수 컴포저 (T-0596 박제).
//
// 책임:
//   - PLAN.md 109행 step④(daily-test 결과를 result/rolling 이슈에 박제)의 **post-실행
//     (post-execution interpretation)** 측 build-time chain 의 단일 진입점을 닫는다.
//     post-실행 측 단위 layer 는 이미 박제됨:
//     (a) T-0589 `parseRealDataResultIssueCreateEditOutput(stdout)` 가
//         `execFile('gh', argv)` 의 stdout(이슈 URL) → `RealDataResultIssueOutcome
//         {issueNumber, url}` 로 파싱하고,
//     (b) T-0590 `buildRealDataResultIssueOutcomeReport(outcome, run)` 이 그 outcome +
//         run 식별자 → 사람-친화 실행 리포트 `RealDataResultIssueOutcomeReport` 로 묶는다.
//     그러나 live runner 가 이슈 박제 직후 받는 "create/edit stdout + run" 묶음을 실행
//     리포트로 바꾸려면 아직 두 helper(T-0589 → T-0590)를 caller 가 수동으로 엮어야 한다.
//     본 컴포저가 그 2 단계를 단일 순수 함수로 합성해 post-실행 단일 진입점을 닫는다.
//   - pre-실행 측 종단 `buildRealDataResultIssuePublishPlan`(T-0595)·종단 plan 컴포저
//     `resolveRealDataResultIssueGhCommandPlan`(T-0588)·seed/evaluate plan 컴포저
//     (T-0592/T-0591) 과 동형의 "분리된 순수 link 들을 단일 plan 컴포저로 묶는" 박제다.
//
// 🔥 위임 재구현 0 (URL 파싱·issueNumber 검증·run guard·summaryLine 합성 전부 위임):
//   - 본 컴포저는 (1) T-0589 파서 → (2) T-0590 리포트 빌더만 순서대로 엮는다. URL 정규
//     표현식·issueNumber 양수성 검증·run 식별자 guard·summaryLine 합성 로직을 일절
//     재구현하지 않는다(위임 호출만).
//
// 🔥 위임 throw 전파 (자체 try/catch 0):
//   - (1) stdout 에서 issue URL 미발견·`/pull/`·비-github 호스트·issueNumber 0/선행0/
//         비정수 → T-0589 파서 throw 가 자체 try/catch 없이 그대로 전파(T-0590 단계 미도달).
//   - (2) run.gitSha / run.dateToken 빈/공백 → T-0590 guard throw 전파.
//   본 컴포저는 어느 layer 의 throw 도 삼키지 않고 그대로 위로 흘려보낸다(조용한 통과 차단).
//
// 🔥 결정론·무공유:
//   - 입력 외 상태(시각·난수·env) 의존 0. 동일 (stdout, run) 두 번 호출 → deep-equal 결과
//     (summaryLine byte-identical). 매 호출 새 report 객체를 반환 — 출력이 입력 / 다음
//     호출 결과와 무공유. 입력 stdout(문자열)은 불변, 입력 run 객체는 읽기만(mutate 0).
//
// 🔥 raw 미저장 정합 (R-59 / REQ-059):
//   - 출력 `RealDataResultIssueOutcomeReport` 은 위임 helper 들이 산출하는 issueNumber/
//     url/gitSha/dateToken/summaryLine 만 보유한다 — raw narrative·원본 활동 본문·이슈
//     body 를 **구조적으로 미보유**(위임 type 에 그런 필드가 없으므로 합성 불가).
//
// 🔥 build-time 완결 — dependency-free (cloud cron 자율 실행 가능):
//   - 실 네트워크 호출 0, env 읽기 0, DB 접근 0, live-LLM 0, credential 0, gh 실행 0.
//     외부 라이브러리(zod 등) 0 — 위임 함수 import 재사용만. 순수 함수.
//
// Out of Scope (task T-0596):
//   - 실 gh 호출 / `execFile('gh', argv)` / 실 이슈 search·create·edit·박제(step④ live
//     wiring — credential gate). 본 컴포저는 (stdout, run) → 실행 리포트 descriptor 만 산출.
//     stdout 은 이미 실행된 gh 의 산출로 인자로만 받음(부수효과 0).
//   - search stdout → action 분기 → create/edit argv 합성(T-0588 측) — 본 helper 는
//     create/edit stdout(실행 후) → 실행 리포트만 책임.
//   - pre-실행 publish plan 합성(T-0595 측) — 본 helper 는 post-실행 측 단일 진입점.
//   - URL 파싱(T-0589 위임) / issueNumber 검증(T-0589 위임) / run 식별자 guard·summaryLine
//     합성(T-0590 위임) — 전부 위임 안에서 처리(재구현 금지).
//   - run.gitSha / run.dateToken 의 실 도출(인자로만 받음).
//   - production `src/` 코드 변경 — test helper 단독(위임 함수·타입 import 재사용만).
import type { RealDataResultIssueRunRef } from "./realdata-e2e-result-issue-descriptor";
import { buildRealDataResultIssueOutcomeReport } from "./realdata-e2e-result-issue-outcome-report";
import type { RealDataResultIssueOutcomeReport } from "./realdata-e2e-result-issue-outcome-report";
// outcome-report composer 산출 ↔ single-source 재유도 정합 가드(T-0663 신설)를 컴포저
// 산출 경로에 self-wire 한다(T-0664). 합성한 report 를 반환하기 직전에 self-assert 호출 —
// 컴포저가 두 위임 layer(parser → builder) 사이에 끼어 결과를 변형/누락하는 합성 회귀가
// 발생하면 손상 report 를 caller 에 반환하기 전에 fail-fast throw 한다(구조 결손=TypeError /
// 값 정합 위반=RangeError). 가드 본문은 변경 0(T-0663 산출물 그대로 import 재사용). 가드는
// 컴포저와 동일한 두 위임(parse→build)을 import 하므로 runtime cycle 위험 없음.
import { assertRealDataResultIssueOutcomeReportConsistentWithOutput } from "./realdata-e2e-result-issue-outcome-report-from-output-consistency";
import { parseRealDataResultIssueCreateEditOutput } from "./realdata-e2e-result-issue-output-parse";

// buildRealDataResultIssueOutcomeReportFromOutput — `gh issue create` / `gh issue edit`
// 의 stdout + run 식별자를 e2e 실행 리포트 descriptor 로 묶는 **post-실행 단일 진입
// 순수 컴포저**.
//
// 합성 순서(2 단계 위임):
//   (1) parseRealDataResultIssueCreateEditOutput(stdout)(T-0589) → outcome
//       {issueNumber, url}. stdout URL 미발견·비-github·`/pull/`·issueNumber 0/선행0/
//       비정수 → 파서 throw 전파(이 단계에서 종료, (2) 미도달).
//   (2) buildRealDataResultIssueOutcomeReport(outcome, run)(T-0590) → report.
//       run.gitSha / run.dateToken 빈/공백 → 빌더 guard throw 전파.
//
// 분기:
//   - 정상: (1)·(2) 모두 통과 → 위임이 반환한 report 를 그대로 반환.
//   - throw: (1) 파서 throw 또는 (2) 빌더 guard throw 가 자체 try/catch 없이 전파.
//
// 순수성·무공유:
//   - 입력 stdout(문자열·불변) / run(읽기만, mutate 0). 반환 report 는 T-0590 빌더가
//     매 호출 새 객체로 산출하므로 본 컴포저도 매 호출 새 객체를 반환(무공유). 입력 외
//     상태 의존 0(결정론) — 동일 (stdout, run) → byte-identical summaryLine.
export function buildRealDataResultIssueOutcomeReportFromOutput(
  stdout: string,
  run: RealDataResultIssueRunRef,
): RealDataResultIssueOutcomeReport {
  // (1) stdout → outcome(URL 미발견·비-github·issueNumber 비정상 → 파서 throw 전파).
  const outcome = parseRealDataResultIssueCreateEditOutput(stdout);

  // (2) outcome + run → report(run 식별자 빈/공백 → 빌더 guard throw 전파). T-0590 빌더가
  // 매 호출 새 report 객체를 반환한다(무공유·재구현 0).
  const report = buildRealDataResultIssueOutcomeReport(outcome, run);

  // self-wire(T-0664) — 합성한 report 가 동일 (stdout, run) 의 single-source 재유도와
  // byte-identical 정합한지 반환 직전 검증한다. 정상 합성이면 self-assert 가 void →
  // report 비변형·byte-identical 보존. 컴포저가 두 위임 사이에 끼어 결과를 변형/누락하는
  // 합성 회귀가 발생하면 손상 report 를 caller 에 넘기기 전에 fail-fast throw 한다.
  assertRealDataResultIssueOutcomeReportConsistentWithOutput(
    stdout,
    run,
    report,
  );

  return report;
}
