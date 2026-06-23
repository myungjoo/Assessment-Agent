// realdata-e2e-evaluation-step-args.ts — 실 평가 e2e run plan + 수집 Activity[] →
// scoreUnit 호출-args plan({inputs, callArgs}) 순수 컴포저 (T-0598 박제).
//
// 책임:
//   - PLAN 109행(🟢 실 평가 e2e, P5) 의 build-time 순수 layer 는 양 끝이 단일 진입점으로
//     닫혀 있다 — seed-side 진입 `buildRealDataE2eRunPlan`(T-0597), publish-side
//     `buildRealDataResultIssuePublishPlan`(T-0595) / post-실행
//     `buildRealDataResultIssueOutcomeReportFromOutput`(T-0596). 그러나 step ②(수집) →
//     step ③(평가) 경계의 평가 plan 컴포저 `buildRealDataEvaluationPlan(activities,
//     modelId)`(T-0591)는 `modelId` 를 **독립 인자로 다시 받는다** — live runner 가 step ①
//     `buildRealDataE2eRunPlan` 에 넘긴 `modelId`(검증되어 `runPlan.pipeline.modelId` 에
//     보존됨)와 평가 단계에 넘기는 `modelId` 가 build-time 에서 같은 값임을 **보장하지
//     못한다**(두 군데 수동 전달 — 모델 정책 불일치 사고 표면).
//   - 본 컴포저는 그 분리된 두 link 를 단일 순수 함수
//     `buildRealDataEvaluationStepArgs(runPlan, activities)` → `{inputs, callArgs}` 로
//     묶어, **검증된 run plan 의 단일 `modelId` 만을** 평가 plan 으로 thread 한다(modelId
//     재전달 0 → step ① 과 step ③ 의 모델 정책 일관을 구조적으로 보장). 스트림 전반의
//     "분리된 순수 link 들을 단일 plan 컴포저로 묶는" 박제(T-0588/T-0591/T-0592/T-0594/
//     T-0595/T-0597)와 동형이다.
//
// 🔥 modelId 단일 source (재전달 0 — 모델 정책 일관 구조적 보장):
//   - 평가 단계 modelId 는 **`runPlan.pipeline.modelId` 에서만** 도출한다. 본 컴포저는
//     독립 `modelId` 인자를 받지 않으므로 caller 가 step ① 과 step ③ 에 modelId 를 따로
//     두 번 넘길 수 없다 — step ① 에서 검증·보존된 modelId 가 평가 단계로 그대로
//     thread 되어 두 단계 모델 정책이 build-time 에서 항상 동일하다.
//
// 🔥 위임 helper 재사용 (재구현 0, SSOT 보존):
//   - Activity[] → EvaluationInput[] 매핑 · modelId guard · options 페어링은 전부
//     T-0591(`buildRealDataEvaluationPlan`) 에 위임한다. 본 컴포저는 평가 매핑/페어링/
//     guard 로직을 재구현하지 않고 modelId 를 runPlan 에서 추출해 위임 호출만 엮는다
//     (중복 0).
//
// 🔥 위임 throw 그대로 전파 (자체 try/catch 0):
//   - `runPlan.pipeline.modelId` 가 빈/공백 → 위임 `buildRealDataEvaluationPlan` 하위
//     `buildRealDataScoringCallArgs` 의 modelId guard throw 를 자체 try/catch 없이 그대로
//     위로 흘려보낸다(조용한 통과 차단). 본 컴포저는 추가 guard 를 재구현하지 않는다.
//
// 🔥 결정론·무공유 (R-59 정합):
//   - 입력 외 상태(시각·난수·env) 의존 0. 동일 (runPlan, activities) 두 번 호출 →
//     deep-equal 결과. 입력 `runPlan`·`activities` 배열·원소 mutate 0 — 위임 helper 가
//     이미 매 호출 새 plan 객체(+ 새 inputs/callArgs 배열)를 반환하므로 본 컴포저도 매
//     호출 새 plan 객체(공유 mutable 노출 0)를 반환한다. `runPlan.pipeline.modelId` 는
//     string 원시값을 읽기만 하므로 runPlan 은 변형되지 않는다.
//
// 🔥 R-59 정합 (raw 활동 본문 구조적 미포함):
//   - 산출 plan 은 `EvaluationInput[]`(식별자·정규화 입력만) / `RealDataScoringCallArgs[]`
//     (input + modelid options 만) 만 보유하고 raw 활동 본문(commit message 전문 / diff /
//     page 본문 HTML 등)을 구조적으로 보유하지 않는다 — 위임 helper(T-0591/T-0578/T-0579)
//     가 raw 미보유 매핑을 보장하므로 본 컴포저도 미보유다.
//
// 🔥 type 재사용 (중복 정의 0):
//   - `RealDataE2eRunPlan` / `Activity` / `RealDataEvaluationPlan` 는 전부 import type
//     재사용한다. 신규 type 정의 0(컨테이너 type 도 위임 측 `RealDataEvaluationPlan` 재사용).
//
// Out of Scope (task T-0598):
//   - 실 github.com 네트워크 fetch / 실 활동 수집 — `activities: Activity[]` 는 인자로만
//     받음(step ② live, LAN/credential gate — ADR-0045).
//   - 실 `EvaluationScoringService.scoreUnit` 호출 / 실 LLM round-trip / Ollama(step ③ live).
//   - 실 gh 호출 / `execFile('gh', argv)` / 실 이슈 박제(step ④ live wiring).
//   - `Activity[]` → `EvaluationInput[]` 매핑 / modelId guard / options 페어링 재구현 —
//     전부 T-0591(`buildRealDataEvaluationPlan`) 위임 안에서 처리(중복 0).
//   - `runPlan` 의 실 산출(실 seed/run 도출 — `buildRealDataE2eRunPlan` 결과를 인자로만 받음).
//   - 외부 라이브러리(zod / execa 등) 도입 — 새 dependency 0, 내장 위임 합성만.
//   - production `src/` 코드 변경 — test helper 단독(타입·위임 함수 import 재사용만).
import type { Activity } from "../../src/assessment-collection/domain/activity";

import { buildRealDataEvaluationPlan } from "./realdata-e2e-evaluation-plan";
import type { RealDataEvaluationPlan } from "./realdata-e2e-evaluation-plan";
import type { RealDataE2eRunPlan } from "./realdata-e2e-run-plan";

// buildRealDataEvaluationStepArgs — 검증된 e2e run plan `runPlan` + 수집 산출
// `Activity[]` 를 입력 받아 scoreUnit 호출-args plan({inputs, callArgs}) 을 산출하는
// **순수 컴포저**(step ②→③ 경계의 run-plan 연결).
//
// 합성:
//   - `runPlan.pipeline.modelId`(step ① 에서 검증·보존된 단일 modelId)를 추출해
//     `buildRealDataEvaluationPlan(activities, runPlan.pipeline.modelId)` 로 위임한다
//     (평가 매핑·페어링·guard 전부 T-0591 위임 — 재구현 0).
//
// modelId 단일 source: 독립 modelId 인자를 받지 않고 오직 runPlan 에서만 도출하므로
// step ① 과 step ③ 의 모델 정책이 build-time 에서 항상 동일하다(재전달 0).
//
// 분기(본 컴포저 자체의 추가 분기 0 — 전부 위임 helper 가 담당):
//   - 빈 `activities` 배열 + 유효 `runPlan.pipeline.modelId` → `{inputs: [], callArgs: []}`
//     (throw 0). 빈 plan 반환.
//   - 단일 / 다수 `activities` → 위임 helper 가 1:1 페어링.
//   - `runPlan.pipeline.modelId` 빈/공백 → 위임 `buildRealDataEvaluationPlan` 하위 guard
//     throw 를 자체 try/catch 없이 그대로 전파.
//
// 순수성·무공유:
//   - 입력 `runPlan`(읽기만 — modelId 추출, mutate 0) / `activities`(읽기만, mutate 0).
//     위임 helper 가 매 호출 새 plan 객체(+ 새 inputs/callArgs 배열)를 반환하므로 본
//     컴포저도 매 호출 새 plan 객체를 반환 — 출력이 입력 / 다음 호출 결과와 무공유.
//     결정론(입력만의 함수).
export function buildRealDataEvaluationStepArgs(
  runPlan: RealDataE2eRunPlan,
  activities: Activity[],
): RealDataEvaluationPlan {
  // run plan 에서 검증·보존된 단일 modelId 를 추출해 평가 plan 으로 thread. 독립 modelId
  // 인자 미수신 — step ① / step ③ 모델 정책 일관 구조적 보장(재전달 0). 빈/공백 modelId
  // 의 guard throw 는 위임 helper 가 자체 try/catch 없이 그대로 전파한다.
  return buildRealDataEvaluationPlan(activities, runPlan.pipeline.modelId);
}
