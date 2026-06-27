// realdata-e2e-result-report-plan-consistency.ts — 실 평가 e2e **step③→④ 경계
// 종단 컴포저** 산출 ↔ 입력 (results, run) single-source 재유도 정합 순수 가드
// (T-0699 박제).
//
// 책임:
//   - `buildRealDataResultReportPlan(results, run)`(T-0593,
//     `realdata-e2e-result-report-plan.ts`)는 `EvaluationResult[]` + run 식별자를 입력
//     받아 (1) `buildRealDataResultSummary(results)`(T-0580) → `summary` , (2)
//     `buildRealDataResultIssueDescriptor(summary, run)`(T-0582) → `descriptor` 2-단계를
//     합성해 `{summary, descriptor}`(`RealDataResultReportPlan`) plan 을 산출하는 **step
//     ③→④ post-evaluation interpretation 경계 컴포저**다. 현재 이 컴포저는 반환 직전
//     `assertRealDataResultIssueDescriptorBodyConsistent(descriptor, summary)`(T-0647)
//     **하나만** self-wire 한다 — 이는 산출된 두 구성요소끼리의 **내부-shape 정합**만
//     검증할 뿐, plan 이 **원본 입력 `(results, run)` 에서 single-source 로 재유도되는지**
//     (summary 가 정말 results 의 집계인지, descriptor 가 정말 그 summary+run 의 산물인지)
//     는 대조하지 않는다. summary 집계 drift·descriptor title/marker/body drift·
//     summary↔descriptor cross 어긋남(plan.descriptor 가 plan.summary 가 아닌 다른
//     summary 로 합성된 듯) 같은 합성 회귀를 build-time 에 잡을 외부 독립 장치가 없었다.
//     본 가드는 합성 회귀로 손상된 plan 이 caller(step④ live wiring)로 새기 전 build-time
//     에 fail-fast throw 로 차단한다.
//
// 검증하는 불변식(single source — 입력 `(results, run)` 의 2 위임 helper 재유도):
//   - 입력 `(results, run)` 으로 동일 2 위임 helper(`buildRealDataResultSummary` → 그
//     산출 summary 로 `buildRealDataResultIssueDescriptor`)를 재호출해 expected
//     `{summary, descriptor}` 를 single-source 재유도한다(합성 규칙 재구현 0 — 위임만).
//   - `plan.summary` ↔ 재유도 summary: 집계 분포(count·byDifficulty·byContribution·
//     totalVolume) deep equal.
//   - `plan.descriptor` ↔ 재유도 descriptor: title/marker/body deep equal.
//   - summary↔descriptor cross 어긋남(plan.descriptor 가 plan.summary 가 아닌 다른
//     summary 로 합성된 듯)은 descriptor deep equal 단계에서 자연 catch — 재유도
//     descriptor 는 재유도 summary 로 합성되므로 cross drift 가 plan.descriptor 와
//     expectedDescriptor 사이 byte 불일치로 노출된다.
//
// 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError —
// `*-command-plan-consistency.ts`(T-0696) mirror):
//   - `plan` 비-객체(null/undefined/배열/원시 포함) → 한국어 TypeError.
//   - `plan.summary` 비-객체(null/undefined/배열/원시 포함) → 한국어 TypeError(deep
//     equal 비교가 무의미 — 구조 결손 분류).
//   - `plan.descriptor` 비-객체(null/undefined/배열/원시 포함) → 한국어 TypeError(같은
//     이유).
//   - `results` 비-배열(null/undefined/객체/원시 포함) → 한국어 TypeError(재유도 자체가
//     불가 — summary 위임은 배열 가정).
//   - `run` 비-객체(null/undefined/배열/원시 포함) → 한국어 TypeError(같은 이유 — run
//     키 접근 불가).
//   - summary 집계 drift(count·byDifficulty·byContribution·totalVolume 어긋남) →
//     RangeError.
//   - descriptor title/marker/body drift → RangeError.
//   - summary↔descriptor cross 어긋남 → descriptor deep equal 단계에서 RangeError 로 자연
//     catch.
//   - 위임 helper(`buildRealDataResultIssueDescriptor`)의 throw(run.gitSha/dateToken
//     빈/공백 → assertNonBlank throw)는 가드 자체 try/catch 없이 그대로 선전파.
//   - silent 통과(위반인데 정상 void) 0. fail-fast(가장 먼저 위반한 지점에서 throw).
//
// 비변형 / 순수: `plan` / `results` / `run` 읽기·비교만(mutate 0). 부수효과 0 ·
// `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0 · env/네트워크/credential 0.
// 동일 입력 → 동일 동작(정합 plan 이면 항상 void, drift 면 항상 동일 지점에서 throw).
// raw 미저장(R-59) — descriptor.body string 만 비교(narrative 원본 활동 본문은 plan 에
// 구조적 부재 — 미접촉). 가드는 2 위임 helper 를 재호출하지만, 각 helper 자체가 순수
// 함수라 가드 또한 결정론을 유지한다.
//
// 책임 경계(task T-0699 Out of Scope):
//   - 컴포저 본문 수정 / 반환 직전 self-wire 배선 — 본 가드는 외부 독립 검증만. self-wire
//     는 별도 후속 task("짝 닫기"). `realdata-e2e-result-report-plan.ts` 불변.
//   - 위임 helper(summary / descriptor) 수정 — 본 가드는 호출(재유도)만. 각 helper 의
//     합성 규칙·시그니처·throw 정책 불변.
//   - 기존 `assertRealDataResultIssueDescriptorBodyConsistent`(T-0647) 변경 0 — 본 가드는
//     plan 전체(summary + descriptor)의 (results, run) single-source 재유도 정합에 집중.
//     descriptor 내부 body-shape 정합은 그 기존 가드 책임(직교).
//   - 자동 복구 / 정규화 / 기본값 채움 / plan 재합성 0 — 손상 plan 을 silent 수선 0.
//   - JSON schema / 외부 validation 라이브러리(zod·ajv) 0 — 순수 비교만.
//   - 실 EvaluationResult 산출 / 실 LLM round-trip / 실 gh issue create/edit / Ollama /
//     live-LLM(ADR-0045) / credential wiring 0 — build-time 순수 가드만.
//
// 패턴 mirror: `assertRealDataResultIssueCommandPlanConsistentWithInputs`(T-0696, step④
// command-plan 종단 컴포저 가드)의 step③→④ 경계측 mirror — 차이점:
//   (a) 재유도 source 가 2-단계 합성(buildSummary → buildDescriptor)이고 plan 필드가
//       `{summary, descriptor}` 2 개라 deep equal 두 번이면 충분(create/update 분기 enum
//       없음).
//   (b) 위임 throw 는 descriptor layer 1 곳(run.gitSha/dateToken 빈/공백)에서만 발생 —
//       가드는 try/catch 없이 그대로 전파.
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";

import type { RealDataResultIssueRunRef } from "./realdata-e2e-result-issue-descriptor";
import { buildRealDataResultIssueDescriptor } from "./realdata-e2e-result-issue-descriptor";
import type { RealDataResultReportPlan } from "./realdata-e2e-result-report-plan";
import { buildRealDataResultSummary } from "./realdata-e2e-result-summary";

// describe — 에러 메시지용 타입 라벨. typeof 가 null/array 를 'object' 로 뭉뚱그리는
// 것을 분리 노출(디버깅 가독성). `*-command-plan-consistency.ts`(T-0696) mirror 와 동형
// helper.
function describe(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}

// assertPlanStructure — `plan` 의 최소 형태 fail-fast 검증. 객체여야 `.summary`/
// `.descriptor` 접근 시 타입 충돌이 차단된다. 구조/타입 결손은 TypeError 로 값 정합
// 위반(RangeError) 과 분리.
function assertPlanStructure(
  plan: RealDataResultReportPlan | null | undefined,
): asserts plan is RealDataResultReportPlan {
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

// assertPlanSummaryStructure — `plan.summary` 가 객체인지 fail-fast 검증. plan 통과
// 후에만 호출(plan 객체 보장). 비-객체면 재유도 summary 와의 deep equal 대조가 무의미.
function assertPlanSummaryStructure(summary: unknown): void {
  if (
    summary === null ||
    summary === undefined ||
    typeof summary !== "object" ||
    Array.isArray(summary)
  ) {
    throw new TypeError(
      `plan.summary 가 객체가 아니다(타입: ${describe(summary)}) — summary 정합 비교를 진행할 수 없다.`,
    );
  }
}

// assertPlanDescriptorStructure — `plan.descriptor` 가 객체인지 fail-fast 검증.
// 비-객체면 title/marker/body 접근 / deep equal 비교 자체가 무의미.
function assertPlanDescriptorStructure(descriptor: unknown): void {
  if (
    descriptor === null ||
    descriptor === undefined ||
    typeof descriptor !== "object" ||
    Array.isArray(descriptor)
  ) {
    throw new TypeError(
      `plan.descriptor 가 객체가 아니다(타입: ${describe(descriptor)}) — descriptor 정합 비교를 진행할 수 없다.`,
    );
  }
}

// assertResultsStructure — 재유도 source(results) 최소 형태 fail-fast 검증.
// `buildRealDataResultSummary` 위임이 배열 인자를 가정하므로 비-배열은 재유도 자체가
// 불가. TypeError 로 분류.
function assertResultsStructure(
  results: EvaluationResult[] | null | undefined,
): asserts results is EvaluationResult[] {
  if (results === null || results === undefined || !Array.isArray(results)) {
    throw new TypeError(
      `results 가 배열이 아니다(타입: ${describe(results)}) — summary 재유도를 진행할 수 없다.`,
    );
  }
}

// assertRunStructure — 재유도 source(run) 최소 형태 fail-fast 검증. descriptor 위임이
// 객체 인자를 가정(gitSha/dateToken 접근). 비-객체는 재유도 자체가 불가. 하위 필드
// 세부 검증(빈/공백 등)은 위임 helper(가드 재유도 호출) throw 로 자연 전파.
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
      `run 이 객체가 아니다(타입: ${describe(run)}) — descriptor 재유도를 진행할 수 없다.`,
    );
  }
}

// deepEqual — 결정론적 deep equality. JSON-직렬화 비교로 충분(plan 의 값은 string·
// number·plain object 만 — Date·Map·Set·function·undefined 키 부재). 동일 직렬화면 deep
// equal 로 간주. 위임 helper 들이 매 호출 새 객체를 만들기 때문에 참조 동등은 의미 없고
// byte-identical 직렬화가 적절한 동등 판정 기준이다.
function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * 실 평가 e2e **step③→④ 경계 종단 컴포저**(`buildRealDataResultReportPlan`) 산출 plan
 * 이, 주입된 입력 `(results, run)` 으로 동일 2 위임 helper(buildRealDataResultSummary →
 * 그 산출 summary 로 buildRealDataResultIssueDescriptor)를 재호출해 single-source
 * 재유도한 expected plan 과 정합함을 런타임에서 검증하는 순수 가드(PLAN.md P5 109행 step
 * ③→④ build-time chain 의 post-evaluation interpretation 경계 seam 무결성 조각).
 * `assertRealDataResultIssueCommandPlanConsistentWithInputs`(T-0696, command-plan 종단
 * 컴포저 가드)의 step③→④ 경계측 mirror.
 *
 * 검증하는 불변식(single source — 입력 (results, run) 의 2 helper 재유도):
 *   - plan.summary 가 재유도 summary 와 deep equal(집계 분포 count·byDifficulty·
 *     byContribution·totalVolume 일치).
 *   - plan.descriptor 가 재유도 descriptor 와 deep equal(title/marker/body 일치).
 *   - plan 의 두 필드 간 cross 정합(plan.descriptor 가 plan.summary 로부터 합성된 것과
 *     일관)은 재유도 축으로 자동 cover — 별도 cross 검증 불요(재유도 descriptor 는 재유도
 *     summary 로 합성되므로 cross drift 가 descriptor deep equal 단계에서 노출).
 *
 * 검사 순서(fail-fast): 구조(plan 객체 → plan.summary 객체 → plan.descriptor 객체 →
 * results 배열 → run 객체) → 재유도(2 위임 helper 호출 — descriptor layer throw 그대로
 * 전파) → summary deep equal → descriptor deep equal. 가장 먼저 어긋난 지점에서 throw.
 *
 * @param plan 종단 컴포저 산출 `RealDataResultReportPlan`. 변형하지 않는다.
 * @param results 재유도 source — `buildRealDataResultSummary(results)` 재호출에 사용.
 *   변형하지 않는다(읽기·전달만).
 * @param run 재유도 source — `buildRealDataResultIssueDescriptor(summary, run)` 재호출에
 *   사용. 변형하지 않는다(읽기·전달만).
 * @returns 정합이면 void.
 * @throws {TypeError} `plan` 비-객체 / `plan.summary` 비-객체 / `plan.descriptor`
 *   비-객체 / `results` 비-배열 / `run` 비-객체(구조·타입 결손).
 * @throws {RangeError} summary 집계 drift / descriptor title·marker·body drift(값 정합
 *   위반). 메시지에 어긋난 필드 / 기대값 / 실측값 포함. 또한 위임 helper(descriptor)의
 *   throw(예: run.gitSha 빈/공백)는 가드 자체 try/catch 없이 그대로 전파.
 */
export function assertRealDataResultReportPlanConsistentWithInputs(
  plan: RealDataResultReportPlan,
  results: EvaluationResult[],
  run: RealDataResultIssueRunRef,
): void {
  // (1) 구조 검증(TypeError 분기) — plan / plan.summary / plan.descriptor / results /
  // run. plan 객체부터 검사해야 .summary/.descriptor 접근이 안전하고, results/run 도
  // 재유도 호출 직전에 검사해 helper 에 비정상 입력을 넘기지 않는다.
  assertPlanStructure(plan);
  assertPlanSummaryStructure(plan.summary);
  assertPlanDescriptorStructure(plan.descriptor);
  assertResultsStructure(results);
  assertRunStructure(run);

  // (2) single-source 재유도 — 동일 2 위임 helper 를 재호출. descriptor layer 의
  // throw(run.gitSha/dateToken 빈/공백 → assertNonBlank throw)는 자체 try/catch 없이
  // 그대로 위로 전파한다(컴포저 throw 전파 정책과 동형 — 조용한 통과 차단).
  const expectedSummary = buildRealDataResultSummary(results);
  const expectedDescriptor = buildRealDataResultIssueDescriptor(
    expectedSummary,
    run,
  );

  // (3) summary deep equal — 집계 분포(count·byDifficulty·byContribution·totalVolume)
  // 정합. drift 면 RangeError 로 분류(값 정합 위반).
  if (!deepEqual(plan.summary, expectedSummary)) {
    throw new RangeError(
      `정합 위반: plan.summary 가 (results) 재유도 summary 와 다르다 — 기대=${JSON.stringify(
        expectedSummary,
      )}, 실측=${JSON.stringify(plan.summary)}. count / byDifficulty / byContribution / totalVolume 중 하나 이상이 어긋났다.`,
    );
  }

  // (4) descriptor deep equal — title/marker/body 정합. drift 면 RangeError.
  // summary↔descriptor cross 어긋남(plan.descriptor 가 plan.summary 가 아닌 다른
  // summary 로 합성된 듯)도 이 단계에서 자연 catch — 재유도 descriptor 는 재유도 summary
  // 로 합성되므로 cross drift 가 plan.descriptor 와 expectedDescriptor 사이 byte
  // 불일치로 노출된다.
  if (!deepEqual(plan.descriptor, expectedDescriptor)) {
    throw new RangeError(
      `정합 위반: plan.descriptor 가 (results, run) 재유도 descriptor 와 다르다 — 기대=${JSON.stringify(
        expectedDescriptor,
      )}, 실측=${JSON.stringify(plan.descriptor)}. title / marker / body 중 하나 이상이 어긋났다(summary↔descriptor cross 어긋남 포함).`,
    );
  }
}
