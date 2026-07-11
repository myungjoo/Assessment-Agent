// realdata-e2e-daily-step-dual-leg-run-report-publish-roundtrip.smoke-spec.ts —
// 실 평가 e2e daily-step dual-leg run report 이슈 publish round-trip(박제-후
// output-parse) 조립 체인 non-gated build-time smoke (T-0913 박제, PLAN.md 109행
// 🟢 실 평가 e2e step ④).
//
// 본 spec 의 존재 이유 — 박제-후(post-execution) output-parse leg 의 조립 smoke gap 해소:
//   - dual-leg run report 이슈 publish 축의 **박제-전(pre-execution) forward 조립**은
//     T-0912 로 닫혔다: report → descriptor → commandArgs → searchArgv +
//     resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(search stdout +
//     commandArgs → {action, argv}) 까지 build-time 조립·검증한다. 그러나 그
//     command-plan 이 실 `gh issue create` / `gh issue edit <n>` 을 실행한 뒤의
//     **박제-후 stdout 해석 leg** — parseRealDataDailyStepDualLegRunReportIssue
//     CreateEditOutput(stdout)(T-0903, → {issueNumber, url}) — 은 컴포저 unit spec +
//     self-wired consistency 가드(T-0904~T-0907)로는 닫혀 있으나 **어떤 조립 smoke 에도
//     참조되지 않았다**(git grep parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput
//     test/smoke/ = NONE).
//   - 이는 summary 축의 round-trip 비대칭이다 — summary 축은 forward leg(T-0742)와
//     post-execution outcome leg(T-0747)을 둘 다 non-gated smoke 로 닫아 박제-전·박제-후
//     양 끝을 봉했다. 본 spec 은 그 mirror 로 dual-leg run report 이슈 publish 의
//     **round-trip closure** 를 build-time 으로 박제한다: (1) report → descriptor →
//     commandArgs → command-plan(create/update 분기 → {action, argv}) 로 "이슈 박제 전
//     명령"을 합성하고, (2) 그 분기에 대응하는 synthetic `gh issue create` /
//     `gh issue edit` stdout 을 parse 로 해석해 {issueNumber, url} 을 산출한 뒤, (3) 두
//     끝의 issueNumber 정합(update 분기 → action.issueNumber == 파싱 issueNumber,
//     create 분기 → stdout URL 의 양수 issueNumber)·url trim·github host·`/pull/` 오매칭
//     reject 를 조립 레벨에서 단언한다.
//   - 본 spec 은 forward T-0912 와 **직교**하다(별개 절단면 = 박제-후). 따라서 본 spec 은:
//
//      🔥 실 LLM 호출 0 — orchestrator / scoring service / gateway 미사용. synthetic
//         leg outcome / stdout literal 을 조립 체인에 직접 공급(실 평가·수집·jest spawn 0).
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 gh 실행 0 — search / issue create / issue edit 실 실행 0. execFile('gh', …) 0.
//         command-plan argv 합성 + synthetic stdout 파싱만 검증(execFile 배선 0 — deferred,
//         ADR-0045 credential gate).
//      🔥 credential 0 / secret 0 / DB 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 build*/resolve*/parse* 컴포저 import 재사용만
//         (consistency-guard·helper 신설 금지 — value-consistency sweep 종결, T-0911).
//      🔥 gating / describe.skip / env-gating 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0913):
//   - 박제-전 forward 조립 smoke(realdata-e2e-daily-step-dual-leg-run-report-publish-
//     assembly.smoke-spec.ts, T-0912) 재검증·수정 — 본 task 는 박제-후 output-parse
//     round-trip 절단면만(별개 파일, file-disjoint).
//   - 기존 dual-leg convergence smoke(eval↔collect 수렴 축) 파일 수정 — file-disjoint.
//   - 새 컴포저 / consistency 가드 / helper 신설 — 기존 helper import·호출만.
//   - dual-leg 축 컴포저·파서 소스(test/helpers/realdata-e2e-daily-step-dual-leg-run-
//     report*.ts) 수정 — read-only 검증 대상.
//   - 실 LLM round-trip / 실 github 수집 / 실 gh issue create·edit 실행 / execFile('gh',
//     argv) / env-gated live 실행 leg(§109 step④ daily-test bash 배선 후속 책임).
//   - production src/ 코드 / package.json / lockfile / test/jest-smoke.json 변경.
import {
  buildRealDataDailyStepDualLegRunReport,
  type RealDataDailyStepLegRunOutcome,
} from "../helpers/realdata-e2e-daily-step-dual-leg-run-report";
import { buildRealDataDailyStepDualLegRunReportIssueCommandArgs } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
import { buildRealDataDailyStepDualLegRunReportIssueDescriptor } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor";
import { resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan";
import { parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse";
import type { RealDataResultIssueRunRef } from "../helpers/realdata-e2e-result-issue-descriptor";

// 결정론 run 식별자 fixture — gitSha + dateToken 비공백 안정 토큰. 매 it 가 spread
// 복제로 받아 입력 mutate 누설 0. token/secret/raw narrative 어휘 미포함(credential
// 누출 0 단언의 fixture 전제).
const RUN_REF: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-07-11",
};

// synthetic leg outcome fixture — eval / collect 각 leg 의 run outcome literal. 조립
// 체인은 leg outcome 을 report → descriptor → commandArgs 로 흘려보내는 surface 만
// 검증하므로 도메인 타입 정합만 만족하는 minimal literal 로 충분하다(실 jest spawn 0).
function evalOutcome(): RealDataDailyStepLegRunOutcome {
  return { leg: "eval", action: "run", passed: true };
}

function collectOutcome(): RealDataDailyStepLegRunOutcome {
  return { leg: "collect", action: "run", passed: true };
}

// forward 조립 helper — 유효 두 leg outcome + run 을 report → descriptor → commandArgs
// 로 통과시켜 commandArgs 를 산출한다(박제-전 명령 합성 진입점). 각 it 가 이 commandArgs
// 로 command-plan 을 분기 합성한다(중복 조립 코드 제거).
function commandArgsOf(
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
  return buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor);
}

// marker 를 body 에 포함한 synthetic search stdout(1+ hit) — update 분기 유도. gh
// search issues --json number,title,body 응답을 흉내낸 literal.
function searchHitStdout(marker: string, ...numbers: number[]): string {
  return JSON.stringify(
    numbers.map((n) => ({
      number: n,
      title: `기존 dual-leg run report 이슈 #${n}`,
      body: `${marker}\n\n본문 일부`,
    })),
  );
}

// synthetic gh issue create/edit stdout — 지정 이슈 번호의 유효 issue URL 한 줄(trailing
// 개행 포함). 실 gh round-trip 없이 파서에 직접 주입한다.
function issueUrlStdout(n: number): string {
  return `https://github.com/myungjoo/assessment-agent/issues/${n}\n`;
}

function issueUrl(n: number): string {
  return `https://github.com/myungjoo/assessment-agent/issues/${n}`;
}

describe("Smoke(non-gated): 실 평가 e2e dual-leg run report 이슈 publish round-trip(report→command-plan→create/edit stdout→output-parse) live-gh 0 검증", () => {
  describe("happy path — create 분기 round-trip 산출", () => {
    it("marker 미포함 search stdout('[]') → action.create + gh issue create argv → create stdout 파싱 outcome 이 {issueNumber, url} 2필드를 정확히 보유하고 issueNumber=URL 양수 번호·url=trim 매칭 URL", () => {
      const commandArgs = commandArgsOf(evalOutcome(), collectOutcome(), {
        ...RUN_REF,
      });

      // 박제-전: 후보 0건 → create 분기.
      const plan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        "[]",
        commandArgs,
      );
      expect(plan.action).toEqual({ action: "create" });
      expect(plan.argv[0]).toBe("issue");
      expect(plan.argv[1]).toBe("create");

      // 박제-후: create 를 흉내낸 stdout 파싱 → outcome.
      const outcome =
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          issueUrlStdout(42),
        );

      // outcome 이 2필드를 정확히 보유(raw 미저장 — issueNumber/url 만).
      expect(Object.keys(outcome).sort()).toEqual(["issueNumber", "url"]);
      expect(outcome.issueNumber).toBe(42);
      expect(outcome.url).toBe(issueUrl(42));
      expect(typeof outcome.issueNumber).toBe("number");
      expect(typeof outcome.url).toBe("string");
    });
  });

  describe("branch — command-plan 의 create vs update 분기별 round-trip 정합", () => {
    it("(i) create 분기 — search stdout '[]' → action.create + argv 선두 토큰 'issue create', create stdout 파싱 outcome 정합", () => {
      const commandArgs = commandArgsOf(evalOutcome(), collectOutcome(), {
        ...RUN_REF,
      });

      const plan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        "[]",
        commandArgs,
      );
      expect(plan.action).toEqual({ action: "create" });
      expect(plan.argv[0]).toBe("issue");
      expect(plan.argv[1]).toBe("create");

      const outcome =
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          issueUrlStdout(101),
        );
      expect(outcome.issueNumber).toBe(101);
      expect(outcome.url).toBe(issueUrl(101));
    });

    it("(ii) update 분기 — marker 포함 1+ hit → action.update(최소 number N) + argv 선두 토큰 'issue edit N', N 대응 edit stdout(/issues/N) 파싱 outcome.issueNumber === action.issueNumber(round-trip 정합)", () => {
      const commandArgs = commandArgsOf(evalOutcome(), collectOutcome(), {
        ...RUN_REF,
      });

      const plan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        searchHitStdout(commandArgs.searchQuery, 42),
        commandArgs,
      );
      expect(plan.action).toEqual({ action: "update", issueNumber: 42 });
      expect(plan.argv[0]).toBe("issue");
      expect(plan.argv[1]).toBe("edit");
      expect(plan.argv[2]).toBe("42");

      // 박제-후: 그 N(42) 을 갱신한 gh issue edit stdout 파싱 → round-trip 정합.
      const outcome =
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          issueUrlStdout(42),
        );
      // action 은 discriminated union — update 분기임을 좁힌 뒤 issueNumber 대조.
      expect(plan.action.action).toBe("update");
      if (plan.action.action === "update") {
        expect(outcome.issueNumber).toBe(plan.action.issueNumber);
      }
    });

    it("(ii) update 분기 다수 hit — 최소 number 로 멱등 수렴, 그 최소 번호 edit stdout 파싱 outcome 과 round-trip 정합", () => {
      const commandArgs = commandArgsOf(evalOutcome(), collectOutcome(), {
        ...RUN_REF,
      });

      const plan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        searchHitStdout(commandArgs.searchQuery, 77, 13),
        commandArgs,
      );
      expect(plan.action).toEqual({ action: "update", issueNumber: 13 });
      expect(plan.argv[2]).toBe("13");

      const outcome =
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          issueUrlStdout(13),
        );
      if (plan.action.action === "update") {
        expect(outcome.issueNumber).toBe(plan.action.issueNumber);
      }
    });
  });

  describe("error path — parse / forward guard throw 가 조립 경로로 그대로 전파(자체 try/catch 0)", () => {
    it("(a-i) create/edit stdout 에 issue URL 미발견(빈 문자열) → parse throw 전파", () => {
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(""),
      ).toThrow();
    });

    it("(a-ii) 공백만 stdout → parse throw 전파", () => {
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput("   \n  "),
      ).toThrow();
    });

    it("(a-iii) 무관 텍스트 stdout → parse throw 전파", () => {
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          "no url here at all\n",
        ),
      ).toThrow();
    });

    it("(a-iv) 비-github 호스트 URL stdout → parse throw 전파", () => {
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          "https://gitlab.com/myungjoo/assessment-agent/issues/42\n",
        ),
      ).toThrow();
    });

    it("(a-v) /pull/ PR URL stdout → parse throw 전파(issue 경로 아님)", () => {
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          "https://github.com/myungjoo/assessment-agent/pull/42\n",
        ),
      ).toThrow();
    });

    it("(b-i) issueNumber 0(/issues/0) → parse throw 전파(양의 정수 아님)", () => {
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          issueUrlStdout(0),
        ),
      ).toThrow();
    });

    it("(b-ii) issueNumber 선행0(007) → parse throw 전파", () => {
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          "https://github.com/myungjoo/assessment-agent/issues/007\n",
        ),
      ).toThrow();
    });

    it("(b-iii) issueNumber 비정수(abc) → parse throw 전파", () => {
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          "https://github.com/myungjoo/assessment-agent/issues/abc\n",
        ),
      ).toThrow();
    });

    it("(c-i) forward 측 run.gitSha 빈 문자열 → report 합성 throw 로 command-plan 미도달", () => {
      expect(() =>
        commandArgsOf(evalOutcome(), collectOutcome(), {
          gitSha: "",
          dateToken: RUN_REF.dateToken,
        }),
      ).toThrow();
    });

    it("(c-ii) forward 측 run.dateToken 공백만 → report 합성 throw 로 command-plan 미도달", () => {
      expect(() =>
        commandArgsOf(evalOutcome(), collectOutcome(), {
          gitSha: RUN_REF.gitSha,
          dateToken: "   ",
        }),
      ).toThrow();
    });
  });

  describe("negative cases — 분기마다 예외 상황 cover(단일 negative 금지)", () => {
    it("(i) create stdout URL 미발견 throw — create 분기 산출 후에도 박제-후 파싱이 조용히 통과하지 않는다", () => {
      const commandArgs = commandArgsOf(evalOutcome(), collectOutcome(), {
        ...RUN_REF,
      });
      const plan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        "[]",
        commandArgs,
      );
      expect(plan.action).toEqual({ action: "create" });
      // 명령은 정상 산출됐지만 create stdout 이 손상되면 파싱이 throw(조용한 통과 차단).
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          "gh: 이슈 생성 실패(네트워크 오류)\n",
        ),
      ).toThrow();
    });

    it("(ii) update stdout issueNumber 비양수(/issues/0) throw — update 분기 산출 후에도 박제-후 파싱이 조용히 통과하지 않는다", () => {
      const commandArgs = commandArgsOf(evalOutcome(), collectOutcome(), {
        ...RUN_REF,
      });
      const plan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        searchHitStdout(commandArgs.searchQuery, 42),
        commandArgs,
      );
      expect(plan.action).toEqual({ action: "update", issueNumber: 42 });
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          issueUrlStdout(0),
        ),
      ).toThrow();
    });

    it("(iii) update 분기에서 stdout 의 /issues/M(M≠action.issueNumber) 이면 round-trip 정합이 불일치를 드러낸다(의도적 mismatch fixture = 회귀 감지 그물)", () => {
      const commandArgs = commandArgsOf(evalOutcome(), collectOutcome(), {
        ...RUN_REF,
      });
      const plan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        searchHitStdout(commandArgs.searchQuery, 42),
        commandArgs,
      );
      // 의도적으로 다른 번호(99)의 stdout 을 파싱 — round-trip 정합 단언이 mismatch 를 드러냄.
      const wrongOutcome =
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          issueUrlStdout(99),
        );
      if (plan.action.action === "update") {
        expect(wrongOutcome.issueNumber).not.toBe(plan.action.issueNumber);
      }
    });

    it("(iv) 비-github 호스트/`/pull/` 오매칭 reject — 두 케이스 모두 parse throw", () => {
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          "https://example.com/myungjoo/assessment-agent/issues/42\n",
        ),
      ).toThrow();
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          "https://github.com/myungjoo/assessment-agent/pull/7\n",
        ),
      ).toThrow();
    });

    it("(v) 동일 (report 입력, search stdout, create/edit stdout) 2회 round-trip → 산출 deep-equal + 참조 무공유", () => {
      const commandArgsA = commandArgsOf(evalOutcome(), collectOutcome(), {
        ...RUN_REF,
      });
      const commandArgsB = commandArgsOf(evalOutcome(), collectOutcome(), {
        ...RUN_REF,
      });

      const planA = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        "[]",
        commandArgsA,
      );
      const planB = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        "[]",
        commandArgsB,
      );
      const outcomeA =
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          issueUrlStdout(42),
        );
      const outcomeB =
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          issueUrlStdout(42),
        );

      // 값 deep-equal(결정론 — 입력만의 함수).
      expect(planA).toEqual(planB);
      expect(outcomeA).toEqual(outcomeB);
      // 참조 무공유.
      expect(planA).not.toBe(planB);
      expect(planA.argv).not.toBe(planB.argv);
      expect(outcomeA).not.toBe(outcomeB);
    });
  });

  describe("결정론 · 무공유 · no-mutation — 동일 입력 두 번 round-trip + 입력 불변", () => {
    it("두 round-trip 조립 결과(command-plan {action, argv} + output-parse {issueNumber, url})가 deep-equal 이면서 최상위·중첩(argv) 참조가 공유되지 않는다", () => {
      const commandArgs = commandArgsOf(evalOutcome(), collectOutcome(), {
        ...RUN_REF,
      });

      const plan1 = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        searchHitStdout(commandArgs.searchQuery, 42),
        commandArgs,
      );
      const plan2 = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        searchHitStdout(commandArgs.searchQuery, 42),
        commandArgs,
      );
      const outcome1 =
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          issueUrlStdout(42),
        );
      const outcome2 =
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          issueUrlStdout(42),
        );

      expect(plan1).toEqual(plan2);
      expect(outcome1).toEqual(outcome2);
      expect(plan1).not.toBe(plan2);
      expect(plan1.argv).not.toBe(plan2.argv);
      expect(plan1.action).not.toBe(plan2.action);
      expect(outcome1).not.toBe(outcome2);
    });

    it("no-mutation — 입력 run/commandArgs literal 이 round-trip 조립 전후 mutate 0(deep-equal)", () => {
      const run: RealDataResultIssueRunRef = { ...RUN_REF };
      const runBefore = JSON.parse(JSON.stringify(run));

      const commandArgs = commandArgsOf(evalOutcome(), collectOutcome(), run);
      const argsBefore = JSON.parse(JSON.stringify(commandArgs));

      resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        searchHitStdout(commandArgs.searchQuery, 42),
        commandArgs,
      );
      parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
        issueUrlStdout(42),
      );

      expect(run).toEqual(runBefore);
      expect(commandArgs).toEqual(argsBefore);
    });
  });

  describe("raw 누출 0 — outcome/argv 에 token/secret/raw narrative 미포함(R-59/REQ-059)", () => {
    it("산출 outcome(issueNumber/url) 및 command-plan argv 에 안정 식별 토큰만 존재(비밀·raw narrative 패턴 미포함)", () => {
      const commandArgs = commandArgsOf(evalOutcome(), collectOutcome(), {
        ...RUN_REF,
      });
      const plan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        searchHitStdout(commandArgs.searchQuery, 42),
        commandArgs,
      );
      const outcome =
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          issueUrlStdout(42),
        );

      const joined = [
        String(outcome.issueNumber),
        outcome.url,
        ...plan.argv,
      ].join(" ");

      expect(joined).not.toContain("--token");
      expect(joined).not.toContain("GITHUB_TOKEN");
      expect(joined).not.toMatch(/ghp_[A-Za-z0-9]/);
      expect(joined).not.toContain("narrative");
    });
  });
});
