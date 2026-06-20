// unevaluated-fill-run-response.compose — P5 bullet 106(R-64 / REQ-037 "평가 없는
// 부분 일괄 평가" / REQ-038) plan→execute 사슬의 **출력-side compose 조각**. 출력-side
// 2 순수 조각 — T-0552 `aggregateUnevaluatedFillRunResult`(per-좌표 실행 outcome 배열
// → batch-run 요약 도메인 shape `UnevaluatedFillRunResult` 로 결정적 집계) + T-0553
// `toUnevaluatedFillRunResponse`(도메인 요약 → controller-facing 안정 HTTP 응답 shape
// `UnevaluatedFillRunResponse` 로 직렬화) — 를 **1 deterministic compose step 으로** 잇는
// dependency-free 순수 helper 다. 입력-side T-0554 `composeUnevaluatedFillBridgeRequests`
// (3 조각 compose)의 **출력-side 대칭 짝**이자, detection 사슬 T-0540 `composeUnevaluatedFillPlan`
// (4 조각 compose)의 출력-side 실행 동형이다.
//
// 책임(출력-side 조립의 순수 완결):
//   raw per-좌표 outcome 배열을 받아 `aggregateUnevaluatedFillRunResult` → `toUnevaluatedFillRunResponse`
//   를 이 순서로 흘려보내 controller-facing 응답 shape `UnevaluatedFillRunResponse` 1 개를
//   반환한다. compose-only — 중간 가공/필터/정렬/집계 재계산/직렬화 변형 추가 0 으로 각
//   조각의 결정성·순서·status-aware 집계·passthrough 직렬화 정책을 그대로 보존한다.
//   조립 순서(집계 → 직렬화)를 single source 로 박제해, 향후 impure orchestrator 가 순서를
//   재구현(누락·오순서 risk)하는 대신 본 helper 1 회 호출만으로 raw outcome → HTTP 응답을 닫는다.
//
// 경계(task Out of Scope):
//   - 2 조각 로직(status 별 count / totalEvaluatedRecords 집계 / passthrough 직렬화) 재구현·
//     수정·역삽입 0 — 각 조각의 책임으로 분리 유지. 본 helper 는 호출 순서대로 엮을 뿐.
//   - 본 helper 는 **outcome 을 만들지 않는다** — orchestrator 실배선(중복 제거된
//     `PeriodBridgeDto[]` → per-좌표 fresh-collect → LLM 평가 → 영속 → outcome 산출)은
//     impure wiring 책임(live-LLM standing 게이트 ADR-0045 에 묶여 deferred). 본 helper 는
//     **이미 산출된 outcome 의 집계+직렬화 합성만**.
//   - controller 실행 route(POST .../unevaluated-fill-run) / RBAC / LLM 네트워크 호출 0 —
//     후속 impure slice 책임.
//   - 중간 결과(`UnevaluatedFillRunResult`) 외부 노출 0 — internal. 본 helper 는 최종 응답
//     shape `UnevaluatedFillRunResponse` 만 반환한다.
//   - `EvaluationResult` 타입 직접 import / 평가문 본문·narrative 보유 0(REQ-032 raw-not-stored 정합).
//   - class-validator 런타임 validate 호출 0 — controller-scope ValidationPipe 책임. plain 객체만 다룬다.
//
// 패턴 mirror: evaluation-unevaluated-fill-plan.ts(T-0540 compose-only) — 조각 호출 순서
// 박제 + 중간 가공 0 + 조각 내부 방어 자연 전파(재던지지 않음) + @Injectable 0 + NestJS/
// Prisma/LLM import 0. 본 helper 의 입력은 wrapper 가 아니라 outcome 배열 1 개라 wrapper
// 타입 신설 0 — 입력·반환·중간 타입은 전부 2 조각 파일에서 `import type` 재사용한다(발명 0).
// 순수성: 부수효과 0, 입력 비변형(첫 조각이 새 배열 slice, 둘째 조각이 새 배열 map 이라
// 자연 보존 — 본 helper 가 입력·중간 배열을 mutate 하지 않음), 새 외부 dependency 0.
//
// fail-fast 정책(택1 고정 — **조각 전파에 위임**):
//   본 helper 는 별도 wrapper 방어를 두지 않고 **첫 조각 `aggregateUnevaluatedFillRunResult`
//   의 방어에 전적으로 위임**한다(single-source 방어 — 재던지지 않는다). 따라서 outcomes 가
//   null/undefined·non-array, 원소 null/undefined, 비-union status, 잘못된 evaluatedCount 등
//   모든 outcome 내부 구조 오류는 첫 조각의 한국어 `TypeError`(메시지 prefix
//   `aggregateUnevaluatedFillRunResult:`, 인덱스 포함)로 그대로 자연 전파된다. 이 전파 prefix
//   는 합성 순서(집계가 직렬화보다 먼저 호출됨)의 회귀를 spec 이 잡는 단서가 된다.

import { toUnevaluatedFillRunResponse } from "./unevaluated-fill-run-response.mapper";
import type { UnevaluatedFillRunResponse } from "./unevaluated-fill-run-response.mapper";
import { aggregateUnevaluatedFillRunResult } from "./unevaluated-fill-run-result";
import type { UnevaluatedFillRunOutcome } from "./unevaluated-fill-run-result";

/**
 * per-좌표 미평가 fill 실행 outcome 배열을 controller-facing 응답 shape 으로 결정적으로
 * compose 하는 순수 함수(P5 bullet 106 / R-64 / REQ-037 detection→consume 사슬의 출력-side
 * 조립 완결 조각). 입력-side T-0554 `composeUnevaluatedFillBridgeRequests` 의 출력-side 대칭.
 *
 * 2 개 순수 조각을 다음 순서로 그대로 흘려보내며 잇는다(compose-only — 중간 가공/필터/
 * 정렬/집계 재계산/직렬화 변형 추가 0, 각 조각의 결정성·순서·집계·직렬화 정책을 그대로 보존):
 *   (1) `aggregateUnevaluatedFillRunResult(outcomes)` → batch-run 요약 도메인 shape
 *       `UnevaluatedFillRunResult`(status 별 count + totalEvaluatedRecords status-aware 합).
 *   (2) `toUnevaluatedFillRunResponse(result)`        → controller-facing 응답 shape
 *       `UnevaluatedFillRunResponse`(집계 필드 passthrough 전사 + outcomes 새-배열 map).
 *   첫 조각 결과(`UnevaluatedFillRunResult`)를 **그대로** 둘째 조각에 넘긴다(재정렬/필터/
 *   집계 재계산/직렬화 변형 0). 중간 결과는 internal — 외부로 노출하지 않는다.
 *
 * 방어(조각 전파 위임 — single-source):
 *   본 helper 는 별도 wrapper 방어를 두지 않는다. `outcomes` 가 null/undefined·non-array,
 *   원소 null/undefined, 비-union status, 음수/비정수 evaluatedCount 등 모든 구조 오류는
 *   **첫 조각 `aggregateUnevaluatedFillRunResult` 의 한국어 `TypeError`**(메시지 prefix
 *   `aggregateUnevaluatedFillRunResult:`, 인덱스 포함)로 그대로 자연 전파된다(재던지지 않음).
 *   집계가 직렬화보다 먼저 호출되므로 전파 메시지 prefix 가 합성 순서의 회귀 단서가 된다.
 *
 * 정책(결정성 + 비변형):
 *   - 입력 `outcomes` 배열·각 원소 객체를 mutate 하지 않는다(첫 조각이 새 배열 slice,
 *     둘째 조각이 새 배열 map 이라 자연 보존 — 본 helper 가 입력·중간 배열을 변형하지 않음).
 *   - 같은 입력이면 같은 출력(시계 비의존 — 두 조각이 이미 시계 비의존).
 *   - 반환 outcomes 는 입력과 별개의 새 배열(둘째 조각 map 결과)이다.
 *
 * @param outcomes per-좌표 실행 outcome 배열. 변형하지 않는다. null/undefined·non-array·
 *   원소 null/undefined·비-union status·잘못된 evaluatedCount 시 첫 조각의 한국어 `TypeError`.
 * @returns `UnevaluatedFillRunResponse` — 새 객체. outcomes 는 입력 순서를 보존한 새 배열.
 * @throws {TypeError} 첫 조각 `aggregateUnevaluatedFillRunResult` 의 방어 조건 위반 시
 *   (메시지에 prefix·인덱스 포함). 본 helper 자체는 별도 방어를 던지지 않는다(조각 전파).
 */
export function composeUnevaluatedFillRunResponse(
  outcomes: UnevaluatedFillRunOutcome[],
): UnevaluatedFillRunResponse {
  // (1) per-좌표 outcome 배열 → batch-run 요약 도메인 shape 집계. outcomes 의 모든 구조
  //     방어(null/undefined·non-array·원소·status·evaluatedCount)는 이 조각이 한국어
  //     TypeError(인덱스 포함)로 자연 전파한다 — 본 helper 는 별도 wrapper 방어를 두지 않는다.
  const result = aggregateUnevaluatedFillRunResult(outcomes);
  // (2) 도메인 요약 → controller-facing 응답 shape 직렬화. 첫 조각 결과를 그대로 넘긴다
  //     (중간 가공 0). outcomes 는 둘째 조각이 새 배열로 map 해 비변형·순서 보존한다.
  return toUnevaluatedFillRunResponse(result);
}
