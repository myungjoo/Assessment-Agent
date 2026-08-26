import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// R-112 — T-1723 (REQ-074, PLAN 131 행 ①) DashboardView ↔ DashboardPersonSelector 배선 검증.
// jsdom/@testing-library 미사용(ADR-0040 §5 게이트) — useApiResource 를 vi.mock 으로 치환해
// 인원 목록 조회의 data/loading/error 시나리오를 통제하고 renderToStaticMarkup 정적 마크업을
// 단언한다. 순수 파생 함수(derivePersonOptions)는 직접 호출해 분기/negative 를 커버한다.

import type { ApiResourceState } from '../api/useApiResource';

// useApiResource mock — path 별로 서로 다른 상태를 주입한다(조회 간 상태 오염 차단 검증).
const useApiResourceMock = vi.fn();
vi.mock('../api/useApiResource', () => ({
  useApiResource: (...args: unknown[]) => useApiResourceMock(...args),
}));

import DashboardView, { derivePersonOptions } from './DashboardView';

const IDLE: ApiResourceState<unknown> = {
  data: undefined,
  loading: false,
  error: undefined,
};

// 인원 목록 조회(/api/persons)에만 주입 상태를 반환하고, 나머지 조회는 idle 로 둔다 —
// 다른 조회의 loading/error 가 선택 컨트롤 단언을 오염시키지 않게 분리한다.
function setPersons(persons: ApiResourceState<unknown>) {
  useApiResourceMock.mockImplementation((path: string | null) => {
    if (typeof path === 'string' && path.startsWith('/api/persons')) {
      return persons;
    }
    return IDLE;
  });
}

// 선택 컨트롤의 사람-친화 라벨/문구 토큰 — 컴포넌트(T-1722)의 상수와 동일해야 배선이 성립한다.
const FIELD_LABEL = '평가 대상 인원';
const PLACEHOLDER_LABEL = '평가 대상을 선택하세요';
const EMPTY_PERSONS_TEXT = '선택 가능한 평가 대상 인원이 없습니다';
const LOADING_TEXT = '불러오는 중…';
const NO_PERSON_TOKEN = '평가 대상을 선택하면';
const FALLBACK_NAME = '이름 미상';

const PERSON_SAMPLE = [
  { id: 'p1', fullName: '김철수', email: 'chulsoo@example.com', active: true },
  { id: 'p2', fullName: '이영희', email: 'younghee@example.com', active: true },
];

describe('DashboardView — 인원 선택 컨트롤 배선 (T-1723, REQ-074)', () => {
  beforeEach(() => {
    useApiResourceMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-path — 미선택(무-prop) 마운트에서도 선택 컨트롤과 후보 옵션이 안내문과 함께 렌더된다.
  it('무-prop 마운트에서 선택 컨트롤과 후보 옵션을 안내문과 함께 렌더한다 (happy-path — 미선택 분기)', () => {
    setPersons({ data: PERSON_SAMPLE, loading: false, error: undefined });
    const html = renderToStaticMarkup(<DashboardView />);
    // 고정 endpoint 로 조건부 가드 없이 조회한다.
    expect(useApiResourceMock).toHaveBeenCalledWith('/api/persons');
    expect(html).toContain(FIELD_LABEL);
    expect(html).toContain(PLACEHOLDER_LABEL);
    expect(html).toContain('김철수');
    expect(html).toContain('이영희');
    // 안내문은 그대로 유지되고, 선택 컨트롤이 그보다 앞(자료 영역 위)에 온다.
    expect(html).toContain(NO_PERSON_TOKEN);
    expect(html.indexOf(FIELD_LABEL)).toBeLessThan(html.indexOf(NO_PERSON_TOKEN));
  });

  // happy-path — 정상(선택됨) 분기에도 같은 선택 컨트롤이 렌더돼 대상 변경 수단이 유지된다.
  it('personId 선택 분기에도 선택 컨트롤을 렌더한다 (happy-path — 정상 분기)', () => {
    setPersons({ data: PERSON_SAMPLE, loading: false, error: undefined });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    expect(html).toContain(FIELD_LABEL);
    expect(html).toContain('김철수');
    // 선택 분기이므로 미선택 안내문은 없다(자료 영역이 대신 렌더된다).
    expect(html).not.toContain(NO_PERSON_TOKEN);
  });

  // error path — 인원 조회 실패여도 선택 컨트롤을 삼키지 않고 에러 문구와 함께 렌더한다.
  it('인원 조회 실패 시 에러 문구와 선택 컨트롤을 함께 렌더한다 (error path)', () => {
    setPersons({
      data: PERSON_SAMPLE,
      loading: false,
      error: 'HTTP 500: persons boom',
    });
    const html = renderToStaticMarkup(<DashboardView />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('HTTP 500: persons boom');
    // 에러가 선택 수단을 없애면 REQ-074 위반 — 라벨/옵션이 그대로 살아 있어야 한다.
    expect(html).toContain(FIELD_LABEL);
    expect(html).toContain('김철수');
  });

  // branch — loading 중이면 컴포넌트의 loading 우선 정책대로 로딩 표면만 렌더된다.
  it('인원 조회 loading=true 면 로딩 표면을 우선 렌더한다 (branch — loading)', () => {
    setPersons({ data: undefined, loading: true, error: undefined });
    const html = renderToStaticMarkup(<DashboardView />);
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TEXT);
    // loading 우선 — 선택 라벨은 아직 미렌더.
    expect(html).not.toContain(FIELD_LABEL);
    // 미선택 안내문은 그대로 유지된다.
    expect(html).toContain(NO_PERSON_TOKEN);
  });

  // branch — 후보 0 명이면 빈 상태 문구가 렌더된다(<select> 미렌더).
  it('후보 0 명이면 빈 상태 문구를 렌더한다 (branch — empty)', () => {
    setPersons({ data: [], loading: false, error: undefined });
    const html = renderToStaticMarkup(<DashboardView />);
    expect(html).toContain(EMPTY_PERSONS_TEXT);
    expect(html).not.toContain(PLACEHOLDER_LABEL);
    expect(html).toContain(NO_PERSON_TOKEN);
  });

  // branch — prop 주입 하위 호환: 선택 state 초기값이 prop 이라 종전 조회 path 가 그대로다.
  it('personId prop 주입 시 종전 조회 path 를 그대로 사용한다 (branch — 하위 호환)', () => {
    setPersons({ data: PERSON_SAMPLE, loading: false, error: undefined });
    renderToStaticMarkup(<DashboardView personId="p1" period="2026-08" />);
    expect(useApiResourceMock).toHaveBeenCalledWith(
      '/api/assessments?personId=p1&period=2026-08',
    );
    expect(useApiResourceMock).toHaveBeenCalledWith(
      '/api/summaries?personId=p1&period=2026-08',
    );
  });

  // negative — 미선택이면 assessments/summaries 조회는 여전히 미수행(path=null 가드 유지).
  it('미선택이면 assessments/summaries 조회를 미수행한다 (negative — 조건부 조회 가드 유지)', () => {
    setPersons({ data: PERSON_SAMPLE, loading: false, error: undefined });
    renderToStaticMarkup(<DashboardView />);
    expect(useApiResourceMock).toHaveBeenCalledWith(null);
    const calledPaths = useApiResourceMock.mock.calls.map((call) => call[0]);
    const queried = calledPaths.some(
      (path) => typeof path === 'string' && path.startsWith('/api/assessments'),
    );
    expect(queried).toBe(false);
  });

  // negative — 미지의 personId 가 선택돼 있어도 throw 없이 placeholder 로 fallback 한다.
  it('후보에 없는 personId 가 선택돼 있어도 throw 없이 렌더한다 (negative — 미지의 선택값)', () => {
    setPersons({ data: PERSON_SAMPLE, loading: false, error: undefined });
    const html = renderToStaticMarkup(<DashboardView personId="unknown-person" />);
    expect(html).toContain(FIELD_LABEL);
    expect(html).toContain(PLACEHOLDER_LABEL);
    // 미지의 값이 옵션으로 새로 만들어지지는 않는다.
    expect(html).not.toContain('value="unknown-person"');
  });

  // negative — 조회 실패 + 미선택 동시 발생: 에러와 안내문이 함께 나오고 렌더가 깨지지 않는다.
  it('조회 실패와 미선택이 동시여도 에러·빈 상태·안내문을 함께 렌더한다 (negative — 동시 발생)', () => {
    setPersons({
      data: undefined,
      loading: false,
      error: 'HTTP 403: 권한 없음',
    });
    const html = renderToStaticMarkup(<DashboardView />);
    expect(html).toContain('HTTP 403: 권한 없음');
    expect(html).toContain(EMPTY_PERSONS_TEXT);
    expect(html).toContain(NO_PERSON_TOKEN);
  });

  // negative — 휴직(active=false) 인원은 컴포넌트가 후보에서 제외한다(필터 책임 위임 확인).
  it('active=false 인원만 있으면 후보 0 으로 빈 상태를 렌더한다 (negative — 휴직 인원 제외)', () => {
    setPersons({
      data: [{ id: 'p9', fullName: '휴직자', active: false }],
      loading: false,
      error: undefined,
    });
    const html = renderToStaticMarkup(<DashboardView />);
    expect(html).toContain(EMPTY_PERSONS_TEXT);
    expect(html).not.toContain('휴직자');
  });

  // negative — 이름 결손 row 도 후보에서 떨어지지 않고 대체 라벨로 선택 가능하다.
  it('이름 결손 row 를 대체 라벨로 렌더한다 (negative — fullName 결손)', () => {
    setPersons({
      data: [{ id: 'p7' }],
      loading: false,
      error: undefined,
    });
    const html = renderToStaticMarkup(<DashboardView />);
    expect(html).toContain(FIELD_LABEL);
    expect(html).toContain(FALLBACK_NAME);
    expect(html).toContain('value="p7"');
  });

  // negative — 응답이 배열이 아니어도(객체 등) throw 없이 빈 상태로 안전 렌더.
  it('응답이 배열이 아니어도 throw 없이 빈 상태를 렌더한다 (negative — 비배열 응답)', () => {
    setPersons({
      data: { items: PERSON_SAMPLE } as unknown as unknown[],
      loading: false,
      error: undefined,
    });
    const html = renderToStaticMarkup(<DashboardView />);
    expect(html).toContain(EMPTY_PERSONS_TEXT);
    expect(html).not.toContain('김철수');
  });
});

describe('DashboardView — derivePersonOptions 파생 (순수 함수)', () => {
  // happy-path — 정상 row 배열을 선택 옵션 배열로 순서 보존 매핑한다.
  it('정상 row 배열을 옵션 배열로 매핑한다 (happy-path)', () => {
    expect(derivePersonOptions(PERSON_SAMPLE)).toEqual([
      { id: 'p1', fullName: '김철수', email: 'chulsoo@example.com', active: true },
      { id: 'p2', fullName: '이영희', email: 'younghee@example.com', active: true },
    ]);
  });

  // branch — id 결손/비문자열/공백 row 는 제외한다(선택 불가능한 후보 차단).
  it('id 가 결손·비문자열·공백인 row 를 제외한다 (branch — id 결손)', () => {
    const rows = [
      { fullName: '이름만' },
      { id: 123, fullName: '숫자 id' },
      { id: '', fullName: '빈 id' },
      { id: '   ', fullName: '공백 id' },
      { id: null, fullName: 'null id' },
      { id: 'ok', fullName: '정상' },
    ];
    expect(derivePersonOptions(rows)).toEqual([{ id: 'ok', fullName: '정상' }]);
  });

  // branch — fullName 이 결손/빈 문자열/공백/비문자열이면 대체 라벨로 fallback 한다.
  it('fullName 결손 시 대체 라벨로 fallback 한다 (branch — fullName fallback)', () => {
    const rows = [
      { id: 'a' },
      { id: 'b', fullName: '' },
      { id: 'c', fullName: '   ' },
      { id: 'd', fullName: 42 },
    ];
    expect(derivePersonOptions(rows)).toEqual([
      { id: 'a', fullName: FALLBACK_NAME },
      { id: 'b', fullName: FALLBACK_NAME },
      { id: 'c', fullName: FALLBACK_NAME },
      { id: 'd', fullName: FALLBACK_NAME },
    ]);
  });

  // branch — 입력이 배열이 아니면 빈 배열을 반환한다(throw 0).
  it('입력이 배열이 아니면 빈 배열을 반환한다 (branch — 비배열 입력)', () => {
    expect(derivePersonOptions(undefined)).toEqual([]);
    expect(derivePersonOptions(null)).toEqual([]);
    expect(derivePersonOptions({ id: 'p1' })).toEqual([]);
    expect(derivePersonOptions('p1')).toEqual([]);
    expect(derivePersonOptions(0)).toEqual([]);
  });

  // negative — 빈 배열은 빈 배열 그대로(빈 상태 렌더의 입력).
  it('빈 배열이면 빈 배열을 반환한다 (negative — 빈 입력)', () => {
    expect(derivePersonOptions([])).toEqual([]);
  });

  // negative — 비객체 row(null/숫자/문자열/배열)는 throw 없이 제외한다.
  it('비객체 row 를 throw 없이 제외한다 (negative — 비객체 row)', () => {
    const rows = [null, 7, 'p1', undefined, [], { id: 'ok', fullName: '정상' }];
    expect(() => derivePersonOptions(rows)).not.toThrow();
    expect(derivePersonOptions(rows)).toEqual([{ id: 'ok', fullName: '정상' }]);
  });

  // negative — email/active 가 비정상 타입이면 전달하지 않는다(깨진 라벨·오필터 방지).
  it('email/active 가 비정상 타입이면 생략한다 (negative — 선택 필드 타입 방어)', () => {
    const rows = [
      { id: 'a', fullName: '가', email: '', active: 'true' },
      { id: 'b', fullName: '나', email: 12, active: null },
      { id: 'c', fullName: '다', email: '  ' },
    ];
    expect(derivePersonOptions(rows)).toEqual([
      { id: 'a', fullName: '가' },
      { id: 'b', fullName: '나' },
      { id: 'c', fullName: '다' },
    ]);
  });

  // negative — id 앞뒤 공백은 trim 되어 <option> value 로 안전하게 쓰인다.
  it('id 앞뒤 공백을 trim 해 반환한다 (negative — 공백 포함 id)', () => {
    expect(derivePersonOptions([{ id: '  p5  ', fullName: '공백' }])).toEqual([
      { id: 'p5', fullName: '공백' },
    ]);
  });

  // negative — 원본 입력 배열을 mutate 하지 않는다(부작용 0).
  it('원본 입력 배열을 mutate 하지 않는다 (negative — 부작용 0)', () => {
    const rows = [{ id: 'p1', fullName: '김철수' }];
    const snapshot = JSON.stringify(rows);
    derivePersonOptions(rows);
    expect(JSON.stringify(rows)).toBe(snapshot);
  });
});
