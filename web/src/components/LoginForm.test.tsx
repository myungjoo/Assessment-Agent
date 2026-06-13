import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import LoginForm from './LoginForm';

// R-112 — R-84(Auth/RBAC) frontend 진입점 로그인 폼(ADR-0040 §2) 검증.
// App.test.tsx / EvaluationGuardBanner.test.tsx 와 동일 패턴: jsdom·@testing-library
// 없이 react-dom/server 의 renderToStaticMarkup 으로 정적 렌더 문자열만 검증해
// dep 표면을 최소화한다 (ADR-0040 §5 게이트). renderToStaticMarkup 은 이벤트를
// 발화하지 않으므로 onSubmit/onChange 콜백은 검증 대상이 아니다 — 렌더 markup
// (텍스트, role="alert", disabled 속성 유무) 만 assert 한다.
// 파일명은 .test.tsx 고정 — root jest 의 testRegex (.*\.spec\.ts$) pickup 충돌 회피.

// no-op 콜백 — controlled component 라 props 로 받아야 하나, 정적 렌더에선 호출되지 않는다.
const noop = () => {};

describe('LoginForm', () => {
  // happy-path — 양쪽 입력이 채워지고 loading 없음 → submit enabled(disabled 미포함) + "로그인" 텍스트.
  it('username·password 채워짐 + loading 없음 → submit enabled + "로그인" 렌더 (happy-path)', () => {
    const html = renderToStaticMarkup(
      <LoginForm
        username="alice"
        password="secret"
        onUsernameChange={noop}
        onPasswordChange={noop}
        onSubmit={noop}
      />,
    );
    // 양쪽 채워짐 + loading 없음이므로 submit 버튼에 disabled 속성이 없어야 한다.
    expect(html).not.toContain('disabled');
    // 진행 표시("로그인 중…") 가 아닌 평상시 "로그인" 텍스트여야 한다.
    expect(html).toContain('로그인');
    expect(html).not.toContain('로그인 중…');
    // submit 버튼 type 고정.
    expect(html).toContain('type="submit"');
  });

  // happy-path(구조) — 폼은 항상 두 label("사용자명"·"비밀번호") 과 username/password 입력을 갖는다.
  it('두 label(사용자명·비밀번호) 과 text·password 입력을 렌더한다 (구조 불변)', () => {
    const html = renderToStaticMarkup(
      <LoginForm
        username="alice"
        password="secret"
        onUsernameChange={noop}
        onPasswordChange={noop}
        onSubmit={noop}
      />,
    );
    expect(html).toContain('사용자명');
    expect(html).toContain('비밀번호');
    // username 은 text 입력, password 는 password 타입 입력.
    expect(html).toContain('name="username"');
    expect(html).toContain('type="password"');
    expect(html).toContain('name="password"');
  });

  // error/negative path — error 가 truthy 면 role="alert" 영역에 에러 문구를 렌더한다.
  it('error 전달 시 role="alert" + 에러 문구를 렌더한다 (error path)', () => {
    const message = '자격 증명이 올바르지 않습니다';
    const html = renderToStaticMarkup(
      <LoginForm
        username="alice"
        password="secret"
        onUsernameChange={noop}
        onPasswordChange={noop}
        onSubmit={noop}
        error={message}
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain(message);
  });

  // negative — error 미전달 시 alert 영역이 렌더되지 않는다(빈 에러가 자리 차지 안 함).
  it('error 미전달 시 role="alert" 영역이 렌더되지 않는다 (negative — 빈 에러 미렌더)', () => {
    const html = renderToStaticMarkup(
      <LoginForm
        username="alice"
        password="secret"
        onUsernameChange={noop}
        onPasswordChange={noop}
        onSubmit={noop}
      />,
    );
    expect(html).not.toContain('role="alert"');
  });

  // negative/edge — 빈 문자열 error 도 falsy 분기로 alert 영역을 렌더하지 않는다(경계값).
  it('error="" 면 role="alert" 영역이 렌더되지 않는다 (negative — 빈 문자열 경계값)', () => {
    const html = renderToStaticMarkup(
      <LoginForm
        username="alice"
        password="secret"
        onUsernameChange={noop}
        onPasswordChange={noop}
        onSubmit={noop}
        error=""
      />,
    );
    expect(html).not.toContain('role="alert"');
  });

  // flow/branch — loading=true → submit disabled + "로그인 중…"(U+2026 말줄임표) 진행 표시.
  it('loading=true 면 submit disabled + "로그인 중…" 진행 표시를 렌더한다 (branch — loading)', () => {
    const html = renderToStaticMarkup(
      <LoginForm
        username="alice"
        password="secret"
        onUsernameChange={noop}
        onPasswordChange={noop}
        onSubmit={noop}
        loading={true}
      />,
    );
    expect(html).toContain('disabled');
    // 말줄임표는 U+2026(…) 단일 문자여야 한다 — "..." 3 점이 아니다.
    expect(html).toContain('로그인 중…');
    expect(html).not.toContain('로그인 중...');
  });

  // flow/branch — loading 미전달(undefined→false) → 정상 "로그인" 버튼(진행 표시 없음).
  it('loading 미전달 시 정상 "로그인" 버튼을 렌더한다 (branch — loading false)', () => {
    const html = renderToStaticMarkup(
      <LoginForm
        username="alice"
        password="secret"
        onUsernameChange={noop}
        onPasswordChange={noop}
        onSubmit={noop}
      />,
    );
    expect(html).toContain('로그인');
    expect(html).not.toContain('로그인 중…');
  });

  // negative/edge — username="" → 입력 미완 분기로 submit disabled.
  it('username="" 면 submit disabled (negative — username 미입력)', () => {
    const html = renderToStaticMarkup(
      <LoginForm
        username=""
        password="secret"
        onUsernameChange={noop}
        onPasswordChange={noop}
        onSubmit={noop}
      />,
    );
    expect(html).toContain('disabled');
  });

  // negative/edge — password="" → 입력 미완 분기로 submit disabled.
  it('password="" 면 submit disabled (negative — password 미입력)', () => {
    const html = renderToStaticMarkup(
      <LoginForm
        username="alice"
        password=""
        onUsernameChange={noop}
        onPasswordChange={noop}
        onSubmit={noop}
      />,
    );
    expect(html).toContain('disabled');
  });

  // negative/복합 — 빈 입력 동시 + error 동시 → 에러는 보이되 submit 은 여전히 disabled.
  it('username="" + password="" + error 동시 → alert 표시되고 submit 은 disabled (negative — 복합 상태)', () => {
    const message = '자격 증명이 올바르지 않습니다';
    const html = renderToStaticMarkup(
      <LoginForm
        username=""
        password=""
        onUsernameChange={noop}
        onPasswordChange={noop}
        onSubmit={noop}
        error={message}
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain(message);
    expect(html).toContain('disabled');
  });

  // negative/loading 우선 — 양쪽 채워져 있어도 loading=true 면 submit disabled(loading 우선 정책 고정).
  it('username·password 채워짐 + loading=true → submit disabled (negative — loading 우선 정책)', () => {
    const html = renderToStaticMarkup(
      <LoginForm
        username="alice"
        password="secret"
        onUsernameChange={noop}
        onPasswordChange={noop}
        onSubmit={noop}
        loading={true}
      />,
    );
    expect(html).toContain('disabled');
    expect(html).toContain('로그인 중…');
  });
});
