// backend `GET /api/assessments` 응답 row → 대시보드 표시 행 순수 매핑 helper —
// REQ-075 slice 1 (T-1724). 현행 DashboardView 는 응답을 매핑 없이 표 계약으로 간주해
// `id` 외 전 필드가 불일치(표·요약 지표·점수 분포가 undefined 를 집계)한다. 본 모듈은
// 그 간극을 흡수하는 **매핑 규칙만** 담고, 실제 소비 배선(DashboardView 의 visibleRows ·
// EvaluationResultTable 의 컬럼 재설계)은 후속 slice 책임이다(본 task Out of Scope).
//
// 순수성 계약(signupError.ts · roleAccess.ts 관례 승계): fetch · React · useApiResource
// import 0 · module-level 가변 상태 0 · throw 0 · 입력 mutation 0. 어떤 비정상 입력
// (null · undefined · 배열 · 원시값 · Object.freeze 된 객체 · 타입 우회 값)도 값으로 흡수한다.

// 표시 행 1 개. 필드명·개수는 backend prisma `model Assessment`(prisma/schema.prisma
// 294~304 행) 의 표시 대상 9 개와 1:1 로 맞춘다 — 두 package 는 타입을 공유할 수 없어
// 이름만 동기하며, 그 정합은 colocated spec 의 drift guard 가 지킨다.
export interface AssessmentDisplayRow {
  id: string;
  personId: string;
  period: string;
  scope: string;
  // backend 는 DateTime 이지만 JSON 직렬화를 거쳐 ISO 문자열로 도착한다 — 표시 계층이
  // 포맷을 정하도록 파싱하지 않고 원문 문자열 그대로 보존한다.
  periodStart: string;
  difficulty: string;
  // 숫자 축은 파싱 실패 시 0 으로 위장하지 않는다 — 0 점과 "값 없음" 은 집계 의미가
  // 전혀 달라서, 표시 계층이 "—" 로 렌더할 수 있도록 null 을 그대로 넘긴다.
  contributionScore: number | null;
  volume: number | null;
  narrative: string;
}

// 표시 행의 키 목록(선언 순서 = backend 필드 순서). drift guard spec 이 이 목록과
// 실제 매핑 결과의 Object.keys 를 함께 검사해, 한쪽만 고치는 실수를 fail 로 드러낸다.
export const ASSESSMENT_DISPLAY_ROW_KEYS = [
  'id',
  'personId',
  'period',
  'scope',
  'periodStart',
  'difficulty',
  'contributionScore',
  'volume',
  'narrative',
] as const;

// 문자열 축 fallback — 결손·비문자열은 빈 문자열로 흡수한다(표시 계층이 공백을 렌더).
function toDisplayString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * 숫자 축 1 개를 표시 가능한 유한 수로 정규화한다.
 *
 * Prisma `Decimal`(contributionScore) 은 JSON 직렬화 경로에 따라 `"12.5"` 문자열로도,
 * `12.5` 숫자로도 도착한다 — 두 표현을 모두 수용한다. 그 외(`NaN` · `Infinity` ·
 * `-Infinity` · 빈/공백 문자열 · 비수치 문자열 · `null` · `undefined` · boolean ·
 * 객체 · 배열)는 전부 `null` 이다. 절대 throw 하지 않는다.
 */
export function parseNumericField(value: unknown): number | null {
  if (typeof value === 'number') {
    // NaN · ±Infinity 는 집계에 섞이면 전체 합계를 오염시키므로 여기서 잘라낸다.
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      // Number('') === 0 이라 빈 문자열을 0 으로 오해하는 함정을 명시적으로 막는다.
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  // boolean(Number(true) === 1) · null(Number(null) === 0) · 객체 등은 수치로 해석하지 않는다.
  return null;
}

/**
 * backend 응답 row 1 개를 표시 행으로 매핑한다.
 *
 * 매핑 불가(비-객체 · `null` · 배열 · `id` 결손 — 비문자열이거나 빈 문자열)면 `null` 을
 * 반환한다. `id` 는 React key 이자 행 식별자라 없으면 표시할 수 없기 때문이며, 그 외
 * 문자열 필드 결손은 `''`, 숫자 필드 결손은 `null` 로 흡수해 행 자체는 살린다.
 * 입력 객체는 읽기만 한다(mutation 0).
 */
export function toAssessmentDisplayRow(raw: unknown): AssessmentDisplayRow | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const source = raw as Record<string, unknown>;
  const id = source.id;
  if (typeof id !== 'string' || id === '') {
    return null;
  }
  return {
    id,
    personId: toDisplayString(source.personId),
    period: toDisplayString(source.period),
    scope: toDisplayString(source.scope),
    periodStart: toDisplayString(source.periodStart),
    difficulty: toDisplayString(source.difficulty),
    contributionScore: parseNumericField(source.contributionScore),
    volume: parseNumericField(source.volume),
    narrative: toDisplayString(source.narrative),
  };
}

/**
 * `GET /api/assessments` 응답 전체를 표시 행 배열로 매핑한다.
 *
 * 배열이 아니면(`null` · `undefined` · 객체 · 문자열 등) 빈 배열이다 — 호출측이
 * 응답 도착 전/오류 응답에서도 분기 없이 `.map` 할 수 있게 하기 위함이다. 매핑에
 * 실패한 원소만 제외하고 나머지 원소는 그대로 보존한다(부분 결손이 전체를 지우지 않는다).
 */
export function deriveAssessmentDisplayRows(raw: unknown): AssessmentDisplayRow[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const rows: AssessmentDisplayRow[] = [];
  for (const entry of raw) {
    const mapped = toAssessmentDisplayRow(entry);
    if (mapped !== null) {
      rows.push(mapped);
    }
  }
  return rows;
}
