import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RUN_STATUS_PATH,
  fetchRunStatus,
  isRunActive,
  type RunStatusSnapshotView,
} from './runStatus';

// R-112 — 실행 상태 조회 helper(T-1848, ADR-0060 §Follow-ups (e1)) 검증. jsdom 미사용 —
// auth.test.ts 선례대로 전역 fetch 를 vi.fn 으로 mock 해 apiClient 경유 시나리오를
// 단언한다. 파일명 .test.ts 고정(root jest testRegex 충돌 회피).

type FetchResult = {
  ok: boolean;
  status: number;
  headers: { get: (name: string) => string | null };
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

function mockResponse(
  status: number,
  body: unknown,
  contentType = 'application/json',
): FetchResult {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'content-type' ? contentType : null,
    },
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

// backend `RunStatusSnapshot`(run-status.service.ts `32~40 행`)과 1:1 인 응답 본문.
// 최상위 active 만 받고 축은 불변식(`active === (runningCount > 0)`)을 만족하게 채운다.
function snapshot(active: boolean): RunStatusSnapshotView {
  return {
    active,
    evaluation: {
      active,
      runningCount: active ? 1 : 0,
      startedAt: active ? '2026-09-02T00:00:00.000Z' : null,
    },
    collection: { active: false, runningCount: 0, startedAt: null },
    observedAt: '2026-09-02T00:00:01.000Z',
  };
}

describe('runStatus.isRunActive', () => {
  // 경로를 함수 안에 하드코딩하지 않고 상수로 노출한다(auth.ts `20~24 행` 선례).
  it('endpoint 경로를 /api/run-status 로 상수화해 노출한다', () => {
    expect(RUN_STATUS_PATH).toBe('/api/run-status');
  });

  // 분기 (가) — 객체이고 active 가 엄격히 true.
  it('최상위 active 가 true 인 객체에 true 를 준다 (happy-path / 분기 가)', () => {
    expect(isRunActive(snapshot(true))).toBe(true);
    expect(isRunActive({ active: true })).toBe(true);
  });

  // 분기 (나) — 객체이지만 active 가 false.
  it('최상위 active 가 false 인 객체에 false 를 준다 (분기 나)', () => {
    expect(isRunActive(snapshot(false))).toBe(false);
  });

  // 분기 (다) — 객체이지만 active 필드 자체가 없음.
  it('active 필드가 없는 객체에 false 를 준다 (분기 다 — 필드 부재)', () => {
    expect(isRunActive({ observedAt: '2026-09-02T00:00:00.000Z' })).toBe(false);
    expect(isRunActive({})).toBe(false);
  });

  // 분기 (라) — 비객체 입력 전반.
  it('비객체 입력에 false 를 준다 (분기 라 — undefined / 숫자 / boolean)', () => {
    expect(isRunActive(undefined)).toBe(false);
    expect(isRunActive(42)).toBe(false);
    expect(isRunActive(true)).toBe(false);
  });

  // negative 1 · 2 — null(typeof 가 'object' 라 별도 가드 필요) 과 문자열 payload
  // (비-JSON 응답이 text 로 파싱된 경우) 모두 throw 0 · false.
  it('null / 문자열 payload 에 throw 없이 false 를 준다 (negative — null · 문자열)', () => {
    expect(() => isRunActive(null)).not.toThrow();
    expect(isRunActive(null)).toBe(false);
    expect(() => isRunActive('active')).not.toThrow();
    expect(isRunActive('active')).toBe(false);
    expect(isRunActive('')).toBe(false);
  });

  // negative 3 — 배열 payload. 객체이지만 active 프로퍼티가 없어 false 다.
  it('배열 payload 에 throw 없이 false 를 준다 (negative — 배열)', () => {
    expect(() => isRunActive([{ active: true }])).not.toThrow();
    expect(isRunActive([{ active: true }])).toBe(false);
    expect(isRunActive([])).toBe(false);
  });

  // negative 4 · 5 · 7 — 문자열/숫자 truthy 및 비정상 shape 를 true 로 오인하지 않는다.
  it('active 가 "true" · 1 · null · 객체여도 false 다 (negative — truthy 오인 / type mismatch)', () => {
    expect(isRunActive({ active: 'true' })).toBe(false);
    expect(isRunActive({ active: 'false' })).toBe(false);
    expect(isRunActive({ active: 1 })).toBe(false);
    expect(isRunActive({ active: 0 })).toBe(false);
    expect(isRunActive({ active: null })).toBe(false);
    expect(isRunActive({ active: {} })).toBe(false);
  });

  // negative 6 — 최상위 active 없이 축만 active 인 payload. 축 OR 는 backend 책임이라
  // 클라이언트가 대신 계산하지 않는다(§Decision 2).
  it('최상위 active 없이 축만 active 인 payload 에 false 를 준다 (negative — 축만 존재)', () => {
    const axisOnly = { evaluation: { active: true, runningCount: 1 } };
    expect(() => isRunActive(axisOnly)).not.toThrow();
    expect(isRunActive(axisOnly)).toBe(false);
  });
});

describe('runStatus.fetchRunStatus', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // happy-path — active: true 응답에 true 이고 정확한 경로로 1 회만 호출한다.
  it('active: true 응답에 true 를 반환하고 /api/run-status 를 1 회 호출한다 (happy-path)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(200, snapshot(true)));
    await expect(fetchRunStatus()).resolves.toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe(RUN_STATUS_PATH);
  });

  // happy-path 분기 — active: false 응답에 false.
  it('active: false 응답에 false 를 반환한다 (happy-path — 비실행)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(200, snapshot(false)));
    await expect(fetchRunStatus()).resolves.toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  // 부수효과 0 — GET 조회이므로 method 를 덮어쓰지 않고 body 를 싣지 않는다.
  // credentials 는 apiClient 가 강제하므로 helper 가 직접 다루지 않음도 함께 고정한다.
  it('POST 등 다른 method 나 body 를 보내지 않는다 (부수효과 0)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(200, snapshot(false)));
    await fetchRunStatus();
    const [, init] = fetchSpy.mock.calls[0];
    expect(init.method).toBeUndefined();
    expect(init.body).toBeUndefined();
    expect(init.credentials).toBe('same-origin');
  });

  // error path — 401. apiClient 의 401→refresh→retry 경로를 타지만 refresh 도 401 이면
  // 거기서 끝나므로 fetch 는 2 회로 유한하다(무한 루프 0).
  it('401 응답을 reject 없이 false 로 흡수한다 (error path — 미인증)', async () => {
    const unauthorized = () => mockResponse(401, 'unauthorized', 'text/plain');
    fetchSpy.mockResolvedValueOnce(unauthorized());
    fetchSpy.mockResolvedValueOnce(unauthorized());
    await expect(fetchRunStatus()).resolves.toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  // error path — 5xx ApiError 를 흡수하고 재시도 폭주도 만들지 않는다.
  it('500 응답을 false 로 흡수하고 fetch 를 1 회만 호출한다 (error path — 5xx)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(500, 'boom', 'text/plain'));
    await expect(fetchRunStatus()).resolves.toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  // error path — 네트워크 실패(fetch 자체 reject → ApiError(0)) 도 흡수.
  it('fetch 가 throw 해도 reject 없이 false 를 반환한다 (error path — 네트워크 실패)', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('offline'));
    await expect(fetchRunStatus()).resolves.toBe(false);
  });

  // negative — 403(권한 부족) 역시 흡수 대상이다.
  it('403 응답을 false 로 흡수한다 (negative — 권한 부족)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(403, 'forbidden', 'text/plain'));
    await expect(fetchRunStatus()).resolves.toBe(false);
  });

  // negative — 200 이지만 body 가 판정 불가한 payload 인 경우들.
  it('200 이지만 판정 불가 payload 면 false 를 준다 (negative — null / 문자열 / 배열)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(200, null));
    await expect(fetchRunStatus()).resolves.toBe(false);
    fetchSpy.mockResolvedValueOnce(mockResponse(200, 'OK', 'text/plain'));
    await expect(fetchRunStatus()).resolves.toBe(false);
    fetchSpy.mockResolvedValueOnce(mockResponse(200, [{ active: true }]));
    await expect(fetchRunStatus()).resolves.toBe(false);
  });

  // negative — JSON 파싱 자체가 throw 하는 깨진 응답도 흡수한다.
  it('JSON 파싱이 throw 하는 응답도 false 로 흡수한다 (negative — 파싱 불가)', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => {
        throw new Error('unexpected end of JSON input');
      },
      text: async () => '',
    });
    await expect(fetchRunStatus()).resolves.toBe(false);
  });

  // negative — 문자열 truthy 를 실은 200 응답을 true 로 오인하지 않는다.
  it('active: "true" 문자열 응답을 true 로 오인하지 않는다 (negative — 문자열 truthy)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(200, { active: 'true' }));
    await expect(fetchRunStatus()).resolves.toBe(false);
  });
});
