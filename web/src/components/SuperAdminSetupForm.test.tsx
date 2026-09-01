import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import SuperAdminSetupForm, {
  PASSWORD_HINT_ID,
  PASSWORD_HINT_TEXT,
  PASSWORD_MIN_LENGTH,
  SETUP_ERROR_LINE_CLASS,
  USERNAME_HINT_ID,
  USERNAME_HINT_TEXT,
  hasErrorLines,
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

// role="alert" 영역의 내용만 잘라낸다 (T-1834) — 폼 전체 markup 에는 controlled input 의
// value 가 그대로 들어있으므로, "오류 안내가 입력값을 노출하지 않는다" 는 alert 영역으로
// 범위를 좁혀야 한다. alert 안에는 중첩 <div> 가 없어 첫 </div> 가 곧 닫는 태그다.
const extractAlert = (html: string): string => {
  const matched = html.match(/<div role="alert">([\s\S]*?)<\/div>/);
  return matched === null ? '' : matched[1];
};

// 줄 element 하나의 완전한 markup — 두 줄이 같은 텍스트 노드로 합쳐지지 않았음을 단언한다.
const LINE_OPEN_TAG = `<p class="${SETUP_ERROR_LINE_CLASS}">`;
const lineMarkup = (text: string): string => `${LINE_OPEN_TAG}${text}</p>`;
// 두 줄 사이의 element 경계 — 이 경계가 사라지면 줄들이 합쳐졌다는 뜻이다.
const LINE_BOUNDARY = `</p>${LINE_OPEN_TAG}`;

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

// R-112 — T-1834 여러 줄 오류 안내의 줄 단위 표시(REQ-084) 검증.
// 종전에는 상위(AppShell)가 사유 줄들을 ' / ' 로 합쳐 error 한 칸에 밀어 넣어, 사유가 2 개
// 이상이면 어디서 한 줄이 끝나는지 구분할 수 없었다. 본 slice 는 errorLines prop 으로 줄
// 경계를 markup 에 남긴다 — CSS 없이 element 분리만으로 구분한다(스타일 도입 Out of Scope).
describe('SuperAdminSetupForm errorLines (T-1834)', () => {
  // happy-path — 두 줄을 주면 줄마다 별도 element 로, 원문 그대로 렌더된다.
  it('errorLines 두 줄을 줄마다 별도 element 로 원문 그대로 렌더한다 (happy-path)', () => {
    const lines = ['아이디: 이미 등록된 아이디입니다.', '비밀번호: 최소 8자 이상이어야 합니다.'];
    const html = renderToStaticMarkup(
      <SuperAdminSetupForm username="root" password="secret" {...callbacks} errorLines={lines} />,
    );
    expect(html).toContain('role="alert"');
    // 각 줄이 자기 element 를 가진다 — 두 줄이 한 문자열로 합쳐지지 않았다는 직접 증거.
    expect(html).toContain(lineMarkup(lines[0]));
    expect(html).toContain(lineMarkup(lines[1]));
  });

  // happy-path ② — 줄 수만큼의 줄 element 가 나온다(누락·중복 0).
  it('줄 수만큼의 줄 element 를 렌더한다 (happy-path — 줄 수 보존)', () => {
    const lines = ['첫째 줄', '둘째 줄', '셋째 줄'];
    const alert = extractAlert(
      renderToStaticMarkup(
        <SuperAdminSetupForm username="root" password="secret" {...callbacks} errorLines={lines} />,
      ),
    );
    expect(alert.split(LINE_OPEN_TAG)).toHaveLength(lines.length + 1);
    for (const line of lines) {
      expect(alert).toContain(lineMarkup(line));
    }
  });

  // error path — 사유 미상 fallback 처럼 한 줄만 와도 alert 가 정상 렌더된다.
  it('한 줄만 전달돼도 alert 영역에 그 줄이 렌더된다 (error path — 단일 사유)', () => {
    const fallback = '셋업 응답을 해석하지 못했습니다.';
    const alert = extractAlert(
      renderToStaticMarkup(
        <SuperAdminSetupForm
          username="root"
          password="secret"
          {...callbacks}
          errorLines={[fallback]}
        />,
      ),
    );
    expect(alert).toContain(lineMarkup(fallback));
  });

  // 분기 (가) — errorLines 가 비어있지 않으면 error 문자열보다 우선한다(우선순위 계약).
  it('errorLines 가 있으면 error 문자열보다 우선한다 (분기 가 — errorLines 우선)', () => {
    const html = renderToStaticMarkup(
      <SuperAdminSetupForm
        username="root"
        password="secret"
        {...callbacks}
        error="합쳐진 한 줄 문구"
        errorLines={['줄 하나', '줄 둘']}
      />,
    );
    expect(html).toContain(lineMarkup('줄 하나'));
    expect(html).toContain(lineMarkup('줄 둘'));
    // 우선순위가 뒤집히면 이 단언이 깨진다 — error 문자열은 렌더되지 않는다.
    expect(html).not.toContain('합쳐진 한 줄 문구');
  });

  // 분기 (나) — errorLines 가 빈 배열이면 기존 error 문자열 경로로 되돌아간다(무회귀).
  it('errorLines 가 빈 배열이면 error 문자열이 그대로 렌더된다 (분기 나 — 문자열 fallback)', () => {
    const html = renderToStaticMarkup(
      <SuperAdminSetupForm
        username="root"
        password="secret"
        {...callbacks}
        error="셋업에 실패했습니다"
        errorLines={[]}
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('셋업에 실패했습니다');
    // 문자열 경로에서는 줄 element 를 만들지 않는다.
    expect(html).not.toContain(SETUP_ERROR_LINE_CLASS);
  });

  // 분기 (나') — errorLines 미전달 + error 문자열 도 같은 문자열 경로다.
  it('errorLines 미전달 + error 문자열이면 문자열 경로로 렌더한다 (분기 나 — 미전달)', () => {
    const html = renderToStaticMarkup(
      <SuperAdminSetupForm username="root" password="secret" {...callbacks} error="실패" />,
    );
    expect(html).toContain('role="alert"');
    expect(html).not.toContain(SETUP_ERROR_LINE_CLASS);
  });

  // 분기 (다) — 둘 다 없으면 alert 자체를 렌더하지 않는다(빈 alert 가 자리를 차지하지 않는다).
  it('errorLines·error 둘 다 없으면 alert 영역을 렌더하지 않는다 (분기 다 — 미렌더)', () => {
    const html = renderToStaticMarkup(
      <SuperAdminSetupForm username="root" password="secret" {...callbacks} />,
    );
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain(SETUP_ERROR_LINE_CLASS);
  });

  // negative ① — 빈 배열만 오면(문자열 error 도 없음) 빈 alert 를 렌더하지 않는다(경계값).
  it('errorLines=[] 단독이면 빈 alert 를 렌더하지 않는다 (negative — 빈 배열 경계값)', () => {
    const html = renderToStaticMarkup(
      <SuperAdminSetupForm username="root" password="secret" {...callbacks} errorLines={[]} />,
    );
    expect(html).not.toContain('role="alert"');
  });

  // negative ② — 줄이 1 개뿐일 때 구분자 ' / ' 가 출력에 섞이지 않는다(합침 회귀 감시).
  it('줄이 1 개일 때 구분자가 출력에 섞이지 않는다 (negative — 구분자 잔재 0)', () => {
    const alert = extractAlert(
      renderToStaticMarkup(
        <SuperAdminSetupForm
          username="root"
          password="secret"
          {...callbacks}
          errorLines={['아이디: 이미 등록된 아이디입니다.']}
        />,
      ),
    );
    expect(alert).not.toContain(' / ');
  });

  // negative ③ — 줄이 2 개 이상일 때도 두 줄이 하나의 텍스트 노드로 이어붙지 않는다.
  it('두 줄이 하나의 텍스트 노드로 합쳐지지 않는다 (negative — 합침 금지)', () => {
    const alert = extractAlert(
      renderToStaticMarkup(
        <SuperAdminSetupForm
          username="root"
          password="secret"
          {...callbacks}
          errorLines={['앞줄', '뒷줄']}
        />,
      ),
    );
    // 이어붙은 형태('앞줄뒷줄' 또는 '앞줄 / 뒷줄')는 어디에도 나타나면 안 된다.
    expect(alert).not.toContain('앞줄뒷줄');
    expect(alert).not.toContain('앞줄 / 뒷줄');
    // 두 줄 사이에 element 경계가 존재한다.
    expect(alert).toContain(LINE_BOUNDARY);
  });

  // negative ④ — 사용자가 입력한 비밀번호 값이 오류 안내 영역에 새지 않는다(기존 패턴 승계).
  it('오류 안내 영역에 password props 값이 새지 않는다 (negative — 민감값 미노출)', () => {
    const secret = 'SuperSecretValue99';
    const alert = extractAlert(
      renderToStaticMarkup(
        <SuperAdminSetupForm
          username="root@example.com"
          password={secret}
          {...callbacks}
          errorLines={['비밀번호: 최소 8자 이상이어야 합니다.']}
        />,
      ),
    );
    expect(alert).not.toContain(secret);
  });

  // negative ⑤ — 타입을 우회해 undefined·공백 줄이 섞여도 throw 없이 렌더된다.
  it('undefined·공백 줄이 섞여도 throw 없이 렌더한다 (negative — 타입 우회 입력)', () => {
    const dirty = ['정상 줄', undefined as unknown as string, '   ', ''];
    expect(() =>
      renderToStaticMarkup(
        <SuperAdminSetupForm username="root" password="secret" {...callbacks} errorLines={dirty} />,
      ),
    ).not.toThrow();
    const html = renderToStaticMarkup(
      <SuperAdminSetupForm username="root" password="secret" {...callbacks} errorLines={dirty} />,
    );
    expect(html).toContain(lineMarkup('정상 줄'));
  });

  // negative ⑥ — 타입을 우회해 배열이 아닌 값이 와도 throw 없이 문자열 경로로 되돌아간다.
  it('errorLines 가 배열이 아니면 throw 없이 문자열 경로로 되돌아간다 (negative — 비배열 입력)', () => {
    const html = renderToStaticMarkup(
      <SuperAdminSetupForm
        username="root"
        password="secret"
        {...callbacks}
        error="문자열 경로"
        errorLines={'합쳐진 문구' as unknown as string[]}
      />,
    );
    expect(html).toContain('문자열 경로');
    expect(html).not.toContain(SETUP_ERROR_LINE_CLASS);
  });
});

describe('hasErrorLines (T-1834)', () => {
  // happy-path — 값이 있는 배열이면 줄 단위 렌더 경로를 택한다.
  it('비어있지 않은 배열이면 true 다 (happy-path)', () => {
    expect(hasErrorLines(['한 줄'])).toBe(true);
    expect(hasErrorLines(['줄 하나', '줄 둘'])).toBe(true);
  });

  // 분기 — 빈 배열은 렌더할 값이 없으므로 false 다.
  it('빈 배열이면 false 다 (분기 — 빈 목록)', () => {
    expect(hasErrorLines([])).toBe(false);
  });

  // 분기 — 미전달(undefined) 도 false 다.
  it('undefined 면 false 다 (분기 — 미전달)', () => {
    expect(hasErrorLines(undefined)).toBe(false);
  });

  // error path / negative — 타입을 우회한 비배열 입력에도 throw 없이 false 다.
  it('배열이 아닌 값에도 throw 없이 false 를 반환한다 (error path — 타입 우회 입력)', () => {
    expect(() => hasErrorLines('문자열' as unknown as string[])).not.toThrow();
    expect(hasErrorLines('문자열' as unknown as string[])).toBe(false);
    expect(hasErrorLines(null as unknown as string[])).toBe(false);
    expect(hasErrorLines(42 as unknown as string[])).toBe(false);
  });
});
