// realdata-e2e-result-publish-step-args-assembly.smoke-spec.ts — 실 평가 e2e
// result-publish step-args 조립 체인 non-gated build-time smoke (T-0737 박제,
// PLAN.md 109행 🟢 실 평가 e2e).
//
// 본 spec 의 존재 이유 — public CI gap 해소(T-0729 publish-assembly smoke 의 sibling):
//   - PLAN 109행 step ④ 결과 이슈 박제의 **pre-실행** run-plan 연결은 순수 컴포저
//     `buildRealDataResultPublishStepArgs(runPlan, results)`(T-0599 + self-wire)가
//     닫는다 — seed-side 최외곽 진입 `buildRealDataE2eRunPlan(seeds, modelId, run)`
//     (T-0597)이 산출한 검증된 `runPlan.run`(gitSha + dateToken) 만을 publish plan
//     으로 thread 해 step ①↔step ④ run 식별자 일관을 구조적으로 보장하고,
//     `buildRealDataResultIssuePublishPlan(results, runPlan.run)`(T-0595) 로 위임해
//     `{ report, commandArgs, searchArgv }` 를 합성한다.
//   - 이 컴포저는 unit(`realdata-e2e-result-publish-step-args.spec.ts`) +
//     consistency(`...-consistency.spec.ts`) spec 으로 닫혀 있으나, **seed→run-plan
//     →step④ publish-step-args 를 묶은 조립 체인 단위의 non-gated build-time smoke**
//     는 부재였다 — sibling 조립 smoke(T-0728/T-0729/T-0730/T-0731/T-0736)은 다른
//     composer family 만 cover 하고, T-0729 는 `buildRealDataResultIssuePublishPlan`
//     직접 진입이라 run-plan threading layer(runPlan.run 단일 source thread) 밖이다.
//   - 본 spec 은 그 gap 을 메운다 — **gating 없이 항상 실행되는 일반 describe** 로
//     seed→run-plan→publish-step-args 조립 surface 를 검증한다. 평가 leg(실 LLM /
//     EvaluationOrchestratorService / LlmHttpGateway / Ollama / 실 github 수집 / 실
//     gh / 실 jest spawn)는 복제하지 않고, 평가 결과 EvaluationResult 를 synthetic
//     literal 로 직접 공급해 평가 leg 를 우회한다(조립 surface 만 검증). 따라서 본
//     spec 은:
//
//      🔥 실 LLM 호출 0 — orchestrator / scoring service / gateway 미사용. synthetic
//         EvaluationResult literal 을 buildRealDataResultPublishStepArgs 에 직접 공급.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 DB 접근 0 / 실 jest spawn 0 — seed→run-plan→publish-step-args 조립만.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 build* 컴포저 import 재사용만(consistency-guard
//         신설 금지 — sweep 종결, T-0726).
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0737):
//   - 실 LLM round-trip / EvaluationOrchestratorService / LlmHttpGateway / Ollama 호출
//     — 본 spec 은 평가 leg 를 synthetic 결과 literal 로 대체(실 평가 0). live leg 검증은
//     기존 realdata-e2e-live.smoke-spec.ts 책임.
//   - 실 github 네트워크 수집 / gh 실행 / 실 이슈 search·create·edit·박제 / 실 jest spawn.
//   - post-실행 측 buildRealDataResultOutcomeStepArgs(T-0600)의 조립 smoke — 본 task 는
//     pre-실행 publish-step-args 만 책임(outcome 측은 별도 후속 sibling 후보).
//   - 새 컴포저 / 가드 / helper 신설 — 기존 build* 컴포저 import 재사용만.
//   - production src/ 코드 / 기존 컴포저 소스 / 위임 helper / consistency 가드 수정 —
//     test-only(신규 smoke spec 1 파일).
//   - T-0728/T-0729/T-0730/T-0731/T-0736 의 기존 조립 smoke 파일 수정 — file-disjoint
//     병렬 stream(본 task 는 신규 파일 추가만).
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";
import type { RealDataResultIssueRunRef } from "../helpers/realdata-e2e-result-issue-descriptor";
import { buildRealDataResultIssuePublishPlan } from "../helpers/realdata-e2e-result-issue-publish-plan";
import { buildRealDataResultPublishStepArgs } from "../helpers/realdata-e2e-result-publish-step-args";
import { buildRealDataE2eRunPlan } from "../helpers/realdata-e2e-run-plan";
import type { RealDataE2eRunPlan } from "../helpers/realdata-e2e-run-plan";
import { buildRealDataE2eSeed } from "../helpers/realdata-e2e-seed-fixture";

// 본 smoke 공통 fixture — 유효 modelId(비공백) 결정론 상수.
const MODEL_ID = "cfg-realdata-e2e-result-publish-step-args-assembly-smoke";

// 본 smoke 공통 fixture — 결정론 run 식별자(gitSha + dateToken 비공백). 매 it 가
// runPlan 구성 시 spread 복제로 받아 입력 mutate 가 누설되지 않도록 한다.
const RUN_REF: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-06-28",
};

// synthetic EvaluationResult 1 건 — publish-step-args 컴포저는 결과 배열을 요약 집계
// (count·분포·totalVolume) → descriptor → command-args → search-argv 로 흘려보내는
// surface 만 검증하므로, 도메인 타입 정합(difficulty / contribution 멤버십)만 만족하는
// minimal literal 로 충분하다. 실 LLM 호출 없이 EvaluationResult shape 만 강제한다.
function syntheticResult(unitId: string, volume: number): EvaluationResult {
  return {
    unitId,
    narrative:
      "synthetic evaluation narrative — publish-step-args assembly smoke fixture",
    difficulty: "easy",
    contribution: "low",
    volume,
  };
}

// 유효 runPlan 을 결정론 seed + modelId + run 으로 조립하는 헬퍼 — happy/flow/결정론
// case 의 공통 진입. run 은 spread 복제로 넘겨 입력 RUN_REF mutate 누설 0.
function buildValidRunPlan(): RealDataE2eRunPlan {
  return buildRealDataE2eRunPlan(buildRealDataE2eSeed(), MODEL_ID, {
    ...RUN_REF,
  });
}

describe("Smoke(non-gated): 실 평가 e2e result-publish step-args 조립 체인(seed→run-plan→publish-step-args) live-LLM 0 검증", () => {
  describe("happy path — 조립된 publish-step-args plan 산출", () => {
    it("seed + 유효 modelId + 유효 run 으로 runPlan 구성 후 다수 results 와 함께 호출 → report/commandArgs/searchArgv 3 필드 조립 + summary 가 results 카운트 반영", () => {
      // (1) seed→run-plan 으로 검증된 runPlan 구성(run 단일 source 진입).
      const runPlan = buildValidRunPlan();
      expect(runPlan.run.gitSha).toBe(RUN_REF.gitSha);
      expect(runPlan.run.dateToken).toBe(RUN_REF.dateToken);

      // (2) publish-step-args 단일 진입 — runPlan.run 을 publish plan 으로 thread.
      const results = [
        syntheticResult("github:github.com:c1", 3),
        syntheticResult("github:github.com:c2", 5),
      ];
      const plan = buildRealDataResultPublishStepArgs(runPlan, results);

      // 세 필드 모두 산출됨({ report, commandArgs, searchArgv } shape 충족).
      expect(plan.report).toBeDefined();
      expect(plan.commandArgs).toBeDefined();
      expect(plan.searchArgv).toBeDefined();

      // report.summary 집계가 입력 result 수와 정합(count = 입력 길이, totalVolume = 합산).
      expect(plan.report.summary.count).toBe(results.length);
      expect(plan.report.summary.totalVolume).toBe(8);

      // searchArgv 는 비어있지 않은 string[] — 첫 gh search 호출 argv.
      expect(Array.isArray(plan.searchArgv)).toBe(true);
      expect(plan.searchArgv.length).toBeGreaterThan(0);
      for (const token of plan.searchArgv) {
        expect(typeof token).toBe("string");
      }
      // commandArgs.searchQuery 가 searchArgv 안에 보존됨(조립 round-trip).
      expect(plan.searchArgv).toContain(plan.commandArgs.searchQuery);
    });
  });

  describe("run 단일 source 조립 단언 — runPlan.run 만 thread(재전달 0)", () => {
    it("조립 산출이 동일 results 를 buildRealDataResultIssuePublishPlan(results, runPlan.run) 로 직접 호출한 결과와 deep-equal(run 을 runPlan 에서만 thread)", () => {
      const runPlan = buildValidRunPlan();
      const results = [
        syntheticResult("github:github.com:s1", 2),
        syntheticResult("github:github.com:s2", 4),
      ];

      // 조립 체인 진입(runPlan.run 단일 source thread).
      const viaStepArgs = buildRealDataResultPublishStepArgs(runPlan, results);
      // 위임 대상을 runPlan.run 으로 직접 호출(single-source 재유도).
      const viaDelegate = buildRealDataResultIssuePublishPlan(
        results,
        runPlan.run,
      );

      // 조립 체인이 run 을 재전달 없이 runPlan 에서만 thread 하므로 byte-identical.
      expect(viaStepArgs).toEqual(viaDelegate);

      // 산출 plan 이 runPlan.run.gitSha / dateToken 을 (위임 산출 안에서) 반영함을
      // deep-equal 정합으로 확인 — 두 산출이 같은 run 식별자에서 도출됨.
      expect(viaStepArgs.report.summary.count).toBe(results.length);
    });
  });

  describe("flow / branch — 빈 / 단일 / 다수 results 경로", () => {
    it("빈 results 배열([]) + 유효 runPlan — throw 0 + summary count 0·전 슬롯 0·totalVolume 0 의 빈-count plan 반환", () => {
      const runPlan = buildValidRunPlan();
      const plan = buildRealDataResultPublishStepArgs(runPlan, []);

      // 빈-배열 분기 — count·totalVolume 0, 분포 전 슬롯 0.
      expect(plan.report.summary.count).toBe(0);
      expect(plan.report.summary.totalVolume).toBe(0);
      for (const v of Object.values(plan.report.summary.byDifficulty)) {
        expect(v).toBe(0);
      }
      for (const v of Object.values(plan.report.summary.byContribution)) {
        expect(v).toBe(0);
      }

      // commandArgs / searchArgv 는 빈 results 에서도 정상 합성(runPlan.run 만으로 도출).
      expect(plan.commandArgs.searchQuery.length).toBeGreaterThan(0);
      expect(plan.searchArgv.length).toBeGreaterThan(0);
    });

    it("단일 result — throw 0 으로 조립 산출, summary.count 1", () => {
      const runPlan = buildValidRunPlan();
      const results = [syntheticResult("github:github.com:single", 2)];
      const plan = buildRealDataResultPublishStepArgs(runPlan, results);
      expect(plan.report.summary.count).toBe(1);
      expect(plan.report.summary.totalVolume).toBe(2);
      expect(plan.searchArgv.length).toBeGreaterThan(0);
    });

    it("다수 result — throw 0 으로 조립 산출, summary.count 가 입력 수와 정합", () => {
      const runPlan = buildValidRunPlan();
      const results = [
        syntheticResult("github:github.com:m1", 1),
        syntheticResult("github:github.com:m2", 2),
        syntheticResult("github:github.com:m3", 4),
      ];
      const plan = buildRealDataResultPublishStepArgs(runPlan, results);
      expect(plan.report.summary.count).toBe(3);
      expect(plan.report.summary.totalVolume).toBe(7);
      expect(plan.searchArgv.length).toBeGreaterThan(0);
    });
  });

  describe("negative cases — runPlan.run 결손의 위임 guard 전파(자체 try/catch 0)", () => {
    // 직접 구성한 불완전 runPlan literal — buildRealDataE2eRunPlan 의 run guard 를
    // 우회해(정상 경로로는 빈 run 을 만들 수 없으므로) 불완전 run 을 step-args 컴포저에
    // 직접 주입한다. pipeline 은 유효 modelId 로 채워 run 결손만 고립 검증한다.
    const validPipeline = buildValidRunPlan().pipeline;

    it("runPlan.run.gitSha 빈 문자열 — 위임 buildRealDataResultIssuePublishPlan guard throw 가 그대로 전파", () => {
      const broken: RealDataE2eRunPlan = {
        pipeline: validPipeline,
        run: { gitSha: "", dateToken: RUN_REF.dateToken },
      };
      expect(() => buildRealDataResultPublishStepArgs(broken, [])).toThrow();
    });

    it("runPlan.run.gitSha 공백만 — 위임 guard throw 가 그대로 전파", () => {
      const broken: RealDataE2eRunPlan = {
        pipeline: validPipeline,
        run: { gitSha: "   ", dateToken: RUN_REF.dateToken },
      };
      expect(() => buildRealDataResultPublishStepArgs(broken, [])).toThrow();
    });

    it("runPlan.run.dateToken 빈 문자열 — 위임 guard throw 가 그대로 전파", () => {
      const broken: RealDataE2eRunPlan = {
        pipeline: validPipeline,
        run: { gitSha: RUN_REF.gitSha, dateToken: "" },
      };
      expect(() => buildRealDataResultPublishStepArgs(broken, [])).toThrow();
    });

    it("runPlan.run.dateToken 공백만 — 위임 guard throw 가 그대로 전파", () => {
      const broken: RealDataE2eRunPlan = {
        pipeline: validPipeline,
        run: { gitSha: RUN_REF.gitSha, dateToken: "   " },
      };
      expect(() => buildRealDataResultPublishStepArgs(broken, [])).toThrow();
    });
  });

  describe("결정론 · 무공유 — 동일 (runPlan, results) 두 번 호출 + 입력 불변", () => {
    it("두 plan 이 deep-equal 이면서 최상위·중첩 객체 참조가 공유되지 않는다(not.toBe)", () => {
      const runPlan = buildValidRunPlan();
      const results = [
        syntheticResult("github:github.com:d1", 3),
        syntheticResult("github:github.com:d2", 6),
      ];
      const a = buildRealDataResultPublishStepArgs(runPlan, results);
      const b = buildRealDataResultPublishStepArgs(runPlan, results);

      // 값은 deep-equal(결정론 — 입력만의 함수).
      expect(a).toEqual(b);

      // 참조는 무공유 — 최상위 plan + 중첩 report/commandArgs/searchArgv 전부 새 객체.
      expect(a).not.toBe(b);
      expect(a.report).not.toBe(b.report);
      expect(a.commandArgs).not.toBe(b.commandArgs);
      expect(a.searchArgv).not.toBe(b.searchArgv);
    });

    it("입력 runPlan · results 객체가 호출 전후로 mutate 되지 않음(deep-equal 보존)", () => {
      const runPlan = buildValidRunPlan();
      const results = [
        syntheticResult("github:github.com:n1", 1),
        syntheticResult("github:github.com:n2", 2),
      ];
      const runPlanBefore = JSON.parse(JSON.stringify(runPlan));
      const resultsBefore = JSON.parse(JSON.stringify(results));

      buildRealDataResultPublishStepArgs(runPlan, results);

      // 호출 후 입력 runPlan · results 가 동형(무공유 보존 — 출력 변형이 입력에 누설 0).
      expect(runPlan).toEqual(runPlanBefore);
      expect(results).toEqual(resultsBefore);
      expect(results.length).toBe(resultsBefore.length);
    });
  });
});
