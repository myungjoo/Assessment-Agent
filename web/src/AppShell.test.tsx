import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AppShell, { AUTHED_NAV_ITEMS, buildSetupErrorMessage, isNavItemActive } from './AppShell';
import type { View } from './AppShell';
import { classifySignupFailure } from './api/signupError';
import type { SignupFailure } from './api/signupError';

// R-112 — P6 composition wiring ①②(T-0378·T-0379) AppShell 검증.
// App.test.tsx / EvaluationGuardBanner.test.tsx 와 동일 패턴: jsdom/@testing-library
// 없이 react-dom/server 의 renderToStaticMarkup 으로 정적 렌더 문자열만 검증해
// dep 표면을 최소화한다 (ADR-0040 §5 게이트). 파일명은 .test.tsx 고정 —
// root jest 의 testRegex (.*\.spec\.ts$) pickup 충돌 회피.
//
// wiring ②(T-0379): AppShell 이 본문에 AuthGate 를 배선하므로, 미인증 초기
// 상태에서는 login placeholder 가 아니라 LoginForm(AuthGate 경유)이 렌더된다.
// view 전환 핸들러(onAuthenticated→setView)는 이벤트 발화가 필요해 정적 렌더로는
// 직접 검증할 수 없어, 미인증 초기 분기(LoginForm 렌더 + 배너 비활성 + 헤더 유지)만 검증한다.

// R-78 평가 진행 중 경고 배너의 식별 토큰 (EvaluationGuardBanner DEFAULT_MESSAGE 와 정합).
const BANNER_TOKEN = '평가가 진행 중';

// SuperAdminSetupForm 의 셋업 제목 식별 토큰 (SuperAdminSetupForm <h2> 와 정합).
const SETUP_TITLE = 'SuperAdmin 초기 셋업';

describe('AppShell', () => {
  // happy-path — 레이아웃 골격 (전역 제목 식별 토큰) 을 포함하고 빈 출력이 아니다.
  it('레이아웃 골격과 전역 제목 식별 토큰을 렌더한다 (happy-path)', () => {
    const html = renderToStaticMarkup(<AppShell />);
    expect(html).not.toBe('');
    expect(html).toContain('Assessment-Agent');
    expect(html).toContain('app-shell-header');
    expect(html).toContain('app-shell-main');
  });

  // flow/branch — 미인증 초기 상태에서 본문에 AuthGate 경유 LoginForm(사용자명·
  // 비밀번호 입력 + 로그인 버튼 식별 토큰)이 배선되어 렌더된다.
  it('미인증 초기 상태에서 AuthGate 경유 LoginForm 을 본문에 배선해 렌더한다 (flow/branch — 미인증 분기)', () => {
    const html = renderToStaticMarkup(<AppShell />);
    expect(html).toContain('사용자명');
    expect(html).toContain('비밀번호');
    expect(html).toContain('name="username"');
    expect(html).toContain('type="password"');
    expect(html).toContain('로그인');
  });

  // negative — 미인증 초기 상태에서는 인증 후 view placeholder 문구가 렌더되지 않는다
  // (AuthGate 의 children 슬롯은 인증 전까지 렌더 안 됨).
  it('미인증 초기 상태에서 인증 후 view(대시보드·Admin·SuperAdmin) placeholder 를 렌더하지 않는다 (negative — 인증 전 슬롯 미렌더)', () => {
    const html = renderToStaticMarkup(<AppShell />);
    expect(html).not.toContain('대시보드 화면');
    expect(html).not.toContain('Admin 화면');
    expect(html).not.toContain('SuperAdmin 셋업 화면');
  });

  // negative — 초기 evaluationInProgress=false 라 R-78 배너 문구가 렌더되지 않는다
  // (배너 슬롯이 active=false 를 내려 null 반환). AuthGate 의 LoginForm 도 error
  // 없는 초기 상태라 role="alert" 가 없어야 한다(배너·에러 모두 비활성).
  it('초기 상태에서 R-78 평가 진행 중 배너 문구와 alert 영역을 렌더하지 않는다 (negative — 배너·에러 비활성)', () => {
    const html = renderToStaticMarkup(<AppShell />);
    expect(html).not.toContain(BANNER_TOKEN);
    expect(html).not.toContain('role="alert"');
  });

  // wiring ⑥ flow/branch — initialView='superadmin-setup' 주입 시 setup 분기에서
  // SuperAdminSetupForm(셋업 제목 + 셋업 입력/버튼)이 배선되어 렌더된다.
  it("initialView='superadmin-setup' 주입 시 SuperAdminSetupForm 을 본문에 배선해 렌더한다 (flow/branch — setup 분기)", () => {
    const html = renderToStaticMarkup(<AppShell initialView="superadmin-setup" />);
    expect(html).toContain(SETUP_TITLE);
    expect(html).toContain('name="username"');
    expect(html).toContain('type="password"');
    expect(html).toContain('SuperAdmin 지정');
  });

  // wiring ⑥ negative — setup 모드와 login 모드 동시 렌더 금지. setup 화면에는
  // LoginForm 의 로그인 버튼·setup 진입 트리거가 없어야 한다(상호배타).
  it('setup 모드에서 LoginForm(로그인 버튼)·setup 진입 트리거를 동시 렌더하지 않는다 (negative — setup↔login 상호배타)', () => {
    const html = renderToStaticMarkup(<AppShell initialView="superadmin-setup" />);
    expect(html).toContain(SETUP_TITLE);
    // 로그인 분기(AuthGate→LoginForm)의 식별 토큰 부재 — LoginForm 미렌더.
    expect(html).not.toContain('로그인');
    // setup 진입 트리거(초기 셋업 버튼)도 setup 모드에서는 노출 안 함(중복 진입 방지).
    expect(html).not.toContain('enter-setup');
  });

  // wiring ⑥ negative — login 모드에서는 셋업 폼 제목이 부재하고, 대신 setup 진입
  // 트리거가 노출된다(상호배타의 반대 방향).
  it('login 모드에서 셋업 폼 제목은 부재하고 setup 진입 트리거만 노출한다 (negative — login↔setup 상호배타)', () => {
    const html = renderToStaticMarkup(<AppShell />);
    expect(html).not.toContain(SETUP_TITLE);
    // 미인증 로그인 화면에는 setup 진입 트리거가 노출된다.
    expect(html).toContain('enter-setup');
    expect(html).toContain('초기 셋업');
  });

  // wiring ⑥ negative — setup error 가 주입되면 SuperAdminSetupForm 의 error props
  // 로 안전 표시된다(role="alert", throw 없음).
  it('initialSetupError 주입 시 setup 폼이 alert 영역으로 안전 표시한다 (negative — setup error 안전 표시)', () => {
    const html = renderToStaticMarkup(
      <AppShell initialView="superadmin-setup" initialSetupError="셋업 실패" />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('셋업 실패');
  });
});

// R-112 — T-1714 buildSetupErrorMessage(셋업 실패 사유 → 폼 error 문자열 변환) 검증.
// AppShell 의 handleSetupSubmit 은 이벤트 발화가 필요해 정적 렌더로 직접 호출할 수 없고,
// web 에는 @testing-library/react 가 없다(ADR-0040 §5 새-dep 게이트) — 그래서 변환 규칙을
// 순수 함수로 분리해 단위로 검증한다.

// 오너가 정면으로 금지한 포괄 문구 — 어떤 실패 경로에서도 다시 나타나면 안 된다(REQ-068).
const FORBIDDEN_GENERIC_MESSAGE = '이미 등록된 사용자이거나 입력이 올바르지 않습니다.';

// 사유를 하나도 얻지 못했을 때의 fallback 식별 토큰 (AppShell SETUP_UNRESOLVED_MESSAGE 와 정합).
const UNRESOLVED_TOKEN = '셋업 응답을 해석하지 못했습니다';

describe('buildSetupErrorMessage', () => {
  // happy-path — 409 중복 실패는 중복 전용 사유를 그대로 담은 문자열이 된다(REQ-069 중복 축).
  it('duplicate-username failure 를 중복 전용 사유 문자열로 만든다 (happy-path)', () => {
    const failure = classifySignupFailure(409, '{"message":"Conflict"}');
    const message = buildSetupErrorMessage(failure);
    expect(message).toContain('아이디:');
    expect(message).toContain('이미 등록된 아이디입니다');
    // 중복 축에 형식/길이 어휘가 섞이면 REQ-069 구분이 무너진다.
    expect(message).not.toContain('비밀번호:');
  });

  // error path — 400 입력 위반(아이디 형식 + 비밀번호 길이 동시 위반)에서 두 사유가 모두 남는다.
  it('invalid-input failure 의 아이디·비밀번호 사유를 모두 보존한다 (error path — 병합 금지)', () => {
    const failure = classifySignupFailure(
      400,
      JSON.stringify({
        message: ['email must be an email', 'password must be longer than or equal to 8 characters'],
      }),
    );
    const message = buildSetupErrorMessage(failure);
    expect(message).toContain('아이디는 email 형식이어야 합니다');
    expect(message).toContain('비밀번호는 최소 8자 이상이어야 합니다');
    // 두 사유가 각각의 접두와 함께 남아야 한다(하나로 요약·병합 금지).
    expect(message).toContain('아이디:');
    expect(message).toContain('비밀번호:');
  });

  // 분기 ① — 줄이 1 개면 구분자 없이 그 줄 자체가 결과가 된다.
  it('사유가 1 줄이면 구분자 없이 그 줄만 반환한다 (분기 — 단일 줄)', () => {
    const failure: SignupFailure = {
      kind: 'invalid-input',
      username: ['아이디를 입력해 주세요.'],
      password: [],
      other: [],
    };
    expect(buildSetupErrorMessage(failure)).toBe('아이디: 아이디를 입력해 주세요.');
  });

  // 분기 ② — 줄이 2+ 개면 구분자로 이어 붙이되 각 줄 원문이 그대로 남는다.
  it('사유가 2 줄 이상이면 구분자로 이어 붙이고 각 줄 원문을 보존한다 (분기 — 복수 줄)', () => {
    const failure: SignupFailure = {
      kind: 'invalid-input',
      username: ['아이디 A'],
      password: ['비밀번호 B'],
      other: ['기타 C'],
    };
    const message = buildSetupErrorMessage(failure);
    expect(message).toBe('아이디: 아이디 A / 비밀번호: 비밀번호 B / 기타: 기타 C');
    expect(message.split(' / ')).toHaveLength(3);
  });

  // 분기 ③ — 축이 전부 비어 있으면 사유를 지어내지 않고 fallback 문구를 반환한다.
  it('축이 전부 비어 있는 failure 는 사유를 지어내지 않고 fallback 문구를 반환한다 (분기 — 빈 목록)', () => {
    const empty: SignupFailure = { kind: 'unknown', username: [], password: [], other: [] };
    expect(buildSetupErrorMessage(empty)).toContain(UNRESOLVED_TOKEN);
  });

  // 분기 ③' — failure 자체가 null(비정상 2xx: role 도 failure 도 없음)인 경우도 같은 fallback.
  it('failure 가 null 인 비정상 응답도 fallback 문구로 처리한다 (분기 — null 입력)', () => {
    const message = buildSetupErrorMessage(null);
    expect(message).toContain(UNRESOLVED_TOKEN);
    // 네트워크/5xx catch 문구와 구분 가능해야 한다.
    expect(message).not.toContain('셋업 중 오류가 발생했습니다');
  });

  // negative ① — 어떤 실패 경로에서도 오너 금지 포괄 문구가 결과에 나타나지 않는다.
  it('어떤 실패 경로에서도 금지된 포괄 문구를 만들지 않는다 (negative — REQ-068 금지 문구)', () => {
    const candidates = [
      buildSetupErrorMessage(classifySignupFailure(409, '')),
      buildSetupErrorMessage(classifySignupFailure(400, '{"message":["email must be an email"]}')),
      buildSetupErrorMessage(classifySignupFailure(400, 'not-json')),
      buildSetupErrorMessage(classifySignupFailure(500, '')),
      buildSetupErrorMessage(null),
    ];
    for (const message of candidates) {
      expect(message).not.toContain(FORBIDDEN_GENERIC_MESSAGE);
    }
  });

  // negative ② — 사용자가 입력한 비밀번호 값이 결과 문자열에 섞이지 않는다(민감값 노출 금지).
  it('결과 문자열에 사용자가 입력한 비밀번호 값이 섞이지 않는다 (negative — 민감값 미노출)', () => {
    const secret = 'sup3rSecretPw!';
    const failure = classifySignupFailure(
      400,
      JSON.stringify({ message: ['password must be longer than or equal to 8 characters'] }),
    );
    expect(buildSetupErrorMessage(failure)).not.toContain(secret);
  });

  // negative ③ — 중복 결과와 형식/길이 결과가 서로 다른 문자열이다(REQ-069 구분 축).
  it('duplicate-username 결과와 invalid-input 결과가 서로 다른 문자열이다 (negative — REQ-069 구분)', () => {
    const duplicate = buildSetupErrorMessage(classifySignupFailure(409, ''));
    const invalid = buildSetupErrorMessage(
      classifySignupFailure(400, '{"message":["email must be an email"]}'),
    );
    expect(duplicate).not.toBe(invalid);
    // 중복 결과에는 형식 사유가, 형식 결과에는 중복 사유가 섞이지 않는다.
    expect(duplicate).not.toContain('email 형식이어야 합니다');
    expect(invalid).not.toContain('이미 등록된 아이디입니다');
  });

  // negative ④ — other 만 있는 failure(축 미상 5xx 등)에서도 원문이 유실되지 않는다.
  it('other 축만 있는 failure 에서도 원문 사유가 유실되지 않는다 (negative — 정보 유실 금지)', () => {
    const failure = classifySignupFailure(503, '');
    const message = buildSetupErrorMessage(failure);
    expect(message).toContain('기타:');
    expect(message).toContain('응답 상태 503');
    expect(message).not.toContain(UNRESOLVED_TOKEN);
  });
});

// R-112 — T-1717 인증 후 view 전환 내비게이션(대시보드 ↔ 관리) 검증 (REQ-070 slice 1).
// web 에 @testing-library/react 가 없어(ADR-0040 §5 새-dep 게이트) 클릭 상호작용은 발화할 수
// 없으므로, ① 정적 렌더 markup 대조(노출/미노출·활성 표식) ② 순수 함수 isNavItemActive 단위
// 검증 ③ 소스 문자열 drift guard 세 축으로 배선을 고정한다.

// 내비게이션 컨테이너의 안정 식별 토큰 (AppShell <nav className> 과 정합).
const NAV_TOKEN = 'app-shell-nav';

// 특정 항목의 <button> 여는 태그만 잘라낸다 — 속성 순서에 의존하지 않고 활성 표식을 단언하기 위함.
function navButtonTag(html: string, view: string): string {
  const match = html.match(new RegExp(`<button[^>]*${NAV_TOKEN}-item-${view}[^>]*>`));
  return match === null ? '' : match[0];
}

// 한 렌더 결과에 등장한 활성 표식 개수.
function activeMarkCount(html: string): number {
  return html.split('aria-current="page"').length - 1;
}

describe('AppShell 인증 후 내비게이션 (T-1717)', () => {
  // happy-path — 인증 후 진입 화면에 내비게이션 컨테이너와 두 항목 라벨이 모두 렌더된다.
  it('initialView=dashboard 렌더에 내비게이션 컨테이너와 두 항목 라벨을 모두 포함한다 (happy-path)', () => {
    const html = renderToStaticMarkup(<AppShell initialView="dashboard" />);
    expect(html).toContain(NAV_TOKEN);
    expect(html).toContain('<nav');
    expect(html).toContain('대시보드');
    expect(html).toContain('관리');
  });

  // 분기 ① — 현재 view 가 'dashboard' 면 대시보드 항목만 활성 표식을 갖는다.
  it('initialView=dashboard 면 대시보드 항목만 aria-current=page 를 갖는다 (분기 — dashboard 활성)', () => {
    const html = renderToStaticMarkup(<AppShell initialView="dashboard" />);
    expect(navButtonTag(html, 'dashboard')).toContain('aria-current="page"');
    expect(navButtonTag(html, 'admin')).not.toContain('aria-current="page"');
  });

  // 분기 ② — 현재 view 가 'admin' 이면 관리 항목이 활성이고 대시보드 항목은 아니다.
  it('initialView=admin 이면 관리 항목이 aria-current=page 이고 대시보드 항목은 아니다 (분기 — admin 활성)', () => {
    const html = renderToStaticMarkup(<AppShell initialView="admin" />);
    expect(navButtonTag(html, 'admin')).toContain('aria-current="page"');
    expect(navButtonTag(html, 'dashboard')).not.toContain('aria-current="page"');
  });

  // negative ① — 미인증 로그인 화면에는 내비게이션이 구조적으로 렌더되지 않는다.
  it('initialView=login 렌더에는 내비게이션 토큰이 부재한다 (negative — 미인증 노출 0)', () => {
    const html = renderToStaticMarkup(<AppShell initialView="login" />);
    expect(html).not.toContain(NAV_TOKEN);
    expect(html).not.toContain('aria-current="page"');
  });

  // negative ② — 초기 셋업 단계(미인증)에도 내비게이션이 노출되지 않는다.
  it('initialView=superadmin-setup 렌더에도 내비게이션 토큰이 부재한다 (negative — 셋업 단계 노출 0)', () => {
    const html = renderToStaticMarkup(<AppShell initialView="superadmin-setup" />);
    expect(html).not.toContain(NAV_TOKEN);
  });

  // negative ③ — 활성 표식은 한 렌더에 최대 1 개다(중복 표식 금지).
  it('한 렌더 결과에 aria-current=page 가 2 개 이상 등장하지 않는다 (negative — 활성 표식 중복 금지)', () => {
    expect(activeMarkCount(renderToStaticMarkup(<AppShell initialView="dashboard" />))).toBe(1);
    expect(activeMarkCount(renderToStaticMarkup(<AppShell initialView="admin" />))).toBe(1);
  });

  // negative ④ — 항목 목록에 미인증 view 가 섞이지 않는다(목록 오염 방지).
  it('AUTHED_NAV_ITEMS 에 미인증 view(login·superadmin-setup)가 섞여 있지 않다 (negative — 목록 오염 방지)', () => {
    const views = AUTHED_NAV_ITEMS.map((item) => item.view);
    expect(views).toEqual(['dashboard', 'admin']);
    expect(views).not.toContain('login');
    expect(views).not.toContain('superadmin-setup');
    // 라벨도 비어 있지 않아야 클릭 가능한 동선이 된다.
    for (const item of AUTHED_NAV_ITEMS) {
      expect(item.label.length).toBeGreaterThan(0);
    }
  });

  // negative ⑤ — 내비게이션 추가로 인증 후 화면에 미인증 폼이 새로 섞이지 않는다.
  it('initialView=admin 렌더에 LoginForm(로그인 버튼)·셋업 폼 제목이 섞이지 않는다 (negative — 미인증 폼 혼입 금지)', () => {
    const html = renderToStaticMarkup(<AppShell initialView="admin" />);
    expect(html).not.toContain(SETUP_TITLE);
    expect(html).not.toContain('name="username"');
    expect(html).not.toContain('type="password"');
    expect(html).not.toContain('enter-setup');
  });

  // drift guard — 상호작용 렌더 test 가 불가하므로 소스 문자열로 클릭 경로 배선을 대조한다
  // (AdminView.userlist-wiring.test.tsx 선례). '관리' 항목의 클릭이 setView('admin') 로
  // 귀결되는지: 항목 목록의 (view: 'admin', label: '관리') 쌍 + onClick 의 setView(item.view).
  it("소스에서 '관리' 항목의 클릭 경로가 setView('admin') 로 배선돼 있다 (drift guard)", () => {
    const source = readFileSync(new URL('./AppShell.tsx', import.meta.url), 'utf8');
    expect(source).toMatch(/\{\s*view:\s*'admin',\s*label:\s*'관리'\s*\}/);
    expect(source).toMatch(/onClick=\{\(\)\s*=>\s*setView\(item\.view\)\}/);
  });
});

describe('isNavItemActive (T-1717)', () => {
  // 분기 ③ — 동일 view 면 활성이다.
  it('현재 view 와 항목 view 가 같으면 true 를 반환한다 (분기 — 동일 view)', () => {
    expect(isNavItemActive('dashboard', 'dashboard')).toBe(true);
    expect(isNavItemActive('admin', 'admin')).toBe(true);
  });

  // 분기 ④ — 상이 view 면 비활성이다.
  it('현재 view 와 항목 view 가 다르면 false 를 반환한다 (분기 — 상이 view)', () => {
    expect(isNavItemActive('dashboard', 'admin')).toBe(false);
    expect(isNavItemActive('admin', 'dashboard')).toBe(false);
  });

  // error path — View 가 아닌 값(타입 우회)을 넘겨도 throw 없이 false 다.
  it('View 가 아닌 값을 넘겨도 throw 없이 false 를 반환한다 (error path — 타입 우회 입력)', () => {
    expect(() => isNavItemActive('' as View, '' as View)).not.toThrow();
    expect(isNavItemActive('' as View, '' as View)).toBe(false);
    expect(isNavItemActive(undefined as unknown as View, undefined as unknown as View)).toBe(false);
    expect(isNavItemActive(null as unknown as View, 'admin')).toBe(false);
    expect(isNavItemActive('admin', undefined as unknown as View)).toBe(false);
    expect(isNavItemActive(42 as unknown as View, 42 as unknown as View)).toBe(false);
  });

  // negative — 미인증 view 는 항목이 아니므로 스스로와 비교해도 활성이 아니다.
  it('미인증 view(login·superadmin-setup)는 자기 자신과 비교해도 false 다 (negative — 미인증 view 활성 금지)', () => {
    expect(isNavItemActive('login', 'login')).toBe(false);
    expect(isNavItemActive('superadmin-setup', 'superadmin-setup')).toBe(false);
    expect(isNavItemActive('login', 'dashboard')).toBe(false);
  });
});
