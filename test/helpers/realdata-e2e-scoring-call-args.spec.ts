// realdata-e2e-scoring-call-args.spec.ts — T-0579 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: github(commit/pr/issue) + confluence 를 섞은 EvaluationInput[]
//     입력에 대해 각 원소가 { input: <원소 그대로>, options: { modelId } } 로 변환되고
//     순서·길이가 보존됨을 검증. EvaluationInput[] fixture 는 직전 slice helper
//     `buildRealDataEvaluationInputs` 로 결정론적 생성(수집 Activity[] 다양성 그대로 승계).
//   - flow/branch: inputs 비어있음 / 단일 / 다수 분기 + modelId guard 분기(유효 / 빈 /
//     공백)가 전부 cover. 본 helper 자체의 추가 분기는 modelId guard 1 개 외 없음
//     (배열 매핑만) — 위임된 매핑 분기는 입력 다양성으로 cover.
//   - error/negative 충분 cover: 빈 입력 배열(→ []), 단일 원소 배열, modelId 빈 문자열
//     throw, modelId 공백만 throw 각 1+ test(단일 negative 만으로 부족 — guard 분기마다 cover).
//   - 무공유/순수성: 입력 배열·원소·modelId 참조 불변 + 매 호출 새 배열 + 매 원소 새
//     options 객체 + 무공유 회귀(반환 options mutate 후 재호출 결과 불변 + reference 상이).
import type {
  ConfluenceActivity,
  GithubActivity,
} from "../../src/assessment-collection/domain/activity";
import type { EvaluationInput } from "../../src/assessment-evaluation/domain/evaluation-input";

import { buildRealDataEvaluationInputs } from "./realdata-e2e-evaluation-inputs";
import { buildRealDataScoringCallArgs } from "./realdata-e2e-scoring-call-args";
import * as consistency from "./realdata-e2e-scoring-call-args-consistency";

const MODEL_ID = "qwen2.5-coder:32b";

// fixtures — github commit/pr/issue + confluence page 를 섞은 Activity[] 를 직전 slice
// 매퍼로 EvaluationInput[] 로 변환해 입력으로 쓴다(다양성 승계, 매핑 복제 0).
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

// 혼합 EvaluationInput[] fixture 생성(매 test 가 fresh 입력을 받도록 함수로).
function mixedInputs(): EvaluationInput[] {
  return buildRealDataEvaluationInputs([COMMIT, PR, ISSUE, PAGE]);
}

describe("buildRealDataScoringCallArgs", () => {
  describe("happy path (정상 호출-args 산출)", () => {
    it("혼합 EvaluationInput[] → { input: <원소 그대로>, options: { modelId } } 정확 산출", () => {
      const inputs = mixedInputs();
      const result = buildRealDataScoringCallArgs(inputs, MODEL_ID);
      expect(result).toEqual(
        inputs.map((input) => ({ input, options: { modelId: MODEL_ID } })),
      );
    });

    it("입력 원소를 reference 그대로 페어링한다 (EvaluationInput 복제 0)", () => {
      const inputs = mixedInputs();
      const result = buildRealDataScoringCallArgs(inputs, MODEL_ID);
      result.forEach((args, i) => {
        expect(args.input).toBe(inputs[i]);
      });
    });

    it("입력 순서·길이를 보존한다", () => {
      const inputs = mixedInputs();
      const result = buildRealDataScoringCallArgs(inputs, MODEL_ID);
      expect(result).toHaveLength(inputs.length);
      expect(result.map((a) => a.input.unitId)).toEqual([
        "github:com:abc123",
        "github:com:42",
        "github:sec:7",
        "confluence:ENG:page-99",
      ]);
    });

    it("모든 args 의 options.modelId 가 전달값과 동일하다 (단일 modelId 동형 적용)", () => {
      const result = buildRealDataScoringCallArgs(mixedInputs(), MODEL_ID);
      for (const args of result) {
        expect(args.options).toEqual({ modelId: MODEL_ID });
      }
    });
  });

  describe("flow / branch (분기 cover)", () => {
    it("(분기 빈 입력) 빈 배열 입력 → 빈 배열 반환 (throw 0, modelId 유효)", () => {
      expect(() => buildRealDataScoringCallArgs([], MODEL_ID)).not.toThrow();
      expect(buildRealDataScoringCallArgs([], MODEL_ID)).toEqual([]);
    });

    it("(분기 단일 원소) 단일 EvaluationInput → 단일 호출-args", () => {
      const inputs = buildRealDataEvaluationInputs([COMMIT]);
      const result = buildRealDataScoringCallArgs(inputs, MODEL_ID);
      expect(result).toEqual([
        { input: inputs[0], options: { modelId: MODEL_ID } },
      ]);
    });

    it("(분기 다수 원소) 다수 EvaluationInput → 동일 길이 호출-args", () => {
      const inputs = mixedInputs();
      expect(buildRealDataScoringCallArgs(inputs, MODEL_ID)).toHaveLength(4);
    });

    it("(분기 modelId 유효) 공백 포함 비-공백 modelId 는 통과한다", () => {
      const result = buildRealDataScoringCallArgs(mixedInputs(), "  llama3  ");
      expect(result[0].options.modelId).toBe("  llama3  ");
    });
  });

  describe("error / negative cases (modelId guard 충분 cover)", () => {
    it("(modelId 빈 문자열) 명시적 throw", () => {
      expect(() => buildRealDataScoringCallArgs(mixedInputs(), "")).toThrow(
        /modelId/,
      );
    });

    it("(modelId 공백만) 명시적 throw", () => {
      expect(() => buildRealDataScoringCallArgs(mixedInputs(), "   ")).toThrow(
        /modelId/,
      );
    });

    it("(modelId 탭/개행 공백만) 명시적 throw", () => {
      expect(() =>
        buildRealDataScoringCallArgs(mixedInputs(), "\t\n "),
      ).toThrow(/modelId/);
    });

    it("(빈 입력이어도 modelId 빈 문자열) guard 가 우선 throw 한다", () => {
      expect(() => buildRealDataScoringCallArgs([], "")).toThrow(/modelId/);
    });
  });

  describe("순수성 / 무공유 (negative — mutation 격리)", () => {
    it("입력 inputs 배열·원소·modelId 를 mutate 하지 않는다", () => {
      const inputs = mixedInputs();
      const snapshot = JSON.stringify(inputs);
      buildRealDataScoringCallArgs(inputs, MODEL_ID);
      expect(JSON.stringify(inputs)).toBe(snapshot);
      expect(inputs).toHaveLength(4);
    });

    it("반환 options 를 mutate 해도 입력·다음 호출이 오염되지 않는다", () => {
      const inputs = mixedInputs();
      const first = buildRealDataScoringCallArgs(inputs, MODEL_ID);
      first[0].options.modelId = "TAMPERED";
      const second = buildRealDataScoringCallArgs(inputs, MODEL_ID);
      expect(second[0].options.modelId).toBe(MODEL_ID);
    });

    it("(무공유 회귀) 두 호출의 반환 배열·options reference 가 서로 다르다", () => {
      const inputs = mixedInputs();
      const a = buildRealDataScoringCallArgs(inputs, MODEL_ID);
      const b = buildRealDataScoringCallArgs(inputs, MODEL_ID);
      expect(a).not.toBe(b);
      expect(a[0]).not.toBe(b[0]);
      expect(a[0].options).not.toBe(b[0].options);
    });

    it("매 호출이 새 배열을 반환한다 (공유 mutable 노출 0)", () => {
      const inputs = mixedInputs();
      const result = buildRealDataScoringCallArgs(inputs, MODEL_ID);
      expect(result).not.toBe(inputs);
    });
  });

  describe("(R-59) raw 활동 데이터 미포함", () => {
    it("출력 element 는 input/options 키만 가진다 (새 raw 필드 0)", () => {
      const result = buildRealDataScoringCallArgs(mixedInputs(), MODEL_ID);
      for (const args of result) {
        expect(Object.keys(args).sort()).toEqual(["input", "options"]);
        expect(Object.keys(args.options)).toEqual(["modelId"]);
      }
    });
  });

  // T-0692 self-wire 배선 검증 — 컴포저가 산출 RealDataScoringCallArgs[] 반환 직전
  // consistency 가드를 (산출 callArgs, inputs, modelId) 인자로 정확히 1회 self-assert
  // 하는지, 정상 합성이면 throw 0·반환 산출물 byte-identical·무공유 불변, 가드가 throw
  // 하면 컴포저가 삼키지 않고 그대로 전파하는지, 컴포저 modelId 빈/공백 가드(L84) throw
  // 입력에서는 가드 진입 전 그 throw 가 선행 전파(가드 미호출)되는지, 가드 회귀
  // (RangeError/TypeError 모의) 전파를 검증한다. T-0688 seed-collect-call-args self-wire
  // spec 패턴의 evaluate-side mirror.
  describe("consistency 가드 self-wire (T-0692) — 반환 직전 self-assert 배선", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("정상 합성(다수 input) → 가드가 (산출 callArgs, inputs, modelId) 인자로 정확히 1회 호출됨", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataScoringCallArgsConsistentWithInputs",
      );
      const inputs = mixedInputs();

      const result = buildRealDataScoringCallArgs(inputs, MODEL_ID);

      // 정확히 1회 호출.
      expect(spy).toHaveBeenCalledTimes(1);
      // 인자 순서·값이 (반환된 산출 callArgs, inputs, modelId) 와 일치.
      expect(spy).toHaveBeenCalledWith(result, inputs, MODEL_ID);
      // 가드에 넘어간 첫 인자가 컴포저가 반환한 바로 그 배열 참조여야 한다(검증 대상 일치).
      expect(spy.mock.calls[0][0]).toBe(result);
      expect(spy.mock.calls[0][1]).toBe(inputs);
      expect(spy.mock.calls[0][2]).toBe(MODEL_ID);
    });

    it("(분기 단일 input) 단일 EvaluationInput 분기에서도 가드가 (산출 callArgs, inputs, modelId) 로 정확히 1회 호출됨", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataScoringCallArgsConsistentWithInputs",
      );
      const inputs = buildRealDataEvaluationInputs([COMMIT]);

      const result = buildRealDataScoringCallArgs(inputs, MODEL_ID);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(result, inputs, MODEL_ID);
    });

    it("(분기 빈 inputs 경계) 빈 배열에서도 가드가 (산출 [], [], modelId) 로 정확히 1회 호출됨 (가드 통과·빈 산출물)", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataScoringCallArgsConsistentWithInputs",
      );
      const empty: EvaluationInput[] = [];

      const result = buildRealDataScoringCallArgs(empty, MODEL_ID);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(result, empty, MODEL_ID);
      // 빈 배열 통과(가드가 빈 callArgs 를 정합으로 인정 — throw 0).
      expect(result).toEqual([]);
    });

    it("정상 합성 → 가드 통과 후 반환 산출물이 self-wire 미배선 기대값(매핑 결과)과 byte-identical(불변)", () => {
      const inputs = mixedInputs();

      const result = buildRealDataScoringCallArgs(inputs, MODEL_ID);

      // self-wire 가 반환 산출물을 변형하지 않음 — input reference 페어링·options 단일
      // modelId 필드·순서 보존.
      expect(result).toEqual(
        inputs.map((input) => ({ input, options: { modelId: MODEL_ID } })),
      );
      result.forEach((args, i) => {
        expect(args.input).toBe(inputs[i]);
      });
    });

    it("(negative 1 — 컴포저 modelId 빈 가드 선행 throw) modelId 빈 문자열 → 가드 self-assert 도달 전 throw + 가드 미호출", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataScoringCallArgsConsistentWithInputs",
      );
      // 컴포저 modelId guard(L84) 의 throw 가 self-assert 보다 먼저 평가되므로 가드 미도달.
      expect(() => buildRealDataScoringCallArgs(mixedInputs(), "")).toThrow(
        /modelId/,
      );
      expect(spy).not.toHaveBeenCalled();
    });

    it("(negative 2 — 컴포저 modelId 빈 가드 선행 throw) modelId 공백만 → 가드 self-assert 도달 전 throw + 가드 미호출", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataScoringCallArgsConsistentWithInputs",
      );
      expect(() => buildRealDataScoringCallArgs(mixedInputs(), "   ")).toThrow(
        /modelId/,
      );
      expect(spy).not.toHaveBeenCalled();
    });

    it("(negative 3 — RangeError 길이 불일치 회귀 모사) 원소 drop 회귀 → 가드 RangeError throw 가 그대로 전파", () => {
      jest
        .spyOn(consistency, "assertRealDataScoringCallArgsConsistentWithInputs")
        .mockImplementation(() => {
          throw new RangeError(
            "정합 위반: callArgs 길이가 inputs 와 다르다 — 기대=4, 실측=3.",
          );
        });

      expect(() =>
        buildRealDataScoringCallArgs(mixedInputs(), MODEL_ID),
      ).toThrow(/길이가 inputs 와 다르다/);
    });

    it("(negative 4 — RangeError input reference drift 회귀 모사) 특정 index input 변조 → 가드 RangeError throw 전파", () => {
      jest
        .spyOn(consistency, "assertRealDataScoringCallArgsConsistentWithInputs")
        .mockImplementation(() => {
          throw new RangeError(
            "정합 위반: callArgs[1].input 이 inputs[1] 와 reference 동등하지 않다",
          );
        });

      expect(() =>
        buildRealDataScoringCallArgs(mixedInputs(), MODEL_ID),
      ).toThrow(/reference 동등하지 않다/);
    });

    it("(negative 5 — RangeError modelId 정책 위반 회귀 모사) modelId 어긋남 → 가드 RangeError throw 전파", () => {
      jest
        .spyOn(consistency, "assertRealDataScoringCallArgsConsistentWithInputs")
        .mockImplementation(() => {
          throw new RangeError(
            '정합 위반: callArgs[0].options.modelId 가 주입 modelId 와 다르다 — 기대="qwen2.5-coder:32b", 실측="llama3".',
          );
        });

      expect(() =>
        buildRealDataScoringCallArgs(mixedInputs(), MODEL_ID),
      ).toThrow(/options\.modelId 가 주입 modelId 와 다르다/);
    });

    it("(negative 6 — RangeError options 잉여 필드 회귀 모사) options 에 잉여 키 → 가드 RangeError throw 전파", () => {
      jest
        .spyOn(consistency, "assertRealDataScoringCallArgsConsistentWithInputs")
        .mockImplementation(() => {
          throw new RangeError(
            '정합 위반: callArgs[0].options 에 { modelId } 외 잉여 키가 있다 — 실측 키=["modelId","temperature"].',
          );
        });

      expect(() =>
        buildRealDataScoringCallArgs(mixedInputs(), MODEL_ID),
      ).toThrow(/잉여 키가 있다/);
    });

    it("(negative 7 — TypeError 구조결손 회귀 모사) 산출물 비-배열 모사 → 가드 TypeError throw 전파", () => {
      jest
        .spyOn(consistency, "assertRealDataScoringCallArgsConsistentWithInputs")
        .mockImplementation(() => {
          throw new TypeError("callArgs 가 배열이 아니다 — 구조 검증 실패.");
        });

      expect(() =>
        buildRealDataScoringCallArgs(mixedInputs(), MODEL_ID),
      ).toThrow(TypeError);
    });

    it("self-wire 배선 후에도 입력 비변형 + 동일 입력 두 번 deterministic + 반환 산출물 무공유", () => {
      const inputs = mixedInputs();
      const inputsSnapshot = JSON.stringify(inputs);

      const a = buildRealDataScoringCallArgs(inputs, MODEL_ID);
      const b = buildRealDataScoringCallArgs(inputs, MODEL_ID);

      // 비변형(inputs mutate 0).
      expect(JSON.stringify(inputs)).toBe(inputsSnapshot);
      expect(inputs).toHaveLength(4);
      // deterministic byte-identical.
      expect(a).toEqual(b);
      // 무공유(반환 배열·options 가 호출마다 새 객체).
      expect(a).not.toBe(b);
      expect(a[0]).not.toBe(b[0]);
      expect(a[0].options).not.toBe(b[0].options);
    });
  });
});
