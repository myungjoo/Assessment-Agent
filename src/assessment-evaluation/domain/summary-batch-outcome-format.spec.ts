// summary-batch-outcome-format.spec — formatSummaryBatchOutcome 단위 검증.
// happy / error / branch / negative 케이스 박제(R-112 충분 cover). report fixture 는
// 직접 객체 리터럴로 구성(실 summarizeSummaryBatchOutcome 호출 의존 0 — 단위 격리).
// 실 LLM/DB/Prisma 0.

import {
  GRANULARITY_BUCKETS,
  type SummaryBatchOutcomeCounts,
  type SummaryBatchOutcomeReport,
} from "./summary-batch-outcome";
import { formatSummaryBatchOutcome } from "./summary-batch-outcome-format";

// counts — 카운트 묶음 헬퍼(부분 지정 → 미지정은 0).
function counts(
  partial: Partial<SummaryBatchOutcomeCounts> = {},
): SummaryBatchOutcomeCounts {
  return {
    total: 0,
    evaluated: 0,
    skipped: 0,
    created: 0,
    existing: 0,
    ...partial,
  };
}

// report — byGranularity 4 버킷을 모두 0 으로 채운 뒤 부분 override 한 완전 리포트.
function report(
  partial: Partial<SummaryBatchOutcomeReport> = {},
  byGranularity: Partial<
    Record<(typeof GRANULARITY_BUCKETS)[number], SummaryBatchOutcomeCounts>
  > = {},
): SummaryBatchOutcomeReport {
  return {
    ...counts(partial),
    byGranularity: {
      day: byGranularity.day ?? counts(),
      week: byGranularity.week ?? counts(),
      month: byGranularity.month ?? counts(),
      other: byGranularity.other ?? counts(),
    },
  };
}

describe("formatSummaryBatchOutcome", () => {
  describe("happy path", () => {
    // total 3: day evaluated+created / week evaluated+existing / month skipped.
    const subject = report(
      { total: 3, evaluated: 2, skipped: 1, created: 1, existing: 1 },
      {
        day: counts({ total: 1, evaluated: 1, created: 1 }),
        week: counts({ total: 1, evaluated: 1, existing: 1 }),
        month: counts({ total: 1, skipped: 1 }),
        other: counts(),
      },
    );

    it("전역 5 카운트(총 3 · 평가 2 · 생성 1 · 기존 1 · skip 1)가 모두 등장한다", () => {
      const line = formatSummaryBatchOutcome(subject);
      expect(line).toContain("총 3건");
      expect(line).toContain("평가 2");
      expect(line).toContain("생성 1");
      expect(line).toContain("기존 1");
      expect(line).toContain("skip 1");
    });

    it("4 granularity 버킷이 day → week → month → other 고정 순서로 모두 등장한다", () => {
      const line = formatSummaryBatchOutcome(subject);
      const dayIdx = line.indexOf("day ");
      const weekIdx = line.indexOf("week ");
      const monthIdx = line.indexOf("month ");
      const otherIdx = line.indexOf("other ");
      expect(dayIdx).toBeGreaterThanOrEqual(0);
      expect(weekIdx).toBeGreaterThan(dayIdx);
      expect(monthIdx).toBeGreaterThan(weekIdx);
      expect(otherIdx).toBeGreaterThan(monthIdx);
    });

    it("버킷 세부 문구(평가/skip)가 정확히 반영된다", () => {
      const line = formatSummaryBatchOutcome(subject);
      expect(line).toContain("day 1(평가1)");
      expect(line).toContain("week 1(평가1)");
      expect(line).toContain("month 1(skip1)");
      expect(line).toContain("other 0");
    });

    it("개행 0 — 단일 라인이다", () => {
      const line = formatSummaryBatchOutcome(subject);
      expect(line).not.toContain("\n");
      expect(line.split("\n")).toHaveLength(1);
    });
  });

  describe("error path", () => {
    it("report 가 null 이면 TypeError 를 던진다", () => {
      expect(() =>
        formatSummaryBatchOutcome(null as unknown as SummaryBatchOutcomeReport),
      ).toThrow(TypeError);
    });

    it("report 가 undefined 면 TypeError 를 던진다", () => {
      expect(() =>
        formatSummaryBatchOutcome(
          undefined as unknown as SummaryBatchOutcomeReport,
        ),
      ).toThrow(TypeError);
    });

    it("report.byGranularity 가 누락(undefined)되면 TypeError 를 던진다(silent 빈 문자열 위장 0)", () => {
      const broken = {
        total: 0,
        evaluated: 0,
        skipped: 0,
        created: 0,
        existing: 0,
      } as unknown as SummaryBatchOutcomeReport;
      expect(() => formatSummaryBatchOutcome(broken)).toThrow(TypeError);
    });

    it("byGranularity 의 한 버킷이 누락되면 TypeError 를 던진다", () => {
      const broken = {
        ...counts(),
        byGranularity: {
          day: counts(),
          week: counts(),
          month: counts(),
          // other 누락
        },
      } as unknown as SummaryBatchOutcomeReport;
      expect(() => formatSummaryBatchOutcome(broken)).toThrow(TypeError);
    });
  });

  describe("flow / branch 분기", () => {
    it("(a) 전건 evaluated+created(skip 0) → skip 0 + created=total", () => {
      const subject = report(
        { total: 2, evaluated: 2, skipped: 0, created: 2, existing: 0 },
        { day: counts({ total: 2, evaluated: 2, created: 2 }) },
      );
      const line = formatSummaryBatchOutcome(subject);
      expect(line).toContain("skip 0");
      expect(line).toContain("생성 2");
      expect(line).toContain("day 2(평가2)");
    });

    it("(b) 전건 skip(evaluated 0) → 평가 0 · skip=total", () => {
      const subject = report(
        { total: 2, evaluated: 0, skipped: 2, created: 0, existing: 0 },
        { week: counts({ total: 2, skipped: 2 }) },
      );
      const line = formatSummaryBatchOutcome(subject);
      expect(line).toContain("평가 0");
      expect(line).toContain("skip 2");
      expect(line).toContain("week 2(skip2)");
    });

    it("(c) evaluated > created+existing(합 불일치) → 5 카운트 그대로 렌더, 문구 무손상", () => {
      // evaluated 2 이나 created 1 + existing 0 = 1 (result 미보유 1 건 분류 불가).
      const subject = report(
        { total: 2, evaluated: 2, skipped: 0, created: 1, existing: 0 },
        { day: counts({ total: 2, evaluated: 2, created: 1 }) },
      );
      const line = formatSummaryBatchOutcome(subject);
      expect(line).toContain("평가 2");
      expect(line).toContain("생성 1");
      expect(line).toContain("기존 0");
      expect(line).toContain("skip 0");
    });

    it("evaluated 와 skip 이 한 버킷에 섞이면 (평가E·skipS) 둘 다 등장한다", () => {
      const subject = report(
        { total: 2, evaluated: 1, skipped: 1, created: 1, existing: 0 },
        { day: counts({ total: 2, evaluated: 1, skipped: 1, created: 1 }) },
      );
      const line = formatSummaryBatchOutcome(subject);
      expect(line).toContain("day 2(평가1·skip1)");
    });
  });

  describe("negative cases", () => {
    it("(1) 빈 batch(total 0, 전 카운트 0) → throw 0 · 빈 문자열 아님 · '총 0건' 명시", () => {
      const subject = report();
      const line = formatSummaryBatchOutcome(subject);
      expect(line).toContain("총 0건");
      expect(line).toContain("평가 0");
      expect(line).toContain("skip 0");
      expect(line.length).toBeGreaterThan(0);
      // 값 0 버킷도 슬롯 누락 0(카운트 괄호 생략).
      expect(line).toContain("day 0");
      expect(line).toContain("other 0");
    });

    it("(2) report·byGranularity·하위 카운트가 호출 후 비변형(deep 동일)", () => {
      const subject = report(
        { total: 1, evaluated: 1, created: 1 },
        { day: counts({ total: 1, evaluated: 1, created: 1 }) },
      );
      const snapshot = JSON.parse(JSON.stringify(subject));
      formatSummaryBatchOutcome(subject);
      expect(subject).toEqual(snapshot);
    });

    it("(3) other 버킷에만 카운트가 몰린 경우(미지원 granularity) → other 가 정확히 반영", () => {
      const subject = report(
        { total: 3, evaluated: 2, skipped: 1, created: 2, existing: 0 },
        { other: counts({ total: 3, evaluated: 2, skipped: 1, created: 2 }) },
      );
      const line = formatSummaryBatchOutcome(subject);
      expect(line).toContain("other 3(평가2·skip1)");
      expect(line).toContain("day 0");
      expect(line).toContain("week 0");
      expect(line).toContain("month 0");
    });

    it("(4) 큰 수(total 1000+) → truncation/오버플로 0, 정확히 렌더", () => {
      const subject = report(
        {
          total: 1234,
          evaluated: 1000,
          skipped: 234,
          created: 700,
          existing: 300,
        },
        {
          day: counts({
            total: 1234,
            evaluated: 1000,
            skipped: 234,
            created: 700,
            existing: 300,
          }),
        },
      );
      const line = formatSummaryBatchOutcome(subject);
      expect(line).toContain("총 1234건");
      expect(line).toContain("평가 1000");
      expect(line).toContain("생성 700");
      expect(line).toContain("기존 300");
      expect(line).toContain("skip 234");
      expect(line).toContain("day 1234(평가1000·skip234)");
    });

    it("(5) 같은 report 로 2 회 호출 → 두 반환이 byte-identical(결정성)", () => {
      const subject = report(
        { total: 2, evaluated: 1, skipped: 1, created: 1, existing: 0 },
        {
          day: counts({ total: 1, evaluated: 1, created: 1 }),
          month: counts({ total: 1, skipped: 1 }),
        },
      );
      const first = formatSummaryBatchOutcome(subject);
      const second = formatSummaryBatchOutcome(subject);
      expect(first).toBe(second);
    });
  });
});
