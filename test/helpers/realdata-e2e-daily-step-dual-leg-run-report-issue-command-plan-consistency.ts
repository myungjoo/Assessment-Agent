// realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan-consistency.ts —
// 실 평가 e2e daily-step dual-leg run report 이슈 command-plan composer 산출 ↔
// single-source(report) 2단 재유도 byte-identical 정합 순수 가드 (T-1020 박제,
// 요약축 T-0696 mirror · 형제 daily-step publish-plan T-1017 의 command-plan 축소 mirror).
//
// 책임:
//   - `buildRealDataDailyStepDualLegRunReportIssueCommandPlan(report)`(T-1019,
//     `realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan.ts`)은
//     (1) `buildRealDataDailyStepDualLegRunReportIssueDescriptor(report)`(T-0896) →
//     descriptor (2) `buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor)`
//     (T-0990) → commandArgs 의 **2단 순차 위임**을 엮어
//     `RealDataDailyStepDualLegRunReportIssueCommandPlan` ({descriptor, commandArgs})을
//     반환한다. 그러나 그 합성 결과가 **single source(report)에서 정확히 재유도 가능한지**
//     — 컴포저가 두 위임 사이에 끼어 결과를 변형/누락/재가공하지 않았는지 — 를 런타임에서
//     강제하는 독립 불변식 가드가 부재했다. 본 가드가 그 빈칸을 채운다. 합성 회귀로 손상된
//     plan 이 step ④ live runner(종단 컴포저 + execFile('gh', argv))로 새기 전 fail-fast
//     throw 로 차단한다.
//
// 🔥 topology 차이 (형제 publish-plan T-1017 3단 → command-plan 2단, 요약축 T-0696 mirror):
//   - 형제 daily-step publish-plan 가드
//     `assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource`
//     (T-1017)는 재유도가 descriptor → command-args → search-argv **3단**이고 대조 필드가
//     descriptor/commandArgs/searchArgv 3개다. command-plan 은 그 prefix — search-argv
//     재유도 1단·searchArgv 필드 대조 1개가 빠진 **2단 재유도**이고 대조 필드가
//     descriptor/commandArgs 2개뿐이다. 요약축 command-plan 가드 T-0696 의 daily-step
//     mirror 이기도 하되, 요약축 T-0696 은 source 가 results+run 2입력이라 명명이
//     `WithInputs` 인 반면 daily-step 은 **single source `report`** 이므로 형제 T-1017 의
//     `WithSource` 명명 관용을 계승한다(단일 source report → WithSource).
//
// 검증하는 불변식(single source — 두 위임 함수 직접 순차 호출 재유도):
//   - expectedDescriptor  = buildRealDataDailyStepDualLegRunReportIssueDescriptor(report)
//     재유도 → `plan.descriptor` 가 deep-equal byte-identical.
//   - expectedCommandArgs = buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
//       expectedDescriptor) 재유도 → `plan.commandArgs` 가 deep-equal byte-identical
//     (원소·순서·길이까지).
//   - 재유도 chain(descriptor 합성·명령-args 합성)은 일절 재구현하지 않는다 — 위임 호출만
//     (drift 0 보장의 핵심, SSOT 보존).
//
// 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
//   - `plan` null/undefined · `plan.descriptor`/`plan.commandArgs` 비-object → 한국어
//     TypeError.
//   - 재유도 expected 와 `plan` 의 어느 구성요소라도 drift → 한국어 RangeError(메시지에
//     어느 구성요소가 어긋났는지 포함).
//   - 재유도 chain 이 throw(report.gitSha/dateToken 빈/공백 → descriptor 위임의
//     `assertNonBlank` throw, descriptor.title/marker 빈/공백 → command-args 위임 throw)
//     하면 가드가 삼키지 않고 그대로 전파(자체 try/catch 0). descriptor 단계에서 throw 되면
//     command-args 재유도는 미도달한다(순차 short-circuit).
//   - silent 통과(위반인데 정상 void) 0. fail-fast(가장 먼저 위반한 지점에서 throw).
//
// 비변형 / 순수: `plan`(읽기·비교만) / `report`(읽기만, mutate 0). 부수효과 0 ·
// `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0 · env/네트워크/credential 0.
// 재유도 산출물은 로컬 대조 후 폐기(노출 0). 동일 입력 → 동일 동작(정합 plan 면 항상 void,
// drift plan 면 항상 동일 구성요소에서 throw).
//
// 패턴 mirror: 형제 publish-plan 가드
// `assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource`(T-1017,
// 3단 재유도) 및 요약축 command-plan 가드
// `assertRealDataResultIssueCommandPlanConsistentWithInputs`(T-0696). 본 가드는 그
// describe/throw 계약·메시지 포맷을 동형으로 따르되 재유도를 2단 위임으로, 대조를 2필드로
// 축소한다.
//
// self-wire 없음 (범위 확인 — 형제 T-1017 창설 단계 대응):
//   - 본 가드는 컴포저(`buildRealDataDailyStepDualLegRunReportIssueCommandPlan`) 내부에서
//     호출되지 **않는다**. 형제도 T-1017 은 가드만 신설했고 self-wire(T-1018)는 후속
//     slice 에서 박제했다 — 본 task 는 그 T-1017 단계에 정확히 대응한다(가드 신설만).
//
// Out of Scope (task T-1020):
//   - 컴포저 self-wire 배선(`buildRealDataDailyStepDualLegRunReportIssueCommandPlan` 반환
//     직전 self-assert) — 별도 후속 slice(형제 T-1018 · 요약축 T-0697 mirror).
//   - 컴포저 / 위임 2빌더(descriptor/command-args) 본문 수정 — 본 가드는 import·재유도
//     비교·throw 만(재정의 0).
//   - 자동 복구 / plan 재합성 / 정규화 / 기본값 채움 0 — 손상 plan 을 고치거나 silent
//     수선하지 않는다(fail-fast). 복구는 호출처 책임.
//   - JSON schema / 외부 validation 라이브러리(zod·ajv) 도입 0 — 순수 비교만.
//   - 재유도 chain 의 descriptor·명령-args 합성 재구현 — 전부 위임 호출로 재유도(재구현
//     금지).
import type { RealDataDailyStepDualLegRunReport } from "./realdata-e2e-daily-step-dual-leg-run-report";
import { buildRealDataDailyStepDualLegRunReportIssueCommandArgs } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
import type { RealDataDailyStepDualLegRunReportIssueCommandPlan } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan";
import { buildRealDataDailyStepDualLegRunReportIssueDescriptor } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor";

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

// assertPlanStructure — `plan` 객체와 2 구성요소(descriptor/commandArgs)의 구조가 온전한지
// fail-fast 검증. 구조/타입 결손은 RangeError 가 아니라 TypeError 로 구분한다(값 정합
// 위반과 분리). descriptor/commandArgs 는 non-null object 이어야 한다(deep-equal 비교 전
// 최소 형태 보장 — 깊은 필드 검증은 재유도 위임의 몫). 재유도(위임 호출) **전**에 평가되므로
// 구조 위반이면 위임은 미호출된다.
function assertPlanStructure(
  plan: RealDataDailyStepDualLegRunReportIssueCommandPlan | null | undefined,
): asserts plan is RealDataDailyStepDualLegRunReportIssueCommandPlan {
  if (plan === null || plan === undefined) {
    throw new TypeError(
      "plan 이 null/undefined 일 수 없다 — RealDataDailyStepDualLegRunReportIssueCommandPlan 객체가 필요하다.",
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
}

// deepEqual — JSON 직렬화 기반 byte-identical 비교. descriptor / commandArgs 트리는 순수
// helper 가 결정론적 키 순서로 합성하므로 직렬화 동등 = 구조 동등. 비교만(입력 변형 0).
function deepEqual(actual: unknown, expected: unknown): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

/**
 * 실 평가 e2e daily-step dual-leg run report 이슈 command-plan composer
 * (`buildRealDataDailyStepDualLegRunReportIssueCommandPlan`) 의 산출 plan 이, 동일
 * single source `report` 를 두 위임 함수로 직접 순차 재유도한 결과와 byte-identical
 * 정합함을 런타임에서 검증하는 순수 가드(PLAN.md P5 109행 step ④ 결과 박제 chain 의
 * post-composition 무결성 조각). 형제 daily-step publish-plan 가드
 * `assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource`(T-1017,
 * 3단) 의 command-plan(2단) 축소 mirror 이자, 요약축 command-plan 가드
 * `assertRealDataResultIssueCommandPlanConsistentWithInputs`(T-0696) 의 daily-step
 * mirror — source 를 report 하나로(WithSource), 재유도를 2단 순차 위임으로 조정한다.
 *
 * 검증하는 불변식(single source — 두 위임 함수 직접 순차 호출 재유도):
 *   expectedDescriptor  = buildRealDataDailyStepDualLegRunReportIssueDescriptor(report)
 *   expectedCommandArgs = buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
 *                           expectedDescriptor)
 *   의 2 구성요소(descriptor/commandArgs)가 `plan` 의 동일 구성요소와 각각 deep-equal
 *   byte-identical.
 *
 * 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
 *   - `plan` null/undefined · `plan.descriptor`/`plan.commandArgs` 비-object → 한국어
 *     TypeError.
 *   - 재유도 expected 와 `plan` 의 어느 구성요소라도 drift → 한국어 RangeError. 메시지에
 *     어느 구성요소가 어긋났는지 포함.
 *   - 재유도 chain 이 throw(report.gitSha/dateToken 빈/공백 → descriptor 위임 throw,
 *     descriptor.title/marker 빈/공백 → command-args 위임 throw)하면 가드가 삼키지 않고
 *     그대로 전파(가드 본문 재유도 단계의 위임 throw — 자체 try/catch 0). descriptor
 *     단계에서 throw 되면 command-args 재유도는 미도달.
 *   - silent 통과(위반인데 정상 void) 0.
 *
 * 검사 순서: 구조(plan 존재 · descriptor/commandArgs object) → 재유도(descriptor →
 * command-args 순차) → 구성요소별 비교(descriptor → commandArgs). 가장 먼저 위반한
 * 지점에서 throw(fail-fast). 구조 위반이면 재유도(위임 호출)에 도달하지 않는다.
 *
 * 비변형 / 순수: `plan` / `report` 를 읽기·비교만 한다(쓰기 0). 부수효과 0 ·
 * `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0. 동일 입력 → 동일 동작
 * (정합 plan 면 항상 void 반환, drift plan 면 항상 동일 구성요소에서 throw).
 *
 * @param plan 검증 대상 컴포저 산출 plan. 변형하지 않는다(읽기·비교만). descriptor/
 *   commandArgs 는 객체이어야 하며 재유도 expected 와 정합해야 한다.
 * @param report 재유도 chain 의 single source. 변형하지 않는다(읽기만). 두 위임 함수에
 *   순차로 넘겨 expected descriptor/commandArgs 를 재유도한다. gitSha/dateToken 빈/공백
 *   이면 descriptor 위임 guard throw 가 전파된다.
 * @returns 2 구성요소가 모두 재유도 expected 와 정합하면 아무 일도 하지 않고 정상 반환
 *   (void).
 * @throws {TypeError} `plan` null/undefined 또는 `plan.descriptor`/`plan.commandArgs`
 *   비-object(구조/타입 결손).
 * @throws {RangeError} 재유도 expected 와 `plan` 의 어느 구성요소라도 drift(값 정합 위반).
 *   메시지에 어느 구성요소가 어긋났는지 포함.
 */
export function assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
  plan: RealDataDailyStepDualLegRunReportIssueCommandPlan,
  report: RealDataDailyStepDualLegRunReport,
): void {
  // 구조 검증(TypeError 분기) — plan 존재 + descriptor/commandArgs object. 재유도(위임
  // 호출) 전에 평가되므로 구조 위반이면 위임은 미호출.
  assertPlanStructure(plan);

  // 기대값 재유도 — 컴포저가 내부에서 엮는 두 위임 함수를 본 가드가 직접 같은 순서로
  // 호출해 single-source expected 를 산출한다(drift 0). descriptor 위임 guard 가 throw
  // 하면(report.gitSha/dateToken 빈/공백) 가드가 삼키지 않고 그대로 전파하며, 그 경우
  // command-args 재유도는 미도달한다(순차 short-circuit).
  const expectedDescriptor =
    buildRealDataDailyStepDualLegRunReportIssueDescriptor(report);
  const expectedCommandArgs =
    buildRealDataDailyStepDualLegRunReportIssueCommandArgs(expectedDescriptor);

  // descriptor 정합 비교 — deep-equal byte-identical.
  if (!deepEqual(plan.descriptor, expectedDescriptor)) {
    throw new RangeError(
      `정합 위반: plan.descriptor 가 재유도 expected 와 byte-identical 하지 않다 — 기대=${JSON.stringify(expectedDescriptor)}, 실측=${JSON.stringify(plan.descriptor)}.`,
    );
  }

  // commandArgs 정합 비교 — deep-equal byte-identical(원소·순서·길이까지).
  if (!deepEqual(plan.commandArgs, expectedCommandArgs)) {
    throw new RangeError(
      `정합 위반: plan.commandArgs 가 재유도 expected 와 byte-identical 하지 않다 — 기대=${JSON.stringify(expectedCommandArgs)}, 실측=${JSON.stringify(plan.commandArgs)}.`,
    );
  }
}
