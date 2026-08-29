// backend `GET /api/summaries` 응답 row → 시계열 표시 row 순수 매핑 helper —
// REQ-075 시계열 축 slice 1 (T-1788). 현행 DashboardView 의 컨테이너-로컬 `SummaryRow` 는
// 값 후보를 `value` → `score` 순으로, 라벨을 `period` → `label` 순으로 읽는데, backend
// prisma `model Summary`(prisma/schema.prisma 361~380 행) 의 실제 필드는
// `metricScore`(Decimal) · `periodStart`(DateTime) · `narrative` 라서 **모든 시계열
// 포인트가 값 0 으로 렌더** 되고 라벨은 시점이 아니라 period 종류값("daily" 등) 으로 찍힌다.
// 본 모듈은 그 간극을 흡수하는 **매핑 규칙만** 담고, 실제 소비 배선(DashboardView 의
// 로컬 `SummaryRow` · `deriveTrendPoints` 철거)은 후속 slice 책임이다(본 task Out of Scope).
//
// 순수성 계약(assessmentRow.ts · signupError.ts 관례 승계): fetch · React · useApiResource
// import 0 · module-level 가변 상태 0 · throw 0 · 입력 mutation 0. 어떤 비정상 입력
// (null · undefined · 배열 · 원시값 · Object.freeze 된 객체 · 타입 우회 값)도 값으로 흡수한다.

import { parseNumericField } from './assessmentRow';

// 시점 라벨을 끝내 파생할 수 없을 때 쓰는 결정적 fallback 라벨. 빈 문자열을 두면
// TrendTimeSeriesPanel 의 시점 컬럼이 통째로 비어 행 구분이 불가능해지므로,
// DashboardView 의 `지표 미상` 관례를 따라 사람이 읽을 수 있는 값을 남긴다.
export const FALLBACK_TREND_LABEL = '시점 미상';

// ISO 8601 문자열의 선두 날짜 부분(`YYYY-MM-DD`) 매칭. 월 01~12 · 일 01~31 까지만
// 형식으로 인정해 `2026-13-99T00:00:00Z` 같은 손상 값이 라벨로 새는 것을 막는다
// (달력 실재성 — 2 월 30 일 등 — 까지는 검사하지 않는다. 표시 라벨이라 과검증 불요).
const ISO_DATE_PREFIX = /^(\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))(?:[T ].*)?$/;

// 표시 행의 키 목록(선언 순서 = 아래 인터페이스 순서). drift guard spec 이 이 목록과
// 실제 매핑 결과의 Object.keys 를 함께 검사해, 한쪽만 고치는 실수를 fail 로 드러낸다.
export const SUMMARY_DISPLAY_ROW_KEYS = [
  'id',
  'period',
  'periodStart',
  'label',
  'value',
  'narrative',
] as const;

// 시계열 표시 행 1 개. `label` · `value` 두 축은 TrendTimeSeriesPanel 의 `TrendPoint`
// 계약(web/src/components/TrendTimeSeriesPanel.tsx 25~32 행) 과 이름을 맞춰, 소비 배선이
// 값 결손 row 만 걸러내면 그대로 포인트로 쓸 수 있게 한다.
export interface SummaryDisplayRow {
  id: string;
  // 요약 granularity("daily" · "weekly" · "monthly"). 시점 라벨이 아니라 종류값이다.
  period: string;
  // backend 는 DateTime 이지만 JSON 직렬화를 거쳐 ISO 문자열로 도착한다 — 원문을
  // 그대로 보존하고(정렬·기간 필터 등 후속 소비처가 재파싱할 수 있게) 라벨은 별도 축으로 둔다.
  periodStart: string;
  // 표시용 시점 라벨 — periodStart 에서 파생한다(아래 toTrendLabel 규약).
  label: string;
  // metricScore. 파싱 실패 시 0 으로 위장하지 않는다 — 0 점과 "값 없음" 은 추이 의미가
  // 전혀 달라서(요약 카드 축의 "표본 없음 ≠ 평균 0" 정책 승계), 표시 계층이 "—" 로
  // 렌더하거나 포인트에서 제외할 수 있도록 null 을 그대로 넘긴다.
  value: number | null;
  narrative: string;
}

// 문자열 축 fallback — 결손·비문자열은 빈 문자열로 흡수한다(표시 계층이 공백을 렌더).
function toDisplayString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * 시점 라벨 1 개를 파생한다.
 *
 * 우선순위: `periodStart` 의 ISO 날짜 부분(`YYYY-MM-DD`) → `periodStart` 원문 →
 * `period` → `FALLBACK_TREND_LABEL`. `period` 는 granularity 종류값("daily" 등) 이라
 * 시점 라벨로 **우선** 채택하지 않는다 — periodStart 가 통째로 없을 때의 최후 단서일 뿐이다.
 * 문자열이 아닌 입력(숫자 · Date 객체 · null 등)은 결손으로 간주한다(throw 0).
 */
export function toTrendLabel(periodStart: unknown, period: unknown): string {
  if (typeof periodStart === 'string') {
    const trimmed = periodStart.trim();
    const matched = ISO_DATE_PREFIX.exec(trimmed);
    if (matched !== null) {
      return matched[1];
    }
    if (trimmed !== '') {
      // 형식이 어긋나도 원문에 시점 단서가 남아 있을 수 있어 그대로 노출한다.
      return trimmed;
    }
  }
  if (typeof period === 'string' && period.trim() !== '') {
    return period.trim();
  }
  return FALLBACK_TREND_LABEL;
}

/**
 * backend 응답 row 1 개를 시계열 표시 행으로 매핑한다.
 *
 * 매핑 불가(비-객체 · `null` · 배열 · `id` 결손 — 비문자열이거나 빈 문자열)면 `null` 을
 * 반환한다. `id` 는 React key 이자 행 식별자라 없으면 표시할 수 없기 때문이며, 그 외
 * 문자열 필드 결손은 `''`, 숫자 필드 결손은 `null` 로 흡수해 행 자체는 살린다.
 * `metricScore` 해석은 assessmentRow 의 `parseNumericField` 를 재사용한다(로직 복제 0).
 * 입력 객체는 읽기만 한다(mutation 0).
 */
export function toSummaryDisplayRow(raw: unknown): SummaryDisplayRow | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const source = raw as Record<string, unknown>;
  const id = source.id;
  if (typeof id !== 'string' || id === '') {
    return null;
  }
  const period = toDisplayString(source.period);
  const periodStart = toDisplayString(source.periodStart);
  return {
    id,
    period,
    periodStart,
    label: toTrendLabel(source.periodStart, source.period),
    value: parseNumericField(source.metricScore),
    narrative: toDisplayString(source.narrative),
  };
}

/**
 * `GET /api/summaries` 응답 전체를 시계열 표시 행 배열로 매핑한다.
 *
 * 배열이 아니면(`null` · `undefined` · 객체 · 문자열 등) 빈 배열이다 — 호출측이
 * 응답 도착 전/오류 응답에서도 분기 없이 `.map` 할 수 있게 하기 위함이다. 매핑에
 * 실패한 원소만 제외하고 나머지 원소는 원본 순서대로 보존한다(부분 결손이 전체를
 * 지우지 않는다 · 정렬은 하지 않는다 — 시계열 정렬은 본 slice Out of Scope).
 */
export function deriveSummaryDisplayRows(raw: unknown): SummaryDisplayRow[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const rows: SummaryDisplayRow[] = [];
  for (const entry of raw) {
    const mapped = toSummaryDisplayRow(entry);
    if (mapped !== null) {
      rows.push(mapped);
    }
  }
  return rows;
}
