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

import { buildRealDataEvaluationInputs } from "./realdata-e2e-evaluation-inputs";
import { buildRealDataEvaluationPlan } from "./realdata-e2e-evaluation-plan";

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
});
