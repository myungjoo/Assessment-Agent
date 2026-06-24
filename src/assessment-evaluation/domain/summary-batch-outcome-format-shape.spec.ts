// summary-batch-outcome-format-shape.spec — T-0638 R-61 요약 평가 batch outcome
// "한 줄 요약" 라인 형태 불변식 가드 단위 테스트. R-112(기능 + 예외 + flow 3종 +
// negative 충분 cover) 강제. 각 위반 분기(①~⑤ + 빈 라인 위장 ⑥)를 정확히 1개씩 격리
// trigger 하고, 정상 outcome 라인은 변형·차단 없이 통과(void)함을 검증한다. happy-path
// 는 실 `formatSummaryBatchOutcome` 산출을 그대로 통과시키는 end-to-end 정합 케이스를
// 여러 report fixture(빈 batch·혼합·전건 skip·전건 created·일부 버킷 0)로 포함한다
// (가드 ↔ formatter 계약 정합 회귀 방어). T-0635 summary-batch-roster-plan-shape.spec
// 구조 mirror.

import { GRANULARITY_BUCKETS } from "./summary-batch-outcome";
import type {
  SummaryBatchOutcomeCounts,
  SummaryBatchOutcomeReport,
} from "./summary-batch-outcome";
import {
  formatSummaryBatchOutcome,
  OUTCOME_LINE_PREFIX,
} from "./summary-batch-outcome-format";
import { assertSummaryBatchOutcomeFormatShape } from "./summary-batch-outcome-format-shape";

// 가드가 검증하는 전체 prefix(`요약 평가 batch: 총 `). formatter head 와 정합.
const OUTCOME_PREFIX = `${OUTCOME_LINE_PREFIX}총 `;

// 정상 outcome 라인 1개 — formatter 산출 형태와 byte 정합(prefix · 평가/생성/기존/skip
// 카운트 토큰 · 4 버킷 슬롯 고정 순서 · 개행 0). 위반 케이스는 본 라인에서 한 축만 깬다.
const VALID_LINE = `${OUTCOME_PREFIX}3건 · 평가 2 (생성 1 / 기존 1) · skip 1 [day 1(평가1) · week 1(평가1) · month 1(skip1) · other 0]`;

// counts helper — 한 버킷/전역 카운트 묶음을 부분 필드로 구성(미지정 0).
function counts(
  partial: Partial<SummaryBatchOutcomeCounts>,
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

// makeReport — end-to-end happy-path 에서 formatter ↔ 가드 계약 정합을 검증하기 위해
// formatter 가 소비할 최소 outcome report 를 구성한다. byGranularity 는 4 버킷 모두
// 키 존재(미지정 버킷 0) 보장.
function makeReport(
  global: Partial<SummaryBatchOutcomeCounts>,
  byGranularity: Partial<
    Record<
      (typeof GRANULARITY_BUCKETS)[number],
      Partial<SummaryBatchOutcomeCounts>
    >
  > = {},
): SummaryBatchOutcomeReport {
  const dist = {} as SummaryBatchOutcomeReport["byGranularity"];
  for (const bucket of GRANULARITY_BUCKETS) {
    dist[bucket] = counts(byGranularity[bucket] ?? {});
  }
  return { ...counts(global), byGranularity: dist };
}

describe("assertSummaryBatchOutcomeFormatShape", () => {
  describe("happy path — 정상 outcome 라인은 throw 0(void)", () => {
    it("정상 단일 라인 outcome 을 통과시킨다(throw 0)", () => {
      expect(() =>
        assertSummaryBatchOutcomeFormatShape(VALID_LINE),
      ).not.toThrow();
      expect(assertSummaryBatchOutcomeFormatShape(VALID_LINE)).toBeUndefined();
    });

    it("실 formatSummaryBatchOutcome(빈 batch · 총 0건) 산출을 그대로 통과시킨다(end-to-end 정합)", () => {
      const line = formatSummaryBatchOutcome(makeReport({}));
      // 빈 batch 도 빈 문자열이 아니라 `총 0건` 을 명시 — 가드가 차단하지 않는다.
      expect(() => assertSummaryBatchOutcomeFormatShape(line)).not.toThrow();
    });

    it("실 formatSummaryBatchOutcome(혼합 카운트) 산출을 통과시킨다", () => {
      const line = formatSummaryBatchOutcome(
        makeReport(
          { total: 3, evaluated: 2, skipped: 1, created: 1, existing: 1 },
          {
            day: { total: 1, evaluated: 1, created: 1 },
            week: { total: 1, evaluated: 1, existing: 1 },
            month: { total: 1, skipped: 1 },
          },
        ),
      );
      expect(() => assertSummaryBatchOutcomeFormatShape(line)).not.toThrow();
    });

    it("실 formatSummaryBatchOutcome(전건 skip) 산출을 통과시킨다", () => {
      const line = formatSummaryBatchOutcome(
        makeReport({ total: 2, skipped: 2 }, { day: { total: 2, skipped: 2 } }),
      );
      expect(() => assertSummaryBatchOutcomeFormatShape(line)).not.toThrow();
    });

    it("실 formatSummaryBatchOutcome(전건 created) 산출을 통과시킨다", () => {
      const line = formatSummaryBatchOutcome(
        makeReport(
          { total: 2, evaluated: 2, created: 2 },
          { week: { total: 2, evaluated: 2, created: 2 } },
        ),
      );
      expect(() => assertSummaryBatchOutcomeFormatShape(line)).not.toThrow();
    });

    it("실 formatSummaryBatchOutcome(일부 버킷 0) 산출을 통과시킨다(other 0 슬롯 유지)", () => {
      const line = formatSummaryBatchOutcome(
        makeReport(
          { total: 1, evaluated: 1, existing: 1 },
          { month: { total: 1, evaluated: 1, existing: 1 } },
        ),
      );
      expect(() => assertSummaryBatchOutcomeFormatShape(line)).not.toThrow();
    });

    it("입력 line 문자열을 변형하지 않는다(비변형 · deep-equal)", () => {
      const original = VALID_LINE;
      const snapshot = `${original}`;
      assertSummaryBatchOutcomeFormatShape(original);
      expect(original).toEqual(snapshot);
    });

    it("같은 입력 2회 호출 결정성(byte-identical 동작 — 둘 다 void)", () => {
      expect(assertSummaryBatchOutcomeFormatShape(VALID_LINE)).toBeUndefined();
      expect(assertSummaryBatchOutcomeFormatShape(VALID_LINE)).toBeUndefined();
    });
  });

  describe("① 비-string → TypeError(구조 결손)", () => {
    it("null 은 TypeError", () => {
      expect(() =>
        assertSummaryBatchOutcomeFormatShape(null as unknown as string),
      ).toThrow(TypeError);
    });

    it("undefined 는 TypeError", () => {
      expect(() =>
        assertSummaryBatchOutcomeFormatShape(undefined as unknown as string),
      ).toThrow(TypeError);
    });

    it("숫자는 TypeError(메시지에 string 아님 명시)", () => {
      expect(() =>
        assertSummaryBatchOutcomeFormatShape(42 as unknown as string),
      ).toThrow(/string 이 아니다/);
    });

    it("객체는 TypeError", () => {
      expect(() =>
        assertSummaryBatchOutcomeFormatShape({} as unknown as string),
      ).toThrow(TypeError);
    });

    it("배열은 TypeError", () => {
      expect(() =>
        assertSummaryBatchOutcomeFormatShape([] as unknown as string),
      ).toThrow(TypeError);
    });
  });

  describe("② 개행 혼입 → RangeError(단일 라인 위반)", () => {
    it("후행 개행은 RangeError(라인 수 명시)", () => {
      const line = `${VALID_LINE}\n`;
      expect(() => assertSummaryBatchOutcomeFormatShape(line)).toThrow(
        RangeError,
      );
      expect(() => assertSummaryBatchOutcomeFormatShape(line)).toThrow(
        /단일 라인 위반/,
      );
    });

    it("중간 개행은 RangeError", () => {
      const line = `${OUTCOME_PREFIX}1건\n · 평가 1 (생성 1 / 기존 0) · skip 0 [day 1(평가1) · week 0 · month 0 · other 0]`;
      expect(() => assertSummaryBatchOutcomeFormatShape(line)).toThrow(
        /단일 라인 위반/,
      );
    });
  });

  describe("③ prefix 위반 → RangeError", () => {
    it("빈 문자열은 prefix 위반 RangeError(빈 라인 위장 차단)", () => {
      expect(() => assertSummaryBatchOutcomeFormatShape("")).toThrow(
        RangeError,
      );
      expect(() => assertSummaryBatchOutcomeFormatShape("")).toThrow(
        /prefix 위반/,
      );
    });

    it("공백만은 prefix 위반 RangeError(빈 라인 위장 차단)", () => {
      expect(() => assertSummaryBatchOutcomeFormatShape("   ")).toThrow(
        /prefix 위반/,
      );
    });

    it("prefix drift(`평가 batch:` 누락 라벨)는 RangeError", () => {
      const line = `평가 batch: 총 1건 · 평가 1 (생성 1 / 기존 0) · skip 0 [day 1(평가1) · week 0 · month 0 · other 0]`;
      expect(() => assertSummaryBatchOutcomeFormatShape(line)).toThrow(
        /prefix 위반/,
      );
    });

    it("prefix drift(`요약 평가:` 다른 라벨)는 RangeError", () => {
      const line = `요약 평가: 총 1건 · 평가 1 (생성 1 / 기존 0) · skip 0 [day 1(평가1) · week 0 · month 0 · other 0]`;
      expect(() => assertSummaryBatchOutcomeFormatShape(line)).toThrow(
        /prefix 위반/,
      );
    });
  });

  describe("④ 카운트 토큰 위반 → RangeError", () => {
    it("`생성` 토큰 누락은 RangeError", () => {
      // prefix 통과 · 개행 0 이나 `(생성 ` 토큰 부재 → ④ 격리 trigger.
      const line = `${OUTCOME_PREFIX}1건 · 평가 1 (기존 0) · skip 0 [day 1(평가1) · week 0 · month 0 · other 0]`;
      expect(() => assertSummaryBatchOutcomeFormatShape(line)).toThrow(
        /카운트 토큰 위반/,
      );
    });

    it("`기존` 토큰 누락은 RangeError", () => {
      const line = `${OUTCOME_PREFIX}1건 · 평가 1 (생성 1) · skip 0 [day 1(평가1) · week 0 · month 0 · other 0]`;
      expect(() => assertSummaryBatchOutcomeFormatShape(line)).toThrow(
        /카운트 토큰 위반/,
      );
    });

    it("`skip` 토큰 누락은 RangeError", () => {
      const line = `${OUTCOME_PREFIX}1건 · 평가 1 (생성 1 / 기존 0) [day 1(평가1) · week 0 · month 0 · other 0]`;
      expect(() => assertSummaryBatchOutcomeFormatShape(line)).toThrow(
        /카운트 토큰 위반/,
      );
    });
  });

  describe("⑤ 버킷 슬롯 위반 → RangeError", () => {
    it("버킷 순서 뒤바뀜은 RangeError(고정 순서 위반)", () => {
      const line = `${OUTCOME_PREFIX}1건 · 평가 1 (생성 1 / 기존 0) · skip 0 [week 1 · day 0 · month 0 · other 0]`;
      expect(() => assertSummaryBatchOutcomeFormatShape(line)).toThrow(
        /버킷 슬롯 위반/,
      );
    });

    it("1 버킷 누락(other 슬롯 없음)은 RangeError", () => {
      const line = `${OUTCOME_PREFIX}0건 · 평가 0 (생성 0 / 기존 0) · skip 0 [day 0 · week 0 · month 0]`;
      expect(() => assertSummaryBatchOutcomeFormatShape(line)).toThrow(
        /버킷 슬롯 위반/,
      );
    });

    it("버킷 숫자 누락 drift 는 RangeError", () => {
      const line = `${OUTCOME_PREFIX}0건 · 평가 0 (생성 0 / 기존 0) · skip 0 [day · week 0 · month 0 · other 0]`;
      expect(() => assertSummaryBatchOutcomeFormatShape(line)).toThrow(
        /버킷 슬롯 위반/,
      );
    });

    it("대괄호 자체 누락은 RangeError", () => {
      const line = `${OUTCOME_PREFIX}0건 · 평가 0 (생성 0 / 기존 0) · skip 0 day 0 · week 0 · month 0 · other 0`;
      expect(() => assertSummaryBatchOutcomeFormatShape(line)).toThrow(
        /버킷 슬롯 위반/,
      );
    });
  });

  describe("single-source 정합", () => {
    it("GRANULARITY_BUCKETS 고정 순서(day → week → month → other)를 가드가 강제한다", () => {
      // single source 순서가 깨진 입력은 ⑤ 로 차단됨을 명시(드리프트 회귀 방어).
      expect(GRANULARITY_BUCKETS).toEqual(["day", "week", "month", "other"]);
      const reordered = `${OUTCOME_PREFIX}0건 · 평가 0 (생성 0 / 기존 0) · skip 0 [day 0 · month 0 · week 0 · other 0]`;
      expect(() => assertSummaryBatchOutcomeFormatShape(reordered)).toThrow(
        /버킷 슬롯 위반/,
      );
    });
  });
});
