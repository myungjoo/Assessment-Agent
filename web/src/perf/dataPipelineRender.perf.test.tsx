import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AssessmentResultTable from '../components/AssessmentResultTable';
import { deriveAssessmentDisplayRows, type AssessmentDisplayRow } from '../api/assessmentRow';
import {
  filterAssessmentRows, sortAssessmentRows, type AssessmentRowSortKey,
} from '../api/assessmentRowOps';
import { pageRows } from '../views/DashboardView';
import {
  REQ048_RENDER_MAX_MS, assertRenderThreshold, measureRenderLatency,
} from './renderLatency';

// REQ-048 시각화 축 ④ 의 세 번째 소비처 (T-1996). 덮는 구간 — backend 응답 **원문**
// (`unknown[]`) → `deriveAssessmentDisplayRows` 매핑 → `filterAssessmentRows` 검색 필터 →
// `sortAssessmentRows` 정렬 → `pageRows` 페이지 slice → `AssessmentResultTable` 표 markup.
// 조합 순서는 DashboardView 632~639 · 669~673 행의 production 배선과 같다. T-1993 은 셸
// markup 만, T-1995 는 이미 매핑이 끝난 행 배열부터 재서 이 준비 구간이 통째로 계측 밖에
// 있었다. 본 파일은 그 구간을 REQ-047 규모(200 건 응답 원문)로 잰다.
//
// 측정 한계 — 여전히 in-process 준비 구간만 재며 브라우저 layout · paint · 실제 네트워크
// 왕복은 포함하지 않는다(T-1995 와 같은 취지). 따라서 축 완결이 아니라 구간 확장이다.
// helper 계약(renderLatency.ts) 과 측정 대상 production 모듈은 수정하지 않고 소비만 하며,
// 파일명은 root jest testRegex 충돌 회피로 .perf.test.tsx 를 유지한다(T-1993 선례).

// 반복 측정 회차 — 표본 수 단언 대상이자 1 회성 편차 완화용(T-1993 · T-1995 와 동일 값).
const ITERATIONS = 5;
// REQ-047 규모 상한 — requirements 66 행 인원 100~200 명 중 상한을 응답 건수로 쓴다.
const REQ047_MAX_PEOPLE = 200;
// 대시보드 페이지 폭 — slice 가 실제로 동작함을 보이려고 전체 건수보다 작게 잡는다.
const PAGE_SIZE = 50;
// 표 컬럼 수 — AssessmentResultTable 의 ASSESSMENT_TABLE_COLUMNS 6 개.
const COLUMN_COUNT = 6;

/** markup 안의 토큰 출현 횟수 — "0ms 로 통과하는 빈 렌더" 배제용 규모 검증 수단. */
function countOf(markup: string, token: string): number {
  return markup.split(token).length - 1;
}

/**
 * REQ-047 규모 응답 원문 표본(`unknown[]` — backend JSON 도착 형태 그대로). contributionScore
 * 는 Prisma Decimal 의 문자열 표현이라 매핑의 문자열 수치 경로(parseNumericField)를 태운다.
 */
function makePayload(count: number): unknown[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `assessment-${index}`,
    personId: `person-${index % 40}`,
    period: index % 2 === 0 ? '2026-Q1' : '2026-Q2',
    scope: index % 3 === 0 ? 'team' : 'individual',
    periodStart: `2026-0${(index % 9) + 1}-01T00:00:00.000Z`,
    difficulty: ['EASY', 'MEDIUM', 'HARD'][index % 3],
    contributionScore: `${index % 20}.5`,
    volume: 10 + (index % 9),
    narrative: `기여 서술 ${index}`,
  }));
}

interface PipelineOptions {
  searchTerm?: string;
  sortKey?: AssessmentRowSortKey;
  sortDirection?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
  loading?: boolean;
}

interface PipelineResult {
  mapped: AssessmentDisplayRow[];
  visible: AssessmentDisplayRow[];
  paged: AssessmentDisplayRow[];
  markup: string;
}

/** 표시 파이프라인 전 구간 1 회 — 측정 thunk 가 통째로 감싸는 단위다. */
function runPipeline(payload: unknown, opts: PipelineOptions = {}): PipelineResult {
  const sortKey = opts.sortKey ?? 'contributionScore';
  const sortDirection = opts.sortDirection ?? 'asc';
  const mapped = deriveAssessmentDisplayRows(payload);
  const visible = sortAssessmentRows(
    filterAssessmentRows(mapped, opts.searchTerm ?? ''), sortKey, sortDirection,
  );
  const paged = pageRows(visible, opts.page ?? 1, opts.pageSize ?? PAGE_SIZE);
  const markup = renderToStaticMarkup(
    <AssessmentResultTable
      rows={paged} sortKey={sortKey} sortDirection={sortDirection} loading={opts.loading}
    />,
  );
  return { mapped, visible, paged, markup };
}

/** 파이프라인을 ITERATIONS 회 측정하고 마지막 회차 결과를 함께 돌려준다. */
function measurePipeline(payload: unknown, opts: PipelineOptions = {}) {
  let last: PipelineResult | null = null;
  const summary = measureRenderLatency(() => {
    last = runPipeline(payload, opts);
  }, ITERATIONS);
  return { summary, result: last as unknown as PipelineResult };
}

describe('표시 파이프라인 렌더 latency (REQ-048 축 ④ · REQ-047 규모 응답 원문)', () => {
  it(`응답 원문 ${REQ047_MAX_PEOPLE} 건의 전 구간 p95 가 ${REQ048_RENDER_MAX_MS}ms 이내다`, () => {
    const { summary, result } = measurePipeline(makePayload(REQ047_MAX_PEOPLE));
    // 빈 렌더 위장 배제 — 매핑 결과 · 페이지 slice · markup 규모를 모두 센다.
    expect(result.mapped).toHaveLength(REQ047_MAX_PEOPLE);
    expect(result.paged).toHaveLength(PAGE_SIZE);
    expect(result.markup).not.toBe('');
    expect(countOf(result.markup, '<tr>')).toBe(PAGE_SIZE + 1);
    expect(countOf(result.markup, '<td>')).toBe(PAGE_SIZE * COLUMN_COUNT);
    expect(summary.samples).toBe(ITERATIONS);
    const verdict = assertRenderThreshold(summary);
    expect(verdict.reason).toBe('');
    expect(verdict.pass).toBe(true);
  });

  it('단계 귀속 ① 매핑 단계(deriveAssessmentDisplayRows) 만도 임계 안이다', () => {
    const payload = makePayload(REQ047_MAX_PEOPLE);
    let mapped: AssessmentDisplayRow[] = [];
    const summary = measureRenderLatency(() => {
      mapped = deriveAssessmentDisplayRows(payload);
    }, ITERATIONS);
    expect(mapped).toHaveLength(REQ047_MAX_PEOPLE);
    // 문자열 Decimal 이 수치로 매핑됐는지 — 매핑이 껍데기로 돌지 않았음을 확인.
    expect(typeof mapped[0].contributionScore).toBe('number');
    expect(summary.samples).toBe(ITERATIONS);
    expect(assertRenderThreshold(summary).pass).toBe(true);
  });

  it('단계 귀속 ② 필터+정렬 단계만도 임계 안이다', () => {
    const mapped = deriveAssessmentDisplayRows(makePayload(REQ047_MAX_PEOPLE));
    let visible: AssessmentDisplayRow[] = [];
    const summary = measureRenderLatency(() => {
      visible = sortAssessmentRows(filterAssessmentRows(mapped, 'q1'), 'contributionScore', 'asc');
    }, ITERATIONS);
    // 'q1' 은 period 축에만 걸려 짝수 index 절반이 남는다.
    expect(visible).toHaveLength(REQ047_MAX_PEOPLE / 2);
    expect(summary.samples).toBe(ITERATIONS);
    expect(assertRenderThreshold(summary).pass).toBe(true);
  });

  it('단계 귀속 ③ 표 렌더 단계만도 임계 안이다', () => {
    const paged = pageRows(
      deriveAssessmentDisplayRows(makePayload(REQ047_MAX_PEOPLE)), 1, PAGE_SIZE,
    );
    let markup = '';
    const summary = measureRenderLatency(() => {
      markup = renderToStaticMarkup(<AssessmentResultTable rows={paged} />);
    }, ITERATIONS);
    expect(countOf(markup, '<tr>')).toBe(PAGE_SIZE + 1);
    expect(summary.samples).toBe(ITERATIONS);
    expect(assertRenderThreshold(summary).pass).toBe(true);
  });

  it('분기 (a) 검색어 없음 대 있음 — 행 수가 줄고 두 경우 모두 임계 안이다', () => {
    const payload = makePayload(REQ047_MAX_PEOPLE);
    const all = measurePipeline(payload, { searchTerm: '' });
    const filtered = measurePipeline(payload, { searchTerm: 'q1' });
    expect(all.result.visible).toHaveLength(REQ047_MAX_PEOPLE);
    expect(filtered.result.visible).toHaveLength(REQ047_MAX_PEOPLE / 2);
    expect(filtered.result.visible.length).toBeLessThan(all.result.visible.length);
    // 검색으로 걸러진 뒤에도 표는 비지 않는다(페이지 폭만큼 렌더).
    expect(countOf(filtered.result.markup, '<tr>')).toBe(PAGE_SIZE + 1);
    expect(assertRenderThreshold(all.summary).pass).toBe(true);
    expect(assertRenderThreshold(filtered.summary).pass).toBe(true);
  });

  it('분기 (b) 정렬 asc 대 desc — 첫 행이 뒤집히고 두 경우 모두 임계 안이다', () => {
    const payload = makePayload(REQ047_MAX_PEOPLE);
    const asc = measurePipeline(payload, { sortDirection: 'asc' });
    const desc = measurePipeline(payload, { sortDirection: 'desc' });
    const ascFirst = asc.result.paged[0].contributionScore as number;
    const descFirst = desc.result.paged[0].contributionScore as number;
    expect(ascFirst).toBe(0.5);
    expect(descFirst).toBe(19.5);
    expect(assertRenderThreshold(asc.summary).pass).toBe(true);
    expect(assertRenderThreshold(desc.summary).pass).toBe(true);
  });

  it('분기 (c) 숫자 축 null 행은 정렬 방향과 무관하게 마지막이다', () => {
    const payload: unknown[] = makePayload(4).map((entry, index) =>
      index < 2 ? { ...(entry as object), contributionScore: null } : entry,
    );
    for (const sortDirection of ['asc', 'desc'] as const) {
      const { summary, result } = measurePipeline(payload, { sortDirection });
      const scores = result.paged.map((row) => row.contributionScore);
      expect(scores.slice(0, 2), sortDirection).not.toContain(null);
      expect(scores.slice(2), sortDirection).toEqual([null, null]);
      expect(assertRenderThreshold(summary).pass, sortDirection).toBe(true);
    }
  });

  it('분기 (d) loading:true 는 행을 표시하지 않고도 측정이 성립한다', () => {
    const { summary, result } = measurePipeline(makePayload(REQ047_MAX_PEOPLE), { loading: true });
    // loading 우선 정책 — 파이프라인은 다 돌지만 표 본문은 렌더되지 않는다.
    expect(result.visible).toHaveLength(REQ047_MAX_PEOPLE);
    expect(result.markup).toContain('불러오는 중');
    expect(countOf(result.markup, '<tr>')).toBe(0);
    expect(summary.samples).toBe(ITERATIONS);
    expect(assertRenderThreshold(summary).pass).toBe(true);
  });

  it('negative (a) 비배열 payload 는 빈 표로 흡수되고 측정이 throw 하지 않는다', () => {
    const cases: { name: string; payload: unknown }[] = [
      { name: 'null', payload: null }, { name: 'undefined', payload: undefined },
      { name: 'object', payload: { rows: [] } }, { name: 'string', payload: '[]' },
    ];
    for (const testCase of cases) {
      const { summary, result } = measurePipeline(testCase.payload);
      expect(result.mapped, testCase.name).toHaveLength(0);
      expect(result.markup, testCase.name).toContain('표시할 평가 결과가 없습니다');
      expect(countOf(result.markup, '<tr>'), testCase.name).toBe(0);
      expect(assertRenderThreshold(summary).pass, testCase.name).toBe(true);
    }
  });

  it('negative (b) 결손·타입 위반 원소가 섞여도 유효 행만 정확히 남는다', () => {
    const payload: unknown[] = [
      ...makePayload(3),
      // 매핑 불가 6 건 — 비객체 · 배열 · 원시값 · id 결손 · 빈 id.
      null, undefined, ['not', 'an', 'object'], 'raw-string', 42, { personId: 'p-x' }, { id: '' },
      { id: 'partial-1' }, // id 만 있는 부분 결손 → 행 자체는 살린다.
    ];
    const { summary, result } = measurePipeline(payload);
    // 유효 3 건 + 부분 결손 1 건 = 4 건만 남고 나머지 7 건은 매핑 불가로 제외된다.
    expect(result.mapped).toHaveLength(4);
    expect(result.mapped.map((row) => row.id)).toContain('partial-1');
    expect(countOf(result.markup, '<tr>')).toBe(5);
    expect(assertRenderThreshold(summary).pass).toBe(true);
  });

  it('negative (c) NaN·Infinity·null 숫자 축이 표에 문자열로 새지 않는다', () => {
    const payload: unknown[] = [
      { id: 'n-0', period: '2026-Q1', contributionScore: Number.NaN, volume: 3 },
      { id: 'n-1', period: '2026-Q1', contributionScore: Number.POSITIVE_INFINITY },
      { id: 'n-2', period: '2026-Q1', contributionScore: null, volume: null },
      { id: 'n-3', period: '2026-Q1', contributionScore: '   ', volume: 'abc' },
    ];
    const { summary, result } = measurePipeline(payload);
    expect(result.mapped).toHaveLength(4);
    expect(result.mapped.every((row) => row.contributionScore === null)).toBe(true);
    expect(result.markup).not.toContain('NaN');
    expect(result.markup).not.toContain('Infinity');
    expect(result.markup).not.toContain('undefined');
    expect(result.markup).not.toContain('>null<');
    // 값 없음 셀은 '—' 로 흡수된다(비어 있는 셀로 위장하지 않는다).
    expect(countOf(result.markup, '—')).toBeGreaterThan(0);
    expect(assertRenderThreshold(summary).pass).toBe(true);
  });

  it('negative (d) 미지원 정렬 키가 들어와도 입력 순서가 보존된다', () => {
    const { summary, result } = measurePipeline(makePayload(6), {
      sortKey: 'narrative' as AssessmentRowSortKey,
    });
    expect(result.paged.map((row) => row.id)).toEqual(
      Array.from({ length: 6 }, (_unused, index) => `assessment-${index}`),
    );
    expect(summary.samples).toBe(ITERATIONS);
    expect(assertRenderThreshold(summary).pass).toBe(true);
  });

  it('negative (e) 정규식 메타문자 검색어도 리터럴로 취급돼 throw 하지 않는다', () => {
    const payload = makePayload(REQ047_MAX_PEOPLE);
    // '.' 은 periodStart 의 '.000Z' 에 리터럴로 걸려 전건이 남고, '.*' 는 정규식이었다면
    // 전건 일치일 텐데 리터럴이라 0 건이다 — 리터럴 취급의 직접 증거.
    const cases: { term: string; expected: number }[] = [
      { term: '.', expected: REQ047_MAX_PEOPLE }, { term: '.*', expected: 0 },
      { term: '*', expected: 0 }, { term: '[', expected: 0 }, { term: '(?<', expected: 0 },
      { term: '2026-Q1', expected: REQ047_MAX_PEOPLE / 2 },
    ];
    for (const testCase of cases) {
      const { summary, result } = measurePipeline(payload, { searchTerm: testCase.term });
      expect(result.visible, testCase.term).toHaveLength(testCase.expected);
      expect(assertRenderThreshold(summary).pass, testCase.term).toBe(true);
    }
  });

  it('error path — 파이프라인 thunk 가 throw 하면 measureRenderLatency 가 전파한다', () => {
    // 표시 계약이 깨진 상황을 0ms 표본이나 조용한 pass 로 두지 않는지 확인한다.
    const boom = new Error('파이프라인 렌더 실패');
    expect(() =>
      measureRenderLatency(() => {
        runPipeline(makePayload(4));
        throw boom;
      }, ITERATIONS),
    ).toThrow(boom);
  });

  it('error path — 표본 0 요약은 파이프라인 맥락에서도 pass=false 로 판정된다', () => {
    const verdict = assertRenderThreshold({ samples: 0, p50: 0, p95: 0, max: 0 });
    expect(verdict.pass).toBe(false);
    expect(verdict.reason).not.toBe('');
    expect(verdict.reason).toContain('표본 0 개');
  });
});
