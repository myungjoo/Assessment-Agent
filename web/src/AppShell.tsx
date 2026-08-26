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
// 표현하고 새 라우터는 도입하지 않는다(ADR-0041 Decision 1·2). T-1714 는 그 셋업
// 제출 경로의 `signup` 을 `signupDetailed`(사유 보존 계약) 로 교체해, 실패 시 포괄
// 문구 대신 축별 구체 사유를 표시한다(REQ-068 · REQ-069). 새 dependency 0 —
// react/react-dom + 브라우저 표준 fetch 만 사용한다(ADR-0040 §5 게이트).

import { useState } from 'react';
import EvaluationGuardBanner from './components/EvaluationGuardBanner';
import AuthGate from './AuthGate';
import SuperAdminSetupForm from './components/SuperAdminSetupForm';
import DashboardView from './views/DashboardView';
import AdminView from './views/AdminView';
import { login as authLogin, signupDetailed as authSignupDetailed } from './api/auth';
import { formatSignupFailure } from './api/signupError';
import type { SignupFailure } from './api/signupError';

// 무라우터 view 전환 (ADR-0041 Decision 2) — view enum 으로 추상화해 두면
// 후일 react-router 전환 시 교체 표면이 AppShell 한 곳에 국한된다.
type View = 'login' | 'dashboard' | 'admin' | 'superadmin-setup';

// 인증 후 기본 view — 로그인 성공 시 전환할 진입 화면.
const DEFAULT_AUTHED_VIEW: View = 'dashboard';

// 헤더에 표시할 전역 식별 토큰 — App.test/AppShell.test 의 happy-path 단언 기준.
const APP_TITLE = 'Assessment-Agent';

// 셋업 실패 사유 줄들을 하나의 error 문자열로 이을 때 쓰는 구분자 (T-1714).
// SuperAdminSetupForm 의 `error?: string` 제약 때문에 여러 줄을 한 문자열로 합쳐야 하는데,
// 줄바꿈(\n)은 별도 CSS(white-space) 없이는 HTML 에서 접혀 사라진다 — 그 스타일 도입은
// 본 slice Out of Scope 라, 접히지 않는 시각적 구분자를 쓴다. 각 줄의 사유 문장 자체는
// 원문 그대로 보존하며 요약·병합하지 않는다(REQ-068 포괄 문구 금지).
const SETUP_ERROR_SEPARATOR = ' / ';

// 사유를 하나도 얻지 못한 비정상 응답용 fallback (T-1714). 2xx 인데 role 도 failure 도
// 없는 경우가 여기 해당한다 — 없는 사유를 지어내지 않고 상태 불명임을 그대로 알린다.
// 네트워크/5xx catch 문구(SETUP_THROWN_ERROR_MESSAGE)와 어휘가 겹치지 않아야 한다.
const SETUP_UNRESOLVED_MESSAGE =
  '셋업 응답을 해석하지 못했습니다. 계정이 생성되었는지 확인한 뒤 다시 시도해 주세요.';

// 네트워크/5xx 등 throw 경로 문구 — 위 fallback 과 구분 가능해야 한다.
const SETUP_THROWN_ERROR_MESSAGE = '셋업 중 오류가 발생했습니다.';

// signupDetailed 가 준 축별 사유(SignupFailure)를 폼 error 한 줄 문자열로 변환한다 (T-1714).
// 순수 함수로 분리해 named export 하는 이유: web 에 @testing-library/react 가 없어(ADR-0040 §5
// 새-dep 게이트) 상호작용 렌더 test 가 불가하므로, 이 변환 규칙만은 단위로 검증 가능해야 한다.
//  - failure 가 null(사유 미상) 또는 축이 전부 비어 있으면 → SETUP_UNRESOLVED_MESSAGE.
//  - 그 외 → formatSignupFailure 의 줄들을 구분자로 이어 붙인다(각 줄 원문 보존).
export function buildSetupErrorMessage(failure: SignupFailure | null): string {
  if (failure === null) {
    return SETUP_UNRESOLVED_MESSAGE;
  }
  const lines = formatSignupFailure(failure);
  if (lines.length === 0) {
    return SETUP_UNRESOLVED_MESSAGE;
  }
  return lines.join(SETUP_ERROR_SEPARATOR);
}

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

  // 셋업 제출 핸들러 — `signupDetailed`(POST /api/users, T-1713) 에 위임하고 결과에
  // 따라 분기한다. 종전 `signup` wrapper 는 409/400 을 똑같이 null 로 흡수해 "어느 입력이
  // 어떤 조건을 위반했는지" 를 버렸고, 그 자리에 오너가 금지한 포괄 문구가 있었다 —
  // T-1714 가 그 소비 지점을 사유 보존 계약으로 교체한다(REQ-068 · REQ-069).
  //  - role 문자열(특히 'SuperAdmin'): 셋업 성공 → 로그인 화면('login')으로 재진입
  //    (POST /api/users 는 세션 쿠키를 발급하지 않으므로 자동 로그인 연쇄는 Follow-up).
  //  - role null + failure: 중복(409)/검증 실패(400) → 축별 구체 사유를 폼 error 로 표시.
  //  - role null + failure null: 비정상 2xx → 사유를 지어내지 않는 fallback 문구.
  //  - throw: 네트워크/5xx → 위 fallback 과 구분되는 별도 문구로 외화한다.
  const handleSetupSubmit = async () => {
    setSetupLoading(true);
    setSetupError(undefined);
    try {
      const { role, failure } = await authSignupDetailed(setupUsername, setupPassword);
      if (typeof role === 'string') {
        // 셋업 성공 — 로그인 화면으로 재진입(셋업한 자격증명으로 로그인 유도).
        setView('login');
      } else {
        // 실패 — 축별 구체 사유(또는 사유 미상 fallback)를 폼에 표시한다.
        setSetupError(buildSetupErrorMessage(failure));
      }
    } catch {
      // 네트워크/5xx 등 — 사용자에게 에러로 외화한다.
      setSetupError(SETUP_THROWN_ERROR_MESSAGE);
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
