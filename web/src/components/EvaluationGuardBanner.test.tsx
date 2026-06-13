import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import EvaluationGuardBanner from './EvaluationGuardBanner';

// R-112 — R-78 평가 진행 중 경고 배너 컴포넌트(ADR-0040 §6) 검증.
// App.test.tsx 와 동일 패턴: jsdom/@testing-library 없이 react-dom/server 의
// renderToStaticMarkup 으로 정적 렌더 문자열만 검증해 dep 표면을 최소화한다
// (ADR-0040 §5 게이트). 파일명은 .test.tsx 고정 — root jest 의
// testRegex (.*\.spec\.ts$) pickup 충돌 회피 (T-0361 Acceptance Criteria).

// 기본 한국어 경고 문구의 식별 토큰 (구현의 DEFAULT_MESSAGE 와 정합).
const DEFAULT_TOKEN = '평가가 진행 중';

describe('EvaluationGuardBanner', () => {
  // happy-path — active=true 면 기본 경고 문구 + role="alert" 를 렌더한다.
  it('active=true 면 기본 경고 문구와 role="alert" 를 렌더한다 (happy-path)', () => {
    const html = renderToStaticMarkup(<EvaluationGuardBanner active={true} />);
    expect(html).toContain(DEFAULT_TOKEN);
    expect(html).toContain('role="alert"');
  });

  // flow/branch — active=false 분기는 null 반환이라 빈 문자열로 렌더된다.
  it('active=false 면 빈 문자열을 렌더한다 (negative — 자료 화면 미차단)', () => {
    const html = renderToStaticMarkup(<EvaluationGuardBanner active={false} />);
    expect(html).toBe('');
  });

  // negative — active=false 면 message 가 주어져도 배너를 렌더하지 않는다.
  it('active=false 면 message 가 있어도 빈 문자열을 렌더한다 (negative — 분기 우선)', () => {
    const html = renderToStaticMarkup(
      <EvaluationGuardBanner active={false} message="무시되어야 할 문구" />,
    );
    expect(html).toBe('');
    expect(html).not.toContain('무시되어야 할 문구');
  });

  // negative/override — custom message 가 있으면 기본 문구 대신 custom 문구를 렌더한다.
  it('active=true + custom message 면 기본 문구 대신 custom 문구를 렌더한다 (negative — override)', () => {
    const custom = '시스템 점검으로 일부 자료가 지연됩니다.';
    const html = renderToStaticMarkup(
      <EvaluationGuardBanner active={true} message={custom} />,
    );
    expect(html).toContain(custom);
    expect(html).not.toContain(DEFAULT_TOKEN);
    expect(html).toContain('role="alert"');
  });

  // negative/edge — 빈 문자열 message 는 기본 문구로 fallback (의미 없는 빈 배너 방지 정책).
  it('active=true + 빈 문자열 message 면 기본 문구로 fallback 한다 (negative — 경계값)', () => {
    const html = renderToStaticMarkup(
      <EvaluationGuardBanner active={true} message="" />,
    );
    expect(html).toContain(DEFAULT_TOKEN);
    expect(html).toContain('role="alert"');
  });
});
