// realdata-e2e-result-issue-outcome-report-output-consistency.ts — 실 평가 e2e 결과 이슈
// outcome-report 종단 컴포저 `buildRealDataResultIssueOutcomeReport`(T-0590) 의 **산출**
// (`RealDataResultIssueOutcomeReport` = `{issueNumber, url, gitSha, dateToken, summaryLine}`)
// 5 필드 전체가 입력 `(outcome, run)` 으로부터 **컴포저 재호출 없이 독립 재유도**한 expected
// 와 deep-equal 정합한지 검증하는 순수 가드(T-0725 박제).
//
// 동기: NO-GUARD-value leaf 컴포저 `buildRealDataResultIssueOutcomeReport`(T-0590,
// realdata-e2e-result-issue-outcome-report.ts)는 현재 두 가드만 self-wire 한다 —
// (1) `assertRealDataResultIssueOutcomeReportSummaryLineConsistent`(T-0701/T-0702, **summaryLine
// 단일 필드** 가 구성 4 필드와 내부 정합한지만 검증) (2) `from-output` 래퍼 가드(T-0663) 는
// expected 를 만들 때 **동일 컴포저를 재호출** 해 deep-equal 하므로 leaf 자체의 독립 재유도가
// 아니다(양방향 drift 상쇄). 그래서 issueNumber/url/gitSha/dateToken **전파** 가 어긋나거나
// url trim 정규화가 누락돼도, summaryLine 만 그 어긋난 구성 필드에 정합하면 두 가드를 전부
// 통과한다 — **컴포저 산출 5 필드 전체를 입력으로부터 독립 재유도해 대조하는 값-정합 가드는
// 부재**였다. 본 가드는 컴포저 재호출 없이 `(outcome, run)` 만으로 expected 5 필드를 독립
// 재유도(issueNumber/gitSha/dateToken 전파 → `url = outcome.url.trim()` 정규화 → summaryLine
// 동형 합성)한 뒤 산출 `report` 와 deep-equal 대조해, 그 값 drift 가 build-time fail-fast 로
// 차단되게 한다(REQ-032 raw 미저장·REQ-059 입력 외 데이터 생성 0 — 컴포저가 silent 하게 잘못된
// issueNumber/url 을 전파하거나 잘못된 summaryLine 을 합성하면 손상 report 가 step④ 박제/로그
// emit wiring 으로 새기 전 차단). T-0723 output-parse value-guard 의 outcome-report 측 mirror.
//
// 재유도 규칙(single-source 동형): 컴포저(T-0590)와 동일한 산출 규약을 **독립 재구현**한다
// — run.gitSha/dateToken 빈/공백 → throw, outcome.url 빈/공백 → throw, outcome.issueNumber
// 양의 정수(0/음수/비정수 throw), `url = outcome.url.trim()` 정규화, summaryLine 을
// `[${dateToken}@${gitSha}] 결과 이슈 #${issueNumber} 박제 → ${url}` 로 동형 합성. 통과분을
// `{issueNumber, url, gitSha, dateToken, summaryLine}` 5 키 객체로 정규화한다. 컴포저
// (`buildRealDataResultIssueOutcomeReport`)는 **호출하지 않는다** — 재호출 deep-equal 은 양방향
// drift 상쇄라 무의미하다(독립 재유도가 핵심). summaryLine 템플릿·양정수·빈/공백 규약은 컴포저와
// byte-identical 하게 본 모듈이 재구현한다(재호출 0 원칙 유지).
//
// 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
//   - `report`/`outcome`/`run` 이 non-null 객체 아님·report 5 필드 type 위반·outcome.issueNumber
//     비양정수·outcome.url 빈/공백·run.gitSha/dateToken 빈/공백 등 입력 자체의 구조 결손 →
//     한국어 TypeError(재유도/비교 자체를 진행할 수 없는 경우).
//   - 재유도 expected 와 산출 report 의 어느 5 필드라도 값이 어긋남 → 한국어 RangeError
//     (값 정합 위반, 어느 필드가 기대 vs 실측 으로 drift 했는지 노출).
//   - silent 통과 0, fail-fast. 공백·대소문자 민감(추가 trim·case-fold 0 — url trim 은 컴포저
//     규약 그대로 재현).
//
// 비변형 / 순수: report·outcome·run 읽기·비교만(쓰기 0). 부수효과·`@Injectable`·Prisma·LLM·
// 새 외부 dependency·env/네트워크/credential·gh 실행 0. 동일 입력 → 동일 동작. raw narrative
// 미저장(R-59 / REQ-032) — issueNumber(식별자)·url·gitSha·dateToken·summaryLine 의 동치만
// 비교하며 에러 메시지에 raw 활동 본문·credential 을 누설하지 않는다(report 필드 값만 노출,
// 비-report 본문 미보유).
//
// Out of Scope (T-0725): 컴포저 본문 수정 / self-wire 배선(후속 task — T-0723→T-0724 분리
// 패턴 동형) · summaryLine 내부 정합 가드(T-0701/T-0702) 수정 · from-output 가드(T-0663/T-0664)
// 수정 · 자동 복구/재합성/정규화 · zod·ajv 등 외부 validation 도입 · production `src/` 변경 — 전부 0.
import type { RealDataResultIssueRunRef } from "./realdata-e2e-result-issue-descriptor";
import type { RealDataResultIssueOutcomeReport } from "./realdata-e2e-result-issue-outcome-report";
import type { RealDataResultIssueOutcome } from "./realdata-e2e-result-issue-output-parse";

// REPORT_NUMBER_FIELDS / REPORT_STRING_FIELDS — 산출 report 구조 검증 대상 5 필드를 type 별로
// 분리해 결정론적 순회 검증한다(issueNumber 는 number, 나머지 4 종은 string). summary-line
// 가드(T-0701)의 동일 규약과 정합.
const REPORT_NUMBER_FIELDS = ["issueNumber"] as const;
const REPORT_STRING_FIELDS = [
  "url",
  "gitSha",
  "dateToken",
  "summaryLine",
] as const;

// assertNonBlankInput — 입력 식별자/URL 문자열이 빈/공백-only 면 구조 결손 TypeError. 컴포저
// (T-0590 `assertNonBlank`)의 빈/공백 차단 규약을 독립 재구현한다(재호출 0). 비식별 입력이
// 재유도로 새는 것을 차단한다.
function assertNonBlankInput(value: unknown, fieldName: string): void {
  if (typeof value !== "string") {
    throw new TypeError(
      `${fieldName} 가 문자열이 아니다(타입: ${typeof value}, 값: ${String(
        value,
      )}) — outcome-report 산출 독립 재유도를 진행할 수 없다.`,
    );
  }
  if (value.trim().length === 0) {
    throw new TypeError(
      `${fieldName} 가 비어있다(빈/공백-only) — 비식별 입력은 outcome-report 재유도 대상이 아니다.`,
    );
  }
}

// assertPositiveIssueNumberInput — outcome.issueNumber 가 양의 정수(0/음수/비정수 차단)인지
// 검증. 컴포저(T-0590 `assertPositiveIssueNumber`) 규약을 독립 재구현한다(재호출 0). 비정상
// number 가 재유도로 새는 것을 차단한다.
function assertPositiveIssueNumberInput(value: unknown): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new TypeError(
      `outcome.issueNumber 가 양의 정수가 아니다(${String(
        value,
      )}) — 0 이하/비정수/비-number 는 outcome-report 재유도 대상이 아니다.`,
    );
  }
}

// assertInputObject — `outcome`/`run` 입력이 deep-equal 재유도를 진행하기 전 구조적으로 온전한지
// (non-null 객체·비배열) fail-fast 검증한다. 구조 결손은 RangeError 가 아니라 TypeError 로
// 구분한다(값 정합 위반과 분리).
function assertInputObject(value: unknown, label: string): void {
  if (typeof value !== "object" || value === null) {
    throw new TypeError(
      `${label} 이 non-null 객체가 아니다(타입: ${typeof value}, 값: ${String(
        value,
      )}) — outcome-report 산출 독립 재유도를 진행할 수 없다.`,
    );
  }
  if (Array.isArray(value)) {
    throw new TypeError(
      `${label} 이 배열이다 — ${label} 은 키-값 객체여야 하며 배열일 수 없다.`,
    );
  }
}

// reDeriveExpectedReport — `(outcome, run)` 만으로 expected `RealDataResultIssueOutcomeReport`
// 5 필드를 **독립 재유도**한다. 컴포저(T-0590)의 산출 규약(run.gitSha/dateToken 빈/공백 guard →
// outcome.url 빈/공백 guard → issueNumber 양정수 guard → url trim 정규화 → summaryLine 동형
// 합성 → 5 키 정규화)을 의도적으로 재구현(`buildRealDataResultIssueOutcomeReport` 재호출 0 —
// 재호출은 양방향 drift 상쇄로 의미가 없다). 입력 자체의 구조 결손은 TypeError 로 분기한다(값
// 정합 위반 RangeError 와 구분). 입력 객체를 읽기만 하고 변형하지 않는다.
function reDeriveExpectedReport(
  outcome: RealDataResultIssueOutcome,
  run: RealDataResultIssueRunRef,
): RealDataResultIssueOutcomeReport {
  // 입력 객체 구조 검증(TypeError 분기).
  assertInputObject(outcome, "outcome");
  assertInputObject(run, "run");

  // run 식별자 guard(비식별 리포트 차단) — 컴포저 규약 동형 재구현.
  assertNonBlankInput(run.gitSha, "run.gitSha");
  assertNonBlankInput(run.dateToken, "run.dateToken");

  // 박제 결과 guard(비정상 outcome 차단) — 컴포저 규약 동형 재구현.
  assertNonBlankInput(outcome.url, "outcome.url");
  assertPositiveIssueNumberInput(outcome.issueNumber);

  // url 정규화(trailing 개행/공백 trim) — 컴포저와 동형.
  const url = outcome.url.trim();

  // summaryLine 동형 합성 — 컴포저 템플릿 byte-identical 재구현.
  const summaryLine = `[${run.dateToken}@${run.gitSha}] 결과 이슈 #${outcome.issueNumber} 박제 → ${url}`;

  // 5 키 정규화(추가 필드 0, 무공유).
  return {
    issueNumber: outcome.issueNumber,
    url,
    gitSha: run.gitSha,
    dateToken: run.dateToken,
    summaryLine,
  };
}

// assertReportStructure — 산출 `report` 와 5 필드의 type 이 deep-equal 비교를 진행하기 전
// 구조적으로 온전한지 fail-fast 검증. 구조/타입 결손은 RangeError 가 아니라 TypeError 로
// 구분한다(값 정합 위반과 분리). summary-line 가드(T-0701)의 동일 규약과 정합.
function assertReportStructure(
  report: RealDataResultIssueOutcomeReport,
): asserts report is RealDataResultIssueOutcomeReport {
  if (typeof report !== "object" || report === null) {
    throw new TypeError(
      `report 가 non-null 객체가 아니다(타입: ${typeof report}, 값: ${String(
        report,
      )}) — 컴포저 산출은 RealDataResultIssueOutcomeReport 객체여야 한다.`,
    );
  }
  if (Array.isArray(report)) {
    throw new TypeError(
      "report 가 배열이다 — report 는 {issueNumber, url, gitSha, dateToken, summaryLine} 키-값 객체여야 하며 배열일 수 없다.",
    );
  }
  for (const field of REPORT_NUMBER_FIELDS) {
    if (typeof report[field] !== "number") {
      throw new TypeError(
        `report.${field} 가 숫자가 아니다(타입: ${typeof report[field]}) — outcome-report 독립 재유도 정합 비교를 진행할 수 없다.`,
      );
    }
  }
  for (const field of REPORT_STRING_FIELDS) {
    if (typeof report[field] !== "string") {
      throw new TypeError(
        `report.${field} 가 문자열이 아니다(타입: ${typeof report[field]}) — outcome-report 독립 재유도 정합 비교를 진행할 수 없다.`,
      );
    }
  }
}

// isReportDeepEqual — 두 `RealDataResultIssueOutcomeReport` 가 5 필드(===)·추가필드 drop(키
// 정확히 5개) 면에서 deep-equal 인지 비교한다. 재유도 expected 는 항상 5 키만 가지므로 산출이
// 추가 키를 누설하면 키 개수(≠5) 불일치로 잡는다. 순수 비교(쓰기 0).
function isReportDeepEqual(
  actual: RealDataResultIssueOutcomeReport,
  expected: RealDataResultIssueOutcomeReport,
): boolean {
  // 추가필드 drop 정합 — 산출 report 가 정확히 5 키만 가져야 한다.
  if (Object.keys(actual).length !== 5) {
    return false;
  }
  return (
    actual.issueNumber === expected.issueNumber &&
    actual.url === expected.url &&
    actual.gitSha === expected.gitSha &&
    actual.dateToken === expected.dateToken &&
    actual.summaryLine === expected.summaryLine
  );
}

/**
 * 실 평가 e2e 결과 이슈 outcome-report 종단 컴포저 산출 `report` 의 **값** 5 필드 전체가 입력
 * `(outcome, run)` 으로부터 컴포저 재호출 없이 독립 재유도한 expected 와 deep-equal 정합함을
 * 런타임에서 검증하는 순수 가드(PLAN.md P5 step ④ 결과 박제 chain 의 표현 surface 무결성 조각
 * / REQ-059·REQ-032). `buildRealDataResultIssueOutcomeReport`(T-0590) summaryLine 내부 정합
 * 가드(T-0701) + from-output 재호출 가드(T-0663) 보완 mirror — 그 둘은 summaryLine 단일 필드
 * 내부 정합 또는 컴포저 재호출 deep-equal 이라 issueNumber/url/gitSha/dateToken 전파 drift·url
 * trim 누락을 놓치지만, 본 가드는 `(outcome, run)` 을 독립 재유도해 5 필드 전파 회귀를 fail-fast
 * 로 잡는다. T-0723 output-parse value-guard 의 outcome-report 측 mirror.
 *
 * 불변식: expected = `(outcome, run)` 에서 issueNumber/gitSha/dateToken 전파 → url 빈/공백·
 * issueNumber 양정수 guard → `url = outcome.url.trim()` 정규화 → summaryLine 동형 합성 →
 * `{issueNumber, url, gitSha, dateToken, summaryLine}` 5 키 정규화로 독립 재유도한 객체. 산출
 * `report` 와 5 필드 값·키 집합(추가필드 drop)이 전부 deep-equal(===) 이어야 한다. 컴포저
 * 재호출 0(독립 재유도).
 *
 * 에러 정책: report/outcome/run 비-non-null-객체/배열·report 5 필드 type 위반·outcome.issueNumber
 * 비양정수·outcome.url 빈/공백·run.gitSha/dateToken 빈/공백 → TypeError(구조 결손). 재유도
 * expected 와 report 가 5 필드 값·추가필드 면에서 drift → RangeError(기대 vs 실측 노출, 값 정합
 * 위반). silent 통과 0, fail-fast. 공백·대소문자 민감(추가 trim·case-fold 0 — url trim 만 컴포저
 * 규약 그대로 재현).
 *
 * @param report 검증 대상 컴포저 산출(`buildRealDataResultIssueOutcomeReport` 결과). 변형하지
 *   않는다(읽기·비교만).
 * @param outcome 산출의 single source 박제 결과(issueNumber/url). 변형하지 않는다(읽기·재유도만).
 * @param run 산출의 single source run 식별자(gitSha/dateToken). 변형하지 않는다(읽기·재유도만).
 * @returns 정합하면 정상 반환(void).
 * @throws {TypeError} report/outcome/run 비-non-null-객체/배열·report 5 필드 type 위반·
 *   outcome.issueNumber 비양정수·outcome.url 빈/공백·run.gitSha/dateToken 빈/공백(구조 결손).
 * @throws {RangeError} 재유도 expected 와 report 가 5 필드 값·추가필드 drift(값 정합 위반, 기대
 *   vs 실측 포함).
 */
export function assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(
  report: RealDataResultIssueOutcomeReport,
  outcome: RealDataResultIssueOutcome,
  run: RealDataResultIssueRunRef,
): void {
  // 구조 검증(TypeError 분기) — report 객체+5 필드 type 및 (outcome, run) 독립 재유도(내부에서
  // 입력 객체·문자열·issueNumber 구조 검증).
  assertReportStructure(report);
  const expected = reDeriveExpectedReport(outcome, run);

  // 값 정합 비교(RangeError 분기) — 5 필드 값·추가필드 deep-equal.
  if (!isReportDeepEqual(report, expected)) {
    throw new RangeError(
      `정합 위반: 컴포저 산출 report 가 (outcome, run) 으로부터 독립 재유도한 expected 와 deep-equal 하지 않다 — 기대=${JSON.stringify(
        expected,
      )}, 실측=${JSON.stringify(
        report,
      )}. issueNumber/url/gitSha/dateToken 전파 값·url trim 정규화·summaryLine 합성 또는 추가필드 drop 이 drift 했거나 입력과 어긋났다.`,
    );
  }
}
