// REQ-077 (PLAN 131 행 ④ 기간 지정 평가 UI) slice 2 — 기간 종류(일/주/월)·시작 시점을 고르고 평가를
// 요청하는 선택 컨트롤이자 slice 1(T-1732) 계약 모듈 api/evaluationPeriod.ts 의 첫 소비처. ADR-0041
// Decision 1 경계를 지켜 순수 presentational controlled component 로만 만든다 — 상태는 props 로만 받고
// fetch·apiClient·useApiResource import 0, 실 POST 0(DashboardView 배선·호출은 slice 3). props 계약·
// 순수 함수 분리·named + default export 관례는 DashboardPersonSelector 를 차용한다.

import {
  EVALUATION_PERIOD_OPTIONS,
  buildPeriodEvaluationRequest,
  isEvaluationPeriodGranularity,
  type EvaluationPeriodGranularity,
  type PeriodEvaluationRequest,
} from '../api/evaluationPeriod';

// 컨트롤 라벨·문구(말줄임표는 U+2026 …). 기간 옵션 라벨(일간/주간/월간) 은 계약 모듈의
// EVALUATION_PERIOD_OPTIONS 만이 정본이라 여기서 재선언하지 않는다(계약 이중 정의 금지).
const PERIOD_FIELD_LABEL = '평가 기간 종류';
const PERIOD_PLACEHOLDER_LABEL = '기간을 선택하세요';
const START_FIELD_LABEL = '기간 시작일';
const SUBMIT_LABEL = '기간 평가 요청';
const SUBMITTING_TEXT = '평가 요청 중…';

// 컨트롤이 표시하는 부분 선택 상태 — "아직 다 고르지 않은" 값도 표현해야 해 전부 선택적이다.
interface PeriodSelection {
  personId?: string;
  period?: string;
  periodStart?: string;
}

interface DashboardPeriodSelectorProps extends PeriodSelection {
  // 기간 종류 변경 콜백 — 허용 literal(day/week/month) 일 때만 호출한다.
  onChangePeriod: (period: EvaluationPeriodGranularity) => void;
  // 시작 시점 변경 콜백 — <input type="date"> 값을 가공 없이 그대로 전달한다.
  onChangePeriodStart: (periodStart: string) => void;
  // 제출 콜백 — 조립된 request({ path, body }) 로 호출한다. 실 POST 는 상위 책임.
  onSubmit: (request: PeriodEvaluationRequest) => void;
  // 진행 중 플래그 — true 면 제출 버튼 비활성 + 진행 문구 노출.
  submitting?: boolean;
  // 에러 문구(선택) — truthy 면 alert 로 먼저 렌더하되 선택 컨트롤을 삼키지 않는다(REQ-077).
  error?: string;
}

// 현재 선택 상태로 요청을 조립한다(순수) — 제출 가능 여부는 결과가 null 이 아닌지로 판정한다. 조건을
// 재발명하지 않고 계약 모듈에 위임해 무효면 throw 없이 null 이고, scope 미전달이라 계약 기본값
// (aggregate) 이 적용된다. 키를 명시적으로 골라 담아 정의 외 키가 body 로 새지 않게 한다(controller
// 는 whitelist + forbidNonWhitelisted 라 정의 외 키가 섞이면 400).
function buildSelectionRequest(selection: unknown): PeriodEvaluationRequest | null {
  if (selection === null || typeof selection !== 'object') {
    return null;
  }
  const { personId, period, periodStart } = selection as Record<string, unknown>;
  return buildPeriodEvaluationRequest({ personId, period, periodStart });
}

// 제출 발사(순수) — 조립 가능 + 콜백이 함수일 때만 1 회 호출하고 그 여부를 반환한다(정적 렌더
// 환경에서 콜백 계약을 검증할 수 있게 렌더에서 분리 — GroupMemberList 선례).
function submitPeriodSelection(
  selection: unknown,
  onSubmit?: (request: PeriodEvaluationRequest) => void,
): boolean {
  const request = buildSelectionRequest(selection);
  if (request === null || typeof onSubmit !== 'function') {
    return false;
  }
  onSubmit(request);
  return true;
}

// 기간 종류 변경 발사(순수) — 허용 literal 판정은 계약 모듈 isEvaluationPeriodGranularity 가 정본이라
// 목록을 재선언하지 않는다. placeholder(빈 값)·'year'·'DAY' 는 발사 없이 false.
function submitPeriodChange(
  value: unknown,
  onChangePeriod?: (period: EvaluationPeriodGranularity) => void,
): boolean {
  if (!isEvaluationPeriodGranularity(value) || typeof onChangePeriod !== 'function') {
    return false;
  }
  onChangePeriod(value);
  return true;
}

// 대시보드 기간 지정 선택 컨트롤. 선택값 표시와 콜백 호출만 하는 presentational 책임만 진다.
function DashboardPeriodSelector({
  personId,
  period,
  periodStart,
  onChangePeriod,
  onChangePeriodStart,
  onSubmit,
  submitting,
  error,
}: DashboardPeriodSelectorProps) {
  const selection: PeriodSelection = { personId, period, periodStart };
  // 진행 중이거나 선택이 미완성이면 제출 불가 — 판정 조건은 순수 함수가 정본이다.
  const submittable = submitting !== true && buildSelectionRequest(selection) !== null;

  return (
    <div>
      {/* 에러를 먼저 알리되 아래 선택 수단을 삼키지 않는다. 빈 error 는 falsy 라 미렌더. */}
      {error ? <div role="alert">{error}</div> : null}
      <label>
        {PERIOD_FIELD_LABEL}
        {/* controlled — 허용 밖/미선택 값은 throw 없이 placeholder 로 fallback 한다. */}
        <select
          name="period"
          value={isEvaluationPeriodGranularity(period) ? period : ''}
          onChange={(event) => submitPeriodChange(event.target.value, onChangePeriod)}
        >
          <option value="">{PERIOD_PLACEHOLDER_LABEL}</option>
          {EVALUATION_PERIOD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        {START_FIELD_LABEL}
        {/* 입력값을 그대로 올려보낸다 — offset 부착·Date 재조립은 backend parseKstPeriodInput
            (src/common/period-boundary.ts) 의 KST 자정 해석과 이중 적용돼 하루가 어긋난다. 비문자열이
            주입돼도 controlled 계약이 깨지지 않도록 빈 문자열로 fallback 한다. */}
        <input
          type="date"
          name="periodStart"
          value={typeof periodStart === 'string' ? periodStart : ''}
          onChange={(event) => onChangePeriodStart(event.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={!submittable}
        onClick={() => submitPeriodSelection(selection, onSubmit)}
      >
        {SUBMIT_LABEL}
      </button>
      {/* 진행 문구 — 버튼 비활성과 함께 진행 중임을 알린다. */}
      {submitting === true ? <span role="status">{SUBMITTING_TEXT}</span> : null}
    </div>
  );
}

export { buildSelectionRequest, submitPeriodSelection, submitPeriodChange };
export type { PeriodSelection, DashboardPeriodSelectorProps };
export default DashboardPeriodSelector;
