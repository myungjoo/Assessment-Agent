// applyNotableContributionAnnotation — P5 중요·어려운 기여 신호 소비측 결정적 순수
// domain helper (R-25 / REQ-011: "중요·어려운 기여 → 높은 점수 — 어렵고 남이 못할
// 일"). T-0533 `computeNotableContributionSignal` 이 박제한 detection 신호
// (`NotableContributionSignal` — author 별 `notable` / `codeUnitCount`, batch 차원
// `notableDetected` / `meanCodeUnitCount`)를 소비해, 중요기여로 식별된 author 의
// 평가 단위 결과를 **결정적으로 annotation** 한다 — 그 author 의 모든 단위
// `result.narrative` 앞에 표준 한국어 marker 를 접두해 중요기여 사실을 외화한다.
// 본 파일은 의존성 0 의 순수 함수만 둔다 — NestJS `@Injectable` / Prisma / LLM
// gateway import 0, 부수효과 0(referential transparency, 입력 비변형). 동일 입력은
// 항상 동일 출력 — LLM 정성 평가와 분리해 독립 검증 가능하다(ADR-0032 §3 "metric
// 수치 신호는 LLM 정성과 분리해 결정적으로" 정신과 정합).
//
// 패턴 mirror: evaluation-underperformer-adjust.ts(T-0531 — 본 helper 의 직접 대칭
// inverse 원형: 순수 함수 + author Map 색인 + 입력 비변형 + 새 entries 배열 반환 +
// 명시적 null/undefined 만 throw + 그 외 결함 흡수 + named 한국어 marker single-
// source + 멱등 startsWith 검사 + 같은 길이·같은 순서 보존). T-0531 이 저성과
// (underPerformer=true) author 에 `[저성과자]` marker 를 접두하듯, 본 helper 는
// 중요기여(notable=true) author 에 `[중요기여]` marker 를 접두한다 — 동형 구조의
// 의미 inverse(저성과 ↔ 중요기여).
//
// 형제 소비 helper 와의 결정적 차이(신호 차원):
//   - T-0522 `applyAbuseSignalToVolume`(volume 감점) / T-0525
//     `applyUpdateCountNeutralizationToVolume`(volume 중립) / T-0528
//     `applyContributionQualityFloor`(contribution 등급 floor 강등)은 모두
//     **unitId 목록까지 내려가는** 단위 차원 신호를 소비한다.
//   - 본 helper 가 소비하는 T-0533 `NotableContributionSignal` 은 **author-level
//     판정** (`byAuthor[*].notable` boolean — 해당 author 의 전 단위가 중요기여
//     대상)이다. 따라서 unitId 매칭 없이, notable=true 인 author 의 **모든** 평가
//     단위를 일관 annotation 한다(author-level 전파, T-0531 동형).
//   - 또 본 helper 는 `volume` / `contribution` 같은 정량/등급 필드를 손대지 않고
//     `narrative` 에 marker 만 접두한다(중요기여 사실의 외화 — 점수 반영은 별도
//     task).
//
// annotation 규칙 v1(결정적 · 비파괴 · 멱등 · 단조 · LLM 무관):
//   - `signal.byAuthor` 를 author → NotableContributionEntry 로 색인한다.
//   - 각 entry 의 author 가 신호에 없거나(미매칭) `notable === false` 면
//     → narrative 무변경(passthrough). 항상 새 객체로 복제해 입력 비변형 보장.
//   - author 가 있고 `notable === true` 인 경우:
//       · 해당 단위 `result.narrative` 앞에 NOTABLE_CONTRIBUTION_NARRATIVE_MARKER
//         를 접두한다(비파괴 — 기존 본문은 그대로 뒤에 보존).
//       · 이미 marker 로 시작하면(`narrative.startsWith(marker)`) 멱등 —
//         중복 접두하지 않는다(값은 같지만 새 객체로 복제). 2 회 적용해도 marker
//         는 한 번만 남는다.
//       · 빈 narrative("") 도 marker 만 접두한다(본문 손상 없음).
//   - **단조** 보장: 중요기여 marker 를 **해제하는 역방향이 없다**. 소비는 상향
//     marker 접두만 — author 가 중요기여로 식별되면 marker 가 붙고, 한 번 붙은
//     뒤로는 멱등하게 유지된다(T-0531 단조 하한 marker 의 의미 inverse — 본 helper
//     는 단조 상향 marker).
//   - 미대상(중요기여 아님) 단위는 narrative 무변경 passthrough(단 항상 새 객체로
//     복제해 입력 비변형 보장).
//   - 입력 entries 의 길이 · 순서를 보존한다(caller 매핑 재사용 보장).
//
// throw 경계(T-0533 detection layer throw 0 정합):
//   - 명시적 입력 계약 위반(`entries` / `signal` 이 null 또는 undefined)만 한국어
//     `TypeError`. 그 외 결함(빈 배열 · 빈 `signal.byAuthor` · author 미매칭 ·
//     이미 marker 접두 · 빈 narrative)은 모두 **방어적으로 흡수**(무변경 또는
//     멱등 marker 접두 후 새 객체 복제) 한다.
//
// detection 재구현 0:
//   - 본 helper 는 `computeNotableContributionSignal`(T-0533) 의 산출 신호만 소비
//     한다(single-source). detection layer(`evaluation-notable-contribution-signal
//     .ts`) 변경 0.

import type {
  NotableContributionEntry,
  NotableContributionSignal,
} from "./evaluation-notable-contribution-signal";
import type { EvaluationResult } from "./evaluation-result";

// NOTABLE_CONTRIBUTION_NARRATIVE_MARKER — 중요기여로 식별된 author 의 평가 단위
// `narrative` 앞에 접두하는 표준 한국어 marker single-source. R-25 / REQ-011 의
// "중요·어려운 기여 식별 — 높은 점수" 을 평가 결과 본문에 결정적으로 외화한다 —
// LLM 정성 평가문 앞에 명시적 marker 를 두어 소비자(사람/후속 layer)가 중요기여
// 사실을 즉시 인지하게 한다. 멱등 검사(`narrative.startsWith(marker)`)와 접두에
// 모두 본 상수를 쓴다 — 문자열 drift 를 single-source 로 차단. v1 baseline =
// `"[중요기여] "`(marker + 구분 공백, T-0531 `"[저성과자] "` 와 동형 포맷).
// 매우 결정적 · LLM 무관 상수. §12 한국어.
export const NOTABLE_CONTRIBUTION_NARRATIVE_MARKER = "[중요기여] ";

// NotableContributionAdjustEntry — applyNotableContributionAnnotation 의 입력/출력
// 단위. T-0531 `UnderPerformerAdjustEntry` / T-0525 `UpdateCountAdjustEntry` /
// T-0528 `ContributionQualityAdjustEntry` 와 동형 shape — caller 가 result 와 그
// 단위의 author(= `EvaluationInput.author`)를 함께 전달한다. 출력도 같은 shape ·
// 같은 순서로 반환해 매핑 재사용을 보장한다(referential transparency).
export interface NotableContributionAdjustEntry {
  // 평가 단위 author 의 외부 식별자(`EvaluationInput.author` 와 정합).
  // signal.byAuthor 의 `author` 와 매칭해 중요기여 대상 여부를 조회한다.
  author: string;
  // 조정 대상 평가 결과 1 건. 본 helper 는 `narrative` 만 검토 / annotation 하고
  // 나머지 필드는 전사한다(`unitId` / `difficulty` / `contribution` / `volume`).
  result: EvaluationResult;
}

/**
 * 중요·어려운 기여 detection 신호(`NotableContributionSignal`)를 소비해, 중요기여로
 * 식별된 author 의 모든 평가 단위 `result.narrative` 앞에 표준 한국어 marker
 * (NOTABLE_CONTRIBUTION_NARRATIVE_MARKER)를 결정적으로 접두 annotation 한 새
 * entries 배열을 반환한다(R-25 / REQ-011 소비 layer v1).
 *
 * 적용 규칙(결정적 · 비파괴 · 멱등 · 단조 · LLM 무관):
 *   - `signal.byAuthor` 를 author → NotableContributionEntry 로 색인한다.
 *   - 각 entry 의 author 가 신호에 없거나(미매칭) `notable === false` 면
 *     → narrative 무변경(passthrough). 항상 새 객체로 복제해 입력 비변형 보장.
 *   - author 가 있고 `notable === true` 인 경우:
 *       · 해당 단위 narrative 앞에 marker 를 접두(이미 marker 로 시작하면 멱등 —
 *         중복 0). author-level 판정이므로 그 author 의 **모든** 단위가 대상.
 *       · 빈 narrative("") 도 marker 만 접두(본문 손상 없음).
 *
 * 방어(throw 0 흡수 정책):
 *   - 빈 `entries` → 빈 배열 반환.
 *   - 빈 `signal.byAuthor` → 매칭 0, 전 단위 무변경 복제.
 *   - author 미매칭 → 그 단위 무변경 복제.
 *   - 이미 marker 접두 → 멱등(중복 접두 없음).
 *   - 입력 `entries` / 원소 / `result` / `signal` 비변형 — 새 배열 · 새 객체만
 *     반환(Object.freeze 입력 통과).
 *
 * throw(명시적 계약 위반만):
 *   - `entries` 가 null/undefined → 한국어 `TypeError`.
 *   - `signal` 이 null/undefined → 한국어 `TypeError`.
 *
 * 단조 보장: 본 helper 는 중요기여 marker 를 **해제하지 않는다**. 중요기여로 식별된
 * author 의 단위에 한해 marker 를 접두하며, 한 번 붙은 marker 는 멱등하게 유지된다
 * (역방향 0). marker 미접두/해제는 본 helper 의 책임이 아니다.
 *
 * @param entries 조정 대상 단위 배열(`{ author, result }[]`). 변형하지 않는다.
 * @param signal computeNotableContributionSignal 산출 중요기여 신호. 변형하지 않는다.
 * @returns 같은 길이 · 같은 순서의 새 entries 배열(중요기여 author 단위는 narrative
 *          marker 접두, 비대상은 무변경 passthrough — 모두 새 객체 복제).
 */
export function applyNotableContributionAnnotation(
  entries: NotableContributionAdjustEntry[],
  signal: NotableContributionSignal,
): NotableContributionAdjustEntry[] {
  if (entries === null || entries === undefined) {
    throw new TypeError("entries 는 null 또는 undefined 일 수 없습니다.");
  }
  if (signal === null || signal === undefined) {
    throw new TypeError("signal 은 null 또는 undefined 일 수 없습니다.");
  }

  // author → NotableContributionEntry 색인. byAuthor 가 빈 배열이어도 빈 Map 이
  // 되어 전 단위 미매칭(무변경)으로 흡수된다.
  const byAuthor = new Map<string, NotableContributionEntry>(
    signal.byAuthor.map((entry) => [entry.author, entry]),
  );

  return entries.map((entry) => {
    const authorSignal = byAuthor.get(entry.author);
    const isNotable = authorSignal !== undefined && authorSignal.notable;

    const nextNarrative = isNotable
      ? annotateNarrative(entry.result.narrative)
      : entry.result.narrative;

    // 입력 비변형 — entry 와 result 를 항상 새 객체로 복제한다(narrative 만 갱신,
    // 나머지 필드는 전사).
    return {
      author: entry.author,
      result: { ...entry.result, narrative: nextNarrative },
    };
  });
}

// annotateNarrative — 중요기여 대상 단위 narrative 앞에 marker 를 비파괴·멱등 접두
// 한다. 이미 marker 로 시작하면(중복) 원본을 그대로 반환해 멱등성을 보장하고,
// 그렇지 않으면 marker + 기존 본문을 합성한다(빈 narrative 면 marker 만). 중요기여
// marker 를 해제하는 역방향은 없다(단조 상향 marker — T-0531 단조 하한 marker 의
// 의미 inverse).
function annotateNarrative(narrative: string): string {
  if (narrative.startsWith(NOTABLE_CONTRIBUTION_NARRATIVE_MARKER)) {
    return narrative;
  }
  return `${NOTABLE_CONTRIBUTION_NARRATIVE_MARKER}${narrative}`;
}
