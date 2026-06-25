// realdata-e2e-result-publish-step-args.ts — 실 평가 e2e run plan + EvaluationResult[] →
// 결과 이슈 publish plan(run 일관) 순수 컴포저 (T-0599 박제).
//
// 책임:
//   - PLAN 109행(🟢 실 평가 e2e, P5) 의 build-time 순수 layer 는 양 끝이 단일 진입점으로
//     닫혀 있다 — seed-side 최외곽 진입 `buildRealDataE2eRunPlan(seeds, modelId, run)`
//     (T-0597) → `{pipeline, run}`, 평가 연결 `buildRealDataEvaluationStepArgs(runPlan,
//     activities)`(T-0598)는 `runPlan.pipeline.modelId` 를 평가 plan 으로 thread 해
//     step ①↔step ③ 모델 정책 일관을 구조적으로 보장한다. 그러나 step ④ 결과 이슈
//     박제의 pre-실행 단일 진입 `buildRealDataResultIssuePublishPlan(results, run)`
//     (T-0595)는 `run`(`RealDataResultIssueRunRef` = gitSha + dateToken)을 **독립 인자로
//     다시 받는다** — live runner 가 step ① `buildRealDataE2eRunPlan` 에 넘겨 검증·보존된
//     `runPlan.run` 과, step ④ publish plan 에 넘기는 `run` 이 build-time 에서 같은
//     값임을 **보장하지 못한다**(두 군데 수동 전달 — run 식별자 불일치 사고 표면: 잘못된
//     gitSha/dateToken 로 결과 이슈가 박제되거나 멱등 marker 가 어긋날 수 있음).
//   - 본 컴포저는 그 분리된 두 link 를 단일 순수 함수
//     `buildRealDataResultPublishStepArgs(runPlan, results)` → `RealDataResultIssuePublishPlan`
//     로 묶어, **검증된 run plan 의 단일 `run` 만을** publish plan 으로 thread 한다(run
//     재전달 0 → step ①↔step ④ run 일관 구조적 보장). T-0598(modelId threading)의 step ④
//     대칭이며, 스트림 전반의 "검증된 runPlan 필드를 단일 source 로 thread 해 caller 가
//     divergent 값을 재전달 못 하게 하는" 박제(T-0598)와 동형이다.
//
// 🔥 run 단일 source (재전달 0 — run 일관 구조적 보장):
//   - publish 단계 run 은 **`runPlan.run` 에서만** 도출한다. 본 컴포저는 독립 `run`
//     인자를 받지 않으므로 caller 가 step ① 과 step ④ 에 run 을 따로 두 번 넘길 수
//     없다 — step ① 에서 검증·보존된 run 이 publish 단계로 그대로 thread 되어 두 단계
//     run 식별자가 build-time 에서 항상 동일하다(잘못된 gitSha/dateToken 으로 결과
//     이슈가 박제되거나 멱등 marker 가 어긋나는 사고 표면 제거).
//
// 🔥 위임 helper 재사용 (재구현 0, SSOT 보존):
//   - 요약 집계·descriptor 합성·명령-args 합성·search argv 합성은 전부
//     T-0595(`buildRealDataResultIssuePublishPlan`) 에 위임한다. 본 컴포저는 report-plan /
//     명령-args / search argv 합성 로직을 재구현하지 않고 run 을 runPlan 에서 추출해
//     위임 호출만 엮는다(중복 0).
//
// 🔥 위임 throw 그대로 전파 (자체 try/catch 0):
//   - `runPlan.run.gitSha` / `runPlan.run.dateToken` 이 빈/공백 → 위임
//     `buildRealDataResultIssuePublishPlan` 하위 command-plan report-plan `assertNonBlank`
//     throw 를 자체 try/catch 없이 그대로 위로 흘려보낸다(조용한 통과 차단). 본 컴포저는
//     추가 guard 를 재구현하지 않는다. (정상 경로의 `runPlan` 은 `buildRealDataE2eRunPlan`
//     이 이미 run 을 검증하므로 빈 run 을 갖지 않는다 — 이 전파는 위임 guard 가 방어선으로
//     살아있음을 보장하는 마지막 그물이다.)
//
// 🔥 결정론·무공유 (R-59 정합):
//   - 입력 외 상태(시각·난수·env) 의존 0. 동일 (runPlan, results) 두 번 호출 → deep-equal
//     결과. 입력 `runPlan`·`results` 배열·원소 mutate 0 — 위임 helper 가 이미 매 호출
//     새 plan 객체(+ 새 report / commandArgs / searchArgv 트리)를 반환하므로 본 컴포저도
//     매 호출 새 plan 객체(공유 mutable 노출 0)를 반환한다. `runPlan.run` 은 객체를
//     읽기만 하므로(위임이 내부에서 새 객체로 복사·합성) runPlan 은 변형되지 않는다.
//
// 🔥 R-59 정합 (raw 활동 본문 구조적 미포함):
//   - 산출 plan 은 식별자 카운트·분류 enum 분포·정량 합산(report.summary) / 이슈 식별자·
//     요약 렌더 본문(report.descriptor) / 명령-args(searchQuery·createArgs·updateArgs) /
//     search argv(marker 만 옮긴 argv) 만 보유하고 raw 활동 본문(commit message 전문 /
//     diff / page 본문 등)을 구조적으로 보유하지 않는다 — 위임 helper(T-0595 및 그 하위
//     T-0594/T-0586)가 raw 미보유를 보장하므로 본 컴포저도 미보유다.
//
// 🔥 type 재사용 (중복 정의 0):
//   - `RealDataE2eRunPlan` / `EvaluationResult` / `RealDataResultIssuePublishPlan` 는
//     전부 import type 재사용한다. 신규 type 정의 0(컨테이너 type 도 위임 측
//     `RealDataResultIssuePublishPlan` 재사용).
//
// Out of Scope (task T-0599):
//   - 실 `EvaluationScoringService.scoreUnit` 호출 / 실 LLM round-trip / Ollama —
//     `results: EvaluationResult[]` 는 인자로만 받음(step ③ live, LAN=AKIHA
//     192.168.0.5, ADR-0045).
//   - 실 github.com 네트워크 fetch / 실 활동 수집(step ② live, LAN/credential gate).
//   - 실 gh 호출 / `execFile('gh', argv)` / 실 이슈 search·create·edit / 실 이슈 박제
//     (step ④ live wiring — credential gate). 본 컴포저는 (runPlan, results) → publish
//     plan descriptor 만 산출(부수효과 0).
//   - gh create/edit stdout 파싱 → outcome report(post-실행 측
//     `buildRealDataResultIssueOutcomeReportFromOutput`, T-0596) — 본 컴포저는 pre-실행
//     publish plan 만 책임(stdout 미보유).
//   - 요약 집계 / 마크다운 렌더 / descriptor 합성 / 명령-args 합성 / report-plan 합성 /
//     search argv 합성 — 전부 T-0595(`buildRealDataResultIssuePublishPlan`) 위임 안에서
//     처리(중복 0).
//   - `runPlan` 의 실 산출(실 seed/run 도출 — `buildRealDataE2eRunPlan` 결과를 인자로만 받음).
//   - `runPlan.run` 의 실 도출(daily-test latest-result.json / git short sha — 인자로만 받음).
//   - 외부 라이브러리(zod / execa 등) 도입 — 새 dependency 0, 내장 위임 합성만.
//   - production `src/` 코드 변경 — test helper 단독(타입·위임 함수 import 재사용만).
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";

import { buildRealDataResultIssuePublishPlan } from "./realdata-e2e-result-issue-publish-plan";
import type { RealDataResultIssuePublishPlan } from "./realdata-e2e-result-issue-publish-plan";
import { assertRealDataResultPublishStepArgsConsistentWithSources } from "./realdata-e2e-result-publish-step-args-consistency";
import type { RealDataE2eRunPlan } from "./realdata-e2e-run-plan";

// buildRealDataResultPublishStepArgs — 검증된 e2e run plan `runPlan` + 평가 결과
// `EvaluationResult[]` 를 입력 받아 결과 이슈 publish plan(report + commandArgs +
// searchArgv) 을 산출하는 **순수 컴포저**(step ④ 결과 이슈 박제 경계의 run-plan 연결).
//
// 합성:
//   - `runPlan.run`(step ① 에서 검증·보존된 단일 run 식별자)을 추출해
//     `buildRealDataResultIssuePublishPlan(results, runPlan.run)` 로 위임한다(report-plan·
//     명령-args·search argv 합성 전부 T-0595 위임 — 재구현 0).
//
// run 단일 source: 독립 run 인자를 받지 않고 오직 runPlan 에서만 도출하므로 step ① 과
// step ④ 의 run 식별자가 build-time 에서 항상 동일하다(재전달 0).
//
// 분기(본 컴포저 자체의 추가 분기 0 — 전부 위임 helper 가 담당):
//   - 빈 `results` 배열 + 유효 `runPlan.run` → report.summary count 0·전 슬롯 0·
//     totalVolume 0 + commandArgs / searchArgv 정상 합성(throw 0). 빈-count plan 반환.
//   - 단일 / 다수 `results` → 위임 helper 가 집계(추가 분기 0).
//   - `runPlan.run.gitSha` / `runPlan.run.dateToken` 빈/공백 → 위임
//     `buildRealDataResultIssuePublishPlan` 하위 report-plan guard throw 를 자체
//     try/catch 없이 그대로 전파.
//
// 순수성·무공유:
//   - 입력 `runPlan`(읽기만 — run 추출, mutate 0) / `results`(읽기만, mutate 0). 위임
//     helper 가 매 호출 새 plan 객체(+ 새 report / commandArgs / searchArgv 트리)를
//     반환하므로 본 컴포저도 매 호출 새 plan 객체를 반환 — 출력이 입력 / 다음 호출
//     결과와 무공유. 결정론(입력만의 함수).
export function buildRealDataResultPublishStepArgs(
  runPlan: RealDataE2eRunPlan,
  results: EvaluationResult[],
): RealDataResultIssuePublishPlan {
  // run plan 에서 검증·보존된 단일 run 식별자를 추출해 publish plan 으로 thread. 독립
  // run 인자 미수신 — step ① / step ④ run 식별자 일관 구조적 보장(재전달 0). 빈/공백
  // gitSha/dateToken 의 guard throw 는 위임 helper 가 자체 try/catch 없이 그대로 전파한다.
  const plan = buildRealDataResultIssuePublishPlan(results, runPlan.run);

  // 산출 plan 반환 직전 self-assert(T-0668 self-wire) — 컴포저가 runPlan.run 추출/재전달/
  // 위임 plan 반환 과정에서 run 인자 위치를 뒤바꾸거나 plan 을 변형/누락하는 합성 회귀를
  // single-source 재유도(buildRealDataResultIssuePublishPlan(results, runPlan.run)) 와의
  // byte-identical 정합 검증으로 호출 시점에 fail-fast 차단한다. 정상 합성이면 가드는 void →
  // 반환 plan byte-identical·무공유 보존(관측 불가능하게 동일). 가드는 read-only 라 plan/
  // runPlan/results mutate 0.
  assertRealDataResultPublishStepArgsConsistentWithSources(
    plan,
    runPlan,
    results,
  );

  return plan;
}
