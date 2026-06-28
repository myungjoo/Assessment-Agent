// realdata-e2e-aggregator-dual-leg-modelid-searchargv-resolve-run-plan-threading-5way-single-source-closure-assembly.smoke-spec.ts
// — 실 평가 e2e step④ aggregator dual-leg modelId+searchArgv 합류 5-way single-source
// closure: pre-실행 aggregator buildRealDataE2eStepArgs(runPlan, activities, results) 의
// **두 leg** 를 단일 검증 runPlan 한 객체에서 동시 source 로 잡는다:
//   - .evaluation leg(축 5, 본 task 의 새 표면) — 모든 stepArgs.evaluation.callArgs[i]
//     .options.modelId === runPlan.pipeline.modelId. 단일 runPlan 의 평가 정책 modelId 가
//     평가 호출-args 전체에 동형 thread(ADR-0048 단일 modelId source).
//   - .publish leg — {report.descriptor.marker, commandArgs.searchQuery, searchArgv(--match
//     토큰)} 세 내부 marker 축 ↔ resolveRealDataResultIssueGhCommandPlan(searchStdout,
//     stepArgs.publish.commandArgs).action.update.issueNumber ↔ buildRealDataResultOutcomeStepArgs(
//     runPlan, execStdout) run-identity.
// 이 5-way(evaluation modelId + publish marker 3-축 + resolve issueNumber + post run-identity)가
// **동일 단일 검증 runPlan** single-source 에서 한 chain 동시-호출로 byte-identical 수렴함을
// 박제하는 첫 aggregator-dual-leg 5-way single-source closure non-gated build-time smoke
// (T-0774 박제, PLAN.md 109행 🟢 실 평가 e2e step④).
//
// 본 spec 의 존재 이유 — public CI gap 해소(evaluation leg modelId 를 5번째 축으로 합류):
//   - PLAN 109행 step④(결과 이슈 박제)의 멱등 search-or-update 의 build-time 순수 layer 는
//     검증된 단일 run plan(`buildRealDataE2eRunPlan(seeds, modelId, run)` → `{pipeline,
//     run}`, T-0597)을 pre-실행 aggregator(`buildRealDataE2eStepArgs(runPlan, activities,
//     results)` → `{evaluation, publish}`, T-0601)에 통째로 넘긴다. 이 aggregator 는 **하나의
//     runPlan 으로부터 두 leg 를 동시 산출**한다:
//       (축 5, 새 표면) `.evaluation` leg — `runPlan.pipeline.modelId` 가 thread 된 평가
//              호출-args. 각 `stepArgs.evaluation.callArgs[i].options.modelId` 가
//              `runPlan.pipeline.modelId` 와 byte-identical.
//       (축 1~3) `.publish` leg 의 내부 marker 3-축 — `report.descriptor.marker` /
//              `commandArgs.searchQuery`(= marker) / `searchArgv`(--match 다음 토큰)이 동일
//              marker 운반. live runner 가 `execFile('gh', searchArgv)` 로 거는 실 검색 토큰.
//       (축 4) resolve issueNumber — marker 로 검색해 hit 1+ → `action.update.issueNumber = N`.
//       (축 5b) post run-identity — `buildRealDataResultOutcomeStepArgs(runPlan, execStdout)`
//              → 동일 runPlan.run 의 gitSha/dateToken 전파.
//   - 직전 sibling 들은 한 leg 만 다뤘다:
//       T-0773 (aggregator.publish 4-way) — `.publish` leg 4축(searchArgv + descriptor.marker
//         + commandArgs.searchQuery + resolve + post)을 단일 runPlan single-source 로 수렴
//         박제. 그러나 `.evaluation` leg(modelId) 미합류 — runPlan 의 pipeline.modelId 축이
//         같은 closure 에 들어오지 않았다.
//       T-0752 (step-args dual-leg convergence) — aggregator 두 leg 가 단일 runPlan source 로
//         수렴함을 박제. 그러나 resolve · post 미합류 — issueNumber 해소 + run-identity 전파
//         경계가 chain 에 없다.
//   - 본 spec 은 그 두 빈 자리를 동시에 채워 **단일 검증 runPlan 이 aggregator 의 dual-leg
//     (evaluation modelId + publish marker/searchArgv) 양쪽의 source 임을 resolve+post 까지
//     묶은 한 chain 으로** 박제한다. 단일 source `(runPlan, activities, results, search-stdout,
//     exec-stdout)` 로부터:
//       (1) evaluation-leg modelId thread(축 5) — `stepArgs = buildRealDataE2eStepArgs(
//           runPlan, activities, results)` → 모든 `stepArgs.evaluation.callArgs[i].options
//           .modelId === runPlan.pipeline.modelId`.
//       (2) publish-leg marker 3-축 일치 — `descriptor.marker === commandArgs.searchQuery ===
//           extractSearchMarker(searchArgv)`.
//       (3) resolve — marker 로 검색 → `action.update.issueNumber = N`.
//       (4) post — `outcomeReport = buildRealDataResultOutcomeStepArgs(runPlan, execStdout)`
//           → 동일 runPlan.run 의 {gitSha, dateToken} 전파.
//   - 이 5-way 가 **동일 단일 검증 runPlan** single-source 로 byte-identical 수렴함이 search-
//     or-update 멱등성(REQ-009)·결과 리포트 재실행 정합(REQ-037)의 aggregator-level "평가 정책
//     (modelId)과 publish 식별(marker/searchArgv/run-identity)이 같은 검증 source 에서 나옴" 의
//     종단 닫음이다 — 재전달 0 로 drift 0.
//   - live leg(실 prisma·실 collectForPerson·실 github.com fetch·실 LLM scoring·실 gh CLI
//     실행·DB·LAN gate)는 복제하지 않고, synthetic runPlan(buildRealDataE2eRunPlan 합성) +
//     activities/results literal + search-stdout/exec-stdout literal 을 컴포저들에 직접 공급해
//     live leg 를 우회한다(조립 surface 만 검증). 따라서 본 spec 은:
//
//      🔥 실 gh 호출 0 — gh search / list / create / edit / execFile('gh', argv) 미실행.
//         synthetic searchStdout / execStdout / runPlan / activities / results literal 직접 공급.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 LLM scoreUnit 호출 0 / 실 DB 접근 0 / 실 jest spawn 0 — 5-way 수렴 조립만.
//         evaluation.callArgs 는 modelId 운반만 검증(실 scoreUnit 호출 0).
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 step-args aggregator / outcome-step-args / run-plan /
//         gh-command-plan / seed-fixture 컴포저 import 재사용만(가드/helper 신설 0).
//         `extractSearchMarker` 는 spec 로컬 함수(T-0773/T-0729 패턴 차용).
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0774):
//   - src 변경 0(src/, prisma/, package.json, CI workflow, 환경 변수 추가 등 모두 금지). test-only.
//   - 실 gh CLI 호출 / `execFile('gh', searchArgv)` 실행 / 실 LLM scoreUnit 호출 / 실 issue
//     검색·박제(step④ live wiring — credential gate, deferred). 본 task 는 in-memory 합성
//     search-stdout / exec-stdout 만. searchArgv 는 **벡터의 marker 토큰만** 검증(실 실행 0),
//     evaluation.callArgs 는 **modelId 운반만** 검증(실 scoreUnit 호출 0).
//   - aggregator dual-leg ↔ 직접 호출(buildRealDataEvaluationStepArgs·
//     buildRealDataResultPublishStepArgs) byte-identical 자체 재단언(T-0752 cover). 본 task 는
//     dual-leg 양쪽 source 가 단일 runPlan 임을 resolve+post 합류 5-way closure 로 묶는 부분만.
//   - aggregator.publish 4-way(searchArgv + descriptor.marker + commandArgs.searchQuery +
//     resolve + post) 자체 재단언(T-0773 cover). 본 task 는 evaluation leg modelId 를 5번째
//     축으로 합류시킨 부분만 새로 단언.
//   - evaluation leg 의 inputs/callArgs 매핑 정합(callArgs[i].input === inputs[i] reference·
//     길이 일치)·scoreUnit 호출-args shape 재단언(evaluation-plan/evaluation-step-args 가드
//     cover). 본 task 는 callArgs[].options.modelId === runPlan.pipeline.modelId 운반 일치만.
//   - 난이도별 modelId routing(R-97 deferred) 검증 금지 — 단일 modelId 동형 적용(ADR-0048)만.
//   - searchArgv 의 전체 형식(gh issue list 플래그 순서·--repo·--state 등 전 인자 정합) 재단언
//     (search-gh-argv 가드 / T-0729 cover). 본 task 는 `--match` 위치의 marker 토큰만.
//   - commandArgs 의 createArgs/updateArgs 정합·labels 재단언(command-args 가드 cover).
//   - resolve 의 argv 합성(gh issue create/edit argv 형식·플래그 순서) 재단언(gh-command-plan
//     가드 cover). 본 task 는 action.update.issueNumber 해소 결과만.
//   - from-output 단독 5필드(url trim 정규화·summaryLine 합성) 재유도 재단언(T-0747 cover).
//   - runPlan 의 pipeline 측 collectCallArgs shape·guard 재단언(run-plan/pipeline-plan helper
//     spec cover). 본 task 는 runPlan.pipeline.modelId + runPlan.run threading 만.
//   - DB 의존 / live-LLM·실 fetch·실 collectForPerson 0.
//   - 새 helper 모듈 신설 / 기존 helper 수정 — test-only(신규 smoke spec 1 파일).
import type { GithubActivity } from "../../src/assessment-collection/domain/activity";
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";
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

// 결정론 modelId fixture — runPlan 의 pipeline 측 입력(evaluation leg source). 본 spec 의
// 핵심 새 축(축 5): stepArgs.evaluation.callArgs[].options.modelId === runPlan.pipeline.modelId
// 임을 단언하므로 modelId 값 자체가 단언 대상이다. 변별성 test 에서는 model-x/model-y 를 별도
// 사용한다.
const MODEL_ID =
  "cfg-realdata-e2e-aggregator-dual-leg-modelid-searchargv-resolve-threading-smoke";

const INSTANCE_KEY = "github.com";

// search argv 안 marker 추출 헬퍼 — 빌더 canonical shape (["search","issues","--match",
// "body",<marker>,"--json","number,title,body","--limit","30"]) 에서 marker 는 `--match
// body` 직후다. 위치 매직 넘버 대신 `--match` 기준 상대 추출(round-trip drift 강건). T-0773/
// T-0729 sibling 헬퍼 패턴 mirror — 단 본 spec 은 그 추출 marker 가 aggregator 의 publish leg
// 가 산출한 stepArgs.publish 의 다른 두 marker 축과 byte-identical 함을 단언(aggregator 진입).
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
// 이 token 이 pre(stepArgs.publish.report.descriptor.marker, 따라서 searchArgv --match
// 토큰에도) / post(gitSha·dateToken·summaryLine) 두 boundary 양쪽에 등장함을 단언한다.
function expectedToken(run: RealDataE2eRunPlan["run"]): string {
  return `${run.dateToken}@${run.gitSha}`;
}

// synthetic runPlan 합성 — buildRealDataE2eRunPlan(seeds, modelId, run) 을 호출해 검증된
// 단일 `{pipeline, run}` 을 만든다(modelId·run guard 통과 비공백 토큰). 매 호출 새 객체 트리
// (테스트 격리). 본 spec 은 이 단일 runPlan 한 객체를 aggregator(dual-leg)·post 두 곳에 넘겨
// 재전달 0 threading 을 박제한다. modelId 인자가 runPlan.pipeline.modelId 로, run 인자가
// runPlan.run 으로 도달한다.
function buildRunPlan(
  modelId = MODEL_ID,
  gitSha = "abc1234",
  dateToken = "2026-06-28",
): RealDataE2eRunPlan {
  const seeds = buildRealDataE2eSeed();
  return buildRealDataE2eRunPlan(seeds, modelId, { gitSha, dateToken });
}

// synthetic GithubActivity 1 건 — aggregator 의 evaluation leg 입력(author = seed 의
// username 으로 매칭). evaluation leg 가 callArgs 를 산출하려면 activities 가 비어있지 않아야
// 한다(빈 activities → callArgs 빈 배열 → modelId 단언 vacuous). 도메인 타입 정합 literal.
function syntheticActivity(
  author: string,
  externalId = "realdata-e2e-aggregator-dual-leg-modelid-c1",
): GithubActivity {
  return {
    sourceType: "github",
    externalId,
    instanceKey: INSTANCE_KEY,
    author,
    timestamp: "2026-06-01T12:00:00Z",
    metadata: { titleLength: 42 },
    repoRef: `${author}/sample-repo`,
    kind: "commit",
  };
}

// 유효 activities fixture — aggregator 의 evaluation leg 입력(Activity[]). seed 의 첫
// username 을 author 로 매칭(evaluation leg 통과용). callArgs 가 1+ 원소를 갖도록 보장.
function defaultActivities(): GithubActivity[] {
  const seeds = buildRealDataE2eSeed();
  const firstUsername = seeds[0].serviceIdentities[0].externalId;
  return [syntheticActivity(firstUsername)];
}

// synthetic EvaluationResult 1 건 — aggregator 의 publish leg 입력. publish step-args 컴포저는
// 결과 배열을 요약 집계 → report.summary / descriptor.body 로만 흘려보내고 marker·title·
// searchArgv 는 run 만의 함수이므로, 도메인 타입 정합(difficulty / contribution 멤버십)만
// 만족하는 minimal literal 로 충분하다.
function syntheticResult(
  unitId: string,
  difficulty: EvaluationResult["difficulty"],
  contribution: EvaluationResult["contribution"],
  volume: number,
): EvaluationResult {
  return {
    unitId,
    narrative:
      "synthetic evaluation narrative — aggregator dual-leg(modelId+searchArgv)↔resolve↔outcome-step-args run-plan-threading 5-way closure smoke fixture",
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
// 합성 헬퍼 — 동일 run 이슈가 이미 존재하는 경우(resolve update 분기 유발). hit 들의 number
// 슬롯을 임의로 받아 최소 number 를 resolve 가 picked 하게 한다.
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
// post 가 동일 N 을 산출하게 한다. 다섯 boundary 산출물 + expectedMinN 을 한 번에 반환.
function runChain(
  hitsNumbers: number[],
  runPlan: RealDataE2eRunPlan = buildRunPlan(),
  activities: GithubActivity[] = defaultActivities(),
  results: EvaluationResult[] = defaultResults(),
  noisePrefix = "",
): {
  expectedMinN: number;
  runPlan: RealDataE2eRunPlan;
  stepArgs: ReturnType<typeof buildRealDataE2eStepArgs>;
  resolvePlan: ReturnType<typeof resolveRealDataResultIssueGhCommandPlan>;
  outcomeReport: ReturnType<typeof buildRealDataResultOutcomeStepArgs>;
} {
  // stage 1(pre boundary, aggregator dual-leg threaded) — stepArgs: {evaluation, publish}.
  // 동일 runPlan 한 객체를 넘김 — aggregator 가 evaluation leg 에 runPlan.pipeline.modelId,
  // publish leg 에 runPlan.run 을 동시 thread(재전달 0). stepArgs.evaluation.callArgs[].options
  // .modelId = runPlan.pipeline.modelId, stepArgs.publish.report.descriptor.marker 안에 run
  // token 박제, commandArgs.searchQuery = marker, searchArgv 의 --match 토큰 = marker.
  const stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results);

  // stage 2(resolve) — searchStdout(marker hit 1+) + stepArgs.publish.commandArgs →
  // action.update.issueNumber. stepArgs.publish.commandArgs 를 두 번째 인자로 그대로 직결.
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
  // 실행 후 받는 stdout + **동일 runPlan 한 객체**를 post step-args 컴포저에 직접 공급(독립
  // run 인자 미수신 — 내부에서 runPlan.run 만 thread).
  const outcomeReport = buildRealDataResultOutcomeStepArgs(
    runPlan,
    execStdout(resolvedN, noisePrefix),
  );

  return { expectedMinN, runPlan, stepArgs, resolvePlan, outcomeReport };
}

describe("Smoke(non-gated): 실 평가 e2e step④ aggregator dual-leg modelId+searchArgv 합류 5-way single-source closure buildRealDataE2eStepArgs(.evaluation callArgs[].options.modelId + .publish {descriptor.marker, commandArgs.searchQuery, searchArgv --match 토큰})↔resolve↔buildRealDataResultOutcomeStepArgs 동일 runPlan 한 객체 한 chain 동시-호출(modelId + marker 3-축 + issueNumber + run-identity 동시 수렴, 재전달 0) live-gh/live-LLM 0 검증", () => {
  describe("happy path — aggregator dual-leg 5-way chain 합성(다섯 산출물 모두 정상)", () => {
    it("(a) 유효 runPlan + activities + results + searchStdout + execStdout → stepArgs.evaluation({inputs,callArgs} 비어있지 않음·Array.isArray(callArgs)) / stepArgs.publish({report,commandArgs,searchArgv} 비어있지 않음·Array.isArray(searchArgv)·report.descriptor.marker 존재) / resolvePlan(update {action, issueNumber} + argv) / outcomeReport(5필드) 다섯 산출물 모두 정상", () => {
      const { stepArgs, resolvePlan, outcomeReport } = runChain([7, 13]);

      // stage 1a — stepArgs.evaluation({inputs, callArgs} 비어있지 않음, callArgs 배열).
      expect(Array.isArray(stepArgs.evaluation.inputs)).toBe(true);
      expect(Array.isArray(stepArgs.evaluation.callArgs)).toBe(true);
      expect(stepArgs.evaluation.callArgs.length).toBeGreaterThan(0);
      // callArgs[].options.modelId reachable(5번째 축 reachable).
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

  describe("evaluation-leg modelId thread 수렴(branch — 핵심 불변식 1, 본 task 의 새 표면)", () => {
    it("(b) 모든 stepArgs.evaluation.callArgs[i].options.modelId === runPlan.pipeline.modelId — 단일 검증 runPlan 의 평가 정책 modelId 가 평가 호출-args 전체에 동형 thread(평가측 modelId source 가 publish 측 run source 와 같은 runPlan)", () => {
      const runPlan = buildRunPlan();
      const { stepArgs } = runChain([7, 13], runPlan);

      // callArgs 비어있지 않음(빈 → vacuous 단언 방지).
      expect(stepArgs.evaluation.callArgs.length).toBeGreaterThan(0);
      // 모든 원소의 modelId 가 runPlan.pipeline.modelId 와 byte-identical.
      stepArgs.evaluation.callArgs.forEach((c) => {
        expect(c.options.modelId).toBe(runPlan.pipeline.modelId);
      });
      // runPlan.pipeline.modelId 자체가 합성에 넣은 MODEL_ID(seed-side source 보존).
      expect(runPlan.pipeline.modelId).toBe(MODEL_ID);
    });
  });

  describe("publish-leg 내부 marker 3-축 일치(branch — 핵심 불변식 2)", () => {
    it("(c) extractSearchMarker(stepArgs.publish.searchArgv) === stepArgs.publish.report.descriptor.marker === stepArgs.publish.commandArgs.searchQuery — 세 내부 marker 축이 byte-identical(실 검색 인자 벡터 marker = descriptor.marker = commandArgs.searchQuery, drift 0)", () => {
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

  describe("marker → resolve issueNumber 수렴(branch — 핵심 불변식 3)", () => {
    it("(d) search hit N → resolve.action.update.issueNumber → outcome step-args.issueNumber 세 지점 모두 동일 N + url 에 /issues/N(resolve↔post 경계 drift 0)", () => {
      const N = 7;
      const { resolvePlan, outcomeReport } = runChain([N, 13]);
      if (resolvePlan.action.action !== "update") {
        throw new Error("update action 기대");
      }

      expect(resolvePlan.action.issueNumber).toBe(N);
      expect(outcomeReport.issueNumber).toBe(N);
      expect(outcomeReport.url).toContain(`/issues/${N}`);
      expect(outcomeReport.issueNumber).toBe(resolvePlan.action.issueNumber);
    });
  });

  describe("단일 runPlan dual-leg+post threading run-identity 수렴(branch — 핵심 불변식 4)", () => {
    it("(e) 동일 runPlan 한 객체를 aggregator·post 두 곳에 넘김(재전달 0) → stepArgs.publish.report.descriptor.marker run token(따라서 searchArgv --match 토큰에도) ↔ outcomeReport.{gitSha,dateToken,summaryLine} 동일 run-identity(aggregator dual-leg·searchArgv 통과 후에도 resolve 경계 가로지름, pre↔post drift 0)", () => {
      const runPlan = buildRunPlan();
      const { stepArgs, outcomeReport } = runChain([7, 13], runPlan);
      const token = expectedToken(runPlan.run);

      expect(stepArgs.publish.report.descriptor.marker).toContain(token);
      expect(extractSearchMarker(stepArgs.publish.searchArgv)).toContain(token);
      expect(outcomeReport.gitSha).toBe(runPlan.run.gitSha);
      expect(outcomeReport.dateToken).toBe(runPlan.run.dateToken);
      expect(outcomeReport.summaryLine).toContain(runPlan.run.gitSha);
      expect(outcomeReport.summaryLine).toContain(runPlan.run.dateToken);
    });
  });

  describe("5-way 단일-source 묶음 단언(branch — closure 종단, 본 task 의 종단 박제)", () => {
    it("(f) evaluation.callArgs[].options.modelId == runPlan.pipeline.modelId, searchArgv --match 토큰 == descriptor.marker == commandArgs.searchQuery, 그 marker 로 resolve 가 찾은 N == post 가 해석한 N, 그 marker 의 run token == post 가 전파한 {gitSha,dateToken} 가 단일 runPlan single-source 에서 5-way 동시 성립", () => {
      const N = 7;
      const runPlan = buildRunPlan();
      const { stepArgs, resolvePlan, outcomeReport } = runChain(
        [N, 13],
        runPlan,
      );
      if (resolvePlan.action.action !== "update") {
        throw new Error("update action 기대");
      }

      const marker = stepArgs.publish.report.descriptor.marker;
      const token = expectedToken(runPlan.run);

      // axis 5(새 표면) — evaluation.callArgs[].options.modelId == runPlan.pipeline.modelId.
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
      // 5-way 동시 closure — 단일 runPlan single-source 에서 다섯 축이 한 chain 으로 묶임.
      expect(`${runPlan.run.dateToken}@${runPlan.run.gitSha}`).toBe(token);
    });
  });

  describe("dual-leg source 변별성(branch — modelId 와 run 은 독립 축, 같은 runPlan→동시 thread)", () => {
    it("(g) runPlan_A{model-x,run_A} vs runPlan_B{model-y,run_B} → A chain 의 evaluation.modelId='model-x'/descriptor.marker·searchArgv·outcome run-identity=run_A token, B chain 은 'model-y'/run_B token 으로 각 chain 안에서 modelId-축과 run-축이 각각 분리 수렴(modelId 변경이 marker/run-identity 에 누설 0, run 변경이 modelId 에 누설 0), issueNumber N 은 두 chain 동일(search-stdout 종속)", () => {
      const runPlanA = buildRunPlan("model-x", "abc1234", "2026-06-21");
      const runPlanB = buildRunPlan("model-y", "def5678", "2026-06-29");
      const chainA = runChain([7, 13], runPlanA);
      const chainB = runChain([7, 13], runPlanB);
      if (
        chainA.resolvePlan.action.action !== "update" ||
        chainB.resolvePlan.action.action !== "update"
      ) {
        throw new Error("update action 기대");
      }

      // chain A — modelId 축: 모든 callArgs modelId='model-x'.
      chainA.stepArgs.evaluation.callArgs.forEach((c) => {
        expect(c.options.modelId).toBe("model-x");
      });
      // chain A — run 축: descriptor.marker / searchArgv / outcome run-identity = run_A.
      const markerA = chainA.stepArgs.publish.report.descriptor.marker;
      expect(extractSearchMarker(chainA.stepArgs.publish.searchArgv)).toBe(
        markerA,
      );
      expect(markerA).toContain(expectedToken(runPlanA.run));
      expect(chainA.outcomeReport.gitSha).toBe(runPlanA.run.gitSha);
      expect(chainA.outcomeReport.dateToken).toBe(runPlanA.run.dateToken);

      // chain B — 동형으로 model-y / run_B.
      chainB.stepArgs.evaluation.callArgs.forEach((c) => {
        expect(c.options.modelId).toBe("model-y");
      });
      const markerB = chainB.stepArgs.publish.report.descriptor.marker;
      expect(extractSearchMarker(chainB.stepArgs.publish.searchArgv)).toBe(
        markerB,
      );
      expect(markerB).toContain(expectedToken(runPlanB.run));
      expect(chainB.outcomeReport.gitSha).toBe(runPlanB.run.gitSha);
      expect(chainB.outcomeReport.dateToken).toBe(runPlanB.run.dateToken);

      // 축 분리 — modelId 변경이 marker/run-identity 에 누설 0(marker 는 run 만의 함수).
      expect(markerA).not.toBe(markerB);
      expect(chainA.outcomeReport.gitSha).not.toBe(chainB.outcomeReport.gitSha);
      // run 변경이 modelId 에 누설 0(modelId 는 두 chain 각자 고정).
      expect(chainA.stepArgs.evaluation.callArgs[0].options.modelId).not.toBe(
        chainB.stepArgs.evaluation.callArgs[0].options.modelId,
      );

      // issueNumber 축 — search-stdout 종속, modelId·run 무관(두 chain 동일 N=7).
      expect(chainA.resolvePlan.action.issueNumber).toBe(7);
      expect(chainB.resolvePlan.action.issueNumber).toBe(7);
      expect(chainA.outcomeReport.issueNumber).toBe(
        chainB.outcomeReport.issueNumber,
      );
    });
  });

  describe("create 분기 격리(branch — 검색 미스 → create, modelId·searchArgv·post 무관)", () => {
    it("(h) 빈 hit search stdout('[]') → resolve.action 이 create 분기(action.update 부재) — evaluation.callArgs[].options.modelId(=runPlan.pipeline.modelId) 와 searchArgv 의 --match marker 는 create/update 두 분기 모두 동일(검색 결과가 evaluation modelId·검색 인자 벡터를 바꾸지 0), post 는 여전히 execStdout 의 N 으로 issueNumber 산출(누설 0)", () => {
      const runPlan = buildRunPlan();
      const stepArgs = buildRealDataE2eStepArgs(
        runPlan,
        defaultActivities(),
        defaultResults(),
      );
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

      // evaluation modelId 와 searchArgv --match marker 는 검색 결과(create/update)와 무관.
      stepArgs.evaluation.callArgs.forEach((c) => {
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

  describe("activities·results 분포 무관 — 5-way 수렴 격리(branch — partial-thread 격리)", () => {
    it("(i) 동일 runPlan·동일 N, activities·results 분포만 다르게 두 chain → evaluation.callArgs[].options.modelId / extractSearchMarker(searchArgv) / descriptor.marker / commandArgs.searchQuery / resolve.action.update.issueNumber / outcomeReport.{issueNumber,gitSha,dateToken} 두 경우 동일, callArgs.length(activities 반영)·report.descriptor.body(results 반영) 는 달라야 함", () => {
      const runPlan = buildRunPlan();
      const firstUsername =
        buildRealDataE2eSeed()[0].serviceIdentities[0].externalId;
      const activitiesA: GithubActivity[] = [
        syntheticActivity(firstUsername, "aggregator-dual-leg-a1"),
      ];
      const activitiesB: GithubActivity[] = [
        syntheticActivity(firstUsername, "aggregator-dual-leg-b1"),
        syntheticActivity(firstUsername, "aggregator-dual-leg-b2"),
      ];
      const resultsA: EvaluationResult[] = [
        syntheticResult("github:github.com:a1", "easy", "low", 1),
      ];
      const resultsB: EvaluationResult[] = [
        syntheticResult("github:github.com:b1", "hard", "high", 9),
        syntheticResult("github:github.com:b2", "medium", "medium", 4),
      ];
      const chainA = runChain([7, 13], runPlan, activitiesA, resultsA);
      const chainB = runChain([7, 13], runPlan, activitiesB, resultsB);
      if (
        chainA.resolvePlan.action.action !== "update" ||
        chainB.resolvePlan.action.action !== "update"
      ) {
        throw new Error("update action 기대");
      }

      // evaluation modelId — activities·results 변경 누설 0(동일 runPlan.pipeline.modelId).
      expect(chainA.stepArgs.evaluation.callArgs[0].options.modelId).toBe(
        chainB.stepArgs.evaluation.callArgs[0].options.modelId,
      );
      expect(chainA.stepArgs.evaluation.callArgs[0].options.modelId).toBe(
        runPlan.pipeline.modelId,
      );
      // searchArgv-marker / descriptor.marker / commandArgs.searchQuery — 동일.
      expect(extractSearchMarker(chainA.stepArgs.publish.searchArgv)).toBe(
        extractSearchMarker(chainB.stepArgs.publish.searchArgv),
      );
      expect(chainA.stepArgs.publish.report.descriptor.marker).toBe(
        chainB.stepArgs.publish.report.descriptor.marker,
      );
      expect(chainA.stepArgs.publish.commandArgs.searchQuery).toBe(
        chainB.stepArgs.publish.commandArgs.searchQuery,
      );
      // issueNumber·run-identity — 동일.
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

      // 입력 분포 반영 축 — callArgs.length(activities)·descriptor.body(results) 는 달라야 함.
      expect(chainA.stepArgs.evaluation.callArgs.length).not.toBe(
        chainB.stepArgs.evaluation.callArgs.length,
      );
      expect(chainA.stepArgs.publish.report.descriptor.body).not.toBe(
        chainB.stepArgs.publish.report.descriptor.body,
      );
    });
  });

  describe("error path / negative cases — 다섯 boundary 거부 대칭 박제", () => {
    it("(j) runPlan.pipeline.modelId 빈('') → run-plan 합성 단계(buildRealDataE2eRunPlan) 측 pipeline modelId guard throw(평가 leg 비식별 — modelId 정책 미결정이면 run plan 산출 차단)", () => {
      const seeds = buildRealDataE2eSeed();
      expect(() =>
        buildRealDataE2eRunPlan(seeds, "", {
          gitSha: "abc1234",
          dateToken: "2026-06-29",
        }),
      ).toThrow();
    });

    it("(j') runPlan.pipeline.modelId 공백-only('   ') 를 우회 합성한 runPlan → aggregator(buildRealDataE2eStepArgs) 측 evaluation 위임 하위 modelId guard throw(aggregator 단계 거부 — evaluation leg 비식별)", () => {
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

    it("(k) runPlan.run.gitSha 빈('') → aggregator측 publish 위임 report-plan assertNonBlank('gitSha') throw(publish leg 비식별 — searchArgv 미합성). modelId 정상이어도 차단(거부 대칭)", () => {
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

    it("(k') runPlan.run.dateToken 빈('') → aggregator측 publish 위임 assertNonBlank('dateToken') throw 대칭", () => {
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

    it("(l) runPlan.run.gitSha 빈('') → post(buildRealDataResultOutcomeStepArgs) 측 위임 빌더 assertNonBlank throw(post boundary 종단 비식별 — execStdout URL 정상이어도 차단, aggregator/post 대칭)", () => {
      const base = buildRunPlan();
      const blankRunPlan: RealDataE2eRunPlan = {
        pipeline: base.pipeline,
        run: { gitSha: "", dateToken: "2026-06-29" },
      };
      expect(() =>
        buildRealDataResultOutcomeStepArgs(blankRunPlan, execStdout(7)),
      ).toThrow();
    });

    it("(m) searchStdout 비JSON('not json') → resolve parse 위임 throw(stepArgs.publish.commandArgs 정상이어도 hits 추출 실패로 차단)", () => {
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

    it("(m') searchStdout 비배열('{}') → resolve parse 위임 throw 대칭", () => {
      const stepArgs = buildRealDataE2eStepArgs(
        buildRunPlan(),
        defaultActivities(),
        defaultResults(),
      );
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(
          "{}",
          stepArgs.publish.commandArgs,
        ),
      ).toThrow();
    });

    it("(n) execStdout URL 미발견(빈 문자열) → post parse 위임 throw(runPlan.run 정상이어도 outcome 추출 실패)", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(buildRunPlan(), ""),
      ).toThrow();
    });

    it("(n') execStdout 무관 텍스트('no url here') → post parse 위임 throw 대칭", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(buildRunPlan(), "no url here"),
      ).toThrow();
    });

    it("(o) execStdout /issues/0 → post assertPositiveIssueNumber throw(post 비식별)", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(
          buildRunPlan(),
          `https://github.com/${OWNER}/${REPO}/issues/0\n`,
        ),
      ).toThrow();
    });

    it("(o') execStdout /issues/abc(비숫자) → post URL 패턴 미매칭 throw(post 비식별)", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(
          buildRunPlan(),
          `https://github.com/${OWNER}/${REPO}/issues/abc\n`,
        ),
      ).toThrow();
    });
  });

  describe("결정론·무공유·no-mutation — chain 두 번 호출 + 입력 불변 + 무공유", () => {
    it("(p) 동일 (runPlan, activities, results, searchStdout, execStdout) chain 두 번 → stepArgs(evaluation+publish)/resolvePlan/outcomeReport 모두 deep-equal(결정론)", () => {
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

    it("(q) no-mutation — 입력 runPlan(특히 aggregator 의 두 leg 와 post 가 같은 runPlan 을 공유 읽기)·activities·results chain 호출 전후 deep-equal(원본 불변)", () => {
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

    it("(r) 무공유 — 각 stage 산출물이 입력 runPlan 과 referential identity 분리(not.toBe), searchArgv 도 새 배열, modelId·gitSha·dateToken 필드는 전파", () => {
      const runPlan = buildRunPlan();
      const { stepArgs, outcomeReport } = runChain([7, 13], runPlan);

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
    it("(s) stepArgs.evaluation.callArgs(직렬화) · stepArgs.publish.searchArgv(배열 각 원소) · commandArgs.searchQuery · report.descriptor.{title,marker,body} · resolvePlan.argv · outcomeReport.{url,summaryLine} 어디에도 token/secret/PAT/--auth 어휘 미등장", () => {
      const { stepArgs, resolvePlan, outcomeReport } = runChain([7, 13]);

      const surfaces: string[] = [
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
