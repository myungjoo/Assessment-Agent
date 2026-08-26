import { describe, expect, it } from 'vitest';
import {
  ASSESSMENT_SORTABLE_KEYS,
  filterAssessmentRows,
  sortAssessmentRows,
} from './assessmentRowOps';
import type { AssessmentRowSortKey } from './assessmentRowOps';
import { ASSESSMENT_TABLE_COLUMNS } from '../components/AssessmentResultTable';
import type { AssessmentDisplayRow } from './assessmentRow';

// R-112 — AssessmentDisplayRow 정렬·검색 순수 연산(T-1726, REQ-075 slice 3a) 검증.
// 순수 함수라 mock 0. 표 컬럼과의 키·순서 정합은 아래 drift guard 가 지킨다.

function makeRow(overrides: Partial<AssessmentDisplayRow> = {}): AssessmentDisplayRow {
  return {
    id: 'a-1',
    personId: 'p-1',
    period: 'monthly',
    scope: 'team',
    periodStart: '2026-08-01T00:00:00.000Z',
    difficulty: 'high',
    contributionScore: 10,
    volume: 5,
    narrative: '기여도가 안정적입니다.',
    ...overrides,
  };
}

// 정렬 검증용 3 행 — 문자열 축(scope) 과 숫자 축(contributionScore) 이 모두 서로 다르다.
const rowA = makeRow({ id: 'a', scope: 'alpha', contributionScore: 30, volume: 1 });
const rowB = makeRow({ id: 'b', scope: 'beta', contributionScore: 10, volume: 2 });
const rowC = makeRow({ id: 'c', scope: 'gamma', contributionScore: 20, volume: 3 });
const rows = [rowA, rowB, rowC];

function ids(result: AssessmentDisplayRow[]): string[] {
  return result.map((row) => row.id);
}

describe('sortAssessmentRows — happy path', () => {
  it('문자열 축을 오름차순으로 정렬한다', () => {
    expect(ids(sortAssessmentRows(rows, 'scope', 'asc'))).toEqual(['a', 'b', 'c']);
  });

  it('문자열 축을 내림차순으로 정렬한다', () => {
    expect(ids(sortAssessmentRows(rows, 'scope', 'desc'))).toEqual(['c', 'b', 'a']);
  });

  it('숫자 축을 오름차순으로 정렬한다', () => {
    expect(ids(sortAssessmentRows(rows, 'contributionScore', 'asc'))).toEqual([
      'b',
      'c',
      'a',
    ]);
  });

  it('숫자 축을 내림차순으로 정렬한다', () => {
    expect(ids(sortAssessmentRows(rows, 'volume', 'desc'))).toEqual(['c', 'b', 'a']);
  });
});

describe('sortAssessmentRows — 분기', () => {
  it('한쪽만 null 인 숫자 축은 오름차순에서 null 을 마지막에 둔다', () => {
    const withNull = [makeRow({ id: 'n', contributionScore: null }), rowB];
    expect(ids(sortAssessmentRows(withNull, 'contributionScore', 'asc'))).toEqual([
      'b',
      'n',
    ]);
  });

  it('한쪽만 null 인 숫자 축은 내림차순에서도 null 을 마지막에 둔다', () => {
    const withNull = [makeRow({ id: 'n', contributionScore: null }), rowB];
    expect(ids(sortAssessmentRows(withNull, 'contributionScore', 'desc'))).toEqual([
      'b',
      'n',
    ]);
  });

  it('양쪽 모두 null 인 숫자 축은 서로의 순서를 바꾸지 않는다', () => {
    const bothNull = [
      makeRow({ id: 'n1', volume: null }),
      makeRow({ id: 'n2', volume: null }),
    ];
    expect(ids(sortAssessmentRows(bothNull, 'volume', 'asc'))).toEqual(['n1', 'n2']);
  });

  it('미지원 정렬 키는 입력 순서를 보존한 새 배열을 반환한다', () => {
    const result = sortAssessmentRows(rows, 'narrative' as AssessmentRowSortKey, 'asc');
    expect(ids(result)).toEqual(['a', 'b', 'c']);
    expect(result).not.toBe(rows);
  });
});

describe('sortAssessmentRows — error path / negative', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['객체', { scope: 'alpha' }],
    ['문자열', 'alpha'],
    ['숫자', 7],
  ])('배열이 아닌 입력(%s)은 throw 없이 빈 배열이다', (_label, input) => {
    expect(() =>
      sortAssessmentRows(input as unknown as AssessmentDisplayRow[], 'scope', 'asc'),
    ).not.toThrow();
    expect(
      sortAssessmentRows(input as unknown as AssessmentDisplayRow[], 'scope', 'asc'),
    ).toEqual([]);
  });

  it('null 숫자 축이 0 앞으로 위장되지 않는다', () => {
    const mixed = [
      makeRow({ id: 'none', contributionScore: null }),
      makeRow({ id: 'zero', contributionScore: 0 }),
      makeRow({ id: 'ten', contributionScore: 10 }),
    ];
    expect(ids(sortAssessmentRows(mixed, 'contributionScore', 'asc'))).toEqual([
      'zero',
      'ten',
      'none',
    ]);
    expect(ids(sortAssessmentRows(mixed, 'contributionScore', 'desc'))).toEqual([
      'ten',
      'zero',
      'none',
    ]);
  });

  it('빈 배열 입력은 빈 배열이다', () => {
    expect(sortAssessmentRows([], 'scope', 'asc')).toEqual([]);
  });

  it('타입 우회로 들어온 결손 행(키 누락 · undefined 값 · null 원소)도 throw 없이 흡수한다', () => {
    const broken = [
      { id: 'x' },
      { id: 'y', scope: undefined },
      null,
      rowA,
    ] as unknown as AssessmentDisplayRow[];
    expect(() => sortAssessmentRows(broken, 'scope', 'asc')).not.toThrow();
    expect(sortAssessmentRows(broken, 'scope', 'asc')).toHaveLength(4);
    expect(() => sortAssessmentRows(broken, 'volume', 'desc')).not.toThrow();
  });

  it('정렬해도 원본 배열과 원본 행 객체가 변경되지 않는다', () => {
    const frozenRows = Object.freeze([
      Object.freeze(makeRow({ id: 'f1', scope: 'zulu' })),
      Object.freeze(makeRow({ id: 'f2', scope: 'alpha' })),
    ]) as unknown as AssessmentDisplayRow[];
    const result = sortAssessmentRows(frozenRows, 'scope', 'asc');
    expect(ids(result)).toEqual(['f2', 'f1']);
    expect(ids(frozenRows)).toEqual(['f1', 'f2']);
    expect(frozenRows[0].scope).toBe('zulu');
  });
});

describe('filterAssessmentRows — happy path', () => {
  it('부분 일치로 행을 걸러낸다', () => {
    expect(ids(filterAssessmentRows(rows, 'bet'))).toEqual(['b']);
  });

  it('narrative 축에도 부분 일치를 적용한다', () => {
    const withNarrative = [makeRow({ id: 'n', narrative: '특이사항 없음' }), rowA];
    expect(ids(filterAssessmentRows(withNarrative, '특이사항'))).toEqual(['n']);
  });
});

describe('filterAssessmentRows — 분기', () => {
  it('빈 검색어는 입력 순서 그대로 전체를 통과시킨다', () => {
    expect(ids(filterAssessmentRows(rows, ''))).toEqual(['a', 'b', 'c']);
  });

  it('공백뿐인 검색어도 전체를 통과시킨다', () => {
    expect(ids(filterAssessmentRows(rows, '   '))).toEqual(['a', 'b', 'c']);
  });

  it('일치하는 행이 없으면 빈 배열이다', () => {
    expect(filterAssessmentRows(rows, 'zzz-없는값')).toEqual([]);
  });

  it('대소문자가 달라도 일치시킨다', () => {
    expect(ids(filterAssessmentRows(rows, 'ALPHA'))).toEqual(['a']);
  });

  it('숫자 축은 검색 대상이 아니다', () => {
    // contributionScore 30 이 있어도 '30' 검색으로는 걸리지 않는다.
    expect(filterAssessmentRows([rowA], '30')).toEqual([]);
  });
});

describe('filterAssessmentRows — error path / negative', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['객체', { period: 'monthly' }],
    ['문자열', 'monthly'],
    ['숫자', 7],
  ])('배열이 아닌 입력(%s)은 throw 없이 빈 배열이다', (_label, input) => {
    expect(() =>
      filterAssessmentRows(input as unknown as AssessmentDisplayRow[], 'a'),
    ).not.toThrow();
    expect(filterAssessmentRows(input as unknown as AssessmentDisplayRow[], 'a')).toEqual(
      [],
    );
  });

  it('검색어가 문자열이 아니면 전체를 통과시킨다', () => {
    expect(
      ids(filterAssessmentRows(rows, null as unknown as string)),
    ).toEqual(['a', 'b', 'c']);
  });

  it('빈 배열 입력은 빈 배열이다', () => {
    expect(filterAssessmentRows([], 'alpha')).toEqual([]);
  });

  it('타입 우회로 들어온 결손 행(키 누락 · undefined 값 · null 원소)도 throw 없이 흡수한다', () => {
    const broken = [
      { id: 'x' },
      { id: 'y', scope: undefined },
      null,
      rowA,
    ] as unknown as AssessmentDisplayRow[];
    expect(() => filterAssessmentRows(broken, 'alpha')).not.toThrow();
    expect(ids(filterAssessmentRows(broken, 'alpha'))).toEqual(['a']);
  });

  it('원본 배열과 원본 행 객체가 변경되지 않는다', () => {
    const frozenRows = Object.freeze([
      Object.freeze(makeRow({ id: 'f1', scope: 'alpha' })),
      Object.freeze(makeRow({ id: 'f2', scope: 'beta' })),
    ]) as unknown as AssessmentDisplayRow[];
    const result = filterAssessmentRows(frozenRows, 'alpha');
    expect(ids(result)).toEqual(['f1']);
    expect(ids(frozenRows)).toEqual(['f1', 'f2']);
    expect(frozenRows[1].scope).toBe('beta');
    expect(filterAssessmentRows(frozenRows, '')).not.toBe(frozenRows);
  });

  it.each(['.', '*', '['])(
    '검색어의 정규식 특수문자(%s)를 리터럴로 취급한다',
    (special) => {
      const literal = [
        makeRow({ id: 'lit', scope: `a${special}b` }),
        makeRow({ id: 'plain', scope: 'axb' }),
      ];
      expect(() => filterAssessmentRows(literal, special)).not.toThrow();
      expect(ids(filterAssessmentRows(literal, `a${special}b`))).toEqual(['lit']);
    },
  );
});

describe('ASSESSMENT_SORTABLE_KEYS — drift guard', () => {
  it('표 컬럼 키 목록과 순서까지 동일하다', () => {
    expect([...ASSESSMENT_SORTABLE_KEYS]).toEqual(
      ASSESSMENT_TABLE_COLUMNS.map((column) => column.key),
    );
  });

  it('6 개 키를 선언 순서대로 노출한다', () => {
    expect([...ASSESSMENT_SORTABLE_KEYS]).toEqual([
      'period',
      'scope',
      'periodStart',
      'difficulty',
      'contributionScore',
      'volume',
    ]);
  });
});
