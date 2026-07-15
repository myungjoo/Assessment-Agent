// realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan.ts — 실 평가 e2e
// daily-step dual-leg run report → 이슈 publish plan(descriptor + commandArgs +
// searchArgv) 종단 순수 컴포저 (T-1016 박제, 요약축 T-0595 mirror).
//
// 책임:
//   - PLAN.md 109행(🟢 실 평가 e2e, P5) step ④ 결과 박제 leg 의 pre-실행 build-time
//     chain 은 현재 세 개의 분리된 순수 link 로 존재한다 — (1) T-0896
//     `buildRealDataDailyStepDualLegRunReportIssueDescriptor(report)` →
//     `{title, marker, body}` descriptor, (2) T-0990
//     `buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor)` →
//     `{searchQuery, createArgs, updateArgs}` commandArgs, (3)
//     `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs)` →
//     `searchArgv: string[]`. 그러나 step ④ live runner 가 한 번에 받아야 하는
//     "박제할 이슈 descriptor + 멱등 search-or-update 명령-args + 실행할 첫 gh
//     argv(search)" 묶음은 아직 세 helper 를 caller 가 수동으로 엮어야 산출된다.
//   - 본 컴포저는 그 세 단계를 단일 순수 함수
//     `buildRealDataDailyStepDualLegRunReportIssuePublishPlan(report)` →
//     `{descriptor, commandArgs, searchArgv}` 로 합성해 **pre-실행 build-time chain 의
//     단일 진입점**을 닫는다. 산출 `searchArgv` 는 runner 가 `execFile('gh', searchArgv)`
//     로 실행할 첫 명령이고, 산출 `commandArgs` 는 그 stdout 과 함께 후속 종단 컴포저로
//     넘어간다. 요약축 종단 컴포저 `buildRealDataResultIssuePublishPlan(results, run)` →
//     `{report, commandArgs, searchArgv}`(T-0595)의 daily-step mirror 다.
//
// 🔥 위임 topology (요약축 2단 → daily-step 3단):
//   - 요약축 publish-plan 은 command-plan(results+run → report+commandArgs) + search-argv
//     2단 위임이지만, daily-step 은 descriptor(report → descriptor) → command-args
//     (descriptor → commandArgs) → search-argv(commandArgs → searchArgv) **3단 순차
//     위임**이다. daily-step 의 descriptor 가 요약축의 report-plan 역할(rendered issue
//     content)을 하므로 반환 shape 도 `{descriptor, commandArgs, searchArgv}` —
//     descriptor 가 요약축 publish-plan 의 `report` 필드 자리에 대응한다.
//
// 🔥 위임 helper 재사용 (재구현 0, SSOT 보존):
//   - descriptor 합성은 T-0896, 명령-args 합성은 T-0990, search argv 합성은 위 search-argv
//     빌더에 위임한다. 본 컴포저는 집계 / 렌더 / 명령-args / search argv 합성 로직을
//     재구현하지 않고 위임 호출만 순서대로 엮는다(중복 0 — 하위 helper 직접 재구현 0).
//
// 🔥 위임 throw 그대로 전파 (자체 try/catch 0):
//   - descriptor 단계 report.gitSha / report.dateToken 빈/공백 → descriptor 위임의
//     `assertNonBlank` throw(비식별 박제 방지)를 자체 try/catch 없이 그대로 위로
//     흘려보낸다(조용한 통과 / 재포장 0). 이 단계에서 throw 되면 command-args·search-argv
//     단계는 미도달한다. 이후 단계(command-args·search-argv)의 throw 도 동일하게 전파한다.
//
// 🔥 결정론·무공유 (R-59 정합):
//   - 입력 외 상태(시각·난수·env) 의존 0. 동일 `report` 두 번 호출 → deep-equal 결과.
//     입력 `report` 객체 mutate 0 — 위임 helper 들이 이미 매 호출 새 객체(descriptor 트리 +
//     commandArgs 트리 + 새 searchArgv 배열)를 반환하므로 본 컴포저도 매 호출 새 plan
//     객체(+ 새 descriptor / commandArgs / searchArgv 트리) 를 반환한다(공유 mutable
//     노출 0).
//
// 🔥 R-59 정합 (raw 활동/narrative 본문 구조적 미포함):
//   - plan 은 위임 helper 들이 보유하지 않는 raw narrative / 원본 활동 본문을 구조적으로
//     보유할 수 없다 — descriptor({title, marker, body}) / commandArgs({searchQuery,
//     createArgs, updateArgs}) / searchArgv(searchQuery=marker 만 옮긴 argv) 만
//     통과시킨다. 세 필드의 source 위임 helper 가 모두 raw 본문을 미보유하므로 본
//     컴포저도 구조적으로 raw 를 보유할 수 없다(불변 보존).
//
// 🔥 type 재사용 (중복 정의 0):
//   - `RealDataDailyStepDualLegRunReport` / `RealDataDailyStepDualLegRunReportIssueDescriptor`
//     / `RealDataDailyStepDualLegRunReportIssueCommandArgs` 는 전부 `import type` 재사용
//     한다. 신규 type 정의는 `RealDataDailyStepDualLegRunReportIssuePublishPlan` 컨테이너
//     1 개뿐(SSOT).
//
// 🔥 self-wire 배선됨 (T-1018 — 요약축 T-0666 mirror):
//   - 본 컴포저는 3단 위임 합성 후 반환 직전 consistency 가드
//     `assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(plan, report)`
//     를 self-assert 호출한다(T-1017 가드 신설 → T-1018 self-wire). 요약축도 T-0595 컴포저
//     신설 → T-0665 가드 → T-0666 self-wire 순으로 박제했다 — 본 컴포저는 그 T-0666 단계에
//     대응한다. 가드는 컴포저를 import 하지 않고 하위 세 위임(descriptor → command-args →
//     search-argv)만 import 해 expected 를 재유도하므로 runtime import cycle 위험 없고,
//     정상 합성 plan 은 항상 통과한다. 위임 throw(report.gitSha / dateToken 빈/공백)는
//     descriptor 단계에서 self-assert 도달 전 그대로 전파된다.
//
// Out of Scope (task T-1018):
//   - 가드(T-1017)·위임 3빌더(descriptor / command-args / search-argv) 본문 변경 — 본
//     컴포저는 가드를 import·호출만(재정의 0). 순서대로 호출만
//     (재구현 0).
//   - 종단 post-execution 컴포저(stdout, commandArgs) 변경 — 별도 helper(post-실행 leg).
//   - 실 gh 호출 / `execFile('gh', argv)` / `gh search issues` 실 실행 / 실 이슈 박제
//     (step ④ live wiring — credential gate). 본 컴포저는 (report) → publish plan 만 산출
//     (부수효과 0).
//   - 요약 집계 / 마크다운 렌더 / descriptor·명령-args·search argv 합성 — 전부 위임 안에서
//     처리(재구현 금지).
//   - 자동 복구·정규화·기본값 채움·필드 자동 보정 — 위임 throw 를 그대로 전파만(silent
//     수선 0).
//   - 외부 라이브러리(zod / execa 등) 도입 — 새 dependency 0, 내장 위임 합성만.
//   - production `src/` 코드 변경 — test helper 단독(타입·위임 함수 import 재사용만).
import type { RealDataDailyStepDualLegRunReport } from "./realdata-e2e-daily-step-dual-leg-run-report";
import { buildRealDataDailyStepDualLegRunReportIssueCommandArgs } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
import type { RealDataDailyStepDualLegRunReportIssueCommandArgs } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
import { buildRealDataDailyStepDualLegRunReportIssueDescriptor } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor";
import type { RealDataDailyStepDualLegRunReportIssueDescriptor } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor";
// publish-plan 컴포저 산출 ↔ single-source(report) 3단 재유도 정합 가드(T-1017 신설)를
// 컴포저 산출 경로에 self-wire 한다(T-1018). 합성한 plan 을 반환하기 직전에 self-assert
// 호출 — 컴포저가 세 위임 layer(descriptor → command-args → search-argv) 사이에 끼어
// 결과를 변형/누락/순서 뒤바꾸는 합성 회귀가 발생하면 손상 plan 을 caller 에 반환하기 전에
// fail-fast throw 한다(구조 결손=TypeError / 값 정합 위반=RangeError). 가드 본문은 변경 0
// (T-1017 산출물 그대로 import 재사용). 가드는 컴포저를 import 하지 않고 동일한 세 위임
// (descriptor → command-args → search-argv)만 import 하므로 runtime import cycle 위험 없음.
import { assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan-consistency";
import { buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv";

// RealDataDailyStepDualLegRunReportIssuePublishPlan — dual-leg run report 결과 박제
// leg 의 pre-실행 build-time chain 종단 plan. step ④ live runner 가
// `RealDataDailyStepDualLegRunReport` 하나만 넘기면 받게 되는 "박제할 이슈 descriptor +
// 멱등 명령-args + 실행할 첫 gh argv(search)" 한 묶음.
//   - descriptor: 이슈 식별/본문 descriptor({title, marker, body}, T-0896 산출). 로깅·
//     검증·이슈 본문 source(요약축 publish-plan 의 `report` 필드 자리에 대응).
//   - commandArgs: 이슈 멱등 search-or-update 명령-args({searchQuery, createArgs,
//     updateArgs}, T-0990 산출). 후속 종단 컴포저의 두 번째 인자.
//   - searchArgv: runner 가 `execFile('gh', searchArgv)` 로 실행할 첫 gh 명령 argv
//     (search-argv 빌더 산출 — ["search","issues","--match","body",<searchQuery>,
//     "--json","number,title,body","--limit","30"]).
//
// R-59: 세 필드 모두 이슈 식별자·요약 렌더 본문 / 명령-args(searchQuery·title·body·
// labels) / search argv(marker 만 옮김) 만 보유 — raw narrative / 원본 활동 본문 구조적
// 미포함(위임 helper 들이 이미 미보유).
export interface RealDataDailyStepDualLegRunReportIssuePublishPlan {
  descriptor: RealDataDailyStepDualLegRunReportIssueDescriptor;
  commandArgs: RealDataDailyStepDualLegRunReportIssueCommandArgs;
  searchArgv: string[];
}

// buildRealDataDailyStepDualLegRunReportIssuePublishPlan — dual-leg run report 를 입력
// 받아 이슈 publish plan({ descriptor, commandArgs, searchArgv }) 을 산출하는 **순수
// 컴포저**(pre-실행 build-time chain 의 단일 진입점).
//
// 합성(3 단 순차 위임, 재구현 0):
//   (1) buildRealDataDailyStepDualLegRunReportIssueDescriptor(report) → descriptor
//       (T-0896 위임). report.gitSha / dateToken 빈/공백 → descriptor guard throw 전파.
//   (2) buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor) → commandArgs
//       (T-0990 위임 — descriptor.marker → searchQuery, title/body → create/update args).
//   (3) buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs) → searchArgv
//       (search-argv 빌더 위임 — commandArgs.searchQuery → 첫 gh search argv).
//
// 합성 순서: descriptor 가 먼저 산출돼야 command-args 빌더에, commandArgs 가 산출돼야
// search-argv 빌더에 넘길 수 있다(순차 의존). descriptor guard 가 (1) 단계에서 평가되므로
// 잘못된 report 는 command-args·search-argv 단계 전에 throw(단락 short-circuit).
//
// 순수성·무공유:
//   - 입력 `report`(읽기만, mutate 0). 위임 helper 들이 매 호출 새 descriptor / commandArgs
//     객체 + 새 searchArgv 배열을 반환하므로 본 컴포저도 매 호출 새 plan 객체(+ 새
//     descriptor / commandArgs / searchArgv 트리) 를 반환 — 출력이 입력 / 다음 호출
//     결과와 무공유. 결정론(입력만의 함수).
export function buildRealDataDailyStepDualLegRunReportIssuePublishPlan(
  report: RealDataDailyStepDualLegRunReport,
): RealDataDailyStepDualLegRunReportIssuePublishPlan {
  // (1) report → descriptor(T-0896 위임). report.gitSha / dateToken 빈/공백 의 하위
  // assertNonBlank throw 는 자체 try/catch 없이 그대로 전파된다(command-args·search-argv
  // 단계 미도달). 매 호출 새 descriptor 트리 반환.
  const descriptor =
    buildRealDataDailyStepDualLegRunReportIssueDescriptor(report);

  // (2) descriptor → commandArgs(T-0990 위임). 매 호출 새 commandArgs 트리 반환.
  const commandArgs =
    buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor);

  // (3) commandArgs → 첫 gh search argv(search-argv 빌더 위임). 매 호출 새 argv 배열 반환.
  const searchArgv =
    buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs);

  // 새 plan 객체 — descriptor / commandArgs / searchArgv 는 위임 helper 가 이미 무공유로
  // 반환하므로 입력 보존·무공유.
  const plan = { descriptor, commandArgs, searchArgv };

  // self-wire(T-1018) — 합성한 plan 이 동일 single source `report` 의 3단 재유도와
  // byte-identical 정합한지 반환 직전 검증한다. 정상 합성이면 self-assert 가 void →
  // plan 비변형·byte-identical 보존. 컴포저가 세 위임 사이에 끼어 결과를 변형/누락/순서
  // 뒤바꾸는 합성 회귀가 발생하면 손상 plan 을 caller 에 넘기기 전에 fail-fast throw 한다.
  // 가드는 하위 세 위임만 import 하므로 runtime cycle 없음(정상 plan 은 항상 통과).
  assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(
    plan,
    report,
  );

  return plan;
}
