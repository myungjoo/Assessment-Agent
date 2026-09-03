import { describe, expect, it, vi } from 'vitest';

// R-112 — T-1860 순수 추출로 신설된 모듈의 **경계 spec**. 러너 5 개와 문구 helper 3 개의 상세
// 행동(가드 조합 · 전이 순서 · 방어적 narrowing 의 모든 갈래 · multipart 조립)은 이미
// AdminView.test.tsx 의 export/import 축 describe 군이 `from './AdminView'` 경로로 전량 cover
// 하고 있어 여기서 그것을 복제하지 않는다. 본 파일이 검증하는 것은 그 spec 이 볼 수 없는 **새
// 모듈 자신의 공개 표면** 이다 — 즉 (a) 값 심볼이 새 모듈에서 직접 import 되는가, (b) AdminView
// 재수출을 거치지 않은 직접 import 경로에서도 각 러너의 정상 / 실패 / 미발사 계약이 같은가,
// (c) 재수출본과 직접 import 본이 **동일 함수 참조** 인가(기존 계약 spec 들의 위임 검증이 이동
// 후에도 계속 유효함의 근거). 이동 전에는 존재할 수 없던 검증이라 기존 spec 과 중복이 아니다.
import {
  ADMIN_IMPORT_PATH,
  ADMIN_IMPORT_PREVIEW_PATH,
  IMPORT_DONE_TEXT,
  IMPORT_FILE_FIELD,
  IMPORT_PREVIEW_UNKNOWN_TEXT,
  IMPORT_RESULT_SUMMARY_PREFIX,
  browserDownloadDeps,
  buildExportInput,
  clearImportConfirm,
  formatImportJobDetail,
  formatRestorePlanConfirmText,
  formatRestoreTotalsPhrase,
  runAdminExportJob,
  runConfirmedImport,
  runImport,
  runImportPreview,
} from './adminImportExportRunners';
import type {
  ConfirmImportDeps,
  ImportDeps,
  ImportPreviewDeps,
  RunAdminExportJobDeps,
} from './adminImportExportRunners';
import {
  buildExportInput as reexportedBuildExportInput,
  clearImportConfirm as reexportedClearImportConfirm,
  formatImportJobDetail as reexportedFormatImportJobDetail,
  formatRestorePlanConfirmText as reexportedFormatRestorePlanConfirmText,
  formatRestoreTotalsPhrase as reexportedFormatRestoreTotalsPhrase,
  runAdminExportJob as reexportedRunAdminExportJob,
  runConfirmedImport as reexportedRunConfirmedImport,
  runImport as reexportedRunImport,
  runImportPreview as reexportedRunImportPreview,
} from './AdminView';

const BOOM = new Error('boom');
// 실패 문구 파생 — 입력을 그대로 되비추는 결정적 함수로 error 표면화 경로를 단언 가능하게 한다.
const describeError = (e: unknown) => `문구:${String(e)}`;

// 테스트용 File — 실 파일 시스템 접근 없이 multipart body 조립만 확인한다.
function sampleFile(name = 'dump.json'): File {
  return new File(['{}'], name, { type: 'application/json' });
}

// 다운로드 Response mock — runExportJobDownload 가 소비하는 최소 표면(blob + content-disposition).
function mockDownloadResponse(disposition: string | null): Response {
  return {
    blob: async () => new Blob(['payload']),
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'content-disposition' ? disposition : null,
    },
  } as unknown as Response;
}

// export 러너 deps harness — client 3-primitive + 파일 저장 부수효과 + state setter 를 mock 으로.
function makeExportDeps(overrides: Partial<RunAdminExportJobDeps> = {}) {
  const base: RunAdminExportJobDeps = {
    createExportJob: vi.fn(async () => ({ id: 'job-1', status: 'SUCCEEDED' })),
    getExportJob: vi.fn(async () => ({ id: 'job-1', status: 'SUCCEEDED' })),
    downloadExportJob: vi.fn(async () =>
      mockDownloadResponse('attachment; filename="export.json"'),
    ),
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn(),
    clickAnchor: vi.fn(),
    describeError,
    exporting: false,
    setExporting: vi.fn(),
    setExportError: vi.fn(),
    setExportMessage: vi.fn(),
    // poll 간 대기 즉시 resolve — 실 타이머 대기 회피.
    delay: async () => {},
  };
  return { ...base, ...overrides };
}

// import 실행 러너 deps harness.
function makeImportDeps(overrides: Partial<ImportDeps> = {}): ImportDeps {
  return {
    post: vi.fn(async () => ({ id: 'imp-1', status: 'PENDING', mode: 'REPLACE' })),
    describeError,
    importing: false,
    setImporting: vi.fn(),
    setImportError: vi.fn(),
    setImportMessage: vi.fn(),
    ...overrides,
  };
}

// preview 러너 deps harness — 실행 deps 에 확인 문구 slot 하나가 더 붙는다.
function makePreviewDeps(
  overrides: Partial<ImportPreviewDeps> = {},
): ImportPreviewDeps {
  return {
    ...makeImportDeps(),
    post: vi.fn(async () => ({
      deleted: { total: 1 },
      inserted: { total: 2 },
      kept: { total: 3 },
      mode: 'REPLACE',
    })),
    setImportConfirmText: vi.fn(),
    ...overrides,
  };
}

// 확정 러너 deps harness — 확인 문구·보관 파일 slot 2 개가 더 붙는다.
function makeConfirmDeps(
  overrides: Partial<ConfirmImportDeps> = {},
): ConfirmImportDeps {
  return {
    ...makeImportDeps(),
    setImportConfirmText: vi.fn(),
    setPendingImportFile: vi.fn(),
    ...overrides,
  };
}

describe('adminImportExportRunners — 직접 import 경로의 공개 표면 (T-1860 경계 spec)', () => {
  it('경로·문구 상수와 런타임 기본 DownloadDeps 가 새 모듈에서 직접 읽힌다 (happy-path — 표면 노출)', () => {
    expect(ADMIN_IMPORT_PATH).toBe('/api/admin/import');
    expect(ADMIN_IMPORT_PREVIEW_PATH).toBe('/api/admin/import/preview');
    expect(IMPORT_FILE_FIELD).toBe('file');
    expect(IMPORT_DONE_TEXT).toBe('가져오기 완료');
    expect(IMPORT_RESULT_SUMMARY_PREFIX).toBe('반영 결과 — ');
    expect(IMPORT_PREVIEW_UNKNOWN_TEXT).toContain('영향 범위를 확인할 수 없습니다');
    // 런타임 기본 구현은 브라우저 primitive 3 종을 그대로 들고 있어야 한다(새 dependency 0).
    expect(typeof browserDownloadDeps.createObjectURL).toBe('function');
    expect(typeof browserDownloadDeps.revokeObjectURL).toBe('function');
    expect(typeof browserDownloadDeps.clickAnchor).toBe('function');
  });

  it('buildExportInput 이 scope 유무로 body 를 가른다 (분기 cover — truthy / 빈 문자열)', () => {
    expect(buildExportInput('persons')).toEqual({ scope: 'persons' });
    expect(buildExportInput('')).toEqual({});
  });
});

describe('adminImportExportRunners — runAdminExportJob (직접 import 경로)', () => {
  it('job 생성→다운로드→완료 message 까지 1 회 발사한다 (happy-path)', async () => {
    const deps = makeExportDeps();
    await runAdminExportJob('persons', deps);
    expect(deps.createExportJob).toHaveBeenCalledTimes(1);
    expect(deps.createExportJob).toHaveBeenCalledWith({ scope: 'persons' });
    expect(deps.downloadExportJob).toHaveBeenCalledWith('job-1');
    expect(deps.clickAnchor).toHaveBeenCalledWith('blob:mock-url', 'export.json');
    expect(deps.setExportMessage).toHaveBeenLastCalledWith('내보내기 완료');
    // 진행 플래그는 on→off 로 되돌아온다(finally).
    expect(deps.setExporting).toHaveBeenNthCalledWith(1, true);
    expect(deps.setExporting).toHaveBeenLastCalledWith(false);
  });

  it('createExportJob 이 reject 하면 throw 없이 error 문구로 흡수하고 진행을 되돌린다 (error path)', async () => {
    const deps = makeExportDeps({
      createExportJob: vi.fn(async () => {
        throw BOOM;
      }),
    });
    await expect(runAdminExportJob('', deps)).resolves.toBeUndefined();
    expect(deps.setExportError).toHaveBeenLastCalledWith('문구:Error: boom');
    // 실패 경로에서는 완료 문구가 설정되지 않는다(시작 정리의 undefined 만 남는다).
    expect(deps.setExportMessage).toHaveBeenLastCalledWith(undefined);
    expect(deps.setExporting).toHaveBeenLastCalledWith(false);
  });

  it('exporting in-flight 중에는 아무 primitive 도 발사하지 않는다 (negative — 이중 발사 0)', async () => {
    const deps = makeExportDeps({ exporting: true });
    await runAdminExportJob('', deps);
    expect(deps.createExportJob).not.toHaveBeenCalled();
    expect(deps.setExporting).not.toHaveBeenCalled();
  });

  it('clickAnchor 가 throw 해도 object URL 을 회수하고 error 로 흡수한다 (negative — 자원 누수 0)', async () => {
    const deps = makeExportDeps({
      clickAnchor: vi.fn(() => {
        throw BOOM;
      }),
    });
    await expect(runAdminExportJob('', deps)).resolves.toBeUndefined();
    expect(deps.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    expect(deps.setExportError).toHaveBeenLastCalledWith('문구:Error: boom');
  });
});

describe('adminImportExportRunners — runImport (직접 import 경로)', () => {
  it('multipart 로 import POST 를 1 회 발사하고 상세 문구를 표면화한다 (happy-path)', async () => {
    const deps = makeImportDeps();
    await runImport(sampleFile(), deps);
    expect(deps.post).toHaveBeenCalledTimes(1);
    const [path, options] = vi.mocked(deps.post).mock.calls[0];
    expect(path).toBe(ADMIN_IMPORT_PATH);
    expect(options.method).toBe('POST');
    // 수동 Content-Type 미지정 — FormData 가 boundary 를 자동 설정한다.
    expect(options.headers).toBeUndefined();
    expect((options.body as FormData).get(IMPORT_FILE_FIELD)).toBeInstanceOf(File);
    expect(deps.setImportMessage).toHaveBeenLastCalledWith(
      '가져오기 요청됨 — job imp-1, 상태 PENDING, 모드 REPLACE',
    );
    expect(deps.setImporting).toHaveBeenLastCalledWith(false);
  });

  it('post 가 reject 하면 throw 없이 error 문구로 흡수한다 (error path)', async () => {
    const deps = makeImportDeps({
      post: vi.fn(async () => {
        throw BOOM;
      }),
    });
    await expect(runImport(sampleFile(), deps)).resolves.toBeUndefined();
    expect(deps.setImportError).toHaveBeenLastCalledWith('문구:Error: boom');
    // 실패 경로에서 완료 문구는 설정되지 않는다(시작 정리의 undefined 가 마지막).
    expect(deps.setImportMessage).toHaveBeenLastCalledWith(undefined);
    expect(deps.setImporting).toHaveBeenLastCalledWith(false);
  });

  it('빈 file 이면 POST 0 회 (negative — 빈 선택 방어)', async () => {
    const deps = makeImportDeps();
    await runImport(undefined as unknown as File, deps);
    expect(deps.post).not.toHaveBeenCalled();
    expect(deps.setImporting).not.toHaveBeenCalled();
  });

  it('importing in-flight 중 재호출은 POST 0 회 (negative — 이중 발사 0)', async () => {
    const deps = makeImportDeps({ importing: true });
    await runImport(sampleFile(), deps);
    expect(deps.post).not.toHaveBeenCalled();
  });
});

describe('adminImportExportRunners — runImportPreview (직접 import 경로)', () => {
  it('preview POST 를 1 회 발사하고 확인 문구를 채운다 (happy-path)', async () => {
    const deps = makePreviewDeps();
    await runImportPreview(sampleFile(), deps);
    expect(deps.post).toHaveBeenCalledTimes(1);
    expect(vi.mocked(deps.post).mock.calls[0][0]).toBe(ADMIN_IMPORT_PREVIEW_PATH);
    expect(deps.setImportConfirmText).toHaveBeenLastCalledWith(
      '가져오기 영향 범위 — 삭제 1 건 / 삽입 2 건 / 보존 3 건 (모드 REPLACE)',
    );
    expect(deps.setImporting).toHaveBeenLastCalledWith(false);
  });

  it('post 가 reject 하면 error 로 흡수하고 확인 문구를 비운다 (error path — 확인 단계 미진입)', async () => {
    const deps = makePreviewDeps({
      post: vi.fn(async () => {
        throw BOOM;
      }),
    });
    await expect(runImportPreview(sampleFile(), deps)).resolves.toBeUndefined();
    expect(deps.setImportError).toHaveBeenLastCalledWith('문구:Error: boom');
    expect(deps.setImportConfirmText).toHaveBeenLastCalledWith(undefined);
    expect(deps.setImporting).toHaveBeenLastCalledWith(false);
  });

  it('빈 file · in-flight 두 가드 모두 POST 0 회 (분기 cover — 가드 2 종)', async () => {
    const emptyFile = makePreviewDeps();
    await runImportPreview(undefined as unknown as File, emptyFile);
    expect(emptyFile.post).not.toHaveBeenCalled();

    const inFlight = makePreviewDeps({ importing: true });
    await runImportPreview(sampleFile(), inFlight);
    expect(inFlight.post).not.toHaveBeenCalled();
    expect(inFlight.setImportConfirmText).not.toHaveBeenCalled();
  });
});

describe('adminImportExportRunners — runConfirmedImport · clearImportConfirm (직접 import 경로)', () => {
  it('확인 상태를 비운 뒤 runImport 경로로 실행한다 (happy-path — 위임)', async () => {
    const deps = makeConfirmDeps();
    await runConfirmedImport(sampleFile(), deps);
    expect(deps.setImportConfirmText).toHaveBeenCalledWith(undefined);
    expect(deps.setPendingImportFile).toHaveBeenCalledWith(undefined);
    // 위임 결과 — runImport 와 같은 경로로 1 회 발사되고 완료 문구가 표면화된다.
    expect(deps.post).toHaveBeenCalledTimes(1);
    expect(vi.mocked(deps.post).mock.calls[0][0]).toBe(ADMIN_IMPORT_PATH);
    expect(deps.setImporting).toHaveBeenLastCalledWith(false);
  });

  it('위임한 post 가 reject 해도 throw 없이 error 로 흡수한다 (error path)', async () => {
    const deps = makeConfirmDeps({
      post: vi.fn(async () => {
        throw BOOM;
      }),
    });
    await expect(runConfirmedImport(sampleFile(), deps)).resolves.toBeUndefined();
    expect(deps.setImportError).toHaveBeenLastCalledWith('문구:Error: boom');
    expect(deps.setImporting).toHaveBeenLastCalledWith(false);
  });

  it('보관 파일 없음 · in-flight 면 정리도 실행도 하지 않는다 (분기 cover — 확인 상태 보존)', async () => {
    const noFile = makeConfirmDeps();
    await runConfirmedImport(undefined, noFile);
    expect(noFile.setImportConfirmText).not.toHaveBeenCalled();
    expect(noFile.setPendingImportFile).not.toHaveBeenCalled();
    expect(noFile.post).not.toHaveBeenCalled();

    const inFlight = makeConfirmDeps({ importing: true });
    await runConfirmedImport(sampleFile(), inFlight);
    expect(inFlight.setImportConfirmText).not.toHaveBeenCalled();
    expect(inFlight.post).not.toHaveBeenCalled();
  });

  it('clearImportConfirm 은 setter 2 개만 비운다 (happy-path — POST 0)', () => {
    const setImportConfirmText = vi.fn();
    const setPendingImportFile = vi.fn();
    expect(
      clearImportConfirm({ setImportConfirmText, setPendingImportFile }),
    ).toBeUndefined();
    expect(setImportConfirmText).toHaveBeenCalledWith(undefined);
    expect(setPendingImportFile).toHaveBeenCalledWith(undefined);
  });
});

describe('adminImportExportRunners — 문구 합성 helper (직접 import 경로)', () => {
  it('formatImportJobDetail 4 갈래 (분기 cover — 비객체 / id 부재 / 부분 합성 / 요약 접미)', () => {
    // ① 비객체 → 정적 완료 문구.
    expect(formatImportJobDetail(null)).toBe(IMPORT_DONE_TEXT);
    // ② id 부재 → 정적 완료 문구.
    expect(formatImportJobDetail({ status: 'PENDING' })).toBe(IMPORT_DONE_TEXT);
    // ③ status·mode 누락 시 그 조각만 생략(부분 합성).
    expect(formatImportJobDetail({ id: 'x1' })).toBe('가져오기 요청됨 — job x1');
    // ④ restoreSummary 가 읽히면 반영 결과 접미가 붙는다.
    expect(
      formatImportJobDetail({
        id: 'x2',
        status: 'PENDING',
        restoreSummary: { deleted: { total: 0 } },
      }),
    ).toBe(`가져오기 요청됨 — job x2, 상태 PENDING (${IMPORT_RESULT_SUMMARY_PREFIX}삭제 0 건)`);
  });

  it('formatImportJobDetail 이 null · 배열 · 빈 id 에서 throw 0 이고 객체를 노출하지 않는다 (negative)', () => {
    for (const bad of [null, undefined, [], [1, 2], { id: '' }, 'x', 3]) {
      const out = formatImportJobDetail(bad);
      expect(out).toBe(IMPORT_DONE_TEXT);
      expect(out).not.toContain('[object Object]');
    }
  });

  it('formatRestoreTotalsPhrase 규약 (a)~(e) (분기 cover)', () => {
    // (a) 비객체·배열 → undefined.
    expect(formatRestoreTotalsPhrase(null)).toBeUndefined();
    expect(formatRestoreTotalsPhrase([])).toBeUndefined();
    // (b) 그룹이 비객체면 그 그룹만 생략 · (c) 유한 number 만 노출(0 포함).
    expect(
      formatRestoreTotalsPhrase({
        deleted: { total: 0 },
        inserted: 'nope',
        kept: { total: Number.NaN },
      }),
    ).toBe('삭제 0 건');
    // (d) 어느 그룹도 못 읽으면 undefined.
    expect(formatRestoreTotalsPhrase({ deleted: {}, inserted: {} })).toBeUndefined();
    // 세 그룹 모두 읽히면 api.md 순서로 이어붙인다.
    expect(
      formatRestoreTotalsPhrase({
        deleted: { total: 1 },
        inserted: { total: 2 },
        kept: { total: 3 },
      }),
    ).toBe('삭제 1 건 / 삽입 2 건 / 보존 3 건');
  });

  it('formatRestoreTotalsPhrase 가 비객체·배열·수치 부재에서 throw 0 (negative — (e))', () => {
    for (const bad of [undefined, 'x', 7, [], [{ total: 1 }]]) {
      expect(() => formatRestoreTotalsPhrase(bad)).not.toThrow();
      expect(formatRestoreTotalsPhrase(bad)).toBeUndefined();
    }
  });

  it('formatRestorePlanConfirmText 가 수치 부재에서 경고 fallback 으로 회피한다 (negative)', () => {
    expect(formatRestorePlanConfirmText(null)).toBe(IMPORT_PREVIEW_UNKNOWN_TEXT);
    expect(formatRestorePlanConfirmText({ mode: 'REPLACE' })).toBe(
      IMPORT_PREVIEW_UNKNOWN_TEXT,
    );
    // mode 가 비어있으면 접미 없이 수치만 노출한다(분기 cover).
    expect(formatRestorePlanConfirmText({ kept: { total: 4 } })).toBe(
      '가져오기 영향 범위 — 보존 4 건',
    );
  });
});

describe('adminImportExportRunners — AdminView 재수출 identity (T-1860 순수 추출 근거)', () => {
  it('재수출본과 직접 import 본이 동일 함수 참조다 (negative — 복제 선언 0)', () => {
    expect(reexportedBuildExportInput).toBe(buildExportInput);
    expect(reexportedRunAdminExportJob).toBe(runAdminExportJob);
    expect(reexportedRunImport).toBe(runImport);
    expect(reexportedRunImportPreview).toBe(runImportPreview);
    expect(reexportedRunConfirmedImport).toBe(runConfirmedImport);
    expect(reexportedClearImportConfirm).toBe(clearImportConfirm);
    expect(reexportedFormatImportJobDetail).toBe(formatImportJobDetail);
    expect(reexportedFormatRestoreTotalsPhrase).toBe(formatRestoreTotalsPhrase);
    expect(reexportedFormatRestorePlanConfirmText).toBe(
      formatRestorePlanConfirmText,
    );
  });
});
