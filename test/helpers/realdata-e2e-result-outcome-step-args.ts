// realdata-e2e-result-outcome-step-args.ts — 실 평가 e2e run plan + gh create/edit
// stdout → 결과 이슈 실행 리포트(run 일관) 순수 컴포저 (T-0600 박제).
//
// 책임:
//   - PLAN 109행(🟢 실 평가 e2e, P5) 의 build-time 순수 layer 는 step-level run-plan
//     연결 컴포저로 run/modelId 단일 source threading 을 구축해 왔다 — seed-side 최외곽
//     진입 `buildRealDataE2eRunPlan(seeds, modelId, run)`(T-0597) → `{pipeline, run}`,
//     평가 연결 `buildRealDataEvaluationStepArgs(runPlan, activities)`(T-0598,
//     `runPlan.pipeline.modelId` thread), step④ **pre-실행** publish 연결
//     `buildRealDataResultPublishStepArgs(runPlan, results)`(T-0599, `runPlan.run`
//     thread). 그러나 step④의 **post-실행** 측 단일 진입
//     `buildRealDataResultIssueOutcomeReportFromOutput(stdout, run)`(T-0596)은
//     `run`(`RealDataResultIssueRunRef` = gitSha + dateToken)을 **독립 인자로 다시
//     받는다** — live runner 가 step ① `buildRealDataE2eRunPlan` 에 넘겨 검증·보존한
//     `runPlan.run` 과, post-실행 outcome report 에 넘기는 `run` 이 build-time 에서
//     같은 값임을 **보장하지 못한다**(두 군데 수동 전달 — 잘못된 gitSha/dateToken 으로
//     실행 리포트가 어긋날 수 있는 사고 표면).
//   - 본 컴포저는 그 분리된 link 를 단일 순수 함수
//     `buildRealDataResultOutcomeStepArgs(runPlan, stdout)` → `RealDataResultIssueOutcomeReport`
//     로 묶어, **검증된 run plan 의 단일 `runPlan.run` 만을** outcome report 로
//     thread 한다(run 재전달 0 → step ①↔step④ post-실행 run 식별자 일관 구조적 보장).
//     이는 **T-0599(pre-실행 publish plan threading)의 post-실행 대칭**이며, 이로써
//     step④의 두 sub-path(pre-실행 publish / post-실행 outcome)가 모두 단일 검증
//     `runPlan.run` 에서 thread 되어 run-plan threading layer 가 완결된다.
//
// 🔥 run 단일 source (재전달 0 — run 일관 구조적 보장):
//   - outcome report 의 run 은 **`runPlan.run` 에서만** 도출한다. 본 컴포저는 독립
//     `run` 인자를 받지 않으므로 caller 가 step ① 과 post-실행에 run 을 따로 두 번 넘길
//     수 없다 — step ① 에서 검증·보존된 run 이 outcome report 로 그대로 thread 되어 두
//     단계 run 식별자가 build-time 에서 항상 동일하다(잘못된 gitSha/dateToken 으로 실행
//     리포트가 어긋나는 사고 표면 제거). T-0599 의 pre-실행 대칭이다.
//
// 🔥 위임 helper 재사용 (재구현 0, SSOT 보존):
//   - stdout 파싱(URL 추출·issueNumber 검증)·run guard·summaryLine 합성은 전부
//     T-0596(`buildRealDataResultIssueOutcomeReportFromOutput`, 그 하위 T-0589 파서 /
//     T-0590 빌더) 에 위임한다. 본 컴포저는 outcome 파싱·리포트 합성·run guard 를
//     재구현하지 않고 run 을 runPlan 에서 추출해 위임 호출만 엮는다(중복 0).
//
// 🔥 위임 throw 그대로 전파 (자체 try/catch 0):
//   - 잘못된 stdout(URL 미발견·비-github 호스트·`/pull/`·issueNumber 0/선행0/비정수) →
//     위임 하위 T-0589 파서 throw, `runPlan.run.gitSha` / `runPlan.run.dateToken` 빈/
//     공백 → 위임 하위 T-0590 빌더 guard throw 를 자체 try/catch 없이 그대로 위로
//     흘려보낸다(조용한 통과 차단). 본 컴포저는 추가 guard 를 재구현하지 않는다.
//     (정상 경로의 `runPlan` 은 `buildRealDataE2eRunPlan` 이 이미 run 을 검증하므로 빈
//     run 을 갖지 않는다 — 이 전파는 위임 guard 가 방어선으로 살아있음을 보장하는
//     마지막 그물이다.)
//
// 🔥 결정론·무공유 (R-59 정합):
//   - 입력 외 상태(시각·난수·env) 의존 0. 동일 (runPlan, stdout) 두 번 호출 → deep-equal
//     결과(summaryLine byte-identical). 입력 `runPlan`(읽기만 — run 추출, mutate 0) /
//     `stdout`(문자열·불변). 위임 helper 가 매 호출 새 report 객체를 반환하므로 본
//     컴포저도 매 호출 새 report 객체(공유 mutable 노출 0)를 반환한다.
//
// 🔥 R-59 정합 (raw 활동 본문 구조적 미포함):
//   - 산출 report 는 issueNumber/url/gitSha/dateToken/summaryLine 만 보유하고 raw 활동
//     본문(commit message 전문 / diff / 이슈 body 등)을 구조적으로 보유하지 않는다 —
//     위임 helper(T-0596 및 그 하위 T-0589/T-0590)가 raw 미보유를 보장하므로 본 컴포저도
//     미보유다.
//
// 🔥 type 재사용 (중복 정의 0):
//   - `RealDataE2eRunPlan` / `RealDataResultIssueOutcomeReport` / `RealDataResultIssueRunRef`
//     는 전부 import type 재사용한다. 신규 type 정의 0(컨테이너 type 도 위임 측
//     `RealDataResultIssueOutcomeReport` 재사용).
//
// Out of Scope (task T-0600):
//   - 실 github.com 네트워크 fetch / 실 활동 수집(step ② live, LAN/credential gate — ADR-0045).
//   - 실 `EvaluationScoringService.scoreUnit` / 실 LLM round-trip / Ollama(step ③ live).
//   - 실 `gh issue create` / `gh issue edit` / `execFile('gh', argv)` 실행 —
//     `stdout: string` 는 인자로만 받음(step④ live wiring, credential gate). 본 컴포저는
//     (runPlan, stdout) → 실행 리포트 descriptor 만 산출(부수효과 0).
//   - stdout 파싱 / outcome 추출 / 리포트 합성 / run guard 재구현 — 전부
//     `buildRealDataResultIssueOutcomeReportFromOutput`(T-0596, 그 하위 T-0589/T-0590)
//     위임 안에서 처리(중복 0).
//   - `runPlan` 의 실 산출(실 seed/run 도출 — `buildRealDataE2eRunPlan` 결과를 인자로만 받음).
//   - pre-실행 publish plan 합성(`buildRealDataResultPublishStepArgs`, T-0599 — 본
//     컴포저는 post-실행 outcome report 만 책임).
//   - 외부 라이브러리(zod / execa 등) 도입 — 새 dependency 0, 내장 위임 합성만.
//   - production `src/` 코드 변경 — test helper 단독(타입·위임 함수 import 재사용만).
import type { RealDataResultIssueOutcomeReport } from "./realdata-e2e-result-issue-outcome-report";
import { buildRealDataResultIssueOutcomeReportFromOutput } from "./realdata-e2e-result-issue-outcome-report-from-output";
import type { RealDataE2eRunPlan } from "./realdata-e2e-run-plan";

// buildRealDataResultOutcomeStepArgs — 검증된 e2e run plan `runPlan` + `gh issue create`
// / `gh issue edit` 의 `stdout` 을 입력 받아 결과 이슈 실행 리포트
// `RealDataResultIssueOutcomeReport`(issueNumber/url/gitSha/dateToken/summaryLine)를
// 산출하는 **순수 컴포저**(step ④ 결과 이슈 박제 경계의 post-실행 run-plan 연결).
//
// 합성:
//   - `runPlan.run`(step ① 에서 검증·보존된 단일 run 식별자)을 추출해
//     `buildRealDataResultIssueOutcomeReportFromOutput(stdout, runPlan.run)` 로
//     위임한다(stdout 파싱·issueNumber 검증·run guard·summaryLine 합성 전부 T-0596 위임
//     — 재구현 0).
//
// run 단일 source: 독립 run 인자를 받지 않고 오직 runPlan 에서만 도출하므로 step ① 과
// post-실행 outcome 의 run 식별자가 build-time 에서 항상 동일하다(재전달 0).
//
// 분기(본 컴포저 자체의 추가 분기 0 — 전부 위임 helper 가 담당):
//   - 정상: 유효 `runPlan.run` + 유효 issue URL stdout(create / edit) → 위임이 산출한
//     report 를 그대로 반환(throw 0).
//   - 잘못된 stdout(URL 미발견 / 비-github 호스트 / `/pull/` PR URL / issueNumber 0/
//     선행0/비정수) → 위임 하위 T-0589 파서 throw 를 자체 try/catch 없이 그대로 전파.
//   - `runPlan.run.gitSha` / `runPlan.run.dateToken` 빈/공백 → 위임 하위 T-0590 빌더
//     guard throw 를 자체 try/catch 없이 그대로 전파.
//
// 순수성·무공유:
//   - 입력 `runPlan`(읽기만 — run 추출, mutate 0) / `stdout`(문자열·불변). 위임 helper 가
//     매 호출 새 report 객체를 반환하므로 본 컴포저도 매 호출 새 report 객체를 반환 —
//     출력이 입력 / 다음 호출 결과와 무공유. 결정론(입력만의 함수).
export function buildRealDataResultOutcomeStepArgs(
  runPlan: RealDataE2eRunPlan,
  stdout: string,
): RealDataResultIssueOutcomeReport {
  // run plan 에서 검증·보존된 단일 run 식별자를 추출해 outcome report 로 thread. 독립
  // run 인자 미수신 — step ① / post-실행 run 식별자 일관 구조적 보장(재전달 0). 잘못된
  // stdout 의 파서 throw 와 빈/공백 gitSha/dateToken 의 빌더 guard throw 는 위임 helper 가
  // 자체 try/catch 없이 그대로 전파한다.
  return buildRealDataResultIssueOutcomeReportFromOutput(stdout, runPlan.run);
}
