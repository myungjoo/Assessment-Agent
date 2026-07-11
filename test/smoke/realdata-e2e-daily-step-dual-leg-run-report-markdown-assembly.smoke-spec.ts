// realdata-e2e-daily-step-dual-leg-run-report-markdown-assembly.smoke-spec.ts —
// 실 평가 e2e daily-step dual-leg run report → markdown 조립 체인 non-gated
// build-time smoke (T-0914 박제, PLAN.md 109행 🟢 실 평가 e2e step ④).
//
// 본 spec 의 존재 이유 — 마크다운-본문 렌더 side 조립 gap 해소(summary 축 T-0748 mirror):
//   - dual-leg run report 축은 두 leg run outcome 을 report descriptor 로 묶는 종단
//     컴포저(T-0894)와 그 descriptor 를 rolling-issue 박제용 결정론 마크다운으로
//     렌더하는 표현 layer(T-0895)를 모두 갖췄으나, **둘을 직접 chain 으로 묶어
//     마크다운 골격·per-leg 표기·overallStatus·summaryLine 보간·집계↔렌더 정합을
//     단언하는 조립 smoke 는 부재**했다. publish forward(T-0912)·round-trip(T-0913)
//     절단면은 이슈 publish argv side 를 닫았을 뿐 마크다운-본문 렌더 side 와 직교한다.
//   - 본 spec 은 그 gap 을 메운다 — **gating 없이 항상 실행되는 일반 describe** 로
//     (evalOutcome, collectOutcome, run) → buildRealDataDailyStepDualLegRunReport →
//     renderRealDataDailyStepDualLegRunReportMarkdown 종단 조립 surface 를 public CI
//     그물로 박제한다. nightly 의 실 jest spawn(eval leg + collect leg)은 복제하지
//     않고, 두 leg 의 run outcome 을 synthetic literal 로 직접 공급한다. 따라서 본 spec 은:
//
//      🔥 실 LLM 호출 0 — orchestrator / scoring service / gateway 미사용. synthetic
//         leg outcome literal 을 조립 체인 첫 단계에 직접 공급.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 실행 0. fetch 0. process.env 읽기 0.
//      🔥 실 gh 실행 0 — issue create / edit 실 실행 0. 순수 마크다운 문자열 조립만.
//      🔥 credential 0 / secret 0 / DB 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 build*/render* 컴포저 import 재사용만
//         (consistency-guard·helper 신설 금지 — sweep 종결, T-0911).
//      🔥 gating / describe.skip / env-gating 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0914):
//   - T-0912 forward publish 조립 smoke·T-0913 round-trip smoke 재검증·수정 — 본 spec 은
//     마크다운-본문 렌더 절단면만(별개 파일, file-disjoint).
//   - 실 LLM round-trip / 실 github 네트워크 / 실 gh issue create·edit·comment 실행
//     (step ④ live wiring — credential gate).
//   - 새 컴포저 / 가드 / helper 신설 — 기존 build*/render* 컴포저 import 재사용만.
//   - dual-leg 축 컴포저·렌더러 소스(test/helpers/realdata-e2e-daily-step-dual-leg-run-report*.ts)
//     수정 — read-only 검증 대상.
//   - 마크다운 외 포맷(plain text / HTML / JSON) 렌더 / production src/ 코드 변경.
import {
  buildRealDataDailyStepDualLegRunReport,
  type RealDataDailyStepDualLegRunReport,
  type RealDataDailyStepLegRunOutcome,
} from "../helpers/realdata-e2e-daily-step-dual-leg-run-report";
import { renderRealDataDailyStepDualLegRunReportMarkdown } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-markdown";
import type { RealDataResultIssueRunRef } from "../helpers/realdata-e2e-result-issue-descriptor";

// 본 smoke 공통 fixture — 결정론 run 식별자(gitSha + dateToken 비공백). 매 it 가
// spread 복제로 받아 입력 mutate 가 누설되지 않도록 한다.
const RUN_REF: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-07-11",
};

// synthetic leg outcome fixture — eval / collect 각 leg 의 run outcome literal.
// 조립 체인은 leg outcome 을 report → markdown 으로 흘려보내는 surface 만 검증하므로,
// 도메인 타입 정합(leg 라벨·action·passed 정합)만 만족하는 minimal literal 로 충분하다.
function evalPass(): RealDataDailyStepLegRunOutcome {
  return { leg: "eval", action: "run", passed: true };
}

function collectPass(): RealDataDailyStepLegRunOutcome {
  return { leg: "collect", action: "run", passed: true };
}

// renderViaChain — 본 smoke 의 종단 조립 진입. outcome+run → report → markdown 한 호출.
function renderViaChain(
  evalLeg: RealDataDailyStepLegRunOutcome,
  collectLeg: RealDataDailyStepLegRunOutcome,
  run: RealDataResultIssueRunRef,
): string {
  const report = buildRealDataDailyStepDualLegRunReport(
    evalLeg,
    collectLeg,
    run,
  );
  return renderRealDataDailyStepDualLegRunReportMarkdown(report);
}

describe("Smoke(non-gated): 실 평가 e2e dual-leg run report → markdown 조립 체인(outcome→report→markdown) live-LLM 0·gh 실행 0 검증", () => {
  describe("happy path — 종단 조립 markdown 산출", () => {
    it("유효 두 leg outcome + 유효 run → markdown 이 고정 헤더·git sha·date token·overall status·per-leg 표·summary 골격을 모두 보유", () => {
      const markdown = renderViaChain(evalPass(), collectPass(), {
        ...RUN_REF,
      });

      expect(markdown).toContain(
        "## 실 평가 e2e daily-step dual-leg run report",
      );
      expect(markdown).toContain(`- git sha: ${RUN_REF.gitSha}`);
      expect(markdown).toContain(`- date token: ${RUN_REF.dateToken}`);
      expect(markdown).toContain("- overall status: all-pass");
      expect(markdown).toContain("### leg 별 run outcome");
      expect(markdown).toContain("| leg | action | status |");
      expect(markdown).toContain("| --- | --- | --- |");
      expect(markdown).toContain("| eval | run | pass |");
      expect(markdown).toContain("| collect | run | pass |");
      expect(markdown).toContain(
        `- summary: [${RUN_REF.dateToken}@${RUN_REF.gitSha}] eval=pass collect=pass → all-pass`,
      );
    });

    it("chain 산출 markdown 이 expected literal(gitSha/dateToken/각 leg action·status/overallStatus/summaryLine 이 report 값 그대로 보간)과 byte-identical(toBe deep string)", () => {
      const expected = [
        "## 실 평가 e2e daily-step dual-leg run report",
        "",
        "- git sha: abc1234",
        "- date token: 2026-07-11",
        "- overall status: all-pass",
        "",
        "### leg 별 run outcome",
        "",
        "| leg | action | status |",
        "| --- | --- | --- |",
        "| eval | run | pass |",
        "| collect | run | pass |",
        "",
        "- summary: [2026-07-11@abc1234] eval=pass collect=pass → all-pass",
      ].join("\n");

      expect(renderViaChain(evalPass(), collectPass(), { ...RUN_REF })).toBe(
        expected,
      );
    });
  });

  describe("집계↔렌더 정합 — 중간 report 단일 source 전파, 재합성 없이 위임 산출만 옮김", () => {
    it("chain 산출 markdown 이 renderRealDataDailyStepDualLegRunReportMarkdown(buildRealDataDailyStepDualLegRunReport(...)) 와 toBe 동일(중간 report 단일 source)", () => {
      const evalLeg = evalPass();
      const collectLeg = collectPass();
      const run = { ...RUN_REF };

      const viaChain = renderViaChain(evalLeg, collectLeg, run);
      const viaDirect = renderRealDataDailyStepDualLegRunReportMarkdown(
        buildRealDataDailyStepDualLegRunReport(evalLeg, collectLeg, run),
      );

      expect(viaChain).toBe(viaDirect);
    });

    it("markdown 의 `- git sha`·`- date token`·`- overall status`·`- summary` 토큰이 중간 report 의 gitSha/dateToken/overallStatus/summaryLine 과 정합(컴포저 산출↔렌더 토큰 정합)", () => {
      const report = buildRealDataDailyStepDualLegRunReport(
        evalPass(),
        collectPass(),
        { ...RUN_REF },
      );
      const markdown = renderRealDataDailyStepDualLegRunReportMarkdown(report);

      expect(markdown).toContain(`- git sha: ${report.gitSha}`);
      expect(markdown).toContain(`- date token: ${report.dateToken}`);
      expect(markdown).toContain(`- overall status: ${report.overallStatus}`);
      expect(markdown).toContain(`- summary: ${report.summaryLine}`);
      // per-leg 표기 행도 report 의 action/status 그대로 전파.
      expect(markdown).toContain(
        `| eval | ${report.eval.action} | ${report.eval.status} |`,
      );
      expect(markdown).toContain(
        `| collect | ${report.collect.action} | ${report.collect.status} |`,
      );
    });
  });

  describe("branch — per-leg status 조합 → overallStatus 전파(분기마다 분리)", () => {
    it("(i) eval=pass·collect=pass → overallStatus all-pass 가 `- overall status` 토큰과 summaryLine 에 전파", () => {
      const markdown = renderViaChain(
        { leg: "eval", action: "run", passed: true },
        { leg: "collect", action: "run", passed: true },
        { ...RUN_REF },
      );
      expect(markdown).toContain("| eval | run | pass |");
      expect(markdown).toContain("| collect | run | pass |");
      expect(markdown).toContain("- overall status: all-pass");
      expect(markdown).toContain("eval=pass collect=pass → all-pass");
    });

    it("(i) eval=pass·collect=fail → overallStatus some-fail 가 표·overall status·summaryLine 에 전파", () => {
      const markdown = renderViaChain(
        { leg: "eval", action: "run", passed: true },
        { leg: "collect", action: "run", passed: false },
        { ...RUN_REF },
      );
      expect(markdown).toContain("| eval | run | pass |");
      expect(markdown).toContain("| collect | run | fail |");
      expect(markdown).toContain("- overall status: some-fail");
      expect(markdown).toContain("eval=pass collect=fail → some-fail");
    });

    it("(i) eval=skip·collect=pass → overallStatus partial 가 표·overall status·summaryLine 에 전파", () => {
      const markdown = renderViaChain(
        { leg: "eval", action: "skip" },
        { leg: "collect", action: "run", passed: true },
        { ...RUN_REF },
      );
      expect(markdown).toContain("| eval | skip | skip |");
      expect(markdown).toContain("| collect | run | pass |");
      expect(markdown).toContain("- overall status: partial");
      expect(markdown).toContain("eval=skip collect=pass → partial");
    });

    it("(ii) per-leg action 표기 — eval=run(pass)·collect=skip 의 action 이 표에 정확히 반영(run vs skip)", () => {
      const markdown = renderViaChain(
        { leg: "eval", action: "run", passed: true },
        { leg: "collect", action: "skip" },
        { ...RUN_REF },
      );
      // action 열(run vs skip)이 leg 별로 정확히 보간.
      expect(markdown).toContain("| eval | run | pass |");
      expect(markdown).toContain("| collect | skip | skip |");
    });

    it("(iii) overallStatus 분기 all-skip — eval=skip·collect=skip → all-skip 이 overall status·summaryLine 에 전파", () => {
      const markdown = renderViaChain(
        { leg: "eval", action: "skip" },
        { leg: "collect", action: "skip" },
        { ...RUN_REF },
      );
      expect(markdown).toContain("| eval | skip | skip |");
      expect(markdown).toContain("| collect | skip | skip |");
      expect(markdown).toContain("- overall status: all-skip");
      expect(markdown).toContain("eval=skip collect=skip → all-skip");
    });

    it("(iii) overallStatus 분기 some-fail 우선 — eval=fail·collect=skip → fail 최우선으로 some-fail 전파", () => {
      const markdown = renderViaChain(
        { leg: "eval", action: "run", passed: false },
        { leg: "collect", action: "skip" },
        { ...RUN_REF },
      );
      expect(markdown).toContain("| eval | run | fail |");
      expect(markdown).toContain("| collect | skip | skip |");
      expect(markdown).toContain("- overall status: some-fail");
      expect(markdown).toContain("eval=fail collect=skip → some-fail");
    });
  });

  describe("error path — 위임 guard 조립 경로 전파(자체 try/catch 0)", () => {
    it("(a) 빈 run.gitSha → 조립 첫 단계(build) guard throw 로 markdown 렌더 미도달", () => {
      expect(() =>
        renderViaChain(evalPass(), collectPass(), {
          gitSha: "",
          dateToken: RUN_REF.dateToken,
        }),
      ).toThrow();
    });

    it("(a) 공백만의 run.dateToken → 조립 첫 단계(build) guard throw 로 markdown 렌더 미도달", () => {
      expect(() =>
        renderViaChain(evalPass(), collectPass(), {
          gitSha: RUN_REF.gitSha,
          dateToken: "   ",
        }),
      ).toThrow();
    });

    it("(b) summaryLine 이 빈 mislabel report 를 렌더러에 직접 전달 → render 재확인 guard throw", () => {
      const report = buildRealDataDailyStepDualLegRunReport(
        evalPass(),
        collectPass(),
        { ...RUN_REF },
      );
      const broken: RealDataDailyStepDualLegRunReport = {
        ...report,
        summaryLine: "",
      };
      expect(() =>
        renderRealDataDailyStepDualLegRunReportMarkdown(broken),
      ).toThrow();
    });
  });

  describe("negative cases — 예외 상황 분기마다 cover", () => {
    it("(i) gitSha 빈 → build throw", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReport(evalPass(), collectPass(), {
          gitSha: "",
          dateToken: RUN_REF.dateToken,
        }),
      ).toThrow();
    });

    it("(ii) dateToken 빈 → build throw", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReport(evalPass(), collectPass(), {
          gitSha: RUN_REF.gitSha,
          dateToken: "",
        }),
      ).toThrow();
    });

    it("(iii) summaryLine 공백-only report → render throw", () => {
      const report = buildRealDataDailyStepDualLegRunReport(
        evalPass(),
        collectPass(),
        { ...RUN_REF },
      );
      const broken: RealDataDailyStepDualLegRunReport = {
        ...report,
        summaryLine: "   ",
      };
      expect(() =>
        renderRealDataDailyStepDualLegRunReportMarkdown(broken),
      ).toThrow();
    });

    it("(iv) leg 라벨 mislabel(eval 자리에 collect outcome) → build leg-label guard throw 로 markdown 미도달", () => {
      expect(() =>
        renderViaChain(
          { leg: "collect", action: "run", passed: true },
          collectPass(),
          { ...RUN_REF },
        ),
      ).toThrow();
    });

    it("(iv) leg 라벨 mislabel(collect 자리에 eval outcome) → build leg-label guard throw", () => {
      expect(() =>
        renderViaChain(
          evalPass(),
          { leg: "eval", action: "run", passed: true },
          { ...RUN_REF },
        ),
      ).toThrow();
    });

    it("(v) 동일 (evalOutcome, collectOutcome, run) 2회 chain → markdown deep-equal(문자열 동일)이면서 중간 report 객체 참조 무공유(not.toBe)", () => {
      const evalLeg = evalPass();
      const collectLeg = collectPass();
      const run = { ...RUN_REF };

      const reportA = buildRealDataDailyStepDualLegRunReport(
        evalLeg,
        collectLeg,
        run,
      );
      const reportB = buildRealDataDailyStepDualLegRunReport(
        evalLeg,
        collectLeg,
        run,
      );

      // 산출 markdown 은 문자열 동일(결정론).
      expect(renderRealDataDailyStepDualLegRunReportMarkdown(reportA)).toBe(
        renderRealDataDailyStepDualLegRunReportMarkdown(reportB),
      );

      // 중간 report 객체(및 하위 eval/collect)는 매 호출 새 참조(무공유).
      expect(reportA).toEqual(reportB);
      expect(reportA).not.toBe(reportB);
      expect(reportA.eval).not.toBe(reportB.eval);
      expect(reportA.collect).not.toBe(reportB.collect);
    });
  });

  describe("결정론 · 무공유 · no-mutation — 동일 입력 두 번 chain + 입력 불변", () => {
    it("같은 입력 두 번 chain → markdown 문자열 toBe 동일(결정론, 입력만의 함수)", () => {
      expect(renderViaChain(evalPass(), collectPass(), { ...RUN_REF })).toBe(
        renderViaChain(evalPass(), collectPass(), { ...RUN_REF }),
      );
    });

    it("중간 report 객체(및 하위 eval/collect)가 매 호출 새 참조(무공유)", () => {
      const reportA = buildRealDataDailyStepDualLegRunReport(
        evalPass(),
        collectPass(),
        { ...RUN_REF },
      );
      const reportB = buildRealDataDailyStepDualLegRunReport(
        evalPass(),
        collectPass(),
        { ...RUN_REF },
      );
      expect(reportA).toEqual(reportB);
      expect(reportA).not.toBe(reportB);
      expect(reportA.eval).not.toBe(reportB.eval);
      expect(reportA.collect).not.toBe(reportB.collect);
    });

    it("입력 evalOutcome/collectOutcome/run literal 이 chain 조립 전후로 mutate 0(deep-equal 보존)", () => {
      const evalLeg = evalPass();
      const collectLeg = collectPass();
      const run = { ...RUN_REF };
      const evalBefore = JSON.parse(JSON.stringify(evalLeg));
      const collectBefore = JSON.parse(JSON.stringify(collectLeg));
      const runBefore = JSON.parse(JSON.stringify(run));

      renderViaChain(evalLeg, collectLeg, run);

      expect(evalLeg).toEqual(evalBefore);
      expect(collectLeg).toEqual(collectBefore);
      expect(run).toEqual(runBefore);
    });
  });

  describe("raw 누출 0 — 안정 토큰·enum·고정 골격만(R-59/REQ-059)", () => {
    it("synthetic 입력에 sentinel 문자열(specPath)을 넣어도 markdown 에 미등장 — action/status enum·고정 골격 리터럴만 렌더", () => {
      const sentinel = "SENTINEL_RAW_LEAK_PROBE_T_0914";
      const evalLeg: RealDataDailyStepLegRunOutcome = {
        leg: "eval",
        action: "run",
        passed: true,
        specPath: `${sentinel}/eval.spec.ts`,
      };
      const collectLeg: RealDataDailyStepLegRunOutcome = {
        leg: "collect",
        action: "run",
        passed: true,
        specPath: `${sentinel}/collect.spec.ts`,
      };

      const markdown = renderViaChain(evalLeg, collectLeg, { ...RUN_REF });

      // specPath 는 report 로 전파 0 → markdown 에 sentinel 미등장.
      expect(markdown).not.toContain(sentinel);
      expect(markdown).not.toContain("specPath");
      expect(markdown).not.toContain(".spec.ts");
    });
  });
});
