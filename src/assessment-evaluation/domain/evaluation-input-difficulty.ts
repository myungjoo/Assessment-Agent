// resolveInputDifficulty — 평가 항목 1 건의 **사전(routing 용) 난이도** 를 결정적으로
// 산출하는 순수 함수 (ADR-0065 § Decision 1 "㉠ metadata 기반 결정적 규칙 채택").
// 입력면은 ADR 이 고정한 대로 `contributionKind` · `sourceType` · `metadata` 로만
// 한정된다 — `narrative` · raw 본문 · 외부 조회 0 (REQ-032). evaluation-volume.ts 와
// 동형으로 의존성 0 (type import 뿐), NestJS DI decorator / Prisma / LLM 호출 0,
// throw 0, 부수효과 0 이라 LLM 응답과 무관하게 독립 검증된다. 반환값은 **routing 전용
// 신호** 이며 `EvaluationResult.difficulty` 에는 여전히 사후 `classifyNarrative` 결과가
// 기록된다 (ADR-0065 § Decision 2 (ii) 의 사전/사후 비대칭).

import type { Difficulty } from "../../llm/difficulty";

import type { EvaluationInput } from "./evaluation-input";

// 신호 부재 / 미인식 / 비정상 scalar 시 환원하는 중앙값 (ADR-0065 § Decision 1).
// evaluation-prompt.ts `32 행` 의 module-private `DEFAULT_DIFFICULTY` 와 같은 값이나,
// 그 파일을 수정 (export 승격) 하지 않기 위해 여기에 별도 정의한다.
export const DEFAULT_INPUT_DIFFICULTY: Difficulty = "medium";

// contributionKind 별 가중치 — code 기여가 문서 기여보다 상향 신호를 갖는다.
export const KIND_SCORE_CODE = 1;
export const KIND_SCORE_DOCUMENT = 0;

// metadata.titleLength 밴드 경계 (양 끝 포함): `<= EASY_MAX` → LOW, `>= HARD_MIN` →
// HIGH, 그 사이 → MID.
export const TITLE_LENGTH_EASY_MAX = 20;
export const TITLE_LENGTH_HARD_MIN = 80;
export const TITLE_SCORE_LOW = 0;
export const TITLE_SCORE_MID = 1;
export const TITLE_SCORE_HIGH = 2;

// 합산 점수 → 난이도 매핑 임계 (경계 포함).
export const EASY_SCORE_MAX = 0;
export const HARD_SCORE_MIN = 3;

/**
 * 평가 입력 1 건의 사전 난이도를 결정적으로 산출한다.
 *
 * v1 baseline 규칙 — `contributionKind` 가중치 + `metadata.titleLength` 밴드 점수를
 * 합산해 `<= EASY_SCORE_MAX` → `"easy"`, `>= HARD_SCORE_MIN` → `"hard"`, 나머지는
 * `"medium"` 으로 접는다.
 *
 * 환원 규칙 (ADR-0065 § Decision 1, throw 0): `titleLength` 가 부재하거나 number 가
 * 아니거나 (string / boolean / null) 비유한 (`NaN` / `Infinity`) 하거나 음수면 **정량
 * 신호 없음** 으로 보고 점수 계산 없이 {@link DEFAULT_INPUT_DIFFICULTY} 를 반환한다
 * (`metadata` 빈 객체 · 미인식 key 만 존재하는 경우 포함). 반환값은 어떤 입력에서도
 * 항상 `Difficulty` 집합 멤버다. `sourceType` 은 입력면에 포함되나 v1 은 신호로
 * 채택하지 않는다 — confluence 가 전량 document 라 `contributionKind` 와 공선이다.
 *
 * @param input 평가 단위 입력. `contributionKind` 와 `metadata` 만 참조한다.
 * @returns routing 용 사전 난이도 (`easy` | `medium` | `hard`).
 */
export function resolveInputDifficulty(input: EvaluationInput): Difficulty {
  const titleLength = input.metadata.titleLength;
  // number 아님 (부재 / string / boolean / null), 비유한, 음수 → 신호 없음 → 환원.
  if (
    typeof titleLength !== "number" ||
    !Number.isFinite(titleLength) ||
    titleLength < 0
  ) {
    return DEFAULT_INPUT_DIFFICULTY;
  }

  const kindScore =
    input.contributionKind === "code" ? KIND_SCORE_CODE : KIND_SCORE_DOCUMENT;

  let titleScore = TITLE_SCORE_MID;
  if (titleLength <= TITLE_LENGTH_EASY_MAX) {
    titleScore = TITLE_SCORE_LOW;
  } else if (titleLength >= TITLE_LENGTH_HARD_MIN) {
    titleScore = TITLE_SCORE_HIGH;
  }

  const score = kindScore + titleScore;
  if (score >= HARD_SCORE_MIN) {
    return "hard";
  }
  return score <= EASY_SCORE_MAX ? "easy" : DEFAULT_INPUT_DIFFICULTY;
}
