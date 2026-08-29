import { describe, expect, it } from 'vitest';
import {
  CONTRIBUTION_DISPLAY_ROW_KEYS,
  FALLBACK_CONTRIBUTION_LABEL,
  deriveContributionDisplayRows,
  toContributionDisplayRow,
  toContributionLabel,
} from './contributionRow';

// R-112 — backend Contribution 응답 → 기여 상세 표시 행 매핑(T-1790, REQ-075) 검증.
// 순수 함수라 mock 0. 필드명 정본은 backend prisma `model Contribution` 이며, 아래
// drift guard 가 web 쪽 키 집합이 그것과 어긋나는 순간 fail 하게 한다.

// backend 가 실제로 내려주는 완전한 row 픽스처 (Decimal 은 문자열로 직렬화된 경우).
const fullRaw = {
  id: 'c-1',
  assessmentId: 'a-1',
  sourceType: 'github-pr',
  sourceUrl: 'https://github.com/org/repo/pull/128',
  sourceRef: '#128',
  difficulty: 'hard',
  contributionScore: '12.5',
  volume: 34,
  createdAt: '2026-08-02T03:04:05.000Z',
};

describe('toContributionLabel — happy path / 4 분기', () => {
  it('둘 다 존재하면 "sourceType sourceRef" 로 합성한다', () => {
    expect(toContributionLabel('github-pr', '#128')).toBe('github-pr #128');
  });

  it('sourceType 만 있으면 그 값이 라벨이다', () => {
    expect(toContributionLabel('confluence-page', undefined)).toBe('confluence-page');
    expect(toContributionLabel('confluence-page', null)).toBe('confluence-page');
  });

  it('sourceRef 만 있으면 그 값이 라벨이다', () => {
    expect(toContributionLabel(undefined, 'abc1234')).toBe('abc1234');
    expect(toContributionLabel(null, 'abc1234')).toBe('abc1234');
  });

  it('둘 다 결손이면 결정적 fallback 라벨이며 빈 문자열이 아니다', () => {
    expect(toContributionLabel(undefined, undefined)).toBe(FALLBACK_CONTRIBUTION_LABEL);
    expect(FALLBACK_CONTRIBUTION_LABEL).not.toBe('');
  });

  it('앞뒤 공백은 다듬어 합성한다', () => {
    expect(toContributionLabel('  github-commit  ', '  a1b2c3  ')).toBe(
      'github-commit a1b2c3',
    );
  });
});

describe('toContributionLabel — negative cases', () => {
  it('빈 문자열 라벨 후보는 결손으로 흡수한다', () => {
    expect(toContributionLabel('', '')).toBe(FALLBACK_CONTRIBUTION_LABEL);
    expect(toContributionLabel('', '#9')).toBe('#9');
    expect(toContributionLabel('github-pr', '')).toBe('github-pr');
  });

  it('공백만 있는 문자열도 결손으로 흡수한다', () => {
    expect(toContributionLabel('   ', '\t\n')).toBe(FALLBACK_CONTRIBUTION_LABEL);
    expect(toContributionLabel('   ', '#9')).toBe('#9');
  });

  it('비문자열(숫자 · boolean · 객체 · 배열)은 결손으로 간주하고 throw 하지 않는다', () => {
    expect(() => toContributionLabel(42, true)).not.toThrow();
    expect(toContributionLabel(42, true)).toBe(FALLBACK_CONTRIBUTION_LABEL);
    expect(toContributionLabel({ toString: () => 'pr' }, ['#1'])).toBe(
      FALLBACK_CONTRIBUTION_LABEL,
    );
  });
});

describe('toContributionDisplayRow — happy path', () => {
  it('실제 backend row 형태를 표시 행으로 매핑한다', () => {
    expect(toContributionDisplayRow(fullRaw, 0)).toEqual({
      id: 'c-1',
      label: 'github-pr #128',
      sourceType: 'github-pr',
      sourceUrl: 'https://github.com/org/repo/pull/128',
      sourceRef: '#128',
      difficulty: 'hard',
      score: 12.5,
      volume: 34,
    });
  });

  it('Decimal 이 숫자로 도착해도 동일하게 해석한다', () => {
    expect(toContributionDisplayRow({ ...fullRaw, contributionScore: 12.5 }, 0)?.score).toBe(
      12.5,
    );
  });

  it('입력 객체를 mutate 하지 않는다', () => {
    const input = { ...fullRaw };
    const snapshot = JSON.stringify(input);
    toContributionDisplayRow(input, 0);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe('toContributionDisplayRow — 분기 cover', () => {
  it('id 가 있으면 원문을 그대로 key 로 쓴다', () => {
    expect(toContributionDisplayRow({ ...fullRaw, id: 'c-99' }, 3)?.id).toBe('c-99');
  });

  it('id 가 결손이면 index 기반 합성 key(c{index+1})를 쓴다', () => {
    expect(toContributionDisplayRow({ sourceType: 'github-pr' }, 0)?.id).toBe('c1');
    expect(toContributionDisplayRow({ id: '' }, 4)?.id).toBe('c5');
    expect(toContributionDisplayRow({ id: '   ' }, 1)?.id).toBe('c2');
    expect(toContributionDisplayRow({ id: 7 }, 2)?.id).toBe('c3');
  });

  it('점수 파싱 성공 / 실패 두 분기를 모두 흡수한다', () => {
    expect(toContributionDisplayRow({ ...fullRaw, contributionScore: '0' }, 0)?.score).toBe(0);
    expect(
      toContributionDisplayRow({ ...fullRaw, contributionScore: 'N/A' }, 0)?.score,
    ).toBeNull();
  });

  it('비정상 index 도 throw 없이 흡수한다(합성 key 가 cNaN 으로 새지 않는다)', () => {
    expect(toContributionDisplayRow({}, Number.NaN)?.id).toBe('c1');
    expect(toContributionDisplayRow({}, -3)?.id).toBe('c1');
    expect(toContributionDisplayRow({}, Number.POSITIVE_INFINITY)?.id).toBe('c1');
    expect(toContributionDisplayRow({}, 2.7)?.id).toBe('c3');
  });
});

describe('toContributionDisplayRow — error path', () => {
  it('null · undefined · 원시값 · 배열은 매핑 불가(null)이며 throw 하지 않는다', () => {
    expect(() => toContributionDisplayRow(null, 0)).not.toThrow();
    expect(toContributionDisplayRow(null, 0)).toBeNull();
    expect(toContributionDisplayRow(undefined, 0)).toBeNull();
    expect(toContributionDisplayRow('c-1', 0)).toBeNull();
    expect(toContributionDisplayRow(7, 0)).toBeNull();
    expect(toContributionDisplayRow(true, 0)).toBeNull();
    expect(toContributionDisplayRow([fullRaw], 0)).toBeNull();
  });

  it('Object.freeze 된 row 도 throw 없이 매핑한다', () => {
    const frozen = Object.freeze({ ...fullRaw });
    expect(() => toContributionDisplayRow(frozen, 0)).not.toThrow();
    expect(toContributionDisplayRow(frozen, 0)?.label).toBe('github-pr #128');
  });

  it('전 필드가 빠진 빈 객체도 행으로 살아남는다(문자열 "" · 수치 null)', () => {
    expect(toContributionDisplayRow({}, 0)).toEqual({
      id: 'c1',
      label: FALLBACK_CONTRIBUTION_LABEL,
      sourceType: '',
      sourceUrl: '',
      sourceRef: '',
      difficulty: '',
      score: null,
      volume: null,
    });
  });
});

describe('toContributionDisplayRow — negative cases', () => {
  it('contributionScore 빈 문자열을 0 으로 오해하지 않는다(Number("")===0 함정)', () => {
    expect(toContributionDisplayRow({ ...fullRaw, contributionScore: '' }, 0)?.score).toBeNull();
    expect(
      toContributionDisplayRow({ ...fullRaw, contributionScore: '   ' }, 0)?.score,
    ).toBeNull();
  });

  it('비수치 문자열 · boolean · null 수치 축은 null 이다', () => {
    expect(
      toContributionDisplayRow({ ...fullRaw, contributionScore: '십이점오' }, 0)?.score,
    ).toBeNull();
    expect(toContributionDisplayRow({ ...fullRaw, contributionScore: true }, 0)?.score).toBeNull();
    expect(toContributionDisplayRow({ ...fullRaw, contributionScore: null }, 0)?.score).toBeNull();
    expect(
      toContributionDisplayRow({ ...fullRaw, contributionScore: { v: 1 } }, 0)?.score,
    ).toBeNull();
  });

  it('volume 결손 · 비정상 값도 0 으로 위장하지 않는다', () => {
    expect(toContributionDisplayRow({ ...fullRaw, volume: undefined }, 0)?.volume).toBeNull();
    expect(toContributionDisplayRow({ ...fullRaw, volume: '' }, 0)?.volume).toBeNull();
    expect(toContributionDisplayRow({ ...fullRaw, volume: false }, 0)?.volume).toBeNull();
    expect(toContributionDisplayRow({ ...fullRaw, volume: Number.NaN }, 0)?.volume).toBeNull();
    expect(
      toContributionDisplayRow({ ...fullRaw, volume: Number.POSITIVE_INFINITY }, 0)?.volume,
    ).toBeNull();
    expect(toContributionDisplayRow({ ...fullRaw, volume: '34' }, 0)?.volume).toBe(34);
  });

  it('비문자열 문자열 축은 빈 문자열로 흡수한다', () => {
    const row = toContributionDisplayRow(
      { ...fullRaw, sourceUrl: 42, difficulty: null, sourceType: {}, sourceRef: [] },
      0,
    );
    expect(row?.sourceUrl).toBe('');
    expect(row?.difficulty).toBe('');
    expect(row?.sourceType).toBe('');
    expect(row?.sourceRef).toBe('');
    expect(row?.label).toBe(FALLBACK_CONTRIBUTION_LABEL);
  });
});

describe('deriveContributionDisplayRows', () => {
  it('배열 전체를 원본 순서대로 매핑한다', () => {
    const rows = deriveContributionDisplayRows([
      fullRaw,
      { ...fullRaw, id: 'c-2', sourceRef: '#129' },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.id)).toEqual(['c-1', 'c-2']);
    expect(rows[1].label).toBe('github-pr #129');
  });

  it('결손 row 가 섞여 있어도 나머지는 살리고 합성 key 는 원본 index 를 따른다', () => {
    const rows = deriveContributionDisplayRows([null, {}, fullRaw, 'x', undefined]);
    expect(rows.map((row) => row.id)).toEqual(['c2', 'c-1']);
  });

  it('비배열 입력(null · undefined · 객체 · 문자열 · 숫자)은 빈 배열이며 throw 0', () => {
    expect(() => deriveContributionDisplayRows(null)).not.toThrow();
    expect(deriveContributionDisplayRows(null)).toEqual([]);
    expect(deriveContributionDisplayRows(undefined)).toEqual([]);
    expect(deriveContributionDisplayRows({ rows: [fullRaw] })).toEqual([]);
    expect(deriveContributionDisplayRows('c-1')).toEqual([]);
    expect(deriveContributionDisplayRows(7)).toEqual([]);
  });

  it('빈 배열은 빈 배열이다', () => {
    expect(deriveContributionDisplayRows([])).toEqual([]);
  });
});

describe('drift guard — 키 집합 정합', () => {
  it('매핑 결과의 Object.keys 가 CONTRIBUTION_DISPLAY_ROW_KEYS 와 순서까지 일치한다', () => {
    const row = toContributionDisplayRow(fullRaw, 0);
    expect(Object.keys(row as object)).toEqual([...CONTRIBUTION_DISPLAY_ROW_KEYS]);
  });

  it('결손 row 도 같은 키 집합을 갖는다(부분 행이 키를 흘리지 않는다)', () => {
    const row = toContributionDisplayRow({}, 0);
    expect(Object.keys(row as object)).toEqual([...CONTRIBUTION_DISPLAY_ROW_KEYS]);
  });

  it('키 목록에 중복이 없고 backend Contribution 표시 축 8 개를 담는다', () => {
    expect(new Set(CONTRIBUTION_DISPLAY_ROW_KEYS).size).toBe(
      CONTRIBUTION_DISPLAY_ROW_KEYS.length,
    );
    expect(CONTRIBUTION_DISPLAY_ROW_KEYS).toHaveLength(8);
  });
});
