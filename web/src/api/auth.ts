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

const LOGIN_PATH = '/api/auth/login';
const REFRESH_PATH = '/api/auth/refresh';

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
// refresh 가 필요할 때 사용한다 (예: GET /api/auth/me 부트 hydration — Out of Scope).
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

export { login, refresh };
