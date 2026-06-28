// realdata-e2e-aggregator-evaluation-inputs-modelid-searchargv-resolve-run-plan-threading-6way-single-source-closure-assembly.smoke-spec.ts
// — 실 평가 e2e step④ aggregator evaluation-inputs 합류 6-way single-source closure:
// pre-실행 aggregator `buildRealDataE2eStepArgs(runPlan, activities, results)` 의
// evaluation leg 의 **inputs 축**(stepArgs.evaluation.inputs == 동일 activities 로
// 직접 호출한 `buildRealDataEvaluationInputs(activities)` byte-identical, 그리고
// `callArgs[i].input === inputs[i]` reference 페어링)을 **6번째 축**으로 합류시켜,
// 단일 검증 source `(runPlan, activities)` 가 다음 6 축의 동시 source 임을 한 chain
// 으로 박제한다:
//   (축 6, 본 task 의 새 표면) **evaluation.inputs activities-재유도 byte-identical
//      + callArgs[i].input === inputs[i] reference 페어링** — 평가 입력 식별자 set 이
//      단일 `activities` source 로부터 재유도되고, callArgs 페어링이 1:1 보존.
//   (축 5) `.evaluation` leg modelId — `callArgs[i].options.modelId ===
//      runPlan.pipeline.modelId`(ADR-0048 단일 modelId source).
//   (축 1~3) `.publish` leg 내부 marker 3-축 — `report.descriptor.marker /
//      commandArgs.searchQuery / searchArgv(--match 다음 토큰)` 세 marker 축 동일.
//   (축 4) resolve issueNumber — marker 로 검색 hit 1+ → `action.update.issueNumber = N`.
//   (축 5b) post run-identity — `buildRealDataResultOutcomeStepArgs(runPlan, execStdout)`
//      → 동일 runPlan.run 의 {gitSha, dateToken} 전파.
//
// 이 6-way 가 **동일 단일 검증 source `(runPlan, activities)`** single-source 에서
// 한 chain 동시-호출로 byte-identical 수렴함을 박제하는 첫 aggregator-evaluation-inputs
// 합류 6-way single-source closure non-gated build-time smoke (T-0775 박제, PLAN.md
// 109행 🟢 실 평가 e2e step④).
//
// 본 spec 의 존재 이유 — public CI gap 해소(evaluation leg 의 inputs 재유도 축을
// 6번째 축으로 합류):
//   - PLAN 109행 step④(결과 이슈 박제)의 멱등 search-or-update 의 build-time 순수 layer 는
//     검증된 단일 run plan(`buildRealDataE2eRunPlan(seeds, modelId, run)` → `{pipeline,
//     run}`, T-0597)을 pre-실행 aggregator(`buildRealDataE2eStepArgs(runPlan, activities,
//     results)` → `{evaluation, publish}`, T-0601)에 통째로 넘긴다. 이 aggregator 의
//     `.evaluation` leg(`RealDataEvaluationPlan {inputs, callArgs}`)는 **두 활동-side
//     축**을 동시에 운반한다:
//       (축 6, 새 표면) **inputs** — `stepArgs.evaluation.inputs` 는 수집 산출
//              `activities: Activity[]` 를 `buildRealDataEvaluationInputs(activities)`
//              (T-0578, production `mapActivityToEvaluationInput` 위임)로 변환한
//              `EvaluationInput[]` 와 **byte-identical** 이고, 각 `callArgs[i].input ===
//              inputs[i]`(reference 동일) 페어링이 보장된다. 즉 평가 입력 식별자 set 이
//              단일 검증 `activities` source 로부터 재유도된다.
//       (축 5) **modelId** — 각 `stepArgs.evaluation.callArgs[i].options.modelId` 가
//              `runPlan.pipeline.modelId` 와 같음(ADR-0048 단일 modelId source).
//   - 직전 sibling 들은 이 inputs 축을 closure 에 합류시키지 않았다:
//       T-0774 (aggregator dual-leg 5-way) — evaluation leg 의 modelId 축 + publish leg
//         4 축을 단일 runPlan single-source 로 수렴 박제. 그러나 evaluation leg 의 inputs
//         축은 `Array.isArray(stepArgs.evaluation.inputs)` 존재만 단언하고
//         `callArgs[i].input === inputs[i]` 페어링·`buildRealDataEvaluationInputs(activities)`
//         재유도와의 byte-identical 정합을 closure 에 묶지 않았다(T-0774 Out of Scope
//         line 100 명시 제외).
//       T-0752 (step-args dual-leg convergence) — aggregator 의 두 leg 가 단일 runPlan
//         source 로 수렴함을 박제했으나 **resolve · post 미합류**.
//   - 본 spec 은 그 빈 자리를 채워 **단일 검증 source `(runPlan, activities)` 가 aggregator
//     의 evaluation leg 의 inputs(activities 재유도) + modelId(runPlan.pipeline) 양 축과
//     publish leg(marker/searchArgv/run-identity) 의 source 임을 resolve+post 까지 묶은
//     한 chain 으로** 박제한다. 단일 source `(runPlan, activities, results, search-stdout,
//     exec-stdout)` 로부터:
//       (1) evaluation-leg inputs 재유도 + 페어링(축 6) — `stepArgs = buildRealDataE2eStepArgs(
//           runPlan, activities, results)` → `stepArgs.evaluation.inputs` 가 동일 `activities`
//           로 직접 호출한 `buildRealDataEvaluationInputs(activities)` 와 byte-identical
//           deep-equal, 그리고 모든 `stepArgs.evaluation.callArgs[i].input ===
//           stepArgs.evaluation.inputs[i]`(reference 동일).
//       (2) evaluation-leg modelId thread(축 5) — 모든 `stepArgs.evaluation.callArgs[i]
//           .options.modelId === runPlan.pipeline.modelId`.
//       (3) publish-leg marker 3-축 일치(축 1~3) — `descriptor.marker === commandArgs
//           .searchQuery === extractSearchMarker(searchArgv)`.
//       (4) resolve issueNumber(축 4) — `resolvePlan = resolveRealDataResultIssueGhCommandPlan(
//           searchStdout, stepArgs.publish.commandArgs)` → `action.update.issueNumber = N`.
//       (5) post run-identity(축 5b) — `outcomeReport = buildRealDataResultOutcomeStepArgs(
//           runPlan, execStdout)` → 동일 runPlan.run 의 {gitSha, dateToken} 전파.
//   - 이 6-way 가 동일 단일 검증 source `(runPlan, activities)` single-source 로 수렴함이
//     search-or-update 멱등성(REQ-009)·raw 미보유 평가 입력 정합(REQ-032)·결과 리포트
//     재실행 정합(REQ-037)의 aggregator-level "평가 입력 식별(inputs)과 평가 정책(modelId)과
//     publish 식별(marker/searchArgv/run-identity)이 같은 검증 source 에서 나옴" 의 종단
//     닫음이다 — 재전달 0 로 drift 0.
//   - live leg(실 prisma·실 collectForPerson·실 github.com fetch·실 LLM scoring·실 gh CLI
//     실행·DB·LAN gate)는 복제하지 않고, synthetic runPlan(buildRealDataE2eRunPlan 합성) +
//     activities/results literal + search-stdout/exec-stdout literal 을 컴포저들에 직접 공급해
//     live leg 를 우회한다(조립 surface 만 검증). 따라서 본 spec 은:
//
//      🔥 실 gh 호출 0 — gh search / list / create / edit / execFile('gh', argv) 미실행.
//         synthetic searchStdout / execStdout / runPlan / activities / results literal 직접 공급.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 LLM scoreUnit 호출 0 / 실 DB 접근 0 / 실 jest spawn 0 — 6-way 수렴 조립만.
//         evaluation.callArgs 는 inputs 페어링 + modelId 운반만 검증(실 scoreUnit 호출 0).
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 step-args aggregator / evaluation-inputs / outcome-step-args
//         / run-plan / gh-command-plan / seed-fixture 컴포저 import 재사용만(가드/helper 신설 0).
//         `extractSearchMarker` 는 spec 로컬 함수(T-0774/T-0773/T-0729 패턴 차용).
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0775):
//   - src 변경 0(src/, prisma/, package.json, CI workflow, 환경 변수 추가 등 모두 금지). test-only.
//   - 실 gh CLI 호출 / `execFile('gh', searchArgv)` 실행 / 실 LLM scoreUnit 호출 / 실 issue
//     검색·박제(step④ live wiring — credential gate, deferred). 본 task 는 in-memory 합성
//     search-stdout / exec-stdout 만. evaluation.inputs 는 **식별자 운반만** 검증(실 scoreUnit
//     호출 0).
//   - aggregator dual-leg(evaluation modelId + publish searchArgv) 5-way 자체 재단언(T-0774
//     cover). 본 task 는 evaluation leg inputs 재유도(`buildRealDataEvaluationInputs(activities)`
//     byte-identical) + `callArgs[i].input===inputs[i]` 페어링을 6번째 축으로 합류시킨 부분만.
//   - aggregator dual-leg ↔ 직접 호출(buildRealDataEvaluationStepArgs·
//     buildRealDataResultPublishStepArgs) byte-identical 자체 재단언(T-0752 cover). 본 task 는
//     inputs 재유도 + resolve+post 합류 6-way closure 만.
//   - `mapActivityToEvaluationInput` 의 contributionKind 정규화·unitId 합성·raw 미보유 매핑
//     로직 자체 재단언(evaluation-inputs helper spec / production mapper spec cover). 본
//     task 는 aggregator 산출 inputs 가 단일 source `activities` 재유도와 byte-identical 함만.
//   - 난이도별 modelId routing(R-97 deferred) 검증 금지 — 단일 modelId 동형 적용(ADR-0048)만.
//   - searchArgv 의 전체 형식(gh issue list 플래그 순서·--repo·--state 등) 재단언(search-gh-argv
//     가드 / T-0729 cover). 본 task 는 `--match` 위치의 marker 토큰만.
//   - commandArgs createArgs/updateArgs 정합·labels 재단언(command-args 가드 cover).
//   - resolve argv 합성(gh issue create/edit argv 형식) 재단언(gh-command-plan 가드 cover).
//     본 task 는 `action.update.issueNumber` 해소 결과만.
//   - from-output 단독 5필드(url trim·summaryLine 합성) 재유도 재단언(T-0747 cover). 본 task 는
//     6-way 수렴만.
//   - runPlan pipeline 측 collectCallArgs shape·guard 재단언(run-plan / pipeline-plan helper
//     spec cover).
//   - DB 의존 / live-LLM·실 fetch·실 collectForPerson 0.
//   - 새 helper 모듈 신설 / 기존 helper 수정 — test-only(신규 smoke spec 1 파일).
import type { GithubActivity } from "../../src/assessment-collection/domain/activity";
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";
import { buildRealDataEvaluationInputs } from "../helpers/realdata-e2e-evaluation-inputs";
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
  "cfg-realdata-e2e-aggregator-evaluation-inputs-modelid-searchargv-resolve-threading-smoke";

const INSTANCE_KEY = "github.com";

// search argv 안 marker 추출 헬퍼 — 빌더 canonical shape (["search","issues","--match",
// "body",<marker>,"--json","number,title,body","--limit","30"]) 에서 marker 는 `--match
// body` 직후다. 위치 매직 넘버 대신 `--match` 기준 상대 추출(round-trip drift 강건). T-0774/
// T-0773/T-0729 sibling 헬퍼 패턴 mirror.
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
  externalId = "realdata-e2e-aggregator-evaluation-inputs-c1",
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
    syntheticActivity(firstUsername, "aggregator-eval-inputs-c1", "commit"),
    syntheticActivity(firstUsername, "aggregator-eval-inputs-p1", "pr"),
    syntheticActivity(firstUsername, "aggregator-eval-inputs-i1", "issue"),
  ];
}

// synthetic EvaluationResult 1 건 — aggregator 의 publish leg 입력.
function syntheticResult(
  unitId: string,
  difficulty: EvaluationResult["difficulty"],
  contribution: EvaluationResult["contribution"],
  volume: number,
): EvaluationResult {
  return {
    unitId,
    narrative:
      "synthetic evaluation narrative — aggregator evaluation-inputs+modelId+searchArgv ↔ resolve ↔ outcome-step-args run-plan-threading 6-way closure smoke fixture",
    difficulty,
    contribution,
    volume,
  };
}

// 유효 results fixture — aggregator 의 publish leg 입력(EvaluationResult[]).
function defaultResults(): EvaluationResult[] {
  return [
    syntheticResult("github:github.com:c1", "easy", "low", 3),
    syntheticResult("github:github.com:c2", "medium", "high", 5),
    syntheticResult("github:github.com:c3", "hard", "medium", 2),
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
// aggregator 가 runPlan 을 통째로 evaluation leg(modelId thread) + publish leg(run thread)에
// 동시 thread 한다. update 분기를 강제하며, resolver 가 picked 한 N 을 execStdout 에 흘려
// post 가 동일 N 을 산출하게 한다.
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
  stepArgs: ReturnType<typeof buildRealDataE2eStepArgs>;
  resolvePlan: ReturnType<typeof resolveRealDataResultIssueGhCommandPlan>;
  outcomeReport: ReturnType<typeof buildRealDataResultOutcomeStepArgs>;
} {
  // stage 1(pre boundary, aggregator dual-leg threaded) — stepArgs: {evaluation, publish}.
  // 동일 runPlan 한 객체를 넘김 — aggregator 가 evaluation leg 에 runPlan.pipeline.modelId,
  // publish leg 에 runPlan.run 을 동시 thread(재전달 0). 동일 activities 가 evaluation.inputs
  // 재유도 source 가 된다(축 6, 새 표면).
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
    stepArgs,
    resolvePlan,
    outcomeReport,
  };
}

describe("Smoke(non-gated): 실 평가 e2e step④ aggregator evaluation-inputs 합류 6-way single-source closure buildRealDataE2eStepArgs(.evaluation {inputs(=buildRealDataEvaluationInputs(activities) byte-identical, callArgs[i].input === inputs[i] reference), callArgs[].options.modelId} + .publish {descriptor.marker, commandArgs.searchQuery, searchArgv --match 토큰})↔resolve↔buildRealDataResultOutcomeStepArgs 동일 (runPlan, activities) 한 chain 동시-호출(inputs 재유도 + modelId + marker 3-축 + issueNumber + run-identity 동시 수렴, 재전달 0) live-gh/live-LLM 0 검증", () => {
  describe("happy path — aggregator 6-way chain 합성(다섯 산출물 모두 정상)", () => {
    it("(a) 유효 runPlan + activities + results + searchStdout + execStdout → stepArgs.evaluation({inputs,callArgs} 비어있지 않음·Array.isArray(inputs)·Array.isArray(callArgs)) / stepArgs.publish({report,commandArgs,searchArgv} 비어있지 않음·report.descriptor.marker 존재) / resolvePlan(update {action, issueNumber} + argv) / outcomeReport(5필드) 다섯 산출물 모두 정상", () => {
      const { stepArgs, resolvePlan, outcomeReport } = runChain([7, 13]);

      // stage 1a — stepArgs.evaluation({inputs, callArgs} 비어있지 않음).
      expect(Array.isArray(stepArgs.evaluation.inputs)).toBe(true);
      expect(stepArgs.evaluation.inputs.length).toBeGreaterThan(0);
      expect(Array.isArray(stepArgs.evaluation.callArgs)).toBe(true);
      expect(stepArgs.evaluation.callArgs.length).toBeGreaterThan(0);
      // 첫 input 의 EvaluationInput 정합(unitId/contributionKind/sourceType 존재).
      expect(typeof stepArgs.evaluation.inputs[0].unitId).toBe("string");
      expect(stepArgs.evaluation.inputs[0].unitId.length).toBeGreaterThan(0);
      expect(typeof stepArgs.evaluation.inputs[0].contributionKind).toBe(
        "string",
      );
      // callArgs[0].options.modelId reachable(축 5 reachable).
      expect(typeof stepArgs.evaluation.callArgs[0].options.modelId).toBe(
        "string",
      );
      expect(
        stepArgs.evaluation.callArgs[0].options.modelId.length,
      ).toBeGreaterThan(0);

      // stage 1b — stepArgs.publish({report, commandArgs, searchArgv} 비어있지 않음).
      expect(typeof stepArgs.publish.report).toBe("object");
      expect(typeof stepArgs.publish.commandArgs).toBe("object");
      expect(Array.isArray(stepArgs.publish.searchArgv)).toBe(true);
      expect(stepArgs.publish.searchArgv.length).toBeGreaterThan(0);
      expect(stepArgs.publish.searchArgv).toContain("--match");
      expect(
        extractSearchMarker(stepArgs.publish.searchArgv).length,
      ).toBeGreaterThan(0);
      expect(typeof stepArgs.publish.report.descriptor.marker).toBe("string");
      expect(stepArgs.publish.report.descriptor.marker.length).toBeGreaterThan(
        0,
      );
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
      expect(Array.isArray(resolvePlan.argv)).toBe(true);
      expect(resolvePlan.argv[0]).toBe("issue");
      expect(resolvePlan.argv[1]).toBe("edit");

      // stage 3 — outcome step-args report(5필드).
      expect(typeof outcomeReport.issueNumber).toBe("number");
      expect(outcomeReport.issueNumber).toBeGreaterThan(0);
      expect(typeof outcomeReport.url).toBe("string");
      expect(outcomeReport.url.length).toBeGreaterThan(0);
      expect(outcomeReport.gitSha).toBe("abc1234");
      expect(outcomeReport.dateToken).toBe("2026-06-28");
      expect(typeof outcomeReport.summaryLine).toBe("string");
      expect(outcomeReport.summaryLine.length).toBeGreaterThan(0);
    });
  });

  describe("evaluation-leg inputs 재유도 byte-identical 수렴(branch — 핵심 불변식 1, 본 task 의 새 표면 — 축 6)", () => {
    it("(b) stepArgs.evaluation.inputs deep-equal buildRealDataEvaluationInputs(activities) — aggregator 의 evaluation leg inputs 가 단일 activities source 로부터 재유도됨(평가 입력 식별자 set 이 동일 검증 source 산물)", () => {
      const runPlan = buildRunPlan();
      const activities = defaultActivities();
      const { stepArgs } = runChain([7, 13], runPlan, activities);

      // 동일 activities 로 직접 호출한 buildRealDataEvaluationInputs(activities) 와
      // byte-identical deep-equal — aggregator 가 inputs 를 같은 source 로 재유도.
      const directInputs = buildRealDataEvaluationInputs(activities);
      expect(stepArgs.evaluation.inputs).toEqual(directInputs);
      // 길이도 동일(activities.length 와 같음 — production 매퍼 throw 0).
      expect(stepArgs.evaluation.inputs).toHaveLength(activities.length);
      // 각 unitId 가 `<sourceType>:<instanceKey>:<externalId>` 형식으로 합성됨(activities
      // 분포 변별 — c1/p1/i1 가 모두 다른 unitId 로 reflect 되어 inputs 가 activities 의
      // 종속 변량임을 확인).
      const unitIds = stepArgs.evaluation.inputs.map((i) => i.unitId);
      expect(new Set(unitIds).size).toBe(unitIds.length);
      activities.forEach((a, i) => {
        expect(stepArgs.evaluation.inputs[i].unitId).toBe(
          `${a.sourceType}:${a.instanceKey}:${a.externalId}`,
        );
      });
    });
  });

  describe("callArgs[i].input === inputs[i] reference 페어링(branch — 핵심 불변식 2, 본 task 의 새 표면 — 축 6)", () => {
    it("(c) 모든 stepArgs.evaluation.callArgs[i].input === stepArgs.evaluation.inputs[i] referential 동일, callArgs.length === inputs.length — inputs ↔ callArgs.input 페어링이 1:1 reference 보존", () => {
      const { stepArgs } = runChain([7, 13]);

      // 길이 일치(빈 → vacuous 페어링 방지).
      expect(stepArgs.evaluation.callArgs.length).toBeGreaterThan(0);
      expect(stepArgs.evaluation.callArgs.length).toBe(
        stepArgs.evaluation.inputs.length,
      );
      // 모든 원소가 reference 동일(deep-equal 이 아닌 referential identity).
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
      // runPlan.pipeline.modelId 자체가 합성에 넣은 MODEL_ID(seed-side source 보존).
      expect(runPlan.pipeline.modelId).toBe(MODEL_ID);
    });
  });

  describe("publish-leg 내부 marker 3-축 일치(branch — 핵심 불변식 4, 축 1~3)", () => {
    it("(e) extractSearchMarker(stepArgs.publish.searchArgv) === stepArgs.publish.report.descriptor.marker === stepArgs.publish.commandArgs.searchQuery — 세 내부 marker 축이 byte-identical", () => {
      const { stepArgs } = runChain([7, 13]);

      const descriptorMarker = stepArgs.publish.report.descriptor.marker;
      expect(stepArgs.publish.commandArgs.searchQuery).toBe(descriptorMarker);
      expect(extractSearchMarker(stepArgs.publish.searchArgv)).toBe(
        descriptorMarker,
      );
      // searchArgv 안에 marker 가 정확히 1회 등장(중복 0 — 단일 원소 thread).
      expect(
        stepArgs.publish.searchArgv.filter(
          (token) => token === descriptorMarker,
        ),
      ).toHaveLength(1);
    });
  });

  describe("marker → resolve issueNumber + post run-identity 수렴(branch — 핵심 불변식 5, 축 4 + 축 5b)", () => {
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

      // issueNumber 수렴.
      expect(resolvePlan.action.issueNumber).toBe(N);
      expect(outcomeReport.issueNumber).toBe(N);
      expect(outcomeReport.url).toContain(`/issues/${N}`);
      expect(outcomeReport.issueNumber).toBe(resolvePlan.action.issueNumber);

      // run-identity 전파(marker run token == outcome run-identity).
      const token = expectedToken(runPlan.run);
      expect(stepArgs.publish.report.descriptor.marker).toContain(token);
      expect(outcomeReport.gitSha).toBe(runPlan.run.gitSha);
      expect(outcomeReport.dateToken).toBe(runPlan.run.dateToken);
      expect(outcomeReport.summaryLine).toContain(runPlan.run.gitSha);
      expect(outcomeReport.summaryLine).toContain(runPlan.run.dateToken);
    });
  });

  describe("6-way 단일-source 묶음 단언(branch — closure 종단, 본 task 의 종단 박제)", () => {
    it("(g) evaluation.inputs == buildRealDataEvaluationInputs(activities), callArgs[].input === inputs[i], callArgs[].options.modelId == runPlan.pipeline.modelId, searchArgv --match 토큰 == descriptor.marker == commandArgs.searchQuery, 그 marker 로 resolve 가 찾은 N == post 가 해석한 N, 그 marker 의 run token == post 가 전파한 {gitSha,dateToken} 가 단일 (runPlan, activities) single-source 에서 6-way 동시 성립", () => {
      const N = 7;
      const runPlan = buildRunPlan();
      const activities = defaultActivities();
      const { stepArgs, resolvePlan, outcomeReport } = runChain(
        [N, 13],
        runPlan,
        activities,
      );
      if (resolvePlan.action.action !== "update") {
        throw new Error("update action 기대");
      }

      const marker = stepArgs.publish.report.descriptor.marker;
      const token = expectedToken(runPlan.run);

      // axis 6(새 표면) — evaluation.inputs deep-equal direct 재유도 + callArgs.input
      // reference 페어링.
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
      // axis 1~3 — marker 3-축 byte-identical.
      expect(stepArgs.publish.commandArgs.searchQuery).toBe(marker);
      expect(extractSearchMarker(stepArgs.publish.searchArgv)).toBe(marker);
      // axis 4 — 그 marker 로 resolve 가 찾은 N == post 가 해석한 N.
      expect(resolvePlan.action.issueNumber).toBe(N);
      expect(outcomeReport.issueNumber).toBe(N);
      // axis 5b — 그 marker 의 run token == post 가 전파한 {gitSha,dateToken}.
      expect(marker).toContain(token);
      expect(outcomeReport.gitSha).toBe(runPlan.run.gitSha);
      expect(outcomeReport.dateToken).toBe(runPlan.run.dateToken);
      // 6-way 동시 closure — 단일 (runPlan, activities) single-source 에서 여섯 축이
      // 한 chain 으로 묶임.
      expect(`${runPlan.run.dateToken}@${runPlan.run.gitSha}`).toBe(token);
    });
  });

  describe("inputs 축 변별성(branch — activities 가 inputs 를 결정, modelId·run 은 독립 축)", () => {
    it("(h) 두 chain — activities_A(c1/p1) vs activities_B(c2/p2/i2) 로 같은 runPlan·N 으로 chain 호출 → A.inputs == buildRealDataEvaluationInputs(activities_A), B.inputs == (activities_B) 각각 byte-identical, callArgs.length 도 활동 길이 반영 → 그러나 modelId / marker / searchArgv --match / resolve issueNumber / outcomeReport.{gitSha,dateToken} 는 두 chain 동일(activities 변경이 modelId·marker·run-identity·issueNumber 어느 축에도 누설 0)", () => {
      const runPlan = buildRunPlan();
      const firstUsername =
        buildRealDataE2eSeed()[0].serviceIdentities[0].externalId;
      const activitiesA: GithubActivity[] = [
        syntheticActivity(
          firstUsername,
          "aggregator-eval-inputs-Ac1",
          "commit",
        ),
        syntheticActivity(firstUsername, "aggregator-eval-inputs-Ap1", "pr"),
      ];
      const activitiesB: GithubActivity[] = [
        syntheticActivity(
          firstUsername,
          "aggregator-eval-inputs-Bc2",
          "commit",
        ),
        syntheticActivity(firstUsername, "aggregator-eval-inputs-Bp2", "pr"),
        syntheticActivity(firstUsername, "aggregator-eval-inputs-Bi2", "issue"),
      ];
      const chainA = runChain([7, 13], runPlan, activitiesA);
      const chainB = runChain([7, 13], runPlan, activitiesB);
      if (
        chainA.resolvePlan.action.action !== "update" ||
        chainB.resolvePlan.action.action !== "update"
      ) {
        throw new Error("update action 기대");
      }

      // 축 6 — inputs 가 activities 로부터 각각 재유도(서로 다른 set).
      expect(chainA.stepArgs.evaluation.inputs).toEqual(
        buildRealDataEvaluationInputs(activitiesA),
      );
      expect(chainB.stepArgs.evaluation.inputs).toEqual(
        buildRealDataEvaluationInputs(activitiesB),
      );
      expect(chainA.stepArgs.evaluation.inputs).toHaveLength(
        activitiesA.length,
      );
      expect(chainB.stepArgs.evaluation.inputs).toHaveLength(
        activitiesB.length,
      );
      // unitId set 변별(activities 가 다르면 inputs 도 다름).
      const unitIdsA = chainA.stepArgs.evaluation.inputs.map((i) => i.unitId);
      const unitIdsB = chainB.stepArgs.evaluation.inputs.map((i) => i.unitId);
      expect(unitIdsA).not.toEqual(unitIdsB);
      // callArgs.length 도 activities 길이 반영.
      expect(chainA.stepArgs.evaluation.callArgs.length).toBe(
        activitiesA.length,
      );
      expect(chainB.stepArgs.evaluation.callArgs.length).toBe(
        activitiesB.length,
      );

      // 축 5/1~3/4/5b — modelId·marker·searchArgv·issueNumber·run-identity 는 동일
      // (activities 변경 누설 0).
      expect(chainA.stepArgs.evaluation.callArgs[0].options.modelId).toBe(
        chainB.stepArgs.evaluation.callArgs[0].options.modelId,
      );
      expect(chainA.stepArgs.evaluation.callArgs[0].options.modelId).toBe(
        runPlan.pipeline.modelId,
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
      expect(chainA.outcomeReport.issueNumber).toBe(
        chainB.outcomeReport.issueNumber,
      );
      expect(chainA.outcomeReport.gitSha).toBe(chainB.outcomeReport.gitSha);
      expect(chainA.outcomeReport.dateToken).toBe(
        chainB.outcomeReport.dateToken,
      );
    });
  });

  describe("modelId·run 변별성(branch — 같은 activities, 다른 runPlan → inputs 불변·modelId/run-identity 변별)", () => {
    it("(i) 동일 activities·동일 N + runPlan_A{model-x,run_A} vs runPlan_B{model-y,run_B} → A.inputs == B.inputs(buildRealDataEvaluationInputs(activities) 가 modelId·run 무관) 이나 callArgs[].options.modelId 는 A='model-x'/B='model-y' 변별, descriptor.marker·searchArgv·outcomeReport.{gitSha,dateToken} 는 각 run token 변별 — modelId·run 변경이 inputs(=activities 종속)에 누설 0", () => {
      const activities = defaultActivities();
      const runPlanA = buildRunPlan("model-x", "abc1234", "2026-06-21");
      const runPlanB = buildRunPlan("model-y", "def5678", "2026-06-29");
      const chainA = runChain([7, 13], runPlanA, activities);
      const chainB = runChain([7, 13], runPlanB, activities);
      if (
        chainA.resolvePlan.action.action !== "update" ||
        chainB.resolvePlan.action.action !== "update"
      ) {
        throw new Error("update action 기대");
      }

      // 축 6 — inputs 는 activities 의 함수(modelId·run 무관) → 두 chain 동일.
      expect(chainA.stepArgs.evaluation.inputs).toEqual(
        chainB.stepArgs.evaluation.inputs,
      );
      expect(chainA.stepArgs.evaluation.inputs).toEqual(
        buildRealDataEvaluationInputs(activities),
      );
      expect(chainA.stepArgs.evaluation.inputs).toHaveLength(activities.length);

      // 축 5 — modelId 는 각 runPlan 의 pipeline.modelId 로 변별.
      chainA.stepArgs.evaluation.callArgs.forEach((c) => {
        expect(c.options.modelId).toBe("model-x");
      });
      chainB.stepArgs.evaluation.callArgs.forEach((c) => {
        expect(c.options.modelId).toBe("model-y");
      });
      expect(chainA.stepArgs.evaluation.callArgs[0].options.modelId).not.toBe(
        chainB.stepArgs.evaluation.callArgs[0].options.modelId,
      );

      // 축 1~3 / 5b — marker·searchArgv·outcomeReport.{gitSha,dateToken} 변별(run token).
      const markerA = chainA.stepArgs.publish.report.descriptor.marker;
      const markerB = chainB.stepArgs.publish.report.descriptor.marker;
      expect(markerA).not.toBe(markerB);
      expect(markerA).toContain(expectedToken(runPlanA.run));
      expect(markerB).toContain(expectedToken(runPlanB.run));
      expect(chainA.outcomeReport.gitSha).toBe(runPlanA.run.gitSha);
      expect(chainB.outcomeReport.gitSha).toBe(runPlanB.run.gitSha);
      expect(chainA.outcomeReport.dateToken).toBe(runPlanA.run.dateToken);
      expect(chainB.outcomeReport.dateToken).toBe(runPlanB.run.dateToken);
      expect(chainA.outcomeReport.gitSha).not.toBe(chainB.outcomeReport.gitSha);

      // 축 4 — issueNumber 는 search-stdout 종속(modelId·run 무관 → 두 chain 동일 N=7).
      expect(chainA.resolvePlan.action.issueNumber).toBe(7);
      expect(chainB.resolvePlan.action.issueNumber).toBe(7);
    });
  });

  describe("create 분기 격리(branch — 검색 미스 → create, inputs·modelId·searchArgv·post 무관)", () => {
    it("(j) 빈 hit search stdout('[]') → resolve.action 이 create 분기(action.update 부재) — evaluation.inputs(= activities 재유도) / callArgs[].options.modelId / searchArgv --match marker 는 create/update 두 분기 모두 동일(검색 결과가 evaluation inputs·modelId·검색 인자 벡터를 바꾸지 0), post 는 여전히 execStdout 의 N 으로 issueNumber 산출(누설 0)", () => {
      const runPlan = buildRunPlan();
      const activities = defaultActivities();
      const results = defaultResults();
      const stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results);
      const marker = stepArgs.publish.report.descriptor.marker;

      // 빈 hit → create 분기(검색 미스). stepArgs.publish.commandArgs 직결.
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

      // evaluation.inputs(= activities 재유도) / modelId / searchArgv --match marker 는
      // 검색 결과(create/update)와 무관.
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

    it("(k') runPlan.pipeline.modelId 공백-only('   ') 를 우회 합성한 runPlan → aggregator(buildRealDataE2eStepArgs) 측 evaluation 위임 하위 modelId guard throw(aggregator 단계 거부 — inputs 재유도 도달 전 차단)", () => {
      // run-plan helper 가 modelId guard 를 먼저 걸므로, aggregator 단계 throw 를 보려면
      // 정상 runPlan 의 pipeline 만 공백 modelId 로 override 한 runPlan 을 수동 합성한다.
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

    it("(l) runPlan.run.gitSha 빈('') → aggregator측 publish 위임 report-plan assertNonBlank('gitSha') throw(publish leg 비식별 — searchArgv 미합성). modelId·activities 정상이어도 차단", () => {
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

    it("(m) runPlan.run.gitSha 빈('') → post(buildRealDataResultOutcomeStepArgs) 측 위임 빌더 assertNonBlank throw(post boundary 종단 비식별 — execStdout URL 정상이어도 차단)", () => {
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

    // inputs 축 negative — production 매퍼(`mapActivityToEvaluationInput`) 가 모든 sourceType
    // 을 throw 0 으로 관대하게 받으므로(evaluation-input.mapper.ts 시그니처 확인 — discriminator
    // 분기만 두고 throw 분기 0), 본 task 의 inputs 축 negative 는 **빈 activities → inputs `[]`
    // 정상(throw 0) 경계 단언**으로 대체한다(task line 87 명시). aggregator 가 빈 activities 를
    // 그대로 전파해 evaluation 위임이 `{inputs: [], callArgs: []}` 를 반환함을 확인.
    it("(p) inputs 축 negative 대체 — 빈 activities → stepArgs.evaluation.{inputs, callArgs} 모두 빈 배열(throw 0), publish leg / resolve / post 는 정상 진행(inputs 축이 빈 경계도 6-way closure 의 다른 5 축을 차단하지 않음)", () => {
      const runPlan = buildRunPlan();
      const stepArgs = buildRealDataE2eStepArgs(runPlan, [], defaultResults());

      // 빈 activities → 빈 inputs/callArgs(throw 0).
      expect(stepArgs.evaluation.inputs).toEqual([]);
      expect(stepArgs.evaluation.callArgs).toEqual([]);
      // 빈 activities 도 buildRealDataEvaluationInputs([]) === [] 와 byte-identical(재유도
      // 가 빈 경계에도 일관).
      expect(stepArgs.evaluation.inputs).toEqual(
        buildRealDataEvaluationInputs([]),
      );
      // publish leg / resolve / post 는 정상 진행(inputs 축 빈 경계가 publish 축을 차단하지 0).
      expect(stepArgs.publish.report.descriptor.marker.length).toBeGreaterThan(
        0,
      );
      const marker = stepArgs.publish.report.descriptor.marker;
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

    it("(r) no-mutation — 입력 runPlan(특히 aggregator 의 두 leg 와 post 가 같은 runPlan 을 공유 읽기)·activities·results chain 호출 전후 deep-equal(원본 불변)", () => {
      const runPlan = buildRunPlan();
      const activities = defaultActivities();
      const results = defaultResults();
      const runPlanBefore = JSON.parse(JSON.stringify(runPlan));
      const activitiesBefore = JSON.parse(JSON.stringify(activities));
      const resultsBefore = JSON.parse(JSON.stringify(results));

      runChain([7, 13], runPlan, activities, results);

      expect(runPlan).toEqual(runPlanBefore);
      expect(activities).toEqual(activitiesBefore);
      expect(results).toEqual(resultsBefore);
    });

    it("(s) 무공유 — 직접 호출 buildRealDataEvaluationInputs(activities) 와 stepArgs.evaluation.inputs 는 deep-equal 이되 top-level 배열 referential 분리(not.toBe — 무공유), 각 stage 산출물이 입력 runPlan 과도 referential identity 분리", () => {
      const runPlan = buildRunPlan();
      const activities = defaultActivities();
      const { stepArgs, outcomeReport } = runChain(
        [7, 13],
        runPlan,
        activities,
      );

      // 직접 호출 결과와 deep-equal 이지만 top-level 배열은 referential 분리(매 호출 새 배열).
      const directInputs = buildRealDataEvaluationInputs(activities);
      expect(stepArgs.evaluation.inputs).toEqual(directInputs);
      expect(stepArgs.evaluation.inputs).not.toBe(directInputs);

      // stage 산출물도 runPlan 과 referential 분리.
      expect(stepArgs).not.toBe(runPlan);
      expect(stepArgs.evaluation).not.toBe(runPlan);
      expect(stepArgs.publish).not.toBe(runPlan);
      expect(stepArgs.publish.searchArgv).not.toBe(runPlan);
      expect(outcomeReport).not.toBe(runPlan);
      expect(outcomeReport).not.toBe(runPlan.run);
      // 필드 전파(referential 분리에도 값은 동일).
      expect(stepArgs.evaluation.callArgs[0].options.modelId).toBe(
        runPlan.pipeline.modelId,
      );
      expect(outcomeReport.gitSha).toBe(runPlan.run.gitSha);
      expect(outcomeReport.dateToken).toBe(runPlan.run.dateToken);
    });
  });

  describe("credential 누출 0(branch — §9 / R-59 / REQ-059 정합)", () => {
    it("(t) stepArgs.evaluation.inputs(직렬화) · callArgs(직렬화) · stepArgs.publish.searchArgv(배열 각 원소) · commandArgs.searchQuery · report.descriptor.{title,marker,body} · resolvePlan.argv · outcomeReport.{url,summaryLine} 어디에도 token/secret/PAT/--auth 어휘 미등장", () => {
      const { stepArgs, resolvePlan, outcomeReport } = runChain([7, 13]);

      const surfaces: string[] = [
        JSON.stringify(stepArgs.evaluation.inputs),
        JSON.stringify(stepArgs.evaluation.callArgs),
        ...stepArgs.publish.searchArgv,
        stepArgs.publish.commandArgs.searchQuery,
        stepArgs.publish.report.descriptor.title,
        stepArgs.publish.report.descriptor.marker,
        stepArgs.publish.report.descriptor.body,
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
