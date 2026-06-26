// realdata-e2e-run-plan.ts — 실 평가 e2e seeds + modelId + run → 단일 진입 run plan
// 순수 컴포저 (T-0597 박제).
//
// 책임:
//   - PLAN.md 109행(🟢 실 평가 e2e, P5) 의 build-time 순수 layer 는 단계별 단일 진입
//     컴포저로 닫혀 있다 — seed-side `buildRealDataPipelinePlan(seeds, modelId)`
//     (T-0592) → `{collectCallArgs, modelId}`, 결과 박제 측
//     `buildRealDataResultIssuePublishPlan(results, run)`(T-0595) 등. 그러나 step ④
//     결과 이슈 박제에 필요한 **run 식별자(`RealDataResultIssueRunRef` = gitSha +
//     dateToken)** 는 seed-side 진입 plan 과 분리돼 있어, live runner 가 e2e 시작
//     시점에 seed/modelId 와 run 식별자를 **각각 따로** 검증해야 했다.
//   - 본 컴포저는 그 둘을 최외곽 단일 진입점 `buildRealDataE2eRunPlan(seeds, modelId,
//     run)` → `{pipeline, run}` 으로 묶어, runner 가 어떤 live 부수효과(실 수집·실
//     LLM·실 gh)보다 **먼저** seed·modelId·run 을 한 번에 fail-fast 검증하고 seed-side
//     plan + 검증된 run ref 를 받게 한다. T-0592/T-0595 와 동형의 "분리된 순수 link
//     들을 단일 plan 컴포저로 묶는" 박제다.
//
// 🔥 위임 helper 재사용 (재구현 0, SSOT 보존):
//   - collect 호출-args 매핑 + modelId guard 는 T-0592(`buildRealDataPipelinePlan`)
//     에 위임한다. 본 컴포저는 collect 매핑 / modelId guard 로직을 재구현하지 않고
//     위임 호출만 엮는다(중복 0).
//
// 🔥 위임 throw 그대로 전파 (자체 try/catch 0):
//   - modelId 빈/공백 → 위임 `buildRealDataPipelinePlan` 의 modelId guard throw,
//     externalId 빈/공백 seed → 하위 `buildRealDataCollectInput` throw 를 자체
//     try/catch 없이 그대로 위로 흘려보낸다. run.gitSha / run.dateToken 빈/공백 guard
//     는 본 컴포저가 직접 검사해 명시적 throw 한다(T-0582 descriptor 측 `assertNonBlank`
//     동형 — 비식별 run 차단, 조용한 통과 금지).
//
// 🔥 guard 순서 (pipeline 위임 먼저 → run guard 나중):
//   - pipeline 측 guard(modelId / externalId)를 run guard 보다 **먼저** 평가한다.
//     seed-side 입력이 미결정(modelId 빈/공백·잘못된 seed)이면 run 식별자만 유효해도
//     e2e 를 시작할 의미가 없으므로 가장 먼저 차단한다. 빈 seeds + 유효 modelId + 유효
//     run 경계는 pipeline 이 `collectCallArgs: []` 를 산출하고 run 은 보존된다(throw 0).
//
// 🔥 결정론·무공유 (R-59 정합):
//   - 입력 외 상태(시각·난수·env) 의존 0. 동일 (seeds, modelId, run) 두 번 호출 →
//     deep-equal 결과. 입력 `seeds` 배열·원소 / `run` 객체 mutate 0 — 위임 helper 가
//     이미 매 호출 새 pipeline 객체(+ 새 collectCallArgs 배열)를 반환하고, 본 컴포저는
//     run 도 검증 후 **새 객체로 복사**해 보존하므로 매 호출 새 plan 객체(+ 새
//     pipeline / run 트리)를 반환한다(공유 mutable 노출 0).
//
// 🔥 R-59 정합 (raw 활동 본문 구조적 미포함):
//   - plan 은 seed-side pipeline plan(collect 호출-args + modelId)과 run 식별자(gitSha
//     + dateToken)만 보유한다. collectCallArgs 는 service / externalId 식별자 + since /
//     assessmentId 만, modelId 는 모델 식별 문자열, run 은 식별 토큰일 뿐이라
//     commit/PR/issue 본문 등 raw 외부 활동 데이터는 구조적으로 포함될 수 없다.
//
// 🔥 type 재사용 (중복 정의 0):
//   - `RealDataSeedDescriptor` / `RealDataPipelinePlan` / `RealDataResultIssueRunRef`
//     는 전부 import type 재사용한다. 신규 type 정의는 `RealDataE2eRunPlan` 컨테이너
//     1 개뿐(SSOT).
//
// Out of Scope (task T-0597):
//   - 실 github.com 네트워크 fetch / 실 활동 수집(step ② live, LAN/credential gate — ADR-0045).
//   - 실 `EvaluationScoringService.scoreUnit` / 실 LLM round-trip / Ollama(step ③ live).
//   - 실 gh 호출 / `execFile('gh', argv)` / 실 이슈 search·create·edit(step ④ live wiring).
//   - `Activity[]` → evaluate plan 합성(`buildRealDataEvaluationPlan` 은 실 수집 산출
//     `Activity[]` 필요 — 본 컴포저는 seed-side 진입 plan + run 식별만 묶음, evaluate 미포함).
//   - 실 run 식별자 도출(실 gitSha / 실 timestamp / `latest-result.json` 읽기 — 인자로만 받음).
//   - collect 호출-args 매핑 / modelId guard 로직 재구현 — 전부 T-0592 위임 안에서 처리.
//   - 외부 라이브러리(zod / execa 등) 도입 — 새 dependency 0, 내장 위임 합성만.
//   - production `src/` 코드 변경 — test helper 단독(타입·위임 함수 import 재사용만).
import { buildRealDataPipelinePlan } from "./realdata-e2e-pipeline-plan";
import type { RealDataPipelinePlan } from "./realdata-e2e-pipeline-plan";
import type { RealDataResultIssueRunRef } from "./realdata-e2e-result-issue-descriptor";
import { assertRealDataE2eRunPlanConsistentWithSources } from "./realdata-e2e-run-plan-consistency";
import type { RealDataSeedDescriptor } from "./realdata-e2e-seed-fixture";

// RealDataE2eRunPlan — 실 평가 e2e 최외곽 진입 plan. live runner 가 (seeds, modelId,
// run) 을 한 번에 넘기면 받게 되는 "검증된 seed-side 진입 plan + run 식별자" 묶음.
//   - pipeline: seed-side 진입 plan({collectCallArgs, modelId}, T-0592 산출). 수집→평가
//     단계 입력.
//   - run: step ④ 결과 이슈 박제에 쓸 검증된 run 식별자(gitSha + dateToken).
//
// R-59: 두 필드 모두 식별자 / 모델 / run 토큰 문자열만 보유 — raw 활동 본문 구조적 미포함.
export interface RealDataE2eRunPlan {
  pipeline: RealDataPipelinePlan;
  run: RealDataResultIssueRunRef;
}

// 빈/공백-only run 식별자 guard — 비식별 run(잘못된 결과 이슈 박제)을 방지하기 위해
// gitSha / dateToken 이 빈 문자열·공백-only 면 명시적 throw 한다(T-0582 descriptor 측
// `assertNonBlank` 동형 — 조용한 통과 차단, 메시지 어휘 일관).
function assertRunRefNonBlank(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new Error(
      `RealDataResultIssueRunRef.${fieldName} 가 비어있습니다 — 비식별 run 식별자로 e2e run plan 을 만들 수 없습니다.`,
    );
  }
}

// buildRealDataE2eRunPlan — seed descriptor 배열 + 평가 정책 `modelId` + run 식별자
// `run` 을 입력 받아 e2e run plan({ pipeline, run }) 을 산출하는 **순수 컴포저**(실 평가
// e2e build-time chain 의 최외곽 단일 진입점).
//
// 합성:
//   (1) buildRealDataPipelinePlan(seeds, modelId) → pipeline(T-0592 위임 — collect
//       매핑 + modelId guard. modelId 빈/공백 throw, externalId 빈/공백 seed 의 하위
//       throw 모두 자체 try/catch 없이 전파).
//   (2) run guard(gitSha / dateToken 빈/공백 throw — assertRunRefNonBlank, 필드별 분기)
//       후 검증 통과한 run 을 **새 객체로 복사**해 plan 에 보존(입력 run 과 무공유).
//
// 분기:
//   - 빈 `seeds` 배열 + 유효 modelId + 유효 run → `{ pipeline: {collectCallArgs: [],
//     modelId}, run }`(throw 0).
//   - 단일 / 다수 seed → 위임 pipeline 이 1:1 매핑(추가 분기 0).
//   - modelId 빈/공백 → 위임 pipeline guard throw 전파(run guard 미도달).
//   - externalId 빈/공백 seed → 하위 collect 매퍼 throw 전파(run guard 미도달).
//   - run.gitSha / dateToken 빈/공백 → 본 컴포저 run guard 가 명시적 throw.
//
// guard 순서: pipeline 위임((1))이 run guard((2))보다 먼저 평가된다. 따라서 modelId /
// seed 미결정은 run 유효 여부와 무관하게 가장 먼저 차단되고, 빈 seeds + 빈 modelId +
// 유효 run 경계에서도 pipeline 측 modelId guard 가 우선 throw 한다.
//
// 순수성·무공유:
//   - 입력 `seeds`(읽기만, mutate 0) / `run`(읽기만, mutate 0). 위임 pipeline 이 매
//     호출 새 객체(+ 새 collectCallArgs 배열)를 반환하고, run 은 검증 후 새 객체로
//     복사하므로 본 컴포저도 매 호출 새 plan 객체(+ 새 pipeline / run 트리)를 반환 —
//     출력이 입력 / 다음 호출 결과와 무공유. 결정론(입력만의 함수).
export function buildRealDataE2eRunPlan(
  seeds: RealDataSeedDescriptor[],
  modelId: string,
  run: RealDataResultIssueRunRef,
): RealDataE2eRunPlan {
  // (1) seeds + modelId → seed-side 진입 plan(T-0592 위임). modelId 빈/공백 guard 및
  // externalId 빈/공백 seed 의 하위 throw 가 자체 try/catch 없이 그대로 전파된다(run
  // guard 미도달). 매 호출 새 pipeline 트리 반환.
  const pipeline = buildRealDataPipelinePlan(seeds, modelId);

  // (2) run guard — 필드별·빈/공백별 분기마다 명시적 throw(비식별 run 차단). pipeline
  // 합성 이후 평가되므로 modelId / seed guard 가 run guard 보다 먼저 동작한다.
  assertRunRefNonBlank(run.gitSha, "gitSha");
  assertRunRefNonBlank(run.dateToken, "dateToken");

  // 검증 통과한 run 을 새 객체로 복사해 보존(입력 run 객체와 무공유 — 출력 mutate 가
  // 입력에 누설되지 않는다). 새 plan 객체 산출.
  const runPlan: RealDataE2eRunPlan = {
    pipeline,
    run: { gitSha: run.gitSha, dateToken: run.dateToken },
  };

  // 산출 plan 반환 직전 self-assert(T-0678 self-wire) — 최외곽 컴포저가 seed-side pipeline
  // 위임 + run 복사로 `{ pipeline, run }` 을 합성하는 과정에서 seeds/modelId 인자 위치를
  // 뒤바꾸거나 한쪽 산출(pipeline 또는 run)을 변형/누락하는 합성 회귀를 single-source
  // 재유도(pipeline 측 위임 직접 재호출 + run 직접 대조)와의 byte-identical 정합 검증으로
  // 호출 시점에 fail-fast 차단한다. 정상 합성이면 가드는 void → 반환 plan byte-identical·
  // 무공유 보존(관측 불가능하게 동일). 가드는 read-only 라 runPlan/seeds/run mutate 0.
  assertRealDataE2eRunPlanConsistentWithSources(runPlan, seeds, modelId, run);

  return runPlan;
}
