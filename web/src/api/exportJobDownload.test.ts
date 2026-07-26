import { beforeEach, describe, expect, it, vi } from 'vitest';

// R-112 — export job-flow 다운로드 러너(T-1245). mock deps 로 전 분기를 jsdom 없이 cover:
// happy / error 각 표면화 / flow·branch(가드·filename fallback·자원 정리·빈 blob·토글).

import {
  runExportJobDownload,
  parseFilename,
  DEFAULT_EXPORT_FILENAME,
  EXPORT_DONE_TEXT,
  type RunExportJobDownloadDeps,
} from './exportJobDownload';
import type { CreateExportInput } from './exportJob';

function makeResponse(
  disposition: string | null,
  blob: Blob = new Blob(['data']),
): Response {
  return {
    blob: async () => blob,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'content-disposition' ? disposition : null,
    },
  } as unknown as Response;
}

function makeDeps(overrides?: Partial<RunExportJobDownloadDeps>) {
  const runJob = vi
    .fn()
    .mockResolvedValue(makeResponse('attachment; filename="report.csv"'));
  const createObjectURL = vi.fn().mockReturnValue('blob:url-1');
  const revokeObjectURL = vi.fn();
  const clickAnchor = vi.fn();
  const describeError = vi.fn((e: unknown) => `사유: ${String(e)}`);
  const setExporting = vi.fn();
  const setExportError = vi.fn();
  const setExportMessage = vi.fn();
  const deps: RunExportJobDownloadDeps = {
    runJob,
    createObjectURL,
    revokeObjectURL,
    clickAnchor,
    describeError,
    exporting: false,
    setExporting,
    setExportError,
    setExportMessage,
    ...overrides,
  };
  return {
    deps,
    runJob,
    createObjectURL,
    revokeObjectURL,
    clickAnchor,
    setExporting,
    setExportError,
    setExportMessage,
  };
}

const input: CreateExportInput = { scope: 'all' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('로컬 상수/parseFilename (hub import 0)', () => {
  it('완료 문구·기본 파일명 상수가 로컬 정의', () => {
    expect(EXPORT_DONE_TEXT).toBe('내보내기 완료');
    expect(DEFAULT_EXPORT_FILENAME).toBe('export.json');
  });

  it('일반 filename="..." 추출', () => {
    expect(parseFilename('attachment; filename="a.csv"')).toBe('a.csv');
  });

  it('filename*=UTF-8 확장(비-ASCII) 우선 percent-decode', () => {
    expect(parseFilename("attachment; filename*=UTF-8''%ED%95%9C.json")).toBe(
      '한.json',
    );
  });

  it('null/빈/무-filename 헤더는 throw 없이 undefined(안전 파싱)', () => {
    expect(parseFilename(null)).toBeUndefined();
    expect(parseFilename('')).toBeUndefined();
    expect(parseFilename('attachment')).toBeUndefined();
  });

  it('malformed percent-encoding → 일반 filename="..." 로 fallthrough(throw 없이)', () => {
    // decodeURIComponent 가 throw 하는 %E4%A% 여도 catch(line 30) 후 일반 filename 분기로
    // 넘어가 fallback.json 을 반환 — 예외가 표면화되지 않는 안전 파싱.
    expect(() =>
      parseFilename("attachment; filename*=UTF-8''%E4%A%; filename=\"fallback.json\""),
    ).not.toThrow();
    expect(
      parseFilename("attachment; filename*=UTF-8''%E4%A%; filename=\"fallback.json\""),
    ).toBe('fallback.json');
  });

  it('malformed percent-encoding + 일반 filename 부재 → throw 없이 undefined', () => {
    // filename*= 만 malformed 이고 뒤에 filename= 이 없으면 catch fallthrough 후 undefined.
    expect(() =>
      parseFilename("attachment; filename*=UTF-8''%E4%A%"),
    ).not.toThrow();
    expect(parseFilename("attachment; filename*=UTF-8''%E4%A%")).toBeUndefined();
  });

  it('decode 결과 빈 문자열(line 27 false) → 일반 filename= 분기로 fallthrough', () => {
    // extMatch[1] 이 공백뿐이면 trim 후 '' → decoded falsy → 일반 filename 분기로 넘어가
    // fallback.json 반환.
    expect(parseFilename('attachment; filename*= ; filename="fallback.json"')).toBe(
      'fallback.json',
    );
  });

  it('decode 결과 빈 문자열 + 일반 filename 부재 → undefined', () => {
    // 빈-decode fallthrough 인데 뒤에 filename= 도 없으면 undefined(throw 없이).
    expect(parseFilename('attachment; filename*= ')).toBeUndefined();
  });
});

describe('runExportJobDownload — happy-path', () => {
  it('runJob 성공 → blob → filename → 파일 저장 + 완료 message + 진행 토글 + 직전 상태 정리', async () => {
    const d = makeDeps();
    await runExportJobDownload(input, d.deps);
    expect(d.runJob).toHaveBeenCalledWith(input);
    expect(d.createObjectURL).toHaveBeenCalledTimes(1);
    expect(d.clickAnchor).toHaveBeenCalledWith('blob:url-1', 'report.csv');
    expect(d.revokeObjectURL).toHaveBeenCalledWith('blob:url-1');
    expect(d.setExportError).toHaveBeenCalledWith(undefined);
    expect(d.setExportMessage).toHaveBeenNthCalledWith(1, undefined);
    expect(d.setExportMessage).toHaveBeenLastCalledWith(EXPORT_DONE_TEXT);
    expect(d.setExporting.mock.calls).toEqual([[true], [false]]);
    expect(d.setExportError).not.toHaveBeenCalledWith(expect.any(String));
  });
});

describe('runExportJobDownload — error path (throw 없이 표면화)', () => {
  it('runJob reject → error 표면화 + 파일 저장 미호출 + 진행 off', async () => {
    const d = makeDeps();
    d.deps.runJob = vi.fn().mockRejectedValue(new Error('timeout'));
    await expect(runExportJobDownload(input, d.deps)).resolves.toBeUndefined();
    expect(d.setExportError).toHaveBeenCalledWith('사유: Error: timeout');
    expect(d.createObjectURL).not.toHaveBeenCalled();
    expect(d.clickAnchor).not.toHaveBeenCalled();
    expect(d.setExporting).toHaveBeenLastCalledWith(false);
  });

  it('response.blob() reject → error 표면화 + 진행 off + 파일 저장 미호출', async () => {
    const d = makeDeps();
    d.deps.runJob = vi.fn().mockResolvedValue({
      blob: async () => {
        throw new Error('blob-fail');
      },
      headers: { get: () => null },
    } as unknown as Response);
    await runExportJobDownload(input, d.deps);
    expect(d.setExportError).toHaveBeenCalledWith('사유: Error: blob-fail');
    expect(d.createObjectURL).not.toHaveBeenCalled();
    expect(d.setExporting).toHaveBeenLastCalledWith(false);
  });

  it('describeError 파생 문구가 그대로 setExportError 로 전달됨(문구 결선)', async () => {
    const d = makeDeps();
    const err = new Error('boom');
    const describeError = vi.fn().mockReturnValue('파생된 사용자 문구');
    d.deps.runJob = vi.fn().mockRejectedValue(err);
    d.deps.describeError = describeError;
    await runExportJobDownload(input, d.deps);
    expect(describeError).toHaveBeenCalledWith(err);
    expect(d.setExportError).toHaveBeenCalledWith('파생된 사용자 문구');
  });
});

describe('runExportJobDownload — flow/branch + negative', () => {
  it('동시 재호출 가드 — exporting:true 면 runJob·setter 전부 미호출(즉시 return, 미토글)', async () => {
    const d = makeDeps({ exporting: true });
    await runExportJobDownload(input, d.deps);
    expect(d.runJob).not.toHaveBeenCalled();
    expect(d.setExporting).not.toHaveBeenCalled();
    expect(d.setExportError).not.toHaveBeenCalled();
    expect(d.setExportMessage).not.toHaveBeenCalled();
    expect(d.createObjectURL).not.toHaveBeenCalled();
  });

  it('filename fallback — content-disposition 없으면 DEFAULT_EXPORT_FILENAME 로 저장', async () => {
    const d = makeDeps();
    d.deps.runJob = vi.fn().mockResolvedValue(makeResponse(null));
    await runExportJobDownload(input, d.deps);
    expect(d.clickAnchor).toHaveBeenCalledWith(
      'blob:url-1',
      DEFAULT_EXPORT_FILENAME,
    );
  });

  it('자원 정리 — clickAnchor throw 해도 revokeObjectURL 호출 + error 표면화 + 진행 off', async () => {
    const d = makeDeps();
    d.deps.clickAnchor = vi.fn(() => {
      throw new Error('click-fail');
    });
    await runExportJobDownload(input, d.deps);
    // finally 로 URL 회수(누수 0) + catch 로 error 표면화 — click 예외에도 정리.
    expect(d.revokeObjectURL).toHaveBeenCalledWith('blob:url-1');
    expect(d.setExportError).toHaveBeenCalledWith('사유: Error: click-fail');
    expect(d.setExporting).toHaveBeenLastCalledWith(false);
  });

  it('빈/0-byte blob 도 throw 없이 저장 흐름 통과 + true→false 토글', async () => {
    const d = makeDeps();
    d.deps.runJob = vi
      .fn()
      .mockResolvedValue(makeResponse('attachment; filename="e.json"', new Blob()));
    await runExportJobDownload(input, d.deps);
    expect(d.clickAnchor).toHaveBeenCalledWith('blob:url-1', 'e.json');
    expect(d.setExportMessage).toHaveBeenLastCalledWith(EXPORT_DONE_TEXT);
    expect(d.setExporting.mock.calls).toEqual([[true], [false]]);
  });
});
