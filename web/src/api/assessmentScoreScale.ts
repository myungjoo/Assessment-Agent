// 실 contributionScore 스케일(0–3) 기반 점수 분포·요약 집계 순수 모듈 — REQ-076
// (PLAN 131 행 ③) slice 4a (T-1728).
//
// 스케일 근거(single source 는 backend): src/assessment-evaluation/domain/
// evaluation-result.persist.mapper.ts 의 `CONTRIBUTION_SCORE_BY_LEVEL`
// (zero=0 / low=1 / medium=2 / high=3 등간격 ordinal) 과, aggregate
// `Assessment.contributionScore` 가 그 component score 의 **평균** 이라는 규칙.
// 두 사실로부터 값역은 `[0, 3]` 이다 — 100 점 만점이 아니다.
//
// 현행 DashboardView 의 `BUCKET_EDGES` 는 `0–20 … 80–100` 5 구간이라 실 데이터의 모든
// 행이 첫 bucket 에 몰려 분포 차트가 단일 막대가 되고, 요약 카드의 "평균 점수" 도 100 점
// 만점을 암시한다 — REQ-076 이 금지한 "0–100 임의 가정" 그 자체다. 본 모듈은 그 교정을
// 위한 **상수와 집계 연산만** 담고, 실제 배선(helper 교체 · 임시 브리지 `toLegacyScoreRows`
// 제거 · 카드 라벨의 만점 표기 교정)은 slice 4b 책임이다(본 task Out of Scope).
//
// 순수성 계약(assessmentRow.ts · assessmentRowOps.ts 관례 승계): fetch · React ·
// useApiResource · 컴포넌트 파일 import 0 · module-level 가변 상태 0 · throw 0 · 입력
// mutation 0. 어떤 비정상 입력(null · 배열 아닌 값 · 결손 행 · 타입 우회 문자열 점수 ·
// NaN · Infinity)도 값으로 흡수한다.
import type { AssessmentDisplayRow } from './assessmentRow';

// 실 스케일의 하한·상한. 표시 계층은 "N / 3 점" 처럼 이 상수를 만점으로 써야 하며,
// 0–100 가정으로 되돌아가면 colocated spec 의 drift guard 가 fail 한다.
export const CONTRIBUTION_SCORE_MIN = 0;
export const CONTRIBUTION_SCORE_MAX = 3;

// 한 분포 bucket. 필드는 ScoreDistributionChart 의 `ScoreDistributionBucket`
// (id · label · count) 과 구조 호환이어야 한다 — 다만 api → components 역방향 의존을
// 만들지 않으려고 타입을 여기서 독립 선언하고, 그 정합은 spec 의 type-only drift guard 가
// 지킨다(한쪽만 필드를 바꾸면 컴파일 fail).
export interface ScoreBucket {
  // bucket 식별자 — React key 로 쓰인다.
  id: string;
  // 점수 구간 라벨(예: '1–1.5').
  label: string;
  // 그 구간에 귀속된 행 수.
  count: number;
}

// 요약 지표 1 묶음. 라벨·단위·카드 형태는 본 모듈이 만들지 않는다(배선 slice 책임) —
// 표시 계층이 `average` 와 `scoreMax` 로 "x / 3 점" 을 조립한다.
export interface ContributionScoreSummary {
  // 점수를 가진(집계 대상) 행 수 — 전체 행 수가 아니다.
  count: number;
  // 집계 대상 행의 평균(소수 둘째 자리 반올림). 대상이 0 건이면 0 이 아니라 null —
  // "평균 0 점" 과 "표본 없음" 은 의미가 전혀 달라서다.
  average: number | null;
  // 만점(= CONTRIBUTION_SCORE_MAX). 표시 계층이 분모를 재추론하지 않게 함께 넘긴다.
  scoreMax: number;
}

// 값역 [0, 3] 을 폭 0.5 로 6 등분한 분포 경계. 정수 경계 1 · 2 가 ordinal 등급 경계
// (low · medium) 와 정확히 일치하도록 폭을 고른 것이며, 그래서 "medium 이상" 같은 해석이
// bucket 경계와 어긋나지 않는다. 귀속 규칙은 `[min, max)` 반열림 + **마지막 bucket 만
// 상한 포함**(만점 3 귀속) — DashboardView 의 이전 규약을 그대로 승계한다.
export const CONTRIBUTION_SCORE_BUCKET_EDGES: readonly {
  id: string;
  label: string;
  min: number;
  max: number;
}[] = [
  { id: 'cs0', label: '0–0.5', min: 0, max: 0.5 },
  { id: 'cs05', label: '0.5–1', min: 0.5, max: 1 },
  { id: 'cs1', label: '1–1.5', min: 1, max: 1.5 },
  { id: 'cs15', label: '1.5–2', min: 1.5, max: 2 },
  { id: 'cs2', label: '2–2.5', min: 2, max: 2.5 },
  { id: 'cs25', label: '2.5–3', min: 2.5, max: 3 },
];

/**
 * 행 1 개에서 집계 가능한 점수를 뽑는다.
 *
 * 유한 수만 값으로 인정하고 그 외(`null` · `undefined` · `NaN` · `±Infinity` · 타입
 * 우회로 들어온 문자열/객체/boolean)는 "값 없음" 을 뜻하는 `null` 이다 — 0 으로 위장하면
 * 평균이 끌려 내려가고 첫 bucket 이 부풀어 REQ-076 이 막으려는 왜곡이 생긴다(T-1724 ·
 * T-1727 결정 승계). 행 자체가 비객체·`null` 이어도 값으로 흡수한다.
 */
function toAggregableScore(row: unknown): number | null {
  if (row === null || typeof row !== 'object') {
    return null;
  }
  const value = (row as Record<string, unknown>).contributionScore;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * 점수를 실 스케일 [0, 3] 안으로 clamp 한다. 범위 밖 값(음수 · 3 초과)이 분포에서
 * 누락되지 않고 가장 가까운 끝 bucket 에 귀속되게 하기 위함이며, 평균에도 같은 clamp 를
 * 적용해 요약과 분포가 서로 다른 값역을 말하지 않도록 한다.
 */
function clampToScale(score: number): number {
  return Math.min(CONTRIBUTION_SCORE_MAX, Math.max(CONTRIBUTION_SCORE_MIN, score));
}

/**
 * 행 배열에서 집계 대상 점수만 clamp 해 모은다. 배열이 아니면(응답 미도착 · 타입 우회)
 * 빈 배열이라 호출측이 분기 없이 쓸 수 있다. 입력은 읽기만 한다(mutation 0).
 */
function collectScores(rows: AssessmentDisplayRow[]): number[] {
  if (!Array.isArray(rows)) {
    return [];
  }
  const scores: number[] = [];
  for (const row of rows) {
    const score = toAggregableScore(row);
    if (score !== null) {
      scores.push(clampToScale(score));
    }
  }
  return scores;
}

/**
 * 표시 행 배열을 실 스케일 기준 점수 분포 bucket 으로 집계한다(순수 함수).
 *
 * 집계 대상 행이 0 건이면(빈 배열 · 전 행 점수 없음) **빈 배열** 을 반환해 차트가 빈
 * 상태를 렌더하게 한다 — count 가 전부 0 인 막대 6 개를 그리는 것보다 정직하다.
 * 귀속은 `[min, max)` 반열림이고 마지막 bucket 만 상한(3)을 포함한다.
 */
export function deriveContributionScoreBuckets(
  rows: AssessmentDisplayRow[],
): ScoreBucket[] {
  const scores = collectScores(rows);
  if (scores.length === 0) {
    return [];
  }
  const counts = CONTRIBUTION_SCORE_BUCKET_EDGES.map(() => 0);
  for (const score of scores) {
    let index = CONTRIBUTION_SCORE_BUCKET_EDGES.findIndex(
      (edge) => score >= edge.min && score < edge.max,
    );
    if (index === -1) {
      // score === CONTRIBUTION_SCORE_MAX — 마지막 bucket 만 상한을 포함한다.
      index = CONTRIBUTION_SCORE_BUCKET_EDGES.length - 1;
    }
    counts[index] += 1;
  }
  return CONTRIBUTION_SCORE_BUCKET_EDGES.map((edge, i) => ({
    id: edge.id,
    label: edge.label,
    count: counts[i],
  }));
}

/**
 * 표시 행 배열의 요약 지표를 계산한다(순수 함수).
 *
 * `count` 는 **점수를 가진 행 수**(전체 행 수가 아니다), `average` 는 그 평균을 소수
 * 둘째 자리로 결정적 반올림한 값이다. 대상이 0 건이면 `average` 는 `null` — 표시 계층이
 * "—" 로 렌더할 수 있게 한다.
 */
export function summarizeContributionScores(
  rows: AssessmentDisplayRow[],
): ContributionScoreSummary {
  const scores = collectScores(rows);
  if (scores.length === 0) {
    return { count: 0, average: null, scoreMax: CONTRIBUTION_SCORE_MAX };
  }
  const sum = scores.reduce((acc, score) => acc + score, 0);
  // 소수 둘째 자리 반올림 — 같은 입력이면 항상 같은 출력(부동소수 표시 흔들림 차단).
  const average = Math.round((sum / scores.length) * 100) / 100;
  return { count: scores.length, average, scoreMax: CONTRIBUTION_SCORE_MAX };
}
