// computeDocumentContributionSignal — P5 "문서를 통한 조직 기여" 식별 detection 의
// 결정적 순수 domain helper (README 39 행 / REQ-020: "조직에 큰 기여를 문서를 통해
// 한 인원에게 더 높은 점수와 더 높은 평가 코멘트"). 한 batch 의 `EvaluationInput[]`
// 에서 **문서 기여 단위 수가 batch 동료 평균 대비 현격히 높은 author** 를 LLM 무관
// 하게 결정적으로 식별한다. 본 파일은 의존성 0 의 순수 함수만 둔다 — NestJS
// `@Injectable` / Prisma / LLM gateway import 0, throw 0(명시적 null/undefined 입력
// 계약 위반 외), 부수효과 0(referential transparency, 입력 비변형). 동일 입력은
// 항상 동일 출력 — LLM 정성 평가와 분리해 독립 검증 가능하다(ADR-0032 §3 "metric
// 수치 신호는 LLM 정성과 분리해 결정적으로" 정신과 정합).
//
// 왜 별도의 문서 축 신호인가:
//   - 기존 `evaluation-notable-contribution-signal.ts` 는 `contributionKind ===
//     "code"` 단위만 세고 주석으로 "document 제외 … document 축은 별도 신호" 라고
//     경계를 자인한다. README 39 행 의 조직 기여는 **문서 축** 을 명시적으로 요구
//     하므로, 코드 축 신호를 오염시키지 않는 대칭 신호를 별도 파일로 신설한다.
//   - 본 신호는 "양" 축이며(문서 단위 수), "조직에 큰 기여" 의 정성 의미는 후속
//     enrich + LLM 정성 신호 결합으로 강화된다(Follow-ups 참조).
//
// 판정 알고리즘 · 방어 계약의 전문은 아래 함수 JSDoc 에 둔다(중복 서술 회피). 여기
// 에는 그 선택의 **근거** 만 남긴다:
//   - 기준값으로 mean 채택 — 전 author 합/author 수로 1 줄 결정적 산출이 가능해
//     spec 이 명료하고(median 은 정렬 + 짝수 길이 중앙값 평균 분기로 spec surface 가
//     넓다), batch 동료 대비 "현격히 높음" 의 직관과 부합한다.
//   - 보수성 원칙(휴리스틱 과확장 금지) — v1 은 동료 평균 대비 상대 비교 1 신호로
//     한정하고 임계 **초과(strictly greater)** 만 대상으로 삼는다. 평균 근처의 정상
//     변동을 notable 로 오분류하는 false-positive 위험을 최소화한다. metadata
//     enrich(문서 분량·조회 수 등) 후 가중치 신호는 Follow-up.
//   - 경계의 보수 분류 — 단독 author batch / 평균 0(전원 문서 기여 0)은 비교 대상이
//     없거나 전원 동일해 "현격히 높은" 대상이 성립하지 않으므로 notable 0.
//   - code 단위는 문서 기여 정량에서 제외 — 축 오염 차단(code 축은 notable
//     contribution signal 의 책임). 예상 외 kind 도 단순 제외한다(throw 0).
//
// 책임 경계(본 task = detection layer 만, Out of Scope):
//   - 본 helper 는 신호만 산출한다. 문서 축 notable author 의 점수·narrative 상향
//     (소비) / `evaluation-detection-signals-pipeline.ts` 배선은 후속 task 가 본
//     신호를 소비해 처리한다(detection → consume → orchestrator 3-slice 패턴).
//   - `EvaluationInput` / `EvaluationResult` / `ContributionKind` 타입 변경 0.
//
// 패턴 mirror: evaluation-notable-contribution-signal.ts(순수 함수 + author 그룹핑
// + 최초 등장 순서 보존 결정성 + 입력 비변형 + Map 누적 + 임계 상수 + detection-only
// 책임 경계 — 본 helper 는 그 문서 축 대응) + evaluation-underperformer-signal.ts
// (임계 상수 서술 톤).

import type { EvaluationInput } from "./evaluation-input";

// DOCUMENT_CONTRIBUTION_RELATIVE_CEILING — author 의 documentUnitCount 가 batch
// 평균(meanDocumentUnitCount) × 본 값 **초과(strictly greater)** 면 "동료 대비 문서
// 기여가 현격히 높은" notable 후보로 식별한다. v1 baseline = 1.5(동료 평균의 1.5 배
// 초과) — notable code 축의 NOTABLE_RELATIVE_CEILING 과 동일한 보수 경계를 택해 두
// 축의 판정 강도를 대칭으로 맞춘다. 근거: 평균의 1.5 배 초과는 "현격히 높은" 의
// 직관과 부합하면서, 평균 근처의 정상 변동을 notable 로 오분류하지 않는 보수적
// 경계다. 보수적 경계는 명백한 대상만 걸러 false-positive 가 최소화된다 — 추후
// dogfood 실측 후 calibration 가능(LLM 무관 deterministic 상수, 1 이상 비율).
export const DOCUMENT_CONTRIBUTION_RELATIVE_CEILING = 1.5;

// DocumentContributionEntry — 한 author 의 문서 축 기여 신호 집계.
export interface DocumentContributionEntry {
  // author 외부 식별자.
  author: string;
  // 이 author 의 `contributionKind === "document"` 단위 수(code 제외).
  documentUnitCount: number;
  // 이 author 가 문서 축 notable(동료 평균 × CEILING 초과)로 식별됐는지.
  notable: boolean;
}

// DocumentContributionSignal — computeDocumentContributionSignal 의 산출 타입.
// author 별 신호 배열 + batch 차원 식별 여부 + 기준값.
export interface DocumentContributionSignal {
  // 평가 대상 author 수(distinct author 수).
  totalAuthorCount: number;
  // batch 기준값 — 전 author documentUnitCount 의 평균(mean). author 0 명이면 0.
  meanDocumentUnitCount: number;
  // author 별 신호. author 의 최초 등장 순서 기준으로 안정적·결정적 정렬.
  byAuthor: DocumentContributionEntry[];
  // batch 차원 식별 여부 — byAuthor 중 1 명이라도 notable=true 면 true.
  notableDetected: boolean;
}

// 내부 author 누적 상태. documentUnitCount 는 document 단위 등장마다 누적한다.
interface AuthorAccumulator {
  author: string;
  documentUnitCount: number;
}

/**
 * 한 batch 의 평가 입력에서 문서 축 조직 기여(문서 기여가 동료 평균 대비 현격히
 * 높은 author) 신호를 결정적으로 산출한다(README 39 행 / REQ-020 detection layer).
 *
 * 알고리즘(결정적·LLM 무관):
 *   1. 입력을 author 별로 그룹핑한다(최초 등장 순서 보존). 각 author 의
 *      `contributionKind === "document"` 단위 수(documentUnitCount)를 센다(code
 *      제외).
 *   2. 전 author documentUnitCount 의 평균(meanDocumentUnitCount)을 산출한다.
 *   3. 비교가 의미 있는 batch(author ≥ 2 명 AND 평균 > 0)에서만 documentUnitCount
 *      가 meanDocumentUnitCount × DOCUMENT_CONTRIBUTION_RELATIVE_CEILING
 *      **초과(strictly greater)** 인 author 를 notable 로 식별한다. 단독 author /
 *      평균 0 batch 는 보수적으로 notable 0(비교 대상 없음 / 전원 동일 —
 *      false-positive 회피).
 *   4. author 별 notable 을 축약하고 batch 차원 notableDetected /
 *      totalAuthorCount / meanDocumentUnitCount 를 산출한다.
 *
 * 방어:
 *   - 빈 배열 → totalAuthorCount 0, byAuthor [], notableDetected false,
 *     meanDocumentUnitCount 0.
 *   - 입력 배열·원소를 변형하지 않고 새 객체만 반환한다(부수효과 0).
 *   - `inputs` 자체가 null/undefined 인 입력 계약 위반은 명시적 한국어 `TypeError`
 *     로 throw 한다(조용한 오작동 차단 — 유일한 throw 경로).
 *
 * @param inputs 평가 입력 배열(`EvaluationInput[]`). 변형하지 않는다.
 * @returns author 별 + batch 차원 문서 축 기여 신호.
 * @throws {TypeError} `inputs` 가 null / undefined 일 때(입력 계약 위반).
 */
export function computeDocumentContributionSignal(
  inputs: EvaluationInput[],
): DocumentContributionSignal {
  if (inputs === null || inputs === undefined) {
    throw new TypeError(
      "computeDocumentContributionSignal: inputs 는 null/undefined 일 수 없습니다",
    );
  }

  // author → 누적 상태. 최초 등장 순서 보존을 위해 order 배열을 병행한다.
  const accumulators = new Map<string, AuthorAccumulator>();
  const authorOrder: string[] = [];

  inputs.forEach((input) => {
    let acc = accumulators.get(input.author);
    if (acc === undefined) {
      acc = { author: input.author, documentUnitCount: 0 };
      accumulators.set(input.author, acc);
      authorOrder.push(input.author);
    }

    // 문서 기여 정량 — `"document"` 단위만 카운트(code / 예상 외 kind 는 제외).
    if (input.contributionKind === "document") {
      acc.documentUnitCount += 1;
    }
  });

  const totalAuthorCount = authorOrder.length;

  // batch 기준값 — 전 author documentUnitCount 평균. author 0 명이면 0(분모 보호).
  const totalDocumentUnitCount = authorOrder.reduce((sum, author) => {
    const acc = accumulators.get(author) as AuthorAccumulator;
    return sum + acc.documentUnitCount;
  }, 0);
  const meanDocumentUnitCount =
    totalAuthorCount > 0 ? totalDocumentUnitCount / totalAuthorCount : 0;

  // 비교가 의미 있는 경계 — author ≥ 2 명 AND 평균 > 0. 단독 author(비교 대상 없음)
  // / 평균 0(전원 문서 기여 0, 전원 동일)은 보수적으로 notable 0.
  const comparable = totalAuthorCount >= 2 && meanDocumentUnitCount > 0;
  const ceiling =
    meanDocumentUnitCount * DOCUMENT_CONTRIBUTION_RELATIVE_CEILING;

  const byAuthor = authorOrder.map((author) => {
    // Map 채움 직후 같은 키로 항상 존재 — non-null 단언 안전.
    const acc = accumulators.get(author) as AuthorAccumulator;
    const notable = comparable && acc.documentUnitCount > ceiling;
    return {
      author: acc.author,
      documentUnitCount: acc.documentUnitCount,
      notable,
    };
  });

  return {
    totalAuthorCount,
    meanDocumentUnitCount,
    byAuthor,
    notableDetected: byAuthor.some((entry) => entry.notable),
  };
}
