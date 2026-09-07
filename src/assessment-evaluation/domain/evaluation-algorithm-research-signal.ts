// computeAlgorithmResearchSignal — "새 알고리즘 설계 · 새 일거리 구상 · 외부 연구
// 소개" 기여(README `38 행` R-38 / REQ-019)의 **상향 식별 축** 을 LLM 무관하게
// 결정적으로 산출하는 순수 domain helper. 한 batch 의 `EvaluationInput[]` 에서 수집
// 경계가 박제한 파생 scalar `metadata.algorithmResearchHits` 를 읽어 상향 후보 단위를
// 식별한다. 의존성 0 — NestJS `@Injectable` / Prisma / LLM gateway import 0, throw 0
// (명시적 null/undefined 입력 계약 위반 외), 부수효과 0(입력 비변형). 동일 입력은 항상
// 동일 출력이라 LLM 정성 평가와 분리해 독립 검증 가능하다.
//
// 정책 근거는 재서술하지 않고 좌표로만 참조한다 — 파생 scalar 경계 · number 인 이유
// (수집은 사실 수집기, 평가가 임계 소유자)는
// `docs/decisions/ADR-0064-algorithm-research-contribution-uplift.md` `§ Decision 1`,
// 대상 kind = document 한정 · 임계 2 · 보수 편향은 같은 ADR `§ Decision 2`, hits 0 이면
// mapper 가 **키 자체를 담지 않는다**(= 키 부재 = 미대상)는
// `src/assessment-collection/domain/confluence-activity.mapper.ts` `98~112 행`.
//
// 책임 경계(본 slice = detection 신호 산출만): container 필드 추가 · detection composer
// (`evaluation-detection-signals-pipeline.ts`) 배선은 ADR-0064 `§ Follow-ups (b) 잔여`,
// 등급 · 점수 상향 adjuster(`applyAlgorithmResearchUplift`) 는 같은 ADR
// `§ Follow-ups (c)` 의 책임이다. 본 helper 는 아무것도 소비하지 않으며
// `EvaluationInput` / `EvaluationResult` 타입 · collection-side mapper · marker 어휘
// 변경 0 이다.
//
// 패턴 mirror: evaluation-quality-signal.ts(author 그룹핑 + 등장 순서 보존 + Map 누적 +
// 임계 상수 + 비유한 number 0 흡수 + 한국어 TypeError guard) +
// evaluation-document-contribution-signal.ts(`"document"` 필터 관용구).

import type { EvaluationInput } from "./evaluation-input";

// ALGORITHM_RESEARCH_UPLIFT_MIN_HITS — 단위의 `metadata.algorithmResearchHits`
// (매칭된 marker 그룹 수 0~3)가 본 값 **이상(inclusive)** 이면 R-38 상향 후보로
// 식별한다. v1 baseline = 2 — "형식 축 필수 ∧ 주제 축 1+" 를 뜻하는 보수 경계다.
// 수집 layer 의 `ALGORITHM_RESEARCH_MIN_HITS` 를 **import 하지 않고** 평가 layer 안에
// 독립 정의하는 이유: ADR-0064 `§ Decision 1` 이 "mapper 는 사실 수집기, 평가 layer 가
// 판정자·임계 소유자" 로 경계를 그었기 때문이다. 두 상수가 우연히 같은 값이어도
// 소유자가 다르므로 각자의 layer 에서 독립적으로 calibration 된다.
export const ALGORITHM_RESEARCH_UPLIFT_MIN_HITS = 2;

// AlgorithmResearchEntry — 한 author 의 알고리즘 · 연구 소개 상향 신호 집계.
export interface AlgorithmResearchEntry {
  // author 외부 식별자.
  author: string;
  // 이 author 의 단위 중 상향 후보로 식별된 단위 수.
  algorithmResearchUnitCount: number;
  // 상향 후보로 식별된 단위의 unitId 목록. 입력 등장 순서를 보존한다(결정성).
  algorithmResearchUnitIds: string[];
  // 1 건 이상 상향 후보가 식별됐는지 — algorithmResearchUnitCount ≥ 1.
  algorithmResearch: boolean;
}

// AlgorithmResearchSignal — 산출 타입. author 별 신호 배열 + batch 차원 식별 여부.
export interface AlgorithmResearchSignal {
  // 평가 대상 전체 단위 수(입력 배열 길이).
  totalUnitCount: number;
  // 상향 후보로 식별된 단위의 총 수(전 author 합).
  totalAlgorithmResearchCount: number;
  // author 별 신호. author 의 최초 등장 순서 기준으로 안정적·결정적 정렬.
  byAuthor: AlgorithmResearchEntry[];
  // batch 차원 식별 여부 — byAuthor 중 1 명이라도 algorithmResearch=true 면 true.
  algorithmResearchDetected: boolean;
}

// 내부 author 누적 상태. algorithmResearchUnitIds 는 등장 순서대로 push 한다.
interface AuthorAccumulator {
  author: string;
  algorithmResearchUnitIds: string[];
}

/**
 * 한 batch 의 평가 입력에서 알고리즘 · 연구 소개 상향 후보 신호를 결정적으로
 * 산출한다(R-38 / REQ-019 detection layer).
 *
 * 알고리즘(결정적·LLM 무관): 입력을 author 별로 그룹핑하고(최초 등장 순서 보존),
 * 각 단위가 **3 조건을 동시 충족** 하면 해당 author 의 algorithmResearchUnitIds 에
 * 등장 순서대로 추가한다 — (i) `contributionKind === "document"`(code / 예상 외
 * kind 제외) ∧ (ii) `metadata.algorithmResearchHits` 가 유한 number ∧ (iii) 그 값이
 * ALGORITHM_RESEARCH_UPLIFT_MIN_HITS **이상**(경계 inclusive). 이어서 author 별
 * count / boolean 축약과 batch 차원 detected · total 을 산출한다.
 *
 * 방어: 빈 배열 → 카운트 0 · byAuthor [] · detected false. hits 키 부재 / 비-number /
 * 비유한 number 는 `resolveAlgorithmResearchHits` 가 0 으로 흡수해 조용히 제외한다
 * (throw 0 — 한 malformed 단위가 batch 전체를 깨지 않게). 입력 배열·원소는 변형하지
 * 않고 새 객체만 반환한다. `inputs` 자체가 null/undefined 인 계약 위반만 명시적 한국어
 * `TypeError` 로 throw 한다(유일한 throw 경로).
 *
 * @param inputs 평가 입력 배열(`EvaluationInput[]`). 변형하지 않는다.
 * @returns author 별 + batch 차원 알고리즘 · 연구 소개 상향 신호.
 * @throws {TypeError} `inputs` 가 null / undefined 일 때(입력 계약 위반).
 */
export function computeAlgorithmResearchSignal(
  inputs: EvaluationInput[],
): AlgorithmResearchSignal {
  if (inputs === null || inputs === undefined) {
    throw new TypeError(
      "computeAlgorithmResearchSignal: inputs 는 null/undefined 일 수 없습니다",
    );
  }

  // author → 누적 상태. 최초 등장 순서 보존을 위해 order 배열을 병행한다.
  const accumulators = new Map<string, AuthorAccumulator>();
  const authorOrder: string[] = [];

  inputs.forEach((input) => {
    let acc = accumulators.get(input.author);
    if (acc === undefined) {
      acc = { author: input.author, algorithmResearchUnitIds: [] };
      accumulators.set(input.author, acc);
      authorOrder.push(input.author);
    }

    // (i) document 축만 대상 — code / 예상 외 kind 는 조용히 제외(throw 0).
    if (input.contributionKind !== "document") {
      return;
    }
    // (ii)(iii) 유한 number 로 정규화한 hits 가 임계 이상(inclusive)인지.
    if (
      resolveAlgorithmResearchHits(input) >= ALGORITHM_RESEARCH_UPLIFT_MIN_HITS
    ) {
      acc.algorithmResearchUnitIds.push(input.unitId);
    }
  });

  const byAuthor = authorOrder.map((author) => {
    // Map 채움 직후 같은 키로 항상 존재 — non-null 단언 안전.
    const acc = accumulators.get(author) as AuthorAccumulator;
    const algorithmResearchUnitCount = acc.algorithmResearchUnitIds.length;
    return {
      author: acc.author,
      algorithmResearchUnitCount,
      algorithmResearchUnitIds: acc.algorithmResearchUnitIds,
      algorithmResearch: algorithmResearchUnitCount >= 1,
    };
  });

  const totalAlgorithmResearchCount = byAuthor.reduce(
    (sum, entry) => sum + entry.algorithmResearchUnitCount,
    0,
  );

  return {
    totalUnitCount: inputs.length,
    totalAlgorithmResearchCount,
    byAuthor,
    algorithmResearchDetected: byAuthor.some(
      (entry) => entry.algorithmResearch,
    ),
  };
}

/**
 * 파생 scalar `metadata.algorithmResearchHits` 를 결정적으로 정규화한다(수집-side
 * 의미 = 매칭된 marker 그룹 수 0~3, `algorithm-research-signal.ts` `55~64 행`).
 * 유한 number 는 `Math.floor` 후 음수를 0 으로 절하하고(2.9 → 2, -3 → 0), 키 부재 /
 * 비-number(string / boolean / null) / 비유한 number 는 모두 0 으로 흡수한다
 * (`ActivityMetadataValue` union 전 시나리오 cover, throw 0). 0 흡수는 보수 편향과
 * 정합한다 — 신호 부재 · 비정상은 임계 미만이라 상향 후보에서 조용히 빠진다.
 *
 * @param input 평가 단위 입력. `metadata.algorithmResearchHits` 만 참조.
 * @returns ≥ 0 정수 hits. 산출 불가 / 비정상 신호는 모두 0.
 */
function resolveAlgorithmResearchHits(input: EvaluationInput): number {
  const hits = input.metadata.algorithmResearchHits;
  // number 가 아닌 scalar(string / boolean / null) 또는 키 부재 → 0 fallback.
  if (typeof hits !== "number") {
    return 0;
  }
  // NaN / Infinity / -Infinity 같은 비유한 number → 0(방어).
  if (!Number.isFinite(hits)) {
    return 0;
  }
  // 음수는 0 으로 절하, 소수는 floor 정규화 → ≥ 0 정수 보장.
  const normalized = Math.floor(hits);
  return normalized > 0 ? normalized : 0;
}
