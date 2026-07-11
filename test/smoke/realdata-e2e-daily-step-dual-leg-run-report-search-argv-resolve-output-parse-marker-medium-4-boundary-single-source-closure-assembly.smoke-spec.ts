// realdata-e2e-daily-step-dual-leg-run-report-search-argv-resolve-output-parse-
// marker-medium-4-boundary-single-source-closure-assembly.smoke-spec.ts —
// 실 평가 e2e daily-step dual-leg run report 의 네 boundary(pre-execution descriptor →
// command-args(searchQuery=marker) → search-gh-argv(marker-as-argv-element) →
// command-plan resolve → post-execution output-parse)를 marker-as-search-medium 축으로
// 묶은 single-source closure non-gated build-time smoke (T-0919 박제, PLAN.md 109행
// 🟢 실 평가 e2e step ④).
//
// 본 spec 의 존재 이유 — 4-boundary marker-as-search-medium single-source closure gap 해소:
//   - step ④(daily-test dual-leg run 결과 rolling-issue 멱등 박제)의 live wiring 은 한
//     실행 사이클 안에서 네 boundary 를 순서대로 엮는다:
//       (1) pre-execution descriptor — buildRealDataDailyStepDualLegRunReportIssueDescriptor
//           → {title, marker, body}. marker 안에 run-token `${dateToken}@${gitSha}` 박제.
//       (2) command-args — buildRealDataDailyStepDualLegRunReportIssueCommandArgs →
//           {searchQuery, ...}. `searchQuery` 는 descriptor.marker 를 그대로 담는다.
//       (3) search-gh-argv — buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv →
//           ["search","issues","--match","body",searchQuery,"--json",...,"--limit","30"].
//           searchQuery(=marker)가 실 `gh search issues` argv 의 단일 원소로 운반된다 —
//           marker 가 곧 실 live 검색 매체.
//       (4) resolve — resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
//           searchStdout, commandArgs) → {action, argv}. marker(=searchQuery)로 검색해
//           hit 1+ → action.update(최소 number N), hit 0 → action.create.
//       (5) post-execution output-parse — parseRealDataDailyStepDualLegRunReportIssue
//           CreateEditOutput(execStdout) → {issueNumber, url}.
//   - 형제 smoke 두 개가 각각 절반만 닫았다:
//       * T-0918(descriptor→command-args→resolve→output-parse triple-boundary) 는 resolve
//         와 output-parse 를 한 chain 으로 닫았으나 `searchGhArgv` boundary 를 건너뛴다 —
//         commandArgs.searchQuery 에서 곧바로 synthetic searchStdout 으로 점프하며, 실
//         runner 가 `gh search` 에 넘길 argv 원소가 marker 를 byte-identical 로 운반하는지
//         미단언(검색 매체가 실제 argv 로는 무엇인가는 gap).
//       * T-0912(report→…→searchArgv→resolve forward assembly) 는 searchGhArgv 를 포함하나
//         output-parse(post) boundary 를 건너뛴다(forward-only) — searchArgv 의 marker
//         원소가 최종 실행 stdout 의 issueNumber 로 이어지는 post-through-line 미단언.
//   - 본 spec 은 요약 축 T-0766(publish-plan↔search-argv↔resolve↔descriptor marker 4-way
//     convergence)의 dual-leg 축 mirror 로, `report → descriptor → commandArgs →
//     searchArgv(marker 원소) → resolve → output-parse` 종단 조립에서 marker(run-token
//     보유)가 실 `gh search` argv 원소로서 검색 매체로 chain 을 관통하고 issueNumber 가
//     resolve↔output-parse 를 한 chain 안에서 수렴함만 닫는다(T-0918 triple-boundary·
//     T-0912 forward 와 직교 — 재단언 0). 따라서 본 spec 은:
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
// Out of Scope (T-0919):
//   - 형제 triple-boundary smoke(T-0918)의 descriptor→resolve→output-parse issueNumber
//     수렴 자체 단독 재단언 — 본 spec 은 그 위에 searchGhArgv(실 gh search argv, marker
//     원소) single-source 관통 각도만 추가.
//   - 형제 forward publish-assembly smoke(T-0912)의 report→…→searchArgv forward 조립·
//     searchArgv argv 원소 순서/`--match body`/`--limit` 형식 재단언 — 본 spec 은 그 위에
//     post output-parse boundary + marker 원소가 검색 매체로 관통함만 추가.
//   - markdown assembly(T-0914)·body/identity confluence(T-0915/T-0916)·run-token
//     cross-surface(T-0917) 재검증 — 각 절단면 이미 닫힘. 본 spec 은 issueNumber
//     4-boundary + marker-as-search-medium(argv 포함) 관통만.
//   - commandArgs 의 createArgs/updateArgs/labels 정합·gh create/edit argv 합성 재단언
//     (command-args·gh-argv 가드 cover). descriptor.body 의 marker→markdown 2블록 구조
//     재단언(body confluence 가드 cover). 본 spec 은 title/marker(=searchQuery=searchArgv
//     원소) 축 + issueNumber 만.
//   - 새 컴포저 / consistency 가드 / helper / type 신설 — 기존 helper import·호출만.
//   - production src/ 코드 / package.json / lockfile / test/jest-smoke.json 변경.
import {
  buildRealDataDailyStepDualLegRunReport,
  type RealDataDailyStepLegRunOutcome,
} from "../helpers/realdata-e2e-daily-step-dual-leg-run-report";
import {
  buildRealDataDailyStepDualLegRunReportIssueCommandArgs,
  type RealDataDailyStepDualLegRunReportIssueCommandArgs,
} from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
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

// 4-boundary single-source 조립 진입점 — 단일 source(run + 두 leg outcome + searchStdout +
// execStdout) 로부터 네 boundary(descriptor / searchArgv / resolve / output-parse)를 한
// chain 으로 관통시킨다. searchArgv boundary 를 삽입해 marker 가 실 `gh search` argv 원소로
// 운반됨을 chain 안에서 노출한다. 각 stage 의 guard throw 는 자체 try/catch 없이 그대로
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
  // (3) search-gh-argv — searchQuery(=marker)를 실 gh search argv 의 단일 원소로 운반.
  const searchArgv =
    buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs);
  // (4) resolve — marker(=searchQuery) 담은 searchStdout 로 update/create 분기 해소.
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

describe("Smoke(non-gated): dual-leg run report search-argv→resolve→output-parse 4-boundary marker-as-search-medium single-source closure live-gh 0 검증", () => {
  describe("happy path — 4-boundary chain 산출", () => {
    it("단일 source(run + 두 leg outcome + N) → 네 boundary 산출물이 모두 정상(descriptor {title,marker,body} 비어있지 않음, searchArgv 비어있지 않은 string[], plan.action update 분기 issueNumber 보유, outcome {issueNumber,url} 2필드 정확히 보유)", () => {
      const N = 42;
      const { descriptor, searchArgv, plan, outcome } = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        N,
      );

      // descriptor 세 필드 비어있지 않음.
      expect(descriptor.title.length).toBeGreaterThan(0);
      expect(descriptor.marker.length).toBeGreaterThan(0);
      expect(descriptor.body.length).toBeGreaterThan(0);

      // searchArgv 는 비어있지 않은 string[].
      expect(Array.isArray(searchArgv)).toBe(true);
      expect(searchArgv.length).toBeGreaterThan(0);
      expect(searchArgv.every((el) => typeof el === "string")).toBe(true);

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

  describe("핵심 1 — searchArgv marker-element byte-identical(marker-as-search-medium)", () => {
    it("(a) searchArgv 안에 descriptor.marker 가 byte-identical 단일 원소로 포함", () => {
      const { descriptor, searchArgv } = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        7,
      );
      expect(searchArgv).toContain(descriptor.marker);
      expect(searchArgv.includes(descriptor.marker)).toBe(true);
    });

    it("(b) 실 gh search argv 원소 · commandArgs.searchQuery · descriptor.marker 세 곳이 한 marker 로 수렴", () => {
      const { descriptor, commandArgs, searchArgv } = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        7,
      );
      expect(commandArgs.searchQuery).toBe(descriptor.marker);
      expect(searchArgv).toContain(commandArgs.searchQuery);
      // 세 지점 동일 marker 로 수렴(argv 원소 = searchQuery = descriptor.marker).
      const markerElements = searchArgv.filter(
        (el) => el === descriptor.marker,
      );
      expect(markerElements).toEqual([descriptor.marker]);
    });

    it("(c) argv 로 운반되는 그 marker 가 run-token `${dateToken}@${gitSha}` 를 substring 으로 포함(검색 매체가 run 식별 token 보유)", () => {
      const run = { ...RUN_A };
      const { descriptor, searchArgv } = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        run,
        7,
      );
      const token = runTokenOf(run);
      expect(descriptor.marker).toContain(token);
      // searchArgv 원소로 운반되는 marker 도 동일 run-token 보유.
      const markerEl = searchArgv.find((el) => el === descriptor.marker);
      expect(markerEl).toBeDefined();
      expect(markerEl as string).toContain(token);
      // 구조적 검증 — split 으로 token 이 marker 안 한 덩어리로 존재.
      expect(descriptor.marker.split(token).length).toBeGreaterThan(1);
    });
  });

  describe("핵심 1 연장 — marker → resolve 검색 매체 관통(argv boundary 관통)", () => {
    it("searchArgv 가 운반하는 marker(=searchQuery)를 body 에 담은 searchStdout 을 resolve 에 넘기면 update 분기로 이끎(argv 로 운반될 marker 가 resolve stage 의 검색 매체)", () => {
      const { searchArgv, descriptor, plan } = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        13,
      );
      // argv 가 실제로 marker 를 운반하고 있음을 먼저 확인.
      expect(searchArgv).toContain(descriptor.marker);
      // 그 marker 로 검색한 searchStdout 이 resolve 를 update 로 이끎.
      expect(plan.action.action).toBe("update");
    });
  });

  describe("핵심 2 — 4-boundary marker / issueNumber single-source 수렴", () => {
    it("marker 가 descriptor.marker→searchQuery→searchArgv 원소 세 지점 동일 AND N 이 search hit→resolve plan.action.update.issueNumber→output-parse outcome.issueNumber 세 지점 동일(4-boundary drift 0)", () => {
      const N = 314;
      const { descriptor, commandArgs, searchArgv, plan, outcome } =
        assembleViaChain(evalOutcome(), collectOutcome(), { ...RUN_A }, N);

      // marker 3지점 수렴.
      expect(commandArgs.searchQuery).toBe(descriptor.marker);
      expect(searchArgv).toContain(descriptor.marker);

      // issueNumber 3지점 수렴(discriminated union narrowing 후).
      expect(plan.action.action).toBe("update");
      if (plan.action.action === "update") {
        expect(plan.action.issueNumber).toBe(N);
      }
      expect(outcome.issueNumber).toBe(N);
      expect(outcome.url).toContain(`/issues/${N}`);
    });
  });

  describe("branch — 검색 미스 → create 분기 격리(searchArgv/output-parse 무관)", () => {
    it("동일 run·leg outcome 이되 searchStdout 을 빈 hit('[]')로 합성 → plan.action create 분기, searchArgv 는 여전히 동일 marker 원소 운반(검색 결과가 argv 합성에 누설 0), output-parse 는 여전히 execStdout 의 N 으로 issueNumber 산출", () => {
      const N = 55;
      const { descriptor, searchArgv, plan, outcome } = assembleViaChain(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        N,
        { searchStdout: "[]" },
      );
      // create 분기.
      expect(plan.action).toEqual({ action: "create" });
      expect(plan.argv[0]).toBe("issue");
      expect(plan.argv[1]).toBe("create");
      // searchArgv 는 검색 결과와 무관하게 동일 marker 원소 운반.
      expect(searchArgv).toContain(descriptor.marker);
      // output-parse 는 검색 분기 변경과 독립적으로 execStdout 의 N 산출.
      expect(outcome.issueNumber).toBe(N);
      expect(outcome.url).toContain(`/issues/${N}`);
    });

    it("create/update 두 분기 모두 searchArgv 가 운반하는 marker 원소는 동일(marker 는 run 만의 함수, 검색 분기 무관)", () => {
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
      expect(createChain.searchArgv).toContain(updateChain.descriptor.marker);
      expect(createChain.descriptor.marker).toBe(updateChain.descriptor.marker);
    });
  });

  describe("branch — run 분포 변별성(다른 run→다른 searchArgv marker 원소, issueNumber 는 run-독립)", () => {
    it("(a) 서로 다른 run(RUN_A / RUN_B) 각각 동일 N chain → 두 searchArgv 가 운반하는 marker 원소가 서로 다름(실 검색 매체가 run 별 분리)", () => {
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
      // 각 chain 의 searchArgv 는 자신의 descriptor.marker 를 운반.
      expect(chainA.searchArgv).toContain(chainA.descriptor.marker);
      expect(chainB.searchArgv).toContain(chainB.descriptor.marker);
      // 두 marker 원소는 서로 다름(run-token 분리).
      expect(chainA.descriptor.marker).not.toBe(chainB.descriptor.marker);
      expect(chainB.searchArgv).not.toContain(chainA.descriptor.marker);
    });

    it("(b) 그러나 두 chain 의 outcome.issueNumber 는 동일 N(issueNumber 는 exec-stdout 종속, run 무관)", () => {
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

  describe("branch — leg outcome 무관 searchArgv marker 격리(partial-thread 격리)", () => {
    it("(a) 동일 run 고정, leg outcome 조합만 다르게(pass/pass vs fail/skip) → 두 searchArgv 가 운반하는 marker 원소 동일(marker 는 run 만의 함수, REQ-009 '동일 run → 동일 marker')", () => {
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
      expect(passChain.descriptor.marker).toBe(mixedChain.descriptor.marker);
      expect(passChain.searchArgv).toContain(passChain.descriptor.marker);
      expect(mixedChain.searchArgv).toContain(passChain.descriptor.marker);
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

  describe("error path / negative cases — 예외 분기마다 각 1+ (네 boundary 거부 대칭)", () => {
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

    it("(c) 빈/공백 searchQuery 를 담은 commandArgs literal → buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(stage 3) 의 assertSearchQueryNonBlank throw(searchArgv boundary 자체 거부 대칭)", () => {
      const blankQueryCommandArgs: RealDataDailyStepDualLegRunReportIssueCommandArgs =
        {
          searchQuery: "   ",
          createArgs: { title: "제목", body: "본문", labels: ["l"] },
          updateArgs: { title: "제목", body: "본문" },
        };
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(
          blankQueryCommandArgs,
        ),
      ).toThrow();
    });

    it("(d) searchStdout 비JSON/비배열('not json') → resolve(stage 4) 파서 위임 throw(marker/argv 정상이어도 hits 추출 실패)", () => {
      expect(() =>
        assembleViaChain(evalOutcome(), collectOutcome(), { ...RUN_A }, 1, {
          searchStdout: "not json",
        }),
      ).toThrow();
    });

    it("(e-i) execStdout 에 issue URL 미발견(무관 텍스트) 또는 비-github/`/pull/` → output-parse(stage 5) throw(post 미산출)", () => {
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

    it("(e-ii) execStdout URL 안 issueNumber 비양수(/issues/0·선행0·비정수) → output-parse(stage 5) throw(post 비식별)", () => {
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
    it("동일 (run, leg outcomes, searchStdout, execStdout) 입력 chain 두 번 → descriptor/commandArgs/searchArgv/plan/outcome 가 두 번 deep-equal", () => {
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
      expect(first.outcome).toEqual(second.outcome);
    });

    it("no-mutation — 입력 run/leg outcome literal · commandArgs 가 searchArgv 호출 후 mutate 0(원본 deep-equal 유지)", () => {
      const run: RealDataResultIssueRunRef = { ...RUN_A };
      const evalLeg = evalOutcome();
      const collectLeg = collectOutcome();
      const runBefore = JSON.parse(JSON.stringify(run));
      const evalBefore = JSON.parse(JSON.stringify(evalLeg));
      const collectBefore = JSON.parse(JSON.stringify(collectLeg));

      const { commandArgs } = assembleViaChain(evalLeg, collectLeg, run, 42);
      const commandArgsSnapshot = JSON.parse(JSON.stringify(commandArgs));
      // searchArgv 재호출 후에도 commandArgs 원본 불변.
      buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs);

      expect(run).toEqual(runBefore);
      expect(evalLeg).toEqual(evalBefore);
      expect(collectLeg).toEqual(collectBefore);
      expect(commandArgs).toEqual(commandArgsSnapshot);
    });

    it("무공유 — searchArgv 반환 배열이 입력/다음 호출 결과와 referential identity 분리(not.toBe)", () => {
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
      expect(first.searchArgv).not.toBe(second.searchArgv);
      expect(first.plan).not.toBe(second.plan);
      expect(first.plan.argv).not.toBe(second.plan.argv);
      expect(first.outcome).not.toBe(second.outcome);
      expect(first.descriptor).not.toBe(second.descriptor);
    });
  });

  describe("raw / credential 누출 0(R-59 / REQ-059)", () => {
    it("chain 표면(descriptor.{title,marker,body} / searchQuery / searchArgv 전체 / plan.argv / outcome.url)에 token/secret/raw narrative 어휘 미등장", () => {
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

    it("leg outcome.specPath 에 sentinel 을 넣어도 marker/searchArgv/issueNumber 표면에 sentinel 미누출(run-token 표면은 run 식별자 + status 파생만)", () => {
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
      const { descriptor, commandArgs, searchArgv, outcome } = assembleViaChain(
        evalLeg,
        collectLeg,
        { ...RUN_A },
        42,
      );
      expect(descriptor.marker).not.toContain(sentinel);
      expect(commandArgs.searchQuery).not.toContain(sentinel);
      expect(searchArgv.join(" ")).not.toContain(sentinel);
      expect(String(outcome.issueNumber)).not.toContain(sentinel);
      expect(descriptor.body).not.toContain(sentinel);
    });
  });
});
