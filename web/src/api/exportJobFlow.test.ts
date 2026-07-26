import { beforeEach, describe, expect, it, vi } from 'vitest';

// R-112 — export-job orchestration 헬퍼(T-1243) 검증. primitive 와 delay 를 mock deps 로
// 주입해 create → poll → download 전 분기를 실 타이머 대기 없이 cover 한다: happy-path 다단
// 전이 / error path 각 전파 / 즉시 SUCCEEDED / FAILED terminal / timeout / 빈 id / delay 인자.

import {
  runExportJob,
  SUCCEEDED_STATUS,
  FAILED_STATUS,
  type ExportJobFlowDeps,
} from './exportJobFlow';
import type { ExportJob } from './exportJob';

// mock deps 팩토리 — delay 는 즉시 resolve(실 타이머 대기 제거), 인자 단언용 vi.fn 유지.
function makeDeps(): {
  deps: ExportJobFlowDeps;
  createExportJob: ReturnType<typeof vi.fn>;
  getExportJob: ReturnType<typeof vi.fn>;
  downloadExportJob: ReturnType<typeof vi.fn>;
  delay: ReturnType<typeof vi.fn>;
} {
  const createExportJob = vi.fn();
  const getExportJob = vi.fn();
  const downloadExportJob = vi.fn();
  const delay = vi.fn().mockResolvedValue(undefined);
  const deps: ExportJobFlowDeps = {
    createExportJob,
    getExportJob,
    downloadExportJob,
    delay,
  };
  return { deps, createExportJob, getExportJob, downloadExportJob, delay };
}

const job = (id: string, status: string): ExportJob => ({ id, status });
const rawResponse = { blob: async () => new Blob() } as unknown as Response;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runExportJob — 종결 토큰 상수', () => {
  // backend prisma JobStatus enum 그대로 박제됐는지 — web 로컬 오타 방지 앵커.
  it('terminal 토큰이 backend JobStatus enum(SUCCEEDED/FAILED)과 일치', () => {
    expect(SUCCEEDED_STATUS).toBe('SUCCEEDED');
    expect(FAILED_STATUS).toBe('FAILED');
  });
});

describe('runExportJob — happy-path / flow 전이', () => {
  // 다단 전이 분기 cover + 각 primitive 호출 횟수/인자 검증(delay 로 즉시 진행).
  it('PENDING→RUNNING→SUCCEEDED 다단 전이 후 download 의 Response 를 resolve', async () => {
    const { deps, createExportJob, getExportJob, downloadExportJob, delay } =
      makeDeps();
    createExportJob.mockResolvedValueOnce(job('job-1', 'PENDING'));
    getExportJob
      .mockResolvedValueOnce(job('job-1', 'RUNNING'))
      .mockResolvedValueOnce(job('job-1', 'SUCCEEDED'));
    downloadExportJob.mockResolvedValueOnce(rawResponse);

    const result = await runExportJob({ scope: 'all' }, deps, {
      intervalMs: 500,
    });

    expect(result).toBe(rawResponse);
    expect(createExportJob).toHaveBeenCalledTimes(1);
    expect(createExportJob).toHaveBeenCalledWith({ scope: 'all' });
    // 정확한 id 로 poll 2회(RUNNING, SUCCEEDED) 위임.
    expect(getExportJob).toHaveBeenCalledTimes(2);
    expect(getExportJob).toHaveBeenNthCalledWith(1, 'job-1');
    expect(getExportJob).toHaveBeenNthCalledWith(2, 'job-1');
    expect(downloadExportJob).toHaveBeenCalledTimes(1);
    expect(downloadExportJob).toHaveBeenCalledWith('job-1');
    // poll 사이마다 정확한 intervalMs 로 delay 호출.
    expect(delay).toHaveBeenNthCalledWith(1, 500);
    expect(delay).toHaveBeenNthCalledWith(2, 500);
  });

  it('즉시 SUCCEEDED job 은 poll 0회로 바로 download (즉시 완료 경계)', async () => {
    const { deps, createExportJob, getExportJob, downloadExportJob, delay } =
      makeDeps();
    createExportJob.mockResolvedValueOnce(job('job-2', 'SUCCEEDED'));
    downloadExportJob.mockResolvedValueOnce(rawResponse);

    const result = await runExportJob({}, deps);

    expect(result).toBe(rawResponse);
    expect(getExportJob).not.toHaveBeenCalled();
    expect(delay).not.toHaveBeenCalled();
    expect(downloadExportJob).toHaveBeenCalledWith('job-2');
  });

  it('intervalMs 미전달 시 기본값 1000ms 로 delay 호출 (기본 옵션 경계)', async () => {
    const { deps, createExportJob, getExportJob, downloadExportJob, delay } =
      makeDeps();
    createExportJob.mockResolvedValueOnce(job('job-3', 'PENDING'));
    getExportJob.mockResolvedValueOnce(job('job-3', 'SUCCEEDED'));
    downloadExportJob.mockResolvedValueOnce(rawResponse);

    await runExportJob({}, deps);

    expect(delay).toHaveBeenCalledWith(1000);
  });
});

describe('runExportJob — 실패/경계 terminal', () => {
  // 실패 job 다운로드 시도 방지 — FAILED 수신 시 poll 즉시 중단 + throw.
  it('FAILED terminal 수신 시 Error throw + download 미호출', async () => {
    const { deps, createExportJob, getExportJob, downloadExportJob } =
      makeDeps();
    createExportJob.mockResolvedValueOnce(job('job-4', 'PENDING'));
    getExportJob.mockResolvedValueOnce(job('job-4', 'FAILED'));

    await expect(runExportJob({}, deps)).rejects.toThrow('FAILED');
    expect(downloadExportJob).not.toHaveBeenCalled();
  });

  it('즉시 FAILED job 은 poll 없이 throw (download 미호출)', async () => {
    const { deps, createExportJob, getExportJob, downloadExportJob } =
      makeDeps();
    createExportJob.mockResolvedValueOnce(job('job-5', 'FAILED'));

    await expect(runExportJob({}, deps)).rejects.toThrow('FAILED');
    expect(getExportJob).not.toHaveBeenCalled();
    expect(downloadExportJob).not.toHaveBeenCalled();
  });

  it('계속 RUNNING 이면 maxPolls 회 후 timeout Error, download 미호출 (경계값)', async () => {
    const { deps, createExportJob, getExportJob, downloadExportJob, delay } =
      makeDeps();
    createExportJob.mockResolvedValueOnce(job('job-6', 'PENDING'));
    getExportJob.mockResolvedValue(job('job-6', 'RUNNING'));

    await expect(
      runExportJob({}, deps, { maxPolls: 3, intervalMs: 10 }),
    ).rejects.toThrow('timeout');
    // 정확히 maxPolls(3)회만 poll — 무한 loop 없음.
    expect(getExportJob).toHaveBeenCalledTimes(3);
    expect(delay).toHaveBeenCalledTimes(3);
    expect(downloadExportJob).not.toHaveBeenCalled();
  });

  it('생성 job 에 id 가 없으면 poll/download 없이 Error throw (비정상 시퀀스)', async () => {
    const { deps, createExportJob, getExportJob, downloadExportJob } =
      makeDeps();
    createExportJob.mockResolvedValueOnce(job('', 'PENDING'));

    await expect(runExportJob({}, deps)).rejects.toThrow('id');
    expect(getExportJob).not.toHaveBeenCalled();
    expect(downloadExportJob).not.toHaveBeenCalled();
  });
});

describe('runExportJob — error path 전파 (swallow 없이)', () => {
  it('createExportJob reject 를 전파하고 poll/download 미호출 (예: 403)', async () => {
    const { deps, createExportJob, getExportJob, downloadExportJob } =
      makeDeps();
    createExportJob.mockRejectedValueOnce(new Error('HTTP 403'));

    await expect(runExportJob({}, deps)).rejects.toThrow('HTTP 403');
    expect(getExportJob).not.toHaveBeenCalled();
    expect(downloadExportJob).not.toHaveBeenCalled();
  });

  it('getExportJob reject 를 전파하고 download 미호출', async () => {
    const { deps, createExportJob, getExportJob, downloadExportJob } =
      makeDeps();
    createExportJob.mockResolvedValueOnce(job('job-7', 'PENDING'));
    getExportJob.mockRejectedValueOnce(new Error('HTTP 500'));

    await expect(runExportJob({}, deps)).rejects.toThrow('HTTP 500');
    expect(downloadExportJob).not.toHaveBeenCalled();
  });

  it('downloadExportJob reject 를 전파 (SUCCEEDED 후 download 실패)', async () => {
    const { deps, createExportJob, downloadExportJob } = makeDeps();
    createExportJob.mockResolvedValueOnce(job('job-8', 'SUCCEEDED'));
    downloadExportJob.mockRejectedValueOnce(new Error('HTTP 404'));

    await expect(runExportJob({}, deps)).rejects.toThrow('HTTP 404');
    expect(downloadExportJob).toHaveBeenCalledWith('job-8');
  });
});

describe('runExportJob — 기본 delay(미주입) 경로', () => {
  it('delay 미주입 시 기본 setTimeout 기반 대기로 정상 완료', async () => {
    vi.useFakeTimers();
    try {
      const createExportJob = vi
        .fn()
        .mockResolvedValueOnce(job('job-9', 'PENDING'));
      const getExportJob = vi
        .fn()
        .mockResolvedValueOnce(job('job-9', 'SUCCEEDED'));
      const downloadExportJob = vi.fn().mockResolvedValueOnce(rawResponse);
      // delay 미주입 — 기본 defaultDelay(setTimeout) 사용.
      const deps: ExportJobFlowDeps = {
        createExportJob,
        getExportJob,
        downloadExportJob,
      };

      const promise = runExportJob({}, deps, { intervalMs: 20 });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe(rawResponse);
      expect(getExportJob).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
