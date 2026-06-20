// fill-requests-to-bridge.mapper — P5 bullet 106(R-64 / REQ-037 "평가 없는 부분 일괄
// 평가" / REQ-038) detection→consume 사슬의 plan→execute 전이 2 번째 순수 조각.
// T-0549(merge 522805f, PR #463)가 미평가 fill batch plan 을 per-좌표 평가 요청 intent 의
// 1 차원 배열 `UnevaluatedFillRequest[]`(personId/period/scope/periodStart:string)로
// 평탄화했다. 이 요청 intent shape 은 이미 존재하는 per-좌표 평가 실행 진입점
// `PeriodBridgeDto`(personId/period/scope/periodStart + 선택 reevaluate, ADR-0037 slice 1)
// 와 동형이다. 본 mapper 는 `UnevaluatedFillRequest[]` 를 기존 bridge 진입점이 소비하는
// `PeriodBridgeDto[]` 로 변환하는 dependency-free 순수 함수다.
//
// 책임:
//   4 축(personId/period/scope/periodStart)을 그대로 passthrough 로 새 `PeriodBridgeDto`
//   plain 객체에 전사한다. `reevaluate` 축은 set 하지 않는다(undefined 유지) — REQ-064 의
//   "fill"(미평가 빈칸 채우기)은 first-write-wins(ADR-0037 §Decision3 / ADR-0038 §Decision1)
//   라 overwrite 가 아니기 때문이다. 입력 순서를 그대로 보존한 1:1 매핑이며 dedup/재정렬/
//   필터 0(중복 입력은 중복 출력 그대로 — 차집합 멤버십은 상류 책임).
//
// 경계(task Out of Scope):
//   - bridge orchestrator/service 실배선(매핑한 `PeriodBridgeDto[]` → fresh-collect → LLM
//     평가 → 영속)·controller 실행 route 신설 — 후속 impure wiring slice. 본 함수는 순수
//     형 변환만.
//   - LLM 네트워크 호출·live-LLM 검증(standing 게이트 bullet 108) — 건드리지 않음.
//   - reeval/overwrite 경로(ADR-0033/ADR-0038) — fill 은 first-write-wins 라 `reevaluate`
//     축 set 금지. overwrite 결합은 본 mapper 밖(orchestration 책임).
//   - class-validator 런타임 validate 호출(`validateOrReject` 등) — controller-scope
//     ValidationPipe 책임. 본 mapper 는 plain 객체 조립만(런타임 validate 호출 0).
//
// 패턴 mirror: unevaluated-fill-plan-response.mapper.ts(null/undefined fail-fast 한국어
// `TypeError` + 비변형 map + @Injectable 0 + Prisma/LLM import 0) +
// evaluation-unevaluated-fill-requests.ts(방어적 입력 처리 — 한국어 메시지 `TypeError`
// 조기 노출 + 입력 비변형).
//
// 순수성: `@Injectable` 0, NestJS/Prisma/LLM import 0, class-validator 런타임 호출 0,
// repository import 0 — 두 타입(`UnevaluatedFillRequest`/`PeriodBridgeDto`) import 만.
// 부수효과 0, 입력 비변형. 새 외부 dependency 0.

import type { UnevaluatedFillRequest } from "../domain/evaluation-unevaluated-fill-requests";

import { PeriodBridgeDto } from "./period-bridge.dto";

/**
 * per-좌표 미평가 fill 요청 intent 배열 → 기존 per-좌표 bridge 진입점 `PeriodBridgeDto`
 * 배열 순수 변환(P5 bullet 106 / R-64 / REQ-037 detection→consume 사슬의 plan→execute
 * 전진 조각).
 *
 * 변환 규칙:
 *   - personId / period / scope / periodStart 4 축 : 그대로 전사(passthrough). 정규화 0
 *     (빈 personId "" 도 그대로 — 경계값 정규화 안 함).
 *   - reevaluate 축 : **set 하지 않는다**(undefined 유지). fill = first-write-wins 라
 *     overwrite 아님(ADR-0037 §Decision3 / ADR-0038 §Decision1). overwrite 결합은 본 mapper
 *     밖(orchestration 책임).
 *
 * 순서 결정성:
 *   - 입력 `requests` 의 순서(T-0549 평탄화 순서 — person 묶음 순서 + 묶음 내부 좌표 순서)를
 *     그대로 보존한 1:1 매핑. dedup / 재정렬 / 필터 0(중복 입력은 중복 출력 그대로 보존).
 *   - 빈 입력(`[]`)이면 빈 배열 반환(결정적).
 *
 * 비변형:
 *   - 입력 `requests` 배열·각 요청 객체 모두 mutate 0 — 반환은 새 배열/새 `PeriodBridgeDto`
 *     인스턴스. 입력 원소와 출력 원소는 서로 다른 객체 참조다.
 *
 * @param requests per-좌표 미평가 fill 요청 intent 배열. 변형하지 않는다. null/undefined
 *   시 한국어 메시지 `TypeError`(unevaluated-fill-plan-response.mapper.ts 방어 패턴 mirror).
 * @returns `PeriodBridgeDto[]` — 입력과 같은 길이·순서의 1:1 매핑. 각 원소는 새
 *   `PeriodBridgeDto` 인스턴스이며 `reevaluate` 는 undefined.
 * @throws {TypeError} `requests` 가 null/undefined·non-array 이거나, 배열 원소가
 *   null/undefined 일 때(인덱스 포함 메시지).
 */
export function toPeriodBridgeRequests(
  requests: UnevaluatedFillRequest[],
): PeriodBridgeDto[] {
  // requests 자체 방어 — null/undefined·non-array 면 한국어 메시지 TypeError 로 fail-fast
  // (silent 진행 시 아래 map 이 opaque TypeError 를 던지므로, 명시적 메시지로 조기 노출).
  if (!Array.isArray(requests)) {
    throw new TypeError(
      `toPeriodBridgeRequests: requests 는 배열이어야 한다: ${String(requests)}`,
    );
  }

  // 새 배열로 map — 입력 requests 비변형(반환은 새 인스턴스). 순서 그대로 보존(재정렬/
  // dedup/필터 0).
  return requests.map((request, index) => {
    // 요청 원소 방어 — null/undefined 면 한국어 메시지 TypeError(인덱스 포함)로 조기 노출
    // (silent skip 시 그 좌표의 평가 요청이 누락되어 평가 누락 — fail-fast 가 안전).
    if (request === null || request === undefined) {
      throw new TypeError(
        `toPeriodBridgeRequests: requests[${index}] 요청 원소가 null/undefined 일 수 없다.`,
      );
    }
    // 새 PeriodBridgeDto 인스턴스 생성 — 요청 객체를 mutate 하지 않는다. 4 축 그대로
    // passthrough. reevaluate 축은 set 하지 않는다(undefined 유지 — fill = first-write-wins).
    const dto = new PeriodBridgeDto();
    dto.personId = request.personId;
    dto.period = request.period;
    dto.scope = request.scope;
    dto.periodStart = request.periodStart;
    return dto;
  });
}
