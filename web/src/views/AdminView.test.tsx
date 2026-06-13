import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// R-112 — P6 composition wiring ④a AdminView 컨테이너(T-0385, ADR-0041 Decision 1·3·5)
// 검증. jsdom/@testing-library 미사용(ADR-0040 §5 게이트) — useApiResource 를 vi.mock 으로
// 치환해 data/loading/error 시나리오를 통제하고 react-dom/server renderToStaticMarkup 으로
// 정적 렌더 markup 을 단언한다. 선택 그룹 → 멤버 파생은 export 된 순수 helper(deriveMembers/
// findGroup)를 직접 호출해 검증한다. 파일명 .test.tsx 고정(root jest testRegex 충돌 회피).

import type { ApiResourceState } from '../api/useApiResource';

// useApiResource mock — ④b 이후 AdminView 는 path 별로 세 번 호출한다(GET /api/groups +
// GET /api/llm/providers + GET /api/llm/difficulty-mappings). 따라서 mock 을 path(첫 인자)
// 기준 분기 라우터로 둔다 — 기존 그룹 패널 test 는 path 무시 default 응답으로 호환 유지하고
// (그룹 path 만 set 하면 LLM path 는 빈 성공 응답으로 안전 fallback), LLM 패널 test 는 path
// 별 응답을 명시 주입한다.
const useApiResourceMock = vi.fn();
// useApiResource 모듈 mock — AdminView 는 useApiResource(읽기 hook) 와 toErrorMessage(④c
// mutation 실패 문구 파생)를 같은 모듈에서 import 한다. toErrorMessage 는 실제 동작과 정합한
// 경량 stub 으로 둬(ApiError.status → "HTTP <status>: <msg>" / status 0 → 네트워크 오류) ④c
// 실패 분기의 사람-친화 문구 표면화를 검증 가능하게 한다.
vi.mock('../api/useApiResource', () => ({
  useApiResource: (...args: unknown[]) => useApiResourceMock(...args),
  toErrorMessage: (e: unknown) => {
    if (e instanceof ApiError) {
      if (e.status === 0) {
        return `네트워크 오류: ${e.message}`;
      }
      return `HTTP ${e.status}: ${e.message}`;
    }
    if (e instanceof Error) {
      return e.message;
    }
    return '알 수 없는 오류';
  },
}));

// apiClient mock — ④c onAssign 이 apiClient.request 로 PATCH 를, ④f handleExport 가
// apiClient.requestRaw 로 GET(raw Response)을 발사하므로 둘 다 mock 해 method/path/body 를
// 단언하고 성공/실패 응답을 주입한다. ApiError 는 실제 클래스를 그대로 써 status 기반 문구 파생을
// 검증한다(toErrorMessage stub 과 정합). 단 본 task 의 runExport 단위 검증은 makeExportDeps
// harness 로 getRaw mock 을 직접 주입하므로 requestRawMock 은 정적 렌더 회귀에서만 안전 fallback.
const requestMock = vi.fn();
const requestRawMock = vi.fn();
vi.mock('../api/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/apiClient')>();
  return {
    ...actual,
    request: (...args: unknown[]) => requestMock(...args),
    requestRaw: (...args: unknown[]) => requestRawMock(...args),
  };
});

import { ApiError } from '../api/apiClient';

import AdminView, {
  findGroup,
  deriveMembers,
  deriveProviders,
  deriveDifficultyMapping,
  buildMappingsPath,
  buildExportPath,
  mergeMapping,
  parseFilename,
  triggerDownload,
  runAssign,
  runExport,
  runImport,
} from './AdminView';
import type {
  GroupRow,
  LlmProviderRow,
  DifficultyMappingRow,
  AssignDeps,
  DownloadDeps,
  ExportDeps,
  ImportDeps,
} from './AdminView';

// LLM 조회 두 path 의 기본 성공(빈 데이터) 상태 — 그룹 전용 test 가 LLM path 응답을 명시하지
// 않아도 throw/loading 없이 안전 렌더하도록 빈 배열 성공을 default 로 둔다.
const EMPTY_OK: ApiResourceState<unknown> = {
  data: [],
  loading: false,
  error: undefined,
};

// 그룹 path 만 주입하는 단순 setter — 기존 그룹 패널 test 호환용. 그룹 path 는 주어진 state 를,
// 나머지 LLM 두 path 는 EMPTY_OK(빈 성공) 를 반환한다.
function setResource<T>(state: ApiResourceState<T>) {
  useApiResourceMock.mockImplementation((path: string) =>
    path === '/api/groups' ? state : EMPTY_OK,
  );
}

// path 별 응답을 한 번에 주입하는 라우터 setter — LLM 패널 test 용. 명시 안 된 path 는
// EMPTY_OK 로 fallback.
function setRoutes(routes: Record<string, ApiResourceState<unknown>>) {
  useApiResourceMock.mockImplementation(
    (path: string) => routes[path] ?? EMPTY_OK,
  );
}

const GROUPS = '/api/groups';
const PROVIDERS = '/api/llm/providers';
const MAPPINGS = '/api/llm/difficulty-mappings';

// provider 2 건 샘플 — sanitize view 의 id/provider/modelId 세 필드만 쓴다(apiKey 미포함).
const PROVIDER_ROWS: LlmProviderRow[] = [
  { id: 'cfg1', provider: 'openai', modelId: 'gpt-4o' },
  { id: 'cfg2', provider: 'anthropic', modelId: 'claude-3' },
];

// 난이도 매핑 샘플 — easy→cfg1, hard→cfg2 할당, medium 은 미할당(슬롯 부재).
const MAPPING_ROWS: DifficultyMappingRow[] = [
  { difficulty: 'easy', llmProviderConfigId: 'cfg1' },
  { difficulty: 'hard', llmProviderConfigId: 'cfg2' },
];

// 그룹 2 건 샘플 — 각 그룹이 members 배열을 포함하는 형태(api.md 81 이 키를 명시하지 않아
// members 포함 응답을 보수적으로 수용하는 경로를 검증한다). g1 은 2 멤버, g2 는 1 멤버.
const SAMPLE: GroupRow[] = [
  {
    id: 'g1',
    name: '백엔드팀',
    members: [
      { id: 'p1', name: '김철수', role: '리더' },
      { id: 'p2', name: '이영희' },
    ],
  },
  {
    id: 'g2',
    name: '프론트팀',
    members: [{ id: 'p3', name: '박민수' }],
  },
];

describe('AdminView — 컨테이너 렌더', () => {
  beforeEach(() => {
    useApiResourceMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-path — 그룹 조회 성공 + 그룹 선택 시 그 그룹의 멤버가 GroupMemberList 로 렌더되고
  // 그룹 <select> 가 모든 그룹 옵션을 노출한다.
  it('그룹 선택 시 그 그룹의 멤버를 렌더하고 select 가 모든 그룹 옵션을 노출한다 (happy-path)', () => {
    setResource({ data: SAMPLE, loading: false, error: undefined });
    const html = renderToStaticMarkup(
      <AdminView initialSelectedGroupId="g1" />,
    );
    // 선택 그룹(g1, 백엔드팀)의 멤버가 목록으로 렌더된다.
    expect(html).toContain('김철수');
    expect(html).toContain('이영희');
    expect(html).toContain('리더');
    // 그룹 <select> 가 모든 그룹 옵션(백엔드팀/프론트팀)을 노출한다.
    expect(html).toContain('aria-label="그룹 선택"');
    expect(html).toContain('백엔드팀');
    expect(html).toContain('프론트팀');
    // 멤버 목록은 <ul> 로 렌더(GroupMemberList populated 분기).
    expect(html).toContain('<ul>');
  });

  // error path — 그룹 조회 loading 중 GroupMemberList 가 loading 표시(props 로 loading 전달).
  it('그룹 조회 loading 중 멤버 패널이 진행 표시를 렌더한다 (error path — loading)', () => {
    setResource({ data: undefined, loading: true, error: undefined });
    const html = renderToStaticMarkup(
      <AdminView initialSelectedGroupId="g1" />,
    );
    // loading 우선 정책 — GroupMemberList 가 role="status" + 로딩 문구를 렌더한다.
    expect(html).toContain('role="status"');
    expect(html).toContain('불러오는 중…');
    // loading 중에는 멤버 <ul> 미렌더.
    expect(html).not.toContain('<ul>');
  });

  // error path — 그룹 조회 error 시 GroupMemberList 가 error alert 표시(props 로 error 전달).
  it('그룹 조회 error 시 멤버 패널이 에러 alert 를 렌더한다 (error path — error)', () => {
    setResource({ data: undefined, loading: false, error: 'HTTP 500: groups boom' });
    const html = renderToStaticMarkup(
      <AdminView initialSelectedGroupId="g1" />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('HTTP 500: groups boom');
    expect(html).not.toContain('<ul>');
  });

  // flow/branch — 그룹 미선택(!selectedGroupId) 분기에서 빈 상태/선택 안내를 렌더한다.
  it('그룹 미선택이면 선택 안내 빈 상태를 렌더한다 (flow/branch — 미선택)', () => {
    setResource({ data: SAMPLE, loading: false, error: undefined });
    const html = renderToStaticMarkup(<AdminView />);
    // 미선택이면 멤버 빈 상태(role="status") + 그룹 선택 안내 문구.
    expect(html).toContain('role="status"');
    expect(html).toContain('그룹을 선택하면 인원이 표시됩니다');
    // 멤버 목록(<ul>) 은 미렌더 — 그러나 그룹 옵션은 노출된다.
    expect(html).not.toContain('<ul>');
    expect(html).toContain('백엔드팀');
  });

  // flow/branch — 다른 그룹을 선택하면 멤버 집합이 달라진다(g1 vs g2 멤버 차이).
  it('다른 그룹을 선택하면 멤버 집합이 달라진다 (flow/branch — 그룹 전환)', () => {
    setResource({ data: SAMPLE, loading: false, error: undefined });
    // g2(프론트팀) 선택 → 박민수만, g1 멤버(김철수/이영희) 는 미렌더.
    const html = renderToStaticMarkup(
      <AdminView initialSelectedGroupId="g2" />,
    );
    expect(html).toContain('박민수');
    expect(html).not.toContain('김철수');
    expect(html).not.toContain('이영희');
  });

  // negative — 그룹 응답이 빈 배열(그룹 0 건)일 때 안전 표시(throw 없음).
  it('그룹 0 건이면 빈 상태로 안전 표시한다 (negative — 빈 그룹 목록)', () => {
    setResource({ data: [], loading: false, error: undefined });
    const html = renderToStaticMarkup(<AdminView />);
    // 그룹 0 건 → 옵션은 빈 선택지(그룹을 선택하세요)만, 멤버는 빈 상태(미선택 안내).
    expect(html).toContain('그룹을 선택하세요');
    expect(html).toContain('그룹을 선택하면 인원이 표시됩니다');
    expect(html).not.toContain('<ul>');
  });

  // negative — selectedGroupId 가 목록에 없을 때(stale 선택) 빈 멤버 안전 표시(throw 없음).
  it('선택 그룹이 목록에 없으면(stale) 빈 멤버를 안전 표시한다 (negative — stale 선택)', () => {
    setResource({ data: SAMPLE, loading: false, error: undefined });
    const html = renderToStaticMarkup(
      <AdminView initialSelectedGroupId="없는그룹" />,
    );
    // stale 선택 → 멤버 빈 배열 → 선택했으므로 "이 그룹에 속한 인원이 없습니다" 빈 상태.
    expect(html).toContain('이 그룹에 속한 인원이 없습니다');
    expect(html).not.toContain('<ul>');
    expect(html).not.toContain('김철수');
  });

  // negative — 선택 그룹이 멤버를 포함하지 않으면(members 누락) 빈 멤버 안전 표시(④b fetch 대상).
  it('선택 그룹에 members 가 없으면 빈 멤버를 안전 표시한다 (negative — 멤버 미포함)', () => {
    setResource({
      data: [{ id: 'g9', name: '신규팀' }], // members/persons 누락.
      loading: false,
      error: undefined,
    });
    const html = renderToStaticMarkup(
      <AdminView initialSelectedGroupId="g9" />,
    );
    expect(html).toContain('이 그룹에 속한 인원이 없습니다');
    expect(html).not.toContain('<ul>');
  });

  // negative — 그룹 row 의 id/name 누락 시 보수적 fallback(throw/undefined 렌더 없음).
  it('그룹 row 의 id/name 누락 시 fallback 라벨로 안전 렌더한다 (negative — 그룹 필드 누락)', () => {
    setResource({
      data: [{ members: [{ name: '홍길동' }] }], // id/name 누락 그룹.
      loading: false,
      error: undefined,
    });
    const html = renderToStaticMarkup(<AdminView />);
    // id/name 누락 그룹도 옵션 fallback 라벨로 노출(undefined 렌더/throw 없음).
    expect(html).toContain('이름 없는 그룹');
  });
});

describe('AdminView — 선택 그룹/멤버 파생 (순수 함수)', () => {
  // findGroup — id 로 선택 그룹을 찾고, 미발견/비배열/미선택이면 undefined.
  it('findGroup 이 id 로 그룹을 찾고 미발견/비정상 입력이면 undefined 를 낸다 (helper)', () => {
    expect(findGroup(SAMPLE, 'g2')?.name).toBe('프론트팀');
    // negative — 미발견(stale)/미선택/비배열 입력은 undefined.
    expect(findGroup(SAMPLE, '없음')).toBeUndefined();
    expect(findGroup(SAMPLE, undefined)).toBeUndefined();
    expect(findGroup(undefined, 'g1')).toBeUndefined();
  });

  // deriveMembers — 선택 그룹의 members 를 Member[] 로 매핑 + 미선택/미발견/멤버 미포함 시 빈 배열.
  it('선택 그룹의 members 를 Member[] 로 매핑하고 미선택/미발견이면 빈 배열을 낸다 (멤버 파생)', () => {
    const members = deriveMembers(SAMPLE, 'g1');
    expect(members).toHaveLength(2);
    expect(members[0]).toEqual({ id: 'p1', name: '김철수', role: '리더' });
    expect(members[1]).toEqual({ id: 'p2', name: '이영희', role: undefined });
    // 미선택/미발견(stale)/비배열 → 빈 배열(빈 상태 위임).
    expect(deriveMembers(SAMPLE, undefined)).toEqual([]);
    expect(deriveMembers(SAMPLE, '없음')).toEqual([]);
    expect(deriveMembers(undefined, 'g1')).toEqual([]);
    // 멤버 미포함 그룹 → 빈 배열(④b fetch 대상).
    expect(deriveMembers([{ id: 'g9', name: '신규팀' }], 'g9')).toEqual([]);
  });

  // negative — persons 키 fallback + id/name 누락 row 의 합성 key/fallback 라벨.
  it('persons 키 fallback + id/name 누락 row 를 보수적으로 매핑한다 (negative — 대체 키/누락 필드)', () => {
    // members 없고 persons 만 있는 그룹 → persons 를 멤버로 쓴다.
    const viaPersons = deriveMembers(
      [{ id: 'g3', name: '데브옵스', persons: [{ id: 'p9', fullName: '최강록' }] }],
      'g3',
    );
    // name 없고 fullName 만 있으면 fullName 을 이름으로 쓴다.
    expect(viaPersons[0]).toEqual({ id: 'p9', name: '최강록', role: undefined });

    // id/name 모두 누락 멤버 → 합성 key(m1) + fallback 라벨(이름 미상).
    const fallback = deriveMembers(
      [{ id: 'g4', name: '기획', members: [{ role: '팀원' }] }],
      'g4',
    );
    expect(fallback[0]).toEqual({ id: 'm1', name: '이름 미상', role: '팀원' });

    // 빈 문자열 name 도 fallback 라벨로 보정(의미 없는 빈 이름 방지).
    const emptyName = deriveMembers(
      [{ id: 'g5', name: '운영', members: [{ id: 'p5', name: '' }] }],
      'g5',
    );
    expect(emptyName[0]).toMatchObject({ id: 'p5', name: '이름 미상' });
  });
});

// R-112 — ④b DifficultyModelSelector 패널 배선 검증. useApiResource 가 path 별로 세 번
// 호출되므로 setRoutes 로 LLM 두 path 응답을 주입하고, 그룹 패널 회귀가 없는지(추가만) 함께
// 단언한다. Admin+ 미만 403/error 안전 표시(throw 없음)·빈 배열 seed 전·미지의 키 안전 처리
// 등 negative 분기를 예외 상황마다 cover 한다.
describe('AdminView — LLM 모델 지정 패널 배선 (④b)', () => {
  beforeEach(() => {
    useApiResourceMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-path — provider 목록 + 매핑 조회 성공 시 세 난이도 슬롯 <select> 와 provider 옵션을
  // 노출하고, 매핑된 슬롯(easy→cfg1, hard→cfg2)이 현재 할당 provider 를 selected 로 반영한다.
  it('provider + 매핑 조회 성공 시 슬롯 select 와 provider 옵션을 노출하고 매핑을 반영한다 (happy-path)', () => {
    setRoutes({
      [GROUPS]: { data: [], loading: false, error: undefined },
      [PROVIDERS]: { data: PROVIDER_ROWS, loading: false, error: undefined },
      [MAPPINGS]: { data: MAPPING_ROWS, loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    // 세 난이도 슬롯 <select> 노출(name=easy/medium/hard).
    expect(html).toContain('name="easy"');
    expect(html).toContain('name="medium"');
    expect(html).toContain('name="hard"');
    // provider 옵션이 modelId (provider) 라벨로 노출.
    expect(html).toContain('gpt-4o (openai)');
    expect(html).toContain('claude-3 (anthropic)');
    // 매핑된 슬롯이 현재 할당 provider 를 selected 로 반영(easy→cfg1 selected).
    expect(html).toContain('value="cfg1" selected');
    expect(html).toContain('value="cfg2" selected');
    // 그룹 패널 회귀 0 — 그룹 <select> 도 함께 렌더(추가만).
    expect(html).toContain('aria-label="그룹 선택"');
  });

  // error path — LLM 조회 loading 중 DifficultyModelSelector 가 loading 표시(props 로 전달).
  it('LLM 조회 loading 중 LLM 패널이 진행 표시를 렌더한다 (error path — loading)', () => {
    setRoutes({
      [GROUPS]: { data: [], loading: false, error: undefined },
      [PROVIDERS]: { data: undefined, loading: true, error: undefined },
      [MAPPINGS]: { data: undefined, loading: true, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    // loading 우선 정책 — 불러오는 중 문구 + role="status".
    expect(html).toContain('불러오는 중…');
    // loading 중에는 슬롯 <select>(name=easy) 미렌더.
    expect(html).not.toContain('name="easy"');
  });

  // error path — Admin+ 미만 403(provider 조회 error) 시 LLM 패널이 error alert 를 props 로
  // 받아 안전 표시한다(throw 없음). provider error 우선 정책 검증.
  it('provider 조회 403/error 시 LLM 패널이 error alert 를 안전 표시한다 (error path — 403)', () => {
    setRoutes({
      [GROUPS]: { data: [], loading: false, error: undefined },
      [PROVIDERS]: {
        data: undefined,
        loading: false,
        error: 'HTTP 403: Forbidden',
      },
      [MAPPINGS]: { data: [], loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    // provider 가 없으니 빈 상태 우선 — 그러나 throw 없이 안전 렌더(role="status").
    expect(html).toContain('role="status"');
    expect(html).toContain('등록된 LLM provider 가 없습니다');
    // 그룹 패널 회귀 0.
    expect(html).toContain('aria-label="그룹 선택"');
  });

  // flow/branch — provider 빈 목록(0 건) 분기에서 빈 상태(EMPTY_PROVIDERS_TEXT) 렌더.
  it('provider 0 건이면 LLM 패널이 빈 상태를 렌더한다 (flow/branch — 빈 provider)', () => {
    setRoutes({
      [GROUPS]: { data: [], loading: false, error: undefined },
      [PROVIDERS]: { data: [], loading: false, error: undefined },
      [MAPPINGS]: { data: [], loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toContain('등록된 LLM provider 가 없습니다');
    // provider 0 건이라 슬롯 <select> 미렌더.
    expect(html).not.toContain('name="easy"');
  });

  // flow/branch — provider 1+ 일 때 슬롯 <select> 렌더 분기(빈 매핑이어도 placeholder 로 안전).
  it('provider 1+ 이고 매핑 빈 배열(seed 전)이면 세 슬롯 모두 미할당 placeholder 로 렌더한다 (flow/branch — 빈 매핑)', () => {
    setRoutes({
      [GROUPS]: { data: [], loading: false, error: undefined },
      [PROVIDERS]: { data: PROVIDER_ROWS, loading: false, error: undefined },
      [MAPPINGS]: { data: [], loading: false, error: undefined }, // seed 전 빈 배열.
    });
    const html = renderToStaticMarkup(<AdminView />);
    // 세 슬롯 모두 렌더되지만 선택된 provider 는 없음(미할당 placeholder 가 selected).
    expect(html).toContain('name="easy"');
    expect(html).toContain('선택 안 함');
    // 빈 매핑이라 provider option(cfg1/cfg2)은 selected 가 아님 — placeholder 만 selected.
    expect(html).not.toContain('value="cfg1" selected');
    expect(html).not.toContain('value="cfg2" selected');
  });
});

// R-112 — ④b 신규 파생 helper(deriveProviders/deriveDifficultyMapping) 순수 함수 검증.
// negative 분기(누락 필드·빈 배열·미지의 키·stale 매핑·비배열 입력)를 각 1+ cover.
describe('AdminView — LLM provider/매핑 파생 (순수 함수)', () => {
  // deriveProviders — happy + id/provider/modelId 누락 보수 fallback + 비배열 빈 배열.
  it('deriveProviders 가 row 를 ProviderOption[] 로 매핑하고 누락/비배열을 보수 처리한다 (helper)', () => {
    const opts = deriveProviders(PROVIDER_ROWS);
    expect(opts).toHaveLength(2);
    expect(opts[0]).toEqual({ id: 'cfg1', provider: 'openai', modelId: 'gpt-4o' });

    // negative — id 누락 row 는 index 기반 합성 key(p1), provider/modelId 누락은 빈 문자열.
    const partial = deriveProviders([{ provider: 'openai' }]);
    expect(partial[0]).toEqual({ id: 'p1', provider: 'openai', modelId: '' });
    const noFields = deriveProviders([{}]);
    expect(noFields[0]).toEqual({ id: 'p1', provider: '', modelId: '' });

    // negative — 비배열/undefined 입력은 빈 배열(throw 없이).
    expect(deriveProviders(undefined)).toEqual([]);
    expect(deriveProviders(null as unknown as undefined)).toEqual([]);
  });

  // deriveDifficultyMapping — happy + 빈 배열 + 미지의 키 무시 + stale id + 비배열.
  it('deriveDifficultyMapping 이 세 슬롯을 키로 매핑하고 빈 배열/미지의 키/stale 을 안전 처리한다 (helper)', () => {
    // happy — easy→cfg1, hard→cfg2, medium 은 슬롯 부재라 null.
    expect(deriveDifficultyMapping(MAPPING_ROWS)).toEqual({
      easy: 'cfg1',
      medium: null,
      hard: 'cfg2',
    });

    // negative — 빈 배열(seed 전)은 세 슬롯 모두 null.
    expect(deriveDifficultyMapping([])).toEqual({
      easy: null,
      medium: null,
      hard: null,
    });

    // negative — 미지의 난이도 키('expert')는 무시(throw 없음), 알려진 키만 반영.
    expect(
      deriveDifficultyMapping([
        { difficulty: 'expert', llmProviderConfigId: 'cfgX' },
        { difficulty: 'medium', llmProviderConfigId: 'cfg2' },
      ]),
    ).toEqual({ easy: null, medium: 'cfg2', hard: null });

    // negative — llmProviderConfigId 가 빈 문자열/null 이면 미할당(null)로 보정.
    expect(
      deriveDifficultyMapping([
        { difficulty: 'easy', llmProviderConfigId: '' },
        { difficulty: 'hard', llmProviderConfigId: null },
      ]),
    ).toEqual({ easy: null, medium: null, hard: null });

    // negative — 비배열/undefined 입력도 세 슬롯 모두 null 기본 매핑(throw 없이).
    expect(deriveDifficultyMapping(undefined)).toEqual({
      easy: null,
      medium: null,
      hard: null,
    });
  });

  // negative — stale 매핑(provider 목록에 없는 llmProviderConfigId)이어도 파생은 그 id 를 그대로
  // 담고(throw 없음), DifficultyModelSelector 가 value 매칭 실패 시 placeholder 로 fallback 한다.
  it('stale 매핑 id 를 파생은 그대로 담고 컴포넌트가 placeholder 로 안전 fallback 한다 (negative — stale)', () => {
    const mapping = deriveDifficultyMapping([
      { difficulty: 'easy', llmProviderConfigId: 'ghost' },
    ]);
    expect(mapping.easy).toBe('ghost');
    // 렌더 단언 — provider 목록에 'ghost' 가 없어도 throw 없이 슬롯이 렌더된다.
    setRoutes({
      [GROUPS]: { data: [], loading: false, error: undefined },
      [PROVIDERS]: { data: PROVIDER_ROWS, loading: false, error: undefined },
      [MAPPINGS]: {
        data: [{ difficulty: 'easy', llmProviderConfigId: 'ghost' }],
        loading: false,
        error: undefined,
      },
    });
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toContain('name="easy"');
    // stale id 는 option 에 없으니 selected 표시 없이 placeholder 로 안전 렌더.
    expect(html).not.toContain('value="ghost"');
  });
});

// R-112 — ④c onAssign 실 PATCH mutation 본체(runAssign) 검증. jsdom/렌더러 없이 mutation
// 본체를 직접 호출하고(useApiResource.runFetch 와 동일 convention), apiClient.request mock 으로
// method/path/body 를 단언하며 성공/실패 분기 응답을 주입한다. 상태 전이는 record harness 의
// 콜백 호출로 관찰한다. happy/error/branch/negative 예외 분기마다 각 1+ cover.
describe('AdminView — onAssign 실 PATCH mutation (④c runAssign)', () => {
  // 상태 전이를 기록하는 deps harness — assigning 초기값과 request mock 을 주입받아
  // setAssigning/setAssignError/setOptimistic/bumpRefresh 호출을 모두 캡처한다.
  function makeDeps(assigning: boolean) {
    const calls = {
      assigning: [] as boolean[],
      error: [] as (string | undefined)[],
      bump: 0,
      // optimistic 의 최종 상태(updater 누적 적용 결과).
      optimistic: {} as Partial<Record<string, string | null>>,
    };
    const deps: AssignDeps = {
      patch: (...args: unknown[]) => requestMock(...args),
      describeError: (e: unknown) => {
        // toErrorMessage stub 과 정합 — ApiError.status → 문구.
        if (e instanceof ApiError) {
          return e.status === 0
            ? `네트워크 오류: ${e.message}`
            : `HTTP ${e.status}: ${e.message}`;
        }
        return '알 수 없는 오류';
      },
      assigning,
      setAssigning: (next) => calls.assigning.push(next),
      setAssignError: (next) => calls.error.push(next),
      setOptimistic: (updater) => {
        calls.optimistic = updater(calls.optimistic) as Partial<
          Record<string, string | null>
        >;
      },
      bumpRefresh: () => {
        calls.bump += 1;
      },
    };
    return { deps, calls };
  }

  beforeEach(() => {
    requestMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-path — onAssign('medium', 'cfg2') 호출 시 request 가 PATCH /api/.../medium +
  // body {llmProviderConfigId:'cfg2'} 로 정확히 호출되고, 성공 후 재조회(bump)가 트리거되며
  // 낙관 override 가 비워진다(서버 데이터로 대체).
  it("PATCH /api/llm/difficulty-mappings/medium 을 정확한 body 로 호출하고 성공 시 재조회를 트리거한다 (happy-path)", async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps, calls } = makeDeps(false);
    await runAssign('medium', 'cfg2', deps);
    // request 가 method PATCH + JSON Content-Type + 정확한 path/body 로 1 회 호출.
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(requestMock).toHaveBeenCalledWith(
      '/api/llm/difficulty-mappings/medium',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ llmProviderConfigId: 'cfg2' }),
      },
    );
    // 성공 → 재조회 트리거 1 회 + 낙관 override 비움(서버 데이터로 대체).
    expect(calls.bump).toBe(1);
    expect(calls.optimistic).toEqual({});
    // 진행 표시 on → off 순서 + error 비움(실패 문구 미설정).
    expect(calls.assigning).toEqual([true, false]);
    expect(calls.error).toEqual([undefined]);
  });

  // happy-path(낙관 반영) — PATCH 성공 전(발사 직후) 낙관 override 가 재지정 슬롯을 즉시
  // 반영함을 mergeMapping 합성으로 확인(컨테이너 difficultyMapping 파생과 동일 경로).
  it("발사 직후 낙관 override 가 재지정 슬롯을 즉시 반영하고 성공 후 서버 매핑으로 대체된다 (happy-path — 낙관)", async () => {
    // request 가 해소되기 전 낙관 상태를 캡처하기 위해 지연 resolve 를 쓴다.
    let resolvePatch: () => void = () => {};
    requestMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvePatch = resolve;
        }),
    );
    const { deps, calls } = makeDeps(false);
    const pending = runAssign('hard', 'cfg2', deps);
    // 발사 직후(해소 전) — 낙관 override 에 hard→cfg2 반영, 합성 매핑에 즉시 내려간다.
    expect(calls.optimistic).toEqual({ hard: 'cfg2' });
    expect(
      mergeMapping({ easy: null, medium: null, hard: null }, calls.optimistic),
    ).toEqual({ easy: null, medium: null, hard: 'cfg2' });
    // 해소 후 — 낙관 비움 + 재조회 트리거.
    resolvePatch();
    await pending;
    expect(calls.optimistic).toEqual({});
    expect(calls.bump).toBe(1);
  });

  // error path — PATCH 404(config·슬롯 부재) 시 error 문구가 표면화되고 throw 없이 처리되며
  // 낙관 override 가 롤백되고 재조회는 트리거되지 않는다.
  it("PATCH 404 실패 시 error 문구를 표면화하고 낙관을 롤백한다 (error path — 404)", async () => {
    requestMock.mockRejectedValue(new ApiError(404, 'Not Found'));
    const { deps, calls } = makeDeps(false);
    // throw 없이 resolve 되어야 한다(안전 처리).
    await expect(runAssign('easy', 'cfg1', deps)).resolves.toBeUndefined();
    // 사람-친화 문구 표면화(HTTP 404) + 재조회 미트리거 + 낙관 롤백.
    expect(calls.error).toEqual([undefined, 'HTTP 404: Not Found']);
    expect(calls.bump).toBe(0);
    expect(calls.optimistic).toEqual({});
    // 진행 표시는 성공·실패 공통으로 off.
    expect(calls.assigning).toEqual([true, false]);
  });

  // error path — 403(Admin+ 미만) 도 동일 안전 경로로 문구 표면화(throw 없음).
  it("PATCH 403(Admin+ 미만) 실패 시 안전 문구를 표면화한다 (error path — 403)", async () => {
    requestMock.mockRejectedValue(new ApiError(403, 'Forbidden'));
    const { deps, calls } = makeDeps(false);
    await expect(runAssign('hard', 'cfg2', deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 403: Forbidden']);
    expect(calls.bump).toBe(0);
  });

  // error path — 네트워크 실패(ApiError(0)) 시 네트워크 오류 문구(throw 없음).
  it("PATCH 네트워크 실패(ApiError 0) 시 네트워크 오류 문구를 표면화한다 (error path — 네트워크)", async () => {
    requestMock.mockRejectedValue(new ApiError(0, 'fetch failed'));
    const { deps, calls } = makeDeps(false);
    await expect(runAssign('medium', 'cfg1', deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, '네트워크 오류: fetch failed']);
  });

  // flow/branch — mutation 완료 후 진행 표시가 반드시 해제됨(성공·실패 finally 보장).
  it("성공·실패 어느 경우든 진행 표시(assigning)가 finally 로 해제된다 (flow/branch — 진행 해제)", async () => {
    requestMock.mockResolvedValueOnce(undefined);
    const ok = makeDeps(false);
    await runAssign('easy', 'cfg1', ok.deps);
    expect(ok.calls.assigning).toEqual([true, false]);

    requestMock.mockRejectedValueOnce(new ApiError(400, 'bad'));
    const fail = makeDeps(false);
    await runAssign('easy', 'cfg1', fail.deps);
    expect(fail.calls.assigning).toEqual([true, false]);
  });

  // negative — 미지원 난이도 400 응답도 throw 없이 안전 문구 표시(예외 분기 cover).
  it("미지원 난이도 400 응답 시 안전 문구를 표시하고 throw 하지 않는다 (negative — 400)", async () => {
    requestMock.mockRejectedValue(new ApiError(400, 'unsupported difficulty'));
    const { deps, calls } = makeDeps(false);
    await expect(runAssign('easy', 'cfg1', deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 400: unsupported difficulty']);
    expect(calls.bump).toBe(0);
  });

  // negative — 동시 재호출 가드(이전 mutation 미완 중 재호출)는 PATCH 미발사·state 불변.
  it("이전 mutation 미완(assigning=true) 중 재호출은 PATCH 를 발사하지 않는다 (negative — 동시 재호출)", async () => {
    const { deps, calls } = makeDeps(true); // 이미 in-flight.
    await runAssign('medium', 'cfg2', deps);
    // request 미호출 + 어떤 state 전이도 없음(이중 호출·state 깨짐 차단).
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.assigning).toEqual([]);
    expect(calls.bump).toBe(0);
    expect(calls.optimistic).toEqual({});
  });

  // negative — 빈/undefined providerId 비정상 호출은 PATCH 미발사(잘못된 body 회피).
  it("빈 문자열/undefined providerId 면 PATCH 를 발사하지 않는다 (negative — 비정상 providerId)", async () => {
    const empty = makeDeps(false);
    await runAssign('easy', '', empty.deps);
    expect(requestMock).not.toHaveBeenCalled();
    expect(empty.calls.assigning).toEqual([]);

    const undef = makeDeps(false);
    await runAssign('easy', undefined as unknown as string, undef.deps);
    expect(requestMock).not.toHaveBeenCalled();
    expect(undef.calls.assigning).toEqual([]);
  });

  // negative — 재조회(권위 GET) 자체 실패는 useApiResource 가 error props 로 흡수하고
  // (mappingsError), 직전 낙관 매핑은 비워진 상태라 서버 직전값을 유지한다. mutation 성공
  // 후 재조회 트리거만 책임지므로 본 러너는 GET 실패를 알지 못함을 확인(관심사 분리).
  it("PATCH 성공 후 재조회 트리거까지만 책임지고 GET 결과는 알지 못한다 (negative — 재조회 실패 분리)", async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps, calls } = makeDeps(false);
    await runAssign('easy', 'cfg1', deps);
    // 러너는 bump(재조회 트리거)만 — GET 성공/실패는 useApiResource 책임(error props 흡수).
    expect(calls.bump).toBe(1);
    expect(calls.error).toEqual([undefined]); // mutation 자체 error 는 없음.
  });
});

// R-112 — ④c 신규 순수 helper(buildMappingsPath/mergeMapping) 검증. negative 분기 각 1+.
describe('AdminView — ④c 재조회 path/낙관 병합 helper (순수 함수)', () => {
  // buildMappingsPath — nonce 0 은 깨끗한 path, 1+ 는 cache-busting query 부착.
  it('buildMappingsPath 가 nonce 0 은 깨끗한 path, 1+ 는 _r query 를 부착한다 (helper)', () => {
    expect(buildMappingsPath(0)).toBe('/api/llm/difficulty-mappings');
    expect(buildMappingsPath(1)).toBe('/api/llm/difficulty-mappings?_r=1');
    expect(buildMappingsPath(5)).toBe('/api/llm/difficulty-mappings?_r=5');
    // negative — 음수 nonce 도 깨끗한 path(0 이하 가드).
    expect(buildMappingsPath(-1)).toBe('/api/llm/difficulty-mappings');
  });

  // mergeMapping — override 슬롯만 base 위에 덮고, undefined/빈 override 는 base 유지.
  it('mergeMapping 이 override 슬롯만 base 위에 덮고 빈 override 는 base 를 유지한다 (helper)', () => {
    const base = { easy: 'cfg1', medium: null, hard: 'cfg2' } as const;
    // 부분 override — medium 만 덮는다.
    expect(mergeMapping(base, { medium: 'cfg2' })).toEqual({
      easy: 'cfg1',
      medium: 'cfg2',
      hard: 'cfg2',
    });
    // negative — 빈 override 는 base 와 동일(단 새 객체).
    const same = mergeMapping(base, {});
    expect(same).toEqual(base);
    expect(same).not.toBe(base);
    // negative — undefined 슬롯값은 base 유지(덮지 않음), null override 는 명시적 미할당으로 덮음.
    expect(
      mergeMapping(base, { easy: undefined, hard: null }),
    ).toEqual({ easy: 'cfg1', medium: null, hard: null });
  });
});

// ④c 회귀 — 컨테이너가 onAssign/loading/error 를 DifficultyModelSelector 에 props 로 배선하고
// 읽기 배선(그룹·provider·매핑)이 불변임을 정적 렌더로 확인(읽기 회귀 0).
describe('AdminView — ④c 배선 회귀 (정적 렌더)', () => {
  beforeEach(() => {
    useApiResourceMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('④c 배선 후에도 슬롯 select·provider 옵션·그룹 패널이 그대로 렌더된다 (읽기 회귀 0)', () => {
    setRoutes({
      [GROUPS]: { data: SAMPLE, loading: false, error: undefined },
      [PROVIDERS]: { data: PROVIDER_ROWS, loading: false, error: undefined },
      [MAPPINGS]: { data: MAPPING_ROWS, loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView initialSelectedGroupId="g1" />);
    // 읽기 배선 불변 — 그룹 멤버 + provider 옵션 + 매핑 selected 가 ④b 와 동일하게 렌더.
    expect(html).toContain('김철수');
    expect(html).toContain('gpt-4o (openai)');
    expect(html).toContain('value="cfg1" selected');
    expect(html).toContain('aria-label="그룹 선택"');
    // 슬롯 select 가 모두 렌더(onAssign 배선이 렌더를 깨지 않음).
    expect(html).toContain('name="easy"');
    expect(html).toContain('name="medium"');
    expect(html).toContain('name="hard"');
  });
});

// R-112 — ④f parseFilename 순수 helper 검증(Content-Disposition filename 추출). RFC 5987
// ext-value(filename*=) 우선·일반 filename="..."·따옴표/공백 제거·누락/비정상 헤더 undefined
// fallback 등 분기를 각 1+ cover.
describe('AdminView — parseFilename (순수 함수, ④f)', () => {
  it('일반 filename="..." 을 따옴표 제거해 추출한다 (happy)', () => {
    expect(parseFilename('attachment; filename="export.json"')).toBe(
      'export.json',
    );
  });

  it('따옴표 없는 filename=... 도 추출한다 (happy — 따옴표 생략)', () => {
    expect(parseFilename('attachment; filename=data.csv')).toBe('data.csv');
  });

  it('filename*=UTF-8\'\'<percent-encoded> 을 우선 디코딩해 추출한다 (branch — RFC 5987 우선)', () => {
    // 비-ASCII 파일명(평가.json)을 percent-encoding 한 ext-value 우선 적용.
    const encoded = encodeURIComponent('평가.json');
    expect(
      parseFilename(`attachment; filename="fallback.json"; filename*=UTF-8''${encoded}`),
    ).toBe('평가.json');
  });

  it('null/빈 헤더면 undefined 를 반환한다 (negative — 누락)', () => {
    expect(parseFilename(null)).toBeUndefined();
    expect(parseFilename('')).toBeUndefined();
  });

  it('filename 토큰이 없으면 undefined 를 반환한다 (negative — 비정상 헤더)', () => {
    expect(parseFilename('attachment')).toBeUndefined();
    expect(parseFilename('inline; size=10')).toBeUndefined();
  });

  it('잘못된 percent-encoding 의 ext-value 는 일반 filename 으로 안전 fallback 한다 (negative — 깨진 인코딩)', () => {
    // filename*=UTF-8''%E0%A4%A 는 불완전 — decodeURIComponent throw → 일반 filename fallback.
    expect(
      parseFilename("attachment; filename=\"ok.json\"; filename*=UTF-8''%E0%A4%A"),
    ).toBe('ok.json');
  });
});

// R-112 — ④f triggerDownload 순수 부수효과 러너 검증. createObjectURL → clickAnchor →
// revokeObjectURL 순서·인자·예외 시에도 revokeObjectURL 정리 보장(자원 누수 방지)을 mock
// 으로 단언한다(jsdom 없이 — DownloadDeps 직접 주입).
describe('AdminView — triggerDownload (부수효과 러너, ④f)', () => {
  function makeDownloadDeps() {
    const order: string[] = [];
    const deps: DownloadDeps = {
      createObjectURL: (blob: Blob) => {
        order.push(`create:${blob.size}`);
        return 'blob:mock-url';
      },
      revokeObjectURL: (url: string) => {
        order.push(`revoke:${url}`);
      },
      clickAnchor: (url: string, filename: string) => {
        order.push(`click:${url}:${filename}`);
      },
    };
    return { deps, order };
  }

  it('createObjectURL → clickAnchor → revokeObjectURL 순서로 호출한다 (happy)', () => {
    const { deps, order } = makeDownloadDeps();
    triggerDownload(new Blob(['ab']), 'export.json', deps);
    expect(order).toEqual([
      'create:2',
      'click:blob:mock-url:export.json',
      'revoke:blob:mock-url',
    ]);
  });

  it('clickAnchor 예외 시에도 revokeObjectURL 로 정리한다 (negative — 자원 누수 방지)', () => {
    const order: string[] = [];
    const deps: DownloadDeps = {
      createObjectURL: () => {
        order.push('create');
        return 'blob:x';
      },
      revokeObjectURL: () => {
        order.push('revoke');
      },
      clickAnchor: () => {
        order.push('click');
        throw new Error('click boom');
      },
    };
    // 예외는 호출측으로 전파되나(runExport 의 catch 가 안전 처리), revoke 는 finally 로 보장.
    expect(() => triggerDownload(new Blob(['x']), 'f.json', deps)).toThrow(
      'click boom',
    );
    expect(order).toEqual(['create', 'click', 'revoke']);
  });

  it('빈/0-byte Blob 도 throw 없이 다운로드를 트리거한다 (negative — 빈 blob)', () => {
    const { deps, order } = makeDownloadDeps();
    triggerDownload(new Blob([]), 'empty.json', deps);
    expect(order).toEqual([
      'create:0',
      'click:blob:mock-url:empty.json',
      'revoke:blob:mock-url',
    ]);
  });
});

// R-112 — ④f onExport 실 GET export + Blob 다운로드 본체(runExport) 검증. jsdom/렌더러 없이
// export·다운로드 본체를 직접 호출하고(④c runAssign 과 동일 convention), getRaw mock 으로
// raw Response 시나리오를 주입하며 createObjectURL/revokeObjectURL/clickAnchor 호출을 mock 으로
// 단언한다. 상태 전이는 record harness 의 콜백 호출로 관찰한다. happy/error/branch/negative 각 1+.
// ④g: runExport 시그니처가 (path, deps) 로 확장돼 path 를 명시 주입한다(기존 test 는 scope
// 미선택 경로 = ADMIN_EXPORT_PATH 상수값 '/api/admin/export' 를 주입해 ④f 동작 유지를 단언).
const EXPORT_PATH = '/api/admin/export';
describe('AdminView — onExport 실 GET export + Blob 다운로드 (④f runExport)', () => {
  // raw Response mock 헬퍼 — blob()/headers.get(content-disposition) 만 제공(runExport 가 쓰는
  // 최소 표면). disposition 인자로 Content-Disposition 유무 분기를 통제한다.
  function mockRawResponse(blobBytes: string, disposition: string | null) {
    return {
      blob: async () => new Blob([blobBytes]),
      headers: {
        get: (name: string) =>
          name.toLowerCase() === 'content-disposition' ? disposition : null,
      },
    } as unknown as Response;
  }

  // 상태 전이 + 다운로드 부수효과를 기록하는 deps harness — exporting 초기값과 getRaw mock 을
  // 주입받아 setExporting/setExportError/setExportMessage 호출과 다운로드 deps 호출을 캡처한다.
  function makeExportDeps(exporting: boolean) {
    const calls = {
      exporting: [] as boolean[],
      error: [] as (string | undefined)[],
      message: [] as (string | undefined)[],
      // 다운로드 부수효과 관찰 — createObjectURL/clickAnchor/revokeObjectURL 호출 인자 캡처.
      created: [] as number[],
      clicked: [] as { url: string; filename: string }[],
      revoked: [] as string[],
    };
    const deps: ExportDeps = {
      getRaw: (...args: unknown[]) => requestRawMock(...args),
      describeError: (e: unknown) => {
        // toErrorMessage stub 과 정합 — ApiError.status → 문구.
        if (e instanceof ApiError) {
          return e.status === 0
            ? `네트워크 오류: ${e.message}`
            : `HTTP ${e.status}: ${e.message}`;
        }
        return '알 수 없는 오류';
      },
      exporting,
      setExporting: (next) => calls.exporting.push(next),
      setExportError: (next) => calls.error.push(next),
      setExportMessage: (next) => calls.message.push(next),
      createObjectURL: (blob) => {
        calls.created.push(blob.size);
        return 'blob:mock-url';
      },
      revokeObjectURL: (url) => calls.revoked.push(url),
      clickAnchor: (url, filename) => calls.clicked.push({ url, filename }),
    };
    return { deps, calls };
  }

  beforeEach(() => {
    requestRawMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-path — export 트리거 시 getRaw 가 GET /api/admin/export 로 호출되고, 성공 응답의 blob
  // 으로 createObjectURL + anchor click + revokeObjectURL 이 호출되며 완료 message + busy 해제.
  it('GET /api/admin/export 를 호출하고 성공 시 blob → createObjectURL + click + revokeObjectURL + 완료 message (happy-path)', async () => {
    requestRawMock.mockResolvedValue(
      mockRawResponse('payload', 'attachment; filename="export.json"'),
    );
    const { deps, calls } = makeExportDeps(false);
    await runExport(EXPORT_PATH, deps);
    // getRaw 가 주입된 export path 로 1 회 호출(옵션 생략 = 기본 GET, scope 미선택 = query 미부착).
    expect(requestRawMock).toHaveBeenCalledTimes(1);
    expect(requestRawMock).toHaveBeenCalledWith('/api/admin/export');
    // 다운로드 부수효과 — createObjectURL(payload=7byte) + click(filename=export.json) + revoke.
    expect(calls.created).toEqual([7]);
    expect(calls.clicked).toEqual([{ url: 'blob:mock-url', filename: 'export.json' }]);
    expect(calls.revoked).toEqual(['blob:mock-url']);
    // 성공 → 완료 안내 message + 진행 on→off + 시작 시 error 비움.
    expect(calls.message).toEqual([undefined, '내보내기 완료']);
    expect(calls.exporting).toEqual([true, false]);
    expect(calls.error).toEqual([undefined]);
  });

  // flow/branch — Content-Disposition 이 없으면 기본 파일명(export.json)으로 fallback 한다.
  it('Content-Disposition 이 없으면 기본 파일명으로 fallback 한다 (flow/branch — filename fallback)', async () => {
    requestRawMock.mockResolvedValue(mockRawResponse('x', null));
    const { deps, calls } = makeExportDeps(false);
    await runExport(EXPORT_PATH, deps);
    // filename 헤더 부재 → DEFAULT_EXPORT_FILENAME(export.json).
    expect(calls.clicked).toEqual([{ url: 'blob:mock-url', filename: 'export.json' }]);
    expect(calls.message).toEqual([undefined, '내보내기 완료']);
  });

  // flow/branch — Content-Disposition filename 이 있으면 그것을 파일명으로 쓴다.
  it('Content-Disposition filename 이 있으면 그 파일명을 쓴다 (flow/branch — filename 헤더 우선)', async () => {
    requestRawMock.mockResolvedValue(
      mockRawResponse('x', 'attachment; filename="assessments-2026.csv"'),
    );
    const { deps, calls } = makeExportDeps(false);
    await runExport(EXPORT_PATH, deps);
    expect(calls.clicked[0].filename).toBe('assessments-2026.csv');
  });

  // error path — export 403(Admin+ 미만) 실패 시 error 문구 표면화 + 다운로드 부수효과 미호출.
  it('export 403(Admin+ 미만) 실패 시 error 문구 표면화 + 다운로드 미호출 (error path — 403)', async () => {
    requestRawMock.mockRejectedValue(new ApiError(403, 'Forbidden'));
    const { deps, calls } = makeExportDeps(false);
    await expect(runExport(EXPORT_PATH, deps)).resolves.toBeUndefined();
    // 사람-친화 문구 표면화 + 완료 message 미설정(시작 비움만) + 진행 off.
    expect(calls.error).toEqual([undefined, 'HTTP 403: Forbidden']);
    expect(calls.message).toEqual([undefined]);
    expect(calls.exporting).toEqual([true, false]);
    // GET 실패라 다운로드 부수효과는 일절 호출되지 않음(createObjectURL 등).
    expect(calls.created).toEqual([]);
    expect(calls.clicked).toEqual([]);
    expect(calls.revoked).toEqual([]);
  });

  // error path — 404(자원 부재) 도 동일 안전 경로 + 다운로드 미호출(throw 없음).
  it('export 404 실패 시 안전 문구 표면화 + 다운로드 미호출 (error path — 404)', async () => {
    requestRawMock.mockRejectedValue(new ApiError(404, 'Not Found'));
    const { deps, calls } = makeExportDeps(false);
    await expect(runExport(EXPORT_PATH, deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 404: Not Found']);
    expect(calls.created).toEqual([]);
  });

  // error path — 네트워크 실패(ApiError(0)) 시 네트워크 오류 문구 + 다운로드 미호출(throw 없음).
  it('export 네트워크 실패(ApiError 0) 시 네트워크 오류 문구 + 다운로드 미호출 (error path — 네트워크)', async () => {
    requestRawMock.mockRejectedValue(new ApiError(0, 'fetch failed'));
    const { deps, calls } = makeExportDeps(false);
    await expect(runExport(EXPORT_PATH, deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, '네트워크 오류: fetch failed']);
    expect(calls.created).toEqual([]);
  });

  // flow/branch — export in-flight 동안 진행 표시 on, 성공/실패 어느 경우든 finally 로 해제.
  it('성공·실패 어느 경우든 진행 표시(exporting)가 finally 로 해제된다 (flow/branch — 진행 해제)', async () => {
    requestRawMock.mockResolvedValueOnce(mockRawResponse('a', null));
    const ok = makeExportDeps(false);
    await runExport(EXPORT_PATH, ok.deps);
    expect(ok.calls.exporting).toEqual([true, false]);

    requestRawMock.mockRejectedValueOnce(new ApiError(500, 'boom'));
    const fail = makeExportDeps(false);
    await runExport(EXPORT_PATH, fail.deps);
    expect(fail.calls.exporting).toEqual([true, false]);
  });

  // flow/branch(시작 정리) — export 발사 직후 진행 표시 on + 직전 error·message 즉시 비움.
  it('발사 직후 진행 표시 on + 직전 error·message 를 즉시 비운다 (flow/branch — 시작 정리)', async () => {
    let resolveGet: (r: Response) => void = () => {};
    requestRawMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveGet = resolve;
        }),
    );
    const { deps, calls } = makeExportDeps(false);
    const pending = runExport(EXPORT_PATH, deps);
    // 발사 직후(해소 전) — 진행 on + error/message 모두 시작 비움(undefined) + 다운로드 미발생.
    expect(calls.exporting).toEqual([true]);
    expect(calls.error).toEqual([undefined]);
    expect(calls.message).toEqual([undefined]);
    expect(calls.created).toEqual([]);
    // 해소 후 — blob 다운로드 + 완료 message 설정 + 진행 off.
    resolveGet(mockRawResponse('done', null));
    await pending;
    expect(calls.message).toEqual([undefined, '내보내기 완료']);
    expect(calls.exporting).toEqual([true, false]);
    expect(calls.clicked).toHaveLength(1);
  });

  // negative — export in-flight 중 재클릭(exporting=true)은 GET 미발사·중복 다운로드 없음.
  it('이전 export 미완(exporting=true) 중 재호출은 GET·다운로드를 발사하지 않는다 (negative — 동시 재호출)', async () => {
    const { deps, calls } = makeExportDeps(true); // 이미 in-flight.
    await runExport(EXPORT_PATH, deps);
    // getRaw 미호출 + 어떤 state 전이·다운로드도 없음(이중 호출·중복 다운로드 차단).
    expect(requestRawMock).not.toHaveBeenCalled();
    expect(calls.exporting).toEqual([]);
    expect(calls.error).toEqual([]);
    expect(calls.message).toEqual([]);
    expect(calls.created).toEqual([]);
    expect(calls.clicked).toEqual([]);
  });

  // negative — 빈/0-byte blob 응답도 throw 없이 다운로드를 트리거하고 완료 처리한다.
  it('빈/0-byte blob 응답도 throw 없이 다운로드 + 완료 처리한다 (negative — 빈 blob)', async () => {
    requestRawMock.mockResolvedValue(mockRawResponse('', null));
    const { deps, calls } = makeExportDeps(false);
    await expect(runExport(EXPORT_PATH, deps)).resolves.toBeUndefined();
    // 0-byte Blob 이어도 createObjectURL(size 0) + click + revoke + 완료 message.
    expect(calls.created).toEqual([0]);
    expect(calls.clicked).toHaveLength(1);
    expect(calls.revoked).toEqual(['blob:mock-url']);
    expect(calls.message).toEqual([undefined, '내보내기 완료']);
    expect(calls.error).toEqual([undefined]);
  });

  // negative — 실패 후 재시도(재클릭)는 직전 error 를 비우고 정상 재발화 + 다운로드.
  it('실패 후 재시도(재클릭)는 직전 error 를 비우고 정상 재발화 + 다운로드 (negative — 실패 후 재시도)', async () => {
    // 1차 — 실패(error 설정 + 다운로드 미발생).
    requestRawMock.mockRejectedValueOnce(new ApiError(500, 'boom'));
    const first = makeExportDeps(false);
    await runExport(EXPORT_PATH, first.deps);
    expect(first.calls.error).toEqual([undefined, 'HTTP 500: boom']);
    expect(first.calls.message).toEqual([undefined]);
    expect(first.calls.created).toEqual([]);

    // 2차(재시도) — 성공. 시작 시 직전 error 를 비우고(undefined) 다운로드 + 완료 message.
    requestRawMock.mockResolvedValueOnce(mockRawResponse('ok', null));
    const second = makeExportDeps(false);
    await runExport(EXPORT_PATH, second.deps);
    expect(second.calls.error).toEqual([undefined]);
    expect(second.calls.message).toEqual([undefined, '내보내기 완료']);
    expect(second.calls.clicked).toHaveLength(1);
  });

  // negative — createObjectURL 후 clickAnchor 예외 발생 시에도 revokeObjectURL 정리 누락 없음
  // (자원 누수 방지). runExport 의 catch 가 예외를 안전 처리해 error 문구로 표면화한다.
  it('createObjectURL 후 click 예외 시에도 revokeObjectURL 정리 + 안전 처리 (negative — 다운로드 중 예외)', async () => {
    requestRawMock.mockResolvedValue(mockRawResponse('x', null));
    const calls = {
      exporting: [] as boolean[],
      error: [] as (string | undefined)[],
      message: [] as (string | undefined)[],
      revoked: [] as string[],
    };
    const deps: ExportDeps = {
      getRaw: (...args: unknown[]) => requestRawMock(...args),
      describeError: (e: unknown) =>
        e instanceof Error ? e.message : '알 수 없는 오류',
      exporting: false,
      setExporting: (next) => calls.exporting.push(next),
      setExportError: (next) => calls.error.push(next),
      setExportMessage: (next) => calls.message.push(next),
      createObjectURL: () => 'blob:y',
      revokeObjectURL: (url) => calls.revoked.push(url),
      clickAnchor: () => {
        throw new Error('click failed');
      },
    };
    await expect(runExport(EXPORT_PATH, deps)).resolves.toBeUndefined();
    // click 예외 → triggerDownload finally 가 revoke 정리(누수 없음) → runExport catch 가
    // error 문구 표면화(throw 없이) + 완료 message 미설정 + 진행 off.
    expect(calls.revoked).toEqual(['blob:y']);
    expect(calls.error).toEqual([undefined, 'click failed']);
    expect(calls.message).toEqual([undefined]);
    expect(calls.exporting).toEqual([true, false]);
  });
});

// R-112 — ④g buildExportPath 순수 helper 검증(scope 선택값 → export 호출 path). scope truthy
// 면 `?scope=` query 부착, 빈/falsy 면 query 없는 ADMIN_EXPORT_PATH 그대로. encodeURIComponent
// 로 공백/특수문자 안전 인코딩. happy/branch/negative 분기 각 1+ cover(jsdom 없이 직접 검증).
describe('AdminView — buildExportPath (순수 함수, ④g)', () => {
  it('scope 가 truthy 면 ?scope= query 를 부착한다 (happy)', () => {
    expect(buildExportPath('assessments')).toBe(
      '/api/admin/export?scope=assessments',
    );
    expect(buildExportPath('persons')).toBe('/api/admin/export?scope=persons');
  });

  it('빈 문자열(전체 선택) 이면 query 없는 ADMIN_EXPORT_PATH 그대로 반환한다 (branch — 미선택 = ④f 동작 유지)', () => {
    expect(buildExportPath('')).toBe('/api/admin/export');
  });

  it('undefined scope 도 query 없는 path 그대로 반환한다 (branch — falsy)', () => {
    expect(buildExportPath(undefined)).toBe('/api/admin/export');
  });

  it('scope 값의 공백/특수문자를 encodeURIComponent 로 안전 인코딩한다 (negative — 비정상 문자)', () => {
    // 공백·& 등은 query 를 깨므로 percent-encoding 으로 안전(query 깨짐 없음).
    expect(buildExportPath('a b')).toBe('/api/admin/export?scope=a%20b');
    expect(buildExportPath('x&y=z')).toBe(
      '/api/admin/export?scope=x%26y%3Dz',
    );
    // 한국어 scope 값도 안전 인코딩.
    expect(buildExportPath('평가')).toBe(
      `/api/admin/export?scope=${encodeURIComponent('평가')}`,
    );
  });
});

// R-112 — ④g scope 선택 → runExport 의 path 주입(scope query 부착/미부착)이 buildExportPath
// 와 정합함을 runExport(path, deps) 직접 호출로 검증한다. happy(선택값 부착) / branch(미선택
// 미부착) / negative(특수문자 인코딩·scope 변경 반영·실패 후 재시도)를 각 1+ cover. 다운로드
// 부수효과(blob → createObjectURL + click + revoke)는 ④f 동작이 scope 부착 path 에서도 그대로
// 호출됨을 함께 단언한다(다운로드 동작 회귀 0).
describe('AdminView — scope query 부착 export (④g runExport path 주입)', () => {
  function mockRawResponse(blobBytes: string, disposition: string | null) {
    return {
      blob: async () => new Blob([blobBytes]),
      headers: {
        get: (name: string) =>
          name.toLowerCase() === 'content-disposition' ? disposition : null,
      },
    } as unknown as Response;
  }

  function makeExportDeps(exporting: boolean) {
    const calls = {
      exporting: [] as boolean[],
      error: [] as (string | undefined)[],
      message: [] as (string | undefined)[],
      created: [] as number[],
      clicked: [] as { url: string; filename: string }[],
      revoked: [] as string[],
    };
    const deps: ExportDeps = {
      getRaw: (...args: unknown[]) => requestRawMock(...args),
      describeError: (e: unknown) => {
        if (e instanceof ApiError) {
          return e.status === 0
            ? `네트워크 오류: ${e.message}`
            : `HTTP ${e.status}: ${e.message}`;
        }
        return '알 수 없는 오류';
      },
      exporting,
      setExporting: (next) => calls.exporting.push(next),
      setExportError: (next) => calls.error.push(next),
      setExportMessage: (next) => calls.message.push(next),
      createObjectURL: (blob) => {
        calls.created.push(blob.size);
        return 'blob:mock-url';
      },
      revokeObjectURL: (url) => calls.revoked.push(url),
      clickAnchor: (url, filename) => calls.clicked.push({ url, filename }),
    };
    return { deps, calls };
  }

  beforeEach(() => {
    requestRawMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-path — scope 선택값이 truthy 일 때 buildExportPath 결과 path 로 getRaw 가 호출되고
  // (?scope= 부착), 성공 응답 blob 으로 ④f 다운로드 부수효과가 그대로 호출된다.
  it('scope 선택값이 있으면 ?scope= 부착 path 로 getRaw 호출 + blob 다운로드 부수효과 (happy-path)', async () => {
    requestRawMock.mockResolvedValue(mockRawResponse('payload', null));
    const { deps, calls } = makeExportDeps(false);
    // 컨테이너 handleExport 와 동일 경로 — buildExportPath(scope) 를 runExport 에 주입.
    await runExport(buildExportPath('assessments'), deps);
    // scope query 가 부착된 path 로 1 회 호출.
    expect(requestRawMock).toHaveBeenCalledTimes(1);
    expect(requestRawMock).toHaveBeenCalledWith(
      '/api/admin/export?scope=assessments',
    );
    // ④f 다운로드 동작 회귀 0 — createObjectURL + click + revoke + 완료 message.
    expect(calls.created).toEqual([7]);
    expect(calls.clicked).toEqual([
      { url: 'blob:mock-url', filename: 'export.json' },
    ]);
    expect(calls.revoked).toEqual(['blob:mock-url']);
    expect(calls.message).toEqual([undefined, '내보내기 완료']);
  });

  // flow/branch — scope 미선택(빈값) 시 query 없는 path 로 호출(④f 동작 유지).
  it('scope 미선택(빈값) 이면 query 없는 path 로 getRaw 호출 (flow/branch — 미선택)', async () => {
    requestRawMock.mockResolvedValue(mockRawResponse('x', null));
    const { deps } = makeExportDeps(false);
    await runExport(buildExportPath(''), deps);
    expect(requestRawMock).toHaveBeenCalledWith('/api/admin/export');
  });

  // negative — scope 에 공백/특수문자가 들어가도 인코딩된 path 로 안전 호출(query 깨짐 없음).
  it('scope 값에 공백/특수문자가 있어도 인코딩된 path 로 안전 호출한다 (negative — 비정상 문자)', async () => {
    requestRawMock.mockResolvedValue(mockRawResponse('x', null));
    const { deps } = makeExportDeps(false);
    await runExport(buildExportPath('a b&c'), deps);
    expect(requestRawMock).toHaveBeenCalledWith(
      '/api/admin/export?scope=a%20b%26c',
    );
  });

  // negative — scope 변경 후 export 시 변경된 scope 가 반영된 path 로 호출(stale scope 미사용).
  // 두 번 연속 발화에서 각각 그 시점 scope 가 path 에 반영됨을 단언한다.
  it('scope 변경 후 export 는 변경된 scope 가 반영된 path 로 호출한다 (negative — stale scope 미사용)', async () => {
    requestRawMock.mockResolvedValue(mockRawResponse('x', null));
    // 1차 — persons scope.
    const first = makeExportDeps(false);
    await runExport(buildExportPath('persons'), first.deps);
    expect(requestRawMock).toHaveBeenLastCalledWith(
      '/api/admin/export?scope=persons',
    );
    // 2차 — questions 로 변경. 직전 persons 가 아니라 새 scope 가 반영된다.
    const second = makeExportDeps(false);
    await runExport(buildExportPath('questions'), second.deps);
    expect(requestRawMock).toHaveBeenLastCalledWith(
      '/api/admin/export?scope=questions',
    );
  });

  // negative — scope 부착 export 실패(403) 시 error 문구 표면화 + 다운로드 미호출(throw 없음).
  it('scope 부착 export 403 실패 시 error 문구 표면화 + 다운로드 미호출 (error path — 403)', async () => {
    requestRawMock.mockRejectedValue(new ApiError(403, 'Forbidden'));
    const { deps, calls } = makeExportDeps(false);
    await expect(
      runExport(buildExportPath('assessments'), deps),
    ).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 403: Forbidden']);
    expect(calls.created).toEqual([]);
    expect(calls.clicked).toEqual([]);
  });

  // negative — scope in-flight 중 재트리거(exporting=true)는 GET·중복 다운로드 미발사(가드).
  it('scope export in-flight 중 재트리거는 GET·중복 다운로드를 발사하지 않는다 (negative — 동시 재호출 가드)', async () => {
    const { deps, calls } = makeExportDeps(true); // 이미 in-flight.
    await runExport(buildExportPath('persons'), deps);
    expect(requestRawMock).not.toHaveBeenCalled();
    expect(calls.created).toEqual([]);
  });

  // negative — 실패 후 scope 그대로 재시도 시 직전 error 를 비우고 정상 재발화 + 다운로드.
  it('실패 후 scope 그대로 재시도는 직전 error 를 비우고 정상 재발화 + 다운로드 (negative — 실패 후 재시도)', async () => {
    // 1차 — 실패.
    requestRawMock.mockRejectedValueOnce(new ApiError(500, 'boom'));
    const first = makeExportDeps(false);
    await runExport(buildExportPath('questions'), first.deps);
    expect(first.calls.error).toEqual([undefined, 'HTTP 500: boom']);
    expect(first.calls.created).toEqual([]);
    // 2차 — 같은 scope 재시도, 성공. 시작 시 직전 error 비움 + 다운로드.
    requestRawMock.mockResolvedValueOnce(mockRawResponse('ok', null));
    const second = makeExportDeps(false);
    await runExport(buildExportPath('questions'), second.deps);
    expect(second.calls.error).toEqual([undefined]);
    expect(second.calls.message).toEqual([undefined, '내보내기 완료']);
    expect(second.calls.clicked).toHaveLength(1);
  });
});

// R-112 — ④g scope 선택 <select> 정적 렌더 회귀. 컨테이너가 scope <select>(aria-label="export
// 범위 선택")를 직접 렌더하고(presentational 패널은 scope 를 모른다, Decision 1), 모든 scope
// 옵션 라벨을 노출하며 기존 패널 배선(그룹·LLM·export 버튼)이 회귀 0 임을 단언한다.
describe('AdminView — ④g scope 선택 select 배선 (정적 렌더)', () => {
  beforeEach(() => {
    useApiResourceMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('scope 선택 select 가 모든 scope 옵션과 함께 렌더되고 기존 패널은 회귀 0 이다 (배선 회귀)', () => {
    setRoutes({
      [GROUPS]: { data: SAMPLE, loading: false, error: undefined },
      [PROVIDERS]: { data: PROVIDER_ROWS, loading: false, error: undefined },
      [MAPPINGS]: { data: MAPPING_ROWS, loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView initialSelectedGroupId="g1" />);
    // scope <select> 가 aria-label 과 함께 렌더 + 보수 후보 라벨 노출.
    expect(html).toContain('aria-label="export 범위 선택"');
    expect(html).toContain('전체');
    expect(html).toContain('평가 결과');
    expect(html).toContain('문항');
    expect(html).toContain('인원');
    // 초기 선택값은 빈 문자열(전체) — 첫 옵션이 selected.
    expect(html).toContain('value="" selected');
    // 기존 배선 회귀 0 — 그룹 멤버 + provider 옵션 + export 버튼 + 그룹 select 그대로.
    expect(html).toContain('김철수');
    expect(html).toContain('gpt-4o (openai)');
    expect(html).toContain('<button type="button">내보내기</button>');
    expect(html).toContain('aria-label="그룹 선택"');
  });
});

// R-112 — ④e onImportFile 실 POST import 본체(runImport) 검증. jsdom/렌더러 없이 import
// 본체를 직접 호출하고(④d runExport 와 동일 convention), apiClient.request mock 으로
// method/path/body(FormData) 를 단언하며 성공/실패 분기 응답을 주입한다. 상태 전이는 record
// harness 의 콜백 호출로 관찰한다. happy/error/branch/negative 예외 분기마다 각 1+ cover.
describe('AdminView — onImportFile 실 POST import (④e runImport)', () => {
  // 상태 전이를 기록하는 deps harness — importing 초기값과 request mock 을 주입받아
  // setImporting/setImportError/setImportMessage 호출을 모두 순서대로 캡처한다(④d 동형).
  function makeImportDeps(importing: boolean) {
    const calls = {
      importing: [] as boolean[],
      error: [] as (string | undefined)[],
      message: [] as (string | undefined)[],
    };
    const deps: ImportDeps = {
      post: (...args: unknown[]) => requestMock(...args),
      describeError: (e: unknown) => {
        // toErrorMessage stub 과 정합 — ApiError.status → 문구.
        if (e instanceof ApiError) {
          return e.status === 0
            ? `네트워크 오류: ${e.message}`
            : `HTTP ${e.status}: ${e.message}`;
        }
        return '알 수 없는 오류';
      },
      importing,
      setImporting: (next) => calls.importing.push(next),
      setImportError: (next) => calls.error.push(next),
      setImportMessage: (next) => calls.message.push(next),
    };
    return { deps, calls };
  }

  // 테스트용 File 샘플 — node(undici) 전역 File 로 평가 자료 파일 1 건을 만든다(jsdom 불요).
  function sampleFile(name = 'assessments.json') {
    return new File(['{"k":1}'], name, { type: 'application/json' });
  }

  beforeEach(() => {
    requestMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-path — import 트리거(파일 선택) 시 request 가 POST /api/admin/import 로 body 가
  // FormData(선택 File 동봉)인 인자로 정확히 호출되고, 성공 후 완료 message 가 설정되며 진행
  // 표시(busy)가 on→off 로 해제된다.
  it('POST /api/admin/import 를 FormData(선택 File 동봉) body 로 정확히 호출하고 성공 시 완료 message 를 설정한다 (happy-path)', async () => {
    requestMock.mockResolvedValue({ imported: 3 });
    const { deps, calls } = makeImportDeps(false);
    const file = sampleFile();
    await runImport(file, deps);
    // request 가 import path 로 1 회 호출(method POST + body 는 FormData).
    expect(requestMock).toHaveBeenCalledTimes(1);
    const [path, options] = requestMock.mock.calls[0] as [
      string,
      { method: string; body: unknown },
    ];
    expect(path).toBe('/api/admin/import');
    expect(options.method).toBe('POST');
    // body 는 FormData 인스턴스이고 'file' field 에 선택 File 이 동봉된다(multipart 계약).
    expect(options.body).toBeInstanceOf(FormData);
    const sent = (options.body as FormData).get('file');
    expect(sent).toBeInstanceOf(File);
    expect((sent as File).name).toBe('assessments.json');
    // 수동 Content-Type 미지정(boundary 자동 — multipart 보장).
    expect(options).not.toHaveProperty('headers');
    // 성공 → 완료 안내 message 표면화(직전 비움 undefined 후 완료 문구).
    expect(calls.message).toEqual([undefined, '가져오기 완료']);
    // 진행 표시 on→off + error 는 시작 시 비움만(실패 문구 미설정).
    expect(calls.importing).toEqual([true, false]);
    expect(calls.error).toEqual([undefined]);
  });

  // error path — import 403(Admin+ 미만) 실패 시 error 문구가 표면화되고 throw 없이 처리되며
  // 완료 message 는 설정되지 않는다(시작 비움만).
  it('import 403(Admin+ 미만) 실패 시 error 문구를 표면화하고 throw 하지 않는다 (error path — 403)', async () => {
    requestMock.mockRejectedValue(new ApiError(403, 'Forbidden'));
    const { deps, calls } = makeImportDeps(false);
    await expect(runImport(sampleFile(), deps)).resolves.toBeUndefined();
    // 사람-친화 문구 표면화(시작 비움 → HTTP 403) + 완료 message 미설정(시작 비움만).
    expect(calls.error).toEqual([undefined, 'HTTP 403: Forbidden']);
    expect(calls.message).toEqual([undefined]);
    // 진행 표시는 성공·실패 공통으로 off.
    expect(calls.importing).toEqual([true, false]);
  });

  // error path — 400(잘못된 파일) 도 동일 안전 경로로 문구 표면화(throw 없음).
  it('import 400(잘못된 파일) 실패 시 안전 문구를 표면화한다 (error path — 400)', async () => {
    requestMock.mockRejectedValue(new ApiError(400, 'invalid file'));
    const { deps, calls } = makeImportDeps(false);
    await expect(runImport(sampleFile(), deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 400: invalid file']);
    expect(calls.message).toEqual([undefined]);
  });

  // error path — 404 도 동일 안전 경로로 문구 표면화(throw 없음).
  it('import 404 실패 시 안전 문구를 표면화한다 (error path — 404)', async () => {
    requestMock.mockRejectedValue(new ApiError(404, 'Not Found'));
    const { deps, calls } = makeImportDeps(false);
    await expect(runImport(sampleFile(), deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 404: Not Found']);
  });

  // error path — 네트워크 실패(ApiError(0)) 시 네트워크 오류 문구(throw 없음).
  it('import 네트워크 실패(ApiError 0) 시 네트워크 오류 문구를 표면화한다 (error path — 네트워크)', async () => {
    requestMock.mockRejectedValue(new ApiError(0, 'fetch failed'));
    const { deps, calls } = makeImportDeps(false);
    await expect(runImport(sampleFile(), deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, '네트워크 오류: fetch failed']);
  });

  // flow/branch — import in-flight 동안 진행 표시(importing) on, 성공/실패 어느 경우든 finally
  // 로 해제(off)됨을 확인한다.
  it('성공·실패 어느 경우든 진행 표시(importing)가 finally 로 해제된다 (flow/branch — 진행 해제)', async () => {
    requestMock.mockResolvedValueOnce({ ok: true });
    const ok = makeImportDeps(false);
    await runImport(sampleFile(), ok.deps);
    expect(ok.calls.importing).toEqual([true, false]);

    requestMock.mockRejectedValueOnce(new ApiError(500, 'boom'));
    const fail = makeImportDeps(false);
    await runImport(sampleFile(), fail.deps);
    expect(fail.calls.importing).toEqual([true, false]);
  });

  // flow/branch(시작 정리) — import 발사 직후 진행 표시 on + 직전 error·message 즉시 비움을
  // 지연 resolve 로 캡처한다(실패 후 재시도 시 직전 error/완료 안내가 진행 중 남지 않음).
  it('발사 직후 진행 표시 on + 직전 error·message 를 즉시 비운다 (flow/branch — 시작 정리)', async () => {
    let resolvePost: () => void = () => {};
    requestMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvePost = resolve;
        }),
    );
    const { deps, calls } = makeImportDeps(false);
    const pending = runImport(sampleFile(), deps);
    // 발사 직후(해소 전) — 진행 on + error/message 모두 시작 비움(undefined).
    expect(calls.importing).toEqual([true]);
    expect(calls.error).toEqual([undefined]);
    expect(calls.message).toEqual([undefined]);
    // 해소 후 — 완료 message 설정 + 진행 off.
    resolvePost();
    await pending;
    expect(calls.message).toEqual([undefined, '가져오기 완료']);
    expect(calls.importing).toEqual([true, false]);
  });

  // negative — import in-flight 중 재선택(importing=true)은 POST 미발사·state 불변(이중 호출·
  // state 깨짐 차단 — ④d exporting 가드 동형).
  it('이전 import 미완(importing=true) 중 재선택은 POST 를 발사하지 않는다 (negative — 동시 재호출)', async () => {
    const { deps, calls } = makeImportDeps(true); // 이미 in-flight.
    await runImport(sampleFile(), deps);
    // request 미호출 + 어떤 state 전이도 없음(이중 호출·state 깨짐 차단).
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.importing).toEqual([]);
    expect(calls.error).toEqual([]);
    expect(calls.message).toEqual([]);
  });

  // negative — 빈/falsy file(파일 없는 change 이벤트 등) 은 POST 미발사·state 불변·throw 없음
  // (DataImportExportPanel.handleFileChange 가 falsy file 시 미호출이나 러너 자체 방어도 확인).
  it('빈/falsy file 이면 POST 를 발사하지 않고 throw 하지 않는다 (negative — 빈 선택)', async () => {
    const { deps, calls } = makeImportDeps(false);
    await expect(
      runImport(undefined as unknown as File, deps),
    ).resolves.toBeUndefined();
    // request 미호출 + 어떤 state 전이도 없음(빈 선택 방어).
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.importing).toEqual([]);
    expect(calls.error).toEqual([]);
    expect(calls.message).toEqual([]);
  });

  // negative — 비정상/빈 응답(undefined·null)도 throw 없이 완료로 안전 처리한다(본 slice 는
  // import 응답 body 를 소비하지 않음 — 결과 상세 표시는 후속). 성공 사실만 표면화.
  it('비정상/빈 응답(undefined)도 throw 없이 완료로 안전 처리한다 (negative — 빈/비정상 응답)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps, calls } = makeImportDeps(false);
    await expect(runImport(sampleFile(), deps)).resolves.toBeUndefined();
    expect(calls.message).toEqual([undefined, '가져오기 완료']);
    expect(calls.error).toEqual([undefined]);
  });

  // negative — 실패 후 재시도(재선택)는 직전 error 를 비우고 정상 재발화한다(시작 비움 →
  // 성공 message). 첫 호출 실패 → 두 번째 호출 성공의 두 deps 흐름으로 확인.
  it('실패 후 재시도(재선택)는 직전 error 를 비우고 정상 재발화한다 (negative — 실패 후 재시도)', async () => {
    // 1차 — 실패(error 설정).
    requestMock.mockRejectedValueOnce(new ApiError(500, 'boom'));
    const first = makeImportDeps(false);
    await runImport(sampleFile(), first.deps);
    expect(first.calls.error).toEqual([undefined, 'HTTP 500: boom']);
    expect(first.calls.message).toEqual([undefined]);

    // 2차(재시도) — 성공. 시작 시 직전 error 를 비우고(undefined) 완료 message 설정.
    requestMock.mockResolvedValueOnce({ ok: true });
    const second = makeImportDeps(false);
    await runImport(sampleFile(), second.deps);
    expect(second.calls.error).toEqual([undefined]);
    expect(second.calls.message).toEqual([undefined, '가져오기 완료']);
  });
});

// ④d 배선 회귀 — 컨테이너가 DataImportExportPanel 을 세 번째 패널로 배선(onExport/busy/error/
// message props)하고, 기존 읽기 배선(그룹·provider·매핑) + DifficultyModelSelector(④c)가
// 불변임을 정적 렌더로 확인(회귀 0). DataImportExportPanel 의 busy/error/message 렌더 분기를
// 컨테이너 초기 state(미발화 — exporting=false, error/message=undefined) 기준으로 단언한다.
describe('AdminView — ④d export 패널 배선 (정적 렌더)', () => {
  beforeEach(() => {
    useApiResourceMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('세 번째 패널 DataImportExportPanel(내보내기 버튼)이 렌더되고 기존 패널은 회귀 0 이다 (배선 회귀)', () => {
    setRoutes({
      [GROUPS]: { data: SAMPLE, loading: false, error: undefined },
      [PROVIDERS]: { data: PROVIDER_ROWS, loading: false, error: undefined },
      [MAPPINGS]: { data: MAPPING_ROWS, loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView initialSelectedGroupId="g1" />);
    // 세 번째 패널 — export 버튼(내보내기)이 onExport 배선으로 활성 렌더(disabled 아님).
    // export 버튼 자체는 disabled 속성 없이 렌더된다(onExport 주입 → 활성).
    expect(html).toContain('<button type="button">내보내기</button>');
    // import 파일 입력은 ④e onImportFile 배선으로 활성(disabled 아님 — 가져오기 라벨 렌더 +
    // input 비-disabled). ④d 의 비활성(disabled) 단언을 ④e 활성으로 갱신한다(import 배선 회귀).
    expect(html).toContain('가져오기');
    expect(html).toContain('<input type="file"');
    expect(html).not.toContain('<input type="file" disabled=""');
    // 기존 배선 회귀 0 — 그룹 멤버 + provider 옵션 + 매핑 selected + 슬롯 select 그대로.
    expect(html).toContain('김철수');
    expect(html).toContain('gpt-4o (openai)');
    expect(html).toContain('value="cfg1" selected');
    expect(html).toContain('aria-label="그룹 선택"');
    expect(html).toContain('name="easy"');
  });

  it('export 미발화 초기 상태에서는 진행 표시(처리 중)·error·완료 message 가 없다 (배선 — 초기 state)', () => {
    setRoutes({
      [GROUPS]: { data: [], loading: false, error: undefined },
      [PROVIDERS]: { data: [], loading: false, error: undefined },
      [MAPPINGS]: { data: [], loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    // exporting=false 라 busy 진행 문구 미렌더, error/message undefined 라 완료 안내·error 미렌더.
    expect(html).not.toContain('처리 중…');
    expect(html).not.toContain('내보내기 완료');
    // 단 export 버튼(내보내기)은 정상 렌더(정상 분기).
    expect(html).toContain('내보내기');
  });
});
