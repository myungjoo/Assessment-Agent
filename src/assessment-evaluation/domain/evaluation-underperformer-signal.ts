// computeUnderPerformerSignal — P5 저성과자 식별 detection 의 결정적 순수 domain
// helper (R-27 / REQ-013: "저성과자 식별 — 코드 기여 현격히 떨어지는 인원 식별").
// 한 batch 의 `EvaluationInput[]` 에서 **코드 기여 단위 수가 batch 동료 평균 대비
// 현격히 낮은 author** 를 LLM 무관하게 결정적으로 식별한다. 본 파일은 의존성 0 의
// 순수 함수만 둔다 — NestJS `@Injectable` / Prisma / LLM gateway import 0, throw
// 0(명시적 null/undefined 입력 계약 위반 외), 부수효과 0(referential transparency,
// 입력 비변형). 동일 입력은 항상 동일 출력 — LLM 정성 평가와 분리해 독립 검증
// 가능하다(ADR-0032 §3 "metric 수치 신호는 LLM 정성과 분리해 결정적으로" 정신과
// 정합).
//
// 왜 별도의 결정적 신호인가:
//   - R-27 의 "코드 기여 현격히 떨어지는 인원 식별" 은 LLM 정성 평가의 관대·환각에
//     좌우되면 안 되는 **결정적 상대 비교 신호** 다. 한 batch 동료 대비 코드 기여
//     단위 수가 명백히 낮은 author 를 metadata 휴리스틱(여기서는 단위 수 집계)으로
//     LLM 무관하게 잡아내는 방어선이 본 helper 의 책임이다.
//
// 판정 알고리즘(결정적·LLM 무관, v1):
//   1. 입력을 author 별로 그룹핑하되(최초 등장 순서 보존) 각 author 의
//      **`contributionKind === "code"` 단위 수**(codeUnitCount)를 센다. document
//      단위는 코드 기여 정량에서 제외한다(R-27 은 "코드 기여" 를 명시).
//   2. batch 기준값으로 전 author 의 codeUnitCount **평균(mean)** 을 결정적으로
//      산출한다. mean 채택 근거: 전 author 합/author 수로 1 줄 결정적 산출이 가능해
//      spec 이 명료하고(median 은 정렬 + 짝수 길이 중앙값 평균 분기로 spec surface
//      가 넓다), batch 동료 대비 "현격히 낮음" 의 직관과 부합한다. base × FLOOR 미만
//      author 를 underPerformer 후보로 식별한다.
//   3. 단독 author batch / 동률 batch / 평균 0(전원 code 기여 0) 등 base 가 무의미한
//      경계는 보수적으로 underPerformer 0 으로 분류한다(false-positive 회피 — 비교
//      대상이 없거나 전원 동일하면 "현격히 떨어지는" 대상이 성립하지 않는다).
//   4. author 별 `underPerformer`(boolean) / `codeUnitCount` 를 축약하고, batch
//      차원 `underPerformerDetected`(1 명 이상) / `totalAuthorCount` /
//      `meanCodeUnitCount` 를 산출한다.
//
// 보수성 원칙(휴리스틱 과확장 금지): v1 은 동료 평균 대비 상대 비교 1 신호로
// 한정한다. 정상 기여자를 저성과로 오분류하는 false-positive 위험을 최소화하는
// 보수적 임계를 택한다(quality-signal 의 보수성 정신 mirror). metadata enrich(변경
// 라인 수 등) 후 가중치 신호는 Follow-up.
//
// 방어(quality-signal / abuse-signal 와 동형):
//   - 빈 배열 → totalAuthorCount 0, byAuthor [], underPerformerDetected false,
//     meanCodeUnitCount 0(throw 0).
//   - `inputs` 자체가 null/undefined → 명시적 한국어 `TypeError`(유일 throw 경로,
//     조용한 오작동 차단).
//   - codeUnitCount 는 정수 카운트라 비유한 number 위험이 없다. `contributionKind`
//     가 예상 외 값이어도 `"code"` 가 아니면 단순 제외한다(throw 0).
//   - 입력 배열·원소를 변형하지 않고 새 객체만 반환한다(부수효과 0).
//
// 책임 경계(본 task = detection layer 만, Out of Scope):
//   - 본 helper 는 신호만 산출한다. 저성과 author 의 평가 결과/summary 반영(소비) /
//     orchestrator 배선은 후속 task 가 본 신호를 소비해 처리한다(T-0528/T-0529 의
//     consume → orchestrator 3-slice 패턴 mirror).
//   - `EvaluationInput` / `EvaluationResult` / `ContributionKind` 타입 변경 0.
//
// 패턴 mirror: evaluation-quality-signal.ts(순수 함수 + author 그룹핑 + 최초 등장
// 순서 보존 결정성 + 입력 비변형 + Map 누적 + 임계 상수 + detection-only 책임 경계) +
// evaluation-abuse-signal.ts(author 별 정량 집계 + 임계 비교 + suspected/대상 boolean
// 패턴).

import type { EvaluationInput } from "./evaluation-input";

// UNDERPERFORMER_RELATIVE_FLOOR — author 의 codeUnitCount 가 batch 평균
// (meanCodeUnitCount) × 본 값 **미만** 이면 "동료 대비 코드 기여가 현격히 낮은"
// underPerformer 후보로 식별한다. v1 baseline = 0.5(동료 평균의 절반 미만). 근거:
// 평균의 절반 미만은 "현격히 떨어지는" 의 직관과 부합하면서, 평균 근처의 정상 변동을
// 저성과로 오분류하지 않는 보수적 경계다. 매우 낮게 잡으면 명백한 저성과만 걸러
// false-positive 가 최소화된다 — 추후 dogfood 실측 후 calibration 가능(LLM 무관
// deterministic 상수, 0~1 비율).
export const UNDERPERFORMER_RELATIVE_FLOOR = 0.5;

// UnderPerformerEntry — 한 author 의 저성과 신호 집계.
export interface UnderPerformerEntry {
  // author 외부 식별자.
  author: string;
  // 이 author 의 `contributionKind === "code"` 단위 수(document 제외).
  codeUnitCount: number;
  // 이 author 가 저성과(동료 평균 × FLOOR 미만)로 식별됐는지.
  underPerformer: boolean;
}

// UnderPerformerSignal — computeUnderPerformerSignal 의 산출 타입. author 별 신호
// 배열 + batch 차원 식별 여부 + 기준값.
export interface UnderPerformerSignal {
  // 평가 대상 author 수(distinct author 수).
  totalAuthorCount: number;
  // batch 기준값 — 전 author codeUnitCount 의 평균(mean). author 0 명이면 0.
  meanCodeUnitCount: number;
  // author 별 신호. author 의 최초 등장 순서 기준으로 안정적·결정적 정렬.
  byAuthor: UnderPerformerEntry[];
  // batch 차원 식별 여부 — byAuthor 중 1 명이라도 underPerformer=true 면 true.
  underPerformerDetected: boolean;
}

// 내부 author 누적 상태. codeUnitCount 는 code 단위 등장마다 누적한다.
interface AuthorAccumulator {
  author: string;
  codeUnitCount: number;
}

/**
 * 한 batch 의 평가 입력에서 저성과자(코드 기여 현격히 낮은 author) 신호를 결정적으로
 * 산출한다(R-27 / REQ-013 detection layer).
 *
 * 알고리즘(결정적·LLM 무관):
 *   1. 입력을 author 별로 그룹핑한다(최초 등장 순서 보존). 각 author 의
 *      `contributionKind === "code"` 단위 수(codeUnitCount)를 센다(document 제외).
 *   2. 전 author codeUnitCount 의 평균(meanCodeUnitCount)을 산출한다.
 *   3. 비교가 의미 있는 batch(author ≥ 2 명 AND 평균 > 0)에서만 codeUnitCount 가
 *      meanCodeUnitCount × UNDERPERFORMER_RELATIVE_FLOOR **미만** 인 author 를
 *      underPerformer 로 식별한다. 단독 author / 평균 0 batch 는 보수적으로
 *      underPerformer 0(비교 대상 없음 / 전원 동일 — false-positive 회피).
 *   4. author 별 underPerformer 를 축약하고 batch 차원 underPerformerDetected /
 *      totalAuthorCount / meanCodeUnitCount 를 산출한다.
 *
 * 방어:
 *   - 빈 배열 → totalAuthorCount 0, byAuthor [], underPerformerDetected false,
 *     meanCodeUnitCount 0.
 *   - 입력 배열·원소를 변형하지 않고 새 객체만 반환한다(부수효과 0).
 *   - `inputs` 자체가 null/undefined 인 입력 계약 위반은 명시적 한국어 `TypeError`
 *     로 throw 한다(조용한 오작동 차단 — 유일한 throw 경로).
 *
 * @param inputs 평가 입력 배열(`EvaluationInput[]`). 변형하지 않는다.
 * @returns author 별 + batch 차원 저성과 신호.
 * @throws {TypeError} `inputs` 가 null / undefined 일 때(입력 계약 위반).
 */
export function computeUnderPerformerSignal(
  inputs: EvaluationInput[],
): UnderPerformerSignal {
  if (inputs === null || inputs === undefined) {
    throw new TypeError(
      "computeUnderPerformerSignal: inputs 는 null/undefined 일 수 없습니다",
    );
  }

  // author → 누적 상태. 최초 등장 순서 보존을 위해 order 배열을 병행한다.
  const accumulators = new Map<string, AuthorAccumulator>();
  const authorOrder: string[] = [];

  inputs.forEach((input) => {
    let acc = accumulators.get(input.author);
    if (acc === undefined) {
      acc = { author: input.author, codeUnitCount: 0 };
      accumulators.set(input.author, acc);
      authorOrder.push(input.author);
    }

    // 코드 기여 정량 — `"code"` 단위만 카운트(document / 예상 외 kind 는 제외).
    if (input.contributionKind === "code") {
      acc.codeUnitCount += 1;
    }
  });

  const totalAuthorCount = authorOrder.length;

  // batch 기준값 — 전 author codeUnitCount 평균. author 0 명이면 0(분모 보호).
  const totalCodeUnitCount = authorOrder.reduce((sum, author) => {
    const acc = accumulators.get(author) as AuthorAccumulator;
    return sum + acc.codeUnitCount;
  }, 0);
  const meanCodeUnitCount =
    totalAuthorCount > 0 ? totalCodeUnitCount / totalAuthorCount : 0;

  // 비교가 의미 있는 경계 — author ≥ 2 명 AND 평균 > 0. 단독 author(비교 대상 없음)
  // / 평균 0(전원 code 기여 0, 전원 동일)은 보수적으로 underPerformer 0.
  const comparable = totalAuthorCount >= 2 && meanCodeUnitCount > 0;
  const floor = meanCodeUnitCount * UNDERPERFORMER_RELATIVE_FLOOR;

  const byAuthor = authorOrder.map((author) => {
    // Map 채움 직후 같은 키로 항상 존재 — non-null 단언 안전.
    const acc = accumulators.get(author) as AuthorAccumulator;
    const underPerformer = comparable && acc.codeUnitCount < floor;
    return {
      author: acc.author,
      codeUnitCount: acc.codeUnitCount,
      underPerformer,
    };
  });

  return {
    totalAuthorCount,
    meanCodeUnitCount,
    byAuthor,
    underPerformerDetected: byAuthor.some((entry) => entry.underPerformer),
  };
}
