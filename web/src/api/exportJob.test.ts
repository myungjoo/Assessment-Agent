import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// R-112 — export-job client(T-1242) 검증. apiClient 의 request/requestRaw 를 vi.mock 으로
// 대체해 본 모듈이 (a) 정확한 method/path/body 로 위임하고 (b) 하위 ApiError 를 삼키지
// 않고 전파하며 (c) id 인코딩·requestRaw 구분 등 분기를 지키는지 단언한다. 실제
// fetch/refresh 정책은 apiClient 자체 spec 소관이므로 여기선 primitive 를 mock 한다.

vi.mock('./apiClient', () => ({
  request: vi.fn(),
  requestRaw: vi.fn(),
}));

import { request, requestRaw } from './apiClient';
import {
  EXPORT_BASE_PATH,
  createExportJob,
  getExportJob,
  listRunningExportJobs,
  downloadExportJob,
} from './exportJob';

const requestMock = vi.mocked(request);
const requestRawMock = vi.mocked(requestRaw);

beforeEach(() => {
  requestMock.mockReset();
  requestRawMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('createExportJob', () => {
  // happy-path — POST + 정확한 path + JSON body 로 1회 위임, 반환 job 을 그대로 resolve.
  it('POST /api/admin/export 로 위임하고 생성된 job 을 resolve (happy-path)', async () => {
    const job = { id: 'job-1', status: 'PENDING' };
    requestMock.mockResolvedValueOnce(job);
    const result = await createExportJob({ scope: 'all' });
    expect(result).toEqual(job);
    expect(requestMock).toHaveBeenCalledTimes(1);
    const [path, options] = requestMock.mock.calls[0];
    expect(path).toBe(EXPORT_BASE_PATH);
    expect(options?.method).toBe('POST');
    expect(options?.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(options?.body as string)).toEqual({ scope: 'all' });
  });

  // negative/경계 — scope 미전달({}) 시 빈 body 로 정상 POST(backend 기본 scope 위임).
  it('scope 미전달 시 빈 객체 body 로 POST (빈 입력 경계값)', async () => {
    requestMock.mockResolvedValueOnce({ id: 'job-2', status: 'PENDING' });
    await createExportJob({});
    const [, options] = requestMock.mock.calls[0];
    expect(JSON.parse(options?.body as string)).toEqual({});
  });

  // error path — 하위 request 가 ApiError reject 시 swallow 없이 전파.
  it('하위 request 의 ApiError 를 삼키지 않고 전파 (error path — 403 등)', async () => {
    requestMock.mockRejectedValueOnce(new Error('HTTP 403'));
    await expect(createExportJob({ scope: 'all' })).rejects.toThrow('HTTP 403');
  });

  // 계약 앵커(reviewer round1 NIT closure) — CreateExportInput 의 optional dateRange /
  // entitySelector 를 포함한 전체 body 가 손실·변형 없이 request body 로 pass-through
  // 되는지 단언한다. 세 필드(scope/dateRange/entitySelector)를 모두 담아 호출했을 때
  // 직렬화된 body 가 입력과 정확히 일치해야 backend CreateExportDto 계약이 깨지지 않는다.
  it('scope/dateRange/entitySelector 전체 필드를 body 로 손실 없이 pass-through (계약 앵커)', async () => {
    requestMock.mockResolvedValueOnce({ id: 'job-3', status: 'PENDING' });
    const input = {
      scope: 'selected',
      dateRange: { from: '2026-01-01', to: '2026-07-26' },
      entitySelector: { userIds: ['u-1', 'u-2'], groupIds: ['g-1'] },
    };
    await createExportJob(input);
    const [path, options] = requestMock.mock.calls[0];
    expect(path).toBe(EXPORT_BASE_PATH);
    expect(options?.method).toBe('POST');
    expect(options?.headers).toEqual({ 'Content-Type': 'application/json' });
    // 세 필드가 전부 원형 그대로 직렬화됐는지 — 부분 누락/변형 회귀 방어.
    expect(JSON.parse(options?.body as string)).toEqual(input);
  });
});

describe('getExportJob', () => {
  // happy-path — GET /api/admin/export/:id 로 위임, job resolve.
  it('GET /api/admin/export/job-1 로 위임하고 job 을 resolve (happy-path)', async () => {
    const job = { id: 'job-1', status: 'RUNNING' };
    requestMock.mockResolvedValueOnce(job);
    const result = await getExportJob('job-1');
    expect(result).toEqual(job);
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(requestMock.mock.calls[0][0]).toBe('/api/admin/export/job-1');
  });

  // branch/negative — 특수문자 id 는 encodeURIComponent 로 인코딩(경로 오염 방지).
  it('특수문자 id 를 encodeURIComponent 로 인코딩 (경로 인젝션 방어)', async () => {
    requestMock.mockResolvedValueOnce({ id: 'x', status: 'DONE' });
    await getExportJob('a/b?c');
    expect(requestMock.mock.calls[0][0]).toBe('/api/admin/export/a%2Fb%3Fc');
  });

  // error path — ApiError 전파.
  it('하위 request 의 ApiError 를 전파 (error path — 404)', async () => {
    requestMock.mockRejectedValueOnce(new Error('HTTP 404'));
    await expect(getExportJob('missing')).rejects.toThrow('HTTP 404');
  });
});

describe('listRunningExportJobs', () => {
  // happy-path — GET .../running 로 위임, 배열 resolve.
  it('GET /api/admin/export/running 로 위임하고 배열을 resolve (happy-path)', async () => {
    const jobs = [{ id: 'job-1', status: 'RUNNING' }];
    requestMock.mockResolvedValueOnce(jobs);
    const result = await listRunningExportJobs();
    expect(result).toEqual(jobs);
    expect(requestMock.mock.calls[0][0]).toBe('/api/admin/export/running');
  });

  // 경계값 — 빈 배열 resolve 정상 통과(매칭 0).
  it('빈 배열 resolve 를 정상 통과 (매칭 0 경계값)', async () => {
    requestMock.mockResolvedValueOnce([]);
    const result = await listRunningExportJobs();
    expect(result).toEqual([]);
  });

  // error path — ApiError 전파.
  it('하위 request 의 ApiError 를 전파 (error path — 네트워크 실패)', async () => {
    requestMock.mockRejectedValueOnce(new Error('network error'));
    await expect(listRunningExportJobs()).rejects.toThrow('network error');
  });
});

describe('downloadExportJob', () => {
  // happy-path + branch — request 가 아니라 requestRaw 를 GET .../:id/download 로 호출,
  // raw Response 를 resolve(Blob 소비 정합).
  it('requestRaw 를 GET /api/admin/export/job-1/download 로 호출하고 raw Response resolve', async () => {
    const raw = { blob: async () => new Blob() } as unknown as Response;
    requestRawMock.mockResolvedValueOnce(raw);
    const result = await downloadExportJob('job-1');
    expect(result).toBe(raw);
    expect(requestRawMock).toHaveBeenCalledTimes(1);
    expect(requestRawMock.mock.calls[0][0]).toBe('/api/admin/export/job-1/download');
    // body 파싱 primitive(request)는 쓰지 않음 — Blob 소비 정합 구분.
    expect(requestMock).not.toHaveBeenCalled();
  });

  // branch/negative — 특수문자 id 인코딩(download path 도 방어).
  it('특수문자 id 를 encodeURIComponent 로 인코딩 (download 경로 방어)', async () => {
    requestRawMock.mockResolvedValueOnce({} as Response);
    await downloadExportJob('a/b?c');
    expect(requestRawMock.mock.calls[0][0]).toBe('/api/admin/export/a%2Fb%3Fc/download');
  });

  // error path — requestRaw 의 ApiError 전파.
  it('하위 requestRaw 의 ApiError 를 전파 (error path — 403)', async () => {
    requestRawMock.mockRejectedValueOnce(new Error('HTTP 403'));
    await expect(downloadExportJob('job-1')).rejects.toThrow('HTTP 403');
  });
});
