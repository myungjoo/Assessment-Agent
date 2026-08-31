import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// R-112 — T-1828 AdminView → CollectionTargetList 삭제(DELETE) 축 배선 전용 spec. 별도 파일인
// 이유는 file-level vi.mock 이 AdminView.test.tsx 의 markup 단언을 깨지 않게 하기 위함이다
// (AdminView.collection-targets-create.test.tsx 선례 승계). 새 dependency 0 — 컨테이너 렌더가
// renderToStaticMarkup 이라 state 전이는 러너 단위로 직접 검증한다.
import type { ApiResourceState } from '../api/useApiResource';
import type { CollectionTargetListProps } from '../components/CollectionTargetList';
import type { RequestOptions } from '../api/apiClient';

const useApiResourceMock = vi.fn();
vi.mock('../api/useApiResource', () => ({
  useApiResource: (...args: unknown[]) => useApiResourceMock(...args),
  toErrorMessage: (e: unknown) => `문구:${String(e)}`,
}));

// 목록에 내려간 props(특히 onDelete)를 회수해 gating 배선을 직접 확인한다.
const captured: CollectionTargetListProps[] = [];
vi.mock('../components/CollectionTargetList', () => ({
  default: (props: CollectionTargetListProps) => {
    captured.push(props);
    return <div>목록 자리</div>;
  },
}));
// 등록 폼 렌더는 T-1826 spec 책임이라 표식 하나만 남긴다.
vi.mock('../components/CollectionTargetAddForm', () => ({
  COLLECTION_TARGET_TYPES: ['GITHUB', 'CONFLUENCE'],
  default: () => <div>등록 폼 자리</div>,
}));
vi.mock('../components/PersonList', () => ({ default: () => null }));

import AdminView, { runDeleteCollectionTarget as run } from './AdminView';

type Deps = Parameters<typeof run>[1];
const TARGETS_PATH = '/api/collection-targets';
const VALID_ID = 'ct-1';

// 러너 deps 조립. order 는 setDeletingId/setDeleteError 호출을 순서대로 담아 전이를 잠근다.
function makeDeps(
  options: {
    deletingId?: string;
    reject?: unknown;
    resolve?: unknown;
  } = {},
) {
  const order: string[] = [];
  const mocks = {
    remove: vi.fn(async (_path: string, _options: RequestOptions) => {
      if ('reject' in options) throw options.reject;
      return 'resolve' in options ? options.resolve : undefined;
    }),
    describeError: vi.fn((e: unknown) => `문구:${String(e)}`),
    setDeletingId: vi.fn((next?: string) => void order.push(`deleting:${next}`)),
    setDeleteError: vi.fn((next?: string) => void order.push(`err:${next}`)),
    reloadTargets: vi.fn(),
  };
  const deps: Deps = { deletingId: options.deletingId, ...mocks };
  return { deps, mocks, order };
}

describe('runDeleteCollectionTarget (T-1828 러너)', () => {
  // happy-path — 정확한 path·method 로 1 회 발사 + 성공 전이(재조회·진행 on/off).
  it('정상 id 면 DELETE 를 item path 로 1 회 발사하고 재조회한다 (happy-path)', async () => {
    const { deps, mocks, order } = makeDeps();
    await expect(run(VALID_ID, deps)).resolves.toBeUndefined();
    expect(mocks.remove).toHaveBeenCalledTimes(1);
    const [path, options] = mocks.remove.mock.calls[0];
    expect(path).toBe(`${TARGETS_PATH}/${VALID_ID}`);
    expect(options.method).toBe('DELETE');
    // 204 No Content 라 body 를 싣지 않는다(계약 정합).
    expect(options.body).toBeUndefined();
    expect(mocks.reloadTargets).toHaveBeenCalledTimes(1);
    expect(order).toEqual([
      `deleting:${VALID_ID}`,
      'err:undefined',
      'deleting:undefined',
    ]);
  });

  // happy-path 2 — 앞뒤 공백은 제거되고, 비정상 문자가 든 id 는 안전 인코딩돼 path 가 깨지지 않는다.
  it.each([
    ['앞뒤 공백', '  ct-2  ', `${TARGETS_PATH}/ct-2`],
    ['슬래시 포함', 'a/b', `${TARGETS_PATH}/a%2Fb`],
    ['공백 포함', 'a b', `${TARGETS_PATH}/a%20b`],
  ])('id 가 %s 여도 안전한 item path 로 발사한다 (happy-path — 인코딩)', async (
    _label,
    id,
    expected,
  ) => {
    const { deps, mocks } = makeDeps();
    await run(id, deps);
    expect(mocks.remove.mock.calls[0][0]).toBe(expected);
  });

  // error path + negative — ApiError 가 아닌 값으로 reject 해도 describeError 가 흡수해 문구만
  // 세우고 throw 0, 재조회는 일어나지 않는다(실패 시 목록 유지).
  it.each([
    ['403(권한 부족)', new Error('403')],
    ['404(row 부재)', new Error('404')],
    ['500(서버 오류)', new Error('500')],
    ['네트워크 0', new Error('Failed to fetch')],
    ['문자열', 'boom'],
    ['null', null],
  ])('DELETE 가 %s 로 실패해도 throw 없이 문구만 세운다 (error path)', async (
    _label,
    reason,
  ) => {
    const { deps, mocks, order } = makeDeps({ reject: reason });
    await expect(run(VALID_ID, deps)).resolves.toBeUndefined();
    expect(mocks.describeError).toHaveBeenCalledWith(reason);
    expect(mocks.reloadTargets).not.toHaveBeenCalled();
    // finally 가 실패 경로에서도 진행 상태를 해제한다(분기: finally 해제 — 실패).
    expect(order.join('|')).toBe(
      `deleting:${VALID_ID}|err:undefined|err:문구:${reason}|deleting:undefined`,
    );
  });

  // negative — 실패 후 재시도 시 직전 error 가 먼저 비워진 뒤 새 문구가 선다.
  it('재시도 시 직전 error 를 먼저 비운다 (negative)', async () => {
    const { deps, mocks } = makeDeps({ reject: '첫 실패' });
    await run(VALID_ID, deps);
    await run(VALID_ID, deps);
    expect(mocks.setDeleteError.mock.calls.map((c) => c[0]).join('|')).toBe(
      '|문구:첫 실패||문구:첫 실패',
    );
  });

  // negative ⑦ — 204 계약과 달리 body 가 실려 와도(예상 밖 shape) 응답을 소비하지 않으므로
  // throw 0 이고 재조회로 정상 착지한다.
  it.each([
    ['객체', { id: 'ct-1' }],
    ['배열', []],
    ['null', null],
    ['문자열', 'ok'],
    ['undefined', undefined],
  ])('성공 응답이 %s 여도 throw 없이 재조회한다 (negative ⑦ — 예상 밖 shape)', async (
    _label,
    body,
  ) => {
    const { deps, mocks } = makeDeps({ resolve: body });
    await expect(run(VALID_ID, deps)).resolves.toBeUndefined();
    expect(mocks.reloadTargets).toHaveBeenCalledTimes(1);
    expect(mocks.setDeleteError).not.toHaveBeenCalledWith(
      expect.stringContaining('문구:'),
    );
  });

  // 분기 + negative ①②③ — no-op 가드(빈 id / 공백뿐 id / 비문자열 id / in-flight).
  it.each([
    ['id 가 빈 문자열', '', undefined],
    ['id 가 공백뿐', '   ', undefined],
    ['id 가 탭·개행뿐', '\t\n', undefined],
    ['id 가 undefined', undefined, undefined],
    ['id 가 null', null, undefined],
    ['id 가 숫자', 42, undefined],
    ['id 가 객체', {}, undefined],
    ['in-flight 중 재호출', VALID_ID, 'other-id'],
    ['같은 행 in-flight 중 재클릭', VALID_ID, VALID_ID],
  ])('%s 이면 미발사한다 (분기: no-op 가드 / negative ①②③)', async (
    _label,
    id,
    deletingId,
  ) => {
    const { deps, mocks } = makeDeps({ deletingId: deletingId as string });
    await expect(run(id as string, deps)).resolves.toBeUndefined();
    expect(mocks.remove).not.toHaveBeenCalled();
    // 미발사 경로는 진행 상태·error 를 일체 건드리지 않는다(부작용 0).
    expect(mocks.setDeletingId).not.toHaveBeenCalled();
    expect(mocks.setDeleteError).not.toHaveBeenCalled();
    expect(mocks.reloadTargets).not.toHaveBeenCalled();
  });

  // negative ⑥ — 진행 상태는 호출된 행 id 하나만 담고, 종료 시 undefined 로 되돌아간다
  // (다른 행의 진행 상태를 물들이지 않는다 — 격리).
  it('진행 상태는 호출된 행 id 만 담았다가 해제한다 (negative ⑥ — 행 격리)', async () => {
    const { deps, mocks } = makeDeps();
    await run('row-a', deps);
    expect(mocks.setDeletingId.mock.calls.map((c) => c[0])).toEqual([
      'row-a',
      undefined,
    ]);
    // 두 번째 행을 삭제해도 첫 행 id 가 잔존하지 않는다(각 호출이 자기 id 만 세운다).
    mocks.setDeletingId.mockClear();
    await run('row-b', deps);
    expect(mocks.setDeletingId.mock.calls.map((c) => c[0])).toEqual([
      'row-b',
      undefined,
    ]);
  });

  // 분기 — 이중 클릭 차단(negative ③): 첫 호출이 미완인 동안 deletingId 가 서 있으면 두 번째
  // 호출은 발사되지 않아 DELETE 가 정확히 1 회다.
  it('in-flight 중 재클릭은 DELETE 를 한 번만 남긴다 (분기: 이중 DELETE 차단)', async () => {
    let inFlight: string | undefined;
    const remove = vi.fn(async () => undefined);
    const base = {
      remove,
      describeError: (e: unknown) => String(e),
      setDeletingId: (next?: string) => void (inFlight = next),
      setDeleteError: () => undefined,
      reloadTargets: vi.fn(),
    };
    // 첫 호출을 await 하지 않고 곧바로 두 번째를 쏜다(같은 tick 재클릭 재현).
    const first = run(VALID_ID, { ...base, deletingId: inFlight } as Deps);
    await run(VALID_ID, { ...base, deletingId: inFlight } as Deps);
    await first;
    expect(remove).toHaveBeenCalledTimes(1);
  });
});

// prettier-ignore
const EMPTY_OK: ApiResourceState<unknown> = { data: [], loading: false, error: undefined };

// 지정 role 을 me 응답으로 주입해 렌더한다(그 외 path 는 빈 성공). 수집 대상 조회의 reload 만
// 별도 spy 로 회수해 삭제 성공 후 재조회 배선의 실체를 확인한다.
function renderAdmin(role: string) {
  const reloadTargets = vi.fn();
  useApiResourceMock.mockImplementation((path: string | null) => {
    if (path === '/api/auth/me') {
      return { ...EMPTY_OK, data: { role }, reload: vi.fn() };
    }
    if (path === TARGETS_PATH) {
      return { ...EMPTY_OK, reload: reloadTargets };
    }
    return { ...EMPTY_OK, reload: vi.fn() };
  });
  const html = renderToStaticMarkup(<AdminView />);
  const paths = useApiResourceMock.mock.calls.map((c) => c[0]);
  return { props: captured[0], paths, html, reloadTargets };
}

describe('AdminView 삭제 배선 (T-1828 컨테이너)', () => {
  beforeEach(() => {
    captured.length = 0;
    useApiResourceMock.mockReset();
  });

  // happy-path + 분기(isAdmin === true) — Admin tier 면 onDelete 콜백이 목록에 내려간다.
  it.each(['Admin', 'SuperAdmin'])(
    'role=%s 이면 목록에 onDelete 콜백을 내려보낸다 (happy-path / 분기: gating true)',
    (role) => {
      const { props } = renderAdmin(role);
      expect(props).toBeDefined();
      expect(typeof props.onDelete).toBe('function');
    },
  );

  // 분기(isAdmin === false) + negative ④ — non-Admin 에게는 onDelete 가 undefined 라 삭제 버튼
  // 자체가 렌더되지 않는다(backend `@Roles("Admin")` 정합 — 403 확정 컨트롤 미노출).
  it.each(['User', 'Viewer', ''])(
    'role=%s 이면 onDelete 를 내리지 않아 삭제 진입점이 없다 (분기: gating false / negative ④)',
    (role) => {
      const { props, html } = renderAdmin(role);
      expect(props).toBeDefined();
      expect(props.onDelete).toBeUndefined();
      // 목록 자체는 gating 바깥이라 그대로 렌더된다(읽기 축 회귀 0).
      expect(html).toContain('목록 자리');
      expect(html).toContain('수집 대상 관리');
    },
  );

  // 분기 — 삭제 축 도입 후에도 수집 대상 조회는 상수 path 1 회다(중복 fetch 0).
  it('수집 대상 조회 path 는 상수 그대로 1 회다 (분기: 조회 회귀 0)', () => {
    const { paths } = renderAdmin('Admin');
    expect(paths.filter((p: unknown) => p === TARGETS_PATH)).toHaveLength(1);
  });

  // negative — 초기 렌더에는 삭제 오류 alert 가 없다(빈 alert 잔존 0).
  it('초기 렌더에는 삭제 오류 alert 가 없다 (negative — 빈 alert 미렌더)', () => {
    const { html } = renderAdmin('Admin');
    // 오류 state 가 undefined 면 alert div 자체가 렌더되지 않는다(빈 alert 잔존 0).
    expect(html).not.toContain('<div role="alert"></div>');
    expect(html).not.toContain('삭제에 실패');
  });

  // negative — 컨테이너가 내려보낸 onDelete 를 빈 id 로 호출해도 throw 하지 않고 재조회도
  // 일으키지 않는다(가드가 컨테이너에서도 살아있다).
  it('컨테이너 onDelete 를 빈 id 로 호출해도 throw 없이 no-op 이다 (negative)', () => {
    const { props, reloadTargets } = renderAdmin('Admin');
    expect(() => props.onDelete?.('')).not.toThrow();
    expect(reloadTargets).not.toHaveBeenCalled();
  });
});
