// period-window-filter — 수집된 Activity[] 중 지정 기간 창 안의 활동만 남기는 부수효과 0
// 순수 함수 모듈. DI/DB/네트워크 0 (author-filter.ts / commit-dedup.ts 의 도메인 순수
// 함수 패턴 mirror). README 9 행("사용자가 지정한 기간동안 어떠한 주요 활동") · 178 행
// ("조회 기간(일/주/월 + 시작 시점)") 계약이 요구하는 **기간 상한** 을 in-memory 로
// 강제한다 — 수집 layer 는 상한을 표현할 자리가 없고(GitHub issues/pulls 의 `since` 는
// updated-at 기준, Confluence 는 since 축 자체가 없음) 하한조차 실효 강제가 아니라,
// 평가 직전 이 창 필터가 기간 계약의 실질 경계다.
//
// 판정 규칙:
//   - (a) 반열림 `[since, until)` — `since` 는 inclusive(`timestamp >= since`),
//     `until` 은 exclusive(`timestamp < until`). 이 경계 의미론은 본 모듈이 새로
//     정하는 것이 아니라 ADR-0050(KST period 경계) 과
//     `src/assessment-evaluation/domain/period-evaluable.ts` 40~59 행 `computePeriodEnd`
//     ("periodStart 가 속한 KST period 의 종료 시각 = 반열림 `[start, end)` 의 end")
//     가 이미 박제한 것을 그대로 따른다. 본 모듈은 경계를 **산출하지 않는다** —
//     호출처가 넘긴 좌표로 거르기만 한다.
//   - (b) 두 bound 가 모두 `undefined` 면 **무필터** — 입력 순서를 보존한 새 배열을
//     반환한다(입력 배열 미변형). 상한 배선 전 호출 형태(`{ since }` 만)와 배선 후
//     형태를 같은 함수로 흡수하기 위한 항등 분기다.
//   - (c) bound 문자열이 파싱 불가(`Number.isNaN(Date.parse(bound))`)면 `RangeError`
//     를 throw 한다 — Invalid Date 가 조용히 전파돼 모든 비교가 false 가 되면 결과가
//     "빈 평가"로 위장되므로, `period-evaluable.ts` · `parseKstPeriodInput` 의 명시적
//     reject 관행과 동일하게 입구에서 fail-fast 한다.
//   - (d) activity 의 `timestamp` 가 파싱 불가면 **보존** 한다. 판정 불가 활동을 임의
//     폐기하면 사용자 기여가 평가에서 통째로 누락되지만, 과다 포함은 평가문에 기간
//     밖 활동이 섞이는 정도로 그친다 — 누락(회복 불가)보다 과다 포함(사후 정정 가능)
//     쪽을 택한 보수적 선택이다.
//   - (e) `since > until`(빈 창)은 throw 하지 않고 **빈 배열** 을 반환한다 — 어떤
//     timestamp 도 두 조건을 동시에 만족할 수 없다는 비교 결과의 자연 산출이며,
//     호출처가 산출한 창이 비었다는 사실 자체는 error 가 아니다.
//
// 책임 경계: 기간 경계 **산출**(granularity → [start, end))은 period-evaluable /
// kst-period-range 몫이고, 수집 query 축(`until`)의 source-side 추가는 별도 판단
// (GitHub REST 의 `until` 은 commits 만 지원)이다. 본 함수는 Activity[] → 창 안
// Activity[] 변환까지만(입력 미변형, 순서 보존, 동기 순수).

import { Activity } from "./activity";

// ActivityPeriodWindow — 필터가 받는 반열림 창 좌표. 두 bound 모두 optional 이라
// 하한만 / 상한만 / 양쪽 / 무필터 4 분기를 하나의 입력 타입으로 표현한다.
export interface ActivityPeriodWindow {
  // 창 시작(inclusive, ISO-8601). 미지정이면 하한 없음.
  since?: string;
  // 창 종료(exclusive, ISO-8601). 미지정이면 상한 없음.
  until?: string;
}

// parseBound — bound 문자열을 epoch ms 로 변환한다. 미지정이면 undefined(무경계),
// 파싱 불가면 RangeError(규칙 (c) fail-fast). label 은 어느 bound 가 잘못됐는지
// 호출처가 바로 알 수 있게 메시지에 넣는다.
function parseBound(
  label: string,
  bound: string | undefined,
): number | undefined {
  if (bound === undefined) {
    return undefined;
  }
  const parsed = Date.parse(bound);
  if (Number.isNaN(parsed)) {
    throw new RangeError(
      `파싱 불가한 기간 경계 ${label}: "${bound}" (ISO-8601 문자열이어야 한다)`,
    );
  }
  return parsed;
}

// filterActivitiesByPeriodWindow — activities 중 반열림 창 `[since, until)` 안의
// 활동만 남긴 새 배열을 반환한다(입력 순서 보존, 부수효과 0, 입력 배열 미변형).
// 판정 규칙 (a)~(e) 는 파일 head 주석 참조.
export function filterActivitiesByPeriodWindow(
  activities: Activity[],
  window: ActivityPeriodWindow,
): Activity[] {
  // bound 파싱은 루프 밖에서 1 회 — 잘못된 bound 는 활동 순회 전에 throw 된다(c).
  const sinceMs = parseBound("since", window.since);
  const untilMs = parseBound("until", window.until);

  // (b) 무필터 — 새 배열 복사본을 반환해 호출처가 원본을 공유하지 않게 한다.
  if (sinceMs === undefined && untilMs === undefined) {
    return [...activities];
  }

  return activities.filter((activity) => {
    const at = Date.parse(activity.timestamp);
    // (d) 판정 불가 timestamp 는 보존(과다 포함 > 누락).
    if (Number.isNaN(at)) {
      return true;
    }
    // (a) since inclusive / until exclusive. (e) since > until 이면 둘을 동시에
    // 만족하는 at 이 없어 자연히 빈 배열이 된다.
    if (sinceMs !== undefined && at < sinceMs) {
      return false;
    }
    if (untilMs !== undefined && at >= untilMs) {
      return false;
    }
    return true;
  });
}
