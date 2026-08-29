import { describe, expect, it } from 'vitest';
import {
  FALLBACK_TREND_LABEL,
  SUMMARY_DISPLAY_ROW_KEYS,
  deriveSummaryDisplayRows,
  toSummaryDisplayRow,
  toTrendLabel,
} from './summaryRow';

// R-112 — backend Summary 응답 → 시계열 표시 행 매핑(T-1788, REQ-075) 검증.
// 순수 함수라 mock 0. 필드명 정본은 backend prisma `model Summary` 이며, 아래 drift
// guard 가 web 쪽 키 집합이 그것과 어긋나는 순간 fail 하게 한다.

// backend 가 실제로 내려주는 완전한 row 픽스처 (Decimal 은 문자열로 직렬화된 경우).
const fullRaw = {
  id: 's-1',
  personId: 'p-1',
  period: 'monthly',
  periodStart: '2026-08-01T00:00:00.000Z',
  narrative: '8 월 기여 추이가 상승했습니다.',
  metricScore: '2.5',
  createdAt: '2026-08-02T03:04:05.000Z',
};

describe('toTrendLabel — happy path', () => {
  it('ISO 문자열의 날짜 부분(YYYY-MM-DD)을 라벨로 쓴다', () => {
    expect(toTrendLabel('2026-08-01T00:00:00.000Z', 'monthly')).toBe('2026-08-01');
  });

  it('시각 없는 날짜 문자열도 그대로 라벨이 된다', () => {
    expect(toTrendLabel('2026-08-01', 'daily')).toBe('2026-08-01');
  });

  it('공백 구분자 형태("YYYY-MM-DD hh:mm")도 날짜 부분만 취한다', () => {
    expect(toTrendLabel('2026-12-31 09:00', 'daily')).toBe('2026-12-31');
  });

  it('앞뒤 공백이 섞인 ISO 문자열도 수용한다', () => {
    expect(toTrendLabel('  2026-01-09T12:00:00Z  ', 'weekly')).toBe('2026-01-09');
  });
});

describe('toTrendLabel — 분기 / fallback 순서', () => {
  it('형식이 어긋난 periodStart 는 원문을 라벨로 남긴다', () => {
    expect(toTrendLabel('2026-13-99T00:00:00Z', 'monthly')).toBe('2026-13-99T00:00:00Z');
    expect(toTrendLabel('언젠가', 'monthly')).toBe('언젠가');
  });

  it('periodStart 가 부재하면 period 로 fallback 한다', () => {
    expect(toTrendLabel(undefined, 'weekly')).toBe('weekly');
    expect(toTrendLabel(null, 'daily')).toBe('daily');
    expect(toTrendLabel('', 'daily')).toBe('daily');
    expect(toTrendLabel('   ', 'daily')).toBe('daily');
  });

  it('periodStart 가 유효하면 period 종류값을 라벨로 우선 채택하지 않는다', () => {
    expect(toTrendLabel('2026-03-02T00:00:00.000Z', 'daily')).not.toBe('daily');
  });

  it('둘 다 부재하면 결정적 fallback 라벨이며 빈 문자열이 아니다', () => {
    expect(toTrendLabel(undefined, undefined)).toBe(FALLBACK_TREND_LABEL);
    expect(toTrendLabel('', '')).toBe(FALLBACK_TREND_LABEL);
    expect(toTrendLabel('  ', '  ')).toBe(FALLBACK_TREND_LABEL);
    expect(FALLBACK_TREND_LABEL).not.toBe('');
  });
});

describe('toTrendLabel — error path / negative cases', () => {
  it('문자열이 아닌 periodStart(숫자 · Date · 객체 · 배열 · boolean)는 결손 취급이다', () => {
    expect(toTrendLabel(1767225600000, 'monthly')).toBe('monthly');
    expect(toTrendLabel(new Date('2026-08-01T00:00:00Z'), 'monthly')).toBe('monthly');
    expect(toTrendLabel({ iso: '2026-08-01' }, 'monthly')).toBe('monthly');
    expect(toTrendLabel(['2026-08-01'], 'monthly')).toBe('monthly');
    expect(toTrendLabel(true, 'monthly')).toBe('monthly');
  });

  it('문자열이 아닌 period 는 fallback 후보가 되지 않는다', () => {
    expect(toTrendLabel(null, 7)).toBe(FALLBACK_TREND_LABEL);
    expect(toTrendLabel(null, { period: 'daily' })).toBe(FALLBACK_TREND_LABEL);
  });

  it('어떤 입력에도 throw 하지 않는다', () => {
    const inputs: unknown[] = [null, undefined, '', 'x', {}, [], Number.NaN, Symbol('s'), 1n];
    for (const periodStart of inputs) {
      for (const period of inputs) {
        expect(() => toTrendLabel(periodStart, period)).not.toThrow();
      }
    }
  });
});

describe('toSummaryDisplayRow — happy path', () => {
  it('완전한 backend row 를 표시 축 6 개로 매핑한다', () => {
    expect(toSummaryDisplayRow(fullRaw)).toEqual({
      id: 's-1',
      period: 'monthly',
      periodStart: '2026-08-01T00:00:00.000Z',
      label: '2026-08-01',
      value: 2.5,
      narrative: '8 월 기여 추이가 상승했습니다.',
    });
  });

  it('metricScore 가 숫자로 직렬화된 경우도 그대로 수용한다', () => {
    expect(toSummaryDisplayRow({ ...fullRaw, metricScore: 4 })?.value).toBe(4);
  });

  it('매핑 결과의 키 집합이 SUMMARY_DISPLAY_ROW_KEYS 와 일치한다 (drift guard)', () => {
    const row = toSummaryDisplayRow(fullRaw);
    expect(row).not.toBeNull();
    expect(Object.keys(row as object)).toEqual([...SUMMARY_DISPLAY_ROW_KEYS]);
  });

  it('입력 객체를 mutate 하지 않는다', () => {
    const raw = { ...fullRaw };
    toSummaryDisplayRow(raw);
    expect(raw).toEqual(fullRaw);
  });

  it('Object.freeze 된 입력도 throw 없이 매핑한다', () => {
    const frozen = Object.freeze({ ...fullRaw });
    expect(() => toSummaryDisplayRow(frozen)).not.toThrow();
    expect(toSummaryDisplayRow(frozen)?.id).toBe('s-1');
  });

  it('알 수 없는 추가 필드가 있어도 표시 축만 추려낸다', () => {
    const row = toSummaryDisplayRow({ ...fullRaw, unexpected: '무시', nested: { a: 1 } });
    expect(Object.keys(row as object)).toEqual([...SUMMARY_DISPLAY_ROW_KEYS]);
    expect(row?.value).toBe(2.5);
  });
});

describe('toSummaryDisplayRow — error path / id 분기', () => {
  it('null · undefined 는 null 이다', () => {
    expect(toSummaryDisplayRow(null)).toBeNull();
    expect(toSummaryDisplayRow(undefined)).toBeNull();
  });

  it('원시값(문자열 · 숫자 · boolean)은 null 이다', () => {
    expect(toSummaryDisplayRow('s-1')).toBeNull();
    expect(toSummaryDisplayRow(3)).toBeNull();
    expect(toSummaryDisplayRow(true)).toBeNull();
  });

  it('배열은 객체지만 row 가 아니라 null 이다', () => {
    expect(toSummaryDisplayRow([])).toBeNull();
    expect(toSummaryDisplayRow([fullRaw])).toBeNull();
  });

  it('id 누락 · 빈 문자열 · 비문자열이면 null 이다', () => {
    expect(toSummaryDisplayRow({ ...fullRaw, id: undefined })).toBeNull();
    expect(toSummaryDisplayRow({ ...fullRaw, id: '' })).toBeNull();
    expect(toSummaryDisplayRow({ ...fullRaw, id: 7 })).toBeNull();
    expect(toSummaryDisplayRow({ ...fullRaw, id: null })).toBeNull();
  });
});

describe('toSummaryDisplayRow — metricScore 결손 분기', () => {
  it('metricScore 누락 · null 은 0 이 아니라 null 이다', () => {
    expect(toSummaryDisplayRow({ ...fullRaw, metricScore: undefined })?.value).toBeNull();
    expect(toSummaryDisplayRow({ ...fullRaw, metricScore: null })?.value).toBeNull();
  });

  it('비수치 문자열 · 빈 문자열은 null 이다', () => {
    expect(toSummaryDisplayRow({ ...fullRaw, metricScore: 'abc' })?.value).toBeNull();
    expect(toSummaryDisplayRow({ ...fullRaw, metricScore: '' })?.value).toBeNull();
  });

  it('NaN · Infinity 는 null 로 흡수된다 (결과에 NaN 미노출)', () => {
    expect(toSummaryDisplayRow({ ...fullRaw, metricScore: Number.NaN })?.value).toBeNull();
    expect(
      toSummaryDisplayRow({ ...fullRaw, metricScore: Number.POSITIVE_INFINITY })?.value,
    ).toBeNull();
  });

  it('0 · 음수는 유효한 값으로 보존한다 (결손과 구분)', () => {
    expect(toSummaryDisplayRow({ ...fullRaw, metricScore: 0 })?.value).toBe(0);
    expect(toSummaryDisplayRow({ ...fullRaw, metricScore: '-1.25' })?.value).toBe(-1.25);
  });

  it('옛 계약(value · score 만 있는 row)은 값 0 으로 위장되지 않고 null 이다', () => {
    const legacy = { id: 's-old', period: 'daily', value: 3, score: 4 };
    const row = toSummaryDisplayRow(legacy);
    expect(row?.value).toBeNull();
    expect(row?.label).toBe('daily');
  });
});

describe('toSummaryDisplayRow — 문자열 축 결손 분기', () => {
  it('periodStart 부재 시 원문은 빈 문자열이고 라벨은 period 로 fallback 한다', () => {
    const row = toSummaryDisplayRow({ ...fullRaw, periodStart: undefined });
    expect(row?.periodStart).toBe('');
    expect(row?.label).toBe('monthly');
  });

  it('periodStart 형식 무효 시 원문을 보존하고 라벨도 원문이다', () => {
    const row = toSummaryDisplayRow({ ...fullRaw, periodStart: '2026-99-99' });
    expect(row?.periodStart).toBe('2026-99-99');
    expect(row?.label).toBe('2026-99-99');
  });

  it('periodStart · period 둘 다 부재면 결정적 fallback 라벨이다', () => {
    const row = toSummaryDisplayRow({ id: 's-2' });
    expect(row?.label).toBe(FALLBACK_TREND_LABEL);
    expect(row?.period).toBe('');
    expect(row?.periodStart).toBe('');
  });

  it('narrative 부재 · 비문자열은 빈 문자열로 흡수한다', () => {
    expect(toSummaryDisplayRow({ ...fullRaw, narrative: undefined })?.narrative).toBe('');
    expect(toSummaryDisplayRow({ ...fullRaw, narrative: 42 })?.narrative).toBe('');
  });
});

describe('deriveSummaryDisplayRows — happy path', () => {
  it('실제 GET /api/summaries 응답 배열을 TrendPoint 로 쓸 라벨 · 값으로 매핑한다', () => {
    const raw = [
      { ...fullRaw, id: 's-1', periodStart: '2026-06-01T00:00:00.000Z', metricScore: '2.5' },
      { ...fullRaw, id: 's-2', periodStart: '2026-07-01T00:00:00.000Z', metricScore: '3' },
      { ...fullRaw, id: 's-3', periodStart: '2026-08-01T00:00:00.000Z', metricScore: 4.25 },
    ];
    const points = deriveSummaryDisplayRows(raw).map(({ label, value }) => ({ label, value }));
    expect(points).toEqual([
      { label: '2026-06-01', value: 2.5 },
      { label: '2026-07-01', value: 3 },
      { label: '2026-08-01', value: 4.25 },
    ]);
  });

  it('원본 순서를 보존한다 (정렬하지 않는다)', () => {
    const raw = [
      { ...fullRaw, id: 's-b', periodStart: '2026-09-01T00:00:00.000Z' },
      { ...fullRaw, id: 's-a', periodStart: '2026-01-01T00:00:00.000Z' },
    ];
    expect(deriveSummaryDisplayRows(raw).map((row) => row.id)).toEqual(['s-b', 's-a']);
  });
});

describe('deriveSummaryDisplayRows — 배열 분기 / negative cases', () => {
  it('비배열 입력은 throw 없이 빈 배열이다', () => {
    expect(deriveSummaryDisplayRows(undefined)).toEqual([]);
    expect(deriveSummaryDisplayRows(null)).toEqual([]);
    expect(deriveSummaryDisplayRows('[]')).toEqual([]);
    expect(deriveSummaryDisplayRows(7)).toEqual([]);
    expect(deriveSummaryDisplayRows({ rows: [fullRaw] })).toEqual([]);
  });

  it('빈 배열은 빈 배열이다', () => {
    expect(deriveSummaryDisplayRows([])).toEqual([]);
  });

  it('매핑 불가 원소(null · undefined · 문자열 · 숫자 · 배열)만 제외하고 나머지는 살린다', () => {
    const rows = deriveSummaryDisplayRows([
      null,
      undefined,
      's-x',
      99,
      [fullRaw],
      { ...fullRaw, id: '' },
      fullRaw,
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('s-1');
  });

  it('전 원소가 매핑 불가면 빈 배열이다', () => {
    expect(deriveSummaryDisplayRows([null, 'x', {}, []])).toEqual([]);
  });

  it('값 결손 row 도 행 자체는 살리고 value 만 null 이다', () => {
    const rows = deriveSummaryDisplayRows([{ id: 's-9', periodStart: '2026-05-01' }]);
    expect(rows).toEqual([
      {
        id: 's-9',
        period: '',
        periodStart: '2026-05-01',
        label: '2026-05-01',
        value: null,
        narrative: '',
      },
    ]);
  });

  it('입력 배열과 원소를 mutate 하지 않는다', () => {
    const raw = [{ ...fullRaw }];
    const snapshot = JSON.stringify(raw);
    deriveSummaryDisplayRows(raw);
    expect(JSON.stringify(raw)).toBe(snapshot);
  });

  it('어떤 입력에도 throw 하지 않는다', () => {
    const inputs: unknown[] = [null, undefined, 0, '', {}, [], [null], [Symbol('s')], [1n]];
    for (const input of inputs) {
      expect(() => deriveSummaryDisplayRows(input)).not.toThrow();
    }
  });
});
