import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// R-112 — P6 composition wiring ④a AdminView 컨테이너(T-0385, ADR-0041 Decision 1·3·5)
// 검증. jsdom/@testing-library 미사용(ADR-0040 §5 게이트) — useApiResource 를 vi.mock 으로
// 치환해 data/loading/error 시나리오를 통제하고 react-dom/server renderToStaticMarkup 으로
// 정적 렌더 markup 을 단언한다. 선택 그룹 → 멤버 파생은 export 된 순수 helper(deriveMembers/
// findGroup)를 직접 호출해 검증한다. 파일명 .test.tsx 고정(root jest testRegex 충돌 회피).

import type { ApiResourceState } from '../api/useApiResource';

// useApiResource mock — 케이스별 반환 상태를 주입한다(AdminView 는 GET /api/groups 한 번만 호출).
const useApiResourceMock = vi.fn();
vi.mock('../api/useApiResource', () => ({
  useApiResource: (...args: unknown[]) => useApiResourceMock(...args),
}));

import AdminView, { findGroup, deriveMembers } from './AdminView';
import type { GroupRow } from './AdminView';

function setResource<T>(state: ApiResourceState<T>) {
  useApiResourceMock.mockReturnValue(state);
}

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
