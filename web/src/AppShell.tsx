// 전역 레이아웃 골격 — P6 composition wiring ①②②b⑥ (T-0378·T-0379·T-0380·T-0394,
// ADR-0041 Decision 1·2·3·4).
// wiring ①(T-0378)은 골격(view enum 상태 + 레이아웃 + R-78 배너 슬롯)을 박제했다.
// wiring ②(T-0379)는 그 위에 인증 게이트(AuthGate) 배선 + 무라우터 view 전환을
// 얹었다: 미인증이면 본문에 LoginForm(AuthGate 경유), 인증 성공 시 onAuthenticated
// 가 view 를 'dashboard' 로 전환한다.
// wiring ②b(T-0380)는 인증 게이트의 `onLogin` 콜백에 실 `auth.login` (POST
// /api/auth/login + 401→refresh→retry, apiClient 경유) 을 주입한다.
// wiring ⑥(T-0394)는 마지막 placeholder('superadmin-setup')를 실 SuperAdminSetupForm
// 으로 교체하고 `signup`(POST /api/users 첫-user→SuperAdmin) helper 를 주입한다 —
// 본 slice 의 변경점. setup 모드는 미인증 단계라 AuthGate(로그인) 와 상호배타로
// 렌더한다(둘 다 동시 렌더 금지). setup↔login 전환은 주입형 controlled lift-up 으로
// 표현하고 새 라우터는 도입하지 않는다(ADR-0041 Decision 1·2). 새 dependency 0 —
// react/react-dom + 브라우저 표준 fetch 만 사용한다(ADR-0040 §5 게이트).

import { useState } from 'react';
import EvaluationGuardBanner from './components/EvaluationGuardBanner';
import AuthGate from './AuthGate';
import SuperAdminSetupForm from './components/SuperAdminSetupForm';
import DashboardView from './views/DashboardView';
import AdminView from './views/AdminView';
import { login as authLogin, signup as authSignup } from './api/auth';

// 무라우터 view 전환 (ADR-0041 Decision 2) — view enum 으로 추상화해 두면
// 후일 react-router 전환 시 교체 표면이 AppShell 한 곳에 국한된다.
type View = 'login' | 'dashboard' | 'admin' | 'superadmin-setup';

// 인증 후 기본 view — 로그인 성공 시 전환할 진입 화면.
const DEFAULT_AUTHED_VIEW: View = 'dashboard';

// 헤더에 표시할 전역 식별 토큰 — App.test/AppShell.test 의 happy-path 단언 기준.
const APP_TITLE = 'Assessment-Agent';

// 인증 제출 위임 콜백 — wiring ②b(T-0380) 가 실 `auth.login` 을 주입한다.
// `auth.login(username, password)` 가 `POST /api/auth/login` 호출 + 401 시 false
// 반환을 담당하므로 본 모듈은 그대로 위임만 한다 (AuthGate.onLogin signature 와 정합).
const onLogin = authLogin;

interface AppShellProps {
  // 초기 view — 기본 'login'(미인증 진입점). renderToStaticMarkup 은 이벤트를
  // 발화하지 않아 setView 핸들러를 직접 호출할 수 없으므로, setup 분기를 정적
  // 렌더로 검증할 수 있도록 초기값 주입을 허용한다(테스트 가능성, AuthGate 의
  // initialAuthenticated 주입 패턴과 동형 — ADR-0041 Decision 1).
  initialView?: View;
  // setup 폼 초기 에러 문구 — 기본 미설정. error 전달 경로를 정적 렌더로 검증할
  // 수 있도록 초기값 주입을 허용한다.
  initialSetupError?: string;
}

// 전역 레이아웃 컴포넌트. view enum 상태와 R-78 평가 진행 중 상태를 보유하고,
// 미인증 단계의 두 분기(로그인=AuthGate / 초기 셋업=SuperAdminSetupForm)를
// 상호배타로 렌더한다. 인증 후에는 view 별 실 화면 컨테이너를 렌더한다.
function AppShell({ initialView = 'login', initialSetupError }: AppShellProps = {}) {
  // 현재 view 상태 — 초기값 'login' (ADR-0041 Decision 1 인증 게이트 진입점).
  const [view, setView] = useState<View>(initialView);

  // R-78/REQ-042 평가 진행 중 상태 — 초기값 false (ADR-0041 Decision 4).
  // 실 polling / 평가 실행 상태 endpoint 소비는 후속 wiring ⑤ 의 책임이라
  // 본 slice 는 상태를 false 고정 보유 + 배너 슬롯 배선만 한다.
  const [evaluationInProgress] = useState<boolean>(false);

  // SuperAdmin 초기 셋업 폼의 controlled 입력/상태 — AppShell 이 소유한다
  // (controlled lift-up, ADR-0041 Decision 1). presentational SuperAdminSetupForm
  // 은 props 로만 소비한다(컴포넌트 수정 0).
  const [setupUsername, setSetupUsername] = useState<string>('');
  const [setupPassword, setSetupPassword] = useState<string>('');
  const [setupLoading, setSetupLoading] = useState<boolean>(false);
  const [setupError, setSetupError] = useState<string | undefined>(initialSetupError);

  // 인증 성공 시 view 전환 — 인증 후 기본 view('dashboard')로 무라우터 전환한다.
  const handleAuthenticated = () => {
    setView(DEFAULT_AUTHED_VIEW);
  };

  // 미인증 화면에서 초기 셋업 모드로 진입하는 트리거 — login↔setup 전환은 주입형
  // 라우터 없는 controlled 전환이다(ADR-0041 Decision 2). 진입 시 직전 에러를 비운다.
  const enterSetup = () => {
    setSetupError(undefined);
    setView('superadmin-setup');
  };

  // 셋업 제출 핸들러 — 주입된 `signup`(POST /api/users) 에 위임하고 결과에 따라
  // 분기한다. signup 은 성공 시 role 문자열, 중복/검증 실패 시 null 을 반환하고
  // 그 외(네트워크/5xx)는 throw 한다.
  //  - role 반환(특히 'SuperAdmin'): 셋업 성공 → 로그인 화면('login')으로 재진입
  //    (POST /api/users 는 세션 쿠키를 발급하지 않으므로 자동 로그인 연쇄는 Follow-up).
  //  - null 반환: 중복/검증 실패 → SuperAdminSetupForm 의 error props 로 안전 표시.
  //  - throw: 네트워크/서버 오류 → 동일하게 error 로 외화한다.
  const handleSetupSubmit = async () => {
    setSetupLoading(true);
    setSetupError(undefined);
    try {
      const role = await authSignup(setupUsername, setupPassword);
      if (role) {
        // 셋업 성공 — 로그인 화면으로 재진입(셋업한 자격증명으로 로그인 유도).
        setView('login');
      } else {
        // 중복(409) 또는 검증 실패(400) — null 흡수, 에러를 폼에 표시한다.
        setSetupError('이미 등록된 사용자이거나 입력이 올바르지 않습니다.');
      }
    } catch {
      // 네트워크/5xx 등 — 사용자에게 에러로 외화한다.
      setSetupError('셋업 중 오류가 발생했습니다.');
    } finally {
      setSetupLoading(false);
    }
  };

  return (
    <div className="app-shell">
      {/* R-78 배너 슬롯 — 레이아웃 최상단. active=false 면 EvaluationGuardBanner 가 null 반환. */}
      <EvaluationGuardBanner active={evaluationInProgress} />
      <header className="app-shell-header">
        <h1>{APP_TITLE}</h1>
      </header>
      {/* 본문 영역 — 미인증 단계는 setup 분기(SuperAdminSetupForm)와 로그인 분기
          (AuthGate)를 상호배타로 렌더한다(둘 다 동시 렌더 금지). 인증 후 슬롯은
          AuthGate children 의 view 분기가 담당한다. */}
      <main className="app-shell-main">
        {view === 'superadmin-setup' ? (
          // 초기 셋업 분기 — controlled props 로 SuperAdminSetupForm 을 배선한다.
          // AuthGate(LoginForm)는 렌더하지 않아 setup↔login 상호배타를 보장한다.
          <SuperAdminSetupForm
            username={setupUsername}
            password={setupPassword}
            onUsernameChange={setSetupUsername}
            onPasswordChange={setSetupPassword}
            onSubmit={handleSetupSubmit}
            loading={setupLoading}
            error={setupError}
          />
        ) : (
          // 로그인 분기 — AuthGate 가 미인증/인증을 담당한다. 미인증: LoginForm,
          // 인증: children(view 별 실 컨테이너). setup 진입 트리거(enterSetup)를
          // 미인증 화면에 controlled 콜백으로 노출한다(새 라우터 0).
          <AuthGate onLogin={onLogin} onAuthenticated={handleAuthenticated}>
            {/* 인증 후 슬롯 — view 분기. 'dashboard' 는 DashboardView(wiring ③a),
                'admin' 은 AdminView(wiring ④a)를 렌더한다('login' 은 AuthGate 가
                LoginForm 으로 처리, 'superadmin-setup' 은 위 상호배타 분기에서 처리). */}
            {view === 'dashboard' ? (
              <DashboardView />
            ) : view === 'admin' ? (
              <AdminView />
            ) : null}
          </AuthGate>
        )}
        {/* 미인증 로그인 화면에서 초기 셋업 모드로 전환하는 트리거 — 첫 부트스트랩
            시 SuperAdmin 계정을 지정하는 controlled 진입점. setup 모드일 때는
            노출하지 않는다(중복 진입 방지). */}
        {view === 'login' ? (
          <button type="button" className="enter-setup" onClick={enterSetup}>
            초기 셋업
          </button>
        ) : null}
      </main>
    </div>
  );
}

export type { View, AppShellProps };
export default AppShell;
