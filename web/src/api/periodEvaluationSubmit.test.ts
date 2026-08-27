import { beforeEach, describe, expect, it, vi } from 'vitest';

// R-112 — 기간 지정 평가 요청 실행 · 응답 정규화 모듈(T-1734, REQ-077 slice 3) 검증.
// deps 주입 mock 으로 네트워크 없이 전 분기를 cover 한다: happy-path 호출 인자 · error path
// 무-throw 흡수 · 정규화 3 분기 · status 매핑 분기 각 1+ · negative 6 종(무효 요청 / body
// 부재 / 비-ApiError reject / 응답 null / assessmentId 비문자열 / 배열 원소 비객체).

import { ApiError } from './apiClient';
import { PERIOD_EVALUATION_PATH, type PeriodEvaluationRequest } from './evaluationPeriod';
import {
  normalizePeriodEvaluationResponse,
  submitPeriodEvaluation,
  toPeriodEvaluationFailureMessage,
  type PeriodEvaluationSubmitDeps,
} from './periodEvaluationSubmit';

// 유효 요청 fixture — slice 1(buildPeriodEvaluationRequest)의 산출 shape 그대로.
function makeRequest(): PeriodEvaluationRequest {
  return {
    path: PERIOD_EVALUATION_PATH,
    body: {
      personId: 'person-1',
      period: 'week',
      scope: 'aggregate',
      periodStart: '2026-08-24',
    },
  };
}

// mock deps — 호출 인자 단언용 vi.fn 을 그대로 노출한다.
function makeDeps(): {
  deps: PeriodEvaluationSubmitDeps;
  request: ReturnType<typeof vi.fn>;
} {
  const request = vi.fn();
  return { deps: { request } as PeriodEvaluationSubmitDeps, request };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('submitPeriodEvaluation — happy path', () => {
  it('정확한 path · method · 헤더 · 직렬화 body 로 deps.request 를 1 회 호출하고 ok 를 반환', async () => {
    const { deps, request } = makeDeps();
    const input = makeRequest();
    request.mockResolvedValueOnce({ assessmentId: 'a-1', created: true });

    const outcome = await submitPeriodEvaluation(input, deps);

    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(PERIOD_EVALUATION_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input.body),
    });
    expect(outcome).toEqual({
      status: 'ok',
      assessmentId: 'a-1',
      created: true,
      resultCount: null,
    });
  });

  it('User ephemeral 배열 응답이면 건수를 보존한 ok 를 반환', async () => {
    const { deps, request } = makeDeps();
    request.mockResolvedValueOnce([{ unitId: 'u-1' }, { unitId: 'u-2' }]);

    const outcome = await submitPeriodEvaluation(makeRequest(), deps);

    expect(outcome).toEqual({
      status: 'ok',
      assessmentId: null,
      created: null,
      resultCount: 2,
    });
  });
});

describe('submitPeriodEvaluation — error path', () => {
  it('ApiError reject 를 throw 없이 status: error + 한국어 사유로 흡수', async () => {
    const { deps, request } = makeDeps();
    request.mockRejectedValueOnce(new ApiError(400, 'Bad Request'));

    const outcome = await submitPeriodEvaluation(makeRequest(), deps);

    expect(outcome.status).toBe('error');
    expect(outcome).toEqual({
      status: 'error',
      message: expect.stringContaining('요청 값이 올바르지 않습니다'),
    });
  });

  it('네트워크 실패(ApiError status 0)는 연결 사유로 흡수', async () => {
    const { deps, request } = makeDeps();
    request.mockRejectedValueOnce(new ApiError(0, 'failed to fetch'));

    const outcome = await submitPeriodEvaluation(makeRequest(), deps);

    expect(outcome).toEqual({
      status: 'error',
      message: expect.stringContaining('네트워크 오류'),
    });
  });
});

describe('submitPeriodEvaluation — negative cases (throw 0)', () => {
  // (1) request 가 null / undefined — 전송 시도 자체를 하지 않는다.
  it.each([
    ['null', null],
    ['undefined', undefined],
  ])('request 가 %s 이면 deps.request 미호출 + error 반환', async (_label, value) => {
    const { deps, request } = makeDeps();

    const outcome = await submitPeriodEvaluation(
      value as unknown as PeriodEvaluationRequest,
      deps,
    );

    expect(request).not.toHaveBeenCalled();
    expect(outcome).toEqual({
      status: 'error',
      message: expect.stringContaining('요청을 조립하지 못했습니다'),
    });
  });

  // (2) body 부재 — path 만 있는 반쪽 요청도 전송하지 않는다.
  it('request.body 가 없으면 deps.request 미호출 + error 반환', async () => {
    const { deps, request } = makeDeps();

    const outcome = await submitPeriodEvaluation(
      { path: PERIOD_EVALUATION_PATH } as unknown as PeriodEvaluationRequest,
      deps,
    );

    expect(request).not.toHaveBeenCalled();
    expect(outcome.status).toBe('error');
  });

  it('request.path 가 빈 문자열이면 deps.request 미호출 + error 반환', async () => {
    const { deps, request } = makeDeps();

    const outcome = await submitPeriodEvaluation(
      { path: '', body: makeRequest().body } as unknown as PeriodEvaluationRequest,
      deps,
    );

    expect(request).not.toHaveBeenCalled();
    expect(outcome.status).toBe('error');
  });

  // (3) 비-ApiError reject 표면(문자열 등)도 값으로 흡수.
  it.each([
    ['문자열', 'boom'],
    ['일반 Error', new Error('boom')],
  ])('deps.request 가 %s 로 reject 해도 throw 0 + 알 수 없는 오류', async (_label, thrown) => {
    const { deps, request } = makeDeps();
    request.mockRejectedValueOnce(thrown);

    const outcome = await submitPeriodEvaluation(makeRequest(), deps);

    expect(outcome).toEqual({
      status: 'error',
      message: expect.stringContaining('알 수 없는 오류'),
    });
  });

  // (4) 응답이 null — 알 수 없는 shape 의 일반 성공으로 흡수.
  it('응답이 null 이어도 throw 0 + 식별자/건수 null 인 ok', async () => {
    const { deps, request } = makeDeps();
    request.mockResolvedValueOnce(null);

    const outcome = await submitPeriodEvaluation(makeRequest(), deps);

    expect(outcome).toEqual({
      status: 'ok',
      assessmentId: null,
      created: null,
      resultCount: null,
    });
  });

  // (5) assessmentId 가 문자열이 아닌 객체 — Admin 분기로 오인하지 않는다.
  it('assessmentId 가 숫자인 객체 응답은 미상 shape 으로 흡수', async () => {
    const { deps, request } = makeDeps();
    request.mockResolvedValueOnce({ assessmentId: 42, created: true });

    const outcome = await submitPeriodEvaluation(makeRequest(), deps);

    expect(outcome).toEqual({
      status: 'ok',
      assessmentId: null,
      created: null,
      resultCount: null,
    });
  });

  // (6) 배열 원소가 비객체 — 건수는 그대로 보존하고 throw 하지 않는다.
  it('배열 원소가 비객체여도 throw 0 + 건수 보존', async () => {
    const { deps, request } = makeDeps();
    request.mockResolvedValueOnce(['x', 3, null]);

    const outcome = await submitPeriodEvaluation(makeRequest(), deps);

    expect(outcome).toEqual({
      status: 'ok',
      assessmentId: null,
      created: null,
      resultCount: 3,
    });
  });
});

describe('normalizePeriodEvaluationResponse — 3 분기', () => {
  it('(a) 배열이면 건수 보존 + assessmentId/created 는 null', () => {
    expect(normalizePeriodEvaluationResponse([{ unitId: 'u-1' }])).toEqual({
      assessmentId: null,
      created: null,
      resultCount: 1,
    });
    expect(normalizePeriodEvaluationResponse([])).toEqual({
      assessmentId: null,
      created: null,
      resultCount: 0,
    });
  });

  it('(b) assessmentId 문자열 객체면 식별자 + created 보존', () => {
    const admin = {
      assessmentId: 'a-9',
      personId: 'p-1',
      period: 'month',
      scope: 'aggregate',
      periodStart: '2026-08-01T00:00:00.000Z',
      created: false,
    };

    expect(normalizePeriodEvaluationResponse(admin)).toEqual({
      assessmentId: 'a-9',
      created: false,
      resultCount: null,
    });
  });

  it('(b`) created 가 비-boolean 이면 created 만 null 로 흡수', () => {
    expect(
      normalizePeriodEvaluationResponse({ assessmentId: 'a-9', created: 'yes' }),
    ).toEqual({ assessmentId: 'a-9', created: null, resultCount: null });
  });

  it.each([
    ['undefined', undefined],
    ['원시 문자열', 'ok'],
    ['숫자', 7],
    ['식별자 없는 객체', { message: 'done' }],
  ])('(c) 알 수 없는 shape(%s)이면 throw 0 + 전부 null', (_label, value) => {
    expect(normalizePeriodEvaluationResponse(value)).toEqual({
      assessmentId: null,
      created: null,
      resultCount: null,
    });
  });

  it('입력 객체를 mutate 하지 않는다', () => {
    const admin = { assessmentId: 'a-1', created: true };
    const snapshot = { ...admin };

    normalizePeriodEvaluationResponse(admin);

    expect(admin).toEqual(snapshot);
  });
});

describe('toPeriodEvaluationFailureMessage — status 매핑 분기', () => {
  it.each([
    [0, '네트워크 오류'],
    [400, '요청 값이 올바르지 않습니다'],
    [401, '인증이 만료되었습니다'],
    [403, '권한이 없습니다'],
    [404, '대상자를 찾을 수 없습니다'],
  ])('status %i 는 구분된 한국어 사유', (status, fragment) => {
    expect(toPeriodEvaluationFailureMessage(new ApiError(status, 'x'))).toContain(
      fragment as string,
    );
  });

  it('5xx 는 서버 오류 공통 문구', () => {
    expect(toPeriodEvaluationFailureMessage(new ApiError(500, 'x'))).toContain(
      '서버 오류',
    );
    expect(toPeriodEvaluationFailureMessage(new ApiError(503, 'x'))).toContain(
      '서버 오류',
    );
  });

  it('매핑 밖 4xx 는 status 를 보존한 일반 문구', () => {
    expect(toPeriodEvaluationFailureMessage(new ApiError(418, 'x'))).toContain(
      'HTTP 418',
    );
  });

  it.each([
    ['문자열', 'boom'],
    ['undefined', undefined],
    ['일반 Error', new Error('boom')],
  ])('비-ApiError(%s)는 알 수 없는 오류로 흡수', (_label, value) => {
    expect(toPeriodEvaluationFailureMessage(value)).toContain('알 수 없는 오류');
  });
});

describe('submitPeriodEvaluation — deps 기본값', () => {
  it('deps 를 생략하면 apiClient.request 를 쓰므로 네트워크 실패가 error 로 흡수', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new TypeError('failed to fetch'));

    const outcome = await submitPeriodEvaluation(makeRequest());

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({
      status: 'error',
      message: expect.stringContaining('네트워크 오류'),
    });
    fetchSpy.mockRestore();
  });
});
