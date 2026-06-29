// realdata-e2e-aggregator-publish-leg-results-summary-internal-shape-run-plan-threading-18way-single-source-closure-assembly.smoke-spec.ts
// — 실 평가 e2e step④ aggregator publish-leg report.summary(RealDataResultSummary)
// 내부-shape per-result 1:1 집계 thread 합류 18-way single-source closure:
// 최외곽 진입 `buildRealDataE2eRunPlan(seeds, modelId, run)` → `{pipeline, run}` 를
// pre-실행 aggregator `buildRealDataE2eStepArgs(runPlan, activities, results)` →
// `{evaluation, publish}` 에 통째로 넘긴다. aggregator 가 산출한 publish-leg
// `stepArgs.publish.report.summary`(type `RealDataResultSummary`)의 각 집계 필드
// (`count`·`byDifficulty`(3 슬롯 easy/medium/hard)·`byContribution`(4 슬롯
// zero/low/medium/high)·`totalVolume`)가, 검증 source `results[]`(type
// `EvaluationResult[]`)로부터 production 집계 위임 `buildRealDataResultSummary(results)`
// 와 **필드별 byte-identical·원소별 1:1**(각 `results[i]` 가 자기
// `byDifficulty[results[i].difficulty]` 슬롯 +1·`byContribution[results[i].contribution]`
// 슬롯 +1·`count` +1·`volume` 누적, 그리고 **전 enum 슬롯 존재**(DIFFICULTIES 3 +
// CONTRIBUTION_LEVELS 4, 미등장 슬롯도 키 존재·값 0), narrative raw 본문 key 부재)
// 임을 18번째 축으로 합류시킨다.
//
// publish-leg summary 내부-shape 축(EvaluationResult[] → RealDataResultSummary 집계
// 깊이)은 T-0776 7-way 가 잡은 summary **top-level deep-equal**(summary ==
// command-plan.report.summary) + 특정 3-result fixture 의 고정-리터럴 슬롯값
// (byDifficulty.easy===1 등)·count===results.length·totalVolume===10 과 distinct
// surface 다 — 본 spec 은 그것을 임의 multi-slot/반복-슬롯 results[] 의 **원소별 슬롯 +1
// 1:1 재유도·전 enum 슬롯 존재(미등장 0)·volume 합산 불변식** 으로 일반화한다. 본 spec 은
// 그 1:1 축이 summary top-level 재유도·evaluation-leg input 내부-shape·collect-leg
// serviceIdentities 내부-shape·collectCallArgs top-level 재유도·inputs top-level·
// callArgs.input 페어링·collect/evaluate modelId 공유·search-json-fields↔parse-shape
// set-equal·number→resolve→post·search-argv 전체-벡터·resolve-argv·command-args·
// descriptor·marker·resolve·post 와 같은 검증 source(seeds+modelId+run+activities+results)
// 의 산물임을 한 chain 동시-호출로 closure 에 합류시킨다:
//   (축 18, 새 표면) stepArgs.publish.report.summary == buildRealDataResultSummary(
//       results) (필드별 byte-identical — count·byDifficulty 3슬롯·byContribution 4슬롯·
//       totalVolume 각 results 원소별 1:1 재유도, 전 enum 슬롯 존재/미등장 0, key set
//       {4필드} set-equal/narrative raw 부재).
//   (축 7) stepArgs.publish.report.summary == buildRealDataResultIssueCommandPlan(
//       results, runPlan.run).report.summary top-level 재유도(command-plan 경유 SSOT).
//   (축 17) stepArgs.evaluation.inputs[i] == mapActivityToEvaluationInput(activities[i])
//       (필드별 byte-identical — unitId 합성·contributionKind R-30 4분기·metadata reference).
//   (축 6) evaluation.inputs == buildRealDataEvaluationInputs(activities) + callArgs.input 페어링.
//   (축 16) collect-leg serviceIdentities 내부-shape 1:1 + collectCallArgs top-level 재유도.
//   (축 14~15) set(searchArgv[6] split) == set(PARSE_SHAPE_KEYS) == set(keys(hit)) + number thread.
//   (축 13) collect/evaluate modelId 공유.
//   (축 11~12) searchArgv 전체-벡터 + resolve-argv update/create 위치-정합.
//   (축 9~10) command-args labels 고정상수 + {create,update}Args.{title,body} == descriptor.{title,body}.
//   (축 8) descriptor.{title,body} command-plan 경유 재유도 byte-identical.
//   (축 2~3) marker 3-축 — descriptor.marker / commandArgs.searchQuery / searchArgv[4] 동일.
//   (축 1, 종단) marker → resolve issueNumber → post run-identity(동일 runPlan.run 전파).
//
// 이 18-way 가 검증 source `(seeds, modelId, run, activities, results)` single-source
// 에서 한 chain 동시-호출로 수렴함이 search-or-update 멱등성(REQ-009)·raw 미보유 평가
// 결과 정합(REQ-032)·난이도/기여도 정성 분류 집계 정합(REQ-037/038)·raw 미저장(REQ-059)
// 의 aggregator-level "aggregator 가 step④ 이슈로 박제할 결과 요약 1건의 정량 집계(평가
// 단위 수·난이도 분포·기여도 분포·총 volume)가 검증 source 평가 결과 집합과 원소별 어긋남
// 0, 미등장 분류도 슬롯 보존, narrative raw 는 요약으로 새지 않음" 의 종단 닫음이다.
// e2e 의 publish-leg 가 검증 source results 의 EvaluationResult[]→RealDataResultSummary
// 집계 깊이까지 단일 검증 source 에서 원소별 1:1 로 맞물리는 seam slice 다(collect-leg·
// evaluation-leg 내부-shape 에 이어 publish-leg 내부-shape — runPlan 세 leg 내부-shape
// 깊이 closure 완성). (T-0787 박제, PLAN.md 109행 🟢 실 평가 e2e step④).
//
// 본 spec 의 존재 이유 — public CI gap 해소(publish-leg summary 내부-shape 1:1 축 합류):
//   - aggregator-* sweep smoke 중 report.summary 참조는 7-way(T-0776)/8~11-way 뿐이고
//     그 안 summary 단언은 summary == command-plan.report.summary top-level deep-equal +
//     특정 3-result fixture 고정-리터럴 슬롯값(byDifficulty.easy===1 등)·count===results
//     .length·totalVolume===10 만 — 임의 multi-slot results[] 에서의 원소별 슬롯 +1 1:1
//     재유도·전 enum 슬롯 존재(미등장 0)·volume 합산 불변식 단언 0.
//   - result-summary helper spec / report-plan helper spec 이 count·분포·totalVolume
//     집계를 박제했으나 aggregator(buildRealDataE2eStepArgs) chain 진입·resolve·post
//     미합류(집계 빌더 단독 spec).
//   - 본 spec 은 그 빈 자리를 채워 aggregator 가 산출한 publish-leg report.summary 가
//     검증 source results[] 로부터 production buildRealDataResultSummary 와 필드별
//     byte-identical·원소별 1:1(전 enum 슬롯 존재/미등장 0·volume 합산·narrative key
//     부재)임을 summary top-level·evaluation-leg·collect-leg·descriptor·resolve·post 와
//     묶어 closure 에 합류시킨다.
//   - live leg(실 prisma·실 collectForPerson·실 github.com fetch·실 LLM scoreUnit·실 gh
//     CLI 실행·DB·LAN gate)는 복제하지 않고, synthetic seeds/modelId/run + activities/
//     results literal + search-stdout/exec-stdout literal 을 컴포저들에 직접 공급해 live
//     leg 를 우회한다(조립 surface 만 검증). 따라서 본 spec 은:
//
//      🔥 실 scoreUnit/LLM 호출 0 — summary 1:1 은 step④ 이슈 박제 입력 shape build-time
//         정합만 검증(실 scoring 0). 실 gh / fetch / collectForPerson / DB 0.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 helper export + production type/집계위임 import 재사용만.
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0787):
//   - src 변경 0(src/, prisma/, package.json, CI workflow, 환경 변수 추가 등 모두 금지).
//     test-only. production buildRealDataResultSummary·RealDataResultSummary·
//     EvaluationResult·DIFFICULTIES·CONTRIBUTION_LEVELS 는 비교 source 로 import 만(변경 0).
//   - 실 collectForPerson / 실 prisma write / 실 gh search·exec / 실 LLM scoreUnit 호출.
//     in-memory 합성 results / activities / search-stdout / exec-stdout 만.
//   - aggregator 17-way(evaluation-leg input 내부-shape + collect-leg serviceIdentities +
//     16축) 자체 재단언(T-0786 cover). 본 task 는 publish-leg report.summary 의 내부 집계
//     (EvaluationResult[]→RealDataResultSummary)를 results[] 로부터 원소별 1:1 재유도(전
//     enum 슬롯 존재/미등장 0·volume 합산)를 18번째 축으로 합류시킨 부분만(17축은 18-way
//     묶음 표현용 — 재검증 아니라 동시-성립 확인).
//   - publish-leg summary top-level 재유도(summary == command-plan.report.summary) 자체를
//     새 표면으로 재단언(T-0776 7-way cover). 본 task 는 그것을 18-way 묶음 항으로만 재확인.
//   - production buildRealDataResultSummary 의 집계 로직 자체 재구현·내부 분기 재단언
//     (result-summary helper spec cover). aggregator 산출 summary 가 그 production 위임
//     산출과 byte-identical 임만 비교(위임 직접 호출 — 로직 재현은 spec-로컬 독립 카운트로
//     1:1 대조용만, helper 알고리즘 복제 0).
//   - buildRealDataResultSummary self-guard / EvaluationResult 도메인 shape 정책 / volume
//     산출 공식 / difficulty·contribution enum 정의 자체 재단언 0(domain/helper spec cover).
//   - Person 별/기간 별 group-by 집계 / 난이도별 modelId routing(R-97 deferred) 검증 0.
//   - DB 의존 0 / live-LLM·실 fetch·실 gh CLI·실 collectForPerson 0.
//   - 새 helper 모듈 신설 / 기존 helper 수정 — test-only(신규 smoke spec 1 파일).
import type { Activity } from "../../src/assessment-collection/domain/activity";
import type {
  ConfluenceActivity,
  GithubActivity,
} from "../../src/assessment-collection/domain/activity";
import { mapActivityToEvaluationInput } from "../../src/assessment-evaluation/domain/evaluation-input.mapper";
import {
  CONTRIBUTION_LEVELS,
  type ContributionLevel,
  type EvaluationResult,
} from "../../src/assessment-evaluation/domain/evaluation-result";
import { DIFFICULTIES, type Difficulty } from "../../src/llm/difficulty";
import { buildRealDataEvaluationInputs } from "../helpers/realdata-e2e-evaluation-inputs";
import { buildRealDataResultIssueCommandPlan } from "../helpers/realdata-e2e-result-issue-command-plan";
import { resolveRealDataResultIssueGhCommandPlan } from "../helpers/realdata-e2e-result-issue-gh-command-plan";
import { REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS } from "../helpers/realdata-e2e-result-issue-search-argv";
import { REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS } from "../helpers/realdata-e2e-result-issue-search-json-fields";
import { parseRealDataResultIssueSearchOutput } from "../helpers/realdata-e2e-result-issue-search-parse";
import { buildRealDataResultOutcomeStepArgs } from "../helpers/realdata-e2e-result-outcome-step-args";
import { buildRealDataResultSummary } from "../helpers/realdata-e2e-result-summary";
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

// 결정론 modelId fixture — runPlan 의 pipeline 측 입력. collect-leg modelId 와 evaluation
// callArgs[].options.modelId 두 leg 가 공유하는 단일 source.
const MODEL_ID =
  "cfg-realdata-e2e-aggregator-publish-leg-results-summary-internal-shape-run-plan-threading-smoke";

// RealDataResultSummary 의 정규 키 집합(4필드) — 본 task 의 새 표면(축 18) 의 raw key
// 부재 boundary expected. realdata-e2e-result-summary.ts(64~69행) interface 시그니처로 확인.
const RESULT_SUMMARY_KEYS = [
  "count",
  "byDifficulty",
  "byContribution",
  "totalVolume",
];

// 고정 결정론 분류 라벨 — command-args RESULT_ISSUE_LABELS = ["realdata-e2e","result"].
const EXPECTED_RESULT_ISSUE_LABELS = ["realdata-e2e", "result"];

// search-argv helper 가 산출하는 canonical 9-원소 전체-벡터(marker 위치만 입력 종속).
// 18-way 묶음 표현용 동시-성립 항(축 12). marker(index 4)는 commandArgs.searchQuery 로 채움.
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

// spec 로컬 set-equal 비교 — 양방향 포함(크기 동일 AND 한쪽 원소가 모두 다른 쪽에 존재 —
// 순서·중복 무관 set-equality).
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

// 합성 run-token — descriptor 컴포저 내부 runToken(run) = `${dateToken}@${gitSha}` 규칙으로
// test 측에서 재유도한 expected 공유 substring.
function expectedToken(run: RealDataE2eRunPlan["run"]): string {
  return `${run.dateToken}@${run.gitSha}`;
}

// 본 task 의 핵심 새 표면(축 18) — spec-로컬 독립 슬롯 카운트(production helper 호출 0,
// results 를 filter 로 직접 카운트). 각 difficulty 슬롯의 등장 횟수 기대값 재유도.
function expectedDifficultyCount(
  results: EvaluationResult[],
  difficulty: Difficulty,
): number {
  return results.filter((r) => r.difficulty === difficulty).length;
}

// spec-로컬 독립 슬롯 카운트 — contribution 슬롯의 등장 횟수 기대값 재유도(production 0).
function expectedContributionCount(
  results: EvaluationResult[],
  contribution: ContributionLevel,
): number {
  return results.filter((r) => r.contribution === contribution).length;
}

// spec-로컬 독립 volume 합산 — production reduce 호출 0(results 직접 누적).
function expectedTotalVolume(results: EvaluationResult[]): number {
  return results.reduce((sum, r) => sum + r.volume, 0);
}

// 기본 seeds — fixed 2-Person(myungjoo/leemgs) descriptor 배열. publish-leg summary
// 표면이 주축이라 collect-leg 는 묶음 항으로만 등장(seed-fixture 그대로 사용).
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

// synthetic GithubActivity 1 건 — aggregator 의 evaluation leg 입력(18-way 묶음 항 축 17).
// metadata 는 매 호출 새 객체(reference 승계 검증의 source).
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

// synthetic ConfluenceActivity 1 건 — confluence→document routing 분기 cover(묶음 항 축 17).
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
// commit·pr·issue·confluence page 4종 모두 1+ 원소 포함(묶음 항 routing 4분기 cover).
function defaultActivities(): Activity[] {
  return [
    githubActivity("commit", "summary-c1", "myungjoo"),
    githubActivity("pr", "summary-p1", "leemgs"),
    githubActivity("issue", "summary-i1", "myungjoo", "github.sec"),
    confluenceActivity("summary-page1", "leemgs"),
  ];
}

// synthetic EvaluationResult 1 건 — aggregator 의 publish leg 입력(summary 집계 source).
function syntheticResult(
  unitId: string,
  difficulty: Difficulty,
  contribution: ContributionLevel,
  volume: number,
): EvaluationResult {
  return {
    unitId,
    narrative:
      "synthetic evaluation narrative — aggregator publish-leg report.summary 내부-shape per-result 1:1 집계(stepArgs.publish.report.summary == buildRealDataResultSummary(results) 필드별 byte-identical — count·byDifficulty 3슬롯·byContribution 4슬롯·totalVolume 각 results 원소별 재유도·전 enum 슬롯 존재/미등장 0·volume 합산·narrative raw key 부재)+summary top-level 재유도(==command-plan.report.summary)+evaluation-leg input 내부-shape+collect-leg serviceIdentities+collectCallArgs top-level+inputs top-level+callArgs.input 페어링+modelId 공유+search-json-fields↔parse-shape set-equal+number→resolve→post+search-argv+resolve-argv+command-args-{title,body,labels}+descriptor+marker run-plan-threading 18-way closure smoke fixture",
    difficulty,
    contribution,
    volume,
  };
}

// 유효 results fixture(전 슬롯 cover·반복 슬롯) — aggregator 의 publish leg summary 집계
// source. difficulty 3 슬롯(easy×3·medium×2·hard×1) 모두 등장+반복, contribution 4 등급
// (zero×1·low×2·medium×1·high×2) 모두 등장+반복. multi-slot/반복 일반화 박제 위해 의도적
// 비균등 분포. volume 다양(합산 검증의 source).
function defaultResults(): EvaluationResult[] {
  return [
    syntheticResult("github:github.com:c1", "easy", "low", 3),
    syntheticResult("github:github.com:c2", "easy", "high", 5),
    syntheticResult("github:github.com:c3", "easy", "zero", 2),
    syntheticResult("github:github.com:c4", "medium", "high", 7),
    syntheticResult("github:github.com:c5", "medium", "low", 4),
    syntheticResult("github:github.com:c6", "hard", "medium", 11),
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
// 헬퍼. 핵심 새 표면(축 18) = stepArgs.publish.report.summary ↔ results 원소별 1:1 집계.
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

describe("Smoke(non-gated): 실 평가 e2e step④ aggregator publish-leg report.summary 내부-shape per-result 1:1 집계 thread 합류 18-way single-source closure buildRealDataE2eRunPlan → buildRealDataE2eStepArgs → stepArgs.publish.report.summary == buildRealDataResultSummary(results)(필드별 byte-identical 원소별 1:1 — count·byDifficulty 3슬롯·byContribution 4슬롯·totalVolume 각 results 재유도·전 enum 슬롯 존재/미등장 0·key set {4필드} set-equal/narrative raw 부재) + summary top-level 재유도(==command-plan.report.summary) + evaluation-leg input 내부-shape + collect-leg serviceIdentities 내부-shape + collectCallArgs top-level 재유도 + inputs top-level + callArgs.input 페어링 + collect/evaluate modelId 공유 + search-json-fields↔parse-shape set-equal + number→resolve→post + search-argv 전체-벡터 + resolve-argv(update/create) + command-args labels + {title,body} 두 경로(=descriptor.{title,body}) + descriptor 재유도 + marker 3-축 + resolve issueNumber + post run-identity ↔ 동일 (seeds, modelId, run, activities, results) 한 chain 동시-호출 18축 동시 수렴 live-collect/live-gh/live-LLM 0 검증", () => {
  describe("happy path — aggregator 18-way chain 합성(publish.report.summary 정상·count==results.length·evaluation.inputs 비어있지 않음 + 산출물 정상)", () => {
    it("(a) 유효 seeds + modelId + run + activities(github commit/pr/issue·confluence 4종 포함) + results(difficulty 3슬롯·contribution 4등급 모두 등장+반복) + searchStdout + execStdout → stepArgs.publish.report.summary(정상 객체·count==results.length) / evaluation.inputs(비어있지 않은 배열) / parsedHits / resolvePlan(update) / outcomeReport 모두 정상", () => {
      const activities = defaultActivities();
      const results = defaultResults();
      const { stepArgs, parsedHits, resolvePlan, outcomeReport } = runChain(
        [7, 13],
        defaultSeeds(),
        buildRunPlan(),
        activities,
        results,
      );
      const summary = stepArgs.publish.report.summary;

      // stage 1 — publish-leg summary 정상 객체.
      expect(typeof summary).toBe("object");
      expect(summary.count).toBe(results.length);
      expect(typeof summary.totalVolume).toBe("number");
      expect(typeof summary.byDifficulty).toBe("object");
      expect(typeof summary.byContribution).toBe("object");

      // results 가 difficulty 3슬롯·contribution 4등급 모두 등장+반복임을 확인(전 슬롯 cover source).
      expect(new Set(results.map((r) => r.difficulty)).size).toBe(3);
      expect(new Set(results.map((r) => r.contribution)).size).toBe(4);

      // evaluation-leg 정상.
      expect(Array.isArray(stepArgs.evaluation.inputs)).toBe(true);
      expect(stepArgs.evaluation.inputs.length).toBeGreaterThan(0);
      expect(stepArgs.publish.searchArgv).toHaveLength(9);

      // stage 2~4 — 정상.
      expect(parsedHits.length).toBeGreaterThan(0);
      expect(resolvePlan.action.action).toBe("update");
      expect(outcomeReport.issueNumber).toBeGreaterThan(0);
      expect(outcomeReport.gitSha).toBe("abc1234");
      expect(outcomeReport.dateToken).toBe("2026-06-29");
    });
  });

  describe("summary per-result 1:1 집계 재유도 수렴(branch — 핵심 불변식 1, 본 task 의 새 표면 — 축 18)", () => {
    it("(b) stepArgs.publish.report.summary deep-equal(toEqual) buildRealDataResultSummary(results)(production 위임 직접 호출) AND spec-로컬 독립 재유도(count===results.length·totalVolume===Σvolume·모든 d∈DIFFICULTIES byDifficulty[d]===filter count·모든 c∈CONTRIBUTION_LEVELS byContribution[c]===filter count, 각 toBe forEach)", () => {
      const results = defaultResults();
      const { stepArgs } = runChain(
        [7, 13],
        defaultSeeds(),
        buildRunPlan(),
        defaultActivities(),
        results,
      );
      const summary = stepArgs.publish.report.summary;

      // 핵심 — production 위임 직접 호출과 필드별 byte-identical(로직 재현 0).
      expect(summary).toEqual(buildRealDataResultSummary(results));

      // spec-로컬 독립 재유도(filter/reduce — production helper 호출 0)와의 1:1.
      expect(summary.count).toBe(results.length);
      expect(summary.totalVolume).toBe(expectedTotalVolume(results));

      // 모든 difficulty 슬롯의 카운트가 독립 재유도와 1:1(forEach).
      DIFFICULTIES.forEach((d) => {
        expect(summary.byDifficulty[d]).toBe(
          expectedDifficultyCount(results, d),
        );
      });
      // 모든 contribution 슬롯의 카운트가 독립 재유도와 1:1(forEach).
      CONTRIBUTION_LEVELS.forEach((c) => {
        expect(summary.byContribution[c]).toBe(
          expectedContributionCount(results, c),
        );
      });
    });
  });

  describe("전 enum 슬롯 존재 boundary 수렴(branch — 핵심 불변식 2, REQ-037/038)", () => {
    it("(c) Object.keys(summary.byDifficulty) set == new Set(DIFFICULTIES)(3슬롯) set-equal, Object.keys(summary.byContribution) set == new Set(CONTRIBUTION_LEVELS)(4슬롯) set-equal — 미등장 분류 슬롯도 키 존재·값 0(예: difficulty hard 0개여도 byDifficulty.hard===0·키 존재, undefined 아님)", () => {
      // 의도적으로 일부 슬롯 미등장(hard 0개·zero 0개)인 results.
      const results: EvaluationResult[] = [
        syntheticResult("u1", "easy", "low", 1),
        syntheticResult("u2", "easy", "high", 2),
        syntheticResult("u3", "medium", "medium", 3),
      ];
      const { stepArgs } = runChain(
        [7],
        defaultSeeds(),
        buildRunPlan(),
        defaultActivities(),
        results,
      );
      const summary = stepArgs.publish.report.summary;

      // byDifficulty 슬롯 key set == enum set(3슬롯).
      expect(
        isSetEqual(
          setOf(Object.keys(summary.byDifficulty)),
          setOf(DIFFICULTIES),
        ),
      ).toBe(true);
      // byContribution 슬롯 key set == enum set(4슬롯).
      expect(
        isSetEqual(
          setOf(Object.keys(summary.byContribution)),
          setOf(CONTRIBUTION_LEVELS),
        ),
      ).toBe(true);

      // 미등장 슬롯도 키 존재·값 0(undefined 아님을 명시 변별).
      expect(summary.byDifficulty.hard).toBe(0);
      expect(summary.byContribution.zero).toBe(0);
      expect(
        Object.prototype.hasOwnProperty.call(summary.byDifficulty, "hard"),
      ).toBe(true);
      expect(
        Object.prototype.hasOwnProperty.call(summary.byContribution, "zero"),
      ).toBe(true);
      expect(summary.byDifficulty.hard).not.toBeUndefined();
      expect(summary.byContribution.zero).not.toBeUndefined();
      // 등장 슬롯은 정확한 카운트.
      expect(summary.byDifficulty.easy).toBe(2);
      expect(summary.byDifficulty.medium).toBe(1);
    });
  });

  describe("multi-slot/반복-슬롯 일반화 수렴(branch — off-by-one·누락 0)", () => {
    it("(d) difficulty/contribution 슬롯이 2회 이상 반복하는 results(easy×3·medium×2·hard×0; contribution low×2·high×2·zero×1·medium×0)로 → 각 슬롯 카운트가 정확한 등장 횟수와 1:1(반복 누적 정확·off-by-one 0)", () => {
      const results: EvaluationResult[] = [
        syntheticResult("u1", "easy", "low", 1),
        syntheticResult("u2", "easy", "high", 2),
        syntheticResult("u3", "easy", "zero", 3),
        syntheticResult("u4", "medium", "low", 4),
        syntheticResult("u5", "medium", "high", 5),
      ];
      const { stepArgs } = runChain(
        [7],
        defaultSeeds(),
        buildRunPlan(),
        defaultActivities(),
        results,
      );
      const summary = stepArgs.publish.report.summary;

      // difficulty 반복 누적.
      expect(summary.byDifficulty.easy).toBe(3);
      expect(summary.byDifficulty.medium).toBe(2);
      expect(summary.byDifficulty.hard).toBe(0);
      // contribution 반복 누적.
      expect(summary.byContribution.low).toBe(2);
      expect(summary.byContribution.high).toBe(2);
      expect(summary.byContribution.zero).toBe(1);
      expect(summary.byContribution.medium).toBe(0);
      // count·합산.
      expect(summary.count).toBe(5);
      expect(summary.totalVolume).toBe(1 + 2 + 3 + 4 + 5);
      // 슬롯 합 == count(분포가 count 를 정확히 분할).
      const difficultySum = DIFFICULTIES.reduce(
        (s, d) => s + summary.byDifficulty[d],
        0,
      );
      const contributionSum = CONTRIBUTION_LEVELS.reduce(
        (s, c) => s + summary.byContribution[c],
        0,
      );
      expect(difficultySum).toBe(summary.count);
      expect(contributionSum).toBe(summary.count);
    });
  });

  describe("raw-not-stored boundary — key set 정합 수렴(branch — REQ-032/059 경계)", () => {
    it("(e) Object.keys(summary) set == {count,byDifficulty,byContribution,totalVolume} set-equal — narrative·unitId·raw 활동 본문 같은 비-summary key 미surface(EvaluationResult.narrative 가 summary 로 새지 않음)", () => {
      const { stepArgs } = runChain([7, 13]);
      const summary = stepArgs.publish.report.summary;
      const keySet = setOf(Object.keys(summary));

      expect(isSetEqual(keySet, setOf(RESULT_SUMMARY_KEYS))).toBe(true);
      // 비-summary key 미surface(EvaluationResult raw 필드).
      expect(keySet.has("narrative")).toBe(false);
      expect(keySet.has("unitId")).toBe(false);
      expect(keySet.has("difficulty")).toBe(false);
      expect(keySet.has("contribution")).toBe(false);
      expect(keySet.has("volume")).toBe(false);
    });
  });

  describe("summary 내부-shape 축 변별성 — results 종속·modelId/activities/검색결과 비종속(branch)", () => {
    it("(f) 네 chain — (a)다른 results·(b)다른 modelId·(c)다른 activities·(d)다른 searchStdout → summary 가 (a)에서만 달라지고(results 1:1 반영), (b)·(c)·(d)에서는 두 chain byte-identical(summary 는 modelId·activities·검색결과 비종속)", () => {
      const seeds = defaultSeeds();
      const baseActivities = defaultActivities();
      const baseResults = defaultResults();

      // (a) 다른 results — 분포 다름.
      const altResults: EvaluationResult[] = [
        syntheticResult("x1", "hard", "high", 99),
        syntheticResult("x2", "hard", "high", 1),
      ];
      const stepBase = buildRealDataE2eStepArgs(
        buildRunPlan(seeds),
        baseActivities,
        baseResults,
      );
      const stepAltResults = buildRealDataE2eStepArgs(
        buildRunPlan(seeds),
        baseActivities,
        altResults,
      );
      expect(stepAltResults.publish.report.summary).not.toEqual(
        stepBase.publish.report.summary,
      );

      // (b) 다른 modelId, 같은 results — summary byte-identical(modelId 비종속).
      const stepModelA = buildRealDataE2eStepArgs(
        buildRunPlan(seeds, "model-alpha"),
        baseActivities,
        baseResults,
      );
      const stepModelB = buildRealDataE2eStepArgs(
        buildRunPlan(seeds, "model-beta"),
        baseActivities,
        baseResults,
      );
      expect(stepModelA.publish.report.summary).toEqual(
        stepModelB.publish.report.summary,
      );

      // (c) 다른 activities, 같은 results — summary byte-identical(activities 비종속).
      const altActivities: Activity[] = [
        githubActivity("issue", "alt-i1", "alice", "github.ecode"),
        confluenceActivity("alt-page1", "bob", "wiki.other"),
      ];
      const stepActsBase = buildRealDataE2eStepArgs(
        buildRunPlan(seeds),
        baseActivities,
        baseResults,
      );
      const stepActsAlt = buildRealDataE2eStepArgs(
        buildRunPlan(seeds),
        altActivities,
        baseResults,
      );
      expect(stepActsBase.publish.report.summary).toEqual(
        stepActsAlt.publish.report.summary,
      );

      // (d) 다른 searchStdout, 같은 results — summary byte-identical(검색결과 비종속).
      const chainD1 = runChain(
        [7],
        seeds,
        buildRunPlan(seeds),
        baseActivities,
        baseResults,
      );
      const chainD2 = runChain(
        [3, 9, 15],
        seeds,
        buildRunPlan(seeds),
        baseActivities,
        baseResults,
      );
      expect(chainD1.stepArgs.publish.report.summary).toEqual(
        chainD2.stepArgs.publish.report.summary,
      );
    });
  });

  describe("publish-leg summary top-level 재유도 수렴(branch — 7-way 묶음 항 — 축 7)", () => {
    it("(g) stepArgs.publish.report.summary deep-equal(toEqual) buildRealDataResultIssueCommandPlan(results, runPlan.run).report.summary(command-plan 경유 SSOT), 무공유(not.toBe) 보조", () => {
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
      const cmdPlan = buildRealDataResultIssueCommandPlan(results, runPlan.run);

      expect(stepArgs.publish.report.summary).toEqual(cmdPlan.report.summary);
      // 무공유 — 같은 값이지만 별개 객체(매 호출 새 summary 트리).
      expect(stepArgs.publish.report.summary).not.toBe(cmdPlan.report.summary);
    });
  });

  describe("evaluation-leg input 내부-shape 1:1 수렴(branch — 17-way 묶음 항 — 축 17)", () => {
    it("(h) 모든 i 에 대해 stepArgs.evaluation.inputs[i] deep-equal mapActivityToEvaluationInput(activities[i]), inputs[i].metadata === activities[i].metadata(reference), contributionKind R-30 routing(github commit/pr→code·issue→document·confluence→document)", () => {
      const activities = defaultActivities();
      const { stepArgs } = runChain(
        [7, 13],
        defaultSeeds(),
        buildRunPlan(),
        activities,
      );

      stepArgs.evaluation.inputs.forEach((input, i) => {
        expect(input).toEqual(mapActivityToEvaluationInput(activities[i]));
        expect(input.metadata).toBe(activities[i].metadata);
      });

      // contributionKind R-30 4분기.
      const inputs = stepArgs.evaluation.inputs;
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
      expect(inputs[commitIdx].contributionKind).toBe("code");
      expect(inputs[prIdx].contributionKind).toBe("code");
      expect(inputs[issueIdx].contributionKind).toBe("document");
      expect(inputs[confluenceIdx].contributionKind).toBe("document");
    });
  });

  describe("collect-leg serviceIdentities 내부-shape + collectCallArgs top-level 재유도 수렴(branch — 16-way 묶음 항 — 축 16)", () => {
    it("(i) runPlan.pipeline.collectCallArgs deep-equal buildRealDataCollectCallArgs(seeds), 원소별 since===undefined·assessmentId===ASSESSMENT_ID_PLACEHOLDER, collectCallArgs[i].person.serviceIdentities 가 seeds[i] {service,externalId} 추림과 1:1", () => {
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

  describe("inputs top-level 재유도 + callArgs.input 페어링 수렴(branch — 묶음 항 — 축 6)", () => {
    it("(j) evaluation.inputs deep-equal buildRealDataEvaluationInputs(activities), 모든 callArgs[i].input === inputs[i](reference, forEach)·inputs.length === activities.length", () => {
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

  describe("search-json-fields↔parse-shape set-equal + number→resolve→post thread 수렴(branch — 묶음 항 — 축 14~15)", () => {
    it("(k) set(searchArgv[6] split) == set(PARSE_SHAPE_KEYS) == set(Object.keys(parsedHits[0])) set-equal AND parsedHits[0].number(==N) === resolvePlan.action.update.issueNumber === Number(resolvePlan.argv[2]) === outcomeReport.issueNumber", () => {
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
    it("(l) runPlan.pipeline.modelId === modelId(toBe) AND 모든 stepArgs.evaluation.callArgs[i].options.modelId === runPlan.pipeline.modelId(toBe, forEach)", () => {
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
    it('(m) searchArgv deep-equal canonical 9-벡터, hit N → resolvePlan.argv == ["issue","edit",String(N),"--title",updateArgs.title,"--body",updateArgs.body], hit 0 → ["issue","create","--title",createArgs.title,"--body",createArgs.body,"--label","realdata-e2e","--label","result"]', () => {
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

  describe("publish-leg command-args-labels + title/body 두 경로 + descriptor 재유도 수렴(branch — 묶음 항 — 축 8~10)", () => {
    it("(n) createArgs.labels deep-equal ['realdata-e2e','result'], createArgs/updateArgs.{title,body} 둘 다 === descriptor.{title,body}, descriptor.{title,body} === buildRealDataResultIssueCommandPlan(results, runPlan.run).report.descriptor.{title,body} byte-identical", () => {
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
    });
  });

  describe("marker 3-축 + resolve issueNumber + post run-identity 수렴(branch — 묶음 항 — 축 1~3)", () => {
    it("(o) descriptor.marker === commandArgs.searchQuery === searchArgv[4](세 지점 byte-identical) AND hit N → resolve issueNumber → outcomeReport.issueNumber 동일 N AND descriptor.marker 에 `${dateToken}@${gitSha}` 포함 AND outcomeReport.{gitSha,dateToken} === runPlan.run", () => {
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

  describe("18-way 단일-source 묶음 단언(branch — closure 종단, 본 task 의 종단 박제)", () => {
    it("(p) summary == buildRealDataResultSummary(results)(필드별·원소별 1:1 + 전 enum 슬롯 존재/미등장 0 + key set {4필드}/narrative 부재), summary == command-plan.report.summary, inputs[i] == mapActivityToEvaluationInput(activities[i]), inputs == buildRealDataEvaluationInputs(activities), callArgs[i].input===inputs[i], collectCallArgs serviceIdentities 1:1, collectCallArgs == build...(seeds), set(searchArgv[6])==set(PARSE_SHAPE_KEYS)==set(keys(hit)) 그 number==N==resolve==argv[2]==post, modelId 공유, searchArgv canonical, update argv, argv title/body==descriptor==command-plan, labels, marker run token==post 가 single-source 18-way 동시 성립", () => {
      const N = 7;
      const seeds = defaultSeeds();
      const runPlan = buildRunPlan(seeds);
      const activities = defaultActivities();
      const results = defaultResults();
      const stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results);
      const summary = stepArgs.publish.report.summary;
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

      // axis 18(새 표면) — publish-leg summary 내부-shape per-result 1:1 집계.
      expect(summary).toEqual(buildRealDataResultSummary(results));
      expect(summary.count).toBe(results.length);
      expect(summary.totalVolume).toBe(expectedTotalVolume(results));
      DIFFICULTIES.forEach((d) => {
        expect(summary.byDifficulty[d]).toBe(
          expectedDifficultyCount(results, d),
        );
      });
      CONTRIBUTION_LEVELS.forEach((c) => {
        expect(summary.byContribution[c]).toBe(
          expectedContributionCount(results, c),
        );
      });
      expect(
        isSetEqual(
          setOf(Object.keys(summary.byDifficulty)),
          setOf(DIFFICULTIES),
        ),
      ).toBe(true);
      expect(
        isSetEqual(
          setOf(Object.keys(summary.byContribution)),
          setOf(CONTRIBUTION_LEVELS),
        ),
      ).toBe(true);
      expect(
        isSetEqual(setOf(Object.keys(summary)), setOf(RESULT_SUMMARY_KEYS)),
      ).toBe(true);

      // axis 7 — summary top-level 재유도.
      expect(summary).toEqual(cmdPlan.report.summary);

      // axis 17 — evaluation-leg input 내부-shape 1:1.
      stepArgs.evaluation.inputs.forEach((input, i) => {
        expect(input).toEqual(mapActivityToEvaluationInput(activities[i]));
        expect(input.metadata).toBe(activities[i].metadata);
      });

      // axis 6 — inputs top-level 재유도 + callArgs 페어링.
      expect(stepArgs.evaluation.inputs).toEqual(
        buildRealDataEvaluationInputs(activities),
      );
      stepArgs.evaluation.callArgs.forEach((c, i) => {
        expect(c.input).toBe(stepArgs.evaluation.inputs[i]);
      });

      // axis 16 — collect-leg top-level 재유도 + serviceIdentities 1:1.
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

      // axis 8~10 — argv title/body == descriptor == command-plan, labels 고정상수.
      expect(resolveUpdate.argv[4]).toBe(
        stepArgs.publish.report.descriptor.title,
      );
      expect(resolveUpdate.argv[6]).toBe(
        stepArgs.publish.report.descriptor.body,
      );
      expect(resolveCreate.argv[3]).toBe(cmdPlan.report.descriptor.title);
      expect(resolveCreate.argv[5]).toBe(cmdPlan.report.descriptor.body);
      expect(createArgs.labels).toEqual(EXPECTED_RESULT_ISSUE_LABELS);

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

  describe("create/update 두 분기 격리 — summary 내부-shape 는 분기 비종속(branch)", () => {
    it("(q) 동일 seeds·modelId·run·activities·results, searchStdout 만 (hit 1+ vs hit 0)으로 달리해 → 한쪽 update·다른 쪽 create. stepArgs.publish.report.summary 는 두 chain byte-identical(검색 결과가 summary 를 바꾸지 0 — summary 는 검색 실행 전 results 로부터 합성)", () => {
      const seeds = defaultSeeds();
      const runPlan = buildRunPlan(seeds);
      const activities = defaultActivities();
      const results = defaultResults();
      const stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results);
      const marker = stepArgs.publish.report.descriptor.marker;
      const summaryBefore = stepArgs.publish.report.summary;

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

      // summary 는 검색 결과(update/create)와 무관하게 byte-identical.
      expect(stepArgs.publish.report.summary).toEqual(summaryBefore);
      expect(stepArgs.publish.report.summary).toEqual(
        buildRealDataResultSummary(results),
      );
    });
  });

  describe("error path / negative cases — boundary 거부 대칭 박제(R-112 negative 충분 cover)", () => {
    it("(r) run.gitSha 빈('') → buildRealDataE2eRunPlan run guard assertRunRefNonBlank('gitSha') throw(summary 합성 도달 전 차단)", () => {
      const seeds = defaultSeeds();
      expect(() =>
        buildRealDataE2eRunPlan(seeds, MODEL_ID, {
          gitSha: "",
          dateToken: "2026-06-29",
        }),
      ).toThrow();
    });

    it("(r') run.gitSha 공백-only('  ') → run guard throw 대칭", () => {
      const seeds = defaultSeeds();
      expect(() =>
        buildRealDataE2eRunPlan(seeds, MODEL_ID, {
          gitSha: "  ",
          dateToken: "2026-06-29",
        }),
      ).toThrow();
    });

    it("(s) run.dateToken 빈('') → run guard assertRunRefNonBlank('dateToken') throw 대칭", () => {
      const seeds = defaultSeeds();
      expect(() =>
        buildRealDataE2eRunPlan(seeds, MODEL_ID, {
          gitSha: "abc1234",
          dateToken: "",
        }),
      ).toThrow();
    });

    it("(t) modelId 빈('') → buildRealDataE2eRunPlan modelId guard throw(stepArgs 합성 도달 전 차단)", () => {
      const seeds = defaultSeeds();
      expect(() =>
        buildRealDataE2eRunPlan(seeds, "", {
          gitSha: "abc1234",
          dateToken: "2026-06-29",
        }),
      ).toThrow();
    });

    it("(t') modelId 공백-only('   ') → modelId guard throw 대칭", () => {
      const seeds = defaultSeeds();
      expect(() =>
        buildRealDataE2eRunPlan(seeds, "   ", {
          gitSha: "abc1234",
          dateToken: "2026-06-29",
        }),
      ).toThrow();
    });

    it("(u) seed externalId 빈('') → buildRealDataE2eRunPlan 위임 collect-input externalId 빈-가드 throw(collect-leg 묶음 항 boundary)", () => {
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

    it("(v) searchStdout 비JSON/비배열('not json') → parseRealDataResultIssueSearchOutput throw", () => {
      expect(() => parseRealDataResultIssueSearchOutput("not json")).toThrow();
    });

    it("(w) searchStdout hit number 비양수([{number:0,...}]) → search-parse assertPositiveNumber throw", () => {
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

    it("(x) searchStdout hit title/body 비문자열([{number:1,title:5,body:'b'}]) → search-parse 문자열 필드 guard throw", () => {
      const badStdout = JSON.stringify([{ number: 1, title: 5, body: "b" }]);
      expect(() => parseRealDataResultIssueSearchOutput(badStdout)).toThrow();
    });

    it("(y) execStdout URL 미발견(빈 문자열) → post 파서 throw(runPlan.run 정상이어도 차단)", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(buildRunPlan(), ""),
      ).toThrow();
    });

    it("(y') execStdout /issues/0 → post 파서 assertPositiveIssueNumber throw(post 비식별)", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(
          buildRunPlan(),
          `https://github.com/${OWNER}/${REPO}/issues/0\n`,
        ),
      ).toThrow();
    });

    it("(z) 빈 results 배열 boundary — results=[] → stepArgs.publish.report.summary 가 count 0·totalVolume 0·전 difficulty 슬롯 0·전 contribution 슬롯 0(throw 0, degenerate case)이고 슬롯 key set 은 여전히 enum set-equal(미등장 분류도 키 존재). command-plan 재유도와 byte-identical, evaluation/resolve/post 정상 진행", () => {
      const seeds = defaultSeeds();
      const runPlan = buildRunPlan(seeds);
      const activities = defaultActivities();
      const stepArgs = buildRealDataE2eStepArgs(runPlan, activities, []);
      const summary = stepArgs.publish.report.summary;

      // 빈 results — count 0·totalVolume 0·전 슬롯 0(throw 아님).
      expect(summary.count).toBe(0);
      expect(summary.totalVolume).toBe(0);
      DIFFICULTIES.forEach((d) => {
        expect(summary.byDifficulty[d]).toBe(0);
      });
      CONTRIBUTION_LEVELS.forEach((c) => {
        expect(summary.byContribution[c]).toBe(0);
      });
      // 슬롯 key set 은 여전히 enum set-equal(미등장 분류도 키 존재).
      expect(
        isSetEqual(
          setOf(Object.keys(summary.byDifficulty)),
          setOf(DIFFICULTIES),
        ),
      ).toBe(true);
      expect(
        isSetEqual(
          setOf(Object.keys(summary.byContribution)),
          setOf(CONTRIBUTION_LEVELS),
        ),
      ).toBe(true);
      // command-plan 재유도와 byte-identical + production 위임과 byte-identical.
      const cmdPlan = buildRealDataResultIssueCommandPlan([], runPlan.run);
      expect(summary).toEqual(cmdPlan.report.summary);
      expect(summary).toEqual(buildRealDataResultSummary([]));

      // 빈 summary 가 18-way 의 다른 축을 차단하지 0 — evaluation/resolve/post 정상 진행.
      expect(stepArgs.evaluation.inputs).toHaveLength(activities.length);
      const resolveCreate = resolveRealDataResultIssueGhCommandPlan(
        "[]",
        stepArgs.publish.commandArgs,
      );
      expect(resolveCreate.action.action).toBe("create");
      const outcomeReport = buildRealDataResultOutcomeStepArgs(
        runPlan,
        execStdout(5),
      );
      expect(outcomeReport.issueNumber).toBe(5);
    });
  });

  describe("결정론·무공유·no-mutation — chain 두 번 호출 + 입력 불변 + summary 하위 분포 오염 0", () => {
    it("(aa) 동일 (seeds, modelId, run, activities, results, searchStdout, execStdout) chain 두 번 → runPlan/stepArgs/parsedHits/resolvePlan/outcomeReport 모두 deep-equal(결정론)", () => {
      const seeds = defaultSeeds();
      const chain1 = runChain([7, 13], seeds, buildRunPlan(seeds));
      const chain2 = runChain([7, 13], seeds, buildRunPlan(seeds));

      expect(chain1.stepArgs.evaluation).toEqual(chain2.stepArgs.evaluation);
      expect(chain1.stepArgs.publish).toEqual(chain2.stepArgs.publish);
      expect(chain1.stepArgs.publish.report.summary).toEqual(
        chain2.stepArgs.publish.report.summary,
      );
      expect(chain1.parsedHits).toEqual(chain2.parsedHits);
      expect(chain1.resolvePlan).toEqual(chain2.resolvePlan);
      expect(chain1.outcomeReport).toEqual(chain2.outcomeReport);
    });

    it("(bb) no-mutation — 입력 results(특히 각 result)·activities·run chain 호출 후 deep-equal(원본 불변)", () => {
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

    it("(cc) 무공유 — summary.byDifficulty/byContribution 하위 분포 객체 mutate(easy += 99) 후 새 chain 산출이 여전히 정상·results 오염 0(매 호출 새 summary·새 하위 분포 객체)", () => {
      const seeds = defaultSeeds();
      const activities = defaultActivities();
      const results = defaultResults();
      const resultsBefore = JSON.parse(JSON.stringify(results));

      const first = buildRealDataE2eStepArgs(
        buildRunPlan(seeds),
        activities,
        results,
      );
      // 반환 summary 하위 분포 mutate(오염 시도).
      first.publish.report.summary.byDifficulty.easy += 99;
      first.publish.report.summary.byContribution.high += 99;

      // 새 stepArgs 의 summary 는 여전히 정상(이전 호출 mutate 누설 0 — 매 호출 새 객체).
      const second = buildRealDataE2eStepArgs(
        buildRunPlan(seeds),
        activities,
        results,
      );
      expect(second.publish.report.summary).toEqual(
        buildRealDataResultSummary(results),
      );
      // 입력 results 오염 0(원본 불변).
      expect(results).toEqual(resultsBefore);
      // 두 summary 하위 분포 객체 무공유(별개 reference).
      expect(first.publish.report.summary.byDifficulty).not.toBe(
        second.publish.report.summary.byDifficulty,
      );
    });
  });

  describe("credential 누출 0(branch — §9 / R-59 / REQ-059 정합)", () => {
    it("(dd) stepArgs.publish.report.summary(직렬화)·descriptor·searchArgv(join)·evaluation(직렬화)·parsedHits·resolvePlan.argv(join)·commandArgs/outcomeReport.{url,summaryLine} 어디에도 credential 어휘 미등장. 특히 summary 가 식별자 카운트·enum 분포·정량 합산만 보유(raw·credential 어휘 미surface)", () => {
      const { runPlan, stepArgs, parsedHits, resolvePlan, outcomeReport } =
        runChain([7, 13]);
      const resolveCreate = resolveRealDataResultIssueGhCommandPlan(
        "[]",
        stepArgs.publish.commandArgs,
      );

      const surfaces: string[] = [
        JSON.stringify(stepArgs.publish.report.summary),
        JSON.stringify(stepArgs.publish.report.descriptor),
        JSON.stringify(stepArgs.evaluation),
        runPlan.pipeline.modelId,
        stepArgs.publish.searchArgv.join(" "),
        JSON.stringify(parsedHits),
        resolvePlan.argv.join(" "),
        resolveCreate.argv.join(" "),
        stepArgs.publish.commandArgs.createArgs.labels.join(" "),
        stepArgs.publish.commandArgs.createArgs.title,
        stepArgs.publish.commandArgs.createArgs.body,
        stepArgs.publish.commandArgs.searchQuery,
        outcomeReport.url,
        outcomeReport.summaryLine,
      ];

      const credentialPattern =
        /(GH_TOKEN|GITHUB_TOKEN|Bearer|Authorization|x-access-token|x-github-token|--token|--auth|ghp_[A-Za-z0-9]|PAT)/i;
      for (const surface of surfaces) {
        expect(surface).not.toMatch(credentialPattern);
      }
      // summary 직렬화는 식별자 카운트·enum 분포·정량 합산만 — narrative/message/diff
      // 같은 raw 본문 "key" 미surface(값이 아니라 key 부재로 변별 — "byDifficulty" 같은
      // 정규 key 의 부분문자열 오탐 회피). raw 본문 key 누설은 (e)의 key set set-equal 이
      // 이미 차단하므로 여기서는 summary 직렬화에 raw narrative 본문 문장이 없음을 명시.
      const summaryKeys = new Set(Object.keys(stepArgs.publish.report.summary));
      expect(summaryKeys.has("narrative")).toBe(false);
      expect(summaryKeys.has("message")).toBe(false);
      // outcome url 은 issue 경로만.
      expect(outcomeReport.url).not.toMatch(/commit|pull request/i);
    });
  });
});
