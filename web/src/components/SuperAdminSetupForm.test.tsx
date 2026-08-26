import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import SuperAdminSetupForm, {
  PASSWORD_HINT_ID,
  PASSWORD_HINT_TEXT,
  PASSWORD_MIN_LENGTH,
  USERNAME_HINT_ID,
  USERNAME_HINT_TEXT,
} from './SuperAdminSetupForm';
import type { SuperAdminSetupFormProps } from './SuperAdminSetupForm';

// 안내 문구 <p> 의 내용만 잘라낸다 — 폼 전체 markup 에는 controlled input 의 value 가
// 그대로 들어있으므로, "안내가 비밀번호를 노출하지 않는다" 는 안내 영역으로 범위를 좁혀야 한다.
const extractHint = (html: string, id: string): string => {
  const matched = html.match(new RegExp(`<p id="${id}"[^>]*>(.*?)</p>`));
  return matched === null ? '' : matched[1];
};

// name 속성으로 <input> 태그 하나를 통째로 잘라낸다 — aria-describedby 배선 검증용.
const extractInput = (html: string, name: string): string => {
  const matched = html.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`));
  return matched === null ? '' : matched[0];
};

// R-112 — R-84(Auth/RBAC) 최초 부트스트랩 SuperAdmin 초기 셋업 폼(ADR-0040 §2 인증 흐름) 검증.
// LoginForm.test.tsx / DifficultyModelSelector.test.tsx 와 동일 패턴: jsdom·@testing-library
// 없이 react-dom/server 의 renderToStaticMarkup 으로 정적 렌더 문자열만 검증해 dep 표면을
// 최소화한다 (ADR-0040 §5 게이트). renderToStaticMarkup 은 이벤트를 발화하지 않으므로
// onSubmit/onUsernameChange/onPasswordChange 콜백은 검증 대상이 아니다 — 렌더 markup
// (h2 제목, label/input 구조, role="alert", 버튼 텍스트·disabled 속성 유무) 만 assert 한다.
// 본 폼은 항상 렌더된다(early return 없음) — 버튼의 disabled/텍스트 + alert 만 분기로 변한다.
// 파일명은 .test.tsx 고정 — root jest 의 testRegex (.*\.spec\.ts$) pickup 충돌 회피.

// no-op 콜백 — controlled component 라 props 로 받아야 하나, 정적 렌더에선 호출되지 않는다.
const noop = () => {};

// 버튼 텍스트 토큰 (구현과 정합 — 말줄임표는 U+2026 …, "..." 3 점 아님).
const SUBMIT_TEXT = 'SuperAdmin 지정';
const LOADING_TEXT = '셋업 중…';

// 공통 콜백 props — 각 테스트가 username/password/loading/error 만 덮어쓴다.
const callbacks: Pick<
  SuperAdminSetupFormProps,
  'onUsernameChange' | 'onPasswordChange' | 'onSubmit'
> = {
  onUsernameChange: noop,
  onPasswordChange: noop,
  onSubmit: noop,
};

describe('SuperAdminSetupForm', () => {
  // happy-path — 양쪽 입력 채워짐 + loading 없음 → submit enabled(disabled 미포함) + "SuperAdmin 지정".
  it('username·password 채워짐 + loading 없음 → submit enabled + "SuperAdmin 지정" 렌더 (happy-path)', () => {
    const html = renderToStaticMarkup(
      <SuperAdminSetupForm username="root" password="secret" {...callbacks} />,
    );
    // 양쪽 채워짐 + loading 없음이므로 submit 버튼에 disabled 속성이 없어야 한다.
    expect(html).not.toContain('disabled');
    // 진행 표시("셋업 중…") 가 아닌 평상시 "SuperAdmin 지정" 텍스트여야 한다.
    expect(html).toContain(SUBMIT_TEXT);
    expect(html).not.toContain(LOADING_TEXT);
    // submit 버튼 type 고정.
    expect(html).toContain('type="submit"');
  });

  // happy-path(구조) — 폼은 항상 h2 제목 + 두 label(사용자명·비밀번호) + username/password 입력을 갖는다.
  it('h2 제목 + 두 label + text·password 입력을 렌더한다 (구조 불변)', () => {
    const html = renderToStaticMarkup(
      <SuperAdminSetupForm username="root" password="secret" {...callbacks} />,
    );
    // 셋업 단계 제목 — LoginForm 과 구분되는 부트스트랩 단계 표시.
    expect(html).toContain('<h2>SuperAdmin 초기 셋업</h2>');
    expect(html).toContain('사용자명');
    expect(html).toContain('비밀번호');
    // username 은 text 입력, password 는 password 타입 입력.
    expect(html).toContain('name="username"');
    expect(html).toContain('type="text"');
    expect(html).toContain('type="password"');
    expect(html).toContain('name="password"');
    // 폼은 항상 렌더된다(early return 없음).
    expect(html).toContain('<form');
  });

  // error path — error 가 truthy 면 role="alert" 영역에 에러 문구를 렌더한다.
  it('error 전달 시 role="alert" + 에러 문구를 렌더한다 (error path)', () => {
    const message = 'SuperAdmin 셋업에 실패했습니다';
    const html = renderToStaticMarkup(
      <SuperAdminSetupForm username="root" password="secret" {...callbacks} error={message} />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain(message);
    // 폼은 항상 렌더되므로 입력 필드도 함께 있다.
    expect(html).toContain('name="username"');
  });

  // flow/branch — error 미전달(undefined) → alert 영역이 렌더되지 않는다.
  it('error 미전달 시 role="alert" 영역이 렌더되지 않는다 (branch — error 부재)', () => {
    const html = renderToStaticMarkup(
      <SuperAdminSetupForm username="root" password="secret" {...callbacks} />,
    );
    expect(html).not.toContain('role="alert"');
    // 폼 자체는 정상 렌더.
    expect(html).toContain('<form');
  });

  // negative/edge — 빈 문자열 error 도 falsy 분기로 alert 영역을 렌더하지 않는다(경계값).
  it('error="" 면 role="alert" 영역이 렌더되지 않는다 (negative — 빈 문자열 경계값)', () => {
    const html = renderToStaticMarkup(
      <SuperAdminSetupForm username="root" password="secret" {...callbacks} error="" />,
    );
    expect(html).not.toContain('role="alert"');
  });

  // flow/branch — loading=true → submit disabled + "셋업 중…"(U+2026 말줄임표) 진행 표시.
  it('loading=true 면 submit disabled + "셋업 중…" 진행 표시를 렌더한다 (branch — loading)', () => {
    const html = renderToStaticMarkup(
      <SuperAdminSetupForm username="root" password="secret" {...callbacks} loading={true} />,
    );
    expect(html).toContain('disabled');
    // 말줄임표는 U+2026(…) 단일 문자여야 한다 — "..." 3 점이 아니다.
    expect(html).toContain(LOADING_TEXT);
    expect(html).not.toContain('셋업 중...');
    // 로딩 중에는 평상시 텍스트가 아니다.
    expect(html).not.toContain(SUBMIT_TEXT);
  });

  // flow/branch — loading 미전달(undefined→false) + 양쪽 채워짐 → 정상 "SuperAdmin 지정"(진행 표시 없음).
  it('loading 미전달 시 정상 "SuperAdmin 지정" 버튼을 렌더한다 (branch — loading false)', () => {
    const html = renderToStaticMarkup(
      <SuperAdminSetupForm username="root" password="secret" {...callbacks} />,
    );
    expect(html).toContain(SUBMIT_TEXT);
    expect(html).not.toContain(LOADING_TEXT);
  });

  // negative/edge — username="" → 입력 미완 분기로 submit disabled.
  it('username="" 면 submit disabled (negative — username 미입력)', () => {
    const html = renderToStaticMarkup(
      <SuperAdminSetupForm username="" password="secret" {...callbacks} />,
    );
    expect(html).toContain('disabled');
  });

  // negative/edge — password="" → 입력 미완 분기로 submit disabled.
  it('password="" 면 submit disabled (negative — password 미입력)', () => {
    const html = renderToStaticMarkup(
      <SuperAdminSetupForm username="root" password="" {...callbacks} />,
    );
    expect(html).toContain('disabled');
  });

  // negative/edge — 공백만 입력한 username 은 trim 후 빈 문자열이라 입력 미완 → submit disabled.
  it('username="   "(공백만) 면 trim 후 빈 입력으로 보아 submit disabled (negative — 공백만 입력 경계값)', () => {
    const html = renderToStaticMarkup(
      <SuperAdminSetupForm username="   " password="secret" {...callbacks} />,
    );
    expect(html).toContain('disabled');
  });

  // negative/edge — 공백만 입력한 password 도 trim 후 빈 문자열이라 입력 미완 → submit disabled.
  it('password="   "(공백만) 면 trim 후 빈 입력으로 보아 submit disabled (negative — 공백만 입력 경계값)', () => {
    const html = renderToStaticMarkup(
      <SuperAdminSetupForm username="root" password="   " {...callbacks} />,
    );
    expect(html).toContain('disabled');
  });

  // negative/loading 우선 — 양쪽 채워져 있어도 loading=true 면 submit disabled(loading 우선 정책 고정).
  it('username·password 채워짐 + loading=true → submit disabled (negative — loading 우선 정책)', () => {
    const html = renderToStaticMarkup(
      <SuperAdminSetupForm username="root" password="secret" {...callbacks} loading={true} />,
    );
    expect(html).toContain('disabled');
    expect(html).toContain(LOADING_TEXT);
  });

  // negative/복합 — loading=true + error 동시 → 폼 항상 렌더이므로 alert 와 disabled 버튼이 함께 존재.
  it('loading=true + error 동시 → role="alert" 와 disabled submit 버튼이 모두 렌더된다 (negative — loading+error 복합)', () => {
    const message = 'SuperAdmin 셋업에 실패했습니다';
    const html = renderToStaticMarkup(
      <SuperAdminSetupForm
        username="root"
        password="secret"
        {...callbacks}
        loading={true}
        error={message}
      />,
    );
    // 폼이 항상 렌더되므로 alert 는 loading 과 독립적으로 함께 나타난다.
    expect(html).toContain('role="alert"');
    expect(html).toContain(message);
    // loading=true → 버튼은 여전히 disabled + 진행 표시.
    expect(html).toContain('disabled');
    expect(html).toContain(LOADING_TEXT);
  });

  // negative/복합 — 빈 입력 동시 + error 동시 → 에러는 보이되 submit 은 여전히 disabled.
  it('username="" + password="" + error 동시 → alert 표시되고 submit 은 disabled (negative — 빈입력+error 복합)', () => {
    const message = 'SuperAdmin 셋업에 실패했습니다';
    const html = renderToStaticMarkup(
      <SuperAdminSetupForm username="" password="" {...callbacks} error={message} />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain(message);
    expect(html).toContain('disabled');
    // 입력 미완이므로 진행 표시는 없다(loading 미전달).
    expect(html).not.toContain(LOADING_TEXT);
  });
  // ── REQ-067: 아이디·암호 조건 사전 안내 ────────────────────────────────────────
  // happy-path — 정상 props 렌더 시 아이디 안내와 비밀번호 안내가 둘 다 존재하고,
  // 비밀번호 안내에 최소 길이 값(8) 이 포함된다.
  it('정상 props 렌더 시 아이디·비밀번호 조건 안내가 둘 다 보이고 최소 길이 8 을 명시한다 (happy-path — REQ-067)', () => {
    const html = renderToStaticMarkup(
      <SuperAdminSetupForm username="root@example.com" password="secret12" {...callbacks} />,
    );
    expect(html).toContain(USERNAME_HINT_TEXT);
    expect(html).toContain(PASSWORD_HINT_TEXT);
    // 안내 문구는 backend AddUserDto 의 실제 규칙만 인용한다 — email 형식 + 최소 길이.
    expect(extractHint(html, USERNAME_HINT_ID)).toContain('email');
    expect(extractHint(html, PASSWORD_HINT_ID)).toContain(String(PASSWORD_MIN_LENGTH));
    expect(PASSWORD_MIN_LENGTH).toBe(8);
  });

  // negative — backend 에 없는 조건(대문자/숫자/특수문자 필수) 을 지어내지 않는다.
  it('안내 문구가 backend 에 없는 대문자·숫자·특수문자 필수 조건을 지어내지 않는다 (negative — 없는 조건 인용 금지)', () => {
    const html = renderToStaticMarkup(
      <SuperAdminSetupForm username="root@example.com" password="secret12" {...callbacks} />,
    );
    const passwordHint = extractHint(html, PASSWORD_HINT_ID);
    expect(passwordHint).not.toContain('대문자를 포함');
    expect(passwordHint).not.toContain('특수문자를 포함');
    expect(passwordHint).not.toContain('숫자를 포함');
  });

  // error path — 실패 후에도 조건 안내가 사라지지 않는다(alert 와 동시 렌더).
  it('error 전달 시 role="alert" 와 조건 안내가 동시에 렌더된다 (error path — 실패 후에도 조건 유지)', () => {
    const html = renderToStaticMarkup(
      <SuperAdminSetupForm
        username="root@example.com"
        password="secret12"
        {...callbacks}
        error="SuperAdmin 셋업에 실패했습니다"
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain(USERNAME_HINT_TEXT);
    expect(html).toContain(PASSWORD_HINT_TEXT);
  });

  // negative ① — 입력 전 초기 상태(빈 문자열)에서도 안내가 보인다(사전 안내의 핵심).
  it('username="" + password="" 초기 상태에서도 조건 안내가 보인다 (negative — 입력 전 사전 안내)', () => {
    const html = renderToStaticMarkup(
      <SuperAdminSetupForm username="" password="" {...callbacks} />,
    );
    expect(html).toContain(USERNAME_HINT_TEXT);
    expect(html).toContain(PASSWORD_HINT_TEXT);
  });

  // negative ② / branch — loading=true 로 submit 이 막힌 분기에서도 안내가 그대로 렌더된다.
  it('loading=true 로 submit 이 막힌 상태에서도 조건 안내가 그대로 렌더된다 (branch — loading true)', () => {
    const html = renderToStaticMarkup(
      <SuperAdminSetupForm
        username="root@example.com"
        password="secret12"
        {...callbacks}
        loading={true}
      />,
    );
    expect(html).toContain('disabled');
    expect(html).toContain(USERNAME_HINT_TEXT);
    expect(html).toContain(PASSWORD_HINT_TEXT);
  });

  // negative ③ — 안내 문구가 password props 의 실제 값을 노출하지 않는다(마스킹 침해 0).
  it('안내 문구가 password props 의 실제 값을 노출하지 않는다 (negative — 마스킹 침해 0)', () => {
    const secret = 'SuperSecretValue99';
    const html = renderToStaticMarkup(
      <SuperAdminSetupForm username="root@example.com" password={secret} {...callbacks} />,
    );
    expect(extractHint(html, PASSWORD_HINT_ID)).not.toContain(secret);
    expect(extractHint(html, USERNAME_HINT_ID)).not.toContain(secret);
  });

  // aria-describedby 배선 — 각 입력이 대응 안내의 id 를 정확히 가리킨다.
  it('각 입력의 aria-describedby 가 대응 안내 문구의 id 와 일치한다 (접근성 배선)', () => {
    const html = renderToStaticMarkup(
      <SuperAdminSetupForm username="root@example.com" password="secret12" {...callbacks} />,
    );
    expect(extractInput(html, 'username')).toContain(`aria-describedby="${USERNAME_HINT_ID}"`);
    expect(extractInput(html, 'password')).toContain(`aria-describedby="${PASSWORD_HINT_ID}"`);
    // 두 안내는 서로 다른 id 를 쓴다 — 교차 연결 방지.
    expect(USERNAME_HINT_ID).not.toBe(PASSWORD_HINT_ID);
    expect(extractInput(html, 'username')).not.toContain(PASSWORD_HINT_ID);
  });
});
