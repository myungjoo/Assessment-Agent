// realdata-e2e-result-outcome-step-args-consistency.ts — 실 평가 e2e outcome-step-args
// composer 산출 ↔ single-source 재유도 byte-identical 정합 순수 가드 (T-0669 박제).
//
// 책임:
//   - `buildRealDataResultOutcomeStepArgs(runPlan, stdout)`(T-0600,
//     `realdata-e2e-result-outcome-step-args.ts`)는 검증된 e2e run plan 에서 단일 run
//     식별자 `runPlan.run`(= gitSha + dateToken)을 추출해
//     `buildRealDataResultIssueOutcomeReportFromOutput(stdout, runPlan.run)`(T-0596) 로
//     thread-위임한다 — 즉 outcome-step-args 컴포저가 (1) `runPlan.run` 을 올바른 인자
//     위치로 추출·재전달하고 (2) 위임 산출 outcome report 를 변형/누락 없이 그대로
//     반환하는지가 합성 무결성의 핵심 seam 이다. 그러나 이 layer 에는 그 합성이
//     single-source 재유도와 정합한지 — outcome-step-args 컴포저가 run 추출/재전달/반환을
//     변형하지 않았는지 — 를 런타임에서 강제하는 독립 불변식 가드가 부재했다. 본 가드가
//     그 빈칸을 채운다. 합성 회귀로 손상된 outcome report 가 step ④ live runner 로 새기 전
//     fail-fast throw 로 차단한다.
//
// 검증하는 불변식(single source — runPlan.run 추출 후 위임 종단 함수 직접 호출 재유도):
//   - expected = buildRealDataResultIssueOutcomeReportFromOutput(stdout, runPlan.run)
//     재유도 → `report` 의 5 필드(issueNumber/url/gitSha/dateToken/summaryLine)가
//     expected 의 동일 필드와 각각 정합(string 은 byte-identical, number 는 ===)함.
//   - 재유도 chain(URL 파싱·issueNumber 양수성 검증·run guard·summaryLine 합성)은 일절
//     재구현하지 않는다 — 위임 종단 함수 호출만(drift 0 보장의 핵심). outcome-step-args
//     컴포저와 정확히 같은 인자 순서(`stdout`, `runPlan.run`)로 재유도한다.
//
// 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
//   - `report`/`runPlan` null/undefined · `report` 필드 type 위반(issueNumber 비-number /
//     url·gitSha·dateToken·summaryLine 비-string) · `runPlan.run` 비-object → 한국어
//     TypeError.
//   - 재유도 expected 와 `report` 의 어느 필드라도 drift → 한국어 RangeError(메시지에
//     어느 필드가 expected vs actual 로 어긋났는지 포함).
//   - 재유도 chain 이 throw(`runPlan.run` 식별자 빈/공백, 잘못된 stdout 등)하면 가드가
//     삼키지 않고 그대로 전파(가드 본문의 재유도 단계에서 위임 파서/빌더 guard throw —
//     자체 try/catch 0).
//   - silent 통과(위반인데 정상 void) 0. fail-fast(가장 먼저 위반한 필드에서 throw).
//
// 비변형 / 순수: `report`(읽기·비교만) / `runPlan`(읽기만 — run 추출, mutate 0) /
// `stdout`(문자열·불변). 부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부
// dependency 0 · env/네트워크/credential 0. 동일 입력 → 동일 동작(정합 report 면 항상
// void, drift report 면 항상 동일 필드에서 throw).
//
// 패턴 mirror: `assertRealDataResultIssueOutcomeReportConsistentWithOutput`(T-0663,
// outcome-report composer 산출 ↔ single-source 재유도 byte-identical 비교 + 구조 결손=
// TypeError / 값 정합 위반=RangeError 구분 fail-fast)의 한 layer 위 outcome-step-args
// composer-seam mirror — describe/throw 계약·메시지 포맷·5 필드 순회 비교를 동형으로
// 따르되 run 을 `runPlan.run` 에서 추출하고 재유도 종단을
// `buildRealDataResultIssueOutcomeReportFromOutput(stdout, runPlan.run)` 단일 호출로
// 묶는 점만 다르다(상위 outcome-step-args 컴포저의 run-extract seam). 또한 publish-step-args
// consistency 가드 `assertRealDataResultPublishStepArgsConsistentWithSources`(T-0667)의
// post-실행 layer mirror 다 — 다른 점은 검증 대상이 다중-구성요소 plan 이 아니라 단일
// outcome report 객체라 비교가 5 필드 순회로 단순화된다는 것.
//
// Out of Scope (task T-0669):
//   - `buildRealDataResultOutcomeStepArgs` 컴포저 / 위임 종단 함수
//     (`buildRealDataResultIssueOutcomeReportFromOutput`, 그 하위 T-0589/T-0590) 본문 수정
//     — 본 가드는 import·재유도 비교·throw 만(재정의 0).
//   - 컴포저 self-wire 배선(`buildRealDataResultOutcomeStepArgs` 반환 직전 self-assert) —
//     별도 후속 slice(T-0668-style self-wire mirror).
//   - 자동 복구 / report 재합성 / 정규화 / 기본값 채움 0 — 손상 report 를 고치거나 silent
//     수선하지 않는다(fail-fast). 복구는 호출처 책임.
//   - JSON schema / 외부 validation 라이브러리(zod·ajv) 도입 0 — 순수 비교만.
//   - 재유도 chain 의 URL 파싱·issueNumber 양수성 검증·run guard·summaryLine 합성 재구현
//     — 전부 위임 종단 함수 호출로 재유도(재구현 금지).
import type { RealDataResultIssueOutcomeReport } from "./realdata-e2e-result-issue-outcome-report";
import { buildRealDataResultIssueOutcomeReportFromOutput } from "./realdata-e2e-result-issue-outcome-report-from-output";
import type { RealDataE2eRunPlan } from "./realdata-e2e-run-plan";

// REPORT_STRING_FIELDS / REPORT_NUMBER_FIELDS — 비교 대상 5 필드를 type 별로 분리해
// 결정론적 순회 비교한다(string 4 종은 byte-identical, number 1 종은 ===).
const REPORT_STRING_FIELDS = [
  "url",
  "gitSha",
  "dateToken",
  "summaryLine",
] as const;
const REPORT_NUMBER_FIELDS = ["issueNumber"] as const;

// isPlainObject — null 이 아닌 non-array object 인지 판정. runPlan.run 구조 검증에 쓰인다
// (배열·null 은 거부).
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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
        `report.${field} 가 숫자가 아니다(타입: ${typeof report[field]}) — 재유도 정합 비교를 진행할 수 없다.`,
      );
    }
  }
  for (const field of REPORT_STRING_FIELDS) {
    if (typeof report[field] !== "string") {
      throw new TypeError(
        `report.${field} 가 문자열이 아니다(타입: ${typeof report[field]}) — 재유도 정합 비교를 진행할 수 없다.`,
      );
    }
  }
}

// assertRunPlanStructure — `runPlan` 객체와 그 `run` 구성요소가 구조적으로 온전한지
// fail-fast 검증. 본 가드는 `runPlan.run` 을 추출해 재유도하므로 최상위 runPlan null/
// undefined 와 `runPlan.run` 비-object 만 차단한다. run.gitSha/dateToken 빈/공백 guard 는
// 재유도 위임 종단 함수의 하위 빌더가 throw 로 강제하므로 본 가드는 중복 검증 0(빈/공백
// 식별자는 그 throw 가 그대로 전파).
function assertRunPlanStructure(
  runPlan: RealDataE2eRunPlan | null | undefined,
): asserts runPlan is RealDataE2eRunPlan {
  if (runPlan === null || runPlan === undefined) {
    throw new TypeError(
      "runPlan 이 null/undefined 일 수 없다 — RealDataE2eRunPlan 객체가 필요하다.",
    );
  }
  if (!isPlainObject(runPlan.run)) {
    throw new TypeError(
      `runPlan.run 이 객체가 아니다(타입: ${describe(runPlan.run)}) — run 식별자를 추출할 수 없다.`,
    );
  }
}

/**
 * 실 평가 e2e outcome-step-args composer
 * (`buildRealDataResultOutcomeStepArgs`) 의 산출 report 가, 동일 (stdout, runPlan.run) 을
 * 위임 종단 함수로 직접 엮은 single-source 재유도와 byte-identical 정합함을 런타임에서
 * 검증하는 순수 가드(PLAN.md P5 109행 step ④ 결과 박제 chain 의 outcome-step-args layer
 * 무결성 조각). `assertRealDataResultIssueOutcomeReportConsistentWithOutput`(T-0663) 의 한
 * layer 위 outcome-step-args composer-seam mirror — run 을 `runPlan.run` 에서 추출해 위임
 * 종단 함수(`buildRealDataResultIssueOutcomeReportFromOutput`) 단일 호출로 재유도하는 점만
 * 다르다. 또한 publish-step-args consistency 가드(T-0667) 의 post-실행 layer mirror.
 *
 * 검증하는 불변식(single source — runPlan.run 추출 후 위임 종단 함수 직접 호출 재유도):
 *   expected = buildRealDataResultIssueOutcomeReportFromOutput(stdout, runPlan.run)
 *   의 5 필드(issueNumber/url/gitSha/dateToken/summaryLine)가 `report` 의 동일 필드와
 *   각각 정합(string 은 byte-identical, number 는 ===).
 *
 * 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
 *   - `report`/`runPlan` null/undefined · `report` 필드 type 위반 · `runPlan.run` 비-object
 *     → 한국어 TypeError.
 *   - 재유도 expected 와 `report` 의 어느 필드라도 drift → 한국어 RangeError. 메시지에
 *     어느 필드가 expected vs actual 로 어긋났는지 포함.
 *   - 재유도 chain 이 throw(`runPlan.run` 식별자 빈/공백, 잘못된 stdout — URL 미발견 등)
 *     하면 가드가 삼키지 않고 그대로 전파(가드 본문의 재유도 단계에서 위임 파서/빌더 guard
 *     throw — 자체 try/catch 0).
 *   - silent 통과(위반인데 정상 void) 0.
 *
 * 검사 순서: 구조(report / runPlan 존재 · report 5 필드 type · runPlan.run object) →
 * 재유도(runPlan.run 추출 → 위임 종단 함수) → 필드별 순회 비교(number 1 종 + string 4 종).
 * 가장 먼저 위반한 지점에서 throw(fail-fast).
 *
 * 비변형 / 순수: `report` / `runPlan` / `stdout` 를 읽기·비교만 한다(쓰기 0). 부수효과 0 ·
 * `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0. 동일 입력 → 동일 동작
 * (정합 report 면 항상 void 반환, drift report 면 항상 동일 필드에서 throw).
 *
 * @param report 검증 대상 outcome-step-args 컴포저 산출 report. 변형하지 않는다(읽기·비교만).
 *   5 필드가 올바른 type 이어야 하며 재유도 expected 와 정합해야 한다.
 * @param runPlan 재유도 run 식별자 source. `runPlan.run`(gitSha/dateToken)을 추출해 위임
 *   종단 함수로 expected 를 재유도한다. null/undefined 또는 `run` 비-object 면 TypeError,
 *   빈/공백 식별자면 하위 빌더 guard throw 가 전파. 변형하지 않는다(읽기만).
 * @param stdout 재유도 chain 의 첫 단계 파서 입력(`gh issue create`/`edit` stdout). URL
 *   미발견 등은 파서 throw 가 그대로 전파된다(가드가 삼키지 않음). 변형하지 않는다(불변).
 * @returns 5 필드가 모두 재유도 expected 와 정합하면 아무 일도 하지 않고 정상 반환(void).
 * @throws {TypeError} `report`/`runPlan` null/undefined 또는 `report` 필드 type 위반 또는
 *   `runPlan.run` 비-object(구조/타입 결손).
 * @throws {RangeError} 재유도 expected 와 `report` 의 어느 필드라도 drift(값 정합 위반).
 *   메시지에 어느 필드가 expected vs actual 로 어긋났는지 포함.
 */
export function assertRealDataResultOutcomeStepArgsConsistentWithSources(
  report: RealDataResultIssueOutcomeReport,
  runPlan: RealDataE2eRunPlan,
  stdout: string,
): void {
  // 구조 검증(TypeError 분기) — report / runPlan 존재 + report 5 필드 type +
  // runPlan.run object.
  assertReportStructure(report);
  assertRunPlanStructure(runPlan);

  // 기대값 재유도 — outcome-step-args 컴포저가 내부에서 `runPlan.run` 을 추출해 호출하는
  // 위임 종단 함수를 본 가드가 정확히 같은 인자 순서(stdout, runPlan.run)로 직접 호출해
  // single-source expected report 를 산출한다(drift 0). 위임 파서/빌더가 throw 하면
  // (stdout URL 미발견·run 식별자 빈/공백 등) 가드가 삼키지 않고 그대로 전파한다.
  const expected = buildRealDataResultIssueOutcomeReportFromOutput(
    stdout,
    runPlan.run,
  );

  // number 필드(issueNumber) 정합 비교 — === 동등.
  for (const field of REPORT_NUMBER_FIELDS) {
    if (report[field] !== expected[field]) {
      throw new RangeError(
        `정합 위반: report.${field} 가 재유도 expected 와 불일치한다 — 기대=${expected[field]}, 실측=${report[field]}.`,
      );
    }
  }

  // string 필드(url/gitSha/dateToken/summaryLine) 정합 비교 — byte-identical.
  for (const field of REPORT_STRING_FIELDS) {
    if (report[field] !== expected[field]) {
      throw new RangeError(
        `정합 위반: report.${field} 가 재유도 expected 와 byte-identical 하지 않다 — 기대='${expected[field]}', 실측='${report[field]}'.`,
      );
    }
  }
}
