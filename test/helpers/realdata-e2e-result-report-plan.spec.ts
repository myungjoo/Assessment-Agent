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
import * as bodyConsistencyModule from "./realdata-e2e-result-issue-descriptor-body-consistency";
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

  // T-0648 — buildRealDataResultReportPlan 이 `return { summary, descriptor }` 직전에
  // 자기 plan 의 두 구성요소가 body 구조상 정합한지 assertRealDataResultIssueDescriptor
  // BodyConsistent 로 self-assert 하도록 배선됐음을 검증한다(T-0647 builder self-wire 의
  // composer-side mirror). 컴포저는 항상 정합 summary/descriptor 를 합성하므로 self-guard
  // throw 분기는 컴포저 입력으로 직접 유발 불가 — 본 describe 는 (a) self-wire 가 실제
  // 컴포저 산출 경로에 (descriptor, summary) 인자로 정확히 1 회 배선됐음 + (b) self-wire 가
  // 컴포저 동작(summary·descriptor byte-identical)을 깨지 않음에 집중한다(throw 분기는
  // T-0646 의 helper-직접 spec 가 이미 cover).
  describe("body-consistency self-guard self-wire 배선 (T-0648)", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    // negative ① — self-wire 배선 검증: 가드가 컴포저 산출 경로에 실제 배선됐음을
    // spyOn 으로 감시. 본 가드는 같은 모듈 export 를 위임 builder(T-0647 self-wire)도
    // 호출하므로 spy 는 총 2 회 잡힌다 — (1) descriptor 합성 단계의 builder self-wire,
    // (2) 컴포저 반환 직전의 composer self-wire(T-0648). 컴포저 self-wire 는 호출 체인의
    // 가장 바깥이므로 마지막 호출이며, (합성된 plan.descriptor, 집계된 plan.summary)
    // 인자로 호출된다 — 컴포저가 손에 쥔 두 위임 산출을 그대로 넘긴다.
    it("정상 입력에서 컴포저 self-wire 가 마지막 호출로 (descriptor, summary) 인자를 넘긴다", () => {
      const spy = jest.spyOn(
        bodyConsistencyModule,
        "assertRealDataResultIssueDescriptorBodyConsistent",
      );
      const results = [
        makeResult({ difficulty: "easy", contribution: "low", volume: 3 }),
        makeResult({ difficulty: "hard", contribution: "high", volume: 7 }),
      ];
      const run = makeRun();

      const plan = buildRealDataResultReportPlan(results, run);

      // builder self-wire(T-0647) + composer self-wire(T-0648) = 총 2 회.
      expect(spy).toHaveBeenCalledTimes(2);
      // 컴포저 self-wire 는 호출 체인 가장 바깥 → 마지막 호출. (plan.descriptor,
      // plan.summary) 정확 인자.
      expect(spy).toHaveBeenLastCalledWith(plan.descriptor, plan.summary);
    });

    // happy-path — 정상 results(섞임, totalVolume>0) + 정상 run → self-guard 통과해
    // 정상 { summary, descriptor } 반환(throw 0).
    it("정상 results + 정상 run 에서 self-guard 통과해 정상 plan 을 반환한다(throw 0)", () => {
      const results = [
        makeResult({ difficulty: "easy", contribution: "low", volume: 2 }),
        makeResult({ difficulty: "medium", contribution: "medium", volume: 4 }),
        makeResult({ difficulty: "hard", contribution: "high", volume: 8 }),
      ];

      expect(() =>
        buildRealDataResultReportPlan(results, makeRun()),
      ).not.toThrow();
    });

    // happy-path 분기 — count=0·volume=0·전 슬롯 0 빈 results 도 self-guard 통과.
    it("빈 results(count 0·volume 0) + 정상 run 도 self-guard 통과해 정상 plan 을 반환한다", () => {
      expect(() => buildRealDataResultReportPlan([], makeRun())).not.toThrow();
    });

    // branch — 큰 수·다양한 분포 results 도 self-guard 통과.
    it("다수 result·다양한 분포도 self-guard 통과해 정상 plan 을 반환한다", () => {
      const results = Array.from({ length: 12 }, (_, i) =>
        makeResult({
          difficulty: i % 3 === 0 ? "easy" : i % 3 === 1 ? "medium" : "hard",
          contribution: i % 2 === 0 ? "low" : "high",
          volume: i + 1,
        }),
      );

      expect(() =>
        buildRealDataResultReportPlan(results, makeRun()),
      ).not.toThrow();
    });

    // error 분기 ① — 빈/공백 gitSha 는 descriptor 단계의 식별자 guard 에서 throw 하고
    // body-consistency self-guard 에 도달하지 않는다(self-wire 가 기존 run guard
    // 우선순위를 깨지 않음).
    it("빈 gitSha 는 self-guard 도달 전 descriptor 단계에서 throw 하고 가드를 호출하지 않는다", () => {
      const spy = jest.spyOn(
        bodyConsistencyModule,
        "assertRealDataResultIssueDescriptorBodyConsistent",
      );

      expect(() =>
        buildRealDataResultReportPlan([makeResult()], makeRun({ gitSha: "" })),
      ).toThrow(/gitSha 가 비어있습니다/);
      // descriptor 단계 run guard 가 먼저 throw → body-consistency 가드 미도달.
      expect(spy).not.toHaveBeenCalled();
    });

    // error 분기 ② — 공백-only dateToken 도 descriptor 단계에서 throw.
    it("공백-only dateToken 은 self-guard 도달 전 descriptor 단계에서 throw 한다", () => {
      const spy = jest.spyOn(
        bodyConsistencyModule,
        "assertRealDataResultIssueDescriptorBodyConsistent",
      );

      expect(() =>
        buildRealDataResultReportPlan(
          [makeResult()],
          makeRun({ dateToken: "   " }),
        ),
      ).toThrow(/dateToken 가 비어있습니다/);
      expect(spy).not.toHaveBeenCalled();
    });

    // negative ② — 결정성: 동일 (results, run) 2 회 호출 → 둘 다 동일 plan(self-wire
    // 후에도 결정성 보존).
    it("self-wire 후에도 동일 입력에 대해 byte-identical plan 을 반환한다", () => {
      const results = [
        makeResult({ difficulty: "easy", contribution: "low", volume: 3 }),
        makeResult({ difficulty: "hard", contribution: "high", volume: 7 }),
      ];
      const run = makeRun();

      const a = buildRealDataResultReportPlan(results, run);
      const b = buildRealDataResultReportPlan(results, run);

      expect(a.summary).toEqual(b.summary);
      expect(a.descriptor.title).toBe(b.descriptor.title);
      expect(a.descriptor.marker).toBe(b.descriptor.marker);
      expect(a.descriptor.body).toBe(b.descriptor.body);
    });

    // negative ③ — 입력 비변형: 호출 후 results 배열·각 EvaluationResult·run 객체
    // 변경 0(self-wire 가 입력을 mutate 하지 않음).
    it("self-wire 후에도 입력 results 와 run 을 mutate 하지 않는다", () => {
      const result = makeResult();
      const results = [result];
      const resultBefore = { ...result };
      const lengthBefore = results.length;
      const run = makeRun();
      const runBefore = { ...run };

      buildRealDataResultReportPlan(results, run);

      expect(results).toHaveLength(lengthBefore);
      expect(results[0]).toEqual(resultBefore);
      expect(run).toEqual(runBefore);
    });

    // negative ④ — byte-identical 회귀 0: self-wire 추가가 summary·descriptor byte 를
    // 바꾸지 않음(정상 입력) — 위임 단독 산출과 deep-equal·byte-identical.
    it("self-wire 추가가 summary·descriptor byte 를 바꾸지 않는다(회귀 0)", () => {
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
      expect(plan.descriptor.title).toBe(expectedDescriptor.title);
      expect(plan.descriptor.marker).toBe(expectedDescriptor.marker);
      expect(plan.descriptor.body).toBe(expectedDescriptor.body);
    });

    // negative ⑤ — 무공유: 반환 plan 의 summary/descriptor 를 mutate 해도 입력·다음
    // 호출 결과에 누설되지 않음.
    it("반환 plan 의 mutate 가 입력·다음 호출 결과에 누설되지 않는다", () => {
      const results = [makeResult()];
      const run = makeRun();

      const first = buildRealDataResultReportPlan(results, run);
      // 반환 plan 의 summary 분포를 임의 변형.
      first.summary.byDifficulty.easy = 999;
      first.summary.count = -1;

      const second = buildRealDataResultReportPlan(results, run);

      // 다음 호출은 오염되지 않은 새 트리를 반환.
      expect(second.summary.byDifficulty.easy).not.toBe(999);
      expect(second.summary.count).not.toBe(-1);
      // 입력 results 도 무관(원소 mutate 0).
      expect(results[0].volume).toBe(makeResult().volume);
    });

    // negative ⑥ — R-59: self-wire 후에도 descriptor.body 가 raw narrative 키/본문을
    // 담지 않음(가드는 count·volume·분포·markdown 카운트만 비교, raw 미접촉).
    it("self-wire 후에도 descriptor.body 가 raw narrative 키를 담지 않는다(R-59)", () => {
      const results = [
        makeResult({ narrative: "raw 본문 #SECRET 가 새면 안 됨" }),
      ];

      const plan = buildRealDataResultReportPlan(results, makeRun());

      expect(plan.descriptor.body).not.toContain("#SECRET");
      expect(plan.descriptor.body).not.toContain("narrative");
      expect(plan.descriptor.body).not.toContain("unitId");
    });
  });
});
