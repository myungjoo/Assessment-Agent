import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// R-112 — T-1794 (REQ-075, PLAN 131 행 ② 표시 계약 정합) DashboardView → EvaluationDetailPanel
// narrative 배선 검증. T-1793 이 패널에 만든 하위 호환 optional 슬롯의 **유일 소비처**가 본
// 배선이라, 여기서 검증하지 않으면 backend 의 narrative 축이 어느 화면에도 도달하지 않는다.
// jsdom/@testing-library 미사용(ADR-0040 §5 게이트) — useApiResource 를 vi.mock 으로 치환해
// assessments/contributions 조회 상태를 통제하고 renderToStaticMarkup 정적 마크업을 단언한다.
// 선택 상호작용은 컨테이너의 initialSelectedId 주입 패턴으로 정적 재현한다(③a~③b-2 관례 승계).

import type { ApiResourceState } from '../api/useApiResource';

// useApiResource mock — path 별로 서로 다른 상태를 주입한다(조회 간 상태 오염 차단).
const useApiResourceMock = vi.fn();
vi.mock('../api/useApiResource', () => ({
  useApiResource: (...args: unknown[]) => useApiResourceMock(...args),
}));

import DashboardView from './DashboardView';

const IDLE: ApiResourceState<unknown> = { data: undefined, loading: false, error: undefined };

// EvaluationDetailPanel(T-1793) 이 서술 영역에 붙이는 접근성 라벨 — 배선이 성립하려면 컴포넌트
// 상수와 같아야 한다. 컴포넌트를 수정하지 않으므로(Out of Scope) 여기서는 값만 붙든다.
const NARRATIVE_MARK = 'aria-label="평가 정성 서술"';
// 미선택 시 상세 패널이 렌더하는 빈 안내 문구(컨테이너 DETAIL_EMPTY_LABEL) — 본 배선이 그
// 경로를 건드리지 않았음을 함께 고정한다.
const DETAIL_EMPTY_LABEL = '평가 결과를 선택하면 상세가 표시됩니다';
const LOADING_TEXT = '불러오는 중…';
const HAPPY_NARRATIVE = '분기 전반에 걸쳐 리뷰 품질이 안정적으로 개선되었다';

// backend `GET /api/assessments` 응답 형태의 raw 행. 매핑(assessmentRow.ts)은 본 task 의
// Out of Scope 라 여기서는 배선이 소비하는 narrative 축만 케이스별로 바꾼다.
function rawRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'a1',
    personId: 'p1',
    period: '2026-08',
    scope: 'team',
    periodStart: '2026-08-01T00:00:00.000Z',
    difficulty: 'high',
    contributionScore: 2.5,
    volume: 3,
    narrative: HAPPY_NARRATIVE,
    ...overrides,
  };
}

// assessments / contributions 두 조회에만 상태를 주입하고 나머지(persons·summaries·감사 기록
// 등)는 idle 로 둔다 — 다른 조회의 loading/error 가 서술 단언을 오염시키지 않게 한다. rows 를
// 주면 정상 응답으로 감싸고, assessments 를 직접 주면 loading/error 시나리오를 그대로 쓴다.
function render(opts: {
  rows?: unknown[];
  assessments?: ApiResourceState<unknown>;
  contributions?: ApiResourceState<unknown>;
  selectedId?: string;
  page?: number;
  pageSize?: number;
} = {}): string {
  const assessments: ApiResourceState<unknown> =
    opts.assessments ?? { data: opts.rows ?? [rawRow()], loading: false, error: undefined };
  useApiResourceMock.mockImplementation((path: string | null) => {
    if (typeof path !== 'string' || path === '') {
      return IDLE;
    }
    if (path.startsWith('/api/contributions')) {
      return opts.contributions ?? IDLE;
    }
    if (path.startsWith('/api/assessments')) {
      return assessments;
    }
    return IDLE;
  });
  return renderToStaticMarkup(
    <DashboardView
      personId="p1"
      initialSelectedId={opts.selectedId}
      initialPage={opts.page}
      initialPageSize={opts.pageSize}
    />,
  );
}

// 서술 영역 노드 개수 — 0 이면 미렌더, 1 이면 정확히 한 번 렌더(중복 렌더 방지 단언용).
function narrativeCount(html: string): number {
  return html.split(NARRATIVE_MARK).length - 1;
}

describe('DashboardView — 선택 row narrative 배선 (T-1794, REQ-075)', () => {
  beforeEach(() => {
    useApiResourceMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-path — narrative 가 있는 row 를 선택하면 상세 패널의 서술 영역에 그 문자열이 렌더된다.
  it('narrative 가 있는 row 를 선택하면 상세 패널에 그 서술이 렌더된다 (happy-path)', () => {
    const html = render({ selectedId: 'a1' });
    expect(narrativeCount(html)).toBe(1);
    expect(html).toContain(HAPPY_NARRATIVE);
  });

  // happy-path 보강 — metric 이 0 개(빈 목록 분기)여도 평가 전체 축인 서술은 함께 렌더된다.
  it('기여 metric 이 0 개여도 서술은 함께 렌더된다 (happy-path — 빈 목록 분기)', () => {
    const html = render({
      selectedId: 'a1',
      contributions: { data: [], loading: false, error: undefined },
    });
    expect(narrativeCount(html)).toBe(1);
    expect(html).toContain(DETAIL_EMPTY_LABEL);
  });

  // error path — contributions 조회 실패 시 패널이 error 분기로 early return 하므로 미렌더.
  it('contributions 조회 실패면 error 분기가 우선해 서술을 렌더하지 않는다 (error path)', () => {
    const html = render({
      selectedId: 'a1',
      contributions: { data: undefined, loading: false, error: 'HTTP 500: contributions boom' },
    });
    expect(html).toContain('HTTP 500: contributions boom');
    expect(narrativeCount(html)).toBe(0);
    expect(html).not.toContain(HAPPY_NARRATIVE);
  });

  // error path — assessments 조회 자체가 실패하면 visibleRows 가 비어 selectedRow 가 undefined
  // 라 서술이 렌더되지 않는다(선택 id 가 남아 있어도 마찬가지).
  it('assessments 조회 실패면 선택 id 가 남아 있어도 서술을 렌더하지 않는다 (error path)', () => {
    const html = render({
      selectedId: 'a1',
      assessments: { data: undefined, loading: false, error: 'HTTP 500: assessments boom' },
    });
    expect(html).toContain('HTTP 500: assessments boom');
    expect(narrativeCount(html)).toBe(0);
  });

  // 분기 (b) — 매퍼가 빈 문자열로 정규화한 narrative 는 슬롯 미렌더(하위 호환 계약).
  it('narrative 가 빈 문자열이면 서술 영역을 렌더하지 않는다 (분기 b)', () => {
    expect(narrativeCount(render({ rows: [rawRow({ narrative: '' })], selectedId: 'a1' }))).toBe(0);
  });

  // 분기 (c) — 미선택이면 undefined 가 전달돼 미렌더 + 빈 안내 경로가 종전 그대로 유지된다.
  it('미선택이면 서술 미렌더 + 빈 안내 경로가 유지된다 (분기 c — 미선택)', () => {
    const html = render({});
    expect(narrativeCount(html)).toBe(0);
    expect(html).toContain(DETAIL_EMPTY_LABEL);
    // 미선택이면 contributions 조회도 미수행(종전 조건부 가드 유지).
    expect(useApiResourceMock).toHaveBeenCalledWith(null);
  });

  // 분기 (c) — 존재하지 않는 id 를 가리키면 selectedRow 가 undefined 라 미렌더(throw 0).
  it('존재하지 않는 id 를 선택하면 throw 없이 서술을 렌더하지 않는다 (분기 c — 미발견)', () => {
    const run = () => render({ selectedId: 'does-not-exist' });
    expect(run).not.toThrow();
    expect(narrativeCount(run())).toBe(0);
  });

  // 분기 (d) — contributions loading 중이면 패널의 loading 우선 정책이 서술보다 앞선다.
  it('contributions loading 중이면 loading 분기가 우선해 서술을 렌더하지 않는다 (분기 d)', () => {
    const html = render({
      selectedId: 'a1',
      contributions: { data: undefined, loading: true, error: undefined },
    });
    expect(html).toContain(LOADING_TEXT);
    expect(narrativeCount(html)).toBe(0);
  });

  // negative ① — 응답 row 에 narrative 필드가 아예 없어도 매퍼가 '' 로 흡수해 미렌더(throw 0).
  it('narrative 필드가 응답에 없어도 throw 없이 미렌더한다 (negative ①)', () => {
    const row = rawRow();
    delete row.narrative;
    const run = () => render({ rows: [row], selectedId: 'a1' });
    expect(run).not.toThrow();
    expect(narrativeCount(run())).toBe(0);
  });

  // negative ② — narrative 가 문자열이 아닌 타입(숫자·객체·null·배열·boolean)으로 도착해도
  // 매퍼가 '' 로 정규화하므로 raw 값이 마크업에 새지 않고 미렌더한다.
  it.each([
    ['숫자', 42],
    ['객체', { text: '비정상' }],
    ['null', null],
    ['배열', ['비정상']],
    ['boolean', true],
  ])('narrative 가 %s 타입이면 raw 값 누출 없이 미렌더한다 (negative ②)', (_label, value) => {
    const html = render({ rows: [rawRow({ narrative: value })], selectedId: 'a1' });
    expect(narrativeCount(html)).toBe(0);
    expect(html).not.toContain('비정상');
    expect(html).not.toContain('[object Object]');
  });

  // negative ③ — 공백만 있는 문자열은 length > 0 이라 슬롯 계약상 그대로 렌더된다(표시 계층이
  // 값을 위장하지 않는다 — T-1793 hasNarrative 주석). 배선이 임의 trim/삼킴을 하지 않음을 고정.
  it('공백만 있는 narrative 도 삼키지 않고 서술 영역을 렌더한다 (negative ③)', () => {
    expect(narrativeCount(render({ rows: [rawRow({ narrative: '   ' })], selectedId: 'a1' }))).toBe(1);
  });

  // negative ④ — 선택 id 가 현재 페이지 밖 row 를 가리켜도 selectedRow 는 visibleRows 기준이라
  // 상세 패널이 깨지지 않고 그 row 의 서술을 그대로 렌더한다(페이지 slice 와 무관).
  it('선택 id 가 현재 페이지 밖 row 여도 throw 없이 그 서술을 렌더한다 (negative ④)', () => {
    const rows = [
      rawRow({ id: 'a1', contributionScore: 3, narrative: '1 페이지 서술' }),
      rawRow({ id: 'a2', contributionScore: 1, narrative: '2 페이지 서술' }),
    ];
    const run = () => render({ rows, selectedId: 'a2', page: 1, pageSize: 1 });
    expect(run).not.toThrow();
    const html = run();
    expect(narrativeCount(html)).toBe(1);
    expect(html).toContain('2 페이지 서술');
    expect(html).not.toContain('1 페이지 서술');
  });

  // negative ⑤ — 선택을 다른 row 로 바꾸면 표시되는 서술도 그 row 의 것으로 교체된다
  // (stale 표시 금지 — 배선이 특정 row 를 캐시하거나 첫 row 로 고정하면 fail).
  it('선택 row 를 바꾸면 표시 서술도 그 row 의 것으로 교체된다 (negative ⑤ — stale 금지)', () => {
    const rows = [
      rawRow({ id: 'a1', contributionScore: 3, narrative: '첫 번째 평가 서술' }),
      rawRow({ id: 'a2', contributionScore: 1, narrative: '두 번째 평가 서술' }),
    ];
    const first = render({ rows, selectedId: 'a1' });
    expect(first).toContain('첫 번째 평가 서술');
    expect(first).not.toContain('두 번째 평가 서술');
    const second = render({ rows, selectedId: 'a2' });
    expect(second).toContain('두 번째 평가 서술');
    expect(second).not.toContain('첫 번째 평가 서술');
    expect(narrativeCount(second)).toBe(1);
  });
});
