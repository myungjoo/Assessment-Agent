// realdata-e2e-aggregator-search-argv-positional-descriptor-run-plan-threading-13way-single-source-closure-assembly.smoke-spec.ts
// — 실 평가 e2e step④ aggregator search-argv 전체-벡터 위치-정합 합류 13-way single-source
// closure: pre-실행 aggregator `buildRealDataE2eStepArgs(runPlan, activities, results)` 의
// publish leg `searchArgv` 가 실제로 live runner 가 `execFile('gh', searchArgv)` 로 거는
// **gh search issues 인자-벡터(first-step search 벡터)의 canonical 9-원소 전체-벡터** 와
// byte-identical 임을 13번째 축으로 합류시킨다. 즉 `stepArgs.publish.searchArgv` 가:
//   `["search","issues","--match","body",searchQuery,"--json","number,title,body",
//     "--limit","30"]`(search-argv 122~132행 + 80·85행 상수)
//   - `searchArgv[0]=="search"`, `searchArgv[1]=="issues"` (동사 prefix 결정론 상수).
//   - `searchArgv[2]=="--match"`, `searchArgv[3]=="body"` (match 필드 고정).
//   - `searchArgv[4]===commandArgs.searchQuery`(=descriptor.marker — 단일-source marker 운반).
//   - `searchArgv[5]=="--json"`, `searchArgv[6]=="number,title,body"`
//     (=REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS 결정론 상수).
//   - `searchArgv[7]=="--limit"`, `searchArgv[8]=="30"`
//     (=REAL_DATA_RESULT_ISSUE_SEARCH_LIMIT 결정론 상수).
//
// 이 search-argv 전체-벡터 위치-정합 축(축 13, 본 task 의 새 표면)이 다음 12 축과 함께 세 검증
// source `(runPlan, activities, results)` single-source 로 13-way 동시 수렴함을 한 chain 으로
// 박제한다:
//   (축 13, 새 표면) searchArgv 전체-벡터 byte-identical — 동사 prefix·--match body·
//       searchQuery(index 4)=marker·--json 필드 상수·--limit 값 상수 위치별 정합.
//   (축 12) resolvePlan.argv 위치-정합 운반(update/create 두 분기 argv[idx] == 단일-source
//       command-args 필드값 byte-identical + labels flag-pair 전개).
//   (축 11) command-args createArgs.labels 고정-상수 `["realdata-e2e","result"]` 일치.
//   (축 9~10) command-args {create,update}Args.{title,body} 두 경로 == descriptor.{title,body}.
//   (축 6~8) descriptor.{title,body}·summary command-plan 경유 재유도 byte-identical.
//   (축 4~5) evaluation.inputs == buildRealDataEvaluationInputs(activities), callArgs[i].input
//       === inputs[i], callArgs[i].options.modelId === runPlan.pipeline.modelId.
//   (축 2~3) marker 3-축 — descriptor.marker / commandArgs.searchQuery / searchArgv[4] 동일.
//   (축 1, 종단) marker → resolve issueNumber(argv[2]==String(N)) → post run-identity —
//       `buildRealDataResultOutcomeStepArgs(runPlan, execStdout)` 가 동일 runPlan.run 전파.
//
// 이 13-way 가 세 검증 source single-source 에서 한 chain 동시-호출로 수렴함이 search-or-update
// 멱등성(REQ-009 — 같은 단일-source marker 가 first-step search 벡터의 정확한 위치(index 4)로
// 운반되고 그 검색 결과가 create/edit argv 로 동형 조립)·raw 미보유 평가 입력/결과 집계 정합
// (REQ-032)·결과 리포트 재실행 정합(REQ-037)·credential 미보유(REQ-059)의 aggregator-level
// "first-step search 인자-벡터가 전체-위치 byte-identical 조립됨(marker 운반 + 결정론 상수)이
// 같은 세 검증 source 의 산물" 의 종단 닫음이다. step④ 멱등 chain 의 두 gh CLI 인자-벡터
// (first-step search + second-step create/edit)가 모두 단일-source 로 전체-위치 묶이는 slice.
// (T-0782 박제, PLAN.md 109행 🟢 실 평가 e2e step④).
//
// 본 spec 의 존재 이유 — public CI gap 해소(search-argv 전체-벡터 위치-정합 축을 13번째 축으로 합류):
//   - aggregator `buildRealDataE2eStepArgs(runPlan, activities, results)`(T-0601)는 세 입력
//     source 를 받는다. T-0781 이 publish leg 의 resolve-argv(second-step create/edit 벡터)
//     위치-정합을 closure 에 합류해 12-way 를 완성했다.
//   - 그러나 그 앞 first-step `searchArgv`(execFile('gh', searchArgv) 로 나가는 search 인자-벡터)
//     의 전체-벡터 위치-정합(동사 prefix·--match body·--json 필드 상수·--limit 값 상수의 위치별
//     byte-identical)은 아직 convergence closure 에 미합류된 distinct 표면이다 —
//     aggregator+searchArgv 참조 smoke 3파일(4·5·6-way)은 전부 `extractSearchMarker(searchArgv)`
//     = `searchArgv[indexOf("--match")+2]` 의 `--match` 마커 토큰만 추출·합류, searchArgv 전체-벡터
//     (동사 prefix·--json 필드·--limit 값 위치-정합)는 미합류였다. 4-way 690행도 두 chain searchArgv
//     간 deep-equal(결정론)일 뿐 canonical 전체-벡터 toEqual 0.
//   - search-argv self-guard(`assertRealDataResultIssueSearchGhArgvPreservesCommandArgs`, T-0655
//     + `assertRealDataResultIssueSearchJsonFieldsMatchParseShape`, T-0657)가 빌더 내부 self-wire
//     로 round-trip 을 박제했으나 aggregator(`buildRealDataE2eStepArgs`) 진입·resolve·post
//     미합류(빌더 단독 self-guard).
//   - 본 spec 은 그 빈 자리를 채워 **publish leg 의 searchArgv 가 first-step gh search 인자-벡터를
//     전체-위치-정합(동사 prefix·--match body·searchQuery=marker(index 4)·--json 필드 상수·--limit
//     값 상수)으로 조립함을 같은 aggregator 산출 + resolve-argv(second-step) + descriptor 재유도와
//     묶어 closure 에 합류**시킨다.
//   - live leg(실 prisma·실 collectForPerson·실 github.com fetch·실 LLM scoring·실 gh CLI
//     실행·DB·LAN gate)는 복제하지 않고, synthetic runPlan(buildRealDataE2eRunPlan 합성) +
//     activities/results literal + search-stdout/exec-stdout literal 을 컴포저들에 직접 공급해
//     live leg 를 우회한다(조립 surface 만 검증). 따라서 본 spec 은:
//
//      🔥 실 gh 호출 0 — gh search / list / create / edit / execFile('gh', searchArgv) /
//         execFile('gh', argv) 미실행. synthetic searchStdout / execStdout / runPlan /
//         activities / results literal 직접 공급. searchArgv 는 first-step gh search 인자-벡터
//         전체-위치-정합 운반만 검증(실 gh 검색 실행 0).
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 LLM scoreUnit 호출 0 / 실 DB 접근 0 / 실 jest spawn 0 — 13-way 수렴 조립만.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 step-args aggregator / evaluation-inputs / command-plan
//         / gh-command-plan(resolve) / outcome-step-args / run-plan / seed-fixture / search-argv
//         상수 import 재사용만(가드/helper 신설 0). spec 로컬 보조 함수만.
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0782):
//   - src 변경 0(src/, prisma/, package.json, CI workflow, 환경 변수 추가 등 모두 금지). test-only.
//   - 실 gh CLI 호출 / `execFile('gh', searchArgv)` / `execFile('gh', argv)` 실행 / 실 LLM
//     scoreUnit 호출 / 실 issue 검색·박제(step④ live wiring — credential gate, deferred).
//     searchArgv 는 gh search issues 인자-벡터 전체-위치-정합 운반만 검증.
//   - aggregator 12-way(resolve-argv 위치-정합 + command-args labels 고정상수 + title/body 두
//     경로 + descriptor.{title,body} 재유도 + summary + inputs + callArgs.input 페어링 + modelId
//     + marker 3-축 + resolve issueNumber + post run-identity) 자체 재단언(T-0781 cover). 본 task
//     는 searchArgv 전체-벡터 위치-정합(동사 prefix·--match body·searchQuery=marker·--json 필드
//     상수·--limit 값 상수)을 13번째 축으로 합류시킨 부분만(나머지 축은 13-way 묶음 표현용 동시-성립).
//   - search-argv self-guard(T-0655 + T-0657) 자체 재단언(search-argv helper spec cover).
//   - resolve-argv self-guard(T-0650/0652) / resolve 3-단계 self-consistency 가드(T-0698) /
//     create/update 분기 결정 로직(resolveRealDataResultIssueAction) / descriptor 합성 로직 /
//     summary 집계 로직 자체 재단언(각 helper spec cover). marker/필드 운반·재유도 byte-identical 만.
//   - `--repo owner/repo`·`--owner`·`--state` 등 search argv 의 repo/state context wiring 재단언
//     — **본 helper(search-argv)는 이 인자들을 산출하지 않는다**(search-argv Out of Scope 60~62행).
//     본 task 는 helper 가 실제 산출하는 9-원소 canonical 벡터만 단언(--repo/--state 토큰 단언 불가·금지).
//   - 난이도별 modelId routing(R-97 deferred) — 단일 modelId 동형 적용(ADR-0048)만.
//   - 상수 값 정책 변경/재정의 — helper 박제 현재 값을 그대로 단언만.
//   - DB 의존 / live-LLM·실 fetch·실 collectForPerson 0.
//   - 새 helper 모듈 신설 / 기존 helper 수정 — test-only(신규 smoke spec 1 파일).
import type { GithubActivity } from "../../src/assessment-collection/domain/activity";
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";
import { buildRealDataEvaluationInputs } from "../helpers/realdata-e2e-evaluation-inputs";
import { buildRealDataResultIssueCommandPlan } from "../helpers/realdata-e2e-result-issue-command-plan";
import { resolveRealDataResultIssueGhCommandPlan } from "../helpers/realdata-e2e-result-issue-gh-command-plan";
import {
  REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS,
  REAL_DATA_RESULT_ISSUE_SEARCH_LIMIT,
} from "../helpers/realdata-e2e-result-issue-search-argv";
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
  "cfg-realdata-e2e-aggregator-search-argv-positional-descriptor-run-plan-threading-smoke";

const INSTANCE_KEY = "github.com";

// 고정 결정론 분류 라벨 — command-args.ts 64행 `RESULT_ISSUE_LABELS = ["realdata-e2e",
// "result"]` 가 박제한 현재 값. create 분기 argv 의 `--label` flag-pair 로 전개될 expected.
const EXPECTED_RESULT_ISSUE_LABELS = ["realdata-e2e", "result"];

// 본 task 의 핵심 expected — search-argv helper(122~132행) 가 산출하는 canonical 9-원소
// 전체-벡터(marker 위치만 입력 종속, 나머지 8 위치는 결정론 상수). marker(index 4)는 chain
// 시점에 stepArgs.publish.commandArgs.searchQuery 로 채워 비교한다. 상수(index 6·8)는
// helper export 를 직접 import 해 매직 스트링 drift 0.
function expectedSearchArgv(marker: string): string[] {
  return [
    "search",
    "issues",
    "--match",
    "body",
    marker,
    "--json",
    REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS,
    "--limit",
    REAL_DATA_RESULT_ISSUE_SEARCH_LIMIT,
  ];
}

// search argv 안 marker 추출 헬퍼(변별 보조) — 빌더 canonical shape 에서 marker 는
// `--match body` 직후(matchIdx + 2). 본 task 는 전체-벡터 위치 인덱싱(searchArgv[4])을
// 핵심으로 쓰되, indexOf("--match")+2 == 4 임을 함께 단언해 위치-정합을 교차 확인한다.
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
// 단일 `{pipeline, run}` 을 만든다(modelId·run guard 통과 비공백 토큰). 매 호출 새 객체 트리.
function buildRunPlan(
  modelId = MODEL_ID,
  gitSha = "abc1234",
  dateToken = "2026-06-28",
): RealDataE2eRunPlan {
  const seeds = buildRealDataE2eSeed();
  return buildRealDataE2eRunPlan(seeds, modelId, { gitSha, dateToken });
}

// synthetic GithubActivity 1 건 — aggregator 의 evaluation leg 입력. seed 의 첫 username 을
// author 로 매칭(evaluation leg 통과용). callArgs 가 1+ 원소를 갖도록 보장.
function syntheticActivity(
  author: string,
  externalId = "realdata-e2e-aggregator-search-argv-c1",
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
// username 을 author 로 매칭. 다양한 kind 분포(commit/pr/issue)로 inputs 재유도 검증.
function defaultActivities(): GithubActivity[] {
  const seeds = buildRealDataE2eSeed();
  const firstUsername = seeds[0].serviceIdentities[0].externalId;
  return [
    syntheticActivity(firstUsername, "aggregator-search-argv-c1", "commit"),
    syntheticActivity(firstUsername, "aggregator-search-argv-p1", "pr"),
    syntheticActivity(firstUsername, "aggregator-search-argv-i1", "issue"),
  ];
}

// synthetic EvaluationResult 1 건 — aggregator 의 publish leg 입력(summary 집계 + body 렌더 +
// command-args title/body source). labels 는 results 무관(빌더 고정 상수).
function syntheticResult(
  unitId: string,
  difficulty: EvaluationResult["difficulty"],
  contribution: EvaluationResult["contribution"],
  volume: number,
): EvaluationResult {
  return {
    unitId,
    narrative:
      "synthetic evaluation narrative — aggregator search-argv-positional(전체-벡터)+resolve-argv+command-args-{title,body,labels}+descriptor-{title,body}+results-summary+evaluation-inputs+modelId+marker ↔ resolve ↔ outcome-step-args run-plan-threading 13-way closure smoke fixture",
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
// https://github.com/<owner>/<repo>/issues/<N> URL 한 줄 + 부가 메시지/개행을 포함할 수 있다.
function execStdout(n: number, noisePrefix = ""): string {
  return `${noisePrefix}https://github.com/${OWNER}/${REPO}/issues/${n}\n`;
}

// pre-실행 aggregator(buildRealDataE2eStepArgs(runPlan, activities, results)) →
// resolve(search-stdout + stepArgs.publish.commandArgs → {action, argv}) →
// post step-args(buildRealDataResultOutcomeStepArgs(runPlan, execStdout))를 single-source(
// **동일 runPlan 한 객체** + activities + results + N)로 묶어 한 chain 으로 호출하는 헬퍼.
// 핵심: aggregator·post 두 곳에 **같은 runPlan 객체를 넘긴다**(독립 run 인자 재전달 0).
// 본 task 의 새 표면 = stepArgs.publish.searchArgv 전체-벡터 위치-정합(축 13).
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

describe('Smoke(non-gated): 실 평가 e2e step④ aggregator search-argv 전체-벡터 위치-정합 합류 13-way single-source closure buildRealDataE2eStepArgs → stepArgs.publish.searchArgv == ["search","issues","--match","body",commandArgs.searchQuery,"--json","number,title,body","--limit","30"] (byte-identical 9-원소 전체-벡터 — 동사 prefix·--match body·searchQuery=marker(index 4)·--json 필드 상수·--limit 값 상수 위치-정합) + resolve-argv 위치-정합(update/create) + command-args labels 고정상수 + command-args {title,body} 두 경로(=descriptor.{title,body}) + descriptor.{title,body}·summary 재유도 + evaluation {inputs(=buildRealDataEvaluationInputs(activities), callArgs[i].input===inputs[i]), modelId} + marker 3-축(descriptor.marker == commandArgs.searchQuery == searchArgv[4]) + resolve issueNumber(argv[2]==String(N)) + post run-identity ↔ buildRealDataResultOutcomeStepArgs 동일 (runPlan, activities, results) 한 chain 동시-호출 13축 동시 수렴 live-gh/live-LLM 0 검증', () => {
  describe("happy path — aggregator 13-way chain 합성(다섯 산출물 + 길이 9 searchArgv)", () => {
    it("(a) 유효 runPlan + activities + results + searchStdout + execStdout → stepArgs.evaluation({inputs,callArgs} 비어있지 않음) / stepArgs.publish({report,commandArgs,searchArgv} 정상, searchArgv 길이 9 비어있지 않은 string[]) / resolvePlan(update {action, issueNumber} + 비어있지 않은 string[] argv) / outcomeReport(5필드) 모두 정상", () => {
      const { stepArgs, resolvePlan, outcomeReport } = runChain([7, 13]);

      // stage 1a — stepArgs.evaluation({inputs, callArgs} 비어있지 않음).
      expect(Array.isArray(stepArgs.evaluation.inputs)).toBe(true);
      expect(stepArgs.evaluation.inputs.length).toBeGreaterThan(0);
      expect(Array.isArray(stepArgs.evaluation.callArgs)).toBe(true);
      expect(stepArgs.evaluation.callArgs.length).toBeGreaterThan(0);
      expect(typeof stepArgs.evaluation.callArgs[0].options.modelId).toBe(
        "string",
      );

      // stage 1b — stepArgs.publish({report, commandArgs, searchArgv} 정상, searchArgv 길이 9).
      expect(typeof stepArgs.publish.report).toBe("object");
      expect(typeof stepArgs.publish.commandArgs).toBe("object");
      expect(Array.isArray(stepArgs.publish.searchArgv)).toBe(true);
      expect(stepArgs.publish.searchArgv).toHaveLength(9);
      stepArgs.publish.searchArgv.forEach((token) => {
        expect(typeof token).toBe("string");
        expect(token.length).toBeGreaterThan(0);
      });
      expect(stepArgs.publish.searchArgv).toContain("--match");
      expect(
        Array.isArray(stepArgs.publish.commandArgs.createArgs.labels),
      ).toBe(true);
      expect(typeof stepArgs.publish.report.descriptor.title).toBe("string");
      expect(typeof stepArgs.publish.report.summary).toBe("object");

      // stage 2 — resolve plan(update {action, issueNumber} + 비어있지 않은 string[] argv).
      expect(resolvePlan.action.action).toBe("update");
      if (resolvePlan.action.action !== "update") {
        throw new Error("update action 기대");
      }
      expect(typeof resolvePlan.action.issueNumber).toBe("number");
      expect(Array.isArray(resolvePlan.argv)).toBe(true);
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

  describe("search-argv 전체-벡터 위치-정합 수렴(branch — 핵심 불변식 1, 본 task 의 새 표면 — 축 13)", () => {
    it('(b) stepArgs.publish.searchArgv deep-equal(toEqual) ["search","issues","--match","body",commandArgs.searchQuery,"--json","number,title,body","--limit","30"] byte-identical(search-argv 122~132행 + 상수), 위치별: searchArgv[0]=="search", [1]=="issues", [2]=="--match", [3]=="body", [4]===commandArgs.searchQuery(toBe), [5]=="--json", [6]==REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS, [7]=="--limit", [8]==REAL_DATA_RESULT_ISSUE_SEARCH_LIMIT', () => {
      const { stepArgs } = runChain([7, 13]);
      const searchArgv = stepArgs.publish.searchArgv;
      const searchQuery = stepArgs.publish.commandArgs.searchQuery;

      // 핵심 — searchArgv 전체-벡터 byte-identical deep-equal(원소·순서·길이).
      expect(searchArgv).toEqual(expectedSearchArgv(searchQuery));
      expect(searchArgv).toHaveLength(9);

      // 위치별 단언(search-argv helper 122~132행 시그니처 그대로).
      expect(searchArgv[0]).toBe("search");
      expect(searchArgv[1]).toBe("issues");
      expect(searchArgv[2]).toBe("--match");
      expect(searchArgv[3]).toBe("body");
      expect(searchArgv[4]).toBe(searchQuery); // index 4 == marker 단일-source 운반.
      expect(searchArgv[5]).toBe("--json");
      expect(searchArgv[6]).toBe(REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS);
      expect(searchArgv[6]).toBe("number,title,body");
      expect(searchArgv[7]).toBe("--limit");
      expect(searchArgv[8]).toBe(REAL_DATA_RESULT_ISSUE_SEARCH_LIMIT);
      expect(searchArgv[8]).toBe("30");

      // 전체-벡터 위치-정합 확립 → marker 추출 헬퍼(indexOf 기반)와 index 4 가 일치함을
      // 교차 확인(canonical index 박제).
      expect(searchArgv.indexOf("--match") + 2).toBe(4);
      expect(extractSearchMarker(searchArgv)).toBe(searchArgv[4]);
    });
  });

  describe("search-argv marker 운반 위치-정합 변별성(branch — searchArgv[4] 만 입력(run-token) 종속·나머지 8 위치 비종속)", () => {
    it("(c) 같은 activities·results, 다른 run-token(gitSha/dateToken)으로 두 chain → searchArgv[4](marker)가 각 runPlan.run 의 commandArgs.searchQuery(=descriptor.marker, run-token 운반)와 일치(run 변경이 marker 위치에 정확히 전파), 그러나 searchArgv[0..3]·searchArgv[5..8](동사 prefix·--match body·--json 필드·--limit 값)는 두 chain 에서 동일 상수(입력 변경에 비종속) — searchArgv 가 marker 단일 위치만 입력 종속·나머지는 결정론 상수로 운반. 주의: marker 는 results 가 아니라 runPlan.run(dateToken@gitSha)에서 합성되므로 변별 입력은 run-token", () => {
      const activities = defaultActivities();
      const results = defaultResults();
      // run-token 만 달리한 두 runPlan(marker 합성 source) — activities·results 동일.
      const runPlanA = buildRunPlan(MODEL_ID, "abc1234", "2026-06-28");
      const runPlanB = buildRunPlan(MODEL_ID, "def5678", "2026-07-01");
      const chainA = runChain([7, 13], runPlanA, activities, results);
      const chainB = runChain([7, 13], runPlanB, activities, results);

      const argvA = chainA.stepArgs.publish.searchArgv;
      const argvB = chainB.stepArgs.publish.searchArgv;

      // searchArgv[4](marker)가 각 chain 의 searchQuery(=descriptor.marker)와 일치.
      expect(argvA[4]).toBe(chainA.stepArgs.publish.commandArgs.searchQuery);
      expect(argvB[4]).toBe(chainB.stepArgs.publish.commandArgs.searchQuery);
      expect(argvA[4]).toBe(chainA.stepArgs.publish.report.descriptor.marker);
      expect(argvB[4]).toBe(chainB.stepArgs.publish.report.descriptor.marker);
      // run-token 변경이 marker 위치(index 4)에 전파(변별) — 각 run-token 포함.
      expect(argvA[4]).toContain("2026-06-28@abc1234");
      expect(argvB[4]).toContain("2026-07-01@def5678");
      expect(argvA[4]).not.toBe(argvB[4]);

      // 나머지 8 위치(0..3, 5..8)는 두 chain 에서 동일 결정론 상수(입력 비종속).
      [0, 1, 2, 3, 5, 6, 7, 8].forEach((i) => {
        expect(argvA[i]).toBe(argvB[i]);
      });
      expect(argvA[6]).toBe(REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS);
      expect(argvB[8]).toBe(REAL_DATA_RESULT_ISSUE_SEARCH_LIMIT);
    });
  });

  describe("resolve-argv update/create 위치-정합 수렴(branch — 12-way 묶음 항 — 축 12)", () => {
    it('(d) search hit N → resolvePlan.argv deep-equal ["issue","edit",String(N),"--title",updateArgs.title,"--body",updateArgs.body](gh-argv 148행), search hit 0("[]") → ["issue","create","--title",createArgs.title,"--body",createArgs.body,"--label","realdata-e2e","--label","result"](gh-argv 116·119행)', () => {
      const N = 7;
      const { stepArgs, resolvePlan } = runChain([N, 13]);
      if (resolvePlan.action.action !== "update") {
        throw new Error("update action 기대");
      }
      const updateArgs = stepArgs.publish.commandArgs.updateArgs;
      const createArgs = stepArgs.publish.commandArgs.createArgs;

      // update 분기 argv 위치-정합.
      expect(resolvePlan.argv).toEqual([
        "issue",
        "edit",
        String(N),
        "--title",
        updateArgs.title,
        "--body",
        updateArgs.body,
      ]);

      // create 분기 argv 위치-정합(빈 hit).
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

  describe("publish-leg command-args-labels 고정-상수 일치(branch — 묶음 항 — 축 11)", () => {
    it('(e) stepArgs.publish.commandArgs.createArgs.labels deep-equal ["realdata-e2e","result"] 고정 결정론 분류 상수(command-args.ts 64행 RESULT_ISSUE_LABELS)', () => {
      const { stepArgs } = runChain([7, 13]);
      expect(stepArgs.publish.commandArgs.createArgs.labels).toEqual(
        EXPECTED_RESULT_ISSUE_LABELS,
      );
      expect("labels" in stepArgs.publish.commandArgs.updateArgs).toBe(false);
    });
  });

  describe("publish-leg command-args-title/body 두 경로 일치(branch — 묶음 항 — 축 9~10)", () => {
    it("(f) createArgs.title·updateArgs.title 둘 다 === report.descriptor.title, createArgs.body·updateArgs.body 둘 다 === report.descriptor.body byte-identical(toBe)", () => {
      const { stepArgs } = runChain([7, 13]);
      const descriptorTitle = stepArgs.publish.report.descriptor.title;
      const descriptorBody = stepArgs.publish.report.descriptor.body;
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
    it("(g) descriptor.{title,body}·report.summary === buildRealDataResultIssueCommandPlan(results, runPlan.run).report.{descriptor.{title,body},summary} byte-identical(toBe·toEqual)", () => {
      const runPlan = buildRunPlan();
      const results = defaultResults();
      const { stepArgs } = runChain(
        [7, 13],
        runPlan,
        defaultActivities(),
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

  describe("evaluation-leg inputs 재유도 + callArgs.input 페어링 + modelId thread(branch — 축 4~5)", () => {
    it("(h) evaluation.inputs deep-equal buildRealDataEvaluationInputs(activities), 모든 callArgs[i].input === inputs[i](toBe, forEach)·길이 일치, 모든 callArgs[i].options.modelId === runPlan.pipeline.modelId(toBe)", () => {
      const runPlan = buildRunPlan();
      const activities = defaultActivities();
      const { stepArgs } = runChain([7, 13], runPlan, activities);

      const directInputs = buildRealDataEvaluationInputs(activities);
      expect(stepArgs.evaluation.inputs).toEqual(directInputs);
      expect(stepArgs.evaluation.inputs).toHaveLength(activities.length);
      expect(stepArgs.evaluation.callArgs.length).toBe(
        stepArgs.evaluation.inputs.length,
      );
      stepArgs.evaluation.callArgs.forEach((c, i) => {
        expect(c.input).toBe(stepArgs.evaluation.inputs[i]);
        expect(c.options.modelId).toBe(runPlan.pipeline.modelId);
      });
      expect(runPlan.pipeline.modelId).toBe(MODEL_ID);
    });
  });

  describe("publish-leg marker 3-축 일치(branch — searchArgv 전체-벡터 index 4 로 명시 — 축 2~3)", () => {
    it("(i) report.descriptor.marker === commandArgs.searchQuery === searchArgv[4] 세 지점 byte-identical(toBe), marker 가 searchArgv 안 정확히 1회 등장, searchArgv[4] 직접 인덱싱 == extractSearchMarker(searchArgv)", () => {
      const { stepArgs } = runChain([7, 13]);
      const descriptorMarker = stepArgs.publish.report.descriptor.marker;
      const searchArgv = stepArgs.publish.searchArgv;

      expect(stepArgs.publish.commandArgs.searchQuery).toBe(descriptorMarker);
      // 본 task 의 핵심 — marker 추출을 헬퍼 대신 canonical index 4 직접 인덱싱으로 박제.
      expect(searchArgv[4]).toBe(descriptorMarker);
      // 변별 보조 — indexOf 기반 추출도 같은 위치를 가리킴.
      expect(extractSearchMarker(searchArgv)).toBe(descriptorMarker);
      expect(
        searchArgv.filter((token) => token === descriptorMarker),
      ).toHaveLength(1);
    });
  });

  describe("marker → resolve issueNumber + post run-identity 수렴(branch — 축 1, 종단)", () => {
    it("(j) search hit N → resolvePlan.action.update.issueNumber → argv[2]==String(N) → outcomeReport.issueNumber 모두 동일 N(toBe(N)) AND outcomeReport.url 에 /issues/N AND 동일 runPlan.run 전파(marker run token == outcomeReport.{gitSha,dateToken,summaryLine})", () => {
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

  describe("13-way 단일-source 묶음 단언(branch — closure 종단, 본 task 의 종단 박제)", () => {
    it("(k) searchArgv == ['search','issues','--match','body',marker,'--json','number,title,body','--limit','30'] AND searchArgv[4]==marker==commandArgs.searchQuery==descriptor.marker, update argv == ['issue','edit',String(N),...updateArgs], create argv == ['issue','create',...createArgs,...labels flag-pair], argv 위치별 title/body == descriptor.{title,body} == 동 command-plan, argv labels == createArgs.labels == ['realdata-e2e','result'], report.summary == 동 command-plan, evaluation.inputs == buildRealDataEvaluationInputs(activities), callArgs[].input===inputs[i], modelId == runPlan.pipeline.modelId, searchArgv[4] marker 로 resolve 가 찾은 N == argv[2]==String(N) == post N, run token == post {gitSha,dateToken} 가 세 검증 source single-source 에서 13-way 동시 성립", () => {
      const N = 7;
      const runPlan = buildRunPlan();
      const activities = defaultActivities();
      const results = defaultResults();
      const stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results);
      const marker = stepArgs.publish.report.descriptor.marker;
      const token = expectedToken(runPlan.run);
      const cmdPlan = buildRealDataResultIssueCommandPlan(results, runPlan.run);
      const createArgs = stepArgs.publish.commandArgs.createArgs;
      const updateArgs = stepArgs.publish.commandArgs.updateArgs;
      const searchQuery = stepArgs.publish.commandArgs.searchQuery;

      // 같은 stepArgs 로 두 분기 resolve.
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

      // axis 13(새 표면) — searchArgv 전체-벡터 byte-identical 위치-정합.
      expect(stepArgs.publish.searchArgv).toEqual(
        expectedSearchArgv(searchQuery),
      );
      expect(stepArgs.publish.searchArgv[4]).toBe(marker);
      expect(stepArgs.publish.searchArgv[4]).toBe(searchQuery);
      // axis 12 — update/create 두 분기 argv 위치-정합 byte-identical.
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
      // argv 위치별 title/body 값 == descriptor.{title,body} == 동 command-plan.
      expect(resolveUpdate.argv[4]).toBe(
        stepArgs.publish.report.descriptor.title,
      );
      expect(resolveUpdate.argv[6]).toBe(
        stepArgs.publish.report.descriptor.body,
      );
      expect(resolveCreate.argv[3]).toBe(cmdPlan.report.descriptor.title);
      expect(resolveCreate.argv[5]).toBe(cmdPlan.report.descriptor.body);
      // axis 11 — argv labels 값 == createArgs.labels == 고정 상수.
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
      // axis 4~5 — evaluation.inputs deep-equal + callArgs 페어링 + modelId.
      const directInputs = buildRealDataEvaluationInputs(activities);
      expect(stepArgs.evaluation.inputs).toEqual(directInputs);
      stepArgs.evaluation.callArgs.forEach((c, i) => {
        expect(c.input).toBe(stepArgs.evaluation.inputs[i]);
        expect(c.options.modelId).toBe(runPlan.pipeline.modelId);
      });
      // axis 2~3 — marker 3-축(searchArgv[4] 직접 인덱싱).
      expect(stepArgs.publish.commandArgs.searchQuery).toBe(marker);
      expect(stepArgs.publish.searchArgv[4]).toBe(marker);
      // axis 1 — resolve N == argv[2] == post N + run token 전파.
      expect(resolveUpdate.action.issueNumber).toBe(N);
      expect(resolveUpdate.argv[2]).toBe(String(N));
      expect(outcomeReport.issueNumber).toBe(N);
      expect(marker).toContain(token);
      expect(outcomeReport.gitSha).toBe(runPlan.run.gitSha);
      expect(outcomeReport.dateToken).toBe(runPlan.run.dateToken);
      // 13-way 동시 closure — 세 검증 source single-source 에서 열세 축이 묶임.
      expect(`${runPlan.run.dateToken}@${runPlan.run.gitSha}`).toBe(token);
    });
  });

  describe("create/update 두 분기 격리 — searchArgv 는 분기 비종속(branch)", () => {
    it("(l) 동일 runPlan·activities·results, searchStdout 만 (hit 1+ vs hit 0)으로 달리해 → 한쪽 update·다른 쪽 create 분기. stepArgs.publish.searchArgv 는 두 chain 에서 byte-identical(검색 결과가 first-step search 벡터를 바꾸지 0 — searchArgv 는 검색 실행 전 합성, 검색 결과는 second-step resolve-argv 만 분기) AND 두 resolvePlan.argv 는 동사·issueNumber·labels 위치만 다르고 title/body 운반 값은 단일-source 불변", () => {
      const runPlan = buildRunPlan();
      const activities = defaultActivities();
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

      // searchArgv 는 분기 비종속 — 같은 stepArgs 한 객체의 단일 searchArgv(검색 실행 전 합성).
      // 명시적으로 canonical 9-원소 전체-벡터로 고정됨을 확인(검색 결과 무관).
      expect(stepArgs.publish.searchArgv).toEqual(expectedSearchArgv(marker));
      expect(stepArgs.publish.searchArgv).toHaveLength(9);

      // 분기 동사 차이 — searchArgv 가 아니라 resolve-argv(second-step)만 분기.
      expect(resolveUpdate.argv[1]).toBe("edit");
      expect(resolveCreate.argv[1]).toBe("create");
      // 두 argv 모두 같은 단일-source title/body 운반(검색 결과가 본문/제목 안 바꿈).
      expect(resolveUpdate.argv[4]).toBe(descriptorTitle);
      expect(resolveCreate.argv[3]).toBe(descriptorTitle);
      expect(resolveUpdate.argv[6]).toBe(descriptorBody);
      expect(resolveCreate.argv[5]).toBe(descriptorBody);
      // create argv 에만 --label flag-pair, update argv 에만 String(N).
      expect(resolveCreate.argv).toContain("--label");
      expect(resolveUpdate.argv).not.toContain("--label");
      expect(resolveUpdate.argv[2]).toBe("7");
    });
  });

  describe("error path / negative cases — boundary 거부 대칭 박제(R-112 negative 충분 cover)", () => {
    it("(m) runPlan.pipeline.modelId 빈('') → run-plan 합성(buildRealDataE2eRunPlan) 측 modelId guard throw(searchArgv 합성 도달 전 차단)", () => {
      const seeds = buildRealDataE2eSeed();
      expect(() =>
        buildRealDataE2eRunPlan(seeds, "", {
          gitSha: "abc1234",
          dateToken: "2026-06-29",
        }),
      ).toThrow();
    });

    it("(m') runPlan.pipeline.modelId 공백-only('   ') 우회 합성 → aggregator 측 evaluation 위임 하위 modelId guard throw(inputs·searchArgv 재유도 도달 전 차단)", () => {
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

    it("(n) runPlan.run.gitSha 빈('') → aggregator 측 publish 위임 descriptor assertNonBlank('gitSha') throw(descriptor.marker·searchQuery·searchArgv 합성 도달 전 차단)", () => {
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

    it("(n') runPlan.run.dateToken 빈('') → aggregator 측 publish 위임 descriptor assertNonBlank('dateToken') throw 대칭(searchArgv 합성 도달 전 차단)", () => {
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

    it("(o) runPlan.run.gitSha 빈('') → post(buildRealDataResultOutcomeStepArgs) 위임 assertNonBlank throw(post boundary 비식별 — execStdout 정상이어도 차단, aggregator/post 대칭)", () => {
      const base = buildRunPlan();
      const blankRunPlan: RealDataE2eRunPlan = {
        pipeline: base.pipeline,
        run: { gitSha: "", dateToken: "2026-06-29" },
      };
      expect(() =>
        buildRealDataResultOutcomeStepArgs(blankRunPlan, execStdout(7)),
      ).toThrow();
    });

    it("(p) searchStdout 비JSON('not json') → resolve parse 위임 throw(stepArgs.publish.commandArgs·searchArgv 정상이어도 resolve argv 합성 도달 전 차단)", () => {
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

    it("(q) searchStdout hit number 비양수([{number:0,...}] marker 매칭) → resolve action assertPositiveNumber throw(비정상 number 가 update issueNumber·argv[2] 로 새는 것 차단)", () => {
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

    it("(r) execStdout URL 미발견(빈 문자열) → post 파서 위임 throw(runPlan.run 정상이어도 outcome 추출 실패)", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(buildRunPlan(), ""),
      ).toThrow();
    });

    it("(r') execStdout /issues/0 → post 파서 assertPositiveIssueNumber throw(post 비식별)", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(
          buildRunPlan(),
          `https://github.com/${OWNER}/${REPO}/issues/0\n`,
        ),
      ).toThrow();
    });

    // search-argv 축 negative — searchArgv 는 buildRealDataResultIssueSearchGhArgv 가
    // commandArgs.searchQuery 빈/공백 시 throw(search-argv 90~96행)하나, 본 task chain 에서
    // searchQuery(=descriptor.marker)는 aggregator 가 합성(정상 descriptor 면 비-empty)하므로
    // search-argv 축 boundary 는 descriptor 상위 guard(gitSha/dateToken — marker 합성 source)가
    // 차단함을 보이는 boundary 대칭. blank gitSha(run.gitSha='   ')이 descriptor.marker 합성 실패
    // → aggregator publish 위임 assertNonBlank throw 로 step-args·searchArgv 산출 도달 전 차단.
    it("(s) search-argv 축 negative — searchArgv 합성 도달 전 marker guard 상위 차단(boundary 대칭). blank gitSha(run.gitSha='   ')이 descriptor.marker 합성 실패 → aggregator publish 위임 assertNonBlank throw 로 step-args·searchArgv 산출 도달 전 차단. 정상 run → searchArgv 항상 비-empty canonical 9-원소", () => {
      // 정상 run → searchArgv 항상 비-empty 9-원소.
      const { stepArgs } = runChain([7, 13]);
      expect(stepArgs.publish.searchArgv.length).toBe(9);
      stepArgs.publish.searchArgv.forEach((token) => {
        expect(typeof token).toBe("string");
        expect(token.length).toBeGreaterThan(0);
      });

      // blank gitSha → marker 합성 도달 전 상위 run-token guard 로 차단(searchArgv 미도달).
      const runPlan = buildRunPlan();
      const blankRunPlan: RealDataE2eRunPlan = {
        pipeline: runPlan.pipeline,
        run: { gitSha: "   ", dateToken: "2026-06-29" },
      };
      expect(() =>
        buildRealDataE2eStepArgs(
          blankRunPlan,
          defaultActivities(),
          defaultResults(),
        ),
      ).toThrow();
    });
  });

  describe("결정론·무공유·no-mutation — chain 두 번 호출 + 입력 불변 + searchArgv 오염 0", () => {
    it("(t) 동일 (runPlan, activities, results, searchStdout, execStdout) chain 두 번 → stepArgs(searchArgv 포함)/resolvePlan(argv 포함)/outcomeReport 모두 deep-equal(결정론)", () => {
      const runPlan = buildRunPlan();
      const activities = defaultActivities();
      const results = defaultResults();
      const chain1 = runChain([7, 13], runPlan, activities, results);
      const chain2 = runChain([7, 13], runPlan, activities, results);

      expect(chain1.stepArgs.evaluation).toEqual(chain2.stepArgs.evaluation);
      expect(chain1.stepArgs.publish).toEqual(chain2.stepArgs.publish);
      expect(chain1.stepArgs.publish.searchArgv).toEqual(
        chain2.stepArgs.publish.searchArgv,
      );
      expect(chain1.resolvePlan).toEqual(chain2.resolvePlan);
      expect(chain1.outcomeReport).toEqual(chain2.outcomeReport);
    });

    it("(u) no-mutation — 입력 runPlan·activities·results chain 호출 후 deep-equal(원본 불변)", () => {
      const runPlan = buildRunPlan();
      const activities = defaultActivities();
      const results = defaultResults();
      const runPlanBefore = JSON.parse(JSON.stringify(runPlan));
      const activitiesBefore = JSON.parse(JSON.stringify(activities));
      const resultsBefore = JSON.parse(JSON.stringify(results));

      const { stepArgs } = runChain([7, 13], runPlan, activities, results);
      buildRealDataResultIssueCommandPlan(results, runPlan.run);
      void stepArgs;

      expect(runPlan).toEqual(runPlanBefore);
      expect(activities).toEqual(activitiesBefore);
      expect(results).toEqual(resultsBefore);
    });

    it("(v) searchArgv 오염 0 — stepArgs.publish.searchArgv.push('x') 후 새 chain 의 searchArgv 가 여전히 canonical 9-원소(이전 호출 반환 mutate 누설 0 — 매 호출 새 searchArgv 배열, 무공유)", () => {
      const first = runChain([7, 13]);
      const firstLen = first.stepArgs.publish.searchArgv.length;
      // 반환 searchArgv 배열 mutate(오염 시도).
      first.stepArgs.publish.searchArgv.push("x");
      expect(first.stepArgs.publish.searchArgv).toContain("x");
      expect(first.stepArgs.publish.searchArgv.length).toBe(firstLen + 1);

      // 새 chain 의 searchArgv 는 여전히 canonical 9-원소(이전 호출 mutate 누설 0).
      const second = runChain([7, 13]);
      expect(second.stepArgs.publish.searchArgv).not.toContain("x");
      expect(second.stepArgs.publish.searchArgv).toHaveLength(9);
      expect(second.stepArgs.publish.searchArgv[0]).toBe("search");
      expect(second.stepArgs.publish.searchArgv[1]).toBe("issues");
      expect(second.stepArgs.publish.searchArgv).toEqual(
        expectedSearchArgv(second.stepArgs.publish.commandArgs.searchQuery),
      );
    });
  });

  describe("credential 누출 0(branch — §9 / R-59 / REQ-059 정합)", () => {
    it("(w) stepArgs.publish.searchArgv(join, 실 execFile('gh', searchArgv) first-step 인자-벡터) · resolvePlan.argv(join) · commandArgs.{createArgs.{title,body,labels(join)},updateArgs.{title,body},searchQuery} · report.descriptor.{title,marker,body} · report.summary(직렬화) · evaluation.inputs·callArgs(직렬화) · outcomeReport.{url,summaryLine} 어디에도 token/secret/PAT/--auth 어휘 미등장(특히 실 gh searchArgv 명시)", () => {
      const { stepArgs, resolvePlan, outcomeReport } = runChain([7, 13]);
      const resolveCreate = resolveRealDataResultIssueGhCommandPlan(
        "[]",
        stepArgs.publish.commandArgs,
      );

      const surfaces: string[] = [
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
      // searchArgv 각 원소(실 gh first-step 인자-벡터)에 credential 어휘 미등장 명시.
      stepArgs.publish.searchArgv.forEach((token) => {
        expect(token).not.toMatch(credentialPattern);
      });
      // outcome url 은 issue 경로만 — commit/PR narrative 어휘 미포함.
      expect(outcomeReport.url).not.toMatch(/commit|pull request/i);
    });
  });
});
