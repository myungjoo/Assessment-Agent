// summary-batch-report-shape.spec — assertSummaryBatchReportShape 단위 검증. happy /
// error / branch / negative 케이스 박제(R-112 충분 cover). 순수 가드라 시스템 시계·실
// LLM/DB/Prisma 0. 라벨 상수는 가드와 동일하게 summary-batch-report-format.ts single
// source 에서 import(테스트가 라벨 문자열을 독립 하드코딩하면 drift 검출 못 함). happy
// e2e 정합 케이스는 실 formatSummaryBatchReport 산출을 그대로 가드에 통과시킨다(고정 now
// 주입으로 결정성). T-0620/T-0626 colocated spec 구조 mirror.

import type { EvaluationResult } from "./evaluation-result";
import type { PeriodGranularity } from "./period-evaluable";
import type { SummaryBatchPipelineResult } from "./summary-batch-pipeline";
import {
  formatSummaryBatchReport,
  PLAN_LABEL,
  RESULT_LABEL,
} from "./summary-batch-report-format";
import { assertSummaryBatchReportShape } from "./summary-batch-report-shape";
import type { SummaryBatchRosterInput } from "./summary-batch-roster-input";

// 고정 now — e2e 정합 케이스의 결정성 확보용(시스템 시계 미사용).
const FIXED_NOW = new Date("2026-06-24T05:00:00.000Z");

// roster — formatSummaryBatchReport e2e 정합 케이스용. pre-flight 라인이 읽는
// personIds/granularities/now 외 필드는 빈 기본값(format.spec.ts mirror).
function roster(
  partial: Partial<SummaryBatchRosterInput> = {},
): SummaryBatchRosterInput {
  return {
    personIds: [],
    granularities: [],
    resultsByCoordinate: new Map<string, EvaluationResult[]>(),
    mode: "fill" as SummaryBatchRosterInput["mode"],
    options: {} as SummaryBatchRosterInput["options"],
    now: FIXED_NOW,
    ...partial,
  };
}

// result — formatSummaryBatchReport 가 읽는 summaryLine 만 의미(format.spec.ts mirror).
function result(summaryLine: string): SummaryBatchPipelineResult {
  return {
    plan: [] as SummaryBatchPipelineResult["plan"],
    outcomes: [] as SummaryBatchPipelineResult["outcomes"],
    report: {} as SummaryBatchPipelineResult["report"],
    summaryLine,
  };
}

// 정상 2-라인 블록 합성 헬퍼 — 라벨 single source 부착(가드와 동일 라벨로 검증).
function validBlock(
  planBody = "요약 평가 batch 예정: person 2명 · 총 6좌표",
  resultBody = "요약 평가 batch: 총 6건 · 평가 6 · skip 0",
): string {
  return `${PLAN_LABEL}${planBody}\n${RESULT_LABEL}${resultBody}`;
}

describe("assertSummaryBatchReportShape", () => {
  describe("happy path — 정상 2-라인 블록이면 void 반환", () => {
    it("동형으로 구성한 정상 2-라인 블록은 throw 없이 void 반환한다", () => {
      expect(assertSummaryBatchReportShape(validBlock())).toBeUndefined();
    });

    it("실 formatSummaryBatchReport 산출을 그대로 통과시킨다(e2e 정합)", () => {
      const block = formatSummaryBatchReport(
        roster({
          personIds: ["p1", "p2"],
          granularities: ["day", "week", "month"] as PeriodGranularity[],
        }),
        result(
          "요약 평가 batch: 총 6건 · 평가 6 (생성 6 / 기존 0) · skip 0 [day 2(평가2) · week 2(평가2) · month 2(평가2) · other 0]",
        ),
      );
      expect(assertSummaryBatchReportShape(block)).toBeUndefined();
    });
  });

  describe("error path — 위반 분기별 throw 타입·메시지 어휘", () => {
    it("① report 가 null 이면 TypeError", () => {
      expect(() =>
        assertSummaryBatchReportShape(null as unknown as string),
      ).toThrow(TypeError);
    });

    it("① report 가 undefined 이면 TypeError", () => {
      expect(() =>
        assertSummaryBatchReportShape(undefined as unknown as string),
      ).toThrow(TypeError);
    });

    it("② 개행 0개(1 라인)면 RangeError(라인 수 명시)", () => {
      const block = `${PLAN_LABEL}본문만 한 줄`;
      expect(() => assertSummaryBatchReportShape(block)).toThrow(RangeError);
      expect(() => assertSummaryBatchReportShape(block)).toThrow(/라인 수/);
      expect(() => assertSummaryBatchReportShape(block)).toThrow(/1 라인/);
    });

    it("② 개행 2개(3 라인)면 RangeError(라인 수 명시)", () => {
      const block = `${PLAN_LABEL}a\n${RESULT_LABEL}b\n군더더기 라인`;
      expect(() => assertSummaryBatchReportShape(block)).toThrow(RangeError);
      expect(() => assertSummaryBatchReportShape(block)).toThrow(/3 라인/);
    });

    it("③ 후행 개행이 있으면 RangeError(후행 개행 명시)", () => {
      const block = `${validBlock()}\n`;
      expect(() => assertSummaryBatchReportShape(block)).toThrow(RangeError);
      expect(() => assertSummaryBatchReportShape(block)).toThrow(/후행 개행/);
    });

    it("④ 1번째 라인 라벨 누락이면 RangeError", () => {
      const block = `엉뚱한 라벨: a\n${RESULT_LABEL}b`;
      expect(() => assertSummaryBatchReportShape(block)).toThrow(RangeError);
      expect(() => assertSummaryBatchReportShape(block)).toThrow(
        /1번째 라인 라벨/,
      );
    });

    it("④ 1번째 라인 본문이 비면 RangeError", () => {
      const block = `${PLAN_LABEL}\n${RESULT_LABEL}b`;
      expect(() => assertSummaryBatchReportShape(block)).toThrow(RangeError);
      expect(() => assertSummaryBatchReportShape(block)).toThrow(
        /1번째 라인 본문/,
      );
    });

    it("⑤ 2번째 라인 라벨 누락이면 RangeError", () => {
      const block = `${PLAN_LABEL}a\n엉뚱한 라벨: b`;
      expect(() => assertSummaryBatchReportShape(block)).toThrow(RangeError);
      expect(() => assertSummaryBatchReportShape(block)).toThrow(
        /2번째 라인 라벨/,
      );
    });

    it("⑤ 2번째 라인 본문이 비면 RangeError", () => {
      const block = `${PLAN_LABEL}a\n${RESULT_LABEL}`;
      expect(() => assertSummaryBatchReportShape(block)).toThrow(RangeError);
      expect(() => assertSummaryBatchReportShape(block)).toThrow(
        /2번째 라인 본문/,
      );
    });
  });

  describe("branch — ①~⑤ 각 분기 1개씩 격리 trigger + 정상 1개", () => {
    it("정상(모든 분기 통과) → void", () => {
      expect(assertSummaryBatchReportShape(validBlock())).toBeUndefined();
    });

    it("① 비-string 분기만 trigger", () => {
      expect(() =>
        assertSummaryBatchReportShape(123 as unknown as string),
      ).toThrow(TypeError);
    });

    it("② 라인 수 분기만 trigger(라벨·본문은 정상)", () => {
      // 1 라인이지만 그 한 라인은 계획 라벨·본문 정상 — 라인 수 분기만 격리.
      const block = `${PLAN_LABEL}정상 본문`;
      expect(() => assertSummaryBatchReportShape(block)).toThrow(/라인 수/);
    });

    it("③ 후행 개행 분기만 trigger(2 라인 + 후행 개행)", () => {
      // 정상 2 라인에 후행 개행만 추가 — ② 보다 먼저 검사돼 ③ 으로 진단(개행 2개를
      // 라인 수 위반이 아니라 후행 개행으로 정확히 분류).
      expect(() => assertSummaryBatchReportShape(`${validBlock()}\n`)).toThrow(
        /후행 개행/,
      );
    });

    it("④ 1번째 라인 라벨 분기만 trigger(2번째는 정상)", () => {
      const block = `잘못: a\n${RESULT_LABEL}b`;
      expect(() => assertSummaryBatchReportShape(block)).toThrow(/1번째 라인/);
    });

    it("⑤ 2번째 라인 라벨 분기만 trigger(1번째는 정상)", () => {
      const block = `${PLAN_LABEL}a\n잘못: b`;
      expect(() => assertSummaryBatchReportShape(block)).toThrow(/2번째 라인/);
    });
  });

  describe("negative — 경계마다 분리", () => {
    it("① 빈 문자열 → RangeError(개행 0 = 1 라인, 라벨 위반)", () => {
      // 빈 문자열은 개행 0개라 라인 수(②) 분기에서 먼저 throw.
      expect(() => assertSummaryBatchReportShape("")).toThrow(RangeError);
    });

    it("② 라벨 순서 뒤바뀜(결과 먼저) → RangeError(1번째 라인 라벨 위반)", () => {
      const block = `${RESULT_LABEL}a\n${PLAN_LABEL}b`;
      expect(() => assertSummaryBatchReportShape(block)).toThrow(RangeError);
      expect(() => assertSummaryBatchReportShape(block)).toThrow(
        /1번째 라인 라벨/,
      );
    });

    it("③ 라벨만 있고 본문 빈 라인(`계획: \\n결과: `) → RangeError(본문 위반)", () => {
      const block = `${PLAN_LABEL}\n${RESULT_LABEL}`;
      expect(() => assertSummaryBatchReportShape(block)).toThrow(RangeError);
      expect(() => assertSummaryBatchReportShape(block)).toThrow(/본문/);
    });

    it("④ 3 라인 이상(개행 2개+) → RangeError", () => {
      const block = `${PLAN_LABEL}a\n${RESULT_LABEL}b\n${RESULT_LABEL}c`;
      expect(() => assertSummaryBatchReportShape(block)).toThrow(RangeError);
    });

    it("⑤ 비-string(숫자) → TypeError", () => {
      expect(() =>
        assertSummaryBatchReportShape(42 as unknown as string),
      ).toThrow(TypeError);
    });

    it("⑤ 비-string(객체) → TypeError", () => {
      expect(() =>
        assertSummaryBatchReportShape({} as unknown as string),
      ).toThrow(TypeError);
    });

    it("⑤ 비-string(null) → TypeError", () => {
      expect(() =>
        assertSummaryBatchReportShape(null as unknown as string),
      ).toThrow(TypeError);
    });

    it("⑥ 같은 입력 2회 호출 결정성 — 정상은 2회 void, 손상은 2회 동일 메시지 throw", () => {
      // 정상 입력 결정성.
      const ok = validBlock();
      expect(assertSummaryBatchReportShape(ok)).toBeUndefined();
      expect(assertSummaryBatchReportShape(ok)).toBeUndefined();

      // 손상 입력 결정성 — 2회 동일 메시지·동일 위치 throw.
      const bad = `${PLAN_LABEL}a\n잘못: b`;
      let first = "";
      let second = "";
      try {
        assertSummaryBatchReportShape(bad);
      } catch (e) {
        first = (e as Error).message;
      }
      try {
        assertSummaryBatchReportShape(bad);
      } catch (e) {
        second = (e as Error).message;
      }
      expect(first).not.toBe("");
      expect(first).toBe(second);
    });

    it("⑥ 호출 후 입력 문자열 비변형(원본 동일 — 읽기만)", () => {
      const ok = validBlock();
      const before = String(ok);
      assertSummaryBatchReportShape(ok);
      // string 은 immutable 이나 동일성·내용 deep-equal 로 비변형 박제.
      expect(ok).toBe(before);
      expect(ok).toEqual(before);
    });
  });
});
