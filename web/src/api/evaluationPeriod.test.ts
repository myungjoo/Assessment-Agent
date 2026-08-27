import { describe, expect, it } from 'vitest';
import {
  buildPeriodEvaluationRequest,
  DEFAULT_EVALUATION_SCOPE,
  EVALUATION_PERIOD_OPTIONS,
  isEvaluationPeriodGranularity,
  normalizePeriodStartInput,
  PERIOD_EVALUATION_PATH,
} from './evaluationPeriod';

// R-112 — 기간 지정 평가 요청 조립 순수 모듈(T-1732, REQ-077 slice 1) 검증. 순수 함수라
// mock 0. body 키 집합이 backend `PeriodBridgeDto` 5 키를 벗어나면 drift guard 가 fail 한다.

const VALID_INPUT = { personId: 'p-1', period: 'month', periodStart: '2026-08-01' };

// 한 축만 바꿔 조립을 시도하는 helper — 각 케이스가 무엇을 바꿨는지만 드러나게 한다.
function withInput(overrides: Record<string, unknown>) {
  return buildPeriodEvaluationRequest({ ...VALID_INPUT, ...overrides });
}

describe('상수 · option source — happy path', () => {
  it('요청 path 와 기본 scope 가 api.md 104 행 계약과 같다', () => {
    expect(PERIOD_EVALUATION_PATH).toBe('/api/assessment-evaluation/period');
    expect(DEFAULT_EVALUATION_SCOPE).toBe('aggregate');
  });
  it('option 이 day·week·month 3 종을 순서대로 담고 한국어 라벨을 가진다', () => {
    const options = EVALUATION_PERIOD_OPTIONS;
    expect(options.map((o) => o.value)).toEqual(['day', 'week', 'month']);
    expect(options.map((o) => o.label)).toEqual(['일간', '주간', '월간']);
  });
});

describe('isEvaluationPeriodGranularity', () => {
  it('허용 literal 3 종만 true (happy path)', () => {
    expect(isEvaluationPeriodGranularity('day')).toBe(true);
    expect(isEvaluationPeriodGranularity('week')).toBe(true);
    expect(isEvaluationPeriodGranularity('month')).toBe(true);
  });
  it('허용 밖 · 대소문자 위반 · 비문자열은 false (negative)', () => {
    expect(isEvaluationPeriodGranularity('year')).toBe(false);
    expect(isEvaluationPeriodGranularity('DAY')).toBe(false);
    expect(isEvaluationPeriodGranularity('')).toBe(false);
    expect(isEvaluationPeriodGranularity(null)).toBe(false);
    expect(isEvaluationPeriodGranularity(undefined)).toBe(false);
    expect(isEvaluationPeriodGranularity(1)).toBe(false);
  });
});

describe('normalizePeriodStartInput', () => {
  it('날짜만 오는 값을 통과시키고 공백은 걷어낸다 (happy path)', () => {
    expect(normalizePeriodStartInput('2026-08-01')).toBe('2026-08-01');
    expect(normalizePeriodStartInput('  2026-02-28  ')).toBe('2026-02-28');
    expect(normalizePeriodStartInput('2024-02-29')).toBe('2024-02-29'); // 윤년
  });
  it('offset 산술을 하지 않는다 — 반환값에 T·offset 이 붙지 않는다', () => {
    expect(normalizePeriodStartInput('2026-08-01')).not.toMatch(/[T+Z]/);
  });
  it('달력상 불가능한 날짜는 null (negative — 2/30 · 13 월 · 평년 2/29)', () => {
    expect(normalizePeriodStartInput('2026-02-30')).toBeNull();
    expect(normalizePeriodStartInput('2026-13-01')).toBeNull();
    expect(normalizePeriodStartInput('2025-02-29')).toBeNull();
  });
  it('zero-pad 누락 · 시각 포함 형식은 null (negative)', () => {
    expect(normalizePeriodStartInput('2026-8-1')).toBeNull();
    expect(normalizePeriodStartInput('2026-08-01T00:00:00+09:00')).toBeNull();
  });
  it('빈 문자열 · 공백만 · 비문자열은 null (negative)', () => {
    expect(normalizePeriodStartInput('')).toBeNull();
    expect(normalizePeriodStartInput('   ')).toBeNull();
    expect(normalizePeriodStartInput(20260801)).toBeNull();
    expect(normalizePeriodStartInput(null)).toBeNull();
    expect(normalizePeriodStartInput(undefined)).toBeNull();
  });
  it('무효 입력에서도 throw 하지 않는다 (error path)', () => {
    expect(() => normalizePeriodStartInput({ any: 'thing' })).not.toThrow();
  });
});

describe('buildPeriodEvaluationRequest — happy path · 분기', () => {
  it('정상 입력에서 기대 path 와 4 키 body 를 반환한다', () => {
    expect(buildPeriodEvaluationRequest(VALID_INPUT)).toEqual({
      path: PERIOD_EVALUATION_PATH,
      body: { ...VALID_INPUT, scope: 'aggregate' },
    });
  });
  it('scope 미지정이면 기본값, 명시하면 그 값 (2 분기)', () => {
    expect(withInput({})?.body.scope).toBe(DEFAULT_EVALUATION_SCOPE);
    expect(withInput({ scope: 'commit' })?.body.scope).toBe('commit');
  });
  it('reevaluate 는 엄격히 true 일 때만 body 에 실린다 (3 분기)', () => {
    expect('reevaluate' in (withInput({})?.body ?? {})).toBe(false);
    expect('reevaluate' in (withInput({ reevaluate: false })?.body ?? {})).toBe(false);
    expect(withInput({ reevaluate: true })?.body.reevaluate).toBe(true);
  });
  it('period 3 종이 모두 body 에 그대로 실린다', () => {
    for (const option of EVALUATION_PERIOD_OPTIONS) {
      expect(withInput({ period: option.value })?.body.period).toBe(option.value);
    }
  });
  it('입력 인자를 mutate 하지 않는다', () => {
    const input = { ...VALID_INPUT, reevaluate: true };
    buildPeriodEvaluationRequest(input);
    expect(input).toEqual({ ...VALID_INPUT, reevaluate: true });
  });
});

describe('buildPeriodEvaluationRequest — negative cases', () => {
  it('personId 가 빈 문자열 · 공백만이면 null (a)', () => {
    expect(withInput({ personId: '' })).toBeNull();
    expect(withInput({ personId: '   ' })).toBeNull();
  });
  it('personId 가 비문자열이면 null (b)', () => {
    expect(withInput({ personId: 7 })).toBeNull();
    expect(withInput({ personId: null })).toBeNull();
  });
  it('period 가 허용 밖 · 대소문자 위반 · 미지정이면 null (c · d)', () => {
    expect(withInput({ period: 'year' })).toBeNull();
    expect(withInput({ period: 'DAY' })).toBeNull();
    expect(withInput({ period: undefined })).toBeNull();
  });
  it('periodStart 가 불가능 날짜 · zero-pad 누락 · 빈 문자열이면 null (e · f · g)', () => {
    expect(withInput({ periodStart: '2026-02-30' })).toBeNull();
    expect(withInput({ periodStart: '2026-8-1' })).toBeNull();
    expect(withInput({ periodStart: '' })).toBeNull();
  });
  it('scope 가 허용 밖 literal 이면 fail-closed 로 null', () => {
    expect(withInput({ scope: 'team' })).toBeNull();
    expect(withInput({ scope: null })).toBeNull();
  });
  it('null · undefined · 비객체 입력은 null (h)', () => {
    expect(buildPeriodEvaluationRequest(null)).toBeNull();
    expect(buildPeriodEvaluationRequest(undefined)).toBeNull();
    expect(buildPeriodEvaluationRequest('2026-08-01')).toBeNull();
    expect(buildPeriodEvaluationRequest([])).toBeNull();
  });
  it('정의 외 키는 body 로 새지 않는다 (i)', () => {
    const request = withInput({ mode: 'reeval', modelId: 'm-1', reevaluate: true });
    expect(request?.body).toEqual({ ...VALID_INPUT, scope: 'aggregate', reevaluate: true });
  });
  it('어떤 무효 입력에서도 throw 하지 않는다 (error path)', () => {
    expect(() => buildPeriodEvaluationRequest(undefined)).not.toThrow();
    expect(() => buildPeriodEvaluationRequest({ personId: {} })).not.toThrow();
  });
});

describe('drift guard — backend PeriodBridgeDto 계약', () => {
  it('body 키 집합이 계약 5 키를 벗어나지 않는다', () => {
    const contract = ['personId', 'period', 'scope', 'periodStart', 'reevaluate'];
    const minimal = buildPeriodEvaluationRequest(VALID_INPUT);
    const maximal = withInput({ scope: 'document', reevaluate: true });
    expect(Object.keys(minimal?.body ?? {})).toEqual(contract.slice(0, 4));
    expect(Object.keys(maximal?.body ?? {}).sort()).toEqual([...contract].sort());
  });
});
