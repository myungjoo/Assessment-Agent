// computeEvaluationAdjustmentSignals — P5 평가 detection 5-신호 단일 진입 결정적
// 순수 domain composer(T-0608). 본 helper 는 `EvaluationOrchestratorService`
// (evaluateActivities)가 inline 으로 묶고 있던 5-detection chain(L177~205 — abuse →
// update-count → quality → underperformer → notable)을 orchestrator 와
// **byte-identical** 한 순서·계약으로 mirror 한다. 추출의 ROI 는 service mock(LLM
// scoring) 없이도 5-detection 호출 순서·container 매핑·위임 transparency 를 단위로
// 검증 가능하다는 점이다(scoring service 분리).
//
// post-scoring 대칭 pair: 본 composer 가 산출하는 `EvaluationAdjustmentSignals`
// container 는 T-0606 박제 post-scoring composer `applyEvaluationAdjustments(entries,
// signals)` 의 두 번째 인자(signals) source 다. 즉 detection-side 단일 composer 가
// 산출한 container 를 post-scoring 단일 composer 가 변환 0 으로 그대로 소비한다 —
// orchestrator 의 `evaluateActivities` 본문이 두 composer thread 로 압축되는 대칭쌍.
//
// 결정성·무공유: 본 composer 는 5 위임 helper 가 모두 결정적 순수(LLM 무관, 입력
// 비변형, throw 0 흡수)이므로 그 합성도 결정적 순수다. 동일 입력 2 회 호출 →
// deep-equal(byte-identical) 산출, 입력 `deduped` mutate 0.
//
// 책임 경계(본 task = composer 신설만, Out of Scope):
//   - 본 composer 는 5 detection helper(`computeAbuseSignal` /
//     `computeUpdateCountNeutralization` / `computeContributionQualitySignal` /
//     `computeUnderPerformerSignal` / `computeNotableContributionSignal`)를 v1 고정
//     순서로 호출한 뒤 그 5 산출을 `EvaluationAdjustmentSignals` container 5 필드에
//     동명 매핑만 한다. 신호 산출 로직 재구현 0 — 위임만.
//   - orchestrator 가 본 composer 를 호출하도록 배선하는 일은 별도 follow-up(파일
//     disjoint · 동시성 보존). 본 task 는 composer + colocated spec 신설.
//   - 5 detection helper(`evaluation-*-signal.ts` /
//     `evaluation-update-count-neutral.ts`) 변경 0 — 본 composer 는 호출만 한다.
//   - dedup 자체 수행 0 — 본 composer 는 dedup 후 `EvaluationInput[]` 을 입력으로
//     받기만 한다(dedup 은 호출 전 단계의 책임, orchestrator 의 §4 layer). T-0606
//     post-scoring composer 의 책임 경계 mirror(그쪽은 scoring 자체를 수행하지 않음).
//
// v1 고정 순서(orchestrator L177~205 동기, 변경 금지):
//   1. abuse — `computeAbuseSignal(deduped)` — 반복 기반 부풀리기 감점 신호(R-26/R-40).
//   2. update-count — `computeUpdateCountNeutralization(deduped)` — document update
//      횟수 중립화 신호(R-41).
//   3. quality — `computeContributionQualitySignal(deduped)` — titleLength 휴리스틱
//      기여 품질 floor 강등 신호(R-37/R-38).
//   4. underperformer — `computeUnderPerformerSignal(deduped)` — author 별 code 단위
//      수를 동료 평균 대비 상대 비교한 저성과자 annotation 신호(R-27 / REQ-013).
//   5. notable — `computeNotableContributionSignal(deduped)` — underperformer 의
//      대칭(평균 × 1.5 초과), 중요·어려운 기여 annotation 신호(R-25 / REQ-011).
//   5 detection 은 입력만 공유하고 산출 필드명이 직교(abuse / updateCount / quality /
//   underPerformer / notableContribution — disjoint)라 순서 무관하지만 v1 순서를
//   박제해 호출부 가독성·미래 분기 분석을 단순화한다.

import { computeAbuseSignal } from "./evaluation-abuse-signal";
import type { EvaluationAdjustmentSignals } from "./evaluation-adjustments-pipeline";
import type { EvaluationInput } from "./evaluation-input";
import { computeNotableContributionSignal } from "./evaluation-notable-contribution-signal";
import { computeContributionQualitySignal } from "./evaluation-quality-signal";
import { computeUnderPerformerSignal } from "./evaluation-underperformer-signal";
import { computeUpdateCountNeutralization } from "./evaluation-update-count-neutral";

/**
 * dedup 후 평가 입력 `deduped: EvaluationInput[]` 하나만 받아 5 detection 신호를 v1
 * 고정 순서로 산출한 뒤 post-scoring `applyEvaluationAdjustments` 의 입력 signals
 * container(`EvaluationAdjustmentSignals`)를 반환하는 결정적 순수 composer.
 *
 * 5 detection 의 책임·각 신호의 의미:
 *   - `abuse`(R-26/R-40) : 반복 기반 부풀리기 감점 — suspected author 단위의 volume
 *     을 후속 단계가 감점하도록 하는 신호.
 *   - `updateCount`(R-41) : document update 횟수 중립화 — 같은 문서 반복 update 의
 *     net 부풀림을 후속 단계가 중립 처리하도록 하는 신호.
 *   - `quality`(R-37/R-38) : 기여 품질 floor — zero-contribution 후보 단위의
 *     contribution 등급을 후속 단계가 `"zero"` 로 강등하도록 하는 신호.
 *   - `underPerformer`(R-27 / REQ-013) : 저성과자 annotation — 동료 평균 대비 낮은
 *     author 의 narrative 를 후속 단계가 marker 접두하도록 하는 신호.
 *   - `notableContribution`(R-25 / REQ-011) : 중요·어려운 기여 annotation —
 *     underperformer 의 대칭(평균 초과)으로, 해당 author narrative 를 후속 단계가
 *     marker 접두하도록 하는 신호.
 *
 * 결정성·무공유·입력 비변형:
 *   - 5 위임 helper 모두 결정적 순수(LLM 무관)이므로 본 composer 도 동일 입력 2 회
 *     호출 시 deep-equal(byte-identical) 산출.
 *   - 입력 `deduped` 와 그 원소를 mutate 하지 않는다(5 helper 모두 입력 비변형).
 *   - 산출 container 는 매 호출 새 객체 리터럴이라 입력과 not-same-ref.
 *   - 본 composer 는 dedup 을 수행하지 않는다 — dedup 은 호출 전 단계의 책임
 *     (orchestrator 의 §4 layer). 본 함수는 이미 dedup 된 입력 위에서 detection 만
 *     한다(T-0606 post-scoring composer 의 책임 경계 mirror).
 *
 * throw(명시적 계약 위반만):
 *   - `deduped` 가 null/undefined → 한국어 `TypeError`(메시지에 "deduped" 토큰 포함).
 *   - 위 guard 통과 후 위임 detection helper 가 throw 하면 본 composer 는 자체
 *     try/catch 없이 그대로 **전파**한다(흡수 0). caller 가 5 detection 중 어느
 *     helper 가 던졌는지를 그대로 볼 수 있어야 한다(투명성). 본 composer 는 별도
 *     배열 type check 를 두지 않는다 — 배열 아닌 입력은 위임 helper 의 guard 가
 *     검출해 throw 하며 그 error 가 그대로 전파된다(위임 transparent).
 *
 * @param deduped dedup 후 평가 입력 목록(`EvaluationInput[]`). 변형 0. 5 detection
 *                이 공유하는 단일 입력.
 * @returns 5 detection 산출을 동명 매핑한 `EvaluationAdjustmentSignals` container —
 *          post-scoring `applyEvaluationAdjustments` 의 signals 인자 source.
 */
export function computeEvaluationAdjustmentSignals(
  deduped: EvaluationInput[],
): EvaluationAdjustmentSignals {
  if (deduped === null || deduped === undefined) {
    throw new TypeError("deduped 는 null 또는 undefined 일 수 없습니다.");
  }

  // 5 detection 을 orchestrator L177~205 와 동일 순서로 호출한다. 각 helper 는
  // 결정적 순수(LLM 무관, 입력 비변형, 빈 입력 → 빈 신호)이며, 본 composer 는
  // 산출을 container 5 필드에 동명 매핑할 뿐 어떤 변환도 하지 않는다(투명한 위임).
  return {
    abuse: computeAbuseSignal(deduped),
    updateCount: computeUpdateCountNeutralization(deduped),
    quality: computeContributionQualitySignal(deduped),
    underPerformer: computeUnderPerformerSignal(deduped),
    notableContribution: computeNotableContributionSignal(deduped),
  };
}
