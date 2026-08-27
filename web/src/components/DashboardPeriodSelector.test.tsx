import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DashboardPeriodSelector, {
  buildSelectionRequest, submitPeriodChange, submitPeriodSelection,
} from './DashboardPeriodSelector';
import {
  DEFAULT_EVALUATION_SCOPE, EVALUATION_PERIOD_OPTIONS, PERIOD_EVALUATION_PATH,
} from '../api/evaluationPeriod';

// R-112 — REQ-077(기간 지정 평가 UI) presentational slice 검증. DashboardPersonSelector.test.tsx 와
// 동일 패턴: jsdom·@testing-library 없이 react-dom/server 의 renderToStaticMarkup 으로 정적 렌더 문자열만
// 검증해 dep 표면 증가를 0 으로 둔다. 이벤트가 발화되지 않으므로 콜백 계약은 순수 export 함수를 직접
// 호출해 검증한다. 파일명은 .test.tsx 고정(root jest testRegex pickup 충돌 회피).

// 유효한 완성 선택 — happy-path 기준값. 렌더 필수 콜백은 noopHandlers 로 묶어 재사용한다.
const validSelection = { personId: 'p1', period: 'week', periodStart: '2026-08-03' };
const noop = () => {};
const noopHandlers = { onChangePeriod: noop, onChangePeriodStart: noop, onSubmit: noop };
const renderValid = (extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(<DashboardPeriodSelector {...validSelection} {...noopHandlers} {...extra} />);

describe('DashboardPeriodSelector', () => {
  it('유효한 선택에서 기간 옵션 3 종과 날짜 입력을 렌더하고 선택값을 반영하며 제출 버튼이 활성이다 (happy-path)', () => {
    const html = renderValid();
    expect(html).toContain('평가 기간 종류');
    expect(html).toContain('name="period"');
    // placeholder + 계약 옵션 3 종, 선택된 week 만 selected.
    expect((html.match(/<option /g) ?? []).length).toBe(EVALUATION_PERIOD_OPTIONS.length + 1);
    expect(html).toContain('value="week" selected=""');
    expect((html.match(/selected=""/g) ?? []).length).toBe(1);
    // 날짜 컨트롤은 type="date" 이고 입력값이 timezone 산술 없이 그대로 실린다.
    expect(html).toContain('type="date"');
    expect(html).toContain('name="periodStart"');
    expect(html).toContain('value="2026-08-03"');
    expect(html).not.toContain('+09:00');
    // 유효 입력이므로 제출 버튼 활성 + 진행/에러 영역 없음.
    expect(html).toContain('기간 평가 요청');
    expect(html).not.toContain('disabled=""');
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('role="status"');
  });

  it('submitPeriodSelection 은 계약 path 와 personId/period/scope/periodStart 4 키 body 로 onSubmit 을 1 회 호출한다 (happy-path — 순수 함수)', () => {
    const onSubmit = vi.fn();
    expect(submitPeriodSelection(validSelection, onSubmit)).toBe(true);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      path: PERIOD_EVALUATION_PATH,
      body: { ...validSelection, scope: DEFAULT_EVALUATION_SCOPE },
    });
  });

  it('buildSelectionRequest 는 유효 선택에서 request 를 조립하고 submitPeriodChange 는 허용 literal 을 그대로 발사한다 (happy-path — 순수 함수)', () => {
    const request = buildSelectionRequest(validSelection);
    expect(request?.path).toBe(PERIOD_EVALUATION_PATH);
    expect(request?.body.period).toBe('week');
    const onChangePeriod = vi.fn();
    expect(submitPeriodChange('day', onChangePeriod)).toBe(true);
    expect(onChangePeriod).toHaveBeenCalledTimes(1);
    expect(onChangePeriod).toHaveBeenCalledWith('day');
  });

  it('무효 선택·비객체 입력에서 조립 함수들이 throw 없이 null/false 를 반환한다 (error path — 값으로 흡수)', () => {
    expect(() => buildSelectionRequest({ personId: 'p1' })).not.toThrow();
    expect(buildSelectionRequest({ personId: 'p1' })).toBeNull();
    expect(buildSelectionRequest(null)).toBeNull();
    expect(buildSelectionRequest('문자열')).toBeNull();
    const onSubmit = vi.fn();
    expect(submitPeriodSelection({ personId: 'p1' }, onSubmit)).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('error 전달 시 role="alert" 로 문구를 렌더하면서도 기간·날짜 컨트롤을 그대로 유지한다 (error path — 에러가 수단을 삼키지 않음)', () => {
    const html = renderValid({ error: '요청 실패' });
    expect(html).toContain('role="alert"');
    expect(html).toContain('요청 실패');
    expect(html).toContain('name="period"');
    expect(html).toContain('name="periodStart"');
    expect(html.indexOf('role="alert"')).toBeLessThan(html.indexOf('<select '));
    // 빈 문자열 error 는 falsy 라 alert 영역이 자리를 차지하지 않는다(경계값 분기).
    expect(renderValid({ error: '' })).not.toContain('role="alert"');
  });

  it('submitting=true 면 제출 버튼이 비활성되고 진행 문구가 노출되며 false 면 둘 다 아니다 (branch — submitting)', () => {
    const busy = renderValid({ submitting: true });
    expect(busy).toContain('disabled=""');
    expect(busy).toContain('role="status"');
    expect(busy).toContain('평가 요청 중…');
    expect(busy).toContain('name="period"'); // 진행 중에도 선택 컨트롤은 유지된다.
    const idle = renderValid({ submitting: false });
    expect(idle).not.toContain('disabled=""');
    expect(idle).not.toContain('평가 요청 중…');
  });

  it('personId 미선택이면 제출 버튼이 비활성이고 선택되면 활성이다 (branch — personId 유무)', () => {
    const html = renderValid({ personId: undefined });
    expect(html).toContain('disabled=""');
    expect(html).toContain('name="period"'); // 미선택이어도 고를 수단 자체는 살아있다.
    expect(buildSelectionRequest({ ...validSelection, personId: undefined })).toBeNull();
    expect(buildSelectionRequest(validSelection)).not.toBeNull();
  });

  it('scope 미전달이면 기본 scope 가 적용되고 정의 외 키(scope override·reevaluate) 는 body 로 새지 않는다 (branch — 기본 scope / negative — 키 누출 0)', () => {
    const selection = { ...validSelection, scope: 'commit', reevaluate: true, unexpected: 'x' };
    const body = buildSelectionRequest(selection)?.body;
    expect(body?.scope).toBe(DEFAULT_EVALUATION_SCOPE);
    expect(Object.keys(body ?? {}).sort()).toEqual(['period', 'periodStart', 'personId', 'scope']);
  });

  it('personId 가 빈 문자열/공백/undefined 이거나 periodStart 가 빈 문자열이면 조립하지 않는다 (negative — 필수값 결측)', () => {
    expect(buildSelectionRequest({ ...validSelection, personId: '' })).toBeNull();
    expect(buildSelectionRequest({ ...validSelection, personId: '   ' })).toBeNull();
    expect(buildSelectionRequest({ ...validSelection, personId: undefined })).toBeNull();
    expect(buildSelectionRequest({ ...validSelection, periodStart: '' })).toBeNull();
  });

  it("periodStart 가 불가능 날짜('2026-02-30') 이거나 zero-pad 누락('2026-2-3') 이면 조립하지 않는다 (negative — 날짜 형식/달력)", () => {
    expect(buildSelectionRequest({ ...validSelection, periodStart: '2026-02-30' })).toBeNull();
    expect(buildSelectionRequest({ ...validSelection, periodStart: '2026-2-3' })).toBeNull();
    expect(buildSelectionRequest({ ...validSelection, periodStart: '2026-02-28' })).not.toBeNull();
  });

  it("period 가 'year'·'DAY'·빈 값이면 조립하지 않고 변경 콜백도 발사하지 않는다 (negative — 허용 밖 literal / 대소문자 변형)", () => {
    const onChangePeriod = vi.fn();
    expect(submitPeriodChange('year', onChangePeriod)).toBe(false);
    expect(submitPeriodChange('DAY', onChangePeriod)).toBe(false);
    expect(submitPeriodChange('', onChangePeriod)).toBe(false);
    expect(onChangePeriod).not.toHaveBeenCalled();
    expect(buildSelectionRequest({ ...validSelection, period: 'year' })).toBeNull();
    expect(buildSelectionRequest({ ...validSelection, period: 'DAY' })).toBeNull();
  });

  it('period·periodStart 에 숫자 같은 비문자열이 주입돼도 throw 없이 렌더되고 제출 버튼은 비활성이다 (negative — 비문자열 주입)', () => {
    const render = () => renderValid({ period: 3, periodStart: 20260803 });
    expect(render).not.toThrow();
    // 허용 밖 값은 placeholder·빈 값으로 fallback 한다(깨진 controlled 값 노출 0).
    expect(render()).toContain('disabled=""');
    expect(render()).not.toContain('value="3"');
    expect(render()).not.toContain('value="20260803"');
  });

  it('onSubmit·onChangePeriod 콜백이 미전달이면 throw 없이 false 를 반환한다 (negative — 콜백 미전달 안전성)', () => {
    expect(() => submitPeriodSelection(validSelection, undefined)).not.toThrow();
    expect(submitPeriodSelection(validSelection, undefined)).toBe(false);
    expect(submitPeriodChange('day', undefined)).toBe(false);
  });

  it('렌더된 기간 option value 집합이 EVALUATION_PERIOD_OPTIONS 와 정확히 일치한다 (drift guard — 계약 이중 정의 0)', () => {
    const html = renderValid();
    const values = [...html.matchAll(/<option value="([^"]*)"/g)].map((match) => match[1]);
    // 첫 항목은 미선택 placeholder(빈 value), 나머지는 계약 option 의 value 순서 그대로다.
    expect(values).toEqual(['', ...EVALUATION_PERIOD_OPTIONS.map((option) => option.value)]);
    EVALUATION_PERIOD_OPTIONS.forEach((option) => expect(html).toContain(option.label));
  });
});
