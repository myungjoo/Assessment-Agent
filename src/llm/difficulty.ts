// Difficulty literal union + 지원 집합 + type guard — ADR-0011 §1 이 확정한 3
// 난이도 슬롯 (easy / medium / hard) 의 식별자 single source. T-0137 (DifficultyMapping
// entity layer). llm-gateway.interface.ts 의 LlmProvider enum / LLM_PROVIDERS /
// isLlmProvider 패턴을 mirror — 단 ADR-0011 §1 이 "String literal union 또는 enum"
// 중 union 을 명시 옵션으로 두므로 enum 대신 String literal union 채택 (값 자체가
// schema 컬럼에 그대로 저장되는 lower-case literal, reverse-mapping 불요).
//
// 책임 경계:
//   - 본 파일은 난이도 식별자의 허용 집합 (`Difficulty`) 과 멤버십 판정 (`isDifficulty`)
//     만 정의한다. DifficultyMapping ↔ LlmProviderConfig resolve / fail-fast 거부
//     (ADR-0011 §3) 는 후속 service (T-0138+) 책임. 본 layer 는 식별자 contract 만.
//   - schema.prisma 의 DifficultyMapping.difficulty 컬럼은 enum-as-String literal
//     박제 (LlmProviderConfig.provider 정공법 정합). 본 union 이 그 허용 집합의
//     single source — application-layer 가 difficulty 값 invariant 검증 시 본 union
//     멤버십 (isDifficulty) 을 기준으로 한다.

// Difficulty — ADR-0011 §1 의 3 난이도 슬롯 식별자 (lower-case String literal).
// schema 컬럼에 그대로 저장되는 값. trivial / expert 등 4 번째 난이도 추가는
// cardinality 모델 변경 ADR (ADR-0011 supersede) 필요 — 현 요구 (R-97) 는 3 단계 고정.
export type Difficulty = "easy" | "medium" | "hard";

// Difficulty union 의 3 멤버 전체를 배열로 노출 — application-layer 의 difficulty
// 값 검증 (허용 집합 밖 → BadRequestException, 후속 service 책임) 및 본 task 의
// spec 이 "3 값 모두 정의됐는지" 를 검증할 때 사용하는 single source. `satisfies`
// 로 union 과 배열의 동기성 (멤버 누락 / 오타) 을 compile-time 강제.
export const DIFFICULTIES = [
  "easy",
  "medium",
  "hard",
] as const satisfies readonly Difficulty[];

// 주어진 문자열이 지원 난이도 식별자인지 판정하는 type guard. 후속 service /
// Controller DTO validation 이 raw 입력 (string) 을 Difficulty 로 좁힐 때 사용.
// isLlmProvider 패턴 mirror — DIFFICULTIES 멤버십 1 차 판정 (대문자 'Easy' / 빈
// 문자열 / 'trivial' 미정의 난이도 / 공백 등은 모두 false).
export function isDifficulty(value: string): value is Difficulty {
  return (DIFFICULTIES as readonly string[]).includes(value);
}
