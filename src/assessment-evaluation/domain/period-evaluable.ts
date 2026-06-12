// period-evaluable — aggregate 평가 시점 판정 순수 함수(ADR-0035 §Decision 3).
// 평가 대상 구간 `[periodStart, periodEnd)` 가 **완전히 종료된 후**(`now ≥ periodEnd`)
// 에만 해당 period 의 Summary 생성을 허용한다(README L61~L62 자정/주/월 경계). LLM 0
// / DB 0 / 부수효과 0 — `now` 를 인자로 주입받는 결정적 순수 함수라 mocked 없이 검증
// 가능하다. NestJS `@Injectable` 미사용, Prisma import 0.
//
// 본 함수는 "언제 평가 **가능**한가"(permission)만 판정한다. "언제 평가를 **발화**하는
// 가"(trigger/scheduling, @nestjs/schedule cron)는 본 slice 밖이다(ADR-0035 §Decision
// 3 — scheduler 자동화 OUT, 새 dep / P7). manual trigger + 본 게이트만으로 aggregate
// 평가 layer 는 dependency-free 로 완결된다.
//
// timezone(ADR-0039 확정): "자정" / "다음 주 시작" / "다음 달 시작" 경계는 **Asia/Seoul
// (KST) 기준**이다(ADR-0039 §Decision 3 — (a) 일별 = KST 자정, (b) 주간 = KST 월요일
// 00:00, (c) 월간 = KST 매월 1 일 00:00, 모두 반열림 `[start, end)`). 입출력 Date 는
// 전부 UTC instant 그대로 보존한다(ADR-0012 §1 저장 UTC — KST 는 boundary 계산 내부에만
// 존재). boundary 산술은 본 파일이 직접 수행하지 않고 `src/common/period-boundary.ts`
// helper 1 곳을 경유한다(ADR-0039 §Decision 5 — boundary 계산 중복 금지, drift 차단).
// 호출자는 periodStart 를 KST boundary 시각으로 정규화해 넘긴다는 계약(정상 경로)을
// 전제하며, 비정규 입력은 helper 가 ADR-0039 §Decision 3 boundary 로 snap 한다(아래
// computePeriodEnd 주석 참조).

import {
  getKstPeriodRange,
  type PeriodGranularity as BoundaryGranularity,
} from "../../common/period-boundary";
import { VALID_PERIODS } from "../../user/assessment.service";

// PeriodGranularity — day/week/month 의 literal union. `VALID_PERIODS` single source
// (assessment.service.ts L40, ADR-0035 §Decision 2 granularity 재사용)에서 파생한다.
export type PeriodGranularity = (typeof VALID_PERIODS)[number];

// domain granularity → helper granularity 매핑. domain 의 "day"/"week"/"month" 는
// ADR-0006 enum-as-String DB 저장값이라 rename 금지 — helper 의 "daily"/"weekly"/
// "monthly" 와 식별자가 달라 본 매핑 상수로 변환한다(매핑 책임은 domain 쪽, T-0357).
const PERIOD_TO_BOUNDARY_GRANULARITY: Record<
  PeriodGranularity,
  BoundaryGranularity
> = {
  day: "daily",
  week: "weekly",
  month: "monthly",
};

// isValidPeriod — 임의 string 이 허용 granularity 집합 멤버인지 판정하는 순수
// type-guard. 알 수 없는 period 의 조기 reject(throw) 근거.
export function isValidPeriod(value: string): value is PeriodGranularity {
  return (VALID_PERIODS as readonly string[]).includes(value);
}

// computePeriodEnd — periodStart 가 **속한** KST period 의 종료 시각(반열림
// `[start, end)` 의 end)을 `getKstPeriodRange` 위임으로 산출한다(ADR-0039 §Decision 3).
//   - day   = periodStart 가 속한 KST 달력일의 다음 KST 자정
//   - week  = periodStart 가 속한 KST 주(월요일 anchor)의 다음 KST 월요일 자정
//   - month = periodStart 가 속한 KST 월의 다음 월 1 일 KST 자정(28~31 일 가변)
// KST boundary 로 정규화된 입력(계약상 정상 경로)에는 기존 +1 granularity 와 동치이고,
// 비정규 입력은 §Decision 3 boundary 로 snap 된다(week 의 옛 "임의 요일 +7 일" 의미는
// ADR 위반이라 폐기). 자체 setUTCDate/setUTCMonth 달력 산술은 제거 — 특히 옛
// setUTCMonth(+1) 은 KST 월초 입력(= 직전 UTC 월 말일 15:00Z)에서 day overflow 로
// 한 달 +1 일 drift 를 내던 실결함이었다(T-0357 regression test 박제). 알 수 없는
// period 는 throw, Invalid Date 는 helper 의 명시적 TypeError 가 전파된다.
export function computePeriodEnd(period: string, periodStart: Date): Date {
  if (!isValidPeriod(period)) {
    throw new Error(
      `알 수 없는 period: "${period}" (허용: ${VALID_PERIODS.join("/")})`,
    );
  }
  return getKstPeriodRange(PERIOD_TO_BOUNDARY_GRANULARITY[period], periodStart)
    .end;
}

// isPeriodEvaluable — 평가 대상 구간이 완전히 종료됐는지(`now ≥ periodEnd`) 판정하는
// 진입 순수 함수(ADR-0035 §Decision 3). 반열림 `[periodStart, periodEnd)` 종료 직후
// (now == periodEnd)부터 평가 가능 — 진행 중(now < periodEnd) 구간은 미평가.
//   - true  : now ≥ periodEnd (구간 종료, 평가 허용)
//   - false : now < periodEnd (진행 중, 미평가)
// 알 수 없는 period 는 computePeriodEnd 가 throw(R-112 error path).
//
// @param period      "day" / "week" / "month" granularity.
// @param periodStart 구간 시작 시각(KST boundary 로 정규화돼 주어짐 — 위 timezone
//                    주석 참조).
// @param now         판정 기준 현재 시각(주입 — 테스트 가능성·결정성).
// @returns now ≥ periodEnd 면 true.
export function isPeriodEvaluable(
  period: string,
  periodStart: Date,
  now: Date,
): boolean {
  const periodEnd = computePeriodEnd(period, periodStart);
  return now.getTime() >= periodEnd.getTime();
}
