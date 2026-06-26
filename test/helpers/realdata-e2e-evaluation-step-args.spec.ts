// realdata-e2e-evaluation-step-args.spec.ts — T-0598 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: (a) 유효 runPlan(검증된 pipeline.modelId) + 다수 activities →
//     {inputs, callArgs} 산출, 각 callArgs[i].input === inputs[i](reference 동일) +
//     각 callArgs[i].options.modelId === runPlan.pipeline.modelId, (b) 위임
//     buildRealDataEvaluationPlan(activities, modelId) 결과와 deep-equal(재구현 0),
//     (c) plan 키가 정확히 {inputs, callArgs}(R-59).
//   - modelId 단일 source: caller 가 modelId 를 따로 못 넘기고 runPlan 에서만 도출됨 —
//     runPlan.pipeline.modelId 를 바꾼 두 runPlan 이 서로 다른 options.modelId 를 낳음.
//   - error path: runPlan.pipeline.modelId 빈/공백-only → 위임 하위
//     buildRealDataScoringCallArgs modelId guard throw 가 자체 try/catch 없이 전파됨.
//   - flow/branch: 빈 activities 배열 분기(→ {inputs:[], callArgs:[]}, throw 0) +
//     단일/다수 activities 분기 각 1+.
//   - negative 충분 cover(단일 negative 금지 — 예외 분기마다): (1) modelId 빈 문자열,
//     (2) modelId 공백-only(스페이스/탭/개행), (3) 빈 activities + 유효 modelId 경계(throw 0),
//     (4) 입력 runPlan/activities mutate 0(호출 전후 deep-equal 스냅샷), (5) 무공유
//     (동일 입력 두 번 호출 → deep-equal 이되 not-same-reference).
//   - 결정론: 동일 (runPlan, activities) 두 번 호출 → deep-equal 결과.
import type {
  Activity,
  ConfluenceActivity,
  GithubActivity,
} from "../../src/assessment-collection/domain/activity";

import { buildRealDataEvaluationPlan } from "./realdata-e2e-evaluation-plan";
import { buildRealDataEvaluationStepArgs } from "./realdata-e2e-evaluation-step-args";
import * as consistency from "./realdata-e2e-evaluation-step-args-consistency";
import type { RealDataE2eRunPlan } from "./realdata-e2e-run-plan";

// 유효 modelId fixture — 평가 정책 모델 식별 문자열.
const MODEL_ID = "qwen2.5-coder:32b";

// run plan fixture 생성기 — 주어진 modelId 를 pipeline.modelId 에 담은 유효
// RealDataE2eRunPlan(검증된 run ref 포함). 매 호출 fresh 객체(무공유 검증 격리).
function makeRunPlan(modelId: string = MODEL_ID): RealDataE2eRunPlan {
  return {
    pipeline: {
      collectCallArgs: [
        {
          person: {
            serviceIdentities: [
              { service: "github.com", externalId: "myungjoo" },
            ],
          },
          since: undefined,
          assessmentId: "ASSESSMENT_ID_PLACEHOLDER",
        },
      ],
      modelId,
    },
    run: { gitSha: "abc1234", dateToken: "2026-06-23" },
  };
}

// Activity fixtures — github commit/pr/issue + confluence page 혼합(다양성 승계).
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

// 혼합 Activity[] fixture 생성(매 test 가 fresh 입력 — 무공유 검증 격리).
function mixedActivities(): Activity[] {
  return [COMMIT, PR, ISSUE, PAGE];
}

describe("buildRealDataEvaluationStepArgs — run plan + activities → scoreUnit 호출-args 컴포저", () => {
  describe("happy-path — run plan modelId thread + 평가 plan 합성", () => {
    it("유효 runPlan + 다수 activities → callArgs[i].input === inputs[i] (reference 동일)", () => {
      const plan = buildRealDataEvaluationStepArgs(
        makeRunPlan(),
        mixedActivities(),
      );

      expect(plan.inputs).toHaveLength(4);
      expect(plan.callArgs).toHaveLength(4);
      plan.callArgs.forEach((args, i) => {
        expect(args.input).toBe(plan.inputs[i]);
      });
    });

    it("각 callArgs[i].options.modelId === runPlan.pipeline.modelId (단일 modelId thread)", () => {
      const runPlan = makeRunPlan();
      const plan = buildRealDataEvaluationStepArgs(runPlan, mixedActivities());

      for (const args of plan.callArgs) {
        expect(args.options.modelId).toBe(runPlan.pipeline.modelId);
      }
    });

    it("위임 buildRealDataEvaluationPlan(activities, runPlan.pipeline.modelId) 결과와 deep-equal (재구현 0)", () => {
      const activities = mixedActivities();
      const plan = buildRealDataEvaluationStepArgs(makeRunPlan(), activities);

      expect(plan).toEqual(buildRealDataEvaluationPlan(activities, MODEL_ID));
    });

    it("plan 키가 정확히 {inputs, callArgs} (R-59 — raw narrative 키 0)", () => {
      const plan = buildRealDataEvaluationStepArgs(
        makeRunPlan(),
        mixedActivities(),
      );

      expect(Object.keys(plan).sort()).toEqual(["callArgs", "inputs"]);
    });
  });

  describe("modelId 단일 source — caller 가 따로 못 넘기고 runPlan 에서만 도출", () => {
    it("서로 다른 runPlan.pipeline.modelId → 산출 options.modelId 도 그에 따라 달라진다", () => {
      const planA = buildRealDataEvaluationStepArgs(
        makeRunPlan("modelA:7b"),
        mixedActivities(),
      );
      const planB = buildRealDataEvaluationStepArgs(
        makeRunPlan("modelB:32b"),
        mixedActivities(),
      );

      expect(planA.callArgs[0].options.modelId).toBe("modelA:7b");
      expect(planB.callArgs[0].options.modelId).toBe("modelB:32b");
    });
  });

  describe("flow / branch 분기 cover — 빈/단일/다수 activities", () => {
    it("빈 activities 배열 + 유효 modelId → {inputs: [], callArgs: []} (throw 0)", () => {
      expect(() =>
        buildRealDataEvaluationStepArgs(makeRunPlan(), []),
      ).not.toThrow();
      expect(buildRealDataEvaluationStepArgs(makeRunPlan(), [])).toEqual({
        inputs: [],
        callArgs: [],
      });
    });

    it("단일 activity → inputs/callArgs 길이 1", () => {
      const plan = buildRealDataEvaluationStepArgs(makeRunPlan(), [COMMIT]);

      expect(plan.inputs).toHaveLength(1);
      expect(plan.callArgs).toHaveLength(1);
      expect(plan.callArgs[0].input).toBe(plan.inputs[0]);
      expect(plan.callArgs[0].options.modelId).toBe(MODEL_ID);
    });

    it("다수 activity → 동일 길이 inputs/callArgs", () => {
      const plan = buildRealDataEvaluationStepArgs(
        makeRunPlan(),
        mixedActivities(),
      );

      expect(plan.inputs).toHaveLength(4);
      expect(plan.callArgs).toHaveLength(4);
    });
  });

  describe("error path / negative cases 충분 cover — 위임 modelId guard throw 전파", () => {
    it("(1) runPlan.pipeline.modelId 빈 문자열 → 위임 하위 guard throw 전파", () => {
      expect(() =>
        buildRealDataEvaluationStepArgs(makeRunPlan(""), mixedActivities()),
      ).toThrow(/modelId/);
    });

    it("(2a) runPlan.pipeline.modelId 공백-only(스페이스) → 위임 하위 guard throw 전파", () => {
      expect(() =>
        buildRealDataEvaluationStepArgs(makeRunPlan("   "), mixedActivities()),
      ).toThrow(/modelId/);
    });

    it("(2b) runPlan.pipeline.modelId 탭·개행만 → 위임 하위 guard throw 전파", () => {
      expect(() =>
        buildRealDataEvaluationStepArgs(
          makeRunPlan("\t\n "),
          mixedActivities(),
        ),
      ).toThrow(/modelId/);
    });

    it("(3 경계값) 빈 activities + 빈 modelId → guard 가 우선 throw 한다 (조용한 통과 차단)", () => {
      expect(() =>
        buildRealDataEvaluationStepArgs(makeRunPlan(""), []),
      ).toThrow(/modelId/);
    });
  });

  describe("순수성 / 무공유 / 결정론 (negative — mutation·shared-state 격리)", () => {
    it("(4) 입력 runPlan / activities 를 mutate 하지 않는다 (호출 전후 deep-equal 스냅샷)", () => {
      const runPlan = makeRunPlan();
      const activities = mixedActivities();
      const runPlanSnapshot = JSON.stringify(runPlan);
      const activitiesSnapshot = JSON.stringify(activities);

      buildRealDataEvaluationStepArgs(runPlan, activities);

      expect(JSON.stringify(runPlan)).toBe(runPlanSnapshot);
      expect(JSON.stringify(activities)).toBe(activitiesSnapshot);
      expect(activities).toHaveLength(4);
    });

    it("(5) 동일 입력 두 번 호출 → deep-equal 이되 plan/inputs/callArgs not-same-reference", () => {
      const runPlan = makeRunPlan();
      const activities = mixedActivities();
      const a = buildRealDataEvaluationStepArgs(runPlan, activities);
      const b = buildRealDataEvaluationStepArgs(runPlan, activities);

      expect(a).toEqual(b);
      expect(a).not.toBe(b);
      expect(a.inputs).not.toBe(b.inputs);
      expect(a.callArgs).not.toBe(b.callArgs);
      expect(a.callArgs[0]).not.toBe(b.callArgs[0]);
      expect(a.callArgs[0].options).not.toBe(b.callArgs[0].options);
    });

    it("(결정론) 동일 (runPlan, activities) 두 번 호출 → deep-equal 결과", () => {
      const runPlan = makeRunPlan();
      const activities = mixedActivities();

      expect(buildRealDataEvaluationStepArgs(runPlan, activities)).toEqual(
        buildRealDataEvaluationStepArgs(runPlan, activities),
      );
    });

    it("반환 callArgs.options 를 mutate 해도 다음 호출이 오염되지 않는다 (무공유)", () => {
      const runPlan = makeRunPlan();
      const activities = mixedActivities();
      const first = buildRealDataEvaluationStepArgs(runPlan, activities);
      first.callArgs[0].options.modelId = "TAMPERED";

      const second = buildRealDataEvaluationStepArgs(runPlan, activities);
      expect(second.callArgs[0].options.modelId).toBe(MODEL_ID);
    });
  });

  // T-0684 self-wire 배선 검증 — 컴포저가 산출 plan({inputs, callArgs}) 반환 직전
  // consistency 가드를 (산출 plan, runPlan, activities) 인자로 정확히 1회 self-assert
  // 하는지, 정상 합성이면 throw 0·반환 plan byte-identical·무공유 불변, 가드가 throw 하면
  // 컴포저가 삼키지 않고 그대로 전파하는지, 위임 modelId guard throw 입력에서는 가드 진입
  // 전 그 throw 가 전파(가드 미호출)되는지, 가드 회귀(RangeError/TypeError 모의) 전파를
  // 검증한다. T-0682 evaluation-plan self-wire spec 패턴의 step-args layer mirror.
  describe("consistency 가드 self-wire (T-0684) — 반환 직전 self-assert 배선", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("정상 합성(다수 원소) → 가드가 (산출 plan, runPlan, activities) 인자로 정확히 1회 호출됨", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataEvaluationStepArgsConsistentWithSources",
      );
      const runPlan = makeRunPlan();
      const activities = mixedActivities();

      const plan = buildRealDataEvaluationStepArgs(runPlan, activities);

      // 정확히 1회 호출.
      expect(spy).toHaveBeenCalledTimes(1);
      // 인자 순서·값이 (반환된 산출 plan, runPlan, activities) 와 일치.
      expect(spy).toHaveBeenCalledWith(plan, runPlan, activities);
      // 가드에 넘어간 첫 인자가 컴포저가 반환한 바로 그 plan 참조여야 한다(검증 대상 일치).
      expect(spy.mock.calls[0][0]).toBe(plan);
      expect(spy.mock.calls[0][1]).toBe(runPlan);
      expect(spy.mock.calls[0][2]).toBe(activities);
    });

    it("(분기 단일 원소) 단일 Activity 분기에서도 가드가 (산출 plan, runPlan, activities) 로 정확히 1회 호출됨", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataEvaluationStepArgsConsistentWithSources",
      );
      const runPlan = makeRunPlan();
      const activities: Activity[] = [COMMIT];

      const plan = buildRealDataEvaluationStepArgs(runPlan, activities);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(plan, runPlan, activities);
    });

    it("(분기 빈 activities 경계) 빈 배열에서도 가드가 (산출 plan, runPlan, []) 로 정확히 1회 호출됨", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataEvaluationStepArgsConsistentWithSources",
      );
      const runPlan = makeRunPlan();
      const empty: Activity[] = [];

      const plan = buildRealDataEvaluationStepArgs(runPlan, empty);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(plan, runPlan, empty);
      // 빈 plan 통과(가드가 빈 inputs/callArgs 를 정합으로 인정 — throw 0).
      expect(plan).toEqual({ inputs: [], callArgs: [] });
    });

    it("정상 합성 → 가드 통과 후 반환 plan 이 가드 미배선 기대값(위임 산출 + 페어링)과 byte-identical(불변)", () => {
      const activities = mixedActivities();

      const plan = buildRealDataEvaluationStepArgs(makeRunPlan(), activities);

      // self-wire 가 반환 plan 을 변형하지 않음 — 위임 종단 컴포저 산출과 deep-equal·
      // reference 페어링 유지.
      expect(plan).toEqual(buildRealDataEvaluationPlan(activities, MODEL_ID));
      plan.callArgs.forEach((args, i) => {
        expect(args.input).toBe(plan.inputs[i]);
      });
    });

    it("(c-RangeError inputs drift 회귀 모사) 가드가 RangeError throw 하면 컴포저가 삼키지 않고 그대로 전파", () => {
      jest
        .spyOn(
          consistency,
          "assertRealDataEvaluationStepArgsConsistentWithSources",
        )
        .mockImplementation(() => {
          throw new RangeError(
            "정합 위반: plan.inputs 가 재유도 expected 와 byte-identical 하지 않다",
          );
        });

      expect(() =>
        buildRealDataEvaluationStepArgs(makeRunPlan(), mixedActivities()),
      ).toThrow(/byte-identical 하지 않다/);
    });

    it("(c-RangeError callArgs drift 회귀 모사) 가드 RangeError(callArgs) throw 전파", () => {
      jest
        .spyOn(
          consistency,
          "assertRealDataEvaluationStepArgsConsistentWithSources",
        )
        .mockImplementation(() => {
          throw new RangeError(
            "정합 위반: plan.callArgs 가 재유도 expected 와 byte-identical 하지 않다",
          );
        });

      expect(() =>
        buildRealDataEvaluationStepArgs(makeRunPlan(), mixedActivities()),
      ).toThrow(/callArgs 가 재유도 expected/);
    });

    it("(reference 페어링 깨짐 회귀 모사) 가드 RangeError(reference) throw 전파", () => {
      jest
        .spyOn(
          consistency,
          "assertRealDataEvaluationStepArgsConsistentWithSources",
        )
        .mockImplementation(() => {
          throw new RangeError(
            "정합 위반: plan.callArgs[0].input 이 plan.inputs[0] 와 동일 reference 가 아니다 — reference 페어링(복제 0 계약)이 깨졌다.",
          );
        });

      expect(() =>
        buildRealDataEvaluationStepArgs(makeRunPlan(), mixedActivities()),
      ).toThrow(/reference 페어링/);
    });

    it("(구조결손 회귀 모사) 가드 TypeError throw 전파", () => {
      jest
        .spyOn(
          consistency,
          "assertRealDataEvaluationStepArgsConsistentWithSources",
        )
        .mockImplementation(() => {
          throw new TypeError(
            "runPlan.pipeline 이 object 가 아니다 — modelId 재유도를 진행할 수 없다.",
          );
        });

      expect(() =>
        buildRealDataEvaluationStepArgs(makeRunPlan(), mixedActivities()),
      ).toThrow(TypeError);
    });

    it("(negative 빈 modelId) 위임 callArgs guard throw 입력에서는 가드 진입 전 위임 throw 가 전파(가드 미호출)", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataEvaluationStepArgsConsistentWithSources",
      );

      expect(() =>
        buildRealDataEvaluationStepArgs(makeRunPlan(""), mixedActivities()),
      ).toThrow(/modelId/);
      // 위임 callArgs guard 단계에서 throw → 가드 self-assert 까지 도달하지 못함.
      expect(spy).not.toHaveBeenCalled();
    });

    it("(negative 공백-only modelId) 위임 callArgs guard throw 전파(가드 미호출)", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataEvaluationStepArgsConsistentWithSources",
      );

      expect(() =>
        buildRealDataEvaluationStepArgs(makeRunPlan("   "), mixedActivities()),
      ).toThrow(/modelId/);
      expect(spy).not.toHaveBeenCalled();
    });

    it("self-wire 배선 후에도 입력 비변형 + 동일 입력 두 번 deterministic + 반환 plan 무공유", () => {
      const runPlan = makeRunPlan();
      const activities = mixedActivities();
      const runPlanSnapshot = JSON.stringify(runPlan);
      const activitiesSnapshot = JSON.stringify(activities);

      const a = buildRealDataEvaluationStepArgs(runPlan, activities);
      const b = buildRealDataEvaluationStepArgs(runPlan, activities);

      // 비변형(runPlan/activities mutate 0).
      expect(JSON.stringify(runPlan)).toBe(runPlanSnapshot);
      expect(JSON.stringify(activities)).toBe(activitiesSnapshot);
      // deterministic byte-identical.
      expect(a).toEqual(b);
      // 무공유(반환 plan 의 inputs/callArgs 트리가 호출마다 새 객체).
      expect(a.inputs).not.toBe(b.inputs);
      expect(a.callArgs).not.toBe(b.callArgs);
    });
  });
});
