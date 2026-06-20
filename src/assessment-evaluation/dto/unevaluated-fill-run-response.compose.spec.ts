// unevaluated-fill-run-response.compose.spec — T-0555 R-112 cover.
// 본 helper 는 compose-only 라 **자체 분기 0** — compose 경로의 대표 case 를 분리해 cover 한다.
// happy-path(혼합 status compose · count 불변식 · status-aware totalEvaluatedRecords · 순서 보존 ·
// 빈 배열) + error path(outcomes null/undefined·non-array · 원소 null/undefined · 비-union status ·
// status 누락 · evaluatedCount 음수/비정수 — 전부 첫 조각 `aggregateUnevaluatedFillRunResult`
// 전파) + branch(빈/evaluated-only/skipped-only/failed-only/evaluatedCount 미설정 대표 case 분리)
// + negative(예외 분기마다 1+) + 비변형/합성 순서/새-배열 단언.

import { composeUnevaluatedFillRunResponse } from "./unevaluated-fill-run-response.compose";
import { toUnevaluatedFillRunResponse } from "./unevaluated-fill-run-response.mapper";
import {
  aggregateUnevaluatedFillRunResult,
  type UnevaluatedFillRunOutcome,
} from "./unevaluated-fill-run-result";

// 테스트 fixture 빌더 — 결정적 좌표 4 축 + 덮어쓰기 가능한 status/evaluatedCount/reason.
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

describe("composeUnevaluatedFillRunResponse — 출력-side 2 조각(집계 → 직렬화) compose-only 순수 helper", () => {
  describe("happy-path — 혼합 status 배열을 compose 해 응답 shape 반환", () => {
    it("혼합 status(evaluated/skipped/failed 각 1+, 일부 evaluatedCount 설정·일부 미설정) outcome 배열을 compose 하면 2 조각을 순서대로 엮은 응답과 동등하다", () => {
      const outcomes: UnevaluatedFillRunOutcome[] = [
        buildOutcome({
          personId: "p1",
          status: "evaluated",
          evaluatedCount: 3,
        }),
        buildOutcome({ personId: "p2", status: "evaluated" }), // evaluatedCount 미설정 → 0 취급
        buildOutcome({
          personId: "p3",
          status: "skipped",
          reason: "이미 존재",
        }),
        buildOutcome({ personId: "p4", status: "failed", reason: "수집 0" }),
      ];

      const actual = composeUnevaluatedFillRunResponse(outcomes);

      // (i) 반환이 toResponse(aggregate(outcomes)) 와 동등 — 집계 필드 정확 + outcomes 내용 일치.
      const expected = toUnevaluatedFillRunResponse(
        aggregateUnevaluatedFillRunResult(outcomes),
      );
      expect(actual).toEqual(expected);

      // (ii) status 별 count 합 불변식 — evaluatedCount + skippedCount + failedCount === totalCount.
      expect(actual.evaluatedCount).toBe(2);
      expect(actual.skippedCount).toBe(1);
      expect(actual.failedCount).toBe(1);
      expect(actual.totalCount).toBe(4);
      expect(
        actual.evaluatedCount + actual.skippedCount + actual.failedCount,
      ).toBe(actual.totalCount);

      // (iii) totalEvaluatedRecords 가 evaluated outcome 들의 evaluatedCount 합(status-aware) 과 일치.
      //       p1=3(설정) + p2=0(미설정) = 3. skipped/failed 는 합산하지 않는다.
      expect(actual.totalEvaluatedRecords).toBe(3);

      // (iv) outcomes 순서가 입력과 일치(재정렬/dedup 0).
      expect(actual.outcomes.map((o) => o.personId)).toEqual([
        "p1",
        "p2",
        "p3",
        "p4",
      ]);
    });

    it("빈 배열 [] 을 compose 하면 모든 count 0 · 빈 outcomes 응답을 반환한다", () => {
      const actual = composeUnevaluatedFillRunResponse([]);

      expect(actual.outcomes).toEqual([]);
      expect(actual.totalCount).toBe(0);
      expect(actual.evaluatedCount).toBe(0);
      expect(actual.skippedCount).toBe(0);
      expect(actual.failedCount).toBe(0);
      expect(actual.totalEvaluatedRecords).toBe(0);
    });
  });

  describe("flow / branch — 본 helper 자체 분기 없음(compose-only), compose 경로 대표 case 분리", () => {
    it("(a) 빈 배열 → 빈 응답", () => {
      const actual = composeUnevaluatedFillRunResponse([]);
      expect(actual.totalCount).toBe(0);
      expect(actual.outcomes).toHaveLength(0);
    });

    it("(b) evaluated-only → evaluatedCount 만 누적 + totalEvaluatedRecords 합산", () => {
      const outcomes = [
        buildOutcome({ status: "evaluated", evaluatedCount: 2 }),
        buildOutcome({ status: "evaluated", evaluatedCount: 5 }),
      ];
      const actual = composeUnevaluatedFillRunResponse(outcomes);
      expect(actual.evaluatedCount).toBe(2);
      expect(actual.skippedCount).toBe(0);
      expect(actual.failedCount).toBe(0);
      expect(actual.totalEvaluatedRecords).toBe(7);
    });

    it("(c) skipped-only → skippedCount 만 누적, totalEvaluatedRecords 0(status-aware)", () => {
      const outcomes = [
        buildOutcome({ status: "skipped" }),
        // skipped 에 잔존 evaluatedCount 가 있어도 status-aware 라 합산 안 됨.
        buildOutcome({ status: "skipped", evaluatedCount: 9 }),
      ];
      const actual = composeUnevaluatedFillRunResponse(outcomes);
      expect(actual.skippedCount).toBe(2);
      expect(actual.evaluatedCount).toBe(0);
      expect(actual.totalEvaluatedRecords).toBe(0);
    });

    it("(d) failed-only → failedCount 만 누적, totalEvaluatedRecords 0", () => {
      const outcomes = [
        buildOutcome({ status: "failed", reason: "LLM 오류" }),
        buildOutcome({ status: "failed", reason: "수집 0" }),
      ];
      const actual = composeUnevaluatedFillRunResponse(outcomes);
      expect(actual.failedCount).toBe(2);
      expect(actual.totalEvaluatedRecords).toBe(0);
    });

    it("(e) evaluated 에 evaluatedCount 미설정(undefined) → totalEvaluatedRecords 0 취급, evaluatedCount 응답 필드는 undefined echo", () => {
      const outcomes = [buildOutcome({ status: "evaluated" })];
      const actual = composeUnevaluatedFillRunResponse(outcomes);
      expect(actual.evaluatedCount).toBe(1);
      expect(actual.totalEvaluatedRecords).toBe(0);
      expect(actual.outcomes[0].evaluatedCount).toBeUndefined();
    });
  });

  describe("error path / negative — 전부 첫 조각 aggregateUnevaluatedFillRunResult 전파(예외 분기마다 cover)", () => {
    it("outcomes 가 null 이면 첫 조각의 한국어 TypeError fail-fast", () => {
      expect(() =>
        composeUnevaluatedFillRunResponse(
          null as unknown as UnevaluatedFillRunOutcome[],
        ),
      ).toThrow(TypeError);
      expect(() =>
        composeUnevaluatedFillRunResponse(
          null as unknown as UnevaluatedFillRunOutcome[],
        ),
      ).toThrow(
        /aggregateUnevaluatedFillRunResult: outcomes 는 배열이어야 한다/,
      );
    });

    it("outcomes 가 undefined 이면 첫 조각의 한국어 TypeError fail-fast", () => {
      expect(() =>
        composeUnevaluatedFillRunResponse(
          undefined as unknown as UnevaluatedFillRunOutcome[],
        ),
      ).toThrow(
        /aggregateUnevaluatedFillRunResult: outcomes 는 배열이어야 한다/,
      );
    });

    it("outcomes 가 non-array(객체)이면 첫 조각의 한국어 TypeError 전파", () => {
      expect(() =>
        composeUnevaluatedFillRunResponse(
          {} as unknown as UnevaluatedFillRunOutcome[],
        ),
      ).toThrow(
        /aggregateUnevaluatedFillRunResult: outcomes 는 배열이어야 한다/,
      );
    });

    it("outcomes 가 non-array(string)이면 첫 조각의 한국어 TypeError 전파", () => {
      expect(() =>
        composeUnevaluatedFillRunResponse(
          "oops" as unknown as UnevaluatedFillRunOutcome[],
        ),
      ).toThrow(
        /aggregateUnevaluatedFillRunResult: outcomes 는 배열이어야 한다/,
      );
    });

    it("배열 원소가 null 이면 첫 조각의 한국어 TypeError(인덱스 포함) 전파", () => {
      const outcomes = [
        buildOutcome(),
        null as unknown as UnevaluatedFillRunOutcome,
      ];
      expect(() => composeUnevaluatedFillRunResponse(outcomes)).toThrow(
        /aggregateUnevaluatedFillRunResult: outcomes\[1\] outcome 원소가 null\/undefined/,
      );
    });

    it("배열 원소가 undefined 이면 첫 조각의 한국어 TypeError(인덱스 포함) 전파", () => {
      const outcomes = [
        undefined as unknown as UnevaluatedFillRunOutcome,
        buildOutcome(),
      ];
      expect(() => composeUnevaluatedFillRunResponse(outcomes)).toThrow(
        /aggregateUnevaluatedFillRunResult: outcomes\[0\] outcome 원소가 null\/undefined/,
      );
    });

    it('원소 status 가 허용 union 멤버가 아니면(예 "done") 첫 조각의 한국어 TypeError(인덱스 포함) 전파', () => {
      const outcomes = [
        buildOutcome(),
        buildOutcome({
          status: "done" as unknown as UnevaluatedFillRunOutcome["status"],
        }),
      ];
      expect(() => composeUnevaluatedFillRunResponse(outcomes)).toThrow(
        /aggregateUnevaluatedFillRunResult: outcomes\[1\]\.status 가 허용 status/,
      );
    });

    it("원소 status 가 누락(undefined)이면 첫 조각의 한국어 TypeError(인덱스 포함) 전파", () => {
      const outcomes = [
        buildOutcome({
          status: undefined as unknown as UnevaluatedFillRunOutcome["status"],
        }),
      ];
      expect(() => composeUnevaluatedFillRunResponse(outcomes)).toThrow(
        /aggregateUnevaluatedFillRunResult: outcomes\[0\]\.status 가 허용 status/,
      );
    });

    it("evaluated 원소의 evaluatedCount 가 음수면 첫 조각의 한국어 TypeError(인덱스 포함) 전파", () => {
      const outcomes = [
        buildOutcome({ status: "evaluated", evaluatedCount: -1 }),
      ];
      expect(() => composeUnevaluatedFillRunResponse(outcomes)).toThrow(
        /aggregateUnevaluatedFillRunResult: outcomes\[0\]\.evaluatedCount 는 0 이상의 정수/,
      );
    });

    it("evaluated 원소의 evaluatedCount 가 비정수면 첫 조각의 한국어 TypeError(인덱스 포함) 전파", () => {
      const outcomes = [
        buildOutcome({ status: "evaluated", evaluatedCount: 1.5 }),
      ];
      expect(() => composeUnevaluatedFillRunResponse(outcomes)).toThrow(
        /aggregateUnevaluatedFillRunResult: outcomes\[0\]\.evaluatedCount 는 0 이상의 정수/,
      );
    });
  });

  describe("비변형 · 합성 순서 · 새-배열 단언", () => {
    it("compose 호출 후 입력 outcomes 배열·각 원소 객체가 그대로다(구조 동등성·길이 불변)", () => {
      const outcomes = [
        buildOutcome({
          personId: "p1",
          status: "evaluated",
          evaluatedCount: 2,
        }),
        buildOutcome({ personId: "p2", status: "skipped" }),
      ];
      const snapshot = JSON.parse(JSON.stringify(outcomes));

      composeUnevaluatedFillRunResponse(outcomes);

      expect(outcomes).toHaveLength(2);
      expect(outcomes).toEqual(snapshot);
    });

    it("반환 outcomes 가 입력과 별개의 새 배열이다(둘째 조각 map 결과)", () => {
      const outcomes = [
        buildOutcome({ status: "evaluated", evaluatedCount: 1 }),
      ];
      const actual = composeUnevaluatedFillRunResponse(outcomes);

      expect(actual.outcomes).not.toBe(outcomes);
      // 응답 원소도 입력 원소와 별개 객체(둘째 조각이 새 객체로 map).
      expect(actual.outcomes[0]).not.toBe(outcomes[0]);
    });

    it("반환이 집계+직렬화된 응답 shape(= 2 조각 순서 정확)임을 happy 에서 단언 — 직렬화 전 집계가 선행됨", () => {
      const outcomes = [
        buildOutcome({ status: "evaluated", evaluatedCount: 4 }),
        buildOutcome({ status: "skipped" }),
      ];
      const actual = composeUnevaluatedFillRunResponse(outcomes);

      // aggregate 가 산출하는 집계 필드가 응답에 그대로 전사돼야 한다(직렬화만으로는 못 만드는 값).
      const aggregated = aggregateUnevaluatedFillRunResult(outcomes);
      expect(actual.evaluatedCount).toBe(aggregated.evaluatedCount);
      expect(actual.skippedCount).toBe(aggregated.skippedCount);
      expect(actual.totalEvaluatedRecords).toBe(
        aggregated.totalEvaluatedRecords,
      );
    });

    it("negative 전파 메시지가 첫 조각(aggregateUnevaluatedFillRunResult) prefix 에서 왔음을 단언해 합성 순서(집계가 직렬화보다 먼저) 회귀를 잡는다", () => {
      // 둘째 조각(toUnevaluatedFillRunResponse) prefix 가 아니라 첫 조각 prefix 여야 한다.
      expect(() =>
        composeUnevaluatedFillRunResponse(
          null as unknown as UnevaluatedFillRunOutcome[],
        ),
      ).toThrow(/^aggregateUnevaluatedFillRunResult:/);
    });
  });
});
