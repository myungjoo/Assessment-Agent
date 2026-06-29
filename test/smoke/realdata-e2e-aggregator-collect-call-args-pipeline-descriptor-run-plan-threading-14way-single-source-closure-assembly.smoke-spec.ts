// realdata-e2e-aggregator-collect-call-args-pipeline-descriptor-run-plan-threading-14way-single-source-closure-assembly.smoke-spec.ts
// — 실 평가 e2e step④ aggregator collect-call-args 합류 14-way single-source closure:
// 최외곽 진입 `buildRealDataE2eRunPlan(seeds, modelId, run)` → `{pipeline, run}` 가
// 산출하는 collect-leg `runPlan.pipeline.collectCallArgs` 가 `buildRealDataCollectCallArgs(
// seeds)`(같은 seeds 직접 재호출) 산출과 **byte-identical 재유도**이고, 그 collect-leg
// modelId(`runPlan.pipeline.modelId`)가 aggregator `buildRealDataE2eStepArgs(runPlan,
// activities, results)` 의 evaluation-leg `callArgs[].options.modelId` 로 **동형 thread**
// 됨을 14번째 축으로 합류시킨다.
//
// collect-leg(`collectCallArgs`)는 e2e 의 step②(실 수집) 진입 plan(seed-side)으로,
// aggregator 가 산출 표면으로 surface 하는 evaluate/publish 두 leg(T-0782 13축)와 distinct
// surface 다 — collect-leg 는 `runPlan.pipeline` 으로 aggregator 옆을 흐르되 같은 검증
// source(seeds+modelId+run)에서 나온다. 본 spec 은 그 collect-leg 가 단일 검증 runPlan
// source 의 collect 산물임을, aggregator 가 같은 runPlan 으로 thread 한 evaluation-leg
// modelId·publish-leg·resolve·post 와 묶어 closure 에 합류시킨다:
//   (축 14, 새 표면) runPlan.pipeline.collectCallArgs == buildRealDataCollectCallArgs(seeds)
//       byte-identical 재유도(원소별 since==undefined·assessmentId==ASSESSMENT_ID_PLACEHOLDER
//       ·person 1:1·길이==seeds.length) AND collect-leg modelId(runPlan.pipeline.modelId)
//       == modelId == evaluation callArgs[].options.modelId(두 leg 동일 source thread).
//   (축 13) searchArgv 전체-벡터 위치-정합.
//   (축 12) resolvePlan.argv 위치-정합(update/create 두 분기).
//   (축 11) command-args createArgs.labels 고정상수 `["realdata-e2e","result"]`.
//   (축 9~10) command-args {create,update}Args.{title,body} 두 경로 == descriptor.{title,body}.
//   (축 6~8) descriptor.{title,body}·summary command-plan 경유 재유도 byte-identical.
//   (축 4~5) evaluation.inputs == buildRealDataEvaluationInputs(activities), callArgs[i].input
//       === inputs[i], callArgs[i].options.modelId === runPlan.pipeline.modelId.
//   (축 2~3) marker 3-축 — descriptor.marker / commandArgs.searchQuery / searchArgv[4] 동일.
//   (축 1, 종단) marker → resolve issueNumber → post run-identity(동일 runPlan.run 전파).
//
// 이 14-way 가 검증 source `(seeds, modelId, run, activities, results)` single-source 에서
// 한 chain 동시-호출로 수렴함이 search-or-update 멱등성(REQ-009)·raw 미보유 평가 입력/결과
// 집계 정합(REQ-032)·결과 리포트 재실행 정합(REQ-037)·credential 미보유(REQ-059)의
// aggregator-level "step② collect 호출-args(seed-side)·step③ evaluate(modelId)·step④
// publish/resolve/post 세 leg 가 모두 같은 단일 검증 runPlan source 의 산물" 의 종단 닫음
// 이다. e2e 의 세 단계 leg(collect·evaluate·publish)가 단일 검증 runPlan source 에서 동시
// thread 되는 slice. (T-0783 박제, PLAN.md 109행 🟢 실 평가 e2e step④).
//
// 본 spec 의 존재 이유 — public CI gap 해소(collect-leg 축을 14번째 축으로 합류):
//   - aggregator-* sweep smoke 13파일(4~13-way)은 전부 evaluation/publish 두 leg 산출만
//     convergence 축으로 잡았다. 11-way 에 collectCallArgs 가 1회 등장하나 synthetic runPlan
//     합성용 incidental 일 뿐 — buildRealDataCollectCallArgs(seeds) 재유도 toEqual 0.
//   - collect-leg self-guard(assertRealDataCollectCallArgsConsistentWithSources, T-0688 +
//     assertRealDataPipelinePlanConsistentWithSources, T-0680)가 빌더 내부 self-wire 로
//     round-trip 을 박제했으나 aggregator(buildRealDataE2eStepArgs) 진입·evaluate/publish
//     thread·resolve·post 미합류(빌더 단독 self-guard).
//   - pipeline-plan/run-plan dual-leg smoke 는 run-plan 단독에서 collectCallArgs↔modelId 두
//     leg 를 묶었으나 aggregator(step-args) → evaluate/publish/resolve/post 종단 chain 미합류.
//   - 본 spec 은 그 빈 자리를 채워 collect-leg(runPlan.pipeline.collectCallArgs)가 같은 검증
//     source seeds 재유도이고 collect-leg modelId 가 evaluate-leg 와 같은 source 임을 step-args
//     aggregator closure 까지 묶는다.
//   - live leg(실 prisma·실 collectForPerson·실 github.com fetch·실 LLM scoring·실 gh CLI
//     실행·DB·LAN gate)는 복제하지 않고, synthetic seeds/modelId/run + activities/results
//     literal + search-stdout/exec-stdout literal 을 컴포저들에 직접 공급해 live leg 를
//     우회한다(조립 surface 만 검증). 따라서 본 spec 은:
//
//      🔥 실 collectForPerson 호출 0 — collectCallArgs 는 collectForPerson 호출-args 묶음
//         build-time 정합만 검증(실 수집 실행 0). 실 gh / fetch / LLM / DB 0.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 helper export 재사용만(가드/helper 신설 0).
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0783):
//   - src 변경 0(src/, prisma/, package.json, CI workflow, 환경 변수 추가 등 모두 금지). test-only.
//   - 실 collectForPerson 호출 / 실 수집(step② live wiring — LAN/credential gate, deferred) /
//     실 gh CLI 호출 / 실 LLM scoreUnit 호출 / 실 issue 검색·박제. in-memory 합성만.
//   - aggregator 13-way(search-argv·resolve-argv·labels·title·body·descriptor·summary·inputs·
//     modelId·marker·resolve·post) 자체 재단언(T-0782 cover). 본 task 는 collect-leg
//     (runPlan.pipeline.collectCallArgs) 재유도 + collect-leg modelId 가 evaluation-leg 와
//     같은 source 임을 14번째 축으로 합류시킨 부분만(나머지 축은 14-way 묶음 표현용 동시-성립).
//   - collect-leg self-guard(T-0688 + T-0680 + T-0678) 자체 재단언(빌더 spec cover).
//   - pipeline-plan/run-plan dual-leg convergence smoke 의 "run-plan 단독 collect↔modelId"
//     재단언(본 task 는 aggregator → evaluate/publish/resolve/post 종단 chain 까지 묶음).
//   - buildRealDataCollectInput / CollectForPersonInput shape 자체 재단언(collect-input helper
//     spec cover). collect-leg call-args 묶음 재유도·결정론 상수(since/assessmentId)만.
//   - since derivation 실 로직(SinceDerivationService.deriveSince, DB) / ASSESSMENT_ID_
//     PLACEHOLDER → 실 assessment.id 치환 runner / 난이도별 modelId routing(R-97 deferred) 0.
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
import {
  ASSESSMENT_ID_PLACEHOLDER,
  buildRealDataCollectCallArgs,
} from "../helpers/realdata-e2e-seed-collect-call-args";
import { buildRealDataE2eSeed } from "../helpers/realdata-e2e-seed-fixture";
import type { RealDataSeedDescriptor } from "../helpers/realdata-e2e-seed-fixture";
import { buildRealDataE2eStepArgs } from "../helpers/realdata-e2e-step-args";

// 결정론 owner/repo — 합성 issue URL 의 path segment source(public CI 에서 항상 green
// 발화). token/secret/PAT/--auth 어휘 미포함.
const OWNER = "myungjoo";
const REPO = "assessment-agent";

// 결정론 modelId fixture — runPlan 의 pipeline 측 입력. collect-leg modelId(runPlan.pipeline
// .modelId) AND evaluation callArgs[].options.modelId 두 leg 가 공유하는 단일 source.
const MODEL_ID =
  "cfg-realdata-e2e-aggregator-collect-call-args-pipeline-descriptor-run-plan-threading-smoke";

const INSTANCE_KEY = "github.com";

// 고정 결정론 분류 라벨 — command-args.ts RESULT_ISSUE_LABELS = ["realdata-e2e","result"]
// 가 박제한 현재 값. create 분기 argv 의 `--label` flag-pair 로 전개될 expected.
const EXPECTED_RESULT_ISSUE_LABELS = ["realdata-e2e", "result"];

// search-argv helper 가 산출하는 canonical 9-원소 전체-벡터(marker 위치만 입력 종속). 14-way
// 묶음 표현용 동시-성립 항(축 13). marker(index 4)는 chain 시점에 commandArgs.searchQuery 로 채움.
function expectedSearchArgv(marker: string): string[] {
  return [
    "search",
    "issues",
    "--match",
    "body",
    marker,
    "--json",
    "number,title,body",
    "--limit",
    "30",
  ];
}

// 합성 run-token — descriptor 컴포저 내부 runToken(run) = `${dateToken}@${gitSha}` 규칙으로
// test 측에서 재유도한 expected 공유 substring.
function expectedToken(run: RealDataE2eRunPlan["run"]): string {
  return `${run.dateToken}@${run.gitSha}`;
}

// 기본 seeds — fixed 2-Person(myungjoo/leemgs) descriptor 배열(T-0573 픽스처). collect-leg
// 재유도의 single-source. 매 호출 새 객체 트리(무공유).
function defaultSeeds(): RealDataSeedDescriptor[] {
  return buildRealDataE2eSeed();
}

// 변별용 단일-Person seeds 합성 헬퍼 — defaultSeeds(2 원소)와 원소 수/serviceIdentities 가
// 다른 seeds 로 collectCallArgs 1:1 매핑 변별을 박제(seeds 종속 변별 chain). seed-fixture
// 시그니처(person/serviceIdentities) 그대로 literal 합성.
function customSeeds(usernames: string[]): RealDataSeedDescriptor[] {
  return usernames.map((username) => ({
    person: {
      fullName: username,
      email: `${username}@e2e.realdata.test`,
      active: true,
    },
    serviceIdentities: [
      { service: "github.com" as const, externalId: username, isPrimary: true },
    ],
  }));
}

// synthetic runPlan 합성 — buildRealDataE2eRunPlan(seeds, modelId, run) 호출로 검증된 단일
// `{pipeline, run}` 을 만든다(modelId·run guard 통과 비공백 토큰). 매 호출 새 객체 트리.
function buildRunPlan(
  seeds: RealDataSeedDescriptor[] = defaultSeeds(),
  modelId = MODEL_ID,
  gitSha = "abc1234",
  dateToken = "2026-06-28",
): RealDataE2eRunPlan {
  return buildRealDataE2eRunPlan(seeds, modelId, { gitSha, dateToken });
}

// synthetic GithubActivity 1 건 — aggregator 의 evaluation leg 입력. callArgs 가 1+ 원소를
// 갖도록 보장(collect-leg modelId thread 도착지).
function syntheticActivity(
  author: string,
  externalId = "realdata-e2e-aggregator-collect-call-args-c1",
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
// username 을 author 로 매칭. 다양한 kind 분포로 inputs 재유도 검증.
function defaultActivities(
  seeds: RealDataSeedDescriptor[] = defaultSeeds(),
): GithubActivity[] {
  const firstUsername = seeds[0].serviceIdentities[0].externalId;
  return [
    syntheticActivity(
      firstUsername,
      "aggregator-collect-call-args-c1",
      "commit",
    ),
    syntheticActivity(firstUsername, "aggregator-collect-call-args-p1", "pr"),
    syntheticActivity(
      firstUsername,
      "aggregator-collect-call-args-i1",
      "issue",
    ),
  ];
}

// synthetic EvaluationResult 1 건 — aggregator 의 publish leg 입력(summary 집계 + body 렌더
// + command-args title/body source).
function syntheticResult(
  unitId: string,
  difficulty: EvaluationResult["difficulty"],
  contribution: EvaluationResult["contribution"],
  volume: number,
): EvaluationResult {
  return {
    unitId,
    narrative:
      "synthetic evaluation narrative — aggregator collect-call-args(runPlan.pipeline.collectCallArgs == buildRealDataCollectCallArgs(seeds))+collect-leg-modelId-thread+search-argv+resolve-argv+command-args-{title,body,labels}+descriptor-{title,body}+results-summary+evaluation-inputs+marker ↔ resolve ↔ outcome-step-args run-plan-threading 14-way closure smoke fixture",
    difficulty,
    contribution,
    volume,
  };
}

// 유효 results fixture(분포 X) — aggregator 의 publish leg summary 집계 + body 렌더 source.
function defaultResults(): EvaluationResult[] {
  return [
    syntheticResult("github:github.com:c1", "easy", "low", 3),
    syntheticResult("github:github.com:c2", "medium", "high", 5),
    syntheticResult("github:github.com:c3", "hard", "medium", 2),
  ];
}

// marker(=searchQuery, = searchArgv[4])를 body 에 포함한 hit 1+건 search stdout 합성 헬퍼
// — 동일 run 이슈가 이미 존재하는 경우(resolve update 분기 유발).
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
// https://github.com/<owner>/<repo>/issues/<N> URL 한 줄을 포함.
function execStdout(n: number, noisePrefix = ""): string {
  return `${noisePrefix}https://github.com/${OWNER}/${REPO}/issues/${n}\n`;
}

// 최외곽 진입 buildRealDataE2eRunPlan(seeds, modelId, run) → aggregator
// buildRealDataE2eStepArgs(runPlan, activities, results) → resolve(search-stdout +
// stepArgs.publish.commandArgs → {action, argv}) → post step-args(buildRealDataResultOutcome
// StepArgs(runPlan, execStdout))를 single-source(동일 seeds + modelId + run + activities +
// results + N)로 묶어 한 chain 으로 호출하는 헬퍼. 핵심: aggregator·post 두 곳에 같은 runPlan
// 한 객체를 넘긴다. 본 task 의 새 표면 = runPlan.pipeline.collectCallArgs 재유도(축 14).
function runChain(
  hitsNumbers: number[],
  seeds: RealDataSeedDescriptor[] = defaultSeeds(),
  runPlan: RealDataE2eRunPlan = buildRunPlan(seeds),
  activities: GithubActivity[] = defaultActivities(seeds),
  results: EvaluationResult[] = defaultResults(),
  noisePrefix = "",
): {
  expectedMinN: number;
  seeds: RealDataSeedDescriptor[];
  runPlan: RealDataE2eRunPlan;
  activities: GithubActivity[];
  results: EvaluationResult[];
  stepArgs: ReturnType<typeof buildRealDataE2eStepArgs>;
  resolvePlan: ReturnType<typeof resolveRealDataResultIssueGhCommandPlan>;
  outcomeReport: ReturnType<typeof buildRealDataResultOutcomeStepArgs>;
} {
  // stage 1(pre boundary, aggregator dual-leg threaded) — stepArgs: {evaluation, publish}.
  // collect-leg 는 runPlan.pipeline 으로 옆을 흐른다(aggregator 가 surface 안 함).
  const stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results);

  // stage 2(resolve) — searchStdout(marker hit 1+) + stepArgs.publish.commandArgs →
  // {action(update), argv(issue edit ...)}.
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

  // stage 3(post boundary, run-plan-threaded) — 동일 runPlan 한 객체를 post 컴포저에 직접 공급.
  const outcomeReport = buildRealDataResultOutcomeStepArgs(
    runPlan,
    execStdout(resolvedN, noisePrefix),
  );

  return {
    expectedMinN,
    seeds,
    runPlan,
    activities,
    results,
    stepArgs,
    resolvePlan,
    outcomeReport,
  };
}

describe("Smoke(non-gated): 실 평가 e2e step④ aggregator collect-call-args 합류 14-way single-source closure buildRealDataE2eRunPlan → runPlan.pipeline.collectCallArgs == buildRealDataCollectCallArgs(seeds)(byte-identical 재유도 — 원소별 since==undefined·assessmentId==ASSESSMENT_ID_PLACEHOLDER·person 1:1·길이==seeds.length) + collect-leg modelId(runPlan.pipeline.modelId) == modelId == evaluation callArgs[].options.modelId 동일 source thread + search-argv 전체-벡터 위치-정합 + resolve-argv 위치-정합(update/create) + command-args labels 고정상수 + command-args {title,body} 두 경로(=descriptor.{title,body}) + descriptor.{title,body}·summary 재유도 + evaluation {inputs(=buildRealDataEvaluationInputs(activities), callArgs[i].input===inputs[i])} + marker 3-축 + resolve issueNumber + post run-identity ↔ buildRealDataE2eStepArgs 동일 (seeds, modelId, run, activities, results) 한 chain 동시-호출 14축 동시 수렴 live-collect/live-gh/live-LLM 0 검증", () => {
  describe("happy path — aggregator 14-way chain 합성(collectCallArgs 비어있지 않은 배열·길이==seeds.length + 다섯 산출물)", () => {
    it("(a) 유효 seeds + modelId + run + activities + results + searchStdout + execStdout → runPlan.pipeline({collectCallArgs(비어있지 않음·길이==seeds.length), modelId}) / stepArgs.evaluation({inputs,callArgs} 비어있지 않음) / stepArgs.publish({report,commandArgs,searchArgv} 정상) / resolvePlan(update {action, issueNumber} + 비어있지 않은 string[] argv) / outcomeReport(5필드) 모두 정상", () => {
      const seeds = defaultSeeds();
      const { runPlan, stepArgs, resolvePlan, outcomeReport } = runChain(
        [7, 13],
        seeds,
      );

      // stage 0 — collect-leg(runPlan.pipeline.collectCallArgs) 정상.
      expect(Array.isArray(runPlan.pipeline.collectCallArgs)).toBe(true);
      expect(runPlan.pipeline.collectCallArgs.length).toBeGreaterThan(0);
      expect(runPlan.pipeline.collectCallArgs).toHaveLength(seeds.length);
      expect(typeof runPlan.pipeline.modelId).toBe("string");

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
      expect(stepArgs.publish.searchArgv).toHaveLength(9);

      // stage 2 — resolve plan(update {action, issueNumber} + 비어있지 않은 string[] argv).
      expect(resolvePlan.action.action).toBe("update");
      if (resolvePlan.action.action !== "update") {
        throw new Error("update action 기대");
      }
      expect(typeof resolvePlan.action.issueNumber).toBe("number");
      expect(resolvePlan.argv.length).toBeGreaterThan(0);

      // stage 3 — outcome step-args report(5필드).
      expect(typeof outcomeReport.issueNumber).toBe("number");
      expect(outcomeReport.issueNumber).toBeGreaterThan(0);
      expect(outcomeReport.url.length).toBeGreaterThan(0);
      expect(outcomeReport.gitSha).toBe("abc1234");
      expect(outcomeReport.dateToken).toBe("2026-06-28");
      expect(outcomeReport.summaryLine.length).toBeGreaterThan(0);
    });
  });

  describe("collect-leg call-args 재유도 수렴(branch — 핵심 불변식 1, 본 task 의 새 표면 — 축 14)", () => {
    it("(b) runPlan.pipeline.collectCallArgs deep-equal(toEqual) buildRealDataCollectCallArgs(seeds)(같은 seeds 직접 재호출) byte-identical, 원소별 since===undefined(toBeUndefined)·assessmentId===ASSESSMENT_ID_PLACEHOLDER(toBe, import const)·person 1:1 seed 매핑·collectCallArgs.length === seeds.length", () => {
      const seeds = defaultSeeds();
      const runPlan = buildRunPlan(seeds);
      const collectCallArgs = runPlan.pipeline.collectCallArgs;

      // 핵심 — collect-leg 재유도 byte-identical(같은 seeds 직접 재호출).
      const directCollect = buildRealDataCollectCallArgs(seeds);
      expect(collectCallArgs).toEqual(directCollect);
      expect(collectCallArgs).toHaveLength(seeds.length);

      // 원소별 결정론 상수 + person 1:1 매핑.
      collectCallArgs.forEach((args, i) => {
        expect(args.since).toBeUndefined();
        expect(args.assessmentId).toBe(ASSESSMENT_ID_PLACEHOLDER);
        // person 이 seed 의 externalId 와 1:1(username 운반).
        expect(JSON.stringify(args.person)).toContain(
          seeds[i].serviceIdentities[0].externalId,
        );
      });
    });
  });

  describe("collect-leg → evaluation-leg modelId 동일 source thread 수렴(branch — 핵심 불변식 2)", () => {
    it("(c) runPlan.pipeline.modelId === modelId(입력 정책, toBe) AND 모든 stepArgs.evaluation.callArgs[i].options.modelId === runPlan.pipeline.modelId(toBe, forEach) — collect-leg 와 evaluate-leg 가 같은 단일 modelId source 공유", () => {
      const seeds = defaultSeeds();
      const runPlan = buildRunPlan(seeds);
      const { stepArgs } = runChain([7, 13], seeds, runPlan);

      // collect-leg modelId == 입력 정책 modelId.
      expect(runPlan.pipeline.modelId).toBe(MODEL_ID);

      // evaluate-leg 의 각 callArgs.options.modelId == collect-leg 의 modelId(같은 source).
      expect(stepArgs.evaluation.callArgs.length).toBeGreaterThan(0);
      stepArgs.evaluation.callArgs.forEach((c) => {
        expect(c.options.modelId).toBe(runPlan.pipeline.modelId);
        expect(c.options.modelId).toBe(MODEL_ID);
      });
    });
  });

  describe("collect-leg 변별성 — seeds 변경이 collectCallArgs 에만 전파, modelId 변경에 비종속(branch)", () => {
    it("(d) 같은 modelId·run·activities·results, 다른 seeds(원소 수/username 다름) → collectCallArgs 가 각 seeds 1:1 매핑(길이·person 매핑 다름), 그러나 since(undefined)·assessmentId(placeholder)·runPlan.pipeline.modelId 는 두 chain 동일(seeds 종속·modelId 입력 불변)", () => {
      const seedsA = customSeeds(["alice", "bob", "carol"]);
      const seedsB = customSeeds(["dave"]);
      const runPlanA = buildRunPlan(seedsA);
      const runPlanB = buildRunPlan(seedsB);

      const collectA = runPlanA.pipeline.collectCallArgs;
      const collectB = runPlanB.pipeline.collectCallArgs;

      // 길이/person 매핑은 seeds 종속(다름).
      expect(collectA).toHaveLength(3);
      expect(collectB).toHaveLength(1);
      expect(JSON.stringify(collectA[0].person)).toContain("alice");
      expect(JSON.stringify(collectB[0].person)).toContain("dave");

      // since/assessmentId 결정론 상수 + modelId 는 두 chain 동일(불변).
      [...collectA, ...collectB].forEach((args) => {
        expect(args.since).toBeUndefined();
        expect(args.assessmentId).toBe(ASSESSMENT_ID_PLACEHOLDER);
      });
      expect(runPlanA.pipeline.modelId).toBe(runPlanB.pipeline.modelId);
      expect(runPlanA.pipeline.modelId).toBe(MODEL_ID);
    });

    it("(d') 같은 seeds·activities·results, 다른 modelId → collectCallArgs 의 person/since/assessmentId 두 chain byte-identical(collectCallArgs 는 modelId 비종속), modelId 만 evaluation callArgs.options 로 전파", () => {
      const seeds = defaultSeeds();
      const runPlanA = buildRunPlan(seeds, "model-alpha");
      const runPlanB = buildRunPlan(seeds, "model-beta");

      // collectCallArgs 는 modelId 비종속 — 두 chain byte-identical.
      expect(runPlanA.pipeline.collectCallArgs).toEqual(
        runPlanB.pipeline.collectCallArgs,
      );

      // modelId 만 두 leg 공유로 전파(다름).
      const activities = defaultActivities(seeds);
      const results = defaultResults();
      const stepArgsA = buildRealDataE2eStepArgs(runPlanA, activities, results);
      const stepArgsB = buildRealDataE2eStepArgs(runPlanB, activities, results);
      stepArgsA.evaluation.callArgs.forEach((c) => {
        expect(c.options.modelId).toBe("model-alpha");
      });
      stepArgsB.evaluation.callArgs.forEach((c) => {
        expect(c.options.modelId).toBe("model-beta");
      });
      expect(runPlanA.pipeline.modelId).not.toBe(runPlanB.pipeline.modelId);
    });
  });

  describe("search-argv 전체-벡터 위치-정합 수렴(branch — 14-way 묶음 항 — 축 13)", () => {
    it('(e) stepArgs.publish.searchArgv deep-equal(toEqual) ["search","issues","--match","body",commandArgs.searchQuery,"--json","number,title,body","--limit","30"], searchArgv[4]===commandArgs.searchQuery(toBe)', () => {
      const { stepArgs } = runChain([7, 13]);
      const searchArgv = stepArgs.publish.searchArgv;
      const searchQuery = stepArgs.publish.commandArgs.searchQuery;

      expect(searchArgv).toEqual(expectedSearchArgv(searchQuery));
      expect(searchArgv[4]).toBe(searchQuery);
    });
  });

  describe("resolve-argv update/create 위치-정합 수렴(branch — 묶음 항 — 축 12)", () => {
    it('(f) search hit N → resolvePlan.argv deep-equal ["issue","edit",String(N),"--title",updateArgs.title,"--body",updateArgs.body], search hit 0("[]") → ["issue","create","--title",createArgs.title,"--body",createArgs.body,"--label","realdata-e2e","--label","result"]', () => {
      const N = 7;
      const { stepArgs, resolvePlan } = runChain([N, 13]);
      const updateArgs = stepArgs.publish.commandArgs.updateArgs;
      const createArgs = stepArgs.publish.commandArgs.createArgs;

      expect(resolvePlan.argv).toEqual([
        "issue",
        "edit",
        String(N),
        "--title",
        updateArgs.title,
        "--body",
        updateArgs.body,
      ]);

      const resolveCreate = resolveRealDataResultIssueGhCommandPlan(
        "[]",
        stepArgs.publish.commandArgs,
      );
      expect(resolveCreate.action.action).toBe("create");
      expect(resolveCreate.argv).toEqual([
        "issue",
        "create",
        "--title",
        createArgs.title,
        "--body",
        createArgs.body,
        "--label",
        "realdata-e2e",
        "--label",
        "result",
      ]);
    });
  });

  describe("publish-leg command-args-labels 고정상수 + title/body 두 경로 일치(branch — 묶음 항 — 축 9~11)", () => {
    it("(g) createArgs.labels deep-equal ['realdata-e2e','result'], createArgs/updateArgs.title 둘 다 === descriptor.title, createArgs/updateArgs.body 둘 다 === descriptor.body byte-identical", () => {
      const { stepArgs } = runChain([7, 13]);
      const descriptorTitle = stepArgs.publish.report.descriptor.title;
      const descriptorBody = stepArgs.publish.report.descriptor.body;

      expect(stepArgs.publish.commandArgs.createArgs.labels).toEqual(
        EXPECTED_RESULT_ISSUE_LABELS,
      );
      expect(stepArgs.publish.commandArgs.createArgs.title).toBe(
        descriptorTitle,
      );
      expect(stepArgs.publish.commandArgs.updateArgs.title).toBe(
        descriptorTitle,
      );
      expect(stepArgs.publish.commandArgs.createArgs.body).toBe(descriptorBody);
      expect(stepArgs.publish.commandArgs.updateArgs.body).toBe(descriptorBody);
    });
  });

  describe("publish-leg descriptor-{title,body}·summary 재유도 byte-identical 수렴(branch — 축 6~8)", () => {
    it("(h) descriptor.{title,body}·report.summary === buildRealDataResultIssueCommandPlan(results, runPlan.run).report.{descriptor.{title,body},summary} byte-identical(toBe·toEqual)", () => {
      const seeds = defaultSeeds();
      const runPlan = buildRunPlan(seeds);
      const results = defaultResults();
      const { stepArgs } = runChain(
        [7, 13],
        seeds,
        runPlan,
        defaultActivities(seeds),
        results,
      );

      const cmdPlan = buildRealDataResultIssueCommandPlan(results, runPlan.run);
      expect(stepArgs.publish.report.descriptor.title).toBe(
        cmdPlan.report.descriptor.title,
      );
      expect(stepArgs.publish.report.descriptor.body).toBe(
        cmdPlan.report.descriptor.body,
      );
      expect(stepArgs.publish.report.summary).toEqual(cmdPlan.report.summary);
    });
  });

  describe("evaluation-leg inputs 재유도 + callArgs.input 페어링(branch — 축 4~5)", () => {
    it("(i) evaluation.inputs deep-equal buildRealDataEvaluationInputs(activities), 모든 callArgs[i].input === inputs[i](toBe, forEach)·길이 일치", () => {
      const seeds = defaultSeeds();
      const runPlan = buildRunPlan(seeds);
      const activities = defaultActivities(seeds);
      const { stepArgs } = runChain([7, 13], seeds, runPlan, activities);

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

  describe("publish-leg marker 3-축 일치(branch — 축 2~3)", () => {
    it("(j) report.descriptor.marker === commandArgs.searchQuery === searchArgv[4] 세 지점 byte-identical(toBe)", () => {
      const { stepArgs } = runChain([7, 13]);
      const descriptorMarker = stepArgs.publish.report.descriptor.marker;
      const searchArgv = stepArgs.publish.searchArgv;

      expect(stepArgs.publish.commandArgs.searchQuery).toBe(descriptorMarker);
      expect(searchArgv[4]).toBe(descriptorMarker);
    });
  });

  describe("marker → resolve issueNumber + post run-identity 수렴(branch — 축 1, 종단)", () => {
    it("(k) search hit N → resolvePlan.action.update.issueNumber → argv[2]==String(N) → outcomeReport.issueNumber 모두 동일 N(toBe(N)) AND outcomeReport.url 에 /issues/N AND 동일 runPlan.run 전파(marker run token == outcomeReport.{gitSha,dateToken,summaryLine})", () => {
      const N = 7;
      const seeds = defaultSeeds();
      const runPlan = buildRunPlan(seeds);
      const { stepArgs, resolvePlan, outcomeReport } = runChain(
        [N, 13],
        seeds,
        runPlan,
      );
      if (resolvePlan.action.action !== "update") {
        throw new Error("update action 기대");
      }

      expect(resolvePlan.action.issueNumber).toBe(N);
      expect(resolvePlan.argv[2]).toBe(String(N));
      expect(outcomeReport.issueNumber).toBe(N);
      expect(outcomeReport.url).toContain(`/issues/${N}`);

      const token = expectedToken(runPlan.run);
      expect(stepArgs.publish.report.descriptor.marker).toContain(token);
      expect(outcomeReport.gitSha).toBe(runPlan.run.gitSha);
      expect(outcomeReport.dateToken).toBe(runPlan.run.dateToken);
      expect(outcomeReport.summaryLine).toContain(runPlan.run.gitSha);
      expect(outcomeReport.summaryLine).toContain(runPlan.run.dateToken);
    });
  });

  describe("14-way 단일-source 묶음 단언(branch — closure 종단, 본 task 의 종단 박제)", () => {
    it("(l) runPlan.pipeline.collectCallArgs == buildRealDataCollectCallArgs(seeds)(원소별 since==undefined·assessmentId==placeholder·person 1:1), runPlan.pipeline.modelId == modelId == callArgs[].options.modelId, searchArgv == ['search','issues','--match','body',marker,...] AND searchArgv[4]==marker==searchQuery==descriptor.marker, update argv == ['issue','edit',String(N),...updateArgs], argv title/body == descriptor.{title,body} == 동 command-plan, argv labels == createArgs.labels == ['realdata-e2e','result'], summary == 동 command-plan, inputs == buildRealDataEvaluationInputs(activities), callArgs[].input===inputs[i], resolve N == argv[2] == post N, run token == post {gitSha,dateToken} 가 검증 source(seeds+modelId+run+activities+results) single-source 에서 14-way 동시 성립", () => {
      const N = 7;
      const seeds = defaultSeeds();
      const runPlan = buildRunPlan(seeds);
      const activities = defaultActivities(seeds);
      const results = defaultResults();
      const stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results);
      const marker = stepArgs.publish.report.descriptor.marker;
      const token = expectedToken(runPlan.run);
      const cmdPlan = buildRealDataResultIssueCommandPlan(results, runPlan.run);
      const createArgs = stepArgs.publish.commandArgs.createArgs;
      const updateArgs = stepArgs.publish.commandArgs.updateArgs;
      const searchQuery = stepArgs.publish.commandArgs.searchQuery;

      const resolveUpdate = resolveRealDataResultIssueGhCommandPlan(
        multiHitStdout(marker, [N, 13]),
        stepArgs.publish.commandArgs,
      );
      const resolveCreate = resolveRealDataResultIssueGhCommandPlan(
        "[]",
        stepArgs.publish.commandArgs,
      );
      if (resolveUpdate.action.action !== "update") {
        throw new Error("update action 기대");
      }
      const outcomeReport = buildRealDataResultOutcomeStepArgs(
        runPlan,
        execStdout(resolveUpdate.action.issueNumber),
      );

      // axis 14(새 표면) — collect-leg 재유도 + collect/evaluate modelId 공유.
      const directCollect = buildRealDataCollectCallArgs(seeds);
      expect(runPlan.pipeline.collectCallArgs).toEqual(directCollect);
      expect(runPlan.pipeline.collectCallArgs).toHaveLength(seeds.length);
      runPlan.pipeline.collectCallArgs.forEach((args, i) => {
        expect(args.since).toBeUndefined();
        expect(args.assessmentId).toBe(ASSESSMENT_ID_PLACEHOLDER);
        expect(JSON.stringify(args.person)).toContain(
          seeds[i].serviceIdentities[0].externalId,
        );
      });
      expect(runPlan.pipeline.modelId).toBe(MODEL_ID);
      stepArgs.evaluation.callArgs.forEach((c) => {
        expect(c.options.modelId).toBe(runPlan.pipeline.modelId);
      });

      // axis 13 — searchArgv 전체-벡터 위치-정합.
      expect(stepArgs.publish.searchArgv).toEqual(
        expectedSearchArgv(searchQuery),
      );
      expect(stepArgs.publish.searchArgv[4]).toBe(marker);
      expect(stepArgs.publish.searchArgv[4]).toBe(searchQuery);
      // axis 12 — update/create 두 분기 argv 위치-정합.
      expect(resolveUpdate.argv).toEqual([
        "issue",
        "edit",
        String(N),
        "--title",
        updateArgs.title,
        "--body",
        updateArgs.body,
      ]);
      expect(resolveCreate.argv).toEqual([
        "issue",
        "create",
        "--title",
        createArgs.title,
        "--body",
        createArgs.body,
        "--label",
        "realdata-e2e",
        "--label",
        "result",
      ]);
      // argv 위치별 title/body == descriptor.{title,body} == 동 command-plan.
      expect(resolveUpdate.argv[4]).toBe(
        stepArgs.publish.report.descriptor.title,
      );
      expect(resolveUpdate.argv[6]).toBe(
        stepArgs.publish.report.descriptor.body,
      );
      expect(resolveCreate.argv[3]).toBe(cmdPlan.report.descriptor.title);
      expect(resolveCreate.argv[5]).toBe(cmdPlan.report.descriptor.body);
      // axis 11 — argv labels == createArgs.labels == 고정 상수.
      expect(createArgs.labels).toEqual(EXPECTED_RESULT_ISSUE_LABELS);
      expect([resolveCreate.argv[7], resolveCreate.argv[9]]).toEqual(
        createArgs.labels,
      );
      // axis 9~10 — command-args title/body 두 경로 일치.
      expect(createArgs.title).toBe(updateArgs.title);
      expect(createArgs.body).toBe(updateArgs.body);
      // axis 6~8 — descriptor.{title,body}·summary command-plan 재유도.
      expect(stepArgs.publish.report.descriptor.title).toBe(
        cmdPlan.report.descriptor.title,
      );
      expect(stepArgs.publish.report.descriptor.body).toBe(
        cmdPlan.report.descriptor.body,
      );
      expect(stepArgs.publish.report.summary).toEqual(cmdPlan.report.summary);
      // axis 4~5 — evaluation.inputs deep-equal + callArgs 페어링.
      const directInputs = buildRealDataEvaluationInputs(activities);
      expect(stepArgs.evaluation.inputs).toEqual(directInputs);
      stepArgs.evaluation.callArgs.forEach((c, i) => {
        expect(c.input).toBe(stepArgs.evaluation.inputs[i]);
      });
      // axis 2~3 — marker 3-축.
      expect(stepArgs.publish.commandArgs.searchQuery).toBe(marker);
      expect(stepArgs.publish.searchArgv[4]).toBe(marker);
      // axis 1 — resolve N == argv[2] == post N + run token 전파.
      expect(resolveUpdate.action.issueNumber).toBe(N);
      expect(resolveUpdate.argv[2]).toBe(String(N));
      expect(outcomeReport.issueNumber).toBe(N);
      expect(marker).toContain(token);
      expect(outcomeReport.gitSha).toBe(runPlan.run.gitSha);
      expect(outcomeReport.dateToken).toBe(runPlan.run.dateToken);
      expect(`${runPlan.run.dateToken}@${runPlan.run.gitSha}`).toBe(token);
    });
  });

  describe("create/update 두 분기 격리 — collect-leg 는 분기 비종속(branch)", () => {
    it("(m) 동일 seeds·modelId·run·activities·results, searchStdout 만 (hit 1+ vs hit 0)으로 달리해 → 한쪽 update·다른 쪽 create 분기. runPlan.pipeline.collectCallArgs 는 두 chain byte-identical(검색 결과가 seed-side collect-leg 를 바꾸지 0) AND stepArgs.publish.searchArgv 도 두 chain byte-identical AND 두 resolvePlan.argv 는 동사·issueNumber·labels 위치만 다르고 title/body 운반 값은 단일-source 불변", () => {
      const seeds = defaultSeeds();
      const runPlan = buildRunPlan(seeds);
      const activities = defaultActivities(seeds);
      const results = defaultResults();
      const stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results);
      const marker = stepArgs.publish.report.descriptor.marker;
      const descriptorTitle = stepArgs.publish.report.descriptor.title;
      const descriptorBody = stepArgs.publish.report.descriptor.body;

      // collect-leg 는 분기 비종속 — 검색 실행 전 step② 단계 합성, 검색 결과 무관.
      const collectBefore = buildRealDataCollectCallArgs(seeds);

      const resolveUpdate = resolveRealDataResultIssueGhCommandPlan(
        multiHitStdout(marker, [7, 13]),
        stepArgs.publish.commandArgs,
      );
      const resolveCreate = resolveRealDataResultIssueGhCommandPlan(
        "[]",
        stepArgs.publish.commandArgs,
      );

      // collect-leg 는 검색 결과(update/create)와 무관하게 byte-identical.
      expect(runPlan.pipeline.collectCallArgs).toEqual(collectBefore);

      // searchArgv 는 분기 비종속(검색 실행 전 합성).
      expect(stepArgs.publish.searchArgv).toEqual(expectedSearchArgv(marker));

      // 분기 동사 차이 — resolve-argv(second-step)만 분기.
      expect(resolveUpdate.argv[1]).toBe("edit");
      expect(resolveCreate.argv[1]).toBe("create");
      // 두 argv 모두 같은 단일-source title/body 운반.
      expect(resolveUpdate.argv[4]).toBe(descriptorTitle);
      expect(resolveCreate.argv[3]).toBe(descriptorTitle);
      expect(resolveUpdate.argv[6]).toBe(descriptorBody);
      expect(resolveCreate.argv[5]).toBe(descriptorBody);
      expect(resolveCreate.argv).toContain("--label");
      expect(resolveUpdate.argv).not.toContain("--label");
      expect(resolveUpdate.argv[2]).toBe("7");
    });
  });

  describe("error path / negative cases — boundary 거부 대칭 박제(R-112 negative 충분 cover)", () => {
    it("(n) modelId 빈('') → buildRealDataE2eRunPlan 위임 pipeline modelId guard throw(collect-leg·run guard 도달 전 차단)", () => {
      const seeds = defaultSeeds();
      expect(() =>
        buildRealDataE2eRunPlan(seeds, "", {
          gitSha: "abc1234",
          dateToken: "2026-06-29",
        }),
      ).toThrow();
    });

    it("(n') modelId 공백-only('   ') → pipeline modelId guard throw(collectCallArgs 합성·runPlan 산출 도달 못 함 — boundary 대칭)", () => {
      const seeds = defaultSeeds();
      expect(() =>
        buildRealDataE2eRunPlan(seeds, "   ", {
          gitSha: "abc1234",
          dateToken: "2026-06-29",
        }),
      ).toThrow();
    });

    it("(o) seed 의 externalId 빈('') → collect-leg 위임 buildRealDataCollectInput throw 전파(collectCallArgs 합성 중 차단 — runPlan 산출 도달 못 함)", () => {
      const badSeeds: RealDataSeedDescriptor[] = [
        {
          person: {
            fullName: "x",
            email: "x@e2e.realdata.test",
            active: true,
          },
          serviceIdentities: [
            { service: "github.com" as const, externalId: "", isPrimary: true },
          ],
        },
      ];
      expect(() =>
        buildRealDataE2eRunPlan(badSeeds, MODEL_ID, {
          gitSha: "abc1234",
          dateToken: "2026-06-29",
        }),
      ).toThrow();
    });

    it("(p) run.gitSha 빈('') → buildRealDataE2eRunPlan run guard assertRunRefNonBlank('gitSha') throw(pipeline collect-leg 합성 후·run 보존 전 차단)", () => {
      const seeds = defaultSeeds();
      expect(() =>
        buildRealDataE2eRunPlan(seeds, MODEL_ID, {
          gitSha: "",
          dateToken: "2026-06-29",
        }),
      ).toThrow();
    });

    it("(p') run.dateToken 빈('') → run guard assertRunRefNonBlank('dateToken') throw 대칭", () => {
      const seeds = defaultSeeds();
      expect(() =>
        buildRealDataE2eRunPlan(seeds, MODEL_ID, {
          gitSha: "abc1234",
          dateToken: "",
        }),
      ).toThrow();
    });

    it("(q) searchStdout 비JSON('not json') → resolve parse 위임 throw(runPlan/stepArgs/collect-leg 정상이어도 resolve argv 합성 도달 전 차단)", () => {
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

    it("(r) searchStdout hit number 비양수([{number:0,...}]) → resolve action assertPositiveNumber throw(비정상 number 가 update issueNumber·argv[2] 로 새는 것 차단)", () => {
      const stepArgs = buildRealDataE2eStepArgs(
        buildRunPlan(),
        defaultActivities(),
        defaultResults(),
      );
      const marker = stepArgs.publish.report.descriptor.marker;
      const zeroHitStdout = JSON.stringify([
        { number: 0, title: "결과 이슈", body: `본문\n${marker}\n끝` },
      ]);
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(
          zeroHitStdout,
          stepArgs.publish.commandArgs,
        ),
      ).toThrow();
    });

    it("(s) execStdout URL 미발견(빈 문자열) → post 파서 위임 throw(runPlan.run 정상이어도 차단)", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(buildRunPlan(), ""),
      ).toThrow();
    });

    it("(s') execStdout /issues/0 → post 파서 assertPositiveIssueNumber throw(post 비식별)", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(
          buildRunPlan(),
          `https://github.com/${OWNER}/${REPO}/issues/0\n`,
        ),
      ).toThrow();
    });

    it("(t) collect-leg 축 negative — modelId 빈/공백 시 pipeline modelId guard 가 collect 위임보다 먼저 throw → collectCallArgs 합성·runPlan 산출 도달 못 함(boundary 대칭). 빈 seeds([]) + 유효 modelId/run → runPlan.pipeline.collectCallArgs === [](빈 배열·throw 0) 경계", () => {
      // 빈 modelId → collect-leg surface 도달 전 상위 차단.
      expect(() =>
        buildRealDataE2eRunPlan([], "", {
          gitSha: "abc1234",
          dateToken: "2026-06-29",
        }),
      ).toThrow();

      // 빈 seeds + 유효 modelId/run → collectCallArgs 빈 배열(throw 0) 경계.
      const emptyPlan = buildRealDataE2eRunPlan([], MODEL_ID, {
        gitSha: "abc1234",
        dateToken: "2026-06-29",
      });
      expect(emptyPlan.pipeline.collectCallArgs).toEqual([]);
      expect(emptyPlan.pipeline.modelId).toBe(MODEL_ID);
    });
  });

  describe("결정론·무공유·no-mutation — chain 두 번 호출 + 입력 불변 + collectCallArgs 오염 0", () => {
    it("(u) 동일 (seeds, modelId, run, activities, results, searchStdout, execStdout) chain 두 번 → runPlan(pipeline.collectCallArgs 포함)/stepArgs/resolvePlan/outcomeReport 모두 deep-equal(결정론)", () => {
      const seeds = defaultSeeds();
      const chain1 = runChain([7, 13], seeds, buildRunPlan(seeds));
      const chain2 = runChain([7, 13], seeds, buildRunPlan(seeds));

      expect(chain1.runPlan.pipeline.collectCallArgs).toEqual(
        chain2.runPlan.pipeline.collectCallArgs,
      );
      expect(chain1.stepArgs.evaluation).toEqual(chain2.stepArgs.evaluation);
      expect(chain1.stepArgs.publish).toEqual(chain2.stepArgs.publish);
      expect(chain1.resolvePlan).toEqual(chain2.resolvePlan);
      expect(chain1.outcomeReport).toEqual(chain2.outcomeReport);
    });

    it("(v) no-mutation — 입력 seeds·activities·results·run chain 호출 후 deep-equal(원본 불변)", () => {
      const seeds = defaultSeeds();
      const activities = defaultActivities(seeds);
      const results = defaultResults();
      const run = { gitSha: "abc1234", dateToken: "2026-06-28" };
      const seedsBefore = JSON.parse(JSON.stringify(seeds));
      const activitiesBefore = JSON.parse(JSON.stringify(activities));
      const resultsBefore = JSON.parse(JSON.stringify(results));
      const runBefore = JSON.parse(JSON.stringify(run));

      const runPlan = buildRealDataE2eRunPlan(seeds, MODEL_ID, run);
      buildRealDataE2eStepArgs(runPlan, activities, results);
      buildRealDataCollectCallArgs(seeds);

      expect(seeds).toEqual(seedsBefore);
      expect(activities).toEqual(activitiesBefore);
      expect(results).toEqual(resultsBefore);
      expect(run).toEqual(runBefore);
    });

    it("(w) collectCallArgs 오염 0 — runPlan.pipeline.collectCallArgs.push(...) 후 새 runPlan 의 collectCallArgs 가 여전히 seeds 길이·오염 0(이전 호출 반환 mutate 누설 0 — 매 호출 새 배열, 무공유)", () => {
      const seeds = defaultSeeds();
      const first = buildRunPlan(seeds);
      const firstLen = first.pipeline.collectCallArgs.length;
      // 반환 collectCallArgs 배열 mutate(오염 시도).
      first.pipeline.collectCallArgs.push({
        person: first.pipeline.collectCallArgs[0].person,
        since: undefined,
        assessmentId: ASSESSMENT_ID_PLACEHOLDER,
      });
      expect(first.pipeline.collectCallArgs.length).toBe(firstLen + 1);

      // 새 runPlan 의 collectCallArgs 는 여전히 seeds 길이(이전 호출 mutate 누설 0).
      const second = buildRunPlan(seeds);
      expect(second.pipeline.collectCallArgs).toHaveLength(seeds.length);
      expect(second.pipeline.collectCallArgs).toEqual(
        buildRealDataCollectCallArgs(seeds),
      );
    });
  });

  describe("credential 누출 0(branch — §9 / R-59 / REQ-059 정합)", () => {
    it("(x) runPlan.pipeline.collectCallArgs(직렬화 — person.serviceIdentities·assessmentId)·runPlan.pipeline.modelId·stepArgs.publish.searchArgv(join)·resolvePlan.argv(join)·commandArgs/{descriptor,summary}/evaluation.{inputs,callArgs}/outcomeReport.{url,summaryLine} 어디에도 token/secret/PAT/--auth 어휘 미등장(특히 collectCallArgs·modelId 명시)", () => {
      const seeds = defaultSeeds();
      const { runPlan, stepArgs, resolvePlan, outcomeReport } = runChain(
        [7, 13],
        seeds,
      );
      const resolveCreate = resolveRealDataResultIssueGhCommandPlan(
        "[]",
        stepArgs.publish.commandArgs,
      );

      const surfaces: string[] = [
        JSON.stringify(runPlan.pipeline.collectCallArgs),
        runPlan.pipeline.modelId,
        stepArgs.publish.searchArgv.join(" "),
        resolvePlan.argv.join(" "),
        resolveCreate.argv.join(" "),
        stepArgs.publish.commandArgs.createArgs.labels.join(" "),
        stepArgs.publish.commandArgs.createArgs.title,
        stepArgs.publish.commandArgs.updateArgs.title,
        stepArgs.publish.commandArgs.createArgs.body,
        stepArgs.publish.commandArgs.updateArgs.body,
        stepArgs.publish.commandArgs.searchQuery,
        stepArgs.publish.report.descriptor.title,
        stepArgs.publish.report.descriptor.marker,
        stepArgs.publish.report.descriptor.body,
        JSON.stringify(stepArgs.publish.report.summary),
        JSON.stringify(stepArgs.evaluation.inputs),
        JSON.stringify(stepArgs.evaluation.callArgs),
        outcomeReport.url,
        outcomeReport.summaryLine,
      ];

      const credentialPattern =
        /(GH_TOKEN|GITHUB_TOKEN|Bearer|Authorization|x-access-token|x-github-token|--token|--auth|ghp_[A-Za-z0-9]|PAT)/i;
      for (const surface of surfaces) {
        expect(surface).not.toMatch(credentialPattern);
      }
      // collectCallArgs 각 원소(실 collectForPerson 호출-args)에 credential 어휘 미등장 명시.
      runPlan.pipeline.collectCallArgs.forEach((args) => {
        expect(JSON.stringify(args)).not.toMatch(credentialPattern);
      });
      // outcome url 은 issue 경로만.
      expect(outcomeReport.url).not.toMatch(/commit|pull request/i);
    });
  });
});
