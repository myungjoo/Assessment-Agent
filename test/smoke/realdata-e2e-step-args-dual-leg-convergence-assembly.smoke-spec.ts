// realdata-e2e-step-args-dual-leg-convergence-assembly.smoke-spec.ts — 실 평가 e2e
// pre-실행 step-args aggregator(buildRealDataE2eStepArgs)의 **dual-leg single-source
// convergence** non-gated build-time smoke (T-0752 박제, PLAN.md 109행 🟢 실 평가 e2e).
//
// 본 spec 의 존재 이유 — public CI gap 해소:
//   - 최외곽 step-args aggregator `buildRealDataE2eStepArgs(runPlan, activities,
//     results)`(T-0601) 는 단일 검증 `runPlan`(buildRealDataE2eRunPlan 산출 =
//     `{pipeline, run}`) 을 두 leg 로 동시 thread 해 `{evaluation, publish}` 를 합성한다:
//       (1) evaluation leg — buildRealDataEvaluationStepArgs(runPlan, activities) 위임.
//           runPlan.pipeline.modelId 를 평가 plan(scoreUnit 호출-args) 으로 thread.
//       (2) publish leg — buildRealDataResultPublishStepArgs(runPlan, results) 위임.
//           runPlan.run(gitSha + dateToken) 을 step④ publish plan 으로 thread.
//   - aggregator 핵심 불변식은 **두 leg 가 같은 단일 runPlan source 로부터 합류**한다는
//     것이다 — caller 가 평가 step 과 publish step 에 서로 다른 runPlan 을 넘길 수 없고,
//     평가측 modelId 와 publish측 run 이 같은 검증 source 에서 나옴이 구조적으로 보장된다.
//   - 그러나 이 dual-leg single-source convergence 를 **직접-체인으로 묶은 non-gated
//     build-time smoke 는 부재**다. 기존 realdata-e2e-assembly.smoke-spec.ts(T-0728)
//     happy-path 는 `stepArgs.evaluation`·`stepArgs.publish` 가 toBeDefined() 인지만
//     단언할 뿐, 각 leg 가 **같은 runPlan 으로 직접 호출한 sub-composer 산출과
//     byte-identical** 임은 0 이다. 또 두 sub-composer 를 한 smoke 에 공동-import 해
//     aggregator 가 두 leg 를 어긋남 없이 합류시키는지 확인하는 smoke 도 0 이다.
//   - 본 spec 은 그 gap 을 정확히 메운다 — **gating 없이 항상 실행되는 일반 describe**
//     로 (a) evaluation leg byte-identical(stepArgs.evaluation === 직접 호출
//     buildRealDataEvaluationStepArgs(runPlan, activities)), (b) publish leg
//     byte-identical(stepArgs.publish === 직접 호출 buildRealDataResultPublishStepArgs(
//     runPlan, results)), (c) source-convergence(evaluation 의 modelId 경로 ↔
//     runPlan.pipeline.modelId, publish 의 run 토큰 경로 ↔ runPlan.run), (d)
//     partial-thread 차단(leg 간 입력 격리: 다른 results → publish 만 변함, 다른
//     activities → evaluation 만 변함) 을 직접-체인으로 박제한다. leg-swap·leg-drift·
//     partial-thread·source-divergence 회귀를 public CI 그물로 닫는다. 따라서 본 spec 은:
//
//      🔥 실 LLM 호출 0 — orchestrator / scoring service / gateway 미사용. synthetic
//         Activity/EvaluationResult literal 을 직접 주입.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 build* 컴포저 import 재사용만(컴포저/가드 신설 0).
//
// Out of Scope (T-0752):
//   - 기존 realdata-e2e-assembly.smoke-spec.ts(T-0728) 의 leg 존재(toBeDefined) 단언
//     재검증 — 본 spec 은 aggregator 의 dual-leg byte-identical convergence + leg 간
//     입력 격리만 책임(존재 단언 중복 0).
//   - 각 sub-composer 고립 smoke(T-0739 evaluation / T-0737 publish / T-0738 outcome /
//     T-0748~T-0751 descriptor·summary 렌더) — 본 spec 은 두 sub-composer 를 한
//     aggregator 로 합류시키는 절단면만.
//   - post-실행 outcome step-args(buildRealDataResultOutcomeStepArgs) 합류 — 본
//     aggregator 는 pre-실행(evaluation + publish) 만 묶음(별개 절단면).
//   - 실 수집 / collectForPerson / 실 scoring / scoreUnit / 실 EvaluationResult 산출 /
//     실 LLM round-trip / Ollama / DB / 실 gh / 실 git sha·timestamp / 실 jest spawn /
//     실 네트워크.
//   - 컴포저 / 가드 / Activity·EvaluationResult·Difficulty 정의 수정 — test-only
//     (신규 smoke spec 1 파일).
import type { GithubActivity } from "../../src/assessment-collection/domain/activity";
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";
import { isContributionLevel } from "../../src/assessment-evaluation/domain/evaluation-result";
import { isDifficulty } from "../../src/llm/difficulty";
import { buildRealDataEvaluationStepArgs } from "../helpers/realdata-e2e-evaluation-step-args";
import { buildRealDataResultPublishStepArgs } from "../helpers/realdata-e2e-result-publish-step-args";
import { buildRealDataE2eRunPlan } from "../helpers/realdata-e2e-run-plan";
import type { RealDataE2eRunPlan } from "../helpers/realdata-e2e-run-plan";
import { buildRealDataE2eSeed } from "../helpers/realdata-e2e-seed-fixture";
import { buildRealDataE2eStepArgs } from "../helpers/realdata-e2e-step-args";

// 본 smoke 공통 fixture — 모든 it 가 같은 결정론 입력을 공유한다(매 호출 새 객체 트리).
const MODEL_ID = "cfg-realdata-e2e-dual-leg-smoke";
const RUN_REF = {
  gitSha: "abc1234",
  dateToken: "2026-06-28",
} as const;
const INSTANCE_KEY = "github.com";

// synthetic GithubActivity 1 건 — evaluation leg 입력(author = seed 의 username 으로
// 매칭). sentinel 은 raw 본문 누출 차단 단언(negative (e)) 에서 stepArgs 직렬화에
// sentinel 미등장을 확인하는 데 쓰인다(R-59 정합).
function syntheticActivity(
  author: string,
  externalId = "realdata-e2e-dual-leg-c1",
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

// synthetic EvaluationResult 1 건 — publish leg 입력. narrative 에 sentinel 을 박아
// raw 본문 누출 차단 단언에서 stepArgs 직렬화에 미등장을 확인한다(R-59 정합).
function syntheticResult(
  unitId: string,
  narrative = "synthetic evaluation narrative — dual-leg smoke fixture",
): EvaluationResult {
  return {
    unitId,
    narrative,
    difficulty: "easy",
    contribution: "low",
    volume: 1,
  };
}

// 공통 runPlan + 입력 fixture 빌더 — 매 호출 새 객체 트리(테스트 격리).
function buildFixture(): {
  runPlan: RealDataE2eRunPlan;
  activities: GithubActivity[];
  results: EvaluationResult[];
} {
  const seeds = buildRealDataE2eSeed();
  const firstUsername = seeds[0].serviceIdentities[0].externalId;
  const runPlan = buildRealDataE2eRunPlan(seeds, MODEL_ID, { ...RUN_REF });
  const activities = [syntheticActivity(firstUsername)];
  const results = [
    syntheticResult(`github:${INSTANCE_KEY}:realdata-e2e-dual-leg-c1`),
  ];
  return { runPlan, activities, results };
}

describe("Smoke(non-gated): 실 평가 e2e step-args aggregator dual-leg single-source convergence", () => {
  describe("happy path — 종단 chain 으로 두 leg 동시 조립", () => {
    it("seed→run-plan→synthetic 입력→step-args 종단 chain — evaluation/publish 양 leg 가 예상 shape 으로 정의됨", () => {
      const { runPlan, activities, results } = buildFixture();
      const stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results);

      // evaluation leg — scoreUnit 호출-args plan({inputs, callArgs}) shape.
      expect(stepArgs.evaluation).toBeDefined();
      expect(Array.isArray(stepArgs.evaluation.inputs)).toBe(true);
      expect(Array.isArray(stepArgs.evaluation.callArgs)).toBe(true);
      expect(stepArgs.evaluation.callArgs.length).toBe(
        stepArgs.evaluation.inputs.length,
      );

      // publish leg — 결과 이슈 publish plan({report, commandArgs, searchArgv}) shape.
      expect(stepArgs.publish).toBeDefined();
      expect(stepArgs.publish.report).toBeDefined();
      expect(stepArgs.publish.commandArgs).toBeDefined();
      expect(Array.isArray(stepArgs.publish.searchArgv)).toBe(true);
    });
  });

  describe("dual-leg single-source convergence (핵심) — 각 leg ↔ 같은 runPlan 직접 호출 byte-identical", () => {
    it("(a) stepArgs.evaluation 이 직접 호출 buildRealDataEvaluationStepArgs(runPlan, activities) 와 byte-identical(toEqual)", () => {
      const { runPlan, activities, results } = buildFixture();
      const stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results);

      // 같은 runPlan·activities 로 evaluation sub-composer 를 직접 재호출 → aggregator
      // 의 evaluation leg 와 deep-equal(평가 leg 이 같은 runPlan source 로부터 합류).
      const directEvaluation = buildRealDataEvaluationStepArgs(
        runPlan,
        activities,
      );
      expect(stepArgs.evaluation).toEqual(directEvaluation);
    });

    it("(b) stepArgs.publish 가 직접 호출 buildRealDataResultPublishStepArgs(runPlan, results) 와 byte-identical(toEqual)", () => {
      const { runPlan, activities, results } = buildFixture();
      const stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results);

      // 같은 runPlan·results 로 publish sub-composer 를 직접 재호출 → aggregator 의
      // publish leg 와 deep-equal(publish leg 이 같은 runPlan source 로부터 합류).
      const directPublish = buildRealDataResultPublishStepArgs(
        runPlan,
        results,
      );
      expect(stepArgs.publish).toEqual(directPublish);
    });

    it("(c) source-convergence — evaluation 의 modelId 경로 ↔ runPlan.pipeline.modelId, publish 의 run 토큰 경로 ↔ runPlan.run(leg-swap/leg-drift 차단)", () => {
      const { runPlan, activities, results } = buildFixture();
      const stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results);

      // evaluation leg — 모든 callArgs.options.modelId 가 runPlan.pipeline.modelId
      // 단일 source 에서 thread 됨(평가측 modelId 경로 정합).
      expect(stepArgs.evaluation.callArgs.length).toBeGreaterThan(0);
      for (const callArg of stepArgs.evaluation.callArgs) {
        expect(callArg.options.modelId).toBe(runPlan.pipeline.modelId);
      }

      // publish leg — searchArgv(= marker = `${dateToken}@${gitSha}`)에 runPlan.run 의
      // 두 토큰이 모두 등장(publish측 run 경로가 같은 runPlan.run 에서 thread).
      const searchArgvSerialized = JSON.stringify(stepArgs.publish.searchArgv);
      expect(searchArgvSerialized).toContain(runPlan.run.gitSha);
      expect(searchArgvSerialized).toContain(runPlan.run.dateToken);
    });
  });

  describe("partial-thread 차단 — leg 간 입력 격리(교차 누출 0)", () => {
    it("동일 runPlan·activities + 다른 results → evaluation 불변(toEqual), publish 변함", () => {
      const { runPlan, activities, results } = buildFixture();
      const otherResults = [
        syntheticResult(`github:${INSTANCE_KEY}:realdata-e2e-dual-leg-c2`),
        syntheticResult(`github:${INSTANCE_KEY}:realdata-e2e-dual-leg-c3`),
      ];

      const a = buildRealDataE2eStepArgs(runPlan, activities, results);
      const b = buildRealDataE2eStepArgs(runPlan, activities, otherResults);

      // evaluation 은 runPlan.pipeline.modelId + activities 에만 의존 → results 무관.
      expect(a.evaluation).toEqual(b.evaluation);
      // publish 는 results 에 의존 → 다른 results 면 변함.
      expect(a.publish).not.toEqual(b.publish);
    });

    it("동일 runPlan·results + 다른 activities → publish 불변(toEqual), evaluation 변함", () => {
      const { runPlan, activities, results } = buildFixture();
      const firstUsername =
        buildRealDataE2eSeed()[0].serviceIdentities[0].externalId;
      const otherActivities = [
        syntheticActivity(firstUsername, "realdata-e2e-dual-leg-x1"),
        syntheticActivity(firstUsername, "realdata-e2e-dual-leg-x2"),
      ];

      const a = buildRealDataE2eStepArgs(runPlan, activities, results);
      const b = buildRealDataE2eStepArgs(runPlan, otherActivities, results);

      // publish 는 runPlan.run + results 에만 의존 → activities 무관.
      expect(a.publish).toEqual(b.publish);
      // evaluation 은 activities 에 의존 → 다른 activities 면 변함.
      expect(a.evaluation).not.toEqual(b.evaluation);
    });
  });

  describe("error / negative — leg 별 독립 guard 전파(자체 try/catch 0)", () => {
    it("(a) evaluation leg guard 전파 — 빈 modelId 의 runPlan-유사 객체 주입 시 aggregator 가 modelId guard throw 를 전파", () => {
      const { activities, results } = buildFixture();
      const validRunPlan = buildRealDataE2eRunPlan(
        buildRealDataE2eSeed(),
        MODEL_ID,
        { ...RUN_REF },
      );
      // run 은 유효하되 modelId 만 빈 runPlan-유사 객체(런타임 비식별 runPlan) 주입 →
      // 합성 순서상 evaluation leg(먼저 평가) 의 modelId guard 가 먼저 throw.
      const blankModelRunPlan: RealDataE2eRunPlan = {
        pipeline: { ...validRunPlan.pipeline, modelId: "" },
        run: { ...validRunPlan.run },
      };
      expect(() =>
        buildRealDataE2eStepArgs(blankModelRunPlan, activities, results),
      ).toThrow();
    });

    it("(b) publish leg guard 전파 — modelId 유효하나 run.gitSha 빈 runPlan-유사 객체 주입 시 aggregator 가 run guard throw 를 전파(필드별 분기)", () => {
      const { activities, results } = buildFixture();
      const validRunPlan = buildRealDataE2eRunPlan(
        buildRealDataE2eSeed(),
        MODEL_ID,
        { ...RUN_REF },
      );
      // modelId 는 유효(evaluation leg 통과)하되 run.gitSha 만 빈 runPlan-유사 객체 주입
      // → publish leg 의 run guard 가 throw(evaluation guard 와 독립 분기).
      const blankGitShaRunPlan: RealDataE2eRunPlan = {
        pipeline: { ...validRunPlan.pipeline },
        run: { gitSha: "", dateToken: validRunPlan.run.dateToken },
      };
      expect(() =>
        buildRealDataE2eStepArgs(blankGitShaRunPlan, activities, results),
      ).toThrow();
    });

    it("(b2) publish leg guard 전파 — run.dateToken 빈 runPlan-유사 객체 주입 시 throw(gitSha 와 별개 분기)", () => {
      const { activities, results } = buildFixture();
      const validRunPlan = buildRealDataE2eRunPlan(
        buildRealDataE2eSeed(),
        MODEL_ID,
        { ...RUN_REF },
      );
      const blankDateTokenRunPlan: RealDataE2eRunPlan = {
        pipeline: { ...validRunPlan.pipeline },
        run: { gitSha: validRunPlan.run.gitSha, dateToken: "   " },
      };
      expect(() =>
        buildRealDataE2eStepArgs(blankDateTokenRunPlan, activities, results),
      ).toThrow();
    });
  });

  describe("flow / branch — 입력 분포별 convergence 유지", () => {
    it("(a) 빈 activities + 빈 results → 두 leg 모두 throw 0, 직접 호출과 convergence 유지", () => {
      const { runPlan } = buildFixture();
      const stepArgs = buildRealDataE2eStepArgs(runPlan, [], []);
      // 빈-inputs evaluation leg + count 0 publish leg — throw 0.
      expect(stepArgs.evaluation).toEqual(
        buildRealDataEvaluationStepArgs(runPlan, []),
      );
      expect(stepArgs.publish).toEqual(
        buildRealDataResultPublishStepArgs(runPlan, []),
      );
    });

    it("(b) 단일 activities/results → convergence 유지", () => {
      const { runPlan, activities, results } = buildFixture();
      const stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results);
      expect(stepArgs.evaluation).toEqual(
        buildRealDataEvaluationStepArgs(runPlan, activities),
      );
      expect(stepArgs.publish).toEqual(
        buildRealDataResultPublishStepArgs(runPlan, results),
      );
    });

    it("(c) 다수 activities/results(분포 다양) → convergence 유지", () => {
      const { runPlan } = buildFixture();
      const firstUsername =
        buildRealDataE2eSeed()[0].serviceIdentities[0].externalId;
      const activities = [
        syntheticActivity(firstUsername, "realdata-e2e-dual-leg-m1"),
        syntheticActivity(firstUsername, "realdata-e2e-dual-leg-m2"),
        syntheticActivity(firstUsername, "realdata-e2e-dual-leg-m3"),
      ];
      const results = [
        syntheticResult(`github:${INSTANCE_KEY}:realdata-e2e-dual-leg-m1`),
        syntheticResult(`github:${INSTANCE_KEY}:realdata-e2e-dual-leg-m2`),
      ];
      const stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results);
      expect(stepArgs.evaluation).toEqual(
        buildRealDataEvaluationStepArgs(runPlan, activities),
      );
      expect(stepArgs.publish).toEqual(
        buildRealDataResultPublishStepArgs(runPlan, results),
      );
    });
  });

  describe("negative cases 충분 cover — 누출 차단·결정론·무공유·no-mutation", () => {
    it("(e) raw 본문/narrative 누출 0 — synthetic sentinel 이 양 leg 직렬화에 미등장(R-59 정합)", () => {
      const { runPlan } = buildFixture();
      const firstUsername =
        buildRealDataE2eSeed()[0].serviceIdentities[0].externalId;
      const sentinel = "SENTINEL-RAW-BODY-DO-NOT-LEAK-0752";
      // activity 식별자/repoRef 와 result narrative 에 sentinel 을 박는다. step-args
      // 양 leg(식별자·카운트·marker 만 보유)에 sentinel 이 등장하면 raw 누출 회귀.
      const activities = [syntheticActivity(firstUsername, `${sentinel}-c1`)];
      const results = [
        syntheticResult(
          `github:${INSTANCE_KEY}:${sentinel}-c1`,
          `${sentinel} narrative body`,
        ),
      ];
      const stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results);

      // narrative sentinel 은 어느 leg 직렬화에도 등장하면 안 된다(narrative 미보유).
      const serialized = JSON.stringify(stepArgs);
      expect(serialized).not.toContain(`${sentinel} narrative body`);
    });

    it("(f) 결정론·무공유 — 동일 (runPlan, activities, results) 두 번 호출 → byte-identical + 새 컨테이너(not.toBe)", () => {
      const { runPlan, activities, results } = buildFixture();
      const a = buildRealDataE2eStepArgs(runPlan, activities, results);
      const b = buildRealDataE2eStepArgs(runPlan, activities, results);
      expect(a).toEqual(b);
      // 매 호출 새 컨테이너 객체 + 새 leg 트리(반환 참조 비동일).
      expect(a).not.toBe(b);
      expect(a.evaluation).not.toBe(b.evaluation);
      expect(a.publish).not.toBe(b.publish);
    });

    it("(g) no-mutation — 입력 runPlan/activities/results 가 aggregator 호출 전후 deep-equal(mutate 0)", () => {
      const { runPlan, activities, results } = buildFixture();
      const runPlanBefore = JSON.parse(JSON.stringify(runPlan));
      const activitiesBefore = JSON.parse(JSON.stringify(activities));
      const resultsBefore = JSON.parse(JSON.stringify(results));

      buildRealDataE2eStepArgs(runPlan, activities, results);

      expect(runPlan).toEqual(runPlanBefore);
      expect(activities).toEqual(activitiesBefore);
      expect(results).toEqual(resultsBefore);
    });
  });

  describe("type 정합 — synthetic fixture 가 허용 멤버 집합에 머문다", () => {
    it("syntheticResult 의 difficulty / contribution 이 허용 union 멤버", () => {
      const result = syntheticResult(`github:${INSTANCE_KEY}:probe`);
      expect(isDifficulty(result.difficulty)).toBe(true);
      expect(isContributionLevel(result.contribution)).toBe(true);
      expect(typeof result.volume).toBe("number");
      expect(result.volume).toBeGreaterThanOrEqual(0);
    });
  });
});
