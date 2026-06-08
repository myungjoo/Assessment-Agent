// evaluation-volume.ts 의 colocated unit test (CLAUDE.md §3.2 R-112 — happy /
// error / branch / negative cases 충분 cover). `calculateEvaluationVolume` 순수
// 함수의 결정적 산출(titleLength baseline + 비정상 입력 fallback + 정규화)을
// 검증한다. 모든 분기(number 정상 / number 비정상 / 비-number)를 cover 한다.

import type {
  ActivityMetadata,
  ActivityMetadataValue,
} from "../../assessment-collection/domain/activity";

import type { EvaluationInput } from "./evaluation-input";
import { calculateEvaluationVolume } from "./evaluation-volume";

// metadata 만으로 volume 을 산출하므로 나머지 EvaluationInput 필드는 고정 stub.
function makeInput(metadata: ActivityMetadata): EvaluationInput {
  return {
    unitId: "github:sec:abc",
    contributionKind: "code",
    sourceType: "github",
    instanceKey: "sec",
    author: "gildong",
    timestamp: "2026-06-01T09:00:00Z",
    metadata,
  };
}

describe("calculateEvaluationVolume", () => {
  describe("happy-path — titleLength number 정상 (R-112-1)", () => {
    it("양의 정수 titleLength 를 그대로 반환한다 (42 → 42)", () => {
      expect(calculateEvaluationVolume(makeInput({ titleLength: 42 }))).toBe(
        42,
      );
    });

    it("titleLength 0 → 0", () => {
      expect(calculateEvaluationVolume(makeInput({ titleLength: 0 }))).toBe(0);
    });

    it("titleLength 1 → 1 (경계값 — 가장 작은 양수)", () => {
      expect(calculateEvaluationVolume(makeInput({ titleLength: 1 }))).toBe(1);
    });

    it("큰 양의 정수도 그대로 반환한다 (10000 → 10000)", () => {
      expect(calculateEvaluationVolume(makeInput({ titleLength: 10000 }))).toBe(
        10000,
      );
    });

    it("소수는 floor 정규화한다 (3.14 → 3)", () => {
      expect(calculateEvaluationVolume(makeInput({ titleLength: 3.14 }))).toBe(
        3,
      );
    });

    it("소수 0.9 → 0 (floor 후 양수 아님)", () => {
      expect(calculateEvaluationVolume(makeInput({ titleLength: 0.9 }))).toBe(
        0,
      );
    });
  });

  describe("negative / error path — number 비정상 (R-112-2 충분 cover)", () => {
    it("음수 → 0 (방어, -5 → 0)", () => {
      expect(calculateEvaluationVolume(makeInput({ titleLength: -5 }))).toBe(0);
    });

    it("음수 소수 → 0 (-3.14 → 0)", () => {
      expect(calculateEvaluationVolume(makeInput({ titleLength: -3.14 }))).toBe(
        0,
      );
    });

    it("NaN → 0", () => {
      expect(
        calculateEvaluationVolume(makeInput({ titleLength: Number.NaN })),
      ).toBe(0);
    });

    it("Infinity → 0", () => {
      expect(
        calculateEvaluationVolume(
          makeInput({ titleLength: Number.POSITIVE_INFINITY }),
        ),
      ).toBe(0);
    });

    it("-Infinity → 0", () => {
      expect(
        calculateEvaluationVolume(
          makeInput({ titleLength: Number.NEGATIVE_INFINITY }),
        ),
      ).toBe(0);
    });
  });

  describe("negative / error path — 비-number scalar fallback (R-112-2 충분 cover)", () => {
    it("titleLength 부재 (빈 metadata) → 0", () => {
      expect(calculateEvaluationVolume(makeInput({}))).toBe(0);
    });

    it("titleLength 가 string ('42') → 0 (타입 fallback)", () => {
      expect(calculateEvaluationVolume(makeInput({ titleLength: "42" }))).toBe(
        0,
      );
    });

    it("titleLength 가 빈 string ('') → 0", () => {
      expect(calculateEvaluationVolume(makeInput({ titleLength: "" }))).toBe(0);
    });

    it("titleLength 가 boolean true → 0", () => {
      expect(calculateEvaluationVolume(makeInput({ titleLength: true }))).toBe(
        0,
      );
    });

    it("titleLength 가 boolean false → 0", () => {
      expect(calculateEvaluationVolume(makeInput({ titleLength: false }))).toBe(
        0,
      );
    });

    it("titleLength 가 null → 0", () => {
      expect(calculateEvaluationVolume(makeInput({ titleLength: null }))).toBe(
        0,
      );
    });

    it("metadata 에 다른 키만 있고 titleLength 부재 → 0", () => {
      expect(
        calculateEvaluationVolume(
          makeInput({ changedFiles: 7, repoRef: "sec/ecode" }),
        ),
      ).toBe(0);
    });
  });

  describe("branch cover — typeof 3 분기 각 1+ (R-112-3)", () => {
    it.each<[string, ActivityMetadataValue, number]>([
      ["number 정상", 12, 12],
      ["number 비정상(NaN)", Number.NaN, 0],
      ["비-number(string)", "x", 0],
      ["비-number(boolean)", true, 0],
      ["비-number(null)", null, 0],
    ])("%s 분기: titleLength=%p → %p", (_label, value, expected) => {
      expect(calculateEvaluationVolume(makeInput({ titleLength: value }))).toBe(
        expected,
      );
    });
  });

  describe("결정성 (determinism — LLM 의존 0, R-112-2)", () => {
    it("동일 입력 2 회 호출이 동일 출력이다 (referential transparency)", () => {
      const input = makeInput({ titleLength: 42 });
      expect(calculateEvaluationVolume(input)).toBe(
        calculateEvaluationVolume(input),
      );
    });

    it("입력 metadata 를 변형하지 않는다 (부수효과 0)", () => {
      const metadata: ActivityMetadata = { titleLength: 7 };
      const input = makeInput(metadata);
      calculateEvaluationVolume(input);
      expect(metadata).toEqual({ titleLength: 7 });
    });

    it("어떤 metadata 입력에서도 throw 하지 않는다", () => {
      expect(() => calculateEvaluationVolume(makeInput({}))).not.toThrow();
      expect(() =>
        calculateEvaluationVolume(makeInput({ titleLength: -1 })),
      ).not.toThrow();
      expect(() =>
        calculateEvaluationVolume(makeInput({ titleLength: "bad" })),
      ).not.toThrow();
    });
  });
});
