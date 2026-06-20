// dedupe-period-bridge-requests — P5 bullet 106(R-64 / REQ-037 "평가 없는 부분 일괄
// 평가" / REQ-038) detection→consume 사슬의 plan→execute 전이 3 번째 순수 조각.
// T-0549(merge 522805f, PR #463)가 batch plan → `UnevaluatedFillRequest[]` 평탄화를,
// T-0550(merge 3f2221b, PR #464)이 요청 intent → `PeriodBridgeDto[]` 매핑을 담당했다.
// 두 상류 단계는 의도적으로 dedup 을 하지 않는다(중복 입력은 중복 출력 그대로 — 차집합
// 멤버십은 상류 책임). 그러나 일괄 평가를 실제로 흘리기 직전, 같은 좌표(personId/period/
// scope/periodStart)가 한 batch run 에 두 번 들어오면 같은 평가를 두 번 실행·영속하게
// 된다 — fill = first-write-wins(ADR-0037 §Decision3 / ADR-0038 §Decision1)라 두 번째
// 실행은 낭비(중복 LLM 호출 + 멱등성 부담)다. 본 helper 는 `PeriodBridgeDto[]` 를 받아
// 동일 좌표 중복을 결정적으로 제거하는 dependency-free 순수 함수다.
//
// 책임:
//   좌표 4-tuple(personId / period / scope / periodStart)이 동일한 원소 중 **첫 등장
//   (first-wins)** 만 보존하고 이후 중복은 버린다 — fill 의 first-write-wins 의미와 정합.
//   입력 순서(각 좌표가 처음 나타난 위치)를 그대로 보존하는 stable dedup 이며, 보존된
//   원소는 입력의 동일 객체 참조를 그대로 재사용한다(복제 0 — first-wins passthrough).
//   `reevaluate` 축은 dedup key 에 포함하지 않는다 — fill 은 reevaluate 미설정(T-0550
//   mapper 가 set 안 함), overwrite 결합은 본 helper 밖(orchestration 책임).
//
// 경계(task Out of Scope):
//   - bridge orchestrator/service 실배선(dedup 한 `PeriodBridgeDto[]` → per-좌표
//     fresh-collect → LLM 평가 → 영속)·controller 실행 route 신설 — 후속 impure wiring
//     slice. 본 함수는 순수 dedup 만.
//   - LLM 네트워크 호출·live-LLM 검증(standing 게이트 bullet 108) — 건드리지 않음.
//   - 상류 mapper(T-0549/T-0550)에 dedup 역삽입 금지 — 그 두 단계의 "dedup 안 함" 계약은
//     의도된 것(차집합 멤버십 책임 분리). dedup 은 본 orchestration-input 조립 단계 helper 만.
//   - class-validator 런타임 validate 호출 — controller-scope ValidationPipe 책임. 본
//     helper 는 plain 객체만 다룬다(런타임 validate 호출 0).
//
// 패턴 mirror: unevaluated-fill-plan-response.mapper.ts / fill-requests-to-bridge.mapper.ts
// (null/undefined fail-fast 한국어 `TypeError` + 비변형 + @Injectable 0 + Prisma/LLM
// import 0). 순수성: `@Injectable` 0, NestJS/Prisma/LLM/class-validator/repository import 0
// — `PeriodBridgeDto` 타입 import 만. 부수효과 0, 입력 비변형. 새 외부 dependency 0.

import type { PeriodBridgeDto } from "./period-bridge.dto";

/**
 * 좌표 4-tuple(personId / period / scope / periodStart)을 충돌 없이 결합한 dedup key 산출.
 *
 * 단순 구분자 concat(예 `personId + "|" + period`)은 false-merge 위험이 있다 —
 * `personId="a|b", period=""` 와 `personId="a", period="b"` 가 둘 다 `"a|b|"` 로 충돌한다.
 * `JSON.stringify([...])` 는 각 축을 따옴표·escape 처리해 직렬화하므로 위 두 좌표가 서로
 * 다른 문자열(`["a|b",""...]` vs `["a","b"...]`)이 되어 false-merge 를 차단한다.
 * `reevaluate` 축은 의도적으로 key 에 포함하지 않는다(fill = first-write-wins).
 */
function coordinateKey(request: PeriodBridgeDto): string {
  return JSON.stringify([
    request.personId,
    request.period,
    request.scope,
    request.periodStart,
  ]);
}

/**
 * per-좌표 미평가 fill bridge 요청 배열에서 동일 좌표 중복을 결정적으로 제거하는 순수
 * 함수(P5 bullet 106 / R-64 / REQ-037 detection→consume 사슬의 plan→execute 전진 조각).
 *
 * dedup 규칙:
 *   - 좌표 동일성 key = (personId, period, scope, periodStart) 4-tuple. `reevaluate` 축은
 *     key 에 **포함하지 않는다**(fill = first-write-wins, reevaluate 미설정).
 *   - 같은 좌표가 여러 번 등장하면 **첫 등장(first-wins)** 원소만 보존하고 이후 중복은
 *     버린다. 인접 중복뿐 아니라 비인접(사이에 다른 좌표) 중복도 전역으로 제거한다.
 *
 * 순서 결정성:
 *   - 입력 `requests` 의 등장 순서를 보존한 stable dedup — 출력 원소 순서는 각 좌표가
 *     입력에서 처음 나타난 위치 순서와 같다. 재정렬 0.
 *   - 빈 입력(`[]`)이면 빈 배열 반환(결정적).
 *
 * 비변형:
 *   - 입력 `requests` 배열·각 요청 객체 모두 mutate 0 — 반환은 새 배열(필터링된 부분집합).
 *   - 보존된 원소는 **입력의 동일 객체 참조를 그대로 재사용**한다(새 인스턴스 복제 0 —
 *     first-wins passthrough).
 *
 * @param requests per-좌표 미평가 fill bridge 요청 배열. 변형하지 않는다. null/undefined·
 *   non-array 시 한국어 메시지 `TypeError`(상류 mapper 방어 패턴 mirror).
 * @returns `PeriodBridgeDto[]` — 동일 좌표 중복이 제거된 부분집합. 첫 등장 순서 보존,
 *   보존 원소는 입력 객체 참조 재사용.
 * @throws {TypeError} `requests` 가 null/undefined·non-array 이거나, 배열 원소가
 *   null/undefined 일 때(인덱스 포함 메시지).
 */
export function dedupePeriodBridgeRequests(
  requests: PeriodBridgeDto[],
): PeriodBridgeDto[] {
  // requests 자체 방어 — null/undefined·non-array 면 한국어 메시지 TypeError 로 fail-fast
  // (silent 진행 시 아래 순회가 opaque TypeError 를 던지므로, 명시적 메시지로 조기 노출).
  if (!Array.isArray(requests)) {
    throw new TypeError(
      `dedupePeriodBridgeRequests: requests 는 배열이어야 한다: ${String(requests)}`,
    );
  }

  // 본 좌표가 이미 등장했는지 추적하는 Set — 첫 등장만 result 에 push(first-wins).
  const seen = new Set<string>();
  // 새 배열로 누적 — 입력 requests 비변형(반환은 새 배열, 원소는 입력 참조 재사용).
  const result: PeriodBridgeDto[] = [];

  requests.forEach((request, index) => {
    // 요청 원소 방어 — null/undefined 면 한국어 메시지 TypeError(인덱스 포함)로 조기 노출
    // (silent skip 시 그 좌표의 평가 요청이 누락되어 평가 누락 — fail-fast 가 안전).
    if (request === null || request === undefined) {
      throw new TypeError(
        `dedupePeriodBridgeRequests: requests[${index}] 요청 원소가 null/undefined 일 수 없다.`,
      );
    }

    const key = coordinateKey(request);
    // 첫 등장 좌표만 보존 — 이미 본 좌표는 버린다(first-wins). 보존 시 입력 객체 참조 재사용.
    if (!seen.has(key)) {
      seen.add(key);
      result.push(request);
    }
  });

  return result;
}
