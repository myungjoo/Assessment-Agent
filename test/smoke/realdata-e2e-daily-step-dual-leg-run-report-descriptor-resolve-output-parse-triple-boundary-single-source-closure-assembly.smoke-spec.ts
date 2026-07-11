// realdata-e2e-daily-step-dual-leg-run-report-descriptor-resolve-output-parse-
// triple-boundary-single-source-closure-assembly.smoke-spec.ts —
// 실 평가 e2e daily-step dual-leg run report 의 세 boundary(pre-execution descriptor →
// command-plan resolve → post-execution output-parse)를 marker-as-search-medium 축으로
// 묶은 single-source closure non-gated build-time smoke (T-0918 박제, PLAN.md 109행
// 🟢 실 평가 e2e step ④).
//
// 본 spec 의 존재 이유 — triple-boundary single-source closure gap 해소:
//   - step ④(daily-test dual-leg run 결과 rolling-issue 멱등 박제)의 live wiring 은 한
//     실행 사이클 안에서 세 boundary 를 순서대로 엮는다:
//       (1) pre-execution descriptor — buildRealDataDailyStepDualLegRunReportIssueDescriptor
//           → {title, marker, body}. marker 안에 run-token `${dateToken}@${gitSha}` 박제.
//       (2) command-args — buildRealDataDailyStepDualLegRunReportIssueCommandArgs →
//           {searchQuery, ...}. `searchQuery` 는 descriptor.marker 를 그대로 담는다.
//       (3) resolve — resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
//           searchStdout, commandArgs) → {action, argv}. marker(=searchQuery)로 검색해
//           hit 1+ → action.update(최소 number N), hit 0 → action.create.
//       (4) post-execution output-parse — parseRealDataDailyStepDualLegRunReportIssue
//           CreateEditOutput(execStdout) → {issueNumber, url}.
//   - 형제 round-trip smoke(T-0913)는 위 세 helper 를 같은 chain 에서 호출하지만
//     `searchQuery` 를 opaque 로만 다뤄 (a) `commandArgs.searchQuery === descriptor.marker`
//     (marker 가 곧 검색 매체)임과 (b) 그 marker 가 run-token 을 담아 pre-boundary run
//     식별을 post-boundary issueNumber 로 잇는 single-source 임을 단언하지 않는다.
//     T-0913 의 초점은 create/update 분기 round-trip parse 정합이었고,
//     marker-as-search-medium 단일-source 관통 + run 분포 변별성은 미단언 gap 이었다.
//   - 본 spec 은 요약 축 T-0769(descriptor→resolve→from-output triple-boundary single-
//     source closure)의 dual-leg 축 mirror 로 그 gap 만 닫는다(T-0913 과 직교 — create/
//     update round-trip parse 정합 자체 재단언 0). 따라서 본 spec 은:
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
// Out of Scope (T-0918):
//   - 형제 round-trip smoke(T-0913, ...publish-roundtrip.smoke-spec.ts)의 create/update
//     분기 round-trip parse 정합(action.update.issueNumber == output-parse.issueNumber)
//     자체 단독 재단언 — 본 spec 은 그 위에 marker↔searchQuery byte-identical + run-token
//     관통 + run 분포 변별성 single-source 각도만 추가.
//   - forward publish assembly(T-0912)·markdown assembly(T-0914)·body/identity confluence
//     (T-0915/T-0916)·run-token cross-surface(T-0917) 재검증 — 각 절단면 이미 닫힘.
//     run-identity(gitSha·dateToken) pre-surface 수렴은 T-0917 cover — 본 spec 은
//     issueNumber triple-boundary + marker-as-search-medium 관통만.
//   - commandArgs 의 createArgs/updateArgs/labels 정합·argv 합성 재단언(command-args·
//     gh-argv 가드 cover). descriptor.body 의 marker→markdown 2블록 구조 재단언(body
//     confluence 가드 cover). 본 spec 은 title/marker(=searchQuery) 축 + issueNumber 만.
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
import type { RealDataResultIssueRunRef } from "../helpers/realdata-e2e-result-issue-descriptor";

// 결정론 run 식별자 fixture — gitSha + dateToken 비공백 안정 토큰. 매 it 가 spread 복제로
// 받아 입력 mutate 누설 0. token/secret/raw narrative 어휘 미포함(credential 누출 0 단언
// fixture 전제).
const RUN_A: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-07-11",
};

// 서로 다른 run — gitSha·dateToken 이 RUN_A 와 서로 substring 이 아닌 구별 가능 값(run 분포
// 변별성 단언용).
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
// issues --json number,title,body 응답을 흉내낸 literal.
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

// run-token 계산 — literal prefix 하드코딩이 아니라 helper 규약 `${dateToken}@${gitSha}` 를
// 재계산해 marker substring 을 구조적으로 검증한다(prefix const 는 export 0).
function runTokenOf(run: RealDataResultIssueRunRef): string {
  return `${run.dateToken}@${run.gitSha}`;
}

// triple-boundary single-source 조립 진입점 — 단일 source(run + 두 leg outcome +
// searchStdout + execStdout) 로부터 세 boundary(descriptor / resolve / output-parse)를 한
// chain 으로 관통시킨다. 각 stage 의 guard throw 는 자체 try/catch 없이 그대로 전파된다.
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
  // (3) resolve — marker(=searchQuery) 담은 searchStdout 로 update/create 분기 해소.
  const searchStdout =
    opts?.searchStdout ?? searchHitStdout(commandArgs.searchQuery, n);
  const plan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
    searchStdout,
    commandArgs,
  );
  // (4) post-execution output-parse — 실행 stdout URL 의 issueNumber 추출.
  const execStdout = opts?.execStdout ?? issueUrlStdout(n);
  const outcome =
    parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(execStdout);
  return {
    report,
    descriptor,
    commandArgs,
    searchStdout,
    plan,
    execStdout,
    outcome,
  };
}

describe("Smoke(non-gated): dual-leg run report descriptor→resolve→output-parse triple-boundary single-source closure(marker-as-search-medium) live-gh 0 검증", () => {
  describe("happy path — triple-boundary chain 산출", () => {
    it("단일 source(run + 두 leg outcome + N) → 세 boundary 산출물이 모두 정상(descriptor {title,marker,body} 비어있지 않음, plan.action update 분기 issueNumber 보유, outcome {issueNumber,url} 2필드 정확히 보유)", () => {
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
      expect(plan.argv[0]).toBe("issue");
      expect(plan.argv[1]).toBe("edit");

      // output-parse 는 {issueNumber, url} 2필드만 정확히 보유(raw 미저장).
      expect(Object.keys(outcome).sort()).toEqual(["issueNumber", "url"]);
      expect(typeof outcome.issueNumber).toBe("number");
      expect(typeof outcome.url).toBe("string");
    });
  });

  describe("핵심 1 — marker → searchQuery → resolve 매개 무결성(marker-as-search-medium)", () => {
    it("(a) commandArgs.searchQuery 가 descriptor.marker 와 byte-identical", () => {
      const { descriptor, commandArgs } = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        7,
      );
      expect(commandArgs.searchQuery).toBe(descriptor.marker);
    });

    it("(b) descriptor.marker 가 run-token `${dateToken}@${gitSha}` 를 substring 으로 포함(marker 가 run 식별 매체)", () => {
      const run = { ...RUN_A };
      const { descriptor } = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        run,
        7,
      );
      const token = runTokenOf(run);
      expect(descriptor.marker).toContain(token);
      // 구조적 검증 — split 으로 token 이 marker 안 한 덩어리로 존재.
      expect(descriptor.marker.split(token).length).toBeGreaterThan(1);
    });

    it("(c) 그 marker(=searchQuery)를 body 에 담은 searchStdout 이 resolve 를 update 분기로 이끎", () => {
      const { plan } = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        13,
      );
      expect(plan.action.action).toBe("update");
    });
  });

  describe("핵심 2 — triple-boundary issueNumber single-source 수렴", () => {
    it("search hit N → resolve 해소 plan.action.update.issueNumber → output-parse outcome.issueNumber 가 세 지점 모두 동일 N(resolve↔output-parse 경계 drift 0)", () => {
      const N = 314;
      const { plan, outcome } = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        N,
      );
      // discriminated union narrowing 후 세 지점 수렴 단언.
      expect(plan.action.action).toBe("update");
      if (plan.action.action === "update") {
        expect(plan.action.issueNumber).toBe(N);
      }
      expect(outcome.issueNumber).toBe(N);
      expect(outcome.url).toContain(`/issues/${N}`);
    });
  });

  describe("branch — 검색 미스 → create 분기 격리(output-parse 무관)", () => {
    it("동일 run·leg outcome 이되 searchStdout 을 빈 hit('[]')로 합성 → plan.action create 분기(argv 선두 'issue create'), output-parse 는 여전히 execStdout 의 N 으로 issueNumber 산출(검색 결과 변경이 실행-stdout 해석에 누설 0)", () => {
      const N = 55;
      const { plan, outcome } = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        N,
        { searchStdout: "[]" },
      );
      expect(plan.action).toEqual({ action: "create" });
      expect(plan.argv[0]).toBe("issue");
      expect(plan.argv[1]).toBe("create");
      // resolve create 분기 진입이 output-parse issueNumber 산출 경로와 독립.
      expect(outcome.issueNumber).toBe(N);
      expect(outcome.url).toContain(`/issues/${N}`);
    });

    it("create/update 두 분기 모두 descriptor.marker run-token 은 동일(marker 는 run 만의 함수)", () => {
      const N = 55;
      const updateChain = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        N,
      );
      const createChain = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        N,
        { searchStdout: "[]" },
      );
      expect(createChain.descriptor.marker).toBe(updateChain.descriptor.marker);
    });
  });

  describe("branch — run 분포 변별성(다른 run→다른 marker, issueNumber 는 run-독립)", () => {
    it("(a) 서로 다른 run(RUN_A / RUN_B) 각각 동일 N chain → 두 descriptor.marker(=searchQuery) 가 서로 다름(각 run-token 으로 분리)", () => {
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
    });

    it("(b) 그러나 두 chain 의 outcome.issueNumber 는 동일 N(issueNumber 는 search/exec-stdout 종속, run 무관)", () => {
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
      expect(chainA.outcome.issueNumber).toBe(N);
      expect(chainB.outcome.issueNumber).toBe(N);
      expect(chainA.outcome.issueNumber).toBe(chainB.outcome.issueNumber);
    });
  });

  describe("branch — leg outcome / summary 무관 marker 격리(partial-thread 격리)", () => {
    it("(a) 동일 run 고정, leg outcome 조합만 다르게(pass/pass vs fail/skip) → 두 descriptor.marker(=searchQuery) 동일(marker 는 run 만의 함수, REQ-009 '동일 run → 동일 marker')", () => {
      const run = { ...RUN_A };
      const N = 21;
      const passChain = assembleViaChain(
        { leg: "eval", action: "run", passed: true },
        { leg: "collect", action: "run", passed: true },
        run,
        N,
      );
      const mixedChain = assembleViaChain(
        { leg: "eval", action: "run", passed: false },
        { leg: "collect", action: "skip" },
        { ...RUN_A },
        N,
      );
      expect(passChain.descriptor.marker).toBe(mixedChain.descriptor.marker);
      expect(passChain.commandArgs.searchQuery).toBe(
        mixedChain.commandArgs.searchQuery,
      );
    });

    it("(b) 따라서 동일 marker → 동일 searchStdout hit → resolve 가 두 leg 조합 모두 같은 issueNumber N 으로 수렴", () => {
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
      expect(passChain.plan.action).toEqual({
        action: "update",
        issueNumber: N,
      });
      expect(mixedChain.plan.action).toEqual({
        action: "update",
        issueNumber: N,
      });
      expect(passChain.outcome.issueNumber).toBe(
        mixedChain.outcome.issueNumber,
      );
    });
  });

  describe("error path / negative cases — 예외 분기마다 각 1+ (세 boundary 거부 대칭)", () => {
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

    it("(c) searchStdout 비JSON/비배열('not json') → resolve(stage 3) 파서 위임 throw(marker 정상이어도 hits 추출 실패)", () => {
      expect(() =>
        assembleViaChain(evalOutcome(), collectOutcome(), { ...RUN_A }, 1, {
          searchStdout: "not json",
        }),
      ).toThrow();
    });

    it("(d) execStdout 에 issue URL 미발견(무관 텍스트) → output-parse(stage 4) throw(run 정상이어도 outcome 미산출)", () => {
      expect(() =>
        assembleViaChain(evalOutcome(), collectOutcome(), { ...RUN_A }, 1, {
          execStdout: "no url at all\n",
        }),
      ).toThrow();
    });

    it("(d-ii) execStdout 이 비-github 호스트/`/pull/` URL → output-parse(stage 4) throw(대칭)", () => {
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

    it("(e) execStdout URL 안 issueNumber 비양수(/issues/0·선행0·비정수) → output-parse(stage 4) throw(post 비식별)", () => {
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
    it("동일 (run, leg outcomes, searchStdout, execStdout) 입력 chain 두 번 → descriptor/commandArgs/plan/outcome 가 두 번 deep-equal", () => {
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
      expect(first.plan).toEqual(second.plan);
      expect(first.outcome).toEqual(second.outcome);
    });

    it("no-mutation — 입력 run/leg outcome literal 이 chain 호출 후 mutate 0(원본 deep-equal 유지)", () => {
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

    it("무공유 — 두 chain 산출물이 referential identity 분리(plan/argv/outcome not.toBe)", () => {
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
    it("chain 표면(descriptor.{title,marker,body} / searchQuery / argv / outcome.url)에 token/secret/raw narrative 어휘 미등장", () => {
      const { descriptor, commandArgs, plan, outcome } = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        42,
      );
      const joined = [
        descriptor.title,
        descriptor.marker,
        descriptor.body,
        commandArgs.searchQuery,
        ...plan.argv,
        outcome.url,
      ].join(" ");

      expect(joined).not.toContain("--token");
      expect(joined).not.toContain("GITHUB_TOKEN");
      expect(joined).not.toContain("GH_TOKEN");
      expect(joined).not.toContain("narrative");
      expect(joined).not.toMatch(/ghp_[A-Za-z0-9]/);
    });

    it("leg outcome.specPath 에 sentinel 을 넣어도 marker/searchQuery/issueNumber 표면에 sentinel 미누출(run-token 표면은 run 식별자 + status 파생만)", () => {
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
      const { descriptor, commandArgs, outcome } = assembleViaChain(
        evalLeg,
        collectLeg,
        { ...RUN_A },
        42,
      );
      expect(descriptor.marker).not.toContain(sentinel);
      expect(commandArgs.searchQuery).not.toContain(sentinel);
      expect(String(outcome.issueNumber)).not.toContain(sentinel);
      expect(descriptor.body).not.toContain(sentinel);
    });
  });
});
