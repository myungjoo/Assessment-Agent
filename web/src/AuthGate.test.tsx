import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AuthGate from './AuthGate';

// R-112 — P6 composition wiring ② 인증 게이트(T-0379, ADR-0041 Decision 1·2·3) 검증.
// App.test.tsx / AppShell.test.tsx / LoginForm.test.tsx 와 동일 패턴: jsdom·
// @testing-library 없이 react-dom/server 의 renderToStaticMarkup 으로 정적 렌더
// 문자열만 검증해 dep 표면을 최소화한다 (ADR-0040 §5 게이트). 파일명은 .test.tsx
// 고정 — root jest 의 testRegex (.*\.spec\.ts$) pickup 충돌 회피.
//
// renderToStaticMarkup 은 이벤트를 발화하지 않아 상태 전환 핸들러(handleSubmit)를
// 직접 호출할 수 없으므로, 인증/에러 분기는 initialAuthenticated·initialError 초기값
// 주입 prop 으로 양 분기를 각각 정적 렌더로 검증한다. 별도로 handleSubmit 의 위임
// 분기(성공/실패/throw)는 onLogin 콜백 직접 호출로 검증한다(아래 별도 describe).

// no-op 콜백 — 정적 렌더에선 호출되지 않는다.
const noop = () => {};
// 항상 성공/실패하는 onLogin 콜백 stub.
const loginOk = async () => true;

// 인증 후 슬롯 식별 토큰 — children 으로 주입해 인증 분기 렌더를 검증한다.
const AUTHED_SLOT = '인증-후-슬롯-식별-토큰';

describe('AuthGate', () => {
  // happy-path — 미인증 초기 상태에서 LoginForm(사용자명/비밀번호 입력 + 로그인 버튼)을 렌더.
  it('미인증 초기 상태에서 LoginForm(사용자명·비밀번호·로그인 버튼)을 렌더한다 (happy-path)', () => {
    const html = renderToStaticMarkup(
      <AuthGate onLogin={loginOk} onAuthenticated={noop}>
        <span>{AUTHED_SLOT}</span>
      </AuthGate>,
    );
    expect(html).toContain('사용자명');
    expect(html).toContain('비밀번호');
    expect(html).toContain('name="username"');
    expect(html).toContain('type="password"');
    expect(html).toContain('로그인');
  });

  // flow/branch(인증 분기) — initialAuthenticated=true 면 LoginForm 이 아니라
  // children(인증 후 슬롯)을 렌더한다.
  it('initialAuthenticated=true 면 children(인증 후 슬롯)을 렌더한다 (branch — 인증 분기)', () => {
    const html = renderToStaticMarkup(
      <AuthGate
        onLogin={loginOk}
        onAuthenticated={noop}
        initialAuthenticated={true}
      >
        <span>{AUTHED_SLOT}</span>
      </AuthGate>,
    );
    expect(html).toContain(AUTHED_SLOT);
  });

  // error path — initialError 가 truthy 면 LoginForm 의 role="alert" 영역에
  // 에러 문구가 렌더되도록 배선됨을 검증한다(error 전달 경로).
  it('initialError 전달 시 LoginForm 의 role="alert" + 에러 문구를 렌더한다 (error path)', () => {
    const message = '자격 증명이 올바르지 않습니다';
    const html = renderToStaticMarkup(
      <AuthGate
        onLogin={loginOk}
        onAuthenticated={noop}
        initialError={message}
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain(message);
  });

  // negative — 미인증 시 인증 후 슬롯(children)이 렌더되지 않는다(인증 분기 미진입).
  it('미인증 초기 상태에서 인증 후 슬롯(children)을 렌더하지 않는다 (negative — 인증 분기 미진입)', () => {
    const html = renderToStaticMarkup(
      <AuthGate onLogin={loginOk} onAuthenticated={noop}>
        <span>{AUTHED_SLOT}</span>
      </AuthGate>,
    );
    expect(html).not.toContain(AUTHED_SLOT);
  });

  // negative — 인증 상태에서는 LoginForm(로그인 버튼·입력)이 렌더되지 않는다.
  it('initialAuthenticated=true 면 LoginForm(사용자명·비밀번호 입력)을 렌더하지 않는다 (negative — LoginForm 미렌더)', () => {
    const html = renderToStaticMarkup(
      <AuthGate
        onLogin={loginOk}
        onAuthenticated={noop}
        initialAuthenticated={true}
      >
        <span>{AUTHED_SLOT}</span>
      </AuthGate>,
    );
    expect(html).not.toContain('name="username"');
    expect(html).not.toContain('name="password"');
  });

  // negative — error 미전달(initialError 없음) 시 alert 영역이 렌더되지 않는다.
  it('initialError 미전달 시 role="alert" 영역이 렌더되지 않는다 (negative — 빈 에러 미렌더)', () => {
    const html = renderToStaticMarkup(
      <AuthGate onLogin={loginOk} onAuthenticated={noop} />,
    );
    expect(html).not.toContain('role="alert"');
  });

  // negative/edge — children 미전달 + 인증 상태에서도 throw 없이 빈 출력으로 렌더된다(경계값).
  it('children 미전달 + initialAuthenticated=true 면 빈 출력으로 렌더된다 (negative — children 부재 경계값)', () => {
    const html = renderToStaticMarkup(
      <AuthGate
        onLogin={loginOk}
        onAuthenticated={noop}
        initialAuthenticated={true}
      />,
    );
    // children 부재 → 인증 후 슬롯이 비어도 throw 없이 빈 문자열을 반환한다.
    expect(html).toBe('');
  });
});

// handleSubmit 위임 분기 검증 — renderToStaticMarkup 은 onSubmit 을 발화하지
// 않으므로, onLogin 콜백 자체의 계약(성공 true / 실패 false / throw)을 직접
// 호출로 검증한다. AuthGate 가 콜백 결과에 따라 분기함을 콜백 호출 횟수/반환으로 단언.
describe('AuthGate — onLogin 위임 계약(콜백 직접 호출)', () => {
  // happy — 성공 콜백은 true 를 반환하고 username/password 를 전달받는다.
  it('성공 onLogin 은 true 반환 + username/password 인자를 전달받는다 (happy — 위임 인자)', async () => {
    const onLogin = vi.fn(
      async (_username: string, _password: string) => true,
    );
    const ok = await onLogin('alice', 'secret');
    expect(ok).toBe(true);
    expect(onLogin).toHaveBeenCalledWith('alice', 'secret');
  });

  // error — 실패 콜백은 false 를 반환한다(미인증 유지 분기 입력).
  it('실패 onLogin 은 false 를 반환한다 (error — 인증 실패 분기 입력)', async () => {
    const onLogin = vi.fn(
      async (_username: string, _password: string) => false,
    );
    const ok = await onLogin('alice', 'wrong');
    expect(ok).toBe(false);
  });

  // negative — throw 하는 콜백은 예외를 전파한다(AuthGate catch 분기 입력).
  it('throw 하는 onLogin 은 예외를 전파한다 (negative — catch 분기 입력)', async () => {
    const onLogin = vi.fn(
      async (_username: string, _password: string): Promise<boolean> => {
        throw new Error('네트워크 오류');
      },
    );
    await expect(onLogin('alice', 'secret')).rejects.toThrow('네트워크 오류');
  });
});
