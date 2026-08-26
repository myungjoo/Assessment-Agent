import { describe, expect, it } from 'vitest';
import {
  ASSESSMENT_DISPLAY_ROW_KEYS,
  deriveAssessmentDisplayRows,
  parseNumericField,
  toAssessmentDisplayRow,
} from './assessmentRow';

// R-112 — backend Assessment 응답 → 대시보드 표시 행 매핑(T-1724, REQ-075) 검증.
// 순수 함수라 mock 0. 필드명 정본은 backend prisma `model Assessment` 이며, 아래 drift
// guard 가 web 쪽 키 집합이 그것과 어긋나는 순간 fail 하게 한다.

// backend 가 실제로 내려주는 완전한 row 픽스처 (Decimal 은 문자열로 직렬화된 경우).
const fullRaw = {
  id: 'a-1',
  personId: 'p-1',
  period: 'monthly',
  scope: 'team',
  periodStart: '2026-08-01T00:00:00.000Z',
  difficulty: 'high',
  contributionScore: '12.5',
  volume: 42,
  narrative: '기여도가 안정적으로 유지되었습니다.',
};

describe('parseNumericField — happy path', () => {
  it('숫자를 그대로 보존한다', () => {
    expect(parseNumericField(12.5)).toBe(12.5);
  });

  it('Decimal 의 문자열 직렬화("12.5")를 숫자로 수용한다', () => {
    expect(parseNumericField('12.5')).toBe(12.5);
  });

  it('0 과 음수도 유효한 값으로 보존한다', () => {
    expect(parseNumericField(0)).toBe(0);
    expect(parseNumericField('-3')).toBe(-3);
  });

  it('앞뒤 공백이 섞인 수치 문자열도 수용한다', () => {
    expect(parseNumericField('  7  ')).toBe(7);
  });
});

describe('parseNumericField — error path / negative cases', () => {
  it('null · undefined 는 null 이다', () => {
    expect(parseNumericField(null)).toBeNull();
    expect(parseNumericField(undefined)).toBeNull();
  });

  it('빈 문자열 · 공백 문자열은 0 으로 위장하지 않고 null 이다', () => {
    expect(parseNumericField('')).toBeNull();
    expect(parseNumericField('   ')).toBeNull();
  });

  it('비수치 문자열은 null 이다', () => {
    expect(parseNumericField('abc')).toBeNull();
    expect(parseNumericField('12abc')).toBeNull();
  });

  it('NaN 은 null 로 흡수된다 (결과에 NaN 미노출)', () => {
    expect(parseNumericField(Number.NaN)).toBeNull();
  });

  it('Infinity · -Infinity 는 null 로 흡수된다', () => {
    expect(parseNumericField(Number.POSITIVE_INFINITY)).toBeNull();
    expect(parseNumericField(Number.NEGATIVE_INFINITY)).toBeNull();
    expect(parseNumericField('Infinity')).toBeNull();
  });

  it('boolean 은 1/0 으로 해석하지 않고 null 이다', () => {
    expect(parseNumericField(true)).toBeNull();
    expect(parseNumericField(false)).toBeNull();
  });

  it('객체 · 배열은 null 이다', () => {
    expect(parseNumericField({ value: 1 })).toBeNull();
    expect(parseNumericField([1])).toBeNull();
    expect(parseNumericField([])).toBeNull();
  });

  it('어떤 입력에도 throw 하지 않는다', () => {
    const inputs: unknown[] = [null, undefined, '', 'x', {}, [], Number.NaN, Symbol('s'), 1n];
    for (const input of inputs) {
      expect(() => parseNumericField(input)).not.toThrow();
    }
  });
});

describe('toAssessmentDisplayRow — happy path', () => {
  it('완전한 backend row 를 필드 9 개 보존해 매핑한다', () => {
    expect(toAssessmentDisplayRow(fullRaw)).toEqual({
      id: 'a-1',
      personId: 'p-1',
      period: 'monthly',
      scope: 'team',
      periodStart: '2026-08-01T00:00:00.000Z',
      difficulty: 'high',
      contributionScore: 12.5,
      volume: 42,
      narrative: '기여도가 안정적으로 유지되었습니다.',
    });
  });

  it('입력 객체를 mutate 하지 않는다', () => {
    const raw = { ...fullRaw };
    toAssessmentDisplayRow(raw);
    expect(raw).toEqual(fullRaw);
  });

  it('Object.freeze 된 입력도 throw 없이 매핑한다', () => {
    const frozen = Object.freeze({ ...fullRaw });
    expect(() => toAssessmentDisplayRow(frozen)).not.toThrow();
    expect(toAssessmentDisplayRow(frozen)?.id).toBe('a-1');
  });
});

describe('toAssessmentDisplayRow — error path / id 분기', () => {
  it('null · undefined 는 null 이다', () => {
    expect(toAssessmentDisplayRow(null)).toBeNull();
    expect(toAssessmentDisplayRow(undefined)).toBeNull();
  });

  it('비-객체(문자열 · 숫자 · boolean)는 null 이다', () => {
    expect(toAssessmentDisplayRow('a-1')).toBeNull();
    expect(toAssessmentDisplayRow(7)).toBeNull();
    expect(toAssessmentDisplayRow(true)).toBeNull();
  });

  it('배열은 row 로 취급하지 않고 null 이다', () => {
    expect(toAssessmentDisplayRow([fullRaw])).toBeNull();
  });

  it('id 가 결손(부재 · 비문자열 · 빈 문자열)이면 null 이다', () => {
    expect(toAssessmentDisplayRow({ ...fullRaw, id: undefined })).toBeNull();
    expect(toAssessmentDisplayRow({ ...fullRaw, id: 7 })).toBeNull();
    expect(toAssessmentDisplayRow({ ...fullRaw, id: '' })).toBeNull();
  });
});

describe('toAssessmentDisplayRow — 필드별 분기 cover', () => {
  it('contributionScore 4 갈래(문자열 · 숫자 · 비수치 · 결손)를 각각 흡수한다', () => {
    expect(toAssessmentDisplayRow({ ...fullRaw, contributionScore: '3.25' })?.contributionScore).toBe(3.25);
    expect(toAssessmentDisplayRow({ ...fullRaw, contributionScore: 9 })?.contributionScore).toBe(9);
    expect(toAssessmentDisplayRow({ ...fullRaw, contributionScore: 'n/a' })?.contributionScore).toBeNull();
    expect(toAssessmentDisplayRow({ ...fullRaw, contributionScore: undefined })?.contributionScore).toBeNull();
  });

  it('volume 3 갈래(숫자 · 문자열 · 결손)를 각각 흡수한다', () => {
    expect(toAssessmentDisplayRow({ ...fullRaw, volume: 11 })?.volume).toBe(11);
    expect(toAssessmentDisplayRow({ ...fullRaw, volume: '11' })?.volume).toBe(11);
    expect(toAssessmentDisplayRow({ ...fullRaw, volume: null })?.volume).toBeNull();
  });

  it('문자열 필드 결손은 빈 문자열로 fallback 한다', () => {
    const row = toAssessmentDisplayRow({ id: 'a-2' });
    expect(row).toEqual({
      id: 'a-2',
      personId: '',
      period: '',
      scope: '',
      periodStart: '',
      difficulty: '',
      contributionScore: null,
      volume: null,
      narrative: '',
    });
  });

  it('문자열 필드가 비문자열(숫자 · 객체)이어도 빈 문자열로 흡수한다', () => {
    const row = toAssessmentDisplayRow({ ...fullRaw, scope: 7, narrative: { text: 'x' } });
    expect(row?.scope).toBe('');
    expect(row?.narrative).toBe('');
  });

  it('숫자 축이 NaN · Infinity 여도 결과에 노출되지 않는다', () => {
    const row = toAssessmentDisplayRow({
      ...fullRaw,
      contributionScore: Number.NaN,
      volume: Number.POSITIVE_INFINITY,
    });
    expect(row?.contributionScore).toBeNull();
    expect(row?.volume).toBeNull();
    expect(Number.isNaN(row?.contributionScore as number)).toBe(false);
  });
});

describe('deriveAssessmentDisplayRows — happy path', () => {
  it('완전한 row 배열을 표시 행 배열로 매핑한다', () => {
    const rows = deriveAssessmentDisplayRows([fullRaw, { ...fullRaw, id: 'a-2', contributionScore: 5 }]);
    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe('a-1');
    expect(rows[1].contributionScore).toBe(5);
  });

  it('빈 배열 입력은 빈 배열이다', () => {
    expect(deriveAssessmentDisplayRows([])).toEqual([]);
  });
});

describe('deriveAssessmentDisplayRows — error path / negative cases', () => {
  it('비배열 입력(null · undefined · 객체 · 문자열)은 모두 빈 배열이다', () => {
    expect(deriveAssessmentDisplayRows(null)).toEqual([]);
    expect(deriveAssessmentDisplayRows(undefined)).toEqual([]);
    expect(deriveAssessmentDisplayRows({})).toEqual([]);
    expect(deriveAssessmentDisplayRows('x')).toEqual([]);
    expect(deriveAssessmentDisplayRows(0)).toEqual([]);
  });

  it('매핑 실패 원소만 제외하고 나머지 원소는 보존한다', () => {
    const rows = deriveAssessmentDisplayRows([fullRaw, null, { id: '' }, 'x', { ...fullRaw, id: 'a-3' }]);
    expect(rows.map((row) => row.id)).toEqual(['a-1', 'a-3']);
  });

  it('입력 배열과 그 원소를 mutate 하지 않는다', () => {
    const raw = [{ ...fullRaw }];
    const snapshot = JSON.stringify(raw);
    deriveAssessmentDisplayRows(raw);
    expect(raw).toHaveLength(1);
    expect(JSON.stringify(raw)).toBe(snapshot);
  });

  it('Object.freeze 된 배열/원소에도 throw 하지 않는다', () => {
    const frozen = Object.freeze([Object.freeze({ ...fullRaw })]);
    expect(() => deriveAssessmentDisplayRows(frozen)).not.toThrow();
    expect(deriveAssessmentDisplayRows(frozen)).toHaveLength(1);
  });

  it('결과 어느 행에도 NaN 이 노출되지 않는다', () => {
    const rows = deriveAssessmentDisplayRows([
      { ...fullRaw, contributionScore: 'oops' },
      { ...fullRaw, id: 'a-4', volume: Number.NaN },
    ]);
    for (const row of rows) {
      expect(Number.isNaN(row.contributionScore as number)).toBe(false);
      expect(Number.isNaN(row.volume as number)).toBe(false);
    }
  });
});

describe('AssessmentDisplayRow — backend 필드 계약 drift guard', () => {
  // 정본: prisma/schema.prisma 의 model Assessment 표시 대상 필드 9 개
  // (createdAt 은 표시 대상이 아니라 제외). 이 목록이 어긋나면 fail 해야 한다.
  const BACKEND_FIELDS = [
    'id',
    'personId',
    'period',
    'scope',
    'periodStart',
    'difficulty',
    'contributionScore',
    'volume',
    'narrative',
  ];

  it('매핑 결과의 키 집합이 backend Assessment 필드명과 정합한다', () => {
    const row = toAssessmentDisplayRow(fullRaw);
    expect(Object.keys(row as object).sort()).toEqual([...BACKEND_FIELDS].sort());
  });

  it('공개 키 목록 상수도 같은 집합을 유지한다', () => {
    expect([...ASSESSMENT_DISPLAY_ROW_KEYS].sort()).toEqual([...BACKEND_FIELDS].sort());
  });

  it('결손 입력으로 매핑해도 키 개수는 9 개로 고정된다', () => {
    const row = toAssessmentDisplayRow({ id: 'a-5' });
    expect(Object.keys(row as object)).toHaveLength(9);
  });
});
