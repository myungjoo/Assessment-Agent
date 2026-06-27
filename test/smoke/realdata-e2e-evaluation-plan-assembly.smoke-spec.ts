// realdata-e2e-evaluation-plan-assembly.smoke-spec.ts — 실 평가 e2e evaluation-plan
// 조립 체인 non-gated build-time smoke (T-0730 박제, PLAN.md 109행 🟢 실 평가 e2e
// step ②→③ 경계).
//
// 본 spec 의 존재 이유 — public CI gap 해소:
//   - 종단 순수 컴포저 `buildRealDataEvaluationPlan(activities, modelId)`(T-0591,
//     test/helpers/realdata-e2e-evaluation-plan.ts)는 두 sub-composer
//     (`buildRealDataEvaluationInputs` T-0578 + `buildRealDataScoringCallArgs` T-0579)
//     를 순서 조립해 `{ inputs, callArgs }`(scoreUnit 호출-args 묶음) 을 닫는다. 이
//     종단 컴포저는 컴포저 단위 unit spec(`realdata-e2e-evaluation-plan.spec.ts`)으로는
//     이미 닫혀 있으나, **여러 컴포저를 묶은 조립 체인 단위의 non-gated build-time
//     smoke** 는 부재였다 — 즉 step②(수집)→③(평가) 조립 surface 의 시그니처/배선
//     회귀(인자 순서 swap, 한쪽 산출 누락, `callArgs[i].input === inputs[i]` reference
//     페어링 깨짐) 는 컴포저 unit spec 밖의 조립 레벨에서는 CI 그물이 없다.
//   - 본 spec 은 그 gap 을 정확히 메운다 — **gating 없이 항상 실행되는 일반 describe**
//     로 evaluation-plan 조립 surface 를 synthetic `Activity[]` + modelId 로부터 끝까지
//     조립해 `{ inputs, callArgs }` 산출을 build-time 에 검증한다. live leg
//     (EvaluationScoringService.scoreUnit / LlmHttpGateway / Ollama round-trip /
//     LlmProviderConfigResolver) 는 복제하지 않고 — 본 spec 은 호출-args **조립 surface**
//     만 검증한다. 따라서 본 spec 은:
//
//      🔥 실 LLM 호출 0 — orchestrator / scoring service / gateway 미사용. 종단
//         컴포저의 in-memory 순수 합성만 발화.
//      🔥 실 네트워크 호출 0 — github / Ollama 호출 0. fetch 0. process.env 읽기 0.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 / 새 컴포저·가드 신설 0 — 기존 build* 컴포저 import
//         재사용만(consistency-guard sweep 종결, T-0726 — T-0727 doc §5 준수).
//
// T-0728(seed→run-plan→step-args) · T-0729(result-issue publish) 의 file-disjoint
// 병렬 sibling 이며, realdata-e2e 컴포저 sweep 의 검증된 leaf 들을 묶는 조립 spec 의
// evaluation-plan 진입이다.
//
// Out of Scope (T-0730):
//   - 실 LLM round-trip / EvaluationScoringService.scoreUnit / LlmHttpGateway / Ollama
//     호출 — 본 spec 은 호출-args 조립 surface 만 검증(실 평가 실행 0). live leg 검증은
//     기존 realdata-e2e-live.smoke-spec.ts 책임.
//   - 실 LlmProviderConfigResolver 호출 / DB lookup / modelId 실 결정(ADR-0048 — 본
//     spec 은 build-time 결정값을 인자로 받기만 함).
//   - 실 github 네트워크 수집 / gh 실행 / 실 이슈 박제.
//   - 새 컴포저 · consistency 가드 helper 신설 — 기존 build* 컴포저 import 재사용만.
//   - production src/ 코드 변경 — test-only(신규 smoke spec 1 파일).
//   - 기존 realdata-e2e-assembly.smoke-spec.ts(T-0728) · realdata-e2e-result-issue-
//     publish-assembly.smoke-spec.ts(T-0729) · realdata-e2e-live.smoke-spec.ts 수정.
import type {
  Activity,
  GithubActivity,
} from "../../src/assessment-collection/domain/activity";
import { buildRealDataEvaluationPlan } from "../helpers/realdata-e2e-evaluation-plan";

// 본 smoke 공통 fixture — 결정론 입력. 모든 it 가 매 호출 새 객체 트리를 받는다
// (factory 함수로 mutate 격리).
const MODEL_ID = "cfg-realdata-e2e-evaluation-plan-assembly-smoke";
const INSTANCE_KEY = "github.com";

// synthetic GithubActivity 1 건 — externalId 만 바꿔 단일/다수 분기 분리.
function syntheticCommit(externalId: string): GithubActivity {
  return {
    sourceType: "github",
    externalId,
    instanceKey: INSTANCE_KEY,
    author: "myungjoo",
    timestamp: "2026-06-01T12:00:00Z",
    metadata: { titleLength: 24 },
    repoRef: "octo-org/sample-repo",
    kind: "commit",
  };
}

describe("Smoke(non-gated): 실 평가 e2e evaluation-plan 조립 체인(Activity[]+modelId→{inputs,callArgs}) live-LLM 0 검증", () => {
  describe("happy path — 조립된 plan 산출", () => {
    it("유효 Activity[] + 유효 modelId → inputs/callArgs 길이가 activities 와 동일", () => {
      const activities: Activity[] = [syntheticCommit("plan-assembly-c1")];
      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);

      expect(plan.inputs).toBeDefined();
      expect(plan.callArgs).toBeDefined();
      expect(plan.inputs).toHaveLength(activities.length);
      expect(plan.callArgs).toHaveLength(activities.length);
    });

    it("단일 modelId 동형 적용 — 모든 callArgs[i].options.modelId === modelId", () => {
      const activities: Activity[] = [
        syntheticCommit("plan-assembly-c1"),
        syntheticCommit("plan-assembly-c2"),
        syntheticCommit("plan-assembly-c3"),
      ];
      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);

      expect(plan.callArgs).toHaveLength(activities.length);
      for (const args of plan.callArgs) {
        expect(args.options.modelId).toBe(MODEL_ID);
      }
    });

    it("reference 페어링 — 모든 callArgs[i].input === inputs[i](EvaluationInput 복제 0)", () => {
      const activities: Activity[] = [
        syntheticCommit("plan-assembly-c1"),
        syntheticCommit("plan-assembly-c2"),
      ];
      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);

      expect(plan.inputs).toHaveLength(activities.length);
      expect(plan.callArgs).toHaveLength(activities.length);
      for (let i = 0; i < plan.inputs.length; i += 1) {
        // reference 동일(`not.toEqual` 이 아니라 `toBe`) — 위임 helper 가 input 을 복제
        // 하지 않고 그대로 페어링함을 단언.
        expect(plan.callArgs[i].input).toBe(plan.inputs[i]);
      }
    });
  });

  describe("flow / branch — 빈/단일/다수 activities 경계", () => {
    it("빈 activities + 유효 modelId — throw 0 + inputs/callArgs 모두 빈 배열(빈-배열 분기)", () => {
      const plan = buildRealDataEvaluationPlan([], MODEL_ID);

      expect(plan.inputs).toEqual([]);
      expect(plan.callArgs).toEqual([]);
    });

    it("단일 element activities — throw 0 으로 길이 1 plan 산출(단일 분기)", () => {
      const activities: Activity[] = [syntheticCommit("plan-assembly-c1")];
      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);

      expect(plan.inputs).toHaveLength(1);
      expect(plan.callArgs).toHaveLength(1);
      expect(plan.callArgs[0].options.modelId).toBe(MODEL_ID);
      expect(plan.callArgs[0].input).toBe(plan.inputs[0]);
    });

    it("다수 element activities — throw 0 으로 길이 N plan 산출(다수 분기)", () => {
      const activities: Activity[] = [
        syntheticCommit("plan-assembly-c1"),
        syntheticCommit("plan-assembly-c2"),
        syntheticCommit("plan-assembly-c3"),
      ];
      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);

      expect(plan.inputs).toHaveLength(activities.length);
      expect(plan.callArgs).toHaveLength(activities.length);
    });
  });

  describe("negative cases — 위임 guard throw 전파", () => {
    it("빈 modelId — buildRealDataScoringCallArgs 위임 guard throw 가 그대로 전파", () => {
      const activities: Activity[] = [syntheticCommit("plan-assembly-c1")];
      expect(() => buildRealDataEvaluationPlan(activities, "")).toThrow();
    });

    it("공백만의 modelId — buildRealDataScoringCallArgs 위임 guard throw 가 그대로 전파", () => {
      const activities: Activity[] = [syntheticCommit("plan-assembly-c1")];
      expect(() => buildRealDataEvaluationPlan(activities, "   ")).toThrow();
    });

    it("빈 activities + 유효 modelId — throw 0 경계(에러 아님, 빈 plan 반환)", () => {
      // 빈 activities 는 inputs/callArgs 둘 다 빈 배열로 흘러 modelId guard 도달 전
      // map 자연 종료 — throw 0 분기.
      expect(() => buildRealDataEvaluationPlan([], MODEL_ID)).not.toThrow();
    });
  });

  describe("결정론·무공유 — 같은 입력 두 번 호출", () => {
    it("두 plan 이 deep-equal 이면서 plan/inputs/callArgs/options 참조 무공유", () => {
      const activities1: Activity[] = [
        syntheticCommit("plan-assembly-c1"),
        syntheticCommit("plan-assembly-c2"),
      ];
      const activities2: Activity[] = [
        syntheticCommit("plan-assembly-c1"),
        syntheticCommit("plan-assembly-c2"),
      ];

      const a = buildRealDataEvaluationPlan(activities1, MODEL_ID);
      const b = buildRealDataEvaluationPlan(activities2, MODEL_ID);

      // 결정론 — 같은 입력 → deep-equal 산출.
      expect(a).toEqual(b);

      // 최상위·중첩 객체 참조 무공유(매 호출 새 plan/inputs/callArgs/options).
      expect(a).not.toBe(b);
      expect(a.inputs).not.toBe(b.inputs);
      expect(a.callArgs).not.toBe(b.callArgs);
      expect(a.callArgs[0].options).not.toBe(b.callArgs[0].options);
    });

    it("입력 activities 배열·원소가 호출 전후로 mutate 되지 않는다(snapshot 비교)", () => {
      const activities: Activity[] = [
        syntheticCommit("plan-assembly-c1"),
        syntheticCommit("plan-assembly-c2"),
      ];
      // 입력 snapshot — deep copy 로 호출 전 상태를 박제.
      const snapshot = JSON.parse(JSON.stringify(activities)) as Activity[];

      buildRealDataEvaluationPlan(activities, MODEL_ID);

      // 호출 후 입력이 snapshot 과 동일 — 배열 길이·각 원소 mutate 0.
      expect(activities).toEqual(snapshot);
    });
  });
});
