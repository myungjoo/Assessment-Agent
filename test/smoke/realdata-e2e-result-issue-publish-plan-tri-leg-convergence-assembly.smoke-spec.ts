// realdata-e2e-result-issue-publish-plan-tri-leg-convergence-assembly.smoke-spec.ts —
// 실 평가 e2e result-side 종단 컴포저(buildRealDataResultIssuePublishPlan)의
// **tri-leg(report·commandArgs·searchArgv) single-source convergence** non-gated
// build-time smoke (T-0755 박제, PLAN.md 109행 🟢 실 평가 e2e).
//
// 본 spec 의 존재 이유 — public CI gap 해소(T-0753/T-0754 seed-side convergence 의
// result-side 대칭 sibling):
//   - post-evaluation interpretation 측 종단 컴포저
//     `buildRealDataResultIssuePublishPlan(results, run)`(T-0595 + T-0666 self-wire)
//     은 **세 leg 를 단일 plan 으로 합류**시킨다:
//       (1) report·commandArgs leg — buildRealDataResultIssueCommandPlan(results, run)
//           (T-0594) 위임 산출. 둘 다 동일 command-plan 단일 source 로부터 thread.
//       (2) searchArgv leg — buildRealDataResultIssueSearchGhArgv(commandArgs)(T-0586)
//           위임 산출. commandArgs.searchQuery 를 단일 source 로 thread.
//   - 컴포저 핵심 불변식은 **세 leg 가 각자의 단일 source 로부터 합류**한다는 것이다 —
//     report·commandArgs 는 command-plan 위임 단일 source, searchArgv 는 search-argv
//     위임 단일 source. run guard 는 command-plan 단계((1))에서 평가되므로 잘못된 run 은
//     searchArgv 단계((2))에 도달하기 전에 throw 된다(guard-ordering).
//   - 그러나 이 tri-leg single-source convergence 를 **직접-체인으로 묶은 non-gated
//     build-time smoke 는 부재**다. 기존 realdata-e2e-result-issue-publish-assembly.
//     smoke-spec.ts(T-0729) 는 report/commandArgs/searchArgv 를 `toBeDefined()` +
//     summary.count/totalVolume/searchArgv.length>0/searchArgv).toContain(searchQuery)
//     shape 단언과 결정론 not.toBe 만 한다. (a) plan.report·plan.commandArgs 가 직접 호출
//     buildRealDataResultIssueCommandPlan(results, run) 와 byte-identical(command-plan
//     leg 단일 source) (b) plan.searchArgv 가 직접 호출 buildRealDataResultIssueSearchGhArgv
//     (commandArgs) 와 byte-identical(search-argv leg 단일 source) (c) partial-thread
//     격리(다른 results→세 leg 가 변해도 직접 sub-컴포저 재유도와 여전히 정합) (d) run
//     guard 가 command-plan 단계에서 우선 평가됨(guard-ordering) 을 직접 단언하는 smoke 는
//     0 이다(git grep — publish-plan tri-leg convergence·directCommandArgs/directSearchArgv
//     패턴 부재). 이는 T-0753(run-plan dual-leg)·T-0754(pipeline-plan dual-leg) seed-side
//     convergence 의 **result-side 대칭 sibling** — publish-plan 자체를 합성하는 컴포저의
//     절단면이다.
//   - 본 spec 은 그 gap 을 정확히 메운다 — **gating 없이 항상 실행되는 일반 describe** 로
//     command-plan leg byte-identical / search-argv leg byte-identical / tri-leg cross /
//     partial-thread 격리 / guard-ordering / negative guard 전파를 직접-체인으로 박제한다.
//     leg-swap·leg-drift·partial-thread·guard-order-flip 회귀를 public CI 그물로 닫는다.
//     따라서 본 spec 은:
//
//      🔥 실 LLM 호출 0 — orchestrator / scoring service / gateway 미사용. synthetic
//         EvaluationResult literal 을 컴포저에 직접 공급.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 build* 컴포저 import 재사용만(컴포저/가드 신설 0).
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0755):
//   - 기존 realdata-e2e-result-issue-publish-assembly.smoke-spec.ts(T-0729) 의 shape-only
//     단언 수정 / 중복 it 이관 — 본 spec 은 신규 파일만(별도 sweep 금지).
//   - seed-side run-plan(T-0753)/pipeline-plan(T-0754)/step-args(T-0752) convergence
//     재단언 — 이미 cover. 본 spec 은 result-side publish-plan tri-leg 합성만.
//   - test/helpers/realdata-e2e-result-issue-publish-plan.ts 또는 어떤 컴포저 helper 의
//     로직 변경(컴포저 재구현·guard 메시지 수정 0 — smoke 는 외부 관측만).
//   - 실 평가 / scoreUnit / 실 LLM round-trip / Ollama / DB / 실 gh / 실 이슈 박제 /
//     실 git sha·timestamp / 실 jest spawn / 실 네트워크(live leg 복제 0).
//   - gated(DB·credential·LAN) smoke leg 추가 — 본 task 는 non-gated build-time
//     pure-composer smoke 단독.
//   - production src/ 코드 변경 — test-only(신규 smoke spec 1 파일).
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";
import { buildRealDataResultIssueCommandPlan } from "../helpers/realdata-e2e-result-issue-command-plan";
import type { RealDataResultIssueRunRef } from "../helpers/realdata-e2e-result-issue-descriptor";
import { buildRealDataResultIssuePublishPlan } from "../helpers/realdata-e2e-result-issue-publish-plan";
import { buildRealDataResultIssueSearchGhArgv } from "../helpers/realdata-e2e-result-issue-search-argv";

// 본 smoke 공통 fixture — 결정론 run 식별자(gitSha + dateToken 비공백). 매 it 가
// freshRun() 으로 복제 받아 입력 mutate 가 fixture 상수를 오염시키지 않도록 한다.
const RUN_REF: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-06-28",
};

// 매 호출 새 RUN_REF 복사본 — 입력-무공유 단언이 fixture 상수를 오염시키지 않도록.
function freshRun(): RealDataResultIssueRunRef {
  return { ...RUN_REF };
}

// synthetic EvaluationResult 1 건 — publish 컴포저는 결과 배열을 요약 집계
// (count·분포·totalVolume) → descriptor → command-args → search-argv 로 흘려보내는
// surface 만 검증하므로, 도메인 타입 정합(difficulty / contribution 멤버십)만 만족하는
// minimal literal 로 충분하다. 실 LLM 호출 없이 EvaluationResult shape 만 강제한다.
function syntheticResult(unitId: string, volume: number): EvaluationResult {
  return {
    unitId,
    narrative:
      "synthetic evaluation narrative — publish plan tri-leg convergence smoke fixture",
    difficulty: "easy",
    contribution: "low",
    volume,
  };
}

describe("Smoke(non-gated): 실 평가 e2e result-issue publish-plan 컴포저 tri-leg(report·commandArgs·searchArgv) single-source convergence", () => {
  describe("happy path — 세 leg 동시 합류", () => {
    it("buildRealDataResultIssuePublishPlan(results, run) — 반환 { report, commandArgs, searchArgv } 의 세 필드가 모두 정의·shape 보유", () => {
      const results = [
        syntheticResult("github:github.com:c1", 3),
        syntheticResult("github:github.com:c2", 5),
      ];
      const plan = buildRealDataResultIssuePublishPlan(results, freshRun());

      // report leg — 요약 집계 + descriptor shape.
      expect(plan.report).toBeDefined();
      expect(plan.report.summary.count).toBe(results.length);
      expect(plan.report.summary.totalVolume).toBe(8);

      // commandArgs leg — 멱등 명령-args shape(searchQuery 비공백).
      expect(plan.commandArgs).toBeDefined();
      expect(typeof plan.commandArgs.searchQuery).toBe("string");
      expect(plan.commandArgs.searchQuery.length).toBeGreaterThan(0);

      // searchArgv leg — 첫 gh search 호출 argv(비어있지 않은 string[]).
      expect(Array.isArray(plan.searchArgv)).toBe(true);
      expect(plan.searchArgv.length).toBeGreaterThan(0);
      for (const token of plan.searchArgv) {
        expect(typeof token).toBe("string");
      }
    });
  });

  describe("report·commandArgs leg single-source byte-identical (핵심) — command-plan 위임 단일 source", () => {
    it("plan.report·plan.commandArgs 가 직접 호출 buildRealDataResultIssueCommandPlan(results, run) 의 각 report/commandArgs 와 byte-identical(toEqual) 이며 새 객체(not.toBe)", () => {
      const results = [
        syntheticResult("github:github.com:s1", 2),
        syntheticResult("github:github.com:s2", 4),
      ];
      const run = freshRun();
      const plan = buildRealDataResultIssuePublishPlan(results, run);

      // 같은 results·run 으로 command-plan 컴포저를 직접 재호출 → 종단 컴포저의 report·
      // commandArgs leg 와 deep-equal(둘 다 command-plan 위임 단일 source 로부터 합류).
      const directCommandPlan = buildRealDataResultIssueCommandPlan(
        results,
        run,
      );
      expect(plan.report).toEqual(directCommandPlan.report);
      expect(plan.commandArgs).toEqual(directCommandPlan.commandArgs);

      // 동시에 새 객체로 무공유(직접-재호출 산출과 참조 비동일 — 매 호출 새 트리).
      expect(plan.report).not.toBe(directCommandPlan.report);
      expect(plan.commandArgs).not.toBe(directCommandPlan.commandArgs);
    });
  });

  describe("searchArgv leg single-source byte-identical (핵심) — search-argv 위임 단일 source", () => {
    it("plan.searchArgv 가 직접 호출 buildRealDataResultIssueSearchGhArgv(plan.commandArgs) 와 byte-identical(toEqual — 전체 배열 deep-equal) 이며 새 배열(not.toBe)", () => {
      const results = [syntheticResult("github:github.com:sa1", 7)];
      const plan = buildRealDataResultIssuePublishPlan(results, freshRun());

      // plan.commandArgs 로 search-argv 빌더를 직접 재호출 → 종단 컴포저의 searchArgv
      // leg 와 element-wise deep-equal(searchArgv leg 이 위임 빌더 단일 source).
      const directSearchArgv = buildRealDataResultIssueSearchGhArgv(
        plan.commandArgs,
      );
      expect(plan.searchArgv).toEqual(directSearchArgv);

      // 동시에 새 배열로 무공유(매 호출 새 argv 배열 — 참조 비동일).
      expect(plan.searchArgv).not.toBe(directSearchArgv);
    });
  });

  describe("tri-leg cross 정합 (branch) — searchArgv leg 이 commandArgs leg 산출을 thread", () => {
    it("plan.searchArgv 가 plan.commandArgs.searchQuery 를 단일 원소로 포함(toContain) — searchArgv leg 이 commandArgs leg 의 marker 를 단일 source 로 옮김", () => {
      const results = [
        syntheticResult("github:github.com:x1", 1),
        syntheticResult("github:github.com:x2", 9),
      ];
      const plan = buildRealDataResultIssuePublishPlan(results, freshRun());

      // searchArgv 안에 commandArgs.searchQuery 가 단일 argv 원소로 보존됨(조립
      // round-trip — searchArgv leg 이 commandArgs leg 출력을 thread).
      expect(plan.searchArgv).toContain(plan.commandArgs.searchQuery);
      // 정확히 1 회 등장(중복 0 — 단일 원소 thread).
      const occurrences = plan.searchArgv.filter(
        (token) => token === plan.commandArgs.searchQuery,
      );
      expect(occurrences).toHaveLength(1);
    });
  });

  describe("partial-thread 격리 (branch) — 세 leg 가 동일 (results, run) 단일 source 로부터 합류", () => {
    it("다른 results(같은 run) → 세 leg 모두 변할 수 있으나 report/commandArgs/searchArgv 가 각각 직접 sub-컴포저 재유도와 여전히 byte-identical", () => {
      const run = freshRun();
      const a = buildRealDataResultIssuePublishPlan(
        [syntheticResult("github:github.com:p1", 2)],
        run,
      );
      const otherResults = [
        syntheticResult("github:github.com:p2", 3),
        syntheticResult("github:github.com:p3", 6),
      ];
      const b = buildRealDataResultIssuePublishPlan(otherResults, run);

      // 다른 results → 요약 집계가 달라지므로 세 leg 가 변할 수 있다(여기서는 count drift).
      expect(a.report.summary.count).not.toBe(b.report.summary.count);

      // 그럼에도 각 leg 는 여전히 직접 sub-컴포저 재유도와 byte-identical(단일 source 정합).
      const directCommandPlanB = buildRealDataResultIssueCommandPlan(
        otherResults,
        run,
      );
      expect(b.report).toEqual(directCommandPlanB.report);
      expect(b.commandArgs).toEqual(directCommandPlanB.commandArgs);
      expect(b.searchArgv).toEqual(
        buildRealDataResultIssueSearchGhArgv(b.commandArgs),
      );
    });

    it("다른 run(같은 results) → report·commandArgs·searchArgv 가 run 변화를 반영하되 단일 source 정합 유지", () => {
      const results = [syntheticResult("github:github.com:r1", 4)];
      const a = buildRealDataResultIssuePublishPlan(results, {
        gitSha: "abc1234",
        dateToken: RUN_REF.dateToken,
      });
      const otherRun: RealDataResultIssueRunRef = {
        gitSha: "def5678",
        dateToken: RUN_REF.dateToken,
      };
      const b = buildRealDataResultIssuePublishPlan(results, otherRun);

      // 다른 run → marker/title 가 run token 을 반영해 commandArgs.searchQuery 가 변함.
      expect(a.commandArgs.searchQuery).not.toBe(b.commandArgs.searchQuery);
      // searchArgv 도 그 변화를 thread(다른 searchQuery 포함).
      expect(b.searchArgv).toContain(b.commandArgs.searchQuery);
      expect(b.searchArgv).not.toEqual(a.searchArgv);

      // 그럼에도 b 의 세 leg 는 직접 sub-컴포저 재유도와 byte-identical(단일 source 정합).
      const directCommandPlanB = buildRealDataResultIssueCommandPlan(
        results,
        otherRun,
      );
      expect(b.report).toEqual(directCommandPlanB.report);
      expect(b.commandArgs).toEqual(directCommandPlanB.commandArgs);
      expect(b.searchArgv).toEqual(
        buildRealDataResultIssueSearchGhArgv(b.commandArgs),
      );
    });
  });

  describe("guard-ordering (branch) — run guard 가 command-plan 단계(searchArgv 단계보다 먼저)에서 평가됨", () => {
    it("빈 run.gitSha + 빈 results → command-plan 위임 throw 가 searchArgv 단계 도달 전에 우선 전파", () => {
      // run.gitSha 가 빈 입력 — 합성 순서상 command-plan 위임((1)) 이 search-argv((2))
      // 보다 먼저 평가되므로 run guard(command-plan 단계)가 우선 throw 한다.
      let caught: Error | undefined;
      try {
        buildRealDataResultIssuePublishPlan([], {
          gitSha: "",
          dateToken: RUN_REF.dateToken,
        });
      } catch (err) {
        caught = err as Error;
      }
      expect(caught).toBeDefined();
      // command-plan 단계의 run guard 메시지로 우선 throw 확인.
      expect(caught?.message).toContain("RealDataResultIssueRunRef.gitSha");
      // search-argv 단계의 searchQuery guard 메시지(commandArgs.searchQuery)는 미도달.
      expect(caught?.message).not.toContain("commandArgs.searchQuery");
    });
  });

  describe("error / negative — 위임 guard 전파(command-plan 단계, searchArgv 미도달)", () => {
    it("빈 run.gitSha → 위임 assertNonBlank throw 전파", () => {
      expect(() =>
        buildRealDataResultIssuePublishPlan(
          [syntheticResult("github:github.com:n1", 1)],
          { gitSha: "", dateToken: RUN_REF.dateToken },
        ),
      ).toThrow(/gitSha/);
    });

    it("공백만의 run.gitSha → 위임 throw 전파", () => {
      expect(() =>
        buildRealDataResultIssuePublishPlan(
          [syntheticResult("github:github.com:n2", 1)],
          { gitSha: "   ", dateToken: RUN_REF.dateToken },
        ),
      ).toThrow(/gitSha/);
    });

    it("빈 run.dateToken → 위임 throw 전파", () => {
      expect(() =>
        buildRealDataResultIssuePublishPlan(
          [syntheticResult("github:github.com:n3", 1)],
          { gitSha: RUN_REF.gitSha, dateToken: "" },
        ),
      ).toThrow(/dateToken/);
    });

    it("공백만의 run.dateToken → 위임 throw 전파", () => {
      expect(() =>
        buildRealDataResultIssuePublishPlan(
          [syntheticResult("github:github.com:n4", 1)],
          { gitSha: RUN_REF.gitSha, dateToken: "   " },
        ),
      ).toThrow(/dateToken/);
    });

    it("빈 results([]) + 빈/공백 run → run guard 가 우선 throw(빈 results 경계에서도 searchArgv 미도달)", () => {
      // 빈 results 경계에서도 run guard 가 command-plan 단계에서 먼저 평가됨 — searchArgv
      // 단계는 도달하지 않는다(빈 results 가 guard 를 우회시키지 않음).
      expect(() =>
        buildRealDataResultIssuePublishPlan([], {
          gitSha: "  ",
          dateToken: "  ",
        }),
      ).toThrow(/RealDataResultIssueRunRef/);
    });
  });

  describe("flow / branch — 빈·단일·다수 results 분기, 각 분기 세 leg 단일 source 정합", () => {
    it("빈 results + 유효 run → report.summary.count 0·전 슬롯 0·totalVolume 0 + commandArgs/searchArgv 정상 합성(throw 0), 세 leg 단일 source 정합", () => {
      const run = freshRun();
      const plan = buildRealDataResultIssuePublishPlan([], run);

      // 빈-배열 분기 — count·totalVolume 0, 분포 전 슬롯 0.
      expect(plan.report.summary.count).toBe(0);
      expect(plan.report.summary.totalVolume).toBe(0);
      for (const v of Object.values(plan.report.summary.byDifficulty)) {
        expect(v).toBe(0);
      }
      for (const v of Object.values(plan.report.summary.byContribution)) {
        expect(v).toBe(0);
      }
      // commandArgs / searchArgv 는 빈 results 에서도 정상 합성(run 식별자만으로 도출).
      expect(plan.commandArgs.searchQuery.length).toBeGreaterThan(0);
      expect(plan.searchArgv.length).toBeGreaterThan(0);

      // 세 leg 단일 source 정합 유지.
      const directCommandPlan = buildRealDataResultIssueCommandPlan([], run);
      expect(plan.report).toEqual(directCommandPlan.report);
      expect(plan.commandArgs).toEqual(directCommandPlan.commandArgs);
      expect(plan.searchArgv).toEqual(
        buildRealDataResultIssueSearchGhArgv(plan.commandArgs),
      );
    });

    it("단일 result(count 1) → 세 leg 가 직접 sub-컴포저 재유도와 toEqual 유지", () => {
      const results = [syntheticResult("github:github.com:single", 2)];
      const run = freshRun();
      const plan = buildRealDataResultIssuePublishPlan(results, run);

      expect(plan.report.summary.count).toBe(1);
      const directCommandPlan = buildRealDataResultIssueCommandPlan(
        results,
        run,
      );
      expect(plan.report).toEqual(directCommandPlan.report);
      expect(plan.commandArgs).toEqual(directCommandPlan.commandArgs);
      expect(plan.searchArgv).toEqual(
        buildRealDataResultIssueSearchGhArgv(plan.commandArgs),
      );
    });

    it("다수 result(count = results 길이) → 세 leg 가 직접 sub-컴포저 재유도와 toEqual 유지", () => {
      const results = [
        syntheticResult("github:github.com:m1", 1),
        syntheticResult("github:github.com:m2", 2),
        syntheticResult("github:github.com:m3", 4),
      ];
      const run = freshRun();
      const plan = buildRealDataResultIssuePublishPlan(results, run);

      expect(plan.report.summary.count).toBe(results.length);
      expect(plan.report.summary.totalVolume).toBe(7);
      const directCommandPlan = buildRealDataResultIssueCommandPlan(
        results,
        run,
      );
      expect(plan.report).toEqual(directCommandPlan.report);
      expect(plan.commandArgs).toEqual(directCommandPlan.commandArgs);
      expect(plan.searchArgv).toEqual(
        buildRealDataResultIssueSearchGhArgv(plan.commandArgs),
      );
    });
  });

  describe("결정론·무공유·no-mutation", () => {
    it("동일 (results, run) 두 번 호출 → deep-equal + 새 plan 객체(not.toBe) + 세 leg 참조도 각각 비공유(not.toBe)", () => {
      const results = [
        syntheticResult("github:github.com:d1", 3),
        syntheticResult("github:github.com:d2", 6),
      ];
      const a = buildRealDataResultIssuePublishPlan(results, freshRun());
      const b = buildRealDataResultIssuePublishPlan(results, freshRun());

      // 값은 deep-equal(결정론 — 입력만의 함수).
      expect(a).toEqual(b);
      // 참조는 무공유 — 최상위 plan + 세 leg(report/commandArgs/searchArgv) 전부 새 객체.
      expect(a).not.toBe(b);
      expect(a.report).not.toBe(b.report);
      expect(a.commandArgs).not.toBe(b.commandArgs);
      expect(a.searchArgv).not.toBe(b.searchArgv);
    });

    it("입력 results 배열·원소·run 객체 mutate 0 — 호출 전후 deep-equal", () => {
      const results = [
        syntheticResult("github:github.com:nm1", 5),
        syntheticResult("github:github.com:nm2", 8),
      ];
      const run = freshRun();
      const resultsBefore = JSON.parse(JSON.stringify(results));
      const runBefore = JSON.parse(JSON.stringify(run));

      buildRealDataResultIssuePublishPlan(results, run);

      expect(results).toEqual(resultsBefore);
      expect(run).toEqual(runBefore);
    });
  });

  describe("R-59 raw 본문 누출 0 — plan 은 식별자·분류 분포·정량 합산·issue 식별자·marker·렌더 본문·search argv 토큰만 보유", () => {
    it("sentinel — raw 외부 활동 본문(commit/PR/issue raw narrative)이 plan 직렬화에 구조적으로 미등장", () => {
      // results 의 synthetic narrative 는 LLM 생성 평가문(raw 인용 아님)이고, 컴포저는
      // 요약 집계·descriptor·명령-args·search argv 토큰만 thread 한다. 입력에 부재한 raw
      // 본문 sentinel 은 plan 에 등장할 수 없다(구조적 미포함 — R-59).
      const sentinel = "SENTINEL-RAW-COMMIT-BODY-DO-NOT-LEAK-0755";
      const results = [
        syntheticResult("github:github.com:r59a", 2),
        syntheticResult("github:github.com:r59b", 4),
      ];
      const plan = buildRealDataResultIssuePublishPlan(results, freshRun());

      const serialized = JSON.stringify(plan);
      // 입력에 부재한 raw 본문 sentinel 은 산출에도 부재.
      expect(serialized).not.toContain(sentinel);
      // plan 은 식별자·분포·정량 + descriptor(title/marker/body) + commandArgs +
      // searchArgv 만 — unitId(식별자) 외 raw 활동 본문 키 부재.
      expect(serialized).not.toContain("rawCommitBody");
      expect(serialized).not.toContain("rawDiff");
    });
  });
});
