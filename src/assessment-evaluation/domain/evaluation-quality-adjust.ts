// applyContributionQualityFloor — P5 기여 품질 신호 소비측 결정적 순수 domain
// helper (R-37 / R-38 / REQ-037 / REQ-038: "단순 보고·copy-paste 로그 =
// zero-contribution / 새 알고리즘 설계·외부 연구 도입 = 높은 contribution").
// T-0527 `computeContributionQualitySignal` 이 박제한 detection 신호
// (`ContributionQualitySignal` — author 별 `zeroContribution` /
// `zeroContributionUnitIds`)를 소비해, zero-contribution 후보로 식별된 author/unit
// 의 평가 단위 `contribution` 을 **결정적으로 `"zero"` 로 floor 강등** 한다(LLM
// 정성 평가가 zero 보다 높게 매겼더라도 하한 강제). 본 파일은 의존성 0 의 순수
// 함수만 둔다 — NestJS `@Injectable` / Prisma / LLM gateway import 0, 부수효과 0
// (referential transparency, 입력 비변형). 동일 입력은 항상 동일 출력 — LLM 정성
// 평가와 분리해 독립 검증 가능하다(ADR-0032 §3 "품질 분류축은 LLM 정성 + 결정적
// 신호로 분리" 정신과 정합). 패턴 mirror: evaluation-update-count-adjust.ts
// (순수 함수 + author Map 색인 + 입력 비변형 + 새 entries 배열 반환 + 명시적
// null/undefined 만 throw + 그 외 결함 흡수).
//
// R-37/R-38 의미(T-0522 abuse 감점 / T-0525 update-count 중립과의 결정적 차이):
//   - T-0522 `applyAbuseSignalToVolume` 은 `volume`(정량 수치) 의 **감점(penalty)**
//     공식이고, T-0525 `applyUpdateCountNeutralizationToVolume` 은 `volume` 의
//     **중립(net 0)** 보존이다.
//   - 본 helper 는 **품질 등급 enum `contribution`** 의 **하한(floor) 강등**
//     이다. 신호 대상 단위의 `contribution` 을 `"zero"`(등급 최하) 로 결정적으로
//     강등 — LLM 산출이 high / medium / low 어디든 무관하게 floor 강제.
//
// floor 강등 규칙 v1(결정적 · 단조 · LLM 무관):
//   - `signal.byAuthor` 를 author → ContributionQualityEntry 로 색인한다.
//   - 각 entry 의 author 가 신호에 없거나(미매칭) `zeroContribution === false` 면
//     → contribution 무변경(passthrough). 항상 새 객체로 복제해 입력 비변형 보장.
//   - author 가 있고 `zeroContribution === true` 인 경우:
//       · 해당 entry 의 `result.unitId` 가 `zeroContributionUnitIds` 에 있으면
//         → floor 강등 분기: contribution 을 CONTRIBUTION_QUALITY_FLOOR_LEVEL
//           (= `"zero"`) 로 강제. 이미 `"zero"` 면 멱등(값은 같지만 새 객체로 복제).
//       · `unitId` 가 목록에 없으면(같은 author 의 다른 단위가 zero-contribution
//         후보지만 본 단위는 아님) → 무변경 passthrough(부분 적용 정합).
//   - **단조 하한** 보장: contribution 을 **절대 상향하지 않는다**(상향은 LLM 정성
//     평가 영역 — Out of Scope). 오직 신호 대상 단위를 `"zero"` 로 내리는 하한만.
//     `CONTRIBUTION_LEVELS` 가 zero/low/medium/high 4 등급 single-source 이고
//     `"zero"` 가 최하이므로, floor 강등은 어떤 입력 등급에 대해서도 단조 비상향
//     이다.
//   - 미대상(zero-contribution 후보 아님) 단위는 contribution 무변경 passthrough
//     (단 항상 새 객체로 복제해 입력 비변형 보장).
//   - 입력 entries 의 길이 · 순서를 보존한다(caller 매핑 재사용 보장).
//
// throw 경계(T-0525 / T-0527 정합):
//   - 명시적 입력 계약 위반(`entries` / `signal` 이 null 또는 undefined)만 한국어
//     `TypeError`. 그 외 결함(빈 배열 · 빈 `signal.byAuthor` · author 미매칭 ·
//     unitId 미매칭 · contribution 이 이미 `"zero"` · contribution 값이 enum 외)
//     은 모두 **방어적으로 흡수**(무변경 또는 floor 강등 후 새 객체 복제) 한다.
//
// detection 재구현 0:
//   - 본 helper 는 `computeContributionQualitySignal`(T-0527) 의 산출 신호만 소비
//     한다(single-source). detection layer(`evaluation-quality-signal.ts`) 변경 0.

import type { ContributionQualitySignal } from "./evaluation-quality-signal";
import type { ContributionLevel, EvaluationResult } from "./evaluation-result";

// CONTRIBUTION_QUALITY_FLOOR_LEVEL — floor 강등 대상 등급 single-source. R-37 의
// "단순 보고·copy-paste 로그 = zero-contribution" 외화로, zero-contribution 신호
// 대상 단위는 `contribution` 을 본 등급으로 강제한다. `CONTRIBUTION_LEVELS`
// (zero/low/medium/high) 의 최하 등급으로, floor 강등은 어떤 입력 등급에 대해서도
// 단조 비상향이다 — 등급 상향은 본 helper 의 책임이 아니다(LLM 정성 평가 영역).
// v1 baseline = `"zero"`. 매우 결정적 · LLM 무관 상수.
export const CONTRIBUTION_QUALITY_FLOOR_LEVEL: ContributionLevel = "zero";

// ContributionQualityAdjustEntry — applyContributionQualityFloor 의 입력/출력
// 단위. T-0525 `UpdateCountAdjustEntry` / T-0522 `AbuseAdjustEntry` 와 동형 shape
// — caller 가 result 와 그 단위의 author(= `EvaluationInput.author`)를 함께
// 전달한다. 출력도 같은 shape · 같은 순서로 반환해 매핑 재사용을 보장한다
// (referential transparency).
export interface ContributionQualityAdjustEntry {
  // 평가 단위 author 의 외부 식별자(`EvaluationInput.author` 와 정합).
  // signal.byAuthor 의 `author` 와 매칭해 zero-contribution 대상 여부를 조회한다.
  author: string;
  // 조정 대상 평가 결과 1 건. 본 helper 는 `contribution` 만 검토 / 조정하고
  // 나머지 필드는 전사한다(`unitId` / `narrative` / `difficulty` / `volume`).
  result: EvaluationResult;
}

/**
 * contribution 품질 detection 신호(`ContributionQualitySignal`)를 소비해,
 * zero-contribution 후보로 식별된 author/unit 의 평가 단위 `contribution` 을
 * **결정적으로 `"zero"` 로 floor 강등** 한 새 entries 배열을 반환한다
 * (R-37 / R-38 / REQ-037 / REQ-038 소비 layer v1).
 *
 * 적용 규칙(결정적 · 단조 하한 · LLM 무관):
 *   - `signal.byAuthor` 를 author → ContributionQualityEntry 로 색인한다.
 *   - 각 entry 의 author 가 신호에 없거나(미매칭) `zeroContribution === false` 면
 *     → contribution 무변경(passthrough). 항상 새 객체로 복제해 입력 비변형 보장.
 *   - author 가 있고 `zeroContribution === true` 인 경우:
 *       · 해당 entry 의 `result.unitId` 가 `zeroContributionUnitIds` 에 있으면
 *         → floor 강등 분기: contribution 을 CONTRIBUTION_QUALITY_FLOOR_LEVEL
 *           (= `"zero"`) 로 강제(이미 `"zero"` 면 멱등 — 값 동일이지만 새 객체).
 *       · `unitId` 가 목록에 없으면(같은 author 의 다른 단위가 후보지만 본 단위는
 *         아님) → 무변경 passthrough(부분 적용 정합).
 *
 * 방어(throw 0 흡수 정책):
 *   - 빈 `entries` → 빈 배열 반환.
 *   - 빈 `signal.byAuthor` → 매칭 0, 전 단위 무변경 복제.
 *   - author 미매칭 → 그 단위 무변경 복제.
 *   - contribution 이 enum 외 값(layer 경계 침입) → floor 강등 분기는 `"zero"` 로
 *     강제(단조 하한과 정합), 비대상 분기는 입력값 그대로 전사(caller 책임 신뢰).
 *   - 입력 `entries` / 원소 / `result` / `signal` 비변형 — 새 배열 · 새 객체만
 *     반환(Object.freeze 입력 통과).
 *
 * throw(명시적 계약 위반만):
 *   - `entries` 가 null/undefined → 한국어 `TypeError`.
 *   - `signal` 이 null/undefined → 한국어 `TypeError`.
 *
 * 단조 하한 보장: 본 helper 는 contribution 을 **올리지 않는다**. 신호 대상
 * 단위에 한해서만 `"zero"` 로 강등하며, 비대상은 입력 등급을 그대로 전사한다.
 * 등급 상향(R-37 후반 high-contribution 식별)은 본 helper 의 책임이 아니다 —
 * LLM 정성 평가 영역 + 별도 task.
 *
 * @param entries 조정 대상 단위 배열(`{ author, result }[]`). 변형하지 않는다.
 * @param signal computeContributionQualitySignal 산출 contribution 품질 신호.
 *               변형하지 않는다.
 * @returns 같은 길이 · 같은 순서의 새 entries 배열(신호 대상은 contribution
 *          `"zero"` 강등, 비대상은 무변경 passthrough — 모두 새 객체 복제).
 */
export function applyContributionQualityFloor(
  entries: ContributionQualityAdjustEntry[],
  signal: ContributionQualitySignal,
): ContributionQualityAdjustEntry[] {
  if (entries === null || entries === undefined) {
    throw new TypeError("entries 는 null 또는 undefined 일 수 없습니다.");
  }
  if (signal === null || signal === undefined) {
    throw new TypeError("signal 은 null 또는 undefined 일 수 없습니다.");
  }

  // author → ContributionQualityEntry 색인. byAuthor 가 빈 배열이어도 빈 Map 이
  // 되어 전 단위 미매칭(무변경)으로 흡수된다.
  const byAuthor = new Map(
    signal.byAuthor.map((entry) => [entry.author, entry]),
  );

  return entries.map((entry) => {
    const authorSignal = byAuthor.get(entry.author);
    const isFloorTarget =
      authorSignal !== undefined &&
      authorSignal.zeroContribution &&
      authorSignal.zeroContributionUnitIds.includes(entry.result.unitId);

    const nextContribution = isFloorTarget
      ? CONTRIBUTION_QUALITY_FLOOR_LEVEL
      : entry.result.contribution;

    // 입력 비변형 — entry 와 result 를 항상 새 객체로 복제한다(contribution 만
    // 갱신, 나머지 필드는 전사).
    return {
      author: entry.author,
      result: { ...entry.result, contribution: nextContribution },
    };
  });
}
