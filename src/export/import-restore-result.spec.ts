// import-restore-result 순수 helper spec — R-112 4 종(happy / error / branch / negative 충분
// cover). summarizeRestorePlan(T-0448)이 산출한 RestorePlanSummary + import mode 에서
// buildRestoreResult 가 {headline, restoredCounts, impactLines[], reseedNotice} 복원 완료 결과
// 모델을 정확히 합성하는지(replace/merge headline 라벨 분기 / restoredCounts 일치 / 0 아닌
// perEntity 라인 포함 / replace kept.total=0 보존 라인 생략 / 빈 복원 경계 / reseedNotice
// 비-빈) + 입력 방어 분기(비-object summary · deleted/inserted/kept 부재·비-object · total
// 비-정수 · perEntity 부재·비-object · mode invalid)별 한국어 TypeError/RangeError +
// non-mutating(deepFreeze 통과)을 검증한다(import-restore-confirmation.spec.ts mirror).
import { RestorePlanSummary } from "./import-restore-plan-summary";
import { buildRestoreResult, RestoreResult } from "./import-restore-result";

// 5 entity 전부 0 인 perEntity map 헬퍼 — 기대값 작성 보조.
function zeroMap() {
  return { Assessment: 0, Person: 0, Group: 0, LlmConfig: 0, AuditLog: 0 };
}

// 정상 RestorePlanSummary 생성 헬퍼 — 그룹별 total + perEntity override 를 받아 합성.
function makeSummary(over?: {
  deleted?: Partial<RestorePlanSummary["deleted"]>;
  inserted?: Partial<RestorePlanSummary["inserted"]>;
  kept?: Partial<RestorePlanSummary["kept"]>;
}): RestorePlanSummary {
  return {
    deleted: { total: 0, perEntity: zeroMap(), ...over?.deleted },
    inserted: { total: 0, perEntity: zeroMap(), ...over?.inserted },
    kept: { total: 0, perEntity: zeroMap(), ...over?.kept },
  };
}

// 깊은 동결 헬퍼 — non-mutating regression 용(중첩 perEntity map 까지 freeze).
function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === "object") {
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      deepFreeze((obj as Record<string, unknown>)[key]);
    }
    Object.freeze(obj);
  }
  return obj;
}

describe("buildRestoreResult — happy path", () => {
  it("replace mode(deleted>0, kept=0) → headline 에 복원 완료·replace 표기·count, restoredCounts 일치, 0 아닌 entity 라인 포함, reseedNotice 비-빈", () => {
    const summary = makeSummary({
      deleted: {
        total: 3,
        perEntity: { ...zeroMap(), Assessment: 2, Person: 1 },
      },
      inserted: {
        total: 2,
        perEntity: { ...zeroMap(), Group: 1, AuditLog: 1 },
      },
    });
    const result: RestoreResult = buildRestoreResult(summary, "replace");

    expect(result.headline).toContain("복원 완료");
    expect(result.headline).toContain("전체 교체(replace)");
    expect(result.headline).toContain("삭제 3");
    expect(result.headline).toContain("삽입 2");
    expect(result.headline).toContain("보존 0");

    expect(result.restoredCounts).toEqual({
      deleted: 3,
      inserted: 2,
      kept: 0,
    });

    // impactLines 는 0 아닌 entity 만 — Assessment/Person(deleted), Group/AuditLog(inserted).
    expect(result.impactLines).toContain("삭제 3 row");
    expect(result.impactLines).toContain("  - Assessment: 2 row 삭제");
    expect(result.impactLines).toContain("  - Person: 1 row 삭제");
    expect(result.impactLines).toContain("삽입 2 row");
    expect(result.impactLines).toContain("  - Group: 1 row 삽입");
    expect(result.impactLines).toContain("  - AuditLog: 1 row 삽입");
    // replace + kept.total=0 → 보존 라인 자체 생략.
    expect(result.impactLines.some((l) => l.includes("보존"))).toBe(false);

    expect(result.reseedNotice.length).toBeGreaterThan(0);
    expect(result.reseedNotice).toContain("자동");
  });

  it("merge mode(deleted=0, kept>0) → headline 에 merge 표기, kept 라인 포함, restoredCounts 일치", () => {
    const summary = makeSummary({
      inserted: { total: 2, perEntity: { ...zeroMap(), Person: 2 } },
      kept: { total: 4, perEntity: { ...zeroMap(), Group: 4 } },
    });
    const result = buildRestoreResult(summary, "merge");

    expect(result.headline).toContain("병합(merge)");
    expect(result.headline).toContain("보존 4");
    expect(result.restoredCounts).toEqual({
      deleted: 0,
      inserted: 2,
      kept: 4,
    });
    expect(result.impactLines).toContain("보존 4 row");
    expect(result.impactLines).toContain("  - Group: 4 row 보존");
    expect(result.reseedNotice.length).toBeGreaterThan(0);
  });
});

describe("buildRestoreResult — branch / flow cover", () => {
  it("replace mode vs merge mode headline 라벨 분기", () => {
    const summary = makeSummary({
      deleted: { total: 2, perEntity: zeroMap() },
    });
    expect(buildRestoreResult(summary, "replace").headline).toContain(
      "전체 교체(replace)",
    );
    expect(buildRestoreResult(summary, "merge").headline).toContain(
      "병합(merge)",
    );
  });

  it("kept.total 0 vs >0 → 보존 라인 포함 분기 (replace 0 생략 / merge >0 포함)", () => {
    // replace + kept.total=0 → 보존 라인 생략.
    const replaceSummary = makeSummary({
      deleted: { total: 1, perEntity: { ...zeroMap(), Assessment: 1 } },
    });
    const replaceResult = buildRestoreResult(replaceSummary, "replace");
    expect(replaceResult.impactLines.some((l) => l.startsWith("보존"))).toBe(
      false,
    );

    // merge + kept.total>0 → 보존 라인 포함.
    const mergeSummary = makeSummary({
      kept: { total: 5, perEntity: { ...zeroMap(), Person: 5 } },
    });
    const mergeResult = buildRestoreResult(mergeSummary, "merge");
    expect(mergeResult.impactLines).toContain("보존 5 row");
  });

  it("entity count 0 vs >0 → 0 entity 는 라인 생략", () => {
    const summary = makeSummary({
      deleted: {
        total: 5,
        perEntity: { ...zeroMap(), Assessment: 5, Group: 0 },
      },
    });
    const result = buildRestoreResult(summary, "merge");
    expect(result.impactLines).toContain("  - Assessment: 5 row 삭제");
    expect(result.impactLines.some((l) => l.includes("Group"))).toBe(false);
  });

  it("entity count 비-정수(소수) → 라인 생략(total 만 노출)", () => {
    const summary = makeSummary({
      deleted: {
        total: 2,
        perEntity: {
          ...zeroMap(),
          Assessment: 1.5 as unknown as number,
        },
      },
    });
    const result = buildRestoreResult(summary, "merge");
    expect(result.impactLines).toContain("삭제 2 row");
    expect(result.impactLines.filter((l) => l.startsWith("  - "))).toEqual([]);
  });

  it("빈 복원(전 total 0) → throw 0, total 0 라인만(replace 는 보존 라인 생략), reseedNotice 비-빈", () => {
    const summary = makeSummary({});
    const result = buildRestoreResult(summary, "replace");
    expect(result.restoredCounts).toEqual({
      deleted: 0,
      inserted: 0,
      kept: 0,
    });
    // replace + kept.total=0 → 보존 라인 생략, deleted/inserted total 0 라인만.
    expect(result.impactLines).toEqual(["삭제 0 row", "삽입 0 row"]);
    expect(result.reseedNotice.length).toBeGreaterThan(0);
  });

  it("merge + 전 total 0 → 보존 0 라인 생략(kept.total>0 분기 false)", () => {
    const summary = makeSummary({});
    const result = buildRestoreResult(summary, "merge");
    // merge 라도 kept.total=0 이면 보존 라인 생략(분기는 mode 무관, kept.total 기준).
    expect(result.impactLines).toEqual(["삭제 0 row", "삽입 0 row"]);
  });
});

describe("buildRestoreResult — error path / negative cases", () => {
  it("summary 부재(undefined) → TypeError(한국어)", () => {
    expect(() =>
      buildRestoreResult(undefined as unknown as RestorePlanSummary, "replace"),
    ).toThrow(/summary 는 plain object 여야 합니다/);
  });

  it("summary null → TypeError(받음: null)", () => {
    expect(() =>
      buildRestoreResult(null as unknown as RestorePlanSummary, "replace"),
    ).toThrow(/받음: null/);
  });

  it("summary 배열 → TypeError(받음: array)", () => {
    expect(() =>
      buildRestoreResult([] as unknown as RestorePlanSummary, "merge"),
    ).toThrow(/받음: array/);
  });

  it("summary 비-object(number) → TypeError", () => {
    expect(() =>
      buildRestoreResult(5 as unknown as RestorePlanSummary, "merge"),
    ).toThrow(/summary 는 plain object/);
  });

  it("summary.deleted 부재 → TypeError(deleted)", () => {
    const bad = {
      inserted: { total: 0, perEntity: zeroMap() },
      kept: { total: 0, perEntity: zeroMap() },
    };
    expect(() =>
      buildRestoreResult(bad as unknown as RestorePlanSummary, "replace"),
    ).toThrow(/summary\.deleted 은\(는\) object 여야 합니다/);
  });

  it("summary.inserted 비-object(null) → TypeError(inserted, 받음: null)", () => {
    const bad = {
      deleted: { total: 0, perEntity: zeroMap() },
      inserted: null,
      kept: { total: 0, perEntity: zeroMap() },
    };
    expect(() =>
      buildRestoreResult(bad as unknown as RestorePlanSummary, "replace"),
    ).toThrow(/summary\.inserted 은\(는\) object .*받음: null/);
  });

  it("summary.kept 부재 → TypeError(kept)", () => {
    const bad = {
      deleted: { total: 0, perEntity: zeroMap() },
      inserted: { total: 0, perEntity: zeroMap() },
    };
    expect(() =>
      buildRestoreResult(bad as unknown as RestorePlanSummary, "merge"),
    ).toThrow(/summary\.kept/);
  });

  it("total 비-정수(소수) → TypeError", () => {
    const bad = makeSummary({ deleted: { total: 1.5, perEntity: zeroMap() } });
    expect(() => buildRestoreResult(bad, "replace")).toThrow(
      /summary\.deleted\.total 은\(는\) 0 이상 정수/,
    );
  });

  it("total 음수 → TypeError", () => {
    const bad = makeSummary({ inserted: { total: -3, perEntity: zeroMap() } });
    expect(() => buildRestoreResult(bad, "replace")).toThrow(
      /summary\.inserted\.total/,
    );
  });

  it("total NaN → TypeError", () => {
    const bad = makeSummary({ kept: { total: NaN, perEntity: zeroMap() } });
    expect(() => buildRestoreResult(bad, "merge")).toThrow(
      /summary\.kept\.total/,
    );
  });

  it("total 비-number(string) → TypeError", () => {
    const bad = makeSummary({
      deleted: { total: "3" as unknown as number, perEntity: zeroMap() },
    });
    expect(() => buildRestoreResult(bad, "replace")).toThrow(
      /summary\.deleted\.total/,
    );
  });

  it("perEntity 부재 → TypeError(perEntity)", () => {
    const bad = {
      deleted: { total: 1 },
      inserted: { total: 0, perEntity: zeroMap() },
      kept: { total: 0, perEntity: zeroMap() },
    };
    expect(() =>
      buildRestoreResult(bad as unknown as RestorePlanSummary, "replace"),
    ).toThrow(/summary\.deleted\.perEntity 은\(는\) object 여야 합니다/);
  });

  it("perEntity 비-object(null) → TypeError(받음: null)", () => {
    const bad = {
      deleted: { total: 2, perEntity: null },
      inserted: { total: 0, perEntity: zeroMap() },
      kept: { total: 0, perEntity: zeroMap() },
    };
    expect(() =>
      buildRestoreResult(bad as unknown as RestorePlanSummary, "replace"),
    ).toThrow(/summary\.deleted\.perEntity .*받음: null/);
  });

  it("perEntity 배열 → TypeError(받음: array)", () => {
    const bad = {
      deleted: { total: 0, perEntity: zeroMap() },
      inserted: { total: 1, perEntity: [] },
      kept: { total: 0, perEntity: zeroMap() },
    };
    expect(() =>
      buildRestoreResult(bad as unknown as RestorePlanSummary, "merge"),
    ).toThrow(/summary\.inserted\.perEntity .*받음: array/);
  });

  it("mode invalid(빈 문자열) → RangeError(한국어)", () => {
    const summary = makeSummary({});
    expect(() =>
      buildRestoreResult(summary, "" as unknown as "replace"),
    ).toThrow(RangeError);
    expect(() =>
      buildRestoreResult(summary, "" as unknown as "replace"),
    ).toThrow(/mode 는 "replace" \| "merge" 중 하나/);
  });

  it("mode 대문자 MERGE → RangeError", () => {
    const summary = makeSummary({});
    expect(() =>
      buildRestoreResult(summary, "MERGE" as unknown as "replace"),
    ).toThrow(/mode 는 "replace"/);
  });

  it("mode 숫자 → RangeError(받음: 1)", () => {
    const summary = makeSummary({});
    expect(() =>
      buildRestoreResult(summary, 1 as unknown as "replace"),
    ).toThrow(/받음: 1/);
  });

  it("mode null → RangeError", () => {
    const summary = makeSummary({});
    expect(() =>
      buildRestoreResult(summary, null as unknown as "replace"),
    ).toThrow(/mode 는 "replace"/);
  });

  it("mode undefined → RangeError", () => {
    const summary = makeSummary({});
    expect(() =>
      buildRestoreResult(summary, undefined as unknown as "replace"),
    ).toThrow(/mode 는 "replace"/);
  });
});

describe("buildRestoreResult — non-mutating regression (deepFreeze 통과)", () => {
  it("deepFreeze 된 summary + 중첩 perEntity 로 호출해도 throw 0 + 입력 불변", () => {
    const summary = deepFreeze(
      makeSummary({
        deleted: { total: 2, perEntity: { ...zeroMap(), Assessment: 2 } },
        inserted: { total: 1, perEntity: { ...zeroMap(), Person: 1 } },
        kept: { total: 3, perEntity: { ...zeroMap(), Group: 3 } },
      }),
    );
    const before = JSON.stringify(summary);

    let result: RestoreResult | undefined;
    expect(() => {
      result = buildRestoreResult(summary, "merge");
    }).not.toThrow();

    // 입력 불변 단언.
    expect(JSON.stringify(summary)).toBe(before);
    // 반환은 새 객체/배열(입력과 별개).
    expect(Array.isArray(result?.impactLines)).toBe(true);
    expect(result?.restoredCounts).not.toBe(summary.deleted);
    expect(result?.restoredCounts).toEqual({
      deleted: 2,
      inserted: 1,
      kept: 3,
    });
    expect(result?.impactLines).toContain("보존 3 row");
  });
});
