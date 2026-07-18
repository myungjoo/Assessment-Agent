// realdata-e2e-evaluation-plan.spec.ts — T-0591 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: github(commit/pr/issue) + confluence 를 섞은 Activity[] + 유효 modelId →
//     plan.inputs.length === activities.length AND plan.callArgs.length === activities.length AND
//     각 callArgs[i].input === plan.inputs[i] AND callArgs[i].options.modelId === modelId 검증.
//   - flow/branch: 빈 activities → 빈 plan / 단일 원소 / 다수 원소 분기 + modelId guard 분기
//     (유효 / 빈 / 공백)가 전부 cover. 본 컴포저 자체의 추가 분기는 0(위임 helper 가 담당).
//   - error/negative 충분 cover: (a) 빈 modelId throw, (b) 공백-only modelId throw,
//     (c) 빈 activities → 빈 plan(에러 아님, 경계값), (d) 입력 activities mutate 0(무공유),
//     (e) 두 호출 반환 plan 이 서로 다른 객체 reference 각 1+ test(단일 negative 만으로 부족 —
//     guard/무공유 분기마다 cover).
//   - 무공유/순수성: 입력 배열·원소 불변 + 매 호출 새 plan/inputs/callArgs + 결정론(deep-equal).
import type {
  Activity,
  ConfluenceActivity,
  GithubActivity,
} from "../../src/assessment-collection/domain/activity";

import * as evaluationInputsModule from "./realdata-e2e-evaluation-inputs";
import { buildRealDataEvaluationInputs } from "./realdata-e2e-evaluation-inputs";
import { buildRealDataEvaluationPlan } from "./realdata-e2e-evaluation-plan";
import * as consistency from "./realdata-e2e-evaluation-plan-consistency";
import * as scoringCallArgsModule from "./realdata-e2e-scoring-call-args";

const MODEL_ID = "qwen2.5-coder:32b";

// fixtures — github commit/pr/issue + confluence page 를 섞은 Activity[](다양성 승계).
const COMMIT: GithubActivity = {
  sourceType: "github",
  externalId: "abc123",
  instanceKey: "com",
  author: "myungjoo",
  timestamp: "2026-06-01T00:00:00.000Z",
  metadata: { additions: 10 },
  repoRef: "octo-org/octo-repo",
  kind: "commit",
};
const PR: GithubActivity = {
  sourceType: "github",
  externalId: "42",
  instanceKey: "com",
  author: "leemgs",
  timestamp: "2026-06-02T00:00:00.000Z",
  metadata: { titleLength: 24 },
  repoRef: "octo-org/octo-repo",
  kind: "pr",
};
const ISSUE: GithubActivity = {
  sourceType: "github",
  externalId: "7",
  instanceKey: "sec",
  author: "myungjoo",
  timestamp: "2026-06-03T00:00:00.000Z",
  metadata: {},
  repoRef: "octo-org/other-repo",
  kind: "issue",
};
const PAGE: ConfluenceActivity = {
  sourceType: "confluence",
  externalId: "page-99",
  instanceKey: "ENG",
  author: "leemgs",
  timestamp: "2026-06-04T00:00:00.000Z",
  metadata: { version: 3 },
  spaceRef: "ENG",
  version: 3,
};

// 혼합 Activity[] fixture 생성(매 test 가 fresh 입력을 받도록 함수로 — 무공유 검증 격리).
function mixedActivities(): Activity[] {
  return [COMMIT, PR, ISSUE, PAGE];
}

describe("buildRealDataEvaluationPlan", () => {
  describe("happy path (정상 plan 산출)", () => {
    it("혼합 Activity[] + 유효 modelId → inputs/callArgs 길이가 activities 와 동일", () => {
      const activities = mixedActivities();
      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);
      expect(plan.inputs).toHaveLength(activities.length);
      expect(plan.callArgs).toHaveLength(activities.length);
    });

    it("각 callArgs[i].input 이 plan.inputs[i] 와 reference 동일 (페어링 정합)", () => {
      const plan = buildRealDataEvaluationPlan(mixedActivities(), MODEL_ID);
      plan.callArgs.forEach((args, i) => {
        expect(args.input).toBe(plan.inputs[i]);
      });
    });

    it("모든 callArgs 의 options.modelId 가 전달값과 동일 (단일 modelId 동형 적용)", () => {
      const plan = buildRealDataEvaluationPlan(mixedActivities(), MODEL_ID);
      for (const args of plan.callArgs) {
        expect(args.options).toEqual({ modelId: MODEL_ID });
      }
    });

    it("plan.inputs 는 위임 매퍼(buildRealDataEvaluationInputs) 결과와 deep-equal (재구현 0)", () => {
      const activities = mixedActivities();
      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);
      expect(plan.inputs).toEqual(buildRealDataEvaluationInputs(activities));
    });

    it("plan.inputs 의 unitId 순서가 입력 Activity 순서를 보존한다", () => {
      const plan = buildRealDataEvaluationPlan(mixedActivities(), MODEL_ID);
      expect(plan.inputs.map((i) => i.unitId)).toEqual([
        "github:com:abc123",
        "github:com:42",
        "github:sec:7",
        "confluence:ENG:page-99",
      ]);
    });

    it("plan 은 inputs/callArgs 키만 가진다 (새 raw 필드 0, R-59)", () => {
      const plan = buildRealDataEvaluationPlan(mixedActivities(), MODEL_ID);
      expect(Object.keys(plan).sort()).toEqual(["callArgs", "inputs"]);
    });
  });

  describe("flow / branch (분기 cover)", () => {
    it("(분기 빈 activities) 빈 배열 + 유효 modelId → 빈 plan (throw 0)", () => {
      expect(() => buildRealDataEvaluationPlan([], MODEL_ID)).not.toThrow();
      expect(buildRealDataEvaluationPlan([], MODEL_ID)).toEqual({
        inputs: [],
        callArgs: [],
      });
    });

    it("(분기 단일 원소) 단일 Activity → inputs/callArgs 길이 1", () => {
      const plan = buildRealDataEvaluationPlan([COMMIT], MODEL_ID);
      expect(plan.inputs).toHaveLength(1);
      expect(plan.callArgs).toHaveLength(1);
      expect(plan.callArgs[0].input).toBe(plan.inputs[0]);
      expect(plan.callArgs[0].options).toEqual({ modelId: MODEL_ID });
    });

    it("(분기 다수 원소) 다수 Activity → 동일 길이 inputs/callArgs", () => {
      const plan = buildRealDataEvaluationPlan(mixedActivities(), MODEL_ID);
      expect(plan.inputs).toHaveLength(4);
      expect(plan.callArgs).toHaveLength(4);
    });

    it("(분기 modelId 유효) 공백 포함 비-공백 modelId 는 통과한다", () => {
      const plan = buildRealDataEvaluationPlan(mixedActivities(), "  llama3  ");
      expect(plan.callArgs[0].options.modelId).toBe("  llama3  ");
    });
  });

  describe("error / negative cases (위임 guard throw 전파 충분 cover)", () => {
    it("(a) modelId 빈 문자열 → 위임 guard throw 그대로 전파", () => {
      expect(() => buildRealDataEvaluationPlan(mixedActivities(), "")).toThrow(
        /modelId/,
      );
    });

    it("(b) modelId 공백-only → 위임 guard throw 그대로 전파", () => {
      expect(() =>
        buildRealDataEvaluationPlan(mixedActivities(), "   "),
      ).toThrow(/modelId/);
    });

    it("(b') modelId 탭/개행 공백만 → 위임 guard throw 그대로 전파", () => {
      expect(() =>
        buildRealDataEvaluationPlan(mixedActivities(), "\t\n "),
      ).toThrow(/modelId/);
    });

    it("(c 경계값) 빈 activities + 빈 modelId → guard 가 우선 throw 한다 (조용한 통과 차단)", () => {
      expect(() => buildRealDataEvaluationPlan([], "")).toThrow(/modelId/);
    });
  });

  describe("순수성 / 무공유 / 결정론 (negative — mutation·shared-state 격리)", () => {
    it("(d) 입력 activities 배열·원소를 mutate 하지 않는다 (호출 전후 deep-equal)", () => {
      const activities = mixedActivities();
      const snapshot = JSON.stringify(activities);
      buildRealDataEvaluationPlan(activities, MODEL_ID);
      expect(JSON.stringify(activities)).toBe(snapshot);
      expect(activities).toHaveLength(4);
    });

    it("(e) 두 호출의 반환 plan / inputs / callArgs reference 가 서로 다르다", () => {
      const activities = mixedActivities();
      const a = buildRealDataEvaluationPlan(activities, MODEL_ID);
      const b = buildRealDataEvaluationPlan(activities, MODEL_ID);
      expect(a).not.toBe(b);
      expect(a.inputs).not.toBe(b.inputs);
      expect(a.callArgs).not.toBe(b.callArgs);
      expect(a.callArgs[0]).not.toBe(b.callArgs[0]);
      expect(a.callArgs[0].options).not.toBe(b.callArgs[0].options);
    });

    it("(결정론) 동일 (activities, modelId) 두 번 호출 → deep-equal 결과", () => {
      const activities = mixedActivities();
      const a = buildRealDataEvaluationPlan(activities, MODEL_ID);
      const b = buildRealDataEvaluationPlan(activities, MODEL_ID);
      expect(a).toEqual(b);
    });

    it("반환 callArgs.options 를 mutate 해도 다음 호출이 오염되지 않는다", () => {
      const activities = mixedActivities();
      const first = buildRealDataEvaluationPlan(activities, MODEL_ID);
      first.callArgs[0].options.modelId = "TAMPERED";
      const second = buildRealDataEvaluationPlan(activities, MODEL_ID);
      expect(second.callArgs[0].options.modelId).toBe(MODEL_ID);
    });
  });

  // T-0682 self-wire 배선 검증 — 컴포저가 산출 plan({inputs, callArgs}) 반환 직전 consistency
  // 가드를 (산출 plan, activities, modelId) 인자로 정확히 1회 self-assert 하는지, 정상
  // 합성이면 throw 0·반환 plan byte-identical·무공유 불변, 가드가 throw 하면 컴포저가
  // 삼키지 않고 전파하는지, 위임 modelId guard throw 입력에서는 가드 진입 전 그 throw 가
  // 전파(가드 미호출)되는지, 가드 회귀(RangeError/TypeError 모의) 전파를 검증한다.
  describe("consistency 가드 self-wire (T-0682) — 반환 직전 self-assert 배선", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("정상 합성(다수 원소) → 가드가 (산출 plan, activities, modelId) 인자로 정확히 1회 호출됨", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataEvaluationPlanConsistentWithSources",
      );
      const activities = mixedActivities();

      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);

      // 정확히 1회 호출.
      expect(spy).toHaveBeenCalledTimes(1);
      // 인자 순서·값이 (반환된 산출 plan, activities, modelId) 와 일치.
      expect(spy).toHaveBeenCalledWith(plan, activities, MODEL_ID);
      // 가드에 넘어간 첫 인자가 컴포저가 반환한 바로 그 plan 참조여야 한다(검증 대상 일치).
      expect(spy.mock.calls[0][0]).toBe(plan);
      expect(spy.mock.calls[0][1]).toBe(activities);
      expect(spy.mock.calls[0][2]).toBe(MODEL_ID);
      // negative — 인자 payload drift 대조: 위 With(plan, activities, MODEL_ID) positive 가
      // 실제로 인자 drift 를 잡음을 노출. toHaveBeenCalledWith 는 deep-equality 매칭이라
      // negative 대상은 값 자체가 실제 주입값과 다르도록 구성한다. activities 가 다수 원소가
      // 아닌 단일 [COMMIT] 이면 미매칭(원소 수 drift), modelId 값이 다르면 미매칭.
      expect(spy).not.toHaveBeenCalledWith(plan, [COMMIT], MODEL_ID);
      expect(spy).not.toHaveBeenCalledWith(
        plan,
        activities,
        MODEL_ID + "-drift",
      );
      // negative — arity 봉함: 가드가 정확히 3 인자(plan, activities, modelId)로만 호출되고
      // 여분 인자가 0 임을 길이로 봉함(positional index 접근은 값 대조일 뿐 길이 봉함 아님).
      expect(spy.mock.calls[0].length).toBe(3);
      // 분기 없음 — 본 happy it 은 다수 원소 정상 합성 단일 경로 tighten(가드 self-wire 1회
      // 호출)이라 새 분기 도입 0. 인접한 단일 원소 분기 대조 it·빈 activities 경계 대조 it 은
      // 별개 경계로 손대지 않음.
    });

    it("(분기 단일 원소) 단일 Activity 분기에서도 가드가 (산출 plan, activities, modelId) 로 정확히 1회 호출됨", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataEvaluationPlanConsistentWithSources",
      );
      const activities: Activity[] = [COMMIT];

      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(plan, activities, MODEL_ID);
    });

    it("(분기 빈 activities 경계) 빈 배열에서도 가드가 (산출 plan, [], modelId) 로 정확히 1회 호출됨", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataEvaluationPlanConsistentWithSources",
      );
      const empty: Activity[] = [];

      const plan = buildRealDataEvaluationPlan(empty, MODEL_ID);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(plan, empty, MODEL_ID);
      // 빈 plan 통과(가드가 빈 inputs/callArgs 를 정합으로 인정 — throw 0).
      expect(plan).toEqual({ inputs: [], callArgs: [] });
    });

    it("정상 합성 → 가드 통과 후 반환 plan 이 가드 미배선 기대값(위임 inputs + callArgs 페어링)과 byte-identical(불변)", () => {
      const activities = mixedActivities();

      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);

      // self-wire 가 반환 plan 을 변형하지 않음 — 위임 inputs 산출과 deep-equal·
      // reference 페어링 유지.
      expect(plan.inputs).toEqual(buildRealDataEvaluationInputs(activities));
      plan.callArgs.forEach((args, i) => {
        expect(args.input).toBe(plan.inputs[i]);
      });
    });

    it("(c-RangeError drift 회귀 모사) 가드가 RangeError throw 하면 컴포저가 삼키지 않고 그대로 전파", () => {
      jest
        .spyOn(consistency, "assertRealDataEvaluationPlanConsistentWithSources")
        .mockImplementation(() => {
          throw new RangeError(
            "정합 위반: plan.inputs 가 재유도 expected 와 byte-identical 하지 않다",
          );
        });

      expect(() =>
        buildRealDataEvaluationPlan(mixedActivities(), MODEL_ID),
      ).toThrow(/byte-identical 하지 않다/);
    });

    it("(reference 페어링 깨짐 회귀 모사) 가드 RangeError(reference) throw 전파", () => {
      jest
        .spyOn(consistency, "assertRealDataEvaluationPlanConsistentWithSources")
        .mockImplementation(() => {
          throw new RangeError(
            "정합 위반: plan.callArgs[0].input 이 plan.inputs[0] 와 동일 reference 가 아니다 — reference 페어링(복제 0 계약)이 깨졌다.",
          );
        });

      expect(() =>
        buildRealDataEvaluationPlan(mixedActivities(), MODEL_ID),
      ).toThrow(/reference 페어링/);
    });

    it("(구조결손 회귀 모사) 가드 TypeError throw 전파", () => {
      jest
        .spyOn(consistency, "assertRealDataEvaluationPlanConsistentWithSources")
        .mockImplementation(() => {
          throw new TypeError(
            "plan.inputs 가 배열이 아니다 — inputs 정합 비교를 진행할 수 없다.",
          );
        });

      expect(() =>
        buildRealDataEvaluationPlan(mixedActivities(), MODEL_ID),
      ).toThrow(TypeError);
    });

    it("(negative 빈 modelId) 위임 callArgs guard throw 입력에서는 가드 진입 전 위임 throw 가 전파(가드 미호출)", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataEvaluationPlanConsistentWithSources",
      );

      expect(() => buildRealDataEvaluationPlan(mixedActivities(), "")).toThrow(
        /modelId/,
      );
      // 위임 callArgs guard 단계에서 throw → 가드 self-assert 까지 도달하지 못함.
      expect(spy).not.toHaveBeenCalled();
    });

    it("(negative 공백-only modelId) 위임 callArgs guard throw 전파(가드 미호출)", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataEvaluationPlanConsistentWithSources",
      );

      expect(() =>
        buildRealDataEvaluationPlan(mixedActivities(), "   "),
      ).toThrow(/modelId/);
      expect(spy).not.toHaveBeenCalled();
    });

    it("self-wire 배선 후에도 입력 비변형 + 동일 입력 두 번 deterministic + 반환 plan 무공유", () => {
      const activities = mixedActivities();
      const snapshot = JSON.stringify(activities);

      const a = buildRealDataEvaluationPlan(activities, MODEL_ID);
      const b = buildRealDataEvaluationPlan(activities, MODEL_ID);

      // 비변형(activities mutate 0).
      expect(JSON.stringify(activities)).toBe(snapshot);
      // deterministic byte-identical.
      expect(a).toEqual(b);
      // 무공유(반환 plan 의 inputs/callArgs 트리가 호출마다 새 객체).
      expect(a.inputs).not.toBe(b.inputs);
      expect(a.callArgs).not.toBe(b.callArgs);
    });
  });

  // T-1052 — 컴포저 본문 위임(delegate) 순서-lock(inputs → scoring).
  //
  // 기존 spec 은 두 sub-composer 산출의 값 대조(deep-equal)와 self-wire 가드(T-0682)
  // 배선만 검증하고, 두 builder 위임의 상대 호출 순서(inputs → scoring)는
  // invocationCallOrder 부등식으로 못박지 않았다(grep 0). publish-plan 축
  // (T-1049/T-1050, commandPlan → searchGhArgv 데이터-의존 mirror) canonical 패턴을
  // evaluation-plan 축으로 확립해 그 gap 을 해소한다 — buildRealDataEvaluationInputs →
  // buildRealDataScoringCallArgs 순서를 invocationCallOrder 부등식으로 못박아 silent
  // 재정렬 회귀를 감지한다. scoring 위임은 inputs 위임의 산출을 첫 인자로 받는
  // 데이터-의존 chain 이라 inputs 가 반드시 먼저 평가돼야 한다. 2-delegate chain 이라
  // 한 부등식으로 lock.
  //
  // R-112 cover 구조(순서-lock):
  //   - happy-path/flow: 두 builder 위임을 실 구현 pass-through spy 로 감싸고 T-0682
  //     self-wire 가드를 no-op mock 으로 격리(재유도가 위임을 재호출하지 않게)해 컴포저
  //     본 합성 1회 시 inputs 첫 호출이 scoring 첫 호출보다 먼저(invocationCallOrder
  //     toBeLessThan) + 각 정확히 1회 + 인자 전파(inputs(activities); scoring(inputs,
  //     MODEL_ID), scoring 첫 인자 === inputs 위임 반환값 === plan.inputs reference).
  //   - branch/무공유 재확인: pass-through spy 하에서도 산출 plan 이 {inputs, callArgs}
  //     필드만 보유 + callArgs[i].input === inputs[i] reference 페어링 보존.
  //   - error/negative(fail-fast): inputs 위임 강제 throw 시 scoring 위임 미도달(0회) —
  //     inputs-먼저 순서로 scoring 도달 불가를 fail-fast 로 못박음.
  //   - error/negative(guard-우선): 빈 modelId → scoring 위임 guard throw 전파, 이때
  //     inputs 위임은 이미 호출됨(순서 상 inputs 가 scoring 보다 먼저 평가됨을 negative
  //     경로에서도 재확인).
  describe("T-1052 — 컴포저 본문 위임 순서-lock(inputs → scoring)", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("정상 합성 시 inputs 위임이 scoring 위임보다 먼저 호출된다(invocationCallOrder 부등식·인자 전파·각 1회)", () => {
      // T-0682 self-wire 가드를 no-op 으로 mock — 반환 직전 재유도가 두 builder 위임을
      // 재호출하지 않게 해 컴포저 본 합성의 위임 호출 순서·인자·횟수만 격리 검증한다
      // (재유도 호출 검증은 T-0682 self-wire describe 의 몫).
      jest
        .spyOn(consistency, "assertRealDataEvaluationPlanConsistentWithSources")
        .mockImplementation(() => {});
      const inputsSpy = jest.spyOn(
        evaluationInputsModule,
        "buildRealDataEvaluationInputs",
      );
      const scoringSpy = jest.spyOn(
        scoringCallArgsModule,
        "buildRealDataScoringCallArgs",
      );

      const activities = mixedActivities();
      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);

      // 가드 no-op 이라 재유도 0 → 각 위임 정확히 1회(컴포저 본문 위임 지점 각 1개).
      expect(inputsSpy).toHaveBeenCalledTimes(1);
      expect(scoringSpy).toHaveBeenCalledTimes(1);
      // 순서: inputs 위임(첫 호출)이 scoring 위임(첫 호출)보다 먼저 호출된다.
      expect(inputsSpy.mock.invocationCallOrder[0]).toBeLessThan(
        scoringSpy.mock.invocationCallOrder[0],
      );
      // 인자 전파: inputs 위임은 원본 activities 로, scoring 위임은 (inputs, MODEL_ID) 로
      // 호출된다. scoring 첫 인자 = inputs 위임 반환값 = plan.inputs(reference 동일 —
      // 데이터-의존 chain 못박기).
      expect(inputsSpy).toHaveBeenCalledWith(activities);
      const producedInputs = inputsSpy.mock.results[0].value;
      expect(scoringSpy).toHaveBeenCalledWith(producedInputs, MODEL_ID);
      expect(scoringSpy.mock.calls[0][0]).toBe(producedInputs);
      expect(scoringSpy.mock.calls[0][0]).toBe(plan.inputs);
    });

    it("(branch/무공유 재확인) pass-through spy 하에서도 산출 plan 이 {inputs, callArgs} 필드만 보유 + reference 페어링 보존", () => {
      jest
        .spyOn(consistency, "assertRealDataEvaluationPlanConsistentWithSources")
        .mockImplementation(() => {});
      jest.spyOn(evaluationInputsModule, "buildRealDataEvaluationInputs");
      jest.spyOn(scoringCallArgsModule, "buildRealDataScoringCallArgs");

      const plan = buildRealDataEvaluationPlan(mixedActivities(), MODEL_ID);

      // 순서-검증(pass-through spy) 전후 산출 정합 — 기존 값 대조 test 와 동일.
      expect(Object.keys(plan).sort()).toEqual(["callArgs", "inputs"]);
      plan.callArgs.forEach((args, i) => {
        expect(args.input).toBe(plan.inputs[i]);
      });
    });

    it("(a fail-fast) inputs 위임이 throw 하면 scoring 위임에 도달하지 못한다(scoring 0회)", () => {
      jest
        .spyOn(evaluationInputsModule, "buildRealDataEvaluationInputs")
        .mockImplementation(() => {
          throw new Error("forced inputs failure");
        });
      const scoringSpy = jest.spyOn(
        scoringCallArgsModule,
        "buildRealDataScoringCallArgs",
      );

      expect(() =>
        buildRealDataEvaluationPlan(mixedActivities(), MODEL_ID),
      ).toThrow(/forced inputs failure/);

      // inputs-먼저 순서로 인해 inputs throw 가 scoring 도달 전에 선전파 → scoring 미호출.
      expect(scoringSpy).toHaveBeenCalledTimes(0);
    });

    it("(b guard-throw 전파) 빈 modelId → scoring 위임 guard throw 전파, 이때 inputs 위임은 이미 호출됨(1회·inputs → scoring 순서 재확인)", () => {
      const inputsSpy = jest.spyOn(
        evaluationInputsModule,
        "buildRealDataEvaluationInputs",
      );
      const scoringSpy = jest.spyOn(
        scoringCallArgsModule,
        "buildRealDataScoringCallArgs",
      );

      expect(() => buildRealDataEvaluationPlan(mixedActivities(), "")).toThrow(
        /modelId/,
      );

      // 순서 상 inputs 가 scoring 보다 먼저 평가됨 — scoring 위임 guard throw 시점에
      // inputs 는 이미 1회 호출됐고 scoring 도 1회 진입(그 안의 modelId guard 가 throw).
      expect(inputsSpy).toHaveBeenCalledTimes(1);
      expect(scoringSpy).toHaveBeenCalledTimes(1);
      expect(inputsSpy.mock.invocationCallOrder[0]).toBeLessThan(
        scoringSpy.mock.invocationCallOrder[0],
      );
    });
  });
});
