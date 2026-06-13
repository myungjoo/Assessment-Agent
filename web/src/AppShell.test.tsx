import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AppShell from './AppShell';

// R-112 — P6 composition wiring ① AppShell 골격 검증 (T-0378).
// App.test.tsx / EvaluationGuardBanner.test.tsx 와 동일 패턴: jsdom/@testing-library
// 없이 react-dom/server 의 renderToStaticMarkup 으로 정적 렌더 문자열만 검증해
// dep 표면을 최소화한다 (ADR-0040 §5 게이트). 파일명은 .test.tsx 고정 —
// root jest 의 testRegex (.*\.spec\.ts$) pickup 충돌 회피.
// view 전환 핸들러는 본 slice 에서 미노출 (후속 wiring ② 책임) 이라
// flow/branch 는 초기 view ('login') 분기만 검증한다.

// R-78 평가 진행 중 경고 배너의 식별 토큰 (EvaluationGuardBanner DEFAULT_MESSAGE 와 정합).
const BANNER_TOKEN = '평가가 진행 중';

describe('AppShell', () => {
  // happy-path — 레이아웃 골격 (전역 제목 식별 토큰) 을 포함하고 빈 출력이 아니다.
  it('레이아웃 골격과 전역 제목 식별 토큰을 렌더한다 (happy-path)', () => {
    const html = renderToStaticMarkup(<AppShell />);
    expect(html).not.toBe('');
    expect(html).toContain('Assessment-Agent');
    expect(html).toContain('app-shell-header');
    expect(html).toContain('app-shell-main');
  });

  // flow/branch — 초기 view 는 'login' 이라 로그인 화면 placeholder 만 렌더된다.
  it('초기 view(login) 의 placeholder 문구를 렌더한다 (flow/branch — 초기 view 분기)', () => {
    const html = renderToStaticMarkup(<AppShell />);
    expect(html).toContain('로그인 화면');
  });

  // negative — 초기 view(login) 가 아닌 다른 view 의 placeholder 문구는 렌더되지 않는다.
  it('초기 view 에서 다른 view(대시보드·Admin·SuperAdmin) placeholder 를 렌더하지 않는다 (negative — view 분기)', () => {
    const html = renderToStaticMarkup(<AppShell />);
    expect(html).not.toContain('대시보드 화면');
    expect(html).not.toContain('Admin 화면');
    expect(html).not.toContain('SuperAdmin 셋업 화면');
  });

  // negative — 초기 evaluationInProgress=false 라 R-78 배너 문구가 렌더되지 않는다
  // (배너 슬롯이 active=false 를 내려 null 반환).
  it('초기 상태에서 R-78 평가 진행 중 배너 문구를 렌더하지 않는다 (negative — 배너 비활성)', () => {
    const html = renderToStaticMarkup(<AppShell />);
    expect(html).not.toContain(BANNER_TOKEN);
    expect(html).not.toContain('role="alert"');
  });
});
