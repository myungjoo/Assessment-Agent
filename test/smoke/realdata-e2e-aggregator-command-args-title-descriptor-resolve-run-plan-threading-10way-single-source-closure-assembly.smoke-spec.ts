// realdata-e2e-aggregator-command-args-title-descriptor-resolve-run-plan-threading-10way-single-source-closure-assembly.smoke-spec.ts
// — 실 평가 e2e step④ aggregator command-args-title 합류 10-way single-source closure:
// pre-실행 aggregator `buildRealDataE2eStepArgs(runPlan, activities, results)` 의 publish leg
// **실행-인자 식별 제목 surface `commandArgs.createArgs.title` / `commandArgs.updateArgs.title`
// (gh issue create/edit 두 실행 경로의 이슈 제목 필드)** 를 단일 source `(results, runPlan.run)`
// 재유도 + `report.descriptor.title` 와 byte-identical 로 closure 에 묶어, 검증 source
// `(runPlan, activities, results)` 세 source 가 다음 10 축의 동시 source 임을 한 chain 으로 박제한다:
//   (축 10, 본 task 의 새 표면) **publish.commandArgs.createArgs.title / updateArgs.title 두
//      실행 경로 일치 + 단일-source 재유도** — `stepArgs.publish.commandArgs.createArgs.title`
//      와 `stepArgs.publish.commandArgs.updateArgs.title` 가 **둘 다 `stepArgs.publish.report
//      .descriptor.title` 와 byte-identical string equal(`toBe`)**, 그리고 동일 `results`·동일
//      `runPlan.run` 으로 직접 호출한 `buildRealDataResultIssueCommandPlan(results,
//      runPlan.run).commandArgs.{create,update}Args.title` 와도 byte-identical 재유도. 즉 gh
//      issue create 경로 제목 == gh issue edit 경로 제목 == report descriptor 제목 == 단일-source
//      식별 제목. **재유도는 command-plan 경유**(aggregator 가 실제 거치는 동일 위임 경로 —
//      `buildRealDataResultIssueCommandArgs`·`buildRealDataResultIssueDescriptor` 직접 호출 0,
//      SSOT). descriptor.title(report 측 사람-대면 식별 제목)와 distinct 한 실행-인자 surface.
//      title 식별자 surface 는 body content surface(T-0778)와 distinct — descriptor.title 은
//      run 종속(고정 prefix + run token), results 무관(descriptor 합성 `${PREFIX} ${dateToken}@${gitSha}`).
//   (축 9, T-0778 cover 영역의 10-way 묶음 항) **publish.commandArgs.createArgs.body /
//      updateArgs.body 두 실행 경로 일치** — 둘 다 `stepArgs.publish.report.descriptor.body` 와
//      byte-identical(body content surface, title identifier surface 와 distinct).
//   (축 7~8) **publish.report.descriptor.{title,body} results+run-재유도 byte-identical** —
//      deep-equal command-plan 재유도.
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
// 이 10-way 가 **세 검증 source `(runPlan, activities, results)`** single-source 에서 한 chain
// 동시-호출로 byte-identical 수렴함을 박제하는 첫 aggregator-command-args-title 합류 10-way
// single-source closure non-gated build-time smoke (T-0779 박제, PLAN.md 109행 🟢 실 평가
// e2e step④). publish leg 의 네 출력 surface(정량 집계 summary + 사람-대면 렌더 descriptor.body
// + 식별 제목 descriptor.title + 실행-인자 command-args body·title 두 경로)가 모두 단일-source
// 재유도/일치로 묶이는 slice.
//
// 본 spec 의 존재 이유 — public CI gap 해소(publish leg 의 command-args-title 두 실행 경로 축을
// 10번째 축으로 합류):
//   - aggregator `buildRealDataE2eStepArgs(runPlan, activities, results)`(T-0601)는 세 입력
//     source 를 받는다 — runPlan(검증된 modelId+run), activities(수집 산출), results(평가
//     산출). T-0778 이 publish leg 의 실행-인자 본문 surface `commandArgs.{createArgs,updateArgs}
//     .body` 를 단일 source 산출 `descriptor.body` 와 byte-identical 로 closure 에 묶어 9-way 를
//     완성했다.
//   - 직전 sibling 들은 publish leg 의 distinct 한 실행-인자 식별자 surface
//     `commandArgs.{createArgs,updateArgs}.title`(gh issue create/edit 두 경로 이슈 제목)을
//     byte-identical closure 에 합류시키지 않았다:
//       T-0778 (aggregator 9-way) — publish leg `commandArgs.{create,update}Args.body`(=descriptor
//         .body)+`report.descriptor.body`+`report.summary`+evaluation inputs/modelId+marker/
//         searchArgv/run-identity 를 단일 (runPlan, activities, results) source 로 수렴 박제.
//         그러나 `commandArgs.createArgs.title`·`commandArgs.updateArgs.title`(=descriptor.title 가
//         실 gh 명령 인자로 들어간 두 실행 경로 식별 surface)는 convergence closure 에 미합류 —
//         그 spec 안 title 참조는 credential-leak negative 의 직렬화 surface 列거(1108~1117행)일 뿐.
//       T-0777/0776/0775/0774/0773 (aggregator 8·7·6·5·4-way) — command-args 의 body·
//         searchQuery·marker 축만 합류 — `createArgs.title`·`updateArgs.title` 미합류.
//       command-args / command-args-labels-title / command-plan helper·assembly smoke —
//         createArgs.title/updateArgs.title 의 descriptor.title 일치 자체는 박제했으나
//         (T-0651 labels-title 가드) aggregator(`buildRealDataE2eStepArgs`) 진입·resolve·post
//         미합류(단독 helper 호출 또는 command-plan-level assembly 만).
//   - 본 spec 은 그 빈 자리를 채워 **publish leg 의 두 실행 경로 title(createArgs.title·
//     updateArgs.title)을 같은 aggregator 산출 descriptor.title 와 byte-identical 로 closure 에
//     묶어**, 검증 source `(runPlan, activities, results)` 세 source 가 aggregator publish leg 의
//     네 출력 surface(정량 집계 summary + 사람-대면 렌더 descriptor.body + 식별 제목 descriptor.title
//     + 실행-인자 command-args body·title 두 경로)와 evaluation leg(inputs+modelId), 그리고
//     marker/searchArgv/run-identity 의 source 임을 resolve+post 까지 묶은 한 chain 으로 박제한다.
//   - 이 10-way 가 세 검증 source single-source 로 수렴함이 search-or-update 멱등성(REQ-009 —
//     create/update 두 경로가 같은 식별 제목·marker-보존 본문)·raw 미보유 평가 입력/결과 집계
//     정합(REQ-032)·결과 리포트 재실행 정합(REQ-037)의 aggregator-level "정량 집계(summary)+
//     사람-대면 본문(descriptor.body)+식별 제목(descriptor.title)+실행 인자 본문·제목(command-args
//     body·title 두 경로)+평가 입력(inputs)+평가 정책(modelId)+publish 식별(marker/searchArgv/
//     run-identity)이 같은 세 검증 source 에서 나옴"의 종단 닫음이다.
//   - live leg(실 prisma·실 collectForPerson·실 github.com fetch·실 LLM scoring·실 gh CLI
//     실행·DB·LAN gate)는 복제하지 않고, synthetic runPlan(buildRealDataE2eRunPlan 합성) +
//     activities/results literal + search-stdout/exec-stdout literal 을 컴포저들에 직접 공급해
//     live leg 를 우회한다(조립 surface 만 검증). 따라서 본 spec 은:
//
//      🔥 실 gh 호출 0 — gh search / list / create / edit / execFile('gh', argv) 미실행.
//         synthetic searchStdout / execStdout / runPlan / activities / results literal 직접 공급.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 LLM scoreUnit 호출 0 / 실 DB 접근 0 / 실 jest spawn 0 — 10-way 수렴 조립만.
//         results 는 summary/body 정량 집계·렌더 식별자 운반만 검증(실 scoreUnit 호출 0).
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 step-args aggregator / evaluation-inputs / command-plan
//         / outcome-step-args / run-plan / gh-command-plan / seed-fixture 컴포저 import
//         재사용만(가드/helper 신설 0). `extractSearchMarker` 는 spec 로컬 함수(T-0778/T-0729
//         패턴 차용).
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0779):
//   - src 변경 0(src/, prisma/, package.json, CI workflow, 환경 변수 추가 등 모두 금지). test-only.
//   - 실 gh CLI 호출 / `execFile('gh', searchArgv)` 실행 / 실 LLM scoreUnit 호출 / 실 issue
//     검색·박제(step④ live wiring — credential gate, deferred). 본 task 는 in-memory 합성
//     search-stdout / exec-stdout 만. command-args title 은 **사람-대면 식별 제목 운반만**
//     검증(실 issue 박제 0).
//   - aggregator 9-way(command-args body 두 경로 == descriptor.body + descriptor.body 렌더
//     재유도 + results-summary 재유도 + evaluation.inputs 재유도 + callArgs.input 페어링 +
//     modelId + publish marker/searchArgv/run-identity) 자체 재단언(T-0778 cover). 본 task 는
//     publish leg `commandArgs.createArgs.title`·`commandArgs.updateArgs.title`(=descriptor.title 와
//     byte-identical, 두 실행 경로)를 10번째 축으로 합류시킨 부분만.
//   - command-args body·title 의 marker-first 구조·labels 정합 self-guard
//     (`assertRealDataResultIssueCommandArgsBodyPreservesDescriptor`·
//     `assertRealDataResultIssueCommandArgsLabelsTitleConsistent`, T-0646/T-0651) 자체 재단언.
//     본 task 는 aggregator 산출 command-args title 이 descriptor.title 와 byte-identical 함만.
//   - descriptor.title/body 합성 로직·self-guard 자체 재단언(descriptor helper spec, T-0582 cover).
//   - buildRealDataResultSummary 의 집계 로직 자체 재단언(summary helper spec cover).
//   - createArgs.labels 정합·labels 무공유 단독 재단언(command-args-labels-title 가드 cover).
//     본 task 는 createArgs.title·updateArgs.title 만(labels 무공유는 결정론 단언의 보조 수준).
//   - 난이도별 modelId routing(R-97 deferred) 검증 — 단일 modelId 동형 적용(ADR-0048)만.
//   - searchArgv 전체 형식(gh issue list 플래그 순서·--repo·--state 등) 재단언(search-gh-argv
//     가드 / T-0729 cover). 본 task 는 `--match` 위치 marker 토큰만.
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
  "cfg-realdata-e2e-aggregator-command-args-title-descriptor-resolve-threading-smoke";

const INSTANCE_KEY = "github.com";

// search argv 안 marker 추출 헬퍼 — 빌더 canonical shape (["search","issues","--match",
// "body",<marker>,"--json","number,title,body","--limit","30"]) 에서 marker 는 `--match
// body` 직후다. 위치 매직 넘버 대신 `--match` 기준 상대 추출(round-trip drift 강건).
// T-0778/T-0729 sibling 헬퍼 패턴 mirror.
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
// descriptor.title(= `${PREFIX} ${token}`)·marker 가 모두 이 token 을 운반한다.
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
  externalId = "realdata-e2e-aggregator-command-args-title-c1",
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
      "aggregator-command-args-title-c1",
      "commit",
    ),
    syntheticActivity(firstUsername, "aggregator-command-args-title-p1", "pr"),
    syntheticActivity(
      firstUsername,
      "aggregator-command-args-title-i1",
      "issue",
    ),
  ];
}

// synthetic EvaluationResult 1 건 — aggregator 의 publish leg 입력(summary 집계 + body 렌더 +
// command-args body source). title 은 results 무관(run 종속)이므로 results 변경은 body·summary
// 만 변별한다.
function syntheticResult(
  unitId: string,
  difficulty: EvaluationResult["difficulty"],
  contribution: EvaluationResult["contribution"],
  volume: number,
): EvaluationResult {
  return {
    unitId,
    narrative:
      "synthetic evaluation narrative — aggregator command-args-title+command-args-body+descriptor-{title,body}+results-summary+evaluation-inputs+modelId+searchArgv ↔ resolve ↔ outcome-step-args run-plan-threading 10-way closure smoke fixture",
    difficulty,
    contribution,
    volume,
  };
}

// 유효 results fixture(분포 X) — aggregator 의 publish leg summary 집계 + body 렌더 source.
// 다양한 difficulty/contribution/volume 으로 summary·body 의 count·분포·totalVolume 변별.
function defaultResults(): EvaluationResult[] {
  return [
    syntheticResult("github:github.com:c1", "easy", "low", 3),
    syntheticResult("github:github.com:c2", "medium", "high", 5),
    syntheticResult("github:github.com:c3", "hard", "medium", 2),
  ];
}

// 다른 분포(Y) results fixture — summary·body 변별성 단언용(다른 count·difficulty/contribution
// 분포·totalVolume). defaultResults 와 다른 정량 집계·본문 렌더를 산출한다. title 은 run 종속
// 이므로 results_A vs results_B 의 title 은 동일(run 동일 시) — 변별은 body·summary 만.
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
// thread 하고, results 가 publish leg 의 commandArgs.{create,update}Args.title(축 10, run 종속)·
// body(축 9)·report.descriptor.{title,body}(축 7~8)·report.summary(축 6) 재유도 source 가 된다.
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
  // 재유도 source(축 5), 동일 results 가 publish.commandArgs.{create,update}Args.body(축 9)·
  // report.descriptor.body(축 8)·report.summary(축 6) 재유도 source. title(축 10·축 7)은 run 종속.
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

describe("Smoke(non-gated): 실 평가 e2e step④ aggregator command-args-title 합류 10-way single-source closure buildRealDataE2eStepArgs(.publish.commandArgs.createArgs.title == .publish.commandArgs.updateArgs.title == .publish.report.descriptor.title(=buildRealDataResultIssueCommandPlan(results, runPlan.run).{commandArgs.{create,update}Args.title, report.descriptor.title} byte-identical) + .publish.commandArgs.{create,update}Args.body == .publish.report.descriptor.body + .publish.report.{descriptor.body, summary}(=동 command-plan 재유도) + .evaluation {inputs(=buildRealDataEvaluationInputs(activities), callArgs[i].input===inputs[i]), callArgs[].options.modelId} + .publish {descriptor.marker, commandArgs.searchQuery, searchArgv --match})↔resolve↔buildRealDataResultOutcomeStepArgs 동일 (runPlan, activities, results) 한 chain 동시-호출(command-args title 두 경로 일치 + command-args body 두 경로 일치 + descriptor.{title,body} 재유도 + summary 재유도 + inputs 재유도 + modelId + marker 3-축 + issueNumber + run-identity 10축 동시 수렴, 재전달 0) live-gh/live-LLM 0 검증", () => {
  describe("happy path — aggregator 10-way chain 합성(다섯 산출물 모두 정상)", () => {
    it("(a) 유효 runPlan + activities + results + searchStdout + execStdout → stepArgs.evaluation({inputs,callArgs} 비어있지 않음) / stepArgs.publish({report,commandArgs,searchArgv} 정상·commandArgs.createArgs.title·commandArgs.updateArgs.title 비어있지 않은 문자열·commandArgs.createArgs.body·commandArgs.updateArgs.body 비어있지 않은 문자열·report.descriptor.title·report.descriptor.body 비어있지 않은 문자열·report.summary 존재·commandArgs.searchQuery 존재) / resolvePlan(update {action, issueNumber} + argv) / outcomeReport(5필드) 다섯 산출물 모두 정상", () => {
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
      // commandArgs.createArgs.title / updateArgs.title 존재(축 10 reachable — 실행-인자 식별 제목).
      expect(typeof stepArgs.publish.commandArgs.createArgs.title).toBe(
        "string",
      );
      expect(
        stepArgs.publish.commandArgs.createArgs.title.length,
      ).toBeGreaterThan(0);
      expect(typeof stepArgs.publish.commandArgs.updateArgs.title).toBe(
        "string",
      );
      expect(
        stepArgs.publish.commandArgs.updateArgs.title.length,
      ).toBeGreaterThan(0);
      // commandArgs.createArgs.body / updateArgs.body 존재(축 9 reachable — 실행-인자 본문).
      expect(typeof stepArgs.publish.commandArgs.createArgs.body).toBe(
        "string",
      );
      expect(
        stepArgs.publish.commandArgs.createArgs.body.length,
      ).toBeGreaterThan(0);
      expect(typeof stepArgs.publish.commandArgs.updateArgs.body).toBe(
        "string",
      );
      expect(
        stepArgs.publish.commandArgs.updateArgs.body.length,
      ).toBeGreaterThan(0);
      // report.descriptor.title / body 존재(축 7~8 reachable — 식별 제목·본문 렌더 비어있지 않음).
      expect(typeof stepArgs.publish.report.descriptor.title).toBe("string");
      expect(stepArgs.publish.report.descriptor.title.length).toBeGreaterThan(
        0,
      );
      expect(typeof stepArgs.publish.report.descriptor.body).toBe("string");
      expect(stepArgs.publish.report.descriptor.body.length).toBeGreaterThan(0);
      // report.summary 존재(축 6 reachable — count/분포/totalVolume).
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

  describe("publish-leg command-args-title 두 경로 일치 수렴(branch — 핵심 불변식 1, 본 task 의 새 표면 — 축 10)", () => {
    it("(b) stepArgs.publish.commandArgs.createArgs.title === report.descriptor.title AND commandArgs.updateArgs.title === report.descriptor.title byte-identical string equal — gh issue create 경로 제목 == gh issue edit 경로 제목 == report descriptor 제목 == 단일-source 식별 제목. 보조: 두 경로 title 서로도 동일(create/update 어느 멱등 분기든 같은 식별 제목), title 이 run token 포함(run 종속)", () => {
      const runPlan = buildRunPlan();
      const { stepArgs } = runChain([7, 13], runPlan);

      const descriptorTitle = stepArgs.publish.report.descriptor.title;
      // create/update 두 실행 경로 title 이 둘 다 descriptor.title 와 byte-identical.
      expect(stepArgs.publish.commandArgs.createArgs.title).toBe(
        descriptorTitle,
      );
      expect(stepArgs.publish.commandArgs.updateArgs.title).toBe(
        descriptorTitle,
      );
      // 보조 — 두 경로 title 이 서로도 동일(멱등성 — create/update 어느 분기든 같은 식별 제목).
      expect(stepArgs.publish.commandArgs.createArgs.title).toBe(
        stepArgs.publish.commandArgs.updateArgs.title,
      );
      // 보조 — title 이 run token(`${dateToken}@${gitSha}`)을 운반(run 종속 식별 제목).
      expect(descriptorTitle).toContain(expectedToken(runPlan.run));
      expect(stepArgs.publish.commandArgs.createArgs.title).toContain(
        expectedToken(runPlan.run),
      );
    });
  });

  describe("publish-leg command-args-title 단일-source 재유도 byte-identical(branch — 핵심 불변식 2, 축 10)", () => {
    it("(c) buildRealDataResultIssueCommandPlan(results, runPlan.run).commandArgs.createArgs.title === stepArgs.publish.commandArgs.createArgs.title AND 동 command-plan.commandArgs.updateArgs.title === stepArgs.publish.commandArgs.updateArgs.title byte-identical — aggregator 의 publish leg 두 실행 경로 title 이 단일 (results, run) source 로부터 command-plan 경유 동형 도출(buildRealDataResultIssueCommandArgs·buildRealDataResultIssueDescriptor 직접 호출 0, SSOT)", () => {
      const runPlan = buildRunPlan();
      const results = defaultResults();
      const { stepArgs } = runChain(
        [7, 13],
        runPlan,
        defaultActivities(),
        results,
      );

      // 동일 results·동일 runPlan.run 으로 직접 호출한 command-plan 의 두 경로 title 과
      // byte-identical string equal — aggregator 가 두 title 을 같은 source·같은 위임 경로로 재유도.
      const cmdPlan = buildRealDataResultIssueCommandPlan(results, runPlan.run);
      expect(stepArgs.publish.commandArgs.createArgs.title).toBe(
        cmdPlan.commandArgs.createArgs.title,
      );
      expect(stepArgs.publish.commandArgs.updateArgs.title).toBe(
        cmdPlan.commandArgs.updateArgs.title,
      );
    });
  });

  describe("publish-leg command-args-body 두 경로 일치 수렴(branch — 핵심 불변식 3, T-0778 cover 영역의 10-way 묶음 항 — 축 9)", () => {
    it("(d) stepArgs.publish.commandArgs.createArgs.body === report.descriptor.body AND commandArgs.updateArgs.body === report.descriptor.body byte-identical — body content surface 와 title identifier surface 가 같은 단일 source 의 distinct 한 두 실행-인자 표면임을 명시", () => {
      const { stepArgs } = runChain([7, 13]);

      const descriptorBody = stepArgs.publish.report.descriptor.body;
      expect(stepArgs.publish.commandArgs.createArgs.body).toBe(descriptorBody);
      expect(stepArgs.publish.commandArgs.updateArgs.body).toBe(descriptorBody);
      // title(식별자)·body(본문)는 distinct surface — 서로 다른 값(title 은 한 줄, body 는 다줄).
      expect(stepArgs.publish.commandArgs.createArgs.title).not.toBe(
        stepArgs.publish.commandArgs.createArgs.body,
      );
    });
  });

  describe("publish-leg descriptor-{title,body} 렌더 재유도 byte-identical 수렴(branch — 핵심 불변식 4, 축 7~8)", () => {
    it("(e) stepArgs.publish.report.descriptor.title === buildRealDataResultIssueCommandPlan(results, runPlan.run).report.descriptor.title AND descriptor.body === 동 command-plan.report.descriptor.body byte-identical — command-args title/body(실행 인자)와 descriptor.title/body(report 측 렌더)가 같은 단일 source 의 distinct surface 임을 명시", () => {
      const runPlan = buildRunPlan();
      const results = defaultResults();
      const { stepArgs } = runChain(
        [7, 13],
        runPlan,
        defaultActivities(),
        results,
      );

      const cmdPlan = buildRealDataResultIssueCommandPlan(results, runPlan.run);
      // descriptor.title/body 재유도와 byte-identical.
      expect(stepArgs.publish.report.descriptor.title).toBe(
        cmdPlan.report.descriptor.title,
      );
      expect(stepArgs.publish.report.descriptor.body).toBe(
        cmdPlan.report.descriptor.body,
      );
      // command-args title/body(실행 인자) 와 descriptor.title/body(report 측 렌더) 셋 다 동일 source.
      expect(stepArgs.publish.commandArgs.createArgs.title).toBe(
        cmdPlan.report.descriptor.title,
      );
      expect(stepArgs.publish.commandArgs.updateArgs.title).toBe(
        cmdPlan.report.descriptor.title,
      );
      expect(stepArgs.publish.commandArgs.createArgs.body).toBe(
        cmdPlan.report.descriptor.body,
      );
    });
  });

  describe("publish-leg results-summary 재유도 byte-identical 수렴(branch — 핵심 불변식 5, 축 6)", () => {
    it("(f) stepArgs.publish.report.summary deep-equal buildRealDataResultIssueCommandPlan(results, runPlan.run).report.summary — command-args title(식별)·body(렌더)와 summary(정량 집계 객체)가 같은 단일 source (results, run)의 distinct surface 임을 명시", () => {
      const runPlan = buildRunPlan();
      const results = defaultResults();
      const { stepArgs } = runChain(
        [7, 13],
        runPlan,
        defaultActivities(),
        results,
      );

      const cmdPlan = buildRealDataResultIssueCommandPlan(results, runPlan.run);
      // summary deep-equal(정량 집계 객체) AND command-args title string equal(실행 인자) — 같은 source.
      expect(stepArgs.publish.report.summary).toEqual(cmdPlan.report.summary);
      expect(stepArgs.publish.commandArgs.createArgs.title).toBe(
        cmdPlan.commandArgs.createArgs.title,
      );
      // 정량 집계 변별 — count·totalVolume 가 results 분포 종속(3건, volume 3+5+2=10).
      expect(stepArgs.publish.report.summary.count).toBe(results.length);
      expect(stepArgs.publish.report.summary.totalVolume).toBe(10);
    });
  });

  describe("evaluation-leg inputs 재유도 + callArgs.input 페어링(branch — 핵심 불변식 6, 축 5)", () => {
    it("(g) stepArgs.evaluation.inputs deep-equal buildRealDataEvaluationInputs(activities) AND 모든 callArgs[i].input === inputs[i] referential 페어링 + 길이 일치", () => {
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

  describe("evaluation-leg modelId thread 수렴(branch — 핵심 불변식 7, 축 4)", () => {
    it("(h) 모든 stepArgs.evaluation.callArgs[i].options.modelId === runPlan.pipeline.modelId — 단일 검증 runPlan 의 평가 정책 modelId 가 평가 호출-args 전체에 동형 thread", () => {
      const runPlan = buildRunPlan();
      const { stepArgs } = runChain([7, 13], runPlan);

      expect(stepArgs.evaluation.callArgs.length).toBeGreaterThan(0);
      stepArgs.evaluation.callArgs.forEach((c) => {
        expect(c.options.modelId).toBe(runPlan.pipeline.modelId);
      });
      expect(runPlan.pipeline.modelId).toBe(MODEL_ID);
    });
  });

  describe("publish-leg 내부 marker 3-축 일치(branch — 핵심 불변식 8, 축 2~3)", () => {
    it("(i) extractSearchMarker(searchArgv) === report.descriptor.marker === commandArgs.searchQuery — 세 내부 marker 축이 byte-identical, marker 가 searchArgv 안 정확히 1회 등장, AND createArgs.body·updateArgs.body 첫 줄 === marker(두 body 가 marker 를 포함)", () => {
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
      // createArgs.body·updateArgs.body 첫 줄(=marker 라인)이 그 marker 와 동일.
      expect(stepArgs.publish.commandArgs.createArgs.body.split("\n")[0]).toBe(
        descriptorMarker,
      );
      expect(stepArgs.publish.commandArgs.updateArgs.body.split("\n")[0]).toBe(
        descriptorMarker,
      );
    });
  });

  describe("marker → resolve issueNumber + post run-identity 수렴(branch — 핵심 불변식 9, 축 1)", () => {
    it("(j) search hit N → resolve.action.update.issueNumber → outcome step-args.issueNumber 세 지점 모두 동일 N + url 에 /issues/N + 동일 runPlan.run 전파(marker run token == outcomeReport.{gitSha,dateToken,summaryLine})", () => {
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

  describe("10-way 단일-source 묶음 단언(branch — closure 종단, 본 task 의 종단 박제)", () => {
    it("(k) publish.commandArgs.createArgs.title == publish.commandArgs.updateArgs.title == publish.report.descriptor.title == buildRealDataResultIssueCommandPlan(results, runPlan.run).report.descriptor.title, publish.commandArgs.{create,update}Args.body == publish.report.descriptor.body == 동 command-plan.report.descriptor.body, publish.report.summary == 동 command-plan.report.summary, evaluation.inputs == buildRealDataEvaluationInputs(activities), callArgs[].input === inputs[i], callArgs[].options.modelId == runPlan.pipeline.modelId, searchArgv --match 토큰 == descriptor.marker == commandArgs.searchQuery, 그 marker 로 resolve 가 찾은 N == post 가 해석한 N, 그 marker 의 run token == post 가 전파한 {gitSha,dateToken} 가 세 검증 source (runPlan, activities, results) single-source 에서 10-way 동시 성립", () => {
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

      // axis 10(새 표면) — command-args title 두 경로 일치 + command-plan 재유도 byte-identical.
      expect(stepArgs.publish.commandArgs.createArgs.title).toBe(
        cmdPlan.commandArgs.createArgs.title,
      );
      expect(stepArgs.publish.commandArgs.updateArgs.title).toBe(
        cmdPlan.commandArgs.updateArgs.title,
      );
      expect(stepArgs.publish.commandArgs.createArgs.title).toBe(
        stepArgs.publish.commandArgs.updateArgs.title,
      );
      // axis 7(title) — publish.report.descriptor.title byte-identical command-plan 재유도(셋 다 동일).
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
      // axis 8(body) — publish.report.descriptor.body byte-identical command-plan 재유도(셋 다 동일).
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
      // command-args title 두 경로가 run token 을 운반(run 종속 식별 제목).
      expect(stepArgs.publish.commandArgs.createArgs.title).toContain(token);
      expect(stepArgs.publish.commandArgs.updateArgs.title).toContain(token);
      // command-args body 두 경로가 marker 라인(첫 블록)으로 그 run token 을 운반.
      expect(stepArgs.publish.commandArgs.createArgs.body.split("\n")[0]).toBe(
        marker,
      );
      // 10-way 동시 closure — 세 검증 source single-source 에서 열 축이 한 chain 으로 묶임.
      expect(`${runPlan.run.dateToken}@${runPlan.run.gitSha}`).toBe(token);
    });
  });

  describe("results 축 변별성(branch — results 가 body·summary 를 결정, title·activities·modelId·run 은 독립 축 — title 은 run 종속이라 results 변경에 불변)", () => {
    it("(l) results_A(분포 X) vs results_B(분포 Y) 로 같은 runPlan·activities·N 으로 chain → A.commandArgs.{create,update}Args.body == cmdPlan(results_A,run).body, B 는 (results_B,run) 각각 byte-identical(results 가 body 를 결정) → 두 chain 의 createArgs.body·updateArgs.body·summary 는 서로 다름(not.toBe/not.toEqual) → 그러나 command-args {create,update}Args.title(run 종속·results 무관) / evaluation.inputs / modelId / descriptor.marker / searchArgv --match / resolve issueNumber / outcomeReport.{gitSha,dateToken} 는 두 chain 동일(results 변경이 title·inputs·modelId·marker·run-identity·issueNumber 어느 축에도 누설 0 — REQ-009 정합)", () => {
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

      // 축 9 — command-args body 두 경로가 results 로부터 각각 재유도(byte-identical command-plan).
      const cmdA = buildRealDataResultIssueCommandPlan(resultsA, runPlan.run);
      const cmdB = buildRealDataResultIssueCommandPlan(resultsB, runPlan.run);
      expect(chainA.stepArgs.publish.commandArgs.createArgs.body).toBe(
        cmdA.commandArgs.createArgs.body,
      );
      expect(chainB.stepArgs.publish.commandArgs.createArgs.body).toBe(
        cmdB.commandArgs.createArgs.body,
      );
      // command-args body·summary 변별(results 분포 다름이 본문·집계에 반영).
      expect(chainA.stepArgs.publish.commandArgs.createArgs.body).not.toBe(
        chainB.stepArgs.publish.commandArgs.createArgs.body,
      );
      expect(chainA.stepArgs.publish.commandArgs.updateArgs.body).not.toBe(
        chainB.stepArgs.publish.commandArgs.updateArgs.body,
      );
      expect(chainA.stepArgs.publish.report.summary).not.toEqual(
        chainB.stepArgs.publish.report.summary,
      );

      // 축 10 — command-args title 은 run 종속·results 무관 → results 변경에 불변(두 chain 동일).
      // (descriptor.title = `${PREFIX} ${dateToken}@${gitSha}` — results 미참조)
      expect(chainA.stepArgs.publish.commandArgs.createArgs.title).toBe(
        chainB.stepArgs.publish.commandArgs.createArgs.title,
      );
      expect(chainA.stepArgs.publish.commandArgs.updateArgs.title).toBe(
        chainB.stepArgs.publish.commandArgs.updateArgs.title,
      );
      expect(chainA.stepArgs.publish.report.descriptor.title).toBe(
        chainB.stepArgs.publish.report.descriptor.title,
      );
      // 각 chain 의 title 은 각 command-plan 재유도와 byte-identical(같은 run → 동일 title).
      expect(chainA.stepArgs.publish.commandArgs.createArgs.title).toBe(
        cmdA.commandArgs.createArgs.title,
      );
      expect(chainB.stepArgs.publish.commandArgs.createArgs.title).toBe(
        cmdB.commandArgs.createArgs.title,
      );

      // 축 5/4/2~3/1 — inputs·modelId·marker·searchArgv·issueNumber·run-identity 는 동일
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

  describe("activities·run 변별성(branch — 같은 results, 다른 activities/run → command-args title 의 run-종속 변별·activities 무관)", () => {
    it("(m) 동일 results·동일 N 고정 + (a) activities_A vs activities_B → 두 chain 의 commandArgs.{create,update}Args.title 동일(title 은 run 종속, activities 무관)·inputs 변별, (b) runPlan_A{model-x,run_A} vs runPlan_B{model-y,run_B} → command-args title 의 run token 부분 변별(createArgs.title.includes(dateToken@gitSha) 각 run 으로 다름) 이나 두 chain 모두 각 (results, run) 재유도와 byte-identical — modelId·marker·outcomeReport.{gitSha,dateToken} 도 변별", () => {
      const results = defaultResults();
      const firstUsername =
        buildRealDataE2eSeed()[0].serviceIdentities[0].externalId;
      const activitiesA: GithubActivity[] = [
        syntheticActivity(firstUsername, "command-args-title-Ac1", "commit"),
        syntheticActivity(firstUsername, "command-args-title-Ap1", "pr"),
      ];
      const activitiesB: GithubActivity[] = [
        syntheticActivity(firstUsername, "command-args-title-Bc2", "commit"),
        syntheticActivity(firstUsername, "command-args-title-Bp2", "pr"),
        syntheticActivity(firstUsername, "command-args-title-Bi2", "issue"),
      ];

      // (a) 다른 activities, 같은 runPlan·results → command-args title 동일(run 종속), inputs 변별.
      const runPlan = buildRunPlan();
      const chainAa = runChain([7, 13], runPlan, activitiesA, results);
      const chainAb = runChain([7, 13], runPlan, activitiesB, results);
      // command-args title 두 경로는 run 종속 — activities 변경에 불변.
      expect(chainAa.stepArgs.publish.commandArgs.createArgs.title).toBe(
        chainAb.stepArgs.publish.commandArgs.createArgs.title,
      );
      expect(chainAa.stepArgs.publish.commandArgs.updateArgs.title).toBe(
        chainAb.stepArgs.publish.commandArgs.updateArgs.title,
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

      // (b) 다른 runPlan(modelId+run), 같은 activities·results → command-args title 의 run token
      // 부분 변별, 각 chain 은 각 (results, run) 재유도와 byte-identical. title 은 run 종속이므로
      // run 이 다르면 title 도 다름.
      const activities = defaultActivities();
      const runPlanX = buildRunPlan("model-x", "abc1234", "2026-06-21");
      const runPlanY = buildRunPlan("model-y", "def5678", "2026-06-29");
      const chainBx = runChain([7, 13], runPlanX, activities, results);
      const chainBy = runChain([7, 13], runPlanY, activities, results);
      // 각 chain 의 command-args title 두 경로는 각 (results, run) 재유도와 byte-identical.
      const cmdX = buildRealDataResultIssueCommandPlan(results, runPlanX.run);
      const cmdY = buildRealDataResultIssueCommandPlan(results, runPlanY.run);
      expect(chainBx.stepArgs.publish.commandArgs.createArgs.title).toBe(
        cmdX.commandArgs.createArgs.title,
      );
      expect(chainBx.stepArgs.publish.commandArgs.updateArgs.title).toBe(
        cmdX.commandArgs.updateArgs.title,
      );
      expect(chainBy.stepArgs.publish.commandArgs.createArgs.title).toBe(
        cmdY.commandArgs.createArgs.title,
      );
      expect(chainBy.stepArgs.publish.commandArgs.updateArgs.title).toBe(
        cmdY.commandArgs.updateArgs.title,
      );
      // command-args title 의 run-종속 부분(run token) 변별.
      expect(chainBx.stepArgs.publish.commandArgs.createArgs.title).not.toBe(
        chainBy.stepArgs.publish.commandArgs.createArgs.title,
      );
      expect(
        chainBx.stepArgs.publish.commandArgs.createArgs.title.includes(
          expectedToken(runPlanX.run),
        ),
      ).toBe(true);
      expect(
        chainBy.stepArgs.publish.commandArgs.createArgs.title.includes(
          expectedToken(runPlanY.run),
        ),
      ).toBe(true);
      // summary 집계 본문은 results 종속(run·modelId 무관) → 두 chain 동일.
      expect(chainBx.stepArgs.publish.report.summary).toEqual(
        chainBy.stepArgs.publish.report.summary,
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
    });
  });

  describe("create 분기 격리(branch — 검색 미스 → create, command-args title·body·descriptor·summary·inputs·modelId·searchArgv·post 무관)", () => {
    it("(n) 빈 hit search stdout('[]') → resolve.action 이 create 분기(action.update 부재) — stepArgs.publish.commandArgs.{create,update}Args.title(= descriptor.title 와 동일) / {create,update}Args.body(= descriptor.body 와 동일) / report.descriptor.{title,body} / report.summary / evaluation.inputs / callArgs[].options.modelId / searchArgv --match marker 는 create/update 두 분기 모두 동일(검색 결과가 command-args title·body·descriptor·summary·inputs·modelId·검색 인자 벡터를 바꾸지 0 — command-args 는 검색 전에 이미 합성됨). 특히 resolve 가 create/update 어느 쪽을 택하든 createArgs.title·updateArgs.title 둘 다 동일한 단일-source 식별 제목(멱등성 핵심)", () => {
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

      // command-args title·body 두 경로(= descriptor 와 동일) / descriptor / summary / inputs /
      // modelId / searchArgv --match marker 는 검색 결과(create/update)와 무관.
      const cmdPlan = buildRealDataResultIssueCommandPlan(results, runPlan.run);
      // 멱등성 핵심 — create/update 어느 분기든 두 title 이 같은 단일-source descriptor.title.
      expect(stepArgs.publish.commandArgs.createArgs.title).toBe(
        stepArgs.publish.report.descriptor.title,
      );
      expect(stepArgs.publish.commandArgs.updateArgs.title).toBe(
        stepArgs.publish.report.descriptor.title,
      );
      expect(stepArgs.publish.commandArgs.createArgs.title).toBe(
        cmdPlan.commandArgs.createArgs.title,
      );
      expect(stepArgs.publish.commandArgs.updateArgs.title).toBe(
        cmdPlan.commandArgs.updateArgs.title,
      );
      // body 두 경로도 동일(검색 무관).
      expect(stepArgs.publish.commandArgs.createArgs.body).toBe(
        stepArgs.publish.report.descriptor.body,
      );
      expect(stepArgs.publish.commandArgs.updateArgs.body).toBe(
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
    it("(o) runPlan.pipeline.modelId 빈('') → run-plan 합성 단계(buildRealDataE2eRunPlan) 측 pipeline modelId guard throw(평가 leg 비식별 — modelId 정책 미결정이면 run plan 산출 차단)", () => {
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

    it("(p) runPlan.run.gitSha 빈('') → aggregator측 publish 위임 descriptor assertNonBlank('gitSha') throw(descriptor.title/body·command-args title/body 합성 도달 전 차단). modelId·activities·results 정상이어도 차단", () => {
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

    // command-args-title 축 negative — descriptor.title 은 run-독립 상수 prefix(ISSUE_TITLE_PREFIX
    // "실 평가 e2e 결과") + run token(`${dateToken}@${gitSha}`)으로 **항상 non-blank 로 합성**
    // 된다(descriptor 합성 line 127: `${PREFIX} ${token}`). 따라서 command-args 빌더의 식별자
    // guard `assertNonBlank(descriptor.title, "title")`(command-args.ts 123행)는 정상 입력으로는
    // 트리거 불가하다 — title 이 blank 가 되려면 prefix 자체가 비어야 하나 상수라 불가. 대신
    // title 의 run-종속 부분(token)을 결정하는 run.gitSha/dateToken 이 빈/공백이면 그것이
    // descriptor 합성 단계의 title/marker 도달 **전**에 상위 run-token guard(assertNonBlank
    // ('gitSha'/'dateToken'))로 차단된다 — 위 (p)/(p') negative 가 이를 cover. 즉 title-축
    // boundary 는 run-token guard 가 상위에서 대칭으로 막는다. 본 it 은 그 대칭을 명시:
    //   - 정상 run → title 항상 non-blank(trim().length > 0)·run token 운반.
    //   - blank run.gitSha → command-args title 합성 도달 전 throw(위 (p) 재확인이 아니라
    //     title-축 관점에서 "title guard 입력 트리거 불가 — run-token guard 상위 차단" 명시).
    it("(t) command-args-title 축 negative 대체 — descriptor.title 은 run-독립 prefix + run token 으로 항상 non-blank 합성이라 command-args title guard 가 입력으로 트리거 불가. 대신 run.gitSha 빈/공백이 title/marker 합성 도달 전 상위 run-token guard 로 차단됨(title-축 boundary 대칭)을 명시 — 정상 run → title non-blank·token 운반, blank gitSha → aggregator publish 위임 throw(title 합성 미도달)", () => {
      // 정상 run → title 항상 non-blank, run token 운반(빈 입력으로 title guard 트리거 불가).
      const runPlan = buildRunPlan();
      const stepArgs = buildRealDataE2eStepArgs(
        runPlan,
        defaultActivities(),
        defaultResults(),
      );
      expect(stepArgs.publish.commandArgs.createArgs.title.trim().length).toBe(
        stepArgs.publish.commandArgs.createArgs.title.length,
      );
      expect(
        stepArgs.publish.commandArgs.createArgs.title.trim().length,
      ).toBeGreaterThan(0);
      expect(stepArgs.publish.commandArgs.createArgs.title).toContain(
        expectedToken(runPlan.run),
      );

      // blank gitSha → title/marker 합성 도달 전 상위 run-token guard 로 차단(title guard 미도달).
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

  describe("결정론·무공유·no-mutation — chain 두 번 호출 + 입력 불변 + 무공유", () => {
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

    it("(v) no-mutation — 입력 runPlan(특히 aggregator publish leg 와 직접 호출 command-plan 재유도가 같은 results·runPlan 공유 읽기)·activities·results chain 호출 후 deep-equal(원본 불변)", () => {
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

    it("(w) 무공유 — 직접 호출 buildRealDataResultIssueCommandPlan(results, runPlan.run).commandArgs 와 stepArgs.publish.commandArgs 는 deep-equal 이되 referential 분리(not.toBe — 무공유). createArgs.title·updateArgs.title 는 string 이라 === 동치이나 commandArgs/createArgs 객체는 referential 분리로 무공유 확인. 보조: createArgs.labels 도 deep-equal 이되 referential 분리(새 배열)", () => {
      const runPlan = buildRunPlan();
      const results = defaultResults();
      const { stepArgs, outcomeReport } = runChain(
        [7, 13],
        runPlan,
        defaultActivities(),
        results,
      );

      // commandArgs 재유도와 deep-equal 이지만 referential 분리(매 호출 새 객체).
      const directCommandArgs = buildRealDataResultIssueCommandPlan(
        results,
        runPlan.run,
      ).commandArgs;
      expect(stepArgs.publish.commandArgs).toEqual(directCommandArgs);
      expect(stepArgs.publish.commandArgs).not.toBe(directCommandArgs);
      expect(stepArgs.publish.commandArgs.createArgs).not.toBe(
        directCommandArgs.createArgs,
      );
      expect(stepArgs.publish.commandArgs.updateArgs).not.toBe(
        directCommandArgs.updateArgs,
      );
      // createArgs.title·updateArgs.title 는 string 이라 === 동치(불변 primitive — 무공유 무관).
      expect(stepArgs.publish.commandArgs.createArgs.title).toBe(
        directCommandArgs.createArgs.title,
      );
      expect(stepArgs.publish.commandArgs.updateArgs.title).toBe(
        directCommandArgs.updateArgs.title,
      );
      // createArgs.labels deep-equal 이되 referential 분리(새 배열, 무공유).
      expect(stepArgs.publish.commandArgs.createArgs.labels).toEqual(
        directCommandArgs.createArgs.labels,
      );
      expect(stepArgs.publish.commandArgs.createArgs.labels).not.toBe(
        directCommandArgs.createArgs.labels,
      );

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
    it("(x) stepArgs.publish.commandArgs.{createArgs.title,updateArgs.title,createArgs.body,updateArgs.body,searchQuery} · report.descriptor.{title,marker,body} · report.summary(직렬화) · evaluation.inputs(직렬화) · callArgs(직렬화) · searchArgv(각 원소) · resolvePlan.argv · outcomeReport.{url,summaryLine} 어디에도 token/secret/PAT/--auth 어휘 미등장(특히 실 gh issue 명령 인자로 나가는 createArgs.title·updateArgs.title 명시)", () => {
      const { stepArgs, resolvePlan, outcomeReport } = runChain([7, 13]);

      const surfaces: string[] = [
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
      // createArgs.title·updateArgs.title(실 gh issue 명령 인자로 나가는 식별 제목)에 credential 어휘 미등장 명시.
      expect(stepArgs.publish.commandArgs.createArgs.title).not.toMatch(
        credentialPattern,
      );
      expect(stepArgs.publish.commandArgs.updateArgs.title).not.toMatch(
        credentialPattern,
      );
      // outcome url 은 issue 경로만 — commit/PR narrative 어휘 미포함.
      expect(outcomeReport.url).not.toMatch(/commit|pull request/i);
    });
  });
});
