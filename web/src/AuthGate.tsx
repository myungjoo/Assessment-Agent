// 인증 게이트 — P6 composition wiring ② (T-0379, ADR-0041 Decision 1·2·3).
// AppShell → 인증 게이트 → 화면 컨테이너 위계 중 "인증 게이트" 레벨이다.
// controlled lift-up (ADR-0041 Decision 1): 인증 여부·입력값(username/password)·
// loading/error 상태를 본 컴포넌트가 useState 로 소유하고, presentational 인
// LoginForm 은 props 로만 소비한다 (LoginForm 수정 0).
//
// 실 인증 요청(POST /api/auth/login)·401→refresh→retry·JWT cookie 흐름은
// 후속 slice ②b 의 책임이라 (Out of Scope) 본 slice 는 제출을 주입된 onLogin
// 콜백 prop 으로 위임한다 — zero-new-dep · testable(콜백 mock) · cap 준수.
// 새 dependency 0 — react 만 사용한다 (ADR-0040 §5 게이트).

import { useState } from 'react';
import type { ReactNode } from 'react';
import LoginForm from './components/LoginForm';

interface AuthGateProps {
  // 로그인 제출 위임 콜백 — username/password 를 받아 성공 여부를 Promise<boolean>
  // 로 반환한다. 실 fetch(POST /api/auth/login) 는 본 콜백 안(②b)에 캡슐화되며,
  // 본 게이트는 결과(true=성공)에 따라 authenticated 전환 또는 error 설정만 한다.
  onLogin: (username: string, password: string) => Promise<boolean>;
  // 인증 성공 시 상위(AppShell)의 view 전환을 트리거하는 콜백.
  onAuthenticated: () => void;
  // 인증 완료 시 렌더할 화면 컨테이너 슬롯 — 실 조립은 후속 slice ③~④ 책임.
  // 본 slice 는 children pass-through(인증 후 슬롯)만 담당한다.
  children?: ReactNode;
  // 초기 인증 여부 — 기본 false(미인증). renderToStaticMarkup 은 이벤트를
  // 발화하지 않아 상태 전환 핸들러를 직접 호출할 수 없으므로, 인증 분기를
  // 정적 렌더로 검증할 수 있도록 초기값 주입을 허용한다(테스트 가능성).
  initialAuthenticated?: boolean;
  // 초기 에러 문구 — 기본 미설정. 마찬가지로 error 전달 경로를 정적 렌더로
  // 검증할 수 있도록 초기값 주입을 허용한다.
  initialError?: string;
}

// 인증 게이트. 미인증이면 LoginForm 을 controlled props 로 배선해 렌더하고,
// 인증되면 children(인증 후 슬롯)을 렌더한다.
function AuthGate({
  onLogin,
  onAuthenticated,
  children,
  initialAuthenticated = false,
  initialError,
}: AuthGateProps) {
  // 인증 여부 상태 — controlled lift-up(ADR-0041 Decision 1).
  const [authenticated, setAuthenticated] = useState<boolean>(
    initialAuthenticated,
  );
  // LoginForm 의 controlled 입력 상태 — 상위가 소유한다.
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  // 인증 진행 중 플래그 — 제출 동안 true 로 두어 중복 제출을 막는다(LoginForm 의
  // loading 우선 정책에 위임).
  const [loading, setLoading] = useState<boolean>(false);
  // 인증 실패 등 에러 문구 — truthy 면 LoginForm 의 role="alert" 에 외화된다.
  const [error, setError] = useState<string | undefined>(initialError);

  // 로그인 제출 핸들러 — 주입된 onLogin 콜백에 위임하고 결과에 따라 분기한다.
  // 성공: authenticated 전환 + onAuthenticated(상위 view 전환) 트리거.
  // 실패: error 설정(미인증 유지). 콜백이 throw 하면 동일하게 error 처리한다.
  const handleSubmit = async () => {
    setLoading(true);
    setError(undefined);
    try {
      const ok = await onLogin(username, password);
      if (ok) {
        setAuthenticated(true);
        onAuthenticated();
      } else {
        setError('자격 증명이 올바르지 않습니다.');
      }
    } catch {
      // 콜백(②b fetch) 실패 — 네트워크/예외도 사용자에게 에러로 외화한다.
      setError('로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 인증 분기 — 인증되면 인증 후 슬롯(children)을 렌더하고 LoginForm 은 렌더하지
  // 않는다. 미인증이면 LoginForm 을 controlled props 로 배선해 렌더한다.
  if (authenticated) {
    return <>{children}</>;
  }

  return (
    <LoginForm
      username={username}
      password={password}
      onUsernameChange={setUsername}
      onPasswordChange={setPassword}
      onSubmit={handleSubmit}
      loading={loading}
      error={error}
    />
  );
}

export type { AuthGateProps };
export default AuthGate;
