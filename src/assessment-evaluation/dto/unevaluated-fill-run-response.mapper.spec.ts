// unevaluated-fill-run-response.mapper.spec — T-0553 R-112 cover.
// happy-path(혼합 status 전사) + error path(result null/undefined, outcomes null/undefined·
// non-array, 원소 null/undefined) + branch(빈 outcomes, evaluatedCount 설정/미설정,
// reason 설정/미설정) + negative(예외 분기마다 1+) + 비변형/참조 동등성 단언.

import {
  toUnevaluatedFillRunResponse,
  type UnevaluatedFillRunResponse,
} from "./unevaluated-fill-run-response.mapper";
import type {
  UnevaluatedFillRunOutcome,
  UnevaluatedFillRunResult,
} from "./unevaluated-fill-run-result";

// 테스트 fixture 빌더 — 혼합 status outcome 을 담은 결정적 run-result.
function buildOutcome(
  over: Partial<UnevaluatedFillRunOutcome> = {},
): UnevaluatedFillRunOutcome {
  return {
    personId: "person-1",
    period: "2026-06",
    scope: "monthly",
    periodStart: "2026-06-01T00:00:00+09:00",
    status: "evaluated",
    ...over,
  };
}

function buildResult(
  over: Partial<UnevaluatedFillRunResult> = {},
): UnevaluatedFillRunResult {
  const outcomes: UnevaluatedFillRunOutcome[] = [
    buildOutcome({ personId: "p-a", status: "evaluated", evaluatedCount: 3 }),
    buildOutcome({
      personId: "p-b",
      status: "skipped",
      reason: "이미 평가됨(first-write-wins)",
    }),
    buildOutcome({ personId: "p-c", status: "failed", reason: "수집 0" }),
  ];
  return {
    outcomes,
    totalCount: 3,
    evaluatedCount: 1,
    skippedCount: 1,
    failedCount: 1,
    totalEvaluatedRecords: 3,
    ...over,
  };
}

describe("toUnevaluatedFillRunResponse", () => {
  describe("happy-path — 혼합 status run-result 직렬화", () => {
    it("집계 필드 5 종을 입력과 동일하게 전사한다", () => {
      const result = buildResult();
      const response = toUnevaluatedFillRunResponse(result);

      expect(response.totalCount).toBe(result.totalCount);
      expect(response.evaluatedCount).toBe(result.evaluatedCount);
      expect(response.skippedCount).toBe(result.skippedCount);
      expect(response.failedCount).toBe(result.failedCount);
      expect(response.totalEvaluatedRecords).toBe(result.totalEvaluatedRecords);
    });

    it("각 outcome 의 4 축·status·evaluatedCount·reason 을 입력과 일치하게 복사한다", () => {
      const result = buildResult();
      const response = toUnevaluatedFillRunResponse(result);

      result.outcomes.forEach((outcome, index) => {
        const mapped = response.outcomes[index];
        expect(mapped.personId).toBe(outcome.personId);
        expect(mapped.period).toBe(outcome.period);
        expect(mapped.scope).toBe(outcome.scope);
        expect(mapped.periodStart).toBe(outcome.periodStart);
        expect(mapped.status).toBe(outcome.status);
        expect(mapped.evaluatedCount).toBe(outcome.evaluatedCount);
        expect(mapped.reason).toBe(outcome.reason);
      });
    });

    it("outcome 순서·길이가 입력과 일치한다(재정렬/필터 0)", () => {
      const result = buildResult();
      const response = toUnevaluatedFillRunResponse(result);

      expect(response.outcomes).toHaveLength(result.outcomes.length);
      expect(response.outcomes.map((o) => o.personId)).toEqual([
        "p-a",
        "p-b",
        "p-c",
      ]);
    });

    it("periodStart 는 string 으로 추가 직렬화 없이 그대로 echo 한다", () => {
      const result = buildResult({
        outcomes: [buildOutcome({ periodStart: "2026-12-31T15:00:00+09:00" })],
        totalCount: 1,
        evaluatedCount: 1,
        skippedCount: 0,
        failedCount: 0,
        totalEvaluatedRecords: 0,
      });
      const response = toUnevaluatedFillRunResponse(result);
      expect(response.outcomes[0].periodStart).toBe(
        "2026-12-31T15:00:00+09:00",
      );
    });
  });

  describe("error path — fail-fast 한국어 TypeError", () => {
    it("result 가 null 이면 한국어 메시지 TypeError 를 던진다", () => {
      expect(() =>
        toUnevaluatedFillRunResponse(
          null as unknown as UnevaluatedFillRunResult,
        ),
      ).toThrow(TypeError);
      expect(() =>
        toUnevaluatedFillRunResponse(
          null as unknown as UnevaluatedFillRunResult,
        ),
      ).toThrow(/null\/undefined 일 수 없다/);
    });

    it("result 가 undefined 이면 한국어 메시지 TypeError 를 던진다", () => {
      expect(() =>
        toUnevaluatedFillRunResponse(
          undefined as unknown as UnevaluatedFillRunResult,
        ),
      ).toThrow(/null\/undefined 일 수 없다/);
    });

    it("result.outcomes 가 null 이면 한국어 메시지 TypeError 를 던진다", () => {
      const bad = { outcomes: null } as unknown as UnevaluatedFillRunResult;
      expect(() => toUnevaluatedFillRunResponse(bad)).toThrow(
        /outcomes 는 배열이어야 한다/,
      );
    });

    it("result.outcomes 가 undefined 이면 한국어 메시지 TypeError 를 던진다", () => {
      const bad = {} as unknown as UnevaluatedFillRunResult;
      expect(() => toUnevaluatedFillRunResponse(bad)).toThrow(
        /outcomes 는 배열이어야 한다/,
      );
    });

    it("result.outcomes 가 non-array(객체)면 한국어 메시지 TypeError 를 던진다", () => {
      const bad = {
        outcomes: { 0: buildOutcome() },
      } as unknown as UnevaluatedFillRunResult;
      expect(() => toUnevaluatedFillRunResponse(bad)).toThrow(
        /outcomes 는 배열이어야 한다/,
      );
    });

    it("result.outcomes 가 non-array(string)면 한국어 메시지 TypeError 를 던진다", () => {
      const bad = {
        outcomes: "not-array",
      } as unknown as UnevaluatedFillRunResult;
      expect(() => toUnevaluatedFillRunResponse(bad)).toThrow(
        /outcomes 는 배열이어야 한다/,
      );
    });

    it("result 가 non-object(string)면 outcomes non-array 방어가 흡수해 TypeError 를 던진다", () => {
      expect(() =>
        toUnevaluatedFillRunResponse(
          "garbage" as unknown as UnevaluatedFillRunResult,
        ),
      ).toThrow(/outcomes 는 배열이어야 한다/);
    });

    it("result 가 non-object(number)면 outcomes non-array 방어가 흡수해 TypeError 를 던진다", () => {
      expect(() =>
        toUnevaluatedFillRunResponse(42 as unknown as UnevaluatedFillRunResult),
      ).toThrow(/outcomes 는 배열이어야 한다/);
    });

    it("outcomes 원소가 null 이면 인덱스 포함 한국어 TypeError 를 던진다", () => {
      const bad = buildResult({
        outcomes: [
          buildOutcome(),
          null as unknown as UnevaluatedFillRunOutcome,
        ],
      });
      expect(() => toUnevaluatedFillRunResponse(bad)).toThrow(
        /outcomes\[1\] outcome 원소가 null\/undefined/,
      );
    });

    it("outcomes 원소가 undefined 이면 인덱스 포함 한국어 TypeError 를 던진다", () => {
      const bad = buildResult({
        outcomes: [
          undefined as unknown as UnevaluatedFillRunOutcome,
          buildOutcome(),
        ],
      });
      expect(() => toUnevaluatedFillRunResponse(bad)).toThrow(
        /outcomes\[0\] outcome 원소가 null\/undefined/,
      );
    });
  });

  describe("flow / branch coverage", () => {
    it("(a) 빈 outcomes [] + 집계 0 → 빈 응답 outcomes·집계 0 passthrough", () => {
      const result = buildResult({
        outcomes: [],
        totalCount: 0,
        evaluatedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        totalEvaluatedRecords: 0,
      });
      const response = toUnevaluatedFillRunResponse(result);
      expect(response.outcomes).toEqual([]);
      expect(response.totalCount).toBe(0);
      expect(response.totalEvaluatedRecords).toBe(0);
    });

    it("(b) evaluatedCount 설정 outcome → 응답에 그대로 echo", () => {
      const result = buildResult({
        outcomes: [buildOutcome({ status: "evaluated", evaluatedCount: 7 })],
        totalCount: 1,
        evaluatedCount: 1,
        skippedCount: 0,
        failedCount: 0,
        totalEvaluatedRecords: 7,
      });
      const response = toUnevaluatedFillRunResponse(result);
      expect(response.outcomes[0].evaluatedCount).toBe(7);
    });

    it("(c) evaluatedCount 미설정 outcome → 응답에서도 undefined 유지(0 으로 채우지 않음)", () => {
      const result = buildResult({
        outcomes: [
          buildOutcome({ status: "skipped", evaluatedCount: undefined }),
        ],
        totalCount: 1,
        evaluatedCount: 0,
        skippedCount: 1,
        failedCount: 0,
        totalEvaluatedRecords: 0,
      });
      const response = toUnevaluatedFillRunResponse(result);
      expect(response.outcomes[0].evaluatedCount).toBeUndefined();
      expect("evaluatedCount" in response.outcomes[0]).toBe(true);
    });

    it("(d-1) reason 설정 outcome → 응답에 echo", () => {
      const result = buildResult({
        outcomes: [buildOutcome({ status: "failed", reason: "LLM 오류" })],
        totalCount: 1,
        evaluatedCount: 0,
        skippedCount: 0,
        failedCount: 1,
        totalEvaluatedRecords: 0,
      });
      const response = toUnevaluatedFillRunResponse(result);
      expect(response.outcomes[0].reason).toBe("LLM 오류");
    });

    it("(d-2) reason 미설정 outcome → 응답에서도 undefined 유지", () => {
      const result = buildResult({
        outcomes: [buildOutcome({ status: "evaluated", reason: undefined })],
        totalCount: 1,
        evaluatedCount: 1,
        skippedCount: 0,
        failedCount: 0,
        totalEvaluatedRecords: 0,
      });
      const response = toUnevaluatedFillRunResponse(result);
      expect(response.outcomes[0].reason).toBeUndefined();
    });
  });

  describe("비변형 / 참조 동등성", () => {
    it("입력 result·outcomes 배열·각 outcome 객체를 mutate 하지 않는다", () => {
      const result = buildResult();
      const originalLength = result.outcomes.length;
      const originalRefs = result.outcomes.slice();
      const originalFirst = { ...result.outcomes[0] };

      toUnevaluatedFillRunResponse(result);

      expect(result.outcomes).toHaveLength(originalLength);
      result.outcomes.forEach((outcome, index) => {
        expect(outcome).toBe(originalRefs[index]);
      });
      expect(result.outcomes[0]).toEqual(originalFirst);
    });

    it("반환 outcomes 는 입력과 다른 배열 참조다(새 배열)", () => {
      const result = buildResult();
      const response: UnevaluatedFillRunResponse =
        toUnevaluatedFillRunResponse(result);
      expect(response.outcomes).not.toBe(result.outcomes);
    });

    it("반환은 새 최상위 객체다", () => {
      const result = buildResult();
      const response = toUnevaluatedFillRunResponse(result);
      expect(response).not.toBe(result as unknown);
    });
  });
});
