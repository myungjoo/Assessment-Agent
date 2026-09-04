import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// R-112 — T-1884 useAdminImportExport(AdminView import/export 축 순수 추출) 전용 colocated spec.
//
// harness 는 AdminView.collection-targets-mount.test.tsx 선례를 승계한다(신규 dependency 0 —
// RTL · react-test-renderer 미도입): probe 컴포넌트가 hook 을 호출하고 renderToStaticMarkup 으로
// 1 회 렌더한 뒤, 렌더마다 sink 에 쌓인 반환값을 단언한다. 상태 전이가 필요한 분기(busy · error ·
// message 합성)는 "러너 mock 이 주입받은 setter 를 렌더 단계에서 호출한다" 는 방식으로 만든다 —
// setState 를 자기 자신을 렌더 중인 컴포넌트에서 호출하면 React 가 즉시 재렌더하므로(render-phase
// update), 서버 렌더 harness 에서도 갱신된 합성 결과를 관측할 수 있다.
//
// 러너 4 종은 vi.mock 으로 대체한다 — 본 spec 의 검증 대상은 "hook 이 어떤 인자를 어떤 러너에
// 넘기는가(주입 계약)" 이고 러너 본문 동작은 adminImportExportRunners 쪽 spec 의 책임이다.

// vi.mock factory 는 파일 최상단으로 hoist 되므로 factory 가 참조하는 값도 vi.hoisted 로 함께
// 끌어올린다(일반 const 는 TDZ 라 mocking 시점에 접근 불가).
const {
  runAdminExportJobMock,
  runImportPreviewMock,
  runConfirmedImportMock,
  clearImportConfirmMock,
  // 이동 전 handleExport 가 `...browserDownloadDeps` 로 펼쳐 주입하던 DownloadDeps 3 키. 실제
  // 브라우저 구현 대신 식별 가능한 stub 을 주입해 "펼침이 살아있는가" 를 identity 로 잠근다.
  downloadDepsStub,
} = vi.hoisted(() => ({
  runAdminExportJobMock: vi.fn(),
  runImportPreviewMock: vi.fn(),
  runConfirmedImportMock: vi.fn(),
  clearImportConfirmMock: vi.fn(),
  downloadDepsStub: {
    createObjectURL: vi.fn(() => 'blob:stub'),
    revokeObjectURL: vi.fn(),
    clickAnchor: vi.fn(),
  },
}));

vi.mock('./adminImportExportRunners', () => ({
  browserDownloadDeps: downloadDepsStub,
  runAdminExportJob: (...args: unknown[]) => runAdminExportJobMock(...args),
  runImportPreview: (...args: unknown[]) => runImportPreviewMock(...args),
  runConfirmedImport: (...args: unknown[]) => runConfirmedImportMock(...args),
  clearImportConfirm: (...args: unknown[]) => clearImportConfirmMock(...args),
}));

import { useAdminImportExport } from './useAdminImportExport';

type Hook = ReturnType<typeof useAdminImportExport>;
type Deps = Record<string, unknown>;

/** 렌더 단계에서 hook 을 호출하고 매 렌더의 반환값을 sink 에 적재하는 probe. */
function Probe({
  sink,
  fire,
  initialConfirm,
}: {
  sink: Hook[];
  fire?: (hook: Hook, renderIndex: number) => void;
  initialConfirm?: string;
}) {
  const hook = useAdminImportExport(initialConfirm);
  sink.push(hook);
  fire?.(hook, sink.length);
  return null;
}

/**
 * probe 를 1 회 정적 렌더하고 렌더별 반환값 배열을 돌려준다. `fire` 는 렌더 단계에서 호출되므로
 * 여기서 setter 를 건드리면 render-phase update 가 일어나 다음 렌더가 이어진다(무한 루프를 피하려고
 * 호출자가 renderIndex 로 발화 시점을 스스로 제한한다).
 */
function renderProbe(options: {
  fire?: (hook: Hook, renderIndex: number) => void;
  initialConfirm?: string;
}): Hook[] {
  const sink: Hook[] = [];
  // JSX 대신 createElement 를 쓰는 이유: 본 spec 이 순수 .ts 모듈의 colocated spec 이라
  // scripts/check-spec-presence.sh 가 기대하는 `<모듈명>.test.ts` 이름을 지켜야 한다(.tsx 는
  // 대응 spec 으로 인식되지 않는다). probe 는 null 만 반환하므로 JSX 가 실제로 필요하지 않다.
  renderToStaticMarkup(
    createElement(Probe, {
      sink,
      fire: options.fire,
      initialConfirm: options.initialConfirm,
    }),
  );
  return sink;
}

/** 마지막 렌더(= 모든 render-phase update 반영 후)의 반환값. */
function lastOf(sink: Hook[]): Hook {
  return sink[sink.length - 1];
}

beforeEach(() => {
  vi.clearAllMocks();
  runAdminExportJobMock.mockReturnValue(Promise.resolve());
  runImportPreviewMock.mockReturnValue(Promise.resolve());
  runConfirmedImportMock.mockReturnValue(Promise.resolve());
  clearImportConfirmMock.mockReturnValue(undefined);
});

describe('useAdminImportExport — happy path(초기 반환 계약)', () => {
  it('반환 3 심볼의 초기값을 고정한다', () => {
    const hook = lastOf(renderProbe({}));

    expect(hook.selectedScope).toBe('');
    expect(typeof hook.handleScopeChange).toBe('function');
    expect(hook.importExportPanelProps.busy).toBe(false);
    expect(hook.importExportPanelProps.error).toBeUndefined();
    expect(hook.importExportPanelProps.message).toBeUndefined();
    expect(hook.importExportPanelProps.importConfirmText).toBeUndefined();
    expect(typeof hook.importExportPanelProps.onExport).toBe('function');
    expect(typeof hook.importExportPanelProps.onImportFile).toBe('function');
    expect(typeof hook.importExportPanelProps.onConfirmImport).toBe('function');
    expect(typeof hook.importExportPanelProps.onCancelImport).toBe('function');
  });

  it('initialImportConfirmText 를 주면 확인 문구 초기값으로 승계한다(T-1309 affordance 보존)', () => {
    const hook = lastOf(renderProbe({ initialConfirm: '3 건이 덮어써집니다' }));

    expect(hook.importExportPanelProps.importConfirmText).toBe(
      '3 건이 덮어써집니다',
    );
  });

  it('handleScopeChange 가 selectedScope 를 갱신한다', () => {
    const sink = renderProbe({
      fire: (hook, index) => {
        if (index === 1) hook.handleScopeChange({ target: { value: 'g1' } });
      },
    });

    expect(lastOf(sink).selectedScope).toBe('g1');
  });
});

describe('useAdminImportExport — happy path(핸들러 주입 계약)', () => {
  it('onExport 가 runAdminExportJob 을 1 회 호출하고 이동 전과 같은 키를 주입한다', () => {
    const sink = renderProbe({
      fire: (hook, index) => {
        if (index === 1) hook.handleScopeChange({ target: { value: 'g7' } });
        if (index === 2) hook.importExportPanelProps.onExport?.();
      },
    });

    expect(lastOf(sink)).toBeDefined();
    expect(runAdminExportJobMock).toHaveBeenCalledTimes(1);
    const [scope, deps] = runAdminExportJobMock.mock.calls[0] as [string, Deps];
    // scope 는 최신 선택값이 stale 없이 전달된다(이동 전 deps 배열에 selectedScope 포함).
    expect(scope).toBe('g7');
    expect(Object.keys(deps).sort()).toEqual(
      [
        'clickAnchor',
        'createExportJob',
        'createObjectURL',
        'describeError',
        'downloadExportJob',
        'exporting',
        'getExportJob',
        'revokeObjectURL',
        'setExportError',
        'setExportMessage',
        'setExporting',
      ].sort(),
    );
    expect(deps.exporting).toBe(false);
    expect(typeof deps.describeError).toBe('function');
    // browserDownloadDeps 펼침이 살아있는지 identity 로 확인.
    expect(deps.createObjectURL).toBe(downloadDepsStub.createObjectURL);
    expect(deps.revokeObjectURL).toBe(downloadDepsStub.revokeObjectURL);
    expect(deps.clickAnchor).toBe(downloadDepsStub.clickAnchor);
    for (const key of ['setExporting', 'setExportError', 'setExportMessage']) {
      expect(typeof deps[key]).toBe('function');
    }
  });

  it('onImportFile 이 runImportPreview 를 1 회 호출하고 선택 파일·자기 축 setter 를 주입한다', () => {
    const file = { name: 'backup.json' } as unknown as File;
    renderProbe({
      fire: (hook, index) => {
        if (index === 1) hook.importExportPanelProps.onImportFile?.(file);
      },
    });

    expect(runImportPreviewMock).toHaveBeenCalledTimes(1);
    const [passed, deps] = runImportPreviewMock.mock.calls[0] as [File, Deps];
    expect(passed).toBe(file);
    expect(Object.keys(deps).sort()).toEqual(
      [
        'describeError',
        'importing',
        'post',
        'setImportConfirmText',
        'setImportError',
        'setImportMessage',
        'setImporting',
      ].sort(),
    );
    expect(deps.importing).toBe(false);
    expect(typeof deps.post).toBe('function');
  });

  it('onConfirmImport 가 runConfirmedImport 를 1 회 호출하고 보관 파일 setter 까지 주입한다', () => {
    const file = { name: 'backup.json' } as unknown as File;
    renderProbe({
      fire: (hook, index) => {
        // 파일 선택(보관) → 확정 순서를 그대로 재현한다.
        if (index === 1) hook.importExportPanelProps.onImportFile?.(file);
        if (index === 2) hook.importExportPanelProps.onConfirmImport?.();
      },
    });

    expect(runConfirmedImportMock).toHaveBeenCalledTimes(1);
    const [passed, deps] = runConfirmedImportMock.mock.calls[0] as [File, Deps];
    expect(passed).toBe(file);
    expect(Object.keys(deps).sort()).toEqual(
      [
        'describeError',
        'importing',
        'post',
        'setImportConfirmText',
        'setImportError',
        'setImportMessage',
        'setImporting',
        'setPendingImportFile',
      ].sort(),
    );
  });

  it('onCancelImport 가 clearImportConfirm 에 정리 setter 2 개만 넘긴다', () => {
    renderProbe({
      fire: (hook, index) => {
        if (index === 1) hook.importExportPanelProps.onCancelImport?.();
      },
    });

    expect(clearImportConfirmMock).toHaveBeenCalledTimes(1);
    const [deps] = clearImportConfirmMock.mock.calls[0] as [Deps];
    expect(Object.keys(deps).sort()).toEqual([
      'setImportConfirmText',
      'setPendingImportFile',
    ]);
  });
});

describe('useAdminImportExport — error path', () => {
  it('러너가 reject 해도 onExport 는 동기 throw 하지 않고 그 Promise 를 전파한다', async () => {
    const failure = new Error('export 실패');
    runAdminExportJobMock.mockReturnValue(Promise.reject(failure));
    let returned: unknown;

    expect(() => {
      renderProbe({
        fire: (hook, index) => {
          if (index === 1)
            returned = (
              hook.importExportPanelProps.onExport as () => unknown
            )();
        },
      });
    }).not.toThrow();

    await expect(returned as Promise<void>).rejects.toBe(failure);
  });

  it('러너가 reject 해도 onImportFile 은 동기 throw 하지 않고 그 Promise 를 전파한다', async () => {
    const failure = new Error('preview 실패');
    runImportPreviewMock.mockReturnValue(Promise.reject(failure));
    let returned: unknown;

    expect(() => {
      renderProbe({
        fire: (hook, index) => {
          if (index === 1)
            returned = (
              hook.importExportPanelProps.onImportFile as (f: File) => unknown
            )({ name: 'x.json' } as unknown as File);
        },
      });
    }).not.toThrow();

    await expect(returned as Promise<void>).rejects.toBe(failure);
  });

  it('handleScopeChange 에 value 없는 event 형태가 와도 throw 하지 않는다(hook 은 검증하지 않는다)', () => {
    const sink = renderProbe({
      fire: (hook, index) => {
        if (index === 1)
          hook.handleScopeChange({
            target: {},
          } as { target: { value: string } });
      },
    });

    expect(lastOf(sink).selectedScope).toBeUndefined();
  });
});

describe('useAdminImportExport — importExportPanelProps 합성 분기', () => {
  it('busy: 양쪽 false → false, export 진행 → true', () => {
    expect(lastOf(renderProbe({})).importExportPanelProps.busy).toBe(false);

    runAdminExportJobMock.mockImplementation((_scope: string, deps: Deps) => {
      (deps.setExporting as (v: boolean) => void)(true);
      return Promise.resolve();
    });
    const sink = renderProbe({
      fire: (hook, index) => {
        if (index === 1) hook.importExportPanelProps.onExport?.();
      },
    });

    expect(lastOf(sink).importExportPanelProps.busy).toBe(true);
  });

  it('busy: import 진행만으로도 true', () => {
    runImportPreviewMock.mockImplementation((_file: File, deps: Deps) => {
      (deps.setImporting as (v: boolean) => void)(true);
      return Promise.resolve();
    });
    const sink = renderProbe({
      fire: (hook, index) => {
        if (index === 1)
          hook.importExportPanelProps.onImportFile?.({} as unknown as File);
      },
    });

    expect(lastOf(sink).importExportPanelProps.busy).toBe(true);
  });

  it('error/message: export 값이 import 값보다 우선한다', () => {
    runAdminExportJobMock.mockImplementation((_scope: string, deps: Deps) => {
      (deps.setExportError as (v: string) => void)('export 실패 문구');
      (deps.setExportMessage as (v: string) => void)('export 완료 문구');
      return Promise.resolve();
    });
    runImportPreviewMock.mockImplementation((_file: File, deps: Deps) => {
      (deps.setImportError as (v: string) => void)('import 실패 문구');
      (deps.setImportMessage as (v: string) => void)('import 완료 문구');
      return Promise.resolve();
    });

    const sink = renderProbe({
      fire: (hook, index) => {
        if (index === 1) {
          hook.importExportPanelProps.onExport?.();
          hook.importExportPanelProps.onImportFile?.({} as unknown as File);
        }
      },
    });

    expect(lastOf(sink).importExportPanelProps.error).toBe('export 실패 문구');
    expect(lastOf(sink).importExportPanelProps.message).toBe('export 완료 문구');
  });

  it('error/message: export 값이 없으면 import 값으로 폴백한다', () => {
    runImportPreviewMock.mockImplementation((_file: File, deps: Deps) => {
      (deps.setImportError as (v: string) => void)('import 실패 문구');
      (deps.setImportMessage as (v: string) => void)('import 완료 문구');
      return Promise.resolve();
    });

    const sink = renderProbe({
      fire: (hook, index) => {
        if (index === 1)
          hook.importExportPanelProps.onImportFile?.({} as unknown as File);
      },
    });

    expect(lastOf(sink).importExportPanelProps.error).toBe('import 실패 문구');
    expect(lastOf(sink).importExportPanelProps.message).toBe('import 완료 문구');
  });

  it('error/message: 둘 다 없으면 undefined 로 남는다', () => {
    const props = lastOf(renderProbe({})).importExportPanelProps;

    expect(props.error).toBeUndefined();
    expect(props.message).toBeUndefined();
  });
});

describe('useAdminImportExport — negative cases', () => {
  it('① in-flight 재호출이어도 hook 은 막지 않고 exporting: true 가드 값을 러너에 넘긴다', () => {
    runAdminExportJobMock.mockImplementation((_scope: string, deps: Deps) => {
      (deps.setExporting as (v: boolean) => void)(true);
      return Promise.resolve();
    });

    renderProbe({
      fire: (hook, index) => {
        if (index <= 2) hook.importExportPanelProps.onExport?.();
      },
    });

    expect(runAdminExportJobMock).toHaveBeenCalledTimes(2);
    expect((runAdminExportJobMock.mock.calls[0][1] as Deps).exporting).toBe(
      false,
    );
    expect((runAdminExportJobMock.mock.calls[1][1] as Deps).exporting).toBe(
      true,
    );
  });

  it('② 파일 없이 onImportFile 을 호출하면 undefined 가 그대로 러너로 넘어간다', () => {
    renderProbe({
      fire: (hook, index) => {
        if (index === 1)
          (hook.importExportPanelProps.onImportFile as (f?: File) => unknown)(
            undefined,
          );
      },
    });

    expect(runImportPreviewMock).toHaveBeenCalledTimes(1);
    expect(runImportPreviewMock.mock.calls[0][0]).toBeUndefined();
  });

  it('③ 보관 파일 없이 onConfirmImport 를 호출하면 러너가 undefined 를 받는다(hook 자체 판단 없음)', () => {
    renderProbe({
      fire: (hook, index) => {
        if (index === 1) hook.importExportPanelProps.onConfirmImport?.();
      },
    });

    expect(runConfirmedImportMock).toHaveBeenCalledTimes(1);
    expect(runConfirmedImportMock.mock.calls[0][0]).toBeUndefined();
  });

  it('④ onCancelImport 는 POST 계열 러너를 하나도 발화시키지 않는다', () => {
    renderProbe({
      fire: (hook, index) => {
        if (index === 1) hook.importExportPanelProps.onCancelImport?.();
      },
    });

    expect(clearImportConfirmMock).toHaveBeenCalledTimes(1);
    expect(runImportPreviewMock).not.toHaveBeenCalled();
    expect(runConfirmedImportMock).not.toHaveBeenCalled();
    expect(runAdminExportJobMock).not.toHaveBeenCalled();
  });

  it('⑤ 반환 객체와 패널 props 어디에도 내부 setter 를 노출하지 않는다(캡슐화 회귀 가드)', () => {
    const hook = lastOf(renderProbe({}));

    expect(Object.keys(hook).sort()).toEqual([
      'handleScopeChange',
      'importExportPanelProps',
      'selectedScope',
    ]);
    const exposed = [
      ...Object.keys(hook),
      ...Object.keys(hook.importExportPanelProps),
    ];
    expect(exposed.filter((key) => key.startsWith('set'))).toEqual([]);
  });
});
