import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// R-112 — T-1799 (REQ-077, PLAN 131 행 ④) 조회 path 가 prop 이 아니라 컨테이너 기간 state 를
// 소비하는지 검증한다. jsdom/@testing-library 미사용(ADR-0040 §5 게이트, T-1723·T-1735 전용 spec
// 관례 승계) — useApiResource 를 vi.mock 으로 치환해 발사된 path 를 직접 단언하고, 사용자가 이미
// 기간을 고른 상태는 initial* 주입(initialEvaluationPeriod)으로 재현한다. 순수 파생은 직접 호출로,
// 선택 → state 갱신 한 겹은 source 정적 대조 guard 로 cover 한다.

import type { ApiResourceState } from '../api/useApiResource';

// useApiResource mock — path 별로 서로 다른 상태를 주입한다(조회 간 상태 오염 차단).
const useApiResourceMock = vi.fn();
vi.mock('../api/useApiResource', () => ({
  useApiResource: (...args: unknown[]) => useApiResourceMock(...args),
}));

// 제출 모듈 mock — 본 spec 은 조회 축만 본다(실 POST 0).
const submitMock = vi.fn();
vi.mock('../api/periodEvaluationSubmit', () => ({
  submitPeriodEvaluation: (...args: unknown[]) => submitMock(...args),
}));

import DashboardView, { deriveQueryPeriod } from './DashboardView';

const IDLE: ApiResourceState<unknown> = {
  data: undefined,
  loading: false,
  error: undefined,
};

const PERSON_SAMPLE = [
  { id: 'p1', fullName: '김철수', email: 'chulsoo@example.com', active: true },
];

// 기간 컨트롤(T-1733) 라벨 토큰 — 컨트롤이 화면에 남아 있는지 확인용.
const PERIOD_FIELD_LABEL = '평가 기간 종류';
const PERIOD_PLACEHOLDER_LABEL = '기간을 선택하세요';

// 인원 목록(/api/persons) 조회에만 주입 상태를 반환하고 나머지는 idle 로 둔다.
function setPersons(persons: ApiResourceState<unknown>) {
  useApiResourceMock.mockImplementation((path: string | null) => {
    if (typeof path === 'string' && path.startsWith('/api/persons')) {
      return persons;
    }
    return IDLE;
  });
}

// assessments/summaries 조회에 error 주입(상류 실패 재현 — 네트워크 거부/비-200).
function setQueryFailure(message: string) {
  useApiResourceMock.mockImplementation((path: string | null) => {
    if (typeof path === 'string' && path.startsWith('/api/persons')) {
      return { data: PERSON_SAMPLE, loading: false, error: undefined };
    }
    if (
      typeof path === 'string' &&
      (path.startsWith('/api/assessments') || path.startsWith('/api/summaries'))
    ) {
      return { data: undefined, loading: false, error: message };
    }
    return IDLE;
  });
}

// 이번 렌더에서 실제로 발사된 조회 path 문자열 목록(null 가드는 제외).
function firedPaths(): string[] {
  return useApiResourceMock.mock.calls
    .map((call) => call[0])
    .filter((path): path is string => typeof path === 'string');
}

// 발사된 path 중 assessments/summaries 조회만 추린다(인원 목록 등 다른 조회 제외).
function queriedPaths(): string[] {
  return firedPaths().filter(
    (path) => path.startsWith('/api/assessments') || path.startsWith('/api/summaries'),
  );
}

// 두 조회(assessments·summaries)가 같은 query 로 발사됐는지 한 번에 단언한다.
function expectQueried(query: string) {
  expect(useApiResourceMock).toHaveBeenCalledWith(`/api/assessments?${query}`);
  expect(useApiResourceMock).toHaveBeenCalledWith(`/api/summaries?${query}`);
}

describe('DashboardView — 조회 기간 배선 (T-1799, REQ-077)', () => {
  beforeEach(() => {
    useApiResourceMock.mockReset();
    submitMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // AC 4 — period prop 주입 0(기간 축 무-prop) 상태에서 화면 안 선택만으로 period= 가 실린다.
  it('기간을 주간으로 고르면 두 조회 path 에 period=week 를 싣는다 (happy-path)', () => {
    setPersons({ data: PERSON_SAMPLE, loading: false, error: undefined });
    const view = <DashboardView personId="p1" initialEvaluationPeriod="week" />;
    const html = renderToStaticMarkup(view);
    expectQueried('personId=p1&period=week');
    // 선택 컨트롤이 같은 값을 표시한다 — 조회 필터와 화면 선택이 같은 source 임을 보인다.
    expect(html).toContain(PERIOD_FIELD_LABEL);
    expect(html).toContain('name="period"');
    expect(html).toMatch(/<option[^>]*value="week"[^>]*selected/);
  });

  // AC 5 — 조회가 실패해도 배선이 throw 하지 않고 기간 선택 컨트롤이 화면에 남는다.
  it('조회가 실패해도 throw 없이 기간 컨트롤이 남는다 (error path)', () => {
    setQueryFailure('HTTP 500: assessments boom');
    const view = <DashboardView personId="p1" initialEvaluationPeriod="week" />;
    const render = () => renderToStaticMarkup(view);
    expect(render).not.toThrow();
    const html = render();
    expect(html).toContain('HTTP 500: assessments boom');
    // 실패가 기간 선택 수단을 삼키면 REQ-077 위반 — 라벨/placeholder 가 살아 있어야 한다.
    expect(html).toContain(PERIOD_FIELD_LABEL);
    expect(html).toContain(PERIOD_PLACEHOLDER_LABEL);
    // 실패해도 조회 path 자체는 선택 기간을 그대로 반영한다(다음 재조회가 같은 기간).
    expectQueried('personId=p1&period=week');
  });

  // 분기 (가) — 기간 미선택 + prop 없음 → period= 미포함(종전 조건부 가드 유지).
  it('기간 미선택 + prop 없음이면 period= 를 싣지 않는다 (분기 가)', () => {
    setPersons({ data: PERSON_SAMPLE, loading: false, error: undefined });
    renderToStaticMarkup(<DashboardView personId="p1" />);
    expectQueried('personId=p1');
    expect(firedPaths().some((path) => path.includes('period='))).toBe(false);
  });

  // 분기 (나) — 기간 미선택 + prop 주입 → prop 값이 실린다(하위 호환, 기존 spec 계약 보존).
  it('기간 미선택 + period prop 주입이면 prop 값이 실린다 (분기 나 — 하위 호환)', () => {
    setPersons({ data: PERSON_SAMPLE, loading: false, error: undefined });
    renderToStaticMarkup(<DashboardView personId="p1" period="2026-08" />);
    expectQueried('personId=p1&period=2026-08');
  });

  // 분기 (다) — 선택 state 와 prop 이 동시에 있으면 state 가 이긴다(화면 선택이 권위).
  it('기간 선택 + prop 동시면 state 가 이긴다 (분기 다)', () => {
    setPersons({ data: PERSON_SAMPLE, loading: false, error: undefined });
    const view = <DashboardView personId="p1" period="2026-08" initialEvaluationPeriod="month" />;
    renderToStaticMarkup(view);
    expectQueried('personId=p1&period=month');
    expect(firedPaths().some((path) => path.includes('period=2026-08'))).toBe(false);
  });

  // 분기 (라) — personId 미선택이면 기간이 선택돼 있어도 조회 자체가 없다(path=null 가드).
  it('personId 미선택이면 기간이 선택돼도 조회를 발사하지 않는다 (분기 라)', () => {
    setPersons({ data: PERSON_SAMPLE, loading: false, error: undefined });
    renderToStaticMarkup(<DashboardView initialEvaluationPeriod="week" />);
    expect(useApiResourceMock).toHaveBeenCalledWith(null);
    expect(queriedPaths()).toHaveLength(0);
  });

  // negative ① — placeholder(빈 값)로 되돌리면 period= 가 다시 빠진다.
  it('기간을 placeholder(빈 값)로 되돌리면 period= 가 다시 빠진다 (negative ①)', () => {
    setPersons({ data: PERSON_SAMPLE, loading: false, error: undefined });
    renderToStaticMarkup(<DashboardView personId="p1" initialEvaluationPeriod="week" />);
    expectQueried('personId=p1&period=week');
    // 되돌린 뒤의 렌더 — 같은 컨테이너가 빈 선택 상태로 다시 파생한다.
    useApiResourceMock.mockReset();
    setPersons({ data: PERSON_SAMPLE, loading: false, error: undefined });
    renderToStaticMarkup(<DashboardView personId="p1" initialEvaluationPeriod="" />);
    expectQueried('personId=p1');
    expect(firedPaths().some((path) => path.includes('period='))).toBe(false);
  });

  // negative ② — periodStart 는 GET 계약(api.md 97 행)에 없어 어떤 조회 path 에도 안 실린다.
  it('어떤 조회 path 에도 periodStart 를 싣지 않는다 (negative ② — 계약 밖 param)', () => {
    setPersons({ data: PERSON_SAMPLE, loading: false, error: undefined });
    const view = <DashboardView personId="p1" period="2026-08" initialEvaluationPeriod="week" />;
    renderToStaticMarkup(view);
    expect(firedPaths().length).toBeGreaterThan(0);
    expect(firedPaths().some((path) => path.includes('periodStart'))).toBe(false);
    // 조회 query 는 personId·period 2 키만 쓴다(정의 외 키 유출 0).
    for (const path of queriedPaths()) {
      const keys = [...new URLSearchParams(path.split('?')[1]).keys()].sort();
      expect(keys).toEqual(['period', 'personId']);
    }
  });

  // negative ③ — 비-공허 확인: 배선을 prop 소비로 되돌리면 아래 단언이 곧바로 fail 한다.
  // (period prop 이 없는 렌더라 prop 만 소비하는 구현은 period= 없는 path 를 발사한다.)
  it('기간 축 무-prop 렌더의 fire 된 path 를 직접 단언한다 (negative ③ — 비-공허)', () => {
    setPersons({ data: PERSON_SAMPLE, loading: false, error: undefined });
    renderToStaticMarkup(<DashboardView personId="p1" initialEvaluationPeriod="day" />);
    const queried = queriedPaths();
    expect(queried).toContain('/api/assessments?personId=p1&period=day');
    expect(queried).toContain('/api/summaries?personId=p1&period=day');
    expect(queried.every((path) => path.includes('period=day'))).toBe(true);
  });

  // happy — state 가 있으면(prop 유무 무관) state 를 그대로 돌려준다.
  it('state 가 있으면 state 를 돌려준다', () => {
    expect(deriveQueryPeriod('week', undefined)).toBe('week');
    expect(deriveQueryPeriod('week', '2026-08')).toBe('week');
  });

  // 분기 — state 가 비면 prop 으로 fallback, prop 도 없으면 undefined(조회 query 미포함).
  it('state 가 비면 prop 으로 fallback 한다', () => {
    expect(deriveQueryPeriod('', '2026-08')).toBe('2026-08');
    expect(deriveQueryPeriod('', undefined)).toBeUndefined();
    expect(deriveQueryPeriod(undefined, undefined)).toBeUndefined();
  });

  // negative — 공백뿐/비-문자열 state 는 미선택으로 흡수한다(period=%20 등 무의미 query 차단,
  // throw 0). 방어적 흡수라 타입 밖 입력도 계약대로 fallback 한다.
  it('공백뿐·비-문자열 state 는 throw 없이 미선택으로 흡수한다', () => {
    const derive = deriveQueryPeriod as unknown as (
      state: unknown,
      prop: unknown,
    ) => string | undefined;
    expect(deriveQueryPeriod('   ', '2026-08')).toBe('2026-08');
    expect(deriveQueryPeriod('   ', undefined)).toBeUndefined();
    expect(() => derive(null, '2026-08')).not.toThrow();
    expect(derive(null, '2026-08')).toBe('2026-08');
    expect(derive(7, undefined)).toBeUndefined();
    expect(derive({}, 'day')).toBe('day');
  });
});

// source 정적 대조 guard — 사슬 중 "select 의 onChange 가 같은 state 를 갱신한다" 한 겹은 jsdom
// 부재로 실행 경로가 안 걸린다. 같은 파일군 관례(T-1737 closure)를 승계해 지워지면 CI red 가 된다.
describe('DashboardView — 기간 조회 배선 source guard (T-1799)', () => {
  // 주석 안의 동일 문자열이 대조를 통과시키지 않도록 라인 주석을 제거한 소스로 본다.
  const SOURCE = readFileSync(new URL('./DashboardView.tsx', import.meta.url), 'utf-8')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
    .join('\n');

  // AC 1 — 두 조회 path 파생이 prop 이 아니라 파생값(queryPeriod)을 소비한다.
  it('두 조회 path 파생이 queryPeriod 를 소비한다', () => {
    expect(SOURCE).toContain('buildAssessmentsPath(selectedPersonId, queryPeriod)');
    expect(SOURCE).toContain('buildSummariesPath(selectedPersonId, queryPeriod)');
    expect(SOURCE).not.toContain('buildAssessmentsPath(selectedPersonId, period)');
    expect(SOURCE).not.toContain('buildSummariesPath(selectedPersonId, period)');
  });

  // AC 1 — 파생은 state 우선 · prop fallback 규칙 1 곳에서만 만들어진다(이중 정의 금지).
  it('queryPeriod 파생이 deriveQueryPeriod 1 곳에서만 만들어진다', () => {
    expect(SOURCE).toContain('const queryPeriod = deriveQueryPeriod(evaluationPeriod, period);');
    expect(SOURCE.match(/const queryPeriod = /g)).toHaveLength(1);
  });

  // 사슬의 나머지 한 겹 — 컨트롤의 선택 콜백이 조회가 소비하는 그 state 를 갱신한다.
  it('기간 컨트롤이 조회와 같은 state 를 표시·갱신한다', () => {
    expect(SOURCE).toContain('period={evaluationPeriod}');
    expect(SOURCE).toContain('onChangePeriod={setEvaluationPeriod}');
  });

  // 범위 게이트 — periodStart 는 조회 path 파생에 전혀 등장하지 않는다(계약 밖 param 차단).
  it('조회 path 파생이 periodStart 를 소비하지 않는다', () => {
    expect(SOURCE).not.toMatch(/build(Assessments|Summaries)Path\([^)]*PeriodStart/);
  });
});
