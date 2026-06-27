// realdata-e2e-assembly.smoke-spec.ts — 실 평가 e2e 조립 체인 non-gated build-time
// smoke (T-0728 박제, PLAN.md 109행 🟢 실 평가 e2e).
//
// 본 spec 의 존재 이유 — public CI gap 해소:
//   - pure step-args 스택(buildRealDataE2eSeed → buildRealDataE2eRunPlan →
//     buildRealDataE2eStepArgs)을 한 줄로 엮는 조립(assembly) 경로를 smoke 레벨에서
//     발화하는 곳은 기존엔 test/smoke/realdata-e2e-live.smoke-spec.ts 뿐이었다. 그러나
//     그 spec 의 두 it 블록은 전부 describeLive(REALDATA_E2E_LIVE_TEST + Ollama 5종 +
//     github PAT 가 모두 set 된 경우에만 활성)으로 감싸여 있어 — public CI 기본 조건
//     (credential 0) 에서는 항상 describe.skip 분기로 흘러 **조립 체인이 한 번도
//     실행되지 않는다**. 즉 seed→run-plan→step-args 의 시그니처/배선 회귀(인자 순서
//     변경, 한쪽 산출 누락 등)는 live credential 보유자가 수동으로 돌릴 때만 잡히고
//     CI 에서는 사실상 영구히 누락된다.
//   - 본 spec 은 그 gap 을 정확히 메운다 — **gating 없이 항상 실행되는 일반 describe**
//     로 동일 조립 surface(컴포저 3종 연결)를 검증한다. live leg(EvaluationOrchestrator
//     Service / LlmHttpGateway / Ollama round-trip / 실 github 수집)는 복제하지 않고,
//     평가 결과 EvaluationResult 를 synthetic literal 로 직접 공급해 평가 leg 를
//     우회한다(조립 surface 만 검증). 따라서 본 spec 은:
//
//      🔥 실 LLM 호출 0 — orchestrator / scoring service / gateway 미사용. synthetic
//         EvaluationResult literal 을 buildRealDataE2eStepArgs 에 직접 공급.
//      🔥 실 네트워크 호출 0 — github / Ollama 호출 0. fetch 0. process.env 읽기 0.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 build* 컴포저 import 재사용만(consistency-guard
//         신설 금지 — sweep 종결, T-0726).
//
// build-time consistency-guard sweep(T-0584~T-0726) 종결과 직교한 새 방향이며,
// realdata-e2e 컴포저 sweep 의 검증된 leaf 들을 묶는 조립 spec 의 첫 진입이다.
//
// Out of Scope (T-0728):
//   - 실 LLM round-trip / EvaluationOrchestratorService / LlmHttpGateway / Ollama 호출
//     — 본 spec 은 평가 leg 를 synthetic 결과 literal 로 대체(실 평가 0). live leg 검증은
//     기존 realdata-e2e-live.smoke-spec.ts 책임.
//   - 실 github 네트워크 수집 / gh 실행 / 실 이슈 박제.
//   - 새 컴포저 / 가드 / helper 신설 — 기존 build* 컴포저 import 재사용만.
//   - production src/ 코드 변경 — test-only(신규 smoke spec 1 파일).
//   - 기존 realdata-e2e-live.smoke-spec.ts 수정 — 본 task 는 신규 파일 추가만.
import type { GithubActivity } from "../../src/assessment-collection/domain/activity";
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";
import { isContributionLevel } from "../../src/assessment-evaluation/domain/evaluation-result";
import { isDifficulty } from "../../src/llm/difficulty";
import { buildRealDataE2eRunPlan } from "../helpers/realdata-e2e-run-plan";
import { buildRealDataE2eSeed } from "../helpers/realdata-e2e-seed-fixture";
import { buildRealDataE2eStepArgs } from "../helpers/realdata-e2e-step-args";

// 본 smoke 공통 fixture — 모든 it 가 같은 결정론 입력을 공유한다(매 호출 새 객체 트리).
const MODEL_ID = "cfg-realdata-e2e-assembly-smoke";
const RUN_REF = {
  gitSha: "abc1234",
  dateToken: "2026-06-28",
} as const;
const INSTANCE_KEY = "github.com";

// synthetic GithubActivity 1 건 — author = seed 의 첫 username 으로 매칭하기 위해 helper
// 안에서 seeds 를 직접 읽어 합성한다(seed 와 activity 의 single-source 보존).
function syntheticActivity(author: string): GithubActivity {
  return {
    sourceType: "github",
    externalId: "realdata-e2e-assembly-c1",
    instanceKey: INSTANCE_KEY,
    author,
    timestamp: "2026-06-01T12:00:00Z",
    metadata: { titleLength: 42 },
    repoRef: `${author}/sample-repo`,
    kind: "commit",
  };
}

// synthetic EvaluationResult 1 건 — buildRealDataE2eStepArgs 가 평가 결과 배열을
// 그대로 publish step-args 로 흘려보내는 surface 만 검증하므로, 도메인 타입 정합
// (difficulty / contribution 멤버십)만 만족하는 minimal literal 로 충분하다. 실 LLM
// 호출 없이 EvaluationResult shape 만 강제한다.
function syntheticResult(unitId: string): EvaluationResult {
  return {
    unitId,
    narrative: "synthetic evaluation narrative — assembly smoke fixture",
    difficulty: "easy",
    contribution: "low",
    volume: 1,
  };
}

describe("Smoke(non-gated): 실 평가 e2e 조립 체인(seed→run-plan→step-args) live-LLM 0 검증", () => {
  describe("happy path — 조립된 step-args 산출", () => {
    it("seeds + runPlan + synthetic results 로 step-args 가 evaluation/publish 양 측을 동시에 조립한다", () => {
      // (1) seed 빌더 — 무인자 결정론 상수 빌더.
      const seeds = buildRealDataE2eSeed();
      expect(seeds.length).toBeGreaterThan(0);
      const firstUsername = seeds[0].serviceIdentities[0].externalId;

      // (2) run plan 단일 진입 — modelId·run 을 한 번에 fail-fast 검증.
      const runPlan = buildRealDataE2eRunPlan(seeds, MODEL_ID, { ...RUN_REF });
      expect(runPlan.pipeline.modelId).toBe(MODEL_ID);
      expect(runPlan.run).toEqual(RUN_REF);

      // (3) step-args 단일 aggregator — 단일 runPlan source 가 평가·publish 양 측에
      // 동시 thread 됨을 확인. synthetic EvaluationResult 1 건 + synthetic activity 1 건.
      const activities = [syntheticActivity(firstUsername)];
      const results = [
        syntheticResult(`github:${INSTANCE_KEY}:realdata-e2e-assembly-c1`),
      ];
      const stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results);

      // 평가측 / publish측 둘 다 정의됨(단일 runPlan 에서 thread).
      expect(stepArgs.evaluation).toBeDefined();
      expect(stepArgs.publish).toBeDefined();
    });

    it("결정성 — 동일 (seeds, modelId, run, activities, results) 두 번 호출 → deep-equal 산출(공유 mutable 노출 0)", () => {
      const seeds = buildRealDataE2eSeed();
      const firstUsername = seeds[0].serviceIdentities[0].externalId;
      const runPlan1 = buildRealDataE2eRunPlan(seeds, MODEL_ID, { ...RUN_REF });
      const runPlan2 = buildRealDataE2eRunPlan(
        buildRealDataE2eSeed(),
        MODEL_ID,
        { ...RUN_REF },
      );
      const activities = [syntheticActivity(firstUsername)];
      const results = [
        syntheticResult(`github:${INSTANCE_KEY}:realdata-e2e-assembly-c1`),
      ];

      const a = buildRealDataE2eStepArgs(runPlan1, activities, results);
      const b = buildRealDataE2eStepArgs(runPlan2, activities, results);
      expect(a).toEqual(b);
      // 새 컨테이너 객체 반환 — 두 호출이 같은 reference 를 공유하지 않음.
      expect(a).not.toBe(b);
    });
  });

  describe("flow / branch — 빈 배열 경계", () => {
    it("빈 activities + 빈 results — throw 0 으로 조립 산출(위임 helper 의 빈-배열 분기가 조립 경로로도 도달)", () => {
      const seeds = buildRealDataE2eSeed();
      const runPlan = buildRealDataE2eRunPlan(seeds, MODEL_ID, { ...RUN_REF });
      const stepArgs = buildRealDataE2eStepArgs(runPlan, [], []);
      expect(stepArgs.evaluation).toBeDefined();
      expect(stepArgs.publish).toBeDefined();
    });

    it("단일 element activities/results — throw 0 으로 조립 산출(분기 mirror)", () => {
      const seeds = buildRealDataE2eSeed();
      const firstUsername = seeds[0].serviceIdentities[0].externalId;
      const runPlan = buildRealDataE2eRunPlan(seeds, MODEL_ID, { ...RUN_REF });
      const activities = [syntheticActivity(firstUsername)];
      const results = [
        syntheticResult(`github:${INSTANCE_KEY}:realdata-e2e-assembly-c1`),
      ];
      const stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results);
      expect(stepArgs.evaluation).toBeDefined();
      expect(stepArgs.publish).toBeDefined();
    });
  });

  describe("negative cases — 조립 체인의 위임 guard 전파", () => {
    it("빈 modelId — buildRealDataE2eRunPlan 단계에서 throw(체인 진입 전 차단)", () => {
      const seeds = buildRealDataE2eSeed();
      expect(() =>
        buildRealDataE2eRunPlan(seeds, "", { ...RUN_REF }),
      ).toThrow();
    });

    it("공백만의 modelId — buildRealDataE2eRunPlan 단계에서 throw", () => {
      const seeds = buildRealDataE2eSeed();
      expect(() =>
        buildRealDataE2eRunPlan(seeds, "   ", { ...RUN_REF }),
      ).toThrow();
    });

    it("빈 run.gitSha — buildRealDataE2eRunPlan 단계에서 throw(비식별 run 차단)", () => {
      const seeds = buildRealDataE2eSeed();
      expect(() =>
        buildRealDataE2eRunPlan(seeds, MODEL_ID, {
          gitSha: "",
          dateToken: RUN_REF.dateToken,
        }),
      ).toThrow();
    });

    it("공백만의 run.gitSha — buildRealDataE2eRunPlan 단계에서 throw", () => {
      const seeds = buildRealDataE2eSeed();
      expect(() =>
        buildRealDataE2eRunPlan(seeds, MODEL_ID, {
          gitSha: "  ",
          dateToken: RUN_REF.dateToken,
        }),
      ).toThrow();
    });

    it("빈 run.dateToken — buildRealDataE2eRunPlan 단계에서 throw", () => {
      const seeds = buildRealDataE2eSeed();
      expect(() =>
        buildRealDataE2eRunPlan(seeds, MODEL_ID, {
          gitSha: RUN_REF.gitSha,
          dateToken: "",
        }),
      ).toThrow();
    });

    it("공백만의 run.dateToken — buildRealDataE2eRunPlan 단계에서 throw", () => {
      const seeds = buildRealDataE2eSeed();
      expect(() =>
        buildRealDataE2eRunPlan(seeds, MODEL_ID, {
          gitSha: RUN_REF.gitSha,
          dateToken: "   ",
        }),
      ).toThrow();
    });
  });

  describe("type 정합 — synthetic 결과가 허용 멤버 집합에 머문다", () => {
    it("syntheticResult 의 difficulty / contribution 이 허용 union 멤버", () => {
      const result = syntheticResult(`github:${INSTANCE_KEY}:probe`);
      expect(isDifficulty(result.difficulty)).toBe(true);
      expect(isContributionLevel(result.contribution)).toBe(true);
      expect(typeof result.volume).toBe("number");
      expect(result.volume).toBeGreaterThanOrEqual(0);
    });
  });
});
