// 기간 지정 평가 요청(`POST /api/assessment-evaluation/period`) 조립 순수 모듈 — REQ-077
// (PLAN 131 행 ④) slice 1 (T-1732).
//
// 계약 정본은 backend `PeriodBridgeDto`(src/assessment-evaluation/dto/period-bridge.dto.ts)
// 와 `docs/architecture/api.md` `104 행` 이다. body 는 정확히 `personId`/`period`/`scope`/
// `periodStart` 4 키 + `reevaluate`(엄격히 true 일 때만) 5 번째 키이며, controller
// ValidationPipe 가 whitelist + forbidNonWhitelisted 라 정의 외 키가 섞이면 400 이다 —
// 그래서 입력 객체를 흘려보내지 않고 키를 명시적으로 골라 담는다. 허용 literal(period =
// day/week/month, scope = commit/document/aggregate)의 검증은 backend service 단 책임이라
// 위반이 400 이 아닌 의미 오류로 나타나므로 프런트에서 먼저 걸러 왕복을 아낀다.
//
// 순수성 계약(assessmentScoreScale.ts 관례 승계): react · components/* · apiClient · fetch
// import 0 · 가변 module 상태 0 · throw 0 · 입력 인자 mutation 0 — 어떤 비정상 입력도
// 값(`null`)으로 흡수한다. 실 POST 호출과 응답 매핑은 후속 배선 slice 책임이다.

// 요청 endpoint. 후속 slice 가 `apiClient.request` 에 그대로 넘긴다.
export const PERIOD_EVALUATION_PATH = '/api/assessment-evaluation/period';

// 기간 종류 · 평가 scope — api.md 104 행의 허용 literal.
export type EvaluationPeriodGranularity = 'day' | 'week' | 'month';
export type EvaluationScope = 'commit' | 'document' | 'aggregate';

// 후속 select UI 의 option source. 값은 backend literal 그대로, 라벨만 한국어다.
export const EVALUATION_PERIOD_OPTIONS: readonly {
  value: EvaluationPeriodGranularity;
  label: string;
}[] = [
  { value: 'day', label: '일간' },
  { value: 'week', label: '주간' },
  { value: 'month', label: '월간' },
];

// 대시보드 기본 scope — 개별 commit/document 가 아니라 종합 평가문이 기본 화면이다.
export const DEFAULT_EVALUATION_SCOPE: EvaluationScope = 'aggregate';

const EVALUATION_SCOPES: readonly EvaluationScope[] = ['commit', 'document', 'aggregate'];

// `<input type="date">` 가 내보내는 형식(`YYYY-MM-DD`)만 허용한다.
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// 실제 전송 body — backend `PeriodBridgeDto` 5 키와 1:1. UI 는 "선택 전" 부분 상태도
// 넘길 수 있어야 해서 조립 함수의 인자는 `unknown` 이고, 완성된 계약이 이 타입이다.
export interface PeriodEvaluationRequestBody {
  personId: string;
  period: EvaluationPeriodGranularity;
  scope: EvaluationScope;
  periodStart: string;
  reevaluate?: boolean;
}

export interface PeriodEvaluationRequest {
  path: typeof PERIOD_EVALUATION_PATH;
  body: PeriodEvaluationRequestBody;
}

/** 허용 literal 3 종만 true. 대소문자 변형(`DAY`)은 허용하지 않는다. */
export function isEvaluationPeriodGranularity(
  value: unknown,
): value is EvaluationPeriodGranularity {
  return value === 'day' || value === 'week' || value === 'month';
}

function isEvaluationScope(value: unknown): value is EvaluationScope {
  return EVALUATION_SCOPES.includes(value as EvaluationScope);
}

/**
 * `<input type="date">` 값을 body 의 `periodStart` 로 정규화한다. **offset 산술을 하지
 * 않는다** — `+09:00` 을 붙이거나 UTC 로 환산하면 backend `parseKstPeriodInput`
 * (src/common/period-boundary.ts)의 KST 자정 해석과 이중 적용돼 하루가 어긋나서, 공백만
 * 걷어내고 날짜 문자열을 그대로 통과시킨다. 형식 위반 · 달력상 불가능한 날짜 · 비문자열 ·
 * 빈 문자열은 throw 없이 `null`.
 */
export function normalizePeriodStartInput(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  const match = DATE_ONLY_PATTERN.exec(trimmed);
  if (!match) {
    return null;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  // 달력상 불가능한 값(2/30 · 13 월)은 round-trip 으로 거부한다 — Date.UTC 의 silent
  // overflow(2/30 → 3/2)를 backend 와 같은 규칙으로 막는다. setUTCFullYear 는 0~99 년을
  // 1900 년대로 옮기는 Date.UTC 규칙을 되돌리는 보정이다.
  const roundTrip = new Date(Date.UTC(year, month - 1, day));
  roundTrip.setUTCFullYear(year);
  const sameDate =
    roundTrip.getUTCFullYear() === year &&
    roundTrip.getUTCMonth() === month - 1 &&
    roundTrip.getUTCDate() === day;
  return sameDate ? trimmed : null;
}

// 공백만 있는 값은 backend `@IsNotEmpty`(빈 문자열만 검사)를 통과해버리므로 프런트에서
// 먼저 무효로 판정한다.
function normalizePersonId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * 기간 지정 평가 요청의 path 와 body 를 조립한다(순수 함수). 하나라도 무효면 throw 없이
 * `null` — 호출측은 "아직 요청할 수 없음" 으로 읽어 버튼을 비활성화하면 된다. `scope` 는
 * **미지정(undefined)일 때만** 기본값(`aggregate`)을 쓰고 명시값이 허용 literal 밖이면
 * fail-closed 로 `null`. `reevaluate` 는 엄격히 `true` 일 때만 실린다(Admin 전용 flag —
 * 비-boolean 이 실려 400 이 나는 일을 막는다).
 */
export function buildPeriodEvaluationRequest(
  input: unknown,
): PeriodEvaluationRequest | null {
  if (input === null || typeof input !== 'object') {
    return null;
  }
  const source = input as Record<string, unknown>;
  const personId = normalizePersonId(source.personId);
  const periodStart = normalizePeriodStartInput(source.periodStart);
  const scope = source.scope === undefined ? DEFAULT_EVALUATION_SCOPE : source.scope;
  if (
    personId === null ||
    periodStart === null ||
    !isEvaluationPeriodGranularity(source.period) ||
    !isEvaluationScope(scope)
  ) {
    return null;
  }
  // 키를 명시적으로 골라 담는다 — 입력을 spread 하면 정의 외 키가 새어나가 400 이 된다.
  const body: PeriodEvaluationRequestBody = {
    personId,
    period: source.period,
    scope,
    periodStart,
  };
  return {
    path: PERIOD_EVALUATION_PATH,
    body: source.reevaluate === true ? { ...body, reevaluate: true } : body,
  };
}
