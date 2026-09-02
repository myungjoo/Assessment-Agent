import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AppShell, {
  AUTHED_NAV_ITEMS,
  RUN_STATUS_POLL_INTERVAL_MS,
  buildSetupErrorLines,
  buildSetupErrorMessage,
  isNavItemActive,
  restoredView,
  shouldLoadCurrentUser,
  shouldPollRunStatus,
  shouldRestoreSession,
  shouldShowLogout,
  visibleNavItems,
} from './AppShell';
import type { View } from './AppShell';
import type { CurrentUser } from './api/auth';
import { SETUP_ERROR_LINE_CLASS } from './components/SuperAdminSetupForm';
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

// T-1720 등급 차등 도입 이후, '관리'(editOnly) 항목이 렌더되는 전제는 "편집 권한 있는
// 등급이 적재된 상태" 다. 아래 T-1717 케이스들은 그 전제를 initialCurrentUser 로 명시해
// 종전 검증 의도(항목 노출 · 활성 표식 규칙)를 그대로 보존한다 — 삭제·약화가 아니라 보강.
const ADMIN_USER = { id: 'u-1', email: 'admin@example.com', role: 'Admin' };

describe('AppShell 인증 후 내비게이션 (T-1717)', () => {
  // happy-path — 인증 후 진입 화면에 내비게이션 컨테이너와 두 항목 라벨이 모두 렌더된다.
  it('initialView=dashboard 렌더에 내비게이션 컨테이너와 두 항목 라벨을 모두 포함한다 (happy-path)', () => {
    const html = renderToStaticMarkup(
      <AppShell initialView="dashboard" initialCurrentUser={ADMIN_USER} />,
    );
    expect(html).toContain(NAV_TOKEN);
    expect(html).toContain('<nav');
    expect(html).toContain('대시보드');
    expect(html).toContain('관리');
  });

  // 분기 ① — 현재 view 가 'dashboard' 면 대시보드 항목만 활성 표식을 갖는다.
  it('initialView=dashboard 면 대시보드 항목만 aria-current=page 를 갖는다 (분기 — dashboard 활성)', () => {
    const html = renderToStaticMarkup(
      <AppShell initialView="dashboard" initialCurrentUser={ADMIN_USER} />,
    );
    expect(navButtonTag(html, 'dashboard')).toContain('aria-current="page"');
    expect(navButtonTag(html, 'admin')).not.toContain('aria-current="page"');
  });

  // 분기 ② — 현재 view 가 'admin' 이면 관리 항목이 활성이고 대시보드 항목은 아니다.
  it('initialView=admin 이면 관리 항목이 aria-current=page 이고 대시보드 항목은 아니다 (분기 — admin 활성)', () => {
    const html = renderToStaticMarkup(
      <AppShell initialView="admin" initialCurrentUser={ADMIN_USER} />,
    );
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
    expect(
      activeMarkCount(
        renderToStaticMarkup(<AppShell initialView="dashboard" initialCurrentUser={ADMIN_USER} />),
      ),
    ).toBe(1);
    expect(
      activeMarkCount(
        renderToStaticMarkup(<AppShell initialView="admin" initialCurrentUser={ADMIN_USER} />),
      ),
    ).toBe(1);
  });

  // negative ④ — 항목 목록에 미인증 view 가 섞이지 않는다(목록 오염 방지).
  it('AUTHED_NAV_ITEMS 에 미인증 view(login·superadmin-setup)가 섞여 있지 않다 (negative — 목록 오염 방지)', () => {
    const views = AUTHED_NAV_ITEMS.map((item) => item.view);
    expect(views).toEqual(['dashboard', 'admin']);
    // T-1720 보강 — 편집 동선 표식은 '관리' 항목에만 붙고 조회 동선에는 붙지 않는다.
    expect(AUTHED_NAV_ITEMS.filter((item) => item.editOnly === true).map((item) => item.view)).toEqual([
      'admin',
    ]);
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
    // T-1720 보강 — 항목에 editOnly 표식이 추가돼도 (view, label) 쌍 대조 의도는 그대로다.
    expect(source).toMatch(/\{\s*view:\s*'admin',\s*label:\s*'관리'[,\s][^}]*\}/);
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

// R-112 — T-1720 등급별 내비게이션 노출 차등 검증 (REQ-073 slice 3).
// web 에 @testing-library/react 가 없어(ADR-0040 §5 새-dep 게이트) effect 를 실행하는
// 렌더 test 가 불가하므로, ① 순수 함수(visibleNavItems · shouldLoadCurrentUser) 단위 검증
// ② initialCurrentUser 주입 정적 렌더 markup 대조 ③ 소스 문자열 drift guard 세 축으로
// 배선을 고정한다(T-1717 선례 승계).

// 등급별 사용자 fixture — CurrentUser 계약({ id, email, role }) 그대로.
function userWithRole(role: string): CurrentUser {
  return { id: 'u-1', email: 'user@example.com', role };
}

// 항목 목록에서 view 문자열만 뽑는다 — 순서 의존 없이 포함/미포함을 단언하기 위함.
function viewsOf(items: ReadonlyArray<{ view: string }>): string[] {
  return items.map((item) => item.view);
}

// '관리' 항목의 안정 식별 토큰 (AppShell 의 app-shell-nav-item-${view} className 과 정합).
const ADMIN_ITEM_TOKEN = 'app-shell-nav-item-admin';

describe('visibleNavItems (T-1720)', () => {
  // happy-path ① — Admin 등급은 조회·편집 동선 두 항목을 모두 본다.
  it('Admin 등급이면 dashboard·admin 두 항목을 모두 포함한다 (happy-path)', () => {
    expect(viewsOf(visibleNavItems(userWithRole('Admin')))).toEqual(['dashboard', 'admin']);
  });

  // 분기 (b) — SuperAdmin 은 Admin 상위 등급이므로 편집 동선을 본다.
  it('SuperAdmin 등급이면 admin 항목을 포함한다 (분기 — 상위 등급)', () => {
    expect(viewsOf(visibleNavItems(userWithRole('SuperAdmin')))).toContain('admin');
  });

  // 분기 (c) + negative ① — User 등급은 조회 동선만 본다(REQ-073 "User 등급은 조회만").
  it('User 등급이면 admin 항목이 없고 dashboard 만 남는다 (분기/negative — 조회 전용)', () => {
    const views = viewsOf(visibleNavItems(userWithRole('User')));
    expect(views).toEqual(['dashboard']);
    expect(views).not.toContain('admin');
  });

  // 분기 (d) + error path — 적재 실패로 null 이 남아도 throw 없이 조회 항목만 반환한다.
  it('user 가 null 이면 throw 없이 조회 항목만 반환한다 (error path — 적재 실패 상태)', () => {
    expect(() => visibleNavItems(null)).not.toThrow();
    expect(viewsOf(visibleNavItems(null))).toEqual(['dashboard']);
  });

  // 분기 (e) — undefined(미적재) 도 동일하게 조회 전용이다.
  it('user 가 undefined 여도 조회 항목만 반환한다 (분기 — 미적재)', () => {
    expect(viewsOf(visibleNavItems(undefined))).toEqual(['dashboard']);
  });

  // 분기 (f) + negative ⑤ — 미지 등급을 권한 있음으로 해석하지 않는다(fail-safe).
  it("미지 등급('Root')은 admin 항목을 얻지 못한다 (분기/negative — 미지 등급 fail-safe)", () => {
    expect(viewsOf(visibleNavItems(userWithRole('Root')))).not.toContain('admin');
  });

  // negative ③ — 빈 문자열 role 도 편집 권한이 아니다.
  it("role 이 빈 문자열이면 admin 항목이 없다 (negative — 빈 등급)", () => {
    expect(viewsOf(visibleNavItems(userWithRole('')))).not.toContain('admin');
  });

  // negative ④ — 대소문자가 다른 'admin' 은 backend 토큰과 불일치이므로 거부한다.
  it("role 이 소문자 'admin' 이면 admin 항목이 없다 (negative — 대소문자 drift)", () => {
    expect(viewsOf(visibleNavItems(userWithRole('admin')))).not.toContain('admin');
  });
});

describe('shouldLoadCurrentUser (T-1720)', () => {
  // 분기 (g) — 인증 view + 미적재면 적재한다.
  it('인증 view 이고 사용자가 없으면 true 다 (분기 — 적재 필요)', () => {
    expect(shouldLoadCurrentUser('dashboard', null)).toBe(true);
    expect(shouldLoadCurrentUser('admin', undefined)).toBe(true);
  });

  // 분기 (h) — 이미 적재됐으면 중복 조회하지 않는다.
  it('이미 사용자가 적재돼 있으면 false 다 (분기 — 중복 조회 방지)', () => {
    expect(shouldLoadCurrentUser('dashboard', userWithRole('User'))).toBe(false);
    expect(shouldLoadCurrentUser('admin', userWithRole('Admin'))).toBe(false);
  });

  // 분기 (i) — 미인증 view(login)에서는 조회하지 않는다.
  it('login view 에서는 사용자가 없어도 false 다 (분기 — 미인증 view)', () => {
    expect(shouldLoadCurrentUser('login', null)).toBe(false);
  });

  // 분기 (j) — 초기 셋업 단계에서도 조회하지 않는다.
  it('superadmin-setup view 에서는 사용자가 없어도 false 다 (분기 — 셋업 단계)', () => {
    expect(shouldLoadCurrentUser('superadmin-setup', null)).toBe(false);
  });

  // error path — 타입을 우회한 비정상 view 를 넘겨도 throw 없이 false 다.
  it('View 가 아닌 값을 넘겨도 throw 없이 false 를 반환한다 (error path — 타입 우회 입력)', () => {
    expect(() => shouldLoadCurrentUser('' as View, null)).not.toThrow();
    expect(shouldLoadCurrentUser('' as View, null)).toBe(false);
    expect(shouldLoadCurrentUser(undefined as unknown as View, null)).toBe(false);
    expect(shouldLoadCurrentUser(42 as unknown as View, null)).toBe(false);
  });
});

describe('AppShell 등급별 내비게이션 렌더 (T-1720)', () => {
  // happy-path ② — Admin 등급 주입 시 '관리' 버튼이 정적 렌더 결과에 존재한다.
  it('Admin 등급 주입 렌더에 관리 항목 버튼이 존재한다 (happy-path)', () => {
    const html = renderToStaticMarkup(
      <AppShell initialView="dashboard" initialCurrentUser={userWithRole('Admin')} />,
    );
    expect(html).toContain(ADMIN_ITEM_TOKEN);
    expect(html).toContain('관리');
    expect(html).toContain('대시보드');
  });

  // negative ② — User 등급 주입 렌더에는 '관리' 라벨도 식별 토큰도 없다.
  it('User 등급 주입 렌더에 관리 라벨과 식별 토큰이 모두 부재한다 (negative — 편집 동선 노출 0)', () => {
    const html = renderToStaticMarkup(
      <AppShell initialView="dashboard" initialCurrentUser={userWithRole('User')} />,
    );
    expect(html).not.toContain(ADMIN_ITEM_TOKEN);
    expect(html).not.toContain('관리');
    // 조회 동선은 그대로 남는다.
    expect(html).toContain('대시보드');
    expect(html).toContain('app-shell-nav-item-dashboard');
  });

  // negative ⑥ — 미주입(적재 전) 초기 상태도 조회 전용이며 대시보드는 무회귀로 렌더된다.
  it('initialCurrentUser 미주입 렌더는 관리 미노출 + 대시보드 노출이다 (negative — 적재 전 fail-safe)', () => {
    const html = renderToStaticMarkup(<AppShell initialView="dashboard" />);
    expect(html).not.toContain(ADMIN_ITEM_TOKEN);
    expect(html).toContain('app-shell-nav-item-dashboard');
    expect(html).toContain('대시보드');
  });

  // drift guard — effect 배선(적재 판단 · 1 회 호출 · 실패 흡수 · cancel 플래그)은 정적
  // 렌더로 발화되지 않으므로 소스 문자열로 대조한다(AdminView.userlist-wiring 선례).
  it('소스에서 등급 적재 effect 와 내비 필터가 배선돼 있다 (drift guard)', () => {
    const source = readFileSync(new URL('./AppShell.tsx', import.meta.url), 'utf8');
    // 내비게이션이 원본 목록이 아니라 필터 결과를 map 한다.
    expect(source).toMatch(/visibleNavItems\(currentUser\)\.map\(/);
    // 적재 판단 게이트 + 실 조회 helper 호출.
    expect(source).toMatch(/if\s*\(!shouldLoadCurrentUser\(view,\s*currentUser\)\)/);
    expect(source).toMatch(/fetchCurrentUser\(\)/);
    // 실패 흡수(catch) 와 경쟁 상태 cancel 플래그.
    expect(source).toMatch(/\.catch\(\(\)\s*=>\s*\{/);
    expect(source).toMatch(/cancelled\s*=\s*true/);
    // 등급 판정은 roleAccess 정본에 위임한다 — 등급 비교를 이 파일에 재구현하지 않는다.
    expect(source).toMatch(/from '\.\/api\/roleAccess'/);
    expect(source).toMatch(/canEditAssessmentTargets\(user\)/);
    // 항목 표식(editOnly)으로 필터하며 view 문자열을 함수 안에 하드코딩하지 않는다.
    expect(source).toMatch(/item\.editOnly === true/);
  });
});

// R-112 — T-1834 셋업 실패 사유의 줄 단위 전달(REQ-084) 검증.
// 종전 buildSetupErrorMessage 는 사유 줄들을 ' / ' 로 합쳐 폼의 error 한 칸에 밀어 넣었다 —
// 사유가 2 개 이상이면 줄 경계가 사라진다. 본 slice 는 줄 배열을 정본으로 두고(buildSetupErrorLines)
// 문자열 변환은 그 결과를 잇기만 하게 재정의했다. 실 제출 경로(handleSetupSubmit)는 이벤트
// 발화가 필요해 정적 렌더로 볼 수 없으므로 ① 순수 함수 단위 검증 ② initialSetupErrorLines
// 주입 정적 렌더 ③ 소스 문자열 drift guard 세 축으로 배선을 고정한다(T-1720 선례 승계).

// 줄 element 의 안정 식별 토큰 (SuperAdminSetupForm SETUP_ERROR_LINE_CLASS 와 정합).
const ERROR_LINE_OPEN_TAG = `<p class="${SETUP_ERROR_LINE_CLASS}">`;

describe('buildSetupErrorLines (T-1834)', () => {
  // happy-path — 409 중복 실패는 중복 전용 사유 한 줄이 된다(REQ-069 중복 축).
  it('duplicate-username failure 를 중복 전용 사유 한 줄로 만든다 (happy-path)', () => {
    const lines = buildSetupErrorLines(classifySignupFailure(409, '{"message":"Conflict"}'));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('아이디:');
    expect(lines[0]).toContain('이미 등록된 아이디입니다');
  });

  // happy-path ② — 두 축이 동시에 위반이면 줄이 두 개로 나뉘고 원문이 각각 보존된다.
  it('아이디·비밀번호 동시 위반을 두 줄로 나누고 원문을 보존한다 (happy-path — 줄 분리)', () => {
    const lines = buildSetupErrorLines(
      classifySignupFailure(
        400,
        JSON.stringify({
          message: [
            'email must be an email',
            'password must be longer than or equal to 8 characters',
          ],
        }),
      ),
    );
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('아이디:');
    expect(lines[1]).toContain('비밀번호:');
    // 한 줄 안에 두 축이 섞이면 줄 분리가 무의미해진다.
    expect(lines[0]).not.toContain('비밀번호:');
  });

  // error path ① — failure 가 null(비정상 2xx) 이면 사유를 지어내지 않고 fallback 한 줄이다.
  it('failure 가 null 이면 fallback 문구 한 줄을 반환한다 (error path — null 입력)', () => {
    const lines = buildSetupErrorLines(null);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain(UNRESOLVED_TOKEN);
  });

  // error path ② — 축이 전부 비어 있는 failure 도 같은 fallback 한 줄이다(빈 배열 반환 금지).
  it('축이 전부 비어 있으면 빈 배열이 아니라 fallback 한 줄을 반환한다 (error path — 빈 목록)', () => {
    const empty: SignupFailure = { kind: 'unknown', username: [], password: [], other: [] };
    const lines = buildSetupErrorLines(empty);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain(UNRESOLVED_TOKEN);
  });

  // 분기 — other 축만 있는 failure(축 미상 5xx 등)에서도 원문이 유실되지 않는다.
  it('other 축만 있는 failure 의 원문도 한 줄로 보존한다 (분기 — 기타 축)', () => {
    const lines = buildSetupErrorLines(classifySignupFailure(503, ''));
    expect(lines.join('')).toContain('기타:');
    expect(lines.join('')).toContain('응답 상태 503');
    expect(lines.join('')).not.toContain(UNRESOLVED_TOKEN);
  });

  // negative ① — 어떤 줄 안에도 구분자 ' / ' 가 남아있지 않다(합침 잔재 0).
  it('어떤 줄 안에도 구분자가 남지 않는다 (negative — 합침 잔재 0)', () => {
    const failure = classifySignupFailure(
      400,
      JSON.stringify({
        message: ['email must be an email', 'password must be longer than or equal to 8 characters'],
      }),
    );
    for (const line of buildSetupErrorLines(failure)) {
      expect(line).not.toContain(' / ');
    }
  });

  // negative ② — 어떤 실패 경로에서도 오너 금지 포괄 문구가 줄에 나타나지 않는다(REQ-068).
  it('어떤 실패 경로에서도 금지된 포괄 문구를 만들지 않는다 (negative — REQ-068 금지 문구)', () => {
    const candidates = [
      buildSetupErrorLines(classifySignupFailure(409, '')),
      buildSetupErrorLines(classifySignupFailure(400, '{"message":["email must be an email"]}')),
      buildSetupErrorLines(classifySignupFailure(400, 'not-json')),
      buildSetupErrorLines(classifySignupFailure(500, '')),
      buildSetupErrorLines(null),
    ];
    for (const lines of candidates) {
      // 줄이 하나도 없으면 사용자에게 아무 안내도 못 하므로 빈 배열 자체를 금지한다.
      expect(lines.length).toBeGreaterThan(0);
      expect(lines.join(' ')).not.toContain(FORBIDDEN_GENERIC_MESSAGE);
    }
  });

  // negative ③ — 사용자가 입력한 비밀번호 값이 줄에 섞이지 않는다(민감값 노출 금지).
  it('줄에 사용자가 입력한 비밀번호 값이 섞이지 않는다 (negative — 민감값 미노출)', () => {
    const secret = 'sup3rSecretPw!';
    const lines = buildSetupErrorLines(
      classifySignupFailure(
        400,
        JSON.stringify({ message: ['password must be longer than or equal to 8 characters'] }),
      ),
    );
    expect(lines.join(' ')).not.toContain(secret);
  });

  // 중복 구현 금지 — 문자열 변환은 줄 배열을 잇기만 한다(두 함수가 따로 사유를 만들지 않는다).
  it('buildSetupErrorMessage 는 줄 배열을 구분자로 이은 결과와 항상 같다 (계약 — 단일 정본)', () => {
    const failures: Array<SignupFailure | null> = [
      classifySignupFailure(409, ''),
      classifySignupFailure(400, '{"message":["email must be an email"]}'),
      classifySignupFailure(503, ''),
      null,
    ];
    for (const failure of failures) {
      expect(buildSetupErrorMessage(failure)).toBe(buildSetupErrorLines(failure).join(' / '));
    }
  });
});

describe('AppShell 셋업 오류 줄 단위 렌더 (T-1834)', () => {
  // happy-path — 줄 배열을 주입하면 폼이 줄마다 별도 element 로 렌더한다(합침 0).
  it('initialSetupErrorLines 주입 시 줄마다 별도 element 로 렌더한다 (happy-path)', () => {
    const html = renderToStaticMarkup(
      <AppShell
        initialView="superadmin-setup"
        initialSetupErrorLines={['아이디: 이미 등록된 아이디입니다.', '비밀번호: 최소 8자 이상']}
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain(`${ERROR_LINE_OPEN_TAG}아이디: 이미 등록된 아이디입니다.</p>`);
    expect(html).toContain(`${ERROR_LINE_OPEN_TAG}비밀번호: 최소 8자 이상</p>`);
    // 종전처럼 한 줄로 합쳐졌다면 이 단언이 깨진다.
    expect(html).not.toContain('아이디: 이미 등록된 아이디입니다. / 비밀번호: 최소 8자 이상');
  });

  // 분기 — 줄 배열이 비어 있으면 기존 단일 문자열 경로(initialSetupError)가 그대로 동작한다.
  it('줄 배열이 비어 있으면 initialSetupError 문자열 경로로 렌더한다 (분기 — 문자열 fallback 무회귀)', () => {
    const html = renderToStaticMarkup(
      <AppShell
        initialView="superadmin-setup"
        initialSetupError="셋업 실패"
        initialSetupErrorLines={[]}
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('셋업 실패');
    expect(html).not.toContain(SETUP_ERROR_LINE_CLASS);
  });

  // negative — 둘 다 미주입이면 셋업 화면에 오류 영역이 없다(빈 alert 미렌더).
  it('오류 주입이 없으면 셋업 화면에 alert 영역이 없다 (negative — 빈 alert 미렌더)', () => {
    const html = renderToStaticMarkup(<AppShell initialView="superadmin-setup" />);
    expect(html).toContain('초기 셋업');
    expect(html).not.toContain('role="alert"');
  });

  // drift guard — 실 실패 경로의 state 갱신·폼 배선은 이벤트 발화가 필요해 정적 렌더로
  // 볼 수 없으므로 소스 문자열로 대조한다(T-1720 drift guard 선례).
  it('소스에서 실패 경로가 줄 배열 state 를 갱신하고 폼에 errorLines 로 내려간다 (drift guard)', () => {
    const source = readFileSync(new URL('./AppShell.tsx', import.meta.url), 'utf8');
    // 실패 분기가 줄 배열 정본 helper 로 state 를 갱신한다.
    expect(source).toMatch(/setSetupErrorLines\(buildSetupErrorLines\(failure\)\)/);
    // throw 경로도 같은 줄 배열 경로를 쓴다.
    expect(source).toMatch(/setSetupErrorLines\(\[SETUP_THROWN_ERROR_MESSAGE\]\)/);
    // 소비처 배선 — 폼에 errorLines prop 으로 내려간다.
    expect(source).toMatch(/errorLines=\{setupErrorLines\}/);
    // 단일 문자열 변환은 줄 배열을 잇기만 한다(사유 산출 로직 중복 0).
    expect(source).toMatch(/buildSetupErrorLines\(failure\)\.join\(SETUP_ERROR_SEPARATOR\)/);
    // 실패 표시를 다시 단일 문자열 state 로 되돌리는 회귀 감시.
    expect(source).not.toMatch(/setSetupError\(buildSetupErrorMessage\(/);
  });
});

// 로그아웃 컨트롤의 안정 식별 토큰 (AppShell 의 LOGOUT_CLASS 와 정합).
const LOGOUT_TOKEN = 'app-shell-logout';
const LOGOUT_LABEL = '로그아웃';

// 렌더 결과에서 로그아웃 버튼 토큰이 등장한 횟수 — 중복 렌더 감시용.
function logoutTokenCount(html: string): number {
  return html.split(LOGOUT_TOKEN).length - 1;
}

describe('shouldShowLogout (T-1837)', () => {
  // happy-path — 인증 후 view 에서는 노출한다.
  it('인증 후 view 에서 true 를 반환한다 (happy-path / 분기 다 — true)', () => {
    expect(shouldShowLogout('dashboard')).toBe(true);
    expect(shouldShowLogout('admin')).toBe(true);
  });

  // 분기 (라) — 미인증 view 에서는 노출하지 않는다.
  it('미인증 view(login · superadmin-setup)에서 false 를 반환한다 (분기 라 — false)', () => {
    expect(shouldShowLogout('login')).toBe(false);
    expect(shouldShowLogout('superadmin-setup')).toBe(false);
  });

  // negative / error path — 타입을 우회한 런타임 입력도 throw 없이 false 다.
  it('View 가 아닌 값을 넘겨도 throw 없이 false 다 (negative — 타입 우회 입력)', () => {
    expect(() => shouldShowLogout('' as View)).not.toThrow();
    expect(shouldShowLogout('' as View)).toBe(false);
    expect(shouldShowLogout(undefined as unknown as View)).toBe(false);
    expect(shouldShowLogout(42 as unknown as View)).toBe(false);
  });

  // negative — 판정 근거가 AUTHED_NAV_ITEMS(isAuthedView) 하나임을 고정한다.
  // 항목 목록에 있는 view 는 모두 true, 그 밖은 false — view 문자열 재하드코딩 감시.
  it('AUTHED_NAV_ITEMS 의 view 는 모두 true 이고 그 밖은 false 다 (negative — 판정 근거 이중화 금지)', () => {
    for (const item of AUTHED_NAV_ITEMS) {
      expect(shouldShowLogout(item.view)).toBe(true);
    }
    expect(shouldShowLogout('login')).toBe(false);
  });
});

describe('AppShell 로그아웃 동선 렌더 (T-1837)', () => {
  // happy-path — 인증 후 정적 렌더에 로그아웃 버튼이 정확히 1 개 있다.
  it('initialView=dashboard 렌더에 로그아웃 버튼이 1 개 존재한다 (happy-path)', () => {
    const html = renderToStaticMarkup(
      <AppShell initialView="dashboard" initialCurrentUser={ADMIN_USER} />,
    );
    expect(html).toContain(LOGOUT_TOKEN);
    expect(html).toContain(LOGOUT_LABEL);
    expect(logoutTokenCount(html)).toBe(1);
    // reviewer N1 — 버튼이 type="button" 으로 렌더되는지까지 고정한다. 속성이 빠지면
    // 폼 안으로 옮겨질 때 암묵 submit 으로 동작하는 회귀가 생긴다.
    expect(html).toMatch(new RegExp(`<button type="button" class="${LOGOUT_TOKEN}"`));
  });

  // 분기 — 관리 화면에서도 동일하게 노출된다(특정 view 전용이 아님).
  it('initialView=admin 렌더에도 로그아웃 버튼이 존재한다 (분기 — 인증 후 공통 동선)', () => {
    const html = renderToStaticMarkup(
      <AppShell initialView="admin" initialCurrentUser={ADMIN_USER} />,
    );
    expect(html).toContain(LOGOUT_TOKEN);
  });

  // 분기 — 등급 필터 대상이 아니다. 편집 권한이 없는 User 등급에도 노출된다.
  it('User 등급 주입 렌더에도 로그아웃 버튼이 존재한다 (분기 — 등급 필터 비대상)', () => {
    const html = renderToStaticMarkup(
      <AppShell initialView="dashboard" initialCurrentUser={userWithRole('User')} />,
    );
    expect(html).toContain(LOGOUT_TOKEN);
    // 편집 동선은 여전히 필터된다 — 로그아웃 추가가 등급 차등을 무너뜨리지 않는다.
    expect(html).not.toContain(ADMIN_ITEM_TOKEN);
  });

  // negative ① — 미인증 로그인 화면에는 로그아웃 컨트롤이 없다.
  it('initialView=login 렌더에 로그아웃 토큰과 라벨이 모두 부재한다 (negative — 미인증 노출 0)', () => {
    const html = renderToStaticMarkup(<AppShell initialView="login" />);
    expect(html).not.toContain(LOGOUT_TOKEN);
    expect(html).not.toContain(LOGOUT_LABEL);
  });

  // negative ② — 초기 셋업 단계(미인증)에도 노출되지 않는다.
  it('initialView=superadmin-setup 렌더에도 로그아웃 토큰이 부재한다 (negative — 셋업 단계 노출 0)', () => {
    const html = renderToStaticMarkup(<AppShell initialView="superadmin-setup" />);
    expect(html).not.toContain(LOGOUT_TOKEN);
    expect(html).not.toContain(LOGOUT_LABEL);
  });

  // negative ③ — 로그아웃 마크업에 사용자 자격증명 문자열이 새지 않는다.
  it('인증 후 렌더에 사용자 email·id 문자열이 노출되지 않는다 (negative — 자격증명 유출 0)', () => {
    const user = userWithRole('Admin');
    const html = renderToStaticMarkup(
      <AppShell initialView="dashboard" initialCurrentUser={user} />,
    );
    expect(html).toContain(LOGOUT_TOKEN);
    expect(html).not.toContain(user.email);
    expect(html).not.toContain(user.id);
    expect(html).not.toContain('password');
  });

  // negative ④ — 로그아웃 버튼은 AUTHED_NAV_ITEMS 목록에 섞이지 않는다(등급 필터 오염 방지).
  it('AUTHED_NAV_ITEMS 에 로그아웃 항목이 섞여 있지 않다 (negative — 목록 오염 방지)', () => {
    expect(viewsOf(AUTHED_NAV_ITEMS)).toEqual(['dashboard', 'admin']);
    for (const item of AUTHED_NAV_ITEMS) {
      expect(item.label).not.toBe(LOGOUT_LABEL);
    }
  });

  // negative ⑤ — 로그아웃 직후 상태(view='login' + 사용자 미적재)에서 GET /api/auth/me
  // 재적재 루프가 생기지 않는다. shouldLoadCurrentUser 가 false 를 유지해야 한다.
  it("로그아웃 직후 상태(view='login', currentUser=null)에서 재적재하지 않는다 (negative — 재적재 루프 0)", () => {
    expect(shouldLoadCurrentUser('login', null)).toBe(false);
    expect(shouldLoadCurrentUser('login', undefined)).toBe(false);
  });

  // drift guard — 클릭 상호작용 test 가 불가하므로(ADR-0040 §5 새-dep 게이트) 소스
  // 문자열로 세션 종료 배선 3 종을 대조한다(T-1717 · T-1834 drift guard 선례).
  it('소스에서 로그아웃 핸들러가 세션 상태 3 종을 초기화한다 (drift guard)', () => {
    const source = readFileSync(new URL('./AppShell.tsx', import.meta.url), 'utf8');
    // helper 를 await 한다 — 반환값 분기 없이 아래 정리를 항상 수행한다.
    expect(source).toMatch(/await authLogout\(\);/);
    // ① 등급 초기화 ② 미인증 view 복귀 ③ AuthGate remount 를 위한 세대 증가.
    expect(source).toMatch(/setCurrentUser\(null\);/);
    expect(source).toMatch(/setView\('login'\);/);
    expect(source).toMatch(/setSessionEpoch\(\(epoch\) => epoch \+ 1\);/);
    // AuthGate 내부 authenticated 초기화 경로 — key remount + 현재 view 기준 초기값.
    expect(source).toMatch(/key=\{sessionEpoch\}/);
    expect(source).toMatch(/initialAuthenticated=\{isAuthedView\(view\)\}/);
    // 버튼 클릭이 실제로 핸들러로 귀결되는지.
    expect(source).toMatch(/void handleLogout\(\);/);
    // 회귀 감시 — 초기값 근거가 initialView 로 되돌아가면 remount 가 무력화된다.
    expect(source).not.toMatch(/initialAuthenticated=\{isAuthedView\(initialView\)\}/);
  });
});

// R-112 — T-1838 부트 세션 복원 hydration(REQ-082) 검증.
// 실 부트 effect 는 정적 렌더(renderToStaticMarkup)로 발화되지 않고 web 에는
// @testing-library/react 가 없으므로(ADR-0040 §5 새-dep 게이트), ① 순수 helper 단위 검증
// ② 미인증 정적 렌더 무회귀 ③ 소스 문자열 drift guard 세 축으로 배선을 고정한다
// (T-1720 · T-1834 · T-1837 선례 승계).

describe('shouldRestoreSession (T-1838)', () => {
  // happy-path / 분기 (가) — 미인증 진입점 + 미시도 + 미적재면 복원을 시도한다.
  it('login view 이고 미시도 · 미적재면 true 다 (happy-path / 분기 가)', () => {
    expect(shouldRestoreSession('login', false, null)).toBe(true);
    expect(shouldRestoreSession('login', false, undefined)).toBe(true);
  });

  // 분기 (나) — 이미 한 번 시도했으면 다시 시도하지 않는다(재시도 루프 0).
  it('이미 시도했으면 false 다 (분기 나 — 1 회 제한)', () => {
    expect(shouldRestoreSession('login', true, null)).toBe(false);
    expect(shouldRestoreSession('login', true, undefined)).toBe(false);
  });

  // 분기 (다) — 인증 후 view 는 복원 대상이 아니다(등급 적재 effect 소관).
  it('인증 후 view 에서는 false 다 (분기 다 — 복원 대상 아님)', () => {
    expect(shouldRestoreSession('dashboard', false, null)).toBe(false);
    expect(shouldRestoreSession('admin', false, null)).toBe(false);
  });

  // 분기 (라) — 이미 사용자가 적재돼 있으면 복원할 것이 없다.
  it('이미 사용자가 적재돼 있으면 false 다 (분기 라 — 중복 조회 방지)', () => {
    expect(shouldRestoreSession('login', false, ADMIN_USER)).toBe(false);
    expect(shouldRestoreSession('login', false, userWithRole('User'))).toBe(false);
  });

  // negative ① — 셋업 view 는 사용자가 의도적으로 들어온 화면이라 복원이 가로채지 않는다.
  it("superadmin-setup view 에서는 false 다 (negative — 셋업 화면 가로채기 0)", () => {
    expect(shouldRestoreSession('superadmin-setup', false, null)).toBe(false);
    expect(shouldRestoreSession('superadmin-setup', false, undefined)).toBe(false);
  });

  // negative ② / error path — 타입을 우회한 view 입력도 throw 없이 false 다.
  it('View 가 아닌 값을 넘겨도 throw 없이 false 다 (negative — 타입 우회 view)', () => {
    expect(() => shouldRestoreSession('' as View, false, null)).not.toThrow();
    expect(shouldRestoreSession('' as View, false, null)).toBe(false);
    expect(shouldRestoreSession(undefined as unknown as View, false, null)).toBe(false);
    expect(shouldRestoreSession(42 as unknown as View, false, null)).toBe(false);
  });

  // negative ③ — 타입을 우회한 시도 플래그는 "시도함" 쪽으로 안전하게 쏠린다.
  it('attempted 가 boolean 이 아니면 false 다 (negative — 타입 우회 플래그 fail-safe)', () => {
    expect(shouldRestoreSession('login', undefined as unknown as boolean, null)).toBe(false);
    expect(shouldRestoreSession('login', 0 as unknown as boolean, null)).toBe(false);
    expect(shouldRestoreSession('login', 'false' as unknown as boolean, null)).toBe(false);
  });

  // negative ④ — 로그아웃 직후(view='login' + 사용자 null)에도 시도 플래그가 true 라
  // 자동 재로그인이 일어나지 않는다.
  it('로그아웃 직후 상태에서는 복원을 재시도하지 않는다 (negative — 자동 재로그인 0)', () => {
    expect(shouldRestoreSession('login', true, null)).toBe(false);
  });
});

describe('restoredView (T-1838)', () => {
  // happy-path / 분기 (마) — 유효한 사용자면 인증 후 기본 view 로 간다.
  it('유효한 사용자 객체면 dashboard 를 반환한다 (happy-path / 분기 마)', () => {
    expect(restoredView(ADMIN_USER)).toBe('dashboard');
    expect(restoredView(userWithRole('User'))).toBe('dashboard');
  });

  // error path / 분기 (바) — 사용자가 없으면 미인증 진입점을 유지한다(throw 0).
  it('null · undefined 면 throw 없이 login 을 반환한다 (error path / 분기 바)', () => {
    expect(() => restoredView(null)).not.toThrow();
    expect(restoredView(null)).toBe('login');
    expect(restoredView(undefined)).toBe('login');
  });

  // negative ① — 비객체 body(문자열 · 배열)에 인증 후 view 를 주지 않는다.
  it('비객체 사용자(문자열 · 배열)면 login 을 반환한다 (negative — 비객체 방어)', () => {
    expect(restoredView('admin@example.com' as unknown as CurrentUser)).toBe('login');
    expect(restoredView([] as unknown as CurrentUser)).toBe('login');
    expect(restoredView(42 as unknown as CurrentUser)).toBe('login');
  });

  // negative ② — 빈 객체 · 필드 누락도 유효한 사용자가 아니다(fetchCurrentUser 계약 동형).
  it('빈 객체 · 필드 누락이면 login 을 반환한다 (negative — 필드 계약 미충족)', () => {
    expect(restoredView({} as unknown as CurrentUser)).toBe('login');
    expect(restoredView({ id: 'u-1' } as unknown as CurrentUser)).toBe('login');
    expect(
      restoredView({ id: 'u-1', email: 'a@b.c', role: 7 } as unknown as CurrentUser),
    ).toBe('login');
  });

  // negative ③ — 반환 view 는 기존 상수 두 개뿐이며 새 문자열을 지어내지 않는다.
  it('반환값은 인증 후 기본 view 또는 미인증 진입점뿐이다 (negative — view 문자열 신설 0)', () => {
    expect(viewsOf(AUTHED_NAV_ITEMS)).toContain(restoredView(ADMIN_USER));
    expect(viewsOf(AUTHED_NAV_ITEMS)).not.toContain(restoredView(null));
  });
});

describe('AppShell 부트 세션 복원 배선 (T-1838)', () => {
  // negative — 미인증 진입 정적 렌더는 무회귀다(복원 전에는 인증 후 동선이 없다).
  it('initialView=login 정적 렌더에 인증 후 내비·로그아웃이 부재한다 (negative — 무회귀)', () => {
    const html = renderToStaticMarkup(<AppShell initialView="login" />);
    expect(html).not.toContain(LOGOUT_TOKEN);
    expect(html).not.toContain(ADMIN_ITEM_TOKEN);
    expect(html).not.toContain('app-shell-nav-item-dashboard');
    // 로그인 화면 자체는 그대로 렌더된다.
    expect(html).toContain('초기 셋업');
  });

  // 중복 조회 감시 — 복원이 성공해 사용자가 채워지면 등급 적재 effect 는 다시 부르지 않는다.
  it('복원 성공 후 상태에서는 등급 적재를 다시 하지 않는다 (분기 — GET /api/auth/me 1 회)', () => {
    const restored = restoredView(ADMIN_USER);
    expect(shouldLoadCurrentUser(restored, ADMIN_USER)).toBe(false);
    // 반대로 복원 전(미적재) 인증 후 view 였다면 적재가 필요했다 — 대조군.
    expect(shouldLoadCurrentUser(restored, null)).toBe(true);
  });

  // drift guard — 부트 effect 는 정적 렌더로 발화되지 않으므로 소스 문자열로 대조한다.
  it('소스에서 부트 복원 effect 가 배선돼 있다 (drift guard)', () => {
    const source = readFileSync(new URL('./AppShell.tsx', import.meta.url), 'utf8');
    // 시도 게이트 + 실 조회 helper 호출.
    expect(source).toMatch(
      /if\s*\(!shouldRestoreSession\(view,\s*restoreAttempted,\s*currentUser\)\)/,
    );
    expect(source).toMatch(/fetchCurrentUser\(\)/);
    // reviewer N1 — 위 단언은 기존 등급 적재 effect 만으로도 통과하므로, 부트 effect 가
    // 실제로 조회를 부르는지를 호출 개수(등급 적재 + 부트 복원 = 2 곳)로 고정한다.
    expect(source.match(/void fetchCurrentUser\(\)/g) ?? []).toHaveLength(2);
    // 성공 경로 3 종 — 등급 적재 · view 전환 · AuthGate remount 세대 증가.
    expect(source).toMatch(/setCurrentUser\(user\);/);
    expect(source).toMatch(/setView\(restoredView\(user\)\);/);
    expect(source).toMatch(/setSessionEpoch\(\(epoch\) => epoch \+ 1\);/);
    // 성공·실패 어느 쪽이든 시도를 확정한다(재시도 루프 0) + 실패 흡수 catch.
    expect(source).toMatch(/setRestoreAttempted\(true\);/);
    expect(source).toMatch(/\.catch\(\(\)\s*=>\s*\{/);
    // 언마운트 경쟁 상태 방어.
    expect(source).toMatch(/cancelled\s*=\s*true/);
    // reviewer N2 — 성공 경로의 늦은 setState 방어까지 고정한다. 이 조기 반환이 빠지면
    // 복원 응답이 늦게 도착했을 때 사용자가 이동한 셋업 화면을 가로채는 회귀가 생긴다.
    expect(source).toMatch(/if\s*\(cancelled\)\s*\{\s*return;/);
    // 판정 근거는 미인증 진입점 상수 하나다 — helper 안에 view 문자열 재하드코딩 금지.
    expect(source).toMatch(/const UNAUTHED_ENTRY_VIEW: View = 'login';/);
    expect(source).toMatch(/view === UNAUTHED_ENTRY_VIEW/);
  });

  // 회귀 감시 — handleLogout 이 시도 플래그를 되돌리면 로그아웃 즉시 자동 재로그인된다.
  it('소스에서 로그아웃이 시도 플래그를 되돌리지 않는다 (negative — 자동 재로그인 회귀 감시)', () => {
    const source = readFileSync(new URL('./AppShell.tsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/setRestoreAttempted\(false\)/);
    // AuthGate 초기 인증 여부 근거가 현재 view 임을 함께 고정한다 — 복원 remount 가
    // 인증 후 화면으로 열리는 근거다(T-1837 배선 승계).
    expect(source).toMatch(/initialAuthenticated=\{isAuthedView\(view\)\}/);
  });
});

describe('shouldPollRunStatus (T-1849)', () => {
  // happy-path — 인증 후 view 이고 문서가 가시면 조회한다.
  it('인증 후 view + 가시 문서면 true 다 (happy-path)', () => {
    expect(shouldPollRunStatus('dashboard', false)).toBe(true);
    expect(shouldPollRunStatus('admin', false)).toBe(true);
  });

  // 분기 ① — 인증 후 view 라도 탭이 숨겨져 있으면 멈춘다(ADR-0060 §Decision 5).
  it('인증 후 view 라도 비가시면 false 다 (분기 — 탭 비가시 중단)', () => {
    expect(shouldPollRunStatus('dashboard', true)).toBe(false);
    expect(shouldPollRunStatus('admin', true)).toBe(false);
  });

  // 분기 ② — 미인증 view 는 가시 여부와 무관하게 조회하지 않는다(401 로 귀결).
  it('미인증 view 는 가시여도 false 다 (분기 — login · superadmin-setup)', () => {
    expect(shouldPollRunStatus('login', false)).toBe(false);
    expect(shouldPollRunStatus('superadmin-setup', false)).toBe(false);
  });

  // negative ① — 타입을 우회한 view 입력(빈 문자열 · undefined · 미지 문자열)에도 throw 0.
  it('타입 우회 view 입력에도 false 이며 throw 하지 않는다 (negative)', () => {
    const bypass = shouldPollRunStatus as unknown as (v: unknown, h: unknown) => boolean;
    expect(() => bypass('', false)).not.toThrow();
    expect(bypass('', false)).toBe(false);
    expect(bypass(undefined, false)).toBe(false);
    expect(bypass(null, false)).toBe(false);
    expect(bypass('DASHBOARD', false)).toBe(false);
  });

  // negative ② — 가시 여부 미상(undefined · 문자열 · 숫자)은 조회하지 않는 쪽으로 쏠린다.
  it('가시 여부가 boolean 이 아니면 false 다 (negative — 엄격 비교 fail-safe)', () => {
    const bypass = shouldPollRunStatus as unknown as (v: unknown, h: unknown) => boolean;
    expect(() => bypass('dashboard', undefined)).not.toThrow();
    expect(bypass('dashboard', undefined)).toBe(false);
    expect(bypass('dashboard', 'false')).toBe(false);
    expect(bypass('dashboard', 0)).toBe(false);
  });

  // 주기 상수 — 근거(ADR-0060 §Decision 5)대로 5 초이며 양수 정수다.
  it('polling 주기 상수는 5 초다 (ADR-0060 §Decision 5)', () => {
    expect(RUN_STATUS_POLL_INTERVAL_MS).toBe(5000);
    expect(Number.isInteger(RUN_STATUS_POLL_INTERVAL_MS)).toBe(true);
  });
});

describe('AppShell 실행 상태 polling 배선 (T-1849)', () => {
  // 소스 대조는 여러 test 가 공유한다 — effect 는 정적 렌더로 발화되지 않는다.
  const readSource = () =>
    readFileSync(new URL('./AppShell.tsx', import.meta.url), 'utf8');

  // happy-path — 진행 중 상태가 주입되면 배너 슬롯이 실제로 켜진다.
  it('initialEvaluationInProgress=true 정적 렌더에 R-78 배너가 나타난다 (happy-path)', () => {
    const html = renderToStaticMarkup(
      <AppShell initialView="dashboard" initialEvaluationInProgress />,
    );
    expect(html).toContain(BANNER_TOKEN);
    expect(html).toContain('role="alert"');
  });

  // error path — 조회 실패는 fetchRunStatus 가 false 로 흡수하므로 배너가 켜지지 않는다.
  it('실패 흡수 결과(false)에서는 배너가 렌더되지 않는다 (error path)', () => {
    const html = renderToStaticMarkup(
      <AppShell initialView="dashboard" initialEvaluationInProgress={false} />,
    );
    expect(html).not.toContain(BANNER_TOKEN);
    expect(html).not.toContain('role="alert"');
  });

  // error path ② — 실패 처리 규칙이 AppShell 로 복제되지 않았음을 소스로 고정한다.
  it('소스에 자체 catch · 에러 문구 · 재시도가 없다 (error path — 규칙 정본 1 곳)', () => {
    const source = readSource();
    expect(source).not.toMatch(/fetchRunStatus\(\)[\s\S]{0,200}?\.catch\(/);
    expect(source).not.toMatch(/setTimeout\(/);
    expect(source).not.toMatch(/실행 상태를 불러오지/);
  });

  // negative ① — 기본값(미주입)에서는 배너가 없다.
  it('initialEvaluationInProgress 기본값에서는 배너가 없다 (negative — 기본 false)', () => {
    const html = renderToStaticMarkup(<AppShell initialView="dashboard" />);
    expect(html).not.toContain(BANNER_TOKEN);
  });

  // negative ② — 미인증 진입 정적 렌더는 배너도 인증 후 동선도 없다(무회귀).
  it('미인증 진입 정적 렌더에 배너 · 인증 후 동선이 부재한다 (negative — 무회귀)', () => {
    const html = renderToStaticMarkup(<AppShell initialView="login" />);
    expect(html).not.toContain(BANNER_TOKEN);
    expect(html).not.toContain(LOGOUT_TOKEN);
    expect(html).not.toContain(ADMIN_ITEM_TOKEN);
    expect(html).toContain('Assessment-Agent');
  });

  // drift guard — 배선 6 종(조회 · 주기 · 정리 · 가시성 · 대입 · 경쟁 방어)을 소스로 고정한다.
  it('소스에서 polling effect 가 배선돼 있다 (drift guard)', () => {
    const source = readSource();
    // 조회 helper import + 실 호출.
    expect(source).toMatch(/import \{ fetchRunStatus \} from '\.\/api\/runStatus';/);
    expect(source).toMatch(/void fetchRunStatus\(\)\.then\(\(active\) => \{/);
    // 주기 상수 선언 + setInterval 이 그 상수를 참조.
    expect(source).toMatch(/export const RUN_STATUS_POLL_INTERVAL_MS = 5000;/);
    expect(source).toMatch(/setInterval\(poll, RUN_STATUS_POLL_INTERVAL_MS\)/);
    // 판정 helper 가 effect 안에서 실제 게이트로 쓰인다.
    expect(source).toMatch(/if \(cancelled \|\| !shouldPollRunStatus\(view, document\.hidden\)\)/);
    // 가시성 구독과 대응 해제 + interval 정리 + 늦은 setState 방어.
    expect(source).toMatch(/document\.addEventListener\('visibilitychange', poll\)/);
    expect(source).toMatch(/document\.removeEventListener\('visibilitychange', poll\)/);
    expect(source).toMatch(/clearInterval\(timer\)/);
    expect(source).toMatch(/cancelled = true;/);
    // 결과 boolean 을 그대로 대입 + 미인증 되돌림.
    expect(source).toMatch(/setEvaluationInProgress\(active\);/);
    expect(source).toMatch(/setEvaluationInProgress\(false\);/);
  });

  // negative ③ — 주기 숫자 리터럴이 setInterval 호출부에 직접 박히지 않았다.
  it('소스의 setInterval 이 숫자 리터럴을 쓰지 않는다 (negative — 근거 상수화)', () => {
    const source = readSource();
    expect(source).not.toMatch(/setInterval\([^)]*5000/);
    // 5000 은 상수 선언 한 곳에만 나타난다.
    expect(source.match(/5000/g) ?? []).toHaveLength(1);
  });
});
