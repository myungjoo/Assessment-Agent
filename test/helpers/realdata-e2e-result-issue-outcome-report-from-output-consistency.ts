// realdata-e2e-result-issue-outcome-report-from-output-consistency.ts — 실 평가 e2e
// 결과 이슈 outcome-report composer 산출 ↔ single-source 재유도 byte-identical 정합
// 순수 가드(T-0663 박제).
//
// 책임:
//   - `buildRealDataResultIssueOutcomeReportFromOutput(stdout, run)`(T-0596,
//     `realdata-e2e-result-issue-outcome-report-from-output.ts`)은 (1)
//     `parseRealDataResultIssueCreateEditOutput(stdout)`(T-0589) → outcome (2)
//     `buildRealDataResultIssueOutcomeReport(outcome, run)`(T-0590) → report 2 단계
//     위임을 엮어 `RealDataResultIssueOutcomeReport` 를 반환한다. 그러나 그 합성 결과가
//     **두 위임 layer 를 직접 엮은 single-source 재유도와 정합한지** — 컴포저가 두 위임
//     사이에 끼어 결과를 변형/누락/재가공하지 않았는지 — 를 런타임에서 강제하는 독립
//     불변식 가드가 부재했다. 본 가드가 그 빈칸을 채운다. 합성 회귀로 손상된 report 가
//     daily-test 로그·결과 이슈 surface 로 새기 전 fail-fast throw 로 차단한다.
//
// 검증하는 불변식(single source — 두 위임 함수 직접 호출 재유도):
//   - expected = buildRealDataResultIssueOutcomeReport(
//       parseRealDataResultIssueCreateEditOutput(stdout), run)
//     로 재유도한 report 의 5 필드(issueNumber/url/gitSha/dateToken/summaryLine)가
//     인자 `report` 의 동일 필드와 각각 정합(string 은 byte-identical, number 는 ===)함.
//   - 재유도 chain(URL 파싱·issueNumber 양수성 검증·run guard·summaryLine 합성)은 일절
//     재구현하지 않는다 — 위임 호출만(drift 0 보장의 핵심).
//
// 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
//   - `stdout` 비-string · `run`/`report` null/undefined · `report` 필드 type 위반 →
//     한국어 TypeError.
//   - 재유도 expected 와 `report` 의 어느 필드라도 drift → 한국어 RangeError(메시지에
//     어느 필드가 expected vs actual 로 어긋났는지 포함).
//   - 재유도 chain 이 throw(stdout URL 미발견·run 식별자 빈 등)하면 가드가 삼키지 않고
//     그대로 전파(가드 진입 전 파서/빌더 throw).
//   - silent 통과(위반인데 정상 void) 0. fail-fast(가장 먼저 위반한 필드에서 throw).
//
// 비변형 / 순수: `stdout`(문자열·불변) / `run`(읽기만, mutate 0) / `report`(읽기·비교만).
// 부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0 · env/네트워크/
// credential 0. 동일 입력 → 동일 동작(정합 report 면 항상 void, drift report 면 항상
// 동일 필드에서 throw).
//
// 패턴 mirror: `assertRealDataResultIssueDescriptorBodyConsistent`(T-0646, body 3 블록
// 구조 single-source 재유도 byte-identical 비교 + 구조 결손=TypeError / 값 정합
// 위반=RangeError 구분 fail-fast). 본 가드는 그 outcome-report composer-seam mirror —
// describe/throw 계약·메시지 포맷을 동형으로 따른다.
//
// Out of Scope (task T-0663):
//   - `buildRealDataResultIssueOutcomeReportFromOutput` 컴포저 / 위임 함수
//     (`parseRealDataResultIssueCreateEditOutput`/`buildRealDataResultIssueOutcomeReport`)
//     본문 수정 — 본 가드는 import·재유도 비교·throw 만(재정의 0).
//   - 컴포저 self-wire 배선(`buildRealDataResultIssueOutcomeReportFromOutput` 반환 직전
//     self-assert) — 별도 후속 slice(T-0662-style self-wire mirror).
//   - 자동 복구 / report 재합성 / 정규화 / 기본값 채움 0 — 손상 report 를 고치거나 silent
//     수선하지 않는다(fail-fast). 복구는 호출처 책임.
//   - JSON schema / 외부 validation 라이브러리(zod·ajv) 도입 0 — 순수 비교만.
//   - 재유도 chain 의 URL 파싱·issueNumber 양수성 검증·run guard·summaryLine 합성 재구현
//     — 전부 위임 호출로 재유도(재구현 금지).
import type { RealDataResultIssueRunRef } from "./realdata-e2e-result-issue-descriptor";
import type { RealDataResultIssueOutcomeReport } from "./realdata-e2e-result-issue-outcome-report";
import { buildRealDataResultIssueOutcomeReport } from "./realdata-e2e-result-issue-outcome-report";
import { parseRealDataResultIssueCreateEditOutput } from "./realdata-e2e-result-issue-output-parse";

// REPORT_STRING_FIELDS / REPORT_NUMBER_FIELDS — 비교 대상 5 필드를 type 별로 분리해
// 결정론적 순회 비교한다(string 4 종은 byte-identical, number 1 종은 ===).
const REPORT_STRING_FIELDS = [
  "url",
  "gitSha",
  "dateToken",
  "summaryLine",
] as const;
const REPORT_NUMBER_FIELDS = ["issueNumber"] as const;

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

// assertRunStructure — `run` 객체가 구조적으로 온전한지 fail-fast 검증. gitSha/dateToken
// 빈/공백 guard 는 재유도 빌더(buildRealDataResultIssueOutcomeReport)가 throw 로 강제하므로
// 본 가드는 최상위 null/undefined 만 차단한다(중복 검증 0).
function assertRunStructure(
  run: RealDataResultIssueRunRef | null | undefined,
): asserts run is RealDataResultIssueRunRef {
  if (run === null || run === undefined) {
    throw new TypeError(
      "run 이 null/undefined 일 수 없다 — RealDataResultIssueRunRef 객체가 필요하다.",
    );
  }
}

/**
 * 실 평가 e2e 결과 이슈 outcome-report composer
 * (`buildRealDataResultIssueOutcomeReportFromOutput`) 의 산출 report 가, 동일 (stdout,
 * run) 을 두 위임 함수로 직접 엮은 single-source 재유도와 byte-identical 정합함을 런타임에서
 * 검증하는 순수 가드(PLAN.md P5 109행 step ④ 결과 박제 chain 의 post-composition 무결성
 * 조각). `assertRealDataResultIssueDescriptorBodyConsistent`(T-0646) 의 outcome-report
 * composer-seam mirror.
 *
 * 검증하는 불변식(single source — 두 위임 함수 직접 호출 재유도):
 *   expected = buildRealDataResultIssueOutcomeReport(
 *     parseRealDataResultIssueCreateEditOutput(stdout), run)
 *   의 5 필드(issueNumber/url/gitSha/dateToken/summaryLine)가 `report` 의 동일 필드와
 *   각각 정합(string 은 byte-identical, number 는 ===).
 *
 * 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
 *   - `stdout` 비-string · `run`/`report` null/undefined · `report` 필드 type 위반 →
 *     한국어 TypeError.
 *   - 재유도 expected 와 `report` 의 어느 필드라도 drift → 한국어 RangeError. 메시지에
 *     어느 필드가 expected vs actual 로 어긋났는지 포함.
 *   - 재유도 chain 이 throw(stdout URL 미발견·run 식별자 빈 등)하면 가드가 삼키지 않고
 *     그대로 전파(가드 진입 전 파서/빌더 throw — 가드 본문 미도달).
 *   - silent 통과(위반인데 정상 void) 0.
 *
 * 검사 순서: 구조(report / run 존재 · report 5 필드 type) → stdout type → 재유도(파서 →
 * 빌더) → 필드별 순회 비교(number 1 종 + string 4 종). 가장 먼저 위반한 지점에서 throw
 * (fail-fast).
 *
 * 비변형 / 순수: `stdout` / `run` / `report` 를 읽기·비교만 한다(쓰기 0). 부수효과 0 ·
 * `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0. 동일 입력 → 동일 동작
 * (정합 report 면 항상 void 반환, drift report 면 항상 동일 필드에서 throw).
 *
 * @param stdout 재유도 chain 의 첫 단계 파서 입력(`gh issue create`/`edit` stdout). 문자열
 *   이어야 하며, URL 미발견 등은 파서 throw 가 그대로 전파된다(가드가 삼키지 않음).
 * @param run 재유도 빌더의 run 식별자(gitSha/dateToken). null/undefined 면 TypeError,
 *   빈/공백 식별자면 빌더 guard throw 가 전파. 변형하지 않는다(읽기만).
 * @param report 검증 대상 컴포저 산출 report. 변형하지 않는다(읽기·비교만). 5 필드가
 *   올바른 type 이어야 하며 재유도 expected 와 정합해야 한다.
 * @returns 5 필드가 모두 재유도 expected 와 정합하면 아무 일도 하지 않고 정상 반환(void).
 * @throws {TypeError} `stdout` 비-string 또는 `run`/`report` null/undefined 또는 `report`
 *   필드 type 위반(구조/타입 결손).
 * @throws {RangeError} 재유도 expected 와 `report` 의 어느 필드라도 drift(값 정합 위반).
 *   메시지에 어느 필드가 expected vs actual 로 어긋났는지 포함.
 */
export function assertRealDataResultIssueOutcomeReportConsistentWithOutput(
  stdout: string,
  run: RealDataResultIssueRunRef,
  report: RealDataResultIssueOutcomeReport,
): void {
  // 구조 검증(TypeError 분기) — report / run 존재 + report 5 필드 type + stdout type.
  assertReportStructure(report);
  assertRunStructure(run);
  if (typeof stdout !== "string") {
    throw new TypeError(
      `stdout 이 문자열이 아니다(타입: ${typeof stdout}) — 재유도 파서 입력으로 사용할 수 없다.`,
    );
  }

  // 기대값 재유도 — 컴포저가 내부에서 엮는 두 위임 함수를 본 가드가 직접 같은 순서로
  // 호출해 single-source expected report 를 산출한다(drift 0). 파서/빌더가 throw 하면
  // (stdout URL 미발견·run 식별자 빈 등) 가드가 삼키지 않고 그대로 전파한다.
  const expected = buildRealDataResultIssueOutcomeReport(
    parseRealDataResultIssueCreateEditOutput(stdout),
    run,
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
