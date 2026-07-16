// realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan-consistency.ts —
// 실 평가 e2e daily-step dual-leg run report 이슈 publish-plan composer 산출 ↔
// single-source(report) 3단 재유도 byte-identical 정합 순수 가드 (T-1017 박제,
// 요약축 T-0665 mirror).
//
// 책임:
//   - `buildRealDataDailyStepDualLegRunReportIssuePublishPlan(report)`(T-1016,
//     `realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan.ts`)은
//     (1) `buildRealDataDailyStepDualLegRunReportIssueDescriptor(report)`(T-0896) →
//     descriptor (2) `buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor)`
//     (T-0990) → commandArgs (3)
//     `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs)` → searchArgv
//     의 **3단 순차 위임**을 엮어 `RealDataDailyStepDualLegRunReportIssuePublishPlan`
//     ({descriptor, commandArgs, searchArgv})을 반환한다. 그러나 그 합성 결과가
//     **single source(report)에서 정확히 재유도 가능한지** — 컴포저가 세 위임 사이에 끼어
//     결과를 변형/누락/재가공하지 않았는지 — 를 런타임에서 강제하는 독립 불변식 가드가
//     부재했다. 본 가드가 그 빈칸을 채운다. 합성 회귀로 손상된 plan 이 step ④ live
//     runner(execFile('gh', searchArgv) + 종단 컴포저)로 새기 전 fail-fast throw 로
//     차단한다.
//
// 🔥 topology (요약축 T-0665 2 source·2층 → daily-step single source·2층, T-1023 동형화):
//   - 요약축 종단 가드 `assertRealDataResultIssuePublishPlanConsistentWithSources`
//     (T-0665)는 source 가 `results` + `run` 2 개이고 재유도가 command-plan(results+run →
//     report+commandArgs) + search-argv **2층 위임**이다. daily-step 도 본래 3단 직접 위임
//     (descriptor → command-args → search-argv)이었으나 T-1023 이 앞 2단(descriptor →
//     command-args)을 중간 command-plan 컴포저(T-1019) 1회 위임으로 묶어 요약축과 동형인
//     **command-plan ⊂ publish-plan 2층 재유도**로 수렴했다 — `buildRealDataDailyStep...
//     CommandPlan(report) → {descriptor, commandArgs}` (앞 2단 위임) 위에 search-argv 만
//     얹는다. 남는 topology 차이는 daily-step 이 **single source `report`** 라 시그니처가
//     `(plan, report)` 이고 command-plan 산출이 `{descriptor, commandArgs}`(요약축의
//     `{report, commandArgs}` 대비 rendered `report` 층 대신 descriptor 첫 필드)라는 점뿐.
//
// 검증하는 불변식(single source — command-plan 컴포저 위임 + search-argv 위임 재유도):
//   - { descriptor: expectedDescriptor, commandArgs: expectedCommandArgs } =
//       buildRealDataDailyStepDualLegRunReportIssueCommandPlan(report) 재유도 →
//     `plan.descriptor` / `plan.commandArgs` 가 각각 deep-equal byte-identical.
//   - expectedSearchArgv  = buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(
//       expectedCommandArgs) 재유도 → `plan.searchArgv` 가 deep-equal byte-identical
//     (원소·순서·길이까지).
//   - 재유도 chain(descriptor 합성·명령-args 합성·search argv 합성)은 일절 재구현하지
//     않는다 — command-plan 컴포저(앞 2단)·search-argv 빌더 위임 호출만(drift 0 보장의
//     핵심, SSOT 보존 — descriptor→command-args 구간이 command-plan 단일 경로로 수렴).
//
// 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
//   - `plan` null/undefined · `plan.descriptor`/`plan.commandArgs` 비-object ·
//     `plan.searchArgv` 비-배열 또는 원소 비-string → 한국어 TypeError.
//   - 재유도 expected 와 `plan` 의 어느 구성요소라도 drift → 한국어 RangeError(메시지에
//     어느 구성요소가 어긋났는지 포함).
//   - 재유도 chain 이 throw(report.gitSha/dateToken 빈/공백 → command-plan 컴포저 내부
//     descriptor 단계 `assertNonBlank` throw, 또는 command-plan T-1021 self-assert throw)
//     하면 가드가 삼키지 않고 그대로 전파(자체 try/catch 0). 이 throw 는 command-plan
//     컴포저 위임 단계에서 발생하므로 search-argv 재유도는 미도달한다.
//   - silent 통과(위반인데 정상 void) 0. fail-fast(가장 먼저 위반한 지점에서 throw).
//
// 비변형 / 순수: `plan`(읽기·비교만) / `report`(읽기만, mutate 0). 부수효과 0 ·
// `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0 · env/네트워크/credential 0.
// 재유도 산출물은 로컬 대조 후 폐기(노출 0). 동일 입력 → 동일 동작(정합 plan 면 항상 void,
// drift plan 면 항상 동일 구성요소에서 throw).
//
// 패턴 mirror: `assertRealDataResultIssuePublishPlanConsistentWithSources`(T-0665,
// publish-plan composer 산출 ↔ single-source 재유도 byte-identical 비교 + 구조 결손=
// TypeError / 값 정합 위반=RangeError 구분 fail-fast — 그 가드도 command-plan 컴포저 위임
// + search-argv 위임 2층 재유도다). 본 가드는 그 daily-step mirror — describe/throw
// 계약·메시지 포맷·2층 재유도 구조를 동형으로 따르되 source 를 report 하나로, command-plan
// 산출을 `{descriptor, commandArgs}` 로 조정한다(T-1023 동형화).
//
// self-wire 없음 (범위 확인 — 요약축 T-0665 창설 단계 대응):
//   - 본 가드는 컴포저(`buildRealDataDailyStepDualLegRunReportIssuePublishPlan`) 내부에서
//     호출되지 **않는다**. 요약축도 T-0665 는 가드만 신설했고 self-wire(T-0666)는 후속
//     slice 에서 박제했다 — 본 task 는 그 T-0665 단계에 정확히 대응한다(가드 신설만).
//
// Out of Scope (task T-1017):
//   - 컴포저 self-wire 배선(`buildRealDataDailyStepDualLegRunReportIssuePublishPlan` 반환
//     직전 self-assert) — 별도 후속 slice(요약축 T-0666 mirror).
//   - 컴포저 / 위임 3빌더(descriptor/command-args/search-argv) 본문 수정 — 본 가드는
//     import·재유도 비교·throw 만(재정의 0).
//   - 자동 복구 / plan 재합성 / 정규화 / 기본값 채움 0 — 손상 plan 을 고치거나 silent
//     수선하지 않는다(fail-fast). 복구는 호출처 책임.
//   - JSON schema / 외부 validation 라이브러리(zod·ajv) 도입 0 — 순수 비교만.
//   - 재유도 chain 의 descriptor·명령-args·search argv 합성 재구현 — 전부 위임 호출로
//     재유도(재구현 금지).
import type { RealDataDailyStepDualLegRunReport } from "./realdata-e2e-daily-step-dual-leg-run-report";
import { buildRealDataDailyStepDualLegRunReportIssueCommandPlan } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan";
import type { RealDataDailyStepDualLegRunReportIssuePublishPlan } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan";
import { buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv";

// isPlainObject — null 이 아닌 non-array object 인지 판정. descriptor / commandArgs 구조
// 검증에 쓰인다(배열·null 은 거부).
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

// assertPlanStructure — `plan` 객체와 3 구성요소(descriptor/commandArgs/searchArgv)의
// 구조가 온전한지 fail-fast 검증. 구조/타입 결손은 RangeError 가 아니라 TypeError 로
// 구분한다(값 정합 위반과 분리). descriptor/commandArgs 는 non-null object, searchArgv 는
// string[] 이어야 한다(deep-equal 비교 전 최소 형태 보장 — 깊은 필드 검증은 재유도 위임의
// 몫). 재유도(위임 호출) **전**에 평가되므로 구조 위반이면 위임은 미호출된다.
function assertPlanStructure(
  plan: RealDataDailyStepDualLegRunReportIssuePublishPlan | null | undefined,
): asserts plan is RealDataDailyStepDualLegRunReportIssuePublishPlan {
  if (plan === null || plan === undefined) {
    throw new TypeError(
      "plan 이 null/undefined 일 수 없다 — RealDataDailyStepDualLegRunReportIssuePublishPlan 객체가 필요하다.",
    );
  }
  if (!isPlainObject(plan.descriptor)) {
    throw new TypeError(
      `plan.descriptor 가 객체가 아니다(타입: ${describe(plan.descriptor)}) — 재유도 정합 비교를 진행할 수 없다.`,
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

// deepEqual — JSON 직렬화 기반 byte-identical 비교. descriptor / commandArgs 트리는 순수
// helper 가 결정론적 키 순서로 합성하므로 직렬화 동등 = 구조 동등. 비교만(입력 변형 0).
function deepEqual(actual: unknown, expected: unknown): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

/**
 * 실 평가 e2e daily-step dual-leg run report 이슈 publish-plan composer
 * (`buildRealDataDailyStepDualLegRunReportIssuePublishPlan`) 의 산출 plan 이, 동일
 * single source `report` 를 command-plan 컴포저 + search-argv 2층 위임으로 재유도한
 * 결과와 byte-identical 정합함을 런타임에서 검증하는 순수 가드(PLAN.md P5 109행 step ④
 * 결과 박제 chain 의 post-composition 무결성 조각). 요약축 종단 가드
 * `assertRealDataResultIssuePublishPlanConsistentWithSources`(T-0665) 의 daily-step
 * mirror — source 를 report 하나로, 재유도를 command-plan ⊂ publish-plan 2층 위임으로
 * 조정한다(T-1023 동형화).
 *
 * 검증하는 불변식(single source — command-plan 컴포저 위임 + search-argv 위임 재유도):
 *   { descriptor: expectedDescriptor, commandArgs: expectedCommandArgs } =
 *       buildRealDataDailyStepDualLegRunReportIssueCommandPlan(report)
 *   expectedSearchArgv  = buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(
 *                           expectedCommandArgs)
 *   의 3 구성요소(descriptor/commandArgs/searchArgv)가 `plan` 의 동일 구성요소와 각각
 *   deep-equal byte-identical.
 *
 * 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
 *   - `plan` null/undefined · `plan.descriptor`/`plan.commandArgs` 비-object ·
 *     `plan.searchArgv` 비-배열 또는 원소 비-string → 한국어 TypeError.
 *   - 재유도 expected 와 `plan` 의 어느 구성요소라도 drift → 한국어 RangeError. 메시지에
 *     어느 구성요소가 어긋났는지 포함.
 *   - 재유도 chain 이 throw(report.gitSha/dateToken 빈/공백 → command-plan 컴포저 내부
 *     descriptor 단계 위임 throw, 또는 command-plan T-1021 self-assert throw)하면 가드가
 *     삼키지 않고 그대로 전파(가드 본문 재유도 단계의 위임 throw — 자체 try/catch 0). 이
 *     throw 는 command-plan 컴포저 위임 단계에서 발생하므로 search-argv 재유도는 미도달.
 *   - silent 통과(위반인데 정상 void) 0.
 *
 * 검사 순서: 구조(plan 존재 · descriptor/commandArgs object · searchArgv string[]) →
 * 재유도(command-plan 컴포저 → search-argv 순차) → 구성요소별 순회 비교(descriptor →
 * commandArgs → searchArgv). 가장 먼저 위반한 지점에서 throw(fail-fast). 구조 위반이면
 * 재유도(위임 호출)에 도달하지 않는다.
 *
 * 비변형 / 순수: `plan` / `report` 를 읽기·비교만 한다(쓰기 0). 부수효과 0 ·
 * `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0. 동일 입력 → 동일 동작
 * (정합 plan 면 항상 void 반환, drift plan 면 항상 동일 구성요소에서 throw).
 *
 * @param plan 검증 대상 컴포저 산출 plan. 변형하지 않는다(읽기·비교만). descriptor/
 *   commandArgs 는 객체, searchArgv 는 string[] 이어야 하며 재유도 expected 와 정합해야
 *   한다.
 * @param report 재유도 chain 의 single source. 변형하지 않는다(읽기만). command-plan
 *   컴포저(앞 2단)·search-argv 빌더에 순차로 넘겨 expected descriptor/commandArgs/
 *   searchArgv 를 재유도한다. gitSha/dateToken 빈/공백이면 command-plan 컴포저 내부
 *   descriptor 위임 guard throw 가 전파된다.
 * @returns 3 구성요소가 모두 재유도 expected 와 정합하면 아무 일도 하지 않고 정상 반환
 *   (void).
 * @throws {TypeError} `plan` null/undefined 또는 `plan.descriptor`/`plan.commandArgs`
 *   비-object 또는 `plan.searchArgv` 비-배열·원소 비-string(구조/타입 결손).
 * @throws {RangeError} 재유도 expected 와 `plan` 의 어느 구성요소라도 drift(값 정합 위반).
 *   메시지에 어느 구성요소가 어긋났는지 포함.
 */
export function assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(
  plan: RealDataDailyStepDualLegRunReportIssuePublishPlan,
  report: RealDataDailyStepDualLegRunReport,
): void {
  // 구조 검증(TypeError 분기) — plan 존재 + descriptor/commandArgs object +
  // searchArgv string[]. 재유도(위임 호출) 전에 평가되므로 구조 위반이면 위임은 미호출.
  assertPlanStructure(plan);

  // 기대값 재유도(2층 위임 — command-plan ⊂ publish-plan) — 컴포저가 내부에서 엮는 앞
  // 2단(descriptor → command-args)을 본 가드는 직접 재합성하지 않고 중간 command-plan
  // 컴포저(T-1019) 1회 위임으로 재유도한 뒤 그 위에 search-argv 위임만 얹는다(요약축
  // T-0665 의 command-plan ⊂ publish-plan 2층 재유도와 동형). command-plan 컴포저는
  // 내부에서 descriptor → command-args 를 순차 위임하고 반환 직전 자기 consistency
  // 가드(T-1020)를 self-assert(T-1021)하므로, 그 self-assert 가 재유도 경로에서도
  // transitively 실행된다(중첩, 정상 재유도는 항상 통과). report.gitSha/dateToken 빈/공백
  // 이면 command-plan 컴포저 내부 descriptor 단계 하위 guard throw 가 재포장 없이 그대로
  // 전파되며, 그 경우 search-argv 재유도는 미도달한다(순차 short-circuit).
  const { descriptor: expectedDescriptor, commandArgs: expectedCommandArgs } =
    buildRealDataDailyStepDualLegRunReportIssueCommandPlan(report);
  const expectedSearchArgv =
    buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(
      expectedCommandArgs,
    );

  // descriptor 정합 비교 — deep-equal byte-identical.
  if (!deepEqual(plan.descriptor, expectedDescriptor)) {
    throw new RangeError(
      `정합 위반: plan.descriptor 가 재유도 expected 와 byte-identical 하지 않다 — 기대=${JSON.stringify(expectedDescriptor)}, 실측=${JSON.stringify(plan.descriptor)}.`,
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
