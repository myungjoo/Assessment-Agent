// realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-consistency.ts —
// 실 평가 e2e daily-step dual-leg run report 를 daily-test rolling-issue 박제용
// (title / marker / body) descriptor 로 묶는 순수 빌더
// `buildRealDataDailyStepDualLegRunReportIssueDescriptor`(T-0896,
// realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts) 의 산출이 report
// 필드(gitSha / dateToken / eval·collect / overallStatus / summaryLine)만으로 **독립
// 재유도**한 descriptor 와 필드별 byte-identical 정합한지 검증하는 순수 가드(T-0988 박제).
//
// 동기: eval-chain 3 sub-leg · collection-plan leg · daily-report markdown leg 는 모두
// producer → consistency(독립 oracle 재유도 대조) → self-wire 삼단이 완결됐으나(T-0976~
// T-0987), issue-박제 sub-helper vein(`-issue-descriptor` 등)은 `result-issue-*` 사촌과
// 달리 consistency 짝이 부재했다. 누군가 제목 prefix·marker 규약·runToken 결합 순서·body
// 2블록 결합(marker → 빈 줄 → markdown) 규칙을 편집하면서 producer 자신의 spec 이 그 특정
// 조합을 커버하지 못하면, mislabel/비멱등 이슈 박제 descriptor 가 조용히 새어나갈 수 있었다.
// 본 가드는 producer 를 재호출하지 않고 report 필드만으로 expected `{title, marker, body}`
// 를 독립 재유도(prefix 상수·runToken·body 결합 규칙을 가드 안에 미러링; body 의 마크다운
// 블록만 렌더러 T-0895 에 위임)한 뒤 실제 descriptor 와 필드별 byte-identical 대조해, 값/구조
// drift 가 상쇄되지 않고 fail-fast 로 잡히게 한다. T-0986(daily-report markdown) consistency
// 신설 패턴의 issue-descriptor-leg mirror.
//
// oracle 독립성: **issue-descriptor helper(T-0896)를 import 하지 않는다**(재유도는 prefix
// 상수·runToken·body 결합 규칙을 재현). body 의 마크다운 블록만 렌더러 T-0895 에 value
// import 로 위임한다(마크다운 내부 규칙은 T-0986 domain — 본 oracle 은 issue-descriptor
// 조립 축 title/marker/body 결합만 검증, 마크다운 규칙 재구현 0).
//
// 에러 정책(구조 결손 = TypeError / 값 drift = RangeError): descriptor 가 null/undefined·
// 비-객체·title/marker/body 필드 부재·비-string → 한국어 TypeError. report 의 gitSha/
// dateToken 이 빈/공백-only 면 재유도 단계에서 producer(T-0896)와 동형 Error(비식별 이슈
// 박제 방지)를 던진다. 독립 재유도 expected 와 descriptor drift(title prefix/token·marker
// prefix/token/`-->` 종결·body 의 marker 라인/빈 줄 구분/마크다운 블록) → 한국어
// RangeError(기대 vs 실측 노출). silent 통과 0, fail-fast. 공백·줄바꿈·대소문자 민감.
//
// 비변형 / 순수: report·descriptor 읽기·비교만(쓰기 0). 부수효과·`@Injectable`·Prisma·LLM·
// 새 외부 dependency·env/네트워크/credential 0. 동일 입력 → 동일 동작. raw 활동 본문(commit/
// PR/issue payload) 미저장(R-59 / REQ-032) — report descriptor·issue descriptor 구조만 재유도.
//
// Out of Scope (T-0988): producer 본문 수정 / self-wire 배선(후속 slice, T-0985/T-0987
// mirror) · 렌더러(T-0895)·컴포저(T-0894) 수정 · 마크다운 내부 규칙 재유도(T-0986 위임) ·
// 자동 복구/재합성/정규화 · zod·ajv 등 외부 validation 도입 — 전부 0.
import type { RealDataDailyStepDualLegRunReport } from "./realdata-e2e-daily-step-dual-leg-run-report";
import type { RealDataDailyStepDualLegRunReportIssueDescriptor } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor";
import { renderRealDataDailyStepDualLegRunReportMarkdown } from "./realdata-e2e-daily-step-dual-leg-run-report-markdown";

// producer(T-0896)의 조립 규칙 상수 미러링 — issue-descriptor helper 를 import 하지 않고
// 규칙만 독립 재현한다(재호출은 양방향 drift 상쇄가 일어나므로 재구현해야 회귀가 fail-fast).
const ISSUE_TITLE_PREFIX = "실 평가 e2e daily-step dual-leg run report";
const ISSUE_MARKER_PREFIX =
  "<!-- realdata-e2e-daily-step-dual-leg-run-report-issue:";

// 에러 메시지 접두 — 선택 label 을 붙여 어느 대조 지점에서 drift/결손이 났는지 식별한다.
function contextPrefix(label?: string): string {
  return label !== undefined && label.length > 0 ? `[${label}] ` : "";
}

// assertDescriptorStructure — `descriptor` 객체와 title/marker/body 슬롯이 구조적으로
// 온전한지 fail-fast 검증. 구조/타입 결손은 RangeError 가 아니라 TypeError 로 구분한다(값
// drift 와 분리). 필드별 byte-identical 대조가 undefined 접근으로 던지기 전에 명세형 한국어
// 메시지로 먼저 차단하는 역할이다.
function assertDescriptorStructure(
  descriptor:
    | RealDataDailyStepDualLegRunReportIssueDescriptor
    | null
    | undefined,
  label?: string,
): asserts descriptor is RealDataDailyStepDualLegRunReportIssueDescriptor {
  const ctx = contextPrefix(label);
  if (descriptor === null || descriptor === undefined) {
    throw new TypeError(
      `${ctx}descriptor 가 null/undefined 일 수 없다 — RealDataDailyStepDualLegRunReportIssueDescriptor 객체가 필요하다.`,
    );
  }
  if (typeof descriptor !== "object") {
    throw new TypeError(
      `${ctx}descriptor 가 객체가 아니다(타입: ${typeof descriptor}) — issue descriptor 객체가 필요하다.`,
    );
  }
  if (typeof descriptor.title !== "string") {
    throw new TypeError(
      `${ctx}descriptor.title 가 string 이 아니다(타입: ${typeof descriptor.title}) — 필드별 정합 대조를 진행할 수 없다.`,
    );
  }
  if (typeof descriptor.marker !== "string") {
    throw new TypeError(
      `${ctx}descriptor.marker 가 string 이 아니다(타입: ${typeof descriptor.marker}) — 필드별 정합 대조를 진행할 수 없다.`,
    );
  }
  if (typeof descriptor.body !== "string") {
    throw new TypeError(
      `${ctx}descriptor.body 가 string 이 아니다(타입: ${typeof descriptor.body}) — 필드별 정합 대조를 진행할 수 없다.`,
    );
  }
}

// assertNonBlank — producer(T-0896)의 `assertNonBlank` 규약과 동형(plain Error). gitSha/
// dateToken 이 빈/공백-only 면 비식별 이슈 박제로 간주해 재유도 단계에서 명시 throw(조용한
// 통과 차단). producer 가 이 경우 descriptor 산출을 거부하므로, 정합 descriptor 가 존재할 수
// 없는 비식별 입력을 가드가 필드 대조 전에 producer 와 동형 Error 로 먼저 차단한다.
function assertNonBlank(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new Error(
      `RealDataDailyStepDualLegRunReport.${fieldName} 가 비어있습니다 — 비식별 dual-leg run report 이슈 박제 방지를 위해 빈/공백-only 식별자는 허용되지 않습니다.`,
    );
  }
}

// runToken — producer(T-0896) runToken 규약 미러링. dateToken + gitSha 를 결합해 동일 run
// 이면 동일, 서로 다른 run 이면 다른 안정 합성 토큰. 제목·marker 에 공통으로 쓰인다.
function runToken(report: RealDataDailyStepDualLegRunReport): string {
  return `${report.dateToken}@${report.gitSha}`;
}

// composeExpectedDescriptor — report 의 gitSha/dateToken(+ body 는 렌더러 위임)만으로
// expected `{title, marker, body}` 를 독립 재유도한다. producer(T-0896)의 조립 규칙(제목
// prefix + token / marker prefix + token + `-->` 종결 / body = [marker, "", markdown]
// join)을 가드 안에 재구현(producer 재호출 0). body 의 마크다운 블록만 렌더러 T-0895 에
// 위임한다(마크다운 내부 규칙 재구현 0 — T-0986 domain). assertNonBlank 통과 후에만
// 호출되므로 식별자 비-공백이 보장된다.
function composeExpectedDescriptor(
  report: RealDataDailyStepDualLegRunReport,
): RealDataDailyStepDualLegRunReportIssueDescriptor {
  const token = runToken(report);
  const title = `${ISSUE_TITLE_PREFIX} ${token}`;
  // marker 는 동일 run → 동일(leg status/overallStatus 무관). `-->` 로 종결.
  const marker = `${ISSUE_MARKER_PREFIX} ${token} -->`;
  // body = marker 라인 + 빈 줄 + 마크다운 본문(렌더러 위임) 을 개행으로 결합.
  const body = [
    marker,
    "",
    renderRealDataDailyStepDualLegRunReportMarkdown(report),
  ].join("\n");
  return { title, marker, body };
}

/**
 * 실 평가 e2e daily-step dual-leg run report 의 issue 박제 **descriptor** `descriptor` 의
 * title / marker / body 각 필드가 `report` descriptor 필드만으로 독립 재유도한 descriptor 와
 * byte-identical 정합함을 런타임에서 검증하는 순수 가드(PLAN.md P5 109행 step ④ 결과-박제
 * surface 무결성 조각 / REQ-059·REQ-032). producer
 * `buildRealDataDailyStepDualLegRunReportIssueDescriptor`(T-0896)의 값·구조-정합 가드층 — 그
 * producer 를 재호출하면 조립 로직 자체의 drift 가 양방향 상쇄로 통과하므로, 본 가드는 조립
 * 규칙(prefix 상수·runToken·body 결합)을 독립 재구현해 제목 prefix/token·marker 규약·body 2블록
 * 결합 회귀를 fail-fast 로 잡는다. body 의 마크다운 블록만 렌더러 T-0895 에 위임한다.
 *
 * 불변식: expected = (`${ISSUE_TITLE_PREFIX} ${dateToken}@${gitSha}` title +
 * `${ISSUE_MARKER_PREFIX} ${dateToken}@${gitSha} -->` marker +
 * `[marker, "", renderMarkdown(report)].join("\n")` body)를 report 필드만으로 재유도 후
 * `descriptor` 와 필드별 byte-identical(===). issue-descriptor helper 재호출 0.
 *
 * 에러 정책: descriptor null/undefined·비-객체·title/marker/body 비-string → TypeError.
 * report.gitSha/dateToken 빈/공백-only(비식별 이슈 박제) → producer 와 동형 Error. 독립 재유도
 * expected 와 descriptor drift(title·marker·body) → RangeError(기대 vs 실측 노출). silent 통과
 * 0, fail-fast. 공백·줄바꿈·대소문자 민감(trim·case-fold 0).
 *
 * @param report descriptor 의 single source. 변형하지 않는다(읽기·비교만).
 * @param descriptor 검증 대상 issue descriptor(producer 산출). 변형하지 않는다(읽기·비교만).
 * @param label 선택 — 에러 메시지에 붙일 대조 지점 식별자.
 * @returns 정합하면 정상 반환(void).
 * @throws {TypeError} descriptor 구조 결손(null/비-객체·title/marker/body 비-string).
 * @throws {Error} report.gitSha/dateToken 빈/공백-only(producer 와 동형).
 * @throws {RangeError} 독립 재유도 expected 와 descriptor drift(기대 vs 실측 포함).
 */
export function assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(
  report: RealDataDailyStepDualLegRunReport,
  descriptor: RealDataDailyStepDualLegRunReportIssueDescriptor,
  label?: string,
): void {
  const ctx = contextPrefix(label);

  // 구조 검증(TypeError 분기) — descriptor 존재·title/marker/body 필드 타입.
  assertDescriptorStructure(descriptor, label);

  // 비식별 식별자 guard(producer 동형 Error) — producer 가 산출을 거부하는 빈/공백-only
  // 식별자는 정합 descriptor 가 존재할 수 없으므로 재유도(및 필드 대조) 전에 먼저 차단한다.
  assertNonBlank(report.gitSha, "gitSha");
  assertNonBlank(report.dateToken, "dateToken");

  // 독립 재유도(producer 재호출 0) — report 필드만으로 expected 를 직접 합성.
  const expected = composeExpectedDescriptor(report);

  // 필드별 값·구조 정합 비교(RangeError 분기) — title / marker / body 각 byte-identical.
  if (descriptor.title !== expected.title) {
    throw new RangeError(
      `${ctx}정합 위반(title): descriptor.title 이 report 필드로부터 독립 재유도한 expected 와 byte-identical 하지 않다 — 기대='${expected.title}', 실측='${descriptor.title}'. 제목 prefix·runToken(dateToken@gitSha) 결합 규칙이 drift 했다.`,
    );
  }
  if (descriptor.marker !== expected.marker) {
    throw new RangeError(
      `${ctx}정합 위반(marker): descriptor.marker 가 report 필드로부터 독립 재유도한 expected 와 byte-identical 하지 않다 — 기대='${expected.marker}', 실측='${descriptor.marker}'. marker prefix·runToken·'-->' 종결 규약이 drift 했다.`,
    );
  }
  if (descriptor.body !== expected.body) {
    throw new RangeError(
      `${ctx}정합 위반(body): descriptor.body 가 report 필드로부터 독립 재유도한 expected 와 byte-identical 하지 않다 — 기대='${expected.body}', 실측='${descriptor.body}'. body 결합 규칙(marker 라인·빈 줄 구분·마크다운 본문 위임)이 drift 했거나 report 와 어긋났다.`,
    );
  }
}
