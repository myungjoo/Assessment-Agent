import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// R-112 — T-1735 (REQ-077, PLAN 131 행 ④) DashboardView ↔ 기간 지정 평가 요청 배선 검증.
// jsdom/@testing-library 미사용(ADR-0040 §5 게이트, T-1723 전용 spec 관례 승계) — useApiResource
// 를 vi.mock 으로 치환해 조회 상태를 통제하고 renderToStaticMarkup 정적 마크업으로 마운트 분기를
// 단언하며, 상태 전이가 걸린 제출 경로는 컨테이너가 export 한 순수/주입 가능 함수
// (derivePeriodEvaluationNotice · runPeriodEvaluation)를 직접 호출해 happy/error/분기/negative 를
// 네트워크 없이 cover 한다. 제출 모듈(periodEvaluationSubmit)도 mock 으로 치환해 실 fetch 0.

import type { ApiResourceState } from '../api/useApiResource';
import type { PeriodEvaluationRequest } from '../api/evaluationPeriod';
import { buildSelectionRequest } from '../components/DashboardPeriodSelector';

// useApiResource mock — path 별로 서로 다른 상태를 주입한다(조회 간 상태 오염 차단 검증).
const useApiResourceMock = vi.fn();
vi.mock('../api/useApiResource', () => ({
  useApiResource: (...args: unknown[]) => useApiResourceMock(...args),
}));

// 제출 모듈 mock — runPeriodEvaluation 의 기본 인자 경로(주입 생략)가 실제로
// submitPeriodEvaluation 을 경유하는지까지 검증하면서 네트워크는 타지 않는다.
const submitMock = vi.fn();
vi.mock('../api/periodEvaluationSubmit', () => ({
  submitPeriodEvaluation: (...args: unknown[]) => submitMock(...args),
}));

import DashboardView, {
  derivePeriodEvaluationNotice,
  runPeriodEvaluation,
} from './DashboardView';

const IDLE: ApiResourceState<unknown> = {
  data: undefined,
  loading: false,
  error: undefined,
};

// 인원 목록(/api/persons) 조회에만 주입 상태를 반환하고 나머지 조회는 idle 로 둔다.
function setPersons(persons: ApiResourceState<unknown>) {
  useApiResourceMock.mockImplementation((path: string | null) => {
    if (typeof path === 'string' && path.startsWith('/api/persons')) {
      return persons;
    }
    return IDLE;
  });
}

// 기간 컨트롤(T-1733)의 사람-친화 라벨/문구 토큰 — 컴포넌트 상수와 같아야 배선이 성립한다.
const PERIOD_FIELD_LABEL = '평가 기간 종류';
const PERIOD_PLACEHOLDER_LABEL = '기간을 선택하세요';
const START_FIELD_LABEL = '기간 시작일';
const SUBMIT_LABEL = '기간 평가 요청';
const SUBMITTING_TEXT = '평가 요청 중…';
const SUCCESS_PREFIX = '기간 평가 요청을 완료했습니다';
const UNKNOWN_NOTICE = '평가 요청 결과를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.';

const PERSON_SAMPLE = [
  { id: 'p1', fullName: '김철수', email: 'chulsoo@example.com', active: true },
];

// 컨트롤이 실제로 조립하는 request — 컨테이너가 "받은 그대로" 넘기는지 확인할 기준값이다.
const VALID_REQUEST = buildSelectionRequest({
  personId: 'p1',
  period: 'week',
  periodStart: '2026-08-24',
}) as PeriodEvaluationRequest;

describe('DashboardView — 기간 지정 평가 요청 배선 (T-1735, REQ-077)', () => {
  beforeEach(() => {
    useApiResourceMock.mockReset();
    submitMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('마운트 분기', () => {
    // 분기 (a) — personId 선택 분기에서만 컨트롤이 렌더된다.
    it('personId 선택 분기에서 기간 컨트롤을 마운트한다 (happy-path — 렌더 배선)', () => {
      setPersons({ data: PERSON_SAMPLE, loading: false, error: undefined });
      const html = renderToStaticMarkup(<DashboardView personId="p1" />);
      expect(html).toContain(PERIOD_FIELD_LABEL);
      expect(html).toContain(PERIOD_PLACEHOLDER_LABEL);
      expect(html).toContain(START_FIELD_LABEL);
      expect(html).toContain(SUBMIT_LABEL);
      // 기간 컨트롤은 자료 영역(요약 지표) 앞에 온다 — 요청 수단이 표 아래로 숨지 않는다.
      expect(html.indexOf(PERIOD_FIELD_LABEL)).toBeLessThan(html.indexOf('평가 결과 선택'));
    });

    // 분기 (a) 반대편 — 대상 미선택이면 요청 자체가 조립 불가라 컨트롤을 렌더하지 않는다.
    it('personId 미선택 분기에서는 기간 컨트롤을 렌더하지 않는다 (분기 — 미선택)', () => {
      setPersons({ data: PERSON_SAMPLE, loading: false, error: undefined });
      const html = renderToStaticMarkup(<DashboardView />);
      expect(html).not.toContain(PERIOD_FIELD_LABEL);
      expect(html).not.toContain(SUBMIT_LABEL);
      // 미선택 안내와 인원 선택 컨트롤은 종전대로 유지된다(T-1723 회귀 0).
      expect(html).toContain('평가 대상을 선택하면');
      expect(html).toContain('평가 대상 인원');
    });

    // 초기 상태 — 제출 전에는 진행 중/성공/실패 표식이 하나도 없다.
    it('초기 마운트에는 진행 중·성공·실패 문구가 없다 (분기 — 초기 상태)', () => {
      setPersons({ data: PERSON_SAMPLE, loading: false, error: undefined });
      const html = renderToStaticMarkup(<DashboardView personId="p1" />);
      expect(html).not.toContain(SUBMITTING_TEXT);
      expect(html).not.toContain(SUCCESS_PREFIX);
      expect(html).not.toContain('role="alert"');
      // 제출은 사용자 상호작용으로만 일어난다 — 렌더만으로 POST 가 나가면 안 된다.
      expect(submitMock).not.toHaveBeenCalled();
    });

    // negative (5) — 인원 목록 조회가 error 여도 기간 컨트롤 배선이 깨지지 않는다.
    it('인원 목록 조회가 error 인 상태에서도 기간 컨트롤을 렌더한다 (negative — 상류 조회 실패)', () => {
      setPersons({ data: undefined, loading: false, error: '목록 조회 실패' });
      const render = () => renderToStaticMarkup(<DashboardView personId="p1" />);
      expect(render).not.toThrow();
      const html = render();
      expect(html).toContain(PERIOD_FIELD_LABEL);
      expect(html).toContain(SUBMIT_LABEL);
      expect(html).toContain('목록 조회 실패');
    });
  });

  describe('derivePeriodEvaluationNotice — 결과 문구 파생', () => {
    // happy-path + 성공 분기 (건수형) — User 분기의 ephemeral 결과.
    it('건수형 성공 outcome 을 건수 문구로 파생한다 (happy-path — 건수 분기)', () => {
      const notice = derivePeriodEvaluationNotice({
        status: 'ok',
        assessmentId: null,
        created: null,
        resultCount: 3,
      });
      expect(notice.success).toContain('평가 결과 3건');
      expect(notice.error).toBe('');
    });

    // 성공 분기 (assessmentId 형) — created 3 값(true/false/null)이 각각 다른 꼬리를 만든다.
    it('assessmentId 형 성공 outcome 을 식별자·생성 여부 문구로 파생한다 (분기 — 식별자 분기)', () => {
      const created = derivePeriodEvaluationNotice({
        status: 'ok',
        assessmentId: 'a-1',
        created: true,
        resultCount: null,
      });
      expect(created.success).toContain('평가 ID a-1');
      expect(created.success).toContain('신규 생성');
      const reused = derivePeriodEvaluationNotice({
        status: 'ok',
        assessmentId: 'a-1',
        created: false,
        resultCount: null,
      });
      expect(reused.success).toContain('기존 결과 재사용');
      const unknownCreated = derivePeriodEvaluationNotice({
        status: 'ok',
        assessmentId: 'a-1',
        created: null,
        resultCount: null,
      });
      expect(unknownCreated.success).toContain('평가 ID a-1');
      expect(unknownCreated.success).not.toContain('신규 생성');
      expect(unknownCreated.error).toBe('');
    });

    // negative (4) + 성공 분기 (미상형) — 식별자·건수가 모두 null 이어도 성공은 성공이다.
    it('식별자·건수가 모두 null 인 성공 outcome 도 완료 문구로 파생한다 (negative — 미상형)', () => {
      const notice = derivePeriodEvaluationNotice({
        status: 'ok',
        assessmentId: null,
        created: null,
        resultCount: null,
      });
      expect(notice.success).toBe(`${SUCCESS_PREFIX}.`);
      expect(notice.success).not.toContain('건');
      expect(notice.error).toBe('');
    });

    // error path — 모듈이 준 한국어 사유를 가공 없이 그대로 전달하고 성공 문구는 비운다.
    it('실패 outcome 의 사유를 그대로 전달한다 (error path — 실패 분기)', () => {
      const notice = derivePeriodEvaluationNotice({
        status: 'error',
        message: '인증이 만료되었습니다. 다시 로그인한 뒤 시도해 주세요.',
      });
      expect(notice.error).toBe('인증이 만료되었습니다. 다시 로그인한 뒤 시도해 주세요.');
      expect(notice.success).toBe('');
    });

    // negative (3) — 실패 사유가 빈 값/공백/비문자열이면 fallback 문구로 대체한다.
    it('실패 사유가 빈 값·공백·비문자열이면 fallback 문구를 쓴다 (negative — 빈 사유)', () => {
      expect(derivePeriodEvaluationNotice({ status: 'error', message: '' }).error).toBe(
        UNKNOWN_NOTICE,
      );
      expect(derivePeriodEvaluationNotice({ status: 'error', message: '   ' }).error).toBe(
        UNKNOWN_NOTICE,
      );
      const nonString = derivePeriodEvaluationNotice({ status: 'error', message: 42 });
      expect(nonString.error).toBe(UNKNOWN_NOTICE);
      expect(nonString.success).toBe('');
    });

    // negative (1) — null/undefined 를 성공으로 오인하지 않는다.
    it('outcome 이 null·undefined 면 성공으로 오인하지 않는다 (negative — 결손 outcome)', () => {
      for (const value of [null, undefined]) {
        const notice = derivePeriodEvaluationNotice(value);
        expect(notice.success).toBe('');
        expect(notice.error).toBe(UNKNOWN_NOTICE);
      }
    });

    // negative (2) — 알 수 없는 shape(원시값·빈 객체·미지의 status·배열)도 값으로 흡수한다.
    it('알 수 없는 shape 의 outcome 을 fallback 실패로 흡수한다 (negative — 미지 shape)', () => {
      for (const value of ['ok', 42, true, {}, { status: 'weird' }, []]) {
        const notice = derivePeriodEvaluationNotice(value);
        expect(notice.success).toBe('');
        expect(notice.error).toBe(UNKNOWN_NOTICE);
      }
    });

    // 순수성 — 입력 mutation 0 · throw 0.
    it('입력 outcome 을 변형하지 않는다 (순수 — mutation 0)', () => {
      const outcome = { status: 'ok', assessmentId: 'a-9', created: true, resultCount: null };
      const snapshot = { ...outcome };
      expect(() => derivePeriodEvaluationNotice(outcome)).not.toThrow();
      expect(outcome).toEqual(snapshot);
    });
  });

  describe('runPeriodEvaluation — 제출 실행', () => {
    // happy-path — 컨트롤이 조립한 request 그대로 제출 모듈이 1 회 호출되고 성공 문구가 나온다.
    it('컨트롤이 조립한 request 그대로 제출 모듈을 1 회 호출한다 (happy-path — 제출 배선)', async () => {
      submitMock.mockResolvedValue({
        status: 'ok',
        assessmentId: null,
        created: null,
        resultCount: 2,
      });
      const notice = await runPeriodEvaluation(VALID_REQUEST);
      expect(submitMock).toHaveBeenCalledTimes(1);
      expect(submitMock.mock.calls[0][0]).toBe(VALID_REQUEST);
      expect(submitMock.mock.calls[0][0]).toEqual({
        path: '/api/assessment-evaluation/period',
        body: {
          personId: 'p1',
          period: 'week',
          scope: 'aggregate',
          periodStart: '2026-08-24',
        },
      });
      expect(notice.success).toContain('평가 결과 2건');
      expect(notice.error).toBe('');
    });

    // error path — 모듈이 error outcome 을 돌려줘도 throw 0, 실패 문구만 남는다.
    it('제출 모듈이 error outcome 을 반환해도 throw 하지 않고 실패 문구를 파생한다 (error path)', async () => {
      submitMock.mockResolvedValue({ status: 'error', message: '권한이 없습니다.' });
      const notice = await runPeriodEvaluation(VALID_REQUEST, submitMock);
      expect(notice.error).toBe('권한이 없습니다.');
      expect(notice.success).toBe('');
    });

    // negative (6) — 주입 구현이 reject 해도 컨테이너가 삼키고 실패 문구로 떨어뜨린다.
    it('제출이 reject 해도 삼키고 실패 문구로 떨어뜨린다 (negative — reject 흡수)', async () => {
      submitMock.mockRejectedValue(new Error('boom'));
      const notice = await runPeriodEvaluation(VALID_REQUEST);
      expect(notice.success).toBe('');
      expect(notice.error).toBe(UNKNOWN_NOTICE);
    });

    // negative — resolve 값이 결손(undefined)이어도 성공으로 오인하지 않는다.
    it('제출이 undefined 를 resolve 해도 성공으로 오인하지 않는다 (negative — 결손 응답)', async () => {
      submitMock.mockResolvedValue(undefined);
      const notice = await runPeriodEvaluation(VALID_REQUEST, submitMock);
      expect(notice.success).toBe('');
      expect(notice.error).toBe(UNKNOWN_NOTICE);
    });
  });
});
