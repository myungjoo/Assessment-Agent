// 전역 레이아웃 골격 — P6 composition wiring ①②②b⑥ (T-0378·T-0379·T-0380·T-0394,
// ADR-0041 Decision 1·2·3·4).
// wiring ①(T-0378)은 골격(view enum 상태 + 레이아웃 + R-78 배너 슬롯)을 박제했다.
// wiring ②(T-0379)는 그 위에 인증 게이트(AuthGate) 배선 + 무라우터 view 전환을
// 얹었다: 미인증이면 본문에 LoginForm(AuthGate 경유), 인증 성공 시 onAuthenticated
// 가 view 를 'dashboard' 로 전환한다.
// wiring ②b(T-0380)는 인증 게이트의 `onLogin` 콜백에 실 `auth.login` (POST
// /api/auth/login + 401→refresh→retry, apiClient 경유) 을 주입한다.
// wiring ⑥(T-0394)는 마지막 placeholder('superadmin-setup')를 실 SuperAdminSetupForm
// 으로 교체하고 `signup`(POST /api/users 첫-user→SuperAdmin) helper 를 주입한다 —
// 본 slice 의 변경점. setup 모드는 미인증 단계라 AuthGate(로그인) 와 상호배타로
// 렌더한다(둘 다 동시 렌더 금지). setup↔login 전환은 주입형 controlled lift-up 으로
// 표현하고 새 라우터는 도입하지 않는다(ADR-0041 Decision 1·2). T-1714 는 그 셋업
// 제출 경로의 `signup` 을 `signupDetailed`(사유 보존 계약) 로 교체해, 실패 시 포괄
// 문구 대신 축별 구체 사유를 표시한다(REQ-068 · REQ-069). T-1717 은 인증 후에만
// 렌더되는 view 전환 내비게이션(대시보드 ↔ 관리)을 AuthGate children 안에 얹어,
// 도달 경로가 없던 'admin' 분기를 살린다(REQ-070 slice 1). T-1720 은 그 내비게이션에
// 등급 차등을 얹는다(REQ-073 slice 3): 인증 후 `fetchCurrentUser()`(T-1718) 로 현재
// 사용자 등급을 1 회 적재하고, `canEditAssessmentTargets`(T-1719) 판정으로 편집 동선
// 항목('관리')을 필터한다 — User 등급에게는 조회 동선만 남는다. T-1834 는 셋업 실패
// 사유를 한 문자열로 합쳐 내려보내던 배선을 줄 배열(buildSetupErrorLines → 폼 errorLines)
// 로 바꿔 사유가 2 개 이상일 때의 줄 경계를 살린다(REQ-084). T-1849 는 R-78 배너를 실제 서버 상태에 잇는다(REQ-083): 인증 후 view
// 에서 `fetchRunStatus()`(T-1848)를 5 초 주기로 부르고 탭이 숨겨진 동안은 멈춘다
// (ADR-0060 §Decision 5). 새 dependency 0 —
// react/react-dom + 브라우저 표준 fetch 만 사용한다(ADR-0040 §5 게이트).

import { useEffect, useState } from 'react';
import EvaluationGuardBanner from './components/EvaluationGuardBanner';
import AuthGate from './AuthGate';
import SuperAdminSetupForm from './components/SuperAdminSetupForm';
import DashboardView from './views/DashboardView';
import AdminView from './views/AdminView';
import {
  fetchCurrentUser,
  login as authLogin,
  logout as authLogout,
  signupDetailed as authSignupDetailed,
} from './api/auth';
import type { CurrentUser } from './api/auth';
import { canEditAssessmentTargets } from './api/roleAccess';
import { fetchRunStatus } from './api/runStatus';
import { formatSignupFailure } from './api/signupError';
import type { SignupFailure } from './api/signupError';

// 무라우터 view 전환 (ADR-0041 Decision 2) — view enum 으로 추상화해 두면
// 후일 react-router 전환 시 교체 표면이 AppShell 한 곳에 국한된다.
type View = 'login' | 'dashboard' | 'admin' | 'superadmin-setup';

// 인증 후 기본 view — 로그인 성공 시 전환할 진입 화면.
const DEFAULT_AUTHED_VIEW: View = 'dashboard';

// 미인증 진입점 view (T-1838, REQ-082) — 부트 시작 화면이자 세션 복원 실패 시 머무는
// 화면이다. 아래 세션 복원 판정 두 곳이 view 문자열('login')을 각자 하드코딩하지 않고
// 이 상수 하나를 근거로 삼는다(판정 근거 정본 1 곳). 기존 리터럴 사용처(초기 prop
// 기본값 · handleLogout 복귀)는 T-1837 drift guard 의 대조 대상이라 그대로 둔다.
const UNAUTHED_ENTRY_VIEW: View = 'login';

// 인증 후 내비게이션 항목 (T-1717, REQ-070 slice 1). 종전에는 `view === 'admin'` 분기가
// 존재하는데도 인증 후 `setView('admin')` 을 호출하는 컨트롤이 코드베이스에 없어 AdminView
// 가 도달 불가한 dead branch 였다 — 그래서 로그인 직후 대시보드 빈 상태에서 사용자가
// 막혔다. 본 상수 + 아래 내비게이션이 그 동선을 살린다.
// 목록을 named export 상수로 분리한 이유: web 에 @testing-library/react 가 없어(ADR-0040
// §5 새-dep 게이트) 클릭 상호작용 test 가 불가하므로, 항목 구성만은 단위로 검증 가능해야
// 한다(buildSetupErrorMessage 선례와 동형). 미인증 view('login' · 'superadmin-setup')는
// 이 목록에 넣지 않는다 — 내비게이션 자체가 인증 후에만 렌더된다.
//
// T-1720: 항목별 필요 등급을 항목 자체의 표식 `editOnly` 로 둔다 — 필터 함수가 view
// 문자열('admin' 등)을 하드코딩해 분기하면 항목이 늘 때마다 수정 지점이 둘로 갈라진다.
// `editOnly: true` 는 "평가 대상 편집 권한(canEditAssessmentTargets)이 있어야 노출" 을
// 뜻하며, 표식이 없는 항목은 인증된 모든 등급에게 노출되는 조회 동선이다.
interface AuthedNavItem {
  view: View;
  label: string;
  editOnly?: boolean;
}

export const AUTHED_NAV_ITEMS: ReadonlyArray<AuthedNavItem> = [
  { view: 'dashboard', label: '대시보드' },
  { view: 'admin', label: '관리', editOnly: true },
];

// 주어진 값이 인증 후 내비게이션 항목의 view 인지 — 항목 목록을 단일 근거로 삼는다.
// 아래 두 곳(활성 표식 판정 · AuthGate 초기 인증 여부)이 같은 판정을 공유하도록
// 한 함수로 둔다. 타입을 우회한 런타임 입력(빈 문자열 · undefined 등)도 안전하게 false.
function isAuthedView(view: View): boolean {
  return AUTHED_NAV_ITEMS.some((item) => item.view === view);
}

// 내비게이션 항목의 현재 view 표식(aria-current="page") 판정 — 순수 함수로 분리해
// 단위 검증한다. 어떤 입력에도 throw 하지 않으며, View 가 아닌 값(빈 문자열 · undefined
// 등 타입 우회 입력)은 활성으로 보지 않는다(활성 표식 중복·오염 방지).
export function isNavItemActive(current: View, item: View): boolean {
  return isAuthedView(current) && isAuthedView(item) && current === item;
}

// 현재 사용자 등급으로 필터한 내비게이션 항목 목록 (T-1720, REQ-073 slice 3).
// AUTHED_NAV_ITEMS 를 단일 근거로 삼아, `editOnly` 표식이 붙은 항목은 편집 권한
// (canEditAssessmentTargets — Admin 이상)이 있을 때만 남긴다. 등급 비교 문자열('Admin'
// 등)은 이 파일에 다시 적지 않고 roleAccess 판정만 사용한다(판정 규칙 정본 1 곳).
// 미인증·미적재(null/undefined)·미지 등급은 roleAccess 의 거부 fail-safe 를 그대로
// 물려받아 조회 항목만 남는다 — 권한을 임의로 부여하지 않는다. throw 0.
export function visibleNavItems(
  user: CurrentUser | null | undefined,
): ReadonlyArray<AuthedNavItem> {
  const canEdit = canEditAssessmentTargets(user);
  return AUTHED_NAV_ITEMS.filter((item) => (item.editOnly === true ? canEdit : true));
}

// 현재 사용자 등급을 지금 적재해야 하는지 판정한다 (T-1720).
// 인증 후 view 이고 아직 적재된 사용자가 없을 때만 true — 미인증 view('login' ·
// 'superadmin-setup')에서는 GET /api/auth/me 가 401 로 귀결될 뿐이라 부르지 않고,
// 이미 적재됐으면 중복 조회를 하지 않는다. 타입을 우회한 비정상 view(빈 문자열 등)도
// isAuthedView 를 거쳐 안전하게 false 다(throw 0).
export function shouldLoadCurrentUser(
  view: View,
  currentUser: CurrentUser | null | undefined,
): boolean {
  return isAuthedView(view) && (currentUser === null || currentUser === undefined);
}

// 로그아웃 컨트롤을 지금 노출해야 하는지 판정한다 (T-1837, REQ-081).
// 인증 후 view 에서만 true — 판정 근거는 기존 `isAuthedView` 하나이며 view 문자열
// ('dashboard' 등)을 여기에 다시 하드코딩하지 않는다(판정 규칙 정본 1 곳). 미인증
// view('login' · 'superadmin-setup')와 타입을 우회한 런타임 입력(빈 문자열 · undefined
// 등)은 모두 false 이며 throw 하지 않는다.
// 순수 함수로 분리해 named export 하는 이유: web 에 @testing-library/react 가 없어
// (ADR-0040 §5 새-dep 게이트) 클릭 상호작용 test 가 불가하므로 노출 규칙만은 단위로
// 검증 가능해야 한다(shouldLoadCurrentUser 선례와 동형).
export function shouldShowLogout(view: View): boolean {
  return isAuthedView(view);
}

// 부트 시 세션 복원을 지금 시도해야 하는지 판정한다 (T-1838, REQ-082).
// 종전에는 새로고침하면 쿠키 세션이 아직 유효해도 무조건 로그인 화면으로 되돌아갔다 —
// 부트 진입점이 미인증 고정이고 GET /api/auth/me 는 인증 후 view 에서만 불렸기 때문이다.
// true 조건 셋(모두 충족해야 한다):
//  ① 미인증 진입점 view 일 것 — 근거는 UNAUTHED_ENTRY_VIEW 상수 하나이며 view 문자열을
//     여기에 다시 하드코딩하지 않는다. 셋업 view('superadmin-setup')는 사용자가 의도적으로
//     들어온 화면이므로 false 다(부트 복원이 그 화면을 가로채지 않는다).
//  ② 아직 복원을 시도하지 않았을 것 — 성공·실패 무관하게 1 회로 끝내 재시도 루프를 막는다.
//     엄격 비교(=== false)라 타입을 우회한 입력(undefined · 숫자)은 "시도함" 쪽으로 안전하게
//     쏠려 false 가 된다.
//  ③ 적재된 사용자가 없을 것 — 이미 있으면 복원할 것이 없다(중복 조회 방지).
// 타입을 우회한 런타임 입력(빈 문자열 · undefined · 숫자)에도 false 이며 throw 0.
export function shouldRestoreSession(
  view: View,
  attempted: boolean,
  currentUser: CurrentUser | null | undefined,
): boolean {
  return (
    view === UNAUTHED_ENTRY_VIEW &&
    attempted === false &&
    (currentUser === null || currentUser === undefined)
  );
}

// 세션 복원 결과로 도착할 view 를 판정한다 (T-1838, REQ-082).
// 유효한 사용자 객체(id · email · role 이 모두 문자열 — fetchCurrentUser 의 반환 계약과
// 동형)면 인증 후 기본 view, 그 밖(null · undefined · 비객체 · 필드 누락)이면 미인증
// 진입점을 준다 — 사유를 지어내지 않고 미인증 상태를 유지하는 fail-safe 다.
// 반환값은 기존 상수(DEFAULT_AUTHED_VIEW · UNAUTHED_ENTRY_VIEW)만 사용하며 throw 0.
// URL 별 화면 복원은 무라우터 view enum(ADR-0041 Decision 2) 밖의 주제라 도착지는 하나다.
export function restoredView(user: CurrentUser | null | undefined): View {
  if (typeof user !== 'object' || user === null || Array.isArray(user)) {
    return UNAUTHED_ENTRY_VIEW;
  }
  const { id, email, role } = user as {
    id?: unknown;
    email?: unknown;
    role?: unknown;
  };
  if (typeof id !== 'string' || typeof email !== 'string' || typeof role !== 'string') {
    return UNAUTHED_ENTRY_VIEW;
  }
  return DEFAULT_AUTHED_VIEW;
}

// 실행 상태(run-status) polling 주기 (T-1849, REQ-083) — 밀리초.
// 5 초의 근거는 ADR-0060 §Decision 5 (a)(b)(c): 보호 대상 실행이 통상 수 초~수 분이라
// 5 초 해상도면 실행 구간의 대부분을 덮고, 최악의 켜짐/꺼짐 지연 5 초는 "진행 중임을
// 알린다" 는 R-78 의 요구에 충분하며, 응답이 메모리 읽기 + 작은 JSON 이라 부하가 무시
// 가능하다. 아래 setInterval 은 이 상수만 참조한다 — 숫자 리터럴을 호출부에 직접 적으면
// 주기의 근거가 코드에서 사라진다. env·설정 UI 를 통한 조정은 요구가 아니다(상수 1 개).
export const RUN_STATUS_POLL_INTERVAL_MS = 5000;

// 지금 실행 상태를 조회해야 하는지 판정한다 (T-1849, REQ-083).
// true 조건 둘: ① 인증 후 view 일 것 — 미인증 view('login' · 'superadmin-setup')에서
// GET /api/run-status 는 401 로 귀결될 뿐이라 부르지 않는다(§Decision 3). 판정 근거는
// 기존 `isAuthedView` 하나이며 view 문자열을 여기에 다시 하드코딩하지 않는다
// (shouldShowLogout 선례 — 판정 규칙 정본 1 곳). ② 문서가 가시일 것 — 백그라운드 탭이
// 종일 요청을 쌓지 않게 하는 값싼 절약이다(ADR-0060 §Decision 5 두 번째 항목).
// `documentHidden` 은 엄격 비교(=== false)로 본다: 타입을 우회한 입력(undefined · 문자열)
// 은 "가시 여부 미상" 이므로 조회하지 않는 쪽으로 안전하게 쏠린다. 어떤 입력에도 throw 0.
export function shouldPollRunStatus(view: View, documentHidden: boolean): boolean {
  return isAuthedView(view) && documentHidden === false;
}

// 로그아웃 컨트롤의 식별 className — 정적 렌더 단언의 기준 토큰이다. 전역 CSS 는 본
// slice 의 Out of Scope 라 className 부여까지만 한다.
const LOGOUT_CLASS = 'app-shell-logout';

// 헤더에 표시할 전역 식별 토큰 — App.test/AppShell.test 의 happy-path 단언 기준.
const APP_TITLE = 'Assessment-Agent';

// 셋업 실패 사유 줄들을 하나의 error 문자열로 이을 때 쓰는 구분자 (T-1714).
// T-1834 이후 실 표시 경로는 줄 배열(errorLines)을 쓰므로 이 구분자는 화면에 나타나지
// 않는다 — 단일 문자열 표현이 필요한 호출자(buildSetupErrorMessage) 를 위해서만 남는다.
// 각 줄의 사유 문장 자체는 원문 그대로 보존하며 요약·병합하지 않는다(REQ-068 포괄 문구 금지).
const SETUP_ERROR_SEPARATOR = ' / ';

// 사유를 하나도 얻지 못한 비정상 응답용 fallback (T-1714). 2xx 인데 role 도 failure 도
// 없는 경우가 여기 해당한다 — 없는 사유를 지어내지 않고 상태 불명임을 그대로 알린다.
// 네트워크/5xx catch 문구(SETUP_THROWN_ERROR_MESSAGE)와 어휘가 겹치지 않아야 한다.
const SETUP_UNRESOLVED_MESSAGE =
  '셋업 응답을 해석하지 못했습니다. 계정이 생성되었는지 확인한 뒤 다시 시도해 주세요.';

// 네트워크/5xx 등 throw 경로 문구 — 위 fallback 과 구분 가능해야 한다.
const SETUP_THROWN_ERROR_MESSAGE = '셋업 중 오류가 발생했습니다.';

// signupDetailed 가 준 축별 사유(SignupFailure)를 폼에 내려보낼 줄 배열로 변환한다 (T-1834).
// 사유 산출 로직의 정본은 이 함수 하나이며, 아래 buildSetupErrorMessage 는 이 결과를 잇기만
// 한다(중복 구현 0). 순수 함수로 분리해 named export 하는 이유: web 에 @testing-library/react
// 가 없어(ADR-0040 §5 새-dep 게이트) 상호작용 렌더 test 가 불가하므로, 이 변환 규칙만은
// 단위로 검증 가능해야 한다.
//  - failure 가 null(사유 미상) 또는 축이 전부 비어 있으면 → SETUP_UNRESOLVED_MESSAGE 한 줄.
//  - 그 외 → formatSignupFailure 의 줄들을 그대로(원문 보존, 요약·병합 금지) 반환한다.
export function buildSetupErrorLines(failure: SignupFailure | null): string[] {
  if (failure === null) {
    return [SETUP_UNRESOLVED_MESSAGE];
  }
  const lines = formatSignupFailure(failure);
  if (lines.length === 0) {
    return [SETUP_UNRESOLVED_MESSAGE];
  }
  return lines;
}

// 위 줄 배열을 폼 error 한 줄 문자열로 잇는다 (T-1714 계약 유지).
// T-1834 이후 AppShell 안에는 호출자가 없지만, 단일 문자열 표현을 쓰는 소비처(폼의 error
// prop 경로)가 아직 살아 있으므로 named export 계약을 유지한다 — REQ-084 의 나머지 축까지
// 줄 단위로 전환된 뒤 제거 가능 여부를 재평가한다(T-1834 Follow-up).
export function buildSetupErrorMessage(failure: SignupFailure | null): string {
  return buildSetupErrorLines(failure).join(SETUP_ERROR_SEPARATOR);
}

// 인증 제출 위임 콜백 — wiring ②b(T-0380) 가 실 `auth.login` 을 주입한다.
// `auth.login(username, password)` 가 `POST /api/auth/login` 호출 + 401 시 false
// 반환을 담당하므로 본 모듈은 그대로 위임만 한다 (AuthGate.onLogin signature 와 정합).
const onLogin = authLogin;

interface AppShellProps {
  // 초기 view — 기본 'login'(미인증 진입점). renderToStaticMarkup 은 이벤트를
  // 발화하지 않아 setView 핸들러를 직접 호출할 수 없으므로, setup 분기를 정적
  // 렌더로 검증할 수 있도록 초기값 주입을 허용한다(테스트 가능성, AuthGate 의
  // initialAuthenticated 주입 패턴과 동형 — ADR-0041 Decision 1).
  initialView?: View;
  // setup 폼 초기 에러 문구 — 기본 미설정. error 전달 경로를 정적 렌더로 검증할
  // 수 있도록 초기값 주입을 허용한다.
  initialSetupError?: string;
  // setup 폼 초기 에러 줄 목록 — 기본 미설정 (T-1834). 실 실패 경로(handleSetupSubmit)는
  // 이벤트 발화가 필요해 정적 렌더로 볼 수 없으므로, errorLines 전달 배선을 검증할 수 있게
  // 초기값 주입을 허용한다(initialSetupError 선례와 동형 — ADR-0041 Decision 1).
  initialSetupErrorLines?: string[];
  // 초기 사용자 등급 — 기본 미설정(→ null, 적재 전 상태). renderToStaticMarkup 은
  // effect 를 실행하지 않아 fetchCurrentUser 적재 결과를 정적 렌더로 볼 수 없으므로,
  // 등급별 내비 렌더를 검증할 수 있도록 주입점을 연다(initialView ·
  // AuthGate.initialAuthenticated 선례와 동형 — ADR-0041 Decision 1).
  initialCurrentUser?: CurrentUser | null;
  // 초기 평가 진행 중 상태 — 기본 false (T-1849). 실 polling 은 effect 이고
  // renderToStaticMarkup 은 effect 를 실행하지 않으므로, 배너 슬롯이 실제로 켜지는지를
  // 정적 렌더로 검증할 수 있도록 주입점을 연다(initialView · initialCurrentUser 선례와
  // 동형 — ADR-0041 Decision 1).
  initialEvaluationInProgress?: boolean;
}

// 전역 레이아웃 컴포넌트. view enum 상태와 R-78 평가 진행 중 상태를 보유하고,
// 미인증 단계의 두 분기(로그인=AuthGate / 초기 셋업=SuperAdminSetupForm)를
// 상호배타로 렌더한다. 인증 후에는 view 별 실 화면 컨테이너를 렌더한다.
function AppShell({
  initialView = 'login',
  initialSetupError,
  initialSetupErrorLines,
  initialCurrentUser = null,
  initialEvaluationInProgress = false,
}: AppShellProps = {}) {
  // 현재 view 상태 — 초기값 'login' (ADR-0041 Decision 1 인증 게이트 진입점).
  const [view, setView] = useState<View>(initialView);

  // R-78/REQ-042 평가 진행 중 상태 (ADR-0041 Decision 4). T-1849 가 setter 를 살려
  // 아래 polling effect 가 실 서버 상태(GET /api/run-status)를 그대로 대입한다 — 종전의
  // 고정 false 는 배너가 영원히 조용한 원인이었다(ADR-0060 §Consequences (a)).
  const [evaluationInProgress, setEvaluationInProgress] = useState<boolean>(
    initialEvaluationInProgress,
  );

  // SuperAdmin 초기 셋업 폼의 controlled 입력/상태 — AppShell 이 소유한다
  // (controlled lift-up, ADR-0041 Decision 1). presentational SuperAdminSetupForm
  // 은 props 로만 소비한다(컴포넌트 수정 0).
  const [setupUsername, setSetupUsername] = useState<string>('');
  const [setupPassword, setSetupPassword] = useState<string>('');
  const [setupLoading, setSetupLoading] = useState<boolean>(false);
  const [setupError, setSetupError] = useState<string | undefined>(initialSetupError);
  // 셋업 실패 사유의 줄 단위 표현 (T-1834, REQ-084). 실패 경로는 이 state 를 갱신하고
  // 폼이 줄마다 별도 element 로 렌더한다 — 단일 문자열 setupError 는 initialSetupError
  // 정적 렌더 경로를 위해 그대로 남긴다(폼에서 errorLines 가 우선).
  const [setupErrorLines, setSetupErrorLines] = useState<string[] | undefined>(
    initialSetupErrorLines,
  );

  // 현재 인증 사용자 등급 (T-1720, REQ-073) — 적재 전 상태는 null 이며, 그 상태의 판정은
  // "편집 권한 없음"(조회 전용)이다. 등급을 모르는 동안 편집 동선을 미리 보여주지 않는다.
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(initialCurrentUser);

  // 세션 세대 번호 (T-1837, REQ-081) — 로그아웃할 때마다 1 증가하며 AuthGate 의 key 로
  // 쓰인다. AuthGate 는 `authenticated` 를 자기 useState 로 소유하고 `initialAuthenticated`
  // 는 mount 시점 초기값일 뿐이라(AuthGate.tsx 47~50 행), prop 을 내려보내는 것만으로는
  // 이미 인증된 게이트를 되돌릴 수 없다. key 를 바꿔 remount 시키는 것이 AuthGate.tsx 를
  // 수정하지 않고 그 내부 상태를 초기화하는 유일한 경로다.
  const [sessionEpoch, setSessionEpoch] = useState<number>(0);

  // 부트 세션 복원 시도 여부 (T-1838, REQ-082) — 성공·실패 어느 쪽이든 true 로 확정한다.
  // 이 플래그가 없으면 복원 실패(세션 없음)가 곧바로 재시도 조건이 되어 GET /api/auth/me
  // 무한 루프가 된다. handleLogout 은 이 값을 되돌리지 않는다 — 되돌리면 로그아웃 직후
  // 아직 살아 있는 쿠키로 자동 재로그인되어 사용자가 세션을 끝낼 수 없다.
  const [restoreAttempted, setRestoreAttempted] = useState<boolean>(false);

  // 부트 시 세션을 1 회 복원한다 (T-1838, REQ-082). 미인증 진입점에서만 GET /api/auth/me
  // 를 부르고, 살아 있는 세션이 있으면 ① 등급 적재 ② 인증 후 view 전환 ③ sessionEpoch
  // 증가로 AuthGate remount(그 시점 initialAuthenticated={isAuthedView(view)} 가 true 라
  // 로그인 폼 대신 인증 후 화면이 보인다) 를 한다. 실패(null · 401 · 5xx · 네트워크)는
  // 사유를 지어내지 않고 조용히 흡수해 로그인 화면을 그대로 유지한다(오류 배너 0).
  // cancelled 플래그는 등급 적재 effect 와 동형으로 언마운트 경쟁 상태의 늦은 setState 를 막는다.
  useEffect(() => {
    if (!shouldRestoreSession(view, restoreAttempted, currentUser)) {
      return;
    }
    let cancelled = false;
    void fetchCurrentUser()
      .then((user) => {
        if (cancelled) {
          return;
        }
        // 성공 경로에서도 먼저 시도를 확정한다 — 세션이 없어(null) 복원하지 못한
        // 경우에도 재시도 루프가 생기지 않아야 한다.
        setRestoreAttempted(true);
        if (user === null) {
          return;
        }
        setCurrentUser(user);
        setView(restoredView(user));
        setSessionEpoch((epoch) => epoch + 1);
      })
      .catch(() => {
        // 5xx · 네트워크 실패 — 사유를 지어내지 않고 미인증 화면을 유지하되, 시도만은
        // 확정해 재조회 루프를 막는다.
        if (!cancelled) {
          setRestoreAttempted(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [view, restoreAttempted, currentUser]);

  // 인증 후 진입 시 등급을 1 회 적재한다. 조회 실패(5xx·네트워크 reject)는 삼켜서
  // null(조회 전용)을 유지한다 — 실패를 이유로 편집 권한을 부여하지 않는 fail-safe 이며
  // 렌더도 깨지 않는다. cancel 플래그로 언마운트/재진입 경쟁 상태의 늦은 setState 를 막는다.
  useEffect(() => {
    if (!shouldLoadCurrentUser(view, currentUser)) {
      return;
    }
    let cancelled = false;
    void fetchCurrentUser()
      .then((user) => {
        if (!cancelled) {
          setCurrentUser(user);
        }
      })
      .catch(() => {
        // 사유를 지어내지 않고 조회 전용 상태를 유지한다(등급 미상 = 편집 불가).
      });
    return () => {
      cancelled = true;
    };
  }, [view, currentUser]);

  // 실행 상태를 주기적으로 조회해 R-78 배너를 서버 상태에 잇는다 (T-1849, REQ-083).
  // 진입 즉시 1 회 + RUN_STATUS_POLL_INTERVAL_MS 주기 + 탭 가시화 순간 1 회 조회하며,
  // 매 tick 은 shouldPollRunStatus 게이트를 통과할 때만 실제 요청을 보낸다.
  // 실패 흡수는 fetchRunStatus() 의 계약(runStatus.ts 헤더)이므로 여기에 try/catch ·
  // 에러 배너 · 재시도를 두지 않는다 — 두면 같은 규칙이 두 곳으로 갈라진다.
  useEffect(() => {
    if (!isAuthedView(view)) {
      // 미인증 view — 조회하지 않고 배너를 접는다. 로그아웃 후 배너가 켜진 채 남지 않게
      // 하는 되돌림이며, 이미 false 인 상태에서 같은 값을 setState 해도 React 가
      // bailout 하므로 재렌더 루프는 생기지 않는다.
      setEvaluationInProgress(false);
      return;
    }
    // 언마운트/재진입 경쟁 상태의 늦은 setState 방어 — 세션 복원 effect 와 동형 패턴.
    let cancelled = false;
    const poll = () => {
      if (cancelled || !shouldPollRunStatus(view, document.hidden)) {
        return;
      }
      void fetchRunStatus().then((active) => {
        if (!cancelled) {
          setEvaluationInProgress(active);
        }
      });
    };
    poll();
    const timer = setInterval(poll, RUN_STATUS_POLL_INTERVAL_MS);
    // 비가시 동안의 tick 은 위 게이트가 건너뛰고, 가시화되는 순간 주기를 기다리지 않고
    // 즉시 따라잡는다(ADR-0060 §Decision 5 "탭 비가시 시 중단").
    document.addEventListener('visibilitychange', poll);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [view]);

  // 인증 성공 시 view 전환 — 인증 후 기본 view('dashboard')로 무라우터 전환한다.
  const handleAuthenticated = () => {
    setView(DEFAULT_AUTHED_VIEW);
  };

  // 로그아웃 핸들러 (T-1837, REQ-081) — 세션을 실제로 끝낸다.
  // `authLogout()` 의 반환값(서버 쿠키 정리 확인 여부)과 **무관하게** 클라이언트 세션을
  // 정리한다: ① 적재된 등급을 null 로 되돌리고(다음 로그인 사용자의 등급이 새지 않도록)
  // ② view 를 미인증 진입점 'login' 으로 전환하며 ③ sessionEpoch 를 올려 AuthGate 를
  // remount 해 그 내부 `authenticated` 를 초기화한다. helper 가 실패를 false 로 흡수하고
  // throw 하지 않으므로(api/auth.ts logout) 여기에 catch 분기를 두지 않는다.
  // ② 이후 view 가 'login' 이면 shouldLoadCurrentUser 가 false 라 GET /api/auth/me
  // 재적재 루프도 생기지 않는다.
  const handleLogout = async () => {
    await authLogout();
    setCurrentUser(null);
    setView('login');
    setSessionEpoch((epoch) => epoch + 1);
  };

  // 미인증 화면에서 초기 셋업 모드로 진입하는 트리거 — login↔setup 전환은 주입형
  // 라우터 없는 controlled 전환이다(ADR-0041 Decision 2). 진입 시 직전 에러를 비운다.
  const enterSetup = () => {
    setSetupError(undefined);
    setSetupErrorLines(undefined);
    setView('superadmin-setup');
  };

  // 셋업 제출 핸들러 — `signupDetailed`(POST /api/users, T-1713) 에 위임하고 결과에
  // 따라 분기한다. 종전 `signup` wrapper 는 409/400 을 똑같이 null 로 흡수해 "어느 입력이
  // 어떤 조건을 위반했는지" 를 버렸고, 그 자리에 오너가 금지한 포괄 문구가 있었다 —
  // T-1714 가 그 소비 지점을 사유 보존 계약으로 교체한다(REQ-068 · REQ-069).
  //  - role 문자열(특히 'SuperAdmin'): 셋업 성공 → 로그인 화면('login')으로 재진입
  //    (POST /api/users 는 세션 쿠키를 발급하지 않으므로 자동 로그인 연쇄는 Follow-up).
  //  - role null + failure: 중복(409)/검증 실패(400) → 축별 구체 사유를 폼 error 로 표시.
  //  - role null + failure null: 비정상 2xx → 사유를 지어내지 않는 fallback 문구.
  //  - throw: 네트워크/5xx → 위 fallback 과 구분되는 별도 문구로 외화한다.
  const handleSetupSubmit = async () => {
    setSetupLoading(true);
    setSetupError(undefined);
    setSetupErrorLines(undefined);
    try {
      const { role, failure } = await authSignupDetailed(setupUsername, setupPassword);
      if (typeof role === 'string') {
        // 셋업 성공 — 로그인 화면으로 재진입(셋업한 자격증명으로 로그인 유도).
        setView('login');
      } else {
        // 실패 — 축별 구체 사유(또는 사유 미상 fallback)를 줄 단위로 폼에 표시한다 (T-1834).
        // 한 문자열로 합치지 않으므로 사유가 2 개 이상이어도 줄 경계가 보존된다(REQ-084).
        setSetupErrorLines(buildSetupErrorLines(failure));
      }
    } catch {
      // 네트워크/5xx 등 — 사용자에게 에러로 외화한다(줄이 하나뿐이어도 같은 경로를 쓴다).
      setSetupErrorLines([SETUP_THROWN_ERROR_MESSAGE]);
    } finally {
      setSetupLoading(false);
    }
  };

  return (
    <div className="app-shell">
      {/* R-78 배너 슬롯 — 레이아웃 최상단. active=false 면 EvaluationGuardBanner 가 null 반환. */}
      <EvaluationGuardBanner active={evaluationInProgress} />
      <header className="app-shell-header">
        <h1>{APP_TITLE}</h1>
      </header>
      {/* 본문 영역 — 미인증 단계는 setup 분기(SuperAdminSetupForm)와 로그인 분기
          (AuthGate)를 상호배타로 렌더한다(둘 다 동시 렌더 금지). 인증 후 슬롯은
          AuthGate children 의 view 분기가 담당한다. */}
      <main className="app-shell-main">
        {view === 'superadmin-setup' ? (
          // 초기 셋업 분기 — controlled props 로 SuperAdminSetupForm 을 배선한다.
          // AuthGate(LoginForm)는 렌더하지 않아 setup↔login 상호배타를 보장한다.
          <SuperAdminSetupForm
            username={setupUsername}
            password={setupPassword}
            onUsernameChange={setSetupUsername}
            onPasswordChange={setSetupPassword}
            onSubmit={handleSetupSubmit}
            loading={setupLoading}
            error={setupError}
            errorLines={setupErrorLines}
          />
        ) : (
          // 로그인 분기 — AuthGate 가 미인증/인증을 담당한다. 미인증: LoginForm,
          // 인증: children(view 별 실 컨테이너). setup 진입 트리거(enterSetup)를
          // 미인증 화면에 controlled 콜백으로 노출한다(새 라우터 0).
          <AuthGate
            // T-1837 — 세션 세대 번호를 key 로 준다. 로그아웃이 이 값을 올리면 AuthGate 가
            // remount 되어 자기 useState 로 소유한 `authenticated` 가 초기값으로 되돌아간다
            // (AuthGate.tsx 수정 0). 로그아웃 전까지는 값이 불변이라 기존 동작도 불변이다.
            key={sessionEpoch}
            onLogin={onLogin}
            onAuthenticated={handleAuthenticated}
            // 인증 후 view 로 진입한다는 것은 이미 인증됐다는 뜻이므로 그대로 초기
            // 인증 여부로 내려보낸다 — 내비게이션·인증 후 화면을 @testing-library 없이
            // 정적 렌더로 검증 가능하게 하는 주입점이다(AuthGate.initialAuthenticated
            // 패턴, ADR-0041 Decision 1). 기본값 'login' 에서는 false 라 미인증 동작 불변.
            // T-1837 — 근거를 initialView 에서 현재 view 로 바꾼다. mount 시점에는
            // view === initialView 라 기존 동작이 그대로 보존되고, 로그아웃으로 remount 될
            // 때는 이미 view 가 'login' 이라 재-mount 된 게이트가 미인증으로 시작한다.
            initialAuthenticated={isAuthedView(view)}
          >
            {/* 인증 후 내비게이션 (T-1717) — AuthGate children 안에 두어 미인증 단계에서는
                구조적으로 렌더되지 않는다(AuthGate 가 미인증이면 children 을 렌더하지 않음).
                새 라우터 없이 setView 로만 전환한다(ADR-0041 Decision 2 무라우터 전환). */}
            {/* T-1720: 항목 목록을 그대로 map 하지 않고 현재 등급으로 필터한 결과를
                map 한다 — User 등급에게는 편집 동선('관리')이 노출되지 않는다(REQ-073).
                실 mutation 차단의 정본은 backend RolesGuard 이며, 여기는 UI 표면 차등이다. */}
            <nav className="app-shell-nav" aria-label="화면 이동">
              {visibleNavItems(currentUser).map((item) => (
                <button
                  key={item.view}
                  type="button"
                  className={`app-shell-nav-item app-shell-nav-item-${item.view}`}
                  aria-current={isNavItemActive(view, item.view) ? 'page' : undefined}
                  onClick={() => setView(item.view)}
                >
                  {item.label}
                </button>
              ))}
              {/* 로그아웃 동선 (T-1837, REQ-081) — AUTHED_NAV_ITEMS 목록에는 넣지 않는다.
                  등급 필터(visibleNavItems)의 대상이 아니라 인증되면 등급과 무관하게 항상
                  보여야 하는 세션 종료 컨트롤이기 때문이다. */}
              {shouldShowLogout(view) ? (
                <button
                  type="button"
                  className={LOGOUT_CLASS}
                  onClick={() => {
                    void handleLogout();
                  }}
                >
                  로그아웃
                </button>
              ) : null}
            </nav>
            {/* 인증 후 슬롯 — view 분기. 'dashboard' 는 DashboardView(wiring ③a),
                'admin' 은 AdminView(wiring ④a)를 렌더한다('login' 은 AuthGate 가
                LoginForm 으로 처리, 'superadmin-setup' 은 위 상호배타 분기에서 처리). */}
            {view === 'dashboard' ? (
              <DashboardView />
            ) : view === 'admin' ? (
              <AdminView />
            ) : null}
          </AuthGate>
        )}
        {/* 미인증 로그인 화면에서 초기 셋업 모드로 전환하는 트리거 — 첫 부트스트랩
            시 SuperAdmin 계정을 지정하는 controlled 진입점. setup 모드일 때는
            노출하지 않는다(중복 진입 방지). */}
        {view === 'login' ? (
          <button type="button" className="enter-setup" onClick={enterSetup}>
            초기 셋업
          </button>
        ) : null}
      </main>
    </div>
  );
}

export type { View, AppShellProps, AuthedNavItem };
export default AppShell;
