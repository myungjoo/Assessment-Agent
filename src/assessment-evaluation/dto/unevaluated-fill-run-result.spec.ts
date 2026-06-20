// unevaluated-fill-run-result.spec — T-0552. 순수 helper aggregateUnevaluatedFillRunResult
// 의 R-112 cover: happy path / error path / branch coverage / negative cases 충분 cover /
// 비변형. 신규 파일 100% coverage 목표. status-aware sum 명세 고정:
//   - totalEvaluatedRecords 는 evaluated status outcome 의 evaluatedCount 만 합산한다.
//   - evaluatedCount 미설정(undefined)은 0 으로 취급한다.
//   - evaluated 원소의 evaluatedCount 가 음수/비정수면 fail-fast TypeError.

import {
  aggregateUnevaluatedFillRunResult,
  isUnevaluatedFillRunStatus,
  UNEVALUATED_FILL_RUN_STATUSES,
  type UnevaluatedFillRunOutcome,
  type UnevaluatedFillRunStatus,
} from "./unevaluated-fill-run-result";

/** 좌표 4 축 + status + 선택 evaluatedCount/reason 을 갖는 outcome plain 객체 조립 helper. */
function makeOutcome(
  overrides: Partial<UnevaluatedFillRunOutcome> = {},
): UnevaluatedFillRunOutcome {
  return {
    personId: overrides.personId ?? "person-1",
    period: overrides.period ?? "week",
    scope: overrides.scope ?? "commit",
    periodStart: overrides.periodStart ?? "2026-06-10T00:00:00+09:00",
    status: overrides.status ?? "evaluated",
    ...(overrides.evaluatedCount !== undefined
      ? { evaluatedCount: overrides.evaluatedCount }
      : {}),
    ...(overrides.reason !== undefined ? { reason: overrides.reason } : {}),
  };
}

describe("aggregateUnevaluatedFillRunResult", () => {
  describe("happy path — 혼합 status 집계", () => {
    it("evaluated/skipped/failed 혼합 배열을 status 별 카운트·합 불변식·records 합·순서로 집계한다", () => {
      const ev1 = makeOutcome({
        personId: "p-a",
        status: "evaluated",
        evaluatedCount: 3,
      });
      const sk = makeOutcome({
        personId: "p-b",
        status: "skipped",
        reason: "이미 존재",
      });
      const ev2 = makeOutcome({
        personId: "p-c",
        status: "evaluated",
        evaluatedCount: 2,
      });
      const fa = makeOutcome({
        personId: "p-d",
        status: "failed",
        reason: "수집 0",
      });

      const result = aggregateUnevaluatedFillRunResult([ev1, sk, ev2, fa]);

      // (i) 각 status 카운트 정확.
      expect(result.evaluatedCount).toBe(2);
      expect(result.skippedCount).toBe(1);
      expect(result.failedCount).toBe(1);
      // (ii) totalCount / 합 불변식.
      expect(result.totalCount).toBe(4);
      expect(
        result.evaluatedCount + result.skippedCount + result.failedCount,
      ).toBe(result.totalCount);
      // (iii) totalEvaluatedRecords = evaluated outcome 들의 evaluatedCount 합(3 + 2).
      expect(result.totalEvaluatedRecords).toBe(5);
      // (iv) outcomes 순서·내용이 입력과 일치(원소 참조 재사용).
      expect(result.outcomes).toEqual([ev1, sk, ev2, fa]);
      expect(result.outcomes[0]).toBe(ev1);
      expect(result.outcomes[3]).toBe(fa);
    });

    it("같은 좌표가 두 번 실행돼도 dedup/필터 없이 둘 다 보존한다", () => {
      const a = makeOutcome({
        personId: "dup",
        status: "evaluated",
        evaluatedCount: 1,
      });
      const b = makeOutcome({ personId: "dup", status: "failed" });

      const result = aggregateUnevaluatedFillRunResult([a, b]);

      expect(result.totalCount).toBe(2);
      expect(result.outcomes).toHaveLength(2);
      expect(result.evaluatedCount).toBe(1);
      expect(result.failedCount).toBe(1);
    });
  });

  describe("branch / flow coverage — status 분기", () => {
    it("(a) 빈 배열은 모든 카운트 0·totalEvaluatedRecords 0·빈 outcomes", () => {
      const result = aggregateUnevaluatedFillRunResult([]);

      expect(result.totalCount).toBe(0);
      expect(result.evaluatedCount).toBe(0);
      expect(result.skippedCount).toBe(0);
      expect(result.failedCount).toBe(0);
      expect(result.totalEvaluatedRecords).toBe(0);
      expect(result.outcomes).toEqual([]);
    });

    it("(b) evaluated-only 배열은 evaluatedCount 만 채워지고 records 가 합산된다", () => {
      const result = aggregateUnevaluatedFillRunResult([
        makeOutcome({ status: "evaluated", evaluatedCount: 4 }),
        makeOutcome({ status: "evaluated", evaluatedCount: 1 }),
      ]);

      expect(result.evaluatedCount).toBe(2);
      expect(result.skippedCount).toBe(0);
      expect(result.failedCount).toBe(0);
      expect(result.totalEvaluatedRecords).toBe(5);
    });

    it("(c) skipped-only 배열은 skippedCount 만 채워지고 records 0", () => {
      const result = aggregateUnevaluatedFillRunResult([
        makeOutcome({ status: "skipped" }),
        makeOutcome({ status: "skipped" }),
      ]);

      expect(result.skippedCount).toBe(2);
      expect(result.evaluatedCount).toBe(0);
      expect(result.failedCount).toBe(0);
      expect(result.totalEvaluatedRecords).toBe(0);
    });

    it("(d) failed-only 배열은 failedCount 만 채워지고 records 0", () => {
      const result = aggregateUnevaluatedFillRunResult([
        makeOutcome({ status: "failed" }),
      ]);

      expect(result.failedCount).toBe(1);
      expect(result.evaluatedCount).toBe(0);
      expect(result.skippedCount).toBe(0);
      expect(result.totalEvaluatedRecords).toBe(0);
    });

    it("(e) evaluated 의 evaluatedCount 미설정(undefined)은 합산에서 0 으로 취급한다", () => {
      const result = aggregateUnevaluatedFillRunResult([
        makeOutcome({ status: "evaluated" }), // evaluatedCount 미설정
        makeOutcome({ status: "evaluated", evaluatedCount: 7 }),
      ]);

      expect(result.evaluatedCount).toBe(2);
      // 미설정은 0 → 합은 7 만.
      expect(result.totalEvaluatedRecords).toBe(7);
    });

    it("(f) evaluated 가 아닌 status 의 evaluatedCount 는 합산하지 않는다(status-aware sum)", () => {
      const result = aggregateUnevaluatedFillRunResult([
        makeOutcome({ status: "skipped", evaluatedCount: 99 }),
        makeOutcome({ status: "failed", evaluatedCount: 50 }),
        makeOutcome({ status: "evaluated", evaluatedCount: 2 }),
      ]);

      // skipped/failed 에 잔존 evaluatedCount 가 있어도 evaluated 의 2 만 합산.
      expect(result.totalEvaluatedRecords).toBe(2);
    });

    it("evaluated 의 evaluatedCount 0 은 정상 합산(경계값)", () => {
      const result = aggregateUnevaluatedFillRunResult([
        makeOutcome({ status: "evaluated", evaluatedCount: 0 }),
      ]);

      expect(result.totalEvaluatedRecords).toBe(0);
      expect(result.evaluatedCount).toBe(1);
    });
  });

  describe("error path / negative cases — fail-fast 한국어 TypeError", () => {
    it("outcomes 가 null 이면 한국어 메시지 TypeError 를 던진다", () => {
      expect(() =>
        aggregateUnevaluatedFillRunResult(
          null as unknown as UnevaluatedFillRunOutcome[],
        ),
      ).toThrow(TypeError);
      expect(() =>
        aggregateUnevaluatedFillRunResult(
          null as unknown as UnevaluatedFillRunOutcome[],
        ),
      ).toThrow("배열이어야 한다");
    });

    it("outcomes 가 undefined 이면 한국어 메시지 TypeError 를 던진다", () => {
      expect(() =>
        aggregateUnevaluatedFillRunResult(
          undefined as unknown as UnevaluatedFillRunOutcome[],
        ),
      ).toThrow("배열이어야 한다");
    });

    it("outcomes 가 non-array(객체)면 TypeError 를 던진다", () => {
      expect(() =>
        aggregateUnevaluatedFillRunResult(
          {} as unknown as UnevaluatedFillRunOutcome[],
        ),
      ).toThrow("배열이어야 한다");
    });

    it("outcomes 가 non-array(string)면 TypeError 를 던진다", () => {
      expect(() =>
        aggregateUnevaluatedFillRunResult(
          "x" as unknown as UnevaluatedFillRunOutcome[],
        ),
      ).toThrow("배열이어야 한다");
    });

    it("배열 원소가 null 이면 한국어 메시지 TypeError(인덱스 포함)를 던진다", () => {
      const outcomes = [
        makeOutcome({ status: "evaluated" }),
        null as unknown as UnevaluatedFillRunOutcome,
      ];
      expect(() => aggregateUnevaluatedFillRunResult(outcomes)).toThrow(
        TypeError,
      );
      expect(() => aggregateUnevaluatedFillRunResult(outcomes)).toThrow(
        "outcomes[1]",
      );
    });

    it("배열 원소가 undefined 이면 한국어 메시지 TypeError(인덱스 포함)를 던진다", () => {
      const outcomes = [undefined as unknown as UnevaluatedFillRunOutcome];
      expect(() => aggregateUnevaluatedFillRunResult(outcomes)).toThrow(
        "outcomes[0]",
      );
    });

    it("status 가 허용 union 멤버가 아니면(예 'done') TypeError(인덱스 포함)를 던진다", () => {
      const outcomes = [
        makeOutcome({ status: "evaluated" }),
        makeOutcome({
          status: "done" as unknown as UnevaluatedFillRunStatus,
        }),
      ];
      expect(() => aggregateUnevaluatedFillRunResult(outcomes)).toThrow(
        "허용 status",
      );
      expect(() => aggregateUnevaluatedFillRunResult(outcomes)).toThrow(
        "outcomes[1]",
      );
    });

    it("status 가 누락(undefined)이면 TypeError(인덱스 포함)를 던진다", () => {
      // makeOutcome 의 `?? "evaluated"` fallback 을 우회하려 직접 객체 literal 로 status 누락.
      const outcomes = [
        {
          personId: "person-1",
          period: "week",
          scope: "commit",
          periodStart: "2026-06-10T00:00:00+09:00",
        } as unknown as UnevaluatedFillRunOutcome,
      ];
      expect(() => aggregateUnevaluatedFillRunResult(outcomes)).toThrow(
        "허용 status",
      );
      expect(() => aggregateUnevaluatedFillRunResult(outcomes)).toThrow(
        "outcomes[0]",
      );
    });

    it("evaluated 의 evaluatedCount 가 음수면 TypeError(인덱스 포함)를 던진다", () => {
      const outcomes = [
        makeOutcome({ status: "evaluated", evaluatedCount: -1 }),
      ];
      expect(() => aggregateUnevaluatedFillRunResult(outcomes)).toThrow(
        "0 이상의 정수",
      );
      expect(() => aggregateUnevaluatedFillRunResult(outcomes)).toThrow(
        "outcomes[0]",
      );
    });

    it("evaluated 의 evaluatedCount 가 비정수(소수)면 TypeError(인덱스 포함)를 던진다", () => {
      const outcomes = [
        makeOutcome({ status: "evaluated", evaluatedCount: 1.5 }),
      ];
      expect(() => aggregateUnevaluatedFillRunResult(outcomes)).toThrow(
        "0 이상의 정수",
      );
    });

    it("evaluated 의 evaluatedCount 가 NaN 이면 TypeError 를 던진다", () => {
      const outcomes = [
        makeOutcome({ status: "evaluated", evaluatedCount: Number.NaN }),
      ];
      expect(() => aggregateUnevaluatedFillRunResult(outcomes)).toThrow(
        "0 이상의 정수",
      );
    });
  });

  describe("비변형 — 입력 mutate 0", () => {
    it("입력 배열 길이와 각 원소가 호출 후에도 그대로다(반환 outcomes 는 새 배열)", () => {
      const ev = makeOutcome({ status: "evaluated", evaluatedCount: 2 });
      const sk = makeOutcome({ status: "skipped" });
      const input = [ev, sk];

      const result = aggregateUnevaluatedFillRunResult(input);

      // 입력 배열 비변형.
      expect(input).toHaveLength(2);
      expect(input[0]).toBe(ev);
      expect(input[1]).toBe(sk);
      // 반환 outcomes 는 새 배열(입력과 다른 참조), 원소는 입력 참조 재사용.
      expect(result.outcomes).not.toBe(input);
      expect(result.outcomes[0]).toBe(ev);
    });

    it("반환 outcomes 를 mutate 해도 입력 배열은 영향받지 않는다", () => {
      const input = [makeOutcome({ status: "evaluated" })];
      const result = aggregateUnevaluatedFillRunResult(input);

      result.outcomes.push(makeOutcome({ status: "failed" }));

      expect(input).toHaveLength(1);
    });
  });

  describe("부수 export — status union single source / type-guard", () => {
    it("UNEVALUATED_FILL_RUN_STATUSES 는 3 멤버를 가진다", () => {
      expect(UNEVALUATED_FILL_RUN_STATUSES).toEqual([
        "evaluated",
        "skipped",
        "failed",
      ]);
    });

    it("isUnevaluatedFillRunStatus 는 멤버를 true, 비멤버를 false 로 판정한다", () => {
      expect(isUnevaluatedFillRunStatus("evaluated")).toBe(true);
      expect(isUnevaluatedFillRunStatus("skipped")).toBe(true);
      expect(isUnevaluatedFillRunStatus("failed")).toBe(true);
      expect(isUnevaluatedFillRunStatus("done")).toBe(false);
      expect(isUnevaluatedFillRunStatus(undefined)).toBe(false);
      expect(isUnevaluatedFillRunStatus(null)).toBe(false);
    });
  });
});
