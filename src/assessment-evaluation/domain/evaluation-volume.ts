// calculateEvaluationVolume — P5 평가의 결정적 양(volume) 산출 순수 함수
// (ADR-0032 Decision §3 "양은 metadata 기반 deterministic 수치, LLM 무관").
// `EvaluationInput.metadata` 의 scalar 신호를 결정적으로 ≥ 0 정수로 축약한다.
// 본 파일은 의존성 0 의 순수 함수만 둔다 — NestJS `@Injectable` / Prisma / LLM
// 호출 0, throw 0, 부수효과 0. 동일 입력은 항상 동일 출력(referential
// transparency) — LLM 정성 평가(narrative / difficulty / contribution)와 분리해
// 독립 검증 가능(R-26 코드 abusing / R-40 문서 abusing 방지 metric 의 기반).

import type { EvaluationInput } from "./evaluation-input";

/**
 * 평가 입력 1 건의 양(volume)을 결정적으로 산출한다.
 *
 * v1 baseline 규칙 — `metadata.titleLength`(number) 1 신호만 사용한다. 이는 현
 * collection mapper(github-activity.mapper.ts / confluence-activity.mapper.ts)가
 * 박제하는 유일 정량 metric 이다. 정규화:
 *   - `titleLength` 가 유한 number 면 `Math.floor` 후 음수는 0 으로 절하해 반환
 *     (소수 3.14 → 3, 음수 -5 → 0).
 *   - `titleLength` 부재 / number 아님(string / boolean / null) → 0 fallback
 *     (`ActivityMetadataValue` union 전 시나리오 cover).
 *   - `NaN` / `Infinity` / `-Infinity` → 0(유한성 검사).
 *
 * 확장 여지: v1 은 titleLength baseline 만이다. 추후 R-26 abusing 방지(commit/PR
 * 숫자만 늘리기) + R-40 문서 abusing(의미 없는 반복) metric 이 추가될 때 본 함수에
 * 누적한다 — LLM 무관 deterministic 원칙은 유지(LLM 호출 / mock 도입 금지).
 *
 * @param input 평가 단위 입력(`EvaluationInput`). `metadata` 만 참조한다.
 * @returns ≥ 0 정수 volume. 산출 불가 / 비정상 신호는 모두 0.
 */
export function calculateEvaluationVolume(input: EvaluationInput): number {
  const titleLength = input.metadata.titleLength;
  // number 가 아닌 scalar(string / boolean / null) 또는 부재 → 0 fallback.
  if (typeof titleLength !== "number") {
    return 0;
  }
  // NaN / Infinity / -Infinity 같은 비유한 number → 0 (방어).
  if (!Number.isFinite(titleLength)) {
    return 0;
  }
  // 음수는 0 으로 절하, 소수는 floor 정규화 → ≥ 0 정수 보장.
  const normalized = Math.floor(titleLength);
  return normalized > 0 ? normalized : 0;
}
