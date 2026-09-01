// 인증 helper — P6 composition wiring ②b (T-0380, ADR-0041 Decision 3 / ADR-0040 §2).
// apiClient(request) 위에 `POST /api/auth/login` · `POST /api/auth/refresh` 두 종을
// 얇게 노출한다. AppShell 이 `AuthGate.onLogin` prop 에 `login` 을 그대로 주입할 수
// 있도록 signature 를 `(username, password) => Promise<boolean>` 으로 맞춘다.
//
// 정책 (architecture/api.md 67–71):
//  - login: POST /api/auth/login body { email, password } — 성공 (2xx) 시 true,
//    401 (Invalid credentials) 시 false. 401 응답은 enumeration-safe 하게 동일
//    처리한다 (email 부재 / password 불일치 구분 안 함 — 클라이언트도 동일 false).
//    그 외 에러 (5xx 등) 는 ApiError 가 throw 되어 호출측이 표면 에러로 받는다.
//  - refresh: POST /api/auth/refresh — 성공 시 true, 401 시 false. 그 외 에러는
//    동일하게 false 로 흡수해 호출측 (전역 세션 만료 정책) 이 단순 분기를 유지.
//
// API 호출은 apiClient.request 를 그대로 쓴다 — credentials 동반 + 401 재시도
// 의무는 apiClient 가 담당하므로 본 helper 는 비즈니스 분기만 표현한다.

import { ApiError, request } from './apiClient';
import { classifySignupFailure, type SignupFailure } from './signupError';

const LOGIN_PATH = '/api/auth/login';
const REFRESH_PATH = '/api/auth/refresh';
// 세션 종료 endpoint 경로 (T-1837, REQ-081) — REFRESH_PATH 선례와 동형으로 상수화한다.
const LOGOUT_PATH = '/api/auth/logout';
const SIGNUP_PATH = '/api/users';
const ME_PATH = '/api/auth/me';

// AuthGate.onLogin prop signature 와 정합 — username/password 를 받아 성공 여부를
// boolean 으로 반환한다. 본 helper 가 ApiError(401) 를 false 로 흡수한다.
async function login(username: string, password: string): Promise<boolean> {
  try {
    // architecture/api.md 67행 — body 는 email + password. 본 클라이언트는 username
    // 필드명으로 받지만 backend 가 email 을 기대하므로 그대로 매핑한다.
    await request(LOGIN_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: username, password }),
    });
    return true;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      return false;
    }
    // 401 외 에러 (네트워크 / 5xx 등) 는 호출측이 catch 해 '로그인 중 오류' 등
    // 으로 표면화하도록 전파한다 (AuthGate handleSubmit 의 catch 분기 입력).
    throw e;
  }
}

// 세션 갱신 helper — apiClient 내부 retry path 와 별개로 호출측이 명시적으로
// refresh 가 필요할 때 사용한다. 부트 hydration(GET /api/auth/me) 경로는 T-1838 이
// AppShell 부트 effect 로 배선했고, 그 경로는 apiClient 의 401→refresh 재시도를 그대로
// 쓰므로 이 helper 를 직접 부르지 않는다.
async function refresh(): Promise<boolean> {
  try {
    await request(REFRESH_PATH, { method: 'POST' });
    return true;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      return false;
    }
    // 401 외 에러도 false 로 흡수 — 세션 만료 정책은 호출측이 단일 분기로 처리.
    return false;
  }
}

// 세션 종료 helper (T-1837, REQ-081) — `POST /api/auth/logout`(src/auth/auth.controller.ts
// 의 이미 shipped 된 handler) 을 호출해 서버가 발급한 access/refresh 쿠키를 지우게 한다.
// 성공(2xx)이면 true, 그 외(401 · 5xx · 네트워크 실패로 인한 ApiError)는 모두 false 로
// 흡수한다 — throw 하지 않는다.
//
// 흡수하는 이유: 클라이언트 측 세션 정리(사용자 상태 초기화 · 로그인 화면 복귀)는 서버
// 응답과 무관하게 반드시 진행돼야 한다. 로그아웃을 누른 사용자를 서버 오류를 이유로
// 인증된 화면에 붙잡아 두는 것이 훨씬 나쁜 결과이기 때문이다. 따라서 반환값은 "서버 쪽
// 쿠키 정리까지 확인됐는가" 라는 정보값일 뿐, 호출측의 정리 수행 여부를 좌우하지 않는다
// (refresh 의 false 흡수 선례와 동형).
async function logout(): Promise<boolean> {
  try {
    // 204(No Content) 응답도 apiClient.parseBody 가 text() 로 안전하게 처리한다.
    await request(LOGOUT_PATH, { method: 'POST' });
    return true;
  } catch {
    return false;
  }
}

// SuperAdmin 초기 셋업 / 신규 user 가입 helper — P6 composition wiring ⑥
// (T-0394, ADR-0041 Decision 1 / ADR-0040 §2). `POST /api/users`(architecture/api.md
// 72) 를 호출한다. backend 는 첫 user(`countAll === 0`)를 자동으로 role="SuperAdmin"
// 으로, 그 외에는 role="User" 로 생성하고 201 응답 body `{ id, email, role, ... }` 를
// 준다.
//
// signupDetailed 의 반환 — 성공/실패를 하나의 객체로 구분한다. 성공이면 failure 가
// null 이고, 409/400 실패면 role 이 null 이며 failure 에 축별 구체 사유가 담긴다
// (REQ-068 포괄 문구 금지 · REQ-069 중복 vs 형식 구분의 정보원).
interface SignupResult {
  // 2xx 응답 body 의 role 문자열. 누락/비문자열이거나 실패면 null.
  role: string | null;
  // 409/400 실패 시의 축별 사유. 성공이면 null.
  failure: SignupFailure | null;
}

// 실패 사유를 보존하는 signup 계약(T-1713). 기존 signup 이 409·400 을 둘 다 null 로
// 흡수해 "어느 입력이 어떤 조건을 위반했는지" 를 버리던 정보 손실 지점을 연다.
//
// 정책:
//  - 성공(2xx): `{ role, failure: null }`. body 의 `role` 이 문자열이면 그 값을,
//    누락/비문자열이면 null 을 담는다(throw 없이 안전 분기).
//  - 409(email 중복) / 400(`AddUserDto` 위반 — `@IsEmail`/`@MinLength(8)` 등):
//    `{ role: null, failure }`. failure 는 classifySignupFailure(status, 응답 body
//    원문) 결과다 — ApiError.message 가 비-2xx 응답의 body 원문을 담는다(apiClient).
//  - 그 외 에러(네트워크 status 0 / 5xx): ApiError 를 그대로 throw 해 호출측 catch 가
//    표면화하도록 전파한다(흡수 금지 — 사유를 지어내지 않는다).
async function signupDetailed(
  username: string,
  password: string,
): Promise<SignupResult> {
  try {
    // login 과 동일하게 username→email 매핑. backend AddUserDto 는 email 을 기대한다.
    const body = await request<{ role?: unknown }>(SIGNUP_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: username, password }),
    });
    // 응답 body 의 role 이 문자열일 때만 반환 — 누락/비문자열은 안전하게 null.
    if (body && typeof body.role === 'string') {
      return { role: body.role, failure: null };
    }
    return { role: null, failure: null };
  } catch (e) {
    // 409(중복) / 400(검증 실패) 만 사유로 환원 — 그 외는 아래에서 전파한다.
    if (e instanceof ApiError && (e.status === 409 || e.status === 400)) {
      return { role: null, failure: classifySignupFailure(e.status, e.message) };
    }
    // 그 외(네트워크/5xx)는 전파 — 호출측 catch 가 표면 에러로 외화한다.
    throw e;
  }
}

// 기존 호출측(AppShell / AdminView) 계약을 그대로 유지하는 얇은 wrapper. 반환은
// `Promise<string | null>` — 409/400 은 종전대로 null 로 흡수된다(구체 사유가 필요한
// 호출측은 signupDetailed 를 쓴다). 그 외 에러는 signupDetailed 가 그대로 전파한다.
async function signup(
  username: string,
  password: string,
): Promise<string | null> {
  const { role } = await signupDetailed(username, password);
  return role;
}

// 현재 인증 사용자 등급 조회 helper — REQ-073 slice 1 (T-1718). RBAC 노출 차등
// (평가 대상 편집은 Admin 등급만 · User 등급은 조회만) 의 전제인 role 정보원을
// web 측에 연다. backend 는 이미 shipped — `GET /api/auth/me`(architecture/api.md
// 72 행, T-0106) 가 JwtAuthGuard 단독으로 UserResponseDto 를 반환한다.
//
// 반환 계약은 `{ id, email, role }` 3 필드만 담는다 — createdAt/updatedAt 는 web
// 소비처가 0 이므로 계약에서 제외한다(불필요한 표면 확장 금지).
interface CurrentUser {
  id: string;
  email: string;
  role: string;
}

// 정책:
//  - 성공(2xx): body 의 id · email · role 셋이 **모두 문자열일 때만** 객체를 반환.
//    하나라도 누락/비문자열이거나 body 가 비객체(null · 배열 · 문자열)면 null 을
//    반환한다(사유를 지어내지 않는 안전 분기 — signupDetailed 의 role 문자열 검사
//    선례 승계).
//  - 401(미인증): throw 하지 않고 null. 미인증 = 등급 없음 이라는 정상 상태이므로
//    refresh helper 의 401 흡수 정책을 mirror 한다.
//  - 404(stale token — 서명은 유효하나 DB row 가 삭제됨): 동일하게 null.
//  - 그 외(5xx · 네트워크 status 0 등): 흡수하지 않고 그대로 전파한다 — 호출측이
//    표면 에러로 외화할 수 있어야 한다.
async function fetchCurrentUser(): Promise<CurrentUser | null> {
  let body: unknown;
  try {
    // GET 은 fetch 기본 method 이므로 init 을 넘기지 않는다(apiClient 가 credentials
    // 동반 + 401 refresh 재시도를 담당).
    body = await request<unknown>(ME_PATH);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 404)) {
      return null;
    }
    throw e;
  }
  // 비객체 body(null · 배열 · 문자열 등) 방어 — 아래 필드 접근 전에 걸러낸다.
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return null;
  }
  const { id, email, role } = body as {
    id?: unknown;
    email?: unknown;
    role?: unknown;
  };
  if (
    typeof id !== 'string' ||
    typeof email !== 'string' ||
    typeof role !== 'string'
  ) {
    return null;
  }
  return { id, email, role };
}

export { fetchCurrentUser, login, logout, refresh, signup, signupDetailed };
export type { CurrentUser, SignupResult };
