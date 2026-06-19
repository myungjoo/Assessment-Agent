// EvaluationOrchestratorService — P5 평가(scoring) layer 의 상위 compose slice
// (T-0292, ADR-0032 Decision §1 통합 평가 입력 정규화 + §4 평가-side dedup +
// §2 단위 1 건당 scoring). 지금까지 P5 의 dependency-free piece(T-0287 매퍼 /
// T-0288 result+volume / T-0289 dedup 2 종 / T-0290 prompt+classify / T-0291
// scoreUnit)가 전부 MERGED 됐으나, "수집된 `Activity` 목록을 받아 평가 입력으로
// 정규화 → 평가-side dedup / self-follow-up 제외 적용 → 남은 단위마다 scoring →
// 결과 목록 반환" 의 전체 흐름을 묶는 layer 가 0 이었다. 본 service 가 그 빈자리를
// 채우는 thin orchestrator 다 — 새 알고리즘 0, 이미 검증된 매퍼 + dedup 2 종 +
// `scoreUnit` 의 compose + 순서 결정만 담당한다.
//
// 흐름(ADR-0032 §1/§4/§3/§2 compose):
//   1. `activities.map(mapActivityToEvaluationInput)` 로 `Activity[]` → `EvaluationInput[]`
//      정규화(§1). raw 본문 0 — typed surface 만 전사(REQ-032).
//   2. 평가-side dedup 적용(§4) — 아래 박제 순서로 두 순수 함수를 합성.
//   3. dedup 후 입력에 대한 abusing detection — `computeAbuseSignal(deduped)`(R-26/R-40).
//      중복으로 부풀린 신호를 제거한 뒤 measure 하므로 dedup 직후가 자리다(§3 정신).
//   3b. dedup 후 입력에 대한 update 횟수 중립화 detection —
//      `computeUpdateCountNeutralization(deduped)`(R-41). abuse detection 과 동형으로
//      중복 부풀림 제거 후 입력 위에서 document update 횟수(version)를 measure 한다.
//   3c. dedup 후 입력에 대한 기여 품질 분류 detection —
//      `computeContributionQualitySignal(deduped)`(R-37/R-38). abuse / update-count
//      detection 과 동형으로 중복 부풀림 제거 후 입력 위에서 `metadata.titleLength`
//      휴리스틱으로 zero-contribution 후보 단위를 measure 한다.
//   3d. dedup 후 입력에 대한 저성과자 식별 detection —
//      `computeUnderPerformerSignal(deduped)`(R-27 / REQ-013). 앞 세 detection 과
//      동형으로 중복 부풀림 제거 후 입력 위에서 author 별 `contributionKind === "code"`
//      단위 수를 동료 평균 대비 상대 비교(`UNDERPERFORMER_RELATIVE_FLOOR`)로 저성과자
//      author 를 measure 한다. author-level 판정(unitId 목록 0).
//   3e. dedup 후 입력에 대한 중요·어려운 기여 식별 detection —
//      `computeNotableContributionSignal(deduped)`(R-25 / REQ-011). 앞 네 detection 과
//      동형으로 중복 부풀림 제거 후 입력 위에서 author 별 `contributionKind === "code"`
//      단위 수를 동료 평균 대비 상대 비교(`NOTABLE_RELATIVE_CEILING`)로 중요·어려운
//      기여 author 를 measure 한다. underperformer 의 대칭(inverse) — 저성과는 평균 ×
//      0.5 미만, 중요기여는 평균 × 1.5 초과(임계 disjoint). author-level 판정
//      (unitId 목록 0).
//   4. 남은 각 `EvaluationInput` 마다 `scoringService.scoreUnit(input, options)` 호출 →
//      `EvaluationResult[]` 수집(§2 단위 1 건당 scoring).
//   5. scoring 후 abuse 신호 소비 — `applyAbuseSignalToVolume(entries, signal)` 로
//      suspected author 단위의 `volume` 을 결정적으로 감점해 반환(R-26/R-40 중립화 v1).
//   6. abuse 감점 산출물을 다시 entries 로 재조립 후 update 횟수 중립화 신호 소비 —
//      `applyUpdateCountNeutralizationToVolume(entries2, neutralization)` 로 중립 대상
//      author/unit 의 `volume` 을 net 0(중립 보존)으로 처리한다(R-41 v1).
//   7. update-count 중립 산출물(entries 형태)을 기여 품질 신호 소비 —
//      `applyContributionQualityFloor(entries3, qualitySignal)` 로 zero-contribution
//      대상 author/unit 의 `contribution` 을 결정적으로 `"zero"` 로 floor 강등한다
//      (R-37/R-38 v1).
//   8. contribution-quality floor 산출물(entries 형태)을 저성과자 신호 소비 —
//      `applyUnderPerformerAnnotation(entries4, underPerformerSignal)` 로 저성과
//      author 의 **모든** 단위 `narrative` 앞에 표준 한국어 marker
//      (`UNDERPERFORMER_NARRATIVE_MARKER`)를 결정적으로 접두 annotation 한다(R-27 v1).
//   9. underperformer annotation 산출물(entries 형태)을 중요·어려운 기여 신호 소비 —
//      `applyNotableContributionAnnotation(entries5, notableContributionSignal)` 로
//      중요기여 author 의 **모든** 단위 `narrative` 앞에 표준 한국어 marker
//      (`NOTABLE_CONTRIBUTION_NARRATIVE_MARKER`)를 결정적으로 접두 annotation 한 뒤
//      마지막에 `.map((e) => e.result)` 로 flatten 해 최종 반환(R-25 v1).
//
// abuse / update-count / contribution-quality / underperformer / notable 배선 박제
// (T-0523/T-0526/T-0529/T-0532/T-0535, ADR-0032 §3 정신): 열 helper(`computeAbuseSignal`
// / `applyAbuseSignalToVolume` / `computeUpdateCountNeutralization` /
// `applyUpdateCountNeutralizationToVolume` / `computeContributionQualitySignal` /
// `applyContributionQualityFloor` / `computeUnderPerformerSignal` /
// `applyUnderPerformerAnnotation` / `computeNotableContributionSignal` /
// `applyNotableContributionAnnotation`)는 모두 의존성 0 의 결정적 순수 helper 다(LLM
// 무관, 입력 비변형, throw 0 흡수 정책). 본 orchestrator 는 새 알고리즘 0 — 열 helper 의
// compose + 순서 결정만 담당한다. 다섯 detection 은 dedup 후(중복 부풀림 제거 후) 입력
// 위에서 동작하고, 다섯 소비는 scoring 성공 후에만 실행해 부분 결과 위장 0(§2 실패 격리)
// 을 보존한다. entries 는 `deduped[i].author` 와 `results[i]` 를 같은 순서로 짝지어
// 조립하고, 다섯 adjust 를 entries 형태로 연쇄(mid-pipe flatten 미루기 — 마지막 단계에만
// `.map((e) => e.result)`)한다(매핑 misalignment 0). adjust 적용 순서는 abuse 감점
// (R-26/R-40) → update-count 중립(R-41) → contribution-quality floor(R-37/R-38) →
// underperformer narrative annotation(R-27) → notable narrative annotation(R-25) 로
// 고정한다 — 앞 둘은 `volume`(정량 수치), 세 번째는 `contribution`(품질 등급 enum), 뒤
// 둘은 같은 `narrative`(LLM 정성 평가문 + 결정적 marker 접두) 를 다룬다. 앞 세 배선과
// narrative 두 배선은 **필드 직교** 이고, underperformer/notable 두 배선도 marker 접두가
// 서로 달라(`[저성과자] ` / `[중요기여] `) 임계 분리(평균 × 0.5↓ vs × 1.5↑ — disjoint)로
// 한 author 가 동시에 둘 다일 수 없어 적용 순서가 결과에 무관하지만, 결정성과 spec
// 명료성을 위해 v1 순서를 고정한다(edge case 로 동시 발생 시 두 marker 가 순차 접두). 두
// narrative 배선은 **author-level 전파** — T-0530/T-0533 신호가 unitId 목록 없는 author
// 판정이라, 저성과/중요기여 author 의 모든 단위 narrative 가 일관 marker 접두된다(unit
// 차원 enrich 는 detection layer Follow-up).
//
// dedup 적용 순서 박제(ADR-0032 §4): `dedupTemporalDuplicates`(R-21 earliest-wins) →
// `excludeSelfFollowUps`(R-30 self-follow-up 제외) 순서로 합성한다. 근거 — 시간적
// 중복(동일 `unitId` 재등장)을 먼저 earliest 1 건으로 정리한 뒤 self-follow-up 휴리스틱
// (`unitId`+author 그룹)을 적용하면, 중복으로 인한 이중 카운트가 self-follow-up 검출에
// 섞이지 않는다. 두 함수 모두 입력 비변형·결정적이라 순서 선택의 결과를 spec 으로 박제
// 한다(역순도 동작하나 본 v1 은 dedup → self-follow-up 으로 고정).
//
// scoring 직렬/실패 격리 정책 박제(ADR-0032 §2): 단위별 `scoreUnit` 호출은 순차
// (for-await) 로 수행한다 — 결과 순서는 dedup 후 입력 순서를 그대로 보존하고, 한 단위
// scoring 이 reject 하면 `scoreUnit` 의 전파 정책(swallow 0)을 그대로 이어받아 본
// orchestrator 도 그 error 를 **전파(throw)** 한다. 부분 결과를 fallback 으로 위장하지
// 않는다(§2 실패 격리). 병렬(`Promise.all`)은 결과 순서 보존·실패 격리 의미가 복잡해져
// 미채택 — throughput 최적화는 batch slice 후속 책임.
//
// 빈 입력 / 전부 dedup 제거 경계: `activities` 가 빈 배열이면 빈 `EvaluationResult[]`
// 반환(scoreUnit 호출 0). dedup 으로 전 항목이 1 건으로 합쳐져도 결정적 결과.
//
// 책임 경계(ADR-0032 Follow-up — 후속 slice):
//   - controller / DTO / endpoint / R-9 사용자 지정 기간 — HTTP layer 는 후속 slice.
//     본 orchestrator 가 controller 의 호출 대상이 되나 controller 배선 자체는 별도.
//   - `EvaluationResult` 영속화 / Prisma migration / Assessment·Contribution row 매핑 —
//     §5 schema 게이트 deferred. 본 orchestrator 는 in-memory 반환만(DB write 0).
//   - 일/주/월 aggregate 평가 / batch prompting — 본 orchestrator 는 단위별(per-unit)
//     scoreUnit 의 목록 처리만. 집계·요약 평가는 상위 layer 후속 slice(§2 batch 경계).
import { Injectable } from "@nestjs/common";

import type { Activity } from "../assessment-collection/domain/activity";

import { applyAbuseSignalToVolume } from "./domain/evaluation-abuse-adjust";
import { computeAbuseSignal } from "./domain/evaluation-abuse-signal";
import {
  dedupTemporalDuplicates,
  excludeSelfFollowUps,
} from "./domain/evaluation-dedup";
import { mapActivityToEvaluationInput } from "./domain/evaluation-input.mapper";
import { applyNotableContributionAnnotation } from "./domain/evaluation-notable-contribution-adjust";
import { computeNotableContributionSignal } from "./domain/evaluation-notable-contribution-signal";
import { applyContributionQualityFloor } from "./domain/evaluation-quality-adjust";
import { computeContributionQualitySignal } from "./domain/evaluation-quality-signal";
import type { EvaluationResult } from "./domain/evaluation-result";
import { applyUnderPerformerAnnotation } from "./domain/evaluation-underperformer-adjust";
import { computeUnderPerformerSignal } from "./domain/evaluation-underperformer-signal";
import { applyUpdateCountNeutralizationToVolume } from "./domain/evaluation-update-count-adjust";
import { computeUpdateCountNeutralization } from "./domain/evaluation-update-count-neutral";
import {
  EvaluationScoringService,
  type ScoringOptions,
} from "./evaluation-scoring.service";

@Injectable()
export class EvaluationOrchestratorService {
  // EvaluationScoringService 를 생성자 주입(NestJS class provider) — 같은 module 내
  // DI resolve(assessment-evaluation.module.ts). test 는 이 자리에 mock
  // { scoreUnit } 를 주입해 실 LLM 호출 0 / 실 네트워크 0 / live credential 0 으로
  // compose 정합만 검증한다.
  constructor(private readonly scoringService: EvaluationScoringService) {}

  /**
   * 수집된 `Activity` 목록을 받아 평가 결과 목록을 산출한다
   * (ADR-0032 §1/§4/§2 end-to-end compose).
   *
   * 흐름:
   *   1. `activities.map(mapActivityToEvaluationInput)` 로 정규화(§1).
   *   2. `dedupTemporalDuplicates` → `excludeSelfFollowUps` 순서로 평가-side dedup
   *      적용(§4, 위 파일 머리 주석의 순서 박제 근거 참조).
   *   3. `computeAbuseSignal(deduped)` 로 dedup 후 입력의 abusing 신호 산출(§3).
   *   3b. `computeUpdateCountNeutralization(deduped)` 로 dedup 후 입력의 update 횟수
   *      중립화 신호 산출(R-41 — abuse detection 과 동형, 중복 부풀림 제거 후 measure).
   *   3c. `computeContributionQualitySignal(deduped)` 로 dedup 후 입력의 기여 품질
   *      분류 신호 산출(R-37/R-38 — titleLength 휴리스틱으로 zero-contribution 후보).
   *   3d. `computeUnderPerformerSignal(deduped)` 로 dedup 후 입력의 저성과자 식별 신호
   *      산출(R-27 / REQ-013 — author 별 code 단위 수를 동료 평균 대비 상대 비교).
   *   3e. `computeNotableContributionSignal(deduped)` 로 dedup 후 입력의 중요·어려운
   *      기여 식별 신호 산출(R-25 / REQ-011 — author 별 code 단위 수를 동료 평균 대비
   *      상대 비교, underperformer 의 대칭 — 평균 × 1.5 초과).
   *   4. 남은 각 단위마다 `scoringService.scoreUnit(input, options)` 를 순차 호출해
   *      `EvaluationResult[]` 를 입력 순서대로 수집(§2).
   *   5. `applyAbuseSignalToVolume(entries, signal)` 로 suspected author 단위의
   *      volume 을 결정적으로 감점한다(R-26/R-40 중립화 v1).
   *   6. abuse 감점 산출물을 entries 로 재조립 후
   *      `applyUpdateCountNeutralizationToVolume(entries2, neutralization)` 로 중립
   *      대상 author/unit 의 volume 을 net 0(중립 보존)으로 처리한다(R-41 v1).
   *   7. update-count 중립 산출물(entries 형태)을 그대로 받아
   *      `applyContributionQualityFloor(entries3, qualitySignal)` 로 zero-contribution
   *      대상 author/unit 의 contribution 을 결정적으로 `"zero"` 로 floor 강등한다
   *      (R-37/R-38 v1).
   *   8. contribution-quality floor 산출물(entries 형태)을 그대로 받아
   *      `applyUnderPerformerAnnotation(entries4, underPerformerSignal)` 로 저성과
   *      author 의 모든 단위 narrative 앞에 표준 한국어 marker
   *      (`UNDERPERFORMER_NARRATIVE_MARKER`)를 결정적으로 접두 annotation 한다(R-27 v1).
   *   9. underperformer annotation 산출물(entries 형태)을 그대로 받아
   *      `applyNotableContributionAnnotation(entries5, notableContributionSignal)` 로
   *      중요기여 author 의 모든 단위 narrative 앞에 표준 한국어 marker
   *      (`NOTABLE_CONTRIBUTION_NARRATIVE_MARKER`)를 결정적으로 접두 annotation 한 뒤
   *      마지막에 `.map((e) => e.result)` 로 flatten 해 최종 반환(R-25 v1).
   *
   * 정책:
   *   - 빈 `activities` → 빈 배열 반환(scoreUnit 호출 0, 다섯 신호 빈 신호 / 빈 entries).
   *   - scoring 순차 — 결과 순서 = dedup 후 입력 순서 보존(결정적).
   *   - 한 단위 scoring reject 시 그 error 를 전파(throw, swallow 0 — §2 실패 격리).
   *     다섯 adjust(abuse + update-count + contribution-quality + underperformer +
   *     notable) 는 scoring 전량 성공 후에만 실행(부분 결과 위장 0).
   *   - adjust 적용 순서 = abuse 감점(R-26/R-40) → update-count 중립(R-41) →
   *     contribution-quality floor(R-37/R-38) → underperformer narrative annotation
   *     (R-27) → notable narrative annotation(R-25). 앞 둘은 `volume`(정량 수치), 세
   *     번째는 `contribution`(품질 등급 enum), 뒤 둘은 같은 `narrative`(LLM 정성 평가문
   *     + 결정적 marker 접두) 를 다룬다. 앞 세 배선과 narrative 두 배선은 필드 직교이고,
   *     underperformer/notable 두 배선도 marker 접두가 서로 달라 임계 분리(평균 ×
   *     0.5↓ vs × 1.5↑ — disjoint)로 한 author 가 동시에 둘 다일 수 없어 순서 무관 —
   *     v1 고정(edge case 로 동시 발생 시 두 marker 순차 접두).
   *   - **author-level 전파**: 저성과/중요기여 신호는 unitId 목록 없는 author 판정이라,
   *     해당 author 의 **모든** 단위 narrative 가 일관 marker 접두된다. 새 매핑 0
   *     (`deduped[i].author` 가 그대로 entries[i].author 로 전달).
   *   - 매핑 / dedup / scoring / detection / adjust 재구현 0 — 기존 import 호출만
   *     (compose + 순서 결정만). 새 알고리즘 0.
   *   - 입력 배열 비변형(map / dedup / 열 helper 모두 새 배열 산출, 부수효과 0).
   *
   * @param activities 수집 산출물 `Activity` 목록(typed surface 만, raw 본문 0).
   * @param options scoring 옵션 — 각 `scoreUnit` 호출에 그대로 전달(`ScoringOptions`).
   * @returns dedup 후 단위 순서를 보존하고 abuse 감점 + update 횟수 중립 + 기여 품질
   *          floor 강등 + 저성과자 narrative marker + 중요·어려운 기여 narrative marker
   *          annotation 이 반영된 `EvaluationResult[]`.
   */
  async evaluateActivities(
    activities: Activity[],
    options: ScoringOptions,
  ): Promise<EvaluationResult[]> {
    // (1) 정규화 — Activity[] → EvaluationInput[](§1). 순수 함수, 입력 비변형.
    const inputs = activities.map(mapActivityToEvaluationInput);

    // (2) 평가-side dedup(§4) — 시간적 중복(R-21) 먼저, self-follow-up(R-30) 다음.
    //     두 함수 모두 새 배열을 산출하므로 inputs / activities 는 비변형.
    const deduped = excludeSelfFollowUps(dedupTemporalDuplicates(inputs));

    // (3) abusing detection(§3) — dedup 후 입력 위에서 측정해 중복 부풀림을 배제한다.
    //     결정적 순수 helper(LLM 무관). 빈 deduped → 빈 신호(throw 0).
    const signal = computeAbuseSignal(deduped);

    // (3b) update 횟수 중립화 detection(R-41) — abuse detection 과 동형으로 dedup 후
    //      입력 위에서 document update 횟수(version)를 measure 한다. 결정적 순수
    //      helper(LLM 무관). 빈 deduped → 빈 신호(throw 0).
    const neutralization = computeUpdateCountNeutralization(deduped);

    // (3c) 기여 품질 분류 detection(R-37/R-38) — abuse / update-count detection 과
    //      동형으로 dedup 후 입력 위에서 metadata.titleLength 휴리스틱으로
    //      zero-contribution 후보 단위를 식별한다. 결정적 순수 helper(LLM 무관).
    //      빈 deduped → 빈 신호(throw 0).
    const qualitySignal = computeContributionQualitySignal(deduped);

    // (3d) 저성과자 식별 detection(R-27 / REQ-013) — abuse / update-count /
    //      contribution-quality detection 과 동형으로 dedup 후 입력 위에서 author 별
    //      contributionKind === "code" 단위 수를 동료 평균 대비 상대 비교
    //      (UNDERPERFORMER_RELATIVE_FLOOR)로 저성과자 author 를 식별한다. author-level
    //      판정(unitId 목록 0) — 본 배선은 author-level 전파로 흡수한다. 결정적 순수
    //      helper(LLM 무관). 빈 deduped → 빈 신호(throw 0).
    const underPerformerSignal = computeUnderPerformerSignal(deduped);

    // (3e) 중요·어려운 기여 식별 detection(R-25 / REQ-011) — 앞 네 detection 과 동형
    //      으로 dedup 후 입력 위에서 author 별 contributionKind === "code" 단위 수를
    //      동료 평균 대비 상대 비교(NOTABLE_RELATIVE_CEILING)로 중요·어려운 기여 author
    //      를 식별한다. underperformer detection 의 대칭(inverse) — 저성과는 평균 ×
    //      0.5 미만, 중요기여는 평균 × 1.5 초과(임계 disjoint). author-level 판정
    //      (unitId 목록 0) — 본 배선은 author-level 전파로 흡수한다. 결정적 순수
    //      helper(LLM 무관). 빈 deduped → 빈 신호(throw 0).
    const notableContributionSignal = computeNotableContributionSignal(deduped);

    // (4) 단위별 scoring(§2) — 순차 호출로 결과 순서 = dedup 후 입력 순서 보존.
    //     한 단위 reject 는 await 가 전파(부분 결과 위장 0 — 실패 격리).
    const results: EvaluationResult[] = [];
    for (const input of deduped) {
      results.push(await this.scoringService.scoreUnit(input, options));
    }

    // (5) abuse 신호 소비 — entries 는 deduped[i].author 와 results[i] 를 같은 순서로
    //     짝지어 조립한다(매핑 misalignment 0). suspected author 단위의 volume 만
    //     결정적으로 감점되고 나머지는 무변경 복제된다. 입력 비변형.
    const entries = deduped.map((input, i) => ({
      author: input.author,
      result: results[i],
    }));
    const abuseAdjusted = applyAbuseSignalToVolume(entries, signal);

    // (6) update 횟수 중립화 신호 소비 — abuse 감점 산출물을 다시 entries 로 재조립해
    //     중립 대상 author/unit 의 volume 을 net 0(중립 보존)으로 처리한다. abuse
    //     감점 다음에 적용해 중립 대상 단위가 마지막에 base 를 보존하도록 한다(R-41
    //     명문 — advantage 도 penalty 도 없음). 본 산출물은 mid-pipe 라 flatten 하지
    //     않고 entries 형태로 다음 배선(contribution-quality)에 그대로 넘긴다.
    const updateCountAdjusted = applyUpdateCountNeutralizationToVolume(
      abuseAdjusted,
      neutralization,
    );

    // (7) 기여 품질 분류 신호 소비 — update-count 중립 산출물(entries 형태)을 그대로
    //     받아 zero-contribution 대상 author/unit 의 contribution 을 결정적으로
    //     `"zero"` 로 floor 강등한다. volume 을 다루는 앞 두 배선과 contribution 을
    //     다루는 본 배선은 필드 직교라 적용 순서 무관하지만 v1 순서를 고정한다. 본
    //     산출물은 mid-pipe 라 flatten 하지 않고 entries 형태로 다음 배선
    //     (underperformer)에 그대로 넘긴다.
    const qualityAdjusted = applyContributionQualityFloor(
      updateCountAdjusted,
      qualitySignal,
    );

    // (8) 저성과자 narrative annotation 신호 소비 — contribution-quality floor 산출물
    //     (entries 형태)을 그대로 받아 저성과 author 의 **모든** 단위 narrative 앞에
    //     표준 한국어 marker(UNDERPERFORMER_NARRATIVE_MARKER) 를 결정적으로 접두
    //     annotation 한다(비파괴 · 멱등 · 단조). volume / contribution 을 다루는 앞 세
    //     배선과 narrative 를 다루는 본 배선은 필드 직교라 적용 순서 무관하지만 v1
    //     순서를 고정한다. T-0530 신호가 author-level 판정(unitId 목록 0)이라 entries
    //     의 author 매칭만으로 그 author 의 모든 단위가 일관 annotation 된다(새 매핑
    //     0). 본 산출물은 mid-pipe 라 flatten 하지 않고 entries 형태로 다음 배선
    //     (notable)에 그대로 넘긴다. 네 helper 모두 입력 비변형.
    const underPerformerAnnotated = applyUnderPerformerAnnotation(
      qualityAdjusted,
      underPerformerSignal,
    );

    // (9) 중요·어려운 기여 narrative annotation 신호 소비 — underperformer annotation
    //     산출물(entries 형태)을 그대로 받아 중요기여 author 의 **모든** 단위 narrative
    //     앞에 표준 한국어 marker(NOTABLE_CONTRIBUTION_NARRATIVE_MARKER)를 결정적으로
    //     접두 annotation 한다(비파괴 · 멱등 · 단조 상향). underperformer(단조 하한
    //     marker)와 notable(단조 상향 marker)은 같은 `narrative` 필드를 다루지만 marker
    //     접두가 서로 달라(`[저성과자] ` / `[중요기여] `), 임계 분리(평균 × 0.5↓ vs ×
    //     1.5↑ — disjoint)로 한 author 가 동시에 둘 다일 수 없다. 따라서 적용 순서는
    //     결과에 무관하지만 결정성·spec 명료성을 위해 underperformer 먼저, notable 다음
    //     으로 v1 고정한다(edge case 로 동시 발생 시 두 marker 가 순차 접두되는 결과를
    //     spec 으로 박제). T-0533 신호가 author-level 판정(unitId 목록 0)이라 entries
    //     의 author 매칭만으로 그 author 의 모든 단위가 일관 annotation 된다(새 매핑
    //     0). 마지막에 `.map((e) => e.result)` 로 flatten 해 최종 반환한다. 다섯 helper
    //     모두 입력 비변형.
    return applyNotableContributionAnnotation(
      underPerformerAnnotated,
      notableContributionSignal,
    ).map((e) => e.result);
  }
}
