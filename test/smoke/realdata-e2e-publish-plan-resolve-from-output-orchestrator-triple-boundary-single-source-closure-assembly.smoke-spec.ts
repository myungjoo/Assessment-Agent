// realdata-e2e-publish-plan-resolve-from-output-orchestrator-triple-boundary-single-source-closure-assembly.smoke-spec.ts
// — 실 평가 e2e step④ top-orchestrator pre→resolve→post triple-boundary single-source
// closure: 최상위 orchestrator buildRealDataResultIssuePublishPlan(results, run) 진입 →
// resolve → outcome-report-from-output 세 boundary 를 한 chain 으로 동시-호출하는 첫
// full-orchestrator triple-boundary single-source closure non-gated build-time smoke
// (T-0770 박제, PLAN.md 109행 🟢 실 평가 e2e step④).
//
// 본 spec 의 존재 이유 — public CI gap 해소(최상위 orchestrator 가 chain 시작 source):
//   - PLAN 109행 step④(결과 이슈 박제)의 멱등 search-or-update 의 **pre-execution
//     build-time chain 의 최상위 단일 진입점**은 `buildRealDataResultIssuePublishPlan(
//     results, run)`(T-0595) 이다 — 실 live runner 가 `EvaluationResult[]` + run 식별자
//     만 넘기면 받게 되는 "결과 리포트 + 멱등 명령-args + 실행할 첫 gh argv(search)" 한
//     묶음 `{report, commandArgs, searchArgv}` 를 산출한다. 그 `report.descriptor.marker`
//     (run token 박제) / `commandArgs.searchQuery`(=marker) 는 모두 동일 `(results, run)`
//     single-source 에서 도출된다.
//   - 실 live caller 는 한 실행 사이클 안에서 그 최상위 orchestrator 산출을 시작으로:
//       (1) pre-execution top orchestrator
//           `publishPlan = buildRealDataResultIssuePublishPlan(results, run)`(T-0595) →
//           `{report, commandArgs, searchArgv}`. `report.descriptor.marker` 안에
//           `${run.dateToken}@${run.gitSha}` run token 박제, `commandArgs.searchQuery ===
//           report.descriptor.marker`.
//       (2) resolve
//           `resolvePlan = resolveRealDataResultIssueGhCommandPlan(searchStdout,
//           publishPlan.commandArgs)`(T-0588) → `{action, argv}`. marker(=
//           publishPlan.commandArgs.searchQuery)로 기존 이슈를 검색해 hit 1+ → update 분기
//           `{action:'update', issueNumber: N}`(최소 number).
//       (3) post-execution interpretation 단일-진입
//           `outcomeReport = buildRealDataResultIssueOutcomeReportFromOutput(execStdout,
//           run)`(T-0596) → `{issueNumber, url, gitSha, dateToken, summaryLine}`. execStdout
//           URL(`/issues/N`)의 issueNumber + run 의 gitSha/dateToken 전파.
//   - 이 세 boundary 가 **동일 단일 source `(results, run, search-stdout, exec-stdout)`**
//     로부터 도출된 marker run token / issueNumber / run-identity 를 **한 chain 으로 묶어**
//     byte-identical 수렴함이 search-or-update 멱등성(REQ-009)·결과 리포트 재실행 정합
//     (REQ-037)의 종단 full-orchestrator 사람-친화 닫음이다 — "최상위 orchestrator 가 산출한
//     marker 로 검색해 찾은 이슈 N" 과 "실행 stdout 으로부터 해석한 이슈 N·run-identity" 가
//     같은 single-source 에서 drift 0 으로 수렴.
//   - 직전 sibling 들은 진입점·boundary 수가 달랐다:
//       T-0769 — descriptor(하위 컴포저) 진입 triple-boundary closure — 최상위 orchestrator
//         (buildRealDataResultIssuePublishPlan) 미참조.
//       T-0766 — publish-plan↔search-argv↔resolve↔descriptor marker 4자 — publishPlan 진입
//         하나 전부 pre boundary(post from-output 합류 0).
//       T-0768 — descriptor↔from-output run-identity 2-boundary — publishPlan 미진입.
//       T-0767 — resolve↔from-output issueNumber 2-boundary — publishPlan·descriptor 미진입.
//   - 본 spec 은 그 자리를 채워 **publishPlan(top orchestrator) 진입 + resolve +
//     from-output(post) 세 boundary 를 한 chain 으로 동시-호출** 하는 첫 full-orchestrator
//     triple-boundary single-source closure 다. 새 단언:
//       (A) 최상위 orchestrator 가 산출한 marker(publishPlan.commandArgs.searchQuery)로
//           검색한 이슈 N(resolvePlan.action.issueNumber) ↔ 실행 stdout 해석 이슈 N
//           (outcomeReport.issueNumber)의 cross-boundary 일치, AND
//       (B) publishPlan.report.descriptor.marker run token ↔ outcomeReport.{gitSha,dateToken}
//           run-identity 의 cross-boundary 일치, AND
//       (C) publishPlan.commandArgs 가 resolve 입력으로 직결(orchestrator-output-as-resolve-input)
//       가 **한 chain 안에서 동시에** 성립.
//   - live leg(실 prisma·실 collectForPerson·실 github.com fetch·실 LLM scoring·실 gh CLI
//     실행·DB·LAN gate)는 복제하지 않고, synthetic results/run literal + search-stdout/
//     exec-stdout literal 을 컴포저들에 직접 공급해 live leg 를 우회한다(조립 surface 만
//     검증). 따라서 본 spec 은:
//
//      🔥 실 gh 호출 0 — gh search / create / edit / execFile('gh', argv) 미실행.
//         synthetic searchStdout / execStdout / run / results literal 직접 공급.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 LLM 호출 0 / 실 DB 접근 0 / 실 jest spawn 0 — triple-boundary 수렴 조립만.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 publish-plan / gh-command-plan /
//         outcome-report-from-output 컴포저 import 재사용만(가드/helper 신설 0).
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0770):
//   - descriptor 진입 triple-boundary closure(descriptor→resolve→from-output) 자체 재단언
//     (T-0769 cover). 본 task 는 chain 시작을 최상위 orchestrator
//     buildRealDataResultIssuePublishPlan 로 잡아 full-orchestrator 로 확장하는 부분만.
//   - marker 4자 cross-stage 수렴(publishPlan.searchArgv↔search-argv↔resolve↔descriptor.marker,
//     pre 전부) 재단언(T-0766 cover). 본 task 는 post from-output 합류만.
//   - resolve↔from-output issueNumber 2-boundary 수렴 자체 단독 재단언(T-0767 cover).
//   - descriptor↔from-output run-identity 2-boundary 수렴 자체 단독 재단언(T-0768 cover).
//   - publishPlan 의 report/commandArgs/searchArgv 개별 필드 shape·self-wire 가드 정합
//     재단언(publish-plan-tri-leg / T-0729 cover). 본 task 는 cross-boundary 수렴만.
//   - commandArgs 의 createArgs/updateArgs 정합·labels 재단언(command-args 가드 cover).
//   - resolve 의 argv 합성(gh issue create/edit argv 형식·플래그 순서) 재단언(gh-command-plan
//     가드 cover). 본 task 는 action.update.issueNumber 해소 결과만.
//   - from-output 단독 5필드(url trim 정규화·summaryLine 합성) 재유도 재단언(T-0747 cover).
//   - descriptor.body 의 3블록 구조 무결성 재단언(descriptor body 가드 cover).
//   - DB 의존(prisma client·테스트 DB·migration) / live-LLM·실 fetch·실 collectForPerson 0.
//   - 새 helper 모듈 신설 / 기존 helper 수정 — test-only(신규 smoke spec 1 파일).
//   - production src/ 코드 / package.json / test/jest-smoke.json 변경.
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";
import type { RealDataResultIssueRunRef } from "../helpers/realdata-e2e-result-issue-descriptor";
import { resolveRealDataResultIssueGhCommandPlan } from "../helpers/realdata-e2e-result-issue-gh-command-plan";
import { buildRealDataResultIssueOutcomeReportFromOutput } from "../helpers/realdata-e2e-result-issue-outcome-report-from-output";
import { buildRealDataResultIssuePublishPlan } from "../helpers/realdata-e2e-result-issue-publish-plan";

// 결정론 owner/repo — 합성 issue URL 의 path segment source(public CI 에서 항상 green
// 발화). token/secret/PAT/--auth 어휘 미포함.
const OWNER = "myungjoo";
const REPO = "assessment-agent";

// 결정론 run 식별자 fixture — publishPlan(report.descriptor.marker run token)·from-output
// (run-identity 전파)가 공유하는 단일 run source. 비공백 안정 토큰이라 하위 report-plan·
// builder 의 assertNonBlank guard 를 자극하지 않는다.
function validRun(
  gitSha = "abc1234",
  dateToken = "2026-06-28",
): RealDataResultIssueRunRef {
  return { gitSha, dateToken };
}

// 합성 run-token — descriptor 컴포저 내부 `runToken(run) = ${dateToken}@${gitSha}` 및
// outcome-report 의 summaryLine `[${dateToken}@${gitSha}] ...` 와 동일 규칙으로 test 측에서
// 재유도한 expected 공유 substring. literal prefix 는 private 이라 만지지 않고, 이 token 이
// pre(publishPlan.report.descriptor.marker) / post(gitSha·dateToken·summaryLine) 두 boundary
// 양쪽에 등장함을 단언한다.
function expectedToken(run: RealDataResultIssueRunRef): string {
  return `${run.dateToken}@${run.gitSha}`;
}

// synthetic EvaluationResult 1 건 — publishPlan 컴포저는 결과 배열을 요약 집계
// (count·분포·totalVolume) → report.summary / descriptor.body 로만 흘려보내고
// marker·title 은 run 만의 함수이므로, 도메인 타입 정합(difficulty / contribution 멤버십)만
// 만족하는 minimal literal 로 충분하다. 실 LLM 호출 없이 EvaluationResult shape 만 강제한다.
function syntheticResult(
  unitId: string,
  difficulty: EvaluationResult["difficulty"],
  contribution: EvaluationResult["contribution"],
  volume: number,
): EvaluationResult {
  return {
    unitId,
    narrative:
      "synthetic evaluation narrative — publishPlan↔resolve↔from-output full-orchestrator triple-boundary closure smoke fixture",
    difficulty,
    contribution,
    volume,
  };
}

// 유효 results fixture — buildRealDataResultIssuePublishPlan 의 첫 인자(EvaluationResult[]).
// 분포 값만 다르게 줄 수 있도록 합성 결과 배열을 반환한다(results 무관 격리 시나리오에서
// 분포 A·B 분리 입력).
function defaultResults(): EvaluationResult[] {
  return [
    syntheticResult("github:github.com:c1", "easy", "low", 3),
    syntheticResult("github:github.com:c2", "medium", "high", 5),
    syntheticResult("github:github.com:c3", "hard", "medium", 2),
  ];
}

// marker(=searchQuery)를 body 에 포함한 hit 1+건 search stdout 합성 헬퍼 — 동일 run 이슈가
// 이미 존재하는 경우(resolve update 분기 유발). hit 들의 number 슬롯을 임의로 받아 최소
// number 를 resolve 가 picked 하게 한다. hit 의 marker 는 publishPlan.commandArgs.searchQuery
// (=report.descriptor.marker)를 그대로 담아 resolve 의 검색 매체가 chain 의 최상위
// orchestrator 산출 marker 임을 보장한다.
function multiHitStdout(marker: string, numbers: number[]): string {
  return JSON.stringify(
    numbers.map((n, i) => ({
      number: n,
      title: `결과 이슈(#${i})`,
      body: `본문 ${i}\n${marker}\n끝`,
    })),
  );
}

// synthetic gh issue edit stdout 합성 헬퍼 — `gh issue edit <N>` 의 stdout 은
// https://github.com/<owner>/<repo>/issues/<N> URL 한 줄 + 부가 메시지/개행을 포함할 수 있다.
// 본 helper 는 그 happy-path 형상을 N 별로 합성한다(from-output 내부 parse 가 첫 매칭 URL
// 결정론으로 추출하는 surface 직접 자극).
function execStdout(n: number, noisePrefix = ""): string {
  return `${noisePrefix}https://github.com/${OWNER}/${REPO}/issues/${n}\n`;
}

// publishPlan(top orchestrator) → resolve(search-stdout + publishPlan.commandArgs →
// action.update.issueNumber) → from-output(post)를 single-source(results + run + N)로 묶어
// 한 chain 으로 호출하는 헬퍼. update 분기를 강제하며(후보 1+건 stdout), resolver 가 picked
// 한 N 을 execStdout 에 흘려 from-output 이 동일 N 을 산출하게 한다. 세 boundary 산출물 +
// expectedMinN 을 한 번에 반환해 triple-boundary 단언을 짧게 묶는다.
function runChain(
  hitsNumbers: number[],
  run: RealDataResultIssueRunRef = validRun(),
  results: EvaluationResult[] = defaultResults(),
  noisePrefix = "",
): {
  expectedMinN: number;
  publishPlan: ReturnType<typeof buildRealDataResultIssuePublishPlan>;
  resolvePlan: ReturnType<typeof resolveRealDataResultIssueGhCommandPlan>;
  outcomeReport: ReturnType<
    typeof buildRealDataResultIssueOutcomeReportFromOutput
  >;
} {
  // stage 1(pre boundary, top orchestrator) — publishPlan: {report, commandArgs, searchArgv}.
  // report.descriptor.marker 안에 run token 박제, commandArgs.searchQuery = marker.
  const publishPlan = buildRealDataResultIssuePublishPlan(results, run);

  // stage 2(resolve) — searchStdout(marker hit 1+) + publishPlan.commandArgs →
  // action.update.issueNumber. publishPlan.commandArgs 를 두 번째 인자로 그대로 직결.
  const expectedMinN = Math.min(...hitsNumbers);
  const searchStdout = multiHitStdout(
    publishPlan.commandArgs.searchQuery,
    hitsNumbers,
  );
  const resolvePlan = resolveRealDataResultIssueGhCommandPlan(
    searchStdout,
    publishPlan.commandArgs,
  );
  if (resolvePlan.action.action !== "update") {
    throw new Error("update action 기대 — 후보 1+건 입력");
  }
  const resolvedN = resolvePlan.action.issueNumber;

  // stage 3(post boundary) — caller 가 그 N 으로 `gh issue edit N ...` 실행 후 받는 stdout
  // + 동일 run 을 from-output 단일-진입 컴포저에 직접 공급(내부 parse→outcome-report 위임).
  const outcomeReport = buildRealDataResultIssueOutcomeReportFromOutput(
    execStdout(resolvedN, noisePrefix),
    run,
  );

  return { expectedMinN, publishPlan, resolvePlan, outcomeReport };
}

describe("Smoke(non-gated): 실 평가 e2e step④ top-orchestrator pre→resolve→post triple-boundary single-source closure publishPlan↔resolve↔outcome-report-from-output 세 boundary 한 chain 동시-호출(marker run token + issueNumber 동시 수렴) live-gh 0 검증", () => {
  describe("happy path — 세 boundary 컴포저 모두 정상 산출(publishPlan + resolve plan + outcome-report-from-output)", () => {
    it("(a) 유효 results + run + searchStdout + execStdout → publishPlan({report,commandArgs,searchArgv} 비어있지 않음·report.descriptor.marker 존재) / resolvePlan(update {action, issueNumber} + argv) / outcomeReport(5필드) 세 산출물 모두 정상", () => {
      const { publishPlan, resolvePlan, outcomeReport } = runChain([7, 13]);

      // stage 1 — publishPlan({report, commandArgs, searchArgv} 비어있지 않음).
      expect(typeof publishPlan.report).toBe("object");
      expect(typeof publishPlan.commandArgs).toBe("object");
      expect(Array.isArray(publishPlan.searchArgv)).toBe(true);
      expect(publishPlan.searchArgv.length).toBeGreaterThan(0);
      // report.descriptor.marker reachable(최상위 orchestrator 출력에서 도달 가능).
      expect(typeof publishPlan.report.descriptor.marker).toBe("string");
      expect(publishPlan.report.descriptor.marker.length).toBeGreaterThan(0);
      expect(typeof publishPlan.commandArgs.searchQuery).toBe("string");
      expect(publishPlan.commandArgs.searchQuery.length).toBeGreaterThan(0);

      // stage 2 — resolve plan(update {action, issueNumber} + argv).
      expect(resolvePlan.action.action).toBe("update");
      if (resolvePlan.action.action !== "update") {
        throw new Error("update action 기대");
      }
      expect(typeof resolvePlan.action.issueNumber).toBe("number");
      expect(Array.isArray(resolvePlan.argv)).toBe(true);
      expect(resolvePlan.argv[0]).toBe("issue");
      expect(resolvePlan.argv[1]).toBe("edit");

      // stage 3 — outcome-report-from-output(5필드).
      expect(typeof outcomeReport.issueNumber).toBe("number");
      expect(outcomeReport.issueNumber).toBeGreaterThan(0);
      expect(typeof outcomeReport.url).toBe("string");
      expect(outcomeReport.url.length).toBeGreaterThan(0);
      expect(outcomeReport.gitSha).toBe("abc1234");
      expect(outcomeReport.dateToken).toBe("2026-06-28");
      expect(typeof outcomeReport.summaryLine).toBe("string");
      expect(outcomeReport.summaryLine.length).toBeGreaterThan(0);
    });
  });

  describe("full-orchestrator issueNumber single-source 수렴(branch — 핵심 불변식 1)", () => {
    it("(b) search hit N → resolve.action.issueNumber → from-output.issueNumber 세 지점 모두 동일 N + url 에 /issues/N(resolve↔from-output 경계 drift 0)", () => {
      const N = 7;
      const { resolvePlan, outcomeReport } = runChain([N, 13]);
      if (resolvePlan.action.action !== "update") {
        throw new Error("update action 기대");
      }

      expect(resolvePlan.action.issueNumber).toBe(N);
      expect(outcomeReport.issueNumber).toBe(N);
      expect(outcomeReport.url).toContain(`/issues/${N}`);
      // 종단 closure — 최상위 orchestrator 가 산출한 marker 로 검색해 찾은 N 과
      // from-output 해석 N 의 한 chain 수렴.
      expect(outcomeReport.issueNumber).toBe(resolvePlan.action.issueNumber);
    });
  });

  describe("full-orchestrator run-identity single-source 수렴(branch — 핵심 불변식 2)", () => {
    it("(c) 단일 run → publishPlan.report.descriptor.marker run token ↔ from-output.{gitSha,dateToken,summaryLine} 동일 run-identity(publishPlan↔from-output 경계 drift 0)", () => {
      const run = validRun();
      const { publishPlan, outcomeReport } = runChain([7, 13], run);
      const token = expectedToken(run);

      // pre boundary — 최상위 orchestrator 산출 marker 안 run token.
      expect(publishPlan.report.descriptor.marker).toContain(token);
      // post boundary — from-output run-identity 전파.
      expect(outcomeReport.gitSha).toBe(run.gitSha);
      expect(outcomeReport.dateToken).toBe(run.dateToken);
      expect(outcomeReport.summaryLine).toContain(run.gitSha);
      expect(outcomeReport.summaryLine).toContain(run.dateToken);
    });
  });

  describe("orchestrator commandArgs → resolve 직결 marker 매개 무결성(branch — orchestrator-output-as-resolve-input)", () => {
    it("(d) publishPlan.commandArgs.searchQuery === publishPlan.report.descriptor.marker(byte-identical) AND 그 marker(=searchQuery)가 resolve 검색 매체로 update 분기를 이끎(commandArgs 직결)", () => {
      const { publishPlan, resolvePlan } = runChain([7, 13]);

      // 최상위 orchestrator 산출 commandArgs.searchQuery 가 report.descriptor.marker 운반.
      expect(publishPlan.commandArgs.searchQuery).toBe(
        publishPlan.report.descriptor.marker,
      );
      // 그 marker(=searchQuery)가 commandArgs 직결로 resolve 검색 매체가 되어 update 분기.
      expect(resolvePlan.action.action).toBe("update");
      if (resolvePlan.action.action === "update") {
        expect(typeof resolvePlan.action.issueNumber).toBe("number");
      }
    });
  });

  describe("create 분기 격리(branch — 검색 미스 → create, from-output 무관)", () => {
    it("(e) 빈 hit search stdout('[]') → resolve.action 이 create 분기(action.update 부재) — from-output 은 여전히 execStdout 의 N 으로 issueNumber 산출(누설 0), marker run token 은 두 분기 동일", () => {
      const run = validRun();
      const publishPlan = buildRealDataResultIssuePublishPlan(
        defaultResults(),
        run,
      );

      // 빈 hit → create 분기(검색 미스). publishPlan.commandArgs 직결.
      const resolvePlan = resolveRealDataResultIssueGhCommandPlan(
        "[]",
        publishPlan.commandArgs,
      );
      expect(resolvePlan.action.action).toBe("create");
      expect("issueNumber" in resolvePlan.action).toBe(false);

      // from-output 은 resolve 분기와 독립 — execStdout 의 N 으로 issueNumber 산출.
      const N = 42;
      const outcomeReport = buildRealDataResultIssueOutcomeReportFromOutput(
        execStdout(N),
        run,
      );
      expect(outcomeReport.issueNumber).toBe(N);

      // marker run token 은 create/update 두 분기 모두 동일(검색 결과 무관).
      expect(publishPlan.report.descriptor.marker).toContain(
        expectedToken(run),
      );
    });
  });

  describe("run 분포 변별성(branch — 다른 run→다른 marker/run-identity, 같은 run→triple 수렴)", () => {
    it("(f) run_A vs run_B → 각 chain 의 publishPlan.report.descriptor.marker token / outcomeReport.{gitSha,dateToken} 가 run 별 분리 수렴, issueNumber N 은 두 chain 동일(search-stdout 종속)", () => {
      const runA = validRun("abc1234", "2026-06-21");
      const runB = validRun("def5678", "2026-06-29");
      const chainA = runChain([7, 13], runA);
      const chainB = runChain([7, 13], runB);
      if (
        chainA.resolvePlan.action.action !== "update" ||
        chainB.resolvePlan.action.action !== "update"
      ) {
        throw new Error("update action 기대");
      }

      // run 축 — 각 chain 안 triple 일치, 두 chain 간 분리.
      expect(chainA.publishPlan.report.descriptor.marker).toContain(
        expectedToken(runA),
      );
      expect(chainA.outcomeReport.gitSha).toBe(runA.gitSha);
      expect(chainA.outcomeReport.dateToken).toBe(runA.dateToken);
      expect(chainB.publishPlan.report.descriptor.marker).toContain(
        expectedToken(runB),
      );
      expect(chainB.outcomeReport.gitSha).toBe(runB.gitSha);
      expect(chainB.outcomeReport.dateToken).toBe(runB.dateToken);
      expect(chainA.publishPlan.report.descriptor.marker).not.toBe(
        chainB.publishPlan.report.descriptor.marker,
      );
      expect(chainA.outcomeReport.gitSha).not.toBe(chainB.outcomeReport.gitSha);

      // issueNumber 축 — search-stdout 종속, run 무관(두 chain 동일 N=7).
      expect(chainA.resolvePlan.action.issueNumber).toBe(7);
      expect(chainB.resolvePlan.action.issueNumber).toBe(7);
      expect(chainA.outcomeReport.issueNumber).toBe(
        chainB.outcomeReport.issueNumber,
      );
    });
  });

  describe("results 무관 — triple 수렴 격리(branch — partial-thread 격리)", () => {
    it("(g) 동일 run·동일 N, results 분포만 다르게 두 chain → marker / resolve.action.issueNumber / outcomeReport.{issueNumber,gitSha,dateToken} 두 경우 동일, report.summary(또는 descriptor.body) 만 달라야 함", () => {
      const run = validRun();
      const resultsA: EvaluationResult[] = [
        syntheticResult("github:github.com:a1", "easy", "low", 1),
      ];
      const resultsB: EvaluationResult[] = [
        syntheticResult("github:github.com:b1", "hard", "high", 9),
        syntheticResult("github:github.com:b2", "medium", "medium", 4),
      ];
      const chainA = runChain([7, 13], run, resultsA);
      const chainB = runChain([7, 13], run, resultsB);
      if (
        chainA.resolvePlan.action.action !== "update" ||
        chainB.resolvePlan.action.action !== "update"
      ) {
        throw new Error("update action 기대");
      }

      // marker run token·issueNumber·run-identity — results 변경 누설 0(동일).
      expect(chainA.publishPlan.report.descriptor.marker).toBe(
        chainB.publishPlan.report.descriptor.marker,
      );
      expect(chainA.resolvePlan.action.issueNumber).toBe(
        chainB.resolvePlan.action.issueNumber,
      );
      expect(chainA.outcomeReport.issueNumber).toBe(
        chainB.outcomeReport.issueNumber,
      );
      expect(chainA.outcomeReport.gitSha).toBe(chainB.outcomeReport.gitSha);
      expect(chainA.outcomeReport.dateToken).toBe(
        chainB.outcomeReport.dateToken,
      );

      // descriptor.body 는 results 본문 반영 — 두 경우 달라야 함(다른 축은 불변).
      expect(chainA.publishPlan.report.descriptor.body).not.toBe(
        chainB.publishPlan.report.descriptor.body,
      );
    });
  });

  describe("error path / negative cases — 세 boundary 거부 대칭 박제", () => {
    it("(h) run.gitSha 빈('') → publishPlan(top orchestrator) 하위 report-plan assertNonBlank('gitSha') throw(pre boundary 차단 — searchArgv 단계 미도달)", () => {
      expect(() =>
        buildRealDataResultIssuePublishPlan(defaultResults(), {
          gitSha: "",
          dateToken: "2026-06-29",
        }),
      ).toThrow();
    });

    it("(h') run.gitSha 공백-only('   ') → publishPlan assertNonBlank('gitSha') throw 대칭", () => {
      expect(() =>
        buildRealDataResultIssuePublishPlan(defaultResults(), {
          gitSha: "   ",
          dateToken: "2026-06-29",
        }),
      ).toThrow();
    });

    it("(i) run.dateToken 빈('') → publishPlan assertNonBlank('dateToken') throw 대칭", () => {
      expect(() =>
        buildRealDataResultIssuePublishPlan(defaultResults(), {
          gitSha: "abc1234",
          dateToken: "",
        }),
      ).toThrow();
    });

    it("(j) run.gitSha 빈('') → from-output(post) builder assertNonBlank throw(post boundary 종단 비식별 — execStdout URL 정상이어도 차단, pre/post 대칭)", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReportFromOutput(execStdout(7), {
          gitSha: "",
          dateToken: "2026-06-29",
        }),
      ).toThrow();
    });

    it("(k) searchStdout 비JSON('not json') → resolve parse 위임 throw(publishPlan.commandArgs.searchQuery 정상이어도 hits 추출 실패로 차단)", () => {
      const publishPlan = buildRealDataResultIssuePublishPlan(
        defaultResults(),
        validRun(),
      );
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(
          "not json",
          publishPlan.commandArgs,
        ),
      ).toThrow();
    });

    it("(k') searchStdout 비배열('{}') → resolve parse 위임 throw 대칭", () => {
      const publishPlan = buildRealDataResultIssuePublishPlan(
        defaultResults(),
        validRun(),
      );
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan("{}", publishPlan.commandArgs),
      ).toThrow();
    });

    it("(l) execStdout URL 미발견(빈 문자열) → from-output parse 위임 throw(post 미산출)", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReportFromOutput("", validRun()),
      ).toThrow();
    });

    it("(l') execStdout 무관 텍스트('no url here') → from-output parse 위임 throw 대칭", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReportFromOutput(
          "no url here",
          validRun(),
        ),
      ).toThrow();
    });

    it("(m) execStdout /issues/0 → from-output assertPositiveIssueNumber throw(post 비식별)", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReportFromOutput(
          `https://github.com/${OWNER}/${REPO}/issues/0\n`,
          validRun(),
        ),
      ).toThrow();
    });

    it("(m') execStdout /issues/abc(비숫자) → from-output URL 패턴 미매칭 throw(post 비식별)", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReportFromOutput(
          `https://github.com/${OWNER}/${REPO}/issues/abc\n`,
          validRun(),
        ),
      ).toThrow();
    });
  });

  describe("결정론·무공유·no-mutation — chain 두 번 호출 + 입력 불변 + 무공유", () => {
    it("(n) 동일 (results, run, searchStdout, execStdout) chain 두 번 → publishPlan/resolvePlan/outcomeReport 모두 deep-equal(결정론)", () => {
      const run = validRun();
      const results = defaultResults();
      const chain1 = runChain([7, 13], run, results);
      const chain2 = runChain([7, 13], run, results);

      expect(chain1.publishPlan).toEqual(chain2.publishPlan);
      expect(chain1.resolvePlan).toEqual(chain2.resolvePlan);
      expect(chain1.outcomeReport).toEqual(chain2.outcomeReport);
    });

    it("(o) no-mutation — 입력 results·run chain 호출 전후 deep-equal(원본 불변)", () => {
      const run = validRun();
      const results = defaultResults();
      const runBefore = { ...run };
      const resultsBefore = JSON.parse(JSON.stringify(results));

      runChain([7, 13], run, results);

      expect(run).toEqual(runBefore);
      expect(results).toEqual(resultsBefore);
    });

    it("(p) 무공유 — 각 stage 산출물이 입력 run 과 referential identity 분리(not.toBe), 필드는 전파", () => {
      const run = validRun();
      const { publishPlan, outcomeReport } = runChain([7, 13], run);

      expect(publishPlan).not.toBe(run);
      expect(outcomeReport).not.toBe(run);
      expect(outcomeReport.gitSha).toBe(run.gitSha);
      expect(outcomeReport.dateToken).toBe(run.dateToken);
    });
  });

  describe("credential 누출 0(branch — §9 / R-59 / REQ-059 정합)", () => {
    it("(q) publishPlan.searchArgv · publishPlan.commandArgs.searchQuery · publishPlan.report.descriptor.{title,marker,body} · resolvePlan.argv · outcomeReport.{url,summaryLine} 어디에도 token/secret/PAT/--auth 어휘 미등장", () => {
      const { publishPlan, resolvePlan, outcomeReport } = runChain([7, 13]);

      const surfaces = [
        publishPlan.searchArgv.join(" "),
        publishPlan.commandArgs.searchQuery,
        publishPlan.report.descriptor.title,
        publishPlan.report.descriptor.marker,
        publishPlan.report.descriptor.body,
        resolvePlan.argv.join(" "),
        outcomeReport.url,
        outcomeReport.summaryLine,
      ];
      for (const surface of surfaces) {
        expect(surface).not.toContain("--token");
        expect(surface).not.toContain("--auth");
        expect(surface).not.toContain("GITHUB_TOKEN");
        expect(surface).not.toContain("Authorization");
        expect(surface).not.toContain("Bearer");
        expect(surface).not.toContain("x-access-token");
        expect(surface).not.toContain("x-github-token");
        expect(surface).not.toMatch(/ghp_[A-Za-z0-9]/);
        expect(surface).not.toMatch(/PAT/);
      }
      // outcome url 은 issue 경로만 — commit/PR narrative 어휘 미포함.
      expect(outcomeReport.url).not.toMatch(/commit|pull request/i);
    });
  });
});
