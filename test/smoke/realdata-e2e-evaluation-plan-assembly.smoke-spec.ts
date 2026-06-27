// realdata-e2e-evaluation-plan-assembly.smoke-spec.ts — 실 평가 e2e 평가-입력
// 조립 체인 non-gated build-time smoke (T-0730 박제, PLAN.md 109행 🟢 실 평가 e2e
// step ②→③ 경계).
//
// 본 spec 의 존재 이유 — public CI gap 해소:
//   - 종단 순수 컴포저 buildRealDataEvaluationPlan(activities, modelId)(T-0591,
//     test/helpers/realdata-e2e-evaluation-plan.ts)는 두 sub-composer
//     buildRealDataEvaluationInputs(T-0578) + buildRealDataScoringCallArgs(T-0579)
//     를 순서 조립해 scoreUnit 호출-args 묶음 `{ inputs, callArgs }` 를 산출한다.
//     이 컴포저 자체는 컴포저 단위 unit spec(realdata-e2e-evaluation-plan.spec.ts)
//     으로 닫혀 있다.
//   - 그러나 **여러 컴포저를 묶은 조립(assembly) 체인 단위의 non-gated build-time
//     smoke** 는 부재였다. 즉 step②→③ 조립 surface 의 시그니처/배선 회귀(인자
//     순서 swap, 한쪽 산출 누락/변형, `callArgs[i].input === inputs[i]` reference
//     페어링 깨짐, 단일 modelId 동형 적용 위반)는 컴포저 unit spec 밖의 조립
//     레벨에서는 CI 그물이 없었다.
//   - 본 spec 은 그 gap 을 정확히 메운다 — T-0728(seed→run-plan→step-args) ·
//     T-0729(result-issue publish) 의 병렬 sibling 으로, **gating 없이 항상 실행
//     되는 일반 describe** 로 동일 조립 surface(컴포저 2종 연결을 묶는 종단 컴포저)
//     를 검증한다. live leg(EvaluationScoringService.scoreUnit / LlmHttpGateway /
//     Ollama / 실 github 수집)는 복제하지 않고, synthetic Activity[] + modelId 로
//     평가 leg 를 우회한다(조립 surface 만 검증). 따라서 본 spec 은:
//
//      🔥 실 LLM 호출 0 — orchestrator / scoring service / gateway 미사용. 평가
//         결과를 산출하지 않는다(평가 입력 조립 surface 만 검증).
//      🔥 실 네트워크 호출 0 — github / Ollama 호출 0. fetch 0. process.env 읽기 0.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 buildRealDataEvaluationPlan 컴포저 import
//         재사용만(consistency-guard 신설 금지 — sweep 종결, T-0726/T-0727 §5).
//      🔥 신규 컴포저/가드/helper 신설 0 — 본 task 는 smoke spec 1 파일 추가만.
//
// build-time consistency-guard sweep(T-0584~T-0726) 종결과 직교한 새 방향이며,
// realdata-e2e 컴포저 sweep 의 검증된 leaf 들을 묶는 조립 spec 의 두 번째 진입
// (T-0728 seed→step-args 의 evaluation-plan mirror).
//
// Out of Scope (T-0730):
//   - T-0728 seed→run-plan→step-args 조립 smoke / T-0729 result-issue publish
//     조립 smoke — file-disjoint 병렬 stream 보장.
//   - 실 EvaluationScoringService.scoreUnit 호출 / 실 LLM round-trip / Ollama /
//     orchestrator / LlmHttpGateway — 본 spec 은 호출-args **조립 surface** 만 검증
//     (실 평가 실행 0). live leg 검증은 기존 realdata-e2e-live.smoke-spec.ts 책임.
//   - 실 github 네트워크 수집 / gh 실행 / 실 이슈 박제.
//   - 새 컴포저 · consistency 가드 · helper 신설 — 기존 build* 컴포저 import 재사용만.
//   - production src/ 코드 변경 / 기존 컴포저 소스 수정(read-only 검증 대상).
import type { GithubActivity } from "../../src/assessment-collection/domain/activity";
import { isContributionKind } from "../../src/assessment-evaluation/domain/evaluation-input";
import { buildRealDataEvaluationPlan } from "../helpers/realdata-e2e-evaluation-plan";

// 본 smoke 공통 fixture — 모든 it 가 같은 결정론 입력을 공유한다(매 호출 새 객체 트리).
const MODEL_ID = "cfg-realdata-e2e-evaluation-plan-assembly-smoke";
const INSTANCE_KEY = "github.com";

// syntheticActivity — 도메인 타입 정합 GithubActivity literal 1 건 빌더. externalId
// 와 author 를 인자로 받아 다수 element 케이스에서 unique 한 활동을 합성할 수 있게
// 한다. metadata 는 raw 본문 아닌 scalar 만(REQ-032 정합).
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

describe("Smoke(non-gated): 실 평가 e2e 평가-입력 조립 체인(Activity[]+modelId→{inputs, callArgs}) live-LLM 0 검증", () => {
  describe("happy path — 조립된 evaluation-plan 산출", () => {
    it("synthetic Activity[] + modelId 로 plan.inputs/plan.callArgs 가 산출되고 길이·options.modelId·reference 페어링이 정합한다", () => {
      const activities = [
        syntheticActivity("realdata-e2e-eval-plan-c1", "alice"),
        syntheticActivity("realdata-e2e-eval-plan-c2", "bob"),
      ];

      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);

      // 두 산출 필드 모두 정의 + 길이 동일성 (= activities.length).
      expect(plan.inputs).toBeDefined();
      expect(plan.callArgs).toBeDefined();
      expect(plan.inputs).toHaveLength(activities.length);
      expect(plan.callArgs).toHaveLength(activities.length);

      // 모든 callArgs 가 단일 modelId 동형 적용 + `callArgs[i].input === inputs[i]`
      // reference 동일 페어링(EvaluationInput 복제 0, 위임 helper 계약 보존).
      for (let i = 0; i < plan.callArgs.length; i += 1) {
        expect(plan.callArgs[i].options.modelId).toBe(MODEL_ID);
        expect(plan.callArgs[i].input).toBe(plan.inputs[i]);
      }

      // 매핑된 EvaluationInput 의 contributionKind 가 허용 union 멤버 (type 정합).
      for (const input of plan.inputs) {
        expect(isContributionKind(input.contributionKind)).toBe(true);
      }
    });
  });

  describe("flow / branch — activities 빈/단일/다수 경계", () => {
    it("빈 activities + 유효 modelId — throw 0 + 빈 inputs/callArgs (위임 helper 의 빈-배열 분기가 조립 경로로도 도달)", () => {
      const plan = buildRealDataEvaluationPlan([], MODEL_ID);
      expect(plan.inputs).toEqual([]);
      expect(plan.callArgs).toEqual([]);
    });

    it("단일 element activities — 1:1 페어링 (분기 mirror)", () => {
      const activities = [
        syntheticActivity("realdata-e2e-eval-plan-c1", "alice"),
      ];

      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);

      expect(plan.inputs).toHaveLength(1);
      expect(plan.callArgs).toHaveLength(1);
      expect(plan.callArgs[0].options.modelId).toBe(MODEL_ID);
      expect(plan.callArgs[0].input).toBe(plan.inputs[0]);
    });

    it("다수 element activities — 순서 보존된 1:1 페어링 (분기 mirror)", () => {
      const activities = [
        syntheticActivity("realdata-e2e-eval-plan-c1", "alice"),
        syntheticActivity("realdata-e2e-eval-plan-c2", "bob"),
        syntheticActivity("realdata-e2e-eval-plan-c3", "carol"),
      ];

      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);

      expect(plan.inputs).toHaveLength(activities.length);
      expect(plan.callArgs).toHaveLength(activities.length);
      // 순서 보존 — externalId 가 입력 순서대로 unitId 에 합성된다.
      for (let i = 0; i < activities.length; i += 1) {
        expect(plan.inputs[i].unitId).toBe(
          `github:${INSTANCE_KEY}:${activities[i].externalId}`,
        );
        expect(plan.callArgs[i].input).toBe(plan.inputs[i]);
        expect(plan.callArgs[i].options.modelId).toBe(MODEL_ID);
      }
    });
  });

  describe("negative cases — 위임 guard throw 그대로 전파", () => {
    it("빈 문자열 modelId — buildRealDataScoringCallArgs 위임 단계에서 throw", () => {
      const activities = [
        syntheticActivity("realdata-e2e-eval-plan-c1", "alice"),
      ];
      expect(() => buildRealDataEvaluationPlan(activities, "")).toThrow();
    });

    it("공백만의 modelId — buildRealDataScoringCallArgs 위임 단계에서 throw", () => {
      const activities = [
        syntheticActivity("realdata-e2e-eval-plan-c1", "alice"),
      ];
      expect(() => buildRealDataEvaluationPlan(activities, "   ")).toThrow();
    });

    it("빈 activities + 빈 modelId — modelId guard 가 빈-배열 분기보다 먼저 차단 (조용한 통과 0)", () => {
      // 빈 activities 라도 modelId 가 빈/공백이면 guard throw — 빈-배열 분기로
      // 조용히 통과하지 않는다(위임 helper L84 guard 의 build-time 정책 박제).
      expect(() => buildRealDataEvaluationPlan([], "")).toThrow();
      expect(() => buildRealDataEvaluationPlan([], "   ")).toThrow();
    });
  });

  describe("결정론·무공유 — 같은 입력 두 번 호출 → deep-equal + 참조 무공유", () => {
    it("동일 (activities, modelId) 2회 호출 → 두 plan 이 deep-equal 하고 plan/inputs/callArgs/options 참조가 공유되지 않는다", () => {
      const activities = [
        syntheticActivity("realdata-e2e-eval-plan-c1", "alice"),
        syntheticActivity("realdata-e2e-eval-plan-c2", "bob"),
      ];

      const planA = buildRealDataEvaluationPlan(activities, MODEL_ID);
      const planB = buildRealDataEvaluationPlan(activities, MODEL_ID);

      // deep-equal — 결정론(입력만의 함수).
      expect(planA).toEqual(planB);

      // 최상위 plan / inputs / callArgs 참조 무공유 (매 호출 새 컨테이너).
      expect(planA).not.toBe(planB);
      expect(planA.inputs).not.toBe(planB.inputs);
      expect(planA.callArgs).not.toBe(planB.callArgs);

      // callArgs 원소·options 도 매 호출 새 객체 (위임 helper 의 `{ modelId }`
      // 매 호출 새 객체 보장).
      for (let i = 0; i < planA.callArgs.length; i += 1) {
        expect(planA.callArgs[i]).not.toBe(planB.callArgs[i]);
        expect(planA.callArgs[i].options).not.toBe(planB.callArgs[i].options);
      }
    });

    it("입력 activities 배열·원소가 호출 전후로 mutate 되지 않는다 (snapshot 동일성 유지)", () => {
      const activities = [
        syntheticActivity("realdata-e2e-eval-plan-c1", "alice"),
        syntheticActivity("realdata-e2e-eval-plan-c2", "bob"),
      ];
      // 호출 전 snapshot — 본 spec 안에서만 비교(외부 mutation 0 확인).
      const snapshot = JSON.parse(JSON.stringify(activities));

      buildRealDataEvaluationPlan(activities, MODEL_ID);

      // 호출 후에도 입력 배열 자체와 모든 원소 필드가 그대로.
      expect(activities).toEqual(snapshot);
      expect(activities).toHaveLength(2);
      expect(activities[0].externalId).toBe("realdata-e2e-eval-plan-c1");
      expect(activities[1].externalId).toBe("realdata-e2e-eval-plan-c2");
    });
  });
});
