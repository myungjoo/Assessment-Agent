// computeContributionQualitySignal — P5 기여 품질 분류 detection 의 결정적 순수
// domain helper (R-37 / R-38 / REQ-037 / REQ-038: "단순 보고·copy-paste 로그 =
// zero-contribution / 새 알고리즘 설계·외부 연구 도입 = 높은 contribution"). 한
// batch 의 `EvaluationInput[]` 에서 metadata 휴리스틱으로 식별 가능한
// **zero-contribution 후보 단위** 를 LLM 무관하게 결정적으로 식별한다. 본 파일은
// 의존성 0 의 순수 함수만 둔다 — NestJS `@Injectable` / Prisma / LLM gateway
// import 0, throw 0(명시적 null/undefined 입력 계약 위반 외), 부수효과 0
// (referential transparency, 입력 비변형). 동일 입력은 항상 동일 출력 — LLM 정성
// 평가와 분리해 독립 검증 가능하다(ADR-0032 §3 "품질 분류축은 LLM 정성 + 결정적
// 신호로 분리" 정신과 정합).
//
// 왜 별도의 결정적 floor 신호인가:
//   - `EvaluationResult.contribution`(zero/low/medium/high)은 현재 **LLM 정성 평가**
//     결과로만 채워진다(evaluation-prompt.ts 의 `contribution:` marker 파싱).
//   - 그러나 R-37 의 "단순 보고·copy-paste 로그 = zero-contribution" 은 LLM 환각·
//     관대 평가에 좌우되면 안 되는 **결정적 하한(floor) 신호** 다. metadata
//     휴리스틱으로 명백한 zero-contribution 후보를 LLM 무관하게 deterministic 하게
//     잡아내는 방어선이 본 helper 의 책임이다.
//
// v1 휴리스틱 한계(보수적 — false-positive 가 실 기여를 zero 로 깎는 위험이 크다):
//   현 collection mapper(github-activity.mapper.ts / confluence-activity.mapper.ts)가
//   박제하는 유일 정량 title 신호는 `metadata.titleLength`(number) 하나뿐이다
//   (변경 라인 수 / 추가량 같은 신호는 ActivityMetadata 에 아직 부재). 따라서 v1 은
//   **`titleLength` 가 trivial 임계 이하(제목조차 거의 비어 copy-paste / 단순 보고의
//   기계적 흔적)** 인 단위만 zero-contribution 후보로 식별한다. 그 외 단위는 모두
//   비대상으로 결정적으로 분류한다. metadata enrich(변경 라인 수 등) 후 휴리스틱
//   강화는 Follow-up — 본 helper 는 가용한 가장 보수적인 1 신호로 한정한다(휴리스틱
//   과확장 금지).
//
// 책임 경계(본 task = detection layer 만, Out of Scope):
//   - 본 helper 는 신호만 산출한다. zero-contribution 단위의 `contribution` 하한
//     적용(LLM 산출이 zero 보다 높게 나와도 floor 로 강등) / orchestrator 배선은
//     후속 task 가 본 신호를 소비해 처리한다(T-0525/T-0526 가 update-count 에 한
//     consume·wiring 패턴 mirror).
//   - `EvaluationResult` / `EvaluationInput` / `ContributionLevel` 타입 변경 0,
//     orchestrator / scoring service 변경 0.
//
// 패턴 mirror: evaluation-update-count-neutral.ts(순수 함수 + author 그룹핑 + 최초
// 등장 순서 보존 결정성 + 입력 비변형 + Map 누적 + 임계 상수 + 비유한 number 방어 +
// detection-only 책임 경계) — neutralized 자리를 zeroContribution 으로 대체.

import type { EvaluationInput } from "./evaluation-input";

// CONTRIBUTION_QUALITY_TITLE_FLOOR — 단위의 title 길이(`metadata.titleLength`)가 본
// 값 이하이면 "제목조차 거의 비어 있는 기계적 단위" 로 분류해 zero-contribution
// 후보(zeroContribution=true)로 식별한다. v1 baseline = 1. 근거: 의미 있는 기여는
// 그 의도를 담은 최소한의 제목(통상 수~수십 글자)을 동반한다. titleLength 가 0(제목
// 부재) 또는 1(단일 글자)인 단위는 copy-paste 로그·자동 생성 보고의 휴리스틱 경계로,
// 그 자체가 실질 기여의 증거가 아니므로 결정적 하한 후보로 본다. 매우 보수적인
// 경계값이라 정상 기여를 zero 로 깎을 위험이 최소화된다 — 추후 dogfood 실측 +
// metadata enrich 후 조정 가능(LLM 무관 deterministic 상수).
export const CONTRIBUTION_QUALITY_TITLE_FLOOR = 1;

// ContributionQualityEntry — 한 author 의 zero-contribution 신호 집계.
export interface ContributionQualityEntry {
  // author 외부 식별자.
  author: string;
  // 이 author 의 단위 중 zero-contribution 후보로 식별된 단위 수.
  zeroContributionCount: number;
  // zero-contribution 후보로 식별된 단위의 unitId 목록. 입력 등장 순서를 보존한다
  // (결정성).
  zeroContributionUnitIds: string[];
  // 이 author 에 대해 1 건 이상 zero-contribution 후보가 식별됐는지
  // — zeroContributionCount ≥ 1.
  zeroContribution: boolean;
}

// ContributionQualitySignal — computeContributionQualitySignal 의 산출 타입.
// author 별 신호 배열 + batch 차원 식별 여부.
export interface ContributionQualitySignal {
  // 평가 대상 전체 단위 수(입력 배열 길이).
  totalUnitCount: number;
  // zero-contribution 후보로 식별된 단위의 총 수(전 author 합).
  totalZeroContributionCount: number;
  // author 별 신호. author 의 최초 등장 순서 기준으로 안정적·결정적 정렬.
  byAuthor: ContributionQualityEntry[];
  // batch 차원 식별 여부 — byAuthor 중 1 명이라도 zeroContribution=true 면 true.
  zeroContributionDetected: boolean;
}

// 내부 author 누적 상태. zeroContributionUnitIds 는 등장 순서대로 push 한다.
interface AuthorAccumulator {
  author: string;
  zeroContributionUnitIds: string[];
}

/**
 * 한 batch 의 평가 입력에서 zero-contribution 후보 신호를 결정적으로 산출한다
 * (R-37 / R-38 / REQ-037 / REQ-038 detection layer).
 *
 * 알고리즘(결정적·LLM 무관):
 *   1. 입력을 author 별로 그룹핑한다(최초 등장 순서 보존).
 *   2. 각 단위의 title 길이(`resolveTitleLength`)가
 *      CONTRIBUTION_QUALITY_TITLE_FLOOR 이하이면 그 단위를 zero-contribution
 *      후보로 식별하고 해당 author 의 zeroContributionUnitIds 에 등장 순서대로
 *      추가한다(contributionKind 무관 — code/document 둘 다 trivial title 은 후보).
 *   3. author 별 zeroContributionCount / zeroContribution(≥ 1) 를 축약하고 batch
 *      차원 zeroContributionDetected(author 중 1 명이라도 식별) 와
 *      totalZeroContributionCount 를 산출한다.
 *
 * 방어:
 *   - 빈 배열 → totalUnitCount 0, byAuthor [], zeroContributionDetected false.
 *   - `metadata.titleLength` 누락 / 비-number(string/boolean/null) / 비유한
 *     number(NaN/Infinity)는 `resolveTitleLength` 가 0 으로 흡수한다 — 0 은 임계
 *     이하라 zero-contribution 후보로 식별되되 throw 는 발생하지 않는다(제목 부재 =
 *     기계적 단위의 가장 강한 신호이므로 0 흡수가 후보 식별과 정합).
 *   - 입력 배열·원소를 변형하지 않고 새 객체만 반환한다(부수효과 0).
 *   - `inputs` 자체가 null/undefined 인 입력 계약 위반은 명시적 한국어 `TypeError`
 *     로 throw 한다(조용한 오작동 차단 — 유일한 throw 경로).
 *
 * @param inputs 평가 입력 배열(`EvaluationInput[]`). 변형하지 않는다.
 * @returns author 별 + batch 차원 zero-contribution 신호.
 * @throws {TypeError} `inputs` 가 null / undefined 일 때(입력 계약 위반).
 */
export function computeContributionQualitySignal(
  inputs: EvaluationInput[],
): ContributionQualitySignal {
  if (inputs === null || inputs === undefined) {
    throw new TypeError(
      "computeContributionQualitySignal: inputs 는 null/undefined 일 수 없습니다",
    );
  }

  // author → 누적 상태. 최초 등장 순서 보존을 위해 order 배열을 병행한다.
  const accumulators = new Map<string, AuthorAccumulator>();
  const authorOrder: string[] = [];

  inputs.forEach((input) => {
    let acc = accumulators.get(input.author);
    if (acc === undefined) {
      acc = { author: input.author, zeroContributionUnitIds: [] };
      accumulators.set(input.author, acc);
      authorOrder.push(input.author);
    }

    const titleLength = resolveTitleLength(input);
    if (titleLength <= CONTRIBUTION_QUALITY_TITLE_FLOOR) {
      acc.zeroContributionUnitIds.push(input.unitId);
    }
  });

  const byAuthor = authorOrder.map((author) => {
    // Map 채움 직후 같은 키로 항상 존재 — non-null 단언 안전.
    const acc = accumulators.get(author) as AuthorAccumulator;
    const zeroContributionCount = acc.zeroContributionUnitIds.length;
    return {
      author: acc.author,
      zeroContributionCount,
      zeroContributionUnitIds: acc.zeroContributionUnitIds,
      zeroContribution: zeroContributionCount >= 1,
    };
  });

  const totalZeroContributionCount = byAuthor.reduce(
    (sum, entry) => sum + entry.zeroContributionCount,
    0,
  );

  return {
    totalUnitCount: inputs.length,
    totalZeroContributionCount,
    byAuthor,
    zeroContributionDetected: byAuthor.some((entry) => entry.zeroContribution),
  };
}

/**
 * 평가 입력 1 건의 title 길이(`metadata.titleLength`)를 결정적으로 산출한다.
 *
 * `metadata.titleLength`(scalar) 를 읽어 정규화한다:
 *   - 유한 number 면 `Math.floor` 후 음수는 0 으로 절하해 반환(2.9 → 2, -3 → 0).
 *   - titleLength 부재 / number 아님(string / boolean / null) → 0 fallback
 *     (`ActivityMetadataValue` union 전 시나리오 cover, throw 0).
 *   - `NaN` / `Infinity` / `-Infinity` → 0(유한성 검사).
 *
 * 0 흡수는 zero-contribution 식별과 정합한다 — title 신호 부재 / 비정상은 "제목조차
 * 없는 기계적 단위" 의 가장 강한 휴리스틱이므로 임계 이하 후보로 흡수된다.
 *
 * @param input 평가 단위 입력(`EvaluationInput`). `metadata.titleLength` 만 참조.
 * @returns ≥ 0 정수 title 길이. 산출 불가 / 비정상 신호는 모두 0.
 */
function resolveTitleLength(input: EvaluationInput): number {
  const titleLength = input.metadata.titleLength;
  // number 가 아닌 scalar(string / boolean / null) 또는 부재 → 0 fallback.
  if (typeof titleLength !== "number") {
    return 0;
  }
  // NaN / Infinity / -Infinity 같은 비유한 number → 0(방어).
  if (!Number.isFinite(titleLength)) {
    return 0;
  }
  // 음수는 0 으로 절하, 소수는 floor 정규화 → ≥ 0 정수 보장.
  const normalized = Math.floor(titleLength);
  return normalized > 0 ? normalized : 0;
}
