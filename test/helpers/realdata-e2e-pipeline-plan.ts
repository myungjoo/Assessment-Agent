// realdata-e2e-pipeline-plan.ts — 실 평가 e2e seed → collect 호출-args + 평가
// modelId 정책 묶음 seed-side 진입 plan 순수 컴포저 (T-0592 박제).
//
// 책임:
//   - PLAN 109행(🟢 실 평가 e2e) 의 build-time chain 은 현재 두 갈래의 분리된 순수
//     layer 로 닫혀 있다 — (a) seed-side: `buildRealDataCollectCallArgs(seeds)`
//     (T-0577) 가 seed descriptor → `collectForPerson(person, since, assessmentId)`
//     호출-args 묶음을 산출하고, (b) evaluate-side: `buildRealDataEvaluationPlan(
//     activities, modelId)`(T-0591) 가 수집 산출 `Activity[]` + `modelId` →
//     scoreUnit 호출-args plan 을 산출한다. step ② live runner 가 받아야 하는 것은
//     "어떤 인원을 어떤 modelId 정책으로 수집→평가할지" 한 묶음인데, 그 seed-side
//     진입 plan(= collect 호출-args + 그 뒤 평가에 쓸 modelId 정책)은 아직 단일
//     build-time descriptor 로 묶이지 않았다.
//   - 본 컴포저는 그 seed-side 진입 plan 을 단일 순수 함수
//     `buildRealDataPipelinePlan(seeds, modelId)` 로 박제한다 — step ④ 의 종단
//     컴포저 `resolveRealDataResultIssueGhCommandPlan`(T-0588) / step ②→③ 의
//     `buildRealDataEvaluationPlan`(T-0591) 과 동형의 "분리된 순수 link 들을 단일
//     plan 컴포저로 묶는" 박제다.
//
// 🔥 evaluate-side 실행 미포함 (seed-side 진입 plan 만):
//   - `Activity[]` 는 실 수집(LAN/credential gate, deferred)의 산출이므로 본 컴포저는
//     **evaluate-side 실행을 포함하지 않고** collect 호출-args + 평가 정책 modelId 만
//     묶는다. modelId 는 guard 검증만 하고 plan 에 보존해, live runner 가 수집 후
//     그대로 `buildRealDataEvaluationPlan` 으로 흘려보낼 수 있게 한다.
//
// 🔥 위임 helper 재사용 (재구현 0, SSOT 보존):
//   - collect 호출-args 매핑은 T-0577(`buildRealDataCollectCallArgs`), modelId guard
//     는 T-0579(`buildRealDataScoringCallArgs`) 패턴을 mirror 한다. 본 컴포저는
//     collect 매핑을 위임 호출만 하고 재구현하지 않는다(중복 0).
//
// 🔥 위임 throw 그대로 전파 (자체 try/catch 0):
//   - externalId 빈/공백 seed 의 하위 `buildRealDataCollectInput` throw 는 자체
//     try/catch 없이 그대로 위로 흘려보낸다. modelId 빈/공백 guard 는 본 컴포저가
//     직접 검사해 명시적 throw 한다(조용한 통과 차단,
//     `buildRealDataScoringCallArgs` 패턴 mirror).
//
// 🔥 결정론·무공유 (R-59 정합):
//   - 입력 외 상태(시각·난수·env) 의존 0. 동일 (seeds, modelId) 두 번 호출 →
//     deep-equal 결과. 입력 `seeds` 배열·원소 mutate 0 — 위임 helper 가 이미
//     무공유라 본 컴포저도 매 호출 새 plan 객체(+ 새 collectCallArgs 배열) 를
//     반환한다(공유 mutable 노출 0). modelId 는 string 원시값이라 plan 에 보존돼도
//     공유로 인한 오염이 없다.
//
// 🔥 R-59 정합 (raw 활동 본문 구조적 미포함):
//   - plan 은 collect 호출-args + modelId 만 보유한다. collectCallArgs 는 service /
//     externalId 식별자 + since/assessmentId 만 담는 최소 shape 이고 modelId 는 모델
//     식별 문자열일 뿐이라, commit/PR/issue 본문 등 raw 외부 활동 데이터는 구조적으로
//     포함될 수 없다.
//
// 🔥 type 재사용 (중복 정의 0):
//   - `RealDataCollectCallArgs` / `RealDataSeedDescriptor` 는 import type 재사용한다.
//     신규 type 정의는 `RealDataPipelinePlan` 컨테이너 1 개뿐(SSOT).
//
// Out of Scope (task T-0592):
//   - 실 github.com 네트워크 fetch / 실 활동 수집(step ② live, LAN/credential gate — ADR-0045).
//   - 실 `EvaluationScoringService.scoreUnit` 호출 / 실 LLM round-trip / Ollama(step ③ live).
//   - `Activity[]` → evaluate plan 합성(`buildRealDataEvaluationPlan` 은 수집 산출
//     `Activity[]` 가 필요 — 실 수집 후 단계; 본 컴포저는 seed-side 진입 plan 만).
//   - 실 `LlmProviderConfigResolver` 호출 / DB lookup / modelId 실 결정(ADR-0048 — 인자로만 받음).
//   - `ASSESSMENT_ID_PLACEHOLDER` → 실 assessment.id 치환 runner.
//   - production `src/` 코드 변경 — test helper 단독.
import { assertRealDataPipelinePlanConsistentWithSources } from "./realdata-e2e-pipeline-plan-consistency";
import { buildRealDataCollectCallArgs } from "./realdata-e2e-seed-collect-call-args";
import type { RealDataCollectCallArgs } from "./realdata-e2e-seed-collect-call-args";
import type { RealDataSeedDescriptor } from "./realdata-e2e-seed-fixture";

// RealDataPipelinePlan — seed-side 진입 plan 의 출력. step ② live runner 가 들고 갈
// "어떤 인원을 어떤 modelId 정책으로 수집→평가할지" 한 묶음.
//   - collectCallArgs: collectForPerson 호출-args 묶음(T-0577 산출). 수집 단계 입력.
//   - modelId: 그 뒤 평가 단계에서 buildRealDataEvaluationPlan 으로 흘려보낼 modelId 정책.
//
// R-59: 두 필드 모두 식별자 / 모델 문자열만 보유 — raw 활동 본문 구조적 미포함.
export interface RealDataPipelinePlan {
  collectCallArgs: RealDataCollectCallArgs[];
  modelId: string;
}

// buildRealDataPipelinePlan — seed descriptor 배열 + 평가 정책 `modelId` 를 입력 받아
// seed-side 진입 plan({ collectCallArgs, modelId }) 을 산출하는 **순수 컴포저**.
//
// 합성:
//   (1) buildRealDataCollectCallArgs(seeds) → collectCallArgs(T-0577 위임, collect
//       호출-args 매핑 + externalId 빈/공백 throw 전파).
//   (2) modelId guard(빈/공백 throw — buildRealDataScoringCallArgs 패턴 mirror) 후
//       plan 에 보존.
//
// 분기:
//   - 빈 `seeds` 배열 + 유효 modelId → `{ collectCallArgs: [], modelId }`(throw 0).
//   - 단일 / 다수 seed → 위임 helper 가 1:1 매핑(추가 분기 0).
//   - modelId 빈/공백 → 본 컴포저 guard 가 명시적 throw(조용한 통과 차단).
//   - externalId 빈/공백 seed → 위임 `buildRealDataCollectInput` throw 그대로 전파.
//
// guard 순서: modelId guard 를 collect 위임보다 **먼저** 평가한다. 평가 정책 modelId
// 가 미결정(빈/공백)이면 수집 호출-args 를 만들 의미가 없으므로 가장 먼저 차단한다
// (빈 seeds + 빈 modelId 경계에서도 modelId guard 가 우선 throw).
//
// 순수성·무공유:
//   - 입력 `seeds`(읽기만, mutate 0). 위임 helper 가 매 호출 새 배열을 반환하므로 본
//     컴포저도 매 호출 새 plan 객체(+ 새 collectCallArgs 배열) 를 반환 — 출력이
//     입력 / 다음 호출 결과와 무공유. 결정론(입력만의 함수). modelId 는 string
//     원시값이라 그대로 보존해도 공유 오염이 없다.
export function buildRealDataPipelinePlan(
  seeds: RealDataSeedDescriptor[],
  modelId: string,
): RealDataPipelinePlan {
  // (2-guard) modelId guard — 빈/공백 modelId 는 평가 정책 미결정 상태이므로 조용히
  // 통과시키지 않고 명시적 throw 한다(buildRealDataScoringCallArgs 패턴 mirror).
  // collect 위임보다 먼저 평가해, 빈 seeds 경계에서도 modelId guard 가 우선 동작한다.
  if (modelId.trim() === "") {
    throw new Error(
      "buildRealDataPipelinePlan: modelId 는 빈 문자열 / 공백만일 수 없다",
    );
  }

  // (1) seed descriptor[] → collectForPerson 호출-args 묶음(externalId 빈/공백 throw
  // 그대로 전파, T-0577). 위임 helper 가 매 호출 새 배열을 반환한다.
  const collectCallArgs = buildRealDataCollectCallArgs(seeds);

  // 새 plan 객체(collectCallArgs 는 위임 helper 가 이미 무공유로 반환, modelId 는
  // 원시값) — 입력 보존·무공유.
  const plan = { collectCallArgs, modelId };

  // 산출 plan 반환 직전 self-assert(T-0680 self-wire) — 컴포저가 collect 위임 +
  // modelId 보존으로 `{ collectCallArgs, modelId }` 를 합성하는 과정에서 collect 측
  // 산출(collectCallArgs)을 변형/누락하거나 modelId 를 다른 값으로 바꿔치는 합성 회귀를,
  // single-source 재유도(collect 위임 직접 재호출 + modelId 직접 대조)와의 byte-identical
  // 정합 검증으로 호출 시점에 fail-fast 차단한다(손상 plan 을 caller 로 반환하기 전 throw).
  // 정상 합성이면 가드는 void → 반환 plan byte-identical·무공유 보존(관측 불가능하게 동일).
  // 가드는 read-only 라 plan/seeds mutate 0.
  assertRealDataPipelinePlanConsistentWithSources(plan, seeds, modelId);

  return plan;
}
