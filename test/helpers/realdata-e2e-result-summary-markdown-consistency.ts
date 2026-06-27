// realdata-e2e-result-summary-markdown-consistency.ts — 실 평가 e2e 결과 요약
// **마크다운 본문**의 각 렌더 토큰이 summary descriptor 필드(count / totalVolume /
// byDifficulty 3 슬롯 / byContribution 4 슬롯)만으로 **독립 재합성**한 마크다운과
// byte-identical 정합한지 검증하는 순수 가드(T-0713 박제).
//
// 동기: NO-GUARD leaf 컴포저 `renderRealDataResultSummaryMarkdown`(T-0581,
// realdata-e2e-result-summary-markdown.ts)은 `RealDataResultSummary` 를 daily-test
// 이슈 본문용 **결정론적 마크다운 문자열**로 렌더링한다(고정 순서: `## 실 평가 e2e
// 결과 요약` 헤더 → `- 평가 단위 수: <count>` → `- 총 volume: <totalVolume>` →
// `### difficulty 분포` 표(DIFFICULTIES 순서) → `### contribution 분포` 표
// (CONTRIBUTION_LEVELS 순서)). 한편 이 leaf 의 값-정합 가드층은 origin/main 에
// 부재였다 — 렌더 문자열의 각 슬롯/카운트 토큰이 summary 필드의 실제 값에 단조
// 매핑됐는지를 검증하는 가드가 없어, 렌더러 내부 값 매핑이 잘못 바뀌어도(예: 슬롯
// 순서 swap·count↔volume 토큰 교차) 이를 build-time 에 잡지 못했다. 본 가드는 컴포저
// 재호출 없이 summary 필드만으로 expected 마크다운을 독립 재합성(`DIFFICULTIES`·
// `CONTRIBUTION_LEVELS` 슬롯 배열만 single-source import 재사용, 헤더/표 리터럴은 가드
// 안에 미러링)한 뒤 실제 `markdown` 과 byte-identical 대조해, 값 drift 가 상쇄되지
// 않고 fail-fast 로 잡히게 한다. T-0711(result-summary-line 값-정합 가드)의 markdown
// mirror.
//
// 불변식: expected = (`## 실 평가 e2e 결과 요약` 헤더 + `- 평가 단위 수: ${count}` +
//   `- 총 volume: ${totalVolume}` + `### difficulty 분포` 표(DIFFICULTIES 순서
//   `| <slot> | <count> |`) + `### contribution 분포` 표(CONTRIBUTION_LEVELS 순서))를
// summary 필드만으로 직접 재합성 후 `markdown` 과 byte-identical(===).
// `renderRealDataResultSummaryMarkdown` 재호출 0(재호출은 양방향 drift 상쇄가 일어나
// 본 가드의 독립 재구현이 그 gap 을 닫는다). 슬롯 값·순서는 `DIFFICULTIES`(easy →
// medium → hard) / `CONTRIBUTION_LEVELS`(zero → low → medium → high) single-source
// 고정 순서로 순회(슬롯 hard-code 0).
//
// 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError): markdown 이 string
// 아님·null/undefined·summary null/undefined·byDifficulty/byContribution 누락 → 한국어
// TypeError. 독립 재합성 expected 와 markdown drift(count·volume·난이도/기여도 슬롯
// 값/순서·헤더/표 고정 리터럴) → 한국어 RangeError(기대 vs 실측 노출). silent 통과 0,
// fail-fast. 공백·줄바꿈·대소문자 민감(trim·case-fold 0).
//
// 비변형 / 순수: markdown·summary 읽기·비교만(쓰기 0). 부수효과·`@Injectable`·Prisma·
// LLM·새 외부 dependency·env/네트워크/credential 0. 동일 입력 → 동일 동작. raw 미저장
// (R-59 / REQ-032) — 식별자 카운트·분류 enum 분포·정량 합산만 재합성·비교.
//
// 패턴 mirror: `assertRealDataResultSummaryLineConsistentWithSummary`(T-0711) 의 에러
// 정책·한국어 메시지 톤·구조 검증 분리(assertSummaryStructure)를 그대로 따르되, 대상이
// 한 줄 요약 라인이 아니라 다줄 마크다운 본문이며 재합성 리터럴이 prefix 1 개가 아니라
// 헤더·표 골격 전체다.
//
// Out of Scope (T-0713): 컴포저 본문 수정 / self-wire 배선(후속 task) · 형태 가드·
// 기존 line/summary 가드(T-0705/T-0711) 수정/대체 · 자동 복구/재합성/정규화 · zod·ajv
// 등 외부 validation 도입 — 전부 0.
import { CONTRIBUTION_LEVELS } from "../../src/assessment-evaluation/domain/evaluation-result";
import { DIFFICULTIES } from "../../src/llm/difficulty";

import type { RealDataResultSummary } from "./realdata-e2e-result-summary";

// composeExpectedMarkdown — summary 의 count/totalVolume + byDifficulty 3 슬롯 +
// byContribution 4 슬롯만으로 expected 마크다운을 독립 재합성한다. 컴포저(T-0581)의
// 출력 구조 리터럴(헤더·표 골격·줄바꿈)을 의도적으로 재구현
// (`renderRealDataResultSummaryMarkdown` 재호출 0 — 재호출은 양방향 drift 상쇄가
// 일어나므로 합성 로직을 독립 재구현해야 값 회귀가 fail-fast 로 잡힌다). 슬롯 배열만
// `DIFFICULTIES` / `CONTRIBUTION_LEVELS` single-source import 재사용(슬롯 순서/누락
// drift 방지). 헤더/표 헤더 행/구분선 등 고정 리터럴은 가드 안에 미러링한다.
// assertSummaryStructure 통과 후에만 호출되므로 슬롯 객체 존재가 보장된다.
function composeExpectedMarkdown(summary: RealDataResultSummary): string {
  // difficulty 분포 표 행 — 반드시 DIFFICULTIES 순서대로 순회(키 enumeration 순서 무관).
  const difficultyRows = DIFFICULTIES.map(
    (difficulty) => `| ${difficulty} | ${summary.byDifficulty[difficulty]} |`,
  ).join("\n");

  // contribution 분포 표 행 — 반드시 CONTRIBUTION_LEVELS 순서대로 순회.
  const contributionRows = CONTRIBUTION_LEVELS.map(
    (level) => `| ${level} | ${summary.byContribution[level]} |`,
  ).join("\n");

  return [
    "## 실 평가 e2e 결과 요약",
    "",
    `- 평가 단위 수: ${summary.count}`,
    `- 총 volume: ${summary.totalVolume}`,
    "",
    "### difficulty 분포",
    "",
    "| difficulty | count |",
    "| --- | --- |",
    difficultyRows,
    "",
    "### contribution 분포",
    "",
    "| contribution | count |",
    "| --- | --- |",
    contributionRows,
  ].join("\n");
}

// assertSummaryStructure — `summary` 객체와 분포 슬롯 객체가 구조적으로 온전한지
// fail-fast 검증. 구조/타입 결손은 RangeError 가 아니라 TypeError 로 구분한다(값 정합
// 위반과 분리). count/totalVolume 값 자체의 type 은 검증하지 않는다 — template literal
// 이 어떤 값이든 문자열화하므로(컴포저와 동형) 재합성 결과가 markdown 과 drift 하면
// RangeError 로 잡힌다. 본 함수는 슬롯 순회(composeExpectedMarkdown)가 undefined 객체
// 접근으로 TypeError 를 던지기 전에 명세형 한국어 메시지로 먼저 차단하는 역할이다.
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
 * 실 평가 e2e 결과 요약 **마크다운** `markdown` 의 각 렌더 토큰이 `summary` descriptor
 * 필드만으로 독립 재합성한 마크다운과 byte-identical 정합함을 런타임에서 검증하는 순수
 * 가드(PLAN.md P5 109행 step ④ 표현 surface 무결성 조각 / REQ-059·REQ-032).
 * `renderRealDataResultSummaryMarkdown`(T-0581)의 값-정합 가드층 — 그 컴포저를 재호출하면
 * 합성 로직 자체의 값 drift 가 양방향 상쇄로 통과하므로, 본 가드는 출력 구조 리터럴을
 * 독립 재구현해 값/슬롯 순서 회귀를 fail-fast 로 잡는다.
 *
 * 불변식: expected = (`## 실 평가 e2e 결과 요약` 헤더 + `- 평가 단위 수: N` +
 * `- 총 volume: V` + `### difficulty 분포` 표(DIFFICULTIES 순서) + `### contribution
 * 분포` 표(CONTRIBUTION_LEVELS 순서))를 summary 필드만으로 재합성 후 `markdown` 과
 * byte-identical(===). 슬롯 값·순서는 `DIFFICULTIES` / `CONTRIBUTION_LEVELS`
 * single-source 고정 순서.
 *
 * 에러 정책: markdown 비-string/null/undefined·summary null/undefined·byDifficulty/
 * byContribution 누락 → TypeError. 독립 재합성 expected 와 markdown drift(count·volume·
 * 난이도/기여도 슬롯 값/순서·헤더/표 고정 리터럴) → RangeError(기대 vs 실측 노출).
 * silent 통과 0, fail-fast. 공백·줄바꿈·대소문자 민감(trim·case-fold 0).
 *
 * @param markdown 검증 대상 결과 요약 마크다운 문자열
 *   (`renderRealDataResultSummaryMarkdown` 산출). 변형하지 않는다(읽기·비교만).
 * @param summary 마크다운의 single source descriptor. 변형하지 않는다(읽기·비교만).
 * @returns 정합하면 정상 반환(void).
 * @throws {TypeError} markdown 비-string/null/undefined 또는 summary null/undefined·
 *   byDifficulty/byContribution 누락(구조 결손).
 * @throws {RangeError} 독립 재합성 expected 와 markdown drift(기대 vs 실측 포함, 값
 *   정합 위반).
 */
export function assertRealDataResultSummaryMarkdownConsistentWithSummary(
  markdown: string,
  summary: RealDataResultSummary,
): void {
  // 구조 검증(TypeError 분기) — markdown string 타입 + summary 존재 + 분포 슬롯 객체 존재.
  if (typeof markdown !== "string") {
    throw new TypeError(
      `markdown 이 string 이 아니다(값 정합 비교 불가 — 타입: ${typeof markdown}, 값: ${String(markdown)}).`,
    );
  }
  assertSummaryStructure(summary);

  // 마크다운 독립 재합성(컴포저 재호출 0) — summary 필드만으로 expected 를 직접 합성.
  const expected = composeExpectedMarkdown(summary);

  // 값 정합 비교(RangeError 분기) — byte-identical.
  if (markdown !== expected) {
    throw new RangeError(
      `정합 위반: markdown 이 summary 필드로부터 독립 재합성한 expected 와 byte-identical 하지 않다 — 기대='${expected}', 실측='${markdown}'. 마크다운 값 매핑(count/volume·난이도/기여도 슬롯 값·순서·헤더/표 고정 리터럴)이 drift 했거나 summary 와 어긋났다.`,
    );
  }
}
