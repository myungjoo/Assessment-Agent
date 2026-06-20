// evaluation-unevaluated-fill-requests — 미평가 fill batch plan 을 per-좌표 평가 요청
// intent 배열로 평탄화하는 순수 도메인 함수
// (PLAN.md P5 bullet 106 / R-64 / REQ-037 "평가 없는 부분 일괄 평가" / REQ-038 의
// detection→consume 사슬을 *plan* 에서 *execute* 방향으로 한 칸 전진시키는 첫 순수 조각).
//
// 책임:
//   T-0547 까지 머지된 detection 사슬은 미평가 좌표를 person 별로 묶은 계획
//   `UnevaluatedFillBatchPlan`(person 묶음 + 묶음 내부 좌표 배열) 까지 산출한다. 그러나
//   실제 일괄 평가 실행은 per-좌표 평가 진입점(`PeriodBridgeDto`: personId/period/scope/
//   periodStart) 과 동형인 **per-좌표 요청 intent 의 1 차원 배열**을 소비한다. 본 helper 는
//   2 차원 batch plan 을 그 1 차원 요청 intent 배열로 평탄화(stable flatten)하며, periodStart
//   만 Date→offset-명시 ISO string 으로 변환한다(`formatKstIso` single-source 경유).
//
// 경계(task Out of Scope):
//   - orchestrator/bridge 실배선(요청 intent → fresh-collect → LLM 평가 → 영속)·controller
//     실행 route 는 후속 impure wiring slice. 본 함수는 순수 변환만.
//   - reeval/overwrite 축(ADR-0033/ADR-0038) baking 금지 — 요청 평탄화만(reevaluate 축
//     포함 안 함).
//   - dedup / 차집합 멤버십은 상류 T-0536 책임 — 같은 좌표가 plan 에 중복으로 들어오면
//     출력에도 중복 그대로 보존한다.
//
// 패턴 mirror: unevaluated-fill-plan-response.mapper.ts(formatKstIso single-source 경유
// Date→ISO string + null/undefined fail-fast + 비변형 map 패턴) +
// evaluation-unevaluated-fill-batch-plan.ts(방어적 입력 처리 — 한국어 메시지 `TypeError`
// 조기 노출 + 입력 비변형).

import { formatKstIso } from "../../common/period-boundary";

import type {
  UnevaluatedFillBatch,
  UnevaluatedFillBatchPlan,
} from "./evaluation-unevaluated-fill-batch-plan";

/**
 * per-좌표 평가 요청 intent — 미평가 fill batch plan 을 평탄화한 1 차원 요청 단위.
 *
 * per-좌표 평가 진입점 `PeriodBridgeDto`(personId/period/scope/periodStart) 와 동형인
 * shape 이되, class-validator decorator·@Injectable 0 의 순수 타입이다. 4 축 중 periodStart
 * 만 Date→offset-명시 ISO string 으로 변환되고, 나머지 3 축(personId/period/scope)은 도메인
 * 좌표에서 그대로 전사된다. reevaluate 축은 baking 하지 않는다(요청 평탄화만 — overwrite
 * 결합은 orchestration 책임).
 */
export interface UnevaluatedFillRequest {
  personId: string;
  period: string;
  scope: string;
  // formatKstIso 산출 offset-명시 ISO-8601 string(예 "2026-06-10T15:00:00+09:00").
  periodStart: string;
}

// assertBatchElement — person 묶음 원소 방어. null/undefined 묶음이면 한국어 메시지
// `TypeError` 로 조기 노출(silent skip 시 그 person 의 미평가 좌표가 통째로 평가 요청에서
// 누락되어 평가 누락을 유발 — fail-fast 가 안전). `periods` 가 배열이 아니면(null/undefined·
// non-array) 마찬가지로 조기 노출한다.
function assertBatchElement(batch: UnevaluatedFillBatch, index: number): void {
  if (batch === null || batch === undefined) {
    throw new TypeError(
      `batches[${index}] person 묶음이 null/undefined 일 수 없다.`,
    );
  }
  if (!Array.isArray(batch.periods)) {
    throw new TypeError(
      `batches[${index}].periods 는 배열이어야 한다: ${String(batch.periods)}`,
    );
  }
}

/**
 * 미평가 fill batch plan(2 차원 person 묶음) → per-좌표 평가 요청 intent 의 1 차원 배열
 * 평탄화(PLAN.md P5 bullet 106 / R-64 / REQ-037 detection→consume 사슬의 plan→execute
 * 전진 조각).
 *
 * 평탄화 정책:
 *   - **person 묶음 순서 보존** — `plan.batches` 의 순서(person 최초 등장 순서) 그대로 순회.
 *   - **묶음 내부 좌표 순서 보존** — 각 묶음의 `periods`(gap 입력 등장 순서) 그대로 순회.
 *     두 순서를 합쳐 stable flatten — 재정렬 0.
 *   - **dedup 안 함** — 같은 좌표가 plan 에 중복으로 들어와 있으면 출력에도 중복 그대로
 *     보존(차집합 멤버십은 상류 T-0536 책임).
 *   - **빈 plan** — `batches` 가 빈 배열이면 빈 요청 배열 반환(결정적).
 *
 * 축 변환:
 *   - personId / period / scope : 그대로 전사(passthrough).
 *   - periodStart : `formatKstIso` single-source helper 경유로 Date→offset-명시 ISO string
 *     변환(raw `.toISOString()` 금지). round-trip(parseKstPeriodInput) 시 원 instant 보존.
 *
 * periodStart 가 Invalid Date / 비-Date 면 `formatKstIso` 의 `TypeError` 가 **자연 전파**
 * 된다 — helper 가 재던지지 않아 single-source error 메시지를 보존한다.
 *
 * 비변형:
 *   - 입력 `plan`·`batches`·`periods` 배열·좌표 객체 모두 mutate 0 — 반환은 새 배열/새 객체.
 *   - 좌표 객체를 mutate 하지 않으며 새 `UnevaluatedFillRequest` 객체를 생성해 반환한다.
 *
 * @param plan 미평가 fill batch plan. 변형하지 않는다. null/undefined 시 한국어 메시지
 *   `TypeError`(unevaluated-fill-plan-response.mapper.ts 방어 패턴 mirror).
 * @returns per-좌표 평가 요청 intent 배열. 길이 === `plan.totalGapCount`(불변식 —
 *   dedup 안 하므로 입력 gap 총수와 정확히 같다).
 * @throws {TypeError} `plan` 이 null/undefined 이거나, person 묶음 원소가 null/undefined
 *   이거나, 묶음의 `periods` 가 배열이 아니거나, 한 좌표의 periodStart 가 Invalid Date /
 *   비-Date 일 때(후자는 `formatKstIso` 자연 전파).
 */
export function buildUnevaluatedFillRequests(
  plan: UnevaluatedFillBatchPlan,
): UnevaluatedFillRequest[] {
  // plan 자체 방어 — null/undefined 면 한국어 메시지 TypeError 로 fail-fast(silent 진행
  // 시 속성 접근에서 opaque TypeError 가 나므로, 명시적 메시지로 조기 노출).
  if (plan === null || plan === undefined) {
    throw new TypeError(
      "buildUnevaluatedFillRequests: plan 이 null/undefined 일 수 없다.",
    );
  }
  // batches 가 배열이 아니면(null/undefined·non-array) 조기 노출 — 아래 forEach 가
  // opaque TypeError 를 던지기 전에 명시적 메시지로.
  if (!Array.isArray(plan.batches)) {
    throw new TypeError(
      `buildUnevaluatedFillRequests: plan.batches 는 배열이어야 한다: ${String(
        plan.batches,
      )}`,
    );
  }

  // 새 1 차원 배열로 누적 — 입력 plan/batches/periods 비변형(반환은 새 인스턴스).
  const requests: UnevaluatedFillRequest[] = [];

  plan.batches.forEach((batch, batchIndex) => {
    assertBatchElement(batch, batchIndex);
    batch.periods.forEach((coord, coordIndex) => {
      // 좌표 원소 방어 — null/undefined 면 한국어 메시지 TypeError 로 조기 노출(silent skip
      // 시 그 좌표의 평가 요청이 누락되어 평가 누락 — fail-fast 가 안전).
      if (coord === null || coord === undefined) {
        throw new TypeError(
          `batches[${batchIndex}].periods[${coordIndex}] 좌표 원소가 null/undefined 일 수 없다.`,
        );
      }
      // 새 요청 객체 생성 — 좌표 객체를 mutate 하지 않는다. periodStart 만 single-source
      // helper 경유로 Date→offset-명시 ISO string 변환(Invalid Date / 비-Date 시 formatKstIso
      // 의 TypeError 자연 전파).
      requests.push({
        personId: coord.personId,
        period: coord.period,
        scope: coord.scope,
        periodStart: formatKstIso(coord.periodStart),
      });
    });
  });

  return requests;
}
