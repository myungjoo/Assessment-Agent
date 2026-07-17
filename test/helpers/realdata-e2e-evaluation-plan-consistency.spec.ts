// realdata-e2e-evaluation-plan-consistency.spec.ts — T-0681 colocated unit spec for
// `assertRealDataEvaluationPlanConsistentWithSources`(종단 evaluation-plan-seam
// consistency 가드).
//
// R-112 cover 구조:
//   - happy-path: 정상 (activities, modelId) 으로 컴포저(`buildRealDataEvaluationPlan`)가
//     산출한 plan 을 가드에 넘기면 throw 0(void) — round-trip 정합. 빈 activities / 단일·
//     다수 Activity 분기 각각 happy 검증.
//   - error/negative 충분 cover (TypeError): plan null·undefined / plan 비-object /
//     inputs·callArgs 비-배열 / activities 비-배열 / modelId 비-string → 각 분기별
//     TypeError(필드별·결손별 분기마다).
//   - error/negative 충분 cover (RangeError): inputs drift / callArgs drift / reference
//     페어링 깨짐 → 각 RangeError + 메시지에 해당 구성요소(inputs/callArgs/reference)
//     식별자 포함.
//   - flow/branch: ① 정합 → void ② inputs drift → RangeError ③ callArgs drift →
//     RangeError ④ reference 페어링 깨짐 → RangeError ⑤ 구조 결손 → TypeError ⑥ 재유도
//     위임 throw(modelId 빈/공백)가 가드를 삼키지 않고 그대로 전파 — 각 1+ test.
//   - 결정성: 동일 (plan, activities, modelId) 2 회 호출 → 둘 다 동일 동작.
//   - 입력 비변형: 가드 호출 후 plan / activities 객체 변경 0.
import type {
  Activity,
  ConfluenceActivity,
  GithubActivity,
} from "../../src/assessment-collection/domain/activity";

// 재유도 위임(delegate) 순서-lock(T-1055) — guard 재유도가 재호출하는 두 builder 를
// module namespace 로 import 해 `jest.spyOn` 대상 프로퍼티로 삼는다(ts-jest 가 named
// import 소비를 module 객체 프로퍼티 접근으로 컴파일 — 선례 T-1046/T-1052/T-1054).
import * as evaluationInputsModule from "./realdata-e2e-evaluation-inputs";
import { buildRealDataEvaluationPlan } from "./realdata-e2e-evaluation-plan";
import type { RealDataEvaluationPlan } from "./realdata-e2e-evaluation-plan";
import { assertRealDataEvaluationPlanConsistentWithSources } from "./realdata-e2e-evaluation-plan-consistency";
import * as scoringCallArgsModule from "./realdata-e2e-scoring-call-args";

const MODEL_ID = "qwen2.5-coder:32b";

// fixtures — github commit/pr/issue + confluence page 를 섞은 Activity[](다양성 승계,
// evaluation-plan.spec 와 동형). 함수로 매 test fresh 입력(무공유 검증 격리).
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

function mixedActivities(): Activity[] {
  return [COMMIT, PR, ISSUE, PAGE];
}

describe("assertRealDataEvaluationPlanConsistentWithSources", () => {
  describe("happy-path (정합 plan → void)", () => {
    it("다수 Activity 컴포저 산출 plan 을 그대로 넘기면 throw 0(void)", () => {
      const activities = mixedActivities();
      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);
      expect(() =>
        assertRealDataEvaluationPlanConsistentWithSources(
          plan,
          activities,
          MODEL_ID,
        ),
      ).not.toThrow();
    });

    it("정합 plan 이면 void(undefined) 를 반환한다", () => {
      const activities = mixedActivities();
      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);
      expect(
        assertRealDataEvaluationPlanConsistentWithSources(
          plan,
          activities,
          MODEL_ID,
        ),
      ).toBeUndefined();
    });

    it("빈 activities + 유효 modelId 경계 분기도 round-trip 정합(void)", () => {
      const activities: Activity[] = [];
      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);
      expect(plan.inputs).toHaveLength(0);
      expect(plan.callArgs).toHaveLength(0);
      expect(() =>
        assertRealDataEvaluationPlanConsistentWithSources(
          plan,
          activities,
          MODEL_ID,
        ),
      ).not.toThrow();
    });

    it("단일 Activity 분기도 round-trip 정합(void)", () => {
      const activities = [COMMIT];
      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);
      expect(() =>
        assertRealDataEvaluationPlanConsistentWithSources(
          plan,
          activities,
          MODEL_ID,
        ),
      ).not.toThrow();
    });

    it("다른 유효 modelId 조합도 round-trip 정합(void)", () => {
      const activities = mixedActivities();
      const modelId = "llama3.1:8b";
      const plan = buildRealDataEvaluationPlan(activities, modelId);
      expect(() =>
        assertRealDataEvaluationPlanConsistentWithSources(
          plan,
          activities,
          modelId,
        ),
      ).not.toThrow();
    });
  });

  describe("값 정합 위반 — inputs drift → RangeError (negative (4))", () => {
    it("inputs 원소 변형 → RangeError(inputs 노출)", () => {
      const activities = mixedActivities();
      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);
      const corrupted: RealDataEvaluationPlan = {
        ...plan,
        inputs: [
          { ...plan.inputs[0], unitId: "tampered:unit:id" },
          ...plan.inputs.slice(1),
        ],
      };
      expect(() =>
        assertRealDataEvaluationPlanConsistentWithSources(
          corrupted,
          activities,
          MODEL_ID,
        ),
      ).toThrow(RangeError);
      expect(() =>
        assertRealDataEvaluationPlanConsistentWithSources(
          corrupted,
          activities,
          MODEL_ID,
        ),
      ).toThrow(/plan\.inputs.*byte-identical/s);
    });

    it("inputs 길이 불일치(원소 누락) → RangeError(inputs 노출)", () => {
      const activities = mixedActivities();
      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);
      const corrupted: RealDataEvaluationPlan = {
        ...plan,
        inputs: plan.inputs.slice(0, -1),
      };
      expect(() =>
        assertRealDataEvaluationPlanConsistentWithSources(
          corrupted,
          activities,
          MODEL_ID,
        ),
      ).toThrow(/plan\.inputs.*byte-identical/s);
    });

    it("inputs 순서 뒤바꿈 → RangeError(원소·순서까지 deep-equal 강제)", () => {
      const activities = mixedActivities();
      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);
      expect(plan.inputs.length).toBeGreaterThanOrEqual(2);
      const reordered = [...plan.inputs].reverse();
      // callArgs 도 같은 순서로 뒤집어 callArgs deep-equal 은 통과하지 않게 — inputs 검사가
      // 먼저 throw 하는지 확인(corrupted callArgs 는 plan 그대로라 inputs 만 drift).
      const corrupted: RealDataEvaluationPlan = {
        ...plan,
        inputs: reordered,
      };
      expect(() =>
        assertRealDataEvaluationPlanConsistentWithSources(
          corrupted,
          activities,
          MODEL_ID,
        ),
      ).toThrow(/plan\.inputs/);
    });
  });

  describe("값 정합 위반 — callArgs drift → RangeError (negative (5))", () => {
    it("callArgs 원소 변형(options.modelId 변경) → RangeError(callArgs 노출)", () => {
      const activities = mixedActivities();
      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);
      const corrupted: RealDataEvaluationPlan = {
        ...plan,
        callArgs: [
          {
            input: plan.inputs[0],
            options: { modelId: "다른-모델:7b" },
          },
          ...plan.callArgs.slice(1),
        ],
      };
      expect(() =>
        assertRealDataEvaluationPlanConsistentWithSources(
          corrupted,
          activities,
          MODEL_ID,
        ),
      ).toThrow(/plan\.callArgs.*byte-identical/s);
    });

    it("callArgs 길이 불일치(원소 누락) → RangeError(callArgs 노출)", () => {
      const activities = mixedActivities();
      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);
      const corrupted: RealDataEvaluationPlan = {
        ...plan,
        callArgs: plan.callArgs.slice(0, -1),
      };
      expect(() =>
        assertRealDataEvaluationPlanConsistentWithSources(
          corrupted,
          activities,
          MODEL_ID,
        ),
      ).toThrow(/plan\.callArgs.*byte-identical/s);
    });

    it("inputs 검사가 callArgs 검사보다 먼저 — 둘 다 손상 시 inputs RangeError", () => {
      const activities = mixedActivities();
      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);
      const corrupted: RealDataEvaluationPlan = {
        inputs: [
          { ...plan.inputs[0], unitId: "tampered:unit:id" },
          ...plan.inputs.slice(1),
        ],
        callArgs: plan.callArgs.slice(0, -1),
      };
      expect(() =>
        assertRealDataEvaluationPlanConsistentWithSources(
          corrupted,
          activities,
          MODEL_ID,
        ),
      ).toThrow(/plan\.inputs/);
    });
  });

  describe("값 정합 위반 — reference 페어링 깨짐 → RangeError (negative (6))", () => {
    it("callArgs[i].input 을 동일 값 새 객체로 교체 → RangeError(reference 노출)", () => {
      const activities = mixedActivities();
      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);
      // deep-equal 은 통과하나(동일 값) reference 만 다른 새 객체 — identity 검사가 잡아야 함.
      const corrupted: RealDataEvaluationPlan = {
        ...plan,
        callArgs: [
          { input: { ...plan.inputs[0] }, options: plan.callArgs[0].options },
          ...plan.callArgs.slice(1),
        ],
      };
      expect(() =>
        assertRealDataEvaluationPlanConsistentWithSources(
          corrupted,
          activities,
          MODEL_ID,
        ),
      ).toThrow(RangeError);
      expect(() =>
        assertRealDataEvaluationPlanConsistentWithSources(
          corrupted,
          activities,
          MODEL_ID,
        ),
      ).toThrow(/reference 페어링/);
    });
  });

  describe("구조 결손 — null/undefined → TypeError (negative (1) fail-fast)", () => {
    it("plan null → TypeError", () => {
      expect(() =>
        assertRealDataEvaluationPlanConsistentWithSources(
          null as unknown as RealDataEvaluationPlan,
          mixedActivities(),
          MODEL_ID,
        ),
      ).toThrow(/plan 이 null\/undefined/);
    });

    it("plan undefined → TypeError", () => {
      expect(() =>
        assertRealDataEvaluationPlanConsistentWithSources(
          undefined as unknown as RealDataEvaluationPlan,
          mixedActivities(),
          MODEL_ID,
        ),
      ).toThrow(TypeError);
    });

    it("plan 비-object(배열) → TypeError(타입 라벨 array)", () => {
      expect(() =>
        assertRealDataEvaluationPlanConsistentWithSources(
          [] as unknown as RealDataEvaluationPlan,
          mixedActivities(),
          MODEL_ID,
        ),
      ).toThrow(/plan 이 객체가 아니다\(타입: array\)/);
    });
  });

  describe("구성요소 type 위반 → TypeError", () => {
    it("plan.inputs 비-배열(object) → TypeError", () => {
      const corrupted = {
        inputs: {},
        callArgs: [],
      } as unknown as RealDataEvaluationPlan;
      expect(() =>
        assertRealDataEvaluationPlanConsistentWithSources(
          corrupted,
          mixedActivities(),
          MODEL_ID,
        ),
      ).toThrow(/plan\.inputs 가 배열이 아니다/);
    });

    it("plan.callArgs 비-배열(null) → TypeError", () => {
      const corrupted = {
        inputs: [],
        callArgs: null,
      } as unknown as RealDataEvaluationPlan;
      expect(() =>
        assertRealDataEvaluationPlanConsistentWithSources(
          corrupted,
          mixedActivities(),
          MODEL_ID,
        ),
      ).toThrow(/plan\.callArgs 가 배열이 아니다/);
    });

    it("activities 비-배열(object) → TypeError(타입 라벨 노출) (negative (2))", () => {
      const activities = mixedActivities();
      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);
      expect(() =>
        assertRealDataEvaluationPlanConsistentWithSources(
          plan,
          {} as unknown as Activity[],
          MODEL_ID,
        ),
      ).toThrow(/activities 가 배열이 아니다\(타입: object\)/);
    });

    it("modelId 비-string(number) → TypeError(타입 라벨 노출) (negative (3))", () => {
      const activities = mixedActivities();
      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);
      expect(() =>
        assertRealDataEvaluationPlanConsistentWithSources(
          plan,
          activities,
          7 as unknown as string,
        ),
      ).toThrow(/modelId 가 문자열이 아니다\(타입: number\)/);
    });
  });

  describe("재유도 위임 throw 전파 — 가드가 삼키지 않음 (branch cover)", () => {
    it("modelId 빈 문자열 → callArgs 위임 modelId guard throw 가 전파 (negative (7))", () => {
      const activities = mixedActivities();
      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);
      // plan 구조는 온전하나 재유도 modelId 가 빈 문자열이라 callArgs 재유도가 throw.
      expect(() =>
        assertRealDataEvaluationPlanConsistentWithSources(plan, activities, ""),
      ).toThrow(/modelId 는 빈 문자열/);
    });

    it("modelId 공백-only → callArgs 위임 modelId guard throw 가 전파 (negative (8))", () => {
      const activities = mixedActivities();
      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);
      expect(() =>
        assertRealDataEvaluationPlanConsistentWithSources(
          plan,
          activities,
          "   ",
        ),
      ).toThrow(/modelId 는 빈 문자열/);
    });
  });

  describe("결정성 / 비변형", () => {
    it("동일 입력 2 회 호출 → 둘 다 동일 동작(정합이면 둘 다 void)", () => {
      const activities = mixedActivities();
      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);
      const run = () =>
        assertRealDataEvaluationPlanConsistentWithSources(
          plan,
          activities,
          MODEL_ID,
        );
      expect(run).not.toThrow();
      expect(run).not.toThrow();
    });

    it("동일 drift plan 2 회 호출 → 둘 다 동일 구성요소에서 throw", () => {
      const activities = mixedActivities();
      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);
      const corrupted: RealDataEvaluationPlan = {
        ...plan,
        inputs: plan.inputs.slice(0, -1),
      };
      const run = () =>
        assertRealDataEvaluationPlanConsistentWithSources(
          corrupted,
          activities,
          MODEL_ID,
        );
      expect(run).toThrow(/plan\.inputs/);
      expect(run).toThrow(/plan\.inputs/);
    });

    it("가드 호출 후 plan / activities 객체 mutate 0", () => {
      const activities = mixedActivities();
      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);
      const planSnapshot = JSON.stringify(plan);
      const activitiesSnapshot = JSON.stringify(activities);
      assertRealDataEvaluationPlanConsistentWithSources(
        plan,
        activities,
        MODEL_ID,
      );
      expect(JSON.stringify(plan)).toBe(planSnapshot);
      expect(JSON.stringify(activities)).toBe(activitiesSnapshot);
    });
  });

  // T-1055 — consistency-guard 재유도 위임(delegate) 순서-lock(inputs → callArgs).
  //
  // 기존 spec 은 재유도 산출의 값 대조(deep-equal)·구조 결손 TypeError·reference 페어링
  // ·위임 throw 전파·fail-fast(inputs 검사가 callArgs 보다 먼저)만 검증하고, 재유도
  // 단계의 두 builder 위임(buildRealDataEvaluationInputs → buildRealDataScoringCallArgs)
  // 의 상대 호출 순서는 invocationCallOrder 부등식으로 못박지 않았다(grep 0). guard 본문
  // L207~221 은 inputs 재유도 산출로 deep-equal fail-fast 게이트(L211)를 먼저 통과해야
  // callArgs 재유도(L221)에 도달하는 순서-의미 chain 이라 inputs 가 반드시 먼저 평가돼야
  // 한다. T-1052(evaluation-plan 컴포저 inputs → scoring) 데이터-의존 chain 을 guard
  // 재유도 층으로 mirror 하고 T-1054(result-report-plan-consistency summary → descriptor)
  // 를 sibling consistency-guard leg 로 mirror 해 그 gap 을 봉한다.
  //
  // 주의: builder ②(callArgs)는 guard 인자 `plan.inputs` 를 source 로 쓰고 builder ①
  // 산출을 소비하지 않으므로(데이터-의존 reference 페어링 부재) 순서(invocationCallOrder)
  // ·횟수(fail-fast)만 lock 하고 reference 페어링 assert 는 하지 않는다.
  //
  // R-112 cover 구조(순서-lock):
  //   - happy-path/flow: 정합 plan 을 spy 설치 前 미리 만든 뒤(그래야 plan 합성이 spy 를
  //     오염시키지 않음) 두 builder 위임을 실 구현 pass-through spy 로 감싸고 guard 재유도
  //     1회 트리거 → inputs 첫 호출이 callArgs 첫 호출보다 먼저(invocationCallOrder
  //     toBeLessThan) + 각 정확히 1회.
  //   - branch/무공유 재확인: pass-through spy 하에서도 guard 가 정상 void 반환 + 입력
  //     plan/activities mutate 0(read-only guard).
  //   - error/negative(a fail-fast): inputs 위임 강제 throw → callArgs 위임 미도달(0회)
  //     — inputs-먼저 순서로 callArgs 도달 불가를 fail-fast 로 못박음.
  //   - error/negative(b guard-throw 전파): callArgs 위임 강제 throw → 그 에러가 전파,
  //     이때 inputs 위임은 이미 호출됨(순서 상 inputs 가 callArgs 보다 먼저 평가됨을
  //     negative 경로에서도 재확인).
  describe("T-1055 — 재유도 위임 순서-lock(inputs → callArgs)", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("정합 재유도 시 inputs 위임이 callArgs 위임보다 먼저 호출된다(invocationCallOrder 부등식·각 1회)", () => {
      const activities = mixedActivities();
      // plan 은 spy 설치 前 합성 — buildRealDataEvaluationPlan 내부도 두 builder 를
      // 호출하므로 spy 설치 후 만들면 호출 횟수가 오염된다. guard 재유도 호출만 격리 계측.
      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);
      const inputsSpy = jest.spyOn(
        evaluationInputsModule,
        "buildRealDataEvaluationInputs",
      );
      const callArgsSpy = jest.spyOn(
        scoringCallArgsModule,
        "buildRealDataScoringCallArgs",
      );

      assertRealDataEvaluationPlanConsistentWithSources(
        plan,
        activities,
        MODEL_ID,
      );

      // guard 재유도 지점 각 1개 → 각 위임 정확히 1회.
      expect(inputsSpy).toHaveBeenCalledTimes(1);
      expect(callArgsSpy).toHaveBeenCalledTimes(1);
      // 순서: inputs 위임(첫 호출)이 callArgs 위임(첫 호출)보다 먼저 호출된다.
      expect(inputsSpy.mock.invocationCallOrder[0]).toBeLessThan(
        callArgsSpy.mock.invocationCallOrder[0],
      );

      // T-1099 — 인자-충실도(argument fidelity) lock(§D 후보 2 leg2). 위 횟수·순서
      // lock 에 더해, 각 위임이 정확히 어떤 payload 로 호출됐는지를 canonical matcher
      // 로 못박는다. inputs 위임은 가드의 정확한 activities 입력 배열로, callArgs 위임은
      // (산출 inputs + 가드의 modelId) 로 호출됨을 recursive-equality 로 lock. 가드가
      // inputs 산출을 그대로 callArgs 첫 인자로 threading 함을 참조-충실도까지 포함해
      // producedInputs 를 spy 반환값으로 캡처한다. 재유도 경로는 단일 분기(happy-path)
      // 조립이라 분기 없음 → flow/branch 항목 생략.
      const producedInputs = inputsSpy.mock.results[0].value;
      expect(inputsSpy).toHaveBeenCalledWith(activities);
      expect(callArgsSpy).toHaveBeenCalledWith(producedInputs, MODEL_ID);

      // negative(인자-충실도 축 a) — payload drift 대조. toHaveBeenCalledWith 가 인자
      // payload 변조를 실제로 잡음을 노출한다. externalId 를 변조한 activities 사본·빈
      // 배열로는 inputs 매칭 안 됨, 잘못된 modelId 로는 callArgs 매칭 안 됨(값-drift
      // RangeError 대조 describe 와 별개의 인자-축 negative). 매칭됐다면 matcher 가
      // payload 를 검사하지 않는다는 뜻이므로 fail.
      const driftedActivities = [
        { ...activities[0], externalId: "drifted-id" },
        ...activities.slice(1),
      ];
      expect(inputsSpy).not.toHaveBeenCalledWith(driftedActivities);
      expect(inputsSpy).not.toHaveBeenCalledWith([]);
      expect(callArgsSpy).not.toHaveBeenCalledWith(
        producedInputs,
        "wrong-model-id",
      );

      // negative(인자-충실도 축 b) — 인자 개수/여분 인자. inputs 는 정확히 1 인자,
      // callArgs 는 정확히 2 인자로 호출됨(여분 인자 0). 셋째 인자를 요구하는 매칭은
      // 실패해야 한다.
      expect(inputsSpy.mock.calls[0]).toHaveLength(1);
      expect(callArgsSpy.mock.calls[0]).toHaveLength(2);
      expect(callArgsSpy).not.toHaveBeenCalledWith(
        producedInputs,
        MODEL_ID,
        expect.anything(),
      );
    });

    it("(branch/무공유 재확인) pass-through spy 하에서도 guard 가 void 반환 + plan/activities mutate 0", () => {
      const activities = mixedActivities();
      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);
      const planSnapshot = JSON.stringify(plan);
      const activitiesSnapshot = JSON.stringify(activities);
      jest.spyOn(evaluationInputsModule, "buildRealDataEvaluationInputs");
      jest.spyOn(scoringCallArgsModule, "buildRealDataScoringCallArgs");

      // 정합 경로 → 정상 void(throw 0).
      expect(
        assertRealDataEvaluationPlanConsistentWithSources(
          plan,
          activities,
          MODEL_ID,
        ),
      ).toBeUndefined();
      // read-only guard — 입력 mutate 0.
      expect(JSON.stringify(plan)).toBe(planSnapshot);
      expect(JSON.stringify(activities)).toBe(activitiesSnapshot);
    });

    it("(a fail-fast) inputs 위임이 throw 하면 callArgs 위임에 도달하지 못한다(callArgs 0회)", () => {
      const activities = mixedActivities();
      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);
      jest
        .spyOn(evaluationInputsModule, "buildRealDataEvaluationInputs")
        .mockImplementation(() => {
          throw new Error("inputs-boom");
        });
      const callArgsSpy = jest.spyOn(
        scoringCallArgsModule,
        "buildRealDataScoringCallArgs",
      );

      expect(() =>
        assertRealDataEvaluationPlanConsistentWithSources(
          plan,
          activities,
          MODEL_ID,
        ),
      ).toThrow(/inputs-boom/);

      // inputs-먼저 순서로 인해 inputs throw 가 callArgs 도달(deep-equal 게이트) 전에
      // 선전파 → callArgs 미호출.
      expect(callArgsSpy).toHaveBeenCalledTimes(0);
    });

    it("(b guard-throw 전파) callArgs 위임 throw → 그 에러 전파, 이때 inputs 위임은 이미 호출됨(1회·inputs → callArgs 순서 재확인)", () => {
      const activities = mixedActivities();
      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);
      const inputsSpy = jest.spyOn(
        evaluationInputsModule,
        "buildRealDataEvaluationInputs",
      );
      const callArgsSpy = jest
        .spyOn(scoringCallArgsModule, "buildRealDataScoringCallArgs")
        .mockImplementation(() => {
          throw new Error("callargs-boom");
        });

      // inputs 게이트는 통과(정합 plan) 후 callArgs 재유도가 throw → 그대로 전파.
      expect(() =>
        assertRealDataEvaluationPlanConsistentWithSources(
          plan,
          activities,
          MODEL_ID,
        ),
      ).toThrow(/callargs-boom/);

      // 순서 상 inputs 가 callArgs 보다 먼저 평가됨 — callArgs 재유도 throw 시점에 inputs
      // 는 이미 1회 호출됐고 callArgs 도 1회 진입(그 안에서 throw).
      expect(inputsSpy).toHaveBeenCalledTimes(1);
      expect(callArgsSpy).toHaveBeenCalledTimes(1);
      expect(inputsSpy.mock.invocationCallOrder[0]).toBeLessThan(
        callArgsSpy.mock.invocationCallOrder[0],
      );
    });
  });

  // T-1067 — 구조-검사 선행성 order-lock(구조 검사 → 값 재유도 build 위임).
  //
  // 가드 본문(L201~202)은 구조 검사(assertPlanStructure → assertSourcesStructure)를 값
  // 재유도 위임(buildRealDataEvaluationInputs L207 → buildRealDataScoringCallArgs L221)
  // 보다 먼저 수행한다. 그러나 기존 spec 의 구조 error-path 테스트(plan null/undefined/
  // 비-object · plan.inputs 비-배열 · plan.callArgs 비-배열 · activities 비-배열 · modelId
  // 비-string)는 오직 .toThrow(TypeError) 만 assert 하고, 위 T-1055 순서-lock 블록의 유일
  // toHaveBeenCalledTimes(0)(inputs throw → callArgs 0)은 값-재유도 fail-fast 만 못박아
  // "구조 위반 시 build 위임이 아예 호출되지 않는(선행 fail-fast) 선행성" 은 미검증이다.
  // 구조 결손 입력을 주면 두 build 위임 spy 가 모두 toHaveBeenCalledTimes(0) 이어야 하며,
  // 이를 못박아 "구조 검사 → 값 재유도" 순서를 silent 재정렬(리팩터가 build 를 구조 검사
  // 위로 끌어올림)로부터 방어한다(T-1066 result-report-plan leg 1 과 동형 defense-in-depth).
  //
  // R-112 cover 구조(구조-선행성):
  //   - happy: 정합 입력 → 구조 검사 통과 후 값 재유도 도달(두 build 위임 각 1회 · inputs
  //     → callArgs 순서 재확인 — 기존 ico 블록과 정합).
  //   - error/negative(핵심): 구조 결손 5분기(plan 비-객체 / plan.inputs 비-배열 /
  //     plan.callArgs 비-배열 / activities 비-배열 / modelId 비-string) 각각 TypeError +
  //     두 build 위임 spy 0-call(선행 차단). 분기마다 유형별 negative(null/undefined/배열
  //     /원시/비-배열·비-string mismatch)를 배치.
  //   - 대조(경계 명확화): 값 정합 위반(inputs drift → RangeError · callArgs drift →
  //     RangeError)은 구조 검사를 통과해 build 위임이 호출된 뒤 발생 — 구조(TypeError,
  //     build 0-call) vs 값(RangeError, build 호출됨) 경계를 선행성 관점에서 대조.
  describe("T-1067 — 구조-검사 선행성 order-lock(구조 → 값 재유도 build 미도달)", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("(happy) 정합 입력 → 구조 검사 통과 후 값 재유도 도달(두 build 위임 각 1회 · inputs → callArgs 순서)", () => {
      const activities = mixedActivities();
      // plan 은 spy 설치 前 합성 — buildRealDataEvaluationPlan 내부도 두 builder 를 호출하므로
      // spy 설치 후 만들면 호출 횟수가 오염된다(격리 계측).
      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);
      const inputsSpy = jest.spyOn(
        evaluationInputsModule,
        "buildRealDataEvaluationInputs",
      );
      const callArgsSpy = jest.spyOn(
        scoringCallArgsModule,
        "buildRealDataScoringCallArgs",
      );

      assertRealDataEvaluationPlanConsistentWithSources(
        plan,
        activities,
        MODEL_ID,
      );

      // 구조 검사 통과 → 값 재유도 도달(각 위임 정확히 1회 · inputs 먼저).
      expect(inputsSpy).toHaveBeenCalledTimes(1);
      expect(callArgsSpy).toHaveBeenCalledTimes(1);
      expect(inputsSpy.mock.invocationCallOrder[0]).toBeLessThan(
        callArgsSpy.mock.invocationCallOrder[0],
      );
    });

    it("(구조 결손 분기 1/5: plan 비-객체) plan=null/undefined/array/primitive → TypeError + 두 build 위임 미도달(0회)", () => {
      const inputsSpy = jest.spyOn(
        evaluationInputsModule,
        "buildRealDataEvaluationInputs",
      );
      const callArgsSpy = jest.spyOn(
        scoringCallArgsModule,
        "buildRealDataScoringCallArgs",
      );
      for (const badPlan of [null, undefined, [], "not-a-plan", 7]) {
        expect(() =>
          assertRealDataEvaluationPlanConsistentWithSources(
            badPlan as unknown as RealDataEvaluationPlan,
            mixedActivities(),
            MODEL_ID,
          ),
        ).toThrow(TypeError);
      }
      // 구조 검사(assertPlanStructure)가 값 재유도보다 먼저 fail-fast → build 미도달.
      expect(inputsSpy).toHaveBeenCalledTimes(0);
      expect(callArgsSpy).toHaveBeenCalledTimes(0);
    });

    it("(구조 결손 분기 2/5: plan.inputs 비-배열) inputs=null/undefined/object/primitive → TypeError + build 미도달(0회)", () => {
      const inputsSpy = jest.spyOn(
        evaluationInputsModule,
        "buildRealDataEvaluationInputs",
      );
      const callArgsSpy = jest.spyOn(
        scoringCallArgsModule,
        "buildRealDataScoringCallArgs",
      );
      // plan.callArgs 는 배열(정합)로 두고 inputs 만 비-배열 — assertPlanStructure 의
      // inputs 분기가 fail-fast 하는지 격리.
      for (const badInputs of [null, undefined, {}, "x", 3]) {
        const plan = {
          inputs: badInputs,
          callArgs: [],
        } as unknown as RealDataEvaluationPlan;
        expect(() =>
          assertRealDataEvaluationPlanConsistentWithSources(
            plan,
            mixedActivities(),
            MODEL_ID,
          ),
        ).toThrow(/plan\.inputs 가 배열이 아니다/);
      }
      expect(inputsSpy).toHaveBeenCalledTimes(0);
      expect(callArgsSpy).toHaveBeenCalledTimes(0);
    });

    it("(구조 결손 분기 3/5: plan.callArgs 비-배열) callArgs=null/undefined/object/primitive → TypeError + build 미도달(0회)", () => {
      const inputsSpy = jest.spyOn(
        evaluationInputsModule,
        "buildRealDataEvaluationInputs",
      );
      const callArgsSpy = jest.spyOn(
        scoringCallArgsModule,
        "buildRealDataScoringCallArgs",
      );
      // plan.inputs 는 배열(정합)로 두고 callArgs 만 비-배열 — assertPlanStructure 의
      // callArgs 분기가 fail-fast 하는지 격리.
      for (const badCallArgs of [null, undefined, {}, "x", 3]) {
        const plan = {
          inputs: [],
          callArgs: badCallArgs,
        } as unknown as RealDataEvaluationPlan;
        expect(() =>
          assertRealDataEvaluationPlanConsistentWithSources(
            plan,
            mixedActivities(),
            MODEL_ID,
          ),
        ).toThrow(/plan\.callArgs 가 배열이 아니다/);
      }
      expect(inputsSpy).toHaveBeenCalledTimes(0);
      expect(callArgsSpy).toHaveBeenCalledTimes(0);
    });

    it("(구조 결손 분기 4/5: activities 비-배열) activities=null/undefined/object/primitive → TypeError + build 미도달(0회)", () => {
      // plan 은 구조 정합(inputs/callArgs 배열)으로 두고 activities 만 비-배열 —
      // assertSourcesStructure 의 activities 분기가 값 재유도 전에 fail-fast 하는지 격리.
      const plan = {
        inputs: [],
        callArgs: [],
      } as unknown as RealDataEvaluationPlan;
      const inputsSpy = jest.spyOn(
        evaluationInputsModule,
        "buildRealDataEvaluationInputs",
      );
      const callArgsSpy = jest.spyOn(
        scoringCallArgsModule,
        "buildRealDataScoringCallArgs",
      );
      for (const badActivities of [null, undefined, {}, "x", 3]) {
        expect(() =>
          assertRealDataEvaluationPlanConsistentWithSources(
            plan,
            badActivities as unknown as Activity[],
            MODEL_ID,
          ),
        ).toThrow(/activities 가 배열이 아니다/);
      }
      expect(inputsSpy).toHaveBeenCalledTimes(0);
      expect(callArgsSpy).toHaveBeenCalledTimes(0);
    });

    it("(구조 결손 분기 5/5: modelId 비-string) modelId=null/undefined/array/object/number → TypeError + build 미도달(0회)", () => {
      // plan · activities 는 구조 정합으로 두고 modelId 만 비-string —
      // assertSourcesStructure 의 modelId 분기가 값 재유도 전에 fail-fast 하는지 격리.
      const plan = {
        inputs: [],
        callArgs: [],
      } as unknown as RealDataEvaluationPlan;
      const inputsSpy = jest.spyOn(
        evaluationInputsModule,
        "buildRealDataEvaluationInputs",
      );
      const callArgsSpy = jest.spyOn(
        scoringCallArgsModule,
        "buildRealDataScoringCallArgs",
      );
      for (const badModelId of [null, undefined, [], {}, 7]) {
        expect(() =>
          assertRealDataEvaluationPlanConsistentWithSources(
            plan,
            [],
            badModelId as unknown as string,
          ),
        ).toThrow(/modelId 가 문자열이 아니다/);
      }
      expect(inputsSpy).toHaveBeenCalledTimes(0);
      expect(callArgsSpy).toHaveBeenCalledTimes(0);
    });

    it("(대조 a) 값 정합 위반(inputs drift → RangeError)은 구조 검사 통과 후 inputs build 위임 호출된 뒤 발생(inputs 1+ call)", () => {
      const activities = mixedActivities();
      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);
      const inputsSpy = jest.spyOn(
        evaluationInputsModule,
        "buildRealDataEvaluationInputs",
      );
      const callArgsSpy = jest.spyOn(
        scoringCallArgsModule,
        "buildRealDataScoringCallArgs",
      );
      // 구조는 온전(inputs/callArgs 배열) — inputs 값만 drift 시켜 RangeError.
      const corrupted: RealDataEvaluationPlan = {
        ...plan,
        inputs: [
          { ...plan.inputs[0], unitId: "tampered:unit:id" },
          ...plan.inputs.slice(1),
        ],
      };

      expect(() =>
        assertRealDataEvaluationPlanConsistentWithSources(
          corrupted,
          activities,
          MODEL_ID,
        ),
      ).toThrow(RangeError);

      // 구조 검사를 통과했으므로 inputs 재유도(build 위임)가 이미 호출된 뒤 값 대조에서
      // throw — 구조(TypeError, build 0-call) 와 대비되는 경계. inputs drift 는 inputs
      // 게이트에서 fail-fast 하므로 callArgs 위임은 미도달(0회).
      // 가드 1-invoke × inputs 위임 1-재유도 = exact 1 — loose 대신 정확 횟수로 못박아
      // 값 대조 과정에서 inputs 를 중복 재유도(build ≥ 2회/invoke)하는 회귀를 차단.
      expect(inputsSpy).toHaveBeenCalledTimes(1);
      expect(callArgsSpy).toHaveBeenCalledTimes(0);
    });

    it("(대조 b) 값 정합 위반(callArgs drift → RangeError)은 구조 통과 후 두 build 위임 호출된 뒤 발생(inputs·callArgs 각 1+ call)", () => {
      const activities = mixedActivities();
      const plan = buildRealDataEvaluationPlan(activities, MODEL_ID);
      const inputsSpy = jest.spyOn(
        evaluationInputsModule,
        "buildRealDataEvaluationInputs",
      );
      const callArgsSpy = jest.spyOn(
        scoringCallArgsModule,
        "buildRealDataScoringCallArgs",
      );
      // inputs 는 정합(게이트 통과) · callArgs 값만 drift → callArgs 게이트에서 RangeError.
      const corrupted: RealDataEvaluationPlan = {
        ...plan,
        callArgs: [
          { input: plan.inputs[0], options: { modelId: "다른-모델:7b" } },
          ...plan.callArgs.slice(1),
        ],
      };

      expect(() =>
        assertRealDataEvaluationPlanConsistentWithSources(
          corrupted,
          activities,
          MODEL_ID,
        ),
      ).toThrow(RangeError);

      // inputs 게이트 통과 후 callArgs 재유도까지 도달 — 두 build 위임 모두 호출됨.
      // 가드 1-invoke × 각 위임 1-재유도 = 각 exact 1 — loose 대신 정확 횟수로 못박아
      // 어느 한 위임을 중복 재유도(build ≥ 2회/invoke)하는 회귀를 차단.
      expect(inputsSpy).toHaveBeenCalledTimes(1);
      expect(callArgsSpy).toHaveBeenCalledTimes(1);
    });
  });
});
