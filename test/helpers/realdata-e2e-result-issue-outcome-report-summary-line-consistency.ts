// realdata-e2e-result-issue-outcome-report-summary-line-consistency.ts — 실 평가 e2e
// 결과 이슈 outcome-report 의 `summaryLine` 이 report 의 구성 4 필드(issueNumber/url/
// gitSha/dateToken)만으로 **독립 재합성**한 한 줄 요약과 byte-identical 정합한지 검증하는
// 순수 가드(T-0701 박제).
//
// 동기: 상위 from-output 가드(`assertRealDataResultIssueOutcomeReportConsistentWithOutput`,
// T-0663)는 expected 를 만들 때 **동일한 `buildRealDataResultIssueOutcomeReport`(T-0590)를
// 재호출**해 deep-equal 대조한다. 따라서 summaryLine 합성 로직 자체가 회귀로 drift(구분자
// 변경·필드 누락·순서 뒤바뀜)하면 양쪽이 똑같이 drift 해 가드가 잡지 못한다(재구현이 아닌
// 재호출의 한계). 본 가드는 summaryLine 템플릿을 컴포저 재호출 없이 **독립 재구현**해
// `report.summaryLine` 과 대조하므로 drift 가 양방향 상쇄되지 않고 build-time 에 fail-fast 로
// 잡힌다.
//
// 불변식: expected = `[${dateToken}@${gitSha}] 결과 이슈 #${issueNumber} 박제 → ${url}` 를
// report 4 필드만으로 직접 재합성 후 `report.summaryLine` 과 byte-identical(===).
// `buildRealDataResultIssueOutcomeReport` 재호출 0(from-output 가드가 이미 cover).
//
// 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError): report null/undefined·5 필드
// type 위반 → 한국어 TypeError. 독립 재합성 expected 와 summaryLine drift → 한국어 RangeError
// (기대 vs 실측 노출). silent 통과 0, fail-fast.
//
// 비변형 / 순수: report 읽기·비교만(쓰기 0). 부수효과·`@Injectable`·Prisma·LLM·새 외부
// dependency·env/네트워크/credential 0. 동일 report → 동일 동작. raw 미저장(R-59) — 식별자
// 필드만 재합성·비교.
//
// 패턴 mirror: `assertRealDataResultIssueOutcomeReportConsistentWithOutput`(T-0663) 의 에러
// 정책·한국어 메시지 톤을 따르되, **동일 컴포저 재호출이 아니라 summaryLine 템플릿을 독립
// 재구현**하는 점이 다르다(재호출 한계 보완).
//
// Out of Scope (T-0701): 컴포저 본문 수정 / self-wire 배선(후속 task) · from-output 가드
// 수정 · 자동 복구/재합성/정규화 · zod·ajv 등 외부 validation 도입 — 전부 0.
import type { RealDataResultIssueOutcomeReport } from "./realdata-e2e-result-issue-outcome-report";

// REPORT_NUMBER_FIELDS / REPORT_STRING_FIELDS — 구조 검증 대상 5 필드를 type 별로 분리해
// 결정론적 순회 검증한다(issueNumber 는 number, 나머지 4 종은 string).
const REPORT_NUMBER_FIELDS = ["issueNumber"] as const;
const REPORT_STRING_FIELDS = [
  "url",
  "gitSha",
  "dateToken",
  "summaryLine",
] as const;

// composeExpectedSummaryLine — report 의 식별자 4 필드만으로 expected summaryLine 을 독립
// 재합성한다. 컴포저(T-0590)의 템플릿을 의도적으로 재구현(`buildRealDataResultIssueOutcome
// Report` 재호출 0 — 재호출은 from-output 가드가 cover, 본 가드는 합성 로직 독립 재구현이라
// 양방향 drift 상쇄가 일어나지 않는다). url 은 report 의 값을 그대로 결합한다 — 컴포저가 이미
// trim 한 산출을 박았으므로, summaryLine 만 정규화되고 url 필드는 raw 면 drift 가 노출된다.
function composeExpectedSummaryLine(
  report: RealDataResultIssueOutcomeReport,
): string {
  return `[${report.dateToken}@${report.gitSha}] 결과 이슈 #${report.issueNumber} 박제 → ${report.url}`;
}

// assertReportStructure — `report` 객체와 5 필드의 type 이 구조적으로 온전한지 fail-fast
// 검증. 구조/타입 결손은 RangeError 가 아니라 TypeError 로 구분한다(값 정합 위반과 분리).
function assertReportStructure(
  report: RealDataResultIssueOutcomeReport | null | undefined,
): asserts report is RealDataResultIssueOutcomeReport {
  if (report === null || report === undefined) {
    throw new TypeError(
      "report 가 null/undefined 일 수 없다 — RealDataResultIssueOutcomeReport 객체가 필요하다.",
    );
  }
  for (const field of REPORT_NUMBER_FIELDS) {
    if (typeof report[field] !== "number") {
      throw new TypeError(
        `report.${field} 가 숫자가 아니다(타입: ${typeof report[field]}) — summaryLine 독립 재합성 정합 비교를 진행할 수 없다.`,
      );
    }
  }
  for (const field of REPORT_STRING_FIELDS) {
    if (typeof report[field] !== "string") {
      throw new TypeError(
        `report.${field} 가 문자열이 아니다(타입: ${typeof report[field]}) — summaryLine 독립 재합성 정합 비교를 진행할 수 없다.`,
      );
    }
  }
}

/**
 * outcome-report 의 `summaryLine` 이 report 의 구성 4 필드(issueNumber/url/gitSha/dateToken)
 * 만으로 독립 재합성한 한 줄 요약과 byte-identical 정합함을 런타임에서 검증하는 순수 가드
 * (PLAN.md P5 step ④ 결과 박제 chain 의 summaryLine-layer 무결성 조각).
 * `assertRealDataResultIssueOutcomeReportConsistentWithOutput`(T-0663) 보완 mirror — 그
 * 가드는 컴포저를 재호출해 deep-equal 대조하므로 합성 로직 자체의 drift 를 양방향 상쇄로
 * 놓치지만, 본 가드는 템플릿을 독립 재구현해 합성 회귀를 fail-fast 로 잡는다.
 *
 * 불변식: expected = `[${dateToken}@${gitSha}] 결과 이슈 #${issueNumber} 박제 → ${url}` 를
 * report 4 필드만으로 재합성 후 `report.summaryLine` 과 byte-identical(===).
 *
 * 에러 정책: report null/undefined·5 필드 type 위반 → TypeError. 독립 재합성 expected 와
 * summaryLine drift(구분자 변경·issueNumber mismatch·url drift·dateToken/gitSha swap 등) →
 * RangeError(기대 vs 실측 노출). silent 통과 0, fail-fast. 공백·대소문자 민감(trim·case-fold 0).
 *
 * @param report 검증 대상 outcome-report. 변형하지 않는다(읽기·비교만).
 * @returns 정합하면 정상 반환(void).
 * @throws {TypeError} report null/undefined 또는 5 필드 type 위반.
 * @throws {RangeError} 독립 재합성 expected 와 summaryLine drift(기대 vs 실측 포함).
 */
export function assertRealDataResultIssueOutcomeReportSummaryLineConsistent(
  report: RealDataResultIssueOutcomeReport,
): void {
  // 구조 검증(TypeError 분기) — report 존재 + 5 필드 type.
  assertReportStructure(report);

  // summaryLine 독립 재합성(컴포저 재호출 0) — 식별자 4 필드만으로 expected 를 직접 합성.
  const expected = composeExpectedSummaryLine(report);

  // 값 정합 비교(RangeError 분기) — byte-identical.
  if (report.summaryLine !== expected) {
    throw new RangeError(
      `정합 위반: report.summaryLine 이 구성 필드로부터 독립 재합성한 expected 와 byte-identical 하지 않다 — 기대='${expected}', 실측='${report.summaryLine}'. summaryLine 합성 로직이 drift 했거나 구성 필드와 어긋났다.`,
    );
  }
}
