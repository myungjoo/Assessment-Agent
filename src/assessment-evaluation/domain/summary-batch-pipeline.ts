// summary-batch-pipeline — R-61 요약 평가 batch end-to-end 순수 async pipeline
// composer (PLAN.md P5 bullet 97 / REQ-061 "일/주/월 요약 평가"의 조립 半부).
// p5-summary-aggregate stream 의 3 caller-facing 순수 조각이 모두 닫혔다:
//   - T-0614 `buildSummaryBatchPlan`(PR #528 squash 2926747) — 좌표 × results map
//     → plan tuple 조립.
//   - T-0616 `runSummaryBatchPlan`(PR #530 squash 4f0343a) — plan 순회 sequential
//     await → outcomes 수집.
//   - T-0615 `summarizeSummaryBatchOutcome`(PR #529 squash 3c7ca4f) — plan ×
//     outcomes → 결정적 outcome 리포트.
// 그러나 caller 가 이 plan → run → outcome 3 단계를 매번 손으로 엮어야 한다 — 특히
// 마지막 단계가 plan 과 outcomes 를 *둘 다* 같은 index 정합으로 받아야 하므로
// (T-0615 길이 정합 fail-fast 계약), caller 가 단일 plan 인스턴스를 1·2·3 단계에
// 잃지 않고 thread 해야 하는 미묘한 정합 책임이 caller 에 흩어진다. 본 pipeline 이
// 그 3 단계 엮음을 **evaluator callback 을 주입받는 단일 순수 async pipeline**
// `runSummaryBatchPipeline(input)` 로 외화한다 — caller 의 plan↔outcomes 정합 누수가
// 단일 plan 인스턴스로 원천 차단된다.
//
// 부수효과 0 / 외부 의존 0 / `@Injectable` 0 / Prisma 0 / LLM 호출 0 / repository 0 /
// DB write 0 — 부수효과는 전적으로 주입된 evaluator 책임이고, pipeline 은 3 순수
// 조각의 결정적 조합 + 동일 plan/now thread 만 한다. 입력 `coordinates` 배열·
// `resultsByCoordinate` map·원소·`now` 비변형(하위 조각의 비변형 계약 상속). 동일
// 입력(같은 coordinates/map/mode/options + 같은 결정적 evaluator + 같은 now) →
// 동일 출력(깊은 값 동일성, evaluator 결정성 전제). raw 미저장(R-59) — pipeline 은
// 하위 조각 산출을 변형 없이 묶기만 한다. 새 외부 dependency 0.
//
// 책임 경계(task Out of Scope):
//   - orchestrator/service/controller 실배선(`@Injectable` + DI 로
//     `SummaryAggregateOrchestratorService.evaluateAndPersist` 를 bind 해 본
//     pipeline 의 evaluator 로 주입하는 batch orchestrator)은 별도 follow-up slice
//     (service-경계, DI). 본 pipeline 은 evaluator 주입 surface 까지만.
//   - 좌표 enumerate(`enumerateSummaryDueCoordinates`, T-0613) 흡수 금지 —
//     coordinates 는 caller 가 미리 enumerate 해 넘기는 입력(roster/granularity
//     source 도출이 caller/orchestrator 책임). 본 pipeline 은 plan→run→outcome
//     3 단계 조립만.
//   - 좌표 → `EvaluationResult[]` 도출(collection bridge)은 cross-module/RBAC ADR
//     영역. 본 pipeline 은 caller 가 results map 을 이미 안다고 전제(T-0614 동형).
//   - 로깅 / 진척 콜백 / cancel signal / `Promise.all` 병렬 실행 금지 — (2)
//     `runSummaryBatchPlan` 의 순차 await 계약을 그대로 상속(병렬은 별도 ADR 후속).
//   - mode/options 결정 로직(PersistMode 선택 / narrative modelId 결정)은 caller
//     책임. 본 pipeline 은 caller 가 넘긴 mode/options 를 (1) 단계에 그대로 전달만.
//
// 패턴 mirror: summary-batch-plan.ts / summary-batch-run.ts / summary-batch-outcome.ts
// (순수 함수 / 입력 등장 순서 보존 / 입력 비변형 / null·undefined 입력 fail-fast
// 한국어 TypeError / 결정적 출력 / 한국어 JSDoc). 실패 전파 정책은 runSummaryBatchPlan
// (T-0616) / ADR-0032 §2 mirror — evaluator reject 시 swallow 0, 그 error 를 그대로
// 전파(중간 reject 시 outcome 집계 미실행 — 부분 성공 리포트 위장 0).

import type { PersistMode } from "../evaluation-result-persist.service";
import type { SummaryAggregateResult } from "../summary-aggregate-orchestrator.service";
import type { SummaryPersistOptions } from "../summary-persist.service";

import type { EvaluationResult } from "./evaluation-result";
import {
  summarizeSummaryBatchOutcome,
  type SummaryBatchOutcomeReport,
} from "./summary-batch-outcome";
import { assertSummaryBatchOutcomeConsistent } from "./summary-batch-outcome-consistency";
import {
  buildSummaryBatchPlan,
  type SummaryBatchPlanEntry,
} from "./summary-batch-plan";
import {
  runSummaryBatchPlan,
  type SummaryBatchEvaluator,
} from "./summary-batch-run";
import type { SummaryDueCoordinate } from "./summary-due-coordinates";

// SummaryBatchEvaluator 를 re-export 한다 — caller 가 pipeline 모듈 하나만 import
// 해도 evaluator 타입을 함께 얻을 수 있다(새 타입 발명 0, T-0616 타입 그대로 재사용).
export type { SummaryBatchEvaluator } from "./summary-batch-run";

// SummaryBatchPipelineInput — pipeline 의 단일 입력 객체. 6 인자를 객체로 묶어
// 인자 순서 혼동(positional 6-arg 의 mode/options/now 뒤섞임)을 구조적으로 차단한다.
// 각 필드는 하위 조각의 입력 surface 를 그대로 mirror 한다(새 surface 발명 0).
export interface SummaryBatchPipelineInput {
  // (1) buildSummaryBatchPlan 의 좌표 입력(`enumerateSummaryDueCoordinates` 산출).
  coordinates: SummaryDueCoordinate[];
  // (1) 좌표 key → 단위 평가 묶음 look-up map. key 부재 시 빈 배열 부착(T-0614 계약).
  resultsByCoordinate: Map<string, EvaluationResult[]>;
  // (1) 공통 영속화 모드 — 좌표마다 동일 부착(caller 가 선택, pipeline 은 전달만).
  mode: PersistMode;
  // (1) 공통 narrative 옵션(modelId) — 좌표마다 동일 부착.
  options: SummaryPersistOptions;
  // (2) runSummaryBatchPlan 에 주입할 한 entry + now → result 평가 callback.
  //     caller 가 `evaluateAndPersist` 를 bind, test 는 mock 을 전달.
  evaluator: SummaryBatchEvaluator;
  // (2) 판정 기준 현재 시각 — pipeline 전체가 동일 instance 를 evaluator 에 전달
  //     (같은 batch fire 동일 판정 기준 — T-0616 계약 상속).
  now: Date;
}

// SummaryBatchPipelineResult — pipeline 의 3 산출. caller 가 report 만 아니라
// plan/outcomes 까지 필요로 할 수 있어(예: 재시도 / 진척 로깅) 모두 노출한다.
export interface SummaryBatchPipelineResult {
  // (1) buildSummaryBatchPlan 산출 — 좌표 순서 보존 plan 배열.
  plan: SummaryBatchPlanEntry[];
  // (2) runSummaryBatchPlan 산출 — plan 과 index 1:1 정합한 outcomes 배열.
  outcomes: SummaryAggregateResult[];
  // (3) summarizeSummaryBatchOutcome 산출 — 결정적 batch outcome 리포트.
  report: SummaryBatchOutcomeReport;
}

/**
 * R-61 요약 평가 batch 를 좌표 + results map + mode/options + evaluator + now 입력
 * 하나로 plan → run → outcome 3 단계를 한 흐름으로 조립하는 순수 async pipeline
 * (PLAN.md P5 bullet 97 / REQ-061). caller 는 좌표/map/mode/options/evaluator/now 만
 * 넘기면 `{ plan, outcomes, report }` 3 산출을 한 번에 결정적으로 받는다.
 *
 * 3 단계 조립 계약(index 정합을 단일 plan 인스턴스로 구조적으로 보장):
 *   1. `plan = buildSummaryBatchPlan(coordinates, resultsByCoordinate, mode, options)`
 *      — 좌표 × results map join. 좌표 순서 보존.
 *   2. `outcomes = await runSummaryBatchPlan(plan, evaluator, now)` — **(1) 의 동일
 *      plan 인스턴스**를 2 단계에 thread(plan 재생성·재정렬 0). `now` 도 동일 instance
 *      를 evaluator 에 그대로 전달(같은 batch fire 동일 판정 기준).
 *   3. `report = summarizeSummaryBatchOutcome(plan, outcomes)` — **(1)·(2) 와 동일
 *      plan 인스턴스 + (2) 의 outcomes** 를 함께 넘긴다. plan↔outcomes index 1:1 정합이
 *      pipeline 내부 단일 plan 으로 구조적으로 보장되므로(caller 정합 누수 차단),
 *      (3) 의 길이 정합 fail-fast 가 정상 흐름에서 트리거되지 않는다.
 *   4. `assertSummaryBatchOutcomeConsistent(report)` — report 산출 **직후** · 반환 전에
 *      불변식 단언(손상 report 누출 차단, 정상 경로 무회귀). 단일 plan thread 가 정합을
 *      구조적으로 보장하므로 정상 경로에서는 void 반환(방어적 단언·회귀 보호)이며,
 *      불변식 위반·구조 결손 시 그 error 를 그대로 전파(자동 복구 0 — fail-fast).
 *
 * 실패 전파 계약 상속(runSummaryBatchPlan / ADR-0032 §2 mirror):
 *   - (2) `runSummaryBatchPlan` 이 evaluator reject/throw 를 전파하면 본 pipeline 도
 *     그 error 를 **그대로 전파**(swallow 0). 중간 reject 시 (3) outcome 집계는
 *     실행되지 않는다(부분 성공 리포트 위장 0 — await 가 즉시 전파하며 (3) 미도달).
 *   - (1) `buildSummaryBatchPlan` 의 좌표 무결성 TypeError(좌표 원소 누락/타입 불일치)
 *     도 그대로 전파(좌표 단계에서 fail-fast). 이 경우 evaluator 호출 0.
 *
 * fail-fast 입력 검증(한국어 `TypeError`, T-0614/T-0615/T-0616 관례 mirror) — (1)
 * 단계 진입 **전**에 평가:
 *   - `input` 자체가 null/undefined → 한국어 `TypeError`(pipeline 이 직접 가드).
 *   - `input.coordinates` / `input.resultsByCoordinate` / `input.evaluator` /
 *     `input.now` 의 null/undefined·타입 불일치는 **하위 조각의 기존 가드에 위임**
 *     한다(이중 검증 발명 0). buildSummaryBatchPlan 이 coordinates/resultsByCoordinate
 *     를, runSummaryBatchPlan 이 evaluator/now 를 검증하며, 그 위임된 TypeError 가
 *     pipeline 밖으로 그대로 전파된다.
 *
 * 정책:
 *   - `coordinates` 가 빈 배열이면 빈 plan/outcomes + 전 카운트 0 리포트 반환
 *     (evaluator 호출 0, throw 0).
 *   - 입력 배열·map·원소·`now` 모두 변형하지 않고 새 산출을 반환한다(부수효과 0 —
 *     하위 조각의 비변형 계약 상속). 매 호출 새 plan/outcomes/report 객체 반환.
 *   - 동일 입력(같은 입력 + 같은 결정적 evaluator + 같은 now) → 동일 출력(깊은 값
 *     동일성, evaluator 결정성 전제). reference 동일성은 아니다.
 *   - raw 미저장(R-59) — pipeline 은 하위 조각 산출을 변형 없이 묶기만 한다.
 *
 * @param input pipeline 의 6 입력을 묶은 단일 객체(coordinates / resultsByCoordinate /
 *   mode / options / evaluator / now). null/undefined 시 한국어 `TypeError`. 개별
 *   필드 무결성은 하위 조각 가드에 위임(JSDoc single source).
 * @returns `{ plan, outcomes, report }` 3 산출(매 호출 새 객체). evaluator reject 시
 *   그 error 를 그대로 reject 전파(부분 결과 미반환).
 * @throws {TypeError} `input` 이 null/undefined 일 때(직접 가드), 또는 하위 조각이
 *   좌표/map/evaluator/now 무결성 위반으로 던진 TypeError 전파(위임). report 산출 후
 *   `assertSummaryBatchOutcomeConsistent` 가 report 구조 결손으로 던진 TypeError 도 전파.
 * @throws {RangeError} report 산출 후 `assertSummaryBatchOutcomeConsistent` 가 outcome
 *   불변식(평가+skip=total / 생성+기존=평가 / 버킷합=전역) 위반을 감지하면 그 RangeError 를
 *   그대로 전파(정상 경로에서는 단일 plan thread 정합 보장으로 미발생).
 */
export async function runSummaryBatchPipeline(
  input: SummaryBatchPipelineInput,
): Promise<SummaryBatchPipelineResult> {
  // (0) input 자체의 null/undefined 만 pipeline 이 직접 가드한다 — 개별 필드 무결성은
  //     하위 조각(buildSummaryBatchPlan / runSummaryBatchPlan)의 기존 가드에 위임
  //     (이중 검증 발명 0). input 이 nullish 면 destructure 가 TypeError 를 던지나,
  //     한국어 메시지로 명시 가드해 진단 가능성을 확보한다.
  if (input === null || input === undefined) {
    throw new TypeError("input 이 null/undefined 일 수 없다.");
  }

  const { coordinates, resultsByCoordinate, mode, options, evaluator, now } =
    input;

  // (1) 좌표 × results map join → plan. coordinates/resultsByCoordinate 무결성
  //     TypeError 는 여기서 전파(좌표 단계 fail-fast, evaluator 호출 0).
  const plan = buildSummaryBatchPlan(
    coordinates,
    resultsByCoordinate,
    mode,
    options,
  );

  // (2) (1) 의 **동일 plan 인스턴스**를 thread 해 sequential await 실행. evaluator/now
  //     무결성 TypeError 또는 evaluator reject 는 await 가 즉시 전파하며 (3) 미도달
  //     (부분 성공 리포트 위장 0). now 는 동일 instance 를 evaluator 에 그대로 전달.
  const outcomes = await runSummaryBatchPlan(plan, evaluator, now);

  // (3) (1)·(2) 와 **동일 plan 인스턴스 + (2) outcomes** 를 함께 집계. 단일 plan
  //     thread 로 plan↔outcomes 길이 1:1 정합이 구조적으로 보장된다(정합 누수 0).
  const report = summarizeSummaryBatchOutcome(plan, outcomes);

  // (4) report 산출 **직후** · 반환 전에 불변식 가드를 단언 지점으로 호출한다 —
  //     손상 report(미래 merge/diff 헬퍼 버그·수동 조립 오류)가 caller·로그·
  //     notification·관측 surface 로 누출되기 전에 fail-fast 로 차단한다. pipeline 의
  //     단일 plan thread 가 plan↔outcomes 정합을 구조적으로 보장하므로 정상 경로에서는
  //     void(무회귀) 반환하며 흐름이 그대로 return 으로 이어진다(방어적 단언·회귀
  //     보호). 가드가 throw 하면(불변식 위반 RangeError / 구조 결손 TypeError) 그
  //     error 를 swallow 0 으로 그대로 전파한다(자동 복구·정규화 0 — fail-fast).
  assertSummaryBatchOutcomeConsistent(report);

  return { plan, outcomes, report };
}
