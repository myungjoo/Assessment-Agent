import { describe, expect, it } from 'vitest';
import {
  CONTRIBUTION_SCORE_BUCKET_EDGES,
  CONTRIBUTION_SCORE_MAX,
  CONTRIBUTION_SCORE_MIN,
  deriveContributionScoreBuckets,
  summarizeContributionScores,
} from './assessmentScoreScale';
import type { AssessmentDisplayRow } from './assessmentRow';
// 구조 호환 검증 전용 type-only import — 값 import 가 아니라 런타임 의존은 0 이다
// (api → components 역방향 의존 금지 규약 유지, 컴파일 타임 고정 목적).
import type { ScoreDistributionBucket } from '../components/ScoreDistributionChart';

// R-112 — 실 contributionScore 스케일(0–3) 집계 순수 모듈(T-1728, REQ-076 slice 4a) 검증.
// 순수 함수라 mock 0. 스케일 가정이 다시 0–100 으로 되돌아가면 아래 drift guard 가 fail 한다.

function makeRow(overrides: Partial<AssessmentDisplayRow> = {}): AssessmentDisplayRow {
  return {
    id: 'a-1',
    personId: 'p-1',
    period: 'monthly',
    scope: 'team',
    periodStart: '2026-08-01T00:00:00.000Z',
    difficulty: 'high',
    contributionScore: 1.5,
    volume: 5,
    narrative: '기여도가 안정적입니다.',
    ...overrides,
  };
}

// 타입 우회 입력을 만드는 helper — 런타임에 실제로 도착할 수 있는 비정상 값을 재현한다.
function bypass(value: unknown): AssessmentDisplayRow[] {
  return value as AssessmentDisplayRow[];
}

function counts(rows: AssessmentDisplayRow[]): number[] {
  return deriveContributionScoreBuckets(rows).map((bucket) => bucket.count);
}

describe('deriveContributionScoreBuckets — happy path', () => {
  it('여러 등급이 섞인 행을 각 bucket 에 정확히 분포시킨다', () => {
    const rows = [
      makeRow({ id: 'a', contributionScore: 0.2 }),
      makeRow({ id: 'b', contributionScore: 0.75 }),
      makeRow({ id: 'c', contributionScore: 1.2 }),
      makeRow({ id: 'd', contributionScore: 1.9 }),
      makeRow({ id: 'e', contributionScore: 2.4 }),
      makeRow({ id: 'f', contributionScore: 2.9 }),
      makeRow({ id: 'g', contributionScore: 2.6 }),
    ];
    expect(counts(rows)).toEqual([1, 1, 1, 1, 1, 2]);
  });

  it('bucket 의 id·label 을 경계 정의 순서 그대로 반환한다', () => {
    const buckets = deriveContributionScoreBuckets([makeRow()]);
    const labels = ['0–0.5', '0.5–1', '1–1.5', '1.5–2', '2–2.5', '2.5–3'];
    expect(buckets.map((b) => b.label)).toEqual(labels);
    expect(buckets.map((b) => b.id)).toEqual(CONTRIBUTION_SCORE_BUCKET_EDGES.map((e) => e.id));
  });

  it('정수 경계값 1·2 는 상위 bucket 에 귀속한다', () => {
    const rows = [
      makeRow({ id: 'a', contributionScore: 1 }),
      makeRow({ id: 'b', contributionScore: 2 }),
    ];
    // index 2 = '1–1.5', index 4 = '2–2.5' 각 1 건 — 하위 bucket 은 0 이어야 한다.
    expect(counts(rows)).toEqual([0, 0, 1, 0, 1, 0]);
  });
});

describe('summarizeContributionScores — happy path', () => {
  it('점수를 가진 행 수와 평균을 정확히 계산한다', () => {
    const rows = [
      makeRow({ id: 'a', contributionScore: 1 }),
      makeRow({ id: 'b', contributionScore: 2 }),
      makeRow({ id: 'c', contributionScore: 3 }),
    ];
    expect(summarizeContributionScores(rows)).toEqual({
      count: 3,
      average: 2,
      scoreMax: 3,
    });
  });

  it('평균을 소수 둘째 자리로 결정적 반올림한다', () => {
    const rows = [
      makeRow({ id: 'a', contributionScore: 1 }),
      makeRow({ id: 'b', contributionScore: 2 }),
      makeRow({ id: 'c', contributionScore: 2 }),
    ];
    // 5/3 = 1.6666… → 1.67
    expect(summarizeContributionScores(rows).average).toBe(1.67);
  });
});

describe('error path — 비정상 입력을 값으로 흡수한다', () => {
  it('배열이 아닌 입력(null·객체·문자열)에도 throw 없이 빈 결과를 반환한다', () => {
    for (const invalid of [null, undefined, {}, 'rows', 42, true]) {
      expect(() => deriveContributionScoreBuckets(bypass(invalid))).not.toThrow();
      expect(deriveContributionScoreBuckets(bypass(invalid))).toEqual([]);
      expect(summarizeContributionScores(bypass(invalid))).toEqual({
        count: 0,
        average: null,
        scoreMax: 3,
      });
    }
  });

  it('행 원소가 null·비객체여도 throw 없이 그 행만 제외한다', () => {
    const rows = bypass([null, undefined, 'row', 7, makeRow({ contributionScore: 2.2 })]);
    expect(() => deriveContributionScoreBuckets(rows)).not.toThrow();
    expect(counts(rows)).toEqual([0, 0, 0, 0, 1, 0]);
    expect(summarizeContributionScores(rows)).toEqual({
      count: 1,
      average: 2.2,
      scoreMax: 3,
    });
  });
});

describe('분기 cover', () => {
  it('빈 배열이면 빈 bucket 목록과 count 0 요약이다', () => {
    expect(deriveContributionScoreBuckets([])).toEqual([]);
    expect(summarizeContributionScores([])).toEqual({
      count: 0,
      average: null,
      scoreMax: 3,
    });
  });

  it('전 행의 점수가 null 이면 빈 bucket 목록이다(0 점 막대 6 개를 만들지 않는다)', () => {
    const rows = [
      makeRow({ id: 'a', contributionScore: null }),
      makeRow({ id: 'b', contributionScore: null }),
    ];
    expect(deriveContributionScoreBuckets(rows)).toEqual([]);
    expect(summarizeContributionScores(rows).count).toBe(0);
  });

  it('하한 미만(-1) 은 첫 bucket 으로 clamp 한다', () => {
    const rows = [makeRow({ contributionScore: -1 })];
    expect(counts(rows)).toEqual([1, 0, 0, 0, 0, 0]);
    expect(summarizeContributionScores(rows).average).toBe(CONTRIBUTION_SCORE_MIN);
  });

  it('상한 초과(4) 는 마지막 bucket 으로 clamp 한다', () => {
    const rows = [makeRow({ contributionScore: 4 })];
    expect(counts(rows)).toEqual([0, 0, 0, 0, 0, 1]);
    expect(summarizeContributionScores(rows).average).toBe(CONTRIBUTION_SCORE_MAX);
  });

  it('마지막 bucket 은 상한 3 을 포함한다', () => {
    expect(counts([makeRow({ contributionScore: 3 })])).toEqual([0, 0, 0, 0, 0, 1]);
  });

  it('첫 bucket 은 하한 0 을 포함한다', () => {
    expect(counts([makeRow({ contributionScore: 0 })])).toEqual([1, 0, 0, 0, 0, 0]);
  });

  it('일부만 null 인 혼합 배열은 점수 있는 행만 집계한다', () => {
    const rows = [
      makeRow({ id: 'a', contributionScore: 0.4 }),
      makeRow({ id: 'b', contributionScore: null }),
      makeRow({ id: 'c', contributionScore: 2.8 }),
    ];
    expect(counts(rows)).toEqual([1, 0, 0, 0, 0, 1]);
    expect(summarizeContributionScores(rows)).toEqual({
      count: 2,
      average: 1.6,
      scoreMax: 3,
    });
  });
});

describe('negative cases', () => {
  it('NaN·Infinity 점수는 집계에 포함되지 않는다', () => {
    const rows = bypass([
      makeRow({ id: 'a', contributionScore: Number.NaN }),
      makeRow({ id: 'b', contributionScore: Number.POSITIVE_INFINITY }),
      makeRow({ id: 'c', contributionScore: Number.NEGATIVE_INFINITY }),
      makeRow({ id: 'd', contributionScore: 1.2 }),
    ]);
    expect(counts(rows)).toEqual([0, 0, 1, 0, 0, 0]);
    expect(summarizeContributionScores(rows)).toEqual({
      count: 1,
      average: 1.2,
      scoreMax: 3,
    });
  });

  it('문자열 점수(타입 우회)는 평균을 오염시키지 않는다', () => {
    const rows = bypass([
      makeRow({ id: 'a', contributionScore: '3' as unknown as number }),
      makeRow({ id: 'b', contributionScore: 1 }),
    ]);
    // '3' 이 수치로 해석되면 평균이 2 가 된다 — 제외되어 1 이어야 한다.
    expect(summarizeContributionScores(rows)).toEqual({
      count: 1,
      average: 1,
      scoreMax: 3,
    });
    expect(counts(rows)).toEqual([0, 0, 1, 0, 0, 0]);
  });

  it('null 점수 행이 첫 bucket 을 부풀리지 않는다(0 점 위장 0)', () => {
    const blank = makeRow({ id: 'a', contributionScore: null });
    const rows = [blank, { ...blank, id: 'b' }, makeRow({ id: 'c', contributionScore: 2.1 })];
    expect(counts(rows)).toEqual([0, 0, 0, 0, 1, 0]);
  });

  it('입력 배열·원소를 mutate 하지 않는다', () => {
    const rows = [
      makeRow({ id: 'a', contributionScore: -1 }),
      makeRow({ id: 'b', contributionScore: 4 }),
      makeRow({ id: 'c', contributionScore: null }),
    ];
    const snapshot = JSON.parse(JSON.stringify(rows));
    deriveContributionScoreBuckets(rows);
    summarizeContributionScores(rows);
    expect(rows).toEqual(snapshot);
    expect(rows).toHaveLength(3);
  });

  it('집계 대상이 0 건일 때 average 는 0 이 아니라 null 이다', () => {
    const summary = summarizeContributionScores([makeRow({ contributionScore: null })]);
    expect(summary.average).toBeNull();
    expect(summary.average).not.toBe(0);
  });

  it('bucket count 의 합은 항상 집계 대상 행 수와 일치한다', () => {
    const rows = bypass([
      makeRow({ id: 'a', contributionScore: -5 }),
      makeRow({ id: 'b', contributionScore: 0 }),
      makeRow({ id: 'c', contributionScore: 1 }),
      makeRow({ id: 'd', contributionScore: 3 }),
      makeRow({ id: 'e', contributionScore: 99 }),
      makeRow({ id: 'f', contributionScore: null }),
      makeRow({ id: 'g', contributionScore: Number.NaN }),
      null,
    ]);
    const total = deriveContributionScoreBuckets(rows).reduce(
      (sum, bucket) => sum + bucket.count,
      0,
    );
    expect(total).toBe(summarizeContributionScores(rows).count);
    expect(total).toBe(5);
  });
});

describe('drift guard — 스케일 가정이 0–100 으로 돌아가면 fail 한다', () => {
  it('bucket 경계가 [MIN, MAX] 를 틈·겹침 없이 연속으로 덮는다', () => {
    const edges = CONTRIBUTION_SCORE_BUCKET_EDGES;
    expect(edges.length).toBeGreaterThan(0);
    expect(edges[0].min).toBe(CONTRIBUTION_SCORE_MIN);
    expect(edges[edges.length - 1].max).toBe(CONTRIBUTION_SCORE_MAX);
    expect(CONTRIBUTION_SCORE_MIN).toBe(0);
    expect(CONTRIBUTION_SCORE_MAX).toBe(3);
    for (let i = 0; i < edges.length; i += 1) {
      // 각 구간은 폭이 양수여야 한다(겹침·역전 방지).
      expect(edges[i].max).toBeGreaterThan(edges[i].min);
      if (i > 0) {
        // 앞 구간의 상한 == 뒤 구간의 하한 — 틈도 겹침도 없다.
        expect(edges[i].min).toBe(edges[i - 1].max);
      }
    }
    // 정수 경계 1·2 가 ordinal 등급 경계와 일치한다.
    const boundaries = edges.map((edge) => edge.min);
    expect(boundaries).toContain(1);
    expect(boundaries).toContain(2);
  });

  it('반환 bucket 이 ScoreDistributionBucket 과 구조 호환이다', () => {
    const buckets = deriveContributionScoreBuckets([makeRow()]);
    // 컴파일 타임 고정 — 필드가 어긋나면 tsc(=pnpm build) 가 fail 한다.
    const compatible: ScoreDistributionBucket[] = buckets;
    expect(Object.keys(compatible[0]).sort()).toEqual(['count', 'id', 'label']);
    expect(typeof compatible[0].label).toBe('string');
    expect(typeof compatible[0].count).toBe('number');
  });
});
