// summary-batch-outcome.spec — R-61 요약 평가 batch outcome 집계 순수 composer 검증.
// 순수 함수라 시스템 시계 미사용 — periodStart 는 전부 고정 Date instance 주입으로
// 결정성 확보. happy / error / branch / negative 케이스를 박제한다(R-112).
// `SummaryBatchPlanEntry` / `SummaryAggregateResult` 는 최소 stub 으로 형태만 충족
// (실 LLM/DB 0).

import type { PersistMode } from "../evaluation-result-persist.service";
import type { SummaryAggregateResult } from "../summary-aggregate-orchestrator.service";
import type { SummaryPersistOptions } from "../summary-persist.service";

import type { EvaluationResult } from "./evaluation-result";
import { summarizeSummaryBatchOutcome } from "./summary-batch-outcome";
import type { SummaryBatchPlanEntry } from "./summary-batch-plan";

// 최소 stub — 형태만 충족(실 LLM/DB 0). reference 공유 추적용 marker(unitId)만 둠.
function stubResult(unitId: string): EvaluationResult {
  return {
    unitId,
    narrative: `narrative-${unitId}`,
    difficulty: "medium",
    contribution: "medium",
    volume: 1,
  };
}

const MODE: PersistMode = "reeval";
const OPTIONS: SummaryPersistOptions = { modelId: "test-model" };

// 결정성 확보용 고정 Date instance.
const D1 = new Date("2026-06-14T15:00:00Z");
const D2 = new Date("2026-06-07T15:00:00Z");
const D3 = new Date("2026-05-31T15:00:00Z");

// planEntry — 최소 plan 원소 stub. context/period 가 분류 축이라 핵심, results 는 빈
// 배열로 부착(집계는 results 본문 미접촉 — R-59 정합 검증).
function planEntry(
  personId: string,
  period: string,
  periodStart: Date,
  results: EvaluationResult[] = [],
): SummaryBatchPlanEntry {
  return {
    context: { personId, period, periodStart },
    results,
    mode: MODE,
    options: OPTIONS,
  };
}

describe("summarizeSummaryBatchOutcome — happy path (plan × outcomes zip 집계)", () => {
  it("plan 4개(day/day/week/month) × outcome 4개(평가 3 [created 2 / existing 1], skip 1) → 전역 + byGranularity 분배 정합", () => {
    const plan: SummaryBatchPlanEntry[] = [
      planEntry("alice", "day", D1),
      planEntry("bob", "day", D2),
      planEntry("carol", "week", D2),
      planEntry("dave", "month", D3),
    ];
    const outcomes: SummaryAggregateResult[] = [
      // day / alice → 평가 + created.
      { evaluated: true, result: { summaryId: "s-alice", created: true } },
      // day / bob → 평가 + existing(read-through).
      { evaluated: true, result: { summaryId: "s-bob", created: false } },
      // week / carol → 평가 + created.
      { evaluated: true, result: { summaryId: "s-carol", created: true } },
      // month / dave → 시점 미도래 skip(result 부재).
      { evaluated: false },
    ];

    const report = summarizeSummaryBatchOutcome(plan, outcomes);

    // 전역 카운트.
    expect(report.total).toBe(4);
    expect(report.evaluated).toBe(3);
    expect(report.skipped).toBe(1);
    expect(report.created).toBe(2);
    expect(report.existing).toBe(1);

    // byGranularity 분포 — day 2건(created 1, existing 1).
    expect(report.byGranularity.day).toEqual({
      total: 2,
      evaluated: 2,
      skipped: 0,
      created: 1,
      existing: 1,
    });
    // week 1건(created 1).
    expect(report.byGranularity.week).toEqual({
      total: 1,
      evaluated: 1,
      skipped: 0,
      created: 1,
      existing: 0,
    });
    // month 1건(skip 1).
    expect(report.byGranularity.month).toEqual({
      total: 1,
      evaluated: 0,
      skipped: 1,
      created: 0,
      existing: 0,
    });
    // other 미등장 슬롯도 키 존재 + 값 0 보장.
    expect(report.byGranularity.other).toEqual({
      total: 0,
      evaluated: 0,
      skipped: 0,
      created: 0,
      existing: 0,
    });
  });
});

describe("summarizeSummaryBatchOutcome — error path (fail-fast TypeError 한국어)", () => {
  it("plan === null 이면 한국어 TypeError", () => {
    expect(() =>
      summarizeSummaryBatchOutcome(
        null as unknown as SummaryBatchPlanEntry[],
        [],
      ),
    ).toThrow(TypeError);
    expect(() =>
      summarizeSummaryBatchOutcome(
        null as unknown as SummaryBatchPlanEntry[],
        [],
      ),
    ).toThrow(/plan 배열이 null\/undefined 일 수 없다/);
  });

  it("plan === undefined 이면 한국어 TypeError", () => {
    expect(() =>
      summarizeSummaryBatchOutcome(
        undefined as unknown as SummaryBatchPlanEntry[],
        [],
      ),
    ).toThrow(/plan 배열이 null\/undefined 일 수 없다/);
  });

  it("outcomes === null 이면 한국어 TypeError", () => {
    expect(() =>
      summarizeSummaryBatchOutcome(
        [],
        null as unknown as SummaryAggregateResult[],
      ),
    ).toThrow(/outcomes 배열이 null\/undefined 일 수 없다/);
  });

  it("outcomes === undefined 이면 한국어 TypeError", () => {
    expect(() =>
      summarizeSummaryBatchOutcome(
        [],
        undefined as unknown as SummaryAggregateResult[],
      ),
    ).toThrow(/outcomes 배열이 null\/undefined 일 수 없다/);
  });

  it("plan.length(2) !== outcomes.length(1) → 길이 정합 한국어 TypeError(index zip 누락 차단)", () => {
    const plan = [planEntry("a", "day", D1), planEntry("b", "day", D2)];
    const outcomes: SummaryAggregateResult[] = [{ evaluated: false }];
    expect(() => summarizeSummaryBatchOutcome(plan, outcomes)).toThrow(
      TypeError,
    );
    expect(() => summarizeSummaryBatchOutcome(plan, outcomes)).toThrow(
      /plan 과 outcomes 의 길이가 다르다.*plan\.length=2.*outcomes\.length=1/,
    );
  });

  it("plan.length(0) !== outcomes.length(1) → 길이 정합 한국어 TypeError(역방향)", () => {
    const outcomes: SummaryAggregateResult[] = [{ evaluated: false }];
    expect(() => summarizeSummaryBatchOutcome([], outcomes)).toThrow(
      /plan 과 outcomes 의 길이가 다르다.*plan\.length=0.*outcomes\.length=1/,
    );
  });
});

describe("summarizeSummaryBatchOutcome — branch cover (분기 분리 검증)", () => {
  it("(a) 빈 plan + 빈 outcomes → 모든 카운트 0 + byGranularity 전 버킷 0 + throw 0", () => {
    const report = summarizeSummaryBatchOutcome([], []);
    expect(report).toEqual({
      total: 0,
      evaluated: 0,
      skipped: 0,
      created: 0,
      existing: 0,
      byGranularity: {
        day: { total: 0, evaluated: 0, skipped: 0, created: 0, existing: 0 },
        week: { total: 0, evaluated: 0, skipped: 0, created: 0, existing: 0 },
        month: { total: 0, evaluated: 0, skipped: 0, created: 0, existing: 0 },
        other: { total: 0, evaluated: 0, skipped: 0, created: 0, existing: 0 },
      },
    });
  });

  it("(b) evaluated=true & created=true → created++ 분기 단독 검증", () => {
    const plan = [planEntry("p", "day", D1)];
    const outcomes: SummaryAggregateResult[] = [
      { evaluated: true, result: { summaryId: "s-1", created: true } },
    ];
    const report = summarizeSummaryBatchOutcome(plan, outcomes);
    expect(report.created).toBe(1);
    expect(report.existing).toBe(0);
    expect(report.evaluated).toBe(1);
    expect(report.skipped).toBe(0);
    expect(report.byGranularity.day.created).toBe(1);
    expect(report.byGranularity.day.existing).toBe(0);
  });

  it("(c) evaluated=true & created=false → existing++ 분기 단독 검증", () => {
    const plan = [planEntry("p", "week", D2)];
    const outcomes: SummaryAggregateResult[] = [
      { evaluated: true, result: { summaryId: "s-2", created: false } },
    ];
    const report = summarizeSummaryBatchOutcome(plan, outcomes);
    expect(report.created).toBe(0);
    expect(report.existing).toBe(1);
    expect(report.evaluated).toBe(1);
    expect(report.skipped).toBe(0);
    expect(report.byGranularity.week.existing).toBe(1);
    expect(report.byGranularity.week.created).toBe(0);
  });

  it("(d) evaluated=false → skipped++ 분기 단독 검증(result 미참조)", () => {
    const plan = [planEntry("p", "month", D3)];
    // result 필드를 일부러 누락 — skip 분기가 result 를 참조하면 undefined 접근으로 throw.
    const outcomes: SummaryAggregateResult[] = [{ evaluated: false }];
    const report = summarizeSummaryBatchOutcome(plan, outcomes);
    expect(report.skipped).toBe(1);
    expect(report.evaluated).toBe(0);
    expect(report.created).toBe(0);
    expect(report.existing).toBe(0);
    expect(report.byGranularity.month.skipped).toBe(1);
    expect(report.byGranularity.month.evaluated).toBe(0);
  });
});

describe("summarizeSummaryBatchOutcome — negative cases (경계마다 분리)", () => {
  it("(1) evaluated=true 인데 result 가 undefined(비정상) → evaluated++ 만, created/existing 어느 쪽에도 미집계(분류 불가)", () => {
    const plan = [planEntry("p", "day", D1)];
    // 명세상 evaluated=true 면 result 존재여야 하나 surface optional — 방어적 처리 검증.
    const outcomes: SummaryAggregateResult[] = [{ evaluated: true }];
    const report = summarizeSummaryBatchOutcome(plan, outcomes);
    // evaluated 카운트는 1 — surface 가 true 라고 신고했으므로 그대로 인정.
    expect(report.evaluated).toBe(1);
    // created/existing 은 분류 불가 — 어느 쪽에도 미집계.
    expect(report.created).toBe(0);
    expect(report.existing).toBe(0);
    // skipped 도 0 — evaluated=true 라 skip 아님.
    expect(report.skipped).toBe(0);
    expect(report.byGranularity.day.evaluated).toBe(1);
    expect(report.byGranularity.day.created).toBe(0);
    expect(report.byGranularity.day.existing).toBe(0);
  });

  it("(2) period 가 'year' / 빈 문자열 등 'day'/'week'/'month' 외 값 → 'other' 버킷 + 분포 합산 정합", () => {
    const plan: SummaryBatchPlanEntry[] = [
      planEntry("p1", "year", D1),
      planEntry("p2", "", D2),
      planEntry("p3", "quarter", D3),
    ];
    const outcomes: SummaryAggregateResult[] = [
      { evaluated: true, result: { summaryId: "s-1", created: true } },
      { evaluated: true, result: { summaryId: "s-2", created: false } },
      { evaluated: false },
    ];
    const report = summarizeSummaryBatchOutcome(plan, outcomes);

    // day/week/month 버킷은 전부 0.
    expect(report.byGranularity.day.total).toBe(0);
    expect(report.byGranularity.week.total).toBe(0);
    expect(report.byGranularity.month.total).toBe(0);

    // other 버킷이 모두 흡수.
    expect(report.byGranularity.other).toEqual({
      total: 3,
      evaluated: 2,
      skipped: 1,
      created: 1,
      existing: 1,
    });
    // 전역 합산도 정합.
    expect(report.total).toBe(3);
    expect(report.evaluated).toBe(2);
    expect(report.skipped).toBe(1);
    expect(report.created).toBe(1);
    expect(report.existing).toBe(1);
  });

  it("(3) 전부 skip(outcome 전건 evaluated=false) → evaluated/created/existing 모두 0, skipped=total", () => {
    const plan: SummaryBatchPlanEntry[] = [
      planEntry("p1", "day", D1),
      planEntry("p2", "week", D2),
      planEntry("p3", "month", D3),
    ];
    const outcomes: SummaryAggregateResult[] = [
      { evaluated: false },
      { evaluated: false },
      { evaluated: false },
    ];
    const report = summarizeSummaryBatchOutcome(plan, outcomes);
    expect(report.total).toBe(3);
    expect(report.skipped).toBe(3);
    expect(report.evaluated).toBe(0);
    expect(report.created).toBe(0);
    expect(report.existing).toBe(0);
    expect(report.byGranularity.day.skipped).toBe(1);
    expect(report.byGranularity.week.skipped).toBe(1);
    expect(report.byGranularity.month.skipped).toBe(1);
  });

  it("(4) 전부 created(평가 + 생성) → existing=0, created=evaluated=total", () => {
    const plan: SummaryBatchPlanEntry[] = [
      planEntry("p1", "day", D1),
      planEntry("p2", "week", D2),
      planEntry("p3", "month", D3),
    ];
    const outcomes: SummaryAggregateResult[] = [
      { evaluated: true, result: { summaryId: "s-1", created: true } },
      { evaluated: true, result: { summaryId: "s-2", created: true } },
      { evaluated: true, result: { summaryId: "s-3", created: true } },
    ];
    const report = summarizeSummaryBatchOutcome(plan, outcomes);
    expect(report.total).toBe(3);
    expect(report.evaluated).toBe(3);
    expect(report.created).toBe(3);
    expect(report.existing).toBe(0);
    expect(report.skipped).toBe(0);
    expect(report.byGranularity.day.created).toBe(1);
    expect(report.byGranularity.week.created).toBe(1);
    expect(report.byGranularity.month.created).toBe(1);
  });

  it("(5a) byGranularity 각 버킷의 카운트 합이 전역 합계와 일치(분포 보존 invariant)", () => {
    const plan: SummaryBatchPlanEntry[] = [
      planEntry("p1", "day", D1),
      planEntry("p2", "day", D2),
      planEntry("p3", "week", D2),
      planEntry("p4", "month", D3),
      planEntry("p5", "year", D1), // → other
    ];
    const outcomes: SummaryAggregateResult[] = [
      { evaluated: true, result: { summaryId: "s-1", created: true } },
      { evaluated: true, result: { summaryId: "s-2", created: false } },
      { evaluated: false },
      { evaluated: true, result: { summaryId: "s-4", created: true } },
      { evaluated: true, result: { summaryId: "s-5", created: false } },
    ];
    const report = summarizeSummaryBatchOutcome(plan, outcomes);

    // 분포 보존 invariant — 5 가지 카운트 모두 전 버킷 합 = 전역.
    const buckets = ["day", "week", "month", "other"] as const;
    const sum = (key: keyof typeof report.byGranularity.day): number =>
      buckets.reduce((acc, b) => acc + report.byGranularity[b][key], 0);
    expect(sum("total")).toBe(report.total);
    expect(sum("evaluated")).toBe(report.evaluated);
    expect(sum("skipped")).toBe(report.skipped);
    expect(sum("created")).toBe(report.created);
    expect(sum("existing")).toBe(report.existing);

    // 추가 정합: evaluated + skipped === total (전역).
    expect(report.evaluated + report.skipped).toBe(report.total);
    // created + existing === evaluated (전역 — result 누락 negative 케이스 없음).
    expect(report.created + report.existing).toBe(report.evaluated);
  });

  it("(5b) 입력 배열·원소 비변형(호출 후 원본 동일 — 부수효과 0 / referential transparency)", () => {
    const sharedResults = [stubResult("r1")];
    const plan: SummaryBatchPlanEntry[] = [
      planEntry("alice", "day", D1, sharedResults),
      planEntry("bob", "week", D2),
    ];
    const outcomeResult = { summaryId: "s-1", created: true };
    const outcomes: SummaryAggregateResult[] = [
      { evaluated: true, result: outcomeResult },
      { evaluated: false },
    ];

    // 호출 전 snapshot.
    const planSnapshot = JSON.parse(JSON.stringify(plan));
    const outcomesSnapshot = JSON.parse(JSON.stringify(outcomes));
    const planLength = plan.length;
    const outcomesLength = outcomes.length;

    // 두 번 호출해도 동일 출력(referential transparency).
    const r1 = summarizeSummaryBatchOutcome(plan, outcomes);
    const r2 = summarizeSummaryBatchOutcome(plan, outcomes);
    expect(r1).toEqual(r2);

    // 입력 배열 길이·원소 내용 변형 0.
    expect(plan.length).toBe(planLength);
    expect(outcomes.length).toBe(outcomesLength);
    expect(JSON.parse(JSON.stringify(plan))).toEqual(planSnapshot);
    expect(JSON.parse(JSON.stringify(outcomes))).toEqual(outcomesSnapshot);
    // outcome.result 객체도 mutate 0.
    expect(outcomes[0].result).toBe(outcomeResult);
    expect(outcomeResult).toEqual({ summaryId: "s-1", created: true });
    // plan entry 의 results 참조도 mutate 0(공유 reference 보존).
    expect(plan[0].results).toBe(sharedResults);
  });

  it("(5c) 매 호출마다 새 리포트 객체 + 새 byGranularity 객체 + 새 하위 카운트(공유 mutable 노출 0)", () => {
    const plan = [planEntry("p", "day", D1)];
    const outcomes: SummaryAggregateResult[] = [{ evaluated: false }];

    const r1 = summarizeSummaryBatchOutcome(plan, outcomes);
    const r2 = summarizeSummaryBatchOutcome(plan, outcomes);

    // 리포트 object identity 분리.
    expect(r1).not.toBe(r2);
    expect(r1.byGranularity).not.toBe(r2.byGranularity);
    expect(r1.byGranularity.day).not.toBe(r2.byGranularity.day);
    // r1 의 day 버킷을 mutate 해도 r2 에 누출 0(독립).
    r1.byGranularity.day.skipped = 999;
    expect(r2.byGranularity.day.skipped).toBe(1);
  });
});
