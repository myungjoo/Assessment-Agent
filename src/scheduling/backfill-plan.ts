// backfill-plan — 신규 인원 1년치 backfill 의 "무엇을 평가할지" 산출 순수 helper
// (T-0418, P7 ⑤ slice 1, R-50 / REQ-027). 신규 인원이 추가되면 일반 주기(매주 1회)
// 와 별도로 기준 시점 직전 ~1년을 주 단위 window 목록으로 1회 backfill 해야 한다.
// 본 helper 는 그 window 목록만 산출하고 아무 것도 실행하지 않는다 — DB·trigger·실
// 평가 호출 0 (Out of Scope, slice 2~3 가 본 출력을 소비).
//
// 주 경계 산출은 반드시 period-boundary.ts 의 KST helper 에 위임한다 (ADR-0039
// §Decision5 — boundary 계산 single source, hardcoded +09:00 산술 금지). 본 파일은
// getKstPeriodRange("weekly", ...) 를 재사용하고 자체 offset/주 산술을 두지 않는다.
import {
  getKstPeriodRange,
  PeriodRange,
  startOfKstWeek,
} from "../common/period-boundary";

// weeks 기본값 = 52 (약 1년). 일반 인원의 매주 1회 평가와 정합하는 주 단위.
const DEFAULT_WEEKS = 52;
// 상한 가드 = 520 주 (10년). 초과 요청은 abuse / 과도 backfill 로 보고 거부.
const MAX_WEEKS = 520;
// 한 주의 ms — 주 경계는 KST helper 로 도출하되, "직전 주" 로 한 칸 물러서기 위한
// 안전 마진 instant 산출에만 사용한다 (실제 경계 snap 은 전적으로 KST helper 책임).
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// weeks 인자 검증 — 정수 + 1 이상 + 상한 이하 분기. 위반 시 RangeError.
function assertValidWeeks(weeks: number): void {
  if (!Number.isInteger(weeks) || weeks <= 0) {
    throw new RangeError(
      `buildBackfillPlan: weeks 는 1 이상의 정수여야 합니다 (받음: ${weeks})`,
    );
  }
  if (weeks > MAX_WEEKS) {
    throw new RangeError(
      `buildBackfillPlan: weeks 상한(${MAX_WEEKS}주=10년) 초과 (받음: ${weeks})`,
    );
  }
}

// buildBackfillPlan — 기준 instant reference 가 속한 KST 주를 포함해 직전 weeks 개의
// 주 단위 PeriodRange 를 시간순(가장 오래된 주가 index 0)으로 산출한다. 반환 배열은
// 정확히 weeks 개이며 인접 window 는 경계가 맞닿되 겹치지 않는다 (앞 end == 다음 start).
//
// reference 가 Date instance 가 아니거나 Invalid Date 면 위임 helper(startOfKstWeek /
// getKstPeriodRange)의 assertValidDate 가 TypeError 를 throw 한다. weeks 검증은
// assertValidWeeks 가 RangeError 로 거부한다.
export function buildBackfillPlan(
  reference: Date,
  weeks: number = DEFAULT_WEEKS,
): PeriodRange[] {
  assertValidWeeks(weeks);
  // reference 주의 시작(KST 월요일 00:00). 비-Date / Invalid Date 면 여기서 TypeError 전파.
  const referenceWeekStart = startOfKstWeek(reference);

  const ranges: PeriodRange[] = [];
  // 가장 오래된 주(reference 주 기준 weeks-1 주 전)부터 reference 주까지 시간순으로 채운다.
  // 각 주의 경계는 KST helper 가 snap 하므로 ONE_WEEK_MS 누산은 "그 주 안의 어떤 instant"
  // 를 만들기 위한 근사일 뿐 — 실제 [start, end) 는 getKstPeriodRange 가 정확히 도출한다.
  for (let offset = weeks - 1; offset >= 0; offset -= 1) {
    const instantInWeek = new Date(
      referenceWeekStart.getTime() - offset * ONE_WEEK_MS,
    );
    ranges.push(getKstPeriodRange("weekly", instantInWeek));
  }
  return ranges;
}
