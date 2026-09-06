// computeRelativeComparison — P5 "좌표별 개발자 간 상대 비교" 산출의 결정적 순수
// domain helper (README 63 행 / REQ-036: "상대 비교 가능 + LLM 정성 + Metric 수치").
// 한 좌표 `(period, periodStart)` 안의 person 별 `metricScore` 묶음을 person 간
// **순위(rank) · 백분위(percentile) · cohort 평균(mean)** 으로 축약한다. 본 파일은
// 의존성 0 의 순수 함수만 둔다 — NestJS `@Injectable` / Prisma / LLM gateway import
// 0, 부수효과 0(referential transparency, 입력 비변형), throw 는 아래 계약 위반 2 종
// 뿐이다. 동일 입력은 항상 동일 출력 — LLM 정성 평가와 분리해 독립 검증 가능하다
// (ADR-0032 §3 "metric 수치 신호는 LLM 정성과 분리해 결정적으로" 정신과 정합).
//
// 왜 별도의 상대 비교 축인가: `summary-aggregate.ts` 52~57 행 은 "모든 person 에
// 동일 규칙이 적용되므로 산출된 per-person metricScore 는 서로 비교 가능하다" 고
// **비교 가능성만** 선언한 채 비교를 수행하는 심볼을 두지 않았다 — REQ-036 의 잔여
// 미충족 축이 정확히 그 부재다. 그 산출을 aggregate 안에 섞으면 단위 → 좌표 축약
// (1 person) 책임과 좌표 → cohort 비교(N person) 책임이 겹치므로, aggregate 를
// **수정하지 않고** 대칭 파일을 신설한다.
//
// 판정 알고리즘 · 방어 계약의 전문은 아래 함수 JSDoc 에 둔다(중복 서술 회피). 여기
// 에는 그 선택의 **근거** 만 남긴다:
//   - competition ranking(1,1,3) 채택 — 동점자에게 서로 다른 순위를 임의로 부여하면
//     같은 점수에 다른 서열이 붙어 상대 비교의 의미가 왜곡된다. dense ranking(1,1,2)
//     은 반대로 동점 인원 수 정보를 지워 cohort 위치를 왜곡한다.
//   - percentile 기준을 "자신보다 **낮은** 점수 인원 수 / cohortSize" 로 고정 —
//     동점자가 서로 같은 값을 받고(공정), 최하위가 항상 0 이라 경계가 결정적이다.
//     "자신 이하" 기준은 최하위가 cohortSize 에 따라 0 이 아닌 값을 받아 흔들린다.
//   - 보수성 원칙(휴리스틱 과확장 금지) — v1 은 rank · percentile · mean 3 산출로
//     한정한다. 표준편차 · z-score · 사분위 같은 파생 지표는 소비처 요구가 실재할 때
//     추가한다(미사용 surface 를 미리 늘리지 않는다).
//   - 비정상 `metricScore` 는 throw 없이 0 절하 — `evaluation-volume.ts` 33~39 행 의
//     보수 규약 mirror. 한 person 의 오염된 값이 cohort 전체 산출을 실패시키지
//     않도록 절하하되, 절하 결과를 산출에 그대로 노출해 은폐하지 않는다.
//   - 중복 personId 만 throw — `prisma/schema.prisma` 377 행
//     `@@unique([personId, period, periodStart])` 가 좌표당 person 1 행을 보장하므로
//     중복 입력은 호출자의 좌표 혼합(계약 위반)이고, 조용히 병합하면 잘못된 cohort
//     크기로 백분위를 산출하게 된다 — 조기 노출이 안전하다.
//
// 책임 경계(본 task = 산출 helper 만, Out of Scope): 좌표 기준 다중 person 조회
// (`summary.repository.ts`) · service 위임 · endpoint 노출 배선은 후속 task 가 본
// helper 를 소비해 처리한다(compute → wire 분리). `summary-aggregate.ts` 의 수식 ·
// 가중치 · 정밀도 정의 변경 0(재사용만 한다).
//
// 패턴 mirror: evaluation-document-contribution-signal.ts(순수 함수 + 최초 등장 순서
// 보존 결정성 + 입력 비변형 + 한국어 TypeError 계약 + 산출-only 책임 경계) +
// evaluation-volume.ts(비정상 number 의 0 절하 보수 규약).

// RELATIVE_COMPARISON_PRECISION — mean · percentile 의 소수 정밀도. `summary-
// aggregate.ts` 의 `METRIC_SCORE_PRECISION`(= 6) 과 **같은 값 · 같은 round 방식**
// 이다. 그 상수가 export 되어 있지 않아 여기서 재선언하되, aggregate 를 수정하지
// 않는다는 본 slice 의 경계를 지키기 위해 동일성을 주석으로 박제한다 — metricScore
// 가 6 자리로 round 되어 영속되므로 그 파생 산출도 같은 자리에서 잘라야 부동소수점
// 잔차가 동일 입력에 다른 출력을 만들지 않는다.
const RELATIVE_COMPARISON_PRECISION = 6;

// RelativeComparisonEntry — 한 좌표 `(period, periodStart)` 안의 person 1 명 입력.
export interface RelativeComparisonEntry {
  // person 외부 식별자. 좌표 안에서 유일해야 한다(중복은 호출자 계약 위반).
  personId: string;
  // `aggregateMetricScore` 산출값. 비-number / 비유한수는 0 으로 절하된다.
  metricScore: number;
}

// PersonRelativeStanding — cohort 안에서의 person 1 명의 상대 위치.
export interface PersonRelativeStanding {
  // person 외부 식별자(입력 그대로).
  personId: string;
  // 정규화된 metricScore(비정상 입력은 0 절하된 값이 그대로 실린다).
  metricScore: number;
  // 점수 내림차순 1-based competition ranking. 동점은 같은 rank, 다음 rank 는 동점
  // 인원 수만큼 건너뛴다(1,1,3).
  rank: number;
  // 자신보다 낮은 점수 인원 수 / cohortSize × 100. 최하위는 0, 동점자는 서로 같다.
  percentile: number;
}

// RelativeComparisonResult — computeRelativeComparison 의 산출 타입.
export interface RelativeComparisonResult {
  // 비교 대상 person 수(입력 원소 수).
  cohortSize: number;
  // 정규화 후 metricScore 의 산술 평균. 빈 입력은 0.
  mean: number;
  // person 별 상대 위치. rank 오름차순(= 점수 내림차순), 동점 내부는 입력 최초 등장
  // 순서 보존.
  byPerson: PersonRelativeStanding[];
}

// 내부 정규화 결과. order 는 입력 최초 등장 순서(동점 tie-break 용).
interface NormalizedEntry {
  personId: string;
  metricScore: number;
  order: number;
}

// roundTo — value 를 precision 자리에서 결정적으로 round. `summary-aggregate.ts`
// 67~71 행 의 roundTo 와 동일 방식(부동소수점 누적 오차 차단).
function roundTo(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

// normalizeScore — 비-number / 비유한수(NaN · ±Infinity) 를 0 으로 절하한다
// (`evaluation-volume.ts` 33~39 행 보수 규약 mirror, throw 하지 않는다). 정상
// number 는 그대로 통과시킨다 — metricScore 는 이미 aggregate 에서 round 된 값이라
// 여기서 다시 자르지 않는다.
function normalizeScore(value: number): number {
  if (typeof value !== "number") {
    return 0;
  }
  if (!Number.isFinite(value)) {
    return 0;
  }
  return value;
}

/**
 * computeRelativeComparison — 한 좌표의 person 별 metricScore 묶음을 person 간
 * 상대 비교 산출(rank · percentile · mean)로 축약하는 결정적 순수 함수
 * (REQ-036 상대 비교 축).
 *
 * 알고리즘:
 *   1. 각 entry 의 `metricScore` 를 정규화한다 — 비-number / 비유한수는 0 절하.
 *      절하 결과가 산출과 `byPerson[].metricScore` 에 그대로 실린다(은폐 없음).
 *      같은 `personId` 가 2 회 이상 등장하면 좌표 계약 위반으로 throw 한다.
 *   2. 정규화 점수 **내림차순** 정렬 후 1-based competition ranking 을 매긴다 —
 *      동점은 같은 rank, 다음 rank 는 동점 인원 수만큼 건너뛴다(1,1,3).
 *      동점 내부 순서는 입력 최초 등장 순서를 보존한다(결정적 tie-break).
 *   3. person 별 percentile = 자신보다 **낮은** 점수 인원 수 / cohortSize × 100 을
 *      RELATIVE_COMPARISON_PRECISION 자리에서 round 한다. 최하위는 0, 동점자는
 *      서로 같은 값을 받는다.
 *   4. cohort 평균(mean) = 정규화 점수의 산술 평균을 같은 정밀도로 round 한다.
 *
 * 방어:
 *   - 빈 배열 → `{ cohortSize: 0, mean: 0, byPerson: [] }`
 *     (`aggregateMetricScore` 의 빈 입력 결정적 0 정합, throw 하지 않는다).
 *   - 입력 배열·원소를 변형하지 않고 새 객체만 반환한다(부수효과 0).
 *   - throw 경로는 2 종뿐이다 — `entries` 자체가 null/undefined 인 계약 위반,
 *     그리고 같은 `personId` 중복 등장(조용한 병합이 cohort 크기를 왜곡).
 *
 * @param entries 한 좌표의 person 별 입력 배열. 변형하지 않는다.
 * @returns cohort 크기 · 평균 · person 별 상대 위치.
 * @throws {TypeError} `entries` 가 null / undefined 일 때(입력 계약 위반).
 * @throws {TypeError} 같은 `personId` 가 2 회 이상 등장할 때(좌표 계약 위반).
 */
export function computeRelativeComparison(
  entries: RelativeComparisonEntry[],
): RelativeComparisonResult {
  if (entries === null || entries === undefined) {
    throw new TypeError(
      "computeRelativeComparison: entries 는 null/undefined 일 수 없습니다",
    );
  }

  // 정규화 + 중복 personId 조기 노출. seen 은 좌표당 person 1 행 계약의 검사기다.
  const seen = new Set<string>();
  const normalized: NormalizedEntry[] = entries.map((entry, order) => {
    if (seen.has(entry.personId)) {
      throw new TypeError(
        `computeRelativeComparison: personId 가 중복되었습니다(좌표당 person 1 행 계약 위반): ${entry.personId}`,
      );
    }
    seen.add(entry.personId);
    return {
      personId: entry.personId,
      metricScore: normalizeScore(entry.metricScore),
      order,
    };
  });

  const cohortSize = normalized.length;
  // 빈 cohort → 결정적 0 (분모 보호 + aggregate 빈 입력 규약 정합).
  if (cohortSize === 0) {
    return { cohortSize: 0, mean: 0, byPerson: [] };
  }

  const scoreSum = normalized.reduce(
    (sum, entry) => sum + entry.metricScore,
    0,
  );
  const mean = roundTo(scoreSum / cohortSize, RELATIVE_COMPARISON_PRECISION);

  // 점수 내림차순 정렬. 동점은 입력 최초 등장 순서(order 오름차순)로 결정적
  // tie-break — 원본 배열을 건드리지 않도록 복사본을 정렬한다(입력 비변형).
  const sorted = [...normalized].sort((left, right) => {
    if (right.metricScore !== left.metricScore) {
      return right.metricScore - left.metricScore;
    }
    return left.order - right.order;
  });

  // 동점 그룹 단위로 rank · percentile 을 한 번에 확정한다(정렬 1 회 후 단일 순회).
  const byPerson: PersonRelativeStanding[] = [];
  let cursor = 0;
  while (cursor < cohortSize) {
    // [cursor, groupEnd) = 같은 점수의 동점 그룹.
    let groupEnd = cursor + 1;
    while (
      groupEnd < cohortSize &&
      sorted[groupEnd].metricScore === sorted[cursor].metricScore
    ) {
      groupEnd += 1;
    }

    // competition ranking — 그룹 rank = 앞선 인원 수 + 1. 다음 그룹의 rank 는
    // groupEnd + 1 이 되어 동점 인원 수만큼 자연히 건너뛴다(1,1,3).
    const rank = cursor + 1;
    // 자신보다 낮은 점수 인원 수 = cohortSize - (동점 그룹 끝까지의 누적 인원 수).
    // 최하위 그룹은 groupEnd === cohortSize 라 항상 0 이다.
    const percentile = roundTo(
      ((cohortSize - groupEnd) / cohortSize) * 100,
      RELATIVE_COMPARISON_PRECISION,
    );

    for (let index = cursor; index < groupEnd; index += 1) {
      byPerson.push({
        personId: sorted[index].personId,
        metricScore: sorted[index].metricScore,
        rank,
        percentile,
      });
    }
    cursor = groupEnd;
  }

  return { cohortSize, mean, byPerson };
}
