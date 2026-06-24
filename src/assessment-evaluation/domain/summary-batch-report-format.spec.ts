// summary-batch-report-format.spec — formatSummaryBatchReport 단위 검증. happy / error /
// branch / negative 케이스 박제(R-112 충분 cover). pre-flight 좌표는 실
// formatSummaryBatchRosterPlan → enumerateSummaryDueCoordinates 를 통해 산출(고정 now
// 주입으로 결정성 확보), result 는 summaryLine 만 채운 최소 fixture(plan/outcomes/report
// 는 빈/임의 최소값) — 실 LLM/DB/Prisma 0, 순수 단위 격리. summary-batch-roster-plan-
// format.spec.ts 구조 mirror.

import type { EvaluationResult } from "./evaluation-result";
import type { PeriodGranularity } from "./period-evaluable";
import * as outcomeFormatShapeModule from "./summary-batch-outcome-format-shape";
import type { SummaryBatchPipelineResult } from "./summary-batch-pipeline";
import { formatSummaryBatchReport } from "./summary-batch-report-format";
import type { SummaryBatchRosterInput } from "./summary-batch-roster-input";
import * as rosterPlanFormatModule from "./summary-batch-roster-plan-format";
import { formatSummaryBatchRosterPlan } from "./summary-batch-roster-plan-format";
import * as rosterPlanShapeModule from "./summary-batch-roster-plan-shape";

// 고정 now — 결정성 확보용(시스템 시계 미사용). KST 임의 시각.
const FIXED_NOW = new Date("2026-06-24T05:00:00.000Z");

// roster — 본 formatter 가 위임하는 pre-flight 라인이 읽는 personIds/granularities/now
// 외 4 필드는 의미 없는 빈 기본값. 단일 입력 객체로 positional 인자 혼동 차단.
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

// result — 본 formatter 가 읽는 summaryLine 만 의미. plan/outcomes/report 는 본 formatter
// 가 미접촉하므로 빈/임의 최소값으로 채운다(순수 단위 격리 — 실 pipeline 미실행).
function result(summaryLine: string): SummaryBatchPipelineResult {
  return {
    plan: [] as SummaryBatchPipelineResult["plan"],
    outcomes: [] as SummaryBatchPipelineResult["outcomes"],
    report: {} as SummaryBatchPipelineResult["report"],
    summaryLine,
  };
}

describe("formatSummaryBatchReport", () => {
  describe("happy path", () => {
    // personIds 2명 × granularities [day, week, month] → 2×3 = 6 좌표.
    const subjectRoster = roster({
      personIds: ["p1", "p2"],
      granularities: ["day", "week", "month"] as PeriodGranularity[],
    });
    const subjectResult = result(
      "요약 평가 batch: 총 6건 · 평가 6 (생성 6 / 기존 0) · skip 0 [day 2(평가2) · week 2(평가2) · month 2(평가2) · other 0]",
    );

    it("(a) throw 0, (b) 정확히 2 라인(개행 1개)을 반환한다", () => {
      const block = formatSummaryBatchReport(subjectRoster, subjectResult);
      const lines = block.split("\n");
      expect(lines).toHaveLength(2);
      // 후행 개행 0 — 마지막 라인이 빈 문자열이 아니다.
      expect(lines[1].length).toBeGreaterThan(0);
    });

    it("(c) 1번째 라인이 계획 라벨 + formatSummaryBatchRosterPlan(roster) 출력을 포함한다", () => {
      const block = formatSummaryBatchReport(subjectRoster, subjectResult);
      const [planLine] = block.split("\n");
      expect(planLine).toContain("계획:");
      // pre-flight 라인은 위임 출력 — 재구현이 아니라 동일 함수 출력을 포함.
      expect(planLine).toContain(formatSummaryBatchRosterPlan(subjectRoster));
    });

    it("(d) 2번째 라인이 결과 라벨 + result.summaryLine 을 포함한다", () => {
      const block = formatSummaryBatchReport(subjectRoster, subjectResult);
      const resultLine = block.split("\n")[1];
      expect(resultLine).toContain("결과:");
      expect(resultLine).toContain(subjectResult.summaryLine);
    });
  });

  describe("error path", () => {
    const okResult = result(
      "요약 평가 batch: 총 0건 · 평가 0 (생성 0 / 기존 0) · skip 0 [day 0 · week 0 · month 0 · other 0]",
    );

    it("(a) roster null → 위임 한국어 TypeError 가 전파된다", () => {
      expect(() =>
        formatSummaryBatchReport(
          null as unknown as SummaryBatchRosterInput,
          okResult,
        ),
      ).toThrow(TypeError);
    });

    it("(a) roster undefined → 위임 한국어 TypeError 가 전파된다", () => {
      expect(() =>
        formatSummaryBatchReport(
          undefined as unknown as SummaryBatchRosterInput,
          okResult,
        ),
      ).toThrow(TypeError);
    });

    it("(b) result null → 직접 가드 한국어 TypeError", () => {
      const okRoster = roster({ personIds: ["p1"], granularities: ["day"] });
      expect(() =>
        formatSummaryBatchReport(
          okRoster,
          null as unknown as SummaryBatchPipelineResult,
        ),
      ).toThrow(/result/);
    });

    it("(b) result undefined → 직접 가드 한국어 TypeError", () => {
      const okRoster = roster({ personIds: ["p1"], granularities: ["day"] });
      expect(() =>
        formatSummaryBatchReport(
          okRoster,
          undefined as unknown as SummaryBatchPipelineResult,
        ),
      ).toThrow(/result/);
    });

    it("(c) result.summaryLine 누락(undefined) → 한국어 TypeError", () => {
      const okRoster = roster({ personIds: ["p1"], granularities: ["day"] });
      expect(() =>
        formatSummaryBatchReport(
          okRoster,
          result(undefined as unknown as string),
        ),
      ).toThrow(/summaryLine/);
    });

    it("(c) result.summaryLine 비-string(number) → 한국어 TypeError", () => {
      const okRoster = roster({ personIds: ["p1"], granularities: ["day"] });
      expect(() =>
        formatSummaryBatchReport(okRoster, result(42 as unknown as string)),
      ).toThrow(TypeError);
    });

    it("(d) roster.personIds null → enumerate 위임 TypeError 전파(swallow 0)", () => {
      const subjectRoster = roster({
        personIds: null as unknown as string[],
        granularities: ["day"] as PeriodGranularity[],
      });
      expect(() => formatSummaryBatchReport(subjectRoster, okResult)).toThrow(
        TypeError,
      );
    });

    it("(d) roster.granularities 에 알 수 없는 period(year) → 위임 RangeError 전파", () => {
      const subjectRoster = roster({
        personIds: ["p1"],
        granularities: ["year"] as unknown as PeriodGranularity[],
      });
      expect(() => formatSummaryBatchReport(subjectRoster, okResult)).toThrow(
        RangeError,
      );
    });
  });

  describe("flow / branch 분기", () => {
    it("(a) 비어있지 않은 roster + 비어있지 않은 summaryLine → 2 라인 정상 블록", () => {
      const subjectRoster = roster({
        personIds: ["p1", "p2"],
        granularities: ["day", "week"] as PeriodGranularity[],
      });
      const subjectResult = result(
        "요약 평가 batch: 총 4건 · 평가 4 (생성 4 / 기존 0) · skip 0 [day 2(평가2) · week 2(평가2) · month 0 · other 0]",
      );
      const block = formatSummaryBatchReport(subjectRoster, subjectResult);
      const lines = block.split("\n");
      expect(lines).toHaveLength(2);
      expect(lines[0]).toContain("총 4좌표");
      expect(lines[1]).toContain("총 4건");
    });

    it("(b) 빈 roster(빈 personIds) → 계획 라인 총 0좌표(throw 0) · 결과 라인 그대로 · 여전히 2 라인", () => {
      const subjectRoster = roster({
        personIds: [],
        granularities: ["day", "week", "month"] as PeriodGranularity[],
      });
      const subjectResult = result(
        "요약 평가 batch: 총 0건 · 평가 0 (생성 0 / 기존 0) · skip 0 [day 0 · week 0 · month 0 · other 0]",
      );
      const block = formatSummaryBatchReport(subjectRoster, subjectResult);
      const lines = block.split("\n");
      expect(lines).toHaveLength(2);
      expect(lines[0]).toContain("총 0좌표");
      expect(lines[1]).toContain("총 0건");
    });

    it("(c) result 가드 분기(null) 도달 — roster 유효해도 result null 이면 result TypeError", () => {
      const okRoster = roster({ personIds: ["p1"], granularities: ["day"] });
      expect(() =>
        formatSummaryBatchReport(
          okRoster,
          null as unknown as SummaryBatchPipelineResult,
        ),
      ).toThrow(/result/);
    });

    it("(c) roster 가드 분기(null) 도달 — result 유효해도 roster null 이면 위임 roster TypeError", () => {
      const okResult = result(
        "요약 평가 batch: 총 0건 · 평가 0 (생성 0 / 기존 0) · skip 0 [day 0 · week 0 · month 0 · other 0]",
      );
      expect(() =>
        formatSummaryBatchReport(
          null as unknown as SummaryBatchRosterInput,
          okResult,
        ),
      ).toThrow(/roster/);
    });
  });

  describe("negative cases", () => {
    it("(1) roster null/undefined → 한국어 TypeError 2종", () => {
      const okResult = result(
        "요약 평가 batch: 총 0건 · 평가 0 (생성 0 / 기존 0) · skip 0 [day 0 · week 0 · month 0 · other 0]",
      );
      expect(() =>
        formatSummaryBatchReport(
          null as unknown as SummaryBatchRosterInput,
          okResult,
        ),
      ).toThrow(/roster/);
      expect(() =>
        formatSummaryBatchReport(
          undefined as unknown as SummaryBatchRosterInput,
          okResult,
        ),
      ).toThrow(/roster/);
    });

    it("(2) result null/undefined → 한국어 TypeError 2종", () => {
      const okRoster = roster({ personIds: ["p1"], granularities: ["day"] });
      expect(() =>
        formatSummaryBatchReport(
          okRoster,
          null as unknown as SummaryBatchPipelineResult,
        ),
      ).toThrow(/result/);
      expect(() =>
        formatSummaryBatchReport(
          okRoster,
          undefined as unknown as SummaryBatchPipelineResult,
        ),
      ).toThrow(/result/);
    });

    it("(3) result.summaryLine 누락/비-string → 한국어 TypeError", () => {
      const okRoster = roster({ personIds: ["p1"], granularities: ["day"] });
      expect(() =>
        formatSummaryBatchReport(
          okRoster,
          result(undefined as unknown as string),
        ),
      ).toThrow(/summaryLine/);
      expect(() =>
        formatSummaryBatchReport(okRoster, result(null as unknown as string)),
      ).toThrow(/summaryLine/);
    });

    it("(4) 빈 roster(personIds 빈 배열) + 정상 summaryLine → 계획 총 0좌표 + 결과 라인, 정확히 2 라인", () => {
      const subjectRoster = roster({
        personIds: [],
        granularities: ["day", "week", "month"] as PeriodGranularity[],
      });
      const subjectResult = result(
        "요약 평가 batch: 총 0건 · 평가 0 (생성 0 / 기존 0) · skip 0 [day 0 · week 0 · month 0 · other 0]",
      );
      const block = formatSummaryBatchReport(subjectRoster, subjectResult);
      const lines = block.split("\n");
      expect(lines).toHaveLength(2);
      expect(lines[0]).toContain("계획:");
      expect(lines[0]).toContain("총 0좌표");
      expect(lines[1]).toContain("결과:");
      expect(block.length).toBeGreaterThan(0);
    });

    it("(5) 동일 (roster, result) 2회 호출 → 두 출력 byte-identical(결정성·잔여 상태 누수 0)", () => {
      const subjectRoster = roster({
        personIds: ["p1", "p2"],
        granularities: ["day", "month"] as PeriodGranularity[],
      });
      const subjectResult = result(
        "요약 평가 batch: 총 4건 · 평가 4 (생성 4 / 기존 0) · skip 0 [day 2(평가2) · week 0 · month 2(평가2) · other 0]",
      );
      const first = formatSummaryBatchReport(subjectRoster, subjectResult);
      const second = formatSummaryBatchReport(subjectRoster, subjectResult);
      expect(first).toBe(second);
    });

    it("(6) 호출 후 입력 비변형(roster·personIds·result·summaryLine deep 동일)", () => {
      const subjectRoster = roster({
        personIds: ["p1", "p2"],
        granularities: ["day", "week"] as PeriodGranularity[],
      });
      const subjectResult = result(
        "요약 평가 batch: 총 4건 · 평가 4 (생성 4 / 기존 0) · skip 0 [day 2(평가2) · week 2(평가2) · month 0 · other 0]",
      );
      const personIdsSnapshot = [...subjectRoster.personIds];
      const granularitiesSnapshot = [...subjectRoster.granularities];
      const nowSnapshot = subjectRoster.now.getTime();
      const summaryLineSnapshot = subjectResult.summaryLine;
      formatSummaryBatchReport(subjectRoster, subjectResult);
      expect(subjectRoster.personIds).toEqual(personIdsSnapshot);
      expect(subjectRoster.granularities).toEqual(granularitiesSnapshot);
      expect(subjectRoster.now.getTime()).toBe(nowSnapshot);
      expect(subjectResult.summaryLine).toBe(summaryLineSnapshot);
    });
  });

  describe("위임 호출 무복제(single-source 재사용)", () => {
    it("결과 라인이 주어진 result.summaryLine 과 정확히 일치한다(중복 렌더 0)", () => {
      const subjectRoster = roster({
        personIds: ["p1"],
        granularities: ["day"] as PeriodGranularity[],
      });
      // 임의 sentinel summaryLine — formatSummaryBatchOutcome 재렌더면 이 문자열이
      // 그대로 나올 수 없다(가공 0 재사용임을 단언). outcome-shape 가드(T-0639)는
      // sentinel 이 형태 불변식 비정합이므로 본 "재사용" 검증에 한해 no-op 으로 mock —
      // 가공 0 재사용 사실만 격리 검증(가드 배선 자체는 별도 describe 에서 검증).
      jest
        .spyOn(outcomeFormatShapeModule, "assertSummaryBatchOutcomeFormatShape")
        .mockImplementation(() => {});
      const sentinel = "SENTINEL-요약-라인-12345";
      const subjectResult = result(sentinel);
      const block = formatSummaryBatchReport(subjectRoster, subjectResult);
      const resultLine = block.split("\n")[1];
      expect(resultLine).toBe(`결과: ${sentinel}`);
      jest.restoreAllMocks();
    });

    it("계획 라인이 formatSummaryBatchRosterPlan(roster) 출력과 라벨만 차이난다(재구현 0)", () => {
      const subjectRoster = roster({
        personIds: ["p1", "p2"],
        granularities: ["day", "week", "month"] as PeriodGranularity[],
      });
      const subjectResult = result(
        "요약 평가 batch: 총 6건 · 평가 6 (생성 6 / 기존 0) · skip 0 [day 2(평가2) · week 2(평가2) · month 2(평가2) · other 0]",
      );
      const block = formatSummaryBatchReport(subjectRoster, subjectResult);
      const planLine = block.split("\n")[0];
      expect(planLine).toBe(
        `계획: ${formatSummaryBatchRosterPlan(subjectRoster)}`,
      );
    });
  });

  // ── T-0637: 합본 1번째 라인 plan-shape 가드 배선 ───────────────────────────────
  // formatSummaryBatchReport(roster, result) 가 formatSummaryBatchRosterPlan(roster)
  // 산출 직후·PLAN_LABEL prepend 및 합성 전에 assertSummaryBatchRosterPlanShape(plan)
  // 형태 가드 단언을 호출함을 박제한다(T-0636 service-boundary 배선의 합본 mirror —
  // 이번엔 도메인 합본 formatter 내부의 별개 산출 지점이 대상). 검증축:
  // (1) 가드가 정확히 1회 + bare formatter 산출(라벨 prepend 전) 인자 그대로 호출(배선
  //     사실 + 가드 대상이 라벨 부착 라인이 아닌 bare plan 라인임을 박제 — 가드의 prefix
  //     불변식 ③ 이 bare plan 라인 기준이므로 라벨 부착 후 단언하면 prefix 불일치로
  //     false-positive throw),
  // (2) format → assert → return 호출 순서(spy invocationCallOrder),
  // (3) 가드 RangeError/TypeError throw 가 그대로 전파되어 손상 합본 미반환,
  // (4) 같은 (roster, result) 2회 호출 결정성·잔여 상태 누수 0,
  // (5) 입력 비변형. 형태 가드 본문은 변경 0(single-source `summary-batch-roster-plan-
  // shape.ts`) — 본 spec 은 formatter 의 단언 호출 배선만 검증한다.

  describe("plan-shape 가드 배선(T-0637)", () => {
    const subjectRoster = roster({
      personIds: ["alice", "bob"],
      granularities: ["day", "week"] as PeriodGranularity[],
    });
    const SAMPLE_SUMMARY_LINE =
      "요약 평가 batch: 총 4건 · 평가 4 (생성 4 / 기존 0) · skip 0 [day 2(평가2) · week 2(평가2) · month 0 · other 0]";

    it("(happy) 정합 (roster, result) → 가드가 bare formatter 산출(라벨 부착 전) 인자 그대로 정확히 1회 호출됨 + throw 0 + 기존과 byte-identical 합본 반환", () => {
      const subjectResult = result(SAMPLE_SUMMARY_LINE);
      // spyOn 은 formatter 가 import 하는 동일 module namespace 객체를 가로채므로 formatter
      // 의 실제 호출이 잡힌다. 실 구현은 그대로 호출(정상 형태면 void) — 정합 산출이
      // 변형 없이 반환되는 happy 분기를 검증.
      const shapeSpy = jest.spyOn(
        rosterPlanShapeModule,
        "assertSummaryBatchRosterPlanShape",
      );

      const block = formatSummaryBatchReport(subjectRoster, subjectResult);

      // (a) 가드가 정확히 1회 + bare formatter 산출(label prepend 전 string) 인자 그대로
      //     호출(배선 사실 박제). bare plan 라인은 `요약 평가 batch 예정: ` 로 시작하며,
      //     `계획: ` label 이 부착된 합본 라인은 아니다(가드 prefix 불변식 ③ 일관성).
      expect(shapeSpy).toHaveBeenCalledTimes(1);
      const bareSpyArg = shapeSpy.mock.calls[0][0];
      expect(bareSpyArg).toBe(formatSummaryBatchRosterPlan(subjectRoster));
      expect(bareSpyArg.startsWith("요약 평가 batch 예정: ")).toBe(true);
      // 가드 인자가 라벨 부착 라인 (`계획: ...`)이 아님을 명시 박제.
      expect(bareSpyArg.startsWith("계획: ")).toBe(false);
      // (b) 정합 산출은 가드 통과 후 byte-identical 합본 반환(가드가 정상 plan 라인
      //     변형·차단 0, 합본 합성 로직 무변경).
      const expected = `계획: ${formatSummaryBatchRosterPlan(subjectRoster)}\n결과: ${SAMPLE_SUMMARY_LINE}`;
      expect(block).toBe(expected);
      shapeSpy.mockRestore();
    });

    it("(call order) format → assert → return 순서임을 invocation order 로 검증(spy 두 함수 호출 순서)", () => {
      // 호출 순서만 기록(spyOn 은 formatter 가 import 하는 동일 module namespace 객체를
      // 가로채므로 formatter 의 실제 호출이 잡힌다). 실 구현 캡처(spy 가 같은 binding 을
      // 덮으므로 재귀 방지용 actual 참조).
      const order: string[] = [];
      const actualFormat = rosterPlanFormatModule.formatSummaryBatchRosterPlan;
      const formatSpy = jest
        .spyOn(rosterPlanFormatModule, "formatSummaryBatchRosterPlan")
        .mockImplementation((r) => {
          order.push("format");
          return actualFormat(r);
        });
      const shapeSpy = jest
        .spyOn(rosterPlanShapeModule, "assertSummaryBatchRosterPlanShape")
        .mockImplementation(() => {
          order.push("assert");
        });

      formatSummaryBatchReport(subjectRoster, result(SAMPLE_SUMMARY_LINE));

      // format → assert(가드는 formatter 산출 **뒤** 호출 — 합성·반환 전 단언).
      expect(order).toEqual(["format", "assert"]);
      // 가드가 받은 인자는 formatter 가 반환한 그 산출(같은 string 참조).
      expect(shapeSpy).toHaveBeenCalledWith(formatSpy.mock.results[0].value);
      formatSpy.mockRestore();
      shapeSpy.mockRestore();
    });

    it("(negative 1) 가드 RangeError throw → 그대로 전파 + 손상 합본 미반환", () => {
      const corrupted = new RangeError("test corrupted plan shape");
      const shapeSpy = jest
        .spyOn(rosterPlanShapeModule, "assertSummaryBatchRosterPlanShape")
        .mockImplementation(() => {
          throw corrupted;
        });

      expect(() =>
        formatSummaryBatchReport(subjectRoster, result(SAMPLE_SUMMARY_LINE)),
      ).toThrow(corrupted);
      // 가드 throw → 손상 plan 라인이 합본 리포트 합성·반환 단계에 도달하기 전 차단.
      expect(shapeSpy).toHaveBeenCalledTimes(1);
      shapeSpy.mockRestore();
    });

    it("(negative 2) 가드 TypeError throw → 그대로 전파 + 손상 합본 미반환(구조 결손 시뮬)", () => {
      const corrupted = new TypeError("test plan type fail");
      const shapeSpy = jest
        .spyOn(rosterPlanShapeModule, "assertSummaryBatchRosterPlanShape")
        .mockImplementation(() => {
          throw corrupted;
        });

      expect(() =>
        formatSummaryBatchReport(subjectRoster, result(SAMPLE_SUMMARY_LINE)),
      ).toThrow(corrupted);
      expect(shapeSpy).toHaveBeenCalledTimes(1);
      shapeSpy.mockRestore();
    });

    it("(negative 3) formatter 가 손상 형태(개행 혼입) 반환 → 실 가드가 RangeError 로 전파 + 손상 합본 미반환", () => {
      // formatter 만 mock 으로 손상 plan(개행 혼입 = 단일 라인 불변식 위반) 반환하게 하고,
      // 가드는 실 구현 그대로 둬 실제 형태 위반 차단 경로(format mock → 실 가드 throw)를
      // 검증.
      const formatSpy = jest
        .spyOn(rosterPlanFormatModule, "formatSummaryBatchRosterPlan")
        .mockReturnValue(
          "요약 평가 batch 예정: person 1명 · 총 1좌표 [day 1 · week 0 · month 0 · other 0]\n오염",
        );

      expect(() =>
        formatSummaryBatchReport(subjectRoster, result(SAMPLE_SUMMARY_LINE)),
      ).toThrow(RangeError);
      formatSpy.mockRestore();
    });

    it("(negative 4) formatter 가 prefix drift(없는 prefix) 반환 → 실 가드가 RangeError 로 전파", () => {
      // prefix drift(③ 불변식 위반) 가 가드에서 차단됨을 검증.
      const formatSpy = jest
        .spyOn(rosterPlanFormatModule, "formatSummaryBatchRosterPlan")
        .mockReturnValue(
          "WRONG_PREFIX: person 1명 · 총 1좌표 [day 1 · week 0 · month 0 · other 0]",
        );

      expect(() =>
        formatSummaryBatchReport(subjectRoster, result(SAMPLE_SUMMARY_LINE)),
      ).toThrow(RangeError);
      formatSpy.mockRestore();
    });

    it("(call ordering vs label) 가드 호출이 PLAN_LABEL prepend **전** 임을 reverse-fail 로 검증 — 라벨 prefix 가 가드 인자에 새지 않음", () => {
      // 가드 spy 인자를 정밀하게 검증. 만약 future regression 으로 라벨 부착 후 단언으로
      // 잘못 변경되면 가드 인자가 `계획: ...` 로 시작하게 되어 본 expect 가 fail.
      const shapeSpy = jest.spyOn(
        rosterPlanShapeModule,
        "assertSummaryBatchRosterPlanShape",
      );

      formatSummaryBatchReport(subjectRoster, result(SAMPLE_SUMMARY_LINE));

      expect(shapeSpy).toHaveBeenCalledTimes(1);
      const arg = shapeSpy.mock.calls[0][0];
      // bare plan 라인은 `요약 평가 batch 예정: ` 로 시작해야 한다(가드 ③ 정합).
      expect(arg.startsWith("요약 평가 batch 예정: ")).toBe(true);
      // 라벨 부착 후 단언이면 `계획: ` 으로 시작하게 됨 — 본 expect 가 false-positive
      // 회귀 catch.
      expect(arg.includes("계획: ")).toBe(false);
      shapeSpy.mockRestore();
    });

    it("(determinism + non-mutation) 같은 (roster, result) 2회 호출 → byte-identical 반환 · 가드 호출 2회(잔여 상태 누수 0) · 입력 비변형(가드 배선이 roster·result.summaryLine 변형 0)", () => {
      const personIds = ["alice", "bob"];
      const granularities: PeriodGranularity[] = ["day", "week"];
      const personIdsSnapshot = [...personIds];
      const granularitiesSnapshot = [...granularities];
      const localRoster = roster({ personIds, granularities });
      const nowTimeBefore = localRoster.now.getTime();
      const subjectResult = result(SAMPLE_SUMMARY_LINE);
      const summaryLineBefore = subjectResult.summaryLine;
      const shapeSpy = jest.spyOn(
        rosterPlanShapeModule,
        "assertSummaryBatchRosterPlanShape",
      );

      const first = formatSummaryBatchReport(localRoster, subjectResult);
      const second = formatSummaryBatchReport(localRoster, subjectResult);

      // 결정성: 두 출력 byte-identical + 가드 매 호출마다 1회(총 2회, 잔여 상태 누수 0).
      expect(first).toBe(second);
      expect(shapeSpy).toHaveBeenCalledTimes(2);
      // 비변형: 가드 배선이 입력 변형 0(가드 본문 비변형 + formatter 추가 변형 0).
      expect(personIds).toEqual(personIdsSnapshot);
      expect(granularities).toEqual(granularitiesSnapshot);
      expect(localRoster.now.getTime()).toBe(nowTimeBefore);
      expect(subjectResult.summaryLine).toBe(summaryLineBefore);
      shapeSpy.mockRestore();
    });

    it("(result null preserved) result null → 기존 한국어 TypeError 전파(가드 단계 미도달 — 가드 spy 미호출)", () => {
      // 기존 result 가드(직접 throw)가 가드 호출 전 차단함을 검증 — R-112 기존 동작 보존.
      const shapeSpy = jest.spyOn(
        rosterPlanShapeModule,
        "assertSummaryBatchRosterPlanShape",
      );

      expect(() =>
        formatSummaryBatchReport(
          subjectRoster,
          null as unknown as SummaryBatchPipelineResult,
        ),
      ).toThrow(TypeError);
      // 가드는 호출되지 않아야 한다(result 가드가 먼저 차단).
      expect(shapeSpy).not.toHaveBeenCalled();
      shapeSpy.mockRestore();
    });

    it("(result.summaryLine 비-string preserved) result.summaryLine null → 기존 한국어 TypeError 전파(가드 spy 미호출)", () => {
      const shapeSpy = jest.spyOn(
        rosterPlanShapeModule,
        "assertSummaryBatchRosterPlanShape",
      );

      expect(() =>
        formatSummaryBatchReport(
          subjectRoster,
          result(null as unknown as string),
        ),
      ).toThrow(/summaryLine/);
      expect(shapeSpy).not.toHaveBeenCalled();
      shapeSpy.mockRestore();
    });
  });

  // ── T-0639: 합본 2번째 라인 outcome-shape 가드 배선 ────────────────────────────
  // formatSummaryBatchReport(roster, result) 가 bare result.summaryLine(이미
  // formatSummaryBatchOutcome 으로 렌더된 outcome 한 줄)을 RESULT_LABEL prepend·resultLine
  // 합성 **전**에 assertSummaryBatchOutcomeFormatShape(result.summaryLine) 형태 가드로
  // 단언함을 박제한다(T-0637 plan-line 배선의 정확한 outcome-side mirror — 같은 합본
  // formatter 안의 별개 산출 지점인 2번째 라인이 대상). 검증축:
  // (1) 가드가 정확히 1회 + bare result.summaryLine(라벨 prepend 전) 인자 그대로 호출(배선
  //     사실 + 가드 대상이 `결과: ` 부착 라인이 아닌 bare outcome 라인임을 박제 — 가드의
  //     prefix 불변식 ③ 이 bare outcome 라인 `요약 평가 batch: 총 ` 기준이므로 라벨 부착 후
  //     단언하면 prefix 불일치 false-positive throw),
  // (2) plan-shape → outcome-shape → return 호출 순서(spy invocationCallOrder),
  // (3) 가드 RangeError/TypeError throw 가 그대로 전파되어 손상 합본 미반환,
  // (4) 형태 위반 outcome 라인(prefix drift·개행 혼입·버킷 슬롯 누락·순서 뒤바뀜) → 실 가드
  //     RangeError 전파,
  // (5) result null/result.summaryLine 비-string → 기존 L125~133 가드가 outcome 가드 전
  //     차단(가드 spy 미호출, 기존 동작 보존),
  // (6) 같은 (roster, result) 2회 호출 결정성·잔여 상태 누수 0 + 입력 비변형.
  // 형태 가드 본문은 변경 0(single-source `summary-batch-outcome-format-shape.ts`) — 본
  // spec 은 formatter 의 단언 호출 배선만 검증한다.

  describe("outcome-shape 가드 배선(T-0639)", () => {
    const subjectRoster = roster({
      personIds: ["alice", "bob"],
      granularities: ["day", "week"] as PeriodGranularity[],
    });
    // 형태 정합 outcome 라인(가드 ①~⑤ 통과): prefix `요약 평가 batch: 총 ` + 카운트
    // 토큰 4종 + `[day · week · month · other]` 4 버킷 슬롯 고정 순서.
    const VALID_OUTCOME_LINE =
      "요약 평가 batch: 총 4건 · 평가 4 (생성 4 / 기존 0) · skip 0 [day 2(평가2) · week 2(평가2) · month 0 · other 0]";

    it("(happy) 정합 (roster, result) → 가드가 bare result.summaryLine(라벨 부착 전) 인자 그대로 정확히 1회 호출됨 + throw 0 + 기존과 byte-identical 합본 반환", () => {
      const subjectResult = result(VALID_OUTCOME_LINE);
      // spyOn 은 formatter 가 import 하는 동일 module namespace 객체를 가로채므로 formatter
      // 의 실제 호출이 잡힌다. 실 구현은 그대로 호출(정상 형태면 void) — 정합 산출이
      // 변형 없이 반환되는 happy 분기를 검증.
      const outcomeSpy = jest.spyOn(
        outcomeFormatShapeModule,
        "assertSummaryBatchOutcomeFormatShape",
      );

      const block = formatSummaryBatchReport(subjectRoster, subjectResult);

      // (a) 가드가 정확히 1회 + bare result.summaryLine(label prepend 전 string) 인자 그대로
      //     호출(배선 사실 박제). bare outcome 라인은 `요약 평가 batch: 총 ` 으로 시작하며,
      //     `결과: ` label 이 부착된 합본 라인은 아니다(가드 prefix 불변식 ③ 일관성).
      expect(outcomeSpy).toHaveBeenCalledTimes(1);
      const bareSpyArg = outcomeSpy.mock.calls[0][0];
      expect(bareSpyArg).toBe(VALID_OUTCOME_LINE);
      expect(bareSpyArg.startsWith("요약 평가 batch: 총 ")).toBe(true);
      // 가드 인자가 라벨 부착 라인 (`결과: ...`)이 아님을 명시 박제.
      expect(bareSpyArg.startsWith("결과: ")).toBe(false);
      // (b) 정합 산출은 가드 통과 후 byte-identical 합본 반환(가드가 정상 outcome 라인
      //     변형·차단 0, 합본 합성 로직 무변경).
      const expected = `계획: ${formatSummaryBatchRosterPlan(subjectRoster)}\n결과: ${VALID_OUTCOME_LINE}`;
      expect(block).toBe(expected);
      outcomeSpy.mockRestore();
    });

    it("(call order) plan-shape 가드 → outcome-shape 가드 → return 순서임을 invocation order 로 검증(spy 두 가드 호출 순서)", () => {
      // plan-shape 가드(④ 전 단계)가 outcome-shape 가드(resultLine 합성 직전)보다 먼저
      // 호출됨을 박제 — 가드 호출 순서 ③ plan-shape → ④ outcome-shape 고정.
      const order: string[] = [];
      const planSpy = jest
        .spyOn(rosterPlanShapeModule, "assertSummaryBatchRosterPlanShape")
        .mockImplementation(() => {
          order.push("plan-shape");
        });
      const outcomeSpy = jest
        .spyOn(outcomeFormatShapeModule, "assertSummaryBatchOutcomeFormatShape")
        .mockImplementation(() => {
          order.push("outcome-shape");
        });

      formatSummaryBatchReport(subjectRoster, result(VALID_OUTCOME_LINE));

      expect(order).toEqual(["plan-shape", "outcome-shape"]);
      // outcome 가드가 받은 인자는 bare result.summaryLine 그대로.
      expect(outcomeSpy).toHaveBeenCalledWith(VALID_OUTCOME_LINE);
      planSpy.mockRestore();
      outcomeSpy.mockRestore();
    });

    it("(negative 1) 가드 RangeError throw → 그대로 전파 + 손상 합본 미반환", () => {
      const corrupted = new RangeError("test corrupted outcome shape");
      const outcomeSpy = jest
        .spyOn(outcomeFormatShapeModule, "assertSummaryBatchOutcomeFormatShape")
        .mockImplementation(() => {
          throw corrupted;
        });

      expect(() =>
        formatSummaryBatchReport(subjectRoster, result(VALID_OUTCOME_LINE)),
      ).toThrow(corrupted);
      // 가드 throw → 손상 outcome 라인이 합본 리포트 합성·반환 단계에 도달하기 전 차단.
      expect(outcomeSpy).toHaveBeenCalledTimes(1);
      outcomeSpy.mockRestore();
    });

    it("(negative 2) 가드 TypeError throw → 그대로 전파 + 손상 합본 미반환(구조 결손 시뮬)", () => {
      const corrupted = new TypeError("test outcome type fail");
      const outcomeSpy = jest
        .spyOn(outcomeFormatShapeModule, "assertSummaryBatchOutcomeFormatShape")
        .mockImplementation(() => {
          throw corrupted;
        });

      expect(() =>
        formatSummaryBatchReport(subjectRoster, result(VALID_OUTCOME_LINE)),
      ).toThrow(corrupted);
      expect(outcomeSpy).toHaveBeenCalledTimes(1);
      outcomeSpy.mockRestore();
    });

    it("(negative 3) prefix drift outcome 라인(`요약 평가: 총 ...`) → 실 가드가 RangeError 로 전파 + 손상 합본 미반환", () => {
      // outcome 라인 prefix 가 `요약 평가 batch: 총 ` 이 아니면(③ 불변식 위반) 실 가드가
      // RangeError 로 차단함을 검증(format mock 0 — bare summaryLine 직접 손상 주입).
      const driftLine =
        "요약 평가: 총 4건 · 평가 4 (생성 4 / 기존 0) · skip 0 [day 2 · week 2 · month 0 · other 0]";
      expect(() =>
        formatSummaryBatchReport(subjectRoster, result(driftLine)),
      ).toThrow(RangeError);
    });

    it("(negative 4) 개행 혼입 outcome 라인(`...other 0]\\n오염`) → 실 가드가 RangeError 로 전파", () => {
      // 단일 라인 불변식(② 개행 0) 위반이 가드에서 차단됨을 검증.
      const newlineLine = `${VALID_OUTCOME_LINE}\n오염`;
      expect(() =>
        formatSummaryBatchReport(subjectRoster, result(newlineLine)),
      ).toThrow(RangeError);
    });

    it("(negative 5) 버킷 슬롯 누락 outcome 라인(`[day...]` 없음) → 실 가드가 RangeError 로 전파", () => {
      // 4 버킷 슬롯(⑤) 누락이 가드에서 차단됨을 검증.
      const noBucketLine =
        "요약 평가 batch: 총 4건 · 평가 4 (생성 4 / 기존 0) · skip 0";
      expect(() =>
        formatSummaryBatchReport(subjectRoster, result(noBucketLine)),
      ).toThrow(RangeError);
    });

    it("(negative 6) 버킷 순서 뒤바뀜 outcome 라인(`[week ... day ...]`) → 실 가드가 RangeError 로 전파", () => {
      // 4 버킷 고정 순서(⑤) drift 가 가드에서 차단됨을 검증.
      const reorderedLine =
        "요약 평가 batch: 총 4건 · 평가 4 (생성 4 / 기존 0) · skip 0 [week 2 · day 2 · month 0 · other 0]";
      expect(() =>
        formatSummaryBatchReport(subjectRoster, result(reorderedLine)),
      ).toThrow(RangeError);
    });

    it("(negative 7) 카운트 토큰 누락 outcome 라인(`· skip ` 없음) → 실 가드가 RangeError 로 전파", () => {
      // 전역 카운트 토큰(④) 누락이 가드에서 차단됨을 검증.
      const noSkipLine =
        "요약 평가 batch: 총 4건 · 평가 4 (생성 4 / 기존 0) [day 2 · week 2 · month 0 · other 0]";
      expect(() =>
        formatSummaryBatchReport(subjectRoster, result(noSkipLine)),
      ).toThrow(RangeError);
    });

    it("(result null preserved) result null → 기존 한국어 TypeError 전파(outcome 가드 단계 미도달 — 가드 spy 미호출)", () => {
      // 기존 result 가드(직접 throw)가 outcome 가드 호출 전 차단함을 검증 — R-112 기존
      // L125~127 동작 보존.
      const outcomeSpy = jest.spyOn(
        outcomeFormatShapeModule,
        "assertSummaryBatchOutcomeFormatShape",
      );

      expect(() =>
        formatSummaryBatchReport(
          subjectRoster,
          null as unknown as SummaryBatchPipelineResult,
        ),
      ).toThrow(TypeError);
      // outcome 가드는 호출되지 않아야 한다(result 가드가 먼저 차단).
      expect(outcomeSpy).not.toHaveBeenCalled();
      outcomeSpy.mockRestore();
    });

    it("(result.summaryLine 비-string preserved) result.summaryLine null → 기존 한국어 TypeError 전파(outcome 가드 spy 미호출)", () => {
      // 기존 L129 string 가드가 outcome 가드 전 차단함을 검증 — 기존 동작 보존.
      const outcomeSpy = jest.spyOn(
        outcomeFormatShapeModule,
        "assertSummaryBatchOutcomeFormatShape",
      );

      expect(() =>
        formatSummaryBatchReport(
          subjectRoster,
          result(null as unknown as string),
        ),
      ).toThrow(/summaryLine/);
      expect(outcomeSpy).not.toHaveBeenCalled();
      outcomeSpy.mockRestore();
    });

    it("(determinism + non-mutation) 같은 (roster, result) 2회 호출 → byte-identical 반환 · outcome 가드 호출 2회(잔여 상태 누수 0) · 입력 비변형", () => {
      const personIds = ["alice", "bob"];
      const granularities: PeriodGranularity[] = ["day", "week"];
      const personIdsSnapshot = [...personIds];
      const granularitiesSnapshot = [...granularities];
      const localRoster = roster({ personIds, granularities });
      const nowTimeBefore = localRoster.now.getTime();
      const subjectResult = result(VALID_OUTCOME_LINE);
      const summaryLineBefore = subjectResult.summaryLine;
      const outcomeSpy = jest.spyOn(
        outcomeFormatShapeModule,
        "assertSummaryBatchOutcomeFormatShape",
      );

      const first = formatSummaryBatchReport(localRoster, subjectResult);
      const second = formatSummaryBatchReport(localRoster, subjectResult);

      // 결정성: 두 출력 byte-identical + 가드 매 호출마다 1회(총 2회, 잔여 상태 누수 0).
      expect(first).toBe(second);
      expect(outcomeSpy).toHaveBeenCalledTimes(2);
      // 비변형: 가드 배선이 입력 변형 0(가드 본문 비변형 + formatter 추가 변형 0).
      expect(personIds).toEqual(personIdsSnapshot);
      expect(granularities).toEqual(granularitiesSnapshot);
      expect(localRoster.now.getTime()).toBe(nowTimeBefore);
      expect(subjectResult.summaryLine).toBe(summaryLineBefore);
      outcomeSpy.mockRestore();
    });
  });
});
