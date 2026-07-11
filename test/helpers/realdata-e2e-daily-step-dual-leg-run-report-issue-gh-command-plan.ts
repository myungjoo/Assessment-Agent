// realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan.ts —
// daily-step dual-leg run report 이슈 search stdout + commandArgs → gh 실행
// plan({action, argv}) 종단 순수 컴포저 (T-0902 박제, summary 축 T-0588 mirror).
//
// 책임:
//   - T-0894 ~ T-0901 로 step④(daily-test 의 eval leg + collect leg 두 jest run 결과를
//     daily-test result/rolling 이슈에 멱등 박제)의 모든 단위 layer 가 순수 함수로 닫혔다:
//     parse(T-0901) → resolve(T-0898) → gh argv(T-0899). 그러나 caller(live wiring)가
//     이들을 정확한 순서로 엮는 책임은 아직 여러 helper 호출로 흩어져 있다 — caller 가
//     (1) parse → (2) resolveAction → (3) buildGhArgv 를 손으로 연결해야 한다. 본 컴포저가
//     이 **3-단계 합성을 단일 순수 함수로 박제** 해 build-time chain 을 종단까지 닫는다.
//   - 이로써 live wiring chain 은 (1) search argv(T-0900) → (2) execFile('gh', searchArgv)
//     (deferred, credential gate) → (3~5) 본 컴포저(search stdout + commandArgs → gh argv)
//     → (6) execFile('gh', argv)(deferred) 로 줄어든다. 순수 layer 가 한 진입점으로 합성되고
//     남는 외부 경계는 (2)·(6) 두 execFile 뿐이다(LAN/credential gate 로 deferred, ADR-0045).
//
// 🔥 위임 helper throw 전파 (자체 try/catch 0):
//   - (1) 잘못된 stdout(비JSON/비배열/원소 type 불일치/number 비양수) → 파서 throw 전파.
//   - (2) 빈/공백 searchQuery → resolver throw 전파.
//   - (3) create/update title·body 빈/공백 또는 issueNumber 비양수 → argv 빌더 throw 전파.
//   본 컴포저는 어느 layer 의 throw 도 삼키지 않고 그대로 위로 흘려보낸다(조용한 통과 차단).
//
// 🔥 결정론·무공유 (R-59 / REQ-032·REQ-037 정합):
//   - 입력 외 상태(시각·난수·env) 의존 0. 동일 (stdout, commandArgs) 두 번 호출 → deep equal
//     결과. 입력 commandArgs(중첩 createArgs.labels 포함) mutate 0 — 위임 helper 들이 이미
//     무공유라 본 컴포저도 매 호출 새 {action, argv}(새 argv 배열) 를 반환한다.
//   - 컴포저는 입력 외 데이터를 생성·저장하지 않는다: hits 의 body 를 분기 판정에만 쓰고
//     반환 argv 에 descriptor.body(=marker 라인 포함) 만 전달, 추가 활동 본문 0(raw 미저장).
//   - 신규 type 정의 0: 입력·출력 타입은 전부 기존 dual-leg helper 에서 import type 재사용.
//   - 실 execFile('gh', ...) 은 deferred — 본 컴포저는 stdout(이미 받은) + commandArgs →
//     실행할 argv 산출까지만 담당한다(search / create / edit 실행 모두 caller 책임).
import type { RealDataDailyStepDualLegRunReportIssueAction } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-action";
import { resolveRealDataDailyStepDualLegRunReportIssueAction } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-action";
import type { RealDataDailyStepDualLegRunReportIssueCommandArgs } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
import { buildRealDataDailyStepDualLegRunReportIssueGhArgv } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv";
import { parseRealDataDailyStepDualLegRunReportIssueSearchOutput } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse";

// RealDataDailyStepDualLegRunReportIssueGhCommandPlan — 종단 컴포저의 출력. caller 가
// action 종류(create/update) 로깅과 argv 실 실행(execFile('gh', argv)) 을 모두 할 수 있도록
// 둘을 함께 반환한다.
//   - action: 결정된 분기({action:'create'} | {action:'update', issueNumber}).
//   - argv: 그 분기에 대응하는 gh 인자-벡터(gh 실행 파일명 미포함 — caller 가 분리 전달).
export interface RealDataDailyStepDualLegRunReportIssueGhCommandPlan {
  action: RealDataDailyStepDualLegRunReportIssueAction;
  argv: string[];
}

// resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan — gh search stdout +
// 명령-args 묶음을 입력 받아 gh 실행 plan({action, argv}) 을 산출하는 **종단 순수 컴포저**.
//
// 합성 순서(3 단계 위임):
//   (1) parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout)
//         → RealDataDailyStepDualLegRunReportIssueSearchHit[].
//   (2) resolveRealDataDailyStepDualLegRunReportIssueAction(hits, commandArgs.searchQuery)
//         → action.
//       - marker 는 별도 인자가 아니라 commandArgs.searchQuery(= descriptor.marker) 를
//         그대로 전달(재합성 0).
//   (3) buildRealDataDailyStepDualLegRunReportIssueGhArgv(action, commandArgs) → argv.
//
// 분기:
//   - 후보 0건(stdout "[]" 또는 marker 미포함) → action.create → gh issue create argv.
//   - 후보 1+ 건(marker 포함) → action.update(최소 number) → gh issue edit argv.
//   - 각 위임 helper 의 guard throw 는 자체 try/catch 없이 그대로 전파.
//
// 순수성·무공유:
//   - 입력 stdout(문자열·불변) / commandArgs(읽기만, mutate 0). 매 호출이 새 plan 객체 +
//     새 argv 배열을 반환 — 출력이 입력 / 다음 호출 결과와 무공유. 결정론(입력만의 함수).
export function resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
  stdout: string,
  commandArgs: RealDataDailyStepDualLegRunReportIssueCommandArgs,
): RealDataDailyStepDualLegRunReportIssueGhCommandPlan {
  // (1) search stdout → hits(비JSON/비배열/원소 type/number 비양수 → 파서 throw 전파).
  const hits = parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout);

  // (2) hits + marker(= searchQuery) → action(빈/공백 marker → resolver throw 전파).
  const action = resolveRealDataDailyStepDualLegRunReportIssueAction(
    hits,
    commandArgs.searchQuery,
  );

  // (3) action + commandArgs → argv(title/body 빈·공백 또는 issueNumber 비양수 → 빌더 throw).
  const argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
    action,
    commandArgs,
  );

  // 새 plan 객체(새 argv 배열은 빌더가 이미 무공유로 반환) — 입력 보존·무공유.
  return { action, argv };
}
