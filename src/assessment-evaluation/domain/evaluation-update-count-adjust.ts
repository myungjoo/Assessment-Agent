// applyUpdateCountNeutralizationToVolume — P5 update 횟수 중립화의 소비측 결정적
// 순수 domain helper (R-41 / REQ-022: "습관적 중간 저장으로 update 횟수만 늘어나는
// 경우 advantage / disadvantage 둘 다 없어야"). T-0524 `computeUpdateCountNeutralization`
// 이 박제한 detection 신호(`UpdateCountNeutralization` — author 별 `neutralized` /
// `neutralizedUnitIds`)를 소비해, 중립 대상으로 식별된 author/unit 의 평가 단위
// `volume` 을 **net 0(중립 보존)** 으로 처리한다. 본 파일은 의존성 0 의 순수 함수만
// 둔다 — NestJS `@Injectable` / Prisma / LLM gateway import 0, 부수효과 0
// (referential transparency, 입력 비변형). 동일 입력은 항상 동일 출력 — LLM 정성
// 평가와 분리해 독립 검증 가능하다(ADR-0032 §3 "양은 metadata 기반 deterministic
// 수치, LLM 무관" 정신과 정합). 패턴 mirror: evaluation-abuse-adjust.ts(순수 함수
// + author Map 색인 + 입력 비변형 + 새 entries 배열 반환 + 명시적 null/undefined
// 만 throw + 그 외 결함 흡수).
//
// R-41 의미(T-0522 abusing 감점과의 결정적 차이):
//   - T-0522 `applyAbuseSignalToVolume` 은 **감점(penalty)** — suspected author 의
//     volume 을 `floor(volume * (1 - ratio))` 로 깎는다.
//   - 본 helper 는 **중립(net 0 — 보너스도 페널티도 없음)**. 중간 저장으로 부풀려진
//     update 횟수 자체는 양 / 점수의 advantage 로 작용해서는 안 되지만, 동시에
//     페널티로 작용해서도 안 된다(R-41 명문). 따라서 abuse 감점 공식(`floor(volume *
//     (1 - ratio))`)을 그대로 베끼지 않는다.
//
// 중립 보존 규칙 v1(결정적 · 단조 · LLM 무관):
//   - `evaluation-volume.ts` (volume 산출 layer) 는 R-41 정신을 따라 version 을
//     volume 에 가산하지 않는다(detection layer 의 Out of Scope 박제 그대로). 즉
//     중립 대상 단위가 본 helper 에 도달했을 때, 그 `volume` 은 이미 update 횟수
//     기여를 0 으로 둔 base value 다.
//   - 본 helper 의 책임은 그 base value 를 **그대로 보존**하는 것이다 — update 횟수
//     가 5 회든 50 회든 volume 산출에 영향을 주지 않는다는 R-41 의 외화. 단 음수 /
//     비유한 layer 경계 입력은 `UPDATE_COUNT_NEUTRAL_VOLUME_FLOOR` 로 방어 절하해
//     계약상 ≥ 0 정수를 보장한다.
//   - 미대상(중립 대상 아님) 단위는 volume 무변경 passthrough(항상 새 객체로 복제).
//   - 입력 entries 의 길이 · 순서를 보존한다(caller 매핑 재사용 보장).
//
// throw 경계(T-0524 detection layer throw 0 정합):
//   - 명시적 입력 계약 위반(`entries` / `neutralization` 이 null 또는 undefined)만
//     한국어 `TypeError`. 그 외 결함(빈 배열 · 빈 `neutralization.byAuthor` ·
//     author 미매칭 · unitId 미매칭 · volume 이 이미 0 / 음수 / NaN / Infinity)은
//     모두 **방어적으로 흡수**(무변경 또는 FLOOR 절하 후 새 객체 복제) 한다.

import type { EvaluationResult } from "./evaluation-result";
import type { UpdateCountNeutralization } from "./evaluation-update-count-neutral";

// UPDATE_COUNT_NEUTRAL_VOLUME_FLOOR — 중립 보존 결과 volume 의 하한(음수 / 비유한
// 방어). `EvaluationResult.volume` 은 계약상 ≥ 0 정수이므로 layer 경계에서 음수 /
// NaN / Infinity 가 흘러들어도 본 하한으로 절하해 invariant 를 유지한다. v1
// baseline = 0 (volume 0 이 R-41 정신의 "advantage 도 penalty 도 없음" 의 자연
// 하한).
export const UPDATE_COUNT_NEUTRAL_VOLUME_FLOOR = 0;

// UpdateCountAdjustEntry — applyUpdateCountNeutralizationToVolume 의 입력/출력
// 단위. T-0522 `AbuseAdjustEntry` 와 동형 shape — caller 가 result 와 그 단위의
// author(= `EvaluationInput.author`)를 함께 전달한다. 출력도 같은 shape · 같은
// 순서로 반환해 매핑 재사용을 보장한다(referential transparency).
export interface UpdateCountAdjustEntry {
  // 평가 단위 author 의 외부 식별자(`EvaluationInput.author` 와 정합).
  // neutralization.byAuthor 의 `author` 와 매칭해 중립 대상 여부를 조회한다.
  author: string;
  // 조정 대상 평가 결과 1 건. 본 helper 는 `volume` 만 검토 / 조정하고 나머지
  // 필드는 전사한다(`unitId` / `narrative` / `difficulty` / `contribution`).
  result: EvaluationResult;
}

/**
 * update 횟수 중립화 detection 신호(`UpdateCountNeutralization`)를 소비해, 중립 대상
 * 으로 식별된 author/unit 의 평가 단위 `volume` 을 **net 0(중립 보존)** 으로 처리한
 * 새 entries 배열을 반환한다(R-41 / REQ-022 소비 layer v1).
 *
 * 적용 규칙(결정적 · 단조 · LLM 무관):
 *   - `neutralization.byAuthor` 를 author → UpdateCountNeutralEntry 로 색인한다.
 *   - 각 entry 의 author 가 신호에 없거나(미매칭) `neutralized === false` 면
 *     → volume 무변경(중립 passthrough). 항상 새 객체로 복제해 입력 비변형 보장.
 *   - author 가 있고 `neutralized === true` 인 경우:
 *       · 해당 entry 의 `result.unitId` 가 `neutralizedUnitIds` 에 있으면
 *         → 중립 보존 분기: volume 을 base 값 그대로 유지(부풀린 update 횟수가
 *           advantage 로도 penalty 로도 작용하지 않음). 단 layer 경계 방어로
 *           음수 / 비유한 volume 은 UPDATE_COUNT_NEUTRAL_VOLUME_FLOOR 로 절하한다.
 *       · `unitId` 가 목록에 없으면(같은 author 의 다른 단위가 중립 대상이지만
 *         본 단위는 아님) → 무변경 passthrough(부분 적용 정합).
 *
 * 방어(throw 0 흡수 정책):
 *   - 빈 `entries` → 빈 배열 반환.
 *   - 빈 `neutralization.byAuthor` → 매칭 0, 전 단위 무변경 복제.
 *   - author 미매칭 → 그 단위 무변경 복제.
 *   - 중립 대상이지만 volume 이 음수 / NaN / Infinity → FLOOR 로 방어 절하 후 복제.
 *   - 입력 `entries` / 원소 / `result` / `neutralization` 비변형 — 새 배열 ·
 *     새 객체만 반환(Object.freeze 입력 통과).
 *
 * throw(명시적 계약 위반만):
 *   - `entries` 가 null/undefined → 한국어 `TypeError`.
 *   - `neutralization` 이 null/undefined → 한국어 `TypeError`.
 *
 * @param entries 조정 대상 단위 배열(`{ author, result }[]`). 변형하지 않는다.
 * @param neutralization computeUpdateCountNeutralization 산출 update 횟수 중립화
 *                       신호. 변형하지 않는다.
 * @returns 같은 길이 · 같은 순서의 새 entries 배열(중립 대상은 base volume 보존,
 *          비대상은 무변경 passthrough — 모두 새 객체 복제).
 */
export function applyUpdateCountNeutralizationToVolume(
  entries: UpdateCountAdjustEntry[],
  neutralization: UpdateCountNeutralization,
): UpdateCountAdjustEntry[] {
  if (entries === null || entries === undefined) {
    throw new TypeError("entries 는 null 또는 undefined 일 수 없습니다.");
  }
  if (neutralization === null || neutralization === undefined) {
    throw new TypeError(
      "neutralization 은 null 또는 undefined 일 수 없습니다.",
    );
  }

  // author → UpdateCountNeutralEntry 색인. byAuthor 가 빈 배열이어도 빈 Map 이
  // 되어 전 단위 미매칭(무변경)으로 흡수된다.
  const byAuthor = new Map(
    neutralization.byAuthor.map((entry) => [entry.author, entry]),
  );

  return entries.map((entry) => {
    const authorSignal = byAuthor.get(entry.author);
    const isNeutralTarget =
      authorSignal !== undefined &&
      authorSignal.neutralized &&
      authorSignal.neutralizedUnitIds.includes(entry.result.unitId);

    const nextVolume = isNeutralTarget
      ? preserveNeutralVolume(entry.result.volume)
      : entry.result.volume;

    // 입력 비변형 — entry 와 result 를 항상 새 객체로 복제한다(volume 만 갱신).
    return {
      author: entry.author,
      result: { ...entry.result, volume: nextVolume },
    };
  });
}

// preserveNeutralVolume — 중립 대상 단위의 base volume 을 보존한다(R-41 net 0).
// volume 이 음수 / 비유한(NaN / Infinity) layer 경계 입력이면 방어 절하해 ≥ 0
// 정수 invariant 를 유지한다. 정상 입력(유한 ≥ 0)은 그대로 floor 정규화해 반환
// (소수 → 정수, 결정적). update 횟수 기반 가산 / 감산은 일절 적용하지 않는다 —
// 이것이 본 helper 가 abuse 감점 공식을 mirror 하지 않는 핵심 이유다.
function preserveNeutralVolume(volume: number): number {
  if (!Number.isFinite(volume) || volume <= UPDATE_COUNT_NEUTRAL_VOLUME_FLOOR) {
    return UPDATE_COUNT_NEUTRAL_VOLUME_FLOOR;
  }
  return Math.floor(volume);
}
