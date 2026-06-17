import {
  ExportChunkRefetchRetryBudget,
  ExportChunkRefetchRetryBudgetInput,
  deriveExportChunkRefetchRetryBudget,
} from "./export-chunk-refetch-retry-budget";

// 테스트 입력 input 을 만드는 helper — 필요한 필드만 override.
function makeInput(
  overrides: Partial<ExportChunkRefetchRetryBudgetInput> = {},
): ExportChunkRefetchRetryBudgetInput {
  return {
    maxAttempts: overrides.maxAttempts ?? 3,
    attemptsUsed: overrides.attemptsUsed ?? 0,
    failedChunkCount: overrides.failedChunkCount ?? 0,
  };
}

// 객체를 재귀적으로 freeze — non-mutating 검증에 쓴다(변형 시 strict mode 에서 throw).
function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === "object") {
    Object.getOwnPropertyNames(obj).forEach((key) => {
      deepFreeze((obj as Record<string, unknown>)[key]);
    });
    Object.freeze(obj);
  }
  return obj;
}

describe("deriveExportChunkRefetchRetryBudget", () => {
  describe("happy path — 모든 필드 기대값", () => {
    it("정상 예산(max=3·used=1·손상=2): 잔여=2·canRetry=true·lastAttempt=false·usagePercent=33", () => {
      const result = deriveExportChunkRefetchRetryBudget(
        makeInput({ maxAttempts: 3, attemptsUsed: 1, failedChunkCount: 2 }),
      );
      expect(result).toEqual<ExportChunkRefetchRetryBudget>({
        maxAttempts: 3,
        attemptsUsed: 1,
        failedChunkCount: 2,
        attemptsRemaining: 2,
        exhausted: false,
        canRetry: true,
        lastAttempt: false,
        usageRatio: 1 / 3,
        usagePercent: 33,
        headline:
          "chunked streaming 재시도 예산: 잔여 2/3회, 추가 재요청 허용 (잔여 손상 2개)",
      });
    });

    it("미사용 예산(used=0): usageRatio=0·attemptsRemaining=maxAttempts", () => {
      const result = deriveExportChunkRefetchRetryBudget(
        makeInput({ maxAttempts: 5, attemptsUsed: 0, failedChunkCount: 1 }),
      );
      expect(result.attemptsRemaining).toBe(5);
      expect(result.usageRatio).toBe(0);
      expect(result.usagePercent).toBe(0);
      expect(result.canRetry).toBe(true);
    });

    it("마지막 시도(잔여=1): lastAttempt=true·canRetry=true", () => {
      const result = deriveExportChunkRefetchRetryBudget(
        makeInput({ maxAttempts: 3, attemptsUsed: 2, failedChunkCount: 1 }),
      );
      expect(result.attemptsRemaining).toBe(1);
      expect(result.lastAttempt).toBe(true);
      expect(result.canRetry).toBe(true);
      expect(result.headline).toContain("(마지막 시도)");
    });

    it("손상 없음(failedChunkCount=0): 잔여가 있어도 canRetry=false", () => {
      const result = deriveExportChunkRefetchRetryBudget(
        makeInput({ maxAttempts: 3, attemptsUsed: 1, failedChunkCount: 0 }),
      );
      expect(result.attemptsRemaining).toBe(2);
      expect(result.canRetry).toBe(false);
      expect(result.headline).toContain("복구 대상 없음");
    });

    it("headline 한국어 내용 — 정상 예산 요약 문구", () => {
      const result = deriveExportChunkRefetchRetryBudget(
        makeInput({ maxAttempts: 4, attemptsUsed: 1, failedChunkCount: 3 }),
      );
      expect(result.headline).toBe(
        "chunked streaming 재시도 예산: 잔여 3/4회, 추가 재요청 허용 (잔여 손상 3개)",
      );
    });
  });

  describe("error path — 입력 방어(TypeError, 종류별 분리)", () => {
    it("input 이 null 이면 TypeError(label·받은 값)", () => {
      expect(() =>
        deriveExportChunkRefetchRetryBudget(
          null as unknown as ExportChunkRefetchRetryBudgetInput,
        ),
      ).toThrow(/input 은 plain object.*받음: null/);
    });

    it("input 이 배열이면 TypeError(받음: array)", () => {
      expect(() =>
        deriveExportChunkRefetchRetryBudget(
          [] as unknown as ExportChunkRefetchRetryBudgetInput,
        ),
      ).toThrow(/받음: array/);
    });

    it("input 이 원시값(number)이면 TypeError(받음: number)", () => {
      expect(() =>
        deriveExportChunkRefetchRetryBudget(
          42 as unknown as ExportChunkRefetchRetryBudgetInput,
        ),
      ).toThrow(TypeError);
    });

    it("maxAttempts 가 음수면 TypeError(label·받은 값)", () => {
      expect(() =>
        deriveExportChunkRefetchRetryBudget(makeInput({ maxAttempts: -1 })),
      ).toThrow(/maxAttempts.*받음: -1/);
    });

    it("maxAttempts 가 NaN 이면 TypeError", () => {
      expect(() =>
        deriveExportChunkRefetchRetryBudget(makeInput({ maxAttempts: NaN })),
      ).toThrow(/maxAttempts.*받음: NaN/);
    });

    it("maxAttempts 가 Infinity 면 TypeError", () => {
      expect(() =>
        deriveExportChunkRefetchRetryBudget(
          makeInput({ maxAttempts: Infinity }),
        ),
      ).toThrow(/maxAttempts.*받음: Infinity/);
    });

    it("maxAttempts 가 소수면 TypeError", () => {
      expect(() =>
        deriveExportChunkRefetchRetryBudget(makeInput({ maxAttempts: 2.5 })),
      ).toThrow(/maxAttempts.*받음: 2.5/);
    });

    it("maxAttempts 가 비-number(string)면 TypeError", () => {
      expect(() =>
        deriveExportChunkRefetchRetryBudget(
          makeInput({ maxAttempts: "3" as unknown as number }),
        ),
      ).toThrow(/maxAttempts/);
    });

    it("attemptsUsed 가 음수면 TypeError(label·받은 값)", () => {
      expect(() =>
        deriveExportChunkRefetchRetryBudget(makeInput({ attemptsUsed: -2 })),
      ).toThrow(/attemptsUsed.*받음: -2/);
    });

    it("attemptsUsed 가 NaN 이면 TypeError", () => {
      expect(() =>
        deriveExportChunkRefetchRetryBudget(makeInput({ attemptsUsed: NaN })),
      ).toThrow(/attemptsUsed.*받음: NaN/);
    });

    it("attemptsUsed 가 Infinity 면 TypeError", () => {
      expect(() =>
        deriveExportChunkRefetchRetryBudget(
          makeInput({ attemptsUsed: Infinity }),
        ),
      ).toThrow(/attemptsUsed.*받음: Infinity/);
    });

    it("attemptsUsed 가 소수면 TypeError", () => {
      expect(() =>
        deriveExportChunkRefetchRetryBudget(makeInput({ attemptsUsed: 1.1 })),
      ).toThrow(/attemptsUsed.*받음: 1.1/);
    });

    it("attemptsUsed 가 비-number(null)면 TypeError", () => {
      expect(() =>
        deriveExportChunkRefetchRetryBudget({
          maxAttempts: 3,
          attemptsUsed: null as unknown as number,
          failedChunkCount: 0,
        }),
      ).toThrow(/attemptsUsed/);
    });

    it("failedChunkCount 가 음수면 TypeError(label·받은 값)", () => {
      expect(() =>
        deriveExportChunkRefetchRetryBudget(
          makeInput({ failedChunkCount: -1 }),
        ),
      ).toThrow(/failedChunkCount.*받음: -1/);
    });

    it("failedChunkCount 가 NaN 이면 TypeError", () => {
      expect(() =>
        deriveExportChunkRefetchRetryBudget(
          makeInput({ failedChunkCount: NaN }),
        ),
      ).toThrow(/failedChunkCount.*받음: NaN/);
    });

    it("failedChunkCount 가 Infinity 면 TypeError", () => {
      expect(() =>
        deriveExportChunkRefetchRetryBudget(
          makeInput({ failedChunkCount: Infinity }),
        ),
      ).toThrow(/failedChunkCount.*받음: Infinity/);
    });

    it("failedChunkCount 가 소수면 TypeError", () => {
      expect(() =>
        deriveExportChunkRefetchRetryBudget(
          makeInput({ failedChunkCount: 0.5 }),
        ),
      ).toThrow(/failedChunkCount.*받음: 0.5/);
    });

    it("failedChunkCount 가 비-number(undefined)면 TypeError", () => {
      expect(() =>
        deriveExportChunkRefetchRetryBudget({
          maxAttempts: 3,
          attemptsUsed: 0,
          failedChunkCount: undefined as unknown as number,
        }),
      ).toThrow(/failedChunkCount/);
    });
  });

  describe("flow / branch 분리", () => {
    it("maxAttempts === 0 분기(재시도 미허용): 잔여=0·exhausted·usageRatio=0·usagePercent=0·canRetry=false", () => {
      const result = deriveExportChunkRefetchRetryBudget(
        makeInput({ maxAttempts: 0, attemptsUsed: 0, failedChunkCount: 2 }),
      );
      expect(result.attemptsRemaining).toBe(0);
      expect(result.exhausted).toBe(true);
      expect(result.usageRatio).toBe(0);
      expect(result.usagePercent).toBe(0);
      expect(result.canRetry).toBe(false);
      expect(result.headline).toContain("재시도 미허용");
    });

    it("maxAttempts > 0 분기(정상): 잔여 산정", () => {
      const result = deriveExportChunkRefetchRetryBudget(
        makeInput({ maxAttempts: 2, attemptsUsed: 0, failedChunkCount: 1 }),
      );
      expect(result.attemptsRemaining).toBe(2);
      expect(result.exhausted).toBe(false);
    });

    it("attemptsUsed > maxAttempts clamp 분기: 잔여=0·usageRatio=1·exhausted·canRetry=false", () => {
      const result = deriveExportChunkRefetchRetryBudget(
        makeInput({ maxAttempts: 3, attemptsUsed: 5, failedChunkCount: 2 }),
      );
      expect(result.attemptsRemaining).toBe(0);
      expect(result.usageRatio).toBe(1);
      expect(result.usagePercent).toBe(100);
      expect(result.exhausted).toBe(true);
      expect(result.canRetry).toBe(false);
    });

    it("정상(비-clamp) 분기: usageRatio = used/max 소수 그대로", () => {
      const result = deriveExportChunkRefetchRetryBudget(
        makeInput({ maxAttempts: 4, attemptsUsed: 1, failedChunkCount: 1 }),
      );
      expect(result.usageRatio).toBe(0.25);
      expect(result.usagePercent).toBe(25);
    });

    it("exhausted true(잔여 0, 손상 남음) 분기: headline 소진 문구", () => {
      const result = deriveExportChunkRefetchRetryBudget(
        makeInput({ maxAttempts: 2, attemptsUsed: 2, failedChunkCount: 1 }),
      );
      expect(result.exhausted).toBe(true);
      expect(result.canRetry).toBe(false);
      expect(result.headline).toContain("소진");
    });

    it("exhausted false 분기: 잔여 양수", () => {
      const result = deriveExportChunkRefetchRetryBudget(
        makeInput({ maxAttempts: 3, attemptsUsed: 1, failedChunkCount: 1 }),
      );
      expect(result.exhausted).toBe(false);
    });

    it("canRetry false 경로 A — 잔여 0(소진): false", () => {
      const result = deriveExportChunkRefetchRetryBudget(
        makeInput({ maxAttempts: 1, attemptsUsed: 1, failedChunkCount: 3 }),
      );
      expect(result.attemptsRemaining).toBe(0);
      expect(result.canRetry).toBe(false);
    });

    it("canRetry false 경로 B — 손상 0(복구 대상 없음): false", () => {
      const result = deriveExportChunkRefetchRetryBudget(
        makeInput({ maxAttempts: 3, attemptsUsed: 0, failedChunkCount: 0 }),
      );
      expect(result.attemptsRemaining).toBe(3);
      expect(result.canRetry).toBe(false);
    });

    it("canRetry true(잔여>0 && 손상>0): true", () => {
      const result = deriveExportChunkRefetchRetryBudget(
        makeInput({ maxAttempts: 3, attemptsUsed: 1, failedChunkCount: 2 }),
      );
      expect(result.canRetry).toBe(true);
    });

    it("lastAttempt true(잔여 1) 분기", () => {
      const result = deriveExportChunkRefetchRetryBudget(
        makeInput({ maxAttempts: 4, attemptsUsed: 3, failedChunkCount: 1 }),
      );
      expect(result.lastAttempt).toBe(true);
    });

    it("lastAttempt false(잔여 0) 분기", () => {
      const result = deriveExportChunkRefetchRetryBudget(
        makeInput({ maxAttempts: 2, attemptsUsed: 2, failedChunkCount: 1 }),
      );
      expect(result.attemptsRemaining).toBe(0);
      expect(result.lastAttempt).toBe(false);
    });

    it("lastAttempt false(잔여 ≥ 2) 분기", () => {
      const result = deriveExportChunkRefetchRetryBudget(
        makeInput({ maxAttempts: 5, attemptsUsed: 1, failedChunkCount: 1 }),
      );
      expect(result.attemptsRemaining).toBe(4);
      expect(result.lastAttempt).toBe(false);
    });

    it("usageRatio 반올림: used=1/max=3 → usagePercent=33", () => {
      const result = deriveExportChunkRefetchRetryBudget(
        makeInput({ maxAttempts: 3, attemptsUsed: 1, failedChunkCount: 1 }),
      );
      expect(result.usagePercent).toBe(33);
    });

    it("usageRatio 반올림: used=2/max=3 → usagePercent=67", () => {
      const result = deriveExportChunkRefetchRetryBudget(
        makeInput({ maxAttempts: 3, attemptsUsed: 2, failedChunkCount: 1 }),
      );
      expect(result.usagePercent).toBe(67);
    });
  });

  describe("negative cases — 불변식 전수 검증 + non-mutation", () => {
    const cases: ExportChunkRefetchRetryBudgetInput[] = [
      { maxAttempts: 0, attemptsUsed: 0, failedChunkCount: 0 }, // 미허용
      { maxAttempts: 0, attemptsUsed: 0, failedChunkCount: 2 }, // 미허용 + 손상
      { maxAttempts: 3, attemptsUsed: 0, failedChunkCount: 0 }, // 미사용, 손상 없음
      { maxAttempts: 3, attemptsUsed: 0, failedChunkCount: 2 }, // 미사용, 손상
      { maxAttempts: 3, attemptsUsed: 1, failedChunkCount: 2 }, // 정상
      { maxAttempts: 3, attemptsUsed: 5, failedChunkCount: 2 }, // 초과 사용
      { maxAttempts: 3, attemptsUsed: 2, failedChunkCount: 1 }, // 마지막 시도
      { maxAttempts: 3, attemptsUsed: 3, failedChunkCount: 1 }, // 소진
    ];

    it("모든 케이스에서 불변식 전부 성립", () => {
      for (const input of cases) {
        const r = deriveExportChunkRefetchRetryBudget(input);
        expect(r.attemptsRemaining).toBeGreaterThanOrEqual(0);
        expect(r.attemptsRemaining).toBeLessThanOrEqual(r.maxAttempts);
        expect(r.exhausted).toBe(r.attemptsRemaining === 0);
        expect(r.lastAttempt).toBe(r.attemptsRemaining === 1);
        expect(r.canRetry).toBe(
          r.attemptsRemaining > 0 && r.failedChunkCount > 0,
        );
        expect(r.usageRatio).toBeGreaterThanOrEqual(0);
        expect(r.usageRatio).toBeLessThanOrEqual(1);
        expect(r.usagePercent).toBe(Math.round(r.usageRatio * 100));
        if (r.exhausted) {
          expect(r.canRetry).toBe(false);
        }
        if (r.failedChunkCount === 0) {
          expect(r.canRetry).toBe(false);
        }
      }
    });

    it("non-mutating — deepFreeze 된 입력으로 호출해도 throw 안 함", () => {
      const frozen = deepFreeze(
        makeInput({ maxAttempts: 3, attemptsUsed: 1, failedChunkCount: 2 }),
      );
      expect(() => deriveExportChunkRefetchRetryBudget(frozen)).not.toThrow();
      // 입력 필드가 변형되지 않았는지 확인.
      expect(frozen).toEqual({
        maxAttempts: 3,
        attemptsUsed: 1,
        failedChunkCount: 2,
      });
    });

    it("순수·결정성 — 동일 입력 2회 호출은 deep-equal 이면서 다른 인스턴스(!==)", () => {
      const input = makeInput({
        maxAttempts: 4,
        attemptsUsed: 2,
        failedChunkCount: 1,
      });
      const a = deriveExportChunkRefetchRetryBudget(input);
      const b = deriveExportChunkRefetchRetryBudget(input);
      expect(a).toEqual(b);
      expect(a).not.toBe(b);
    });
  });
});
