// realdata-e2e-aggregator-command-args-labels-descriptor-resolve-run-plan-threading-11way-single-source-closure-assembly.smoke-spec.ts
// — 실 평가 e2e step④ aggregator command-args-labels 합류 11-way single-source closure:
// pre-실행 aggregator `buildRealDataE2eStepArgs(runPlan, activities, results)` 의 publish leg
// **실행-인자 분류(labels) surface `commandArgs.createArgs.labels`(gh issue create --label
// 경로의 이슈 분류 라벨 집합)** 를 빌더 보유 고정 결정론 상수 `RESULT_ISSUE_LABELS =
// ["realdata-e2e","result"]`(command-args.ts 64행) 및 단일 source `(results, runPlan.run)`
// command-plan 재유도와 byte-identical(`toEqual`, 무공유 새 배열 `not.toBe`)로 closure 에
// 묶어, 검증 source `(runPlan, activities, results)` 세 source 가 다음 11 축의 동시 source
// (단 labels 만 입력-비종속 고정 상수)임을 한 chain 으로 박제한다:
//   (축 11, 본 task 의 새 표면) **publish.commandArgs.createArgs.labels 고정-상수 일치 +
//      단일-source 재유도** — `stepArgs.publish.commandArgs.createArgs.labels` 가 **고정
//      결정론 분류 상수 `["realdata-e2e","result"]` 와 byte-identical deep-equal(`toEqual`)**,
//      그리고 동일 `results`·동일 `runPlan.run` 으로 직접 호출한 `buildRealDataResultIssue
//      CommandPlan(results, runPlan.run).commandArgs.createArgs.labels` 와도 byte-identical
//      deep-equal 이되 referential 분리(`not.toBe`, 무공유 새 배열). 즉 live runner 가
//      실제로 `gh issue create --label realdata-e2e --label result` 로 거는 **이슈 분류
//      surface** 가 항상 같은 고정 분류 라벨 집합을 운반한다. **재유도는 command-plan 경유**
//      (aggregator 가 실제 거치는 동일 위임 경로 — `buildRealDataResultIssueCommandArgs`
//      직접 호출 0, SSOT). updateArgs 에는 labels 가 없다(gh issue edit 은 본문/제목만 갱신).
//      labels 분류 surface 는 title 식별 surface(T-0779)·body content surface(T-0778)와
//      distinct — **labels 만 입력-비종속 고정 상수**(results·run·activities 어느 입력에도
//      비종속)다. title·body 는 descriptor(results+run 종속)에서 유도되지만 labels 는 빌더 상수.
//   (축 10, T-0779 cover 영역의 11-way 묶음 항) **publish.commandArgs.{create,update}Args.title
//      두 실행 경로 일치** — 둘 다 `stepArgs.publish.report.descriptor.title` 와 byte-identical.
//   (축 9, T-0778 cover 영역) **publish.commandArgs.{create,update}Args.body 두 경로 일치** —
//      둘 다 `stepArgs.publish.report.descriptor.body` 와 byte-identical.
//   (축 7~8) **publish.report.descriptor.{title,body} results+run-재유도 byte-identical** —
//      command-plan 경유 deep-equal 재유도.
//   (축 6) **publish.report.summary results-재유도 byte-identical**.
//   (축 5) **evaluation.inputs activities-재유도 byte-identical + callArgs[i].input === inputs[i]
//      reference 페어링**.
//   (축 4) `.evaluation` leg modelId — `callArgs[i].options.modelId === runPlan.pipeline.modelId`
//      (ADR-0048 단일 modelId source).
//   (축 2~3) `.publish` leg 내부 marker 3-축 — `report.descriptor.marker / commandArgs.searchQuery
//      / searchArgv(--match 다음 토큰)` 세 marker 축 동일.
//   (축 1, 종단) resolve issueNumber + post run-identity — marker 로 검색 hit 1+ →
//      `action.update.issueNumber = N` → `buildRealDataResultOutcomeStepArgs(runPlan, execStdout)`
//      가 동일 runPlan.run 의 {gitSha, dateToken} 전파.
//
// 이 11-way 가 **세 검증 source `(runPlan, activities, results)`** single-source 에서 한 chain
// 동시-호출로 수렴함을 박제하는 첫 aggregator-command-args-labels 합류 11-way single-source
// closure non-gated build-time smoke (T-0780 박제, PLAN.md 109행 🟢 실 평가 e2e step④).
// publish leg 의 다섯 출력 surface(정량 집계 summary + 사람-대면 렌더 descriptor.body + 식별
// 제목 descriptor.title + 실행-인자 두 경로 body·title + 분류 라벨 command-args labels)가 모두
// 단일-source 재유도/일치/고정-상수로 묶이는 slice. command-args 의 body·title·labels 세
// 실행-인자 surface 가 모두 닫힌다.
//
// 본 spec 의 존재 이유 — public CI gap 해소(publish leg 의 command-args-labels 분류 축을
// 11번째 축으로 합류):
//   - aggregator `buildRealDataE2eStepArgs(runPlan, activities, results)`(T-0601)는 세 입력
//     source 를 받는다 — runPlan(검증된 modelId+run), activities(수집 산출), results(평가
//     산출). T-0779 이 publish leg 의 실행-인자 식별 제목 surface `commandArgs.{create,update}
//     Args.title` 을 단일 source 산출 `descriptor.title` 와 byte-identical 로 closure 에 묶어
//     10-way 를 완성했다.
//   - 직전 sibling 들은 publish leg 의 distinct 한 실행-인자 분류 surface
//     `commandArgs.createArgs.labels`(gh issue create --label 경로 이슈 분류 라벨)를
//     convergence closure 에 합류시키지 않았다:
//       T-0779 (aggregator 10-way) — publish leg `commandArgs.{create,update}Args.title`
//         (=descriptor.title)+body+descriptor.{title,body}+summary+inputs/modelId+marker/
//         searchArgv/run-identity 를 단일 (runPlan, activities, results) source 로 수렴 박제.
//         그러나 `commandArgs.createArgs.labels`(=고정 분류 상수가 실 gh `--label` 인자로
//         들어간 분류 surface)는 convergence closure 에 미합류 — 그 spec 안 labels 참조는
//         무공유 보조 단언(직접 호출 commandArgs 와 deep-equal 이되 `not.toBe`, line 1153~1159)
//         일 뿐, labels byte-identical 재유도/고정-상수 일치/입력-비종속 변별 단언 0.
//       T-0778 (aggregator 9-way) — command-args body 두 경로만 합류 — labels 무공유 보조 수준.
//       T-0777/0776/0775/0774 (aggregator 8·7·6·5-way) — command-args 의 body·searchQuery·
//         marker 축만 합류 — `createArgs.labels` 미합류.
//       command-args-labels-title self-guard smoke
//         (`assertRealDataResultIssueCommandArgsLabelsTitleConsistent`, T-0651) — 빌더 내부
//         self-wire 로 labels↔고정상수 일치를 박제했으나 aggregator(`buildRealDataE2eStepArgs`)
//         진입·resolve·post 미합류(빌더 단독 self-guard 또는 command-args helper-level 만).
//   - 본 spec 은 그 빈 자리를 채워 **publish leg 의 분류 surface(createArgs.labels)를 같은
//     aggregator 산출 + 고정 결정론 상수 + command-plan 재유도와 byte-identical 로 closure
//     에 묶어**, 검증 source `(runPlan, activities, results)` 세 source 가 aggregator publish
//     leg 의 다섯 출력 surface(summary + descriptor.body + descriptor.title + command-args
//     두 경로 body·title + command-args labels)와 evaluation leg(inputs+modelId), 그리고
//     marker/searchArgv/run-identity 의 source 임을 resolve+post 까지 묶은 한 chain 으로 박제.
//   - 이 11-way 가 세 검증 source single-source 로 수렴함이 search-or-update 멱등성(REQ-009 —
//     분류 라벨이 결정론 고정 상수)·raw 미보유 평가 입력/결과 집계 정합(REQ-032)·결과 리포트
//     재실행 정합(REQ-037)의 aggregator-level 종단 닫음이다(단 labels 는 입력-비종속 고정 상수).
//   - live leg(실 prisma·실 collectForPerson·실 github.com fetch·실 LLM scoring·실 gh CLI
//     실행·DB·LAN gate)는 복제하지 않고, synthetic runPlan(buildRealDataE2eRunPlan 합성) +
//     activities/results literal + search-stdout/exec-stdout literal 을 컴포저들에 직접 공급해
//     live leg 를 우회한다(조립 surface 만 검증). 따라서 본 spec 은:
//
//      🔥 실 gh 호출 0 — gh search / list / create / edit / execFile('gh', argv) 미실행.
//         synthetic searchStdout / execStdout / runPlan / activities / results literal 직접 공급.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 LLM scoreUnit 호출 0 / 실 DB 접근 0 / 실 jest spawn 0 — 11-way 수렴 조립만.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 step-args aggregator / evaluation-inputs / command-plan
//         / outcome-step-args / run-plan / gh-command-plan / seed-fixture 컴포저 import
//         재사용만(가드/helper 신설 0). `extractSearchMarker` 는 spec 로컬 함수(T-0779/T-0729
//         패턴 차용).
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0780):
//   - src 변경 0(src/, prisma/, package.json, CI workflow, 환경 변수 추가 등 모두 금지). test-only.
//   - 실 gh CLI 호출 / `execFile('gh', searchArgv)` 실행 / 실 `gh issue create --label` 실행 /
//     실 LLM scoreUnit 호출 / 실 issue 검색·박제(step④ live wiring — credential gate, deferred).
//     command-args labels 는 **이슈 분류 라벨 운반만** 검증(실 issue 박제·실 label 부여 0).
//   - aggregator 10-way(command-args title 두 경로 + body 두 경로 + descriptor.{title,body}
//     재유도 + summary + inputs + callArgs.input 페어링 + modelId + marker/searchArgv/
//     run-identity) 자체 재단언(T-0779 cover). 본 task 는 publish leg `commandArgs.createArgs
//     .labels`(=고정 결정론 상수 ["realdata-e2e","result"] + command-plan 재유도 deep-equal·
//     무공유)를 11번째 축으로 합류시킨 부분만(나머지 축은 11-way 묶음 표현용 동시-성립 확인).
//   - command-args labels·title self-guard(`assertRealDataResultIssueCommandArgsLabelsTitle
//     Consistent`, T-0651) 자체 재단언. 본 task 는 aggregator 산출 createArgs.labels 가 고정
//     상수·command-plan 재유도와 deep-equal 함만(self-guard 내부 로직 재검증 0).
//   - command-args body·title 의 marker-first 구조 self-guard(T-0646) 자체 재단언.
//   - descriptor.title/body 합성 로직·self-guard 자체 재단언(descriptor helper spec, T-0582).
//   - buildRealDataResultSummary 의 집계 로직 자체 재단언(summary helper spec cover).
//   - 난이도별 modelId routing(R-97 deferred) 검증 — 단일 modelId 동형 적용(ADR-0048)만.
//   - RESULT_ISSUE_LABELS 상수 값 정책 변경/재정의 — 본 task 는 helper 박제 현재 값
//     (`["realdata-e2e","result"]`)을 그대로 단언만. 값이 미래에 바뀌면 별도 task.
//   - searchArgv 전체 형식(gh issue list 플래그 순서·--repo·--state 등) 재단언(T-0729 cover).
//     본 task 는 `--match` 위치 marker 토큰만.
//   - resolve argv 합성(gh issue create/edit argv 형식) 재단언(gh-command-plan 가드 cover).
//     본 task 는 `action.update.issueNumber`·`action.create` 분기 결과만.
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
  "cfg-realdata-e2e-aggregator-command-args-labels-descriptor-resolve-threading-smoke";

const INSTANCE_KEY = "github.com";

// 고정 결정론 분류 라벨 — command-args.ts 64행 `RESULT_ISSUE_LABELS = ["realdata-e2e",
// "result"]` 가 박제한 현재 값을 spec 측 expected 로 박제. createArgs.labels 가 이 값과
// byte-identical deep-equal 이어야 함을 단언한다(값이 미래에 바뀌면 helper 기준으로 조정).
const EXPECTED_RESULT_ISSUE_LABELS = ["realdata-e2e", "result"];

// search argv 안 marker 추출 헬퍼 — 빌더 canonical shape (["search","issues","--match",
// "body",<marker>,"--json",...,"--limit","30"]) 에서 marker 는 `--match body` 직후다.
// 위치 매직 넘버 대신 `--match` 기준 상대 추출(round-trip drift 강건). T-0779/T-0729
// sibling 헬퍼 패턴 mirror.
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
  externalId = "realdata-e2e-aggregator-command-args-labels-c1",
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
    syntheticActivity(
      firstUsername,
      "aggregator-command-args-labels-c1",
      "commit",
    ),
    syntheticActivity(firstUsername, "aggregator-command-args-labels-p1", "pr"),
    syntheticActivity(
      firstUsername,
      "aggregator-command-args-labels-i1",
      "issue",
    ),
  ];
}

// synthetic EvaluationResult 1 건 — aggregator 의 publish leg 입력(summary 집계 + body 렌더 +
// command-args body source). labels 는 results 무관(빌더 고정 상수).
function syntheticResult(
  unitId: string,
  difficulty: EvaluationResult["difficulty"],
  contribution: EvaluationResult["contribution"],
  volume: number,
): EvaluationResult {
  return {
    unitId,
    narrative:
      "synthetic evaluation narrative — aggregator command-args-labels+title+body+descriptor-{title,body}+results-summary+evaluation-inputs+modelId+searchArgv ↔ resolve ↔ outcome-step-args run-plan-threading 11-way closure smoke fixture",
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

// 다른 분포(Y) results fixture — summary·body 변별성 단언용. labels 는 두 분포에서 불변.
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
// 본 task 의 새 표면 = publish leg 의 commandArgs.createArgs.labels(축 11, 입력-비종속 고정 상수).
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

describe('Smoke(non-gated): 실 평가 e2e step④ aggregator command-args-labels 합류 11-way single-source closure buildRealDataE2eStepArgs(.publish.commandArgs.createArgs.labels == ["realdata-e2e","result"] 고정 상수 == buildRealDataResultIssueCommandPlan(results, runPlan.run).commandArgs.createArgs.labels(deep-equal·not.toBe) + .publish.commandArgs.{create,update}Args.title == .publish.report.descriptor.title + .publish.commandArgs.{create,update}Args.body == .publish.report.descriptor.body + .publish.report.{descriptor.{title,body}, summary}(=동 command-plan 재유도) + .evaluation {inputs(=buildRealDataEvaluationInputs(activities), callArgs[i].input===inputs[i]), callArgs[].options.modelId} + .publish {descriptor.marker, commandArgs.searchQuery, searchArgv --match})↔resolve↔buildRealDataResultOutcomeStepArgs 동일 (runPlan, activities, results) 한 chain 동시-호출(labels 고정-상수 일치+재유도 + title 두 경로 + body 두 경로 + descriptor.{title,body} 재유도 + summary + inputs + modelId + marker 3-축 + issueNumber + run-identity 11축 동시 수렴, labels 만 입력-비종속) live-gh/live-LLM 0 검증', () => {
  describe("happy path — aggregator 11-way chain 합성(다섯 산출물 모두 정상)", () => {
    it("(a) 유효 runPlan + activities + results + searchStdout + execStdout → stepArgs.evaluation({inputs,callArgs} 비어있지 않음) / stepArgs.publish({report,commandArgs,searchArgv} 정상·commandArgs.createArgs.labels 비어있지 않은 string 배열·createArgs.title·createArgs.body 비어있지 않은 문자열·report.descriptor.{title,body} 비어있지 않은 문자열·report.summary 존재·commandArgs.searchQuery 존재) / resolvePlan(update {action, issueNumber} + argv) / outcomeReport(5필드) 다섯 산출물 모두 정상", () => {
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
      // commandArgs.createArgs.labels 존재(축 11 reachable — 분류 라벨, 비어있지 않은 string 배열).
      expect(
        Array.isArray(stepArgs.publish.commandArgs.createArgs.labels),
      ).toBe(true);
      expect(
        stepArgs.publish.commandArgs.createArgs.labels.length,
      ).toBeGreaterThan(0);
      stepArgs.publish.commandArgs.createArgs.labels.forEach((label) => {
        expect(typeof label).toBe("string");
        expect(label.length).toBeGreaterThan(0);
      });
      // commandArgs.createArgs.title / body 존재(축 10·9 reachable).
      expect(typeof stepArgs.publish.commandArgs.createArgs.title).toBe(
        "string",
      );
      expect(
        stepArgs.publish.commandArgs.createArgs.title.length,
      ).toBeGreaterThan(0);
      expect(typeof stepArgs.publish.commandArgs.createArgs.body).toBe(
        "string",
      );
      expect(
        stepArgs.publish.commandArgs.createArgs.body.length,
      ).toBeGreaterThan(0);
      // report.descriptor.title / body 존재(축 7~8 reachable).
      expect(typeof stepArgs.publish.report.descriptor.title).toBe("string");
      expect(stepArgs.publish.report.descriptor.title.length).toBeGreaterThan(
        0,
      );
      expect(typeof stepArgs.publish.report.descriptor.body).toBe("string");
      expect(stepArgs.publish.report.descriptor.body.length).toBeGreaterThan(0);
      // report.summary 존재(축 6 reachable).
      expect(typeof stepArgs.publish.report.summary).toBe("object");
      expect(typeof stepArgs.publish.report.summary.count).toBe("number");
      expect(stepArgs.publish.report.summary.count).toBe(3);
      // commandArgs.searchQuery 존재.
      expect(typeof stepArgs.publish.commandArgs.searchQuery).toBe("string");
      expect(stepArgs.publish.commandArgs.searchQuery.length).toBeGreaterThan(
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

  describe("publish-leg command-args-labels 고정-상수 일치 수렴(branch — 핵심 불변식 1, 본 task 의 새 표면 — 축 11)", () => {
    it('(b) stepArgs.publish.commandArgs.createArgs.labels deep-equal ["realdata-e2e","result"] 고정 결정론 분류 상수(byte-identical, command-args.ts 64행 RESULT_ISSUE_LABELS) — gh issue create --label 경로 분류 라벨이 항상 같은 고정 분류 집합을 운반. 보조: labels 가 비어있지 않은 string 배열, updateArgs 에는 labels 부재(gh issue edit 은 본문/제목만)', () => {
      const { stepArgs } = runChain([7, 13]);

      // 핵심 — createArgs.labels 가 고정 결정론 상수와 byte-identical deep-equal.
      expect(stepArgs.publish.commandArgs.createArgs.labels).toEqual(
        EXPECTED_RESULT_ISSUE_LABELS,
      );
      // 보조 — 비어있지 않은 string 배열.
      expect(stepArgs.publish.commandArgs.createArgs.labels.length).toBe(2);
      stepArgs.publish.commandArgs.createArgs.labels.forEach((label) => {
        expect(typeof label).toBe("string");
        expect(label.trim().length).toBeGreaterThan(0);
      });
      // 보조 — updateArgs 에는 labels 필드 부재(gh issue edit 은 본문/제목만 — 분류는 create 1회).
      expect("labels" in stepArgs.publish.commandArgs.updateArgs).toBe(false);
    });
  });

  describe("publish-leg command-args-labels 단일-source 재유도 deep-equal + 무공유(branch — 핵심 불변식 2, 축 11)", () => {
    it("(c) buildRealDataResultIssueCommandPlan(results, runPlan.run).commandArgs.createArgs.labels deep-equal stepArgs.publish.commandArgs.createArgs.labels(byte-identical toEqual) 이되 referential 분리(not.toBe, 무공유 새 배열) — aggregator 의 publish leg 분류 라벨이 단일 (results, run) source 로부터 command-plan 경유 동형 도출(buildRealDataResultIssueCommandArgs 직접 호출 0, SSOT)", () => {
      const runPlan = buildRunPlan();
      const results = defaultResults();
      const { stepArgs } = runChain(
        [7, 13],
        runPlan,
        defaultActivities(),
        results,
      );

      // 동일 results·동일 runPlan.run 으로 직접 호출한 command-plan 경유 재유도와 deep-equal.
      const cmdPlan = buildRealDataResultIssueCommandPlan(results, runPlan.run);
      expect(stepArgs.publish.commandArgs.createArgs.labels).toEqual(
        cmdPlan.commandArgs.createArgs.labels,
      );
      // referential 분리(무공유 새 배열) — 매 호출 새 [...RESULT_ISSUE_LABELS] 복제본.
      expect(stepArgs.publish.commandArgs.createArgs.labels).not.toBe(
        cmdPlan.commandArgs.createArgs.labels,
      );
      // 재유도 labels 도 고정 상수와 byte-identical(SSOT 동형).
      expect(cmdPlan.commandArgs.createArgs.labels).toEqual(
        EXPECTED_RESULT_ISSUE_LABELS,
      );
    });
  });

  describe("publish-leg command-args-title 두 경로 일치 수렴(branch — 핵심 불변식 3, T-0779 cover 영역의 11-way 묶음 항 — 축 10)", () => {
    it("(d) stepArgs.publish.commandArgs.createArgs.title === report.descriptor.title AND updateArgs.title === report.descriptor.title byte-identical — labels 분류 surface 와 title 식별 surface 가 같은 단일 source 의 distinct 한 두 실행-인자 표면. 보조: 두 경로 title 서로도 동일", () => {
      const { stepArgs } = runChain([7, 13]);

      const descriptorTitle = stepArgs.publish.report.descriptor.title;
      expect(stepArgs.publish.commandArgs.createArgs.title).toBe(
        descriptorTitle,
      );
      expect(stepArgs.publish.commandArgs.updateArgs.title).toBe(
        descriptorTitle,
      );
      expect(stepArgs.publish.commandArgs.createArgs.title).toBe(
        stepArgs.publish.commandArgs.updateArgs.title,
      );
      // labels(분류)·title(식별)은 distinct surface — title 은 문자열, labels 는 배열.
      expect(
        Array.isArray(stepArgs.publish.commandArgs.createArgs.labels),
      ).toBe(true);
      expect(typeof stepArgs.publish.commandArgs.createArgs.title).toBe(
        "string",
      );
    });
  });

  describe("publish-leg command-args-body 두 경로 일치 수렴(branch — 핵심 불변식 4, 11-way 묶음 항 — 축 9)", () => {
    it("(e) stepArgs.publish.commandArgs.createArgs.body === report.descriptor.body AND updateArgs.body === report.descriptor.body byte-identical — body content surface 가 labels 분류 surface·title 식별 surface 와 distinct", () => {
      const { stepArgs } = runChain([7, 13]);

      const descriptorBody = stepArgs.publish.report.descriptor.body;
      expect(stepArgs.publish.commandArgs.createArgs.body).toBe(descriptorBody);
      expect(stepArgs.publish.commandArgs.updateArgs.body).toBe(descriptorBody);
      expect(stepArgs.publish.commandArgs.createArgs.body).not.toBe(
        stepArgs.publish.commandArgs.createArgs.title,
      );
    });
  });

  describe("publish-leg descriptor-{title,body} 렌더 재유도 byte-identical 수렴(branch — 핵심 불변식 5, 축 7~8)", () => {
    it("(f) stepArgs.publish.report.descriptor.title === buildRealDataResultIssueCommandPlan(results, runPlan.run).report.descriptor.title AND descriptor.body === 동 command-plan.report.descriptor.body byte-identical", () => {
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
      // command-args title/body(실행 인자)도 descriptor 렌더와 동일 source.
      expect(stepArgs.publish.commandArgs.createArgs.title).toBe(
        cmdPlan.report.descriptor.title,
      );
      expect(stepArgs.publish.commandArgs.createArgs.body).toBe(
        cmdPlan.report.descriptor.body,
      );
    });
  });

  describe("publish-leg results-summary 재유도 byte-identical 수렴(branch — 핵심 불변식 6, 축 6)", () => {
    it("(g) stepArgs.publish.report.summary deep-equal buildRealDataResultIssueCommandPlan(results, runPlan.run).report.summary — labels(분류)·title·body·summary(정량 집계) 가 같은 단일 source 의 distinct surface(단 labels 만 입력-비종속)", () => {
      const runPlan = buildRunPlan();
      const results = defaultResults();
      const { stepArgs } = runChain(
        [7, 13],
        runPlan,
        defaultActivities(),
        results,
      );

      const cmdPlan = buildRealDataResultIssueCommandPlan(results, runPlan.run);
      expect(stepArgs.publish.report.summary).toEqual(cmdPlan.report.summary);
      expect(stepArgs.publish.report.summary.count).toBe(results.length);
      expect(stepArgs.publish.report.summary.totalVolume).toBe(10);
    });
  });

  describe("evaluation-leg inputs 재유도 + callArgs.input 페어링(branch — 핵심 불변식 7, 축 5)", () => {
    it("(h) stepArgs.evaluation.inputs deep-equal buildRealDataEvaluationInputs(activities) AND 모든 callArgs[i].input === inputs[i] referential 페어링 + 길이 일치", () => {
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

  describe("evaluation-leg modelId thread 수렴(branch — 핵심 불변식 8, 축 4)", () => {
    it("(i) 모든 stepArgs.evaluation.callArgs[i].options.modelId === runPlan.pipeline.modelId — 단일 검증 runPlan 의 평가 정책 modelId 가 평가 호출-args 전체에 동형 thread", () => {
      const runPlan = buildRunPlan();
      const { stepArgs } = runChain([7, 13], runPlan);

      expect(stepArgs.evaluation.callArgs.length).toBeGreaterThan(0);
      stepArgs.evaluation.callArgs.forEach((c) => {
        expect(c.options.modelId).toBe(runPlan.pipeline.modelId);
      });
      expect(runPlan.pipeline.modelId).toBe(MODEL_ID);
    });
  });

  describe("publish-leg 내부 marker 3-축 일치(branch — 핵심 불변식 9, 축 2~3)", () => {
    it("(j) extractSearchMarker(searchArgv) === report.descriptor.marker === commandArgs.searchQuery — 세 내부 marker 축이 byte-identical, marker 가 searchArgv 안 정확히 1회 등장, AND createArgs.body·updateArgs.body 첫 줄 === marker", () => {
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
      expect(stepArgs.publish.commandArgs.createArgs.body.split("\n")[0]).toBe(
        descriptorMarker,
      );
      expect(stepArgs.publish.commandArgs.updateArgs.body.split("\n")[0]).toBe(
        descriptorMarker,
      );
    });
  });

  describe("marker → resolve issueNumber + post run-identity 수렴(branch — 핵심 불변식 10, 축 1)", () => {
    it("(k) search hit N → resolve.action.update.issueNumber → outcome step-args.issueNumber 세 지점 모두 동일 N + url 에 /issues/N + 동일 runPlan.run 전파(marker run token == outcomeReport.{gitSha,dateToken,summaryLine})", () => {
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

  describe("11-way 단일-source 묶음 단언(branch — closure 종단, 본 task 의 종단 박제)", () => {
    it('(l) publish.commandArgs.createArgs.labels == ["realdata-e2e","result"] == buildRealDataResultIssueCommandPlan(results, runPlan.run).commandArgs.createArgs.labels(deep-equal·not.toBe), publish.commandArgs.{create,update}Args.title == publish.report.descriptor.title == 동 command-plan, .{create,update}Args.body == publish.report.descriptor.body == 동 command-plan, publish.report.summary == 동 command-plan, evaluation.inputs == buildRealDataEvaluationInputs(activities), callArgs[].input === inputs[i], callArgs[].options.modelId == runPlan.pipeline.modelId, searchArgv --match == descriptor.marker == commandArgs.searchQuery, 그 marker 로 resolve 가 찾은 N == post 가 해석한 N, run token == post {gitSha,dateToken} 가 세 검증 source (runPlan, activities, results) single-source 에서 11-way 동시 성립(labels 만 입력-비종속 고정 상수)', () => {
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
      const cmdPlan = buildRealDataResultIssueCommandPlan(results, runPlan.run);

      // axis 11(새 표면) — command-args labels 고정-상수 일치 + command-plan 재유도 deep-equal·무공유.
      expect(stepArgs.publish.commandArgs.createArgs.labels).toEqual(
        EXPECTED_RESULT_ISSUE_LABELS,
      );
      expect(stepArgs.publish.commandArgs.createArgs.labels).toEqual(
        cmdPlan.commandArgs.createArgs.labels,
      );
      expect(stepArgs.publish.commandArgs.createArgs.labels).not.toBe(
        cmdPlan.commandArgs.createArgs.labels,
      );
      // axis 10 — command-args title 두 경로 일치 + command-plan 재유도 byte-identical.
      expect(stepArgs.publish.commandArgs.createArgs.title).toBe(
        cmdPlan.commandArgs.createArgs.title,
      );
      expect(stepArgs.publish.commandArgs.updateArgs.title).toBe(
        cmdPlan.commandArgs.updateArgs.title,
      );
      expect(stepArgs.publish.commandArgs.createArgs.title).toBe(
        stepArgs.publish.commandArgs.updateArgs.title,
      );
      // axis 7(title) — publish.report.descriptor.title byte-identical command-plan 재유도.
      expect(stepArgs.publish.report.descriptor.title).toBe(
        cmdPlan.report.descriptor.title,
      );
      expect(stepArgs.publish.commandArgs.createArgs.title).toBe(
        cmdPlan.report.descriptor.title,
      );
      // axis 9 — command-args body 두 경로 일치 + command-plan 재유도 byte-identical.
      expect(stepArgs.publish.commandArgs.createArgs.body).toBe(
        cmdPlan.commandArgs.createArgs.body,
      );
      expect(stepArgs.publish.commandArgs.updateArgs.body).toBe(
        cmdPlan.commandArgs.updateArgs.body,
      );
      expect(stepArgs.publish.commandArgs.createArgs.body).toBe(
        stepArgs.publish.commandArgs.updateArgs.body,
      );
      // axis 8(body) — publish.report.descriptor.body byte-identical command-plan 재유도.
      expect(stepArgs.publish.report.descriptor.body).toBe(
        cmdPlan.report.descriptor.body,
      );
      expect(stepArgs.publish.commandArgs.createArgs.body).toBe(
        cmdPlan.report.descriptor.body,
      );
      // axis 6 — publish.report.summary deep-equal command-plan 재유도(results source).
      expect(stepArgs.publish.report.summary).toEqual(cmdPlan.report.summary);
      // axis 5 — evaluation.inputs deep-equal direct 재유도 + callArgs.input reference 페어링.
      const directInputs = buildRealDataEvaluationInputs(activities);
      expect(stepArgs.evaluation.inputs).toEqual(directInputs);
      stepArgs.evaluation.callArgs.forEach((c, i) => {
        expect(c.input).toBe(stepArgs.evaluation.inputs[i]);
      });
      // axis 4 — evaluation.callArgs[].options.modelId == runPlan.pipeline.modelId.
      expect(stepArgs.evaluation.callArgs.length).toBeGreaterThan(0);
      stepArgs.evaluation.callArgs.forEach((c) => {
        expect(c.options.modelId).toBe(runPlan.pipeline.modelId);
      });
      // axis 2~3 — marker 3-축 byte-identical.
      expect(stepArgs.publish.commandArgs.searchQuery).toBe(marker);
      expect(extractSearchMarker(stepArgs.publish.searchArgv)).toBe(marker);
      // axis 1 — 그 marker 로 resolve 가 찾은 N == post 가 해석한 N + run token 전파.
      expect(resolvePlan.action.issueNumber).toBe(N);
      expect(outcomeReport.issueNumber).toBe(N);
      expect(marker).toContain(token);
      expect(outcomeReport.gitSha).toBe(runPlan.run.gitSha);
      expect(outcomeReport.dateToken).toBe(runPlan.run.dateToken);
      // command-args title 두 경로가 run token 운반(run 종속), labels 는 run token 무관(입력-비종속).
      expect(stepArgs.publish.commandArgs.createArgs.title).toContain(token);
      stepArgs.publish.commandArgs.createArgs.labels.forEach((label) => {
        expect(label).not.toContain(token);
      });
      // 11-way 동시 closure — 세 검증 source single-source 에서 열한 축이 한 chain 으로 묶임.
      expect(`${runPlan.run.dateToken}@${runPlan.run.gitSha}`).toBe(token);
    });
  });

  describe("labels 입력-비종속 변별성(branch — labels 가 results·activities·run 어느 입력에도 종속하지 않음 — 본 task 핵심 distinct)", () => {
    it('(m) 세 chain — (a) 다른 results, (b) 다른 runPlan(run), (c) 다른 activities — 모두에서 createArgs.labels 가 항상 동일 고정 상수 ["realdata-e2e","result"] deep-equal(results·run·activities 변경이 labels 에 누설 0). 단 다른 축은 각 종속 입력으로 변별 — body/summary(results), title/marker/modelId/run-identity(run), inputs(activities)', () => {
      // (a) 같은 runPlan·activities, 다른 results.
      const runPlan = buildRunPlan();
      const activities = defaultActivities();
      const resultsA = defaultResults();
      const resultsB = altResults();
      const chainResA = runChain([7, 13], runPlan, activities, resultsA);
      const chainResB = runChain([7, 13], runPlan, activities, resultsB);
      // labels 불변(results 변경 누설 0).
      expect(chainResA.stepArgs.publish.commandArgs.createArgs.labels).toEqual(
        EXPECTED_RESULT_ISSUE_LABELS,
      );
      expect(chainResB.stepArgs.publish.commandArgs.createArgs.labels).toEqual(
        EXPECTED_RESULT_ISSUE_LABELS,
      );
      expect(chainResA.stepArgs.publish.commandArgs.createArgs.labels).toEqual(
        chainResB.stepArgs.publish.commandArgs.createArgs.labels,
      );
      // 그러나 body/summary 는 results 변별.
      expect(chainResA.stepArgs.publish.commandArgs.createArgs.body).not.toBe(
        chainResB.stepArgs.publish.commandArgs.createArgs.body,
      );
      expect(chainResA.stepArgs.publish.report.summary).not.toEqual(
        chainResB.stepArgs.publish.report.summary,
      );

      // (b) 같은 results·activities, 다른 runPlan(run).
      const results = defaultResults();
      const runPlanX = buildRunPlan("model-x", "abc1234", "2026-06-21");
      const runPlanY = buildRunPlan("model-y", "def5678", "2026-06-29");
      const chainRunX = runChain([7, 13], runPlanX, activities, results);
      const chainRunY = runChain([7, 13], runPlanY, activities, results);
      // labels 불변(run 변경 누설 0).
      expect(chainRunX.stepArgs.publish.commandArgs.createArgs.labels).toEqual(
        EXPECTED_RESULT_ISSUE_LABELS,
      );
      expect(chainRunY.stepArgs.publish.commandArgs.createArgs.labels).toEqual(
        EXPECTED_RESULT_ISSUE_LABELS,
      );
      // 그러나 title/marker/modelId/run-identity 는 run 변별.
      expect(chainRunX.stepArgs.publish.commandArgs.createArgs.title).not.toBe(
        chainRunY.stepArgs.publish.commandArgs.createArgs.title,
      );
      expect(chainRunX.stepArgs.publish.report.descriptor.marker).not.toBe(
        chainRunY.stepArgs.publish.report.descriptor.marker,
      );
      expect(
        chainRunX.stepArgs.evaluation.callArgs[0].options.modelId,
      ).not.toBe(chainRunY.stepArgs.evaluation.callArgs[0].options.modelId);
      expect(chainRunX.outcomeReport.gitSha).not.toBe(
        chainRunY.outcomeReport.gitSha,
      );

      // (c) 같은 results·runPlan, 다른 activities.
      const firstUsername =
        buildRealDataE2eSeed()[0].serviceIdentities[0].externalId;
      const activitiesC1: GithubActivity[] = [
        syntheticActivity(firstUsername, "labels-Cc1", "commit"),
      ];
      const activitiesC2: GithubActivity[] = [
        syntheticActivity(firstUsername, "labels-Dc1", "commit"),
        syntheticActivity(firstUsername, "labels-Dp1", "pr"),
      ];
      const chainActC1 = runChain([7, 13], runPlan, activitiesC1, results);
      const chainActC2 = runChain([7, 13], runPlan, activitiesC2, results);
      // labels 불변(activities 변경 누설 0).
      expect(chainActC1.stepArgs.publish.commandArgs.createArgs.labels).toEqual(
        EXPECTED_RESULT_ISSUE_LABELS,
      );
      expect(chainActC2.stepArgs.publish.commandArgs.createArgs.labels).toEqual(
        EXPECTED_RESULT_ISSUE_LABELS,
      );
      // 그러나 inputs 는 activities 변별.
      expect(chainActC1.stepArgs.evaluation.inputs).not.toEqual(
        chainActC2.stepArgs.evaluation.inputs,
      );
      expect(chainActC1.stepArgs.evaluation.inputs).toHaveLength(
        activitiesC1.length,
      );
      expect(chainActC2.stepArgs.evaluation.inputs).toHaveLength(
        activitiesC2.length,
      );
    });
  });

  describe("create 분기 격리(branch — 검색 미스 → create, labels·title·body·descriptor·summary·inputs·modelId·searchArgv·post 무관)", () => {
    it("(n) 빈 hit search stdout('[]') → resolve.action 이 create 분기(action.update 부재) — stepArgs.publish.commandArgs.createArgs.labels(= 고정 상수) / title·body(= descriptor) / descriptor.{title,body} / summary / inputs / modelId / searchArgv --match marker 는 create/update 두 분기 모두 동일(검색 결과가 command-args 를 바꾸지 0 — command-args 는 검색 전 합성됨). resolve 의 create action 은 {action:'create'} 만 운반(labels 미포함 — RealDataResultIssueAction discriminated union 에 createArgs 참조 없음, action.ts 76~78행) → labels 는 commandArgs.createArgs.labels 에서 직접 검증", () => {
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
      // create action 은 createArgs(labels) 참조를 운반하지 않음 — discriminated union 이
      // {action:'create'} 만(action.ts 76~78행). 따라서 labels 는 commandArgs.createArgs.labels
      // 에서 직접 검증한다(create action 측에는 labels 가 담기지 않음).
      expect("labels" in resolveCreate.action).toBe(false);

      // update 분기(같은 marker hit).
      const resolveUpdate = resolveRealDataResultIssueGhCommandPlan(
        multiHitStdout(marker, [7, 13]),
        stepArgs.publish.commandArgs,
      );
      expect(resolveUpdate.action.action).toBe("update");

      // command-args labels·title·body / descriptor / summary / inputs / modelId / searchArgv
      // marker 는 검색 결과(create/update)와 무관 — command-args 는 검색 전 합성됨.
      const cmdPlan = buildRealDataResultIssueCommandPlan(results, runPlan.run);
      // 핵심 — create/update 어느 분기든 createArgs.labels 가 동일한 단일-source 고정 분류 라벨.
      expect(stepArgs.publish.commandArgs.createArgs.labels).toEqual(
        EXPECTED_RESULT_ISSUE_LABELS,
      );
      expect(stepArgs.publish.commandArgs.createArgs.labels).toEqual(
        cmdPlan.commandArgs.createArgs.labels,
      );
      // title·body 두 경로(= descriptor 와 동일)도 검색 무관.
      expect(stepArgs.publish.commandArgs.createArgs.title).toBe(
        stepArgs.publish.report.descriptor.title,
      );
      expect(stepArgs.publish.commandArgs.updateArgs.title).toBe(
        stepArgs.publish.report.descriptor.title,
      );
      expect(stepArgs.publish.commandArgs.createArgs.body).toBe(
        stepArgs.publish.report.descriptor.body,
      );
      expect(stepArgs.publish.report.descriptor.title).toBe(
        cmdPlan.report.descriptor.title,
      );
      expect(stepArgs.publish.report.summary).toEqual(cmdPlan.report.summary);
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
    it("(o) runPlan.pipeline.modelId 빈('') → run-plan 합성 단계(buildRealDataE2eRunPlan) 측 pipeline modelId guard throw(평가 leg 비식별 — modelId 미결정이면 run plan 산출 차단)", () => {
      const seeds = buildRealDataE2eSeed();
      expect(() =>
        buildRealDataE2eRunPlan(seeds, "", {
          gitSha: "abc1234",
          dateToken: "2026-06-29",
        }),
      ).toThrow();
    });

    it("(o') runPlan.pipeline.modelId 공백-only('   ') 우회 합성 → aggregator(buildRealDataE2eStepArgs) 측 evaluation 위임 하위 modelId guard throw(aggregator 단계 거부 — inputs 재유도 도달 전 차단)", () => {
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

    it("(p) runPlan.run.gitSha 빈('') → aggregator측 publish 위임 descriptor assertNonBlank('gitSha') throw(descriptor.title/body·command-args title/body·labels 합성 도달 전 차단). modelId·activities·results 정상이어도 차단", () => {
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

    it("(p') runPlan.run.dateToken 빈('') → aggregator측 publish 위임 descriptor assertNonBlank('dateToken') throw 대칭", () => {
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

    it("(q) runPlan.run.gitSha 빈('') → post(buildRealDataResultOutcomeStepArgs) 측 위임 assertNonBlank throw(post boundary 종단 비식별 — execStdout URL 정상이어도 차단)", () => {
      const base = buildRunPlan();
      const blankRunPlan: RealDataE2eRunPlan = {
        pipeline: base.pipeline,
        run: { gitSha: "", dateToken: "2026-06-29" },
      };
      expect(() =>
        buildRealDataResultOutcomeStepArgs(blankRunPlan, execStdout(7)),
      ).toThrow();
    });

    it("(r) searchStdout 비JSON('not json') → resolve parse 위임 throw(stepArgs.publish.commandArgs 정상이어도 hits 추출 실패로 차단)", () => {
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

    it("(s) execStdout URL 미발견(빈 문자열) → post parse 위임 throw(runPlan.run 정상이어도 outcome 추출 실패)", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(buildRunPlan(), ""),
      ).toThrow();
    });

    it("(s') execStdout /issues/0 → post assertPositiveIssueNumber throw(post 비식별)", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(
          buildRunPlan(),
          `https://github.com/${OWNER}/${REPO}/issues/0\n`,
        ),
      ).toThrow();
    });

    // command-args-labels 축 negative — labels 는 빌더 보유 고정 상수 `[...RESULT_ISSUE_LABELS]`
    // (command-args.ts 133행)라 **입력으로 빈/공백 labels 를 직접 트리거할 수 없다**(descriptor 에
    // labels 필드 부재·빌더가 항상 고정 상수 복제본 합성). 따라서 labels-축 boundary 는
    // marker/title guard 가 descriptor 합성 단계에서 상위 차단함을 보이는 대칭이다 — marker 가
    // 빈/공백이면(gitSha/dateToken 비식별로 marker 합성 실패) command-args 빌더의
    // `assertNonBlank("marker")`(124행)가 step-args 산출(labels 포함)을 합성 도달 전 throw 한다.
    // 즉 labels 합성 도달 전 marker guard 가 상위에서 막는다. 본 it 은 그 대칭을 명시.
    it("(t) command-args-labels 축 negative 대체 — labels 는 입력-비종속 고정 상수라 입력으로 직접 비식별 트리거 불가. 대신 marker 빈/공백(run.gitSha/dateToken 비식별로 descriptor.marker 합성 실패)이 command-args 빌더 assertNonBlank('marker')(124행) throw 를 그대로 전파해 step-args 산출(labels 포함)을 차단함(labels 합성 도달 전 marker guard 상위 차단 — boundary 대칭). 정상 run → labels 항상 non-blank 고정 상수, blank gitSha → aggregator publish 위임 throw(labels 합성 미도달)", () => {
      // 정상 run → labels 항상 고정 상수(비-empty), 입력으로 비식별 트리거 불가.
      const runPlan = buildRunPlan();
      const stepArgs = buildRealDataE2eStepArgs(
        runPlan,
        defaultActivities(),
        defaultResults(),
      );
      expect(stepArgs.publish.commandArgs.createArgs.labels).toEqual(
        EXPECTED_RESULT_ISSUE_LABELS,
      );
      stepArgs.publish.commandArgs.createArgs.labels.forEach((label) => {
        expect(label.trim().length).toBeGreaterThan(0);
      });

      // blank gitSha → marker/title/labels 합성 도달 전 상위 run-token guard 로 차단(labels 미도달).
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

  describe("결정론·무공유·no-mutation — chain 두 번 호출 + 입력 불변 + 무공유 + labels 오염 0", () => {
    it("(u) 동일 (runPlan, activities, results, searchStdout, execStdout) chain 두 번 → stepArgs(evaluation+publish)/resolvePlan/outcomeReport 모두 deep-equal(결정론)", () => {
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

    it("(v) no-mutation — 입력 runPlan·activities·results chain 호출 후 deep-equal(원본 불변). 직접 호출 재유도도 같은 results·runPlan 공유 읽기지만 입력 변형 0", () => {
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

    it("(w) 무공유 — 직접 호출 buildRealDataResultIssueCommandPlan(results, runPlan.run).commandArgs.createArgs.labels 와 stepArgs.publish.commandArgs.createArgs.labels 는 deep-equal 이되 referential 분리(not.toBe, 무공유 새 배열). 보조: commandArgs/createArgs 객체도 referential 분리", () => {
      const runPlan = buildRunPlan();
      const results = defaultResults();
      const { stepArgs } = runChain(
        [7, 13],
        runPlan,
        defaultActivities(),
        results,
      );

      const directCommandArgs = buildRealDataResultIssueCommandPlan(
        results,
        runPlan.run,
      ).commandArgs;
      // labels deep-equal 이되 referential 분리(새 배열, 무공유).
      expect(stepArgs.publish.commandArgs.createArgs.labels).toEqual(
        directCommandArgs.createArgs.labels,
      );
      expect(stepArgs.publish.commandArgs.createArgs.labels).not.toBe(
        directCommandArgs.createArgs.labels,
      );
      // commandArgs/createArgs 객체도 referential 분리(무공유).
      expect(stepArgs.publish.commandArgs).toEqual(directCommandArgs);
      expect(stepArgs.publish.commandArgs).not.toBe(directCommandArgs);
      expect(stepArgs.publish.commandArgs.createArgs).not.toBe(
        directCommandArgs.createArgs,
      );
    });

    it('(x) labels 오염 0 — stepArgs.publish.commandArgs.createArgs.labels.push(\'x\') 후 새 chain 의 labels 가 여전히 ["realdata-e2e","result"](고정 상수·이전 호출 반환 모두 오염 0) — 무공유 + 상수 불변 박제', () => {
      const first = runChain([7, 13]);
      // 반환 labels 배열 mutate(오염 시도).
      first.stepArgs.publish.commandArgs.createArgs.labels.push("x");
      expect(first.stepArgs.publish.commandArgs.createArgs.labels).toContain(
        "x",
      );

      // 새 chain 의 labels 는 여전히 고정 상수(이전 호출 mutate 누설 0).
      const second = runChain([7, 13]);
      expect(second.stepArgs.publish.commandArgs.createArgs.labels).toEqual(
        EXPECTED_RESULT_ISSUE_LABELS,
      );
      expect(
        second.stepArgs.publish.commandArgs.createArgs.labels,
      ).not.toContain("x");
      // 직접 호출 재유도도 오염 0.
      const fresh = buildRealDataResultIssueCommandPlan(
        defaultResults(),
        buildRunPlan().run,
      );
      expect(fresh.commandArgs.createArgs.labels).toEqual(
        EXPECTED_RESULT_ISSUE_LABELS,
      );
    });
  });

  describe("credential 누출 0(branch — §9 / R-59 / REQ-059 정합)", () => {
    it("(y) stepArgs.publish.commandArgs.{createArgs.labels(join),createArgs.title,updateArgs.title,createArgs.body,updateArgs.body,searchQuery} · report.descriptor.{title,marker,body} · report.summary(직렬화) · evaluation.inputs·callArgs(직렬화) · searchArgv(각 원소) · resolvePlan.argv · outcomeReport.{url,summaryLine} 어디에도 token/secret/PAT/--auth 어휘 미등장(특히 실 gh issue --label 인자로 나가는 createArgs.labels 명시)", () => {
      const { stepArgs, resolvePlan, outcomeReport } = runChain([7, 13]);

      const surfaces: string[] = [
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
        resolvePlan.argv.join(" "),
        outcomeReport.url,
        outcomeReport.summaryLine,
      ];

      const credentialPattern =
        /(GH_TOKEN|GITHUB_TOKEN|Bearer|Authorization|x-access-token|x-github-token|--token|--auth|ghp_[A-Za-z0-9]|PAT)/i;
      for (const surface of surfaces) {
        expect(surface).not.toMatch(credentialPattern);
      }
      // createArgs.labels(실 gh issue --label 인자로 나가는 분류 라벨)에 credential 어휘 미등장 명시.
      stepArgs.publish.commandArgs.createArgs.labels.forEach((label) => {
        expect(label).not.toMatch(credentialPattern);
      });
      // outcome url 은 issue 경로만 — commit/PR narrative 어휘 미포함.
      expect(outcomeReport.url).not.toMatch(/commit|pull request/i);
    });
  });
});
