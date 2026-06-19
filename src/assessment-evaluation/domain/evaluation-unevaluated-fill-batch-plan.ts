// evaluation-unevaluated-fill-batch-plan — 미평가(gap) 좌표를 person 별 일괄 평가
// batch plan 으로 요약하는 순수 도메인 함수
// (PLAN.md P5 bullet 106 / R-64 / REQ-037 "평가 없는 부분 일괄 평가"의 consume 조각).
// 부수효과 0 / 외부 의존 0 / `@Injectable` 0 / Prisma 0 / LLM 호출 0 / repository 0 /
// 입력 배열·원소 비변형. `import` 는 도메인 내 `EvaluationPersistContext` 타입만(재사용,
// 새 좌표 타입 발명 0 — 반환 wrapper 타입만 신설).
//
// 책임(ADR-0033 §Decision3 "fill" mode 의 일괄 평가 계획 표현):
//   직전 T-0536 `selectUnevaluatedPeriods` 가 derive 한 미평가 좌표 `EvaluationPersistContext[]`
//   를 입력으로 받아, **person 별로 그룹핑한 일괄 평가 batch plan**(person 별 미평가 좌표
//   묶음 + 총 gap 수 / 고유 person 수 요약)을 결정적으로 derive 한다. abuse / quality /
//   notable layer 와 동형인 detection→consume 사슬의 **consume 짝** — 좌표 차집합은
//   T-0536 책임이고, 본 helper 는 그 결과를 일괄 평가 흐름에 흘리기 위한 person 단위
//   그룹핑만 담당한다.
//
// 경계(task Out of Scope):
//   - orchestrator/service/controller 실배선(gap 선별 → batch plan → 실제 일괄 평가
//     실행 compose)·DB read·좌표 생성(기간 enumeration)은 본 함수 범위 밖.
//   - reeval/overwrite 경로(ADR-0038 완료분)는 건드리지 않는다(직교).
//   - 차집합 멤버십·dedup 은 T-0536 책임 — 본 helper 는 그룹핑만 한다(같은 좌표가 입력에
//     중복으로 들어오면 묶음 안에 중복 그대로 보존한다 — dedup 안 함).
//
// 패턴 mirror: evaluation-dedup.ts(순수 함수 + Map 누적 + firstSeenOrder 안정적 반환
// 순서 + 입력 비변형 + 한국어 JSDoc) + evaluation-unevaluated-period-select.ts(방어적
// 입력 처리 — 명시적 null/undefined 입력은 한국어 메시지 `TypeError` 로 조기 노출).

import type { EvaluationPersistContext } from "./evaluation-result.persist.mapper";

/**
 * 한 person 의 미평가 좌표 묶음 — 일괄 평가 batch 의 단일 단위.
 *
 * `personId` 는 그룹 키, `periods` 는 그 person 의 미평가 좌표를 **gap 입력 등장 순서**
 * 그대로 담은 배열이다. 같은 좌표가 입력에 중복 등장하면 묶음 안에 중복 그대로 보존
 * (dedup 안 함 — 차집합 멤버십은 T-0536 책임).
 */
export interface UnevaluatedFillBatch {
  personId: string;
  periods: EvaluationPersistContext[];
}

/**
 * 미평가 gap 좌표 배열을 person 별 일괄 평가 batch 로 요약한 plan.
 *
 * `batches` 는 person 별 묶음 배열로, **person 묶음 순서 = person 최초 등장 순서**
 * (firstSeenOrder) 이며 묶음 안의 좌표 순서는 gap 입력 등장 순서다. `totalGapCount`
 * 는 입력 gap 총 수(`gaps.length`), `personCount` 는 고유 person 수(=`batches.length`).
 *
 * 불변식: `totalGapCount === batches.reduce((s, b) => s + b.periods.length, 0)` —
 * dedup 안 하므로 입력 길이가 묶음 길이의 합과 정확히 같다.
 */
export interface UnevaluatedFillBatchPlan {
  batches: UnevaluatedFillBatch[];
  totalGapCount: number;
  personCount: number;
}

// assertGapElement — gap 좌표 원소 방어. null/undefined 원소 또는 `personId` 가
// string 이 아니면 한국어 메시지 `TypeError` 로 조기 노출(silent skip 시 일괄 평가
// 계획에서 person 묶음이 누락·누출되어 평가 누락을 유발 — fail-fast 가 안전).
// `personId` 의 빈 문자열("") 은 유효 person key 로 허용한다(경계값 — 정규화 안 함,
// exact match — T-0536 / evaluation-unevaluated-period-select.ts 의 정신과 동일).
function assertGapElement(
  coord: EvaluationPersistContext,
  index: number,
): void {
  if (coord === null || coord === undefined) {
    throw new TypeError(
      `gaps[${index}] 좌표 원소가 null/undefined 일 수 없다.`,
    );
  }
  if (typeof coord.personId !== "string") {
    throw new TypeError(
      `gaps[${index}] 좌표의 personId 는 string 이어야 한다: ${String(
        coord.personId,
      )}`,
    );
  }
}

/**
 * 미평가(gap) 좌표 배열을 person 별 일괄 평가 batch plan 으로 요약한다
 * (PLAN.md P5 bullet 106 / R-64 / REQ-037, ADR-0033 §Decision3 fill semantics 의
 * 일괄 평가 계획 표현 — T-0536 `selectUnevaluatedPeriods` 의 consume 짝).
 *
 * gap 좌표 배열을 `personId` 기준으로 그룹핑해 `{ batches, totalGapCount, personCount }`
 * 를 결정적으로 derive 한다. abuse / quality / notable layer 와 동형인 detection→
 * consume 사슬의 consume 조각이다.
 *
 * 그룹핑 정책:
 *   - **person 묶음 순서 = person 최초 등장 순서**(firstSeenOrder, Map 누적 — 같은
 *     person 의 좌표가 비연속 등장해도 묶음은 그 person 의 최초 등장 위치에 자리잡고,
 *     이후 등장은 같은 묶음에 흡수된다).
 *   - **묶음 내부 좌표 순서 = gap 입력 등장 순서**(stable 그룹핑 — Array.prototype.push
 *     로 등장 순 누적).
 *   - **정규화 안 함** — `personId` 의 대소문자 / 공백 차이는 별도 person 묶음으로
 *     취급(exact match — T-0536 의 4-tuple 키 정신과 동일).
 *   - **dedup 안 함** — 같은 좌표가 gap 에 중복 등장하면 해당 person 묶음에 중복 그대로.
 *     차집합 멤버십은 T-0536 책임이고 본 helper 는 그룹핑만 한다(JSDoc 명시).
 *   - **빈 입력** — `gaps` 가 빈 배열이면 `{ batches: [], totalGapCount: 0,
 *     personCount: 0 }` 반환(결정적).
 *
 * 비변형:
 *   - 입력 배열·원소 모두 mutate 0 (반환은 새 배열 / 새 객체).
 *   - **좌표 element 는 입력 참조 그대로 누적**(방어 복제 안 함 — 좌표는 읽기 전용
 *     식별 축으로 소비되며, 본 helper 는 입력 원소를 mutate 하지 않는다). 따라서
 *     반환 plan 의 `periods[i]` 는 입력 `gaps[k]` 와 동일 참조이며, 입력 배열 자체를
 *     외부에서 mutate(`gaps.push(...)`, `gaps.pop()` 등)해도 이미 반환된 plan 의
 *     `batches`/`periods` 배열은 영향받지 않는다(반환 배열은 새 인스턴스).
 *
 * @param gaps 미평가 좌표 배열(T-0536 `selectUnevaluatedPeriods` 의 출력). 변형하지 않는다.
 *   null/undefined 시 한국어 메시지 `TypeError`(T-0536 / evaluation-dedup.ts 방어 패턴 mirror).
 * @returns person 별 일괄 평가 batch plan. `batches` 길이 === `personCount`,
 *   `gaps.length` === `totalGapCount` === `Σ batches[i].periods.length`(불변식).
 * @throws {TypeError} `gaps` 가 null/undefined 이거나, 원소가 null/undefined 이거나,
 *   원소의 `personId` 가 string 이 아닐 때.
 */
export function buildUnevaluatedFillBatchPlan(
  gaps: EvaluationPersistContext[],
): UnevaluatedFillBatchPlan {
  if (gaps === null || gaps === undefined) {
    throw new TypeError("gaps 배열이 null/undefined 일 수 없다.");
  }

  // personId → 누적 묶음. firstSeenOrder 안정성을 위해 Map(삽입 순서 보존) 을 사용한다.
  // 같은 person 의 좌표가 비연속 등장해도 묶음은 최초 등장 위치에 자리잡고, 이후
  // 등장은 기존 묶음의 periods 끝에 push 된다(등장 순서 보존).
  const byPerson = new Map<string, UnevaluatedFillBatch>();

  gaps.forEach((coord, index) => {
    assertGapElement(coord, index);
    const existing = byPerson.get(coord.personId);
    if (existing === undefined) {
      // 첫 등장 person — 새 묶음을 만들고 이 좌표를 첫 원소로 누적.
      byPerson.set(coord.personId, {
        personId: coord.personId,
        periods: [coord],
      });
      return;
    }
    // 기존 묶음에 등장 순서대로 push(dedup 안 함 — 같은 좌표가 중복 등장하면 중복 보존).
    existing.periods.push(coord);
  });

  // Map.values() 는 삽입 순서(= person 최초 등장 순서)대로 iterate.
  const batches = Array.from(byPerson.values());

  return {
    batches,
    totalGapCount: gaps.length,
    personCount: batches.length,
  };
}
