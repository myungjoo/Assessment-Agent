// realdata-e2e-result-issue-publish-plan.ts — 실 평가 e2e EvaluationResult[] + run →
// 결과 이슈 publish plan(report + commandArgs + searchArgv) 종단 순수 컴포저 (T-0595 박제).
//
// 책임:
//   - PLAN.md 109행(🟢 실 평가 e2e, P5) 의 post-evaluation interpretation(평가 산출
//     → 결과 이슈 박제) 측 build-time chain 은 T-0594 `buildRealDataResultIssueCommandPlan(
//     results, run)` 로 `EvaluationResult[]` + run → `{report, commandArgs}` 까지 닫혔고,
//     T-0586 `buildRealDataResultIssueSearchGhArgv(commandArgs)` 로 commandArgs →
//     **첫 gh 호출(search) argv** 까지 닫혔다. 그러나 step ④ live runner 가 한 번에
//     받아야 하는 "결과 리포트 + 멱등 명령-args + 실행할 첫 gh argv(search)" 묶음은
//     아직 두 helper(T-0594 + T-0586)를 caller 가 수동으로 엮어야 산출된다.
//   - 본 컴포저는 그 2 단계를 단일 순수 함수 `buildRealDataResultIssuePublishPlan(
//     results, run)` → `{report, commandArgs, searchArgv}` 로 합성해 **pre-실행
//     build-time chain 의 단일 진입점**을 닫는다 — (1) `buildRealDataResultIssueCommandPlan(
//     results, run)`(T-0594) → `{report, commandArgs}`, (2) `buildRealDataResultIssueSearchGhArgv(
//     commandArgs)`(T-0586) → `searchArgv: string[]`. 산출 `searchArgv` 는 runner 가
//     `execFile('gh', searchArgv)` 로 실행할 첫 명령이고, 산출 `commandArgs` 는 그
//     stdout 과 함께 종단 컴포저 `resolveRealDataResultIssueGhCommandPlan(stdout,
//     commandArgs)`(T-0588)로 넘어간다. seed-side `buildRealDataPipelinePlan`(T-0592) /
//     evaluate-side `buildRealDataEvaluationPlan`(T-0591) / 박제 종단
//     `resolveRealDataResultIssueGhCommandPlan`(T-0588) / post-evaluation
//     `buildRealDataResultIssueCommandPlan`(T-0594) 과 동형의 "분리된 순수 link 들을
//     단일 plan 컴포저로 묶는" 박제다.
//
// 🔥 위임 helper 재사용 (재구현 0, SSOT 보존):
//   - 요약 집계·descriptor 합성·명령-args 합성은 T-0594(`buildRealDataResultIssueCommandPlan`),
//     search argv 합성은 T-0586(`buildRealDataResultIssueSearchGhArgv`) 에 위임한다.
//     본 컴포저는 집계 / 렌더 / 명령-args / search argv 합성 로직을 재구현하지 않고
//     위임 호출만 순서대로 엮는다(중복 0 — 하위 helper 직접 호출 0).
//
// 🔥 위임 throw 그대로 전파 (자체 try/catch 0):
//   - run.gitSha / run.dateToken 빈/공백 → command-plan 측 하위 report-plan
//     `assertNonBlank` throw 를 자체 try/catch 없이 그대로 위로 흘려보낸다(조용한
//     통과 / 재포장 0). 이 단계에서 throw 되면 searchArgv 단계는 미도달한다.
//
// 🔥 결정론·무공유 (R-59 정합):
//   - 입력 외 상태(시각·난수·env) 의존 0. 동일 (results, run) 두 번 호출 → deep-equal
//     결과. 입력 `results` 배열·원소 / `run` 객체 mutate 0 — 위임 helper 들이 이미 매
//     호출 새 객체(report·commandArgs 트리 + 새 searchArgv 배열)를 반환하므로 본
//     컴포저도 매 호출 새 plan 객체(+ 새 report / commandArgs / searchArgv 트리) 를
//     반환한다(공유 mutable 노출 0).
//
// 🔥 R-59 정합 (raw 활동/narrative 본문 구조적 미포함):
//   - plan 은 위임 helper 들이 보유하지 않는 raw narrative / 원본 활동 본문을 구조적
//     으로 보유할 수 없다 — `RealDataResultReportPlan`(요약 집계 + descriptor) /
//     `RealDataResultIssueCommandArgs`(searchQuery / createArgs / updateArgs) /
//     `searchArgv`(commandArgs.searchQuery=marker 만 옮긴 argv) 만 통과시킨다. 세
//     필드의 source 위임 helper 가 모두 raw 본문을 미보유하므로 본 컴포저도 구조적
//     으로 raw 를 보유할 수 없다(불변 보존).
//
// 🔥 type 재사용 (중복 정의 0):
//   - `EvaluationResult` / `RealDataResultIssueRunRef` / `RealDataResultReportPlan` /
//     `RealDataResultIssueCommandArgs` 는 전부 import type 재사용한다. 신규 type
//     정의는 `RealDataResultIssuePublishPlan` 컨테이너 1 개뿐(SSOT).
//
// Out of Scope (task T-0595):
//   - 실 `EvaluationScoringService.scoreUnit` 호출 / 실 LLM round-trip / Ollama /
//     `EvaluationResult` 실 산출(step ③ live, LAN=AKIHA 192.168.0.5, ADR-0045).
//   - 실 github.com 네트워크 fetch / 실 활동 수집(step ② live, LAN/credential gate).
//   - 실 gh 호출 / `execFile('gh', argv)` / 실 이슈 search·create·edit / 실 이슈 박제
//     (step ④ live wiring — credential gate). 본 컴포저는 (results, run) → publish
//     plan descriptor 만 산출(부수효과 0).
//   - gh search stdout 파싱 → action 분기 → create/edit argv 합성(T-0587/T-0584/
//     T-0585/T-0588 측 `resolveRealDataResultIssueGhCommandPlan`) — 본 helper 는 그
//     컴포저가 받는 `commandArgs` + 첫 gh `searchArgv` 까지만 책임(stdout 은 미보유).
//   - 요약 집계 / 마크다운 렌더 / descriptor 합성 / 명령-args 합성 / report-plan 합성 —
//     전부 T-0594 / T-0586 위임 안에서 처리(재구현 금지).
//   - run.gitSha / run.dateToken 의 실 도출(daily-test latest-result.json / git short
//     sha — 인자로만 받음).
//   - 외부 라이브러리(zod / execa 등) 도입 — 새 dependency 0, 내장 위임 합성만.
//   - production `src/` 코드 변경 — test helper 단독(타입·위임 함수 import 재사용만).
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";

import type { RealDataResultIssueCommandArgs } from "./realdata-e2e-result-issue-command-args";
import { buildRealDataResultIssueCommandPlan } from "./realdata-e2e-result-issue-command-plan";
import type { RealDataResultIssueRunRef } from "./realdata-e2e-result-issue-descriptor";
// publish-plan 컴포저 산출 ↔ single-source 재유도 정합 가드(T-0665 신설)를 컴포저 산출
// 경로에 self-wire 한다(T-0666). 합성한 plan 을 반환하기 직전에 self-assert 호출 — 컴포저가
// 두 위임 layer(command-plan → search-argv) 사이에 끼어 결과를 변형/누락/순서 뒤바꾸는 합성
// 회귀가 발생하면 손상 plan 을 caller 에 반환하기 전에 fail-fast throw 한다(구조 결손=TypeError /
// 값 정합 위반=RangeError). 가드 본문은 변경 0(T-0665 산출물 그대로 import 재사용). 가드는
// 컴포저와 동일한 두 위임(command-plan→search-argv)을 import 하므로 runtime cycle 위험 없음.
import { assertRealDataResultIssuePublishPlanConsistentWithSources } from "./realdata-e2e-result-issue-publish-plan-consistency";
import { buildRealDataResultIssueSearchGhArgv } from "./realdata-e2e-result-issue-search-argv";
import type { RealDataResultReportPlan } from "./realdata-e2e-result-report-plan";

// RealDataResultIssuePublishPlan — post-evaluation interpretation 의 pre-실행
// build-time chain 종단 plan. step ④ live runner 가 `EvaluationResult[]` + run
// 식별자만 넘기면 받게 되는 "결과 리포트 + 멱등 명령-args + 실행할 첫 gh argv(search)"
// 한 묶음.
//   - report: 결과 리포트 plan({summary, descriptor}, T-0593 산출 → T-0594 경유).
//     로깅·검증·이슈 본문 source.
//   - commandArgs: 결과 이슈 멱등 search-or-update 명령-args(searchQuery / createArgs /
//     updateArgs, T-0583 산출 → T-0594 경유). step ④ 종단 컴포저
//     `resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs)`(T-0588)의 두 번째 인자.
//   - searchArgv: runner 가 `execFile('gh', searchArgv)` 로 실행할 첫 gh 명령 argv
//     (T-0586 산출 — ["search","issues","--match","body",<searchQuery>,"--json",
//     "number,title,body","--limit","30"]).
//
// R-59: 세 필드 모두 식별자 카운트·분류 enum 분포·정량 합산 / 이슈 식별자·요약 렌더
// 본문 / 명령-args(searchQuery·title·body·labels) / search argv(marker 만 옮김) 만
// 보유 — raw narrative / 원본 활동 본문 구조적 미포함(위임 helper 들이 이미 미보유).
export interface RealDataResultIssuePublishPlan {
  report: RealDataResultReportPlan;
  commandArgs: RealDataResultIssueCommandArgs;
  searchArgv: string[];
}

// buildRealDataResultIssuePublishPlan — 평가 결과 `EvaluationResult[]` + run 식별자를
// 입력 받아 결과 이슈 publish plan({ report, commandArgs, searchArgv }) 을 산출하는
// **순수 컴포저**(pre-실행 build-time chain 의 단일 진입점).
//
// 합성(2 단계 위임, 재구현 0):
//   (1) buildRealDataResultIssueCommandPlan(results, run) → {report, commandArgs}
//       (T-0594 위임 — 내부에서 T-0593 report-plan + T-0583 명령-args 합성).
//       run.gitSha/dateToken 빈/공백 → 하위 report-plan guard throw 전파.
//   (2) buildRealDataResultIssueSearchGhArgv(commandArgs) → searchArgv: string[]
//       (T-0586 위임 — commandArgs.searchQuery → 첫 gh search argv).
//
// 분기:
//   - 빈 `results` 배열 + 유효 run → report.summary count 0·전 슬롯 0·totalVolume 0 +
//     commandArgs / searchArgv 정상 합성(throw 0).
//   - 단일 / 다수 result → 위임 helper 가 집계(추가 분기 0).
//   - run.gitSha / dateToken 빈/공백 → (1) command-plan 단계에서 throw 전파
//     (searchArgv 단계 도달 0).
//
// 합성 순서: commandArgs 가 먼저 산출돼야 search argv 빌더에 넘길 수 있다. run guard
// 가 (1) command-plan 단계에서 평가되므로 잘못된 run 은 searchArgv 단계 전에 throw.
//
// 순수성·무공유:
//   - 입력 `results`(읽기만, mutate 0) / `run`(읽기만, mutate 0). 위임 helper 들이 매
//     호출 새 report / commandArgs 객체 + 새 searchArgv 배열을 반환하므로 본 컴포저도
//     매 호출 새 plan 객체(+ 새 report / commandArgs / searchArgv 트리) 를 반환 —
//     출력이 입력 / 다음 호출 결과와 무공유. 결정론(입력만의 함수).
export function buildRealDataResultIssuePublishPlan(
  results: EvaluationResult[],
  run: RealDataResultIssueRunRef,
): RealDataResultIssuePublishPlan {
  // (1) EvaluationResult[] + run → {report, commandArgs}(T-0594 위임). run.gitSha /
  // dateToken 빈/공백 의 하위 assertNonBlank throw 는 자체 try/catch 없이 그대로
  // 전파된다(searchArgv 단계 미도달). 매 호출 새 report / commandArgs 트리 반환.
  const { report, commandArgs } = buildRealDataResultIssueCommandPlan(
    results,
    run,
  );

  // (2) commandArgs → 첫 gh search argv(T-0586 위임). 매 호출 새 argv 배열 반환.
  const searchArgv = buildRealDataResultIssueSearchGhArgv(commandArgs);

  // 새 plan 객체 — report / commandArgs / searchArgv 는 위임 helper 가 이미 무공유로
  // 반환하므로 입력 보존·무공유.
  const plan = { report, commandArgs, searchArgv };

  // self-wire(T-0666) — 합성한 plan 이 동일 (results, run) 의 single-source 재유도와
  // byte-identical 정합한지 반환 직전 검증한다. 정상 합성이면 self-assert 가 void →
  // plan 비변형·byte-identical 보존. 컴포저가 두 위임 사이에 끼어 결과를 변형/누락/순서
  // 뒤바꾸는 합성 회귀가 발생하면 손상 plan 을 caller 에 넘기기 전에 fail-fast throw 한다.
  assertRealDataResultIssuePublishPlanConsistentWithSources(plan, results, run);

  return plan;
}
