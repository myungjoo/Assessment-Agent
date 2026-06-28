// realdata-e2e-aggregator-publish-searchargv-resolve-run-plan-threading-4way-single-source-closure-assembly.smoke-spec.ts
// — 실 평가 e2e step④ aggregator-publish-leg search-argv 합류 4-way single-source
// closure: pre-실행 aggregator buildRealDataE2eStepArgs(runPlan, activities,
// results).publish leg 의 {report.descriptor.marker, commandArgs.searchQuery,
// searchArgv(--match 토큰)} 세 내부 marker 축 ↔ resolveRealDataResultIssueGhCommandPlan(
// searchStdout, stepArgs.publish.commandArgs).action.update.issueNumber ↔
// buildRealDataResultOutcomeStepArgs(runPlan, execStdout) run-identity 를 **동일 단일
// 검증 runPlan 한 객체**로 한 chain 동시-호출해 marker(3-축) + issueNumber + run-identity
// 가 단일 source 4-way 로 동시 수렴함을 박제하는 첫 aggregator-publish-leg searchArgv-합류
// 4-way single-source closure non-gated build-time smoke (T-0773 박제, PLAN.md 109행
// 🟢 실 평가 e2e step④).
//
// 본 spec 의 존재 이유 — public CI gap 해소(searchArgv 를 4번째 축으로 합류):
//   - PLAN 109행 step④(결과 이슈 박제)의 멱등 search-or-update 의 build-time 순수 layer 는
//     검증된 단일 run plan(`buildRealDataE2eRunPlan(seeds, modelId, run)` → `{pipeline,
//     run}`, T-0597)을 pre-실행 aggregator(`buildRealDataE2eStepArgs(runPlan, activities,
//     results)` → `{evaluation, publish}`, T-0601)에 통째로 넘기고, 그 aggregator 의
//     `.publish` leg(`RealDataResultIssuePublishPlan {report, commandArgs, searchArgv}`)가
//     **세 내부 축에 동일 marker 를 일관 운반**한다:
//       (축 1) `stepArgs.publish.report.descriptor.marker` — 멱등 검색·갱신용 안정 run
//              token(`${run.dateToken}@${run.gitSha}` 포함).
//       (축 2) `stepArgs.publish.commandArgs.searchQuery` — `= descriptor.marker`(검색 문자열).
//       (축 3) `stepArgs.publish.searchArgv` — **live runner 가 `execFile('gh', searchArgv)`
//              로 실 실행하는 gh issue list CLI 벡터**. `--match body <marker>` 위치(
//              indexOf("--match") + 2)에 동일 marker 가 박혀 있어, 실제 gh 검색이 거는
//              토큰이 곧 descriptor.marker / commandArgs.searchQuery 와 byte-identical
//              이어야 멱등 검색이 성립한다.
//   - 직전 sibling T-0772(aggregator-publish triple-boundary)는 aggregator `.publish` leg
//     진입하나 marker 축이 `descriptor.marker` + `commandArgs.searchQuery` 두 개만 다뤘다
//     — "live runner 가 gh 검색에 **실제로** 넘기는 인자 벡터(`searchArgv`)" 가 같은 marker
//     를 운반하는지는 chain 에 합류되지 않았다. 기존 4-way sibling T-0729
//     (publish-plan-search-argv-resolve-marker-4way)는 searchArgv 를 다루나 **top-orchestrator
//     `buildRealDataResultIssuePublishPlan(results, run)` 진입**(run 독립 인자, aggregator
//     미경유·run-plan-threading 미사용) + **post-실행 outcome leg 미합류**(run-identity
//     수렴 경계 미경유)였다.
//   - 본 spec 은 그 자리를 채워 **chain 을 pre-실행 aggregator `buildRealDataE2eStepArgs`
//     의 `.publish` leg 로 잡고 searchArgv 를 4번째 축으로 합류**시킨다. 단일 source
//     `(runPlan, activities, results, search-stdout, exec-stdout)` 로부터:
//       (1) aggregator-publish 내부 marker 3-축 일치 — `stepArgs = buildRealDataE2eStepArgs(
//           runPlan, activities, results)` → `stepArgs.publish.report.descriptor.marker ===
//           stepArgs.publish.commandArgs.searchQuery === extractSearchMarker(
//           stepArgs.publish.searchArgv)`(searchArgv 의 `--match body` 다음 토큰). 세 내부
//           축이 동일 marker 운반(실 검색 토큰 drift 0).
//       (2) resolve — `resolvePlan = resolveRealDataResultIssueGhCommandPlan(searchStdout,
//           stepArgs.publish.commandArgs)` → marker 로 검색해 hit 1+ → `action.update.issueNumber = N`.
//       (3) post-실행 run-plan-threaded — `outcomeReport = buildRealDataResultOutcomeStepArgs(
//           runPlan, execStdout)` → `{issueNumber, url, gitSha, dateToken, summaryLine}`.
//           **동일 `runPlan`**(독립 run 인자 미수신)의 gitSha/dateToken 전파.
//   - 이 4-way(aggregator-publish 내부 marker 3-축 + resolve issueNumber + post run-identity)가
//     **동일 단일 검증 `runPlan`** single-source 로 byte-identical 수렴함이 search-or-update
//     멱등성(REQ-009)·결과 리포트 재실행 정합(REQ-037)의 aggregator-level "실 검색 인자 벡터
//     까지 포함한" 종단 닫음이다 — 즉 "live runner 가 gh 에 실제로 거는 검색 토큰" 과 "resolve
//     가 검색에 쓰는 토큰" 과 "post 가 해석한 run-identity" 가 재전달 0 로 같은 source 에서
//     drift 0 수렴함.
//   - live leg(실 prisma·실 collectForPerson·실 github.com fetch·실 LLM scoring·실 gh CLI
//     실행·DB·LAN gate)는 복제하지 않고, synthetic runPlan(buildRealDataE2eRunPlan 합성) +
//     activities/results literal + search-stdout/exec-stdout literal 을 컴포저들에 직접 공급해
//     live leg 를 우회한다(조립 surface 만 검증). 따라서 본 spec 은:
//
//      🔥 실 gh 호출 0 — gh search / list / create / edit / execFile('gh', argv) 미실행.
//         synthetic searchStdout / execStdout / runPlan / activities / results literal 직접 공급.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 LLM 호출 0 / 실 DB 접근 0 / 실 jest spawn 0 — 4-way 수렴 조립만.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 step-args aggregator / outcome-step-args / run-plan /
//         gh-command-plan / seed-fixture 컴포저 import 재사용만(가드/helper 신설 0).
//         `extractSearchMarker` 는 spec 로컬 함수(T-0729 패턴 차용).
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0773):
//   - src 변경 0(src/, prisma/, package.json, CI workflow, 환경 변수 추가 등 모두 금지). test-only.
//   - 실 gh CLI 호출 / `execFile('gh', searchArgv)` 실행 / 실 issue 검색·박제(step④ live
//     wiring — credential gate, deferred). 본 task 는 in-memory 합성 search-stdout /
//     exec-stdout 만. searchArgv 는 **벡터의 marker 토큰만** 검증(실 실행 0).
//   - aggregator-publish-leg run-plan-threading triple-boundary(descriptor.marker +
//     commandArgs.searchQuery 2-축 + resolve + post) 자체 재단언(T-0772 cover). 본 task 는
//     **searchArgv 를 4번째 축으로 합류**시킨 부분만 새로 단언.
//   - top-orchestrator(`buildRealDataResultIssuePublishPlan(results, run)`) 진입
//     search-argv-resolve-marker 4way(post 미합류) 자체 재단언(T-0729 cover).
//   - step-level 컴포저(`buildRealDataResultPublishStepArgs`) 직접 진입 triple-boundary 자체
//     재단언(T-0771 cover).
//   - aggregator 의 evaluation/publish 두 leg ↔ 직접 호출 byte-identical 자체 재단언(T-0752
//     step-args-dual-leg cover). 본 task 는 `.publish` leg 의 searchArgv 합류 4-way 수렴만.
//   - searchArgv 의 전체 형식(gh issue list 플래그 순서·--repo·--state 등 전 인자 정합) 재단언
//     (search-gh-argv 가드 / T-0729 cover). 본 task 는 `--match` 위치의 marker 토큰이
//     descriptor.marker 와 같음만(나머지 인자 형식 재단언 0).
//   - commandArgs 의 createArgs/updateArgs 정합·labels 재단언(command-args 가드 cover).
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
// leg 의 run threading + searchArgv 합류만 보므로 modelId 값 자체는 단언 대상이 아니나,
// runPlan 합성·aggregator evaluation leg 통과에 유효 비공백 값이 필요하다.
const MODEL_ID =
  "cfg-realdata-e2e-aggregator-publish-searchargv-resolve-threading-smoke";

const INSTANCE_KEY = "github.com";

// search argv 안 marker 추출 헬퍼 — 빌더 canonical shape (["search","issues","--match",
// "body",<marker>,"--json","number,title,body","--limit","30"]) 에서 marker 는 `--match
// body` 직후(index 4)다. 위치 매직 넘버 대신 `--match` 기준 상대 추출(round-trip drift
// 강건). T-0729 sibling 헬퍼 패턴 mirror — 단 본 spec 은 그 추출 marker 가 aggregator
// 의 publish leg 가 산출한 stepArgs.publish 의 다른 두 marker 축과 byte-identical 함을
// 단언(top-orchestrator 진입이 아니라 aggregator 진입).
function extractSearchMarker(searchArgv: string[]): string {
  const matchIdx = searchArgv.indexOf("--match");
  if (matchIdx < 0) {
    throw new Error("search argv 에 --match 가 없습니다 — marker 추출 불가");
  }
  // `--match` <field=body> <marker> 순서 — marker 는 field 다음(matchIdx + 2).
  return searchArgv[matchIdx + 2];
}

// 합성 run-token — descriptor 컴포저 내부 `runToken(run) = ${dateToken}@${gitSha}` 및
// outcome-report 의 summaryLine `[${dateToken}@${gitSha}] ...` 와 동일 규칙으로 test 측에서
// 재유도한 expected 공유 substring. literal prefix 는 private 이라 만지지 않고, 이 token 이
// pre(stepArgs.publish.report.descriptor.marker, 따라서 searchArgv --match 토큰에도) /
// post(gitSha·dateToken·summaryLine) 두 boundary 양쪽에 등장함을 단언한다.
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
// username 으로 매칭). 본 spec 은 publish leg(+searchArgv)만 단언하나 aggregator 합성에
// activities 가 필요하므로(evaluation leg 가 먼저 합성) 도메인 타입 정합 literal 을 공급한다.
function syntheticActivity(
  author: string,
  externalId = "realdata-e2e-aggregator-publish-searchargv-c1",
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
// username 을 author 로 매칭(evaluation leg 통과용).
function defaultActivities(): GithubActivity[] {
  const seeds = buildRealDataE2eSeed();
  const firstUsername = seeds[0].serviceIdentities[0].externalId;
  return [syntheticActivity(firstUsername)];
}

// synthetic EvaluationResult 1 건 — aggregator 의 publish leg 입력. publish step-args 컴포저는
// 결과 배열을 요약 집계(count·분포·totalVolume) → report.summary / descriptor.body 로만
// 흘려보내고 marker·title·searchArgv 는 run 만의 함수이므로, 도메인 타입 정합(difficulty /
// contribution 멤버십)만 만족하는 minimal literal 로 충분하다. 실 LLM 호출 없이
// EvaluationResult shape 만 강제한다.
function syntheticResult(
  unitId: string,
  difficulty: EvaluationResult["difficulty"],
  contribution: EvaluationResult["contribution"],
  volume: number,
): EvaluationResult {
  return {
    unitId,
    narrative:
      "synthetic evaluation narrative — aggregator.publish(searchArgv)↔resolve↔outcome-step-args run-plan-threading 4-way closure smoke fixture",
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
// 슬롯을 임의로 받아 최소 number 를 resolve 가 picked 하게 한다. hit 의 marker 는
// stepArgs.publish.commandArgs.searchQuery(=report.descriptor.marker=searchArgv --match 토큰)를
// 그대로 담아 resolve 의 검색 매체가 chain 의 aggregator publish leg 산출 marker 임을 보장한다.
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
// token(descriptor.marker / commandArgs.searchQuery / searchArgv --match 토큰)과 post 의
// run-identity 가 같은 source 에서 나온다. update 분기를 강제하며(후보 1+건 stdout), resolver 가
// picked 한 N 을 execStdout 에 흘려 post 가 동일 N 을 산출하게 한다. 세 boundary 산출물 +
// expectedMinN 을 한 번에 반환해 4-way 단언을 짧게 묶는다.
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
  // stepArgs.publish.commandArgs.searchQuery = marker, stepArgs.publish.searchArgv 의
  // --match 토큰 = marker.
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

describe("Smoke(non-gated): 실 평가 e2e step④ aggregator-publish-leg search-argv 합류 4-way single-source closure buildRealDataE2eStepArgs(.publish {descriptor.marker, commandArgs.searchQuery, searchArgv --match 토큰})↔resolve↔buildRealDataResultOutcomeStepArgs 동일 runPlan 한 객체 한 chain 동시-호출(marker 3-축 + issueNumber + run-identity 동시 수렴, 재전달 0) live-gh 0 검증", () => {
  describe("happy path — aggregator-publish-leg 4-way chain 합성(네 산출물 모두 정상)", () => {
    it("(a) 유효 runPlan + activities + results + searchStdout + execStdout → stepArgs.publish({report,commandArgs,searchArgv} 비어있지 않음·Array.isArray(searchArgv)·report.descriptor.marker 존재) / resolvePlan(update {action, issueNumber} + argv) / outcomeReport(5필드) 네 산출물 모두 정상", () => {
      const { stepArgs, resolvePlan, outcomeReport } = runChain([7, 13]);

      // stage 1 — stepArgs.publish({report, commandArgs, searchArgv} 비어있지 않음).
      expect(typeof stepArgs.publish.report).toBe("object");
      expect(typeof stepArgs.publish.commandArgs).toBe("object");
      expect(Array.isArray(stepArgs.publish.searchArgv)).toBe(true);
      expect(stepArgs.publish.searchArgv.length).toBeGreaterThan(0);
      // searchArgv 안 --match 토큰 추출 가능(4번째 축 reachable).
      expect(stepArgs.publish.searchArgv).toContain("--match");
      expect(
        extractSearchMarker(stepArgs.publish.searchArgv).length,
      ).toBeGreaterThan(0);
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

  describe("aggregator-publish 내부 marker 3-축 일치(branch — 핵심 불변식 1, 본 task 의 새 표면)", () => {
    it("(b) extractSearchMarker(stepArgs.publish.searchArgv) === stepArgs.publish.report.descriptor.marker === stepArgs.publish.commandArgs.searchQuery — 세 내부 marker 축이 byte-identical(실 검색 인자 벡터 marker = descriptor.marker = commandArgs.searchQuery, 실 검색 토큰 drift 0)", () => {
      const { stepArgs } = runChain([7, 13]);

      const descriptorMarker = stepArgs.publish.report.descriptor.marker;
      // 축 1 ↔ 축 2 — commandArgs.searchQuery 가 descriptor.marker 를 그대로 운반.
      expect(stepArgs.publish.commandArgs.searchQuery).toBe(descriptorMarker);
      // 축 3 ↔ 축 1 — searchArgv 의 --match 다음 토큰이 descriptor.marker 와 byte-identical
      // (live runner 가 gh 검색에 실제로 거는 인자 벡터의 marker).
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

  describe("marker → resolve issueNumber 수렴(branch — 핵심 불변식 2)", () => {
    it("(c) search hit N → resolve.action.update.issueNumber → outcome step-args.issueNumber 세 지점 모두 동일 N + url 에 /issues/N(resolve↔post 경계 drift 0)", () => {
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

  describe("단일 runPlan aggregator·post threading run-identity 수렴(branch — 핵심 불변식 3)", () => {
    it("(d) 동일 runPlan 한 객체를 aggregator·post 두 곳에 넘김(재전달 0) → stepArgs.publish.report.descriptor.marker run token(따라서 searchArgv --match 토큰에도) ↔ outcomeReport.{gitSha,dateToken,summaryLine} 동일 run-identity(aggregator·searchArgv 통과 후에도 resolve 경계 가로지름, pre↔post drift 0)", () => {
      const runPlan = buildRunPlan();
      const { stepArgs, outcomeReport } = runChain([7, 13], runPlan);
      const token = expectedToken(runPlan.run);

      // pre boundary — aggregator publish leg 산출 marker(= searchArgv --match 토큰) 안 run token.
      expect(stepArgs.publish.report.descriptor.marker).toContain(token);
      expect(extractSearchMarker(stepArgs.publish.searchArgv)).toContain(token);
      // post boundary — post step-args 컴포저 run-identity 전파(동일 runPlan.run 도출).
      expect(outcomeReport.gitSha).toBe(runPlan.run.gitSha);
      expect(outcomeReport.dateToken).toBe(runPlan.run.dateToken);
      expect(outcomeReport.summaryLine).toContain(runPlan.run.gitSha);
      expect(outcomeReport.summaryLine).toContain(runPlan.run.dateToken);
    });
  });

  describe("4-way 단일-source 묶음 단언(branch — closure 종단, 본 task 의 명시적 박제)", () => {
    it("(e) searchArgv --match 토큰 == descriptor.marker == commandArgs.searchQuery, 그 marker 로 resolve 가 찾은 N == post 가 해석한 N, 그 marker 의 run token == post 가 전파한 {gitSha,dateToken} 가 단일 runPlan single-source 에서 4-way 동시 성립", () => {
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

      // axis 1 — marker 3-축 byte-identical(descriptor.marker = commandArgs.searchQuery
      //          = searchArgv --match 토큰).
      expect(stepArgs.publish.commandArgs.searchQuery).toBe(marker);
      expect(extractSearchMarker(stepArgs.publish.searchArgv)).toBe(marker);
      // axis 2 — 그 marker 로 resolve 가 찾은 N == post 가 해석한 N.
      expect(resolvePlan.action.issueNumber).toBe(N);
      expect(outcomeReport.issueNumber).toBe(N);
      // axis 3 — 그 marker 의 run token == post 가 전파한 {gitSha,dateToken}.
      expect(marker).toContain(token);
      expect(outcomeReport.gitSha).toBe(runPlan.run.gitSha);
      expect(outcomeReport.dateToken).toBe(runPlan.run.dateToken);
      // 4-way 동시 closure — 단일 runPlan single-source 에서 네 축이 한 chain 으로 묶임.
      expect(`${runPlan.run.dateToken}@${runPlan.run.gitSha}`).toBe(token);
    });
  });

  describe("create 분기 격리(branch — 검색 미스 → create, searchArgv·post 무관)", () => {
    it("(f) 빈 hit search stdout('[]') → resolve.action 이 create 분기(action.update 부재) — searchArgv 의 --match marker 는 create/update 두 분기 모두 동일(검색 결과가 검색 인자 벡터를 바꾸지 0), post 는 여전히 execStdout 의 N 으로 issueNumber 산출(누설 0)", () => {
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

      // update 분기(같은 marker hit) — searchArgv 의 --match marker 는 두 분기 모두 동일.
      const resolveUpdate = resolveRealDataResultIssueGhCommandPlan(
        multiHitStdout(marker, [7, 13]),
        stepArgs.publish.commandArgs,
      );
      expect(resolveUpdate.action.action).toBe("update");
      // searchArgv --match marker 는 검색 결과(create/update)와 무관하게 동일 — 검색 인자
      // 벡터는 검색 결과에 의존하지 않는다.
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

  describe("runPlan.run 변별성(branch — 다른 run→다른 marker+searchArgv, 같은 runPlan→4-way 수렴)", () => {
    it("(g) runPlan_A vs runPlan_B → 각 chain 의 extractSearchMarker(searchArgv) / descriptor.marker / outcomeReport.{gitSha,dateToken} 가 run 별 분리 수렴(각 chain 안에서 searchArgv-marker/descriptor.marker/post run-identity 일치), issueNumber N 은 두 chain 동일(search-stdout 종속, run 무관)", () => {
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

      // chain A — searchArgv-marker / descriptor.marker / post run-identity 각각 run_A 로 일치.
      const markerA = chainA.stepArgs.publish.report.descriptor.marker;
      expect(extractSearchMarker(chainA.stepArgs.publish.searchArgv)).toBe(
        markerA,
      );
      expect(markerA).toContain(expectedToken(runPlanA.run));
      expect(chainA.outcomeReport.gitSha).toBe(runPlanA.run.gitSha);
      expect(chainA.outcomeReport.dateToken).toBe(runPlanA.run.dateToken);

      // chain B — 동형으로 run_B 로 일치.
      const markerB = chainB.stepArgs.publish.report.descriptor.marker;
      expect(extractSearchMarker(chainB.stepArgs.publish.searchArgv)).toBe(
        markerB,
      );
      expect(markerB).toContain(expectedToken(runPlanB.run));
      expect(chainB.outcomeReport.gitSha).toBe(runPlanB.run.gitSha);
      expect(chainB.outcomeReport.dateToken).toBe(runPlanB.run.dateToken);

      // 두 chain 의 marker / searchArgv-marker 가 서로 분리(다른 run → 다른 4-way chain).
      expect(markerA).not.toBe(markerB);
      expect(extractSearchMarker(chainA.stepArgs.publish.searchArgv)).not.toBe(
        extractSearchMarker(chainB.stepArgs.publish.searchArgv),
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

  describe("activities·results 무관 — 4-way 수렴 격리(branch — partial-thread 격리)", () => {
    it("(h) 동일 runPlan·동일 N, activities·results 분포만 다르게 두 chain → extractSearchMarker(searchArgv) / descriptor.marker / commandArgs.searchQuery / resolve.action.update.issueNumber / outcomeReport.{issueNumber,gitSha,dateToken} 두 경우 동일, stepArgs.publish.report.descriptor.body 만 달라야 함", () => {
      const runPlan = buildRunPlan();
      const firstUsername =
        buildRealDataE2eSeed()[0].serviceIdentities[0].externalId;
      const activitiesA: GithubActivity[] = [
        syntheticActivity(firstUsername, "aggregator-publish-searchargv-a1"),
      ];
      const activitiesB: GithubActivity[] = [
        syntheticActivity(firstUsername, "aggregator-publish-searchargv-b1"),
        syntheticActivity(firstUsername, "aggregator-publish-searchargv-b2"),
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

      // searchArgv-marker / descriptor.marker / commandArgs.searchQuery — activities·results
      // 변경 누설 0(동일).
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

      // descriptor.body 는 results 본문 반영 — 두 경우 달라야 함(다른 축은 불변).
      expect(chainA.stepArgs.publish.report.descriptor.body).not.toBe(
        chainB.stepArgs.publish.report.descriptor.body,
      );
    });
  });

  describe("error path / negative cases — 네 boundary 거부 대칭 박제", () => {
    it("(i) runPlan.run.gitSha 빈('') → aggregator(buildRealDataE2eStepArgs) 측 publish 위임 report-plan assertNonBlank('gitSha') throw(chain 시작 비식별 — searchArgv 도 합성 안 됨)", () => {
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

    it("(i') runPlan.run.gitSha 공백-only('   ') → aggregator측 publish 위임 throw 대칭", () => {
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

    it("(j) runPlan.run.dateToken 빈('') → aggregator측 publish 위임 assertNonBlank('dateToken') throw 대칭(searchArgv 미합성)", () => {
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

    it("(k) runPlan.run.gitSha 빈('') → post(buildRealDataResultOutcomeStepArgs) 측 위임 빌더 assertNonBlank throw(post boundary 종단 비식별 — execStdout URL 정상이어도 차단, aggregator/post 대칭)", () => {
      const runPlan = buildRunPlan();
      const blankRunPlan: RealDataE2eRunPlan = {
        pipeline: runPlan.pipeline,
        run: { gitSha: "", dateToken: "2026-06-29" },
      };
      expect(() =>
        buildRealDataResultOutcomeStepArgs(blankRunPlan, execStdout(7)),
      ).toThrow();
    });

    it("(l) searchStdout 비JSON('not json') → resolve parse 위임 throw(stepArgs.publish.commandArgs.searchQuery·searchArgv 정상이어도 hits 추출 실패로 차단)", () => {
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

    it("(l') searchStdout 비배열('{}') → resolve parse 위임 throw 대칭", () => {
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

    it("(m) execStdout URL 미발견(빈 문자열) → post parse 위임 throw(runPlan.run 정상이어도 outcome 추출 실패)", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(buildRunPlan(), ""),
      ).toThrow();
    });

    it("(m') execStdout 무관 텍스트('no url here') → post parse 위임 throw 대칭", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(buildRunPlan(), "no url here"),
      ).toThrow();
    });

    it("(n) execStdout /issues/0 → post assertPositiveIssueNumber throw(post 비식별)", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(
          buildRunPlan(),
          `https://github.com/${OWNER}/${REPO}/issues/0\n`,
        ),
      ).toThrow();
    });

    it("(n') execStdout /issues/abc(비숫자) → post URL 패턴 미매칭 throw(post 비식별)", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(
          buildRunPlan(),
          `https://github.com/${OWNER}/${REPO}/issues/abc\n`,
        ),
      ).toThrow();
    });
  });

  describe("결정론·무공유·no-mutation — chain 두 번 호출 + 입력 불변 + 무공유", () => {
    it("(o) 동일 (runPlan, activities, results, searchStdout, execStdout) chain 두 번 → stepArgs.publish(searchArgv 포함)/resolvePlan/outcomeReport 모두 deep-equal(결정론)", () => {
      const runPlan = buildRunPlan();
      const activities = defaultActivities();
      const results = defaultResults();
      const chain1 = runChain([7, 13], runPlan, activities, results);
      const chain2 = runChain([7, 13], runPlan, activities, results);

      expect(chain1.stepArgs.publish).toEqual(chain2.stepArgs.publish);
      expect(chain1.stepArgs.publish.searchArgv).toEqual(
        chain2.stepArgs.publish.searchArgv,
      );
      expect(chain1.resolvePlan).toEqual(chain2.resolvePlan);
      expect(chain1.outcomeReport).toEqual(chain2.outcomeReport);
    });

    it("(p) no-mutation — 입력 runPlan(특히 aggregator/post 두 곳이 같은 runPlan 을 공유 읽기)·activities·results chain 호출 전후 deep-equal(원본 불변)", () => {
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

    it("(q) 무공유 — 각 stage 산출물이 입력 runPlan 과 referential identity 분리(not.toBe), searchArgv 도 새 배열, 필드는 전파", () => {
      const runPlan = buildRunPlan();
      const { stepArgs, outcomeReport } = runChain([7, 13], runPlan);

      expect(stepArgs).not.toBe(runPlan);
      expect(stepArgs.publish).not.toBe(runPlan);
      expect(stepArgs.publish.searchArgv).not.toBe(runPlan);
      expect(outcomeReport).not.toBe(runPlan);
      expect(outcomeReport).not.toBe(runPlan.run);
      expect(outcomeReport.gitSha).toBe(runPlan.run.gitSha);
      expect(outcomeReport.dateToken).toBe(runPlan.run.dateToken);
    });
  });

  describe("credential 누출 0(branch — §9 / R-59 / REQ-059 정합)", () => {
    it("(r) stepArgs.publish.searchArgv(배열 각 원소) · stepArgs.publish.commandArgs.searchQuery · stepArgs.publish.report.descriptor.{title,marker,body} · resolvePlan.argv · outcomeReport.{url,summaryLine} 어디에도 token/secret/PAT/--auth 어휘 미등장", () => {
      const { stepArgs, resolvePlan, outcomeReport } = runChain([7, 13]);

      const surfaces: string[] = [
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
