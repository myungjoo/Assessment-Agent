// 최근 N일 재수집 대상 좌표 계획 (REQ-041, README 58 · 74 행). 진행 중인 오늘은 평가하지 않으므로
// (README 61 행) 창은 어제로 끝나는 닫힌 N 일이다. 경계는 KST helper 만 쓴다 (ADR-0039 §Decision5).
import type { EvaluationPersistContext } from "../assessment-evaluation/domain/evaluation-result.persist.mapper";
import {
  getKstPeriodRangeByPeriod,
  startOfKstDay,
  type PeriodRange,
} from "../common/period-boundary";

import { buildRecentDeletionWindow } from "./recent-deletion-window";

const REFRESH_PERIODS = ["day", "week", "month"];
const REFRESH_SCOPE = "aggregate";

export interface StoredCoordinate {
  period: string;
  scope: string;
  periodStart: Date;
}

export interface RefreshCoordinate extends EvaluationPersistContext {
  // 이 좌표에 저장본이 있었는지 — 교체 성공 시 삭제 건수로 센다.
  hadRow: boolean;
}

export interface RecentRefreshPlan {
  coordinates: RefreshCoordinate[];
  // 창 안이지만 기간이 아직 끝나지 않아 건드리지 않는 저장본 수 (예: 이번 주 row).
  openRowCount: number;
}

export function buildClosedDaysWindow(now: Date, days: number): PeriodRange {
  const lastClosedInstant = new Date(startOfKstDay(now).getTime() - 1);
  return buildRecentDeletionWindow(lastClosedInstant, days);
}

function closedAggregateStarts(
  period: string,
  window: PeriodRange,
  now: Date,
): Date[] {
  const starts: Date[] = [];
  let cursor = window.start;
  while (cursor < window.end) {
    const range = getKstPeriodRangeByPeriod(period, cursor);
    if (range.start >= window.start && range.end <= now) {
      starts.push(range.start);
    }
    cursor = range.end;
  }
  return starts;
}

const coordinateKey = (c: StoredCoordinate): string =>
  JSON.stringify([c.period, c.scope, c.periodStart.getTime()]);

/**
 * 창 안의 닫힌 aggregate 좌표 전부 + 창 안에 실제 저장된 좌표를 합친다. 다른 scope 저장본도 그
 * 좌표 그대로 교체한다. `stored` 중 periodStart 가 창 밖인 것은 계획에 들어가지 않는다.
 */
export function planRecentRefresh(
  personId: string,
  stored: readonly StoredCoordinate[],
  window: PeriodRange,
  now: Date,
): RecentRefreshPlan {
  const coordinates = new Map<string, RefreshCoordinate>();
  for (const period of REFRESH_PERIODS) {
    for (const periodStart of closedAggregateStarts(period, window, now)) {
      const context = { personId, period, scope: REFRESH_SCOPE, periodStart };
      coordinates.set(coordinateKey(context), { ...context, hadRow: false });
    }
  }

  let openRowCount = 0;
  for (const row of stored) {
    if (row.periodStart < window.start || row.periodStart >= window.end) {
      continue;
    }
    if (getKstPeriodRangeByPeriod(row.period, row.periodStart).end > now) {
      openRowCount += 1;
      continue;
    }
    coordinates.set(coordinateKey(row), {
      personId,
      period: row.period,
      scope: row.scope,
      periodStart: row.periodStart,
      hadRow: true,
    });
  }
  return { coordinates: [...coordinates.values()], openRowCount };
}
