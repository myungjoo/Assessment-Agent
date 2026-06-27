// realdata-e2e-result-summary-consistency.ts — 실 평가 e2e 결과 요약 descriptor
// (`buildRealDataResultSummary`, T-0580) 의 집계 결과(count / byDifficulty /
// byContribution / totalVolume)가, 동일 `EvaluationResult[]` 로부터 **독립 재유도**한
// expected 요약과 deep-equal 정합한지 검증하는 순수 가드(T-0705 박제).
//
// 동기: leaf 컴포저 `buildRealDataResultSummary`(T-0580, `realdata-e2e-result-summary.ts`)
// 는 `EvaluationResult[]` 를 결과 요약 descriptor 로 집계하는 순수 leaf 인데, 그 집계
// 로직(슬롯 0 초기화·difficulty/contribution 카운트·volume 합산)이 입력으로부터 독립
// 재유도되어 build-time 에 대조되지 않는다(NO-GUARD leaf). 상위 가드(T-0699
// result-report-plan)는 컴포저를 **재호출**해 deep-equal 할 뿐이라 집계 내부 로직
// drift(예: difficulty 슬롯 +1 누락·volume 합산 누락·count off-by-one)를 양방향 상쇄로
// 놓친다(재호출의 한계). 본 가드는 컴포저 재호출 없이 `results` 만으로 expected 요약을
// 독립 재유도해 입력 `summary` 와 deep-equal 대조함으로써 집계 drift 를 fail-fast 로
// 차단한다(T-0701 summaryLine 독립 재합성·T-0703 action 분기 독립 재유도 가드와 동형).
//
// 검증하는 불변식(single source — 컴포저 재호출 0, 집계 독립 재구현):
//   expected = {
//     count: results.length,
//     byDifficulty: DIFFICULTIES 슬롯 0 초기화 후 result.difficulty 카운트,
//     byContribution: CONTRIBUTION_LEVELS 슬롯 0 초기화 후 result.contribution 카운트,
//     totalVolume: result.volume 합산,
//   } 를 가드 안에서 직접 재유도한 뒤 입력 `summary` 와 deep-equal byte-identical.
//   `buildRealDataResultSummary` 재호출 금지 — 재호출은 동일 로직 drift 를 양방향 상쇄해
//   잡지 못한다(재구현이 핵심).
//
// 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
//   - `summary` null/undefined · count 비-number · totalVolume 비-number ·
//     byDifficulty/byContribution 가 객체(Record) 아님 · 슬롯 값 비-number ·
//     `results` 비-배열/원소 결손 → 한국어 TypeError.
//   - 독립 재유도 expected 와 입력 `summary` drift(count drift · totalVolume drift ·
//     byDifficulty 슬롯 값 drift · byContribution 슬롯 값 drift · 미등장 슬롯에 임의 값
//     주입) → 한국어 RangeError(기대 vs 실측 노출).
//   - silent 통과(위반인데 정상 void) 0. 검사 순서: 구조(summary·results) → 재유도 →
//     deep-equal 비교. 가장 먼저 위반한 지점에서 throw(fail-fast).
//
// 비변형 / 순수: `summary`(읽기·비교만) / `results`(읽기만, mutate 0). 재유도용 새 Record
// 만 생성한다. 부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0 ·
// env/네트워크/credential 0. 동일 입력 → 동일 동작(정합 summary 면 항상 void, drift summary
// 면 항상 동일 지점에서 throw). raw 미저장(R-59/REQ-032) — 요약은 카운트·분포·합산만 보유
// (narrative/raw 본문 미접촉), 가드도 식별자 카운트·정량 합산만 재유도·비교.
//
// 슬롯 single source(중복 정의 0): byDifficulty 키는 `DIFFICULTIES`(src/llm/difficulty.ts),
// byContribution 키는 `CONTRIBUTION_LEVELS`(evaluation-result.ts)를 import 재사용한다 —
// 본 가드는 새 슬롯 배열을 정의하지 않는다(컴포저와 동일 SSOT).
//
// 패턴 mirror: `assertRealDataResultIssueActionConsistentWithInputs`(T-0703) /
// `assertRealDataResultIssueOutcomeReportSummaryLineConsistent`(T-0701) 의 "컴포저 재호출이
// 아니라 로직 독립 재구현" 정신 + 구조 결손 TypeError / 값 정합 위반 RangeError 분리 톤.
//
// Out of Scope (T-0705): 컴포저 본문 수정 / self-wire 배선(가드를 컴포저 return 직전 호출 —
// 후속 별도 task T-0706) · 집계 공식/슬롯 키 집합 변경 · production src 변경 · 자동
// 복구/재유도/정규화 · zod·ajv 등 외부 validation 도입 — 전부 0.
import {
  CONTRIBUTION_LEVELS,
  type ContributionLevel,
  type EvaluationResult,
} from "../../src/assessment-evaluation/domain/evaluation-result";
import { DIFFICULTIES, type Difficulty } from "../../src/llm/difficulty";

import type { RealDataResultSummary } from "./realdata-e2e-result-summary";

// describe — 에러 메시지용 타입 라벨. null/array 를 typeof 가 뭉뚱그리는 'object' 대신
// 구분해 노출한다(디버깅 가독성).
function describe(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}

// isPlainRecord — value 가 plain 객체(Record)인지 판정. null/array 는 제외한다
// (byDifficulty/byContribution 슬롯 맵의 구조 검증용).
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// assertSlotRecordStructure — byDifficulty/byContribution 가 객체이고 single-source
// 슬롯 키마다 number 값을 보유하는지 fail-fast 검증. 구조/타입 결손은 RangeError 가
// 아니라 TypeError 로 구분한다(값 정합 위반과 분리). 키 누락 / 비-number 슬롯 값 / 슬롯
// 외 잉여 키(미정의 슬롯)는 모두 구조 결손으로 본다 — 재유도 비교는 정상 키 집합 위에서만
// 의미를 갖기 때문이다.
function assertSlotRecordStructure(
  fieldName: string,
  record: unknown,
  slots: readonly string[],
): asserts record is Record<string, number> {
  if (!isPlainRecord(record)) {
    throw new TypeError(
      `summary.${fieldName} 가 객체가 아니다(타입: ${describe(record)}) — 슬롯 분포 정합 재유도를 진행할 수 없다.`,
    );
  }
  for (const slot of slots) {
    if (typeof record[slot] !== "number") {
      throw new TypeError(
        `summary.${fieldName}.${slot} 가 숫자가 아니다(타입: ${describe(record[slot])}) — 슬롯 값 정합 비교 전 최소 형태 보장 실패.`,
      );
    }
  }
  for (const key of Object.keys(record)) {
    if (!(slots as readonly string[]).includes(key)) {
      throw new TypeError(
        `summary.${fieldName} 에 정의되지 않은 슬롯 키 '${key}' 가 있다 — single-source(${fieldName === "byDifficulty" ? "DIFFICULTIES" : "CONTRIBUTION_LEVELS"}) 슬롯 집합 밖의 키는 허용되지 않는다.`,
      );
    }
  }
}

// assertSummaryStructure — `summary` 객체와 4 필드의 구조가 온전한지 fail-fast 검증.
// 구조/타입 결손은 TypeError 로 구분한다(값 정합 위반과 분리). count/totalVolume 은
// number, byDifficulty/byContribution 은 single-source 슬롯을 number 로 갖는 Record 여야
// 한다(재유도 비교 전 최소 형태 보장 — 깊은 값 정합은 재유도 비교가 맡는다).
function assertSummaryStructure(
  summary: RealDataResultSummary | null | undefined,
): asserts summary is RealDataResultSummary {
  if (
    summary === null ||
    typeof summary !== "object" ||
    Array.isArray(summary)
  ) {
    throw new TypeError(
      `summary 가 객체가 아니다(타입: ${describe(summary)}) — RealDataResultSummary 가 필요하다.`,
    );
  }
  const count = (summary as { count?: unknown }).count;
  if (typeof count !== "number") {
    throw new TypeError(
      `summary.count 가 숫자가 아니다(타입: ${describe(count)}) — 평가 단위 수 정합 비교를 진행할 수 없다.`,
    );
  }
  const totalVolume = (summary as { totalVolume?: unknown }).totalVolume;
  if (typeof totalVolume !== "number") {
    throw new TypeError(
      `summary.totalVolume 가 숫자가 아니다(타입: ${describe(totalVolume)}) — volume 합산 정합 비교를 진행할 수 없다.`,
    );
  }
  assertSlotRecordStructure(
    "byDifficulty",
    (summary as { byDifficulty?: unknown }).byDifficulty,
    DIFFICULTIES,
  );
  assertSlotRecordStructure(
    "byContribution",
    (summary as { byContribution?: unknown }).byContribution,
    CONTRIBUTION_LEVELS,
  );
}

// assertResultsStructure — `results` 배열·각 원소의 difficulty/contribution/volume 이
// 재유도에 필요한 최소 형태인지 fail-fast 검증. 구조/타입 결손은 TypeError 로 구분한다.
// difficulty/contribution 은 single-source 슬롯 멤버여야 한다 — 미정의 슬롯 키는 재유도
// 시 초기화되지 않은 슬롯 접근을 유발하므로 경계에서 차단한다(negative case ⑤).
function assertResultsStructure(
  results: EvaluationResult[] | null | undefined,
): asserts results is EvaluationResult[] {
  if (!Array.isArray(results)) {
    throw new TypeError(
      `results 가 배열이 아니다(타입: ${describe(results)}) — summary 정합 재유도를 진행할 수 없다.`,
    );
  }
  const difficultySlots = DIFFICULTIES as readonly string[];
  const contributionSlots = CONTRIBUTION_LEVELS as readonly string[];
  for (const [index, result] of results.entries()) {
    if (
      result === null ||
      typeof result !== "object" ||
      Array.isArray(result)
    ) {
      throw new TypeError(
        `results[${index}] 가 객체가 아니다(타입: ${describe(result)}) — EvaluationResult 형태여야 한다.`,
      );
    }
    if (!difficultySlots.includes(result.difficulty as string)) {
      throw new TypeError(
        `results[${index}].difficulty 가 슬롯 키가 아니다(값: ${describe(result.difficulty)}) — DIFFICULTIES 슬롯 밖의 difficulty 는 재유도 시 미정의 슬롯 접근을 유발한다.`,
      );
    }
    if (!contributionSlots.includes(result.contribution as string)) {
      throw new TypeError(
        `results[${index}].contribution 가 슬롯 키가 아니다(값: ${describe(result.contribution)}) — CONTRIBUTION_LEVELS 슬롯 밖의 contribution 은 재유도 시 미정의 슬롯 접근을 유발한다.`,
      );
    }
    if (typeof result.volume !== "number") {
      throw new TypeError(
        `results[${index}].volume 가 숫자가 아니다(타입: ${describe(result.volume)}) — totalVolume 합산을 진행할 수 없다.`,
      );
    }
  }
}

// deriveExpectedSummary — `results` 만으로 expected 요약 descriptor 를 **독립 재유도**한다.
// 컴포저(`buildRealDataResultSummary`, T-0580)의 집계(슬롯 0 초기화·difficulty/contribution
// 카운트·volume 합산·count)를 의도적으로 재구현한다(컴포저 재호출 0 — 재호출은 동일 로직
// drift 를 양방향 상쇄해 잡지 못한다). 재유도용 **새 Record** 만 생성하고 입력은 읽기만 한다.
function deriveExpectedSummary(
  results: EvaluationResult[],
): RealDataResultSummary {
  const byDifficulty = {} as Record<Difficulty, number>;
  for (const difficulty of DIFFICULTIES) {
    byDifficulty[difficulty] = 0;
  }
  const byContribution = {} as Record<ContributionLevel, number>;
  for (const level of CONTRIBUTION_LEVELS) {
    byContribution[level] = 0;
  }
  let totalVolume = 0;

  for (const result of results) {
    byDifficulty[result.difficulty] += 1;
    byContribution[result.contribution] += 1;
    totalVolume += result.volume;
  }

  return {
    count: results.length,
    byDifficulty,
    byContribution,
    totalVolume,
  };
}

// compareSlots — expected 와 입력 summary 의 슬롯 분포를 슬롯별로 대조한다. drift 발견 시
// 어느 필드/슬롯이 기대 vs 실측 어긋났는지 노출하는 한국어 RangeError 를 throw 한다.
function compareSlots(
  fieldName: string,
  expected: Record<string, number>,
  actual: Record<string, number>,
  slots: readonly string[],
): void {
  for (const slot of slots) {
    if (expected[slot] !== actual[slot]) {
      throw new RangeError(
        `정합 위반: summary.${fieldName}.${slot} 가 results 로부터 독립 재유도한 expected 와 다르다 — 기대=${expected[slot]}, 실측=${actual[slot]}. 분포 집계 로직이 drift 했거나 미등장 슬롯에 임의 값이 주입됐다.`,
      );
    }
  }
}

/**
 * 실 평가 e2e 결과 요약 descriptor(`buildRealDataResultSummary`, T-0580)의 집계 결과가,
 * 동일 `EvaluationResult[]` 로부터 가드 안에서 독립 재유도한 expected 요약과 deep-equal
 * byte-identical 정합함을 런타임에서 검증하는 순수 가드(PLAN.md P5 step ④ 결과 박제 chain
 * 의 집계-layer 무결성 조각). `assertRealDataResultIssueActionConsistentWithInputs`(T-0703)
 * / `...SummaryLineConsistent`(T-0701) 의 "컴포저 재호출이 아니라 로직 독립 재구현" 정신을
 * 요약 집계 layer 로 mirror 한다.
 *
 * 검증하는 불변식(single source — 컴포저 재호출 0, 집계 독립 재구현):
 *   expected = { count: results.length, byDifficulty: DIFFICULTIES 슬롯 0 초기화 후 카운트,
 *     byContribution: CONTRIBUTION_LEVELS 슬롯 0 초기화 후 카운트, totalVolume: volume 합산 }
 *   를 재유도한 뒤 입력 `summary` 와 deep-equal byte-identical.
 *
 * 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
 *   - `summary` null/undefined·count/totalVolume 비-number·byDifficulty/byContribution 비-객체
 *     /슬롯 값 비-number/미정의 슬롯 키·`results` 비-배열/원소 결손/difficulty·contribution
 *     슬롯 밖 → 한국어 TypeError.
 *   - 독립 재유도 expected 와 입력 `summary` drift(count drift·totalVolume drift·슬롯 값 drift·
 *     미등장 슬롯 임의 값 주입) → 한국어 RangeError(기대 vs 실측 노출).
 *   - silent 통과 0. 검사 순서: 구조(summary·results) → 재유도 → deep-equal 비교. 가장 먼저
 *     위반한 지점에서 throw(fail-fast).
 *
 * 비변형 / 순수: `summary`/`results` 를 읽기·비교만 한다(쓰기 0). 재유도용 새 Record 만 생성.
 * 부수효과 0·새 외부 dependency 0. 동일 입력 → 동일 동작. raw 미저장(R-59) — 카운트·분포·합산만.
 *
 * @param summary 검증 대상 컴포저 산출 요약. 변형하지 않는다(읽기·비교만). count/byDifficulty
 *   /byContribution/totalVolume 형태여야 하며 재유도 expected 와 정합해야 한다.
 * @param results 재유도 입력 평가 결과 배열. 변형하지 않는다(읽기만). 집계 재유도에 재사용한다.
 *   비-배열/원소 결손/슬롯 밖 difficulty·contribution 이면 TypeError 전파.
 * @returns 재유도 expected 와 정합하면 정상 반환(void).
 * @throws {TypeError} `summary`/`results` 구조·타입 결손.
 * @throws {RangeError} 독립 재유도 expected 와 입력 `summary` drift(값 정합 위반).
 */
export function assertRealDataResultSummaryConsistentWithInputs(
  summary: RealDataResultSummary,
  results: EvaluationResult[],
): void {
  // 구조 검증(TypeError 분기) — summary 4 필드 형태 + results 배열/원소 형태.
  assertSummaryStructure(summary);
  assertResultsStructure(results);

  // 기대값 독립 재유도 — 슬롯 0 초기화·카운트·합산·count 를 컴포저 재호출 없이 직접 재구현해
  // single-source expected 를 산출한다(drift 0). 재유도용 새 Record 만 생성(입력 mutate 0).
  const expected = deriveExpectedSummary(results);

  // 값 정합 비교(RangeError 분기) — count → totalVolume → 슬롯 분포 순 fail-fast.
  if (summary.count !== expected.count) {
    throw new RangeError(
      `정합 위반: summary.count 가 results 로부터 독립 재유도한 expected 와 다르다 — 기대=${expected.count}, 실측=${summary.count}. 평가 단위 수 집계가 drift 했다.`,
    );
  }
  if (summary.totalVolume !== expected.totalVolume) {
    throw new RangeError(
      `정합 위반: summary.totalVolume 이 results 로부터 독립 재유도한 expected 와 다르다 — 기대=${expected.totalVolume}, 실측=${summary.totalVolume}. volume 합산이 drift 했다.`,
    );
  }
  compareSlots(
    "byDifficulty",
    expected.byDifficulty,
    summary.byDifficulty,
    DIFFICULTIES,
  );
  compareSlots(
    "byContribution",
    expected.byContribution,
    summary.byContribution,
    CONTRIBUTION_LEVELS,
  );
}
