// realdata-e2e-daily-step-dual-leg-run-report-consistency.spec.ts —
// T-0910 colocated unit spec for
// `assertRealDataDailyStepDualLegRunReportConsistentWithInput`.
//
// R-112 cover: happy(정합 산출→void — all-pass·some-fail·all-skip·partial 4 overallStatus
// 각 대표 조합) · 구조 결손(report/evalOutcome/collectOutcome/run 비-non-null-객체·배열·
// report 6 필드 type 위반·run.gitSha/dateToken 빈/공백·leg 라벨 오류(cross-wiring)·
// action="run"+passed=undefined·action="skip"+passed 정의 → TypeError) · 값 정합 위반
// (gitSha·dateToken·eval.action·eval.status·collect.action·collect.status·overallStatus·
// summaryLine 각 필드 drift·추가필드 누설 → RangeError) · REQ-059(raw/credential/specPath
// 미노출) · 결정성·비변형(report/입력 mutate 0). 컴포저
// `buildRealDataDailyStepDualLegRunReport` 로 정상 산출을 만들되, 손상 fixture 는 산출
// 또는 입력 한쪽만 변조해 만든다.
import {
  buildRealDataDailyStepDualLegRunReport,
  type RealDataDailyStepLegRunOutcome,
  type RealDataDailyStepDualLegRunReport,
} from "./realdata-e2e-daily-step-dual-leg-run-report";
import { assertRealDataDailyStepDualLegRunReportConsistentWithInput } from "./realdata-e2e-daily-step-dual-leg-run-report-consistency";
import type { RealDataResultIssueRunRef } from "./realdata-e2e-result-issue-descriptor";

// 공통 run 식별자 fixture.
const RUN: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-07-11",
};

// leg outcome 조립 헬퍼(fixture 인라인 구성 — 새 공용 mock helper 추출 불요).
function evalOutcome(
  action: "run" | "skip",
  passed?: boolean,
): RealDataDailyStepLegRunOutcome {
  return passed === undefined
    ? { leg: "eval", action }
    : { leg: "eval", action, passed };
}
function collectOutcome(
  action: "run" | "skip",
  passed?: boolean,
): RealDataDailyStepLegRunOutcome {
  return passed === undefined
    ? { leg: "collect", action }
    : { leg: "collect", action, passed };
}

describe("assertRealDataDailyStepDualLegRunReportConsistentWithInput", () => {
  describe("happy-path (정합 산출↔입력 → void, overallStatus 4 값 각 대표)", () => {
    it("all-pass — 둘 다 run+passed=true → throw 0(void)", () => {
      const ev = evalOutcome("run", true);
      const co = collectOutcome("run", true);
      const report = buildRealDataDailyStepDualLegRunReport(ev, co, RUN);
      expect(report.overallStatus).toBe("all-pass");
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          report,
          ev,
          co,
          RUN,
        ),
      ).not.toThrow();
    });

    it("some-fail — eval run+passed=false → void(undefined 반환)", () => {
      const ev = evalOutcome("run", false);
      const co = collectOutcome("run", true);
      const report = buildRealDataDailyStepDualLegRunReport(ev, co, RUN);
      expect(report.overallStatus).toBe("some-fail");
      expect(
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          report,
          ev,
          co,
          RUN,
        ),
      ).toBeUndefined();
    });

    it("all-skip — 둘 다 skip → throw 0(void)", () => {
      const ev = evalOutcome("skip");
      const co = collectOutcome("skip");
      const report = buildRealDataDailyStepDualLegRunReport(ev, co, RUN);
      expect(report.overallStatus).toBe("all-skip");
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          report,
          ev,
          co,
          RUN,
        ),
      ).not.toThrow();
    });

    it("partial — eval pass + collect skip(혼합) → throw 0(void)", () => {
      const ev = evalOutcome("run", true);
      const co = collectOutcome("skip");
      const report = buildRealDataDailyStepDualLegRunReport(ev, co, RUN);
      expect(report.overallStatus).toBe("partial");
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          report,
          ev,
          co,
          RUN,
        ),
      ).not.toThrow();
    });
  });

  describe("구조 결손 — report 측 → TypeError", () => {
    const ev = evalOutcome("run", true);
    const co = collectOutcome("run", true);

    it("report null → TypeError", () => {
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          null as unknown as RealDataDailyStepDualLegRunReport,
          ev,
          co,
          RUN,
        ),
      ).toThrow(/report 가 non-null 객체가 아니다/);
    });

    it("report 숫자 → TypeError", () => {
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          7 as unknown as RealDataDailyStepDualLegRunReport,
          ev,
          co,
          RUN,
        ),
      ).toThrow(TypeError);
    });

    it("report 배열 → TypeError", () => {
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          [] as unknown as RealDataDailyStepDualLegRunReport,
          ev,
          co,
          RUN,
        ),
      ).toThrow(/배열이다/);
    });

    it("report.gitSha 비-string(type 위반) → TypeError", () => {
      const report = buildRealDataDailyStepDualLegRunReport(ev, co, RUN);
      const broken = {
        ...report,
        gitSha: 123,
      } as unknown as RealDataDailyStepDualLegRunReport;
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          broken,
          ev,
          co,
          RUN,
        ),
      ).toThrow(/report\.gitSha 가 문자열이 아니다/);
    });

    it("report.eval 비객체(type 위반) → TypeError", () => {
      const report = buildRealDataDailyStepDualLegRunReport(ev, co, RUN);
      const broken = {
        ...report,
        eval: "pass",
      } as unknown as RealDataDailyStepDualLegRunReport;
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          broken,
          ev,
          co,
          RUN,
        ),
      ).toThrow(/report\.eval 이 non-null 객체가 아니다/);
    });

    it("report.collect.status 비-string(중첩 type 위반) → TypeError", () => {
      const report = buildRealDataDailyStepDualLegRunReport(ev, co, RUN);
      const broken = {
        ...report,
        collect: { action: "run", status: 1 },
      } as unknown as RealDataDailyStepDualLegRunReport;
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          broken,
          ev,
          co,
          RUN,
        ),
      ).toThrow(/report\.collect\.status 가 문자열이 아니다/);
    });
  });

  describe("구조 결손 — 입력(evalOutcome/collectOutcome/run) 측 → TypeError", () => {
    const ev = evalOutcome("run", true);
    const co = collectOutcome("run", true);
    const report = buildRealDataDailyStepDualLegRunReport(ev, co, RUN);

    it("run null → TypeError", () => {
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          report,
          ev,
          co,
          null as unknown as RealDataResultIssueRunRef,
        ),
      ).toThrow(/run 이 non-null 객체가 아니다/);
    });

    it("run.gitSha 빈 문자열 → TypeError", () => {
      const badRun = { gitSha: "", dateToken: "2026-07-11" };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          report,
          ev,
          co,
          badRun,
        ),
      ).toThrow(/run\.gitSha 가 비어있다/);
    });

    it("run.dateToken 공백-only → TypeError", () => {
      const badRun = { gitSha: "abc1234", dateToken: "   " };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          report,
          ev,
          co,
          badRun,
        ),
      ).toThrow(/run\.dateToken 가 비어있다/);
    });

    it("evalOutcome 비객체(숫자) → TypeError", () => {
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          report,
          7 as unknown as RealDataDailyStepLegRunOutcome,
          co,
          RUN,
        ),
      ).toThrow(/evalOutcome 이 non-null 객체가 아니다/);
    });

    it("eval 자리에 collect 라벨(cross-wiring) → TypeError", () => {
      const crossed = {
        leg: "collect",
        action: "run",
        passed: true,
      } as unknown as RealDataDailyStepLegRunOutcome;
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          report,
          crossed,
          co,
          RUN,
        ),
      ).toThrow(/leg 라벨 불일치/);
    });

    it("action 이 run|skip 아님 → TypeError", () => {
      const bad = {
        leg: "eval",
        action: "halt",
      } as unknown as RealDataDailyStepLegRunOutcome;
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          report,
          bad,
          co,
          RUN,
        ),
      ).toThrow(/action 이 "run"\|"skip" 이 아니다/);
    });

    it('action="run" 인데 passed=undefined → TypeError', () => {
      const incomplete = {
        leg: "eval",
        action: "run",
      } as unknown as RealDataDailyStepLegRunOutcome;
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          report,
          incomplete,
          co,
          RUN,
        ),
      ).toThrow(/불완전 run outcome/);
    });

    it('action="run" 인데 passed 비-boolean → TypeError', () => {
      const bad = {
        leg: "eval",
        action: "run",
        passed: "yes",
      } as unknown as RealDataDailyStepLegRunOutcome;
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          report,
          bad,
          co,
          RUN,
        ),
      ).toThrow(/passed 가 boolean 이 아니다/);
    });

    it('action="skip" 인데 passed 정의(모순) → TypeError', () => {
      const contradictory = {
        leg: "collect",
        action: "skip",
        passed: true,
      } as unknown as RealDataDailyStepLegRunOutcome;
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          report,
          ev,
          contradictory,
          RUN,
        ),
      ).toThrow(/모순 outcome/);
    });
  });

  describe("값 정합 위반 — 산출↔입력 drift → RangeError", () => {
    const ev = evalOutcome("run", true);
    const co = collectOutcome("run", false);

    it("gitSha 전파 drift → RangeError(기대 vs 실측 노출)", () => {
      const report = buildRealDataDailyStepDualLegRunReport(ev, co, RUN);
      const drifted = { ...report, gitSha: "deadbee" };
      const runIt = () =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          drifted,
          ev,
          co,
          RUN,
        );
      expect(runIt).toThrow(RangeError);
      expect(runIt).toThrow(/기대=.*실측=/s);
    });

    it("dateToken 전파 drift → RangeError", () => {
      const report = buildRealDataDailyStepDualLegRunReport(ev, co, RUN);
      const drifted = { ...report, dateToken: "2099-01-01" };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          drifted,
          ev,
          co,
          RUN,
        ),
      ).toThrow(RangeError);
    });

    it("eval.status 파생 drift(report=fail, 재유도=pass) → RangeError", () => {
      const report = buildRealDataDailyStepDualLegRunReport(ev, co, RUN);
      const drifted = { ...report, eval: { action: "run", status: "fail" } };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          drifted as RealDataDailyStepDualLegRunReport,
          ev,
          co,
          RUN,
        ),
      ).toThrow(RangeError);
    });

    it("eval.action drift(run→skip) → RangeError", () => {
      const report = buildRealDataDailyStepDualLegRunReport(ev, co, RUN);
      const drifted = { ...report, eval: { action: "skip", status: "pass" } };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          drifted as RealDataDailyStepDualLegRunReport,
          ev,
          co,
          RUN,
        ),
      ).toThrow(RangeError);
    });

    it("collect.status 파생 drift → RangeError", () => {
      const report = buildRealDataDailyStepDualLegRunReport(ev, co, RUN);
      const drifted = {
        ...report,
        collect: { action: "run", status: "pass" },
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          drifted as RealDataDailyStepDualLegRunReport,
          ev,
          co,
          RUN,
        ),
      ).toThrow(RangeError);
    });

    it("collect.action drift → RangeError", () => {
      const report = buildRealDataDailyStepDualLegRunReport(ev, co, RUN);
      const drifted = {
        ...report,
        collect: { action: "skip", status: "fail" },
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          drifted as RealDataDailyStepDualLegRunReport,
          ev,
          co,
          RUN,
        ),
      ).toThrow(RangeError);
    });

    it("overallStatus 파생 drift(some-fail→all-pass) → RangeError", () => {
      const report = buildRealDataDailyStepDualLegRunReport(ev, co, RUN);
      const drifted = { ...report, overallStatus: "all-pass" as const };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          drifted,
          ev,
          co,
          RUN,
        ),
      ).toThrow(RangeError);
    });

    it("summaryLine 합성 drift(토큰 순서/구분자 어긋남) → RangeError", () => {
      const report = buildRealDataDailyStepDualLegRunReport(ev, co, RUN);
      const drifted = {
        ...report,
        summaryLine: "eval=fail collect=fail [2026-07-11@abc1234] some-fail",
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          drifted,
          ev,
          co,
          RUN,
        ),
      ).toThrow(RangeError);
    });

    it("추가 필드 누설(최상위 extra 키, 값 동일) → RangeError(추가필드 drop 위반)", () => {
      const report = buildRealDataDailyStepDualLegRunReport(ev, co, RUN);
      const leaked = {
        ...report,
        specPath: "test/e2e/eval.spec.ts",
      } as unknown as RealDataDailyStepDualLegRunReport;
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          leaked,
          ev,
          co,
          RUN,
        ),
      ).toThrow(RangeError);
    });

    it("leg 필드 추가 키 누설(eval 3 키) → RangeError", () => {
      const report = buildRealDataDailyStepDualLegRunReport(ev, co, RUN);
      const leaked = {
        ...report,
        eval: { action: "run", status: "pass", extra: 1 },
      } as unknown as RealDataDailyStepDualLegRunReport;
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          leaked,
          ev,
          co,
          RUN,
        ),
      ).toThrow(RangeError);
    });

    it("입력 측이 산출과 어긋나도 동일 RangeError(양방향 어느 쪽이든 노출)", () => {
      const report = buildRealDataDailyStepDualLegRunReport(ev, co, RUN);
      // 산출은 eval=pass 인데 재유도 입력을 eval=skip 으로 바꾸면 불일치.
      const otherEval = evalOutcome("skip");
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          report,
          otherEval,
          co,
          RUN,
        ),
      ).toThrow(RangeError);
    });
  });

  describe("REQ-059 / §9 정합 — raw 활동 본문·credential·specPath 미노출", () => {
    it("정상 산출은 gitSha/dateToken/status/overallStatus/summaryLine 만 비교(void)", () => {
      const ev = evalOutcome("run", true);
      const co = collectOutcome("run", true);
      const report = buildRealDataDailyStepDualLegRunReport(ev, co, RUN);
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          report,
          ev,
          co,
          RUN,
        ),
      ).not.toThrow();
    });

    it("specPath 는 report 로 전파되지 않아 재유도 대상 아님(specPath 보유 outcome 도 정합)", () => {
      const ev: RealDataDailyStepLegRunOutcome = {
        leg: "eval",
        action: "run",
        passed: true,
        specPath: "test/e2e/eval.spec.ts",
      };
      const co: RealDataDailyStepLegRunOutcome = {
        leg: "collect",
        action: "run",
        passed: true,
        specPath: "test/e2e/collect.spec.ts",
      };
      const report = buildRealDataDailyStepDualLegRunReport(ev, co, RUN);
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          report,
          ev,
          co,
          RUN,
        ),
      ).not.toThrow();
    });

    it("에러 메시지에 credential/specPath 어휘 미노출(report 필드 값만)", () => {
      const ev = evalOutcome("run", true);
      const co = collectOutcome("run", true);
      const report = buildRealDataDailyStepDualLegRunReport(ev, co, RUN);
      const drifted = { ...report, overallStatus: "some-fail" as const };
      let message = "";
      try {
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          drifted,
          ev,
          co,
          RUN,
        );
      } catch (e) {
        message = (e as Error).message;
      }
      expect(message).toMatch(/some-fail/);
      // credential 어휘·specPath 미노출(gitSha/dateToken 은 정당한 report 식별자라 별개).
      expect(message).not.toMatch(/secret|password|credential|specPath/i);
    });
  });

  describe("결정성 / 비변형", () => {
    it("동일 정합 쌍 2 회 호출 → 둘 다 void(결정성)", () => {
      const ev = evalOutcome("run", false);
      const co = collectOutcome("skip");
      const report = buildRealDataDailyStepDualLegRunReport(ev, co, RUN);
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          report,
          ev,
          co,
          RUN,
        ),
      ).not.toThrow();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          report,
          ev,
          co,
          RUN,
        ),
      ).not.toThrow();
    });

    it("동일 drift 쌍 2 회 호출 → 둘 다 RangeError(결정성)", () => {
      const ev = evalOutcome("run", true);
      const co = collectOutcome("run", true);
      const report = buildRealDataDailyStepDualLegRunReport(ev, co, RUN);
      const drifted = { ...report, gitSha: "0000000" };
      const runIt = () =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          drifted,
          ev,
          co,
          RUN,
        );
      expect(runIt).toThrow(RangeError);
      expect(runIt).toThrow(RangeError);
    });

    it("가드 호출 전후 report/입력 객체 mutate 0 (deep-equal 불변)", () => {
      const ev = evalOutcome("run", true);
      const co = collectOutcome("skip");
      const report = buildRealDataDailyStepDualLegRunReport(ev, co, RUN);
      const reportSnap = JSON.stringify(report);
      const evSnap = JSON.stringify(ev);
      const coSnap = JSON.stringify(co);
      const runSnap = JSON.stringify(RUN);
      assertRealDataDailyStepDualLegRunReportConsistentWithInput(
        report,
        ev,
        co,
        RUN,
      );
      expect(JSON.stringify(report)).toBe(reportSnap);
      expect(JSON.stringify(ev)).toBe(evSnap);
      expect(JSON.stringify(co)).toBe(coSnap);
      expect(JSON.stringify(RUN)).toBe(runSnap);
    });
  });
});
