// 얇은 fetch 래퍼 — P6 composition wiring ②b (T-0380, ADR-0041 Decision 3).
// 브라우저 표준 `fetch` 를 감싸 (1) JWT HttpOnly cookie 자동 동반 (credentials),
// (2) 401→`POST /api/auth/refresh`→원 요청 1 회 재시도, (3) 비-2xx 응답 / 네트워크
// 예외를 명확한 에러로 표면화하는 3 가지 책임만 진다. axios/react-query 등 새
// dependency 0 — 브라우저 표준 `fetch` 만 사용한다 (ADR-0040 §5 게이트).
//
// 정책 (ADR-0041 Decision 3 / ADR-0040 §2):
//  - credentials: 'same-origin' 으로 호출 (vite dev proxy 가 /api 를 NestJS 로 prox,
//    browser 관점 same-origin 유지 — ADR-0008 SameSite=Strict cookie 정합).
//  - 401 응답 시 본 모듈이 한 번만 `POST /api/auth/refresh` 호출. refresh 성공 시
//    원 요청을 1 회 재시도하고 그 결과를 반환한다. refresh 자체는 retry 대상에서
//    제외해 무한 루프를 막는다.
//  - refresh 실패 (401) 시 원 401 응답을 그대로 전파한다 (ApiError(401)). 호출측
//    (auth.login / 후속 데이터 fetch hook) 이 인증 만료를 인지해 로그인 view 전환
//    등 전역 정책을 적용한다 (Out of Scope — 본 slice 는 fetch 단위까지).
//  - 401 외 비-2xx 는 refresh 를 트리거하지 않고 곧장 ApiError 로 변환한다.
//  - fetch 자체가 throw (네트워크 실패) 하면 ApiError(0) 로 표면화한다.

// refresh endpoint 경로 — 본 모듈 내에서만 사용. 외부에서는 auth.refresh() 사용.
const REFRESH_PATH = '/api/auth/refresh';

// apiClient request 가 던지는 에러 — status (HTTP 상태 또는 0=네트워크) + message.
class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// request 옵션 — fetch RequestInit 의 부분 집합 + 본 모듈이 강제하는 credentials.
// _internal_skipRefresh: refresh 요청 자체가 자기 자신을 재호출하지 않도록 하는
// 내부 플래그 (외부 호출자가 직접 쓸 일 없음 — 본 모듈 내 retry path 에서만 사용).
interface RequestOptions extends Omit<RequestInit, 'credentials'> {
  _internalSkipRefresh?: boolean;
}

// 응답을 파싱한다 — Content-Type 이 application/json 이면 JSON, 아니면 text.
async function parseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
}

// 핵심 request — fetch 호출 + 401 재시도 + 에러 변환 1 회 처리.
async function request<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { _internalSkipRefresh, ...init } = options;
  // 응답 raw 객체 — try/catch 로 네트워크 예외도 ApiError 로 표면화한다.
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
    });
  } catch (e) {
    // 네트워크 실패 — status 0 (HTTP 응답 부재) 으로 정상화.
    const message = e instanceof Error ? e.message : 'network error';
    throw new ApiError(0, message);
  }

  // 401 분기 — refresh 1 회 시도 → 성공 시 원 요청 재시도, 실패 시 원 401 전파.
  // refresh 요청 자체는 _internalSkipRefresh 로 본 분기를 건너뛴다 (무한 루프 방지).
  if (response.status === 401 && !_internalSkipRefresh) {
    let refreshResponse: Response;
    try {
      refreshResponse = await fetch(REFRESH_PATH, {
        method: 'POST',
        credentials: 'same-origin',
      });
    } catch {
      // refresh 의 네트워크 실패 — 원 401 을 그대로 전파.
      throw new ApiError(401, 'unauthorized');
    }
    if (refreshResponse.ok) {
      // refresh 성공 — 원 요청을 1 회 재시도. 재시도 시 _internalSkipRefresh=true
      // 로 재-401 이 또 refresh 를 트리거하지 않도록 한다.
      return request<T>(path, { ...options, _internalSkipRefresh: true });
    }
    // refresh 실패 — 원 401 을 ApiError(401) 로 표면화.
    throw new ApiError(401, 'unauthorized');
  }

  // 2xx 외 분기 — refresh 트리거 안 함, 즉시 ApiError 로 변환.
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new ApiError(
      response.status,
      text || `HTTP ${response.status}`,
    );
  }

  // 2xx — body 파싱해 반환.
  return (await parseBody(response)) as T;
}

export { ApiError, request };
export type { RequestOptions };
