// realdata-e2e-scoring-call-args-consistency.spec.ts — T-0691 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: 빈 inputs / 단일 / 다수 input 정합 callArgs → void(throw 0).
//   - error path(TypeError): callArgs null/undefined/비-배열, inputs null/비-배열,
//     callArgs 원소 객체 아님, options 객체 아님 각 1+.
//   - flow/branch: 구조(TypeError) vs 값 정합(RangeError) vs modelId 빈-가드 분리 + 원소
//     내 fail-fast 순서(input → modelId → options 잉여 키) 검증.
//   - negative 충분 cover(Acceptance ①~⑤): 길이 짧음/김 · input reference drift(같은
//     모양 새 객체 + 다른 index reference 뒤섞임) · modelId 정책 위반 · options 잉여
//     키 · modelId 빈/공백 각 1+. 메시지에 어긋난 index/필드/길이 포함 검증.
import type {
  ConfluenceActivity,
  GithubActivity,
} from "../../src/assessment-collection/domain/activity";
import type { EvaluationInput } from "../../src/assessment-evaluation/domain/evaluation-input";

import { buildRealDataEvaluationInputs } from "./realdata-e2e-evaluation-inputs";
import {
  buildRealDataScoringCallArgs,
  type RealDataScoringCallArgs,
} from "./realdata-e2e-scoring-call-args";
import { assertRealDataScoringCallArgsConsistentWithInputs } from "./realdata-e2e-scoring-call-args-consistency";

const MODEL_ID = "qwen2.5-coder:32b";

// fixtures — github commit/pr/issue + confluence page 4종 다양성(T-0579 spec 동형).
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

function mixedInputs(): EvaluationInput[] {
  return buildRealDataEvaluationInputs([COMMIT, PR, ISSUE, PAGE]);
}

function singleInputs(): EvaluationInput[] {
  return buildRealDataEvaluationInputs([COMMIT]);
}

// buildConsistent — leaf 컴포저로 정합 callArgs 합성(happy-path source). negative 는
// 그 산출을 의도적으로 변형한다.
function buildConsistent(
  inputs: EvaluationInput[],
  modelId: string = MODEL_ID,
): RealDataScoringCallArgs[] {
  return buildRealDataScoringCallArgs(inputs, modelId);
}

describe("assertRealDataScoringCallArgsConsistentWithInputs", () => {
  describe("happy path (정합 → void)", () => {
    it("빈 inputs/callArgs → void", () => {
      expect(() =>
        assertRealDataScoringCallArgsConsistentWithInputs([], [], MODEL_ID),
      ).not.toThrow();
    });

    it("단일 input 정합 → void", () => {
      const inputs = singleInputs();
      expect(() =>
        assertRealDataScoringCallArgsConsistentWithInputs(
          buildConsistent(inputs),
          inputs,
          MODEL_ID,
        ),
      ).not.toThrow();
    });

    it("다수 input(commit/pr/issue/page) 정합 → void(반환값 undefined)", () => {
      const inputs = mixedInputs();
      expect(
        assertRealDataScoringCallArgsConsistentWithInputs(
          buildConsistent(inputs),
          inputs,
          MODEL_ID,
        ),
      ).toBeUndefined();
    });
  });

  describe("error path — 구조 결손(TypeError)", () => {
    it("callArgs=null → TypeError('null' 라벨)", () => {
      expect(() =>
        assertRealDataScoringCallArgsConsistentWithInputs(
          null as unknown as RealDataScoringCallArgs[],
          mixedInputs(),
          MODEL_ID,
        ),
      ).toThrow(/callArgs 가 배열이 아니다.*null/);
    });

    it("callArgs=undefined → TypeError", () => {
      expect(() =>
        assertRealDataScoringCallArgsConsistentWithInputs(
          undefined as unknown as RealDataScoringCallArgs[],
          mixedInputs(),
          MODEL_ID,
        ),
      ).toThrow(TypeError);
    });

    it("callArgs 비-배열(object) → TypeError('object' 라벨)", () => {
      expect(() =>
        assertRealDataScoringCallArgsConsistentWithInputs(
          {} as unknown as RealDataScoringCallArgs[],
          mixedInputs(),
          MODEL_ID,
        ),
      ).toThrow(/callArgs 가 배열이 아니다.*object/);
    });

    it("inputs=null → TypeError", () => {
      const inputs = mixedInputs();
      expect(() =>
        assertRealDataScoringCallArgsConsistentWithInputs(
          buildConsistent(inputs),
          null as unknown as EvaluationInput[],
          MODEL_ID,
        ),
      ).toThrow(/inputs 가 배열이 아니다.*null/);
    });

    it("inputs 비-배열(string) → TypeError", () => {
      const inputs = mixedInputs();
      expect(() =>
        assertRealDataScoringCallArgsConsistentWithInputs(
          buildConsistent(inputs),
          "nope" as unknown as EvaluationInput[],
          MODEL_ID,
        ),
      ).toThrow(/inputs 가 배열이 아니다.*string/);
    });

    it("callArgs 원소가 string → TypeError(index/타입 라벨)", () => {
      const inputs = mixedInputs();
      const tampered = buildConsistent(inputs);
      tampered[1] = "not-an-object" as unknown as RealDataScoringCallArgs;
      expect(() =>
        assertRealDataScoringCallArgsConsistentWithInputs(
          tampered,
          inputs,
          MODEL_ID,
        ),
      ).toThrow(/callArgs\[1\] 가 객체가 아니다.*string/);
    });

    it("callArgs 원소가 null → TypeError('null' 라벨)", () => {
      const inputs = mixedInputs();
      const tampered = buildConsistent(inputs);
      tampered[0] = null as unknown as RealDataScoringCallArgs;
      expect(() =>
        assertRealDataScoringCallArgsConsistentWithInputs(
          tampered,
          inputs,
          MODEL_ID,
        ),
      ).toThrow(/callArgs\[0\] 가 객체가 아니다.*null/);
    });

    it("(⑥) options=null → TypeError(options 'null' 라벨)", () => {
      const inputs = mixedInputs();
      const callArgs = buildConsistent(inputs);
      callArgs[0] = {
        input: inputs[0],
        options: null as unknown as RealDataScoringCallArgs["options"],
      };
      expect(() =>
        assertRealDataScoringCallArgsConsistentWithInputs(
          callArgs,
          inputs,
          MODEL_ID,
        ),
      ).toThrow(/callArgs\[0\]\.options 가 객체가 아니다.*null/);
    });

    it("(⑥b) options=string → TypeError(options 'string' 라벨)", () => {
      const inputs = mixedInputs();
      const callArgs = buildConsistent(inputs);
      callArgs[1] = {
        input: inputs[1],
        options: "not-options" as unknown as RealDataScoringCallArgs["options"],
      };
      expect(() =>
        assertRealDataScoringCallArgsConsistentWithInputs(
          callArgs,
          inputs,
          MODEL_ID,
        ),
      ).toThrow(/callArgs\[1\]\.options 가 객체가 아니다.*string/);
    });
  });

  describe("flow / branch — fail-fast 순서(구조 → modelId 빈가드 → 길이 → 원소 내)", () => {
    it("값 정합 위반(input drift)은 RangeError 이고 TypeError 가 아니다", () => {
      const inputs = mixedInputs();
      const tampered = buildConsistent(inputs);
      tampered[0] = { input: { ...inputs[0] }, options: { modelId: MODEL_ID } };
      expect(() =>
        assertRealDataScoringCallArgsConsistentWithInputs(
          tampered,
          inputs,
          MODEL_ID,
        ),
      ).not.toThrow(TypeError);
    });

    it("modelId 빈/공백은 길이 비교보다 먼저 throw", () => {
      // 길이 불일치 + modelId 빈 — modelId 메시지가 먼저 나와야 한다.
      const inputs = mixedInputs();
      expect(() =>
        assertRealDataScoringCallArgsConsistentWithInputs(
          buildConsistent(inputs).slice(0, 1),
          inputs,
          "",
        ),
      ).toThrow(/modelId 는 빈 문자열/);
    });

    it("길이 RangeError 가 원소 검사보다 먼저 throw", () => {
      const inputs = mixedInputs();
      const callArgs = buildConsistent(inputs).slice(0, 1);
      callArgs[0] = { input: { ...inputs[0] }, options: { modelId: MODEL_ID } };
      expect(() =>
        assertRealDataScoringCallArgsConsistentWithInputs(
          callArgs,
          inputs,
          MODEL_ID,
        ),
      ).toThrow(/길이가 inputs 와 다르다.*기대=4.*실측=1/);
    });

    it("원소 내: input → modelId → options 잉여 키 순서(input 먼저 throw)", () => {
      const inputs = mixedInputs();
      const callArgs = buildConsistent(inputs);
      callArgs[0] = {
        input: { ...inputs[0] },
        options: {
          modelId: "OTHER_MODEL",
          extra: 1,
        } as unknown as RealDataScoringCallArgs["options"],
      };
      expect(() =>
        assertRealDataScoringCallArgsConsistentWithInputs(
          callArgs,
          inputs,
          MODEL_ID,
        ),
      ).toThrow(
        /callArgs\[0\]\.input 이 inputs\[0\] 와 reference 동등하지 않다/,
      );
    });

    it("원소 내: input 정합이면 modelId 가 options 잉여 키보다 먼저 throw", () => {
      const inputs = mixedInputs();
      const callArgs = buildConsistent(inputs);
      callArgs[0] = {
        input: inputs[0],
        options: {
          modelId: "WRONG",
          extra: 1,
        } as unknown as RealDataScoringCallArgs["options"],
      };
      expect(() =>
        assertRealDataScoringCallArgsConsistentWithInputs(
          callArgs,
          inputs,
          MODEL_ID,
        ),
      ).toThrow(/callArgs\[0\]\.options\.modelId 가 주입 modelId 와 다르다/);
    });
  });

  describe("negative 충분 cover — 예외 상황 분기마다(Acceptance ①~⑤)", () => {
    it("(①a) callArgs 짧음 → RangeError(기대/실측 길이)", () => {
      const inputs = mixedInputs();
      expect(() =>
        assertRealDataScoringCallArgsConsistentWithInputs(
          buildConsistent(inputs).slice(0, 2),
          inputs,
          MODEL_ID,
        ),
      ).toThrow(/기대=4.*실측=2/);
    });

    it("(①b) callArgs 김 → RangeError(기대/실측 길이)", () => {
      const inputs = mixedInputs();
      const base = buildConsistent(inputs);
      const extra = [...base, { ...base[0] }];
      expect(() =>
        assertRealDataScoringCallArgsConsistentWithInputs(
          extra,
          inputs,
          MODEL_ID,
        ),
      ).toThrow(/기대=4.*실측=5/);
    });

    it("(②a) input reference drift(같은 모양 새 객체) → RangeError(어긋난 index)", () => {
      const inputs = mixedInputs();
      const callArgs = buildConsistent(inputs);
      callArgs[2] = {
        input: { ...inputs[2] },
        options: { modelId: MODEL_ID },
      };
      expect(() =>
        assertRealDataScoringCallArgsConsistentWithInputs(
          callArgs,
          inputs,
          MODEL_ID,
        ),
      ).toThrow(
        /callArgs\[2\]\.input 이 inputs\[2\] 와 reference 동등하지 않다/,
      );
    });

    it("(②b) input 이 inputs[j] 와 뒤섞임(다른 index reference) → RangeError", () => {
      const inputs = mixedInputs();
      const callArgs = buildConsistent(inputs);
      callArgs[0] = { input: inputs[1], options: { modelId: MODEL_ID } };
      expect(() =>
        assertRealDataScoringCallArgsConsistentWithInputs(
          callArgs,
          inputs,
          MODEL_ID,
        ),
      ).toThrow(
        /callArgs\[0\]\.input 이 inputs\[0\] 와 reference 동등하지 않다/,
      );
    });

    it("(③) modelId 다름 → RangeError(어긋난 index + 기대/실측 값)", () => {
      const inputs = mixedInputs();
      const callArgs = buildConsistent(inputs);
      callArgs[1] = {
        input: inputs[1],
        options: { modelId: "different-model" },
      };
      expect(() =>
        assertRealDataScoringCallArgsConsistentWithInputs(
          callArgs,
          inputs,
          MODEL_ID,
        ),
      ).toThrow(
        /callArgs\[1\]\.options\.modelId 가 주입 modelId 와 다르다.*기대=.*qwen2\.5-coder:32b.*실측=.*different-model/,
      );
    });

    it("(④) options 잉여 키(temperature) → RangeError(실측 키 포함)", () => {
      const inputs = mixedInputs();
      const callArgs = buildConsistent(inputs);
      callArgs[0] = {
        input: inputs[0],
        options: {
          modelId: MODEL_ID,
          temperature: 0.7,
        } as unknown as RealDataScoringCallArgs["options"],
      };
      expect(() =>
        assertRealDataScoringCallArgsConsistentWithInputs(
          callArgs,
          inputs,
          MODEL_ID,
        ),
      ).toThrow(
        /callArgs\[0\]\.options 에 \{ modelId \} 외 잉여 키가 있다.*temperature/,
      );
    });

    it("(⑤a) modelId 빈 문자열 → throw(컴포저 빈-가드 정합)", () => {
      const inputs = mixedInputs();
      expect(() =>
        assertRealDataScoringCallArgsConsistentWithInputs(
          buildConsistent(inputs),
          inputs,
          "",
        ),
      ).toThrow(/modelId 는 빈 문자열/);
    });

    it("(⑤b) modelId 공백만(탭/개행) → throw(컴포저 빈-가드 정합)", () => {
      const inputs = mixedInputs();
      expect(() =>
        assertRealDataScoringCallArgsConsistentWithInputs(
          buildConsistent(inputs),
          inputs,
          "\t\n ",
        ),
      ).toThrow(/modelId 는 빈 문자열/);
    });
  });

  describe("비변형 / 순수성 (입력 mutate 0)", () => {
    it("정합 호출이 callArgs/inputs 배열·원소를 변형하지 않는다", () => {
      const inputs = mixedInputs();
      const callArgs = buildConsistent(inputs);
      const lenBefore = callArgs.length;
      const firstCallArgsRef = callArgs[0];
      const inputsBefore = [...inputs];
      assertRealDataScoringCallArgsConsistentWithInputs(
        callArgs,
        inputs,
        MODEL_ID,
      );
      expect(callArgs).toHaveLength(lenBefore);
      expect(callArgs[0]).toBe(firstCallArgsRef);
      expect(inputs).toEqual(inputsBefore);
      expect(inputs[0]).toBe(inputsBefore[0]);
    });
  });
});
