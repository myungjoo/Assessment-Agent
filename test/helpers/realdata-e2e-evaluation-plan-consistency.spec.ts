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

import { buildRealDataEvaluationPlan } from "./realdata-e2e-evaluation-plan";
import type { RealDataEvaluationPlan } from "./realdata-e2e-evaluation-plan";
import { assertRealDataEvaluationPlanConsistentWithSources } from "./realdata-e2e-evaluation-plan-consistency";

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
});
