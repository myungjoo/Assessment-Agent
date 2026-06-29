// realdata-e2e-aggregator-evaluation-leg-input-internal-shape-run-plan-threading-17way-single-source-closure-assembly.smoke-spec.ts
// — 실 평가 e2e step④ aggregator evaluation-leg callArgs[i].input 내부-shape 1:1
// thread 합류 17-way single-source closure:
// 최외곽 진입 `buildRealDataE2eRunPlan(seeds, modelId, run)` → `{pipeline, run}` 를
// pre-실행 aggregator `buildRealDataE2eStepArgs(runPlan, activities, results)` →
// `{evaluation, publish}` 에 통째로 넘긴다. aggregator 가 산출한 evaluation-leg
// `stepArgs.evaluation.inputs[i]`(= `callArgs[i].input`, type `EvaluationInput`)의
// 각 필드(`unitId`·`contributionKind`·`sourceType`·`instanceKey`·`author`·`timestamp`
// ·`metadata`)가, 검증 source `activities[i]`(type `Activity`)로부터 production 단건
// 매퍼 `mapActivityToEvaluationInput(activities[i])` 와 **필드별 byte-identical 1:1**
// (특히 `unitId = ${sourceType}:${instanceKey}:${externalId}` 합성, `contributionKind`
// 의 R-30 routing — github commit/pr→code·issue→document·confluence→document,
// `metadata` reference 승계, raw 본문 key 부재)임을 17번째 축으로 합류시킨다.
//
// evaluation-leg input 내부-shape 축(Activity → EvaluationInput 필드 깊이)은 T-0571
// 6-way / 7-way 가 잡은 evaluation.inputs **top-level deep-equal**(inputs ==
// buildRealDataEvaluationInputs(activities)) + `callArgs[i].input === inputs[i]`
// reference 페어링 + `inputs[0].unitId/contributionKind` sanity 와 distinct surface
// 다 — 본 spec 은 그것을 inputs **각 원소의 필드별(production mapper 재유도)·
// contributionKind 4분기(github commit/pr/issue·confluence)·metadata reference·raw
// key 부재 boundary** 로 확장한다. 본 spec 은 그 1:1 축이 inputs top-level 재유도·
// callArgs.input 페어링·collect-leg·publish-leg·resolve·post 와 같은 검증 source
// (seeds+modelId+run+activities+results)의 산물임을 한 chain 동시-호출로 closure 에
// 합류시킨다:
//   (축 17, 새 표면) stepArgs.evaluation.inputs[i] == mapActivityToEvaluationInput(
//       activities[i]) (필드별 byte-identical — unitId 합성·contributionKind R-30
//       4분기·sourceType/instanceKey/author/timestamp 전사·metadata reference·key set
//       {7필드} set-equal/raw 부재).
//   (축 6) evaluation.inputs == buildRealDataEvaluationInputs(activities) top-level
//       재유도 + 모든 callArgs[i].input === inputs[i] reference + length == activities.length.
//   (축 16) collect-leg serviceIdentities 내부-shape 1:1(collectCallArgs[i].person
//       .serviceIdentities == seeds[i].serviceIdentities {service,externalId} 추림).
//   (축 15) collect-leg call-args top-level 재유도(== buildRealDataCollectCallArgs(seeds)).
//   (축 14~15) set(searchArgv[6] split) == set(PARSE_SHAPE_KEYS) == set(Object.keys(hit))
//       set-equal + parse-shape number → resolve → argv[2] → post thread.
//   (축 13) collect/evaluate modelId 공유.
//   (축 12) searchArgv 전체-벡터 위치-정합.
//   (축 11) resolvePlan.argv 위치-정합(update/create 두 분기).
//   (축 9~10) command-args createArgs.labels 고정상수 + {create,update}Args.{title,body}
//       두 경로 == descriptor.{title,body}.
//   (축 6~8) descriptor.{title,body}·summary command-plan 경유 재유도 byte-identical.
//   (축 2~3) marker 3-축 — descriptor.marker / commandArgs.searchQuery / searchArgv[4] 동일.
//   (축 1, 종단) marker → resolve issueNumber → post run-identity(동일 runPlan.run 전파).
//
// 이 17-way 가 검증 source `(seeds, modelId, run, activities, results)` single-source
// 에서 한 chain 동시-호출로 수렴함이 search-or-update 멱등성(REQ-009)·Issue 를 문서
// 기여로 평가하는 정규화 정합(REQ-030/R-30)·raw 미보유 평가 입력 정합(REQ-032)·author
// 귀속 key 정합(REQ-047)·credential 미보유(REQ-059)의 aggregator-level "aggregator 가
// step③ scoreUnit 로 넘길 평가 입력 1건의 필드(unitId 식별자·contributionKind category·
// author 귀속·timestamp)가 검증 source activity 와 필드별 어긋남 0, raw 본문은 입력으로
// 새지 않음" 의 종단 닫음이다. e2e 의 evaluation-leg 가 검증 source activity 의 Activity
// → EvaluationInput 필드 깊이까지 단일 검증 source 에서 1:1 로 맞물리는 seam slice.
// (T-0786 박제, PLAN.md 109행 🟢 실 평가 e2e step④).
//
// 본 spec 의 존재 이유 — public CI gap 해소(evaluation-leg input 내부-shape 1:1 축 합류):
//   - aggregator-* sweep smoke 중 evaluation-inputs 참조는 6-way(T-0571)/7-way 뿐이고
//     그 안 input 단언은 inputs == buildRealDataEvaluationInputs(activities) top-level
//     deep-equal + callArgs[i].input === inputs[i] reference + typeof inputs[0].unitId/
//     contributionKind·length sanity(첫/일부 원소 sanity)만 — inputs[i] 의 필드별
//     (unitId 합성·contributionKind R-30 4분기·sourceType/instanceKey/author/timestamp
//     전사·metadata reference·raw key 부재) mapActivityToEvaluationInput(activities[i])
//     로부터의 1:1 재유도 단언 0.
//   - evaluation-inputs helper spec / production mapper spec(evaluation-input.mapper.ts)
//     이 unitId 합성·contributionKind routing·raw 미보유를 박제했으나 aggregator
//     (buildRealDataE2eStepArgs) chain 진입·resolve·post 미합류(매퍼/빌더 단독 spec).
//   - 본 spec 은 그 빈 자리를 채워 aggregator 가 산출한 evaluation-leg inputs[i]
//     (= callArgs[i].input)가 검증 source activities[i] 로부터 production
//     mapActivityToEvaluationInput 와 필드별 byte-identical 1:1(github commit/pr/issue·
//     confluence 4분기·metadata reference·raw key 부재)임을 inputs top-level·callArgs.input
//     페어링·collect-leg·publish-leg·resolve·post 와 묶어 closure 에 합류시킨다.
//   - live leg(실 prisma·실 collectForPerson·실 github.com fetch·실 LLM scoreUnit·실 gh
//     CLI 실행·DB·LAN gate)는 복제하지 않고, synthetic seeds/modelId/run + activities/
//     results literal + search-stdout/exec-stdout literal 을 컴포저들에 직접 공급해 live
//     leg 를 우회한다(조립 surface 만 검증). 따라서 본 spec 은:
//
//      🔥 실 scoreUnit/LLM 호출 0 — inputs[i] 는 step③ scoreUnit 입력 shape build-time
//         정합만 검증(실 scoring 0). 실 gh / fetch / collectForPerson / DB 0.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 helper export + production type/매퍼 import 재사용만.
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0786):
//   - src 변경 0(src/, prisma/, package.json, CI workflow, 환경 변수 추가 등 모두 금지).
//     test-only. production mapActivityToEvaluationInput·EvaluationInput·Activity 는
//     비교 source 로 import 만(변경 0).
//   - 실 collectForPerson / 실 prisma write / 실 gh search·exec / 실 LLM scoreUnit 호출.
//     in-memory 합성 activities / search-stdout / exec-stdout 만.
//   - aggregator 16-way(collect-leg serviceIdentities 내부-shape + collectCallArgs
//     top-level 재유도 + 14축) 자체 재단언(T-0785 cover). 본 task 는 evaluation-leg
//     inputs[i] ↔ activities[i] 필드별 1:1(production mapper 재유도, 4분기·metadata
//     reference·raw key 부재)을 17번째 축으로 합류시킨 부분만(16축은 17-way 묶음 표현용).
//   - inputs top-level 재유도(inputs == buildRealDataEvaluationInputs(activities)) +
//     callArgs[i].input===inputs[i] 페어링 자체를 새 표면으로 재단언(T-0571 6-way cover).
//     본 task 는 그것을 17-way 묶음 항으로만 재확인하고 새 표면은 inputs[i] 의 필드 깊이.
//   - production mapActivityToEvaluationInput 의 unitId 합성·contributionKind routing
//     로직 자체 재구현·내부 분기 재단언(evaluation-input.mapper spec cover). aggregator
//     산출 inputs[i] 가 production 매퍼 산출과 byte-identical 임만 비교(매퍼 직접 호출).
//   - buildRealDataEvaluationInputs self-guard / Activity 도메인 shape 정책 / EvaluationScoring
//     Service.scoreUnit 실 호출 / R-30 정책 정당성 / R-97 난이도 modelId routing 검증 0.
//   - DB 의존 0 / live-LLM·실 fetch·실 gh CLI·실 collectForPerson 0.
//   - 새 helper 모듈 신설 / 기존 helper 수정 — test-only(신규 smoke spec 1 파일).
import type { Activity } from "../../src/assessment-collection/domain/activity";
import type {
  ConfluenceActivity,
  GithubActivity,
} from "../../src/assessment-collection/domain/activity";
import type { EvaluationInput } from "../../src/assessment-evaluation/domain/evaluation-input";
import { mapActivityToEvaluationInput } from "../../src/assessment-evaluation/domain/evaluation-input.mapper";
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";
import { buildRealDataEvaluationInputs } from "../helpers/realdata-e2e-evaluation-inputs";
import { buildRealDataResultIssueCommandPlan } from "../helpers/realdata-e2e-result-issue-command-plan";
import { resolveRealDataResultIssueGhCommandPlan } from "../helpers/realdata-e2e-result-issue-gh-command-plan";
import { REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS } from "../helpers/realdata-e2e-result-issue-search-argv";
import { REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS } from "../helpers/realdata-e2e-result-issue-search-json-fields";
import { parseRealDataResultIssueSearchOutput } from "../helpers/realdata-e2e-result-issue-search-parse";
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
  "cfg-realdata-e2e-aggregator-evaluation-leg-input-internal-shape-run-plan-threading-smoke";

// EvaluationInput 의 정규 키 집합(7필드) — 본 task 의 새 표면(축 17) 의 raw key 부재
// boundary expected. evaluation-input.ts(56행) interface EvaluationInput 시그니처로 확인.
const EVALUATION_INPUT_KEYS = [
  "unitId",
  "contributionKind",
  "sourceType",
  "instanceKey",
  "author",
  "timestamp",
  "metadata",
];

// 고정 결정론 분류 라벨 — command-args.ts RESULT_ISSUE_LABELS = ["realdata-e2e","result"].
const EXPECTED_RESULT_ISSUE_LABELS = ["realdata-e2e", "result"];

// search-argv helper 가 산출하는 canonical 9-원소 전체-벡터(marker 위치만 입력 종속). 17-way
// 묶음 표현용 동시-성립 항(축 12). marker(index 4)는 chain 시점에 commandArgs.searchQuery 로 채움.
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

// spec 로컬 set-equal 비교 — 양방향 포함으로 비교(크기 동일 AND 한쪽 원소가 모두 다른 쪽에
// 존재 — 순서·중복 무관 set-equality).
function setOf(tokens: Iterable<string>): Set<string> {
  return new Set<string>(tokens);
}

function isSetEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) {
    return false;
  }
  for (const token of a) {
    if (!b.has(token)) {
      return false;
    }
  }
  return true;
}

// aggregator 산출 searchArgv[6](`--json` 요청-필드 토큰)을 spec 로컬에서 콤마 split·trim 한 집합.
function splitJsonFieldsToken(token: string): Set<string> {
  return setOf(token.split(",").map((field) => field.trim()));
}

// 본 task 의 핵심 새 표면(축 17) expected — unitId 합성 규칙(activity.ts·mapper.ts 박제,
// `<sourceType>:<instanceKey>:<externalId>`)을 test 측에서 재유도. inputs[i].unitId 와
// byte-identical 의 expected(production 매퍼 산출과의 정합 cross-check 용).
function expectedUnitId(activity: Activity): string {
  return `${activity.sourceType}:${activity.instanceKey}:${activity.externalId}`;
}

// 합성 run-token — descriptor 컴포저 내부 runToken(run) = `${dateToken}@${gitSha}` 규칙으로
// test 측에서 재유도한 expected 공유 substring.
function expectedToken(run: RealDataE2eRunPlan["run"]): string {
  return `${run.dateToken}@${run.gitSha}`;
}

// 기본 seeds — fixed 2-Person(myungjoo/leemgs) descriptor 배열. evaluation-leg 표면이
// 주축이라 collect-leg 는 묶음 항으로만 등장(seed-fixture 그대로 사용).
function defaultSeeds(): RealDataSeedDescriptor[] {
  return [...buildRealDataE2eSeed()];
}

// synthetic runPlan 합성 — buildRealDataE2eRunPlan(seeds, modelId, run) 호출로 검증된 단일
// `{pipeline, run}` 을 만든다(modelId·run guard 통과 비공백 토큰). 매 호출 새 객체 트리.
function buildRunPlan(
  seeds: RealDataSeedDescriptor[] = defaultSeeds(),
  modelId = MODEL_ID,
  gitSha = "abc1234",
  dateToken = "2026-06-29",
): RealDataE2eRunPlan {
  return buildRealDataE2eRunPlan(seeds, modelId, { gitSha, dateToken });
}

// synthetic GithubActivity 1 건 — aggregator 의 evaluation leg 입력. kind 별 contributionKind
// routing 분기(commit/pr→code·issue→document R-30) cover 위해 kind 파라미터화. metadata 는
// 매 호출 새 객체(reference 승계 검증의 source — inputs[i].metadata===activities[i].metadata).
function githubActivity(
  kind: GithubActivity["kind"],
  externalId: string,
  author: string,
  instanceKey = "github.com",
): GithubActivity {
  return {
    sourceType: "github",
    externalId,
    instanceKey,
    author,
    timestamp: `2026-06-0${kind === "commit" ? 1 : kind === "pr" ? 2 : 3}T12:00:00Z`,
    metadata: { titleLength: kind === "commit" ? 42 : kind === "pr" ? 7 : 19 },
    repoRef: `${author}/sample-repo`,
    kind,
  };
}

// synthetic ConfluenceActivity 1 건 — confluence→document routing 분기 cover.
function confluenceActivity(
  externalId: string,
  author: string,
  instanceKey = "wiki.internal",
): ConfluenceActivity {
  return {
    sourceType: "confluence",
    externalId,
    instanceKey,
    author,
    timestamp: "2026-06-04T12:00:00Z",
    metadata: { titleLength: 31, pageLabel: "design" },
    spaceRef: "ENG",
    version: 3,
  };
}

// 유효 activities fixture — aggregator 의 evaluation leg 입력(Activity[]). github
// commit·pr·issue·confluence page 4종 모두 1+ 원소 포함(contributionKind routing 4분기
// cover). 다양한 instanceKey/author/timestamp/metadata 로 필드별 1:1 재유도 변별.
function defaultActivities(): Activity[] {
  return [
    githubActivity("commit", "eval-input-c1", "myungjoo"),
    githubActivity("pr", "eval-input-p1", "leemgs"),
    githubActivity("issue", "eval-input-i1", "myungjoo", "github.sec"),
    confluenceActivity("eval-input-page1", "leemgs"),
  ];
}

// synthetic EvaluationResult 1 건 — aggregator 의 publish leg 입력(summary 집계 + body 렌더).
function syntheticResult(
  unitId: string,
  difficulty: EvaluationResult["difficulty"],
  contribution: EvaluationResult["contribution"],
  volume: number,
): EvaluationResult {
  return {
    unitId,
    narrative:
      "synthetic evaluation narrative — aggregator evaluation-leg input 내부-shape(inputs[i] == mapActivityToEvaluationInput(activities[i]) 필드별 1:1 — unitId 합성·contributionKind R-30 4분기·sourceType/instanceKey/author/timestamp 전사·metadata reference·raw key 부재)+inputs top-level 재유도+callArgs.input 페어링+collect-leg serviceIdentities+collectCallArgs top-level+modelId 공유+search-json-fields↔parse-shape set-equal+number→resolve→post+search-argv+resolve-argv+command-args-{title,body,labels}+descriptor+summary+marker run-plan-threading 17-way closure smoke fixture",
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

// marker(=searchQuery, = searchArgv[4])를 body 에 포함한 hit 1+건 search stdout 합성 헬퍼.
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

// 최외곽 진입 buildRealDataE2eRunPlan → aggregator buildRealDataE2eStepArgs →
// searchStdout → parseRealDataResultIssueSearchOutput → resolve → post 를 single-source
// (동일 seeds + modelId + run + activities + results + N)로 묶어 한 chain 으로 호출하는
// 헬퍼. 핵심 새 표면(축 17) = stepArgs.evaluation.inputs[i] ↔ activities[i] 필드별 1:1.
function runChain(
  hitsNumbers: number[],
  seeds: RealDataSeedDescriptor[] = defaultSeeds(),
  runPlan: RealDataE2eRunPlan = buildRunPlan(seeds),
  activities: Activity[] = defaultActivities(),
  results: EvaluationResult[] = defaultResults(),
  noisePrefix = "",
): {
  resolvedN: number;
  seeds: RealDataSeedDescriptor[];
  runPlan: RealDataE2eRunPlan;
  activities: Activity[];
  results: EvaluationResult[];
  stepArgs: ReturnType<typeof buildRealDataE2eStepArgs>;
  searchStdout: string;
  parsedHits: ReturnType<typeof parseRealDataResultIssueSearchOutput>;
  resolvePlan: ReturnType<typeof resolveRealDataResultIssueGhCommandPlan>;
  outcomeReport: ReturnType<typeof buildRealDataResultOutcomeStepArgs>;
} {
  // stage 1(pre boundary, aggregator dual-leg threaded) — stepArgs: {evaluation, publish}.
  const stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results);

  // stage 2(search-parse) — searchStdout(marker hit 1+) → parsedHits({number,title,body}만).
  const searchStdout = multiHitStdout(
    stepArgs.publish.commandArgs.searchQuery,
    hitsNumbers,
  );
  const parsedHits = parseRealDataResultIssueSearchOutput(searchStdout);

  // stage 3(resolve) — searchStdout + stepArgs.publish.commandArgs → {action(update), argv}.
  const resolvePlan = resolveRealDataResultIssueGhCommandPlan(
    searchStdout,
    stepArgs.publish.commandArgs,
  );
  if (resolvePlan.action.action !== "update") {
    throw new Error("update action 기대 — 후보 1+건 입력");
  }
  const resolvedN = resolvePlan.action.issueNumber;

  // stage 4(post boundary, run-plan-threaded) — 동일 runPlan 한 객체를 post 컴포저에 직접 공급.
  const outcomeReport = buildRealDataResultOutcomeStepArgs(
    runPlan,
    execStdout(resolvedN, noisePrefix),
  );

  return {
    resolvedN,
    seeds,
    runPlan,
    activities,
    results,
    stepArgs,
    searchStdout,
    parsedHits,
    resolvePlan,
    outcomeReport,
  };
}

describe("Smoke(non-gated): 실 평가 e2e step④ aggregator evaluation-leg callArgs[i].input 내부-shape 1:1 thread 합류 17-way single-source closure buildRealDataE2eRunPlan → buildRealDataE2eStepArgs → stepArgs.evaluation.inputs[i] == mapActivityToEvaluationInput(activities[i])(필드별 byte-identical 1:1 — unitId 합성·contributionKind R-30 4분기(github commit/pr→code·issue→document·confluence→document)·sourceType/instanceKey/author/timestamp 전사·metadata reference·key set {7필드} set-equal/raw 부재) + inputs top-level 재유도(==buildRealDataEvaluationInputs(activities)) + callArgs.input 페어링 + collect-leg serviceIdentities 내부-shape + collectCallArgs top-level 재유도 + collect/evaluate modelId 공유 + search-json-fields↔parse-shape set-equal + number→resolve→post + search-argv 전체-벡터 + resolve-argv(update/create) + command-args labels + {title,body} 두 경로(=descriptor.{title,body}) + descriptor·summary 재유도 + marker 3-축 + resolve issueNumber + post run-identity ↔ 동일 (seeds, modelId, run, activities, results) 한 chain 동시-호출 17축 동시 수렴 live-collect/live-gh/live-LLM 0 검증", () => {
  describe("happy path — aggregator 17-way chain 합성(evaluation.inputs 비어있지 않음·길이==activities.length·callArgs 동일 길이 + 산출물 정상)", () => {
    it("(a) 유효 seeds + modelId + run + activities(github commit/pr/issue·confluence 4종 포함) + results + searchStdout + execStdout → stepArgs.evaluation.inputs(비어있지 않은 배열·길이==activities.length) / callArgs(동일 길이) / parsedHits(비어있지 않음) / resolvePlan(update) / outcomeReport(5필드) 모두 정상", () => {
      const activities = defaultActivities();
      const { stepArgs, parsedHits, resolvePlan, outcomeReport } = runChain(
        [7, 13],
        defaultSeeds(),
        buildRunPlan(),
        activities,
      );

      // stage 1 — evaluation-leg inputs/callArgs 정상.
      expect(Array.isArray(stepArgs.evaluation.inputs)).toBe(true);
      expect(stepArgs.evaluation.inputs.length).toBeGreaterThan(0);
      expect(stepArgs.evaluation.inputs).toHaveLength(activities.length);
      expect(stepArgs.evaluation.callArgs).toHaveLength(activities.length);

      // activities 4종(commit/pr/issue/confluence) 모두 포함 확인(routing 4분기 source).
      const kinds = activities
        .filter((a): a is GithubActivity => a.sourceType === "github")
        .map((a) => a.kind);
      expect(kinds).toEqual(expect.arrayContaining(["commit", "pr", "issue"]));
      expect(activities.some((a) => a.sourceType === "confluence")).toBe(true);

      // stage 1 — publish 정상(searchArgv 길이 9).
      expect(stepArgs.publish.searchArgv).toHaveLength(9);
      // stage 2~4 — 정상.
      expect(parsedHits.length).toBeGreaterThan(0);
      expect(resolvePlan.action.action).toBe("update");
      expect(outcomeReport.issueNumber).toBeGreaterThan(0);
      expect(outcomeReport.url.length).toBeGreaterThan(0);
      expect(outcomeReport.gitSha).toBe("abc1234");
      expect(outcomeReport.dateToken).toBe("2026-06-29");
      expect(outcomeReport.summaryLine.length).toBeGreaterThan(0);
    });
  });

  describe("evaluation-leg input 필드별 1:1 재유도 수렴(branch — 핵심 불변식 1, 본 task 의 새 표면 — 축 17)", () => {
    it("(b) 모든 i 에 대해 stepArgs.evaluation.inputs[i] deep-equal(toEqual) mapActivityToEvaluationInput(activities[i])(production 매퍼 직접 호출), 필드별 unitId/contributionKind/sourceType/instanceKey/author/timestamp 각 toBe(forEach), unitId === ${sourceType}:${instanceKey}:${externalId}", () => {
      const activities = defaultActivities();
      const { stepArgs } = runChain(
        [7, 13],
        defaultSeeds(),
        buildRunPlan(),
        activities,
      );

      stepArgs.evaluation.inputs.forEach((input, i) => {
        const mapped = mapActivityToEvaluationInput(activities[i]);
        // 핵심 — 필드별 byte-identical 1:1(production 매퍼 산출과 deep-equal).
        expect(input).toEqual(mapped);
        // 필드별 toBe.
        expect(input.unitId).toBe(mapped.unitId);
        expect(input.contributionKind).toBe(mapped.contributionKind);
        expect(input.sourceType).toBe(mapped.sourceType);
        expect(input.instanceKey).toBe(mapped.instanceKey);
        expect(input.author).toBe(mapped.author);
        expect(input.timestamp).toBe(mapped.timestamp);
        // unitId 합성 규칙 재유도(production 매퍼 산출 == test 측 재유도).
        expect(input.unitId).toBe(expectedUnitId(activities[i]));
        // sourceType/instanceKey/author/timestamp 는 activity 에서 직접 전사.
        expect(input.sourceType).toBe(activities[i].sourceType);
        expect(input.instanceKey).toBe(activities[i].instanceKey);
        expect(input.author).toBe(activities[i].author);
        expect(input.timestamp).toBe(activities[i].timestamp);
      });
    });
  });

  describe("contributionKind R-30 routing 모든 분기 수렴(branch — 핵심 불변식 2, REQ-030/R-30)", () => {
    it("(c) github commit → contributionKind 'code', github pr → 'code', github issue → 'document'(R-30), confluence → 'document' — 4분기 각 1+ activity 의 inputs[i].contributionKind 단언(출처 github 인데 issue 는 document 임을 명시 변별)", () => {
      const activities = defaultActivities();
      const { stepArgs } = runChain(
        [7, 13],
        defaultSeeds(),
        buildRunPlan(),
        activities,
      );
      const inputs = stepArgs.evaluation.inputs;

      // 각 분기 index 탐색(activities 의 kind/sourceType 기준).
      const commitIdx = activities.findIndex(
        (a) => a.sourceType === "github" && a.kind === "commit",
      );
      const prIdx = activities.findIndex(
        (a) => a.sourceType === "github" && a.kind === "pr",
      );
      const issueIdx = activities.findIndex(
        (a) => a.sourceType === "github" && a.kind === "issue",
      );
      const confluenceIdx = activities.findIndex(
        (a) => a.sourceType === "confluence",
      );
      expect(commitIdx).toBeGreaterThanOrEqual(0);
      expect(prIdx).toBeGreaterThanOrEqual(0);
      expect(issueIdx).toBeGreaterThanOrEqual(0);
      expect(confluenceIdx).toBeGreaterThanOrEqual(0);

      // github commit/pr → code.
      expect(inputs[commitIdx].contributionKind).toBe("code");
      expect(inputs[prIdx].contributionKind).toBe("code");
      // github issue → document(R-30 — Issue 를 문서 기여로). 출처는 여전히 github.
      expect(inputs[issueIdx].contributionKind).toBe("document");
      expect(inputs[issueIdx].sourceType).toBe("github");
      // confluence → document.
      expect(inputs[confluenceIdx].contributionKind).toBe("document");
      expect(inputs[confluenceIdx].sourceType).toBe("confluence");
    });
  });

  describe("metadata reference 승계 수렴(branch — 매퍼 계약)", () => {
    it("(d) 모든 i 에 대해 stepArgs.evaluation.inputs[i].metadata === activities[i].metadata(동일 reference, toBe — deep clone 0). 매퍼가 metadata 를 그대로 전달함의 boundary(REQ-032 scalar-only 승계)", () => {
      const activities = defaultActivities();
      const { stepArgs } = runChain(
        [7, 13],
        defaultSeeds(),
        buildRunPlan(),
        activities,
      );

      stepArgs.evaluation.inputs.forEach((input, i) => {
        // reference identity(deep-equal 아님 — 동일 객체).
        expect(input.metadata).toBe(activities[i].metadata);
      });
    });
  });

  describe("raw-not-stored boundary — key set 정합 수렴(branch — REQ-032 경계)", () => {
    it("(e) 모든 i 에 대해 Object.keys(inputs[i]) set 이 {unitId,contributionKind,sourceType,instanceKey,author,timestamp,metadata} 와 set-equal — kind(discriminator)·externalId·repoRef·spaceRef·version 같은 비-EvaluationInput key 미surface, raw 본문 key(message/diff/bodyHtml 등) 부재", () => {
      const activities = defaultActivities();
      const { stepArgs } = runChain(
        [7, 13],
        defaultSeeds(),
        buildRunPlan(),
        activities,
      );
      const expectedKeySet = setOf(EVALUATION_INPUT_KEYS);

      stepArgs.evaluation.inputs.forEach((input) => {
        const keySet = setOf(Object.keys(input));
        // EvaluationInput 7필드 정확히 set-equal.
        expect(isSetEqual(keySet, expectedKeySet)).toBe(true);
        // 비-EvaluationInput key 미surface(Activity raw/discriminator 필드).
        expect(keySet.has("kind")).toBe(false);
        expect(keySet.has("externalId")).toBe(false);
        expect(keySet.has("repoRef")).toBe(false);
        expect(keySet.has("spaceRef")).toBe(false);
        expect(keySet.has("version")).toBe(false);
        // raw 본문 key 부재.
        expect(keySet.has("message")).toBe(false);
        expect(keySet.has("diff")).toBe(false);
        expect(keySet.has("body")).toBe(false);
        expect(keySet.has("bodyHtml")).toBe(false);
      });
    });
  });

  describe("input 내부-shape 축 변별성 — activities 종속·modelId/검색결과 비종속(branch)", () => {
    it("(f) 세 chain — (a)다른 activities·(b)다른 modelId·(c)다른 searchStdout → inputs[i] 필드가 (a)에서만 달라지고(activities 1:1 반영), (b)·(c)에서는 두 chain byte-identical(input 필드는 modelId·검색결과 비종속). 단 callArgs[i].options.modelId 는 (b)에서 달라짐(input vs options 분리 변별)", () => {
      const seeds = defaultSeeds();

      // (a) 다른 activities — kind/author/instanceKey 다름.
      const baseActivities = defaultActivities();
      const altActivities: Activity[] = [
        githubActivity("issue", "alt-i1", "alice", "github.ecode"),
        confluenceActivity("alt-page1", "bob", "wiki.other"),
      ];
      const stepBase = buildRealDataE2eStepArgs(
        buildRunPlan(seeds),
        baseActivities,
        defaultResults(),
      );
      const stepAlt = buildRealDataE2eStepArgs(
        buildRunPlan(seeds),
        altActivities,
        defaultResults(),
      );
      expect(stepAlt.evaluation.inputs).not.toEqual(stepBase.evaluation.inputs);

      // (b) 다른 modelId, 같은 activities — inputs byte-identical(modelId 비종속).
      const stepModelA = buildRealDataE2eStepArgs(
        buildRunPlan(seeds, "model-alpha"),
        baseActivities,
        defaultResults(),
      );
      const stepModelB = buildRealDataE2eStepArgs(
        buildRunPlan(seeds, "model-beta"),
        baseActivities,
        defaultResults(),
      );
      expect(stepModelA.evaluation.inputs).toEqual(
        stepModelB.evaluation.inputs,
      );
      // 단 callArgs[i].options.modelId 는 달라짐(input 과 options 의 분리 변별).
      stepModelA.evaluation.callArgs.forEach((c, i) => {
        expect(c.options.modelId).not.toBe(
          stepModelB.evaluation.callArgs[i].options.modelId,
        );
      });

      // (c) 다른 searchStdout, 같은 activities — inputs byte-identical(검색결과 비종속).
      const chainC1 = runChain([7], seeds, buildRunPlan(seeds), baseActivities);
      const chainC2 = runChain(
        [3, 9, 15],
        seeds,
        buildRunPlan(seeds),
        baseActivities,
      );
      expect(chainC1.stepArgs.evaluation.inputs).toEqual(
        chainC2.stepArgs.evaluation.inputs,
      );
    });
  });

  describe("evaluation-leg inputs top-level 재유도 + callArgs.input 페어링 수렴(branch — 6-way 묶음 항 — 축 6)", () => {
    it("(g) evaluation.inputs deep-equal(toEqual) buildRealDataEvaluationInputs(activities), 모든 callArgs[i].input === inputs[i](reference, toBe, forEach)·inputs.length === activities.length", () => {
      const activities = defaultActivities();
      const { stepArgs } = runChain(
        [7, 13],
        defaultSeeds(),
        buildRunPlan(),
        activities,
      );

      expect(stepArgs.evaluation.inputs).toEqual(
        buildRealDataEvaluationInputs(activities),
      );
      expect(stepArgs.evaluation.inputs).toHaveLength(activities.length);
      stepArgs.evaluation.callArgs.forEach((c, i) => {
        expect(c.input).toBe(stepArgs.evaluation.inputs[i]);
      });
    });
  });

  describe("collect-leg serviceIdentities 내부-shape + collectCallArgs top-level 재유도 수렴(branch — 16-way 묶음 항 — 축 15~16)", () => {
    it("(h) runPlan.pipeline.collectCallArgs deep-equal(toEqual) buildRealDataCollectCallArgs(seeds), 원소별 since===undefined·assessmentId===ASSESSMENT_ID_PLACEHOLDER, collectCallArgs[i].person.serviceIdentities 가 seeds[i].serviceIdentities 의 {service,externalId} 추림과 1:1", () => {
      const seeds = defaultSeeds();
      const runPlan = buildRunPlan(seeds);
      const collectCallArgs = runPlan.pipeline.collectCallArgs;

      expect(collectCallArgs).toEqual(buildRealDataCollectCallArgs(seeds));
      expect(collectCallArgs).toHaveLength(seeds.length);
      collectCallArgs.forEach((args, i) => {
        expect(args.since).toBeUndefined();
        expect(args.assessmentId).toBe(ASSESSMENT_ID_PLACEHOLDER);
        expect(args.person.serviceIdentities).toEqual(
          seeds[i].serviceIdentities.map((si) => ({
            service: si.service,
            externalId: si.externalId,
          })),
        );
      });
    });
  });

  describe("search-json-fields↔parse-shape set-equal + number→resolve→post thread 수렴(branch — 묶음 항 — 축 14~15)", () => {
    it("(i) set(searchArgv[6] split) == set(PARSE_SHAPE_KEYS) == set(Object.keys(parsedHits[0])) set-equal AND parsedHits[0].number(==N) === resolvePlan.action.update.issueNumber === Number(resolvePlan.argv[2]) === outcomeReport.issueNumber", () => {
      const N = 7;
      const { stepArgs, parsedHits, resolvePlan, outcomeReport } = runChain([
        N,
        13,
      ]);
      if (resolvePlan.action.action !== "update") {
        throw new Error("update action 기대");
      }
      const splitSet = splitJsonFieldsToken(stepArgs.publish.searchArgv[6]);
      const parseShapeSet = setOf(
        REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS,
      );
      const hitKeySet = setOf(Object.keys(parsedHits[0]));

      expect(isSetEqual(splitSet, parseShapeSet)).toBe(true);
      expect(isSetEqual(parseShapeSet, hitKeySet)).toBe(true);
      expect(isSetEqual(splitSet, hitKeySet)).toBe(true);

      expect(parsedHits[0].number).toBe(N);
      expect(resolvePlan.action.issueNumber).toBe(N);
      expect(resolvePlan.argv[2]).toBe(String(N));
      expect(outcomeReport.issueNumber).toBe(N);
    });
  });

  describe("collect/evaluate modelId 공유 수렴(branch — 묶음 항 — 축 13)", () => {
    it("(j) runPlan.pipeline.modelId === modelId(toBe) AND 모든 stepArgs.evaluation.callArgs[i].options.modelId === runPlan.pipeline.modelId(toBe, forEach)", () => {
      const seeds = defaultSeeds();
      const runPlan = buildRunPlan(seeds);
      const { stepArgs } = runChain([7, 13], seeds, runPlan);

      expect(runPlan.pipeline.modelId).toBe(MODEL_ID);
      expect(stepArgs.evaluation.callArgs.length).toBeGreaterThan(0);
      stepArgs.evaluation.callArgs.forEach((c) => {
        expect(c.options.modelId).toBe(runPlan.pipeline.modelId);
        expect(c.options.modelId).toBe(MODEL_ID);
      });
    });
  });

  describe("search-argv 전체-벡터 + resolve-argv update/create 위치-정합 수렴(branch — 묶음 항 — 축 11~12)", () => {
    it('(k) searchArgv deep-equal canonical 9-벡터, search hit N → resolvePlan.argv == ["issue","edit",String(N),"--title",updateArgs.title,"--body",updateArgs.body], hit 0 → ["issue","create","--title",createArgs.title,"--body",createArgs.body,"--label","realdata-e2e","--label","result"]', () => {
      const N = 7;
      const { stepArgs, resolvePlan } = runChain([N, 13]);
      const searchQuery = stepArgs.publish.commandArgs.searchQuery;
      const updateArgs = stepArgs.publish.commandArgs.updateArgs;
      const createArgs = stepArgs.publish.commandArgs.createArgs;

      expect(stepArgs.publish.searchArgv).toEqual(
        expectedSearchArgv(searchQuery),
      );
      expect(stepArgs.publish.searchArgv[4]).toBe(searchQuery);
      expect(stepArgs.publish.searchArgv[6]).toBe(
        REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS,
      );

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

  describe("publish-leg command-args-labels + title/body 두 경로 + descriptor·summary 재유도 수렴(branch — 묶음 항 — 축 6~10)", () => {
    it("(l) createArgs.labels deep-equal ['realdata-e2e','result'], createArgs/updateArgs.{title,body} 둘 다 === descriptor.{title,body}, descriptor.{title,body}·report.summary === buildRealDataResultIssueCommandPlan(results, runPlan.run).report.{descriptor.{title,body},summary} byte-identical", () => {
      const seeds = defaultSeeds();
      const runPlan = buildRunPlan(seeds);
      const results = defaultResults();
      const { stepArgs } = runChain(
        [7, 13],
        seeds,
        runPlan,
        defaultActivities(),
        results,
      );
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

  describe("marker 3-축 + resolve issueNumber + post run-identity 수렴(branch — 묶음 항 — 축 1~3)", () => {
    it("(m) descriptor.marker === commandArgs.searchQuery === searchArgv[4](세 지점 byte-identical) AND hit N → resolve issueNumber → outcomeReport.issueNumber 동일 N AND descriptor.marker 에 `${dateToken}@${gitSha}` 포함 AND outcomeReport.{gitSha,dateToken} === runPlan.run", () => {
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
      const marker = stepArgs.publish.report.descriptor.marker;

      expect(stepArgs.publish.commandArgs.searchQuery).toBe(marker);
      expect(stepArgs.publish.searchArgv[4]).toBe(marker);
      expect(resolvePlan.action.issueNumber).toBe(N);
      expect(outcomeReport.issueNumber).toBe(N);
      expect(marker).toContain(expectedToken(runPlan.run));
      expect(outcomeReport.gitSha).toBe(runPlan.run.gitSha);
      expect(outcomeReport.dateToken).toBe(runPlan.run.dateToken);
    });
  });

  describe("17-way 단일-source 묶음 단언(branch — closure 종단, 본 task 의 종단 박제)", () => {
    it("(n) inputs[i] == mapActivityToEvaluationInput(activities[i])(필드별 1:1 — unitId 합성·contributionKind R-30 4분기·전사·metadata reference·key set {7필드} set-equal/raw 부재), inputs == buildRealDataEvaluationInputs(activities), callArgs[i].input===inputs[i], collectCallArgs[i].person.serviceIdentities 1:1, collectCallArgs == buildRealDataCollectCallArgs(seeds), set(searchArgv[6])==set(PARSE_SHAPE_KEYS)==set(keys(parsedHits[0])) 그 number==N==resolve==argv[2]==post, modelId==modelId==callArgs[].options.modelId, searchArgv canonical, update argv==['issue','edit',String(N),...updateArgs], argv title/body==descriptor==command-plan, labels==['realdata-e2e','result'], summary==command-plan, marker run token==post {gitSha,dateToken} 가 검증 source single-source 에서 17-way 동시 성립", () => {
      const N = 7;
      const seeds = defaultSeeds();
      const runPlan = buildRunPlan(seeds);
      const activities = defaultActivities();
      const results = defaultResults();
      const stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results);
      const marker = stepArgs.publish.report.descriptor.marker;
      const token = expectedToken(runPlan.run);
      const cmdPlan = buildRealDataResultIssueCommandPlan(results, runPlan.run);
      const createArgs = stepArgs.publish.commandArgs.createArgs;
      const updateArgs = stepArgs.publish.commandArgs.updateArgs;
      const searchQuery = stepArgs.publish.commandArgs.searchQuery;

      const searchStdout = multiHitStdout(marker, [N, 13]);
      const parsedHits = parseRealDataResultIssueSearchOutput(searchStdout);
      const resolveUpdate = resolveRealDataResultIssueGhCommandPlan(
        searchStdout,
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
      const inputKeySet = setOf(EVALUATION_INPUT_KEYS);

      // axis 17(새 표면) — evaluation-leg input 내부-shape 필드별 1:1 + raw key 부재.
      stepArgs.evaluation.inputs.forEach((input, i) => {
        const mapped = mapActivityToEvaluationInput(activities[i]);
        expect(input).toEqual(mapped);
        expect(input.unitId).toBe(expectedUnitId(activities[i]));
        expect(input.contributionKind).toBe(mapped.contributionKind);
        expect(input.sourceType).toBe(activities[i].sourceType);
        expect(input.instanceKey).toBe(activities[i].instanceKey);
        expect(input.author).toBe(activities[i].author);
        expect(input.timestamp).toBe(activities[i].timestamp);
        expect(input.metadata).toBe(activities[i].metadata);
        expect(isSetEqual(setOf(Object.keys(input)), inputKeySet)).toBe(true);
      });

      // axis 6 — inputs top-level 재유도 + callArgs 페어링.
      expect(stepArgs.evaluation.inputs).toEqual(
        buildRealDataEvaluationInputs(activities),
      );
      stepArgs.evaluation.callArgs.forEach((c, i) => {
        expect(c.input).toBe(stepArgs.evaluation.inputs[i]);
      });

      // axis 15~16 — collect-leg top-level 재유도 + serviceIdentities 1:1.
      expect(runPlan.pipeline.collectCallArgs).toEqual(
        buildRealDataCollectCallArgs(seeds),
      );
      runPlan.pipeline.collectCallArgs.forEach((args, i) => {
        expect(args.person.serviceIdentities).toEqual(
          seeds[i].serviceIdentities.map((si) => ({
            service: si.service,
            externalId: si.externalId,
          })),
        );
      });

      // axis 14~15 — set-equal 3-way + number thread.
      const splitSet = splitJsonFieldsToken(stepArgs.publish.searchArgv[6]);
      const parseShapeSet = setOf(
        REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS,
      );
      const hitKeySet = setOf(Object.keys(parsedHits[0]));
      expect(isSetEqual(splitSet, parseShapeSet)).toBe(true);
      expect(isSetEqual(parseShapeSet, hitKeySet)).toBe(true);
      expect(parsedHits[0].number).toBe(N);
      expect(resolveUpdate.action.issueNumber).toBe(N);
      expect(resolveUpdate.argv[2]).toBe(String(N));
      expect(outcomeReport.issueNumber).toBe(N);

      // axis 13 — collect/evaluate modelId 공유.
      expect(runPlan.pipeline.modelId).toBe(MODEL_ID);
      stepArgs.evaluation.callArgs.forEach((c) => {
        expect(c.options.modelId).toBe(runPlan.pipeline.modelId);
      });

      // axis 12 — searchArgv 전체-벡터.
      expect(stepArgs.publish.searchArgv).toEqual(
        expectedSearchArgv(searchQuery),
      );
      expect(stepArgs.publish.searchArgv[4]).toBe(marker);
      // axis 11 — update/create argv 위치-정합.
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
      // axis 9~10 — argv title/body == descriptor == command-plan, labels 고정상수.
      expect(resolveUpdate.argv[4]).toBe(
        stepArgs.publish.report.descriptor.title,
      );
      expect(resolveUpdate.argv[6]).toBe(
        stepArgs.publish.report.descriptor.body,
      );
      expect(resolveCreate.argv[3]).toBe(cmdPlan.report.descriptor.title);
      expect(resolveCreate.argv[5]).toBe(cmdPlan.report.descriptor.body);
      expect(createArgs.labels).toEqual(EXPECTED_RESULT_ISSUE_LABELS);
      expect([resolveCreate.argv[7], resolveCreate.argv[9]]).toEqual(
        createArgs.labels,
      );
      // axis 6~8 — descriptor.{title,body}·summary command-plan 재유도.
      expect(stepArgs.publish.report.descriptor.title).toBe(
        cmdPlan.report.descriptor.title,
      );
      expect(stepArgs.publish.report.descriptor.body).toBe(
        cmdPlan.report.descriptor.body,
      );
      expect(stepArgs.publish.report.summary).toEqual(cmdPlan.report.summary);
      // axis 2~3 — marker 3-축.
      expect(stepArgs.publish.commandArgs.searchQuery).toBe(marker);
      expect(stepArgs.publish.searchArgv[4]).toBe(marker);
      // axis 1 — run token 전파.
      expect(marker).toContain(token);
      expect(outcomeReport.gitSha).toBe(runPlan.run.gitSha);
      expect(outcomeReport.dateToken).toBe(runPlan.run.dateToken);
      expect(`${runPlan.run.dateToken}@${runPlan.run.gitSha}`).toBe(token);
    });
  });

  describe("create/update 두 분기 격리 — input 내부-shape 는 분기 비종속(branch)", () => {
    it("(o) 동일 seeds·modelId·run·activities·results, searchStdout 만 (hit 1+ vs hit 0)으로 달리해 → 한쪽 update·다른 쪽 create. stepArgs.evaluation.inputs[i] 필드는 두 chain byte-identical(검색 결과가 evaluation-leg 를 바꾸지 0 — evaluation-leg 는 검색 실행 전 합성)", () => {
      const seeds = defaultSeeds();
      const runPlan = buildRunPlan(seeds);
      const activities = defaultActivities();
      const results = defaultResults();
      const stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results);
      const marker = stepArgs.publish.report.descriptor.marker;

      const resolveUpdate = resolveRealDataResultIssueGhCommandPlan(
        multiHitStdout(marker, [7, 13]),
        stepArgs.publish.commandArgs,
      );
      const resolveCreate = resolveRealDataResultIssueGhCommandPlan(
        "[]",
        stepArgs.publish.commandArgs,
      );

      // 분기 동사 차이(update vs create).
      expect(resolveUpdate.argv[1]).toBe("edit");
      expect(resolveCreate.argv[1]).toBe("create");

      // evaluation-leg inputs 는 검색 결과(update/create)와 무관하게 byte-identical.
      stepArgs.evaluation.inputs.forEach((input, i) => {
        expect(input).toEqual(mapActivityToEvaluationInput(activities[i]));
      });
    });
  });

  describe("error path / negative cases — boundary 거부 대칭 박제(R-112 negative 충분 cover)", () => {
    it("(p) run.gitSha 빈('') → buildRealDataE2eRunPlan run guard assertRunRefNonBlank('gitSha') throw(inputs 합성 도달 전 차단)", () => {
      const seeds = defaultSeeds();
      expect(() =>
        buildRealDataE2eRunPlan(seeds, MODEL_ID, {
          gitSha: "",
          dateToken: "2026-06-29",
        }),
      ).toThrow();
    });

    it("(p') run.gitSha 공백-only('  ') → run guard throw 대칭", () => {
      const seeds = defaultSeeds();
      expect(() =>
        buildRealDataE2eRunPlan(seeds, MODEL_ID, {
          gitSha: "  ",
          dateToken: "2026-06-29",
        }),
      ).toThrow();
    });

    it("(q) run.dateToken 빈('') → run guard assertRunRefNonBlank('dateToken') throw 대칭", () => {
      const seeds = defaultSeeds();
      expect(() =>
        buildRealDataE2eRunPlan(seeds, MODEL_ID, {
          gitSha: "abc1234",
          dateToken: "",
        }),
      ).toThrow();
    });

    it("(r) modelId 빈('') → buildRealDataE2eStepArgs 위임 evaluation step modelId guard throw(inputs 합성 도달 전 차단)", () => {
      const seeds = defaultSeeds();
      // runPlan 은 modelId guard 가 먼저 잡으므로, modelId 빈 runPlan 자체가 throw.
      expect(() =>
        buildRealDataE2eRunPlan(seeds, "", {
          gitSha: "abc1234",
          dateToken: "2026-06-29",
        }),
      ).toThrow();
    });

    it("(r') modelId 공백-only('   ') → modelId guard throw 대칭", () => {
      const seeds = defaultSeeds();
      expect(() =>
        buildRealDataE2eRunPlan(seeds, "   ", {
          gitSha: "abc1234",
          dateToken: "2026-06-29",
        }),
      ).toThrow();
    });

    it("(s) seed externalId 빈('') → buildRealDataE2eRunPlan 위임 collect-input externalId 빈-가드 throw(collect-leg 묶음 항 boundary)", () => {
      const badSeeds: RealDataSeedDescriptor[] = [
        {
          person: { fullName: "x", email: "x@e2e.realdata.test", active: true },
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

    it("(t) searchStdout 비JSON/비배열('not json') → parseRealDataResultIssueSearchOutput throw", () => {
      expect(() => parseRealDataResultIssueSearchOutput("not json")).toThrow();
    });

    it("(u) searchStdout hit number 비양수([{number:0,...}]) → search-parse assertPositiveNumber throw", () => {
      const stepArgs = buildRealDataE2eStepArgs(
        buildRunPlan(),
        defaultActivities(),
        defaultResults(),
      );
      const marker = stepArgs.publish.report.descriptor.marker;
      const zeroStdout = JSON.stringify([
        { number: 0, title: "결과 이슈", body: `본문\n${marker}\n끝` },
      ]);
      expect(() => parseRealDataResultIssueSearchOutput(zeroStdout)).toThrow();
    });

    it("(v) searchStdout hit title/body 비문자열([{number:1,title:5,body:'b'}]) → search-parse 문자열 필드 guard throw", () => {
      const badStdout = JSON.stringify([{ number: 1, title: 5, body: "b" }]);
      expect(() => parseRealDataResultIssueSearchOutput(badStdout)).toThrow();
    });

    it("(w) execStdout URL 미발견(빈 문자열) → post 파서 throw(runPlan.run 정상이어도 차단)", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(buildRunPlan(), ""),
      ).toThrow();
    });

    it("(w') execStdout /issues/0 → post 파서 assertPositiveIssueNumber throw(post 비식별)", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(
          buildRunPlan(),
          `https://github.com/${OWNER}/${REPO}/issues/0\n`,
        ),
      ).toThrow();
    });

    it("(x) 빈 activities 배열 boundary — activities=[] → stepArgs.evaluation.inputs 가 빈 배열 보존(throw 0, [].map 정합). callArgs 도 빈 배열(degenerate 1:1 — throw 아님)", () => {
      const runPlan = buildRunPlan();
      const stepArgs = buildRealDataE2eStepArgs(runPlan, [], defaultResults());
      expect(stepArgs.evaluation.inputs).toEqual([]);
      expect(stepArgs.evaluation.callArgs).toEqual([]);
      // 빈 activities 의 재유도도 빈 배열.
      expect(stepArgs.evaluation.inputs).toEqual(
        buildRealDataEvaluationInputs([]),
      );
    });
  });

  describe("결정론·무공유·no-mutation — chain 두 번 호출 + 입력 불변 + inputs 오염 0", () => {
    it("(y) 동일 (seeds, modelId, run, activities, results, searchStdout, execStdout) chain 두 번 → runPlan/stepArgs/parsedHits/resolvePlan/outcomeReport 모두 deep-equal(결정론)", () => {
      const seeds = defaultSeeds();
      const chain1 = runChain([7, 13], seeds, buildRunPlan(seeds));
      const chain2 = runChain([7, 13], seeds, buildRunPlan(seeds));

      expect(chain1.stepArgs.evaluation).toEqual(chain2.stepArgs.evaluation);
      expect(chain1.stepArgs.publish).toEqual(chain2.stepArgs.publish);
      expect(chain1.runPlan.pipeline.collectCallArgs).toEqual(
        chain2.runPlan.pipeline.collectCallArgs,
      );
      expect(chain1.parsedHits).toEqual(chain2.parsedHits);
      expect(chain1.resolvePlan).toEqual(chain2.resolvePlan);
      expect(chain1.outcomeReport).toEqual(chain2.outcomeReport);
    });

    it("(z) no-mutation — 입력 activities(특히 각 activity·metadata)·results·run chain 호출 후 deep-equal(원본 불변)", () => {
      const seeds = defaultSeeds();
      const activities = defaultActivities();
      const results = defaultResults();
      const run = { gitSha: "abc1234", dateToken: "2026-06-29" };
      const activitiesBefore = JSON.parse(JSON.stringify(activities));
      const resultsBefore = JSON.parse(JSON.stringify(results));
      const runBefore = JSON.parse(JSON.stringify(run));

      const runPlan = buildRealDataE2eRunPlan(seeds, MODEL_ID, run);
      const stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results);
      parseRealDataResultIssueSearchOutput(
        multiHitStdout(stepArgs.publish.report.descriptor.marker, [7]),
      );

      expect(activities).toEqual(activitiesBefore);
      expect(results).toEqual(resultsBefore);
      expect(run).toEqual(runBefore);
    });

    it("(aa) 무공유 — stepArgs.evaluation.inputs.push(...) 후 새 chain 의 산출이 여전히 정상·activities 오염 0(top-level 매 호출 새 배열). 단 metadata 는 reference 승계라 동일 객체임을 명시(원소 배열 차원 무공유만 단언)", () => {
      const activities = defaultActivities();
      const first = buildRealDataE2eStepArgs(
        buildRunPlan(),
        activities,
        defaultResults(),
      );
      const firstInputs = first.evaluation.inputs as EvaluationInput[];
      const firstLen = firstInputs.length;

      // 반환 inputs 배열 mutate(오염 시도).
      firstInputs.push(mapActivityToEvaluationInput(activities[0]));
      expect(first.evaluation.inputs).toHaveLength(firstLen + 1);

      // 새 stepArgs 의 inputs 는 여전히 정상(이전 호출 mutate 누설 0 — 매 호출 새 배열).
      const second = buildRealDataE2eStepArgs(
        buildRunPlan(),
        activities,
        defaultResults(),
      );
      expect(second.evaluation.inputs).toHaveLength(activities.length);
      expect(second.evaluation.inputs).toEqual(
        buildRealDataEvaluationInputs(activities),
      );
      // metadata 는 reference 승계(매퍼 계약) — 동일 객체임을 명시.
      second.evaluation.inputs.forEach((input, i) => {
        expect(input.metadata).toBe(activities[i].metadata);
      });
    });
  });

  describe("credential 누출 0(branch — §9 / R-59 / REQ-059 정합)", () => {
    it("(bb) stepArgs.evaluation(inputs {unitId,author,...}·callArgs 직렬화)·searchArgv(join)·parsedHits·resolvePlan.argv(join)·commandArgs/{descriptor,summary}/outcomeReport.{url,summaryLine} 어디에도 credential 어휘 미등장(특히 inputs[i].author·inputs[i].unitId 명시)", () => {
      const { runPlan, stepArgs, parsedHits, resolvePlan, outcomeReport } =
        runChain([7, 13]);
      const resolveCreate = resolveRealDataResultIssueGhCommandPlan(
        "[]",
        stepArgs.publish.commandArgs,
      );

      const surfaces: string[] = [
        JSON.stringify(stepArgs.evaluation.inputs),
        JSON.stringify(stepArgs.evaluation.callArgs),
        runPlan.pipeline.modelId,
        stepArgs.publish.searchArgv.join(" "),
        JSON.stringify(parsedHits),
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
        outcomeReport.url,
        outcomeReport.summaryLine,
      ];

      const credentialPattern =
        /(GH_TOKEN|GITHUB_TOKEN|Bearer|Authorization|x-access-token|x-github-token|--token|--auth|ghp_[A-Za-z0-9]|PAT)/i;
      for (const surface of surfaces) {
        expect(surface).not.toMatch(credentialPattern);
      }
      // inputs[i].author(외부 service ID — 귀속 key) 와 inputs[i].unitId(externalId 포함
      // 합성)에 credential 어휘 미등장 명시.
      stepArgs.evaluation.inputs.forEach((input) => {
        expect(input.author).not.toMatch(credentialPattern);
        expect(input.unitId).not.toMatch(credentialPattern);
      });
      // outcome url 은 issue 경로만.
      expect(outcomeReport.url).not.toMatch(/commit|pull request/i);
    });
  });
});
