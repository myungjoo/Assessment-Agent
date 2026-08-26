// AssessmentDisplayRow 전용 정렬·검색 순수 연산 — REQ-075 (PLAN 131 행 ②) slice 3a (T-1726).
// slice 1 (T-1724) 이 매핑 helper 를, slice 2 (T-1725) 가 표 컴포넌트를 박제했으나 둘을
// 소비할 컨테이너 배선이 없다. DashboardView 의 옛 `filterRows`/`sortRows` 는 옛 행 계약
// (EvaluationResultRow) 전용이라 새 행으로 갈아끼우려면 정렬·검색·표 교체를 한 commit 에
// 몰아야 해 §3 크기 상한을 넘는다 — 그래서 배선(slice 3b) 이 얇아지도록 순수 연산만 선분리한다.
//
// 순수성 계약(assessmentRow.ts · roleAccess.ts 관례 승계): fetch · React · useApiResource ·
// 컴포넌트 파일 import 0 · module-level 가변 상태 0 · throw 0 · 입력 배열/객체 mutation 0.
// 어떤 비정상 입력(null · undefined · 배열 아닌 값 · 결손 행 · Object.freeze 된 입력)도
// 값으로 흡수한다.
import type { AssessmentDisplayRow } from './assessmentRow';

// 정렬 가능한 컬럼 키 — AssessmentResultTable 의 ASSESSMENT_TABLE_COLUMNS 와 **키·순서가
// 동일** 해야 한다(표 헤더 클릭이 그대로 이 키로 들어오기 때문). 컴포넌트를 import 하면
// 순수 모듈이 표시 계층에 의존하게 되므로 값은 여기서 독립 선언하고, 그 정합은 colocated
// spec 의 drift guard 가 지킨다(한쪽만 컬럼을 늘리면 fail).
export const ASSESSMENT_SORTABLE_KEYS = [
  'period',
  'scope',
  'periodStart',
  'difficulty',
  'contributionScore',
  'volume',
] as const;

export type AssessmentRowSortKey = (typeof ASSESSMENT_SORTABLE_KEYS)[number];

// 검색 대상 문자열 축. 숫자 축(contributionScore · volume) 은 검색 대상이 아니다 —
// 부분 문자열 일치를 수치에 적용하면 "1" 이 1 · 10 · 21 · 0.1 을 모두 걸어 사용자가
// 기대하는 "값 검색" 과 어긋나고, null(값 없음) 을 문자열화하면 "null" 이 검색어에
// 걸리는 오작동까지 생긴다. 수치 축은 정렬·범위 필터의 몫이다.
const SEARCHABLE_KEYS = [
  'period',
  'scope',
  'periodStart',
  'difficulty',
  'narrative',
] as const;

// 숫자 비교를 적용할 축(그 외 정렬 키는 문자열 localeCompare).
const NUMERIC_SORT_KEYS: readonly string[] = ['contributionScore', 'volume'];

/**
 * 행 1 개의 축 값을 검색용 소문자 문자열로 정규화한다. 결손·비문자열(타입 우회로 들어온
 * undefined · 숫자 · 객체) 은 빈 문자열로 흡수해 "undefined" 같은 문자열이 검색에
 * 걸리지 않게 한다.
 */
function toSearchableText(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase() : '';
}

/**
 * 정렬용 수치를 뽑는다. 유한 수만 값으로 인정하고 그 외(null · undefined · NaN ·
 * Infinity · 문자열 · 객체) 는 "값 없음" 을 뜻하는 null 이다 — 0 으로 위장하지 않는다.
 */
function toSortableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * 표시 행 배열을 검색어로 필터링한다(순수 함수, 비파괴).
 *
 * 검색어를 trim 한 결과가 빈 문자열이면(빈 문자열 · 공백뿐) 필터 미적용 — 입력 순서
 * 그대로 전체를 통과시킨다. 그 외에는 문자열 축 5 개(period · scope · periodStart ·
 * difficulty · narrative) 에 **대소문자 무시 부분 일치** 를 적용한다. 정규식이 아니라
 * `String.prototype.includes` 리터럴 비교라 검색어의 `.` · `*` · `[` 같은 문자도
 * 리터럴로 취급된다(정규식 컴파일 오류로 throw 하지 않는다).
 *
 * rows 가 배열이 아니면(null · undefined · 객체 · 문자열 · 숫자) 빈 배열을 반환해
 * 호출측이 응답 도착 전에도 분기 없이 소비할 수 있게 한다. searchTerm 이 문자열이
 * 아니면 "검색어 없음" 으로 간주한다.
 */
export function filterAssessmentRows(
  rows: AssessmentDisplayRow[],
  searchTerm: string,
): AssessmentDisplayRow[] {
  if (!Array.isArray(rows)) {
    return [];
  }
  const term = typeof searchTerm === 'string' ? searchTerm.trim().toLowerCase() : '';
  if (term === '') {
    // 새 배열로 복사해 호출측이 결과를 조작해도 입력 배열이 영향받지 않게 한다.
    return [...rows];
  }
  return rows.filter((row) => {
    if (row === null || typeof row !== 'object') {
      return false;
    }
    const source = row as unknown as Record<string, unknown>;
    return SEARCHABLE_KEYS.some((key) => toSearchableText(source[key]).includes(term));
  });
}

/**
 * 표시 행 배열을 정렬 키/방향으로 정렬한다(순수 함수, 비파괴 — 새 배열 반환하며 입력
 * 배열 순서와 행 객체는 그대로 둔다).
 *
 * 숫자 축은 수치 비교하되 **null(값 없음) 은 정렬 방향과 무관하게 항상 마지막** 이다 —
 * 오름차순에서 최저점, 내림차순에서 최고점으로 위장되면 "값 없음" 이 순위표 양 끝을
 * 차지해 읽는 사람을 오도하기 때문이다. 문자열 축은 localeCompare(한국어 라벨 정렬).
 *
 * 미지원 정렬 키(타입 우회 · 표 컬럼 변경 누락) 는 비교를 생략해 입력 순서를 보존한
 * 새 배열을 반환한다 — 알 수 없는 키로 순서를 무너뜨리지 않는 보수 정책이다.
 * rows 가 배열이 아니면 빈 배열이다.
 */
export function sortAssessmentRows(
  rows: AssessmentDisplayRow[],
  sortKey: AssessmentRowSortKey,
  sortDirection: 'asc' | 'desc',
): AssessmentDisplayRow[] {
  if (!Array.isArray(rows)) {
    return [];
  }
  const copy = [...rows];
  if (!(ASSESSMENT_SORTABLE_KEYS as readonly string[]).includes(sortKey as string)) {
    return copy;
  }
  // 'desc' 만 역방향 — 그 외 값(타입 우회로 들어온 undefined 등) 은 오름차순으로 흡수한다.
  const factor = sortDirection === 'desc' ? -1 : 1;
  const numeric = NUMERIC_SORT_KEYS.includes(sortKey);
  return copy.sort((a, b) => {
    const left = (a ?? {}) as unknown as Record<string, unknown>;
    const right = (b ?? {}) as unknown as Record<string, unknown>;
    if (numeric) {
      const av = toSortableNumber(left[sortKey]);
      const bv = toSortableNumber(right[sortKey]);
      if (av === null && bv === null) {
        return 0;
      }
      // factor 를 곱하지 않는다 — 방향과 무관하게 값 없음을 뒤로 보내기 위함이다.
      if (av === null) {
        return 1;
      }
      if (bv === null) {
        return -1;
      }
      return (av - bv) * factor;
    }
    const av = typeof left[sortKey] === 'string' ? (left[sortKey] as string) : '';
    const bv = typeof right[sortKey] === 'string' ? (right[sortKey] as string) : '';
    return av.localeCompare(bv) * factor;
  });
}
