// realdata-e2e-step-args.ts — 실 평가 e2e run plan + 수집 Activity[] + 평가 결과
// EvaluationResult[] → pre-실행 step-args({evaluation, publish}) 단일 진입 aggregator
// 순수 컴포저 (T-0601 박제).
//
// 책임:
//   - PLAN.md 109행(🟢 실 평가 e2e, P5) 의 build-time 순수 layer 는 step-level run-plan
//     연결 컴포저로, 단일 검증 `runPlan`(T-0597 `buildRealDataE2eRunPlan` →
//     `RealDataE2eRunPlan = { pipeline, run }`)에서 modelId·run 을 thread 하는 layer 를
//     완성했다 — T-0598 `buildRealDataEvaluationStepArgs(runPlan, activities)`(평가 step 에
//     `runPlan.pipeline.modelId` thread), T-0599 `buildRealDataResultPublishStepArgs(
//     runPlan, results)`(step④ pre-실행 publish plan 에 `runPlan.run` thread).
//   - 그러나 이 step-level 컴포저들은 **각각 따로 호출**된다 — live runner 가
//     `buildRealDataEvaluationStepArgs(runPlan, ...)` 와 `buildRealDataResultPublishStepArgs(
//     runPlan, ...)` 를 별개 호출하면서 같은 `runPlan` 을 두 번 수동 전달해야 한다(같은
//     검증 객체임을 build-time 에서 강제하지 못함 — 두 step 에 서로 다른 runPlan 을 넘기는
//     사고 표면). pre-실행 e2e 경로(평가 step-args + publish step-args)를 **단일 검증
//     `runPlan` 하나에서** 합성하는 최상위 진입점이 비어 있었다.
//   - 본 aggregator 는 그 gap 을 단일 순수 함수 `buildRealDataE2eStepArgs(runPlan,
//     activities, results)` → `{ evaluation, publish }` 로 묶어, **하나의 검증된 `runPlan`
//     을** 평가 step(T-0598)과 publish step(T-0599) 양쪽에 동시 thread 한다. caller 가 단일
//     호출로 pre-실행 e2e step-arg 전체(평가 modelId 일관 + publish run 일관)를 한 번에
//     조립하며, modelId·run 두 정책이 같은 검증 source 에서 나옴을 구조적으로 보장한다
//     (runPlan 재전달 0). T-0597(검증) → 본 aggregator(pre-실행 step-args) 로 build-time
//     순수 surface 가 한 단계 더 줄어든다. 스트림 전반의 "분리된 순수 link 들을 단일 plan
//     컴포저로 묶는" 박제(T-0591/T-0595/T-0597/T-0598/T-0599)와 동형이다.
//
// 🔥 단일 runPlan source thread (재전달 0 — modelId·run 동시 일관 구조적 보장):
//   - `runPlan` 이 한 번만 인자로 들어오고 두 위임(평가 step / publish step)에 그대로
//     전달된다. 본 aggregator 는 modelId / run 을 직접 추출하지 않고 두 step-level 위임에
//     runPlan 을 통째로 넘긴다 — caller 가 평가 step 과 publish step 에 서로 다른 runPlan 을
//     넘길 수 없음을 시그니처로 강제한다(runPlan 재전달 0). 따라서 평가측 modelId
//     (runPlan.pipeline.modelId)와 publish측 run(runPlan.run)이 항상 같은 검증 source 에서
//     나온다.
//
// 🔥 위임 helper 재사용 (재구현 0, SSOT 보존):
//   - modelId 추출·평가 plan 합성은 T-0598(`buildRealDataEvaluationStepArgs`) 가, run
//     추출·publish plan 합성은 T-0599(`buildRealDataResultPublishStepArgs`) 가 담당한다.
//     본 aggregator 는 modelId/run 추출·평가 plan 합성·publish plan 합성·guard 를
//     재구현하지 않고 두 위임 호출 결과를 `{ evaluation, publish }` 로 묶어 반환만 한다
//     (중복 0).
//
// 🔥 위임 throw 그대로 전파 (자체 try/catch 0):
//   - `runPlan.pipeline.modelId` 빈/공백 → 평가측 위임(T-0598 → 하위 T-0579) modelId
//     guard throw, `runPlan.run.gitSha` / `runPlan.run.dateToken` 빈/공백 → publish측
//     위임(T-0599 → 하위 빌더) run guard throw 를 자체 try/catch 없이 그대로 위로
//     흘려보낸다(조용한 통과 차단). 본 aggregator 는 추가 guard 를 재구현하지 않는다.
//     (정상 경로의 `runPlan` 은 `buildRealDataE2eRunPlan` 이 이미 modelId·run 을 검증하므로
//     빈 값을 갖지 않는다 — 이 전파는 위임 guard 가 방어선으로 살아있음을 보장하는 마지막
//     그물이다.)
//
// 🔥 결정론·무공유 (R-59 정합):
//   - 입력 외 상태(시각·난수·env) 의존 0. 동일 (runPlan, activities, results) 두 번 호출 →
//     deep-equal 결과. 입력 `runPlan`·`activities`·`results` 배열·원소 mutate 0 — 두 위임
//     helper 가 이미 매 호출 새 plan 객체를 반환하므로 본 aggregator 도 매 호출 새 컨테이너
//     객체(+ 새 evaluation / publish 트리)를 반환한다(공유 mutable 노출 0).
//
// 🔥 R-59 정합 (raw 활동 본문 구조적 미포함):
//   - 산출 `evaluation`(RealDataEvaluationPlan) / `publish`(RealDataResultIssuePublishPlan)
//     는 두 위임 helper 의 산출을 그대로 통과시킨다 — 두 산출 모두 raw 활동 본문(commit
//     message 전문 / diff / page 본문 등)을 구조적으로 미보유하므로(T-0598/T-0599 박제) 본
//     aggregator 도 미보유다.
//
// 🔥 type 재사용 (중복 정의 0 — 신규 도메인 type 0):
//   - `RealDataE2eRunPlan` / `Activity` / `EvaluationResult` / `RealDataEvaluationPlan` /
//     `RealDataResultIssuePublishPlan` 는 전부 `import type` 재사용한다. 반환 컨테이너
//     `RealDataE2eStepArgs` 는 두 위임 type 의 조합(`{ evaluation, publish }`)인 컨테이너
//     1 개뿐(SSOT) — 신규 도메인 type 0.
//
// Out of Scope (task T-0601):
//   - 실 github.com 네트워크 fetch / 실 활동 수집(step ② live, LAN/credential gate — ADR-0045).
//   - 실 `EvaluationScoringService.scoreUnit` / 실 LLM round-trip / Ollama(step ③ live).
//   - 실 gh 호출 / `execFile('gh', argv)` / 실 이슈 search·create·edit(step ④ live wiring).
//   - post-실행 outcome step-args 합성(`buildRealDataResultOutcomeStepArgs`, T-0600 — 실 gh
//     stdout 의존이라 본 pre-실행 aggregator 와 분리. runner 가 실행 후 별도 호출).
//   - modelId/run 추출 · 평가 plan 합성 · publish plan 합성 · guard 재구현 — 전부 T-0598 /
//     T-0599 위임 안에서 처리(중복 0).
//   - `runPlan`·`activities`·`results` 의 실 산출(실 seed/run 도출·실 수집·실 LLM — 인자로만 받음).
//   - 외부 라이브러리(zod / execa 등) 도입 — 새 dependency 0, 내장 위임 합성만.
//   - production `src/` 코드 변경 — test helper 단독(타입·위임 함수 import 재사용만).
import type { Activity } from "../../src/assessment-collection/domain/activity";
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";

import type { RealDataEvaluationPlan } from "./realdata-e2e-evaluation-plan";
import { buildRealDataEvaluationStepArgs } from "./realdata-e2e-evaluation-step-args";
import type { RealDataResultIssuePublishPlan } from "./realdata-e2e-result-issue-publish-plan";
import { buildRealDataResultPublishStepArgs } from "./realdata-e2e-result-publish-step-args";
import type { RealDataE2eRunPlan } from "./realdata-e2e-run-plan";
import { assertRealDataE2eStepArgsConsistentWithSources } from "./realdata-e2e-step-args-consistency";

// RealDataE2eStepArgs — pre-실행 e2e step-args aggregator 의 출력. live runner 가 단일
// 검증 `runPlan` + 수집 `activities` + 평가 `results` 를 한 번에 넘기면 받게 되는
// "평가 step-args + publish step-args" 한 묶음.
//   - evaluation: 평가 step-args(scoreUnit 호출-args plan, T-0598 산출 → 하위 T-0591).
//     `runPlan.pipeline.modelId` 가 thread 된 평가 호출-args.
//   - publish: step④ pre-실행 publish step-args(report + commandArgs + searchArgv,
//     T-0599 산출 → 하위 T-0595). `runPlan.run` 이 thread 된 결과 이슈 publish plan.
//
// 두 필드 모두 단일 검증 `runPlan` 에서 thread 되므로 평가측 modelId 와 publish측 run 이
// 같은 검증 source 에서 나옴이 구조적으로 보장된다(재전달 0). 신규 도메인 type 0 —
// 컨테이너 1 개뿐(두 위임 type 조합).
export interface RealDataE2eStepArgs {
  evaluation: RealDataEvaluationPlan;
  publish: RealDataResultIssuePublishPlan;
}

// buildRealDataE2eStepArgs — 검증된 e2e run plan `runPlan` + 수집 산출 `Activity[]` +
// 평가 결과 `EvaluationResult[]` 를 입력 받아 pre-실행 e2e step-args({ evaluation,
// publish }) 를 산출하는 **순수 aggregator 컴포저**(평가 step + publish step 의 단일
// 진입점).
//
// 합성(2 위임, 단일 runPlan source thread, 재구현 0):
//   (1) buildRealDataEvaluationStepArgs(runPlan, activities) → evaluation(T-0598 위임 —
//       runPlan.pipeline.modelId 를 평가 plan 으로 thread. modelId 빈/공백 guard throw
//       자체 try/catch 없이 전파).
//   (2) buildRealDataResultPublishStepArgs(runPlan, results) → publish(T-0599 위임 —
//       runPlan.run 을 publish plan 으로 thread. run.gitSha/dateToken 빈/공백 guard
//       throw 자체 try/catch 없이 전파).
//
// 단일 runPlan source: `runPlan` 을 한 번만 받아 두 위임에 그대로 넘기므로 caller 가
// 평가 step 과 publish step 에 서로 다른 runPlan(divergent modelId / run)을 넘길 수
// 없다(재전달 0 — modelId·run 동시 일관 구조적 보장).
//
// 분기(본 aggregator 자체의 추가 분기 0 — 전부 위임 helper 가 담당):
//   - 빈 `activities` → 평가 위임이 `{inputs: [], callArgs: []}` 반환(throw 0).
//   - 빈 `results` → publish 위임이 count 0·전 슬롯 0 plan 반환(throw 0).
//   - 단일 / 다수 activities·results → 위임 helper 가 집계(추가 분기 0).
//   - runPlan.pipeline.modelId 빈/공백 → (1) 평가 위임 guard throw 전파(publish 위임 미도달).
//   - runPlan.run.gitSha / dateToken 빈/공백 → (2) publish 위임 guard throw 전파.
//
// 합성 순서: 평가 위임((1))이 publish 위임((2))보다 먼저 평가된다. 따라서 modelId 미결정은
// run 유효 여부와 무관하게 먼저 차단된다(빈/공백 modelId 면 (1) 에서 throw 되어 (2) 미도달).
//
// 순수성·무공유:
//   - 입력 `runPlan`(읽기만 — 두 위임에 전달, mutate 0) / `activities`(읽기만, mutate 0) /
//     `results`(읽기만, mutate 0). 두 위임 helper 가 매 호출 새 plan 객체를 반환하므로 본
//     aggregator 도 매 호출 새 컨테이너 객체(+ 새 evaluation / publish 트리)를 반환 —
//     출력이 입력 / 다음 호출 결과와 무공유. 결정론(입력만의 함수).
export function buildRealDataE2eStepArgs(
  runPlan: RealDataE2eRunPlan,
  activities: Activity[],
  results: EvaluationResult[],
): RealDataE2eStepArgs {
  // (1) runPlan + activities → 평가 step-args(T-0598 위임). runPlan.pipeline.modelId 가
  // 평가 plan 으로 thread 되고, 빈/공백 modelId guard throw 는 자체 try/catch 없이 그대로
  // 전파된다(publish 위임 미도달). 매 호출 새 evaluation 트리 반환.
  const evaluation = buildRealDataEvaluationStepArgs(runPlan, activities);

  // (2) runPlan + results → publish step-args(T-0599 위임). 동일 runPlan 의 run 이
  // publish plan 으로 thread 되고, 빈/공백 gitSha/dateToken guard throw 는 자체 try/catch
  // 없이 그대로 전파된다. 매 호출 새 publish 트리 반환.
  const publish = buildRealDataResultPublishStepArgs(runPlan, results);

  // 새 컨테이너 객체 — evaluation / publish 는 위임 helper 가 이미 무공유로 반환하므로
  // 입력 보존·무공유. 단일 runPlan 이 두 step 에 동시 thread 됨(modelId·run 일관).
  const stepArgs: RealDataE2eStepArgs = { evaluation, publish };

  // 산출 컨테이너 반환 직전 self-assert(T-0672 self-wire) — aggregator 가 두 sub-composer
  // (평가 step / publish step)에 같은 runPlan 을 thread·합성하는 과정에서 run/runPlan 인자
  // 위치를 뒤바꾸거나 한쪽 산출(evaluation 또는 publish)을 변형/누락하는 합성 회귀를
  // single-source 재유도(두 sub-composer 를 같은 인자 순서로 직접 재호출)와의 byte-identical
  // 정합 검증으로 호출 시점에 fail-fast 차단한다. 정상 합성이면 가드는 void → 반환 컨테이너
  // byte-identical·무공유 보존(관측 불가능하게 동일). 가드는 read-only 라 stepArgs/runPlan/
  // activities/results mutate 0.
  assertRealDataE2eStepArgsConsistentWithSources(
    stepArgs,
    runPlan,
    activities,
    results,
  );

  return stepArgs;
}
