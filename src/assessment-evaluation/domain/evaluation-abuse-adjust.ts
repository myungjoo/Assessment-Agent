// applyAbuseSignalToVolume — P5 abusing 방지 metric 의 소비측 결정적 순수 domain
// helper (R-26 코드 abusing + R-40 문서 abusing). T-0521 `computeAbuseSignal` 이
// 박제한 detection 신호(`AbuseSignal` — author 별 `suspected` / `repetitionRatio`)를
// 소비해, suspected author 의 평가 단위 `volume` 을 결정적으로 중립화/감점한다.
// 본 파일은 의존성 0 의 순수 함수만 둔다 — NestJS `@Injectable` / Prisma / LLM
// gateway import 0, 부수효과 0(referential transparency, 입력 비변형). 동일 입력은
// 항상 동일 출력 — LLM 정성 평가와 분리해 독립 검증 가능하다(ADR-0032 §3 "양은
// metadata 기반 deterministic 수치, LLM 무관" 정신과 정합). 패턴 mirror:
// evaluation-abuse-signal.ts(순수 함수 + author 그룹핑 + 입력 비변형) +
// evaluation-volume.ts(방어적 입력 처리 + ≥ 0 정수 보장).
//
// signature 선택 근거(설계 의도 §2 의 두 후보 중):
//   `applyAbuseSignalToVolume(entries: { author; result }[], signal)` 를 택한다.
//   `EvaluationResult` 는 `author` 를 보유하지 않으므로(REQ-032 trace 는 `unitId`
//   기준, author 는 `EvaluationInput` 측 보유) caller 가 result ↔ author 매핑을
//   명시적으로 함께 전달해야 결정적 매핑이 가능하다. 콜백 `resultAuthor` 보다
//   `{ author, result }[]` 가 단순·명시적이며, 반환을 같은 순서의 새 entries 배열로
//   두어 caller 가 매핑을 그대로 재사용할 수 있다(referential transparency).
//
// throw 경계(computeAbuseSignal throw 0 layer 정합):
//   - 명시적 입력 계약 위반(`entries` / `signal` 이 null 또는 undefined)만 한국어
//     `TypeError`. 그 외 결함(빈 배열 · 빈 `signal.byAuthor` · author 미매칭 ·
//     volume 이 이미 0)은 모두 **방어적으로 흡수**(무변경 passthrough) 한다 —
//     detection layer(throw 0)와 동형의 방어 정책.

import type { AbuseSignal } from "./evaluation-abuse-signal";
import type { EvaluationResult } from "./evaluation-result";

// ABUSE_VOLUME_PENALTY_FLOOR — 감점 후 volume 의 하한(음수 방지). volume 은
// `EvaluationResult` 계약상 ≥ 0 정수이므로 감점 결과도 0 미만으로 떨어지지 않도록
// 절하한다. v1 baseline = 0.
export const ABUSE_VOLUME_PENALTY_FLOOR = 0;

// ABUSE_VOLUME_RETENTION_MIN — repetitionRatio 가 1.0(전량 반복)인 author 의 단위도
// volume 을 0 으로 완전 소거하지 않고 최소 보유 비율을 남길지 결정하는 상수. v1
// baseline = 0 (전량 반복이면 volume 0 까지 감점 허용 — 가장 강한 중립화). 0 이면
// `adjusted = floor(volume * (1 - repetitionRatio))` 가 ratio=1 에서 0 이 된다.
export const ABUSE_VOLUME_RETENTION_MIN = 0;

// AbuseAdjustEntry — applyAbuseSignalToVolume 의 입력/출력 단위. caller 가 result 와
// 그 단위의 author(= `EvaluationInput.author`)를 함께 전달한다. 출력도 같은 shape ·
// 같은 순서로 반환해 매핑 재사용을 보장한다.
export interface AbuseAdjustEntry {
  // 평가 단위 author 의 외부 식별자(`EvaluationInput.author` 와 정합). signal.byAuthor
  // 의 `author` 와 매칭해 suspected 여부를 조회한다.
  author: string;
  // 조정 대상 평가 결과 1 건. 본 helper 는 `volume` 만 조정하고 나머지 필드는 전사한다.
  result: EvaluationResult;
}

/**
 * abusing detection 신호(`AbuseSignal`)를 소비해 suspected author 의 평가 단위
 * `volume` 을 결정적으로 감점한 새 entries 배열을 반환한다(R-26/R-40 중립화 v1).
 *
 * 조정 규칙(결정적 · 단조 · LLM 무관):
 *   - `signal.byAuthor` 를 author → AuthorAbuseSignal 로 색인한다.
 *   - 각 entry 의 author 가 signal 에 없거나(미매칭) `suspected === false` 면
 *     → volume 무변경(중립 passthrough). 단, 항상 새 객체로 복제해 입력 비변형 보장.
 *   - `suspected === true` author 의 단위 → `adjusted = floor(volume * (1 -
 *     clampedRatio))` 로 감점한다. clampedRatio 는 repetitionRatio 를 [0,1] 로 절하
 *     (비정상 신호 방어). ratio↑ → 감점↑ 단조. ABUSE_VOLUME_PENALTY_FLOOR(0) 하한.
 *
 * 방어(throw 0 layer 정합, 흡수 정책):
 *   - 빈 `entries` → 빈 배열 반환.
 *   - 빈 `signal.byAuthor` → 매칭 0 이므로 전 단위 무변경 복제.
 *   - author 미매칭 → 그 단위 무변경 복제.
 *   - volume 이 이미 0 → 감점 결과도 0(FLOOR 절하), 무변경과 동일.
 *   - 입력 `entries` / 원소 / `result` / `signal` 비변형 — 새 배열 · 새 객체만 반환.
 *
 * throw(명시적 계약 위반만):
 *   - `entries` 가 null/undefined → 한국어 `TypeError`.
 *   - `signal` 이 null/undefined → 한국어 `TypeError`.
 *
 * @param entries 조정 대상 단위 배열(`{ author, result }[]`). 변형하지 않는다.
 * @param signal computeAbuseSignal 산출 abusing 신호. 변형하지 않는다.
 * @returns 같은 길이 · 같은 순서의 새 entries 배열(suspected author volume 감점 반영).
 */
export function applyAbuseSignalToVolume(
  entries: AbuseAdjustEntry[],
  signal: AbuseSignal,
): AbuseAdjustEntry[] {
  if (entries === null || entries === undefined) {
    throw new TypeError("entries 는 null 또는 undefined 일 수 없습니다.");
  }
  if (signal === null || signal === undefined) {
    throw new TypeError("signal 은 null 또는 undefined 일 수 없습니다.");
  }

  // author → suspected/repetitionRatio 색인. signal.byAuthor 가 빈 배열이어도 빈
  // Map 이 되어 전 단위 미매칭(무변경)으로 흡수된다.
  const byAuthor = new Map(signal.byAuthor.map((a) => [a.author, a]));

  return entries.map((entry) => {
    const authorSignal = byAuthor.get(entry.author);
    const nextVolume =
      authorSignal !== undefined && authorSignal.suspected
        ? penalizeVolume(entry.result.volume, authorSignal.repetitionRatio)
        : entry.result.volume;

    // 입력 비변형 — entry 와 result 를 항상 새 객체로 복제한다(volume 만 갱신).
    return {
      author: entry.author,
      result: { ...entry.result, volume: nextVolume },
    };
  });
}

// penalizeVolume — suspected author 단위의 volume 감점 v1 공식(순수). repetitionRatio
// 를 [0,1] 로 절하한 뒤 `floor(volume * (1 - clampedRatio))` 로 감점하고
// ABUSE_VOLUME_PENALTY_FLOOR 하한을 적용한다. ratio↑ → 감점↑ 단조, 결정적.
function penalizeVolume(volume: number, repetitionRatio: number): number {
  // repetitionRatio 가 비유한 / 범위 밖이면 [0,1] 로 방어 절하(detection 정상
  // 산출은 [0,1] 이지만 layer 경계 방어).
  const clampedRatio = clampRatio(repetitionRatio);
  // volume 이 비유한 / 음수면 0 으로 방어(계약상 ≥ 0 정수지만 layer 경계 방어).
  const baseVolume =
    Number.isFinite(volume) && volume > 0 ? Math.floor(volume) : 0;

  const adjusted = Math.floor(baseVolume * (1 - clampedRatio));
  return adjusted > ABUSE_VOLUME_PENALTY_FLOOR
    ? adjusted
    : ABUSE_VOLUME_PENALTY_FLOOR;
}

// clampRatio — 비율을 [0,1] 로 절하한다(비유한 → 0). 감점 단조성과 음수/초과 방어.
function clampRatio(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return 0;
  }
  return ratio >= 1 ? 1 : ratio;
}
