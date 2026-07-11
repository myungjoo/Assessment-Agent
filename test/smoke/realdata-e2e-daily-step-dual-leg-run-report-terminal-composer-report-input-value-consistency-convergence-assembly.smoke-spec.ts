// realdata-e2e-daily-step-dual-leg-run-report-terminal-composer-report-input-
// value-consistency-convergence-assembly.smoke-spec.ts —
// 실 평가 e2e daily-step dual-leg run report publish chain 의 **종단 컴포저**
// (`buildRealDataDailyStepDualLegRunReport`, T-0894)를 두 leg outcome + run 식별자로
// 통과시켜 산출한 `RealDataDailyStepDualLegRunReport` 의 **6 필드 전체 값**
// (gitSha·dateToken·eval·collect·overallStatus·summaryLine)이 입력
// `(evalOutcome, collectOutcome, run)` 으로부터 컴포저 재호출 없이 **single-source
// 독립 재유도**(run.gitSha/dateToken guard → leg 라벨 정합 → per-leg status 파생 →
// overallStatus 파생 → gitSha/dateToken 전파 → summaryLine 동형 합성 → 6 키 정규화)한
// expected 와 값·per-leg status 파생·overallStatus 파생·summaryLine 합성·추가필드 drop
// 면에서 deep-equal 정합함을 T-0911 가드
// (`assertRealDataDailyStepDualLegRunReportConsistentWithInput`)로 박제하는
// report↔input value-consistency convergence non-gated build-time smoke
// (T-0926 박제, PLAN.md 109행 🟢 실 평가 e2e step ④, REQ-032 raw 미저장 / REQ-059).
//
// 절단면 — 상류 종단 컴포저 산출 report 6 필드 ↔ 입력 값-정합(single-source) seam:
//   dual-leg publish chain 은 (1) 두 leg(eval/collect) jest run outcome 을 얻고,
//   (2) run 식별자(gitSha/dateToken)와 함께 종단 컴포저에 넣어 하나의 report(per-leg
//   status + overallStatus + summaryLine)를 산출한다. 형제 T-0924(output↔stdout)·
//   T-0925(search-output↔stdout)는 두 **파서 seam**(출력·입력 leg)의 값-정합만 닫았고,
//   그 상류의 종단 컴포저 — 두 leg outcome + run 을 하나의 rolling-issue report 로 묶는
//   단계의 산출 6 필드 값-정합 — 은 어느 smoke 도 chain 그물로 검증하지 않았다
//   (`git grep assertRealDataDailyStepDualLegRunReportConsistentWithInput -- test/smoke/*`
//   = 0 hit). 가드 helper 자체(T-0910)와 컴포저 self-wire(T-0911, report.ts line 199)는
//   이미 main 에 박제됨 — 본 spec 은 그 self-wire 를 재배선하지 않고 chain 통과 report 를
//   가드로 검증하는 **smoke 그물만** 신설한다. summary 축 T-0725
//   (`assertRealDataResultIssueOutcomeReportOutputConsistentWithInput`) value-consistency
//   커버리지의 dual-leg mirror.
//
// 형제 smoke 와의 차별(= 상류 종단 컴포저 산출 report 6 필드 전체 값 축):
//   * T-0924(output↔stdout value-consistency) — 출력 leg 파서 seam. create/edit exec
//     stdout 까지 통과시켜 파서 산출 outcome{issueNumber,url} 값-정합을 T-0906 가드로
//     박제. 그 output outcome 파서 축 자체 재단언 금지.
//   * T-0925(search-output↔stdout value-consistency) — 입력 leg 파서 seam. search stdout
//     까지 통과시켜 파서 산출 hits[] number/title/body 값-정합을 T-0908 가드로 박제. 그
//     search hits 파서 축 자체 재단언 금지.
//   * T-0923(outcome-parse-shape set-equality)·T-0918~T-0922(argv 절단면·상태 전이·
//     idempotency·dual-medium 직교) — 그 절단면 자체 재단언 금지.
//   본 spec 은 상류 종단 컴포저 산출 report 6 필드 ↔ (evalOutcome, collectOutcome, run)
//   독립 재유도 deep-equal 축만 박제한다(값 drift 는 RangeError·구조 결손은 TypeError 분리).
//
// 따라서 본 spec 은:
//    🔥 실 LLM 호출 0 — orchestrator / scoring service / gateway 미사용. synthetic leg
//       outcome / run literal 을 컴포저에 직접 공급(실 평가·수집·jest spawn 0).
//    🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//    🔥 실 gh 실행 0 — search / issue create / issue edit 실 실행 0. execFile('gh', …) 0.
//    🔥 credential 0 / secret 0 / DB 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//    🔥 새 외부 dependency 0 — 기존 build*/assert* 컴포저 import 재사용만(컴포저·interface·
//       가드 본문 변경 0 — import·호출만).
//    🔥 gating / describe.skip / env-gating 배선 0 — 순수 build-time in-memory 검증만.
//
// raw / credential 누출 0(R-59 / REQ-032 / REQ-059): 본 spec 은 report 의 gitSha/dateToken/
//   leg status/overallStatus/summaryLine 값만 대조하고, GH_TOKEN/PAT/`ghp_`/`--token`/
//   `GITHUB_TOKEN`/narrative 어휘를 키/값 어디에도 담지 않으며, report 에 narrative 본문·raw
//   활동 본문·평가 정량이 없음(6 필드만)과, 가드 throw 메시지가 6 필드 값·타입만 노출(raw
//   활동 본문·credential 미노출)함을 negative case 에서 확인한다.
import { buildRealDataDailyStepDualLegRunReport } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report";
import type {
  RealDataDailyStepLegRunOutcome,
  RealDataDailyStepDualLegRunReport,
  RealDataDailyStepLegStatus,
  RealDataDailyStepDualLegOverallStatus,
} from "../helpers/realdata-e2e-daily-step-dual-leg-run-report";
import { assertRealDataDailyStepDualLegRunReportConsistentWithInput } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-consistency";
import type { RealDataResultIssueRunRef } from "../helpers/realdata-e2e-result-issue-descriptor";

// 결정론 run 식별자 fixture — gitSha + dateToken 비공백 안정 토큰. 매 it 가 spread 복제로
// 받아 입력 mutate 누설 0. token/secret/raw narrative 어휘 미포함(credential 누출 0 단언
// fixture 전제).
const RUN_A: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-07-12",
};

// synthetic leg outcome fixture — eval / collect 각 leg 의 run outcome literal. 컴포저는
// leg outcome 을 report 로 통과시키는 surface 만 다루므로 도메인 타입 정합만 만족하는
// minimal literal 로 충분하다(실 jest spawn 0). leg 라벨은 인자 위치와 정합해야 한다.
function evalRun(passed: boolean): RealDataDailyStepLegRunOutcome {
  return { leg: "eval", action: "run", passed };
}

function collectRun(passed: boolean): RealDataDailyStepLegRunOutcome {
  return { leg: "collect", action: "run", passed };
}

function evalSkip(): RealDataDailyStepLegRunOutcome {
  return { leg: "eval", action: "skip" };
}

function collectSkip(): RealDataDailyStepLegRunOutcome {
  return { leg: "collect", action: "skip" };
}

// chain 산출 report — 두 leg outcome + run 을 종단 컴포저로 통과시켜 report 를 얻는다
// (컴포저 self-wire(T-0911)가 산출 직전 가드로 입력 정합을 자체 검증하므로 정상 경로는
// throw 0). 값 drift negative 는 이 산출 report 를 복제·변형해 주입한다. 각 stage 의 guard
// throw 는 그대로 전파.
function buildReport(
  evalOutcome: RealDataDailyStepLegRunOutcome,
  collectOutcome: RealDataDailyStepLegRunOutcome,
  run: RealDataResultIssueRunRef = RUN_A,
): RealDataDailyStepDualLegRunReport {
  return buildRealDataDailyStepDualLegRunReport(
    evalOutcome,
    collectOutcome,
    run,
  );
}

// report 깊은 복제 — 값 drift negative 주입 시 원본 report(및 중첩 eval/collect)를 변형하지
// 않도록 새 객체로 복제한다(무공유).
function cloneReport(
  report: RealDataDailyStepDualLegRunReport,
): RealDataDailyStepDualLegRunReport {
  return {
    ...report,
    eval: { ...report.eval },
    collect: { ...report.collect },
  };
}

// spec 로컬 독립 재유도(컴포저 재호출 0) — 세 입력만으로 per-leg status 파생 →
// overallStatus 파생 → gitSha/dateToken 전파 → summaryLine 동형 합성으로 expected 를
// 재구성한다. 가드가 입력을 진실의 원천으로 삼음을 반영해 하드코딩 대신 입력 파생으로
// expected 를 만든다(single-source). 컴포저 템플릿과 byte-identical 하게 재구현한다.
function legStatus(
  outcome: RealDataDailyStepLegRunOutcome,
): RealDataDailyStepLegStatus {
  if (outcome.action === "skip") {
    return "skip";
  }
  return outcome.passed ? "pass" : "fail";
}

function deriveOverall(
  evalStatus: RealDataDailyStepLegStatus,
  collectStatus: RealDataDailyStepLegStatus,
): RealDataDailyStepDualLegOverallStatus {
  if (evalStatus === "fail" || collectStatus === "fail") {
    return "some-fail";
  }
  if (evalStatus === "pass" && collectStatus === "pass") {
    return "all-pass";
  }
  if (evalStatus === "skip" && collectStatus === "skip") {
    return "all-skip";
  }
  return "partial";
}

function reDeriveExpected(
  evalOutcome: RealDataDailyStepLegRunOutcome,
  collectOutcome: RealDataDailyStepLegRunOutcome,
  run: RealDataResultIssueRunRef,
): RealDataDailyStepDualLegRunReport {
  const evalStatus = legStatus(evalOutcome);
  const collectStatus = legStatus(collectOutcome);
  const overallStatus = deriveOverall(evalStatus, collectStatus);
  return {
    gitSha: run.gitSha,
    dateToken: run.dateToken,
    eval: { action: evalOutcome.action, status: evalStatus },
    collect: { action: collectOutcome.action, status: collectStatus },
    overallStatus,
    summaryLine: `[${run.dateToken}@${run.gitSha}] eval=${evalStatus} collect=${collectStatus} → ${overallStatus}`,
  };
}

describe("Smoke(non-gated): dual-leg run report terminal-composer report↔input value-consistency 수렴(chain 을 종단 컴포저까지 통과시켜 산출 report 6 필드 전체 값을 (evalOutcome, collectOutcome, run) 독립 재유도 expected 와 deep-equal 로 T-0911 가드 박제) live-gh 0 검증", () => {
  describe("happy path — all-pass value-consistency(chain 산출 report ↔ 입력 독립 재유도 deep-equal)", () => {
    it("all-pass chain(eval run+passed=true, collect run+passed=true → 종단 컴포저) 산출 report 에 guard(report, evalOutcome, collectOutcome, run) 적용 → 값-정합이라 throw 없이 void AND gitSha/dateToken === run, eval.status/collect.status === 'pass', overallStatus === 'all-pass'", () => {
      const evalOutcome = evalRun(true);
      const collectOutcome = collectRun(true);
      const report = buildReport(evalOutcome, collectOutcome, RUN_A);
      // 값-정합 → guard 는 throw 없이 void.
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          report,
          evalOutcome,
          collectOutcome,
          RUN_A,
        ),
      ).not.toThrow();
      // 6 필드 직접 대조.
      expect(report.gitSha).toBe(RUN_A.gitSha);
      expect(report.dateToken).toBe(RUN_A.dateToken);
      expect(report.eval.status).toBe("pass");
      expect(report.collect.status).toBe("pass");
      expect(report.overallStatus).toBe("all-pass");
    });
  });

  describe("overallStatus 4 분기 value-consistency(all-pass/some-fail/all-skip/partial 각 cover)", () => {
    it("(i) 둘 다 run+passed=true → overallStatus 'all-pass' AND guard void", () => {
      const e = evalRun(true);
      const c = collectRun(true);
      const report = buildReport(e, c, RUN_A);
      expect(report.overallStatus).toBe("all-pass");
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          report,
          e,
          c,
          RUN_A,
        ),
      ).not.toThrow();
    });

    it("(ii) 하나 run+passed=false → overallStatus 'some-fail'(fail 최우선) AND guard void", () => {
      const e = evalRun(false);
      const c = collectRun(true);
      const report = buildReport(e, c, RUN_A);
      expect(report.eval.status).toBe("fail");
      expect(report.overallStatus).toBe("some-fail");
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          report,
          e,
          c,
          RUN_A,
        ),
      ).not.toThrow();
    });

    it("(iii) 둘 다 skip → overallStatus 'all-skip' AND guard void", () => {
      const e = evalSkip();
      const c = collectSkip();
      const report = buildReport(e, c, RUN_A);
      expect(report.eval.status).toBe("skip");
      expect(report.collect.status).toBe("skip");
      expect(report.overallStatus).toBe("all-skip");
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          report,
          e,
          c,
          RUN_A,
        ),
      ).not.toThrow();
    });

    it("(iv) 하나 skip + 하나 pass → overallStatus 'partial' AND guard void", () => {
      const e = evalSkip();
      const c = collectRun(true);
      const report = buildReport(e, c, RUN_A);
      expect(report.eval.status).toBe("skip");
      expect(report.collect.status).toBe("pass");
      expect(report.overallStatus).toBe("partial");
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          report,
          e,
          c,
          RUN_A,
        ),
      ).not.toThrow();
    });
  });

  describe("6 필드 값 threading · 추가필드 drop", () => {
    it("report own key 집합이 정확히 {gitSha, dateToken, eval, collect, overallStatus, summaryLine} 6키(eval/collect 는 각 {action, status} 2키), gitSha/dateToken 이 run 에서·eval.action/collect.action 이 각 leg outcome 에서·status/overallStatus 가 파생 규약으로 threading", () => {
      const e = evalRun(false);
      const c = collectRun(true);
      const report = buildReport(e, c, RUN_A);
      expect(Object.keys(report).sort()).toEqual([
        "collect",
        "dateToken",
        "eval",
        "gitSha",
        "overallStatus",
        "summaryLine",
      ]);
      expect(Object.keys(report.eval).sort()).toEqual(["action", "status"]);
      expect(Object.keys(report.collect).sort()).toEqual(["action", "status"]);
      // threading — gitSha/dateToken 은 run, action 은 leg outcome, status 는 파생.
      expect(report.gitSha).toBe(RUN_A.gitSha);
      expect(report.dateToken).toBe(RUN_A.dateToken);
      expect(report.eval.action).toBe(e.action);
      expect(report.collect.action).toBe(c.action);
      expect(report.eval.status).toBe("fail");
      expect(report.collect.status).toBe("pass");
      expect(report.overallStatus).toBe("some-fail");
    });

    it("summaryLine 이 gitSha/dateToken + 두 leg status + overallStatus 를 포함(byte-identical 결정론) — 정확 일치 및 substring 확인", () => {
      const e = evalRun(true);
      const c = collectRun(false);
      const report = buildReport(e, c, RUN_A);
      const expectedLine = `[${RUN_A.dateToken}@${RUN_A.gitSha}] eval=pass collect=fail → some-fail`;
      expect(report.summaryLine).toBe(expectedLine);
      // 구성 요소 substring.
      expect(report.summaryLine).toContain(RUN_A.gitSha);
      expect(report.summaryLine).toContain(RUN_A.dateToken);
      expect(report.summaryLine).toContain(report.eval.status);
      expect(report.summaryLine).toContain(report.collect.status);
      expect(report.summaryLine).toContain(report.overallStatus);
    });
  });

  describe("single-source 독립 재유도 — 컴포저 재호출 0, 입력을 진실의 원천으로", () => {
    it("동일 (evalOutcome, collectOutcome, run) 에서 컴포저 재호출 없이 gitSha/dateToken 전파 + per-leg status 파생 + overallStatus 파생 + summaryLine 합성으로 산출한 expected report 가 chain 산출 report 와 deep-equal", () => {
      const e = evalRun(false);
      const c = collectSkip();
      const report = buildReport(e, c, RUN_A);
      expect(report).toEqual(reDeriveExpected(e, c, RUN_A));
    });

    it("결정론 — 동일 입력 두 번 컴포저 → 두 report deep-equal(byte-identical)", () => {
      const e = evalRun(true);
      const c = collectRun(true);
      const a = buildReport(e, c, RUN_A);
      const b = buildReport(e, c, RUN_A);
      expect(a).toEqual(b);
    });
  });

  describe("error path / negative cases — 예외 분기마다 각 1+(단일 negative 금지)", () => {
    it("(a) gitSha/dateToken 값 drift(RangeError) — chain 산출 report 복제 후 gitSha(또는 dateToken)를 run 과 다른 값으로 변형(공백 추가·대소문자 변경 포함, trim·case-fold 0) → guard RangeError(값 정합 위반)", () => {
      const e = evalRun(true);
      const c = collectRun(true);
      const report = buildReport(e, c, RUN_A);
      // gitSha 대소문자 변경(case-fold 0).
      const shaDrift = cloneReport(report);
      shaDrift.gitSha = report.gitSha.toUpperCase();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          shaDrift,
          e,
          c,
          RUN_A,
        ),
      ).toThrow(RangeError);
      // dateToken trailing 공백 추가(trim 0).
      const dateDrift = cloneReport(report);
      dateDrift.dateToken = `${report.dateToken} `;
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          dateDrift,
          e,
          c,
          RUN_A,
        ),
      ).toThrow(RangeError);
    });

    it("(b) per-leg status 값 drift(RangeError) — report 복제 후 eval.status(또는 collect.status)를 파생 규약과 다른 값('pass'→'fail')으로 변형 → guard RangeError", () => {
      const e = evalRun(true);
      const c = collectRun(true);
      const report = buildReport(e, c, RUN_A);
      const evalDrift = cloneReport(report);
      evalDrift.eval.status = "fail";
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          evalDrift,
          e,
          c,
          RUN_A,
        ),
      ).toThrow(RangeError);
      const collectDrift = cloneReport(report);
      collectDrift.collect.status = "fail";
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          collectDrift,
          e,
          c,
          RUN_A,
        ),
      ).toThrow(RangeError);
    });

    it("(c) overallStatus 값 drift(RangeError) — report 복제 후 overallStatus 를 재유도 값과 다른 분기값('all-pass'→'partial')으로 변형 → guard RangeError", () => {
      const e = evalRun(true);
      const c = collectRun(true);
      const report = buildReport(e, c, RUN_A);
      const overallDrift = cloneReport(report);
      overallDrift.overallStatus = "partial";
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          overallDrift,
          e,
          c,
          RUN_A,
        ),
      ).toThrow(RangeError);
    });

    it("(d) summaryLine 값 drift(RangeError) — report 복제 후 summaryLine 을 파생 합성과 다른 문자열(끝에 공백 1개 추가)로 변형 → guard RangeError(값 정합 위반)", () => {
      const e = evalRun(true);
      const c = collectRun(true);
      const report = buildReport(e, c, RUN_A);
      const lineDrift = cloneReport(report);
      lineDrift.summaryLine = `${report.summaryLine} `;
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          lineDrift,
          e,
          c,
          RUN_A,
        ),
      ).toThrow(RangeError);
    });

    it("(e) 잉여 필드 drift(RangeError) — report 복제 후 url(또는 credential-형 token) 키 1개 추가(키 7개) → guard RangeError(추가필드 drop 위반)", () => {
      const e = evalRun(true);
      const c = collectRun(true);
      const report = buildReport(e, c, RUN_A);
      const withUrl = cloneReport(report);
      (withUrl as unknown as Record<string, unknown>).url =
        "https://github.com/o/r/issues/1";
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          withUrl,
          e,
          c,
          RUN_A,
        ),
      ).toThrow(RangeError);
      const withToken = cloneReport(report);
      (withToken as unknown as Record<string, unknown>).token = "ghp_leaked";
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          withToken,
          e,
          c,
          RUN_A,
        ),
      ).toThrow(RangeError);
    });

    it("(f-i) 구조 결손(TypeError) — report=null/undefined/숫자/문자열(비객체)/배열, 6 필드 type 위반(gitSha=number/eval=null/overallStatus 비문자열) 각각 → guard TypeError(값 정합 RangeError 와 분리)", () => {
      const e = evalRun(true);
      const c = collectRun(true);
      const report = buildReport(e, c, RUN_A);
      const badReports: unknown[] = [
        null,
        undefined,
        42,
        "not-an-object",
        [report],
        { ...cloneReport(report), gitSha: 7 },
        { ...cloneReport(report), eval: null },
        { ...cloneReport(report), overallStatus: 5 },
      ];
      for (const bad of badReports) {
        expect(() =>
          assertRealDataDailyStepDualLegRunReportConsistentWithInput(
            bad as unknown as RealDataDailyStepDualLegRunReport,
            e,
            c,
            RUN_A,
          ),
        ).toThrow(TypeError);
      }
    });

    it("(f-ii) 구조 결손(TypeError) — 정상 report + 입력측 run.gitSha 빈-공백 / evalOutcome leg 라벨 오류(eval 자리에 collect leg) / action='run'+passed=undefined / action='skip'+passed=true(모순) 각각 → guard TypeError", () => {
      const e = evalRun(true);
      const c = collectRun(true);
      const report = buildReport(e, c, RUN_A);
      // run.gitSha 빈-공백.
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          report,
          e,
          c,
          { gitSha: "   ", dateToken: RUN_A.dateToken },
        ),
      ).toThrow(TypeError);
      // evalOutcome leg 라벨 오류(eval 자리에 collect leg).
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          report,
          { leg: "collect", action: "run", passed: true },
          c,
          RUN_A,
        ),
      ).toThrow(TypeError);
      // action='run'+passed=undefined(불완전 run outcome).
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          report,
          { leg: "eval", action: "run" },
          c,
          RUN_A,
        ),
      ).toThrow(TypeError);
      // action='skip'+passed=true(모순 outcome).
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          report,
          e,
          { leg: "collect", action: "skip", passed: true },
          RUN_A,
        ),
      ).toThrow(TypeError);
    });

    it("(g) chain-상류 차단 — run.gitSha 빈/공백 → 컴포저(self-wire 포함) throw 로 report 미산출(잘못된 report 가 value-consistency 가드/rolling-issue 박제로 새는 것 차단)", () => {
      const e = evalRun(true);
      const c = collectRun(true);
      expect(() =>
        buildReport(e, c, { gitSha: "   ", dateToken: RUN_A.dateToken }),
      ).toThrow();
    });

    it("(g) chain-상류 차단 — eval 자리에 collect leg outcome cross-wiring → 컴포저 leg 라벨 guard throw 로 조립 자체 차단", () => {
      const crossWired: RealDataDailyStepLegRunOutcome = {
        leg: "collect",
        action: "run",
        passed: true,
      };
      const c = collectRun(true);
      expect(() => buildReport(crossWired, c, RUN_A)).toThrow();
    });
  });

  describe("결정론 · 무공유 · no-mutation", () => {
    it("동일 (evalOutcome, collectOutcome, run) 로 컴포저 두 번 실행 → 두 report deep-equal(byte-identical)이며 서로 다른 객체 인스턴스(무공유, 중첩 eval/collect 도 별도 인스턴스)", () => {
      const e = evalRun(false);
      const c = collectRun(true);
      const a = buildReport(e, c, RUN_A);
      const b = buildReport(e, c, RUN_A);
      expect(a).toEqual(b);
      expect(a).not.toBe(b);
      expect(a.eval).not.toBe(b.eval);
      expect(a.collect).not.toBe(b.collect);
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          a,
          e,
          c,
          RUN_A,
        ),
      ).not.toThrow();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          b,
          e,
          c,
          RUN_A,
        ),
      ).not.toThrow();
    });

    it("no-mutation — guard 호출이 report·세 입력을 mutate 0(호출 전후 JSON snapshot deep-equal)", () => {
      const e = evalRun(true);
      const c = collectRun(false);
      const report = buildReport(e, c, RUN_A);
      const reportBefore = JSON.parse(JSON.stringify(report));
      const eBefore = JSON.parse(JSON.stringify(e));
      const cBefore = JSON.parse(JSON.stringify(c));
      const runBefore = JSON.parse(JSON.stringify(RUN_A));
      assertRealDataDailyStepDualLegRunReportConsistentWithInput(
        report,
        e,
        c,
        RUN_A,
      );
      expect(report).toEqual(reportBefore);
      expect(e).toEqual(eBefore);
      expect(c).toEqual(cBefore);
      expect(RUN_A).toEqual(runBefore);
    });
  });

  describe("raw / credential 누출 0(R-59 / REQ-032 / REQ-059)", () => {
    it("chain 산출 report 가 정확히 6 필드(narrative 본문·raw 활동 본문·평가 정량 없음)뿐이며 GH_TOKEN/PAT/ghp_/--token/GITHUB_TOKEN 어휘를 키/값 어디에도 담지 않음", () => {
      const e = evalRun(false);
      const c = collectSkip();
      const report = buildReport(e, c, RUN_A);
      expect(Object.keys(report).sort()).toEqual([
        "collect",
        "dateToken",
        "eval",
        "gitSha",
        "overallStatus",
        "summaryLine",
      ]);
      const serialized = JSON.stringify(report);
      expect(serialized).not.toContain("--token");
      expect(serialized).not.toContain("GITHUB_TOKEN");
      expect(serialized).not.toContain("GH_TOKEN");
      expect(serialized).not.toContain("ghp_");
      expect(serialized).not.toMatch(/ghp_[A-Za-z0-9]/);
    });

    it("가드 throw 메시지가 raw 활동 본문·credential 을 노출하지 않음(6 필드 값·타입만) — overallStatus drift RangeError 메시지에 --token/ghp_/GITHUB_TOKEN 미포함", () => {
      const e = evalRun(true);
      const c = collectRun(true);
      const report = buildReport(e, c, RUN_A);
      const drift = cloneReport(report);
      drift.overallStatus = "partial";
      let message = "";
      try {
        assertRealDataDailyStepDualLegRunReportConsistentWithInput(
          drift,
          e,
          c,
          RUN_A,
        );
      } catch (err) {
        message = (err as Error).message;
      }
      expect(message).toContain("all-pass"); // 재유도 기대값 노출
      expect(message).not.toContain("--token");
      expect(message).not.toContain("GITHUB_TOKEN");
      expect(message).not.toContain("ghp_");
    });
  });
});
