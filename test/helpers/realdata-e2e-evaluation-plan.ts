// realdata-e2e-evaluation-plan.ts — 실 평가 e2e 수집 Activity[] + modelId →
// scoreUnit 호출-args plan({inputs, callArgs}) 종단 순수 컴포저 (T-0591 박제).
//
// 책임:
//   - PLAN 109행(🟢 실 평가 e2e) 의 step ②(수집) → step ③(평가) 경계 build-time chain 은
//     현재 두 개의 분리된 순수 helper 로 끊겨 있다 — `buildRealDataEvaluationInputs(activities)`
//     (T-0578, Activity[] → EvaluationInput[]) 와 `buildRealDataScoringCallArgs(inputs, modelId)`
//     (T-0579, EvaluationInput[] → `{ input, options: { modelId } }[]`). step ③ live runner 가
//     `Activity[]` + `modelId` 만 들고 와 scoreUnit 호출-args 까지 한 번에 도출하려면 두 helper 를
//     **수동으로 순서 조립**해야 한다.
//   - 본 컴포저는 그 2 단계를 단일 순수 함수로 합성해 step ②→③ 경계의 build-time round-trip 을
//     닫는다(step ④ 의 `resolveRealDataResultIssueGhCommandPlan`(T-0588) 종단 컴포저 패턴과
//     동형 — 분리된 순수 link 들을 단일 plan 컴포저로 묶는 동일 박제). 산출 plan 은 중간 산출
//     `inputs`(scoreUnit 첫 인자 배열)와 종단 산출 `callArgs`(scoreUnit 2-인자 호출-args 묶음)를
//     함께 담아, caller 가 두 단계 결과를 모두 build-time 에 검증/로깅할 수 있게 한다.
//
// 🔥 위임 helper 재사용 (재구현 0, SSOT 보존):
//   - contributionKind 정규화 · unitId 합성 · raw 미보유 매핑은 T-0578(production 매퍼 재사용),
//     modelId guard · options 페어링은 T-0579 가 담당한다. 본 컴포저는 그 둘을 순서대로 호출만
//     하고 매핑/페어링/guard 로직을 재구현하지 않는다(중복 0).
//
// 🔥 위임 throw 그대로 전파 (자체 try/catch 0):
//   - `buildRealDataScoringCallArgs` 의 modelId 빈/공백 guard throw 를 try/catch 없이 그대로
//     위로 흘려보낸다(조용한 통과 차단). 본 컴포저는 추가 guard 를 재구현하지 않는다.
//
// 🔥 결정론·무공유 (R-59 / REQ-032 정합):
//   - 입력 외 상태(시각·난수·env) 의존 0. 동일 (activities, modelId) 두 번 호출 → deep-equal
//     결과. 입력 `activities` 배열·원소 mutate 0 — 위임 helper 들이 이미 무공유라 본 컴포저도 매
//     호출 새 plan 객체(+ 새 inputs/callArgs 배열) 를 반환한다(공유 mutable 노출 0).
//
// 🔥 type 재사용 (중복 정의 0):
//   - `Activity` / `EvaluationInput` / `RealDataScoringCallArgs` 는 전부 import type 재사용한다.
//     신규 type 정의는 `RealDataEvaluationPlan` 컨테이너 1 개뿐(SSOT).
//
// Out of Scope (task T-0591):
//   - 실 github.com 네트워크 fetch / 실 활동 수집(step ② live, LAN/credential gate — ADR-0045).
//   - 실 `EvaluationScoringService.scoreUnit` 호출 / 실 LLM round-trip / Ollama(step ③ live).
//   - 실 `LlmProviderConfigResolver` 호출 / DB lookup / modelId 실 결정(ADR-0048 — 인자로만 받음).
//   - 난이도별 model routing(R-97 deferred).
//   - production `src/` 코드 변경 — test helper 단독.
import type { Activity } from "../../src/assessment-collection/domain/activity";
import type { EvaluationInput } from "../../src/assessment-evaluation/domain/evaluation-input";

import { buildRealDataEvaluationInputs } from "./realdata-e2e-evaluation-inputs";
import { assertRealDataEvaluationPlanConsistentWithSources } from "./realdata-e2e-evaluation-plan-consistency";
import type { RealDataScoringCallArgs } from "./realdata-e2e-scoring-call-args";
import { buildRealDataScoringCallArgs } from "./realdata-e2e-scoring-call-args";

// RealDataEvaluationPlan — 종단 컴포저의 출력. step ②→③ 경계의 두 산출을 함께 담는다.
//   - inputs: 중간 산출 EvaluationInput[](scoreUnit 첫 인자 배열, T-0578 산출).
//   - callArgs: 종단 산출 RealDataScoringCallArgs[](scoreUnit 2-인자 호출-args 묶음, T-0579 산출).
// 두 배열은 순서·길이가 동일하며 `callArgs[i].input === inputs[i]`(reference 동일) 가 보장된다.
export interface RealDataEvaluationPlan {
  inputs: EvaluationInput[];
  callArgs: RealDataScoringCallArgs[];
}

// buildRealDataEvaluationPlan — 수집 산출 `Activity[]` + 평가 정책 `modelId` 를 입력 받아
// scoreUnit 호출-args plan({inputs, callArgs}) 을 산출하는 **종단 순수 컴포저**.
//
// 합성 순서(2 단계 위임):
//   (1) buildRealDataEvaluationInputs(activities) → EvaluationInput[](T-0578, 매핑 위임).
//   (2) buildRealDataScoringCallArgs(inputs, modelId) → RealDataScoringCallArgs[]
//       (T-0579, modelId guard + options 페어링 위임).
//
// 분기:
//   - 빈 `activities` 배열 → inputs `[]` → callArgs `[]`(throw 0, modelId 유효 시). 빈 plan 반환.
//   - 단일 / 다수 원소 → 각 원소를 1:1 페어링(추가 분기 0 — 위임 helper 가 담당).
//   - modelId 빈/공백 → (2) 위임 helper guard throw 를 자체 try/catch 없이 그대로 전파.
//
// 순수성·무공유:
//   - 입력 `activities`(읽기만, mutate 0). 위임 helper 들이 매 호출 새 배열을 반환하므로 본
//     컴포저도 매 호출 새 plan 객체(+ 새 inputs/callArgs 배열) 를 반환 — 출력이 입력 / 다음 호출
//     결과와 무공유. 결정론(입력만의 함수). `callArgs[i].input` 은 `inputs[i]` reference 그대로
//     페어링한다(EvaluationInput 복제 0 — 위임 매퍼/빌더 계약 보존).
export function buildRealDataEvaluationPlan(
  activities: Activity[],
  modelId: string,
): RealDataEvaluationPlan {
  // (1) Activity[] → EvaluationInput[](contributionKind 정규화 · unitId 합성 위임, T-0578).
  const inputs = buildRealDataEvaluationInputs(activities);

  // (2) EvaluationInput[] + modelId → 호출-args 묶음(빈/공백 modelId guard throw 그대로 전파, T-0579).
  const callArgs = buildRealDataScoringCallArgs(inputs, modelId);

  // 새 plan 객체(inputs/callArgs 는 위임 helper 가 이미 무공유로 반환) — 입력 보존·무공유.
  const plan: RealDataEvaluationPlan = { inputs, callArgs };

  // 산출 plan 반환 직전 self-assert(T-0682 self-wire) — 종단 컴포저가 두 sub-composer
  // 위임(inputs → callArgs)으로 `{ inputs, callArgs }` 를 합성하는 과정에서 activities/
  // modelId 인자 위치를 뒤바꾸거나 한쪽 산출(inputs 또는 callArgs)을 변형/누락하거나
  // `callArgs[i].input === inputs[i]` reference 페어링을 깨는 합성 회귀를, single-source
  // 재유도(두 sub-composer 위임 직접 재호출 + reference 대조)와의 byte-identical 정합
  // 검증으로 호출 시점에 fail-fast 차단한다. 정상 합성이면 가드는 void → 반환 plan
  // byte-identical·무공유 보존(관측 불가능하게 동일). 가드는 read-only 라 plan/activities
  // mutate 0. modelId 빈/공백은 위 (2) callArgs 위임 단계에서 이미 throw 되므로 가드 미도달.
  assertRealDataEvaluationPlanConsistentWithSources(plan, activities, modelId);

  return plan;
}
