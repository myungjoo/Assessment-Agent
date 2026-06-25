// realdata-e2e-result-issue-publish-plan-consistency.ts — 실 평가 e2e 결과 이슈
// publish-plan composer 산출 ↔ single-source 재유도 byte-identical 정합 순수 가드
// (T-0665 박제).
//
// 책임:
//   - `buildRealDataResultIssuePublishPlan(results, run)`(T-0595,
//     `realdata-e2e-result-issue-publish-plan.ts`)은 (1)
//     `buildRealDataResultIssueCommandPlan(results, run)`(T-0594) → {report, commandArgs}
//     (2) `buildRealDataResultIssueSearchGhArgv(commandArgs)`(T-0586) → searchArgv 2 단계
//     위임을 엮어 `RealDataResultIssuePublishPlan`({report, commandArgs, searchArgv})을
//     반환한다. 그러나 그 합성 결과가 **두 위임 layer 를 직접 엮은 single-source 재유도와
//     정합한지** — 컴포저가 두 위임 사이에 끼어 결과를 변형/누락/재가공하지 않았는지 —
//     를 런타임에서 강제하는 독립 불변식 가드가 부재했다. 본 가드가 그 빈칸을 채운다. 합성
//     회귀로 손상된 plan 이 step ④ live runner(execFile('gh', searchArgv) + 종단 컴포저)로
//     새기 전 fail-fast throw 로 차단한다.
//
// 검증하는 불변식(single source — 두 위임 함수 직접 호출 재유도):
//   - { report, commandArgs } = buildRealDataResultIssueCommandPlan(results, run)
//     재유도 → `plan.report` / `plan.commandArgs` 가 각각 deep-equal byte-identical.
//   - searchArgv = buildRealDataResultIssueSearchGhArgv(재유도 commandArgs)
//     재유도 → `plan.searchArgv` 가 deep-equal byte-identical(원소·순서·길이까지).
//   - 재유도 chain(요약 집계·descriptor 합성·명령-args 합성·search argv 합성)은 일절
//     재구현하지 않는다 — 위임 호출만(drift 0 보장의 핵심).
//
// 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
//   - `plan`/`run` null/undefined · `plan.report`/`plan.commandArgs` 비-object ·
//     `plan.searchArgv` 비-배열 또는 원소 비-string → 한국어 TypeError.
//   - 재유도 expected 와 `plan` 의 어느 구성요소라도 drift → 한국어 RangeError(메시지에
//     어느 구성요소가 어긋났는지 포함).
//   - 재유도 chain 이 throw(run 식별자 빈/공백 등)하면 가드가 삼키지 않고 그대로 전파
//     (가드 진입 후 재유도 단계에서 위임 guard throw — 자체 try/catch 0).
//   - silent 통과(위반인데 정상 void) 0. fail-fast(가장 먼저 위반한 구성요소에서 throw).
//
// 비변형 / 순수: `results`(읽기만, mutate 0) / `run`(읽기만, mutate 0) / `plan`(읽기·비교
// 만). 부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0 · env/네트워크/
// credential 0. 동일 입력 → 동일 동작(정합 plan 면 항상 void, drift plan 면 항상 동일
// 구성요소에서 throw).
//
// 패턴 mirror: `assertRealDataResultIssueOutcomeReportConsistentWithOutput`(T-0663,
// outcome-report composer 산출 ↔ single-source 재유도 byte-identical 비교 + 구조 결손=
// TypeError / 값 정합 위반=RangeError 구분 fail-fast). 본 가드는 그 publish-plan
// composer-seam mirror — describe/throw 계약·메시지 포맷을 동형으로 따른다.
//
// Out of Scope (task T-0665):
//   - `buildRealDataResultIssuePublishPlan` 컴포저 / 위임 함수
//     (`buildRealDataResultIssueCommandPlan`/`buildRealDataResultIssueSearchGhArgv`)
//     본문 수정 — 본 가드는 import·재유도 비교·throw 만(재정의 0).
//   - 컴포저 self-wire 배선(`buildRealDataResultIssuePublishPlan` 반환 직전 self-assert) —
//     별도 후속 slice(T-0664-style self-wire mirror).
//   - 자동 복구 / plan 재합성 / 정규화 / 기본값 채움 0 — 손상 plan 을 고치거나 silent
//     수선하지 않는다(fail-fast). 복구는 호출처 책임.
//   - JSON schema / 외부 validation 라이브러리(zod·ajv) 도입 0 — 순수 비교만.
//   - 재유도 chain 의 요약 집계·descriptor·명령-args·search argv 합성 재구현 — 전부 위임
//     호출로 재유도(재구현 금지).
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";

import { buildRealDataResultIssueCommandPlan } from "./realdata-e2e-result-issue-command-plan";
import type { RealDataResultIssueRunRef } from "./realdata-e2e-result-issue-descriptor";
import type { RealDataResultIssuePublishPlan } from "./realdata-e2e-result-issue-publish-plan";
import { buildRealDataResultIssueSearchGhArgv } from "./realdata-e2e-result-issue-search-argv";

// isPlainObject — null 이 아닌 non-array object 인지 판정. report / commandArgs 구조
// 검증에 쓰인다(배열·null 은 거부).
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// assertPlanStructure — `plan` 객체와 3 구성요소(report/commandArgs/searchArgv)의 구조가
// 온전한지 fail-fast 검증. 구조/타입 결손은 RangeError 가 아니라 TypeError 로 구분한다
// (값 정합 위반과 분리). report/commandArgs 는 non-null object, searchArgv 는 string[]
// 이어야 한다(deep-equal 비교 전 최소 형태 보장 — 깊은 필드 검증은 재유도 위임의 몫).
function assertPlanStructure(
  plan: RealDataResultIssuePublishPlan | null | undefined,
): asserts plan is RealDataResultIssuePublishPlan {
  if (plan === null || plan === undefined) {
    throw new TypeError(
      "plan 이 null/undefined 일 수 없다 — RealDataResultIssuePublishPlan 객체가 필요하다.",
    );
  }
  if (!isPlainObject(plan.report)) {
    throw new TypeError(
      `plan.report 가 객체가 아니다(타입: ${describe(plan.report)}) — 재유도 정합 비교를 진행할 수 없다.`,
    );
  }
  if (!isPlainObject(plan.commandArgs)) {
    throw new TypeError(
      `plan.commandArgs 가 객체가 아니다(타입: ${describe(plan.commandArgs)}) — 재유도 정합 비교를 진행할 수 없다.`,
    );
  }
  if (!Array.isArray(plan.searchArgv)) {
    throw new TypeError(
      `plan.searchArgv 가 배열이 아니다(타입: ${describe(plan.searchArgv)}) — 재유도 정합 비교를 진행할 수 없다.`,
    );
  }
  for (const [index, element] of plan.searchArgv.entries()) {
    if (typeof element !== "string") {
      throw new TypeError(
        `plan.searchArgv[${index}] 가 문자열이 아니다(타입: ${typeof element}) — argv 원소는 전부 문자열이어야 한다.`,
      );
    }
  }
}

// assertRunStructure — `run` 객체가 구조적으로 온전한지 fail-fast 검증. gitSha/dateToken
// 빈/공백 guard 는 재유도 command-plan 의 하위 report-plan 이 throw 로 강제하므로 본
// 가드는 최상위 null/undefined 만 차단한다(중복 검증 0).
function assertRunStructure(
  run: RealDataResultIssueRunRef | null | undefined,
): asserts run is RealDataResultIssueRunRef {
  if (run === null || run === undefined) {
    throw new TypeError(
      "run 이 null/undefined 일 수 없다 — RealDataResultIssueRunRef 객체가 필요하다.",
    );
  }
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

// deepEqual — JSON 직렬화 기반 byte-identical 비교. report / commandArgs 트리는 순수
// helper 가 결정론적 키 순서로 합성하므로 직렬화 동등 = 구조 동등. 비교만(입력 변형 0).
function deepEqual(actual: unknown, expected: unknown): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

/**
 * 실 평가 e2e 결과 이슈 publish-plan composer
 * (`buildRealDataResultIssuePublishPlan`) 의 산출 plan 이, 동일 (results, run) 을 두 위임
 * 함수로 직접 엮은 single-source 재유도와 byte-identical 정합함을 런타임에서 검증하는 순수
 * 가드(PLAN.md P5 109행 step ④ 결과 박제 chain 의 post-composition 무결성 조각).
 * `assertRealDataResultIssueOutcomeReportConsistentWithOutput`(T-0663) 의 publish-plan
 * composer-seam mirror.
 *
 * 검증하는 불변식(single source — 두 위임 함수 직접 호출 재유도):
 *   { report, commandArgs } = buildRealDataResultIssueCommandPlan(results, run)
 *   searchArgv = buildRealDataResultIssueSearchGhArgv(commandArgs)
 *   의 3 구성요소(report/commandArgs/searchArgv)가 `plan` 의 동일 구성요소와 각각
 *   deep-equal byte-identical.
 *
 * 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
 *   - `plan`/`run` null/undefined · `plan.report`/`plan.commandArgs` 비-object ·
 *     `plan.searchArgv` 비-배열 또는 원소 비-string → 한국어 TypeError.
 *   - 재유도 expected 와 `plan` 의 어느 구성요소라도 drift → 한국어 RangeError. 메시지에
 *     어느 구성요소가 어긋났는지 포함.
 *   - 재유도 chain 이 throw(run 식별자 빈/공백 등)하면 가드가 삼키지 않고 그대로 전파
 *     (가드 본문의 재유도 단계에서 위임 guard throw — 자체 try/catch 0).
 *   - silent 통과(위반인데 정상 void) 0.
 *
 * 검사 순서: 구조(plan / run 존재 · report/commandArgs object · searchArgv string[]) →
 * 재유도(command-plan → search-argv) → 구성요소별 순회 비교(report → commandArgs →
 * searchArgv). 가장 먼저 위반한 지점에서 throw(fail-fast).
 *
 * 비변형 / 순수: `results` / `run` / `plan` 를 읽기·비교만 한다(쓰기 0). 부수효과 0 ·
 * `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0. 동일 입력 → 동일 동작
 * (정합 plan 면 항상 void 반환, drift plan 면 항상 동일 구성요소에서 throw).
 *
 * @param plan 검증 대상 컴포저 산출 plan. 변형하지 않는다(읽기·비교만). report/commandArgs
 *   는 객체, searchArgv 는 string[] 이어야 하며 재유도 expected 와 정합해야 한다.
 * @param results 재유도 chain 의 입력 평가 결과 배열. 변형하지 않는다(읽기만). 위임
 *   command-plan 에 그대로 넘겨 expected report/commandArgs 를 재유도한다.
 * @param run 재유도 command-plan 의 run 식별자(gitSha/dateToken). null/undefined 면
 *   TypeError, 빈/공백 식별자면 하위 report-plan guard throw 가 전파. 변형하지 않는다.
 * @returns 3 구성요소가 모두 재유도 expected 와 정합하면 아무 일도 하지 않고 정상 반환
 *   (void).
 * @throws {TypeError} `plan`/`run` null/undefined 또는 `plan.report`/`plan.commandArgs`
 *   비-object 또는 `plan.searchArgv` 비-배열·원소 비-string(구조/타입 결손).
 * @throws {RangeError} 재유도 expected 와 `plan` 의 어느 구성요소라도 drift(값 정합 위반).
 *   메시지에 어느 구성요소가 어긋났는지 포함.
 */
export function assertRealDataResultIssuePublishPlanConsistentWithSources(
  plan: RealDataResultIssuePublishPlan,
  results: EvaluationResult[],
  run: RealDataResultIssueRunRef,
): void {
  // 구조 검증(TypeError 분기) — plan / run 존재 + report/commandArgs object +
  // searchArgv string[].
  assertPlanStructure(plan);
  assertRunStructure(run);

  // 기대값 재유도 — 컴포저가 내부에서 엮는 두 위임 함수를 본 가드가 직접 같은 순서로
  // 호출해 single-source expected 를 산출한다(drift 0). 위임 guard 가 throw 하면(run
  // 식별자 빈/공백 등) 가드가 삼키지 않고 그대로 전파한다.
  const { report: expectedReport, commandArgs: expectedCommandArgs } =
    buildRealDataResultIssueCommandPlan(results, run);
  const expectedSearchArgv =
    buildRealDataResultIssueSearchGhArgv(expectedCommandArgs);

  // report 정합 비교 — deep-equal byte-identical.
  if (!deepEqual(plan.report, expectedReport)) {
    throw new RangeError(
      `정합 위반: plan.report 가 재유도 expected 와 byte-identical 하지 않다 — 기대=${JSON.stringify(expectedReport)}, 실측=${JSON.stringify(plan.report)}.`,
    );
  }

  // commandArgs 정합 비교 — deep-equal byte-identical.
  if (!deepEqual(plan.commandArgs, expectedCommandArgs)) {
    throw new RangeError(
      `정합 위반: plan.commandArgs 가 재유도 expected 와 byte-identical 하지 않다 — 기대=${JSON.stringify(expectedCommandArgs)}, 실측=${JSON.stringify(plan.commandArgs)}.`,
    );
  }

  // searchArgv 정합 비교 — deep-equal byte-identical(원소·순서·길이까지).
  if (!deepEqual(plan.searchArgv, expectedSearchArgv)) {
    throw new RangeError(
      `정합 위반: plan.searchArgv 가 재유도 expected 와 byte-identical 하지 않다 — 기대=${JSON.stringify(expectedSearchArgv)}, 실측=${JSON.stringify(plan.searchArgv)}.`,
    );
  }
}
