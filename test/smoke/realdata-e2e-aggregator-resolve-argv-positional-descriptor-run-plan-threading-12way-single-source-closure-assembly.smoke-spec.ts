// realdata-e2e-aggregator-resolve-argv-positional-descriptor-run-plan-threading-12way-single-source-closure-assembly.smoke-spec.ts
// — 실 평가 e2e step④ aggregator resolve-argv 위치-정합 합류 12-way single-source closure:
// pre-실행 aggregator `buildRealDataE2eStepArgs(runPlan, activities, results)` 의 publish leg
// command-args 객체 필드값(createArgs/updateArgs.{title,body}·createArgs.labels)이 실제로
// live runner 가 `execFile('gh', argv)` 로 거는 **gh CLI 인자-벡터(argv) 의 정확한 위치**로
// byte-identical 조립됨을 12번째 축으로 합류시킨다. 즉 `resolvePlan = resolveRealDataResult
// IssueGhCommandPlan(searchStdout, stepArgs.publish.commandArgs)` 의 `resolvePlan.argv` 가:
//   - **update 분기**(검색 hit 1+) — `["issue","edit",String(N),"--title",updateArgs.title,
//     "--body",updateArgs.body]`(gh-argv 148행). `argv[2]==String(N)`, `argv[4]==updateArgs
//     .title(=descriptor.title)`, `argv[6]==updateArgs.body(=descriptor.body)`.
//   - **create 분기**(검색 hit 0) — `["issue","create","--title",createArgs.title,"--body",
//     createArgs.body,"--label","realdata-e2e","--label","result"]`(gh-argv 116·119행).
//     `argv[3]==createArgs.title`, `argv[5]==createArgs.body`, labels 가 `--label`,값 flag-pair
//     로 순서 보존 전개(`argv[6..]==["--label","realdata-e2e","--label","result"]`).
//
// 이 resolve-argv 위치-정합 축(축 12, 본 task 의 새 표면)이 다음 11 축과 함께 세 검증 source
// `(runPlan, activities, results)` single-source 로 12-way 동시 수렴함을 한 chain 으로 박제한다:
//   (축 12, 새 표면) resolvePlan.argv 위치-정합 운반(create/update 두 분기 argv[idx] ==
//       단일-source command-args 필드값 byte-identical + labels flag-pair 전개).
//   (축 11) command-args createArgs.labels 고정-상수 `["realdata-e2e","result"]` 일치.
//   (축 9~10) command-args {create,update}Args.{title,body} 두 경로 == descriptor.{title,body}.
//   (축 6~8) descriptor.{title,body}·summary command-plan 경유 재유도 byte-identical.
//   (축 4~5) evaluation.inputs == buildRealDataEvaluationInputs(activities), callArgs[i].input
//       === inputs[i], callArgs[i].options.modelId === runPlan.pipeline.modelId.
//   (축 2~3) publish leg 내부 marker 3-축 — descriptor.marker / commandArgs.searchQuery /
//       searchArgv(--match 다음 토큰) 동일.
//   (축 1, 종단) marker → resolve issueNumber(argv[2]==String(N)) → post run-identity —
//       `buildRealDataResultOutcomeStepArgs(runPlan, execStdout)` 가 동일 runPlan.run 전파.
//
// 이 12-way 가 세 검증 source single-source 에서 한 chain 동시-호출로 수렴함이 search-or-update
// 멱등성(REQ-009 — 검색 결과에 따라 같은 단일-source 필드값이 create/edit argv 위치로 동형
// 조립)·raw 미보유 평가 입력/결과 집계 정합(REQ-032)·결과 리포트 재실행 정합(REQ-037)·credential
// 미보유(REQ-059)의 aggregator-level "command-args 필드값이 실 gh CLI 인자-벡터 위치로
// byte-identical 조립됨(create/update 두 분기)이 같은 세 검증 source 의 산물" 의 종단 닫음이다.
// command-args 객체 surface(필드, T-0778~0780)와 resolve-argv surface(실행 벡터 위치)가 모두
// 단일-source 로 묶이는 slice. (T-0781 박제, PLAN.md 109행 🟢 실 평가 e2e step④).
//
// 본 spec 의 존재 이유 — public CI gap 해소(resolve-argv 위치-정합 축을 12번째 축으로 합류):
//   - aggregator `buildRealDataE2eStepArgs(runPlan, activities, results)`(T-0601)는 세 입력
//     source 를 받는다. T-0780 이 publish leg 의 command-args 객체 surface 세 개(body·title·
//     labels)를 모두 단일 source 산출과 byte-identical/고정-상수로 묶어 11-way 를 완성했다.
//   - 그러나 그 필드값들이 실제로 live runner 가 `execFile('gh', argv)` 로 거는 gh CLI
//     인자-벡터(argv) 의 정확한 위치로 조립됨은 아직 convergence closure 에 미합류된 distinct
//     표면이다 — aggregator+resolvePlan.argv 참조 smoke 9파일 전부 argv 참조는 `argv[0]=="issue"`
//     ·`argv[1]=="edit"` 동사 shape + `argv.join(" ")` credential-negative 일 뿐, argv 위치별
//     title/body/label 값 == 단일-source command-args 필드 byte-identical 축은 미합류였다.
//   - gh-argv self-guard(`assertRealDataResultIssueGhArgvPreservesCommandArgs`, T-0650/0652)가
//     빌더 내부 self-wire 로 argv↔command-args round-trip 을 박제했으나 aggregator
//     (`buildRealDataE2eStepArgs`) 진입·resolve·post 미합류(빌더 단독 self-guard).
//   - 본 spec 은 그 빈 자리를 채워 **publish leg 의 command-args 필드값들이 resolve 가 조립한
//     실 gh CLI argv 위치로 byte-identical 운반됨(create/update 두 분기)을 같은 aggregator
//     산출 + descriptor 재유도와 묶어 closure 에 합류**시킨다.
//   - live leg(실 prisma·실 collectForPerson·실 github.com fetch·실 LLM scoring·실 gh CLI
//     실행·DB·LAN gate)는 복제하지 않고, synthetic runPlan(buildRealDataE2eRunPlan 합성) +
//     activities/results literal + search-stdout/exec-stdout literal 을 컴포저들에 직접 공급해
//     live leg 를 우회한다(조립 surface 만 검증). 따라서 본 spec 은:
//
//      🔥 실 gh 호출 0 — gh search / list / create / edit / execFile('gh', argv) 미실행.
//         synthetic searchStdout / execStdout / runPlan / activities / results literal 직접 공급.
//         resolvePlan.argv 는 gh CLI 인자-벡터 위치-정합 운반만 검증(실 gh 실행 0).
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 LLM scoreUnit 호출 0 / 실 DB 접근 0 / 실 jest spawn 0 — 12-way 수렴 조립만.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 step-args aggregator / evaluation-inputs / command-plan
//         / gh-command-plan(resolve) / outcome-step-args / run-plan / seed-fixture 컴포저 import
//         재사용만(가드/helper 신설 0). `extractSearchMarker` 는 spec 로컬 함수(T-0780/T-0729
//         패턴 차용).
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0781):
//   - src 변경 0(src/, prisma/, package.json, CI workflow, 환경 변수 추가 등 모두 금지). test-only.
//   - 실 gh CLI 호출 / `execFile('gh', argv)` 실행 / `execFile('gh', searchArgv)` 실행 / 실 LLM
//     scoreUnit 호출 / 실 issue 검색·박제(step④ live wiring — credential gate, deferred).
//     resolvePlan.argv 는 gh CLI 인자-벡터 위치-정합 운반만 검증.
//   - aggregator 11-way(command-args labels 고정상수 + title/body 두 경로 + descriptor.{title,
//     body} 재유도 + summary + inputs + callArgs.input 페어링 + modelId + marker/searchArgv/
//     run-identity) 자체 재단언(T-0780 cover). 본 task 는 resolvePlan.argv 위치-정합(create/
//     update 두 분기 argv[idx]==command-args 필드값 byte-identical + labels flag-pair 전개)을
//     12번째 축으로 합류시킨 부분만(나머지 축은 12-way 묶음 표현용 동시-성립 확인).
//   - gh-argv self-guard(`assertRealDataResultIssueGhArgvPreservesCommandArgs`, T-0650/0652)
//     자체 재단언. 본 task 는 aggregator → resolve 산출 argv 가 단일-source command-args 필드를
//     위치 정합 운반함만(self-guard 내부 로직 재검증 0).
//   - resolve 3-단계 합성 순서·self-consistency 가드(`assertRealDataResultIssueGhCommandPlan
//     ConsistentWithInputs`, T-0698) 자체 재단언. 본 task 는 산출 plan 의 argv 위치값만.
//   - create/update 분기 결정 로직 자체(`resolveRealDataResultIssueAction` 최소 number·marker
//     매칭) 재단언. 본 task 는 분기 결과 argv 형태만 소비.
//   - descriptor.title/body 합성 로직·summary 집계 로직 자체 재단언(helper spec cover).
//   - 난이도별 modelId routing(R-97 deferred) — 단일 modelId 동형 적용(ADR-0048)만.
//   - RESULT_ISSUE_LABELS 상수 값 정책 변경/재정의 — helper 박제 현재 값을 그대로 단언만.
//   - searchArgv 전체 형식·`--repo owner/repo` 인자 등 resolve argv 의 repo context wiring
//     재단언(gh-argv Out of Scope). 본 task 는 issue create/edit 핵심 인자(동사·title·body·
//     label·issueNumber) 위치만.
//   - from-output 단독 5필드 재유도 재단언(T-0747 cover). 본 task 는 12-way 수렴만.
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
  "cfg-realdata-e2e-aggregator-resolve-argv-positional-descriptor-resolve-threading-smoke";

const INSTANCE_KEY = "github.com";

// 고정 결정론 분류 라벨 — command-args.ts 64행 `RESULT_ISSUE_LABELS = ["realdata-e2e",
// "result"]` 가 박제한 현재 값. create 분기 argv 의 `--label` flag-pair 로 전개될 expected.
const EXPECTED_RESULT_ISSUE_LABELS = ["realdata-e2e", "result"];

// search argv 안 marker 추출 헬퍼 — 빌더 canonical shape (["search","issues","--match",
// "body",<marker>,"--json",...,"--limit","30"]) 에서 marker 는 `--match body` 직후다.
// 위치 매직 넘버 대신 `--match` 기준 상대 추출(round-trip drift 강건). T-0780/T-0729
// sibling 헬퍼 패턴 mirror(spec 로컬 — 새 helper 신설 0).
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
  externalId = "realdata-e2e-aggregator-resolve-argv-c1",
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
    syntheticActivity(firstUsername, "aggregator-resolve-argv-c1", "commit"),
    syntheticActivity(firstUsername, "aggregator-resolve-argv-p1", "pr"),
    syntheticActivity(firstUsername, "aggregator-resolve-argv-i1", "issue"),
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
      "synthetic evaluation narrative — aggregator resolve-argv-positional+command-args-{title,body,labels}+descriptor-{title,body}+results-summary+evaluation-inputs+modelId+searchArgv ↔ resolve ↔ outcome-step-args run-plan-threading 12-way closure smoke fixture",
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

// 다른 분포(Y) results fixture — argv title/body 변별성 단언용. labels 는 두 분포에서 불변.
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
// resolve(search-stdout + stepArgs.publish.commandArgs → {action, argv}) →
// post step-args(buildRealDataResultOutcomeStepArgs(runPlan, execStdout))를 single-source(
// **동일 runPlan 한 객체** + activities + results + N)로 묶어 한 chain 으로 호출하는 헬퍼.
// 핵심: aggregator·post 두 곳에 **같은 runPlan 객체를 넘긴다**(독립 run 인자 재전달 0).
// 본 task 의 새 표면 = resolvePlan.argv 위치-정합(축 12, update 분기 — hit 1+).
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

describe('Smoke(non-gated): 실 평가 e2e step④ aggregator resolve-argv 위치-정합 합류 12-way single-source closure buildRealDataE2eStepArgs → resolveRealDataResultIssueGhCommandPlan(.publish.commandArgs).argv(update == ["issue","edit",String(N),"--title",updateArgs.title,"--body",updateArgs.body] / create == ["issue","create","--title",createArgs.title,"--body",createArgs.body,"--label","realdata-e2e","--label","result"] — argv 위치별 값 == 단일-source command-args 필드 byte-identical + labels flag-pair 전개) + command-args labels 고정상수 + command-args {title,body} 두 경로(=descriptor.{title,body}) + descriptor.{title,body}·summary 재유도 + evaluation {inputs(=buildRealDataEvaluationInputs(activities), callArgs[i].input===inputs[i]), modelId} + marker 3-축 + resolve issueNumber(argv[2]==String(N)) + post run-identity ↔ buildRealDataResultOutcomeStepArgs 동일 (runPlan, activities, results) 한 chain 동시-호출 12축 동시 수렴 live-gh/live-LLM 0 검증', () => {
  describe("happy path — aggregator 12-way chain 합성(다섯 산출물 + 비어있지 않은 argv)", () => {
    it("(a) 유효 runPlan + activities + results + searchStdout + execStdout → stepArgs.evaluation({inputs,callArgs} 비어있지 않음) / stepArgs.publish({report,commandArgs,searchArgv} 정상) / resolvePlan(update {action, issueNumber} + 비어있지 않은 string[] argv) / outcomeReport(5필드) 모두 정상", () => {
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
      expect(
        Array.isArray(stepArgs.publish.commandArgs.createArgs.labels),
      ).toBe(true);
      expect(
        stepArgs.publish.commandArgs.createArgs.labels.length,
      ).toBeGreaterThan(0);
      expect(typeof stepArgs.publish.commandArgs.createArgs.title).toBe(
        "string",
      );
      expect(typeof stepArgs.publish.commandArgs.updateArgs.body).toBe(
        "string",
      );
      expect(typeof stepArgs.publish.report.descriptor.title).toBe("string");
      expect(typeof stepArgs.publish.report.summary).toBe("object");

      // stage 2 — resolve plan(update {action, issueNumber} + 비어있지 않은 string[] argv).
      expect(resolvePlan.action.action).toBe("update");
      if (resolvePlan.action.action !== "update") {
        throw new Error("update action 기대");
      }
      expect(typeof resolvePlan.action.issueNumber).toBe("number");
      // 축 12 reachable — argv 가 비어있지 않은 string 배열.
      expect(Array.isArray(resolvePlan.argv)).toBe(true);
      expect(resolvePlan.argv.length).toBeGreaterThan(0);
      resolvePlan.argv.forEach((token) => {
        expect(typeof token).toBe("string");
      });
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

  describe("resolve-argv update-분기 위치-정합 수렴(branch — 핵심 불변식 1, 본 task 의 새 표면 — 축 12)", () => {
    it('(b) search hit N(1+) → resolvePlan.argv deep-equal(toEqual) ["issue","edit",String(N),"--title",updateArgs.title,"--body",updateArgs.body] byte-identical(gh-argv 148행), 위치별: argv[0]=="issue", argv[1]=="edit", argv[2]==String(N)(=resolvePlan.action.update.issueNumber 문자열화), argv[3]=="--title", argv[4]===updateArgs.title(toBe), argv[5]=="--body", argv[6]===updateArgs.body(toBe)', () => {
      const N = 7;
      const { stepArgs, resolvePlan } = runChain([N, 13]);
      if (resolvePlan.action.action !== "update") {
        throw new Error("update action 기대");
      }
      const updateArgs = stepArgs.publish.commandArgs.updateArgs;

      // 핵심 — argv 전체가 byte-identical deep-equal(원소·순서·길이).
      expect(resolvePlan.argv).toEqual([
        "issue",
        "edit",
        String(N),
        "--title",
        updateArgs.title,
        "--body",
        updateArgs.body,
      ]);
      expect(resolvePlan.argv).toHaveLength(7);

      // 위치별 단언(gh-argv 148행 시그니처 그대로).
      expect(resolvePlan.argv[0]).toBe("issue");
      expect(resolvePlan.argv[1]).toBe("edit");
      expect(resolvePlan.argv[2]).toBe(String(N));
      expect(resolvePlan.argv[2]).toBe(String(resolvePlan.action.issueNumber));
      expect(resolvePlan.argv[3]).toBe("--title");
      expect(resolvePlan.argv[4]).toBe(updateArgs.title);
      expect(resolvePlan.argv[5]).toBe("--body");
      expect(resolvePlan.argv[6]).toBe(updateArgs.body);
    });
  });

  describe("resolve-argv create-분기 위치-정합 수렴(branch — 핵심 불변식 2, create leg — 축 12)", () => {
    it('(c) search hit 0("[]") → create 분기 → resolvePlan.argv deep-equal(toEqual) ["issue","create","--title",createArgs.title,"--body",createArgs.body,"--label","realdata-e2e","--label","result"] byte-identical(gh-argv 116·119행), 위치별: argv[3]===createArgs.title(toBe), argv[5]===createArgs.body(toBe), labels flag-pair 순서 보존 전개(argv[6]=="--label", argv[7]==labels[0], argv[8]=="--label", argv[9]==labels[1])', () => {
      const runPlan = buildRunPlan();
      const activities = defaultActivities();
      const results = defaultResults();
      const stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results);
      const createArgs = stepArgs.publish.commandArgs.createArgs;

      // 빈 hit → create 분기.
      const resolveCreate = resolveRealDataResultIssueGhCommandPlan(
        "[]",
        stepArgs.publish.commandArgs,
      );
      expect(resolveCreate.action.action).toBe("create");

      // 핵심 — create argv 전체 byte-identical deep-equal.
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
      expect(resolveCreate.argv).toHaveLength(10);

      // 위치별 단언(gh-argv 116·119행 시그니처).
      expect(resolveCreate.argv[0]).toBe("issue");
      expect(resolveCreate.argv[1]).toBe("create");
      expect(resolveCreate.argv[2]).toBe("--title");
      expect(resolveCreate.argv[3]).toBe(createArgs.title);
      expect(resolveCreate.argv[4]).toBe("--body");
      expect(resolveCreate.argv[5]).toBe(createArgs.body);

      // labels flag-pair 순서 보존 전개 — 각 원소 i 에 대해 ["--label", labels[i]] pair.
      expect(resolveCreate.argv[6]).toBe("--label");
      expect(resolveCreate.argv[7]).toBe(createArgs.labels[0]);
      expect(resolveCreate.argv[8]).toBe("--label");
      expect(resolveCreate.argv[9]).toBe(createArgs.labels[1]);
      // labels flag-pair 전개를 일반화 단언(원소 수 무관 검증).
      createArgs.labels.forEach((label, i) => {
        expect(resolveCreate.argv[6 + i * 2]).toBe("--label");
        expect(resolveCreate.argv[6 + i * 2 + 1]).toBe(label);
      });
    });
  });

  describe("publish-leg command-args-labels 고정-상수 일치(branch — 12-way 묶음 항 — 축 11)", () => {
    it('(d) stepArgs.publish.commandArgs.createArgs.labels deep-equal ["realdata-e2e","result"] 고정 결정론 분류 상수(byte-identical, command-args.ts 64행 RESULT_ISSUE_LABELS) — create 분기 argv 의 --label flag-pair 로 전개될 단일-source 라벨', () => {
      const { stepArgs } = runChain([7, 13]);

      expect(stepArgs.publish.commandArgs.createArgs.labels).toEqual(
        EXPECTED_RESULT_ISSUE_LABELS,
      );
      expect(stepArgs.publish.commandArgs.createArgs.labels.length).toBe(2);
      stepArgs.publish.commandArgs.createArgs.labels.forEach((label) => {
        expect(typeof label).toBe("string");
        expect(label.trim().length).toBeGreaterThan(0);
      });
      // updateArgs 에는 labels 부재(gh issue edit 은 본문/제목만 — 분류는 create 1회).
      expect("labels" in stepArgs.publish.commandArgs.updateArgs).toBe(false);
    });
  });

  describe("publish-leg command-args-title/body 두 경로 일치(branch — 12-way 묶음 항 — 축 9~10)", () => {
    it("(e) createArgs.title·updateArgs.title 둘 다 === report.descriptor.title, createArgs.body·updateArgs.body 둘 다 === report.descriptor.body byte-identical(toBe) — argv 위치로 전개될 title/body 단일-source 필드값", () => {
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
      expect(stepArgs.publish.commandArgs.createArgs.body).not.toBe(
        stepArgs.publish.commandArgs.createArgs.title,
      );
    });
  });

  describe("publish-leg descriptor-{title,body}·summary 재유도 byte-identical 수렴(branch — 축 6~8)", () => {
    it("(f) descriptor.{title,body}·report.summary === buildRealDataResultIssueCommandPlan(results, runPlan.run).report.{descriptor.{title,body},summary} byte-identical(toBe·toEqual)", () => {
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
      // command-args title/body(argv 운반 source)도 descriptor 재유도와 동일.
      expect(stepArgs.publish.commandArgs.createArgs.title).toBe(
        cmdPlan.report.descriptor.title,
      );
      expect(stepArgs.publish.commandArgs.createArgs.body).toBe(
        cmdPlan.report.descriptor.body,
      );
    });
  });

  describe("evaluation-leg inputs 재유도 + callArgs.input 페어링 + modelId thread(branch — 축 4~5)", () => {
    it("(g) evaluation.inputs deep-equal buildRealDataEvaluationInputs(activities), 모든 callArgs[i].input === inputs[i](toBe, forEach)·길이 일치, 모든 callArgs[i].options.modelId === runPlan.pipeline.modelId(toBe)", () => {
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

  describe("publish-leg 내부 marker 3-축 일치(branch — 축 2~3)", () => {
    it("(h) extractSearchMarker(searchArgv) === report.descriptor.marker === commandArgs.searchQuery 세 지점 byte-identical, marker 가 searchArgv 안 정확히 1회 등장", () => {
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

  describe("marker → resolve issueNumber(argv[2]) + post run-identity 수렴(branch — 축 1, 종단)", () => {
    it("(i) search hit N → resolvePlan.action.update.issueNumber → argv[2]==String(N) → outcomeReport.issueNumber 모두 동일 N(toBe(N)) AND outcomeReport.url 에 /issues/N AND 동일 runPlan.run 전파(marker run token == outcomeReport.{gitSha,dateToken,summaryLine})", () => {
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

  describe("12-way 단일-source 묶음 단언(branch — closure 종단, 본 task 의 종단 박제)", () => {
    it("(j) update argv == ['issue','edit',String(N),'--title',updateArgs.title,'--body',updateArgs.body] AND create argv == ['issue','create','--title',createArgs.title,'--body',createArgs.body,'--label','realdata-e2e','--label','result'], argv 위치별 title/body 값 == descriptor.{title,body} == 동 command-plan, argv labels 값 == createArgs.labels == ['realdata-e2e','result'], report.summary == 동 command-plan, evaluation.inputs == buildRealDataEvaluationInputs(activities), callArgs[].input === inputs[i], modelId == runPlan.pipeline.modelId, searchArgv --match == descriptor.marker == commandArgs.searchQuery, 그 marker 로 resolve 가 찾은 N == argv[2]==String(N) == post 가 해석한 N, run token == post {gitSha,dateToken} 가 세 검증 source single-source 에서 12-way 동시 성립", () => {
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

      // axis 12(새 표면) — update/create 두 분기 argv 위치-정합 byte-identical.
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
      // axis 2~3 — marker 3-축.
      expect(stepArgs.publish.commandArgs.searchQuery).toBe(marker);
      expect(extractSearchMarker(stepArgs.publish.searchArgv)).toBe(marker);
      // axis 1 — resolve N == argv[2] == post N + run token 전파.
      expect(resolveUpdate.action.issueNumber).toBe(N);
      expect(resolveUpdate.argv[2]).toBe(String(N));
      expect(outcomeReport.issueNumber).toBe(N);
      expect(marker).toContain(token);
      expect(outcomeReport.gitSha).toBe(runPlan.run.gitSha);
      expect(outcomeReport.dateToken).toBe(runPlan.run.dateToken);
      // 12-way 동시 closure — 세 검증 source single-source 에서 열두 축이 묶임.
      expect(`${runPlan.run.dateToken}@${runPlan.run.gitSha}`).toBe(token);
    });
  });

  describe("argv 위치-정합 변별성(branch — argv 값이 단일-source 필드를 그대로 운반·재해석 0)", () => {
    it("(k) (a) 같은 runPlan·activities, 다른 results → update argv[4](title)·argv[6](body) 가 각 results 의 descriptor.{title,body} 와 일치(results 변경이 argv title/body 에 정확히 전파). (b) 같은 results·activities, 다른 N → argv[2]==String(N) 만 달라지고 title/body argv 위치값(argv[4]·argv[6])은 동일(N 은 issueNumber 위치에만 영향)", () => {
      // (a) 다른 results → argv title/body 변별.
      const runPlan = buildRunPlan();
      const activities = defaultActivities();
      const resultsA = defaultResults();
      const resultsB = altResults();
      const chainResA = runChain([7, 13], runPlan, activities, resultsA);
      const chainResB = runChain([7, 13], runPlan, activities, resultsB);

      expect(chainResA.resolvePlan.argv[4]).toBe(
        chainResA.stepArgs.publish.report.descriptor.title,
      );
      expect(chainResA.resolvePlan.argv[6]).toBe(
        chainResA.stepArgs.publish.report.descriptor.body,
      );
      expect(chainResB.resolvePlan.argv[4]).toBe(
        chainResB.stepArgs.publish.report.descriptor.title,
      );
      expect(chainResB.resolvePlan.argv[6]).toBe(
        chainResB.stepArgs.publish.report.descriptor.body,
      );
      // results 변경이 argv body 에 전파(변별).
      expect(chainResA.resolvePlan.argv[6]).not.toBe(
        chainResB.resolvePlan.argv[6],
      );

      // (b) 같은 results·activities·runPlan, 다른 N → argv[2] 만 변별, title/body 불변.
      const results = defaultResults();
      const stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results);
      const marker = stepArgs.publish.report.descriptor.marker;
      const resolveN5 = resolveRealDataResultIssueGhCommandPlan(
        multiHitStdout(marker, [5]),
        stepArgs.publish.commandArgs,
      );
      const resolveN99 = resolveRealDataResultIssueGhCommandPlan(
        multiHitStdout(marker, [99]),
        stepArgs.publish.commandArgs,
      );
      // argv[2](issueNumber 위치)만 달라짐.
      expect(resolveN5.argv[2]).toBe("5");
      expect(resolveN99.argv[2]).toBe("99");
      expect(resolveN5.argv[2]).not.toBe(resolveN99.argv[2]);
      // title/body argv 위치값(argv[4]·argv[6])은 N 무관 동일.
      expect(resolveN5.argv[4]).toBe(resolveN99.argv[4]);
      expect(resolveN5.argv[6]).toBe(resolveN99.argv[6]);
      expect(resolveN5.argv[4]).toBe(
        stepArgs.publish.commandArgs.updateArgs.title,
      );
      expect(resolveN5.argv[6]).toBe(
        stepArgs.publish.commandArgs.updateArgs.body,
      );
    });
  });

  describe("create/update 두 분기 argv 격리(branch — 검색 결과가 argv 분기를 바꾸되 운반 필드값은 단일-source 불변)", () => {
    it("(l) 동일 runPlan·activities·results, searchStdout 만 (hit 1+ vs hit 0)으로 달리해 → update argv[1]=='edit', create argv[1]=='create'. 두 argv 모두 같은 단일-source command-args title/body 운반 — update argv[4]/[6]==create argv[3]/[5]==descriptor.{title,body}(검색 결과가 본문/제목 안 바꿈). create argv 에만 --label flag-pair·update argv 에만 String(N) 위치", () => {
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

      // 분기 동사 차이.
      expect(resolveUpdate.argv[1]).toBe("edit");
      expect(resolveCreate.argv[1]).toBe("create");

      // 두 argv 모두 같은 단일-source title/body 운반(검색 결과가 본문/제목 안 바꿈).
      expect(resolveUpdate.argv[4]).toBe(descriptorTitle);
      expect(resolveCreate.argv[3]).toBe(descriptorTitle);
      expect(resolveUpdate.argv[6]).toBe(descriptorBody);
      expect(resolveCreate.argv[5]).toBe(descriptorBody);
      expect(resolveUpdate.argv[4]).toBe(resolveCreate.argv[3]);
      expect(resolveUpdate.argv[6]).toBe(resolveCreate.argv[5]);

      // create argv 에만 --label flag-pair(분류 라벨), update argv 엔 부재.
      expect(resolveCreate.argv).toContain("--label");
      expect(resolveUpdate.argv).not.toContain("--label");
      // update argv 에만 String(N)(issueNumber 위치), create argv 엔 부재.
      expect(resolveUpdate.argv[2]).toBe("7");
      expect(resolveCreate.argv[2]).toBe("--title");
    });
  });

  describe("error path / negative cases — 아홉 boundary 거부 대칭 박제(R-112 negative 충분 cover)", () => {
    it("(m) runPlan.pipeline.modelId 빈('') → run-plan 합성(buildRealDataE2eRunPlan) 측 modelId guard throw(argv 합성 도달 전 차단)", () => {
      const seeds = buildRealDataE2eSeed();
      expect(() =>
        buildRealDataE2eRunPlan(seeds, "", {
          gitSha: "abc1234",
          dateToken: "2026-06-29",
        }),
      ).toThrow();
    });

    it("(m') runPlan.pipeline.modelId 공백-only('   ') 우회 합성 → aggregator 측 evaluation 위임 하위 modelId guard throw(inputs·argv 재유도 도달 전 차단)", () => {
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

    it("(n) runPlan.run.gitSha 빈('') → aggregator 측 publish 위임 descriptor assertNonBlank('gitSha') throw(descriptor.title/body·command-args·argv 합성 도달 전 차단)", () => {
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

    it("(n') runPlan.run.dateToken 빈('') → aggregator 측 publish 위임 descriptor assertNonBlank('dateToken') throw 대칭", () => {
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

    it("(p) searchStdout 비JSON('not json') → resolve parse 위임 throw(stepArgs.publish.commandArgs 정상이어도 argv 합성 도달 전 차단)", () => {
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

    // resolve-argv 축 negative — argv 는 buildRealDataResultIssueGhArgv 가 command-args
    // title/body 빈/공백·issueNumber 비양수 시 throw 하나, 본 task chain 에서 command-args 는
    // aggregator 가 합성(정상 descriptor 면 비-empty)하므로 argv-축 boundary 는 descriptor
    // 상위 guard(marker/gitSha/dateToken)가 차단한다. marker 빈/공백(gitSha/dateToken 비식별로
    // marker 합성 실패)이 command-args 빌더 assertNonBlank('marker')(124행) throw 를 그대로
    // 전파해 step-args 산출(argv 도달)을 차단함을 보이는 boundary 대칭.
    it("(s) resolve-argv 축 negative 대체 — argv boundary 는 descriptor 상위 guard 가 차단. blank gitSha(run.gitSha='   ')이 descriptor.marker 합성 실패 → aggregator publish 위임 assertNonBlank throw 로 step-args·argv 산출 도달 전 차단(argv 합성 도달 전 marker guard 상위 차단 — boundary 대칭). 정상 run → argv 항상 비-empty string[]", () => {
      // 정상 run → argv 항상 비-empty.
      const { resolvePlan } = runChain([7, 13]);
      expect(resolvePlan.argv.length).toBeGreaterThan(0);
      resolvePlan.argv.forEach((token) => {
        expect(typeof token).toBe("string");
        expect(token.length).toBeGreaterThan(0);
      });

      // blank gitSha → marker/title 합성 도달 전 상위 run-token guard 로 차단(argv 미도달).
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

  describe("결정론·무공유·no-mutation — chain 두 번 호출 + 입력 불변 + argv 오염 0", () => {
    it("(t) 동일 (runPlan, activities, results, searchStdout, execStdout) chain 두 번 → stepArgs/resolvePlan(argv 포함)/outcomeReport 모두 deep-equal(결정론)", () => {
      const runPlan = buildRunPlan();
      const activities = defaultActivities();
      const results = defaultResults();
      const chain1 = runChain([7, 13], runPlan, activities, results);
      const chain2 = runChain([7, 13], runPlan, activities, results);

      expect(chain1.stepArgs.evaluation).toEqual(chain2.stepArgs.evaluation);
      expect(chain1.stepArgs.publish).toEqual(chain2.stepArgs.publish);
      expect(chain1.resolvePlan).toEqual(chain2.resolvePlan);
      expect(chain1.resolvePlan.argv).toEqual(chain2.resolvePlan.argv);
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

    it("(v) argv 오염 0 — resolvePlan.argv.push('x') 후 새 chain 의 argv 가 여전히 정상(이전 호출 반환 mutate 누설 0 — 매 호출 새 argv 배열, gh-command-plan 25행 무공유)", () => {
      const first = runChain([7, 13]);
      const firstLen = first.resolvePlan.argv.length;
      // 반환 argv 배열 mutate(오염 시도).
      first.resolvePlan.argv.push("x");
      expect(first.resolvePlan.argv).toContain("x");
      expect(first.resolvePlan.argv.length).toBe(firstLen + 1);

      // 새 chain 의 argv 는 여전히 정상(이전 호출 mutate 누설 0).
      const second = runChain([7, 13]);
      expect(second.resolvePlan.argv).not.toContain("x");
      expect(second.resolvePlan.argv[0]).toBe("issue");
      expect(second.resolvePlan.argv[1]).toBe("edit");
      expect(second.resolvePlan.argv.length).toBe(firstLen);
    });
  });

  describe("credential 누출 0(branch — §9 / R-59 / REQ-059 정합)", () => {
    it("(w) resolvePlan.argv(join, 실 execFile('gh', argv) 인자-벡터) · stepArgs.publish.commandArgs.{createArgs.{title,body,labels(join)},updateArgs.{title,body},searchQuery} · report.descriptor.{title,marker,body} · report.summary(직렬화) · evaluation.inputs·callArgs(직렬화) · searchArgv · outcomeReport.{url,summaryLine} 어디에도 token/secret/PAT/--auth 어휘 미등장(특히 실 gh argv 명시)", () => {
      const { stepArgs, resolvePlan, outcomeReport } = runChain([7, 13]);
      // create 분기 argv 도 함께 점검.
      const resolveCreate = resolveRealDataResultIssueGhCommandPlan(
        "[]",
        stepArgs.publish.commandArgs,
      );

      const surfaces: string[] = [
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
        ...stepArgs.publish.searchArgv,
        outcomeReport.url,
        outcomeReport.summaryLine,
      ];

      const credentialPattern =
        /(GH_TOKEN|GITHUB_TOKEN|Bearer|Authorization|x-access-token|x-github-token|--token|--auth|ghp_[A-Za-z0-9]|PAT)/i;
      for (const surface of surfaces) {
        expect(surface).not.toMatch(credentialPattern);
      }
      // resolvePlan.argv 각 원소(실 gh 인자-벡터)에 credential 어휘 미등장 명시.
      resolvePlan.argv.forEach((token) => {
        expect(token).not.toMatch(credentialPattern);
      });
      resolveCreate.argv.forEach((token) => {
        expect(token).not.toMatch(credentialPattern);
      });
      // outcome url 은 issue 경로만 — commit/PR narrative 어휘 미포함.
      expect(outcomeReport.url).not.toMatch(/commit|pull request/i);
    });
  });
});
