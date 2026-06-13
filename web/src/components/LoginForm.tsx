// R-84 (Auth/RBAC) frontend 진입점 — 로그인 입력 폼 (ADR-0040 §2 인증 흐름).
// 본 컴포넌트는 입력값·콜백·error/loading 플래그를 props 로만 받는 순수
// presentational controlled component 다 — 실제 인증 요청(POST /api/auth/login)·
// 세션/토큰 저장·로그인 성공 후 라우팅·전역 상태 배선은 후속 slice 책임
// (Out of Scope). 직전 slice(EvaluationGuardBanner) 와 동일한 props/분기/
// named·default export convention 을 차용한다.

interface LoginFormProps {
  // 사용자명 입력값 — controlled component 라 상위가 상태를 보유한다.
  username: string;
  // 비밀번호 입력값 — controlled component 라 상위가 상태를 보유한다.
  password: string;
  // 사용자명 변경 콜백 — 입력 이벤트마다 새 값을 상위로 전달한다.
  onUsernameChange: (value: string) => void;
  // 비밀번호 변경 콜백 — 입력 이벤트마다 새 값을 상위로 전달한다.
  onPasswordChange: (value: string) => void;
  // 제출 콜백 — submit 버튼이 enabled 일 때만 호출된다(폼 default 동작은 막는다).
  onSubmit: () => void;
  // 인증 진행 중 플래그 — true 면 입력 충족 여부와 무관하게 submit 을 막는다(loading 우선 정책).
  loading?: boolean;
  // 인증 실패 등 에러 문구 — truthy 면 role="alert" 영역에 렌더, 없으면 미렌더.
  error?: string;
}

// 로그인 입력 폼. 입력 미완(빈 username/password) 또는 loading 중에는 submit 을
// 막아 불완전한 제출을 방지한다(입력검증 분기). 에러는 role="alert" 로 외화한다.
function LoginForm({
  username,
  password,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
  loading,
  error,
}: LoginFormProps) {
  // 입력 미완 판정 — 둘 중 하나라도 빈 문자열이면 제출 불가.
  const inputIncomplete = username === '' || password === '';
  // loading 우선 정책 — 진행 중이면 입력이 모두 채워져 있어도 submit 을 막는다.
  const submitDisabled = loading === true || inputIncomplete;

  // 폼 default 제출(페이지 reload)을 막고, 막혀있지 않을 때만 콜백을 호출한다.
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!submitDisabled) {
      onSubmit();
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* 에러가 있을 때만 alert 영역을 렌더 — 빈 에러가 자리를 차지하지 않게 한다. */}
      {error ? <div role="alert">{error}</div> : null}

      <label>
        사용자명
        <input
          type="text"
          name="username"
          value={username}
          onChange={(event) => onUsernameChange(event.target.value)}
        />
      </label>

      <label>
        비밀번호
        <input
          type="password"
          name="password"
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
        />
      </label>

      <button type="submit" disabled={submitDisabled}>
        {loading === true ? '로그인 중…' : '로그인'}
      </button>
    </form>
  );
}

export type { LoginFormProps };
export default LoginForm;
