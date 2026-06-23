// realdata-e2e-result-issue-command-plan.ts — 실 평가 e2e EvaluationResult[] + run →
// 결과 이슈 gh 명령-args 종단 순수 컴포저 (T-0594 박제).
//
// 책임:
//   - PLAN.md 109행(🟢 실 평가 e2e, P5) 의 post-evaluation interpretation(평가 산출
//     → 결과 이슈 박제) 측 build-time chain 은 T-0593 으로 `EvaluationResult[]` + run →
//     결과 이슈 **descriptor** 까지 닫혔다(`buildRealDataResultReportPlan(results, run)
//     → {summary, descriptor}`). 그러나 그 descriptor 를 step ④ 박제측이 소비하는 gh
//     **명령-args**(`RealDataResultIssueCommandArgs`)로 바꾸려면 caller 가
//     `buildRealDataResultIssueCommandArgs(descriptor)`(T-0583)를 한 번 더 수동으로
//     엮어야 한다 — 즉 `EvaluationResult[]` + run 에서 gh 명령-args 까지의 경로가 아직
//     두 helper 호출로 흩어져 있다.
//   - 본 컴포저는 그 2 단계를 단일 순수 함수 `buildRealDataResultIssueCommandPlan(
//     results, run)` 로 합성해 post-evaluation interpretation 측을 종단까지 닫는다 —
//     (1) `buildRealDataResultReportPlan(results, run)`(T-0593) → `{summary, descriptor}`,
//     (2) `buildRealDataResultIssueCommandArgs(report.descriptor)`(T-0583) →
//     `RealDataResultIssueCommandArgs`. 산출 `{report, commandArgs}` 의 `commandArgs` 는
//     정확히 step ④ 종단 컴포저 `resolveRealDataResultIssueGhCommandPlan(stdout,
//     commandArgs)`(T-0588)가 받는 두 번째 인자다. seed-side `buildRealDataPipelinePlan`
//     (T-0592) / evaluate-side `buildRealDataEvaluationPlan`(T-0591) / 박제 종단
//     `resolveRealDataResultIssueGhCommandPlan`(T-0588) 과 동형의 "분리된 순수 link 들을
//     단일 plan 컴포저로 묶는" 박제다.
//
// 🔥 위임 helper 재사용 (재구현 0, SSOT 보존):
//   - 요약 집계·이슈 descriptor 합성은 T-0593(`buildRealDataResultReportPlan`), 명령-args
//     합성은 T-0583(`buildRealDataResultIssueCommandArgs`) 에 위임한다. 본 컴포저는 집계 /
//     렌더 / 명령-args 합성 로직을 재구현하지 않고 위임 호출만 순서대로 엮는다(중복 0).
//
// 🔥 위임 throw 그대로 전파 (자체 try/catch 0):
//   - run.gitSha / run.dateToken 빈/공백 → report-plan 측 하위 `assertNonBlank` throw,
//     descriptor.title / marker 빈/공백 → command-args 측 `assertNonBlank` throw 를 자체
//     try/catch 없이 그대로 위로 흘려보낸다(조용한 통과 / 재포장 0).
//
// 🔥 결정론·무공유 (R-59 정합):
//   - 입력 외 상태(시각·난수·env) 의존 0. 동일 (results, run) 두 번 호출 → deep-equal
//     결과. 입력 `results` 배열·원소 / `run` 객체 mutate 0 — 위임 helper 들이 이미 매 호출
//     새 객체(report·commandArgs·중첩 createArgs.labels 배열 포함)를 반환하므로 본 컴포저도
//     매 호출 새 plan 객체(+ 새 report / commandArgs 트리) 를 반환한다(공유 mutable 노출 0).
//
// 🔥 R-59 정합 (raw 활동/narrative 본문 구조적 미포함):
//   - plan 은 위임 helper 들이 보유하지 않는 raw narrative / 원본 활동 본문을 구조적으로
//     보유할 수 없다 — `RealDataResultReportPlan`(요약 집계 + title/marker/body descriptor
//     만)과 `RealDataResultIssueCommandArgs`(searchQuery / createArgs / updateArgs, body 는
//     descriptor.body 전달만) 만 통과시킨다. 두 위임 helper 가 이미 raw 본문을 미보유하므로
//     본 컴포저도 구조적으로 raw 를 보유할 수 없다(불변 보존).
//
// 🔥 type 재사용 (중복 정의 0):
//   - `EvaluationResult` / `RealDataResultIssueRunRef` / `RealDataResultReportPlan` /
//     `RealDataResultIssueCommandArgs` 는 전부 import type 재사용한다. 신규 type 정의는
//     `RealDataResultIssueCommandPlan` 컨테이너 1 개뿐(SSOT).
//
// Out of Scope (task T-0594):
//   - 실 `EvaluationScoringService.scoreUnit` 호출 / 실 LLM round-trip / Ollama /
//     `EvaluationResult` 실 산출(step ③ live, LAN=AKIHA 192.168.0.5, ADR-0045).
//   - 실 github.com 네트워크 fetch / 실 활동 수집(step ② live, LAN/credential gate).
//   - 실 gh 호출 / `execFile('gh', argv)` / 실 이슈 search·create·edit / 실 이슈 박제
//     (step ④ live wiring — credential gate). 본 컴포저는 (results, run) → command plan
//     descriptor 만 산출(부수효과 0).
//   - gh search stdout 파싱 → action 분기 → argv 합성(T-0587/T-0584/T-0585/T-0588 측
//     `resolveRealDataResultIssueGhCommandPlan`) — 본 helper 는 그 컴포저가 받는
//     `commandArgs` 입력까지만 책임.
//   - run.gitSha / run.dateToken 의 실 도출(daily-test latest-result.json / git short sha —
//     인자로만 받음).
//   - 마크다운 렌더(T-0581 위임) / 요약 집계(T-0580) / descriptor 합성(T-0582) — 본 helper
//     는 EvaluationResult[]+run → 결과 이슈 명령-args 단일 책임(위임만).
//   - 외부 라이브러리(zod 등) 도입 — 새 dependency 0, 내장 검증만.
//   - production `src/` 코드 변경 — test helper 단독(타입·위임 함수 import 재사용만).
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";

import type { RealDataResultIssueCommandArgs } from "./realdata-e2e-result-issue-command-args";
import { buildRealDataResultIssueCommandArgs } from "./realdata-e2e-result-issue-command-args";
import type { RealDataResultIssueRunRef } from "./realdata-e2e-result-issue-descriptor";
import type { RealDataResultReportPlan } from "./realdata-e2e-result-report-plan";
import { buildRealDataResultReportPlan } from "./realdata-e2e-result-report-plan";

// RealDataResultIssueCommandPlan — post-evaluation interpretation 종단 plan 의 출력.
// step ④ live runner 가 `EvaluationResult[]` + run 식별자만 넘기면 받게 되는 "결과
// 리포트 + 결과 이슈 멱등 명령-args" 한 묶음.
//   - report: 결과 리포트 plan({summary, descriptor}, T-0593 산출). 요약 집계 + 이슈
//     descriptor(title/marker/body). 로깅·검증·이슈 본문 source.
//   - commandArgs: 결과 이슈 멱등 search-or-update 명령-args(searchQuery / createArgs /
//     updateArgs, T-0583 산출). step ④ 종단 컴포저
//     `resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs)`(T-0588)의 두 번째 인자.
//
// R-59: 두 필드 모두 식별자 카운트·분류 enum 분포·정량 합산 / 이슈 식별자·요약 렌더 본문 /
// 명령-args(searchQuery·title·body·labels)만 보유 — raw narrative / 원본 활동 본문 구조적
// 미포함(위임 helper 들이 이미 미보유).
export interface RealDataResultIssueCommandPlan {
  report: RealDataResultReportPlan;
  commandArgs: RealDataResultIssueCommandArgs;
}

// buildRealDataResultIssueCommandPlan — 평가 결과 `EvaluationResult[]` + run 식별자를
// 입력 받아 결과 이슈 명령 plan({ report, commandArgs }) 을 산출하는 **순수 컴포저**.
//
// 합성(2 단계 위임, 재구현 0):
//   (1) buildRealDataResultReportPlan(results, run) → report({summary, descriptor},
//       T-0593 위임). run.gitSha/dateToken 빈/공백 → 하위 report-plan guard throw 전파.
//   (2) buildRealDataResultIssueCommandArgs(report.descriptor) → commandArgs(T-0583
//       위임, searchQuery/createArgs/updateArgs 합성). descriptor.title/marker 빈/공백 →
//       command-args guard throw 전파.
//
// 분기:
//   - 빈 `results` 배열 + 유효 run → report.summary count 0·전 슬롯 0·totalVolume 0 +
//     descriptor / commandArgs 정상 합성(throw 0).
//   - 단일 / 다수 result → 위임 helper 가 집계(추가 분기 0).
//   - run.gitSha / dateToken 빈/공백 → (1) report-plan 단계에서 throw 전파(commandArgs
//     단계 도달 0).
//
// 합성 순서: report 가 먼저 산출돼야 descriptor 를 command-args 빌더에 넘길 수 있다. run
// guard 가 (1) report-plan 단계에서 평가되므로 잘못된 run 은 commandArgs 단계 전에 throw.
//
// 순수성·무공유:
//   - 입력 `results`(읽기만, mutate 0) / `run`(읽기만, mutate 0). 위임 helper 들이 매 호출
//     새 report / commandArgs 객체(+ 새 createArgs.labels 배열) 를 반환하므로 본 컴포저도
//     매 호출 새 plan 객체(+ 새 report / commandArgs 트리) 를 반환 — 출력이 입력 / 다음
//     호출 결과와 무공유. 결정론(입력만의 함수).
export function buildRealDataResultIssueCommandPlan(
  results: EvaluationResult[],
  run: RealDataResultIssueRunRef,
): RealDataResultIssueCommandPlan {
  // (1) EvaluationResult[] + run → 결과 리포트 plan(T-0593 위임). run.gitSha /
  // dateToken 빈/공백 의 하위 assertNonBlank throw 는 자체 try/catch 없이 그대로
  // 전파된다. 매 호출 새 report 객체(+ summary / descriptor 트리) 반환.
  const report = buildRealDataResultReportPlan(results, run);

  // (2) descriptor → gh issue 멱등 명령-args(T-0583 위임). descriptor.title / marker
  // 빈/공백 의 하위 assertNonBlank throw 도 그대로 전파된다. 매 호출 새 commandArgs
  // 객체(+ createArgs / updateArgs / labels 배열) 반환.
  const commandArgs = buildRealDataResultIssueCommandArgs(report.descriptor);

  // 새 plan 객체 — report / commandArgs 는 위임 helper 가 이미 무공유로 반환하므로
  // 입력 보존·무공유.
  return { report, commandArgs };
}
