// realdata-e2e-daily-step-dual-leg-run-report-markdown-consistency.ts — 실 평가 e2e
// daily-step dual-leg run report **마크다운 본문**의 각 렌더 슬롯이 report descriptor
// 필드(gitSha / dateToken / overallStatus / eval·collect {action,status} / summaryLine)
// 만으로 **독립 재유도**한 마크다운과 byte-identical 정합한지 검증하는 순수 가드(T-0986 박제).
//
// 동기: leaf 렌더러 `renderRealDataDailyStepDualLegRunReportMarkdown`(T-0895,
// realdata-e2e-daily-step-dual-leg-run-report-markdown.ts)은 `RealDataDailyStepDualLegRunReport`
// 를 rolling-issue 박제용 **결정론적 마크다운 문자열**로 변환한다(고정 순서: `## 실 평가
// e2e daily-step dual-leg run report` 헤더 → `- git sha:` → `- date token:` →
// `- overall status:` → `### leg 별 run outcome` 표(eval→collect 고정 행) → `- summary:`).
// summary 축(descriptor T-0580 → 렌더러 T-0581 → 값-정합 가드 T-0713)과 달리 이 dual-leg
// run report 축은 렌더러(T-0895)만 있고 그 산출을 독립 oracle 로 재유도-대조하는 drift-guard
// 가 부재였다 — 렌더 규칙(헤더 문구·슬롯 순서·`eval→collect` 고정 행·표 헤더/구분선 리터럴·
// 각 라인 prefix·빈-공백 guard)이 편집되면서 그 조합을 렌더러 자신의 spec 이 커버하지 못하면
// 손상/mislabel 된 리포트 본문이 조용히 이슈로 새어나갈 수 있었다. 본 가드는 렌더러를 재호출
// 하지 않고 report 필드만으로 expected 마크다운을 독립 재유도(고정 리터럴은 가드 안에 미러링)
// 한 뒤 실제 `markdown` 과 byte-identical 대조해, 값/구조 drift 가 상쇄되지 않고 fail-fast 로
// 잡히게 한다. result-summary-markdown-consistency(T-0713)의 dual-leg-report-leg mirror.
//
// 불변식: expected = (`## 실 평가 e2e daily-step dual-leg run report` 헤더 + `- git sha:
//   ${gitSha}` + `- date token: ${dateToken}` + `- overall status: ${overallStatus}` +
//   빈 줄 + `### leg 별 run outcome` + 빈 줄 + `| leg | action | status |` 표 헤더 +
//   `| --- | --- | --- |` 구분선 + `| eval | ${eval.action} | ${eval.status} |` +
//   `| collect | ${collect.action} | ${collect.status} |` + 빈 줄 + `- summary:
//   ${summaryLine}`)를 report 필드만으로 직접 재유도 후 `markdown` 과 byte-identical(===).
// `renderRealDataDailyStepDualLegRunReportMarkdown` 재호출 0(재호출은 양방향 drift 상쇄가
// 일어나므로 렌더 로직을 독립 재구현해야 값·구조 회귀가 fail-fast 로 잡힌다). eval→collect
// 고정 행 순서·헤더/표 골격 리터럴은 가드 안에 하드코딩 미러링한다.
//
// 에러 정책(구조 결손 = TypeError / 문자열·값 drift = RangeError): markdown 이 string
// 아님·report null/undefined·비-객체·gitSha/dateToken/summaryLine 비-string·overallStatus
// 비-string·eval/collect 비-객체 → 한국어 TypeError. gitSha/dateToken/summaryLine 이
// 빈/공백-only 면 렌더러 규약대로 재유도 단계에서 비식별 리포트로 간주해 TypeError. 독립
// 재유도 expected 와 markdown drift(헤더·식별자 슬롯·overallStatus·leg 표 행·표 헤더/구분선·
// summary) → 한국어 RangeError(기대 vs 실측 노출). silent 통과 0, fail-fast. 공백·줄바꿈·
// 대소문자 민감(trim·case-fold 0).
//
// 비변형 / 순수: markdown·report 읽기·비교만(쓰기 0). 부수효과·`@Injectable`·Prisma·LLM·
// 새 외부 dependency·env/네트워크/credential 0. 동일 입력 → 동일 동작. raw 활동 본문(commit/
// PR/issue payload) 미저장(R-59 / REQ-032) — report descriptor·마크다운 구조만 재유도·비교.
//
// Out of Scope (T-0986): 렌더러 본문 수정 / self-wire 배선(후속 slice) · descriptor
// 컴포저(T-0894) 수정 · 자동 복구/재합성/정규화 · zod·ajv 등 외부 validation 도입 — 전부 0.
import type { RealDataDailyStepDualLegRunReport } from "./realdata-e2e-daily-step-dual-leg-run-report";

// 에러 메시지 접두 — 선택 label 을 붙여 어느 대조 지점에서 drift/결손이 났는지 식별한다.
function contextPrefix(label?: string): string {
  return label !== undefined && label.length > 0 ? `[${label}] ` : "";
}

// assertReportStructure — `report` 객체와 하위 슬롯이 구조적으로 온전한지 fail-fast 검증.
// 구조/타입 결손은 RangeError 가 아니라 TypeError 로 구분한다(값·문자열 drift 와 분리).
// 독립 재유도(composeExpectedMarkdown)가 undefined 접근으로 TypeError 를 던지기 전에
// 명세형 한국어 메시지로 먼저 차단하는 역할이다.
function assertReportStructure(
  report: RealDataDailyStepDualLegRunReport | null | undefined,
  label?: string,
): asserts report is RealDataDailyStepDualLegRunReport {
  const ctx = contextPrefix(label);
  if (report === null || report === undefined) {
    throw new TypeError(
      `${ctx}report 가 null/undefined 일 수 없다 — RealDataDailyStepDualLegRunReport descriptor 객체가 필요하다.`,
    );
  }
  if (typeof report !== "object") {
    throw new TypeError(
      `${ctx}report 가 객체가 아니다(타입: ${typeof report}) — dual-leg run report descriptor 객체가 필요하다.`,
    );
  }
  if (typeof report.gitSha !== "string") {
    throw new TypeError(
      `${ctx}report.gitSha 가 string 이 아니다(타입: ${typeof report.gitSha}) — 독립 재유도를 진행할 수 없다.`,
    );
  }
  if (typeof report.dateToken !== "string") {
    throw new TypeError(
      `${ctx}report.dateToken 가 string 이 아니다(타입: ${typeof report.dateToken}) — 독립 재유도를 진행할 수 없다.`,
    );
  }
  if (typeof report.overallStatus !== "string") {
    throw new TypeError(
      `${ctx}report.overallStatus 가 string 이 아니다(타입: ${typeof report.overallStatus}) — 독립 재유도를 진행할 수 없다.`,
    );
  }
  if (typeof report.summaryLine !== "string") {
    throw new TypeError(
      `${ctx}report.summaryLine 가 string 이 아니다(타입: ${typeof report.summaryLine}) — 독립 재유도를 진행할 수 없다.`,
    );
  }
  if (report.eval === null || typeof report.eval !== "object") {
    throw new TypeError(
      `${ctx}report.eval 가 누락된/비-객체 불완전 descriptor 일 수 없다 — eval leg 슬롯 독립 재유도를 진행할 수 없다.`,
    );
  }
  if (report.collect === null || typeof report.collect !== "object") {
    throw new TypeError(
      `${ctx}report.collect 가 누락된/비-객체 불완전 descriptor 일 수 없다 — collect leg 슬롯 독립 재유도를 진행할 수 없다.`,
    );
  }
}

// assertNonBlank — 렌더러(T-0895)의 `assertNonBlank` 규약과 동형. gitSha/dateToken/
// summaryLine 이 빈/공백-only 면 비식별 리포트로 간주해 재유도 단계에서 명시 throw(조용한
// 통과 차단). 렌더러는 이 경우 렌더를 거부하므로, 정합 markdown 이 존재할 수 없는 비식별
// 입력을 가드가 byte 대조 전에 구조 결손(TypeError)으로 먼저 차단한다.
function assertNonBlank(
  value: string,
  fieldName: string,
  label?: string,
): void {
  if (value.trim().length === 0) {
    throw new TypeError(
      `${contextPrefix(label)}${fieldName} 가 비어있습니다 — 비식별 dual-leg run report 마크다운 방지를 위해 빈/공백-only 값은 허용되지 않습니다.`,
    );
  }
}

// composeExpectedMarkdown — report 의 gitSha/dateToken/overallStatus + eval·collect
// {action,status} + summaryLine 만으로 expected 마크다운을 독립 재유도한다. 렌더러(T-0895)의
// 출력 구조 리터럴(헤더·표 골격·줄바꿈·라인 prefix)을 의도적으로 재구현
// (`renderRealDataDailyStepDualLegRunReportMarkdown` 재호출 0 — 재호출은 양방향 drift 상쇄가
// 일어나므로 합성 로직을 독립 재구현해야 값·구조 회귀가 fail-fast 로 잡힌다). eval→collect
// 고정 행 순서(입력 키 enumeration 순서 무관)와 표 헤더/구분선 리터럴을 가드 안에 미러링한다.
// assertReportStructure + assertNonBlank 통과 후에만 호출되므로 슬롯 존재·식별자 비-공백이
// 보장된다.
function composeExpectedMarkdown(
  report: RealDataDailyStepDualLegRunReport,
): string {
  // per-leg 표기 행 — 반드시 eval→collect 고정 순서(입력 키 순서 무관).
  const legRows = [
    `| eval | ${report.eval.action} | ${report.eval.status} |`,
    `| collect | ${report.collect.action} | ${report.collect.status} |`,
  ].join("\n");

  return [
    "## 실 평가 e2e daily-step dual-leg run report",
    "",
    `- git sha: ${report.gitSha}`,
    `- date token: ${report.dateToken}`,
    `- overall status: ${report.overallStatus}`,
    "",
    "### leg 별 run outcome",
    "",
    "| leg | action | status |",
    "| --- | --- | --- |",
    legRows,
    "",
    `- summary: ${report.summaryLine}`,
  ].join("\n");
}

/**
 * 실 평가 e2e daily-step dual-leg run report **마크다운** `markdown` 의 각 렌더 슬롯이
 * `report` descriptor 필드만으로 독립 재유도한 마크다운과 byte-identical 정합함을 런타임에서
 * 검증하는 순수 가드(PLAN.md P5 109행 step ④ 결과-박제 surface 무결성 조각 / REQ-059·
 * REQ-032). `renderRealDataDailyStepDualLegRunReportMarkdown`(T-0895)의 값·구조-정합 가드층 —
 * 그 렌더러를 재호출하면 렌더 로직 자체의 drift 가 양방향 상쇄로 통과하므로, 본 가드는 출력
 * 구조 리터럴을 독립 재구현해 헤더·슬롯 순서·leg 표·식별자 값 회귀를 fail-fast 로 잡는다.
 *
 * 불변식: expected = (`## 실 평가 e2e daily-step dual-leg run report` 헤더 + `- git sha:` +
 * `- date token:` + `- overall status:` + `### leg 별 run outcome` 표(eval→collect 고정 행) +
 * `- summary:`)를 report 필드만으로 재유도 후 `markdown` 과 byte-identical(===). eval→collect
 * 고정 행 순서·표 골격 리터럴은 가드 안에 미러링.
 *
 * 에러 정책: markdown 비-string·report null/undefined·비-객체·gitSha/dateToken/summaryLine
 * 비-string·overallStatus 비-string·eval/collect 비-객체 → TypeError. gitSha/dateToken/
 * summaryLine 빈/공백-only(비식별 리포트) → TypeError. 독립 재유도 expected 와 markdown
 * drift(헤더·식별자 슬롯·overallStatus·leg 표 행·표 헤더/구분선·summary) → RangeError(기대 vs
 * 실측 노출). silent 통과 0, fail-fast. 공백·줄바꿈·대소문자 민감(trim·case-fold 0).
 *
 * @param report 마크다운의 single source descriptor. 변형하지 않는다(읽기·비교만).
 * @param markdown 검증 대상 dual-leg run report 마크다운 문자열
 *   (`renderRealDataDailyStepDualLegRunReportMarkdown` 산출). 변형하지 않는다(읽기·비교만).
 * @param label 선택 — 에러 메시지에 붙일 대조 지점 식별자.
 * @returns 정합하면 정상 반환(void).
 * @throws {TypeError} markdown 비-string 또는 report 구조 결손(null/비-객체·필드 타입 결손)
 *   또는 gitSha/dateToken/summaryLine 빈/공백-only(비식별 리포트).
 * @throws {RangeError} 독립 재유도 expected 와 markdown drift(기대 vs 실측 포함).
 */
export function assertRealDataDailyStepDualLegRunReportMarkdownConsistent(
  report: RealDataDailyStepDualLegRunReport,
  markdown: string,
  label?: string,
): void {
  const ctx = contextPrefix(label);

  // 구조 검증(TypeError 분기) — markdown string 타입 + report 존재·필드 타입 + leg 슬롯 존재.
  if (typeof markdown !== "string") {
    throw new TypeError(
      `${ctx}markdown 이 string 이 아니다(값 정합 비교 불가 — 타입: ${typeof markdown}, 값: ${String(markdown)}).`,
    );
  }
  assertReportStructure(report, label);

  // 비식별 식별자 guard(TypeError 분기) — 렌더러가 렌더를 거부하는 빈/공백-only 식별자는
  // 정합 markdown 이 존재할 수 없으므로 byte 대조 전에 구조 결손으로 먼저 차단한다.
  assertNonBlank(report.gitSha, "report.gitSha", label);
  assertNonBlank(report.dateToken, "report.dateToken", label);
  assertNonBlank(report.summaryLine, "report.summaryLine", label);

  // 마크다운 독립 재유도(렌더러 재호출 0) — report 필드만으로 expected 를 직접 합성.
  const expected = composeExpectedMarkdown(report);

  // 값·구조 정합 비교(RangeError 분기) — byte-identical.
  if (markdown !== expected) {
    throw new RangeError(
      `${ctx}정합 위반: markdown 이 report 필드로부터 독립 재유도한 expected 와 byte-identical 하지 않다 — 기대='${expected}', 실측='${markdown}'. 마크다운 렌더 규칙(헤더 문구·식별자 슬롯·overallStatus·eval→collect leg 표 행·표 헤더/구분선·summary)이 drift 했거나 report 와 어긋났다.`,
    );
  }
}
