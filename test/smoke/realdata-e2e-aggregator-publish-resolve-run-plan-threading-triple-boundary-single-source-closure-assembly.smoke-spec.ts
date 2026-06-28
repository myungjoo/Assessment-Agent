// realdata-e2e-aggregator-publish-resolve-run-plan-threading-triple-boundary-single-source-closure-assembly.smoke-spec.ts
// — 실 평가 e2e step④ aggregator-publish-leg run-plan-threading triple-boundary
// single-source closure: pre-실행 aggregator buildRealDataE2eStepArgs(runPlan,
// activities, results).publish(pre) → resolveRealDataResultIssueGhCommandPlan(
// searchStdout, stepArgs.publish.commandArgs)(resolve) →
// buildRealDataResultOutcomeStepArgs(runPlan, execStdout)(post) 세 boundary 를
// **동일 단일 검증 runPlan 한 객체**로 한 chain 동시-호출하는 첫 aggregator-publish-leg
// run-plan-threading triple-boundary single-source closure non-gated build-time smoke
// (T-0772 박제, PLAN.md 109행 🟢 실 평가 e2e step④).
//
// 본 spec 의 존재 이유 — public CI gap 해소(chain 시작을 pre-실행 aggregator 의 publish leg 로):
//   - PLAN 109행 step④(결과 이슈 박제)의 멱등 search-or-update 의 build-time 순수 layer 는
//     **검증된 단일 run plan(`buildRealDataE2eRunPlan(seeds, modelId, run)` → `{pipeline,
//     run}`, T-0597)을 pre-실행 aggregator(`buildRealDataE2eStepArgs(runPlan, activities,
//     results)` → `{evaluation, publish}`, T-0601)에 통째로 넘기고**, 그 aggregator 가
//     `runPlan` 을 두 step-level 위임(평가 / publish)에 동시 thread 하는 최상위 진입점으로
//     닫혀 있다:
//       - pre-실행 aggregator: `buildRealDataE2eStepArgs(runPlan, activities, results)` →
//         `{evaluation, publish}`. `runPlan` 을 한 번만 받아 `buildRealDataResultPublishStepArgs(
//         runPlan, results)`(publish leg)·`buildRealDataEvaluationStepArgs(runPlan,
//         activities)`(evaluation leg)에 그대로 thread(재전달 0). `stepArgs.publish:
//         RealDataResultIssuePublishPlan {report, commandArgs, searchArgv}`.
//       - post-실행: `buildRealDataResultOutcomeStepArgs(runPlan, execStdout)`(T-0600) —
//         독립 `run` 인자를 받지 않고 `runPlan.run` 에서만 도출(재전달 0).
//   - 실 live caller 는 한 실행 사이클 안에서:
//       (1) pre-실행 aggregator-threaded
//           `stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results)` →
//           `{evaluation, publish}`. `stepArgs.publish.report.descriptor.marker` 안에
//           `${runPlan.run.dateToken}@${runPlan.run.gitSha}` run token 박제(aggregator 가
//           runPlan 을 통째로 publish 위임에 thread — 독립 run 인자 미수신),
//           `stepArgs.publish.commandArgs.searchQuery === stepArgs.publish.report.descriptor.marker`.
//       (2) resolve
//           `resolvePlan = resolveRealDataResultIssueGhCommandPlan(searchStdout,
//           stepArgs.publish.commandArgs)` → `{action, argv}`. marker(=
//           stepArgs.publish.commandArgs.searchQuery)로 기존 이슈 검색 → hit 1+ → update 분기
//           `{action:'update', issueNumber: N}`(최소 number).
//       (3) post-실행 run-plan-threaded
//           `outcomeReport = buildRealDataResultOutcomeStepArgs(runPlan, execStdout)` →
//           `{issueNumber, url, gitSha, dateToken, summaryLine}`. execStdout URL(`/issues/N`)의
//           issueNumber + **동일 `runPlan`**(독립 run 인자 미수신)의 gitSha/dateToken 전파.
//   - 이 세 boundary 가 **동일 단일 검증 `runPlan`** 으로부터(aggregator 가 publish leg 에
//     통째로 thread + post 가 직접 thread) 도출된 marker run token / run-identity 와
//     search-stdout 종속 issueNumber 를 **한 chain 으로 묶어** byte-identical 수렴함이
//     search-or-update 멱등성(REQ-009)·결과 리포트 재실행 정합(REQ-037)의 aggregator-level
//     run-plan-threading layer 종단 닫음이다 — "live runner 가 단일 호출로 조립한 aggregator 의
//     publish leg 가 산출한 marker run token" 과 "동일 step① run 으로 post 가 해석한 run-identity"
//     가 **재전달 0** 로 같은 source 에서 drift 0 으로 수렴.
//   - 직전 sibling 들은 진입점·threading 형태가 달랐다:
//       T-0771 — run-plan-side step-level 컴포저 `buildRealDataResultPublishStepArgs(runPlan,
//         results)` 직접 진입 triple-boundary — aggregator 미경유(개별 publish step 합성 진입).
//         본 spec 은 chain 시작을 그 위의 **pre-실행 aggregator(`buildRealDataE2eStepArgs`)의
//         `.publish` leg(aggregator 경유 runPlan 통째 thread)** 로 잡는 부분만 새로 단언.
//       T-0770 — top-orchestrator `buildRealDataResultIssuePublishPlan(results, run)` 진입
//         (run 독립 인자 2회 전달) — run-plan-threading 미사용.
//       T-0752(step-args-dual-leg) — aggregator `buildRealDataE2eStepArgs` 진입하나
//         `evaluation`/`publish` 두 leg 가 각 직접 호출과 byte-identical 함만(resolve·post
//         미합류, 멱등 검색·실행 stdout 해석 경계 미경유).
//   - 본 spec 은 그 자리를 채워 **pre-실행 aggregator(`buildRealDataE2eStepArgs`)의 `.publish`
//     leg + resolve leg + post leg 동시-호출** 하는 첫 aggregator-publish-leg run-plan-threading
//     triple-boundary single-source closure 다. 새 단언:
//       (A) aggregator 의 publish leg 가 산출한 marker(stepArgs.publish.commandArgs.searchQuery)
//           로 검색한 이슈 N(resolvePlan.action.issueNumber) ↔ post 가 실행 stdout 해석한 이슈
//           N(outcomeReport.issueNumber)의 cross-boundary 일치, AND
//       (B) 동일 `runPlan` 한 객체를 aggregator·post 두 곳에 넘겼을 때(재전달 0) 단일
//           `runPlan.run` 으로부터 도출된 stepArgs.publish.report.descriptor.marker run token ↔
//           outcomeReport.{gitSha,dateToken,summaryLine} run-identity 의 cross-boundary 일치(
//           aggregator 를 통과해 publish leg 로 thread 된 후에도 수렴), AND
//       (C) stepArgs.publish.commandArgs 가 resolve 입력으로 직결(aggregator-output-as-resolve-input)
//       가 **한 chain 안에서 동시에** 성립.
//   - live leg(실 prisma·실 collectForPerson·실 github.com fetch·실 LLM scoring·실 gh CLI
//     실행·DB·LAN gate)는 복제하지 않고, synthetic runPlan(buildRealDataE2eRunPlan 합성) +
//     activities/results literal + search-stdout/exec-stdout literal 을 컴포저들에 직접 공급해
//     live leg 를 우회한다(조립 surface 만 검증). 따라서 본 spec 은:
//
//      🔥 실 gh 호출 0 — gh search / create / edit / execFile('gh', argv) 미실행.
//         synthetic searchStdout / execStdout / runPlan / activities / results literal 직접 공급.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 LLM 호출 0 / 실 DB 접근 0 / 실 jest spawn 0 — triple-boundary 수렴 조립만.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 step-args aggregator / outcome-step-args / run-plan /
//         gh-command-plan / seed-fixture 컴포저 import 재사용만(가드/helper 신설 0).
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0772):
//   - step-level 컴포저(`buildRealDataResultPublishStepArgs(runPlan, results)`) 직접 진입
//     triple-boundary closure 자체 재단언(T-0771 cover). 본 task 는 chain 시작을 pre-실행
//     aggregator(`buildRealDataE2eStepArgs`)의 `.publish` leg 로 잡는 부분만.
//   - aggregator 의 evaluation/publish 두 leg ↔ 직접 호출 byte-identical 자체 재단언(T-0752
//     step-args-dual-leg cover, resolve·post 미합류). 본 task 는 `.publish` leg 에 resolve
//     leg + post leg 를 합류시킨 triple-boundary 로만.
//   - aggregator 의 evaluation leg(`stepArgs.evaluation`) shape·modelId thread·callArgs 정합
//     재단언(dual-leg / evaluation-step-args 가드 cover). 본 task 는 `.publish` leg 의
//     marker+issueNumber+run-identity cross-boundary 수렴만.
//   - top-orchestrator(`buildRealDataResultIssuePublishPlan(results, run)`, run 독립 인자)
//     진입 triple-boundary 자체 재단언(T-0770 cover).
//   - aggregator 의 self-wire 가드(`assertRealDataE2eStepArgsConsistentWithSources`) 정합
//     재단언(aggregator 단위 spec cover). 본 task 는 marker+issueNumber+run-identity
//     cross-boundary 수렴만.
//   - publishPlan 의 report/commandArgs/searchArgv 개별 필드 shape·self-wire 가드 정합
//     재단언(publish-plan-tri-leg cover).
//   - commandArgs 의 createArgs/updateArgs 정합·labels 재단언(command-args 가드 cover).
//     본 task 는 searchQuery=descriptor.marker 운반 + commandArgs 직결만.
//   - resolve 의 argv 합성(gh issue create/edit argv 형식·플래그 순서) 재단언(gh-command-plan
//     가드 cover). 본 task 는 action.update.issueNumber 해소 결과만.
//   - from-output 단독 5필드(url trim 정규화·summaryLine 합성) 재유도 재단언(T-0747 cover).
//   - runPlan 의 pipeline 측(collectCallArgs·modelId) shape·guard 재단언(run-plan helper
//     spec cover). 본 task 는 runPlan.run threading 만.
//   - DB 의존(prisma client·테스트 DB·migration) / live-LLM·실 fetch·실 collectForPerson 0.
//   - 새 helper 모듈 신설 / 기존 helper 수정 — test-only(신규 smoke spec 1 파일).
//   - production src/ 코드 / package.json / test/jest-smoke.json 변경.
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

// 결정론 modelId fixture — runPlan 의 pipeline 측 입력(evaluation leg). 본 spec 은 publish
// leg 의 run threading 만 보므로 modelId 값 자체는 단언 대상이 아니나, runPlan 합성·aggregator
// evaluation leg 통과에 유효 비공백 값이 필요하다.
const MODEL_ID = "cfg-realdata-e2e-aggregator-publish-resolve-threading-smoke";

const INSTANCE_KEY = "github.com";

// 합성 run-token — descriptor 컴포저 내부 `runToken(run) = ${dateToken}@${gitSha}` 및
// outcome-report 의 summaryLine `[${dateToken}@${gitSha}] ...` 와 동일 규칙으로 test 측에서
// 재유도한 expected 공유 substring. literal prefix 는 private 이라 만지지 않고, 이 token 이
// pre(stepArgs.publish.report.descriptor.marker) / post(gitSha·dateToken·summaryLine) 두
// boundary 양쪽에 등장함을 단언한다.
function expectedToken(run: RealDataE2eRunPlan["run"]): string {
  return `${run.dateToken}@${run.gitSha}`;
}

// synthetic runPlan 합성 — buildRealDataE2eRunPlan(seeds, modelId, run) 을 호출해 검증된
// 단일 `{pipeline, run}` 을 만든다(run guard 통과 비공백 토큰). 매 호출 새 객체 트리(테스트
// 격리). 본 spec 은 이 단일 runPlan 한 객체를 aggregator·post 두 곳에 넘겨 재전달 0 threading
// 을 박제한다.
function buildRunPlan(
  gitSha = "abc1234",
  dateToken = "2026-06-28",
): RealDataE2eRunPlan {
  const seeds = buildRealDataE2eSeed();
  return buildRealDataE2eRunPlan(seeds, MODEL_ID, { gitSha, dateToken });
}

// synthetic GithubActivity 1 건 — aggregator 의 evaluation leg 입력(author = seed 의
// username 으로 매칭). 본 spec 은 publish leg 만 단언하나 aggregator 합성에 activities 가
// 필요하므로(evaluation leg 가 먼저 합성) 도메인 타입 정합 literal 을 공급한다.
function syntheticActivity(
  author: string,
  externalId = "realdata-e2e-aggregator-publish-c1",
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
// username 을 author 로 매칭(evaluation leg 통과용). 분포 값만 다르게 줄 수 있도록 합성
// 활동 배열을 반환한다(activities 무관 격리 시나리오에서 분포 A·B 분리 입력).
function defaultActivities(): GithubActivity[] {
  const seeds = buildRealDataE2eSeed();
  const firstUsername = seeds[0].serviceIdentities[0].externalId;
  return [syntheticActivity(firstUsername)];
}

// synthetic EvaluationResult 1 건 — aggregator 의 publish leg 입력. publish step-args 컴포저는
// 결과 배열을 요약 집계(count·분포·totalVolume) → report.summary / descriptor.body 로만
// 흘려보내고 marker·title 은 run 만의 함수이므로, 도메인 타입 정합(difficulty / contribution
// 멤버십)만 만족하는 minimal literal 로 충분하다. 실 LLM 호출 없이 EvaluationResult shape 만
// 강제한다.
function syntheticResult(
  unitId: string,
  difficulty: EvaluationResult["difficulty"],
  contribution: EvaluationResult["contribution"],
  volume: number,
): EvaluationResult {
  return {
    unitId,
    narrative:
      "synthetic evaluation narrative — aggregator.publish↔resolve↔outcome-step-args run-plan-threading triple-boundary closure smoke fixture",
    difficulty,
    contribution,
    volume,
  };
}

// 유효 results fixture — aggregator 의 publish leg 입력(EvaluationResult[]). 분포 값만 다르게
// 줄 수 있도록 합성 결과 배열을 반환한다(results 무관 격리 시나리오에서 분포 A·B 분리 입력).
function defaultResults(): EvaluationResult[] {
  return [
    syntheticResult("github:github.com:c1", "easy", "low", 3),
    syntheticResult("github:github.com:c2", "medium", "high", 5),
    syntheticResult("github:github.com:c3", "hard", "medium", 2),
  ];
}

// marker(=searchQuery)를 body 에 포함한 hit 1+건 search stdout 합성 헬퍼 — 동일 run 이슈가
// 이미 존재하는 경우(resolve update 분기 유발). hit 들의 number 슬롯을 임의로 받아 최소
// number 를 resolve 가 picked 하게 한다. hit 의 marker 는 stepArgs.publish.commandArgs.searchQuery
// (=report.descriptor.marker)를 그대로 담아 resolve 의 검색 매체가 chain 의 aggregator publish
// leg 산출 marker 임을 보장한다.
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
// 본 helper 는 그 happy-path 형상을 N 별로 합성한다(outcome step-args 내부 parse 가 첫 매칭
// URL 결정론으로 추출하는 surface 직접 자극).
function execStdout(n: number, noisePrefix = ""): string {
  return `${noisePrefix}https://github.com/${OWNER}/${REPO}/issues/${n}\n`;
}

// pre-실행 aggregator(buildRealDataE2eStepArgs(runPlan, activities, results).publish) →
// resolve(search-stdout + stepArgs.publish.commandArgs → action.update.issueNumber) →
// post step-args(buildRealDataResultOutcomeStepArgs(runPlan, execStdout))를 single-source(
// **동일 runPlan 한 객체** + activities + results + N)로 묶어 한 chain 으로 호출하는 헬퍼.
// 핵심: aggregator·post 두 곳에 **같은 runPlan 객체를 넘긴다**(독립 run 인자 재전달 0).
// aggregator 가 runPlan 을 통째로 publish leg 로 thread 하므로 stepArgs.publish 의 marker run
// token 과 post 의 run-identity 가 같은 source 에서 나온다. update 분기를 강제하며(후보 1+건
// stdout), resolver 가 picked 한 N 을 execStdout 에 흘려 post 가 동일 N 을 산출하게 한다.
// 세 boundary 산출물 + expectedMinN 을 한 번에 반환해 triple-boundary 단언을 짧게 묶는다.
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
  // stage 1(pre boundary, aggregator-threaded) — stepArgs: {evaluation, publish}. 동일
  // runPlan 한 객체를 넘김 — aggregator 가 publish leg 에 runPlan 을 통째 thread(독립 run
  // 인자 미수신). stepArgs.publish.report.descriptor.marker 안에 run token 박제,
  // stepArgs.publish.commandArgs.searchQuery = marker.
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

describe("Smoke(non-gated): 실 평가 e2e step④ aggregator-publish-leg run-plan-threading triple-boundary single-source closure buildRealDataE2eStepArgs(.publish)↔resolve↔buildRealDataResultOutcomeStepArgs 세 boundary 동일 runPlan 한 객체 한 chain 동시-호출(marker run token + issueNumber + run-identity 동시 수렴, 재전달 0) live-gh 0 검증", () => {
  describe("happy path — 세 boundary 모두 정상 산출(aggregator.publish + resolve plan + outcome step-args report)", () => {
    it("(a) 유효 runPlan + activities + results + searchStdout + execStdout → stepArgs.publish({report,commandArgs,searchArgv} 비어있지 않음·report.descriptor.marker 존재) / resolvePlan(update {action, issueNumber} + argv) / outcomeReport(5필드) 세 산출물 모두 정상", () => {
      const { stepArgs, resolvePlan, outcomeReport } = runChain([7, 13]);

      // stage 1 — stepArgs.publish({report, commandArgs, searchArgv} 비어있지 않음).
      expect(typeof stepArgs.publish.report).toBe("object");
      expect(typeof stepArgs.publish.commandArgs).toBe("object");
      expect(Array.isArray(stepArgs.publish.searchArgv)).toBe(true);
      expect(stepArgs.publish.searchArgv.length).toBeGreaterThan(0);
      // report.descriptor.marker reachable(aggregator publish leg 출력에서 도달 가능).
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

  describe("aggregator-threaded issueNumber single-source 수렴(branch — 핵심 불변식 1)", () => {
    it("(b) search hit N → resolve.action.update.issueNumber → outcome step-args.issueNumber 세 지점 모두 동일 N + url 에 /issues/N(resolve↔post 경계 drift 0)", () => {
      const N = 7;
      const { resolvePlan, outcomeReport } = runChain([N, 13]);
      if (resolvePlan.action.action !== "update") {
        throw new Error("update action 기대");
      }

      expect(resolvePlan.action.issueNumber).toBe(N);
      expect(outcomeReport.issueNumber).toBe(N);
      expect(outcomeReport.url).toContain(`/issues/${N}`);
      // 종단 closure — aggregator 의 publish leg 가 산출한 marker 로 검색해 찾은 N 과 post
      // step-args 컴포저가 해석한 N 의 한 chain 수렴.
      expect(outcomeReport.issueNumber).toBe(resolvePlan.action.issueNumber);
    });
  });

  describe("단일 runPlan aggregator threading run-identity 수렴(branch — 핵심 불변식 2, 본 task 의 새 표면)", () => {
    it("(c) 동일 runPlan 한 객체를 aggregator·post 두 곳에 넘김(재전달 0) → stepArgs.publish.report.descriptor.marker run token ↔ outcomeReport.{gitSha,dateToken,summaryLine} 동일 run-identity(aggregator 통과 후에도 resolve 경계 가로지름, pre↔post drift 0)", () => {
      const runPlan = buildRunPlan();
      const { stepArgs, outcomeReport } = runChain([7, 13], runPlan);
      const token = expectedToken(runPlan.run);

      // pre boundary — aggregator publish leg 산출 marker 안 run token(runPlan.run 도출).
      expect(stepArgs.publish.report.descriptor.marker).toContain(token);
      // post boundary — post step-args 컴포저 run-identity 전파(동일 runPlan.run 도출).
      expect(outcomeReport.gitSha).toBe(runPlan.run.gitSha);
      expect(outcomeReport.dateToken).toBe(runPlan.run.dateToken);
      expect(outcomeReport.summaryLine).toContain(runPlan.run.gitSha);
      expect(outcomeReport.summaryLine).toContain(runPlan.run.dateToken);
    });
  });

  describe("stepArgs.publish.commandArgs → resolve 직결 marker 매개 무결성(branch — aggregator-output-as-resolve-input)", () => {
    it("(d) stepArgs.publish.commandArgs.searchQuery === stepArgs.publish.report.descriptor.marker(byte-identical) AND 그 marker(=searchQuery)가 resolve 검색 매체로 update 분기를 이끎(commandArgs 직결)", () => {
      const { stepArgs, resolvePlan } = runChain([7, 13]);

      // aggregator publish leg 산출 commandArgs.searchQuery 가 report.descriptor.marker 운반.
      expect(stepArgs.publish.commandArgs.searchQuery).toBe(
        stepArgs.publish.report.descriptor.marker,
      );
      // 그 marker(=searchQuery)가 commandArgs 직결로 resolve 검색 매체가 되어 update 분기.
      expect(resolvePlan.action.action).toBe("update");
      if (resolvePlan.action.action === "update") {
        expect(typeof resolvePlan.action.issueNumber).toBe("number");
      }
    });
  });

  describe("create 분기 격리(branch — 검색 미스 → create, post 무관)", () => {
    it("(e) 빈 hit search stdout('[]') → resolve.action 이 create 분기(action.update 부재) — post step-args 는 여전히 execStdout 의 N 으로 issueNumber 산출(누설 0), marker run token 은 두 분기 동일", () => {
      const runPlan = buildRunPlan();
      const stepArgs = buildRealDataE2eStepArgs(
        runPlan,
        defaultActivities(),
        defaultResults(),
      );

      // 빈 hit → create 분기(검색 미스). stepArgs.publish.commandArgs 직결.
      const resolvePlan = resolveRealDataResultIssueGhCommandPlan(
        "[]",
        stepArgs.publish.commandArgs,
      );
      expect(resolvePlan.action.action).toBe("create");
      expect("issueNumber" in resolvePlan.action).toBe(false);

      // post step-args 는 resolve 분기와 독립 — execStdout 의 N 으로 issueNumber 산출.
      const N = 42;
      const outcomeReport = buildRealDataResultOutcomeStepArgs(
        runPlan,
        execStdout(N),
      );
      expect(outcomeReport.issueNumber).toBe(N);

      // marker run token 은 create/update 두 분기 모두 동일(검색 결과 무관).
      expect(stepArgs.publish.report.descriptor.marker).toContain(
        expectedToken(runPlan.run),
      );
    });
  });

  describe("runPlan.run 변별성(branch — 다른 run→다른 run-identity, 같은 runPlan→triple 수렴)", () => {
    it("(f) runPlan_A vs runPlan_B → 각 chain 의 stepArgs.publish.report.descriptor.marker token / outcomeReport.{gitSha,dateToken} 가 run 별 분리 수렴, issueNumber N 은 두 chain 동일(search-stdout 종속, run 무관)", () => {
      const runPlanA = buildRunPlan("abc1234", "2026-06-21");
      const runPlanB = buildRunPlan("def5678", "2026-06-29");
      const chainA = runChain([7, 13], runPlanA);
      const chainB = runChain([7, 13], runPlanB);
      if (
        chainA.resolvePlan.action.action !== "update" ||
        chainB.resolvePlan.action.action !== "update"
      ) {
        throw new Error("update action 기대");
      }

      // run 축 — 각 chain 안 triple 일치(pre marker token ↔ post run-identity), 두 chain 간 분리.
      expect(chainA.stepArgs.publish.report.descriptor.marker).toContain(
        expectedToken(runPlanA.run),
      );
      expect(chainA.outcomeReport.gitSha).toBe(runPlanA.run.gitSha);
      expect(chainA.outcomeReport.dateToken).toBe(runPlanA.run.dateToken);
      expect(chainB.stepArgs.publish.report.descriptor.marker).toContain(
        expectedToken(runPlanB.run),
      );
      expect(chainB.outcomeReport.gitSha).toBe(runPlanB.run.gitSha);
      expect(chainB.outcomeReport.dateToken).toBe(runPlanB.run.dateToken);
      expect(chainA.stepArgs.publish.report.descriptor.marker).not.toBe(
        chainB.stepArgs.publish.report.descriptor.marker,
      );
      expect(chainA.outcomeReport.gitSha).not.toBe(chainB.outcomeReport.gitSha);

      // issueNumber 축 — search-stdout 종속, run 무관(두 chain 동일 N=7).
      expect(chainA.resolvePlan.action.issueNumber).toBe(7);
      expect(chainB.resolvePlan.action.issueNumber).toBe(7);
      expect(chainA.outcomeReport.issueNumber).toBe(
        chainB.outcomeReport.issueNumber,
      );
    });
  });

  describe("activities·results 무관 — triple 수렴 격리(branch — partial-thread 격리)", () => {
    it("(g) 동일 runPlan·동일 N, activities·results 분포만 다르게 두 chain → marker / resolve.action.update.issueNumber / outcomeReport.{issueNumber,gitSha,dateToken} 두 경우 동일, stepArgs.publish.report.descriptor.body 만 달라야 함", () => {
      const runPlan = buildRunPlan();
      const firstUsername =
        buildRealDataE2eSeed()[0].serviceIdentities[0].externalId;
      const activitiesA: GithubActivity[] = [
        syntheticActivity(firstUsername, "aggregator-publish-a1"),
      ];
      const activitiesB: GithubActivity[] = [
        syntheticActivity(firstUsername, "aggregator-publish-b1"),
        syntheticActivity(firstUsername, "aggregator-publish-b2"),
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

      // marker run token·issueNumber·run-identity — activities·results 변경 누설 0(동일).
      expect(chainA.stepArgs.publish.report.descriptor.marker).toBe(
        chainB.stepArgs.publish.report.descriptor.marker,
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

      // descriptor.body 는 results 본문 반영 — 두 경우 달라야 함(다른 축은 불변).
      expect(chainA.stepArgs.publish.report.descriptor.body).not.toBe(
        chainB.stepArgs.publish.report.descriptor.body,
      );
    });
  });

  describe("error path / negative cases — 세 boundary 거부 대칭 박제", () => {
    it("(h) runPlan.run.gitSha 빈('') → aggregator(buildRealDataE2eStepArgs) 측 publish 위임 report-plan assertNonBlank('gitSha') throw(pre boundary 차단 — chain 시작 비식별)", () => {
      // run guard 를 통과하는 runPlan 을 만든 뒤 run.gitSha 만 빈 문자열로 강제 — aggregator
      // 측 publish 위임 report-plan guard 가 throw 함을 박제(runPlan 합성 단계가 아니라
      // aggregator 컴포저 경계).
      const runPlan = buildRunPlan();
      const blankRunPlan: RealDataE2eRunPlan = {
        pipeline: runPlan.pipeline,
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

    it("(h') runPlan.run.gitSha 공백-only('   ') → aggregator측 publish 위임 assertNonBlank('gitSha') throw 대칭", () => {
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

    it("(i) runPlan.run.dateToken 빈('') → aggregator측 publish 위임 assertNonBlank('dateToken') throw 대칭", () => {
      const runPlan = buildRunPlan();
      const blankRunPlan: RealDataE2eRunPlan = {
        pipeline: runPlan.pipeline,
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

    it("(j) runPlan.run.gitSha 빈('') → post(buildRealDataResultOutcomeStepArgs) 측 위임 빌더 assertNonBlank throw(post boundary 종단 비식별 — execStdout URL 정상이어도 차단, aggregator/post 대칭)", () => {
      const runPlan = buildRunPlan();
      const blankRunPlan: RealDataE2eRunPlan = {
        pipeline: runPlan.pipeline,
        run: { gitSha: "", dateToken: "2026-06-29" },
      };
      expect(() =>
        buildRealDataResultOutcomeStepArgs(blankRunPlan, execStdout(7)),
      ).toThrow();
    });

    it("(k) searchStdout 비JSON('not json') → resolve parse 위임 throw(stepArgs.publish.commandArgs.searchQuery 정상이어도 hits 추출 실패로 차단)", () => {
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

    it("(k') searchStdout 비배열('{}') → resolve parse 위임 throw 대칭", () => {
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

    it("(l) execStdout URL 미발견(빈 문자열) → post parse 위임 throw(post 미산출)", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(buildRunPlan(), ""),
      ).toThrow();
    });

    it("(l') execStdout 무관 텍스트('no url here') → post parse 위임 throw 대칭", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(buildRunPlan(), "no url here"),
      ).toThrow();
    });

    it("(m) execStdout /issues/0 → post assertPositiveIssueNumber throw(post 비식별)", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(
          buildRunPlan(),
          `https://github.com/${OWNER}/${REPO}/issues/0\n`,
        ),
      ).toThrow();
    });

    it("(m') execStdout /issues/abc(비숫자) → post URL 패턴 미매칭 throw(post 비식별)", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(
          buildRunPlan(),
          `https://github.com/${OWNER}/${REPO}/issues/abc\n`,
        ),
      ).toThrow();
    });
  });

  describe("결정론·무공유·no-mutation — chain 두 번 호출 + 입력 불변 + 무공유", () => {
    it("(n) 동일 (runPlan, activities, results, searchStdout, execStdout) chain 두 번 → stepArgs.publish/resolvePlan/outcomeReport 모두 deep-equal(결정론)", () => {
      const runPlan = buildRunPlan();
      const activities = defaultActivities();
      const results = defaultResults();
      const chain1 = runChain([7, 13], runPlan, activities, results);
      const chain2 = runChain([7, 13], runPlan, activities, results);

      expect(chain1.stepArgs.publish).toEqual(chain2.stepArgs.publish);
      expect(chain1.resolvePlan).toEqual(chain2.resolvePlan);
      expect(chain1.outcomeReport).toEqual(chain2.outcomeReport);
    });

    it("(o) no-mutation — 입력 runPlan(특히 aggregator/post 두 곳이 같은 runPlan 을 공유 읽기)·activities·results chain 호출 전후 deep-equal(원본 불변)", () => {
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

    it("(p) 무공유 — 각 stage 산출물이 입력 runPlan 과 referential identity 분리(not.toBe), 필드는 전파", () => {
      const runPlan = buildRunPlan();
      const { stepArgs, outcomeReport } = runChain([7, 13], runPlan);

      expect(stepArgs).not.toBe(runPlan);
      expect(stepArgs.publish).not.toBe(runPlan);
      expect(outcomeReport).not.toBe(runPlan);
      expect(outcomeReport).not.toBe(runPlan.run);
      expect(outcomeReport.gitSha).toBe(runPlan.run.gitSha);
      expect(outcomeReport.dateToken).toBe(runPlan.run.dateToken);
    });
  });

  describe("credential 누출 0(branch — §9 / R-59 / REQ-059 정합)", () => {
    it("(q) stepArgs.publish.searchArgv · stepArgs.publish.commandArgs.searchQuery · stepArgs.publish.report.descriptor.{title,marker,body} · resolvePlan.argv · outcomeReport.{url,summaryLine} 어디에도 token/secret/PAT/--auth 어휘 미등장", () => {
      const { stepArgs, resolvePlan, outcomeReport } = runChain([7, 13]);

      const surfaces = [
        stepArgs.publish.searchArgv.join(" "),
        stepArgs.publish.commandArgs.searchQuery,
        stepArgs.publish.report.descriptor.title,
        stepArgs.publish.report.descriptor.marker,
        stepArgs.publish.report.descriptor.body,
        resolvePlan.argv.join(" "),
        outcomeReport.url,
        outcomeReport.summaryLine,
      ];
      for (const surface of surfaces) {
        expect(surface).not.toContain("--token");
        expect(surface).not.toContain("--auth");
        expect(surface).not.toContain("GITHUB_TOKEN");
        expect(surface).not.toContain("Authorization");
        expect(surface).not.toContain("Bearer");
        expect(surface).not.toContain("x-access-token");
        expect(surface).not.toContain("x-github-token");
        expect(surface).not.toMatch(/ghp_[A-Za-z0-9]/);
        expect(surface).not.toMatch(/PAT/);
      }
      // outcome url 은 issue 경로만 — commit/PR narrative 어휘 미포함.
      expect(outcomeReport.url).not.toMatch(/commit|pull request/i);
    });
  });
});
