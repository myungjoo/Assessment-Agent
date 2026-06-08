// evaluation-prompt — P5 평가 scoring 의 LLM-무관 순수 함수 2 종
// (ADR-0032 Decision §2 LLM scoring 입력 shape + §3 난이도·기여도 output 산출).
// (1) `buildEvaluationPrompt` — `EvaluationInput` 의 typed 필드만으로 결정적
//     prompt 문자열을 조립한다(REQ-032 raw-not-stored — commit message 전문 /
//     issue body / page 본문 HTML 절대 미포함). (2) `classifyNarrative` — LLM
//     `narrative`(`LlmGenerateResult.narrative`, string) 를 `difficulty`(R-97
//     routing) + `contribution`(R-37/38 품질 분류)로 결정적으로 환원한다.
//
// 본 파일은 의존성 0 의 순수 함수만 둔다 — NestJS `@Injectable` / Prisma / LLM
// gateway import 0, 실 LLM `generate` 호출 0, mock `generate` 0, throw 0, 부수효과
// 0. 동일 입력은 항상 동일 출력(referential transparency) — LLM 의존 0 으로 독립
// 검증 가능. `evaluation-volume.ts`(순수 함수 + 방어적 입력 처리 + JSDoc 확장 여지)
// 패턴을 정확히 mirror 한다.
//
// 책임 경계(ADR-0032 Follow-up §2): 본 두 함수는 LLM 호출 전(prompt 조립)·후(분류
// 파싱)의 결정적 변환만 담당한다. `LlmHttpGateway.generate` 호출 / `options.
// difficulty` 주입(R-97 routing) / `EvaluationResult`(narrative + difficulty +
// contribution + volume) 최종 조립은 후속 scoring service slice 가 본 두 함수 +
// `calculateEvaluationVolume`(T-0288)을 compose 한다. `generate` 시그니처는 무변경
// 재사용(interface 확장 0) — service 가 분류 결과를 `options.difficulty` 로 넘긴다.

import type { Difficulty } from "../../llm/difficulty";
import { isDifficulty } from "../../llm/difficulty";

import type { EvaluationInput } from "./evaluation-input";
import type { ContributionLevel } from "./evaluation-result";
import { isContributionLevel } from "./evaluation-result";

// classifyNarrative 의 marker 부재 / 미인식 값 fallback default(ADR-0032 §3 —
// throw 0, 항상 허용 집합 멤버 반환). 보수적 중앙값으로 잡아 LLM 출력 누락이 극단
// 분류로 새지 않게 한다.
const DEFAULT_DIFFICULTY: Difficulty = "medium";
const DEFAULT_CONTRIBUTION: ContributionLevel = "low";

// classifyNarrative 가 prompt 출력 측에서 인식하는 구조적 marker 의 key 토큰.
// case-insensitive 매칭(아래 정규식의 `i` flag). buildEvaluationPrompt 의 출력
// 형식과 의도적으로 정합 — prompt 는 단일 line comma 형식
// (`difficulty: <...>, contribution: <...>`)을 LLM 에게 요청한다.
//
// marker 는 `\b` 단어 경계로만 anchor 하므로 (1) line-separated 형식
// (`difficulty: hard\ncontribution: high`) 과 (2) inline comma 형식
// (`difficulty: hard, contribution: high`) 을 **모두** 매칭한다 — line 시작
// anchor(`^|\n`)를 쓰면 inline 형식의 두 번째 marker(`, contribution:`)가
// 매칭되지 않아 prompt↔parser 가 compose 되지 않는 결함이 발생했다(round 1 MAJOR).
// 캡처 토큰은 비공백/비콤마 시퀀스이며, extractMarker 가 추가로 둘러싼 구두점을
// 벗긴다(trailing comma / period 등).
// 콜론 뒤 공백은 수평 공백([^\S\n])만 허용 — newline 을 넘어 다음 line 의 다른
// key(`contribution:`)를 difficulty 값으로 잘못 캡처하지 않게 한다(빈 marker 값
// 방어). 캡처 토큰은 비공백/비콤마 시퀀스.
const DIFFICULTY_MARKER = /\bdifficulty[^\S\n]*:[^\S\n]*([^\s,\n]+)/i;
const CONTRIBUTION_MARKER = /\bcontribution[^\S\n]*:[^\S\n]*([^\s,\n]+)/i;

// 캡처 토큰에서 벗겨낼 둘러싼 구두점(앞뒤 콤마 / 마침표 / 세미콜론 / 콜론 /
// 괄호 / 따옴표 등). isDifficulty / isContributionLevel 좁히기 전에 적용해
// `hard,` / `high.` 같은 토큰이 허용 집합 매칭에서 누락되지 않게 한다(round 1 NIT).
const SURROUNDING_PUNCTUATION = /^[\s,.;:'"()[\]]+|[\s,.;:'"()[\]]+$/g;

// REQ-032 방어 메모: metadata 에서 prompt 에 넣을 때 raw 본문 인용으로 오인될 수
// 있는 키(`body` / `html` / `message` / `diff` / `content` 등)의 **값 전문**은
// prompt 에 절대 직렬화하지 않는다. 본 builder 는 metadata 에서 `titleLength`
// (number) 단일 신호만 읽으므로, 다른 키는 값 자체를 읽지 않아 누출이 구조적으로
// 불가능하다(blacklist 순회가 아니라 whitelist 단일 신호 읽기로 방어).

/**
 * 평가 입력 1 건을 결정적 prompt 문자열로 조립한다(ADR-0032 §2).
 *
 * 포함 신호(typed 필드만 — raw 본문 0, REQ-032):
 *   - `contributionKind`(code / document) — 기여 category.
 *   - `sourceType`(github / confluence) — 수집 출처.
 *   - `timestamp`(ISO-8601) — 활동 발생 시각.
 *   - `metadata.titleLength`(number 일 때만) — 유일 정량 scalar 신호. number 가
 *     아니거나 부재면 신호 line 을 생략한다(throw 0).
 *
 * raw 0 보장: `EvaluationInput` 에 raw 본문 필드가 없어 구조적으로 불가하나,
 * `metadata` 의 임의 scalar 값은 prompt 에 직렬화하지 않는다(titleLength number 만
 * 사용). `body` / `html` / `message` / `diff` / `content` 같은 raw-오인 키가
 * 들어와도 그 값 전문은 prompt 에 등장하지 않는다(whitelist 단일 신호 읽기 —
 * 값을 읽지 않으므로 누출 0).
 *
 * 동일 입력 → 동일 prompt(determinism, LLM 의존 0). 출력은 `difficulty:` /
 * `contribution:` 두 분류축을 LLM 에게 요청하는 instruction line 을 포함해
 * `classifyNarrative` 의 marker 추출과 형식 정합한다.
 *
 * 확장 여지: v1 은 typed 필드 직렬화 baseline 이다. 구조화 JSON 출력 강제 / 별도
 * structured-output prompt 전략은 후속 scoring service slice 또는 별도 ADR 가
 * 정밀화한다(LLM 호출 / mock 도입 금지 원칙 유지).
 *
 * @param input 평가 단위 입력(`EvaluationInput`). typed 필드만 참조한다.
 * @returns 결정적 prompt 문자열. raw 본문 0.
 */
export function buildEvaluationPrompt(input: EvaluationInput): string {
  const lines: string[] = [
    "다음 기여 활동을 평가하라.",
    `contributionKind: ${input.contributionKind}`,
    `sourceType: ${input.sourceType}`,
    `timestamp: ${input.timestamp}`,
  ];

  // metadata.titleLength 는 number 일 때만 신호로 포함(비-number / 부재 → 생략).
  // raw-오인 키(body/html/message/diff/content 등)의 값은 일절 읽지 않으므로
  // prompt 에 raw 누출이 없다(REQ-032 방어 — whitelist 단일 신호 읽기).
  const titleLength = input.metadata.titleLength;
  if (typeof titleLength === "number" && Number.isFinite(titleLength)) {
    lines.push(`titleLength: ${titleLength}`);
  }

  // LLM 출력 형식 instruction — classifyNarrative 의 marker 추출과 정합.
  lines.push(
    "난이도와 기여도를 다음 형식으로 답하라: difficulty: <easy|medium|hard>, contribution: <zero|low|medium|high>",
  );

  return lines.join("\n");
}

// extractMarker — narrative 에서 주어진 marker 정규식으로 값 토큰을 추출하고
// 둘러싼 구두점(콤마 / 마침표 등)을 벗긴 뒤 소문자로 정규화한다. marker 부재
// 또는 구두점 제거 후 빈 토큰이면 undefined(round 1 NIT — trailing 구두점이
// isDifficulty / isContributionLevel 좁히기를 깨지 않게 한다).
function extractMarker(narrative: string, marker: RegExp): string | undefined {
  const match = marker.exec(narrative);
  if (match === null) {
    return undefined;
  }
  const token = match[1].replace(SURROUNDING_PUNCTUATION, "").toLowerCase();
  return token.length > 0 ? token : undefined;
}

/**
 * LLM `narrative` 문자열에서 `difficulty` + `contribution` 을 결정적으로 분류
 * 추출한다(ADR-0032 §3, R-97 / R-37 / R-38).
 *
 * 파싱 휴리스틱(v1 — marker 기반):
 *   - narrative 안의 구조적 marker(`difficulty: <값>` / `contribution: <값>`
 *     형식의 key:value, case-insensitive)를 우선 추출한다. 단어 경계(`\b`)로만
 *     anchor 하므로 line-separated(`difficulty: hard\ncontribution: high`)와
 *     inline comma(`difficulty: hard, contribution: high`) 형식을 모두 매칭한다
 *     — buildEvaluationPrompt 가 요청하는 단일 line comma 형식과 정합(round 1).
 *   - 추출한 값에서 둘러싼 구두점(콤마 / 마침표 등)을 벗기고 `isDifficulty` /
 *     `isContributionLevel` 로 좁힌다 — 허용 집합 멤버면 채택, 아니면 fallback.
 *   - marker 부재(자유 산문 / 빈 문자열) / 미인식 값(`difficulty: trivial`,
 *     `contribution: amazing`) → 안전 default(`difficulty: "medium"`,
 *     `contribution: "low"`)로 fallback(throw 0).
 *
 * 동일 narrative → 동일 분류(determinism, LLM 의존 0). 반환의 difficulty 는
 * 항상 `DIFFICULTIES` 멤버, contribution 은 항상 `CONTRIBUTION_LEVELS` 멤버다
 * (허용 집합 밖 값 미반환).
 *
 * 확장 여지: v1 은 marker 휴리스틱이다. 구조화 JSON 출력 강제 / 별도 prompt 전략
 * 정밀화는 후속 service slice 가 수행할 수 있으며, marker 형식은
 * `buildEvaluationPrompt` 의 instruction line 과 정합한다.
 *
 * @param narrative LLM 정성 평가문(`LlmGenerateResult.narrative`, string).
 * @returns `{ difficulty, contribution }` 부분 결과(항상 허용 집합 멤버).
 */
export function classifyNarrative(narrative: string): {
  difficulty: Difficulty;
  contribution: ContributionLevel;
} {
  const difficultyToken = extractMarker(narrative, DIFFICULTY_MARKER);
  const contributionToken = extractMarker(narrative, CONTRIBUTION_MARKER);

  const difficulty: Difficulty =
    difficultyToken !== undefined && isDifficulty(difficultyToken)
      ? difficultyToken
      : DEFAULT_DIFFICULTY;

  const contribution: ContributionLevel =
    contributionToken !== undefined && isContributionLevel(contributionToken)
      ? contributionToken
      : DEFAULT_CONTRIBUTION;

  return { difficulty, contribution };
}
