import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import App from './App';

// R-112 — App 은 AppShell 을 렌더하는 thin wrapper (T-0378, ADR-0041 wiring ①).
// jsdom/@testing-library 없이 react-dom/server 의 정적 렌더 문자열만 검증해
// dep 표면을 최소화한다 (ADR-0040 §5 게이트). 파일명은 .test.tsx 고정 —
// root jest 의 testRegex (.*\.spec\.ts$) pickup 충돌 회피.
describe('App', () => {
  it('AppShell 의 식별 토큰을 렌더한다 (happy-path)', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('Assessment-Agent');
    expect(html).toContain('app-shell-header');
  });

  it('렌더 결과가 빈 문자열이 아니다 (negative — 빈 출력 회귀 방지)', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).not.toBe('');
  });

  it('제거된 placeholder 문구("P6 frontend scaffold") 를 렌더하지 않는다 (negative)', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).not.toContain('P6 frontend scaffold');
  });
});
