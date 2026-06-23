// realdata-e2e-result-report-plan.spec.ts — T-0593 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: 정상 EvaluationResult[] + 유효 run → { summary, descriptor } 산출.
//     summary 가 buildRealDataResultSummary 단독 결과와 deep-equal, descriptor 가
//     buildRealDataResultIssueDescriptor(summary, run) 단독 결과와 deep-equal.
//   - error path: run.gitSha 빈/공백 → 위임 guard throw 전파, run.dateToken 빈/공백 →
//     throw 전파(자체 try/catch 없이 그대로 전파). 각 별도 case.
//   - flow/branch: 빈 results(count 0·전 슬롯 0·totalVolume 0 + descriptor 정상) /
//     단일 result / 다수 result(서로 다른 difficulty·contribution 슬롯) 각 1+,
//     run guard 분기(gitSha 유효/빈, dateToken 유효/빈) 각 1+.
//   - negative 충분 cover(단일 negative 금지 — 분기마다): (1) gitSha 빈/공백-only/탭개행,
//     (2) dateToken 빈/공백-only/탭개행, (3) 빈 results 경계(throw 0, 빈 분포 descriptor),
//     (4) 무공유(입력 mutate 0·매 호출 새 객체 트리·deep-equal 이지만 not-same-reference),
//     (5) 결정론(동일 (results, run) 2회 호출 deep-equal).
//   - R-59: plan 은 요약 집계 descriptor + 이슈 descriptor 만 보유 — raw narrative /
//     활동 본문 구조적 미포함(위임 helper 들이 이미 미보유).
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";

import { buildRealDataResultIssueDescriptor } from "./realdata-e2e-result-issue-descriptor";
import type { RealDataResultIssueRunRef } from "./realdata-e2e-result-issue-descriptor";
import { buildRealDataResultReportPlan } from "./realdata-e2e-result-report-plan";
import { buildRealDataResultSummary } from "./realdata-e2e-result-summary";

// EvaluationResult fixture — 평가 단위 1 건 모사. narrative 는 임의 본문(plan 이
// 통과시키지 않음을 검증하는 데 쓰임 — 위임 summary 가 카운트만 집계).
function makeResult(
  overrides: Partial<EvaluationResult> = {},
): EvaluationResult {
  return {
    unitId: overrides.unitId ?? "commit:repo#1:abc123",
    narrative: overrides.narrative ?? "정성 평가문 본문(raw 아님)",
    difficulty: overrides.difficulty ?? "medium",
    contribution: overrides.contribution ?? "high",
    volume: overrides.volume ?? 10,
  };
}

// 유효 run 식별자 fixture.
function makeRun(
  overrides: Partial<RealDataResultIssueRunRef> = {},
): RealDataResultIssueRunRef {
  return {
    gitSha: overrides.gitSha ?? "abc1234",
    dateToken: overrides.dateToken ?? "2026-06-23",
  };
}

describe("buildRealDataResultReportPlan — post-evaluation 종단 plan 컴포저", () => {
  describe("happy-path — 위임 결과 합성", () => {
    it("정상 results + 유효 run → { summary, descriptor }, 위임 단독 결과와 각각 deep-equal", () => {
      const results = [
        makeResult({ difficulty: "easy", contribution: "low", volume: 3 }),
        makeResult({ difficulty: "hard", contribution: "high", volume: 7 }),
      ];
      const run = makeRun();

      const plan = buildRealDataResultReportPlan(results, run);

      const expectedSummary = buildRealDataResultSummary(results);
      const expectedDescriptor = buildRealDataResultIssueDescriptor(
        expectedSummary,
        run,
      );

      expect(plan.summary).toEqual(expectedSummary);
      expect(plan.descriptor).toEqual(expectedDescriptor);
    });

    it("plan.descriptor 가 plan.summary 를 source 로 합성됨(descriptor=buildIssue(plan.summary, run))", () => {
      const results = [makeResult()];
      const run = makeRun();

      const plan = buildRealDataResultReportPlan(results, run);

      expect(plan.descriptor).toEqual(
        buildRealDataResultIssueDescriptor(plan.summary, run),
      );
    });
  });

  describe("flow / branch — results 카디널리티 분기", () => {
    it("빈 results 배열 + 유효 run → count 0·전 슬롯 0·totalVolume 0 + descriptor 정상(throw 0)", () => {
      const plan = buildRealDataResultReportPlan([], makeRun());

      expect(plan.summary.count).toBe(0);
      expect(plan.summary.totalVolume).toBe(0);
      expect(plan.summary.byDifficulty).toEqual({
        easy: 0,
        medium: 0,
        hard: 0,
      });
      expect(plan.summary.byContribution).toEqual({
        zero: 0,
        low: 0,
        medium: 0,
        high: 0,
      });
      // 빈 results 라도 run 유효하면 descriptor 정상 합성(title/marker/body 존재).
      expect(plan.descriptor.title.length).toBeGreaterThan(0);
      expect(plan.descriptor.marker.length).toBeGreaterThan(0);
      expect(plan.descriptor.body.length).toBeGreaterThan(0);
    });

    it("단일 result → count 1, 해당 슬롯 +1, totalVolume 보존", () => {
      const plan = buildRealDataResultReportPlan(
        [makeResult({ difficulty: "easy", contribution: "zero", volume: 5 })],
        makeRun(),
      );

      expect(plan.summary.count).toBe(1);
      expect(plan.summary.byDifficulty.easy).toBe(1);
      expect(plan.summary.byContribution.zero).toBe(1);
      expect(plan.summary.totalVolume).toBe(5);
    });

    it("다수 result(서로 다른 difficulty·contribution 슬롯) → 각 슬롯 카운트·volume 합산", () => {
      const plan = buildRealDataResultReportPlan(
        [
          makeResult({ difficulty: "easy", contribution: "low", volume: 2 }),
          makeResult({
            difficulty: "medium",
            contribution: "medium",
            volume: 4,
          }),
          makeResult({ difficulty: "hard", contribution: "high", volume: 8 }),
        ],
        makeRun(),
      );

      expect(plan.summary.count).toBe(3);
      expect(plan.summary.byDifficulty).toEqual({
        easy: 1,
        medium: 1,
        hard: 1,
      });
      expect(plan.summary.byContribution).toEqual({
        zero: 0,
        low: 1,
        medium: 1,
        high: 1,
      });
      expect(plan.summary.totalVolume).toBe(14);
    });
  });

  describe("error path — 위임 guard throw 전파(자체 try/catch 0)", () => {
    it("run.gitSha 빈 문자열 → 위임 assertNonBlank throw 전파", () => {
      expect(() =>
        buildRealDataResultReportPlan([makeResult()], makeRun({ gitSha: "" })),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("run.gitSha 공백-only → 위임 assertNonBlank throw 전파", () => {
      expect(() =>
        buildRealDataResultReportPlan(
          [makeResult()],
          makeRun({ gitSha: "   " }),
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("run.gitSha 탭/개행-only → 위임 assertNonBlank throw 전파", () => {
      expect(() =>
        buildRealDataResultReportPlan(
          [makeResult()],
          makeRun({ gitSha: "\t\n" }),
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("run.dateToken 빈 문자열 → 위임 assertNonBlank throw 전파", () => {
      expect(() =>
        buildRealDataResultReportPlan(
          [makeResult()],
          makeRun({ dateToken: "" }),
        ),
      ).toThrow(/dateToken 가 비어있습니다/);
    });

    it("run.dateToken 공백-only → 위임 assertNonBlank throw 전파", () => {
      expect(() =>
        buildRealDataResultReportPlan(
          [makeResult()],
          makeRun({ dateToken: "   " }),
        ),
      ).toThrow(/dateToken 가 비어있습니다/);
    });

    it("run.dateToken 탭/개행-only → 위임 assertNonBlank throw 전파", () => {
      expect(() =>
        buildRealDataResultReportPlan(
          [makeResult()],
          makeRun({ dateToken: "\t\n" }),
        ),
      ).toThrow(/dateToken 가 비어있습니다/);
    });

    it("빈 results + run.gitSha 빈 → summary 는 집계 가능하나 descriptor 단계에서 throw 전파", () => {
      expect(() =>
        buildRealDataResultReportPlan([], makeRun({ gitSha: "" })),
      ).toThrow(/gitSha 가 비어있습니다/);
    });
  });

  describe("결정론·무공유·R-59 정합", () => {
    it("동일 (results, run) 두 번 호출 → deep-equal(결정론)", () => {
      const results = [makeResult(), makeResult({ difficulty: "hard" })];
      const run = makeRun();

      const first = buildRealDataResultReportPlan(results, run);
      const second = buildRealDataResultReportPlan(results, run);

      expect(first).toEqual(second);
    });

    it("매 호출 새 plan·summary·descriptor 객체 반환(deep-equal 이지만 참조 무공유)", () => {
      const results = [makeResult()];
      const run = makeRun();

      const first = buildRealDataResultReportPlan(results, run);
      const second = buildRealDataResultReportPlan(results, run);

      expect(first).not.toBe(second);
      expect(first.summary).not.toBe(second.summary);
      expect(first.summary.byDifficulty).not.toBe(second.summary.byDifficulty);
      expect(first.descriptor).not.toBe(second.descriptor);
    });

    it("입력 results 배열·원소 mutate 0", () => {
      const result = makeResult();
      const results = [result];
      const resultBefore = { ...result };
      const lengthBefore = results.length;

      buildRealDataResultReportPlan(results, makeRun());

      expect(results).toHaveLength(lengthBefore);
      expect(results[0]).toEqual(resultBefore);
    });

    it("입력 run 객체 mutate 0", () => {
      const run = makeRun();
      const runBefore = { ...run };

      buildRealDataResultReportPlan([makeResult()], run);

      expect(run).toEqual(runBefore);
    });

    it("R-59: plan 은 summary(카운트·분포·합산) + descriptor(식별자·요약 렌더)만 보유 — raw narrative 미통과", () => {
      const results = [
        makeResult({ narrative: "raw 본문이 이 안에 있으면 안 됨 #SECRET" }),
      ];

      const plan = buildRealDataResultReportPlan(results, makeRun());

      // plan.summary 는 카운트·분포·합산 키만, descriptor 는 title/marker/body 키만.
      expect(Object.keys(plan.summary).sort()).toEqual([
        "byContribution",
        "byDifficulty",
        "count",
        "totalVolume",
      ]);
      expect(Object.keys(plan.descriptor).sort()).toEqual([
        "body",
        "marker",
        "title",
      ]);
      // narrative raw 본문이 descriptor body 로 새지 않음(요약 렌더만).
      expect(plan.descriptor.body).not.toContain("#SECRET");
    });
  });
});
