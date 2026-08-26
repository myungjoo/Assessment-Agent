// R-84 (Auth/RBAC) 최초 부트스트랩 SuperAdmin 초기 셋업 폼 (ADR-0040 §2 인증 흐름).
// 첫 로그인 시 시스템에 SuperAdmin 계정 1개를 지정하는 셋업 단계를 담당한다 —
// LoginForm(기존 계정 로그인) 과 별개의 단계다. 본 컴포넌트는 입력값·콜백·
// error/loading 플래그를 props 로만 받는 순수 presentational controlled component 다 —
// 실제 셋업 요청(POST)·세션 배선·성공 후 라우팅·전역 상태는 후속 slice 책임
// (Out of Scope). 직전 slice(LoginForm, DifficultyModelSelector, EvaluationResultTable,
// EvaluationGuardBanner) 와 동일한 props/분기/named·default export convention 을 차용한다.

// 안내 문구가 인용하는 비밀번호 최소 길이. 정본은 backend 의 src/user/dto/add-user.dto.ts
// 에 있는 동명 상수 PASSWORD_MIN_LENGTH 이며, web 은 별도 package 라 import 대신 값만 동기한다
// (정책 변경 시 backend 상수와 본 상수를 함께 갱신해야 한다).
export const PASSWORD_MIN_LENGTH = 8;

// 조건 안내 문구의 고정 id — 대응 입력의 aria-describedby 가 이 값을 가리켜
// 스크린리더에서도 입력 전에 조건이 함께 읽힌다.
export const USERNAME_HINT_ID = 'superadmin-setup-username-hint';
export const PASSWORD_HINT_ID = 'superadmin-setup-password-hint';

// 안내 문구 본문 — backend AddUserDto 의 실제 규칙(@IsEmail + @IsNotEmpty +
// @MinLength(PASSWORD_MIN_LENGTH)) 만 인용한다. 대문자·숫자·특수문자 요구는 backend 에
// 없으므로 문구에 넣지 않는다(없는 조건을 지어내면 사용자를 오도한다).
export const USERNAME_HINT_TEXT =
  '아이디는 email 형식이어야 합니다 (예: admin@example.com). 공백만 입력할 수 없습니다.';
export const PASSWORD_HINT_TEXT = `비밀번호는 최소 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다. 대문자·특수문자 요구는 없습니다.`;

interface SuperAdminSetupFormProps {
  // SuperAdmin 사용자명 입력값 — controlled component 라 상위가 상태를 보유한다.
  username: string;
  // SuperAdmin 비밀번호 입력값 — controlled component 라 상위가 상태를 보유한다.
  password: string;
  // 사용자명 변경 콜백 — 입력 이벤트마다 새 값을 상위로 전달한다.
  onUsernameChange: (value: string) => void;
  // 비밀번호 변경 콜백 — 입력 이벤트마다 새 값을 상위로 전달한다.
  onPasswordChange: (value: string) => void;
  // 제출 콜백 — submit 버튼이 enabled 일 때만 호출된다(폼 default 동작은 막는다).
  onSubmit: () => void;
  // 셋업 진행 중 플래그 — true 면 입력 충족 여부와 무관하게 submit 을 막는다(loading 우선 정책).
  loading?: boolean;
  // 셋업 실패 등 에러 문구 — truthy 면 role="alert" 영역에 렌더, 없으면 미렌더.
  error?: string;
}

// SuperAdmin 초기 셋업 폼. 입력 미완(빈/공백뿐인 username·password) 또는 loading 중에는
// submit 을 막아 불완전한 셋업 제출을 방지한다(입력검증 분기). 에러는 role="alert" 로 외화한다.
// 아이디·비밀번호 조건 안내(REQ-067) 는 입력 전에도 항상 렌더되며 aria-describedby 로 각 입력에 연결된다.
function SuperAdminSetupForm({
  username,
  password,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
  loading,
  error,
}: SuperAdminSetupFormProps) {
  // 입력 미완 판정 — 공백만 입력한 경우도 빈 입력으로 본다(trim 후 빈 문자열이면 미완).
  // 초기 SuperAdmin 은 시스템 단일 관리자라 공백 자격증명 제출을 특히 방지한다.
  const inputIncomplete = username.trim() === '' || password.trim() === '';
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
      {/* 셋업 단계임을 알리는 제목 — LoginForm 과 구분되는 부트스트랩 단계 표시. */}
      <h2>SuperAdmin 초기 셋업</h2>

      {/* 에러가 있을 때만 alert 영역을 렌더 — 빈 에러가 자리를 차지하지 않게 한다. */}
      {error ? <div role="alert">{error}</div> : null}

      {/* 안내는 label 바깥에 둔다 — label 안에 넣으면 문구가 입력의 접근 가능 이름에 섞인다. */}
      <label>
        사용자명
        <input
          type="text"
          name="username"
          value={username}
          onChange={(event) => onUsernameChange(event.target.value)}
          aria-describedby={USERNAME_HINT_ID}
        />
      </label>
      {/* 입력 전에도 항상 보이는 아이디 조건 — 분기 없이 무조건 렌더한다(실패 후에도 사라지지 않는다). */}
      <p id={USERNAME_HINT_ID}>{USERNAME_HINT_TEXT}</p>

      <label>
        비밀번호
        {/* type="password" 로 마스킹 — 정적 markup 에 평문 비밀번호를 노출하지 않는다. */}
        <input
          type="password"
          name="password"
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          aria-describedby={PASSWORD_HINT_ID}
        />
      </label>
      {/* 입력 전에도 항상 보이는 비밀번호 조건 — 최소 길이는 위 상수에서만 온다(문구 하드코딩 0). */}
      <p id={PASSWORD_HINT_ID}>{PASSWORD_HINT_TEXT}</p>

      <button type="submit" disabled={submitDisabled}>
        {loading === true ? '셋업 중…' : 'SuperAdmin 지정'}
      </button>
    </form>
  );
}

export type { SuperAdminSetupFormProps };
export default SuperAdminSetupForm;
