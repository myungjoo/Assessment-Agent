// realdata-e2e-result-summary-line-consistency.ts — 실 평가 e2e 결과 요약 "한 줄
// 요약" 라인의 **값**이 summary descriptor 필드(count / totalVolume / byDifficulty 3
// 슬롯 / byContribution 4 슬롯)만으로 **독립 재합성**한 라인과 byte-identical 정합한지
// 검증하는 순수 가드(T-0711 박제).
//
// 동기: NO-GUARD leaf 컴포저 `formatRealDataResultSummaryLine`(T-0642,
// realdata-e2e-result-summary-line.ts)은 현재 형태 가드
// `assertRealDataResultSummaryLineFormatShape`(T-0643, 라인 **문자열**만 받아 prefix·
// count/volume 토큰 존재·난이도/기여도 슬롯 형태·개행 0 등 **형태**만 검증) 만 self-wire
// 한다. 한편 상위 body-consistency 가드(T-0646)는 `formatRealDataResultSummaryLine(summary)`
// 를 **컴포저 재호출**해 byte-identical 대조하므로, formatter 내부 값 매핑(count/volume
// 토큰·난이도 슬롯 값·기여도 슬롯 값·슬롯 순서)이 잘못 바뀌어도 재호출 산출도 같은
// 잘못된 값을 내어 **양방향 drift 상쇄로 통과**한다(재구현이 아닌 재호출의 한계). 즉
// summary 필드의 실제 값이 라인 안의 올바른 슬롯에 단조 매핑됐는지를 검증하는 **값-정합
// 가드는 부재**였다. 본 가드는 컴포저 재호출 없이 summary 필드만으로 expected 라인을
// 독립 재합성(`RESULT_LINE_PREFIX` 상수만 single-source import 재사용)한 뒤 실제 라인과
// byte-identical 대조해, 값 drift 가 양방향 상쇄되지 않고 build-time 에 fail-fast 로
// 잡히게 한다. T-0701(outcome-report summaryLine 독립 재합성 정합 가드)의 result-summary
// -line mirror.
//
// 불변식: expected = `${RESULT_LINE_PREFIX}count=${count} · volume=${totalVolume}
//   · 난이도(easy/medium/hard)=a/b/c · 기여도(zero/low/medium/high)=p/q/r/s` 를
// summary 필드만으로 직접 재합성 후 `line` 과 byte-identical(===).
// `formatRealDataResultSummaryLine` 재호출 0(body-consistency 가드가 이미 cover —
// 본 가드는 합성 로직 독립 재구현이라 양방향 drift 상쇄가 일어나지 않는다). 슬롯 값·
// 순서는 `DIFFICULTIES`(easy → medium → hard) / `CONTRIBUTION_LEVELS`(zero → low →
// medium → high) single-source 고정 순서로 순회(슬롯 hard-code 0).
//
// 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError): line 이 string 아님·
// null/undefined·summary null/undefined·byDifficulty/byContribution 누락 → 한국어
// TypeError. 독립 재합성 expected 와 line drift(count·volume·난이도/기여도 슬롯 값/순서·
// prefix) → 한국어 RangeError(기대 vs 실측 노출). silent 통과 0, fail-fast. 공백·
// 대소문자 민감(trim·case-fold 0).
//
// 비변형 / 순수: line·summary 읽기·비교만(쓰기 0). 부수효과·`@Injectable`·Prisma·LLM·
// 새 외부 dependency·env/네트워크/credential 0. 동일 입력 → 동일 동작. raw 미저장
// (R-59 / REQ-032) — 식별자 카운트·분류 enum 분포·정량 합산만 재합성·비교.
//
// 패턴 mirror: `assertRealDataResultIssueOutcomeReportSummaryLineConsistent`(T-0701) 의
// 에러 정책·한국어 메시지 톤을 따르되, 대상이 outcome-report summaryLine 이 아니라
// result-summary-line 이며 재합성 source 가 4 식별자 필드가 아니라 count/totalVolume +
// byDifficulty 3 슬롯 + byContribution 4 슬롯이다.
//
// Out of Scope (T-0711): 컴포저 본문 수정 / self-wire 배선(후속 task) · 형태 가드·
// body-consistency 가드 수정 · 자동 복구/재합성/정규화 · zod·ajv 등 외부 validation
// 도입 — 전부 0.
import { CONTRIBUTION_LEVELS } from "../../src/assessment-evaluation/domain/evaluation-result";
import { DIFFICULTIES } from "../../src/llm/difficulty";

import type { RealDataResultSummary } from "./realdata-e2e-result-summary";
import { RESULT_LINE_PREFIX } from "./realdata-e2e-result-summary-line";

// composeExpectedLine — summary 의 count/totalVolume + byDifficulty 3 슬롯 +
// byContribution 4 슬롯만으로 expected 한 줄 요약을 독립 재합성한다. 컴포저(T-0642)의
// template 을 의도적으로 재구현(`formatRealDataResultSummaryLine` 재호출 0 — 재호출은
// body-consistency 가드가 cover, 본 가드는 합성 로직 독립 재구현이라 양방향 drift 상쇄가
// 일어나지 않는다). prefix 만 `RESULT_LINE_PREFIX` single-source import 재사용(라벨 drift
// 방지). 슬롯 값·순서는 `DIFFICULTIES` / `CONTRIBUTION_LEVELS` 고정 순서 순회(슬롯
// hard-code 0). assertSummaryStructure 통과 후에만 호출되므로 슬롯 객체 존재가 보장된다.
function composeExpectedLine(summary: RealDataResultSummary): string {
  const difficultyValues = DIFFICULTIES.map(
    (difficulty) => summary.byDifficulty[difficulty],
  ).join("/");
  const contributionValues = CONTRIBUTION_LEVELS.map(
    (level) => summary.byContribution[level],
  ).join("/");

  return (
    `${RESULT_LINE_PREFIX}count=${summary.count}` +
    ` · volume=${summary.totalVolume}` +
    ` · 난이도(${DIFFICULTIES.join("/")})=${difficultyValues}` +
    ` · 기여도(${CONTRIBUTION_LEVELS.join("/")})=${contributionValues}`
  );
}

// assertSummaryStructure — `summary` 객체와 분포 슬롯 객체가 구조적으로 온전한지
// fail-fast 검증. 구조/타입 결손은 RangeError 가 아니라 TypeError 로 구분한다(값 정합
// 위반과 분리). count/totalVolume 값 자체의 type 은 검증하지 않는다 — template literal 이
// 어떤 값이든 문자열화하므로(컴포저와 동형) 재합성 결과가 라인과 drift 하면 RangeError 로
// 잡힌다. 본 함수는 슬롯 순회(composeExpectedLine)가 undefined 객체 접근으로 TypeError 를
// 던지기 전에 명세형 한국어 메시지로 먼저 차단하는 역할이다.
function assertSummaryStructure(
  summary: RealDataResultSummary | null | undefined,
): asserts summary is RealDataResultSummary {
  if (summary === null || summary === undefined) {
    throw new TypeError(
      "summary 가 null/undefined 일 수 없다 — RealDataResultSummary descriptor 객체가 필요하다.",
    );
  }
  if (summary.byDifficulty === null || summary.byDifficulty === undefined) {
    throw new TypeError(
      "summary.byDifficulty 가 누락된 불완전 descriptor 일 수 없다 — 난이도 슬롯 독립 재합성을 진행할 수 없다.",
    );
  }
  if (summary.byContribution === null || summary.byContribution === undefined) {
    throw new TypeError(
      "summary.byContribution 가 누락된 불완전 descriptor 일 수 없다 — 기여도 슬롯 독립 재합성을 진행할 수 없다.",
    );
  }
}

/**
 * 실 평가 e2e 결과 요약 "한 줄 요약" `line` 의 **값**이 `summary` descriptor 필드만으로
 * 독립 재합성한 라인과 byte-identical 정합함을 런타임에서 검증하는 순수 가드(PLAN.md P5
 * 109행 step ④ 표현 surface 무결성 조각 / REQ-059·REQ-032).
 * `formatRealDataResultSummaryLine`(T-0642) body-consistency 가드(T-0646) 보완 mirror —
 * 그 가드는 컴포저를 재호출해 byte-identical 대조하므로 합성 로직 자체의 값 drift 를
 * 양방향 상쇄로 놓치지만, 본 가드는 template 을 독립 재구현해 값 회귀를 fail-fast 로 잡는다.
 *
 * 불변식: expected = `${RESULT_LINE_PREFIX}count=N · volume=V
 *   · 난이도(easy/medium/hard)=a/b/c · 기여도(zero/low/medium/high)=p/q/r/s` 를 summary
 * 필드만으로 재합성 후 `line` 과 byte-identical(===). 슬롯 값·순서는 `DIFFICULTIES` /
 * `CONTRIBUTION_LEVELS` single-source 고정 순서.
 *
 * 에러 정책: line 비-string/null/undefined·summary null/undefined·byDifficulty/
 * byContribution 누락 → TypeError. 독립 재합성 expected 와 line drift(count·volume·
 * 난이도/기여도 슬롯 값/순서·prefix) → RangeError(기대 vs 실측 노출). silent 통과 0,
 * fail-fast. 공백·대소문자 민감(trim·case-fold 0).
 *
 * @param line 검증 대상 결과 한 줄 요약 문자열(`formatRealDataResultSummaryLine` 산출).
 *   변형하지 않는다(읽기·비교만).
 * @param summary 라인의 single source descriptor. 변형하지 않는다(읽기·비교만).
 * @returns 정합하면 정상 반환(void).
 * @throws {TypeError} line 비-string/null/undefined 또는 summary null/undefined·
 *   byDifficulty/byContribution 누락(구조 결손).
 * @throws {RangeError} 독립 재합성 expected 와 line drift(기대 vs 실측 포함, 값 정합 위반).
 */
export function assertRealDataResultSummaryLineConsistentWithSummary(
  line: string,
  summary: RealDataResultSummary,
): void {
  // 구조 검증(TypeError 분기) — line string 타입 + summary 존재 + 분포 슬롯 객체 존재.
  if (typeof line !== "string") {
    throw new TypeError(
      `line 이 string 이 아니다(값 정합 비교 불가 — 타입: ${typeof line}, 값: ${String(line)}).`,
    );
  }
  assertSummaryStructure(summary);

  // 라인 독립 재합성(컴포저 재호출 0) — summary 필드만으로 expected 를 직접 합성.
  const expected = composeExpectedLine(summary);

  // 값 정합 비교(RangeError 분기) — byte-identical.
  if (line !== expected) {
    throw new RangeError(
      `정합 위반: line 이 summary 필드로부터 독립 재합성한 expected 와 byte-identical 하지 않다 — 기대='${expected}', 실측='${line}'. 라인 값 매핑(count/volume·난이도/기여도 슬롯 값·순서·prefix)이 drift 했거나 summary 와 어긋났다.`,
    );
  }
}
