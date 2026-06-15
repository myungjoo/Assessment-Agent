// recent-deletion-window — 최근 N일 결과 manual delete 대상 기간 window 산출 순수 helper
// (T-0424, P7 ⑤ slice 1, R-74 / REQ-041). "최근 1일/7일/30일" 처럼 호출자가 지정한
// days 일 동안의 평가 결과를 manual delete → 재수집하기 위해, 그 대상 기간을 KST 일
// 경계에 snap 된 반열림 구간 [start, end) 로만 산출한다. 실 삭제/재수집은 후속 slice 가
// 본 출력을 소비한다 — 본 helper 는 DB·trigger·repository 호출 0 (Out of Scope).
//
// 일 경계 산출은 반드시 period-boundary.ts 의 KST helper 에 위임한다 (ADR-0039
// §Decision5 — boundary 계산 single source, hardcoded +09:00 산술 금지). 본 파일은
// startOfKstDay / getKstPeriodRange("daily", ...) 를 재사용하고 자체 경계 snap 을
// 두지 않는다 (backfill-plan.ts 와 동형).
import {
  getKstPeriodRange,
  PeriodRange,
  startOfKstDay,
} from "../common/period-boundary";

// days 기본값 = 1 (R-74 명시 예 중 최소). 호출자가 항상 명시하는 것을 권장하나,
// 단일 합리적 기본값을 둬 "최근 하루" 호출을 간결히 한다.
const DEFAULT_DAYS = 1;
// 상한 가드 = 366 일 (1년, 윤년 여유 포함). 초과 요청은 과도 삭제 window 로 보고 거부.
const MAX_DAYS = 366;
// 하루의 ms — 일 경계는 KST helper 로 도출하되, "days 일 전" 으로 물러서기 위한 근사
// instant 산출에만 사용한다 (실제 경계 snap 은 전적으로 startOfKstDay 책임).
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// days 인자 검증 — 정수 + 1 이상 + 상한 이하 분기. 위반 시 RangeError.
function assertValidDays(days: number): void {
  if (!Number.isInteger(days) || days <= 0) {
    throw new RangeError(
      `buildRecentDeletionWindow: days 는 1 이상의 정수여야 합니다 (받음: ${days})`,
    );
  }
  if (days > MAX_DAYS) {
    throw new RangeError(
      `buildRecentDeletionWindow: days 상한(${MAX_DAYS}일=1년) 초과 (받음: ${days})`,
    );
  }
}

// buildRecentDeletionWindow — 기준 instant reference 가 속한 KST 일의 끝(다음날 00:00
// KST)을 window 의 end 로, 그 시점에서 days 일 전 KST 일 시작을 start 로 하는 반열림
// 구간 [start, end) 를 반환한다. window 폭은 정확히 days KST 일이며 양 경계가 KST 자정에
// snap 된다.
//
// reference 가 Date instance 가 아니거나 Invalid Date 면 위임 helper(getKstPeriodRange /
// startOfKstDay)의 assertValidDate 가 TypeError 를 throw 한다. days 검증은
// assertValidDays 가 RangeError 로 거부한다.
export function buildRecentDeletionWindow(
  reference: Date,
  days: number = DEFAULT_DAYS,
): PeriodRange {
  assertValidDays(days);
  // reference 일의 [start, end) — end = 다음 KST 자정. 비-Date / Invalid Date 면 여기서
  // TypeError 전파. 본 end 가 window 의 end (가장 최근 경계).
  const end = getKstPeriodRange("daily", reference).end;

  // days 일 전 KST 일 시작을 start 로 snap. ONE_DAY_MS 누산은 "그 날 안의 어떤 instant"
  // 를 만들기 위한 근사일 뿐 — 실제 경계는 startOfKstDay 가 정확히 도출한다 (DST 무관).
  const instantInStartDay = new Date(end.getTime() - days * ONE_DAY_MS);
  const start = startOfKstDay(instantInStartDay);

  return { start, end };
}
