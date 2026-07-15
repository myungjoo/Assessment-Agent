// realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan.ts — 실 평가 e2e
// daily-step dual-leg run report → 이슈 command plan(descriptor + commandArgs) 중간
// 순수 컴포저 (T-1019 박제, 요약축 T-0594 mirror).
//
// 책임:
//   - PLAN.md 109행(🟢 실 평가 e2e, P5) step ④ 결과 박제 leg 의 pre-실행 build-time
//     chain 은 요약축(`result-issue-*`)에서 두 층으로 박제돼 있다 — (1)
//     `buildRealDataResultIssueCommandPlan(results, run)`(T-0594, report-plan +
//     command-args 2단 위임 중간 컴포저) → `{report, commandArgs}`, 그 위에 (2)
//     `buildRealDataResultIssuePublishPlan(results, run)`(T-0595, command-plan +
//     search-argv 위임 종단 컴포저)가 얹힌다. daily-step 축은 publish-plan 종단
//     컴포저(T-1016)를 먼저 3단 직접 위임으로 박제했으나 그 **중간 층인
//     command-plan(`{descriptor, commandArgs}`)이 아직 별도 seam 으로 부재**했다 —
//     요약축이 갖춘 command-plan ↔ publish-plan 2층 구조가 daily-step 에는 한
//     층(publish-plan)만 있었다.
//   - 본 컴포저는 그 중간 층을 박제한다 — 순수 함수
//     `buildRealDataDailyStepDualLegRunReportIssueCommandPlan(report)` 가 (1)
//     `buildRealDataDailyStepDualLegRunReportIssueDescriptor(report)`(T-0896) →
//     `{title, marker, body}` descriptor, (2)
//     `buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor)`(T-0990) →
//     `RealDataDailyStepDualLegRunReportIssueCommandArgs` 2단을 순차 위임 합성해
//     `{descriptor, commandArgs}` plan 을 산출한다. 산출 `commandArgs` 는 정확히
//     post-실행 종단 컴포저 `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
//     stdout, commandArgs)`(T-0997)가 받는 두 번째 인자이고, 산출 `descriptor` 는
//     publish-plan(T-1016)이 이미 노출하는 것과 동일 구조다. 요약축 T-0594 중간
//     컴포저의 daily-step mirror 이며 T-1018 Follow-up ① 이 명시한 자연 후속(잔여
//     미미러 command-plan seam)이다.
//
// 🔥 위임 topology (요약축과의 대응):
//   - 요약축 command-plan 은 (results, run) → report-plan(집계+descriptor) →
//     command-args 2단 위임이라 산출이 `{report, commandArgs}` 다. daily-step 은 입력이
//     단일 `report`(RunReport)이고 report-plan wrapper 가 없어 descriptor(report →
//     descriptor) → command-args(descriptor → commandArgs) 2단이며 산출이
//     `{descriptor, commandArgs}`(요약축의 `report` 층 없음) 다. daily-step 의 descriptor
//     가 요약축의 report-plan 역할(rendered issue content)을 한다.
//
// 🔥 위임 helper 재사용 (재구현 0, SSOT 보존):
//   - descriptor 합성은 T-0896, 명령-args 합성은 T-0990 에 위임한다. 본 컴포저는 집계 /
//     렌더 / 명령-args 합성 로직을 재구현하지 않고 위임 호출만 순서대로 엮는다(중복 0 —
//     하위 helper 직접 재구현 0).
//
// 🔥 위임 throw 그대로 전파 (자체 try/catch 0):
//   - descriptor 단계 report.gitSha / report.dateToken 빈/공백 → descriptor 위임의
//     `assertNonBlank` throw(비식별 박제 방지)를 자체 try/catch 없이 그대로 위로
//     흘려보낸다(조용한 통과 / 재포장 0). 이 단계에서 throw 되면 command-args 단계는
//     미도달한다. descriptor.title / marker 빈/공백 → command-args 위임 throw 도 동일하게
//     전파한다.
//
// 🔥 결정론·무공유 (R-59 정합):
//   - 입력 외 상태(시각·난수·env) 의존 0. 동일 `report` 두 번 호출 → deep-equal 결과.
//     입력 `report` 객체 mutate 0 — 위임 helper 들이 이미 매 호출 새 객체(descriptor 트리 +
//     commandArgs 트리 + 중첩 createArgs.labels 배열)를 반환하므로 본 컴포저도 매 호출
//     새 plan 객체(+ 새 descriptor / commandArgs 트리) 를 반환한다(공유 mutable 노출 0).
//
// 🔥 R-59 정합 (raw 활동/narrative 본문 구조적 미포함):
//   - plan 은 위임 helper 들이 보유하지 않는 raw narrative / 원본 활동 본문을 구조적으로
//     보유할 수 없다 — descriptor({title, marker, body}) / commandArgs({searchQuery,
//     createArgs, updateArgs}) 만 통과시킨다. 두 위임 helper 가 이미 raw 본문을 미보유하므로
//     본 컴포저도 구조적으로 raw 를 보유할 수 없다(불변 보존).
//
// 🔥 type 재사용 (중복 정의 0):
//   - `RealDataDailyStepDualLegRunReport` / `RealDataDailyStepDualLegRunReportIssueDescriptor`
//     / `RealDataDailyStepDualLegRunReportIssueCommandArgs` 는 전부 `import type` 재사용
//     한다. 신규 type 정의는 `RealDataDailyStepDualLegRunReportIssueCommandPlan` 컨테이너
//     1 개뿐(SSOT).
//
// Out of Scope (task T-1019):
//   - command-plan consistency 가드(요약축 T-0696 mirror —
//     `assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithInputs`) 신설·
//     self-wire — 별도 후속 slice(본 task 는 컴포저 신설만, 요약축 T-0594 가 이미 배선한
//     self-assert 호출 라인은 mirror 하지 않는다).
//   - publish-plan(T-1016)을 command-plan 위임으로 리팩터(publish-plan = command-plan +
//     searchArgv) — publish-plan.ts 본문 변경 대상이라 별도 slice(무회귀).
//   - 위임 2빌더(descriptor T-0896 / command-args T-0990) 본문·spec 변경 — 본 컴포저는 그
//     산출을 합성만(재정의 0).
//   - 종단 post-execution 컴포저(stdout, commandArgs)·outcome-report·search seam 변경 —
//     별개 seam.
//   - 실 gh 호출 / `execFile('gh', argv)` / `gh search issues` 실 실행 / 실 이슈 박제
//     (step ④ live wiring — credential gate). 본 컴포저는 (report) → command plan 만 산출
//     (부수효과 0).
//   - 요약 집계 / 마크다운 렌더 / descriptor·명령-args 합성 — 전부 위임 안에서 처리
//     (재구현 금지).
//   - 자동 복구·정규화·기본값 채움·필드 자동 보정 — 위임 throw 를 그대로 전파만(silent
//     수선 0).
//   - 외부 라이브러리(zod / execa 등) 도입 — 새 dependency 0, 내장 위임 합성만.
//   - production `src/` 코드 변경 — test helper 단독(타입·위임 함수 import 재사용만).
import type { RealDataDailyStepDualLegRunReport } from "./realdata-e2e-daily-step-dual-leg-run-report";
import { buildRealDataDailyStepDualLegRunReportIssueCommandArgs } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
import type { RealDataDailyStepDualLegRunReportIssueCommandArgs } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
import { buildRealDataDailyStepDualLegRunReportIssueDescriptor } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor";
import type { RealDataDailyStepDualLegRunReportIssueDescriptor } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor";

// RealDataDailyStepDualLegRunReportIssueCommandPlan — dual-leg run report 결과 박제
// leg 의 pre-실행 build-time chain 중간 plan. step ④ live runner 가
// `RealDataDailyStepDualLegRunReport` 하나만 넘기면 받게 되는 "박제할 이슈 descriptor +
// 멱등 search-or-update 명령-args" 한 묶음(publish-plan 의 searchArgv 층을 뺀 prefix).
//   - descriptor: 이슈 식별/본문 descriptor({title, marker, body}, T-0896 산출). 로깅·
//     검증·이슈 본문 source(요약축 command-plan 의 `report` 필드 자리에 대응).
//   - commandArgs: 이슈 멱등 search-or-update 명령-args({searchQuery, createArgs,
//     updateArgs}, T-0990 산출). post-실행 종단 컴포저
//     `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(stdout, commandArgs)`
//     (T-0997)의 두 번째 인자.
//
// R-59: 두 필드 모두 이슈 식별자·요약 렌더 본문 / 명령-args(searchQuery·title·body·
// labels) 만 보유 — raw narrative / 원본 활동 본문 구조적 미포함(위임 helper 들이 이미
// 미보유).
export interface RealDataDailyStepDualLegRunReportIssueCommandPlan {
  descriptor: RealDataDailyStepDualLegRunReportIssueDescriptor;
  commandArgs: RealDataDailyStepDualLegRunReportIssueCommandArgs;
}

// buildRealDataDailyStepDualLegRunReportIssueCommandPlan — dual-leg run report 를 입력
// 받아 이슈 command plan({ descriptor, commandArgs }) 을 산출하는 **순수 컴포저**
// (pre-실행 build-time chain 의 중간 진입점).
//
// 합성(2 단 순차 위임, 재구현 0):
//   (1) buildRealDataDailyStepDualLegRunReportIssueDescriptor(report) → descriptor
//       (T-0896 위임). report.gitSha / dateToken 빈/공백 → descriptor guard throw 전파.
//   (2) buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor) → commandArgs
//       (T-0990 위임 — descriptor.marker → searchQuery, title/body → create/update args).
//       descriptor.title / marker 빈/공백 → command-args guard throw 전파.
//
// 합성 순서: descriptor 가 먼저 산출돼야 command-args 빌더에 넘길 수 있다(순차 의존).
// descriptor guard 가 (1) 단계에서 평가되므로 잘못된 report 는 command-args 단계 전에
// throw(단락 short-circuit).
//
// 순수성·무공유:
//   - 입력 `report`(읽기만, mutate 0). 위임 helper 들이 매 호출 새 descriptor / commandArgs
//     객체를 반환하므로 본 컴포저도 매 호출 새 plan 객체(+ 새 descriptor / commandArgs
//     트리) 를 반환 — 출력이 입력 / 다음 호출 결과와 무공유. 결정론(입력만의 함수).
export function buildRealDataDailyStepDualLegRunReportIssueCommandPlan(
  report: RealDataDailyStepDualLegRunReport,
): RealDataDailyStepDualLegRunReportIssueCommandPlan {
  // (1) report → descriptor(T-0896 위임). report.gitSha / dateToken 빈/공백 의 하위
  // assertNonBlank throw 는 자체 try/catch 없이 그대로 전파된다(command-args 단계
  // 미도달). 매 호출 새 descriptor 트리 반환.
  const descriptor =
    buildRealDataDailyStepDualLegRunReportIssueDescriptor(report);

  // (2) descriptor → commandArgs(T-0990 위임). descriptor.title / marker 빈/공백 의 하위
  // assertNonBlank throw 도 그대로 전파된다. 매 호출 새 commandArgs 트리(+ createArgs /
  // updateArgs / labels 배열) 반환.
  const commandArgs =
    buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor);

  // 새 plan 객체 — descriptor / commandArgs 는 위임 helper 가 이미 무공유로 반환하므로
  // 입력 보존·무공유. (consistency 가드 self-wire 는 후속 slice — 요약축 T-0594 의
  // self-assert 호출 라인은 본 task 에서 mirror 하지 않는다.)
  const plan = { descriptor, commandArgs };

  return plan;
}
