import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import App from '../App';
import {
  REQ048_RENDER_MAX_MS,
  assertRenderThreshold,
  measureRenderLatency,
} from './renderLatency';

// REQ-048 시각화 축의 첫 소비처 (T-1993). helper 단독 PR 이 되지 않도록 실제 `App` 렌더
// 소요를 재고 절대 임계 판정을 단언한다. jsdom/@testing-library 없이 react-dom/server
// 정적 렌더만 쓰며(App.test.tsx 관행), 파일명은 root jest testRegex 충돌 회피로 .test.tsx.
//
// 측정 한계 — 본 측정은 React SSR markup 생성 시간만 재며 브라우저 layout · paint · 네트워크 ·
// 데이터 로딩은 포함하지 않는다. 따라서 REQ-048 시각화 축의 *첫 측정 도입* 이지 축 완결이 아니다.
describe('App 렌더 latency (REQ-048 시각화 축)', () => {
  const ITERATIONS = 5;

  it(`renderToStaticMarkup(<App />) 의 p95 가 ${REQ048_RENDER_MAX_MS}ms 절대 임계 이내다`, () => {
    let lastHtml = '';
    const summary = measureRenderLatency(() => {
      lastHtml = renderToStaticMarkup(<App />);
    }, ITERATIONS);

    // "0ms 로 통과하는 빈 렌더" 배제 — 실제 markup 이 나왔는지 함께 단언한다.
    expect(lastHtml).not.toBe('');
    expect(lastHtml).toContain('app-shell-header');

    expect(summary.samples).toBe(ITERATIONS);
    const verdict = assertRenderThreshold(summary);
    expect(verdict.reason).toBe('');
    expect(verdict.pass).toBe(true);
  });
});
