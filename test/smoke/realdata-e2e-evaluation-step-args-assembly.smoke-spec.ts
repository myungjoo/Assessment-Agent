// realdata-e2e-evaluation-step-args-assembly.smoke-spec.ts — 실 평가 e2e
// evaluation step-args 조립 체인 non-gated build-time smoke (T-0739 박제,
// PLAN.md 109행 🟢 실 평가 e2e, step ②(수집)→step ③(평가) 경계).
//
// 본 spec 의 존재 이유 — public CI gap 해소(step④ T-0737 publish / T-0738 outcome
// 조립 smoke 의 step②③ 대칭 sibling):
//   - PLAN 109행 step ②(수집)→step ③(평가) 경계의 run-plan 연결은 순수 컴포저
//     `buildRealDataEvaluationStepArgs(runPlan, activities)`(T-0598 + self-wire)가
//     닫는다 — seed-side 최외곽 진입 `buildRealDataE2eRunPlan(seeds, modelId, run)`
//     (T-0597)이 산출한 검증된 `runPlan.pipeline.modelId` **만을** 평가 plan 으로
//     thread 해 step ①↔step ③ 의 모델 정책 일관을 구조적으로 보장하고(modelId
//     재전달 0), `buildRealDataEvaluationPlan(activities, runPlan.pipeline.modelId)`
//     (T-0591) 로 위임해 `{ inputs, callArgs }` 를 합성한다.
//   - 이 컴포저는 unit(`realdata-e2e-evaluation-step-args.spec.ts`) +
//     consistency(`...-consistency.spec.ts`) spec 으로 닫혀 있으나, **seed→run-plan
//     →evaluation-step-args 를 묶은 조립 체인 단위의 non-gated build-time smoke** 는
//     부재였다 — 기존 `realdata-e2e-evaluation-plan-assembly.smoke-spec.ts`(T-0730)는
//     `buildRealDataEvaluationPlan(activities, modelId)` **직접 진입**이라 modelId 를
//     독립 인자로 받아 run-plan threading layer 밖이다. 즉 step① 과 step③ 의 modelId
//     drift(두 군데 수동 전달로 인한 모델 정책 불일치) 회귀는 public CI 에서 한 번도
//     발화되지 않고 credential-gated live smoke(`realdata-e2e-live.smoke-spec.ts`)가
//     set-up 된 경우에만 잡혔다.
//   - 본 spec 은 그 gap 을 메운다 — **gating 없이 항상 실행되는 일반 describe** 로
//     seed→run-plan→evaluation-step-args 조립 surface(run-plan modelId-threading)를
//     검증한다. 평가 leg(실 LLM / EvaluationOrchestratorService / LlmHttpGateway /
//     Ollama / scoreUnit / 실 github 수집 / 실 gh / 실 jest spawn)는 복제하지 않고,
//     synthetic Activity[] literal 을 직접 공급해 평가 leg 를 우회한다(조립 surface 만
//     검증). 따라서 본 spec 은:
//
//      🔥 실 LLM 호출 0 — orchestrator / scoring service / gateway 미사용. synthetic
//         Activity[] literal 을 buildRealDataEvaluationStepArgs 에 직접 공급.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 DB 접근 0 / 실 jest spawn 0 — seed→run-plan→evaluation-step-args 조립만.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 build* 컴포저 import 재사용만(consistency-guard
//         신설 금지 — sweep 종결, T-0726).
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0739):
//   - 실 LLM round-trip / EvaluationOrchestratorService / LlmHttpGateway / Ollama /
//     scoreUnit 호출 — 본 spec 은 평가 leg 를 synthetic Activity[] literal 로 대체(실
//     평가 0). live leg 검증은 기존 realdata-e2e-live.smoke-spec.ts 책임.
//   - 실 github 네트워크 수집 / gh 실행 / 실 이슈 박제 / 실 jest 프로세스 spawn.
//   - 기존 `realdata-e2e-evaluation-plan-assembly.smoke-spec.ts`(T-0730,
//     `buildRealDataEvaluationPlan` 직접 진입) — 본 task 는 그 위의 run-plan threading
//     layer(`buildRealDataEvaluationStepArgs`)만 책임. 직접 진입 smoke 수정·중복 0.
//   - step④ pre-실행 publish-step-args(T-0737) / post-실행 outcome-step-args(T-0738)
//     의 조립 smoke — 본 task 는 step②③ evaluation-step-args 만 책임.
//   - 새 컴포저 / 가드 / helper / consistency-guard 신설 — 기존 build* 컴포저 import
//     재사용만(sweep 종결 준수).
//   - production src/ 코드 / 기존 컴포저 소스 / 위임 helper / consistency 가드 수정 —
//     test-only(신규 smoke spec 1 파일).
//   - T-0728/T-0729/T-0730/T-0731/T-0736/T-0737/T-0738 의 기존 조립 smoke 파일 수정 —
//     file-disjoint 병렬 stream(본 task 는 신규 파일 추가만).
import type { GithubActivity } from "../../src/assessment-collection/domain/activity";
import { buildRealDataEvaluationPlan } from "../helpers/realdata-e2e-evaluation-plan";
import { buildRealDataEvaluationStepArgs } from "../helpers/realdata-e2e-evaluation-step-args";
import type { RealDataResultIssueRunRef } from "../helpers/realdata-e2e-result-issue-descriptor";
import { buildRealDataE2eRunPlan } from "../helpers/realdata-e2e-run-plan";
import type { RealDataE2eRunPlan } from "../helpers/realdata-e2e-run-plan";
import { buildRealDataE2eSeed } from "../helpers/realdata-e2e-seed-fixture";

// 본 smoke 공통 fixture — 유효 modelId(비공백) 결정론 상수. 평가 plan threading 의
// single source — runPlan.pipeline.modelId 로 보존됨을 본 spec 이 검증한다.
const MODEL_ID = "cfg-realdata-e2e-evaluation-step-args-assembly-smoke";

// 본 smoke 공통 fixture — 결정론 run 식별자(gitSha + dateToken 비공백). 평가
// step-args 는 run 식별자를 직접 쓰지 않지만, run-plan 구성에 유효 run 이 필요하므로
// 매 it 가 spread 복제로 받아 입력 mutate 누설이 없도록 한다.
const RUN_REF: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-06-28",
};

// synthetic GithubActivity 1 건 — evaluation-step-args 컴포저는 Activity[] →
// EvaluationInput[] → scoreUnit 호출-args 묶음으로 흘려보내는 surface 만 검증하므로,
// 도메인 타입 정합(REQ-032 raw-not-stored — metadata scalar 만)만 만족하는 minimal
// literal 로 충분하다. 실 github 수집 없이 GithubActivity shape 만 강제한다.
function syntheticActivity(externalId: string, author: string): GithubActivity {
  return {
    sourceType: "github",
    externalId,
    instanceKey: "github.com",
    author,
    timestamp: "2026-06-01T12:00:00Z",
    metadata: { titleLength: 42 },
    repoRef: `${author}/sample-repo`,
    kind: "commit",
  };
}

// 유효 runPlan 을 결정론 seed + modelId + run 으로 조립하는 헬퍼 — happy/flow/결정론
// case 의 공통 진입. run 은 spread 복제로 넘겨 입력 RUN_REF mutate 누설 0.
function buildValidRunPlan(): RealDataE2eRunPlan {
  return buildRealDataE2eRunPlan(buildRealDataE2eSeed(), MODEL_ID, {
    ...RUN_REF,
  });
}

describe("Smoke(non-gated): 실 평가 e2e evaluation step-args 조립 체인(seed→run-plan→evaluation-step-args) live-LLM 0 검증", () => {
  describe("happy path — 조립된 evaluation-step-args plan 산출", () => {
    it("seed + 유효 modelId + 유효 run 으로 runPlan 구성 후 다수 activities 와 함께 호출 → inputs/callArgs 조립 + 길이·reference 페어링 정합", () => {
      // (1) seed→run-plan 으로 검증된 runPlan 구성(modelId 단일 source 진입).
      const runPlan = buildValidRunPlan();
      expect(runPlan.pipeline.modelId).toBe(MODEL_ID);

      // (2) evaluation-step-args 단일 진입 — runPlan.pipeline.modelId 만 thread.
      const activities = [
        syntheticActivity("realdata-e2e-eval-step-args-c1", "alice"),
        syntheticActivity("realdata-e2e-eval-step-args-c2", "bob"),
      ];
      const plan = buildRealDataEvaluationStepArgs(runPlan, activities);

      // 두 산출 필드 모두 정의({ inputs, callArgs } shape 충족).
      expect(plan.inputs).toBeDefined();
      expect(plan.callArgs).toBeDefined();

      // 길이 정합 — inputs.length === callArgs.length === activities.length.
      expect(plan.inputs).toHaveLength(activities.length);
      expect(plan.callArgs).toHaveLength(activities.length);

      // callArgs[i].input === inputs[i] reference 페어링 보존(EvaluationInput 복제 0).
      for (let i = 0; i < plan.callArgs.length; i += 1) {
        expect(plan.callArgs[i].input).toBe(plan.inputs[i]);
      }
    });
  });

  describe("modelId 단일 source 조립 단언 — runPlan.pipeline.modelId 만 thread(재전달 0)", () => {
    it("조립 산출이 동일 activities 를 buildRealDataEvaluationPlan(activities, runPlan.pipeline.modelId) 로 직접 호출한 결과와 deep-equal(modelId 를 runPlan 에서만 thread)", () => {
      const runPlan = buildValidRunPlan();
      const activities = [
        syntheticActivity("realdata-e2e-eval-step-args-s1", "carol"),
        syntheticActivity("realdata-e2e-eval-step-args-s2", "dave"),
      ];

      // 조립 체인 진입(runPlan.pipeline.modelId 단일 source thread).
      const viaStepArgs = buildRealDataEvaluationStepArgs(runPlan, activities);
      // 위임 대상을 runPlan.pipeline.modelId 로 직접 호출(single-source 재유도).
      const viaDelegate = buildRealDataEvaluationPlan(
        activities,
        runPlan.pipeline.modelId,
      );

      // 조립 체인이 modelId 를 재전달 없이 runPlan 에서만 thread 하므로 byte-identical.
      expect(viaStepArgs).toEqual(viaDelegate);
    });

    it("모든 callArgs[i].options.modelId 가 runPlan.pipeline.modelId 와 동일(step①↔step③ 모델 정책 일관)", () => {
      const runPlan = buildValidRunPlan();
      const activities = [
        syntheticActivity("realdata-e2e-eval-step-args-m1", "erin"),
        syntheticActivity("realdata-e2e-eval-step-args-m2", "frank"),
        syntheticActivity("realdata-e2e-eval-step-args-m3", "grace"),
      ];

      const plan = buildRealDataEvaluationStepArgs(runPlan, activities);

      // 단일 source modelId 가 모든 호출-args options 에 동형 적용됨.
      expect(plan.callArgs).toHaveLength(activities.length);
      for (const callArg of plan.callArgs) {
        expect(callArg.options.modelId).toBe(runPlan.pipeline.modelId);
        expect(callArg.options.modelId).toBe(MODEL_ID);
      }
    });
  });

  describe("flow / branch — 빈 / 단일 / 다수 activities 경로", () => {
    it("빈 activities 배열([]) + 유효 runPlan — throw 0 + { inputs: [], callArgs: [] } 빈 plan 반환", () => {
      const runPlan = buildValidRunPlan();
      const plan = buildRealDataEvaluationStepArgs(runPlan, []);

      // 빈-배열 분기 — 위임 helper 의 빈-배열 경로가 조립 경로로도 도달(throw 0).
      expect(plan.inputs).toEqual([]);
      expect(plan.callArgs).toEqual([]);
    });

    it("단일 activity — throw 0 으로 1:1 페어링 조립(분기 mirror)", () => {
      const runPlan = buildValidRunPlan();
      const activities = [
        syntheticActivity("realdata-e2e-eval-step-args-single", "heidi"),
      ];
      const plan = buildRealDataEvaluationStepArgs(runPlan, activities);

      expect(plan.inputs).toHaveLength(1);
      expect(plan.callArgs).toHaveLength(1);
      expect(plan.callArgs[0].input).toBe(plan.inputs[0]);
      expect(plan.callArgs[0].options.modelId).toBe(MODEL_ID);
    });

    it("다수 activities — throw 0 으로 순서 보존된 1:1 페어링 조립(분기 mirror)", () => {
      const runPlan = buildValidRunPlan();
      const activities = [
        syntheticActivity("realdata-e2e-eval-step-args-x1", "ivan"),
        syntheticActivity("realdata-e2e-eval-step-args-x2", "judy"),
        syntheticActivity("realdata-e2e-eval-step-args-x3", "mallory"),
      ];
      const plan = buildRealDataEvaluationStepArgs(runPlan, activities);

      expect(plan.inputs).toHaveLength(activities.length);
      expect(plan.callArgs).toHaveLength(activities.length);
      for (let i = 0; i < activities.length; i += 1) {
        expect(plan.callArgs[i].input).toBe(plan.inputs[i]);
        expect(plan.callArgs[i].options.modelId).toBe(MODEL_ID);
      }
    });
  });

  describe("negative cases — runPlan.pipeline.modelId 결손의 위임 guard 전파(자체 try/catch 0)", () => {
    // 직접 구성한 불완전 runPlan literal — buildRealDataE2eRunPlan 의 modelId guard 를
    // 우회해(정상 경로로는 빈 modelId 의 runPlan 을 만들 수 없으므로) 빈/공백 modelId
    // 를 step-args 컴포저에 직접 주입한다. run 은 유효값으로 채워 modelId 결손만 고립
    // 검증한다. collectCallArgs 는 빈 배열로 둔다(modelId guard 가 평가 leg 에서
    // 발동하므로 collect 측 내용은 무관).
    const validRun = buildValidRunPlan().run;

    it("runPlan.pipeline.modelId 빈 문자열 — 위임 buildRealDataEvaluationPlan 하위 guard throw 가 그대로 전파", () => {
      const broken: RealDataE2eRunPlan = {
        pipeline: { collectCallArgs: [], modelId: "" },
        run: { ...validRun },
      };
      const activities = [
        syntheticActivity("realdata-e2e-eval-step-args-neg1", "neg"),
      ];
      expect(() =>
        buildRealDataEvaluationStepArgs(broken, activities),
      ).toThrow();
    });

    it("runPlan.pipeline.modelId 공백만 — 위임 guard throw 가 그대로 전파", () => {
      const broken: RealDataE2eRunPlan = {
        pipeline: { collectCallArgs: [], modelId: "   " },
        run: { ...validRun },
      };
      const activities = [
        syntheticActivity("realdata-e2e-eval-step-args-neg2", "neg"),
      ];
      expect(() =>
        buildRealDataEvaluationStepArgs(broken, activities),
      ).toThrow();
    });

    it("빈 activities + 빈 modelId — modelId guard 가 빈-배열 분기보다 먼저 차단(조용한 통과 0)", () => {
      // 빈 activities 라도 modelId 가 빈/공백이면 위임 guard throw — 빈-배열 분기로
      // 조용히 통과하지 않는다(평가 leg 의 build-time 정책 박제가 조립 경로로 도달).
      const brokenEmpty: RealDataE2eRunPlan = {
        pipeline: { collectCallArgs: [], modelId: "" },
        run: { ...validRun },
      };
      const brokenBlank: RealDataE2eRunPlan = {
        pipeline: { collectCallArgs: [], modelId: "   " },
        run: { ...validRun },
      };
      expect(() => buildRealDataEvaluationStepArgs(brokenEmpty, [])).toThrow();
      expect(() => buildRealDataEvaluationStepArgs(brokenBlank, [])).toThrow();
    });
  });

  describe("결정론 · 무공유 — 동일 (runPlan, activities) 두 번 호출 + 입력 불변", () => {
    it("두 plan 이 deep-equal 이면서 최상위·중첩 객체 참조가 공유되지 않는다(not.toBe)", () => {
      const runPlan = buildValidRunPlan();
      const activities = [
        syntheticActivity("realdata-e2e-eval-step-args-d1", "olivia"),
        syntheticActivity("realdata-e2e-eval-step-args-d2", "peggy"),
      ];
      const a = buildRealDataEvaluationStepArgs(runPlan, activities);
      const b = buildRealDataEvaluationStepArgs(runPlan, activities);

      // 값은 deep-equal(결정론 — 입력만의 함수).
      expect(a).toEqual(b);

      // 참조는 무공유 — 최상위 plan + 중첩 inputs/callArgs 전부 새 객체.
      expect(a).not.toBe(b);
      expect(a.inputs).not.toBe(b.inputs);
      expect(a.callArgs).not.toBe(b.callArgs);

      // callArgs 원소·options 도 매 호출 새 객체(위임 helper 의 `{ modelId }`
      // 매 호출 새 객체 보장).
      for (let i = 0; i < a.callArgs.length; i += 1) {
        expect(a.callArgs[i]).not.toBe(b.callArgs[i]);
        expect(a.callArgs[i].options).not.toBe(b.callArgs[i].options);
      }
    });

    it("입력 runPlan · activities 객체·원소가 호출 전후로 mutate 되지 않음(deep-equal 보존)", () => {
      const runPlan = buildValidRunPlan();
      const activities = [
        syntheticActivity("realdata-e2e-eval-step-args-n1", "trent"),
        syntheticActivity("realdata-e2e-eval-step-args-n2", "victor"),
      ];
      const runPlanBefore = JSON.parse(JSON.stringify(runPlan));
      const activitiesBefore = JSON.parse(JSON.stringify(activities));

      buildRealDataEvaluationStepArgs(runPlan, activities);

      // 호출 후 입력 runPlan · activities 가 동형(무공유 보존 — 출력 변형이 입력에
      // 누설 0).
      expect(runPlan).toEqual(runPlanBefore);
      expect(activities).toEqual(activitiesBefore);
      expect(activities).toHaveLength(activitiesBefore.length);
      expect(activities[0].externalId).toBe("realdata-e2e-eval-step-args-n1");
    });
  });
});
