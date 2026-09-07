// applyEvaluationAdjustments — P5 평가 후처리(post-scoring adjustment) 9-step
// thread 를 묶는 결정적 순수 domain composer(T-0606). 본 helper 는
// `EvaluationOrchestratorService` 가 inline 으로 묶고 있던 5-step chain(L258~315 —
// abuse → update-count → quality → underperformer → notable → flatten)을
// orchestrator 와 **byte-identical** 한 순서·계약으로 mirror 한다. 추출의 ROI 는
// service mock(LLM scoring) 없이도 9-step thread 순서·필드 직교성·entries↔result
// flatten 계약을 단위로 검증 가능하다는 점이다(scoring service 분리).
//
// 책임 경계(본 task = composer 신설만, Out of Scope):
//   - 본 composer 는 9 위임 helper(`applyAbuseSignalToVolume` /
//     `applyUpdateCountNeutralizationToVolume` / `applyContributionQualityFloor` /
//     `applyUnderPerformerAnnotation` / `applyNotableContributionAnnotation` /
//     `applyNotableContributionUplift` / `applyDocumentContributionUplift` /
//     `applyDocumentContributionAnnotation` / `applyAlgorithmResearchUplift`)를
//     v1 고정 순서로 thread + 마지막 `.map((e) => e.result)` flatten 만 한다.
//     감점 / 중립 / floor / annotation 로직 재구현 0 — 위임만.
//   - orchestrator 가 본 composer 를 호출하도록 배선하는 일은 별도 follow-up
//     (파일 disjoint · 동시성 보존). 본 task 는 composer + colocated spec 신설.
//   - 7 signal detection helper(`evaluation-*-signal.ts` /
//     `evaluation-update-count-neutral.ts`) 변경 0 — 본 composer 는 신호를 인자로만
//     받는다(컴퓨트 0).
//
// v1 고정 순서(orchestrator L262~315 동기 + 상향·문서 축 확장, 변경 금지):
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
//   6. notable uplift — `applyNotableContributionUplift(entries, signals.notableContribution)`
//      — 중요기여 author 단위 `contribution` 을 `"high"` 로 상향(T-1921 / REQ-011).
//      step 3 floor **뒤**여야 "하한 우선"(floor 의 `"zero"` 불변) 이 성립한다.
//   7. document uplift — `applyDocumentContributionUplift(entries, signals.documentContribution)`
//      — 문서 축 notable author 단위 `contribution` 을 `"high"` 로 상향
//      (T-1926 / REQ-020 — README `39 행` "문서 기여 → 더 높은 점수"). step 3
//      floor **뒤**여야 `"zero"` 하한 우선이 성립한다(helper 규칙 (3) 과 정합).
//      step 6 과 같은 `contribution` 필드를 다루지만 목표 등급이 `"high"` 로
//      동일하고 두 helper 모두 멱등이라, 한 author 가 코드 축·문서 축 모두
//      notable 이어도 산출이 `"high"` 로 수렴한다(순서 무관 — v1 순서 고정).
//   8. document annotation — `applyDocumentContributionAnnotation(entries, signals.documentContribution)`
//      — 문서 축 notable author 의 **모든** 단위 `narrative` 앞에
//      `DOCUMENT_CONTRIBUTION_NARRATIVE_MARKER`(`[문서기여] `) 접두(T-1928 /
//      REQ-020 — README `39 행` "문서 기여 → 더 높은 평가 코멘트"). step 4·5 와
//      marker 문자열이 달라 다축 대상이면 순차 접두된다(멱등 — 2 회 접두 0).
//   9. algorithm-research uplift — `applyAlgorithmResearchUplift(entries, signals.algorithmResearch)`
//      — 알고리즘 설계 · 새 일거리 구상 · 외부 연구 소개로 식별된 author
//      단위 `contribution` 을 `"high"` 로 상향(T-1953 helper / ADR-0064 · R-38 /
//      REQ-019 — README `38 행` "새 알고리즘 설계 · 새 일거리 구상 · 외부
//      연구 소개 → 더 높은 점수"). step 3 floor **뒤**여야 `"zero"` 하한 우선이
//      성립한다(helper 규칙 (3) 과 정합). step 6·7 과 목표 등급이 `"high"` 로
//      같고 세 helper 모두 멱등이라, 한 author 가 코드 축 · 문서 축 · 알고리즘 축
//      어느 조합으로 대상이어도 산출이 `"high"` 로 수렴한다(순서 무관).
//  10. flatten — `.map((e) => e.result)` 로 entries 형태를 `EvaluationResult[]` 로
//      flatten 해 반환. mid-pipe 9 step 은 entries 형태 그대로 thread.
//
// 필드 직교성(순서 무관 보장):
//   - step 1·2 : `volume` 만 갱신.
//   - step 3·6·7·9 : `contribution` 만 갱신(3 = 하한 floor, 6 = 코드 축 상한
//     uplift, 7 = 문서 축 상한 uplift, 9 = 알고리즘·연구 축 상한 uplift — 세
//     uplift 는 목표 등급 동일 · 멱등이라 서로 순서 무관, 그래도 v1 순서
//     고정).
//   - step 4·5·8 : `narrative` 만 갱신(4 = 저성과자 marker, 5 = 코드 축 marker,
//     8 = 문서 축 marker — 세 marker 문자열이 서로 달라 접두가 겹치지 않는다).
//   세 필드 그룹이 서로 겹치지 않아 같은 결과면 어떤 순열로 적용해도 산출이 동일
//   하다. 그래도 v1 순서 고정 — 결정성 + spec 명료성 + 동시 marker 접두 순서 박제.
//
// throw 경계(9 위임 helper 와 정합):
//   - `entries` / `signals` / `signals` 의 각 필드(abuse / updateCount / quality /
//     underPerformer / notableContribution / documentContribution /
//     algorithmResearch) 가 null/undefined 면 한국어 `TypeError`.
//     본 composer 의 entry-level guard 는 9 위임 호출 전에 박제해, 위임 helper 가
//     자기 guard 로 throw 하기 전에 어느 step 이 비었는지를 명시적으로 외화한다.
//   - 위임 helper 가 throw 하는 입력(예: 위임 자체가 추가 guard 검출)에서는 본
//     composer 는 자체 try/catch 없이 그대로 **전파**한다(흡수 0). caller 가
//     9 step 중 어느 helper 가 던졌는지를 그대로 볼 수 있어야 한다(투명성).
//
// 재현 0:
//   - 본 composer 는 9 helper 의 산출 / 알고리즘 / 감점·중립·floor·annotation·상향
//     공식
//     을 재구현하지 않는다(위임만). 한 helper 의 v1 정책이 바뀌면 본 composer 는
//     변경 없이 그 변화를 그대로 흘려보낸다.

import { Logger } from "@nestjs/common";

import {
  applyAbuseSignalToVolume,
  type AbuseAdjustEntry,
} from "./evaluation-abuse-adjust";
import type { AbuseSignal } from "./evaluation-abuse-signal";
import { applyAlgorithmResearchUplift } from "./evaluation-algorithm-research-adjust";
import type { AlgorithmResearchSignal } from "./evaluation-algorithm-research-signal";
import {
  applyDocumentContributionAnnotation,
  applyDocumentContributionUplift,
} from "./evaluation-document-contribution-adjust";
import type { DocumentContributionSignal } from "./evaluation-document-contribution-signal";
import {
  applyNotableContributionAnnotation,
  applyNotableContributionUplift,
} from "./evaluation-notable-contribution-adjust";
import type { NotableContributionSignal } from "./evaluation-notable-contribution-signal";
import { applyContributionQualityFloor } from "./evaluation-quality-adjust";
import type { ContributionQualitySignal } from "./evaluation-quality-signal";
import type { EvaluationResult } from "./evaluation-result";
import { applyUnderPerformerAnnotation } from "./evaluation-underperformer-adjust";
import type { UnderPerformerSignal } from "./evaluation-underperformer-signal";
import { applyUpdateCountNeutralizationToVolume } from "./evaluation-update-count-adjust";
import type { UpdateCountNeutralization } from "./evaluation-update-count-neutral";

// step (9) 알고리즘 · 연구 축 상향 건수 관측용 module-level logger
// (ADR-0064 § Consequences 오탐 완화 (iv) / T-1956). `@nestjs/common` 내장이라
// 새 dependency 0 이고, class 신설 · DI 주입 · export 를 하지 않아 본 composer 의
// 순수 함수 계약(반환값 · 결정성 · 입력 비변형)은 그대로다 — 관측 side-channel 만
// 추가된다. domain 순수성 완화는 ADR-0064 § Status 가 지목한 본 파일 1 곳 한정.
const logger = new Logger("EvaluationAdjustmentsPipeline");

// EvaluationAdjustEntry — 9 위임 helper 가 공통으로 받는 입력/출력 단위.
// `AbuseAdjustEntry` / `UpdateCountAdjustEntry` / `ContributionQualityAdjustEntry`
// / `UnderPerformerAdjustEntry` / `NotableContributionAdjustEntry` /
// `DocumentContributionAdjustEntry` / `AlgorithmResearchAdjustEntry` 가 모두 동형
// shape (`{ author: string; result: EvaluationResult }`) 이므로, T-0522 박제
// `AbuseAdjustEntry` 를 single-source 로 re-export 해 9 helper 간 entries 변환 0 을
// 보장한다(타입 재정의 0). caller 는 본 alias 하나만 import 하면 9-step thread
// 입력을 그대로 구성할 수 있다.
export type EvaluationAdjustEntry = AbuseAdjustEntry;

// EvaluationAdjustmentSignals — detection 7 신호 입력 container. 각 필드는 해당
// detection helper 산출 타입을 그대로 재사용한다(재정의 0). 앞 5 필드명은
// orchestrator 의 5-step 의도(abuse → updateCount → quality → underPerformer →
// notableContribution)와 정합 — 호출부 가독성을 위해 camelCase 단일 형식.
// 6 번째 `documentContribution`(T-1924 detection)은 step (7) document uplift 와
// step (8) document annotation 이 함께 소비한다(T-1926 · T-1928 배선) — 문서 축
// notable author 단위 `contribution` 상향 + `narrative` marker 접두의 공통 입력
// 이다. 7 번째 `algorithmResearch`(T-1951 detection)는 step (9) algorithm-research
// uplift 가 소비한다(T-1954 배선 — ADR-0064 `§ Follow-ups (c)` 상환) — 알고리즘
// · 연구 소개 축으로 식별된 author 단위 `contribution` 을 `"high"` 로 상향하는
// 입력이다. container 를 단일 source 로 유지하기 위해 7 필드 모두 필수 필드로 둔다.
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
  // R-39 / REQ-020 문서 축 조직 기여 식별 신호.
  // `computeDocumentContributionSignal` 산출.
  documentContribution: DocumentContributionSignal;
  // R-38 / REQ-019 알고리즘·연구 소개 상향 식별 신호.
  // `computeAlgorithmResearchSignal` 산출 — step (9) 의
  // `applyAlgorithmResearchUplift` 가 소비한다(T-1954 배선).
  algorithmResearch: AlgorithmResearchSignal;
}

/**
 * P5 평가 후처리 9-step thread 를 묶는 결정적 순수 composer.
 *
 * orchestrator L262~315 의 5-step chain 을 mirror 한 뒤 등급 상향 3 step(코드 축
 * T-1921 · 문서 축 T-1926 · 알고리즘·연구 축 T-1954) + 문서 축 코멘트
 * annotation 1 step(T-1928)을 이어 붙인
 * v1 고정 순서로 9 위임 helper 를 thread 하고,
 * 마지막에 `.map((e) => e.result)` 로 flatten 해 `EvaluationResult[]` 를 반환한다.
 * 본 composer 는 감점·중립·floor·annotation·상향 로직을 재구현하지 않고 9 helper
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
 *   6. notable uplift — 코드 축 contribution 상향(`"zero"` 제외 — step 3 floor 우선).
 *   7. document uplift — `applyDocumentContributionUplift(entries''''', signals.documentContribution)`
 *      — 문서 축 contribution 상향(`"zero"` 제외 — step 3 floor 우선).
 *   8. document annotation — `applyDocumentContributionAnnotation(entries'''''', signals.documentContribution)`
 *      — narrative 앞에 `[문서기여] ` marker 접두(멱등 — 2 회 접두 0).
 *   9. algorithm-research uplift — `applyAlgorithmResearchUplift(entries''''''', signals.algorithmResearch)`
 *      — 알고리즘·연구 축 contribution 상향(`"zero"` 제외 — step 3 floor 우선).
 *  10. flatten — `.map((e) => e.result)` 로 entries 를 `EvaluationResult[]` 로 변환.
 *
 * 방어(throw 0 흡수 정책 — 9 helper 정합):
 *   - 빈 `entries: []` → 빈 배열 `[]` 반환(전 9 위임 무변경 통과 + flatten 0 건).
 *   - 7 signal 모두 "무대상"(예: 빈 `byAuthor`) → entries 의 result 가 무변경
 *     복제만 되어 최종 산출이 entries 의 result 복제와 deep-equal.
 *   - 입력 `entries` / `signals` / `signals` 의 각 필드 / 원소 비변형 — 모든 위임
 *     helper 가 새 배열 + 새 객체만 반환(referential transparency).
 *
 * throw(명시적 계약 위반만):
 *   - `entries` 가 null/undefined → 한국어 `TypeError`.
 *   - `signals` 가 null/undefined → 한국어 `TypeError`.
 *   - `signals.abuse` / `signals.updateCount` / `signals.quality` /
 *     `signals.underPerformer` / `signals.notableContribution` /
 *     `signals.documentContribution` / `signals.algorithmResearch` 중 하나라도
 *     null/undefined → 한국어 `TypeError`(어느 signal 이 비었는지 명시).
 *   - 위 guard 통과 후 위임 helper 가 throw 하면 본 composer 는 그대로 전파한다
 *     (try/catch 0). 어느 step 이 던졌는지 caller 가 그대로 볼 수 있어야 한다.
 *   - 7 필드 guard 는 step (1) 진입 **전**에 전량 평가된다 — 한 필드라도 비면
 *     앞 step 산출이 남지 않는다(부분 적용 0).
 *
 * 결정성·무공유 보장:
 *   - 동일 입력 2 회 호출 → deep-equal(byte-identical) 산출.
 *   - 입력 `entries`/`signals` mutate 0 — 9 helper 모두 입력 비변형.
 *   - 산출 배열은 9 step 위임의 산출 + flatten 의 누적이라 입력 entries 배열과
 *     not-same-ref(새 배열).
 *
 * @param entries 9-step thread 의 시작 entries(`{ author, result }[]`). 변형 0.
 *                각 원소는 scoring 후 entries 조립(`deduped[i].author` +
 *                `results[i]`) 결과여야 한다(orchestrator L258~261 동기).
 * @param signals 7 detection helper 산출 신호 container. 변형 0. 9 step 이 7 필드를
 *                모두 소비한다 — `algorithmResearch` 는 step (9) uplift 의 입력이다
 *                (T-1954 배선으로 ADR-0064 `§ Follow-ups (c)` 상환 완료).
 * @returns 9-step thread + flatten 산출 `EvaluationResult[]` — 길이·순서는 입력
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
  // 7 signal 필드 guard — 어느 step 의 signal 이 비었는지를 명시적으로 외화해
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
  if (
    signals.documentContribution === null ||
    signals.documentContribution === undefined
  ) {
    throw new TypeError(
      "signals.documentContribution 은 null 또는 undefined 일 수 없습니다.",
    );
  }
  // step (9) algorithm-research uplift 의 입력 guard — 앞 6 필드와 동형 형식으로
  // step 진입 전에 박제한다(부분 적용 0).
  if (
    signals.algorithmResearch === null ||
    signals.algorithmResearch === undefined
  ) {
    throw new TypeError(
      "signals.algorithmResearch 는 null 또는 undefined 일 수 없습니다.",
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

  // (5) 중요·어려운 기여 annotation — 중요기여 author 의 모든 단위
  //     narrative 앞에 `[중요기여] ` marker 접두. underperformer 와 같은
  //     narrative 필드를 다루지만 marker 접두가 서로 달라 동시 발생 edge case
  //     에서는 underperformer marker 가 먼저 접두된 narrative 위에 notable
  //     marker 가 다시 접두된다(spec 박제). orchestrator L312~315.
  const notableAnnotated = applyNotableContributionAnnotation(
    underPerformerAnnotated,
    signals.notableContribution,
  );

  // (6) 중요기여(코드 축) 등급 상향 — **반드시 step (3) quality floor 뒤**여야
  //     floor 의 `"zero"` 를 되돌리지 않는 "하한 우선" 이 성립한다(T-1921/REQ-011).
  const notableUplifted = applyNotableContributionUplift(
    notableAnnotated,
    signals.notableContribution,
  );

  // (7) 문서 축 기여 등급 상향 — step (6) 산출을 받아 문서 축 notable author 단위의
  //     contribution 을 `"high"` 로 상향한다(T-1926/REQ-020). (a) step (3) floor
  //     뒤라 `"zero"` 하한이 우선 보존되고, (b) step (6) 과 목표 등급이 `"high"` 로
  //     같고 두 helper 모두 멱등이라 한 author 가 코드 축·문서 축 모두 notable
  //     이어도 산출이 `"high"` 로 수렴한다(순서 무관).
  const documentUplifted = applyDocumentContributionUplift(
    notableUplifted,
    signals.documentContribution,
  );

  // (8) 문서 축 코멘트 annotation — 문서 축 notable author 의 모든 단위 narrative
  //     앞에 `[문서기여] ` marker 접두(T-1928/REQ-020 코멘트 축). step (7) 과 같은
  //     신호를 쓰지만 `narrative` 만 손대 `"high"` 산출을 훼손하지 않는다.
  const documentAnnotated = applyDocumentContributionAnnotation(
    documentUplifted,
    signals.documentContribution,
  );

  // (9) 알고리즘·연구 축 등급 상향 — step (8) 산출을 받아 알고리즘 설계 · 새
  //     일거리 구상 · 외부 연구 소개로 식별된 author 단위의 contribution 을
  //     `"high"` 로 상향한다(T-1953 helper / ADR-0064 · R-38 / REQ-019). (a) step (3)
  //     floor 뒤라 `"zero"` 하한이 우선 보존되고, (b) step (6)·(7) 과 목표 등급이
  //     `"high"` 로 같고 세 helper 모두 멱등이라 다축 동시 대상도 `"high"` 로
  //     수렴한다(순서 무관). 상향 규칙 재구현 0 — 하한 판정·등급 대입·byAuthor
  //     조회 를 본 composer 에서 다시 하지 않고 helper 에 위임만 한다.
  const algorithmResearchUplifted = applyAlgorithmResearchUplift(
    documentAnnotated,
    signals.algorithmResearch,
  );

  // 관측(ADR-0064 § Consequences 오탐 완화 (iv) / T-1956) — step (9) 가 실제로
  // 등급을 바꾼 단위 수만 센다. `applyAlgorithmResearchUplift` 는 길이 · 순서를
  // 보존한 새 배열을 돌려주므로 같은 index 가 같은 단위를 가리킨다(index 대응 성립).
  // step (6) notable · (7) document 상향분과 step (3) `"zero"` floor 보존분은
  // step (9) 직전 배열에 이미 접혀 있어 세지 않는다(축 혼입 0).
  const algorithmResearchUpliftedCount = algorithmResearchUplifted.filter(
    (entry, index) =>
      entry.result.contribution !==
      documentAnnotated[index].result.contribution,
  ).length;
  // 상향 0 건이면 로그를 억제한다 — 평가 호출마다 0 건 줄이 쌓이는 것을 막는다
  // (T-1946 억제 규칙과 동형).
  if (algorithmResearchUpliftedCount > 0) {
    // 건수 + 고정 한국어 문구만 남긴다. unitId · author · narrative · marker
    // 어휘 · 원본 title 은 어느 것도 기록하지 않는다(raw 유출 0, REQ-032 정합).
    logger.log(
      `algorithm-research uplift: ${algorithmResearchUpliftedCount} 건 상향`,
    );
  }

  // (10) flatten — mid-pipe 9 step 의 entries 형태를 `EvaluationResult[]` 로 변환.
  return algorithmResearchUplifted.map((entry) => entry.result);
}
