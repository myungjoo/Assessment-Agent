// realdata-e2e-result-issue-command-plan-consistency.ts — 실 평가 e2e **step④
// post-evaluation interpretation 종단 컴포저** 산출 ↔ 입력 (results, run) single-source
// 재유도 정합 순수 가드 (T-0696 박제).
//
// 책임:
//   - `buildRealDataResultIssueCommandPlan(results, run)`(T-0594,
//     `realdata-e2e-result-issue-command-plan.ts`)는 `EvaluationResult[]` + run 식별자를
//     입력 받아 (1) `buildRealDataResultReportPlan(results, run)`(T-0593) →
//     `{summary, descriptor}` , (2) `buildRealDataResultIssueCommandArgs(report.descriptor)`
//     (T-0583) → `RealDataResultIssueCommandArgs` 2-단계를 합성해
//     `{report, commandArgs}`(`RealDataResultIssueCommandPlan`) plan 을 산출하는 **step④
//     post-evaluation interpretation 종단 컴포저**다. 본 가드 신설 전 이 컴포저에는
//     **독립 정합 가드가 부재했다**(origin/main grep 0 —
//     `assertRealDataResultIssueCommandPlan*` 심볼·`*-command-plan-consistency.ts` 파일 0,
//     컴포저 본문에 종단 plan 정합 self-wire 부재). 합성 회귀 — report 와 commandArgs 의
//     descriptor 어긋남(plan.commandArgs 가 plan.report.descriptor 가 아닌 다른 descriptor
//     로 합성된 듯)·report→descriptor→commandArgs 위임 호출 순서 뒤바뀜·summary 집계
//     drift·descriptor title/marker drift·createArgs.body↔updateArgs.body drift·
//     createArgs.labels 길이/순서/원소 어긋남·searchQuery ≠ 재유도 marker — 를 build-time
//     에 잡을 장치가 없었다. 본 가드는 합성 회귀로 손상된 plan 이 caller(step④ live
//     wiring, gh issue search/create/edit)로 새기 전 build-time 에 fail-fast throw 로
//     차단한다.
//
// 검증하는 불변식(single source — 입력 `(results, run)` 의 2 위임 helper 재유도):
//   - 입력 `(results, run)` 으로 동일 2 위임 helper(`buildRealDataResultReportPlan` →
//     그 산출 `report.descriptor` 로 `buildRealDataResultIssueCommandArgs`)를 재호출해
//     expected `{report, commandArgs}` 를 single-source 재유도한다(합성 규칙 재구현
//     0 — 위임만).
//   - `plan.report` ↔ 재유도 report: summary 집계 분포(count·byDifficulty·byContribution·
//     totalVolume) + descriptor(title/marker/body) deep equal.
//   - `plan.commandArgs` ↔ 재유도 commandArgs: searchQuery + createArgs{title, body,
//     labels} + updateArgs{title, body} deep equal.
//
// 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError — T-0695 mirror):
//   - `plan` 비-객체(null/undefined/배열/원시 포함) → 한국어 TypeError.
//   - `plan.report` 비-객체(null/undefined/배열/원시 포함) → 한국어 TypeError.
//   - `plan.commandArgs` 비-객체(null/undefined/배열/원시 포함) → 한국어 TypeError.
//   - `plan.commandArgs.createArgs` 비-객체(null/undefined/배열/원시 포함) → 한국어
//     TypeError(deep equal 비교가 무의미 — 구조 결손 분류).
//   - `plan.commandArgs.updateArgs` 비-객체(null/undefined/배열/원시 포함) → 한국어
//     TypeError(같은 이유).
//   - `results` 비-배열(null/undefined/객체/원시 포함) → 한국어 TypeError(재유도 자체가
//     불가 — report-plan 위임은 배열 가정).
//   - `run` 비-객체(null/undefined/배열/원시 포함) → 한국어 TypeError(같은 이유 — run
//     키 접근 불가).
//   - report summary 집계 drift(count·byDifficulty·byContribution·totalVolume 어긋남) →
//     RangeError.
//   - descriptor title/marker/body drift → RangeError.
//   - searchQuery ≠ 재유도 marker → RangeError(멱등 검색 토큰 어긋남).
//   - createArgs.title/body drift → RangeError.
//   - createArgs.labels 길이/순서/원소 어긋남(고정 labels 상수 drift) → RangeError.
//   - updateArgs.title/body drift → RangeError.
//   - report↔commandArgs cross 어긋남(plan.commandArgs 가 plan.report.descriptor 가 아닌
//     다른 descriptor 로 합성된 듯) → commandArgs deep equal 단계에서 RangeError 로 자연
//     catch(재유도 commandArgs 는 재유도 descriptor 로 합성되므로 cross drift 가 plan.
//     commandArgs 와 expectedCommandArgs 사이 byte 불일치로 노출).
//   - silent 통과(위반인데 정상 void) 0. fail-fast(가장 먼저 위반한 지점에서 throw).
//
// 비변형 / 순수: `plan` / `results` / `run` 읽기·비교만(mutate 0). 부수효과 0 ·
// `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0 · env/네트워크/credential 0.
// 동일 입력 → 동일 동작(정합 plan 이면 항상 void, drift 면 항상 동일 지점에서 throw).
// raw 미저장(R-59) — descriptor.body / commandArgs body string 만 비교(narrative 원본
// 활동 본문은 plan 에 구조적 부재 — 미접촉). 가드는 2 위임 helper 를 재호출하지만, 각
// helper 자체가 순수 함수라 가드 또한 결정론을 유지한다.
//
// 책임 경계(task Out of Scope):
//   - 컴포저 본문 수정 / 반환 직전 self-wire 배선 — 본 가드는 외부 독립 검증만. self-wire
//     는 별도 후속 task(T-0694 패턴 mirror).
//   - 위임 helper(report-plan / command-args) 수정 — 본 가드는 호출(재유도)만. 각 helper
//     의 합성 규칙·시그니처·throw 정책 불변.
//   - command-args 빌더의 sub-leaf 가드(body-marker / labels-title)가 이미 cover 하는
//     descriptor→command-args round-trip 의 내부 위치 정합 세부 — 본 가드는 plan 전체
//     (report + commandArgs) 의 (results, run) single-source 재유도 정합에 집중. 단 재유도
//     commandArgs 와 plan.commandArgs 의 deep equal 대조는 본 가드 책임.
//   - 자동 복구 / 정규화 / 기본값 채움 / plan 재합성 0 — 손상 plan 을 silent 수선 0.
//   - JSON schema / 외부 validation 라이브러리(zod·ajv) 0 — 순수 비교만.
//   - 실 EvaluationResult 산출 / 실 LLM round-trip / 실 gh issue create/edit / Ollama /
//     live-LLM(ADR-0045) / credential wiring 0 — build-time 순수 가드만.
//   - stdout-side 종단 가드(`*-gh-command-plan-consistency.ts`, T-0695) — 본 task 는
//     evaluation-side 입력 축의 종단 컴포저 가드. T-0695 와 파일·심볼·stream disjoint.
//   - 다른 leaf 가드 신설/배선 — 본 task 는 command-plan 종단 컴포저 가드 단일 신설만.
//
// 패턴 mirror: `assertRealDataResultIssueGhCommandPlanConsistentWithInputs`(T-0695,
// step④ 결과 박제 종단 컴포저 가드, stdout-side 입력 축)의 evaluation-side mirror —
// 차이점:
//   (a) 재유도 source 가 3-단계 합성(parse→resolveAction→buildGhArgv)이 아니라 **2-단계
//       합성 위임**(buildReportPlan → buildCommandArgs)이라 합성 순서가 짧다(각 layer
//       throw 는 가드도 try/catch 없이 그대로 전파).
//   (b) plan 분기 enum 없음 — `{report, commandArgs}` 양 필드 항상 존재(create/update
//       분기는 commandArgs 안에 항상 두 묶음 모두 들고 있음). 분기 매핑 검증 0 — deep
//       equal 두 번이면 충분.
//   (c) 입력 축이 `(results, run)`(evaluation-side) — T-0695 의 `(stdout, commandArgs)`
//       와 disjoint 입력 축.
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";

import type { RealDataResultIssueCommandArgs } from "./realdata-e2e-result-issue-command-args";
import { buildRealDataResultIssueCommandArgs } from "./realdata-e2e-result-issue-command-args";
import type { RealDataResultIssueCommandPlan } from "./realdata-e2e-result-issue-command-plan";
import type { RealDataResultIssueRunRef } from "./realdata-e2e-result-issue-descriptor";
import { buildRealDataResultReportPlan } from "./realdata-e2e-result-report-plan";

// describe — 에러 메시지용 타입 라벨. typeof 가 null/array 를 'object' 로 뭉뚱그리는
// 것을 분리 노출(디버깅 가독성). T-0695/T-0693 mirror 와 동형 helper.
function describe(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}

// assertPlanStructure — `plan` 의 최소 형태 fail-fast 검증. 객체여야 `.report`/
// `.commandArgs` 접근 시 타입 충돌이 차단된다. 구조/타입 결손은 TypeError 로 값 정합
// 위반(RangeError) 과 분리.
function assertPlanStructure(
  plan: RealDataResultIssueCommandPlan | null | undefined,
): asserts plan is RealDataResultIssueCommandPlan {
  if (
    plan === null ||
    plan === undefined ||
    typeof plan !== "object" ||
    Array.isArray(plan)
  ) {
    throw new TypeError(
      `plan 이 객체가 아니다(타입: ${describe(plan)}) — (results, run) 재유도 정합 비교를 진행할 수 없다.`,
    );
  }
}

// assertPlanReportStructure — `plan.report` 가 객체인지 fail-fast 검증. plan 통과 후에만
// 호출(plan 객체 보장). 비-객체면 재유도 report 와의 deep equal 대조가 무의미.
function assertPlanReportStructure(report: unknown): void {
  if (
    report === null ||
    report === undefined ||
    typeof report !== "object" ||
    Array.isArray(report)
  ) {
    throw new TypeError(
      `plan.report 가 객체가 아니다(타입: ${describe(report)}) — report 정합 비교를 진행할 수 없다.`,
    );
  }
}

// assertPlanCommandArgsStructure — `plan.commandArgs` 가 객체인지 fail-fast 검증.
// 비-객체면 searchQuery/createArgs/updateArgs 접근 자체가 불가 — deep equal 비교가 무의미.
function assertPlanCommandArgsStructure(commandArgs: unknown): void {
  if (
    commandArgs === null ||
    commandArgs === undefined ||
    typeof commandArgs !== "object" ||
    Array.isArray(commandArgs)
  ) {
    throw new TypeError(
      `plan.commandArgs 가 객체가 아니다(타입: ${describe(commandArgs)}) — commandArgs 정합 비교를 진행할 수 없다.`,
    );
  }
}

// assertPlanCommandArgsCreateArgsStructure — `plan.commandArgs.createArgs` 가 객체인지
// fail-fast 검증. 비-객체면 title/body/labels 접근 / deep equal 비교 자체가 무의미.
function assertPlanCommandArgsCreateArgsStructure(createArgs: unknown): void {
  if (
    createArgs === null ||
    createArgs === undefined ||
    typeof createArgs !== "object" ||
    Array.isArray(createArgs)
  ) {
    throw new TypeError(
      `plan.commandArgs.createArgs 가 객체가 아니다(타입: ${describe(createArgs)}) — createArgs 정합 비교를 진행할 수 없다.`,
    );
  }
}

// assertPlanCommandArgsUpdateArgsStructure — `plan.commandArgs.updateArgs` 가 객체인지
// fail-fast 검증. 비-객체면 title/body 접근 / deep equal 비교 자체가 무의미.
function assertPlanCommandArgsUpdateArgsStructure(updateArgs: unknown): void {
  if (
    updateArgs === null ||
    updateArgs === undefined ||
    typeof updateArgs !== "object" ||
    Array.isArray(updateArgs)
  ) {
    throw new TypeError(
      `plan.commandArgs.updateArgs 가 객체가 아니다(타입: ${describe(updateArgs)}) — updateArgs 정합 비교를 진행할 수 없다.`,
    );
  }
}

// assertResultsStructure — 재유도 source(results) 최소 형태 fail-fast 검증.
// `buildRealDataResultReportPlan` 위임이 배열 인자를 가정하므로 비-배열은 재유도 자체가
// 불가. TypeError 로 분류.
function assertResultsStructure(
  results: EvaluationResult[] | null | undefined,
): asserts results is EvaluationResult[] {
  if (results === null || results === undefined || !Array.isArray(results)) {
    throw new TypeError(
      `results 가 배열이 아니다(타입: ${describe(results)}) — report-plan 재유도를 진행할 수 없다.`,
    );
  }
}

// assertRunStructure — 재유도 source(run) 최소 형태 fail-fast 검증. report-plan /
// command-args 위임이 객체 인자를 가정(gitSha/dateToken 접근). 비-객체는 재유도 자체가
// 불가. 하위 필드 세부 검증(빈/공백 등)은 위임 helper(가드 재유도 호출) throw 로 자연 전파.
function assertRunStructure(
  run: RealDataResultIssueRunRef | null | undefined,
): asserts run is RealDataResultIssueRunRef {
  if (
    run === null ||
    run === undefined ||
    typeof run !== "object" ||
    Array.isArray(run)
  ) {
    throw new TypeError(
      `run 이 객체가 아니다(타입: ${describe(run)}) — report-plan 재유도를 진행할 수 없다.`,
    );
  }
}

// deepEqual — 결정론적 deep equality. JSON-직렬화 비교로 충분(plan 의 값은 string·
// number·plain object·array 만 — Date·Map·Set·function·undefined 키 부재). 동일 직렬화면
// deep equal 로 간주. 위임 helper 들이 매 호출 새 객체를 만들기 때문에 참조 동등은 의미
// 없고 byte-identical 직렬화가 적절한 동등 판정 기준이다.
function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * 실 평가 e2e **step④ post-evaluation interpretation 종단 컴포저**
 * (`buildRealDataResultIssueCommandPlan`) 산출 plan 이, 주입된 입력 `(results, run)`
 * 으로 동일 2 위임 helper(buildRealDataResultReportPlan → 그 산출 descriptor 로
 * buildRealDataResultIssueCommandArgs)를 재호출해 single-source 재유도한 expected plan
 * 과 정합함을 런타임에서 검증하는 순수 가드(PLAN.md P5 109행 step ④ build-time chain 의
 * post-evaluation interpretation 종단 seam 무결성 조각).
 * `assertRealDataResultIssueGhCommandPlanConsistentWithInputs`(T-0695, stdout-side 종단
 * 가드)의 evaluation-side mirror.
 *
 * 검증하는 불변식(single source — 입력 (results, run) 의 2 helper 재유도):
 *   - plan.report 가 재유도 report 와 deep equal(summary 집계 분포 + descriptor
 *     title/marker/body 일치).
 *   - plan.commandArgs 가 재유도 commandArgs 와 deep equal(searchQuery + createArgs
 *     {title, body, labels} + updateArgs{title, body} 정합).
 *   - plan 의 두 필드 간 내부 정합(plan.commandArgs 가 plan.report.descriptor 로부터
 *     합성된 것과 일관)은 재유도 축으로 자동 cover — 별도 cross 검증 불요.
 *
 * 검사 순서(fail-fast): 구조(plan 객체 → plan.report 객체 → plan.commandArgs 객체 →
 * plan.commandArgs.createArgs 객체 → plan.commandArgs.updateArgs 객체 → results 배열 →
 * run 객체) → 재유도(2 위임 helper 호출 — 각 layer throw 그대로 전파) → report deep
 * equal → commandArgs deep equal. 가장 먼저 어긋난 지점에서 throw.
 *
 * @param plan 종단 컴포저 산출 `RealDataResultIssueCommandPlan`. 변형하지 않는다.
 * @param results 재유도 source — `buildRealDataResultReportPlan(results, run)` 재호출에
 *   사용. 변형하지 않는다(읽기·전달만).
 * @param run 재유도 source — `buildRealDataResultReportPlan(results, run)` 재호출에 사용.
 *   변형하지 않는다(읽기·전달만).
 * @returns 정합이면 void.
 * @throws {TypeError} `plan` 비-객체 / `plan.report` 비-객체 / `plan.commandArgs`
 *   비-객체 / `plan.commandArgs.createArgs` 비-객체 / `plan.commandArgs.updateArgs`
 *   비-객체 / `results` 비-배열 / `run` 비-객체(구조·타입 결손).
 * @throws {RangeError} report summary 집계 drift / descriptor title·marker·body drift /
 *   commandArgs searchQuery drift / createArgs title·body·labels drift / updateArgs
 *   title·body drift(값 정합 위반). 메시지에 어긋난 필드 / 기대값 / 실측값 포함.
 *   또한 위임 helper(report-plan / command-args)의 throw(예: run.gitSha 빈/공백 ·
 *   descriptor.title/marker 빈/공백)는 가드 자체 try/catch 없이 그대로 전파.
 */
export function assertRealDataResultIssueCommandPlanConsistentWithInputs(
  plan: RealDataResultIssueCommandPlan,
  results: EvaluationResult[],
  run: RealDataResultIssueRunRef,
): void {
  // (1) 구조 검증(TypeError 분기) — plan / plan.report / plan.commandArgs /
  // plan.commandArgs.createArgs / plan.commandArgs.updateArgs / results / run.
  // plan 객체부터 검사해야 .report/.commandArgs 접근이 안전하고, results/run 도 재유도
  // 호출 직전에 검사해 helper 에 비정상 입력을 넘기지 않는다.
  assertPlanStructure(plan);
  assertPlanReportStructure(plan.report);
  assertPlanCommandArgsStructure(plan.commandArgs);
  const commandArgs = plan.commandArgs as RealDataResultIssueCommandArgs;
  assertPlanCommandArgsCreateArgsStructure(commandArgs.createArgs);
  assertPlanCommandArgsUpdateArgsStructure(commandArgs.updateArgs);
  assertResultsStructure(results);
  assertRunStructure(run);

  // (2) single-source 재유도 — 동일 2 위임 helper 를 재호출. 각 layer 의 throw(run.gitSha/
  // dateToken 빈/공백 → report-plan throw, descriptor.title/marker 빈/공백 → command-args
  // throw)는 자체 try/catch 없이 그대로 위로 전파한다(컴포저 throw 전파 정책과 동형 —
  // 조용한 통과 차단).
  const expectedReport = buildRealDataResultReportPlan(results, run);
  const expectedCommandArgs = buildRealDataResultIssueCommandArgs(
    expectedReport.descriptor,
  );

  // (3) report deep equal — summary 집계 분포(count·byDifficulty·byContribution·
  // totalVolume) + descriptor(title/marker/body) 정합. drift 면 RangeError 로 분류
  // (값 정합 위반).
  if (!deepEqual(plan.report, expectedReport)) {
    throw new RangeError(
      `정합 위반: plan.report 가 (results, run) 재유도 report 와 다르다 — 기대=${JSON.stringify(
        expectedReport,
      )}, 실측=${JSON.stringify(plan.report)}. summary 집계 분포 또는 descriptor(title/marker/body) 가 어긋났다.`,
    );
  }

  // (4) commandArgs deep equal — searchQuery + createArgs{title, body, labels} +
  // updateArgs{title, body} 정합. drift 면 RangeError. report↔commandArgs cross 어긋남
  // (plan.commandArgs 가 plan.report.descriptor 가 아닌 다른 descriptor 로 합성된 듯)도
  // 이 단계에서 자연 catch — 재유도 commandArgs 는 재유도 descriptor 로 합성되므로
  // cross drift 가 plan.commandArgs 와 expectedCommandArgs 사이 byte 불일치로 노출된다.
  if (!deepEqual(plan.commandArgs, expectedCommandArgs)) {
    throw new RangeError(
      `정합 위반: plan.commandArgs 가 (results, run) 재유도 commandArgs 와 다르다 — 기대=${JSON.stringify(
        expectedCommandArgs,
      )}, 실측=${JSON.stringify(plan.commandArgs)}. searchQuery / createArgs(title·body·labels) / updateArgs(title·body) 중 하나 이상이 어긋났다(report↔commandArgs cross 어긋남 포함).`,
    );
  }
}
