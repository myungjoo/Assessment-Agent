// 전역 레이아웃 골격 — P6 composition wiring ① (T-0378, ADR-0041 Decision 1·2·4).
// 본 slice 는 골격만 담는다: view enum 상태 + 레이아웃 (헤더/본문) + R-78 배너 슬롯.
// 실 인증 게이트 분기·LoginForm 배선·fetch hook·화면 컨테이너 조립은
// 후속 wiring ②~⑤ 의 책임이다 (Out of Scope). 새 dependency 0 —
// react/react-dom 만 사용한다 (ADR-0040 §5 게이트, ADR-0041 Decision 2 무라우터 view 전환).

import { useState } from 'react';
import EvaluationGuardBanner from './components/EvaluationGuardBanner';

// 무라우터 view 전환 (ADR-0041 Decision 2) — view enum 으로 추상화해 두면
// 후일 react-router 전환 시 교체 표면이 AppShell 한 곳에 국한된다.
type View = 'login' | 'dashboard' | 'admin' | 'superadmin-setup';

// view 별 본문 식별 문구 — 후속 slice 가 실 화면 컨테이너로 교체한다.
// 본 slice 는 view 분기 cover 를 위한 placeholder 텍스트만 둔다.
const VIEW_LABEL: Record<View, string> = {
  login: '로그인 화면 (후속 slice 에서 LoginForm 배선)',
  dashboard: '대시보드 화면 (후속 slice 에서 조립)',
  admin: 'Admin 화면 (후속 slice 에서 조립)',
  'superadmin-setup': 'SuperAdmin 셋업 화면 (후속 slice 에서 조립)',
};

// 헤더에 표시할 전역 식별 토큰 — App.test/AppShell.test 의 happy-path 단언 기준.
const APP_TITLE = 'Assessment-Agent';

// 전역 레이아웃 컴포넌트. view enum 상태와 R-78 평가 진행 중 상태를 보유하고,
// R-78 배너 슬롯에 EvaluationGuardBanner 를 props 배선만 한다 (컴포넌트 수정 0).
function AppShell() {
  // 현재 view 상태 — 초기값 'login' (ADR-0041 Decision 1 인증 게이트 진입점).
  // 실 view 전환 핸들러 노출은 후속 wiring ② 의 책임이라 본 slice 는 상태만 보유한다.
  const [view] = useState<View>('login');

  // R-78/REQ-042 평가 진행 중 상태 — 초기값 false (ADR-0041 Decision 4).
  // 실 polling / 평가 실행 상태 endpoint 소비는 후속 wiring ⑤ 의 책임이라
  // 본 slice 는 상태를 false 고정 보유 + 배너 슬롯 배선만 한다.
  const [evaluationInProgress] = useState<boolean>(false);

  return (
    <div className="app-shell">
      {/* R-78 배너 슬롯 — 레이아웃 최상단. active=false 면 EvaluationGuardBanner 가 null 반환. */}
      <EvaluationGuardBanner active={evaluationInProgress} />
      <header className="app-shell-header">
        <h1>{APP_TITLE}</h1>
      </header>
      {/* 본문 영역 — 현재 view 만 조건부 렌더 (다른 view placeholder 는 렌더 안 됨). */}
      <main className="app-shell-main">
        <p>{VIEW_LABEL[view]}</p>
      </main>
    </div>
  );
}

export type { View };
export default AppShell;
