// realdata-e2e-daily-step-dual-leg-run-report.spec.ts — T-0894 colocated unit spec.
//
// R-112 cover 구조 (단일 outcome-report 컴포저 spec(T-0590)와 command-plan spec(T-0887)
// mirror — 두 leg run outcome 을 하나의 report 로 묶는 순수 컴포저를 cover):
//   - happy-path: eval run+pass & collect run+pass → overallStatus "all-pass", per-leg
//     status 정확, summaryLine 이 gitSha/dateToken/두 leg status 포함 + byte-identical.
//   - error path: 각 guard 별도 분기 throw(gitSha/dateToken 공백, leg mislabel, run 인데
//     passed undefined, skip 인데 passed 정의).
//   - flow/branch: overallStatus 4 분기 + per-leg status 3 분기 각 1+.
//   - negative 충분 cover(단일 negative 금지): all-skip / some-fail(혼합) / partial(혼합) /
//     credential echo 0 / 결정론·무공유 / 입력 mutate 0.
import {
  buildRealDataDailyStepDualLegRunReport,
  RealDataDailyStepLegRunOutcome,
} from "./realdata-e2e-daily-step-dual-leg-run-report";
import type { RealDataResultIssueRunRef } from "./realdata-e2e-result-issue-descriptor";

// 표준 run 식별자 fixture.
const RUN: RealDataResultIssueRunRef = {
  gitSha: "a1b2c3d",
  dateToken: "2026-07-11",
};

// leg outcome fixture 헬퍼(인라인 구성 — 새 공용 mock helper 추출 불요).
function evalOutcome(
  overrides: Partial<RealDataDailyStepLegRunOutcome> = {},
): RealDataDailyStepLegRunOutcome {
  return { leg: "eval", action: "run", passed: true, ...overrides };
}

function collectOutcome(
  overrides: Partial<RealDataDailyStepLegRunOutcome> = {},
): RealDataDailyStepLegRunOutcome {
  return { leg: "collect", action: "run", passed: true, ...overrides };
}

describe("buildRealDataDailyStepDualLegRunReport", () => {
  describe("happy-path (eval run+pass & collect run+pass → all-pass)", () => {
    it('두 leg 모두 run+pass → overallStatus="all-pass" + per-leg status="pass"', () => {
      const report = buildRealDataDailyStepDualLegRunReport(
        evalOutcome(),
        collectOutcome(),
        RUN,
      );
      expect(report.overallStatus).toBe("all-pass");
      expect(report.eval).toEqual({ action: "run", status: "pass" });
      expect(report.collect).toEqual({ action: "run", status: "pass" });
    });

    it("run 식별자(gitSha/dateToken)를 report 로 전파한다", () => {
      const report = buildRealDataDailyStepDualLegRunReport(
        evalOutcome(),
        collectOutcome(),
        RUN,
      );
      expect(report.gitSha).toBe("a1b2c3d");
      expect(report.dateToken).toBe("2026-07-11");
    });

    it("summaryLine 이 gitSha/dateToken/두 leg status/overallStatus 를 포함한다", () => {
      const report = buildRealDataDailyStepDualLegRunReport(
        evalOutcome(),
        collectOutcome(),
        RUN,
      );
      expect(report.summaryLine).toContain("a1b2c3d");
      expect(report.summaryLine).toContain("2026-07-11");
      expect(report.summaryLine).toContain("eval=pass");
      expect(report.summaryLine).toContain("collect=pass");
      expect(report.summaryLine).toContain("all-pass");
    });

    it("동일 입력 재호출 시 summaryLine 이 byte-identical", () => {
      const a = buildRealDataDailyStepDualLegRunReport(
        evalOutcome(),
        collectOutcome(),
        RUN,
      );
      const b = buildRealDataDailyStepDualLegRunReport(
        evalOutcome(),
        collectOutcome(),
        RUN,
      );
      expect(a.summaryLine).toBe(b.summaryLine);
    });
  });

  describe("error path (각 guard 별도 분기 throw)", () => {
    it("(1) run.gitSha 공백-only → throw", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReport(
          evalOutcome(),
          collectOutcome(),
          {
            gitSha: "   ",
            dateToken: "2026-07-11",
          },
        ),
      ).toThrow(/gitSha/);
    });

    it("(1b) run.gitSha 빈 문자열 → throw", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReport(
          evalOutcome(),
          collectOutcome(),
          {
            gitSha: "",
            dateToken: "2026-07-11",
          },
        ),
      ).toThrow();
    });

    it("(2) run.dateToken 공백-only → throw", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReport(
          evalOutcome(),
          collectOutcome(),
          {
            gitSha: "a1b2c3d",
            dateToken: "  ",
          },
        ),
      ).toThrow(/dateToken/);
    });

    it('(3a) evalOutcome.leg !== "eval"(collect 라벨 mislabel) → throw', () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReport(
          evalOutcome({ leg: "collect" }),
          collectOutcome(),
          RUN,
        ),
      ).toThrow(/leg 라벨 불일치/);
    });

    it('(3b) collectOutcome.leg !== "collect"(eval 라벨 mislabel) → throw', () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReport(
          evalOutcome(),
          collectOutcome({ leg: "eval" }),
          RUN,
        ),
      ).toThrow(/leg 라벨 불일치/);
    });

    it('(4) action="run" 인데 passed=undefined(불완전 run outcome) → throw', () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReport(
          evalOutcome({ passed: undefined }),
          collectOutcome(),
          RUN,
        ),
      ).toThrow(/불완전 run outcome/);
    });

    it('(5) action="skip" 인데 passed 정의됨(모순 outcome) → throw', () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReport(
          evalOutcome(),
          collectOutcome({ action: "skip", passed: true }),
          RUN,
        ),
      ).toThrow(/모순 outcome/);
    });
  });

  describe("flow / branch cover — overallStatus 4 분기 + per-leg status 3 분기", () => {
    it('overallStatus "all-pass" 분기 (두 leg pass)', () => {
      const report = buildRealDataDailyStepDualLegRunReport(
        evalOutcome({ passed: true }),
        collectOutcome({ passed: true }),
        RUN,
      );
      expect(report.overallStatus).toBe("all-pass");
    });

    it('overallStatus "some-fail" 분기 (하나라도 fail)', () => {
      const report = buildRealDataDailyStepDualLegRunReport(
        evalOutcome({ passed: false }),
        collectOutcome({ passed: true }),
        RUN,
      );
      expect(report.overallStatus).toBe("some-fail");
    });

    it('overallStatus "all-skip" 분기 (두 leg skip)', () => {
      const report = buildRealDataDailyStepDualLegRunReport(
        evalOutcome({ action: "skip", passed: undefined }),
        collectOutcome({ action: "skip", passed: undefined }),
        RUN,
      );
      expect(report.overallStatus).toBe("all-skip");
    });

    it('overallStatus "partial" 분기 (pass/skip 혼합, fail 없음)', () => {
      const report = buildRealDataDailyStepDualLegRunReport(
        evalOutcome({ passed: true }),
        collectOutcome({ action: "skip", passed: undefined }),
        RUN,
      );
      expect(report.overallStatus).toBe("partial");
    });

    it('per-leg status "pass"(run+passed=true)', () => {
      const report = buildRealDataDailyStepDualLegRunReport(
        evalOutcome({ passed: true }),
        collectOutcome({ passed: true }),
        RUN,
      );
      expect(report.eval.status).toBe("pass");
    });

    it('per-leg status "fail"(run+passed=false)', () => {
      const report = buildRealDataDailyStepDualLegRunReport(
        evalOutcome({ passed: false }),
        collectOutcome({ passed: false }),
        RUN,
      );
      expect(report.eval.status).toBe("fail");
      expect(report.collect.status).toBe("fail");
    });

    it('per-leg status "skip"(action=skip)', () => {
      const report = buildRealDataDailyStepDualLegRunReport(
        evalOutcome({ action: "skip", passed: undefined }),
        collectOutcome({ action: "skip", passed: undefined }),
        RUN,
      );
      expect(report.eval.status).toBe("skip");
      expect(report.collect.status).toBe("skip");
    });

    it("some-fail 은 다른 leg 가 skip 이어도 fail 최우선으로 판정", () => {
      const report = buildRealDataDailyStepDualLegRunReport(
        evalOutcome({ passed: false }),
        collectOutcome({ action: "skip", passed: undefined }),
        RUN,
      );
      expect(report.overallStatus).toBe("some-fail");
    });
  });

  describe("negative cases 충분 cover", () => {
    // (a) 두 leg 모두 skip → all-skip.
    it("(a) 두 leg 모두 skip → overallStatus=all-skip + summaryLine 반영", () => {
      const report = buildRealDataDailyStepDualLegRunReport(
        evalOutcome({ action: "skip", passed: undefined }),
        collectOutcome({ action: "skip", passed: undefined }),
        RUN,
      );
      expect(report.overallStatus).toBe("all-skip");
      expect(report.summaryLine).toContain("eval=skip");
      expect(report.summaryLine).toContain("collect=skip");
    });

    // (b) eval run+fail & collect run+pass(혼합 실패) → some-fail.
    it("(b) eval run+fail & collect run+pass → some-fail", () => {
      const report = buildRealDataDailyStepDualLegRunReport(
        evalOutcome({ passed: false }),
        collectOutcome({ passed: true }),
        RUN,
      );
      expect(report.overallStatus).toBe("some-fail");
      expect(report.eval.status).toBe("fail");
      expect(report.collect.status).toBe("pass");
    });

    // (c) eval run+pass & collect skip(혼합) → partial.
    it("(c) eval run+pass & collect skip → partial", () => {
      const report = buildRealDataDailyStepDualLegRunReport(
        evalOutcome({ passed: true }),
        collectOutcome({ action: "skip", passed: undefined }),
        RUN,
      );
      expect(report.overallStatus).toBe("partial");
      expect(report.eval.status).toBe("pass");
      expect(report.collect.status).toBe("skip");
    });

    // (d) credential echo 0 — token-like placeholder 를 specPath 에 심어도 report/
    // summaryLine 어디에도 등장하지 않음(report 는 leg status·run 식별자만 보유).
    it("(d) 입력 specPath 의 token-like placeholder 가 report/summaryLine 에 새어나오지 않는다", () => {
      const SECRET = "sk-SECRET-leak-canary-9f8e7d";
      const report = buildRealDataDailyStepDualLegRunReport(
        evalOutcome({ specPath: `test/smoke/${SECRET}.smoke-spec.ts` }),
        collectOutcome({ specPath: `test/smoke/${SECRET}.smoke-spec.ts` }),
        RUN,
      );
      const blob = JSON.stringify(report);
      expect(blob).not.toContain(SECRET);
      expect(report.summaryLine).not.toContain(SECRET);
      // report 는 specPath 를 전파하지 않는다(leg status·run 식별자만).
      expect(blob).not.toContain("specPath");
    });

    // (e) 결정론·무공유 — 동일 입력 두 번 deep-equal + 매 호출 새 report 객체(참조 비동일).
    it("(e) 동일 입력 두 번 호출 → deep-equal + 새 report 객체(참조 비동일)", () => {
      const a = buildRealDataDailyStepDualLegRunReport(
        evalOutcome(),
        collectOutcome(),
        RUN,
      );
      const b = buildRealDataDailyStepDualLegRunReport(
        evalOutcome(),
        collectOutcome(),
        RUN,
      );
      expect(a).toEqual(b);
      expect(a).not.toBe(b);
      // 중첩 leg 객체도 참조 분리.
      expect(a.eval).not.toBe(b.eval);
      expect(a.collect).not.toBe(b.collect);
    });

    // (f) 입력 mutate 0 — evalOutcome/collectOutcome/run 이 호출 전후 deep-equal(읽기만).
    it("(f) 입력 outcome/run 객체를 mutate 하지 않는다(호출 전후 deep-equal)", () => {
      const ev = evalOutcome();
      const co = collectOutcome();
      const run: RealDataResultIssueRunRef = {
        gitSha: "a1b2c3d",
        dateToken: "2026-07-11",
      };
      const evSnapshot = JSON.parse(JSON.stringify(ev));
      const coSnapshot = JSON.parse(JSON.stringify(co));
      const runSnapshot = JSON.parse(JSON.stringify(run));

      buildRealDataDailyStepDualLegRunReport(ev, co, run);

      expect(ev).toEqual(evSnapshot);
      expect(co).toEqual(coSnapshot);
      expect(run).toEqual(runSnapshot);
    });
  });
});
