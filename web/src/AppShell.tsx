// 전역 레이아웃 골격 — P6 composition wiring ①②(T-0378·T-0379, ADR-0041 Decision 1·2·4).
// wiring ①(T-0378)은 골격(view enum 상태 + 레이아웃 + R-78 배너 슬롯)을 박제했다.
// wiring ②(T-0379)는 그 위에 인증 게이트(AuthGate) 배선 + 무라우터 view 전환을
// 얹는다: 미인증이면 본문에 LoginForm(AuthGate 경유), 인증 성공 시 onAuthenticated
// 가 view 를 'dashboard' 로 전환한다. 실 fetch hook·화면 컨테이너 조립은 후속
// wiring ②b~⑤ 의 책임이다 (Out of Scope). 새 dependency 0 — react/react-dom 만
// 사용한다 (ADR-0040 §5 게이트, ADR-0041 Decision 2 무라우터 view 전환).

import { useState } from 'react';
import EvaluationGuardBanner from './components/EvaluationGuardBanner';
import AuthGate from './AuthGate';

// 무라우터 view 전환 (ADR-0041 Decision 2) — view enum 으로 추상화해 두면
// 후일 react-router 전환 시 교체 표면이 AppShell 한 곳에 국한된다.
type View = 'login' | 'dashboard' | 'admin' | 'superadmin-setup';

// 인증 후 기본 view — 로그인 성공 시 전환할 진입 화면.
const DEFAULT_AUTHED_VIEW: View = 'dashboard';

// view 별 본문 식별 문구 — 후속 slice 가 실 화면 컨테이너로 교체한다.
// 본 slice 는 인증 후 view 분기 cover 를 위한 placeholder 텍스트만 둔다.
// 'login' 은 이제 AuthGate(LoginForm)로 대체되므로 placeholder 를 두지 않는다.
const AUTHED_VIEW_LABEL: Record<Exclude<View, 'login'>, string> = {
  dashboard: '대시보드 화면 (후속 slice 에서 조립)',
  admin: 'Admin 화면 (후속 slice 에서 조립)',
  'superadmin-setup': 'SuperAdmin 셋업 화면 (후속 slice 에서 조립)',
};

// 헤더에 표시할 전역 식별 토큰 — App.test/AppShell.test 의 happy-path 단언 기준.
const APP_TITLE = 'Assessment-Agent';

// 인증 제출 위임 콜백의 placeholder — 실 POST /api/auth/login 호출은 후속 slice
// ②b 가 fetch hook 으로 구현해 주입한다 (Out of Scope). 본 slice 는 콜백
// 인터페이스만 충족하는 기본 구현(항상 실패)을 둔다 — fetch hook 미배선 상태.
const defaultOnLogin = async (): Promise<boolean> => false;

// 전역 레이아웃 컴포넌트. view enum 상태와 R-78 평가 진행 중 상태를 보유하고,
// 본문에 AuthGate 를 배선해 미인증 시 LoginForm, 인증 시 view 별 placeholder 를 렌더한다.
function AppShell() {
  // 현재 view 상태 — 초기값 'login' (ADR-0041 Decision 1 인증 게이트 진입점).
  // wiring ②: setView 를 활성화해 인증 성공 시 view 전환을 가능하게 한다.
  const [view, setView] = useState<View>('login');

  // R-78/REQ-042 평가 진행 중 상태 — 초기값 false (ADR-0041 Decision 4).
  // 실 polling / 평가 실행 상태 endpoint 소비는 후속 wiring ⑤ 의 책임이라
  // 본 slice 는 상태를 false 고정 보유 + 배너 슬롯 배선만 한다.
  const [evaluationInProgress] = useState<boolean>(false);

  // 인증 성공 시 view 전환 — 인증 후 기본 view('dashboard')로 무라우터 전환한다.
  const handleAuthenticated = () => {
    setView(DEFAULT_AUTHED_VIEW);
  };

  return (
    <div className="app-shell">
      {/* R-78 배너 슬롯 — 레이아웃 최상단. active=false 면 EvaluationGuardBanner 가 null 반환. */}
      <EvaluationGuardBanner active={evaluationInProgress} />
      <header className="app-shell-header">
        <h1>{APP_TITLE}</h1>
      </header>
      {/* 본문 영역 — AuthGate 가 미인증/인증 분기를 담당한다.
          미인증: LoginForm(AuthGate 경유) 렌더. 인증: 현재 view 별 placeholder 렌더. */}
      <main className="app-shell-main">
        <AuthGate onLogin={defaultOnLogin} onAuthenticated={handleAuthenticated}>
          {/* 인증 후 슬롯 — 'login' 이 아닌 현재 view 의 placeholder 를 렌더한다.
              실 화면 컨테이너 조립은 후속 wiring ③~④ 의 책임이다. */}
          <p>{view === 'login' ? '' : AUTHED_VIEW_LABEL[view]}</p>
        </AuthGate>
      </main>
    </div>
  );
}

export type { View };
export default AppShell;
