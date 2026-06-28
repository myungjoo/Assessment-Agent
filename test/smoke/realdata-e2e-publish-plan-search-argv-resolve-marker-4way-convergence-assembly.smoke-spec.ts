// realdata-e2e-publish-plan-search-argv-resolve-marker-4way-convergence-assembly.smoke-spec.ts —
// 실 평가 e2e step④ pre-execution publish-plan↔search-argv↔resolve↔descriptor marker
// 4자 cross-stage 수렴 non-gated build-time smoke (T-0766 박제, PLAN.md 109행
// 🟢 실 평가 e2e step ④).
//
// 본 spec 의 존재 이유 — public CI gap 해소(publish-plan 진입 + resolve 소비 합류):
//   - PLAN 109행 step ④(결과 이슈 박제) 의 pre-execution 조립 chain 에서 **marker 식별
//     토큰이 모든 조립 stage 를 통과해도 byte-identical 로 유지**됨이 핵심 불변식이다.
//     pre-execution marker chain 은 4 stage 로 나뉜다:
//       (stage 1) descriptor(`buildRealDataResultIssueDescriptor(...).marker`) — 결정론
//                 멱등 marker 토큰(결과 이슈 body 안 안정 식별자).
//       (stage 2) command-args(`commandArgs.searchQuery`) — descriptor.marker 를 그대로
//                 옮긴 멱등 검색 토큰.
//       (stage 3) publish-plan 종단 composer(`buildRealDataResultIssuePublishPlan(
//                 results, run).searchArgv`) — runner 가 `execFile('gh', searchArgv)` 로
//                 실행할 첫 gh 명령 argv, 그 안에 searchQuery=marker 가 단일 argv 원소.
//       (stage 4) resolver(`resolveRealDataResultIssueGhCommandPlan(stdout,
//                 publishPlan.commandArgs)`) — `commandArgs.searchQuery` 를 marker 로
//                 소비해 action 결정.
//   - 이 4 stage 가 동일 marker 토큰으로 byte-identical 수렴해야 — 어느 조립 단계에서도
//     marker drift 0 — search-or-update 멱등성(REQ-009) + 결과 리포트 재실행 정합
//     (REQ-037) 양쪽이 cross-stage 로 보호된다. 어느 한 leg drift 시(예: publish-plan 의
//     searchArgv 가 commandArgs.searchQuery 와 다른 토큰 박거나, resolver 가
//     publishPlan.commandArgs 와 다른 searchQuery 소비) — 검색 argv 와 resolver 가
//     서로 다른 marker 를 보고 멱등 매칭이 깨진다(stale marker swap drift).
//   - 기존 sweep 은 marker 축을 부분적으로만 닫았다:
//     · T-0758(search-resolve-roundtrip): marker 축 3자(search-argv↔resolve↔descriptor)
//       — `buildRealDataResultIssueSearchGhArgv(commandArgs)` 로 직접 진입, publish-plan
//       composer 미통과(cross-composer 단언 부재).
//     · T-0764/T-0765(issueNumber 축 post-execution): marker 축 아님.
//     · publish-plan-tri-leg(T-0755): publish↔command-plan↔search-argv 3-leg, resolver
//       leg 미합류.
//   - 본 spec 은 T-0758 의 자연 후속 — **publish-plan 진입 leg 를 marker chain 에 합류
//     시켜 descriptor.marker → commandArgs.searchQuery → publishPlan.searchArgv →
//     resolve(publishPlan.commandArgs).searchQuery 의 4자 byte-identical cross-stage
//     수렴** 을 단일 smoke 안에서 묶어 박제한다. pre-execution marker 축의 issueNumber
//     축 T-0765 대칭 — publish-plan 종단 composer 와 resolver 를 동일 source(results +
//     run) 로 동시-호출해 marker 식별자가 cross-composer 로 손실 0 임을 박제하는 마지막
//     그물이다.
//   - 본 spec 은 **gating 없이 항상 실행되는 일반 describe** 로 순수 build-time
//     in-memory 검증만 한다. live leg(실 prisma·실 collectForPerson·실 github.com
//     fetch·실 LLM scoring·실 gh CLI 실행·DB·LAN gate) 복제 0. 따라서 본 spec 은:
//
//      🔥 실 gh 호출 0 — gh search / create / edit / execFile('gh', argv) 미실행.
//         synthetic EvaluationResult literal + synthetic stdout literal 만 사용.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 LLM 호출 0 / 실 DB 접근 0 / 실 prisma 0 / 실 jest spawn 0 — pre-execution
//         조립 surface 만 검증.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 4 helper(publish-plan/search-argv/gh-command-plan/
//         descriptor) import 재사용만(컴포저/가드/helper 신설 0).
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Marker source 축(분석 결과 — 본 spec 의 변별 입력 축 결정 근거):
//   - `realdata-e2e-result-issue-descriptor.ts` L93 `runToken(run)` =
//     `${run.dateToken}@${run.gitSha}` AND L129 `marker = ${ISSUE_MARKER_PREFIX} ${token}
//     -->` — marker 는 **run 축 의존**(results 무관). 따라서 본 spec 의 변별 axis:
//     · "다른 marker → 다른 4자 수렴" 변별성 단언 = **run 축 변별**(다른 gitSha →
//       다른 marker → 다른 4자 chain).
//     · "marker 4자 수렴 격리" 단언 = **results 축 격리**(동일 run 고정 + 다른 results
//       → marker M 동일, 단 publishPlan.report.summary 의 count 만 변함). T-0755
//       tri-leg sibling 의 "다른 results → marker 동일·count 변함" 패턴 mirror.
//
// Out of Scope (T-0766):
//   - src 변경 0(src/, prisma/, package.json, CI workflow, 환경 변수 추가 등 모두 금지).
//     test-only.
//   - 실 gh CLI 호출 / `execFile('gh', argv)` 실행 / 실 issue 검색·박제(step④ live wiring
//     — credential gate, deferred). 본 task 는 in-memory 합성 stdout 만.
//   - issueNumber 축 post-execution 수렴(search-hit.minNumber↔resolve↔parse↔outcome-
//     report) 재단언(T-0764/T-0765 cover). 본 task 는 marker 축 pre-execution 만.
//   - T-0758 의 search-argv↔resolve↔descriptor 3자 marker roundtrip 자체 재단언
//     (T-0758 cover). 본 task 는 publish-plan 진입 leg 합류로 4자 확장 부분(publishPlan.
//     searchArgv === refArgv cross-composer 수렴 + resolve 가 publishPlan.commandArgs
//     소비) 만 새로 단언.
//   - publish↔command-plan↔search-argv 조립 3-leg 정합 자체 재단언(publish-plan-tri-leg
//     smoke cover). 본 task 는 resolve leg 합류만.
//   - publishPlan 의 report/commandArgs/searchArgv 개별 필드 shape 정합 재단언(T-0729
//     cover). 본 task 는 marker 의 cross-stage 4자 수렴만.
//   - DB 의존(prisma client·테스트 DB·migration) 0 — 본 spec 은 DB-free.
//   - live-LLM·실 fetch·실 collectForPerson 의존 0.
//   - 새 helper 모듈 신설 금지(test/helpers/ 변경 0). 기존 4 helper 의 export 를 그대로
//     import 만.
//   - gating / describe.skip / `if (process.env.REAL_E2E ...)` 분기 0 — non-gated 항상 실행.

import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";
import type { RealDataResultIssueRunRef } from "../helpers/realdata-e2e-result-issue-descriptor";
import { resolveRealDataResultIssueGhCommandPlan } from "../helpers/realdata-e2e-result-issue-gh-command-plan";
import { buildRealDataResultIssuePublishPlan } from "../helpers/realdata-e2e-result-issue-publish-plan";
import { buildRealDataResultIssueSearchGhArgv } from "../helpers/realdata-e2e-result-issue-search-argv";

// 결정론 run 식별자 fixture(비공백 — gitSha/dateToken guard 비자극). publish-plan
// 진입의 marker 합성은 run 축 의존이라 본 fixture 가 marker M 의 source 다.
const RUN_REF: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-06-29",
};

// 매 it 가 새 RUN_REF 복사본 — 입력-무공유 단언이 fixture 상수를 오염시키지 않도록.
function freshRun(): RealDataResultIssueRunRef {
  return { ...RUN_REF };
}

// synthetic EvaluationResult 1 건 — publish 컴포저는 결과 배열을 요약 집계
// (count·분포·totalVolume) → descriptor → command-args → search-argv 로 흘려보내는
// surface 만 검증하므로, 도메인 타입 정합(difficulty / contribution 멤버십) 만족하는
// minimal literal 로 충분하다. 실 LLM 호출 없이 EvaluationResult shape 만 강제한다.
function syntheticResult(unitId: string, volume: number): EvaluationResult {
  return {
    unitId,
    narrative:
      "synthetic evaluation narrative — publish-plan resolve marker 4-way convergence smoke fixture",
    difficulty: "easy",
    contribution: "low",
    volume,
  };
}

// search argv 안 marker 추출 헬퍼 — 빌더 canonical shape (["search","issues","--match",
// "body",<marker>,"--json","number,title,body","--limit","30"]) 에서 marker 는 `--match
// body` 직후(index 4) 다. 위치 매직 넘버 대신 `--match` 기준 상대 추출(round-trip
// drift 강건). T-0758 sibling 헬퍼 패턴 mirror.
function extractSearchMarker(searchArgv: string[]): string {
  const matchIdx = searchArgv.indexOf("--match");
  if (matchIdx < 0) {
    throw new Error("search argv 에 --match 가 없습니다 — marker 추출 불가");
  }
  // `--match` <field=body> <marker> 순서 — marker 는 field 다음(matchIdx + 2).
  return searchArgv[matchIdx + 2];
}

// marker 를 body 에 포함한 hit 1+건 stdout 합성 헬퍼 — 동일 run 이슈가 이미 존재하는
// 경우(update 분기 유발). number 가 의도적으로 비정렬(33, 7, 19)이라 최소 number(7)
// 멱등 선택을 자극한다.
function multiHitStdout(marker: string): string {
  return JSON.stringify([
    { number: 33, title: "결과 이슈(최신)", body: `누적 본문\n${marker}\n끝` },
    { number: 7, title: "결과 이슈(최초)", body: `최초 본문\n${marker}\n끝` },
    { number: 19, title: "결과 이슈(중간)", body: `중간 본문\n${marker}\n끝` },
  ]);
}

// 후보 0건 stdout — gh search 가 매칭 이슈를 못 찾은 경우(빈 배열). create 분기 유발.
const EMPTY_STDOUT = "[]";

describe("Smoke(non-gated): 실 평가 e2e step④ pre-execution publish-plan↔search-argv↔resolve↔descriptor marker 4자 cross-stage 수렴", () => {
  describe("happy path — 4자 chain 합성", () => {
    it("단일 source(results+run) → publishPlan / refArgv / resolvePlan 세 산출물 모두 정상 shape 보유(4자 chain 정상 합성)", () => {
      const results = [
        syntheticResult("github:github.com:h1", 3),
        syntheticResult("github:github.com:h2", 5),
      ];
      const run = freshRun();
      const publishPlan = buildRealDataResultIssuePublishPlan(results, run);
      const refArgv = buildRealDataResultIssueSearchGhArgv(
        publishPlan.commandArgs,
      );
      const resolvePlan = resolveRealDataResultIssueGhCommandPlan(
        multiHitStdout(publishPlan.commandArgs.searchQuery),
        publishPlan.commandArgs,
      );

      // publishPlan shape — { report, commandArgs, searchArgv }.
      expect(publishPlan.report).toBeDefined();
      expect(publishPlan.commandArgs).toBeDefined();
      expect(Array.isArray(publishPlan.searchArgv)).toBe(true);
      expect(publishPlan.searchArgv.length).toBeGreaterThan(0);

      // refArgv shape — string[].
      expect(Array.isArray(refArgv)).toBe(true);
      expect(refArgv.length).toBeGreaterThan(0);

      // resolvePlan shape — { action, argv }.
      expect(typeof resolvePlan.action.action).toBe("string");
      expect(Array.isArray(resolvePlan.argv)).toBe(true);
    });
  });

  describe("cross-stage marker single-source 4자 수렴 (branch — 핵심 불변식)", () => {
    it("descriptor.marker → commandArgs.searchQuery → publishPlan.searchArgv → resolve 소비 marker 4 stage 가 동일 M 식별 token single-source 4자 수렴(stale/swap drift 0)", () => {
      const results = [syntheticResult("github:github.com:m1", 2)];
      const run = freshRun();
      const publishPlan = buildRealDataResultIssuePublishPlan(results, run);

      // M = stage 2 marker(= stage 1 descriptor.marker — command-args 가 그대로 옮김).
      const M = publishPlan.commandArgs.searchQuery;
      expect(M.length).toBeGreaterThan(0);

      // stage 2→3: publishPlan.searchArgv 안에 M 이 단일 argv 원소로 박힘.
      expect(publishPlan.searchArgv).toContain(M);
      // 정확히 1 회 등장(중복 0 — 단일 원소 thread).
      expect(
        publishPlan.searchArgv.filter((token) => token === M),
      ).toHaveLength(1);

      // stage 3 cross-composer 수렴: publishPlan.searchArgv === buildRealDataResult
      // IssueSearchGhArgv(publishPlan.commandArgs) deep-equal.
      const refArgv = buildRealDataResultIssueSearchGhArgv(
        publishPlan.commandArgs,
      );
      expect(publishPlan.searchArgv).toEqual(refArgv);

      // stage 3→4: resolve 가 publishPlan.commandArgs.searchQuery=M 을 marker 로 소비함을
      // action 결정(update — multi-hit stdout 매칭) + edit argv 안 updateArgs.body(marker
      // 보존) 로 박제.
      const resolvePlan = resolveRealDataResultIssueGhCommandPlan(
        multiHitStdout(M),
        publishPlan.commandArgs,
      );
      expect(resolvePlan.action.action).toBe("update");
      // update argv 안에 M 이 그대로 박혀있음(updateArgs.body = descriptor.body =
      // marker-first → marker 토큰 M 보존).
      expect(resolvePlan.argv.some((token) => token.includes(M))).toBe(true);
    });

    it("descriptor.marker(stage 1) === commandArgs.searchQuery(stage 2) — command-args 가 marker 를 그대로 옮김(byte-identical)", () => {
      const results = [syntheticResult("github:github.com:m2", 1)];
      const run = freshRun();
      const publishPlan = buildRealDataResultIssuePublishPlan(results, run);

      // descriptor.marker 는 publishPlan.report 의 descriptor 안 marker 와 정합해야
      // 한다(stage 1). 본 spec 에서는 stage 1 토큰을 publishPlan.report 의 descriptor
      // 측 직접 접근 대신, 합성 source(run) 로부터 재유도한 expected marker prefix +
      // run token 으로 검증한다(helper 의 marker 합성 형태 unchanged 회귀 catch).
      const expectedMarkerSuffix = `${run.dateToken}@${run.gitSha} -->`;
      expect(
        publishPlan.commandArgs.searchQuery.endsWith(expectedMarkerSuffix),
      ).toBe(true);
      // stage 1→2 byte-identical: commandArgs.searchQuery 가 marker 자체.
      const searchMarker = extractSearchMarker(publishPlan.searchArgv);
      expect(searchMarker).toBe(publishPlan.commandArgs.searchQuery);
    });
  });

  describe("searchArgv → resolve argv 매체-경유 marker 일치 (branch — argv-mediated 수렴)", () => {
    it("동일 M 이 publishPlan.searchArgv / refArgv / resolve 소비(update argv body) 3 매체 모두에 박힘 — argv-mediated 수렴 byte-identical", () => {
      const results = [syntheticResult("github:github.com:am1", 4)];
      const run = freshRun();
      const publishPlan = buildRealDataResultIssuePublishPlan(results, run);
      const M = publishPlan.commandArgs.searchQuery;
      const refArgv = buildRealDataResultIssueSearchGhArgv(
        publishPlan.commandArgs,
      );
      const resolvePlan = resolveRealDataResultIssueGhCommandPlan(
        multiHitStdout(M),
        publishPlan.commandArgs,
      );

      // 첫 gh 명령 argv(publishPlan.searchArgv) 안 M.
      expect(publishPlan.searchArgv).toContain(M);
      // reference argv 안 M(동일 위치 — extractSearchMarker 가 양쪽 동일하게 위치 잡음).
      expect(refArgv).toContain(M);
      expect(extractSearchMarker(publishPlan.searchArgv)).toBe(
        extractSearchMarker(refArgv),
      );
      // resolver 가 hits 를 M marker 로 매칭해 update 분기 — M 매칭 hit 존재 시 update.
      expect(resolvePlan.action.action).toBe("update");
      if (resolvePlan.action.action !== "update") {
        throw new Error("update action 기대");
      }
      // 최소 hit number(7) 멱등 선택.
      expect(resolvePlan.action.issueNumber).toBe(7);
      // resolve 산출 argv 안 update body 가 M 을 포함(updateArgs.body = marker-first).
      expect(resolvePlan.argv.some((token) => token.includes(M))).toBe(true);
    });
  });

  describe("결과 분포 변별성 (branch — run 축 변별, 다른 run→다른 marker→다른 4자 chain)", () => {
    it("다른 run(gitSha 변경, results 고정) → marker M_A ≠ M_B AND 두 chain 의 4 stage 가 각각 M_A 4자 / M_B 4자 로 분리 수렴", () => {
      const results = [syntheticResult("github:github.com:v1", 3)];
      const runA: RealDataResultIssueRunRef = {
        gitSha: "abc1234",
        dateToken: "2026-06-29",
      };
      const runB: RealDataResultIssueRunRef = {
        gitSha: "def5678",
        dateToken: "2026-06-29",
      };
      const planA = buildRealDataResultIssuePublishPlan(results, runA);
      const planB = buildRealDataResultIssuePublishPlan(results, runB);
      const M_A = planA.commandArgs.searchQuery;
      const M_B = planB.commandArgs.searchQuery;

      // 다른 run → 다른 marker(marker 축이 run 의존).
      expect(M_A).not.toBe(M_B);

      // chain A 의 4 stage 가 M_A 로 수렴.
      expect(planA.searchArgv).toContain(M_A);
      expect(planA.searchArgv).not.toContain(M_B);
      const refArgvA = buildRealDataResultIssueSearchGhArgv(planA.commandArgs);
      expect(planA.searchArgv).toEqual(refArgvA);
      const resolvePlanA = resolveRealDataResultIssueGhCommandPlan(
        multiHitStdout(M_A),
        planA.commandArgs,
      );
      expect(resolvePlanA.action.action).toBe("update");

      // chain B 의 4 stage 가 M_B 로 수렴(M_A 와 분리).
      expect(planB.searchArgv).toContain(M_B);
      expect(planB.searchArgv).not.toContain(M_A);
      const refArgvB = buildRealDataResultIssueSearchGhArgv(planB.commandArgs);
      expect(planB.searchArgv).toEqual(refArgvB);
      const resolvePlanB = resolveRealDataResultIssueGhCommandPlan(
        multiHitStdout(M_B),
        planB.commandArgs,
      );
      expect(resolvePlanB.action.action).toBe("update");

      // cross: chain A 의 stdout(M_A) 을 chain B 의 commandArgs(M_B) 로 매칭 시도 →
      // M_B 미포함 stdout 이라 hit 0 → create 분기(stale marker swap 회귀 차단).
      const crossPlan = resolveRealDataResultIssueGhCommandPlan(
        multiHitStdout(M_A),
        planB.commandArgs,
      );
      expect(crossPlan.action.action).toBe("create");
    });
  });

  describe("results-axis 무관 — marker 4자 수렴 격리 (branch — partial-thread 격리)", () => {
    it("동일 run + 다른 results → marker M 동일(stage 2~3 invariant) AND publishPlan.report.summary.count 만 변함(report leg 자기 영역 정상 전파)", () => {
      // marker 축은 run 의존(results 무관) — descriptor 합성 분석 결과.
      const run = freshRun();
      const resultsA = [syntheticResult("github:github.com:i1", 2)];
      const resultsB = [
        syntheticResult("github:github.com:i2", 3),
        syntheticResult("github:github.com:i3", 6),
      ];
      const planA = buildRealDataResultIssuePublishPlan(resultsA, run);
      const planB = buildRealDataResultIssuePublishPlan(resultsB, run);

      const M_A = planA.commandArgs.searchQuery;
      const M_B = planB.commandArgs.searchQuery;
      // marker 격리: results 변경이 marker 축에 누설 0(byte-identical).
      expect(M_A).toBe(M_B);

      // publishPlan.searchArgv 안 marker 도 동일.
      expect(extractSearchMarker(planA.searchArgv)).toBe(
        extractSearchMarker(planB.searchArgv),
      );

      // resolve 소비 marker 도 동일(같은 commandArgs.searchQuery 단일 의존).
      const resolvePlanA = resolveRealDataResultIssueGhCommandPlan(
        multiHitStdout(M_A),
        planA.commandArgs,
      );
      const resolvePlanB = resolveRealDataResultIssueGhCommandPlan(
        multiHitStdout(M_B),
        planB.commandArgs,
      );
      expect(resolvePlanA.action.action).toBe("update");
      expect(resolvePlanB.action.action).toBe("update");

      // 단 report leg 의 summary.count 는 results 변화를 정상 전파(자기 영역).
      expect(planA.report.summary.count).not.toBe(planB.report.summary.count);
      expect(planA.report.summary.count).toBe(1);
      expect(planB.report.summary.count).toBe(2);
    });
  });

  describe("searchStdout 무관 — resolve 소비 marker 격리 (branch — partial-thread 격리, 두 번째 축)", () => {
    it("동일 publishPlan(= 동일 M) 고정 + 다른 searchStdout(hit 0건 → create / hit 2건 → update) → action 분기 달라지나 marker token 자체는 두 경우 동일 M(publishPlan.commandArgs.searchQuery 단일 의존)", () => {
      const results = [syntheticResult("github:github.com:s1", 5)];
      const run = freshRun();
      const publishPlan = buildRealDataResultIssuePublishPlan(results, run);
      const M = publishPlan.commandArgs.searchQuery;

      // stdout A: 빈 배열 → create 분기.
      const resolvePlanCreate = resolveRealDataResultIssueGhCommandPlan(
        EMPTY_STDOUT,
        publishPlan.commandArgs,
      );
      expect(resolvePlanCreate.action.action).toBe("create");

      // stdout B: M 포함 multi-hit → update 분기.
      const resolvePlanUpdate = resolveRealDataResultIssueGhCommandPlan(
        multiHitStdout(M),
        publishPlan.commandArgs,
      );
      expect(resolvePlanUpdate.action.action).toBe("update");

      // 두 경우 모두 publishPlan.commandArgs.searchQuery(= M) 가 단일 source —
      // searchStdout 변경이 marker token 에 누설 0(commandArgs 그대로 두 호출에 전달).
      expect(publishPlan.commandArgs.searchQuery).toBe(M);
      // create argv 의 createArgs.body 안에도 M 보존(marker-first).
      expect(resolvePlanCreate.argv.some((token) => token.includes(M))).toBe(
        true,
      );
      // update argv 의 updateArgs.body 안에도 M 보존(marker-first).
      expect(resolvePlanUpdate.argv.some((token) => token.includes(M))).toBe(
        true,
      );
    });
  });

  describe("flow / branch — create vs update 분기 분리 + 빈 results 경계", () => {
    it("빈 stdout('[]') → resolve action=create AND argv[1]==='create' (M 미포함 hit 없음 → 신규 생성)", () => {
      const results = [syntheticResult("github:github.com:f1", 1)];
      const publishPlan = buildRealDataResultIssuePublishPlan(
        results,
        freshRun(),
      );
      const resolvePlan = resolveRealDataResultIssueGhCommandPlan(
        EMPTY_STDOUT,
        publishPlan.commandArgs,
      );
      expect(resolvePlan.action.action).toBe("create");
      expect(resolvePlan.argv[0]).toBe("issue");
      expect(resolvePlan.argv[1]).toBe("create");
      expect(resolvePlan.argv).not.toContain("edit");
    });

    it("M 포함 multi-hit stdout → resolve action=update AND argv[1]==='edit' AND issueNumber=최소(7) 멱등 선택", () => {
      const results = [syntheticResult("github:github.com:f2", 1)];
      const publishPlan = buildRealDataResultIssuePublishPlan(
        results,
        freshRun(),
      );
      const resolvePlan = resolveRealDataResultIssueGhCommandPlan(
        multiHitStdout(publishPlan.commandArgs.searchQuery),
        publishPlan.commandArgs,
      );
      expect(resolvePlan.action.action).toBe("update");
      if (resolvePlan.action.action !== "update") {
        throw new Error("update action 기대");
      }
      expect(resolvePlan.action.issueNumber).toBe(7);
      expect(resolvePlan.argv[0]).toBe("issue");
      expect(resolvePlan.argv[1]).toBe("edit");
      expect(resolvePlan.argv[2]).toBe("7");
      expect(resolvePlan.argv).not.toContain("create");
    });

    it("빈 results([]) + 유효 run → publishPlan 정상 합성(throw 0) AND 4자 chain 정상 — count 0 / marker M 정상 산출 / 4자 수렴 유지", () => {
      // helper 분석: 빈 results 는 throw 하지 않음 — report.summary.count=0 으로 정상
      // 합성, commandArgs/searchArgv 도 run 식별자로 정상 도출. T-0755 tri-leg sibling
      // 의 동형 분기 확인 ("빈 results + 유효 run → throw 0").
      const run = freshRun();
      const publishPlan = buildRealDataResultIssuePublishPlan([], run);
      expect(publishPlan.report.summary.count).toBe(0);
      expect(publishPlan.commandArgs.searchQuery.length).toBeGreaterThan(0);
      expect(publishPlan.searchArgv.length).toBeGreaterThan(0);

      // 빈 results 에서도 4자 chain 정합 유지.
      const M = publishPlan.commandArgs.searchQuery;
      expect(publishPlan.searchArgv).toContain(M);
      const refArgv = buildRealDataResultIssueSearchGhArgv(
        publishPlan.commandArgs,
      );
      expect(publishPlan.searchArgv).toEqual(refArgv);
      const resolvePlan = resolveRealDataResultIssueGhCommandPlan(
        EMPTY_STDOUT,
        publishPlan.commandArgs,
      );
      expect(resolvePlan.action.action).toBe("create");
    });
  });

  describe("negative cases — 각 leg 의 marker 식별자 거부 대칭 박제(defense-in-depth)", () => {
    it("(a) publishPlan.commandArgs.searchQuery 빈 문자열 강제 → buildRealDataResultIssueSearchGhArgv 의 assertSearchQueryNonBlank throw(stage 3 차단, marker 비식별)", () => {
      const results = [syntheticResult("github:github.com:n1", 1)];
      const publishPlan = buildRealDataResultIssuePublishPlan(
        results,
        freshRun(),
      );
      const tampered = {
        ...publishPlan.commandArgs,
        searchQuery: "",
      };
      expect(() => buildRealDataResultIssueSearchGhArgv(tampered)).toThrow();
    });

    it("(a') publishPlan.commandArgs.searchQuery 공백-only 강제 → search-argv throw(stage 3 차단)", () => {
      const results = [syntheticResult("github:github.com:n2", 1)];
      const publishPlan = buildRealDataResultIssuePublishPlan(
        results,
        freshRun(),
      );
      const tampered = {
        ...publishPlan.commandArgs,
        searchQuery: "   ",
      };
      expect(() => buildRealDataResultIssueSearchGhArgv(tampered)).toThrow();
    });

    it("(b) 동일 빈 searchQuery 강제 commandArgs → resolveRealDataResultIssueGhCommandPlan throw 전파(stage 4 차단 — search-argv 와 resolver 양쪽 독립 guard 보유 박제, defense-in-depth)", () => {
      const results = [syntheticResult("github:github.com:n3", 1)];
      const publishPlan = buildRealDataResultIssuePublishPlan(
        results,
        freshRun(),
      );
      const tampered = {
        ...publishPlan.commandArgs,
        searchQuery: "",
      };
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(EMPTY_STDOUT, tampered),
      ).toThrow();
    });

    it("(b') 동일 공백-only searchQuery 강제 → resolve throw 전파(stage 4 차단, resolver 비식별)", () => {
      const results = [syntheticResult("github:github.com:n4", 1)];
      const publishPlan = buildRealDataResultIssuePublishPlan(
        results,
        freshRun(),
      );
      const tampered = {
        ...publishPlan.commandArgs,
        searchQuery: "   ",
      };
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(EMPTY_STDOUT, tampered),
      ).toThrow();
    });

    it("(c) run.gitSha 빈/공백 → publishPlan 의 하위 report-plan throw 전파(stage 3 미도달, searchArgv 단계 이전 차단)", () => {
      const results = [syntheticResult("github:github.com:n5", 1)];
      expect(() =>
        buildRealDataResultIssuePublishPlan(results, {
          gitSha: "",
          dateToken: "2026-06-29",
        }),
      ).toThrow(/gitSha/);
      expect(() =>
        buildRealDataResultIssuePublishPlan(results, {
          gitSha: "   ",
          dateToken: "2026-06-29",
        }),
      ).toThrow(/gitSha/);
    });

    it("(d) run.dateToken 빈/공백 → publishPlan 측 throw 대칭(stage 3 미도달)", () => {
      const results = [syntheticResult("github:github.com:n6", 1)];
      expect(() =>
        buildRealDataResultIssuePublishPlan(results, {
          gitSha: "abc1234",
          dateToken: "",
        }),
      ).toThrow(/dateToken/);
      expect(() =>
        buildRealDataResultIssuePublishPlan(results, {
          gitSha: "abc1234",
          dateToken: "   ",
        }),
      ).toThrow(/dateToken/);
    });

    it("(e) searchStdout 비JSON('not-json') → resolve leg parse-search 위임 throw(stage 4 미진입, marker 매칭 불가)", () => {
      const results = [syntheticResult("github:github.com:n7", 1)];
      const publishPlan = buildRealDataResultIssuePublishPlan(
        results,
        freshRun(),
      );
      expect(() =>
        resolveRealDataResultIssueGhCommandPlan(
          "not-json",
          publishPlan.commandArgs,
        ),
      ).toThrow();
    });
  });

  describe("결정론·무공유·no-mutation — chain 두 번 호출 + 입력 불변", () => {
    it("동일 (results, run, searchStdout) → chain 두 번 호출 → publishPlan / refArgv / resolvePlan 모두 deep-equal(byte-identical)", () => {
      const results = [
        syntheticResult("github:github.com:d1", 3),
        syntheticResult("github:github.com:d2", 6),
      ];
      const stdoutFor = (m: string) => multiHitStdout(m);

      const planA = buildRealDataResultIssuePublishPlan(results, freshRun());
      const refArgvA = buildRealDataResultIssueSearchGhArgv(planA.commandArgs);
      const resolvePlanA = resolveRealDataResultIssueGhCommandPlan(
        stdoutFor(planA.commandArgs.searchQuery),
        planA.commandArgs,
      );

      const planB = buildRealDataResultIssuePublishPlan(results, freshRun());
      const refArgvB = buildRealDataResultIssueSearchGhArgv(planB.commandArgs);
      const resolvePlanB = resolveRealDataResultIssueGhCommandPlan(
        stdoutFor(planB.commandArgs.searchQuery),
        planB.commandArgs,
      );

      expect(planA).toEqual(planB);
      expect(refArgvA).toEqual(refArgvB);
      expect(resolvePlanA).toEqual(resolvePlanB);
    });

    it("publishPlan.searchArgv 와 refArgv 가 deep-equal 이지만 referential identity 분리(not.toBe) — 무공유 박제(매 호출 새 argv 배열)", () => {
      const results = [syntheticResult("github:github.com:u1", 4)];
      const publishPlan = buildRealDataResultIssuePublishPlan(
        results,
        freshRun(),
      );
      const refArgv = buildRealDataResultIssueSearchGhArgv(
        publishPlan.commandArgs,
      );

      expect(publishPlan.searchArgv).toEqual(refArgv);
      // 무공유 — 매 호출 새 argv 배열(공유 mutable 노출 0).
      expect(publishPlan.searchArgv).not.toBe(refArgv);
    });

    it("입력 results / run 객체가 chain 호출 후 mutate 0 — 원본 deep-equal 유지(매 호출 새 객체 반환)", () => {
      const results = [
        syntheticResult("github:github.com:nm1", 5),
        syntheticResult("github:github.com:nm2", 8),
      ];
      const run = freshRun();
      const resultsBefore = JSON.parse(JSON.stringify(results));
      const runBefore = JSON.parse(JSON.stringify(run));

      const publishPlan = buildRealDataResultIssuePublishPlan(results, run);
      buildRealDataResultIssueSearchGhArgv(publishPlan.commandArgs);
      resolveRealDataResultIssueGhCommandPlan(
        multiHitStdout(publishPlan.commandArgs.searchQuery),
        publishPlan.commandArgs,
      );

      expect(results).toEqual(resultsBefore);
      expect(run).toEqual(runBefore);
    });
  });

  describe("credential argv 누출 0 — token/secret 어휘 미포함(R-59 / REQ-059 raw 미저장 정합)", () => {
    it("publishPlan.searchArgv / refArgv / resolvePlan.argv(create+update) / publishPlan.commandArgs.searchQuery 어느 문자열에도 GH_TOKEN/PAT/Bearer/Authorization/x-access-token/x-github-token/--token/ghp_ 어휘 미등장", () => {
      const results = [syntheticResult("github:github.com:c1", 7)];
      const publishPlan = buildRealDataResultIssuePublishPlan(
        results,
        freshRun(),
      );
      const refArgv = buildRealDataResultIssueSearchGhArgv(
        publishPlan.commandArgs,
      );
      const resolveCreatePlan = resolveRealDataResultIssueGhCommandPlan(
        EMPTY_STDOUT,
        publishPlan.commandArgs,
      );
      const resolveUpdatePlan = resolveRealDataResultIssueGhCommandPlan(
        multiHitStdout(publishPlan.commandArgs.searchQuery),
        publishPlan.commandArgs,
      );

      const surfaces: string[] = [
        publishPlan.searchArgv.join("\n"),
        refArgv.join("\n"),
        resolveCreatePlan.argv.join("\n"),
        resolveUpdatePlan.argv.join("\n"),
        publishPlan.commandArgs.searchQuery,
      ];

      // 정규식 — case-insensitive, 토큰 어휘 포괄 매칭. 매칭 시 fail.
      const credentialPattern =
        /(GH_TOKEN|GITHUB_TOKEN|Bearer|Authorization|x-access-token|x-github-token|--token|--auth|ghp_[A-Za-z0-9])/i;
      for (const surface of surfaces) {
        expect(surface).not.toMatch(credentialPattern);
      }
    });
  });
});
