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
// timezone(Q-0026 의존): "자정" / "다음 주 시작" / "다음 달 시작" 경계는 timezone 에
// 의존한다(Asia/Seoul 자정 vs UTC 자정은 9 시간 차). 본 함수는 periodStart / now 를
// **동일 시간 기준(UTC `Date` epoch)** 위에서 산술하며, timezone-aware 경계의 확정은
// [Q-0026 deferred SinceDerivation](docs/STATE.json)의 timezone 보정 결정과 묶어
// 진행한다(ADR-0035 §Decision 3 — SinceDerivation 의 period 경계 + 본 자정 경계에 단일
// timezone 결정을 일관 적용해야 drift 가 없다). 그 전까지 호출자는 periodStart 를
// 운영 timezone 의 구간 시작 시각으로 정규화해 넘긴다는 계약을 전제한다(default:
// periodStart 가 이미 올바른 경계 시각으로 주어짐 — 본 함수는 그 위에 +1 granularity
// 산술만 결정적으로 수행). month 의 가변 일수는 UTC 달력 기준으로 계산한다.

import { VALID_PERIODS } from "../../user/assessment.service";

// PeriodGranularity — day/week/month 의 literal union. `VALID_PERIODS` single source
// (assessment.service.ts L40, ADR-0035 §Decision 2 granularity 재사용)에서 파생한다.
export type PeriodGranularity = (typeof VALID_PERIODS)[number];

// isValidPeriod — 임의 string 이 허용 granularity 집합 멤버인지 판정하는 순수
// type-guard. 알 수 없는 period 의 조기 reject(throw) 근거.
export function isValidPeriod(value: string): value is PeriodGranularity {
  return (VALID_PERIODS as readonly string[]).includes(value);
}

// computePeriodEnd — periodStart 에 1 granularity 를 더한 구간 종료 시각(반열림
// `[start, end)` 의 end)을 결정적으로 산출하는 순수 함수(ADR-0035 §Decision 3).
//   - day   = periodStart + 1 일(= 다음 날 자정)
//   - week  = periodStart + 7 일(= 다음 주 동일 요일 시각)
//   - month = periodStart + 1 달력 month(28~31 일 가변)
// month 는 `setUTCMonth` 로 달력 기준 더하기를 수행한다 — 1/31 + 1month 같은 day
// overflow 시 JS Date 가 자동 정규화하므로(2/31 부재 → 3/2/3) 그 동작에 의존하지 않게
// **연·월만 증가시키고 일은 1 일로 정규화**하지 않는다. periodStart 는 구간 시작
// 경계(예: 월초 자정)로 주어진다는 계약 전제하에 setUTCMonth 가 정확히 다음 달 동일
// 일·시각을 가리킨다(월초 → 다음 월초). 알 수 없는 period 는 throw.
export function computePeriodEnd(period: string, periodStart: Date): Date {
  if (!isValidPeriod(period)) {
    throw new Error(
      `알 수 없는 period: "${period}" (허용: ${VALID_PERIODS.join("/")})`,
    );
  }
  // periodStart 를 mutate 하지 않도록 복제(입력 invariance, 순수성 보존).
  const end = new Date(periodStart.getTime());
  switch (period) {
    case "day":
      end.setUTCDate(end.getUTCDate() + 1);
      break;
    case "week":
      end.setUTCDate(end.getUTCDate() + 7);
      break;
    case "month":
      // 달력 month 더하기 — 가변 일수(28~31)는 setUTCMonth 가 달력 기준으로 처리.
      // 예: 1/1 → 2/1, 1/31 → (2/31 부재) JS 정규화로 3/3 이 아니라 월초 입력 계약상
      // 월초 → 다음 월초로만 쓰이므로 day overflow 가 발생하지 않는다.
      end.setUTCMonth(end.getUTCMonth() + 1);
      break;
  }
  return end;
}

// isPeriodEvaluable — 평가 대상 구간이 완전히 종료됐는지(`now ≥ periodEnd`) 판정하는
// 진입 순수 함수(ADR-0035 §Decision 3). 반열림 `[periodStart, periodEnd)` 종료 직후
// (now == periodEnd)부터 평가 가능 — 진행 중(now < periodEnd) 구간은 미평가.
//   - true  : now ≥ periodEnd (구간 종료, 평가 허용)
//   - false : now < periodEnd (진행 중, 미평가)
// 알 수 없는 period 는 computePeriodEnd 가 throw(R-112 error path).
//
// @param period      "day" / "week" / "month" granularity.
// @param periodStart 구간 시작 시각(운영 timezone 경계로 정규화돼 주어짐 — 위 timezone
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
