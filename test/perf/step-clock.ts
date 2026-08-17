/**
 * perf-spec 측정 표본 결정론화용 **주입 monotonic clock** 공유 helper
 * (REQ-048, ADR-0056 §Decision 3 (b) · §Follow-ups (b)).
 *
 * T-0881 이 `latency-collector.spec.ts` 에서 확정한 `stepClock` 관용구가 measure→confirm 계열
 * perf-spec 으로 확산되며 본문 byte-identical 인 복제본으로 갈라졌고, reviewer 가 T-1579 ·
 * T-1580 2 회 연속 MINOR 로 지적했다. 본 모듈은 그 관용구 **하나만** 승격한다.
 *
 * **신규 판정 로직 0** — 측정 · 판정 · 경로 · 로그는 종전대로 전량 기존 모듈(`latency-collector`
 * · `latency-baseline*`) 위임이고, 본 모듈은 `MeasureBaselineOpts.now` 에 넣을 순수 함수만
 * 제공한다. 전역 상태 · `Date.now` 접근 · fs 접근이 0 이며 인스턴스마다 상태가 독립이다.
 */

/**
 * 호출 쌍(start/end)마다 `stepMs` 만큼 전진하는 결정론적 monotonic clock 을 만든다.
 *
 * `measureBaselineCandidate` 의 `now` 주입 계약(홀수번째 호출 = 구간 시작, 짝수번째 호출 =
 * 구간 끝)에 맞춰 **홀수번째 호출은 현재 값을 그대로**, **짝수번째 호출은 `stepMs` 만큼 전진한
 * 값** 을 낸다. 예: `createStepClock(5)` 의 연속 호출 → `[0, 5, 5, 10, 10, 15]`. 따라서 매 구간의
 * 계측 폭이 정확히 `stepMs` 로 고정돼 실 HTTP · DB 왕복 지연이 섞여도 표본이 결정론적이다.
 *
 * 반환 clock 은 인자를 받지 않으며(넘겨도 무시), 값은 **비감소** 로만 진행한다. 검증은 전부
 * clock 생성 **전에** 끝나므로 예외 국면에서는 clock 이 만들어지지 않는다(부작용 0).
 *
 * @param stepMs 구간당 전진 폭(ms). `0` 이면 모든 표본이 같은 값(비감소 유지)이다.
 * @throws {TypeError} `stepMs` 가 non-number(string · undefined · null · boolean · object ·
 *   배열 등)일 때.
 * @throws {RangeError} `stepMs` 가 비유한(NaN · ±Infinity)이거나 음수(monotonic 위배)일 때.
 */
export function createStepClock(stepMs: number): () => number {
  if (typeof stepMs !== "number") {
    throw new TypeError(
      `createStepClock: stepMs 는 number 여야 함 (받은 타입: ${typeof stepMs})`,
    );
  }
  if (!Number.isFinite(stepMs)) {
    throw new RangeError(
      `createStepClock: stepMs 는 유한한 값이어야 함 (받은 값: ${stepMs})`,
    );
  }
  if (stepMs < 0) {
    throw new RangeError(
      `createStepClock: stepMs 는 음수일 수 없음 (받은 값: ${stepMs})`,
    );
  }
  let t = 0;
  let call = 0;
  return () => {
    const v = t;
    call += 1;
    if (call % 2 === 1) {
      return v;
    }
    t += stepMs;
    return t;
  };
}
