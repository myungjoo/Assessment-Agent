import { describe, expect, it } from 'vitest';
import {
  REQ048_RENDER_MAX_MS,
  assertRenderThreshold,
  measureRenderLatency,
  type RenderLatencySummary,
} from './renderLatency';

// R-112 — measureRenderLatency / assertRenderThreshold / REQ048_RENDER_MAX_MS 세 export
// 심볼 각각에 happy-path · error path · 분기 · negative case 를 붙인다. 시계는 `now`
// 주입으로 결정론화해 CPU 속도에 흔들리지 않게 한다.

/** 호출마다 주어진 시각을 순서대로 돌려주는 결정론적 clock. */
function fakeClock(ticks: number[]): () => number {
  let i = 0;
  return () => ticks[i++];
}

describe('measureRenderLatency', () => {
  it('요청 횟수만큼 표본을 모으고 p50 ≤ p95 ≤ max 요약을 반환한다 (happy-path)', () => {
    let rendered = 0;
    const summary = measureRenderLatency(
      () => {
        rendered += 1;
      },
      3,
      { now: fakeClock([0, 10, 10, 40, 40, 60]) },
    );
    expect(rendered).toBe(3);
    expect(summary.samples).toBe(3);
    expect(summary.p50).toBeLessThanOrEqual(summary.p95);
    expect(summary.p95).toBeLessThanOrEqual(summary.max);
    expect(summary.max).toBe(30);
  });

  it('표본 1 개 분기 — p50 = p95 = max 가 그 표본값이다', () => {
    const summary = measureRenderLatency(() => undefined, 1, {
      now: fakeClock([5, 12]),
    });
    expect(summary).toEqual({ samples: 1, p50: 7, p95: 7, max: 7 });
  });

  it('홀수 표본 분기 — 인덱스가 정수로 떨어져 보간 없이 중앙값을 쓴다', () => {
    const summary = measureRenderLatency(() => undefined, 3, {
      now: fakeClock([0, 10, 0, 20, 0, 30]),
    });
    expect(summary.p50).toBe(20);
    expect(summary.p95).toBeCloseTo(29, 10);
  });

  it('짝수 표본 분기 — 인덱스가 분수라 선형 보간한다', () => {
    const summary = measureRenderLatency(() => undefined, 2, {
      now: fakeClock([0, 10, 0, 20]),
    });
    expect(summary.p50).toBe(15);
    expect(summary.p95).toBeCloseTo(19.5, 10);
  });

  it('render 가 함수가 아니면 TypeError (negative)', () => {
    const bad = undefined as unknown as () => void;
    expect(() => measureRenderLatency(bad, 1)).toThrow(TypeError);
  });

  it.each([
    ['0', 0],
    ['음수', -1],
    ['비정수', 1.5],
    ['NaN', Number.NaN],
  ])('iterations 가 %s 이면 RangeError (negative)', (_label, iterations) => {
    expect(() => measureRenderLatency(() => undefined, iterations)).toThrow(
      RangeError,
    );
  });

  it('render thunk 의 예외를 삼키지 않고 그대로 전파한다 (negative)', () => {
    const boom = () => {
      throw new Error('렌더 실패');
    };
    expect(() => measureRenderLatency(boom, 2)).toThrow('렌더 실패');
  });

  it('now 를 주입하지 않으면 실제 performance.now 로 측정한다 (기본값 분기)', () => {
    const summary = measureRenderLatency(() => undefined, 2);
    expect(summary.samples).toBe(2);
    expect(summary.max).toBeGreaterThanOrEqual(0);
  });
});

describe('assertRenderThreshold', () => {
  const ok: RenderLatencySummary = { samples: 5, p50: 4, p95: 9, max: 11 };

  it('임계 이내면 pass=true 이고 사유가 비어 있다 (happy-path · 기본 임계 분기)', () => {
    expect(assertRenderThreshold(ok)).toEqual({ pass: true, reason: '' });
    expect(REQ048_RENDER_MAX_MS).toBe(3000);
  });

  it('명시 임계 인자를 넘기면 그 값으로 판정한다 (인자 전달 분기)', () => {
    expect(assertRenderThreshold(ok, 10).pass).toBe(true);
    expect(assertRenderThreshold(ok, 5).pass).toBe(false);
  });

  it('임계 초과면 pass=false 이고 사유에 REQ-048 과 실측 수치가 담긴다 (negative ①)', () => {
    const over = { samples: 3, p50: 3200, p95: 4200, max: 4300 };
    const verdict = assertRenderThreshold(over);
    expect(verdict.pass).toBe(false);
    expect(verdict.reason).toContain('REQ-048');
    expect(verdict.reason).toContain('4200');
    expect(verdict.reason).toContain('3000');
  });

  it('표본 0 개 요약은 측정 불가로 pass=false (negative ②)', () => {
    const nan = Number.NaN;
    const verdict = assertRenderThreshold({ samples: 0, p50: nan, p95: nan, max: nan });
    expect(verdict.pass).toBe(false);
    expect(verdict.reason).toContain('표본 0 개');
  });

  it.each([
    ['NaN', Number.NaN],
    ['0', 0],
    ['음수', -1],
  ])('임계 인자가 %s 이면 RangeError (negative ③)', (_label, maxMs) => {
    expect(() => assertRenderThreshold(ok, maxMs)).toThrow(RangeError);
  });

  it('요약 필드가 누락되거나 null 이면 TypeError (negative ④)', () => {
    const partial = { samples: 1 } as unknown as RenderLatencySummary;
    const nothing = null as unknown as RenderLatencySummary;
    expect(() => assertRenderThreshold(partial)).toThrow(TypeError);
    expect(() => assertRenderThreshold(nothing)).toThrow(TypeError);
  });
});
