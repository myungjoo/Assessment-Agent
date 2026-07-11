// realdata-e2e-daily-step-dual-leg-run-report-edit-argv-resolve-output-parse-
// issuenumber-medium-execute-side-single-source-closure-assembly.smoke-spec.ts —
// 실 평가 e2e daily-step dual-leg run report 의 execute-side 축(search-hit(N) →
// resolve(action.update.issueNumber) → edit-gh-argv(plan.argv[2]=String(N),
// issueNumber-as-argv-element) → output-parse(outcome.issueNumber))을 issueNumber-
// as-edit-medium 축으로 묶은 single-source closure non-gated build-time smoke
// (T-0920 박제, PLAN.md 109행 🟢 실 평가 e2e step ④).
//
// 본 spec 의 존재 이유 — execute-side issueNumber-as-edit-argv-element single-source
// closure gap 해소:
//   - step ④(daily-test dual-leg run 결과 rolling-issue 멱등 박제)의 live wiring 은
//     marker 로 검색해 기존 이슈 N 을 해소한 뒤 **실제로 `gh issue edit <N> ...` 명령에
//     넘길 argv** 를 산출하고, 그 명령의 stdout 을 파싱해 issueNumber 를 확인한다. 실 live
//     runner 는 resolve 가 산출한 `plan.argv` 를 `execFile('gh', plan.argv)` 로 그대로
//     실행하므로 `plan.argv[2]`(=`String(issueNumber)`)가 곧 실 runner 가 어느 이슈를
//     갱신할지 결정하는 실 exec argv 원소다. marker 가 검색 매체(search medium)였듯
//     issueNumber 는 편집 매체(edit medium)다.
//   - 이 흐름은 네 지점에서 issueNumber N 이 수렴한다:
//       (1) search hit — searchStdout 의 최소 number N.
//       (2) resolve action — plan.action.update.issueNumber = N.
//       (3) edit-gh-argv — plan.argv[2] === String(N)(실 runner 가 `gh issue edit N`
//           로 실행할 argv 원소).
//       (4) output-parse — parse...IssueCreateEditOutput(execStdout).issueNumber = N.
//   - 형제 smoke 들이 각기 절반만 닫았다:
//       * T-0919(search-argv→resolve→output-parse 4-boundary) 는 search-side marker-
//         as-argv-element(입력 검색 매체)를 닫았으나 `plan.argv` 를 opaque 로 다뤄
//         update 분기 판정에서 `plan.argv[0]="issue"`/`plan.argv[1]="edit"`(선두 branch
//         identity)만 단언한다 — `plan.argv[2]` 가 해소 issueNumber N 을 실 exec argv
//         원소로 운반함(execute-side medium)은 미단언 gap.
//       * T-0912/T-0913(forward publish-assembly / round-trip) 는 `plan.argv[2]).toBe
//         ("42")` 를 하드코딩 literal 로 단언하나, (a) 그 N 을 단일 source 인 search hit
//         number 로 묶지 않고, (b) searchArgv(검색-argv boundary)와 결합하지 않으며,
//         (c) run/leg outcome 분포에 대한 issueNumber 불변을 execute-argv 원소 축에서
//         박제하지 않는다.
//   - 본 spec 은 T-0919 의 search-side 대칭면(execute-side)으로, `report → descriptor →
//     commandArgs → searchArgv → resolve(action + plan.argv edit-argv) → output-parse`
//     종단 조립에서 issueNumber 가 실 `gh issue edit` argv 원소로서 편집 매체로 chain 을
//     관통하고 네 지점(search-hit / resolve.action / plan.argv[2] / output-parse)에서 한
//     chain 안에 drift 0 으로 수렴함만 닫는다. 따라서 본 spec 은:
//
//      🔥 실 LLM 호출 0 — orchestrator / scoring service / gateway 미사용. synthetic
//         leg outcome / run / stdout literal 을 조립 체인에 직접 공급(실 평가·수집·jest
//         spawn 0).
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 gh 실행 0 — search / issue create / issue edit 실 실행 0. execFile('gh', …) 0.
//      🔥 credential 0 / secret 0 / DB 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 build*/resolve*/parse* 컴포저 import 재사용만
//         (consistency-guard·helper 신설 금지 — value-consistency sweep 종결, T-0911).
//      🔥 gating / describe.skip / env-gating 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0920):
//   - 형제 search-side 4-boundary smoke(T-0919)의 marker-as-search-argv-element
//     (searchArgv 원소 운반·검색 매체 관통·marker 3지점 수렴) 자체 재단언 — 본 spec 은 그
//     대칭 execute-side plan.argv(edit-argv) issueNumber 원소 각도만.
//   - 형제 triple-boundary smoke(T-0918)의 descriptor→resolve→output-parse issueNumber
//     수렴(action.update.issueNumber == outcome.issueNumber) 자체 단독 재단언 — 본 spec 은
//     그 사이에 plan.argv[2] edit-argv 원소를 삽입한 각도만.
//   - 형제 round-trip smoke(T-0913)의 create/update round-trip parse 정합·plan.argv[2]
//     하드코딩 literal 자체 재단언 — 본 spec 은 N 을 단일 source search-hit number 로 묶고
//     + searchArgv 결합 + run/leg 분포 불변을 execute-argv 축에 추가.
//   - forward publish assembly(T-0912)·markdown assembly(T-0914)·body/identity
//     confluence(T-0915/T-0916)·run-token cross-surface(T-0917) 재검증 — 각 절단면 이미
//     닫힘. searchArgv argv 원소 순서/`--match body`/`--limit` 형식·gh-argv 의 `--title`/
//     `--body`/labels 형식 재단언 금지(각 가드 cover). 본 spec 은 issueNumber(edit-argv
//     원소) 축 + create/update argv 형태 격리만.
//   - 새 컴포저 / consistency 가드 / helper / type 신설 — 기존 helper import·호출만.
//   - production src/ 코드 / package.json / lockfile / test/jest-smoke.json 변경.
import {
  buildRealDataDailyStepDualLegRunReport,
  type RealDataDailyStepLegRunOutcome,
} from "../helpers/realdata-e2e-daily-step-dual-leg-run-report";
import { buildRealDataDailyStepDualLegRunReportIssueCommandArgs } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
import { buildRealDataDailyStepDualLegRunReportIssueDescriptor } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor";
import { resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan";
import { parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse";
import { buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv";
import type { RealDataResultIssueRunRef } from "../helpers/realdata-e2e-result-issue-descriptor";

// 결정론 run 식별자 fixture — gitSha + dateToken 비공백 안정 토큰. 매 it 가 spread 복제로
// 받아 입력 mutate 누설 0. token/secret/raw narrative 어휘 미포함(credential 누출 0 단언
// fixture 전제).
const RUN_A: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-07-11",
};

// 서로 다른 run — gitSha·dateToken 이 RUN_A 와 서로 substring 이 아닌 구별 가능 값(run 분포
// 무관 issueNumber 단언용 — issueNumber 는 search-stdout 종속이라 run 이 달라도 불변).
const RUN_B: RealDataResultIssueRunRef = {
  gitSha: "def5678",
  dateToken: "2026-08-24",
};

// synthetic leg outcome fixture — eval / collect 각 leg 의 run outcome literal. 조립
// 체인은 leg outcome 을 report → descriptor 로 흘려보내는 surface 만 검증하므로 도메인
// 타입 정합만 만족하는 minimal literal 로 충분하다(실 jest spawn 0).
function evalOutcome(): RealDataDailyStepLegRunOutcome {
  return { leg: "eval", action: "run", passed: true };
}

function collectOutcome(): RealDataDailyStepLegRunOutcome {
  return { leg: "collect", action: "run", passed: true };
}

// marker 를 body 에 포함한 synthetic search stdout(1+ hit) — update 분기 유도. gh search
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

// synthetic gh issue create/edit stdout — 지정 이슈 번호의 유효 issue URL 한 줄(trailing
// 개행 포함). 실 gh round-trip 없이 파서에 직접 주입한다. exec-stdout URL 안 N 은 search
// hit 최소 number 와 동일 합성(cross-boundary 수렴 입력 조건).
function issueUrlStdout(n: number): string {
  return `https://github.com/myungjoo/assessment-agent/issues/${n}\n`;
}

// run-token 계산 — literal prefix 하드코딩이 아니라 helper 규약 `${dateToken}@${gitSha}` 를
// 재계산해 marker substring 을 구조적으로 검증한다(prefix const 는 export 0).
function runTokenOf(run: RealDataResultIssueRunRef): string {
  return `${run.dateToken}@${run.gitSha}`;
}

// execute-side single-source 조립 진입점 — 단일 source(run + 두 leg outcome + searchStdout +
// execStdout) 로부터 종단 chain(descriptor / searchArgv / resolve(action + plan.argv) /
// output-parse)을 관통시킨다. resolve 이후 plan.argv 가 실 `gh issue edit N` exec argv 를
// 운반함을 chain 안에서 노출한다. 각 stage 의 guard throw 는 자체 try/catch 없이 그대로
// 전파된다.
function assembleViaChain(
  evalLeg: RealDataDailyStepLegRunOutcome,
  collectLeg: RealDataDailyStepLegRunOutcome,
  run: RealDataResultIssueRunRef,
  n: number,
  opts?: { searchStdout?: string; execStdout?: string },
) {
  // (1) pre-execution descriptor.
  const report = buildRealDataDailyStepDualLegRunReport(
    evalLeg,
    collectLeg,
    run,
  );
  const descriptor =
    buildRealDataDailyStepDualLegRunReportIssueDescriptor(report);
  // (2) command-args — searchQuery = descriptor.marker 운반.
  const commandArgs =
    buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor);
  // (3) search-gh-argv — searchQuery(=marker)를 실 gh search argv 의 단일 원소로 운반
  //     (chain 조립 입력으로만 포함 — argv 형식 재단언은 T-0919 cover).
  const searchArgv =
    buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs);
  // (4) resolve — marker(=searchQuery) 담은 searchStdout 로 update/create 분기 해소.
  //     update 분기 → plan.argv = ["issue","edit",String(N),...] (실 gh issue edit argv).
  const searchStdout =
    opts?.searchStdout ?? searchHitStdout(commandArgs.searchQuery, n);
  const plan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
    searchStdout,
    commandArgs,
  );
  // (5) post-execution output-parse — 실행 stdout URL 의 issueNumber 추출.
  const execStdout = opts?.execStdout ?? issueUrlStdout(n);
  const outcome =
    parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(execStdout);
  return {
    report,
    descriptor,
    commandArgs,
    searchArgv,
    searchStdout,
    plan,
    execStdout,
    outcome,
  };
}

describe("Smoke(non-gated): dual-leg run report edit-argv→resolve→output-parse issueNumber-as-edit-medium execute-side single-source closure live-gh 0 검증", () => {
  describe("happy path — execute-side chain 산출", () => {
    it("단일 source(run + 두 leg outcome + N) → 산출물이 모두 정상(descriptor {title,marker,body} 비어있지 않음, plan.action update 분기 issueNumber 보유, plan.argv 비어있지 않은 string[], outcome {issueNumber,url} 2필드 정확히 보유)", () => {
      const N = 42;
      const { descriptor, plan, outcome } = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        N,
      );

      // descriptor 세 필드 비어있지 않음.
      expect(descriptor.title.length).toBeGreaterThan(0);
      expect(descriptor.marker.length).toBeGreaterThan(0);
      expect(descriptor.body.length).toBeGreaterThan(0);

      // resolve 는 marker hit → update 분기, issueNumber 보유.
      expect(plan.action.action).toBe("update");

      // plan.argv 는 비어있지 않은 string[](실 gh issue edit exec argv).
      expect(Array.isArray(plan.argv)).toBe(true);
      expect(plan.argv.length).toBeGreaterThan(0);
      expect(plan.argv.every((el) => typeof el === "string")).toBe(true);

      // output-parse 는 {issueNumber, url} 2필드만 정확히 보유(raw 미저장).
      expect(Object.keys(outcome).sort()).toEqual(["issueNumber", "url"]);
      expect(typeof outcome.issueNumber).toBe("number");
      expect(typeof outcome.url).toBe("string");
    });
  });

  describe("핵심 1 — edit-argv issueNumber-element byte-identical(issueNumber-as-edit-medium)", () => {
    it("(a) update 분기 → plan.argv[0]==='issue' AND plan.argv[1]==='edit' AND plan.argv[2]===String(N)(실 runner 가 `gh issue edit N` 로 실행할 argv 가 issueNumber 를 원소로 운반)", () => {
      const N = 7;
      const { plan } = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        N,
      );
      expect(plan.action.action).toBe("update");
      expect(plan.argv[0]).toBe("issue");
      expect(plan.argv[1]).toBe("edit");
      expect(plan.argv[2]).toBe(String(N));
    });

    it("(b) plan.argv.includes(String(N)) — issueNumber 가 argv 안 원소로 존재", () => {
      const N = 137;
      const { plan } = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        N,
      );
      expect(plan.argv.includes(String(N))).toBe(true);
    });

    it("(c) plan.action narrowing 후 plan.argv[2]===String(plan.action.issueNumber) — resolve 가 해소한 action.issueNumber 와 실 exec argv 원소가 byte-identical 수렴", () => {
      const N = 256;
      const { plan } = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        N,
      );
      expect(plan.action.action).toBe("update");
      if (plan.action.action === "update") {
        expect(plan.argv[2]).toBe(String(plan.action.issueNumber));
      }
    });
  });

  describe("핵심 2 — 4지점 issueNumber single-source 수렴", () => {
    it("search hit N → resolve plan.action.update.issueNumber → plan.argv[2](edit exec argv 원소, String(N)) → output-parse outcome.issueNumber 네 지점 모두 동일 N(drift 0 관통)", () => {
      const N = 314;
      const { plan, outcome } = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        N,
      );

      // (2) resolve.action.issueNumber(discriminated union narrowing 후).
      expect(plan.action.action).toBe("update");
      if (plan.action.action === "update") {
        expect(plan.action.issueNumber).toBe(N);
      }
      // (3) plan.argv[2] — 실 gh issue edit exec argv 원소.
      expect(plan.argv[2]).toBe(String(N));
      // (4) output-parse.
      expect(outcome.issueNumber).toBe(N);
      expect(outcome.url).toContain(`/issues/${N}`);
    });
  });

  describe("branch — 검색 미스 → create 분기 argv 형태 격리(issueNumber 원소 부재)", () => {
    it("동일 run·leg outcome 이되 searchStdout 을 빈 hit('[]')로 합성 → plan.action create 분기, plan.argv[0]==='issue' AND plan.argv[1]==='create'", () => {
      const N = 55;
      const { plan } = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        N,
        { searchStdout: "[]" },
      );
      expect(plan.action).toEqual({ action: "create" });
      expect(plan.argv[0]).toBe("issue");
      expect(plan.argv[1]).toBe("create");
    });

    it("create 분기 argv 에는 issueNumber 원소가 없음(plan.argv[2] !== String(N), issueNumber-as-edit-medium 은 update 분기 전용)", () => {
      const N = 55;
      const { plan } = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        N,
        { searchStdout: "[]" },
      );
      // create argv 3번째 원소는 flag(`--title`)이지 issueNumber 문자열이 아님.
      expect(plan.argv[2]).not.toBe(String(N));
      expect(plan.argv.includes(String(N))).toBe(false);
    });

    it("검색 미스가 edit-argv 경로를 우회해도 output-parse 는 여전히 execStdout 의 N 으로 issueNumber 산출(검색 분기 변경이 output-parse 경로와 독립)", () => {
      const N = 55;
      const { plan, outcome } = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        N,
        { searchStdout: "[]" },
      );
      expect(plan.action.action).toBe("create");
      expect(outcome.issueNumber).toBe(N);
      expect(outcome.url).toContain(`/issues/${N}`);
    });
  });

  describe("branch — run 분포 무관 issueNumber 불변(다른 run→같은 edit-argv issueNumber)", () => {
    it("(a) 서로 다른 run(RUN_A / RUN_B) 각각 동일 N chain → 두 plan.argv[2] 가 동일 String(N)(issueNumber 는 search-stdout 종속, run 무관 — run 은 marker 로만 변별)", () => {
      const N = 88;
      const chainA = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        N,
      );
      const chainB = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_B },
        N,
      );
      expect(chainA.plan.argv[2]).toBe(String(N));
      expect(chainB.plan.argv[2]).toBe(String(N));
      expect(chainA.plan.argv[2]).toBe(chainB.plan.argv[2]);
    });

    it("(b) 그러나 두 chain 의 descriptor.marker(=searchQuery)는 서로 다름(run-token 으로 분리 — run 은 marker 로 변별, issueNumber 는 stdout 종속)", () => {
      const N = 88;
      const chainA = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        N,
      );
      const chainB = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_B },
        N,
      );
      expect(chainA.descriptor.marker).not.toBe(chainB.descriptor.marker);
      expect(chainA.commandArgs.searchQuery).not.toBe(
        chainB.commandArgs.searchQuery,
      );
      // marker 는 각 run 의 run-token 을 보유(축 분리 구조 검증).
      expect(chainA.descriptor.marker).toContain(runTokenOf(RUN_A));
      expect(chainB.descriptor.marker).toContain(runTokenOf(RUN_B));
    });
  });

  describe("branch — leg outcome 무관 edit-argv issueNumber 격리(partial-thread 격리)", () => {
    it("(a) 동일 run·동일 searchStdout(같은 N) 고정, leg outcome 조합만 다르게(pass/pass vs fail/skip) → 두 plan.argv[2] 가 동일 String(N)(issueNumber 는 leg status/overallStatus 무관 — search hit 종속)", () => {
      const N = 21;
      const passChain = assembleViaChain(
        { leg: "eval", action: "run", passed: true },
        { leg: "collect", action: "run", passed: true },
        { ...RUN_A },
        N,
      );
      const mixedChain = assembleViaChain(
        { leg: "eval", action: "run", passed: false },
        { leg: "collect", action: "skip" },
        { ...RUN_A },
        N,
      );
      expect(passChain.plan.argv[2]).toBe(String(N));
      expect(mixedChain.plan.argv[2]).toBe(String(N));
      expect(passChain.plan.argv[2]).toBe(mixedChain.plan.argv[2]);
    });

    it("(b) 두 chain 의 outcome.issueNumber 도 동일 N 으로 수렴(issueNumber 축 불변)", () => {
      const N = 21;
      const passChain = assembleViaChain(
        { leg: "eval", action: "run", passed: true },
        { leg: "collect", action: "run", passed: true },
        { ...RUN_A },
        N,
      );
      const mixedChain = assembleViaChain(
        { leg: "eval", action: "run", passed: false },
        { leg: "collect", action: "skip" },
        { ...RUN_A },
        N,
      );
      expect(passChain.outcome.issueNumber).toBe(N);
      expect(mixedChain.outcome.issueNumber).toBe(N);
      expect(passChain.outcome.issueNumber).toBe(
        mixedChain.outcome.issueNumber,
      );
    });
  });

  describe("error path / negative cases — 예외 분기마다 각 1+ (edit-argv 경계 거부 대칭)", () => {
    it("(a) run.gitSha 빈/공백 → descriptor(stage 1, report 합성) guard throw 로 chain 시작 차단", () => {
      expect(() =>
        assembleViaChain(
          evalOutcome(),
          collectOutcome(),
          { gitSha: "   ", dateToken: RUN_A.dateToken },
          1,
        ),
      ).toThrow();
    });

    it("(b) run.dateToken 빈/공백 → descriptor(stage 1) guard throw 대칭(gitSha 유효해도 필드별 독립 분기)", () => {
      expect(() =>
        assembleViaChain(
          evalOutcome(),
          collectOutcome(),
          { gitSha: RUN_A.gitSha, dateToken: "" },
          1,
        ),
      ).toThrow();
    });

    it("(c) update 분기 issueNumber 비양수(number:0 search hit)를 담은 searchStdout → resolve 위임 search-parse/assertPositiveIssueNumber throw(비양수 N 이 edit argv 원소로 새는 것 차단)", () => {
      const marker = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        1,
      ).descriptor.marker;
      expect(() =>
        assembleViaChain(evalOutcome(), collectOutcome(), { ...RUN_A }, 1, {
          searchStdout: searchHitStdout(marker, 0),
        }),
      ).toThrow();
    });

    it("(d) searchStdout 비JSON/비배열('not json') → resolve(stage 4) 파서 위임 throw(marker/argv 정상이어도 hits 추출 실패로 resolve+argv 차단)", () => {
      expect(() =>
        assembleViaChain(evalOutcome(), collectOutcome(), { ...RUN_A }, 1, {
          searchStdout: "not json",
        }),
      ).toThrow();
    });

    it("(e-i) execStdout 에 issue URL 미발견(무관 텍스트) 또는 비-github/`/pull/` → output-parse(post) throw(URL-미발견 분기)", () => {
      expect(() =>
        assembleViaChain(evalOutcome(), collectOutcome(), { ...RUN_A }, 1, {
          execStdout: "no url at all\n",
        }),
      ).toThrow();
      expect(() =>
        assembleViaChain(evalOutcome(), collectOutcome(), { ...RUN_A }, 1, {
          execStdout: "https://gitlab.com/myungjoo/assessment-agent/issues/9\n",
        }),
      ).toThrow();
      expect(() =>
        assembleViaChain(evalOutcome(), collectOutcome(), { ...RUN_A }, 1, {
          execStdout: "https://github.com/myungjoo/assessment-agent/pull/9\n",
        }),
      ).toThrow();
    });

    it("(e-ii) execStdout URL 안 issueNumber 비양수(/issues/0·선행0·비정수) → output-parse(post) throw(비양수 분기 — e-i 과 분리)", () => {
      expect(() =>
        assembleViaChain(evalOutcome(), collectOutcome(), { ...RUN_A }, 1, {
          execStdout: issueUrlStdout(0),
        }),
      ).toThrow();
      expect(() =>
        assembleViaChain(evalOutcome(), collectOutcome(), { ...RUN_A }, 1, {
          execStdout:
            "https://github.com/myungjoo/assessment-agent/issues/007\n",
        }),
      ).toThrow();
      expect(() =>
        assembleViaChain(evalOutcome(), collectOutcome(), { ...RUN_A }, 1, {
          execStdout:
            "https://github.com/myungjoo/assessment-agent/issues/abc\n",
        }),
      ).toThrow();
    });
  });

  describe("결정론 · 무공유 · no-mutation", () => {
    it("동일 (run, leg outcomes, searchStdout, execStdout) 입력 chain 두 번 → descriptor/commandArgs/searchArgv/plan/outcome 가 두 번 deep-equal(plan.argv 배열 포함)", () => {
      const N = 42;
      const first = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        N,
      );
      const second = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        N,
      );
      expect(first.descriptor).toEqual(second.descriptor);
      expect(first.commandArgs).toEqual(second.commandArgs);
      expect(first.searchArgv).toEqual(second.searchArgv);
      expect(first.plan).toEqual(second.plan);
      expect(first.plan.argv).toEqual(second.plan.argv);
      expect(first.outcome).toEqual(second.outcome);
    });

    it("no-mutation — 입력 run/leg outcome literal 이 chain 호출 후 mutate 0(원본 deep-equal 유지, snapshot 대조)", () => {
      const run: RealDataResultIssueRunRef = { ...RUN_A };
      const evalLeg = evalOutcome();
      const collectLeg = collectOutcome();
      const runBefore = JSON.parse(JSON.stringify(run));
      const evalBefore = JSON.parse(JSON.stringify(evalLeg));
      const collectBefore = JSON.parse(JSON.stringify(collectLeg));

      assembleViaChain(evalLeg, collectLeg, run, 42);

      expect(run).toEqual(runBefore);
      expect(evalLeg).toEqual(evalBefore);
      expect(collectLeg).toEqual(collectBefore);
    });

    it("무공유 — plan.argv 배열이 입력/다음 호출 결과와 referential identity 분리(not.toBe)", () => {
      const N = 42;
      const first = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        N,
      );
      const second = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        N,
      );
      expect(first.plan).not.toBe(second.plan);
      expect(first.plan.argv).not.toBe(second.plan.argv);
      expect(first.outcome).not.toBe(second.outcome);
      expect(first.descriptor).not.toBe(second.descriptor);
    });
  });

  describe("raw / credential 누출 0(R-59 / REQ-059)", () => {
    it("chain 표면(descriptor.{title,marker,body} / searchQuery / searchArgv 전체 / plan.argv 전체 / outcome.url)에 token/secret/raw narrative 어휘 미등장", () => {
      const { descriptor, commandArgs, searchArgv, plan, outcome } =
        assembleViaChain(evalOutcome(), collectOutcome(), { ...RUN_A }, 42);
      const joined = [
        descriptor.title,
        descriptor.marker,
        descriptor.body,
        commandArgs.searchQuery,
        ...searchArgv,
        ...plan.argv,
        outcome.url,
      ].join(" ");

      expect(joined).not.toContain("--token");
      expect(joined).not.toContain("GITHUB_TOKEN");
      expect(joined).not.toContain("GH_TOKEN");
      expect(joined).not.toContain("ghp_");
      expect(joined).not.toContain("narrative");
      expect(joined).not.toMatch(/ghp_[A-Za-z0-9]/);
    });

    it("leg outcome.specPath 에 sentinel 을 넣어도 plan.argv/issueNumber 표면에 sentinel 미누출(run-token 표면은 run 식별자 + status 파생만)", () => {
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
      const { plan, outcome } = assembleViaChain(
        evalLeg,
        collectLeg,
        { ...RUN_A },
        42,
      );
      expect(plan.argv.join(" ")).not.toContain(sentinel);
      expect(String(outcome.issueNumber)).not.toContain(sentinel);
      expect(outcome.url).not.toContain(sentinel);
    });
  });
});
