// realdata-e2e-result-issue-publish-assembly.smoke-spec.ts — 실 평가 e2e
// result-issue publish 조립 체인 non-gated build-time smoke (T-0729 박제,
// PLAN.md 109행 🟢 실 평가 e2e).
//
// 본 spec 의 존재 이유 — public CI gap 해소(T-0728 seed-assembly smoke 의 sibling):
//   - post-evaluation interpretation 측 build-time chain 은 단일 진입점
//     `buildRealDataResultIssuePublishPlan(results, run)`(T-0595 + T-0666 self-wire)
//     으로 `EvaluationResult[]` + run → `{ report, commandArgs, searchArgv }` 까지
//     닫혀 있다(내부 위임: command-plan → search-argv). 그러나 그 조립(assembly)
//     경로를 묶어 발화하는 smoke 는 없었다 — 컴포저 sweep(T-0584~T-0726)은 개별
//     leaf 의 정합 가드만 닫았고, "여러 컴포저를 한 줄로 엮은 조립 체인 단위" 의
//     build-time smoke 는 부분적이었다. 즉 두 위임 layer(command-plan ↔ search-argv)
//     사이의 합성 시그니처/순서 회귀가 CI 에서 잡힐 그물이 비어 있었다.
//   - 본 spec 은 그 gap 을 메운다 — **gating 없이 항상 실행되는 일반 describe** 로
//     publish 조립 surface(컴포저 단일 진입점)를 검증한다. 평가 leg(실 LLM /
//     EvaluationOrchestratorService / LlmHttpGateway / Ollama / 실 github 수집)는
//     복제하지 않고, 평가 결과 EvaluationResult 를 synthetic literal 로 직접 공급해
//     평가 leg 를 우회한다(조립 surface 만 검증). 따라서 본 spec 은:
//
//      🔥 실 LLM 호출 0 — orchestrator / scoring service / gateway 미사용. synthetic
//         EvaluationResult literal 을 buildRealDataResultIssuePublishPlan 에 직접 공급.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 build* 컴포저 import 재사용만(consistency-guard
//         신설 금지 — sweep 종결, T-0726).
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0729):
//   - 실 LLM round-trip / EvaluationOrchestratorService / LlmHttpGateway / Ollama 호출
//     — 본 spec 은 평가 leg 를 synthetic 결과 literal 로 대체(실 평가 0). live leg 검증은
//     기존 realdata-e2e-live.smoke-spec.ts 책임.
//   - 실 github 네트워크 수집 / gh 실행 / 실 이슈 search·create·edit·박제.
//   - 새 컴포저 / 가드 / helper 신설 — 기존 build* 컴포저 import 재사용만.
//   - production src/ 코드 변경 — test-only(신규 smoke spec 1 파일).
//   - T-0728 의 seed→run-plan→step-args 조립 smoke(realdata-e2e-assembly.smoke-spec.ts)
//     수정 — file-disjoint 병렬 stream(본 task 는 신규 파일 추가만).
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";
import type { RealDataResultIssueRunRef } from "../helpers/realdata-e2e-result-issue-descriptor";
import { buildRealDataResultIssuePublishPlan } from "../helpers/realdata-e2e-result-issue-publish-plan";

// 본 smoke 공통 fixture — 결정론 run 식별자(gitSha + dateToken 비공백). 매 it 가
// spread 복제로 받아 입력 mutate 가 누설되지 않도록 한다.
const RUN_REF: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-06-28",
};

// synthetic EvaluationResult 1 건 — publish 컴포저는 결과 배열을 요약 집계
// (count·분포·totalVolume) → descriptor → command-args → search-argv 로 흘려보내는
// surface 만 검증하므로, 도메인 타입 정합(difficulty / contribution 멤버십)만 만족하는
// minimal literal 로 충분하다. 실 LLM 호출 없이 EvaluationResult shape 만 강제한다.
function syntheticResult(unitId: string, volume: number): EvaluationResult {
  return {
    unitId,
    narrative:
      "synthetic evaluation narrative — publish assembly smoke fixture",
    difficulty: "easy",
    contribution: "low",
    volume,
  };
}

describe("Smoke(non-gated): 실 평가 e2e result-issue publish 조립 체인(command-plan→search-argv) live-LLM 0 검증", () => {
  describe("happy path — 조립된 publish plan 산출", () => {
    it("유효 results(1+ 건) + 유효 run → report/commandArgs/searchArgv 3 필드가 모두 조립되고 summary.count 가 입력 result 수와 정합한다", () => {
      const results = [
        syntheticResult("github:github.com:c1", 3),
        syntheticResult("github:github.com:c2", 5),
      ];
      const plan = buildRealDataResultIssuePublishPlan(results, { ...RUN_REF });

      // 세 필드 모두 산출됨.
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
      // commandArgs.searchQuery 가 searchArgv 안에 단일 원소로 보존됨(조립 round-trip).
      expect(plan.searchArgv).toContain(plan.commandArgs.searchQuery);
    });
  });

  describe("flow / branch — 단일 vs 다수 result", () => {
    it("단일 result — throw 0 으로 조립 산출, summary.count 1", () => {
      const results = [syntheticResult("github:github.com:single", 2)];
      const plan = buildRealDataResultIssuePublishPlan(results, { ...RUN_REF });
      expect(plan.report.summary.count).toBe(1);
      expect(plan.report.summary.totalVolume).toBe(2);
      expect(plan.searchArgv.length).toBeGreaterThan(0);
    });

    it("다수 result — throw 0 으로 조립 산출, summary.count 가 입력 수와 정합", () => {
      const results = [
        syntheticResult("github:github.com:m1", 1),
        syntheticResult("github:github.com:m2", 2),
        syntheticResult("github:github.com:m3", 4),
      ];
      const plan = buildRealDataResultIssuePublishPlan(results, { ...RUN_REF });
      expect(plan.report.summary.count).toBe(3);
      expect(plan.report.summary.totalVolume).toBe(7);
      expect(plan.searchArgv.length).toBeGreaterThan(0);
    });

    it("빈 results 배열 + 유효 run — throw 0 + summary count 0·전 슬롯 0·totalVolume 0 + commandArgs/searchArgv 정상 합성", () => {
      const plan = buildRealDataResultIssuePublishPlan([], { ...RUN_REF });

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
    });
  });

  describe("negative cases — 위임 guard 전파(command-plan 단계, searchArgv 미도달)", () => {
    it("빈 run.gitSha — buildRealDataResultIssuePublishPlan 단계에서 throw(비식별 run 차단)", () => {
      expect(() =>
        buildRealDataResultIssuePublishPlan([], {
          gitSha: "",
          dateToken: RUN_REF.dateToken,
        }),
      ).toThrow();
    });

    it("공백만의 run.gitSha — command-plan 단계에서 throw", () => {
      expect(() =>
        buildRealDataResultIssuePublishPlan([], {
          gitSha: "   ",
          dateToken: RUN_REF.dateToken,
        }),
      ).toThrow();
    });

    it("빈 run.dateToken — command-plan 단계에서 throw", () => {
      expect(() =>
        buildRealDataResultIssuePublishPlan([], {
          gitSha: RUN_REF.gitSha,
          dateToken: "",
        }),
      ).toThrow();
    });

    it("공백만의 run.dateToken — command-plan 단계에서 throw", () => {
      expect(() =>
        buildRealDataResultIssuePublishPlan([], {
          gitSha: RUN_REF.gitSha,
          dateToken: "   ",
        }),
      ).toThrow();
    });
  });

  describe("결정론·무공유 — 동일 (results, run) 두 번 호출", () => {
    it("두 plan 이 deep-equal 이면서 최상위·중첩 객체 참조가 공유되지 않는다(not.toBe)", () => {
      const results = [
        syntheticResult("github:github.com:d1", 3),
        syntheticResult("github:github.com:d2", 6),
      ];
      const a = buildRealDataResultIssuePublishPlan(results, { ...RUN_REF });
      const b = buildRealDataResultIssuePublishPlan(results, { ...RUN_REF });

      // 값은 deep-equal(결정론 — 입력만의 함수).
      expect(a).toEqual(b);

      // 참조는 무공유 — 최상위 plan + 중첩 report/commandArgs/searchArgv 전부 새 객체.
      expect(a).not.toBe(b);
      expect(a.report).not.toBe(b.report);
      expect(a.commandArgs).not.toBe(b.commandArgs);
      expect(a.searchArgv).not.toBe(b.searchArgv);
    });
  });
});
