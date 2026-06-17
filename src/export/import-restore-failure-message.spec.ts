// import-restore-failure-message 순수 helper spec — R-112 4 종(happy / error / branch / negative
// 충분 cover). 이미 분류된 RestoreFailureDescriptor{kind, mode} 에서 buildRestoreFailureMessage 가
// {headline, rollbackAssured, detailLines[], retryable} §7.5 복원 실패 안내 모델을 정확히 합성하는지
// (4 kind × mode headline 분기 / rollbackAssured 항상 true / rollback 보장 라인 항상 포함 /
// retryable 분기 connection·timeout·rollback=true·cascade=false / cascade 데이터 확인 안내) +
// 입력 방어 분기(비-object descriptor · kind 허용외 · mode 허용외)별 한국어 TypeError/RangeError +
// non-mutating(deepFreeze 통과)을 검증한다(import-restore-result.spec.ts mirror).
import {
  buildRestoreFailureMessage,
  RestoreFailureDescriptor,
  RestoreFailureKind,
  RestoreFailureMessage,
} from "./import-restore-failure-message";

// 깊은 동결 헬퍼 — non-mutating regression 용.
function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === "object") {
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      deepFreeze((obj as Record<string, unknown>)[key]);
    }
    Object.freeze(obj);
  }
  return obj;
}

// rollback 보장 라인 식별용 부분 문자열.
const ROLLBACK_FRAGMENT = "부분 복원 상태 없음";

const ALL_KINDS: RestoreFailureKind[] = [
  "connection",
  "timeout",
  "rollback",
  "cascade",
];

describe("buildRestoreFailureMessage — happy path", () => {
  it("connection(replace) → headline 에 복원 실패·replace 표기·사유, rollbackAssured true, retryable true, 재시도 안내", () => {
    const result: RestoreFailureMessage = buildRestoreFailureMessage({
      kind: "connection",
      mode: "replace",
    });
    expect(result.headline).toContain("복원 실패");
    expect(result.headline).toContain("전체 교체(replace)");
    expect(result.headline).toContain("DB 연결 끊김");
    expect(result.rollbackAssured).toBe(true);
    expect(result.retryable).toBe(true);
    expect(result.detailLines.some((l) => l.includes("재시도"))).toBe(true);
    expect(result.detailLines.some((l) => l.includes(ROLLBACK_FRAGMENT))).toBe(
      true,
    );
  });

  it("timeout(merge) → headline 에 merge 표기·timeout 사유, retryable true", () => {
    const result = buildRestoreFailureMessage({
      kind: "timeout",
      mode: "merge",
    });
    expect(result.headline).toContain("병합(merge)");
    expect(result.headline).toContain("timeout");
    expect(result.retryable).toBe(true);
    expect(result.rollbackAssured).toBe(true);
  });

  it("rollback(replace) → transaction rollback 사유, retryable true", () => {
    const result = buildRestoreFailureMessage({
      kind: "rollback",
      mode: "replace",
    });
    expect(result.headline).toContain("transaction rollback");
    expect(result.retryable).toBe(true);
    expect(result.detailLines.some((l) => l.includes("재시도"))).toBe(true);
  });

  it("cascade(merge) → cascade constraint 사유, retryable false, 데이터/재업로드 안내", () => {
    const result = buildRestoreFailureMessage({
      kind: "cascade",
      mode: "merge",
    });
    expect(result.headline).toContain("cascade constraint 위반");
    expect(result.retryable).toBe(false);
    expect(result.detailLines.some((l) => l.includes("재업로드"))).toBe(true);
    expect(result.rollbackAssured).toBe(true);
  });

  it("4 kind × 2 mode 모든 조합 — rollbackAssured 항상 true + rollback 보장 라인 항상 포함", () => {
    for (const kind of ALL_KINDS) {
      for (const mode of ["replace", "merge"] as const) {
        const result = buildRestoreFailureMessage({ kind, mode });
        expect(result.rollbackAssured).toBe(true);
        expect(
          result.detailLines.some((l) => l.includes(ROLLBACK_FRAGMENT)),
        ).toBe(true);
        expect(result.detailLines.length).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

describe("buildRestoreFailureMessage — branch / flow cover", () => {
  it("retryable 분기: connection/timeout/rollback → true, cascade → false", () => {
    expect(
      buildRestoreFailureMessage({ kind: "connection", mode: "replace" })
        .retryable,
    ).toBe(true);
    expect(
      buildRestoreFailureMessage({ kind: "timeout", mode: "replace" })
        .retryable,
    ).toBe(true);
    expect(
      buildRestoreFailureMessage({ kind: "rollback", mode: "merge" }).retryable,
    ).toBe(true);
    expect(
      buildRestoreFailureMessage({ kind: "cascade", mode: "merge" }).retryable,
    ).toBe(false);
  });

  it("mode 라벨 분기: replace → 전체 교체(replace), merge → 병합(merge)", () => {
    expect(
      buildRestoreFailureMessage({ kind: "connection", mode: "replace" })
        .headline,
    ).toContain("전체 교체(replace)");
    expect(
      buildRestoreFailureMessage({ kind: "connection", mode: "merge" })
        .headline,
    ).toContain("병합(merge)");
  });

  it("rollbackAssured 항상 true — 어떤 kind 든 부분 복원 상태 없음", () => {
    for (const kind of ALL_KINDS) {
      expect(
        buildRestoreFailureMessage({ kind, mode: "replace" }).rollbackAssured,
      ).toBe(true);
    }
  });

  it("retryable=true 사유는 '재시도' 안내, retryable=false(cascade)는 재시도 아닌 재업로드 안내", () => {
    const retryableResult = buildRestoreFailureMessage({
      kind: "connection",
      mode: "replace",
    });
    expect(retryableResult.detailLines.some((l) => l.includes("재시도"))).toBe(
      true,
    );

    const cascadeResult = buildRestoreFailureMessage({
      kind: "cascade",
      mode: "replace",
    });
    expect(cascadeResult.detailLines.some((l) => l.includes("재업로드"))).toBe(
      true,
    );
    // cascade 안내는 단순 재시도로 해소되지 않음을 명시.
    expect(
      cascadeResult.detailLines.some((l) => l.includes("해소되지 않습니다")),
    ).toBe(true);
  });
});

describe("buildRestoreFailureMessage — error path / negative cases", () => {
  it("descriptor 부재(undefined) → TypeError(한국어)", () => {
    expect(() =>
      buildRestoreFailureMessage(
        undefined as unknown as RestoreFailureDescriptor,
      ),
    ).toThrow(/descriptor 는 plain object 여야 합니다/);
  });

  it("descriptor null → TypeError(받음: null)", () => {
    expect(() =>
      buildRestoreFailureMessage(null as unknown as RestoreFailureDescriptor),
    ).toThrow(/받음: null/);
  });

  it("descriptor 배열 → TypeError(받음: array)", () => {
    expect(() =>
      buildRestoreFailureMessage([] as unknown as RestoreFailureDescriptor),
    ).toThrow(/받음: array/);
  });

  it("descriptor 비-object(number) → TypeError", () => {
    expect(() =>
      buildRestoreFailureMessage(7 as unknown as RestoreFailureDescriptor),
    ).toThrow(/descriptor 는 plain object/);
  });

  it("kind 허용외(빈 문자열) → RangeError(한국어)", () => {
    expect(() =>
      buildRestoreFailureMessage({
        kind: "" as unknown as RestoreFailureKind,
        mode: "replace",
      }),
    ).toThrow(RangeError);
    expect(() =>
      buildRestoreFailureMessage({
        kind: "" as unknown as RestoreFailureKind,
        mode: "replace",
      }),
    ).toThrow(/descriptor\.kind 는 "connection"/);
  });

  it("kind 대문자(CONNECTION) → RangeError", () => {
    expect(() =>
      buildRestoreFailureMessage({
        kind: "CONNECTION" as unknown as RestoreFailureKind,
        mode: "merge",
      }),
    ).toThrow(/descriptor\.kind/);
  });

  it("kind 숫자 → RangeError(받음: 1)", () => {
    expect(() =>
      buildRestoreFailureMessage({
        kind: 1 as unknown as RestoreFailureKind,
        mode: "replace",
      }),
    ).toThrow(/받음: 1/);
  });

  it("kind null → RangeError", () => {
    expect(() =>
      buildRestoreFailureMessage({
        kind: null as unknown as RestoreFailureKind,
        mode: "replace",
      }),
    ).toThrow(/descriptor\.kind/);
  });

  it("kind 허용외(timeOut 오타) → RangeError", () => {
    expect(() =>
      buildRestoreFailureMessage({
        kind: "timeOut" as unknown as RestoreFailureKind,
        mode: "merge",
      }),
    ).toThrow(/descriptor\.kind/);
  });

  it("mode 허용외(빈 문자열) → RangeError(한국어)", () => {
    expect(() =>
      buildRestoreFailureMessage({
        kind: "connection",
        mode: "" as unknown as "replace",
      }),
    ).toThrow(/descriptor\.mode 는 "replace" \| "merge" 중 하나/);
  });

  it("mode 대문자(MERGE) → RangeError", () => {
    expect(() =>
      buildRestoreFailureMessage({
        kind: "timeout",
        mode: "MERGE" as unknown as "replace",
      }),
    ).toThrow(/descriptor\.mode/);
  });

  it("mode 숫자 → RangeError(받음: 0)", () => {
    expect(() =>
      buildRestoreFailureMessage({
        kind: "rollback",
        mode: 0 as unknown as "replace",
      }),
    ).toThrow(/받음: 0/);
  });

  it("mode null → RangeError", () => {
    expect(() =>
      buildRestoreFailureMessage({
        kind: "cascade",
        mode: null as unknown as "replace",
      }),
    ).toThrow(/descriptor\.mode/);
  });

  it("mode undefined → RangeError", () => {
    expect(() =>
      buildRestoreFailureMessage({
        kind: "connection",
        mode: undefined as unknown as "replace",
      }),
    ).toThrow(/descriptor\.mode/);
  });
});

describe("buildRestoreFailureMessage — non-mutating regression (deepFreeze 통과)", () => {
  it("deepFreeze 된 descriptor 로 호출해도 throw 0 + 입력 불변 + 반환은 새 객체/배열", () => {
    const descriptor = deepFreeze<RestoreFailureDescriptor>({
      kind: "cascade",
      mode: "merge",
    });
    const before = JSON.stringify(descriptor);

    let result: RestoreFailureMessage | undefined;
    expect(() => {
      result = buildRestoreFailureMessage(descriptor);
    }).not.toThrow();

    // 입력 불변 단언.
    expect(JSON.stringify(descriptor)).toBe(before);
    // 반환은 새 객체/배열.
    expect(Array.isArray(result?.detailLines)).toBe(true);
    expect(result?.retryable).toBe(false);
    expect(result?.rollbackAssured).toBe(true);
    expect(result?.detailLines.some((l) => l.includes(ROLLBACK_FRAGMENT))).toBe(
      true,
    );
  });
});
