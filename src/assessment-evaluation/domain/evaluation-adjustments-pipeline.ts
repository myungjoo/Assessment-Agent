// applyEvaluationAdjustments — P5 평가 후처리(post-scoring adjustment) 5-step
// thread 를 묶는 결정적 순수 domain composer(T-0606). 본 helper 는
// `EvaluationOrchestratorService` 가 inline 으로 묶고 있던 5-step chain(L258~315 —
// abuse → update-count → quality → underperformer → notable → flatten)을
// orchestrator 와 **byte-identical** 한 순서·계약으로 mirror 한다. 추출의 ROI 는
// service mock(LLM scoring) 없이도 5-step thread 순서·필드 직교성·entries↔result
// flatten 계약을 단위로 검증 가능하다는 점이다(scoring service 분리).
//
// 책임 경계(본 task = composer 신설만, Out of Scope):
//   - 본 composer 는 5 위임 helper(`applyAbuseSignalToVolume` /
//     `applyUpdateCountNeutralizationToVolume` / `applyContributionQualityFloor` /
//     `applyUnderPerformerAnnotation` / `applyNotableContributionAnnotation`)를
//     v1 고정 순서로 thread + 마지막 `.map((e) => e.result)` flatten 만 한다.
//     감점 / 중립 / floor / annotation 로직 재구현 0 — 위임만.
//   - orchestrator 가 본 composer 를 호출하도록 배선하는 일은 별도 follow-up
//     (파일 disjoint · 동시성 보존). 본 task 는 composer + colocated spec 신설.
//   - 5 signal detection helper(`evaluation-*-signal.ts` /
//     `evaluation-update-count-neutral.ts`) 변경 0 — 본 composer 는 신호를 인자로만
//     받는다(컴퓨트 0).
//
// v1 고정 순서(orchestrator L262~315 동기, 변경 금지):
//   1. abuse — `applyAbuseSignalToVolume(entries, signals.abuse)` — suspected
//      author 단위의 `volume` 을 결정적으로 감점(R-26/R-40).
//   2. update-count — `applyUpdateCountNeutralizationToVolume(entries, signals.updateCount)`
//      — abuse 감점 산출물을 받아 중립 대상 단위의 `volume` 을 net 0(중립 보존)으로
//      처리(R-41). volume 을 다루는 두 step 을 묶어 둔다.
//   3. quality — `applyContributionQualityFloor(entries, signals.quality)` —
//      zero-contribution 대상 단위의 `contribution` 등급을 `"zero"` 로 floor 강등
//      (R-37/R-38). 위 두 step 의 `volume` 필드와 직교(`contribution` 만 손댐) —
//      적용 순서 무관하지만 v1 순서 고정으로 결정성 + spec 명료성 보장.
//   4. underperformer — `applyUnderPerformerAnnotation(entries, signals.underPerformer)`
//      — 저성과 author 의 **모든** 단위 `narrative` 앞에
//      `UNDERPERFORMER_NARRATIVE_MARKER`(`[저성과자] `) 접두(R-27 / REQ-013).
//      앞 세 step 의 `volume` / `contribution` 필드와 직교(`narrative` 만 손댐) —
//      적용 순서 무관하지만 v1 순서 고정.
//   5. notable — `applyNotableContributionAnnotation(entries, signals.notableContribution)`
//      — 중요기여 author 의 **모든** 단위 `narrative` 앞에
//      `NOTABLE_CONTRIBUTION_NARRATIVE_MARKER`(`[중요기여] `) 접두(R-25 / REQ-011).
//      underperformer 와 같은 `narrative` 필드를 다루지만 marker 접두가 서로 달라
//      (`[저성과자] ` / `[중요기여] `), 임계 분리(평균 × 0.5↓ vs × 1.5↑ — disjoint)
//      로 한 author 가 동시에 둘 다일 수 없다. edge case 로 동시 발생 시 두 marker
//      가 순차 접두된다(spec 박제).
//   6. flatten — `.map((e) => e.result)` 로 entries 형태를 `EvaluationResult[]` 로
//      flatten 해 반환. mid-pipe 5 step 은 entries 형태 그대로 thread.
//
// 필드 직교성(순서 무관 보장):
//   - step 1·2 : `volume` 만 갱신.
//   - step 3   : `contribution` 만 갱신.
//   - step 4·5 : `narrative` 만 갱신.
//   세 필드 그룹이 서로 겹치지 않아 같은 결과면 어떤 순열로 적용해도 산출이 동일
//   하다. 그래도 v1 순서 고정 — 결정성 + spec 명료성 + 동시 marker 접두 순서 박제.
//
// throw 경계(5 위임 helper 와 정합):
//   - `entries` / `signals` / `signals` 의 각 필드(abuse / updateCount / quality /
//     underPerformer / notableContribution) 가 null/undefined 면 한국어 `TypeError`.
//     본 composer 의 entry-level guard 는 5 위임 호출 전에 박제해, 위임 helper 가
//     자기 guard 로 throw 하기 전에 어느 step 이 비었는지를 명시적으로 외화한다.
//   - 위임 helper 가 throw 하는 입력(예: 위임 자체가 추가 guard 검출)에서는 본
//     composer 는 자체 try/catch 없이 그대로 **전파**한다(흡수 0). caller 가
//     5 step 중 어느 helper 가 던졌는지를 그대로 볼 수 있어야 한다(투명성).
//
// 재현 0:
//   - 본 composer 는 5 helper 의 산출 / 알고리즘 / 감점·중립·floor·annotation 공식
//     을 재구현하지 않는다(위임만). 한 helper 의 v1 정책이 바뀌면 본 composer 는
//     변경 없이 그 변화를 그대로 흘려보낸다.

import {
  applyAbuseSignalToVolume,
  type AbuseAdjustEntry,
} from "./evaluation-abuse-adjust";
import type { AbuseSignal } from "./evaluation-abuse-signal";
import { applyNotableContributionAnnotation } from "./evaluation-notable-contribution-adjust";
import type { NotableContributionSignal } from "./evaluation-notable-contribution-signal";
import { applyContributionQualityFloor } from "./evaluation-quality-adjust";
import type { ContributionQualitySignal } from "./evaluation-quality-signal";
import type { EvaluationResult } from "./evaluation-result";
import { applyUnderPerformerAnnotation } from "./evaluation-underperformer-adjust";
import type { UnderPerformerSignal } from "./evaluation-underperformer-signal";
import { applyUpdateCountNeutralizationToVolume } from "./evaluation-update-count-adjust";
import type { UpdateCountNeutralization } from "./evaluation-update-count-neutral";

// EvaluationAdjustEntry — 5 위임 helper 가 공통으로 받는 입력/출력 단위.
// `AbuseAdjustEntry` / `UpdateCountAdjustEntry` / `ContributionQualityAdjustEntry`
// / `UnderPerformerAdjustEntry` / `NotableContributionAdjustEntry` 가 모두 동형
// shape (`{ author: string; result: EvaluationResult }`) 이므로, T-0522 박제
// `AbuseAdjustEntry` 를 single-source 로 re-export 해 5 helper 간 entries 변환 0 을
// 보장한다(타입 재정의 0). caller 는 본 alias 하나만 import 하면 5-step thread
// 입력을 그대로 구성할 수 있다.
export type EvaluationAdjustEntry = AbuseAdjustEntry;

// EvaluationAdjustmentSignals — 5-step thread 의 5 signal 입력 container. 각
// 필드는 해당 detection helper 산출 타입을 그대로 재사용한다(재정의 0). 필드명은
// orchestrator 의 5-step 의도(abuse → updateCount → quality → underPerformer →
// notableContribution)와 정합 — 호출부 가독성을 위해 camelCase 단일 형식.
export interface EvaluationAdjustmentSignals {
  // R-26/R-40 abusing 감점 신호. `computeAbuseSignal` 산출.
  abuse: AbuseSignal;
  // R-41 update 횟수 중립화 신호. `computeUpdateCountNeutralization` 산출.
  updateCount: UpdateCountNeutralization;
  // R-37/R-38 기여 품질 floor 강등 신호. `computeContributionQualitySignal` 산출.
  quality: ContributionQualitySignal;
  // R-27 / REQ-013 저성과자 annotation 신호. `computeUnderPerformerSignal` 산출.
  underPerformer: UnderPerformerSignal;
  // R-25 / REQ-011 중요·어려운 기여 annotation 신호.
  // `computeNotableContributionSignal` 산출.
  notableContribution: NotableContributionSignal;
}

/**
 * P5 평가 후처리 5-step thread 를 묶는 결정적 순수 composer.
 *
 * orchestrator L262~315 와 **byte-identical** 한 순서로 5 위임 helper 를 thread 한
 * 뒤 마지막에 `.map((e) => e.result)` 로 flatten 해 `EvaluationResult[]` 를 반환
 * 한다. 본 composer 는 감점·중립·floor·annotation 로직을 재구현하지 않고 5 helper
 * 에 위임만 한다(투명한 thread).
 *
 * 적용 규칙(결정적 · LLM 무관):
 *   1. abuse — `applyAbuseSignalToVolume(entries, signals.abuse)` — volume 감점.
 *   2. update-count — `applyUpdateCountNeutralizationToVolume(entries', signals.updateCount)`
 *      — volume 중립 보존.
 *   3. quality — `applyContributionQualityFloor(entries'', signals.quality)` —
 *      contribution `"zero"` floor 강등.
 *   4. underperformer — `applyUnderPerformerAnnotation(entries''', signals.underPerformer)`
 *      — narrative 앞에 `[저성과자] ` marker 접두.
 *   5. notable — `applyNotableContributionAnnotation(entries'''', signals.notableContribution)`
 *      — narrative 앞에 `[중요기여] ` marker 접두.
 *   6. flatten — `.map((e) => e.result)` 로 entries 를 `EvaluationResult[]` 로 변환.
 *
 * 방어(throw 0 흡수 정책 — 5 helper 정합):
 *   - 빈 `entries: []` → 빈 배열 `[]` 반환(전 5 위임 무변경 통과 + flatten 0 건).
 *   - 5 signal 모두 "무대상"(예: 빈 `byAuthor`) → entries 의 result 가 무변경
 *     복제만 되어 최종 산출이 entries 의 result 복제와 deep-equal.
 *   - 입력 `entries` / `signals` / `signals` 의 각 필드 / 원소 비변형 — 모든 위임
 *     helper 가 새 배열 + 새 객체만 반환(referential transparency).
 *
 * throw(명시적 계약 위반만):
 *   - `entries` 가 null/undefined → 한국어 `TypeError`.
 *   - `signals` 가 null/undefined → 한국어 `TypeError`.
 *   - `signals.abuse` / `signals.updateCount` / `signals.quality` /
 *     `signals.underPerformer` / `signals.notableContribution` 중 하나라도
 *     null/undefined → 한국어 `TypeError`(어느 signal 이 비었는지 명시).
 *   - 위 guard 통과 후 위임 helper 가 throw 하면 본 composer 는 그대로 전파한다
 *     (try/catch 0). 어느 step 이 던졌는지 caller 가 그대로 볼 수 있어야 한다.
 *
 * 결정성·무공유 보장:
 *   - 동일 입력 2 회 호출 → deep-equal(byte-identical) 산출.
 *   - 입력 `entries`/`signals` mutate 0 — 5 helper 모두 입력 비변형.
 *   - 산출 배열은 5 step 위임의 산출 + flatten 의 누적이라 입력 entries 배열과
 *     not-same-ref(새 배열).
 *
 * @param entries 5-step thread 의 시작 entries(`{ author, result }[]`). 변형 0.
 *                각 원소는 scoring 후 entries 조립(`deduped[i].author` +
 *                `results[i]`) 결과여야 한다(orchestrator L258~261 동기).
 * @param signals 5 detection helper 산출 신호 container. 변형 0.
 * @returns 5-step thread + flatten 산출 `EvaluationResult[]` — 길이·순서는 입력
 *          entries 와 정합(같은 길이·같은 순서).
 */
export function applyEvaluationAdjustments(
  entries: EvaluationAdjustEntry[],
  signals: EvaluationAdjustmentSignals,
): EvaluationResult[] {
  if (entries === null || entries === undefined) {
    throw new TypeError("entries 는 null 또는 undefined 일 수 없습니다.");
  }
  if (signals === null || signals === undefined) {
    throw new TypeError("signals 는 null 또는 undefined 일 수 없습니다.");
  }
  // 5 signal 필드 guard — 어느 step 의 signal 이 비었는지를 명시적으로 외화해
  // 위임 helper 의 일반 throw 보다 caller 디버깅을 쉽게 한다(throw 메시지가 step
  // 이름을 포함).
  if (signals.abuse === null || signals.abuse === undefined) {
    throw new TypeError("signals.abuse 는 null 또는 undefined 일 수 없습니다.");
  }
  if (signals.updateCount === null || signals.updateCount === undefined) {
    throw new TypeError(
      "signals.updateCount 는 null 또는 undefined 일 수 없습니다.",
    );
  }
  if (signals.quality === null || signals.quality === undefined) {
    throw new TypeError(
      "signals.quality 는 null 또는 undefined 일 수 없습니다.",
    );
  }
  if (signals.underPerformer === null || signals.underPerformer === undefined) {
    throw new TypeError(
      "signals.underPerformer 는 null 또는 undefined 일 수 없습니다.",
    );
  }
  if (
    signals.notableContribution === null ||
    signals.notableContribution === undefined
  ) {
    throw new TypeError(
      "signals.notableContribution 은 null 또는 undefined 일 수 없습니다.",
    );
  }

  // (1) abuse 신호 소비 — suspected author 단위의 volume 감점. orchestrator L262.
  const abuseAdjusted = applyAbuseSignalToVolume(entries, signals.abuse);

  // (2) update 횟수 중립화 신호 소비 — abuse 감점 산출물을 받아 중립 대상 단위의
  //     volume 을 net 0(중립 보존). orchestrator L269~272.
  const updateCountAdjusted = applyUpdateCountNeutralizationToVolume(
    abuseAdjusted,
    signals.updateCount,
  );

  // (3) 기여 품질 floor 강등 — zero-contribution 대상 단위의 contribution 등급을
  //     `"zero"` 로 강제. volume 두 step 과 contribution 본 step 은 필드 직교 —
  //     적용 순서 무관하지만 v1 순서 고정. orchestrator L280~283.
  const qualityAdjusted = applyContributionQualityFloor(
    updateCountAdjusted,
    signals.quality,
  );

  // (4) 저성과자 annotation — 저성과 author 의 모든 단위 narrative 앞에
  //     `[저성과자] ` marker 접두. 앞 세 step 의 volume/contribution 필드와
  //     직교(narrative 만 손댐). orchestrator L294~297.
  const underPerformerAnnotated = applyUnderPerformerAnnotation(
    qualityAdjusted,
    signals.underPerformer,
  );

  // (5) 중요·어려운 기여 annotation + (6) flatten — 중요기여 author 의 모든 단위
  //     narrative 앞에 `[중요기여] ` marker 접두 후 `.map((e) => e.result)` 로
  //     entries 를 `EvaluationResult[]` 로 flatten. underperformer 와 같은
  //     narrative 필드를 다루지만 marker 접두가 서로 달라 동시 발생 edge case
  //     에서는 underperformer marker 가 먼저 접두된 narrative 위에 notable
  //     marker 가 다시 접두된다(spec 박제). orchestrator L312~315.
  return applyNotableContributionAnnotation(
    underPerformerAnnotated,
    signals.notableContribution,
  ).map((entry) => entry.result);
}
