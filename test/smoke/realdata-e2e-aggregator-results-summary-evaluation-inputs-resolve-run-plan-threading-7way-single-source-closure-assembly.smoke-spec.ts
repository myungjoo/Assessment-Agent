// realdata-e2e-aggregator-results-summary-evaluation-inputs-resolve-run-plan-threading-7way-single-source-closure-assembly.smoke-spec.ts
// — 실 평가 e2e step④ aggregator results-summary 합류 7-way single-source closure:
// pre-실행 aggregator `buildRealDataE2eStepArgs(runPlan, activities, results)` 의
// **세 번째이자 마지막 미합류 입력 source `results`** 를 publish leg 의 `report.summary`
// 축(=results 재유도)으로 closure 에 묶어, 단일 검증 source `(runPlan, activities, results)`
// 세 source 가 다음 7 축의 동시 source 임을 한 chain 으로 박제한다:
//   (축 7, 본 task 의 새 표면) **publish.report.summary results-재유도 byte-identical** —
//      `stepArgs.publish.report.summary` 가 동일 `results`·동일 `runPlan.run` 으로 직접
//      호출한 `buildRealDataResultIssueCommandPlan(results, runPlan.run).report.summary` 와
//      byte-identical. 평가 결과 정량 집계(count·difficulty/contribution 분포·totalVolume)가
//      단일 `results` source 로부터 동형 재유도됨. **재유도는 command-plan 경유**(aggregator 가
//      실제 거치는 동일 위임 경로 — `buildRealDataResultSummary` 직접 호출 0, SSOT).
//   (축 6, T-0775 cover 영역의 7-way 묶음 항) **evaluation.inputs activities-재유도
//      byte-identical + callArgs[i].input === inputs[i] reference 페어링**.
//   (축 5) `.evaluation` leg modelId — `callArgs[i].options.modelId ===
//      runPlan.pipeline.modelId`(ADR-0048 단일 modelId source).
//   (축 2~4) `.publish` leg 내부 marker 3-축 — `report.descriptor.marker /
//      commandArgs.searchQuery / searchArgv(--match 다음 토큰)` 세 marker 축 동일.
//   (축 1, 종단) resolve issueNumber + post run-identity — marker 로 검색 hit 1+ →
//      `action.update.issueNumber = N` → `buildRealDataResultOutcomeStepArgs(runPlan,
//      execStdout)` 가 동일 runPlan.run 의 {gitSha, dateToken} 전파.
//
// 이 7-way 가 **세 검증 source `(runPlan, activities, results)`** single-source 에서 한 chain
// 동시-호출로 byte-identical 수렴함을 박제하는 첫 aggregator-results-summary 합류 7-way
// single-source closure non-gated build-time smoke (T-0776 박제, PLAN.md 109행 🟢 실 평가
// e2e step④). aggregator 의 세 입력 source 가 모두 closure 에 묶이는 마지막 slice.
//
// 본 spec 의 존재 이유 — public CI gap 해소(publish leg 의 results-summary 재유도 축을
// 7번째 축으로 합류):
//   - aggregator `buildRealDataE2eStepArgs(runPlan, activities, results)`(T-0601)는 세 입력
//     source 를 받는다 — runPlan(검증된 modelId+run), activities(수집 산출), results(평가
//     산출). 직전 sweep(T-0770~T-0775)은 runPlan·activities 두 source 만 closure 에 묶었고
//     세 번째 source `results` 는 publish leg 의 `report.summary` 로 흐르되 closure 에
//     미합류였다.
//   - 직전 sibling 들은 이 summary 축(=results source)을 closure 에 합류시키지 않았다:
//       T-0775 (aggregator 6-way) — evaluation leg inputs(activities 재유도)+callArgs.input
//         페어링+modelId + publish leg marker/searchArgv/run-identity 6 축을 단일 (runPlan,
//         activities) source 로 수렴 박제. 그러나 publish leg `report.summary`(=results
//         source)는 closure 에 미합류 — results 가 descriptor.marker body 렌더 source 로만
//         간접 흐를 뿐 summary 의 단일-source results 재유도 정합은 묶이지 않았다.
//       T-0762 (publish-plan↔report-plan convergence) — publish plan report 가 report-plan
//         재유도와 정합함을 박제했으나 aggregator·resolve·post 미합류(직접 호출 byte-identical
//         만, aggregator 진입·종단 chain 0).
//   - 본 spec 은 그 빈 자리를 채워 **세 번째이자 마지막 미합류 입력 source `results` 를
//     단일-source closure 에 묶어**, 세 검증 source `(runPlan, activities, results)` 가
//     aggregator 의 evaluation leg(inputs=activities 재유도 + modelId=runPlan.pipeline) +
//     publish leg(summary=results 재유도 + marker/searchArgv/run-identity)의 source 임을
//     resolve+post 까지 묶은 한 chain 으로 박제한다.
//   - 이 7-way 가 세 검증 source single-source 로 수렴함이 search-or-update 멱등성(REQ-009)·
//     raw 미보유 평가 입력/결과 집계 정합(REQ-032)·결과 리포트 재실행 정합(REQ-037)의
//     aggregator-level "평가 입력 식별(inputs)+평가 정책(modelId)+평가 결과 집계(summary)+
//     publish 식별(marker/searchArgv/run-identity)이 같은 세 검증 source 에서 나옴" 의 종단
//     닫음이다.
//   - live leg(실 prisma·실 collectForPerson·실 github.com fetch·실 LLM scoring·실 gh CLI
//     실행·DB·LAN gate)는 복제하지 않고, synthetic runPlan(buildRealDataE2eRunPlan 합성) +
//     activities/results literal + search-stdout/exec-stdout literal 을 컴포저들에 직접 공급해
//     live leg 를 우회한다(조립 surface 만 검증). 따라서 본 spec 은:
//
//      🔥 실 gh 호출 0 — gh search / list / create / edit / execFile('gh', argv) 미실행.
//         synthetic searchStdout / execStdout / runPlan / activities / results literal 직접 공급.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 LLM scoreUnit 호출 0 / 실 DB 접근 0 / 실 jest spawn 0 — 7-way 수렴 조립만.
//         results 는 summary 정량 집계 식별자 운반만 검증(실 scoreUnit 호출 0).
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 step-args aggregator / evaluation-inputs / command-plan
//         / outcome-step-args / run-plan / gh-command-plan / seed-fixture 컴포저 import
//         재사용만(가드/helper 신설 0). `extractSearchMarker` 는 spec 로컬 함수(T-0775/T-0729
//         패턴 차용).
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0776):
//   - src 변경 0(src/, prisma/, package.json, CI workflow, 환경 변수 추가 등 모두 금지). test-only.
//   - 실 gh CLI 호출 / `execFile('gh', searchArgv)` 실행 / 실 LLM scoreUnit 호출 / 실 issue
//     검색·박제(step④ live wiring — credential gate, deferred). 본 task 는 in-memory 합성
//     search-stdout / exec-stdout 만. summary 는 **정량 집계 식별자 운반만** 검증(실 scoreUnit 0).
//   - aggregator 6-way(evaluation.inputs 재유도 + callArgs.input 페어링 + modelId + publish
//     marker/searchArgv/run-identity) 자체 재단언(T-0775 cover). 본 task 는 publish leg
//     `report.summary`(=results source 재유도)를 7번째 축으로 합류시킨 부분만.
//   - publish-plan ↔ report-plan byte-identical 자체 재단언(T-0762 cover). 본 task 는
//     aggregator 진입 + summary 재유도 + resolve+post 합류 7-way closure 만.
//   - buildRealDataResultSummary 의 count·분포·totalVolume 집계 로직 자체 재단언(summary
//     helper spec cover). 본 task 는 aggregator 산출 summary 가 단일 source results 재유도
//     (command-plan 경유)와 byte-identical 함만.
//   - report.descriptor(title/marker/body 렌더) 재유도 자체 재단언(report-plan / descriptor
//     helper spec cover). 본 task 는 descriptor.marker 의 3-축 일치 + summary 재유도만.
//   - 난이도별 modelId routing(R-97 deferred) 검증 — 단일 modelId 동형 적용(ADR-0048)만.
//   - searchArgv 전체 형식(gh issue list 플래그 순서·--repo·--state 등) 재단언(search-gh-argv
//     가드 / T-0729 cover). 본 task 는 `--match` 위치 marker 토큰만.
//   - commandArgs createArgs/updateArgs 정합·labels 재단언(command-args 가드 cover).
//   - resolve argv 합성(gh issue create/edit argv 형식) 재단언(gh-command-plan 가드 cover).
//   - from-output 단독 5필드(url trim·summaryLine 합성) 재유도 재단언(T-0747 cover).
//   - runPlan pipeline 측 collectCallArgs shape·guard 재단언(run-plan / pipeline-plan cover).
//   - DB 의존 / live-LLM·실 fetch·실 collectForPerson 0.
//   - 새 helper 모듈 신설 / 기존 helper 수정 — test-only(신규 smoke spec 1 파일).
import type { GithubActivity } from "../../src/assessment-collection/domain/activity";
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";
import { buildRealDataEvaluationInputs } from "../helpers/realdata-e2e-evaluation-inputs";
import { buildRealDataResultIssueCommandPlan } from "../helpers/realdata-e2e-result-issue-command-plan";
import { resolveRealDataResultIssueGhCommandPlan } from "../helpers/realdata-e2e-result-issue-gh-command-plan";
import { buildRealDataResultOutcomeStepArgs } from "../helpers/realdata-e2e-result-outcome-step-args";
import { buildRealDataE2eRunPlan } from "../helpers/realdata-e2e-run-plan";
import type { RealDataE2eRunPlan } from "../helpers/realdata-e2e-run-plan";
import { buildRealDataE2eSeed } from "../helpers/realdata-e2e-seed-fixture";
import { buildRealDataE2eStepArgs } from "../helpers/realdata-e2e-step-args";

// 결정론 owner/repo — 합성 issue URL 의 path segment source(public CI 에서 항상 green
// 발화). token/secret/PAT/--auth 어휘 미포함.
const OWNER = "myungjoo";
const REPO = "assessment-agent";

// 결정론 modelId fixture — runPlan 의 pipeline 측 입력. modelId 축 단언 대상.
const MODEL_ID =
  "cfg-realdata-e2e-aggregator-results-summary-evaluation-inputs-resolve-threading-smoke";

const INSTANCE_KEY = "github.com";

// search argv 안 marker 추출 헬퍼 — 빌더 canonical shape (["search","issues","--match",
// "body",<marker>,"--json","number,title,body","--limit","30"]) 에서 marker 는 `--match
// body` 직후다. 위치 매직 넘버 대신 `--match` 기준 상대 추출(round-trip drift 강건).
// T-0775/T-0729 sibling 헬퍼 패턴 mirror.
function extractSearchMarker(searchArgv: string[]): string {
  const matchIdx = searchArgv.indexOf("--match");
  if (matchIdx < 0) {
    throw new Error("search argv 에 --match 가 없습니다 — marker 추출 불가");
  }
  // `--match` <field=body> <marker> 순서 — marker 는 field 다음(matchIdx + 2).
  return searchArgv[matchIdx + 2];
}

// 합성 run-token — descriptor 컴포저 내부 `runToken(run) = ${dateToken}@${gitSha}` 및
// outcome-report 의 summaryLine 과 동일 규칙으로 test 측에서 재유도한 expected 공유 substring.
function expectedToken(run: RealDataE2eRunPlan["run"]): string {
  return `${run.dateToken}@${run.gitSha}`;
}

// synthetic runPlan 합성 — buildRealDataE2eRunPlan(seeds, modelId, run) 을 호출해 검증된
// 단일 `{pipeline, run}` 을 만든다(modelId·run guard 통과 비공백 토큰). 매 호출 새 객체 트리
// (테스트 격리).
function buildRunPlan(
  modelId = MODEL_ID,
  gitSha = "abc1234",
  dateToken = "2026-06-28",
): RealDataE2eRunPlan {
  const seeds = buildRealDataE2eSeed();
  return buildRealDataE2eRunPlan(seeds, modelId, { gitSha, dateToken });
}

// synthetic GithubActivity 1 건 — aggregator 의 evaluation leg 입력. seed 의 첫 username 을
// author 로 매칭(evaluation leg 통과용). callArgs 가 1+ 원소를 갖도록 보장. externalId 와
// kind 를 caller 가 지정해 unitId·contributionKind 가 입력 분포로 변별되게 한다.
function syntheticActivity(
  author: string,
  externalId = "realdata-e2e-aggregator-results-summary-c1",
  kind: GithubActivity["kind"] = "commit",
): GithubActivity {
  return {
    sourceType: "github",
    externalId,
    instanceKey: INSTANCE_KEY,
    author,
    timestamp: "2026-06-01T12:00:00Z",
    metadata: { titleLength: 42 },
    repoRef: `${author}/sample-repo`,
    kind,
  };
}

// 유효 activities fixture — aggregator 의 evaluation leg 입력(Activity[]). seed 의 첫
// username 을 author 로 매칭. 다양한 unitId·kind 분포(commit/pr/issue)로 inputs 재유도 검증.
function defaultActivities(): GithubActivity[] {
  const seeds = buildRealDataE2eSeed();
  const firstUsername = seeds[0].serviceIdentities[0].externalId;
  return [
    syntheticActivity(firstUsername, "aggregator-results-summary-c1", "commit"),
    syntheticActivity(firstUsername, "aggregator-results-summary-p1", "pr"),
    syntheticActivity(firstUsername, "aggregator-results-summary-i1", "issue"),
  ];
}

// synthetic EvaluationResult 1 건 — aggregator 의 publish leg 입력(summary 집계 source).
function syntheticResult(
  unitId: string,
  difficulty: EvaluationResult["difficulty"],
  contribution: EvaluationResult["contribution"],
  volume: number,
): EvaluationResult {
  return {
    unitId,
    narrative:
      "synthetic evaluation narrative — aggregator results-summary+evaluation-inputs+modelId+searchArgv ↔ resolve ↔ outcome-step-args run-plan-threading 7-way closure smoke fixture",
    difficulty,
    contribution,
    volume,
  };
}

// 유효 results fixture(분포 X) — aggregator 의 publish leg summary 집계 source.
// 다양한 difficulty/contribution/volume 으로 summary 의 count·분포·totalVolume 변별.
function defaultResults(): EvaluationResult[] {
  return [
    syntheticResult("github:github.com:c1", "easy", "low", 3),
    syntheticResult("github:github.com:c2", "medium", "high", 5),
    syntheticResult("github:github.com:c3", "hard", "medium", 2),
  ];
}

// 다른 분포(Y) results fixture — summary 변별성 단언용(다른 count·difficulty/contribution
// 분포·totalVolume). defaultResults 와 다른 정량 집계를 산출한다.
function altResults(): EvaluationResult[] {
  return [
    syntheticResult("github:github.com:d1", "hard", "high", 9),
    syntheticResult("github:github.com:d2", "hard", "high", 7),
  ];
}

// marker(=searchQuery, = searchArgv --match 토큰)를 body 에 포함한 hit 1+건 search stdout
// 합성 헬퍼 — 동일 run 이슈가 이미 존재하는 경우(resolve update 분기 유발).
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
function execStdout(n: number, noisePrefix = ""): string {
  return `${noisePrefix}https://github.com/${OWNER}/${REPO}/issues/${n}\n`;
}

// pre-실행 aggregator(buildRealDataE2eStepArgs(runPlan, activities, results)) →
// resolve(search-stdout + stepArgs.publish.commandArgs → action.update.issueNumber) →
// post step-args(buildRealDataResultOutcomeStepArgs(runPlan, execStdout))를 single-source(
// **동일 runPlan 한 객체** + activities + results + N)로 묶어 한 chain 으로 호출하는 헬퍼.
// 핵심: aggregator·post 두 곳에 **같은 runPlan 객체를 넘긴다**(독립 run 인자 재전달 0).
// aggregator 가 runPlan 을 evaluation leg(modelId thread) + publish leg(run thread)에 동시
// thread 하고, results 가 publish leg 의 report.summary 재유도 source 가 된다(축 7).
function runChain(
  hitsNumbers: number[],
  runPlan: RealDataE2eRunPlan = buildRunPlan(),
  activities: GithubActivity[] = defaultActivities(),
  results: EvaluationResult[] = defaultResults(),
  noisePrefix = "",
): {
  expectedMinN: number;
  runPlan: RealDataE2eRunPlan;
  activities: GithubActivity[];
  results: EvaluationResult[];
  stepArgs: ReturnType<typeof buildRealDataE2eStepArgs>;
  resolvePlan: ReturnType<typeof resolveRealDataResultIssueGhCommandPlan>;
  outcomeReport: ReturnType<typeof buildRealDataResultOutcomeStepArgs>;
} {
  // stage 1(pre boundary, aggregator dual-leg threaded) — stepArgs: {evaluation, publish}.
  // 동일 runPlan 한 객체를 넘김 — aggregator 가 evaluation leg 에 runPlan.pipeline.modelId,
  // publish leg 에 runPlan.run 을 동시 thread(재전달 0). 동일 activities 가 evaluation.inputs
  // 재유도 source(축 6), 동일 results 가 publish.report.summary 재유도 source(축 7).
  const stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results);

  // stage 2(resolve) — searchStdout(marker hit 1+) + stepArgs.publish.commandArgs →
  // action.update.issueNumber.
  const expectedMinN = Math.min(...hitsNumbers);
  const searchStdout = multiHitStdout(
    stepArgs.publish.commandArgs.searchQuery,
    hitsNumbers,
  );
  const resolvePlan = resolveRealDataResultIssueGhCommandPlan(
    searchStdout,
    stepArgs.publish.commandArgs,
  );
  if (resolvePlan.action.action !== "update") {
    throw new Error("update action 기대 — 후보 1+건 입력");
  }
  const resolvedN = resolvePlan.action.issueNumber;

  // stage 3(post boundary, run-plan-threaded) — caller 가 그 N 으로 `gh issue edit N ...`
  // 실행 후 받는 stdout + **동일 runPlan 한 객체**를 post step-args 컴포저에 직접 공급.
  const outcomeReport = buildRealDataResultOutcomeStepArgs(
    runPlan,
    execStdout(resolvedN, noisePrefix),
  );

  return {
    expectedMinN,
    runPlan,
    activities,
    results,
    stepArgs,
    resolvePlan,
    outcomeReport,
  };
}

describe("Smoke(non-gated): 실 평가 e2e step④ aggregator results-summary 합류 7-way single-source closure buildRealDataE2eStepArgs(.publish.report.summary(=buildRealDataResultIssueCommandPlan(results, runPlan.run).report.summary byte-identical) + .evaluation {inputs(=buildRealDataEvaluationInputs(activities), callArgs[i].input===inputs[i]), callArgs[].options.modelId} + .publish {descriptor.marker, commandArgs.searchQuery, searchArgv --match})↔resolve↔buildRealDataResultOutcomeStepArgs 동일 (runPlan, activities, results) 한 chain 동시-호출(summary 재유도 + inputs 재유도 + modelId + marker 3-축 + issueNumber + run-identity 7축 동시 수렴, 재전달 0) live-gh/live-LLM 0 검증", () => {
  describe("happy path — aggregator 7-way chain 합성(다섯 산출물 모두 정상)", () => {
    it("(a) 유효 runPlan + activities + results + searchStdout + execStdout → stepArgs.evaluation({inputs,callArgs} 비어있지 않음) / stepArgs.publish({report,commandArgs,searchArgv} 정상·report.summary 존재·report.descriptor.marker 존재) / resolvePlan(update {action, issueNumber} + argv) / outcomeReport(5필드) 다섯 산출물 모두 정상", () => {
      const { stepArgs, resolvePlan, outcomeReport } = runChain([7, 13]);

      // stage 1a — stepArgs.evaluation({inputs, callArgs} 비어있지 않음).
      expect(Array.isArray(stepArgs.evaluation.inputs)).toBe(true);
      expect(stepArgs.evaluation.inputs.length).toBeGreaterThan(0);
      expect(Array.isArray(stepArgs.evaluation.callArgs)).toBe(true);
      expect(stepArgs.evaluation.callArgs.length).toBeGreaterThan(0);
      expect(typeof stepArgs.evaluation.callArgs[0].options.modelId).toBe(
        "string",
      );

      // stage 1b — stepArgs.publish({report, commandArgs, searchArgv} 정상).
      expect(typeof stepArgs.publish.report).toBe("object");
      expect(typeof stepArgs.publish.commandArgs).toBe("object");
      expect(Array.isArray(stepArgs.publish.searchArgv)).toBe(true);
      expect(stepArgs.publish.searchArgv).toContain("--match");
      // report.summary 존재(축 7 reachable — count/분포/totalVolume).
      expect(typeof stepArgs.publish.report.summary).toBe("object");
      expect(typeof stepArgs.publish.report.summary.count).toBe("number");
      expect(stepArgs.publish.report.summary.count).toBe(3);
      expect(typeof stepArgs.publish.report.summary.totalVolume).toBe("number");
      expect(typeof stepArgs.publish.report.summary.byDifficulty).toBe(
        "object",
      );
      expect(typeof stepArgs.publish.report.summary.byContribution).toBe(
        "object",
      );
      // report.descriptor.marker 존재.
      expect(typeof stepArgs.publish.report.descriptor.marker).toBe("string");
      expect(stepArgs.publish.report.descriptor.marker.length).toBeGreaterThan(
        0,
      );

      // stage 2 — resolve plan(update {action, issueNumber} + argv).
      expect(resolvePlan.action.action).toBe("update");
      if (resolvePlan.action.action !== "update") {
        throw new Error("update action 기대");
      }
      expect(typeof resolvePlan.action.issueNumber).toBe("number");
      expect(resolvePlan.argv[0]).toBe("issue");
      expect(resolvePlan.argv[1]).toBe("edit");

      // stage 3 — outcome step-args report(5필드).
      expect(typeof outcomeReport.issueNumber).toBe("number");
      expect(outcomeReport.issueNumber).toBeGreaterThan(0);
      expect(outcomeReport.url.length).toBeGreaterThan(0);
      expect(outcomeReport.gitSha).toBe("abc1234");
      expect(outcomeReport.dateToken).toBe("2026-06-28");
      expect(outcomeReport.summaryLine.length).toBeGreaterThan(0);
    });
  });

  describe("publish-leg results-summary 재유도 byte-identical 수렴(branch — 핵심 불변식 1, 본 task 의 새 표면 — 축 7)", () => {
    it("(b) stepArgs.publish.report.summary deep-equal buildRealDataResultIssueCommandPlan(results, runPlan.run).report.summary — aggregator 의 publish leg summary 가 단일 results source 로부터 재유도됨(평가 결과 정량 집계가 동일 검증 source 산물). 재유도는 command-plan 경유(buildRealDataResultSummary 직접 호출 0 — aggregator 와 동일 위임 경로 SSOT)", () => {
      const runPlan = buildRunPlan();
      const results = defaultResults();
      const { stepArgs } = runChain(
        [7, 13],
        runPlan,
        defaultActivities(),
        results,
      );

      // 동일 results·동일 runPlan.run 으로 직접 호출한 command-plan 의 report.summary 와
      // byte-identical deep-equal — aggregator 가 summary 를 같은 source·같은 위임 경로로 재유도.
      const directSummary = buildRealDataResultIssueCommandPlan(
        results,
        runPlan.run,
      ).report.summary;
      expect(stepArgs.publish.report.summary).toEqual(directSummary);
      // 정량 집계 필드 변별 — count·totalVolume 가 results 분포 종속(3건, volume 3+5+2=10).
      expect(stepArgs.publish.report.summary.count).toBe(results.length);
      expect(stepArgs.publish.report.summary.totalVolume).toBe(10);
      // difficulty/contribution 분포도 results 종속(easy/medium/hard 각 1, low/medium/high 각 1).
      expect(stepArgs.publish.report.summary.byDifficulty.easy).toBe(1);
      expect(stepArgs.publish.report.summary.byDifficulty.medium).toBe(1);
      expect(stepArgs.publish.report.summary.byDifficulty.hard).toBe(1);
      expect(stepArgs.publish.report.summary.byContribution.low).toBe(1);
      expect(stepArgs.publish.report.summary.byContribution.medium).toBe(1);
      expect(stepArgs.publish.report.summary.byContribution.high).toBe(1);
      expect(stepArgs.publish.report.summary.byContribution.zero).toBe(0);
    });
  });

  describe("evaluation-leg inputs 재유도 + callArgs.input 페어링(branch — 핵심 불변식 2, 축 6)", () => {
    it("(c) stepArgs.evaluation.inputs deep-equal buildRealDataEvaluationInputs(activities) AND 모든 callArgs[i].input === inputs[i] referential 페어링 + 길이 일치", () => {
      const activities = defaultActivities();
      const { stepArgs } = runChain([7, 13], buildRunPlan(), activities);

      const directInputs = buildRealDataEvaluationInputs(activities);
      expect(stepArgs.evaluation.inputs).toEqual(directInputs);
      expect(stepArgs.evaluation.inputs).toHaveLength(activities.length);
      expect(stepArgs.evaluation.callArgs.length).toBe(
        stepArgs.evaluation.inputs.length,
      );
      stepArgs.evaluation.callArgs.forEach((c, i) => {
        expect(c.input).toBe(stepArgs.evaluation.inputs[i]);
      });
    });
  });

  describe("evaluation-leg modelId thread 수렴(branch — 핵심 불변식 3, 축 5)", () => {
    it("(d) 모든 stepArgs.evaluation.callArgs[i].options.modelId === runPlan.pipeline.modelId — 단일 검증 runPlan 의 평가 정책 modelId 가 평가 호출-args 전체에 동형 thread", () => {
      const runPlan = buildRunPlan();
      const { stepArgs } = runChain([7, 13], runPlan);

      expect(stepArgs.evaluation.callArgs.length).toBeGreaterThan(0);
      stepArgs.evaluation.callArgs.forEach((c) => {
        expect(c.options.modelId).toBe(runPlan.pipeline.modelId);
      });
      expect(runPlan.pipeline.modelId).toBe(MODEL_ID);
    });
  });

  describe("publish-leg 내부 marker 3-축 일치(branch — 핵심 불변식 4, 축 2~4)", () => {
    it("(e) extractSearchMarker(searchArgv) === report.descriptor.marker === commandArgs.searchQuery — 세 내부 marker 축이 byte-identical, marker 가 searchArgv 안 정확히 1회 등장", () => {
      const { stepArgs } = runChain([7, 13]);

      const descriptorMarker = stepArgs.publish.report.descriptor.marker;
      expect(stepArgs.publish.commandArgs.searchQuery).toBe(descriptorMarker);
      expect(extractSearchMarker(stepArgs.publish.searchArgv)).toBe(
        descriptorMarker,
      );
      expect(
        stepArgs.publish.searchArgv.filter(
          (token) => token === descriptorMarker,
        ),
      ).toHaveLength(1);
    });
  });

  describe("marker → resolve issueNumber + post run-identity 수렴(branch — 핵심 불변식 5, 축 1)", () => {
    it("(f) search hit N → resolve.action.update.issueNumber → outcome step-args.issueNumber 세 지점 모두 동일 N + url 에 /issues/N + 동일 runPlan.run 전파(marker run token == outcomeReport.{gitSha,dateToken,summaryLine})", () => {
      const N = 7;
      const runPlan = buildRunPlan();
      const { stepArgs, resolvePlan, outcomeReport } = runChain(
        [N, 13],
        runPlan,
      );
      if (resolvePlan.action.action !== "update") {
        throw new Error("update action 기대");
      }

      expect(resolvePlan.action.issueNumber).toBe(N);
      expect(outcomeReport.issueNumber).toBe(N);
      expect(outcomeReport.url).toContain(`/issues/${N}`);
      expect(outcomeReport.issueNumber).toBe(resolvePlan.action.issueNumber);

      const token = expectedToken(runPlan.run);
      expect(stepArgs.publish.report.descriptor.marker).toContain(token);
      expect(outcomeReport.gitSha).toBe(runPlan.run.gitSha);
      expect(outcomeReport.dateToken).toBe(runPlan.run.dateToken);
      expect(outcomeReport.summaryLine).toContain(runPlan.run.gitSha);
      expect(outcomeReport.summaryLine).toContain(runPlan.run.dateToken);
    });
  });

  describe("7-way 단일-source 묶음 단언(branch — closure 종단, 본 task 의 종단 박제)", () => {
    it("(g) publish.report.summary == buildRealDataResultIssueCommandPlan(results, runPlan.run).report.summary, evaluation.inputs == buildRealDataEvaluationInputs(activities), callArgs[].input === inputs[i], callArgs[].options.modelId == runPlan.pipeline.modelId, searchArgv --match 토큰 == descriptor.marker == commandArgs.searchQuery, 그 marker 로 resolve 가 찾은 N == post 가 해석한 N, 그 marker 의 run token == post 가 전파한 {gitSha,dateToken} 가 세 검증 source (runPlan, activities, results) single-source 에서 7-way 동시 성립", () => {
      const N = 7;
      const runPlan = buildRunPlan();
      const activities = defaultActivities();
      const results = defaultResults();
      const { stepArgs, resolvePlan, outcomeReport } = runChain(
        [N, 13],
        runPlan,
        activities,
        results,
      );
      if (resolvePlan.action.action !== "update") {
        throw new Error("update action 기대");
      }

      const marker = stepArgs.publish.report.descriptor.marker;
      const token = expectedToken(runPlan.run);

      // axis 7(새 표면) — publish.report.summary deep-equal command-plan 재유도(results source).
      const directSummary = buildRealDataResultIssueCommandPlan(
        results,
        runPlan.run,
      ).report.summary;
      expect(stepArgs.publish.report.summary).toEqual(directSummary);
      // axis 6 — evaluation.inputs deep-equal direct 재유도 + callArgs.input reference 페어링.
      const directInputs = buildRealDataEvaluationInputs(activities);
      expect(stepArgs.evaluation.inputs).toEqual(directInputs);
      stepArgs.evaluation.callArgs.forEach((c, i) => {
        expect(c.input).toBe(stepArgs.evaluation.inputs[i]);
      });
      // axis 5 — evaluation.callArgs[].options.modelId == runPlan.pipeline.modelId.
      expect(stepArgs.evaluation.callArgs.length).toBeGreaterThan(0);
      stepArgs.evaluation.callArgs.forEach((c) => {
        expect(c.options.modelId).toBe(runPlan.pipeline.modelId);
      });
      // axis 2~4 — marker 3-축 byte-identical.
      expect(stepArgs.publish.commandArgs.searchQuery).toBe(marker);
      expect(extractSearchMarker(stepArgs.publish.searchArgv)).toBe(marker);
      // axis 1 — 그 marker 로 resolve 가 찾은 N == post 가 해석한 N + run token 전파.
      expect(resolvePlan.action.issueNumber).toBe(N);
      expect(outcomeReport.issueNumber).toBe(N);
      expect(marker).toContain(token);
      expect(outcomeReport.gitSha).toBe(runPlan.run.gitSha);
      expect(outcomeReport.dateToken).toBe(runPlan.run.dateToken);
      // 7-way 동시 closure — 세 검증 source single-source 에서 일곱 축이 한 chain 으로 묶임.
      expect(`${runPlan.run.dateToken}@${runPlan.run.gitSha}`).toBe(token);
    });
  });

  describe("results 축 변별성(branch — results 가 summary 를 결정, activities·modelId·run 은 독립 축)", () => {
    it("(h) results_A(분포 X) vs results_B(분포 Y) 로 같은 runPlan·activities·N 으로 chain → A.summary == cmdPlan(results_A,run).summary, B.summary == (results_B,run) 각각 byte-identical(results 가 summary 를 결정) → 그러나 evaluation.inputs / modelId / descriptor.marker / searchArgv --match / resolve issueNumber / outcomeReport.{gitSha,dateToken} 는 두 chain 동일(results 변경이 inputs·modelId·marker·run-identity·issueNumber 어느 축에도 누설 0)", () => {
      const runPlan = buildRunPlan();
      const activities = defaultActivities();
      const resultsA = defaultResults();
      const resultsB = altResults();
      const chainA = runChain([7, 13], runPlan, activities, resultsA);
      const chainB = runChain([7, 13], runPlan, activities, resultsB);
      if (
        chainA.resolvePlan.action.action !== "update" ||
        chainB.resolvePlan.action.action !== "update"
      ) {
        throw new Error("update action 기대");
      }

      // 축 7 — summary 가 results 로부터 각각 재유도(서로 다른 집계).
      expect(chainA.stepArgs.publish.report.summary).toEqual(
        buildRealDataResultIssueCommandPlan(resultsA, runPlan.run).report
          .summary,
      );
      expect(chainB.stepArgs.publish.report.summary).toEqual(
        buildRealDataResultIssueCommandPlan(resultsB, runPlan.run).report
          .summary,
      );
      // summary 변별(다른 results → 다른 count·totalVolume).
      expect(chainA.stepArgs.publish.report.summary.count).toBe(3);
      expect(chainB.stepArgs.publish.report.summary.count).toBe(2);
      expect(chainA.stepArgs.publish.report.summary.totalVolume).toBe(10);
      expect(chainB.stepArgs.publish.report.summary.totalVolume).toBe(16);
      expect(chainA.stepArgs.publish.report.summary).not.toEqual(
        chainB.stepArgs.publish.report.summary,
      );

      // 축 6/5/2~4/1 — inputs·modelId·marker·searchArgv·issueNumber·run-identity 는 동일
      // (results 변경 누설 0).
      expect(chainA.stepArgs.evaluation.inputs).toEqual(
        chainB.stepArgs.evaluation.inputs,
      );
      expect(chainA.stepArgs.evaluation.callArgs[0].options.modelId).toBe(
        chainB.stepArgs.evaluation.callArgs[0].options.modelId,
      );
      expect(chainA.stepArgs.publish.report.descriptor.marker).toBe(
        chainB.stepArgs.publish.report.descriptor.marker,
      );
      expect(chainA.stepArgs.publish.commandArgs.searchQuery).toBe(
        chainB.stepArgs.publish.commandArgs.searchQuery,
      );
      expect(extractSearchMarker(chainA.stepArgs.publish.searchArgv)).toBe(
        extractSearchMarker(chainB.stepArgs.publish.searchArgv),
      );
      expect(chainA.resolvePlan.action.issueNumber).toBe(
        chainB.resolvePlan.action.issueNumber,
      );
      expect(chainA.outcomeReport.gitSha).toBe(chainB.outcomeReport.gitSha);
      expect(chainA.outcomeReport.dateToken).toBe(
        chainB.outcomeReport.dateToken,
      );
    });
  });

  describe("activities·modelId·run 변별성(branch — 같은 results, 다른 activities/runPlan → summary 불변·inputs/modelId/run-identity 변별)", () => {
    it("(i) 동일 results·동일 N 고정 + (a) activities_A vs activities_B → 두 chain summary 동일(results 종속)·inputs 변별, (b) runPlan_A{model-x,run_A} vs runPlan_B{model-y,run_B} → summary 동일(RealDataResultSummary 가 run-무관 — count/분포/totalVolume 만 보유) 이나 modelId·marker·outcomeReport.{gitSha,dateToken} 변별 — activities·modelId·run 변경이 summary 에 누설 0", () => {
      const results = defaultResults();
      const firstUsername =
        buildRealDataE2eSeed()[0].serviceIdentities[0].externalId;
      const activitiesA: GithubActivity[] = [
        syntheticActivity(firstUsername, "results-summary-Ac1", "commit"),
        syntheticActivity(firstUsername, "results-summary-Ap1", "pr"),
      ];
      const activitiesB: GithubActivity[] = [
        syntheticActivity(firstUsername, "results-summary-Bc2", "commit"),
        syntheticActivity(firstUsername, "results-summary-Bp2", "pr"),
        syntheticActivity(firstUsername, "results-summary-Bi2", "issue"),
      ];

      // (a) 다른 activities, 같은 runPlan·results → summary 동일(results 종속), inputs 변별.
      const runPlan = buildRunPlan();
      const chainAa = runChain([7, 13], runPlan, activitiesA, results);
      const chainAb = runChain([7, 13], runPlan, activitiesB, results);
      // summary 는 results 종속 — activities 변경에 불변.
      expect(chainAa.stepArgs.publish.report.summary).toEqual(
        chainAb.stepArgs.publish.report.summary,
      );
      // inputs 는 activities 변별(서로 다른 set).
      expect(chainAa.stepArgs.evaluation.inputs).not.toEqual(
        chainAb.stepArgs.evaluation.inputs,
      );
      expect(chainAa.stepArgs.evaluation.inputs).toHaveLength(
        activitiesA.length,
      );
      expect(chainAb.stepArgs.evaluation.inputs).toHaveLength(
        activitiesB.length,
      );

      // (b) 다른 runPlan(modelId+run), 같은 activities·results → summary 동일(run-무관),
      // modelId·marker·run-identity 변별. RealDataResultSummary(T-0580)는 count/분포/
      // totalVolume 만 보유 — run·modelId 무관이므로 (b)에서 summary 동일 단언이 유효하다.
      const activities = defaultActivities();
      const runPlanX = buildRunPlan("model-x", "abc1234", "2026-06-21");
      const runPlanY = buildRunPlan("model-y", "def5678", "2026-06-29");
      const chainBx = runChain([7, 13], runPlanX, activities, results);
      const chainBy = runChain([7, 13], runPlanY, activities, results);
      // summary 는 run·modelId 무관(results 종속) → 두 chain 동일.
      expect(chainBx.stepArgs.publish.report.summary).toEqual(
        chainBy.stepArgs.publish.report.summary,
      );
      expect(chainBx.stepArgs.publish.report.summary).toEqual(
        buildRealDataResultIssueCommandPlan(results, runPlanX.run).report
          .summary,
      );
      // modelId 변별.
      chainBx.stepArgs.evaluation.callArgs.forEach((c) => {
        expect(c.options.modelId).toBe("model-x");
      });
      chainBy.stepArgs.evaluation.callArgs.forEach((c) => {
        expect(c.options.modelId).toBe("model-y");
      });
      // marker·run-identity 변별(run token).
      const markerX = chainBx.stepArgs.publish.report.descriptor.marker;
      const markerY = chainBy.stepArgs.publish.report.descriptor.marker;
      expect(markerX).not.toBe(markerY);
      expect(markerX).toContain(expectedToken(runPlanX.run));
      expect(markerY).toContain(expectedToken(runPlanY.run));
      expect(chainBx.outcomeReport.gitSha).toBe(runPlanX.run.gitSha);
      expect(chainBy.outcomeReport.gitSha).toBe(runPlanY.run.gitSha);
      expect(chainBx.outcomeReport.dateToken).toBe(runPlanX.run.dateToken);
      expect(chainBy.outcomeReport.dateToken).toBe(runPlanY.run.dateToken);
      expect(chainBx.outcomeReport.gitSha).not.toBe(
        chainBy.outcomeReport.gitSha,
      );
    });
  });

  describe("create 분기 격리(branch — 검색 미스 → create, summary·inputs·modelId·searchArgv·post 무관)", () => {
    it("(j) 빈 hit search stdout('[]') → resolve.action 이 create 분기(action.update 부재) — stepArgs.publish.report.summary(= results 재유도) / evaluation.inputs / callArgs[].options.modelId / searchArgv --match marker 는 create/update 두 분기 모두 동일(검색 결과가 summary·evaluation inputs·modelId·검색 인자 벡터를 바꾸지 0), post 는 여전히 execStdout 의 N 으로 issueNumber 산출(누설 0)", () => {
      const runPlan = buildRunPlan();
      const activities = defaultActivities();
      const results = defaultResults();
      const stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results);
      const marker = stepArgs.publish.report.descriptor.marker;

      // 빈 hit → create 분기(검색 미스).
      const resolveCreate = resolveRealDataResultIssueGhCommandPlan(
        "[]",
        stepArgs.publish.commandArgs,
      );
      expect(resolveCreate.action.action).toBe("create");
      expect("issueNumber" in resolveCreate.action).toBe(false);

      // update 분기(같은 marker hit).
      const resolveUpdate = resolveRealDataResultIssueGhCommandPlan(
        multiHitStdout(marker, [7, 13]),
        stepArgs.publish.commandArgs,
      );
      expect(resolveUpdate.action.action).toBe("update");

      // summary(= results 재유도) / inputs / modelId / searchArgv --match marker 는
      // 검색 결과(create/update)와 무관.
      expect(stepArgs.publish.report.summary).toEqual(
        buildRealDataResultIssueCommandPlan(results, runPlan.run).report
          .summary,
      );
      expect(stepArgs.evaluation.inputs).toEqual(
        buildRealDataEvaluationInputs(activities),
      );
      stepArgs.evaluation.callArgs.forEach((c, i) => {
        expect(c.input).toBe(stepArgs.evaluation.inputs[i]);
        expect(c.options.modelId).toBe(runPlan.pipeline.modelId);
      });
      expect(extractSearchMarker(stepArgs.publish.searchArgv)).toBe(marker);

      // post step-args 는 resolve 분기와 독립 — execStdout 의 N 으로 issueNumber 산출.
      const N = 42;
      const outcomeReport = buildRealDataResultOutcomeStepArgs(
        runPlan,
        execStdout(N),
      );
      expect(outcomeReport.issueNumber).toBe(N);
    });
  });

  describe("error path / negative cases — 여덟 boundary 거부 대칭 박제(R-112 negative 충분 cover)", () => {
    it("(k) runPlan.pipeline.modelId 빈('') → run-plan 합성 단계(buildRealDataE2eRunPlan) 측 pipeline modelId guard throw(평가 leg 비식별 — modelId 정책 미결정이면 run plan 산출 차단)", () => {
      const seeds = buildRealDataE2eSeed();
      expect(() =>
        buildRealDataE2eRunPlan(seeds, "", {
          gitSha: "abc1234",
          dateToken: "2026-06-29",
        }),
      ).toThrow();
    });

    it("(k') runPlan.pipeline.modelId 공백-only('   ') 우회 합성 → aggregator(buildRealDataE2eStepArgs) 측 evaluation 위임 하위 modelId guard throw(aggregator 단계 거부 — inputs 재유도 도달 전 차단)", () => {
      const base = buildRunPlan();
      const blankModelRunPlan: RealDataE2eRunPlan = {
        pipeline: { ...base.pipeline, modelId: "   " },
        run: base.run,
      };
      expect(() =>
        buildRealDataE2eStepArgs(
          blankModelRunPlan,
          defaultActivities(),
          defaultResults(),
        ),
      ).toThrow();
    });

    it("(l) runPlan.run.gitSha 빈('') → aggregator측 publish 위임 report-plan assertNonBlank('gitSha') throw(publish leg summary 도달 전 차단). modelId·activities·results 정상이어도 차단", () => {
      const base = buildRunPlan();
      const blankRunPlan: RealDataE2eRunPlan = {
        pipeline: base.pipeline,
        run: { gitSha: "", dateToken: "2026-06-29" },
      };
      expect(() =>
        buildRealDataE2eStepArgs(
          blankRunPlan,
          defaultActivities(),
          defaultResults(),
        ),
      ).toThrow();
    });

    it("(l') runPlan.run.dateToken 빈('') → aggregator측 publish 위임 assertNonBlank('dateToken') throw 대칭", () => {
      const base = buildRunPlan();
      const blankRunPlan: RealDataE2eRunPlan = {
        pipeline: base.pipeline,
        run: { gitSha: "abc1234", dateToken: "" },
      };
      expect(() =>
        buildRealDataE2eStepArgs(
          blankRunPlan,
          defaultActivities(),
          defaultResults(),
        ),
      ).toThrow();
    });

    it("(m) runPlan.run.gitSha 빈('') → post(buildRealDataResultOutcomeStepArgs) 측 위임 assertNonBlank throw(post boundary 종단 비식별 — execStdout URL 정상이어도 차단)", () => {
      const base = buildRunPlan();
      const blankRunPlan: RealDataE2eRunPlan = {
        pipeline: base.pipeline,
        run: { gitSha: "", dateToken: "2026-06-29" },
      };
      expect(() =>
        buildRealDataResultOutcomeStepArgs(blankRunPlan, execStdout(7)),
      ).toThrow();
    });

    it("(n) searchStdout 비JSON('not json') → resolve parse 위임 throw(stepArgs.publish.commandArgs 정상이어도 hits 추출 실패로 차단)", () => {
      const stepArgs = buildRealDataE2eStepArgs(
        buildRunPlan(),
        defaultActivities(),
        defaultResults(),
      );
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(
          "not json",
          stepArgs.publish.commandArgs,
        ),
      ).toThrow();
    });

    it("(o) execStdout URL 미발견(빈 문자열) → post parse 위임 throw(runPlan.run 정상이어도 outcome 추출 실패)", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(buildRunPlan(), ""),
      ).toThrow();
    });

    it("(o') execStdout /issues/0 → post assertPositiveIssueNumber throw(post 비식별)", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(
          buildRunPlan(),
          `https://github.com/${OWNER}/${REPO}/issues/0\n`,
        ),
      ).toThrow();
    });

    // summary 축 negative — production 집계(`buildRealDataResultSummary`)는 모든 difficulty/
    // contribution 을 production 타입(Difficulty / ContributionLevel)으로 좁혀진 typed union
    // 으로 받으며 throw 분기 0 으로 관대하게 집계한다(evaluation-result.ts / result-summary.ts
    // 시그니처 확인 — 슬롯 누적만, throw 분기 0). 따라서 본 task 의 summary 축 negative 는
    // task line 91 의 명시 대체 — **빈 results → summary count 0·totalVolume 0·전 슬롯 0
    // 정상(throw 0) 경계 단언**으로 대체한다. aggregator 가 빈 results 를 그대로 전파해 publish
    // 위임이 count 0 summary 를 반환하고 그것이 command-plan 재유도와 byte-identical 함을 확인.
    it("(p) summary 축 negative 대체 — 빈 results → stepArgs.publish.report.summary count 0·totalVolume 0·전 슬롯 0(throw 0), command-plan 재유도와 byte-identical, evaluation leg / resolve / post 는 정상 진행(summary 축 빈 경계가 7-way closure 의 다른 축을 차단하지 0)", () => {
      const runPlan = buildRunPlan();
      const activities = defaultActivities();
      const stepArgs = buildRealDataE2eStepArgs(runPlan, activities, []);

      // 빈 results → count 0·totalVolume 0(throw 0).
      expect(stepArgs.publish.report.summary.count).toBe(0);
      expect(stepArgs.publish.report.summary.totalVolume).toBe(0);
      expect(stepArgs.publish.report.summary.byDifficulty.easy).toBe(0);
      expect(stepArgs.publish.report.summary.byContribution.zero).toBe(0);
      // command-plan 재유도와 byte-identical(빈 경계에도 재유도 일관).
      expect(stepArgs.publish.report.summary).toEqual(
        buildRealDataResultIssueCommandPlan([], runPlan.run).report.summary,
      );
      // evaluation leg / resolve / post 는 정상 진행(summary 빈 경계가 다른 축 차단 0).
      expect(stepArgs.evaluation.inputs).toEqual(
        buildRealDataEvaluationInputs(activities),
      );
      const marker = stepArgs.publish.report.descriptor.marker;
      expect(marker.length).toBeGreaterThan(0);
      const resolvePlan = resolveRealDataResultIssueGhCommandPlan(
        multiHitStdout(marker, [7, 13]),
        stepArgs.publish.commandArgs,
      );
      expect(resolvePlan.action.action).toBe("update");
      if (resolvePlan.action.action !== "update") {
        throw new Error("update action 기대");
      }
      expect(resolvePlan.action.issueNumber).toBe(7);
      const outcomeReport = buildRealDataResultOutcomeStepArgs(
        runPlan,
        execStdout(7),
      );
      expect(outcomeReport.issueNumber).toBe(7);
    });
  });

  describe("결정론·무공유·no-mutation — chain 두 번 호출 + 입력 불변 + 무공유", () => {
    it("(q) 동일 (runPlan, activities, results, searchStdout, execStdout) chain 두 번 → stepArgs(evaluation+publish)/resolvePlan/outcomeReport 모두 deep-equal(결정론)", () => {
      const runPlan = buildRunPlan();
      const activities = defaultActivities();
      const results = defaultResults();
      const chain1 = runChain([7, 13], runPlan, activities, results);
      const chain2 = runChain([7, 13], runPlan, activities, results);

      expect(chain1.stepArgs.evaluation).toEqual(chain2.stepArgs.evaluation);
      expect(chain1.stepArgs.publish).toEqual(chain2.stepArgs.publish);
      expect(chain1.resolvePlan).toEqual(chain2.resolvePlan);
      expect(chain1.outcomeReport).toEqual(chain2.outcomeReport);
    });

    it("(r) no-mutation — 입력 runPlan(특히 aggregator publish leg 와 직접 호출 command-plan 재유도가 같은 results·runPlan 공유 읽기)·activities·results chain 호출 후 deep-equal(원본 불변)", () => {
      const runPlan = buildRunPlan();
      const activities = defaultActivities();
      const results = defaultResults();
      const runPlanBefore = JSON.parse(JSON.stringify(runPlan));
      const activitiesBefore = JSON.parse(JSON.stringify(activities));
      const resultsBefore = JSON.parse(JSON.stringify(results));

      const { stepArgs } = runChain([7, 13], runPlan, activities, results);
      // 직접 호출 재유도도 같은 results·runPlan 공유 읽기 — 그래도 입력 변형 0.
      buildRealDataResultIssueCommandPlan(results, runPlan.run);
      void stepArgs;

      expect(runPlan).toEqual(runPlanBefore);
      expect(activities).toEqual(activitiesBefore);
      expect(results).toEqual(resultsBefore);
    });

    it("(s) 무공유 — 직접 호출 buildRealDataResultIssueCommandPlan(results, runPlan.run).report.summary 와 stepArgs.publish.report.summary 는 deep-equal 이되 referential 분리(not.toBe — 무공유), 각 stage 산출물이 입력 runPlan 과도 referential identity 분리", () => {
      const runPlan = buildRunPlan();
      const results = defaultResults();
      const { stepArgs, outcomeReport } = runChain(
        [7, 13],
        runPlan,
        defaultActivities(),
        results,
      );

      // summary 재유도와 deep-equal 이지만 referential 분리(매 호출 새 객체).
      const directSummary = buildRealDataResultIssueCommandPlan(
        results,
        runPlan.run,
      ).report.summary;
      expect(stepArgs.publish.report.summary).toEqual(directSummary);
      expect(stepArgs.publish.report.summary).not.toBe(directSummary);

      // stage 산출물도 runPlan 과 referential 분리.
      expect(stepArgs).not.toBe(runPlan);
      expect(stepArgs.publish).not.toBe(runPlan);
      expect(stepArgs.publish.report).not.toBe(runPlan);
      expect(outcomeReport).not.toBe(runPlan);
      expect(outcomeReport).not.toBe(runPlan.run);
      // 필드 전파(referential 분리에도 값은 동일).
      expect(stepArgs.evaluation.callArgs[0].options.modelId).toBe(
        runPlan.pipeline.modelId,
      );
      expect(outcomeReport.gitSha).toBe(runPlan.run.gitSha);
    });
  });

  describe("credential 누출 0(branch — §9 / R-59 / REQ-059 정합)", () => {
    it("(t) stepArgs.publish.report.summary(직렬화) · report.descriptor.{title,marker,body} · evaluation.inputs(직렬화) · callArgs(직렬화) · searchArgv(각 원소) · commandArgs.searchQuery · resolvePlan.argv · outcomeReport.{url,summaryLine} 어디에도 token/secret/PAT/--auth 어휘 미등장", () => {
      const { stepArgs, resolvePlan, outcomeReport } = runChain([7, 13]);

      const surfaces: string[] = [
        JSON.stringify(stepArgs.publish.report.summary),
        stepArgs.publish.report.descriptor.title,
        stepArgs.publish.report.descriptor.marker,
        stepArgs.publish.report.descriptor.body,
        JSON.stringify(stepArgs.evaluation.inputs),
        JSON.stringify(stepArgs.evaluation.callArgs),
        ...stepArgs.publish.searchArgv,
        stepArgs.publish.commandArgs.searchQuery,
        resolvePlan.argv.join(" "),
        outcomeReport.url,
        outcomeReport.summaryLine,
      ];

      const credentialPattern =
        /(GH_TOKEN|GITHUB_TOKEN|Bearer|Authorization|x-access-token|x-github-token|--token|--auth|ghp_[A-Za-z0-9]|PAT)/i;
      for (const surface of surfaces) {
        expect(surface).not.toMatch(credentialPattern);
      }
      // outcome url 은 issue 경로만 — commit/PR narrative 어휘 미포함.
      expect(outcomeReport.url).not.toMatch(/commit|pull request/i);
    });
  });
});
