import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import App from './App';

// R-112 — App 은 분기 없는 정적 컴포넌트라 flow/branch 테스트는 해당 없음
// (T-0353 Acceptance Criteria 본문 명시로 생략). jsdom 없이 react-dom/server
// 의 정적 렌더 문자열만 검증해 dep 표면을 최소화한다 (ADR-0040 §5 게이트 —
// jsdom/@testing-library 도입은 후속 slice 의 별도 승인 대상).
// 파일명은 .test.tsx 고정 — root jest 의 testRegex (.*\.spec\.ts$) pickup
// 충돌 회피 (T-0353 Acceptance Criteria).
describe('App', () => {
  it('placeholder 제목 "Assessment-Agent" 를 렌더한다 (happy-path)', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('Assessment-Agent');
  });

  it('렌더 결과가 빈 문자열이 아니다 (negative — 빈 출력 회귀 방지)', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).not.toBe('');
  });

  it('미구현 화면 문구 (로그인·대시보드) 를 렌더하지 않는다 (negative)', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).not.toContain('로그인');
    expect(html).not.toContain('대시보드');
  });
});
