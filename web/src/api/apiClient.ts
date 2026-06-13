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

// 공통 핵심 — fetch 호출 + 401 refresh 1 회 재시도 + 비-2xx/네트워크 에러 변환을 모두
// 처리하고, 성공(2xx) 시 raw `Response` 를 반환한다(body 는 소비하지 않음). request 와
// requestRaw 가 이 핵심을 공유한다(중복 fetch 로직 양산 금지 — T-0390 ④f, ADR-0041
// Decision 3). 본 함수 자체는 body 를 파싱하지 않으므로 JSON(request)·Blob(requestRaw 호출측)
// 어느 소비 방식과도 무관하게 정책(credentials·refresh·ApiError)을 단일 지점에서 강제한다.
async function fetchWithRefresh(
  path: string,
  options: RequestOptions = {},
): Promise<Response> {
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
      return fetchWithRefresh(path, { ...options, _internalSkipRefresh: true });
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

  // 2xx — raw Response 를 그대로 반환(body 미소비). request 가 파싱하거나
  // requestRaw 호출측이 blob()/text() 등으로 직접 소비한다.
  return response;
}

// 핵심 request — fetch 호출 + 401 재시도 + 에러 변환 후 body 를 파싱해 반환한다.
// 시그니처·동작은 ②b(T-0380) 부트 이후 불변 — 호출처(useApiResource/auth/runAssign/
// runImport) 회귀 0. 공통 핵심(fetchWithRefresh)을 재사용하고 본 함수는 body 파싱만 더한다.
async function request<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const response = await fetchWithRefresh(path, options);
  // 2xx — body 파싱해 반환.
  return (await parseBody(response)) as T;
}

// raw Response 반환 형제 helper(T-0390 ④f) — 본문을 파싱하지 않고 성공 시 `Response`
// 자체를 반환한다. request 와 동일한 credentials·401→refresh→retry·비-2xx → ApiError·
// 네트워크 → ApiError(0) 정책을 공통 핵심(fetchWithRefresh)으로 그대로 공유한다. Blob(이진/
// 임의 형식 — 예 GET /api/admin/export) 저장처럼 호출측이 response.blob()/text() 로 직접
// 소비해야 하는 경우에 쓴다(request 가 body 를 미리 파싱·소비해 버려 Blob 부적합).
async function requestRaw(
  path: string,
  options: RequestOptions = {},
): Promise<Response> {
  return fetchWithRefresh(path, options);
}

export { ApiError, request, requestRaw };
export type { RequestOptions };
