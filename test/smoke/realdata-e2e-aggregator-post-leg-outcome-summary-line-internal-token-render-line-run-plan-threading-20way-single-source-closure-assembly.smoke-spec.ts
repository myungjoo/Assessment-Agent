// realdata-e2e-aggregator-post-leg-outcome-summary-line-internal-token-render-line-run-plan-threading-20way-single-source-closure-assembly.smoke-spec.ts
// — 실 평가 e2e step④ aggregator post-leg outcomeReport.summaryLine internal-token
// render-line per-token 1:1 thread 합류 20-way single-source closure: 최외곽 진입
// `buildRealDataE2eRunPlan(seeds, modelId, run)` → `{pipeline, run}` 를 pre-실행
// aggregator `buildRealDataE2eStepArgs(runPlan, activities, results)` → `{evaluation,
// publish}` 에 통째로 넘긴 뒤, post-실행 측 `buildRealDataResultOutcomeStepArgs(runPlan,
// execStdout)` → `RealDataResultIssueOutcomeReport {issueNumber, url, gitSha, dateToken,
// summaryLine}` 로 닫는다. aggregator+resolve+post chain 이 산출한 post-leg
// `outcomeReport.summaryLine`(`[dateToken@gitSha] 결과 이슈 #N 박제 → url` 한 줄 확인
// 문자열)이 그 source `(runPlan.run, resolvePlan issueNumber N, execStdout url)` 로부터:
//   - production 위임 `buildRealDataResultIssueOutcomeReportFromOutput(execStdout,
//     runPlan.run).summaryLine` 와 **byte-identical**(toBe).
//   - spec-로컬 독립 토큰 재조립(`[${dateToken}@${gitSha}] 결과 이슈 #${N} 박제 → ${url}`)
//     과 **byte-identical**(toBe) — 토큰별(dateToken@gitSha 묶음 == runPlan.run, #N ==
//     resolvePlan.action.issueNumber == execStdout url 의 /issues/N, 종단 url 토큰 ==
//     parse 산출 url) 1:1 재유도.
//   - 토큰 위치-정합(접두 `[`·구분 `@`·`] 결과 이슈 #`·` 박제 → ` 리터럴 사이 인덱스
//     단조 증가).
// 임을 20번째 축으로 합류시킨다.
//
// post-leg summaryLine internal-token render-line 내부-shape 축(RealDataResultIssueOutcome
// Report → 한 줄 확인 문자열 토큰 깊이)은 T-0788 publish-leg descriptor.body render-line
// (summary 슬롯→markdown body 라인 1:1)의 **post-leg 대칭** 이다. 직전 sweep 17 smoke 는
// outcomeReport.summaryLine 을 오직 `.length>0`(non-empty) + `.toContain(runPlan.run.gitSha)`
// + `.toContain(runPlan.run.dateToken)` substring-contains 로만 단언했고, byte-identical
// 토큰-위치별 1:1 render-line·production from-output 위임 비교·`#N`==resolve issueNumber==
// url /issues/N 토큰 1:1 단언은 0 이었다. 본 spec 은 그것을 임의 run/N/url 의 토큰이
// summaryLine 의 정확한 위치로 byte-identical render 됨으로 일반화한다. 본 spec 은 그 1:1
// 축이 publish-leg descriptor.body render-line(축 19) + summary 내부-shape per-result
// 집계 + summary/descriptor top-level 재유도 + evaluation-leg input 내부-shape + collect-leg
// serviceIdentities 내부-shape + collectCallArgs/inputs top-level + callArgs.input 페어링 +
// modelId 공유 + search-json-fields↔parse-shape set-equal + number→resolve→post + search-argv
// 전체-벡터 + resolve-argv update/create + command-args labels/title/body + marker 3-축 +
// resolve issueNumber + post run-identity 와 같은 검증 source `(seeds, modelId, run,
// activities, results, exec-stdout)` 의 산물임을 한 chain 동시-호출로 closure 에 합류시킨다:
//   (축 20, 새 표면) outcomeReport.summaryLine == buildRealDataResultIssueOutcomeReport
//       FromOutput(execStdout, runPlan.run).summaryLine(byte-identical) == spec-로컬 독립
//       토큰 재조립(byte-identical), 토큰 `#N`==resolve issueNumber==url /issues/N·
//       `dateToken@gitSha`==runPlan.run·종단 url==parse url, 토큰 위치 인덱스 단조.
//   (축 19) stepArgs.publish.report.descriptor.body 가 renderRealDataResultSummaryMarkdown
//       (summary) 종단 포함 + formatRealDataResultSummaryLine(summary) 라인 포함(난이도 표
//       3행·기여도 표 4행 슬롯별 1:1·전 enum 슬롯 라인 존재/미등장 0).
//   (축 18) stepArgs.publish.report.summary == buildRealDataResultSummary(results) per-result 1:1.
//   (축 7/9) descriptor.body / summary == command-plan.report.* top-level 재유도.
//   (축 17) stepArgs.evaluation.inputs[i] == mapActivityToEvaluationInput(activities[i]).
//   (축 6) inputs == buildRealDataEvaluationInputs(activities) + callArgs.input 페어링.
//   (축 16) collect-leg serviceIdentities 내부-shape 1:1 + collectCallArgs top-level 재유도.
//   (축 14~15) set(searchArgv[6]) == set(PARSE_SHAPE_KEYS) == set(keys(hit)) + number thread.
//   (축 13) collect/evaluate modelId 공유.
//   (축 11~12) searchArgv 전체-벡터 + resolve-argv update/create 위치-정합.
//   (축 8~10) command-args labels 고정상수 + {create,update}Args.{title,body} == descriptor.{title,body}.
//   (축 2~3) marker 3-축 — descriptor.marker / commandArgs.searchQuery / searchArgv[4] 동일.
//   (축 1, 종단) marker → resolve issueNumber → post run-identity(동일 runPlan.run 전파).
//
// 이 20-way 가 검증 source `(seeds, modelId, run, activities, results, exec-stdout)`
// single-source 에서 한 chain 동시-호출로 수렴함이 search-or-update 멱등성(REQ-009)·raw
// 미보유 평가 결과 정합(REQ-032)·정성 분류 집계 정합(REQ-038)·raw 미저장(REQ-059)의
// aggregator-level "e2e 의 post-leg 가 박제 결과를 사람이 읽을 한 줄 확인 문자열로 render
// 하는 token 깊이까지 단일 검증 source(run-identity·issueNumber·url)에서 토큰-위치별 어긋남
// 0, narrative raw 는 confirmation 라인으로 새지 않음" 의 종단 닫음이다. e2e 의 post-leg
// render-line 깊이가 publish-leg descriptor.body render-line(19-way)의 대칭으로 closure 에
// 합류하는 seam slice 다(세 leg 내부-shape + publish-leg 표현-layer 렌더 깊이에 이어 post-leg
// 표현-layer 렌더 깊이 추가 — render-line 내부-shape closure 완성). (T-0789 박제, PLAN.md
// 109행 🟢 실 평가 e2e step④).
//
// 본 spec 의 존재 이유 — public CI gap 해소(post-leg summaryLine token render-line 1:1 축 합류):
//   - aggregator-* sweep smoke 17파일 전부 outcomeReport.summaryLine 을 `.length>0` +
//     `.toContain(runPlan.run.gitSha/dateToken)` substring-contains 만(byte-identical
//     토큰-위치 1:1·production from-output 위임 비교·`#N`==resolve issueNumber 토큰 1:1 0).
//   - outcome-report / from-output / summary-line-consistency helper spec 이 summaryLine
//     합성·토큰 정합을 박제했으나 aggregator(buildRealDataResultOutcomeStepArgs/
//     buildRealDataE2eStepArgs) chain 진입·resolve·publish-leg 미합류(post-leg 위임 helper
//     단독 spec).
//   - 본 spec 은 그 빈 자리를 채워 aggregator+post chain 이 산출한 outcomeReport.summaryLine
//     이 그 source 로부터 production from-output 위임과 byte-identical·토큰-위치별 1:1
//     render-line 임을 publish-leg descriptor.body render-line·summary 내부-shape·evaluation-
//     leg·collect-leg·command-args·resolve·marker 와 묶어 closure 에 합류시킨다.
//   - 사전 조사 결과 post-leg summaryLine 은 results 슬롯 집계를 미운반(format=`[dateToken@
//     gitSha] 결과 이슈 #N 박제 → url`, run-identity+issueNumber+url 토큰만)하므로 T-0788
//     Follow-up (a)의 "results→summary-line per-slot 집계" 가설은 거짓 — 본 task 는 그
//     대신 토큰-위치 render-line 1:1 을 distinct seam 으로 박제하고, 변별성 항으로 descriptor.
//     body 한 줄 요약(results 슬롯 토큰)과 distinct 임을 명시한다.
//   - live leg(실 prisma·실 collectForPerson·실 github.com fetch·실 LLM scoreUnit·실 gh
//     CLI 실행·DB·LAN gate)는 복제하지 않고, synthetic seeds/modelId/run + activities/
//     results literal + search-stdout/exec-stdout literal 을 컴포저들에 직접 공급해 live
//     leg 를 우회한다(조립 surface 만 검증). 따라서 본 spec 은:
//
//      🔥 실 gh 실행/실 이슈 박제 0 — summaryLine token 1:1 은 step④ 박제 후 확인 문자열
//         render shape 의 build-time 정합만 검증(실 gh exec·실 이슈 코멘트 박제 0).
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 helper export + production type/위임 import 재사용만.
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0789):
//   - src 변경 0(src/, prisma/, package.json, CI workflow, 환경 변수 추가 등 모두 금지).
//     test-only. production buildRealDataResultIssueOutcomeReportFromOutput·
//     parseRealDataResultIssueCreateEditOutput·renderRealDataResultSummaryMarkdown·
//     formatRealDataResultSummaryLine·buildRealDataResultSummary·RealDataResultIssueOutcome
//     Report·EvaluationResult·DIFFICULTIES·CONTRIBUTION_LEVELS 는 비교 source 로 import 만.
//   - 실 collectForPerson / 실 prisma write / 실 gh search·exec / 실 LLM scoreUnit 호출.
//     in-memory 합성 results / activities / search-stdout / exec-stdout 만.
//   - aggregator 19-way(publish-leg descriptor.body render-line + summary 내부-shape +
//     17축) 자체 재단언(T-0788 cover). 본 task 는 post-leg outcomeReport.summaryLine 의
//     internal-token render-line(토큰-위치별 1:1·production from-output byte-identical)을
//     20번째 축으로 합류시킨 부분만(19축은 20-way 묶음 표현용 — 재검증 아니라 동시-성립 확인).
//   - outcomeReport field-value(issueNumber.toBe(N)·{gitSha,dateToken}.toBe(runPlan.run))
//     또는 summaryLine substring-contains(.toContain(gitSha/dateToken)) 자체를 새 표면으로
//     재단언(T-0788 및 sweep sibling cover). 본 task 의 새 표면은 summaryLine 토큰-위치별
//     byte-identical 1:1 render-line·production from-output byte-identical.
//   - production buildRealDataResultIssueOutcomeReport·...FromOutput·parseRealDataResultIssue
//     CreateEditOutput 의 합성/파싱 로직 자체 재구현·내부 분기 재단언 0(helper spec cover).
//     aggregator+post chain 산출 summaryLine 이 production 위임 from-output 산출과 byte-
//     identical 임만 비교(위임 직접 호출해 expected 로 사용 — 토큰 재현은 spec-로컬 독립
//     조립으로 1:1 대조용만, helper 알고리즘 복제 0).
//   - assertRealDataResultIssueOutcomeReportSummaryLineConsistent / assertRealDataResult
//     OutcomeStepArgsConsistentWithSources self-guard 자체 재단언 0(consistency helper spec cover).
//   - post-leg results 집계 합류 가정(Follow-up (a))은 사전 조사로 거짓 판정됨 — summaryLine
//     은 results 슬롯 미운반. 본 task 는 토큰-위치별 render-line 1:1 을 distinct seam 으로 박제.
//   - summary 집계 로직 / EvaluationResult 도메인 shape / volume 산출 / enum 정의 재단언 0.
//   - title / marker 자체 합성 규칙·descriptor.body render-line 로직 재단언 0(20-way 묶음 항으로만).
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
import { buildRealDataResultIssueOutcomeReportFromOutput } from "../helpers/realdata-e2e-result-issue-outcome-report-from-output";
import { parseRealDataResultIssueCreateEditOutput } from "../helpers/realdata-e2e-result-issue-output-parse";
import { REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS } from "../helpers/realdata-e2e-result-issue-search-argv";
import { REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS } from "../helpers/realdata-e2e-result-issue-search-json-fields";
import { parseRealDataResultIssueSearchOutput } from "../helpers/realdata-e2e-result-issue-search-parse";
import { buildRealDataResultOutcomeStepArgs } from "../helpers/realdata-e2e-result-outcome-step-args";
import { buildRealDataResultSummary } from "../helpers/realdata-e2e-result-summary";
import { formatRealDataResultSummaryLine } from "../helpers/realdata-e2e-result-summary-line";
import { renderRealDataResultSummaryMarkdown } from "../helpers/realdata-e2e-result-summary-markdown";
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
  "cfg-realdata-e2e-aggregator-post-leg-outcome-summary-line-internal-token-render-line-run-plan-threading-smoke";

// 고정 결정론 분류 라벨 — command-args RESULT_ISSUE_LABELS = ["realdata-e2e","result"].
const EXPECTED_RESULT_ISSUE_LABELS = ["realdata-e2e", "result"];

// search-argv helper 가 산출하는 canonical 9-원소 전체-벡터(marker 위치만 입력 종속).
// 20-way 묶음 표현용 동시-성립 항(축 12). marker(index 4)는 commandArgs.searchQuery 로 채움.
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

// spec 로컬 set-equal 비교 — 양방향 포함(크기 동일 AND 한쪽 원소가 모두 다른 쪽에 존재).
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

// 본 task 의 핵심 새 표면(축 20) — spec-로컬 독립 summaryLine 토큰 재조립(production
// summaryLine helper 호출 0, source 슬롯을 spec 로컬 template 으로 직접 조립). production
// realdata-e2e-result-issue-outcome-report.ts(119행) 시그니처를 정확히 박제:
// `[${dateToken}@${gitSha}] 결과 이슈 #${issueNumber} 박제 → ${url}`. drift 0.
function expectedSummaryLine(
  dateToken: string,
  gitSha: string,
  issueNumber: number,
  url: string,
): string {
  return `[${dateToken}@${gitSha}] 결과 이슈 #${issueNumber} 박제 → ${url}`;
}

// spec-로컬 독립 슬롯 카운트(production helper 호출 0, results 를 filter 로 직접 카운트) —
// 19-way 묶음 항(publish-leg summary 내부-shape) cover 용.
function expectedDifficultyCount(
  results: EvaluationResult[],
  difficulty: Difficulty,
): number {
  return results.filter((r) => r.difficulty === difficulty).length;
}

function expectedContributionCount(
  results: EvaluationResult[],
  contribution: ContributionLevel,
): number {
  return results.filter((r) => r.contribution === contribution).length;
}

function expectedTotalVolume(results: EvaluationResult[]): number {
  return results.reduce((sum, r) => sum + r.volume, 0);
}

// publish-leg descriptor.body 묶음 항(축 19) — spec-로컬 독립 라인 재유도.
function expectedDifficultyRow(
  summary: ReturnType<typeof buildRealDataResultSummary>,
  difficulty: Difficulty,
): string {
  return `| ${difficulty} | ${summary.byDifficulty[difficulty]} |`;
}

function expectedContributionRow(
  summary: ReturnType<typeof buildRealDataResultSummary>,
  contribution: ContributionLevel,
): string {
  return `| ${contribution} | ${summary.byContribution[contribution]} |`;
}

// 기본 seeds — fixed 2-Person(myungjoo/leemgs) descriptor 배열. post-leg summaryLine 이
// 주축이라 collect-leg 는 묶음 항으로만 등장(seed-fixture 그대로).
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

// synthetic GithubActivity 1 건 — aggregator 의 evaluation leg 입력(축 17).
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

// synthetic ConfluenceActivity 1 건 — confluence→document routing 분기 cover(축 17).
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

// 유효 activities fixture — github commit·pr·issue·confluence page 4종 모두 1+ 원소(축 17).
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
      "synthetic evaluation narrative — aggregator post-leg outcomeReport.summaryLine internal-token render-line per-token 1:1 thread(outcomeReport.summaryLine 이 그 source (runPlan.run, resolve issueNumber N, execStdout url) 로부터 production buildRealDataResultIssueOutcomeReportFromOutput(execStdout, runPlan.run).summaryLine 와 byte-identical·spec-로컬 토큰 재조립과 byte-identical — #N==resolve issueNumber==url /issues/N·dateToken@gitSha==runPlan.run·종단 url==parse url 토큰-위치별 1:1)+publish-leg descriptor.body render-line+summary 내부-shape per-result 집계+summary/descriptor top-level 재유도+evaluation-leg input 내부-shape+collect-leg serviceIdentities+collectCallArgs top-level+inputs top-level+callArgs.input 페어링+modelId 공유+search-json-fields↔parse-shape set-equal+number→resolve→post+search-argv+resolve-argv+command-args-{title,body,labels}+descriptor+marker run-plan-threading 20-way closure smoke fixture",
    difficulty,
    contribution,
    volume,
  };
}

// 유효 results fixture(전 슬롯 cover·반복 슬롯) — difficulty 3 슬롯(easy×3·medium×2·hard×1)
// 모두 등장+반복, contribution 4 등급(zero×1·low×2·medium×1·high×2) 모두 등장+반복.
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
// searchStdout → parseRealDataResultIssueSearchOutput → resolve(update) → execStdout →
// buildRealDataResultOutcomeStepArgs 를 single-source(동일 seeds + modelId + run +
// activities + results)로 묶어 한 chain 으로 호출하는 헬퍼. 핵심 새 표면(축 20) =
// outcomeReport.summaryLine ↔ source 토큰(run·N·url) render-line per-token 1:1.
function runChain(
  hitsNumbers: number[],
  seeds: RealDataSeedDescriptor[] = defaultSeeds(),
  runPlan: RealDataE2eRunPlan = buildRunPlan(seeds),
  activities: Activity[] = defaultActivities(),
  results: EvaluationResult[] = defaultResults(),
  noisePrefix = "",
): {
  resolvedN: number;
  execOutput: string;
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

  // stage 2(search-parse) — searchStdout(marker hit 1+) → parsedHits.
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
  const execOutput = execStdout(resolvedN, noisePrefix);
  const outcomeReport = buildRealDataResultOutcomeStepArgs(runPlan, execOutput);

  return {
    resolvedN,
    execOutput,
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

describe("Smoke(non-gated): 실 평가 e2e step④ aggregator post-leg outcomeReport.summaryLine internal-token render-line per-token 1:1 thread 합류 20-way single-source closure buildRealDataE2eRunPlan → buildRealDataE2eStepArgs → parse → resolve(update) → buildRealDataResultOutcomeStepArgs(runPlan, execStdout) 가 산출한 outcomeReport.summaryLine 이 buildRealDataResultIssueOutcomeReportFromOutput(execStdout, runPlan.run).summaryLine byte-identical + spec-로컬 토큰 재조립 byte-identical(#N==resolve issueNumber==url /issues/N·dateToken@gitSha==runPlan.run·종단 url==parse url 토큰-위치별 1:1) + publish-leg descriptor.body render-line(19-way) + summary 내부-shape per-result 집계 + summary/descriptor top-level 재유도 + evaluation-leg input 내부-shape + collect-leg serviceIdentities 내부-shape + collectCallArgs/inputs top-level + callArgs.input 페어링 + modelId 공유 + search-json-fields↔parse-shape set-equal + number→resolve→post + search-argv 전체-벡터 + resolve-argv(update/create) + command-args labels/title/body + descriptor + marker 3-축 + resolve issueNumber + post run-identity ↔ 동일 (seeds, modelId, run, activities, results, exec-stdout) 한 chain 동시-호출 20축 동시 수렴 live-collect/live-gh/live-LLM 0 검증", () => {
  describe("happy path — aggregator 20-way chain 합성(outcomeReport.summaryLine 비어있지 않은 문자열·marker run token 포함 + 산출물 정상)", () => {
    it("(a) 유효 seeds + modelId + run + activities(github commit/pr/issue·confluence 4종 포함) + results(difficulty 3슬롯·contribution 4등급 모두 등장+반복) + searchStdout + execStdout → outcomeReport.summaryLine(비어있지 않은 문자열·marker run token 포함) / issueNumber(양수) / url(정상) / descriptor.body(정상) / parsedHits / resolvePlan(update) 모두 정상", () => {
      const activities = defaultActivities();
      const results = defaultResults();
      const { runPlan, stepArgs, parsedHits, resolvePlan, outcomeReport } =
        runChain([7, 13], defaultSeeds(), buildRunPlan(), activities, results);

      // post-leg outcomeReport 정상 — summaryLine 비어있지 않은 문자열·run token 포함.
      expect(typeof outcomeReport.summaryLine).toBe("string");
      expect(outcomeReport.summaryLine.length).toBeGreaterThan(0);
      expect(outcomeReport.summaryLine).toContain(expectedToken(runPlan.run));
      expect(outcomeReport.issueNumber).toBeGreaterThan(0);
      expect(typeof outcomeReport.url).toBe("string");
      expect(outcomeReport.url).toContain(
        `/issues/${outcomeReport.issueNumber}`,
      );

      // results 가 difficulty 3슬롯·contribution 4등급 모두 등장+반복임을 확인(전 슬롯 cover source).
      expect(new Set(results.map((r) => r.difficulty)).size).toBe(3);
      expect(new Set(results.map((r) => r.contribution)).size).toBe(4);

      // publish-leg/evaluation-leg 정상.
      const body = stepArgs.publish.report.descriptor.body;
      expect(typeof body).toBe("string");
      expect(body.length).toBeGreaterThan(0);
      expect(Array.isArray(stepArgs.evaluation.inputs)).toBe(true);
      expect(stepArgs.evaluation.inputs.length).toBeGreaterThan(0);
      expect(stepArgs.publish.searchArgv).toHaveLength(9);

      // stage 2~3 정상.
      expect(parsedHits.length).toBeGreaterThan(0);
      expect(resolvePlan.action.action).toBe("update");
    });
  });

  describe("summaryLine internal-token render-line per-token 1:1 수렴(branch — 핵심 불변식, 본 task 의 새 표면 — 축 20)", () => {
    it("(b) outcomeReport.summaryLine byte-identical(toBe) buildRealDataResultIssueOutcomeReportFromOutput(execStdout, runPlan.run).summaryLine(production 위임 직접 호출) AND spec-로컬 독립 토큰 재조립 `[${dateToken}@${gitSha}] 결과 이슈 #${N} 박제 → ${url}` 와 byte-identical(toBe)", () => {
      const { runPlan, execOutput, outcomeReport } = runChain([7, 13]);

      // 핵심 — production from-output 위임 직접 호출 산출 summaryLine 과 byte-identical.
      const fromOutput = buildRealDataResultIssueOutcomeReportFromOutput(
        execOutput,
        runPlan.run,
      );
      expect(outcomeReport.summaryLine).toBe(fromOutput.summaryLine);

      // spec-로컬 독립 토큰 재조립(production summaryLine helper 호출 0)과 byte-identical.
      expect(outcomeReport.summaryLine).toBe(
        expectedSummaryLine(
          runPlan.run.dateToken,
          runPlan.run.gitSha,
          outcomeReport.issueNumber,
          outcomeReport.url,
        ),
      );
    });
  });

  describe("dateToken@gitSha 토큰 위치-정합 수렴(branch — 핵심 불변식 2)", () => {
    it("(c) summaryLine 이 `[${dateToken}@${gitSha}]` 접두 토큰으로 시작(startsWith), indexOf(dateToken) < indexOf(gitSha)(dateToken 이 gitSha 앞·@ 구분), outcomeReport.{gitSha,dateToken} === runPlan.run.* (field-value 전파, 19-way 묶음 항 재확인)", () => {
      const { runPlan, outcomeReport } = runChain([7, 13]);
      const { dateToken, gitSha } = runPlan.run;
      const line = outcomeReport.summaryLine;

      expect(line.startsWith(`[${dateToken}@${gitSha}]`)).toBe(true);
      expect(line.indexOf(dateToken)).toBeLessThan(line.indexOf(gitSha));
      expect(line.indexOf(`${dateToken}@${gitSha}`)).toBeGreaterThanOrEqual(0);

      // field-value 전파(19-way 묶음 항 재확인).
      expect(outcomeReport.gitSha).toBe(gitSha);
      expect(outcomeReport.dateToken).toBe(dateToken);
    });
  });

  describe("issueNumber 토큰 cross-leg 1:1 수렴(branch — 핵심 불변식 3, REQ-009)", () => {
    it("(d) summaryLine 이 `결과 이슈 #${N}` 토큰 포함(toContain), 그 N === outcomeReport.issueNumber === resolvePlan.action.issueNumber(update) === parseRealDataResultIssueCreateEditOutput(execStdout).issueNumber === N(검증 source) — 단일 number 가 resolve+post+summaryLine render 토큰까지 1:1", () => {
      const N = 7;
      const { execOutput, resolvePlan, outcomeReport } = runChain([N, 13]);
      if (resolvePlan.action.action !== "update") {
        throw new Error("update action 기대");
      }
      const parsed = parseRealDataResultIssueCreateEditOutput(execOutput);

      expect(outcomeReport.summaryLine).toContain(`결과 이슈 #${N}`);
      expect(outcomeReport.issueNumber).toBe(N);
      expect(resolvePlan.action.issueNumber).toBe(N);
      expect(parsed.issueNumber).toBe(N);
    });
  });

  describe("url 종단 토큰 1:1 수렴(branch)", () => {
    it("(e) summaryLine 이 ` 박제 → ${url}` 종단 토큰으로 끝남(endsWith), outcomeReport.url === parseRealDataResultIssueCreateEditOutput(execStdout).url(byte-identical), url 이 `/issues/${N}` 포함", () => {
      const N = 13;
      const { execOutput, outcomeReport } = runChain([N]);
      const parsed = parseRealDataResultIssueCreateEditOutput(execOutput);

      expect(
        outcomeReport.summaryLine.endsWith(` 박제 → ${outcomeReport.url}`),
      ).toBe(true);
      expect(outcomeReport.url).toBe(parsed.url);
      expect(outcomeReport.url).toContain(`/issues/${N}`);
    });
  });

  describe("summaryLine 토큰 순서 위치-정합 수렴(branch)", () => {
    it("(f) summaryLine 토큰 등장 인덱스 단조 증가 — indexOf('[') < indexOf(dateToken) < indexOf('@') < indexOf(gitSha) < indexOf('] 결과 이슈 #') < indexOf(String(N)) < indexOf(' 박제 → ') < indexOf(url)(production template 순서)", () => {
      const N = 7;
      const { runPlan, outcomeReport } = runChain([N, 13]);
      const { dateToken, gitSha } = runPlan.run;
      const line = outcomeReport.summaryLine;
      const url = outcomeReport.url;

      const idxOpen = line.indexOf("[");
      const idxDate = line.indexOf(dateToken);
      const idxAt = line.indexOf("@");
      const idxSha = line.indexOf(gitSha);
      const idxIssue = line.indexOf("] 결과 이슈 #");
      const idxN = line.indexOf(String(N), idxIssue);
      const idxBakje = line.indexOf(" 박제 → ");
      const idxUrl = line.indexOf(url);

      expect(idxOpen).toBeLessThan(idxDate);
      expect(idxDate).toBeLessThan(idxAt);
      expect(idxAt).toBeLessThan(idxSha);
      expect(idxSha).toBeLessThan(idxIssue);
      expect(idxIssue).toBeLessThan(idxN);
      expect(idxN).toBeLessThan(idxBakje);
      expect(idxBakje).toBeLessThan(idxUrl);
    });
  });

  describe("post-leg summaryLine ↔ descriptor.body 한 줄 요약 변별성 수렴(branch — distinct surface 입증)", () => {
    it("(g) outcomeReport.summaryLine(run-identity+issueNumber+url 토큰) 이 formatRealDataResultSummaryLine(stepArgs.publish.report.summary)(descriptor.body 한 줄 요약, results 슬롯 토큰) 와 byte-identical 아님(not.toBe), post-leg summaryLine 은 results 슬롯 토큰(count=·volume=·난이도(...)=) 미포함(not.toContain), descriptor.body 한 줄 요약은 url·박제 →·#N post 토큰 미포함", () => {
      const N = 7;
      const { stepArgs, outcomeReport } = runChain([N, 13]);
      const descriptorSummaryLine = formatRealDataResultSummaryLine(
        stepArgs.publish.report.summary,
      );

      // 두 render-line 이 byte-identical 아님(distinct surface).
      expect(outcomeReport.summaryLine).not.toBe(descriptorSummaryLine);

      // post-leg summaryLine 은 results 슬롯 토큰 미포함.
      expect(outcomeReport.summaryLine).not.toContain("count=");
      expect(outcomeReport.summaryLine).not.toContain("volume=");
      expect(outcomeReport.summaryLine).not.toContain("난이도(");
      expect(outcomeReport.summaryLine).not.toContain("기여도(");

      // descriptor.body 한 줄 요약은 post 토큰(url·박제 →·#N) 미포함.
      expect(descriptorSummaryLine).not.toContain(outcomeReport.url);
      expect(descriptorSummaryLine).not.toContain("박제 →");
      expect(descriptorSummaryLine).not.toContain(`#${N}`);
    });
  });

  describe("summaryLine render-line 축 변별성 — (run, issueNumber, url) 종속·results/modelId/activities 비종속(branch)", () => {
    it("(h) 네 chain — (a)다른 run·(b)다른 N·(c)다른 results·(d)다른 modelId → outcomeReport.summaryLine 이 (a)·(b)에서만 달라지고(run·issueNumber/url 종속), (c)·(d)에서는 두 chain summaryLine byte-identical(results·modelId 비종속 — post-leg summaryLine 은 results 집계 미운반)", () => {
      const seeds = defaultSeeds();
      const baseActivities = defaultActivities();
      const baseResults = defaultResults();

      // base chain.
      const base = runChain(
        [7],
        seeds,
        buildRunPlan(seeds),
        baseActivities,
        baseResults,
      );

      // (a) 다른 run({gitSha,dateToken}) → summaryLine 달라짐.
      const altRun = runChain(
        [7],
        seeds,
        buildRunPlan(seeds, MODEL_ID, "zzz9999", "2099-12-31"),
        baseActivities,
        baseResults,
      );
      expect(altRun.outcomeReport.summaryLine).not.toBe(
        base.outcomeReport.summaryLine,
      );

      // (b) 다른 N(다른 execStdout url /issues/M) → summaryLine 달라짐.
      const altN = runChain(
        [99],
        seeds,
        buildRunPlan(seeds),
        baseActivities,
        baseResults,
      );
      expect(altN.outcomeReport.summaryLine).not.toBe(
        base.outcomeReport.summaryLine,
      );

      // (c) 다른 results(다른 difficulty/contribution 분포) → summaryLine byte-identical.
      const altResults: EvaluationResult[] = [
        syntheticResult("x1", "hard", "high", 99),
        syntheticResult("x2", "hard", "high", 1),
      ];
      const altResultsChain = runChain(
        [7],
        seeds,
        buildRunPlan(seeds),
        baseActivities,
        altResults,
      );
      expect(altResultsChain.outcomeReport.summaryLine).toBe(
        base.outcomeReport.summaryLine,
      );

      // (d) 다른 modelId → summaryLine byte-identical(modelId 비종속).
      const altModel = runChain(
        [7],
        seeds,
        buildRunPlan(seeds, "model-other"),
        baseActivities,
        baseResults,
      );
      expect(altModel.outcomeReport.summaryLine).toBe(
        base.outcomeReport.summaryLine,
      );

      // descriptor.body 한 줄 요약은 (c)에서 달라짐 — distinct surface 재확인.
      expect(
        formatRealDataResultSummaryLine(
          altResultsChain.stepArgs.publish.report.summary,
        ),
      ).not.toBe(
        formatRealDataResultSummaryLine(base.stepArgs.publish.report.summary),
      );
    });
  });

  describe("publish-leg descriptor.body render-line per-slot 1:1 수렴(branch — 19-way 묶음 항 — 축 19)", () => {
    it("(i) stepArgs.publish.report.descriptor.body 가 renderRealDataResultSummaryMarkdown(summary) 종단 포함(endsWith) + formatRealDataResultSummaryLine(summary) 라인 포함(includes), body split('\\n') 에 모든 d∈DIFFICULTIES `| d | byDifficulty[d] |` 3행 + 모든 c∈CONTRIBUTION_LEVELS `| c | byContribution[c] |` 4행 + count/volume 라인 슬롯별 1:1(전 enum 슬롯 존재/미등장 0)", () => {
      const results = defaultResults();
      const { stepArgs } = runChain(
        [7, 13],
        defaultSeeds(),
        buildRunPlan(),
        defaultActivities(),
        results,
      );
      const body = stepArgs.publish.report.descriptor.body;
      const summary = stepArgs.publish.report.summary;
      const bodyLines = body.split("\n");

      expect(body.endsWith(renderRealDataResultSummaryMarkdown(summary))).toBe(
        true,
      );
      expect(body.includes(formatRealDataResultSummaryLine(summary))).toBe(
        true,
      );

      DIFFICULTIES.forEach((d) => {
        expect(bodyLines).toContain(expectedDifficultyRow(summary, d));
      });
      CONTRIBUTION_LEVELS.forEach((c) => {
        expect(bodyLines).toContain(expectedContributionRow(summary, c));
      });
      expect(bodyLines).toContain(`- 평가 단위 수: ${summary.count}`);
      expect(bodyLines).toContain(`- 총 volume: ${summary.totalVolume}`);
    });
  });

  describe("publish-leg summary 내부-shape per-result 1:1 집계 + summary/descriptor top-level 재유도 수렴(branch — 묶음 항 — 축 18/9/7)", () => {
    it("(j) stepArgs.publish.report.summary deep-equal buildRealDataResultSummary(results), count===results.length·totalVolume===Σvolume, 모든 d byDifficulty[d]===filter count·모든 c byContribution[c]===filter count(forEach), descriptor.body/summary byte-identical command-plan.report.*", () => {
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
      const summary = stepArgs.publish.report.summary;
      const cmdPlan = buildRealDataResultIssueCommandPlan(results, runPlan.run);

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
      expect(stepArgs.publish.report.descriptor.body).toEqual(
        cmdPlan.report.descriptor.body,
      );
      expect(summary).toEqual(cmdPlan.report.summary);
    });
  });

  describe("evaluation-leg input 내부-shape 1:1 수렴(branch — 묶음 항 — 축 17)", () => {
    it("(k) 모든 i 에 대해 stepArgs.evaluation.inputs[i] deep-equal mapActivityToEvaluationInput(activities[i]), inputs[i].metadata === activities[i].metadata(reference), contributionKind R-30 routing(github commit/pr→code·issue→document·confluence→document)", () => {
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

  describe("collect-leg serviceIdentities 내부-shape + collectCallArgs top-level 재유도 수렴(branch — 묶음 항 — 축 16)", () => {
    it("(l) runPlan.pipeline.collectCallArgs deep-equal buildRealDataCollectCallArgs(seeds), 원소별 since===undefined·assessmentId===ASSESSMENT_ID_PLACEHOLDER, collectCallArgs[i].person.serviceIdentities 가 seeds[i] {service,externalId} 추림과 1:1", () => {
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

  describe("inputs top-level 재유도 + callArgs.input 페어링 + modelId 공유 수렴(branch — 묶음 항 — 축 6/13)", () => {
    it("(m) evaluation.inputs deep-equal buildRealDataEvaluationInputs(activities), callArgs[i].input === inputs[i](reference)·inputs.length === activities.length, runPlan.pipeline.modelId === modelId·모든 callArgs[i].options.modelId === runPlan.pipeline.modelId(forEach)", () => {
      const seeds = defaultSeeds();
      const runPlan = buildRunPlan(seeds);
      const activities = defaultActivities();
      const { stepArgs } = runChain([7, 13], seeds, runPlan, activities);

      expect(stepArgs.evaluation.inputs).toEqual(
        buildRealDataEvaluationInputs(activities),
      );
      expect(stepArgs.evaluation.inputs).toHaveLength(activities.length);
      stepArgs.evaluation.callArgs.forEach((c, i) => {
        expect(c.input).toBe(stepArgs.evaluation.inputs[i]);
      });

      expect(runPlan.pipeline.modelId).toBe(MODEL_ID);
      stepArgs.evaluation.callArgs.forEach((c) => {
        expect(c.options.modelId).toBe(runPlan.pipeline.modelId);
        expect(c.options.modelId).toBe(MODEL_ID);
      });
    });
  });

  describe("search-json-fields↔parse-shape set-equal + number→resolve→post→summaryLine thread 수렴(branch — 묶음 항 — 축 14~15)", () => {
    it("(n) set(searchArgv[6] split) == set(PARSE_SHAPE_KEYS) == set(keys(parsedHits[0])) set-equal, parsedHits[0].number(==N) === resolvePlan.action.issueNumber === outcomeReport.issueNumber → summaryLine `#N` 토큰 == N(number 가 search→resolve→post→render 토큰까지 1:1)", () => {
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
      expect(outcomeReport.issueNumber).toBe(N);
      expect(outcomeReport.summaryLine).toContain(`#${N}`);
    });
  });

  describe("search-argv 전체-벡터 + resolve-argv update/create + command-args labels/title/body + descriptor + marker + post 묶음 수렴(branch — 묶음 항 — 축 8~12 + 1~3)", () => {
    it('(o) searchArgv byte-identical canonical 9-벡터, hit N → resolvePlan.argv update argv, hit 0 → create argv, createArgs.labels deep-equal ["realdata-e2e","result"], create/update.{title,body} === descriptor.{title,body}, descriptor.marker === commandArgs.searchQuery === searchArgv[4], marker 가 dateToken@gitSha 포함, outcomeReport.{gitSha,dateToken} == runPlan.run, summaryLine dateToken@gitSha == marker run token', () => {
      const N = 7;
      const seeds = defaultSeeds();
      const runPlan = buildRunPlan(seeds);
      const { stepArgs, resolvePlan, outcomeReport } = runChain(
        [N, 13],
        seeds,
        runPlan,
      );
      const searchQuery = stepArgs.publish.commandArgs.searchQuery;
      const updateArgs = stepArgs.publish.commandArgs.updateArgs;
      const createArgs = stepArgs.publish.commandArgs.createArgs;
      const descriptor = stepArgs.publish.report.descriptor;
      const token = expectedToken(runPlan.run);

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

      expect(createArgs.labels).toEqual(EXPECTED_RESULT_ISSUE_LABELS);
      expect(createArgs.title).toBe(descriptor.title);
      expect(updateArgs.title).toBe(descriptor.title);
      expect(createArgs.body).toBe(descriptor.body);
      expect(updateArgs.body).toBe(descriptor.body);

      expect(descriptor.marker).toBe(searchQuery);
      expect(stepArgs.publish.searchArgv[4]).toBe(descriptor.marker);
      expect(descriptor.marker).toContain(token);
      expect(outcomeReport.gitSha).toBe(runPlan.run.gitSha);
      expect(outcomeReport.dateToken).toBe(runPlan.run.dateToken);
      // summaryLine dateToken@gitSha == marker run token(post-leg render-line ↔ marker).
      expect(outcomeReport.summaryLine).toContain(token);
    });
  });

  describe("20-way 단일-source 묶음 단언(branch — closure 종단, 본 task 의 종단 박제)", () => {
    it("(p) outcomeReport.summaryLine == from-output(execStdout, runPlan.run).summaryLine == spec-로컬 토큰 재조립(#N==resolve==url /issues/N·dateToken@gitSha==runPlan.run·종단 url==parse url), descriptor.body 가 renderRealDataResultSummaryMarkdown(summary) 종단 포함 + formatRealDataResultSummaryLine(summary) 라인 포함, summary == buildRealDataResultSummary(results), descriptor.body/summary == command-plan.report.*, inputs[i] == map(activities[i]), inputs == build(activities), callArgs[i].input===inputs[i], collectCallArgs serviceIdentities 1:1, collectCallArgs == build(seeds), set(searchArgv[6])==set(PARSE_SHAPE_KEYS)==set(keys(hit)) number==N==resolve==post==summaryLine #N, modelId 공유, searchArgv canonical, update argv title/body==descriptor==command-plan, marker run token==post==summaryLine 가 single-source 20-way 동시 성립", () => {
      const N = 7;
      const seeds = defaultSeeds();
      const runPlan = buildRunPlan(seeds);
      const activities = defaultActivities();
      const results = defaultResults();
      const stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results);
      const summary = stepArgs.publish.report.summary;
      const body = stepArgs.publish.report.descriptor.body;
      const bodyLines = body.split("\n");
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
      const execOutput = execStdout(resolveUpdate.action.issueNumber);
      const outcomeReport = buildRealDataResultOutcomeStepArgs(
        runPlan,
        execOutput,
      );
      const parsed = parseRealDataResultIssueCreateEditOutput(execOutput);
      const fromOutput = buildRealDataResultIssueOutcomeReportFromOutput(
        execOutput,
        runPlan.run,
      );

      // axis 20(새 표면) — post-leg summaryLine internal-token render-line per-token 1:1.
      expect(outcomeReport.summaryLine).toBe(fromOutput.summaryLine);
      expect(outcomeReport.summaryLine).toBe(
        expectedSummaryLine(
          runPlan.run.dateToken,
          runPlan.run.gitSha,
          outcomeReport.issueNumber,
          outcomeReport.url,
        ),
      );
      expect(outcomeReport.summaryLine).toContain(`결과 이슈 #${N}`);
      expect(
        outcomeReport.summaryLine.endsWith(` 박제 → ${outcomeReport.url}`),
      ).toBe(true);
      expect(outcomeReport.url).toBe(parsed.url);
      expect(outcomeReport.url).toContain(`/issues/${N}`);
      expect(outcomeReport.summaryLine.startsWith(`[${token}]`)).toBe(true);

      // axis 19 — publish-leg descriptor.body render-line.
      expect(body.endsWith(renderRealDataResultSummaryMarkdown(summary))).toBe(
        true,
      );
      expect(body.includes(formatRealDataResultSummaryLine(summary))).toBe(
        true,
      );
      DIFFICULTIES.forEach((d) => {
        expect(bodyLines).toContain(expectedDifficultyRow(summary, d));
      });
      CONTRIBUTION_LEVELS.forEach((c) => {
        expect(bodyLines).toContain(expectedContributionRow(summary, c));
      });

      // axis 18/9/7 — summary 내부-shape + top-level 재유도.
      expect(summary).toEqual(buildRealDataResultSummary(results));
      expect(body).toEqual(cmdPlan.report.descriptor.body);
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

      // axis 1 — run token 전파(marker → post → summaryLine).
      expect(marker).toContain(token);
      expect(outcomeReport.gitSha).toBe(runPlan.run.gitSha);
      expect(outcomeReport.dateToken).toBe(runPlan.run.dateToken);
      expect(`${runPlan.run.dateToken}@${runPlan.run.gitSha}`).toBe(token);
      expect(outcomeReport.summaryLine).toContain(token);
    });
  });

  describe("create/update 두 분기 격리 — summaryLine 은 N·url 종속·검색결과 외 비종속(branch)", () => {
    it("(q) 동일 seeds·modelId·run·activities·results, searchStdout 만 (hit 1+ → update 분기 N vs hit 0 → create 분기) 으로 달리해 → update 측은 resolve 가 찾은 N → execStdout(N) → summaryLine #N, create 측은 execStdout(M) → summaryLine #M. 두 chain 모두 summaryLine 이 자기 execStdout 의 issueNumber·url 로 1:1 render", () => {
      const seeds = defaultSeeds();
      const runPlan = buildRunPlan(seeds);
      const activities = defaultActivities();
      const results = defaultResults();
      const stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results);
      const marker = stepArgs.publish.report.descriptor.marker;

      // update 분기 — hit 1+건(N=7).
      const N = 7;
      const resolveUpdate = resolveRealDataResultIssueGhCommandPlan(
        multiHitStdout(marker, [N, 13]),
        stepArgs.publish.commandArgs,
      );
      expect(resolveUpdate.argv[1]).toBe("edit");
      const updateExec = execStdout(N);
      const updateReport = buildRealDataResultOutcomeStepArgs(
        runPlan,
        updateExec,
      );

      // create 분기 — hit 0건 → 새 이슈 생성 → execStdout(M).
      const M = 51;
      const resolveCreate = resolveRealDataResultIssueGhCommandPlan(
        "[]",
        stepArgs.publish.commandArgs,
      );
      expect(resolveCreate.argv[1]).toBe("create");
      const createExec = execStdout(M);
      const createReport = buildRealDataResultOutcomeStepArgs(
        runPlan,
        createExec,
      );

      // 두 chain 모두 자기 execStdout 의 issueNumber·url 로 1:1 render(분기별 N/M 정합).
      expect(updateReport.summaryLine).toContain(`결과 이슈 #${N}`);
      expect(updateReport.summaryLine).toBe(
        expectedSummaryLine(
          runPlan.run.dateToken,
          runPlan.run.gitSha,
          N,
          updateReport.url,
        ),
      );
      expect(createReport.summaryLine).toContain(`결과 이슈 #${M}`);
      expect(createReport.summaryLine).toBe(
        expectedSummaryLine(
          runPlan.run.dateToken,
          runPlan.run.gitSha,
          M,
          createReport.url,
        ),
      );
      // 두 summaryLine 은 issueNumber/url 만 달라짐(run token 동일).
      expect(updateReport.summaryLine).not.toBe(createReport.summaryLine);
      expect(
        updateReport.summaryLine.startsWith(`[${expectedToken(runPlan.run)}]`),
      ).toBe(true);
      expect(
        createReport.summaryLine.startsWith(`[${expectedToken(runPlan.run)}]`),
      ).toBe(true);
    });
  });

  describe("error path / negative cases — boundary 거부 대칭 박제(R-112 negative 충분 cover)", () => {
    it("(r) run.gitSha 빈('') → buildRealDataE2eRunPlan run guard throw(post-leg 도달 전 차단)", () => {
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

    it("(s) run.dateToken 빈('') → run guard throw 대칭", () => {
      const seeds = defaultSeeds();
      expect(() =>
        buildRealDataE2eRunPlan(seeds, MODEL_ID, {
          gitSha: "abc1234",
          dateToken: "",
        }),
      ).toThrow();
    });

    it("(t) modelId 빈('') → buildRealDataE2eRunPlan modelId guard throw", () => {
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

    it("(x) execStdout URL 미발견(빈 문자열) → buildRealDataResultOutcomeStepArgs 위임 post 파서 throw(runPlan.run 정상이어도 차단)", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(buildRunPlan(), ""),
      ).toThrow();
    });

    it("(x') execStdout URL issueNumber 비양수(/issues/0) → post 파서 assertPositiveIssueNumber throw", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(
          buildRunPlan(),
          `https://github.com/${OWNER}/${REPO}/issues/0\n`,
        ),
      ).toThrow();
    });

    it("(x'') execStdout URL 이 /pull/ PR URL → post 파서 throw(비-issue 경로 차단)", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(
          buildRunPlan(),
          `https://github.com/${OWNER}/${REPO}/pull/7\n`,
        ),
      ).toThrow();
    });

    it("(y) 빈 results 배열 boundary — results=[] → outcomeReport.summaryLine 은 results 비종속이므로 정상 render(throw 0): summaryLine 이 여전히 토큰-위치 1:1·from-output byte-identical(빈 results 가 어느 토큰도 바꾸지 0), descriptor.body 측은 전 슬롯 0 라인 render", () => {
      const seeds = defaultSeeds();
      const runPlan = buildRunPlan(seeds);
      const activities = defaultActivities();
      const N = 5;
      // 빈 results 로 stepArgs 합성(throw 0).
      const stepArgs = buildRealDataE2eStepArgs(runPlan, activities, []);
      const execOutput = execStdout(N);
      const outcomeReport = buildRealDataResultOutcomeStepArgs(
        runPlan,
        execOutput,
      );

      // post-leg summaryLine 은 빈 results 에 비종속 — 토큰-위치 1:1·from-output byte-identical.
      const fromOutput = buildRealDataResultIssueOutcomeReportFromOutput(
        execOutput,
        runPlan.run,
      );
      expect(outcomeReport.summaryLine).toBe(fromOutput.summaryLine);
      expect(outcomeReport.summaryLine).toBe(
        expectedSummaryLine(
          runPlan.run.dateToken,
          runPlan.run.gitSha,
          N,
          outcomeReport.url,
        ),
      );
      expect(outcomeReport.summaryLine).toContain(`결과 이슈 #${N}`);

      // descriptor.body 측은 전 슬롯 0 라인 render(degenerate).
      const body = stepArgs.publish.report.descriptor.body;
      const bodyLines = body.split("\n");
      DIFFICULTIES.forEach((d) => {
        expect(bodyLines).toContain(`| ${d} | 0 |`);
      });
      CONTRIBUTION_LEVELS.forEach((c) => {
        expect(bodyLines).toContain(`| ${c} | 0 |`);
      });
      expect(bodyLines).toContain("- 평가 단위 수: 0");
      expect(bodyLines).toContain("- 총 volume: 0");
    });
  });

  describe("결정론·무공유·no-mutation — chain 두 번 호출 + 입력 불변 + outcomeReport.summaryLine 오염 0", () => {
    it("(z) 동일 (seeds, modelId, run, activities, results, searchStdout, execStdout) chain 두 번 → runPlan/stepArgs/parsedHits/resolvePlan/outcomeReport 모두 deep-equal(결정론)", () => {
      const seeds = defaultSeeds();
      const chain1 = runChain([7, 13], seeds, buildRunPlan(seeds));
      const chain2 = runChain([7, 13], seeds, buildRunPlan(seeds));

      expect(chain1.stepArgs.evaluation).toEqual(chain2.stepArgs.evaluation);
      expect(chain1.stepArgs.publish).toEqual(chain2.stepArgs.publish);
      expect(chain1.parsedHits).toEqual(chain2.parsedHits);
      expect(chain1.resolvePlan).toEqual(chain2.resolvePlan);
      expect(chain1.outcomeReport).toEqual(chain2.outcomeReport);
      expect(chain1.outcomeReport.summaryLine).toBe(
        chain2.outcomeReport.summaryLine,
      );
    });

    it("(aa) no-mutation — 입력 results·activities·run chain 호출 후 deep-equal(원본 불변)", () => {
      const seeds = defaultSeeds();
      const activities = defaultActivities();
      const results = defaultResults();
      const run = { gitSha: "abc1234", dateToken: "2026-06-29" };
      const activitiesBefore = JSON.parse(JSON.stringify(activities));
      const resultsBefore = JSON.parse(JSON.stringify(results));
      const runBefore = JSON.parse(JSON.stringify(run));

      const runPlan = buildRealDataE2eRunPlan(seeds, MODEL_ID, run);
      const stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results);
      const searchStdout = multiHitStdout(
        stepArgs.publish.report.descriptor.marker,
        [7],
      );
      parseRealDataResultIssueSearchOutput(searchStdout);
      buildRealDataResultOutcomeStepArgs(runPlan, execStdout(7));

      expect(activities).toEqual(activitiesBefore);
      expect(results).toEqual(resultsBefore);
      expect(run).toEqual(runBefore);
    });

    it("(bb) 무공유 — outcomeReport 필드 mutate(issueNumber += 99) 후 새 chain 산출이 여전히 정상·입력 오염 0(매 호출 새 outcomeReport 객체·summaryLine 문자열 immutable)", () => {
      const seeds = defaultSeeds();
      const run = { gitSha: "abc1234", dateToken: "2026-06-29" };
      const runBefore = JSON.parse(JSON.stringify(run));
      const runPlan = buildRealDataE2eRunPlan(seeds, MODEL_ID, run);

      const first = buildRealDataResultOutcomeStepArgs(runPlan, execStdout(7));
      const firstSummaryLine = first.summaryLine;
      // outcomeReport 필드 mutate 시도(오염 시도) — summaryLine 은 이미 합성된 문자열이라 불변.
      first.issueNumber += 99;
      first.gitSha = "TAMPERED";

      // 새 outcomeReport 는 여전히 정상(이전 호출 mutate 누설 0).
      const second = buildRealDataResultOutcomeStepArgs(runPlan, execStdout(7));
      expect(second.summaryLine).toBe(firstSummaryLine);
      expect(second.gitSha).toBe("abc1234");
      expect(second.issueNumber).toBe(7);
      // 두 outcomeReport 무공유(별개 객체).
      expect(first).not.toBe(second);
      // 입력 run 오염 0(원본 불변).
      expect(run).toEqual(runBefore);
    });
  });

  describe("credential 누출 0(branch — §9 / R-59 / REQ-059 정합)", () => {
    it("(cc) outcomeReport.summaryLine·url·descriptor.body(직렬화)·summary·searchArgv(join)·evaluation(직렬화)·parsedHits·resolvePlan.argv(join) 어디에도 credential 어휘 미등장. 특히 summaryLine 이 run-identity·issueNumber·url 토큰만 보유(raw narrative·results 슬롯·credential 어휘 미surface)", () => {
      const { runPlan, stepArgs, parsedHits, resolvePlan, outcomeReport } =
        runChain([7, 13]);
      const resolveCreate = resolveRealDataResultIssueGhCommandPlan(
        "[]",
        stepArgs.publish.commandArgs,
      );

      const surfaces: string[] = [
        outcomeReport.summaryLine,
        outcomeReport.url,
        stepArgs.publish.report.descriptor.body,
        JSON.stringify(stepArgs.publish.report.summary),
        JSON.stringify(stepArgs.evaluation),
        runPlan.pipeline.modelId,
        stepArgs.publish.searchArgv.join(" "),
        JSON.stringify(parsedHits),
        resolvePlan.argv.join(" "),
        resolveCreate.argv.join(" "),
      ];

      const credentialPattern =
        /(GH_TOKEN|GITHUB_TOKEN|Bearer|Authorization|x-access-token|x-github-token|--token|--auth|ghp_[A-Za-z0-9]|PAT)/i;
      for (const surface of surfaces) {
        expect(surface).not.toMatch(credentialPattern);
      }

      // summaryLine 은 run-identity·issueNumber·url 토큰만 — raw narrative·results 슬롯 미surface.
      expect(outcomeReport.summaryLine).not.toContain(
        "synthetic evaluation narrative",
      );
      expect(outcomeReport.summaryLine).not.toContain("github:github.com:c1");
      expect(outcomeReport.summaryLine).not.toContain("count=");
      // url 은 issue 경로만(commit/pull 미surface).
      expect(outcomeReport.url).not.toMatch(/commit|pull request/i);
    });
  });
});
