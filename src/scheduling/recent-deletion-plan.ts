// recent-deletion-plan — 최근 N일 결과 manual delete 대상 산출 순수 조립 helper
// (T-0426, P7 ⑤ slice 1c, R-74 / REQ-041). slice 1(T-0424, buildRecentDeletionWindow)
// 이 "어느 기간을 지울지"([start, end) PeriodRange)를, slice 1b(T-0425,
// selectInDeletionWindow)가 "주어진 instant 들 중 무엇이 그 기간에 드는가"를 각각 따로
// 산출했다면, 본 slice 는 그 둘을 **순수 조립**해 호출자 한 번의 입력(reference 시점 +
// days + 후보 결과 instant 목록)으로 "최종 삭제 대상 / 보존 대상" plan 을 산출하는 단일
// 진입점을 박제한다. 실 삭제 runner(slice 2)가 본 plan 을 소비한다 — 본 helper 는
// DB·trigger·repository·module 호출 0 이며 자체 경계/필터 산술도 두지 않는다 (backfill-plan
// → backfill runner 분리와 동형: plan 먼저, 실행 후속).
//
// 두 building block 의 시그니처/로직을 **재구현하지 않는다** — 호출만 한다. 인자 검증도
// 자체 중복 없이 building block 에 위임/전파한다 (backfill-plan.ts 동형).
import { PeriodRange } from "../common/period-boundary";

import { selectInDeletionWindow } from "./deletion-window-select";
import { buildRecentDeletionWindow } from "./recent-deletion-window";

// 최종 삭제 plan — reference/days 로 산출한 삭제 기간 window 와, 후보 instants 를 그 window
// 반열림 규칙 [start, end) 으로 분류한 두 도메인 배열. toDelete + toKeep 의 합집합은 입력
// instants 와 동일(중복/누락 0)하며 각 배열은 입력 순서를 보존한다.
export interface RecentDeletionPlan {
  // 산출된 삭제 기간 [start, end) — buildRecentDeletionWindow 출력 그대로(KST 일 경계 snap).
  window: PeriodRange;
  // window 안(= 삭제 대상) instant — 반열림 [start, end): start 포함, end 배타.
  // selectInDeletionWindow 의 inWindow 를 도메인 라벨(삭제 대상)로 매핑.
  toDelete: Date[];
  // window 밖(= 보존) instant — instant < start 또는 instant >= end.
  // selectInDeletionWindow 의 outOfWindow 를 도메인 라벨(보존 대상)로 매핑.
  toKeep: Date[];
}

// buildRecentDeletionPlan — reference 시점과 days 로 삭제 기간 window 를 산출하고(slice 1),
// 그 window 와 후보 instants 를 분류해(slice 1b) "삭제 대상(toDelete = window 안) / 보존
// 대상(toKeep = window 밖)" plan 을 반환한다. 본 함수는 두 building block 호출만 하며 자체
// 경계 산술/필터 산술을 두지 않는다 (backfill-plan.ts 동형). 입력 instants 배열을 변형하지
// 않고 새 배열을 반환한다(non-mutating). 빈 instants 는 정상(빈 toDelete/toKeep, error 아님).
//
// 인자 검증은 building block 에 위임/전파한다: days 정수 아님/0 이하/상한 초과 →
// buildRecentDeletionWindow 의 RangeError, 비-Date / Invalid Date reference → 위임 helper
// 의 TypeError, instants 비-배열/원소 Invalid → selectInDeletionWindow 의 TypeError.
export function buildRecentDeletionPlan(
  reference: Date,
  days: number,
  instants: ReadonlyArray<Date>,
): RecentDeletionPlan {
  // (1) 삭제 기간 window 산출 — days 검증(RangeError) + reference 검증(TypeError) 위임 전파.
  const window = buildRecentDeletionWindow(reference, days);

  // (2) 후보 instants 를 window 반열림 규칙으로 분류 — instants 비-배열/원소 Invalid 면
  // 여기서 TypeError 전파. window 는 (1) 산출물이라 항상 유효 [start, end).
  const selection = selectInDeletionWindow(window, instants);

  // (3) 도메인 의미로 매핑 — in-window = 삭제 대상, out-of-window = 보존 대상.
  return {
    window,
    toDelete: selection.inWindow,
    toKeep: selection.outOfWindow,
  };
}
