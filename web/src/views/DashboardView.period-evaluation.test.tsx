import { readFileSync } from 'node:fs';
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
  shouldReloadAfterPeriodEvaluation,
  invokeResourceReload,
  reloadAfterPeriodEvaluation,
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

    // 경계값 — 0 건 성공은 "결과 없음" 이 아니라 0 건을 명시하고, NaN 건수는 건수형으로
    // 오인하지 않고 미상형으로 떨어진다(숫자처럼 생긴 비수치 방어).
    it('건수 0 은 0건으로 알리고 NaN 건수는 미상형으로 떨어뜨린다 (negative — 건수 경계값)', () => {
      const zero = derivePeriodEvaluationNotice({
        status: 'ok',
        assessmentId: null,
        created: null,
        resultCount: 0,
      });
      expect(zero.success).toContain('평가 결과 0건');
      expect(zero.error).toBe('');
      const nan = derivePeriodEvaluationNotice({
        status: 'ok',
        assessmentId: null,
        created: null,
        resultCount: Number.NaN,
      });
      expect(nan.success).toBe(`${SUCCESS_PREFIX}.`);
      expect(nan.error).toBe('');
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

// R-112 — T-1737 (REQ-077 slice 5b) 기간 평가 성공 후 결과 재조회 배선 검증. 상호작용
// 이벤트가 필요한 경로는 jsdom 없이 재현할 수 없으므로, 컨테이너의 handlePeriodSubmit 이
// 실제로 수행하는 조합(runPeriodEvaluation → reloadAfterPeriodEvaluation)을 그대로 호출해
// happy/error/분기/negative 를 cover 한다.
describe('DashboardView — 기간 평가 성공 후 재조회 배선 (T-1737, REQ-077)', () => {
  beforeEach(() => {
    useApiResourceMock.mockReset();
    submitMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 컨테이너가 실제로 넘기는 성공 notice 모양 — derive 결과와 같은 shape 을 쓴다.
  const SUCCESS_NOTICE = { success: `${SUCCESS_PREFIX}.`, error: '' };
  const FAILURE_NOTICE = { success: '', error: UNKNOWN_NOTICE };

  describe('shouldReloadAfterPeriodEvaluation — 재조회 여부 판정', () => {
    // 분기 ① — 성공 문구만 존재하면 재조회 대상이다(happy-path).
    it('성공 문구만 있으면 true 를 돌려준다 (happy-path — 성공 분기)', () => {
      expect(shouldReloadAfterPeriodEvaluation(SUCCESS_NOTICE)).toBe(true);
      expect(
        shouldReloadAfterPeriodEvaluation(
          derivePeriodEvaluationNotice({ status: 'ok', resultCount: 3 }),
        ),
      ).toBe(true);
    });

    // 분기 ② — 에러 문구만 존재하면 재조회하지 않는다(error path).
    it('에러 문구만 있으면 false 를 돌려준다 (error path — 실패 분기)', () => {
      expect(shouldReloadAfterPeriodEvaluation(FAILURE_NOTICE)).toBe(false);
      expect(
        shouldReloadAfterPeriodEvaluation(
          derivePeriodEvaluationNotice({ status: 'error', message: '권한이 없습니다.' }),
        ),
      ).toBe(false);
    });

    // 분기 ③ — 초기 상태(둘 다 빈 값)에서는 재조회하지 않는다.
    it('성공·실패 문구가 모두 비어 있으면 false 다 (분기 — 초기 상태)', () => {
      expect(shouldReloadAfterPeriodEvaluation({ success: '', error: '' })).toBe(false);
      expect(shouldReloadAfterPeriodEvaluation({ success: '   ', error: '' })).toBe(false);
    });

    // 분기 ④ — 방어적으로, 둘 다 존재하는 모순 상태에서는 재조회하지 않는다.
    it('성공·실패 문구가 모두 존재하면 false 다 (분기 — 방어적 모순 상태)', () => {
      expect(shouldReloadAfterPeriodEvaluation({ success: '완료', error: '그런데 실패' })).toBe(
        false,
      );
    });

    // negative ① — null/undefined 를 성공으로 오인하지 않는다.
    it('notice 가 null·undefined 면 false 다 (negative — 결손 notice)', () => {
      for (const value of [null, undefined]) {
        expect(shouldReloadAfterPeriodEvaluation(value)).toBe(false);
      }
    });

    // negative ② — 문자열·숫자 등 비객체 입력도 값으로 흡수한다.
    it('notice 가 비객체면 false 다 (negative — 비객체 입력)', () => {
      for (const value of ['완료', 42, true, Symbol('x'), () => undefined]) {
        expect(shouldReloadAfterPeriodEvaluation(value)).toBe(false);
      }
      // 배열·빈 객체도 성공 문구가 없으므로 재조회 대상이 아니다.
      expect(shouldReloadAfterPeriodEvaluation([])).toBe(false);
      expect(shouldReloadAfterPeriodEvaluation({})).toBe(false);
    });

    // negative ③ — success/error 가 문자열이 아닌 타입인 미지 shape.
    it('success·error 가 문자열이 아니면 false 다 (negative — 타입 mismatch)', () => {
      expect(shouldReloadAfterPeriodEvaluation({ success: 1, error: '' })).toBe(false);
      expect(shouldReloadAfterPeriodEvaluation({ success: true, error: '' })).toBe(false);
      expect(shouldReloadAfterPeriodEvaluation({ success: '완료', error: 42 })).toBe(false);
      expect(shouldReloadAfterPeriodEvaluation({ success: '완료', error: {} })).toBe(false);
      // error 키 자체가 없거나 null 이면 "실패 없음" 으로 읽어 재조회한다.
      expect(shouldReloadAfterPeriodEvaluation({ success: '완료' })).toBe(true);
      expect(shouldReloadAfterPeriodEvaluation({ success: '완료', error: null })).toBe(true);
    });

    // 순수성 — 입력 mutation 0 · throw 0.
    it('입력 notice 를 변형하지 않는다 (순수 — mutation 0)', () => {
      const notice = { success: '완료', error: '' };
      const snapshot = { ...notice };
      expect(() => shouldReloadAfterPeriodEvaluation(notice)).not.toThrow();
      expect(notice).toEqual(snapshot);
    });
  });

  describe('invokeResourceReload — 재조회 수단 호출 흡수', () => {
    // happy-path — 함수면 1 회 호출하고 true 를 돌려준다.
    it('함수 handle 을 1 회 호출한다 (happy-path)', () => {
      const reload = vi.fn();
      expect(invokeResourceReload(reload)).toBe(true);
      expect(reload).toHaveBeenCalledTimes(1);
    });

    // negative ④⑤ — undefined handle · 비함수 값 모두 값으로 흡수한다.
    it('함수가 아닌 값은 호출 없이 false 로 흡수한다 (negative — 비함수 handle)', () => {
      for (const value of [undefined, null, 'reload', 42, {}, []]) {
        expect(() => invokeResourceReload(value)).not.toThrow();
        expect(invokeResourceReload(value)).toBe(false);
      }
    });

    // negative — reload 자체가 throw 해도 컨테이너로 전파하지 않는다.
    it('reload 가 throw 해도 삼키고 false 를 돌려준다 (negative — throw 흡수)', () => {
      const boom = vi.fn(() => {
        throw new Error('boom');
      });
      expect(() => invokeResourceReload(boom)).not.toThrow();
      expect(invokeResourceReload(boom)).toBe(false);
      expect(boom).toHaveBeenCalledTimes(2);
    });
  });

  describe('reloadAfterPeriodEvaluation — 성공 시에만 재조회', () => {
    // happy-path — 성공 notice 면 assessments·summaries 재조회가 각각 1 회.
    it('성공 notice 면 두 재조회를 각각 1 회 호출한다 (happy-path — 재조회 배선)', () => {
      const reload = vi.fn();
      const trendReload = vi.fn();
      expect(reloadAfterPeriodEvaluation(SUCCESS_NOTICE, [reload, trendReload])).toBe(2);
      expect(reload).toHaveBeenCalledTimes(1);
      expect(trendReload).toHaveBeenCalledTimes(1);
      expect(reload).toHaveBeenCalledWith();
    });

    // error path — 실패 notice 면 호출 0 회(실패 후 표가 흔들리지 않는다).
    it('실패 notice 면 재조회를 호출하지 않는다 (error path — 호출 0)', () => {
      const reload = vi.fn();
      const trendReload = vi.fn();
      expect(reloadAfterPeriodEvaluation(FAILURE_NOTICE, [reload, trendReload])).toBe(0);
      expect(reload).not.toHaveBeenCalled();
      expect(trendReload).not.toHaveBeenCalled();
    });

    // happy-path (조합) — 컨테이너 handlePeriodSubmit 과 같은 순서로 실제 제출을 태운다.
    it('제출 성공 흐름 전체에서 재조회가 각각 1 회 일어난다 (happy-path — 제출→재조회 조합)', async () => {
      submitMock.mockResolvedValue({ status: 'ok', assessmentId: 'a-1', created: true });
      const reload = vi.fn();
      const trendReload = vi.fn();
      const notice = await runPeriodEvaluation(VALID_REQUEST);
      expect(reloadAfterPeriodEvaluation(notice, [reload, trendReload])).toBe(2);
      expect(reload).toHaveBeenCalledTimes(1);
      expect(trendReload).toHaveBeenCalledTimes(1);
    });

    // error path + negative ⑥ — 제출이 reject 한 뒤에도 throw 0 이고 재조회 호출 0 회.
    it('제출이 reject 하면 throw 없이 재조회 호출 0 회다 (error path — reject 흡수)', async () => {
      submitMock.mockRejectedValue(new Error('boom'));
      const reload = vi.fn();
      const trendReload = vi.fn();
      const notice = await runPeriodEvaluation(VALID_REQUEST);
      expect(() => reloadAfterPeriodEvaluation(notice, [reload, trendReload])).not.toThrow();
      expect(reload).not.toHaveBeenCalled();
      expect(trendReload).not.toHaveBeenCalled();
    });

    // negative ④⑤ — reload 가 미주입·비함수인 handle 조합에서도 throw 0.
    it('reload 가 미주입·비함수여도 throw 하지 않는다 (negative — 구 mock 호환)', () => {
      expect(() => reloadAfterPeriodEvaluation(SUCCESS_NOTICE, [undefined, 'reload'])).not.toThrow();
      expect(reloadAfterPeriodEvaluation(SUCCESS_NOTICE, [undefined, 'reload'])).toBe(0);
      // 일부만 함수인 혼합 조합에서도 함수인 쪽만 호출된다.
      const reload = vi.fn();
      expect(reloadAfterPeriodEvaluation(SUCCESS_NOTICE, [reload, undefined])).toBe(1);
      expect(reload).toHaveBeenCalledTimes(1);
    });

    // 경계 — 빈 재조회 목록이어도 성공 판정과 무관하게 0 이고 throw 0.
    it('재조회 목록이 비어도 0 을 돌려준다 (negative — 빈 목록)', () => {
      expect(reloadAfterPeriodEvaluation(SUCCESS_NOTICE, [])).toBe(0);
    });
  });

  describe('컨테이너 호환성 — reload 미제공 mock', () => {
    // 호환성 게이트 — 기존 3 개 spec 의 mock 은 reload 없는 상태 객체를 돌려준다.
    // 그 상태에서도 마운트가 throw 하지 않고 렌더가 종전과 같아야 한다.
    it('reload 없는 mock 상태에서도 마운트가 throw 하지 않는다 (negative — 구 mock 호환)', () => {
      setPersons({ data: PERSON_SAMPLE, loading: false, error: undefined });
      const render = () => renderToStaticMarkup(<DashboardView personId="p1" />);
      expect(render).not.toThrow();
      expect(render()).toContain(SUBMIT_LABEL);
    });

    // 렌더만으로는 재조회가 일어나지 않는다 — 재조회는 제출 성공 시에만.
    it('마운트만으로는 reload 를 호출하지 않는다 (분기 — 부수효과 0)', () => {
      const reload = vi.fn();
      useApiResourceMock.mockImplementation((path: string | null) => {
        if (typeof path === 'string' && path.startsWith('/api/persons')) {
          return { data: PERSON_SAMPLE, loading: false, error: undefined, reload };
        }
        return { ...IDLE, reload };
      });
      expect(() => renderToStaticMarkup(<DashboardView personId="p1" />)).not.toThrow();
      expect(reload).not.toHaveBeenCalled();
      expect(submitMock).not.toHaveBeenCalled();
    });
  });
});

// reviewer MINOR-1 (round 1) closure — §3 Nit-in-PR. 배선 자체(두 호출부의 reload 구조분해 +
// 제출 완료 분기의 재조회 호출)는 jsdom 부재로 실행 경로가 test 에 안 걸린다. 같은 파일군이
// 이미 쓰는 source 정적 대조 guard 관례(DashboardView.assessments-list-contract.test.ts)를
// 승계해 호출 한 줄이 지워지면 CI 가 red 가 되도록 못박는다. 새 dependency 0.
describe('DashboardView — 재조회 배선 source guard (T-1737, reviewer MINOR-1)', () => {
  // 주석 안의 동일 문자열이 대조를 통과시키지 않도록 라인 주석을 제거한 소스로 본다.
  const SOURCE = readFileSync(
    new URL('./DashboardView.tsx', import.meta.url),
    'utf-8',
  )
    .split('\n')
    .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
    .join('\n');

  // AC 1 — assessments 조회가 reload 를 구조분해한다(무-alias 관례 유지).
  it('assessments 조회부가 reload 를 구조분해한다 (happy-path — 배선 1)', () => {
    expect(SOURCE).toMatch(
      /const \{ data, loading, error, reload \} = useApiResource<unknown\[\]>\(path\)/,
    );
  });

  // AC 1 — summaries 조회가 trend prefix alias 로 reload 를 구조분해한다(상태 오염 차단).
  it('summaries 조회부가 trendReload alias 로 구조분해한다 (happy-path — 배선 2)', () => {
    // T-1789 — 컨테이너가 응답을 특정 행 타입으로 단정하지 않게 되어(<unknown[]>) 타입 인자
    // 부분만 갱신한다. `reload: trendReload` alias 검사 의미는 그대로라 이 줄이 지워지면 여전히 fail 한다.
    expect(SOURCE).toMatch(/reload: trendReload,\s*\n\s*\} = useApiResource<unknown\[\]>/);
  });

  // AC 2 — 제출 완료 분기가 두 재조회를 함께 넘겨 호출한다. 이 한 줄이 지워지면 fail 한다.
  it('제출 완료 분기가 두 재조회를 넘겨 호출한다 (happy-path — 배선 3)', () => {
    expect(SOURCE).toContain('reloadAfterPeriodEvaluation(notice, [reload, trendReload]);');
  });

  // 범위 게이트 — 나머지 3 개 조회(contributions · permission-denied · persons)는 diff 0 이라
  // reload 를 구조분해하지 않는다. 무분별한 재조회 확산을 막는 negative 축이다.
  it('나머지 3 개 조회는 reload 를 구조분해하지 않는다 (negative — 범위 확산 차단)', () => {
    for (const alias of ['contributionReload', 'permissionDeniedReload', 'personsReload']) {
      expect(SOURCE).not.toContain(alias);
    }
    // 재조회 호출은 제출 완료 분기 1 곳뿐이다(중복 배선·렌더 중 호출 차단).
    expect(SOURCE.match(/reloadAfterPeriodEvaluation\(notice, \[/g)).toHaveLength(1);
  });
});
