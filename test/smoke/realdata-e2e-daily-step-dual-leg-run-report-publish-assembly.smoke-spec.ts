// realdata-e2e-daily-step-dual-leg-run-report-publish-assembly.smoke-spec.ts —
// 실 평가 e2e daily-step dual-leg run report 이슈 publish 조립 체인 non-gated
// build-time smoke (T-0912 박제, PLAN.md 109행 🟢 실 평가 e2e step ④).
//
// 본 spec 의 존재 이유 — 조립 체인 단위 CI gap 해소(summary 축 T-0729 mirror):
//   - dual-leg run report 이슈 publish 측 build-time chain 은 개별 layer 가 모두
//     순수 함수로 닫혀 있다: 컴포저(T-0894) → descriptor(T-0896) → command-args
//     (T-0897) → search-argv(T-0900) + 종단 command-plan(T-0902). 각 leaf 의
//     값-정합 가드 sweep 도 종결됐다(search-parse T-0908/T-0909·output-parse
//     T-0906/T-0907·종단 컴포저 T-0910/T-0911). 그러나 그 여러 컴포저를 하나로
//     엮은 **조립 체인 단위** 의 build-time smoke 는 부재했다 — 즉 report →
//     descriptor → commandArgs → searchArgv → command-plan 로 이어지는 합성
//     시그니처/순서/marker 전파 회귀가 CI 에서 잡힐 그물이 비어 있었다.
//   - 본 spec 은 그 gap 을 메운다 — **gating 없이 항상 실행되는 일반 describe** 로
//     dual-leg run report 이슈 publish 조립 surface 를 끝까지(report → command-plan)
//     검증한다. nightly 의 실 jest spawn(eval leg + collect leg)은 복제하지 않고,
//     두 leg 의 run outcome 을 synthetic literal 로 직접 공급해 평가/수집 leg 를
//     우회한다(조립 surface 만 검증). 따라서 본 spec 은:
//
//      🔥 실 LLM 호출 0 — orchestrator / scoring service / gateway 미사용. synthetic
//         leg outcome literal 을 조립 체인 첫 단계에 직접 공급.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 실행 0. fetch 0. process.env 읽기 0.
//      🔥 실 gh 실행 0 — search / issue create / issue edit 실 실행 0. command-plan
//         까지 argv 합성만 검증(execFile 배선 0 — deferred, ADR-0045 credential gate).
//      🔥 credential 0 / secret 0 / DB 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 build*/resolve* 컴포저 import 재사용만
//         (consistency-guard·helper 신설 금지 — sweep 종결, T-0911).
//      🔥 gating / describe.skip / env-gating 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0912):
//   - 실 LLM round-trip / EvaluationOrchestratorService / LlmHttpGateway / Ollama 호출
//     — 본 spec 은 두 leg 를 synthetic run outcome literal 로 대체(실 평가·수집 0).
//   - 실 github 네트워크 수집 / 실 gh search·issue create·edit 실행 / 실 이슈 박제
//     (step ④ live wiring — credential gate, ADR-0045 LAN gate).
//   - 새 컴포저 / 가드 / helper 신설 — 기존 build*/resolve* 컴포저 import 재사용만.
//   - dual-leg 축 컴포저 소스(test/helpers/realdata-e2e-daily-step-dual-leg-run-report*.ts)
//     수정 — read-only 검증 대상.
//   - 기존 dual-leg convergence smoke(eval↔collect 수렴 축) 파일 수정 — file-disjoint
//     병렬 stream(본 task 는 신규 파일 추가만).
//   - production src/ 코드 변경 — test-only(신규 smoke spec 1 파일).
import {
  buildRealDataDailyStepDualLegRunReport,
  type RealDataDailyStepLegRunOutcome,
} from "../helpers/realdata-e2e-daily-step-dual-leg-run-report";
import { buildRealDataDailyStepDualLegRunReportIssueCommandArgs } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
import { buildRealDataDailyStepDualLegRunReportIssueDescriptor } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor";
import { resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan";
import { buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv";
import type { RealDataResultIssueRunRef } from "../helpers/realdata-e2e-result-issue-descriptor";

// 본 smoke 공통 fixture — 결정론 run 식별자(gitSha + dateToken 비공백). 매 it 가
// spread 복제로 받아 입력 mutate 가 누설되지 않도록 한다.
const RUN_REF: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-07-11",
};

// synthetic leg outcome fixture — eval / collect 각 leg 의 run outcome literal.
// 조립 체인은 leg outcome 을 report → descriptor → command-args → search-argv →
// command-plan 로 흘려보내는 surface 만 검증하므로, 도메인 타입 정합(leg 라벨·
// action·passed 정합)만 만족하는 minimal literal 로 충분하다. 실 jest spawn 없이
// RealDataDailyStepLegRunOutcome shape 만 강제한다.
function evalOutcome(): RealDataDailyStepLegRunOutcome {
  return { leg: "eval", action: "run", passed: true };
}

function collectOutcome(): RealDataDailyStepLegRunOutcome {
  return { leg: "collect", action: "run", passed: true };
}

// 조립 체인 helper — 유효 입력을 report → descriptor → commandArgs → searchArgv 로
// 끝까지 통과시킨 산출을 한 묶음으로 반환한다. 각 it 가 이 묶음을 받아 개별 필드를
// 검증한다(중복 조립 코드 제거).
function assemblePublishChain(
  evalLeg: RealDataDailyStepLegRunOutcome,
  collectLeg: RealDataDailyStepLegRunOutcome,
  run: RealDataResultIssueRunRef,
) {
  const report = buildRealDataDailyStepDualLegRunReport(
    evalLeg,
    collectLeg,
    run,
  );
  const descriptor =
    buildRealDataDailyStepDualLegRunReportIssueDescriptor(report);
  const commandArgs =
    buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor);
  const searchArgv =
    buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs);
  return { report, descriptor, commandArgs, searchArgv };
}

describe("Smoke(non-gated): 실 평가 e2e dual-leg run report 이슈 publish 조립 체인(report→descriptor→commandArgs→searchArgv→command-plan) live-LLM 0·gh 실행 0 검증", () => {
  describe("happy path — 조립된 publish 체인 산출", () => {
    it("유효 두 leg outcome + 유효 run → report/descriptor/commandArgs/searchArgv 가 모두 조립되고 marker 가 searchQuery 로 전파되며 searchArgv 가 비어있지 않은 string[] 이다", () => {
      const { report, descriptor, commandArgs, searchArgv } =
        assemblePublishChain(evalOutcome(), collectOutcome(), { ...RUN_REF });

      // 각 단계 산출물이 모두 정의됨(조립 체인 끊김 0).
      expect(report).toBeDefined();
      expect(descriptor).toBeDefined();
      expect(commandArgs).toBeDefined();
      expect(searchArgv).toBeDefined();

      // report 필드 정합 — run 식별자 전파 + 두 leg status pass + overallStatus all-pass.
      expect(report.gitSha).toBe(RUN_REF.gitSha);
      expect(report.dateToken).toBe(RUN_REF.dateToken);
      expect(report.eval.status).toBe("pass");
      expect(report.collect.status).toBe("pass");
      expect(report.overallStatus).toBe("all-pass");

      // marker 전파 — descriptor.marker 가 commandArgs.searchQuery 로 그대로 전달됨(멱등 토큰).
      expect(commandArgs.searchQuery).toBe(descriptor.marker);

      // searchArgv 는 비어있지 않은 string[] — 첫 gh search 호출 argv.
      expect(Array.isArray(searchArgv)).toBe(true);
      expect(searchArgv.length).toBeGreaterThan(0);
      for (const token of searchArgv) {
        expect(typeof token).toBe("string");
      }
      // commandArgs.searchQuery(= marker) 가 searchArgv 안에 단일 원소로 보존됨(조립 round-trip).
      expect(searchArgv).toContain(commandArgs.searchQuery);
    });

    it("overallStatus 파생 — eval pass + collect skip → partial 로 조립되고 조립 체인이 throw 0 으로 완주한다", () => {
      const { report, searchArgv } = assemblePublishChain(
        { leg: "eval", action: "run", passed: true },
        { leg: "collect", action: "skip" },
        { ...RUN_REF },
      );
      expect(report.eval.status).toBe("pass");
      expect(report.collect.status).toBe("skip");
      expect(report.overallStatus).toBe("partial");
      expect(searchArgv.length).toBeGreaterThan(0);
    });
  });

  describe("branch — command-plan 의 create vs update 분기", () => {
    it("search stdout '[]'(후보 0건) → action.create + gh issue create argv(선두 토큰 issue create)", () => {
      const { commandArgs } = assemblePublishChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_REF },
      );

      const plan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        "[]",
        commandArgs,
      );

      expect(plan.action).toEqual({ action: "create" });
      // 선두 두 토큰이 gh issue create 경로.
      expect(plan.argv[0]).toBe("issue");
      expect(plan.argv[1]).toBe("create");
    });

    it("marker 포함 1+ hit stdout → action.update(최소 number) + gh issue edit argv(선두 토큰 issue edit)", () => {
      const { commandArgs } = assemblePublishChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_REF },
      );

      // 기존 이슈 body 에 marker(= searchQuery) 가 박혀있는 search 응답을 synthetic 하게 구성.
      const stdout = JSON.stringify([
        {
          number: 42,
          title: "기존 dual-leg run report 이슈",
          body: `${commandArgs.searchQuery}\n\n본문 일부`,
        },
      ]);

      const plan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        stdout,
        commandArgs,
      );

      expect(plan.action).toEqual({ action: "update", issueNumber: 42 });
      // 선두 두 토큰이 gh issue edit 경로 + 이슈 번호.
      expect(plan.argv[0]).toBe("issue");
      expect(plan.argv[1]).toBe("edit");
      expect(plan.argv[2]).toBe("42");
    });

    it("marker 포함 다수 hit → 최소 number 로 멱등 수렴(update issueNumber)", () => {
      const { commandArgs } = assemblePublishChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_REF },
      );

      const stdout = JSON.stringify([
        { number: 77, title: "새 이슈", body: commandArgs.searchQuery },
        { number: 13, title: "오래된 이슈", body: commandArgs.searchQuery },
      ]);

      const plan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        stdout,
        commandArgs,
      );

      expect(plan.action).toEqual({ action: "update", issueNumber: 13 });
      expect(plan.argv[1]).toBe("edit");
      expect(plan.argv[2]).toBe("13");
    });
  });

  describe("error / negative cases — 위임 guard 전파(분기마다 cover)", () => {
    it("(i) 빈 run.gitSha — 조립 체인 첫 단계(buildRealDataDailyStepDualLegRunReport)에서 throw(비식별 run 차단)", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReport(
          evalOutcome(),
          collectOutcome(),
          {
            gitSha: "",
            dateToken: RUN_REF.dateToken,
          },
        ),
      ).toThrow();
    });

    it("(i) 공백만의 run.gitSha — 조립 체인 첫 단계에서 throw", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReport(
          evalOutcome(),
          collectOutcome(),
          {
            gitSha: "   ",
            dateToken: RUN_REF.dateToken,
          },
        ),
      ).toThrow();
    });

    it("(ii) 빈 run.dateToken — 조립 체인 첫 단계에서 throw", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReport(
          evalOutcome(),
          collectOutcome(),
          {
            gitSha: RUN_REF.gitSha,
            dateToken: "",
          },
        ),
      ).toThrow();
    });

    it("(ii) 공백만의 run.dateToken — 조립 체인 첫 단계에서 throw", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReport(
          evalOutcome(),
          collectOutcome(),
          {
            gitSha: RUN_REF.gitSha,
            dateToken: "   ",
          },
        ),
      ).toThrow();
    });

    it("(iii) leg 라벨 cross-wiring(eval 자리에 collect outcome) — 첫 단계에서 throw + 후속 단계 미도달", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReport(
          { leg: "collect", action: "run", passed: true },
          collectOutcome(),
          { ...RUN_REF },
        ),
      ).toThrow();
    });

    it("(iii) leg 라벨 cross-wiring(collect 자리에 eval outcome) — 첫 단계에서 throw", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReport(
          evalOutcome(),
          { leg: "eval", action: "run", passed: true },
          { ...RUN_REF },
        ),
      ).toThrow();
    });

    it("(iv) command-plan 에 비-JSON stdout — 파서 throw 전파(SyntaxError)", () => {
      const { commandArgs } = assemblePublishChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_REF },
      );
      expect(() =>
        resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
          "not-json",
          commandArgs,
        ),
      ).toThrow();
    });

    it("(iv) command-plan 에 비배열 JSON stdout('{}') — 파서 throw 전파", () => {
      const { commandArgs } = assemblePublishChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_REF },
      );
      expect(() =>
        resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
          "{}",
          commandArgs,
        ),
      ).toThrow();
    });
  });

  describe("결정론·무공유 — 동일 (evalOutcome, collectOutcome, run) 두 번 조립", () => {
    it("(v) 두 조립 결과(report/descriptor/commandArgs/searchArgv)가 deep-equal 이면서 최상위·중첩 객체 참조가 공유되지 않는다(not.toBe)", () => {
      const a = assemblePublishChain(evalOutcome(), collectOutcome(), {
        ...RUN_REF,
      });
      const b = assemblePublishChain(evalOutcome(), collectOutcome(), {
        ...RUN_REF,
      });

      // 값은 deep-equal(결정론 — 입력만의 함수).
      expect(a.report).toEqual(b.report);
      expect(a.descriptor).toEqual(b.descriptor);
      expect(a.commandArgs).toEqual(b.commandArgs);
      expect(a.searchArgv).toEqual(b.searchArgv);

      // 참조는 무공유 — 최상위 + 중첩 객체 전부 새로 생성.
      expect(a.report).not.toBe(b.report);
      expect(a.report.eval).not.toBe(b.report.eval);
      expect(a.report.collect).not.toBe(b.report.collect);
      expect(a.descriptor).not.toBe(b.descriptor);
      expect(a.commandArgs).not.toBe(b.commandArgs);
      expect(a.commandArgs.createArgs).not.toBe(b.commandArgs.createArgs);
      expect(a.commandArgs.createArgs.labels).not.toBe(
        b.commandArgs.createArgs.labels,
      );
      expect(a.searchArgv).not.toBe(b.searchArgv);
    });

    it("(v) command-plan 도 동일 (stdout, commandArgs) 두 번 → deep-equal + argv 참조 무공유", () => {
      const { commandArgs } = assemblePublishChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_REF },
      );
      const p1 = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        "[]",
        commandArgs,
      );
      const p2 = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        "[]",
        commandArgs,
      );
      expect(p1).toEqual(p2);
      expect(p1).not.toBe(p2);
      expect(p1.argv).not.toBe(p2.argv);
    });
  });
});
