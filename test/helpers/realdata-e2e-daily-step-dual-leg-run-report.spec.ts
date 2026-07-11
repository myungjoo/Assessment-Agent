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
//
// self-wire(T-0911) cover 구조: 값-정합 가드 종단 컴포저 self-wire — happy 무회귀(byte-
// identical) + 가드 호출 배선(1회·(report, evalOutcome, collectOutcome, run) 인자·동일 참조)
// + throw 선전파(RangeError/TypeError) + 기존 컴포저 throw 는 가드 도달 전 발생(가드 미호출)
// + 결정성·무공유 유지.
import {
  buildRealDataDailyStepDualLegRunReport,
  RealDataDailyStepLegRunOutcome,
} from "./realdata-e2e-daily-step-dual-leg-run-report";
// self-wire(T-0911) 검증용 namespace import — 컴포저가 top-level value import 로 같은 모듈을
// 가져오므로(가드가 컴포저를 type-only import 만 함 → 순환 0) spec 의 spy 와 컴포저의 호출이
// 동일 모듈 캐시 객체를 가리킨다 — spyOn 이 컴포저의 가드 호출을 가로챈다.
import * as dualLegRunReportConsistencyModule from "./realdata-e2e-daily-step-dual-leg-run-report-consistency";
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

    // (b2) 대칭 collect-only 실패 — eval run+pass & collect run+fail → some-fail.
    // deriveOverallStatus 의 `evalStatus === "fail" || collectStatus === "fail"`
    // 에서 (b)/기존 some-fail 케이스는 모두 좌변(eval fail)이 trigger 였다.
    // 본 케이스는 eval NOT fail(pass) + collect fail 로 우변(collectStatus==="fail")
    // 단독 trigger 를 직접 assert — R-112 negative 대칭 cover.
    it("(b2) eval run+pass & collect run+fail → some-fail (collect-only 실패 대칭)", () => {
      const report = buildRealDataDailyStepDualLegRunReport(
        evalOutcome({ passed: true }),
        collectOutcome({ passed: false }),
        RUN,
      );
      expect(report.overallStatus).toBe("some-fail");
      expect(report.eval.status).toBe("pass");
      expect(report.collect.status).toBe("fail");
    });

    // (b3) eval skip & collect run+fail → some-fail (eval NOT fail=skip + collect fail).
    it("(b3) eval skip & collect run+fail → some-fail (collect-only 실패, eval skip)", () => {
      const report = buildRealDataDailyStepDualLegRunReport(
        evalOutcome({ action: "skip", passed: undefined }),
        collectOutcome({ passed: false }),
        RUN,
      );
      expect(report.overallStatus).toBe("some-fail");
      expect(report.eval.status).toBe("skip");
      expect(report.collect.status).toBe("fail");
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

  // ── self-wire(T-0911) — 값-정합 가드 종단 컴포저 단일 return 배선 ────────────────
  // 컴포저가 top-level value import 로 consistency 모듈을 가져오므로(가드는 컴포저를
  // type-only import 만 함 → 순환 0) 아래 spyOn 이 컴포저의 가드 호출을 가로챈다. 본 가드는
  // report + evalOutcome + collectOutcome + run 네 인자를 받고 넷 다 단일 return 사이트에서
  // 가용하므로 컴포저 단일 호출 안에서 self-wire 된다(summary 축 T-0726·dual-leg output 축
  // T-0907·search 축 T-0909 mirror — 본 task 는 인자가 4 개인 점만 다르다).
  describe("T-0911 — 값-정합 가드 종단 컴포저 self-wire(산출 6필드↔입력 deep-equal)", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("① 정상 호출에서 값-정합 가드를 throw 0 으로 통과해 산출이 self-wire 전과 byte-identical 하다(happy·무회귀)", () => {
      const report = buildRealDataDailyStepDualLegRunReport(
        evalOutcome(),
        collectOutcome(),
        RUN,
      );

      // self-wire 후에도 6 필드 값·shape 무회귀(byte-identical).
      expect(report).toEqual({
        gitSha: "a1b2c3d",
        dateToken: "2026-07-11",
        eval: { action: "run", status: "pass" },
        collect: { action: "run", status: "pass" },
        overallStatus: "all-pass",
        summaryLine: "[2026-07-11@a1b2c3d] eval=pass collect=pass → all-pass",
      });
    });

    it("② 값-정합 가드 호출 배선 — 정확히 1회·(반환될 report 와 동일 참조, evalOutcome, collectOutcome, run) 인자로 호출(인자 순서 검증)", () => {
      const spy = jest.spyOn(
        dualLegRunReportConsistencyModule,
        "assertRealDataDailyStepDualLegRunReportConsistentWithInput",
      );
      const ev = evalOutcome();
      const co = collectOutcome();

      const report = buildRealDataDailyStepDualLegRunReport(ev, co, RUN);

      expect(spy).toHaveBeenCalledTimes(1);
      // 인자 순서 (report, evalOutcome, collectOutcome, run) 준수 — 첫 인자는 반환 report 와
      // 동일 참조, 나머지 셋은 각 입력과 동일 참조.
      expect(spy).toHaveBeenCalledWith(report, ev, co, RUN);
      expect(spy.mock.calls[0][0]).toBe(report);
      expect(spy.mock.calls[0][1]).toBe(ev);
      expect(spy.mock.calls[0][2]).toBe(co);
      expect(spy.mock.calls[0][3]).toBe(RUN);
    });

    it("③ 매 호출마다 가드가 1회씩 호출된다 — 두 번 호출 시 누적 2회(호출별 self-assert 발동, 결정론)", () => {
      const spy = jest.spyOn(
        dualLegRunReportConsistencyModule,
        "assertRealDataDailyStepDualLegRunReportConsistentWithInput",
      );

      buildRealDataDailyStepDualLegRunReport(
        evalOutcome(),
        collectOutcome(),
        RUN,
      );
      buildRealDataDailyStepDualLegRunReport(
        evalOutcome(),
        collectOutcome(),
        RUN,
      );

      expect(spy).toHaveBeenCalledTimes(2);
    });

    it("④ all-skip 산출이어도 값-정합 가드를 1회 호출한다(전체-산출 단일 호출)", () => {
      const spy = jest.spyOn(
        dualLegRunReportConsistencyModule,
        "assertRealDataDailyStepDualLegRunReportConsistentWithInput",
      );

      const report = buildRealDataDailyStepDualLegRunReport(
        evalOutcome({ action: "skip", passed: undefined }),
        collectOutcome({ action: "skip", passed: undefined }),
        RUN,
      );

      expect(report.overallStatus).toBe("all-skip");
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toBe(report);
    });

    it("⑤ 값-정합 가드 RangeError(값 정합 위반) throw 전파 — 가드가 throw 하면 컴포저가 삼키지 않고 선전파(negative)", () => {
      const sentinel = new RangeError("값 정합 위반(테스트 주입)");
      jest
        .spyOn(
          dualLegRunReportConsistencyModule,
          "assertRealDataDailyStepDualLegRunReportConsistentWithInput",
        )
        .mockImplementation(() => {
          throw sentinel;
        });

      expect(() =>
        buildRealDataDailyStepDualLegRunReport(
          evalOutcome(),
          collectOutcome(),
          RUN,
        ),
      ).toThrow(sentinel);
    });

    it("⑥ 값-정합 가드 TypeError(구조 결손 모사) throw 도 컴포저가 선전파한다(에러 종류 무관 전파, negative)", () => {
      jest
        .spyOn(
          dualLegRunReportConsistencyModule,
          "assertRealDataDailyStepDualLegRunReportConsistentWithInput",
        )
        .mockImplementation(() => {
          throw new TypeError("구조 결손 모사");
        });

      expect(() =>
        buildRealDataDailyStepDualLegRunReport(
          evalOutcome(),
          collectOutcome(),
          RUN,
        ),
      ).toThrow("구조 결손 모사");
    });

    it("⑦ 기존 컴포저 throw(run.gitSha 공백)는 가드 도달 전 발생해 값-정합 가드를 거치지 않는다(self-wire 가 fail-fast 를 가리지 않음, negative)", () => {
      const spy = jest.spyOn(
        dualLegRunReportConsistencyModule,
        "assertRealDataDailyStepDualLegRunReportConsistentWithInput",
      );

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
      // run 식별자 guard 단계에서 throw 했으므로 단일 return 직전 self-assert 는 도달하지 않는다.
      expect(spy).not.toHaveBeenCalled();
    });

    it("⑧ 기존 컴포저 throw(leg 라벨 mislabel)도 가드 도달 전 발생한다(가드 미호출, negative)", () => {
      const spy = jest.spyOn(
        dualLegRunReportConsistencyModule,
        "assertRealDataDailyStepDualLegRunReportConsistentWithInput",
      );

      expect(() =>
        buildRealDataDailyStepDualLegRunReport(
          evalOutcome({ leg: "collect" }),
          collectOutcome(),
          RUN,
        ),
      ).toThrow(/leg 라벨 불일치/);
      expect(spy).not.toHaveBeenCalled();
    });

    it('⑨ 기존 컴포저 throw(action="run" 인데 passed=undefined)도 가드 도달 전 발생한다(가드 미호출, negative)', () => {
      const spy = jest.spyOn(
        dualLegRunReportConsistencyModule,
        "assertRealDataDailyStepDualLegRunReportConsistentWithInput",
      );

      expect(() =>
        buildRealDataDailyStepDualLegRunReport(
          evalOutcome({ passed: undefined }),
          collectOutcome(),
          RUN,
        ),
      ).toThrow(/불완전 run outcome/);
      expect(spy).not.toHaveBeenCalled();
    });

    it("⑩ self-wire 는 입력 outcome/run 을 변형하지 않는다(순수성 — 호출 전후 deep-equal)", () => {
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

    it("⑪ self-wire 후에도 동일 입력 두 번 호출 산출이 deep-equal·참조-무공유 유지(결정성·무공유, negative — mutation 격리)", () => {
      const first = buildRealDataDailyStepDualLegRunReport(
        evalOutcome(),
        collectOutcome(),
        RUN,
      );
      const second = buildRealDataDailyStepDualLegRunReport(
        evalOutcome(),
        collectOutcome(),
        RUN,
      );

      expect(first).toEqual(second);
      // 매 호출 새 report·새 leg 객체(참조-무공유) — self-wire 가 무공유를 깨지 않음.
      expect(first).not.toBe(second);
      expect(first.eval).not.toBe(second.eval);
      expect(first.collect).not.toBe(second.collect);
    });
  });
});
