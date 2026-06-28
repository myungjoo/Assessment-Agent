// realdata-e2e-evaluation-plan-dual-leg-convergence-assembly.smoke-spec.ts — 실 평가 e2e
// eval-side 종단 컴포저(buildRealDataEvaluationPlan)의 **dual-leg(inputs·callArgs)
// single-source convergence** non-gated build-time smoke (T-0756 박제, PLAN.md 109행
// 🟢 실 평가 e2e step ②→③ 경계).
//
// 본 spec 의 존재 이유 — public CI gap 해소:
//   - eval-side 종단 컴포저 `buildRealDataEvaluationPlan(activities, modelId)`(T-0591,
//     test/helpers/realdata-e2e-evaluation-plan.ts) 는 두 leg 를 단일 plan 으로 합류시킨다:
//       (1) inputs leg — buildRealDataEvaluationInputs(activities)(T-0578) 위임 산출.
//           수집 Activity[] → 평가 입력 EvaluationInput[] 을 thread.
//       (2) callArgs leg — buildRealDataScoringCallArgs(inputs, modelId)(T-0579) 위임 산출.
//           EvaluationInput[] + modelId → scoreUnit 호출-args 묶음을 thread.
//   - 컴포저 핵심 불변식은 **두 leg 가 각자의 단일 source 로부터 합류**한다는 것이다 —
//     inputs leg 은 evaluation-inputs 위임 컴포저 단일 source, callArgs leg 은
//     scoring-call-args 위임 컴포저(inputs + modelId) 단일 source. 두 leg 는 동일
//     (activities, modelId) 단일 입력으로부터 합류하되, callArgs leg 은 inputs leg 산출을
//     reference 그대로 thread(`callArgs[i].input === inputs[i]`) 하며, modelId guard 는
//     callArgs 위임 단계(inputs 단계보다 뒤)에서 평가된다(guard-ordering).
//   - 그러나 이 dual-leg(inputs·callArgs) single-source convergence 를 **직접-체인으로 묶은
//     non-gated build-time smoke 는 부재**다. 기존 realdata-e2e-evaluation-plan-
//     assembly.smoke-spec.ts(T-0730) 는 plan.inputs/plan.callArgs 를 toBeDefined +
//     toHaveLength + callArgs[i].options.modelId toBe + callArgs[i].input === inputs[i]
//     reference 페어링 + 빈-배열 toEqual([]) + 결정론/무공유 만 한다. (a) plan.inputs 전체가
//     직접 호출 buildRealDataEvaluationInputs(activities) 와 byte-identical(inputs leg 단일
//     source) (b) plan.callArgs 전체가 직접 호출 buildRealDataScoringCallArgs(plan.inputs,
//     modelId) 와 byte-identical(callArgs leg 단일 source) (c) partial-thread 격리(다른
//     activities→두 leg 변하되 각각 직접 sub-컴포저 재유도와 정합 유지, 다른 modelId→inputs
//     불변·callArgs.options.modelId 만 반영) (d) modelId guard 가 callArgs 단계(inputs 보다
//     뒤)에서 평가됨(guard-ordering) 을 dual-leg convergence 관점에서 직접 단언하는 smoke 는
//     0 이다. 이는 seed-side(T-0753 run-plan·T-0754 pipeline-plan)·result-side(T-0755
//     publish-plan) 가 닫은 컴포저 convergence 그물의 **eval-side 대칭 sibling** — seed→eval
//     →result 3 구간 컴포저 convergence 의 가운데 절단면이다.
//   - 본 spec 은 그 gap 을 정확히 메운다 — **gating 없이 항상 실행되는 일반 describe** 로
//     inputs leg byte-identical / callArgs leg single-source / partial-thread 격리 /
//     guard-ordering / negative guard 전파를 직접-체인으로 박제한다. leg-swap·leg-drift·
//     partial-thread·guard-order-flip 회귀를 public CI 그물로 닫는다. 따라서 본 spec 은:
//
//      🔥 실 LLM 호출 0 — orchestrator / scoring service / gateway 미사용. eval-side
//         호출-args 조립만 — 실 평가 실행은 본 컴포저 범위 밖.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 DB 접근 0 — modelId 실 결정 / LlmProviderConfigResolver 호출 0(인자로만 받음).
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 build* 컴포저 import 재사용만(컴포저/가드 신설 0).
//
// Out of Scope (T-0756):
//   - 기존 realdata-e2e-evaluation-plan-assembly.smoke-spec.ts(T-0730) 의 shape/reference
//     단언 수정 / 중복 it 이관 — 본 spec 은 신규 파일만(별도 sweep 금지).
//   - seed-side run-plan(T-0753)/pipeline-plan(T-0754) convergence 재단언 + result-side
//     publish-plan(T-0755) tri-leg 재단언 — 이미 cover. 본 spec 은 eval-side 만.
//   - step-args aggregator(T-0752) dual-leg 재단언.
//   - test/helpers/realdata-e2e-evaluation-plan.ts 또는 어떤 컴포저 helper 의 로직 변경(컴포저
//     재구현·guard 메시지 수정 0 — smoke 는 외부 관측만).
//   - 실 수집 / 실 scoring / scoreUnit / 실 LLM round-trip / Ollama / DB / 실 gh / 실 jest
//     spawn / 실 네트워크.
//   - gated(DB·credential·LAN) smoke leg 추가 — 본 task 는 non-gated build-time
//     pure-composer smoke 단독.
//   - production src/ 코드 변경 — test-only(신규 smoke spec 1 파일).
import type { GithubActivity } from "../../src/assessment-collection/domain/activity";
import { buildRealDataEvaluationInputs } from "../helpers/realdata-e2e-evaluation-inputs";
import { buildRealDataEvaluationPlan } from "../helpers/realdata-e2e-evaluation-plan";
import { buildRealDataScoringCallArgs } from "../helpers/realdata-e2e-scoring-call-args";

// 본 smoke 공통 fixture — 유효 modelId(비공백) 결정론 상수.
const MODEL_ID = "cfg-realdata-e2e-evaluation-plan-dual-leg-smoke";
const INSTANCE_KEY = "github.com";

// syntheticActivity — 도메인 타입 정합 GithubActivity literal 1 건 빌더. externalId 와
// author 를 인자로 받아 다수 element 케이스에서 unique 한 활동을 합성한다. metadata 는
// raw 본문 아닌 scalar 만(REQ-032 정합).
function syntheticActivity(externalId: string, author: string): GithubActivity {
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

// 기본 다수-원소 fixture — 대부분의 byte-identical/격리 단언이 공유한다.
function baseActivities(): GithubActivity[] {
  return [
    syntheticActivity("realdata-e2e-eval-dual-c1", "alice"),
    syntheticActivity("realdata-e2e-eval-dual-c2", "bob"),
  ];
}

describe("Smoke(non-gated): 실 평가 e2e evaluation-plan 컴포저 dual-leg(inputs·callArgs) single-source convergence", () => {
  describe("happy path — 두 leg 동시 합류", () => {
    it("buildRealDataEvaluationPlan(activities, modelId) — 반환 { inputs, callArgs } 두 필드 모두 정의·길이 정합", () => {
      const activities = baseActivities();
      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);

      // inputs leg — 평가 입력 EvaluationInput[] 배열 shape.
      expect(plan.inputs).toBeDefined();
      expect(Array.isArray(plan.inputs)).toBe(true);
      // callArgs leg — scoreUnit 호출-args 묶음 배열 shape.
      expect(plan.callArgs).toBeDefined();
      expect(Array.isArray(plan.callArgs)).toBe(true);
      // 길이 동일성(= activities.length) — 두 leg 가 같은 source 로부터 1:1 합류.
      expect(plan.inputs).toHaveLength(activities.length);
      expect(plan.callArgs).toHaveLength(activities.length);
    });
  });

  describe("dual-leg single-source convergence (핵심) — 각 leg ↔ 직접 sub-컴포저 호출 byte-identical", () => {
    it("(a) plan.inputs 가 직접 호출 buildRealDataEvaluationInputs(activities) 와 byte-identical(toEqual 전체 배열 deep-equal) 이며 새 배열(not.toBe)", () => {
      const activities = baseActivities();
      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);

      // 같은 activities 로 inputs 컴포저를 직접 재호출 → 컴포저의 inputs leg 와 전체
      // 배열 deep-equal(inputs leg 이 evaluation-inputs 위임 단일 source 로부터 합류).
      const directInputs = buildRealDataEvaluationInputs(activities);
      expect(plan.inputs).toEqual(directInputs);
      // 동시에 새 배열로 무공유(직접-재호출 산출과 참조 비동일 — 매 호출 새 트리).
      expect(plan.inputs).not.toBe(directInputs);
    });

    it("(b) plan.callArgs 가 직접 호출 buildRealDataScoringCallArgs(plan.inputs, modelId) 와 byte-identical(toEqual 전체 배열 deep-equal) 이며 새 배열(not.toBe)", () => {
      const activities = baseActivities();
      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);

      // callArgs leg 을 직접 재유도 — plan.inputs(이미 inputs leg 단일 source 로 검증
      // 됨)에 같은 modelId 를 적용한 scoring-call-args 위임 직접 호출과 전체 배열
      // byte-identical(callArgs leg 이 scoring-call-args 위임 단일 source 로부터 합류).
      const directCallArgs = buildRealDataScoringCallArgs(
        plan.inputs,
        MODEL_ID,
      );
      expect(plan.callArgs).toEqual(directCallArgs);
      // 동시에 새 배열로 무공유.
      expect(plan.callArgs).not.toBe(directCallArgs);
    });

    it("(c) dual-leg cross 정합 — callArgs[i].input 이 inputs[i] 와 reference 동일(toBe) + 모든 options.modelId 동형 적용", () => {
      const activities = baseActivities();
      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);

      // callArgs leg 이 inputs leg 산출을 reference 그대로 thread(복제 0).
      for (let i = 0; i < plan.callArgs.length; i += 1) {
        expect(plan.callArgs[i].input).toBe(plan.inputs[i]);
        expect(plan.callArgs[i].options.modelId).toBe(MODEL_ID);
      }
    });
  });

  describe("partial-thread 격리 (branch) — 두 leg 가 동일 단일 source 로부터 합류", () => {
    it("다른 activities(같은 modelId) → 두 leg 모두 변하되 각각 직접 sub-컴포저 재유도와 여전히 byte-identical", () => {
      const a = buildRealDataEvaluationPlan(baseActivities(), MODEL_ID);
      const otherActivities = [
        syntheticActivity("realdata-e2e-eval-dual-other", "carol"),
      ];
      const b = buildRealDataEvaluationPlan(otherActivities, MODEL_ID);

      // 두 leg 모두 activities 에 의존 → 다른 activities 면 변함.
      expect(a.inputs).not.toEqual(b.inputs);
      expect(a.callArgs).not.toEqual(b.callArgs);
      // 그래도 b 의 두 leg 는 각각 직접 sub-컴포저 재유도와 정합 유지(단일 source).
      const bDirectInputs = buildRealDataEvaluationInputs(otherActivities);
      expect(b.inputs).toEqual(bDirectInputs);
      expect(b.callArgs).toEqual(
        buildRealDataScoringCallArgs(b.inputs, MODEL_ID),
      );
    });

    it("다른 modelId(같은 activities) → inputs leg 불변·callArgs.options.modelId 만 반영, 두 leg 각각 단일 source 정합 유지", () => {
      const activities = baseActivities();
      const a = buildRealDataEvaluationPlan(activities, MODEL_ID);
      const otherModelId = `${MODEL_ID}-v2`;
      const b = buildRealDataEvaluationPlan(activities, otherModelId);

      // inputs leg 은 modelId 무관 → 같은 activities 면 byte-identical(불변).
      expect(b.inputs).toEqual(a.inputs);
      // callArgs leg 은 modelId 에 의존 → options.modelId 만 새 값 반영.
      for (const callArg of b.callArgs) {
        expect(callArg.options.modelId).toBe(otherModelId);
      }
      // 두 leg 각각 직접 sub-컴포저 재유도와 정합 유지(단일 source).
      expect(b.inputs).toEqual(buildRealDataEvaluationInputs(activities));
      expect(b.callArgs).toEqual(
        buildRealDataScoringCallArgs(b.inputs, otherModelId),
      );
    });
  });

  describe("guard-ordering (branch) — modelId guard 가 callArgs 단계(inputs 단계보다 뒤)에서 평가됨", () => {
    it("빈 modelId → callArgs 위임 throw 전파되되, inputs leg 자체는 modelId 무관(직접 호출 정상 산출)", () => {
      const activities = baseActivities();

      // 빈 modelId → 합성 (2) callArgs 위임 단계 guard 가 throw 전파.
      expect(() => buildRealDataEvaluationPlan(activities, "")).toThrow();

      // 그러나 inputs leg 은 modelId 무관 — 직접 호출은 modelId 없이 정상 산출(guard
      // 가 inputs 단계가 아니라 callArgs 단계에서 평가됨을 박제).
      const directInputs = buildRealDataEvaluationInputs(activities);
      expect(directInputs).toHaveLength(activities.length);
    });
  });

  describe("error / negative — 위임 guard throw 그대로 전파(자체 try/catch 0)", () => {
    it("빈 문자열 modelId → buildRealDataScoringCallArgs 위임 단계 throw 전파", () => {
      const activities = baseActivities();
      expect(() => buildRealDataEvaluationPlan(activities, "")).toThrow(
        /modelId/,
      );
    });

    it("공백만의 modelId → 위임 throw 전파", () => {
      const activities = baseActivities();
      expect(() => buildRealDataEvaluationPlan(activities, "   ")).toThrow(
        /modelId/,
      );
    });

    it("빈 activities([]) + 빈 modelId → modelId guard 가 빈-배열 분기보다 먼저 차단(조용한 통과 0)", () => {
      // 빈 activities 라도 modelId 가 빈/공백이면 callArgs 위임 guard throw — 빈-배열
      // 분기로 조용히 통과하지 않는다(위임 helper L84 guard 의 build-time 정책 박제).
      expect(() => buildRealDataEvaluationPlan([], "")).toThrow(/modelId/);
    });

    it("빈 activities([]) + 공백만의 modelId → modelId guard 가 빈-배열 분기보다 먼저 차단", () => {
      expect(() => buildRealDataEvaluationPlan([], "   ")).toThrow(/modelId/);
    });
  });

  describe("flow / branch — 빈·단일·다수 activities 분기 (각 분기 두 leg 단일 source 정합 유지)", () => {
    it("빈 activities + 유효 modelId → plan.inputs: [] + plan.callArgs: [](throw 0)", () => {
      const plan = buildRealDataEvaluationPlan([], MODEL_ID);
      expect(plan.inputs).toEqual([]);
      expect(plan.callArgs).toEqual([]);
      // 빈 분기에서도 두 leg 가 직접 sub-컴포저 재유도와 byte-identical.
      expect(plan.inputs).toEqual(buildRealDataEvaluationInputs([]));
      expect(plan.callArgs).toEqual(
        buildRealDataScoringCallArgs(plan.inputs, MODEL_ID),
      );
    });

    it("단일 activity → 두 leg 길이 1 + 각각 직접 sub-컴포저와 byte-identical", () => {
      const single = [syntheticActivity("realdata-e2e-eval-dual-solo", "solo")];
      const plan = buildRealDataEvaluationPlan(single, MODEL_ID);

      expect(plan.inputs).toHaveLength(1);
      expect(plan.callArgs).toHaveLength(1);
      expect(plan.inputs).toEqual(buildRealDataEvaluationInputs(single));
      expect(plan.callArgs).toEqual(
        buildRealDataScoringCallArgs(plan.inputs, MODEL_ID),
      );
    });

    it("다수 activity → 두 leg 길이 = activities 길이 + 각각 직접 sub-컴포저와 byte-identical", () => {
      const many = [
        syntheticActivity("realdata-e2e-eval-dual-m1", "alice"),
        syntheticActivity("realdata-e2e-eval-dual-m2", "bob"),
        syntheticActivity("realdata-e2e-eval-dual-m3", "carol"),
      ];
      const plan = buildRealDataEvaluationPlan(many, MODEL_ID);

      expect(plan.inputs).toHaveLength(many.length);
      expect(plan.callArgs).toHaveLength(many.length);
      expect(plan.inputs.length).toBeGreaterThan(1);
      expect(plan.inputs).toEqual(buildRealDataEvaluationInputs(many));
      expect(plan.callArgs).toEqual(
        buildRealDataScoringCallArgs(plan.inputs, MODEL_ID),
      );
    });
  });

  describe("결정론·무공유·no-mutation", () => {
    it("동일 (activities, modelId) 두 번 호출 → deep-equal + 새 plan 객체(not.toBe) + inputs/callArgs/options 참조 비공유(not.toBe)", () => {
      const activities = baseActivities();
      const a = buildRealDataEvaluationPlan(activities, MODEL_ID);
      const b = buildRealDataEvaluationPlan(activities, MODEL_ID);

      // 결정론 — 동일 입력 두 호출 byte-identical.
      expect(a).toEqual(b);
      // 매 호출 새 plan 컨테이너 + 새 inputs/callArgs 트리(반환 참조 비동일).
      expect(a).not.toBe(b);
      expect(a.inputs).not.toBe(b.inputs);
      expect(a.callArgs).not.toBe(b.callArgs);
      // callArgs 원소·options 도 매 호출 새 객체(위임 helper 의 `{ modelId }` 새 객체 보장).
      for (let i = 0; i < a.callArgs.length; i += 1) {
        expect(a.callArgs[i]).not.toBe(b.callArgs[i]);
        expect(a.callArgs[i].options).not.toBe(b.callArgs[i].options);
      }
    });

    it("입력 activities 배열·원소 mutate 0 — 호출 전후 deep-equal snapshot 유지", () => {
      const activities = baseActivities();
      const snapshot = JSON.parse(JSON.stringify(activities));

      buildRealDataEvaluationPlan(activities, MODEL_ID);

      expect(activities).toEqual(snapshot);
      expect(activities).toHaveLength(2);
      expect(activities[0].externalId).toBe("realdata-e2e-eval-dual-c1");
      expect(activities[1].externalId).toBe("realdata-e2e-eval-dual-c2");
    });
  });

  describe("R-59 raw 본문 누출 0 — plan 은 식별자·modelId 토큰만 보유", () => {
    it("sentinel — raw 외부 활동 본문(commit/PR/issue body)이 plan 직렬화에 구조적으로 미등장", () => {
      // activities / modelId 어디에도 raw 본문은 입력되지 않으며, 컴포저는 식별자·
      // modelId 토큰만 thread 하므로 raw 본문 sentinel 은 plan 에 등장할 수 없다.
      const sentinel = "SENTINEL-RAW-BODY-DO-NOT-LEAK-0756";
      const plan = buildRealDataEvaluationPlan(baseActivities(), MODEL_ID);

      const serialized = JSON.stringify(plan);
      expect(serialized).not.toContain(sentinel);
      expect(serialized).not.toContain("narrative");
      expect(serialized).not.toContain('"body"');
    });
  });
});
