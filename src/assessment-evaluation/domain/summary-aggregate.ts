// summary-aggregate — 한 (person, period, periodStart) 좌표의 단위 평가 결과
// (`EvaluationResult[]`)를 단일 `Summary.metricScore` 수치로 축약하는 deterministic
// 순수 함수 layer (ADR-0035 §Decision 1). LLM 호출 0 / DB 0 / 부수효과 0 — 동일
// 입력은 항상 동일 출력(referential transparency). NestJS `@Injectable` 미사용,
// Prisma client import 0. `evaluation-result.persist.mapper.ts`(다신호 deterministic
// 집계 precedent: volume Σ / difficulty 최대 / contributionScore 평균)의 헬퍼를
// 재사용해 단위↔요약 집계 규칙의 정합을 보장한다.
//
// 왜 영속 source(`Contribution[]`)가 아니라 `EvaluationResult[]` 를 입력으로 받는가:
// ADR-0035 §Decision 1 은 "영속 `Contribution[]` 우선" 방향을 박제하되 in-memory
// `EvaluationResult[]` 도 허용한다. 본 slice 는 도메인 순수성(이 디렉토리는 의존성 0
// 도메인 타입만 import)을 지키기 위해 `EvaluationResult`(이 디렉토리 내 타입)를 입력
// 타입으로 선택한다 — `Contribution`(user 영속 module 타입)을 import 하면 도메인→영속
// 역의존이 생긴다. `mapEvaluationResultsToAssessment` 역시 동일 입력 타입을 쓰며 본
// 함수가 그 매퍼의 contribution 집계 헬퍼를 재사용하므로 두 집계가 동형이다. write
// service slice 가 영속 `Contribution[]` 에서 집계할 경우 그 좌표의 동일 평가-파생
// 필드(difficulty / contributionScore(level) / volume)를 `EvaluationResult` 형태로
// 재구성해 본 함수에 흘려보내면 된다(좌표 동일성, ADR-0035 §Decision 2).
//
// REQ-032 raw 미저장: 입력 타입 `EvaluationResult` 가 raw 본문 필드를 애초에 보유하지
// 않으므로 metricScore 산출에 raw 가 끼어들 표면이 없다(상류 계약 보존).

import type { EvaluationResult } from "./evaluation-result";
import {
  contributionLevelToScore,
  DIFFICULTY_ORDER,
} from "./evaluation-result.persist.mapper";

// 신호별 가중치 — metricScore 축약 수식의 핵심 계수. 세 신호(난이도·기여도·양)를
// 어떻게 1 Decimal 로 합치는지를 single source 로 박제한다. 가중치 자체는 v1 baseline
// 으로, 향후 시각화/REQ-038 요구가 정밀화되면 spec 과 함께 조정한다(LLM 무관 원칙 유지).
//
// 근거(축약 수식 설계):
//   metricScore = DIFFICULTY_WEIGHT × avg(난이도 ordinal 0~2)
//               + CONTRIBUTION_WEIGHT × avg(기여도 ordinal 0~3)
//               + VOLUME_WEIGHT × log1p(Σ volume)
//
//   - 난이도(difficulty): 등간격 ordinal 0(easy)~2(hard)의 산술 평균. `mapEvaluation
//     ResultsToAssessment` 는 Assessment 컬럼에 "최대"를 쓰지만(보수적 대표값), Summary
//     의 metricScore 는 한 구간 전체 기여의 평균적 난이도를 반영해야 하므로 평균을
//     채택한다 — 한 구간에 hard 1 건 + easy 9 건과 hard 10 건은 같은 사람 노력으로
//     보기 어렵다. 평균이 그 차이를 보존한다.
//   - 기여도(contribution): `contributionLevelToScore` 의 등간격 ordinal 0(zero)~
//     3(high)의 산술 평균. 매퍼의 contributionScore 평균과 동일 규칙(단위↔요약 정합).
//   - 양(volume): Σ volume 에 `Math.log1p`(= ln(1+x)) 를 적용해 sublinear 압축한다.
//     volume 은 상한이 없어(commit 수·변경 line 수) 선형 가중하면 단일 신호 편중
//     (volume 만 큰 사람이 metricScore 를 독식)이 발생 — REQ-036 상대 비교가 양의
//     다과에만 좌우된다. log 압축은 큰 volume 의 한계 기여를 체감시켜 난이도·기여도
//     품질 신호와 균형을 맞춘다(R-26 "숫자만 늘리기" abusing 완화 정합). log1p 라
//     volume=0 → 0 으로 결정적.
//
// REQ-036 상대 비교 의미 보존: 본 수식은 입력에만 의존하는 결정적 순수 함수이고
// **모든 person 에 동일 규칙이 적용**되므로, 산출된 per-person metricScore 는 서로
// 비교 가능하다(같은 좌표계 위의 점수). 가중치가 한 신호로 편중되지 않게 세 신호를
// 모두 양수 가중하고 volume 은 log 압축해 단조성(더 어려운/더 많이 기여한/더 많은
// 활동 → 더 높은 점수)을 보존한다 — 상대 순위 의미가 왜곡되지 않는다.
const DIFFICULTY_WEIGHT = 1;
const CONTRIBUTION_WEIGHT = 1;
const VOLUME_WEIGHT = 1;

// metricScore 의 소수 정밀도(Decimal 직렬화 안정성). 부동소수점 잔차를 잘라 동일
// 입력이 동일 문자열 Decimal 로 영속되도록 결정적으로 round 한다.
const METRIC_SCORE_PRECISION = 6;

// roundTo — value 를 precision 자리에서 결정적으로 round. 부동소수점 누적 오차로 인한
// 비결정성을 차단한다(같은 입력 → 같은 출력 보장의 마지막 단계).
function roundTo(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

// aggregateMetricScore — 한 좌표의 단위 `EvaluationResult[]` 를 단일 metricScore 로
// 축약하는 진입 순수 함수(ADR-0035 §Decision 1). 반환 타입은 `number` —
// `AssessmentCreateInput.contributionScore`(L58) 가 Prisma Decimal 컬럼을 `Prisma.
// Decimal | number | string` 로 받는 것과 동형으로, plain number 는 Prisma 가 Summary.
// metricScore(Decimal) 입력 시 내부 변환한다(write service slice 책임). 빈 입력은
// 결정적으로 0(`mapEvaluationResultsToAssessment` 의 빈 입력 zero-aggregate 정합).
//
// 집계 규칙(결정적, 위 가중치 주석의 수식):
//   - 난이도 평균  = avg(DIFFICULTY_ORDER[unit.difficulty])  (빈 입력 0)
//   - 기여도 평균  = avg(contributionLevelToScore(unit.contribution))  (빈 입력 0)
//   - volume 압축  = log1p(Σ unit.volume)
//   - metricScore  = Σ(weight × signal) 후 precision round
export function aggregateMetricScore(results: EvaluationResult[]): number {
  // 빈 묶음 → 0(정의된 동작). div-by-zero 방어 + 매퍼 빈 입력 정합.
  if (results.length === 0) {
    return 0;
  }

  let difficultySum = 0;
  let contributionSum = 0;
  let volumeSum = 0;
  for (const unit of results) {
    // difficulty ordinal — DIFFICULTY_ORDER(easy=0/medium=1/hard=2) 재사용.
    // 알 수 없는 난이도(타입 우회)는 undefined → 산술에서 NaN 전파를 막기 위해 0 으로
    // 절하(매퍼 aggregateDifficulty 가 unknown 을 easy 로 절하하는 보수성 mirror).
    const difficultyOrdinal = DIFFICULTY_ORDER[unit.difficulty] ?? 0;
    difficultySum += difficultyOrdinal;
    // contribution ordinal — `contributionLevelToScore` 재사용(zero=0~high=3).
    // 알 수 없는 등급은 매퍼 헬퍼가 throw 해 조기 노출(R-112 error path 정합).
    contributionSum += contributionLevelToScore(unit.contribution);
    volumeSum += unit.volume;
  }

  const difficultyAvg = difficultySum / results.length;
  const contributionAvg = contributionSum / results.length;
  // log1p(Σvolume) — sublinear 압축으로 volume 편중 방지. Σvolume≥0 이라 log1p≥0.
  const volumeSignal = Math.log1p(volumeSum);

  const metricScore =
    DIFFICULTY_WEIGHT * difficultyAvg +
    CONTRIBUTION_WEIGHT * contributionAvg +
    VOLUME_WEIGHT * volumeSignal;

  return roundTo(metricScore, METRIC_SCORE_PRECISION);
}
