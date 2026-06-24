// summary-batch-outcome-consistency.spec — assertSummaryBatchOutcomeConsistent 단위
// 검증. happy / error / branch / negative 케이스 박제(R-112 충분 cover). report
// fixture 는 직접 객체 리터럴로 구성(단위 격리), 위반 케이스는 정합 fixture 의 카운트
// 1 필드만 의도적으로 손상시켜 구성한다. 실 LLM/DB/Prisma 0.

import {
  GRANULARITY_BUCKETS,
  type SummaryBatchOutcomeCounts,
  type SummaryBatchOutcomeReport,
} from "./summary-batch-outcome";
import { assertSummaryBatchOutcomeConsistent } from "./summary-batch-outcome-consistency";

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

describe("assertSummaryBatchOutcomeConsistent", () => {
  describe("happy path", () => {
    // total 3: day evaluated+created / week evaluated+existing / month skipped.
    // 전역과 버킷합이 모두 정합한 리포트 — 정상 void 반환 + 입력 비변형 검증.
    function consistentReport(): SummaryBatchOutcomeReport {
      return report(
        { total: 3, evaluated: 2, skipped: 1, created: 1, existing: 1 },
        {
          day: counts({ total: 1, evaluated: 1, created: 1 }),
          week: counts({ total: 1, evaluated: 1, existing: 1 }),
          month: counts({ total: 1, skipped: 1 }),
          other: counts(),
        },
      );
    }

    it("정합 리포트는 throw 없이 void 반환한다", () => {
      const subject = consistentReport();
      expect(assertSummaryBatchOutcomeConsistent(subject)).toBeUndefined();
    });

    it("호출 후 report 객체를 변형하지 않는다(deep 동일)", () => {
      const subject = consistentReport();
      const before = JSON.parse(JSON.stringify(subject));
      assertSummaryBatchOutcomeConsistent(subject);
      expect(subject).toEqual(before);
    });
  });

  describe("error path — 구조/타입 결손은 TypeError", () => {
    it("report 가 null 이면 TypeError", () => {
      expect(() =>
        assertSummaryBatchOutcomeConsistent(
          null as unknown as SummaryBatchOutcomeReport,
        ),
      ).toThrow(TypeError);
    });

    it("report 가 undefined 이면 TypeError", () => {
      expect(() =>
        assertSummaryBatchOutcomeConsistent(
          undefined as unknown as SummaryBatchOutcomeReport,
        ),
      ).toThrow(TypeError);
    });

    it("byGranularity 누락 시 TypeError", () => {
      const broken = {
        ...counts(),
      } as unknown as SummaryBatchOutcomeReport;
      expect(() => assertSummaryBatchOutcomeConsistent(broken)).toThrow(
        TypeError,
      );
    });

    it("버킷 슬롯 누락 시 TypeError + 버킷명 등장", () => {
      const subject = report();
      delete (subject.byGranularity as Record<string, unknown>).week;
      expect(() => assertSummaryBatchOutcomeConsistent(subject)).toThrow(
        /week/,
      );
      expect(() => assertSummaryBatchOutcomeConsistent(subject)).toThrow(
        TypeError,
      );
    });

    it("카운트 필드가 정수가 아니면 TypeError", () => {
      const subject = report();
      (subject as unknown as Record<string, unknown>).total = 1.5;
      expect(() => assertSummaryBatchOutcomeConsistent(subject)).toThrow(
        TypeError,
      );
    });

    it("카운트 필드가 NaN 이면 TypeError", () => {
      const subject = report();
      (subject as unknown as Record<string, unknown>).evaluated = Number.NaN;
      expect(() => assertSummaryBatchOutcomeConsistent(subject)).toThrow(
        TypeError,
      );
    });
  });

  describe("branch — 불변식 3종 위반 각 1+", () => {
    it("(a) 불변식(1) 전역 evaluated+skipped !== total → RangeError + 전역+식", () => {
      // 전역 evaluated 2 + skip 1 인데 total 4(불일치).
      const subject = report(
        { total: 4, evaluated: 2, skipped: 1, created: 1, existing: 1 },
        {
          day: counts({ total: 1, evaluated: 1, created: 1 }),
          week: counts({ total: 1, evaluated: 1, existing: 1 }),
          month: counts({ total: 1, skipped: 1 }),
        },
      );
      expect(() => assertSummaryBatchOutcomeConsistent(subject)).toThrow(
        RangeError,
      );
      expect(() => assertSummaryBatchOutcomeConsistent(subject)).toThrow(
        /불변식\(1\)/,
      );
      expect(() => assertSummaryBatchOutcomeConsistent(subject)).toThrow(
        /전역/,
      );
    });

    it("(b) 불변식(2) 전역 created+existing !== evaluated → RangeError", () => {
      // evaluated 2 인데 created 1 + existing 0(불일치).
      const subject = report(
        { total: 3, evaluated: 2, skipped: 1, created: 1, existing: 0 },
        {
          day: counts({ total: 1, evaluated: 1, created: 1 }),
          week: counts({ total: 1, evaluated: 1 }),
          month: counts({ total: 1, skipped: 1 }),
        },
      );
      expect(() => assertSummaryBatchOutcomeConsistent(subject)).toThrow(
        RangeError,
      );
      expect(() => assertSummaryBatchOutcomeConsistent(subject)).toThrow(
        /불변식\(2\)/,
      );
    });

    it("(c) 불변식(3) 버킷합 !== 전역 → RangeError + 필드명 등장", () => {
      // 전역 total 3 인데 4 버킷 total 합 2(분포 보존 위반). 전역·버킷 국소
      // 불변식은 모두 정합하게 두어 (3)에서만 catch 되도록 구성.
      const subject = report(
        { total: 3, evaluated: 2, skipped: 1, created: 1, existing: 1 },
        {
          day: counts({ total: 1, evaluated: 1, created: 1 }),
          week: counts({ total: 1, evaluated: 1, existing: 1 }),
          month: counts(),
          other: counts(),
        },
      );
      expect(() => assertSummaryBatchOutcomeConsistent(subject)).toThrow(
        RangeError,
      );
      expect(() => assertSummaryBatchOutcomeConsistent(subject)).toThrow(
        /불변식\(3\)/,
      );
      expect(() => assertSummaryBatchOutcomeConsistent(subject)).toThrow(
        /total/,
      );
    });
  });

  describe("negative — 경계마다 분리", () => {
    it("(1) 빈 batch(전 카운트 0)는 모든 불변식 만족 → throw 0", () => {
      expect(assertSummaryBatchOutcomeConsistent(report())).toBeUndefined();
    });

    it("(2) 전역은 정합하나 week 버킷 (1) 위반 → RangeError + 버킷명 week", () => {
      // 전역·분포 보존(3)·day 국소 불변식은 모두 정합하게 두고, week 버킷만 국소
      // 불변식(1) 위반(total 1 인데 evaluated 1 + skip 1 = 2)으로 구성한다. 전역을
      // 통과해도 버킷을 건너뛰지 않고 검사함을 보증 — day 가 정합이라 week 가 첫
      // 버킷 위반으로 catch 된다(month 의 상쇄 위반은 week 보다 뒤 순서).
      const subject = report(
        { total: 4, evaluated: 2, skipped: 2, created: 1, existing: 1 },
        {
          day: counts({ total: 2, evaluated: 1, skipped: 1, created: 1 }),
          week: counts({ total: 1, evaluated: 1, skipped: 1, existing: 1 }),
          month: counts({ total: 1 }),
        },
      );
      expect(() => assertSummaryBatchOutcomeConsistent(subject)).toThrow(
        RangeError,
      );
      expect(() => assertSummaryBatchOutcomeConsistent(subject)).toThrow(
        /week/,
      );
    });

    it("(3) other 버킷에만 분포가 몰린 정합 리포트 → throw 0", () => {
      // 미지원 granularity 누적 시나리오(other 버킷). 정합이면 정상 반환.
      const subject = report(
        { total: 2, evaluated: 1, skipped: 1, created: 1, existing: 0 },
        {
          other: counts({ total: 2, evaluated: 1, skipped: 1, created: 1 }),
        },
      );
      expect(assertSummaryBatchOutcomeConsistent(subject)).toBeUndefined();
    });

    it("(4) 큰 수(전역 1000+, 버킷합 정합) → 정수 비교 정확, throw 0", () => {
      const subject = report(
        {
          total: 1500,
          evaluated: 1000,
          skipped: 500,
          created: 600,
          existing: 400,
        },
        {
          day: counts({
            total: 1500,
            evaluated: 1000,
            skipped: 500,
            created: 600,
            existing: 400,
          }),
        },
      );
      expect(assertSummaryBatchOutcomeConsistent(subject)).toBeUndefined();
    });

    it("(5) 같은 손상 report 로 2 회 호출 → 동일 위치·동일 메시지 throw(결정성)", () => {
      const subject = report(
        { total: 5, evaluated: 2, skipped: 1, created: 1, existing: 1 },
        {
          day: counts({ total: 1, evaluated: 1, created: 1 }),
          week: counts({ total: 1, evaluated: 1, existing: 1 }),
          month: counts({ total: 1, skipped: 1 }),
        },
      );
      let first = "";
      let second = "";
      try {
        assertSummaryBatchOutcomeConsistent(subject);
      } catch (e) {
        first = (e as Error).message;
      }
      try {
        assertSummaryBatchOutcomeConsistent(subject);
      } catch (e) {
        second = (e as Error).message;
      }
      expect(first).not.toBe("");
      expect(first).toBe(second);
    });
  });
});
