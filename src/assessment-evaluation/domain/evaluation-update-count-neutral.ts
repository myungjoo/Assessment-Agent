// computeUpdateCountNeutralization — P5 문서 update 횟수 중립화 detection 의 결정적
// 순수 domain helper (R-41 / REQ-022: "습관적 중간 저장으로 update 횟수만 늘어나는
// 경우 advantage / disadvantage 둘 다 없어야"). 한 batch 의 `EvaluationInput[]`
// 에서 document 단위의 update 횟수(Confluence page `version`, metadata.version)가
// 임계 이상 부풀려진 단위를 **중립 대상(neutralized)** 으로 결정적으로 식별한다.
// 본 파일은 의존성 0 의 순수 함수만 둔다 — NestJS `@Injectable` / Prisma / LLM
// gateway import 0, throw 0(명시적 null/undefined 입력 계약 위반 외), 부수효과 0
// (referential transparency, 입력 비변형). 동일 입력은 항상 동일 출력 — LLM 정성
// 평가와 분리해 독립 검증 가능하다(ADR-0032 §3 "양은 metadata 기반 deterministic
// 수치, LLM 무관" 정신과 정합).
//
// R-41 vs R-26/R-40 의미 분리(별도 신호인 이유):
//   - R-26(코드 abusing) / R-40(문서 abusing)은 **감점** 신호다(computeAbuseSignal).
//   - R-41(update 횟수 중립화)은 **중립(net 0 — 보너스도 페널티도 없음)** 신호다.
//     중간 저장을 반복해 version 만 부풀려도 그것이 평가 양 / 점수에 유리하게도
//     불리하게도 작용하지 않도록 식별만 한다. 의미가 달라 별도 신호로 분리한다.
//
// 책임 경계(본 task = detection layer 만, Out of Scope):
//   - 본 helper 는 신호만 산출한다. version 부풀림 단위의 volume 중립화 / 점수 net 0
//     반영은 후속 scoring service slice 가 본 신호를 소비해 처리한다(별도 task —
//     T-0522/T-0523 가 abuse 신호에 했던 소비·배선 패턴 mirror).
//   - `evaluation-volume.ts`(volume 산출) 변경 0 — R-41 은 "유리하지도 불리하지도
//     않게" 이므로 volume 가산이 아니라 중립 식별이 목적이다. version 을 volume 에
//     반영하는 것은 R-41 정신 위반이다(Out of Scope).
//
// 패턴 mirror: evaluation-abuse-signal.ts(순수 함수 + author 그룹핑 + 최초 등장 순서
// 보존 결정성 + 입력 비변형 + Map 누적 + 비유한 number 방어).

import type { EvaluationInput } from "./evaluation-input";

// UPDATE_COUNT_NEUTRAL_THRESHOLD — document 단위의 update 횟수(version)가 본 값
// 이상이면 "update 횟수만 부풀려진 단위" 로 분류해 중립 대상(neutralized=true)으로
// 식별한다. v1 baseline = 5. 근거: 정상적인 문서 1 건은 초안 → 검토 반영 → 마무리
// 수준의 소수 version(통상 1~4)에 머문다. 5 회 이상의 저장 이력은 "습관적 중간 저장"
// (R-41) 의 휴리스틱 경계로, 그 자체가 기여 양 / 질의 증거가 아니므로 중립화 후보로
// 본다. 경계값은 추후 dogfood 실측으로 조정 가능(LLM 무관 deterministic 상수).
export const UPDATE_COUNT_NEUTRAL_THRESHOLD = 5;

// UpdateCountNeutralEntry — 한 author 의 update 횟수 중립화 신호 집계.
export interface UpdateCountNeutralEntry {
  // author 외부 식별자.
  author: string;
  // 이 author 의 document 단위 중 version 임계 이상으로 식별된(중립 대상) 단위 수.
  neutralizedCount: number;
  // 중립 대상으로 식별된 단위의 unitId 목록. 입력 등장 순서를 보존한다(결정성).
  neutralizedUnitIds: string[];
  // 이 author 에 대해 1 건 이상 중립 대상이 식별됐는지 — neutralizedCount ≥ 1.
  neutralized: boolean;
}

// UpdateCountNeutralization — computeUpdateCountNeutralization 의 산출 타입.
// author 별 신호 배열 + batch 차원 식별 여부.
export interface UpdateCountNeutralization {
  // 평가 대상 전체 단위 수(입력 배열 길이).
  totalUnitCount: number;
  // 중립 대상으로 식별된 단위의 총 수(전 author 합).
  totalNeutralizedCount: number;
  // author 별 신호. author 의 최초 등장 순서 기준으로 안정적·결정적 정렬.
  byAuthor: UpdateCountNeutralEntry[];
  // batch 차원 식별 여부 — byAuthor 중 1 명이라도 neutralized=true 면 true.
  neutralized: boolean;
}

// 내부 author 누적 상태. neutralizedUnitIds 는 등장 순서대로 push 한다.
interface AuthorAccumulator {
  author: string;
  neutralizedUnitIds: string[];
}

/**
 * 한 batch 의 평가 입력에서 문서 update 횟수 중립화 신호를 결정적으로 산출한다
 * (R-41 / REQ-022 detection layer).
 *
 * 알고리즘(결정적·LLM 무관):
 *   1. 입력을 author 별로 그룹핑한다(최초 등장 순서 보존).
 *   2. 각 단위가 document 기여(`contributionKind === "document"`)이고 update 횟수
 *      (`resolveUpdateCount`)가 UPDATE_COUNT_NEUTRAL_THRESHOLD 이상이면 그 단위를
 *      중립 대상으로 식별하고 해당 author 의 neutralizedUnitIds 에 등장 순서대로
 *      추가한다.
 *   3. code 단위(contributionKind !== "document")는 version 무관하게 식별 대상이
 *      아니다(R-41 은 문서 update 횟수에 한정).
 *   4. author 별 neutralizedCount / neutralized(≥ 1) 를 축약하고 batch 차원
 *      neutralized(author 중 1 명이라도 식별) 와 totalNeutralizedCount 를 산출한다.
 *
 * 방어:
 *   - 빈 배열 → totalUnitCount 0, byAuthor [], neutralized false.
 *   - `metadata.version` 누락 / 비-number(string/boolean/null) / 비유한
 *     number(NaN/Infinity) / 0 / 음수는 `resolveUpdateCount` 가 0 으로 흡수한다 —
 *     throw 없이 중립 미식별(임계 미달)로 처리된다.
 *   - 입력 배열·원소를 변형하지 않고 새 객체만 반환한다(부수효과 0).
 *   - `inputs` 자체가 null/undefined 인 입력 계약 위반은 명시적 한국어 `TypeError`
 *     로 throw 한다(조용한 오작동 차단 — 유일한 throw 경로).
 *
 * @param inputs 평가 입력 배열(`EvaluationInput[]`). 변형하지 않는다.
 * @returns author 별 + batch 차원 update 횟수 중립화 신호.
 * @throws {TypeError} `inputs` 가 null / undefined 일 때(입력 계약 위반).
 */
export function computeUpdateCountNeutralization(
  inputs: EvaluationInput[],
): UpdateCountNeutralization {
  if (inputs === null || inputs === undefined) {
    throw new TypeError(
      "computeUpdateCountNeutralization: inputs 는 null/undefined 일 수 없습니다",
    );
  }

  // author → 누적 상태. 최초 등장 순서 보존을 위해 order 배열을 병행한다.
  const accumulators = new Map<string, AuthorAccumulator>();
  const authorOrder: string[] = [];

  inputs.forEach((input) => {
    let acc = accumulators.get(input.author);
    if (acc === undefined) {
      acc = { author: input.author, neutralizedUnitIds: [] };
      accumulators.set(input.author, acc);
      authorOrder.push(input.author);
    }

    // code 단위는 version 무관하게 식별 대상이 아니다(R-41 문서 한정).
    if (input.contributionKind !== "document") {
      return;
    }

    const updateCount = resolveUpdateCount(input);
    if (updateCount >= UPDATE_COUNT_NEUTRAL_THRESHOLD) {
      acc.neutralizedUnitIds.push(input.unitId);
    }
  });

  const byAuthor = authorOrder.map((author) => {
    // Map 채움 직후 같은 키로 항상 존재 — non-null 단언 안전.
    const acc = accumulators.get(author) as AuthorAccumulator;
    const neutralizedCount = acc.neutralizedUnitIds.length;
    return {
      author: acc.author,
      neutralizedCount,
      neutralizedUnitIds: acc.neutralizedUnitIds,
      neutralized: neutralizedCount >= 1,
    };
  });

  const totalNeutralizedCount = byAuthor.reduce(
    (sum, entry) => sum + entry.neutralizedCount,
    0,
  );

  return {
    totalUnitCount: inputs.length,
    totalNeutralizedCount,
    byAuthor,
    neutralized: byAuthor.some((entry) => entry.neutralized),
  };
}

/**
 * 평가 입력 1 건의 update 횟수(Confluence page version)를 결정적으로 산출한다.
 *
 * `metadata.version`(scalar) 를 읽어 정규화한다:
 *   - 유한 number 면 `Math.floor` 후 음수는 0 으로 절하해 반환(2.9 → 2, -3 → 0).
 *   - version 부재 / number 아님(string / boolean / null) → 0 fallback
 *     (`ActivityMetadataValue` union 전 시나리오 cover, throw 0).
 *   - `NaN` / `Infinity` / `-Infinity` → 0(유한성 검사).
 *
 * 비-Confluence document(예: GitHub issue) 는 version metadata 가 부재하므로 0 으로
 * 흡수되어 자연히 중립 미식별 처리된다(임계 미달).
 *
 * @param input 평가 단위 입력(`EvaluationInput`). `metadata.version` 만 참조한다.
 * @returns ≥ 0 정수 update 횟수. 산출 불가 / 비정상 신호는 모두 0.
 */
function resolveUpdateCount(input: EvaluationInput): number {
  const version = input.metadata.version;
  // number 가 아닌 scalar(string / boolean / null) 또는 부재 → 0 fallback.
  if (typeof version !== "number") {
    return 0;
  }
  // NaN / Infinity / -Infinity 같은 비유한 number → 0(방어).
  if (!Number.isFinite(version)) {
    return 0;
  }
  // 음수는 0 으로 절하, 소수는 floor 정규화 → ≥ 0 정수 보장.
  const normalized = Math.floor(version);
  return normalized > 0 ? normalized : 0;
}
