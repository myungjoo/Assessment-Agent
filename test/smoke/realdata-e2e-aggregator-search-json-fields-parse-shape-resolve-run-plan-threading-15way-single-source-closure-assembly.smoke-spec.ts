// realdata-e2e-aggregator-search-json-fields-parse-shape-resolve-run-plan-threading-15way-single-source-closure-assembly.smoke-spec.ts
// — 실 평가 e2e step④ aggregator search-json-fields↔parse-shape 합류 15-way single-source closure:
// 최외곽 진입 `buildRealDataE2eRunPlan(seeds, modelId, run)` → `{pipeline, run}` →
// aggregator `buildRealDataE2eStepArgs(runPlan, activities, results)` → `{evaluation, publish}`
// 가 산출하는 publish-leg `stepArgs.publish.searchArgv` 의 `--json` 요청-필드 토큰
// (searchArgv[6] === "number,title,body")을 spec 로컬에서 `,` split·trim 한 `Set` 이:
//   (a) `REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS`(["number","title","body"], helper
//       export const) 집합과 set-equal(요청한 `--json` 필드 == 추출 shape 정규 키), AND
//   (b) `searchStdout` 으로부터 `parseRealDataResultIssueSearchOutput(searchStdout)` 가 실제
//       파싱한 각 hit 의 `Object.keys(hit)` 집합과 set-equal(요청한 필드 == 실 파싱 산물 키 —
//       gh 응답에 추가 필드 섞여도 {number,title,body} 만 정규화),
// 그리고 그 set 의 `number` 필드 값(parsedHits[0].number==N)이 resolve action issueNumber →
// argv[2] → post issueNumber 로 thread 됨을 15번째 축으로 합류시킨다.
//
// search-json-fields↔parse-shape set-equality 축은 e2e 의 search 요청-측(argv `--json`)과
// 응답-파싱-측(hit shape) 이 단일 검증 source 에서 set-equal 로 맞물리는 seam 으로, T-0782
// 13-way 가 잡은 searchArgv[6] positional 리터럴 string 단언(`toBe`)과 distinct surface 다 —
// 13-way 는 `--json` 토큰의 리터럴 동일성만, 본 spec 은 그것을 set 으로 split 후 PARSE_SHAPE_KEYS
// 집합·실 파싱 hit 키 집합과 양방향 set-equal 로 확장하고, 추가 필드 섞인 응답에도 추출-shape 가
// 요청-필드 upper bound 임을 변별한다. 본 spec 은 그 set-equality 축이 collect-leg·evaluate-leg·
// publish-leg·resolve·post 와 같은 검증 source(seeds+modelId+run+activities+results)의 산물임을
// 한 chain 동시-호출로 closure 에 합류시킨다:
//   (축 15, 새 표면) set(searchArgv[6] split by ',') == set(REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_
//       SHAPE_KEYS) == set(Object.keys(parsedHits[i])) (요청-필드 == 추출-shape == 실 파싱 키
//       set-equal) AND 그 set 의 'number' 값(parsedHits[0].number==N) → resolve issueNumber →
//       argv[2] → post issueNumber thread.
//   (축 14) runPlan.pipeline.collectCallArgs == buildRealDataCollectCallArgs(seeds) 재유도 +
//       collect/evaluate modelId 공유.
//   (축 13) searchArgv 전체-벡터 위치-정합.
//   (축 12) resolvePlan.argv 위치-정합(update/create 두 분기).
//   (축 9~11) command-args createArgs.labels 고정상수 + {create,update}Args.{title,body} 두
//       경로 == descriptor.{title,body}.
//   (축 6~8) descriptor.{title,body}·summary command-plan 경유 재유도 byte-identical.
//   (축 4~5) evaluation.inputs == buildRealDataEvaluationInputs(activities), callArgs[i].input
//       === inputs[i].
//   (축 2~3) marker 3-축 — descriptor.marker / commandArgs.searchQuery / searchArgv[4] 동일.
//   (축 1, 종단) marker → resolve issueNumber → post run-identity(동일 runPlan.run 전파).
//
// 이 15-way 가 검증 source `(seeds, modelId, run, activities, results)` single-source 에서 한
// chain 동시-호출로 수렴함이 search-or-update 멱등성(REQ-009)·raw 미보유 평가 입력/결과 집계
// 정합(REQ-032)·결과 리포트 재실행 정합(REQ-037)·credential 미보유(REQ-059)의 aggregator-level
// "aggregator 가 search 로 요청한 `--json` 필드 == 그 다음 단계 parse 가 추출하는 hit shape ==
// 실 파싱 산물 키, 그 number 가 resolve→post 로 어긋남 0 thread" 의 종단 닫음이다. e2e 의 search
// 요청-측(argv)과 응답-파싱-측(hit shape) 이 단일 검증 source 에서 set-equal 로 맞물리는 seam
// slice. (T-0784 박제, PLAN.md 109행 🟢 실 평가 e2e step④).
//
// 본 spec 의 존재 이유 — public CI gap 해소(search-json-fields↔parse-shape set-equal 축 합류):
//   - aggregator-* sweep smoke 14파일(4~14-way) 중 `--json` 토큰 split 집합 == PARSE_SHAPE_KEYS
//     집합 == 실 파싱 hit 키 집합 의 set-equal 단언 0(13-way 는 searchArgv[6] positional 리터럴
//     string `toBe` 만).
//   - search-json-fields self-guard(assertRealDataResultIssueSearchJsonFieldsMatchParseShape,
//     T-0657) + search-argv 빌더 self-wire 가 round-trip 을 박제했으나 aggregator
//     (buildRealDataE2eStepArgs) 진입·실 search-parse·resolve·post 미합류(빌더 단독 self-guard).
//   - search-parse spec 은 {number,title,body} 정규화를 박제했으나 aggregator 가 요청한
//     searchArgv `--json` 필드와의 set-equal 합류 0(파서 단독, argv-요청-측 미연결).
//   - 본 spec 은 그 빈 자리를 채워 aggregator 가 산출한 searchArgv[6](`--json` 요청-필드)가 그
//     다음 단계 search-parse 가 추출하는 hit shape 키와 set-equal 임을, 그 number 가 resolve→post
//     로 thread 됨을 collect-leg·evaluate-leg·publish-leg 와 묶어 closure 에 합류시킨다.
//   - live leg(실 prisma·실 collectForPerson·실 github.com fetch·실 LLM scoring·실 gh CLI 실행·
//     DB·LAN gate)는 복제하지 않고, synthetic seeds/modelId/run + activities/results literal +
//     search-stdout/exec-stdout literal 을 컴포저들에 직접 공급해 live leg 를 우회한다(조립 surface
//     만 검증). 따라서 본 spec 은:
//
//      🔥 실 gh search issues 호출 0 — `--json` 요청-필드↔parse-shape 는 build-time 정합만
//         검증(실 gh 응답 0). 실 collectForPerson / fetch / LLM / DB 0.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 helper export 재사용만(가드/helper 신설 0).
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0784):
//   - src 변경 0(src/, prisma/, package.json, CI workflow, 환경 변수 추가 등 모두 금지). test-only.
//   - 실 gh search issues 호출 / 실 execFile('gh', ...) / 실 collectForPerson / 실 LLM scoreUnit /
//     실 issue 검색·박제. in-memory 합성 search-stdout / exec-stdout 만.
//   - aggregator 14-way(collect-leg collectCallArgs 재유도 + collect/evaluate modelId 공유 +
//     search-argv 전체-벡터 위치-정합 + resolve-argv + command-args + descriptor + summary +
//     inputs + marker + resolve + post) 자체 재단언(T-0783 cover). 본 task 는 searchArgv[6]
//     `--json` 토큰 split 집합 == PARSE_SHAPE_KEYS 집합 == 실 파싱 hit 키 집합 set-equal + 그
//     number 가 resolve→post 로 thread 됨을 15번째 축으로 합류시킨 부분만(나머지 축은 15-way
//     묶음 표현용 동시-성립).
//   - search-json-fields self-guard(assertRealDataResultIssueSearchJsonFieldsMatchParseShape,
//     T-0657) 자체 재단언(빌더 spec cover). aggregator chain 진입 후 set-equal 만(가드 내부
//     round-trip 로직 재검증 0). splitRequestedFieldsIntoSet internal 함수 직접 import 금지
//     (unexported — spec 로컬 split 사용).
//   - search-parse(parseRealDataResultIssueSearchOutput) 의 number/title/body 검증 로직 자체
//     재단언(search-parse spec cover). 파싱 산출 hit 의 Object.keys 집합만 set-equal 비교에 사용.
//   - 난이도별 modelId routing(R-97 deferred) 검증 0 — 단일 modelId 동형(ADR-0048)만.
//   - REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS·PARSE_SHAPE_KEYS·RESULT_ISSUE_LABELS 값 정책
//     변경/재정의 0 — helper 박제 현재 값 그대로 단언만.
//   - DB 의존 / live-LLM·실 fetch·실 gh CLI·실 collectForPerson 0.
//   - 새 helper 모듈 신설 / 기존 helper 수정 — test-only(신규 smoke spec 1 파일).
import type { GithubActivity } from "../../src/assessment-collection/domain/activity";
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
  "cfg-realdata-e2e-aggregator-search-json-fields-parse-shape-run-plan-threading-smoke";

const INSTANCE_KEY = "github.com";

// 고정 결정론 분류 라벨 — command-args.ts RESULT_ISSUE_LABELS = ["realdata-e2e","result"]
// 가 박제한 현재 값. create 분기 argv 의 `--label` flag-pair 로 전개될 expected.
const EXPECTED_RESULT_ISSUE_LABELS = ["realdata-e2e", "result"];

// search-argv helper 가 산출하는 canonical 9-원소 전체-벡터(marker 위치만 입력 종속). 15-way
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

// spec 로컬 set-equal 비교 — internal splitRequestedFieldsIntoSet import 금지(unexported)이므로
// `searchArgv[6].split(',').map(t=>t.trim())` 로 직접 split 한 결과 등을 양방향 포함으로 비교.
// (크기 동일 AND 한쪽 원소가 모두 다른 쪽에 존재 — 순서·중복 무관 set-equality).
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
// internal helper(splitRequestedFieldsIntoSet) import 금지 — spec 로컬 split.
function splitJsonFieldsToken(token: string): Set<string> {
  return setOf(token.split(",").map((field) => field.trim()));
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
  dateToken = "2026-06-29",
): RealDataE2eRunPlan {
  return buildRealDataE2eRunPlan(seeds, modelId, { gitSha, dateToken });
}

// synthetic GithubActivity 1 건 — aggregator 의 evaluation leg 입력. callArgs 가 1+ 원소를
// 갖도록 보장(collect-leg modelId thread 도착지).
function syntheticActivity(
  author: string,
  externalId = "realdata-e2e-aggregator-search-json-fields-c1",
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
      "aggregator-search-json-fields-c1",
      "commit",
    ),
    syntheticActivity(firstUsername, "aggregator-search-json-fields-p1", "pr"),
    syntheticActivity(
      firstUsername,
      "aggregator-search-json-fields-i1",
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
      "synthetic evaluation narrative — aggregator search-json-fields(set(searchArgv[6] split)==set(PARSE_SHAPE_KEYS)==set(Object.keys(hit)))+parse-shape number→resolve→post thread+collect-leg+search-argv+resolve-argv+command-args-{title,body,labels}+descriptor-{title,body}+results-summary+evaluation-inputs+marker run-plan-threading 15-way closure smoke fixture",
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
// — 동일 run 이슈가 이미 존재하는 경우(resolve update 분기 유발). 정규 {number,title,body} 만.
function multiHitStdout(marker: string, numbers: number[]): string {
  return JSON.stringify(
    numbers.map((n, i) => ({
      number: n,
      title: `결과 이슈(#${i})`,
      body: `본문 ${i}\n${marker}\n끝`,
    })),
  );
}

// gh 응답에 요청한 적 없는 추가 필드(url,state)를 섞은 search stdout 합성 헬퍼 — search-parse
// 가 {number,title,body} 만 추출(추가 필드 drop)함을 검증하는 set-equal upper-bound 변별 source.
function noisyHitStdout(marker: string, numbers: number[]): string {
  return JSON.stringify(
    numbers.map((n, i) => ({
      number: n,
      title: `결과 이슈(#${i})`,
      body: `본문 ${i}\n${marker}\n끝`,
      url: `https://github.com/${OWNER}/${REPO}/issues/${n}`,
      state: "open",
      author: "ignored-extra-field",
    })),
  );
}

// synthetic gh issue edit stdout 합성 헬퍼 — `gh issue edit <N>` 의 stdout 은
// https://github.com/<owner>/<repo>/issues/<N> URL 한 줄을 포함.
function execStdout(n: number, noisePrefix = ""): string {
  return `${noisePrefix}https://github.com/${OWNER}/${REPO}/issues/${n}\n`;
}

// 최외곽 진입 buildRealDataE2eRunPlan(seeds, modelId, run) → aggregator buildRealDataE2eStepArgs
// (runPlan, activities, results) → searchStdout(N 담은 hit JSON 배열) → parseRealDataResultIssue
// SearchOutput(searchStdout) → resolve(searchStdout + stepArgs.publish.commandArgs) → post
// (buildRealDataResultOutcomeStepArgs(runPlan, execStdout))를 single-source(동일 seeds + modelId
// + run + activities + results + N)로 묶어 한 chain 으로 호출하는 헬퍼. 핵심 새 표면(축 15) =
// set(searchArgv[6] split) == set(PARSE_SHAPE_KEYS) == set(Object.keys(parsedHits[i])) + number
// thread.
function runChain(
  hitsNumbers: number[],
  seeds: RealDataSeedDescriptor[] = defaultSeeds(),
  runPlan: RealDataE2eRunPlan = buildRunPlan(seeds),
  activities: GithubActivity[] = defaultActivities(seeds),
  results: EvaluationResult[] = defaultResults(),
  noisePrefix = "",
): {
  resolvedN: number;
  seeds: RealDataSeedDescriptor[];
  runPlan: RealDataE2eRunPlan;
  activities: GithubActivity[];
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

describe("Smoke(non-gated): 실 평가 e2e step④ aggregator search-json-fields↔parse-shape 합류 15-way single-source closure buildRealDataE2eRunPlan → buildRealDataE2eStepArgs → set(stepArgs.publish.searchArgv[6] split by ',') == set(REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS) == set(Object.keys(parsedHits[i]))(요청-필드 == 추출-shape == 실 파싱 키 set-equal) + parse-shape number(parsedHits[0].number==N) → resolve issueNumber → argv[2] → post issueNumber thread + collect-leg collectCallArgs 재유도 + collect/evaluate modelId 공유 + search-argv 전체-벡터 위치-정합 + resolve-argv 위치-정합(update/create) + command-args labels 고정상수 + command-args {title,body} 두 경로(=descriptor.{title,body}) + descriptor.{title,body}·summary 재유도 + evaluation {inputs(=buildRealDataEvaluationInputs(activities), callArgs[i].input===inputs[i])} + marker 3-축 + resolve issueNumber + post run-identity ↔ 동일 (seeds, modelId, run, activities, results, search-stdout, exec-stdout) 한 chain 동시-호출 15축 동시 수렴 live-gh/live-collect/live-LLM 0 검증", () => {
  describe("happy path — aggregator 15-way chain 합성(searchArgv 길이 9·parsedHits 비어있지 않음·resolvePlan update·outcomeReport 5필드)", () => {
    it("(a) 유효 seeds + modelId + run + activities + results + searchStdout + execStdout → stepArgs.publish({report,commandArgs,searchArgv(길이 9)} 정상) / parsedHits(비어있지 않은 배열) / resolvePlan(update {action,issueNumber} + 비어있지 않은 string[] argv) / outcomeReport(5필드) 모두 정상", () => {
      const seeds = defaultSeeds();
      const { stepArgs, parsedHits, resolvePlan, outcomeReport } = runChain(
        [7, 13],
        seeds,
      );

      // stage 1 — stepArgs.publish({report, commandArgs, searchArgv 길이 9}).
      expect(typeof stepArgs.publish.report).toBe("object");
      expect(typeof stepArgs.publish.commandArgs).toBe("object");
      expect(Array.isArray(stepArgs.publish.searchArgv)).toBe(true);
      expect(stepArgs.publish.searchArgv).toHaveLength(9);

      // stage 2 — parsedHits 비어있지 않은 배열.
      expect(Array.isArray(parsedHits)).toBe(true);
      expect(parsedHits.length).toBeGreaterThan(0);

      // stage 3 — resolve plan(update {action, issueNumber} + 비어있지 않은 string[] argv).
      expect(resolvePlan.action.action).toBe("update");
      if (resolvePlan.action.action !== "update") {
        throw new Error("update action 기대");
      }
      expect(typeof resolvePlan.action.issueNumber).toBe("number");
      expect(resolvePlan.argv.length).toBeGreaterThan(0);

      // stage 4 — outcome step-args report(5필드).
      expect(typeof outcomeReport.issueNumber).toBe("number");
      expect(outcomeReport.issueNumber).toBeGreaterThan(0);
      expect(outcomeReport.url.length).toBeGreaterThan(0);
      expect(outcomeReport.gitSha).toBe("abc1234");
      expect(outcomeReport.dateToken).toBe("2026-06-29");
      expect(outcomeReport.summaryLine.length).toBeGreaterThan(0);
    });
  });

  describe("search-json-fields ↔ parse-shape-keys set-equality 수렴(branch — 핵심 불변식 1, 본 task 의 새 표면 — 축 15)", () => {
    it("(b) set(stepArgs.publish.searchArgv[6] split by ',') == set(REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS)(양방향 포함·크기 동일) + splitSet 크기==3·중복 0·각 토큰이 PARSE_SHAPE_KEYS 에 포함", () => {
      const { stepArgs } = runChain([7, 13]);
      const jsonFieldsToken = stepArgs.publish.searchArgv[6];

      // searchArgv[6]은 helper 박제 `--json` 요청-필드 상수와 byte-identical.
      expect(jsonFieldsToken).toBe(REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS);

      const splitSet = splitJsonFieldsToken(jsonFieldsToken);
      const parseShapeSet = setOf(
        REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS,
      );

      // 핵심 — 요청-필드 split 집합 == 추출 shape 정규 키 집합(set-equal, 양방향).
      expect(isSetEqual(splitSet, parseShapeSet)).toBe(true);
      expect(splitSet.size).toBe(3);
      expect(splitSet.size).toBe(parseShapeSet.size);

      // splitSet 의 각 토큰이 PARSE_SHAPE_KEYS 에 존재(중복 0 — split 길이 == set 크기).
      const splitTokens = jsonFieldsToken.split(",").map((t) => t.trim());
      expect(splitTokens).toHaveLength(splitSet.size);
      splitTokens.forEach((token) => {
        expect(REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS).toContain(token);
      });
    });
  });

  describe("search-json-fields ↔ 실 파싱 hit 키 set-equality 수렴(branch — 핵심 불변식 2 — 축 15)", () => {
    it("(c) 모든 parsedHits[i] 에 대해 set(Object.keys(parsedHits[i])) == set(searchArgv[6] split) AND == set(PARSE_SHAPE_KEYS)(요청-필드 == 실 파싱 산물 키 set-equal)", () => {
      const { stepArgs, parsedHits } = runChain([7, 13, 21]);
      const splitSet = splitJsonFieldsToken(stepArgs.publish.searchArgv[6]);
      const parseShapeSet = setOf(
        REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS,
      );

      expect(parsedHits.length).toBeGreaterThan(0);
      parsedHits.forEach((hit) => {
        const keySet = setOf(Object.keys(hit));
        expect(isSetEqual(keySet, splitSet)).toBe(true);
        expect(isSetEqual(keySet, parseShapeSet)).toBe(true);
      });
    });

    it("(c') gh 응답에 추가 필드(url,state,author) 섞인 searchStdout 으로도 파싱 결과 키 집합은 {number,title,body} 로 정규화(추가 필드 미누출) — 추출-shape 가 요청-필드 upper bound", () => {
      const seeds = defaultSeeds();
      const runPlan = buildRunPlan(seeds);
      const stepArgs = buildRealDataE2eStepArgs(
        runPlan,
        defaultActivities(seeds),
        defaultResults(),
      );
      const marker = stepArgs.publish.report.descriptor.marker;
      const noisyStdout = noisyHitStdout(marker, [7, 13]);
      const noisyHits = parseRealDataResultIssueSearchOutput(noisyStdout);
      const splitSet = splitJsonFieldsToken(stepArgs.publish.searchArgv[6]);

      expect(noisyHits.length).toBeGreaterThan(0);
      noisyHits.forEach((hit) => {
        const keySet = setOf(Object.keys(hit));
        // 추가 필드(url,state,author)가 추출-shape 로 새지 않음 — 여전히 set-equal.
        expect(isSetEqual(keySet, splitSet)).toBe(true);
        expect(keySet.has("url")).toBe(false);
        expect(keySet.has("state")).toBe(false);
        expect(keySet.has("author")).toBe(false);
      });
    });
  });

  describe("parse-shape number → resolve action issueNumber → post thread 수렴(branch — 축 15 묶음)", () => {
    it("(d) parsedHits[0].number(==N) === resolvePlan.action.update.issueNumber(toBe) === Number(resolvePlan.argv[2]) === outcomeReport.issueNumber AND outcomeReport.url 에 /issues/N — 요청한 number 필드가 search→parse→resolve→post 로 어긋남 0 thread", () => {
      const N = 7;
      const { parsedHits, resolvePlan, outcomeReport } = runChain([N, 13]);
      if (resolvePlan.action.action !== "update") {
        throw new Error("update action 기대");
      }

      // parsedHits[0].number == N(min hit number — resolve 가 최소 후보를 update 대상으로).
      expect(parsedHits[0].number).toBe(N);
      expect(resolvePlan.action.issueNumber).toBe(N);
      expect(resolvePlan.argv[2]).toBe(String(N));
      expect(outcomeReport.issueNumber).toBe(N);
      expect(outcomeReport.url).toContain(`/issues/${N}`);
    });
  });

  describe("search-json-fields 축 변별성 — `--json` 토큰은 seeds/modelId/검색 결과 비종속 결정론 상수(branch)", () => {
    it("(e) 다른 seeds·다른 modelId·다른 searchStdout(hit 수 다름) 세 chain → searchArgv[6] byte-identical REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS·split 집합도 세 chain 동일, 그러나 실 파싱 hit 키 집합도 hit 수와 무관히 매 hit {number,title,body}(파싱 정규화 일관)", () => {
      const chainA = runChain([7], customSeeds(["alice", "bob"]));
      const chainB = runChain(
        [11, 22],
        defaultSeeds(),
        buildRunPlan(defaultSeeds(), "model-distinct-beta"),
      );
      const chainC = runChain([3, 9, 15, 27], customSeeds(["carol"]));

      const tokenA = chainA.stepArgs.publish.searchArgv[6];
      const tokenB = chainB.stepArgs.publish.searchArgv[6];
      const tokenC = chainC.stepArgs.publish.searchArgv[6];

      // `--json` 요청-필드는 입력 무관 결정론 상수(세 chain byte-identical).
      expect(tokenA).toBe(REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS);
      expect(tokenB).toBe(REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS);
      expect(tokenC).toBe(REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS);
      expect(
        isSetEqual(splitJsonFieldsToken(tokenA), splitJsonFieldsToken(tokenB)),
      ).toBe(true);
      expect(
        isSetEqual(splitJsonFieldsToken(tokenB), splitJsonFieldsToken(tokenC)),
      ).toBe(true);

      // 실 파싱 hit 키 집합도 hit 수 무관히 매 hit {number,title,body}(정규화 일관).
      const parseShapeSet = setOf(
        REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS,
      );
      [chainA, chainB, chainC].forEach((chain) => {
        chain.parsedHits.forEach((hit) => {
          expect(isSetEqual(setOf(Object.keys(hit)), parseShapeSet)).toBe(true);
        });
      });
      expect(chainC.parsedHits.length).toBe(4);
      expect(chainA.parsedHits.length).toBe(1);
    });
  });

  describe("collect-leg call-args 재유도 수렴(branch — 14-way 묶음 항 — 축 14)", () => {
    it("(f) runPlan.pipeline.collectCallArgs deep-equal(toEqual) buildRealDataCollectCallArgs(seeds), 원소별 since===undefined·assessmentId===ASSESSMENT_ID_PLACEHOLDER(import const)·collectCallArgs.length === seeds.length", () => {
      const seeds = defaultSeeds();
      const runPlan = buildRunPlan(seeds);
      const collectCallArgs = runPlan.pipeline.collectCallArgs;

      expect(collectCallArgs).toEqual(buildRealDataCollectCallArgs(seeds));
      expect(collectCallArgs).toHaveLength(seeds.length);
      collectCallArgs.forEach((args, i) => {
        expect(args.since).toBeUndefined();
        expect(args.assessmentId).toBe(ASSESSMENT_ID_PLACEHOLDER);
        expect(JSON.stringify(args.person)).toContain(
          seeds[i].serviceIdentities[0].externalId,
        );
      });
    });
  });

  describe("collect/evaluate modelId 공유 수렴(branch — 묶음 항 — 축 14)", () => {
    it("(g) runPlan.pipeline.modelId === modelId(toBe) AND 모든 stepArgs.evaluation.callArgs[i].options.modelId === runPlan.pipeline.modelId(toBe, forEach)", () => {
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

  describe("search-argv 전체-벡터 위치-정합 수렴(branch — 묶음 항 — 축 13)", () => {
    it('(h) stepArgs.publish.searchArgv deep-equal(toEqual) ["search","issues","--match","body",commandArgs.searchQuery,"--json","number,title,body","--limit","30"], searchArgv[4]===commandArgs.searchQuery·searchArgv[6]===REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS(toBe)', () => {
      const { stepArgs } = runChain([7, 13]);
      const searchArgv = stepArgs.publish.searchArgv;
      const searchQuery = stepArgs.publish.commandArgs.searchQuery;

      expect(searchArgv).toEqual(expectedSearchArgv(searchQuery));
      expect(searchArgv[4]).toBe(searchQuery);
      expect(searchArgv[6]).toBe(REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS);
    });
  });

  describe("resolve-argv update/create 위치-정합 수렴(branch — 묶음 항 — 축 12)", () => {
    it('(i) search hit N → resolvePlan.argv deep-equal ["issue","edit",String(N),"--title",updateArgs.title,"--body",updateArgs.body], search hit 0("[]") → ["issue","create","--title",createArgs.title,"--body",createArgs.body,"--label","realdata-e2e","--label","result"]', () => {
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

  describe("publish-leg command-args-labels 고정상수 + title/body 두 경로 + descriptor·summary 재유도 수렴(branch — 묶음 항 — 축 6~11)", () => {
    it("(j) createArgs.labels deep-equal ['realdata-e2e','result'], createArgs/updateArgs.{title,body} 둘 다 === descriptor.{title,body}, descriptor.{title,body}·report.summary === buildRealDataResultIssueCommandPlan(results, runPlan.run).report.{descriptor.{title,body},summary} byte-identical", () => {
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

  describe("evaluation-leg inputs 재유도 + callArgs.input 페어링(branch — 묶음 항 — 축 4~5)", () => {
    it("(k) evaluation.inputs deep-equal buildRealDataEvaluationInputs(activities), 모든 callArgs[i].input === inputs[i](toBe, forEach)·길이 일치", () => {
      const seeds = defaultSeeds();
      const runPlan = buildRunPlan(seeds);
      const activities = defaultActivities(seeds);
      const { stepArgs } = runChain([7, 13], seeds, runPlan, activities);

      expect(stepArgs.evaluation.inputs).toEqual(
        buildRealDataEvaluationInputs(activities),
      );
      expect(stepArgs.evaluation.inputs).toHaveLength(activities.length);
      expect(stepArgs.evaluation.callArgs.length).toBe(
        stepArgs.evaluation.inputs.length,
      );
      stepArgs.evaluation.callArgs.forEach((c, i) => {
        expect(c.input).toBe(stepArgs.evaluation.inputs[i]);
      });
    });
  });

  describe("marker 3-축 + resolve issueNumber + post run-identity 수렴(branch — 묶음 항 — 축 1~3)", () => {
    it("(l) descriptor.marker === commandArgs.searchQuery === searchArgv[4](세 지점 byte-identical) AND hit N → resolvePlan.action.update.issueNumber → outcomeReport.issueNumber 세 지점 동일 N AND descriptor.marker 에 `${dateToken}@${gitSha}` 포함 AND outcomeReport.{gitSha,dateToken} === runPlan.run", () => {
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

  describe("15-way 단일-source 묶음 단언(branch — closure 종단, 본 task 의 종단 박제)", () => {
    it("(m) set(searchArgv[6] split) == set(PARSE_SHAPE_KEYS) == set(Object.keys(parsedHits[0])), 그 number(==N) == resolve issueNumber == argv[2] == post issueNumber, collectCallArgs == buildRealDataCollectCallArgs(seeds), modelId == modelId == callArgs[].options.modelId, searchArgv == canonical AND searchArgv[4]==marker==searchQuery==descriptor.marker, update argv == ['issue','edit',String(N),...updateArgs], argv title/body == descriptor.{title,body} == command-plan, argv labels == createArgs.labels == ['realdata-e2e','result'], summary == command-plan, inputs == buildRealDataEvaluationInputs(activities), callArgs[].input===inputs[i], run token == post {gitSha,dateToken} 가 검증 source(seeds+modelId+run+activities+results) single-source 에서 15-way 동시 성립", () => {
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

      // axis 15(새 표면) — set-equal 3-way: 요청-필드 == 추출-shape == 실 파싱 키.
      const splitSet = splitJsonFieldsToken(stepArgs.publish.searchArgv[6]);
      const parseShapeSet = setOf(
        REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS,
      );
      const hitKeySet = setOf(Object.keys(parsedHits[0]));
      expect(isSetEqual(splitSet, parseShapeSet)).toBe(true);
      expect(isSetEqual(parseShapeSet, hitKeySet)).toBe(true);
      expect(isSetEqual(splitSet, hitKeySet)).toBe(true);
      // 그 set 의 'number' 값(==N) → resolve → argv[2] → post thread.
      expect(parsedHits[0].number).toBe(N);
      expect(resolveUpdate.action.issueNumber).toBe(N);
      expect(resolveUpdate.argv[2]).toBe(String(N));
      expect(outcomeReport.issueNumber).toBe(N);

      // axis 14 — collect-leg 재유도 + collect/evaluate modelId 공유.
      expect(runPlan.pipeline.collectCallArgs).toEqual(
        buildRealDataCollectCallArgs(seeds),
      );
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
      // axis 9~11 — argv title/body == descriptor.{title,body} == command-plan, labels 고정상수.
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
      // axis 4~5 — evaluation.inputs deep-equal + callArgs 페어링.
      expect(stepArgs.evaluation.inputs).toEqual(
        buildRealDataEvaluationInputs(activities),
      );
      stepArgs.evaluation.callArgs.forEach((c, i) => {
        expect(c.input).toBe(stepArgs.evaluation.inputs[i]);
      });
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

  describe("create/update 두 분기 격리 — `--json` 요청-필드는 분기 비종속(branch)", () => {
    it("(n) 동일 seeds·modelId·run·activities·results, searchStdout 만 (hit 1+ vs hit 0)으로 달리해 → 한쪽 update·다른 쪽 create. stepArgs.publish.searchArgv[6](`--json` 토큰)·split 집합·searchArgv 전체가 두 chain byte-identical(검색 결과가 요청-필드를 바꾸지 0) AND 두 resolvePlan.argv 는 동사·issueNumber·labels 위치만 다르고 title/body 운반 값은 단일-source 불변", () => {
      const seeds = defaultSeeds();
      const runPlan = buildRunPlan(seeds);
      const activities = defaultActivities(seeds);
      const results = defaultResults();
      const stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results);
      const marker = stepArgs.publish.report.descriptor.marker;
      const descriptorTitle = stepArgs.publish.report.descriptor.title;
      const descriptorBody = stepArgs.publish.report.descriptor.body;

      const resolveUpdate = resolveRealDataResultIssueGhCommandPlan(
        multiHitStdout(marker, [7, 13]),
        stepArgs.publish.commandArgs,
      );
      const resolveCreate = resolveRealDataResultIssueGhCommandPlan(
        "[]",
        stepArgs.publish.commandArgs,
      );

      // `--json` 토큰·split 집합·searchArgv 전체는 검색 결과(update/create)와 무관.
      expect(stepArgs.publish.searchArgv[6]).toBe(
        REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS,
      );
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
    it("(o) modelId 빈('') → buildRealDataE2eRunPlan 위임 pipeline modelId guard throw(searchArgv 합성 도달 전 차단)", () => {
      const seeds = defaultSeeds();
      expect(() =>
        buildRealDataE2eRunPlan(seeds, "", {
          gitSha: "abc1234",
          dateToken: "2026-06-29",
        }),
      ).toThrow();
    });

    it("(o') modelId 공백-only('   ') → pipeline modelId guard throw 대칭(searchArgv 도달 못 함)", () => {
      const seeds = defaultSeeds();
      expect(() =>
        buildRealDataE2eRunPlan(seeds, "   ", {
          gitSha: "abc1234",
          dateToken: "2026-06-29",
        }),
      ).toThrow();
    });

    it("(p) run.gitSha 빈('') → buildRealDataE2eRunPlan run guard assertRunRefNonBlank('gitSha') throw", () => {
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

    it("(q) searchStdout 비JSON/비배열('not json') → parseRealDataResultIssueSearchOutput 위임 throw(`--json` 요청-필드 set 은 정상 산출됐으나 실 파싱 hit 키 set 을 얻지 못함 — set-equal 의 응답-측 throw, 요청-측은 정상)", () => {
      const stepArgs = buildRealDataE2eStepArgs(
        buildRunPlan(),
        defaultActivities(),
        defaultResults(),
      );
      // 요청-측은 정상 — searchArgv[6] split 집합 == PARSE_SHAPE_KEYS.
      expect(
        isSetEqual(
          splitJsonFieldsToken(stepArgs.publish.searchArgv[6]),
          setOf(REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS),
        ),
      ).toBe(true);
      // 응답-측 비정상 — 파싱 throw(set-equal 의 한쪽이 얻어지지 않음).
      expect(() => parseRealDataResultIssueSearchOutput("not json")).toThrow();
    });

    it("(r) searchStdout hit number 비양수([{number:0,...}]) → search-parse assertPositiveNumber throw(비정상 number 가 parse-shape number 로 새는 것 차단 — 요청한 number 필드 추출 단계 거부)", () => {
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

    it("(s) searchStdout hit title 비문자열([{number:1,title:5,body:'b'}]) → search-parse 문자열 필드 guard throw(요청한 title 필드 타입 위반 거부 — 요청-필드 set 정상이어도 추출-shape 값 위반)", () => {
      const badStdout = JSON.stringify([{ number: 1, title: 5, body: "b" }]);
      expect(() => parseRealDataResultIssueSearchOutput(badStdout)).toThrow();
    });

    it("(s') searchStdout hit 에 요청 필드 누락([{number:1,title:'t'}], body 없음) → search-parse throw(요청한 `--json` 필드와 실 응답 키 불일치 — set-equal seam 의 응답-측 결손)", () => {
      const missingBodyStdout = JSON.stringify([{ number: 1, title: "t" }]);
      expect(() =>
        parseRealDataResultIssueSearchOutput(missingBodyStdout),
      ).toThrow();
    });

    it("(t) execStdout URL 미발견(빈 문자열) → post 파서 위임 throw(runPlan.run 정상이어도 차단)", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(buildRunPlan(), ""),
      ).toThrow();
    });

    it("(t') execStdout /issues/0 → post 파서 assertPositiveIssueNumber throw(post 비식별)", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(
          buildRunPlan(),
          `https://github.com/${OWNER}/${REPO}/issues/0\n`,
        ),
      ).toThrow();
    });

    it("(u) set-equality 축 negative — searchStdout hit 에 요청한 `--json` 필드 외 추가 필드(url,state) 섞임 → parse 가 {number,title,body} 만 추출(추가 필드 누락)하므로 set(Object.keys(parsedHit)) 가 여전히 set(searchArgv[6] split) 과 set-equal(추가 필드가 추출-shape 로 새지 않음 — 요청-필드 set 이 추출-shape 의 upper bound)", () => {
      const stepArgs = buildRealDataE2eStepArgs(
        buildRunPlan(),
        defaultActivities(),
        defaultResults(),
      );
      const marker = stepArgs.publish.report.descriptor.marker;
      const noisyHits = parseRealDataResultIssueSearchOutput(
        noisyHitStdout(marker, [7]),
      );
      const splitSet = splitJsonFieldsToken(stepArgs.publish.searchArgv[6]);
      noisyHits.forEach((hit) => {
        expect(isSetEqual(setOf(Object.keys(hit)), splitSet)).toBe(true);
      });
    });
  });

  describe("결정론·무공유·no-mutation — chain 두 번 호출 + 입력 불변 + parsedHits/searchArgv 오염 0", () => {
    it("(v) 동일 (seeds, modelId, run, activities, results, searchStdout, execStdout) chain 두 번 → runPlan/stepArgs/parsedHits/resolvePlan/outcomeReport 모두 deep-equal(결정론)", () => {
      const seeds = defaultSeeds();
      const chain1 = runChain([7, 13], seeds, buildRunPlan(seeds));
      const chain2 = runChain([7, 13], seeds, buildRunPlan(seeds));

      expect(chain1.runPlan.pipeline.collectCallArgs).toEqual(
        chain2.runPlan.pipeline.collectCallArgs,
      );
      expect(chain1.stepArgs.evaluation).toEqual(chain2.stepArgs.evaluation);
      expect(chain1.stepArgs.publish).toEqual(chain2.stepArgs.publish);
      expect(chain1.parsedHits).toEqual(chain2.parsedHits);
      expect(chain1.resolvePlan).toEqual(chain2.resolvePlan);
      expect(chain1.outcomeReport).toEqual(chain2.outcomeReport);
    });

    it("(w) no-mutation — 입력 seeds·activities·results·run chain 호출 후 deep-equal(원본 불변)", () => {
      const seeds = defaultSeeds();
      const activities = defaultActivities(seeds);
      const results = defaultResults();
      const run = { gitSha: "abc1234", dateToken: "2026-06-29" };
      const seedsBefore = JSON.parse(JSON.stringify(seeds));
      const activitiesBefore = JSON.parse(JSON.stringify(activities));
      const resultsBefore = JSON.parse(JSON.stringify(results));
      const runBefore = JSON.parse(JSON.stringify(run));

      const runPlan = buildRealDataE2eRunPlan(seeds, MODEL_ID, run);
      const stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results);
      parseRealDataResultIssueSearchOutput(
        multiHitStdout(stepArgs.publish.report.descriptor.marker, [7]),
      );

      expect(seeds).toEqual(seedsBefore);
      expect(activities).toEqual(activitiesBefore);
      expect(results).toEqual(resultsBefore);
      expect(run).toEqual(runBefore);
    });

    it("(x) 무공유 — 반환 parsedHits.push(...) / stepArgs.publish.searchArgv.push(...) 후 새 chain 의 산출이 여전히 정상·오염 0(이전 호출 반환 mutate 누설 0 — 매 호출 새 배열)", () => {
      const seeds = defaultSeeds();
      const first = runChain([7, 13], seeds, buildRunPlan(seeds));
      const parsedLen = first.parsedHits.length;
      const argvLen = first.stepArgs.publish.searchArgv.length;

      // 반환 배열 mutate(오염 시도).
      first.parsedHits.push({ number: 999, title: "x", body: "y" });
      first.stepArgs.publish.searchArgv.push("--polluted");
      expect(first.parsedHits.length).toBe(parsedLen + 1);
      expect(first.stepArgs.publish.searchArgv.length).toBe(argvLen + 1);

      // 새 chain 의 산출은 여전히 정상(이전 호출 mutate 누설 0).
      const second = runChain([7, 13], seeds, buildRunPlan(seeds));
      expect(second.parsedHits).toHaveLength(2);
      expect(second.stepArgs.publish.searchArgv).toHaveLength(9);
      expect(second.stepArgs.publish.searchArgv[6]).toBe(
        REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS,
      );
    });
  });

  describe("credential 누출 0(branch — §9 / R-59 / REQ-059 정합)", () => {
    it("(y) stepArgs.publish.searchArgv(join)·searchArgv[6](`--json` 토큰)·parsedHits(직렬화 — number/title/body)·resolvePlan.argv(join)·commandArgs/{descriptor,summary}/evaluation.{inputs,callArgs}/outcomeReport.{url,summaryLine} 어디에도 token/secret/PAT/--auth 어휘 미등장(특히 searchArgv[6]·parsedHits[].{title,body} 명시)", () => {
      const seeds = defaultSeeds();
      const { stepArgs, parsedHits, resolvePlan, outcomeReport } = runChain(
        [7, 13],
        seeds,
      );
      const resolveCreate = resolveRealDataResultIssueGhCommandPlan(
        "[]",
        stepArgs.publish.commandArgs,
      );

      const surfaces: string[] = [
        stepArgs.publish.searchArgv.join(" "),
        stepArgs.publish.searchArgv[6],
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
      // searchArgv[6](요청-필드)·parsedHits[].{title,body}(실 파싱 응답)에 credential 어휘 미등장 명시.
      expect(stepArgs.publish.searchArgv[6]).not.toMatch(credentialPattern);
      parsedHits.forEach((hit) => {
        expect(hit.title).not.toMatch(credentialPattern);
        expect(hit.body).not.toMatch(credentialPattern);
      });
      // outcome url 은 issue 경로만.
      expect(outcomeReport.url).not.toMatch(/commit|pull request/i);
    });
  });
});
