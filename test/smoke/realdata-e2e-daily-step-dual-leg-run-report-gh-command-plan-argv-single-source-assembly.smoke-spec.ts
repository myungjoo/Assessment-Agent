// realdata-e2e-daily-step-dual-leg-run-report-gh-command-plan-argv-single-source-
// assembly.smoke-spec.ts — 실 평가 e2e daily-step dual-leg run report chain 의 종단
// gh-command-plan 컴포저 seam(산출 plan.argv ↔ single-source gh-argv 빌더 산출
// byte-identical 정합 + plan.action 재유도 일치)을 create/update 두 분기 모두 묶은
// gh-command-plan argv single-source assembly non-gated build-time smoke (T-0927 박제,
// PLAN.md 109행 🟢 실 평가 e2e step ④).
//
// 본 spec 의 존재 이유 — gh-command-plan argv single-source assembly gap 해소:
//   - step ④(daily-test dual-leg run 결과 rolling-issue 멱등 박제)의 종단 컴포저
//     `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(stdout, commandArgs)`
//     (T-0902)은 search stdout + 명령-args 묶음을 입력받아 실 `execFile('gh', argv)` 에
//     넘길 `{action, argv}` 종단 plan 을 산출한다. 그 `argv` 는 내부적으로
//     `buildRealDataDailyStepDualLegRunReportIssueGhArgv(action, commandArgs)`(T-0899)를
//     위임 호출해 얻는다 — create 분기(`["issue","create","--title",title,"--body",body,
//     ...labels 각 원소 "--label",<label> flag-pair 순서 보존 전개]`)와 update 분기
//     (`["issue","edit",String(issueNumber),"--title",title,"--body",body]`).
//   - 그러나 이 execute-side gh-argv 빌더(T-0899)를 **직접 참조하는 smoke 는 0개**이며
//     (`git grep -l buildRealDataDailyStepDualLegRunReportIssueGhArgv test/smoke/*` = 0),
//     dual-leg 축에는 **gh-command-plan-assembly smoke 자체가 부재**였다(summary 축은
//     `realdata-e2e-result-issue-gh-command-plan-assembly.smoke-spec.ts` 로 자기 gh-argv
//     빌더를 직접 봉합했으나 dual-leg 축은 그 mirror 미커버). 즉 종단 컴포저가 silent 하게
//     create argv 원소를 drift 시키거나 labels flag-pair 순서를 뒤집거나 issueNumber 를
//     오문자열화하거나 argv 원소를 누락/재정렬해도, 그 손상 plan 이 실 `execFile('gh', argv)`
//     live wiring 으로 새기 전에 build-time smoke 로 잡히지 않았다(plan.argv 를 single-source
//     빌더 산출과 대조하는 단언이 어느 smoke 에도 없으므로).
//   - 형제 T-0920(execute-side edit-argv)은 **update 분기 `plan.argv[2]===String(N)` 한
//     원소** 만 자산화하고 **create 분기 argv(gh issue create + labels flag-pair 전개) 전체
//     벡터** 는 어느 smoke 도 자산화하지 않았다. 본 spec 은 그 대칭면으로, chain 을 통과한
//     search stdout + commandArgs 를 컴포저로 통과시켜 산출 plan.argv 를
//     `buildRealDataDailyStepDualLegRunReportIssueGhArgv(plan.action, commandArgs)`(컴포저
//     재호출 없이 빌더 직접 호출) 산출과 create/update **두 분기 모두 byte-identical**(원소·
//     순서·labels flag-pair 전개·issueNumber 문자열화)로 대조하고 plan.action 이 hits 로부터
//     재유도한 action(빈→create·1+→최소 number update)과 일치함을 박제한다 — summary 축
//     gh-command-plan-assembly smoke 의 dual-leg mirror. 따라서 본 spec 은:
//
//      🔥 실 gh 호출 0 — gh search / issue create / issue edit / execFile('gh', argv) 미실행.
//         synthetic leg outcome / run / search stdout literal 을 조립 체인에 직접 공급.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 LLM 호출 0 / 실 DB 접근 0 / 실 jest spawn 0 — chain→plan.argv 조립만.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//         산출 plan.argv 에 token/secret 어휘(--token/GITHUB_TOKEN/GH_TOKEN/ghp_) 미포함 검증.
//      🔥 새 외부 dependency 0 — 기존 build*/resolve*/parse* 컴포저 import 재사용만
//         (컴포저·빌더·interface 본문 변경 0, 재배선 0 — T-0902 배선 재사용).
//      🔥 gating / describe.skip / env-gating 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0927):
//   - 형제 T-0920 의 edit-argv execute-side `plan.argv[2]===String(N)` 한 원소 축 재단언 —
//     본 spec 은 create/update 두 분기 argv 전체 벡터의 single-source 빌더 byte-identical 축.
//   - 형제 T-0919 의 search-argv marker-as-argv-element 축 재단언.
//   - 형제 T-0924/T-0925/T-0926 의 value-consistency 3-seam(output↔stdout·search hits↔
//     stdout·report↔input) 자체 재단언 — 본 spec 은 종단 gh-command-plan 산출 argv ↔ 빌더
//     단일 축.
//   - 파서/resolver/descriptor/command-args/gh-argv 빌더/gh-command-plan 컴포저 본문·형식
//     규약 재단언 — 각 가드/smoke 이미 cover. import·호출만.
//   - 실 gh search·create·edit / execFile('gh', argv) 실 실행 / 실 jest spawn / DB /
//     네트워크 / 실 git sha·timestamp 읽기 — synthetic literal 만(step ④ live wiring 은
//     credential gate deferred).
//   - 새 컴포저 / consistency 가드 / helper / type 신설 — 기존 helper import·호출만.
//   - production src/ 코드 / package.json / lockfile / test/jest-smoke.json 변경.
import {
  buildRealDataDailyStepDualLegRunReport,
  type RealDataDailyStepLegRunOutcome,
} from "../helpers/realdata-e2e-daily-step-dual-leg-run-report";
import { resolveRealDataDailyStepDualLegRunReportIssueAction } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action";
import { buildRealDataDailyStepDualLegRunReportIssueCommandArgs } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
import type { RealDataDailyStepDualLegRunReportIssueCommandArgs } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
import { buildRealDataDailyStepDualLegRunReportIssueDescriptor } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor";
import { buildRealDataDailyStepDualLegRunReportIssueGhArgv } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv";
import { resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan";
import { parseRealDataDailyStepDualLegRunReportIssueSearchOutput } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse";
import type { RealDataResultIssueRunRef } from "../helpers/realdata-e2e-result-issue-descriptor";

// 결정론 run 식별자 fixture — gitSha + dateToken 비공백 안정 토큰. 매 it 가 spread 복제로
// 받아 입력 mutate 누설 0. token/secret/raw narrative 어휘 미포함(credential 누출 0 전제).
const RUN_A: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-07-11",
};

// 서로 다른 run — gitSha·dateToken 이 RUN_A 와 substring 이 아닌 구별 값(marker 로만 변별).
const RUN_B: RealDataResultIssueRunRef = {
  gitSha: "def5678",
  dateToken: "2026-08-24",
};

// 후보 0건 search stdout — gh search 가 매칭 이슈를 못 찾은 빈 배열. create 분기 유발.
const EMPTY_STDOUT = "[]";

// synthetic leg outcome fixture — eval / collect 각 leg 의 run outcome literal. 조립 체인은
// leg outcome 을 report → descriptor 로 흘려보내는 surface 만 검증하므로 도메인 타입 정합만
// 만족하는 minimal literal 로 충분하다(실 jest spawn 0).
function evalOutcome(): RealDataDailyStepLegRunOutcome {
  return { leg: "eval", action: "run", passed: true };
}

function collectOutcome(): RealDataDailyStepLegRunOutcome {
  return { leg: "collect", action: "run", passed: true };
}

// chain 산출 commandArgs 진입점 — 단일 source(run + 두 leg outcome)로부터
// report → descriptor → commandArgs 를 관통시켜 유효 commandArgs 를 얻는다. 컴포저의 두
// 번째 인자(진실의 원천). 각 stage guard throw 는 자체 try/catch 없이 그대로 전파된다.
function assembleCommandArgs(
  evalLeg: RealDataDailyStepLegRunOutcome,
  collectLeg: RealDataDailyStepLegRunOutcome,
  run: RealDataResultIssueRunRef,
): RealDataDailyStepDualLegRunReportIssueCommandArgs {
  const report = buildRealDataDailyStepDualLegRunReport(
    evalLeg,
    collectLeg,
    run,
  );
  const descriptor =
    buildRealDataDailyStepDualLegRunReportIssueDescriptor(report);
  return buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor);
}

// marker 를 body 에 담은 synthetic search stdout(1+ hit) — update 분기 유도. gh search
// issues --json number,title,body 응답을 흉내낸 literal. number=N 이 search-hit 단일 source.
function searchHitStdout(marker: string, ...numbers: number[]): string {
  return JSON.stringify(
    numbers.map((n) => ({
      number: n,
      title: `기존 dual-leg run report 이슈 #${n}`,
      body: `${marker}\n\n본문 일부`,
    })),
  );
}

// 표준 create 분기 chain — 유효 commandArgs + 후보 0건 stdout 으로 컴포저를 통과시켜 plan 산출.
function planForCreate(run: RealDataResultIssueRunRef) {
  const commandArgs = assembleCommandArgs(evalOutcome(), collectOutcome(), run);
  const plan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
    EMPTY_STDOUT,
    commandArgs,
  );
  return { commandArgs, plan };
}

// 표준 update 분기 chain — 유효 commandArgs + marker 포함 search stdout 으로 plan 산출.
function planForUpdate(run: RealDataResultIssueRunRef, ...numbers: number[]) {
  const commandArgs = assembleCommandArgs(evalOutcome(), collectOutcome(), run);
  const stdout = searchHitStdout(commandArgs.searchQuery, ...numbers);
  const plan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
    stdout,
    commandArgs,
  );
  return { commandArgs, stdout, plan };
}

describe("Smoke(non-gated): dual-leg run report gh-command-plan argv single-source assembly(plan.argv ↔ gh-argv 빌더 byte-identical) live-gh 0 검증", () => {
  describe("happy path — create 분기 argv single-source(gh issue create + labels flag-pair 전개)", () => {
    it("후보 0건 stdout('[]') → plan.action.action === 'create' AND plan.argv 가 buildGhArgv(plan.action, commandArgs) 직접 호출 산출과 byte-identical(toEqual)", () => {
      const { commandArgs, plan } = planForCreate({ ...RUN_A });

      expect(plan.action).toEqual({ action: "create" });
      // 컴포저 재호출 없이 빌더 직접 호출 — 진실의 원천과 byte-identical.
      expect(plan.argv).toEqual(
        buildRealDataDailyStepDualLegRunReportIssueGhArgv(
          plan.action,
          commandArgs,
        ),
      );
    });

    it("create plan.argv 선두 토큰 shape — [0]==='issue', [1]==='create', --title/--body flag-pair 보유", () => {
      const { plan } = planForCreate({ ...RUN_A });

      expect(plan.argv[0]).toBe("issue");
      expect(plan.argv[1]).toBe("create");
      expect(plan.argv).toContain("--title");
      expect(plan.argv).toContain("--body");
      expect(plan.argv).not.toContain("edit");
    });

    it("create plan.argv 의 labels 각 원소가 '--label',<label> flag-pair 로 순서 보존 전개(commandArgs.createArgs.labels 정합)", () => {
      const { commandArgs, plan } = planForCreate({ ...RUN_A });
      const labels = commandArgs.createArgs.labels;

      // 각 label 앞에 '--label' flag 가 pair 로, label 순서를 보존해 등장한다.
      for (const label of labels) {
        const flagIndex = plan.argv.indexOf(label) - 1;
        expect(plan.argv[flagIndex]).toBe("--label");
      }
      // labels flag-pair 를 전개한 tail 이 순서 보존됨(첫 label 이 두 번째 label 보다 앞).
      const firstLabelIdx = plan.argv.indexOf(labels[0]);
      const secondLabelIdx = plan.argv.indexOf(labels[1]);
      expect(firstLabelIdx).toBeGreaterThan(-1);
      expect(secondLabelIdx).toBeGreaterThan(firstLabelIdx);
    });
  });

  describe("happy path — update 분기 argv single-source(gh issue edit String(issueNumber))", () => {
    it("marker 포함 단일 hit(number N) → plan.action.action === 'update' AND plan.action.issueNumber === N AND plan.argv 가 buildGhArgv(plan.action, commandArgs)와 byte-identical", () => {
      const N = 137;
      const { commandArgs, plan } = planForUpdate({ ...RUN_A }, N);

      expect(plan.action).toEqual({ action: "update", issueNumber: N });
      expect(plan.argv).toEqual(
        buildRealDataDailyStepDualLegRunReportIssueGhArgv(
          plan.action,
          commandArgs,
        ),
      );
    });

    it("update plan.argv shape — [0]==='issue', [1]==='edit', [2]===String(N)(issueNumber 문자열화)", () => {
      const N = 42;
      const { plan } = planForUpdate({ ...RUN_A }, N);

      expect(plan.argv[0]).toBe("issue");
      expect(plan.argv[1]).toBe("edit");
      expect(plan.argv[2]).toBe(String(N));
      expect(plan.argv).toContain("--title");
      expect(plan.argv).toContain("--body");
      // update argv 는 labels 를 포함하지 않는다(create 전용).
      expect(plan.argv).not.toContain("--label");
    });

    it("multi-hit(정렬 안 된 33,7,19) → plan.action.issueNumber === 최소 number(7) AND plan.argv[2]==='7' AND 빌더 산출과 byte-identical", () => {
      const { commandArgs, plan } = planForUpdate({ ...RUN_A }, 33, 7, 19);

      expect(plan.action).toEqual({ action: "update", issueNumber: 7 });
      expect(plan.argv[2]).toBe("7");
      expect(plan.argv).toEqual(
        buildRealDataDailyStepDualLegRunReportIssueGhArgv(
          plan.action,
          commandArgs,
        ),
      );
    });
  });

  describe("plan.action 재유도 일치 — hits → action single-source(3 케이스)", () => {
    it("(i) 빈 search('[]') → plan.action 이 resolveAction(parse(stdout), searchQuery)와 deep-equal(create) AND plan.argv 가 빌더 산출과 byte-identical", () => {
      const { commandArgs, plan } = planForCreate({ ...RUN_A });
      const rederivedAction =
        resolveRealDataDailyStepDualLegRunReportIssueAction(
          parseRealDataDailyStepDualLegRunReportIssueSearchOutput(EMPTY_STDOUT),
          commandArgs.searchQuery,
        );

      expect(plan.action).toEqual(rederivedAction);
      expect(plan.argv).toEqual(
        buildRealDataDailyStepDualLegRunReportIssueGhArgv(
          rederivedAction,
          commandArgs,
        ),
      );
    });

    it("(ii) 단일 hit(number N1) → plan.action.issueNumber === N1 AND 재유도 action deep-equal AND argv byte-identical", () => {
      const N1 = 91;
      const { commandArgs, stdout, plan } = planForUpdate({ ...RUN_A }, N1);
      const rederivedAction =
        resolveRealDataDailyStepDualLegRunReportIssueAction(
          parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout),
          commandArgs.searchQuery,
        );

      expect(plan.action).toEqual({ action: "update", issueNumber: N1 });
      expect(plan.action).toEqual(rederivedAction);
      expect(plan.argv).toEqual(
        buildRealDataDailyStepDualLegRunReportIssueGhArgv(
          rederivedAction,
          commandArgs,
        ),
      );
    });

    it("(iii) multi-hit(N2<N1: 12, 88) → plan.action.issueNumber === min(12,88) AND 재유도 action deep-equal AND argv byte-identical(최소 number 멱등)", () => {
      const { commandArgs, stdout, plan } = planForUpdate({ ...RUN_A }, 88, 12);
      const rederivedAction =
        resolveRealDataDailyStepDualLegRunReportIssueAction(
          parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout),
          commandArgs.searchQuery,
        );

      expect(plan.action).toEqual({ action: "update", issueNumber: 12 });
      expect(plan.action).toEqual(rederivedAction);
      expect(plan.argv).toEqual(
        buildRealDataDailyStepDualLegRunReportIssueGhArgv(
          rederivedAction,
          commandArgs,
        ),
      );
    });
  });

  describe("single-source 독립 재유도 — plan.argv 가 파서→resolver→빌더 규약 파생 argv 와 deep-equal", () => {
    it("동일 (stdout, commandArgs)에서 컴포저 재호출 없이 parse→resolveAction→buildGhArgv 3-위임 직접 재유도한 expected argv 와 plan.argv deep-equal(create 분기)", () => {
      const commandArgs = assembleCommandArgs(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      const plan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        EMPTY_STDOUT,
        commandArgs,
      );

      const directAction = resolveRealDataDailyStepDualLegRunReportIssueAction(
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput(EMPTY_STDOUT),
        commandArgs.searchQuery,
      );
      const directArgv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
        directAction,
        commandArgs,
      );

      expect(plan.action).toEqual(directAction);
      expect(plan.argv).toEqual(directArgv);
    });

    it("동일 (stdout, commandArgs)에서 3-위임 직접 재유도한 expected argv 와 plan.argv deep-equal(update 분기)", () => {
      const commandArgs = assembleCommandArgs(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      const stdout = searchHitStdout(commandArgs.searchQuery, 7);
      const plan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        stdout,
        commandArgs,
      );

      const directAction = resolveRealDataDailyStepDualLegRunReportIssueAction(
        parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout),
        commandArgs.searchQuery,
      );
      const directArgv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(
        directAction,
        commandArgs,
      );

      expect(plan.action).toEqual(directAction);
      expect(plan.argv).toEqual(directArgv);
    });
  });

  describe("negative cases — argv drift 검출(byte-identical 위반)", () => {
    it("(a-i) create argv 원소 drift — title 값 변형 synthetic argv 가 빌더 직접 호출 산출과 not.toEqual", () => {
      const { commandArgs, plan } = planForCreate({ ...RUN_A });
      // plan.argv 복제 후 title 원소(--title 다음)를 변형.
      const mutated = [...plan.argv];
      const titleIdx = mutated.indexOf("--title") + 1;
      mutated[titleIdx] = `${mutated[titleIdx]}-DRIFT`;

      expect(mutated).not.toEqual(
        buildRealDataDailyStepDualLegRunReportIssueGhArgv(
          plan.action,
          commandArgs,
        ),
      );
    });

    it("(a-ii) create argv labels flag-pair 순서 뒤집힘 drift — 두 label 을 swap 한 synthetic argv 가 빌더 산출과 not.toEqual", () => {
      const { commandArgs, plan } = planForCreate({ ...RUN_A });
      const labels = commandArgs.createArgs.labels;
      const mutated = [...plan.argv];
      const firstIdx = mutated.indexOf(labels[0]);
      const secondIdx = mutated.indexOf(labels[1]);
      // 두 label 값을 swap(flag-pair 순서 뒤집힘) — 빌더는 원 순서를 보존하므로 불일치.
      [mutated[firstIdx], mutated[secondIdx]] = [
        mutated[secondIdx],
        mutated[firstIdx],
      ];

      expect(mutated).not.toEqual(
        buildRealDataDailyStepDualLegRunReportIssueGhArgv(
          plan.action,
          commandArgs,
        ),
      );
    });

    it("(a-iii) create argv 원소 누락 drift — 마지막 원소를 제거한 synthetic argv 가 빌더 산출과 not.toEqual", () => {
      const { commandArgs, plan } = planForCreate({ ...RUN_A });
      const mutated = plan.argv.slice(0, plan.argv.length - 1);

      expect(mutated).not.toEqual(
        buildRealDataDailyStepDualLegRunReportIssueGhArgv(
          plan.action,
          commandArgs,
        ),
      );
    });

    it("(b-i) update argv issueNumber 문자열화 drift — argv[2] 를 String(N+1)로 변형한 synthetic argv 가 빌더 산출과 not.toEqual", () => {
      const N = 50;
      const { commandArgs, plan } = planForUpdate({ ...RUN_A }, N);
      const mutated = [...plan.argv];
      mutated[2] = String(N + 1);

      expect(mutated).not.toEqual(
        buildRealDataDailyStepDualLegRunReportIssueGhArgv(
          plan.action,
          commandArgs,
        ),
      );
    });

    it("(b-ii) update argv issueNumber 오문자열화(number 형) drift — argv[2] 를 number N(비문자열)로 변형 → 빌더 산출(string)과 not.toEqual", () => {
      const N = 50;
      const { commandArgs, plan } = planForUpdate({ ...RUN_A }, N);
      const mutated: unknown[] = [...plan.argv];
      mutated[2] = N; // String 화 누락 — number 원소.

      expect(mutated).not.toEqual(
        buildRealDataDailyStepDualLegRunReportIssueGhArgv(
          plan.action,
          commandArgs,
        ),
      );
    });
  });

  describe("negative cases — 빌더 guard throw(argv 미산출)", () => {
    it("(c-i) create createArgs.title 빈 문자열 → 빌더 throw(argv 미산출)", () => {
      const commandArgs = assembleCommandArgs(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      commandArgs.createArgs.title = "";
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueGhArgv(
          { action: "create" },
          commandArgs,
        ),
      ).toThrow();
    });

    it("(c-ii) create createArgs.body 공백만 → 빌더 throw", () => {
      const commandArgs = assembleCommandArgs(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      commandArgs.createArgs.body = "   ";
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueGhArgv(
          { action: "create" },
          commandArgs,
        ),
      ).toThrow();
    });

    it("(d-i) update issueNumber 0(비양수) → 빌더 throw", () => {
      const commandArgs = assembleCommandArgs(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueGhArgv(
          { action: "update", issueNumber: 0 },
          commandArgs,
        ),
      ).toThrow();
    });

    it("(d-ii) update issueNumber 음수·비정수 → 빌더 throw(각 비양정수 분기)", () => {
      const commandArgs = assembleCommandArgs(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueGhArgv(
          { action: "update", issueNumber: -3 },
          commandArgs,
        ),
      ).toThrow();
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueGhArgv(
          { action: "update", issueNumber: 4.5 },
          commandArgs,
        ),
      ).toThrow();
    });
  });

  describe("negative cases — 파서/resolver guard 상류 차단(컴포저 전파, plan 미산출)", () => {
    it("(e-i) 비-JSON stdout('{') → 컴포저에서 파서 throw 전파(plan 미산출)", () => {
      const commandArgs = assembleCommandArgs(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      expect(() =>
        resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
          "{",
          commandArgs,
        ),
      ).toThrow();
    });

    it("(e-ii) 비배열 JSON stdout('{}') → 파서 throw 전파", () => {
      const commandArgs = assembleCommandArgs(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      expect(() =>
        resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
          "{}",
          commandArgs,
        ),
      ).toThrow();
    });

    it("(e-iii) 원소 number 비양정수(0) stdout → 파서 throw 전파", () => {
      const commandArgs = assembleCommandArgs(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      const stdout = JSON.stringify([
        { number: 0, title: "t", body: commandArgs.searchQuery },
      ]);
      expect(() =>
        resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
          stdout,
          commandArgs,
        ),
      ).toThrow();
    });

    it("(f-i) marker 빈-공백 commandArgs → 컴포저에서 resolver throw 전파(plan 미산출)", () => {
      const commandArgs = assembleCommandArgs(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      commandArgs.searchQuery = "   ";
      expect(() =>
        resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
          EMPTY_STDOUT,
          commandArgs,
        ),
      ).toThrow();
    });

    it("(f-ii) chain 상류 차단 — run.gitSha 빈-공백 → descriptor guard throw 로 commandArgs 조립 자체 차단", () => {
      expect(() =>
        assembleCommandArgs(evalOutcome(), collectOutcome(), {
          gitSha: "   ",
          dateToken: RUN_A.dateToken,
        }),
      ).toThrow();
    });

    it("(f-iii) chain 상류 차단 — run.dateToken 빈 문자열 → descriptor guard throw(필드별 독립 분기)", () => {
      expect(() =>
        assembleCommandArgs(evalOutcome(), collectOutcome(), {
          gitSha: RUN_A.gitSha,
          dateToken: "",
        }),
      ).toThrow();
    });
  });

  describe("결정론 · 무공유 · no-mutation", () => {
    it("(create) 동일 (stdout, commandArgs) 두 번 컴포저 → 두 plan.argv deep-equal(byte-identical) AND 서로 다른 배열 인스턴스(무공유)", () => {
      const commandArgs = assembleCommandArgs(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      const a = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        EMPTY_STDOUT,
        commandArgs,
      );
      const b = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        EMPTY_STDOUT,
        commandArgs,
      );

      expect(a.argv).toEqual(b.argv);
      expect(a).not.toBe(b);
      expect(a.argv).not.toBe(b.argv);
    });

    it("(update) 동일 입력 두 번 컴포저 → 두 plan.argv deep-equal + 참조 비동일", () => {
      const commandArgs = assembleCommandArgs(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      const stdout = searchHitStdout(commandArgs.searchQuery, 7);
      const a = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        stdout,
        commandArgs,
      );
      const b = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        stdout,
        commandArgs,
      );

      expect(a.argv).toEqual(b.argv);
      expect(a).not.toBe(b);
      expect(a.argv).not.toBe(b.argv);
    });

    it("no-mutation — 컴포저·빌더 호출이 commandArgs(중첩 createArgs/labels 포함)를 mutate 0(호출 전후 snapshot deep-equal)", () => {
      const commandArgs = assembleCommandArgs(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      const snapshot = JSON.parse(JSON.stringify(commandArgs));
      const stdout = searchHitStdout(commandArgs.searchQuery, 7);

      const plan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        stdout,
        commandArgs,
      );
      buildRealDataDailyStepDualLegRunReportIssueGhArgv(
        plan.action,
        commandArgs,
      );

      expect(commandArgs).toEqual(snapshot);
      expect(commandArgs.createArgs.labels).toEqual(snapshot.createArgs.labels);
    });
  });

  describe("raw / credential 누출 0(R-59 / REQ-059)", () => {
    it("(create) plan.argv 어느 원소도 token/secret 어휘(--token/GITHUB_TOKEN/GH_TOKEN/ghp_) 미포함", () => {
      const { plan } = planForCreate({ ...RUN_A });
      const joined = plan.argv.join(" ");

      expect(joined).not.toContain("--token");
      expect(joined).not.toContain("GITHUB_TOKEN");
      expect(joined).not.toContain("GH_TOKEN");
      expect(joined).not.toContain("ghp_");
      expect(joined).not.toMatch(/ghp_[A-Za-z0-9]/);
    });

    it("(update) plan.argv 어느 원소도 token/secret 어휘 미포함 AND repo/토큰/credential flag 미포함(issue edit 핵심 인자만)", () => {
      const { plan } = planForUpdate({ ...RUN_A }, 7);
      const joined = plan.argv.join(" ");

      expect(joined).not.toContain("--token");
      expect(joined).not.toContain("GITHUB_TOKEN");
      expect(joined).not.toContain("GH_TOKEN");
      expect(joined).not.toContain("ghp_");
      expect(joined).not.toContain("--repo");
      // 핵심 인자만 — issue/edit/issueNumber/--title/--body.
      expect(plan.argv[0]).toBe("issue");
      expect(plan.argv[1]).toBe("edit");
    });

    it("leg outcome.specPath 에 sentinel 을 넣어도 plan.argv 표면에 sentinel 미누출(run 식별자 파생만)", () => {
      const sentinel = "ghp_SENTINELsecret1234";
      const evalLeg: RealDataDailyStepLegRunOutcome = {
        leg: "eval",
        action: "run",
        passed: true,
        specPath: sentinel,
      };
      const collectLeg: RealDataDailyStepLegRunOutcome = {
        leg: "collect",
        action: "run",
        passed: true,
        specPath: sentinel,
      };
      const commandArgs = assembleCommandArgs(evalLeg, collectLeg, {
        ...RUN_A,
      });
      const plan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        searchHitStdout(commandArgs.searchQuery, 7),
        commandArgs,
      );

      expect(plan.argv.join(" ")).not.toContain(sentinel);
    });

    it("빌더 guard throw 메시지가 credential/raw 활동 본문을 노출하지 않음(필드명·값 유효성만)", () => {
      const commandArgs = assembleCommandArgs(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      commandArgs.createArgs.title = "";
      try {
        buildRealDataDailyStepDualLegRunReportIssueGhArgv(
          { action: "create" },
          commandArgs,
        );
        throw new Error("throw 를 기대했으나 통과함");
      } catch (err) {
        const message = (err as Error).message;
        expect(message).not.toContain("ghp_");
        expect(message).not.toContain("GITHUB_TOKEN");
        expect(message).not.toContain("narrative");
      }
    });
  });

  describe("run 분포 무관 argv single-source 정합(다른 run→각자 빌더와 byte-identical)", () => {
    it("서로 다른 run(RUN_A / RUN_B) 각각 create chain → 각 plan.argv 가 자기 commandArgs 빌더 산출과 byte-identical(marker 만 다르고 축은 동일)", () => {
      const a = planForCreate({ ...RUN_A });
      const b = planForCreate({ ...RUN_B });

      expect(a.plan.argv).toEqual(
        buildRealDataDailyStepDualLegRunReportIssueGhArgv(
          a.plan.action,
          a.commandArgs,
        ),
      );
      expect(b.plan.argv).toEqual(
        buildRealDataDailyStepDualLegRunReportIssueGhArgv(
          b.plan.action,
          b.commandArgs,
        ),
      );
      // 두 chain 의 marker(searchQuery)는 run-token 으로 분리(축 분리 구조 검증).
      expect(a.commandArgs.searchQuery).not.toBe(b.commandArgs.searchQuery);
    });
  });
});
