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
});
