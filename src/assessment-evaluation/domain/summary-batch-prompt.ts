// summary-batch-prompt — 한 (person, period, periodStart) 좌표의 단위 평가 묶음
// (`EvaluationResult[]`)을 batch narrative 생성용 결정적 prompt 문자열로 조립하는
// LLM-무관 순수 함수 (ADR-0035 §Decision 5). 한 Summary row 의 정성 narrative 를
// 생성하는 LLM 호출에 넣을 prompt 를, 그 좌표의 단위 평가 typed surface (per-unit
// narrative / difficulty / contribution / volume) 만으로 조립한다.
//
// 본 파일은 의존성 0 의 순수 함수만 둔다 — NestJS `@Injectable` / Prisma / LLM
// gateway import 0, 실 LLM `generate` 호출 0, mock 0, throw 0, 부수효과 0. 동일
// 입력은 항상 동일 출력 (referential transparency). 단위 평가의 `buildEvaluation
// Prompt`(evaluation-prompt.ts) 패턴 — typed 필드만 line join, raw 본문 0 — 을
// 정확히 mirror 하되, 입력이 단위 1 건이 아니라 좌표 1 개의 N 건 묶음이라는 점만
// 다르다 (단위 N → batch prompt 1 → generate 1 회, §Decision 5).
//
// REQ-032 raw 미저장 (ADR-0035 §Decision 2 / §Decision 5): 입력 타입
// `EvaluationResult` 가 raw 본문 필드 (commit message 전문 / diff / issue body /
// page HTML) 를 애초에 보유하지 않으므로 prompt 에 raw 가 끼어들 표면이 구조적으로
// 없다. 본 builder 는 per-unit 의 평가-파생 필드 (narrative / difficulty /
// contribution / volume) 만 직렬화한다 — whitelist 단일 신호 읽기로 누출 0.

import type { EvaluationResult } from "./evaluation-result";

// SummaryBatchContext — batch narrative 가 어느 좌표의 요약인지 식별하는
// (personId, period, periodStart) 3-tuple (ADR-0035 §Decision 4 idempotency key
// 정합). batch 경계가 "한 person 의 한 period" 임을 prompt heading 으로도 명시해
// LLM 에게 단일 좌표 요약임을 알린다. `EvaluationResult` 에는 좌표 식별 축이 없으므로
// (ADR-0033 §51) builder 진입에 별도로 받는다.
export interface SummaryBatchContext {
  personId: string;
  period: string;
  // periodStart 는 Date instance — 결정적 직렬화를 위해 ISO-8601 로 전사한다.
  periodStart: Date;
}

/**
 * 한 좌표의 단위 평가 묶음을 batch narrative 생성용 결정적 prompt 로 조립한다
 * (ADR-0035 §Decision 5).
 *
 * 포함 신호 (typed surface 만 — raw 본문 0, REQ-032 / §Decision 2):
 *   - context.personId / context.period / context.periodStart — 어느 좌표의 요약인지.
 *   - 각 unit 의 difficulty / contribution / volume / narrative — per-unit 평가-파생
 *     필드. narrative 는 단위 평가 LLM 이 이미 생성한 결과물 (raw 인용 아님 —
 *     `EvaluationResult.narrative` 정의, R-59 적용 외) 이라 batch prompt 에 안전하게
 *     인용된다.
 *
 * 빈 묶음 (results.length === 0) 의 정의된 동작: heading + 빈 묶음 안내 line 만으로
 * 결정적 prompt 를 반환한다 (throw 0). 호출처 (batch narrative service) 가 빈 묶음
 * 자체를 별도로 게이트할지는 service 책임 — builder 는 항상 valid prompt 를 만든다.
 *
 * 동일 입력 → 동일 prompt (determinism, LLM 의존 0). per-unit line 은 입력 순서를
 * 그대로 보존한다 (정렬/재배치 0 — 결과 ↔ 입력 trace 보존).
 *
 * @param context batch narrative 좌표 (personId / period / periodStart).
 * @param results 그 좌표의 단위 평가 묶음 (`EvaluationResult[]`). typed 필드만 참조.
 * @returns 결정적 batch prompt 문자열. raw 본문 0.
 */
export function buildSummaryBatchPrompt(
  context: SummaryBatchContext,
  results: EvaluationResult[],
): string {
  const lines: string[] = [
    "다음은 한 사람의 한 평가 구간에 속한 단위 기여 평가 묶음이다. 이 묶음을 종합해 해당 구간의 요약 평가문을 한 단락으로 작성하라.",
    `personId: ${context.personId}`,
    `period: ${context.period}`,
    `periodStart: ${context.periodStart.toISOString()}`,
    `unitCount: ${results.length}`,
  ];

  if (results.length === 0) {
    // 빈 묶음 — 평가할 단위가 없음을 명시 (빈 prompt 회피). service 가 빈 묶음을
    // 사전 게이트하면 본 분기는 도달하지 않으나, builder 단독으로도 valid prompt 보장.
    lines.push("units: (평가할 단위 기여가 없음)");
    return lines.join("\n");
  }

  // per-unit line — typed surface 만 직렬화 (raw 본문 0). 입력 순서 보존.
  // narrative 는 단위 평가 LLM 생성 결과물이라 raw 인용이 아니다 (R-59 적용 외).
  lines.push("units:");
  results.forEach((unit, index) => {
    lines.push(
      `  - [${index + 1}] difficulty: ${unit.difficulty}, contribution: ${unit.contribution}, volume: ${unit.volume}, narrative: ${unit.narrative}`,
    );
  });

  return lines.join("\n");
}
