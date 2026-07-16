// realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-body-consistency.ts —
// 실 평가 e2e daily-step dual-leg run report 의 issue 박제 descriptor 의 **body 2 블록
// 구조**(marker 라인 → 빈 줄 → 마크다운 본문) 불변식을 검증하는 순수 가드(T-0988 박제,
// T-1026 에서 body-focus 로 축소).
//
// 동기: eval-chain 3 sub-leg · collection-plan leg · daily-report markdown leg 는 모두
// producer → consistency(독립 oracle 재유도 대조) → self-wire 삼단이 완결됐으나(T-0976~
// T-0987), issue-박제 sub-helper vein(`-issue-descriptor` 등)은 `result-issue-*` 사촌과
// 달리 consistency 짝이 부재했다. 본 가드는 그 빈칸을 채운 뒤(T-0988), 요약축(`result-issue-*`)
// 과 동형인 **body/identity disjoint 2-가드** 구조로 정착했다(T-1026):
//   - 본 가드(body-consistency 역할) — body 2 블록 구조(marker 라인 → 빈 줄 → 마크다운
//     본문)만 검증. marker 는 body 첫 라인과의 일치만 비교(marker 합성 규칙 자체 재유도
//     안 함), 마크다운 블록은 렌더러 T-0895 에 위임.
//   - `assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent`(T-1024) —
//     title·marker 의 멱등 식별자(run token 공유) 재유도 정합을 전담하는 identity oracle.
//     producer 반환 직전 self-wire(T-1025) 로 live 트립와이어로 배선돼 있다.
// 즉 title·marker 식별자 재유도·대조는 identity oracle(T-1024/T-1025)에 위임하고, 본 가드는
// body 결합 축(marker 라인 위치 · 빈 줄 구분 · 마크다운 본문 위임)만 focused 하게 지킨다.
// 이는 요약축 `realdata-e2e-result-issue-descriptor-body-consistency.ts`(T-0646)의 daily-step
// mirror 다(요약축은 body **3 블록**[marker → 빈 줄 → 한 줄 요약 → 빈 줄 → markdown], daily
// 축은 body **2 블록**[marker → 빈 줄 → markdown] 이므로 3 블록을 2 블록으로 축소 적용).
//
// oracle 독립성: **issue-descriptor helper(T-0896)를 import 하지 않는다**. body 의 마크다운
// 블록만 렌더러 T-0895 에 value import 로 위임한다(마크다운 내부 규칙은 T-0986 domain — 본
// 가드는 body 2 블록 결합 축만 검증, 마크다운 규칙 재구현 0). marker 는 body 첫 라인과의 일치
// 만 비교하며, marker 합성 규칙(prefix·runToken·`-->` 종결) 자체 재유도는 identity oracle
// (T-1024)에 위임한다(본 가드에서 재구현 0).
//
// 에러 정책(구조 결손 = TypeError / 값 drift = RangeError): descriptor 가 null/undefined·
// 비-객체·marker/body 필드 부재·비-string → 한국어 TypeError. report 의 gitSha/dateToken 이
// 빈/공백-only 면 마크다운 재유도 전에 producer(T-0896)와 동형 Error(비식별 이슈 박제 방지)를
// 던진다. body 2 블록 구조 불변식(marker 라인 == 첫 라인 / 빈 줄 구분 / 마크다운 본문
// byte-identical) 위반 → 한국어 RangeError(기대 vs 실측 노출). silent 통과 0, fail-fast.
// 공백·줄바꿈·대소문자 민감.
//
// 비변형 / 순수: report·descriptor 읽기·비교만(쓰기 0). 부수효과·`@Injectable`·Prisma·LLM·
// 새 외부 dependency 0. 동일 입력 → 동일 동작. raw 활동 본문(commit/PR/issue payload)
// 미저장(R-59 / REQ-032) — report descriptor·issue descriptor 구조만 재유도.
//
// Out of Scope (T-1026): identity 가드 본체(T-1024) 수정 / producer 본문·self-wire 배선(T-1025
// 완료) 변경 · title·marker 식별자 재유도 재도입(identity oracle 위임) · 렌더러(T-0895)·
// 컴포저(T-0894) 수정 · 마크다운 내부 규칙 재유도(T-0986 위임) · 함수명·파일명·export 시그니처
// 개명(별도 Follow-up) · 자동 복구/재합성/정규화 · zod·ajv 등 외부 validation 도입 — 전부 0.
import type { RealDataDailyStepDualLegRunReport } from "./realdata-e2e-daily-step-dual-leg-run-report";
import type { RealDataDailyStepDualLegRunReportIssueDescriptor } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor";
import { renderRealDataDailyStepDualLegRunReportMarkdown } from "./realdata-e2e-daily-step-dual-leg-run-report-markdown";

// 에러 메시지 접두 — 선택 label 을 붙여 어느 대조 지점에서 drift/결손이 났는지 식별한다.
function contextPrefix(label?: string): string {
  return label !== undefined && label.length > 0 ? `[${label}] ` : "";
}

// assertDescriptorStructure — `descriptor` 객체와 marker/body 슬롯이 구조적으로 온전한지
// fail-fast 검증. 구조/타입 결손은 RangeError 가 아니라 TypeError 로 구분한다(값 drift 와
// 분리). body 2 블록 대조가 undefined 접근으로 던지기 전에 명세형 한국어 메시지로 먼저
// 차단하는 역할이다. title 은 body-focus 가드의 관심사가 아니므로 검증하지 않는다(title·
// marker 식별자 정합은 identity oracle T-1024 domain — 본 가드는 marker 를 body 첫 라인과의
// 일치 비교에만 사용하므로 marker string 여부만 확인).
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
  if (typeof descriptor.marker !== "string") {
    throw new TypeError(
      `${ctx}descriptor.marker 가 string 이 아니다(타입: ${typeof descriptor.marker}) — body 첫 라인과의 일치 비교를 진행할 수 없다.`,
    );
  }
  if (typeof descriptor.body !== "string") {
    throw new TypeError(
      `${ctx}descriptor.body 가 string 이 아니다(타입: ${typeof descriptor.body}) — body 2 블록 구조 검증을 진행할 수 없다.`,
    );
  }
}

// assertNonBlank — producer(T-0896)의 `assertNonBlank` 규약과 동형(plain Error). gitSha/
// dateToken 이 빈/공백-only 면 비식별 이슈 박제로 간주해 마크다운 재유도 단계에서 명시
// throw(조용한 통과 차단). producer 가 이 경우 descriptor 산출을 거부하므로, 정합 descriptor 가
// 존재할 수 없는 비식별 입력을 가드가 body 대조 전에 producer 와 동형 Error 로 먼저 차단한다.
function assertNonBlank(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new Error(
      `RealDataDailyStepDualLegRunReport.${fieldName} 가 비어있습니다 — 비식별 dual-leg run report 이슈 박제 방지를 위해 빈/공백-only 식별자는 허용되지 않습니다.`,
    );
  }
}

/**
 * 실 평가 e2e daily-step dual-leg run report 의 issue 박제 **descriptor** `descriptor` 의
 * **body 2 블록 구조**(marker 라인 → 빈 줄 → 마크다운 본문) 불변식을 런타임에서 검증하는
 * 순수 가드(PLAN.md P5 109행 step ④ 결과-박제 surface 무결성 조각 / REQ-059·REQ-032).
 * 요약축 `assertRealDataResultIssueDescriptorBodyConsistent`(T-0646)의 daily-step mirror —
 * 요약축 body **3 블록**(marker → 빈 줄 → 한 줄 요약 → 빈 줄 → markdown)을 daily 축 body
 * **2 블록**(marker → 빈 줄 → markdown)으로 축소 적용한다.
 *
 * title·marker 식별자 재유도·대조는 본 가드의 관심사가 아니다 — 그 축은 전용 identity
 * oracle `assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent`(T-1024,
 * producer 반환 직전 self-wire T-1025)가 전담한다. 본 가드는 marker 를 body 첫 라인과의
 * 일치만 비교하며(marker 합성 규칙 prefix·runToken·`-->` 종결 자체 재유도는 identity oracle
 * 위임), body 의 마크다운 블록은 렌더러 T-0895 에 위임한다(마크다운 내부 규칙 재구현 0).
 *
 * 검증하는 불변식(single source — `buildRealDataDailyStepDualLegRunReportIssueDescriptor`
 * L126~130 의 `[marker, "", renderMarkdown(report)].join("\n")` body 합성 강제):
 *   (1) `descriptor.body` 가 `split("\n")` 결과 ≥ 3 라인(marker / "" / markdown 첫 라인).
 *   (2) 첫 라인 = `descriptor.marker` (body 가 marker 라인으로 시작 — marker 최상단 1 회 등장).
 *   (3) 2 번째 라인 = "" (marker 직후 구분 빈 줄).
 *   (4) 3 번째 라인부터 끝까지 = `renderRealDataDailyStepDualLegRunReportMarkdown(report)`
 *       산출과 byte-identical (마크다운 본문 — 가공 0 합성). marker 라인이 마크다운 본문에
 *       추가 등장하는 손상도 본 단언이 함께 catch.
 *
 * 에러 정책(구조 결손 = TypeError / 값 drift = RangeError):
 *   - descriptor null/undefined·비-객체·marker/body 비-string → TypeError.
 *   - report.gitSha/dateToken 빈/공백-only(비식별 이슈 박제) → producer 와 동형 Error.
 *   - body 2 블록 구조 불변식 (1)~(4) 위반 → RangeError(기대 vs 실측 노출).
 *   - silent 통과 0, fail-fast. 공백·줄바꿈·대소문자 민감(trim·case-fold 0).
 *
 * @param report descriptor 의 single source. 변형하지 않는다(읽기·비교만).
 * @param descriptor 검증 대상 issue descriptor(producer 산출). 변형하지 않는다(읽기·비교만).
 * @param label 선택 — 에러 메시지에 붙일 대조 지점 식별자.
 * @returns body 2 블록 구조 불변식을 모두 만족하면 정상 반환(void).
 * @throws {TypeError} descriptor 구조 결손(null/비-객체·marker/body 비-string).
 * @throws {Error} report.gitSha/dateToken 빈/공백-only(producer 와 동형).
 * @throws {RangeError} body 2 블록 구조 불변식 (1)~(4) 위반(기대 vs 실측 포함).
 */
export function assertRealDataDailyStepDualLegRunReportIssueDescriptorBodyConsistent(
  report: RealDataDailyStepDualLegRunReport,
  descriptor: RealDataDailyStepDualLegRunReportIssueDescriptor,
  label?: string,
): void {
  const ctx = contextPrefix(label);

  // 구조 검증(TypeError 분기) — descriptor 존재·marker/body 필드 타입.
  assertDescriptorStructure(descriptor, label);

  // 비식별 식별자 guard(producer 동형 Error) — producer 가 산출을 거부하는 빈/공백-only
  // 식별자는 정합 descriptor 가 존재할 수 없으므로 마크다운 재유도(및 body 대조) 전에 먼저
  // 차단한다.
  assertNonBlank(report.gitSha, "gitSha");
  assertNonBlank(report.dateToken, "dateToken");

  // 마크다운 본문 재유도 — body 합성 single source(producer L129)와 동일한 렌더러를 호출해
  // 기대값을 산출(drift 0). 마크다운 내부 규칙은 렌더러 T-0895 에 위임(재구현 0).
  const expectedMarkdown =
    renderRealDataDailyStepDualLegRunReportMarkdown(report);

  // 라인 분해 — body 를 "\n" 으로 split. 마크다운 본문이 다행이므로 최소 3 라인(marker /
  // "" / markdown 첫 라인) 이상이어야 한다.
  const bodyLines = descriptor.body.split("\n");
  if (bodyLines.length < 3) {
    throw new RangeError(
      `${ctx}정합 위반(body): body 라인 수가 ${bodyLines.length} 으로 최소 3 라인(marker / "" / markdown) 에 미달한다 — body 2 블록 구조가 깨졌다.`,
    );
  }

  // 불변식 (2) — 첫 라인이 marker 와 일치(marker 가 body 최상단에 정확히 1 회 등장). marker
  // 합성 규칙 자체(prefix·runToken·`-->`)는 identity oracle(T-1024)이 검증하므로, 본 가드는
  // body 안 marker 라인 위치만 확인한다.
  if (bodyLines[0] !== descriptor.marker) {
    throw new RangeError(
      `${ctx}정합 위반(body): body 첫 라인이 descriptor.marker 와 불일치한다 — 기대='${descriptor.marker}', 실측='${bodyLines[0]}'. marker 라인이 body 최상단에 위치해야 한다.`,
    );
  }

  // 불변식 (3) — marker 직후 구분 빈 줄(2 블록 구분).
  if (bodyLines[1] !== "") {
    throw new RangeError(
      `${ctx}정합 위반(body): marker 직후 구분 빈 줄(2 번째 라인)이 빈 문자열이 아니다 — 실측='${bodyLines[1]}'. body 2 블록 구분이 깨졌다.`,
    );
  }

  // 불변식 (4) — 3 번째 라인부터 끝까지가 renderMarkdown(report) 산출과 byte-identical(가공
  // 0 합성 증명). 마크다운 본문이 다행이므로 라인 배열 일부 join 으로 재구성해 비교한다.
  const actualMarkdown = bodyLines.slice(2).join("\n");
  if (actualMarkdown !== expectedMarkdown) {
    throw new RangeError(
      `${ctx}정합 위반(body): body 의 마크다운 블록(3 번째 라인 이후)이 renderRealDataDailyStepDualLegRunReportMarkdown(report) 산출과 byte-identical 하지 않다 — 마크다운 블록이 가공/drift 됐거나 report 와 어긋났다.`,
    );
  }
}
