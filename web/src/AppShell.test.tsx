import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AppShell from './AppShell';

// R-112 — P6 composition wiring ①②(T-0378·T-0379) AppShell 검증.
// App.test.tsx / EvaluationGuardBanner.test.tsx 와 동일 패턴: jsdom/@testing-library
// 없이 react-dom/server 의 renderToStaticMarkup 으로 정적 렌더 문자열만 검증해
// dep 표면을 최소화한다 (ADR-0040 §5 게이트). 파일명은 .test.tsx 고정 —
// root jest 의 testRegex (.*\.spec\.ts$) pickup 충돌 회피.
//
// wiring ②(T-0379): AppShell 이 본문에 AuthGate 를 배선하므로, 미인증 초기
// 상태에서는 login placeholder 가 아니라 LoginForm(AuthGate 경유)이 렌더된다.
// view 전환 핸들러(onAuthenticated→setView)는 이벤트 발화가 필요해 정적 렌더로는
// 직접 검증할 수 없어, 미인증 초기 분기(LoginForm 렌더 + 배너 비활성 + 헤더 유지)만 검증한다.

// R-78 평가 진행 중 경고 배너의 식별 토큰 (EvaluationGuardBanner DEFAULT_MESSAGE 와 정합).
const BANNER_TOKEN = '평가가 진행 중';

// SuperAdminSetupForm 의 셋업 제목 식별 토큰 (SuperAdminSetupForm <h2> 와 정합).
const SETUP_TITLE = 'SuperAdmin 초기 셋업';

describe('AppShell', () => {
  // happy-path — 레이아웃 골격 (전역 제목 식별 토큰) 을 포함하고 빈 출력이 아니다.
  it('레이아웃 골격과 전역 제목 식별 토큰을 렌더한다 (happy-path)', () => {
    const html = renderToStaticMarkup(<AppShell />);
    expect(html).not.toBe('');
    expect(html).toContain('Assessment-Agent');
    expect(html).toContain('app-shell-header');
    expect(html).toContain('app-shell-main');
  });

  // flow/branch — 미인증 초기 상태에서 본문에 AuthGate 경유 LoginForm(사용자명·
  // 비밀번호 입력 + 로그인 버튼 식별 토큰)이 배선되어 렌더된다.
  it('미인증 초기 상태에서 AuthGate 경유 LoginForm 을 본문에 배선해 렌더한다 (flow/branch — 미인증 분기)', () => {
    const html = renderToStaticMarkup(<AppShell />);
    expect(html).toContain('사용자명');
    expect(html).toContain('비밀번호');
    expect(html).toContain('name="username"');
    expect(html).toContain('type="password"');
    expect(html).toContain('로그인');
  });

  // negative — 미인증 초기 상태에서는 인증 후 view placeholder 문구가 렌더되지 않는다
  // (AuthGate 의 children 슬롯은 인증 전까지 렌더 안 됨).
  it('미인증 초기 상태에서 인증 후 view(대시보드·Admin·SuperAdmin) placeholder 를 렌더하지 않는다 (negative — 인증 전 슬롯 미렌더)', () => {
    const html = renderToStaticMarkup(<AppShell />);
    expect(html).not.toContain('대시보드 화면');
    expect(html).not.toContain('Admin 화면');
    expect(html).not.toContain('SuperAdmin 셋업 화면');
  });

  // negative — 초기 evaluationInProgress=false 라 R-78 배너 문구가 렌더되지 않는다
  // (배너 슬롯이 active=false 를 내려 null 반환). AuthGate 의 LoginForm 도 error
  // 없는 초기 상태라 role="alert" 가 없어야 한다(배너·에러 모두 비활성).
  it('초기 상태에서 R-78 평가 진행 중 배너 문구와 alert 영역을 렌더하지 않는다 (negative — 배너·에러 비활성)', () => {
    const html = renderToStaticMarkup(<AppShell />);
    expect(html).not.toContain(BANNER_TOKEN);
    expect(html).not.toContain('role="alert"');
  });

  // wiring ⑥ flow/branch — initialView='superadmin-setup' 주입 시 setup 분기에서
  // SuperAdminSetupForm(셋업 제목 + 셋업 입력/버튼)이 배선되어 렌더된다.
  it("initialView='superadmin-setup' 주입 시 SuperAdminSetupForm 을 본문에 배선해 렌더한다 (flow/branch — setup 분기)", () => {
    const html = renderToStaticMarkup(<AppShell initialView="superadmin-setup" />);
    expect(html).toContain(SETUP_TITLE);
    expect(html).toContain('name="username"');
    expect(html).toContain('type="password"');
    expect(html).toContain('SuperAdmin 지정');
  });

  // wiring ⑥ negative — setup 모드와 login 모드 동시 렌더 금지. setup 화면에는
  // LoginForm 의 로그인 버튼·setup 진입 트리거가 없어야 한다(상호배타).
  it('setup 모드에서 LoginForm(로그인 버튼)·setup 진입 트리거를 동시 렌더하지 않는다 (negative — setup↔login 상호배타)', () => {
    const html = renderToStaticMarkup(<AppShell initialView="superadmin-setup" />);
    expect(html).toContain(SETUP_TITLE);
    // 로그인 분기(AuthGate→LoginForm)의 식별 토큰 부재 — LoginForm 미렌더.
    expect(html).not.toContain('로그인');
    // setup 진입 트리거(초기 셋업 버튼)도 setup 모드에서는 노출 안 함(중복 진입 방지).
    expect(html).not.toContain('enter-setup');
  });

  // wiring ⑥ negative — login 모드에서는 셋업 폼 제목이 부재하고, 대신 setup 진입
  // 트리거가 노출된다(상호배타의 반대 방향).
  it('login 모드에서 셋업 폼 제목은 부재하고 setup 진입 트리거만 노출한다 (negative — login↔setup 상호배타)', () => {
    const html = renderToStaticMarkup(<AppShell />);
    expect(html).not.toContain(SETUP_TITLE);
    // 미인증 로그인 화면에는 setup 진입 트리거가 노출된다.
    expect(html).toContain('enter-setup');
    expect(html).toContain('초기 셋업');
  });

  // wiring ⑥ negative — setup error 가 주입되면 SuperAdminSetupForm 의 error props
  // 로 안전 표시된다(role="alert", throw 없음).
  it('initialSetupError 주입 시 setup 폼이 alert 영역으로 안전 표시한다 (negative — setup error 안전 표시)', () => {
    const html = renderToStaticMarkup(
      <AppShell initialView="superadmin-setup" initialSetupError="셋업 실패" />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('셋업 실패');
  });
});
