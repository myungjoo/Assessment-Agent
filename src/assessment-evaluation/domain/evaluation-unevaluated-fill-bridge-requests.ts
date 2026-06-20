// evaluation-unevaluated-fill-bridge-requests — 미평가 fill batch plan 을 중복 제거된
// per-좌표 bridge 요청 배열 `PeriodBridgeDto[]` 로 잇는 순수 compose helper
// (PLAN.md P5 bullet 106 / R-64 / REQ-037 "평가 없는 부분 일괄 평가" / REQ-038 의
// detection→consume 사슬을 plan→execute *입력-side* 에서 1 deterministic step 으로 닫는
// 조립 조각). 부수효과 0 / 외부 의존 0 / `@Injectable` 0 / Prisma 0 / LLM 호출 0 /
// repository 0 / class-validator 런타임 호출 0 / 입력 객체·배열 비변형. `import` 는 도메인·
// dto 내 3 조각 함수와 입력·반환 타입만(재구현 0, 새 타입 발명 0).
//
// 책임(REQ-037 plan→execute 입력-side 조립 완결):
//   plan→execute 입력-side 는 이미 3 개 순수 조각으로 닫혀 있다 —
//     (1) buildUnevaluatedFillRequests  → batch plan 을 per-좌표 요청 intent
//                                          `UnevaluatedFillRequest[]` 로 평탄화(T-0549).
//     (2) toPeriodBridgeRequests        → intent[] → 기존 per-좌표 실행 진입점
//                                          `PeriodBridgeDto[]` 로 1:1 매핑(T-0550).
//     (3) dedupePeriodBridgeRequests    → 좌표 4-tuple 중복 first-wins 제거(T-0551).
//   그러나 이 3 조각은 개별 함수일 뿐이라, 호출자(향후 impure orchestrator)가
//   `UnevaluatedFillBatchPlan` 하나로부터 "일괄 평가에 흘릴 깨끗한 좌표 배열" 을 얻으려면
//   매번 세 함수를 정확한 순서로 엮어야 한다(누락·오순서 risk). 본 helper 는 그 조립
//   순서를 single source 로 박제해 plan→execute 입력 단계를 1 회 호출로 닫는다 —
//   detection 사슬의 T-0540 `composeUnevaluatedFillPlan`(enumerate/project/select/batch-plan
//   4 조각을 1 compose 로 잇던 순수 helper)의 입력-side 실행 대칭 짝이다.
//
//   compose-only — 중간 가공/재정렬/필터/추가 dedup/좌표 변형 0 으로 각 조각의 결정성·
//   순서 정책(평탄화 순서 · 1:1 매핑 · first-wins dedup)을 그대로 합성한다.
//
// 경계(task Out of Scope):
//   - orchestrator 실배선(중복 제거된 `PeriodBridgeDto[]` → per-좌표 fresh-collect → LLM
//     평가 → 영속 → outcome 산출 → 집계)·controller 실행 route(POST .../unevaluated-fill-run)
//     신설·RBAC 결정 — 후속 impure wiring slice. 본 함수는 입력 좌표 배열 산출까지만.
//   - LLM 네트워크 호출·live-LLM 검증(standing 게이트 / ADR-0045, 만료 2026-06-30 수동) —
//     건드리지 않음.
//   - 3 조각 로직 재구현·수정·역삽입 0 — 각 조각은 자기 책임으로 분리 유지. 본 helper 는
//     호출 순서대로 엮을 뿐.
//   - 중간 결과(intent[] / pre-dedup bridge[]) 외부 노출·반환 0 — 최종 중복 제거된
//     `PeriodBridgeDto[]` 만 반환(중간 단계는 internal).
//
// 패턴 mirror: evaluation-unevaluated-fill-plan.ts(T-0540 compose-only — wrapper level
// 1 차 fail-fast + 조각 호출 순서 박제 + 중간 가공 0 + 조각 내부 방어 자연 전파 +
// @Injectable 0 + NestJS/Prisma/LLM import 0). 본 helper 는 그 입력-side 실행 대칭.
//
// 순수성: `@Injectable` 0, NestJS/Prisma/LLM/class-validator 런타임 호출·repository
// import 0 — 3 helper 와 `UnevaluatedFillBatchPlan`/`PeriodBridgeDto` 타입만 import. 새
// 외부 dependency 0.

import { dedupePeriodBridgeRequests } from "../dto/dedupe-period-bridge-requests";
import { toPeriodBridgeRequests } from "../dto/fill-requests-to-bridge.mapper";
import type { PeriodBridgeDto } from "../dto/period-bridge.dto";

import type { UnevaluatedFillBatchPlan } from "./evaluation-unevaluated-fill-batch-plan";
import { buildUnevaluatedFillRequests } from "./evaluation-unevaluated-fill-requests";

/**
 * 미평가 fill batch plan 을 중복 제거된 per-좌표 bridge 요청 배열로 결정적으로 compose
 * 한다(PLAN.md P5 bullet 106 / R-64 / REQ-037 detection→consume 사슬의 plan→execute
 * 입력-side 완결 조각).
 *
 * 3 개 순수 조각을 다음 순서로 그대로 흘려보내며 잇는다(compose-only — 중간 가공/재정렬/
 * 필터/추가 dedup/좌표 변형 0, 각 조각의 결정성·순서 정책을 그대로 보존):
 *   (1) `buildUnevaluatedFillRequests(plan)`  → per-좌표 요청 intent `UnevaluatedFillRequest[]`
 *       (person 묶음 순서 + 묶음 내부 좌표 순서 보존 평탄화, periodStart Date→ISO string).
 *   (2) `toPeriodBridgeRequests(...)`         → `PeriodBridgeDto[]` 1:1 매핑(reevaluate
 *       미설정 = first-write-wins, 순서 보존).
 *   (3) `dedupePeriodBridgeRequests(...)`     → 좌표 4-tuple(personId/period/scope/
 *       periodStart) first-wins 중복 제거(순서 보존). ← 최종 반환.
 *
 * 방어(조각 내부 방어 자연 전파 — wrapper 별도 방어 없음):
 *   - 본 helper 는 별도 wrapper 방어를 두지 않고 **첫 조각 `buildUnevaluatedFillRequests`
 *     의 방어에 전파를 위임**한다. `plan` 이 null/undefined 면 그 첫 조각의 한국어
 *     `TypeError`("buildUnevaluatedFillRequests: plan 이 null/undefined 일 수 없다.")가
 *     그대로 전파된다(재던지지 않음 — single-source 방어 메시지 보존).
 *   - plan 내부 구조 오류(batches non-array, 묶음 원소 null/undefined, periods non-array,
 *     좌표 원소 null/undefined, periodStart Invalid Date / 비-Date)도 해당 조각의 방어
 *     메시지(함수명 prefix 포함)로 자연 전파된다. 전파가 어느 조각에서 왔는지는 메시지
 *     prefix 로 식별되어 조각 합성 순서의 회귀를 잡는다.
 *
 * 정책(결정성 + 비변형):
 *   - `plan` 객체 및 `batches`/`periods` 내부 배열·좌표 객체를 mutate 하지 않는다(각 조각이
 *     이미 입력 비변형 — 본 helper 도 plan/중간 배열을 mutate 하지 않고 결과만 전달).
 *   - 같은 입력이면 같은 출력(시계 비의존 — 각 조각이 이미 시계 비의존).
 *   - 본 helper 자체는 새 타입/좌표를 발명하지 않고 3 조각 결과만 흘려보낸다.
 *   - 본 helper 자체는 분기 0(compose-only) — 분기는 전부 조각 내부에 있다.
 *
 * @param plan 미평가 fill batch plan(person 묶음 + 묶음 내부 좌표 배열). 변형하지 않는다.
 *   null/undefined 시 첫 조각의 한국어 메시지 `TypeError` 전파.
 * @returns 중복 제거된 `PeriodBridgeDto[]` — 좌표 4-tuple first-wins, 평탄화 등장 순서
 *   보존. 중복 없는 plan 이면 길이 === `plan.totalGapCount`(dedup 무손실). 각 원소의
 *   `reevaluate` 는 undefined(fill = first-write-wins).
 * @throws {TypeError} `plan` 이 null/undefined, plan.batches non-array, 묶음 원소
 *   null/undefined, periods non-array, 좌표 원소 null/undefined(첫 조각 전파), 또는 한
 *   좌표의 periodStart 가 Invalid Date / 비-Date(`formatKstIso` 자연 전파)일 때.
 */
export function composeUnevaluatedFillBridgeRequests(
  plan: UnevaluatedFillBatchPlan,
): PeriodBridgeDto[] {
  // (1) batch plan → per-좌표 요청 intent 평탄화. plan-level fail-fast(null/undefined·
  //     batches non-array) + 조각 내부 방어(묶음/좌표 원소 / periodStart Date)는 이 조각이
  //     전부 담당 — 본 helper 는 wrapper 방어를 두지 않고 그대로 전파한다.
  const requests = buildUnevaluatedFillRequests(plan);
  // (2) 요청 intent[] → 기존 bridge 진입점 `PeriodBridgeDto[]` 1:1 매핑(reevaluate 미설정).
  const bridgeRequests = toPeriodBridgeRequests(requests);
  // (3) 좌표 4-tuple 중복 first-wins 제거 — 최종 반환(중간 가공 0).
  return dedupePeriodBridgeRequests(bridgeRequests);
}
