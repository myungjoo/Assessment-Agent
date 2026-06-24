// summary-batch-run — R-61 요약 평가 batch plan 순회 순수 async 실행 helper
// (PLAN.md P5 bullet 97 / REQ-061 "일/주/월 요약 평가"의 plan 순회 실행 半부).
// T-0613(`enumerateSummaryDueCoordinates`) → T-0614(`buildSummaryBatchPlan`,
// PR #528 squash 2926747) 로 pre-실행 plan 조립이, T-0615
// (`summarizeSummaryBatchOutcome`, PR #529 squash 3c7ca4f) 로 post-실행 outcome
// 집계가 모두 닫혔다. 그러나 그 둘 사이의 **plan 순회 실행 layer** — plan 의 각
// entry 에 대해 `evaluateAndPersist` 계열 함수를 순차 await 한 뒤 결과를 plan 과
// 같은 순서의 `outcomes[]` 로 모으는 부분 — 가 순수 단위 검증 가능한 형태로
// 외화되지 않았다. 본 helper 가 그 빈자리를 **evaluator callback 을 주입받는 순수
// async helper** `runSummaryBatchPlan(plan, evaluator, now)` 로 채운다.
//
// 부수효과 0 / 외부 의존 0 / `@Injectable` 0 / Prisma 0 / LLM 호출 0 / repository 0 /
// DB write 0 — 부수효과는 전적으로 주입된 evaluator 책임이고 helper 자체는 plan
// 등장 순서 보존 sequential await 결과 수집만 한다. 입력 `plan` 배열·원소 비변형
// (push/splice/sort 0), `now` 비변형(loop 동안 동일 `now` 를 그대로 evaluator 에
// 전달 — "한 batch fire 의 모든 좌표는 같은 판정 기준"). 동일 입력(같은 plan +
// 같은 결정적 evaluator + 같은 now) → 동일 출력 배열(깊은 값 동일성, evaluator
// 결정성 전제). raw 미저장(R-59) — helper 는 evaluator 반환값을 변형 없이 push 만.
//
// 책임 경계(task Out of Scope):
//   - orchestrator / service / controller 실배선(`@Injectable` + DI 로
//     `SummaryAggregateOrchestratorService.evaluateAndPersist` 를 bind 해 본
//     helper 의 evaluator 로 주입하는 batch orchestrator)은 별도 follow-up slice
//     (service-경계, DI). 본 helper 는 evaluator 주입 surface 만 박제.
//   - 좌표 → `EvaluationResult[]` 도출(collection bridge)은 cross-module/RBAC ADR
//     영역. 본 helper 의 입력 plan 은 caller 가 results 부착 완료된 것으로 전제
//     (T-0614 와 동형).
//   - 로깅 / 진척 콜백 / cancel signal(AbortController)은 본 helper 밖 — 순수 await
//     loop 만. 향후 별도 task.
//   - `Promise.all` / 병렬 실행 금지 — `evaluateAndPersist` 가 DB write 를 동반할
//     수 있어 결정적 write 순서·충돌 격리를 위해 순차 await 만(병렬은 별도 ADR 후속).
//
// 패턴 mirror: summary-batch-plan.ts / summary-batch-outcome.ts /
// evaluation-unevaluated-period-select.ts(순수 함수 / 입력 등장 순서 보존 / 입력
// 비변형 / null·undefined 입력 fail-fast 한국어 TypeError / 결정적 출력 순서 /
// 한국어 JSDoc). 실패 격리/전파 정책은 summary-aggregate-orchestrator.service.ts
// L22~26 / ADR-0032 §2 mirror — evaluator reject 시 swallow 0, 그 error 를 그대로
// 전파(부분 성공 결과 미반환).

import type { SummaryAggregateResult } from "../summary-aggregate-orchestrator.service";

import type { SummaryBatchPlanEntry } from "./summary-batch-plan";

// SummaryBatchEvaluator — plan 의 한 entry + 판정 기준 `now` 를 받아 그 좌표의
// 평가·영속화 결과(`SummaryAggregateResult`)를 Promise 로 반환하는 주입형 callback.
// caller(향후 orchestrator)는 `SummaryAggregateOrchestratorService.evaluateAndPersist`
// 를 partial application 으로 bind 해 전달하고, test 는 mock callback 을 전달한다.
// 시그니처를 `(entry, now) => Promise<SummaryAggregateResult>` 로 좁혀 한 entry →
// 정확히 한 result 의 index 1:1 정합을 type 으로 강제한다.
export type SummaryBatchEvaluator = (
  entry: SummaryBatchPlanEntry,
  now: Date,
) => Promise<SummaryAggregateResult>;

/**
 * R-61 요약 평가 batch plan 을 등장 순서대로 **순차 await** 실행해 plan 과 index
 * 1:1 정합한 `outcomes[]` 를 수집하는 순수 async helper(PLAN.md P5 bullet 97 /
 * REQ-061). 부수효과는 전적으로 주입된 `evaluator` 책임이고, 본 helper 는 순회
 * 순서·정합·실패 전파 계약만 박제한다.
 *
 * 순회 순서·정합 계약:
 *   - plan 등장 순서 그대로 sequential await(`for...of` index 보존). `Promise.all`
 *     **금지** — `evaluateAndPersist` 가 DB write 를 동반할 수 있어 결정적 write
 *     순서·충돌 격리를 위해 순차 실행한다.
 *   - 반환 `outcomes[]` 는 plan 과 정확히 동일 길이(index 1:1) — caller 가
 *     `summarizeSummaryBatchOutcome(plan, outcomes)` 에 그대로 spread 할 수 있다.
 *   - `now` 는 helper 가 그대로 evaluator 에 전달한다(loop 동안 동일 `now` 사용 —
 *     "한 batch fire 의 모든 좌표는 같은 판정 기준"을 보장, evaluator 내부 재계산 0).
 *
 * 실패 전파 계약(summary-aggregate-orchestrator.service.ts L22~26 / ADR-0032 §2
 * mirror):
 *   - `evaluator` 가 reject(또는 동기 throw)하면 그 error 를 **전파**한다(swallow 0
 *     — 실패 격리, 부분 성공을 fallback 으로 위장하지 않는다).
 *   - 중간(index N) reject 시 sequential await 가 즉시 중단되고, 이미 collect 한
 *     outcome 은 버려진다(부분 성공 결과 미반환). 이후 entry 의 evaluator 는 호출
 *     되지 않는다.
 *
 * 정책:
 *   - `plan` 이 빈 배열이면 빈 `outcomes` 반환(evaluator 호출 0, throw 0).
 *   - 입력 `plan` 배열·원소·`now` 모두 변형하지 않고 새 배열을 반환한다(부수효과 0).
 *   - 동일 입력(같은 plan + 같은 결정적 evaluator + 같은 now) → 동일 출력 배열
 *     (깊은 값 동일성, evaluator 결정성 전제). 매 호출 새 배열 반환(reference 0).
 *   - raw 미저장(R-59) — helper 는 evaluator 반환값을 변형 없이 push 만 한다.
 *
 * fail-fast 입력 검증(한국어 `TypeError`, T-0614/T-0615 관례 mirror) — 모든 가드는
 * sequential await 진입 **전**에 평가하므로 첫 reject 시 evaluator 호출 0:
 *   - `plan` 이 null/undefined → 한국어 `TypeError`.
 *   - `evaluator` 가 null/undefined/typeof !== `"function"` → 한국어 `TypeError`.
 *   - `now` 가 `Date` instance 가 아니면 → 한국어 `TypeError`.
 *
 * @param plan T-0614 `buildSummaryBatchPlan` 산출의 plan 배열(results 부착 완료
 *   전제). 변형하지 않는다. 빈 배열이면 evaluator 호출 0 으로 빈 배열 반환.
 *   null/undefined 시 한국어 `TypeError`.
 * @param evaluator 한 entry + `now` → `Promise<SummaryAggregateResult>` 주입 callback
 *   (caller 가 `evaluateAndPersist` 를 bind). null/undefined/비함수 시 한국어 `TypeError`.
 *   reject/throw 시 그 error 전파(swallow 0).
 * @param now 판정 기준 현재 시각 — loop 동안 동일 instance 를 evaluator 에 그대로
 *   전달(같은 batch fire 동일 기준). 변형하지 않는다. `Date` 가 아니면 한국어 `TypeError`.
 * @returns plan 등장 순서·길이를 index 1:1 보존한 `SummaryAggregateResult[]` 새 배열.
 * @throws {TypeError} `plan`/`evaluator`/`now` 가 계약 위반(null/undefined/타입 불일치)일 때.
 */
export async function runSummaryBatchPlan(
  plan: SummaryBatchPlanEntry[],
  evaluator: SummaryBatchEvaluator,
  now: Date,
): Promise<SummaryAggregateResult[]> {
  // (1) fail-fast 입력 검증 — 모두 sequential await 진입 전에 평가(첫 reject 시
  //     evaluator 호출 0 으로 검증). T-0614/T-0615 의 한국어 TypeError 관례 mirror.
  if (plan === null || plan === undefined) {
    throw new TypeError("plan 배열이 null/undefined 일 수 없다.");
  }
  if (
    evaluator === null ||
    evaluator === undefined ||
    typeof evaluator !== "function"
  ) {
    throw new TypeError("evaluator 는 함수여야 한다.");
  }
  if (!(now instanceof Date)) {
    throw new TypeError("now 는 Date 여야 한다.");
  }

  const outcomes: SummaryAggregateResult[] = [];
  // (2) plan 등장 순서를 결정적으로 보존하며 순차 await(Promise.all 금지 —
  //     결정적 write 순서·충돌 격리). reject/throw 는 await 가 즉시 전파하며
  //     loop 가 중단되고, 이미 collect 한 outcome 은 버려진다(부분 성공 미반환).
  for (const entry of plan) {
    // 같은 `now` 를 그대로 전달(한 batch fire 동일 판정 기준). 반환값은 변형
    // 없이 push 만(raw 미저장 / 깊은 값 보존).
    const outcome = await evaluator(entry, now);
    outcomes.push(outcome);
  }
  return outcomes;
}
