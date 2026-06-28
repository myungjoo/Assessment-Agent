// realdata-e2e-publish-outcome-step-args-run-convergence-assembly.smoke-spec.ts —
// 실 평가 e2e step④ publish↔outcome step-args 두 leg single-source runPlan.run
// convergence 조립 체인 non-gated build-time smoke (T-0759 박제, PLAN.md 109행
// 🟢 실 평가 e2e).
//
// 본 spec 의 존재 이유 — public CI gap 해소(T-0737 publish / T-0738 outcome 단독
// 조립 smoke 의 cross-leg run-convergence 짝):
//   - PLAN 109행 step ④ 결과 이슈 박제는 **pre-실행 publish leg** 와 **post-실행
//     outcome leg** 두 단계로 갈린다. (1) publish leg 순수 컴포저
//     `buildRealDataResultPublishStepArgs(runPlan, results)`(T-0599)는 `runPlan.run`
//     (gitSha + dateToken) 으로부터 멱등 marker(= `report.descriptor.marker` =
//     `commandArgs.searchQuery`)를 합성해 이슈를 어떤 marker 로 검색/생성/갱신할지
//     결정하고, (2) outcome leg 순수 컴포저
//     `buildRealDataResultOutcomeStepArgs(runPlan, stdout)`(T-0600)는 **같은
//     `runPlan.run`** 으로부터 결과 리포트의 `gitSha`/`dateToken` 을 전파한다.
//   - step④ 멱등 round-trip 의 핵심 불변식은 **두 leg 가 동일 단일 `runPlan.run`
//     source 로 수렴**한다는 것 — 즉 run X 로 박제(publish)한 이슈의 outcome 도 반드시
//     run X 로 보고돼야 한다. 두 leg 가 같은 `runPlan.run` 을 공유하지 않으면(한 leg 가
//     독립 run 인자를 재전달하거나 다른 run 식별자를 끌어쓰면) 박제한 이슈와 보고하는
//     outcome 의 run 식별자가 drift 해 멱등 search-or-update 가 깨진다.
//   - 기존 sweep 은 두 leg 를 **각각 따로** 닫았다 — publish leg 는 T-0737, outcome
//     leg 는 T-0738, pre-실행 dual-leg aggregator(publish+evaluation)는 T-0752. 그러나
//     **publish leg 와 outcome leg 를 동일 `runPlan` 으로 동시 호출해, publish 가 쓰는
//     marker 의 run source 와 outcome 이 보고하는 run 식별자가 byte-identical 단일
//     source(`runPlan.run.gitSha`/`dateToken`)로 수렴**함을 박제한 smoke 는 NONE 이었다.
//   - 본 spec 은 그 gap 을 메운다 — **gating 없이 항상 실행되는 일반 describe** 로 두
//     leg 의 cross-leg run 수렴만 검증한다(publish leg plan shape / outcome leg report
//     shape 자체 재단언 금지 — T-0737/T-0738 이미 cover). live leg(실 LLM /
//     EvaluationOrchestratorService / Ollama / 실 github 수집 / 실 gh search·create·edit
//     / `execFile('gh', argv)` / 실 jest spawn)는 복제하지 않고, EvaluationResult 와 gh
//     stdout 을 synthetic literal 로 직접 공급해 두 live leg 를 우회한다. 따라서 본 spec 은:
//
//      🔥 실 LLM 호출 0 — orchestrator / scoring service / gateway 미사용. synthetic
//         EvaluationResult + gh stdout literal 을 두 컴포저에 직접 공급.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 DB 접근 0 / 실 jest spawn 0 — seed→run-plan→두 step-args 조립만.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 build* 컴포저 import 재사용만(가드 신설 금지).
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0759):
//   - 실 LLM round-trip / EvaluationOrchestratorService / Ollama 호출 — 본 spec 은 두
//     leg 를 synthetic 결과·stdout literal 로 대체(실 평가·실 gh 0). live leg 검증은
//     기존 realdata-e2e-live.smoke-spec.ts 책임.
//   - 실 github 네트워크 수집 / gh 실행 / 실 이슈 search·create·edit·박제 / 실 jest spawn.
//   - publish leg 자체의 plan shape({report, commandArgs, searchArgv}) 전수 재단언 +
//     run 단일 source threading(vs buildRealDataResultIssuePublishPlan) 재단언
//     (T-0737 이미 cover — 본 task 는 cross-leg run 수렴만).
//   - outcome leg 자체의 report shape / 파싱 재유도 재단언(T-0738 이미 cover).
//   - pre-실행 dual-leg aggregator(buildRealDataE2eStepArgs) convergence 재단언(T-0752).
//   - 단일 run 안의 search↔resolve round-trip 재단언(T-0758).
//   - 새 컴포저 / 가드 / helper 신설 — 기존 build* 컴포저 import 재사용만.
//   - production src/ 코드 / 기존 컴포저 소스 / 위임 helper / consistency 가드 수정 —
//     test-only(신규 smoke spec 1 파일).
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";
import type { RealDataResultIssueRunRef } from "../helpers/realdata-e2e-result-issue-descriptor";
import { buildRealDataResultOutcomeStepArgs } from "../helpers/realdata-e2e-result-outcome-step-args";
import { buildRealDataResultPublishStepArgs } from "../helpers/realdata-e2e-result-publish-step-args";
import { buildRealDataE2eRunPlan } from "../helpers/realdata-e2e-run-plan";
import type { RealDataE2eRunPlan } from "../helpers/realdata-e2e-run-plan";
import { buildRealDataE2eSeed } from "../helpers/realdata-e2e-seed-fixture";

// 본 smoke 공통 fixture — 유효 modelId(비공백) 결정론 상수.
const MODEL_ID = "cfg-realdata-e2e-publish-outcome-run-convergence-smoke";

// 본 smoke 공통 fixture — 결정론 run 식별자(gitSha + dateToken 비공백). 매 it 가
// runPlan 구성 시 spread 복제로 받아 입력 mutate 가 누설되지 않도록 한다.
const RUN_REF: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-06-28",
};

// 다른 run 식별자(partial-thread 격리 case 용) — gitSha/dateToken 둘 다 RUN_REF 와
// 다르므로 marker run source 와 outcome run 필드가 함께 동형 변화함을 검증한다.
const OTHER_RUN_REF: RealDataResultIssueRunRef = {
  gitSha: "def5678",
  dateToken: "2026-07-01",
};

// synthetic gh issue create/edit stdout literal — outcome leg 는 이 stdout 을 파싱
// (URL 추출·issueNumber 검증) → outcome → run 결합 → 실행 리포트로 흘려보낸다. 실
// `gh issue create`/`gh issue edit` round-trip 없이 정상 issue URL 한 줄을 직접 주입.
// create / edit 두 outcome 분기 모두 cover 한다(다른 이슈 번호).
const CREATE_STDOUT =
  "https://github.com/myungjoo/assessment-agent/issues/42\n";
const EDIT_STDOUT = "https://github.com/myungjoo/assessment-agent/issues/7\n";

// synthetic EvaluationResult 1 건 — publish leg 는 결과 배열을 요약 집계 → descriptor
// → command-args → search-argv 로 흘려보내는 surface 만 받으므로 도메인 타입 정합만
// 만족하는 minimal literal 로 충분하다(실 LLM 호출 0).
function syntheticResult(unitId: string, volume: number): EvaluationResult {
  return {
    unitId,
    narrative:
      "synthetic evaluation narrative — publish↔outcome run-convergence smoke fixture",
    difficulty: "easy",
    contribution: "low",
    volume,
  };
}

// 유효 runPlan 을 결정론 seed + modelId + run 으로 조립하는 헬퍼. run 은 spread 복제로
// 넘겨 입력 run-ref mutate 누설 0. run 인자 기본값은 RUN_REF.
function buildValidRunPlan(
  run: RealDataResultIssueRunRef = RUN_REF,
): RealDataE2eRunPlan {
  return buildRealDataE2eRunPlan(buildRealDataE2eSeed(), MODEL_ID, { ...run });
}

// 기본 results fixture — happy/branch case 의 공통 입력.
function defaultResults(): EvaluationResult[] {
  return [
    syntheticResult("github:github.com:c1", 3),
    syntheticResult("github:github.com:c2", 5),
  ];
}

describe("Smoke(non-gated): 실 평가 e2e step④ publish↔outcome step-args 두 leg single-source runPlan.run convergence 조립 체인 live-LLM 0 검증", () => {
  describe("happy path — 동일 runPlan 으로 두 leg 동시 호출 정상 산출", () => {
    it("동일 runPlan 으로 publish leg + outcome leg 호출 → publishPlan({report, commandArgs, searchArgv}) + outcomeReport({issueNumber, url, gitSha, dateToken, summaryLine}) 모두 정상 산출", () => {
      const runPlan = buildValidRunPlan();
      const results = defaultResults();

      // pre-실행 publish leg(results 입력) + post-실행 outcome leg(stdout 입력) 동시 호출.
      const publishPlan = buildRealDataResultPublishStepArgs(runPlan, results);
      const outcomeReport = buildRealDataResultOutcomeStepArgs(
        runPlan,
        CREATE_STDOUT,
      );

      // publish leg 3 필드 산출.
      expect(publishPlan.report).toBeDefined();
      expect(publishPlan.commandArgs).toBeDefined();
      expect(publishPlan.searchArgv).toBeDefined();

      // outcome leg 5 필드 산출 + issueNumber 양의 정수.
      expect(outcomeReport.issueNumber).toBe(42);
      expect(Number.isInteger(outcomeReport.issueNumber)).toBe(true);
      expect(outcomeReport.issueNumber).toBeGreaterThan(0);
      expect(typeof outcomeReport.url).toBe("string");
      expect(typeof outcomeReport.summaryLine).toBe("string");
      expect(outcomeReport.summaryLine.length).toBeGreaterThan(0);
    });
  });

  describe("cross-leg run single-source 수렴 — 핵심 불변식(branch)", () => {
    it("create outcome 분기: outcomeReport.gitSha/dateToken === runPlan.run.* AND publish marker 가 동일 run 의 gitSha/dateToken 을 모두 포함(byte-identical 단일 source)", () => {
      const runPlan = buildValidRunPlan();
      const results = defaultResults();

      const publishPlan = buildRealDataResultPublishStepArgs(runPlan, results);
      const outcomeReport = buildRealDataResultOutcomeStepArgs(
        runPlan,
        CREATE_STDOUT,
      );

      // outcome leg 의 run source 관측점 — runPlan.run 과 byte-identical(toBe).
      expect(outcomeReport.gitSha).toBe(runPlan.run.gitSha);
      expect(outcomeReport.dateToken).toBe(runPlan.run.dateToken);

      // publish leg 의 run source 관측점 — marker(= commandArgs.searchQuery)가
      // runPlan.run 의 gitSha/dateToken 을 모두 포함(run 식별자 기반 멱등 marker).
      const marker = publishPlan.report.descriptor.marker;
      expect(publishPlan.commandArgs.searchQuery).toBe(marker);
      expect(marker).toContain(runPlan.run.gitSha);
      expect(marker).toContain(runPlan.run.dateToken);

      // 두 leg 가 같은 단일 runPlan.run 으로 수렴 — outcome run 필드가 publish marker
      // 안에 그대로 들어있다(drift 0).
      expect(marker).toContain(outcomeReport.gitSha);
      expect(marker).toContain(outcomeReport.dateToken);
    });

    it("edit(갱신) outcome 분기: outcomeReport.gitSha/dateToken === runPlan.run.* AND publish marker 와 수렴(create/edit 두 분기 모두 run source drift 0)", () => {
      const runPlan = buildValidRunPlan();
      const results = defaultResults();

      const publishPlan = buildRealDataResultPublishStepArgs(runPlan, results);
      // 갱신 경로 gh edit stdout 으로 outcome leg 호출.
      const outcomeReport = buildRealDataResultOutcomeStepArgs(
        runPlan,
        EDIT_STDOUT,
      );

      // edit 분기여도 run source 는 runPlan.run 으로 동일(stdout 의 issueNumber 만 다름).
      expect(outcomeReport.issueNumber).toBe(7);
      expect(outcomeReport.gitSha).toBe(runPlan.run.gitSha);
      expect(outcomeReport.dateToken).toBe(runPlan.run.dateToken);

      // publish marker run source 와 edit outcome run 필드가 동일 단일 source 로 수렴.
      const marker = publishPlan.report.descriptor.marker;
      expect(marker).toContain(outcomeReport.gitSha);
      expect(marker).toContain(outcomeReport.dateToken);
    });
  });

  describe("partial-thread 격리 — 두 leg 가 같은 source 따라 동시 이동(branch)", () => {
    it("다른 runPlan(run.gitSha/dateToken 변) 으로 두 leg 함께 호출 → publish marker run source 와 outcome run 필드가 함께 동형 변화(drift 0)", () => {
      // run X(RUN_REF).
      const runPlanX = buildValidRunPlan(RUN_REF);
      const results = defaultResults();
      const publishX = buildRealDataResultPublishStepArgs(runPlanX, results);
      const outcomeX = buildRealDataResultOutcomeStepArgs(
        runPlanX,
        CREATE_STDOUT,
      );

      // run Y(OTHER_RUN_REF — gitSha/dateToken 둘 다 다름).
      const runPlanY = buildValidRunPlan(OTHER_RUN_REF);
      const publishY = buildRealDataResultPublishStepArgs(runPlanY, results);
      const outcomeY = buildRealDataResultOutcomeStepArgs(
        runPlanY,
        CREATE_STDOUT,
      );

      // 두 leg 의 run source 가 run X→Y 로 **함께** 이동(한 leg 만 stale run 을 쓰면
      // 멱등 round-trip 이 깨짐 — 그 회귀를 박제).
      const markerX = publishX.report.descriptor.marker;
      const markerY = publishY.report.descriptor.marker;
      expect(markerX).not.toBe(markerY);
      expect(outcomeX.gitSha).not.toBe(outcomeY.gitSha);
      expect(outcomeX.dateToken).not.toBe(outcomeY.dateToken);

      // run X: publish marker 와 outcome run 필드가 함께 RUN_REF 로 수렴.
      expect(markerX).toContain(RUN_REF.gitSha);
      expect(markerX).toContain(RUN_REF.dateToken);
      expect(outcomeX.gitSha).toBe(RUN_REF.gitSha);
      expect(outcomeX.dateToken).toBe(RUN_REF.dateToken);

      // run Y: publish marker 와 outcome run 필드가 함께 OTHER_RUN_REF 로 수렴.
      expect(markerY).toContain(OTHER_RUN_REF.gitSha);
      expect(markerY).toContain(OTHER_RUN_REF.dateToken);
      expect(outcomeY.gitSha).toBe(OTHER_RUN_REF.gitSha);
      expect(outcomeY.dateToken).toBe(OTHER_RUN_REF.dateToken);
    });

    it("같은 runPlan 이면 results/stdout 가 달라도 두 leg 의 run source 는 불변(run 은 results/stdout 와 독립)", () => {
      const runPlan = buildValidRunPlan();

      // publish leg — 서로 다른 results 두 set.
      const publishA = buildRealDataResultPublishStepArgs(runPlan, [
        syntheticResult("github:github.com:a1", 1),
      ]);
      const publishB = buildRealDataResultPublishStepArgs(runPlan, [
        syntheticResult("github:github.com:b1", 2),
        syntheticResult("github:github.com:b2", 4),
      ]);
      // results 가 달라도 marker(run source)는 불변(동일 run → 동일 marker).
      expect(publishA.report.descriptor.marker).toBe(
        publishB.report.descriptor.marker,
      );

      // outcome leg — 서로 다른 stdout(create/edit).
      const outcomeA = buildRealDataResultOutcomeStepArgs(
        runPlan,
        CREATE_STDOUT,
      );
      const outcomeB = buildRealDataResultOutcomeStepArgs(runPlan, EDIT_STDOUT);
      // stdout 의 issueNumber 만 다르고 run 필드는 불변(동일 runPlan.run).
      expect(outcomeA.issueNumber).not.toBe(outcomeB.issueNumber);
      expect(outcomeA.gitSha).toBe(outcomeB.gitSha);
      expect(outcomeA.dateToken).toBe(outcomeB.dateToken);
      expect(outcomeA.gitSha).toBe(runPlan.run.gitSha);
      expect(outcomeA.dateToken).toBe(runPlan.run.dateToken);
    });
  });

  describe("flow / branch — pre-실행 publish vs post-실행 outcome leg 분리(독립 입력·run source 공유)", () => {
    it("pre-실행 publish leg — results 입력을 받아 marker 합성(stdout 미수신)", () => {
      const runPlan = buildValidRunPlan();
      const publishPlan = buildRealDataResultPublishStepArgs(
        runPlan,
        defaultResults(),
      );
      // publish leg 는 results 입력으로 marker(run source)를 합성한다.
      expect(publishPlan.commandArgs.searchQuery).toBe(
        publishPlan.report.descriptor.marker,
      );
      expect(publishPlan.report.descriptor.marker).toContain(
        runPlan.run.gitSha,
      );
    });

    it("post-실행 outcome leg — stdout 입력을 받아 run 필드 전파(results 미수신)", () => {
      const runPlan = buildValidRunPlan();
      const outcomeReport = buildRealDataResultOutcomeStepArgs(
        runPlan,
        CREATE_STDOUT,
      );
      // outcome leg 는 stdout 입력으로 outcome 을 파싱하되 run 은 runPlan.run 에서 전파.
      expect(outcomeReport.gitSha).toBe(runPlan.run.gitSha);
      expect(outcomeReport.dateToken).toBe(runPlan.run.dateToken);
    });
  });

  describe("credential 누출 0 — searchArgv/commandArgs/outcome report 어디에도 secret 미포함(§9)", () => {
    it("두 leg 산출 어느 직렬화에도 token/secret/ghp_/--auth 어휘 미포함", () => {
      const runPlan = buildValidRunPlan();
      const publishPlan = buildRealDataResultPublishStepArgs(
        runPlan,
        defaultResults(),
      );
      const outcomeReport = buildRealDataResultOutcomeStepArgs(
        runPlan,
        CREATE_STDOUT,
      );

      const serialized = [
        publishPlan.searchArgv.join(" "),
        JSON.stringify(publishPlan.commandArgs),
        JSON.stringify(outcomeReport),
      ]
        .join(" ")
        .toLowerCase();

      // 실 credential leak shape 어휘만 검사한다 — `token` 같은 일반 단어는 정상
      // 필드명(`dateToken`/`searchQuery`)·run 식별 marker 안에 합법적으로 등장하므로
      // false-positive 가 된다. PAT/secret 이 실제로 leak 될 때만 등장하는 shape
      // (`ghp_`/`gho_` GitHub PAT prefix·`--auth` flag·`authorization`/`bearer` 헤더·
      // `password`)만 부재 단언한다.
      for (const secretToken of [
        "ghp_",
        "gho_",
        "--auth",
        "authorization",
        "bearer",
        "password",
      ]) {
        expect(serialized).not.toContain(secretToken);
      }
    });
  });

  describe("결정론 · 무공유 · no-mutation — 동일 (runPlan, results, stdout) 두 번 호출 + 입력 불변", () => {
    it("두 leg 각각 두 번 호출 → deep-equal 산출(toEqual) + 새 객체(not.toBe)", () => {
      const runPlan = buildValidRunPlan();
      const results = defaultResults();

      const publishA = buildRealDataResultPublishStepArgs(runPlan, results);
      const publishB = buildRealDataResultPublishStepArgs(runPlan, results);
      const outcomeA = buildRealDataResultOutcomeStepArgs(
        runPlan,
        CREATE_STDOUT,
      );
      const outcomeB = buildRealDataResultOutcomeStepArgs(
        runPlan,
        CREATE_STDOUT,
      );

      // 값은 deep-equal(결정론 — 입력만의 함수).
      expect(publishA).toEqual(publishB);
      expect(outcomeA).toEqual(outcomeB);

      // 참조는 무공유 — 매 호출 새 객체.
      expect(publishA).not.toBe(publishB);
      expect(outcomeA).not.toBe(outcomeB);
    });

    it("입력 runPlan · results · stdout 이 호출 전후로 mutate 되지 않음(deep-equal 보존)", () => {
      const runPlan = buildValidRunPlan();
      const results = defaultResults();
      const stdout = CREATE_STDOUT;

      const runPlanBefore = JSON.parse(JSON.stringify(runPlan));
      const resultsBefore = JSON.parse(JSON.stringify(results));
      const stdoutBefore = stdout;

      buildRealDataResultPublishStepArgs(runPlan, results);
      buildRealDataResultOutcomeStepArgs(runPlan, stdout);

      // 호출 후 입력이 동형(무공유 보존 — 출력 변형이 입력에 누설 0). 문자열 stdout 불변.
      expect(runPlan).toEqual(runPlanBefore);
      expect(results).toEqual(resultsBefore);
      expect(stdout).toBe(stdoutBefore);
    });
  });

  describe("negative cases — 빈/공백 run 식별자의 두 leg guard 전파(자체 try/catch 0)", () => {
    // 직접 구성한 불완전 runPlan literal — buildRealDataE2eRunPlan 의 run guard 를
    // 우회해(정상 경로로는 빈 run 을 만들 수 없으므로) 불완전 run 을 두 leg 에 직접
    // 주입한다. pipeline 은 유효 modelId 로 채워 run 결손만 고립 검증한다.
    const validPipeline = buildValidRunPlan().pipeline;

    function brokenRunPlan(run: RealDataResultIssueRunRef): RealDataE2eRunPlan {
      return { pipeline: validPipeline, run };
    }

    it("run.gitSha 빈 문자열 — publish leg AND outcome leg 둘 다 위임 guard throw 전파", () => {
      const broken = brokenRunPlan({
        gitSha: "",
        dateToken: RUN_REF.dateToken,
      });
      expect(() => buildRealDataResultPublishStepArgs(broken, [])).toThrow();
      expect(() =>
        buildRealDataResultOutcomeStepArgs(broken, CREATE_STDOUT),
      ).toThrow();
    });

    it("run.gitSha 공백만 — 두 leg 둘 다 throw 전파", () => {
      const broken = brokenRunPlan({
        gitSha: "   ",
        dateToken: RUN_REF.dateToken,
      });
      expect(() => buildRealDataResultPublishStepArgs(broken, [])).toThrow();
      expect(() =>
        buildRealDataResultOutcomeStepArgs(broken, CREATE_STDOUT),
      ).toThrow();
    });

    it("run.dateToken 빈 문자열 — 두 leg 둘 다 throw 전파", () => {
      const broken = brokenRunPlan({ gitSha: RUN_REF.gitSha, dateToken: "" });
      expect(() => buildRealDataResultPublishStepArgs(broken, [])).toThrow();
      expect(() =>
        buildRealDataResultOutcomeStepArgs(broken, CREATE_STDOUT),
      ).toThrow();
    });

    it("run.dateToken 공백만 — 두 leg 둘 다 throw 전파", () => {
      const broken = brokenRunPlan({
        gitSha: RUN_REF.gitSha,
        dateToken: "   ",
      });
      expect(() => buildRealDataResultPublishStepArgs(broken, [])).toThrow();
      expect(() =>
        buildRealDataResultOutcomeStepArgs(broken, CREATE_STDOUT),
      ).toThrow();
    });

    it("outcome leg 에 URL 미발견 stdout — 위임 파서 throw 전파", () => {
      const runPlan = buildValidRunPlan();
      expect(() =>
        buildRealDataResultOutcomeStepArgs(runPlan, "no url here at all\n"),
      ).toThrow();
    });

    it("outcome leg 에 빈 stdout — 위임 파서 throw 전파", () => {
      const runPlan = buildValidRunPlan();
      expect(() => buildRealDataResultOutcomeStepArgs(runPlan, "")).toThrow();
    });

    it("outcome leg 에 /pull/ PR URL stdout — 위임 파서 throw 전파(issue 경로 아님)", () => {
      const runPlan = buildValidRunPlan();
      expect(() =>
        buildRealDataResultOutcomeStepArgs(
          runPlan,
          "https://github.com/myungjoo/assessment-agent/pull/42\n",
        ),
      ).toThrow();
    });

    it("outcome leg 에 issueNumber 0 stdout — 위임 파서 throw 전파(양의 정수 아님)", () => {
      const runPlan = buildValidRunPlan();
      expect(() =>
        buildRealDataResultOutcomeStepArgs(
          runPlan,
          "https://github.com/myungjoo/assessment-agent/issues/0\n",
        ),
      ).toThrow();
    });
  });
});
