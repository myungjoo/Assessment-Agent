// EvaluationResult 도메인 타입 — P5 평가(scoring) 파이프라인의 공통 출력 단위
// (ADR-0032 Decision §3, evaluation slice 두 번째 impl). 평가 layer 가
// `EvaluationInput`(T-0287 박제)을 받아 산출하는 평가 결과 1 건의 정규화된 shape 다.
// 본 파일은 의존성 0 의 순수 타입 정의만 둔다 — NestJS `@Injectable` / Prisma /
// LLM gateway import 0. `evaluation-input.ts` 의 동형 패턴(union + const +
// `satisfies` compile-time 동기 + type-guard 순수 함수)을 정확히 mirror.
//
// 필드 산출 책임 분리(ADR-0032 §3):
//   - `narrative` / `difficulty` / `contribution` 3 종은 **LLM 정성 평가**(R-37/38
//     품질 분류) 결과 — 후속 scoring service slice(Follow-up §2, LLM `generate`
//     호출)가 채운다. 본 task 는 필드 존재만 박제, 값 산출 0.
//   - `volume` 1 종만 **metadata 기반 deterministic 수치**(ADR §3 "양은 metadata
//     기반 결정적 수치, LLM 무관"). `evaluation-volume.ts` 의 순수 함수가 채우는
//     유일 필드 — LLM mock 의존 0 으로 독립 검증 가능. R-26(코드 abusing) /
//     R-40(문서 abusing) 방지 metric 의 기반.
//
// REQ-032 raw-not-stored 불변(data-model.md §4): 본 타입도 commit message 전문 /
// diff / page 본문 HTML / issue body 같은 raw 본문을 **필드로 보유하지 않는다**.
// `narrative` 는 LLM 이 생성한 정성 평가문(생성 결과물, raw 인용 아님)이고, 나머지
// 필드는 식별자 / 분류 enum / 정량 수치만 담는다.

import type { Difficulty } from "../../llm/difficulty";

// ContributionLevel — 기여도 품질 분류 등급(ADR-0032 §3, R-37/38).
// `"zero"` : 단순 보고 / copy-paste 등 실질 기여 부재.
// `"low"` : 사소한 수정 / 기계적 변경.
// `"medium"` : 통상적 기능 구현 / 문서화.
// `"high"` : 새 알고리즘 / 외부 연구 도입 등 높은 난이도·창의 기여.
// `EvaluationInput.contributionKind`(code/document — 기여 category 축)와는 별도 —
// 본 union 은 기여 **품질** 축이다.
export type ContributionLevel = "zero" | "low" | "medium" | "high";

// CONTRIBUTION_LEVELS — ContributionLevel union 의 전 멤버를 배열로 노출하는 single
// source. scoring service 가 contribution 값 멤버십을 런타임 검증할 때 기준이 된다.
// `satisfies` 로 union 과 배열의 동기성(멤버 누락 / 오타)을 compile-time 강제한다
// (`evaluation-input.ts` CONTRIBUTION_KINDS 패턴 mirror).
export const CONTRIBUTION_LEVELS = [
  "zero",
  "low",
  "medium",
  "high",
] as const satisfies readonly ContributionLevel[];

// isContributionLevel — 임의 string 이 허용 contribution 등급 집합의 멤버인지
// 판정하는 순수 type-guard(`isContributionKind` 패턴 mirror). LLM 산출 / 저장 값의
// 유효성을 좁힐 때 사용한다.
export function isContributionLevel(value: string): value is ContributionLevel {
  return (CONTRIBUTION_LEVELS as readonly string[]).includes(value);
}

// EvaluationResult — 평가 단위 1 건의 정규화된 출력(ADR-0032 §3).
// 필드 5 종 모두 typed surface 위에 정의되며 raw 본문 키 부재가 type-level 로 보장
// 된다(REQ-032). `unitId` 로 `EvaluationInput` 과 trace 가능하다(결과 ↔ 입력 정합).
export interface EvaluationResult {
  // 평가 단위 고유 식별자 — `EvaluationInput.unitId` 와 정합(결과 ↔ 입력 trace).
  // `<sourceType>:<instanceKey>:<externalId>` 합성.
  unitId: string;
  // LLM 정성 평가문(`LlmGenerateResult.narrative` 그대로 수용). 본 타입의 필드
  // 존재만 박제 — 채우는 책임은 후속 scoring service slice(Follow-up §2).
  narrative: string;
  // 난이도 분류 결과(easy / medium / hard, `DIFFICULTIES` 정합). R-97 라우팅의
  // record 차원. scoring service 가 LLM 분류 결과로 채운다.
  difficulty: Difficulty;
  // 기여도 품질 분류(R-37/38 — zero / low / medium / high 4 등급). scoring service
  // 가 LLM 정성 평가로 채운다.
  contribution: ContributionLevel;
  // 양(deterministic 수치, ≥ 0 정수). 본 task 의 `calculateEvaluationVolume`
  // 순수 함수가 채우는 유일 필드 — LLM 무관.
  volume: number;
}
