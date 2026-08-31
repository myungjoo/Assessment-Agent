import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// R-112 — T-1825 AdminView → 수집 대상 관리 섹션 마운트 결선 전용 spec
// (ADR-0059 §Follow-ups (e), REQ-070/REQ-072).
// AdminView.service-identity-row-actions-mount.test.tsx harness 를 승계하되, 본 spec 은
// CollectionTargetList 를 stub 으로 치환하지 **않는다** — "GET /api/collection-targets 응답 row 가
// 실제 화면 노드로 렌더되는가" 를 고정하는 것이 목적이라, 컨테이너부터 목록 DOM 까지 한 번에 본다.
// 조회는 useApiResource 를 path 별로 mock 해 주입한다: renderToStaticMarkup 은 useEffect 를
// 실행하지 않아 실제 fetch 가 돌지 않으므로, hook 이 각 HTTP 결과에 대해 내놓는 handle 형태
// (성공 → data, 비-2xx → `HTTP <status>: <message>` error 문구)를 그대로 주입하는 방식이 정본이다.
import type { ApiResourceState } from '../api/useApiResource';
import type { CollectionTargetRow } from '../components/CollectionTargetList';

const useApiResourceMock = vi.fn();
vi.mock('../api/useApiResource', () => ({
  useApiResource: (...args: unknown[]) => useApiResourceMock(...args),
  toErrorMessage: (e: unknown) => `문구:${String(e)}`,
}));

import AdminView from './AdminView';

const AUTH_ME = '/api/auth/me';
const COLLECTION_TARGETS_PATH = '/api/collection-targets';
const HEADING = '수집 대상 관리';
const EMPTY_TEXT = '등록된 수집 대상이 없습니다';
const EMPTY_OK: ApiResourceState<unknown> = {
  data: [],
  loading: false,
  error: undefined,
};

const ROWS: CollectionTargetRow[] = [
  {
    id: 't1',
    type: 'GITHUB',
    instanceKey: 'github-main',
    endpoint: 'https://github.example.com',
    orgs: ['acme'],
    repos: [],
    spaces: [],
    active: true,
  },
  {
    id: 't2',
    type: 'CONFLUENCE',
    instanceKey: 'conf-main',
    endpoint: 'https://conf.example.com',
    orgs: [],
    repos: [],
    spaces: ['ENG'],
    active: false,
  },
];

// 수집 대상 조회에만 지정 handle 을 주입하고 나머지 path 는 빈 성공으로 둔다.
// 반환값은 렌더된 정적 HTML — 목록 노드를 문자열로 직접 검사한다.
function mount(targets?: ApiResourceState<unknown>): string {
  useApiResourceMock.mockImplementation((path: string | null) => {
    if (path === AUTH_ME) {
      return { data: { role: 'SuperAdmin' }, loading: false, error: undefined };
    }
    if (path === COLLECTION_TARGETS_PATH) {
      return targets ?? { ...EMPTY_OK, data: ROWS };
    }
    return EMPTY_OK;
  });
  return renderToStaticMarkup(<AdminView />);
}

// 수집 대상 조회에 쓰인 path 인자만 골라낸다(double-fetch 검증용).
function collectionTargetCallPaths(): unknown[] {
  return useApiResourceMock.mock.calls
    .map((call) => call[0])
    .filter((path) => path === COLLECTION_TARGETS_PATH);
}

describe('AdminView — 수집 대상 관리 섹션 마운트 (T-1825)', () => {
  beforeEach(() => {
    useApiResourceMock.mockReset();
  });

  // happy-path — 섹션 골격(aria-label + <h2>)이 실제로 뜬다.
  it('수집 대상 관리 <section aria-label> + <h2> 를 렌더한다 (happy-path — 섹션 마운트)', () => {
    const html = mount();
    expect(html).toContain(`<section aria-label="${HEADING}">`);
    expect(html).toContain(`<h2>${HEADING}</h2>`);
  });

  // happy-path — 조회 응답 row 가 실제 화면 노드로 렌더된다.
  it('GET /api/collection-targets 응답 row 가 실제 목록 노드로 렌더된다 (happy-path — 데이터 결선)', () => {
    const html = mount();
    expect(html).toContain('github-main');
    expect(html).toContain('https://github.example.com');
    expect(html).toContain('conf-main');
    expect(html).toContain('https://conf.example.com');
    // active=false 인 둘째 행에만 비활성 표식이 붙는다(컴포넌트 계약이 컨테이너를 통과해 보인다).
    expect((html.match(/<span>비활성<\/span>/g) ?? []).length).toBe(1);
  });

  // 결선 — 조회는 정확히 1 회다(double-fetch 금지).
  it('수집 대상 조회 path 로 useApiResource 를 정확히 1 회만 호출한다 (결선 — double-fetch 금지)', () => {
    mount();
    expect(collectionTargetCallPaths()).toEqual([COLLECTION_TARGETS_PATH]);
  });

  // 분기 cover — loading 이 그대로 내려가 로딩 표시가 뜬다.
  it('조회 loading 중이면 목록 대신 로딩 표시를 렌더한다 (분기 cover — loading)', () => {
    const html = mount({ data: undefined, loading: true, error: undefined });
    expect(html).toContain(`<h2>${HEADING}</h2>`);
    expect(html).toContain('불러오는 중');
    expect(html).not.toContain('github-main');
  });

  // error path — 비-2xx(500) 응답이면 목록 대신 오류 표면이 뜬다.
  it('조회가 500 이면 목록 대신 role="alert" 오류 표면을 렌더한다 (error path — 비-2xx)', () => {
    const html = mount({
      data: undefined,
      loading: false,
      error: 'HTTP 500: Internal Server Error',
    });
    expect(html).toContain('role="alert"');
    expect(html).toContain('HTTP 500: Internal Server Error');
    expect(html).not.toContain('github-main');
    expect(html).not.toContain(EMPTY_TEXT);
  });

  // 분기 cover / negative ① — 0 row 는 오류가 아니라 정상 빈 상태다(REQ-070 막히지 않는 빈 상태).
  it('응답이 빈 배열이면 REQ-070 빈 상태 문구를 렌더한다 (분기 cover — empty / negative ①)', () => {
    const html = mount(EMPTY_OK);
    expect(html).toContain(EMPTY_TEXT);
    expect(html).not.toContain('role="alert"');
  });

  // negative ⑤ — 응답 body 가 null 이어도 throw 없이 빈 상태로 흡수한다.
  it('응답 body 가 null 이어도 throw 없이 빈 상태로 흡수한다 (negative ⑤ — 비-배열 null)', () => {
    const html = mount({ data: null, loading: false, error: undefined });
    expect(html).toContain(EMPTY_TEXT);
  });

  // negative ⑤-b — 응답 body 가 배열이 아닌 객체여도 throw 없이 빈 상태로 흡수한다.
  it('응답 body 가 객체여도 throw 없이 빈 상태로 흡수한다 (negative ⑤-b — 비-배열 객체)', () => {
    const html = mount({
      data: { items: ROWS },
      loading: false,
      error: undefined,
    });
    expect(html).toContain(EMPTY_TEXT);
    expect(html).not.toContain('github-main');
  });

  // negative — 미조회(data undefined) 상태에서도 throw 없이 빈 상태로 착지한다.
  it('data 가 undefined 인 미조회 상태에서도 throw 없이 빈 상태를 렌더한다 (negative — 미조회)', () => {
    const html = mount({ data: undefined, loading: false, error: undefined });
    expect(html).toContain(EMPTY_TEXT);
  });

  // gating — backend GET 이 User+ tier 라 본 섹션은 isAdmin gating 바깥이다.
  it('비-Admin(User) 로 로그인해도 수집 대상 섹션과 목록이 렌더된다 (gating — User+ 조회 tier)', () => {
    useApiResourceMock.mockImplementation((path: string | null) => {
      if (path === AUTH_ME) {
        return { data: { role: 'User' }, loading: false, error: undefined };
      }
      if (path === COLLECTION_TARGETS_PATH) {
        return { ...EMPTY_OK, data: ROWS };
      }
      return EMPTY_OK;
    });
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toContain(`<h2>${HEADING}</h2>`);
    expect(html).toContain('github-main');
  });
});
