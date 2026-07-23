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
// T-1142 — 인원 관리 마운트 test 의 인원 샘플 row 타입. PersonList 가 named export 하는
// PersonRow 를 그대로 재사용해(컴포넌트 계약 정합) mock data shape 을 통제한다.
import type { PersonRow } from '../components/PersonList';

import AdminView, {
  findGroup,
  deriveMembers,
  buildGroupMembersPath,
  deriveMembersFromMemberships,
  deriveProviders,
  deriveProviderConfigs,
  deriveDifficultyMapping,
  buildMappingsPath,
  buildProvidersPath,
  buildPersonsPath,
  buildGroupsPath,
  buildPartsPath,
  buildPartPersonsPath,
  buildExportPath,
  mergeMapping,
  parseFilename,
  triggerDownload,
  runAssign,
  runExport,
  runImport,
  formatImportJobDetail,
  runApply,
  runTrigger,
  deriveScheduleMessage,
  buildRecentDeletionPath,
  runReEvaluate,
  runRemove,
  runDeleteProvider,
  runAdd,
  runCreateProvider,
  runCreatePerson,
  runCreateGroup,
  runCreatePart,
  runDeletePerson,
  runDeleteGroup,
  runDeletePart,
  resolveSelectedPartIdAfterDelete,
  buildDeletePartBumpRefresh,
  buildPersonPatch,
  runUpdatePerson,
  runUpdateGroup,
  runUpdatePart,
  runUpdateProvider,
  resolveProviderSelectValue,
  LLM_PROVIDER_OPTIONS,
  isAdminRole,
} from './AdminView';
import type {
  GroupRow,
  MembershipRow,
  LlmProviderRow,
  DifficultyMappingRow,
  AssignDeps,
  DownloadDeps,
  ExportDeps,
  ImportDeps,
  ScheduleMutationDeps,
  ReEvaluationDeps,
  RemoveDeps,
  DeleteProviderDeps,
  AddDeps,
  CreateProviderDeps,
  CreateProviderFields,
  CreatePersonDeps,
  CreatePersonFields,
  CreateGroupDeps,
  CreatePartDeps,
  DeletePersonDeps,
  DeleteGroupDeps,
  DeletePartDeps,
  PersonPatchInput,
  PersonPatch,
  UpdatePersonDeps,
  UpdateGroupDeps,
  UpdatePartDeps,
  UpdateProviderDeps,
  UpdateProviderFields,
} from './AdminView';

// LLM 조회 두 path 의 기본 성공(빈 데이터) 상태 — 그룹 전용 test 가 LLM path 응답을 명시하지
// 않아도 throw/loading 없이 안전 렌더하도록 빈 배열 성공을 default 로 둔다.
const EMPTY_OK: ApiResourceState<unknown> = {
  data: [],
  loading: false,
  error: undefined,
};

// ④h — GET /api/auth/me 의 기본 응답(Admin 등급). ④a~④g 의 기존 test 는 전부 Admin 등급 가정
// 하에 Admin 패널(LLM·export·import)을 단언하므로, auth/me path 의 default 를 Admin 으로 둬
// (isAdmin=true 경로) 기존 test 가 회귀 없이 통과하게 한다. gating(비-Admin) test 는 auth/me
// path 응답을 명시 주입해 분기를 통제한다.
const ADMIN_ME_OK: ApiResourceState<unknown> = {
  data: { role: 'Admin' },
  loading: false,
  error: undefined,
};

const AUTH_ME = '/api/auth/me';

// 선택 그룹 멤버십 조회 path 매칭 정규식(T-1129) — GET /api/groups/:id/members.
const MEMBERS_PATH_RE = /^\/api\/groups\/[^/]+\/members$/;

// 그룹 path + (T-1129) 멤버십 path 를 주입하는 setter — 그룹 path 는 state 를, 멤버십 path 는
// membersState(기본 EMPTY_OK)를, auth/me 는 ADMIN_ME_OK(Admin default), 나머지는 EMPTY_OK 를 낸다.
function setResource<T>(
  state: ApiResourceState<T>,
  membersState: ApiResourceState<unknown> = EMPTY_OK,
) {
  useApiResourceMock.mockImplementation((path: string | null) => {
    if (path === '/api/groups') {
      return state;
    }
    if (typeof path === 'string' && MEMBERS_PATH_RE.test(path)) {
      return membersState;
    }
    if (path === AUTH_ME) {
      return ADMIN_ME_OK;
    }
    return EMPTY_OK;
  });
}

// path 별 응답을 한 번에 주입하는 라우터 setter — LLM 패널 test 용. 명시 route 가 우선하고,
// 명시 안 된 멤버십 path(T-1129)는 SAMPLE 그룹 기본 membership 으로 fallback(g1→MEMBERS_OK_G1,
// g2→MEMBERSHIPS_G2, 그 외→빈)해 GroupMemberList 가 멤버를 렌더하도록 한다(gating/배선 test 회귀 0).
// 나머지 명시 안 된 path 는 auth/me 면 ADMIN_ME_OK(Admin default), 그 외는 EMPTY_OK 로 fallback.
function setRoutes(routes: Record<string, ApiResourceState<unknown>>) {
  useApiResourceMock.mockImplementation((path: string | null) => {
    if (typeof path === 'string' && path in routes) {
      return routes[path];
    }
    if (typeof path === 'string' && MEMBERS_PATH_RE.test(path)) {
      if (path === '/api/groups/g1/members') {
        return MEMBERS_OK_G1;
      }
      if (path === '/api/groups/g2/members') {
        return { data: MEMBERSHIPS_G2, loading: false, error: undefined };
      }
      return EMPTY_OK;
    }
    return path === AUTH_ME ? ADMIN_ME_OK : EMPTY_OK;
  });
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

// 선택 그룹 멤버십 응답 샘플(T-1129) — 신 endpoint(GET /api/groups/:id/members)의 raw
// PersonGroupMembership row. id = membershipId, personId 는 SAMPLE 그룹 person id 와 매칭돼 표시명을 채운다.
const MEMBERSHIPS_G1: MembershipRow[] = [
  { id: 'm1', personId: 'p1', groupId: 'g1' },
  { id: 'm2', personId: 'p2', groupId: 'g1' },
];
const MEMBERSHIPS_G2: MembershipRow[] = [{ id: 'm3', personId: 'p3', groupId: 'g2' }];

// 멤버십 조회의 성공/loading/error 상태 헬퍼(T-1129 container test 용).
const MEMBERS_OK_G1: ApiResourceState<unknown> = { data: MEMBERSHIPS_G1, loading: false, error: undefined };
const MEMBERS_LOADING: ApiResourceState<unknown> = { data: undefined, loading: true, error: undefined };
const MEMBERS_ERROR: ApiResourceState<unknown> = { data: undefined, loading: false, error: 'HTTP 500: members boom' };

describe('AdminView — 컨테이너 렌더', () => {
  beforeEach(() => {
    useApiResourceMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-path — 그룹 선택 시 신 endpoint 를 실 fetch 해 membership 파생 멤버(표시명은 그룹 응답
  // person 을 personId 매칭)를 렌더하고, 그룹 <select> 가 모든 그룹 옵션을 노출한다.
  it('그룹 선택 시 멤버십 endpoint 를 실 fetch 해 멤버를 렌더하고 select 가 모든 그룹 옵션을 노출한다 (happy-path)', () => {
    setResource({ data: SAMPLE, loading: false, error: undefined }, MEMBERS_OK_G1);
    const html = renderToStaticMarkup(<AdminView initialSelectedGroupId="g1" />);
    // 멤버십 endpoint 를 정확한 path 로 호출한다(선택 그룹 g1).
    const paths = useApiResourceMock.mock.calls.map((c) => c[0]);
    expect(paths).toContain('/api/groups/g1/members');
    // 선택 그룹(g1, 백엔드팀)의 멤버 표시명(그룹 응답 person 매칭)이 목록으로 렌더된다.
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

  it('멤버십 조회 loading 중 멤버 패널이 진행 표시를 렌더한다 (error path — loading)', () => {
    setResource({ data: SAMPLE, loading: false, error: undefined }, MEMBERS_LOADING);
    const html = renderToStaticMarkup(<AdminView initialSelectedGroupId="g1" />);
    // loading 우선 정책 — GroupMemberList 가 role="status" + 로딩 문구를 렌더한다.
    expect(html).toContain('role="status"');
    expect(html).toContain('불러오는 중…');
    // loading 중에는 멤버 목록 <ul> 미렌더. T-1148 이후 그룹 관리 섹션 GroupList 가 populated
    // 그룹(SAMPLE)의 <ul> 을 별도 렌더하므로 <ul> 부재로 판별할 수 없다 — 전체 <ul> 이 정확히
    // 1개(그룹 목록뿐, 멤버 <ul> 미렌더)임으로 판별한다(멤버 person 명은 재평가 select 에도 등장).
    expect(html.split('<ul>').length - 1).toBe(1);
  });

  it('멤버십 조회 error 시 멤버 패널이 에러 alert 를 렌더한다 (error path — error)', () => {
    setResource({ data: SAMPLE, loading: false, error: undefined }, MEMBERS_ERROR);
    const html = renderToStaticMarkup(<AdminView initialSelectedGroupId="g1" />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('HTTP 500: members boom');
    // error 분기 — 멤버 목록 <ul> 미렌더. 전체 <ul> 이 정확히 1개(그룹 목록뿐)임으로 판별한다
    // (T-1148 GroupList <ul> 공존 대응 — 멤버 person 명은 재평가 select 에도 등장).
    expect(html.split('<ul>').length - 1).toBe(1);
  });

  // error path — membership personId 가 그룹 person 과 매칭되지 않으면 fallback 명으로 렌더.
  it('멤버십 personId 가 그룹 person 과 매칭되지 않으면 fallback 명으로 렌더한다 (error path — 매칭 실패)', () => {
    setResource(
      { data: SAMPLE, loading: false, error: undefined },
      {
        data: [{ id: 'mX', personId: 'ghost', groupId: 'g1' }],
        loading: false,
        error: undefined,
      },
    );
    const html = renderToStaticMarkup(<AdminView initialSelectedGroupId="g1" />);
    // 매칭 person 부재 → fallback 라벨(이름 미상)로 안전 렌더(throw/undefined 렌더 없음).
    expect(html).toContain('이름 미상');
    expect(html).toContain('<ul>');
  });

  // flow/branch (a) — 그룹 미선택이면 멤버 endpoint 미호출(path=null) + 선택 안내를 렌더한다.
  it('그룹 미선택이면 멤버 endpoint 미호출(path=null) + 선택 안내 빈 상태를 렌더한다 (flow/branch — 미선택)', () => {
    setResource({ data: SAMPLE, loading: false, error: undefined });
    const html = renderToStaticMarkup(<AdminView />);
    // 미선택 → 멤버 endpoint(/api/groups/:id/members) 미호출(useApiResource 에 real path 미전달).
    const paths = useApiResourceMock.mock.calls.map((c) => c[0]);
    expect(
      paths.some((p) => typeof p === 'string' && MEMBERS_PATH_RE.test(p)),
    ).toBe(false);
    // 미선택이면 멤버 빈 상태(role="status") + 그룹 선택 안내 문구.
    expect(html).toContain('role="status"');
    expect(html).toContain('그룹을 선택하면 인원이 표시됩니다');
    // 멤버 목록 <ul> 은 미렌더 — 전체 <ul> 이 정확히 1개(그룹 목록뿐)임으로 판별한다(T-1148
    // GroupList <ul> 공존 대응). 그러나 그룹 옵션(백엔드팀)은 노출된다.
    expect(html.split('<ul>').length - 1).toBe(1);
    expect(html).toContain('백엔드팀');
  });

  it('다른 그룹을 선택하면 그 그룹의 멤버십을 fetch 해 멤버 집합이 달라진다 (flow/branch — 그룹 전환)', () => {
    setResource(
      { data: SAMPLE, loading: false, error: undefined },
      { data: MEMBERSHIPS_G2, loading: false, error: undefined },
    );
    // g2(프론트팀) 선택 → 박민수만, g1 멤버(김철수/이영희) 는 미렌더.
    const html = renderToStaticMarkup(
      <AdminView initialSelectedGroupId="g2" />,
    );
    const paths = useApiResourceMock.mock.calls.map((c) => c[0]);
    expect(paths).toContain('/api/groups/g2/members');
    expect(html).toContain('박민수');
    expect(html).not.toContain('김철수');
    expect(html).not.toContain('이영희');
  });

  it('선택 그룹의 membership 이 0 건이면 빈 상태 문구를 렌더한다 (flow/branch — membership 0)', () => {
    setResource(
      { data: SAMPLE, loading: false, error: undefined },
      { data: [], loading: false, error: undefined },
    );
    const html = renderToStaticMarkup(
      <AdminView initialSelectedGroupId="g1" />,
    );
    // membership 0 건 → 선택했으므로 "이 그룹에 속한 인원이 없습니다" 빈 상태.
    expect(html).toContain('이 그룹에 속한 인원이 없습니다');
    // 멤버 목록 <ul> 미렌더 — 전체 <ul> 이 정확히 1개(그룹 목록뿐)임으로 판별한다(T-1148
    // GroupList <ul> 공존 대응).
    expect(html.split('<ul>').length - 1).toBe(1);
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

// R-112 — T-1129 신규 멤버십 파생 helper(buildGroupMembersPath/deriveMembersFromMemberships)
// 순수 함수 검증. 조건부 조회 path·membershipId 노출·person 매칭 표시명·매칭 실패 fallback·id
// 누락 합성 key·빈/undefined/비배열 안전 처리 등 happy/branch/negative 를 각 1+ cover.
describe('AdminView — 멤버십 조회 path/파생 (순수 함수, T-1129)', () => {
  it('buildGroupMembersPath 가 선택 그룹이 있을 때만 path 를, 없으면 null 을 낸다 (helper)', () => {
    expect(buildGroupMembersPath('g1')).toBe('/api/groups/g1/members');
    // negative — 미선택(undefined/빈 문자열)이면 null(조건부 미조회).
    expect(buildGroupMembersPath(undefined)).toBeNull();
    expect(buildGroupMembersPath('')).toBeNull();
    // 비정상 문자(공백/슬래시)가 든 id 도 encodeURIComponent 로 안전 인코딩(path 안 깨짐).
    expect(buildGroupMembersPath('a b/c')).toBe('/api/groups/a%20b%2Fc/members');
  });

  it('membership 응답에서 Member.id 를 membershipId 로 두고 표시명을 person 매칭으로 채운다 (happy)', () => {
    const derived = deriveMembersFromMemberships(MEMBERSHIPS_G1, SAMPLE[0]);
    expect(derived).toHaveLength(2);
    // id 는 membershipId(m1/m2), 표시명·role 은 그룹 응답 person(p1/p2) 매칭에서 채운다.
    expect(derived[0]).toEqual({ id: 'm1', name: '김철수', role: '리더' });
    expect(derived[1]).toEqual({ id: 'm2', name: '이영희', role: undefined });
    // membershipId 가 서로 달라 React key 안정(중복 없음).
    expect(new Set(derived.map((m) => m.id)).size).toBe(derived.length);
  });

  it('그룹 응답의 persons 키 + fullName 을 표시명으로 매칭한다 (branch — 대체 키/이름 후보)', () => {
    const group: GroupRow = {
      id: 'g3',
      name: '데브옵스',
      persons: [{ id: 'p9', fullName: '최강록', role: '리더' }],
    };
    const derived = deriveMembersFromMemberships(
      [{ id: 'mm', personId: 'p9', groupId: 'g3' }],
      group,
    );
    // name 없고 fullName 만 있으면 fullName 을 표시명으로, id 는 membershipId(mm).
    expect(derived[0]).toEqual({ id: 'mm', name: '최강록', role: '리더' });
  });

  it('person 매칭 실패/이름 누락/빈 이름은 fallback 라벨로 보정한다 (negative — 매칭 실패)', () => {
    // personId 미매칭 → fallback 명 + role undefined.
    const noMatch = deriveMembersFromMemberships(
      [{ id: 'm1', personId: 'ghost', groupId: 'g1' }],
      SAMPLE[0],
    );
    expect(noMatch[0]).toEqual({ id: 'm1', name: '이름 미상', role: undefined });

    // personId 누락 membership 도 매칭 없이 fallback 명(throw 없음).
    const noPersonId = deriveMembersFromMemberships(
      [{ id: 'm2', groupId: 'g1' }],
      SAMPLE[0],
    );
    expect(noPersonId[0]).toEqual({ id: 'm2', name: '이름 미상', role: undefined });

    // 매칭 person 의 이름이 빈 문자열이면 fallback 라벨로 보정.
    const emptyName = deriveMembersFromMemberships(
      [{ id: 'm3', personId: 'pe', groupId: 'g1' }],
      { id: 'g1', name: '팀', members: [{ id: 'pe', name: '' }] },
    );
    expect(emptyName[0]).toMatchObject({ id: 'm3', name: '이름 미상' });
  });

  it('id 누락 membership 은 index 기반 합성 key 로 안전 매핑한다 (negative — membershipId 누락)', () => {
    const derived = deriveMembersFromMemberships(
      [
        { personId: 'p1', groupId: 'g1' },
        { personId: 'p2', groupId: 'g1' },
      ],
      SAMPLE[0],
    );
    // membershipId 누락 → 합성 key(m1/m2), 표시명은 person 매칭 유지 + 중복 없음(React key 안정).
    expect(derived[0]).toMatchObject({ id: 'm1', name: '김철수' });
    expect(derived[1]).toMatchObject({ id: 'm2', name: '이영희' });
    expect(new Set(derived.map((m) => m.id)).size).toBe(2);
  });

  it('빈/undefined/비배열 membership·group 부재를 안전 처리한다 (negative — 비정상 입력)', () => {
    // 빈 배열/undefined/비배열 → 빈 배열(throw 없이 빈 상태 위임).
    expect(deriveMembersFromMemberships([], SAMPLE[0])).toEqual([]);
    expect(deriveMembersFromMemberships(undefined, SAMPLE[0])).toEqual([]);
    expect(
      deriveMembersFromMemberships(null as unknown as undefined, SAMPLE[0]),
    ).toEqual([]);
    // group undefined(선택 그룹 미발견)여도 membership 은 fallback 명으로 매핑(throw 없음).
    const noGroup = deriveMembersFromMemberships(
      [{ id: 'm1', personId: 'p1', groupId: 'g1' }],
      undefined,
    );
    expect(noGroup[0]).toEqual({ id: 'm1', name: '이름 미상', role: undefined });
  });
});

// R-112 — T-1130 buildGroupMembersPath nonce 확장 branch 검증(0 → 깨끗한 path, >0 → `_r` 부착).
// buildMappingsPath 의 nonce 분기 검증과 동형. selectedGroupId 조건부 null·안전 인코딩은 유지.
describe('AdminView — buildGroupMembersPath nonce 확장 (순수 함수, T-1130)', () => {
  it('nonce 0/기본값은 깨끗한 path, >0 은 _r query 를 부착한다 (branch — cache-busting)', () => {
    // 기본값(인자 생략) = nonce 0 → 깨끗한 path(기존 T-1129 계약 불변).
    expect(buildGroupMembersPath('g1')).toBe('/api/groups/g1/members');
    // 명시 0 → 깨끗한 path.
    expect(buildGroupMembersPath('g1', 0)).toBe('/api/groups/g1/members');
    // >0 → cache-busting `_r` query 부착(useApiResource path-변경 재조회 유발).
    expect(buildGroupMembersPath('g1', 1)).toBe('/api/groups/g1/members?_r=1');
    expect(buildGroupMembersPath('g1', 7)).toBe('/api/groups/g1/members?_r=7');
    // negative — 음수 nonce 도 0 이하로 간주해 깨끗한 path(경계값 안전).
    expect(buildGroupMembersPath('g1', -1)).toBe('/api/groups/g1/members');
    // 미선택(falsy)이면 nonce 와 무관하게 null(조건부 미조회 — nonce 가 조회를 강제하지 않음).
    expect(buildGroupMembersPath(undefined, 3)).toBeNull();
    expect(buildGroupMembersPath('', 3)).toBeNull();
    // 비정상 문자가 든 groupId 도 nonce 부착과 함께 안전 인코딩(path 안 깨짐).
    expect(buildGroupMembersPath('a b', 2)).toBe('/api/groups/a%20b/members?_r=2');
  });
});

// R-112 — T-1130 onRemove 실 DELETE remove mutation 본체(runRemove) 검증. jsdom/렌더러 없이
// mutation 본체를 직접 호출하고(④c runAssign / ④e runImport 와 동일 convention), apiClient.request
// mock 으로 method/path 를 단언하며 성공/실패 분기 응답을 주입한다. 상태 전이는 record harness 의
// 콜백 호출로 관찰한다. happy/error/branch/negative 예외 분기마다 각 1+ cover.
describe('AdminView — onRemove 실 DELETE remove mutation (T-1130 runRemove)', () => {
  // 상태 전이를 기록하는 deps harness — groupId·removing 초기값과 request mock 을 주입받아
  // setRemoving/setRemoveError 호출과 bumpRefresh 호출 횟수를 모두 순서대로 캡처한다(④e 동형).
  function makeRemoveDeps(removing: boolean, groupId = 'g1') {
    const calls = {
      removing: [] as boolean[],
      error: [] as (string | undefined)[],
      bump: 0,
    };
    const deps: RemoveDeps = {
      remove: (...args: unknown[]) => requestMock(...args),
      describeError: (e: unknown) => {
        // toErrorMessage stub 과 정합 — ApiError.status → 문구.
        if (e instanceof ApiError) {
          return e.status === 0
            ? `네트워크 오류: ${e.message}`
            : `HTTP ${e.status}: ${e.message}`;
        }
        return '알 수 없는 오류';
      },
      groupId,
      removing,
      setRemoving: (next) => calls.removing.push(next),
      setRemoveError: (next) => calls.error.push(next),
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

  // happy-path — remove 트리거 시 request 가 DELETE /api/groups/<gid>/members/<mid> 로 method
  // DELETE 인 인자로 정확히 호출되고, 성공 후 재조회 nonce 를 bump(bumpRefresh 1 회) + error
  // 미설정(시작 비움만) + 진행 표시(removing) on→off 로 해제된다.
  it('DELETE /api/groups/<gid>/members/<mid> 를 method DELETE 로 정확히 호출하고 성공 시 재조회 nonce 를 bump 한다 (happy-path)', async () => {
    requestMock.mockResolvedValue(undefined); // 204 No Content — body 없음.
    const { deps, calls } = makeRemoveDeps(false, 'g1');
    await runRemove('m1', deps);
    // request 가 remove path 로 1 회 호출(method DELETE).
    expect(requestMock).toHaveBeenCalledTimes(1);
    const [path, options] = requestMock.mock.calls[0] as [
      string,
      { method: string },
    ];
    expect(path).toBe('/api/groups/g1/members/m1');
    expect(options.method).toBe('DELETE');
    // 성공 → 재조회 nonce bump 1 회 + error 시작 비움만(실패 문구 미설정).
    expect(calls.bump).toBe(1);
    expect(calls.error).toEqual([undefined]);
    // 진행 표시 on→off(finally 공통 해제).
    expect(calls.removing).toEqual([true, false]);
  });

  // error path — remove 404(NotFound, row 부재) 실패 시 error 문구가 표면화되고 throw 없이
  // 처리되며 재조회 nonce 는 bump 되지 않는다(목록 그대로 유지).
  it('remove 404(NotFound, row 부재) 실패 시 error 문구를 표면화하고 nonce 를 bump 하지 않는다 (error path — 404)', async () => {
    requestMock.mockRejectedValue(new ApiError(404, 'Not Found'));
    const { deps, calls } = makeRemoveDeps(false, 'g1');
    await expect(runRemove('ghost', deps)).resolves.toBeUndefined();
    // 사람-친화 문구 표면화(시작 비움 → HTTP 404) + 재조회 nonce 미bump(실패 시 목록 유지).
    expect(calls.error).toEqual([undefined, 'HTTP 404: Not Found']);
    expect(calls.bump).toBe(0);
    // 진행 표시는 성공·실패 공통으로 off.
    expect(calls.removing).toEqual([true, false]);
  });

  // error path — 403(Admin+ 미만) 도 동일 안전 경로로 문구 표면화(throw 없음).
  it('remove 403(Admin+ 미만) 실패 시 안전 문구를 표면화한다 (error path — 403)', async () => {
    requestMock.mockRejectedValue(new ApiError(403, 'Forbidden'));
    const { deps, calls } = makeRemoveDeps(false, 'g1');
    await expect(runRemove('m1', deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 403: Forbidden']);
    expect(calls.bump).toBe(0);
  });

  // error path — 네트워크 실패(ApiError(0)) 시 네트워크 오류 문구(throw 없음).
  it('remove 네트워크 실패(ApiError 0) 시 네트워크 오류 문구를 표면화한다 (error path — 네트워크)', async () => {
    requestMock.mockRejectedValue(new ApiError(0, 'fetch failed'));
    const { deps, calls } = makeRemoveDeps(false, 'g1');
    await expect(runRemove('m1', deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, '네트워크 오류: fetch failed']);
    expect(calls.bump).toBe(0);
  });

  // branch (a) — 빈/falsy membershipId → DELETE 미발사·state 불변·throw 없음(잘못된 path 회피).
  it('빈/falsy membershipId 이면 DELETE 를 발사하지 않는다 (branch (a) — 빈 membershipId)', async () => {
    const { deps, calls } = makeRemoveDeps(false, 'g1');
    await expect(runRemove('', deps)).resolves.toBeUndefined();
    await expect(
      runRemove(undefined as unknown as string, deps),
    ).resolves.toBeUndefined();
    // request 미호출 + 어떤 state 전이·bump 도 없음(빈 선택 방어).
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.removing).toEqual([]);
    expect(calls.error).toEqual([]);
    expect(calls.bump).toBe(0);
  });

  // branch (b) — 이전 remove 미완(removing=true) 중 재호출은 DELETE 미발사·state 불변(이중
  // DELETE·경합 차단 — ④c assigning 가드 동형).
  it('이전 remove 미완(removing=true) 중 재호출은 DELETE 를 발사하지 않는다 (branch (b) — 이중 DELETE 가드)', async () => {
    const { deps, calls } = makeRemoveDeps(true, 'g1'); // 이미 in-flight.
    await runRemove('m1', deps);
    // request 미호출 + 어떤 state 전이·bump 도 없음(이중 DELETE·state 깨짐 차단).
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.removing).toEqual([]);
    expect(calls.error).toEqual([]);
    expect(calls.bump).toBe(0);
  });

  // branch (c) — 정상 발사 시 DELETE 1 회만(중복 없음). happy-path 와 짝을 이루는 발사 횟수 단언.
  it('정상 발사 시 DELETE 를 1 회만 호출한다 (branch (c) — 단일 발사)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps } = makeRemoveDeps(false, 'g1');
    await runRemove('m2', deps);
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(requestMock.mock.calls[0]?.[0]).toBe('/api/groups/g1/members/m2');
  });

  // negative — groupId·membershipId 에 특수문자 포함 시 encodeURIComponent 로 path 안전 인코딩됨
  // (path 가 깨지거나 주입되지 않도록 방어).
  it('groupId·membershipId 특수문자를 encodeURIComponent 로 안전 인코딩한다 (negative — 특수문자 인코딩)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps } = makeRemoveDeps(false, 'a b/c');
    await runRemove('m 1/x', deps);
    // 공백/슬래시가 percent-encoding 되어 path segment 가 안전하게 유지된다.
    expect(requestMock.mock.calls[0]?.[0]).toBe(
      '/api/groups/a%20b%2Fc/members/m%201%2Fx',
    );
  });

  // negative — 성공·실패 어느 경로든 finally 가 setRemoving(false) 로 진행 표시를 복구한다.
  it('성공·실패 어느 경우든 진행 표시(removing)가 finally 로 해제된다 (negative — 진행 해제)', async () => {
    requestMock.mockResolvedValueOnce(undefined);
    const ok = makeRemoveDeps(false, 'g1');
    await runRemove('m1', ok.deps);
    expect(ok.calls.removing).toEqual([true, false]);

    requestMock.mockRejectedValueOnce(new ApiError(500, 'boom'));
    const fail = makeRemoveDeps(false, 'g1');
    await runRemove('m1', fail.deps);
    expect(fail.calls.removing).toEqual([true, false]);
  });

  // negative(시작 정리) — 발사 직후 진행 표시 on + 직전 error 즉시 비움을 지연 resolve 로 캡처
  // 한다(재조회 도착 전 상태에서 crash 없음 + 실패 후 재시도 시 직전 error 가 진행 중 남지 않음).
  it('발사 직후 진행 표시 on + 직전 error 를 즉시 비운다 (negative — 시작 정리/재조회 전 안전)', async () => {
    let resolveDelete: () => void = () => {};
    requestMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        }),
    );
    const { deps, calls } = makeRemoveDeps(false, 'g1');
    const pending = runRemove('m1', deps);
    // 발사 직후(해소 전) — 진행 on + error 시작 비움(undefined) + 재조회 아직 미bump(crash 없음).
    expect(calls.removing).toEqual([true]);
    expect(calls.error).toEqual([undefined]);
    expect(calls.bump).toBe(0);
    // 해소 후 — 재조회 bump + 진행 off.
    resolveDelete();
    await pending;
    expect(calls.bump).toBe(1);
    expect(calls.removing).toEqual([true, false]);
  });

  // negative — 실패 후 재시도(재클릭)는 직전 error 를 비우고 정상 재발화한다(시작 비움 → 성공
  // bump). 첫 호출 실패 → 두 번째 호출 성공의 두 deps 흐름으로 확인.
  it('실패 후 재시도(재클릭)는 직전 error 를 비우고 정상 재발화한다 (negative — 실패 후 재시도)', async () => {
    requestMock.mockRejectedValueOnce(new ApiError(500, 'boom'));
    const first = makeRemoveDeps(false, 'g1');
    await runRemove('m1', first.deps);
    expect(first.calls.error).toEqual([undefined, 'HTTP 500: boom']);
    expect(first.calls.bump).toBe(0);

    requestMock.mockResolvedValueOnce(undefined);
    const second = makeRemoveDeps(false, 'g1');
    await runRemove('m1', second.deps);
    expect(second.calls.error).toEqual([undefined]);
    expect(second.calls.bump).toBe(1);
  });
});

// R-112 — T-1135 provider 삭제 실 DELETE mutation 본체(runDeleteProvider) 검증. jsdom/렌더러
// 없이 mutation 본체를 직접 호출하고(runRemove 와 동일 convention), apiClient.request mock 으로
// method/path 를 단언하며 성공/실패 분기 응답을 주입한다. 상태 전이는 record harness 의 콜백
// 호출로 관찰한다. happy/error/branch/negative 예외 분기마다 각 1+ cover.
describe('AdminView — provider 삭제 실 DELETE mutation (T-1135 runDeleteProvider)', () => {
  // 상태 전이를 기록하는 deps harness — deleting 초기값과 request mock 을 주입받아
  // setDeleting/setDeleteError 호출과 bumpRefresh 호출 횟수를 순서대로 캡처한다(runRemove 동형).
  function makeDeleteDeps(deleting: boolean) {
    const calls = {
      deleting: [] as boolean[],
      error: [] as (string | undefined)[],
      bump: 0,
    };
    const deps: DeleteProviderDeps = {
      remove: (...args: unknown[]) => requestMock(...args),
      describeError: (e: unknown) => {
        // toErrorMessage stub 과 정합 — ApiError.status → 문구.
        if (e instanceof ApiError) {
          return e.status === 0
            ? `네트워크 오류: ${e.message}`
            : `HTTP ${e.status}: ${e.message}`;
        }
        return '알 수 없는 오류';
      },
      deleting,
      setDeleting: (next) => calls.deleting.push(next),
      setDeleteError: (next) => calls.error.push(next),
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

  // happy-path — 삭제 트리거 시 request 가 DELETE /api/llm/providers/<id> 로 method DELETE 인
  // 인자로 정확히 호출되고, 성공 후 재조회 nonce 를 bump(bumpRefresh 1 회) + error 미설정(시작
  // 비움만) + 진행 표시(deleting) on→off 로 해제된다.
  it('DELETE /api/llm/providers/<id> 를 method DELETE 로 정확히 호출하고 성공 시 재조회 nonce 를 bump 한다 (happy-path)', async () => {
    requestMock.mockResolvedValue(undefined); // 204 No Content — body 없음.
    const { deps, calls } = makeDeleteDeps(false);
    await runDeleteProvider('cfg1', deps);
    expect(requestMock).toHaveBeenCalledTimes(1);
    const [path, options] = requestMock.mock.calls[0] as [
      string,
      { method: string },
    ];
    expect(path).toBe('/api/llm/providers/cfg1');
    expect(options.method).toBe('DELETE');
    // 성공 → 재조회 nonce bump 1 회 + error 시작 비움만(실패 문구 미설정).
    expect(calls.bump).toBe(1);
    expect(calls.error).toEqual([undefined]);
    // 진행 표시 on→off(finally 공통 해제).
    expect(calls.deleting).toEqual([true, false]);
  });

  // error path — 404(NotFound, config 부재) 실패 시 error 문구가 표면화되고 throw 없이 처리되며
  // 재조회 nonce 는 bump 되지 않는다(목록 그대로 유지).
  it('삭제 404(NotFound, config 부재) 실패 시 error 문구를 표면화하고 nonce 를 bump 하지 않는다 (error path — 404)', async () => {
    requestMock.mockRejectedValue(new ApiError(404, 'Not Found'));
    const { deps, calls } = makeDeleteDeps(false);
    await expect(runDeleteProvider('ghost', deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 404: Not Found']);
    expect(calls.bump).toBe(0);
    expect(calls.deleting).toEqual([true, false]);
  });

  // error path — 409(in-use, 참조 중 삭제 거부) 도 동일 안전 경로로 문구 표면화(throw 없음).
  it('삭제 409(in-use, 참조 중) 실패 시 안전 문구를 표면화한다 (error path — 409)', async () => {
    requestMock.mockRejectedValue(new ApiError(409, 'Conflict'));
    const { deps, calls } = makeDeleteDeps(false);
    await expect(runDeleteProvider('cfg1', deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 409: Conflict']);
    expect(calls.bump).toBe(0);
  });

  // error path — 403(Admin+ 미만) 실패 시 안전 문구 표면화(throw 없음).
  it('삭제 403(Admin+ 미만) 실패 시 안전 문구를 표면화한다 (error path — 403)', async () => {
    requestMock.mockRejectedValue(new ApiError(403, 'Forbidden'));
    const { deps, calls } = makeDeleteDeps(false);
    await expect(runDeleteProvider('cfg1', deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 403: Forbidden']);
    expect(calls.bump).toBe(0);
  });

  // error path — 네트워크 실패(ApiError(0)) 시 네트워크 오류 문구(throw 없음).
  it('삭제 네트워크 실패(ApiError 0) 시 네트워크 오류 문구를 표면화한다 (error path — 네트워크)', async () => {
    requestMock.mockRejectedValue(new ApiError(0, 'fetch failed'));
    const { deps, calls } = makeDeleteDeps(false);
    await expect(runDeleteProvider('cfg1', deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, '네트워크 오류: fetch failed']);
    expect(calls.bump).toBe(0);
  });

  // branch (a) — 빈/falsy id → DELETE 미발사·state 불변·throw 없음(잘못된 path 회피).
  it('빈/falsy id 이면 DELETE 를 발사하지 않는다 (branch (a) — 빈 id)', async () => {
    const { deps, calls } = makeDeleteDeps(false);
    await expect(runDeleteProvider('', deps)).resolves.toBeUndefined();
    await expect(
      runDeleteProvider(undefined as unknown as string, deps),
    ).resolves.toBeUndefined();
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.deleting).toEqual([]);
    expect(calls.error).toEqual([]);
    expect(calls.bump).toBe(0);
  });

  // branch (a2)/negative — 공백만 든 id(trim 후 빈 문자열) 도 DELETE 미발사(경계값 방어).
  it('공백만 든 id 이면 trim 후 빈 문자열로 판정해 DELETE 를 발사하지 않는다 (negative — 공백 id 경계값)', async () => {
    const { deps, calls } = makeDeleteDeps(false);
    await expect(runDeleteProvider('   ', deps)).resolves.toBeUndefined();
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.deleting).toEqual([]);
    expect(calls.bump).toBe(0);
  });

  // branch (b) — 이전 삭제 미완(deleting=true) 중 재호출은 DELETE 미발사·state 불변(이중 DELETE·
  // 경합 차단 — runRemove removing 가드 동형).
  it('이전 삭제 미완(deleting=true) 중 재호출은 DELETE 를 발사하지 않는다 (branch (b) — 이중 DELETE 가드)', async () => {
    const { deps, calls } = makeDeleteDeps(true); // 이미 in-flight.
    await runDeleteProvider('cfg1', deps);
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.deleting).toEqual([]);
    expect(calls.error).toEqual([]);
    expect(calls.bump).toBe(0);
  });

  // branch (c) — 정상 발사 시 DELETE 1 회만(중복 없음). happy-path 와 짝을 이루는 발사 횟수 단언.
  it('정상 발사 시 DELETE 를 1 회만 호출한다 (branch (c) — 단일 발사)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps } = makeDeleteDeps(false);
    await runDeleteProvider('cfg2', deps);
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(requestMock.mock.calls[0]?.[0]).toBe('/api/llm/providers/cfg2');
  });

  // negative — id 특수문자 포함 시 encodeURIComponent 로 path 안전 인코딩됨(path 주입 방어).
  it('id 특수문자를 encodeURIComponent 로 안전 인코딩한다 (negative — 특수문자 인코딩)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps } = makeDeleteDeps(false);
    await runDeleteProvider('cfg 1/x', deps);
    expect(requestMock.mock.calls[0]?.[0]).toBe('/api/llm/providers/cfg%201%2Fx');
  });

  // negative — 성공·실패 어느 경로든 finally 가 setDeleting(false) 로 진행 표시를 복구한다.
  it('성공·실패 어느 경우든 진행 표시(deleting)가 finally 로 해제된다 (negative — 진행 해제)', async () => {
    requestMock.mockResolvedValueOnce(undefined);
    const ok = makeDeleteDeps(false);
    await runDeleteProvider('cfg1', ok.deps);
    expect(ok.calls.deleting).toEqual([true, false]);

    requestMock.mockRejectedValueOnce(new ApiError(500, 'boom'));
    const fail = makeDeleteDeps(false);
    await runDeleteProvider('cfg1', fail.deps);
    expect(fail.calls.deleting).toEqual([true, false]);
  });

  // negative(시작 정리) — 발사 직후 진행 표시 on + 직전 error 즉시 비움을 지연 resolve 로 캡처한다
  // (재조회 도착 전 crash 없음 + 실패 후 재시도 시 직전 error 가 진행 중 남지 않음).
  it('발사 직후 진행 표시 on + 직전 error 를 즉시 비운다 (negative — 시작 정리/재조회 전 안전)', async () => {
    let resolveDelete: () => void = () => {};
    requestMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        }),
    );
    const { deps, calls } = makeDeleteDeps(false);
    const pending = runDeleteProvider('cfg1', deps);
    // 발사 직후(해소 전) — 진행 on + error 시작 비움 + 재조회 아직 미bump(crash 없음).
    expect(calls.deleting).toEqual([true]);
    expect(calls.error).toEqual([undefined]);
    expect(calls.bump).toBe(0);
    // 해소 후 — 재조회 bump + 진행 off.
    resolveDelete();
    await pending;
    expect(calls.bump).toBe(1);
    expect(calls.deleting).toEqual([true, false]);
  });

  // negative — 실패 후 재시도(재클릭)는 직전 error 를 비우고 정상 재발화한다(시작 비움 → 성공 bump).
  it('실패 후 재시도(재클릭)는 직전 error 를 비우고 정상 재발화한다 (negative — 실패 후 재시도)', async () => {
    requestMock.mockRejectedValueOnce(new ApiError(500, 'boom'));
    const first = makeDeleteDeps(false);
    await runDeleteProvider('cfg1', first.deps);
    expect(first.calls.error).toEqual([undefined, 'HTTP 500: boom']);
    expect(first.calls.bump).toBe(0);

    requestMock.mockResolvedValueOnce(undefined);
    const second = makeDeleteDeps(false);
    await runDeleteProvider('cfg1', second.deps);
    expect(second.calls.error).toEqual([undefined]);
    expect(second.calls.bump).toBe(1);
  });
});

// R-112 — T-1131 멤버 추가 실 POST add mutation 본체(runAdd) 검증. jsdom/렌더러 없이 mutation
// 본체를 직접 호출하고(runRemove 와 동일 convention), apiClient.request mock 으로 method/path/body
// 를 단언하며 성공/실패 분기 응답을 주입한다. 상태 전이는 record harness 의 콜백 호출로 관찰한다.
// happy/error/branch/negative 예외 분기마다 각 1+ cover.
describe('AdminView — 멤버 추가 실 POST add mutation (T-1131 runAdd)', () => {
  // 상태 전이를 기록하는 deps harness — groupId·adding 초기값과 request mock 을 주입받아
  // setAdding/setAddError 호출과 bumpRefresh·resetInput 호출 횟수를 모두 순서대로 캡처한다.
  function makeAddDeps(adding: boolean, groupId = 'g1') {
    const calls = {
      adding: [] as boolean[],
      error: [] as (string | undefined)[],
      bump: 0,
      reset: 0,
    };
    const deps: AddDeps = {
      add: (...args: unknown[]) => requestMock(...args),
      describeError: (e: unknown) => {
        // toErrorMessage stub 과 정합 — ApiError.status → 문구.
        if (e instanceof ApiError) {
          return e.status === 0
            ? `네트워크 오류: ${e.message}`
            : `HTTP ${e.status}: ${e.message}`;
        }
        return '알 수 없는 오류';
      },
      groupId,
      adding,
      setAdding: (next) => calls.adding.push(next),
      setAddError: (next) => calls.error.push(next),
      bumpRefresh: () => {
        calls.bump += 1;
      },
      resetInput: () => {
        calls.reset += 1;
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

  // happy-path — add 트리거 시 request 가 POST /api/groups/<gid>/members 로 method POST + body
  // `{ personId }` 인 인자로 정확히 호출되고, 성공 후 재조회 nonce bump(1 회) + 입력 초기화(1 회) +
  // error 미설정(시작 비움만) + 진행 표시(adding) on→off 로 해제된다.
  it('POST /api/groups/<gid>/members 를 method POST + body { personId } 로 정확히 호출하고 성공 시 재조회 nonce bump + 입력 초기화 한다 (happy-path)', async () => {
    requestMock.mockResolvedValue(undefined); // 201 Created.
    const { deps, calls } = makeAddDeps(false, 'g1');
    await runAdd('p1', deps);
    expect(requestMock).toHaveBeenCalledTimes(1);
    const [path, options] = requestMock.mock.calls[0] as [
      string,
      { method: string; body: string },
    ];
    expect(path).toBe('/api/groups/g1/members');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ personId: 'p1' });
    // 성공 → 재조회 nonce bump 1 회 + 입력 초기화 1 회 + error 시작 비움만(실패 문구 미설정).
    expect(calls.bump).toBe(1);
    expect(calls.reset).toBe(1);
    expect(calls.error).toEqual([undefined]);
    // 진행 표시 on→off(finally 공통 해제).
    expect(calls.adding).toEqual([true, false]);
  });

  // error path — add 409(중복 멤버, @@unique 위반) 실패 시 error 문구가 표면화되고 throw 없이
  // 처리되며 재조회 nonce·입력 초기화는 일어나지 않는다(입력 유지 — 재시도 편의).
  it('add 409(중복 멤버, @@unique 위반) 실패 시 error 문구를 표면화하고 nonce·입력을 건드리지 않는다 (error path — 409)', async () => {
    requestMock.mockRejectedValue(new ApiError(409, 'Conflict'));
    const { deps, calls } = makeAddDeps(false, 'g1');
    await expect(runAdd('p1', deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 409: Conflict']);
    expect(calls.bump).toBe(0);
    expect(calls.reset).toBe(0);
    expect(calls.adding).toEqual([true, false]);
  });

  // error path — 403(Admin+ 미만) 도 동일 안전 경로로 문구 표면화(throw 없음).
  it('add 403(Admin+ 미만) 실패 시 안전 문구를 표면화한다 (error path — 403)', async () => {
    requestMock.mockRejectedValue(new ApiError(403, 'Forbidden'));
    const { deps, calls } = makeAddDeps(false, 'g1');
    await expect(runAdd('p1', deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 403: Forbidden']);
    expect(calls.bump).toBe(0);
  });

  // error path — 404(group 부재) 실패 시 동일 안전 경로.
  it('add 404(group 부재) 실패 시 안전 문구를 표면화한다 (error path — 404)', async () => {
    requestMock.mockRejectedValue(new ApiError(404, 'Not Found'));
    const { deps, calls } = makeAddDeps(false, 'g1');
    await expect(runAdd('p1', deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 404: Not Found']);
    expect(calls.bump).toBe(0);
  });

  // error path — 네트워크 실패(ApiError(0)) 시 네트워크 오류 문구(throw 없음).
  it('add 네트워크 실패(ApiError 0) 시 네트워크 오류 문구를 표면화한다 (error path — 네트워크)', async () => {
    requestMock.mockRejectedValue(new ApiError(0, 'fetch failed'));
    const { deps, calls } = makeAddDeps(false, 'g1');
    await expect(runAdd('p1', deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, '네트워크 오류: fetch failed']);
    expect(calls.bump).toBe(0);
  });

  // branch (a) — 빈/falsy personId → POST 미발사·state 불변·throw 없음(잘못된 body 회피).
  it('빈/falsy personId 이면 POST 를 발사하지 않는다 (branch (a) — 빈 personId)', async () => {
    const { deps, calls } = makeAddDeps(false, 'g1');
    await expect(runAdd('', deps)).resolves.toBeUndefined();
    await expect(
      runAdd(undefined as unknown as string, deps),
    ).resolves.toBeUndefined();
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.adding).toEqual([]);
    expect(calls.error).toEqual([]);
    expect(calls.bump).toBe(0);
    expect(calls.reset).toBe(0);
  });

  // negative — 공백만 있는 personId → trim 후 빈 값이므로 POST 미발사(빈 값 방어).
  it('공백만 있는 personId 는 trim 후 빈 값이라 POST 를 발사하지 않는다 (negative — 공백 personId)', async () => {
    const { deps, calls } = makeAddDeps(false, 'g1');
    await expect(runAdd('   ', deps)).resolves.toBeUndefined();
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.adding).toEqual([]);
    expect(calls.bump).toBe(0);
  });

  // negative — 선택 그룹 미선택(빈 groupId) → POST 미발사(잘못된 path 회피).
  it('선택 그룹 미선택(빈 groupId)이면 POST 를 발사하지 않는다 (negative — 그룹 미선택)', async () => {
    const { deps, calls } = makeAddDeps(false, '');
    await expect(runAdd('p1', deps)).resolves.toBeUndefined();
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.adding).toEqual([]);
    expect(calls.bump).toBe(0);
  });

  // branch (b) — 이전 add 미완(adding=true) 중 재호출은 POST 미발사·state 불변(이중 POST·경합 차단).
  it('이전 add 미완(adding=true) 중 재호출은 POST 를 발사하지 않는다 (branch (b) — 이중 POST 가드)', async () => {
    const { deps, calls } = makeAddDeps(true, 'g1'); // 이미 in-flight.
    await runAdd('p1', deps);
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.adding).toEqual([]);
    expect(calls.error).toEqual([]);
    expect(calls.bump).toBe(0);
  });

  // branch (c) — 정상 발사 시 POST 1 회만(중복 없음).
  it('정상 발사 시 POST 를 1 회만 호출한다 (branch (c) — 단일 발사)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps } = makeAddDeps(false, 'g1');
    await runAdd('p2', deps);
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(requestMock.mock.calls[0]?.[0]).toBe('/api/groups/g1/members');
  });

  // negative — groupId 특수문자 포함 시 encodeURIComponent 로 path 안전 인코딩됨(path 주입 방어).
  // 또한 personId 앞뒤 공백은 trim 되어 body 에 실린다(공백 정규화).
  it('groupId 특수문자를 encodeURIComponent 로 안전 인코딩하고 personId 는 trim 해 body 에 싣는다 (negative — 특수문자 인코딩 + trim)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps } = makeAddDeps(false, 'a b/c');
    await runAdd('  p 1/x  ', deps);
    const [path, options] = requestMock.mock.calls[0] as [
      string,
      { body: string },
    ];
    expect(path).toBe('/api/groups/a%20b%2Fc/members');
    expect(JSON.parse(options.body)).toEqual({ personId: 'p 1/x' });
  });

  // negative — 성공 후 입력 초기화(resetInput 1 회) + 실패 시 입력 유지(resetInput 0 회) 대비 검증.
  it('성공 시 입력을 초기화하고 실패 시 입력을 유지한다 (negative — 성공 후 초기화)', async () => {
    requestMock.mockResolvedValueOnce(undefined);
    const ok = makeAddDeps(false, 'g1');
    await runAdd('p1', ok.deps);
    expect(ok.calls.reset).toBe(1);

    requestMock.mockRejectedValueOnce(new ApiError(409, 'Conflict'));
    const fail = makeAddDeps(false, 'g1');
    await runAdd('p1', fail.deps);
    expect(fail.calls.reset).toBe(0);
  });

  // negative — 성공·실패 어느 경로든 finally 가 setAdding(false) 로 진행 표시를 복구한다.
  it('성공·실패 어느 경우든 진행 표시(adding)가 finally 로 해제된다 (negative — 진행 해제)', async () => {
    requestMock.mockResolvedValueOnce(undefined);
    const ok = makeAddDeps(false, 'g1');
    await runAdd('p1', ok.deps);
    expect(ok.calls.adding).toEqual([true, false]);

    requestMock.mockRejectedValueOnce(new ApiError(500, 'boom'));
    const fail = makeAddDeps(false, 'g1');
    await runAdd('p1', fail.deps);
    expect(fail.calls.adding).toEqual([true, false]);
  });

  // negative(시작 정리) — 발사 직후 진행 표시 on + 직전 error 즉시 비움을 지연 resolve 로 캡처한다
  // (재조회 도착 전 상태에서 crash 없음). 해소 후 재조회 bump + 입력 초기화 + 진행 off.
  it('발사 직후 진행 표시 on + 직전 error 를 즉시 비운다 (negative — 시작 정리/재조회 전 안전)', async () => {
    let resolvePost: () => void = () => {};
    requestMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvePost = resolve;
        }),
    );
    const { deps, calls } = makeAddDeps(false, 'g1');
    const pending = runAdd('p1', deps);
    expect(calls.adding).toEqual([true]);
    expect(calls.error).toEqual([undefined]);
    expect(calls.bump).toBe(0);
    expect(calls.reset).toBe(0);
    resolvePost();
    await pending;
    expect(calls.bump).toBe(1);
    expect(calls.reset).toBe(1);
    expect(calls.adding).toEqual([true, false]);
  });

  // negative — 실패 후 재시도(재클릭)는 직전 error 를 비우고 정상 재발화한다(시작 비움 → 성공 bump).
  it('실패 후 재시도(재클릭)는 직전 error 를 비우고 정상 재발화한다 (negative — 실패 후 재시도)', async () => {
    requestMock.mockRejectedValueOnce(new ApiError(500, 'boom'));
    const first = makeAddDeps(false, 'g1');
    await runAdd('p1', first.deps);
    expect(first.calls.error).toEqual([undefined, 'HTTP 500: boom']);
    expect(first.calls.bump).toBe(0);

    requestMock.mockResolvedValueOnce(undefined);
    const second = makeAddDeps(false, 'g1');
    await runAdd('p1', second.deps);
    expect(second.calls.error).toEqual([undefined]);
    expect(second.calls.bump).toBe(1);
  });
});

// R-112 — T-1136 provider 생성 실 POST create mutation 본체(runCreateProvider) 검증. jsdom/렌더러
// 없이 mutation 본체를 직접 호출하고(runAdd 와 동일 convention), apiClient.request mock 으로
// method/path/body 를 단언하며 성공/실패 분기 응답을 주입한다. 상태 전이는 record harness 의 콜백
// 호출로 관찰한다. happy/error/branch/negative 예외 분기마다 각 1+ cover. secret apiKey 는 body 로만
// 실리고 error 문구에 재노출되지 않음을 별도 negative 로 검증한다.
describe('AdminView — provider 생성 실 POST create mutation (T-1136 runCreateProvider)', () => {
  // 유효한 4 필드 기본 입력값 — 각 test 가 필요 시 일부만 덮어 빈/공백 분기를 만든다.
  const VALID: CreateProviderFields = {
    provider: 'openai',
    endpointUrl: 'https://api.openai.com/v1',
    apiKey: 'sk-secret-123',
    modelId: 'gpt-4o',
  };

  // 상태 전이를 기록하는 deps harness — creating 초기값과 request mock 을 주입받아
  // setCreating/setCreateError 호출과 bumpRefresh·resetInput 호출 횟수를 모두 순서대로 캡처한다.
  function makeCreateDeps(creating: boolean) {
    const calls = {
      creating: [] as boolean[],
      error: [] as (string | undefined)[],
      bump: 0,
      reset: 0,
    };
    const deps: CreateProviderDeps = {
      create: (...args: unknown[]) => requestMock(...args),
      describeError: (e: unknown) => {
        // toErrorMessage stub 과 정합 — ApiError.status → 문구.
        if (e instanceof ApiError) {
          return e.status === 0
            ? `네트워크 오류: ${e.message}`
            : `HTTP ${e.status}: ${e.message}`;
        }
        return '알 수 없는 오류';
      },
      creating,
      setCreating: (next) => calls.creating.push(next),
      setCreateError: (next) => calls.error.push(next),
      bumpRefresh: () => {
        calls.bump += 1;
      },
      resetInput: () => {
        calls.reset += 1;
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

  // happy-path — create 트리거 시 request 가 POST /api/llm/providers 로 method POST + body 4 필드
  // 인 인자로 정확히 호출되고, 성공 후 재조회 nonce bump(1 회) + 입력 초기화(1 회) + error 미설정
  // (시작 비움만) + 진행 표시(creating) on→off 로 해제된다.
  it('POST /api/llm/providers 를 method POST + body 4 필드로 정확히 호출하고 성공 시 재조회 nonce bump + 입력 초기화 한다 (happy-path)', async () => {
    requestMock.mockResolvedValue(undefined); // 201 Created.
    const { deps, calls } = makeCreateDeps(false);
    await runCreateProvider(VALID, deps);
    expect(requestMock).toHaveBeenCalledTimes(1);
    const [path, options] = requestMock.mock.calls[0] as [
      string,
      { method: string; body: string },
    ];
    expect(path).toBe('/api/llm/providers');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({
      provider: 'openai',
      endpointUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-secret-123',
      modelId: 'gpt-4o',
    });
    // 성공 → 재조회 nonce bump 1 회 + 입력 초기화 1 회 + error 시작 비움만(실패 문구 미설정).
    expect(calls.bump).toBe(1);
    expect(calls.reset).toBe(1);
    expect(calls.error).toEqual([undefined]);
    // 진행 표시 on→off(finally 공통 해제).
    expect(calls.creating).toEqual([true, false]);
  });

  // error path — create 400(미지원 provider·검증 실패) 시 error 문구가 표면화되고 throw 없이
  // 처리되며 재조회 nonce·입력 초기화는 일어나지 않는다(입력 유지 — 재시도 편의).
  it('create 400(검증 실패) 시 error 문구를 표면화하고 nonce·입력을 건드리지 않는다 (error path — 400)', async () => {
    requestMock.mockRejectedValue(new ApiError(400, 'Bad Request'));
    const { deps, calls } = makeCreateDeps(false);
    await expect(runCreateProvider(VALID, deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 400: Bad Request']);
    expect(calls.bump).toBe(0);
    expect(calls.reset).toBe(0);
    expect(calls.creating).toEqual([true, false]);
  });

  // error path — 403(Admin+ 미만) 도 동일 안전 경로로 문구 표면화(throw 없음).
  it('create 403(Admin+ 미만) 실패 시 안전 문구를 표면화한다 (error path — 403)', async () => {
    requestMock.mockRejectedValue(new ApiError(403, 'Forbidden'));
    const { deps, calls } = makeCreateDeps(false);
    await expect(runCreateProvider(VALID, deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 403: Forbidden']);
    expect(calls.bump).toBe(0);
  });

  // error path — 409(중복 provider) 실패 시 동일 안전 경로.
  it('create 409(중복 provider) 실패 시 안전 문구를 표면화한다 (error path — 409)', async () => {
    requestMock.mockRejectedValue(new ApiError(409, 'Conflict'));
    const { deps, calls } = makeCreateDeps(false);
    await expect(runCreateProvider(VALID, deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 409: Conflict']);
    expect(calls.bump).toBe(0);
  });

  // error path — 네트워크 실패(ApiError(0)) 시 네트워크 오류 문구(throw 없음).
  it('create 네트워크 실패(ApiError 0) 시 네트워크 오류 문구를 표면화한다 (error path — 네트워크)', async () => {
    requestMock.mockRejectedValue(new ApiError(0, 'fetch failed'));
    const { deps, calls } = makeCreateDeps(false);
    await expect(runCreateProvider(VALID, deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, '네트워크 오류: fetch failed']);
    expect(calls.bump).toBe(0);
  });

  // branch (a) — 각 필드가 빈값이면 POST 미발사·state 불변·throw 없음(잘못된 body 회피). 4 필드
  // 각각을 비워 필드별 가드를 개별 cover 한다(단일 negative 로 부족 — 필드마다).
  it('4 필드 중 하나라도 빈값이면 POST 를 발사하지 않는다 (branch (a) — 필드별 빈값 가드)', async () => {
    const fieldKeys: (keyof CreateProviderFields)[] = [
      'provider',
      'endpointUrl',
      'apiKey',
      'modelId',
    ];
    for (const key of fieldKeys) {
      requestMock.mockReset();
      const { deps, calls } = makeCreateDeps(false);
      await expect(
        runCreateProvider({ ...VALID, [key]: '' }, deps),
      ).resolves.toBeUndefined();
      expect(requestMock).not.toHaveBeenCalled();
      expect(calls.creating).toEqual([]);
      expect(calls.error).toEqual([]);
      expect(calls.bump).toBe(0);
      expect(calls.reset).toBe(0);
    }
  });

  // negative — 각 필드가 공백만이면 trim 후 빈 값이라 POST 미발사(빈 값 방어 — 필드별).
  it('공백만 있는 필드는 trim 후 빈 값이라 POST 를 발사하지 않는다 (negative — 필드별 공백)', async () => {
    const fieldKeys: (keyof CreateProviderFields)[] = [
      'provider',
      'endpointUrl',
      'apiKey',
      'modelId',
    ];
    for (const key of fieldKeys) {
      requestMock.mockReset();
      const { deps, calls } = makeCreateDeps(false);
      await expect(
        runCreateProvider({ ...VALID, [key]: '   ' }, deps),
      ).resolves.toBeUndefined();
      expect(requestMock).not.toHaveBeenCalled();
      expect(calls.creating).toEqual([]);
      expect(calls.bump).toBe(0);
    }
  });

  // branch (b) — 이전 create 미완(creating=true) 중 재호출은 POST 미발사·state 불변(이중 POST·경합 차단).
  it('이전 create 미완(creating=true) 중 재호출은 POST 를 발사하지 않는다 (branch (b) — 이중 POST 가드)', async () => {
    const { deps, calls } = makeCreateDeps(true); // 이미 in-flight.
    await runCreateProvider(VALID, deps);
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.creating).toEqual([]);
    expect(calls.error).toEqual([]);
    expect(calls.bump).toBe(0);
  });

  // branch (c) — 정상 발사 시 POST 1 회만(중복 없음).
  it('정상 발사 시 POST 를 1 회만 호출한다 (branch (c) — 단일 발사)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps } = makeCreateDeps(false);
    await runCreateProvider(VALID, deps);
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(requestMock.mock.calls[0]?.[0]).toBe('/api/llm/providers');
  });

  // negative — 각 필드 앞뒤 공백은 trim 되어 body 에 실린다(공백 정규화). secret apiKey 도 trim 된다.
  it('각 필드 앞뒤 공백을 trim 해 body 에 싣는다 (negative — trim 정규화)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps } = makeCreateDeps(false);
    await runCreateProvider(
      {
        provider: '  openai  ',
        endpointUrl: '  https://x  ',
        apiKey: '  sk-1  ',
        modelId: '  m1  ',
      },
      deps,
    );
    const [, options] = requestMock.mock.calls[0] as [string, { body: string }];
    expect(JSON.parse(options.body)).toEqual({
      provider: 'openai',
      endpointUrl: 'https://x',
      apiKey: 'sk-1',
      modelId: 'm1',
    });
  });

  // negative(secret 미노출) — 실패 시 error 문구에 apiKey 평문이 절대 포함되지 않는다(secret 유출 방어).
  // describeError 는 ApiError.status/message 만 파생하므로 apiKey 는 error state 에 흘러들지 않는다.
  it('실패 시 error 문구에 apiKey 평문이 포함되지 않는다 (negative — secret 미노출)', async () => {
    requestMock.mockRejectedValue(new ApiError(400, 'Bad Request'));
    const { deps, calls } = makeCreateDeps(false);
    await runCreateProvider({ ...VALID, apiKey: 'sk-super-secret' }, deps);
    for (const msg of calls.error) {
      expect(msg ?? '').not.toContain('sk-super-secret');
    }
  });

  // negative — 성공 후 입력 초기화(resetInput 1 회) + 실패 시 입력 유지(resetInput 0 회) 대비 검증.
  it('성공 시 입력을 초기화하고 실패 시 입력을 유지한다 (negative — 성공 후 초기화)', async () => {
    requestMock.mockResolvedValueOnce(undefined);
    const ok = makeCreateDeps(false);
    await runCreateProvider(VALID, ok.deps);
    expect(ok.calls.reset).toBe(1);

    requestMock.mockRejectedValueOnce(new ApiError(409, 'Conflict'));
    const fail = makeCreateDeps(false);
    await runCreateProvider(VALID, fail.deps);
    expect(fail.calls.reset).toBe(0);
  });

  // negative — 성공·실패 어느 경로든 finally 가 setCreating(false) 로 진행 표시를 복구한다.
  it('성공·실패 어느 경우든 진행 표시(creating)가 finally 로 해제된다 (negative — 진행 해제)', async () => {
    requestMock.mockResolvedValueOnce(undefined);
    const ok = makeCreateDeps(false);
    await runCreateProvider(VALID, ok.deps);
    expect(ok.calls.creating).toEqual([true, false]);

    requestMock.mockRejectedValueOnce(new ApiError(500, 'boom'));
    const fail = makeCreateDeps(false);
    await runCreateProvider(VALID, fail.deps);
    expect(fail.calls.creating).toEqual([true, false]);
  });

  // negative(시작 정리) — 발사 직후 진행 표시 on + 직전 error 즉시 비움을 지연 resolve 로 캡처한다
  // (재조회 도착 전 상태에서 crash 없음). 해소 후 재조회 bump + 입력 초기화 + 진행 off.
  it('발사 직후 진행 표시 on + 직전 error 를 즉시 비운다 (negative — 시작 정리/재조회 전 안전)', async () => {
    let resolvePost: () => void = () => {};
    requestMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvePost = resolve;
        }),
    );
    const { deps, calls } = makeCreateDeps(false);
    const pending = runCreateProvider(VALID, deps);
    expect(calls.creating).toEqual([true]);
    expect(calls.error).toEqual([undefined]);
    expect(calls.bump).toBe(0);
    expect(calls.reset).toBe(0);
    resolvePost();
    await pending;
    expect(calls.bump).toBe(1);
    expect(calls.reset).toBe(1);
    expect(calls.creating).toEqual([true, false]);
  });

  // negative — 실패 후 재시도(재클릭)는 직전 error 를 비우고 정상 재발화한다(시작 비움 → 성공 bump).
  it('실패 후 재시도(재클릭)는 직전 error 를 비우고 정상 재발화한다 (negative — 실패 후 재시도)', async () => {
    requestMock.mockRejectedValueOnce(new ApiError(500, 'boom'));
    const first = makeCreateDeps(false);
    await runCreateProvider(VALID, first.deps);
    expect(first.calls.error).toEqual([undefined, 'HTTP 500: boom']);
    expect(first.calls.bump).toBe(0);

    requestMock.mockResolvedValueOnce(undefined);
    const second = makeCreateDeps(false);
    await runCreateProvider(VALID, second.deps);
    expect(second.calls.error).toEqual([undefined]);
    expect(second.calls.bump).toBe(1);
  });

  // negative(잘못된 응답 shape) — request 가 예상 밖 값(예: null)로 resolve 해도 성공 경로로 처리하고
  // (응답 body 를 소비하지 않으므로) 재조회 bump + 입력 초기화 + throw 없음이 유지된다.
  it('request 가 예상 밖 값(null)으로 resolve 해도 성공 경로로 안전 처리한다 (negative — 응답 shape 무관)', async () => {
    requestMock.mockResolvedValue(null);
    const { deps, calls } = makeCreateDeps(false);
    await expect(runCreateProvider(VALID, deps)).resolves.toBeUndefined();
    expect(calls.bump).toBe(1);
    expect(calls.reset).toBe(1);
    expect(calls.error).toEqual([undefined]);
  });
});

// R-112 — T-1137 provider 수정 실 PATCH update mutation 본체(runUpdateProvider) 검증. jsdom/렌더러
// 없이 mutation 본체를 직접 호출하고(runCreateProvider 와 동일 convention), apiClient.request mock
// 으로 method/path/body 를 단언하며 성공/실패 분기 응답을 주입한다. 상태 전이는 record harness 의
// 콜백 호출로 관찰한다. happy/error/branch/negative 예외 분기마다 각 1+ cover. 부분 갱신 semantics
// (빈 필드는 body 제외, apiKey 빈값 시작→입력 시에만 포함)와 secret apiKey 미노출을 별도 negative 로 검증한다.
describe('AdminView — provider 수정 실 PATCH update mutation (T-1137 runUpdateProvider)', () => {
  // 수정 폼 4 필드 기본 입력값(prefill 후 provider/endpointUrl/modelId 는 현재 값, apiKey 는 빈 값
  // 시작) — 각 test 가 필요 시 일부만 덮어 부분 갱신·빈값 분기를 만든다. 기본은 apiKey 를 빈 값으로
  // 둬 read never-back(입력 시에만 포함) 경로를 default 로 검증한다.
  const PREFILLED: UpdateProviderFields = {
    provider: 'openai',
    endpointUrl: 'https://api.openai.com/v1',
    apiKey: '',
    modelId: 'gpt-4o',
  };

  // 상태 전이를 기록하는 deps harness — updating 초기값·편집 대상 id·request mock 을 주입받아
  // setUpdating/setUpdateError 호출과 bumpRefresh·closeEdit 호출 횟수를 모두 순서대로 캡처한다.
  function makeUpdateDeps(updating: boolean, id = 'cfg1') {
    const calls = {
      updating: [] as boolean[],
      error: [] as (string | undefined)[],
      bump: 0,
      close: 0,
    };
    const deps: UpdateProviderDeps = {
      update: (...args: unknown[]) => requestMock(...args),
      describeError: (e: unknown) => {
        // toErrorMessage stub 과 정합 — ApiError.status → 문구.
        if (e instanceof ApiError) {
          return e.status === 0
            ? `네트워크 오류: ${e.message}`
            : `HTTP ${e.status}: ${e.message}`;
        }
        return '알 수 없는 오류';
      },
      id,
      updating,
      setUpdating: (next) => calls.updating.push(next),
      setUpdateError: (next) => calls.error.push(next),
      bumpRefresh: () => {
        calls.bump += 1;
      },
      closeEdit: () => {
        calls.close += 1;
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

  // happy-path — update 트리거 시 request 가 PATCH /api/llm/providers/:id 로 method PATCH + body
  // (변경 필드만, apiKey 빈값이라 제외)인 인자로 정확히 호출되고, 성공 후 재조회 nonce bump(1 회) +
  // 편집 종료(closeEdit 1 회) + error 미설정(시작 비움만) + 진행 표시 on→off 로 해제된다.
  it('PATCH /api/llm/providers/:id 를 method PATCH + 변경 필드만 body 로 호출하고 성공 시 nonce bump + 편집 종료 한다 (happy-path)', async () => {
    requestMock.mockResolvedValue(undefined); // 200 OK.
    const { deps, calls } = makeUpdateDeps(false, 'cfg1');
    await runUpdateProvider(PREFILLED, deps);
    expect(requestMock).toHaveBeenCalledTimes(1);
    const [path, options] = requestMock.mock.calls[0] as [
      string,
      { method: string; body: string },
    ];
    expect(path).toBe('/api/llm/providers/cfg1');
    expect(options.method).toBe('PATCH');
    // apiKey 는 빈 값이라 body 에서 제외(부분 갱신 — 기존 ciphertext 유지).
    expect(JSON.parse(options.body)).toEqual({
      provider: 'openai',
      endpointUrl: 'https://api.openai.com/v1',
      modelId: 'gpt-4o',
    });
    expect(calls.bump).toBe(1);
    expect(calls.close).toBe(1);
    expect(calls.error).toEqual([undefined]);
    expect(calls.updating).toEqual([true, false]);
  });

  // branch(apiKey 포함) — apiKey 를 입력하면 body 에 포함된다(교체 semantics — 빈값 제외의 반대 분기).
  it('apiKey 를 입력하면 body 에 포함해 발사한다 (branch — apiKey 입력 시 body 포함)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps } = makeUpdateDeps(false, 'cfg1');
    await runUpdateProvider({ ...PREFILLED, apiKey: 'sk-new-key' }, deps);
    const [, options] = requestMock.mock.calls[0] as [string, { body: string }];
    expect(JSON.parse(options.body)).toEqual({
      provider: 'openai',
      endpointUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-new-key',
      modelId: 'gpt-4o',
    });
  });

  // error path — PATCH 400(검증 실패) 시 error 문구 표면화·throw 없음·nonce 미증가·편집 종료 미호출(편집 유지).
  it('update 400(검증 실패) 시 error 문구를 표면화하고 nonce·편집 상태를 건드리지 않는다 (error path — 400)', async () => {
    requestMock.mockRejectedValue(new ApiError(400, 'Bad Request'));
    const { deps, calls } = makeUpdateDeps(false);
    await expect(runUpdateProvider(PREFILLED, deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 400: Bad Request']);
    expect(calls.bump).toBe(0);
    expect(calls.close).toBe(0);
    expect(calls.updating).toEqual([true, false]);
  });

  // error path — 403(Admin+ 미만) 도 동일 안전 경로(throw 없음).
  it('update 403(Admin+ 미만) 실패 시 안전 문구를 표면화한다 (error path — 403)', async () => {
    requestMock.mockRejectedValue(new ApiError(403, 'Forbidden'));
    const { deps, calls } = makeUpdateDeps(false);
    await expect(runUpdateProvider(PREFILLED, deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 403: Forbidden']);
    expect(calls.bump).toBe(0);
    expect(calls.close).toBe(0);
  });

  // error path — 404(미존재 row) 실패 시 동일 안전 경로.
  it('update 404(미존재 row) 실패 시 안전 문구를 표면화한다 (error path — 404)', async () => {
    requestMock.mockRejectedValue(new ApiError(404, 'Not Found'));
    const { deps, calls } = makeUpdateDeps(false, 'ghost');
    await expect(runUpdateProvider(PREFILLED, deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 404: Not Found']);
    expect(calls.bump).toBe(0);
    expect(calls.close).toBe(0);
  });

  // error path — 네트워크 실패(ApiError(0)) 시 네트워크 오류 문구(throw 없음).
  it('update 네트워크 실패(ApiError 0) 시 네트워크 오류 문구를 표면화한다 (error path — 네트워크)', async () => {
    requestMock.mockRejectedValue(new ApiError(0, 'fetch failed'));
    const { deps, calls } = makeUpdateDeps(false);
    await expect(runUpdateProvider(PREFILLED, deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, '네트워크 오류: fetch failed']);
    expect(calls.bump).toBe(0);
  });

  // branch(a) — 빈/공백/falsy id 는 PATCH 미발사·state 불변(잘못된 path 회피). 경계값 각각 cover.
  it('빈/공백/falsy id 는 PATCH 를 발사하지 않는다 (branch (a) — id 가드)', async () => {
    for (const badId of ['', '   ']) {
      requestMock.mockReset();
      const { deps, calls } = makeUpdateDeps(false, badId);
      await expect(runUpdateProvider(PREFILLED, deps)).resolves.toBeUndefined();
      expect(requestMock).not.toHaveBeenCalled();
      expect(calls.updating).toEqual([]);
      expect(calls.bump).toBe(0);
    }
    // undefined id 도 안전(런타임 비정상 입력 방어). harness 기본 param 을 우회해 id 를 직접 undefined 로.
    requestMock.mockReset();
    const { deps, calls } = makeUpdateDeps(false);
    (deps as unknown as { id: unknown }).id = undefined;
    await expect(runUpdateProvider(PREFILLED, deps)).resolves.toBeUndefined();
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.updating).toEqual([]);
  });

  // branch(b) — 이전 update 미완(updating=true) 중 재호출은 PATCH 미발사·state 불변(이중 PATCH 차단).
  it('이전 update 미완(updating=true) 중 재호출은 PATCH 를 발사하지 않는다 (branch (b) — 이중 PATCH 가드)', async () => {
    const { deps, calls } = makeUpdateDeps(true); // 이미 in-flight.
    await runUpdateProvider(PREFILLED, deps);
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.updating).toEqual([]);
    expect(calls.error).toEqual([]);
    expect(calls.bump).toBe(0);
  });

  // branch(c) — 변경 필드 0(4 필드 전부 빈/공백)이면 PATCH 미발사(빈 body 회피).
  it('4 필드 전부 빈/공백이면 변경 필드 0 이라 PATCH 를 발사하지 않는다 (branch (c) — 빈 body 가드)', async () => {
    const { deps, calls } = makeUpdateDeps(false);
    await expect(
      runUpdateProvider(
        { provider: '  ', endpointUrl: '', apiKey: '   ', modelId: '' },
        deps,
      ),
    ).resolves.toBeUndefined();
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.updating).toEqual([]);
    expect(calls.bump).toBe(0);
    expect(calls.close).toBe(0);
  });

  // negative(부분 갱신) — 일부 필드만 채워도 채워진 필드만 body 에 실린다(나머지는 부재 → backend 미변경).
  it('일부 필드만 채우면 채워진 필드만 body 에 싣는다 (negative — 부분 갱신 semantics)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps } = makeUpdateDeps(false, 'cfg1');
    await runUpdateProvider(
      { provider: '', endpointUrl: '', apiKey: '', modelId: 'gpt-4o-mini' },
      deps,
    );
    const [, options] = requestMock.mock.calls[0] as [string, { body: string }];
    // modelId 만 변경 → body 에 modelId 만(나머지 3 필드 부재).
    expect(JSON.parse(options.body)).toEqual({ modelId: 'gpt-4o-mini' });
  });

  // negative(trim 정규화) — 각 필드 앞뒤 공백은 trim 되어 body 에 실린다(공백 정규화).
  it('각 필드 앞뒤 공백을 trim 해 body 에 싣는다 (negative — trim 정규화)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps } = makeUpdateDeps(false, 'cfg1');
    await runUpdateProvider(
      {
        provider: '  anthropic  ',
        endpointUrl: '  https://y  ',
        apiKey: '  sk-2  ',
        modelId: '  m2  ',
      },
      deps,
    );
    const [, options] = requestMock.mock.calls[0] as [string, { body: string }];
    expect(JSON.parse(options.body)).toEqual({
      provider: 'anthropic',
      endpointUrl: 'https://y',
      apiKey: 'sk-2',
      modelId: 'm2',
    });
  });

  // negative(id 인코딩) — 비정상 문자가 든 id 는 encodeURIComponent 로 안전 인코딩된다(path 손상 방지).
  it('id 를 encodeURIComponent 로 안전 인코딩해 path 를 만든다 (negative — id 인코딩)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps } = makeUpdateDeps(false, 'cfg 1/x');
    await runUpdateProvider(PREFILLED, deps);
    expect(requestMock.mock.calls[0]?.[0]).toBe('/api/llm/providers/cfg%201%2Fx');
  });

  // negative(secret 미노출) — 실패 시 error 문구에 apiKey 평문이 절대 포함되지 않는다(secret 유출 방어).
  it('실패 시 error 문구에 apiKey 평문이 포함되지 않는다 (negative — secret 미노출)', async () => {
    requestMock.mockRejectedValue(new ApiError(400, 'Bad Request'));
    const { deps, calls } = makeUpdateDeps(false);
    await runUpdateProvider({ ...PREFILLED, apiKey: 'sk-super-secret' }, deps);
    for (const msg of calls.error) {
      expect(msg ?? '').not.toContain('sk-super-secret');
    }
  });

  // negative(성공 후 편집 종료 / 실패 후 편집 유지) — closeEdit 호출 유무로 편집 상태 전이를 대비 검증.
  it('성공 시 편집을 종료하고 실패 시 편집을 유지한다 (negative — 편집 상태 전이)', async () => {
    requestMock.mockResolvedValueOnce(undefined);
    const ok = makeUpdateDeps(false);
    await runUpdateProvider(PREFILLED, ok.deps);
    expect(ok.calls.close).toBe(1);

    requestMock.mockRejectedValueOnce(new ApiError(409, 'Conflict'));
    const fail = makeUpdateDeps(false);
    await runUpdateProvider(PREFILLED, fail.deps);
    expect(fail.calls.close).toBe(0);
  });

  // negative(진행 해제) — 성공·실패 어느 경로든 finally 가 setUpdating(false) 로 진행 표시를 복구한다.
  it('성공·실패 어느 경우든 진행 표시(updating)가 finally 로 해제된다 (negative — 진행 해제)', async () => {
    requestMock.mockResolvedValueOnce(undefined);
    const ok = makeUpdateDeps(false);
    await runUpdateProvider(PREFILLED, ok.deps);
    expect(ok.calls.updating).toEqual([true, false]);

    requestMock.mockRejectedValueOnce(new ApiError(500, 'boom'));
    const fail = makeUpdateDeps(false);
    await runUpdateProvider(PREFILLED, fail.deps);
    expect(fail.calls.updating).toEqual([true, false]);
  });

  // negative(시작 정리/재조회 전 안전) — 발사 직후 진행 표시 on + 직전 error 즉시 비움을 지연 resolve
  // 로 캡처한다(재조회 도착 전 상태에서 crash 없음). 해소 후 재조회 bump + 편집 종료 + 진행 off.
  it('발사 직후 진행 표시 on + 직전 error 를 즉시 비운다 (negative — 시작 정리/재조회 전 안전)', async () => {
    let resolvePatch: () => void = () => {};
    requestMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvePatch = resolve;
        }),
    );
    const { deps, calls } = makeUpdateDeps(false);
    const pending = runUpdateProvider(PREFILLED, deps);
    expect(calls.updating).toEqual([true]);
    expect(calls.error).toEqual([undefined]);
    expect(calls.bump).toBe(0);
    expect(calls.close).toBe(0);
    resolvePatch();
    await pending;
    expect(calls.bump).toBe(1);
    expect(calls.close).toBe(1);
    expect(calls.updating).toEqual([true, false]);
  });

  // negative(실패 후 재시도) — 실패 후 재발화는 직전 error 를 비우고 정상 재발화한다(시작 비움 → 성공 bump).
  it('실패 후 재시도는 직전 error 를 비우고 정상 재발화한다 (negative — 실패 후 재시도)', async () => {
    requestMock.mockRejectedValueOnce(new ApiError(500, 'boom'));
    const first = makeUpdateDeps(false);
    await runUpdateProvider(PREFILLED, first.deps);
    expect(first.calls.error).toEqual([undefined, 'HTTP 500: boom']);
    expect(first.calls.bump).toBe(0);

    requestMock.mockResolvedValueOnce(undefined);
    const second = makeUpdateDeps(false);
    await runUpdateProvider(PREFILLED, second.deps);
    expect(second.calls.error).toEqual([undefined]);
    expect(second.calls.bump).toBe(1);
  });

  // negative(응답 shape 무관) — request 가 예상 밖 값(null)으로 resolve 해도 성공 경로로 안전 처리한다.
  it('request 가 예상 밖 값(null)으로 resolve 해도 성공 경로로 안전 처리한다 (negative — 응답 shape 무관)', async () => {
    requestMock.mockResolvedValue(null);
    const { deps, calls } = makeUpdateDeps(false);
    await expect(runUpdateProvider(PREFILLED, deps)).resolves.toBeUndefined();
    expect(calls.bump).toBe(1);
    expect(calls.close).toBe(1);
    expect(calls.error).toEqual([undefined]);
  });

  // branch(c') — 정상 발사 시 PATCH 1 회만(중복 없음).
  it('정상 발사 시 PATCH 를 1 회만 호출한다 (branch — 단일 발사)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps } = makeUpdateDeps(false, 'cfg1');
    await runUpdateProvider(PREFILLED, deps);
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(requestMock.mock.calls[0]?.[0]).toBe('/api/llm/providers/cfg1');
  });
});

// R-112 — T-1130 onRemove 배선 렌더 검증. onRemove 전달 시 GroupMemberList 가 각 멤버 행에 제거
// 버튼(제거 라벨)을 렌더함을 정적 markup 으로 단언한다(클릭→콜백 호출 자체는 위 runRemove 단위
// test + GroupMemberList 컴포넌트 test 가 cover — 본 파일은 jsdom 미사용 정적 렌더라 이벤트 비검증).
// 멤버가 없거나 loading/error 분기에서는 버튼이 미렌더됨(GroupMemberList 분기)도 함께 확인한다.
describe('AdminView — onRemove 제거 버튼 배선 (정적 렌더, T-1130)', () => {
  beforeEach(() => {
    useApiResourceMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('그룹 선택 시 각 멤버 행에 제거 버튼을 렌더한다 (happy-path — onRemove 전달)', () => {
    setResource({ data: SAMPLE, loading: false, error: undefined }, MEMBERS_OK_G1);
    const html = renderToStaticMarkup(<AdminView initialSelectedGroupId="g1" />);
    // 멤버 목록(<ul>) + 각 행 제거 버튼(제거 라벨) 렌더 — g1 은 2 멤버라 제거 버튼 2 개.
    expect(html).toContain('<ul>');
    expect(html).toContain('제거');
    const buttonCount = html.split('제거').length - 1;
    expect(buttonCount).toBe(2);
  });

  it('membership 0 건이면 제거 버튼을 렌더하지 않는다 (negative — 빈 목록)', () => {
    setResource(
      { data: SAMPLE, loading: false, error: undefined },
      { data: [], loading: false, error: undefined },
    );
    const html = renderToStaticMarkup(<AdminView initialSelectedGroupId="g1" />);
    // 빈 상태 문구만, 제거 버튼 미렌더. 멤버 목록 <ul> 도 미렌더 — 전체 <ul> 이 정확히 1개
    // (그룹 목록뿐)임으로 판별한다(T-1148 GroupList <ul> 공존 대응).
    expect(html).toContain('이 그룹에 속한 인원이 없습니다');
    expect(html).not.toContain('제거');
    expect(html.split('<ul>').length - 1).toBe(1);
  });

  it('멤버십 loading 중에는 제거 버튼을 렌더하지 않는다 (negative — loading 우선)', () => {
    setResource({ data: SAMPLE, loading: false, error: undefined }, MEMBERS_LOADING);
    const html = renderToStaticMarkup(<AdminView initialSelectedGroupId="g1" />);
    // loading 우선 — 로딩 문구만, 제거 버튼 미렌더.
    expect(html).toContain('불러오는 중…');
    expect(html).not.toContain('제거');
  });

  // T-1131 — 멤버 추가 컨트롤 렌더. 그룹 선택 시 personId 입력 + "추가" 버튼이 컨테이너에 렌더된다
  // (GroupMemberList 는 수정 0 — add 컨트롤은 컨테이너 소유). 그룹 미선택 시 입력은 disabled.
  it('그룹 선택 시 personId 입력 + 추가 버튼을 렌더하고 미선택 시 입력을 비활성으로 렌더한다 (T-1131 add 컨트롤)', () => {
    setResource(
      { data: SAMPLE, loading: false, error: undefined },
      { data: [], loading: false, error: undefined },
    );
    const selected = renderToStaticMarkup(
      <AdminView initialSelectedGroupId="g1" />,
    );
    // personId 입력 + "추가" 버튼 노출. 빈 입력이라 버튼은 disabled(발사 억제).
    expect(selected).toContain('aria-label="추가할 멤버 personId"');
    expect(selected).toContain('추가');
    expect(selected).toContain('disabled');
    // 그룹 미선택 — 입력은 존재하되 disabled(잘못된 path·발사 억제 가드).
    const unselected = renderToStaticMarkup(<AdminView />);
    expect(unselected).toContain('aria-label="추가할 멤버 personId"');
    expect(unselected).toContain('disabled');
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

// R-112 — T-1134 LlmProviderConfigList 마운트 배선 검증. 기존 providerData 재사용(새 fetch 0)
// → deriveProviderConfigs 파생 → props 배선까지를 renderToStaticMarkup 정적 렌더로 단언한다.
// happy/error/loading/undefined/비-Admin gating 등 예외 상황을 각 1+ cover 한다.
describe('AdminView — LLM provider 설정 목록 패널 마운트 (T-1134)', () => {
  // provider 2 건 샘플 — 첫 건은 modelId/endpointUrl 전 필드, 둘째는 선택 필드 누락(생략 검증).
  // endpointUrl 은 LlmProviderConfigList 고유 렌더라 다른 패널과 겹치지 않는 discriminator 다.
  const CONFIG_ROWS: LlmProviderRow[] = [
    {
      id: 'cfg1',
      provider: 'openai',
      modelId: 'gpt-4o',
      endpointUrl: 'https://api.openai.com/v1',
    },
    { id: 'cfg2', provider: 'anthropic' },
  ];
  // 문자열 등장 횟수 카운터 — 빈 상태 문구가 여러 패널에 공유될 때 마운트 존재를 구분한다.
  const countOccurrences = (haystack: string, needle: string) =>
    haystack.split(needle).length - 1;

  beforeEach(() => {
    useApiResourceMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-path — provider 배열 주입 시 각 provider 행(provider/modelId/endpointUrl)이 표시된다.
  it('provider 조회 성공 시 각 provider 행을 읽기 전용 목록으로 표시한다 (happy-path)', () => {
    setRoutes({
      [GROUPS]: { data: [], loading: false, error: undefined },
      [PROVIDERS]: { data: CONFIG_ROWS, loading: false, error: undefined },
      [MAPPINGS]: { data: [], loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    // provider 라벨 + modelId + endpointUrl(고유) 표시 — LlmProviderConfigList 의 <li><span> 렌더.
    expect(html).toContain('<span>openai</span>');
    expect(html).toContain('<span>gpt-4o</span>');
    expect(html).toContain('https://api.openai.com/v1');
    // endpointUrl/modelId 없는 두 번째 provider 도 provider 라벨은 표시(누락 필드 생략, throw 없음).
    expect(html).toContain('<span>anthropic</span>');
  });

  // error path — provider 조회 error 시 LlmProviderConfigList 가 error(role=alert)를 렌더한다.
  // providers 빈 상태에서 DifficultyModelSelector 는 빈 상태 status 를 내므로 alert 유일 출처는 본 패널.
  it('provider 조회 error 시 목록 패널이 error alert 를 안전 표시한다 (error path)', () => {
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
    expect(html).toContain('role="alert"');
    expect(html).toContain('HTTP 403: Forbidden');
  });

  // flow/branch — providerData undefined(조회 전/누락) → 빈 목록 파생 → 빈 상태 문구 렌더.
  it('providerData undefined 이면 빈 목록으로 파생해 빈 상태 문구를 렌더한다 (flow/branch — undefined)', () => {
    setRoutes({
      [GROUPS]: { data: [], loading: false, error: undefined },
      [PROVIDERS]: { data: undefined, loading: false, error: undefined },
      [MAPPINGS]: { data: [], loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    // DifficultyModelSelector + LlmProviderConfigList 둘 다 빈 상태 문구 → 2 회 이상 등장(마운트 존재).
    expect(
      countOccurrences(html, '등록된 LLM provider 가 없습니다'),
    ).toBeGreaterThanOrEqual(2);
  });

  // negative — 비-Admin(isAdmin=false)이면 Admin 전용 패널을 마운트하지 않는다(목록 패널 경계).
  it('비-Admin 등급이면 provider 목록 패널을 마운트하지 않는다 (negative — gating 경계)', () => {
    setRoutes({
      [GROUPS]: { data: [], loading: false, error: undefined },
      [PROVIDERS]: { data: CONFIG_ROWS, loading: false, error: undefined },
      [MAPPINGS]: { data: [], loading: false, error: undefined },
      [AUTH_ME]: { data: { role: 'User' }, loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    // provider 행(endpointUrl·provider span)이 노출되지 않음 — 패널 미마운트(fail-closed).
    expect(html).not.toContain('https://api.openai.com/v1');
    expect(html).not.toContain('<span>openai</span>');
  });

  // negative — loading 중에는 목록 대신 진행 표시(loading 우선 정책 — props 전달 확인).
  it('provider 조회 loading 중 목록 패널이 진행 표시를 렌더한다 (negative — loading 우선)', () => {
    setRoutes({
      [GROUPS]: { data: [], loading: false, error: undefined },
      [PROVIDERS]: { data: undefined, loading: true, error: undefined },
      [MAPPINGS]: { data: [], loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    // 불러오는 중 문구 표시 + loading 중엔 provider 행 미렌더.
    expect(html).toContain('불러오는 중…');
    expect(html).not.toContain('<span>openai</span>');
  });

  // happy-path(T-1135) — Admin + provider 목록이 있으면 각 행에 삭제 버튼(onDelete=handleDeleteProvider
  // 배선)이 provider 수만큼 렌더된다. DifficultyModelSelector 는 삭제 버튼을 렌더하지 않으므로 삭제
  // 라벨 버튼의 유일 출처는 provider 목록 패널이다.
  it('Admin + provider 목록이 있으면 각 행에 삭제 버튼을 렌더한다 (happy-path — onDelete 배선, T-1135)', () => {
    setRoutes({
      [GROUPS]: { data: [], loading: false, error: undefined },
      [PROVIDERS]: { data: CONFIG_ROWS, loading: false, error: undefined },
      [MAPPINGS]: { data: [], loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    // 삭제 버튼이 provider 수만큼 렌더된다(provider 라벨과 함께).
    expect(html).toContain('삭제');
    expect(countOccurrences(html, '>삭제</button>')).toBe(CONFIG_ROWS.length);
  });
});

// R-112 — T-1136 provider 생성 폼(4 controlled input + "provider 추가" 버튼) 배선 렌더 검증.
// Admin 등급에서 폼이 마운트되고 4 필드 aria-label + 생성 버튼이 렌더됨을 정적 markup 으로 단언한다
// (클릭→러너 호출 자체는 위 runCreateProvider 단위 test 가 cover — 본 파일은 jsdom 미사용 정적
// 렌더라 이벤트 비검증). apiKey 는 type="password" 로 렌더되고, 비-Admin 에선 폼이 미마운트됨도 확인.
describe('AdminView — provider 생성 폼 배선 (정적 렌더, T-1136)', () => {
  beforeEach(() => {
    useApiResourceMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-path — Admin 등급이면 4 필드 input(aria-label) + "provider 추가" 버튼이 마운트된다.
  it('Admin 등급이면 4 필드 input + "provider 추가" 버튼을 렌더한다 (happy-path)', () => {
    setRoutes({
      [GROUPS]: { data: [], loading: false, error: undefined },
      [PROVIDERS]: { data: [], loading: false, error: undefined },
      [MAPPINGS]: { data: [], loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toContain('aria-label="생성할 provider"');
    expect(html).toContain('aria-label="생성할 provider endpointUrl"');
    expect(html).toContain('aria-label="생성할 provider apiKey"');
    expect(html).toContain('aria-label="생성할 provider modelId"');
    expect(html).toContain('provider 추가</button>');
  });

  // negative(secret input) — apiKey 필드는 type="password" 로 렌더돼 화면 노출을 줄인다.
  it('apiKey 필드는 type="password" 로 렌더된다 (negative — secret input)', () => {
    setRoutes({
      [GROUPS]: { data: [], loading: false, error: undefined },
      [PROVIDERS]: { data: [], loading: false, error: undefined },
      [MAPPINGS]: { data: [], loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    // apiKey input 이 password 타입임을 단언(aria-label 인접 type 속성).
    expect(html).toMatch(
      /aria-label="생성할 provider apiKey"[^>]*type="password"|type="password"[^>]*aria-label="생성할 provider apiKey"/,
    );
  });

  // negative(gating 경계) — 비-Admin 등급이면 생성 폼을 마운트하지 않는다(fail-closed).
  it('비-Admin 등급이면 생성 폼을 마운트하지 않는다 (negative — gating 경계)', () => {
    setRoutes({
      [GROUPS]: { data: [], loading: false, error: undefined },
      [PROVIDERS]: { data: [], loading: false, error: undefined },
      [MAPPINGS]: { data: [], loading: false, error: undefined },
      [AUTH_ME]: { data: { role: 'User' }, loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).not.toContain('aria-label="생성할 provider"');
    expect(html).not.toContain('provider 추가</button>');
  });

  // branch — 빈 필드(초기 마운트)면 생성 버튼이 disabled 로 렌더된다(빈 필드 발사 억제 UI 반영).
  it('초기(빈 필드) 마운트 시 생성 버튼이 disabled 로 렌더된다 (branch — 빈 필드 버튼 비활성)', () => {
    setRoutes({
      [GROUPS]: { data: [], loading: false, error: undefined },
      [PROVIDERS]: { data: [], loading: false, error: undefined },
      [MAPPINGS]: { data: [], loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    // "provider 추가" 버튼이 disabled 속성과 함께 렌더된다(빈 필드 4 개 → 버튼 비활성).
    expect(html).toMatch(/<button[^>]*disabled[^>]*>provider 추가<\/button>/);
  });
});

// R-112 — T-1137 provider 수정 배선 렌더 검증. Admin 등급에서 목록 각 행에 "수정" 버튼(onEdit=
// handleEditProvider 배선)이 마운트되고, 초기(편집 미시작, editingProviderId=null)엔 인라인 수정 폼이
// 미렌더됨을 정적 markup 으로 단언한다(클릭→prefill·러너 호출 자체는 위 runUpdateProvider 단위 test +
// LlmProviderConfigList 컴포넌트 onEdit test 가 cover — 본 파일은 jsdom 미사용 정적 렌더라 이벤트
// 비검증). 비-Admin 에선 목록 패널·수정 버튼이 미마운트됨도 확인한다.
describe('AdminView — provider 수정 배선 (정적 렌더, T-1137)', () => {
  const CONFIG_ROWS: LlmProviderRow[] = [
    { id: 'cfg1', provider: 'openai', modelId: 'gpt-4o' },
    { id: 'cfg2', provider: 'anthropic', modelId: 'claude-3' },
  ];
  const countOccurrences = (haystack: string, needle: string) =>
    haystack.split(needle).length - 1;

  beforeEach(() => {
    useApiResourceMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-path — Admin + provider 목록이 있으면 각 행에 "수정" 버튼(onEdit 배선)이 provider 수만큼 렌더된다.
  it('Admin + provider 목록이 있으면 각 행에 수정 버튼을 렌더한다 (happy-path — onEdit 배선)', () => {
    setRoutes({
      [GROUPS]: { data: [], loading: false, error: undefined },
      [PROVIDERS]: { data: CONFIG_ROWS, loading: false, error: undefined },
      [MAPPINGS]: { data: [], loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toContain('수정');
    // "수정" 버튼이 provider 수만큼 렌더된다(삭제 버튼과 별개).
    expect(countOccurrences(html, '>수정</button>')).toBe(CONFIG_ROWS.length);
  });

  // branch — 초기(편집 미시작)엔 인라인 수정 폼(수정 전용 aria-label input)이 미렌더된다(editingProviderId=null).
  it('초기(편집 미시작)엔 인라인 수정 폼을 렌더하지 않는다 (branch — editingProviderId=null)', () => {
    setRoutes({
      [GROUPS]: { data: [], loading: false, error: undefined },
      [PROVIDERS]: { data: CONFIG_ROWS, loading: false, error: undefined },
      [MAPPINGS]: { data: [], loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    // 수정 폼 전용 input aria-label 은 편집 시작 전에는 등장하지 않는다.
    expect(html).not.toContain('aria-label="수정할 provider"');
    expect(html).not.toContain('provider 수정</button>');
  });

  // negative(gating 경계) — 비-Admin 등급이면 목록 패널·수정 버튼을 마운트하지 않는다(fail-closed).
  it('비-Admin 등급이면 수정 버튼을 마운트하지 않는다 (negative — gating 경계)', () => {
    setRoutes({
      [GROUPS]: { data: [], loading: false, error: undefined },
      [PROVIDERS]: { data: CONFIG_ROWS, loading: false, error: undefined },
      [MAPPINGS]: { data: [], loading: false, error: undefined },
      [AUTH_ME]: { data: { role: 'User' }, loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).not.toContain('>수정</button>');
  });
});

// R-112 — T-1138 provider 입력 5-provider select constraint 검증. 생성·수정 폼의 provider 입력이
// free-text 가 아니라 5-provider <select> 로 constrain 됨을 (1) LLM_PROVIDER_OPTIONS 상수 정합
// (2) resolveProviderSelectValue 순수 helper 의 분기(지원값→그대로 / 미지원·빈값→placeholder
// fallback) (3) 정적 렌더 markup 에 select+option 이 등장하고 provider text input 은 사라짐
// (4) 선택값이 runCreateProvider/runUpdateProvider 를 통해 POST/PATCH body 로 그대로 전달됨,
// 네 축으로 단언한다. jsdom 미사용 정적 렌더 harness 라 select onChange 이벤트 자체는 순수 helper +
// mutation 러너로 대체 검증한다(기존 T-1136/T-1137 convention 정합).
describe('AdminView — provider 5-provider select constraint (T-1138)', () => {
  // canonical allowlist — src/llm/llm-gateway.interface.ts LlmProvider(R-99~103) 5 멤버.
  const CANONICAL_PROVIDERS = [
    'custom',
    'azure_openai',
    'anthropic',
    'google_gemini',
    'openai',
  ];

  beforeEach(() => {
    useApiResourceMock.mockReset();
    requestMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 상수 정합 — LLM_PROVIDER_OPTIONS 의 value 집합이 canonical allowlist 와 정확히 일치한다
  // (누락·초과·오타 방지 — server enum 과의 수동 동기 회귀 가드).
  it('LLM_PROVIDER_OPTIONS 는 canonical 5-provider allowlist 와 정확히 일치한다 (상수 정합)', () => {
    expect(LLM_PROVIDER_OPTIONS.map((o) => o.value)).toEqual(
      CANONICAL_PROVIDERS,
    );
    // 각 option 은 비어있지 않은 사람-친화 라벨을 갖는다.
    for (const option of LLM_PROVIDER_OPTIONS) {
      expect(option.label.length).toBeGreaterThan(0);
    }
  });

  // branch (a) — resolveProviderSelectValue 는 5 개 중 하나인 값을 그대로 반환한다(그 option 선택).
  it('지원 provider 값은 그대로 반환한다 (branch (a) — 5 개 중 하나 → 선택 유지)', () => {
    for (const value of CANONICAL_PROVIDERS) {
      expect(resolveProviderSelectValue(value)).toBe(value);
    }
  });

  // branch (b) — 목록에 없는 레거시/비정상 값은 빈 문자열(placeholder fallback)로 좁힌다.
  it('미지원(레거시/비정상) provider 값은 placeholder(빈 문자열)로 fallback 한다 (branch (b) — 목록 밖 → placeholder)', () => {
    expect(resolveProviderSelectValue('legacy_provider')).toBe('');
    expect(resolveProviderSelectValue('OpenAI')).toBe(''); // 대소문자 불일치도 미매칭.
    expect(resolveProviderSelectValue('gpt-4o')).toBe('');
  });

  // negative — 빈/undefined/공백 입력도 placeholder 로 안전 fallback(throw 없이).
  it('빈·undefined·공백 값은 placeholder 로 fallback 한다 (negative — 빈/누락 입력)', () => {
    expect(resolveProviderSelectValue('')).toBe('');
    expect(resolveProviderSelectValue(undefined)).toBe('');
    expect(resolveProviderSelectValue('   ')).toBe('');
  });

  // 정적 렌더 — 생성 폼의 provider 입력이 <select aria-label="생성할 provider"> 로 렌더되고 5 개
  // provider option 값 + placeholder 라벨을 포함하며, 더 이상 free-text input 이 아니다.
  it('생성 폼 provider 입력을 5-provider option select 로 렌더한다 (정적 렌더 — 지원 외 값 제출 봉쇄)', () => {
    setRoutes({
      [GROUPS]: { data: [], loading: false, error: undefined },
      [PROVIDERS]: { data: [], loading: false, error: undefined },
      [MAPPINGS]: { data: [], loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    // select 로 렌더(aria-label 유지) + provider free-text input 은 사라짐.
    expect(html).toContain('<select aria-label="생성할 provider"');
    expect(html).not.toMatch(
      /aria-label="생성할 provider"[^>]*type="text"|type="text"[^>]*aria-label="생성할 provider"/,
    );
    // 5 개 provider option 값이 모두 등장(지원 외 값은 option 부재로 제출 봉쇄).
    for (const value of CANONICAL_PROVIDERS) {
      expect(html).toContain(`value="${value}"`);
    }
    // placeholder(빈 value) option 도 선두에 렌더된다(미선택 시 생성 가드 발화).
    expect(html).toContain('provider 선택</option>');
  });

  // 정적 렌더(초기 placeholder 가드) — 빈 provider 선택 상태로는 생성 버튼이 disabled 라 POST 가
  // 발사되지 않는다(placeholder 빈 value → !providerInput.trim() 가드 그대로 발화).
  it('placeholder(빈 provider) 상태에선 생성 버튼이 disabled 다 (error path — 빈 선택 가드)', () => {
    setRoutes({
      [GROUPS]: { data: [], loading: false, error: undefined },
      [PROVIDERS]: { data: [], loading: false, error: undefined },
      [MAPPINGS]: { data: [], loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toMatch(/<button[^>]*disabled[^>]*>provider 추가<\/button>/);
  });

  // happy-path(생성 body 전달) — select 로 고른 각 지원 provider 값이 그대로 POST body 의
  // provider 로 전달된다(5 값 모두 iterate — 값 왜곡 없음). deps 는 경량 record harness.
  it('select 로 고른 지원 provider 값이 POST body 의 provider 로 전달된다 (happy-path — 생성)', async () => {
    for (const value of CANONICAL_PROVIDERS) {
      requestMock.mockReset();
      requestMock.mockResolvedValue(undefined);
      const deps: CreateProviderDeps = {
        create: (...args: unknown[]) => requestMock(...args),
        describeError: () => '오류',
        creating: false,
        setCreating: () => {},
        setCreateError: () => {},
        bumpRefresh: () => {},
        resetInput: () => {},
      };
      await runCreateProvider(
        {
          provider: value,
          endpointUrl: 'https://x',
          apiKey: 'sk-1',
          modelId: 'm1',
        },
        deps,
      );
      const [, options] = requestMock.mock.calls[0] as [
        string,
        { body: string },
      ];
      expect(JSON.parse(options.body).provider).toBe(value);
    }
  });

  // happy-path(수정 body 반영) — 수정 폼 select 로 고른 provider 값이 PATCH body 에 반영된다.
  it('select 로 고른 지원 provider 값이 PATCH body 의 provider 로 반영된다 (happy-path — 수정)', async () => {
    requestMock.mockResolvedValue(undefined);
    const deps: UpdateProviderDeps = {
      update: (...args: unknown[]) => requestMock(...args),
      describeError: () => '오류',
      id: 'cfg1',
      updating: false,
      setUpdating: () => {},
      setUpdateError: () => {},
      bumpRefresh: () => {},
      closeEdit: () => {},
    };
    await runUpdateProvider(
      {
        provider: 'anthropic',
        endpointUrl: 'https://x',
        apiKey: '',
        modelId: 'm1',
      },
      deps,
    );
    const [, options] = requestMock.mock.calls[0] as [string, { body: string }];
    expect(JSON.parse(options.body).provider).toBe('anthropic');
  });

  // negative(수정 미변경 유지) — 수정 폼 provider 를 바꾸지 않으면 기존 값이 그대로 PATCH body 에
  // 실린다(runUpdateProvider 의 부분 갱신 semantics — provider 필드는 비어있지 않으면 항상 포함).
  it('수정 폼 provider 를 바꾸지 않으면 기존 값을 그대로 유지해 발사한다 (negative — 미변경 유지)', async () => {
    requestMock.mockReset();
    requestMock.mockResolvedValue(undefined);
    const deps: UpdateProviderDeps = {
      update: (...args: unknown[]) => requestMock(...args),
      describeError: () => '오류',
      id: 'cfg2',
      updating: false,
      setUpdating: () => {},
      setUpdateError: () => {},
      bumpRefresh: () => {},
      closeEdit: () => {},
    };
    // prefill 된 기존 값(openai)을 그대로 두고 발사 — body 에 동일 값이 실린다.
    await runUpdateProvider(
      {
        provider: 'openai',
        endpointUrl: 'https://api.openai.com/v1',
        apiKey: '',
        modelId: 'gpt-4o',
      },
      deps,
    );
    const [, options] = requestMock.mock.calls[0] as [string, { body: string }];
    expect(JSON.parse(options.body).provider).toBe('openai');
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

  // deriveProviderConfigs(T-1134) — happy(전 필드) + 선택 필드 누락 생략 + id/provider fallback
  // + 빈 배열/비배열 안전. LlmProviderConfigList 의 읽기 전용 view 계약 정합을 각 분기 cover.
  it('deriveProviderConfigs 가 row 를 LlmProviderConfigRow[] 로 매핑하고 선택 필드 누락/비배열을 안전 처리한다 (helper)', () => {
    // happy — id/provider 필수 + modelId/endpointUrl 있으면 매핑.
    const full = deriveProviderConfigs([
      {
        id: 'cfg1',
        provider: 'openai',
        modelId: 'gpt-4o',
        endpointUrl: 'https://api.openai.com/v1',
      },
    ]);
    expect(full[0]).toEqual({
      id: 'cfg1',
      provider: 'openai',
      modelId: 'gpt-4o',
      endpointUrl: 'https://api.openai.com/v1',
    });

    // negative — modelId/endpointUrl 누락 row 는 두 선택 키를 생략(id/provider 만).
    const partial = deriveProviderConfigs([{ id: 'cfg2', provider: 'anthropic' }]);
    expect(partial[0]).toEqual({ id: 'cfg2', provider: 'anthropic' });
    expect(partial[0]).not.toHaveProperty('modelId');
    expect(partial[0]).not.toHaveProperty('endpointUrl');

    // negative — 빈 문자열 modelId/endpointUrl 도 falsy 라 생략(경계값).
    const blank = deriveProviderConfigs([
      { id: 'cfg3', provider: 'x', modelId: '', endpointUrl: '' },
    ]);
    expect(blank[0]).toEqual({ id: 'cfg3', provider: 'x' });

    // negative — id 누락 row 는 index 기반 합성 key(p1), provider 누락은 빈 문자열.
    const noId = deriveProviderConfigs([{ modelId: 'm' }]);
    expect(noId[0]).toEqual({ id: 'p1', provider: '', modelId: 'm' });

    // negative — 빈 배열/undefined/비배열 입력은 빈 배열(throw 없이).
    expect(deriveProviderConfigs([])).toEqual([]);
    expect(deriveProviderConfigs(undefined)).toEqual([]);
    expect(deriveProviderConfigs(null as unknown as undefined)).toEqual([]);
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

  // buildProvidersPath(T-1135) — nonce 0 은 깨끗한 base path(T-1134 초기 마운트와 동일), 1+ 는
  // cache-busting `_r` query 부착. buildMappingsPath 동형.
  it('buildProvidersPath 가 nonce 0 은 깨끗한 path, 1+ 는 _r query 를 부착한다 (helper, T-1135)', () => {
    expect(buildProvidersPath(0)).toBe('/api/llm/providers');
    expect(buildProvidersPath(1)).toBe('/api/llm/providers?_r=1');
    expect(buildProvidersPath(3)).toBe('/api/llm/providers?_r=3');
    // negative — 음수 nonce 도 깨끗한 path(0 이하 가드).
    expect(buildProvidersPath(-2)).toBe('/api/llm/providers');
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
  it('POST /api/admin/import 를 FormData(선택 File 동봉) body 로 정확히 호출하고 성공 시 응답 ImportJob 의 id·status·mode 상세 message 를 설정한다 (happy-path)', async () => {
    // 응답은 생성된 ImportJob(id / status(PENDING) / mode) — 그 상세를 문구로 표면화한다(T-1132).
    requestMock.mockResolvedValue({
      id: 'job-42',
      status: 'PENDING',
      mode: 'REPLACE',
    });
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
    // 성공 → 응답 ImportJob 의 id·status·mode 를 포함한 상세 message 표면화(정적 '가져오기 완료' 아님).
    expect(calls.message).toEqual([
      undefined,
      '가져오기 요청됨 — job job-42, 상태 PENDING, 모드 REPLACE',
    ]);
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

  // flow/branch(b) — 응답이 객체이나 id 부재(기대 shape 아님) → 상세 합성 불가, IMPORT_DONE_TEXT
  // fallback. runImport 경유로 정적 완료 문구가 표면화됨을 확인(방어적 narrowing 통합 회귀).
  it('응답이 객체이나 id 부재이면 IMPORT_DONE_TEXT 로 fallback 한다 (flow/branch — id 없는 응답)', async () => {
    requestMock.mockResolvedValue({ status: 'PENDING', mode: 'REPLACE' });
    const { deps, calls } = makeImportDeps(false);
    await runImport(sampleFile(), deps);
    expect(calls.message).toEqual([undefined, '가져오기 완료']);
    expect(calls.error).toEqual([undefined]);
  });

  // flow/branch(c) — status·mode 부재(id 만 존재)여도 안전하게 id 만 담은 상세 문구를 합성한다
  // (부분 정보 표시 — 누락 필드 생략). runImport 경유 통합 확인.
  it('id 만 있고 status·mode 부재이면 id 만 담은 상세 문구를 합성한다 (flow/branch — 부분 필드)', async () => {
    requestMock.mockResolvedValue({ id: 'job-7' });
    const { deps, calls } = makeImportDeps(false);
    await runImport(sampleFile(), deps);
    expect(calls.message).toEqual([undefined, '가져오기 요청됨 — job job-7']);
  });
});

// R-112 — formatImportJobDetail 순수 helper 직접 검증(T-1132). backend POST 응답(ImportJob)을
// 사람-친화 상세 문구로 합성하되, 기대 shape 아니면 정적 IMPORT_DONE_TEXT 로 안전 fallback 하는
// 방어적 narrowing 을 happy/branch/negative 각 분기마다 cover 한다. throw · '[object Object]' 노출 0.
describe('AdminView — formatImportJobDetail 상세 문구 합성 helper (T-1132)', () => {
  // happy — id·status·mode 완비 시 셋을 모두 담은 상세 문구를 합성한다(정적 완료 문구 아님).
  it('id·status·mode 완비 응답을 id·status·mode 상세 문구로 합성한다 (happy)', () => {
    expect(
      formatImportJobDetail({ id: 'abc123', status: 'PENDING', mode: 'MERGE' }),
    ).toBe('가져오기 요청됨 — job abc123, 상태 PENDING, 모드 MERGE');
  });

  // branch — status 만 부재(id·mode 존재) → status 생략하고 id·mode 만 표시(누락 필드 생략).
  it('status 부재 시 status 를 생략하고 id·mode 만 표시한다 (branch — status 누락)', () => {
    expect(formatImportJobDetail({ id: 'x1', mode: 'REPLACE' })).toBe(
      '가져오기 요청됨 — job x1, 모드 REPLACE',
    );
  });

  // branch — mode 만 부재(id·status 존재) → mode 생략하고 id·status 만 표시.
  it('mode 부재 시 mode 를 생략하고 id·status 만 표시한다 (branch — mode 누락)', () => {
    expect(formatImportJobDetail({ id: 'x2', status: 'RUNNING' })).toBe(
      '가져오기 요청됨 — job x2, 상태 RUNNING',
    );
  });

  // branch — status·mode 가 비-string(number 등) 이면 노출하지 않는다(타입 방어 — id 만 표시).
  it('status·mode 가 비-string 이면 노출하지 않는다 (branch — 비-string 필드)', () => {
    expect(
      formatImportJobDetail({ id: 'x3', status: 123, mode: {} }),
    ).toBe('가져오기 요청됨 — job x3');
  });

  // negative — 응답 null → fallback(비객체 방어).
  it('응답 null 이면 IMPORT_DONE_TEXT 로 fallback 한다 (negative — null)', () => {
    expect(formatImportJobDetail(null)).toBe('가져오기 완료');
  });

  // negative — 응답 undefined → fallback.
  it('응답 undefined 이면 IMPORT_DONE_TEXT 로 fallback 한다 (negative — undefined)', () => {
    expect(formatImportJobDetail(undefined)).toBe('가져오기 완료');
  });

  // negative — 응답이 string(비객체) → fallback('[object Object]' · throw 없음).
  it('응답이 string 이면 IMPORT_DONE_TEXT 로 fallback 한다 (negative — 비객체 string)', () => {
    expect(formatImportJobDetail('가져오기 완료됨')).toBe('가져오기 완료');
  });

  // negative — 응답이 number(비객체) → fallback.
  it('응답이 number 이면 IMPORT_DONE_TEXT 로 fallback 한다 (negative — 비객체 number)', () => {
    expect(formatImportJobDetail(42)).toBe('가져오기 완료');
  });

  // negative — id 필드 부재(빈 객체) → 상세 합성 불가, fallback.
  it('id 필드 부재이면 IMPORT_DONE_TEXT 로 fallback 한다 (negative — id 부재)', () => {
    expect(formatImportJobDetail({})).toBe('가져오기 완료');
  });

  // negative — id 가 비-string(number) → fallback(타입 방어).
  it('id 가 비-string 이면 IMPORT_DONE_TEXT 로 fallback 한다 (negative — id 타입 불일치)', () => {
    expect(formatImportJobDetail({ id: 999, status: 'PENDING' })).toBe(
      '가져오기 완료',
    );
  });

  // negative — id 가 빈 string → 식별자 소비 불가, fallback.
  it('id 가 빈 string 이면 IMPORT_DONE_TEXT 로 fallback 한다 (negative — 빈 id)', () => {
    expect(formatImportJobDetail({ id: '', status: 'PENDING' })).toBe(
      '가져오기 완료',
    );
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

// R-112 — ④h isAdminRole 순수 helper 검증(role 문자열 → Admin+ 여부). backend enum
// ("SuperAdmin"/"Admin"/"User", api.md 71)과 정확히 대소문자까지 매칭하고, 그 외/누락/빈값/
// 소문자(enum 불일치)는 모두 false(fail-closed)다. happy/negative 분기 각 1+ cover(jsdom 불요).
describe('AdminView — isAdminRole (순수 함수, ④h)', () => {
  // happy — backend Admin+ enum 두 값은 true.
  it('Admin/SuperAdmin 등급은 true 를 반환한다 (happy)', () => {
    expect(isAdminRole('Admin')).toBe(true);
    expect(isAdminRole('SuperAdmin')).toBe(true);
  });

  // negative — User 등급은 Admin+ 아님(false).
  it('User 등급은 false 를 반환한다 (negative — 비-Admin)', () => {
    expect(isAdminRole('User')).toBe(false);
  });

  // negative — 누락/null/빈값(조회 전·응답 누락)은 fail-closed 로 false.
  it('undefined/null/빈 문자열(등급 불명)은 fail-closed 로 false 를 반환한다 (negative — 등급 불명)', () => {
    expect(isAdminRole(undefined)).toBe(false);
    expect(isAdminRole(null)).toBe(false);
    expect(isAdminRole('')).toBe(false);
  });

  // negative — 대소문자/오타 enum 불일치(소문자 admin 등)는 false(엄격 매칭 — 권한 오인 방지).
  it('소문자/오타 등 enum 불일치는 false 를 반환한다 (negative — 대소문자 엄격 매칭)', () => {
    expect(isAdminRole('admin')).toBe(false);
    expect(isAdminRole('superadmin')).toBe(false);
    expect(isAdminRole('ADMIN')).toBe(false);
    expect(isAdminRole('Administrator')).toBe(false);
    expect(isAdminRole('Userr')).toBe(false);
  });
});

// R-112 — ④h Admin+ RBAC gating UI 정적 렌더 검증. useApiResource mock 의 auth/me path 응답을
// 등급별로 주입해(Admin/SuperAdmin/User/누락/error/loading) 비-Admin 에게는 Admin 전용 패널
// (DifficultyModelSelector·scope <select>·DataImportExportPanel)이 숨겨지고 권한 부족 안내 한 줄
// (NOT_ADMIN_NOTICE)이 노출되며, Admin 에게는 ④a~④g 패널이 그대로 노출됨을 단언한다. GroupMemberList
// + 그룹 <select> 는 등급 무관 유지(User+ 조회 — gating 대상 아님)를 함께 확인한다.
// happy/error/branch/negative 예외 분기마다 각 1+ cover.
describe('AdminView — Admin+ RBAC gating (④h 정적 렌더)', () => {
  // gating test 의 공통 라우터 — 그룹/LLM/매핑은 데이터 채워두고 auth/me 만 등급별로 주입한다.
  // 이렇게 하면 등급에 따라 Admin 패널 노출/숨김 분기만 격리 검증된다(읽기 배선은 공통 고정).
  function setMe(me: ApiResourceState<unknown>) {
    setRoutes({
      [GROUPS]: { data: SAMPLE, loading: false, error: undefined },
      [PROVIDERS]: { data: PROVIDER_ROWS, loading: false, error: undefined },
      [MAPPINGS]: { data: MAPPING_ROWS, loading: false, error: undefined },
      [AUTH_ME]: me,
    });
  }

  const NOTICE = 'Admin 권한이 필요한 기능입니다';

  beforeEach(() => {
    useApiResourceMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-path — Admin 등급이면 Admin 전용 패널(슬롯 select·scope select·import/export)이 모두
  // 노출되고 권한 부족 안내는 미렌더된다(④a~④g 그대로).
  it('Admin 등급이면 Admin 전용 패널(LLM·scope·import/export)이 모두 노출된다 (happy-path)', () => {
    setMe({ data: { role: 'Admin' }, loading: false, error: undefined });
    const html = renderToStaticMarkup(<AdminView initialSelectedGroupId="g1" />);
    // Admin 전용 패널 노출 — 슬롯 select + scope select + export 버튼 + 파일 입력.
    expect(html).toContain('name="easy"');
    expect(html).toContain('aria-label="export 범위 선택"');
    expect(html).toContain('<button type="button">내보내기</button>');
    expect(html).toContain('<input type="file"');
    // 권한 부족 안내는 미렌더(Admin 분기).
    expect(html).not.toContain(NOTICE);
    // GroupMemberList + 그룹 select 는 등급 무관 노출.
    expect(html).toContain('김철수');
    expect(html).toContain('aria-label="그룹 선택"');
  });

  // happy-path — SuperAdmin 등급도 Admin+ 라 동일하게 패널 노출(enum 두 값 모두 cover).
  it('SuperAdmin 등급도 Admin 전용 패널이 노출된다 (happy-path — SuperAdmin)', () => {
    setMe({ data: { role: 'SuperAdmin' }, loading: false, error: undefined });
    const html = renderToStaticMarkup(<AdminView initialSelectedGroupId="g1" />);
    expect(html).toContain('name="easy"');
    expect(html).toContain('aria-label="export 범위 선택"');
    expect(html).not.toContain(NOTICE);
  });

  // flow/branch — User 등급이면 Admin 전용 패널이 숨겨지고 권한 부족 안내 한 줄이 노출된다.
  it('User 등급이면 Admin 전용 패널이 숨겨지고 권한 부족 안내가 노출된다 (flow/branch — 비-Admin 숨김)', () => {
    setMe({ data: { role: 'User' }, loading: false, error: undefined });
    const html = renderToStaticMarkup(<AdminView initialSelectedGroupId="g1" />);
    // Admin 전용 패널 전부 미렌더(마운트 0).
    expect(html).not.toContain('name="easy"');
    expect(html).not.toContain('aria-label="export 범위 선택"');
    expect(html).not.toContain('<button type="button">내보내기</button>');
    expect(html).not.toContain('<input type="file"');
    // 권한 부족 안내 한 줄(role="status") 노출.
    expect(html).toContain(NOTICE);
    expect(html).toContain('role="status"');
    // GroupMemberList + 그룹 select 는 User+ 조회라 등급 무관 유지(gating 대상 아님).
    expect(html).toContain('김철수');
    expect(html).toContain('aria-label="그룹 선택"');
  });

  // error path — auth/me 조회 실패(error) 시 isAdmin=false fail-closed → Admin 패널 숨김 +
  // 안내(throw 없음). 등급 source 가 끊겨도 안전하게 비-Admin 으로 떨어진다.
  it('auth/me 조회 error 시 fail-closed 로 Admin 패널을 숨기고 안내한다 (error path — 조회 실패)', () => {
    setMe({ data: undefined, loading: false, error: 'HTTP 500: me boom' });
    const html = renderToStaticMarkup(<AdminView initialSelectedGroupId="g1" />);
    // fail-closed — Admin 패널 숨김 + 안내, throw 없이 안전 렌더.
    expect(html).not.toContain('name="easy"');
    expect(html).toContain(NOTICE);
    // 그룹 패널은 등급 무관 유지.
    expect(html).toContain('김철수');
  });

  // error path — role 필드 누락/비정상 응답(role 없음·null)도 fail-closed 로 false 처리.
  it('role 필드 누락/null 응답도 fail-closed 로 Admin 패널을 숨긴다 (error path — 응답 누락)', () => {
    // role 키 자체 누락.
    setMe({ data: {}, loading: false, error: undefined });
    expect(
      renderToStaticMarkup(<AdminView initialSelectedGroupId="g1" />),
    ).toContain(NOTICE);
    // role null.
    setMe({ data: { role: null }, loading: false, error: undefined });
    const htmlNull = renderToStaticMarkup(
      <AdminView initialSelectedGroupId="g1" />,
    );
    expect(htmlNull).toContain(NOTICE);
    expect(htmlNull).not.toContain('name="easy"');
  });

  // flow/branch(loading) — 등급 조회 중(meLoading=true)에는 fail-closed 로 Admin 패널 숨김
  // (안정화 후 노출 — 깜빡임 최소). 등급 미확정이라 stale-Admin 노출 없음.
  it('등급 조회 중(loading)에는 fail-closed 로 Admin 패널을 숨긴다 (flow/branch — loading 숨김)', () => {
    setMe({ data: undefined, loading: true, error: undefined });
    const html = renderToStaticMarkup(<AdminView initialSelectedGroupId="g1" />);
    // loading 중 Admin 패널 미렌더 + 안내 표시(fail-closed).
    expect(html).not.toContain('name="easy"');
    expect(html).not.toContain('aria-label="export 범위 선택"');
    expect(html).toContain(NOTICE);
  });

  // negative — loading 중 응답이 Admin 으로 도착하더라도 loading=true 이면 미노출(stale-Admin
  // 노출 방지). loading 완료 후 같은 Admin 응답이면 노출되는 전이를 두 렌더로 확인한다.
  it('loading=true 중에는 Admin 응답이 와도 미노출, loading 완료 후 노출된다 (negative — loading→확정 전이)', () => {
    // loading 중 — data 에 Admin 이 실려 있어도 meLoading=true 라 fail-closed 로 숨김.
    setMe({ data: { role: 'Admin' }, loading: true, error: undefined });
    const loadingHtml = renderToStaticMarkup(
      <AdminView initialSelectedGroupId="g1" />,
    );
    expect(loadingHtml).not.toContain('name="easy"');
    expect(loadingHtml).toContain(NOTICE);
    // loading 완료(false) + 같은 Admin 응답 — 이제 Admin 패널 노출(안정화 후 노출).
    setMe({ data: { role: 'Admin' }, loading: false, error: undefined });
    const settledHtml = renderToStaticMarkup(
      <AdminView initialSelectedGroupId="g1" />,
    );
    expect(settledHtml).toContain('name="easy"');
    expect(settledHtml).not.toContain(NOTICE);
  });

  // negative — 비-Admin(User) 에서도 GroupMemberList + 그룹 select 는 노출 유지(User+ 조회 —
  // gating 대상 아님). 그룹 멤버/select 가 등급과 무관함을 명시 단언한다.
  it('비-Admin 에서도 GroupMemberList + 그룹 select 는 노출 유지된다 (negative — User+ 조회 비-gating)', () => {
    setMe({ data: { role: 'User' }, loading: false, error: undefined });
    const html = renderToStaticMarkup(<AdminView initialSelectedGroupId="g2" />);
    // g2(프론트팀)의 멤버 + 그룹 select 는 등급 무관 노출(Admin 패널만 숨김).
    expect(html).toContain('박민수');
    expect(html).toContain('aria-label="그룹 선택"');
    expect(html).toContain('프론트팀');
    // Admin 전용 패널은 숨김.
    expect(html).not.toContain('aria-label="export 범위 선택"');
  });
});

// ==========================================================================================
// R-112 — T-0885 SchedulePanel 배선 검증. P6 deferred wiring 재개(PLAN line120/123). 다섯 번째
// 패널 SchedulePanel 을 AdminView 컨테이너에 mount + GET/PUT /api/schedules + POST trigger 배선.
// 렌더 test(정적 렌더 — 마운트/GET 상태/busy 억제/cron 값 흐름)와 순수 러너 test(runApply/
// runTrigger — PUT/POST body·성공/실패·이중 발사 가드)로 happy/error/branch/negative 를 각 1+ cover.
// ==========================================================================================

const SCHEDULES = '/api/schedules';
const SCHEDULE_TRIGGER = '/api/schedules/trigger';
const DEFAULT_SCHEDULE = 'daily-evaluation';
const APPLY_DONE = '스케줄 주기를 적용했습니다';
const TRIGGER_DONE = '수동 실행을 시작했습니다';
const SCHEDULE_LOADING = '스케줄 정보를 불러오는 중…';
const NO_SCHEDULE = '등록된 스케줄이 없습니다';
const SCHEDULE_BUSY_TEXT = '적용 중…'; // SchedulePanel 의 BUSY_TEXT(busy 우선 표시).
const TRIGGER_LABEL = '지금 실행'; // SchedulePanel 의 manual trigger 버튼 기본 라벨.

// GET /api/schedules 응답을 명시 주입하고 나머지 path 는 기존 default(그룹 EMPTY_OK, auth/me
// ADMIN_ME_OK)로 두는 setter — 스케줄 렌더 test 용(Admin 등급 default 라 패널 마운트 보장).
function setSchedules(state: ApiResourceState<unknown>) {
  useApiResourceMock.mockImplementation((path: string) => {
    if (path === SCHEDULES) {
      return state;
    }
    if (path === AUTH_ME) {
      return ADMIN_ME_OK;
    }
    return EMPTY_OK;
  });
}

describe('AdminView — SchedulePanel 배선 렌더 (T-0885)', () => {
  beforeEach(() => {
    useApiResourceMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-path(mount + GET) — GET 성공 시 SchedulePanel 이 실제 mount 되고(cron 입력 + 적용/실행
  // 버튼), 등록 schedule name 목록이 message 로 요약 노출된다(미마운트→마운트 회귀 검증).
  it('GET 성공 시 SchedulePanel 이 마운트되고 등록 스케줄 목록을 message 로 노출한다 (happy-path — mount+GET)', () => {
    setSchedules({
      data: [DEFAULT_SCHEDULE, 'weekly-report'],
      loading: false,
      error: undefined,
    });
    const html = renderToStaticMarkup(<AdminView />);
    // 패널 마운트 — cron 주기 입력 label + manual trigger 버튼.
    expect(html).toContain('cron 주기');
    expect(html).toContain(TRIGGER_LABEL);
    // 등록 스케줄 목록이 message(role="status")로 요약 노출.
    expect(html).toContain(`등록된 스케줄: ${DEFAULT_SCHEDULE}, weekly-report`);
    // 기존 패널 회귀 0 — 그룹 select 도 함께 렌더(추가만).
    expect(html).toContain('aria-label="그룹 선택"');
  });

  // flow/branch(cron 값 흐름) — 컨테이너 cron state(initialCronExpression 주입)가 패널 입력 value
  // 로 흐르고, onCronChange 배선으로 입력이 활성(비-readonly)이다(controlled lift-up 왕복 배선).
  it('컨테이너 cron state 가 패널 입력 value 로 흐르고 onCronChange 배선으로 입력이 활성이다 (flow/branch — cron 변경 배선)', () => {
    setSchedules({ data: [], loading: false, error: undefined });
    const html = renderToStaticMarkup(
      <AdminView initialCronExpression="0 9 * * *" />,
    );
    // 주입한 cron 값이 패널 입력 value 로 흐른다(컨테이너 → 패널 controlled).
    expect(html).toContain('value="0 9 * * *"');
    // onCronChange 가 배선돼 입력이 활성(readonly/disabled 미부착 = self-close 직후 종료).
    expect(html).toContain('value="0 9 * * *"/>');
    expect(html).not.toContain('readonly');
  });

  // flow/branch(빈 목록) — GET 이 빈 배열(등록 0 건)이어도 crash 없이 빈 상태 안내를 message 로
  // 노출하고 패널은 정상 마운트(버튼 활성)한다.
  it('GET 이 빈 배열이면 빈 상태 안내를 노출하고 패널은 정상 마운트한다 (flow/branch — 빈 스케줄 목록)', () => {
    setSchedules({ data: [], loading: false, error: undefined });
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toContain(NO_SCHEDULE);
    // 빈 목록이어도 패널 컨트롤은 렌더(마운트 유지).
    expect(html).toContain(TRIGGER_LABEL);
  });

  // negative(loading 초기) — GET 진행 중(loading=true) 초기 상태에서 crash 없이 로딩 안내를
  // message 로 노출하고, busy=false 라 컨트롤은 정상 렌더(초기 loading 안전 렌더).
  it('GET loading 초기 상태에서 crash 없이 로딩 안내를 노출하고 컨트롤을 렌더한다 (negative — loading 초기 렌더)', () => {
    setSchedules({ data: undefined, loading: true, error: undefined });
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toContain(SCHEDULE_LOADING);
    // busy 는 mutation 전용이라 loading 중에도 컨트롤 노출(진행 표시 억제 아님).
    expect(html).toContain(TRIGGER_LABEL);
  });

  // error path(GET 실패) — GET 403/실패 시 error props 로 패널이 alert 를 안전 표시한다(throw 없음).
  it('GET 실패(403) 시 패널이 error alert 를 안전 표시한다 (error path — GET 실패)', () => {
    setSchedules({
      data: undefined,
      loading: false,
      error: 'HTTP 403: Forbidden',
    });
    const html = renderToStaticMarkup(<AdminView />);
    // busy=false + error truthy → 패널이 alert 분기 렌더(SchedulePanel 박제).
    expect(html).toContain('role="alert"');
    expect(html).toContain('HTTP 403: Forbidden');
    // error 분기라 cron 입력·버튼은 미렌더(패널이 alert 만).
    expect(html).not.toContain('cron 주기');
  });

  // flow/branch(busy 억제) — apply/trigger in-flight(scheduleBusy=true) 중에는 패널이 진행 표시를
  // 우선하고 입력·버튼을 억제한다(중복 트리거 원천 차단 — busy 우선 정책).
  it('busy in-flight 중에는 진행 표시를 우선하고 컨트롤을 억제한다 (flow/branch — busy 억제)', () => {
    setSchedules({ data: [DEFAULT_SCHEDULE], loading: false, error: undefined });
    const html = renderToStaticMarkup(<AdminView initialScheduleBusy />);
    // busy 우선 — 진행 문구만 렌더.
    expect(html).toContain(SCHEDULE_BUSY_TEXT);
    // manual trigger 버튼 억제(busy=true 면 컨트롤 미렌더 → 이중 트리거 차단).
    expect(html).not.toContain(TRIGGER_LABEL);
  });
});

// R-112 — T-0885 onApply 실 PUT mutation 본체(runApply) + onManualTrigger POST(runTrigger) 검증.
// jsdom/렌더러 없이 mutation 본체를 직접 호출하고(④c runAssign / ④e runImport 동일 convention),
// apiClient.request mock 으로 method/path/body 를 단언하며 성공/실패 분기 응답을 주입한다. 상태
// 전이는 record harness 로 관찰한다. happy/error/branch/negative 예외 분기마다 각 1+ cover.
describe('AdminView — onApply/onManualTrigger 실 mutation (T-0885 runApply/runTrigger)', () => {
  // 상태 전이를 기록하는 deps harness — busy 초기값과 request mock 을 주입받아 setBusy/setError/
  // setMessage 호출을 모두 캡처한다(makeExportDeps 동형).
  function makeDeps(busy: boolean) {
    const calls = {
      busy: [] as boolean[],
      error: [] as (string | undefined)[],
      message: [] as (string | undefined)[],
    };
    const deps: ScheduleMutationDeps = {
      request: (...args: unknown[]) => requestMock(...args),
      describeError: (e: unknown) => {
        // toErrorMessage stub 과 정합 — ApiError.status → 문구.
        if (e instanceof ApiError) {
          return e.status === 0
            ? `네트워크 오류: ${e.message}`
            : `HTTP ${e.status}: ${e.message}`;
        }
        return '알 수 없는 오류';
      },
      busy,
      setBusy: (next) => calls.busy.push(next),
      setError: (next) => calls.error.push(next),
      setMessage: (next) => calls.message.push(next),
    };
    return { deps, calls };
  }

  beforeEach(() => {
    requestMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-path(apply) — runApply 호출 시 request 가 PUT /api/schedules + body {name:<default>,
  // cronExpression} 로 정확히 호출되고, 성공 후 완료 message 가 설정되며 busy on→off 순서.
  it('PUT /api/schedules 를 default name + cron 식 body 로 호출하고 성공 시 완료 message (happy-path — apply)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps, calls } = makeDeps(false);
    await runApply('0 9 * * *', deps);
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(requestMock).toHaveBeenCalledWith(SCHEDULES, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: DEFAULT_SCHEDULE,
        cronExpression: '0 9 * * *',
      }),
    });
    // 성공 → 시작 시 message 비움(undefined) + 완료 안내 설정.
    expect(calls.message).toEqual([undefined, APPLY_DONE]);
    // busy on→off + error 비움(실패 문구 미설정).
    expect(calls.busy).toEqual([true, false]);
    expect(calls.error).toEqual([undefined]);
  });

  // happy-path(trigger) — runTrigger 호출 시 request 가 POST /api/schedules/trigger(body 없음)로
  // 호출되고 성공 후 완료 message 설정.
  it('POST /api/schedules/trigger 를 body 없이 호출하고 성공 시 완료 message (happy-path — trigger)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps, calls } = makeDeps(false);
    await runTrigger(deps);
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(requestMock).toHaveBeenCalledWith(SCHEDULE_TRIGGER, {
      method: 'POST',
    });
    expect(calls.message).toEqual([undefined, TRIGGER_DONE]);
    expect(calls.busy).toEqual([true, false]);
    expect(calls.error).toEqual([undefined]);
  });

  // error path(apply 400) — 유효하지 않은 cron 식 400 시 안전 문구 표면화(throw 없음) + message 미설정.
  it('PUT 400(유효하지 않은 cron 식) 실패 시 안전 문구를 표면화한다 (error path — apply 400)', async () => {
    requestMock.mockRejectedValue(new ApiError(400, 'invalid cron expression'));
    const { deps, calls } = makeDeps(false);
    await expect(runApply('bad cron', deps)).resolves.toBeUndefined();
    // 시작 message 비움만 + 완료 미설정, error 문구 표면화.
    expect(calls.message).toEqual([undefined]);
    expect(calls.error).toEqual([undefined, 'HTTP 400: invalid cron expression']);
    expect(calls.busy).toEqual([true, false]);
  });

  // error path(apply 403) — Admin+ 미만 403 도 동일 안전 경로로 문구 표면화(throw 없음).
  it('PUT 403(Admin+ 미만) 실패 시 안전 문구를 표면화한다 (error path — apply 403)', async () => {
    requestMock.mockRejectedValue(new ApiError(403, 'Forbidden'));
    const { deps, calls } = makeDeps(false);
    await expect(runApply('0 9 * * *', deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 403: Forbidden']);
  });

  // error path(apply 네트워크) — 네트워크 실패(ApiError 0) 시 네트워크 오류 문구(throw 없음).
  it('PUT 네트워크 실패(ApiError 0) 시 네트워크 오류 문구를 표면화한다 (error path — apply 네트워크)', async () => {
    requestMock.mockRejectedValue(new ApiError(0, 'fetch failed'));
    const { deps, calls } = makeDeps(false);
    await expect(runApply('0 9 * * *', deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, '네트워크 오류: fetch failed']);
  });

  // error path(trigger 실패) — POST trigger 500 실패 시 안전 문구 표면화(throw 없음).
  it('POST trigger 500 실패 시 안전 문구를 표면화한다 (error path — trigger 실패)', async () => {
    requestMock.mockRejectedValue(new ApiError(500, 'boom'));
    const { deps, calls } = makeDeps(false);
    await expect(runTrigger(deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 500: boom']);
    expect(calls.busy).toEqual([true, false]);
  });

  // negative(빈 cron apply) — 빈/falsy cronExpression 으로 apply 시 PUT 미발사(발사 억제 구현 택1).
  it('빈 cronExpression 으로 apply 시 PUT 을 발사하지 않는다 (negative — 빈 cron 발사 억제)', async () => {
    const empty = makeDeps(false);
    await runApply('', empty.deps);
    expect(requestMock).not.toHaveBeenCalled();
    // 어떤 state 전이도 없음(가드로 즉시 return).
    expect(empty.calls.busy).toEqual([]);
    expect(empty.calls.message).toEqual([]);
  });

  // negative(apply 이중 발사 가드) — 이전 apply/trigger 미완(busy=true) 중 재호출은 PUT 미발사.
  it('busy(in-flight) 중 apply 재호출은 PUT 을 발사하지 않는다 (negative — apply 이중 발사 가드)', async () => {
    const { deps, calls } = makeDeps(true); // 이미 in-flight.
    await runApply('0 9 * * *', deps);
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.busy).toEqual([]);
  });

  // negative(trigger 이중 발사 가드) — busy=true 중 trigger 재호출은 POST 미발사.
  it('busy(in-flight) 중 trigger 재호출은 POST 를 발사하지 않는다 (negative — trigger 이중 발사 가드)', async () => {
    const { deps, calls } = makeDeps(true);
    await runTrigger(deps);
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.busy).toEqual([]);
  });

  // flow/branch(진행 해제) — 성공·실패 어느 경우든 busy 가 finally 로 해제됨(중복 트리거 방지 불변).
  it('성공·실패 어느 경우든 busy 가 finally 로 해제된다 (flow/branch — 진행 해제)', async () => {
    requestMock.mockResolvedValueOnce(undefined);
    const ok = makeDeps(false);
    await runApply('0 9 * * *', ok.deps);
    expect(ok.calls.busy).toEqual([true, false]);

    requestMock.mockRejectedValueOnce(new ApiError(400, 'bad'));
    const fail = makeDeps(false);
    await runApply('0 9 * * *', fail.deps);
    expect(fail.calls.busy).toEqual([true, false]);
  });
});

// R-112 — T-0885 신규 순수 helper(deriveScheduleMessage) 검증. mutation 우선 / loading / 빈 목록
// / 이름 목록 요약 / 비배열 안전 처리 등 분기를 각 1+ cover(negative 예외 분기마다).
describe('AdminView — deriveScheduleMessage (순수 함수, T-0885)', () => {
  it('mutation 완료 안내가 있으면 GET 상태보다 우선한다 (branch — mutation 우선)', () => {
    // apply/trigger 완료 안내가 최신 피드백이라 목록·loading 보다 우선.
    expect(deriveScheduleMessage(['a', 'b'], false, APPLY_DONE)).toBe(APPLY_DONE);
    expect(deriveScheduleMessage(undefined, true, TRIGGER_DONE)).toBe(
      TRIGGER_DONE,
    );
  });

  it('mutation 없고 loading 중이면 로딩 안내를 낸다 (branch — loading)', () => {
    expect(deriveScheduleMessage(undefined, true, undefined)).toBe(
      SCHEDULE_LOADING,
    );
  });

  it('등록 1+ 건이면 이름 목록을 요약한다 (happy)', () => {
    expect(deriveScheduleMessage([DEFAULT_SCHEDULE], false, undefined)).toBe(
      `등록된 스케줄: ${DEFAULT_SCHEDULE}`,
    );
    expect(deriveScheduleMessage(['a', 'b', 'c'], false, undefined)).toBe(
      '등록된 스케줄: a, b, c',
    );
  });

  it('빈 배열/비배열/undefined 는 빈 상태 안내를 낸다 (negative — 빈/비정상 입력)', () => {
    expect(deriveScheduleMessage([], false, undefined)).toBe(NO_SCHEDULE);
    expect(deriveScheduleMessage(undefined, false, undefined)).toBe(NO_SCHEDULE);
    expect(
      deriveScheduleMessage(null as unknown as string[], false, undefined),
    ).toBe(NO_SCHEDULE);
  });
});

// R-112 — T-0886 ReEvaluationTriggerPanel 배선 검증. P6 deferred wiring 완결(PLAN line120/123 —
// T-0885 SchedulePanel 의 짝). 여섯 번째 패널 ReEvaluationTriggerPanel 을 AdminView 컨테이너에
// mount + person 선택(파생 members 재사용) + POST /api/schedules/recent-deletion/:personId 배선.
// 렌더 test(정적 렌더 — 마운트/person 옵션/windows 전달/submitting 억제/경계 days)와 순수 러너
// test(runReEvaluate — POST body·path param·성공/실패·person 미선택·이중 발사 가드)로 happy/error/
// branch/negative 를 각 1+ cover(negative 예외 분기마다).
// ==========================================================================================

const RECENT_DELETION_P1 = '/api/schedules/recent-deletion/p1';
const REEVAL_SUBMITTING_TEXT = '재수집 진행 중…'; // 패널 SUBMITTING_TEXT(submitting 우선 표시).
const REEVAL_TRIGGER_LABEL = '재수집 시작'; // 패널 TRIGGER_LABEL(트리거 버튼 라벨).
const REEVAL_WINDOW_SELECT_LABEL = '재수집 기간'; // 패널 window <select> label.
const PERSON_SELECT_LABEL = '재평가 인원 선택'; // 컨테이너 person <select> aria-label.
const NO_PERSON_PLACEHOLDER = '인원을 선택하세요'; // person <select> placeholder.

describe('AdminView — ReEvaluationTriggerPanel 배선 렌더 (T-0886)', () => {
  beforeEach(() => {
    useApiResourceMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-path(mount) — 그룹 선택 시 파생 members 가 person 옵션으로 노출되고, ReEvaluationTriggerPanel
  // 이 실제 mount 되며(window 선택 + 트리거 버튼), 기존 패널(그룹/스케줄)도 회귀 없이 함께 렌더된다.
  it('그룹 선택 시 person 옵션과 재평가 패널이 마운트된다 (happy-path — mount)', () => {
    setResource({ data: SAMPLE, loading: false, error: undefined });
    const html = renderToStaticMarkup(<AdminView initialSelectedGroupId="g1" />);
    // person 선택 컨트롤 + 파생 members 옵션(선택 그룹 g1 의 김철수/이영희).
    expect(html).toContain(`aria-label="${PERSON_SELECT_LABEL}"`);
    expect(html).toContain(NO_PERSON_PLACEHOLDER);
    expect(html).toContain('김철수');
    expect(html).toContain('이영희');
    // 재평가 패널 마운트 — window 선택 label + 트리거 버튼.
    expect(html).toContain(REEVAL_WINDOW_SELECT_LABEL);
    expect(html).toContain(REEVAL_TRIGGER_LABEL);
    // 기존 패널 회귀 0 — 그룹 select + 스케줄 패널(지금 실행)도 함께 렌더(추가만).
    expect(html).toContain('aria-label="그룹 선택"');
    expect(html).toContain('지금 실행');
  });

  // flow/branch(windows 전달) — frontend-local 재수집 window 후보(최근 1일/1주/30일)가 실제 windows
  // props 로 패널에 전달돼 <select> 옵션으로 렌더된다(windows 배선 검증).
  it('재수집 window 후보가 패널 옵션으로 전달돼 렌더된다 (flow/branch — windows 배선)', () => {
    setResource({ data: SAMPLE, loading: false, error: undefined });
    const html = renderToStaticMarkup(<AdminView initialSelectedGroupId="g1" />);
    // 세 window 후보 라벨이 모두 패널 <select> 옵션으로 렌더(windows props 전달 증명).
    expect(html).toContain('최근 1일');
    expect(html).toContain('최근 1주');
    expect(html).toContain('최근 30일');
    // 패널의 window <select>(name=reevaluation-window)가 렌더됨(컴포넌트 박제 마크업).
    expect(html).toContain('name="reevaluation-window"');
  });

  // flow/branch(submitting 억제) — 재평가 in-flight(reevalSubmitting=true) 중에는 패널이 진행 표시를
  // 우선하고 트리거 컨트롤을 억제한다(이중 트리거 원천 차단 — submitting 우선 정책).
  it('submitting in-flight 중에는 진행 표시를 우선하고 트리거를 억제한다 (flow/branch — submitting 억제)', () => {
    setResource({ data: SAMPLE, loading: false, error: undefined });
    const html = renderToStaticMarkup(
      <AdminView initialSelectedGroupId="g1" initialReevalSubmitting />,
    );
    // submitting 우선 — 진행 문구만 렌더.
    expect(html).toContain(REEVAL_SUBMITTING_TEXT);
    // 트리거 버튼 억제(submitting=true 면 트리거 폼 미렌더 → 이중 트리거 차단).
    expect(html).not.toContain(REEVAL_TRIGGER_LABEL);
  });

  // negative(경계 days) — selectedDays 가 windows 에 없는 경계값(예: 999)이면 패널이 placeholder 로
  // fallback + 트리거 버튼을 비활성(컴포넌트 박제)하고 컨테이너는 crash 없이 렌더한다.
  it('selectedDays 가 windows 에 없어도 crash 없이 트리거 버튼을 비활성 렌더한다 (negative — 경계 days)', () => {
    setResource({ data: SAMPLE, loading: false, error: undefined });
    const html = renderToStaticMarkup(
      <AdminView
        initialSelectedGroupId="g1"
        initialSelectedPersonId="p1"
        initialSelectedDays={999}
      />,
    );
    // 경계값이어도 패널은 마운트(버튼 렌더) — hasSelection=false 라 disabled 부착(컴포넌트 박제).
    expect(html).toContain(REEVAL_TRIGGER_LABEL);
    expect(html).toContain('disabled');
  });

  // negative(초기 안전 렌더) — 그룹/person/days 미선택 초기 상태에서도 crash 없이 패널이 마운트되고
  // person placeholder 만 노출한다(빈 members → 옵션 없이 placeholder — 안전 렌더).
  it('그룹/person 미선택 초기 상태에서 crash 없이 마운트하고 placeholder 를 노출한다 (negative — 초기 안전 렌더)', () => {
    setResource({ data: [], loading: false, error: undefined });
    const html = renderToStaticMarkup(<AdminView />);
    // 그룹 미선택 → members 빈 배열 → person placeholder 만(옵션 없이).
    expect(html).toContain(NO_PERSON_PLACEHOLDER);
    // 패널은 windows 상수를 받아 마운트(person 미선택과 무관 — 패널은 person 을 모른다).
    expect(html).toContain(REEVAL_TRIGGER_LABEL);
  });
});

// R-112 — T-0886 onTrigger 실 POST mutation 본체(runReEvaluate) 검증. jsdom/렌더러 없이 mutation
// 본체를 직접 호출하고(runTrigger 동일 convention), apiClient.request mock 으로 method/path/body 를
// 단언하며 성공/실패 분기 응답을 주입한다. 상태 전이는 record harness 로 관찰한다. happy/error/
// branch/negative 예외 분기마다 각 1+ cover.
describe('AdminView — onTrigger 실 POST 재평가 (T-0886 runReEvaluate)', () => {
  // 상태 전이를 기록하는 deps harness — submitting 초기값과 request mock 을 주입받아 setSubmitting/
  // setError 호출을 모두 캡처한다(makeDeps 동형).
  function makeReevalDeps(submitting: boolean) {
    const calls = {
      submitting: [] as boolean[],
      error: [] as (string | undefined)[],
    };
    const deps: ReEvaluationDeps = {
      post: (...args: unknown[]) => requestMock(...args),
      describeError: (e: unknown) => {
        if (e instanceof ApiError) {
          return e.status === 0
            ? `네트워크 오류: ${e.message}`
            : `HTTP ${e.status}: ${e.message}`;
        }
        return '알 수 없는 오류';
      },
      submitting,
      setSubmitting: (next) => calls.submitting.push(next),
      setError: (next) => calls.error.push(next),
    };
    return { deps, calls };
  }

  beforeEach(() => {
    requestMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-path — runReEvaluate 호출 시 request 가 POST /api/schedules/recent-deletion/:personId +
  // body { instants: [], days } 로 정확히 호출되고, 성공 후 error 없음(시작 비움만) + submitting on→off.
  it('POST recent-deletion 을 { instants: [], days } body 로 선택 personId path 로 호출한다 (happy-path)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps, calls } = makeReevalDeps(false);
    await runReEvaluate('p1', 7, deps);
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(requestMock).toHaveBeenCalledWith(RECENT_DELETION_P1, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instants: [], days: 7 }),
    });
    // 성공 → 시작 시 error 비움(undefined)만, 완료 error 미설정(성공은 error 없음).
    expect(calls.error).toEqual([undefined]);
    // submitting on→off.
    expect(calls.submitting).toEqual([true, false]);
  });

  // 배선(person path param + days 흐름) — 다른 personId/days 선택값이 path param + body.days 로
  // 그대로 흘러간다(선택된 personId 가 POST path param 으로 쓰임 + onSelect→onTrigger days 흐름 검증).
  it('선택된 personId 가 path param 으로, selectedDays 가 body.days 로 흐른다 (branch — person path param + days 흐름)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps } = makeReevalDeps(false);
    await runReEvaluate('p2', 30, deps);
    expect(requestMock).toHaveBeenCalledWith(
      '/api/schedules/recent-deletion/p2',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instants: [], days: 30 }),
      },
    );
  });

  // error path(403) — Admin+ 미만 403 실패 시 안전 문구 표면화(throw 없음) + submitting on→off.
  it('POST 403(Admin+ 미만) 실패 시 안전 문구를 표면화한다 (error path — 403)', async () => {
    requestMock.mockRejectedValue(new ApiError(403, 'Forbidden'));
    const { deps, calls } = makeReevalDeps(false);
    await expect(runReEvaluate('p1', 7, deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 403: Forbidden']);
    expect(calls.submitting).toEqual([true, false]);
  });

  // error path(400) — 잘못된 body 400 실패 시 안전 문구 표면화(throw 없음).
  it('POST 400(잘못된 body) 실패 시 안전 문구를 표면화한다 (error path — 400)', async () => {
    requestMock.mockRejectedValue(new ApiError(400, 'invalid body'));
    const { deps, calls } = makeReevalDeps(false);
    await expect(runReEvaluate('p1', 7, deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 400: invalid body']);
  });

  // error path(404) — 존재하지 않는 person 404 실패 시 안전 문구 표면화(throw 없음).
  it('POST 404 실패 시 안전 문구를 표면화한다 (error path — 404)', async () => {
    requestMock.mockRejectedValue(new ApiError(404, 'Not Found'));
    const { deps, calls } = makeReevalDeps(false);
    await expect(runReEvaluate('p1', 7, deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 404: Not Found']);
  });

  // error path(네트워크) — 네트워크 실패(ApiError 0) 시 네트워크 오류 문구(throw 없음).
  it('POST 네트워크 실패(ApiError 0) 시 네트워크 오류 문구를 표면화한다 (error path — 네트워크)', async () => {
    requestMock.mockRejectedValue(new ApiError(0, 'fetch failed'));
    const { deps, calls } = makeReevalDeps(false);
    await expect(runReEvaluate('p1', 7, deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, '네트워크 오류: fetch failed']);
  });

  // negative(person 미선택) — 빈/falsy personId 로 트리거 시 POST 미발사(발사 억제 — path param 방어).
  it('person 미선택(빈 personId)으로 트리거 시 POST 를 발사하지 않는다 (negative — person 미선택 발사 억제)', async () => {
    const { deps, calls } = makeReevalDeps(false);
    await runReEvaluate('', 7, deps);
    expect(requestMock).not.toHaveBeenCalled();
    // 어떤 state 전이도 없음(가드로 즉시 return).
    expect(calls.submitting).toEqual([]);
    expect(calls.error).toEqual([]);
  });

  // negative(이중 발사 가드) — 이전 재평가 미완(submitting=true) 중 재트리거는 POST 미발사.
  it('submitting(in-flight) 중 재트리거는 POST 를 발사하지 않는다 (negative — 이중 발사 가드)', async () => {
    const { deps, calls } = makeReevalDeps(true); // 이미 in-flight.
    await runReEvaluate('p1', 7, deps);
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.submitting).toEqual([]);
  });

  // flow/branch(진행 해제) — 성공·실패 어느 경우든 submitting 이 finally 로 해제됨(이중 트리거 방지 불변).
  it('성공·실패 어느 경우든 submitting 이 finally 로 해제된다 (flow/branch — 진행 해제)', async () => {
    requestMock.mockResolvedValueOnce(undefined);
    const ok = makeReevalDeps(false);
    await runReEvaluate('p1', 7, ok.deps);
    expect(ok.calls.submitting).toEqual([true, false]);

    requestMock.mockRejectedValueOnce(new ApiError(500, 'boom'));
    const fail = makeReevalDeps(false);
    await runReEvaluate('p1', 7, fail.deps);
    expect(fail.calls.submitting).toEqual([true, false]);
  });
});

// R-112 — T-0886 신규 순수 helper(buildRecentDeletionPath) 검증. path param 부착 + 비정상 문자
// 안전 인코딩 분기를 각 1+ cover.
describe('AdminView — buildRecentDeletionPath (순수 함수, T-0886)', () => {
  it('personId 를 recent-deletion path param 으로 부착한다 (happy)', () => {
    expect(buildRecentDeletionPath('p1')).toBe(RECENT_DELETION_P1);
    expect(buildRecentDeletionPath('abc-123')).toBe(
      '/api/schedules/recent-deletion/abc-123',
    );
  });

  it('비정상 문자가 든 personId 도 안전 인코딩한다 (negative — 특수문자 인코딩)', () => {
    // 공백·슬래시 등이 path 를 깨지 않도록 encodeURIComponent 로 안전 인코딩.
    expect(buildRecentDeletionPath('a b/c')).toBe(
      '/api/schedules/recent-deletion/a%20b%2Fc',
    );
  });
});

// R-112 — T-1142 인원 관리 마운트(GET /api/persons 실 fetch → PersonList props 배선) 검증.
// happy(인원 표면화) / error path(에러 alert + 목록 미렌더) / 분기(loading·빈 배열·populated) /
// negative(data undefined 시 `?? []` throw 없이 렌더, active=false 라벨, partId 없는 행 안전
// 렌더, 다건 표시명 중복 없음)를 각 1+ cover. renderToStaticMarkup + useApiResource mock 으로
// data/loading/error 시나리오를 통제한다(jsdom/@testing-library 미사용 — ADR-0040 §5 게이트).
describe('AdminView — 인원 관리 마운트 (T-1142)', () => {
  const PERSONS = '/api/persons';

  // 인원 2 건 샘플 — Person model(id/fullName/email/active/partId?/createdAt?) 정합.
  // p1 은 active + partId 보유, p2 는 active=false(휴직) + partId 누락(선택 필드 생략 경로).
  const PERSON_ROWS: PersonRow[] = [
    { id: 'pp1', fullName: '김인원', email: 'kim@example.com', active: true, partId: 'part-a' },
    { id: 'pp2', fullName: '이휴직', email: 'lee@example.com', active: false },
  ];

  beforeEach(() => {
    useApiResourceMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-path — 인원 1+ 반환 시 각 인원의 fullName·email·active 라벨이 렌더에 표면화된다.
  it('인원 fetch 성공 시 fullName·email·active 라벨을 목록으로 렌더한다 (happy-path)', () => {
    setRoutes({ [PERSONS]: { data: PERSON_ROWS, loading: false, error: undefined } });
    const html = renderToStaticMarkup(<AdminView />);
    // GET /api/persons 를 정확한 path 로 조회한다.
    const paths = useApiResourceMock.mock.calls.map((c) => c[0]);
    expect(paths).toContain(PERSONS);
    // 인원 관리 섹션 heading + 두 인원의 표시명/이메일이 표면화된다.
    expect(html).toContain('인원 관리');
    expect(html).toContain('김인원');
    expect(html).toContain('kim@example.com');
    expect(html).toContain('이휴직');
    expect(html).toContain('lee@example.com');
    // active=true 는 "활성", active=false 는 "휴직" 라벨로 사람-친화 표시된다.
    expect(html).toContain('활성');
    expect(html).toContain('휴직');
  });

  // error path — fetch 가 error(예: 401)를 반환하면 role="alert" 에러만 렌더하고 목록은 미렌더.
  it('인원 fetch error 시 에러 alert 를 렌더하고 목록(인원명)은 미렌더한다 (error path)', () => {
    setRoutes({
      [PERSONS]: { data: undefined, loading: false, error: 'HTTP 401: persons boom' },
    });
    const html = renderToStaticMarkup(<AdminView />);
    // 에러 문구가 alert 로 표면화된다.
    expect(html).toContain('role="alert"');
    expect(html).toContain('HTTP 401: persons boom');
    // error 분기라 목록(인원 표시명)은 렌더되지 않는다.
    expect(html).not.toContain('김인원');
    expect(html).not.toContain('이휴직');
  });

  // 분기 — loading 중이면 로딩 표면(role="status" + 로딩 문구) 우선, 목록·에러 미렌더.
  it('인원 fetch loading 중이면 로딩 표면을 우선 렌더한다 (분기 — loading)', () => {
    setRoutes({
      [PERSONS]: { data: undefined, loading: true, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toContain('불러오는 중…');
    // loading 우선 — 목록 표시명 미렌더.
    expect(html).not.toContain('김인원');
  });

  // 분기 — 빈 배열이면 빈 상태 문구를 렌더한다(populated 분기와 대비).
  it('인원이 0 건이면 빈 상태 문구를 렌더한다 (분기 — 빈 배열)', () => {
    setRoutes({
      [PERSONS]: { data: [], loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toContain('등록된 인원이 없습니다');
    expect(html).not.toContain('김인원');
  });

  // negative — data 가 undefined(미조회/진행 중 아님, error 없음)여도 `?? []` 로 throw 없이 렌더.
  // (loading=false + error=undefined + data=undefined 경계 — 빈 상태로 안전 fallback.)
  it('data 가 undefined 여도 `?? []` 로 throw 없이 빈 상태를 렌더한다 (negative — undefined 경계)', () => {
    setRoutes({
      [PERSONS]: { data: undefined, loading: false, error: undefined },
    });
    // renderToStaticMarkup 이 throw 하지 않고 빈 상태 문구를 낸다.
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toContain('인원 관리');
    expect(html).toContain('등록된 인원이 없습니다');
  });

  // negative — active=false 인원 단독이면 "휴직" 라벨이 표시되고(상태 라벨 분기), partId 누락
  // 행도 throw 없이 렌더된다(선택 필드 생략 경로). 다건 표시명이 모두 렌더돼 key 충돌 없음.
  it('active=false·partId 누락·다건 인원을 throw 없이 안전 렌더한다 (negative — 경계/선택 필드/다건)', () => {
    setRoutes({
      [PERSONS]: {
        data: [
          // partId·createdAt 모두 누락 + active=false → 휴직 라벨 + 선택 필드 생략.
          { id: 'x1', fullName: '박경계', email: 'park@example.com', active: false },
          // active=true + partId=null(nullable) → 활성 라벨 + partId 미표시(throw 없음).
          { id: 'x2', fullName: '최다건', email: 'choi@example.com', active: true, partId: null },
        ] as PersonRow[],
        loading: false,
        error: undefined,
      },
    });
    const html = renderToStaticMarkup(<AdminView />);
    // 두 인원(서로 다른 key)이 모두 렌더 — key 중복 없이 다건 안전 처리.
    expect(html).toContain('박경계');
    expect(html).toContain('최다건');
    // active=false → 휴직, active=true → 활성 라벨.
    expect(html).toContain('휴직');
    expect(html).toContain('활성');
    // partId 누락/null 이어도 throw 없이 이메일·표시명이 표면화된다.
    expect(html).toContain('park@example.com');
    expect(html).toContain('choi@example.com');
  });
});

// R-112 — T-1143 buildPersonsPath 순수 helper 검증. nonce 0(초기 마운트)이면 base path(T-1142
// 마운트와 동일 — 회귀 0), nonce > 0 이면 `_r` cache-busting query 로 재조회를 유발하는 path 를
// 낸다(buildProvidersPath 동형). 경계(0)·정상(양수)·음수 방어를 각 1+ cover.
describe('AdminView — buildPersonsPath (순수 함수, T-1143)', () => {
  // 경계 — nonce 0 이면 query 없는 base path(T-1142 마운트 path 와 동일 — 회귀 0).
  it('nonce 0 이면 base path 를 그대로 반환한다 (경계 — 초기 마운트/회귀 0)', () => {
    expect(buildPersonsPath(0)).toBe('/api/persons');
  });

  // happy — nonce 양수면 `_r=<nonce>` query 를 부착해 path 를 변화시킨다(재조회 트리거).
  it('nonce 양수면 `_r` query 를 부착한 path 를 반환한다 (happy — 재조회 트리거)', () => {
    expect(buildPersonsPath(1)).toBe('/api/persons?_r=1');
    expect(buildPersonsPath(7)).toBe('/api/persons?_r=7');
  });

  // negative — 음수 nonce(비정상)도 <=0 분기라 base path 로 안전 fallback(query 미부착).
  it('음수 nonce 는 base path 로 안전 fallback 한다 (negative — 음수 방어)', () => {
    expect(buildPersonsPath(-1)).toBe('/api/persons');
  });
});

// R-112 — T-1143 인원 생성 실 POST create mutation 본체(runCreatePerson) 검증. jsdom/렌더러
// 없이 mutation 본체를 직접 호출하고(runCreateProvider 와 동일 convention), apiClient.request mock
// 으로 method/path/body 를 단언하며 성공/실패 분기 응답을 주입한다. 상태 전이는 record harness 의
// 콜백 호출로 관찰한다. happy/error(400·409·네트워크)/branch(빈·공백·in-flight·단일 발사)/negative
// 예외 분기마다 각 1+ cover. 409 email 중복과 일반 실패를 각각 cover한다.
describe('AdminView — 인원 생성 실 POST create mutation (T-1143 runCreatePerson)', () => {
  // 유효한 2 필드 기본 입력값 — 각 test 가 필요 시 일부만 덮어 빈/공백 분기를 만든다.
  const VALID: CreatePersonFields = {
    fullName: '김신규',
    email: 'kim.new@example.com',
  };

  // 상태 전이를 기록하는 deps harness — creating 초기값과 request mock 을 주입받아
  // setCreating/setCreateError 호출과 bumpRefresh·resetInput 호출 횟수를 순서대로 캡처한다.
  function makeCreateDeps(creating: boolean) {
    const calls = {
      creating: [] as boolean[],
      error: [] as (string | undefined)[],
      bump: 0,
      reset: 0,
    };
    const deps: CreatePersonDeps = {
      create: (...args: unknown[]) => requestMock(...args),
      describeError: (e: unknown) => {
        // toErrorMessage stub 과 정합 — ApiError.status → 문구.
        if (e instanceof ApiError) {
          return e.status === 0
            ? `네트워크 오류: ${e.message}`
            : `HTTP ${e.status}: ${e.message}`;
        }
        return '알 수 없는 오류';
      },
      creating,
      setCreating: (next) => calls.creating.push(next),
      setCreateError: (next) => calls.error.push(next),
      bumpRefresh: () => {
        calls.bump += 1;
      },
      resetInput: () => {
        calls.reset += 1;
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

  // happy-path — create 트리거 시 request 가 POST /api/persons 로 method POST + body 2 필드
  // 인 인자로 정확히 호출되고, 성공 후 재조회 nonce bump(1 회) + 입력 초기화(1 회) + error 미설정
  // (시작 비움만) + 진행 표시(creating) on→off 로 해제된다.
  it('POST /api/persons 를 method POST + body 2 필드로 정확히 호출하고 성공 시 재조회 nonce bump + 입력 초기화 한다 (happy-path)', async () => {
    requestMock.mockResolvedValue(undefined); // 201 Created.
    const { deps, calls } = makeCreateDeps(false);
    await runCreatePerson(VALID, deps);
    expect(requestMock).toHaveBeenCalledTimes(1);
    const [path, options] = requestMock.mock.calls[0] as [
      string,
      { method: string; body: string },
    ];
    expect(path).toBe('/api/persons');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({
      fullName: '김신규',
      email: 'kim.new@example.com',
    });
    // 성공 → 재조회 nonce bump 1 회 + 입력 초기화 1 회 + error 시작 비움만(실패 문구 미설정).
    expect(calls.bump).toBe(1);
    expect(calls.reset).toBe(1);
    expect(calls.error).toEqual([undefined]);
    // 진행 표시 on→off(finally 공통 해제).
    expect(calls.creating).toEqual([true, false]);
  });

  // negative — active 필드는 body 에서 제외된다(Prisma default true 위임 — CreatePersonDto 2 필드).
  it('body 에 active 필드를 포함하지 않는다 (negative — CreatePersonDto 2 필드 경계)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps } = makeCreateDeps(false);
    await runCreatePerson(VALID, deps);
    const [, options] = requestMock.mock.calls[0] as [string, { body: string }];
    const parsed = JSON.parse(options.body);
    expect(parsed).not.toHaveProperty('active');
    expect(Object.keys(parsed).sort()).toEqual(['email', 'fullName']);
  });

  // error path — create 400(검증 실패, 잘못된 email) 시 error 문구가 표면화되고 throw 없이
  // 처리되며 재조회 nonce·입력 초기화는 일어나지 않는다(입력 유지 — 재시도 편의).
  it('create 400(검증 실패) 시 error 문구를 표면화하고 nonce·입력을 건드리지 않는다 (error path — 400)', async () => {
    requestMock.mockRejectedValue(new ApiError(400, 'Bad Request'));
    const { deps, calls } = makeCreateDeps(false);
    await expect(runCreatePerson(VALID, deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 400: Bad Request']);
    expect(calls.bump).toBe(0);
    expect(calls.reset).toBe(0);
    expect(calls.creating).toEqual([true, false]);
  });

  // error path — 409(email 중복) 실패 시 동일 안전 경로로 문구 표면화(throw 없음). Person 은
  // email @unique 라 중복 등록은 409 Conflict 로 매핑된다(person.controller L65).
  it('create 409(email 중복) 실패 시 안전 문구를 표면화하고 목록·입력을 유지한다 (error path — 409)', async () => {
    requestMock.mockRejectedValue(new ApiError(409, 'Conflict'));
    const { deps, calls } = makeCreateDeps(false);
    await expect(runCreatePerson(VALID, deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 409: Conflict']);
    expect(calls.bump).toBe(0);
    expect(calls.reset).toBe(0);
  });

  // error path — 네트워크 실패(ApiError(0)) 시 네트워크 오류 문구(throw 없음).
  it('create 네트워크 실패(ApiError 0) 시 네트워크 오류 문구를 표면화한다 (error path — 네트워크)', async () => {
    requestMock.mockRejectedValue(new ApiError(0, 'fetch failed'));
    const { deps, calls } = makeCreateDeps(false);
    await expect(runCreatePerson(VALID, deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, '네트워크 오류: fetch failed']);
    expect(calls.bump).toBe(0);
  });

  // branch (a) — 각 필드가 빈값이면 POST 미발사·state 불변·throw 없음(잘못된 body 회피). 2 필드
  // 각각을 비워 필드별 가드를 개별 cover 한다(단일 negative 로 부족 — 필드마다).
  it('2 필드 중 하나라도 빈값이면 POST 를 발사하지 않는다 (branch (a) — 필드별 빈값 가드)', async () => {
    const fieldKeys: (keyof CreatePersonFields)[] = ['fullName', 'email'];
    for (const key of fieldKeys) {
      requestMock.mockReset();
      const { deps, calls } = makeCreateDeps(false);
      await expect(
        runCreatePerson({ ...VALID, [key]: '' }, deps),
      ).resolves.toBeUndefined();
      expect(requestMock).not.toHaveBeenCalled();
      expect(calls.creating).toEqual([]);
      expect(calls.error).toEqual([]);
      expect(calls.bump).toBe(0);
      expect(calls.reset).toBe(0);
    }
  });

  // negative — 각 필드가 공백만이면 trim 후 빈 값이라 POST 미발사(빈 값 방어 — 필드별). fullName
  // 만 채우고 email 을 비운/공백 경우도 개별 cover 한다(경계 조합).
  it('공백만 있는 필드는 trim 후 빈 값이라 POST 를 발사하지 않는다 (negative — 필드별 공백)', async () => {
    const fieldKeys: (keyof CreatePersonFields)[] = ['fullName', 'email'];
    for (const key of fieldKeys) {
      requestMock.mockReset();
      const { deps, calls } = makeCreateDeps(false);
      await expect(
        runCreatePerson({ ...VALID, [key]: '   ' }, deps),
      ).resolves.toBeUndefined();
      expect(requestMock).not.toHaveBeenCalled();
      expect(calls.creating).toEqual([]);
      expect(calls.bump).toBe(0);
    }
  });

  // negative — fullName 만 채우고 email 이 빈 경우 미발사(부분 입력 경계 — 폼 버튼 disabled 와 정합).
  it('fullName 만 채우고 email 이 비면 POST 를 발사하지 않는다 (negative — 부분 입력 경계)', async () => {
    const { deps, calls } = makeCreateDeps(false);
    await expect(
      runCreatePerson({ fullName: '김신규', email: '' }, deps),
    ).resolves.toBeUndefined();
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.bump).toBe(0);
  });

  // branch (b) — 이전 create 미완(creating=true) 중 재호출은 POST 미발사·state 불변(이중 POST·경합 차단).
  it('이전 create 미완(creating=true) 중 재호출은 POST 를 발사하지 않는다 (branch (b) — 이중 POST 가드)', async () => {
    const { deps, calls } = makeCreateDeps(true); // 이미 in-flight.
    await runCreatePerson(VALID, deps);
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.creating).toEqual([]);
    expect(calls.error).toEqual([]);
    expect(calls.bump).toBe(0);
  });

  // branch (c) — 정상 발사 시 POST 1 회만(중복 없음 — 단일 POST 보장).
  it('정상 발사 시 POST 를 1 회만 호출한다 (branch (c) — 단일 발사)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps } = makeCreateDeps(false);
    await runCreatePerson(VALID, deps);
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(requestMock.mock.calls[0]?.[0]).toBe('/api/persons');
  });

  // negative — 각 필드 앞뒤 공백은 trim 되어 body 에 실린다(공백 정규화).
  it('각 필드 앞뒤 공백을 trim 해 body 에 싣는다 (negative — trim 정규화)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps } = makeCreateDeps(false);
    await runCreatePerson(
      { fullName: '  김신규  ', email: '  kim.new@example.com  ' },
      deps,
    );
    const [, options] = requestMock.mock.calls[0] as [string, { body: string }];
    expect(JSON.parse(options.body)).toEqual({
      fullName: '김신규',
      email: 'kim.new@example.com',
    });
  });

  // negative(시작 정리) — 발사 직후 진행 표시 on + 직전 error 즉시 비움을 지연 resolve 로 캡처한다
  // (재조회 도착 전 상태에서 crash 없음). 해소 후 재조회 bump + 입력 초기화 + 진행 off.
  it('발사 직후 진행 표시 on + 직전 error 를 즉시 비운다 (negative — 시작 정리/재조회 전 안전)', async () => {
    let resolvePost: () => void = () => {};
    requestMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvePost = resolve;
        }),
    );
    const { deps, calls } = makeCreateDeps(false);
    const pending = runCreatePerson(VALID, deps);
    expect(calls.creating).toEqual([true]);
    expect(calls.error).toEqual([undefined]);
    expect(calls.bump).toBe(0);
    expect(calls.reset).toBe(0);
    resolvePost();
    await pending;
    // 해소 후 재조회 bump(nonce 증가 → 기존 목록 재 fetch 트리거) + 입력 초기화 + 진행 off.
    expect(calls.bump).toBe(1);
    expect(calls.reset).toBe(1);
    expect(calls.creating).toEqual([true, false]);
  });

  // negative — 실패 후 재시도(재클릭)는 직전 error 를 비우고 정상 재발화한다(시작 비움 → 성공 bump).
  it('실패 후 재시도(재클릭)는 직전 error 를 비우고 정상 재발화한다 (negative — 실패 후 재시도)', async () => {
    requestMock.mockRejectedValueOnce(new ApiError(409, 'Conflict'));
    const first = makeCreateDeps(false);
    await runCreatePerson(VALID, first.deps);
    expect(first.calls.error).toEqual([undefined, 'HTTP 409: Conflict']);
    expect(first.calls.bump).toBe(0);

    requestMock.mockResolvedValueOnce(undefined);
    const second = makeCreateDeps(false);
    await runCreatePerson(VALID, second.deps);
    expect(second.calls.error).toEqual([undefined]);
    expect(second.calls.bump).toBe(1);
  });

  // negative — 성공·실패 어느 경로든 finally 가 setCreating(false) 로 진행 표시를 복구한다.
  it('성공·실패 어느 경우든 진행 표시(creating)가 finally 로 해제된다 (negative — 진행 해제)', async () => {
    requestMock.mockResolvedValueOnce(undefined);
    const ok = makeCreateDeps(false);
    await runCreatePerson(VALID, ok.deps);
    expect(ok.calls.creating).toEqual([true, false]);

    requestMock.mockRejectedValueOnce(new ApiError(500, 'boom'));
    const fail = makeCreateDeps(false);
    await runCreatePerson(VALID, fail.deps);
    expect(fail.calls.creating).toEqual([true, false]);
  });
});

// R-112 — T-1143 인원 생성 폼 배선 렌더 검증. 인원 관리 섹션에 2 필드 input(aria-label) +
// "인원 추가" 버튼이 마운트되고, 초기(빈 필드)엔 버튼이 disabled 로 렌더됨을 정적 markup 으로
// 단언한다(클릭→러너 호출 자체는 위 runCreatePerson 단위 test 가 cover — 본 파일은 jsdom 미사용
// 정적 렌더라 이벤트 비검증). 초기엔 실패 문구 alert(createPersonError) 가 미렌더됨도 확인한다.
describe('AdminView — 인원 생성 폼 배선 (정적 렌더, T-1143)', () => {
  const PERSONS = '/api/persons';

  beforeEach(() => {
    useApiResourceMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-path — 인원 관리 섹션에 2 필드 input(aria-label) + "인원 추가" 버튼이 마운트된다.
  it('인원 관리 섹션에 2 필드 input + "인원 추가" 버튼을 렌더한다 (happy-path)', () => {
    setRoutes({ [PERSONS]: { data: [], loading: false, error: undefined } });
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toContain('aria-label="추가할 인원 이름"');
    expect(html).toContain('aria-label="추가할 인원 email"');
    expect(html).toContain('인원 추가</button>');
  });

  // branch — 초기(빈 필드) 마운트 시 생성 버튼이 disabled 로 렌더된다(빈 필드 발사 억제 UI 반영).
  it('초기(빈 필드) 마운트 시 인원 추가 버튼이 disabled 로 렌더된다 (branch — 빈 필드 버튼 비활성)', () => {
    setRoutes({ [PERSONS]: { data: [], loading: false, error: undefined } });
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toMatch(/<button[^>]*disabled[^>]*>인원 추가<\/button>/);
  });

  // negative — 초기엔 생성 실패 문구(createPersonError=undefined)라 생성 폼 하단 alert 이 미렌더된다.
  // (인원 조회는 성공 상태라 조회 error alert 도 없음 — 생성/조회 error 표면이 분리됨을 방증.)
  it('초기엔 생성 실패 alert 을 렌더하지 않는다 (negative — createPersonError 미설정)', () => {
    setRoutes({ [PERSONS]: { data: [], loading: false, error: undefined } });
    const html = renderToStaticMarkup(<AdminView />);
    // 조회 성공 + 생성 미발사라 어떤 role="alert" 도 등장하지 않는다.
    expect(html).not.toContain('role="alert"');
  });

  // negative(email input 타입) — email 필드는 type="email" 로 렌더돼 형식 힌트를 준다(HTML5 시맨틱).
  it('email 필드는 type="email" 로 렌더된다 (negative — email input 타입)', () => {
    setRoutes({ [PERSONS]: { data: [], loading: false, error: undefined } });
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toMatch(
      /aria-label="추가할 인원 email"[^>]*type="email"|type="email"[^>]*aria-label="추가할 인원 email"/,
    );
  });
});

// R-112 — T-1146 buildGroupsPath 순수 helper 검증. nonce 0(초기 마운트)이면 base path(T-1129
// 이전 마운트와 동일 — 회귀 0), nonce > 0 이면 `_r` cache-busting query 로 재조회를 유발하는 path 를
// 낸다(buildPersonsPath 동형). 경계(0)·정상(양수)·음수 방어를 각 1+ cover.
describe('AdminView — buildGroupsPath (순수 함수, T-1146)', () => {
  // 경계 — nonce 0 이면 query 없는 base path(T-1129 이전 마운트 path 와 동일 — 회귀 0).
  it('nonce 0 이면 base path 를 그대로 반환한다 (경계 — 초기 마운트/회귀 0)', () => {
    expect(buildGroupsPath(0)).toBe('/api/groups');
  });

  // happy — nonce 양수면 `_r=<nonce>` query 를 부착해 path 를 변화시킨다(재조회 트리거).
  it('nonce 양수면 `_r` query 를 부착한 path 를 반환한다 (happy — 재조회 트리거)', () => {
    expect(buildGroupsPath(1)).toBe('/api/groups?_r=1');
    expect(buildGroupsPath(9)).toBe('/api/groups?_r=9');
  });

  // negative — 음수 nonce(비정상)도 <=0 분기라 base path 로 안전 fallback(query 미부착).
  it('음수 nonce 는 base path 로 안전 fallback 한다 (negative — 음수 방어)', () => {
    expect(buildGroupsPath(-1)).toBe('/api/groups');
  });
});

// R-112 — T-1153 파트 조회 path 빌더(buildPartsPath) 검증. buildGroupsPath 와 동형이되 base 가
// /api/parts. nonce 0/양수/음수 분기를 각 1+ cover(경계·happy·negative). 파트 생성 성공 시
// partsRefreshNonce bump 로 이 빌더가 `_r` query 를 붙여 재조회를 유발함을 방증한다.
describe('AdminView — buildPartsPath (순수 함수, T-1153)', () => {
  // 경계 — nonce 0 이면 query 없는 base path(T-1152 마운트 path 와 동일 — 회귀 0).
  it('nonce 0 이면 base path 를 그대로 반환한다 (경계 — 초기 마운트/회귀 0)', () => {
    expect(buildPartsPath(0)).toBe('/api/parts');
  });

  // happy — nonce 양수면 `_r=<nonce>` query 를 부착해 path 를 변화시킨다(재조회 트리거).
  it('nonce 양수면 `_r` query 를 부착한 path 를 반환한다 (happy — 재조회 트리거)', () => {
    expect(buildPartsPath(1)).toBe('/api/parts?_r=1');
    expect(buildPartsPath(5)).toBe('/api/parts?_r=5');
  });

  // negative — 음수 nonce(비정상)도 <=0 분기라 base path 로 안전 fallback(query 미부착).
  it('음수 nonce 는 base path 로 안전 fallback 한다 (negative — 음수 방어)', () => {
    expect(buildPartsPath(-1)).toBe('/api/parts');
  });
});

// R-112 — T-1146 그룹 생성 실 POST create mutation 본체(runCreateGroup) 검증. jsdom/렌더러 없이
// mutation 본체를 직접 호출하고(runCreatePerson 과 동일 convention), apiClient.request mock 으로
// method/path/body 를 단언하며 성공/실패 분기 응답을 주입한다. 상태 전이는 record harness 의 콜백
// 호출로 관찰한다. happy/error(400·409·네트워크)/branch(빈·공백·in-flight·단일 발사)/negative
// 예외 분기마다 각 1+ cover. name 단일 필드(CreateGroupDto)라 person 2 필드 대신 name 하나만 다룬다.
describe('AdminView — 그룹 생성 실 POST create mutation (T-1146 runCreateGroup)', () => {
  // 유효한 name 기본 입력값 — 각 test 가 필요 시 빈/공백으로 덮어 가드 분기를 만든다.
  const VALID = '플랫폼팀';

  // 상태 전이를 기록하는 deps harness — creating 초기값과 request mock 을 주입받아
  // setCreating/setCreateError 호출과 bumpRefresh·resetInput 호출 횟수를 순서대로 캡처한다.
  function makeCreateDeps(creating: boolean) {
    const calls = {
      creating: [] as boolean[],
      error: [] as (string | undefined)[],
      bump: 0,
      reset: 0,
    };
    const deps: CreateGroupDeps = {
      create: (...args: unknown[]) => requestMock(...args),
      describeError: (e: unknown) => {
        // toErrorMessage stub 과 정합 — ApiError.status → 문구.
        if (e instanceof ApiError) {
          return e.status === 0
            ? `네트워크 오류: ${e.message}`
            : `HTTP ${e.status}: ${e.message}`;
        }
        return '알 수 없는 오류';
      },
      creating,
      setCreating: (next) => calls.creating.push(next),
      setCreateError: (next) => calls.error.push(next),
      bumpRefresh: () => {
        calls.bump += 1;
      },
      resetInput: () => {
        calls.reset += 1;
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

  // happy-path — create 트리거 시 request 가 POST /api/groups 로 method POST + body `{ name }`
  // 인자로 정확히 호출되고, 성공 후 재조회 nonce bump(1 회) + 입력 초기화(1 회) + error 미설정
  // (시작 비움만) + 진행 표시(creating) on→off 로 해제된다.
  it('POST /api/groups 를 method POST + body `{ name }` 로 정확히 호출하고 성공 시 재조회 nonce bump + 입력 초기화 한다 (happy-path)', async () => {
    requestMock.mockResolvedValue(undefined); // 201 Created.
    const { deps, calls } = makeCreateDeps(false);
    await runCreateGroup(VALID, deps);
    expect(requestMock).toHaveBeenCalledTimes(1);
    const [path, options] = requestMock.mock.calls[0] as [
      string,
      { method: string; body: string },
    ];
    expect(path).toBe('/api/groups');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ name: '플랫폼팀' });
    // 성공 → 재조회 nonce bump 1 회 + 입력 초기화 1 회 + error 시작 비움만(실패 문구 미설정).
    expect(calls.bump).toBe(1);
    expect(calls.reset).toBe(1);
    expect(calls.error).toEqual([undefined]);
    // 진행 표시 on→off(finally 공통 해제).
    expect(calls.creating).toEqual([true, false]);
  });

  // negative — body 는 name 단일 필드만 담는다(CreateGroupDto 계약 — 다른 필드 미포함 경계).
  it('body 에 name 외 다른 필드를 포함하지 않는다 (negative — CreateGroupDto 단일 필드 경계)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps } = makeCreateDeps(false);
    await runCreateGroup(VALID, deps);
    const [, options] = requestMock.mock.calls[0] as [string, { body: string }];
    const parsed = JSON.parse(options.body);
    expect(Object.keys(parsed)).toEqual(['name']);
  });

  // error path — create 400(검증 실패, 빈 name) 시 error 문구가 표면화되고 throw 없이 처리되며
  // 재조회 nonce·입력 초기화는 일어나지 않는다(입력 유지 — 재시도 편의).
  it('create 400(검증 실패) 시 error 문구를 표면화하고 nonce·입력을 건드리지 않는다 (error path — 400)', async () => {
    requestMock.mockRejectedValue(new ApiError(400, 'Bad Request'));
    const { deps, calls } = makeCreateDeps(false);
    await expect(runCreateGroup(VALID, deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 400: Bad Request']);
    expect(calls.bump).toBe(0);
    expect(calls.reset).toBe(0);
    expect(calls.creating).toEqual([true, false]);
  });

  // error path — 드문 409(동명 그룹) 실패도 특수 분기 없이 동일 안전 경로로 문구 표면화(throw 없음).
  // Group.name 은 @unique 미정의라 서버가 409 를 거의 안 던지지만, 던져도 일반 error 로 흡수함을 방증.
  it('create 409 실패 시 특수 분기 없이 일반 error 문구를 표면화한다 (error path — 409 일반 흡수)', async () => {
    requestMock.mockRejectedValue(new ApiError(409, 'Conflict'));
    const { deps, calls } = makeCreateDeps(false);
    await expect(runCreateGroup(VALID, deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 409: Conflict']);
    expect(calls.bump).toBe(0);
    expect(calls.reset).toBe(0);
  });

  // error path — 네트워크 실패(ApiError(0)) 시 네트워크 오류 문구(throw 없음).
  it('create 네트워크 실패(ApiError 0) 시 네트워크 오류 문구를 표면화한다 (error path — 네트워크)', async () => {
    requestMock.mockRejectedValue(new ApiError(0, 'fetch failed'));
    const { deps, calls } = makeCreateDeps(false);
    await expect(runCreateGroup(VALID, deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, '네트워크 오류: fetch failed']);
    expect(calls.bump).toBe(0);
  });

  // branch (a) — name 이 빈값이면 POST 미발사·state 불변·throw 없음(잘못된 body 회피).
  it('name 이 빈값이면 POST 를 발사하지 않는다 (branch (a) — 빈값 가드)', async () => {
    const { deps, calls } = makeCreateDeps(false);
    await expect(runCreateGroup('', deps)).resolves.toBeUndefined();
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.creating).toEqual([]);
    expect(calls.error).toEqual([]);
    expect(calls.bump).toBe(0);
    expect(calls.reset).toBe(0);
  });

  // negative — 공백만인 name 은 trim 후 빈 값이라 POST 미발사(빈 값 방어 — 경계값).
  it('공백만 있는 name 은 trim 후 빈 값이라 POST 를 발사하지 않는다 (negative — 공백 가드)', async () => {
    const { deps, calls } = makeCreateDeps(false);
    await expect(runCreateGroup('   ', deps)).resolves.toBeUndefined();
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.creating).toEqual([]);
    expect(calls.bump).toBe(0);
  });

  // branch (b) — 이전 create 미완(creating=true) 중 재호출은 POST 미발사·state 불변(이중 POST·경합 차단).
  it('이전 create 미완(creating=true) 중 재호출은 POST 를 발사하지 않는다 (branch (b) — 이중 POST 가드)', async () => {
    const { deps, calls } = makeCreateDeps(true); // 이미 in-flight.
    await runCreateGroup(VALID, deps);
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.creating).toEqual([]);
    expect(calls.error).toEqual([]);
    expect(calls.bump).toBe(0);
  });

  // branch (c) — 정상 발사 시 POST 1 회만(중복 없음 — 단일 POST 보장).
  it('정상 발사 시 POST 를 1 회만 호출한다 (branch (c) — 단일 발사)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps } = makeCreateDeps(false);
    await runCreateGroup(VALID, deps);
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(requestMock.mock.calls[0]?.[0]).toBe('/api/groups');
  });

  // negative — name 앞뒤 공백은 trim 되어 body 에 실린다(공백 정규화).
  it('name 앞뒤 공백을 trim 해 body 에 싣는다 (negative — trim 정규화)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps } = makeCreateDeps(false);
    await runCreateGroup('  플랫폼팀  ', deps);
    const [, options] = requestMock.mock.calls[0] as [string, { body: string }];
    expect(JSON.parse(options.body)).toEqual({ name: '플랫폼팀' });
  });

  // negative(시작 정리) — 발사 직후 진행 표시 on + 직전 error 즉시 비움을 지연 resolve 로 캡처한다
  // (재조회 도착 전 상태에서 crash 없음). 해소 후 재조회 bump + 입력 초기화 + 진행 off.
  it('발사 직후 진행 표시 on + 직전 error 를 즉시 비운다 (negative — 시작 정리/재조회 전 안전)', async () => {
    let resolvePost: () => void = () => {};
    requestMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvePost = resolve;
        }),
    );
    const { deps, calls } = makeCreateDeps(false);
    const pending = runCreateGroup(VALID, deps);
    expect(calls.creating).toEqual([true]);
    expect(calls.error).toEqual([undefined]);
    expect(calls.bump).toBe(0);
    expect(calls.reset).toBe(0);
    resolvePost();
    await pending;
    // 해소 후 재조회 bump(nonce 증가 → 기존 목록 재 fetch 트리거) + 입력 초기화 + 진행 off.
    expect(calls.bump).toBe(1);
    expect(calls.reset).toBe(1);
    expect(calls.creating).toEqual([true, false]);
  });

  // negative — 실패 후 재시도(재클릭)는 직전 error 를 비우고 정상 재발화한다(시작 비움 → 성공 bump).
  it('실패 후 재시도(재클릭)는 직전 error 를 비우고 정상 재발화한다 (negative — 실패 후 재시도)', async () => {
    requestMock.mockRejectedValueOnce(new ApiError(500, 'boom'));
    const first = makeCreateDeps(false);
    await runCreateGroup(VALID, first.deps);
    expect(first.calls.error).toEqual([undefined, 'HTTP 500: boom']);
    expect(first.calls.bump).toBe(0);

    requestMock.mockResolvedValueOnce(undefined);
    const second = makeCreateDeps(false);
    await runCreateGroup(VALID, second.deps);
    expect(second.calls.error).toEqual([undefined]);
    expect(second.calls.bump).toBe(1);
  });

  // negative — 성공·실패 어느 경로든 finally 가 setCreating(false) 로 진행 표시를 복구한다.
  it('성공·실패 어느 경우든 진행 표시(creating)가 finally 로 해제된다 (negative — 진행 해제)', async () => {
    requestMock.mockResolvedValueOnce(undefined);
    const ok = makeCreateDeps(false);
    await runCreateGroup(VALID, ok.deps);
    expect(ok.calls.creating).toEqual([true, false]);

    requestMock.mockRejectedValueOnce(new ApiError(500, 'boom'));
    const fail = makeCreateDeps(false);
    await runCreateGroup(VALID, fail.deps);
    expect(fail.calls.creating).toEqual([true, false]);
  });
});

// R-112 — T-1153 파트 생성 실 POST create mutation 본체(runCreatePart) 검증. jsdom/렌더러 없이
// mutation 본체를 직접 호출하고(runCreateGroup 과 동일 convention), apiClient.request mock 으로
// method/path/body 를 단언하며 성공/실패 분기 응답을 주입한다. 상태 전이는 record harness 의 콜백
// 호출로 관찰한다. happy/error(400·409 중복 전용·403·네트워크)/branch(빈·공백·in-flight·단일
// 발사·409 vs 비-409)/negative(trim 정규화·이중 POST 차단·finally 진행 off·입력 초기화·409 후
// 재시도 error 초기화) 각 1+ cover. name 단일 필드(CreatePartDto)라 그룹과 동형이되 Part.name
// @unique 라 409 를 전용 문구(PART_DUPLICATE_ERROR)로 구분 표면화하는 분기를 추가 검증한다.
describe('AdminView — 파트 생성 실 POST create mutation (T-1153 runCreatePart)', () => {
  // 유효한 name 기본 입력값 — 각 test 가 필요 시 빈/공백으로 덮어 가드 분기를 만든다.
  const VALID = '개발파트';
  // 409 전용 문구 — runCreatePart 가 ConflictException(409) 시 표면화하는 상수와 정합.
  const DUP = '이미 존재하는 파트 이름입니다';

  // 상태 전이를 기록하는 deps harness — creating 초기값과 request mock 을 주입받아
  // setCreating/setCreateError 호출과 bumpRefresh·resetInput 호출 횟수를 순서대로 캡처한다.
  // isConflict 는 런타임과 동일하게 ApiError.status===409 판정을 주입한다(409 전용 분기 검증).
  function makeCreateDeps(creating: boolean) {
    const calls = {
      creating: [] as boolean[],
      error: [] as (string | undefined)[],
      bump: 0,
      reset: 0,
    };
    const deps: CreatePartDeps = {
      create: (...args: unknown[]) => requestMock(...args),
      describeError: (e: unknown) => {
        // toErrorMessage stub 과 정합 — ApiError.status → 문구(비-409 경로).
        if (e instanceof ApiError) {
          return e.status === 0
            ? `네트워크 오류: ${e.message}`
            : `HTTP ${e.status}: ${e.message}`;
        }
        return '알 수 없는 오류';
      },
      isConflict: (e: unknown) => e instanceof ApiError && e.status === 409,
      creating,
      setCreating: (next) => calls.creating.push(next),
      setCreateError: (next) => calls.error.push(next),
      bumpRefresh: () => {
        calls.bump += 1;
      },
      resetInput: () => {
        calls.reset += 1;
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

  // happy-path — create 트리거 시 request 가 POST /api/parts 로 method POST + body `{ name }`
  // 인자로 정확히 호출되고, 성공 후 재조회 nonce bump(1 회) + 입력 초기화(1 회) + error 미설정
  // (시작 비움만) + 진행 표시(creating) on→off 로 해제된다.
  it('POST /api/parts 를 method POST + body `{ name }` 로 정확히 호출하고 성공 시 재조회 nonce bump + 입력 초기화 한다 (happy-path)', async () => {
    requestMock.mockResolvedValue(undefined); // 201 Created.
    const { deps, calls } = makeCreateDeps(false);
    await runCreatePart(VALID, deps);
    expect(requestMock).toHaveBeenCalledTimes(1);
    const [path, options] = requestMock.mock.calls[0] as [
      string,
      { method: string; body: string },
    ];
    expect(path).toBe('/api/parts');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ name: '개발파트' });
    // 성공 → 재조회 nonce bump 1 회 + 입력 초기화 1 회 + error 시작 비움만(실패 문구 미설정).
    expect(calls.bump).toBe(1);
    expect(calls.reset).toBe(1);
    expect(calls.error).toEqual([undefined]);
    // 진행 표시 on→off(finally 공통 해제).
    expect(calls.creating).toEqual([true, false]);
  });

  // negative — body 는 name 단일 필드만 담는다(CreatePartDto 계약 — 다른 필드 미포함 경계).
  it('body 에 name 외 다른 필드를 포함하지 않는다 (negative — CreatePartDto 단일 필드 경계)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps } = makeCreateDeps(false);
    await runCreatePart(VALID, deps);
    const [, options] = requestMock.mock.calls[0] as [string, { body: string }];
    const parsed = JSON.parse(options.body);
    expect(Object.keys(parsed)).toEqual(['name']);
  });

  // error path — create 400(검증 실패, 빈 name) 시 error 문구가 표면화되고 throw 없이 처리되며
  // 재조회 nonce·입력 초기화는 일어나지 않는다(입력 유지 — 재시도 편의).
  it('create 400(검증 실패) 시 error 문구를 표면화하고 nonce·입력을 건드리지 않는다 (error path — 400)', async () => {
    requestMock.mockRejectedValue(new ApiError(400, 'Bad Request'));
    const { deps, calls } = makeCreateDeps(false);
    await expect(runCreatePart(VALID, deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 400: Bad Request']);
    expect(calls.bump).toBe(0);
    expect(calls.reset).toBe(0);
    expect(calls.creating).toEqual([true, false]);
  });

  // error path (409 전용 분기) — 중복 이름(Part.name @unique 위반 → ConflictException) 시 일반
  // "HTTP 409: …" 가 아니라 전용 중복 문구(PART_DUPLICATE_ERROR)를 표면화한다(그룹과 구분되는 핵심 분기).
  it('create 409(중복 이름) 시 일반 문구 대신 전용 중복 문구를 표면화한다 (error path — 409 중복 전용)', async () => {
    requestMock.mockRejectedValue(new ApiError(409, 'Conflict'));
    const { deps, calls } = makeCreateDeps(false);
    await expect(runCreatePart(VALID, deps)).resolves.toBeUndefined();
    // 전용 문구 — 일반 "HTTP 409: Conflict" 가 아니다.
    expect(calls.error).toEqual([undefined, DUP]);
    expect(calls.error).not.toContain('HTTP 409: Conflict');
    // 실패라 재조회·입력 초기화는 없다(입력 유지 — 다른 이름으로 재시도 편의).
    expect(calls.bump).toBe(0);
    expect(calls.reset).toBe(0);
    expect(calls.creating).toEqual([true, false]);
  });

  // error path (비-409 분기) — 403(Admin+ 미만) 은 409 전용 문구가 아니라 describeError 일반 문구로
  // 표면화한다(409 vs 비-409 분기가 정확히 갈림을 방증).
  it('create 403 실패 시 전용 중복 문구가 아니라 일반 문구를 표면화한다 (error path — 비-409 분기)', async () => {
    requestMock.mockRejectedValue(new ApiError(403, 'Forbidden'));
    const { deps, calls } = makeCreateDeps(false);
    await expect(runCreatePart(VALID, deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 403: Forbidden']);
    expect(calls.error).not.toContain(DUP);
    expect(calls.bump).toBe(0);
  });

  // error path — 네트워크 실패(ApiError(0)) 시 네트워크 오류 문구(throw 없음, 비-409 경로).
  it('create 네트워크 실패(ApiError 0) 시 네트워크 오류 문구를 표면화한다 (error path — 네트워크)', async () => {
    requestMock.mockRejectedValue(new ApiError(0, 'fetch failed'));
    const { deps, calls } = makeCreateDeps(false);
    await expect(runCreatePart(VALID, deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, '네트워크 오류: fetch failed']);
    expect(calls.bump).toBe(0);
  });

  // branch (a) — name 이 빈값이면 POST 미발사·state 불변·throw 없음(잘못된 body 회피).
  it('name 이 빈값이면 POST 를 발사하지 않는다 (branch (a) — 빈값 가드)', async () => {
    const { deps, calls } = makeCreateDeps(false);
    await expect(runCreatePart('', deps)).resolves.toBeUndefined();
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.creating).toEqual([]);
    expect(calls.error).toEqual([]);
    expect(calls.bump).toBe(0);
    expect(calls.reset).toBe(0);
  });

  // negative — 공백만인 name 은 trim 후 빈 값이라 POST 미발사(빈 값 방어 — 경계값).
  it('공백만 있는 name 은 trim 후 빈 값이라 POST 를 발사하지 않는다 (negative — 공백 가드)', async () => {
    const { deps, calls } = makeCreateDeps(false);
    await expect(runCreatePart('   ', deps)).resolves.toBeUndefined();
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.creating).toEqual([]);
    expect(calls.bump).toBe(0);
  });

  // branch (b) — 이전 create 미완(creating=true) 중 재호출은 POST 미발사·state 불변(이중 POST·경합 차단).
  it('이전 create 미완(creating=true) 중 재호출은 POST 를 발사하지 않는다 (branch (b) — 이중 POST 가드)', async () => {
    const { deps, calls } = makeCreateDeps(true); // 이미 in-flight.
    await runCreatePart(VALID, deps);
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.creating).toEqual([]);
    expect(calls.error).toEqual([]);
    expect(calls.bump).toBe(0);
  });

  // branch (c) — 정상 발사 시 POST 1 회만(중복 없음 — 단일 POST 보장).
  it('정상 발사 시 POST 를 1 회만 호출한다 (branch (c) — 단일 발사)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps } = makeCreateDeps(false);
    await runCreatePart(VALID, deps);
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(requestMock.mock.calls[0]?.[0]).toBe('/api/parts');
  });

  // negative — name 앞뒤 공백은 trim 되어 body 에 실린다(공백 정규화).
  it('name 앞뒤 공백을 trim 해 body 에 싣는다 (negative — trim 정규화)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps } = makeCreateDeps(false);
    await runCreatePart('  개발파트  ', deps);
    const [, options] = requestMock.mock.calls[0] as [string, { body: string }];
    expect(JSON.parse(options.body)).toEqual({ name: '개발파트' });
  });

  // negative(시작 정리) — 발사 직후 진행 표시 on + 직전 error 즉시 비움을 지연 resolve 로 캡처한다
  // (재조회 도착 전 상태에서 crash 없음). 해소 후 재조회 bump + 입력 초기화 + 진행 off.
  it('발사 직후 진행 표시 on + 직전 error 를 즉시 비운다 (negative — 시작 정리/재조회 전 안전)', async () => {
    let resolvePost: () => void = () => {};
    requestMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvePost = resolve;
        }),
    );
    const { deps, calls } = makeCreateDeps(false);
    const pending = runCreatePart(VALID, deps);
    expect(calls.creating).toEqual([true]);
    expect(calls.error).toEqual([undefined]);
    expect(calls.bump).toBe(0);
    expect(calls.reset).toBe(0);
    resolvePost();
    await pending;
    expect(calls.bump).toBe(1);
    expect(calls.reset).toBe(1);
    expect(calls.creating).toEqual([true, false]);
  });

  // negative — 409 중복 후 재입력·재시도는 직전 중복 문구를 비우고(시작 비움) 정상 재발화한다
  // (성공 시 bump). 409 잔존 문구가 다음 시도에 스며들지 않음을 방증한다(error 초기화).
  it('409 중복 후 재시도는 직전 중복 문구를 비우고 정상 재발화한다 (negative — 409 후 재시도 error 초기화)', async () => {
    requestMock.mockRejectedValueOnce(new ApiError(409, 'Conflict'));
    const first = makeCreateDeps(false);
    await runCreatePart(VALID, first.deps);
    expect(first.calls.error).toEqual([undefined, DUP]);
    expect(first.calls.bump).toBe(0);

    requestMock.mockResolvedValueOnce(undefined);
    const second = makeCreateDeps(false);
    await runCreatePart('보안파트', second.deps);
    // 재시도 시작 시 error 를 비우고(undefined) 성공 → 잔존 중복 문구 없음 + bump.
    expect(second.calls.error).toEqual([undefined]);
    expect(second.calls.bump).toBe(1);
  });

  // negative — 성공·실패 어느 경로든 finally 가 setCreating(false) 로 진행 표시를 복구한다.
  it('성공·실패 어느 경우든 진행 표시(creating)가 finally 로 해제된다 (negative — 진행 해제)', async () => {
    requestMock.mockResolvedValueOnce(undefined);
    const ok = makeCreateDeps(false);
    await runCreatePart(VALID, ok.deps);
    expect(ok.calls.creating).toEqual([true, false]);

    requestMock.mockRejectedValueOnce(new ApiError(500, 'boom'));
    const fail = makeCreateDeps(false);
    await runCreatePart(VALID, fail.deps);
    expect(fail.calls.creating).toEqual([true, false]);
  });
});

// R-112 — T-1146 그룹 생성 폼 배선 렌더 검증. 그룹 관리 섹션에 name input(aria-label) + "그룹 추가"
// 버튼이 마운트되고, 초기(빈 필드)엔 버튼이 disabled 로 렌더됨을 정적 markup 으로 단언한다(클릭→러너
// 호출 자체는 위 runCreateGroup 단위 test 가 cover — 본 파일은 jsdom 미사용 정적 렌더라 이벤트
// 비검증). 초기엔 실패 문구 alert(createGroupError) 가 미렌더됨도 확인한다.
describe('AdminView — 그룹 생성 폼 배선 (정적 렌더, T-1146)', () => {
  beforeEach(() => {
    useApiResourceMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-path — 그룹 관리 섹션에 name input(aria-label) + "그룹 추가" 버튼이 마운트된다.
  it('그룹 관리 섹션에 name input + "그룹 추가" 버튼을 렌더한다 (happy-path)', () => {
    setRoutes({ [GROUPS]: { data: [], loading: false, error: undefined } });
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toContain('aria-label="추가할 그룹 이름"');
    expect(html).toContain('그룹 추가</button>');
  });

  // branch — 초기(빈 필드) 마운트 시 생성 버튼이 disabled 로 렌더된다(빈 필드 발사 억제 UI 반영).
  it('초기(빈 필드) 마운트 시 그룹 추가 버튼이 disabled 로 렌더된다 (branch — 빈 필드 버튼 비활성)', () => {
    setRoutes({ [GROUPS]: { data: [], loading: false, error: undefined } });
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toMatch(/<button[^>]*disabled[^>]*>그룹 추가<\/button>/);
  });

  // negative — 초기엔 생성 실패 문구(createGroupError=undefined)라 그룹 폼 하단 alert 이 미렌더된다.
  it('초기엔 그룹 생성 실패 alert 을 렌더하지 않는다 (negative — createGroupError 미설정)', () => {
    setRoutes({ [GROUPS]: { data: [], loading: false, error: undefined } });
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).not.toContain('role="alert"');
  });
});

// R-112 — T-1148 그룹 관리 목록 마운트(기존 GET /api/groups fetch 재사용 → GroupList props 배선)
// 검증. happy(그룹명·멤버 수 표면화) / error path(에러 alert + 목록 미렌더) / 분기(loading·빈
// 배열·populated) / negative(data undefined 시 `?? []` throw 없이 렌더, name 누락 placeholder,
// 다건 key 중복 없음, onDelete/onEdit 미전달 → 삭제·수정 버튼 미렌더=읽기 전용, loading 이 error
// 보다 우선)를 각 1+ cover. GroupList 고유 출력(멤버 수 `멤버 N명`·빈 문구·placeholder)으로
// select 드롭다운과 구분해 마운트를 단언한다. renderToStaticMarkup + useApiResource mock 으로
// data/loading/error 시나리오를 통제한다(jsdom/@testing-library 미사용 — ADR-0040 §5 게이트).
describe('AdminView — 그룹 관리 목록 마운트 (T-1148)', () => {
  // 그룹 2 건 샘플 — GroupList 고유 출력(멤버 수)까지 검증하도록 멤버 배열을 포함한다. gg1 은
  // members(2)로, gg2 는 persons(1) fallback 키로 멤버 수 후보를 노출한다(응답 키 다양성 수용).
  // 이름은 select SAMPLE 과 겹치지 않는 값으로 두어 마운트 경로를 분리 관찰한다.
  const GROUP_LIST_ROWS = [
    { id: 'gg1', name: '데브옵스팀', members: [{}, {}] },
    { id: 'gg2', name: '디자인팀', persons: [{}] },
  ];

  beforeEach(() => {
    useApiResourceMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-path — 그룹 1+ 반환 시 그룹 관리 섹션에 각 그룹 name + GroupList 고유 멤버 수(`멤버 N명`)가
  // 표면화된다(기존 groups fetch 재사용 — 새 useApiResource 호출 추가 없음도 함께 단언).
  it('그룹 fetch 성공 시 그룹 관리 섹션에 각 그룹 name·멤버 수를 목록으로 렌더한다 (happy-path)', () => {
    setRoutes({
      [GROUPS]: { data: GROUP_LIST_ROWS, loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    // GET /api/groups 를 조회하되, 그룹 목록 조회는 정확히 한 번만 등장한다(double-fetch 회피 —
    // GroupList 마운트가 새 useApiResource 호출을 추가하지 않는다).
    const paths = useApiResourceMock.mock.calls.map((c) => c[0]);
    expect(paths.filter((p) => p === GROUPS)).toHaveLength(1);
    // 그룹 관리 heading + 각 그룹 name 이 표면화된다.
    expect(html).toContain('그룹 관리');
    expect(html).toContain('데브옵스팀');
    expect(html).toContain('디자인팀');
    // GroupList 고유 출력 — members(2)·persons(1) fallback 각각 멤버 수 badge.
    expect(html).toContain('멤버 2명');
    expect(html).toContain('멤버 1명');
  });

  // error path — 그룹 fetch 가 error(예: 401)를 반환하면 그룹 관리 섹션이 role="alert" 에러를
  // 렌더하고 목록(그룹 name·멤버 수)은 미렌더한다.
  it('그룹 fetch error 시 에러 alert 를 렌더하고 목록은 미렌더한다 (error path)', () => {
    setRoutes({
      [GROUPS]: { data: undefined, loading: false, error: 'HTTP 401: groups boom' },
    });
    const html = renderToStaticMarkup(<AdminView />);
    // 에러 문구가 alert 로 표면화된다(GroupList error 분기).
    expect(html).toContain('role="alert"');
    expect(html).toContain('HTTP 401: groups boom');
    // error 분기라 그룹 목록(멤버 수)·그룹명은 렌더되지 않는다(data undefined → select 옵션도 없음).
    expect(html).not.toContain('멤버 2명');
    expect(html).not.toContain('데브옵스팀');
  });

  // 분기 — loading 중이면 로딩 표면(role="status" + 로딩 문구) 우선, 목록·에러 미렌더.
  it('그룹 fetch loading 중이면 로딩 표면을 우선 렌더한다 (분기 — loading)', () => {
    setRoutes({
      [GROUPS]: { data: undefined, loading: true, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toContain('불러오는 중…');
    // loading 우선 — 목록(멤버 수) 미렌더.
    expect(html).not.toContain('멤버 2명');
  });

  // 분기 — 빈 배열이면 GroupList 빈 상태 문구를 렌더한다(populated 분기와 대비).
  it('그룹이 0 건이면 빈 상태 문구를 렌더한다 (분기 — 빈 배열)', () => {
    setRoutes({
      [GROUPS]: { data: [], loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toContain('등록된 그룹이 없습니다');
    expect(html).not.toContain('멤버 2명');
  });

  // negative — data 가 undefined(미조회, loading/error 아님)여도 `data ?? []` 로 throw 없이 빈
  // 상태를 렌더한다(경계 방어 — GroupList 가 undefined.length 로 throw 하지 않도록).
  it('data 가 undefined 여도 `data ?? []` 로 throw 없이 빈 상태를 렌더한다 (negative — undefined 경계)', () => {
    setRoutes({
      [GROUPS]: { data: undefined, loading: false, error: undefined },
    });
    // renderToStaticMarkup 이 throw 하지 않고 빈 상태 문구를 낸다.
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toContain('그룹 관리');
    expect(html).toContain('등록된 그룹이 없습니다');
  });

  // negative — name 누락 그룹은 placeholder 로 throw 없이 렌더되고, 다건 그룹이 key 충돌 없이 모두
  // 표면화되며, onEdit(handleEditGroup, T-1150) 배선으로 id 있는 각 행에 수정 버튼이 렌더된다.
  // onDelete(handleDeleteGroup)는 T-1149 로 배선돼 삭제 버튼도 렌더된다(두 mutation 배선 공존).
  it('name 누락·다건 그룹을 throw 없이 렌더하고 id 있는 각 행에 수정 버튼을 렌더한다 (negative — placeholder/다건/onEdit 배선)', () => {
    setRoutes({
      [GROUPS]: {
        data: [
          // name 누락 그룹 → placeholder 로 안전 렌더(members 로 멤버 수는 표시). id 는 있어 수정 버튼 렌더.
          { id: 'gg9', members: [{}] },
          // 정상 그룹 → 다건 key 충돌 없이 함께 렌더.
          { id: 'gg8', name: '보안팀', members: [{}, {}, {}] },
        ],
        loading: false,
        error: undefined,
      },
    });
    const html = renderToStaticMarkup(<AdminView />);
    // name 누락 행은 placeholder 로, 정상 행은 name 으로 함께 렌더(다건 key 중복 없이).
    expect(html).toContain('(이름 없음)');
    expect(html).toContain('보안팀');
    expect(html).toContain('멤버 1명');
    expect(html).toContain('멤버 3명');
    // onEdit(handleEditGroup) 배선 — id 있는 각 행(gg9/gg8)에 수정 버튼이 렌더된다(T-1150).
    expect(html.split('>수정</button>').length - 1).toBe(2);
  });

  // negative — loading 과 error 가 동시에 truthy 면 loading 이 우선한다(GroupList loading 우선 정책).
  it('loading 과 error 가 동시 truthy 면 loading 표면을 우선 렌더한다 (negative — loading 우선)', () => {
    setRoutes({
      [GROUPS]: { data: undefined, loading: true, error: 'HTTP 500: groups boom' },
    });
    const html = renderToStaticMarkup(<AdminView />);
    // loading 우선 — 로딩 문구만 렌더, error 문구는 미렌더.
    expect(html).toContain('불러오는 중…');
    expect(html).not.toContain('HTTP 500: groups boom');
  });
});

// R-112 — T-1152 파트 관리 목록 마운트(신규 GET /api/parts fetch → PartList props 배선) 검증.
// happy(파트명·인원 수 표면화) / error path(에러 alert + 목록 미렌더) / 분기(loading·빈 배열·
// populated) / negative(data undefined 시 `?? []` throw 없이 렌더, name 누락 placeholder, 다건 key
// 중복 없음, onDelete(T-1154)·onEdit(T-1155) 배선 → 각 행에 삭제·수정 버튼 렌더, loading 이 error
// 보다 우선, 파트 mock 추가가 기존 그룹 조회 mock 을 깨지 않음)를 각 1+ cover. PartList 고유 출력(인원 수
// `인원 N명`·빈 문구 `등록된 파트가 없습니다`·placeholder)으로 다른 섹션과 구분해 마운트를 단언한다.
// renderToStaticMarkup + useApiResource mock 으로 data/loading/error 시나리오를 통제한다(jsdom/
// @testing-library 미사용 — ADR-0040 §5 게이트).
describe('AdminView — 파트 관리 목록 마운트 (T-1152)', () => {
  const PARTS = '/api/parts';

  // 파트 2 건 샘플 — PartList 고유 출력(인원 수)까지 검증하도록 persons 배열을 포함한다. 이름은
  // 그룹/인원 SAMPLE 과 겹치지 않는 값으로 두어 마운트 경로를 분리 관찰한다.
  const PART_LIST_ROWS = [
    { id: 'pt1', name: '개발파트', persons: [{}, {}] },
    { id: 'pt2', name: '디자인파트', persons: [{}] },
  ];

  beforeEach(() => {
    useApiResourceMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-path — 파트 1+ 반환 시 파트 관리 섹션에 각 파트 name + PartList 고유 인원 수(`인원 N명`)가
  // 표면화되고, GET /api/parts 는 정확히 한 번만 조회된다(신규 단일 fetch — double-fetch 없음).
  it('파트 fetch 성공 시 파트 관리 섹션에 각 파트 name·인원 수를 목록으로 렌더한다 (happy-path)', () => {
    setRoutes({
      [PARTS]: { data: PART_LIST_ROWS, loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    // GET /api/parts 를 정확히 한 번 조회한다(신규 useApiResource 단일 호출 — double-fetch 없음).
    const paths = useApiResourceMock.mock.calls.map((c) => c[0]);
    expect(paths.filter((p) => p === PARTS)).toHaveLength(1);
    // 파트 관리 heading + 각 파트 name 이 표면화된다.
    expect(html).toContain('파트 관리');
    expect(html).toContain('개발파트');
    expect(html).toContain('디자인파트');
    // PartList 고유 출력 — persons(2)·persons(1) 각각 인원 수 badge.
    expect(html).toContain('인원 2명');
    expect(html).toContain('인원 1명');
  });

  // error path — 파트 fetch 가 error(예: 401)를 반환하면 파트 관리 섹션이 role="alert" 에러를
  // 렌더하고 목록(파트 name·인원 수)은 미렌더한다.
  it('파트 fetch error 시 에러 alert 를 렌더하고 목록은 미렌더한다 (error path)', () => {
    setRoutes({
      [PARTS]: { data: undefined, loading: false, error: 'HTTP 401: parts boom' },
    });
    const html = renderToStaticMarkup(<AdminView />);
    // 에러 문구가 alert 로 표면화된다(PartList error 분기).
    expect(html).toContain('role="alert"');
    expect(html).toContain('HTTP 401: parts boom');
    // error 분기라 파트 목록(인원 수)·파트명은 렌더되지 않는다.
    expect(html).not.toContain('인원 2명');
    expect(html).not.toContain('개발파트');
  });

  // 분기 — loading 중이면 로딩 표면(role="status" + 로딩 문구) 우선, 목록·에러 미렌더.
  it('파트 fetch loading 중이면 로딩 표면을 우선 렌더한다 (분기 — loading)', () => {
    setRoutes({
      [PARTS]: { data: undefined, loading: true, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toContain('불러오는 중…');
    // loading 우선 — 목록(인원 수) 미렌더.
    expect(html).not.toContain('인원 2명');
  });

  // 분기 — 빈 배열이면 PartList 빈 상태 문구를 렌더한다(populated 분기와 대비).
  it('파트가 0 건이면 빈 상태 문구를 렌더한다 (분기 — 빈 배열)', () => {
    setRoutes({
      [PARTS]: { data: [], loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toContain('등록된 파트가 없습니다');
    expect(html).not.toContain('인원 2명');
  });

  // negative — data 가 undefined(미조회, loading/error 아님)여도 `partsData ?? []` 로 throw 없이
  // 빈 상태를 렌더한다(경계 방어 — PartList 가 undefined.length 로 throw 하지 않도록).
  it('data 가 undefined 여도 `partsData ?? []` 로 throw 없이 빈 상태를 렌더한다 (negative — undefined 경계)', () => {
    setRoutes({
      [PARTS]: { data: undefined, loading: false, error: undefined },
    });
    // renderToStaticMarkup 이 throw 하지 않고 빈 상태 문구를 낸다.
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toContain('파트 관리');
    expect(html).toContain('등록된 파트가 없습니다');
  });

  // negative — name 누락 파트는 placeholder 로 throw 없이 렌더되고, 다건 파트가 key 충돌 없이 모두
  // 표면화되며, onDelete(T-1154)·onEdit(T-1155) 둘 다 전달이라 각 행에 삭제·수정 버튼이 part 수만큼
  // 렌더된다.
  it('name 누락·다건 파트를 throw 없이 렌더하고 각 행에 삭제·수정 버튼을 배선한다 (negative — placeholder/다건/onDelete·onEdit 배선)', () => {
    const countOccurrences = (haystack: string, needle: string) =>
      haystack.split(needle).length - 1;
    setRoutes({
      [PARTS]: {
        data: [
          // name 누락 파트 → placeholder 로 안전 렌더(persons 로 인원 수는 표시).
          { id: 'pt9', persons: [{}] },
          // 정상 파트 → 다건 key 충돌 없이 함께 렌더.
          { id: 'pt8', name: '보안파트', persons: [{}, {}, {}] },
        ],
        loading: false,
        error: undefined,
      },
    });
    const html = renderToStaticMarkup(<AdminView />);
    // name 누락 행은 placeholder 로, 정상 행은 name 으로 함께 렌더(다건 key 중복 없이).
    expect(html).toContain('(이름 없음)');
    expect(html).toContain('보안파트');
    expect(html).toContain('인원 1명');
    expect(html).toContain('인원 3명');
    // onDelete 전달(T-1154) → 각 파트 행에 삭제 버튼 렌더(part 수만큼). 그룹·인원 목록은 default
    // EMPTY_OK 라 삭제 버튼을 내지 않으므로 삭제 버튼의 유일 출처는 파트 목록(2 건).
    expect(countOccurrences(html, '>삭제</button>')).toBe(2);
    // onEdit 전달(T-1155) → 각 파트 행에 수정 버튼 렌더(part 수만큼). 그룹·인원 목록은 default
    // EMPTY_OK 라 행이 없어 수정 버튼의 유일 출처도 파트 목록(2 건)이다.
    expect(countOccurrences(html, '>수정</button>')).toBe(2);
  });

  // negative — loading 과 error 가 동시에 truthy 면 loading 이 우선한다(PartList loading 우선 정책).
  it('loading 과 error 가 동시 truthy 면 loading 표면을 우선 렌더한다 (negative — loading 우선)', () => {
    setRoutes({
      [PARTS]: { data: undefined, loading: true, error: 'HTTP 500: parts boom' },
    });
    const html = renderToStaticMarkup(<AdminView />);
    // loading 우선 — 로딩 문구만 렌더, error 문구는 미렌더.
    expect(html).toContain('불러오는 중…');
    expect(html).not.toContain('HTTP 500: parts boom');
  });

  // negative — 파트 조회 mock 추가가 기존 그룹 조회 mock 을 깨지 않는다(공존 회귀). 파트·그룹 route 를
  // 동시에 주입하면 두 섹션(파트명·인원 수 / 그룹명)이 각자 정상 표면화된다.
  it('파트·그룹 route 를 동시 주입해도 두 섹션이 각자 정상 렌더된다 (negative — 기존 mock 비파괴)', () => {
    setRoutes({
      [PARTS]: { data: PART_LIST_ROWS, loading: false, error: undefined },
      [GROUPS]: {
        data: [{ id: 'gg7', name: '플랫폼팀', members: [{}, {}] }],
        loading: false,
        error: undefined,
      },
    });
    const html = renderToStaticMarkup(<AdminView />);
    // 파트 섹션 — 파트명·인원 수 표면화.
    expect(html).toContain('개발파트');
    expect(html).toContain('인원 2명');
    // 그룹 섹션 — 그룹명·멤버 수 표면화(파트 mock 추가로 깨지지 않음).
    expect(html).toContain('플랫폼팀');
    expect(html).toContain('멤버 2명');
  });
});

// R-112 — T-1153 파트 생성 폼 배선 렌더 검증. 파트 관리 섹션에 name input(aria-label) + "파트 추가"
// 버튼이 마운트되고, 초기(빈 필드)엔 버튼이 disabled 로 렌더됨을 정적 markup 으로 단언한다(클릭→러너
// 호출 자체는 위 runCreatePart 단위 test 가 cover — 본 파일은 jsdom 미사용 정적 렌더라 이벤트 비검증).
// 초기엔 실패 문구 alert(createPartError) 가 미렌더됨도 확인한다(그룹 생성 폼 배선 test 동형).
describe('AdminView — 파트 생성 폼 배선 (정적 렌더, T-1153)', () => {
  const PARTS = '/api/parts';

  beforeEach(() => {
    useApiResourceMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-path — 파트 관리 섹션에 name input(aria-label) + "파트 추가" 버튼이 마운트된다.
  it('파트 관리 섹션에 name input + "파트 추가" 버튼을 렌더한다 (happy-path)', () => {
    setRoutes({ [PARTS]: { data: [], loading: false, error: undefined } });
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toContain('aria-label="추가할 파트 이름"');
    expect(html).toContain('파트 추가</button>');
  });

  // branch — 초기(빈 필드) 마운트 시 생성 버튼이 disabled 로 렌더된다(빈 필드 발사 억제 UI 반영).
  it('초기(빈 필드) 마운트 시 파트 추가 버튼이 disabled 로 렌더된다 (branch — 빈 필드 버튼 비활성)', () => {
    setRoutes({ [PARTS]: { data: [], loading: false, error: undefined } });
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toMatch(/<button[^>]*disabled[^>]*>파트 추가<\/button>/);
  });

  // negative — 초기엔 생성 실패 문구(createPartError=undefined)라 파트 폼 하단 alert 이 미렌더된다.
  // (파트·그룹 목록이 빈 배열이라 목록 error alert 도 없음 — 폼/목록 통틀어 alert 부재).
  it('초기엔 파트 생성 실패 alert 을 렌더하지 않는다 (negative — createPartError 미설정)', () => {
    setRoutes({
      [PARTS]: { data: [], loading: false, error: undefined },
      [GROUPS]: { data: [], loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).not.toContain('role="alert"');
  });
});

// R-112 — T-1144 인원 삭제 실 DELETE mutation 본체(runDeletePerson) 검증. jsdom/렌더러 없이
// mutation 본체를 직접 호출하고(runDeleteProvider 와 동일 convention), apiClient.request mock 으로
// method/path 를 단언하며 성공/실패 분기 응답을 주입한다. 상태 전이는 record harness 의 콜백
// 호출로 관찰한다. happy/error(404·403·네트워크)/branch(빈·공백·in-flight·단일 발사)/negative
// 예외 분기마다 각 1+ cover.
describe('AdminView — 인원 삭제 실 DELETE mutation (T-1144 runDeletePerson)', () => {
  // 상태 전이를 기록하는 deps harness — deleting 초기값과 request mock 을 주입받아
  // setDeleting/setDeleteError 호출과 bumpRefresh 호출 횟수를 순서대로 캡처한다(runDeleteProvider 동형).
  function makeDeleteDeps(deleting: boolean) {
    const calls = {
      deleting: [] as boolean[],
      error: [] as (string | undefined)[],
      bump: 0,
    };
    const deps: DeletePersonDeps = {
      remove: (...args: unknown[]) => requestMock(...args),
      describeError: (e: unknown) => {
        // toErrorMessage stub 과 정합 — ApiError.status → 문구.
        if (e instanceof ApiError) {
          return e.status === 0
            ? `네트워크 오류: ${e.message}`
            : `HTTP ${e.status}: ${e.message}`;
        }
        return '알 수 없는 오류';
      },
      deleting,
      setDeleting: (next) => calls.deleting.push(next),
      setDeleteError: (next) => calls.error.push(next),
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

  // happy-path — 삭제 트리거 시 request 가 DELETE /api/persons/<id> 로 method DELETE 인 인자로
  // 정확히 호출되고, 성공 후 재조회 nonce 를 bump(bumpRefresh 1 회) + error 미설정(시작 비움만) +
  // 진행 표시(deleting) on→off 로 해제된다.
  it('DELETE /api/persons/<id> 를 method DELETE 로 정확히 호출하고 성공 시 재조회 nonce 를 bump 한다 (happy-path)', async () => {
    requestMock.mockResolvedValue(undefined); // 204 No Content — body 없음.
    const { deps, calls } = makeDeleteDeps(false);
    await runDeletePerson('pp1', deps);
    expect(requestMock).toHaveBeenCalledTimes(1);
    const [path, options] = requestMock.mock.calls[0] as [
      string,
      { method: string },
    ];
    expect(path).toBe('/api/persons/pp1');
    expect(options.method).toBe('DELETE');
    // 성공 → 재조회 nonce bump 1 회 + error 시작 비움만(실패 문구 미설정).
    expect(calls.bump).toBe(1);
    expect(calls.error).toEqual([undefined]);
    // 진행 표시 on→off(finally 공통 해제).
    expect(calls.deleting).toEqual([true, false]);
  });

  // error path — 404(NotFound, row 부재) 실패 시 error 문구가 표면화되고 throw 없이 처리되며
  // 재조회 nonce 는 bump 되지 않는다(목록 그대로 유지).
  it('삭제 404(NotFound, row 부재) 실패 시 error 문구를 표면화하고 nonce 를 bump 하지 않는다 (error path — 404)', async () => {
    requestMock.mockRejectedValue(new ApiError(404, 'Not Found'));
    const { deps, calls } = makeDeleteDeps(false);
    await expect(runDeletePerson('ghost', deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 404: Not Found']);
    expect(calls.bump).toBe(0);
    expect(calls.deleting).toEqual([true, false]);
  });

  // error path — 403(Admin+ 미만) 실패 시 안전 문구 표면화(throw 없음).
  it('삭제 403(Admin+ 미만) 실패 시 안전 문구를 표면화한다 (error path — 403)', async () => {
    requestMock.mockRejectedValue(new ApiError(403, 'Forbidden'));
    const { deps, calls } = makeDeleteDeps(false);
    await expect(runDeletePerson('pp1', deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 403: Forbidden']);
    expect(calls.bump).toBe(0);
  });

  // error path — 네트워크 실패(ApiError(0)) 시 네트워크 오류 문구(throw 없음).
  it('삭제 네트워크 실패(ApiError 0) 시 네트워크 오류 문구를 표면화한다 (error path — 네트워크)', async () => {
    requestMock.mockRejectedValue(new ApiError(0, 'fetch failed'));
    const { deps, calls } = makeDeleteDeps(false);
    await expect(runDeletePerson('pp1', deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, '네트워크 오류: fetch failed']);
    expect(calls.bump).toBe(0);
  });

  // branch (a) — 빈/falsy id → DELETE 미발사·state 불변·throw 없음(잘못된 path 회피).
  it('빈/falsy id 이면 DELETE 를 발사하지 않는다 (branch (a) — 빈 id)', async () => {
    const { deps, calls } = makeDeleteDeps(false);
    await expect(runDeletePerson('', deps)).resolves.toBeUndefined();
    await expect(
      runDeletePerson(undefined as unknown as string, deps),
    ).resolves.toBeUndefined();
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.deleting).toEqual([]);
    expect(calls.error).toEqual([]);
    expect(calls.bump).toBe(0);
  });

  // branch (a2)/negative — 공백만 든 id(trim 후 빈 문자열) 도 DELETE 미발사(경계값 방어).
  it('공백만 든 id 이면 trim 후 빈 문자열로 판정해 DELETE 를 발사하지 않는다 (negative — 공백 id 경계값)', async () => {
    const { deps, calls } = makeDeleteDeps(false);
    await expect(runDeletePerson('   ', deps)).resolves.toBeUndefined();
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.deleting).toEqual([]);
    expect(calls.bump).toBe(0);
  });

  // branch (b) — 이전 삭제 미완(deleting=true) 중 재호출은 DELETE 미발사·state 불변(이중 DELETE·
  // 경합 차단 — runDeleteProvider deleting 가드 동형).
  it('이전 삭제 미완(deleting=true) 중 재호출은 DELETE 를 발사하지 않는다 (branch (b) — 이중 DELETE 가드)', async () => {
    const { deps, calls } = makeDeleteDeps(true); // 이미 in-flight.
    await runDeletePerson('pp1', deps);
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.deleting).toEqual([]);
    expect(calls.error).toEqual([]);
    expect(calls.bump).toBe(0);
  });

  // branch (c) — 정상 발사 시 DELETE 1 회만(중복 없음). happy-path 와 짝을 이루는 발사 횟수 단언.
  it('정상 발사 시 DELETE 를 1 회만 호출한다 (branch (c) — 단일 발사)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps } = makeDeleteDeps(false);
    await runDeletePerson('pp2', deps);
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(requestMock.mock.calls[0]?.[0]).toBe('/api/persons/pp2');
  });

  // negative — id 특수문자 포함 시 encodeURIComponent 로 path 안전 인코딩됨(path 주입 방어).
  it('id 특수문자를 encodeURIComponent 로 안전 인코딩한다 (negative — 특수문자 인코딩)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps } = makeDeleteDeps(false);
    await runDeletePerson('pp 1/x', deps);
    expect(requestMock.mock.calls[0]?.[0]).toBe('/api/persons/pp%201%2Fx');
  });

  // negative — 성공·실패 어느 경로든 finally 가 setDeleting(false) 로 진행 표시를 복구한다.
  it('성공·실패 어느 경우든 진행 표시(deleting)가 finally 로 해제된다 (negative — 진행 해제)', async () => {
    requestMock.mockResolvedValueOnce(undefined);
    const ok = makeDeleteDeps(false);
    await runDeletePerson('pp1', ok.deps);
    expect(ok.calls.deleting).toEqual([true, false]);

    requestMock.mockRejectedValueOnce(new ApiError(500, 'boom'));
    const fail = makeDeleteDeps(false);
    await runDeletePerson('pp1', fail.deps);
    expect(fail.calls.deleting).toEqual([true, false]);
  });

  // negative(시작 정리) — 발사 직후 진행 표시 on + 직전 error 즉시 비움을 지연 resolve 로 캡처한다
  // (재조회 도착 전 crash 없음 + 실패 후 재시도 시 직전 error 가 진행 중 남지 않음).
  it('발사 직후 진행 표시 on + 직전 error 를 즉시 비운다 (negative — 시작 정리/재조회 전 안전)', async () => {
    let resolveDelete: () => void = () => {};
    requestMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        }),
    );
    const { deps, calls } = makeDeleteDeps(false);
    const pending = runDeletePerson('pp1', deps);
    // 발사 직후(해소 전) — 진행 on + error 시작 비움 + 재조회 아직 미bump(crash 없음).
    expect(calls.deleting).toEqual([true]);
    expect(calls.error).toEqual([undefined]);
    expect(calls.bump).toBe(0);
    // 해소 후 — 재조회 bump + 진행 off.
    resolveDelete();
    await pending;
    expect(calls.bump).toBe(1);
    expect(calls.deleting).toEqual([true, false]);
  });

  // negative — 실패 후 재시도(재클릭)는 직전 error 를 비우고 정상 재발화한다(시작 비움 → 성공 bump).
  it('실패 후 재시도(재클릭)는 직전 error 를 비우고 정상 재발화한다 (negative — 실패 후 재시도)', async () => {
    requestMock.mockRejectedValueOnce(new ApiError(500, 'boom'));
    const first = makeDeleteDeps(false);
    await runDeletePerson('pp1', first.deps);
    expect(first.calls.error).toEqual([undefined, 'HTTP 500: boom']);
    expect(first.calls.bump).toBe(0);

    requestMock.mockResolvedValueOnce(undefined);
    const second = makeDeleteDeps(false);
    await runDeletePerson('pp1', second.deps);
    expect(second.calls.error).toEqual([undefined]);
    expect(second.calls.bump).toBe(1);
  });
});

// R-112 — T-1144 인원 삭제 배선 렌더 검증. 인원 관리 마운트(PersonList)에 onDelete=handleDeletePerson
// 이 배선돼 각 인원 행에 "삭제" 버튼이 person 수만큼 렌더됨을 정적 markup 으로 단언한다(클릭→러너
// 호출 자체는 위 runDeletePerson 단위 test 가 cover — 본 파일은 jsdom 미사용 정적 렌더라 이벤트
// 비검증). 비-Admin 등급으로 두어 provider 목록 패널의 "삭제" 버튼과 섞이지 않게 격리한다(인원
// 섹션은 gating 밖이라 비-Admin 에도 렌더된다).
describe('AdminView — 인원 삭제 배선 (정적 렌더, T-1144)', () => {
  const PERSONS = '/api/persons';
  const countOccurrences = (haystack: string, needle: string) =>
    haystack.split(needle).length - 1;

  // 인원 2 건 샘플 — 각 행에 삭제 버튼이 배선됨을 person 수(2)로 단언한다.
  const PERSON_ROWS: PersonRow[] = [
    { id: 'pp1', fullName: '김인원', email: 'kim@example.com', active: true },
    { id: 'pp2', fullName: '이휴직', email: 'lee@example.com', active: false },
  ];

  beforeEach(() => {
    useApiResourceMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-path — 인원 목록이 있으면 각 행에 삭제 버튼(onDelete=handleDeletePerson 배선)이 person
  // 수만큼 렌더된다. 비-Admin 이라 provider 목록 패널은 미마운트 → "삭제" 버튼의 유일 출처는 인원 목록.
  it('인원 목록이 있으면 각 행에 삭제 버튼을 렌더한다 (happy-path — onDelete 배선)', () => {
    setRoutes({
      [PERSONS]: { data: PERSON_ROWS, loading: false, error: undefined },
      [AUTH_ME]: { data: { role: 'User' }, loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    // 삭제 버튼이 person 수만큼 렌더된다(인원 표시명과 함께).
    expect(html).toContain('김인원');
    expect(countOccurrences(html, '>삭제</button>')).toBe(PERSON_ROWS.length);
  });

  // branch/negative — 인원이 0 건이면 렌더할 행이 없어 삭제 버튼이 미렌더된다(빈 상태 문구만).
  it('인원이 0 건이면 삭제 버튼을 렌더하지 않는다 (branch/negative — 빈 목록)', () => {
    setRoutes({
      [PERSONS]: { data: [], loading: false, error: undefined },
      [AUTH_ME]: { data: { role: 'User' }, loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toContain('등록된 인원이 없습니다');
    expect(countOccurrences(html, '>삭제</button>')).toBe(0);
  });
});

// R-112 — T-1149 그룹 삭제 실 DELETE mutation 본체(runDeleteGroup) 검증. jsdom/렌더러 없이
// mutation 본체를 직접 호출하고(runDeletePerson 과 동일 convention), apiClient.request mock 으로
// method/path 를 단언하며 성공/실패 분기 응답을 주입한다. 상태 전이는 record harness 의 콜백
// 호출로 관찰한다. happy/error(404·403·네트워크)/branch(빈·공백·in-flight·단일 발사)/negative
// 예외 분기마다 각 1+ cover.
describe('AdminView — 그룹 삭제 실 DELETE mutation (T-1149 runDeleteGroup)', () => {
  // 상태 전이를 기록하는 deps harness — deleting 초기값과 request mock 을 주입받아
  // setDeleting/setDeleteError 호출과 bumpRefresh 호출 횟수를 순서대로 캡처한다(runDeletePerson 동형).
  function makeDeleteDeps(deleting: boolean) {
    const calls = {
      deleting: [] as boolean[],
      error: [] as (string | undefined)[],
      bump: 0,
    };
    const deps: DeleteGroupDeps = {
      remove: (...args: unknown[]) => requestMock(...args),
      describeError: (e: unknown) => {
        // toErrorMessage stub 과 정합 — ApiError.status → 문구.
        if (e instanceof ApiError) {
          return e.status === 0
            ? `네트워크 오류: ${e.message}`
            : `HTTP ${e.status}: ${e.message}`;
        }
        return '알 수 없는 오류';
      },
      deleting,
      setDeleting: (next) => calls.deleting.push(next),
      setDeleteError: (next) => calls.error.push(next),
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

  // happy-path — 삭제 트리거 시 request 가 DELETE /api/groups/<id> 로 method DELETE 인 인자로
  // 정확히 호출되고, 성공 후 재조회 nonce 를 bump(bumpRefresh 1 회) + error 미설정(시작 비움만) +
  // 진행 표시(deleting) on→off 로 해제된다.
  it('DELETE /api/groups/<id> 를 method DELETE 로 정확히 호출하고 성공 시 재조회 nonce 를 bump 한다 (happy-path)', async () => {
    requestMock.mockResolvedValue(undefined); // 204 No Content — body 없음.
    const { deps, calls } = makeDeleteDeps(false);
    await runDeleteGroup('gg1', deps);
    expect(requestMock).toHaveBeenCalledTimes(1);
    const [path, options] = requestMock.mock.calls[0] as [
      string,
      { method: string },
    ];
    expect(path).toBe('/api/groups/gg1');
    expect(options.method).toBe('DELETE');
    // 성공 → 재조회 nonce bump 1 회 + error 시작 비움만(실패 문구 미설정).
    expect(calls.bump).toBe(1);
    expect(calls.error).toEqual([undefined]);
    // 진행 표시 on→off(finally 공통 해제).
    expect(calls.deleting).toEqual([true, false]);
  });

  // error path — 404(NotFound, row 부재) 실패 시 error 문구가 표면화되고 throw 없이 처리되며
  // 재조회 nonce 는 bump 되지 않는다(목록 그대로 유지).
  it('삭제 404(NotFound, row 부재) 실패 시 error 문구를 표면화하고 nonce 를 bump 하지 않는다 (error path — 404)', async () => {
    requestMock.mockRejectedValue(new ApiError(404, 'Not Found'));
    const { deps, calls } = makeDeleteDeps(false);
    await expect(runDeleteGroup('ghost', deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 404: Not Found']);
    expect(calls.bump).toBe(0);
    expect(calls.deleting).toEqual([true, false]);
  });

  // error path — 403(Admin+ 미만) 실패 시 안전 문구 표면화(throw 없음).
  it('삭제 403(Admin+ 미만) 실패 시 안전 문구를 표면화한다 (error path — 403)', async () => {
    requestMock.mockRejectedValue(new ApiError(403, 'Forbidden'));
    const { deps, calls } = makeDeleteDeps(false);
    await expect(runDeleteGroup('gg1', deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 403: Forbidden']);
    expect(calls.bump).toBe(0);
  });

  // error path — 네트워크 실패(ApiError(0)) 시 네트워크 오류 문구(throw 없음).
  it('삭제 네트워크 실패(ApiError 0) 시 네트워크 오류 문구를 표면화한다 (error path — 네트워크)', async () => {
    requestMock.mockRejectedValue(new ApiError(0, 'fetch failed'));
    const { deps, calls } = makeDeleteDeps(false);
    await expect(runDeleteGroup('gg1', deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, '네트워크 오류: fetch failed']);
    expect(calls.bump).toBe(0);
  });

  // branch (a) — 빈/falsy id → DELETE 미발사·state 불변·throw 없음(잘못된 path 회피).
  it('빈/falsy id 이면 DELETE 를 발사하지 않는다 (branch (a) — 빈 id)', async () => {
    const { deps, calls } = makeDeleteDeps(false);
    await expect(runDeleteGroup('', deps)).resolves.toBeUndefined();
    await expect(
      runDeleteGroup(undefined as unknown as string, deps),
    ).resolves.toBeUndefined();
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.deleting).toEqual([]);
    expect(calls.error).toEqual([]);
    expect(calls.bump).toBe(0);
  });

  // branch (a2)/negative — 공백만 든 id(trim 후 빈 문자열) 도 DELETE 미발사(경계값 방어).
  it('공백만 든 id 이면 trim 후 빈 문자열로 판정해 DELETE 를 발사하지 않는다 (negative — 공백 id 경계값)', async () => {
    const { deps, calls } = makeDeleteDeps(false);
    await expect(runDeleteGroup('   ', deps)).resolves.toBeUndefined();
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.deleting).toEqual([]);
    expect(calls.bump).toBe(0);
  });

  // branch (b) — 이전 삭제 미완(deleting=true) 중 재호출은 DELETE 미발사·state 불변(이중 DELETE·
  // 경합 차단 — runDeletePerson deleting 가드 동형).
  it('이전 삭제 미완(deleting=true) 중 재호출은 DELETE 를 발사하지 않는다 (branch (b) — 이중 DELETE 가드)', async () => {
    const { deps, calls } = makeDeleteDeps(true); // 이미 in-flight.
    await runDeleteGroup('gg1', deps);
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.deleting).toEqual([]);
    expect(calls.error).toEqual([]);
    expect(calls.bump).toBe(0);
  });

  // branch (c) — 정상 발사 시 DELETE 1 회만(중복 없음). happy-path 와 짝을 이루는 발사 횟수 단언.
  it('정상 발사 시 DELETE 를 1 회만 호출한다 (branch (c) — 단일 발사)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps } = makeDeleteDeps(false);
    await runDeleteGroup('gg2', deps);
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(requestMock.mock.calls[0]?.[0]).toBe('/api/groups/gg2');
  });

  // negative — id 특수문자 포함 시 encodeURIComponent 로 path 안전 인코딩됨(path 주입 방어).
  it('id 특수문자를 encodeURIComponent 로 안전 인코딩한다 (negative — 특수문자 인코딩)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps } = makeDeleteDeps(false);
    await runDeleteGroup('gg 1/x', deps);
    expect(requestMock.mock.calls[0]?.[0]).toBe('/api/groups/gg%201%2Fx');
  });

  // negative — 성공·실패 어느 경로든 finally 가 setDeleting(false) 로 진행 표시를 복구한다.
  it('성공·실패 어느 경우든 진행 표시(deleting)가 finally 로 해제된다 (negative — 진행 해제)', async () => {
    requestMock.mockResolvedValueOnce(undefined);
    const ok = makeDeleteDeps(false);
    await runDeleteGroup('gg1', ok.deps);
    expect(ok.calls.deleting).toEqual([true, false]);

    requestMock.mockRejectedValueOnce(new ApiError(500, 'boom'));
    const fail = makeDeleteDeps(false);
    await runDeleteGroup('gg1', fail.deps);
    expect(fail.calls.deleting).toEqual([true, false]);
  });

  // negative(시작 정리) — 발사 직후 진행 표시 on + 직전 error 즉시 비움을 지연 resolve 로 캡처한다
  // (재조회 도착 전 crash 없음 + 실패 후 재시도 시 직전 error 가 진행 중 남지 않음).
  it('발사 직후 진행 표시 on + 직전 error 를 즉시 비운다 (negative — 시작 정리/재조회 전 안전)', async () => {
    let resolveDelete: () => void = () => {};
    requestMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        }),
    );
    const { deps, calls } = makeDeleteDeps(false);
    const pending = runDeleteGroup('gg1', deps);
    // 발사 직후(해소 전) — 진행 on + error 시작 비움 + 재조회 아직 미bump(crash 없음).
    expect(calls.deleting).toEqual([true]);
    expect(calls.error).toEqual([undefined]);
    expect(calls.bump).toBe(0);
    // 해소 후 — 재조회 bump + 진행 off.
    resolveDelete();
    await pending;
    expect(calls.bump).toBe(1);
    expect(calls.deleting).toEqual([true, false]);
  });

  // negative — 실패 후 재시도(재클릭)는 직전 error 를 비우고 정상 재발화한다(시작 비움 → 성공 bump).
  it('실패 후 재시도(재클릭)는 직전 error 를 비우고 정상 재발화한다 (negative — 실패 후 재시도)', async () => {
    requestMock.mockRejectedValueOnce(new ApiError(500, 'boom'));
    const first = makeDeleteDeps(false);
    await runDeleteGroup('gg1', first.deps);
    expect(first.calls.error).toEqual([undefined, 'HTTP 500: boom']);
    expect(first.calls.bump).toBe(0);

    requestMock.mockResolvedValueOnce(undefined);
    const second = makeDeleteDeps(false);
    await runDeleteGroup('gg1', second.deps);
    expect(second.calls.error).toEqual([undefined]);
    expect(second.calls.bump).toBe(1);
  });
});

// R-112 — T-1149 그룹 삭제 배선 렌더 검증. 그룹 관리 마운트(GroupList)에 onDelete=handleDeleteGroup
// 이 배선돼 각 그룹 행에 "삭제" 버튼이 group 수만큼 렌더됨을 정적 markup 으로 단언한다(클릭→러너
// 호출 자체는 위 runDeleteGroup 단위 test 가 cover — 본 파일은 jsdom 미사용 정적 렌더라 이벤트
// 비검증). 비-Admin 등급으로 두어 provider 목록 패널의 "삭제" 버튼과 섞이지 않게 격리한다(그룹
// 섹션은 gating 밖이라 비-Admin 에도 렌더된다). persons 는 기본 빈 목록이라 인원 삭제 버튼과도 분리.
describe('AdminView — 그룹 삭제 배선 (정적 렌더, T-1149)', () => {
  const countOccurrences = (haystack: string, needle: string) =>
    haystack.split(needle).length - 1;

  // 그룹 2 건 샘플 — 각 행에 삭제 버튼이 배선됨을 group 수(2)로 단언한다.
  const GROUP_ROWS = [
    { id: 'gg1', name: '데브옵스팀', members: [{}, {}] },
    { id: 'gg2', name: '디자인팀', members: [{}] },
  ];

  beforeEach(() => {
    useApiResourceMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-path — 그룹 목록이 있으면 각 행에 삭제 버튼(onDelete=handleDeleteGroup 배선)이 group
  // 수만큼 렌더된다. 비-Admin 이라 provider 목록 패널은 미마운트 + persons 빈 목록 → "삭제" 버튼의
  // 유일 출처는 그룹 목록.
  it('그룹 목록이 있으면 각 행에 삭제 버튼을 렌더한다 (happy-path — onDelete 배선)', () => {
    setRoutes({
      [GROUPS]: { data: GROUP_ROWS, loading: false, error: undefined },
      [AUTH_ME]: { data: { role: 'User' }, loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    // 삭제 버튼이 group 수만큼 렌더된다(그룹명과 함께).
    expect(html).toContain('데브옵스팀');
    expect(countOccurrences(html, '>삭제</button>')).toBe(GROUP_ROWS.length);
  });

  // branch/negative — 그룹이 0 건이면 렌더할 행이 없어 삭제 버튼이 미렌더된다(빈 상태 문구만).
  it('그룹이 0 건이면 삭제 버튼을 렌더하지 않는다 (branch/negative — 빈 목록)', () => {
    setRoutes({
      [GROUPS]: { data: [], loading: false, error: undefined },
      [AUTH_ME]: { data: { role: 'User' }, loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toContain('등록된 그룹이 없습니다');
    expect(countOccurrences(html, '>삭제</button>')).toBe(0);
  });
});

// R-112 — T-1154 파트 삭제 실 DELETE mutation 본체(runDeletePart) 검증. jsdom/렌더러 없이
// mutation 본체를 직접 호출하고(runDeleteGroup 과 동일 convention), apiClient.request mock 으로
// method/path 를 단언하며 성공/실패 분기 응답을 주입한다. 상태 전이는 record harness 의 콜백
// 호출로 관찰한다. happy/error(404·403·네트워크·500)/branch(빈·공백·in-flight·단일 발사)/negative
// 예외 분기마다 각 1+ cover.
describe('AdminView — 파트 삭제 실 DELETE mutation (T-1154 runDeletePart)', () => {
  // 상태 전이를 기록하는 deps harness — deleting 초기값과 request mock 을 주입받아
  // setDeleting/setDeleteError 호출과 bumpRefresh 호출 횟수를 순서대로 캡처한다(runDeleteGroup 동형).
  function makeDeleteDeps(deleting: boolean) {
    const calls = {
      deleting: [] as boolean[],
      error: [] as (string | undefined)[],
      bump: 0,
    };
    const deps: DeletePartDeps = {
      remove: (...args: unknown[]) => requestMock(...args),
      describeError: (e: unknown) => {
        // toErrorMessage stub 과 정합 — ApiError.status → 문구.
        if (e instanceof ApiError) {
          return e.status === 0
            ? `네트워크 오류: ${e.message}`
            : `HTTP ${e.status}: ${e.message}`;
        }
        return '알 수 없는 오류';
      },
      deleting,
      setDeleting: (next) => calls.deleting.push(next),
      setDeleteError: (next) => calls.error.push(next),
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

  // happy-path — 삭제 트리거 시 request 가 DELETE /api/parts/<id> 로 method DELETE 인 인자로
  // 정확히 호출되고, 성공 후 재조회 nonce 를 bump(bumpRefresh 1 회) + error 미설정(시작 비움만) +
  // 진행 표시(deleting) on→off 로 해제된다.
  it('DELETE /api/parts/<id> 를 method DELETE 로 정확히 호출하고 성공 시 재조회 nonce 를 bump 한다 (happy-path)', async () => {
    requestMock.mockResolvedValue(undefined); // 204 No Content — body 없음.
    const { deps, calls } = makeDeleteDeps(false);
    await runDeletePart('pt1', deps);
    expect(requestMock).toHaveBeenCalledTimes(1);
    const [path, options] = requestMock.mock.calls[0] as [
      string,
      { method: string },
    ];
    expect(path).toBe('/api/parts/pt1');
    expect(options.method).toBe('DELETE');
    // 성공 → 재조회 nonce bump 1 회 + error 시작 비움만(실패 문구 미설정).
    expect(calls.bump).toBe(1);
    expect(calls.error).toEqual([undefined]);
    // 진행 표시 on→off(finally 공통 해제).
    expect(calls.deleting).toEqual([true, false]);
  });

  // error path — 404(NotFound, row 부재) 실패 시 error 문구가 표면화되고 throw 없이 처리되며
  // 재조회 nonce 는 bump 되지 않는다(목록 그대로 유지).
  it('삭제 404(NotFound, row 부재) 실패 시 error 문구를 표면화하고 nonce 를 bump 하지 않는다 (error path — 404)', async () => {
    requestMock.mockRejectedValue(new ApiError(404, 'Not Found'));
    const { deps, calls } = makeDeleteDeps(false);
    await expect(runDeletePart('ghost', deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 404: Not Found']);
    expect(calls.bump).toBe(0);
    expect(calls.deleting).toEqual([true, false]);
  });

  // error path — 403(Admin+ 미만) 실패 시 안전 문구 표면화(throw 없음).
  it('삭제 403(Admin+ 미만) 실패 시 안전 문구를 표면화한다 (error path — 403)', async () => {
    requestMock.mockRejectedValue(new ApiError(403, 'Forbidden'));
    const { deps, calls } = makeDeleteDeps(false);
    await expect(runDeletePart('pt1', deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 403: Forbidden']);
    expect(calls.bump).toBe(0);
  });

  // error path — 네트워크 실패(ApiError(0)) 시 네트워크 오류 문구(throw 없음).
  it('삭제 네트워크 실패(ApiError 0) 시 네트워크 오류 문구를 표면화한다 (error path — 네트워크)', async () => {
    requestMock.mockRejectedValue(new ApiError(0, 'fetch failed'));
    const { deps, calls } = makeDeleteDeps(false);
    await expect(runDeletePart('pt1', deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, '네트워크 오류: fetch failed']);
    expect(calls.bump).toBe(0);
  });

  // error path — 500(비-2xx) 실패 시 안전 문구 표면화(throw 없음, 예외 분기 추가 cover).
  it('삭제 500(비-2xx) 실패 시 안전 문구를 표면화한다 (error path — 500)', async () => {
    requestMock.mockRejectedValue(new ApiError(500, 'boom'));
    const { deps, calls } = makeDeleteDeps(false);
    await expect(runDeletePart('pt1', deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 500: boom']);
    expect(calls.bump).toBe(0);
  });

  // branch (a) — 빈/falsy id → DELETE 미발사·state 불변·throw 없음(잘못된 path 회피).
  it('빈/falsy id 이면 DELETE 를 발사하지 않는다 (branch (a) — 빈 id)', async () => {
    const { deps, calls } = makeDeleteDeps(false);
    await expect(runDeletePart('', deps)).resolves.toBeUndefined();
    await expect(
      runDeletePart(undefined as unknown as string, deps),
    ).resolves.toBeUndefined();
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.deleting).toEqual([]);
    expect(calls.error).toEqual([]);
    expect(calls.bump).toBe(0);
  });

  // branch (a2)/negative — 공백만 든 id(trim 후 빈 문자열) 도 DELETE 미발사(경계값 방어).
  it('공백만 든 id 이면 trim 후 빈 문자열로 판정해 DELETE 를 발사하지 않는다 (negative — 공백 id 경계값)', async () => {
    const { deps, calls } = makeDeleteDeps(false);
    await expect(runDeletePart('   ', deps)).resolves.toBeUndefined();
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.deleting).toEqual([]);
    expect(calls.bump).toBe(0);
  });

  // branch (b) — 이전 삭제 미완(deleting=true) 중 재호출은 DELETE 미발사·state 불변(이중 DELETE·
  // 경합 차단 — runDeleteGroup deleting 가드 동형).
  it('이전 삭제 미완(deleting=true) 중 재호출은 DELETE 를 발사하지 않는다 (branch (b) — 이중 DELETE 가드)', async () => {
    const { deps, calls } = makeDeleteDeps(true); // 이미 in-flight.
    await runDeletePart('pt1', deps);
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.deleting).toEqual([]);
    expect(calls.error).toEqual([]);
    expect(calls.bump).toBe(0);
  });

  // branch (c) — 정상 발사 시 DELETE 1 회만(중복 없음). happy-path 와 짝을 이루는 발사 횟수 단언.
  it('정상 발사 시 DELETE 를 1 회만 호출한다 (branch (c) — 단일 발사)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps } = makeDeleteDeps(false);
    await runDeletePart('pt2', deps);
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(requestMock.mock.calls[0]?.[0]).toBe('/api/parts/pt2');
  });

  // negative — id 특수문자 포함 시 encodeURIComponent 로 path 안전 인코딩됨(path 주입 방어).
  it('id 특수문자를 encodeURIComponent 로 안전 인코딩한다 (negative — 특수문자 인코딩)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps } = makeDeleteDeps(false);
    await runDeletePart('pt 1/x', deps);
    expect(requestMock.mock.calls[0]?.[0]).toBe('/api/parts/pt%201%2Fx');
  });

  // negative — 성공·실패 어느 경로든 finally 가 setDeleting(false) 로 진행 표시를 복구한다.
  it('성공·실패 어느 경우든 진행 표시(deleting)가 finally 로 해제된다 (negative — 진행 해제)', async () => {
    requestMock.mockResolvedValueOnce(undefined);
    const ok = makeDeleteDeps(false);
    await runDeletePart('pt1', ok.deps);
    expect(ok.calls.deleting).toEqual([true, false]);

    requestMock.mockRejectedValueOnce(new ApiError(500, 'boom'));
    const fail = makeDeleteDeps(false);
    await runDeletePart('pt1', fail.deps);
    expect(fail.calls.deleting).toEqual([true, false]);
  });

  // negative(시작 정리) — 발사 직후 진행 표시 on + 직전 error 즉시 비움을 지연 resolve 로 캡처한다
  // (재조회 도착 전 crash 없음 + 실패 후 재시도 시 직전 error 가 진행 중 남지 않음).
  it('발사 직후 진행 표시 on + 직전 error 를 즉시 비운다 (negative — 시작 정리/재조회 전 안전)', async () => {
    let resolveDelete: () => void = () => {};
    requestMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        }),
    );
    const { deps, calls } = makeDeleteDeps(false);
    const pending = runDeletePart('pt1', deps);
    // 발사 직후(해소 전) — 진행 on + error 시작 비움 + 재조회 아직 미bump(crash 없음).
    expect(calls.deleting).toEqual([true]);
    expect(calls.error).toEqual([undefined]);
    expect(calls.bump).toBe(0);
    // 해소 후 — 재조회 bump + 진행 off.
    resolveDelete();
    await pending;
    expect(calls.bump).toBe(1);
    expect(calls.deleting).toEqual([true, false]);
  });

  // negative — 실패 후 재시도(재클릭)는 직전 error 를 비우고 정상 재발화한다(시작 비움 → 성공 bump).
  it('실패 후 재시도(재클릭)는 직전 error 를 비우고 정상 재발화한다 (negative — 실패 후 재시도)', async () => {
    requestMock.mockRejectedValueOnce(new ApiError(500, 'boom'));
    const first = makeDeleteDeps(false);
    await runDeletePart('pt1', first.deps);
    expect(first.calls.error).toEqual([undefined, 'HTTP 500: boom']);
    expect(first.calls.bump).toBe(0);

    requestMock.mockResolvedValueOnce(undefined);
    const second = makeDeleteDeps(false);
    await runDeletePart('pt1', second.deps);
    expect(second.calls.error).toEqual([undefined]);
    expect(second.calls.bump).toBe(1);
  });
});

// R-112 — T-1154 파트 삭제 배선 렌더 검증. 파트 관리 마운트(PartList)에 onDelete=handleDeletePart
// 이 배선돼 각 파트 행에 "삭제" 버튼이 part 수만큼 렌더됨을 정적 markup 으로 단언한다(클릭→러너
// 호출 자체는 위 runDeletePart 단위 test 가 cover — 본 파일은 jsdom 미사용 정적 렌더라 이벤트
// 비검증). 비-Admin 등급으로 두어 provider 목록 패널의 "삭제" 버튼과 섞이지 않게 격리한다(파트
// 섹션은 gating 밖이라 비-Admin 에도 렌더된다). groups/persons 는 기본 빈 목록이라 그룹·인원 삭제
// 버튼과도 분리(파트 목록만이 "삭제" 버튼의 유일 출처).
describe('AdminView — 파트 삭제 배선 (정적 렌더, T-1154)', () => {
  const PARTS = '/api/parts';
  const countOccurrences = (haystack: string, needle: string) =>
    haystack.split(needle).length - 1;

  // 파트 2 건 샘플 — 각 행에 삭제 버튼이 배선됨을 part 수(2)로 단언한다.
  const PART_ROWS = [
    { id: 'pt1', name: '개발파트', persons: [{}, {}] },
    { id: 'pt2', name: '디자인파트', persons: [{}] },
  ];

  beforeEach(() => {
    useApiResourceMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-path — 파트 목록이 있으면 각 행에 삭제 버튼(onDelete=handleDeletePart 배선)이 part
  // 수만큼 렌더된다. 비-Admin 이라 provider 목록 패널은 미마운트 + groups/persons 빈 목록 → "삭제"
  // 버튼의 유일 출처는 파트 목록.
  it('파트 목록이 있으면 각 행에 삭제 버튼을 렌더한다 (happy-path — onDelete 배선)', () => {
    setRoutes({
      [PARTS]: { data: PART_ROWS, loading: false, error: undefined },
      [AUTH_ME]: { data: { role: 'User' }, loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    // 삭제 버튼이 part 수만큼 렌더된다(파트명과 함께).
    expect(html).toContain('개발파트');
    expect(countOccurrences(html, '>삭제</button>')).toBe(PART_ROWS.length);
  });

  // branch/negative — 파트가 0 건이면 렌더할 행이 없어 삭제 버튼이 미렌더된다(빈 상태 문구만).
  it('파트가 0 건이면 삭제 버튼을 렌더하지 않는다 (branch/negative — 빈 목록)', () => {
    setRoutes({
      [PARTS]: { data: [], loading: false, error: undefined },
      [AUTH_ME]: { data: { role: 'User' }, loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toContain('등록된 파트가 없습니다');
    expect(countOccurrences(html, '>삭제</button>')).toBe(0);
  });
});

// R-112 — T-1145 인원 수정 부분 갱신 body 조립(buildPersonPatch) 순수 helper 검증. 원본 스냅샷 대비
// "변경된 필드만" 담기는지, 공백-only/미변경/trim/active boolean 분기를 각각 cover 한다. jsdom·렌더러
// 불요(순수 함수 직접 호출 — buildExportPath convention 정합).
describe('AdminView — buildPersonPatch 부분 갱신 body 조립 (순수 함수, T-1145)', () => {
  // 편집 시작 원본 스냅샷 — 모든 test 가 이 값을 기준으로 변경분을 만든다.
  const ORIGINAL: PersonPatchInput = {
    fullName: '김철수',
    email: 'chulsoo@example.com',
    active: true,
  };

  // happy-path — 세 필드 모두 변경 시 셋 다 patch 에 담긴다.
  it('세 필드 모두 변경 시 셋 다 patch 에 담는다 (happy-path)', () => {
    const patch = buildPersonPatch(
      { fullName: '김수정', email: 'new@example.com', active: false },
      ORIGINAL,
    );
    expect(patch).toEqual({
      fullName: '김수정',
      email: 'new@example.com',
      active: false,
    });
  });

  // branch — fullName 만 변경 시 patch 에 fullName 만(나머지 부재 → backend 미변경).
  it('fullName 만 변경 시 patch 에 fullName 만 담는다 (branch — 단일 필드)', () => {
    const patch = buildPersonPatch({ ...ORIGINAL, fullName: '김수정' }, ORIGINAL);
    expect(patch).toEqual({ fullName: '김수정' });
  });

  // negative — email 미변경 시 body 에 email 미포함(원본과 동일 → 제외).
  it('email 미변경 시 patch 에 email 을 포함하지 않는다 (negative — 미변경 필드 제외)', () => {
    const patch = buildPersonPatch({ ...ORIGINAL, fullName: '김수정' }, ORIGINAL);
    expect(patch.email).toBeUndefined();
  });

  // branch — 변경 없음(입력=원본)이면 빈 patch(no-op → 러너가 발사 억제).
  it('입력이 원본과 동일하면 빈 patch 를 반환한다 (branch — 변경 없음)', () => {
    const patch = buildPersonPatch({ ...ORIGINAL }, ORIGINAL);
    expect(patch).toEqual({});
    expect(Object.keys(patch)).toHaveLength(0);
  });

  // negative — 공백-only fullName 입력은 patch 에서 제외한다(@IsNotEmpty 위반 방지 — 빈 값 덮어쓰기 차단).
  it('공백-only fullName 입력은 patch 에서 제외한다 (negative — 공백-only 입력 처리)', () => {
    const patch = buildPersonPatch({ ...ORIGINAL, fullName: '   ' }, ORIGINAL);
    expect(patch.fullName).toBeUndefined();
    expect(patch).toEqual({});
  });

  // negative — 공백-only email 입력도 patch 에서 제외한다(@IsEmail 위반·빈 email 발사 차단).
  it('공백-only email 입력은 patch 에서 제외한다 (negative — 공백-only email)', () => {
    const patch = buildPersonPatch({ ...ORIGINAL, email: '   ' }, ORIGINAL);
    expect(patch.email).toBeUndefined();
    expect(patch).toEqual({});
  });

  // negative(trim 정규화) — 값이 실제로 바뀌었으면 앞뒤 공백을 trim 해 patch 에 담는다.
  it('변경된 필드는 앞뒤 공백을 trim 해 patch 에 담는다 (negative — trim 정규화)', () => {
    const patch = buildPersonPatch(
      { ...ORIGINAL, fullName: '  김수정  ', email: '  new@example.com  ' },
      ORIGINAL,
    );
    expect(patch).toEqual({ fullName: '김수정', email: 'new@example.com' });
  });

  // negative(trim 후 동일) — 원본에 공백만 덧댄 입력은 trim 후 원본과 같아 제외한다(무의미 변경 차단).
  it('원본에 공백만 덧댄 입력은 trim 후 동일해 제외한다 (negative — trim 후 미변경)', () => {
    const patch = buildPersonPatch({ ...ORIGINAL, fullName: '  김철수  ' }, ORIGINAL);
    expect(patch.fullName).toBeUndefined();
    expect(patch).toEqual({});
  });

  // branch — active true→false 전환은 patch 에 active:false 로 담긴다(soft deactivate, falsy 값도 명시 비교).
  it('active true→false 전환을 patch 에 active:false 로 담는다 (branch — active false 분기)', () => {
    const patch = buildPersonPatch({ ...ORIGINAL, active: false }, ORIGINAL);
    expect(patch).toEqual({ active: false });
  });

  // branch — active false→true 전환은 patch 에 active:true 로 담긴다(reactivate — 반대 분기).
  it('active false→true 전환을 patch 에 active:true 로 담는다 (branch — active true 분기)', () => {
    const patch = buildPersonPatch(
      { fullName: '김철수', email: 'chulsoo@example.com', active: true },
      { fullName: '김철수', email: 'chulsoo@example.com', active: false },
    );
    expect(patch).toEqual({ active: true });
  });

  // negative — active 미변경(동일 boolean)이면 patch 에 active 미포함(false→false 도 제외).
  it('active 미변경(동일 boolean)이면 patch 에 active 를 포함하지 않는다 (negative — active 미변경)', () => {
    const inactiveOriginal: PersonPatchInput = { ...ORIGINAL, active: false };
    const patch = buildPersonPatch({ ...inactiveOriginal }, inactiveOriginal);
    expect(patch.active).toBeUndefined();
    expect(patch).toEqual({});
  });
});

// R-112 — T-1145 인원 수정 실 PATCH update mutation 본체(runUpdatePerson) 검증. jsdom/렌더러 없이
// mutation 본체를 직접 호출하고(runUpdateProvider 와 동일 convention), apiClient.request mock 으로
// method/path/body 를 단언하며 성공/실패 분기 응답을 주입한다. 상태 전이는 record harness 의 콜백
// 호출로 관찰한다. happy/error(404·409·403·네트워크)/branch(빈 id·in-flight·빈 patch)/negative
// (특수문자 id 인코딩·이중 PATCH 차단·reject→finally 복구·편집 상태 전이) 예외 분기마다 각 1+ cover.
describe('AdminView — 인원 수정 실 PATCH update mutation (T-1145 runUpdatePerson)', () => {
  // 기본 부분 갱신 patch — fullName 한 필드만 담긴 유효 patch(대부분 test 의 default 입력).
  const PATCH: PersonPatch = { fullName: '김수정' };

  // 상태 전이를 기록하는 deps harness — updating 초기값과 request mock 을 주입받아 setUpdating/
  // setUpdateError 호출과 bumpRefresh·closeEdit 호출 횟수를 순서대로 캡처한다(runUpdateProvider 동형).
  // runUpdatePerson 은 id 를 인자로 받으므로 deps 에 id 가 없다(makeUpdateDeps 와의 차이).
  function makeUpdatePersonDeps(updating: boolean) {
    const calls = {
      updating: [] as boolean[],
      error: [] as (string | undefined)[],
      bump: 0,
      close: 0,
    };
    const deps: UpdatePersonDeps = {
      update: (...args: unknown[]) => requestMock(...args),
      describeError: (e: unknown) => {
        if (e instanceof ApiError) {
          return e.status === 0
            ? `네트워크 오류: ${e.message}`
            : `HTTP ${e.status}: ${e.message}`;
        }
        return '알 수 없는 오류';
      },
      updating,
      setUpdating: (next) => calls.updating.push(next),
      setUpdateError: (next) => calls.error.push(next),
      bumpRefresh: () => {
        calls.bump += 1;
      },
      closeEdit: () => {
        calls.close += 1;
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

  // happy-path — update 트리거 시 request 가 PATCH /api/persons/:id 로 method PATCH + 변경 필드 body
  // 인자로 정확히 호출되고, 성공 후 재조회 nonce bump(1 회) + 편집 종료(closeEdit 1 회) + error 미설정
  // (시작 비움만) + 진행 표시 on→off 로 해제된다.
  it('PATCH /api/persons/:id 를 method PATCH + 변경 필드 body 로 호출하고 성공 시 nonce bump + 편집 종료 한다 (happy-path)', async () => {
    requestMock.mockResolvedValue(undefined); // 200 OK.
    const { deps, calls } = makeUpdatePersonDeps(false);
    await runUpdatePerson('pp1', { fullName: '김수정', active: false }, deps);
    expect(requestMock).toHaveBeenCalledTimes(1);
    const [path, options] = requestMock.mock.calls[0] as [
      string,
      { method: string; body: string },
    ];
    expect(path).toBe('/api/persons/pp1');
    expect(options.method).toBe('PATCH');
    expect(JSON.parse(options.body)).toEqual({ fullName: '김수정', active: false });
    expect(calls.bump).toBe(1);
    expect(calls.close).toBe(1);
    expect(calls.error).toEqual([undefined]);
    expect(calls.updating).toEqual([true, false]);
  });

  // error path — PATCH 404(미존재 row) 시 error 문구 표면화·throw 없음·nonce 미증가·편집 종료 미호출(편집 유지).
  it('update 404(미존재 row) 실패 시 error 문구를 표면화하고 nonce·편집 상태를 건드리지 않는다 (error path — 404)', async () => {
    requestMock.mockRejectedValue(new ApiError(404, 'Not Found'));
    const { deps, calls } = makeUpdatePersonDeps(false);
    await expect(runUpdatePerson('ghost', PATCH, deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 404: Not Found']);
    expect(calls.bump).toBe(0);
    expect(calls.close).toBe(0);
    expect(calls.updating).toEqual([true, false]);
  });

  // error path — 409(email 중복) 실패 시 동일 안전 경로(throw 없음).
  it('update 409(email 중복) 실패 시 안전 문구를 표면화한다 (error path — 409)', async () => {
    requestMock.mockRejectedValue(new ApiError(409, 'Conflict'));
    const { deps, calls } = makeUpdatePersonDeps(false);
    await expect(runUpdatePerson('pp1', { email: 'dup@example.com' }, deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 409: Conflict']);
    expect(calls.bump).toBe(0);
    expect(calls.close).toBe(0);
  });

  // error path — 403(Admin+ 미만) 실패 시 동일 안전 경로.
  it('update 403(Admin+ 미만) 실패 시 안전 문구를 표면화한다 (error path — 403)', async () => {
    requestMock.mockRejectedValue(new ApiError(403, 'Forbidden'));
    const { deps, calls } = makeUpdatePersonDeps(false);
    await expect(runUpdatePerson('pp1', PATCH, deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 403: Forbidden']);
    expect(calls.bump).toBe(0);
  });

  // error path — 네트워크 실패(ApiError(0)) 시 네트워크 오류 문구(throw 없음).
  it('update 네트워크 실패(ApiError 0) 시 네트워크 오류 문구를 표면화한다 (error path — 네트워크)', async () => {
    requestMock.mockRejectedValue(new ApiError(0, 'fetch failed'));
    const { deps, calls } = makeUpdatePersonDeps(false);
    await expect(runUpdatePerson('pp1', PATCH, deps)).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, '네트워크 오류: fetch failed']);
    expect(calls.bump).toBe(0);
  });

  // branch(a) — 빈/공백/falsy id 는 PATCH 미발사·state 불변(잘못된 path 회피). 경계값 각각 cover.
  it('빈/공백/falsy id 는 PATCH 를 발사하지 않는다 (branch (a) — id 가드)', async () => {
    for (const badId of ['', '   ']) {
      requestMock.mockReset();
      const { deps, calls } = makeUpdatePersonDeps(false);
      await expect(runUpdatePerson(badId, PATCH, deps)).resolves.toBeUndefined();
      expect(requestMock).not.toHaveBeenCalled();
      expect(calls.updating).toEqual([]);
      expect(calls.bump).toBe(0);
    }
    // undefined id 도 안전(런타임 비정상 입력 방어).
    requestMock.mockReset();
    const { deps, calls } = makeUpdatePersonDeps(false);
    await expect(
      runUpdatePerson(undefined as unknown as string, PATCH, deps),
    ).resolves.toBeUndefined();
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.updating).toEqual([]);
  });

  // branch(b) — 이전 update 미완(updating=true) 중 재호출은 PATCH 미발사·state 불변(이중 PATCH 차단).
  it('이전 update 미완(updating=true) 중 재호출은 PATCH 를 발사하지 않는다 (branch (b) — 이중 PATCH 가드)', async () => {
    const { deps, calls } = makeUpdatePersonDeps(true); // 이미 in-flight.
    await runUpdatePerson('pp1', PATCH, deps);
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.updating).toEqual([]);
    expect(calls.error).toEqual([]);
    expect(calls.bump).toBe(0);
  });

  // branch(c) — 빈 patch(변경 필드 0)면 PATCH 미발사(빈 body 회피 — no-op).
  it('빈 patch(변경 필드 0)면 PATCH 를 발사하지 않는다 (branch (c) — 빈 body no-op 가드)', async () => {
    const { deps, calls } = makeUpdatePersonDeps(false);
    await expect(runUpdatePerson('pp1', {}, deps)).resolves.toBeUndefined();
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.updating).toEqual([]);
    expect(calls.bump).toBe(0);
    expect(calls.close).toBe(0);
  });

  // negative(id 인코딩) — 특수문자가 든 id 는 encodeURIComponent 로 안전 인코딩된다(path 손상 방지).
  it('id 를 encodeURIComponent 로 안전 인코딩해 path 를 만든다 (negative — 특수문자 id 인코딩)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps } = makeUpdatePersonDeps(false);
    await runUpdatePerson('pp 1/x', PATCH, deps);
    expect(requestMock.mock.calls[0]?.[0]).toBe('/api/persons/pp%201%2Fx');
  });

  // negative(이중 PATCH 차단, 순차) — 정상 발사는 request 를 정확히 1 회만 호출한다(중복 없음).
  it('정상 발사 시 PATCH 를 1 회만 호출한다 (negative — 재클릭 이중 PATCH 차단)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps } = makeUpdatePersonDeps(false);
    await runUpdatePerson('pp1', PATCH, deps);
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(requestMock.mock.calls[0]?.[0]).toBe('/api/persons/pp1');
  });

  // negative(reject→finally 복구) — 실패 후에도 finally 가 setUpdating(false) 로 진행 표시를 복구한다.
  it('reject 시에도 finally 로 진행 표시(updating)를 복구한다 (negative — reject→finally 복구)', async () => {
    requestMock.mockRejectedValueOnce(new ApiError(500, 'boom'));
    const fail = makeUpdatePersonDeps(false);
    await runUpdatePerson('pp1', PATCH, fail.deps);
    expect(fail.calls.updating).toEqual([true, false]);

    requestMock.mockResolvedValueOnce(undefined);
    const ok = makeUpdatePersonDeps(false);
    await runUpdatePerson('pp1', PATCH, ok.deps);
    expect(ok.calls.updating).toEqual([true, false]);
  });

  // negative(편집 상태 전이) — 성공 시 편집 종료(closeEdit), 실패 시 편집 유지(closeEdit 미호출).
  it('성공 시 편집을 종료하고 실패 시 편집을 유지한다 (negative — 편집 상태 전이)', async () => {
    requestMock.mockResolvedValueOnce(undefined);
    const ok = makeUpdatePersonDeps(false);
    await runUpdatePerson('pp1', PATCH, ok.deps);
    expect(ok.calls.close).toBe(1);

    requestMock.mockRejectedValueOnce(new ApiError(400, 'Bad Request'));
    const fail = makeUpdatePersonDeps(false);
    await runUpdatePerson('pp1', PATCH, fail.deps);
    expect(fail.calls.close).toBe(0);
  });

  // negative(시작 정리/재조회 전 안전) — 발사 직후 진행 표시 on + 직전 error 즉시 비움을 지연 resolve
  // 로 캡처한다(재조회 도착 전 상태에서 crash 없음). 해소 후 재조회 bump + 편집 종료 + 진행 off.
  it('발사 직후 진행 표시 on + 직전 error 를 즉시 비운다 (negative — 시작 정리/재조회 전 안전)', async () => {
    let resolvePatch: () => void = () => {};
    requestMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvePatch = resolve;
        }),
    );
    const { deps, calls } = makeUpdatePersonDeps(false);
    const pending = runUpdatePerson('pp1', PATCH, deps);
    expect(calls.updating).toEqual([true]);
    expect(calls.error).toEqual([undefined]);
    expect(calls.bump).toBe(0);
    expect(calls.close).toBe(0);
    resolvePatch();
    await pending;
    expect(calls.bump).toBe(1);
    expect(calls.close).toBe(1);
    expect(calls.updating).toEqual([true, false]);
  });

  // negative(응답 shape 무관) — request 가 예상 밖 값(null)으로 resolve 해도 성공 경로로 안전 처리한다.
  it('request 가 예상 밖 값(null)으로 resolve 해도 성공 경로로 안전 처리한다 (negative — 응답 shape 무관)', async () => {
    requestMock.mockResolvedValue(null);
    const { deps, calls } = makeUpdatePersonDeps(false);
    await expect(runUpdatePerson('pp1', PATCH, deps)).resolves.toBeUndefined();
    expect(calls.bump).toBe(1);
    expect(calls.close).toBe(1);
    expect(calls.error).toEqual([undefined]);
  });
});

// R-112 — T-1145 인원 수정 배선 렌더 검증. 인원 관리 마운트(PersonList)에 onEdit=handleEditPerson 이
// 배선돼 각 인원 행에 "수정" 버튼이 person 수만큼 렌더됨을 정적 markup 으로 단언한다(클릭→prefill·러너
// 호출 자체는 위 runUpdatePerson 단위 test 가 cover — 본 파일은 jsdom 미사용 정적 렌더라 이벤트 비검증).
// 초기(편집 대상 미선택)엔 인라인 수정 폼이 미렌더됨도 확인한다. 비-Admin 등급으로 두어 provider 목록
// 패널의 "수정" 버튼과 섞이지 않게 격리한다(인원 섹션은 gating 밖이라 비-Admin 에도 렌더된다).
describe('AdminView — 인원 수정 배선 (정적 렌더, T-1145)', () => {
  const PERSONS = '/api/persons';
  const countOccurrences = (haystack: string, needle: string) =>
    haystack.split(needle).length - 1;

  const PERSON_ROWS: PersonRow[] = [
    { id: 'pp1', fullName: '김인원', email: 'kim@example.com', active: true },
    { id: 'pp2', fullName: '이휴직', email: 'lee@example.com', active: false },
  ];

  beforeEach(() => {
    useApiResourceMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-path — 인원 목록이 있으면 각 행에 수정 버튼(onEdit=handleEditPerson 배선)이 person 수만큼
  // 렌더된다. 비-Admin 이라 provider 목록 패널은 미마운트 → "수정" 버튼의 유일 출처는 인원 목록.
  it('인원 목록이 있으면 각 행에 수정 버튼을 렌더한다 (happy-path — onEdit 배선)', () => {
    setRoutes({
      [PERSONS]: { data: PERSON_ROWS, loading: false, error: undefined },
      [AUTH_ME]: { data: { role: 'User' }, loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toContain('김인원');
    expect(countOccurrences(html, '>수정</button>')).toBe(PERSON_ROWS.length);
  });

  // branch/negative — 초기(편집 대상 미선택, editingPersonId=null)엔 인라인 수정 폼이 미렌더된다.
  it('초기(편집 미선택)엔 인라인 수정 폼을 렌더하지 않는다 (branch/negative — editingPersonId=null)', () => {
    setRoutes({
      [PERSONS]: { data: PERSON_ROWS, loading: false, error: undefined },
      [AUTH_ME]: { data: { role: 'User' }, loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    // 인라인 수정 폼의 입력(aria-label)은 편집 대상 선택 전에는 미렌더된다.
    expect(html).not.toContain('aria-label="수정할 인원 이름"');
    expect(html).not.toContain('aria-label="수정할 인원 활성 여부"');
  });

  // branch/negative — 인원이 0 건이면 렌더할 행이 없어 수정 버튼이 미렌더된다(빈 상태 문구만).
  it('인원이 0 건이면 수정 버튼을 렌더하지 않는다 (branch/negative — 빈 목록)', () => {
    setRoutes({
      [PERSONS]: { data: [], loading: false, error: undefined },
      [AUTH_ME]: { data: { role: 'User' }, loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toContain('등록된 인원이 없습니다');
    expect(countOccurrences(html, '>수정</button>')).toBe(0);
  });
});

// R-112 — T-1150 그룹 수정 실 PATCH update mutation 본체(runUpdateGroup) 검증. jsdom/렌더러 없이
// mutation 본체를 직접 호출하고(runUpdatePerson 와 동일 convention), apiClient.request mock 으로
// method/path/body(name-only)를 단언하며 성공/실패 분기 응답을 주입한다. 상태 전이는 record harness 의
// 콜백 호출로 관찰한다. happy/error(404·400·403·네트워크)/branch(빈 id·in-flight·빈·공백 name·미변경
// name)/negative(특수문자 id 인코딩·name trim·이중 PATCH 차단·reject→finally 복구·편집 상태 전이·
// 응답 shape 무관) 예외 분기마다 각 1+ cover. runUpdateGroup 은 (id, name, originalName, deps) 를 받아
// name 단일 필드라 buildPersonPatch 같은 다필드 diff 없이 러너 안에서 trim·미변경 비교로 발사 여부를 판정.
describe('AdminView — 그룹 수정 실 PATCH update mutation (T-1150 runUpdateGroup)', () => {
  // 상태 전이를 기록하는 deps harness — updating 초기값과 request mock 을 주입받아 setUpdating/
  // setUpdateError 호출과 bumpRefresh·closeEdit 호출 횟수를 순서대로 캡처한다(makeUpdatePersonDeps 동형).
  function makeUpdateGroupDeps(updating: boolean) {
    const calls = {
      updating: [] as boolean[],
      error: [] as (string | undefined)[],
      bump: 0,
      close: 0,
    };
    const deps: UpdateGroupDeps = {
      update: (...args: unknown[]) => requestMock(...args),
      describeError: (e: unknown) => {
        if (e instanceof ApiError) {
          return e.status === 0
            ? `네트워크 오류: ${e.message}`
            : `HTTP ${e.status}: ${e.message}`;
        }
        return '알 수 없는 오류';
      },
      updating,
      setUpdating: (next) => calls.updating.push(next),
      setUpdateError: (next) => calls.error.push(next),
      bumpRefresh: () => {
        calls.bump += 1;
      },
      closeEdit: () => {
        calls.close += 1;
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

  // happy-path — update 트리거 시 request 가 PATCH /api/groups/:id 로 method PATCH + name-only body
  // 인자로 정확히 호출되고, 성공 후 재조회 nonce bump(1 회) + 편집 종료(closeEdit 1 회) + error 미설정
  // (시작 비움만) + 진행 표시 on→off 로 해제된다.
  it('PATCH /api/groups/:id 를 method PATCH + name-only body 로 호출하고 성공 시 nonce bump + 편집 종료 한다 (happy-path)', async () => {
    requestMock.mockResolvedValue(undefined); // 200 OK.
    const { deps, calls } = makeUpdateGroupDeps(false);
    await runUpdateGroup('gg1', '플랫폼팀', '데브옵스팀', deps);
    expect(requestMock).toHaveBeenCalledTimes(1);
    const [path, options] = requestMock.mock.calls[0] as [
      string,
      { method: string; body: string },
    ];
    expect(path).toBe('/api/groups/gg1');
    expect(options.method).toBe('PATCH');
    expect(JSON.parse(options.body)).toEqual({ name: '플랫폼팀' });
    expect(calls.bump).toBe(1);
    expect(calls.close).toBe(1);
    expect(calls.error).toEqual([undefined]);
    expect(calls.updating).toEqual([true, false]);
  });

  // error path — PATCH 404(미존재 row) 시 error 문구 표면화·throw 없음·nonce 미증가·편집 종료 미호출(편집 유지).
  it('update 404(미존재 row) 실패 시 error 문구를 표면화하고 nonce·편집 상태를 건드리지 않는다 (error path — 404)', async () => {
    requestMock.mockRejectedValue(new ApiError(404, 'Not Found'));
    const { deps, calls } = makeUpdateGroupDeps(false);
    await expect(
      runUpdateGroup('ghost', '새이름', '옛이름', deps),
    ).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 404: Not Found']);
    expect(calls.bump).toBe(0);
    expect(calls.close).toBe(0);
    expect(calls.updating).toEqual([true, false]);
  });

  // error path — 400(빈/비정상 name — backend 검증 실패) 실패 시 동일 안전 경로(throw 없음).
  it('update 400(비정상 name 검증 실패) 실패 시 안전 문구를 표면화한다 (error path — 400)', async () => {
    requestMock.mockRejectedValue(new ApiError(400, 'Bad Request'));
    const { deps, calls } = makeUpdateGroupDeps(false);
    await expect(
      runUpdateGroup('gg1', '새이름', '옛이름', deps),
    ).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 400: Bad Request']);
    expect(calls.bump).toBe(0);
    expect(calls.close).toBe(0);
  });

  // error path — 403(Admin+ 미만) 실패 시 동일 안전 경로.
  it('update 403(Admin+ 미만) 실패 시 안전 문구를 표면화한다 (error path — 403)', async () => {
    requestMock.mockRejectedValue(new ApiError(403, 'Forbidden'));
    const { deps, calls } = makeUpdateGroupDeps(false);
    await expect(
      runUpdateGroup('gg1', '새이름', '옛이름', deps),
    ).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 403: Forbidden']);
    expect(calls.bump).toBe(0);
  });

  // error path — 네트워크 실패(ApiError(0)) 시 네트워크 오류 문구(throw 없음).
  it('update 네트워크 실패(ApiError 0) 시 네트워크 오류 문구를 표면화한다 (error path — 네트워크)', async () => {
    requestMock.mockRejectedValue(new ApiError(0, 'fetch failed'));
    const { deps, calls } = makeUpdateGroupDeps(false);
    await expect(
      runUpdateGroup('gg1', '새이름', '옛이름', deps),
    ).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, '네트워크 오류: fetch failed']);
    expect(calls.bump).toBe(0);
  });

  // branch(a) — 빈/공백/falsy id 는 PATCH 미발사·state 불변(잘못된 path 회피). 경계값 각각 cover.
  it('빈/공백/falsy id 는 PATCH 를 발사하지 않는다 (branch (a) — id 가드)', async () => {
    for (const badId of ['', '   ']) {
      requestMock.mockReset();
      const { deps, calls } = makeUpdateGroupDeps(false);
      await expect(
        runUpdateGroup(badId, '새이름', '옛이름', deps),
      ).resolves.toBeUndefined();
      expect(requestMock).not.toHaveBeenCalled();
      expect(calls.updating).toEqual([]);
      expect(calls.bump).toBe(0);
    }
    // undefined id 도 안전(런타임 비정상 입력 방어).
    requestMock.mockReset();
    const { deps, calls } = makeUpdateGroupDeps(false);
    await expect(
      runUpdateGroup(undefined as unknown as string, '새이름', '옛이름', deps),
    ).resolves.toBeUndefined();
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.updating).toEqual([]);
  });

  // branch(b) — 이전 update 미완(updating=true) 중 재호출은 PATCH 미발사·state 불변(이중 PATCH 차단).
  it('이전 update 미완(updating=true) 중 재호출은 PATCH 를 발사하지 않는다 (branch (b) — 이중 PATCH 가드)', async () => {
    const { deps, calls } = makeUpdateGroupDeps(true); // 이미 in-flight.
    await runUpdateGroup('gg1', '새이름', '옛이름', deps);
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.updating).toEqual([]);
    expect(calls.error).toEqual([]);
    expect(calls.bump).toBe(0);
  });

  // branch(c) — 빈/공백-only name 은 PATCH 미발사(빈 body·400 회피 — @IsNotEmpty). 경계값 각각 cover.
  it('빈/공백-only name 은 PATCH 를 발사하지 않는다 (branch (c) — 빈·공백 name 가드)', async () => {
    for (const badName of ['', '   ']) {
      requestMock.mockReset();
      const { deps, calls } = makeUpdateGroupDeps(false);
      await expect(
        runUpdateGroup('gg1', badName, '옛이름', deps),
      ).resolves.toBeUndefined();
      expect(requestMock).not.toHaveBeenCalled();
      expect(calls.updating).toEqual([]);
      expect(calls.bump).toBe(0);
      expect(calls.close).toBe(0);
    }
  });

  // branch(d) — 미변경 name(입력 trim 후 원본과 동일)이면 PATCH 미발사(무의미한 요청 억제 — no-op).
  it('미변경 name(원본과 동일)이면 PATCH 를 발사하지 않는다 (branch (d) — 미변경 name no-op 가드)', async () => {
    const { deps, calls } = makeUpdateGroupDeps(false);
    // 동일 name(앞뒤 공백만 덧댄 입력도 trim 후 동일 → 미변경 취급).
    await expect(
      runUpdateGroup('gg1', '  데브옵스팀  ', '데브옵스팀', deps),
    ).resolves.toBeUndefined();
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.updating).toEqual([]);
    expect(calls.bump).toBe(0);
    expect(calls.close).toBe(0);
  });

  // negative(id 인코딩) — 특수문자가 든 id 는 encodeURIComponent 로 안전 인코딩된다(path 손상 방지).
  it('id 를 encodeURIComponent 로 안전 인코딩해 path 를 만든다 (negative — 특수문자 id 인코딩)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps } = makeUpdateGroupDeps(false);
    await runUpdateGroup('gg 1/x', '새이름', '옛이름', deps);
    expect(requestMock.mock.calls[0]?.[0]).toBe('/api/groups/gg%201%2Fx');
  });

  // negative(name trim) — 발사되는 body 의 name 은 앞뒤 공백을 trim 한 값이다(빈 값·공백 오염 방지).
  it('발사되는 body 의 name 은 앞뒤 공백을 trim 한 값이다 (negative — name trim)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps } = makeUpdateGroupDeps(false);
    await runUpdateGroup('gg1', '  플랫폼팀  ', '데브옵스팀', deps);
    const options = requestMock.mock.calls[0]?.[1] as { body: string };
    expect(JSON.parse(options.body)).toEqual({ name: '플랫폼팀' });
  });

  // negative(이중 PATCH 차단, 순차) — 정상 발사는 request 를 정확히 1 회만 호출한다(중복 없음).
  it('정상 발사 시 PATCH 를 1 회만 호출한다 (negative — 재클릭 이중 PATCH 차단)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps } = makeUpdateGroupDeps(false);
    await runUpdateGroup('gg1', '플랫폼팀', '데브옵스팀', deps);
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(requestMock.mock.calls[0]?.[0]).toBe('/api/groups/gg1');
  });

  // negative(reject→finally 복구) — 실패 후에도 finally 가 setUpdating(false) 로 진행 표시를 복구한다.
  it('reject 시에도 finally 로 진행 표시(updating)를 복구한다 (negative — reject→finally 복구)', async () => {
    requestMock.mockRejectedValueOnce(new ApiError(500, 'boom'));
    const fail = makeUpdateGroupDeps(false);
    await runUpdateGroup('gg1', '새이름', '옛이름', fail.deps);
    expect(fail.calls.updating).toEqual([true, false]);

    requestMock.mockResolvedValueOnce(undefined);
    const ok = makeUpdateGroupDeps(false);
    await runUpdateGroup('gg1', '새이름', '옛이름', ok.deps);
    expect(ok.calls.updating).toEqual([true, false]);
  });

  // negative(편집 상태 전이) — 성공 시 편집 종료(closeEdit), 실패 시 편집 유지(closeEdit 미호출).
  it('성공 시 편집을 종료하고 실패 시 편집을 유지한다 (negative — 편집 상태 전이)', async () => {
    requestMock.mockResolvedValueOnce(undefined);
    const ok = makeUpdateGroupDeps(false);
    await runUpdateGroup('gg1', '새이름', '옛이름', ok.deps);
    expect(ok.calls.close).toBe(1);

    requestMock.mockRejectedValueOnce(new ApiError(400, 'Bad Request'));
    const fail = makeUpdateGroupDeps(false);
    await runUpdateGroup('gg1', '새이름', '옛이름', fail.deps);
    expect(fail.calls.close).toBe(0);
  });

  // negative(시작 정리/재조회 전 안전) — 발사 직후 진행 표시 on + 직전 error 즉시 비움을 지연 resolve
  // 로 캡처한다(재조회 도착 전 상태에서 crash 없음). 해소 후 재조회 bump + 편집 종료 + 진행 off.
  it('발사 직후 진행 표시 on + 직전 error 를 즉시 비운다 (negative — 시작 정리/재조회 전 안전)', async () => {
    let resolvePatch: () => void = () => {};
    requestMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvePatch = resolve;
        }),
    );
    const { deps, calls } = makeUpdateGroupDeps(false);
    const pending = runUpdateGroup('gg1', '새이름', '옛이름', deps);
    expect(calls.updating).toEqual([true]);
    expect(calls.error).toEqual([undefined]);
    expect(calls.bump).toBe(0);
    expect(calls.close).toBe(0);
    resolvePatch();
    await pending;
    expect(calls.bump).toBe(1);
    expect(calls.close).toBe(1);
    expect(calls.updating).toEqual([true, false]);
  });

  // negative(응답 shape 무관) — request 가 예상 밖 값(null)으로 resolve 해도 성공 경로로 안전 처리한다.
  it('request 가 예상 밖 값(null)으로 resolve 해도 성공 경로로 안전 처리한다 (negative — 응답 shape 무관)', async () => {
    requestMock.mockResolvedValue(null);
    const { deps, calls } = makeUpdateGroupDeps(false);
    await expect(
      runUpdateGroup('gg1', '새이름', '옛이름', deps),
    ).resolves.toBeUndefined();
    expect(calls.bump).toBe(1);
    expect(calls.close).toBe(1);
    expect(calls.error).toEqual([undefined]);
  });
});

// R-112 — T-1150 그룹 수정 배선 렌더 검증. 그룹 관리 마운트(GroupList)에 onEdit=handleEditGroup 이
// 배선돼 각 그룹 행에 "수정" 버튼이 group 수만큼 렌더됨을 정적 markup 으로 단언한다(클릭→prefill·러너
// 호출 자체는 위 runUpdateGroup 단위 test 가 cover — 본 파일은 jsdom 미사용 정적 렌더라 이벤트 비검증).
// 초기(편집 대상 미선택)엔 인라인 수정 폼이 미렌더됨도 확인한다. 비-Admin 등급으로 두어 provider 목록
// 패널의 "수정" 버튼과 섞이지 않게 격리한다(그룹 섹션은 gating 밖이라 비-Admin 에도 렌더된다). persons
// 는 기본 빈 목록이라 인원 수정 버튼과도 분리한다.
describe('AdminView — 그룹 수정 배선 (정적 렌더, T-1150)', () => {
  const countOccurrences = (haystack: string, needle: string) =>
    haystack.split(needle).length - 1;

  // 그룹 2 건 샘플 — 각 행에 수정 버튼이 배선됨을 group 수(2)로 단언한다.
  const GROUP_ROWS = [
    { id: 'gg1', name: '데브옵스팀', members: [{}, {}] },
    { id: 'gg2', name: '디자인팀', members: [{}] },
  ];

  beforeEach(() => {
    useApiResourceMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-path — 그룹 목록이 있으면 각 행에 수정 버튼(onEdit=handleEditGroup 배선)이 group 수만큼
  // 렌더된다. 비-Admin 이라 provider 목록 패널은 미마운트 + persons 빈 목록 → "수정" 버튼의 유일
  // 출처는 그룹 목록.
  it('그룹 목록이 있으면 각 행에 수정 버튼을 렌더한다 (happy-path — onEdit 배선)', () => {
    setRoutes({
      [GROUPS]: { data: GROUP_ROWS, loading: false, error: undefined },
      [AUTH_ME]: { data: { role: 'User' }, loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toContain('데브옵스팀');
    expect(countOccurrences(html, '>수정</button>')).toBe(GROUP_ROWS.length);
  });

  // branch/negative — 초기(편집 대상 미선택, editingGroupId=null)엔 인라인 수정 폼이 미렌더된다.
  it('초기(편집 미선택)엔 인라인 수정 폼을 렌더하지 않는다 (branch/negative — editingGroupId=null)', () => {
    setRoutes({
      [GROUPS]: { data: GROUP_ROWS, loading: false, error: undefined },
      [AUTH_ME]: { data: { role: 'User' }, loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    // 인라인 수정 폼의 입력(aria-label)은 편집 대상 선택 전에는 미렌더된다.
    expect(html).not.toContain('aria-label="수정할 그룹 이름"');
    // "그룹 수정" 저장 버튼도 편집 폼 안에만 있어 미렌더된다.
    expect(html).not.toContain('>그룹 수정</button>');
  });

  // branch/negative — 그룹이 0 건이면 렌더할 행이 없어 수정 버튼이 미렌더된다(빈 상태 문구만).
  it('그룹이 0 건이면 수정 버튼을 렌더하지 않는다 (branch/negative — 빈 목록)', () => {
    setRoutes({
      [GROUPS]: { data: [], loading: false, error: undefined },
      [AUTH_ME]: { data: { role: 'User' }, loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toContain('등록된 그룹이 없습니다');
    expect(countOccurrences(html, '>수정</button>')).toBe(0);
  });
});

// R-112 — T-1155 파트 수정 실 PATCH update mutation 본체(runUpdatePart) 검증. jsdom/렌더러 없이
// mutation 본체를 직접 호출하고(runUpdateGroup 과 동일 convention), apiClient.request mock 으로
// method/path/body(name-only)를 단언하며 성공/실패 분기 응답을 주입한다. 상태 전이는 record harness 의
// 콜백 호출로 관찰한다. happy/error(409 중복 전용·404·400·403·네트워크)/branch(빈 id·in-flight·빈·
// 공백 name·미변경 name·isConflict true/false)/negative(특수문자 id 인코딩·name trim·단일 필드 body
// 경계·이중 PATCH 차단·reject→finally 복구·편집 상태 전이·재조회 전 상태 안전·응답 shape 무관·409 후
// 재시도 error 초기화) 예외 분기마다 각 1+ cover. runUpdateGroup 과 동형이되 Part.name @unique 라
// 409 를 전용 문구(PART_DUPLICATE_ERROR)로 구분 표면화하는 분기를 추가 검증한다.
describe('AdminView — 파트 수정 실 PATCH update mutation (T-1155 runUpdatePart)', () => {
  // 409 전용 문구 — runUpdatePart 가 ConflictException(409) 시 표면화하는 상수와 정합.
  const DUP = '이미 존재하는 파트 이름입니다';

  // 상태 전이를 기록하는 deps harness — updating 초기값과 request mock 을 주입받아 setUpdating/
  // setUpdateError 호출과 bumpRefresh·closeEdit 호출 횟수를 순서대로 캡처한다(makeUpdateGroupDeps
  // 동형). isConflict 는 런타임과 동일하게 ApiError.status===409 판정을 주입한다(409 전용 분기 검증).
  function makeUpdatePartDeps(updating: boolean) {
    const calls = {
      updating: [] as boolean[],
      error: [] as (string | undefined)[],
      bump: 0,
      close: 0,
    };
    const deps: UpdatePartDeps = {
      update: (...args: unknown[]) => requestMock(...args),
      describeError: (e: unknown) => {
        // toErrorMessage stub 과 정합 — ApiError.status → 문구(비-409 경로).
        if (e instanceof ApiError) {
          return e.status === 0
            ? `네트워크 오류: ${e.message}`
            : `HTTP ${e.status}: ${e.message}`;
        }
        return '알 수 없는 오류';
      },
      isConflict: (e: unknown) => e instanceof ApiError && e.status === 409,
      updating,
      setUpdating: (next) => calls.updating.push(next),
      setUpdateError: (next) => calls.error.push(next),
      bumpRefresh: () => {
        calls.bump += 1;
      },
      closeEdit: () => {
        calls.close += 1;
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

  // happy-path — update 트리거 시 request 가 PATCH /api/parts/:id 로 method PATCH + name-only body
  // 인자로 정확히 호출되고, 성공 후 재조회 nonce bump(1 회) + 편집 종료(closeEdit 1 회) + error 미설정
  // (시작 비움만) + 진행 표시 on→off 로 해제된다.
  it('PATCH /api/parts/:id 를 method PATCH + name-only body 로 호출하고 성공 시 nonce bump + 편집 종료 한다 (happy-path)', async () => {
    requestMock.mockResolvedValue(undefined); // 200 OK.
    const { deps, calls } = makeUpdatePartDeps(false);
    await runUpdatePart('pt1', '플랫폼파트', '개발파트', deps);
    expect(requestMock).toHaveBeenCalledTimes(1);
    const [path, options] = requestMock.mock.calls[0] as [
      string,
      { method: string; body: string },
    ];
    expect(path).toBe('/api/parts/pt1');
    expect(options.method).toBe('PATCH');
    expect(JSON.parse(options.body)).toEqual({ name: '플랫폼파트' });
    expect(calls.bump).toBe(1);
    expect(calls.close).toBe(1);
    expect(calls.error).toEqual([undefined]);
    expect(calls.updating).toEqual([true, false]);
  });

  // happy-path(prefill flow) — "수정" 클릭 시 prefill 되는 값은 해당 row 의 현재 name 이며 원본
  // 스냅샷과 같다. 그 상태로 저장하면 미변경이라 미발사고(no-op), 입력을 바꿔 저장해야 새 name 이
  // body 로 발사된다(onEdit → prefill → 저장 flow 를 러너 인자 계약으로 검증 — jsdom 미사용).
  it('prefill 값 그대로 저장하면 미발사, 입력을 바꿔 저장하면 새 name 이 발사된다 (happy-path — onEdit prefill flow)', async () => {
    const prefilled = '개발파트'; // handleEditPart 가 row.name 으로 채우는 값 = 원본 스냅샷.
    const noop = makeUpdatePartDeps(false);
    await runUpdatePart('pt1', prefilled, prefilled, noop.deps);
    expect(requestMock).not.toHaveBeenCalled();

    requestMock.mockResolvedValue(undefined);
    const edited = makeUpdatePartDeps(false);
    await runUpdatePart('pt1', '보안파트', prefilled, edited.deps);
    expect(requestMock).toHaveBeenCalledTimes(1);
    const options = requestMock.mock.calls[0]?.[1] as { body: string };
    expect(JSON.parse(options.body)).toEqual({ name: '보안파트' });
    expect(edited.calls.close).toBe(1);
  });

  // negative — body 는 name 단일 필드만 담는다(UpdatePartDto 계약 — 다른 필드 미포함 경계).
  it('body 에 name 외 다른 필드를 포함하지 않는다 (negative — UpdatePartDto 단일 필드 경계)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps } = makeUpdatePartDeps(false);
    await runUpdatePart('pt1', '보안파트', '개발파트', deps);
    const [, options] = requestMock.mock.calls[0] as [string, { body: string }];
    expect(Object.keys(JSON.parse(options.body))).toEqual(['name']);
  });

  // error path(409 전용 분기) — 중복 이름(Part.name @unique 위반 → ConflictException) 시 일반
  // "HTTP 409: …" 가 아니라 전용 중복 문구를 표면화한다(그룹 수정과 구분되는 핵심 분기). 실패라
  // 재조회·편집 종료는 없다(편집·목록 유지 — 다른 이름으로 재시도 편의).
  it('update 409(중복 이름) 시 일반 문구 대신 전용 중복 문구를 표면화한다 (error path — 409 중복 전용)', async () => {
    requestMock.mockRejectedValue(new ApiError(409, 'Conflict'));
    const { deps, calls } = makeUpdatePartDeps(false);
    await expect(
      runUpdatePart('pt1', '보안파트', '개발파트', deps),
    ).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, DUP]);
    expect(calls.error).not.toContain('HTTP 409: Conflict');
    expect(calls.bump).toBe(0);
    expect(calls.close).toBe(0);
    expect(calls.updating).toEqual([true, false]);
  });

  // error path — PATCH 404(미존재 row) 시 일반 문구 표면화·throw 없음·nonce 미증가·편집 유지
  // (비-409 분기 — 전용 중복 문구가 아니다).
  it('update 404(미존재 row) 실패 시 일반 문구를 표면화하고 nonce·편집 상태를 건드리지 않는다 (error path — 404)', async () => {
    requestMock.mockRejectedValue(new ApiError(404, 'Not Found'));
    const { deps, calls } = makeUpdatePartDeps(false);
    await expect(
      runUpdatePart('ghost', '보안파트', '개발파트', deps),
    ).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 404: Not Found']);
    expect(calls.error).not.toContain(DUP);
    expect(calls.bump).toBe(0);
    expect(calls.close).toBe(0);
    expect(calls.updating).toEqual([true, false]);
  });

  // error path — 400(빈/비정상 name — backend 검증 실패) 실패 시 동일 안전 경로(throw 없음).
  it('update 400(비정상 name 검증 실패) 실패 시 안전 문구를 표면화한다 (error path — 400)', async () => {
    requestMock.mockRejectedValue(new ApiError(400, 'Bad Request'));
    const { deps, calls } = makeUpdatePartDeps(false);
    await expect(
      runUpdatePart('pt1', '보안파트', '개발파트', deps),
    ).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 400: Bad Request']);
    expect(calls.bump).toBe(0);
    expect(calls.close).toBe(0);
  });

  // error path — 403(Admin+ 미만 권한 부족) 실패 시 동일 안전 경로(비-409 분기).
  it('update 403(권한 부족) 실패 시 전용 중복 문구가 아니라 일반 문구를 표면화한다 (error path — 403)', async () => {
    requestMock.mockRejectedValue(new ApiError(403, 'Forbidden'));
    const { deps, calls } = makeUpdatePartDeps(false);
    await expect(
      runUpdatePart('pt1', '보안파트', '개발파트', deps),
    ).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 403: Forbidden']);
    expect(calls.error).not.toContain(DUP);
    expect(calls.bump).toBe(0);
  });

  // error path — 네트워크 실패(ApiError(0)) 시 네트워크 오류 문구(throw 없음, 비-409 경로).
  it('update 네트워크 실패(ApiError 0) 시 네트워크 오류 문구를 표면화한다 (error path — 네트워크)', async () => {
    requestMock.mockRejectedValue(new ApiError(0, 'fetch failed'));
    const { deps, calls } = makeUpdatePartDeps(false);
    await expect(
      runUpdatePart('pt1', '보안파트', '개발파트', deps),
    ).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, '네트워크 오류: fetch failed']);
    expect(calls.bump).toBe(0);
    expect(calls.close).toBe(0);
  });

  // error path(비-ApiError) — ApiError 가 아닌 표면(TypeError 등)도 isConflict false 라 일반 문구로
  // 안전 표면화한다(throw 없음 — 예상 밖 throw 표면 경계).
  it('ApiError 가 아닌 throw 표면도 일반 문구로 안전 표면화한다 (error path — 비-ApiError 경계)', async () => {
    requestMock.mockRejectedValue(new TypeError('boom'));
    const { deps, calls } = makeUpdatePartDeps(false);
    await expect(
      runUpdatePart('pt1', '보안파트', '개발파트', deps),
    ).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, '알 수 없는 오류']);
    expect(calls.updating).toEqual([true, false]);
  });

  // branch(isConflict 분기) — 동일 409 응답이라도 isConflict 가 false 를 내면 전용 문구가 아니라
  // describeError 일반 문구를 쓴다(409 판정이 주입 의존임을 방증 — true/false 두 분기 cover).
  it('isConflict 가 false 를 내면 409 여도 일반 문구를 쓴다 (branch — isConflict true/false 분기)', async () => {
    requestMock.mockRejectedValue(new ApiError(409, 'Conflict'));
    const { deps, calls } = makeUpdatePartDeps(false);
    // 항상 false 를 내는 판정으로 교체(주입 의존 검증).
    deps.isConflict = () => false;
    await expect(
      runUpdatePart('pt1', '보안파트', '개발파트', deps),
    ).resolves.toBeUndefined();
    expect(calls.error).toEqual([undefined, 'HTTP 409: Conflict']);
    expect(calls.error).not.toContain(DUP);
  });

  // branch(a) — 빈/공백/falsy id 는 PATCH 미발사·state 불변(잘못된 path 회피). 경계값 각각 cover.
  it('빈/공백/falsy id 는 PATCH 를 발사하지 않는다 (branch (a) — id 가드)', async () => {
    for (const badId of ['', '   ']) {
      requestMock.mockReset();
      const { deps, calls } = makeUpdatePartDeps(false);
      await expect(
        runUpdatePart(badId, '보안파트', '개발파트', deps),
      ).resolves.toBeUndefined();
      expect(requestMock).not.toHaveBeenCalled();
      expect(calls.updating).toEqual([]);
      expect(calls.bump).toBe(0);
    }
    // undefined id 도 안전(런타임 비정상 입력 방어).
    requestMock.mockReset();
    const { deps, calls } = makeUpdatePartDeps(false);
    await expect(
      runUpdatePart(undefined as unknown as string, '보안파트', '개발파트', deps),
    ).resolves.toBeUndefined();
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.updating).toEqual([]);
  });

  // branch(b) — 이전 update 미완(updating=true) 중 재호출은 PATCH 미발사·state 불변(이중 PATCH 차단).
  it('이전 update 미완(updating=true) 중 재호출은 PATCH 를 발사하지 않는다 (branch (b) — 이중 PATCH 가드)', async () => {
    const { deps, calls } = makeUpdatePartDeps(true); // 이미 in-flight.
    await runUpdatePart('pt1', '보안파트', '개발파트', deps);
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.updating).toEqual([]);
    expect(calls.error).toEqual([]);
    expect(calls.bump).toBe(0);
  });

  // branch(c) — 빈/공백-only name 은 PATCH 미발사(빈 body·400 회피 — @IsNotEmpty). 경계값 각각 cover.
  it('빈/공백-only name 은 PATCH 를 발사하지 않는다 (branch (c) — 빈·공백 name 가드)', async () => {
    for (const badName of ['', '   ']) {
      requestMock.mockReset();
      const { deps, calls } = makeUpdatePartDeps(false);
      await expect(
        runUpdatePart('pt1', badName, '개발파트', deps),
      ).resolves.toBeUndefined();
      expect(requestMock).not.toHaveBeenCalled();
      expect(calls.updating).toEqual([]);
      expect(calls.bump).toBe(0);
      expect(calls.close).toBe(0);
    }
    // undefined name(런타임 비정상 입력)도 optional chaining 으로 안전 no-op.
    requestMock.mockReset();
    const { deps } = makeUpdatePartDeps(false);
    await expect(
      runUpdatePart('pt1', undefined as unknown as string, '개발파트', deps),
    ).resolves.toBeUndefined();
    expect(requestMock).not.toHaveBeenCalled();
  });

  // branch(d) — 미변경 name(입력 trim 후 원본과 동일)이면 PATCH 미발사(무의미한 요청 억제 + 자기
  // 자신과의 409 유발 회피 — no-op).
  it('미변경 name(원본과 동일)이면 PATCH 를 발사하지 않는다 (branch (d) — 미변경 name no-op 가드)', async () => {
    const { deps, calls } = makeUpdatePartDeps(false);
    // 동일 name(앞뒤 공백만 덧댄 입력도 trim 후 동일 → 미변경 취급).
    await expect(
      runUpdatePart('pt1', '  개발파트  ', '개발파트', deps),
    ).resolves.toBeUndefined();
    expect(requestMock).not.toHaveBeenCalled();
    expect(calls.updating).toEqual([]);
    expect(calls.bump).toBe(0);
    expect(calls.close).toBe(0);
  });

  // negative(id 인코딩) — 특수문자가 든 id 는 encodeURIComponent 로 안전 인코딩된다(path 손상 방지).
  it('id 를 encodeURIComponent 로 안전 인코딩해 path 를 만든다 (negative — 특수문자 id 인코딩)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps } = makeUpdatePartDeps(false);
    await runUpdatePart('pt 1/x', '보안파트', '개발파트', deps);
    expect(requestMock.mock.calls[0]?.[0]).toBe('/api/parts/pt%201%2Fx');
  });

  // negative(name trim) — 발사되는 body 의 name 은 앞뒤 공백을 trim 한 값이다(공백 오염 방지).
  it('발사되는 body 의 name 은 앞뒤 공백을 trim 한 값이다 (negative — name trim)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps } = makeUpdatePartDeps(false);
    await runUpdatePart('pt1', '  보안파트  ', '개발파트', deps);
    const options = requestMock.mock.calls[0]?.[1] as { body: string };
    expect(JSON.parse(options.body)).toEqual({ name: '보안파트' });
  });

  // negative(이중 PATCH 차단, 순차) — 정상 발사는 request 를 정확히 1 회만 호출한다(중복 없음).
  it('정상 발사 시 PATCH 를 1 회만 호출한다 (negative — 재클릭 이중 PATCH 차단)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps } = makeUpdatePartDeps(false);
    await runUpdatePart('pt1', '보안파트', '개발파트', deps);
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(requestMock.mock.calls[0]?.[0]).toBe('/api/parts/pt1');
  });

  // negative(reject→finally 복구) — 실패 후에도 finally 가 setUpdating(false) 로 진행 표시를 복구한다.
  it('reject 시에도 finally 로 진행 표시(updating)를 복구한다 (negative — reject→finally 복구)', async () => {
    requestMock.mockRejectedValueOnce(new ApiError(409, 'Conflict'));
    const fail = makeUpdatePartDeps(false);
    await runUpdatePart('pt1', '보안파트', '개발파트', fail.deps);
    expect(fail.calls.updating).toEqual([true, false]);

    requestMock.mockResolvedValueOnce(undefined);
    const ok = makeUpdatePartDeps(false);
    await runUpdatePart('pt1', '보안파트', '개발파트', ok.deps);
    expect(ok.calls.updating).toEqual([true, false]);
  });

  // negative(편집 상태 전이) — 성공 시 편집 종료(closeEdit), 409 실패 시 편집 유지(closeEdit 미호출 —
  // 사용자가 다른 이름으로 즉시 재시도할 수 있어야 한다).
  it('성공 시 편집을 종료하고 409 실패 시 편집을 유지한다 (negative — 편집 상태 전이)', async () => {
    requestMock.mockResolvedValueOnce(undefined);
    const ok = makeUpdatePartDeps(false);
    await runUpdatePart('pt1', '보안파트', '개발파트', ok.deps);
    expect(ok.calls.close).toBe(1);

    requestMock.mockRejectedValueOnce(new ApiError(409, 'Conflict'));
    const fail = makeUpdatePartDeps(false);
    await runUpdatePart('pt1', '보안파트', '개발파트', fail.deps);
    expect(fail.calls.close).toBe(0);
  });

  // negative(409 후 재시도 error 초기화) — 중복으로 실패한 뒤 다른 이름으로 재발사하면 시작 시점에
  // 직전 중복 문구가 비워진다(잔존 문구 오독 방지).
  it('409 실패 후 다른 이름으로 재시도하면 직전 중복 문구를 먼저 비운다 (negative — 재시도 error 초기화)', async () => {
    requestMock.mockRejectedValueOnce(new ApiError(409, 'Conflict'));
    const first = makeUpdatePartDeps(false);
    await runUpdatePart('pt1', '보안파트', '개발파트', first.deps);
    expect(first.calls.error).toEqual([undefined, DUP]);

    requestMock.mockResolvedValueOnce(undefined);
    const second = makeUpdatePartDeps(false);
    await runUpdatePart('pt1', '인프라파트', '개발파트', second.deps);
    // 성공 경로 — 시작 비움만 남고 실패 문구는 설정되지 않는다.
    expect(second.calls.error).toEqual([undefined]);
    expect(second.calls.bump).toBe(1);
  });

  // negative(시작 정리/재조회 전 안전) — 발사 직후 진행 표시 on + 직전 error 즉시 비움을 지연 resolve
  // 로 캡처한다(재조회 도착 전 상태에서 crash 없음 — unmount race 방어). 해소 후 재조회 bump + 편집
  // 종료 + 진행 off.
  it('발사 직후 진행 표시 on + 직전 error 를 즉시 비운다 (negative — 재조회 전 상태 안전)', async () => {
    let resolvePatch: () => void = () => {};
    requestMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvePatch = resolve;
        }),
    );
    const { deps, calls } = makeUpdatePartDeps(false);
    const pending = runUpdatePart('pt1', '보안파트', '개발파트', deps);
    expect(calls.updating).toEqual([true]);
    expect(calls.error).toEqual([undefined]);
    expect(calls.bump).toBe(0);
    expect(calls.close).toBe(0);
    resolvePatch();
    await pending;
    expect(calls.bump).toBe(1);
    expect(calls.close).toBe(1);
    expect(calls.updating).toEqual([true, false]);
  });

  // negative(응답 shape 무관) — request 가 예상 밖 값(null)으로 resolve 해도 성공 경로로 안전 처리한다.
  it('request 가 예상 밖 값(null)으로 resolve 해도 성공 경로로 안전 처리한다 (negative — 응답 shape 무관)', async () => {
    requestMock.mockResolvedValue(null);
    const { deps, calls } = makeUpdatePartDeps(false);
    await expect(
      runUpdatePart('pt1', '보안파트', '개발파트', deps),
    ).resolves.toBeUndefined();
    expect(calls.bump).toBe(1);
    expect(calls.close).toBe(1);
    expect(calls.error).toEqual([undefined]);
  });
});

// R-112 — T-1155 파트 수정 배선 렌더 검증. 파트 관리 마운트(PartList)에 onEdit=handleEditPart 가
// 배선돼 각 파트 행에 "수정" 버튼이 part 수만큼 렌더됨을 정적 markup 으로 단언한다(클릭→prefill·러너
// 호출 자체는 위 runUpdatePart 단위 test 가 cover — 본 파일은 jsdom 미사용 정적 렌더라 이벤트 비검증).
// 초기(편집 대상 미선택)엔 인라인 수정 폼이 미렌더됨도 확인한다. 비-Admin 등급으로 두어 provider 목록
// 패널의 "수정" 버튼과 섞이지 않게 격리한다(파트 섹션은 gating 밖이라 비-Admin 에도 렌더된다).
describe('AdminView — 파트 수정 배선 (정적 렌더, T-1155)', () => {
  const PARTS = '/api/parts';
  const countOccurrences = (haystack: string, needle: string) =>
    haystack.split(needle).length - 1;

  // 파트 2 건 샘플 — 각 행에 수정 버튼이 배선됨을 part 수(2)로 단언한다.
  const PART_ROWS = [
    { id: 'pt1', name: '개발파트', persons: [{}, {}] },
    { id: 'pt2', name: '디자인파트', persons: [{}] },
  ];

  beforeEach(() => {
    useApiResourceMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-path — 파트 목록이 있으면 각 행에 수정 버튼(onEdit=handleEditPart 배선)이 part 수만큼
  // 렌더된다. 비-Admin 이라 provider 목록 패널은 미마운트 + 인원/그룹은 빈 목록 → "수정" 버튼의
  // 유일 출처는 파트 목록.
  it('파트 목록이 있으면 각 행에 수정 버튼을 렌더한다 (happy-path — onEdit 배선)', () => {
    setRoutes({
      [PARTS]: { data: PART_ROWS, loading: false, error: undefined },
      [AUTH_ME]: { data: { role: 'User' }, loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toContain('개발파트');
    expect(countOccurrences(html, '>수정</button>')).toBe(PART_ROWS.length);
  });

  // branch/negative — 초기(편집 대상 미선택, editingPartId=null)엔 인라인 수정 폼이 미렌더된다.
  it('초기(편집 미선택)엔 인라인 수정 폼을 렌더하지 않는다 (branch/negative — editingPartId=null)', () => {
    setRoutes({
      [PARTS]: { data: PART_ROWS, loading: false, error: undefined },
      [AUTH_ME]: { data: { role: 'User' }, loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    // 인라인 수정 폼의 입력(aria-label)은 편집 대상 선택 전에는 미렌더된다.
    expect(html).not.toContain('aria-label="수정할 파트 이름"');
    // "파트 수정" 저장 버튼도 편집 폼 안에만 있어 미렌더된다(생성 폼의 "파트 추가" 와 구분).
    expect(html).not.toContain('>파트 수정</button>');
    // 편집 미시작이라 수정 실패 문구도 없다.
    expect(html).not.toContain('이미 존재하는 파트 이름입니다');
  });

  // branch/negative — 파트가 0 건이면 렌더할 행이 없어 수정 버튼이 미렌더된다(빈 상태 문구만).
  it('파트가 0 건이면 수정 버튼을 렌더하지 않는다 (branch/negative — 빈 목록)', () => {
    setRoutes({
      [PARTS]: { data: [], loading: false, error: undefined },
      [AUTH_ME]: { data: { role: 'User' }, loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toContain('등록된 파트가 없습니다');
    expect(countOccurrences(html, '>수정</button>')).toBe(0);
  });

  // negative — id 없는 파트 행은 콜백 인자가 없어 수정·삭제 버튼이 미렌더된다(PartList rowId 가드
  // 경계 — 배선 후에도 유지).
  it('id 없는 파트 행은 수정 버튼을 렌더하지 않는다 (negative — rowId 가드 경계)', () => {
    setRoutes({
      [PARTS]: {
        data: [{ name: '무id파트', persons: [] }],
        loading: false,
        error: undefined,
      },
      [AUTH_ME]: { data: { role: 'User' }, loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toContain('무id파트');
    expect(countOccurrences(html, '>수정</button>')).toBe(0);
    expect(countOccurrences(html, '>삭제</button>')).toBe(0);
  });

  // negative — 파트 조회가 error 면 목록 대신 alert 만 렌더돼 수정 버튼이 미렌더된다(에러 표면에서
  // 편집 진입 불가 — fail-closed 경계).
  it('파트 조회 실패 시 수정 버튼을 렌더하지 않는다 (negative — error 표면 경계)', () => {
    setRoutes({
      [PARTS]: { data: undefined, loading: false, error: 'HTTP 500: parts boom' },
      [AUTH_ME]: { data: { role: 'User' }, loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    expect(html).toContain('HTTP 500: parts boom');
    expect(countOccurrences(html, '>수정</button>')).toBe(0);
  });
});

// R-112 — T-1156 선택 파트 소속 인원 조회 path 빌더(buildPartPersonsPath) 검증.
// buildGroupMembersPath 와 동형이되 base 가 /api/parts/:id/persons 다. 미선택(null 조건부 조회)/
// nonce 0(base)/nonce 1+(`_r` 부착)/특수문자 id(encodeURIComponent)/빈 문자열·음수 negative 를
// 각 1+ cover 한다(순수 함수라 렌더러 없이 직접 호출 — jsdom 미사용 게이트 정합).
describe('AdminView — buildPartPersonsPath (순수 함수, T-1156)', () => {
  // 분기 — 미선택(undefined)이면 null 을 반환해 useApiResource 조건부 미조회(idle)를 유발한다.
  it('파트 미선택(undefined)이면 null 을 반환한다 (분기 — 조건부 미조회)', () => {
    expect(buildPartPersonsPath(undefined)).toBeNull();
  });

  // negative — 빈 문자열 partId(비정상/미선택 잔재)도 falsy 라 null 로 안전 fallback 한다
  // (`/api/parts//persons` 같은 깨진 path 로 404 를 유발하지 않는다).
  it('빈 문자열 partId 도 null 로 안전 fallback 한다 (negative — 깨진 path 방지)', () => {
    expect(buildPartPersonsPath('')).toBeNull();
  });

  // happy/경계 — 선택 + nonce 기본값(인자 생략 = 0)이면 query 없는 base path 를 반환한다.
  it('선택 + nonce 생략이면 query 없는 base path 를 반환한다 (happy — 기본 인자 경계)', () => {
    expect(buildPartPersonsPath('pt1')).toBe('/api/parts/pt1/persons');
    expect(buildPartPersonsPath('pt1', 0)).toBe('/api/parts/pt1/persons');
  });

  // 분기 — nonce 1+ 면 `_r=<nonce>` 를 부착해 path 를 변화시킨다(재조회 트리거).
  it('nonce 1+ 이면 `_r` query 를 부착한 path 를 반환한다 (분기 — 재조회 트리거)', () => {
    expect(buildPartPersonsPath('pt1', 1)).toBe('/api/parts/pt1/persons?_r=1');
    expect(buildPartPersonsPath('pt2', 7)).toBe('/api/parts/pt2/persons?_r=7');
  });

  // negative — 특수문자가 든 id 도 encodeURIComponent 로 안전 인코딩해 path 가 깨지지 않는다.
  it('특수문자 id 를 encodeURIComponent 로 안전 인코딩한다 (negative — 비정상 id 경계)', () => {
    expect(buildPartPersonsPath('a b/c?d')).toBe(
      '/api/parts/a%20b%2Fc%3Fd/persons',
    );
  });

  // negative — 음수 nonce(비정상)도 <=0 분기라 base path 로 안전 fallback 한다(query 미부착).
  it('음수 nonce 는 base path 로 안전 fallback 한다 (negative — 음수 방어)', () => {
    expect(buildPartPersonsPath('pt1', -3)).toBe('/api/parts/pt1/persons');
  });
});

// R-112 — T-1156 파트 소속 인원 조회 섹션 배선(선택 <select> + 조건부 GET /api/parts/:id/persons →
// PersonList 읽기 전용 렌더) 검증. happy(선택 시 실 조회 + 인원 이름 렌더) / error path(404·500·
// 네트워크 → role="alert", throw 0) / 분기(loading 우선·빈 배열 empty 문구·미선택 미조회) /
// negative(빈 문자열 partId 미조회, 비배열 payload 안전 처리, 선택 변경 시 이전 파트 인원 잔존 0,
// 읽기 전용이라 삭제·수정 버튼 미렌더, 기존 파트 CRUD 폼 회귀 0)를 각 1+ cover 한다.
// renderToStaticMarkup + useApiResource mock 으로 시나리오를 통제한다(jsdom 미사용 게이트 정합).
describe('AdminView — 파트 소속 인원 조회 배선 (T-1156)', () => {
  const PARTS = '/api/parts';
  const PT1_PERSONS = '/api/parts/pt1/persons';
  const PT2_PERSONS = '/api/parts/pt2/persons';
  // 파트 인원 path 매칭 정규식 — 조건부 미조회(호출 0) 단언에 쓴다.
  const PART_PERSONS_RE = /^\/api\/parts\/[^/]+\/persons/;

  // 파트 목록 샘플 — 파트 선택 <select> 옵션의 원천. 소속 인원 이름과 겹치지 않는 값으로 둔다.
  const PART_ROWS = [
    { id: 'pt1', name: '개발파트' },
    { id: 'pt2', name: '디자인파트' },
  ];

  // 파트별 소속 인원 샘플 — PersonRow 계약 그대로(읽기 전용 렌더 대상). 이름은 다른 섹션 샘플
  // (김철수/이영희 등)과 겹치지 않게 두어 파트 소속 인원 경로만 분리 관찰한다.
  const PT1_ROWS: PersonRow[] = [
    { id: 'pp1', fullName: '한소속', email: 'soso@example.com', active: true },
    { id: 'pp2', fullName: '두번원', email: 'dubun@example.com', active: false },
  ];
  const PT2_ROWS: PersonRow[] = [
    { id: 'pp3', fullName: '디자이너갑', email: 'gap@example.com', active: true },
  ];

  // markup 안 특정 조각의 등장 횟수를 세는 헬퍼(읽기 전용 — 버튼 미렌더 단언용).
  const countOccurrences = (haystack: string, needle: string) =>
    haystack.split(needle).length - 1;

  beforeEach(() => {
    useApiResourceMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-path — 파트 선택 시 GET /api/parts/:id/persons 를 정확한 path 로 조회하고, 응답 인원의
  // 이름·이메일이 화면에 렌더된다. 파트 선택 <select>(aria-label)도 옵션과 함께 마운트된다.
  it('파트 선택 시 소속 인원 endpoint 를 실 조회해 인원 이름을 렌더한다 (happy-path)', () => {
    setRoutes({
      [PARTS]: { data: PART_ROWS, loading: false, error: undefined },
      [PT1_PERSONS]: { data: PT1_ROWS, loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView initialSelectedPartId="pt1" />);
    // 조건부 조회가 선택 파트 path 로 정확히 한 번 발사된다.
    const paths = useApiResourceMock.mock.calls.map((c) => c[0]);
    expect(paths.filter((p) => p === PT1_PERSONS)).toHaveLength(1);
    // 파트 선택 <select> + 빈 선택지 라벨이 마운트된다.
    expect(html).toContain('aria-label="소속 인원을 볼 파트 선택"');
    expect(html).toContain('파트를 선택하세요');
    // 응답 인원의 이름·이메일이 PersonList 로 렌더된다.
    expect(html).toContain('한소속');
    expect(html).toContain('두번원');
    expect(html).toContain('soso@example.com');
  });

  // error path — 404(파트 부재)면 PersonList 의 error 영역(role="alert")이 렌더되고 목록은 미렌더,
  // 렌더 자체는 throw 하지 않는다(안전 표시).
  it('소속 인원 조회 404 시 alert 를 렌더하고 목록은 미렌더한다 (error path — 404)', () => {
    setRoutes({
      [PARTS]: { data: PART_ROWS, loading: false, error: undefined },
      [PT1_PERSONS]: {
        data: undefined,
        loading: false,
        error: 'HTTP 404: part not found',
      },
    });
    const html = renderToStaticMarkup(<AdminView initialSelectedPartId="pt1" />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('HTTP 404: part not found');
    expect(html).not.toContain('한소속');
  });

  // error path — 500 / 네트워크 실패(status 0 문구)도 동일하게 alert 로 안전 표시되고 throw 0.
  it('소속 인원 조회 500·네트워크 실패도 alert 로 안전 표시한다 (error path — 500/네트워크)', () => {
    setRoutes({
      [PARTS]: { data: PART_ROWS, loading: false, error: undefined },
      [PT1_PERSONS]: {
        data: undefined,
        loading: false,
        error: 'HTTP 500: persons boom',
      },
    });
    expect(() =>
      renderToStaticMarkup(<AdminView initialSelectedPartId="pt1" />),
    ).not.toThrow();
    setRoutes({
      [PARTS]: { data: PART_ROWS, loading: false, error: undefined },
      [PT1_PERSONS]: {
        data: undefined,
        loading: false,
        error: '네트워크 오류: failed to fetch',
      },
    });
    const html = renderToStaticMarkup(<AdminView initialSelectedPartId="pt1" />);
    expect(html).toContain('네트워크 오류: failed to fetch');
    expect(html).not.toContain('한소속');
  });

  // 분기 — loading 중이면 loading 우선 정책으로 로딩 표면만 렌더되고 인원 목록은 미렌더된다.
  it('소속 인원 조회 loading 중이면 로딩 표면을 우선 렌더한다 (분기 — loading 우선)', () => {
    setRoutes({
      [PARTS]: { data: PART_ROWS, loading: false, error: undefined },
      [PT1_PERSONS]: { data: PT1_ROWS, loading: true, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView initialSelectedPartId="pt1" />);
    expect(html).toContain('불러오는 중…');
    expect(html).not.toContain('한소속');
  });

  // 분기 — 파트는 있으나 인원 0(200 + 빈 배열)이면 인원 0 전용 빈 문구를 렌더한다(미선택 안내와 구분).
  it('선택 파트의 인원이 0 이면 인원 0 전용 빈 문구를 렌더한다 (분기 — 빈 배열)', () => {
    setRoutes({
      [PARTS]: { data: PART_ROWS, loading: false, error: undefined },
      [PT1_PERSONS]: { data: [], loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView initialSelectedPartId="pt1" />);
    expect(html).toContain('이 파트에 속한 인원이 없습니다');
    expect(html).not.toContain('파트를 선택하면 소속 인원을 표시합니다');
  });

  // 분기 — 미선택(초기값 미주입)이면 path=null 로 미조회(idle)하고 미선택 안내를 렌더한다.
  it('파트 미선택이면 소속 인원 endpoint 를 조회하지 않고 미선택 안내를 렌더한다 (분기 — 조건부 미조회)', () => {
    setRoutes({
      [PARTS]: { data: PART_ROWS, loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView />);
    const paths = useApiResourceMock.mock.calls.map((c) => c[0]);
    // 어떤 파트 인원 path 도 호출되지 않는다(조건부 미조회) — null 로만 호출된다.
    expect(
      paths.filter((p) => typeof p === 'string' && PART_PERSONS_RE.test(p)),
    ).toHaveLength(0);
    expect(paths).toContain(null);
    expect(html).toContain('파트를 선택하면 소속 인원을 표시합니다');
  });

  // negative — 빈 문자열 초기 partId(비정상 잔재)도 미선택과 동일하게 미조회를 유지한다.
  it('빈 문자열 partId 는 미조회를 유지한다 (negative — 빈 입력 경계)', () => {
    setRoutes({
      [PARTS]: { data: PART_ROWS, loading: false, error: undefined },
    });
    renderToStaticMarkup(<AdminView initialSelectedPartId="" />);
    const paths = useApiResourceMock.mock.calls.map((c) => c[0]);
    expect(
      paths.filter((p) => typeof p === 'string' && PART_PERSONS_RE.test(p)),
    ).toHaveLength(0);
  });

  // negative — 응답이 배열이 아닌 비정상 payload(객체 등)여도 빈 목록으로 안전 처리하고 throw 하지
  // 않는다(PersonList 가 undefined.length 로 깨지지 않도록 하는 경계 방어).
  it('비배열 payload 는 빈 목록으로 안전 처리하고 throw 하지 않는다 (negative — 비정상 payload)', () => {
    setRoutes({
      [PARTS]: { data: PART_ROWS, loading: false, error: undefined },
      [PT1_PERSONS]: {
        data: { unexpected: true },
        loading: false,
        error: undefined,
      },
    });
    let html = '';
    expect(() => {
      html = renderToStaticMarkup(<AdminView initialSelectedPartId="pt1" />);
    }).not.toThrow();
    expect(html).toContain('이 파트에 속한 인원이 없습니다');
  });

  // negative — 선택 파트가 다르면 그 파트의 인원만 렌더되고 다른 파트 인원은 잔존하지 않는다
  // (path 가 선택마다 달라져 useApiResource 가 새 조회 결과로 교체 — stale 표시 0).
  it('선택 파트를 바꾸면 이전 파트 인원이 잔존하지 않는다 (negative — stale 표시 방지)', () => {
    setRoutes({
      [PARTS]: { data: PART_ROWS, loading: false, error: undefined },
      [PT1_PERSONS]: { data: PT1_ROWS, loading: false, error: undefined },
      [PT2_PERSONS]: { data: PT2_ROWS, loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView initialSelectedPartId="pt2" />);
    const paths = useApiResourceMock.mock.calls.map((c) => c[0]);
    expect(paths).toContain(PT2_PERSONS);
    expect(paths).not.toContain(PT1_PERSONS);
    expect(html).toContain('디자이너갑');
    expect(html).not.toContain('한소속');
  });

  // negative — 읽기 전용 재사용이라 소속 인원 행에 삭제·수정 버튼이 렌더되지 않는다(onDelete/onEdit
  // 미전달). 비-Admin 등급 + 파트 목록 빈 배열로 다른 섹션의 버튼을 배제해 소속 인원 목록만 남긴다.
  it('소속 인원 목록에 삭제·수정 버튼을 렌더하지 않는다 (negative — 읽기 전용 재사용)', () => {
    setRoutes({
      [PARTS]: { data: [], loading: false, error: undefined },
      [PT1_PERSONS]: { data: PT1_ROWS, loading: false, error: undefined },
      [AUTH_ME]: { data: { role: 'User' }, loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView initialSelectedPartId="pt1" />);
    expect(html).toContain('한소속');
    expect(countOccurrences(html, '>삭제</button>')).toBe(0);
    expect(countOccurrences(html, '>수정</button>')).toBe(0);
  });

  // negative — 기존 파트 CRUD 폼·목록과 그룹 섹션이 회귀 없이 그대로 렌더된다(본 slice 는 추가만).
  it('기존 파트 CRUD 폼·목록이 회귀 없이 함께 렌더된다 (negative — 회귀 0)', () => {
    setRoutes({
      [PARTS]: { data: PART_ROWS, loading: false, error: undefined },
      [PT1_PERSONS]: { data: PT1_ROWS, loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<AdminView initialSelectedPartId="pt1" />);
    expect(html).toContain('파트 관리');
    expect(html).toContain('aria-label="추가할 파트 이름"');
    expect(html).toContain('파트 추가</button>');
    expect(html).toContain('개발파트');
    expect(html).toContain('디자인파트');
    // 그룹 섹션(다른 조회)도 그대로 유지된다.
    expect(html).toContain('aria-label="그룹 선택"');
  });
});

// R-112 — T-1157 파트 삭제 성공 후 선택 파트 id 결정 순수 helper 검증. 동일 id(선택 해제) / 다른
// id(선택 보존) / 빈·공백·undefined-like 비정상 입력(throw 0 안전 fallback) 분기를 각각 cover
// 한다. jsdom·렌더러 불요(순수 함수 직접 호출 — buildPartPersonsPath convention 정합).
describe('AdminView — resolveSelectedPartIdAfterDelete (순수 함수, T-1157)', () => {
  // happy/분기 — 삭제된 파트가 현재 선택 중이면 빈 문자열로 선택을 해제하고(사라진 파트의 소속
  // 인원 404 재조회 + <select> 표시값 불일치 차단), 선택하지 않은 다른 파트를 삭제했으면 현재
  // 선택을 그대로 보존한다(무관한 선택 초기화 0). current 가 빈 문자열(미선택)이면 그대로 유지.
  it('동일 id 는 선택을 해제하고 다른 id 는 선택을 보존한다 (happy/분기)', () => {
    expect(resolveSelectedPartIdAfterDelete('pt1', 'pt1')).toBe('');
    expect(resolveSelectedPartIdAfterDelete('pt1', 'pt2')).toBe('pt1');
    expect(resolveSelectedPartIdAfterDelete('', 'pt2')).toBe('');
  });

  // negative — 빈 문자열·공백·undefined-like 비정상 입력도 throw 없이 안전 fallback 한다.
  // deletedId 가 비거나 공백뿐이면 runDeletePart 의 미발사 가드와 같은 의미로 "삭제 대상 없음"
  // 취급해 선택을 건드리지 않고, current 가 falsy 면 빈 문자열로 정규화한다.
  it('빈·공백·undefined-like 입력도 throw 없이 안전 fallback 한다 (negative — 경계값)', () => {
    expect(resolveSelectedPartIdAfterDelete('', '')).toBe('');
    expect(resolveSelectedPartIdAfterDelete('pt1', '')).toBe('pt1');
    // 공백뿐인 id 는 무시된다 — 선택 중인 값이 공백이어도 해제되지 않는다(러너 가드와 동의미).
    expect(resolveSelectedPartIdAfterDelete('   ', '   ')).toBe('   ');
    expect(resolveSelectedPartIdAfterDelete('pt1', '   ')).toBe('pt1');
    expect(() =>
      resolveSelectedPartIdAfterDelete(
        undefined as unknown as string,
        undefined as unknown as string,
      ),
    ).not.toThrow();
    expect(
      resolveSelectedPartIdAfterDelete(undefined as unknown as string, 'pt1'),
    ).toBe('');
  });

  // R-112 회귀 방어(round 2 reviewer MAJOR (1)) — 컨테이너가 runDeletePart 에 주입하는 bumpRefresh
  // 콜백 "실물"(buildDeletePartBumpRefresh)을 fake setter 2 개로 직접 호출해 nonce +1 과 선택 전이를
  // 단언한다. 배선 라인이 미래에 제거·변형되면 본 test 가 fail 한다(harness 자기검증 아님).
  it('bumpRefresh 실물이 nonce +1 과 선택 전이를 functional setter 로 수행한다 (배선 회귀 방어)', () => {
    const calls: Array<'nonce' | 'selected'> = [];
    const run = (selected: string, deletedId: string) => {
      const state = { nonce: 0, selected };
      buildDeletePartBumpRefresh(
        (updater) => {
          calls.push('nonce');
          state.nonce = updater(state.nonce);
        },
        (updater) => {
          calls.push('selected');
          state.selected = updater(state.selected);
        },
        deletedId,
      )();
      return state;
    };
    // 동일 id — 선택 해제 + 재조회 nonce bump. 두 setter 모두 functional updater 로 호출된다.
    expect(run('pt1', 'pt1')).toEqual({ nonce: 1, selected: '' });
    expect(calls).toEqual(['nonce', 'selected']);
    // 다른 id — 선택 보존, nonce 는 그래도 bump(파트 목록 재조회는 항상 필요).
    expect(run('pt1', 'pt2')).toEqual({ nonce: 1, selected: 'pt1' });
    // 생성만 하고 호출하지 않으면 setter 가 하나도 불리지 않는다(실패 경로 미호출 계약 정합).
    const untouched = { nonce: 0, selected: 'pt1' };
    buildDeletePartBumpRefresh(
      (u) => {
        untouched.nonce = u(untouched.nonce);
      },
      (u) => {
        untouched.selected = u(untouched.selected);
      },
      'pt1',
    );
    expect(untouched).toEqual({ nonce: 0, selected: 'pt1' });
  });
});

// R-112 — T-1157 선택 파트 삭제 시 선택 해제 배선 검증. 컨테이너 handleDeletePart 가 runDeletePart
// 에 주입하는 bumpRefresh(성공 경로 전용 계약 — 파트 재조회 nonce +1 + functional setSelectedPartId)
// 를 그대로 mirror 한 harness 로 실 전이를 검증하고(jsdom 미사용 게이트 정합 — 클릭 이벤트 비검증),
// 전이 후 화면 상태(미선택 문구 / 사라진 파트 인원 미조회 / 선택 보존)는 정적 렌더로 단언한다.
describe('AdminView — 선택 파트 삭제 시 선택 해제 배선 (T-1157)', () => {
  const PARTS = '/api/parts';
  const PT1_PERSONS = '/api/parts/pt1/persons';
  // 파트 인원 path 매칭 정규식 — 삭제된 파트 재조회 0 단언에 쓴다.
  const PART_PERSONS_RE = /^\/api\/parts\/[^/]+\/persons/;
  const PART_ROWS = [
    { id: 'pt1', name: '개발파트' },
    { id: 'pt2', name: '디자인파트' },
  ];
  const PT1_ROWS: PersonRow[] = [
    { id: 'pp1', fullName: '한소속', email: 'soso@example.com', active: true },
  ];

  // 컨테이너 배선 harness — handleDeletePart 의 deps 를 재현하되, bumpRefresh 는 구현을 복제하지
  // 않고 컨테이너가 쓰는 것과 **같은 실물** buildDeletePartBumpRefresh 를 fake setter 2 개로 조립해
  // 주입한다(round 2 reviewer MAJOR (1) — 배선 라인이 사라지면 아래 test 들이 fail 한다). 실패 시
  // bumpRefresh 미호출로 선택 보존이 자동 보장되는지도 같은 harness 로 관찰한다.
  function makeWiredDeps(selected: string, id: string) {
    const state = { selected, nonce: 0 };
    const deps: DeletePartDeps = {
      remove: (...args: unknown[]) => requestMock(...args),
      describeError: (e: unknown) =>
        e instanceof ApiError ? `HTTP ${e.status}: ${e.message}` : '알 수 없는 오류',
      deleting: false,
      setDeleting: () => {},
      setDeleteError: () => {},
      bumpRefresh: buildDeletePartBumpRefresh(
        (updater) => {
          state.nonce = updater(state.nonce);
        },
        (updater) => {
          state.selected = updater(state.selected);
        },
        id,
      ),
    };
    return { deps, state };
  }

  beforeEach(() => {
    requestMock.mockReset();
    useApiResourceMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-path — 선택 중인 파트 삭제가 성공하면 선택이 해제되고(빈 문자열) 재조회 nonce 도 bump
  // 된다. 해제 후 화면은 미선택 문구를 표시하고 사라진 파트의 인원 endpoint 를 재조회하지 않는다
  // (404 alert 잔존 0).
  it('선택 파트 삭제 성공 시 선택이 해제되고 미선택 화면으로 되돌아간다 (happy-path)', async () => {
    requestMock.mockResolvedValue(undefined); // 204 No Content.
    const { deps, state } = makeWiredDeps('pt1', 'pt1');
    await runDeletePart('pt1', deps);
    expect(state.selected).toBe('');
    expect(state.nonce).toBe(1);
    // 선택 해제 상태의 화면 — 삭제된 파트가 빠진 목록 + 미선택 안내 + 인원 재조회 0.
    setRoutes({
      [PARTS]: {
        data: [{ id: 'pt2', name: '디자인파트' }],
        loading: false,
        error: undefined,
      },
    });
    const html = renderToStaticMarkup(
      <AdminView initialSelectedPartId={state.selected} />,
    );
    const paths = useApiResourceMock.mock.calls.map((c) => c[0]);
    expect(
      paths.filter((p) => typeof p === 'string' && PART_PERSONS_RE.test(p)),
    ).toHaveLength(0);
    expect(html).toContain('파트를 선택하면 소속 인원을 표시합니다');
    expect(html).not.toContain('role="alert"');
  });

  // error path — 삭제 DELETE 가 실패(404/403/네트워크)하면 성공 전용 bumpRefresh 가 호출되지 않아
  // 선택이 유지되고 예외도 throw 되지 않는다. 선택이 유지된 화면은 그 파트의 소속 인원을 그대로
  // 표시한다.
  it('삭제 실패 시 선택이 유지되고 throw 하지 않는다 (error path — 404/403/네트워크)', async () => {
    const failures = [
      new ApiError(404, 'Not Found'),
      new ApiError(403, 'Forbidden'),
      new ApiError(0, 'fetch failed'),
    ];
    let survived = '';
    for (const err of failures) {
      requestMock.mockRejectedValueOnce(err);
      const { deps, state } = makeWiredDeps('pt1', 'pt1');
      await expect(runDeletePart('pt1', deps)).resolves.toBeUndefined();
      expect(state.selected).toBe('pt1');
      expect(state.nonce).toBe(0);
      survived = state.selected;
    }
    setRoutes({
      [PARTS]: { data: PART_ROWS, loading: false, error: undefined },
      [PT1_PERSONS]: { data: PT1_ROWS, loading: false, error: undefined },
    });
    // 실패 후 "실제로 남은" 선택값으로 렌더해 인과를 잇는다(하드코딩 id 미사용 — round 2 MINOR (2)).
    const html = renderToStaticMarkup(
      <AdminView initialSelectedPartId={survived} />,
    );
    expect(html).toContain('한소속');
  });

  // 분기/negative — 선택하지 않은 다른 파트를 삭제하면 선택이 보존된다(무관한 선택 초기화 0).
  // in-flight(deleting=true) 중복 삭제는 러너 가드로 미발사라 선택·nonce 전이가 0 이고, 선택 보존
  // 화면의 기존 파트 CRUD·그룹 섹션도 회귀 없이 렌더된다.
  it('다른 파트를 삭제하면 선택이 보존되고 in-flight 중복 삭제는 전이 0 이다 (분기 — 선택 보존/가드)', async () => {
    requestMock.mockResolvedValue(undefined);
    const { deps, state } = makeWiredDeps('pt1', 'pt2');
    await runDeletePart('pt2', deps);
    expect(state.selected).toBe('pt1');
    expect(state.nonce).toBe(1);
    const guarded = makeWiredDeps('pt1', 'pt1');
    await runDeletePart('pt1', { ...guarded.deps, deleting: true });
    expect(requestMock).toHaveBeenCalledTimes(1); // 가드로 추가 DELETE 미발사.
    expect(guarded.state.selected).toBe('pt1');
    expect(guarded.state.nonce).toBe(0);
    setRoutes({
      [PARTS]: { data: PART_ROWS, loading: false, error: undefined },
      [PT1_PERSONS]: { data: PT1_ROWS, loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(
      <AdminView initialSelectedPartId={state.selected} />,
    );
    expect(html).toContain('aria-label="추가할 파트 이름"');
    expect(html).toContain('aria-label="그룹 선택"');
    expect(html).toContain('한소속');
  });

  // negative(T-1156 reviewer MINOR (1)) — 파트 목록 row 의 id 가 누락돼도 <option> 이 fallback
  // key/value="" 로 안전 렌더되고(throw 0), 그 값이 선택돼도 빈 문자열이라 소속 인원 조회가
  // 발사되지 않는다(`/api/parts//persons` 같은 깨진 path 방지).
  it('id 누락 파트 row 도 안전 렌더되고 선택해도 조회를 발사하지 않는다 (negative — id 누락 fallback)', () => {
    setRoutes({
      [PARTS]: {
        data: [{ name: '아이디없는파트' }],
        loading: false,
        error: undefined,
      },
    });
    let html = '';
    expect(() => {
      html = renderToStaticMarkup(<AdminView initialSelectedPartId="" />);
    }).not.toThrow();
    // id 누락 row 는 value="" fallback 으로 렌더된다(미선택과 같은 빈 값 — 깨진 path 미생성).
    expect(html).toContain('<option value="" selected="">아이디없는파트</option>');
    const paths = useApiResourceMock.mock.calls.map((c) => c[0]);
    expect(
      paths.filter((p) => typeof p === 'string' && PART_PERSONS_RE.test(p)),
    ).toHaveLength(0);
  });
});
