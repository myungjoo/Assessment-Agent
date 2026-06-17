// import-restore-confirmation 순수 helper spec — R-112 4 종(happy / error / branch / negative
// 충분 cover). summarizeRestorePlan(T-0448)이 산출한 RestorePlanSummary + import mode 에서
// buildRestoreConfirmation 이 {destructive, requiresExplicitConfirm, headline, warnings[],
// impactLines[]} 강한 confirmation 모델을 정확히 합성하는지(replace destructive 분기 / merge
// non-destructive / 빈 영향 / perEntity 라인 포함) + 입력 방어 분기(비-object summary · deleted/
// inserted/kept 부재·비-object · total 비-정수 · mode invalid)별 한국어 TypeError + non-mutating
// (deepFreeze 통과)을 검증한다(import-restore-plan-summary.spec.ts / import-preflight-summary.
// spec.ts mirror).
import {
  buildRestoreConfirmation,
  RestoreConfirmation,
} from "./import-restore-confirmation";
import { RestorePlanSummary } from "./import-restore-plan-summary";

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

describe("buildRestoreConfirmation — happy path", () => {
  it("replace + 삭제/삽입 row 존재 → destructive=true·requiresExplicitConfirm=true·warnings 1+", () => {
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
    const conf: RestoreConfirmation = buildRestoreConfirmation(
      summary,
      "replace",
    );

    expect(conf.destructive).toBe(true);
    expect(conf.requiresExplicitConfirm).toBe(true);
    expect(conf.warnings.length).toBeGreaterThanOrEqual(1);
    expect(conf.warnings[0]).toContain("3 row 삭제");
    expect(conf.headline).toContain("전체 교체(replace)");
    expect(conf.headline).toContain("삭제 3");
    // impactLines 는 0 아닌 entity 만 — Assessment/Person(deleted), Group/AuditLog(inserted).
    expect(conf.impactLines).toContain("삭제 3 row");
    expect(conf.impactLines).toContain("  - Assessment: 2 row 삭제");
    expect(conf.impactLines).toContain("  - Person: 1 row 삭제");
    expect(conf.impactLines).toContain("삽입 2 row");
    expect(conf.impactLines).toContain("  - Group: 1 row 삽입");
    // 0 인 entity 는 라인에 없어야 함(LlmConfig 등).
    expect(conf.impactLines.some((l) => l.includes("LlmConfig"))).toBe(false);
  });

  it("merge mode + 삭제 row 존재여도 → destructive=false·warnings=[]·보존 라인 포함", () => {
    const summary = makeSummary({
      deleted: { total: 1, perEntity: { ...zeroMap(), Assessment: 1 } },
      inserted: { total: 2, perEntity: { ...zeroMap(), Person: 2 } },
      kept: { total: 4, perEntity: { ...zeroMap(), Group: 4 } },
    });
    const conf = buildRestoreConfirmation(summary, "merge");

    expect(conf.destructive).toBe(false);
    expect(conf.requiresExplicitConfirm).toBe(false);
    expect(conf.warnings).toEqual([]);
    expect(conf.headline).toContain("병합(merge)");
    expect(conf.headline).toContain("보존 4");
    expect(conf.impactLines).toContain("보존 4 row");
    expect(conf.impactLines).toContain("  - Group: 4 row 보존");
  });
});

describe("buildRestoreConfirmation — branch / flow cover", () => {
  it("replace + 삭제 total===0 → destructive=false·warnings=[](빈 삭제 분기)", () => {
    const summary = makeSummary({
      inserted: { total: 5, perEntity: { ...zeroMap(), Assessment: 5 } },
    });
    const conf = buildRestoreConfirmation(summary, "replace");
    expect(conf.destructive).toBe(false);
    expect(conf.requiresExplicitConfirm).toBe(false);
    expect(conf.warnings).toEqual([]);
    expect(conf.headline).toContain("삭제 0");
  });

  it("빈 영향(전 total 0) → destructive=false·warnings=[]·total 0 라인만", () => {
    const summary = makeSummary({});
    const conf = buildRestoreConfirmation(summary, "replace");
    expect(conf.destructive).toBe(false);
    expect(conf.warnings).toEqual([]);
    // total 라인 3 개만(perEntity 라인 0 — 전부 0).
    expect(conf.impactLines).toEqual([
      "삭제 0 row",
      "삽입 0 row",
      "보존 0 row",
    ]);
  });

  it("perEntity 0 vs >0 라인 포함 분기 — 0 entity 는 라인 생략", () => {
    const summary = makeSummary({
      deleted: {
        total: 5,
        perEntity: { ...zeroMap(), Assessment: 5, Group: 0 },
      },
    });
    const conf = buildRestoreConfirmation(summary, "replace");
    expect(conf.impactLines).toContain("  - Assessment: 5 row 삭제");
    expect(conf.impactLines.some((l) => l.includes("Group"))).toBe(false);
  });

  it("replace mode vs merge mode headline 라벨 분기", () => {
    const summary = makeSummary({
      deleted: { total: 2, perEntity: zeroMap() },
    });
    expect(buildRestoreConfirmation(summary, "replace").headline).toContain(
      "전체 교체(replace)",
    );
    expect(buildRestoreConfirmation(summary, "merge").headline).toContain(
      "병합(merge)",
    );
  });
});

describe("buildRestoreConfirmation — error path / negative cases", () => {
  it("summary 부재(undefined) → TypeError(한국어)", () => {
    expect(() =>
      buildRestoreConfirmation(
        undefined as unknown as RestorePlanSummary,
        "replace",
      ),
    ).toThrow(/summary 는 plain object 여야 합니다/);
  });

  it("summary null → TypeError(받음: null)", () => {
    expect(() =>
      buildRestoreConfirmation(
        null as unknown as RestorePlanSummary,
        "replace",
      ),
    ).toThrow(/받음: null/);
  });

  it("summary 배열 → TypeError(받음: array)", () => {
    expect(() =>
      buildRestoreConfirmation([] as unknown as RestorePlanSummary, "merge"),
    ).toThrow(/받음: array/);
  });

  it("summary 비-object(string) → TypeError", () => {
    expect(() =>
      buildRestoreConfirmation("x" as unknown as RestorePlanSummary, "merge"),
    ).toThrow(/summary 는 plain object/);
  });

  it("summary.deleted 부재 → TypeError(deleted)", () => {
    const bad = {
      inserted: { total: 0, perEntity: zeroMap() },
      kept: { total: 0, perEntity: zeroMap() },
    };
    expect(() =>
      buildRestoreConfirmation(bad as unknown as RestorePlanSummary, "replace"),
    ).toThrow(/summary\.deleted 은\(는\) object 여야 합니다/);
  });

  it("summary.inserted 비-object(null) → TypeError(inserted)", () => {
    const bad = {
      deleted: { total: 0, perEntity: zeroMap() },
      inserted: null,
      kept: { total: 0, perEntity: zeroMap() },
    };
    expect(() =>
      buildRestoreConfirmation(bad as unknown as RestorePlanSummary, "replace"),
    ).toThrow(/summary\.inserted 은\(는\) object .*받음: null/);
  });

  it("summary.kept 부재 → TypeError(kept)", () => {
    const bad = {
      deleted: { total: 0, perEntity: zeroMap() },
      inserted: { total: 0, perEntity: zeroMap() },
    };
    expect(() =>
      buildRestoreConfirmation(bad as unknown as RestorePlanSummary, "merge"),
    ).toThrow(/summary\.kept/);
  });

  it("total 비-정수(소수) → TypeError", () => {
    const bad = makeSummary({ deleted: { total: 1.5, perEntity: zeroMap() } });
    expect(() => buildRestoreConfirmation(bad, "replace")).toThrow(
      /summary\.deleted\.total 은\(는\) 0 이상 정수/,
    );
  });

  it("total 음수 → TypeError", () => {
    const bad = makeSummary({ inserted: { total: -3, perEntity: zeroMap() } });
    expect(() => buildRestoreConfirmation(bad, "replace")).toThrow(
      /summary\.inserted\.total/,
    );
  });

  it("total NaN → TypeError", () => {
    const bad = makeSummary({ kept: { total: NaN, perEntity: zeroMap() } });
    expect(() => buildRestoreConfirmation(bad, "merge")).toThrow(
      /summary\.kept\.total/,
    );
  });

  it("total 비-number(string) → TypeError", () => {
    const bad = makeSummary({
      deleted: { total: "3" as unknown as number, perEntity: zeroMap() },
    });
    expect(() => buildRestoreConfirmation(bad, "replace")).toThrow(
      /summary\.deleted\.total/,
    );
  });

  it("mode invalid(빈 문자열) → TypeError(한국어)", () => {
    const summary = makeSummary({});
    expect(() =>
      buildRestoreConfirmation(summary, "" as unknown as "replace"),
    ).toThrow(/mode 는 "replace" \| "merge" 중 하나/);
  });

  it("mode 대문자 REPLACE → TypeError", () => {
    const summary = makeSummary({});
    expect(() =>
      buildRestoreConfirmation(summary, "REPLACE" as unknown as "replace"),
    ).toThrow(/mode 는 "replace"/);
  });

  it("mode 숫자 → TypeError(받음: 1)", () => {
    const summary = makeSummary({});
    expect(() =>
      buildRestoreConfirmation(summary, 1 as unknown as "replace"),
    ).toThrow(/받음: 1/);
  });

  it("mode undefined → TypeError", () => {
    const summary = makeSummary({});
    expect(() =>
      buildRestoreConfirmation(summary, undefined as unknown as "replace"),
    ).toThrow(/mode 는 "replace"/);
  });
});

describe("buildRestoreConfirmation — non-mutating regression (deepFreeze 통과)", () => {
  it("deepFreeze 된 summary + 중첩 perEntity 로 호출해도 throw 0 + 입력 불변", () => {
    const summary = deepFreeze(
      makeSummary({
        deleted: { total: 2, perEntity: { ...zeroMap(), Assessment: 2 } },
        inserted: { total: 1, perEntity: { ...zeroMap(), Person: 1 } },
        kept: { total: 3, perEntity: { ...zeroMap(), Group: 3 } },
      }),
    );
    const before = JSON.stringify(summary);

    let conf: RestoreConfirmation | undefined;
    expect(() => {
      conf = buildRestoreConfirmation(summary, "replace");
    }).not.toThrow();

    // 입력 불변 단언.
    expect(JSON.stringify(summary)).toBe(before);
    // 반환은 새 객체/배열(입력과 별개).
    expect(conf?.warnings).not.toBe(summary.deleted.perEntity);
    expect(Array.isArray(conf?.impactLines)).toBe(true);
    expect(conf?.destructive).toBe(true);
  });

  it("perEntity 비-object 여도(total 만 유효) entity 라인 0 으로 정상 처리", () => {
    const bad = {
      deleted: { total: 2, perEntity: null },
      inserted: { total: 0, perEntity: zeroMap() },
      kept: { total: 0, perEntity: zeroMap() },
    };
    const conf = buildRestoreConfirmation(
      bad as unknown as RestorePlanSummary,
      "replace",
    );
    // total 라인은 나오되 perEntity 라인은 0(perEntity 비-object 면 생략).
    expect(conf.impactLines).toContain("삭제 2 row");
    expect(conf.impactLines.filter((l) => l.startsWith("  - "))).toEqual([]);
    expect(conf.destructive).toBe(true);
  });
});
