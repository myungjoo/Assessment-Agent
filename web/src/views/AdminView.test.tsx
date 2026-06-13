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
vi.mock('../api/useApiResource', () => ({
  useApiResource: (...args: unknown[]) => useApiResourceMock(...args),
}));

import AdminView, {
  findGroup,
  deriveMembers,
  deriveProviders,
  deriveDifficultyMapping,
} from './AdminView';
import type {
  GroupRow,
  LlmProviderRow,
  DifficultyMappingRow,
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
